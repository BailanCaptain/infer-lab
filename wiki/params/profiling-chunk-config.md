---
id: profiling-chunk-config
title: 动态切块配置（profiling_chunk_config）
type: param
summary: >-
  Ascend 中称为 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，减少 PP 流水线因各块耗时不均产生的等待。默认关闭，要求 PP>1
  且与负载均衡调度互斥；官方定位是 PD 分离里 P 节点的长序列优化。
aliases:
  - profiling chunk
  - 动态 chunk 大小
  - ProfilingChunkConfig
  - smooth_factor
  - CPP
  - Dynamic Chunked Pipeline Parallel
chapters:
  - '12'
  - '13'
sources:
  - >-
    raw:sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md#L1-L130
  - >-
    raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1261-L1298'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L573-L598'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1420-L1461'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L390-L405'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L723-L760'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L55-L93'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/profiling_chunk_predictor.py#L281-L315'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L104-L120'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L301-L360'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1261-L1269'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L7-L22
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L219
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L229-L267
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L269-L297
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L299-L304
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L7-L38
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L54-L63
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L65-L83
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L85-L95
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L143-L164
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L24-L46
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L146-L153
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L110-L139
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L721-L743'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L667-L671'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L954-L977'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L83-L118'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L66-L75'
  - >-
    raw:sha256-cc187fba1f4d4c4aea94da34eef1879956528a2f84844f0ed4d0f78a3b6c0735.md#L1-L644
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L47-L210
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_profiling_chunk.py#L45-L205
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_profiling_chunk.py#L45-L205
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1959-L1968'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1808-L1817'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/profiling_chunk_predictor.py#L38-L77'
  - 'vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L108-L200'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/scheduler_profiling_chunk.py#L109-L201'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L127-L219'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L718-L743'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1492-L1517'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1640-L1684'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/model_runner.py#L485-L553'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L964-L1033'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L221-L248'
  - 'vllm@84030bbe:vllm/v1/executor/multiproc_executor.py#L375-L442'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/profiling_chunk_predictor.py#L165-L224'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/profiling_chunk_predictor.py#L434-L465'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1067-L1076'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1377-L1387'
  - 'vllm-ascend@7d825229:vllm_ascend/core/scheduler_profiling_chunk.py#L1257-L1270'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2541-L2543'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2484-L2488'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1026'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L261-L285
  - 'vllm-ascend@7d825229:vllm_ascend/core/profiling_chunk_predictor.py#L166-L466'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
evidence: S
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它是 additional_config 下的一个嵌套 dict，顶层写法从 v0.26 起被降级成弃用告警的那套解析规则就在那一页
  - to: vllm-scheduler
    kind: builds-on
    note: 开了之后上游那套 num_new_tokens 预算算完还要再被预测值截一刀，换的正是调度器这一层
  - to: async-scheduling
    kind: conflicts-with
    note: >-
      固定 main 选择同步 ProfilingChunkScheduler，与 ShortRequestFirst 同开时明确拒绝异步；rc2 新增异步变体，但要求 MRV2，不能套用旧版限制。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: seed
rawSources:
  - >-
    raw/sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md
  - >-
    raw/sha256-97036a751a53ec73b150cfe2e084f68fbedd2c16d3093768a93d1f28c1f7bf3a.md
  - >-
    raw/sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md
  - >-
    raw/sha256-cc187fba1f4d4c4aea94da34eef1879956528a2f84844f0ed4d0f78a3b6c0735.md
---

## 一句话

**v0.30.0rc2 对照。** 默认仍为 enabled=false、smooth_factor=1.0、min_chunk=4096、max_fit_chunk=30；未指定 need_timing 时跟随 enabled，关闭功能时也会把计时关闭。推荐入口已放在 additional_config.scheduler_config.profiling_chunk_config；旧顶层入口仍读但告警，两处都给时嵌套值优先。PP>1、chunked prefill 和不能与 balance scheduling 同开等前提仍需满足；MRV2 已接入执行计时，并支持对应的异步调度器。max_fit_chunk 的硬校验是大于 5，30 是默认值。固定 GLM 双机的 PP=1 结论保持不变。

`profiling_chunk_config` 打开的是上游叫 **CPP（Dynamic Chunked Pipeline Parallel）** 的东西：启动时真跑几十次 forward，量出「这台机器上一段长 `l` 的 prefill 要多久」，运行时按这条曲线反解出每一步该切多少 token，好让流水线各级的每块耗时尽量相等。默认 `enabled: False`（见下面事实表）。

**它不是通用调优项。** 官方把它定位成 PD 分离部署里 **P（Prefiller）节点**上的长序列优化，D 节点不用配 [S13]；硬条件是 `pipeline_parallel_size > 1`、开着 chunked prefill、且不能与 balance scheduling 同开。

**GLM 双机这套部署用不上它，而且开了起不来。** 这套部署的四个并行维度是 TP8 / DP2 / EP16、**PP = 1**（45 层全在同一张卡的执行序列里，见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)），所以只要把 `enabled` 打开，启动校验就会直接抛 `ValueError`，三个版本的报错文案一字不差：

```text
profiling_chunk_config requires pipeline parallelism (pp > 1).
Please set --pipeline-parallel-size to a value greater than 1,
or disable profiling_chunk_config.
```

上面按源码里拼接前的三段字符串断行，实际日志里是一行。出处：v0.23 维护分支 [C8]、v0.26 分支 [C29]、main [C4]；GLM 实际跑的那个含 GLM 代码的提交（db701c1f）里也是同一条校验 [C30]。官方两机教程的启动命令里也没有传这个配置，所以本页讲的是「它在别的部署形态里怎么用」，不是 GLM 主线上的一步。

**v0.23、v0.26、固定main与rc2均有此功能，配置入口和运行路径有变化。** 从v0.26起推荐写进additional_config.scheduler_config，旧顶层仍读但告警，同时提供时嵌套优先；main与rc2沿用。v0.23、v0.26的旧校验相同，main及rc2会在关闭功能时强制关闭need_timing；ShortRequestFirst与MRV2调度适配另按对应版本判断。完整入口见[动态切块](../concepts/dynamic-chunked-pp.md)。

```wiki-diagram
file: profiling-chunk-config
```

## 事实表

下表三列各依据对应分支的配置源码：v0.23 维护分支 [C7]、v0.26 分支 [C26]、main 开发主线 [C3]。

官方指南同时写了平滑系数必须大于 0 和“0.0 关闭动态调整”，但表中三个固定分支的配置校验都拒绝 0。因此，不能用 `smooth_factor=0.0` 关闭这些实现的动态调整；指南这一项与代码约束有冲突。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置路径 | 只有顶层 `additional_config.profiling_chunk_config` | 推荐写进 `additional_config.scheduler_config`，顶层仍认但打弃用告警 | 同 v0.26 | 照老文档抄的命令在 v0.26 与 main 上还能跑，日志里会多一行 deprecated |
| `enabled` 默认 | `False` | 同左 | 同左 | 不显式打开，下面这一整套都不跑 |
| `enabled=False` 却写 `need_timing=True` | `_validate` 没有这条修正，值保持 `True` | 同左 | 告警后强制改回 `False`，rc2保留 | 旧两版会保留不必要的执行计时，设备同步代价需计入 |
| `smooth_factor` | `(0, 1]`，默认 1.0 | 同左 | 同左 | 1.0 = 完全信预测；官方建议开着在线校准时别动它，关了校准再调到 0.5–0.8 [S14] |
| `min_chunk` | `> 0`，默认 4096 | 同左 | 同左 | 比 `max_num_batched_tokens` 大时被钳到后者，只有一条 warning |
| `max_fit_chunk` | `<= 5` 报错，默认 30 | 同左 | 同左 | 报错文案说「建议至少 30 个点」，硬阈值却是 6；设计文档说拟合用 5–30 个点，所以 6–29 能过并不是 bug |
| PP > 1 要求 | 开启且 `pp <= 1` 直接 `ValueError` | 同左 | 同左 | **三版都有**，不是只有新版本才校验；PP = 1 的部署（含 GLM 双机）开了就起不来 |
| 与 balance scheduling | 同开 `ValueError`；还能用 `VLLM_ASCEND_BALANCE_SCHEDULING` 环境变量打开对方 | 同左 | 同开 `ValueError`；环境变量兜底已删 | 二选一，没有自动降级；v0.26 上残留一个 `=1` 照样能把服务顶掉 |
| 与 ShortRequestFirst | v0.23 没有这个调度器 | 同开**直接** `ValueError` | 可以同开，但必须关掉异步调度 | 只在 v0.26 上是硬互斥；见下面第 8 条 |
| 实现形式 | 普通类，`__init__` 里 `get` 完再 `float()` / `int()`，最后 `_validate()` | 同左 | pydantic `@config` dataclass，检查挪进 `mode="after"` 的 validator | main 会按字段类型转换可转换的输入，无法转换或超出范围的值报错；不是所有字符串都非法 |

## 为什么存在

**问题出在 PP + chunked prefill 上。** 一条长请求独占固定 token 预算时，普通分块会得到等长块；多请求共享预算时，块长也会变化。对稠密因果注意力，只计查询与历史位置组合的理想计算量，等长块越靠后，需要处理的组合越多。设计文档用块 1 花 T1、块 2 花 T2 > T1 的示意说明：块耗时不均会让流水线后段等待，形成气泡。真实耗时还取决于算子、通信和调度，KDA 或稀疏注意力也不能直接套用这一增长关系 [S18]。

CPP 的办法是**反过来**：让块大小随前缀长度变化，尽量让各块耗时接近，减少由耗时不均带来的等待。流水线开始时的填充、结束时的排空，以及不同阶段的负载差异仍然存在，不能由“块耗时相等”推出全部气泡消失。

怎么知道多大的块花多久？**先量，再算。**

- **启动期**：尝试采集从 `base_chunk_size` 逐步减小的 64 个样本，前面另有一次不入拟合的预热；每次调用真实 forward 量延迟，再用最小二乘拟合 `f(l) = a·l² + b·l + c`。无有效返回或调用失败的点会跳过，至少收集 8 个点才拟合。PP 模式下各 Worker 都执行；用哪个 rank 的返回取决于执行器的 RPC 接口，不能统一说只取第一级。
- **运行期**：初始目标耗时设为 `f(base_chunk_size) − f(0)`；逐条请求求根时，T 取本批剩余时间预算，L 是该请求已算过的前缀长度。启动模型解 `a·x² + (2aL + b)·x − T = 0` 的正根，再经过下面的取整与截断。在线零历史样本还会更新目标耗时，这可以发生在历史模型拟合成功之前 [C9]。

这个实现把 **PP > 1** 设为准入条件，因为它针对多阶段流水线的等待问题。单阶段是否能从其他动态切块策略受益，不能由本配置的限制推断。

`base_chunk_size` 来自调度器的 `max_num_scheduled_tokens`，`page_size` 来自 KV cache 的 `block_size` [C10]。所以**官方反复强调 `--max-num-batched-tokens` 敏感**——它就是这条曲线的原点和目标耗时的定义处。上游给的经验是先用固定块调出最优值，再把它放大到 2–4 倍来开动态块。

### 算出来之后还要过三道手

`predict` 拿到正根 `x` 之后不直接用：

```text
smoothed   = base_chunk_size + smooth_factor * (x - base_chunk_size)
chunk_size = max(int(smoothed), min_chunk)
align      = max(page_size, 64)
chunk_size = ceil(chunk_size / align) * align
```

`smooth_factor` 是在「基准块」和「本次预测」之间做线性插值，**不是**拿上一次的 chunk 做平滑。系数越小越靠近基准，等于 1 时平滑值就是原始预测 [D]。

举个能拿计算器复核的例子：基准 8192、原始预测 3000、系数 0.5、`min_chunk=4096`、`page_size=128`。平滑值 `8192 + 0.5 × (3000 − 8192) = 5596`，下限处理后仍是 5596，向上对齐到 128 的倍数得 **5632** [D]。这是公式示例，不是性能实测。

**这里有个文档与代码对不上的地方**：设计文档写的是 "Round down to multiple of `page_size`" [S20]，代码里却是 `((chunk_size + align - 1) // align) * align`，向**上**取整 [!]。按代码算才对得上。

预测有效时，调度器用 `num_new_tokens = min(predicted_chunk, num_new_tokens)` 截断本次已算出的预算，所以这次截断只会减小它。预测器尚未准备好时直接跳过动态分支；进入分支后，二次项系数为 0、判别式为负或根非正等情况会返回 None。此时若仍在校准，或本批剩余时间预算还等于初始目标，就保留原预算；若已退出校准且本批时间预算已被前面请求消耗，则停止这一轮相应请求队列的继续装入。不能把所有预测失败都理解为照旧追加请求。

### 在线校准默认随功能打开，满足条件后自动停止

need_timing 不显式设时跟随 enabled，所以打开动态切块时也默认打开在线计时。计时结果会回传给预测器，用真实批次重新拟合带历史长度的模型。固定 main 的单请求公式是 `f(C, H) = a·C(C+H) + b·(C+H) + c`，C 为本块 token 数，H 为已有前缀长度；批次特征按各请求求和，默认在样本数为 5～30 时每收到一个点重新做最小二乘拟合。

rc2 改成 `f(C, H) = a·C(C+H) + b·C + c`，线性项不再加上历史长度，并改用非负最小二乘。其批次特征为各请求 C(C+H) 之和、C 之和及请求数；不能把旧版系数直接搬入新版。启动模型仍是前文的一元二次式，在线历史模型拟合成功后才切换预测路径。

要这一层的原因很实在：启动期只覆盖到 `max_num_batched_tokens` 那么长的序列，而真实请求往往长得多，曲线外推会偏。

三个旧固定分支都会在两项条件同时满足后，通知 Worker 关闭在线计时：已经记录 3 次总历史长度为 0 的有效批次，用来更新目标时延；历史拟合样本数已经超过 max_fit_chunk，设置完成标记。默认上限 30 时，样本数到 31 才标记历史收集结束，下一次检查到两项都满足时发出停止信号；不是拟合成功一次就结束。这个标记表示采样流程结束，也不保证拟合误差已经达到某个精度指标。显式把 need_timing 设为 False 跳过在线校准，不取消启动测量；启动拟合成功后便使用启动模型。

官方警告未完成在线校准可能导致严重性能劣化，也说明关闭校准的性能可能次优；这些是使用建议，不是每个工作负载的性能保证。建议用 ais_bench 造定长随机数据集、batch_size=1，并让数据各不相同以免被前缀缓存命中；数据长度应覆盖计划服务的 max-model-len。

### 收益有多少

官方给了 P 节点上的实测（Atlas A3 64 GB，定长请求、并发 1）[S16]：

| 模型 | 输入长度 | CPP 动态块 | PP 固定块 |
|---|---|---|---|
| DeepSeek-V3.1-W8A8 | 128k | TTFT 22.5s | TTFT 27.0s |
| Qwen3-235B | 256k | TTFT 53.5s | TTFT 61.4s |

变长请求、并发 4、前缀命中率 99% 的那组里，CPP2TP8 的输入吞吐是 22424 tps/卡，DP2TP8 是 16150、TP16 是 18875。输入为 4k～64k、均值和标准差均为 32k。三个旧分支文档重复刊载这三项数值，不代表分别在每个分支重新测试过。

**这是官方的数，不是这套部署的数。** 上面两组都来自上游文档，测的是 Atlas A3 64 GB 上 PD 分离的 P 节点、DeepSeek-V3.1 与 Qwen3-235B；GLM 双机是 A2、PP = 1、这个开关关着，两边的硬件、模型和部署形态都不同，不能把上表的 TTFT 或吞吐当成「在我们这套部署上开它能省多少」。本页除这两组官方数以外的数字，全是配置默认值和公式示例。

这个配置调整的是每一步送入模型的 token 数，并不改权重或采样参数。不过批次形状和计算分组随之变化，不能据此保证浮点结果或最终生成文本逐项相同；输出一致性仍应在目标模型和执行后端上验证。

## 开了的代价

**1. PP 是硬门槛，PD 的 P 节点是官方推荐场景。** PP≤1 会直接报错；官方当前指南把它定位在 PD 分离的 P 节点。两者不能合并成“源码只准 PD 分离”：旧版指南也提供了普通 serve 与离线 LLM 的开启示例。其他服务形态的效果和完整兼容性仍要分别验证。

**2. 与balance scheduling互斥。** 同开报ValueError，只能关闭其中一个。v0.23、v0.26还读取VLLM_ASCEND_BALANCE_SCHEDULING，环境残留1也会触发冲突；固定main和rc2已移除这个环境兜底，仍须核最终配置值。

**3. 启动增加一轮真实 forward 测量。** 正常收集 64 个有效样本前另有一次预热；官方把开销概括为约 64 次 forward、几十秒，实际耗时随模型和设备变化。测量复用 dummy_run，设计文档称没有额外运行期显存开销；这不能证明测量峰值为零，也不能保证改变切块后的执行峰值不变。

**它和显存试跑测的不是同一个量。** 启动时的显存 profile run 据峰值计算 KV cache 预算；GLM 双机[每卡 3,855 块](../concepts/kv-cache-memory-profiling.md#放到-glm-双机一张卡的预算怎样扣)是权重取 21 GiB 等假设下的教学预算，[每块 640 个 token](../concepts/glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)另见唯一出处。CPP 这轮 forward 测量的是延迟，用来拟合切块模型。上述固定指南没有给出这轮测量的显存峰值；这里也没有目标 NPU 实测。

**4. 校准期计时边界会同步设备。** 在完整执行到计时开始和结束的路径上，两端各同步一次；完成校准后通过调度输出通知 Worker 停止。显式关闭在线计时可以省掉这些同步，但预测只依赖启动模型，需比较真实负载的 TTFT 和吞吐。未完成校准就投产还可能一直承担同步和不准确外推的代价。

**5. `min_chunk` 可能被悄悄改小。** `max_num_batched_tokens` 小于 `min_chunk`（默认 4096）时，这一分支只打 warning 就把 `min_chunk` 钳到 `max_num_batched_tokens`。排查切块行为不对时先翻启动日志。

**6. `max_fit_chunk` 的文案和阈值对不上。** 填 6 能过校验，报错文案却说建议至少 30。设计文档说在线校准攒 5–30 个点，所以 6 并不是非法值，只是拟合点少、曲线更容易偏——别把「不报错」读成「达到了建议值」[D]。

**7. 调参顺序不能反。** 官方要求先调 `--max-num-batched-tokens` 再调 `smooth_factor`；开着在线校准时建议根本别动 `smooth_factor`，只有关了校准才把它调到 0.5–0.8 当替代。

**8. 与 ShortRequestFirst 的关系只在 v0.26 上是「不许同开」。** v0.26 分支里，`short_request_first_config.enabled` 为真时只要发现 `profiling_chunk_config.enabled` 也为真，就无条件抛 `ValueError`，让你关掉一个 [C27]。main 换了做法：两者可以同开，`ProfilingChunkScheduler` 会自己把短请求优先的等待队列装上去，但多了一条**必须同步调度**的限制——同开还开着 async scheduling 时才报错 [C28]。v0.23 上没有这个调度器，谈不上冲突。所以从 v0.26 升到 main，这一处是从「硬互斥」放宽成「可以同开但别用异步调度」。

**9. 仍缺目标负载上的比较。** 上述固定指南没有给出不同 smooth_factor 的 TTFT 对照或短序列负载的完整比较。源码的校准结束条件已在前文列明；满足这些条件不等于目标负载已经达到最佳性能。

平滑系数零值的指南与代码差异见来源 14 和 7、26、3。计时停止及跨进程通知见来源 32–37、48–49、53–54；启动采样与失败退出见来源 38–40。来源 45–47 还说明：固定 main 的 Worker 都返回本地计时；若执行器支持 unique_reply_rank，则选择 world_size−TP×PCP 的 rank 返回，否则列表结果取首项。设计文档“只用第一级”不能覆盖这两种接口路径。rc2 的 MRV2 异步准入、调度器选择和类组合见来源 50–52；其计时起止与结果附着见来源 44 和 37，历史模型变化见来源 57。v0.26 的配置优先级见来源 55，重复刊载的性能数据见来源 16、25、56。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 有（8 个文件） |
| releases/v0.23.0 | 有（5 个文件） |
| releases/v0.26.0rc | 有（5 个文件） |
| releases/v0.30.0rc2 | 有（9 个文件） |

- **引入**：2026-04-17 · bec63146cf1442542940d4c2ce9f7eee8ab9845c · PR [#7896](https://github.com/vllm-project/vllm-ascend/pull/7896) —— [Feature][PP] Support Dynamic Chunk for Chunked Pipeline Parallelism (#7896)
  包含该提交的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ascend_config.py` +68 / −4（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +48 / −4（文本行变化）
  - `vllm_ascend/core/profiling_chunk_predictor.py` +379 / −0（文本行变化）
  - `vllm_ascend/core/scheduler_profiling_chunk.py` +723 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +28 / −0（文本行变化）

当前含该标识符的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2
