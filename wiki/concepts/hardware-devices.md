---
id: hardware-devices
title: NPU、板卡、服务器与机柜
type: concept
summary: >-
  分清芯片、板卡、服务器与软件可见设备，沿 GLM 双机的一条输入理解主机内存、设备显存、机内 HCCS 与跨机 RoCE
  的边界，并核对官方规格峰值和启动源码。
aliases:
  - NPU
  - 昇腾芯片
  - device
  - 卡
  - 单卡
  - 加速卡
  - 机器
  - 节点
  - 服务器
  - 单机
  - Atlas A2
  - Atlas A3
  - 超节点
  - SuperPoD
  - Atlas 900 A3 SuperPoD
  - 内存池化
  - MemFabric
  - MemCache
chapters:
  - '07'
  - 08
order: 100
sources:
  - 'https://www.hiascend.com/developer/techArticles/20240914-1'
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - 'https://www.hiascend.com/developer/techArticles/20251203-5'
  - >-
    https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2
  - 'https://e.huawei.com/cn/products/computing/ascend/atlas-800t-a2'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L138'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L395-L503'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L524'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1535-L1560'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1758-L1772'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L138'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L281'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L127-L137'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L280'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L82-L92'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237'
  - >-
    raw:sha256-9a71c5e275ab2ca3591da54fcaba5bb8a352680d097760b4adf5f7e8a6d65d13.md#L1-L366
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L85-L99'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L232-L244'
  - 'vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L284-L304'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
verified: []
evidence: C
relations:
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: A0 的设备边界确定后，继续看 16 卡分组、每卡权重和启动预算
  - to: npu-platform
    kind: builds-on
    note: 看平台契约怎样落实设备选择、配置校验与后端选择
  - to: kv-pool
    kind: builds-on
    note: 想继续了解内存池化时，区分外部对象缓存与本地状态池
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-4ad0a826ee278a8aae4b53a6b9dd14ca60685672bead700eda86212d11dd24a5.md
  - >-
    raw/sha256-9a71c5e275ab2ca3591da54fcaba5bb8a352680d097760b4adf5f7e8a6d65d13.md
---

## 一张“卡”和一台“机器”有什么区别？

**NPU 是擅长并行计算的处理器；板卡承载芯片及配套电路，服务器容纳主机处理器、主机内存和加速部件，机柜再安装服务器与交换机。** 程序实际选择的是运行时暴露的 **Device（设备）**：选定它，才知道在哪分配设备内存、把计算提交给谁。

模型把文字切成 **token**，即用整数编号表示的小段，再转成向量，排成按行列组织的**矩阵**交给 NPU 算。主机内存保存 CPU 使用的数据，设备显存保存 NPU 使用的权重和计算状态；**平台契约**则约定软件怎样选择设备、查询能力、调用对应实现。本页挂靠[部署主线 A0：启动](glm-5-3-flash-two-node.md#启动时发生了什么)，先认清这些计算发生在哪里。

```wiki-diagram
file: hardware-devices
```

图中虚线展开服务器内的板卡，双向箭头表示数据传送，单向箭头表示程序绑定设备。蓝色部件是设备内存；主机内存另在服务器中。设备与板卡、芯片怎样对应，由具体产品和运行环境决定，图不规定跨型号的换算关系。芯片内部怎样算，继续看 [AI Core](ai-core.md)。

## 为什么多几张卡，还会多出等待？

**分给更多设备能减轻每卡的存储和计算负担，也会让一部分结果必须过链路才能继续。** 本部署所列主要语言权重子账约 **20.58 GiB/卡**，视觉塔、MTP 旋转矩阵和量化辅助张量等还要另计；还要容纳历史状态与临时结果。容量的版本条件与表外项见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。主机内存再大，也要经过数据传送才能成为 NPU 本次计算可用的输入。

**HCCS** 是昇腾处理器间的高速互连，本部署用它连接机内设备；**RoCE** 是在以太网上承载远程直接内存访问的协议，让设备经网络接口跨机传数据。**HCCL** 是组织多卡通信的软件库：它决定哪些参与者一起交换张量，底层利用相应物理链路；它与链路怎样分层见 [CANN 与 HCCL](cann-hccl.md)。网络接口可以由 NPU 直出，具体形态取决于机型，不能一概画成独立 PCIe 网卡。

**TP（tensor parallel）**把同一层的矩阵切开合算；**EP（expert parallel）**把完整专家分给不同设备，专家就是一段可独立执行的前馈网络。下面沿用 [TP 通信账的执行条件](tensor-parallel.md#从一层走到整次前向r1-的通信账)：关闭 SP（把中间张量按 token 行分给各卡的并行方式），共享专家按 TP 切分，并使用普通归约路径。GLM 主干 45 层的每一层都先过 attention（读取历史信息），它的输出投影在各卡产生部分和，要做一次 **All-Reduce**：把各卡的部分结果逐元素相加，让每卡拿到完整数值。下一段计算要用这个结果，就要等它到齐。每层随后的前馈网络再合一次，前 3 层与其余 42 层的区别只在这里：前 3 层是稠密前馈网络，在降维投影后归约；其余 42 层是 **MoE** 层，由多个专家组成、每个 token 只选择部分专家，其中所有 token 都经过的共享专家归约一次，此外还需把输入送给被选专家，再收回结果。在上述条件下，每层 2 次 All-Reduce，加上开头按 token 编号查表之后的 1 次，一次主干前向共 91 次；通信次数与特殊路径见 [TP](tensor-parallel.md#切开以后要付的代价)和 [EP](expert-parallel.md)。逐层反复的归约留在机内走 HCCS，专家的派发与收回遇到另一台机器上的专家时才走 RoCE，原因在下一节展开。

| 层级 | 它回答什么 | 不同对象怎样联系 |
| --- | --- | --- |
| 芯片、板卡、服务器、机柜 | 东西装在哪里 | 物理包含关系，具体布局查产品手册 |
| Device | 程序在哪分配、执行 | 运行时枚举，再按可见编号选择 |
| rank 与通信组 | 谁与谁协作 | rank 是分布式参与者编号，组内按约定通信 |
| TP、EP | 模型怎样分工 | 软件分组映射到设备，再由链路传送结果 |

## 放到 GLM 双机：一个 token 会经过哪些设备？

**两台机器各接收自己的请求，遇到分散的专家时仍要协作。** 沿用[官方部署前提](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2，每台 8 个可见设备，TP8、DP2、EP16。DP 是分别调度请求的执行组；这里每台一个组。两台合起来持有完整的路由专家集合，每台都需要另一台的专家。

### 先选设备，再把输入交到卡上

**两个主机上的“设备 0”是不同设备。** 每台运行时都看见本地设备 0–7；用于跨机协作的全局 rank 则在机器 0 上为 0–7，在机器 1 上为 8–15。一个 worker 是负责设备执行的工作进程，本部署每卡一个。完整分组与编号推导统一见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

跟踪[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)：它的提示词有 4 个 token，假定交给机器 0。主机先接收文本、分词、安排本轮计算，再把输入交给设备。看其中一个 token，它在卡上查权重表变成隐藏向量，也就是层间不断更新的一行数字；权重和后续历史状态都留在各自设备的显存中。

### 机内合算矩阵，跨机寻找专家

**TP8 把每层反复出现的结果合并留在本机；EP16 让输入按专家位置跨两台机器。** token 经过 attention 和前馈网络时，本机各卡拿自己的矩阵分片计算，通过 HCCS 合齐结果。进入 MoE（由多个专家组成、每个 token 只选择部分专家的前馈层）时，选中的专家可能在另一台机器；输入向量经 RoCE 发过去，远端卡计算后再把专家结果送回来。本地专家在本地处理。

因此跨机传送的是本次计算所需的向量与结果，专家权重常驻持有卡。机器 1 即使没有自己的请求，也可能接到 R1 的专家工作。R1 在各卡上的形状、字节数和通信总账留在[一条请求的第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)，本页只把那些通信落到硬件路径上。

### 官方带宽规格能说明什么？

**规格峰值描述硬件能力，推理等待还受传输大小、通信算法、拥塞和同步影响。** 为给机内与机间链路提供可追溯的数字，下面引用 **Atlas 800T A2 技术白皮书第 16 版**。教程只写“Atlas 800 A2”；这张表取自 Atlas 800T A2 白皮书，其标题写明是**训练服务器**，是明确型号的规格参照，不能直接当成部署机规格；现场完整型号与同系列其他型号的规格仍须核对。

| 对象 | 官方规格峰值 | 统计范围 |
| --- | --- | --- |
| HCCS | 最大理论带宽 **392 GB/s** | 每路 AI 处理器的 **7 条 HCCS 链路**；8 路处理器组成 Full mesh，即两两互连 |
| RoCE 接口 | 每接口 **200 Gbit/s**，整机提供 **8 个 200GE QSFP 接口** | 单个网络接口速率；NPU 可直接引出接口 |

HCCS 这行统计一颗处理器的多条链路，RoCE 这行给单端口速率，范围不同。白皮书表 5-2 没有进一步标出 392 GB/s 的单向／双向口径，所以这里保留原始定义，不计算两者倍率。两项都属于**规格峰值，不是实测值**；尤其不能把 392 GB/s 当成任意两卡之间单条链路的速率。

RoCE 的小写 b 表示 bit，HCCS 规格中的大写 B 表示 byte。只做单位换算时：

```calc
title: 单个 RoCE 接口的规格速率换算
单端口字节速率 = 200 Gbit/s ÷ 8 = 25 GB/s
> 十进制单位；未扣除协议开销，不代表应用有效吞吐
```

这个换算有助于读懂规格，不能拿它直接预测一轮推理时间。TP 放机内是为了让反复同步利用机内互联；EP 跨机换来专家容量分摊，同时承担跨机派发与收回的成本。

## 主机内存和设备显存分别记什么账？

**CPU 上的进程数、主机内存容量与 NPU 的显存预算是三本不同的账。** A0 的核心功能角色示意账合计 20，其中 16 个 worker 各占一张卡；其余前端、协调器和引擎组织任务。这份账不含启动器、持续监控的父进程和运行时辅助进程，不能当成操作系统的进程总数。角色分布见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。

主机内存用于文本、请求队列、调度记录和加载中转；设备显存用于本卡权重、历史状态、临时张量、通信与图执行资源。**HBM** 是加速器使用的高带宽内存。**KV cache** 保存可供后续 token 使用的历史表示；GLM 的不同注意力还保存各自所需的状态，不能都视为普通的 K/V 数组。

启动时先确定设备与通信环境，加载本卡权重，再测量非缓存占用，把预算内剩余容量分给历史状态池。运行中一个请求能占多少，取决于本卡状态布局与池的可用块，而不是把两台机器的所有内存加成一个地址空间。预算公式和块数只在[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)推导。

官方教程与白皮书的设备容量写作 **64 GB**；部署页为教学算例显式假设 **64 GiB**。GB 和 GiB 的单位基数不同，前者不能直接当成后者。运行时还会保留系统内存，实际可用量要在选定设备后查询；现场值与教学假设分开记录。

## 超节点和内存池化会改变这些边界吗？

**超节点用高速互联组织更多计算资源，软件仍需管理分片、状态归属与远端访问。** 普通双机与特定超节点产品的拓扑、能力不同。Atlas A2、Atlas A3 只是产品系列称呼；描述环境要记录完整型号、软件可见设备数和每设备可用显存，同系列内部也应按手册核对计算单元布局。

官方 Atlas A3 实践中的 **MemFabric** 提供跨节点、跨介质的统一编址与内存访问，**MemCache** 在它之上提供对象的 Put/Get，也就是按键存入、取出数据，可用于历史状态缓存池。统一编址使应用能用统一的地址语义表达访问，数据的物理位置依然存在；对象接口再用键定位数据。HCCL 按通信组和操作组织张量交换，解决的是另一层问题。

假设可复用状态在机器 B，下一次执行在机器 A：先**查找身份与位置**，再**判断能否复用**，然后**访问或传输数据**，最后**恢复成 A 能消费的状态布局**。查到对象只是第一步。减少中转副本可以改善数据路径，远端传输仍有成本；容量池变大是否有收益，要结合命中、传输、布局兼容和同步评估。

[prefix caching](prefix-caching.md)解释哪些历史可以复用，[KV Pool](kv-pool.md)解释外部存储怎样接入推理。内存池化需要额外软件与资源管理；本页的 GLM 双机配方没有据此启用 MemFabric/MemCache。

昇腾 950 的 PR/DT 型号、内存与端口规格集中在[950 架构页](ascend-950-architecture.md)，任务、通信和远端访问怎样衔接见[950 执行与互联](ascend-950-execution-interconnect.md)。阅读时沿用本页的设备层级与带宽口径，再核对具体软件支持；不要把新型号能力套到上述 A2 配方。

## 常见误解

- **“一个设备就是一块物理板卡。”** Device 是软件边界，具体映射按型号与运行环境核对；“卡”在本部署中是可见 NPU 设备的简称。
- **“两台机器就是两份完整模型。”** 本部署每台一个 DP 执行组，路由专家由全部 16 卡共同持有。
- **“连到同一机柜，就能直接用所有显存。”** 机柜负责安装，数据仍须经过链路和软件协议；统一编址也不会抹去远端访问成本。
- **“HCCL 就是 HCCS，RoCE 必定是一张独立网卡。”** 前者是通信库，HCCS 是互连；RoCE 接口在所引 Atlas 800T A2 上可由 NPU 直出。
- **“看到峰值就能算出加速比。”** 多链路聚合、单端口速率和应用有效吞吐必须分开；本页没有从规格推算推理加速比。

## 对照源码

### 怎么开

先按[官方双机命令](glm-5-3-flash-two-node.md#怎么开)准备每机设备可见性、网络地址和并行组。`ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5,6,7` 选择本机运行时可见设备；TP8、DP2 是教程显式配置，硬件名称本身不会自动建好这些组。网络侧按现场填写 `HCCL_IF_IP`、`HCCL_SOCKET_IFNAME` 等接口配置。

在 CANN 接口层，`aclrtGetDeviceCount()` 查询可用设备数；在支持相应接口与内存属性的产品上，选定 Device 后再用 `aclrtGetMemInfo` 查询设备内存，返回总量不包含系统预留。具体产品支持表应按所用 CANN 版本核对。在 vLLM-Ascend 中，对应路径是 `NPUPlatform` 声明设备身份，`NPUWorker.init_device()` 调用 `_init_device()`，用 `torch.npu.set_device()` 绑定，再创建通信环境和 ModelRunner（组织设备计算的组件）。

```wiki-diagram
file: hardware-device-startup
```

图把 A0 的设备准备放在 A1 接收请求之前。可见编号或显存检查失败，就在设备初始化处退出；通过后先建 HCCL 通信与并行组，再创建 Runner。后续加载、预算和预热的完整时序见 [Worker 生命周期](npu-worker-lifecycle.md)。

### 会报什么错

固定 GLM 执行侧中，`DP adjusted local rank ... is out of bounds for ... devices` 表示调整后的本地编号超出当前可见设备数；先核对设备暴露、可见列表和本机进程规模。`Free memory on device ... is less than desired GPU memory utilization` 表示启动时空闲显存低于配置预算，核对同卡其他进程占用与预算比例。

手动设置缓存大小也不能据此视为绕过启动内存检查：固定源码中，`kv_cache_memory_bytes` 为真值时仍调用 `profile_run()`，但跳过后续内存 profiling 的计算。[C11] 启动内存检查位于前面的设备初始化路径中，这个预算分支没有取消它。[C9]

分布式初始化卡住时，分别检查两端地址、接口、可见设备、rank 和组规模。能枚举本机设备，只证明本机运行时可见；跨机通信还依赖两端网络配置与同组参与者完成对应初始化。具体错误位置和上下文要保留，不能用型号或端口峰值代替排查。

### 开销和什么时候别开

设备可见性是执行前提，TP/EP 规模则应结合容量与通信选择。多卡让可分片的工作分摊，也增加同步、通信缓冲和跨机传输；跨机 TP 会把逐层同步延伸到网络。具体容量选择引用[双机与单机对照](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

MemFabric/MemCache 应在确有跨节点状态复用需求、软硬件支持且命中收益覆盖传输成本时引入。硬件峰值不能代替有效吞吐；本页没有真实 NPU 枚举、网络基准或超节点性能测量。

### 版本差异

**v0.30.0rc2 保留 NPU/OOT 平台身份和设备可见性接口。** device_type 仍为 npu，设备可见变量仍为 ASCEND_RT_VISIBLE_DEVICES；查询总显存前必须完成 NPU 初始化，随后读取 mem_get_info(device_id) 的总量，默认设备号 0 不是“零张卡”。HardwareProfile 将设备类型映射为 CPU 绑定、MoE 通信等软件策略；新增或调整软件画像不改变本文固定 A2 的物理核数和容量。

硬件规格不会随 vLLM 分支变化；变化的是软件怎样暴露和查询设备。下面按项目钉点检查平台声明与总显存查询接口，范围限于这两个行为；GLM 主线执行侧仍固定在 `db701c1f`，不能套用 main 的实现。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad |
| --- | --- | --- | --- |
| NPU 平台、设备类型与可见变量 | 有；类型 npu，变量 ASCEND_RT_VISIBLE_DEVICES | 同左 | 同左 |
| 平台总显存查询的默认设备号 | 0；这不是可见设备数 | 0，相同 | 0，相同 |
| `get_device_total_memory()` 行为 | 主动抛 NotImplementedError，避免过早初始化 | 相同 | 未初始化仍抛异常；已初始化才调用 mem_get_info 返回总量 |

三版都没有在上述平台声明中给所有产品写死设备数量或显存规格。固定 GLM 版本的 Worker 在选卡后取内存快照做预算；平台查询接口不可用，不等于 Worker 永远拿不到显存信息。MemFabric/MemCache 是所引 A3 官方实践的独立软件层，本表没有把它们列为三版默认能力。

### 源码位置

- 固定 GLM 平台声明：`platform.py:128–138`；设备选择、快照与检查：`worker.py:395–524`；自动预算：`527–597`；HCCL 与并行组初始化：`975–988`。
- 全局 rank 偏移：上游 `parallel_state.py:1535–1560`；TP 分组：`1758–1772`；DP/EP 分组：`1833–1875`。
- 三版总显存查询：`platform.py:275–281 / 274–280 / 225–237`，依次对应版本表三列。

**来源索引（编号对应 frontmatter sources）**

- NPU、主机与 CANN 的职责：昇腾官方 CANN 介绍 [S1]。
- 设备枚举与 HCCL 通信参与者：CANN 9.1.0 集合通信开发文档 [S2]；选定设备后查询内存及系统预留边界：CANN 9.0.0-beta.1 `aclrtGetMemInfo` [S3]。
- MemFabric/MemCache 的分层与 A3 实践见官方技术文章 [S4]；具体部署能力仍须按使用的软件版本与硬件配套核对。
- **HCCS 峰值原始出处**：华为《Atlas 800T A2 训练服务器 技术白皮书》，文档版本 **16（2026-05-12）**，§5.1 表 5-2，印刷页 **37**、PDF 第 **46** 页：每路处理器 7 条 HCCS、最大理论带宽 392 GB/s；表 5-1，印刷页 36、PDF 第 45 页列出每处理器 64 GB 内存及 200GE RoCE 接口 [S5]。这些是该型号的理论规格，不是本站推理部署的实测带宽。
- **RoCE 峰值原始出处**：Atlas 800T A2 官方产品页“技术规格／网络”，整机 8 个 200GE QSFP 接口、RoCE 协议 [S6]；25 GB/s 仅为单接口位／字节换算。
- 两机、每机可见设备 0–7、TP8/DP2 和网络配置：钉住教程的双机章节 [S7]；本地编号变为全局 rank、TP/DP/EP 组由源码构造 [C13][C14][C15]。
- 图中设备启动流程与错误分支：平台设备声明 [C8]，选卡与内存快照 [C9]，创建 Runner [C10]，预算测量 [C11]，HCCL 初始化 [C12]。
- 三版对照：v0.23 平台声明与总显存查询 [C16][C17]；v0.26 对应实现 [C18][C19]；main 的声明与初始化守卫 [C20][C21]。
- SP 的初始化与刷新还会受共享专家 DP 设置影响，不能仅由默认 FlashComm 开关判断 SP 必定关闭 [C26]；91 次的完整计数前提及各投影来源统一见上文链接的 TP 通信账。

**待核**

- 现场 Atlas 800 A2 的完整型号、硬件版本、设备映射、运行时总显存及预留量；教程只写 Atlas 800 A2，本页规格取自 800T A2 训练服务器白皮书，现场型号与同系列其他型号均未核，上述规格不能证明现场两台机器的配置。
- 白皮书表 5-2 未明确 392 GB/s 的单向／双向口径；继续查同型号 HCCS 互联规格或硬件接口说明。现场 HCCS/RoCE 拓扑、同口径有效带宽和 All-Reduce 实测仍缺，不能据此给倍率或延时。
- 官方教程概览曾写“2 Atlas 800 A2（64GB × 16）”，双机操作节则写每机 8 卡且各只暴露 0–7；本库按操作节固定 2×8，原文数量差异仍保留在[来源基线](../sources/glm-5-3-flash-baseline.md)。
- MemFabric/MemCache 官方文章中的 A3 测试使用它列明的节点数、数据块与读写负载；本部署没有启用记录，文章的容量、带宽和加速比不能当成本部署实测。实际接入仍需核对安装版本及其软硬件配套。
