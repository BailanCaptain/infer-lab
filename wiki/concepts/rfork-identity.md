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
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L33-L108'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L111-L180'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L182-L264'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L267-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L206-L307'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L674-L746'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L137-L195'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L207-L229'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L48-L53'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L38-L114'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L660-L719'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L68-L80'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L117-L133'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L289-L333'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L497-L516'
  - 'vllm-ascend@8d6180e2:Dockerfile#L34-L35'
  - 'vllm@568afb3a:vllm/config/parallel.py#L159-L163'
  - 'vllm@568afb3a:vllm/config/vllm.py#L946-L951'
  - 'vllm@568afb3a:vllm/distributed/parallel_state.py#L1893-L1906'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L833-L889'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L153-L204'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L775-L815'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L890-L957'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L115-L143'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L44-L52'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L718-L765'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L43-L69'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L75-L87'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/config.py#L88-L192'
  - 'vllm@568afb3a:vllm/config/parallel.py#L124-L124'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L588-L659'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/types.py#L68-L95'
  - >-
    raw:sha256-79ca37c7a3b1178b525522ff58d26020480d15d150e5e780e3c5f5922ac561fa.md#L1-L865
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/identity.py#L219-L339'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/tensor_layout.py#L42-L61'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L498-L524'
verified:
  - main
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
updated: '2026-11-19'
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
> 钥匙这三行的示意描述键名是 compatibility_fingerprint、tp_rank、is_draft_model（当前主线正式键名，另含 structural_digest 等字段），指纹按完整 64 位代入
```

从这几行能看出三件事。第一，同样的输入必然得到同样的钥匙，所以 A 和 B 不用商量，各算各的就能对上。第二，改任何一项，结果都完全不同，没有「差不多」：B 用 float16、A 用 bfloat16，哪怕两种类型每个数都占 2 字节，也配不上。第三，从两串哈希值看不出差在哪一项。日志里只打印哈希值、不打印描述原文，排错时想知道差在哪，得把两边的配置逐项摆出来比。

分两次算还有一个好处：指纹描述的是整套部署，同一个实例里主模型的每张卡算出的指纹都一样，编号和角色到第二次才加进去。排错时可以先比指纹：指纹就不同，说明部署配置不一样，跟哪张卡无关；指纹相同而钥匙不同，再去看编号和角色。

## 部署指纹里写了什么

在 `main` 主基线中，**配置指纹（compatibility fingerprint）**专门覆盖“会改变权重数值内容、却不一定会改变张量形状”的配置，按意思分七项；其余会改变张量形状、dtype 或 NPU 存储格式的配置（如权重 dtype、TP/PP/EP 切分尺寸、NZ 与融合 MC2 开关、量化后处理结果、草稿拓扑）则由**结构摘要（structural digest）**直接对模型已登记的可传张量清单取哈希来自动捕获。任何一项两边不一样，`seed_key` 就会不同，A 和 B 落进两个池子。

| 组别 | 放进去的内容 | 排错时要注意 |
|---|---|---|
| 协议与模型标识 | `rfork_protocol_version`（当前为 1）、`model_url`、`model_deploy_strategy_name` | 用来区分协议与池子的文字，RFork 不会拿 `model_url` 去下载；写法差一个字符就分池 |
| 模型版本 | `model_revision`：优先取 `hf_config` / `hf_text_config` 解析后的 `_commit_hash` / `commit_hash`，再回退 `model_config.revision` / `model_revision` 与 `hf_config.revision` | 本地目录往往没有提交号，两边都为空也算「相同」，不能拿它证明内容一样 |
| 量化配置摘要 | `quantization_config`：对 `hf_quant_config` 或 `hf_config.quantization_config` 规范化后取 SHA256 | 只读模型配置里的量化字段，不读取 ModelSlim 外部文件 |
| 模型结构与 RoPE | `architecture`（模型类型与架构列表）、`rope`（RoPE 缩放/theta 等配置规范化描述） | 草稿模型按自己的模型配置算，通常与主模型不同 |
| 昇腾布局语义 | `weight_layout` 下的有效 `kv_role`（P/D 角色会影响 SFA/MLA 派生权重）与 `mix_placement`（可能在不改形状下重排专家） | P/D 角色或 `mix_placement` 不同会导致指纹不同 |
| 张量结构摘要（第二层） | 在目的显存登记时对全部可传张量的稳定 ID、形状、dtype、NPU 存储格式取 SHA256 | 自动覆盖权重 dtype、TP/PP/EP 大小、NZ 模式与硬件策略；仍不读取权重字节内容 |

**描述要先整理成固定的样子。** 算之前会把描述规范化：字典按键名排序（若不同键规范化出相同标签直接抛 `ValueError`），集合排成固定顺序，数值类型写成 `torch.bfloat16` 这样的固定字符串，枚举只取名字，不写进进程地址之类每次运行都会变的东西。描述里如果有容器引用了自己，规范化会直接报错，而不是无限展开下去。

**模型版本按固定顺序找。** 优先取已解析的提交哈希（`_commit_hash` / `commit_hash`），因为分支或标签名可能移动；取不到再看显式 `revision` / `model_revision` 与配置对象上的 `revision`。这只是「记下写了什么版本」，并没有去核对模型文件本身。

**量化配置的摘要只看模型配置里的量化字段。** 昇腾上的 W8A8 权重通常由 ModelSlim 工具产出，每一层用什么精度，写在模型目录里单独的一份描述文件里；指纹不读那份文件。所以逐层精度有没有进指纹，取决于模型配置文件本身带不带量化字段。我们这份权重属于哪种情况，列在页末待核。

## 分片编号和角色：要的是其中哪一份

配置指纹和结构摘要说明「结构与语义能不能互换」，但一个实例切成几份时，B 的每张卡要的只是其中一份。所以 `seed_key` 在两层摘要之外，还放进分片编号和主 / 草稿角色（模型地址和策略名也再放一次）。

| 身份 | 进不进钥匙 | 为什么 |
|---|---|---|
| TP 编号（`tp_rank`） | 直接进 | 同一个矩阵的不同切片放在不同卡上 |
| PP 编号（`pp_rank`） | PP 分了不止一段时才进，否则记为空 | 不同段放的是不同的层 |
| EP 编号（`ep_rank`） | 开了 EP、且模型没被标成「不是 MoE」时才进 | 不同卡放的是不同的专家 |
| DP 分片编号（`sharded_dp_rank`） | 仅当权重内容跨 DP 切分时进入（fine-grained TP 任一并行度 `> 1`，或 `data_parallel_size > 1` 且模型非明确稠密）；普通复制 DP 记为空 | 防止跨 DP 切分专家或模块的不同内容误入同一池，同时让纯复制 DP 继续共享池 |
| 主 / 草稿（`is_draft_model`） | 直接进 | 两份不同的权重，清单不能混 |
| 全局编号（`global_rank`） | 不进；seed 服务的端口用它算（设了非零基础端口时为 `base + 2 × global_rank + 角色槽`，主模型 0、草稿 1，基数为 0 时由系统随机分配），日志里也用它标卡 | 不该拿「是第几号进程」限制跨实例借用 |
| 节点 IP | 不进 | 同配置跨节点实例可以互借；有效 `kv_role` 已进入兼容性指纹 |

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

身份匹配本身没有开关，用 `--load-format rfork` 加载就会算。它需要三项配置：`model_url`（或环境变量 `MODEL_URL`）、`model_deploy_strategy_name`（`MODEL_DEPLOY_STRATEGY_NAME`）与 `rfork_scheduler_url`（`RFORK_SCHEDULER_URL`）。三项默认空串；建会话时任何一项为空均抛 `RForkConfigurationError`，该异常不被回退保护吞掉，直接中止启动。[C28][C29][C23] 全部客户端设置见[配置页](rfork-config.md)。

想让某批实例单独成池（例如改了传输协议或张量采集规则后隔离旧 seed），换一个新的 `model_deploy_strategy_name` 即可，它同时进配置指纹和 `seed_key`。[C3][I] 若需在 Planner 请求头里附带可读模型元数据，可设 `rfork_model_identity_headers: true`（或 `RFORK_MODEL_IDENTITY_HEADERS=1`），向每次请求附加 `MODEL_URL`、`DEPLOY_STRATEGY`、`IS_DRAFT`（要求 ASCII）。

### 会报什么错

| 什么时候 | 原文（节选） | 意思和后果 |
|---|---|---|
| 建会话 | `RForkConfigurationError: rfork_scheduler_url is required; configure it with model_loader_extra_config or RFORK_SCHEDULER_URL` | 没配 Planner 地址；**直接中止启动**（不回退） |
| 建会话 | `RForkConfigurationError: RFork requires non-empty model_url and model_deploy_strategy_name` | 模型地址或策略名缺一项；**直接中止启动** |
| 算 `seed_key` | `RuntimeError: RFork seed key requires a bound structural digest` | 未经 `register_destination` 绑定结构摘要就访问 `seed_key` |
| 算指纹 | `ValueError: RFork fingerprint value contains a recursive reference` / `RFork fingerprint dict has distinct keys with one label` | 描述自引用或不同键规范化冲突；被回退保护接住后回退 |
| 取编号 | `RuntimeError: Expert parallelism is enabled, but the EP group is not initialized.` / `Pipeline parallelism is enabled, but the PP group is not initialized.` | 开了 EP 或 PP>1 但对应并行组未建好；被接住后回退 |
| 回退前清理失败 | `RuntimeError: RFork fallback aborted because seed service or registered memory cleanup failed; tensor owners remain retained. Refusing to allocate a second model while old weights are pinned.` | 会话已建时回退清理最多试 2 次仍未清净，拒绝再建模型 |
| 问 Planner | debug `RFork planner has no available seed for seed_key=...` | `GET /get_seed` 回 404：这把钥匙下没有可用 seed，返回空 |
| 问 Planner | warning `RFork planner seed acquisition failed: ...` | 状态码非 200/404、响应头缺项、端口（`<=0` 或 `>65535`）/rank/可选 `LEASE_TTL_SEC` 非法，统一捕获后返回空 |
| 拿到空以后 | 内部异常 `planner returned no compatible seed`，随后 `RFork %s seed acquisition was unsuccessful; loading locally.` | TP 编号为 0 的 Worker 打 info，其余打 debug；走本地加载（`source=local`） |
| seed 首次登记被拒 | warning `RFork seed service startup failed for global_rank=%s: planner rejected the initial seed advertisement: ...` | 永久拒绝（`REJECTED`）时不当 seed；若为暂态 `RETRYABLE` 则保持 `SERVING` 由心跳线程后台重试 |
| seed 心跳暂态失败 | warning `RFork planner seed heartbeat is temporarily unavailable for seed_key=...` | 连续失败持续后台重试；收到 `REJECTED` 或服务退出则停止心跳并按配置尝试撤回 |

请求 Planner 时默认带 `SEED_KEY` 请求头（开启 `rfork_model_identity_headers` 后另附 `MODEL_URL`/`DEPLOY_STRATEGY`/`IS_DRAFT`）。[C7][C10] `main` 主基线已将草稿标记字段名统一为 `is_draft_model`（早期工作分支曾保留旧名 `is_draft_worker`）。[C4]

### 开销和什么时候别开

- 配置指纹和结构摘要都只哈希配置与张量清单元数据，**不读权重字节、不算内容校验和、不含 RFork 代码提交号**，开销极小，代价是证明不了内容一致。[D]
- `max_num_batched_tokens` 没有进指纹；相关的 `topk_indices_buffer` 与 RoPE 派生缓存留在本地不传，原因见[张量布局](rfork-layout.md)。不要为绕过形状报错而随意删字段。
- 修改传输协议、张量采集规则或派生权重语义后，换新 `model_deploy_strategy_name` 隔离旧 seed，并做输出一致性测试。[I]
- 只有一个实例的部署，第一次启动必然未命中，钥匙算得再对也没有 seed 可配。

### 版本差异

| 维度 | `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|
| `seed_key` 构成 | 明文拼接（模型地址、策略名、PD 角色、节点号、PP/TP/EP、草稿），无指纹与结构摘要 | 协议 + 配置指纹 + 结构摘要 + TP/PP/EP/`sharded_dp_rank` + `is_draft_model` | 同 `v0.30.0` |
| `sharded_dp_rank` 判定 | 无此字段 | fine-grained TP 按 `size > 0` 判断，或 MoE 且 `data_parallel_size > 1` | 统一为 `size > 1`（PR `#20111`，`0` 与 `1` 均表示关闭） |
| 可读身份请求头 | 无 | 无 | 新增 `rfork_model_identity_headers`（默认关）可选附带 `MODEL_URL`/`DEPLOY_STRATEGY`/`IS_DRAFT` |

固定镜像 `db701c1f` 与 `v0.23.0` 一致；旧开发快照 `baa023ad` 仍无独立 `identity.py`；早期独立工作分支曾用旧字段名 `is_draft_worker` 且无结构摘要。完整对照见[总览对照](rfork.md#版本差异)。

### 源码位置

以下路径相对 `vllm-ascend@8d6180e2`（除另注外均在 `vllm_ascend/model_loader/rfork/`）：

- 配置指纹（`build_compatibility_fingerprint`，`identity.py#L229-L264`）：`rfork_protocol_version`、`model_url`、`model_deploy_strategy_name`、`model_revision`、`quantization_config`、`architecture`、`rope`、`weight_layout`（`kv_role` + `mix_placement`），规范化 JSON 后取 SHA256。[C3]
- 结构摘要（`build_structural_digest`，`tensor_layout.py#L43-L69`）：对登记扫描得到的全部可传张量（ID、shape、dtype、NPU format）取 SHA256；经 `session.register_destination`（`session.py#L115-L143`）绑定到 `planner_client.bind_structural_digest`。[C27][C24]
- `seed_key`（`build_seed_key`，`identity.py#L306-L349`）：`compatibility_fingerprint`、`structural_digest`、`model_url`、`model_deploy_strategy_name`、`tp_rank`、`pp_rank`、`ep_rank`、`sharded_dp_rank`、`is_draft_model` 九项，规范化 JSON 后取 SHA256。[C4]

| 位置 | 内容 |
|---|---|
| `identity.py#L33-L108` | `_canonicalize_fingerprint_value`：排序、定序、类型规范化、自引用与歧义键抛 `ValueError` [C1] |
| `identity.py#L111-L180` | `_get_architectures_descriptor`、`_get_rope_config_descriptor`、`_get_model_revision` [C2] |
| `identity.py#L182-L226` | `_get_effective_kv_role`、`_get_quantization_config_digest` [C3] |
| `identity.py#L267-L303` | `_resolve_sharded_dp_rank`：fine-grained TP（`size > 1`）或 MoE 且 `DP > 1` 时取 `data_parallel_rank` [C4] |
| `rfork_loader.py#L153-L204`、`#L206-L307` | 汇总 rank（`tp_rank == 0`）、草稿判定、`_build_rfork_identity`、`_get_ep_rank` / `_get_pp_rank` [C5][C21] |
| `rfork_loader.py#L674-L746`、`#L775-L957` | `_ensure_rfork_session`、先登记绑定结构摘要后申请租约、共享复用与回退保护 [C6][C20][C22][C23] |
| `session.py#L48-L53`、`#L75-L87`、`#L588-L719` | 双槽端口 `_resolve_seed_server_port`、必填项 `RForkConfigurationError`、首次登记与心跳重试 [C9][C28][C11][C31] |
| `planner_client.py#L38-L114`、`#L137-L195` | `bind_structural_digest`、`seed_key`、`acquire_seed` 与可读身份头 [C7][C10] |
| `examples/rfork/rfork_planner.py#L44-L80`、`#L117-L133`、`#L207-L229`、`#L289-L333`、`#L497-L516` | 示例 Planner 默认值、`fifo`/`lru` 挑选、draining 清理与 400/404 [C8][C12][C13][C14][C15][C25] |
| `vllm_ascend/ascend_config.py#L718-L765`、`Dockerfile#L34-L35` | `weight_nz_mode` 默认 1、上游主线 Dockerfile 配套 `VLLM_TAG=v0.33.0` [C16][C26] |

待核：

1. 我们这份 GLM-5.3-Flash W8A8 权重的 `config.json` 里有没有量化字段，决定 ModelSlim 逐层精度描述是否进指纹。
2. 生产环境 Planner 的匹配规则、状态码与是否支持 `LEASE_TTL_SEC` 续期。
3. 合并部署下硬件排布策略（`weight_layout_policy`）与 MTP 草稿配置的实际结构摘要及日志值。
