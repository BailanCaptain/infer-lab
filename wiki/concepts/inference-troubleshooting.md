---
id: inference-troubleshooting
title: 推理排障入口：先找到问题发生在哪一步
type: concept
origin: direct
legacyAnchors:
  现场实操双模交互式排障工作台: 现场实操：交互式排障工作台
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
  - SIGKILL
  - exitcode -9
  - '137'
  - HCCL_E_WAIT_TIMEOUT
  - plog
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
    https://docs.vllm.ai/projects/ascend/en/main/developer_guide/performance_and_debug/service_profiling_guide.html
  - 'https://docs.vllm.ai/projects/ascend/en/main/faqs.html'
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
    note: 区分首错卡引发的 EI0006 假象与真实设备网络/链路超时
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

遇到现场问题时，先读下面的一次超时排查并用工作台解析手头日志或 `/metrics`，再跳到与自己证据相符的分支即可。希望连续学习分析方法，可以先走[停顿样例](inference-performance-walkthrough.md)、[测量](inference-benchmarking.md)和[性能模型](inference-performance-analysis.md)；十类入口供需要时查阅。

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

手头已经有报错日志、多卡交错刷屏的 **`EI0006`**（昇腾 HCCL 集合通信等待超时错误码）、**退出码 `137`**（进程收到 `SIGKILL` 强制终止信号）或一份 `curl /metrics` 文本时，可以直接放进下面的交互式排障工作台。它提供两项独立视图：一是**粘贴报错日志或 `/metrics` 快照**，自动区分主故障与次生集合通信超时、定位最早异常卡并给出下一条取证命令；二是**查看 6 类典型阻塞的时序对照**，用无量纲示意相对时序快速建立读图直觉（仅用于理解阻塞机理，不替代真机 Trace）。

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

- **KV 块枯竭型（抢占重算风暴）**：`vllm:kv_cache_usage_perc` 持续超过 `0.95`，并伴随 `vllm:num_preemptions` 递增与 `vllm:num_requests_waiting > 0`。
- **低 KV 高延迟型（排除排队与容量）**：KV 使用率偏低且排队为 `0`，却出现偏高的 `inter_token_latency_seconds` 或 `time_to_first_token_seconds`。
  - **高 TTFT**：优先查长输入、[Chunked Prefill](chunked-prefill.md) 单步预算，以及是否误留 `VLLM_LOGGING_LEVEL=DEBUG` 触发每步分配器读数日志与图回放 `data_ptr()` 遍历校验（`Ascend 910B3` 上 `Qwen3-8B` `TP=8 c=1` 单样本对照下 `TTFT` 由 `139.07 ms` 升至 `193.98 ms`，`+39.48%`）。
  - **高 ITL / TPOT**：优先查是否误开 `--enforce-eager` 放大 Host 发射与同步开销（如 `Qwen3-30B-A3B` `4P4D` Eager 组合配置相对四卡混部 Graph `c=1` `TPOT` 从 `77.90 ms` 升至 `307.83 ms`），或核查 GQA 非连续共享 KV 池的整池连续化复制（Eager 轨迹已实测，线上 `FULL` 图待设备时间线闭合）与固定 `u` 扩 TP 下的负扩展（完整对账与边界见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）。

在相同负载下，只控制已定位阶段的一个变量；比较该段等待与端到端指标是否一起变化。阶段没变而汇总指标变了，先查负载与统计差异。分支实验、代价和验收条件见[性能排障](inference-performance-troubleshooting.md)。

### 内存与容量：先分清在哪个时点装不下

适用于内存不足（OOM）、运行中缓存紧张或已用内存持续增加。**先分清主机／容器限制，还是某张设备的空间不足。** 进程被终止，或没有 OOM 却伴随主机回收等待时，先用[主机与容器内存的判断方法](device-memory.md#主机还有空闲为什么容器里的进程先被终止)找限制所在层；不要仅凭退出码 `137` 就直接缩减设备 KV 缓存。

确认落在设备 NPU HBM 一侧后，沿启动到运行的四个连续时点逐段定位，并为每个出口先取对应的最小证据：

```wiki-diagram
file: troubleshooting-fig-memory-triage
```

按图中的四个出口依次核对：
- **`init_snapshot` 预检失败**：设备初始空闲显存低于 `gpu_memory_utilization × total_memory` 时直接抛 `ValueError`，多由同卡残留进程或并发混布引起；先查 `npu-smi info`。
- **权重加载 / `profile_run` 试跑期 OOM**：`profile_run()` 按 `max_num_batched_tokens` 批预算探测激活峰值，因此此阶段 OOM 意味着**权重 + 当前批预算激活峰值超限**，并不等同于“单条满长请求装不下”。应先核对加载日志并收紧 `max_num_batched_tokens` / `max_num_seqs` 复测；只有权重本身超限，或收紧批预算后分配出的 KV 池仍装不下 `max_model_len` 时，才是单条满长装不下，需要扩 TP、换量化或下调序列上限。
- **KV 池建立后的图捕获期 OOM**：发生在 `compile_or_warm_up_model()` 调用 `capture_model()` 时。通常是 `--gpu-memory-utilization`（$u$）过高，吃空了留给 ACLGraph 图池与 CANN 运行时工作区的 $1 - u$ 余量，需适度下调 $u$ 或改传日志建议的 `--kv-cache-memory`。
- **运行期 KV 枯竭与抢占**：同时记录活跃请求、长度、空闲缓存块和**抢占**（先暂停请求、让出缓存，之后再恢复或重算）次数，先区分正常池复用与持续未释块增长。

容量账见[显存探测](kv-cache-memory-profiling.md)与[设备内存](device-memory.md)。改了量化配方、模型长度或缓存格式后，还要重新记录每块的字节数、各层缓存布局及权重和临时工作区等非缓存开销。块数相同不代表可用容量相同，旧部署的块数也不能直接沿用；标准 `v0.30.0` 主基线以 `Qwen3-8B` / `Qwen3-30B-A3B` 算账口径核对，历史 GLM 双机预算见[固定部署的预算方法](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

保持模型与路径，分别控制并发或长度，观察峰值随哪种工作量增长。请求结束后再看空闲块和活动记录是否恢复：块已归还而设备内存没降，符合池保留复用；在相同负载、相同稳定时点仍不断增加的未释放资源，才继续追增长来源。沿[请求收尾](request-teardown.md)区分引用释放、池保留与缓存清空，不能仅凭设备曲线判泄漏。

### 输出与数值：先找第一处不同

适用于乱码、重复、空输出、同输入不一致、NaN（无效数值）或质量回退。保留模板展开后的输入编号、最终生效的采样参数、输出编号、原始响应和结束原因。文本、编号、分数是不同层的证据；相同输入文字并不保证模型收到的编号相同。

先比较输入，再控制采样，接着在相同前缀下比较首次分歧的位置。编号相同而显示不同，追解码与返回；编号已不同，再查采样、数值与状态。完整示例和缓存/图/量化的对照条件在[输出正确性排障](inference-correctness-troubleshooting.md)，不要从“乱码”直接跳到“量化有问题”。

### 编译、图与算子：配置启用后，实际走了什么

适用于捕获失败、频繁重新编译、图回退或形状/类型不支持。**graph mode** 把支持的执行过程先捕获后重放；**eager** 按当前步骤组织执行。收集报错前的输入形状、数据类型、编译/捕获日志、实际图模式及首次触发条件，沿[图模式分层](graph-mode-layer.md)找失败边界。

在 `v0.30.0` 下有两个高频硬边界值得首查：

- **FA3 与全图模式互斥**：FA3 注意力后端（`AscendFAImpl`）不支持与 `FULL_DECODE_ONLY` 图模式叠加，会直接抛出 `ValueError`。
- **硬件能力静默降级**：硬件档案不包含 `NPUGRAPH_EX` 能力时（如 `310P`），配置校验会打告警并静默关闭 `enable_npugraph_ex`、`enable_static_kernel` 与 `enable_super_kernel`。

在同版本支持的配置内，固定触发输入，比较正常图路径与 eager。只在图路径失败，会把调查范围缩到捕获、回放及其路径差异；仍不能直接断言“图本身错误”，因为算子选择、内存布局和时序也会变化。随后分别查 [ACLGraph](acl-graph.md)、[NPUGraph-ex](npugraph-ex.md) 及涉及算子的限制；关闭图后的速度不作原配置收益结论。

### 分布式通信：区分交换慢和有人没到

首次多机部署或网络配置发生变化时，先走 [HCCL 页的设备网络预检](cann-hccl.md#启动多机前先检查哪一层网络)：核本机链路和地址，再探测实际使用的 NPU 对。主机 IP、API 端口、NPU 网络各自取得连通性证据，之后再定位推理程序在哪一步等待。

适用于通信超时、多卡等待或某张卡耗时突出。收集同一次集合通信的组、参与 rank、设备侧到达/完成、张量规模和各 rank 前序错误。**集合通信**要求一组参与者按匹配顺序交换数据。因此“通信慢或超时”背后存在三种不同时间线：**某卡根本没到**（首错崩溃触发次生 `EI0006` / `HCCL_E_WAIT_TIMEOUT`）、**某卡迟到**（负载/专家/Host 或 GC 拖慢），以及**全员到齐但交换本身慢**（真实链路与带宽瓶颈）：

```wiki-diagram
file: troubleshooting-fig-first-fault
```

排查多卡超时或通信变慢时，保持通信规模并按图中的三步收敛：

1. **先排除分支 A（锁定最早的首错 Rank）**：按时间戳合并全部参与 rank 的日志与 CANN `plog`。若只看到 `EI0006` 却没有任一卡的前序主错误，不能默认归罪给 Rank 0，应先补齐其余卡的同期日志再查网络。
2. **再区分分支 B 与 C（慢卡拖尾 vs 链路瓶颈）**：对比各卡设备侧到达屏障的时刻。若某张卡前序计算明显拖长，先控制迟到卡前面的工作量，观察其他卡等待是否同步下降；若参与条件已齐、前序均干净而交换仍慢，再用匹配拓扑和规模的通信测试核对链路。
3. **核对真实负载竞争**：独立通信测试正常也不能排除模型负载下的竞争。机制见[集合通信](collective-communication.md)与 [HCCL](cann-hccl.md)，时钟及依赖判别见[性能分析](inference-performance-analysis.md)。

### 缓存和分离部署：命中、可用、传到，是三件事

适用于前缀复用不生效、状态错误、缓存传输或卸载回载等待。**KV cache** 保留计算过的历史；**prefix caching** 在条件相符时复用已有前缀。收集实际输入编号、缓存键与命中记录、可复用长度及块状态。分离部署还要收集发送端、接收端、请求映射和完成确认；它把输入处理和后续生成放在不同实例。在 `v0.30.0` 下，GQA 模型启用 `MooncakeConnector` 时不支持同时开启 C8 KV 量化，启动校验会直接报错。

先固定输入与版本，比较冷、热两次，并确认实际减少了重算；若查到命中但依赖未就绪，继续追数据可用而非只看命中率。在隔离环境比较本地复用与传输/卸载路径，差异收敛到哪个交接就查哪个 connector。下一站是 [prefix caching](prefix-caching.md)、[PD 分离](pd-disaggregation.md)、[Mooncake](mooncake-connector.md) 或[分层卸载](kv-cache-layerwise-offload.md)，不能把一种缓存的行为套到所有实现。

想把匹配、取回、计算和交接放在一起看，可沿 [DeepSeek 生产案例](deepseek-serving-case.md#命中一样多为什么第二次首字更慢)区分“容量不足”和“数据尚未就绪”，再回到对应机制核对实现。

### 接口与服务能力：结果在哪一层变得不可用

适用于流式中断、JSON 不符合约定、工具调用解析失败或多模态输入被拒。先留 HTTP 状态、请求体、原始流式片段、结束原因、解析器名称与最终客户端内容。**结构化输出**约束生成时可选的 token；**工具解析器**把生成内容整理成调用字段，两者不是同一道处理。

固定同一份输入，先直连服务记录原始响应，再与代理和客户端收到的内容逐层比较。原始数据完整而客户端缺失，就查传输、缓冲与解析；入口已拒绝则查[API 入口](api-server-entry.md)，生成内容不符合限制则查[结构化输出](structured-output.md)，字段处理查[流式输出](streaming-output.md)。流式与非流式对照会改变交付方式，不能只凭两次随机生成文本不同定位解析器。

### 长运行与恢复：停止前后，谁还持有这条请求

适用于运行一段时间卡死、取消后继续工作、排空失败或恢复异常。先区分“仍有工作但进度很慢”与“所有相关进度停止”，连续记录活动请求、完成计数、设备进度、各进程存活及第一个停止推进的时点。取消时追前端通知、引擎状态与 worker 清理，不能只看客户端窗口消失。

在隔离环境对一个可追踪请求发起取消，观察活动记录和块引用是否按[收尾路径](request-teardown.md)释放；恢复问题保留前后实例标识与状态交接。若重启后暂时恢复，只证明状态被重置，不能据此确定根因。扩缩容先查现场采用的控制系统；涉及 RFork 时，补对应分支提交标识、参与进程的角色与 rank、两端实际生效配置，再转[其专用排障页](rfork-troubleshooting.md)核对协议。

重启后仍排长队、扩容没有立即生效，或需要安排实例下线时，接着用[容量与恢复案例](inference-capacity-and-reliability.md)检查就绪时间、故障范围、净消化能力和客户端结果；计划迁移与突然故障分别取证。

### 版本与配置回归：同一命令不等于同一路径

适用于升级后变慢、结果改变、开关被忽略或默认行为变化。保存升级前后精确 commit、安装路径、镜像、模型文件、启动日志与每个进程的最终配置。在 `v0.30.0` 下，`AscendConfig` 对 `--additional-config` 采用严格未知键校验（Pydantic `extra="forbid"`，即遇到配置类未声明字段直接拒绝启动），拼写错误会直接失败，但硬件能力降级仍可能把不支持的开关自动关掉，因此“未报错”仍不等于目标路径已生效。先查[配置系统](ascend-config-system.md)的覆盖与校验，再查[补丁系统](ascend-patch-system.md)是否替换了相关实现。

固定输入和负载，分别运行两套完整且兼容的环境；若能定位到单项配置变化，再在各版本支持范围内显式对齐。版本标签相同而安装文件不同，先解决产物不一致。只有在输入、有效配置与依赖可比较后，差异才进入版本回归调查；不能把新版本参数粘回旧版本当作已验证修复。

### Ascend 910B3 真机五类高频报错与 DEBUG 延迟陷阱速查

把单卡与八卡 `Ascend 910B3`（`v0.30.0`）上实机复现的五份故障栈标本与热路径观测税汇总成一线速查表（原件快照见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）：

| 实机故障标本 / 现象 | 首错栈位置与关键报错特征 | 易混淆陷阱与一步排障动作 |
| --- | --- | --- |
| **1. `u=0.90` 捕获期 FIA OOM** | 通过 `profile_run()`（如 `Qwen3-0.6B` 划出 `53.47 GiB` KV）及 35 档 `PIECEWISE` 后，在 `FULL` `1/35` 的 `device_op.py`（FIA）内申请 `1.98 GiB` > 剩余 `1.71 GiB` 抛 `NPU out of memory` | 并非 `profile_run()` 失败；将 `--gpu-memory-utilization` 下调（如 `0.82`）或改传录图建议的 `--kv-cache-memory`（见 [ACL Graph](acl-graph.md)） |
| **2. Sleep 唤醒 `FRACTAL_NZ` 拦截** | `wake_up()` 在 `worker.py` 抛 `ValueError: FRACTAL_NZ mode is enabled...` | 普通 BF16 权重在默认 `weight_nz_mode=1` 下本不转 `NZ`，但唤醒守卫只要非零即拒；显式传 `'{"weight_nz_mode":0}'`（见 [Sleep Mode](sleep-mode.md)） |
| **3. PD 分离 `TP_P % TP_D != 0`** | 如 `2 % 4 != 0`，`ascend_config.py` 普通 PD 校验抛 Pydantic `AssertionError: Prefill TP size must be divisible by Decode TP size.` | 对齐 `kv_transfer_config` 中两端 `tp_size` 使 `prefill_tp_size % decode_tp_size == 0`（Prefill TP 必须能被 Decode TP 整除，见 [PD 分离](pd-disaggregation.md)） |
| **4. `MooncakeConnectorV2` 配 `kv_both`** | 解析为 `MooncakePullConnector`，在 `mooncake/base_worker.py` 抛 `ValueError: Mooncake worker requires exactly one KV transfer role, got 'kv_both'` | 拆分为独立 `kv_producer` 与 `kv_consumer`；注意健康日志仅打印配置名 `MooncakeConnectorV1` 或 `HCCL operator is 1836s` 绝非报错（见 [Mooncake](mooncake-connector.md)） |
| **5. 未量化 GQA 传 `--kv-cache-dtype int8`** | 在 `attention_v1.py` 抛 `ValueError: The current GQA‑related models adopt static quantization...`（含 `U+2011` `‑` 不换行连字符） | 这是缺少离线 C8 校准权重报错，区别于 `ascend_config.py` 针对已带 C8 权重配普通 `MooncakeConnector` 的传输拦截（见 [KV cache 量化](kv-cache-quantization.md)） |
| **6. 误留 `VLLM_LOGGING_LEVEL=DEBUG`** | 无异常退出，但 `worker.py` 每步读分配器打印日志（`TP=8` 达 `3,312` 行）+ `acl_graph.py` 逐 Tensor 核对 `data_ptr()`，`TP=8 c=1` 单样本 `TTFT` `+39.48%` | 压测与线上服务恢复 `VLLM_LOGGING_LEVEL=INFO`；勿把该开销误写成每步 `mem_get_info` 设备同步（见 [设备内存](device-memory.md)） |

### CANN 与 AscendCL 高频数字错误码速查（507015 / 507034 / 507035 / 161002 / 107030）

外层 Python 日志常只停在 `AclrtSynchronizeStreamWithTimeout` 或 `synchronize stream failed`，真正区分硬件执行异常、算子入参越界与图捕获限制的线索藏在数字 `aclError` 与 `plog` 中：

| 数字错误码与常见外层报错 | 官方 `aclError` 定义与常见现场诱因 | 首取证据与下一步分流 |
| --- | --- | --- |
| **`507015`**（`AclrtSynchronizeStreamWithTimeout` / `aicore exception`） | 官方定义为 **AI Core 执行异常**；现场常见诱因包括核函数访存未对齐、UB/GM 地址越界或指令约束违例 | 进 `plog` 搜首处 `aicore exception` 与故障 kernel 名，再转 [AI Core](ai-core.md) 或 [ACL Graph](acl-graph.md) |
| **`507034`**（`ACL stream synchronize failed` / `vector core timeout`） | 官方定义为 **Vector Core（AIV）执行超时**；现场常见诱因包括超长序列单步计算超阈值或核内同步未释放 | 核对超长序列/单步批大小与核内同步，多卡时一并按时间戳排查 [HCCL 通信](cann-hccl.md) 与慢卡拖尾 |
| **`507035`**（`vector core exception` / `aicore VEC 507035`） | 官方定义为 **Vector Core（AIV）执行异常**；现场常见诱因包括向量指令输入特殊值、Tiling 偏移或 UB 越界 | 抓取 `plog` 中 `vec error info` 与输入形状/数值分布，对照 [AI Core](ai-core.md) 与 [算子与 kernel](ops-and-kernels.md) |
| **`161002`**（`ACLNN_ERR_PARAM_INVALID`） | `aclnn` 二段式算子接口**参数校验失败**，即输入输出 `dtype`、数据格式、维度或步长违反算子约束 | 查紧邻报错的 `aclGetRecentErrMsg` 明细核对张量形状与量化 Scale 类型，转 [算子与 kernel](ops-and-kernels.md) |
| **`107030`**（`ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT`） | 官方定义为**当前捕获模式不支持该操作**；现场多因图捕获流内夹杂受限同步或 `rtMemcpy`（部分算子仅打 `plog` 不影响推理） | 先核对服务是否实际中断；若捕获失败则用 `--enforce-eager` 对照并转 [ACL Graph](acl-graph.md) 与 [设备内存](device-memory.md) |

## 证据不足时，下一步应该有多具体

有用的回答可以停在“尚不能判根因”，但要同时说明**已经确认什么、还差哪项证据、怎样取、两种结果分别去哪**。例如只有通信超时日志时，先要同一通信组里最早报错的 rank 及其前序记录；没必要先让用户转储整个模型。

采不到请求与步骤映射时，先缩小到单条可控请求和短窗口，确认日志是否覆盖入口、调度和输出；复现消失则保留原并发作为触发条件，再逐步加回。最小复现和线上问题有了差异，也要把差异写进结论，而不是宣布“无法复现所以没有问题”。

## 放到 GLM 双机，哪些前提先不要改

标准 `v0.30.0` 主基线采用单机 `Qwen3-8B`（Dense GQA）与 `Qwen3-30B-A3B`（MoE）核对显存与配置；而在「09 旗舰异构模型全案」的历史绑定算例[GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)中，部署形态为两机 16 卡（`TP8` 分矩阵、`DP2` 分请求、`EP16` 分专家）。两机共同持有专家，另一组没有用户请求也会执行 dummy 步参与计算，因此某组等待不能自动解释成它的前端堵塞。

从这套双机配置缩减卡数、切换模型或精度，都会改变权重布局和执行路径。先在原配置取得阶段证据，再决定怎样简化。分离部署、外部缓存、RFork 等分支只在现场实际启用时进入；基线的普通请求不自动具有这些状态迁移过程。

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
# 1. 启动与显存里程碑快速核对（区分 init_snapshot / load_model / KV 池 / capture_model）
grep -nE "Free memory on device|Model loading took|Available KV cache memory|capture_model|NPU out of memory" serve.log

# 2. 多卡按时间戳倒查首错 Rank（过滤次生 EI0006 刷屏）
grep -rnE "ERROR|EZ9999|out of memory|EI0006" ~/ascend/log/debug/plog/ | sort -k2 | head -n 40

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
| `NPU out of memory` 落在 `capture_model()` 之后 | KV 池建立后图捕获（如 `FULL` `1/35` `device_op.py:216` FIA）吃空 $1 - u$ 余量 [C3][M27] | 适度下调 `u`（如 `0.82`）或改用日志建议的 `--kv-cache-memory` |
| `FRACTAL_NZ mode is enabled.`（`wake_up` 失败） | `worker.py:279-286` 唤醒守卫拦截非零 `weight_nz_mode` [C28][M27] | 传 `--additional-config '{"weight_nz_mode":0}'` 或开启 `rl_config.enabled` |
| `Prefill TP size must be divisible by Decode TP size.` | `ascend_config.py:879-884` 普通 PD 分离整除断言 [C31][M27] | 对齐两端 `tp_size` 使 `prefill_tp_size % decode_tp_size == 0`（Prefill TP 能被 Decode TP 整除） |
| `Mooncake worker requires exactly one KV transfer role` | `mooncake/base_worker.py:116` 拒绝 `kv_both` 双角色 [C32][M27] | 将 P/D 实例分别设为 `kv_producer` 或 `kv_consumer` |
| 多卡刷屏 `EI0006` / `HCCL_E_WAIT_TIMEOUT` | 集合通信屏障超时（RPC 超时抬高至 `3000s`）[C4] | 合并全组日志/plog 锁定最早出错的**首错 Rank**，全组干净再查网络（勿将启动自检打印 `1836s` 误当报错） |
| `EngineCoreProc` 退出码 `-9` / `137` (`SIGKILL`) | `utils.py` 回收子进程 `exitcode` [C12] | 先查宿主机 `dmesg` 与容器 `OOMKilled`，勿直接认定 NPU HBM OOM |
| `AscendFAImpl does not support ACL graph capture` | `fa3_v1.py` 禁止 FA3 + `FULL_DECODE_ONLY` [C9] | 改用默认 FIA 后端，或为 FA3 改用 `PIECEWISE` / `--enforce-eager` |
| `The current GQA‑related models adopt static quantization` | `attention_v1.py:583` 未量化 GQA 传 `int8` 缺少静态校准 scale（含 `U+2011` `‑`）[C8][M27] | 换带 C8 校准的 ModelSlim 权重，或移除 `--kv-cache-dtype int8`（区分 `ascend_config.py:1030-1042` 独立传输保护） |
| `kv_cache_usage_perc > 0.95` + `num_preemptions` 递增 | `loggers.py` KV 块枯竭触发调度抢占 [C15] | 收紧 `--max-num-seqs` 或扩容 KV 池 [D] |
| 留着 `VLLM_LOGGING_LEVEL=DEBUG` 出现首字延迟退化 | `worker.py:762-778` 每步分配器统计日志 + `acl_graph.py:275-281` `data_ptr()` 核对 [C29][M26] | 线上与基准测试恢复 `VLLM_LOGGING_LEVEL=INFO` |

只有“超时”“OOM”等摘要时，还缺阶段、对象与现场版本，先补齐再查已知修复。

### 开销和什么时候别开

状态重置、取消、图切换和故障注入放在隔离复现环境。线上先采最小观察窗口；恢复服务与查根因分别记录，临时缓解（如临时加 `--enforce-eager` 绕过图捕获）不能代替原配置修复验收。

### 版本差异

以下四版本核验矩阵对齐社区 `vllm-ascend` 与配套上游 `vLLM` 的排障关键边界（历史 GLM 双机镜像 `db701c1f` / `0fc695fc` 作为例外 B 另行标注）：

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
| --- | --- | --- | --- | --- |
| **启动显存与图捕获边界** | `init_device` / `determine_available_memory` 基础快照与探测（来源 19） | 延续六步骨架并引入基础 `kernel_warmup`（来源 20） | 区分 `init_snapshot` 预检、试跑峰值与 `capture_model()` 后的建议 `--kv-cache-memory` 打印，且 `310P` 归入 `HardwareProfile` 兼容档位（来源 1–3、10） | 延续六步探测与建议字节打印；`worker.py` 行号上移且预热转向声明式注册表（来源 21） |
| **配置校验与静默降级** | 以手写字段校验为主，部分未知键易被静默忽略 | 逐步收紧 `additional_config` 校验 | `AscendConfig` 采用 Pydantic `extra="forbid"` 严格拒未知键，同时按硬件能力自动降级关闭 `npugraph_ex` / `static_kernel` / `super_kernel`（来源 5–6） | 延续严格未知键校验与硬件能力降级 |
| **HCCL 超时与进程退出** | 依赖 `HCCL` 默认超时与多进程退出回收 | 延续多进程退出状态上报 | `platform.py` 将 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` 抬高至 `3000s` 覆盖 `1836s` 算子超时；上游 `utils.py` 汇总子进程 `exitcode`（来源 4、12） | 延续 `3000s` RPC 超时保护与子进程退出回收（来源 22–23） |
| **运行期指标与收尾** | 具备基础调度队列与请求结束释放入口（来源 25） | 扩展 v1 引擎指标与中断链路 | `loggers.py` 导出 `kv_cache_usage_perc`、`num_requests_waiting`、`num_preemptions` 及 TTFT/ITL 直方图；`scheduler.py` 与 `async_llm.py` 负责取消与块释放（来源 13–16） | 延续 v1 指标与取消释放链路 |

具体版本行为由链接的机制页维护；本页的诊断步骤仍须在现场版本和负载下验证。

### 源码位置

- **启动预检、显存探测、Sleep 守卫与图捕获 OOM**：`vllm_ascend/worker/worker.py`（来源 1–3、28–29）涵盖 `init_snapshot` 校验、`determine_available_memory()` 试跑量测、`compile_or_warm_up_model()` 录图后显存账建议、`wake_up()` 对非零 `weight_nz_mode` 的拦截与 `execute_model()` 中 `DEBUG` 分配器读数日志；`device/device_op.py`（来源 33）与 `compilation/acl_graph.py`（来源 30）分别对应 `FULL` 图捕获 FIA 调用栈与回放 `data_ptr()` 校验；`device/hardware_profile.py`（来源 10）划分 `310P` 兼容硬件档位。
- **配置、PD 分离、图捕获与量化兼容硬报错**：`vllm_ascend/ascend_config.py`（来源 5–7、31）包含 `NPUGRAPH_EX` 硬件降级、`extra="forbid"` 未知键校验、普通 PD `TP_P % TP_D == 0` 整除断言与 `MooncakeConnector` 禁配 GQA C8；`mooncake/base_worker.py`（来源 32）校验单一 KV 传输角色；`attention_v1.py`（来源 8）与 `fa3_v1.py`（来源 9）分别负责 GQA+C8 校准校验与 FA3 `FULL_DECODE_ONLY` 拦截。
- **分布式超时、进程退出、收尾与 `/metrics`**：`vllm_ascend/platform.py`（来源 4）与 `utils.py`（来源 11）维护 HCCL 超时与通信组缓冲配置；`vllm/v1/engine/utils.py`（来源 12）、`scheduler.py`（来源 13）、`async_llm.py`（来源 14）与 `metrics/loggers.py`（来源 15–16）覆盖子进程退出码、取消释放与 Prometheus 指标定义。
- **官方文档、历史快照与 `Ascend 910B3` 真机标本**：官方 Profiling 指南 [S17]、FAQ [S18] 与 AscendCL 错误码参考（来源 34）提供采集与数字错误码索引，算子参数校验码 `161002`、图模式 `rtMemcpy` `107030` 发布说明与 AI Core `507015` 实证约束分别见来源 35–37；`v0.23.0` / `v0.26.0rc` / `main` 对照来源为来源 19–23，GLM 双机历史参考为来源 24–25；`Ascend 910B3` 八卡扩展、`DEBUG` 延迟对照与五份真机故障标本归档于来源 26–27 [M26][M27]。
- **方法论与示意边界**：十域分流和判别实验是基于既有机制组织的诊断方法 [I]；请求 R 的时间与步骤号、多卡交错时间轴图及工作台 6 类阻塞时序对照视图均为教学示意 [A]，不代表目标硬件实测耗时。
