---
id: kvpp
title: "KVPP：KV 按层分给 TP 组里各颗 NPU，算到哪层就把整层广播回来"
type: feature
summary: 有些模型的 KV Cache 在张量并行的几颗 NPU 上是每颗各存一整份一样的；KVPP 让每颗只常驻其中几层，算到哪一层就由存着它的那颗把整层发给其他颗。省下的是重复的那几份显存，代价是每层一次整层广播。
aliases: [KVPP, KV Pipeline Parallelism, KV 流水并行, KV 层并行, KV 按层并行, enable_kvpp, KVPPConfig, KVPPScheduler, KVPPPhysicalCachePlan, BroadcastKVPPTransport, LayerSplit]
chapters: ["11", "13"]
order: 60
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L1-L9
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L60-L77
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L79-L100
  - vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L76-L89
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L128-L159
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L107-L125
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L18-L44
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L162-L173
  - vllm-ascend@baa023ad:vllm_ascend/worker/kvpp_cache.py#L30-L57
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L540-L546
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kvpp.py#L22-L36
  - vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L87-L110
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2056-L2061
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2486-L2487
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1500-L1502
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L97-L104
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L154-L163
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L165-L192
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L11-L16
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/kvpp.md#L23-L52
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/kvpp.md#L54-L63
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/kvpp.html
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L333-L344
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_features.md#L9-L36
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L30-L55
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: builds-on
    note: KVPP 组就是 TP 组（开了 PCP 则是 PCP × TP），它省掉的正是 TP 切权重时顺带复制出来的那几份 KV
  - to: mla
    kind: builds-on
    note: 只有 MLA/SFA 这种每颗 NPU 一份完整 KV 的注意力才有可省的复制品，非 MLA 模型在启动校验就被挡回去
  - to: pipeline-parallel
    kind: builds-on
    note: KVPP 组不跨 PP stage，每个 stage 在自己那段层里各分各的 owner；PP 切走的是权重与计算，KVPP 只动 KV
  - to: context-parallel
    kind: builds-on
    note: 组大小按 TP × PCP 算，PCP 要 Model Runner V2；DCP 与 KVPP 互斥，同开启动就抛 ValueError
  - to: kv-cache-spec
    kind: builds-on
    note: 一层一个 bundle 的字节数直接来自 spec 的 page_size_bytes，逻辑 spec 与块编号一点没改
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 每颗 NPU 的块数由 get_num_blocks 按「自己那几层 + 2 个暂存区」重算，那一页讲的第四道工序就是它
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 同样按层处理 KV 来腾显存，那边把层搬去 CPU/池再搬回来，这边把层留在组内别的 NPU 上广播回来
contradicts: []
updated: "2026-09-25"
origin: seed
---

用张量并行（TP）把一个 MLA 模型切到 8 颗 NPU 上，权重和计算都分成了 8 份，**KV Cache 却没有跟着分**——8 颗 NPU 各存一整份，一字不差。能不能只存一份？

KVPP 的做法是：把这些层按顺序分给组里的几颗 NPU，每颗只常驻自己那几层；**算到某一层时，由存着这一层的那颗 NPU 把整层发给其他颗**。省下的是重复的那几份显存，花出去的是每层一次整层广播。

它目前只在 vllm-ascend 的 main 开发主线上有，两个发布分支（v0.23、v0.26）都没有，而且官方标的是实验特性。

```wiki-diagram
file: kvpp
```

## 为什么 KV 会有好几份一样的

[张量并行](tensor-parallel.md)切的是每一层里的大矩阵：一颗 NPU 拿一部分权重，算一部分结果，最后对一次答案。KV 能不能跟着切，要看注意力是怎么存 KV 的：

- 普通的多头注意力和 [GQA](gqa.md) 有好几个 KV 头，每个头的 KV 各管各的，可以按头分给不同 NPU——每颗存的是**不同**的头。
- [MLA](mla.md) 把整层的 K 和 V 压成一条共用的短向量来存，没有「几个头」可以分。于是 TP 组里每颗 NPU 都得各存一整份，存的是**同一份**。它的稀疏变体 SFA 也是这样。

MLA 这类模型正是 KVPP 的对象：TP 开到 8，同一份 KV 就在 8 颗 NPU 上存了 8 遍。上下文一拉长，这 8 份就是显存里最大的一笔浪费。

## 那条请求用不到它

[那条请求](one-request.md)跑的是 Qwen3.6-35B-A3B，放在一张 Atlas A3 卡的两颗 NPU 上（TP=2）。它从两条理由上都进不了 KVPP：

- **它用的是 GQA，不是 MLA。** 这个模型 40 层里只有 10 层是全注意力、要存 KV，每层有 2 个 KV 头。TP=2 时两颗 NPU 正好一颗一个头，每个 token 每层各存 1 KiB——两颗存的是不同的东西，没有复制品可省。KVPP 启动时会检查模型是不是 MLA，不是就直接报错。
- **它是混合模型。** 另外 30 层是[线性注意力](linear-attention.md)，存的不是 KV，而是一份固定大小的状态。KVPP 只接受「所有层都是同一种全注意力 KV」的模型，混合模型同样在启动时被挡回去。

想让 KVPP 起作用，得换成不混合的 MLA 类模型、TP 至少为 2，并且关掉图模式、只用 eager 方式运行。

## 借这个模型的尺寸算一笔账

真跑这个模型会被上面两条挡住，下面只是借它的尺寸当尺子：**假设**它那 10 层全注意力像 MLA 一样，在 TP 组里每颗 NPU 各存一整份，每个 token 每层 2 KiB（也就是只用一颗 NPU 时它每层实际存的量）。上下文从 237 个 token 拉到 128K（131072 个 token）：

```
不开 KVPP，每颗 NPU：131072 token × 10 层 × 2 KiB = 2.5 GiB
```

TP=8 时，这 2.5 GiB 在 8 颗 NPU 上是 8 份一样的东西。开 KVPP 后，10 层按顺序分给 8 颗：10 除以 8 得 1 余 2，所以前 2 颗各拿 2 层，后 6 颗各拿 1 层。拿得最多的那颗：

```
常驻   2 层 × 131072 token × 2 KiB = 512 MiB
暂存区 2 层 × 131072 token × 2 KiB = 512 MiB
合计                                 1 GiB   （原来 2.5 GiB）
```

同样的显存能装的 token 数变成 10 ÷ (2 + 2) = 2.5 倍。要是只有 TP=2，每颗常驻 5 层再加 2 层暂存，是 10 ÷ 7，只多装四成多。**层数越多、TP 越大，那 2 层暂存区摊得越薄，KVPP 越划算。** 官方在另一个 MLA 类模型、TP=8 上实测，一台机器能多装 6 倍多的 token。

## 谁存哪几层

**分法在启动时一次定死。** 每一段流水线（如果开了[流水线并行](pipeline-parallel.md)）把自己那段层按层号排好，按顺序均分给组里的 NPU，除不尽的余数由排在前面的几颗各多拿一层——上面 10 层分 8 颗就是这么来的。

**一层里要存的几样东西捆在一起，归同一颗 NPU。** MLA 的 KV、稀疏注意力额外要存的索引、量化用的缩放系数，都跟着这一层走，在显存里连着放。

**投机解码的草稿层不分。** 用 [MTP](speculative-decoding.md) 做投机解码时，草稿那一层的缓存每颗需要它的 NPU 都存一整份。

**每颗 NPU 实际要留的显存是三项相加：**

- 自己常驻的那几层；
- 不参与划分的草稿层缓存；
- 2 个暂存区，按最大的那一层算——一个装正在算的这一层，一个装提前取来的下一层。

正因为有这 2 个暂存区，上面 10 层分 8 颗省下的不是 8 倍，而是 2.5 倍。

**调度器那一侧什么都没变。** 调度器看到的 KV 块、块表、块的编号，和不开 KVPP 时一模一样；只是每颗 NPU 按「自己那几层 + 2 个暂存区」重新算了一次能放多少个块。所以[前缀缓存](prefix-caching.md)和 [KV 块分配](vllm-kv-block-allocation.md)都不知道 KVPP 的存在。这也是它和 DCP 最根本的区别——DCP 是真的把每颗 NPU 在调度器眼里的 KV 规格改小了。

## 算到某一层时怎么取回来

搬的是数据，不是计算：每颗 NPU 照常算完整的一层，只是这一层的 KV 不在自己手里时，要先等别人发过来。

1. **先照常算 Q、K、V 的投影。** 这段计算是唯一能用来盖住广播的时间。
2. **投影算完、第一次读写 KV 之前，等这一层到位。** 存着这一层的那颗 NPU 把整层发给组里其他颗，收到的放进暂存区；它自己一直用常驻的那份。
3. **一等到，就立刻给下一层发广播**，然后算这一层的注意力。广播走单独的一条通道，永远提前一层；第一层的广播在整次前向一开始就发出。

**全新的 prefill 不用广播。** 这一步里所有请求都还没有任何已算好的 KV（全是第一次算）时，整趟跳过广播；启动时试跑、测显存的那几步也一样。

## 代价就在「整层」两个字上

广播的是**这一层全部已分配的 KV 块**，不管这一步真正用到的是哪几条请求、哪几块。能装的 token 涨几倍，每层要搬的字节就涨几倍。

所以单看速度，它是变慢的：官方不接外部 KV 池时的实测，128K 输入的首 token 时间单机多了约 3%、两台机器接流水线并行多了约 11%，prefill 吞吐降了 2% 到 13%。它换来的是容量，不是速度。

它真正划算的场景是「好几个长前缀 + 外部 KV 池」：显存里能留住更多前缀，前缀命中率从 8% 多涨到 45% 左右，吞吐多了四成多。不过官方注明，这组数所用的那部分 KV 传输代码还不在这次提交里。

## 和另外几种「切 KV / 切层」的区别

名字和思路都像，切的东西各不相同：

| 手段 | 切的是什么 | 切的单位 | 要用时怎么办 | 代价 |
|---|---|---|---|---|
| **KVPP** | KV | 层（TP 组内按顺序均分） | 存它的那颗 NPU 把整层广播回来 | 每层一次整层广播，按已分配的块数算 |
| [流水线并行（PP）](pipeline-parallel.md) | 权重 + 计算 | 一段层（跨一组 NPU） | 不用取，隐藏向量往下一段传 | 段与段接力，要多步同时在跑才填得满空档 |
| [DCP](context-parallel.md) | KV | token（TP 组内交错分） | 各颗算自己那段，注意力结果再合并 | 每层一次跨 NPU 合并，调度器眼里的 KV 规格变小 |
| [按层卸载](kv-cache-layerwise-offload.md) | KV | 层（搬去 CPU 内存或外部池） | 按层搬回显存 | 占主机内存或网络带宽，不是 NPU 之间的带宽 |
| [KV Pool](kv-pool.md) | KV | 整块（外部存储） | 命中的前缀整块搬回 | 外部存储 + 网络，命中才有收益 |
| [Layer Sharding](../params/layer-sharding.md) | 权重 | 层（TP 组内轮流） | 提前一层广播回来 | 机制和 KVPP 几乎一样，对象换成权重 |

一句话分辨：**PP 换的是 NPU 数，DCP 换的是每颗 NPU 在调度器眼里的 KV 规格，KVPP 两样都不换，只换 KV 实际放在哪颗 NPU 上。** KVPP 和 KV Pool 也不是二选一——官方那组吞吐多四成的数字，正是两个一起开测出来的。

## 常见误解

- **「KVPP 是流水线并行的一种，所以要加 NPU」**——名字里的「流水」说的是 KV 的存放和搬运。模型计算的 TP、EP、PP 配置一点不变，NPU 数也不变。组不跨流水线的段、不跨 DP 副本。
- **「它能让一颗 NPU 装下更长的上下文」**——它省的只是 TP 组里重复的那几份。TP=1 时根本没有重复，也就一个字节都省不下。
- **「GQA 模型开大 TP 也有复制品，也能用」**——像 Qwen3.6-35B-A3B 这样只有 2 个 KV 头的模型，TP 开到 4 或 8 时 KV 头不够分，确实也会复制；但 KVPP 目前只认 MLA 类模型，别的一律在启动时报错。
- **「开了就更快」**——官方自己的实测是变慢的，它换来的是容量。
- **「广播只搬这一步真正要用的块」**——搬的是这一层全部已分配的块，不按请求挑。所以「能装的 token 涨几倍」和「每层搬的字节涨几倍」是同一件事的两面。

## 对照源码

### 怎么开

只有一个开关，组大小不用配：

```bash
vllm serve <非 hybrid 的 MLA/SFA 模型> \
    --tensor-parallel-size 8 \
    --enforce-eager \
    --additional-config '{"enable_kvpp": true}'
```

- `enable_kvpp` 默认 `false`；打开后 `KVPPConfig.size = tensor_parallel_size × prefill_context_parallel_size`，没有单独的 kvpp size 参数，广播粒度也不可调 [C3][S17]。TP=1 且 PCP=1 时 `size` 就是 1，等于没开。
- 只有 `kvpp_size > 1` 才建 `kvpp` 通信组，且断言 `kvpp_size == global_pcp_size * global_tp_size`；组按 DP 副本和 PP stage 各建各的 [C5]。
- 参数的静态定义见 [`kvpp_config`](../params/kvpp-config-0445bd352140.md)；`vllm_ascend/core/kv_cache_placement.py` 是它的消费方，从 `KVPPConfig.from_vllm_config` 拿 `size` 来切层。
- 层分配：`map_kvpp_layers_to_owners` 先按层号排序、剔除 MTP 层，再 `base, remainder = divmod(len(layer_indices), kvpp_size)`，`partition_size = base + int(owner_rank < remainder)` [C6]。上半的 10 层 / 8 颗即 `divmod(10, 8) = (1, 2)` [D]。MTP 层由 `find_mtp_layers` 找出（层号 ∈ `[num_hidden_layers, num_hidden_layers + num_nextn_predict_layers)`），不进 owner 映射，每颗 NPU 全量保留 [C7]。
- 物理预算：`KVPPPhysicalCachePlan.get_num_blocks` 里 `bytes_per_block = persistent_bytes + KVPP_SCRATCH_BUFFER_COUNT * scratch_bytes`，`KVPP_SCRATCH_BUFFER_COUNT = 2`（「一个给当前层、一个给下一层预取」），`scratch_bytes` 取所有有 owner 的层里最大的 bundle [C8]。worker 算出块数后再乘回逻辑每块字节报给上游 planner，逻辑 spec、块编号、块表不变 [C11]。
- 取回：`schedule_forward` 在有历史时立即给第 0 层发预取；`wait_for_layer` 等上一次 future 返回后立刻给下一层 `start_layer_prefetch`，预取跑在单独的 `torch.npu.Stream` 和 `ThreadPoolExecutor(max_workers=1)` 上 [C13]。传输本身是 `dist.broadcast(..., async_op=True)` 后紧跟 `work.wait()`，再 `done.synchronize()`——异步来自那个线程，不是来自 `async_op` [C12]。等待点在 MLA 注意力的 q / kv 投影之后、第一次读写 cache 之前 [C14]；全部请求 `num_computed_tokens` 为 0 时 `has_history` 为假、整趟跳过 [C15]。

### 会报什么错

`KVPPConfig.validate()` 在启动期抛 `ValueError` 的全部情形 [C4]：

- `decode_context_parallel_size != 1`（DCP 与 KVPP 互斥）；
- 有 `kv_transfer_config` 且连接器既不是 `AscendStoreConnector` 也不是 `MooncakeConnectorV2`；
- `MooncakeConnectorV2` 的 `kv_role == "kv_consumer"` 一侧也开了；
- 没给 `--enforce-eager`；
- `not model_config.use_mla or model_config.is_hybrid`——Qwen3.6-35B-A3B 两个条件都命中：不是 MLA（`num_key_value_heads: 2`、`head_dim: 256` 的 GQA），且 `full_attention_interval: 4` 使 40 层里 30 层为线性注意力（混合模型）[S27]；
- 投机解码方法不是 `mtp`，或 MTP 步数不固定。

还有一条不在 `validate` 里：`create_kvpp_cache_allocation_plan` 要求所有 spec 都是 `FullAttentionSpec` 且 `block_size` 统一，否则抛 `"KVPP requires one full-attention cache group with a common block size."` [C9]。

**三份官方文档对「能和谁组合」的说法互相矛盾** [!]：

- 用户指南的支持表写着 PCP（需 Model Runner V2）、memcache 池化、`MooncakeConnectorV2` 的 PD 分离都支持 [S17]；
- 设计文档 §3 的 "Not supported" 一行把 PCP 和 disaggregated prefill/decode 都列了进去 [S22]；
- `additional_config.md` 写的是 "does not support DCP or KV transfer connectors" [S24]。

**以代码为准：用户指南是对的。** 组大小公式里明摆着乘了 `prefill_context_parallel_size`，通信组初始化处断言 `kvpp_size == global_pcp_size * global_tp_size`，而 `validate` 只拦 DCP 和「不是这两个连接器」。

### 开销和什么时候别开

- **容量账（上半的尺子）** [D]：假设每颗 NPU 每 token 每层存 2 KiB（Qwen3.6-35B-A3B 在 TP=1 时的全注意力 KV：`2 × 2 个 KV 头 × 256 × 2 B`，见[那条请求](one-request.md)），10 层、131072 token：不开 `131072 × 10 × 2 KiB = 2.5 GiB`；TP=8 开 KVPP，最满的 NPU `(2 + 2) × 131072 × 2 KiB = 1 GiB`，倍数 `10 / (2 + 2) = 2.5`；TP=2 时 `divmod(10, 2) = (5, 0)`，倍数 `10 / (5 + 2) ≈ 1.43`。这把尺子是假设 [A]——真实的 Qwen3.6-35B-A3B 在 TP=2 时每颗 1 KiB、存的是不同的 KV 头，且会被 `validate` 挡住。
- **官方容量实测**：GLM-5.2 + TP8 上，同一显存能装的 token 单机 **6.25 倍**、双机 PP 5.35 倍 [S18]；层数、每层大小、MTP 配置都与上面的尺子不同，量级对得上。
- **官方性能实测（非池化）**：128K 输入的 TTFT 单机 +3.36%、双机 PP +11.01%，prefill 吞吐 −2.30% 到 −12.77% [S19]。原因是广播的是这一层全部已分配的逻辑块，不按活跃请求或活跃块过滤 [S22]。
- **池化场景**：多个长前缀 + memcache 池时，命中率 8.46% → 45.46%，吞吐 +46.65%；但这组数是在另一份构建（`493ec2b`）上测的，官方注明那部分 KV 传输集成**不在本次提交里** [!][S20]。
- **什么时候别开**：TP=1 且 PCP=1（没有复制品）；非 MLA 或混合模型（启动即报错）；对 TTFT / prefill 吞吐敏感、而显存并不紧张的场景。

### 版本差异

- **只在 main 上有。** 在 v0.23 维护分支（`2c59ff10`）与 v0.26 分支（2026-09-17 源码快照 `2ed6cbba`）上，`git grep -i kvpp -- vllm_ascend docs/source` 一条都不返回；main（`baa023ad`）上命中 22 个文件 [D]。它是 2026-09-11 随 PR [#16094](https://github.com/vllm-project/vllm-ascend/pull/16094) 进来的，两个发布分支都没有回合。
- **实验特性。** `baa023ad` 的支持矩阵新增了 KVPP，标为 **Experimental**，范围限定在 eager 模式下的非 hybrid MLA/SFA 模型 [S25]；用户指南标题也带着同一标记 [S1]。接口和功能仍可能变化，部署组合应逐项核对，不能把「代码接受配置」当成性能与稳定性保证。

### 源码位置

| 做什么 | 位置 |
|---|---|
| 开关与组大小、启动校验 | `vllm_ascend/ascend_config.py`，`KVPPConfig.from_vllm_config` / `validate` |
| 建 `kvpp` 通信组 | `vllm_ascend/distributed/parallel_state.py` |
| 层 → owner、MTP 层剔除、暂存区预算、分配计划 | `vllm_ascend/core/kv_cache_placement.py`：`map_kvpp_layers_to_owners`、`find_mtp_layers`、`KVPPPhysicalCachePlan.get_num_blocks`、`create_kvpp_cache_allocation_plan` |
| 按 bundle 分配物理 cache，非本 rank 的层轮流落进 2 个暂存区 | `vllm_ascend/worker/kvpp_cache.py`，`allocate_kvpp_cache` |
| 块数乘回逻辑字节报给上游 | `vllm_ascend/worker/worker.py` |
| 广播本身 | `vllm_ascend/distributed/kvpp.py`，`prefetch` |
| 提前一层的调度 | `vllm_ascend/worker/v2/kvpp.py`，`schedule_forward` / `start_layer_prefetch` / `wait_for_layer` |
| 注意力里的等待点 | `vllm_ascend/attention/mla_v1.py` |
| 有无历史的判定 | `vllm_ascend/worker/model_runner_v1.py` |
| 只在 `size > 1` 时跑 `validate` | `vllm_ascend/platform.py` |
| 官方文档 | 用户指南 [S1][S17][S18][S19][S20]、设计文档 [S22]、`additional_config.md` [S24]、支持矩阵 [S25] |
