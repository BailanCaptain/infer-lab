---
id: profiling-chunk-config
title: 动态切块配置（profiling_chunk_config）
type: param
summary: >-
  上游叫 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，把 PP 流水线的气泡抹平。默认关闭，要求 PP>1
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
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1440-L1461'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L390-L405'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L723-L760'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L55-L93'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/core/profiling_chunk_predictor.py#L288-L315
  - >-
    vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L104-L120
  - >-
    vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L339-L351
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
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L110-L130
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L721-L743'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L667-L671'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L969-L973'
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: S
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它是 additional_config 下的一个嵌套 dict，顶层写法从 v0.26 起被降级成弃用告警的那套解析规则就在那一页
  - to: vllm-scheduler
    kind: builds-on
    note: 开了之后上游那套 num_new_tokens 预算算完还要再被预测值截一刀，换的正是调度器这一层
contradicts: []
updated: "2026-09-22"
origin: seed
rawSources:
  - >-
    raw/sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md
  - >-
    raw/sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md
---

## 一句话

`profiling_chunk_config` 打开的是上游叫 **CPP（Dynamic Chunked Pipeline Parallel）** 的东西：启动时真跑几十次 forward，量出「这台机器上一段长 `l` 的 prefill 要多久」，运行时按这条曲线反解出每一步该切多少 token，好让流水线各级的每块耗时尽量相等。默认 `enabled: False` [C3]。

**它不是通用调优项。** 官方把它定位成 PD 分离部署里 **P（Prefiller）节点**上的长序列优化，D 节点不用配 [S13]；硬条件是 `pipeline_parallel_size > 1`、开着 chunked prefill、且不能与 balance scheduling 同开。[那条请求](../concepts/one-request.md)是单卡 Qwen3-0.6B、37 个 token 的问题——**连 PP > 1 这条门槛都够不到，也根本切不出第二块**，这一页对它完全用不上。

**三个版本上都有这个参数**，差别不在能力。**配置写在哪**从 v0.26 分支（2026-09-17 的源码快照）起变了：要写进 `additional_config.scheduler_config`，顶层写法还认但会打弃用告警，两边都写以嵌套的为准，main 沿用这一套——这段写法上的账在[动态切块配置的机制页](../concepts/dynamic-chunked-pp.md)，这页不重抄。参数本身的默认值与校验，v0.26 与 v0.23 逐条相同 [C26]；两处真分叉都只在 main 上：`enabled=False` 却显式写 `need_timing=True` 时 main 告警并强制改回 `False`，以及下面第 8 条那个与 ShortRequestFirst 的关系 [!]。

```wiki-diagram
file: profiling-chunk-config
```

## 事实表

下表三列各依据对应分支的配置源码：v0.23 维护分支 [C7]、v0.26 分支 [C26]、main 开发主线 [C3]。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置路径 | 只有顶层 `additional_config.profiling_chunk_config` | 推荐写进 `additional_config.scheduler_config`，顶层仍认但打弃用告警 | 同 v0.26 | 照老文档抄的命令在 v0.26 与 main 上还能跑，日志里会多一行 deprecated |
| `enabled` 默认 | `False` | 同左 | 同左 | 不显式打开，下面这一整套都不跑 |
| `enabled=False` 却写 `need_timing=True` | `_validate` 没有这条修正，值保持 `True` | 同左 | 告警后强制改回 `False` | 只有 main 修了；v0.23 与 v0.26 上这样写等于白白每步同步一次设备 |
| `smooth_factor` | `(0, 1]`，默认 1.0 | 同左 | 同左 | 1.0 = 完全信预测；官方建议开着在线校准时别动它，关了校准再调到 0.5–0.8 [S14] |
| `min_chunk` | `> 0`，默认 4096 | 同左 | 同左 | 比 `max_num_batched_tokens` 大时被钳到后者，只有一条 warning |
| `max_fit_chunk` | `<= 5` 报错，默认 30 | 同左 | 同左 | 报错文案说「建议至少 30 个点」，硬阈值却是 6；设计文档说拟合用 5–30 个点，所以 6–29 能过并不是 bug |
| PP > 1 要求 | 开启且 `pp <= 1` 直接 `ValueError` | 同左 | 同左 | **三版都有**——旧版本页写「v0.23 材料未覆盖」是错的 [!] |
| 与 balance scheduling | 同开 `ValueError`；还能用 `VLLM_ASCEND_BALANCE_SCHEDULING` 环境变量打开对方 | 同左 | 同开 `ValueError`；环境变量兜底已删 | 二选一，没有自动降级；v0.26 上残留一个 `=1` 照样能把服务顶掉 |
| 与 ShortRequestFirst | v0.23 没有这个调度器 | 同开**直接** `ValueError` | 可以同开，但必须关掉异步调度 | 只在 v0.26 上是硬互斥；见下面第 8 条 |
| 实现形式 | 普通类，`__init__` 里 `get` 完再 `float()` / `int()`，最后 `_validate()` | 同左 | pydantic `@config` dataclass，检查挪进 `mode="after"` 的 validator | main 上类型写错会在构造配置时就被拦下 |

## 为什么存在

**问题出在 PP + chunked prefill 上。** 长序列被切成固定大小的块依次穿过流水线，可注意力是 O(n²) 的——同样大的块，前缀越长算得越慢。设计文档把这件事画得很直白：块 1 花 T1、块 2 花 T2 > T1、块 3 更久，这个时间差在各级之间层层放大，就成了流水线气泡 [S18]。

CPP 的办法是**反过来**：块可以不一样大，只要每块耗时一样，气泡就没了。

怎么知道多大的块花多久？**先量，再算。**

- **启动期**：从 `base_chunk_size` 往下均匀采 64 个 chunk size，每个都真跑一次 forward 量延迟，再用最小二乘拟合 `f(l) = a·l² + b·l + c` [S19]。PP 模式下所有 worker 都跑，但只有第一级 PP rank 的计时结果拿去做调度决策。
- **运行期**：设已算过的前缀长 `L`、目标耗时 `T = f(base_chunk_size) − f(0)`，解 `a·x² + (2aL + b)·x − T = 0` 的正根，就是这一步该切的 token 数 [C9]。

这也是为什么它**必须 PP > 1**：单级流水线没有气泡可消，量一遍曲线纯属白花几十秒。

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

最后一刀在调度器里：`num_new_tokens = min(predicted_chunk, num_new_tokens)` [C11]。**它只会把这一步切小，不会切大**；预测返回 `None`（判别式为负、根非正、或模型还没拟合出来）时这一步就不截，退回上游原本的 budget。

### 在线校准是默认开的，而且不做会更慢

`need_timing` 不显式设时跟随 `enabled`，也就是**默认开**。开着的时候 model runner 每步同步设备量执行时间，喂回去做增量重拟合；用的是把前缀长度也算进去的两变量模型 `f(C, H) = a·C(C+H) + b·(C+H) + c`，攒够 5–30 个点就用最小二乘更新一次参数 [S21]。

要这一层的原因很实在：启动期只覆盖到 `max_num_batched_tokens` 那么长的序列，而真实请求往往长得多，曲线外推会偏。

官方在这件事上的措辞很硬：在线校准默认开着，**必须按标准流程走完，否则会出现严重的性能劣化**；不想要的话可以直接把 `need_timing` 设成 `False`，但结果会是次优的 [S15]。校准做法也写了——用 ais_bench 造定长随机数据集、`batch_size=1`、数据各不相同以免被前缀缓存命中。

### 收益有多少

官方给了 P 节点上的实测（Atlas A3 64 GB，定长请求、并发 1）[S16]：

| 模型 | 输入长度 | CPP 动态块 | PP 固定块 |
|---|---|---|---|
| DeepSeek-V3.1-W8A8 | 128k | TTFT 22.5s | TTFT 27.0s |
| Qwen3-235B | 256k | TTFT 53.5s | TTFT 61.4s |

变长请求、并发 4、前缀命中率 99% 的那组里，CPP2TP8 的输入吞吐是 22424 tps/卡，DP2TP8 是 16150、TP16 是 18875。三个分支的文档给的是同一组数 [S25]，所以这组数不区分版本。

开关本身不改模型输出：它只决定每一步喂进去多少 token，采样与数值路径都不动 [D]。

## 开了的代价

**1. 部署形态被锁死。** `pipeline_parallel_size > 1` 是硬门槛，`pp <= 1` 时直接 `ValueError`，三个分支都一样 [C4]。加上官方明确说它是给 PD 分离的 P 节点用的，实际能用上的是「PD 分离 + P 节点开 PP」这一种形态。

**2. 与 balance scheduling 硬互斥。** 同开报 `ValueError`，只能关掉一个。注意 v0.23 **与 v0.26** 上 balance scheduling 都还有 `VLLM_ASCEND_BALANCE_SCHEDULING` 这个环境变量入口——环境里残留一个 `=1`，就够让开了 CPP 的服务起不来；只有 main 把这个环境兜底删了。

**3. 启动多付约 64 次 forward，几十秒。** 官方自己列在 Constraints 里 [S17]。profiling 复用现成的 dummy_run 机制，所以**运行期不额外占显存** [S24]——多付的是启动时间，不是内存。

**4. 校准期每步同步设备。** `need_timing` 默认跟随 `enabled`，为了量时间每步都要同步一次。可以显式写 `"need_timing": false` 躲掉，但官方说那样结果次优。**更要紧的是反过来那一面**：开着校准却没按标准流程走完，官方警告会出现严重性能劣化——这个参数没有「开了不管」的用法。

**5. `min_chunk` 可能被悄悄改小。** `max_num_batched_tokens` 小于 `min_chunk`（默认 4096）时，这一分支只打 warning 就把 `min_chunk` 钳到 `max_num_batched_tokens`。排查切块行为不对时先翻启动日志。

**6. `max_fit_chunk` 的文案和阈值对不上。** 填 6 能过校验，报错文案却说建议至少 30。设计文档说在线校准攒 5–30 个点，所以 6 并不是非法值，只是拟合点少、曲线更容易偏——别把「不报错」读成「达到了建议值」[D]。

**7. 调参顺序不能反。** 官方要求先调 `--max-num-batched-tokens` 再调 `smooth_factor`；开着在线校准时建议根本别动 `smooth_factor`，只有关了校准才把它调到 0.5–0.8 当替代。

**8. 与 ShortRequestFirst 的关系只在 v0.26 上是「不许同开」。** v0.26 分支里，`short_request_first_config.enabled` 为真时只要发现 `profiling_chunk_config.enabled` 也为真，就无条件抛 `ValueError`，让你关掉一个 [C27]。main 换了做法：两者可以同开，`ProfilingChunkScheduler` 会自己把短请求优先的等待队列装上去，但多了一条**必须同步调度**的限制——同开还开着 async scheduling 时才报错 [C28]。v0.23 上没有这个调度器，谈不上冲突。所以从 v0.26 升到 main，这一处是从「硬互斥」放宽成「可以同开但别用异步调度」。

**9. 还没有依据的部分。** 这一页没有回答：不同 `smooth_factor` 对 TTFT 的量化影响、在线校准「按标准流程走完」的判定标准是什么、以及短序列为主的负载上开了会不会反而变慢——官方文档只给了长序列的数 [I]。

## 已废弃的说法

### 2026-09-17 · 修订 0dd1cfc402eaaba8

旧说法（历史记录，已废弃）：

```text
材料没有解释这个系数的语义
```

替代结论：

```text
main 配置默认 1.0，参与下文的线性插值；维护分支的运行公式尚未核对
```

废弃依据（来源是否支持结论仍须人审）：

- `raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339`

旧说法（历史记录，已废弃）：

```text
- `smooth_factor` 的语义；
```

替代结论：

```text
`smooth_factor` 的配置默认值是 **1.0**。
```

废弃依据（来源是否支持结论仍须人审）：

- `raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339`

旧文的来源编号（仅解释上方历史原文）：

1. `raw:sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md#L1-L130`

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 有（5 个文件） |
| releases/v0.21.0rc | 有（5 个文件） |
| releases/v0.22.1rc | 有（5 个文件） |
| releases/v0.23.0 | 有（5 个文件） |
| releases/v0.24.0rc | 有（5 个文件） |
| releases/v0.25.1rc | 有（5 个文件） |
| releases/v0.26.0rc | 有（5 个文件） |
| releases/v0.27.1rc | 有（7 个文件） |
| releases/v0.28.0rc | 有（8 个文件） |
| main | 有（8 个文件） |

- **引入**：2026-04-17 · bec63146cf1442542940d4c2ce9f7eee8ab9845c · PR [#7896](https://github.com/vllm-project/vllm-ascend/pull/7896) —— [Feature][PP] Support Dynamic Chunk for Chunked Pipeline Parallelism (#7896)
  包含该提交的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +68 / −4（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +48 / −4（文本行变化）
  - `vllm_ascend/core/profiling_chunk_predictor.py` +379 / −0（文本行变化）
  - `vllm_ascend/core/scheduler_profiling_chunk.py` +723 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +28 / −0（文本行变化）

当前含该标识符的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2
