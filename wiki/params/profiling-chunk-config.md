---
id: profiling-chunk-config
title: 动态切块配置（profiling_chunk_config）
type: param
summary: >-
  动态切块配置（CPP）：启动期实测 prefill 延迟曲线，运行时按前缀长度反解每步 token 切块大小以缓解 PP 流水等待。默认关闭，要求
  PP>1 且互斥 balance scheduling，v0.30.0 仍支持，main 已于 PR #21310 移除。
aliases:
  - profiling chunk
  - 动态 chunk 大小
  - ProfilingChunkConfig
  - smooth_factor
  - CPP
  - Dynamic Chunked Pipeline Parallel
  - scheduler_config.profiling_chunk_config
  - additional_config.profiling_chunk_config
  - min_chunk
  - max_fit_chunk
legacyAnchors:
  一句话: 它解决什么问题，适用范围与版本状态是什么？
  为什么存在: 先量再算：启动拟合、公式平滑与在线校准
  在线校准默认随功能打开满足条件后自动停止: 在线校准怎么启动、切换与停止？
  收益有多少: 官方基准数字、代价与排障边界
  开了的代价: 官方基准数字、代价与排障边界
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L711-L737'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1478-L1514'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1629-L1680'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1386-L1397'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1972-L2030'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1438-L1487'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它是 additional_config 下的一个嵌套 dict，v0.26–v0.30.0 推荐放进 scheduler_config、顶层写法打弃用告警，main 已移除并交由 extra="forbid" 校验
  - to: vllm-scheduler
    kind: builds-on
    note: 开了之后上游那套 num_new_tokens 预算算完还要再被预测值截一刀，换的正是调度器这一层
  - to: async-scheduling
    kind: conflicts-with
    note: >-
      v0.30.0 新增 ProfilingChunkAsyncScheduler 但硬性要求 V2 model runner（VLLM_USE_V2_MODEL_RUNNER=1）；早期 v1 路径不支持异步调度，main 已移除整套特性。
contradicts: []
updated: 2026-11-19T00:00:00.000Z
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

## 它解决什么问题，适用范围与版本状态是什么？

长序列分块预填充时，**越往后累计的历史越长，单块注意力就越慢——`profiling_chunk_config` 的直觉就是给后面的步少切一点 token，让每块耗时尽量齐平。** 这套机制在上游称为 **CPP（Dynamic Chunked Pipeline Parallel）**，启动期会实测几十次真实 forward 来拟合 prefill 延迟曲线。运行期再按当前请求已有前缀长度反解本步切块大小，从而压低 [PP（流水线并行）](../concepts/pipeline-parallel.md)因各块快慢不均产生的等待气泡（完整原理见[动态切块](../concepts/dynamic-chunked-pp.md)）。

**定位、硬前提与版本现状**：默认关闭（`enabled: false`），官方定位为 [PD 分离](../concepts/pd-disaggregation.md)部署中 **P（Prefiller）节点**的长序列优化（D 节点无需配置；旧版指南另有普通 serve 与离线 LLM 示例，其他形态须单独验证）。

- **硬性前提**：必须满足 `pipeline_parallel_size > 1` 且开启 chunked prefill；不能与 `enable_balance_scheduling`（及 `v0.30.0` 的 `dyntra_lb_config`）同开。
- **推荐入口（`v0.26.0rc`–`v0.30.0`）**：写在 `additional_config.scheduler_config.profiling_chunk_config`（见 [AscendConfig](../concepts/ascend-config-system.md)）。旧顶层 `additional_config.profiling_chunk_config` 仍兼容但打弃用告警，两处同写时嵌套优先。
- **`main`（`8d6180e2`）已整体移除**：整套 CPP 功能与配置已随 PR [#21310](https://github.com/vllm-project/vllm-ascend/pull/21310) 删除，升级 `main` 须删此键（普通进程按未知键拒收，仅顶层未知键在装有 `vllm_omni` 时告警过滤）。
- **`v0.30.0` 调度器与 Runner 配套注意**：配套 `vllm` 在未显式指定时会自动启用异步调度（`async_scheduling=True`），而 `v0.30.0` 的异步 CPP 强制要求 Model Runner V2。因此配置示例须显式加 `--no-async-scheduling` 走同步调度，或显式开启并验证 `VLLM_USE_V2_MODEL_RUNNER=1`（以下展示配置形式，本工作区无 NPU 实机执行验证）：

```bash
vllm serve Qwen/Qwen3-30B-A3B \
  --tensor-parallel-size 4 \
  --pipeline-parallel-size 2 \
  --no-async-scheduling \
  --max-num-batched-tokens 16384 \
  --additional-config '{"scheduler_config": {"profiling_chunk_config": {"enabled": true}}}'
```

## 事实表

在 `v0.30.0` 启用 CPP 动态切块或面向 `main` 升级清理前，逐项核对下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 推荐入口与 `enabled` | `additional_config["scheduler_config"]["profiling_chunk_config"]`（默认 `enabled: False`） | `v0.23` 仅顶层；`v0.26`–`v0.30.0` 推荐嵌套（顶层打弃用告警）；**`main` 已整体移除** |
| `need_timing` 联动 | 省略时跟随 `enabled`；`enabled=False` 却写 `need_timing=True` 时告警并改回 `False` | `v0.23` 与 `v0.26` 无此纠正，会白留计时与设备同步开销 |
| `smooth_factor` | `(0, 1]`，默认 `1.0` | 官方旧文档虽提过 `0.0`，但源码校验一律拒绝 `0`；开在线校准时别动，关校准后再调 `0.5–0.8` |
| `min_chunk` | `> 0`，默认 `4096` | 大于 `max_num_batched_tokens` 时仅打 warning 并静默钳小到后者 |
| `max_fit_chunk` | 硬阈值 `> 5`（`<= 5` 报错），默认 `30` | 报错文案建议至少 `30` 个点，但填 `6–29` 也能过校验，需注意样本过少导致曲线偏斜 |
| PP 与负载均衡硬互斥 | `pp <= 1`、`enable_balance_scheduling` 或 `dyntra_lb_config.enabled` 同开均抛 `ValueError` | `v0.23`/`v0.26` 还会受残留环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING=1` 触发互斥 |
| `ShortRequestFirst` 与异步调度 | `v0.30.0` 允许同开 `ShortRequestFirst`；配异步调度硬性要求 `VLLM_USE_V2_MODEL_RUNNER=1` | 上游默认常自动选中异步调度，MRv1 下须传 `--no-async-scheduling`，否则启动抛 `ValueError` |

**`PP > 1` 准入边界**：任何 `pipeline_parallel_size == 1` 的单级流水部署开启 `enabled: true` 时，`v0.23`、`v0.26` 与 `v0.30.0` 都会在启动校验直接抛 `ValueError`。历史双机 `PP = 1` 部署的参数边界统一见 [固定双机的参数边界](../concepts/glm-5-3-flash-two-node.md#固定双机的参数边界)。

```wiki-diagram
file: profiling-chunk-config
```

## 先量再算：启动拟合、公式平滑与在线校准

一条长请求独占固定 token 预算时，普通 chunked prefill 会切出等长块（多请求共享预算时块长也会变化）。对稠密因果注意力而言，理想计算量随已累计历史长度增长，等长块越往后耗时越长（设计文档以块 1 花 `T1`、块 2 花 `T2 > T1` 说明），导致流水线后段反复等待产生气泡。

真实耗时还受算子、通信与调度影响，KDA 或稀疏注意力不能直接套用这一二次增长假设。CPP 的思路是按前缀长度动态缩小后续块，让各块耗时逼近一致——它能缓解耗时不均带来的等待，但流水线启动填充、结束排空及阶段间负载差异依然存在，不会消灭所有气泡。该实现把 `PP > 1` 设为准入条件以针对多阶段流水等待，单阶段能否从其他动态切块策略受益不能由此推断。

工作流程分**启动测量**与**运行求根**两步：

- **启动期**：1 次不入拟合的预热后，从 `base_chunk_size` 逐步递减尝试采 64 个样本，每次跑真实 forward（复用 `dummy_run`）量延迟并跳过无效或失败点。至少收集 8 个有效点后，用最小二乘拟合启动模型 $f(l) = a \cdot l^2 + b \cdot l + c$。PP 模式下各 Worker 都会执行并返回本地计时；选用哪个 rank 取决于执行器接口——支持 `unique_reply_rank` 时取 `world_size - TP × PCP`，否则取列表首项，不能简化为「只取第一级」。
- **运行期**：初始目标耗时取 `f(base_chunk_size) - f(0)`（在线零历史样本也可在历史模型拟合成功前更新该目标耗时）。`base_chunk_size` 来自调度器 `max_num_scheduled_tokens`，`page_size` 来自 KV cache 的 `block_size`，因此 `--max-num-batched-tokens` 决定了曲线原点与目标耗时。上游经验是先用固定块调出最优值，再放大到 2–4 倍开动态块。逐条请求求根时，记本批剩余时间预算为 `T`、已算前缀长度为 `L`，启动模型解 $a \cdot x^2 + (2aL + b) \cdot x - T = 0$ 的正根 `x`。

拿到正根 `x` 后，还要经过三步后处理（平滑是在**基准块与本次预测**之间线性插值，而不是拿上一次 chunk 做平滑；`smooth_factor=1.0` 直接使用原始预测）：

```text
smoothed   = base_chunk_size + smooth_factor * (x - base_chunk_size)
chunk_size = max(int(smoothed), min_chunk)
align      = max(page_size, 64)
chunk_size = ceil(chunk_size / align) * align
```

公式复核示例（非性能实测）：取 `base_chunk_size = 8192`、原始预测 `x = 3000`、`smooth_factor = 0.5`、`min_chunk = 4096`、`page_size = 128`。先得平滑值 $8192 + 0.5 \times (3000 - 8192) = 5596$，过下限仍为 `5596`，向上对齐到 `128` 的倍数得 **5632**。注意一处文档与源码分歧：设计文档写向下取整（"Round down to multiple of `page_size`"），源码实际却是向上取整 `((chunk_size + align - 1) // align) * align`，应以代码为准。

调度器拿到有效预测后以 `num_new_tokens = min(predicted_chunk, num_new_tokens)` 截断已算出的 token 预算（只收窄、不放大）。预测器未就绪时跳过动态分支；进入分支后若二次项系数为 0、判别式为负或根非正会返回 `None`——此时若仍在校准或本批剩余时间预算仍等于初始目标，保留原预算；若已退出校准且预算已被前面请求消耗，则停止本轮该请求队列的继续装入。

### 在线校准怎么启动、切换与停止？

启动期只能测到 `max_num_batched_tokens` 长度，长序列外推会偏差，因此默认开启在线校准（省略 `need_timing` 时跟随 `enabled`）。计时结果回传预测器后，用真实批次重拟合带历史长度的模型，拟合成功后再从启动模型切换过来：

- **早期公式（`v0.23` / `v0.26` / 早期 `baa023ad`）**：单请求形式为 $f(C, H) = a \cdot C(C+H) + b \cdot (C+H) + c$（`C` 为本块 token 数，`H` 为已有前缀长度）。默认在 5–30 个样本间每增一点就重做一次最小二乘拟合。
- **`v0.30.0` 公式（`c09d3e20`，始于 `rc2`）**：改为 $f(C, H) = a \cdot C(C+H) + b \cdot C + c$，线性项不再加历史长度，改用非负最小二乘（批次特征为各请求 `C(C+H)` 之和、`C` 之和与请求数）。旧版拟合系数不可直接搬入新版，且 MRV2 已接入执行计时。

在线计时在**两项条件同时满足**后由调度器通知 Worker 自动关闭：

1. 已记录 **3 次**总历史长度为 0 的有效批次（用于更新目标时延）；
2. 历史拟合样本数**严格超过** `max_fit_chunk`（默认 30 时要到第 31 个样本才设完成标记，下一次检查双条件满足时发停止信号，既不是拟合成功一次就停，也不保证拟合误差达到特定精度）。

显式设 `need_timing: false` 只跳过在线校准、不取消启动测量。官方指南指出，未完成在线校准就投产会引发显著性能劣化，关闭在线校准也会使长序列切块落入次优外推。投产前建议用 `ais_bench` 生成定长随机不重复数据集（`batch_size=1`、覆盖目标 `max-model-len` 且避免命中前缀缓存）完成校准。

## 官方基准数字、代价与排障边界

官方指南给出了 PD 分离 P 节点（Atlas A3 64 GB，定长请求、并发 1）的实测对照。注意这是上游在 Atlas A3、`PP > 1`、DeepSeek-V3.1 / Qwen3-235B 上的官方数，不是本站 GLM 双机 A2 / `PP = 1` 上的数（三个旧分支文档重复刊载这组数值，也不代表分别在每个分支重测过）：

| 模型 | 输入长度 | CPP 动态块 | PP 固定块 |
| --- | --- | --- | --- |
| DeepSeek-V3.1-W8A8 | 128k | TTFT 22.5s | TTFT 27.0s |
| Qwen3-235B | 256k | TTFT 53.5s | TTFT 61.4s |

在变长请求（4k–64k、均值与标准差均为 32k）、并发 4、前缀命中率 99% 的一组测试中，官方报告 CPP2TP8 输入吞吐为 22,424 tps/卡。同组对照下，DP2TP8 为 16,150 tps/卡，TP16 为 18,875 tps/卡。

调整每步送入模型的 token 数不改权重与采样参数，但批次形状与计算分组变化后不保证浮点结果或生成文本逐项一致，仍须在目标模型和后端上验证。主要代价与排查点如下：

- **启动延迟测量开销（不要与显存 profile run 混淆）**：启动阶段额外跑 1 次预热加约 64 次真实 forward，官方概括为几十秒（随模型与设备变化）。它复用 `dummy_run` 测量延迟以拟合切块模型；启动期的显存 profile run 则是按峰值计算 KV cache 预算（GLM 双机[每卡 3,855 块](../concepts/kv-cache-memory-profiling.md#放到-glm-双机一张卡的预算怎样扣)与[每块 640 token](../concepts/glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)见各自唯一出处）。设计文档称无额外运行期显存开销，但不能据此证明测量峰值或改切块后的执行峰值绝对不变。
- **校准期设备同步**：在线计时开启期间，完整执行路径在计时起止两端各做一次设备同步；未完成校准就投产会持续承担同步与不准确外推的代价；显式设 `need_timing: false` 可省同步但只依赖启动模型，需对比真实负载 TTFT 与吞吐。
- **容易踩空的调参与校验细节**：一是 `max_num_batched_tokens < min_chunk` 时仅打一条 warning 就把 `min_chunk` 钳小；二是 `max_fit_chunk` 硬阈值是 `> 5`（写 6 不报错），但拟合点少曲线更易偏。三是调参顺序须先调 `--max-num-batched-tokens` 再调 `smooth_factor`，开在线校准时别动 `smooth_factor`。目前仍缺不同 `smooth_factor` 的 TTFT 对照及短序列负载完整比较，校准完成标记不等于目标负载已达最优。
- **跨调度器与版本演进**：`v0.26` 上与 `ShortRequestFirst` 硬互斥（直接 `ValueError`）。`v0.30.0` 放宽为允许同开并新增 `ProfilingChunkAsyncScheduler`，但 `async_scheduling` 强制要求 V2 model runner，且新增与 `dyntra_lb_config` 的硬互斥。`main` 已于 PR #21310 整体删除本配置与调度器，升级须移除该键。

## 对照源码

下表汇总 `profiling_chunk_config` 在四个基线版本的入口、拟合模型与互斥变化，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 配置入口与存在性 | 仅顶层 `additional_config.profiling_chunk_config` [C7] | 推荐 `scheduler_config.profiling_chunk_config`，顶层弃用告警 [C26] | 同 `v0.26`（嵌套优先）[C60] | **已整体移除**（PR #21310），普通进程拒收、`vllm_omni` 告警过滤 [C63] | 升级 `main` 必须删键 [!] |
| `enabled=False` 且 `need_timing=True` | 保留 `True` | 保留 `True` | 告警并强制改回 `False` [C59] | — | 旧版会多出无谓计时同步 |
| 在线历史拟合模型 | `a·C(C+H) + b·(C+H) + c` | 同 `v0.23` | `a·C(C+H) + b·C + c` + 非负最小二乘 [C57] | — | 新旧系数不可混用 |
| 互斥与异步调度 | 互斥 balance（含环境变量）；无 SRF | 互斥 balance（含环境变量）与 SRF [C27] | 互斥 balance（无环境变量）与 DyntraLB；可同开 SRF；异步需 V2 runner [C58][C61] | — | `v0.30.0` 已支持 MRV2 异步调度 [C62] |

- **配置定义、校验与顶层降级**：`v0.23` 见 `2c59ff10:ascend_config.py#L55-L93, #L723-L760`（来源 7–8）；`v0.26` 见 `2ed6cbba:ascend_config.py#L83-L118, #L721-L743, #L968-L1026` 与 `platform.py#L667-L671`（来源 26–27、29、55）；`v0.30.0` 见 `c09d3e20:ascend_config.py#L711-L737, #L1478-L1514, #L1629-L1680` 与 `platform.py#L1075-L1115, #L1386-L1397`（来源 58–62）；`main` 移除后未知键处理见 `8d6180e2:ascend_config.py#L1972-L2030`（来源 63）；GLM 基线 PP 校验见 `db701c1f:ascend_config.py#L66-L75`（来源 30）。
- **预测公式、平滑对齐与在线停止**：启动拟合、公式求根、向上取整（与设计文档向下取整冲突 [!]) 与在线模型见 `profiling_chunk_predictor.py`（来源 9、37、48–49、57）[D]；调度器截断预算、异步子类、Worker 计时与跨进程停止通知见 `scheduler_profiling_chunk.py`、`patch_profiling_chunk.py`、`model_runner_v1.py`、`worker/v2/model_runner.py`、`worker.py` 与 `vllm@84030bbe:multiproc_executor.py`（来源 10–11、32–36、38–40、44–47、50–54）。
- **官方指南、设计文档与基准数**：P 节点定位、`smooth_factor` 调参建议（含 `0.0` 文档与源码校验冲突）、基准数据与设计文档见 `dynamic_chunk_pipeline_parallel.md`、`dynamic_chunked_pipeline_parallel.md` 与 `additional_config.md`（来源 13–25、56）[S13][S14][S16][S18][S20]。
- **待核**：本仓库无目标 NPU 上不同 `smooth_factor`、启动测量显存峰值或短序列负载的实机对比数据。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（5 个文件） |
| releases/v0.26.0rc | 有（5 个文件） |
| releases/v0.30.0rc2 | 有（9 个文件） |
| releases/v0.30.0 | 有（9 个文件） |

- **引入**：2026-04-17 · bec63146cf1442542940d4c2ce9f7eee8ab9845c · PR [#7896](https://github.com/vllm-project/vllm-ascend/pull/7896) —— [Feature][PP] Support Dynamic Chunk for Chunked Pipeline Parallelism (#7896)
  包含该提交的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ascend_config.py` +68 / −4（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +48 / −4（文本行变化）
  - `vllm_ascend/core/profiling_chunk_predictor.py` +379 / −0（文本行变化）
  - `vllm_ascend/core/scheduler_profiling_chunk.py` +723 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +28 / −0（文本行变化）
- **移除**：2026-11-15 · 839f538312e3b32b0f09935381c3e4eb78a88e2c · PR [#21310](https://github.com/vllm-project/vllm-ascend/pull/21310) —— [Refactor][Core] Remove dynamic chunk size CPP feature, configuration, and documentation (#21310)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/core/scheduler_profiling_chunk.py` +0 / −1168（文本行变化）
  - `vllm_ascend/core/profiling_chunk_predictor.py` +0 / −466（文本行变化）
  - `vllm_ascend/patch/platform/patch_profiling_chunk.py` +0 / −215（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −86（文本行变化）
  - `vllm_ascend/worker/v2/spec_decode/pcp_utils.py` +0 / −77（文本行变化）

当前含该标识符的 tag：v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1
