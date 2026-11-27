---
id: ascend-runtime-and-tuning
title: 昇腾算子下发流水与运行时调优：TASK_QUEUE_ENABLE、跨流显存复用与容器设备栈
type: concept
origin: direct
summary: >-
  剖析小批解码为何受限于 Host 下发空泡，讲清 TASK_QUEUE_ENABLE=0/1/2 二级流水与显存峰值/图捕获互斥边界、expandable_segments:True 跨流复用、容器 /dev/davinci* 栈与 HCCL AIV 调优。
aliases:
  - TASK_QUEUE_ENABLE
  - 'TASK_QUEUE_ENABLE=2'
  - 二级流水
  - 二级下发流水
  - 二级异步下发流水线
  - 算子下发流水
  - Host-bound
  - 下发空泡
  - CPU_AFFINITY_CONF
  - 'expandable_segments:True'
  - max_split_size_mb
  - garbage_collection_threshold
  - 跨流显存复用
  - ACL_OP_INIT_MODE
  - npu-smi
  - npu-smi info
  - davinci_manager
  - devmm_svm
  - hisi_hdc
  - /dev/davinci
  - 'HCCL_OP_EXPANSION_MODE=AIV'
  - HCCL_INTRA_ROCE_ENABLE
  - HCCL_RDMA_TC
  - HCCL_RDMA_SL
chapters:
  - '07'
  - '16'
  - '19'
order: 125
sources:
  - 'vllm-ascend@c09d3e20:Dockerfile#L53-L68'
  - 'vllm-ascend@2c59ff10:Dockerfile#L56-L64'
  - 'vllm-ascend@2ed6cbba:Dockerfile#L69-L76'
  - 'vllm-ascend@8d6180e2:Dockerfile#L64-L70'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1445-L1481'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1732-L1768'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L772-L790'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L773-L791'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L1255-L1261'
  - 'vllm-ascend@c09d3e20:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L28-L66'
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L31-L103'
  - 'vllm-ascend@8d6180e2:vllm_ascend/envs.py#L26-L108'
  - 'https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUCachingAllocator.cpp'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L10-L27'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L90-L135'
  - 'vllm-ascend@8d6180e2:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L108-L139'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.2.md#L869-L880'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/Dots3-Note.md#L130-L205'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Kimi-K3.md#L275-L281'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Kimi-K3.md#L800-L812'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/DeepSeek-V4-Flash.md#L572-L584'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/DeepSeek-V4-Flash.md#L975-L988'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation.md#L49-L71'
  - 'https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta1/API/hcclug/hcclcpp_07_0047.html'
  - 'https://www.hiascend.com/document/detail/en/CANNCommunityEdition/850/commlib/hcclug/hcclug_000073.html'
  - 'https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/900beta2/commlib/hcclug/hcclenvref_07_0003.html'
  - 'https://www.hiascend.com/doc_center/source/zh/canncommercial/900/API/hcclug/hcclenvref_07_0009.html'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
relations:
  - to: op-to-ai-core
    kind: builds-on
    note: 先理解单个算子如何经 Host tiling 分块落到 AI Core，再看连续几百个算子如何流水下发
  - to: acl-graph
    kind: alternative-to
    note: 图捕获把整串算子录成单次重放，二级流水在单算子路径重叠 Host 下发；注意 TASK_QUEUE_ENABLE=2 在 main 与图捕获互斥
  - to: cpu-binding
    kind: builds-on
    note: vLLM-Ascend 自身的 enable_cpu_binding 与底层 TorchNPU 的 CPU_AFFINITY_CONF 同管主机侧线程亲和与跨 NUMA 抖动
  - to: cann-hccl
    kind: builds-on
    note: 承接 CANN 与 HCCL 四层通信模型，深入 HCCL_OP_EXPANSION_MODE、网卡 TC/SL 与建链/执行超时调优
  - to: device-memory
    kind: builds-on
    note: 承接 NPU 显存缓存分配器基础，展开通信流与计算流跨流提前复用的底层逻辑与睡眠模式边界
contradicts: []
updated: '2026-11-27'
---

**主机 CPU 先完成 Python 分发、形状校验与分块计算（`tiling`）来组织算子任务。`torch_npu` 与底层运行时（AscendCL）通过多级异步队列把任务提交给设备。NPU 再按硬件流（Stream）及跨流事件依赖执行计算与通信。** 这套把主机准备与 AI Core 运算在时间轴上重叠起来的队列机制，就是**昇腾算子下发流水（Operator Dispatch Pipeline）**。很多工程师第一次看大模型 Decode（逐词解码）性能剖析图时会大吃一惊：昇腾 NPU 利用率不高，单步时延却降不下来——真正的瓶颈往往不在 AI Core 算得慢，而在于 **Host CPU 发得慢（Host-bound 下发空泡）**。

```wiki-diagram
file: ascend-task-queue-pipeline
```

## 为什么推理时延常卡在 Host CPU 下发空泡，而非 AI Core 计算？

沿[从算子到 AI Core](op-to-ai-core.md)走完一次算子调用就会看到：AI Core 并不会自己读 Python 代码。每执行一个算子，主机侧 CPU 都得依次走完 **Python 框架分发 → 张量形状校验与 Host `tiling`（计算分块参数） → 组装 ACLNN / ACL 任务描述符 → 写入硬件任务流（Stream）** 四道工序（多模态小图并发跑视觉编码塔 ViT 时同样会遭遇这类主机逐算子发射开销，见[多模态特征缓存与视觉图](multimodal-encoder-cache.md)）。

在 Prefill（长提示词预填充）阶段，几千个 token 拼成大矩阵，AI Core 算一个算子要花几百微秒甚至几毫秒，足够掩盖主机侧十几微秒的下发准备；可一旦进入小批量 **Decode** 阶段，每步每条请求只算 `1` 个新 token（哪怕 `36` 层 `Qwen3-8B` 或 `48` 层 `Qwen3-30B-A3B` 要连续跑几百个线性层、归一化、RoPE 与通信算子），AI Core 算完单个小算子往往只要 **`5`–`15 µs`**。只要主机侧单个算子的 Python + ACL 组装耗时达到 **`20`–`30 µs`**，即便相邻算子之间存在最理想的下发与执行重叠，整步总耗时仍受限于主机总下发时长下界，发生典型的 **Host-bound 断流**：

$$T_{\text{step}} \ge \max\!\left(\sum_{i=1}^{M} T_{\text{host},i},\; \sum_{i=1}^{M} T_{\text{device},i}\right)$$

以一步前向含 $M = 300$ 个均匀小算子做稳态示意推算：若每个算子在 AI Core 上仅需 $8\text{ }\mu\text{s}$（纯设备总算时 $2.4\text{ ms}$），而主机准备与下发每算子耗费 $20\text{ }\mu\text{s}$（主机总下发耗时 $6.0\text{ ms}$），稳态下 AI Core 平均每算完一次就要空等 $12\text{ }\mu\text{s}$ 空泡（Bubble），整步耗时下界直接被撑大到 $6.0\text{ ms}$——超过一半的时间芯片都在空转等指令。解决这一矛盾有两条正交路线：一条是用 [ACL Graph](acl-graph.md) 把整串算子录成一张静态图一次重放；另一条就是在单算子（Eager）或分段图之外的路径上，用 **`TASK_QUEUE_ENABLE` 异步下发流水线**把主机耗时拆给后台线程并行消化。

## `TASK_QUEUE_ENABLE=0 / 1 / 2` 二级异步下发流水线与两大边界

`torch_npu` 通过环境变量 **`TASK_QUEUE_ENABLE`** 控制主机侧下发队列的流水深度，三档取值的分工与代价截然不同：

| 取值 | 运行机制 | 适用场景 | 核心代价与硬限制 |
|---|---|---|---|
| **`0`** | **关闭主机异步任务队列**：Python 主线程直接完成 `tiling` 与 ACL 下发（设备核执行仍异步） | 配合 `ASCEND_LAUNCH_BLOCKING=1` 同步等待，精确定位是哪一行 Python 算子触发了设备异常 | Host 下发失去后台线程重叠，吞吐显著回落，**严禁用于生产压测** |
| **`1`** | **一级异步队列（官方 `Dockerfile` 默认内置）**：主线程将算子推入队列即返回准备下一个算子，由后台二级线程异步调用主要 ACLNN 下发接口 | 绝大多数线上部署默认基线，**兼容 [ACL Graph](acl-graph.md) 图捕获** | 若模型极碎、Python/ACL 组装仍跑不过二级线程消费速度，仍可能残留少量下发气泡 |
| **`2`** | **二级异步下发流水线**：在一级队列基础上增加**两级线程负载均衡与线程唤醒优化**，在受支持的二进制算子范围内进一步压榨多核主机下发吞吐 | 纯 Eager 单算子模式且显存充裕的重度 Host-bound 场景（净收益须按实际负载实测） | **① 在 `main` 分支与 NPU 图捕获硬冲突报错**；**② 拉长在途激活寿命抬高显存峰值（显存吃紧时反致回收退化或 OOM）** |

评估 `TASK_QUEUE_ENABLE=2` 时，要把**图捕获硬冲突**与**单算子运行期实测收益**两件事分开：
- **图捕获硬互斥边界**：在 `main` 分支中，开启 NPU 图捕获（ACL Graph）时若设置 `TASK_QUEUE_ENABLE=2`，运行时会当场抛出 `RuntimeError: Do not support TASK_QUEUE_ENABLE = 2 during NPU graph capture, please export TASK_QUEUE_ENABLE=1/0.`——只要启用图模式，就必须保持默认的 `TASK_QUEUE_ENABLE=1`（或 `0`）。
- **单算子运行期收益与显存峰值权衡**：即便在纯 Eager 模式下，`TASK_QUEUE_ENABLE=2` 也不保证无损提速。异步下发中 Python 主线程执行完 `y = op(x)` 紧接着 `del x` 时，设备上的 `op` 仍排在队列里未算完，缓存分配器必须保住 `x` 与 `y` 的显存块直到设备流消费完毕；二级流水让主线程超前积压几十至上百个在途算子，**所有在途中间激活张量的生命周期被同时拉长**，一旦触及显存上限触发分配器同步回收等待，吞吐反而下跌，因此必须结合目标负载实测验证。

此外，在模型启动食谱中常与任务队列结伴出现的还有两项底层开关（两项均由底层 `torch_npu` / CANN C++ 运行时直接消费，`vllm-ascend` Python 仓内无独立解析器）：

- **`CPU_AFFINITY_CONF=1`**：底层运行时的粗粒度 CPU 亲和绑定配置（常见于 `GLM5.2`、`Dots3-Note` 等食谱），用于把算子下发相关线程钉在 NPU 就近的 [NUMA 节点](cpu-binding.md) 上以减少跨片访存抖动，与 `vllm-ascend` 自身的 `enable_cpu_binding` 同属降低 Host 抖动的手段。
- **`ACL_OP_INIT_MODE=1`**：算子初始化与编译加速模式（见于 `GLM5.2` 与外置 KV 池食谱），配合持久化算子编译缓存减少冷启动首次编译耗时。

## `PYTORCH_NPU_ALLOC_CONF`：跨流显存提前复用 vs 禁切大块

除了算子下发，多卡推理中另一条隐蔽的运行期瓶颈在 **计算流（Compute Stream）与通信流（Communication Stream）的显存交接**。在集合通信或通算重叠场景下，通信流上的算子往往带有一串跨流事件依赖；传统缓存分配器为了安全，必须等通信流上的依赖链全部执行结束，才敢把这块显存归还给计算流复用，导致双流并发时显存占用虚高或频繁向驱动申请新块。

`torch_npu` 的设备显存缓存分配器（`NPUCachingAllocator`，注意与宿主机 DRAM 用户态分配器 `TCMalloc` / `jemalloc` 及锁页内存分属两套体系，后者见[主机内存与大页](host-memory-and-hugepages.md)）通过 **`PYTORCH_NPU_ALLOC_CONF`** 提供两条互斥的调优策略：

1. **`expandable_segments:True`（非睡眠模式下的框架自动默认项）**：利用底层虚拟内存映射将非连续物理块拼接成可扩展虚拟地址段，并支持**多流显存提前复用**——提前释放通信流上已完成实际读取的显存段供计算流重用，大幅缓解变长 Prefill 与跨流通信带来的显存碎片。在 `vllm-ascend` 的 `_set_pytorch_npu_alloc_env()` 中，只要未开启[睡眠模式（Sleep Mode）](sleep-mode.md)，框架启动时就会**自动注入或追加 `expandable_segments:True`**。
2. **`max_split_size_mb:<N>`（如官方示例 `max_split_size_mb:250`，与上项互斥）**：传统静态块池下的防碎手段，规定大于 `250 MiB` 的大空闲显存块禁止被切碎拿去满足小张量申请。

使用时务必守住两条代码级边界：**第一，`expandable_segments:True` 与 `max_split_size_mb`、`garbage_collection_threshold` 互斥，不可同时写入同一环境变量**（若用户已手工设置后两项，`_set_pytorch_npu_alloc_env()` 会保留原值而不再追加 `expandable_segments`）；**第二，虚拟地址段管理与[睡眠模式（Sleep Mode）](sleep-mode.md)物理显存卸载冲突——单独开启 `--enable-sleep-mode` 时框架仅跳过自动注入（若你在外部手工 `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True` 仍会原样保留并撞上睡眠分配器断言报错），只有同时启用强化学习配置（`rl_config`）时代码才会主动调用 `_disable_expandable_segments()` 将显式传入的该项剥离**。

## 昇腾容器设备栈四件套与 `npu-smi info` 实战判读

当我们在 Docker 或 Kubernetes Pod 里拉起上述运行时流水线时，容器内的用户态 CANN（`libascendcl.so`）与宿主机内核驱动之间完全依赖 `docker run` 透传的四类字符设备与驱动目录协同工作（单机最小启动模板见[环境与起服务清单](ascend-env-and-serve.md)）：

| 容器透传项 | 角色分类 | 核心职责与故障指纹 |
|---|---|---|
| **`/dev/davinci0..N`** | 逻辑计算设备节点 | 对应单颗可见 NPU 计算实例（A2 单卡 `0..7`；**Atlas A3 双裸片**单张物理卡对应一对节点，整机 8 张物理卡展开为 `davinci0`–`davinci15`，须成对挂载） |
| **`/dev/davinci_manager`** | 全局设备管理节点 | 承接设备枚举、拓扑查询与驱动控制指令；漏挂会导致容器内枚举不到任何 NPU |
| **`/dev/devmm_svm`** | 共享虚拟内存管理（SVM） | 支撑 Host-Device 共享虚拟地址映射、锁页内存管理与 `expandable_segments` 底层虚拟段操作（注：`950DT` 容器快速入门架构不同，省去该节点并加挂 `hccn_tool`） |
| **`/dev/hisi_hdc`** | Host-Device 通信通道（HDC） | 宿主机与 NPU 控制核之间的高速控制与日志/健康状态传输通道 |
| **驱动库与工具挂载（`-v`）** | `driver/lib64`、`dcmi`、`npu-smi`、`version.info`、`ascend_install.info` | 将与宿主机内核严格匹配的 `libascend_hal.so`（硬件抽象层）及管理接口注入容器，防止用户态 CANN 与内核驱动版本失配 |

进入容器跑服务前后，敲下 **`npu-smi info`** 是定位运行时状态的第一动作。实战判读时重点盯住四项指标（注意官方安装文档明确说明具体表列会随芯片型号与驱动版本变化）：

1. **`Health` 与温度/功耗**：必须为 `OK`；若为 `Warning` 或 `Alarm`，优先用 `npu-smi info -t health -i <id>` 排除硬件光模块或高温降频，再查软件栈。
2. **`AICore(%)`**：芯片计算核瞬时利用率。压测时若吞吐卡死而 `AICore(%)` 长期偏低且剧烈锯齿波动，正是前文 **Host-bound 下发空泡**或跨机通信阻塞的典型信号。
3. **`HBM-Usage(MB)`（或 `Memory-Usage`）**：驱动层真实已分配的设备显存总量。由于 `vllm` 启动完 `profile_run` 后会按 `--gpu-memory-utilization`（如 `0.90`）一次性预分配整池 KV cache，服务就绪后此处稳定在 `90%` 左右属正常现象，不代表显存泄漏。
4. **底部 `Process` 进程表**：核查是否有上一次异常强杀（`kill -9`）残留的僵尸 Worker 霸占显存，导致新实例启动时报显存不足。

## HCCL 关键运行期调优：AIV 直驱 RoCE、链路 QoS 与双超时机制

当多卡 TP / EP 通信进入运行期，CANN 的集合通信库 [HCCL](cann-hccl.md) 默认怎样调度网卡、用哪条链路、等多久报错，由以下三组核心环境变量精细控制：

1. **通信算子展开与编排位置（`HCCL_OP_EXPANSION_MODE`）**：控制集合通信任务在何处展开并编排下发，**默认展开位置随芯片系列与 CANN 版本而异**——例如 CANN 9.0 官方文档规定 Atlas A2 系列默认为 **`HOST`** 侧展开（部分其他卡型或版本走 `AI_CPU`），不能一概假定未设置时都走 AI CPU。设为 **`"AIV"`** 时改由芯片上的 **AI Vector Core（向量核）** 展开驱动通信，减少中转延迟，但其对**多机跨节点拓扑、图模式捕获以及具体集合通信算子**均有明确支持范围与版本前提，**严禁跨机型或跨阶段盲套**：例如官方 `Kimi-K3` 食谱在 Atlas A3 分离式 Prefill 侧留空使用默认展开、在 Decode 侧显式设 `HCCL_OP_EXPANSION_MODE=AIV`（两侧 `HCCL_BUFFSIZE=1024`）；而 `950DT` 混部 P/D 保持留空，分离式 P/D 两侧则改设 **`CCU_SCHED`**（在 `device_op.py` 的 `npu_mm_reduce_scatter_base` 中将 `comm_mode` 切为 `"ccu"`）配 `HCCL_BUFFSIZE=800`。
2. **机内/跨机链路选路、网卡优先级与通信缓冲**：
   - **`HCCL_BUFFSIZE`**：控制两颗 NPU 间共享通信数据缓冲区的 MB 大小（MC2 通算融合算子在 C++ `tiling` 中亦直接读取它，MoE 常设 `256`、`800` 或 `1024`，见 [HCCL 缓冲](hccl-buffer.md)）；
   - **`HCCL_INTRA_ROCE_ENABLE`**：在特定双 `8P` Mesh 互联拓扑下，将默认系统 DMA（SDMA）链路切换为 RDMA（RoCE）链路；
   - **`HCCL_RDMA_TC` 与 `HCCL_RDMA_SL`**：分别配置 RDMA 网卡的流量类别（Traffic Class，如 CANN 通信域接口文档示例 `132`）与服务等级（Service Level，如示例 `4`），必须与机房交换机的无损网络 PFC / ECN 队列配置严格对齐，否则跨机大包极易丢包重传。
3. **建链与执行双超时防误杀（`HCCL_CONNECT_TIMEOUT` / `HCCL_EXEC_TIMEOUT`，单位：秒）**：排查超时报错时，须把**主机进程间 RPC 超时**（如 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS`）、**HCCL 建链握手超时**与**设备流 HCCL 执行超时**三个独立计时作用域分开（三层超时的配置与报错对照见[请求调用链「怎么开」](request-call-chain.md#怎么开)与[「会报什么错」](request-call-chain.md#会报什么错)）：
   - `HCCL_CONNECT_TIMEOUT` 控制分布式启动阶段各节点 Socket 握手建链的最长等待秒数（CANN 文档常见默认 `120` 秒；超大模型多机冷启动权重加载慢、各节点进通信组存在时间差时，`DeepSeek-V4-Flash` 等食谱会放宽至 `1200` 秒）；
   - `HCCL_EXEC_TIMEOUT` 控制运行期设备流等待对端通信算子同步的最长秒数（默认值随 CANN 版本、卡型和展开模式变化，例如 A3 在特定 CANN 版本下 AICPU 默认 `1836` 秒、AIV 默认 `1091` 秒；`DeepSeek-V4-Flash` 快速失败配方曾显式收紧为 `204` 秒以便故障快速暴露）。

## 常见误解

- **「只要把 `TASK_QUEUE_ENABLE` 从默认 `1` 改成 `2`，所有昇腾推理服务都能无损提速」**：错。`TASK_QUEUE_ENABLE=2` 通过超前排队掩盖 Host 耗时，会显著抬高在途张量的峰值显存，在显存紧平衡时反而引发回收卡顿或 OOM；且在 `main` 分支中它与 ACL Graph 图捕获直接互斥，开图模式必须用 `1`（或 `0`）。
- **「为了极致防碎片，应该把 `PYTORCH_NPU_ALLOC_CONF="expandable_segments:True,max_split_size_mb:250"` 两个一起写上」**：错。`expandable_segments:True` 与 `max_split_size_mb`、`garbage_collection_threshold` 在 `torch_npu` 分配器中互斥，不可同开；普通在线推理保持框架自动注入的 `expandable_segments:True` 即可。
- **「`HCCL_OP_EXPANSION_MODE=AIV` 是万能加速开关，Prefill、Decode 和 `950DT` 全都配 `AIV` 最好」**：错。通信展开模式强依赖硬件代际与 P/D 负载特征——例如 `Kimi-K3` 在 A3 Prefill 侧留空走 AICPU、Decode 侧才用 `AIV`，而在 `950DT` 分离式部署中两侧使用的是 `CCU_SCHED`。
- **「`npu-smi info` 显示显存占了 `90%` 以上，说明服务快要爆显存挂掉了」**：错。vLLM V1 在冷启动预演后就会把 `--gpu-memory-utilization` 预算内的可用显存一次性划入分页 KV cache 块池，服务空闲时显存高水位是正常的池化预留，真实剩余并发容量应看引擎日志打印的 KV token 容量与运行期块使用率指标。

## 对照源码

### 怎么开

- **下发队列、线程亲和与算子初始化**：官方各硬件族 `Dockerfile` 均默认注入 `TASK_QUEUE_ENABLE=1` 与 `OMP_NUM_THREADS=1`[C1]。纯单算子重度 Host-bound 场景可在留足显存余量前提下测 `export TASK_QUEUE_ENABLE=2`[S15]，但启用 ACL Graph 图捕获时须保持 `1`（或 `0`）[S16][!]。底层亲和与编译加速按模型食谱配 `export CPU_AFFINITY_CONF=1` 与 `export ACL_OP_INIT_MODE=1`[S17][S18]（这两项与 `TASK_QUEUE_ENABLE` 均不在 `vllm_ascend/envs.py` 惰性环境变量表中注册，由底层 `torch_npu` / CANN 运行时直接读取[C11]）。
- **跨流显存分配器（`PYTORCH_NPU_ALLOC_CONF`）**：非睡眠模式下，`_set_pytorch_npu_alloc_env()` 自动注入或追加 `expandable_segments:True`[C5]（底层缓存分配器实现见 `NPUCachingAllocator.cpp`[C13]）；若用户显式传入了与之互斥的 `max_split_size_mb`（如示例 `250`）或 `garbage_collection_threshold`，代码保留用户原值不追加[S15]；单独开启 `--enable-sleep-mode` 仅跳过自动注入（切勿手工传入 `expandable_segments:True`），启用强化学习配置时才调用 `_disable_expandable_segments()` 自动剥离已设置项。
- **容器设备栈与 HCCL 运行期参数**：容器标准挂载 `/dev/davinciN`（A3 双裸片展开至 `davinci0..15`）、`/dev/davinci_manager`、`devmm_svm`、`hisi_hdc` 及驱动 `lib64`/`dcmi`/`npu-smi`[S14][S23]。HCCL 展开模式默认随芯片与 CANN 版本变化（如 CANN 9.0 下 A2 默认 `HOST`，`AIV` 受多机、图模式与算子范围约束[S27]），生产食谱按拓扑与阶段选用 `HCCL_OP_EXPANSION_MODE="AIV"`（如 A3 Decode）或 `"CCU_SCHED"`（如 `950DT` 分离 P/D，`device_op.py` 将 `comm_mode` 置为 `"ccu"`）[C9][S19]（来源 20），配合 `HCCL_BUFFSIZE`（MC2 `tiling` 亦读取）[C10]、`HCCL_INTRA_ROCE_ENABLE`、`HCCL_RDMA_TC/SL`（通信域配置见 CANN 文档[S24]）及 `HCCL_CONNECT_TIMEOUT` / `HCCL_EXEC_TIMEOUT`（来源 21–22）[S25][S26]。

### 会报什么错

| 拦截或异常位置 | 触发条件 | 典型报错或运行退化现象 | 核验入口 |
|---|---|---|---|
| NPU 图捕获（`main`） | 开启 ACL Graph 捕获的同时设置了 `TASK_QUEUE_ENABLE=2` | `RuntimeError: Do not support TASK_QUEUE_ENABLE = 2 during NPU graph capture, please export TASK_QUEUE_ENABLE=1/0.` | 来源 16 |
| `TASK_QUEUE_ENABLE=2` 高水位运行 | 显存余量紧平衡时开启二级流水，在途激活积压推高显存峰值 | 触发分配器频繁同步回收导致吞吐倒退，或直接报 `NPU out of memory` | 来源 15 |
| `PYTORCH_NPU_ALLOC_CONF` 解析与睡眠冲突 | 将 `expandable_segments:True` 与 `max_split_size_mb` 同写，或在单开 `--enable-sleep-mode` 时手工注入 `expandable_segments:True` | 前者被 `torch_npu` 分配器拒绝；后者在睡眠物理卸载分配器处触发断言失败 | 来源 5、13 |
| 多机冷启动通信组握手 | 超大模型各节点权重加载进度差超过 `HCCL_CONNECT_TIMEOUT`（如默认 `120s`） | 建链超时退出，需按 `DeepSeek-V4-Flash` 等食谱放宽（如 `1200`）或排查慢节点 | 来源 21、22、25 |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 镜像默认下发队列与插件 `envs.py` | `Dockerfile` 默认 `TASK_QUEUE_ENABLE=1`[C2]；`envs.py` 含 `21` 项变量 | `Dockerfile` 默认 `TASK_QUEUE_ENABLE=1`[C3]；`envs.py` 含 `20` 项变量 | `Dockerfile` 默认 `TASK_QUEUE_ENABLE=1`；`envs.py` 收敛为 `14` 项，调优指南记录 `=2` 峰值显存代价 | `Dockerfile` 默认 `TASK_QUEUE_ENABLE=1`[C4]；`envs.py` 收敛为 `12` 项；**调优指南明确记录 `TASK_QUEUE_ENABLE=2` 与 ACLGraph 捕获冲突报错** |
| `PYTORCH_NPU_ALLOC_CONF` 自动管理 | 非睡眠模式默认追加 `expandable_segments:True`[C7] | 同 `v0.23.0`[C8] | 睡眠模式跳过自动追加，并新增 `_disable_expandable_segments()` 供 RL 路径剥离显式项 | 延续 `v0.30.0` 自动注入与 RL 剥离逻辑[C6] |
| `HCCL_OP_EXPANSION_MODE` 代码与食谱 | 调优指南推荐 `"AIV"`；`Kimi-K3` 混部基线禁设 `"AIV"` | 新增 `Kimi-K3` A3/950DT 分阶段说明 | `device_op.py` 显式读取 `"CCU_SCHED"` 切换 `comm_mode="ccu"`；`Kimi-K3` 区分 950DT `CCU_SCHED` 与 A3 D 侧 `AIV` | 延续 `CCU_SCHED` 与分机型 P/D 差异化配置 |

### 源码位置

- **镜像默认值、分配器注入与算子/环境变量源码（来源 1–13）**：四版本 `Dockerfile` 默认 `TASK_QUEUE_ENABLE=1` 见来源 1–4；四版本 `_set_pytorch_npu_alloc_env` 与 `_disable_expandable_segments` 见来源 5–8；`HCCL_OP_EXPANSION_MODE` 的 `CCU_SCHED` 分支见来源 9，MC2 `HCCL_BUFFSIZE` 读取见来源 10；`vllm_ascend/envs.py` 惰性环境变量注册表见来源 11–12；`torch_npu` 缓存分配器实现见来源 13。
- **调优指南、模型食谱与 CANN 官方文档（来源 14–27）**：容器挂载、任务队列、分配器与 HCCL 调优总览见来源 14–16；`CPU_AFFINITY_CONF=1`、`ACL_OP_INIT_MODE=1` 与 A3 `davinci0..15` 挂载见来源 17–18；`Kimi-K3` 与 `DeepSeek-V4-Flash` 的 HCCL 模式及超时配方（`120/204` 与 `1200`）见来源 19–22；`npu-smi` 视图说明见来源 23；CANN 官方通信域 TC/SL、双超时与 `HCCL_OP_EXPANSION_MODE` 分卡型默认及支持范围见来源 24–27。文中 $M=300$ 步时延下界公式为教学示意推导[A][D]；闭源 `libhccl.so` 在特定固件下的未公开默认值仍需结合现场日志核验[I]。
