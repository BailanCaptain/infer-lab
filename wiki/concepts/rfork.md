---
id: rfork
title: RFork：工作版机制与排错总览
type: feature
summary: >-
  新实例启动时可按地址读取兼容来源显存中的权重；借不到或读取失败时，停止 seed 服务并安全清理登记内存后可退回默认加载。本页是 RFork
  工作版的入口：借的步骤、四种「成功」、GLM 双机推演和全章唯一的版本对照。
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
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L521-L644'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L732-L793'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L296-L347'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L645-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L196-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L81-L109'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/manifest.py#L198-L252'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L33-L35'
  - 'https://github.com/vllm-project/vllm-ascend/pull/12995'
  - 'https://github.com/vllm-project/vllm-ascend/pull/15439'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L258-L300
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L149-L246
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L155'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L192-L230'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L469-L484'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L150-L213'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L230-L295
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/model_loader/rfork/rfork_loader.py#L225-L290
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/rfork_loader.py#L340-L410
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L121-L152'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L373-L383'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L12-L49'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_client.py#L89-L96'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L217'
  - >-
    raw:sha256-9b6dec7112ddc012b981abdc59dde0be677825420760e49b3762f8533a304e33.md#L1-L1185
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/rfork_loader.py#L471-L524'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/rfork_loader.py#L630-L704'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/identity.py#L219-L339'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/tensor_layout.py#L42-L61'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/manifest.py#L64-L214'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/session.py#L100-L188'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/session.py#L261-L364'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/session.py#L495-L554'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/planner_client.py#L117-L245'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/transfer_backend.py#L224-L269'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/transfer_backend.py#L298-L459'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/transfer_backend.py#L31-L100'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/session.py#L40-L51'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/seed_server.py#L141-L167'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L529-L592'
verified:
  - 'rfork:main'
  - releases/v0.30.0rc2
evidence: C
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: RFork 在 Worker 加载模型时运行，推理请求开始前就要把权重准备好
contradicts: []
updated: '2026-10-25'
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
| 得先有 seed | 没有同身份来源时借不到。工作版在问 Planner 之前已搭空模型，必要时还做了布局后处理；回退会重做这些步骤，增加了启动工作，实际耗时差要测量 |
| 多两个依赖 | 外部的 Planner 服务，和提供卡间读取的 YuanRong 传输库 |

所以收益不是「读成功」就自动有的：它取决于原来的存储有多慢、卡间网络多快、后处理要多久、其他启动步骤占多少。要不要用，得在自己的集群上对比两种启动的耗时，测法见[配置与部署](rfork-config.md)。

还要分清它在什么时候起作用。RFork 只发生在启动时加载权重这一段，请求还没进来。之后请求照常走分词、调度、前向和采样，和默认加载出来的实例没有区别；它不负责给请求挑机器，也不会把 A 正在服务的对话挪到 B。所以要读多少字节，只由要传哪些权重、怎么切分决定，和以后的请求多长无关：清单不变时，请求是 37 个 token 还是 100 个 token，这次加载读的字节都一样。

## 借一次权重，B 的每个 Worker 走哪几步

以 B 上的一个 Worker 为例，顺序如下；每一步的细节在箭头后的子页里。

1. **建会话、算身份。** 先准备传输后端与会话，把模型、版本、精度、量化方式、TP / PP / DP 各组的大小、是否开 EP、存储格式等做成一个哈希，叫兼容性指纹（EP 组大小那一栏实际为空，由前面几项隐含，见[部署指纹里写了什么](rfork-identity.md#部署指纹里写了什么)）；再加上本卡在 TP、PP、EP 组里的编号，以及「是不是投机解码的草稿模型」，合成一把 seed key。此时还没向 Planner 借租约。→ [身份匹配](rfork-identity.md)
2. **搭空模型。** 在卡上把模型建好，放权重的地方先空着。要转布局的模型还要先对空参数跑后处理，并等卡上异步的格式转换全部做完，再把这些空位交出去。全部可传权重已与主模型共享的草稿可在这里提前返回；下面继续讲需要远端读取的路径。→ [启动路径](rfork-startup.md)、[张量布局](rfork-layout.md)
3. **向 Planner 借。** 拿 seed key 去问；借到就拿回 seed 的 IP、端口和一张租约，借不到就直接回退。
4. **登记本地内存。** 把空位所在的显存登记给传输引擎；读写的两端都要先登记过，seed 那边的权重在它当 seed 时就已登记好。→ [传输](rfork-transfer.md)
5. **要清单。** 向 seed 上的 HTTP 服务要它的传输端点，以及每个张量的名字、地址、形状、类型和字节数。
6. **核清单。** 两边的张量名字要对得上；逐个核形状、元素个数、每个元素几字节、类型；张量条数和总字节数两边也要相等。
7. **按批读。** 每个张量读「元素个数 × 每元素字节」，装成一批批同步读取，一批读完再读下一批。
8. **后台还租约，尝试发布，再交回模型。** 数据读完即安排后台归还；启动线程继续完成适用的后处理和 `eval()`，先尝试让 B 成为 seed，再返回模型。租约已经归还时可启动 seed 服务、登记并定时心跳；还没归还时则延期发布，模型仍可交回，后续由后台补办。→ [租约与生命周期](rfork-lifecycle.md)

前述 RFork 加载尝试借不到来源或抛错时，先尝试停止 seed 服务、注销登记内存并恢复模型状态。已有会话返回的清理结果只有满足 `service_stopped && memory_reset`，才允许继续分配默认加载的模型；停服务或内存清理不成功时保留存储持有者并报错，避免旧资源仍被使用时再分配第二份模型。租约尚未归还本身不挡回退，归还仍可由后台重试。默认加载能否成功、加载后能否发布为 seed，还要分别看后续结果。

第 7 步的装批规则是：先把超过 1 GiB 的张量切成不超过 1 GiB 的段；再按清单顺序往一批里装，下一段装进来会让这批超过 1 GiB，或者这批已经有 512 段，就封批另起一批。用四个示意张量演一遍：

```calc
title: 四个张量装成几批（示意数）
切段 = 1.5 GiB 拆成 1 + 0.5，另外三个 0.3、0.6、0.2 不拆 = 5 段
第 1 批 = 1，再装 0.5 就超过 1 GiB = 1 GiB
第 2 批 = 0.5 + 0.3，再装 0.6 就超过 = 0.8 GiB
第 3 批 = 0.6 + 0.2 = 0.8 GiB
总字节 = 1 + 0.8 + 0.8 = 2.6 GiB，共 3 批
> 同样四个张量按 1.5、0.6、0.3、0.2 的顺序，会装成 1 | 0.5 | 0.6 + 0.3 | 0.2，共 4 批
```

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

传输成功后，归还租约的 HTTP 请求由后台线程发送，启动线程不等待这次网络归还完成。归还还没被确认时，「B 成为新 seed」这件事先记成延期，模型照常交回；后台默认最多试 3 次、每次隔 30 秒，确认后再补上 seed 服务和登记。Planner 明确拒绝（比如回 400），或者 3 次都没成功，就放弃这次延期的登记：B 照常推理，只是不当 seed。seed 服务没起来，也不会把已经加载好的模型扔掉——模型照样交回，只是 B 暂时不当别人的来源。

## 同一个词分属不同层：软件栈、角色与编号

读 RFork 最容易混的是**同一个词分属不同层**：一个 seed 不是整个模型集群，一个地址不是一个张量的身份，一个 lease 不是内存锁。

先把软件栈分层：**NPU** 是实际存放和计算张量的加速卡；**PyTorch** 提供张量、参数、模块这些模型对象；**torch_npu** 把 PyTorch 接到昇腾设备上；**CANN** 是昇腾的计算软件栈。**YuanRong 数据系统**（Python 包名 yr.datasystem）提供 RFork 用的数据传输能力，不参与逐 token 推理。RFork 用到的传输引擎、内存登记、错误码三样都从这个包导入，导入不到就直接抛导入错误（ImportError），原文见[会报什么错](#会报什么错)——传输本身不是 RFork 自己实现的。所以排错时要分别报上各层的版本，RFork 的 Python 代码决定不了底层设备调用怎么表现。

**native** 指 Python 往下调用本地库或设备接口的那部分；**同步**指这次调用要等对应操作做完才返回，**异步**指把工作交给后台继续做。它们要带着对象理解：同一条加载流程里，权重读取是同步的，返回就说明这批字节已经到位；归还租约是异步的，只是把请求交给后台线程。两件事的「完成」不在同一个时刻。

角色会复用在同一个 Worker 里：先当接收方（receiver），模型就绪、租约还掉以后又可以当 seed；角色变了不等于另建一个模型。各种编号最后进到[匹配规则](rfork-identity.md)里，但不是每个编号都直接写进 seed key——比如全局 rank 不在 seed key 里，DP 组的大小却在兼容性指纹里。

和普通加载比，RFork 只改变权重数据从哪来，本地模型照样要建，另外多出三个条件：两边的模型分片兼容；传输期间地址一直有效；传完或失败后资源能正确回收。其中涉及的[张量与权重](matmul-and-weights.md)、[设备内存](device-memory.md)、[量化](quantization.md)和[并行组](collective-communication.md)沿用基础页的含义。

会话走过的七个阶段、租约归还的三种结果（已收回、可重试、被拒）、seed 服务启动的三种结果（已启动、延期、失败），以及回退前的清理结果，在[生命周期页](rfork-lifecycle.md)按真实调用展开；对应的类名列在本页[源码位置](#源码位置)。日志里看见「延期」（DEFERRED）时，先查延期的是哪件事，不要直接理解成「模型不可用」。

官方文档的图和量化说明里还会遇到 NIC、RDMA、RoCE、HBM，以及 BF16、W8A8、W4A8，它们的含义和在图里的位置见[官网核读页](../sources/rfork-official-guide.md)，别把网络协议、网卡和内存混成一层。官方文档提到的 **SFA** 是稀疏注意力的实现路径，RFork 不做它的注意力计算，只要保证它推理要用的张量也被收进清单；W_UV、W_UK_T 是这条实现派生出的权重名，分别用于 Value 的上投影和 Key 上投影的转置，不是某条请求的 V/K Cache，为什么不能漏传见[布局页](rfork-layout.md)。

## 排错先问三件事：哪个版本、哪个阶段、哪个 rank

**哪个版本。** 本章贯穿讲解的是用户 RFork 工作版；社区版本单独对照，升级社区代码不会自动更新工作版。排错先把三类实现分开：

- **工作版**由七个补丁加一份衔接差异组成，已经有统一管理借用与清理的会话、身份指纹和张量清单校验。正文里的十步启动和有限次数归还说的是这份实现。
- **旧社区快照**的 v0.23、v0.26 与固定 main 还没有上述会话结构；只有该 main 合入前三个补丁。其中“等布局转换做完再传”尤其影响量化和 MoE：前两个版本可能在转换完成前开始传输。
- **社区 v0.30.0rc2** 已有会话、身份与清单模块，并进一步改变了匹配 key、登记顺序、主草端口和租约协议。它要求 Planner 提供租约有效期并处理续期；不能拿旧社区“没有这层代码”或工作版“没有续期”来排查 rc2。

逐个补丁、逐项行为的对照见本页的[版本差异](#版本差异)，各子页的版本说明以那里为准。

**哪个阶段。** 同一句「传输失败」可能出在内存登记、取元数据、核清单，也可能真是读数据时失败。只截最后一行，信息通常不够。要留下第一次 RFork 报错之前的上下文，至少带上：工作版的提交、是主模型还是投机解码的草稿模型、各类 rank、两端的配置，以及 Planner 的相关响应。

**哪个 rank。** 借是按卡配对的：B 的每个 Worker 各自算 seed key、各自借、各自读、各自回退。看日志先确认是哪一张卡、是主模型还是草稿模型的那一套。

排错先读[排错页](rfork-troubleshooting.md)，再顺着里面给的源码位置去核。这一章标着「对源码核过」的结论，意思是对着工作版源码逐行读过，**不代表在真实 NPU 集群上复现过**；涉及网络、数据系统接口或生产环境 Planner 的行为，要用现场证据补齐。

## 这一章其余各页回答什么

| 阅读顺序 | 这一篇回答什么 |
|---|---|
| 1. 术语 | seed、rank、layout、storage、MR、manifest、lease 分别指什么：逐词的词表在知识库术语表第五节「RFork 工作版」，分层说明见本页[上面一节](#同一个词分属不同层软件栈角色与编号) |
| 2. [启动路径](rfork-startup.md) | 从选中加载器到模型返回，先做什么，什么时候申请租约 |
| 3. [身份匹配](rfork-identity.md) | 为什么有实例却找不到 seed，怎样避免拿错分片 |
| 4. [张量布局](rfork-layout.md) | 量化和 NZ 为什么改变传输时机，为什么排除 top-k 索引缓冲区 |
| 5. [传输](rfork-transfer.md) | 清单怎样验收，一次读取怎样形成，什么叫传完；地址背后的对象谁保活，主模型和草稿模型怎样避免重复登记 |
| 6. [租约与生命周期](rfork-lifecycle.md) | 为什么传完了还不能成为 seed，什么时候允许回退或销毁 |
| 7. [配置与部署](rfork-config.md) | 参数放哪、默认值、地址与端口、限制、怎样测启动收益 |
| 8. [报错排查](rfork-troubleshooting.md) | 按原始日志找阶段，区分证据、候选原因与下一步 |
| 9. [版本维护](rfork-maintenance.md) | 本地代码在哪，补丁来了怎样更新，怎样留下可核对的历史 |

每篇只回答一个问题。专业词先在术语表找入口，到机制页再结合具体的地址、状态和调用展开。

另有一页[官网全文与原图核读](../sources/rfork-official-guide.md)：按英文 latest 指南逐节对照，解释官方架构图、列出官方测试范围，并标出它和工作版在申请时机、key、端口和依赖上的差异。排错时先确认是哪个版本，再用对应的规则。

## 放到 GLM 双机：再起一个同构实例，每张卡借多少

先说清前提，这一节是推演，不是实测：

- 我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。教程命令里没有开 RFork，走的是默认加载。[Worker 生命周期](npu-worker-lifecycle.md)中的约 305 GiB 是所列语言权重的张量遍历估算，不是每台机器的实测磁盘读取量，也不是完整文件或加载量的下界；页缓存、加载方式、量化版本和表外张量都要分别核对。
- 工作版的代码树里没有 GLM-5.3-Flash 的模型实现，GLM 的模型代码只在固定镜像 db701c1f 里。下面是把「工作版的 RFork 加载器」和「固定镜像的 GLM 模型」放在一起推出来的，不对应任何一个能直接运行的提交；真要跑，先确认两边合并后的代码。
- 官方测过的模型表里有 GLM5-W4A8，没有 GLM-5.3-Flash W8A8。

### 谁向谁借：16 个 Worker 各借各的，主模型和草稿模型各一套

假设再起一个同构实例 B，A 是已经在服务的那个。B 的第 r 号卡只能借 A 的第 r 号卡：seed key 里带着本卡在 TP 组里的编号（r 除以 8 的余数）和在 EP 组里的编号（EP 组正好是全部 16 张卡，组内编号就等于 r），换一张卡，这两个数就对不上。

MTP 草稿模型（投机解码里负责先猜后面几个 token 的那一层，见[投机解码](speculative-decoding.md)）继承主模型的加载方式，也走 RFork；但它的 seed key 多了「是草稿」这一项，是另一套身份。所以一次热启动一共向 Planner 借 32 次、拿 32 张租约：主模型 16 张，草稿模型 16 张。

### 每张卡读多少：读的字节和常驻的权重是两本账

先固定这笔演算的范围：按 3121f187 量化快照，部署页所列的主要语言权重子账约 21,078 MiB，也就是 20.58 GiB；这不是每卡全部常驻权重。视觉塔、MTP 旋转矩阵及其他表外项统一见[量化版本与视觉塔](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。下面沿用这个子账，只额外计入两项，演示为什么读取账和默认加载后的常驻账不同：

1. **草稿模型在传输那一刻还拿着自己的两份词表张量。** 草稿模型构造时会自建一份词嵌入和一份输出头，等加载结束后才换成主模型的同名张量，所以默认加载后的常驻子账里这两份记 0。可 RFork 的登记、核清单、读取全在加载过程里面做完，那时草稿手里还是自己新建的这两份，它们也在清单里，要读。每份是按 TP8 切过的词表：19,360 行 × 4,096 维 × 2 字节 = 151.25 MiB。
2. **路由专家的缩放系数。** W8A8 下每层路由专家还带缩放、偏移和一份 FP32 副本，每卡每层 864 KiB。常驻账因为太小没单列，清单里有。

```calc
title: GLM 所列语言张量的读取子账（3121f187，非完整清单）
主模型子账 = 20,537 MiB 主干 + 42 层 × 864 KiB ≈ 20,572 MiB
草稿模型子账 = 540.75 MiB MTP 所列模块 + 864 KiB + 2 × 151.25 MiB ≈ 844 MiB
每卡读取子账 = 20,572 + 844 ≈ 21,416 MiB ≈ 20.91 GiB
> 对比的默认常驻子账约 20.58 GiB；多计约 339 MiB 来自草稿两份词表张量和路由专家辅助量，不能视为完整常驻量与读取量之差
整个实例的同范围子账 = 16 × 21,416 MiB ≈ 335 GiB
主模型批数 ≥ ⌈20,572 ÷ 1,024⌉ = 21 批
> 所列张量中最大的是路由专家 gate/up 权重 288 MiB，不到 1 GiB；草稿子账 844 MiB 只说明这部分不满一批，整份清单还要核表外项和 512 段上限
```

两本子账都没算视觉塔、MTP 的 32 MiB 旋转矩阵、W8A8 线性层的缩放与偏移等；这些可传张量也要进入读取清单，实际字节以完整清单和传完日志为准。旧 9e55cbc8 快照的 MLA 四组投影保持浮点，不能套用这里的 INT8 子账，版本差额只在上述部署页计算。要断言草稿只读一批，还必须确认完整清单总字节不超过 1 GiB、切段数不超过 512，不能只看 844 MiB。

### W8A8 为什么省不掉后处理

A 跑完后处理以后，显存里只剩处理后的那一份：int8 的专家权重已经转置、转成昇腾的 NZ 存储格式，FP32 的缩放系数副本是后处理时新建的，checkpoint 里根本没有。B 要按地址对拷，就得先造出名字、形状、类型、格式都一样的空位，所以量化模型一律先对空参数跑一遍后处理再传。B 省下的是默认路径里找文件、读盘、名字映射与切片、主机到卡拷贝这几步，搭模型和后处理的时间照付。

### 这套部署现在能不能受益

- **只有一个实例。** DP2 是这个实例内部的两组，不是两个实例。没有同身份来源的第一次冷启动要回退，还多做一次搭模型和后处理。扩副本或重启时已有同构 seed，才有机会省下读取时间；seed 的 TP8、DP2、EP 开关、W8A8、模型版本描述与 NZ 设定要匹配，同时由部署方确认确实是同一份权重内容。指纹不读取 checkpoint 的每个字节，不能靠它发现同路径文件被替换。EP16 本身不单独写进指纹，由 TP8、DP2 和「开了 EP」隐含（见[部署指纹里写了什么](rfork-identity.md#部署指纹里写了什么)）。
- **开了 EPLB 就不走 RFork。** 以后命令里如果打开 [EPLB](eplb.md)（专家负载均衡），或者配了它的动态模式、专家分布记录路径，加载器会直接改走默认加载，日志里只有一条 warning。

这里还要区分配置类型和字段值：先判断并行配置中的 EPLB 开关是否为真；否则，只有额外的 EPLB 配置是字典，才继续判断动态模式或专家分布记录路径是否为真。因此，仅出现配置字段名并不足以触发绕过，还要满足对应的类型和值条件。

- **可能少掉约 38 个 KV 块（按源码推断，未实测）。** 内存登记会让被登记张量的存储一直活着。草稿那两份词表张量登记以后，即使加载结束时草稿换用了主模型的同名张量，这两段显存也释放不了。按源码推，B 作为 seed 期间每卡多占约 302.5 MiB；在其余预算条件不变时，折成块是 302.5 MiB ÷ 每块 8,355,840 B ≈ 38 块。若用假设权重 21 GiB 的教学预算 3,855 块作起点，示意变成约 3,817 块；3,855 不是该权重包的实际容量，真实起点需加载与 profile 日志确认，见[两种块数各在什么时候用](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。

## 常见误解

- **「fork 就是复制进程。」** 这里复用的只是远端的权重数据。新实例自己搭模型，读进自己的地址。
- **「同一个模型路径就能互传。」** 还要先通过兼容性指纹和分片身份的匹配，再由清单逐个张量核对元素个数、每个元素几字节和类型，张量条数和总字节数两端也要一致。
- **「RFork 报警就是启动失败。」** 要看后面有没有回退、最后结果如何。只有旧资源没法安全清理这类情况，加载器才会拒绝再分配模型。
- **「每张卡读的字节就是常驻的权重。」** 两本账。GLM 算例的 20.91 GiB 读取子账和 20.58 GiB 默认常驻子账都没有包含全部权重；草稿的两份词表在传输时还是它自己的，加载后才换成主模型张量，RFork 登记还可能继续保活旧存储。
- **「归还租约收到 400，说明租约超时过期了。」** 400 本身证明不了过期。仓库自带的示例 Planner 里，400 只表示归还请求的头信息缺了或格式不对；过期的租约会在处理归还之前被清掉，这时回的是 404。而 B 把 404 也记成「已收回」，日志里会注明 404 只说明不存在、不说明按时归还。生产环境的 Planner 是否同样回码，仓库里没有它的代码，列在页末待核。

## 对照源码

### 怎么开

B 启动时加 `--load-format rfork`；配置写进 `--model-loader-extra-config` 的 JSON，或者用环境变量兜底。三项必填：模型地址 `model_url`（环境变量 `MODEL_URL`）、部署策略名 `model_deploy_strategy_name`（环境变量 `MODEL_DEPLOY_STRATEGY_NAME`）、Planner 地址 `rfork_scheduler_url`（环境变量 `RFORK_SCHEDULER_URL`），缺一项建会话时就报错。默认 seed 每 30 秒心跳一次，租约归还最多试 3 次、每次隔 30 秒；seed 端口按「端口基数 + 全局 rank」算，基数为 0 时由系统随机分配。

外部还要两样：每个实例装好 YuanRong 数据系统（`yr.datasystem`）；一个实现了借（`/get_seed`）、还（`/put_seed`）、登记（`/add_seed`）、注销（`/remove_seed`）四条路由的 Planner。仓库里带的是示例实现 `examples/rfork/rfork_planner.py`，默认租约 60 秒过期、seed 60 秒没心跳就摘掉。

只要开了 EPLB（`enable_eplb`，或额外配置里的 `dynamic_eplb`、`expert_map_record_path` 任一项），加载器就绕过 RFork。参数的完整清单与部署检查见[配置与部署](rfork-config.md)。

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
| `RFork has no available … seed; loading locally and registering this worker as a seed.` | 借不到（只在汇总的那个 rank 打 info，其余 rank 是 debug） | 转默认加载；可能是正常冷启动，也可能是申请来源失败，要查前面的警告 |
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

**贯穿案例是 RFork 工作版 rfork@3284850b；社区 rc2 固定为 vllm-ascend@7d825229。** 钉点与更新方法见[版本维护](rfork-maintenance.md)。原 patch1–6 与 patch7 曾分叉，不能把原七个补丁直接拼接当作工作版。**这一节集中维护全章版本对照**，子页只展开本主题影响。

RFork 最早由社区 PR #7392 引入。先看三个旧快照：v0.23 为 2c59ff10、v0.26 为 2ed6cbba、main 为 baa023ad。下表只比较这三个快照与工作版补丁；rc2 的最终行为另列在后表，不能由旧表的“未合入”推断。

| 补丁 | 它改了什么 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 对用社区版的人意味着什么 |
|---|---|---|---|---|---|
| 0001 | 等异步布局转换做完，再登记和传「处理后布局」的缓冲区；回退时只摘掉自己那份进程级注册 | 未合入 | 未合入 | 已合入（PR #12995） | 三个已合入补丁里最该在意的一个。量化模型和 MoE 模型在 v0.23、v0.26 上可能传到还没转完的布局，输出是坏的，回退也可能连带失败 |
| 0002 | 登记期间一直持有张量 owner，收完一轮不再清掉缓存的引用 | 未合入 | 未合入 | 已合入（PR #15439） | v0.23、v0.26 上「地址还登记着、张量已经被回收」是可能发生的。它表现为传输阶段的地址类报错，查配置查不出来 |
| 0003 | 草稿模型登记时减掉与主模型重叠的地址区间，seed 清单和接收端跟着对齐 | 未合入 | 未合入 | 已合入（PR #15439） | 只影响开了投机解码的部署：v0.23、v0.26 上草稿模型会撞上 HCCL 拒绝重叠登记。不开投机解码的不受影响 |
| 0004 | 把租约、登记的存储、seed 服务、回退与关停收进一个会话对象，补上兼容性指纹与清单校验，另拆出八个模块 | 未合入 | 未合入 | 未合入 | 本章的主干在社区版里没有对应代码。[身份匹配](rfork-identity.md)、[传输](rfork-transfer.md)、[租约与生命周期](rfork-lifecycle.md) 这几页只能当背景读，不能照着在社区版上排错 |
| 0005 | 懒解析硬件 profile，改用 v0.26 里未量化 MoE 方法类的新位置 | 未合入 | 未合入 | 未合入 | 它新建的 compat.py 依附于 0004 的结构，社区版没有这个文件，也用不上 |
| 0006 | 关停防重入、seed 广播串行化、收窄异常捕获、张量别名去重、Planner 回 404 当幂等 | 未合入 | 未合入 | 未合入 | 它改的 session.py、planner_client.py、tensor_layout.py 社区版一个都没有 |
| 0007 | seed 端口可按 rank 偏移；top-k 索引缓冲区这类运行期临时张量不跨实例传 | 未合入 | 未合入 | 未合入 | 三个旧快照的 seed 服务都只用动态端口，也没有这份按名字排除的名单。v0.23/v0.26 会扫描模块普通张量属性；main 的 processed 路径仍扫描这些属性，checkpoint 路径则只在参数和缓冲区之外补收 impl 内张量。临时工作区是否进入清单要看具体模型、挂载位置与路径，不能只按版本名判断 |
| 衔接差异 | patch6 与 patch7 基线之间的实现差异：租约设计文档、回退清理、隔离测试 | 未合入 | 未合入 | 未合入 | 它同样建在 0004 的模块结构上，社区版没有落脚点；这份差异是怎么来的见[版本维护](rfork-maintenance.md) |

旧快照的补丁对应：0001 对应社区提交 bc5a79ede，0002 与 0003 对应 a59dea592；二者均在 baa023ad 的历史中，未进入 2c59ff10、2ed6cbba 的对应实现。后三者的源码还没有 session、identity、manifest 等独立模块，0003 的区间排除可在 baa023ad 的传输后端找到。

这三个旧社区快照的 RFork 目录只有六个文件：`__init__`、rfork_loader、rfork_worker、seed_protocol、seed_server、transfer_backend；工作版是十三个。工作版将旧 worker/protocol 的职责拆到 session、planner_client、seed_client，再补 identity、manifest、config、tensor_layout、types 和 compat。因此旧快照的元数据与 Planner 调用集中在 seed_protocol；rc2 已改用独立模块，不能再按这个六文件结构寻找它的调用链。

下表按行为对照。固定镜像 db701c1f 的 RFork 目录和 v0.23 维护分支 2c59ff10 逐字节相同（两者 diff 为空），所以 v0.23 一列也代表固定镜像；v0.26 相对 v0.23 只改了加载器里的绕过条件。

| 行为 | v0.23（= 固定镜像） | v0.26 | main | 工作版 |
|---|---|---|---|---|
| 什么时候问 Planner | 搭模型之前先问有没有 seed | 同左 | 同左 | 搭完模型、做完后处理之后才借 |
| 后处理后等异步转换做完 | 不等 | 不等 | 等（0001） | 等 |
| 绕过 RFork 的条件 | layer_sharding 或 EPLB | 只有 EPLB | 只有 EPLB | 只有 EPLB |
| seed key | 明文拼接，含节点编号，不含精度、量化、并行大小 | 同左 | 同左 | 兼容性指纹加 TP/PP/EP 编号和是否草稿，做 SHA256；不含节点编号 |
| 收集张量 | 一种收法，按地址去重 | 同左 | 已分 processed / checkpoint 两种收法，仍按地址去重；普通属性扫描范围不同 | 两种收法；按名字去重，冲突就报错；排除 top-k 索引缓冲区 |
| 清单校验 | 逐张量核元素个数和每元素字节；已有单独 shape 信息，有有效 shape 时尝试 view | 同左 | 同左 | 另核 dtype、完整名称集合、张量条数和总字节；不能只靠相同元素大小通过 |
| 装批 | 1 GiB / 512 条，单个张量不切段 | 同左 | 同左 | 先把张量切成不超过 1 GiB 的段再装批 |
| 内存登记 | 只交地址和长度 | 同左 | 登记期间持有张量引用（0002） | 登记时保活存储对象，每批最多 4,096 项 |
| 草稿与主模型重叠的地址 | 不排除 | 不排除 | 排除（0003） | 排除；全部重叠时直接复用、不传 |
| 不转布局时的顺序（社区版只按是否量化判断） | 先起 seed 服务，再做后处理 | 同左 | 同左 | 先做后处理、进推理模式，再发布 seed |
| 回退清理 | 停传输、重置状态，然后删模型 | 同左 | 同左，登记没清掉时在回退重新登记前再试 | 最多清理 2 次，重置进程级模型状态；清理失败就拒绝回退 |

**rc2 的关键变化。** 下表比较 7d825229 与工作版 3284850b。结构摘要是对张量名字、shape、dtype、NPU format 的描述做哈希；它能区分布局，不能证明权重每个字节相同。

| 主题 | 工作版 | 社区 v0.30.0rc2 | 使用者要改变什么 |
|---|---|---|---|
| 入口与模块 | RForkConfig、Session、identity、manifest 等十三文件 | 同样已有独立会话与校验模块；仍由 load-format=rfork 进入 | 按实际提交找源码，不按旧六文件目录排错 |
| seed key | 配置指纹加 TP/PP/EP、主草角色 | 增加协议、RoPE/KV 角色/mix placement 等配置，以及结构摘要；必要时加入 DP 分片编号 | 同模型名不够；两端须使用同一身份规则，详见[身份页](rfork-identity.md#版本差异) |
| 申请前准备 | 布局准备后先借，再登记目的内存 | 布局准备、目的内存登记、绑定结构摘要之后才借 | 登记耗时也移到租约外；启动图的工作版顺序不能原样套用 |
| 清单 | 兼容旧 tuple/mapping 与单独 shape 查询 | 要求完整五元组、按名称覆盖的 NPU format 清单，并逐项比较格式 | 旧 metadata 响应未必可直接接入；仍不是内容校验和 |
| seed HTTP 端口 | base+global_rank，主草同 rank 会撞号 | base+2×global_rank+草稿槽（主模型0、草稿1）；计算结果越界或固定端口被占用（EADDRINUSE）时可回动态端口，其他绑定错误继续失败 | 防火墙与监控按主草分槽；实际端口仍看日志 |
| TransferEngine 端口 | 先找空闲端口再交给引擎 | 给引擎 port=0，由引擎绑定并用 get_rpc_port 取实际端口 | 数据端点与 seed HTTP 分开检查；依赖须提供新 API |
| 租约有效期与续期 | 不要求 TTL 响应头，没有续期 | get_seed 必须返回有限正数 LEASE_TTL_SEC；启动周期续期 | Planner 需支持续期接口；只有旧借还接口会导致不兼容 |
| 后台归还 | 默认三次，次数用完停止 | 默认三次快速尝试后，暂态失败按至少60秒间隔继续；REJECTED 仍停止 | “重试上限”不再等于总次数；未确认归还时仍延期发布 |

rc2 的续期间隔为 TTL/3，再限定到 0.1–30 秒；续期失败会报警，但不能据此认定正在读的 native 操作已经停止。租约到期、后台归还和数据读取是不同的事件，详见[生命周期](rfork-lifecycle.md#版本差异)。这些新行为不改变工作版的钉点和 GLM 推演前提。

### 源码位置

下表路径相对工作版的 vllm_ascend/model_loader/rfork/，行号按 rfork@3284850b。

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| rfork_loader.py，563–644 行 | 搭模型、要转布局的模型先做后处理并同步、借 seed、传输、发布 seed | 先搭后借，借不到前已经花了搭模型的时间 |
| rfork_loader.py，645–710 行 | 借不到或出错后的清理与回退，清理失败拒绝回退 | 报警不等于启动失败 |
| rfork_loader.py，373–383 行 | EPLB 绕过条件 | 开 EPLB 就不走 RFork |
| identity.py，196–287 行 | 兼容性指纹与 seed key | 按卡配对，不含全局 rank |
| planner_client.py，69–155 行 | 借：404 当作没有 seed，其他错误也当借不到；还：200、404 当已收回，408、429、5xx 可重试，其余被拒 | 404 不说明按时归还 |
| session.py，103–213 行；seed_client.py，89–96 行 | `transfer_from_seed` 分登记、取元数据、读取三段，取元数据调的是 seed_client 里的 `fetch_seed_transfer_info`；后台归还与重试；被拒或用尽就不发布 seed | 归还与传输的「完成」不在同一时刻 |
| session.py，296–347 行 | seed 服务启动，归还未确认时延期 | 延期不等于模型不可用 |
| types.py，12–49 行 | 会话状态 `RForkLifecycleState`（INITIALIZED、LEASED、TRANSFERRED、READY、CLEANUP_REQUIRED、SERVING、FINALIZED）；租约归还结果 `LeaseReleaseResult`（RELEASED、RETRYABLE、REJECTED）；seed 服务启动结果 `RForkSeedServiceStartResult`（STARTED、DEFERRED、FAILED，只有 STARTED 当作真）；回退清理结果 `RForkFallbackCleanupResult`（服务停没停、租约还没还、内存清没清三项，`can_schedule_seed` 只看服务和内存） | 日志里的 DEFERRED 是 seed 服务延期启动；租约没还完不挡回退，服务或内存没清掉才拒绝回退 |
| manifest.py，198–252 行 | 逐张量核对与条数、总字节核对 | 同路径不等于能互传 |
| transfer_backend.py，33–35、121–152、732–793 行 | 批上限常量、切段装批、逐批同步读与完成日志 | 批数不能只从总字节算 |
| 示例 Planner：examples/rfork/rfork_planner.py，192–230、469–484 行 | 借时发租约；归还前先清过期租约，找不到回 404；头信息错回 400 | 示例里过期对应 404，不是 400 |

**来源与结论对应：**

- 八步顺序、先搭后借、要转布局的模型先后处理并同步、清理失败拒绝回退，对照第 1、5 项来源。[C1] [C5]
- 传输分登记、元数据、读取三段，租约在后台归还；归还未确认时 seed 发布延期；seed 服务启动失败只返回 false、模型照样交回，对照第 2、4、7 项来源。[C2] [C4] [C7]
- 权重由接收方按地址批量同步读，HTTP 不承载权重主体，对照第 3 项来源。[C3]
- 会话状态与三种结果的类名、枚举值和 can_schedule_seed 的判定，对照第 23 项来源。[C23] 取元数据函数在 seed_client 里，对照第 24 项来源。[C24] 缺 YuanRong 时抛 ImportError，对照第 25 项来源。[C25]
- 指纹与 seed key 的组成，对照第 6 项来源。[C6] 清单校验的各项，对照第 8 项来源。[C8]
- 切段装批规则与 1 GiB、512 段上限，对照第 9、21 项来源。[C21] 装批示意数是教学设定。[A]
- 借与还的状态码分支，对照第 14 项来源；被拒或重试用完就不发布 seed，对照第 17 项来源。[C14] [C17]
- 示例 Planner 里 400 只来自头信息错误、过期租约先被清掉再回 404，对照第 15、16 项来源。[C15] [C16] 「400 不能证明过期」是由这两处代码得出的判断，生产 Planner 未核。[I]
- EPLB 绕过条件，对照第 22 项来源。[C22]
- 补丁表三列：0001–0003 对应社区 PR，对照第 10、11 项来源；0003 在 main 的区间排除、main 按地址去重收集张量，对照第 12、13 项来源。[S10] [S11] [C12] [C13]
- 行为对照表的社区三列，对照第 18、19、20 项来源。[C18] [C19] [C20]
- GLM 所列语言张量的每卡读取子账 20.91 GiB、默认常驻子账 20.58 GiB、主模型至少 21 批、整实例同范围 335 GiB，按[部署页的固定量化版本与范围](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)及工作版收集/装批规则推得，不是完整传输量。[D] 32 次借用来自 16 卡乘主、草稿两套身份。[D] 约 38 个 KV 块是其余预算不变时的保活增量推断，未实测。[I]

**待核：**

- 生产环境 Planner 的状态码约定，尤其过期租约回什么、400 代表什么：缺生产 Planner 的实现或接口说明，仓库里只有示例 Planner。
- GLM 双机每卡实际读多少、几批、多快：缺一次同构双实例启动的「weight transfer completed」日志。
- 草稿的两份词表张量是否一直钉在显存、是否真少约 38 个 KV 块：缺同一配置下 RFork 与默认加载的权重占用和 KV 块数日志对比。
- 工作版加载器和固定镜像的 GLM 模型合并后能否直接跑：缺合并后的提交。
- 处理后布局收集的完整张量清单里，有没有该排除却没排除的运行期临时张量（已知只排除 top-k 索引缓冲区）：缺一份实际清单。
- 现场有没有装 YuanRong、有没有生产用的 Planner、会不会起第二个同构实例：缺部署现场信息。

工作版的 EPLB 绕过检查先看 enable_eplb；否则仅在 eplb_config 是字典时检查 dynamic_eplb 或 expert_map_record_path 的真值（来源 22）。rc2 对照来源依次为追加的 loader、identity、tensor_layout、manifest、session、planner_client 与 transfer_backend：入口及身份在 loader 471–524，登记先后在 630–704，协议与续期在 planner_client 117–245，释放重试在 session 261–364。以上是实现条件；设备结果仍按上方待核项验收。
