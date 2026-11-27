---
id: rfork-identity
title: RFork 身份匹配：同模型、同布局，还要同一份分片
type: feature
summary: >-
  B 的每张卡凭一把 seed key 向 Planner 找 seed：先将协议、模型与策略标识、版本、量化配置摘要、架构/RoPE
  和布局语义算成配置指纹，再从目的显存登记清单算出张量结构摘要，最后把两者与分片编号及主/草稿角色合成 SHA-256 键（256 bit，64
  个十六进制字符）。配置与结构摘要不读权重字节，同形状不同权重内容仍需部署方核实。
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
  - structural_digest
  - RFork 结构摘要
  - sharded_dp_rank
  - model_deploy_strategy_name
  - seed_key
  - seed key
  - 匹配键
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
  - to: rfork-startup
    kind: builds-on
    note: 先看清启动十步把目的显存登记与结构摘要绑定排在借租约之前，再理解 seed_key 何时生成
  - to: tensor-parallel
    kind: builds-on
    note: 钥匙里的 TP 编号对应的就是 TP 把矩阵切成的那一份
  - to: expert-parallel
    kind: builds-on
    note: EP 编号区分每张卡放的是哪几个专家
  - to: ascend-model-onboarding
    kind: builds-on
    note: 配置指纹里的模型架构、量化描述与版本来源均取自标准模型上线的配置体系
  - to: cann-hccl
    kind: builds-on
    note: TP / PP / EP 并行组未初始化时会直接触发取编号失败回退，分片编号与底层通信组拓扑一一对应
contradicts: []
legacyAnchors:
  钥匙怎么算两次-sha256: 钥匙怎么算配置指纹结构摘要与最终键
  放到-glm-双机一次热启动要配-32-把钥匙: tp-编号相同为何仍不能互借专家分片
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

钥匙由三层信息按序合成：

- **配置指纹（compatibility fingerprint）**：两边配置语义一不一样，包括协议版本、模型与策略标识、模型版本、量化配置摘要、模型架构与 RoPE，以及影响派生权重或专家排列的昇腾布局语义（`kv_role`、`mix_placement`）。
- **张量结构摘要（structural digest）**：两边本卡可传张量的物理结构一不一样。空模型搭好并登记目的显存时，按全部可传张量的稳定 ID、形状、数值类型（`dtype`）与 NPU 存储格式生成摘要，自动覆盖 TP/PP/EP 切分尺寸与 NZ 格式结果。
- **分片编号与角色**：这张卡要的是哪一份，以及是主模型还是草稿模型。编号包含 `tp_rank`、按条件进入的 `pp_rank` / `ep_rank` / `sharded_dp_rank`；开了 [speculative decoding](speculative-decoding.md)（先由草稿模型猜出后面几个 token，再由主模型一次验证）时，主模型和草稿模型各有一把钥匙。

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
| 配置指纹 + 结构摘要 | 两边模型语义、切分形状与 NPU 存储格式能不能互换 | 本页 |
| `seed_key` | 要的是其中哪一个分片，主模型还是草稿 | 本页 |
| 清单核对 | 每个张量的名字、形状、类型、NPU 格式与字节数对不对得上 | [传输与内存](rfork-transfer.md) |
| 租约 | 这个 seed 此刻能不能借给你 | [租约与生命周期](rfork-lifecycle.md) |

## 钥匙怎么算：配置指纹、结构摘要与最终键

每一层摘要都使用 SHA-256：把任意一段规范化文本压成固定 **256 bit** 的摘要，写成十六进制是 **64 个字符**。同样的输入永远得到同样的输出；输入哪怕只改一个字符，输出也会整个变样，而且从输出无法反推原文。

从输入到最终配对键依次走三步：

1. **先算配置指纹（`compatibility_fingerprint`）。** 把协议版本、模型与策略标识、模型版本、模型结构、RoPE 与布局语义写成按键名排序且无空格的 JSON（若模型配置中带量化字典，还会先对该字典单独算一次 SHA-256 摘要放入 `quantization_config`），再算 SHA-256。
2. **再从登记清单算结构摘要（`structural_digest`）。** 待空模型建好、完成布局准备并向传输引擎登记目的显存时，把本卡全部可传张量的稳定 ID、形状、`dtype` 和 NPU 存储格式写成规范化清单，算一次 SHA-256。
3. **最后把两者与分片和角色合成键（`seed_key`）。** 将配置指纹、结构摘要、模型地址、部署策略名、分片编号（`tp_rank` / `pp_rank` / `ep_rank` / `sharded_dp_rank`）和 `is_draft_model` 写成排序无空格 JSON，算最终 SHA-256。

下面用一份**三键简化玩具输入**演示规范化 JSON 与 SHA-256 的雪崩效应（真实主线里的 `dtype` 与并行切分尺寸在结构摘要层捕获，`seed_key` 还含 `structural_digest` 等字段；这里固定三键无空格排序 JSON，便于读者直接复算前 12 位十六进制）：

| 场景（三键排序无空格 JSON 示意） | 实际哈希输入 | SHA-256 前 12 位 |
|---|---|---|
| A 的简化指纹 | `{"dtype":"torch.bfloat16","model_url":"demo/model","tensor_world_size":2}` | `89f742e1f557…` |
| 只换数值类型 | `dtype` 改为 `"torch.float16"`（其余同 A） | `12e7efe7fe5f…` |
| 只换 TP 大小 | `tensor_world_size` 改为 `4`（其余同 A） | `9de863023bcd…` |
| A 卡 0 主模型简化钥匙 | `{"compatibility_fingerprint":"89f742e1f557...f5ef","is_draft_model":false,"tp_rank":0}` | `dede34effc6f…` |
| A 卡 1 主模型简化钥匙 | 同上完整 64 字符指纹，`tp_rank` 改为 `1` | `02326ee44ee1…` |
| 只把角色换成草稿 | 同卡 0，`is_draft_model` 改为 `true` | `f224feb19fec…` |

$$\text{seed\_key} = \text{SHA256}(\text{canonical\_json}(\text{compatibility\_fingerprint},\ \text{structural\_digest},\ \text{ranks},\ \text{is\_draft\_model},\ \dots))$$

上表后三行按 `compatibility_fingerprint`（代入 A 的完整 64 字符十六进制串 `89f742e1f557c60422beb58b6a52b43aac5fa4d7f08ef208d8f0c48e62f3f5ef`）、`is_draft_model`、`tp_rank` 三键排序无空格 JSON 复算；真实主线的 `build_seed_key` 在此基础上还包含 `structural_digest`、`model_url`、`model_deploy_strategy_name`、`pp_rank`、`ep_rank` 与 `sharded_dp_rank` 六项。

从这几行能看出三件事。第一，同样的输入必然得到同样的钥匙，所以 A 和 B 不用商量，各算各的就能对上。第二，改任何一项，结果都完全不同，没有「差不多」：`torch.float16` 与 `torch.bfloat16` 哪怕每个数都占 2 字节，哈希也完全不同。第三，从两串哈希值看不出差在哪一项。日志里只打印哈希值、不打印描述原文，排错时想知道差在哪，得把两边的配置与布局摘要逐项摆出来比。

分层计算还有一个排错好处：同一个实例里主模型的每张卡算出的配置指纹相同，结构摘要体现本卡张量清单，分片编号和角色最后才并入 `seed_key`。排错时可以先比配置指纹，再比结构摘要，最后核对分片编号和角色。

## 部署指纹里写了什么

在 `main` 主基线中，**配置指纹（compatibility fingerprint）**覆盖「会改权重数值语义、却未必改张量形状」的配置；其余会改变形状、`dtype` 或 NPU 存储格式的配置（如权重 `dtype`、TP/PP/EP 切分尺寸、NZ 与融合 MC2 开关、量化后处理结果、草稿拓扑；运行期设备排布与流同步边界见 [CANN Runtime 与任务下发调优](ascend-runtime-and-tuning.md)，不同量化快照的层精度差异见[双机部署页](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)），则由**结构摘要（structural digest）**在预登记显存时对全部可传张量清单取哈希来捕获。任何一项两边不同，`seed_key` 就会不同，A 和 B 自动分池：

```wiki-diagram
file: rfork-fig-two-layer-hash
```

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

取 PP 编号或 EP 编号时，如果对应的并行组（由底层 [CANN 与 HCCL](cann-hccl.md) 在 Worker 启动早期建立）还没建好，会抛出 `RuntimeError`，不会悄悄记成空。这类可恢复异常会被 RFork 加载器接住：打一条「传输失败、清理后回退到默认加载」的警告，改从存储加载（依赖标准[新模型上线](ascend-model-onboarding.md)的磁盘加载路径可用），启动不会停下；因为这时会话还没建起来，这张卡回退后不会登记成 seed。注意这与建会话时缺少三项必填配置不同——后者会抛 `RForkConfigurationError` 直接中止启动，不走回退（完整先后见[启动路径](rfork-startup.md)）。

**怎么判断自己是草稿。** 模型配置里的运行类型写明是草稿，或者模型类型以「_mtp」结尾、架构名以「MTPModel」结尾，满足一条就算。主模型和草稿模型在同一个 Worker 里各开一个会话，各算各的指纹和钥匙。有一个例外：草稿模型的权重如果全都和已经加载好的主模型共用，草稿就直接复用主模型那一份，不去问 Planner，也不多借一次。GLM 的 MTP 层有自己的权重，不属于这种情况。

## 一个实例的几张卡，各借各的

假设 B 用四张卡（TP4）。B 的四个 Worker 各拿自己的钥匙去问 Planner，没有「整份模型从某一个实例拿」这样一次性的选择。Planner 每次只看这一把钥匙：在登记了这把钥匙、还有空余名额的 seed 里挑一个。仓库自带的示例 Planner 每个 seed 默认只有 1 个名额；默认的挑法是 fifo，挑最后一次心跳最早的那个，也可以配成 lru，挑最久没被借过的那个。两种都不做跨卡的整体分配。

所以如果同时有两个和 A 一模一样的实例 A1、A2 在服务，B 的卡 0 借到 A1、卡 1 借到 A2，这种组合是允许的，也没有问题：两边的部署指纹相同，A1 卡 1 和 A2 卡 1 存的本来就是同一份分片。四份「拼得起来」，靠的是每份各自的钥匙和之后的清单核对，而不是「四张卡都选中了同一台机器」。

## 钥匙对上了，也不能证明权重内容一样

配置指纹与张量结构摘要只覆盖各自的配置描述字段和张量形状、类型、格式元数据，**没有把权重字节读一遍算内容校验和，也没有把 RFork 代码的提交号写进去**。如果有人替换了目录里的权重文件，而模型标识、修订号、配置字段以及各张量的形状、类型、存储格式都没变，两边仍然会算出同一把钥匙；形状相同的不同权重内容仍需部署方自行核实。

钥匙之后的清单核对能拦住一部分：张量的名字、形状、类型、字节数只要有一项对不上，就不传（见[传输与内存](rfork-transfer.md)）。但如果两份权重形状、类型都一样，只是数值不同，比如同一结构微调出的两个版本、又都没写版本号，清单也拦不住。

所以维护 RFork 时，要同时记下模型文件的版本和 RFork 代码的提交。改了传输方式、改了哪些张量要传、改了派生权重的含义之后，应该把旧的 seed 隔离开：换一个新的部署策略名，钥匙就全变了，新旧实例自然分成两个池。但这只是运维上的隔离，不能替代一致性测试。

反过来也要小心：别为了绕过某个形状报错，就随手把对不上的字段从指纹里删掉。例如「单批最多处理多少 token」这个配置不在指纹里，和它相关的那块工作区是专门改成「留在本地、不借」的，原因见[张量布局](rfork-layout.md)。

## 「没借到」要分清：钥匙没算出来、匹配不到，还是根本没问成

```wiki-diagram
file: rfork-identity-flow
```

B 的一个 Worker 在当前上游 `main`（`8d6180e2`）里按四步前进：

1. 先**建会话并算配置指纹**（`_ensure_rfork_session`）；
2. 再**搭空模型并按需准备布局**（`initialize_model` 等）；
3. 然后**登记本地目的显存、绑定结构摘要并算出最终 `seed_key`**（`session.register_destination()` → `bind_structural_digest` → `self.planner.seed_key`）；
4. **最后**才带着这把 `seed_key` 调用 `session.acquire_seed()` 去问 Planner。

整个过程中没有借到权重的情况要分成四类看（图里第二排从左往右）：

- **缺必填或非法配置（直接中止，不回退）**：`model_url`、`model_deploy_strategy_name`、`rfork_scheduler_url` 三项必填配置缺任一项，或严格配置项非法，会在初始化或建会话时抛出 `RForkConfigurationError`。加载器明确 `except RForkConfigurationError: raise` 直接中止启动，**不会**静默回退到默认加载。
- **会话或登记阶段的可恢复报错**：PP/EP 并行组未初始化、指纹描述自引用或歧义键（建会话阶段），或者目的显存登记失败（`RuntimeError("destination registration failed.")`）。这类异常属于 `RFORK_FALLBACK_EXCEPTIONS`，加载器接住后打一条「传输失败、清理后回退到默认加载」的警告并走清理与默认加载；若是建会话阶段失败（会话还没建起来），这张卡回退后不会登记成 seed。
- **没问成**：Planner 地址配了，但网络出错，Planner 回了非 200/404 的状态码，或者回复缺项、端口/rank/可选 `LEASE_TTL_SEC` 非法。
- **匹配不到**：Planner 明确回 404，表示这把钥匙下没有可用的 seed。示例 Planner 在两种情况下这么回答：没有任何 seed 登记过这把钥匙；或者登记过的 seed 名额都被占满了。它还会把超过 60 秒没报平安（心跳）的 seed 转入 `draining` 停止分配新租约，所以 A 卡住或退出后，它的钥匙很快也会查不到。
- **借到了**：Planner 回了 200 且响应头带齐 seed 的 IP、端口、本次租约编号和 seed rank（外加可选 `LEASE_TTL_SEC`），四项齐全且取值合法，B 就进入取清单与读权重。

没问成和匹配不到最后打的是同一句日志（`RFork %s seed acquisition was unsuccessful; loading locally.`），随后从本地加载并在清理通过后把自己登记成 seed。表面一样，原因却完全不同：匹配不到是钥匙或 seed 的问题，没问成是连接或 Planner 本身的问题，后者在更早的位置会多一条「向 Planner 要 seed 失败」的警告。排查时按这个顺序走：

1. 先看进程是否直接抛 `RForkConfigurationError` 中止：是，就先补齐 `model_url`、`model_deploy_strategy_name`、`rfork_scheduler_url` 或修正严格配置项。
2. 进程没中止时，先找「传输失败、回退」的警告。看它带的原始报错：如果是并行组没建好、描述自引用/歧义键（会话未建，回退不登 seed），或是 `destination registration failed.`（登记显存失败，还没问 Planner），都发生在申请租约之前（原文见[会报什么错](#会报什么错)）。
3. 再找「向 Planner 要 seed 失败」的警告。有，就是没问成，先查网络、Planner 响应和端口/rank/TTL 格式；地址填错了但不为空，也落在这一类。
4. 把两边的指纹与结构摘要拿出来比。每个 TP 组里编号为 0 的那个 Worker 在建会话时打 `fingerprint`，在登记显存绑定后打 `RFork %s seed identity bound: seed_key=..., structural_digest=...`；指纹不同就按上表逐项比配置，指纹同而结构摘要不同就查两边实际张量布局。
5. 指纹和结构摘要都相同，再确认 A 那一侧确实登记成功、还在按时报平安。
6. 看同一把钥匙下的 seed 是不是都被别的实例占着。
7. 看两边是不是连到了同一个 Planner、同一份状态存储。
8. 以上都没问题，才当成正常的冷启动：本来就还没有任何 seed。

更完整的排错路线见[排错页](rfork-troubleshooting.md)。

## TP 编号相同，为何仍不能互借专家分片

以下按历史 GLM 16 卡拓扑与 `8d6180e2` 的 RFork 规则联合推演，实际清单和可用性以合并部署记录为准（社区上游已含 `glm5next` 实现，但 `Glm5NextMTP` 暂未纳入自动 checkpoint 归属恢复；完整拓扑见[部署前提](glm-5-3-flash-two-node.md#部署前提)与[总览同构多机扩容推演](rfork.md#同构多机扩容时主模型与草稿各读多少)）：一个实例跨两台机器、16 张卡，采用 TP8 / DP2 / EP16 / W8A8。

**三层摘要分别拦住什么，又漏掉什么。** 在 `8d6180e2` 中，模型与策略标识、`model_revision`、架构/RoPE、HF 量化配置摘要以及有效 `kv_role` / `mix_placement` 进入**配置指纹**；TP8 / PP1 / EP16（由 `DP 2 × TP 8` 决定每卡 18 个路由专家）切出的张量形状、W8A8 量化后的 `int8` / `float32` `dtype`，以及默认 `weight_nz_mode=1` 将量化权重转成的 `FRACTAL_NZ` 格式，在登记目的显存时进入**张量结构摘要**。因此并行切法、量化或 NZ 格式不同的实例会在结构摘要层分池；而“两端加载的究竟是不是同一份 checkpoint 权重内容”，配置指纹与结构摘要都不会逐字节校验，仍必须由部署方通过固定 `model_revision`、`model_url` 和 `model_deploy_strategy_name` 核实。

**每张卡的钥匙里写什么编号。** EP 组正好是全部 16 张卡、按全局编号排，所以组内编号就等于全局编号（分组见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）；此外 MoE 模型在 `DP=2 > 1` 下还会写入 `sharded_dp_rank`（`node0` 为 `0`、`node1` 为 `1`）。PP 只有一段，PP 编号记为空。对全局第 $r$ 号卡（$r \in \{0, 1, \dots, 15\}$）：

$$\text{tp\_rank} = r \bmod 8, \qquad \text{ep\_rank} = r, \qquad \text{pp\_rank} = \text{None}\ (\text{PP}=1)$$

| 全局卡号 $r$ | $\text{tp\_rank} = r \bmod 8$ | $\text{ep\_rank} = r$ | $\text{pp\_rank}$ | 钥匙是否相同 |
|---|---|---|---|---|
| 第 1 号卡 | `1` | `1` | 空 | 基准 |
| 第 9 号卡 | `1` | `9` | 空 | **不同**（TP 编号相同，但 EP 编号与 `sharded_dp_rank` 不同） |

第 1 号卡和第 9 号卡的 TP 编号都是 1，attention 和稠密层存的是同一份切片；可它们各放 18 个不同的专家，EP 编号一个是 1、一个是 9，钥匙就不同。这正是 EP 编号要进钥匙的原因：两张卡上专家张量的形状、类型与 NZ 格式完全相同，结构摘要与清单核对都拦不住，只有靠 `ep_rank`（及 `sharded_dp_rank`）才能确保 B 的第 $r$ 号卡只借 A 的第 $r$ 号卡。

**一共多少把钥匙。** 主模型 16 把，MTP 草稿模型 16 把，当 32 个会话均走到借用阶段时共向 Planner 申请 32 次（见总览的[谁向谁借](rfork.md#谁向谁借16-个-worker-各借各的主模型和草稿模型各一套)）。

**日志从哪看。** 打印指纹与绑定 `seed_key`、报告「没有可用的 seed」的 INFO 日志，只在 TP 编号为 0 的 Worker 上打（本拓扑为全局第 0 号和第 8 号卡）；其余 14 张卡打 DEBUG。

**首次无同身份来源时走回退。** DP2 只是单个实例内部的两组，集群内尚无登记过这 32 把钥匙的同身份 seed 时，首次冷启动必然回退（见总览的[能不能受益](rfork.md#这套部署现在能不能受益)）。

## 常见误解

- **「seed key 就是模型地址。」** 它是配置指纹、结构摘要、分片编号和角色合起来的 SHA-256（64 个十六进制字符）；模型地址只是其中一项，只比路径查不全。
- **「指纹和结构摘要相同，权重就完全一样。」** 两者只覆盖配置描述与张量形状/类型/格式元数据，同形状不同权重内容仍要靠版本记录与输出一致性测试核实。
- **「EP16 直接写在配置指纹里。」** 配置指纹不单列 EP 组大小；EP16 切出的每卡专家形状进入结构摘要，哪张卡拿哪份专家由 `seed_key` 里的 `ep_rank`（及 `sharded_dp_rank`）区分。
- **「两边全局编号一样才能借。」** 全局编号不进钥匙，它只用来算 seed 服务的端口（设了基础端口时）和在日志里标卡。
- **「从日志里能看出两边哪一项配置不同。」** 日志里只有哈希值，看得出不同，看不出差在哪。
- **「改了并发相关的配置，就一定要换 seed。」** 要看这个配置进没进指纹、会不会改变要传的张量。那块 top-k 工作区是专门排除掉的，不能推广成「所有并发差异都兼容」。

## 对照源码

### 怎么开

身份匹配本身没有开关，用 `--load-format rfork` 加载就会算。它需要三项配置：`model_url`（或环境变量 `MODEL_URL`）、`model_deploy_strategy_name`（`MODEL_DEPLOY_STRATEGY_NAME`）与 `rfork_scheduler_url`（`RFORK_SCHEDULER_URL`）。三项默认空串；建会话时任何一项为空均抛 `RForkConfigurationError`，该异常不被回退保护吞掉，直接中止启动。[C28][C23] 全部客户端设置见[配置页](rfork-config.md)。

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

- 配置指纹（`build_compatibility_fingerprint`，`identity.py#L229-L264`）：`rfork_protocol_version`、`model_url`、`model_deploy_strategy_name`、`model_revision`、`quantization_config`、`architecture`、`rope`、`weight_layout`（`kv_role` + `mix_placement`），规范化 JSON 后取 SHA256。
- 结构摘要（`build_structural_digest`，`tensor_layout.py#L43-L69`）：对登记扫描得到的全部可传张量（ID、shape、dtype、NPU format）取 SHA256；经 `session.register_destination`（`session.py#L115-L143`）绑定到 `planner_client.bind_structural_digest`。[C24][C27]
- `seed_key`（`build_seed_key`，`identity.py#L306-L349`）：`compatibility_fingerprint`、`structural_digest`、`model_url`、`model_deploy_strategy_name`、`tp_rank`、`pp_rank`、`ep_rank`、`sharded_dp_rank`、`is_draft_model` 九项，规范化 JSON 后取 SHA256。

| 位置 | 内容 |
|---|---|
| `identity.py#L33-L108` | `_canonicalize_fingerprint_value`：排序、定序、类型规范化、自引用与歧义键抛 `ValueError`（来源 1） |
| `identity.py#L111-L180` | `_get_architectures_descriptor`、`_get_rope_config_descriptor`、`_get_model_revision`（来源 2） |
| `identity.py#L182-L226` | `_get_effective_kv_role`、`_get_quantization_config_digest`（来源 3） |
| `identity.py#L267-L303` | `_resolve_sharded_dp_rank`：fine-grained TP（`size > 1`）或 MoE 且 `DP > 1` 时取 `data_parallel_rank`（来源 4） |
| `rfork_loader.py#L153-L204`、`#L206-L307` | 汇总 rank（`tp_rank == 0`）、草稿判定、`_build_rfork_identity`、`_get_ep_rank` / `_get_pp_rank` [C5] |
| `rfork_loader.py#L674-L746`、`#L775-L957` | `_ensure_rfork_session`、先建模型再登记绑定结构摘要后申请租约、`RForkConfigurationError` 中止与可恢复回退保护 [C20] |
| `session.py#L48-L53`、`#L75-L87`、`#L588-L719` | 双槽端口 `_resolve_seed_server_port`、必填项 `RForkConfigurationError`、首次登记与心跳重试（来源 9、11、28、31） |
| `planner_client.py#L38-L114`、`#L137-L195` | `bind_structural_digest`、`seed_key`、`acquire_seed` 与可读身份头（来源 7、10） |
| `examples/rfork/rfork_planner.py#L44-L80`、`#L117-L133`、`#L207-L229`、`#L289-L333`、`#L497-L516` | 示例 Planner 默认值、`fifo`/`lru` 挑选、draining 清理与 400/404 [C8] |
| `vllm_ascend/ascend_config.py#L718-L765`、`Dockerfile#L34-L35` | `weight_nz_mode` 默认 1、上游主线 Dockerfile 配套 `VLLM_TAG=v0.33.0`（来源 16、26） |

待核：

1. 我们这份 GLM-5.3-Flash W8A8 权重的 `config.json` 里有没有量化字段，决定 ModelSlim 逐层精度描述是否进指纹。
2. 生产环境 Planner 的匹配规则、状态码与是否支持 `LEASE_TTL_SEC` 续期。
3. 合并部署下硬件排布策略（`weight_layout_policy`）与 MTP 草稿配置的实际结构摘要及日志值。
