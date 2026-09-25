---
id: kv-cache-sparse-offload
title: "Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行"
type: feature
summary: PD 分离的 D 节点把全部 KV 放进主机内存，NPU 上只留一小块热缓冲区；每生成一个 token，只把这一步要读、NPU 上又还没有的那几行搬回来。
aliases: [Sparse KV Offload, 稀疏 KV 卸载, Sparse Decode Offload, Sparse KV Cache Offload, sparse_kv_offload_config]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L211-L251
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L154-L192
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1467-L1486
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1498-L1533
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L862-L868
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L280-L316
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L192-L229
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L346-L394
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1134
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L7-L20
  - vllm-ascend@baa023ad:vllm_ascend/device/device_op.py#L1367-L1380
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L107-L140
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L235-L295
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L316-L346
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L752-L768
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1307-L1333
  - vllm-ascend@baa023ad:csrc/torch_binding.cpp#L2304-L2398
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5882-L5890
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求（Qwen3.6-35B-A3B、没有 PD 分离）在启动校验就被拦下，这一页得换成稀疏注意力模型 + PD 分离的 D 节点才有数可算
  - to: kv-cache-spec
    kind: builds-on
    note: 开关直接写进 AscendMLAAttentionSpec 的 store_on_host，由 spec 区分哪些层的 KV 落主机、哪些留设备
  - to: block-table
    kind: builds-on
    note: indexer 给的是逻辑 token 位置，要先过块表才能换算成主机池里的字节地址
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
updated: "2026-09-25"
---

在 [PD 分离](pd-disaggregation.md)部署里，负责 decode 的 D 节点**不再在 NPU 上存完整的 KV**：全部 KV 放进主机内存，NPU 上只留一小块「热缓冲区」。每生成一个 token，模型自己先挑出这一步真正要看的那一小撮旧 token，其中已经在热缓冲区里的不动，**只把没在里面的那几行从主机搬上来**。搬多少取决于「这一步挑中的里有几个不在 NPU 上」，而不是对话有多长——这是它能在 decode 阶段成立的全部理由。

这个特性在 v0.23 维护分支上不存在，v0.26 分支起才有；下面按 v0.26 讲，开发主线上的不同放在「版本差异」。

```wiki-diagram
file: kv-cache-sparse-offload
```

## 先问一个问题：128 GiB 的 KV 放不进显存怎么办

设想一台 D 节点同时在回 32 条请求，每条都已经读过约 6 万个 token 的历史。模型是 DeepSeek-V3.2，它每个 token 在全部 61 层里要存的 KV 约 68.6 KiB。32 × 6 万 × 68.6 KiB，加起来约 **127.6 GiB**——一颗 NPU 的显存根本装不下。

常规办法只有两个：少接几条请求，或者把最长能聊多少 token 调小。这两个都是拿吞吐或能力去换显存。

这一页的特性给了第三条路：KV 全放主机内存（一台机器的主机内存通常是几百 GiB 甚至上 TiB），NPU 上只留每一步真正要用的那部分。能这么做，前提是模型本身「每一步只看一小部分历史」。

## 每一步其实只看 2048 个旧 token

普通的[注意力](attention-qkv.md)每生成一个 token，都要拿它和**所有**旧 token 算一遍。历史 6 万个，就读 6 万行 KV。

DeepSeek-V3.2 不这样。它的每层注意力前面多了一个很小的打分器（indexer）：先粗略给所有旧 token 打个分，挑出分最高的 2048 个，真正的注意力只在这 2048 个上算。这就是「稀疏注意力」。

既然每一步只读 2048 行，那剩下的 5 万多行放在哪里都不影响这一步——放在主机内存里就行。挑不挑、挑哪些，是模型自己的事；放不放主机，只影响这 2048 行从哪里读，**不改变选中的是哪些 token，也就不改变结果**。

## 主机放全量，NPU 只留一个热缓冲区

于是 D 节点上的东西分成两处：

- **主机内存**：全部 KV。这台机器给每个数据并行组划了 128 GiB，按一块 128 个位置切，能装 15,237 块，也就是 1,950,336 个 token 的位置——平均每条请求约 6 万个。
- **NPU**：每条请求每层一块热缓冲区，能放 4096 个 token 的 KV，比每步要读的 2048 大一倍。32 条请求、61 层，全部加起来 **8.58 GiB**，而且这个数只跟「同时几条请求」有关，跟对话多长无关。

| | 放在哪 | 多大 |
|---|---|---|
| 这 1,950,336 个位置的 KV 全放 NPU | NPU | 127.6 GiB |
| 开了这个特性后 NPU 上常驻的 | NPU | 8.58 GiB |
| 全量 KV | 主机内存 | 约 128 GiB |

**8.58 GiB 换 127.6 GiB，这就是这个特性的全部意义。** 从此能开多长的对话、多大的并发，变成了一个主机内存问题。

新生成的 token，它的 K 和 V 算完就直接写回主机内存，不在 NPU 上多留一份完整的 KV。

## 每一步只搬没命中的那几行

热缓冲区放不下全部历史，所以每一步开始前要做一次核对。每层有一张小表，记着热缓冲区里现在放的是哪些 token：

1. 打分器挑出这一步要读的 2048 个 token。
2. 其中已经在热缓冲区里的（**命中**），不动，并记一笔「刚用过」。
3. 不在里面的（**没命中**），挤掉热缓冲区里最久没用过的格子，把这几行从主机内存搬上来。
4. 注意力只读热缓冲区。

相邻两步挑中的 token 大部分是同一批，所以稳定之后，每步没命中的只有个位数到几十行，搬运量很小。最坏的是刚开始、热缓冲区还空着的时候：2048 行全都没命中，32 条请求 61 层一共要搬 4.29 GiB，一步里扛不住。热缓冲区越大，跨步命中越多，每步越快；代价是上面那 8.58 GiB 的显存。

**为什么热缓冲区必须至少和每步要读的 2048 一样大？** 因为每个没命中的 token 都得在热缓冲区里抢到一格。只要热缓冲区不小于 2048，扣掉这一步命中的格子，剩下能挤的格子一定够分给所有没命中的；要是小于 2048，就会有被挑中的 token 分不到格子，被悄悄跳过——这一步的注意力就少读了一部分历史。所以启动时直接检查这个大小，不够就不让起。

## 那条请求为什么用不上它

[那条请求](one-request.md)用的是 Qwen3.6-35B-A3B，两颗 NPU，没有 PD 分离。它在启动时就会被拦下，而且拦它的是第一道门：**这个模型没有打分器**。

它 40 层里有 10 层是全注意力、30 层是[线性注意力](linear-attention.md)。全注意力那 10 层每生成一个 token 都要读全部历史，没有「只挑 2048 个」这回事，自然也谈不上「只搬没命中的」；线性注意力那 30 层根本不存历史，只有一份固定大小的状态（30.7 MiB，补齐后实际占 60.7 MiB），不随对话变长。

再看数字就更清楚：这个模型每个 token 在全注意力的每层只存 2 KiB（两颗 NPU 分摊后每颗 1 KiB），10 层合计每颗 10 KiB；DeepSeek-V3.2 是 68.6 KiB。它本来就没到「显存装不下 KV」那一步。

就算换一个有打分器的模型，第二道门还在：这个特性只给 PD 分离里的 D 节点用；而 Qwen3.6-35B-A3B 在官方支持矩阵里三个版本都不支持 PD 分离。所以这一页的数字全换成 DeepSeek-V3.2、一台 D 节点。

## 三个近亲怎么分

同样是「把 KV 放主机内存」，vLLM-Ascend 里还有三条路，区别在于**搬什么、什么时候搬**：

- [CPU Offload](kv-cache-cpu-offload.md)：按整块换进换出，不挑 token。
- [Layerwise Offload](kv-cache-layerwise-offload.md)：P 节点把算完的一整层搬走。官方文档把它和本页配成一对——prefill 算力多、整层搬划得来；decode 算力少，只能搬挑中的那几行。
- [Recompute CPU Offload](recompute-cpu-offload.md)：只在请求被抢占时，搬走这一条请求的全部块。

只有这一条是**每个 decode 步都在搬、而且只搬挑中的那几行**。

## 常见误解

- **「放到主机会掉精度。」**——不会额外掉。挑哪些 token 是模型自己的打分器定的，开不开这个特性挑出来的都一样；它只决定这些 KV 从哪里读。反而是 KV 量化在这条路上被禁掉了，主 KV 必须保持 BF16。
- **「热缓冲区调大能省显存。」**——正相反。热缓冲区是常驻 NPU 的，调大是拿显存换命中率。省显存靠的是「完整 KV 不在 NPU 上」，不是这块缓冲区。
- **「D 节点还留着一份完整 KV，热缓冲区只是加速。」**——默认不留。留一份的形态只用来调试，官方文档明确说生产别开。

## 对照源码

### 怎么开

官方指南给 D 节点的那组配置 [S24]：

```bash
--additional-config '{"sparse_kv_offload_config": {
    "enabled": true, "topk_buffer_size": 4096, "dram_size_per_dp_GB": 128 }}' \
--kv-transfer-config '{"kv_connector": "SfaRemoteD2HConnector", "kv_role": "kv_consumer",
    "kv_port": 20050, "kv_connector_extra_config": {
        "transfer_backend": "memfabric", "use_layerwise": true }}'
```

- 三个键：`enabled` 默认 `False`；`topk_buffer_size` 默认 4096；`dram_size_per_dp_GB` 默认 128；另有 `keep_device_kv_cache` 默认 `False` [C22]。
- `topk_buffer_size = 4096` 一个数同时满足三条约束：≥ `index_topk`（2048，启动期校验）、被 `block_size` 整除（128 × 32，注册 KV 缓存时再校验一遍 [C34]）、按官方建议取 `2 × index_topk`。
- 页面上用的 DeepSeek-V3.2 形状：`kv_lora_rank=512`、`qk_rope_head_dim=64`、61 层、`index_topk=2048` [S21]；D 节点 `max_num_seqs=32`、不开 MTP、`block_size=128` [A]。
- 开关一打开，`AscendSFABackend` 的 `get_impl_cls()` / `get_builder_cls()` 就换成 `sfa_kv_offload.py` 里那一对类，`sfa_v1.py` 保持干净；impl 顺手把预处理钉死成 `PreprocessType.NATIVE`，`sfa_prolog_v3` / mlapo 那条融合预处理被关掉 [C29]。
- 哪些层落主机由 [KV Cache Spec](kv-cache-spec.md) 的 `store_on_host` 标记决定，这个标记本身就是开关；indexer 给的是逻辑位置，要先过[块表](block-table.md)才换算成主机池里的地址。
- `keep_device_kv_cache=True` 时设备上那份主 paged KV 照常分配、只打一条 warning，不要求 D 节点，是 PD 混部下的调试形态；默认 `False` 时那两个设备张量直接是 `None` [C31]，新 token 按行 D2H 进主机池。官方文档明确写着生产别开 [S24]。

### 会报什么错

`SparseKVOffloadConfig.__init__` 在启动时按这个顺序检查（v0.26 `ascend_config.py:1056-1089`）：

| 条件 | 报错 |
|---|---|
| 模型配置里有 `compress_ratios` | `ValueError: Sparse KV offload don't support compress now.` |
| 模型配置里没有 `index_topk` | `ValueError: Sparse KV offload only support sparse attention model.` |
| PCP × DCP > 1 | `ValueError: ... don't support context parallel now.` |
| `pipeline_parallel_size > 1` | `ValueError: ... don't support pipeline parallel now.` |
| `keep_device_kv_cache=False` 且不是 `kv_consumer` | `AssertionError: Sparse KV offload is only supported in PD disaggregate scenario and can only be used in D node. ...` |
| 用 model runner v2 | `ValueError: Sparse KV offload doesn't support model_runner_v2 now.` |
| `topk_buffer_size < index_topk` | `ValueError: sparse_kv_offload_config.topk_buffer_size must be >= topk, ...` |

那条请求（Qwen3.6-35B-A3B）的 `text_config` 里是线性注意力混合结构，没有 `index_topk` [S39]，停在第二行；它又没配 `kv_transfer_config`，即使过了第二行也会停在 `AssertionError`。

其它时机的报错：

- 热缓冲区的 dtype 不是 BF16，注册 KV 缓存时直接抛异常。
- `enable_sparse_sfa_c8` 与本特性同时打开会 `NotImplementedError`，indexer 的 LI C8 不受限 [C26]。
- 折算出来的主机需求超过 `dram_size_per_dp_GB`，直接 `ValueError` 让你调大，不是悄悄降规格 [C37]。
- v0.26 上镜像里没装 Clang / OpenMP，建 manager 时现场编译那段 LRU C++ 会失败（见下文）[C33]。

### 开销和什么时候别开

**显存账**（MLA 只有一个 KV 头，K 走 `kv_lora_rank`、V 走 `qk_rope_head_dim`，主 KV 强制 BF16）[D]：

| 这一步在算什么 | 算式 | 结果 |
|---|---|---|
| 每 token 每层 | `1 × (512 + 64) × 2 B` | 1152 B |
| 每 token 全模型 | `1152 × 61` | 70,272 B ≈ 68.6 KiB |
| 128 GiB 主机预算最多装几块 | `(128 GiB − 61 × 3 × 2 MiB) ÷ (128 × 1152 × 61)` | 15,237 块 = 1,950,336 个 token 的位置 |
| NPU 上常驻多少 | `32 × 4096 × (512 + 64) × 2 B × 61` | 8.58 GiB |
| 同样长度全放 NPU 要 | `1,950,336 × 70,272 B` | 127.6 GiB |

- 减掉的那一项是主机池的对齐预留：每个落主机的 spec 按 2 MiB 对齐，一次分配先多留一个对齐块，K 和 V 各再向上取整一次，合计三个。
- 那个 `32` 是 `max_num_topk_rows = min(max_num_batched_tokens, max_num_seqs × decode_width)`，热缓冲区按它乘 `topk_buffer_size` 整块预分配，与序列实际有多长无关 [C30]。
- 显存预算翻了个面：worker 探出来的可用显存只够留在设备上的那部分（indexer 缓存），`update_available_memory_for_sparse_kv_offload` 再按「落主机的 `page_size_bytes` ÷ 留设备的 `page_size_bytes`」把主机那一份折算出来加回去，上游「可用字节 ÷ 每块字节」的分块逻辑一行不改。这一步怎么接在显存探测后面，见[显存 profiling](kv-cache-memory-profiling.md)。

**LRU 与「热缓冲区 ≥ topk」**：那段 C++ 每步把命中的槽挪到队尾、把没命中的 top-k 位置分给队首的可驱逐槽、再按「剩余可驱逐 → 新分配 → 命中」重排整条队；分配数是 `assign_count = min(miss_count, evictable_count)` [C36]。而 `evictable_count = capacity − hit_count ≥ topk − hit_count ≥ miss_count`，所以只要 `topk_buffer_size ≥ topk`，`assign_count` 恒等于 `miss_count` [D]——这就是启动期那条校验存在的理由。

**搬运量**：冷启动最坏 2048 个全部 miss，每行每层 `2048 × 1152 B = 2.25 MiB`，32 行 × 61 层 = 4.29 GiB 的 H2D [D]。稳态下相邻步 top-k 高度重叠，miss 只剩个位数到几十行 [D]。MTP / 投机场景还多一道作废：`stable_prefix_len` 之后的 token 被强制清掉，因为那段后缀可能已被下一步改写。

**主机池与 TP**：起服务时一次开到位，`offload.OffloadConfig` 的 `reserve_size` 与 `alloc_size` 都取 `dram_size_per_dp_GB`，场景 `SHARED`，`alloc_size` 只在 TP rank 0 上非零 [C32]。TP 下 decode 产出的 KV 是复制的，只有 rank 0 真分配主机池并写新 token 行，其它 rank 通过共享地址访问同一块；每步搬运前一次 `tp_group.broadcast`，保证 rank 0 的 D2H 先于其它 rank 的 H2D。LRU 跑在 host 上，图模式下由 `torch_npu.npu._launch_host_func` 挂到计算流上执行，算完的地址表交给 `offload.sparse_copy` 发 H2D [C35]。

**什么时候别开**：模型没有 indexer（上面第二道门）；不是 PD 分离的 D 节点；要开 context parallel / pipeline parallel / model runner v2；要开主 KV C8 量化；稳态 miss 依然很多（相邻步 top-k 重叠少）时，每步 H2D 会直接吃进 TPOT。

### 版本差异

v0.23 维护分支上**没有**这个特性：全仓搜 `sparse_kv_offload` 零命中，`vllm_ascend/attention/` 下没有 `sfa_kv_offload.py`，特性指南目录里也只列了另外两种卸载 [S19][!]。但 v0.23 有完整的 SFA + lightning indexer 稀疏注意力 [C20]：选中的 token 和这里一样，差别只在这些 KV 从显存取还是从主机取。

下表 main 指 2026-09-21 的源码快照 `baa023ad`，v0.26 指 `2ed6cbba`。

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `use_fused_overlap` | 没有这个键 | 默认 `false`；打开后 decode 不再「搬 miss → 再算」两步，而是一次 `npu_fused_sparse_attention_overlap`，算子直接读主机池里的全量 KV | v0.26 上配了没人接收，而且 main 的 `docs/` 里也搜不到这个词 [!] |
| LRU 那段 C++ | 模块目录下的 `sparse_kv_offload.cpp`，建 manager 时用 `torch.utils.cpp_extension.load` 现场编，编译器写死 `clang++`、开 `-fopenmp` 与 `-march=armv8.2-a+sve+fp16+bf16` | 已并进 `csrc/torch_binding.cpp`，随包编好 | v0.26 的镜像不装 Clang / OpenMP 就起不来；main 不再需要 [!] |
| MTP 的可见性闸 | 只有 `stable_prefix_len` 一道 | 多一个 `visible_seq_len` 门，还没可见的 token 不参与选中 | 投机场景下 main 挡得更严 |
| 显存预算怎么算 | worker 按主机/设备字节比折算，超 `dram_size_per_dp_GB` 直接 `ValueError` | `plan_sparse_kv_offload_memory` 在 npu / dram / workload 三个上限里取最小，dram 偏小只给一条 warning | v0.26 上 dram 给小了是起不来；main 会照样起、悄悄按主机内存降规格 [!] |
| 配置类的形态 | 普通类，校验全写在 `__init__` 里 | `@config` dataclass + `_validate_preconditions`，另外校验 `dram_size_per_dp_GB > 0` | 键名与默认值两边一致，只是报错的位置和时机不同 |

### 源码位置

| 看什么 | 在哪（v0.26 分支） |
|---|---|
| 配置类与启动校验 | `vllm_ascend/ascend_config.py`，`SparseKVOffloadConfig`（1042 起） |
| C8 互斥 | `vllm_ascend/ascend_config.py:353-367` |
| 后端换类 | `vllm_ascend/attention/sfa_v1.py:124-155` |
| 卸载版注意力 impl / builder | `vllm_ascend/attention/sfa_kv_offload.py` |
| 主机池、热缓冲区、搬运 | `vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py` |
| LRU 驻留表 | 同目录 `sparse_kv_offload.cpp`，`lru_resident_compact`（main 上在 `csrc/torch_binding.cpp`） |
| 显存折算 | `vllm_ascend/worker/worker.py:607-639` |
| indexer 选中后处理 | `vllm_ascend/device/device_op.py:473-520`，`indexer_select_post_process` |
| 官方指南 | `docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md` |
