---
id: ai-qos
title: AI QoS：共享链路拥塞时，哪类流量先走
type: feature
summary: >-
  AI QoS 在受支持的 A3 网络上给流量分类、映射虚拟通道并设置服务先后。理解关键通信与 KV
  搬运的争用，再核对端点和交换机两步配置、恢复边界及各版本差异。
aliases:
  - AI QoS
  - AI QoS Feature
  - ai_qos
  - 流量 QoS
  - 虚拟通道 VL
  - Virtual Lane
  - UB 交换机 QoS
  - hccs qos remap
  - 严格优先级调度
  - MASTER_ID_SDMA
  - aiqos_table
  - tools/ai_qos.py
  - AI QoS 配置
  - AI QoS 流量优先级
  - Ai_QoS_introduction_en
  - 服务质量
  - 网络服务质量
  - 虚拟通道优先级
  - SDMA_D2D
  - SDMA_H2D
  - PCIEDMA_H2D
chapters:
  - '07'
  - 09
order: 140
sources:
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L5-L82
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L10-L53'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L131-L175'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L178-L267'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L270-L319'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L322-L474'
  - 'vllm-ascend@db701c1f:tools/ai_qos/CMakeLists.txt#L1-L61'
  - 'vllm-ascend@db701c1f:tools/ai_qos/ai_qos.cpp#L23-L118'
  - 'vllm-ascend@2c59ff10:tools/ai_qos.py#L322-L474'
  - 'vllm-ascend@2ed6cbba:tools/ai_qos.py#L322-L474'
  - 'vllm-ascend@baa023ad:tools/ai_qos.py#L322-L473'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L86
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L342'
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.27.1rc1/user_guide/feature_guide/Ai_QoS_introduction_en.html
  - 'vllm-ascend@7d825229:tools/ai_qos.py#L320-L335'
  - 'vllm-ascend@7d825229:tools/ai_qos.py#L436-L449'
  - 'vllm-ascend@c09d3e20:tools/ai_qos.py#L322-L337'
  - 'vllm-ascend@c09d3e20:tools/ai_qos.py#L433-L473'
  - 'vllm-ascend@8d6180e2:tools/ai_qos.py#L322-L337'
  - 'vllm-ascend@8d6180e2:tools/ai_qos.py#L433-L473'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: cann-hccl
    kind: builds-on
    note: 先分清通信库与物理链路，再看共享出口上的流量优先级
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 固定 A2 双机没有启用本特性，部署前提与通信组以该页为准
  - to: kv-cache-layerwise-offload
    kind: builds-on
    note: 下一层状态预取为何与当前层计算通信重叠，见逐层换出机制
  - to: vllm-scheduler
    kind: builds-on
    note: 先理解请求怎样进入计算，再区分本页的网络流量调度
  - to: pd-disaggregation
    kind: builds-on
    note: 先理解 PD 的 KV 传输，再区分其 qos_priority 与本页流量等级表
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: direct
---

## 计算在等通信，后台搬运却占着链路，怎么办？

**AI QoS（Quality of Service，服务质量）给共享网络上的不同流量安排服务先后，让计算急需的通信在拥塞时优先通过。** 它先把流量放进不同的 Virtual Lane（VL，虚拟通道），再由交换机选择先服务哪个通道。

图里，卡间通信正送来本层计算需要的结果；另一股流量在预取 KV cache，也就是把后面计算要用的历史状态提前搬到卡上。下面假设前者优先级高、后者低，出口尚未发送这些数据：

```wiki-diagram
file: ai-qos-intuition
```

图中 strict priority（SP，严格优先级）每次选最高优先级的非空 VL；VL 与物理带宽的区别、UB/SP 的同名术语及 A3 支持范围见 [CANN/HCCL 的 AI QoS 概述](cann-hccl.md#ai-qos-怎样处理共享链路上的争用)。

## 为什么要区分流量，代价由谁承担？

**同一条链路上，有的数据晚到会卡住当前计算，有的数据晚到暂时只影响下一步准备。** 先看「计算急需的通信」和「后台状态搬运」这两类；官方指南在配置时再细分成 **5 类流量**，完整分类与默认值见[怎么开](#怎么开)。

长上下文会积累更多 KV cache。把暂时不用的历史状态移到主机内存，可以腾出设备显存；为了让下一层少等，系统会在当前层计算、通信期间提前取回下一层状态，见[逐层 KV 换出](kv-cache-layerwise-offload.md)。于是原本有益的重叠也带来了争用：下一层的预取与当前层急需的通信同时经过一个出口，当前层反而更晚结束。AI QoS 的动机就是在这种冲突处保护关键流量。

代价落在被延后的流量上。只要高优先级队列一直非空，严格优先级就让低优先级继续等待；如果预取晚到，下一层开始计算时仍要等它。因而应同时看当前层通信等待和下一层状态是否按时到达，不能只看一段通信变快。

| 机制 | 决定什么 | 在哪里起作用 |
|---|---|---|
| [推理调度器](vllm-scheduler.md) | 哪些请求进入本轮计算、各处理多少文本 | 引擎队列与计算预算 |
| [KV 换出与预取](kv-cache-layerwise-offload.md) | 哪些历史状态何时搬运 | 主机与设备之间 |
| AI QoS | 已发出的不同流量争用出口时谁先走 | 端点标签与交换机 VL |

网络规则按搬运通道及标签区分数据，不识别请求或用户。

## 分开排队后，一次等待会怎样变化？

**QoS 改变的是排队顺序，收益和代价必须放在同一段时间里看。** 用一个可手算的示意：出口刚空闲，队列中已有三份状态搬运数据，关键通信紧接着到达。每份数据占一个发送时隙，一个时隙只是这里假设的时间单位；四份数据都尚未发送，后面也不再来新数据。

如果按到达顺序共用一个队列，先发三份状态，再发关键通信；如果关键通信在高优先级 VL，状态在低优先级 VL，就先发关键通信，再发三份状态。这里用先到先服务作对照，只为解释排队，并不声称关闭工具后的所有交换机都采用这一策略（等长时隙为教学假设）：

$$T_{\text{saved}} = T_{\text{FIFO}} - T_{\text{SP}} = 4 - 1 = 3\text{ 时隙}, \qquad T_{\text{total}} = 3 + 1 = 4\text{ 时隙}$$

| 指标（相同 4 份等长数据，教学假设） | 算式 | 结果 |
|---|---|---|
| 按到达顺序时关键通信完成时刻 | $3\text{ 个状态时隙} + 1\text{ 个通信时隙}$ | **4 时隙** |
| 关键通信优先时完成时刻 | $0\text{ 个等待时隙} + 1\text{ 个通信时隙}$ | **1 时隙**（少等 $4 - 1 = \mathbf{3\text{ 时隙}}$） |
| 最后一份状态额外等待 | $4 - 3$ | **1 时隙** |
| 两种顺序全部发送完总时长 | $3 + 1$ | **4 时隙**（总工作量不变） |

总工作量没变，只把关键通信的完成时刻提前了。真实数据包有不同长度，流量还会继续到达；如果低优先级数据已经开始发送，这个例子也没有证明它能被中途打断。要把时隙换成毫秒，需要具体交换机行为和实测数据。

## 数据怎样进入对应的队列？

**先按搬运通道分类，在发送端设置标签，再让交换机把带标签的数据映射到 VL 并设置服务优先级。** 标签是供网络规则匹配的编号，不是数据内容，也不是用户身份。以 SDMA（一种设备数据搬运通道）承载的设备间通信和主机状态搬运为例，沿固定版本的默认配置走一遍：

1. **端点打标签。** 工具把这两类流量共用的 SDMA 端点源标签设为 2；设备间通信使用初始 VL 0，主机搬运使用初始 VL 1。因此同一个标签仍能配合初始 VL 区分两类流量。
2. **交换机映射队列。** 规则匹配「标签 2 + 初始 VL 0」时，把通信送到目标 VL 2；匹配「标签 2 + 初始 VL 1」时，把状态送到目标 VL 3。这里的目标 VL 就对应首图的两个等待队列。
3. **设置服务先后。** 目标 VL 2 配优先级 3（high），目标 VL 3 配优先级 1（low）；两队都有数据时，先服务前者，才得到上一节「关键通信先于三份状态」的次序。标签 2、VL 2、优先级 3 是三个不同字段，不能互相替代。

只改端点标签还缺少队列映射，只有队列映射又缺少服务次序；端点与交换机须配套，实际执行分工见 [CANN/HCCL 的配置说明](cann-hccl.md#怎么开)。这里用的是固定版本的默认映射，全部参数、标签取值推导及 `v0.30.0` / `main` 的三键收敛改动分别在[怎么开](#怎么开)和[版本差异](#版本差异)。

下图把「端点打标 → 交换机 VL 映射 → 严格优先级仲裁」的完整链路，以及旧五键与 `v0.30.0`/`main` 新三键的映射变化和三条运维边界集中对照：

```wiki-diagram
file: ai-qos-fig-vl-priority-lanes
```

## 放到 GLM 双机，一个 token 会遇到什么？

**固定 GLM 双机主线没有启用这套 AI QoS 配置，也不在指南声明的 A3 支持范围内。** 本页挂靠[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)：AI QoS 是启动推理任务前单独运行的设备与网络配置工具。其可能影响的位置则在[一次前向的通信账](one-request.md#一次前向的通信账)，即各层计算等远端数据的时候。部署型号、并行分组与版本前提统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

沿一个 token（模型处理文本的基本单位）看，启动阶段先建立通信组；请求进入模型后，多卡合算矩阵需要合齐各卡结果，专家层又要把输入送到专家所在的卡，再收回计算结果。前者的计算分工见 [TP](tensor-parallel.md)，后者见 [EP](expert-parallel.md)。这些通信仍按原有执行路径发生，AI QoS 不改变每层通信次数、张量形状或专家分布。

未启用的依据是官方双机脚本没有调用该工具，固定执行源码的推理路径也没有自动调用它。双机教程虽然使用特权容器，也设置了 AIV 相关通信选项，但这些条件各有用途，不能代替设备与交换机 QoS 配置。

若把相同推理工作迁到受支持的 A3 拓扑，并同时运行会争用出口的状态搬运，再正确配置端点和交换机，变化发生在通信的等待时间：高优先级流量可先得到服务，低优先级搬运承担等待。具体哪次通信走哪条搬运通道，要看实际算子和驱动；特别是指南明确写明 AIV 通道设置尚不生效，所以不能把“专家派发很关键”直接推成“调高 AIV 就会更快”。

若要比较昇腾 950，先看[执行与互联页](ascend-950-execution-interconnect.md)对任务、搬运和远端访问的区分。本页核实的 A3 工具与交换机条件不能直接当成 950 的已验证配置；迁移时仍需核对相应产品的软件文档与实际生效状态。

## 哪些理解最容易带偏？

- **“auto 会持续观察负载，自动找到最佳优先级。”** 工具读预设等级表，一次性生成配置；源码没有按实时负载调参的循环。
- **“所有流量都设 high，所有请求都会更快。”** 同一出口仍有限，等级相同就失去了原先希望建立的服务先后。
- **“VL 2 比 VL 3 优先，因为编号小。”** VL 编号标识通道，另一个优先级字段决定先后，必须连同映射表读。
- **“推理进程退出，QoS 就一起关闭。”** 配置不与一次推理进程的生命周期绑定，恢复要走端点和交换机两步。
- **“所有叫 QoS 的参数都能相互换算。”** main 的 KV 传输 qos_priority 属于另一入口，见 [PD 分离](pd-disaggregation.md)；这里的 high / middle / low、VL 编号和端点标签分属不同字段。

## 对照源码

### 怎么开

**先满足硬件与软件条件，再构建扩展，最后分别配置端点和交换机。** 固定执行快照为 db701c1f。官方指南要求 Atlas 800T A3 或 Atlas 900 A3 SuperPoD、特权容器、Ascend HDK 25.5.2+，以及 UB Switch LingQu Computing Network 1.5.1+。DSMI 是此工具访问设备管理能力的接口；头文件与库来自驱动配套，不能只安装 CANN 就假定已齐备。

在 vllm-ascend 仓库根目录按实际挂载路径替换两个占位符；这些是目标 Linux 容器中的操作：

```bash
cmake -S tools/ai_qos -B tools/ai_qos/build \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX=${PWD}/vllm_ascend \
  -DDSMI_INCLUDE_DIR=YOUR_DSMI_INCLUDE_DIR \
  -DDSMI_LIBRARY=YOUR_DSMI_LIBRARY_FILE
cmake --build tools/ai_qos/build -j
cmake --install tools/ai_qos/build
```

其中头文件名为 dsmi_common_interface.h，库名为 libdrvdsmi_host.so；CMake 还要求 Python 开发模块与 pybind11。容器必须能看到这些文件。扩展导入成功后，再运行下列两种配置之一；manual 示例只改 SDMA 的主机搬运等级，其余仍取默认值：

```bash
# 固定快照、v0.23 与 v0.26：默认 auto
python tools/ai_qos.py

# 或：显式指定一项，未提供的项保持默认
python tools/ai_qos.py --mode manual --SDMA_H2D middle
```

运行前核对 `ASCEND_RT_VISIBLE_DEVICES`：设置时脚本把逗号分隔的非负整数直接交给设备管理接口；未设置时取 torch.npu.device_count()，按 0 到数量减一枚举。这里没有按模型 TP/DP 组自动挑卡的逻辑，也没有容器逻辑编号到另一套物理编号的转换；设备号应与当前容器的管理接口口径一致。

固定快照的五键配置如下。AIV 指向量计算核；DMA 是直接搬运数据的硬件机制，SDMA 与 PCIe DMA 是不同搬运通道；D2D 是设备到设备，H2D 是主机到设备。算子下发是把待执行工作送给设备，SDMA_H2D 的文档类别同时涵盖反向换出到主机。

| 参数 | 指南举例的流量 | 默认 / 可选 |
|---|---|---|
| `--AIV_D2D` | AIV 派发、收回 | high / high、middle、low |
| `--AIV_H2D` | AIV 算子下发 | high / high、middle、low |
| `--SDMA_D2D` | SDMA All-Reduce、All-Gather | high / high、middle、low |
| `--SDMA_H2D` | SDMA KV cache 换出、预取 | low / high、middle、low |
| `--PCIEDMA_H2D` | PCIe DMA 算子下发 | high / high、low |

All-Reduce 是各卡合齐归约结果，All-Gather 是各卡收齐分片；它们的计算语义见[集合通信](collective-communication.md)。上表是指南的典型通道分类，实际调用选用的通道仍要从运行路径确认。**两项 AIV 参数虽然能解析，指南注明受驱动限制，当前设置不生效。**

实现里 `mode` 被保存，但没有按 auto/manual 切换计算分支：两种模式都把最终解析出的等级交给同一张表。手动参数也不因 mode 保持 auto 而自动被忽略；使用 manual 是表达意图的文档写法。

**旧版映射为什么能让 SDMA 的两种方向分开？** 表项依次是源 QoS 标签、交换机重映射后的 QoS、目标 VL、严格优先级。默认设备间通信取 $(6, 5, 2, 3)$，主机搬运取 $(2, 0, 3, 1)$，共享 SDMA 端点标签取两个源标签的较小值（来自映射表，不是时延测量）：

$$\text{tag}_{\text{SDMA,src}} = \min(6,\; 2) = 2$$

交换机再用“源标签 + 初始 VL”区分这两类：设备间以初始 VL 0 进入，映射到 QoS 5、目标 VL 2、优先级 3；主机搬运以初始 VL 1 进入，映射到 QoS 0、目标 VL 3、优先级 1。优先级 3 在这张表中表示 high，1 表示 low，数值比例不代表带宽比例。main 改了这套映射，见版本表。

```wiki-diagram
file: ai-qos-flow
```

应用分支先读取或补采端点原始状态，再写 QoS、SDMA 带宽配置和全局 fuse 配置；fuse 是驱动中组合 QoS 的相关设置，脚本把它作为整体配置的一部分处理。之后打印带 system-view / commit 的交换机命令块，保存状态文件。操作者需事先备份现有交换机配置，再登录交换机执行输出，并核对端点返回值与交换机实际状态。

恢复使用下面的命令；它同样只完成端点操作和交换机命令生成：

```bash
python tools/ai_qos.py unset
```

默认状态文件是脚本目录下的 tools/ai_qos_state.json，包含端点 QoS、SDMA 带宽与全局配置基线，以及本次生成的交换机命令。完整快照存在时，多次 apply 复用首次端点基线，新增设备会补采；若某设备保存项不完整，补采可能读到已经修改后的状态。因此恢复到首次值的前提是原始状态采集成功、状态文件完好。

unset 先校验文件，再按保存内容恢复端点，打印逐行加 undo 的交换机命令，随后删除状态文件；**删除发生在操作者执行交换机恢复之前。** 每次 apply 都覆盖保存的命令清单，它不是历次交换机配置的并集，也没有读取交换机原配置。更换等级或跨版本反复应用后，不能把一次 unset 当成整台交换机回到最初状态的证明；应以事先备份和实际配置对照恢复。

### 会报什么错

下表原文固定到 db701c1f；花括号和百分号保留源码中的动态占位形式，实际日志会替换成路径、设备号或返回码。

| 原文 | 文件与行号 | 含义与处理 |
|---|---|---|
| `ai_qos: dsmi_common_interface.h not found. Pass -DDSMI_INCLUDE_DIR=/path/to/include` | tools/ai_qos/CMakeLists.txt:44–48 | 构建找不到驱动头文件，核路径及容器挂载 |
| `ai_qos: drvdsmi_host not found. Pass -DDSMI_LIBRARY=/path/to/libdrvdsmi_host.so` | tools/ai_qos/CMakeLists.txt:50–54 | 构建找不到库文件，参数要给实际库文件路径 |
| `Error: no visible NPU devices found.` | tools/ai_qos.py:144–146 | 未设置可见设备且枚举数量不大于零，退出 1 |
| `get_qos failed (dev={device_id} master={master_id} ret={ret}).` | tools/ai_qos.py:407–413 | 当前通道读取失败，跳过该通道并继续 |
| `[dev:%d] set qos = %d failed, ret = %d` | tools/ai_qos/ai_qos.cpp:50–54 | 驱动写 QoS 失败；扩展打印错误并返回失败码 |
| `No state file at {state_path}; nothing to undo.` | tools/ai_qos.py:270–273 | 无可恢复快照，退出 1 |
| `Warning: restore SDMA mata (dev={device_id} mpamid={mid}) failed, ret = {r}` | tools/ai_qos.py:284–292 | SDMA 带宽相关状态恢复失败，流程继续 |
| `Warning: restore fuse gbl (dev={device_id}) failed, ret = {r}` | tools/ai_qos.py:301–309 | 全局配置恢复失败，流程继续 |

**脚本退出码不能替代逐设备验收。** apply 没有把各次端点写入的返回码汇总成失败退出；即使部分读取跳过或写入失败，仍可能打印命令并保存状态。unset 的普通 QoS 恢复也没有在 Python 层检查 set_qos 的返回码；扩展打印错误后，脚本仍可继续打印 undo、删除快照。快照和命令输出应在核验前保留副本。

状态文件损坏或结构校验失败时，tools/ai_qos.py:31–36 的完整提示为：

```text
Failed to parse the state file. Please reboot the server to restore endpoint-side QoS settings. On the switch side, log in and run `sys-view` to enter system view, then run `display current-configuration` to show the current configuration. Find the previously applied switch-side QoS commands, re-enter each command with the `undo` prefix, and finally run `commit` to complete configuration rollback.
```

对应的 50–53、274–282 行会打印提示、尝试删除状态文件并退出 1；它没有完成端点回滚。这是源代码给出的故障恢复指引，涉及服务器重启与交换机修改，需要按现场维护流程执行。

### 开销和什么时候别开

AI QoS 的工具开销在配置阶段：枚举设备、读写驱动状态、保存文件和交换机配置；它不在每一层或每一个 token 中执行 Python 调参。运行时主要取舍是网络服务顺序：一类少等，另一类可能多等。它没有增加模型层数、改变通信载荷，也没有提供可直接代入 GLM 主线的吞吐提升数。

适合评估的条件是：受支持硬件上确实存在不同类别的共享出口争用，且有可区分的时延目标。A2 主线不套用这组 A3 配置；没有争用、瓶颈在计算或通信参与者到达不齐时，调整出口优先级缺少对应作用点。所有流量都属于同一优先级类别时，也无法靠这张表实现请求级隔离。

验证应固定相同的流量组合，比较配置前后关键通信等待、KV 预取完成时刻、整体请求时延及低优先级吞吐；另外核对每个端点与交换机的实际配置。优先级的数字只能证明配置意图，不能代替收益测量。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；包含 GLM 实现的 `db701c1f` 为独立 orphan 快照，其 `tools/ai_qos.py` 与 `v0.23.0` / `v0.26.0rc` 逐字节一致。经 `git diff c09d3e20 8d6180e2 -- tools/ai_qos.py` 核实，`v0.30.0` 与 `main` 的 `tools/ai_qos.py` 实现完全一致（`AiqosConfig` 表项在 `#L322-L337`，CLI 入口在 `#L433-L473`）。

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 特性与默认执行 | 均有 `tools/ai_qos.py`；默认 `apply`、`auto`（不随 vLLM 自动开启） | 同 `v0.23.0` | 默认 `apply`、`auto`（`tools/ai_qos.py#L439-L446`）；仍须手动运行 | 同 `v0.30.0` |
| 官方调用入口与参数分类 | `python tools/ai_qos.py`；五键 `AIV_D2D / AIV_H2D / SDMA_D2D / SDMA_H2D / PCIEDMA_H2D` | 同 `v0.23.0` | `python -m tools.ai_qos`；收敛为三键 `AIV / SDMA / PCIEDMA`（`#L447-L449`），旧五键不可原样传入 | 同 `v0.30.0` |
| 默认与可选等级 | `high / high / high / low / high`；`PCIEDMA_H2D` 仅 `high/low` | 同 `v0.23.0` | `high / low / high`（`SDMA` 整类默认 `low`）；三项均支持 `low / middle / high` | 同 `v0.30.0` |
| 源标签、初始 VL 与目标 VL | 查旧方向表，共用源标签配合初始 VL（D2D 0 / H2D 1）区分目标 VL | 同 `v0.23.0` | `AIV` 标签 4 → VL 2、`PCIEDMA` 标签 5 → VL 3、`SDMA` 标签 6 → VL 4（`#L326-L330`）；初始 VL 改为 `cacheable 0 / noncacheable 1` 两路映射并汇到同类目标 VL，等级只改优先级 `1/2/3` | 同 `v0.30.0` |
| AIV 限制与软硬件前提 | AIV 设置受驱动限制不生效；A3 两类产品、特权容器、HDK 25.5.2+、交换机 1.5.1+；端点快照 + 打印 `undo` | 同 `v0.23.0` | 合并后的 `AIV` 同样不生效；软硬件与恢复边界不变 | 同 `v0.30.0` |

`v0.30.0` 与 `main` 中的 `cacheable / noncacheable` 是源码给初始流量的缓存属性命名，不是把“有无 KV cache”分成两类。四版都把已解析的等级交给同一配置过程，`auto` 也都不是在线自适应策略。

### 源码位置

- 固定官方指南的争用背景、VL 隔离、严格优先级与三步配置在第 5–21 行；构建、五类流量及软硬件限制在第 25–82 行，支撑定义、适用范围与启用条件。[S1]
- 工具常量和状态文件路径、损坏快照提示在 tools/ai_qos.py:10–53；设备枚举在 131–175；原始状态采集、补采与首次基线读取在 178–267，支撑设备范围和恢复前提。[C2][C3][C4]
- run_unset 在 270–319 行，AiqosConfig、映射表、写入及命令行入口在 322–474 行，支撑完整执行流程、标签算式、模式语义、重复应用与失败后继续的边界。[C5][C6]
- 扩展构建规则在 tools/ai_qos/CMakeLists.txt:1–61；端点读写及错误打印在 tools/ai_qos/ai_qos.cpp:23–118，支撑依赖项、原文报错与返回码限制。[C7][C8]
- v0.23、v0.26 工具与固定执行快照相同；main 的新三类表在 326–330 行，两路初始 VL 在 369–395 行，新参数与入口在 433–473 行。[C9][C10][C11]
- 三版官方指南分别支持版本表的入口、等级范围、AIV 限制和硬件条件。[S12][S13][S14]
- 固定教程的 A2 双机命令在 237–342 行，没有调用 AI QoS；该证据限定于教程配置，不能代替读取一台机器以前被管理员设过的状态。[S15]
- 在线可读的[官方 v0.27.1rc1 AI QoS 指南](https://docs.vllm.ai/projects/ascend/en/v0.27.1rc1/user_guide/feature_guide/Ai_QoS_introduction_en.html)同样使用三键入口；它只作官方阅读入口，版本结论仍由上面的钉住文件支撑。[S16]
- 四份等长数据、发送时隙与到达顺序是教学设定；相同工作量下的等待变化由该设定直接演算，不是硬件测量。[A][D]

**待核：缺少受支持 A3 环境的逐设备读回、UB 交换机配置及争用 trace，尚无本页 QoS 时延或吞吐收益实测；固定 A2 主线的现场历史 QoS 状态也没有采集。**
