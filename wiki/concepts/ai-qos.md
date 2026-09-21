---
id: ai-qos
title: "AI QoS：给 UB 交换机上的流量分车道，不是给请求排队"
type: feature
summary: 给一台 NPU 发出的三类流量（算子下发、卡间集合通信、KV 搬运）打优先级标签，在 UB 交换机上映射成不同虚拟通道并按严格优先级调度；全部实现都在 tools/ 下，vLLM 引擎里一行代码都没有。
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
updated: "2026-09-22"
origin: seed
---

## 一句话

**它名字里有 QoS，但不是请求调度特性。** 它一个请求都看不见，改的是一台 NPU 发出去的网络流量：算子下发、卡间集合通信、KV 往主机内存搬，这三股流在 UB 交换机上撞在一起，把推理延迟互相拱高 [S1]。AI QoS 的做法是给每类流量打一个优先级标签，在交换机上映射成不同的**虚拟通道（VL）**，再用严格优先级（SP）在通道之间排序。请求级别的排队是 [ShortRequestFirst](short-request-first.md) 和 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md) 的事——它们决定这一轮从 `waiting` 里挑谁；AI QoS 决定挑中之后，算它的那些包在交换机端口上谁先出去。

三个在册版本上都有：`tools/ai_qos.py`、`tools/ai_qos/ai_qos.cpp` 和这份官方文档在 v0.23 维护分支、v0.26 分支（2026-09-17 源码快照）与 main 开发主线上都在。v0.23 与 v0.26 的工具代码逐字相同（两个提交间 `git diff --stat` 为空），文档只差几个标点；**main 把五种流量并成了三条车道，默认值也跟着变**，差异表在下面 [D]。

```wiki-diagram
file: ai-qos
```

## 那条请求用不到它

[那条请求](one-request.md)跑在单张 Atlas A2 上，TP=1。**硬件首先就不对**：官方写明这个特性只支持 Atlas 800T A3 服务器与 Atlas 900 A3 超节点 [S7]。就算换上 A3，单卡也没有卡间集合通信，37 个 token 的 KV 更没有往 DDR 卸载的理由——三股流量里两股压根不存在，没有可争的端口。

要走到这里，设定得换成：A3 超节点上的一个大实例，开 TP/EP 让 AllReduce 与 dispatch / combine 跑起来，同时把 KV 卸载到主机 DDR。照默认值跑一次 `python tools/ai_qos.py`，端点侧和交换机侧的数完全定死，照 `aiqos_table` 一行行代得出来 [C10]：

| 流量 | 端点写进去的标签 | 入口 VL | 交换机改写成 dqos | 落到哪条车道 | SP 优先级 |
|---|---|---|---|---|---|
| AIV · dispatch / combine | `min(5, 5)` = 5 | 0 | 5 | VL 2 | 3 |
| AIV · 算子下发 | 5 | 1 | 5 | VL 5 | 3 |
| SDMA · AllReduce / AllGather | `min(6, 2)` = 2 | 0 | 5 | VL 2 | 3 |
| SDMA · KV 卸载与预取 | 2 | 1 | 0 | VL 3 | **1** |
| PCIe DMA · 算子下发 | 7 | 1 | 5 | VL 5 | 3 |

去重之后脚本打印 23 条 `hccs` 命令，外加 `system-view` / `commit` 两行 [D]。**默认只点亮三条车道**，而且 VL 2 与 VL 5 同为优先级 3——被区别对待的只有 KV 搬运那一条。这就是它默认状态下的全部主张：别让 KV 预取挡住算子下发和集合通信。

## 一个标签配一个入口 VL，交换机才分得出 AllReduce 和 KV 搬运

端点侧存不下两个数。`set_qos` 往驱动里写的是「某个 master 的 QoS 标签」，一类引擎只有一个 master：AIV 是 11 和 12，SDMA 是 13，PCIe DMA 是 7 [C8]。所以脚本里那两行 `min()` 不是在做取舍——同一台引擎的 D2D 与 H2D 在 `aiqos_table` 里共用同一列 `sqos`，`min()` 只是从两个相同的候选里挑一个 [C11]。

真正把两种流量分开的是打印给交换机的这三条命令：

```text
hccs qos remap           {标签} {入口VL} {dqos}             # (标签, 入口 VL) → dqos
hccs vl remap peer-type  {cpu|npu|sw} {dqos} {入口VL} {VL}
hccs sp        peer-type {cpu|npu|sw} {VL} {优先级}
```

默认值下 SDMA 那一对是 `hccs qos remap 2 0 5` 与 `hccs qos remap 2 1 0`：**同一个标签 2，入口 VL 是 0（D2D）就被抬到 dqos 5 进 VL 2，是 1（H2D）就掉到 dqos 0 进 VL 3** [D]。入口 VL 是端点侧唯一还剩下的一位信息，`D2D_VL_INIT = 0` / `H2D_VL_INIT = 1` 这两个常量就是干这个的。

顺带还改了两处和优先级无关的东西：SDMA 的 mata 带宽被设成 `bw_low=0 / bw_high=1 / hardlimit=0`，每张卡的 fuse 全局配置被打开成 `enable=1, autoqos_fuse_en=1, mpamqos_fuse_mode=1` [C13]。两者同样会被 `unset` 按首次 apply 的快照还原。

## 引擎里一行代码都没有

在三个提交上对 `vllm_ascend/` 整目录 grep `qos`：v0.23 与 v0.26 上零命中 [D]。`envs.py` 没有环境变量、`ascend_config.py` 没有开关、`platform.py` 没有分支——**这个特性不经过 vLLM 引擎**。它的全部代码是 `tools/ai_qos.py`（算标签、打印命令、存回滚快照）和 `tools/ai_qos/ai_qos.cpp`：一个 pybind11 扩展，把 `dsmi_set_device_info(..., DSMI_MAIN_CMD_QOS, ...)` 包成 `set_qos` / `set_bw` / `set_fuse_gbl_config` 等六个函数 [C17]。扩展编译后装进 `vllm_ascend/` 目录，脚本再 `from vllm_ascend import ai_qos` 导回来——装进去的是编译产物，所以在仓库里 grep 不到它。

这带来两件很实际的事：**它对 vLLM 完全透明**（跑什么模型、开不开 PD 分离、用哪个调度器都一样，不存在互斥），以及**它不随进程生命周期走**——设置写在驱动和交换机上，进程退出不会自动还原，只能 `python tools/ai_qos.py unset` 或重启服务器 [C15]。

main 上多了一个同名但不同层的东西：KV 传输连接器可以在 `kv_connector_extra_config` 里给 `qos_priority`（整数 0–4），`inject_qos` 把它写进 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 `comm_resource_config.qos` 字段 [C26]。那是给 HIXL 传输引擎用的，和这一页的 master / VL 是两套编号，别混；取值范围和报错写在 [KV Pool](kv-pool.md)。

## 开它是四步，少一步整套配置都不生效

1. **编译安装扩展**：`cmake -S tools/ai_qos -B tools/ai_qos/build -DCMAKE_INSTALL_PREFIX=${PWD}/vllm_ascend -DDSMI_INCLUDE_DIR=... -DDSMI_LIBRARY=...`，再 `--build`、`--install`。DSMI 的头文件与 `libdrvdsmi_host.so` 来自**驱动**而不是 CANN，容器里要先把这两个目录挂进来，否则 CMake 直接失败 [S3]。
2. **推理任务起来之前**跑 `python tools/ai_qos.py`（auto 模式）。它按 `ASCEND_RT_VISIBLE_DEVICES` 逐张卡设置；这个环境变量没设就退回 `torch.npu.device_count()`，再取不到就退出 [C9]。
3. **登录 UB 交换机**，把屏幕上打印的那 25 行敲进去。脚本碰不到交换机。这次配置会**覆盖**交换机上已有的 QoS 配置，官方要求先备份 [S4]。
4. 要关就跑 `python tools/ai_qos.py unset`：它按首次 apply 的快照还原端点侧，再打印一串 `undo` 开头的命令让你去交换机上敲。

硬性前提：Atlas 800T A3 服务器或 Atlas 900 A3 超节点、**特权容器**、Ascend HDK ≥ 25.5.2、UB 交换机「灵衢计算网络」≥ 1.5.1 [S7]。

`--mode` 这个参数**代码里从头到尾没读过**：`self.mode` 只被赋值，`set_qos()` 里一次都没用到 [C14]。auto 就是「优先级参数全取默认值」，manual 就是「你自己给几个」，官方文档也承认「默认配置与 auto 模式相同」[S5]。

官方对效果只给了定性说法——隔离不同类型流量的 VL 以「防止拥塞扩散」，并在 VL 之间做差异化调度 [S2]。**没有任何量化数据**：没有吞吐、延迟或 SLO 的数字，这一页也就不编一个。

## v0.23 / v0.26 与 main：五种流量并成三条车道

| 项 | v0.23 维护分支 / v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 手工参数 | 五个：`--AIV_D2D` `--AIV_H2D` `--SDMA_D2D` `--SDMA_H2D` `--PCIEDMA_H2D` | 三个：`--AIV` `--SDMA` `--PCIEDMA` [C25] | 照旧文档写的命令行在 main 上是 `argparse` 报错，升级必须改脚本 |
| SDMA 的默认优先级 | D2D 走 VL 2（pri 3）、H2D 走 VL 3（pri 1），是分开的 | 合成一条 `--SDMA low` → VL 4、pri 1 [C23] | `[!]` main 的默认值把 AllReduce / AllGather 和 KV 搬运一起压到最低档，v0.23 上集合通信是最高的那一档 |
| VL 怎么分 | 按「方向 × 档位」分：D2D 落 VL 0/1/2，H2D 落 VL 3/4/5 | 按引擎分、一台一条：AIV→VL 2、PCIEDMA→VL 3、SDMA→VL 4，只有 `pri` 随档位变 | main 上再不可能给同一台引擎的 D2D 和 H2D 不同优先级 |
| 端点标签随档位变吗 | 变：AIV 的 low / middle / high 分别是 1 / 3 / 5 | 不变：三台引擎的 `sqos` 固定为 4 / 6 / 5，档位只改交换机侧的 `pri` | `[!]` main 上不去交换机敲命令，改档位等于完全没效果 |
| 入口 VL 的含义 | `D2D_VL_INIT` / `H2D_VL_INIT`，区分方向 | 改名 `CACHEABLE_VL_INIT` / `NONCACHEABLE_VL_INIT`，两个值对每台引擎各发一遍 | 入口 VL 不再携带方向信息，打印的命令从 23 条涨到 33 条 [D] |
| PCIe DMA 档位 | 只有 `low` / `high` | `low` / `middle` / `high` [S20] | 旧版想给 PCIe DMA 配中档是配不出来的 |
| 官方给的调用方式 | `python tools/ai_qos.py` | `python -m tools.ai_qos` | `if __name__` 入口和绝对导入都还在，两种写法都跑得起来 [D] |

## 常见误解

- **「AI QoS 是给请求分优先级的，高优先级请求先被调度。」**——它一个请求都看不见。唯一的输入是 `ASCEND_RT_VISIBLE_DEVICES` 和几个档位参数，输出是驱动寄存器加一串交换机命令。要按请求排序，去看 [ShortRequestFirst](short-request-first.md) 和 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)。
- **「跑完 `python tools/ai_qos.py` 就生效了。」**——只生效了一半。端点侧的标签确实写进了驱动，但决定谁先出队的 VL 映射和 SP 优先级在交换机上，脚本只是把命令打印到屏幕 [C12]。不去交换机敲，等于打了标签没人看。
- **「把 AIV 档位调高，dispatch / combine 就会被优先发。」**——官方明写：受底层驱动限制，AIV 的 QoS 配置**当前不生效**，要等驱动补上适配能力 [S7]。`[!]` 这条限制三个版本的文档里都在，也就是说默认配置里真正起作用的只有 SDMA 与 PCIe DMA 那两条。
