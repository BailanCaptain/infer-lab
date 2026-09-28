---
id: cann-hccl
title: CANN 与 HCCL：计算、通信和物理链路
type: concept
summary: CANN 提供昇腾计算软件能力，HCCL 负责组内通信；沿框架请求、通信库和物理链路看数据怎样到另一张卡，再解释 GLM 双机通信域与 AI QoS 的适用边界。
aliases: [CANN, 昇腾软件栈, HCCL, 集合通信库, Huawei Collective Communication Library,
  AI QoS, AI QoS Feature, ai_qos, 流量 QoS, 虚拟通道 VL, Virtual Lane, UB 交换机 QoS, hccs qos remap,
  严格优先级调度, MASTER_ID_SDMA, aiqos_table, tools/ai_qos.py]
chapters: ["07", "09", "08"]
order: 130
sources:
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/index/index.html
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988
  - vllm@0fc695fc:vllm/distributed/device_communicators/base_device_communicator.py#L180-L207
  - vllm-ascend@db701c1f:vllm_ascend/distributed/device_communicators/npu_communicator.py#L40-L68
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L5-L21
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - vllm-ascend@db701c1f:tools/ai_qos.py#L326-L338
  - vllm-ascend@db701c1f:tools/ai_qos.py#L359-L422
  - vllm-ascend@db701c1f:tools/ai_qos.py#L452-L474
  - vllm-ascend@db701c1f:tools/ai_qos.py#L270-L311
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L989-L1002
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1088-L1101
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1210-L1223
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L270-L474
  - vllm-ascend@2ed6cbba:tools/ai_qos.py#L270-L474
  - vllm-ascend@baa023ad:tools/ai_qos.py#L270-L468
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1749-L1875
  - vllm@0fc695fc:vllm/config/parallel.py#L683-L707
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L86
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L13-L35
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2186-L2192
  - vllm-ascend@baa023ad:docs/source/tutorials/features/pd_disaggregation_mooncake_multi_node.md#L219-L275
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L132-L181
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/memcache_backend.py#L150-L168
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L112-L119
verified: []
evidence: "C"
relations:
  - {to: hardware-devices, kind: builds-on, note: 先认识参与计算的设备}
  - {to: collective-communication, kind: builds-on, note: 先掌握 rank、通信组和通信结果}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: A0 启动时建立通信域，16 卡分组与显存预算在部署页统一推导}
  - {to: tensor-parallel, kind: builds-on, note: 张量并行把一层分给多张卡，部分和要靠 HCCL 合齐，具体数据流在张量并行页读}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一张卡上的通信请求，怎样到达另一张卡？

**CANN 是连接框架与昇腾设备的计算软件体系；HCCL 是其中负责组织多卡数据交换的通信库，物理链路承载实际传输。** CANN 提供算子（矩阵乘等具体运算）、运行时（安排设备执行与资源）和图执行等能力。vLLM 组织推理，vllm-ascend 把计算与通信接到昇腾的软件接口上。

下图只画两张卡，各自以一个 [rank](collective-communication.md#两张卡交换以后各自手里多了什么) 参加一次 [All-Reduce](collective-communication.md#all-reduce)(SUM)：做完后两张卡都拿到对应位置之和。

```wiki-diagram
file: cann-hccl
```

沿实线箭头向下看：框架交出张量、参与的组和求和要求，CANN 里的 HCCL 安排收发与归约，设备通过链路交换数据；虚线箭头表示结果就绪后交回各自的后续计算。两侧都要参加同一操作。图中软件框代表各端的职责，省略中间适配层和传输轮次；卡图标表示逻辑设备。HCCL 既支持同组共同参与的[集合通信](collective-communication.md#两张卡交换以后各自手里多了什么)，也支持指定两端之间的点对点收发，适用于单机和多机。

## 为什么本地算完，还要等通信？

**把计算分到多卡，也把一次计算需要的输入和结果分散了。** 例如矩阵按输入维切分后，每卡只算出部分和，后面的运算要等各卡贡献相加。GLM 双机主干的一次前向共有 **218 个通信调用边界**；即使请求很短，也会经过这些交接点，次数汇总见[一条请求](one-request.md#一次前向的通信账)。一次调用可包含多轮传输，调用次数与网络包数是不同的量。

在普通稠密层里，attention（从历史提取当前所需信息）的输出投影后、MLP（逐位置的前馈变换）的降维后各归约一次。计算只在需要远端结果的依赖处等待，并非每个通信调用都让全部进程做全局屏障。一次通信要付出发起、传输、归约及等待参与者的时间，还需要设备缓冲；缓冲怎样挤占显存见 [HCCL 缓冲](gap-a5164fe10fa9184412f8.md)。

先分清相邻的四层职责，才能判断该检查哪里：

| 层次 | 决定什么 | 本页的例子 |
|---|---|---|
| 并行计算 | 谁保存、计算哪一片 | [TP](tensor-parallel.md) 分矩阵，[EP](expert-parallel.md) 分完整专家，[DP](data-parallel.md) 分请求或批次 |
| 通信操作 | 结束后每个参与者拿到什么 | All-Reduce 合齐数值，[All-Gather](collective-communication.md#all-gather) 收齐分片 |
| 框架接口与通信库 | 怎样提交并组织这次操作 | 框架指定张量与组，HCCL 组织执行 |
| 物理链路 | 字节沿什么连接搬运 | HCCS、RoCE、PCIe、Unified Bus 等 |

HCCS 是昇腾设备互联，RoCE 是基于以太网的远程内存访问通信，PCIe 连接主机与设备等部件，Unified Bus 是统一互联总线。具体可用路径取决于产品、拓扑与软件配套。All-Gather、All-to-All 等操作的输入输出与传输量统一见[通信基础](collective-communication.md)，网线或总线的名称无法决定应该拼接还是求和。

## 数据精度和本地计算，怎样影响通信？

**计算决定要交接的张量，张量的数据类型决定每个元素占多少字节。** BF16 用 16 位表示浮点数，每元素 2 B；int8 用 8 位整数，每元素 1 B。相同形状换类型会改变逻辑载荷，但应先确认实际传给通信操作的类型。

W8A8 表示可量化层的权重与激活用 8 位表示；计算过程中还会用缩放参数恢复数值范围，输出可以恢复为 BF16。因此权重采用 W8A8，并不意味着层间 hidden（隐藏向量）也按 int8 传输。

本部署两种情况都有。TP 归约交给通信的是 BF16 部分和，每元素 2 B。**MoE**（每个 token 只交给少数几个专家计算的前馈层）把输入派发（dispatch）到专家所在的卡时，会先量化再发送：发出去的是 int8 隐藏向量，外加每个 token 一个 FP32 缩放系数（per-token scale），一个 token 发往一个专家的副本是 4096 B + 4 B = 4,100 B；收回（combine）的专家结果仍是 BF16。每类通信的字节账见[一次前向的通信账](one-request.md#一次前向的通信账)。量化细节见[量化](quantization.md)，矩阵如何产生部分和见[矩阵乘与权重](matmul-and-weights.md)。

All-Reduce 还必须约定归约操作；SUM 是求和，也可按接口选择乘积、最大值或最小值。各参与者的类型、元素数、操作与调用次序必须按接口匹配。涉及拼接或不等长交换时，发送分片与接收分片的约定也要对应。通信库知道这些约定，才能组织正确的结果。

## 放到 GLM 双机：先建组，再沿一个 token 看交接

**HCCL 在 A0 启动阶段接入，在 A4 逐层计算中反复使用。** 本页挂靠[部署主线的“启动时发生了什么”](glm-5-3-flash-two-node.md#启动时发生了什么)：先初始化设备通信，再建立模型并行组，之后才能加载、预热并执行模型。固定配置为两台 A2、每台 8 卡，TP8 / DP2 / EP16；完整前提和分组推导见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

### 启动时，同一张卡加入不同的组

**一个 rank 可以属于多个通信组；每次调用要选对组。** 下文的编号都是全局 rank：机器 0 上是 0–7，机器 1 上是 8–15。组员落在哪台机器上，决定了字节走哪条链路：

- **TP 组** {0…7} 与 {8…15}：每组 8 个 rank 都在同一台机器里，用来合算矩阵，走机内 HCCS。
- **DP 设备通信组** {0,8}、{1,9} 直到 {7,15}：把两台机器上同号的卡配对，每组两端分处两台机器，只能经跨机的 RoCE 传输。
- **EP 组** {0…15}：两台合起来才持有完整的路由专家集合，所以这个组覆盖全部 16 个 rank，用来把输入送到专家所在的卡、再收回结果；下文的 MC2 也在这个组里执行。发往另一台机器的部分经 RoCE；同一台机器内的部分走 HCCS 还是网卡，取决于 HCCL 在 A2 上的机内设置与 MC2 的通信算法。GLM 教程的启动脚本没有设置相关变量，本部署的实际路径仍待核。

HCCS 与 RoCE 的带宽规格在[硬件设备](hardware-devices.md#官方带宽规格能说明什么)统一列出，本页不重复。

请求执行只分两份：DP2 的两个成员各起一个 EngineCore（引擎进程），各管本机 8 张卡。数据交接却有八个跨机配对的 DP 设备通信组，两者不要混为一谈。引擎之间另有 **gloo** 提供的 CPU 通信组，用两个 int32 元素同步“还有没有工作”和“是否请求暂停”；这是控制状态，与 HCCL 承载的设备张量分开。各卡还可通过组内 CPU 通道同步元数据，详见部署页。

### 执行时，输入、部分和与专家结果依次交接

**跟着一个 token 看，每过一个交接点，框架都先确定本次张量和参与者。** token 是分词得到的基本单位，进入模型时用词表编号表示；它的隐藏向量经过每层计算。TP8 中，attention 的输出投影把本卡贡献交给机内 All-Reduce；稠密 MLP 的降维后再合齐一次。

本部署这些 TP 归约的逻辑张量是 [T,4096] BF16：T 是本轮新计算的 token 行数，每行是一个 token 的 4096 维子层输出。**R1 是[请求主线](one-request.md#示例请求-r1-与官方双机部署)中提示词长 4 个 token 的示例请求**；它首次处理提示词时，每次这类 TP 归约的逻辑载荷为 **32 KiB/卡**。字节推导仍在[主线通信账](one-request.md#一次前向的通信账)，这个数不含底层转发、协议与重传。GLM 把隐藏向量复制成 4 条并行残差流（mHC），但 TP 归约只对子层输出 [T,4096] 做一次，不按 4 条流重复计算。

后续 MoE 层用专家网络计算前馈结果。R1 的小批输入走 **MC2**，即昇腾的一类计算与通信协同实现：在 EP16 中派发给被选专家，计算后收回，再在 TP8 中收齐本组行布局；共享专家是每个 token 都会经过的前馈分支，还需合齐其 TP 部分和。每个 MoE 层的前馈段有四个通信边界，attention 的一次归约另计。大批输入改用名为“AllGather”的 MoE 通信方式（名称沿用源码，不是单指一次 All-Gather 操作），这四个边界换为两次 DP 收集、一次 DP [Reduce-Scatter](collective-communication.md#reduce-scatter) 和一次 TP 归约，原因见[大批输入为什么改用 Reduce-Scatter](collective-communication.md#大批输入为什么改用-reduce-scatter)。选择条件与全部形状见[通信基础的 GLM 段](collective-communication.md#放到-glm-双机一个-token-会在哪里通信)。

## AI QoS 怎样处理共享链路上的争用？

**AI QoS 让支持的交换网络按流量类别安排服务先后，解决的是出口拥塞时谁先走。** 例如计算正等集合通信结果，而 KV cache（保存历史计算状态的缓存）正在主机与设备间搬运；两类流量同时到达同一出口、超过出口处理能力时，就会排队。

在支持的 Unified Bus 拓扑中，**Virtual Lane（VL，虚拟通道）**把流量分到不同逻辑通道，再按优先级调度。高优先级先服务，可减少关键通信的排队；当高优先级流量占住出口时，低优先级就要继续等待。总链路带宽仍由硬件决定，请求什么时候进入模型仍由推理调度器决定（例如 [ShortRequestFirst](short-request-first.md)、[Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)），VL 不读取提示词、生成进度或 token 预算。

本节的 UB 是 Unified Bus；[AI Core](ai-core.md)中的 UB 是片上 Unified Buffer。这里的 SP 表示 strict priority（严格优先级），与[序列并行](sequence-parallel.md)缩写相同、含义不同。固定文档把 AI QoS 限定在 Atlas 800T A3 / Atlas 900 A3 SuperPoD；本页 A2 双机主线没有启用它的证据。下面将其配置和版本边界单列，便于在相应硬件上查用。

## 常见误解

- **“网络连通，一次集合通信就能完成。”** 网络只解决到达问题，程序还必须使用正确的组，并使形状、类型、收发约定和调用顺序匹配。
- **“HCCL 与 HCCS 是同一个东西。”** HCCL 是通信库，HCCS 是互联方式；库还可支持其他链路。
- **“所有通信都经过同一个普通接口。”** 普通张量通信和 MC2 等专用实现有不同入口，应沿本次算子的实际调用核对。
- **“W8A8 让所有通信字节都减半。”** 本部署的 TP 归约仍传 BF16；只有 MoE dispatch 这一段因量化改传 int8 加缩放系数，combine 仍是 BF16。通信量取决于每次交给通信操作的实际张量类型。
- **“优先级调高就能增加带宽，运行脚本就配置完交换机。”** 优先级改变服务次序；脚本写入端点后打印交换机命令，交换机仍需单独执行与验收。

## 对照源码

### 怎么开

普通 HCCL 通信由 Ascend Worker 的分布式初始化接入，固定执行快照在 `_init_worker_distributed_environment` 中传入 `hccl` 后端，然后调用 `ensure_model_parallel_initialized` 和 `init_ascend_model_parallel`。按[部署命令](glm-5-3-flash-two-node.md#怎么开)设置并行规模即可进入这条路径；CANN 的安装、驱动、固件、PyTorch / torch_npu 与框架版本仍须分别记录并核配套。

```wiki-diagram
file: cann-hccl-flow
```

图将 A0 的建组与 A4 的使用分开。普通 All-Reduce/All-Gather 由上游设备通信器把张量和 `device_group` 交给 `torch.distributed`。Ascend 的普通 All-to-All 先按发送维切片，再交换，最后按接收维拼接；两组 split sizes 同时提供时走指定长度分支，否则按组大小切分。MC2 等专用入口另见[通信基础](collective-communication.md#mc2)。

AI QoS 是独立的设备与交换机配置工具。固定快照 `db701c1f` 要先构建并安装 AI QoS 扩展，将 DSMI 头文件与设备管理库挂入容器并按实际路径传给构建命令。文档要求特权容器、Ascend HDK 25.5.2+、UB Switch LingQu Computing Network 1.5.1+。满足适用硬件条件后，在推理任务前运行 `python tools/ai_qos.py` 采用 auto 默认配置；manual 模式可只指定需要修改的流量等级。

| 固定快照配置键 | 文档对应流量 | 默认等级与可选范围 |
|---|---|---|
| `AIV_D2D` | AIV（向量核）发起的设备间派发 / 收回 | high；high / middle / low |
| `AIV_H2D` | AIV 路径的算子下发 | high；high / middle / low |
| `SDMA_D2D` | SDMA 数据搬运路径的 All-Reduce / All-Gather | high；high / middle / low |
| `SDMA_H2D` | SDMA 路径的 KV offload / prefetch，即历史状态换出 / 预取 | low；high / middle / low |
| `PCIEDMA_H2D` | PCIe DMA 路径的算子下发 | high；仅 high / low |

D2D 指设备到设备，H2D 指主机到设备；该表中 KV 换出还包括反向的设备到主机传输。DMA 指直接搬运数据的硬件机制，表中各前缀用于区分搬运通道。固定文档明确：受驱动限制，AIV 两项设置当前不生效。

在脚本默认配置中，SDMA 两类流量共享源标签 **2**。交换机结合初始 VL 区分方向，再把 D2D 映射到 **VL 2、优先级 3**，H2D 映射到 **VL 3、优先级 1**。这些编号来自该脚本的映射表；其他版本应核对自己的表，而非把数字视作网络通用约定。

脚本写入端点状态，并打印 `hccs qos remap` 等交换机命令；操作者还需登录交换机执行，已有配置须事先备份。`python tools/ai_qos.py unset` 恢复保存的端点首次应用快照，打印交换机 `undo` 命令。它保存的是端点相关状态及自己生成的命令，不是整台交换机原配置。这些设置也不跟推理进程绑定：脚本在推理任务之前单独运行，推理进程退出后端点与交换机配置照旧生效，要恢复必须显式执行 `unset`，再登录交换机执行打印出的 `undo` 命令。

### 会报什么错

先按失败阶段定位：A0 建组失败要核参与进程、rank 与组配置；A4 某次调用等待要核所有参与者是否进入同一通信及其张量约定，再结合设备和链路日志判断。单凭超时无法区分成员未到达、算子先出错或链路故障。

QoS 的 `unset` 找不到快照时打印 `No state file at ...; nothing to undo.` 并退出。恢复 SDMA 或端点全局配置失败会打印带设备号和返回码的警告；“打印了 undo”只说明生成了交换机恢复指令，不能据此认定交换机已恢复。

main 上 KV 传输的 `qos_priority` 不是 0–4 的整数（布尔值也不行）时，PD 分离连接器或 KV 池后端在启动阶段抛 `ValueError`；环境变量 `ASCEND_GLOBAL_RESOURCE_CONFIG` 里原有的 QoS 值会被覆盖，并打一条 warning。日志 `Injected comm_resource_config.qos=...` 只说明本地环境已写入，不能证明某条传输通道用了这个值。

### 开销和什么时候别开

HCCL 通信要占用设备缓冲并等待所需数据，预算见[通信缓冲](gap-a5164fe10fa9184412f8.md)。先确定瓶颈是传输量、启动延迟还是参与者到达不齐，再判断并行策略；精确带宽与耗时需要通信 trace 和设备实测。

AI QoS 适用于受支持拓扑上的流量争用。提高关键流量优先级会改变其他流量的等待时间，验证要同时覆盖集合通信与状态换出 / 预取。A2 主线不套用 A3 的交换机配置；在无争用时，也不能由优先级表推出加速比例。

### 版本差异

下表比较登记的 v0.23 维护分支、v0.26.0rc（2026-09-17 快照）与 main（2026-09-21 快照）。对应提交依次为 `2c59ff10`、`2ed6cbba`、`baa023ad`；固定 GLM 执行快照另为 `db701c1f`。

| 核对项 | v0.23 | v0.26.0rc | main |
|---|---|---|---|
| Worker 设备通信后端 | 显式使用 hccl，再初始化模型并行组 | 相同 | 相同 |
| AI QoS 是否存在、默认模式 | 有独立脚本，默认 auto | 相同 | 相同 |
| 文档调用入口 | python tools/ai_qos.py | 相同 | python -m tools.ai_qos |
| QoS 键与默认等级 | 五键；AIV 两项 high、SDMA D2D high / H2D low、PCIEDMA high | 相同 | 三键 AIV high、SDMA low、PCIEDMA high |
| 可选等级 | 前四键 high / middle / low，PCIEDMA_H2D 仅 high / low | 相同 | 三键均 high / middle / low |
| 映射依据 | 按 D2D / H2D 初始 VL 区分，同类端点源标签取两项较小值 | 相同 | 按通道类型配置；两种 cacheable / noncacheable 初始 VL 都生成映射 |
| 默认目标 VL / 优先级 | AIV D2D 为 2 / 3、H2D 为 5 / 3；SDMA D2D 为 2 / 3、H2D 为 3 / 1；PCIEDMA H2D 为 5 / 3 | 相同 | AIV 为 2 / 3，PCIEDMA 为 3 / 3，SDMA 为 4 / 1 |
| 恢复与执行边界 | 恢复端点首次快照，打印交换机 undo | 相同 | 相同 |
| 硬件与驱动限制 | A3 指定产品；AIV 两项不生效；HDK / 交换机最低版本同上 | 相同 | A3 指定产品与最低版本相同；文档写 AIV 不生效 |
| 推理引擎内的 KV 传输 QoS 入口 | 无 | 无 | 有：kv_connector_extra_config 的 qos_priority，整数 0–4 |

main 新增的 `qos_priority` 与 AI QoS 是两套东西。它写在 KV 传输配置的 `kv_connector_extra_config` 里，只由 PD 分离的三个 Mooncake 连接器（MooncakeConnectorV1、MooncakeHybridConnector、MooncakeLayerwiseConnector）和 KV 池后端读取。连接器在建立传输引擎前，把它写进环境变量 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 `comm_resource_config.qos`，不填时用 P/D 默认值 **1**；KV 池后端只在显式填写时写入，Mooncake 后端写 `store.comm_resource_config.qos`，Memcache 后端写 `MF_DEVICE_UB_QOS`。这里的 0–4 是 KV 传输通道的 QoS 值，与本页 AI QoS 的 high / middle / low 等级、VL 编号和交换机优先级不是同一套编号。一条 PD 连接实际用哪一端的值，由发起传输的一端决定：pull 用 decode 侧，push 用 prefill 侧。本页 GLM 双机主线没有配置 KV 传输，用不到这个入口；机制见 [PD 分离](pd-disaggregation.md)与[外部 KV 池](kv-pool.md)。

固定 GLM 快照的五键定义、默认值与恢复逻辑和表中 v0.23 / v0.26 一致。三版这里只核通信初始化、QoS 工具与 KV 传输的 QoS 入口，CANN 9.1.0 文档用于解释软件职责，完整镜像配套另需核验，因此本页不把整套部署标成三版均已验证。

### 源码位置

- CANN 的计算软件职责、HCCL 的通信能力及链路列表来自官方 CANN 9.1.0 文档；All-Reduce 的四种归约操作也在其中。[S1][S2]
- 固定 Worker 初始化与普通通信封装，支撑第二张图的 A0→A4 顺序和普通 All-to-All 分支。[C3][C4][C5]
- TP / DP / EP 的成员生成与 CPU 两元素状态同步，支撑本页通信域对照。[C18][C19]
- 固定快照 MC2 派发器的注释写明：A2 上可用 HCCL 的机内环境变量改变机内走法、减少跨机流量，支撑 EP 组机内路径“取决于设置”的说法。[C29]
- AI QoS 的争用动机、VL 隔离与严格优先级，以及构建、五类流量和硬件约束，来自固定执行快照官方指南。[S6][S7]
- 固定 QoS 映射、端点写入与交换机命令生成、参数默认值、恢复与失败分支，支撑上文的默认配置与恢复边界。[C8][C9][C10][C11]
- 三版 Worker 均显式选择 hccl 后端；三版脚本对应版本表中的五键→三键变化与恢复边界。[C12][C13][C14][C15][C16][C17]
- 三版官方指南分别确认构建方式、硬件 / 软件条件与 AIV 驱动限制。[S20][S21][S22]
- main 的 KV 传输 QoS 入口：P/D 默认值 1 与 0–4 校验、KV 池后端的校验、Mooncake 连接器在建传输引擎前的调用、官方 PD 教程写明的发起端规则与日志含义，以及 Mooncake / Memcache 两种 KV 池后端各自写入的环境变量；v0.23、v0.26 与固定快照中都没有这些调用。[C23][C24][C25][S26][C27][C28]

**待核：** 缺少固定 GLM 镜像的完整 CANN / HCCL、驱动与固件配套清单，及真实通信 trace；尚不能确认本次运行的底层算法、EP 组机内部分的实际链路、物理链路带宽或 QoS 收益。218 次与 R1 的 32 KiB 是固定主线的调用 / 逻辑载荷口径，均不代表已实测的网络包数或收发字节。
