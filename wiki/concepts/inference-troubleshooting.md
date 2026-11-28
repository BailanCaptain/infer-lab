---
id: inference-troubleshooting
title: 推理排障入口：先找到问题发生在哪一步
type: concept
origin: direct
legacyAnchors:
  现场实操双模交互式排障工作台: 现场实操：交互式排障工作台
  放到-glm-双机哪些前提先不要改: 多机与缩卡复现：哪些前提先不要改
summary: >-
  面对启动失败、慢、内存不足、输出异常、图与通信错误等十类问题，先找最后成功阶段与首错 Rank，再沿最小证据、候选原因和区分实验进入已有机制页；内嵌交互式排障工作台，支持粘贴真实日志或 /metrics 定位首错，以及查看六类典型阻塞的时序对照。
aliases:
  - 推理故障排查
  - 推理排障
  - 推理问题
  - 启动失败
  - 模型加载失败
  - OOM
  - 显存持续增长
  - 通信超时
  - 推理卡死
  - 推理回归
  - 配置不生效
  - 缓存命中不生效
  - 乱码排查
  - 首错 Rank
  - EI0006
  - EI0002
  - SIGKILL
  - exitcode -9
  - '137'
  - HCCL_E_WAIT_TIMEOUT
  - plog
  - '507015'
  - '507034'
  - '507035'
  - '161002'
  - EZ1001
  - CheckSmmuFault
  - retCode=0x26
  - SMMU故障
  - libopapi.so
  - ZMQError
chapters:
  - '19'
order: 4
sources:
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L461-L473'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L567-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L906-L952'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L942-L951'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L145-L163'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L545-L565'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1035-L1045'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L570-L587'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L50-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L332'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1250-L1265'
  - 'vllm@ced6857a:vllm/v1/engine/utils.py#L262-L285'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2498-L2615'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L848-L860'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L508-L572'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L811-L828'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/performance_and_debug/service_profiling_guide.html
  - 'https://docs.vllm.ai/projects/ascend/en/latest/faqs.html'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L505-L545'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L489-L530'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L680'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1106-L1115'
  - 'vllm@ba15685a:vllm/v1/engine/utils.py#L365-L385'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L447-L597'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1825-L1910'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L950
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1464-L2441
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L279-L286'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L762-L778'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L283'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L879-L884'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L110-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L212-L224'
  - 'https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/runtimeapi/aclcppdevg_03_1345.html'
  - 'vllm-ascend@c09d3e20:csrc/attention/sparse_flash_attention/docs/aclnnSparseFlashAttention.md#L446-L453'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L604-L606'
  - 'vllm-ascend@8d6180e2:csrc/attention/quant_lightning_indexer_v2/docs/qli_v2_two_level_topk_design.md#L546-L552'
  - 'https://www.hiascend.com/document/detail/en/CANNCommunityEdition/910/API/aolapi/context/ops-nn/aclnn_return_code_nn.md'
  - 'https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/900/API/hcclug/hcclug_000025.html'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1274-L1282'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L1272-L1275'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L728-L795'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4470-L4478'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1170-L1185'
  - 'vllm@568afb3a:vllm/envs.py#L1673-L1677'
  - 'vllm@568afb3a:vllm/v1/executor/multiproc_executor.py#L313-L320'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1895-L1914'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2029'
  - 'vllm-ascend@c09d3e20:tests/ut/test_ascend_config.py#L2032-L2052'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L508-L522'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L860-L870'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L250-L310'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/model_runner.py#L425-L433'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L545-L555'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L848-L858'
  - 'vllm@ced6857a:vllm/lora/punica_wrapper/punica_base.py#L135-L152'
  - 'vllm-ascend@c09d3e20:vllm_ascend/lora/punica_npu.py#L20-L30'
relations:
  - to: request-call-chain
    kind: builds-on
    note: 按最后成功站点找到进程、函数和跨进程交接
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 启动失败沿设备初始化、权重、预算与预热逐段定位
  - to: ascend-config-system
    kind: builds-on
    note: 核对实际生效值，判断升级或配置是否改变路径
  - to: platform-plugin-registration
    kind: builds-on
    note: 版本号相同但安装文件与启动环境不同，先核对实际加载的插件和实现
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 区分启动预检、冷启动加载与 KV 后图捕获三类显存不足
  - to: cann-hccl
    kind: builds-on
    note: 区分首错卡引发的 EI0002 / EI0006 次生超时假象与真实设备网络/链路故障
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-24'
---

**推理排障先回答一个问题：这条请求或这次启动，最后在哪一步还正常？** 找到这个边界，才能决定下一份证据该从哪里取。

先沿下面的一次 30 秒超时三分诊走完第一份阶段证据，确认问题落在入口、计算还是返回，再用下方的交互式工作台或十类现场分支继续收敛。希望连续学习分析方法，可依次读[停顿样例](inference-performance-walkthrough.md)、[测量](inference-benchmarking.md)和[性能模型](inference-performance-analysis.md)。

## 同样是“没有回答”，为什么要走不同的路

服务页面一直转圈，看起来都像“模型卡住了”。但有时服务根本没启动，有时请求还在排队，有时设备已经算出结果，只是返回消息没有到达。给这三种情况换同一个参数，通常得不到可解释的结果。

先沿一次请求走一遍：入口收下输入，调度器安排工作，设备执行模型，生成结果再变回文字并返回。**调度器**决定这一轮处理哪些请求；**token（词元）**是模型处理的文字单元，用整数编号表示。启动阶段则要先把模型与设备准备好，才会进入这条请求路径。

```wiki-diagram
file: inference-troubleshooting-boundary
```

假设这次已经查到“入口收到请求”，却没有任何设备记录。此时仍有两个不同方向：请求没有被安排计算；或者已经安排，交给设备的途中出了问题。先找调度记录里有没有这条请求，以及它被分到了哪一步。**没有采到记录，只能说明现在缺证据，不能直接当成“设备没有执行”。** 确认采集位置确实覆盖这条路径以后，才能用缺失的事件判断卡在哪里。

## 把“没反应”变成能继续查的一条记录

用一个**教学示意**走完整个判断。入口在 `10:00:00` 收到请求 R，客户端在 `10:00:30` 超时。只凭这两项，还不能说模型计算花了 30 秒。

继续查同一 R，得到以下关联记录。请求经过一层**代理**，也就是客户端与服务之间的转发环节；代理若启用**缓冲**，会先攒住内容，再一起发给客户端。时刻与步骤号都是教学示意，目的是练习每补一项证据，怎样排除一个方向。

| 从哪里补记录 | 同一条 R 的示意记录 | 判断如何变化 |
| --- | --- | --- |
| 调度记录与各卡完成记录 | R 被分到第 42 步，该步所有参与卡完成 | 不能再用“始终排队”解释首个输出没到 |
| 引擎输出与服务发送记录 | 前端在 `10:00:01` 发出首个内容片段 | 首个内容已经生成，等待不全在模型计算里 |
| 代理接收记录与客户端接收记录 | 代理在 `10:00:01.1` 收到同一片段；客户端到超时仍未收到，后续流尚未结束 | 继续追代理收到之后的转发、连接与客户端读取 |

在隔离环境把保存的同一段响应流按原时序重放，直连时客户端逐段收到，经代理时仍积压；只修正代理的流式缓冲配置后，经过代理也能逐段收到。再恢复原配置，积压复现。这组结果支持把本例定位为代理缓冲问题。最后仍要用真实服务复测首个内容、完整响应、断连与错误处理，才能验收修正。

**换一项证据，路线就会变。** 若 R 始终在等待状态，就查队列、工作量和缓存；若第 42 步只有部分卡完成，就查其他卡的第一处错误和依赖。这个例子教的是如何按阶段缩小范围，不是把所有超时都归给代理。

读这份记录时，要能把代理收到的片段和前端发出的片段对应起来。若只知道“代理收过数据”，那可能是响应头、心跳或另一条请求，尚不能缩小到本例的位置。下面把同一内容片段画成一个带编号的小格：直连时它到达客户端；经过原代理配置时，它停在代理里。

```wiki-diagram
file: inference-troubleshooting-experiment
```

现场通常用 **request ID** 认出请求，用 **step ID** 认出一轮执行，用 **rank** 认出分布式进程。图中的“片段 1”是本例额外标注的观察对象，不是假定所有接口都有这个字段。默认日志不一定包含请求、步骤和 rank 的完整映射；缺哪项，就在复现环境补哪项。时间、进程和函数的对应见[请求调用链](request-call-chain.md)，现场采集表见[贯穿样例](inference-performance-walkthrough.md#现场怎样拿到这些记录)。

## 现场实操：交互式排障工作台

拿到第一份现场证据——例如报错日志、多卡交错刷屏的 **`EI0002`**（昇腾 HCCL 通信算子执行期 Notify 等待超时）或 **`EI0006`**（HCCL 通信域建链阶段 Socket 超时，对端提前退出时也会表现为次生建链超时）、**退出码 `137`**（常见 shell 按 `128 + SIGKILL` 折算的退出约定；是否确属主机或容器 OOM 仍需 cgroup `memory.events` 或内核 `dmesg` 记录佐证）或一份 `curl /metrics` 文本后，可以直接放进下面的交互式排障工作台。它提供两项独立视图：一是**粘贴报错日志或 `/metrics` 快照**，自动区分主故障与次生集合通信超时、定位最早异常卡并给出下一条取证命令；二是**查看 6 类典型阻塞的时序对照**，用无量纲示意相对时序快速建立读图直觉（仅用于理解阻塞机理，不替代真机 Trace）。

```wiki-tool
tool: troubleshoot-workbench
mode: full
title: 交互式排障工作台
summary: 粘贴报错日志或 /metrics 定位最早异常卡与下一条取证命令，或查看 6 类典型阻塞的时序对照。
```

## 按已经确认的阶段继续查

进入下面任一分支前，保留模型与分词器标识、软件安装版本、启动命令、实际生效配置、原始输入以及第一处异常的上下文。涉及多卡，收集受影响各 rank 的同期记录；涉及升级，同时保存升级前后的材料。后续每次实验只主动改变一个条件，并记录它连带改变了哪些路径。

| 现象归类 | 先拿哪一份最小首取证据 | 优先分流去向 |
| --- | --- | --- |
| 启动/加载失败 | `NPUWorker` 最后一条成功里程碑、首处 traceback、进程退出码与安装包路径 | [NPUWorker 启动](npu-worker-lifecycle.md)、[插件注册](platform-plugin-registration.md) |
| 延迟/吞吐/长尾 | `/metrics` 中的 `kv_cache_usage_perc`、`num_requests_waiting`、TTFT（首字时延）与 ITL（相邻词间隔） | [性能排障](inference-performance-troubleshooting.md)、[Roofline 与指标](roofline-and-metrics.md) |
| 内存与容量 | `dmesg`/`OOMKilled`（容器因超主机内存被强杀标志）+ 启动六步各节点显存占用 + 运行期 `num_preemptions` | [显存探测](kv-cache-memory-profiling.md)、[设备内存](device-memory.md) |
| 输出与数值异常 | 展开后的输入 token ID、生效采样参数、输出 token ID 与结束原因 | [输出正确性排障](inference-correctness-troubleshooting.md) |
| 图捕获与算子失败 | 失败前输入形状/精度、生效 `cudagraph_mode` 与 `--enforce-eager` 对照 | [ACL Graph](acl-graph.md)、[NPUGraph-ex](npugraph-ex.md) |
| 分布式通信超时 | 全组各 rank 按时间戳合并的前序日志与 CANN `plog`（昇腾底层运行日志）+ 链路预检 | [HCCL 通信](cann-hccl.md)、[集合通信](collective-communication.md) |
| 缓存与 P/D 分离 | 前缀复用命中记录、发送端/接收端请求映射与 connector 状态 | [Prefix Caching](prefix-caching.md)、[PD 分离](pd-disaggregation.md)、[Mooncake](mooncake-connector.md) |
| 接口/流式/解析 | 直连服务的原始流式片段 vs 代理与客户端收到的内容 | [API 入口](api-server-entry.md)、[流式输出](streaming-output.md)、[结构化输出](structured-output.md) |
| 长运行卡死/取消 | 连续活动请求数、完成计数、进程存活状态与取消后的块释放记录 | [请求收尾](request-teardown.md)、[容量与恢复案例](inference-capacity-and-reliability.md) |
| 版本与配置回归 | 升级前后 commit、安装路径与每进程最终生效 `AscendConfig` | [配置系统](ascend-config-system.md)、[补丁系统](ascend-patch-system.md) |

### 启动、依赖与加载：还没到接请求这一步

适用于服务尚未就绪、权重加载失败、设备或算子初始化异常。只有“启动失败”这句话时，先补下面这份记录；缺的项写“未知”，不要先猜一个参数来改。

- **最后成功到哪一步：** 按 [NPUWorker 启动顺序](npu-worker-lifecycle.md)找最后一条成功记录，例如权重已加载、预算探测尚未完成；附对应日志。
- **最先在哪一步失败：** 保留第一处异常、前后上下文及出错 rank，多卡时一起收集其他 rank 的同期日志。
- **实际运行的是哪份环境：** 保留启动命令、实际生效配置、安装包版本和实际加载路径，以及驱动、运行时版本。版本号相同，也可能加载了另一处安装的包。

插件未选中、依赖不兼容、芯片档位与权重或模型实现不匹配，发生在不同位置。例如在 `v0.30.0` 下，Atlas 300I DUO (`310P`) 走兼容性硬件档位，不支持 `bfloat16` 与原生 FP8，需要显式传 `--dtype float16` 或 ModelSlim 量化。标准 GQA 模型开启 `--kv-cache-dtype int8` 时依赖离线静态校准权重，缺少 **C8 scale**（INT8 KV 缓存量化缩放因子）会在 `attention_v1.py` 直接抛出 `ValueError`。先有了成功与失败的边界，才知道该检查哪一段。

若日志突然中断、进程直接退出，先保留同一次运行的容器 ID、PID、退出时刻和平台终止记录。**退出码 `137`（`SIGKILL` / `exitcode: -9`）本身不能证明 NPU HBM 显存不足**。应沿[进程退出的三步检查](device-memory.md#进程突然退出先查哪三件事)先查 `dmesg` / cgroup `memory.events` 与容器 `OOMKilled` 标志，区分主动终止、宿主机或容器 DRAM OOM，再决定是否进入设备预算排查。

在隔离复现环境使用该版本支持的最小启动配置，保持模型与安装产物一致，再复现失败阶段。若平台发现就失败，沿[插件注册](platform-plugin-registration.md)查；若已经加载权重，继续查加载后处理、预算或预热。精简配置后成功只能说明被移除路径参与了问题，要逐项加回定位；加载完成不等于服务已就绪。

### 延迟、吞吐与长尾：请求能完成，但等得不合适

适用于首字慢、回答停顿、吞吐低、负载增加后恶化。先留下逐请求发送/输出时间、输入输出长度、到达方式、失败数和服务阶段记录，再分排队、执行、返回三段。测量口径先查[推理测量](inference-benchmarking.md)，候选包括工作量增加、主机供给不足和资源竞争。

在 `v0.30.0` 下，一份简单的 `/metrics` 快照就能快速分流两类高频慢问题：

- **KV 块枯竭型（调度抢占风暴）**：`vllm:kv_cache_usage_perc` 持续高位（如超过 `0.95`）并伴随 `vllm:num_preemptions` 递增与 `vllm:num_requests_waiting > 0`。注意触发抢占的直接代码条件不是固定 `0.95` 阈值，而是 `scheduler.py` 调度在途请求时 `kv_cache_manager.allocate_slots(...)` 返回 `None`。此时还须无挂起待释放的 connector 块（`connector.has_pending_block_frees()` 为假）。同时存在可驱逐请求且其块可立即释放（`_request_blocks_can_be_freed(preempted_req)` 为真），才调用 `_preempt_request(...)`。若待驱逐块不可立即释放，或在等待队列分配时返回 `None`，调度器都直接跳出循环而不抢占。
- **低 KV 高延迟型（排除排队与容量）**：KV 使用率偏低且排队为 `0`，却出现偏高的 `inter_token_latency_seconds` 或 `time_to_first_token_seconds`。
  - **高 TTFT**：优先查长输入、[Chunked Prefill](chunked-prefill.md) 单步预算，以及是否误留 `VLLM_LOGGING_LEVEL=DEBUG` 触发每步分配器读数日志与图回放 `data_ptr()` 遍历校验（`Ascend 910B3` 上 `Qwen3-8B` `TP=8 c=1` 单样本对照下 `TTFT` 由 `139.07 ms` 升至 `193.98 ms`，`+39.48%`）。
  - **高 ITL / TPOT**：优先查是否误开 `--enforce-eager` 放大 Host 发射与同步开销（如 `Qwen3-30B-A3B` `4P4D` Eager 组合配置相对四卡混部 Graph `c=1` `TPOT` 从 `77.90 ms` 升至 `307.83 ms`），或核查 GQA 非连续共享 KV 池的整池连续化复制（Eager 轨迹已实测，线上 `FULL` 图待设备时间线闭合）与固定 `u` 扩 TP 下的负扩展（完整对账与边界见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）。

在相同负载下，只控制已定位阶段的一个变量；比较该段等待与端到端指标是否一起变化。阶段没变而汇总指标变了，先查负载与统计差异。分支实验、代价和验收条件见[性能排障](inference-performance-troubleshooting.md)。

### 内存与容量：先分清在哪个时点装不下

适用于内存不足（OOM）、运行中缓存紧张或已用内存持续增加。**先分清主机／容器限制，还是某张设备的空间不足。** 进程被终止，或没有 OOM 却伴随主机回收等待时，先用[主机与容器内存的判断方法](device-memory.md#主机还有空闲为什么容器里的进程先被终止)与[主机内存与大页](host-memory-and-hugepages.md)找限制所在层；不要仅凭退出码 `137` 就直接缩减设备 KV 缓存。

确认落在设备 NPU HBM 一侧后，沿启动到运行的四个连续时点逐段定位，并为每个出口先取对应的最小证据：

```wiki-diagram
file: troubleshooting-fig-memory-triage
```

按图中的四个出口依次核对：
- **`init_snapshot` 预检失败**：设备初始空闲显存低于 `gpu_memory_utilization × total_memory` 时直接抛 `ValueError`，多由同卡残留进程或并发混布引起；先查 `npu-smi info`。
- **初始化、权重加载或 `profile_run` 试跑期 OOM**：先看内层报错栈落在哪一步。若在主干权重加载期就报内存不足，优先考虑纯权重已接近或吃空可用显存。但 `ModelRunner` 初始化时会先按预算预分配持久缓冲区，若批预算过大仍会提前挤占权重空间。在 `MRV1`（`NPUModelRunner`）中，初始化按 `max_num_batched_tokens` 预建 `inputs_embeds` 与 `is_token_ids` 缓冲。该路径主干权重加载后打印 `Loading model weights took`。在 `MRV2` 中，初始化按 `max_num_reqs` 与 `max_num_tokens` 建 `AscendInputBuffers`。该路径由上游加载器打印 `Model loading took`。若开 LoRA 时栈落在 `load_lora_model` 内的 `PunicaWrapperBase` 索引建表，它直接受 `max_num_batched_tokens` 驱动。若死在 `profile_run()` 试跑峰值，则受 `max_num_batched_tokens` 与 `max_num_seqs` 驱动。排查顺序上，显存大头在权重时先扩 TP、换量化或清残余进程。批预算过大或死在 `PunicaWrapperBase` / `profile_run()` 时先收紧批预算复测，仍不够再缩序列上限。
- **KV 池建立后的图捕获期 OOM**：发生在 `compile_or_warm_up_model()` 调用 `capture_model()` 时。通常是 `--gpu-memory-utilization`（$u$）过高，吃空了留给 ACLGraph 图池与 CANN 运行时工作区的余量 $F - u \times T$。空卡 $F \approx T$ 时该余量即 $(1 - u) \times T$，处理上应适度下调 $u$。只有在 `profile_run()` 之后未显式传入 `--kv-cache-memory-bytes` 且 `capture_model()` 未抛异常退出时，日志才会打印建议字节数。即使开启 `--enforce-eager` 跳过录图使图显存记为 `0`，也会走到该日志；但录图期 OOM 中断则不会打印。日志里误印为 `--kv-cache-memory=`，正式 CLI 参数仍为 `--kv-cache-memory-bytes`。
- **运行期 KV 枯竭与抢占**：同时记录活跃请求、长度、空闲缓存块和**抢占**（先暂停请求、让出缓存，之后再恢复或重算）次数，先区分正常池复用与持续未释块增长。

容量账见[显存探测](kv-cache-memory-profiling.md)与[设备内存](device-memory.md)。改了量化配方、模型长度或缓存格式后，还要重新记录每块的字节数、各层缓存布局及权重和临时工作区等非缓存开销。块数相同不代表可用容量相同，旧部署的块数也不能直接沿用；标准 `v0.30.0` 主基线以 `Qwen3-8B` / `Qwen3-30B-A3B` 算账口径核对，历史 GLM 双机预算见[固定部署的预算方法](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

保持模型与路径，分别控制并发或长度，观察峰值随哪种工作量增长。请求结束后再看空闲块和活动记录是否恢复：块已归还而设备内存没降，符合池保留复用；在相同负载、相同稳定时点仍不断增加的未释放资源，才继续追增长来源。沿[请求收尾](request-teardown.md)区分引用释放、池保留与缓存清空，不能仅凭设备曲线判泄漏。

### 输出与数值：先找第一处不同

适用于乱码、重复、空输出、同输入不一致、NaN（无效数值）或质量回退。保留模板展开后的输入编号、最终生效的采样参数、输出编号、原始响应和结束原因。文本、编号、分数是不同层的证据；相同输入文字并不保证模型收到的编号相同。

先比较输入，再控制采样，接着在相同前缀下比较首次分歧的位置。编号相同而显示不同，追解码与返回；编号已不同，再查采样、数值与状态。完整示例和缓存/图/量化的对照条件在[输出正确性排障](inference-correctness-troubleshooting.md)，不要从“乱码”直接跳到“量化有问题”。

### 编译、图与算子：配置启用后，实际走了什么

适用于捕获失败、频繁重新编译、图回退或形状/类型不支持。**graph mode** 把支持的执行过程先捕获后重放；**eager** 按当前步骤由主机逐算子组织下发（Host 任务队列与运行时环境边界见[昇腾运行时与调优](ascend-runtime-and-tuning.md)）。收集报错前的输入形状、数据类型、编译/捕获日志、实际图模式及首次触发条件，沿[图模式分层](graph-mode-layer.md)找失败边界。

在 `v0.30.0` 下有两个高频硬边界值得首查：

- **FA3 与全图模式互斥**：FA3 注意力后端（`AscendFAImpl`）不支持与 `FULL_DECODE_ONLY` 图模式叠加，会直接抛出 `ValueError`。
- **硬件能力静默降级**：硬件档案不包含 `NPUGRAPH_EX` 能力时（如 `310P`），配置校验会打告警并静默关闭 `enable_npugraph_ex`、`enable_static_kernel` 与 `enable_super_kernel`。

在同版本支持的配置内，固定触发输入，比较正常图路径与 eager。只在图路径失败，会把调查范围缩到捕获、回放及其路径差异；仍不能直接断言“图本身错误”，因为算子选择、内存布局和时序也会变化。随后分别查 [ACLGraph](acl-graph.md)、[NPUGraph-ex](npugraph-ex.md) 及涉及算子的限制；关闭图后的速度不作原配置收益结论。

### 分布式通信：区分交换慢和有人没到

首次多机部署或网络配置发生变化时，先走 [HCCL 页的设备网络预检](cann-hccl.md#启动多机前先检查哪一层网络)：核本机链路和地址，再探测实际使用的 NPU 对。主机 IP、API 端口、NPU 网络各自取得连通性证据，之后再定位推理程序在哪一步等待。

适用于通信超时、多卡等待或某张卡耗时突出。收集同一次集合通信的组、参与 rank、设备侧到达/完成、张量规模和各 rank 前序错误。**集合通信**要求一组参与者按匹配顺序交换数据。因此“通信慢或超时”背后存在三种不同时间线：**某卡根本没到**（首错崩溃触发算子执行期次生 `EI0002` Notify 等待超时 / `HCCL_E_WAIT_TIMEOUT`，或在通信域初始化未完成时触发次生 `EI0006` Socket 建链超时）、**某卡迟到**（负载/专家/Host 或 GC 拖慢），以及**全员到齐但交换本身慢**（真实链路与带宽瓶颈）：

```wiki-diagram
file: troubleshooting-fig-first-fault
```

排查多卡超时或通信变慢时，保持通信规模并按图中的三步收敛：

1. **先排除分支 A（锁定最早的首错 Rank）**：按时间戳合并全部参与 rank 的日志与 CANN `plog`。若只看到 `EI0002` 或 `EI0006` 却没有任一卡的前序主错误，不能默认归罪给 Rank 0，应先补齐其余卡的同期日志再查网络。
2. **再区分分支 B 与 C（慢卡拖尾 vs 链路瓶颈）**：对比各卡设备侧到达屏障的时刻。若某张卡前序计算明显拖长，先控制迟到卡前面的工作量，观察其他卡等待是否同步下降；若参与条件已齐、前序均干净而交换仍慢，再用匹配拓扑和规模的通信测试核对链路。
3. **核对真实负载竞争**：独立通信测试正常也不能排除模型负载下的竞争。机制见[集合通信](collective-communication.md)与 [HCCL](cann-hccl.md)，时钟及依赖判别见[性能分析](inference-performance-analysis.md)。

### 缓存和分离部署：命中、可用、传到，是三件事

适用于前缀复用不生效、状态错误、缓存传输或卸载回载等待。**KV cache** 保留计算过的历史；**prefix caching** 在条件相符时复用已有前缀。收集实际输入编号、缓存键与命中记录、可复用长度及块状态。分离部署还要收集发送端、接收端、请求映射和完成确认；它把输入处理和后续生成放在不同实例。在 `v0.30.0` 下，GQA 模型启用 `MooncakeConnector` 时不支持同时开启 C8 KV 量化，启动校验会直接报错。

先固定输入与版本，比较冷、热两次，并确认实际减少了重算；若查到命中但依赖未就绪，继续追数据可用而非只看命中率。在隔离环境比较本地复用与传输/卸载路径，差异收敛到哪个交接就查哪个 connector。下一站是 [prefix caching](prefix-caching.md)、[PD 分离](pd-disaggregation.md)、[Mooncake](mooncake-connector.md) 或[分层卸载](kv-cache-layerwise-offload.md)，不能把一种缓存的行为套到所有实现。

想把匹配、取回、计算和交接放在一起看，可沿 [DeepSeek 生产案例](deepseek-serving-case.md#命中一样多为什么第二次首字更慢)区分“容量不足”和“数据尚未就绪”，再回到对应机制核对实现。

### 接口与服务能力：结果在哪一层变得不可用

适用于流式中断、JSON 不符合约定、工具调用解析失败或多模态输入被拒。先留 HTTP 状态、请求体、原始流式片段、结束原因、解析器名称与最终客户端内容。**结构化输出**约束生成时可选的 token；**工具解析器**把生成内容整理成调用字段，两者不是同一道处理；多模态请求若在入口通过后出现视觉编码慢或重复计算，另接[多模态特征缓存](multimodal-encoder-cache.md)核对缓存命中与准入边界。

固定同一份输入，先直连服务记录原始响应，再与代理和客户端收到的内容逐层比较。原始数据完整而客户端缺失，就查传输、缓冲与解析；入口已拒绝则查[API 入口](api-server-entry.md)，生成内容不符合限制则查[结构化输出](structured-output.md)，字段处理查[流式输出](streaming-output.md)。流式与非流式对照会改变交付方式，不能只凭两次随机生成文本不同定位解析器。

### 长运行与恢复：停止前后，谁还持有这条请求

适用于运行一段时间卡死、取消后继续工作、排空失败或恢复异常。先区分“仍有工作但进度很慢”与“所有相关进度停止”，连续记录活动请求、完成计数、设备进度、各进程存活及第一个停止推进的时点。取消时追前端通知、引擎状态与 worker 清理，不能只看客户端窗口消失。

在隔离环境对一个可追踪请求发起取消，观察活动记录和块引用是否按[收尾路径](request-teardown.md)释放；恢复问题保留前后实例标识与状态交接。若重启后暂时恢复，只证明状态被重置，不能据此确定根因。扩缩容先查现场采用的控制系统；涉及 RFork 时，补对应分支提交标识、参与进程的角色与 rank、两端实际生效配置，再转[其专用排障页](rfork-troubleshooting.md)核对协议。

重启后仍排长队、扩容没有立即生效，或需要安排实例下线时，接着用[容量与恢复案例](inference-capacity-and-reliability.md)检查就绪时间、故障范围、净消化能力和客户端结果；计划迁移与突然故障分别取证。

### 版本与配置回归：同一命令不等于同一路径

适用于升级后变慢、结果改变、开关被忽略或默认行为变化。保存升级前后精确 commit、安装路径、镜像、模型文件、启动日志与每个进程的最终配置。在 `v0.30.0` 下，`AscendConfig` 对 `--additional-config` 采用 Pydantic `extra="forbid"` 严格未知键校验，未装 `vllm_omni` 时拼写错误会直接拒绝启动；但若环境中可发现 `vllm_omni`（`find_spec("vllm_omni")` 非空），`init_ascend_config` 会在构建 `AscendConfig` 前先打印警告并剥离未知顶层键，服务仍会继续启动。此外硬件能力降级仍可能把不支持的开关自动关掉，因此“未报错”仍不等于目标路径已生效。先查[配置系统](ascend-config-system.md)的覆盖与校验，再查[补丁系统](ascend-patch-system.md)是否替换了相关实现。

固定输入和负载，分别运行两套完整且兼容的环境；若能定位到单项配置变化，再在各版本支持范围内显式对齐。版本标签相同而安装文件不同，先解决产物不一致。只有在输入、有效配置与依赖可比较后，差异才进入版本回归调查；不能把新版本参数粘回旧版本当作已验证修复。

### Ascend 910B3 真机五类高频报错与 DEBUG 延迟陷阱速查

把单卡与八卡 `Ascend 910B3`（`v0.30.0`）上实机复现的五份故障栈标本与热路径观测税汇总成一线速查表（原件快照见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）：

| 实机故障标本 / 现象 | 首错栈位置与关键报错特征 | 易混淆陷阱与一步排障动作 |
| --- | --- | --- |
| **1. `u=0.90` 捕获期 FIA OOM** | 通过 `profile_run()`（如 `Qwen3-0.6B` 划出 `53.47 GiB` KV）及 35 档 `PIECEWISE` 后，在 `FULL` `1/35` 的 `device_op.py`（FIA）内申请 `1.98 GiB` > 剩余 `1.71 GiB` 抛 `NPU out of memory` | 并非 `profile_run()` 失败；录图 OOM 时不会输出录图后建议日志，需下调 `--gpu-memory-utilization`（如 `0.82`），或待成功录图后按正式参数 `--kv-cache-memory-bytes` 固化（见 [ACL Graph](acl-graph.md)） |
| **2. Sleep 唤醒 `FRACTAL_NZ` 拦截** | `wake_up()` 在 `worker.py` 抛 `ValueError: FRACTAL_NZ mode is enabled...` | 普通 BF16 权重在默认 `weight_nz_mode=1` 下本不转 `NZ`，但唤醒守卫只要非零即拒；显式传 `'{"weight_nz_mode":0}'`（见 [Sleep Mode](sleep-mode.md)） |
| **3. PD 分离 `TP_P % TP_D != 0`** | 如 `2 % 4 != 0`，`ascend_config.py` 普通 PD 校验触发外层 `pydantic_core.ValidationError`（`type=assertion_error`，`Assertion failed, Prefill TP size must be divisible by Decode TP size.`） | 对齐 `kv_transfer_config` 中两端 `tp_size` 使 `prefill_tp_size % decode_tp_size == 0`（Prefill TP 必须能被 Decode TP 整除，见 [PD 分离](pd-disaggregation.md)） |
| **4. `MooncakeConnectorV2` 配 `kv_both`** | 解析为 `MooncakePullConnector`，在 `mooncake/base_worker.py` 抛 `ValueError: Mooncake worker requires exactly one KV transfer role, got 'kv_both'` | 拆分为独立 `kv_producer` 与 `kv_consumer`；注意健康日志仅打印配置名 `MooncakeConnectorV1` 或 `HCCL operator is 1836s` 绝非报错（见 [Mooncake](mooncake-connector.md)） |
| **5. 未量化 GQA 传 `--kv-cache-dtype int8`** | 在 `attention_v1.py` 抛 `ValueError: The current GQA‑related models adopt static quantization...`（含 `U+2011` `‑` 不换行连字符） | 这是缺少离线 C8 校准权重报错，区别于 `ascend_config.py` 针对已带 C8 权重配普通 `MooncakeConnector` 的传输拦截（见 [KV cache 量化](kv-cache-quantization.md)） |
| **6. 误留 `VLLM_LOGGING_LEVEL=DEBUG`** | 无异常退出，但 `worker.py` 每步读分配器打印日志（`TP=8` 达 `3,312` 行）+ `acl_graph.py` 逐 Tensor 核对 `data_ptr()`，`TP=8 c=1` 单样本 `TTFT` `+39.48%` | 压测与线上服务恢复 `VLLM_LOGGING_LEVEL=INFO`；勿把该开销误写成每步 `mem_get_info` 设备同步（见 [设备内存](device-memory.md)） |

### CANN 与 AscendCL 高频数字错误码速查（507015 / 507034 / 507035 / 161002 / 107030）

外层 Python 日志常只停在 `AclrtSynchronizeStreamWithTimeout` 或 `synchronize stream failed`，真正区分硬件执行异常、算子入参越界与图捕获限制的线索藏在数字 `aclError` 与 `plog` 中：

| 数字错误码与常见外层报错 | 官方返回码定义 | 现场候选诱因（待日志核实） | 首取证据与下一步分流 |
| --- | --- | --- | --- |
| **`507015`**（`AclrtSynchronizeStreamWithTimeout` / `aicore exception` / `CheckSmmuFault` `retCode=0x26`） | **AI Core 执行异常**（`ACL_ERROR_RT_AICORE_EXCEPTION`；区别于算术溢出码 `207003` `ACL_ERROR_RT_AICORE_OVER_FLOW`） | 核函数访存未对齐、UB/GM 地址越界或指令约束违例（CANN RUNTIME `plog` 中常伴随 `CheckSmmuFault:Get isSmmuFault is 1.` 与 `retCode=0x26, [aicore exception]`） | 进同 PID 的 `plog` 搜 `CheckSmmuFault`、`retCode=0x26` 与首处 `fault kernel_name`，再转 [AI Core](ai-core.md) 或 [ACL Graph](acl-graph.md) |
| **`507034`**（`ACL stream synchronize failed` / `vector core timeout`） | **Vector Core（AIV）执行超时** | 超长序列单步计算超阈值，或核内同步未释放 | 核对超长序列/单步批大小与核内同步，多卡时一并按时间戳排查 [HCCL 通信](cann-hccl.md) 与慢卡拖尾 |
| **`507035`**（`vector core exception` / `aicore VEC 507035`） | **Vector Core（AIV）执行异常** | 向量指令输入特殊值、Tiling 偏移或 UB 越界 | 抓取 `plog` 中 `vec error info` 与输入形状/数值分布，对照 [AI Core](ai-core.md) 与 [算子与 kernel](ops-and-kernels.md) |
| **`161002`**（`ACLNN_ERR_PARAM_INVALID`） | **`aclnn` 接口参数无效** | 输入输出 `dtype`、数据格式、维度或步长违反算子入参约束 | 查紧邻报错的 `aclGetRecentErrMsg` 明细核对张量形状与量化 Scale 类型，转 [算子与 kernel](ops-and-kernels.md) |
| **`107030`**（`ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT`） | **当前捕获模式不支持该操作** | 图捕获流内夹杂受限同步或 `rtMemcpy`（部分算子仅打 `plog` 不中断推理） | 先核对服务是否实际中断；若捕获失败则用 `--enforce-eager` 对照并转 [ACL Graph](acl-graph.md) 与 [设备内存](device-memory.md) |

## 证据不足时，下一步应该有多具体

有用的回答可以停在“尚不能判根因”，但要同时说明**已经确认什么、还差哪项证据、怎样取、两种结果分别去哪**。例如只有通信超时日志时，先要同一通信组里最早报错的 rank 及其前序记录；没必要先让用户转储整个模型。

采不到请求与步骤映射时，先缩小到单条可控请求和短窗口，确认日志是否覆盖入口、调度和输出；复现消失则保留原并发作为触发条件，再逐步加回。最小复现和线上问题有了差异，也要把差异写进结论，而不是宣布“无法复现所以没有问题”。

## 多机与缩卡复现：哪些前提先不要改

排查跨卡或跨机等待时，先按实际生效的通信域（`TP`、`DP`、`EP`、`PP`）锁定等待方与最早异常 rank；开启跨组专家并行时，没有用户请求的空闲 DP 组仍会执行陪跑（dummy）步参与通信，不能把某组等待直接归因于该组前端堵塞。

缩小卡数、切换模型或改动量化精度，都会改变权重分片布局、图捕获档位和算子分派路径；应先在原配置下取得阶段边界证据，再决定怎样简化复现。PD 分离、外部 KV 缓存、RFork 等分支按现场实际启用的开关导流，不默认套进未开启的普通请求。双机 16 卡（`TP8/DP2/EP16`）历史算例的具体排障后果见 [GLM-5.3-Flash 双机部署「这套部署给后面各章留下的后果」](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)。

## 常见误解

现场排障最容易误入歧途的五类直觉判断，与 `v0.30.0` 源码与证据链的对应关系汇总如下：

```wiki-diagram
file: troubleshooting-fig-myths
```

再补两条常被忽略的原则：
- **“知识库必须直接报出唯一根因才有用。”** 缺现场证据时，能排除不适用分支、给出可区分原因的下一步命令，就是可验证的帮助。
- **“拿到一份带 ms 数字的示意图就能直接反推真机耗时。”** 教学时序沙箱只用来理清阶段边界与阻塞机理；真机定量验收必须回到实机日志、`/metrics` 与短窗口 profiling。

## 对照源码

### 怎么开

本页没有统一诊断开关。按已确认阶段选择日志、`/metrics` 或短窗口 profiler；各机制页维护对应参数和支持条件。不要一次开启所有调试选项，使原问题的时序与内存条件消失。常用一线最小取证命令如下：

```bash
# 1. 启动与显存里程碑快速核对（区分 init_snapshot / MRV1 与 MRV2 load_model / KV 池 / capture_model）
grep -nE "Free memory on device|Loading model weights took|Model loading took|Available KV cache memory|capture_model|NPU out of memory" serve.log

# 2. 多机汇总后剔除纯次生 EI0002 / Notify 等待超时（保留同行连接拒绝、errno!=0 或 OOM 等主因）
#    过滤 code=0 / watchdog 配置 / 良性 INFO 与 Traceback 栈帧，按跨身份归并、UTC 折算与混合时区告警排序
{ [ -d ./all_node_logs ] || { echo "missing ./all_node_logs/" >&2; false; }; } && grep -rnI '' ./all_node_logs/ | awk 'function d2n(y,m,d, a,yoe,doy,doe){y-=(m<=2);a=int(y/400);yoe=y-a*400;doy=int((153*(m+(m>2?-3:9))+2)/5)+d-1;doe=yoe*365+int(yoe/4)-int(yoe/100)+doy;return a*146097+doe-719468} function valid_md(y,m,d, md){if(m<1||m>12||d<1)return 0;md=(m==2?((y==0||(y%4==0&&(y%100!=0||y%400==0)))?29:28):((m==4||m==6||m==9||m==11)?30:31));return d<=md} function tz(t, sgn,hm){if(t=="Z"||t=="z")return 0;sgn=(substr(t,1,1)=="-"?-1:1);hm=substr(t,2);gsub(/:/,"",hm);return sgn*(int(substr(hm,1,2))*3600+int(substr(hm,3,2))*60)} function n2ymd(z,era,doe,yoe,y,doy,mp,d,m){z+=719468;era=int(z/146097);doe=z-era*146097;yoe=int((doe-int(doe/1460)+int(doe/36524)-int(doe/146096))/365);y=yoe+era*400;doy=doe-(365*yoe+int(yoe/4)-int(yoe/100));mp=int((5*doy+2)/153);d=doy-int((153*mp+2)/5)+1;m=mp+(mp<10?3:-9);y+=(m<=2);return sprintf("%04d-%02d-%02d",y,m,d)} function to_utc(yr_n,mo_n,dy_n,hms,tzp, off,sec,ds,sh,ymd){off=tz(tzp);sec=int(substr(hms,1,2))*3600+int(substr(hms,4,2))*60+int(substr(hms,7,2))-off;ds=d2n(yr_n,mo_n,dy_n);sh=int(sec/86400);if(sec<0&&sec%86400!=0)sh--;sec-=sh*86400;ds+=sh;ymd=n2ymd(ds);return sprintf("%s-%02d:%02d:%02d",ymd,int(sec/3600),int((sec%3600)/60),sec%60)} function strip_ts(x){gsub(/[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/(^|[^0-9:])[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/(^|[^0-9:])([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);return x} function is_hdr(hp){gsub(/(RUNTIME|HCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\([0-9]+,[^)]*\)/," ",hp);gsub(/WorkHCCL\(([^()]|\([^()]*\))*\)/," ",hp);gsub(/(\[|\()(Worker_|[A-Za-z0-9_]*EngineCore|APIServer)[^)\]]*(\]|\))/," ",hp);sub(/^([[:space:]]*\[[^]]+\][[:space:]:-]*)+/," ",hp);gsub(/^[A-Za-z0-9_.-]+:/," ",hp);gsub(/ /,"  ",hp);gsub(/(^|[^[:alnum:]_])(host|node|instance|group|grp|pid|tid|uid|gid|rank|global_rank|local_rank)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_.:-]+/," ",hp);gsub(/(^|[^[:alnum:]_])((ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT)|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+)([^[:alnum:]_]|$)/," ",hp);gsub(/[][[:space:]():,|\/-]+/,"",hp);return hp==""} function find_ts(x, r, bp,bk,bt,p,t,ms,ml){bp=999999;bk=0;bt="";if(match(x,/[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){ms=RSTART;ml=RLENGTH;if(is_hdr(substr(x,1,ms-1))){bp=ms;bk=1;bt=substr(x,ms,ml)}}if(match(x,/E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){ms=RSTART;ml=RLENGTH;if(ms<bp&&is_hdr(substr(x,1,ms-1))){bp=ms;bk=2;bt=substr(x,ms,ml)}}if(match(x,/(^|[^0-9-])[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){p=RSTART;ml=RLENGTH;t=substr(x,p,ml);if(substr(t,1,1)!~/[0-9]/){t=substr(t,2);p++}if(p<bp&&is_hdr(substr(x,1,p-1))){bp=p;bk=3;bt=t}}if(match(x,/(^|[^0-9:])([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){p=RSTART;ml=RLENGTH;t=substr(x,p,ml);if(substr(t,1,1)!~/[0-9]/){t=substr(t,2);p++}if(p<bp&&is_hdr(substr(x,1,p-1))){bp=p;bk=4;bt=t}}r["bk"]=bk;r["bt"]=bt} function kv_val(str,key, m){if(match(tolower(str),"(^|[^[:alnum:]_])" key "[[:space:]]*[:=][[:space:]]*[^][:space:],)]+")){m=substr(str,RSTART,RLENGTH);sub(/^[^:=]*[:=][[:space:]]*/,"",m);return m}return ""} function get_tb_ids(x, ids, t,id,rid,wid,tl,v){split("",ids);rid="";wid="";ids["pid"]="";ids["host"]="";ids["inst"]="";ids["grp"]="";ids["rank"]="";ids["wid"]="";ids["rstr"]="";while(x!=""){if(sub(/^[[:space:]]+/,"",x))continue;if(match(x,/^([0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?)/)){x=substr(x,RLENGTH+1);sub(/^[: -]+/,"",x);continue}if(match(x,/^(\[[^]]+\]|\([^)]+\)|(RUNTIME|HCCL|WorkHCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\(([^()]|\([^()]*\))*\)|Worker_[^:[:space:]]+|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]:]+|(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT))/)){tl=RLENGTH;t=substr(x,1,tl);if(t~/^(\[[Rr]ank[[:space:]_:-]*[0-9]+\]|[Rr]ank[[:space:]_:-]*[0-9]+)$/){id=tolower(t);gsub(/[[:space:]\[\]():-]+/,"",id);if(rid==""){rid=id;ids["rank"]=id;ids["rstr"]=(substr(t,1,1)=="["?t:"[" t "]")}}else if(t~/^(\[Worker_[^]]*\]|\(Worker_[^)]*\))$/){id=tolower(t);gsub(/[[:space:]\[\]():-]+/,"",id);if(wid==""){wid=id;ids["wid"]=id}}v=kv_val(t,"pid");if(v~/^[0-9]+$/&&ids["pid"]=="")ids["pid"]=v;v=kv_val(t,"host");if(v!=""&&ids["host"]=="")ids["host"]=tolower(v);v=kv_val(t,"instance");if(v!=""&&ids["inst"]=="")ids["inst"]=tolower(v);v=kv_val(t,"(group|grp)");if(v!=""&&ids["grp"]=="")ids["grp"]=tolower(v);x=substr(x,tl+1);sub(/^[: -]+/,"",x);continue}break}return (rid!=""?rid:(wid!=""?wid:(ids["pid"]!=""?"pid" ids["pid"]:"")))} function clean_meta(x, out,k,y,pre){x=strip_ts(x);gsub(/(port|tokens? processed|pid|tid|uid|gid)[[:space:]:=]+[0-9]+/,"",x);gsub(/[0-9]+[[:space:]]+(tokens?|reqs?|requests?|steps?|iters?|iterations?|layers?|blocks?|items?|samples?|batches|bytes|KB|MB|GB|KiB|MiB|GiB|ms|us|ns|sec|seconds?)([^[:alnum:]_]|$)/," ",x);out="";while(match(x,/[A-Za-z_][A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*["\047]?[A-Za-z0-9_.-]+["\047]?/)){k=tolower(substr(x,RSTART,RLENGTH));if(k~/^([a-z_]*(log|logging|level|mode|verbosity)|vllm_[a-z_]+)[[:space:]]*[:=][[:space:]]*["\047]?(error|critical|fatal|warn|warning|info|debug)["\047]?$/){out=out substr(x,1,RSTART-1) " "}else if(substr(x,RSTART,RLENGTH)~/[:=][[:space:]]*[0-9]+$/){out=out substr(x,1,RSTART-1) ((k~/(err|ret|code|fault|fail|status)/||(RSTART>1&&substr(x,RSTART-1,1)=="."))?substr(x,RSTART,RLENGTH):" ")}else{out=out substr(x,1,RSTART+RLENGTH-1)}x=substr(x,RSTART+RLENGTH)}x=out x;if(x~/(^|[^[:alnum:]_])INFO([^[:alnum:]_]|$)/ && !(x~/(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)){out="";y=x;while(match(y,/[0-9]{6}/)){pre=tolower(substr(y,(RSTART>32?RSTART-32:1),(RSTART>32?32:RSTART-1)));if(pre~/(^|[^[:alnum:]_])(err(or)?([[:space:]_]*(code|no))?|ret(urn)?([[:space:]_]*code)?|dev_?ret_?code|errno|fault|status|code)([[:space:]:=]+is)?[[:space:]:=]+$/){out=out substr(y,1,RSTART+RLENGTH-1)}else{out=out substr(y,1,RSTART-1) "000000"}y=substr(y,RSTART+RLENGTH)}x=out y}return x} function dom_ok(t,ph,pi,pg,pp,pr){return (ph==""||tb_host[t]==""||ph==tb_host[t])&&(pi==""||tb_inst[t]==""||pi==tb_inst[t])&&(pg==""||tb_grp[t]==""||pg==tb_grp[t])&&(pp==""||tb_pid[t]==""||pp==tb_pid[t])&&(pr==""||tb_rank[t]==""||pr==tb_rank[t])} function find_tb(fn,want_open,pr,pw,pp,ph,pi,pg, best,t,has_id,has_dom,id_match,dom_hit,fdom,cdom){best="";fdom="";has_id=(pr!=""||pw!=""||pp!="");has_dom=(ph!=""||pi!=""||pg!="");for(t=1;t<=tb_seq;t++){if(tb_fn[t]!=fn)continue;if(want_open){if(!tb_open[t])continue}else{if(tb_ch[t]=="")continue}if(!dom_ok(t,ph,pi,pg,pp,pr))continue;if(has_id){id_match=((pr!=""&&pr==tb_rank[t])||(pw!=""&&pw==tb_wid[t])||(pp!=""&&pp==tb_pid[t]));if(!id_match)continue}else if(has_dom){dom_hit=((ph!=""&&ph==tb_host[t])||(pi!=""&&pi==tb_inst[t])||(pg!=""&&pg==tb_grp[t]));if(!dom_hit)continue}cdom=tb_host[t] "|" tb_inst[t] "|" tb_grp[t] "|" tb_rank[t] "|" tb_wid[t] "|" tb_pid[t];if(fdom==""){fdom=cdom}else if(cdom!=fdom){return ""}if(!has_id&&!has_dom){if(want_open&&t!=last_tb[fn])continue;if(!want_open&&t!=last_ch[fn])continue}if(best==""||tb_ord[t]>tb_ord[best])best=t}return best} BEGIN { cfp="(out of memory|(^|[^[:alnum:]_])OOM([^[:alnum:]_]|$)|OutOfMemoryError|Failed to allocate memory|Failed to verify the cluster information|invalid device|(^|[^[:alnum:]_])([A-Za-z_][A-Za-z0-9_.]*\\.)?([A-Z][A-Za-z0-9_]*(Error|Exception|Fault|Interrupt|Exit)|BaseException|Exception|StopIteration|StopAsyncIteration|BaseExceptionGroup|ExceptionGroup):|EZ[0-9]{4}|EL[0-9]{4}|(^|[^[:alnum:]_.])(507015|507034|507035|507008|207003|107002|107030|16100[12]|561002)([^[:alnum:]_]|$)|(^|[^[:alnum:]_])(errno|err_?code|ret_?code|dev_?ret_?code|exit_?code|return_?code)[[:space:]]*[:=][[:space:]]*(-?[1-9][0-9]*|0x0*[1-9a-fA-F][0-9a-fA-F]*)([^[:alnum:]_]|$)|CheckSmmuFault|isSmmuFault([[:space:]]+is|[[:space:]]*[:=])[[:space:]]*[1-9]|retCode=0x0*[1-9a-fA-F]|EJ0001|Getting socket times out|\\[Wait\\]\\[LinkEstablish\\]|RaSocket[^;\n]*(timed out|timeout|failed|FAIL|ERROR|refused|reset)|([Cc]onnection (refused|reset)|[Nn]o route to host|[Uu]nreachable)|((^|[^[:alnum:]_])([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?)([^[:alnum:]_.]|$)[^;\n]*(crashed|exited|died|killed|terminated|aborted|dead|failed|failure|denied|refused))|permission denied|no space left|cannot allocate|broken pipe|illegal instruction|bus error|uncorrectable|ecc error|double bit|hardware fault|[Ww]atchdog([[:space:]_-]+(has|is|was))?[[:space:]_-]*(timeout|timed[[:space:]]+out|expired|failed|failure|error|killed|triggered|reset|hang|blocked)|link down|segfault|segmentation fault|core dumped|SIGKILL|SIGSEGV|SIGABRT|SIGBUS|SIGILL)"; fp=cfp "|EI00(0[469]|14)" } { raw=$0; fn=""; gpref=""; c=raw; if (match(c, /^(\.?\/[^:]+|\(standard input\)):[0-9]+:/)) { gpref=substr(c,1,RLENGTH); fn=substr(c,1,index(c,":")-1); c=substr(c,RLENGTH+1) } else if (!(c ~ /^(\[|\(|[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]|[0-9]{2}-[0-9]{2}[ T]|E[0-9]{4} |([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9])/) && match(c, /^[^:[:space:]]+:[0-9]+:/)) { gpref=substr(c,1,RLENGTH); fn=substr(c,1,index(c,":")-1); c=substr(c,RLENGTH+1) } if (c ~ /^[[:space:]]*$/) { for(t=1;t<=tb_seq;t++)if(tb_fn[t]==fn&&tb_open[t]){tb_open[t]=0;if(last_tb[fn]==t)last_tb[fn]=""} next } find_ts(c, tr); bk=tr["bk"]; bt=tr["bt"]; if (bk==1) { ay=substr(bt,1,4); amo=substr(bt,6,2); ady=substr(bt,9,2); ahms=substr(bt,12,8); atzp=""; if (match(bt,/([Zz]|[+-][0-9]{2}:?[0-9]{2})$/)) atzp=substr(bt,RSTART,RLENGTH); if (valid_md(ay+0,amo+0,ady+0)) { if (atzp!="") { au=to_utc(ay+0,amo+0,ady+0,ahms,atzp); ay=substr(au,1,4); amo=substr(au,6,2) } if (!min_yr || ay<min_yr) min_yr=ay; if (!max_yr || ay>max_yr) max_yr=ay; if (amo=="12") has_d_dec[ay]=1; if (amo=="01") has_d_jan[ay]=1 } } tb_id=get_tb_ids(c, tb_ids); cur_pid=tb_ids["pid"]; cur_host=tb_ids["host"]; cur_inst=tb_ids["inst"]; cur_grp=tb_ids["grp"]; cur_rank=tb_ids["rank"]; cur_wid=tb_ids["wid"]; cur_rstr=tb_ids["rstr"]; lk=find_tb(fn,1,cur_rank,cur_wid,cur_pid,cur_host,cur_inst,cur_grp); chk_awt=find_tb(fn,0,cur_rank,cur_wid,cur_pid,cur_host,cur_inst,cur_grp); c_np=c; while (sub(/^[[:space:]]*(\[[^]]+\]|Worker_[^:[:space:]]+|\([^)]+\)|(RUNTIME|HCCL|WorkHCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\(([^()]|\([^()]*\))*\)|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]:]+|(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT)|[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?):?[[:space:]]?/, "", c_np)) {} has_pref=(c_np!=c); c_trim=c_np; sub(/^[[:space:]]+/,"",c_trim); sub(/[[:space:]]+$/,"",c_trim); is_term=(c_trim ~ /^([A-Za-z_][A-Za-z0-9_.]*\.)?([A-Z][A-Za-z0-9_]*(Error|Exception|Fault|Interrupt|Exit)(:[[:space:]]*.*|[[:space:]]*$)|(BaseException|Exception|StopIteration|StopAsyncIteration|BaseExceptionGroup|ExceptionGroup)([[:space:]]*$|:[[:space:]]*.*)|(Error|Exception|Fault|Interrupt|Exit):)/); is_chain=(tolower(c_trim) ~ /^(during handling of the above exception(, another exception occurred)?|the above exception was the direct cause of the following exception|caused by):?[[:space:]]*$/); is_log_hdr=((bk==0 && !has_pref && c ~ /^[[:space:]]*(INFO|DEBUG|WARN|WARNING|ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/) || (has_pref && (c ~ /(^|[^[:alnum:]_])(INFO|DEBUG)([^[:alnum:]_]|$)/ || c_trim ~ /^(INFO|DEBUG|WARN|WARNING|ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/))); if (match(c, /(^|[^[:alnum:]_])Traceback \(most recent call last\):/)) { ttag=substr(c,1,RSTART-1); sub(/[[:space:]]+$/,"",ttag); if (chk_awt!="" && tb_ch[chk_awt]=="awaiting-traceback") { had_bk=(bk>0); had_rk=(cur_rank!=""); if (!had_bk && tb_bk[chk_awt]>0) { bk=tb_bk[chk_awt]; bt=tb_bt[chk_awt] } if (cur_host=="") cur_host=tb_host[chk_awt]; if (cur_inst=="") cur_inst=tb_inst[chk_awt]; if (cur_grp=="") cur_grp=tb_grp[chk_awt]; if (cur_pid=="") cur_pid=tb_pid[chk_awt]; if (!had_rk) { cur_rank=tb_rank[chk_awt]; cur_rstr=tb_rstr[chk_awt] } if (cur_wid=="") cur_wid=tb_wid[chk_awt]; if (tb_id=="") { if (ttag=="") { ttag=tb_tag[chk_awt] } else { pre_ch=tb_tag[chk_awt]; sub(/[[:space:]]*(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT):?[[:space:]]*$/,"",pre_ch); if (pre_ch==""&&!had_bk&&bt!="") pre_ch=bt; if (pre_ch!="") ttag=pre_ch " " ttag } } else { pfx_c=""; if (!had_bk&&bt!=""&&index(ttag,bt)==0) pfx_c=bt; if (!had_rk&&cur_rstr!="") pfx_c=(pfx_c!=""?pfx_c " " cur_rstr:cur_rstr); if (pfx_c!="") ttag=(ttag!=""?pfx_c " " ttag:pfx_c) } tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } else if (chk_awt!="") { tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } k0=++tb_seq; tb_fn[k0]=fn; tb_open[k0]=1; tb_ord[k0]=++ord_clk; tb_bk[k0]=bk; tb_bt[k0]=bt; tb_tag[k0]=ttag; tb_pid[k0]=cur_pid; tb_host[k0]=cur_host; tb_inst[k0]=cur_inst; tb_grp[k0]=cur_grp; tb_rank[k0]=cur_rank; tb_wid[k0]=cur_wid; tb_rstr[k0]=cur_rstr; tb_ch[k0]=""; last_tb[fn]=k0; next } if (is_chain) { if (lk!="") { tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]="" } if (chk_awt!="" && (tb_ch[chk_awt]=="awaiting-marker" || tb_ch[chk_awt]=="awaiting-traceback")) { tb_ch[chk_awt]="awaiting-traceback"; tb_ord[chk_awt]=++ord_clk; last_ch[fn]=chk_awt } next } if (c ~ /(^|[^[:alnum:]_])File ".*", line [0-9]+/) { if (lk!="") { tb_ord[lk]=++ord_clk; last_tb[fn]=lk } next } c_code=c_trim; gsub(/\((pid|tid|uid|gid|rank)[[:space:]]*[:=][[:space:]]*[0-9]+\)/,"",c_code); gsub(/^[[:space:]]+|[[:space:]]+$/,"",c_code); is_code_pref=(!has_pref || (c_code ~ /^[A-Za-z_][A-Za-z0-9_]*$/ || c_code ~ /^((raise|assert|if|elif|for|while|with|return|await|yield|import|from|del|global|nonlocal)([^[:alnum:]_]|$)|(else|try|finally|pass|break|continue):?[[:space:]]*$|[~^[:space:]]*[~^]+[~^[:space:]]*$)/ || c_code ~ /[]~[(=:+*\/<>{}@,"\047^]/ || c_code ~ /(\.[A-Za-z_0-9]|\.\.\.)/)); is_ind=(!is_log_hdr && !is_chain && !(has_pref && is_term) && is_code_pref && (c ~ /^[[:space:]]{4,}/ || c ~ /(\]|\]:|\))[[:space:]]{4,}/ || (bk==0 && c_np ~ /^[[:space:]]{3,}/))); if (is_ind && (lk!="" || c_np ~ /^[[:space:]]*(raise |assert |if |elif |else:|for |while |return |[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[^=])/)) { if (lk!="") { tb_ord[lk]=++ord_clk; last_tb[fn]=lk } next } row_disp=raw; if (!is_ind && lk!="" && is_term) { pfx_add=""; if (bk==0) { bk=tb_bk[lk]; bt=tb_bt[lk]; if (bt!="") pfx_add=bt } if (tb_id!="") { if (cur_rank=="" && tb_rstr[lk]!="") pfx_add=(pfx_add!="" ? pfx_add " " tb_rstr[lk] : tb_rstr[lk]); if (pfx_add!="") { c=pfx_add " " c; row_disp=gpref c } } else if (tb_tag[lk]!="") { if (c!=c_trim && !(tb_tag[lk] ~ /(ERROR|CRITICAL|FATAL):?[[:space:]]*$/)) { c=tb_tag[lk] " " c } else { c=tb_tag[lk] " " c_trim } row_disp=gpref c } tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]=""; tb_ch[lk]="awaiting-marker"; tb_bk[lk]=bk; tb_bt[lk]=bt; tb_ord[lk]=++ord_clk; last_ch[fn]=lk; } else if (!is_ind) { if (lk!="") { tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]="" } if (chk_awt!="") { tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } } ci=c; if (!(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) { gsub(/(([Pp]arent|[Cc]hild|[Ss]ub)?[[:space:]]*([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?))([[:space:]]+([Ww]orker|[Pp]rocess|id=[0-9]+|#[0-9]+|[0-9]+|\([^)]*pid=[^)]*\)|\[[^]]*\])){0,3}[[:space:]]+exited[[:space:]]+(normally|cleanly|with[[:space:]]+(exit[[:space:]]*)?(code|status)[[:space:]]*[:=]?[[:space:]]*0([^0-9]|$))/, " ", ci); gsub(/(^|[^[:alnum:]_])(no|not|without|0|zero)[[:space:]]+([A-Za-z0-9_]+[[:space:]]+)?([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?)s?[[:space:]]+(crashed|exited|died|killed|terminated|aborted|dead|failed|failure|denied|refused)([^[:alnum:]_]|$)/, " ", ci); gsub(/([Ww]atchdog([[:space:]_-]+(started|initialized|enabled|configured))?([[:space:]_-]+with)?[[:space:]_-]+([Cc]onfigured[[:space:]]+)?|[Cc]onfigured[[:space:]]+)[Tt]imeout[[:space:]]*([:=]|set([[:space:]]+to)?|of|is|configured([[:space:]]+to)?)[[:space:]]*[0-9]+[A-Za-z]*/, " ", ci); gsub(/[Ww]atchdog[[:space:]]+(started|initialized|enabled|disabled|configured|ready|alive)([^[:alnum:]_]|$)/, " ", ci); gsub(/CheckSmmuFault[^.,;\n]*isSmmuFault([[:space:]]+is|[[:space:]]*[:=])[[:space:]]*0([^0-9]|$)[[:space:].,;]*/, "", ci) } cn=clean_meta(ci); if (is_ind && !(cn ~ fp || c ~ /([A-Za-z_][A-Za-z0-9_.]*\.)?([A-Z][A-Za-z0-9_]*)?(Error|Exception|Fault)[:(]/)) next; has_cas=(ci ~ /(EI0002|HCCL_E_WAIT_TIMEOUT|The wait execution of the Notify register times out\.?|Notify (register )?wait( execute| execution)? timeout|[Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout)/); s=ci; gsub(/([Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout([[:space:]]+group[[:space:]_:-]*[A-Za-z0-9_.-]+)?[[:space:]:,;.-]*|((HCCL|RUNTIME|ASCENDCL)[[:space:]:,;-]+)?(The wait execution of the Notify register times out\.?|Notify (register )?wait( execute| execution)? timeout|HCCL_E_WAIT_TIMEOUT|EI0002)[[:space:].,!-]*)([[:space:]]*[,:;]?[[:space:]]*([Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout[[:space:]:,;.-]*|((HCCL|RUNTIME|ASCENDCL)[[:space:]:,;-]+)?(The wait execution of the Notify register times out\.?|Notify (register )?wait( execute| execution)? timeout|HCCL_E_WAIT_TIMEOUT|EI0002|[Ww]ait(ing)? for rank [0-9]+|((in|during|on|of|at|for|when|while)[[:space:]]+(((the|a|an)[[:space:]]+)?(HCCL|collective)[[:space:]]+)?([Aa]ll[Rr]educe|[Aa]ll[Gg]ather|[Rr]educe[Ss]catter|[Aa]ll[Tt]o[Aa]ll|[Bb]roadcast|[Rr]educe|[Ss]catter|[Gg]ather|[Ss]end|[Rr]ecv|op(eration)?s?|comm(unication)?s?|[Cc]ollective([[:space:]]+(op(eration)?|comm(unication)?))?)([[:space:]]+group[[:space:]_:-]*[A-Za-z0-9_.-]+)?[[:space:].,!-]*))))*/, "", s); sc=s; gsub(/\[([Ff][Uu][Nn][Cc]|[Ff][Ii][Ll][Ee]|[Ll][Ii][Nn][Ee]|[Pp][Ii][Dd]|[Tt][Ii][Dd]|[Tt][Hh][Rr][Ee][Aa][Dd]|[Mm][Oo][Dd][Uu][Ll][Ee]|[Dd][Ee][Vv]([Ii][Cc][Ee])?_?[Ii][Dd]|[Rr][Aa][Nn][Kk]|[Nn][Oo][Dd][Ee]|[Hh][Oo][Ss][Tt]):[^]]*\]/, " ", sc); gsub(/(\[|\()Worker_[^)\]]*(\]|\))/, " ", sc); gsub(/(\[|\()[A-Za-z0-9_]*EngineCore[^)\]]*(\]|\))/, " ", sc); gsub(/(\[|\()APIServer[^)\]]*(\]|\))/, " ", sc); gsub(/\[([Nn]ode|[Hh]ost|[Rr]ank)[[:space:]_:-]*[^]]*\]/, " ", sc); gsub(/\([Rr]ank[[:space:]_:=]*[0-9]+\)/, " ", sc); gsub(/\[[A-Za-z0-9_.\/-]+\.(py|cc|cpp|h|hpp):[0-9]+\]/, " ", sc); gsub(/[A-Za-z0-9_.\/-]+\.(py|cc|cpp|h|hpp):[0-9]+/, " ", sc); gsub(/(RUNTIME|HCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\([0-9]+,[^)]*\)/, " ", sc); wtmp=""; wr=sc; while(match(wr,/WorkHCCL\(([^()]|\([^()]*\))*\)/)){wseg=substr(wr,RSTART,RLENGTH);wchk=wseg;gsub(/(^|[,[:space:]\(])(SeqNum|seq_?num|OpType|AlgType|Count|DataType|ReduceOp|Root|Tag|Group|Comm|Stream|Plane|Rank|LocalRank|DataSize)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_.-]+/,"",wchk);gsub(/(^|[,[:space:]\(])(Timeout|timeout|notifyWaitTime|retryHoldTime|retryIntervalTime|linkTimeOut)([[:space:]]*\([^)]*\))?[[:space:]]*[:=][[:space:]]*[0-9]+([A-Za-z_]*|[[:space:]]*(ms|us|s|sec))?/,"",wchk);wkeep=(wchk ~ fp || tolower(wchk) ~ /(^|[^[:alnum:]_])(err(or)?|errno|ret_?code|fault|fail(ed|ure)?|invalid|refus(ed)?|reset|denied|out[[:space:]]+of[[:space:]]+memory|oom|timeout|timed[[:space:]]+out|unreachable|mismatch|broken|abort|killed|crash)([^[:alnum:]_]|$)/);wtmp=wtmp substr(wr,1,RSTART-1) (wkeep?wseg:" ");wr=substr(wr,RSTART+RLENGTH)} sc=wtmp wr; gsub(/([A-Za-z_][A-Za-z0-9_.]*\.)?([A-Za-z_][A-Za-z0-9_]*)?(Error|Exception|Fault):[[:space:]]*([.,;:!\-]*[[:space:]]*($|;))/, ";", sc); sn=clean_meta(sc); rem=sn; gsub(/[A-Za-z_][A-Za-z0-9_]*=[^[:space:];)]+/, " ", rem); gsub(/ /, "  ", rem); gsub(/(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|EVENT|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[Hh]ost[[:space:]_:-]*[A-Za-z0-9_.-]+|group[[:space:]_:-]+(tp|dp|pp|ep|cp|sp|hccl|world|comm|[0-9]+)[A-Za-z0-9_.-]*|(dp|tp|pp|ep|cp|sp|dcp|pcp)[[:space:]_:-]*[0-9]+|HCCL|RUNTIME|ASCENDCL|GE|DRV|AICPU|pid|tid|dp|tp|pp|ep)([^[:alnum:]_]|$)/, " ", rem); gsub(/[^[:alpha:]]+/, "", rem); term_tok=c_trim; sub(/[:[:space:]].*$/,"",term_tok); term_ok=(is_term && !is_log_hdr && term_tok!="" && index(ci,term_tok)>0); has_err=(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL|WARN|WARNING)([^[:alnum:]_]|$)/ || ci ~ /(^|[^[:alnum:]_])([A-Za-z_][A-Za-z0-9_.]*\.)?([A-Z][A-Za-z0-9_]*)?(Error|Exception|Fault|Interrupt|Exit):/ || term_ok); z_ei=((ci ~ /((EI000[2469]|EJ0001)(([^0-9a-zA-Z]|_)*(count|cnt|total|num|hits|errors?))?[[:space:]]*[:=][[:space:]]*0([^0-9]|$)|(EI000[2469]|EJ0001)[^\r\n]{0,40}(^|[^[:alnum:]_])(count|cnt|total|num|hits|errors?)[[:space:]]*[:=][[:space:]]*0([^0-9]|$))/) && !(ci ~ /((EI000[2469]|EJ0001)(([^0-9a-zA-Z]|_)*(count|cnt|total|num|hits|errors?))?[[:space:]]*[:=][[:space:]]*[1-9]|(EI000[2469]|EJ0001)[^\r\n]{0,40}(^|[^[:alnum:]_])(count|cnt|total|num|hits|errors?)[[:space:]]*[:=][[:space:]]*[1-9]|(ret|ret_?code|err_?code|dev_?ret_?code|status|errno)[[:space:]]*[:=][[:space:]]*(-?[1-9][0-9]*|0x0*[1-9a-fA-F]))/) && !(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/) && !(ci ~ cfp) && !(ci ~ /(timed[[:space:]]+out|times[[:space:]]+out|TimeoutError|Getting socket times out|\[Wait\]\[LinkEstablish\]|Notify wait|The wait execution|ranktable|transport init|HCCP init|failed|FAIL|refused|reset|lost|unreachable|mismatch|abort|broken|hang|blocked)/) && !term_ok); if (z_ei) next; if ((s ~ /(^|[^[:alnum:]_])(count|errors?)[[:space:]]*[:=][[:space:]]*0([^0-9]|$)/ && s ~ /(^|[^[:alnum:]_])(INFO|health|success)([^[:alnum:]_]|$)/) && !(sn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/ || sn ~ cfp || s ~ /(timed[[:space:]]+out|times[[:space:]]+out|timeout|failed|FAIL|refused|reset|lost|unreachable|mismatch|abort|broken|hang|blocked)/)) next; if (has_cas && !(sn ~ fp || (has_err && rem ~ /[[:alpha:]]/))) next; if (c ~ /(^|[^[:alnum:]_])INFO([^[:alnum:]_]|$)/ && !(sn ~ fp || sn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) next; if (c ~ /RaSocket/ && c ~ /(^|[^[:alnum:]_])success([^[:alnum:]_]|$)/ && !(sn ~ fp)) next; if (!(cn ~ fp || term_ok || has_cas || cn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) next; yr=""; md="99-99"; hms="99:99:99"; frac="000000000"; tzp=""; sh=0; inv_dt=0; if (match(bt, /([Zz]|[+-][0-9]{2}:?[0-9]{2})$/)) { tzp=substr(bt,RSTART,RLENGTH); bt=substr(bt,1,RSTART-1) } if (tzp!="") has_tzaware=1; else if (bk>=1 && bk<=4) has_tzless_ts=1; if (bk==1) { yr=substr(bt,1,4); mo=substr(bt,6,2); dy=substr(bt,9,2); hms=substr(bt,12,8); if (length(bt)>19) { frac=substr(bt,21); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(yr+0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1; md=mo "-" dy } else { has_dated=1; if (tzp!="") { u=to_utc(yr+0,mo+0,dy+0,hms,tzp); yr=substr(u,1,4); mo=substr(u,6,2); md=substr(u,6,5); hms=substr(u,12,8) } else { md=substr(bt,6,5) } } } else if (bk==2) { mo=substr(bt,2,2); dy=substr(bt,4,2); md=mo "-" dy; hms=substr(bt,7,8); if (length(bt)>14) { frac=substr(bt,16); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1 } else { has_dated=1; has_short=1; if (mo=="12") has_yl_dec=1; if (mo=="01") has_yl_jan=1 } } else if (bk==3) { mo=substr(bt,1,2); dy=substr(bt,4,2); md=substr(bt,1,5); hms=substr(bt,7,8); if (length(bt)>14) { frac=substr(bt,16); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1 } else { has_dated=1; has_short=1; if (mo=="12") has_yl_dec=1; if (mo=="01") has_yl_jan=1 } } else if (bk==4) { has_timeonly=1; hms=substr(bt,1,8); if (length(bt)>8) { frac=substr(bt,10); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } sec=int(substr(hms,1,2))*3600+int(substr(hms,4,2))*60+int(substr(hms,7,2)); if (tzp!="") { off=tz(tzp); sec-=off; sh=int(sec/86400); if (sec<0 && sec%86400!=0) sh--; sec-=sh*86400; hms=sprintf("%02d:%02d:%02d",int(sec/3600),int((sec%3600)/60),sec%60) } to_s=sh*86400+sec; to_ms=int((frac+0)/1000000); if (!has_to_span) { has_to_span=1; min_to_s=to_s; min_to_ms=to_ms; max_to_s=to_s; max_to_ms=to_ms } else { if (to_s<min_to_s||(to_s==min_to_s&&to_ms<min_to_ms)){min_to_s=to_s;min_to_ms=to_ms} if (to_s>max_to_s||(to_s==max_to_s&&to_ms>max_to_ms)){max_to_s=to_s;max_to_ms=to_ms} } yr=sprintf("%04d", 9998+sh) } else { yr="9999"; frac="999999999" } bks[++n]=bk; invs[n]=inv_dt; shs[n]=sh; yrs[n]=yr; rest[n]=md "-" hms "." frac; tzs[n]=(bk==2||bk==3)?tzp:""; has_tz[n]=(tzp!=""); rows[n]=row_disp } END { to_wrap=(has_to_span && (max_to_s-min_to_s>43200 || (max_to_s-min_to_s==43200 && max_to_ms>min_to_ms))); amb_short=(has_short && min_yr!="" && max_yr!="" && min_yr!=max_yr); if (has_dated && has_timeonly) printf "0000-00-00-WARN_MIXED_DATE_SCOPE\t[WARN] mixed dated and time-only logs: time-only records cannot be ordered against dated logs (see ~UNORDERED_TIME_ONLY rows)\n"; if (!has_dated && to_wrap) printf "0000-00-00-WARN_MIXED_TIMEONLY_SPAN\t[WARN] time-only logs span >12h without dates: possible midnight rollover makes order ambiguous (see ~UNORDERED_TIME_ONLY rows)\n"; if (has_tzaware && has_tzless_ts) printf "0000-00-00-WARN_MIXED_TZ_SCOPE\t[WARN] mixed tz-aware and naive logs: timezone-less rows cannot be normalized to UTC alongside Z/offset logs (see ~UNORDERED_NAIVE_TZ rows)\n"; if (amb_short) printf "0000-00-00-WARN_MIXED_SHORTDATE_YEAR\t[WARN] short-date logs mixed with multi-year dated logs: year cannot be inferred uniquely (see ~UNORDERED_SHORT_DATE rows)\n"; printed_inv=has_inv_dt; if (has_inv_dt) printf "0000-00-00-WARN_MIXED_INVALID_DATE\t[WARN] invalid calendar date cannot be ordered chronologically (see ~UNORDERED_INVALID_DATE rows)\n"; for(i=1;i<=n;i++){ if (invs[i]) { k=sprintf("~UNORDERED_INVALID_DATE(%s-%s)", (yrs[i]!=""?yrs[i]:"XXXX"), rest[i]); printf "%s\t%s\n", k, rows[i]; continue } if (yrs[i]!="") { y=yrs[i] } else { mo=substr(rest[i],1,2); if (min_yr!="") { if (amb_short) y="0000"; else if (has_d_dec[max_yr] && !has_d_jan[max_yr] && mo+0<=6) y=sprintf("%04d", max_yr+1); else if (has_d_jan[min_yr] && !has_d_dec[min_yr] && mo+0>=7) y=sprintf("%04d", min_yr-1); else y=min_yr } else { y=(has_yl_dec && has_yl_jan && mo+0<=6) ? "0005" : "0004" } } if (amb_short && (bks[i]==2 || bks[i]==3)) { k=sprintf("~UNORDERED_SHORT_DATE(%s)", rest[i]) } else if ((bks[i]==2 || bks[i]==3) && min_yr!="" && !valid_md(y+0,substr(rest[i],1,2)+0,substr(rest[i],4,2)+0)) { if (!printed_inv) { printed_inv=1; printf "0000-00-00-WARN_MIXED_INVALID_DATE\t[WARN] invalid calendar date cannot be ordered chronologically (see ~UNORDERED_INVALID_DATE rows)\n" } k=sprintf("~UNORDERED_INVALID_DATE(%s-%s)", y, rest[i]) } else if (tzs[i]!="") { k=to_utc(y+0,substr(rest[i],1,2)+0,substr(rest[i],4,2)+0,substr(rest[i],7,8),tzs[i]) "." substr(rest[i],16) } else if ((has_dated || to_wrap) && bks[i]==4) { k=sprintf("~UNORDERED_TIME_ONLY(d%d-%s.%s)", 1+shs[i], substr(rest[i],7,8), substr(rest[i],16)) } else if (has_tzaware && bks[i]>=1 && bks[i]<=4 && !has_tz[i]) { k=sprintf("~UNORDERED_NAIVE_TZ(%s-%s)", y, rest[i]) } else { k=y "-" rest[i] } printf "%s\t%s\n", k, rows[i] } }' | LC_ALL=C sort -s -t $'\t' -k1,1 | awk '{ if ($0 ~ /^0000-00-00-WARN_MIXED_/) { w[++wc]=$0; next } if ($0 ~ /^~UNORDERED_/) { u[++uc]=$0; next } d[++dc]=$0 } END { max_r=40; p=0; for(i=1;i<=wc && p<max_r;i++){ print w[i]; p++ } avail=max_r-p; u_res=(uc<5?uc:5); dlim=(uc>0 && dc+uc>avail)?(avail-u_res):avail; if (dlim<0) dlim=0; for(i=1;i<=dc && i<=dlim && p<max_r;i++){ print d[i]; p++ } for(i=1;i<=uc && p<max_r;i++){ print u[i]; p++ } }'

# 3. 退出码 137 先查主机/容器 DRAM OOM，而非先砍 NPU KV
dmesg -T | grep -iE "killed process|oom-killer" | tail -n 20

# 4. 运行期采集核心 Prometheus /metrics（分流 KV 抢占风暴 vs 低 KV 高延迟）
curl -s http://127.0.0.1:8000/metrics | grep -E "vllm:(kv_cache_usage_perc|num_requests_running|num_requests_waiting|num_preemptions|time_to_first_token_seconds|inter_token_latency_seconds)"
```

对于“请求能执行，但不知道在哪段等待”的问题，可从[贯穿样例的最小取证步骤](inference-performance-walkthrough.md#怎么开)开始；启动失败或输出分歧仍按本页相应分支取证。

### 会报什么错

报错字符串、调用栈、进程退出、流内错误都保留原文及前后上下文。在 `v0.30.0` 中可直接按关键报错锚定阶段：

| 报错或指标特征 | 对应代码边界 | 下一步优先核对 |
| --- | --- | --- |
| `Free memory on device (...) on startup is less than desired` | `worker.py` `init_snapshot` 预检失败 [C1] | `npu-smi info` 查残余进程或调低 `--gpu-memory-utilization` |
| `NPU out of memory` 发生在 `capture_model()` 捕获期（KV 池建立之后） | KV 池建立后、图捕获过程中（如 `FULL` `1/35` `device_op.py:216` FIA）吃空 $F - u \times T$ 余量（`capture_model()` 内部抛异常中断，不会走到后续建议字节日志）[C3][M27] | 适度下调 `u`（如 `0.82`）；若未在录图失败中断（含 `--enforce-eager` 跳录图）需固化字节预算，传正式 CLI 参数 `--kv-cache-memory-bytes`（日志误印 `--kv-cache-memory=`，来源 41） |
| `FRACTAL_NZ mode is enabled.`（`wake_up` 失败） | `worker.py:279-286` 唤醒守卫拦截非零 `weight_nz_mode` [C28][M27] | 传 `--additional-config '{"weight_nz_mode":0}'` 或开启 `rl_config.enabled` |
| `Prefill TP size must be divisible by Decode TP size.` | `ascend_config.py:879-884` 普通 PD 分离整除校验触发外层 `pydantic_core.ValidationError`（`type=assertion_error`）[C31][M27] | 对齐两端 `tp_size` 使 `prefill_tp_size % decode_tp_size == 0`（Prefill TP 能被 Decode TP 整除） |
| `Mooncake worker requires exactly one KV transfer role` | `mooncake/base_worker.py:116` 拒绝 `kv_both` 双角色 [C32][M27] | 将 P/D 实例分别设为 `kv_producer` 或 `kv_consumer` |
| 多卡刷屏 `EI0002`（执行期 Notify 等待超时）/ `EI0006`（建链阶段 Socket 超时）/ `HCCL_E_WAIT_TIMEOUT` | 集合通信等待或建链超时（当 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS < 1836` 时，在 `v0.23.0`、`v0.30.0` 与 `main` 上由平台抬高至 `3000s`，`v0.26.0rc` 无该抬升而沿用上游 `300s` 默认，分别见来源 4、40 及来源 45–46）[C4][S39] | 合并全组各节点日志/plog 锁定最早出错的**首错 Rank**，全组干净再查网络（勿将启动自检打印 `1836s` 误当报错） |
| `EngineCoreProc` 退出码 `-9` / `137` (`SIGKILL`) | `utils.py` 回收子进程 `exitcode` [C12] | 先查宿主机 `dmesg` 与容器 `OOMKilled`，勿直接认定 NPU HBM OOM |
| `AscendFAImpl does not support ACL graph capture` | `fa3_v1.py` 禁止 FA3 + `FULL_DECODE_ONLY` [C9] | 改用默认 FIA 后端，或为 FA3 改用 `PIECEWISE` / `--enforce-eager` |
| `The current GQA‑related models adopt static quantization` | `attention_v1.py:583` 未量化 GQA 传 `int8` 缺少静态校准 scale（含 `U+2011` `‑`）[C8][M27] | 换带 C8 校准的 ModelSlim 权重，或移除 `--kv-cache-dtype int8`（区分 `ascend_config.py:1030-1042` 独立传输保护） |
| `kv_cache_usage_perc` 高企 + `num_preemptions` 递增 | `scheduler.py` 运行中请求 `allocate_slots(...)` 返回 `None`，无 `connector.has_pending_block_frees()` 待释块且候选请求 `_request_blocks_can_be_freed` 为真时才触发 `#L787` 抢占（块不可释或等待队列 `#L1173-1180` 分配失败均直接跳出，来源 42、44），`loggers.py` 导出观察指标 [C15] | 收紧 `--max-num-seqs` 或扩容 KV 池（若存在挂起 connector 释块需一并排查 KV 传输反压）[D] |
| 留着 `VLLM_LOGGING_LEVEL=DEBUG` 出现首字延迟退化 | `worker.py:762-778` 每步分配器统计日志 + `acl_graph.py:275-281` `data_ptr()` 核对 [C29][M26] | 线上与基准测试恢复 `VLLM_LOGGING_LEVEL=INFO` |
| `EI0002`（执行期 Notify 等待超时：`The wait execution of the Notify register times out.` / `Notify wait execute timeout`）与 `EI0006`（建链阶段 Socket 超时：`Getting socket times out` / `[Wait][LinkEstablish]`） | `EI0002` 为通信算子执行期等待超时；`EI0006` 为通信域建链阶段 Socket 超时（既可是网卡/路由/防火墙问题，也可是对端 Rank 在初始化完成前早退引发的次生建链超时），二者均需与 `EI0004` / `EI0009` / `EJ0001` / `RaSocketConnect` 区分（来源 39） | `EI0002` 优先合并全组日志锁定执行期首错 Rank；`EI0006` 先排除对端早退，再排查建链网卡、路由与端口，转 [CANN 与 HCCL](cann-hccl.md) 与 [引擎进程与网卡配置](engine-processes.md) |
| `EZ3002` / `EZ3003` / `BackendCompilerFailed` / `There was no fake impl registered` | 图编译、Dynamo `fullgraph` 中断、算子选择或自定义算子 Meta 形状推导失败 | 区分编译/tiling 失败与执行期 `507015` 硬件异常；转 [编译图融合](npugraph-ex.md) 与 [自定义算子开发](dev-new-model-and-custom-op.md) |
| `507008`（`ACL_ERROR_RT_SOC_VERSION`）/ `107002`（`ACL_ERROR_RT_CONTEXT_NULL`）/ `drvGetDevInfo` / `/dev/davinci_manager` / `libascend_hal.so` | `107002` 表示当前 Runtime 上下文为空（须先核查失败所处 API 阶段及是否已通过 `aclrtSetCurrentContext` / `aclrtSetDevice` 绑定上下文，再核容器设备挂载）；`507008`、`drvGetDevInfo`、`/dev/davinci_manager` 与 `libascend_hal.so` 指向驱动 HAL 或容器设备栈初始化阻断（来源 34） | 遇到 `107002` 先确认报错 API 阶段与上下文绑定，再检查容器 `/dev/davinci*` 挂载与宿主机驱动；`507008` / HAL 异常优先核对宿主机驱动与容器四件套挂载；转 [昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md) |
| `EL0004: Failed to allocate memory.` | 底层内存分配失败（须结合日志区分设备 HBM 与主机内存） | 优先排查显存/主机内存余量，单凭该码不断言驱动不兼容；转 [设备内存](device-memory.md) |

只有“超时”“OOM”等摘要时，还缺阶段、对象与现场版本，先补齐再查已知修复。

### 开销和什么时候别开

状态重置、取消、图切换和故障注入放在隔离复现环境。线上先采最小观察窗口；恢复服务与查根因分别记录，临时缓解（如临时加 `--enforce-eager` 绕过图捕获）不能代替原配置修复验收。

### 版本差异

以下四版本核验矩阵对齐社区 `vllm-ascend` 与配套上游 `vLLM` 的排障关键边界（历史 GLM-5.3-Flash 双机镜像 `db701c1f` / `0fc695fc` 作为历史双机对照算例另行标注）：

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
| --- | --- | --- | --- | --- |
| **启动显存与图捕获边界** | `init_device` / `determine_available_memory` 基础快照与探测（来源 19） | 延续六步骨架并引入基础 `kernel_warmup`（来源 20） | 区分 `init_snapshot` 预检、试跑峰值与 `capture_model()` 后的建议 `--kv-cache-memory` 打印，且 `310P` 归入 `HardwareProfile` 兼容档位（来源 1–3、10） | 延续六步探测与建议字节打印；`worker.py` 行号上移且预热转向声明式注册表（来源 21） |
| **配置校验与静默降级** | 以手写字段校验为主，部分未知键易被静默忽略 | 逐步收紧 `additional_config` 校验 | `AscendConfig` 采用 Pydantic `extra="forbid"`，未装 `vllm_omni` 时严格拒未知键；若 `vllm_omni` 可被 `find_spec` 发现则对未知顶层键仅警告并剥离后继续启动，同时按硬件能力自动降级关闭 `npugraph_ex` / `static_kernel` / `super_kernel`（来源 5–6、47、49） | 延续上述校验逻辑（含 `vllm_omni` 共存剥离，来源 48）与硬件能力降级 |
| **HCCL 超时与进程退出** | `platform.py` 在 `< 1836s` 时将 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` 抬高至 `3000s`（来源 40） | `platform.py` 无自动抬升，沿用上游 `vllm/envs.py` 默认 `300s`（`multiproc_executor.py#L318` 直接读取该值，来源 45–46）与多进程退出上报 | 延续在 `< 1836s` 时将 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` 抬高至 `3000s` 覆盖 `1836s` 算子超时；上游 `utils.py` 汇总子进程 `exitcode`（来源 4、12） | 延续 `3000s` RPC 超时保护与子进程退出回收（来源 22–23） |
| **运行期指标与收尾** | 具备基础调度队列与请求结束释放入口（来源 25） | 扩展 v1 引擎指标与中断链路 | `loggers.py` 导出 `kv_cache_usage_perc`、`num_requests_waiting`、`num_preemptions` 及 TTFT/ITL 直方图；`scheduler.py` 与 `async_llm.py` 负责取消与块释放（来源 13–16） | 延续 v1 指标与取消释放链路 |

具体版本行为由链接的机制页维护；本页的诊断步骤仍须在现场版本和负载下验证。

### 源码位置

- **启动预检与 Runner 初始化（`vllm_ascend/worker/worker.py`，来源 1–3、28–29、50–51）**：`init_snapshot` 完成初始空闲显存预检。初始化按标志分流（`#L516` 创建 MRV1 `NPUModelRunner`；`#L514` 创建 MRV2 `NPUModelRunner`）。MRV1 继承上游缓冲实现，按 `max_num_batched_tokens` 预建 `inputs_embeds` 与 `is_token_ids`。对应锚点为 `vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L550,#L851-L854`（来源 54–55）。MRV2 在 `worker/v2/model_runner.py#L252` 构建 `AscendInputBuffers`（来源 52）。
- **权重加载与 LoRA 索引建表（`worker.py#L865`，来源 43、51–53、56–57）**：MRV1 在 `model_runner_v1.py#L4476` 打印 `Loading model weights took`（来源 43）。MRV2 在 `worker/v2/model_runner.py#L305` 调上游加载器打印 `Model loading took`。该日志位于 `vllm@ced6857a:vllm/v1/worker/gpu/model_runner.py#L429`（来源 52–53）。MRV1 开 LoRA 时先经 `model_runner_v1.py#L4473-L4474` `load_lora_model` 与 `punica_npu.py#L24` 建表。其按 `max_num_batched_tokens` 建 4 个索引张量（来源 43、56–57）。锚点见 `vllm@ced6857a:vllm/lora/punica_wrapper/punica_base.py#L138-L149`。
- **显存试跑、图捕获、Sleep 守卫与分配器日志（来源 1–3、28–30、33、41）**：`determine_available_memory()` 在显式 `--kv-cache-memory-bytes` 分支（`#L583`）与常规量测峰值分支（`#L605`）均调 `profile_run()`。`compile_or_warm_up_model()` 成功录图后打印推荐字节日志，正式 CLI 参数为 `--kv-cache-memory-bytes`（来源 41）。`wake_up()` 拦截非零 `weight_nz_mode`，`execute_model()` 含 `DEBUG` 分配器读数日志。`device/device_op.py`（来源 33）与 `compilation/acl_graph.py`（来源 30）分别对应 `FULL` 图捕获 FIA 调用栈与回放 `data_ptr()` 校验。
- **调度抢占退出与硬件档位（来源 10、42、44）**：`scheduler.py` 运行中抢占退出条件（`#L756-795`）见来源 42。等待队列分配失败直接退出（`#L1173-1180`）见来源 44。`device/hardware_profile.py`（来源 10）划分 `310P` 兼容硬件档位。
- **配置、PD 分离、图捕获与量化兼容硬报错**：`vllm_ascend/ascend_config.py`（来源 5–7、31、47–49）包含 `NPUGRAPH_EX` 硬件降级、`extra="forbid"` 未知键校验（`init_ascend_config` 在发现 `vllm_omni` 时对未知顶层键先警告剥离再继续构建，见 `c09d3e20#L1895-1914`、`8d6180e2#L2018-2029` 与单测 `test_ascend_config.py#L2032-2052`，来源 47–49）、普通 PD `TP_P % TP_D == 0` 整除断言（外层抛 `pydantic_core.ValidationError` `type=assertion_error`）与 `MooncakeConnector` 禁配 GQA C8；`mooncake/base_worker.py`（来源 32）校验单一 KV 传输角色；`attention_v1.py`（来源 8）与 `fa3_v1.py`（来源 9）分别负责 GQA+C8 校准校验与 FA3 `FULL_DECODE_ONLY` 拦截。
- **分布式超时、进程退出、收尾与 `/metrics`**：`vllm_ascend/platform.py`（来源 4、`v0.23.0` 来源 40）与 `utils.py`（来源 11）维护 `< 1836s` 时抬高至 `3000s` 的 RPC 超时与通信组缓冲配置，`v0.26.0rc` 沿用上游 `vllm/envs.py#L1673-L1677` 默认 `300s` 并由 `multiproc_executor.py#L318` 消费（来源 45–46）；`vllm/v1/engine/utils.py`（来源 12）、`scheduler.py`（来源 13）、`async_llm.py`（来源 14）与 `metrics/loggers.py`（来源 15–16）覆盖子进程退出码、取消释放与 Prometheus 指标定义。
- **官方文档、历史快照与 `Ascend 910B3` 真机标本**：官方 Profiling 指南 [S17]、FAQ [S18]、AscendCL Runtime 返回码参考（来源 34）、`aclnn` 返回码参考（来源 38）与 CANN 9.0 HCCL 错误码参考（来源 39，区分执行期 Notify 等待超时 `EI0002` 与参数面建链超时 `EI0006`）[S39]提供采集与错误码定义索引，算子参数校验码 `161002`、图模式 `rtMemcpy` `107030` 发布说明与 AI Core `507015` 实证约束分别见来源 35–37；`v0.23.0` / `v0.26.0rc` / `main` 对照来源为来源 19–23，GLM 双机历史参考为来源 24–25；`Ascend 910B3` 八卡扩展、`DEBUG` 延迟对照与五份真机故障标本归档于来源 26–27 [M26][M27]。
- **方法论与示意边界**：十域分流和判别实验是基于既有机制组织的诊断方法 [I]；请求 R 的时间与步骤号、多卡交错时间轴图及工作台 6 类阻塞时序对照视图均为教学示意 [A]，不代表目标硬件实测耗时。
