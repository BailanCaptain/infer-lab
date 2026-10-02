---
id: rfork-config
title: RFork 配置：四类端口、各项超时与可复制的启动示例
type: feature
summary: >-
  想让第二个实例从已有实例借权重，启动命令里要多写什么。这页讲工作版 RFork 的十一项客户端设置和四类端口：多数写错为什么不报错、只会退回正常加载；固定端口只固定了哪一个、主模型和草稿模型为什么会撞；单次超时、还租约重试和租约有效期各管什么；GLM 双机每台开多少端口、默认租约够不够，以及怎样验收。
aliases:
  - RFork 配置
  - rfork_scheduler_url
  - rfork_seed_port_base
  - rfork_seed_advertise_host
  - rfork_request_timeout_sec
  - rfork_heartbeat_interval_sec
  - rfork_lease_release_max_attempts
  - rfork_seed_timeout_sec
chapters: []
order: 90
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L11-L139'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L35-L49'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L349-L413'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L233'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L289-L295'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L373-L382'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L539-L561'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L39-L75'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L213-L267'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L395-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_server.py#L127-L377'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L419'
  - 'rfork@3284850b:docs/source/user_guide/feature_guide/rfork.md#L160-L165'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L542-L582'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-identity
    kind: builds-on
    note: model_url 与部署策略是匹配标识，必须先理解它们不等于 served-model-name
  - to: rfork-lifecycle
    kind: builds-on
    note: lease 重试、心跳与 seed 启动超时分别作用于不同生命周期
contradicts: []
updated: '2026-10-02'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-1ae36dd2945d6704b17e8d8c2d24f1e68a61a92f72ed3f18b9ba0c7dfcc97db3.md
  - >-
    raw/sha256-22f6d04426e0defa217c4f60bcb3fba3c71e2a966e4f415864440ec682d871d3.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-7c1cf46ed24557ae509144bda485106fc93a596c0e8a111ed26f83c3491c0981.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 第二个实例要从第一个实例借权重，启动命令里多写什么

[RFork](rfork.md) 让新起的实例 B 按地址读取已在服务的实例 A 显存里的权重（被借的一方叫 seed），读不成再退回从存储加载。它是什么、为什么能省时间，总览页已经讲过。这一页只回答落地时的问题：B 的启动命令里要多写什么，每一项管什么，写错了会怎样。

要多写两样东西：

- **一个开关**：告诉 vLLM「这次用 RFork 这种方式加载权重」。
- **一包设置**：写成一段 JSON，交给「模型加载器的额外设置」这个入口。里面全是 B 自己的事：我是哪个模型、去哪里找 Planner、我当 seed 时对外报什么地址和端口、多久报一次平安、还租约失败了重试几次。

最容易写错的是入口：这包设置**不是**塞进昇腾插件平时用的那个「附加设置」入口。放错了地方，RFork 读不到这些设置，结果和一项都没填一样（后果见下一节）。

为什么要配这么多项？因为借一次权重要连好几个地方。下图是一台 A、一台 B 时，RFork 牵涉的四类端口：

```wiki-diagram
file: rfork-config-ports.yaml
```

1. **API 端口**：业务方发推理请求的地方；B 在权重加载完之前还不对外服务。
2. **Planner 端口**：Planner 是推理实例之外的一个独立小服务，撮合「谁向谁借」，每借一次发一张租约（一次借用许可，到点收回）。A、B 各自 Worker 里的 RFork 会话去连它：A 登记、定时心跳，B 借、用完去还。
3. **seed 元数据端口**：A 上的一个 HTTP 小服务，B 先到这里取一份清单：A 的传输端点在哪，每个张量在什么地址、什么形状。
4. **传输引擎端点**：真正搬权重字节的通道，两端各有一个。

本页讲的是用户在用的 RFork 工作版。各项行为都对照它的源码逐行核过，但还没有在真实 NPU 上跑通过一次完整加载；示例里的地址、端口和模型路径都要换成现场的。

## 为什么要专门讲配置：多数写错不会报错

一般的程序，配置写错了会启动失败，你马上就知道。RFork 不一样：它的设计是「借不到就退回正常加载」，这层保护把大部分配置错误也一起吞掉了。B 照样起来、照样能服务，只是启动没变快，也不会当 seed 借给下一个实例。

把各种写错归一下，后果分四种：

| 后果 | 什么情况会这样 | 你能看到的 |
|---|---|---|
| 进程起不来 | 心跳、还租约那三项或端口基数显式填了非法值；设置包不是一个 JSON 对象 | 启动时直接报错 |
| 退回正常加载，且不当 seed | 身份串、策略名、Planner 地址三项里任一项最后是空的（包括键名写错、放错入口） | 一条 warning，之后照常从存储加载 |
| 悄悄用默认值 | 两个超时填了非法值；任何一项的键名写错 | 什么都看不到 |
| 自己照常起来，但当不上 seed，或登记了别人也借不到 | 监听地址填成本机没有的 IP，或固定端口被占用、撞号：seed 服务绑不上端口；宣告地址填成别的机器连不上的 IP：登记成功，来借的实例取不到清单 | 绑不上端口时，本机有一条 seed 服务启动失败的 warning；宣告地址填错，本机看不到，要在来借的那一方看到传输失败、退回默认加载 |

所以「服务能起来」不说明配对了。要看日志里 RFork 自己报的那几行，做法见[怎样验收](#怎样验收这套配置真的有用)。

代价就在这里：RFork 的设置大多是「可选、带默认值、带环境变量兜底」，写起来宽松，查起来费劲。下面先分清几个容易混的名字，再逐组讲每一项。

## 四个「名字」各管各的

一条启动命令里，至少有三处看起来像「模型名」，再加上部署策略名，一共四项，作用完全不同：

| 这一项 | 管什么 | A、B 两端要不要一样 |
|---|---|---|
| 启动命令后面跟的模型路径 | 本地从哪里取模型来构建，以及借不到时正常加载从哪读 | 路径文字可以不同，但实际模型内容和配置要对得上 |
| 模型身份串 | RFork 用来判断「是不是同一个模型」的字符串 | 想进同一个可互借的池子，就要一致 |
| 部署策略名 | RFork 的部署方式命名空间 | 同池一致；不兼容的部署要隔开时，换一个新值 |
| 对外服务名 | 调 API 时写的模型名 | 不参与 RFork 的匹配 |

模型身份串的字段名里带「URL」，很容易让人以为 RFork 会去这个地址下载模型。其实它只被当作一串文字做身份比对；借不到时的正常加载仍按模型路径走。

身份串或策略名留空（也没有设对应的环境变量），RFork 建不起会话：打一条 warning，直接走正常加载，这个实例之后也不会登记成 seed。Planner 地址留空也是同样的结果。更细的匹配规则见[身份与匹配](rfork-identity.md)。

## 十一项设置：管什么、默认多少、什么时候改

按用途分四组。「写错会怎样」上一节已经归成四种，这里不再逐行重复。

| 设置 | 默认值 | 管什么 | 什么时候要改 |
|---|---|---|---|
| **身份与找人** | | | |
| 模型身份串 | 空，必填 | RFork 判断「是不是同一个模型」 | 每个要互借的池子定一个值，池内所有实例一样 |
| 部署策略名 | 空，必填 | 部署方式的命名空间 | 部署不兼容、需要隔开时换一个新值 |
| Planner 地址 | 空，必填 | 去哪里借、还、登记、心跳 | 指向现场 Planner 的 IP 和端口 |
| **超时** | | | |
| 来源服务启动预算 | 5 秒 | 本机 seed 服务起来并通过健康检查的总预算；**不是**租约有效期 | 机器很忙、seed 服务启动超时 |
| 单次请求超时 | 10 秒 | 找 Planner、向 seed 取清单的**每一次** HTTP 请求等连接、等回复的时间 | 网络或 Planner 响应慢 |
| **地址与端口** | | | |
| 监听地址 | 0.0.0.0，即所有网卡 | seed 服务在本机哪块网卡上监听 | 只想让某一张网卡对外 |
| 对外宣告地址 | 留空，上报时自动取本机 IP | 报给 Planner、让别的机器来连 seed 服务的 IP | 多网卡，自动取到的不是别人连得上的那张 |
| 端口基数 | 0，即系统随机分配 | 正数时 seed 端口 = 基数 + 本进程的全局 rank | 防火墙只放行固定的端口段 |
| **心跳与还租约** | | | |
| 心跳间隔 | 30 秒 | 当上 seed 以后，上一次心跳**结束后**再等多久发下一次 | 要明显短于 Planner 判 seed 掉线的时限 |
| 还租约总次数 | 3，含第一次 | 归还租约最多试几次 | Planner 偶尔短暂不可用 |
| 还租约重试间隔 | 30 秒 | 两次可重试的失败之间等多久 | 同上 |

表里的**全局 rank** 是本进程在整个分布式组里的编号：每张卡一个 Worker 进程，从 0 往上数，跨机器也连着数。

几处措辞是有意这样写的：

- 心跳间隔从上一次心跳请求**结束**算起，不是固定节拍的定时器，所以 Planner 看到的心跳周期总比 30 秒长一点。仓库自带的示例 Planner 是 60 秒没收到心跳就把这个 seed 摘掉；心跳间隔加上一次请求的耗时，要留在这个时限之内。
- 宣告地址留空时，每次上报那一刻当场取本机 IP 填进去，不会真的报一个空地址。取的是 vLLM 探测到的本机 IP；多网卡的机器上，它不一定是别的机器连得上的那张网卡。

**设置从哪里读。** 前三组的八项里，除了端口基数，其余七项都可以用同名的大写环境变量给；顺序是设置包里的有效值优先，其次环境变量，最后默认值。端口基数和心跳与还租约那三项只认设置包里的值。

**四项严格，两项宽松。** 心跳与还租约那三项显式填了非法值（零或负数、字符串、true/false，次数写成小数也算）会直接报错，进程起不来；端口基数填了负数、超过 65535 或 true/false 也一样（它写成带引号的字符串反而不报错，见下一节）。这个检查发生在加载器刚创建的时候，比「RFork 失败就退回正常加载」那层保护更早，所以这里报错**不会**自动改用正常加载，得先把设置改对。两个超时宽松得多：写成带引号的数字（比如字符串的 8）也认；非法值不报错，先去看环境变量，没有就用默认值。

## 键名写错不报错，只是悄悄当没填

十一项里只有三项认别名：单次请求超时、监听地址、宣告地址，各有一两个短写法可用。其余每项只认唯一那个键名。

键名拼错一个字，程序**不会**提示「未知字段」，而是当作这项没填：先查环境变量，查不到就用默认值或空串。连上一节那四项严格检查的也一样：严格查的是**值**，不是键名；键名写错，照样悄悄用默认值。后果分两种：

- 把来源服务启动预算的键名少写了前缀：它悄悄按默认 5 秒跑，你以为改了其实没改。
- 把 Planner 地址的键名少写了前缀：它一路空到加载开始，B 打一条「Planner 地址是必填项」的 warning 就退回正常加载。看不出你其实写了，只是键名不对。

有别名的那三项，看的是**第一个出现的键**，不是挨个找第一个有效的值：写了正式键名就只看它，哪怕它的值无效，也不会改去读短写法。值无效时的处理和上面一样：查环境变量，再退默认值。

端口基数还有一个细节：必须是 JSON 里真正的整数。写成带引号的「"35000"」会被当作 0，也就是退回随机端口，而且不报错；写成 35000.0 这样的小数也一样。

## 四类端口：谁监听、谁来连、由什么决定

开头图里的四类端口，由不同的东西决定：

- **API 端口**：启动命令里写的端口。
- **Planner 端口**：Planner 自己的启动参数；B 的设置包里只写它的地址。
- **seed 元数据端口**：默认由系统随机分配；设了端口基数，就是基数 + 全局 rank。
- **传输引擎端点**：传输引擎初始化时自动取本机 IP 和一个空闲端口，设置里没有它的开关。

所以「把端口固定下来」只固定了第三类那一个。宣告地址也只改报给 Planner 的 seed 元数据地址，不会顺带改传输引擎自己选的端点。如果「清单取得到，真正读权重却失败」，要查的是第四类能不能连通。

固定端口的算法是「基数 + 全局 rank」，超出 65535 就作废：

```calc
title: 固定 seed 端口怎么算
基数 35000，rank 3 = 35000 + 3 = 35003
基数 65530，rank 7 = 65530 + 7 = 65537
> 第二行超过 65535：打一条 warning，退回系统随机端口
```

超范围有自动改口，端口**被占用**却没有：被占用时 seed 服务起不来，要去看它的启动报错。被占用最常见的来源是撞号。全局 rank 只在一个分布式组内唯一，同一台机器上两个互不相干的实例各自从 0 数 rank，用了同一个基数就会撞号；更隐蔽的是投机解码：主模型和草稿模型在同一个 Worker 进程里各有一套 RFork 会话，用的是同一个全局 rank，固定基数时两套 seed 服务必然算出同一个端口，后起的那套绑不上，就不当 seed（按源码推断，未实测）。两种撞号的补救不一样：同一台机器上的多个实例，可以把实例隔开，或者给它们错开端口基数；开了投机解码，工作版没有给草稿模型单独错开端口的设置，隔开实例也解决不了同一个 Worker 里的撞号，只能保持端口基数为 0，并确认两个模型角色的 seed 服务都起来了。

还有两条边界：

- **本机健康检查只证明本机能访问。** seed 服务起来后，本机会轮询它的健康检查接口，通了才算启动成功；连的是实际绑定的地址，监听「所有网卡」时改连本机回环地址。所以健康检查通过，不说明别的机器能连上宣告地址，更不说明传输通道通。
- **内建的 seed 服务是普通 HTTP。** 用来匹配的那串身份只是匹配用的，不是登录凭据。现场要走 HTTPS，得核对代理、地址和转发怎么配；不能只把地址改成 https 开头就当内建服务支持加密。

## 超时、重试间隔和租约有效期是三个量

这三个量常被混成「RFork 的超时」，其实各管一段：

- **单次请求超时**管每一次 HTTP 请求等连接、等回复的时间，不是「从借来源到对外服务」整件事的截止时间。
- **还租约的次数和间隔**管 B 读完以后在后台还租约时，失败了怎么重试。
- **租约有效期**是 Planner 那边的：租约从发出那一刻起算，到点就收回。示例 Planner 默认 60 秒，seed 的心跳只报平安、不续租约。它和「一个 seed 同时借给几家」都由启动 Planner 时它自己的命令行决定，B 这边的任何设置都改不了。

还租约默认最多 3 次、间隔 30 秒。三次都要重试时，光间隔就占 60 秒：

```calc
title: 还租约最坏要等多久（算例，不是上限）
三次请求 = 3 × 10 秒 = 30 秒
两段间隔 = 2 × 30 秒 = 60 秒
合计 = 30 + 60 = 90 秒
> 只是每次请求恰好卡满 10 秒时的算例；还要加上等锁、线程调度，真实耗时还会更长
```

来源服务启动那 5 秒也一样不是硬截止：它用来算健康检查的截止时刻，再用剩下的时间限制排队和轮询；失败后的清理另有一份等待预算。整个启动或失败清理的函数并不保证 5 秒内结束。

评估租约有效期够不够长时，要把**借到之后的内存登记、取清单、真正读权重、后台还租约**都算进去，再加上重试间隔。租约在读到一半时过期，读取本身不会被打断（seed 一侧不看租约），但 Planner 会把这个 seed 的借用名额收回来，再有新实例来借就会借出去，两个读者同时抢一张卡的带宽；B 之后去还，示例 Planner 回 404。调大单次请求超时不会让 Planner 延长租约。某次借用到底有没有过期，要看 Planner 那边记的租约时间和 B 日志里的持有时长，见[生命周期](rfork-lifecycle.md)。

## 设置写对了还不够：依赖和限制要实际核对

- 传输引擎来自 YuanRong 数据系统的 Python 包。光「装了同名包」不够，它还得提供按批登记显存的那个接口，缺了会直接判为不支持。
- 模型已经落地的参数和缓冲区必须全部在 NPU 上；一部分在 CPU、一部分在 NPU 会被拒绝，转去正常加载。
- 在并行参数或附加设置里打开动态专家负载均衡（[EPLB](eplb.md)），或者在附加设置里配了专家分布记录路径，RFork 会被整个绕过，日志里只有一条 warning。后两项所在的昇腾插件「附加设置」，恰好是 RFork 自己的设置**不该**放的那个入口。调重试次数改变不了这个限制。
- 正常加载的路径必须留着：第一个实例冷启动要靠它，借不到时也要退回它。「能从来源加载」不等于可以不要磁盘上的权重文件。

官网写的安装包名和随工作版保存的指南里的包名不一致，见[官方文档核读](../sources/rfork-official-guide.md)。不要在已经在跑的环境里直接把某个同名包升到最新版。先在**真正跑推理进程的那个 Python 环境**里做一次只读检查（脚本在下面「怎么开」），记下模块从哪里加载、包是什么版本，再按部署配套的版本去验证设备上的行为。

## 怎样验收这套配置真的有用

在同样的模型、输入和采样设置下，分别记录五种情况：正常加载的基线、第一个实例冷启动、第二个实例借到来源、找不到来源、中途出故障退回正常加载。每种情况都分段记时间：初始化、排布、申请来源、登记内存、取清单、读权重、还租约、自己发布成来源、服务就绪。

日志里 RFork 会报四种不同含义的「成功」，各自证明什么、不证明什么，见总览页的[四种成功](rfork.md#成功至少有四种不能压成一个开关)；分段耗时和吞吐的日志原文列在下面「开销和什么时候别开」。配置有没有生效，最直接的看法是：借到来源的那一次，有没有出现「权重传完」那一行；只看到「没有可用的 seed、改为本地加载」或「RFork 传输失败、退回默认加载」，说明这次其实走的是正常加载。

比对输出或 logits 时，方法要符合这个模型的确定性和容差要求。同时看两件事：被借的那台机器上，正在跑的推理延迟有没有变差；并发扩容多个实例时，启动耗时的长尾有多长。只测一条小请求正常，不能说明所有模型、量化方式和共享路径都支持。

## 放到 GLM 双机：每台机器开多少端口，固定端口会不会撞

先说清前提，这一节是推演，不是实测：我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。官方教程没有开 RFork；工作版代码树里也没有 GLM-5.3-Flash 的模型实现，两边合起来的推演和限制见总览页的 [GLM 一节](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)。这里只看配置层面的三件事。

### 每台机器上 RFork 新开多少个端口

每台机器 8 张卡、8 个 Worker 进程。投机解码的 MTP 草稿模型和主模型在同一个 Worker 里，各有一套 RFork 会话，各自借、各自当 seed。每套会话一建好就有自己的传输引擎端点，当上 seed 以后再开一个 seed 元数据端口：

```calc
title: GLM 双机每台机器上 RFork 新开的端口
每台的 RFork 会话 = 8 个 Worker × 2（主模型、草稿模型） = 16 套
每台新开的端口 = 16 套 × 2（seed 元数据、传输引擎端点） = 32 个
> 另外 node0 还有 1 个 API 端口，node1 以 headless 方式只跑引擎、不开 API；Planner 是实例之外的独立服务，16 个 Worker 的 32 套会话都去连它
```

这 32 个端口在默认设置下全是随机的。如果现场防火墙只放行固定端口段，就要先解决下面这个问题。

### 固定端口基数会撞

两台机器上的全局 rank 连着数：node0 是 0–7，node1 是 8–15。设基数 35000，node0 的 seed 端口是 35000–35007，node1 是 35008–35015，机器之间不撞。

撞在机器内部：同一个 Worker 里的主模型会话和草稿模型会话，全局 rank 相同，算出的端口也相同。后起的那套 seed 服务绑不上端口，打一条 warning 后就不当 seed。下一个实例来借时，这一套的身份在 Planner 那里没有来源，只能退回正常加载（按源码推断，未实测）。所以这套部署开着 MTP，就保持端口基数为 0；传输引擎端点本来就固定不了，防火墙策略要按随机端口来定。YuanRong 传输除了这个端点是否还另用端口，目前没有资料，列在页末。

### 默认 60 秒的租约够不够

主模型会话每张卡要读约 20.09 GiB（逐项见总览页的[每张卡读多少](rfork.md#每张卡读多少读的字节和常驻的权重是两本账)）。示例 Planner 的租约默认 60 秒，不续租，那么光读权重就要求每张卡平均读速至少 20.09 GiB ÷ 60 秒 ≈ 0.33 GiB/s，还没算内存登记和取清单。读得比这慢，租约会在读完之前被收回：这次读取照常完成，但 Planner 会把这个 seed 的名额放回去，再有实例来借就会借出去。实际读速要看「权重传完」那行日志里的吞吐，目前还缺一次实机记录。不够时调 Planner 的租约有效期。

## 常见误解

- **「服务能起来，RFork 就配好了。」** 多数写错只会让 B 退回正常加载，照样起得来。要看日志里有没有「权重传完」那一行。
- **「固定了端口基数，RFork 的端口就都固定了。」** 只固定了 seed 元数据端口。传输引擎端点仍是初始化时随机选的，而且开了投机解码时，主模型和草稿模型会算出同一个端口。
- **「本机健康检查过了，别的机器就能来借。」** 健康检查连的是本机地址，证明不了宣告地址和传输端点从别的机器连得上。
- **「把单次请求超时调大，租约就更宽裕。」** 租约有效期归 Planner 管，B 的任何设置都延长不了它。
- **「设置里写 https 地址就加密了。」** 内建的 seed 服务是普通 HTTP，要加密得靠现场的代理和转发。
- **「归还租约收到 400，说明租约过期了。」** 400 本身证明不了过期；示例 Planner 里过期的租约归还时回的是 404。细节见总览页的[常见误解](rfork.md#常见误解)。

## 对照源码

### 怎么开

RFork 的设置走 `--model-loader-extra-config`，不是 `--additional-config`；`--load-format rfork` 选择这个加载器。Planner 的 TTL 和并发容量属于 Planner 服务自己，客户端参数不会替它改配置。[C1][C8]

上半「四个名字」对应的字段：

| 上半叫法 | 字段 / 参数 |
|---|---|
| 启动命令后的模型路径 | `vllm serve` 后的位置参数 |
| 模型身份串 | `model_url` |
| 部署策略名 | `model_deploy_strategy_name` |
| 对外服务名 | `--served-model-name`，不是 RFork 指纹的直接字段 |

`model_url` 只作字符串参与身份匹配，fallback 仍使用模型加载配置。[C2]

客户端参数全表（默认值与读取顺序来自 `RForkConfig`）：

| JSON 字段 | 默认值 | 有效输入与环境回退 | 别名 |
|---|---|---|---|
| `model_url` | `""` | `MODEL_URL` | 无 |
| `model_deploy_strategy_name` | `""` | `MODEL_DEPLOY_STRATEGY_NAME` | 无 |
| `rfork_scheduler_url` | `""` | `RFORK_SCHEDULER_URL` | 无 |
| `rfork_seed_timeout_sec` | 5.0 | 有限正数；`RFORK_SEED_TIMEOUT_SEC` | 无 |
| `rfork_request_timeout_sec` | 10.0 | 有限正数；`RFORK_REQUEST_TIMEOUT_SEC` | `request_timeout_sec` |
| `rfork_seed_bind_host` | `0.0.0.0` | `RFORK_SEED_BIND_HOST` | `seed_bind_host`、`bind_host` |
| `rfork_seed_advertise_host` | None，随后自动探测 IP | `RFORK_SEED_ADVERTISE_HOST` | `seed_advertise_host`、`advertise_host` |
| `rfork_seed_port_base` | 0 | JSON 整数；无环境回退 | 无 |
| `rfork_heartbeat_interval_sec` | 30.0 | 严格有限正 JSON number；无环境回退 | 无 |
| `rfork_lease_release_max_attempts` | 3 | 严格正 JSON integer；无环境回退 | 无 |
| `rfork_lease_release_retry_interval_sec` | 30.0 | 严格有限正 JSON number；无环境回退 | 无 |

心跳「请求结束后再等」与 advertise 留空时由上报函数当场取本机 IP，见 `planner_client.py`。[C9]

先在具备依赖的环境启动此版本的**示例** Planner；它是协议演示，不自动提供生产级持久化或多副本共享状态：

```bash
python examples/rfork/rfork_planner.py --host 0.0.0.0 --port 1223 --lease-ttl-sec 60
```

这三个开关（以及 `--heartbeat-ttl-sec`、`--default-resource-points`、`--alloc-policy`）由示例 Planner 自己的命令行解析定义，默认值来自同名的 `RFORK_MOCK_*` 环境变量；它们配置的是**服务端**的租约与容量，和客户端参数表不是一套。[C14]

然后为每个实例设置自身可被远端访问的 advertise IP。下例使用默认动态 seed 端口，避免把同机拓扑假设硬写进最小命令：

```bash
export RFORK_CONFIG='{
  "model_url": "qwen3-0.6b-model-revision-A",
  "model_deploy_strategy_name": "rfork-work-patch7-tp1",
  "rfork_scheduler_url": "http://10.0.0.10:1223",
  "rfork_seed_advertise_host": "10.0.0.21",
  "rfork_seed_port_base": 0,
  "rfork_request_timeout_sec": 10.0,
  "rfork_heartbeat_interval_sec": 30.0,
  "rfork_lease_release_max_attempts": 3,
  "rfork_lease_release_retry_interval_sec": 30.0
}'
vllm serve /models/Qwen3-0.6B \
  --tensor-parallel-size 1 \
  --served-model-name qwen3 \
  --port 8000 \
  --load-format rfork \
  --model-loader-extra-config "$RFORK_CONFIG"
```

`10.0.0.*`、模型路径和版本标签均是示例，不能直接代表你的现场。第二个实例保留相同模型与策略标识，改成自己的 advertise 地址和可用业务端口；两端必须部署相容的 RFork 代码与模型配置。[A]

启动前在实际 Worker 所用的 Python 环境做只读 API 检查：

```python
from importlib.metadata import PackageNotFoundError, version
import yr.datasystem as ds

print("module:", ds.__file__)
for package in ("openyuanrong-transfer-engine", "openyuanrong-datasystem"):
    try:
        print(package, version(package))
    except PackageNotFoundError:
        print(package, "distribution metadata not found")

required = ("initialize", "batch_register_memory_ex",
            "batch_unregister_memory", "batch_transfer_sync_read", "finalize")
engine_class = getattr(ds, "TransferEngine", None)
missing = [name for name in required
           if not callable(getattr(engine_class, name, None))]
if not callable(getattr(ds, "MemoryRegistration", None)):
    missing.append("MemoryRegistration")
if not hasattr(getattr(ds, "ErrorCode", None), "kNotReady"):
    missing.append("ErrorCode.kNotReady")
print("missing required API:", missing)
print("optional kNotFound:",
      hasattr(getattr(ds, "ErrorCode", None), "kNotFound"))
```

此检查不实例化引擎、不注册设备内存；通过只说明 API 名称可见。还需核对 `MemoryRegistration` 四参数的语义、部分失败后的注销结果、native 返回对象及 finalize 对活动传输的行为。`kNotFound` 在工作版是可选探测，缺少时不能走对应的「已不存在」确认逻辑；不能擅自补一个猜测错误码。[C4][C10]

### 会报什么错

- 空 `rfork_scheduler_url`：`RForkSession.__init__` 抛 `ValueError("rfork_scheduler_url is required; …")`；空 `model_url` 或空 strategy：抛 `ValueError("RFork requires non-empty model_url and model_deploy_strategy_name")`。会话是在 `load_model` 的回退保护里创建的，所以这两条**不会**让启动失败，而是被记成 `RFork transfer failed: <上面的原文>, clean up and fall back to default loader` 后走默认加载；因为会话没建成，回退加载完也**不会**登记成 seed。
- `rfork_scheduler_url` 键名写错（如写成 `scheduler_url`）且无环境变量：就是上一条的第一种，warning 里看不出其实是键名不对。
- `--model-loader-extra-config` 不是 JSON 对象：加载器 `__init__` 抛 `RuntimeError("RFork requires --model-loader-extra-config to be a JSON object.")`，进程起不来。
- heartbeat / release attempts / release interval 三个运维字段显式填错：抛 `ValueError`；两个 timeout 对无效输入先试环境值，再退默认值。
- 这些参数在加载器 `__init__` 中解析，早于 `load_model` 内的 RFork 回退保护，所以严格校验抛出的 `ValueError` 不会自动转默认加载。[C12][D]
- `rfork_seed_port_base`：JSON 输入不是 int 时读取函数先退成 0（`"35000"` 不会成为固定端口）；bool 虽是 int 子类，后续仍明确拒绝；负数或大于 65535 也拒绝。这三种拒绝和上一条一样在 `__init__` 抛 `ValueError("rfork_seed_port_base must be a JSON integer in range [0, 65535]")`，进程起不来。
- base + global rank 超过 65535：记录 warning 并退回随机端口；端口被占用没有同样的自动改口：`_create_bound_socket` 抛 `OSError("unable to bind RFork seed host … port …")`，日志是 `RFork seed service startup failed for global_rank=…`，这个模型角色不当 seed，已加载的模型照常交回。[C3]
- TransferEngine 初始化使用 `yr.datasystem` 的 `TransferEngine`、`MemoryRegistration`、`ErrorCode`，传输类型为 `ascend`。 缺 `batch_register_memory_ex` 直接判定不支持。
- 实际物化的 Parameters / buffers 不全在 NPU（混合 CPU/NPU）：拒绝并尝试默认加载。[C5]
- 本地健康检查使用实际绑定地址，监听 `0.0.0.0` / `::` 时改用回环地址；健康检查 200 不证明 advertise 地址远端可达，也不证明 TransferEngine 数据端点连通。[C11]
- metadata 能拿到、native read 却失败：`rfork_seed_advertise_host` 只改发布给 Planner 的 seed HTTP 地址，TransferEngine 端点由 `get_ip()` + `get_open_port()` 在初始化时选择，要单独查它的可达性。

### 开销和什么时候别开

- `parallel_config.enable_eplb`、`eplb_config.dynamic_eplb` 或 `expert_map_record_path` 命中动态 EPLB 检查时 RFork 被绕过，调重试数不改变这个限制。[C6][C7]
- `rfork_request_timeout_sec` 传给 Requests，约束连接 / 读等待，不是总截止时间。按 `3 × 10 + 2 × 30 = 90 秒` 计算只是每次 HTTP 恰好耗时 10 秒的算例，不是严格上界。[S13][D]
- seed 启动用单调时钟算健康检查 deadline，用剩余时间限制队列与轮询；失败清理另有等待预算。
- 固定端口：global rank 取自 `torch.distributed.get_rank()`，在分布式组内唯一，不保证同机多个独立实例之间唯一。main 与 draft 是同一 Worker 进程里的两个 session，global rank 相同，工作版也没有按 draft 偏移端口的逻辑，所以 `rfork_seed_port_base` > 0 时两者必然算出同一端口，后起的一个绑定失败（按源码推断，未实测）。补救：同机多个独立实例可隔离实例或错开 base；main 与 draft 撞号只能保留动态端口（base = 0），并分别验证两个模型角色的 seed 启动结果。[I]
- 内建 seed 服务以普通 HTTP 启动；seed key 是匹配字段，不是认证凭据；走 HTTPS 要核对代理、URL 与转发配置。
- 验收：只测一条小请求正常，不能宣称所有模型、量化与共享路径都被支持。[I]
- 分段计时看四行日志：`RFork transfer stages: … registration=… metadata=… read=…`（`session.py#L138-L145`）；`RFork weight transfer completed: weights=…, chunks=…, bytes=… GiB, elapsed=…, throughput=… GiB/s`（`transfer_backend.py#L784-L791`，GLM 一节的 0.33 GiB/s 门槛就拿这里的 throughput 对）；`RFork … model layout processing took … seconds`（`rfork_loader.py#L604-L608`）；`RFork lease release outcome: … held_elapsed=…`（`session.py#L189-L196`，租约持有时长）。
- 示例 Planner 的租约从 `get_seed` 发出时记 `leased_at`，到 `--lease-ttl-sec`（默认 60）后，由定时清扫（`--heartbeat-sweep-sec`，默认 5 秒）或下一次借、还时清掉，并把 seed 的 `resource_used` 减回去；心跳不更新 `leased_at`。`--default-resource-points` 默认 1，即一个 seed 同时只借给一家。

### 版本差异

本页只讲用户确认的 RFork 工作版（`rfork@3284850b`），社区 v0.23、v0.26、main 各带哪些补丁见总览页的[版本差异](rfork.md#版本差异)，本页不另列。官网安装项与随工作版保存的指南使用的发行包名存在差异，见[官方文档核读](../sources/rfork-official-guide.md)。

### 源码位置

以下均为 `rfork@3284850b`，路径省略前缀 `vllm_ascend/model_loader/rfork/`：

- `RForkConfig` 默认值：`config.py#L11-L15`；字符串、超时的读取与环境回退：`#L18-L52`；四项严格校验：`#L69-L81`；`from_extra_config` 与别名、端口基数取值：`#L84-L139`
- 加载器 `__init__` 解析设置：`rfork_loader.py#L416-L418`；会话在回退保护内创建：`#L563-L565`；通用异常转回退与清理失败中止：`#L652-L672`；回退后能否登记 seed 取决于会话是否存在：`#L698-L702`
- 必填项检查：`session.py#L37-L43`；seed 端口 = 基数 + global rank 与溢出回退：`#L364-L379`；起 seed 服务与首次上报：`#L380-L392`；心跳线程：`#L393-L406`；seed 启动失败的处理：`#L414-L425`；还租约循环：`#L177-L214`
- global rank 取自 `torch.distributed.get_rank()`：`rfork_loader.py#L446`；动态 EPLB 绕过：`#L373-L383`
- `yr.datasystem` 导入：`transfer_backend.py#L207-L217`；传输端点 `get_ip()` + `get_open_port()`：`#L220-L229`；`kNotFound` 可选探测：`#L232`；混合 CPU/NPU 检查：`#L289-L295`；`batch_register_memory_ex` 检查：`#L405-L409`
- advertise 留空时取 `get_ip()`：`planner_client.py#L213-L226`；心跳「请求结束后再等」：`#L237-L267`
- seed 服务的启动与停止预算：`seed_server.py#L37-L39`；绑定与 `SO_REUSEADDR`：`#L105-L124`；健康检查地址与回环：`#L127-L137`；健康检查 deadline：`#L293-L353`
- 示例 Planner：默认端口 1223、心跳 TTL 60 秒、租约 TTL 60 秒、名额 1 与 `RFORK_MOCK_*`：`examples/rfork/rfork_planner.py#L39-L75`；租约过期清理：`#L276-L286`；命令行开关：`#L545-L582`
- 工作版指南中的参数表、超时与重试说明：`docs/source/user_guide/feature_guide/rfork.md#L183-L224` [S13]
- `get_ip()` 先读 `VLLM_HOST_IP`，没有就取出网路由那张网卡的 IP；`get_open_port()` 设了 `VLLM_PORT` 时从那里往上找空闲端口：`vllm@0fc695fc:vllm/utils/network_utils.py#L33-L69`、`#L150-L221`（工作版现场配套的 vLLM 提交以部署为准）

**待核：**

1. 生产环境 Planner 的租约有效期、心跳摘除时限、每个 seed 的名额和归还回码；仓库里只有示例 Planner。
2. GLM 双机每张卡的实际读速，是否高于默认 60 秒租约要求的约 0.33 GiB/s；缺一次实机的「权重传完」日志。
3. 固定端口基数下主模型与草稿模型撞端口：结论按源码推出，缺一次实机日志。
4. YuanRong 传输引擎除了初始化时的端点，是否还另用端口或 RDMA 通道，防火墙要放行哪些；缺数据系统侧文档。
