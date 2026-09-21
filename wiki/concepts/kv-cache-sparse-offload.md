---
id: kv-cache-sparse-offload
title: "Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行"
type: feature
summary: PD 分离的 D 节点不再分配 NPU 主 KV 缓存。全量主 KV 住在主机 pinned 内存，每个 decode 步由 indexer 选出 top-k，再由每层一张 LRU 表决定哪几行要搬回 NPU 热缓冲区。
aliases: [Sparse KV Offload, 稀疏 KV 卸载, Sparse Decode Offload, Sparse KV Cache Offload, sparse_kv_offload_config]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L211-L251
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L154-L192
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1457-L1476
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1488-L1523
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L858-L864
  - vllm-ascend@b255ab59:vllm_ascend/attention/sfa_v1.py#L266-L302
  - vllm-ascend@b255ab59:vllm_ascend/attention/sfa_kv_offload.py#L192-L229
  - vllm-ascend@b255ab59:vllm_ascend/attention/sfa_kv_offload.py#L346-L394
  - vllm-ascend@b255ab59:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1134
  - vllm-ascend@b255ab59:vllm_ascend/attention/sfa_kv_offload.py#L7-L20
  - vllm-ascend@b255ab59:vllm_ascend/device/device_op.py#L1367-L1380
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L107-L140
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L235-L295
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L316-L346
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L752-L768
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1307-L1333
  - vllm-ascend@b255ab59:csrc/torch_binding.cpp#L2304-L2398
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5602-L5610
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/index.md#L5-L37
  - vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L1553-L1566
  - https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1041-L1089
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求在启动校验就被拦下，这一页得换成稀疏注意力模型 + PD 分离的 D 节点才有数可算
  - to: kv-cache-spec
    kind: builds-on
    note: 开关直接写进 AscendMLAAttentionSpec 的 store_on_host，由 spec 区分哪些层的 KV 落主机、哪些留设备
  - to: block-table
    kind: builds-on
    note: indexer 给的是逻辑 token 位置，要先过 block_table 才能换算成主机池里的字节地址
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: profiling 算出的可用显存是 plan_sparse_kv_offload_memory 三个块数上限里的 npu 那一项
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 同一份官方文档把两者配成一对——P 节点整层搬、D 节点只搬 top-k，因为两阶段的算力/搬运比完全不同
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样把 KV 放主机，但那条路按整块换入换出且不挑 token，这条只搬 indexer 选中的行
  - to: kv-cache-quantization
    kind: conflicts-with
    note: enable_sparse_sfa_c8 与本特性互斥，主 KV 必须 BF16；只有 indexer 的 LI C8 还能开
contradicts: []
updated: "2026-09-21"
---

## 一句话

Sparse KV Offload 让 PD 分离部署里的 D 节点**不再分配 NPU 主 KV 缓存**：全量主 KV 住在主机 pinned 内存里，每个 decode 步由模型自带的 indexer 选出 `index_topk` 个 token，再由每层一张 LRU 驻留表判断哪些已经躺在 NPU 热缓冲区里，**只把没命中的那几行 H2D 搬回来** [S2]。搬运量于是正比于 top-k 的未命中数，而不是序列长度——这是它能在算力极少的 decode 阶段成立的全部理由。**v0.23 维护分支上没有它**：全仓搜 `sparse_kv_offload` 零命中，特性指南目录里也没有这一页 [S19][!]。v0.26 分支起才有，配置键、默认值与启动期那几道校验和 main 一模一样 [C22]，只有下面那条融合路径是 main 独有的。

```wiki-diagram
file: kv-cache-sparse-offload
```

## 那条请求用不到它

[那条请求](one-request.md)是 Qwen3-0.6B、单卡、没有 PD 分离，它在启动时会被 `_validate_preconditions` 连拦两道：模型配置里没有 `index_topk`，直接报 `Sparse KV offload only support sparse attention model.`；就算换了模型，`keep_device_kv_cache=False` 时还要求 `kv_transfer_config.is_kv_consumer`，不是 D 节点就 `AssertionError` [C4]。

要让这一页有数可算，得换三样：稀疏注意力模型、PD 分离的 D 节点、接上 KV 传输。下面这组数用 DeepSeek-V3.2（`kv_lora_rank=512`、`qk_rope_head_dim=64`、61 层、`index_topk=2048`）[S21]，D 节点 `max_num_seqs=32`、不开 MTP、`block_size=128` [A]，配置抄官方指南那一组 [S1]：

```bash
--additional-config '{"sparse_kv_offload_config": {
    "enabled": true, "topk_buffer_size": 4096, "dram_size_per_dp_GB": 128 }}' \
--kv-transfer-config '{"kv_connector": "SfaRemoteD2HConnector", "kv_role": "kv_consumer",
    "kv_port": 20050, "kv_connector_extra_config": {
        "transfer_backend": "memfabric", "use_layerwise": true }}'
```

`topk_buffer_size = 4096` 一个数同时满足三条约束：≥ `index_topk`（2048，启动期校验 [C4]）、被 `block_size` 整除（128 × 32，建 impl 时再校验一遍 [C7]）、按官方建议取 `2 × index_topk`。

## 省下的是两个数量级

MLA 只有一个 KV 头，K 走 `kv_lora_rank`、V 走 `qk_rope_head_dim`，而这条路径上主 KV 被强制成 BF16 [C15]：

| 这一步在算什么 | 算式 | 结果 |
|---|---|---|
| 每 token 每层 | `1 × (512 + 64) × 2 B` | 1152 B |
| 每 token 全模型 | `1152 × 61` | 70,272 B ≈ 68.6 KiB |
| 主机池装得下几块 | `(128 GiB − 61 × 3 × 2 MiB) ÷ (128 × 1152 × 61)` | **15,237 块** = 1,950,336 个 token 的位置 |
| NPU 上常驻多少 | `32 × 4096 × (512 + 64) × 2 B × 61` | **8.58 GiB** |
| 同样长度全放 NPU 要 | `1,950,336 × 70,272 B` | **127.6 GiB** |

**8.58 GiB 换 127.6 GiB，这就是这个特性的全部意义** [D]。减掉的那一项是主机池的对齐预留，每个落主机的 spec 三个 2 MiB 对齐单位；那个 `32` 是 `max_num_topk_rows = min(max_num_batched_tokens, max_num_seqs × decode_width)`，热缓冲区按它乘 `topk_buffer_size` 整块预分配，与序列实际有多长无关 [C12]。

这顺手把显存预算翻了个面。`plan_sparse_kv_offload_memory` 里的 `npu_page_size_bytes` **只累加 `store_on_host=False` 的那些 spec**——也就是留在设备上的 indexer 缓存，主 KV 一个字节都不算；最终块数在 npu / dram / workload 三个上限里取最小，代码还专门为「dram 比 npu 小」写了一条劝你调大 `dram_size_per_dp_GB` 的 warning [C13]。**能开多长的 `max_model_len`、多大的 batch，从此是个主机内存问题。** 哪些层落主机由 [KV Cache Spec](kv-cache-spec.md) 的 `store_on_host` 标记决定，这个标记本身就是开关；这一步怎么接在显存探测后面，见 [显存 profiling](kv-cache-memory-profiling.md)。

三个近亲的边界也在这里划开：[CPU Offload](kv-cache-cpu-offload.md) 按整块换入换出、不挑 token；[Layerwise Offload](kv-cache-layerwise-offload.md) 管的是 P 节点把整层搬走；[Recompute CPU Offload](recompute-cpu-offload.md) 只在抢占发生时搬一整条请求的块。只有这一条是每个 decode 步都在搬 top-k 的行。

## 热缓冲区必须比 index_topk 大，背后是一条安全性质

LRU 那段 C++ 每步做三件事：把命中的槽位挪到队尾、把没命中的 top-k 位置分给队首的可驱逐槽位、再按「剩余可驱逐 → 新分配 → 命中」的顺序重排整条队。分配数是 `assign_count = min(miss_count, evictable_count)` [C17]——**要是可驱逐槽位不够，多出来的 miss 就拿不到槽位，那个 top-k 位置会被静默跳过。**

而 `evictable_count = capacity − hit_count ≥ topk − hit_count ≥ miss_count`，所以只要 `topk_buffer_size ≥ topk`，`assign_count` 恒等于 `miss_count`，每个 miss 都一定分得到槽位 [D]。前面那条启动期校验存在的理由就是这个。

缓冲区的大小同时决定了要搬多少。冷启动最坏情况下 2048 个 top-k 全部 miss：每行每层 `2048 × 1152 B = 2.25 MiB`，32 行 × 61 层 = **4.29 GiB** 的 H2D，一个 decode 步绝无可能扛住 [D]。稳态下相邻两步的 top-k 高度重叠，miss 只剩个位数到几十行，搬运量才降到可接受——**缓冲区越大、跨步命中越多、TPOT 越低，代价就是上表里那 8.58 GiB** [D]。

MTP / 投机场景还多一道作废：`stable_prefix_len` 之后的 token 会被强制清掉，因为那段后缀可能已被下一步改写 [C17]。这段 C++ 跑在 host 上，图模式下由 `torch_npu.npu._launch_host_func` 挂到计算流上执行，算完的地址表再交给 `offload.sparse_copy` 发 H2D。TP 下 decode 产出的 KV 是复制的，所以只有 TP rank 0 分配主机池并写新 token 行，其它 rank 通过广播出来的全局虚拟地址访问同一块 [S2]。

## main 上多了一条文档里没有的融合路径

整条卸载逻辑住在单独的 `sfa_kv_offload.py`：开关一打开，`AscendSFABackend` 的 `get_impl_cls()` / `get_builder_cls()` 就换成那一对类，`sfa_v1.py` 保持干净；impl 顺手把预处理钉死成 `PreprocessType.NATIVE`，`sfa_prolog_v3`/mlapo 融合预处理被关掉。

main 上新出现的是 `use_fused_overlap`，默认 `False`，而整个 `docs/` 里搜不到这个词 [C3][!]。打开之后 decode 不再走「LRU 搬 miss → 再跑一次稀疏注意力」两步，而是一次 `npu_fused_sparse_attention_overlap`：算子**直接读主机池里的全量 KV**，NPU 上那对 `topk_buffers` 改当一块带 block_status / membership_map 的选择缓存用 [C10]。同一个 PR 还把原来独立的 `sparse_kv_offload.cpp` 整个搬进了 `csrc/torch_binding.cpp`（v0.26 上它仍是那个独立文件），LRU 主体逐行照搬，只多了一个 `visible_seq_len` 门——MTP 里还没可见的 token 不参与选中。

下表对照 **v0.23 维护分支**（源码快照 `2c59ff10`）、**v0.26 分支**（`2ed6cbba`）与 **main 开发主线**（`b255ab59`）。v0.23 上整个特性不存在，所以那一列统一是「—」：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 特性本身 | 代码与文档都没有 | 有 | `sparse_kv_offload_config` | 在 v0.23 上照 main 文档配，这个键无人接收 [!] |
| `topk_buffer_size` | — | 同 main | 默认 4096，须 ≥ `index_topk` 且被 `block_size` 整除 | 两条都是硬校验；正因 ≥ topk，每个 miss 必定分得到槽位 |
| `dram_size_per_dp_GB` | — | 同 main | 默认 128，每 DP 一份 | 主机总占用 = 该值 × `data_parallel_size`，DP 内 TP 共享一份 |
| `keep_device_kv_cache` | — | 同 main | 默认 `false` | 开了等于不省显存，只为 PD 同机调试；生产必须关 |
| `use_fused_overlap` | — | 没有这个键 | 默认 `false`，`docs/` 里查不到 | main 新加的融合 decode 路径，v0.26 上配了也没人认 [!] |
| 主 KV dtype | — | 同 main | 必须 BF16 | `enable_sparse_sfa_c8` 直接报错，indexer 的 LI C8 不受限 |
| 部署形态 | — | 同 main | 仅 PD 分离的 D 节点 | 非 D 节点启用直接 `AssertionError` |
| 并行与 runner | — | 同 main | DP / TP 可用；CP、PP、model runner v2 报错 | 长序列想同时开 CP 的路走不通 |
| 预处理路径 | — | 同 main | 强制 `PreprocessType.NATIVE` | 融合预处理被关掉，是确定要付的吞吐代价 |
| LRU 那段 C++ 住哪 | — | 独立文件 `sparse_kv_offload.cpp` | 已并进 `csrc/torch_binding.cpp` | main 多一个 `visible_seq_len` 门，v0.26 还没有 |

v0.23 维护分支上有的是完整的 SFA + lightning indexer 稀疏注意力 [C20]：选中的 token 和 main 一样，差别只在这些 KV 从显存取还是从主机取。

## 常见误解

- **「稀疏卸载会掉精度。」**——不会额外掉。稀疏来自模型自身的 DSA indexer，开不开卸载选出来的都是同一批 token [C11]；卸载只决定这些 KV 从主机还是从显存取。真正动精度的是主缓存量化，而它在这条路径上被直接禁掉、强制 BF16 [C5]。
- **「热缓冲区调大能省显存。」**——正相反。`topk_buffers_k/v` 是常驻 NPU 的开销，调大是**拿显存换命中率**：命中率上去、H2D 少了、TPOT 才降。省显存靠的是「主 KV 不在设备上」，不是靠这个缓冲区。
- **「D 节点还留着一份 NPU 主 paged KV，热缓冲区只是加速。」**——默认不留。`keep_device_kv_cache=False` 时那两个设备张量直接是 `None` [C14]，新 token 算完按行 D2H 进主机池。留着那一份是调试形态，官方明确写着生产别开 [S1]。
