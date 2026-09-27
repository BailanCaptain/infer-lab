---
id: device-memory
title: "主机内存与显存：数据现在放在哪"
type: concept
summary: CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。
aliases: [显存, 设备内存, HBM, 主机内存, host memory, CPU 内存, Host]
chapters: ["07", "09"]
order: 110
sources:
  - https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - https://www.hiascend.com/document/detail/en/CANNCommunityEdition/910/API/runtimeapi/aclcppdevg_03_1804.html
  - https://www.hiascend.com/developer/techArticles/20251203-5
  - vllm@0fc695fc:vllm/model_executor/model_loader/base_loader.py#L43-L82
  - vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L1021-L1027
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L530-L565
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L152
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L469-L480
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L282
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L282
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L281
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237
  - vllm@0fc695fc:vllm/config/cache.py#L67-L80
  - vllm@568afb3a:vllm/config/cache.py#L68-L81
  - vllm@84030bbe:vllm/config/cache.py#L112-L125
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L469-L480
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L453-L464
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L447-L458
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L496-L525
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L733
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L779
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L551-L880
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3796-L3796
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3849-L3849
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4380-L4380
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先明确设备边界，才能回答某段内存归哪个设备使用
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: A0 启动及每卡权重、KV 预算的数字与推导统一在双机部署页}
  - {to: kv-cache-cpu-offload, kind: builds-on, note: 本页的卸载边界依赖实际搬运机制，继续读可看 KV 在主机和设备间怎样恢复}
  - {to: vllm-platform-interface, kind: builds-on, note: 平台契约决定何时能查询设备，不能把通用接口当作提前初始化的许可}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 权重在主机里，为什么还要搬进显存？

**主机内存供 CPU 使用；显存是计算设备本地的内存，本页的设备是负责模型计算的 NPU。** 权重是训练好的数值，常排成按行、列组织的[矩阵](matmul-and-weights.md)。

默认的本地计算路径要求 NPU 从本卡设备内存读取输入和权重，不能把普通 CPU 张量的主机地址直接交给算子使用。设备上的 HBM（高带宽内存）读取带宽远高于主机到设备链路；计算会反复读取所需权重，因此默认部署让权重常驻设备，只在加载时搬入，避免每轮计算都经过较慢的链路。支持主机注册、映射的路径另见下文：能远端访问，也仍要支付链路代价。

本页挂靠 [A0：启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。默认加载路径先把权重读入主机，再把本卡要用的部分复制进显存。

```wiki-diagram
file: device-memory
```

图中两侧 W 都表示已经选出的本卡权重分片，不是左侧完整矩阵缩成右侧分片；所以两边格数相同。左边是主机源数据，右边是复制后的设备数据，箭头“复制本卡所需部分”指复制这段 W。复制不会自动释放源数据，两边同时保留时各记一笔占用；多卡部署会先选出本卡分片，再沿这条路径搬运。

## 为什么要分开记账，搬运的代价在哪里？

**NPU 执行默认的本地计算路径，需要本卡显存里已有输入和权重。** GLM 双机配方下，每卡权重约 **20.58 GiB**，还要给计算中间结果和请求历史留空间；权重分项与精度条件见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。主机能装下模型文件，只解决了读取与暂存这一侧的问题。

主机到设备的复制叫 **H2D**。加载器取出本卡那一段权重之后发生 H2D，依赖它的计算必须等数据可用。常驻权重在启动阶段按张量分批搬入，形成每卡约 20.58 GiB 的本地权重；后续每层处理 token 时，常驻权重的 H2D 次数为 0，直接复用本地数据。若另行启用卸载，把暂时不用的数据留在主机，用到时就要付出恢复传输或远端读取的代价；具体对象和触发条件见 [KV cache CPU 卸载](kv-cache-cpu-offload.md)。

| 要区分的量 | 回答什么问题 |
|---|---|
| 主机内存／本卡显存 | 字节实际存在哪一侧，向谁申请空间？ |
| 容量／带宽 | 能放多少字节／每秒能搬多少字节？ |
| 权重／激活 | 训练后保留的参数／本次计算产生的中间结果？ |
| HBM／显存 | 内存技术名字／设备本地内存的用途叫法？ |

HBM 是高带宽内存技术，容量和带宽仍要看具体硬件；部分昇腾设备使用 DDR，运行时查询 HBM 时会按支持情况转查 DDR。设备内存不足是容量问题；装得下却算得慢，还要测取数、计算和通信各花了多久，不能仅凭“用了 HBM”判断瓶颈。

## 放到 GLM 双机：先装权重，再接住一个 token

### 启动时：主机读文件，每卡留下自己的权重

**主机上的文件缓存与每卡的常驻参数是两本账。** 沿用[官方双机前提](glm-5-3-flash-two-node.md#部署前提)：两台服务器各有 8 张 NPU；TP8 把同一矩阵切给机内 8 卡，EP16 把不同专家网络分给两机 16 卡，DP2 则把请求分给两个执行组。每台都只持有部分专家，两台合起来才有完整模型。

默认加载器先按本卡形状在 NPU 上分配参数，再逐个读取权重文件里的 CPU 张量。负责该参数的加载函数选出本卡分片，复制到已经分配的设备参数里；随后按算子要求转置或转换存储布局。主机里的文件页缓存、CPU 张量与设备里的处理后布局，不能按文件大小一比一替代。

每卡约 **20.58 GiB** 的统计包含主干和 **MTP**（模型自带、用于猜后续 token 的草稿层）权重；MTP 的输出头复用主模型，不重复计。这个数按部署页列明的量化配方计算；量化用较少位数表示数值，附带缩放信息，部分矩阵仍保留浮点精度。若 MLA 的三个大投影未量化，部署页保留的上界为 **20.81 GiB**。这里引用[权重账及其精度条件](glm-5-3-flash-two-node.md#开销和什么时候别开)，实际加载占用以日志测量为准。

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

**自动预算从设备总容量出发，减去已加载权重和试跑测得的非缓存开销，余量才给缓存池。** 试跑使用假输入，用于估计激活峰值和 PyTorch 张量统计之外的占用，例如部分运行时资源。主机空闲内存不参与这次设备预算，测量机制可继续读[显存探测](kv-cache-memory-profiling.md)。

双机页的[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)都假设每卡 **64 GiB**、激活峰值加非 PyTorch 占用 **3.4 GiB**，采用教程的 **0.85** 预算比例。权重向上取整为 21 GiB 时，余下 **30.00 GiB、3,855 块**；用未取整权重时，余下约 **30.42 GiB、3,908 块**。两者是同一组假设的不同权重口径，块数和算式只在部署页维护。

固定实现先切 KV，再捕获用于回放计算的图，所以图占用要从预算外余量支付。索引器在首次实际执行时建立的 **54 MiB/卡** FP32（32 位浮点数）副本同样晚于预算测量；该算例预留 **9.6 GiB** 支付这些后续开销。比例是预算安排，不是把运行时峰值硬锁在某条线上。64 GB 是十进制容量、64 GiB 是二进制容量；实机总字节必须看运行时上报，不能把教程写的“64GB”直接当作已验证的 64 GiB。

## 常见误解：能访问，就等于已经在本卡了吗？

**可访问地址与物理存放位置是两件事。** 在硬件和运行时支持时，可以把主机内存注册、映射成设备可访问地址；设备沿该地址读取的是主机数据，注册动作本身没有把全部内容复制成本卡显存。普通复制则要先申请设备空间，复制完成后才得到本地副本。

在支持 MemFabric 的超节点部署中，这类软件可把分散在多机的内存组织成可访问的池；它改变了寻址和访问方式，各处存储介质与传输路径仍然存在。预算要分清本地分配、远端访问和实际复制；支持范围受产品及软件版本限制。

- **“CPU 还有内存，NPU 就不该分配失败。”** 设备分配检查的是所选卡的空间；卸载需要对应实现和数据恢复流程。
- **“权重装得下，服务就一定能启动。”** 试跑、缓存池、通信资源及录图都还会申请空间，加载后处理也可能出现临时副本。
- **“把多卡容量加起来，就是任意一张卡可用的池。”** 本卡分配仍受本卡约束；并行切片决定哪些数据放哪张卡，映射也不消除远端访问代价。

## 对照源码

### 怎么开

主机／设备的区分是默认执行路径的基础，无需开关。固定部署用 `--gpu-memory-utilization 0.85` 控制自动预算，名字里的 gpu 在此仍用于 NPU；它按总设备内存取比例，启动时另检查空闲量。若显式指定 `kv_cache_memory_bytes`，固定 Worker 仍试跑以准备模型，但返回指定字节数，跳过自动预算公式。卸载不是这个比例参数自动提供的功能。

下图把本页放回 A0：Worker 是管理一张卡的执行进程；图捕获是把计算序列记录下来，供之后回放。代码名只标在需要定位的步骤。

```wiki-diagram
file: device-memory-startup
```

先完成设备初始化，才能查询本卡容量、建立快照；空闲检查不通过则停止启动。通过后建立通信环境与执行器、加载权重并测量，再从自动或显式预算分支汇合到缓存分配。图捕获受执行模式控制；完整进程调用链见[请求调用链](request-call-chain.md)，本图聚焦内存发生在哪一步。

### 会报什么错

`Free memory on device ... is less than desired GPU memory utilization` 表示启动快照的空闲量低于请求份额：核对当前设备号、同卡其他进程及配置比例。`Error in memory profiling` 的对应断言则检查试跑前后空闲量关系；同时有其他进程释放显存会扰乱测量。两者检查的都是设备账。

### 开销和什么时候别开

将数据常驻设备减少后续传输，但占用设备容量；卸载释放常驻空间，用到数据时要支付传输与同步成本。评估时分别测主机峰值、每卡峰值和传输时间。加载日志 `Loading model weights took ... GB` 在固定实现里用字节数除以 2³⁰，数值实际按 GiB 表示；不能拿日志标签的 GB 与十进制硬件规格直接相减。

### 版本差异

本页三版核对范围包括设备预算入口、比例默认值、平台容量查询，以及显式预算分支、两条内存报错、权重日志单位和缓存分配与录图的先后。GLM 的具体加载路径另钉在固定部署提交；主机注册和 MemFabric 的支持范围由 CANN、驱动与硬件决定，不由 vLLM 分支名决定。

| 核对项 | v0.23 | v0.26 | main | 对使用者意味着什么 |
|---|---|---|---|---|
| 每卡按总容量取预算，并检查启动空闲量 | 有 | 有 | 有 | 三版都按设备记账，主机空闲量不补入 |
| 上游比例默认值 | 0.92 | 0.92 | 0.92 | 三版一致；本教程显式覆盖成 0.85 |
| 平台 `get_device_total_memory()` | 抛未实现异常 | 同左 | 未初始化时抛异常，已初始化时查询 | main 的守卫式查询不能套回固定镜像 |
| 显式缓存预算分支 | 先试跑，再采用指定字节数 | 同样先试跑、跳过自动预算；可受 sparse KV offload 调整 | 同样先试跑、跳过自动预算；可受 KV offload、KVPP 调整 | 三版都有此分支；一致的是试跑和跳过自动预算，返回值的附加约束有差异 |
| 两条内存报错、权重日志单位、录图顺序 | 均有；日志按 GiB，分配 KV 后条件录图 | 同左 | 同左 | 三版一致；录图仍受执行模式控制 |

Ascend 三版依次钉在 `2c59ff10`、`2ed6cbba`、`baa023ad`，上游依次为 `0fc695fc`、`568afb3a`、`84030bbe`。[平台契约](vllm-platform-interface.md)约定引擎怎样选择设备、查询能力；Ascend 实现在合适的初始化阶段履行它。固定部署的 Ascend `db701c1f` 与 v0.23 一样主动禁止这个平台接口提前查询，以免过早初始化 NPU；Worker 初始化后仍可通过运行时获得内存快照。这里的 verified 表示所列入口经过源码核读，未表示三版 GLM 或硬件性能均已实测。

### 源码位置

- `aclrtGetMemInfo` 要先选定设备，返回其空闲与总字节数（不含系统预留），并列出不支持 HBM 时转查 DDR 的行为。[S1]
- `aclrtHostRegister` 返回可供设备访问的映射地址；主机操作仍用原地址。文档限制支持产品、页对齐与操作系统版本；它不是权重复制接口。[S2]
- MemFabric 的特定 Atlas A3 实践是跨机异构内存映射的来源，属于有产品前提的软件能力。[S3]
- `BaseModelLoader.load_model` 在目标设备上建参数；迭代器产生 CPU 权重，Linear 加载器先切片再 `copy_`，W8A8 后处理转置并准备算子布局。共同支撑首图的加载方向与两地副本语义。[C4][C5][C6][C7]
- `NPUModelRunner.load_model` 测量主模型和草稿模型加载占用；Worker 先做空闲检查，再经 `determine_available_memory` 试跑取得预算，后续 `compile_or_warm_up_model` 才条件录图。来源 22 确认通信环境和执行器在空闲检查通过后建立。[C8][C9][C10][C11][C22]
- 平台查询的固定实现与三版差异、三个上游默认值、三个 Worker 空闲检查分别对应来源 12–21；其核对范围限定在上表。[C12][C13][C14][C15][C16][C17][C18][C19][C20][C21]
- 来源 23–25 依次对应三版 Worker 的显式预算、profiling 断言与条件录图；来源 26–28 对应三版加载日志的 GiB 换算。显式预算的后续约束按版本表区分，不能把“跳过自动预算”理解成所有分支原样返回指定值。
- 数字引用[双机部署](glm-5-3-flash-two-node.md)的权重与 KV 账：20.58／20.81 GiB 是带精度条件的推导；64 GiB 和 3.4 GiB 是教学假设，3,855／3,908 是假设下的块数，不是启动实测。[D][A]

**待核：** 真实权重仓库的量化描述、运行时总字节、主机峰值、每卡加载与试跑峰值、图捕获峰值及 H2D 耗时仍需现场日志与测量；本页不据静态账估时。现有底稿没有给出本部署 HBM 与主机到设备链路的配套带宽数据，正文只说明快慢关系，具体带宽及相差倍数待官方规格或实机测量核实。官方接口文档分别是 CANN 9.0.0-beta.1 和 9.1.0，不能拼成已验证的软件组合。2026-09-28 联网复核取得两份接口正文（第一份由搜索缓存返回）；MemFabric 旧文章本轮请求超时，保留旧来源，文章现行内容待复核。
