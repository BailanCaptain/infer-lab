---
id: kvpp
title: "KVPP：KV 按层分给 TP 组里各张卡，算到哪层就把整层广播回来"
type: feature
summary: MLA/SFA 的 KV 在 TP 组内本来是每卡一份复制品；KVPP 把层连续均分给组里各 rank，算到某层时由 owner 把整层广播给其他卡。省的是复制的份数，花的是每层一次全量广播。
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
verified: ["main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: builds-on
    note: KVPP 组就是 TP 组（开了 PCP 则是 PCP × TP），它省掉的正是 TP 切权重时顺带复制出来的那几份 KV
  - to: mla
    kind: builds-on
    note: 只有 MLA/SFA 这种每卡一份完整 KV 的注意力才有可省的复制品，非 MLA 模型在启动校验就被挡回去
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
    note: 每卡块数由 get_num_blocks 按「自己那几层 + 2 个暂存区」重算，那一页讲的第四道工序就是它
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 同样按层处理 KV 来腾 HBM，那边把层搬去 CPU/池再搬回来，这边把层留在组内别的卡上广播回来
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

MLA/SFA 模型的 KV 在一个 TP 组里是**每卡一份完整复制品**——TP 切的是权重和计算，KV 没跟着切。KVPP 把这些层连续均分给组内各 rank，每卡只常驻自己那几层；**算到第 i 层时，由这一层的 owner 把整层广播给组里其他卡** [S1]。省的是复制的份数，花的是每层一次全量广播。

这个特性**只在 main 开发主线上有**。在 v0.23 维护分支（`2c59ff10`）与 v0.26 分支（2026-09-17 源码快照 `2ed6cbba`）上，`git grep -i kvpp -- vllm_ascend docs/source` 一条都不返回；main（`baa023ad`）上命中 22 个文件 [D]。它是 2026-09-11 随 PR [#16094](https://github.com/vllm-project/vllm-ascend/pull/16094) 进来的，两个发布分支都没有回合。

```wiki-diagram
file: kvpp
```

## 那条请求用不到它

[那条请求](one-request.md)是 Qwen3-0.6B、单卡、37 + 200 = 237 个 token。两条各自独立的理由让它连门都进不去：

- **单卡。** 组大小是 `tensor_parallel_size × prefill_context_parallel_size` 算出来的，TP=1、PCP=1 就是 1 [C3]；只有 `size > 1` 才会建 `kvpp` 通信组、才会跑校验。一张卡上根本没有第二份复制品可省。
- **不是 MLA。** Qwen3-0.6B 走 GQA，校验里那句 `if not model_config.use_mla or model_config.is_hybrid` 直接抛 `ValueError` [C4]。

要走到这里，设定得换成非 hybrid 的 MLA/SFA 模型、TP ≥ 2、并加上 `--enforce-eager`。

**借那条请求的单位算一笔账。** 下面把 Qwen3-0.6B 的 28 层、每 token 每层 4 KiB 当计量单位借过来——真跑这个模型会被上面第二条挡住，这里只是拿一个读者熟悉的尺子量量级 [A]。上下文从 237 个 token 拉到 128K：

```
131072 token × 112 KiB/token = 14 680 064 KiB = 14 GiB   （每卡，不开 KVPP）
```

TP=8 时这 14 GiB 在八张卡上是八份一模一样的东西。开 KVPP 后，28 层按 `divmod(28, 8) = (3, 4)` 切：rank 0–3 各拿 4 层，rank 4–7 各拿 3 层 [C6]。拿得最多的那张卡：

```
常驻   4 层 × 131072 token × 4 KiB = 2 GiB
暂存区 2 × 1 层 × 131072 × 4 KiB   = 1 GiB
合计                                 3 GiB   （14 GiB 的 3/14）
```

反过来看，同一份显存预算能装的 token 数变成 `28 / (4 + 2) ≈ 4.7` 倍 [D]。官方在 GLM-5.2 + TP8 上实测的是 **6.25 倍**（单机）与 5.35 倍（双机 PP）[S18]——模型层数、每层大小、MTP 配置都不同，量级对得上。

## 它省的是复制的份数，不是 KV 本身

**谁拿哪几层，是启动时按层号一次算死的。** 每个 PP stage 把自己那段层排序后连续均分，`partition_size = base + int(owner_rank < remainder)`——前 `remainder` 个 rank 各多拿一层 [C6]。一层的 main KV、indexer KV 和量化分量捆成一个 bundle，同属一个 owner，物理上连续摆放。MTP 的 cache 不参与划分，每张需要它的卡各留一份完整的 [C7]。

**每卡的物理开销因此是三项相加**，`KVPP_SCRATCH_BUFFER_COUNT` 是写死的 `2`——一个给当前层，一个给下一层的预取 [C8]：

```
每块物理字节 = 自己那几层的 bundle + 本地 MTP cache + 2 × 最大的那一层 bundle
可用块数     = floor(可用 KV 显存 / 每块物理字节)
```

这两个暂存区就是为什么 28 层切成 8 份省的不是 8 倍而是 28/6 倍。层数越多、TP 越大，这个常数项摊得越薄。

**逻辑那一侧一个字没改。** 调度器看到的 spec、块编号、块表全是上游那一套；worker 算出块数之后，再乘回「逻辑上每块多少字节」报给上游的 planner [C11]。所以 [prefix caching](prefix-caching.md) 和 [block 分配](vllm-kv-block-allocation.md) 都不知道 KVPP 存在——这也是它和 DCP 最根本的分别，后者是真把逻辑 spec 除小了。

## 取的时候搬的是数据，不是计算

搬运发生在每一层的注意力算子里，等待点卡在 **q / kv 投影之后、第一次读写 cache 之前**——让投影那段计算去盖住广播 [C14]。收到的一层落进两个暂存区之一，owner 自己则一直用常驻那份。

三件值得记住的实现细节：

- **永远提前一层。** `wait_for_layer` 一返回就立刻给第 i+1 层发下一次广播，走单独的 transfer stream 和一个单线程的 `ThreadPoolExecutor`；第 0 层的预取在前向开始时统一发出 [C13]。
- **传输本身是同步等的。** `dist.broadcast(..., async_op=True)` 之后紧跟 `work.wait()`，再 `done.synchronize()` 确保设备侧真的搬完才让等待方继续——异步性来自那个线程，不是来自 `async_op` [C12]。
- **没有历史就不广播。** 这一步里所有请求的 `num_computed_tokens` 都是 0（全新 prefill）时整趟跳过；dummy run 和显存探测同理 [C15]。

**代价就在「整层」两个字上。** 广播的是这一层全部已分配的逻辑块，不按活跃请求或活跃块过滤——容量涨几倍，每层要搬的字节就涨几倍。官方自己的非池化实测因此是负的：128K 输入的 TTFT 单机 +3.36%、双机 PP +11.01%，prefill 吞吐 −2.30% 到 −12.77% [S19]。它真正赢的场景是「多个长前缀 + memcache 池」：更多前缀留在 HBM，命中率从 8.46% 升到 45.46%，吞吐 +46.65%——但这组数是在另一份构建（`493ec2b`）上测的，官方注明那部分 KV 传输集成**不在本次提交里** [!][S20]。

## 和另外四种「切 KV / 切层」的区别

名字和思路都像，切的东西各不相同：

| 手段 | 切的是什么 | 切的单位 | 要用时怎么办 | 代价 |
|---|---|---|---|---|
| **KVPP** | KV | 层（TP 组内连续均分） | owner 把整层广播回来 | 每层一次全量广播，按已分配块数计 |
| [PP](pipeline-parallel.md) | 权重 + 计算 | 层段（跨卡组） | 不用取，hidden 往下一段传 | 段间串行，要多步在途才填得满气泡 |
| [DCP](context-parallel.md) | KV | token（TP 组内交错） | 各卡算自己那段，注意力结果再归约 | 每层一次跨卡归约，逻辑 spec 被除小 |
| [Layerwise offload](kv-cache-layerwise-offload.md) | KV | 层（搬去 CPU / 池） | 按层搬回 HBM | 主存或网络带宽，不是卡间带宽 |
| [KV Pool](kv-pool.md) | KV | 整块（外部存储） | 命中的前缀整块搬回 | 外部存储 + 网络，命中才有收益 |
| [Layer Sharding](../params/layer-sharding.md) | 权重 | 层（TP 组内轮转） | 提前一层广播回来 | 机制和 KVPP 几乎一样，对象换成权重 |

一句话分辨：**PP 换的是卡数，DCP 换的是每卡的逻辑 spec，KVPP 两样都不换，只换物理落盘的位置。** 而 KVPP 和 KV Pool 不是二选一——官方那组 +46% 的数字正是两个一起开测出来的。

## 开它的前提，以及官方文档三处互相打架

只有一个开关，组大小不用配：

```bash
vllm serve <非 hybrid 的 MLA/SFA 模型> \
    --tensor-parallel-size 8 \
    --enforce-eager \
    --additional-config '{"enable_kvpp": true}'
```

`enable_kvpp` 默认 `false`，组大小由 TP × PCP 算出，没有单独的 kvpp size 参数，广播粒度也不可调 [S17]。`--enforce-eager` 不是建议是硬校验。TP=1 且 PCP=1 时 `size` 就是 1，等于没开。参数的静态定义见 [`kvpp_config`](../params/kvpp-config-0445bd352140.md)——`vllm_ascend/core/kv_cache_placement.py` 是它的消费方，从 `KVPPConfig.from_vllm_config` 拿 `size` 来切层。

`validate()` 会在启动期抛 `ValueError` 的全部情形 [C4]：DCP 不为 1；连接器既不是 `AscendStoreConnector` 也不是 `MooncakeConnectorV2`；`MooncakeConnectorV2` 的 `kv_consumer` 那一侧也开了；没给 `--enforce-eager`；模型不是 MLA 或是 hybrid；投机解码方法不是 `mtp`，或 MTP 步数不固定。还有一条不在 `validate` 里：cache 必须是单一 full-attention 组且 `block_size` 统一，否则建分配计划时抛 [C9]。

**三份官方文档对「能和谁组合」的说法互相矛盾** [!]：

- 用户指南的支持表写着 PCP（需 Model Runner V2）、memcache 池化、`MooncakeConnectorV2` 的 PD 分离都支持 [S17]；
- 设计文档 §3 的 "Not supported" 一行把 PCP 和 disaggregated prefill/decode 都列了进去 [S22]；
- `additional_config.md` 写的是 "does not support DCP or KV transfer connectors" [S24]。

**以代码为准：用户指南是对的。** 组大小公式里明摆着乘了 `prefill_context_parallel_size`，通信组初始化处断言 `kvpp_size == global_pcp_size * global_tp_size` [C5]，而 `validate` 只拦 DCP 和「不是这两个连接器」。

**这个快照已明确标成实验特性。** `baa023ad` 的支持矩阵新增了 KVPP，并标为 **Experimental**，范围限定在 eager 模式下的非 hybrid MLA/SFA 模型 [S25]；用户指南标题也带着同一标记 [S1]。这意味着接口和功能仍可能变化，部署组合应逐项核对，不能把「代码接受配置」当成性能与稳定性保证。

## 常见误解

- **「KVPP 是 PP 的一种，所以要加卡」**——名字里的 pipeline 指的是 KV 的存放与搬运，模型计算的 TP/EP/PP 配置一点不变，卡数也不变。组不跨 PP stage、不跨 DP 副本，每个 stage 在自己那段层里各分各的。
- **「它能让单卡装下更长的上下文」**——它省的只是 TP 组内复制出来的那几份。TP=1、PCP=1 时 `size` 是 1，通信组根本不会建，一个字节都省不下。
- **「开了就更快」**——官方自己的非池化实测是慢的：TTFT 最多 +11%，prefill 吞吐 −2.3% 到 −12.8% [S19]。它换来的是容量，不是延迟。
- **「广播只搬这一步真正要用的那些块」**——搬的是这一层全部已分配的逻辑块，不按请求过滤 [S22]。所以「容量涨 6 倍」和「每层搬的字节涨 6 倍」是同一件事的两面。
