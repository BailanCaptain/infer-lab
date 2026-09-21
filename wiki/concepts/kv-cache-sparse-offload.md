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
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L105-L128
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L141-L168
  - https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L353-L367
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L124-L155
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_kv_offload.py#L1-L17
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_kv_offload.py#L135-L180
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L52-L97
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L121-L184
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L310-L371
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L373-L409
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L486-L503
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L940-L975
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L77-L200
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L607-L639
  - vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L473-L520
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
    note: profiling 探出来的可用显存，就是被主机/设备字节比放大、再拿去分块的那个数
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

Sparse KV Offload 让 PD 分离部署里的 D 节点**不再分配 NPU 主 KV 缓存**：全量主 KV 住在主机 pinned 内存里，每个 decode 步由模型自带的 indexer 选出 `index_topk` 个 token，再由每层一张 LRU 驻留表判断哪些已经躺在 NPU 热缓冲区里，**只把没命中的那几行 H2D 搬回来** [S23]。搬运量于是正比于 top-k 的未命中数，而不是序列长度——这是它能在算力极少的 decode 阶段成立的全部理由。

**v0.23 维护分支上没有它**：全仓搜 `sparse_kv_offload` 零命中，`vllm_ascend/attention/` 下没有 `sfa_kv_offload.py` 这个文件，特性指南目录里也只列了另外两种卸载 [S19][!]。**v0.26 分支起才有，下面的正文按 v0.26 讲**（源码快照 `2ed6cbba`）；main 上多出来的那条融合路径、搬了家的 LRU、多加的一道可见性闸，收在末尾的差异表里。

```wiki-diagram
file: kv-cache-sparse-offload
```

## 那条请求用不到它

[那条请求](one-request.md)是 Qwen3-0.6B、单卡、没有 PD 分离，它在启动时就被 `SparseKVOffloadConfig` 的构造函数连拦两道：模型配置里没有 `index_topk`，直接报 `Sparse KV offload only support sparse attention model.`；就算换了模型，`keep_device_kv_cache=False` 时还要求 `kv_transfer_config.is_kv_consumer`，不是 D 节点就 `AssertionError` [C22]。同一段里还挡掉 context parallel、pipeline parallel 和 model runner v2——**这三样和它同时开一个都不行**。

要让这一页有数可算，得换三样：稀疏注意力模型、PD 分离的 D 节点、接上 KV 传输。下面这组数用 DeepSeek-V3.2（`kv_lora_rank=512`、`qk_rope_head_dim=64`、61 层、`index_topk=2048`）[S21]，D 节点 `max_num_seqs=32`、不开 MTP、`block_size=128` [A]，配置抄官方指南那一组 [S24]：

```bash
--additional-config '{"sparse_kv_offload_config": {
    "enabled": true, "topk_buffer_size": 4096, "dram_size_per_dp_GB": 128 }}' \
--kv-transfer-config '{"kv_connector": "SfaRemoteD2HConnector", "kv_role": "kv_consumer",
    "kv_port": 20050, "kv_connector_extra_config": {
        "transfer_backend": "memfabric", "use_layerwise": true }}'
```

`topk_buffer_size = 4096` 一个数同时满足三条约束：≥ `index_topk`（2048，启动期校验 [C22]）、被 `block_size` 整除（128 × 32，注册 KV 缓存时再校验一遍 [C34]）、按官方建议取 `2 × index_topk`。

## 省下的是两个数量级

MLA 只有一个 KV 头，K 走 `kv_lora_rank`、V 走 `qk_rope_head_dim`，而这条路径上主 KV 被强制成 BF16——热缓冲区的 dtype 不是 BF16 就直接抛异常 [C34]：

| 这一步在算什么 | 算式 | 结果 |
|---|---|---|
| 每 token 每层 | `1 × (512 + 64) × 2 B` | 1152 B |
| 每 token 全模型 | `1152 × 61` | 70,272 B ≈ 68.6 KiB |
| 128 GiB 主机预算最多装几块 | `(128 GiB − 61 × 3 × 2 MiB) ÷ (128 × 1152 × 61)` | **15,237 块** = 1,950,336 个 token 的位置 |
| NPU 上常驻多少 | `32 × 4096 × (512 + 64) × 2 B × 61` | **8.58 GiB** |
| 同样长度全放 NPU 要 | `1,950,336 × 70,272 B` | **127.6 GiB** |

**8.58 GiB 换 127.6 GiB，这就是这个特性的全部意义** [D]。减掉的那一项是主机池的对齐预留：每个落主机的 spec 按 2 MiB 对齐，一次分配先多留一个对齐块，K 和 V 各再向上取整一次，合计三个 [C31]。那个 `32` 是 `max_num_topk_rows = min(max_num_batched_tokens, max_num_seqs × decode_width)`，热缓冲区按它乘 `topk_buffer_size` 整块预分配，与序列实际有多长无关 [C30]。

这顺手把显存预算翻了个面。worker 探出来的可用显存只够留在设备上的那部分（indexer 缓存），`update_available_memory_for_sparse_kv_offload` 再按「落主机的 `page_size_bytes` ÷ 留设备的 `page_size_bytes`」这个比例把主机那一份折算出来加回去，上游那套「可用字节 ÷ 每块字节」的分块逻辑一行都不用改。**折算出来的主机需求一旦超过 `dram_size_per_dp_GB`，是直接 `ValueError` 让你调大，不是悄悄降规格** [C37]。**能开多长的 `max_model_len`、多大的 batch，从此是个主机内存问题。** 哪些层落主机由 [KV Cache Spec](kv-cache-spec.md) 的 `store_on_host` 标记决定，这个标记本身就是开关；这一步怎么接在显存探测后面，见 [显存 profiling](kv-cache-memory-profiling.md)。

三个近亲的边界也在这里划开：[CPU Offload](kv-cache-cpu-offload.md) 按整块换入换出、不挑 token；[Layerwise Offload](kv-cache-layerwise-offload.md) 管的是 P 节点把整层搬走；[Recompute CPU Offload](recompute-cpu-offload.md) 只在抢占发生时搬一整条请求的块。只有这一条是每个 decode 步都在搬 top-k 的行。

## 热缓冲区必须比 index_topk 大，背后是一条安全性质

LRU 那段 C++ 每步做三件事：把命中的槽位挪到队尾、把没命中的 top-k 位置分给队首的可驱逐槽位、再按「剩余可驱逐 → 新分配 → 命中」的顺序重排整条队。分配数是 `assign_count = min(miss_count, evictable_count)` [C36]——**要是可驱逐槽位不够，多出来的 miss 就拿不到槽位，那个 top-k 位置会被静默跳过。**

而 `evictable_count = capacity − hit_count ≥ topk − hit_count ≥ miss_count`，所以只要 `topk_buffer_size ≥ topk`，`assign_count` 恒等于 `miss_count`，每个 miss 都一定分得到槽位 [D]。前面那条启动期校验存在的理由就是这个。

缓冲区的大小同时决定了要搬多少。冷启动最坏情况下 2048 个 top-k 全部 miss：每行每层 `2048 × 1152 B = 2.25 MiB`，32 行 × 61 层 = **4.29 GiB** 的 H2D，一个 decode 步绝无可能扛住 [D]。稳态下相邻两步的 top-k 高度重叠，miss 只剩个位数到几十行，搬运量才降到可接受——**缓冲区越大、跨步命中越多、TPOT 越低，代价就是上表里那 8.58 GiB** [D]。

MTP / 投机场景还多一道作废：`stable_prefix_len` 之后的 token 会被强制清掉，因为那段后缀可能已被下一步改写。

## 整条逻辑住在一个单独模块，那段 LRU 是起服务时才编的

开关一打开，`AscendSFABackend` 的 `get_impl_cls()` / `get_builder_cls()` 就换成 `sfa_kv_offload.py` 里那一对类，`sfa_v1.py` 保持干净；impl 顺手把预处理钉死成 `PreprocessType.NATIVE`，`sfa_prolog_v3` / mlapo 那条融合预处理被关掉 [C29]。

**那段 LRU 的 C++ 不是随包编好的。** v0.26 上它是模块目录下的 `sparse_kv_offload.cpp`，建 manager 时才用 `torch.utils.cpp_extension.load` 现场编译，编译器写死 `clang++`、开 `-fopenmp` 与 `-march=armv8.2-a+sve+fp16+bf16` [C33]——官方要求镜像里额外装 Clang 和 OpenMP，就是为了这一步 [!]。

主机池则是起服务时一次开到位：`offload.OffloadConfig` 的 `reserve_size` 与 `alloc_size` 都取 `dram_size_per_dp_GB`，场景是 `SHARED`，而 `alloc_size` **只在 TP rank 0 上非零** [C32]。TP 下 decode 产出的 KV 是复制的，所以只有 rank 0 真的分配主机池并写新 token 行，其它 rank 通过共享出来的地址访问同一块；每步搬运前还要一次 `tp_group.broadcast`，确保 rank 0 的 D2H 先于其它 rank 的 H2D。那段 LRU 跑在 host 上，图模式下由 `torch_npu.npu._launch_host_func` 挂到计算流上执行，算完的地址表再交给 `offload.sparse_copy` 发 H2D [C35]。

## v0.26 分支与 main 的差异

v0.23 上整个特性不存在，所以只摆这两列。main 指 2026-09-19 的源码快照 `b255ab59`。

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `use_fused_overlap` | 没有这个键 | 默认 `false`；打开后 decode 不再「搬 miss → 再算」两步，而是一次 `npu_fused_sparse_attention_overlap`，算子直接读主机池里的全量 KV | v0.26 上配了没人接收，而且 main 的 `docs/` 里也搜不到这个词 [!] |
| LRU 那段 C++ | 模块目录下的 `sparse_kv_offload.cpp`，起服务时 clang++ 现场编 | 已并进 `csrc/torch_binding.cpp`，随包编好 | v0.26 的镜像不装 Clang / OpenMP 就起不来；main 不再需要 [!] |
| MTP 的可见性闸 | 只有 `stable_prefix_len` 一道 | 多一个 `visible_seq_len` 门，还没可见的 token 不参与选中 | 投机场景下 main 挡得更严，v0.26 靠的是前缀稳定长度 |
| 显存预算怎么算 | worker 按主机/设备字节比折算，超 `dram_size_per_dp_GB` 直接 `ValueError` | `plan_sparse_kv_offload_memory` 在 npu / dram / workload 三个上限里取最小，dram 偏小只给一条 warning | v0.26 上 dram 给小了是起不来；main 会照样起、悄悄按主机内存降规格 [!] |
| 配置类的形态 | 普通类，校验全写在 `__init__` 里 | `@config` dataclass + `_validate_preconditions`，另外校验 `dram_size_per_dp_GB > 0` | 键名与默认值两边一致，只是报错的位置和时机不同 |

v0.23 维护分支上有的是完整的 SFA + lightning indexer 稀疏注意力 [C20]：选中的 token 和这里一样，差别只在这些 KV 从显存取还是从主机取。

## 常见误解

- **「稀疏卸载会掉精度。」**——不会额外掉。稀疏来自模型自身的 DSA indexer，开不开卸载选出来的都是同一批 token；卸载只决定这些 KV 从主机还是从显存取。真正动精度的是主缓存量化，而它在这条路径上被直接禁掉：`enable_sparse_sfa_c8` 与本特性同时打开会 `NotImplementedError`，indexer 的 LI C8 不受限 [C26]。
- **「热缓冲区调大能省显存。」**——正相反。`topk_buffers_k/v` 是常驻 NPU 的开销，调大是**拿显存换命中率**：命中率上去、H2D 少了、TPOT 才降。省显存靠的是「主 KV 不在设备上」，不是靠这个缓冲区。
- **「D 节点还留着一份 NPU 主 paged KV，热缓冲区只是加速。」**——默认不留。`keep_device_kv_cache=False` 时那两个设备张量直接是 `None` [C31]，新 token 算完按行 D2H 进主机池。留着那一份是调试形态，官方文档明确写着生产别开 [S24]。
