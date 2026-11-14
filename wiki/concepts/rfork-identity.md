---
id: rfork-identity
title: RFork 身份匹配：同模型、同布局，还要同一份分片
type: feature
summary: >-
  B 的每张卡凭一把 seed key 向 Planner 找 seed：先把版本、数值类型、量化、并行大小和昇腾排布算成部署指纹，再加上 TP / PP /
  EP 编号和主 / 草稿角色做一次 SHA256。本页讲钥匙里有什么、没有什么，为什么同一个模型也可能借不到，钥匙对上为什么不代表内容一样，以及 GLM
  双机上 32 把钥匙各写什么编号。
aliases:
  - RFork fingerprint
  - RFork seed key
  - RFork 身份匹配
  - build_compatibility_fingerprint
  - build_seed_key
  - planner returned no compatible seed
  - compatibility fingerprint
  - RFork 部署指纹
  - RFork 兼容性指纹
  - is_draft_worker
chapters: []
order: 40
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L32-L104'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L107-L157'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L170-L251'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L254-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L113-L176'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L441-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L109'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L192-L213'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L360-L370'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L45-L67'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L246-L264'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L69-L74'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L115-L124'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L251-L256'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L449-L458'
  - 'rfork@3284850b:Dockerfile#L53-L54'
  - 'vllm@568afb3a:vllm/config/parallel.py#L159-L163'
  - 'vllm@568afb3a:vllm/config/vllm.py#L946-L951'
  - 'vllm@568afb3a:vllm/distributed/parallel_state.py#L1893-L1906'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L610-L652'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L73-L80'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L563-L577'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L652-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L582-L591'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L45-L50'
  - 'rfork@3284850b:vllm_ascend/ascend_config.py#L262-L269'
  - 'rfork@3284850b:vllm_ascend/envs.py#L88-L88'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L37-L48'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L100-L110'
  - 'vllm@568afb3a:vllm/config/parallel.py#L124-L124'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L386-L419'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L45-L49'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L96-L110'
  - >-
    raw:sha256-79ca37c7a3b1178b525522ff58d26020480d15d150e5e780e3c5f5922ac561fa.md#L1-L865
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/identity.py#L219-L339'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/tensor_layout.py#L42-L61'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/rfork_loader.py#L498-L524'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 先知道 seed、Planner 和借一次权重的几步，再看两边凭什么配对
  - to: tensor-parallel
    kind: builds-on
    note: 钥匙里的 TP 编号对应的就是 TP 把矩阵切成的那一份
  - to: expert-parallel
    kind: builds-on
    note: EP 编号区分每张卡放的是哪几个专家
contradicts: []
updated: '2026-10-25'
rawSources:
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-79ca37c7a3b1178b525522ff58d26020480d15d150e5e780e3c5f5922ac561fa.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 已经有实例在跑同一个模型，B 为什么还会借不到

RFork 让新起的实例 B 直接从正在服务的实例 A 的显存里读权重，不必再从存储读一遍文件（整套流程见[总览](rfork.md)）。A 这种把自己的权重借出去的实例叫 seed；替双方牵线、记录谁能借给谁的服务叫 Planner。本页回答一个问题：B 的一张卡，凭什么认定 A 某张卡上的那份权重正好是自己要的？

答案是一把钥匙，叫 **seed key**。A 的每张卡当上 seed 时，拿自己的钥匙到 Planner 登记；B 的每张卡启动时，各自算出自己的钥匙去 Planner 查。Planner 不打开模型目录，也不比较权重，只做一件事：在登记过的 seed 里，找钥匙和它**一个字符都不差**的那个。

钥匙由三样东西合成：

- **部署指纹**：两边整套部署一不一样，包括模型版本、数值类型、量化方式、各个并行组有多大、权重在昇腾卡上怎么排。代码里叫兼容性指纹（compatibility fingerprint）。
- **分片编号**：这张卡要的是哪一份。模型切到几张卡上以后，每张卡只存其中一份；编号就是这张卡在 TP、PP、EP 各组里的 rank，也就是组内从 0 数起的序号。
- **主还是草稿**：开了 [speculative decoding](speculative-decoding.md)（先由草稿模型猜出后面几个 token，再由主模型一次验证）时，同一张卡上同时放着主模型和草稿模型，两份权重不同，各有一把钥匙。

```wiki-diagram
file: rfork-identity
```

图里最容易误会的是 C：它和 A 是同一个模型，只是加载了没量化的 BF16 版本。量化方式属于部署指纹，这一项一变，C 的每一把钥匙都和 A 的不同，分片编号再一样也没用。

这把钥匙只描述「模型怎么加载、怎么切分」，和用户请求无关：问题是 37 个 token 还是 100 个 token、请求编号是多少，都不在钥匙里。

## 为什么要逐字配钥匙，而不是看模型路径

B 从 A 读过来的是显存里的原始字节，读完直接拿来推理，中间没有哪一步会把「不对的字节」改对。可是「同一个模型」在两个实例的显存里，字节常常是两回事：

- **切法不同**：TP2 时卡 0 存的是每个大矩阵的一半，TP4 时卡 0 只存四分之一。张量名字一样，形状和内容都不一样。
- **数值表示不同**：W8A8 每个权重占 1 字节，另配缩放系数；BF16 每个占 2 字节。
- **排布不同**：昇腾上一部分权重会转成 NZ 分块格式存放（这种格式在[张量布局](rfork-layout.md)里讲）。同一个矩阵按 NZ 排和按普通的行优先排，字节顺序不同。

所以光是「同一个模型」不够，要「同一种部署里的同一份分片」。逐字比钥匙的好处是简单、可预测：Planner 不需要懂模型，只比字符串；A 和 B 也不用事先通信，各自按同一套规则算，配置一样就必然算出同一把钥匙。

代价有两面。第一，宁可错过，不会错配：两边其实兼容，只是模型地址写法不同、或者部署策略名不同，钥匙也就不同，B 只能回退去存储加载。第二，钥匙里只有配置、没有权重内容，对上了也不能证明字节一样，后面还要有一道清单核对兜底（见[下文](#钥匙对上了也不能证明权重内容一样)）。几道关各管一件事：

| 这一关 | 回答什么 | 讲在哪 |
|---|---|---|
| 部署指纹 | 两边整套部署能不能互换 | 本页 |
| seed key | 要的是其中哪一份，主模型还是草稿 | 本页 |
| 清单核对 | 每个张量的名字、形状、类型、字节数对不对得上 | [传输与内存](rfork-transfer.md) |
| 租约 | 这个 seed 此刻能不能借给你 | [租约与生命周期](rfork-lifecycle.md) |

## 钥匙怎么算：两次 SHA256

两次都用 SHA256。它是一种哈希算法：把任意一段文字压成固定 64 位的十六进制串。同样的输入永远得到同样的输出；输入哪怕只改一个字，输出也会整个变样，而且从输出看不出原来写的是什么。

1. **第一次，算部署指纹。** 把部署配置写成一段固定格式的 JSON（一种用花括号和「键: 值」记录数据的文本格式），算一次 SHA256。
2. **第二次，算 seed key。** 把指纹、模型地址、部署策略名、三个分片编号和「是不是草稿」再写成一段 JSON，再算一次 SHA256。

下面用一份只保留三项的简化配置演示一遍。哈希值是真的算出来的，只截前 12 位：

```calc
title: 改一处配置，哈希整个变样（简化描述，SHA256 前 12 位）
A 的指纹 = SHA256(数值类型 bfloat16，模型地址 demo/model，TP 大小 2) = 「89f742e1f557…」
只换数值类型 = SHA256(float16，demo/model，2) = 「12e7efe7fe5f…」
只换 TP 大小 = SHA256(bfloat16，demo/model，4) = 「9de863023bcd…」
> A 的描述原文是 {"dtype":"torch.bfloat16","model_url":"demo/model","tensor_world_size":2}，键名排序、不留空格

A 卡 0 主模型的钥匙 = SHA256(A 的指纹，TP 编号 0，不是草稿) = 「da8d663a9e46…」
A 卡 1 主模型的钥匙 = SHA256(A 的指纹，TP 编号 1，不是草稿) = 「b7065bcaeda3…」
只把角色换成草稿 = SHA256(A 的指纹，TP 编号 0，是草稿) = 「8334f814aba1…」
> 钥匙这三行的描述键名是 compatibility_fingerprint、tp_rank、is_draft_worker，指纹按完整 64 位代入
```

从这几行能看出三件事。第一，同样的输入必然得到同样的钥匙，所以 A 和 B 不用商量，各算各的就能对上。第二，改任何一项，结果都完全不同，没有「差不多」：B 用 float16、A 用 bfloat16，哪怕两种类型每个数都占 2 字节，也配不上。第三，从两串哈希值看不出差在哪一项。日志里只打印哈希值、不打印描述原文，排错时想知道差在哪，得把两边的配置逐项摆出来比。

分两次算还有一个好处：指纹描述的是整套部署，同一个实例里主模型的每张卡算出的指纹都一样，编号和角色到第二次才加进去。排错时可以先比指纹：指纹就不同，说明部署配置不一样，跟哪张卡无关；指纹相同而钥匙不同，再去看编号和角色。

## 部署指纹里写了什么

指纹的描述按意思分六组。任何一组两边不一样，指纹就不同，A 和 B 就落进两个池子。

| 组别 | 放进去的内容 | 排错时要注意 |
|---|---|---|
| 模型名字 | 模型地址、部署策略名 | 两段用来区分的文字，RFork 不会拿它去下载；写法差一个字符就分池 |
| 模型版本 | 版本号；没写就去模型配置里找提交号 | 本地权重往往没有版本号，两边都记成空也算「相同」，不能拿它证明内容一样 |
| 数值怎么存 | 数值类型、量化方式、量化配置的摘要 | 每个数同为 2 字节的 BF16 和 FP16 也算不同 |
| 模型结构 | 模型配置里的模型类型、架构名、配置类（连同它所在的模块路径） | 草稿模型按自己的模型配置算，这一组通常和主模型不同 |
| 怎么切分 | TP、PP、DP 各组的大小，是否开了 EP，是不是 MoE 模型；另留了一栏 EP 组大小 | EP 组大小那一栏实际总是空的，见下文 |
| 在昇腾卡上怎么排 | 权重的 NZ 模式、当前硬件的权重排布策略 | 同一个模型换了排布，字节不能直接互换 |

**EP 组大小那一栏为什么是空的。** 描述里给 EP 组大小留了位置，但它去并行配置里找的两个属性名，在工作版配套的 vLLM v0.26.0 里都不存在，找不到就记成空。这不等于 EP 的切法没进指纹：vLLM 给 MoE 模型建的 EP 组，卡数按 DP 大小 × prefill context parallel 大小 × TP 大小算（prefill context parallel 是把长 prompt 按序列切到多张卡上的一种并行，vLLM 默认取 1），而 TP 大小、DP 大小、「是否开 EP」和「是不是 MoE」都在指纹里。两边只差 prefill context parallel 大小时，指纹分不出来；这是按代码推出的，没有实测，和本页其他推断一起列在页末。

**描述要先整理成固定的样子。** 算之前会把描述规范化：字典按键名排序，集合排成固定顺序，数值类型写成「torch.bfloat16」这样的固定字符串，枚举只取名字，不写进进程地址之类每次运行都会变的东西。否则两边配置明明一样，写出来的文字却不一样，指纹也会对不上。描述里如果有容器引用了自己，规范化会直接报错，而不是无限展开下去。

**模型版本按固定顺序找。** 先看显式指定的版本，再看模型版本字段，再去两类模型配置里找提交号；一个都没有就记为空。这只是「记下写了什么版本」，并没有去核对模型文件本身。

**量化配置的摘要只看模型配置里的量化字段。** 昇腾上的 W8A8 权重通常由 ModelSlim 工具产出，每一层用什么精度，写在模型目录里单独的一份描述文件里；指纹不读那份文件。所以逐层精度有没有进指纹，取决于模型配置文件本身带不带量化字段。我们这份权重属于哪种情况，列在页末待核。

**配置类连同模块路径一起写进去。** 所以两边的 transformers 版本如果让这个配置类换了所在的模块，指纹也会不同（按代码推断）。

## 分片编号和角色：要的是其中哪一份

指纹说明「能不能互换」，但一个实例切成几份时，B 的每张卡要的只是其中一份。所以 seed key 在指纹之外，还放进三个分片编号和主 / 草稿角色（模型地址和策略名也再放一次）。

| 身份 | 进不进钥匙 | 为什么 |
|---|---|---|
| TP 编号 | 直接进 | 同一个矩阵的不同切片放在不同卡上 |
| PP 编号 | PP 分了不止一段时才进，否则记为空 | 不同段放的是不同的层 |
| EP 编号 | 开了 EP、且模型没被标成「不是 MoE」时才进 | 不同卡放的是不同的专家 |
| 主 / 草稿 | 直接进 | 两份不同的权重，清单不能混 |
| 全局编号 | 不进；seed 服务的端口用它算（设了基础端口时是基础端口 + 全局编号，基础端口为 0 时由系统随机分配），日志里也用它标卡 | 不该拿「是第几号进程」限制跨实例借用 |
| DP 编号 | 不进；DP 组大小已在指纹里 | DP 组之间，专家以外的权重完全相同，专家的差别由 EP 编号区分 |
| 节点 IP、prefill / decode 角色 | 两段描述里都没有 | 配置相同的跨节点实例，以及 PD disaggregation（把处理提示词的 prefill 和逐个生成 token 的 decode 分给不同实例）里的两类实例，都有机会互借 |

取 PP 编号或 EP 编号时，如果对应的并行组还没建好，会抛出报错，不会悄悄记成空。这个报错会被 RFork 加载器接住，和建会话时查出缺配置走的是同一条路：打一条「传输失败、清理后回退到默认加载」的警告，改从存储加载，启动不会停下。因为这时连会话都还没建起来，这张卡回退后不会登记成 seed。

**怎么判断自己是草稿。** 模型配置里的运行类型写明是草稿，或者模型类型以「_mtp」结尾、架构名以「MTPModel」结尾，满足一条就算。主模型和草稿模型在同一个 Worker 里各开一个会话，各算各的指纹和钥匙。有一个例外：草稿模型的权重如果全都和已经加载好的主模型共用，草稿就直接复用主模型那一份，不去问 Planner，也不多借一次。GLM 的 MTP 层有自己的权重，不属于这种情况。

## 一个实例的几张卡，各借各的

假设 B 用四张卡（TP4）。B 的四个 Worker 各拿自己的钥匙去问 Planner，没有「整份模型从某一个实例拿」这样一次性的选择。Planner 每次只看这一把钥匙：在登记了这把钥匙、还有空余名额的 seed 里挑一个。仓库自带的示例 Planner 每个 seed 默认只有 1 个名额；默认的挑法是 fifo，挑最后一次心跳最早的那个，也可以配成 lru，挑最久没被借过的那个。两种都不做跨卡的整体分配。

所以如果同时有两个和 A 一模一样的实例 A1、A2 在服务，B 的卡 0 借到 A1、卡 1 借到 A2，这种组合是允许的，也没有问题：两边的部署指纹相同，A1 卡 1 和 A2 卡 1 存的本来就是同一份分片。四份「拼得起来」，靠的是每份各自的钥匙和之后的清单核对，而不是「四张卡都选中了同一台机器」。

## 钥匙对上了，也不能证明权重内容一样

两次哈希的输入都是**配置描述**：没有把权重读一遍算内容校验和，也没有把 RFork 代码的提交号写进去。如果有人悄悄替换了某个目录里的权重文件，而模型地址、版本号和其他配置都没变，两边仍然会算出同一把钥匙。

钥匙之后的清单核对能拦住一部分：张量的名字、形状、类型、字节数只要有一项对不上，就不传（见[传输与内存](rfork-transfer.md)）。但如果两份权重形状、类型都一样，只是数值不同，比如同一结构微调出的两个版本、又都没写版本号，清单也拦不住。

所以维护 RFork 时，要同时记下模型文件的版本和 RFork 代码的提交。改了传输方式、改了哪些张量要传、改了派生权重的含义之后，应该把旧的 seed 隔离开：换一个新的部署策略名，钥匙就全变了，新旧实例自然分成两个池。但这只是运维上的隔离，不能替代一致性测试。

反过来也要小心：别为了绕过某个形状报错，就随手把对不上的字段从指纹里删掉。例如「单批最多处理多少 token」这个配置不在指纹里，和它相关的那块工作区是专门改成「留在本地、不借」的，原因见[张量布局](rfork-layout.md)。

## 「没借到」要分清：钥匙没算出来、匹配不到，还是根本没问成

```wiki-diagram
file: rfork-identity-flow
```

B 的一个 Worker 先算钥匙，再搭空模型，然后只带这一把钥匙去问 Planner。结果一共四种，没借到的占三种（图里第二排从左往右）：

- **钥匙没算出来**：没配 Planner 地址、缺模型地址或部署策略名（这三项在建会话时先查，任何一项为空就报错，钥匙还来不及算），PP 或 EP 组还没建好，或者描述里有容器引用了自己。RFork 加载器接住这个报错，打一条「传输失败、清理后回退到默认加载」的警告，警告里带着原始报错；这张卡改从存储加载，启动不会停下，但回退后不登记成 seed。
- **没问成**：Planner 地址配了，但网络出错，Planner 回了别的状态码，或者回复缺项、格式不对。
- **匹配不到**：Planner 明确说这把钥匙下没有可用的 seed。示例 Planner 在两种情况下这么回答：没有任何 seed 登记过这把钥匙；或者登记过的 seed 名额都被占满了。它每次挑之前，还会先把超过 60 秒没报平安（心跳）的 seed 清掉，所以 A 卡住或退出后，它的钥匙很快也会查不到。
- **借到了**：Planner 回了 seed 的 IP、端口、本次租约的编号和 seed 那张卡的编号，四项齐全，端口和编号也是合法整数，B 就去读权重。

没问成和匹配不到最后打的是同一句日志：没有可用的 seed，改从本地加载，加载完把自己登记成 seed。表面一样，原因却完全不同：匹配不到是钥匙或 seed 的问题，没问成是连接或 Planner 本身的问题，后者在更早的位置会多一条「向 Planner 要 seed 失败」的警告。排查时按这个顺序走：

1. 先找「传输失败、回退」的警告。这句警告在借到以后真正传输出错时也会出现，所以要看它带的原始报错：如果是没配 Planner 地址、缺模型地址或策略名、并行组没建好、描述里有容器引用了自己这几种（原文见[会报什么错](#会报什么错)），就是钥匙没算出来，这张卡也没去问 Planner。
2. 再找「向 Planner 要 seed 失败」的警告。有，就是没问成，先查网络和 Planner 本身；地址填错了但不为空，也落在这一类。
3. 把两边的指纹拿出来比。每个 TP 组里编号为 0 的那个 Worker 会在启动时打印本组的指纹；指纹不同，就把两边配置按上面六组逐项比。
4. 指纹相同，再确认 A 那一侧确实登记成功、还在按时报平安。
5. 看同一把钥匙下的 seed 是不是都被别的实例占着。
6. 看两边是不是连到了同一个 Planner、同一份状态存储。
7. 以上都没问题，才当成正常的冷启动：本来就还没有任何 seed。

更完整的排错路线见[排错页](rfork-troubleshooting.md)。

## 放到 GLM 双机：一次热启动要配 32 把钥匙

这一节是推演，不是实测。工作版的代码树里没有 GLM-5.3-Flash 的模型实现，下面是把工作版的 RFork 加载器和固定镜像里的 GLM 模型放在一起推出来的，前提见[总览的 GLM 一节](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)。我们的部署是一个实例、两台机器、16 张卡，TP8 / DP2 / EP16 / W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。

**部署指纹里写了什么。** 切分那一组是：TP 大小 8，PP 大小 1，DP 大小 2，开了 EP，是 MoE 模型；EP 组大小那一栏照样是空的，16 这个数由 DP 2 × TP 8 隐含（prefill context parallel 我们的启动命令没设，取默认 1）。数值那一组里，量化方式记的是启动参数给的 ascend。所以要借给 B 的 seed 实例，必须同样是 TP8 / DP2 / EP16 / W8A8，用同一份 checkpoint，NZ 模式也相同（我们的启动命令没设，取默认值 1，即只有量化权重转成 NZ），否则指纹不同，Planner 配不上。

**每张卡的钥匙里写什么编号。** EP 组正好是全部 16 张卡、按全局编号排，所以组内编号就等于全局编号（分组见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。PP 只有一段，PP 编号记为空。

```calc
title: GLM 双机上，全局第 r 号卡的钥匙里写什么编号
TP 编号 = r mod 8
EP 编号 = r
PP 编号 = 空（PP 大小为 1）

第 9 号卡的 TP 编号 = 9 mod 8 = 1
第 9 号卡的 EP 编号 = 9
> 第 1 号卡是 TP 编号 1、EP 编号 1：两张卡 TP 编号相同，钥匙仍然不同
```

第 1 号卡和第 9 号卡的 TP 编号都是 1，attention 和稠密层存的是同一份切片；可它们各放 18 个不同的专家，EP 编号一个是 1、一个是 9，钥匙就不同。这正是 EP 编号要进钥匙的原因：要是只看 TP 编号，B 的第 9 号卡就可能借到 A 第 1 号卡上的专家。两张卡上专家张量的形状一样，后面的清单核对不一定拦得住（按代码推断）。所以 B 的第 r 号卡只能借 A 的第 r 号卡。

**一共多少把钥匙。** 主模型 16 把，MTP 草稿模型 16 把，一次热启动向 Planner 借 32 次（见总览的[谁向谁借](rfork.md#谁向谁借16-个-worker-各借各的主模型和草稿模型各一套)）。

**日志从哪看。** 打印指纹、报告「没有可用的 seed」的 info 日志，只在 TP 编号为 0 的 Worker 上打。我们的部署里就是全局第 0 号和第 8 号卡，各代表一个 DP 组；其余 14 张卡只打 debug。排错时先看这两张卡的日志，需要定位到具体某张卡时再打开 debug。

**第一次启动一定借不到。** 我们只有一个实例，DP2 是实例内部的两组，不是两个实例。第一次冷启动时没有任何 seed 登记过这 32 把钥匙，必然走回退（见总览的[能不能受益](rfork.md#这套部署现在能不能受益)）。

## 常见误解

- **「seed key 就是模型地址。」** 它是部署指纹、分片编号和角色合起来的 SHA256；模型地址只是其中一项，只比路径查不全。
- **「指纹相同，权重就完全一样。」** 指纹只说明配置上能不能互换，内容是否一致还要靠模型版本记录、清单核对和实测。
- **「EP16 写在指纹里。」** EP 组大小那一栏实际是空的；EP16 是由 TP 大小、DP 大小和「开了 EP」三项一起隐含的。
- **「两边全局编号一样才能借。」** 全局编号不进钥匙，它只用来算 seed 服务的端口（设了基础端口时）和在日志里标卡。
- **「从日志里能看出两边哪一项配置不同。」** 日志里只有哈希值，看得出不同，看不出差在哪。
- **「改了并发相关的配置，就一定要换 seed。」** 要看这个配置进没进指纹、会不会改变要传的张量。那块 top-k 工作区是专门排除掉的，不能推广成「所有并发差异都兼容」。

## 对照源码

### 怎么开

身份匹配本身没有开关，用 RFork 加载就会算。它需要三项配置：模型地址和部署策略名（写在 `model_loader_extra_config` 里，或用环境变量 `MODEL_URL`、`MODEL_DEPLOY_STRATEGY_NAME`），以及 Planner 地址（`rfork_scheduler_url`，或环境变量 `RFORK_SCHEDULER_URL`）。三项默认都是空串。建会话时先查 Planner 地址、再查模型地址和策略名，任何一项为空就抛 `ValueError`；这个报错会被 RFork 加载器接住，这张卡回退到默认加载，启动不会停下，回退后也不登记成 seed。`build_seed_key` 里还有一道同样的空值检查，正常流程走不到。全部客户端设置见[配置页](rfork-config.md)。[C28][C29]

想让某批实例单独成池（例如改了传输协议或张量采集规则后隔离旧 seed），换一个新的 `model_deploy_strategy_name` 即可，它同时进指纹和 seed key。[C3][I]

### 会报什么错

| 什么时候 | 原文（节选） | 意思和后果 |
|---|---|---|
| 建会话 | `ValueError: rfork_scheduler_url is required; configure it with model_loader_extra_config or RFORK_SCHEDULER_URL` | 没配 Planner 地址；被加载器接住后回退，见本表「接住上面几类」一行 |
| 建会话 | `ValueError: RFork requires non-empty model_url and model_deploy_strategy_name` | 模型地址或策略名缺一项；同样被接住后回退 |
| 算 seed key | `RuntimeError: RFork seed key is not set: model_url=..., model_deploy_strategy_name=...` | `build_seed_key` 里的兜底检查；建会话时已先查过这两项，正常流程到不了 |
| 算 seed key | `RuntimeError: RFork requires a compatibility fingerprint for the seed key` | 没先算指纹；正常流程不会出现 |
| 算指纹 | `ValueError: RFork fingerprint value contains a recursive reference` | 描述里有容器引用了自己；同样被接住后回退 |
| 取编号 | `RuntimeError: Expert parallelism is enabled, but the EP group is not initialized.` | 开了 EP、`is_moe_model` 不是 `False`（为 `None` 也照读），EP 组却没建好；被接住后回退 |
| 取编号 | `RuntimeError: Pipeline parallelism is enabled, but the PP group is not initialized.` | PP 大于 1，PP 组却没建好；被接住后回退 |
| 接住上面几类 | warning `RFork transfer failed: %s, clean up and fall back to default loader` | 算钥匙时的报错在这里被接住：会话还没建起来，直接走默认加载，启动不会停下，回退后不登记成 seed。借到以后传输出错也打这一句，但那时会话已建，要先清理，清理失败就中止，见下一行 |
| 回退前清理失败 | `RuntimeError: RFork fallback aborted because seed service or registered memory cleanup failed; tensor owners remain retained. Refusing to allocate a second model while old weights are pinned.` | 会话已建时，回退前的清理最多试 2 次，仍没停掉 seed 服务或没清掉已登记的内存，就拒绝再建一份模型，启动停下；详见[启动页](rfork-startup.md) |
| 问 Planner | debug `RFork planner has no available seed for seed_key=...` | `GET /get_seed` 回 404：这把钥匙下没有可用 seed，返回空 |
| 问 Planner | warning `RFork planner seed acquisition failed: ...` | 状态码既不是 200 也不是 404、`SEED_IP` / `SEED_PORT` / `USER_ID` / `SEED_RANK` 缺项、端口或 rank 不能转为整数、端口 ≤0 或 rank <0，统一捕获后返回空；端口大于 65535 在后续构造来源 URL 时才失败，走[传输失败分支](rfork-troubleshooting.md#会报什么错) |
| 拿到空以后 | 内部异常 `planner returned no compatible seed`，随后 `RFork has no available %s seed; loading locally and registering this worker as a seed.` | TP 编号为 0 的 Worker 打 info，其余打 debug；改从本地加载 |
| seed 一侧，首次登记 | warning `RFork seed service startup failed for global_rank=%s: planner rejected the initial seed advertisement`，随后 `RFork %s model loaded from %s is ready, but seed service startup failed; inference can continue.` | 起 seed 服务后第一次向 Planner 登记就没成功：这张卡照常推理，但不当 seed，心跳线程也不会起 |
| seed 一侧，之后的心跳 | warning `RFork heartbeat failed for seed_key=...` | 首次登记成功、心跳线程起来以后，某一次心跳没成功；示例 Planner 超过 60 秒没收到心跳就清掉这个 seed |

请求 Planner 时，请求头里只带 `SEED_KEY` 这一项；seed 登记和心跳用的也是同一把钥匙。[C7][C11]示例 Planner 在同一把钥匙下的 seed 都没有空余名额时，同样回 404，它不替客户端重新判断兼容性；请求头缺失或不合法回 400。[C8][C15]

**关于 `is_draft_worker`：** 这是保留的线上字段名。Python 形参叫 `is_draft_model`，写进被哈希的 JSON 时改叫 `is_draft_worker`，为的是和早先算出的 seed key 保持一致。它只存在于这段 JSON 里，Planner 的 HTTP 请求头里没有这个字段：去协议里找它会一无所获，但不代表角色没进钥匙。

### 开销和什么时候别开

- 指纹和 seed key 都只哈希配置描述，**不读权重、不算内容校验和、不含 RFork 代码提交号**，开销可以忽略，代价是它证明不了内容一致。[D]
- `max_num_batched_tokens` 没有进指纹；相关的 `topk_indices_buffer` 留在本地不传，原因见[张量布局](rfork-layout.md)。不要为绕过形状报错，把不匹配的字段从指纹里删掉。
- 修改传输协议、张量采集规则或派生权重语义后，应隔离旧 seed；换新部署策略名只是运维隔离，不能代替一致性测试。[I]
- 只有一个实例的部署，第一次启动一定借不到，钥匙算得再对也没有 seed 可配。

### 版本差异

- **v0.23**（社区维护分支 2c59ff10；含 GLM 代码的固定镜像 db701c1f 的 RFork 目录与它相同）：没有部署指纹。seed key 是把模型地址、策略名、PD 角色、节点编号、PP / TP / EP 编号和草稿标记直接拼成的明文，含节点编号，不含数值类型、量化方式和并行大小。
- **v0.26**（2ed6cbba）：与 v0.23 相同。
- **main**（baa023ad）：与 v0.23 相同。社区 main 只合进了工作版的前三个补丁，带身份指纹的那个补丁没有合。
- **v0.30.0rc2**（7d825229）：已有独立 identity 模块。配置指纹含协议、解析后的模型 revision、量化摘要、架构、RoPE、KV 角色与 mix placement 等信息；模型准备后再加入可传张量的名字、shape、dtype、NPU format 组成的结构摘要，最后结合 TP/PP/EP 编号、主草角色及必要的 DP 分片编号生成 key。结构摘要不读取权重内容，因此仍不能充当逐字节校验和。
- **RFork 工作版**（rfork@3284850b，Dockerfile 配 vLLM v0.26.0）：本页讲的两次 SHA256，不含节点编号。`is_draft_worker` 字段名为兼容旧钥匙而保留，改名会让新旧实例算出的钥匙对不上。

rc2 中 fine-grained TP，或 DP>1 且模型为 MoE（无法确定是否 MoE 时也按需隔离），会将 DP rank 记入 sharded_dp_rank；普通复制 DP 保持空。例子中两张卡虽然都是 TP rank 0，若分属持有不同专家的 DP rank 0/1，新增字段就防止把两份不同分片放进同一候选池。因此“DP 只复制、从不进 key”不能作为 rc2 的通则。判定在 identity.py 257–293，loader 514–522 实际传入该值；配置与结构摘要的固定源码链接见[总览对照](rfork.md#版本差异)。

### 源码位置

指纹描述的精确字段（`build_compatibility_fingerprint`，identity.py 196–251 行）：

| 组别 | 字段 |
|---|---|
| 模型标识 | `model_url`、`model_deploy_strategy_name` |
| 模型版本 | `model_revision`（`_get_model_revision`） |
| 数值表示 | `dtype`、`quantization`、`quantization_config`（`_get_quantization_config_digest` 的摘要） |
| 模型结构 | `architecture`：`hf_config` / `hf_text_config` 的 `model_type`、`architectures`、`config_type`（模块路径 + 类名） |
| 并行布局 | `parallel`：`tensor_world_size`、`pipeline_world_size`、`expert_world_size`、`data_world_size`、`expert_parallel_enabled`、`is_moe_model` |
| 昇腾布局 | `weight_layout`：`weight_nz_mode`、`hardware_policy`（硬件 profile 的 `weight_layout_policy`） |

指纹用 `json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=True)` 序列化后取 `hashlib.sha256`；seed key 的描述（`build_seed_key`，254–287 行）是 `compatibility_fingerprint`、`model_url`、`model_deploy_strategy_name`、`tp_rank`、`pp_rank`、`ep_rank`、`is_draft_worker` 七项，序列化时 `ensure_ascii=False`。

| 位置 | 内容 |
|---|---|
| identity.py 32–104 | `_canonicalize_fingerprint_value`：字典按键排序、集合定序、`torch.dtype` 转字符串、Enum 取名字、非有限浮点转字符串，自引用抛 `ValueError` |
| identity.py 107–142 | `_get_hf_config_descriptor`：模型结构一组 |
| identity.py 145–157 | `_get_model_revision`：显式 `revision`、`model_revision`，再看 `hf_config` / `hf_text_config` 的 `_commit_hash` / `commit_hash` / `revision`，都没有为 `None` |
| identity.py 160–167 | `_get_parallel_world_size`：依次找给定属性名，找不到用默认值；EP 组大小找 `expert_parallel_size`、`ep_size`，默认 `None` |
| identity.py 170–194 | `_get_quantization_config_digest`：只取 `hf_quant_config` 或 `hf_config.quantization_config` |
| rfork_loader.py 73–80 | 汇总 rank：`tp_rank == 0`；`main` / `draft` 的取法 |
| rfork_loader.py 112–150 | 草稿判定：`runner_type == "draft"`，或 model type 以 `_mtp` 结尾、architecture 以 `MTPModel` 结尾；主 / 草稿分别存在 `rfork_session` / `rfork_draft_session` |
| rfork_loader.py 153–172 | `_get_ep_rank`、`_get_pp_rank`：取组内编号，组没建好抛 `RuntimeError` |
| rfork_loader.py 441–485 | `_ensure_rfork_session`：取全局 / TP / PP / EP 编号与角色，算指纹；`tp_rank == 0` 时 info 打印指纹 |
| rfork_loader.py 614–650 | 拿到空 → `_RForkSeedUnavailable` → 改从本地加载的日志 |
| rfork_loader.py 563–577 | 先建会话（算指纹和钥匙），再 `initialize_model` 搭空模型；问 Planner 在搭完之后（612 行） |
| rfork_loader.py 582–591 | 草稿权重全部与主模型共用时直接复用，不问 Planner |
| rfork_loader.py 652–710 | 其他报错统一 warning「RFork transfer failed …」后回退；会话为空时回退后不起 seed 服务 |
| rfork_loader.py 657–671、types.py 45–49 | 会话已建时回退前清理最多 2 次（`FALLBACK_CLEANUP_MAX_ATTEMPTS`，59 行）；`can_schedule_seed` 为假（seed 服务没停或内存没清）就抛 `RFork fallback aborted …` |
| session.py 386–419、rfork_loader.py 96–110 | 首次登记 `report_seed_once` 失败抛 `planner rejected the initial seed advertisement`，被接住打 `RFork seed service startup failed …`，外层再打 `… seed service startup failed; inference can continue.`；心跳线程在首次登记成功之后才起 |
| ascend_config.py 262–269、envs.py 88 | `weight_nz_mode` 取 `additional_config` 或 `VLLM_ASCEND_ENABLE_NZ`，默认 1（只有量化权重转 NZ） |
| session.py 37–48 | 建会话时先查 `planner_url`、再查 `model_url` 与 `model_deploy_strategy_name`，为空抛 `ValueError`；都过了才构造 Planner 客户端（48 行） |
| config.py 100–110 | `model_url`、`model_deploy_strategy_name`、`planner_url`（`rfork_scheduler_url` / `RFORK_SCHEDULER_URL`）默认都是空串 |
| planner_client.py 45–67 | 构造 seed key；`_require_planner` 也查 Planner 地址，但建会话时已先查过，正常流程到不了 |
| planner_client.py 69–109 | `acquire_seed`：404 → 空；其他错误 → warning 后返回空 |
| planner_client.py 246–264 | 心跳循环：失败时 warning 带 seed key |
| session.py 360–370 | seed 服务端口 = `seed_port_base` + `global_rank`（基础端口大于 0 时）；基础端口为 0 时由系统随机分配 |
| examples/rfork/rfork_planner.py 69–74 | 示例 Planner 默认值：心跳超时 60 秒、每个 seed 1 个名额 |
| examples/rfork/rfork_planner.py 45–50、115–124、192–213 | 只在同一把钥匙下挑有余量的 seed；`alloc_policy` 默认 `fifo`（挑 `last_heartbeat_ts` 最早的），可配 `lru`（挑最久没被借过的） |
| examples/rfork/rfork_planner.py 251–256、449–458 | 挑之前清掉心跳超时的 seed；头信息不合法回 400，查不到回 404 |
| Dockerfile 53–54 | 工作版配套 vLLM：`VLLM_TAG=v0.26.0` |
| vLLM v0.26.0 config/parallel.py 159–163 | `ParallelConfig` 有 `is_moe_model`，没有 `expert_parallel_size` / `ep_size` |
| vLLM v0.26.0 config/vllm.py 946–951 | `is_moe_model` 取自 `model_config.is_moe` |
| vLLM v0.26.0 distributed/parallel_state.py 1893–1906 | EP 组大小 = DP × PCP × TP，稠密模型不建 EP 组 |

来源与结论的对应：

- 指纹六组字段、模型版本的查找顺序、量化摘要的取值范围与序列化，对照第 2、3 项来源；NZ 模式默认 1，对照第 26、27 项；seed key 七项与缺配置报错，对照第 4、10 项。[C3]
- 规范化与自引用报错，对照第 1 项。[C1]
- 草稿判定、草稿全部共用时直接复用、EP / PP 编号的读取条件与报错，对照第 5、24 项。[C5]
- 会话建立、指纹的 info 日志，对照第 6 项；汇总 rank 只看 TP 编号 0，对照第 21 项。[C6]
- seed 服务端口用全局编号，对照第 9 项。[C9]
- 建会话时三项配置的空值检查与默认空串，对照第 28、29 项；借 seed 的状态码分支、心跳警告，对照第 7、10、11 项。[C7]
- 拿到空以后改从本地加载的日志，对照第 20 项；先算钥匙再搭空模型、算钥匙时的报错被接住后回退且不起 seed 服务、会话已建时清理失败中止启动，对照第 22、23、32 项；seed 首次登记失败与之后的心跳警告，对照第 31、33、11 项。[C20]
- 示例 Planner 的挑选（默认 fifo）、默认值、清理与 400 / 404，对照第 8、12–15、25 项。[C8]
- 工作版配 vLLM v0.26.0、EP 组大小一栏为空、`is_moe_model` 的来源、EP 组大小的公式，对照第 16–19 项；prefill context parallel 默认 1，对照第 30 项。[C19]
- GLM 双机每卡编号与 32 把钥匙，由 01 底稿 A0.8「在我们部署下的具体数字」与 D 页分组推出。[D]
- 只差 prefill context parallel 时指纹分不出、transformers 换模块路径会改变指纹、第 9 号卡错借第 1 号卡专家时清单可能拦不住，均为按代码推断。[I]

待核：

1. 我们这份 GLM-5.3-Flash W8A8 权重的 config.json 里有没有量化字段。缺：权重目录里的 config.json。这决定 ModelSlim 的逐层精度描述有没有进指纹。
2. 生产环境 Planner 的匹配规则和状态码。缺：生产 Planner 的代码或接口文档；本页的 404 / 400 与 60 秒都来自仓库里的示例 Planner。
3. 我们部署下硬件排布策略（`weight_layout_policy`）的实际取值。缺：启动日志或硬件 profile 的实际值。NZ 模式已核：启动命令没设，取默认 1。
4. GLM 的 MTP 草稿模型配置里模型类型、架构名的实际取值，以及草稿指纹是否与主模型不同。缺：工作版与 db701c1f 合并后的启动日志。
5. 第 9 号卡若错借第 1 号卡的专家，清单核对能否拦住。缺：两张卡专家张量的名字与形状清单。
6. 只差 prefill context parallel 大小、或 transformers 版本不同的两个实例，指纹是否真的相同 / 不同。缺：实测。
