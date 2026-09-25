---
id: ai-qos
title: "AI QoS：给 UB 交换机上的流量分车道，不是给请求排队"
type: feature
summary: 一台 NPU 往外发的三类网络流量（下发计算任务、卡间对答案、把 KV 搬去主机内存）会在交换机上互相挡路；它给每类流量贴优先级，让交换机分车道放行。它不给请求排队，也不经过推理引擎。
aliases: [AI QoS, AI QoS Feature, ai_qos, 流量 QoS, 虚拟通道 VL, Virtual Lane, UB 交换机 QoS, hccs qos remap, 严格优先级调度, MASTER_ID_SDMA, aiqos_table, tools/ai_qos.py]
chapters: ["08", "18"]
order: 10
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L5-L7
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L11-L21
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L23-L40
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L42-L58
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L60-L63
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L65-L71
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L73-L82
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L1-L26
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L131-L147
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L326-L338
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L359-L377
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L379-L402
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L404-L422
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L439-L474
  - vllm-ascend@2c59ff10:tools/ai_qos.py#L270-L319
  - vllm-ascend@2c59ff10:tools/ai_qos/ai_qos.cpp#L38-L57
  - vllm-ascend@2c59ff10:tools/ai_qos/ai_qos.cpp#L121-L136
  - vllm-ascend@2c59ff10:tools/ai_qos/CMakeLists.txt#L10-L12
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L60-L63
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L44-L67
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L77-L86
  - vllm-ascend@baa023ad:tools/ai_qos.py#L18-L21
  - vllm-ascend@baa023ad:tools/ai_qos.py#L326-L331
  - vllm-ascend@baa023ad:tools/ai_qos.py#L357-L373
  - vllm-ascend@baa023ad:tools/ai_qos.py#L444-L449
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2185-L2189
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/Ai_QoS_introduction_en.html
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: expert-parallel
    kind: builds-on
    note: 占着 AIV 那条车道的 dispatch / combine 就是 EP 每层的全员交换，它为什么这么密写在那一页
  - to: tensor-parallel
    kind: builds-on
    note: SDMA 车道上的 AllReduce / AllGather 来自 TP 每层那两刀之后的同步，位置是写死的
  - to: kv-cache-cpu-offload
    kind: builds-on
    note: 默认被单独摁到最低优先级的那股流量，正是这一页讲的 KV 往主机内存搬
  - to: kv-pool
    kind: builds-on
    note: main 上引擎内唯一能设 QoS 的口子 qos_priority 长在 KV 池的连接器配置里，取值范围和报错在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 三股流量挤一个出口，谁先走？

一颗 NPU 干活时，往外发的东西不止一种。它要不停地接收新的计算任务（算子下发）；多颗 NPU 分着算一个模型时，每层都要互相对一次答案（卡间集合通信）；显存不够时，还要把 KV Cache 搬去主机内存、用时再搬回来。这三股流量最后都要从同一台 UB 交换机的端口过去。端口一堵，谁先过？如果 KV 搬运正好一大批涌过去，把每层都必须等的那次对答案挡在后面，整台机器就都在干等。

AI QoS 就是来管这件事的。它给每类流量贴一个优先级标签，交换机按标签把它们分进不同的**虚拟通道**（下面叫「车道」），车道之间按**严格优先级**放行：高优先级车道里还有包，低的那条就一个字节也发不出去。

注意别被名字带偏：**它名字里有 QoS，但不是请求调度特性。** 它一个请求都看不见。决定这一轮先算哪条请求，是 [ShortRequestFirst](short-request-first.md) 和 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md) 的事；AI QoS 管的是请求被选中之后，算它产生的那些数据包在交换机端口上谁先出去。

另外，这一页的 SP 指「严格优先级」，和[序列并行（SP）](sequence-parallel.md)是两回事，只是缩写撞了。

## 贯穿例子用不上它

全库跟的[那条请求](one-request.md)是 Qwen3.6-35B-A3B 跑在一张 Atlas A3 卡的两颗 NPU 上，注意力对半切、专家分两堆。对照 AI QoS 要解决的三股流量：

- **卡间对答案**：有。两颗 NPU 每层都要同步一次。但同一张卡上两颗芯片之间的流量走不走交换机，这一页没有查到官方说法。
- **KV 搬去主机内存**：没有。37 个 token 的问题加 200 个 token 的回答，KV 在显存里放得下，没有往外搬的理由。
- **把问题和回答拆到两台机器上跑（[PD 分离](pd-disaggregation.md)）**：这个模型在三个版本的支持矩阵里都是 ❌（见 [one-request](one-request.md) 的版本差异部分）。所以开发主线上那个给 P 节点 / D 节点之间 KV 传输设优先级的口子（下半讲），这个例子也用不上。

三股流量里只剩一股，谈不上争抢。所以这一页换一个设定来讲机制：**一台 A3 超节点上的大部署，开张量并行（TP）和专家并行（EP），让每层的对答案和专家间的数据交换都跑起来，同时把 KV 卸载到主机内存。** 跟原页一样，不绑定具体模型——AI QoS 只看流量是哪台引擎发的，跑什么模型对它没区别。

## 默认只分出三条车道

照默认设置跑一次，五种流量落到的车道是定死的：

| 流量 | 由谁发 | 落到哪条车道 | 优先级 |
|---|---|---|---|
| 专家间数据交换（dispatch / combine） | AIV | 车道 2 | 3 |
| 卡间对答案（AllReduce / AllGather） | SDMA | 车道 2 | 3 |
| 算子下发（AIV 发的） | AIV | 车道 5 | 3 |
| 算子下发（PCIe DMA 发的） | PCIe DMA | 车道 5 | 3 |
| KV 卸载到主机内存、预取回来 | SDMA | 车道 3 | **1** |

**默认只点亮三条车道**，而且车道 2 和车道 5 同为优先级 3——真正被区别对待的只有 KV 搬运那一条。这就是它默认状态下的全部主张：别让 KV 预取挡住算子下发和卡间通信。

还有一条要先知道的限制：官方写明，受底层驱动限制，AIV 这台引擎的优先级设置**目前不生效**。也就是说表里 AIV 发的那两行（专家间数据交换、AIV 的算子下发）眼下只是写在纸上，默认配置里真正起作用的只有 SDMA 与 PCIe DMA 那三行。

## 端点只记得一个数，靠交换机把它劈开

问题来了：卡间对答案和 KV 搬运都是 SDMA 这一台引擎发的，一个要最高、一个要最低，怎么分？

NPU 这一侧存不下两个数。每台引擎在驱动里只有一个优先级标签的位置，所以 SDMA 发的所有流量出门时贴的都是同一个标签。默认下这个标签是 2——两种流量各自想要的标签里取了较小的那个。

真正把它们分开的是交换机。每个包进交换机时除了标签，还带着一位「入口车道」信息：卡与卡之间的流量走入口 0，NPU 与主机之间的走入口 1。交换机按「标签 + 入口」这一对查表：标签 2 从入口 0 进来，被改写成高优先级、进车道 2；从入口 1 进来，被改写成最低优先级、进车道 3。

```wiki-diagram
file: ai-qos
```

这就是为什么脚本自己干不完这件事：NPU 这一侧的标签由脚本写进驱动，但决定谁先出队的查表和车道优先级在交换机上，脚本连不上交换机，只能把要敲的命令打印出来，由人登录交换机去敲。

## 它不经过推理引擎

AI QoS 的全部实现是一个独立的小工具：一段脚本负责算标签、打印交换机命令、存一份回滚快照，再加一个调用驱动接口的小扩展。推理引擎里没有它的开关、没有环境变量、没有分支。

这带来两件很实际的事：

- **它对推理完全透明**。跑什么模型、开不开 PD 分离、用哪个调度器都一样，不存在互斥。
- **它不随进程生命周期走**。设置写在驱动和交换机上，推理进程退出不会自动还原，只能手动跑一次撤销，或者重启服务器。

开发主线上多了一个名字相近、但不在同一层的东西：PD 分离的 KV 传输连接器可以给自己设一个 0–4 的优先级。那是给另一套传输引擎用的，编号和这一页的引擎、车道是两套，别混。

## 常见误解

- **「AI QoS 是给请求分优先级的，高优先级请求先被调度。」**——它一个请求都看不见。它的输入只有「哪几张卡」和几个档位，输出是写进驱动的标签加一串交换机命令。要按请求排序，去看 [ShortRequestFirst](short-request-first.md) 和 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)。
- **「脚本跑完就生效了。」**——只生效了一半。标签确实写进了驱动，但决定谁先出队的车道映射和优先级在交换机上，脚本只是把命令打印到屏幕。不去交换机敲，等于贴了标签没人看。
- **「把 AIV 档位调高，专家间的数据交换就会被优先发。」**——官方明写 AIV 的设置目前不生效，要等驱动补上适配能力。这条限制三个版本的文档里都在。

## 对照源码

### 怎么开

四步，少一步整套配置都不生效：

1. **编译安装扩展**：`cmake -S tools/ai_qos -B tools/ai_qos/build -DCMAKE_INSTALL_PREFIX=${PWD}/vllm_ascend -DDSMI_INCLUDE_DIR=... -DDSMI_LIBRARY=...`，再 `--build`、`--install`。DSMI 的头文件与 `libdrvdsmi_host.so` 来自**驱动**而不是 CANN，容器里要先把这两个目录挂进来 [S3]。
2. **推理任务起来之前**跑 `python tools/ai_qos.py`（auto 模式）。它按 `ASCEND_RT_VISIBLE_DEVICES` 逐张卡设置；这个环境变量没设就退回 `torch.npu.device_count()` [C9]。
3. **登录 UB 交换机**，把屏幕上打印的那 25 行敲进去。这次配置会**覆盖**交换机上已有的 QoS 配置，官方要求先备份 [S4]。
4. 要关就跑 `python tools/ai_qos.py unset`：它按首次 apply 的快照还原端点侧，再打印一串 `undo` 开头的命令让你去交换机上敲 [C15]。

硬性前提：Atlas 800T A3 服务器或 Atlas 900 A3 超节点、**特权容器**、Ascend HDK ≥ 25.5.2、UB 交换机「灵衢计算网络」≥ 1.5.1 [S7]。

`--mode` 这个参数**代码里从头到尾没读过**：`self.mode` 只被赋值，`set_qos()` 里一次都没用到 [C14]。auto 就是「优先级参数全取默认值」，manual 就是「你自己给几个」，官方文档也承认「默认配置与 auto 模式相同」[S5]。

v0.23 / v0.26 的默认档位是 `--AIV_D2D high --AIV_H2D high --SDMA_D2D high --SDMA_H2D low --PCIEDMA_H2D high`。`aiqos_table` 每格是 `(sqos, dqos, vl, pri)`，代进去得到上半那张表的完整版 [C10]：

| 流量 | 端点写进去的标签 | 入口 VL | 交换机改写成 dqos | 落到哪条车道 | SP 优先级 |
|---|---|---|---|---|---|
| AIV · dispatch / combine | `min(5, 5)` = 5 | 0 | 5 | VL 2 | 3 |
| AIV · 算子下发 | 5 | 1 | 5 | VL 5 | 3 |
| SDMA · AllReduce / AllGather | `min(6, 2)` = 2 | 0 | 5 | VL 2 | 3 |
| SDMA · KV 卸载与预取 | 2 | 1 | 0 | VL 3 | **1** |
| PCIe DMA · 算子下发 | 7 | 1 | 5 | VL 5 | 3 |

端点侧一类引擎只有一个 master：AIV 是 11 和 12，SDMA 是 13，PCIe DMA 是 7 [C8]；`set_qos` 往驱动里写的就是「某个 master 的 QoS 标签」。同一台引擎的 D2D 与 H2D 各有自己的 `sqos`，脚本用 `min()` 取两者中较小的那个作为这台引擎唯一的标签 [C11]——SDMA 默认 D2D 是 high（6）、H2D 是 low（2），所以写进去的是 2。

打印给交换机的是这三种命令：

```text
hccs qos remap           {标签} {入口VL} {dqos}             # (标签, 入口 VL) → dqos
hccs vl remap peer-type  {cpu|npu|sw} {dqos} {入口VL} {VL}
hccs sp        peer-type {cpu|npu|sw} {VL} {优先级}
```

默认值下 SDMA 那一对是 `hccs qos remap 2 0 5` 与 `hccs qos remap 2 1 0`：**同一个标签 2，入口 VL 是 0（D2D）就被抬到 dqos 5 进 VL 2，是 1（H2D）就掉到 dqos 0 进 VL 3** [D]。`D2D_VL_INIT = 0` / `H2D_VL_INIT = 1` 这两个常量就是干这个的。去重之后脚本打印 23 条 `hccs` 命令（5 条 qos remap、9 条 vl remap、9 条 sp），外加 `system-view` / `commit` 两行 [D]；VL 0、1、4 一条都没用到，只有把某种流量调低档位才会落到那里。

顺带还改了两处和优先级无关的东西：SDMA 的 mata 带宽被设成 `bw_low=0 / bw_high=1 / hardlimit=0`，每张卡的 fuse 全局配置被打开成 `enable=1, autoqos_fuse_en=1, mpamqos_fuse_mode=1` [C13]。两者同样会被 `unset` 按首次 apply 的快照还原。

main 上 PD 分离的 KV 传输连接器可以在 `kv_connector_extra_config` 里给 `qos_priority`（整数 0–4，缺省时用 P/D 默认值 1），`inject_qos` 把它写进 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 `comm_resource_config.qos` 字段 [C26]。那是给 HIXL 传输引擎用的，和上面的 master / VL 是两套编号；取值范围和报错写在 [KV Pool](kv-pool.md)。贯穿例子的 Qwen3.6 不支持 PD 分离（[one-request](one-request.md)），用不到这个口子。

### 会报什么错

- 编译扩展时 DSMI 的头文件或 `libdrvdsmi_host.so` 找不到，CMake 直接失败 [S3]。
- `ASCEND_RT_VISIBLE_DEVICES` 没设、`torch.npu.device_count()` 又取不到，打印 `Error: ... is unset and failed to run torch.npu.device_count().` 后退出；数出 0 张卡打印 `Error: no visible NPU devices found.` 后退出。
- 照 v0.23 / v0.26 文档写的五个手工参数（`--AIV_D2D` 等）在 main 上是 `argparse` 报错，升级必须改脚本 [C25]。
- main 上 `qos_priority` 不是 0–4 的整数时抛 `ValueError`；`ASCEND_GLOBAL_RESOURCE_CONFIG` 里原有 `comm_resource_config.qos` 时会被覆盖并打一条 warning。

### 开销和什么时候别开

- **不随进程还原**：设置写在驱动和交换机上，进程退出不会自动还原，只能 `python tools/ai_qos.py unset` 或重启服务器。
- **会覆盖交换机上已有的 QoS 配置**，官方要求先备份 [S4]。
- **AIV 的配置当前不生效**：受底层驱动限制，要等驱动补上适配能力 [S7]。`[!]` 这条限制三个版本的文档里都在，默认配置里真正起作用的只有 SDMA 与 PCIe DMA 那几条。
- **没有量化收益数据**：官方只给了定性说法——隔离不同类型流量的 VL 以「防止拥塞扩散」，并在 VL 之间做差异化调度 [S2]。没有吞吐、延迟或 SLO 的数字，这一页也就不编一个。
- 单卡、没有卡间集合通信、也不卸载 KV 的部署，三股流量缺两股，开了没有可争的端口。

### 版本差异

三个在册版本上都有：`tools/ai_qos.py`、`tools/ai_qos/ai_qos.cpp` 和这份官方文档在 v0.23 维护分支、v0.26 分支（2026-09-17 源码快照）与 main 开发主线上都在。v0.23 与 v0.26 的工具代码逐字相同（两个提交间 `git diff --stat` 为空），文档只差几个标点；**main 把五种流量并成了三条车道，默认值也跟着变** [D]。

| 项 | v0.23 维护分支 / v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 手工参数 | 五个：`--AIV_D2D` `--AIV_H2D` `--SDMA_D2D` `--SDMA_H2D` `--PCIEDMA_H2D` | 三个：`--AIV` `--SDMA` `--PCIEDMA` | 照旧文档写的命令行在 main 上是 `argparse` 报错，升级必须改脚本 |
| SDMA 的默认优先级 | D2D 走 VL 2（pri 3）、H2D 走 VL 3（pri 1），是分开的 | 合成一条 `--SDMA low` → VL 4、pri 1 [C23] | `[!]` main 的默认值把 AllReduce / AllGather 和 KV 搬运一起压到最低档，v0.23 上集合通信是最高的那一档 |
| VL 怎么分 | 按「方向 × 档位」分：D2D 落 VL 0/1/2，H2D 落 VL 3/4/5 | 按引擎分、一台一条：AIV→VL 2、PCIEDMA→VL 3、SDMA→VL 4，只有 `pri` 随档位变 | main 上再不可能给同一台引擎的 D2D 和 H2D 不同优先级 |
| 端点标签随档位变吗 | 变：AIV 的 low / middle / high 分别是 1 / 3 / 5 | 不变：三台引擎的 `sqos` 固定为 4 / 6 / 5，档位只改交换机侧的 `pri` | `[!]` main 上不去交换机敲命令，改档位等于完全没效果 |
| 入口 VL 的含义 | `D2D_VL_INIT` / `H2D_VL_INIT`，区分方向 | 改名 `CACHEABLE_VL_INIT` / `NONCACHEABLE_VL_INIT`，两个值对每台引擎各发一遍 | 入口 VL 不再携带方向信息，打印的命令从 23 条涨到 33 条 [D] |
| PCIe DMA 档位 | 只有 `low` / `high` | `low` / `middle` / `high` [S20] | 旧版想给 PCIe DMA 配中档是配不出来的 |
| 官方给的调用方式 | `python tools/ai_qos.py` | `python -m tools.ai_qos` | `if __name__` 入口和绝对导入都还在，两种写法都跑得起来 [D] |
| 引擎内的 QoS 口子 | 无 | PD 分离连接器的 `qos_priority` | 与本页工具不是一层，见上面「怎么开」末段 |

### 源码位置

- 在三个提交上对 `vllm_ascend/` 整目录 grep `qos`：v0.23 与 v0.26 上零命中 [D]。`envs.py` 没有环境变量、`ascend_config.py` 没有开关、`platform.py` 没有分支——**这个特性不经过 vLLM 引擎**。
- `tools/ai_qos.py`：master 编号与入口 VL 常量在文件头；`_device_list` 取卡；`AiqosConfig.aiqos_table` 是档位表；`set_qos` 里 `min()` 合标签、`generate_command` 拼交换机命令并去重、逐卡写驱动与 mata / fuse；`argparse` 定义档位参数；首次 apply 快照与 `unset` 还原。
- `tools/ai_qos/ai_qos.cpp`：一个 pybind11 扩展，把 `dsmi_set_device_info(..., DSMI_MAIN_CMD_QOS, ...)` 包成 `set_qos` / `set_bw` / `set_fuse_gbl_config` 等六个函数。扩展编译后装进 `vllm_ascend/` 目录，脚本再 `from vllm_ascend import ai_qos` 导回来——装进去的是编译产物，所以在仓库里 grep 不到它。
- `tools/ai_qos/CMakeLists.txt`：DSMI 头文件与库的路径变量。
- main：`vllm_ascend/distributed/kv_transfer/utils/utils.py` 的 `inject_qos`，调用点在 `kv_p2p/mooncake_connector.py`[C27]。
