---
id: device-memory
title: 主机内存与显存：数据现在放在哪
type: concept
summary: CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。
aliases:
  - 显存
  - 设备内存
  - HBM
  - 主机内存
  - host memory
  - CPU 内存
  - Host
  - 容器内存限制
  - cgroup v2
  - memory.high
  - memory.max
  - OOMKilled
  - 退出码 137
  - PYTORCH_NPU_ALLOC_CONF
  - expandable_segments
  - NPU 内存分配器
chapters:
  - '07'
  - 09
order: 110
sources:
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/runtimeapi/aclcppdevg_03_1804.html
  - 'https://www.hiascend.com/developer/techArticles/20251203-5'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/base_loader.py#L43-L82'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L1021-L1027'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L530-L565'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L152
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L469-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L282'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L282'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L281'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237'
  - 'vllm@0fc695fc:vllm/config/cache.py#L67-L80'
  - 'vllm@568afb3a:vllm/config/cache.py#L68-L81'
  - 'vllm@84030bbe:vllm/config/cache.py#L112-L125'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L469-L480'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L453-L464'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L447-L458'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L496-L525'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L733'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L779'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L551-L880'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3796-L3796'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3849-L3849'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4380-L4380'
  - 'https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html'
  - 'https://docs.docker.com/engine/containers/resource_constraints/'
  - >-
    https://docs.docker.com/reference/cli/docker/container/ls/#filter-by-exit-signal
  - >-
    https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
  - >-
    https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
  - 'https://docs.docker.com/reference/cli/docker/container/kill/'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L762-L780'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L772-L790'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L773-L791'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1318-L1354'
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.h
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.cpp
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUCachingAllocator.cpp
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L274-L287'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1436-L1472'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L377-L395'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L232-L244'
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L105'
  - 'vllm@ced6857a:vllm/config/cache.py#L228-L236'
  - 'vllm@ba15685a:vllm/config/cache.py#L216-L237'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1445-L1464'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L464-L474'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L558-L598'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4476-L4476'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_v2/patch_uva.py#L29-L55'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L377-L386'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L259-L265'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1743-L1752'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L555-L565'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L684-L707'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/worker/patch_uva.py#L32-L58'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先明确设备边界，才能回答某段内存归哪个设备使用
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 启动冷启动阶段各次 HBM 分配峰值与权重/试跑/KV/录图时序统一在生命周期页核对
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 自动显存预算如何通过 profile run 扣除激活与非 PyTorch 占用，由显存探测页完整推演
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: A0 启动及每卡权重、KV 预算的数字与推导统一在双机部署页
  - to: kv-cache-cpu-offload
    kind: builds-on
    note: 本页的卸载边界依赖实际搬运机制，继续读可看 KV 在主机和设备间怎样恢复
  - to: vllm-platform-interface
    kind: builds-on
    note: 平台契约决定何时能查询设备，不能把通用接口当作提前初始化的许可
  - to: request-call-chain
    kind: builds-on
    note: 内存启动流程以请求调用链页的完整进程调用链为背景，本页聚焦各步骤中的内存分配与测量。
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 权重在主机里，为什么还要搬进显存？

**主机内存供 CPU 使用；显存是计算设备本地的内存，本页的设备是负责模型计算的 NPU。** 权重是训练好的数值，常排成按行、列组织的[矩阵](matmul-and-weights.md)。

默认的本地计算路径要求 NPU 从本卡设备内存读取输入和权重，不能把普通 CPU 张量的主机地址直接交给算子使用。设备上的 HBM（高带宽内存）读取带宽远高于主机到设备链路；计算会反复读取所需权重，因此默认部署让权重常驻设备，只在加载时搬入，避免每轮计算都经过较慢的链路。支持主机注册、映射的路径另见下文：能远端访问，也仍要支付链路代价。

本页挂靠 [A0：启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。默认加载路径先把权重读入主机，再把本卡要用的部分复制进显存。

```wiki-diagram
file: device-memory
```

图中两侧 W 都表示已经选出的本卡权重分片，不是左侧完整矩阵缩成右侧分片；所以两边格数相同。左边是主机源数据，右边是复制后的设备数据，箭头“复制”指把这段 W 原样复制过去。复制不会自动释放源数据，两边同时保留时各记一笔占用；多卡部署会先选出本卡分片，再沿这条路径搬运。

## 为什么要分开记账，搬运的代价在哪里？

**NPU 执行默认的本地计算路径，需要本卡显存里已有输入和权重。** GLM 双机的主要语言权重子账约 **20.58 GiB/卡**，视觉塔、旋转矩阵、量化辅助张量等还要另计；还要给计算中间结果和请求历史留空间。分项与精度条件见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。主机能装下模型文件，只解决了读取与暂存这一侧的问题。

主机到设备的复制叫 **H2D**。加载器取出本卡那一段权重之后发生 H2D，依赖它的计算必须等数据可用。常驻权重在启动阶段按张量分批搬入，20.58 GiB 是其中所列语言模块的子账；后续每层处理 token 时，常驻权重的 H2D 次数为 0，直接复用本地数据。若另行启用卸载，把暂时不用的数据留在主机，用到时就要付出恢复传输或远端读取的代价；具体对象和触发条件见 [KV cache CPU 卸载](kv-cache-cpu-offload.md)。

| 要区分的量 | 回答什么问题 |
|---|---|
| 主机内存／本卡显存 | 字节实际存在哪一侧，向谁申请空间？ |
| 容量／带宽 | 能放多少字节／每秒能搬多少字节？ |
| 权重／激活 | 训练后保留的参数／本次计算产生的中间结果？ |
| HBM／显存 | 内存技术名字／设备本地内存的用途叫法？ |

HBM 是高带宽内存技术，容量和带宽仍要看具体硬件；部分昇腾设备使用 DDR，运行时查询 HBM 时会按支持情况转查 DDR。设备内存不足是容量问题；装得下却算得慢，还要测取数、计算和通信各花了多久，不能仅凭“用了 HBM”判断瓶颈。

## 主机还有空闲，为什么容器里的进程先被终止？

**主机有多少内存，与一个容器获准用多少内存，要分开看。** Linux 可以用 **cgroup（控制组）**把一组进程放在一起记账和限额。容器运行时利用这套机制约束主机内存；它没有替 NPU 增加显存。

用一个**教学示意**来看：一台机器还有空闲，但某容器只获准使用 20 GiB 主机内存。加载权重时，这一组进程的占用逼近上限，继续申请的空间需要通过回收腾出来；腾不出时，就会遇到 **OOM（内存不足）**。内核可终止组内进程来释放空间，具体处理还取决于申请类型。

控制组可以嵌套，多个容器可以共用上层控制组的总预算。即使本容器未碰到自己的上限，上层预算用尽或整机内存耗尽时，它里面的进程仍会受这些层的内存压力影响。因此，要分别核对本容器、上层控制组和整台机器；被终止的进程，不一定就是造成压力的来源。

这里的“回收”是内核尝试腾出可再利用的主机内存。它也解释了另一种现象：**服务没死，却变慢了。** cgroup v2 的 `memory.high` 是开始加强回收并限制进程推进的边界；超过它本身不会调用 OOM killer（内核因内存不足而终止进程的机制）。`memory.max` 则是硬上限，触及后又无法降低占用时才可能走到 OOM 处理。这两个值不应混为“超过就立刻退出”的一条线。

在 Kubernetes 中，内存 **request** 主要供调度时安排节点，**limit** 用来限制运行时用量；现场仍要确认实际生效的控制组设置。不要仅凭配置里写了 limit，就假定 `memory.high` 一定设成同一个值。下面的字段以 Linux cgroup v2 为范围，其他版本先核对对应接口。

## 进程突然退出，先查哪三件事？

先保存故障时的记录，再重启复测；新进程占用很低，不能说明旧进程退出前也很低。

1. **认准同一次运行。** 留下容器 ID、进程 PID、退出时刻和最后一条成功日志。把平台的终止原因、退出码与该次运行对应起来，避免把重启前后的记录混在一起。
2. **查是谁终止了它。** Docker 显示退出码 **137** 时，先查同期操作审计、容器事件和内核日志。主动发送 SIGKILL（强制终止信号）也会得到这个退出码；只有退出码，不能断言内存不足。平台标记 `OOMKilled` 时，再核对同一 PID 和时刻的内核 OOM 记录，确定故障范围。
3. **确认为 OOM 后，再查哪一层没有余量。** 本容器超限，就核对组内进程、文件缓存等占用及加载峰值；上层控制组超限或整机不足，就查共享这一层预算的任务。设备分配报错则回到逐卡显存账。先找对层，再决定减小哪种占用或调整哪一层预算。

一个容易误读的证据是：`memory.events.local` 里的 `oom_kill` 增加。它说明本组有进程被 OOM killer 终止，**仍不能单独证明本组自己的上限触发了 OOM**。要用匹配的内核记录区分本组限额、上层限额和整机压力。计数要比较故障窗口前后，同一运行中的旧计数也不能直接算作这次事件；字段细节放在下文[会报什么错](#会报什么错)。

如果进程一直活着，只有 `high` 事件增加、主机回收等待变长，而设备单次执行耗时基本不变，先验证主机内存压力是否拖慢了供给。确认上层和整机有余量后，可以在隔离环境只调整这一个边界，保持请求负载不变做对照。回收等待下降只解释了其中一段耗时，是否满足用户等待时间仍按[推理测量](inference-benchmarking.md)验收。

**恢复不以“重启成功”结束。** 沿[容量与恢复案例](inference-capacity-and-reliability.md)恢复原负载，检查成功率、答案质量、用户可见延迟和受影响各层的资源余量；涉及同机任务时，要把它们一起运行。都满足预先约定，才收束到这组条件下；只消除 OOM、延迟仍不合格，就继续查剩余等待。

## 放到 GLM 双机：先装权重，再接住一个 token

### 启动时：主机读文件，每卡留下自己的权重

**主机上的文件缓存与每卡的常驻参数是两本账。** 沿用[官方双机前提](glm-5-3-flash-two-node.md#部署前提)：两台服务器各有 8 张 NPU；TP8 把同一矩阵切给机内 8 卡，EP16 把不同专家网络分给两机 16 卡，DP2 则把请求分给两个执行组。每台都只持有部分专家，两台合起来才有完整模型。

默认加载器先按本卡形状在 NPU 上分配参数，再逐个读取权重文件里的 CPU 张量。负责该参数的加载函数选出本卡分片，复制到已经分配的设备参数里；随后按算子要求转置或转换存储布局。主机里的文件页缓存、CPU 张量与设备里的处理后布局，不能按文件大小一比一替代。

每卡约 **20.58 GiB** 的子账包含主干和 **MTP**（模型自带、用于猜后续 token 的草稿层）的主要语言权重；MTP 的输出头复用主模型，不重复计。这个数对应部署页固定的 3121f187 量化配方；旧 9e55cbc8 把四组 MLA 投影保留浮点，同一子账约 **20.81 GiB**。两者都未计视觉塔、MTP 旋转矩阵、量化辅助张量等，20.81 不是完整占用的上界。量化用较少位数表示数值，附带缩放信息，部分矩阵仍保留浮点精度。版本与表外项统一见[权重账及其精度条件](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)，实际加载占用以日志测量为准。

### 请求到来：权重复用，激活和历史各有去处

[token](token.md) 是文本分词后用整数编号表示的单位，模型把它变成向量（一串按顺序排列的数），再用权重做计算。

**新 token 使用已有权重，同时产生临时结果和需要保留的历史。** 以 [R1](one-request.md#示例请求-r1-与官方双机部署) 为例：这是 prompt 含 4 个 token 的请求。跟其中一个 token 看，CPU 先记录它的编号与调度状态；准备输入时，所需编号和位置数据被送到设备。NPU 将编号查成向量，与常驻的权重矩阵计算，生成的中间向量叫激活，随这一轮计算使用与复用。

为了让下一步不必重算历史，引擎保留 **KV cache**，即供后续计算读取的历史表示。GLM 的稀疏 MLA 保存压缩后的逐位置历史；KDA 用固定大小状态概括已读历史。主干加 MTP 有 **12 层** MLA cache，TP 各卡保留其副本；KDA 的状态按各卡负责的头划分。因此不能把“权重分成八份”套成“所有缓存也除以八”。具体分组和每块字节见[缓存预算的唯一推导](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

| 主机账：每台服务器 | 设备账：逐张 NPU 分别看 |
|---|---|
| 模型文件的页缓存、加载中的 CPU 张量 | 本卡权重分片、完整的本地专家与必要副本 |
| token 编号、请求队列、调度及块号记录 | 执行用输入、激活、算子临时工作区 |
| 启用卸载时留在主机的历史数据 | 已分配的 KV／状态池、通信与图执行资源 |

同一 token 可以同时有主机记录和设备输入；块号记录也只说明去哪里读写，字节本身在设备池里。请求结束会归还块的使用权，池通常留给后续请求复用，所以空闲块增加未必表现为设备已用内存立即下降。R1 的具体块号账沿用[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。

### 启动预算：显存里还要容纳权重之外的东西

**自动预算从设备总容量出发，减去已加载权重和试跑测得的非缓存开销，余量才给缓存池。** 在 `v0.30.0` 主基线上，上游 `CacheConfig.gpu_memory_utilization` 默认取 **0.92**（预留 8% 给图捕获、通信缓冲与碎片余量）；试跑使用假输入，用于估计激活峰值和 PyTorch 张量统计之外的占用，例如部分运行时资源。主机空闲内存不参与这次设备预算，冷启动全链路显存台阶与测量机制可继续回链[NPU Worker 生命周期](npu-worker-lifecycle.md)与[显存探测](kv-cache-memory-profiling.md)。

双机页的[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)都假设每卡 **64 GiB**、激活峰值加非 PyTorch 占用 **3.4 GiB**，采用教程的 **0.85** 预算比例。另假设权重为 21 GiB 时，余下 **30.00 GiB、3,855 块**；只代入所列语言权重子账时，余下约 **30.42 GiB、3,908 块**，尚未扣视觉塔等表外项。两者都是教学预算，块数和算式只在部署页维护。

固定实现先切 KV，再捕获用于回放计算的图，所以图占用要从预算外余量支付。索引器在首次实际执行时建立的 **54 MiB/卡** FP32（32 位浮点数）副本同样晚于预算测量；该算例预留 **9.6 GiB** 支付这些后续开销。比例是预算安排，不是把运行时峰值硬锁在某条线上。64 GB 是十进制容量、64 GiB 是二进制容量；实机总字节必须看运行时上报，不能把教程写的“64GB”直接当作已验证的 64 GiB。

想把这些内存账对应到昇腾 950，继续看[片上缓冲与搬运路径](ascend-950-architecture.md)和[远端访问与互联](ascend-950-execution-interconnect.md)。新硬件规格集中在前一页；本页继续解释本地分配、远端访问与复制的区别。

## 常见误解：能访问，就等于已经在本卡了吗？

**可访问地址与物理存放位置是两件事。** 在硬件和运行时支持时，可以把主机内存注册、映射成设备可访问地址；设备沿该地址读取的是主机数据，注册动作本身没有把全部内容复制成本卡显存。普通复制则要先申请设备空间，复制完成后才得到本地副本。例如在 `v0.30.0` 与 `main` 的 V2 runner 路径中，启用 **UVA（Unified Virtual Addressing，统一虚拟编址）** 需要 `PYTORCH_NPU_ALLOC_CONF` 包含 `pinned_mem_register:True` 且 `triton-ascend` 版本不在受指针校验缺陷影响的 `3.2.1` / `3.2.2` 列表中；即便 UVA 可用，锁页主机内存仍物理驻留在主机侧，不计入 HBM 容量。

在支持 MemFabric 的超节点部署中，这类软件可把分散在多机的内存组织成可访问的池；它改变了寻址和访问方式，各处存储介质与传输路径仍然存在。预算要分清本地分配、远端访问和实际复制；支持范围受产品及软件版本限制。

- **“CPU 还有内存，NPU 就不该分配失败。”** 设备分配检查的是所选卡的空间；卸载需要对应实现和数据恢复流程。
- **“权重装得下，服务就一定能启动。”** 试跑、缓存池、通信资源及录图都还会申请空间，加载后处理也可能出现临时副本。
- **“把多卡容量加起来，就是任意一张卡可用的池。”** 本卡分配仍受本卡约束；并行切片决定哪些数据放哪张卡，映射也不消除远端访问代价。

## 对照源码

现场比较内存时，把加载后、试跑后、建池后、录图后与请求结束后的采样时点分开，并同时记录活动请求与空闲块。设备已用内存没有下降时，先按本页的池与引用区别判断，再沿[内存与容量排障](inference-troubleshooting.md#内存与容量先分清在哪个时点装不下)验证增长是否来自仍在使用的资源。

### 怎么开

**设备分配器的配置。** `PYTORCH_NPU_ALLOC_CONF` 是启动进程前设置的环境字符串，由 torch_npu 的缓存分配器读取；各项写成 key:value，用逗号分隔。固定 GLM 教程在两端都写 `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`。expandable_segments 让一段虚拟地址按需要增加物理页，减少批次尺寸略微变化时留下的零碎空间；它不增加 HBM 容量，也不代替上面的权重、激活与 KV 预算。

要分清三层默认：配套 torch_npu 2.10.0.post2 的构造默认是 false；Ascend 平台在有 model_config 且未启用 sleep mode 时，变量未设置便注入 expandable_segments:True；教程再显式固定为这个值。已有字符串含 expandable_segments 时保留原值，所以显式 False 不会被平台改回 True。已有其他项且不含 max_split_size_mb、garbage_collection_threshold 时，平台追加 expandable_segments:True；含这两个冲突键则不追加。不要把“变量已设置”误当成“平台绝不追加”。这些操作必须发生在分配器读取配置之前；修改正在运行服务的外部 shell 环境不会重配其内存池。

主机／设备的区分是默认执行路径的基础，无需开关。固定部署用 `--gpu-memory-utilization 0.85` 控制自动预算，名字里的 gpu 在此仍用于 NPU；它按总设备内存取比例，启动时另检查空闲量。若显式指定 `kv_cache_memory_bytes`，固定 Worker 仍试跑以准备模型，但返回指定字节数，跳过自动预算公式。卸载不是这个比例参数自动提供的功能。

下图把本页放回 A0：Worker 是管理一张卡的执行进程；图捕获是把计算序列记录下来，供之后回放。代码名只标在需要定位的步骤。

```wiki-diagram
file: device-memory-startup
```

先完成设备初始化，才能查询本卡容量、建立快照；空闲检查不通过则停止启动。通过后建立通信环境与执行器、加载权重并测量，再从自动或显式预算分支汇合到缓存分配。图捕获受执行模式控制；完整进程调用链见[请求调用链](request-call-chain.md)，本图聚焦内存发生在哪一步。

### 会报什么错

分配器配置使用大小写敏感的 True / False；例如 expandable_segments:true 不是这里接受的拼写。未知键会报 `Unrecognized CachingAllocator option`。显式启用 expandable_segments，并同时设置非默认的 max_split_size_mb 或 garbage_collection_threshold，会被配套分配器拒绝；平台“不追加”的保护不会修复用户已经写出的冲突组合。地址预留能力检查失败还可能报运行时错误或回退告警，先查匹配的 torch_npu、CANN 与驱动，不把它归为 KV 块不够。

`Free memory on device ... is less than desired GPU memory utilization` 表示启动快照的空闲量低于请求份额：核对当前设备号、同卡其他进程及配置比例。`Error in memory profiling` 的对应断言则检查试跑前后空闲量关系；同时有其他进程释放显存会扰乱测量。两者检查的都是设备账。

若应用没有来得及报错就退出，按上面的三步先查终止记录。确认要追主机内存后，再从平台找到故障进程所属的实际 cgroup 路径，连同上层一起读下面的文件。容器里可见的路径可能经过隔离，路径不明时由宿主机侧确认；不要拿另一容器或重建后的组代替。

核对操作审计时，`docker kill` 默认向容器主进程发送 SIGKILL；使用 `--signal` 可以改发其他信号。因此，记录要包含实际命令、目标容器和执行时刻，不能仅凭脚本里出现了 kill 这个词就确认误杀。

| cgroup v2 记录 | 用来回答什么 | 不能单独证明什么 |
|---|---|---|
| `memory.current`、`memory.peak` | 本组及后代当前占用、所记录期间的峰值；保留采样时间和峰值统计起点 | 退出后的小值不能还原退出前的峰值 |
| `memory.high`、`memory.max` | 回收节流边界与硬上限；同时读上层配置 | 本组没有设上限，不代表上层和整机无限 |
| `memory.events` / `memory.events.local` 的 `high`、`max`、`oom`、`oom_kill` 增量 | 分别看回收节流、触及硬边界、接近分配失败、进程被 OOM 终止 | `high` 增加不等于 OOM；`oom_kill` 增加不等于本组超限 |
| `memory.stat` | 区分匿名内存、文件缓存、内核等占用，决定往哪里追 | 不能把模型文件大小或几个进程占用简单相加，当成本组完整账单 |

`memory.events` 默认包含后代事件；`memory.events.local` 排除后代事件，**local 表示计数归属，不表示 OOM 起因一定在本组**。若挂载使用 `memory_localevents`，前者的统计范围也会改变，采集时要记录配置。上述计数和占用帮助缩小范围，最终仍与同一窗口的内核记录、操作事件对齐；缺日志时保留“原因未定”，不要靠单个数补出根因。

### 开销和什么时候别开

可扩展段需要管理虚拟地址与物理页映射，首次分配可能更慢；收益取决于实际分配形状和碎片情况。先保留 GLM 教程取值，再比较同一负载下的峰值与时延。若切到 sleep 场景，按 [sleep mode 的分配器约束](sleep-mode.md#怎么开)处理，不能直接沿用这条 export；当前双机部署没有启用 sleep。

将数据常驻设备减少后续传输，但占用设备容量；卸载释放常驻空间，用到数据时要支付传输与同步成本。评估时分别测主机峰值、每卡峰值和传输时间。加载日志 `Loading model weights took ... GB` 在固定实现里用字节数除以 2³⁰，数值实际按 GiB 表示；不能拿日志标签的 GB 与十进制硬件规格直接相减。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；GLM 双机绑定算例另钉 `db701c1f` + `0fc695fc`。容器主机内存部分依据 Linux 6.12 cgroup v2 及 Docker / Kubernetes 官方文档，与下表框架版本核对范围相互独立；主机注册和 MemFabric 支持范围由 CANN、驱动与硬件决定。

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `CacheConfig.gpu_memory_utilization` | 默认 `0.92`（GLM 教程显式覆盖为 `0.85`）；启动按总容量算额并校验空闲量 | 默认 `0.92`；规则相同 | 默认 `0.92`（`cache.py#L103-L105`）；启动快照校验见 `worker.py#L464-L474` | 字段改为 `float \| None = None`（默认可扩展 KV 缓存下解析为 `1.0`，否则 `0.92`），新增 `device_memory_utilization` 别名（`cache.py#L216-L237`） |
| 平台 `get_device_total_memory()` | 抛 `NotImplementedError`（防过早初始化 NPU） | 同左 | 守卫式查询：未初始化 `torch.npu` 时抛 `NotImplementedError`，已初始化后调 `torch.npu.mem_get_info`（`platform.py#L231-L244`） | 延续守卫式查询（`platform.py#L259-L265`） |
| `PYTORCH_NPU_ALLOC_CONF` 注入与 RL 清理 | 有 `model_config` 且未开 sleep 时条件注入/追加 `expandable_segments:True`（避开冲突键） | 同左 | 抽为 `_set_pytorch_npu_alloc_env`（`platform.py#L1445-L1464`）；`rl_config.enabled` 时在 `ascend_config.py#L377-L386` 主动移除 `expandable_segments`；单独 `enable_sleep_mode` 只阻止注入不删已有项 | 规则延续（`platform.py#L1743-L1752`） |
| 显式 `kv_cache_memory_bytes` 预算分支 | 先试跑，再直接采用指定字节数 | 先试跑，再经 sparse KV offload 约束调整 | 先试跑并跳过自动公式，再依次经 KV offload 与 `_apply_kvpp_memory_budget` 调整（`worker.py#L558-L598`） | 同上，额外先经 `_scale_kv_cache_memory_for_multi_group` 多组修正（`worker.py#L684-L707`） |
| UVA 主机锁页内存映射 | 无 Ascend V2 UVA 补丁 | 无该补丁 | `patch/worker/patch_v2/patch_uva.py#L29-L55`：`is_uva_available()` 校验 `pinned_mem_register:True` 与 `triton-ascend` 不在 `3.2.1`/`3.2.2` | 迁至 `patch/worker/patch_uva.py#L32-L58`，判据一致 |
| 两条内存报错、权重日志单位与录图顺序 | 均有；权重日志按 $2^{30}$ 报 GiB；分配 KV 后条件录图 | 同左 | 同左（`model_runner_v1.py#L4476` 报 GiB） | Worker 校验与录图顺序延续；主 runner 迁移至 V2 路径 |

`PYTORCH_NPU_ALLOC_CONF` 由 `torch_npu` 消费而非 vLLM 注册项，本文底层默认与冲突检查固定在 `torch_npu 8751b36d`（`2.10.0.post2`）。[平台契约](vllm-platform-interface.md)约定引擎查询设备能力的时机；固定部署 `db701c1f` 与 `v0.23.0` 一样禁止提前查询总显存，Worker 初始化后再按运行时快照核算。

### 源码位置

- `aclrtGetMemInfo` 返回设备空闲与总字节（不支持 HBM 时转查 DDR）[S1]；`aclrtHostRegister` 映射主机地址给设备访问（非权重复制）[S2]；MemFabric 跨机内存映射实践见 [S3]。
- Linux cgroup v2 接口与层级计数规则、Docker 资源约束/退出码 137/`docker kill` 信号以及 Kubernetes request/limit 与终止取证见 [S29][S30][S31][S32][S33][S34]。
- `BaseModelLoader.load_model`、权重切片与 W8A8 后处理布局支撑首图主机→设备复制方向 [C4][C5][C7]；`NPUModelRunner.load_model` 与 Worker 空闲检查、试跑、显式预算和条件录图见 `vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L464-L474`、`#L558-L598` 及 `vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L555-L565`、`#L684-L707` [C8][C10][C51][C52]。
- `CacheConfig.gpu_memory_utilization` 与 `kv_cache_memory_bytes` 四版入口见来源 16–18 及 46–48（`ced6857a` / `ba15685a`）[C46][C48]；平台总显存查询与 `PYTORCH_NPU_ALLOC_CONF` 条件注入及 RL 清理见来源 12–15、35–38、49–50、55–57 [C49][C50]；UVA 判定见 `vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_v2/patch_uva.py#L29-L55` 与 `vllm-ascend@8d6180e2:vllm_ascend/patch/worker/patch_uva.py#L32-L58` [C54][C60]；`torch_npu` 分配器解析与互斥检查固定在来源 39–41。
- 数字引用[双机部署](glm-5-3-flash-two-node.md)的权重与 KV 账：20.58／20.81 GiB 是两个固定量化版本的主要语言权重子账；64 GiB、3.4 GiB 和 21 GiB 权重预算是教学假设，3,855／3,908 是假设下的块数，不是启动实测。[D][A]

**待核：** 两份固定量化描述已取得，版本差异见部署页；运行时总字节、主机峰值、每卡加载与试跑峰值、图捕获峰值及 H2D 耗时仍需现场日志与测量，静态字节账不能直接换算时延。本部署的确切机型及配套 HBM、主机到设备链路带宽尚未确认，具体规格应与[硬件页](hardware-devices.md#官方带宽规格能说明什么)的型号对应；Atlas 800T A2 白皮书中的数字不能直接套到未确认机型。两份官方接口文档分别适用 CANN 9.0.0-beta.1 和 9.1.0，不构成一个已经验证的软件组合；MemFabric 现行支持仍需按部署版本核对。
