---
id: rfork
title: RFork：权重远端复用机制与排错总览
type: feature
summary: >-
  新实例启动时可按地址读取兼容来源显存中的权重；借不到或读取失败时，停止 seed 服务并安全清理登记内存后可退回默认加载。本页是社区上游
  vllm-ascend main（8d6180e2）RFork 专题的入口：借的步骤、四种「成功」、GLM 双机推演和全章唯一的四版本对照。
aliases:
  - RFork
  - rfork
  - R-Fork
  - Tensor Remote Fork
  - Tensor R-Fork
  - RFork 工作版
  - rfork_loader
chapters: []
order: 10
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L747-L877'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L115-L276'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L783-L876'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L490-L559'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L878-L957'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L229-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L153-L204'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/manifest.py#L87-L214'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L38-L45'
  - 'https://github.com/vllm-project/vllm-ascend/pull/12995'
  - 'https://github.com/vllm-project/vllm-ascend/pull/15439'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L258-L300'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L149-L246'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L137-L287'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L207-L288'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L531-L567'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L289-L445'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L230-L295'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/model_loader/rfork/rfork_loader.py#L225-L290'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/rfork_loader.py#L340-L410'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L128-L165'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/types.py#L14-L81'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_client.py#L58-L110'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L227-L273'
  - >-
    raw:sha256-9b6dec7112ddc012b981abdc59dde0be677825420760e49b3762f8533a304e33.md#L1-L1185
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L600-L710'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/identity.py#L219-L339'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/local_weights.py#L61-L97'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L34-L69'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_server.py#L178-L198'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/transfer_backend.py#L298-L459'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/transfer_backend.py#L31-L100'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L529-L592'
verified:
  - main
evidence: C
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: RFork 在 Worker 加载模型时运行，推理请求开始前就要把权重准备好
contradicts: []
updated: '2026-11-19'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-83e2a01865a32aa947474f37b05149cfa00df90169b1014f4d2301934a03afb6.md
  - >-
    raw/sha256-9b6dec7112ddc012b981abdc59dde0be677825420760e49b3762f8533a304e33.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 已经有实例在跑同一个模型，新实例还要从存储再读一遍权重吗

设想实例 A 已经起好、正在服务请求。流量涨了，要再起一个一模一样的实例 B。B 开始算之前，得先把模型权重放进自己的 NPU 显存。默认做法是把 A 当初走过的路再走一遍：从存储读 checkpoint 文件，挑出本卡那一份拷进显存，再做一遍昇腾的后处理（步骤见 [Worker 生命周期](npu-worker-lifecycle.md)）。

可这份权重 A 的显存里本来就有，而且已经是处理好的样子。**RFork（Tensor Remote Fork）让 B 按地址把 A 显存里的权重字节直接读过来，读不成再退回默认路径从存储加载。** B 先在自己卡上把模型的空架子搭好、把放权重的空位开好，再把 A 那边对应的字节读进这些空位。

图里有两个新角色：

- **seed**：被借的一方，已经就绪、愿意把权重借出去的实例。准确说是它上面的某一个 Worker（每张卡一个进程）；后面会看到，借是一张卡对一张卡。
- **Planner**：集群外的一个小服务，记着现在有哪些 seed。B 拿自己的「身份」来问，Planner 挑一个身份相同的 seed，再发一张**租约**（lease），记下「这个 seed 正被人借着」；B 读完要把租约还回去。

```wiki-diagram
file: rfork-two-paths
```

借到的只是**数据**，不是进程，也不是两边共用一块内存。B 有自己的一份模型、自己的显存、自己的请求和 KV Cache，和 A 互不相干。B 读完、还了租约以后，自己也能当 seed，借给下一个实例。

## 为什么要借，代价又在哪

默认路径的时间花在搬运上：每个 Worker 都要找到文件、从存储读出来、按名字对上模型里的参数、切出本卡那一段、从主机内存拷进显存。模型越大越久，而且每次扩副本、每次重启都要从头再来。借权重时，这几步换成了一次卡对卡的读取：字节从 seed 的显存直接到 B 的显存，不经过存储，也不用再解析文件。

省下的只是「权重字节从哪来」这一段。下面几件事不省，还多出几条要求：

| | 说明 |
|---|---|
| 仍要做的事 | B 照样自己搭模型；要转布局的模型（开了量化、权重 NZ 模式为 2 或硬件要求 NZ，见[张量布局](rfork-layout.md#先看-b-要不要转布局)）还要先对空参数跑一遍后处理（转置、转存储格式），让空位的形状、类型、格式和 seed 显存里的一模一样，才能按字节对拷 |
| 必须同身份 | 配对键中的模型版本、并行切法、精度、量化与布局描述须一致；这些字段不校验权重内容，相同路径下替换了文件仍须由部署方确认内容版本 |
| 得先有 seed | 没有同身份来源时借不到。当前主线在问 Planner 之前已搭空模型、准备布局并登记本地显存以绑定结构摘要；回退会重做模型构建与加载，增加了启动工作，实际耗时差要测量 |
| 多两个依赖 | 外部的 Planner 服务，和提供卡间读取的 YuanRong 传输库 |

所以收益不是「读成功」就自动有的：它取决于原来的存储有多慢、卡间网络多快、后处理要多久、其他启动步骤占多少。要不要用，得在自己的集群上对比两种启动的耗时，测法见[配置与部署](rfork-config.md)。

还要分清它在什么时候起作用。RFork 只发生在启动时加载权重这一段，请求还没进来。之后请求照常走分词、调度、前向和采样，和默认加载出来的实例没有区别；它不负责给请求挑机器，也不会把 A 正在服务的对话挪到 B。所以要读多少字节，只由要传哪些权重、怎么切分决定，和以后的请求多长无关：清单不变时，请求是 37 个 token 还是 100 个 token，这次加载读的字节都一样。

## 借一次权重，B 的每个 Worker 走哪几步

以 B 上的一个 Worker 为例，顺序如下；每一步的细节在箭头后的子页里。

1. **建会话、算配置指纹。** 先检查绕过条件（sleep mode、在线权重传输或 EPLB），再准备会话对象，把协议版本、模型标识、模型版本、量化配置摘要、架构、RoPE、有效 `kv_role` 与 `mix_placement` 做成兼容性指纹；分片编号（TP / PP / EP、需要时的 DP 分片编号 `sharded_dp_rank`）和主/草稿角色也记进身份，但 `seed_key` 等结构摘要算完才绑定。→ [身份匹配](rfork-identity.md)
2. **搭空模型与准备布局。** 在卡上把模型建好，恢复 MTP/DSpark 所需的 checkpoint 归属状态并加载 Engram 宿主表（如启用）。全部可传权重已与主模型共享的草稿可在这里提前返回（`source=shared_target`）。要转布局的模型先对空参数跑后处理，并等卡上异步的格式转换全部做完。→ [启动路径](rfork-startup.md)、[张量布局](rfork-layout.md)
3. **登记本地内存并绑定 `seed_key`。** 先把空位所在的显存登记给传输引擎，并从登记扫描得到的张量清单（稳定 ID、形状、dtype 与 NPU 存储格式）算出结构摘要，结合兼容性指纹和分片角色绑定最终 `seed_key`。这样登记耗时移到了租约有效期之外。→ [传输](rfork-transfer.md)
4. **向 Planner 借。** 拿已绑定的 `seed_key` 去问；借到就拿回 seed 的 IP、端口、租约编号（及可选的 `LEASE_TTL_SEC`，有 TTL 时启动后台续租线程），借不到就直接回退。
5. **要清单。** 向 seed 上的 HTTP 服务要协议版本、传输端点、权重五元组与每个张量的 NPU 存储格式清单。
6. **核清单。** 两边的张量名字（扣除已验证的共享跳过项）要对得上；逐个核形状、元素个数、每个元素几字节、dtype 与 NPU 存储格式；张量条数和总字节数两边也要相等。
7. **按批读。** 每个张量读「元素个数 × 每元素字节」，装成一批批同步读取，一批读完再读下一批。
8. **后台还租约，尝试发布，再交回模型。** 数据读完即停止续租并安排后台归还；启动线程继续完成适用的后处理（或 processed 路径的 FlatQuant 宿主标量刷新）和 `eval()`，先尝试让 B 成为 seed，再返回模型。租约已经归还时可启动 seed 服务、登记并定时心跳；还没归还时则延期发布，模型仍可交回，后续由后台补办。→ [租约与生命周期](rfork-lifecycle.md)

前述 RFork 加载尝试借不到来源或抛错时，先尝试停止 seed 服务、注销登记内存并恢复模型状态。已有会话返回的清理结果只有满足 `service_stopped && memory_reset`，才允许继续分配默认加载的模型；停服务或内存清理不成功时保留存储持有者并报错，避免旧资源仍被使用时再分配第二份模型。租约尚未归还本身不挡回退，归还仍可由后台重试。默认加载能否成功、加载后能否发布为 seed，还要分别看后续结果。

第 7 步的装批规则是：先把超过 $1\text{ GiB}$ 的张量切成不超过 $1\text{ GiB}$ 的段；再按清单顺序往一批里装，下一段装进来会让这批超过 $1\text{ GiB}$，或者这批已经有 $512$ 段，就封批另起一批。用四个示意张量（`1.5`、`0.3`、`0.6`、`0.2 GiB`）演一遍，先拆段得到 $1.5 = 1 + 0.5\text{ GiB}$，共 $5$ 段：

| 批次（示意数） | 装入的段 | 本批字节数 | 封批原因 |
|---|---|---|---|
| 第 1 批 | $1\text{ GiB}$ | $1.0\text{ GiB}$ | 再装 $0.5\text{ GiB}$ 会超过 $1\text{ GiB}$ |
| 第 2 批 | $0.5 + 0.3\text{ GiB}$ | $0.8\text{ GiB}$ | 再装 $0.6\text{ GiB}$ 会超过 $1\text{ GiB}$ |
| 第 3 批 | $0.6 + 0.2\text{ GiB}$ | $0.8\text{ GiB}$ | 清单结束 |

$$1.0 + 0.8 + 0.8 = 2.6\text{ GiB（共 3 批）}$$

同样四个张量若换按 `1.5`、`0.6`、`0.3`、`0.2 GiB` 的顺序，则会装成 `1 | 0.5 | 0.6 + 0.3 | 0.2`，共 $4$ 批。

所以「总字节 ÷ 1 GiB 向上取整」只是批数的下限。比如 6 亿个 BF16 数，每个 2 字节，共 1.2 GB，约 1.12 GiB，至少 2 批；实际几批还要看清单里张量的大小和顺序。小张量多时还会碰到 512 段的上限：600 个 1 MiB 的张量合计才 600 MiB，也要分成 512 段和 88 段两批。这里的「批」只是权重传输的批次，和 [KV Cache](kv-cache.md) 里按 token 切的块不是一回事。

## 三条通道：协调、清单、字节各走各的

上面八步里，B 要和外面打三种交道，走的是三条不同的通道。出了问题，先判断是哪一条：

```wiki-diagram
file: rfork-architecture
```

| 通道 | 传什么 | 谁负责 | 出错时先看 |
|---|---|---|---|
| Planner 协调 | 该找谁借、发租约、收回租约、seed 登记和心跳 | 两边的 Planner 客户端 | seed key、HTTP 状态码、租约记录 |
| seed 的 HTTP 元数据 | 传输端点，每个张量的名字、地址、形状、类型 | A 上的 seed 服务、B 上的 seed 客户端 | 返回的结构、地址能不能到、清单对不对得上 |
| 权重数据 | NPU 上张量的字节 | 传输后端（调 YuanRong 传输引擎） | 内存登记、字节范围、传输引擎的报错 |

Planner 和 seed 的 HTTP 接口都不搬权重本身。B 从元数据里拿到 A 的端点和地址，然后自己发起读取。所以「HTTP 都通了」只能说明前两条通道有一部分是好的，搬字节的那条还没验。

## 「成功」至少有四种，不能压成一个开关

启动日志里能看到好几种「成功」，它们证明的事情不一样：

| 看到的结果 | 已经证明了什么 | 还没证明什么 |
|---|---|---|
| 日志说权重传完了 | 这一次列出的所有读取都返回成功 | 后处理、模型服务就绪、输出对不对 |
| 加载器把模型交回来了 | 模型走完了这条加载路径，进入推理模式 | 整个 API 服务已经起来、B 自己已经能当 seed |
| 日志说租约归还被确认 | Planner 对归还请求回了 200（找到并收回），或回了 404（那里已经没有这张租约） | 整段传输期间租约一直有效；回 404 时，连「是按时还上的」都说明不了 |
| 日志说 seed 服务已启动 | B 上的 seed 服务起来了，并完成第一次登记 | 之后一直健康、下一个实例一定能匹配到它 |

传输成功后，归还租约的 HTTP 请求由后台线程发送，启动线程不等待这次网络归还完成。归还还没被确认时，「B 成为新 seed」这件事先记成延期，模型照常交回；后台默认先进行 3 次快速尝试（每次隔 30 秒），遇到暂态错误（408、429、5xx 或网络异常）在 3 次后转入至少 60 秒间隔的慢速重试，确认后再补上 seed 服务和登记。Planner 明确拒绝（比如回 400）则立即停止并放弃延期登记：B 照常推理，只是不当 seed。seed 服务没起来，也不会把已经加载好的模型扔掉——模型照样交回，只是 B 暂时不当别人的来源。

## 同一个词分属不同层：软件栈、角色与编号

读 RFork 最容易混的是**同一个词分属不同层**：一个 seed 不是整个模型集群，一个地址不是一个张量的身份，一个 lease 不是内存锁。

先把软件栈分层：**NPU** 是实际存放和计算张量的加速卡；**PyTorch** 提供张量、参数、模块这些模型对象；**torch_npu** 把 PyTorch 接到昇腾设备上；**CANN** 是昇腾的计算软件栈。**YuanRong 数据系统**（Python 包名 `yr.datasystem`）提供 RFork 用的数据传输能力，不参与逐 token 推理。RFork 用到的传输引擎、内存登记、错误码三样都从这个包导入，导入不到就直接抛导入错误（`ImportError`），原文见[会报什么错](#会报什么错)——传输本身不是 RFork 自己实现的。所以排错时要分别报上各层的版本，RFork 的 Python 代码决定不了底层设备调用怎么表现。

**native** 指 Python 往下调用本地库或设备接口的那部分；**同步**指这次调用要等对应操作做完才返回，**异步**指把工作交给后台继续做。它们要带着对象理解：同一条加载流程里，权重读取是同步的，返回就说明这批字节已经到位；归还租约是异步的，只是把请求交给后台线程。两件事的「完成」不在同一个时刻。

角色会复用在同一个 Worker 里：先当接收方（receiver），模型就绪、租约还掉以后又可以当 seed；角色变了不等于另建一个模型。各种编号最后进到[匹配规则](rfork-identity.md)里，但不是每个编号都直接写进 seed key——比如全局 rank 不在 seed key 里，而只在需要区分跨 DP 权重分片（fine-grained TP 或多 DP MoE）时才把 DP rank 写进 `sharded_dp_rank`。

和普通加载比，RFork 只改变权重数据从哪来，本地模型照样要建，另外多出三个条件：两边的模型分片兼容；传输期间地址一直有效；传完或失败后资源能正确回收。其中涉及的[张量与权重](matmul-and-weights.md)、[设备内存](device-memory.md)、[量化](quantization.md)和[并行组](collective-communication.md)沿用基础页的含义。

会话走过的八个阶段（含先登记目的内存的 `REGISTERED`）、租约归还的三种结果（已收回、可重试、被拒）、seed 服务启动的三种结果（已启动、延期、失败），以及回退前的清理结果，在[生命周期页](rfork-lifecycle.md)按真实调用展开；对应的类名列在本页[源码位置](#源码位置)。日志里看见「延期」（`DEFERRED`）时，先查延期的是哪件事，不要直接理解成「模型不可用」。

官方文档的图和量化说明里还会遇到 NIC、RDMA、RoCE、HBM，以及 BF16、W8A8、W4A8，它们的含义和在图里的位置见[官网核读页](../sources/rfork-official-guide.md)，别把网络协议、网卡和内存混成一层。官方文档提到的 **SFA** 是稀疏注意力的实现路径，RFork 不做它的注意力计算，只要保证它推理要用的张量也被收进清单；`W_UV`、`W_UK_T` 是这条实现派生出的权重名，分别用于 Value 的上投影和 Key 上投影的转置，不是某条请求的 V/K Cache，为什么不能漏传见[布局页](rfork-layout.md)。

## 排错先问三件事：哪个版本、哪个阶段、哪个 rank

**哪个版本。** 本章按社区上游 `vllm-project/vllm-ascend` `main` 主基线（`8d6180e2`）展开，并对照 `v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）与 `v0.30.0`（`c09d3e20`）三个历史版本。早期独立工作分支补丁已陆续合入上游演进为当前实现；排错先把几类代际分开：

- **上游 `main`（`8d6180e2`，本章主基线）**：14 个模块，完整包含会话生命周期（`RForkSession`）、配置指纹 + 结构摘要身份匹配、先登记再借租约、双槽 seed 端口 + `EADDRINUSE` 退动态、`get_rpc_port()`、可选 `LEASE_TTL_SEC` 续租与慢速归还重试、`safety.py` 统一绕过（sleep mode / 在线权重传输 / `enable_eplb`）、`local_weights.py` Engram 宿主表加载、MTP/DSpark checkpoint 归属恢复与分层 BFS 扫描去重。
- **社区 `v0.30.0`（`c09d3e20`）**：13 个模块，已有独立会话、结构摘要、双槽端口与 `LEASE_TTL_SEC` 续租；但尚未合入 Engram 宿主表（`local_weights.py`）、DSpark 归属恢复、BFS 去重与 RoPE 派生缓存排除、新增两项 Planner 配置开关，且仍保留旧 Model Runner V1 EPLB 绕过分支与 `finegrained_tp` 的 `> 0` 判断。
- **旧社区版本 `v0.23.0`（`2c59ff10`）与 `v0.26.0rc`（`2ed6cbba`）**：旧六文件结构，先问 Planner 再搭模型、明文拼接 seed key、无会话与清单格式校验，也没有等异步布局转换完成、storage 保活与草稿重叠排除；量化和 MoE 模型可能传到未转完的布局。

逐项行为的四版本对照见本页的[版本差异](#版本差异)，各子页的版本说明以那里为准。

**哪个阶段。** 同一句「传输失败」可能出在内存登记、取元数据、核清单，也可能真是读数据时失败。只截最后一行，信息通常不够。要留下第一次 RFork 报错之前的上下文，至少带上：工作版的提交、是主模型还是投机解码的草稿模型、各类 rank、两端的配置，以及 Planner 的相关响应。

**哪个 rank。** 借是按卡配对的：B 的每个 Worker 各自算 seed key、各自借、各自读、各自回退。看日志先确认是哪一张卡、是主模型还是草稿模型的那一套。

排错先读[排错页](rfork-troubleshooting.md)，再顺着里面给的源码位置去核。这一章标着「对源码核过」的结论，意思是对着社区上游 `main`（`8d6180e2`）源码逐行读过，**不代表在真实 NPU 集群上复现过**；涉及网络、数据系统接口或生产环境 Planner 的行为，要用现场证据补齐。

## 这一章其余各页回答什么

| 阅读顺序 | 这一篇回答什么 |
|---|---|
| 1. 术语 | seed、rank、layout、storage、MR、manifest、lease 分别指什么：逐词的词表在知识库术语表第五节「RFork」，分层说明见本页[上面一节](#同一个词分属不同层软件栈角色与编号) |
| 2. [启动路径](rfork-startup.md) | 从选中加载器到模型返回，先做什么，什么时候登记与申请租约 |
| 3. [身份匹配](rfork-identity.md) | 为什么有实例却找不到 seed，怎样避免拿错分片 |
| 4. [张量布局](rfork-layout.md) | 量化和 NZ 为什么改变传输时机，为什么排除运行期临时缓冲区 |
| 5. [传输](rfork-transfer.md) | 清单与 NPU 格式怎样验收，一次读取怎样形成；地址背后的对象谁保活，主模型和草稿模型怎样避免重复登记 |
| 6. [租约与生命周期](rfork-lifecycle.md) | 为什么传完了还不能成为 seed，续租与慢速归还怎样工作，什么时候允许回退或销毁 |
| 7. [配置与部署](rfork-config.md) | 十三项参数放哪、默认值、四类端口与双槽分配、限制、怎样测启动收益 |
| 8. [报错排查](rfork-troubleshooting.md) | 按原始日志找阶段，区分证据、候选原因与下一步 |
| 9. [版本维护](rfork-maintenance.md) | 历史补丁怎样演进并合入社区上游，升级时怎样隔离旧 seed 与核对变更 |

每篇只回答一个问题。专业词先在术语表找入口，到机制页再结合具体的地址、状态和调用展开。

另有一页[官网全文与原图核读](../sources/rfork-official-guide.md)：对照社区上游官方指南与原图，解释架构图各层、保留旧模型表记录并标明各版本差异。排错时先确认是哪个版本，再用对应的规则。

## 放到 GLM 双机：再起一个同构实例，每张卡借多少

先说清前提，这一节是推演，不是实测：

- 我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。教程命令里没有开 RFork，走的是默认加载。[Worker 生命周期](npu-worker-lifecycle.md)中的约 305 GiB 是所列语言权重的张量遍历估算，不是每台机器的实测磁盘读取量，也不是完整文件或加载量的下界；页缓存、加载方式、量化版本和表外张量都要分别核对。
- GLM-5.3-Flash 的历史教学模型算例钉在固定镜像 `db701c1f`（显式例外 B），而 RFork 专题主基线为上游 `main`（`8d6180e2`）。下面是把上游 RFork 加载器与固定镜像的 GLM 模型账目放在一起推演的结果，不对应某个单一实跑提交；真要跑，先确认合并运行后的实际清单与日志。
- 官方早年测过的模型表里有 GLM5-W4A8，没有 GLM-5.3-Flash W8A8。

### 谁向谁借：16 个 Worker 各借各的，主模型和草稿模型各一套

假设再起一个同构实例 B，A 是已经在服务的那个。B 的第 r 号卡只能借 A 的第 r 号卡：seed key 里带着本卡在 TP 组里的编号（r 除以 8 的余数）和在 EP 组里的编号（EP 组正好是全部 16 张卡，组内编号就等于 r），换一张卡，这两个数就对不上。

MTP 草稿模型（投机解码里负责先猜后面几个 token 的那一层，见[投机解码](speculative-decoding.md)）继承主模型的加载方式，也走 RFork；但它的 seed key 多了「是草稿」这一项，是另一套身份。所以一次热启动一共向 Planner 借 32 次、拿 32 张租约：主模型 16 张，草稿模型 16 张。

### 每张卡读多少：读的字节和常驻的权重是两本账

先固定这笔演算的范围：按 3121f187 量化快照，部署页所列的主要语言权重子账约 21,078 MiB，也就是 20.58 GiB；这不是每卡全部常驻权重。视觉塔、MTP 旋转矩阵及其他表外项统一见[量化版本与视觉塔](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。下面沿用这个子账，只额外计入两项，演示为什么读取账和默认加载后的常驻账不同：

1. **草稿模型在传输那一刻还拿着自己的两份词表张量。** 草稿模型构造时会自建一份词嵌入和一份输出头，等加载结束后才换成主模型的同名张量，所以默认加载后的常驻子账里这两份记 0。可 RFork 的登记、核清单、读取全在加载过程里面做完，那时草稿手里还是自己新建的这两份，它们也在清单里，要读。每份是按 TP8 切过的词表：19,360 行 × 4,096 维 × 2 字节 = 151.25 MiB。
2. **路由专家的缩放系数。** W8A8 下每层路由专家还带缩放、偏移和一份 FP32 副本，每卡每层 864 KiB。常驻账因为太小没单列，清单里有。

下表给出 `3121f187` 量化快照下所列主要语言张量的读取子账（非完整清单）：

| 项目（`3121f187` 所列语言子账） | 组成算式 | 估算值 | 说明 |
|---|---|---|---|
| 主模型子账 | $20{,}537\text{ MiB} + 42 \times 864\text{ KiB}$ | $\approx 20{,}572\text{ MiB}$ | 42 层路由专家缩放、偏移与 FP32 副本 |
| 草稿模型子账 | $540.75\text{ MiB} + 864\text{ KiB} + 2 \times 151.25\text{ MiB}$ | $\approx 844\text{ MiB}$ | 含草稿加载时自持的两份 TP8 词表张量 |
| 每卡读取子账 | $20{,}572 + 844\text{ MiB}$ | $\approx 21{,}416\text{ MiB} \approx 20.91\text{ GiB}$ | 较默认常驻子账约 $20.58\text{ GiB}$ 多计约 $339\text{ MiB}$，不能视为完整常驻量与读取量之差 |
| 整个实例同范围子账 | $16 \times 21{,}416\text{ MiB}$ | $\approx 335\text{ GiB}$ | 16 卡各自独立读取 |

$$\text{主模型批数} \ge \lceil 20{,}572 \div 1{,}024 \rceil = 21\text{ 批}$$

所列张量中最大的是路由专家 gate/up 权重 $288\text{ MiB}$，不到 $1\text{ GiB}$；草稿子账 $844\text{ MiB}$ 只说明这部分不满一批，整份清单还要核表外项和 $512$ 段上限。

两本子账都没算视觉塔、MTP 的 32 MiB 旋转矩阵、W8A8 线性层的缩放与偏移等；这些可传张量也要进入读取清单，实际字节以完整清单和传完日志为准。旧 9e55cbc8 快照的 MLA 四组投影保持浮点，不能套用这里的 INT8 子账，版本差额只在上述部署页计算。要断言草稿只读一批，还必须确认完整清单总字节不超过 1 GiB、切段数不超过 512，不能只看 844 MiB。

### W8A8 为什么省不掉后处理

A 跑完后处理以后，显存里只剩处理后的那一份：int8 的专家权重已经转置、转成昇腾的 NZ 存储格式，FP32 的缩放系数副本是后处理时新建的，checkpoint 里根本没有。B 要按地址对拷，就得先造出名字、形状、类型、格式都一样的空位，所以量化模型一律先对空参数跑一遍后处理再传。B 省下的是默认路径里找文件、读盘、名字映射与切片、主机到卡拷贝这几步，搭模型和后处理的时间照付。

### 这套部署现在能不能受益

- **只有一个实例。** DP2 是这个实例内部的两组，不是两个实例。没有同身份来源的第一次冷启动要回退，还多做一次搭模型和后处理。扩副本或重启时已有同构 seed，才有机会省下读取时间；seed 的 TP8、DP2、EP 开关、W8A8、模型版本描述与 NZ 设定要匹配，同时由部署方确认确实是同一份权重内容。指纹不读取 checkpoint 的每个字节，不能靠它发现同路径文件被替换。EP16 本身不单独写进指纹，由 TP8、DP2 和「开了 EP」隐含（见[部署指纹里写了什么](rfork-identity.md#部署指纹里写了什么)）。
- **开了 EPLB、sleep mode 或在线权重传输就不走 RFork。** 在 `main` 主基线中，只要启用了 `enable_sleep_mode`、`weight_transfer_config` 或 `parallel_config.enable_eplb`（`safety.py:mutable_weights_bypass_reason`），加载器会直接改走默认加载并打印一条 warning；早期 Model Runner V1 的静态/动态 EPLB 附加字段（`dynamic_eplb`、`expert_map_record_path`、`expert_map_path`）已随 Model Runner V1 一并移除，不再触发绕过。
- **可能少掉约 38 个 KV 块（按源码推断，未实测）。** 内存登记会让被登记张量的存储一直活着。草稿那两份词表张量登记以后，即使加载结束时草稿换用了主模型的同名张量，这两段显存也释放不了。按源码推，B 作为 seed 期间每卡多占约 302.5 MiB；在其余预算条件不变时，折成块是 302.5 MiB ÷ 每块 8,355,840 B ≈ 38 块。若用假设权重 21 GiB 的教学预算 3,855 块作起点，示意变成约 3,817 块；3,855 不是该权重包的实际容量，真实起点需加载与 profile 日志确认，见[两种块数各在什么时候用](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。

## 常见误解

- **「fork 就是复制进程。」** 这里复用的只是远端的权重数据。新实例自己搭模型，读进自己的地址。
- **「同一个模型路径就能互传。」** 还要先通过兼容性指纹、结构摘要和分片身份的匹配，再由清单逐个张量核对元素个数、每个元素几字节、dtype 和 NPU 存储格式，张量条数和总字节数两端也要一致。
- **「RFork 报警就是启动失败。」** 要看后面有没有回退、最后结果如何。配置缺失或非法（`RForkConfigurationError`）会直接中止启动；只有回退清理不通过（旧资源没法安全清理）这类情况，加载器才拒绝再分配模型。
- **「每张卡读的字节就是常驻的权重。」** 两本账。GLM 算例的 20.91 GiB 读取子账和 20.58 GiB 默认常驻子账都没有包含全部权重；草稿的两份词表在传输时还是它自己的，加载后才换成主模型张量，RFork 登记还可能继续保活旧存储。
- **「归还租约收到 400，说明租约超时过期了。」** 400 本身证明不了过期。仓库自带的示例 Planner 里，400 只表示归还请求的头信息缺了或格式不对；过期的租约会在处理归还之前被清掉，这时回的是 404。而 B 把 404 也记成「已收回」，日志里会注明 404 只说明不存在、不说明按时归还。生产环境的 Planner 是否同样回码，仓库里没有它的代码，列在页末待核。

## 对照源码

### 怎么开

B 启动时加 `--load-format rfork`；配置写进 `--model-loader-extra-config` 的 JSON，或者用环境变量兜底。三项必填：模型地址 `model_url`（环境变量 `MODEL_URL`）、部署策略名 `model_deploy_strategy_name`（环境变量 `MODEL_DEPLOY_STRATEGY_NAME`）、Planner 地址 `rfork_scheduler_url`（环境变量 `RFORK_SCHEDULER_URL`），缺一项在建会话时抛 `RForkConfigurationError` 直接中止启动（不再静默回退）。默认 seed 每 30 秒心跳一次，租约归还先进行 3 次快速重试（每次隔 30 秒），暂态失败后转入至少 60 秒间隔的慢速重试；seed 端口按 `base + 2 × global_rank + model_slot`（主模型 0、草稿 1）算，基数为 0、超界或被占用（`EADDRINUSE`）时回退由系统随机分配。

外部还要两样：每个实例装好 YuanRong 数据系统（`yr.datasystem`，且提供 `get_rpc_port` 与 `batch_register_memory_ex`）；一个实现了借（`/get_seed`）、还（`/put_seed`）、登记（`/add_seed`），以及可选续期（`/renew_seed_lease`）与撤销（`/remove_seed`，由 `rfork_seed_removal_supported` 开关控制，默认关闭）路由的 Planner。仓库里带的是示例实现 `examples/rfork/rfork_planner.py`，默认租约 60 秒过期、seed 60 秒没心跳转 draining。

只要命中 `safety.py:mutable_weights_bypass_reason`（`enable_sleep_mode`、`weight_transfer_config` 或 `parallel_config.enable_eplb` 任一项），加载器就绕过 RFork。参数的完整清单与部署检查见[配置与部署](rfork-config.md)。

### 会报什么错

| 日志或报错原文 | 什么时候出现 | 说明什么 |
|---|---|---|
| `RFork weight transfer completed: weights=…, chunks=…, bytes=… GiB, …` | 一次列出的读取全部返回成功 | 四种成功的第一种；bytes、chunks 可用来核 GLM 一节的每卡字节和批数 |
| 加载器返回模型并 `eval()` | 加载路径走完 | 第二种成功 |
| `RFork lease release acknowledged: lease=… status=…` | Planner 对归还回了 200 或 404 | 第三种成功；status=404 时日志自带注明「不存在，不代表按时归还」 |
| `RFork seed service started for global_rank=…, port=…` | seed 服务起来 | 第四种成功 |
| `RFork planner lease release rejected: … status=…` | 归还收到 200、404 以外的码 | 408、429、5xx 记成可重试；其他码（包括 400）直接算被拒 |
| `RFork lease release stopped: … worker will not advertise a seed …` | 被拒，或重试次数用完 | B 照常推理，只是不当 seed |
| `RFork planner seed acquisition failed: …` | 借的时候 Planner 回了 200、404 以外的码，或请求出错 | 记成借不到，走回退 |
| `RFork %s seed acquisition was unsuccessful; loading locally.` | 借不到（只在汇总的那个 rank 打 info，其余 rank 是 debug） | 转默认加载；可能是正常冷启动，也可能是申请来源失败，要查前面的警告 |
| `RFork transfer failed: …, clean up and fall back to default loader` | RFork 尝试中建会话、搭模型、传输或后处理出错 | 先清理，满足安全门才回退；汇总不证明已经借到租约 |
| `RFork fallback aborted because seed service or registered memory cleanup failed; …` | 回退前清理失败 | 加载器拒绝再分配一份模型，启动失败 |
| `ImportError: RFork requires the YuanRong TransferEngine, MemoryRegistration, and ErrorCode APIs.` | 初始化时无法导入 yr.datasystem 中所需的三个 API；可能没安装，也可能版本不提供接口 | 核对安装包与实际 API，不能只检查包名是否存在 |

报错时要带上工作版提交、主模型还是草稿模型、全局/TP/PP/EP rank、两端配置和 Planner 响应。

### 开销和什么时候别开

- **接收方照付的：** 搭模型；要转布局时对空参数的后处理；内存登记；向 Planner 和 seed 的两次 HTTP 往返；分批同步读取。省下的只有找文件、读盘、名字映射与切片、主机到卡拷贝。
- **首次冷启动增加工作：** 集群里还没有同构 seed 时，先做的搭模型和（要转布局时的）后处理在回退后重来；总耗时差仍需同配置测量。
- **seed 一方的长期开销：** 要一直登记着自己的权重显存、开着 seed 服务、定时心跳；草稿的两份词表张量可能因此一直占着显存（见 GLM 一节）。
- **别开的情形：** 只有一个实例、也不打算扩副本；没有可用的 Planner 或没装 YuanRong；两边的切法、精度、量化或存储格式不同；要开 EPLB（开了也会自动绕过）；还在用社区 v0.23、v0.26（第一个补丁没合，量化和 MoE 模型可能传坏）。
- **怎么判断值不值：** 同一配置下对比两种加载的启动耗时。`RFork transfer stages: … registration=… metadata=… read=…` 给出登记、取元数据、读取各花多少；`RFork … model layout processing took … seconds` 给出后处理花多少。

### 版本差异

**本章主基线已原子重锚至社区上游 `vllm-ascend@8d6180e2`（`main`）。** 早期独立工作分支补丁（0001–0007 与衔接差异，历史脉络见[版本维护](rfork-maintenance.md)）已通过上游 PR `#12995`、`#15439`、`#15935` 陆续合入 `v0.30.0`（`c09d3e20`），并在 `main`（`8d6180e2`）上进一步通过 `#17366`、`#20111`、`#20876`、`#21333`、`#21707` 演进。**这一节集中维护全章四版本核验矩阵**，子页只展开本主题影响。

| 行为 | `v0.23.0` (`2c59ff10`) | `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|---|
| 目录结构 | 旧 6 文件（无独立 session/identity/manifest） | 旧 6 文件 | 13 文件（含 `session`/`identity`/`manifest`/`safety`） | 14 文件（新增 `local_weights.py` 支持 Engram 宿主表） |
| 什么时候问 Planner | 搭模型之前先问 | 同左 | 搭模型、准备布局、登记目的内存并绑定结构摘要后才借 | 同 `v0.30.0`，新增 MTP/DSpark 状态恢复与 Engram 加载协调 |
| 绕过条件 | `layer_sharding` 或 V1 EPLB | V1 EPLB（`enable_eplb` / `dynamic_eplb` / `expert_map_record_path`） | `safety.py`（sleep mode / 在线权重传输）+ V1 EPLB 字段 | `safety.py:mutable_weights_bypass_reason` 统一检查 sleep mode、在线权重传输与 `enable_eplb`（移除 V1 EPLB 字段） |
| `seed_key` | 明文拼接，含节点编号，不含精度/量化/并行大小 | 同左 | 协议+配置指纹 + 结构摘要 + TP/PP/EP/`sharded_dp_rank`（`size > 0`）+ `is_draft_model` | 同 `v0.30.0`，`sharded_dp_rank` 统一为 `size > 1`（`#20111`）；新增 BFS 去重稳定张量 ID 与 RoPE 派生缓存排除 |
| 清单与端口 | 旧三元组/无格式校验；仅动态 seed 端口 | 同左 | 严格五元组 + NPU format 逐项核对；`base+2×global_rank+slot`（`EADDRINUSE` 退动态）+ `get_rpc_port()` | 同 `v0.30.0`，协议版本 `rfork_protocol_version=1`，错误 key 返回 404；13 项配置、未知键警告与 `RForkConfigurationError` 中止 |
| 租约续期与归还 | 传完同步归还 1 次，无重试与延期 | 同左 | 要求 `LEASE_TTL_SEC` 并周期调用 `/renew_seed_lease`；3 次快试 + ≥60s 慢试 | `LEASE_TTL_SEC` 改为可选兼容旧 Planner；`/remove_seed` 由 `rfork_seed_removal_supported` 控制（默认关），示例 Planner 支持 draining（409） |

注：固定 GLM 镜像 `db701c1f` 的 RFork 目录与 `v0.23.0`（`2c59ff10`）逐字节相同；旧开发快照 `baa023ad`（Phase 1 归档）已合入 PR `#12995` 与 `#15439`，仍属六文件结构。

### 源码位置

下表路径相对社区上游 `vllm-ascend@8d6180e2` 的 `vllm_ascend/model_loader/rfork/`：

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| `rfork_loader.py#L747-L877` | 绕过检查、搭模型、MTP/DSpark 状态恢复、Engram 加载、后处理并同步、先登记后借、传输、发布 | 登记耗时移出租约有效期；未命中仍会付出建模型与布局准备 |
| `rfork_loader.py#L878-L957` | `RForkConfigurationError` 中止、可恢复异常清理与回退、清理失败拒绝回退 | 配置错直接报错中止；资源清理失败拒绝分配第二份模型 |
| `safety.py#L9-L21` | `mutable_weights_bypass_reason` | sleep mode、在线权重传输或 `enable_eplb` 绕过 RFork |
| `identity.py#L229-L349` | 兼容性指纹、`_resolve_sharded_dp_rank` 与 `build_seed_key` | 配置指纹 + 结构摘要 + 分片角色共同配对，不含全局 rank |
| `planner_client.py#L137-L287` | `/get_seed`、`/put_seed`、`/renew_seed_lease` 状态码分支与日志脱敏 | 404 不证明按时归还；`LEASE_TTL_SEC` 存在时启用续租 |
| `session.py#L115-L276`、`#L289-L445`、`#L490-L559` | `register_destination`、`acquire_seed`、`transfer_from_seed`、后台归还快慢重试与 `DEFERRED` 延期发布 | 登记在借租约之前；归还与模型返回、seed 发布解耦 |
| `types.py#L14-L81` | 八状态 `RForkLifecycleState`（含 `REGISTERED`）、`LeaseReleaseResult`、`SeedRemovalResult`、`RForkSeedServiceStartResult`、`RForkFallbackCleanupResult` | `can_schedule_seed` 只看 `service_stopped and memory_reset` |
| `manifest.py#L87-L214`、`seed_client.py#L58-L110` | `rfork_protocol_version`、严格五元组、NPU format 与条数/总字节核对 | 同路径不等于能互传；仍非逐字节内容校验 |
| `transfer_backend.py#L38-L45`、`#L128-L165`、`#L227-L273`、`#L783-L876` | `get_rpc_port()`、1 GiB / 512 段上限常量、切段装批、逐批同步读与完成日志 | 批数不能只从总字节算；TP0 打 INFO、其余打 DEBUG |
| `local_weights.py#L61-L97`、`tensor_layout.py#L34-L69` | Engram 宿主表加载/释放、`build_structural_digest` 与 3 项运行期张量排除名单 | 排除 `topk_indices_buffer` 与 RoPE 派生缓存 |
| `examples/rfork/rfork_planner.py#L207-L288`、`#L531-L567` | 示例 Planner 借/续/还/draining 撤销与 400/404/409 响应 | 示例里过期对应 404，400 来自头解析失败 |

**来源与结论对应：**

- 启动主流程、绕过安全门、配置报错中止与清理回退，对照第 1、5、7、22 项来源。[C1] [C5] [C22]
- 先登记再借租约、传输三段、可选续租、后台快慢归还重试与延期发布，对照第 2、4、14、17 项来源。[C2] [C4] [C14]
- 权重批量同步读、切段装批（1 GiB / 512 段）与 `get_rpc_port()`，对照第 3、9、21、25 项来源。[C3] [C9] 装批示意数是教学设定。[A]
- 八状态与结果类型定义（第 23 项）及元数据协议与严格清单/NPU format 校验（第 8、24、31 项）。[C8] [C23] [C24]
- 兼容性指纹、`sharded_dp_rank`、结构摘要与 Engram 宿主表，对照第 6、29、30 项来源。[C6] [C29] [C30]
- 示例 Planner 借/还/draining 与 400/404 行为，对照第 15、16 项来源。[C15] 「400 不能证明过期」是由此推得的判断，生产 Planner 未核。[I]
- 四版本差异（`v0.23.0` / `v0.26.0rc` / `v0.30.0` / `main`）及历史 PR `#12995`/`#15439`，对照第 10–13、18–20、27–28、32–34 项来源。[S10] [S11] [C18] [C27]
- GLM 所列语言张量的每卡读取子账 20.91 GiB、默认常驻子账 20.58 GiB、主模型至少 21 批、整实例同范围 335 GiB，按[部署页的固定量化版本与范围](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)及收集/装批规则推得，不是完整传输量。[D] 32 次借用来自 16 卡乘主、草稿两套身份。[D] 约 38 个 KV 块是其余预算不变时的保活增量推断，未实测。[I]

**待核：**

- 生产环境 Planner 的状态码约定、是否支持 `LEASE_TTL_SEC` 续期与 `/remove_seed` 撤销：缺生产 Planner 的实现或接口说明，仓库里只有示例 Planner。
- GLM 双机每卡实际读多少、几批、多快：缺一次同构双实例启动的 `RFork weight transfer completed` 日志。
- 草稿的两份词表张量是否一直钉在显存、是否真少约 38 个 KV 块：缺同一配置下 RFork 与默认加载的权重占用和 KV 块数日志对比。
- 固定镜像 GLM 模型与上游 `main` RFork 加载器合并运行结果：缺合并后的实跑验证。
- 现场有没有装满足 `get_rpc_port` 与 `batch_register_memory_ex` 契约的 YuanRong 与生产 Planner：缺部署现场信息。
