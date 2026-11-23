---
id: rfork-config
title: RFork 配置：四类端口、各项超时与可复制的启动示例
type: feature
summary: >-
  想让第二个实例从已有实例借权重，启动命令里要多写什么。这页讲上游 main（8d6180e2）RFork
  的十三项客户端设置和四类端口：配置错误何时中止启动、未知键为何告警；双槽固定端口与 EADDRINUSE 动态回退；单次超时、快慢重试与可选续租各管什么；GLM
  双机每台开多少端口、默认租约够不够，以及怎样验收。
aliases:
  - RFork 配置
  - rfork_scheduler_url
  - rfork_seed_port_base
  - rfork_seed_advertise_host
  - rfork_request_timeout_sec
  - rfork_heartbeat_interval_sec
  - rfork_lease_release_max_attempts
  - rfork_seed_timeout_sec
  - rfork_model_identity_headers
  - rfork_seed_removal_supported
  - RFork 四类端口
  - RFork 十三项参数
  - model_loader_extra_config
  - YR_TE_HIXL_BASE_PORT
legacyAnchors:
  十一项设置管什么默认多少什么时候改: 十三项设置管什么默认多少什么时候改
  键名写错不报错只是悄悄当没填: 键名写错会打警告并按未填处理
  固定端口基数会撞: 固定端口基数怎样按主草分槽
chapters: []
order: 90
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/config.py#L11-L192'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L75-L87'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L588-L659'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L227-L273'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L368-L375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L747-L774'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L40-L80'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L362-L391'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L491-L694'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_server.py#L128-L373'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L641-L667'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/rfork.md#L120-L275'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L605-L647'
  - >-
    raw:sha256-854b4facdc4efae646ebb25bcf755d84e408b6f09bfe00f179afec0a39d2d232.md#L1-L933
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/planner_client.py#L117-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/session.py#L261-L364'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/transfer_backend.py#L224-L269'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L48-L53'
verified:
  - main
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 先从总览看懂控制面、元数据面与数据面三条通道，再核对十三项参数与四类端口的归属
  - to: rfork-identity
    kind: builds-on
    note: model_url 与部署策略是匹配标识，必须先理解它们不等于 served-model-name
  - to: rfork-lifecycle
    kind: builds-on
    note: lease 重试、心跳与 seed 启动超时分别作用于不同生命周期
  - to: ascend-config-system
    kind: builds-on
    note: RFork 参数走 --model-loader-extra-config 而非昇腾 --additional-config，两者入口隔离
  - to: ascend-model-onboarding
    kind: builds-on
    note: 模型本地路径与默认加载链路必须始终保持可用，以支撑首次冷启动与传输失败回退
  - to: cann-hccl
    kind: builds-on
    note: 多网卡环境下须将 seed 宣告地址与 VLLM_HOST_IP / HIXL 数据面端口同底层通信网卡一并规划
  - to: sleep-mode
    kind: conflicts-with
    note: 配置中同时开启 sleep mode 会触发可变权重绕过守卫，RFork 自动退回默认加载
contradicts: []
updated: '2026-11-19'
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
    raw/sha256-854b4facdc4efae646ebb25bcf755d84e408b6f09bfe00f179afec0a39d2d232.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 第二个实例要从第一个实例借权重，启动命令里多写什么

[RFork](rfork.md) 让新起的实例 B 按地址读取已在服务的实例 A 显存里的权重（被借的一方叫 seed），读不成再退回从存储加载。它是什么、为什么能省时间，总览页已经讲过。这一页只回答落地时的问题：B 的启动命令里要多写什么，每一项管什么，写错了会怎样。

要多写两样东西：

- **一个开关**：告诉 vLLM「这次用 RFork 这种方式加载权重」。
- **一包设置**：写成一段 JSON，交给「模型加载器的额外设置」这个入口。里面全是 B 自己的事：我是哪个模型、去哪里找 Planner、我当 seed 时对外报什么地址和端口、多久报一次平安、还租约失败了重试几次。

最容易写错的是入口：这包设置（`--model-loader-extra-config`）**不是**塞进昇腾插件平时用的 `--additional-config`（见 [Ascend 配置系统](ascend-config-system.md)）。放错了地方，RFork 读不到这些设置，结果和一项都没填一样（后果见下一节）。同时，本地模型路径仍需满足标准[新模型上线](ascend-model-onboarding.md)的磁盘加载要求，以支撑首次冷启动与失败回退。

为什么要配这么多项？因为借一次权重要连好几个地方。下图是一台 A、一台 B 时，RFork 牵涉的四类端口：

```wiki-diagram
file: rfork-config-ports
```

1. **API 端口**：业务方发推理请求的地方；B 在权重加载完之前还不对外服务。
2. **Planner 端口**：Planner 是推理实例之外的一个独立小服务，撮合「谁向谁借」，每借一次发一张租约（一次借用许可，到点收回）。A、B 各自 Worker 里的 RFork 会话去连它：A 登记、定时心跳，B 借、用完去还。
3. **seed 元数据端口**：A 上的一个 HTTP 小服务，B 先到这里取一份清单：A 的传输端点在哪，每个张量在什么地址、什么形状。
4. **传输引擎端点**：真正搬权重字节的通道，两端各有一个。

本页讲的是社区上游 `vllm-ascend` `main`（`8d6180e2`）的 RFork 实现。各项行为都对照源码逐行核过，但还没有在真实 NPU 上跑通过一次完整加载；示例里的地址、端口和模型路径都要换成现场的。

## 为什么要专门讲配置：多数写错不会报错

一般的程序，配置写错了会直接启动失败。RFork 区分了「配置错尽早暴露」与「运行时借不到再回退」两层边界。

在当前主线中，**三项必填标识留空或严格项非法会直接中止启动**（抛 `RForkConfigurationError`，不再静默退回默认加载）。而未知键名、两个超时非法或宣告地址不可达，则只记警告或延后到加载、借用阶段才暴露。

把各种写错归一下，后果分四种：

| 后果 | 什么情况会这样 | 你能看到的 |
|---|---|---|
| 进程起不来 | 身份串、策略名、Planner 地址任一项为空；心跳、还租约、端口基数、身份头开关或撤销开关显式填了非法值；设置包不是 JSON 对象 | 启动时直接抛 `RForkConfigurationError` 中止 |
| 打警告后按未填处理 | 任何未知键名（含旧短别名或拼写错误） | 一条 `RFork ignored unknown model_loader_extra_config keys` warning，键本身按未填处理 |
| 悄悄用默认值 | 两个超时填了非法值 | 先查环境变量，没有就回退默认值，不抛错 |
| 自己照常起来，但当不上 seed，或登记了别人也借不到 | 监听地址填成本机没有的 IP 导致绑定失败；宣告地址填成别的机器连不上的 IP（固定端口被占用时会自动退回 OS 随机端口） | 绑不上地址时本机有一条 seed 服务启动失败 warning；宣告地址填错要到借用方才看到传输失败并回退 |

所以「服务能起来」不说明全部配对。要看日志里 RFork 自己报的那几行，做法见[怎样验收](#怎样验收这套配置真的有用)。

代价就在这里：RFork 既有严格中止项，也有可选默认值与环境变量回退。下面先分清几个容易混的名字，再逐组讲每一项。

## 四个「名字」各管各的

一条启动命令里，至少有三处看起来像「模型名」，再加上部署策略名，一共四项，作用完全不同：

| 这一项 | 管什么 | A、B 两端要不要一样 |
|---|---|---|
| 启动命令后面跟的模型路径 | 本地从哪里取模型来构建，以及借不到时正常加载从哪读 | 路径文字可以不同，但实际模型内容和配置要对得上 |
| 模型身份串 | RFork 用来判断「是不是同一个模型」的字符串 | 想进同一个可互借的池子，就要一致 |
| 部署策略名 | RFork 的部署方式命名空间 | 同池一致；不兼容的部署要隔开时，换一个新值 |
| 对外服务名 | 调 API 时写的模型名 | 不参与 RFork 的匹配 |

模型身份串的字段名里带「URL」，很容易让人以为 RFork 会去这个地址下载模型。其实它只被当作一串文字做身份比对；借不到时的正常加载仍按模型路径走。

身份串、策略名或 Planner 地址留空（且没有设对应的环境变量）时，当前主线在建会话时会抛 `RForkConfigurationError` 直接中止启动，避免运维误以为启用了 RFork 却一直在静默走磁盘加载。更细的匹配规则见[身份与匹配](rfork-identity.md)。

## 十三项设置：管什么、默认多少、什么时候改

按用途分五组。「写错会怎样」上一节已经归成四种，这里不再逐行重复。

| 设置 | 默认值 | 管什么 | 什么时候要改 |
|---|---|---|---|
| **身份与找人** | | | |
| 模型身份串 | 空，必填 | RFork 判断「是不是同一个模型」 | 每个要互借的池子定一个值，池内所有实例一样 |
| 部署策略名 | 空，必填 | 部署方式的命名空间 | 部署不兼容、需要隔开时换一个新值 |
| Planner 地址 | 空，必填 | 去哪里借、还、续期、登记、心跳 | 指向现场 Planner 的 IP 和端口 |
| **超时** | | | |
| 来源服务启动预算 | 5 秒 | 本机 seed 服务起来并通过健康检查的总预算；**不是**租约有效期 | 机器很忙、seed 服务启动超时 |
| 单次请求超时 | 10 秒 | 找 Planner、向 seed 取清单的**每一次** HTTP 请求等连接、等回复的时间 | 网络或 Planner 响应慢 |
| **地址与端口** | | | |
| 监听地址 | `0.0.0.0`，即所有网卡 | seed 服务在本机哪块网卡上监听 | 只想让某一张网卡对外 |
| 对外宣告地址 | 留空，上报时自动取本机 IP | 报给 Planner、让别的机器来连 seed 服务的 IP | 多网卡，自动取到的不是别人连得上的那张 |
| 端口基数 | 0，即系统随机分配 | 正数时 seed 端口 = `基数 + 2 × 全局 rank + 角色槽`（主 0、草稿 1） | 防火墙只放行固定的端口段 |
| **心跳与还租约** | | | |
| 心跳间隔 | 30 秒 | 当上 seed 以后，上一次心跳**结束后**再等多久发下一次 | 要明显短于 Planner 判 seed 掉线的时限 |
| 还租约快速重试次数 | 3，含第一次 | 归还租约快速重试几次（超过后遇暂态错误转 ≥60 秒慢速重试） | Planner 偶尔短暂不可用 |
| 还租约重试间隔 | 30 秒 | 快速阶段两次可重试失败之间等多久 | 同上 |
| **Planner 协议扩展** | | | |
| 附带可读模型头 | `false` | 是否在每次 Planner 请求头附带 `MODEL_URL`、`DEPLOY_STRATEGY`、`IS_DRAFT`（开启要求 ASCII） | 现场 Planner 需要按可读元数据观测或审计 |
| 撤回接口支持开关 | `false` | 控制关停/故障撤回时是否调用 `/remove_seed`（`false` 跳过、`true` 确认支持、`null` 自动探测） | 现场 Planner 实现了 `/remove_seed` 撤回协议时开启 |

表里的**全局 rank** 是本进程在整个分布式组里的编号：每张卡一个 Worker 进程，从 0 往上数，跨机器也连着数。

几处措辞是有意这样写的：

- 心跳间隔从上一次心跳请求**结束**算起，不是固定节拍的定时器，所以 Planner 看到的心跳周期总比 30 秒长一点。示例 Planner 是 60 秒没收到心跳就把这个 seed 转入 draining；心跳间隔加上一次请求的耗时，要留在这个时限之内。
- 宣告地址留空时，每次上报那一刻当场取 `get_ip()`（优先 `VLLM_HOST_IP`，否则按出网路由选网卡）填进去。多网卡的机器上，请显式设置 `rfork_seed_advertise_host` 与 `VLLM_HOST_IP`。

**设置从哪里读。** 上述十三项里，有八项支持同名大写环境变量兜底（三项必填、两个超时、监听/宣告地址与 `RFORK_MODEL_IDENTITY_HEADERS`）；顺序是设置包里的有效值优先，其次环境变量，最后默认值。端口基数、心跳与还租约三项及撤回开关只认设置包里的值。

**严格项直接中止，两个超时宽松回退。** 心跳、还租约、端口基数、可读模型头开关与撤回开关显式填了非法值，以及三项必填项最终为空，都会在初始化或建会话时抛 `RForkConfigurationError` 直接中止进程。两个超时宽松得多：写成带引号的数字字符串也认；非法值不报错，依次回退环境变量和默认值。

## 键名写错会打警告并按未填处理

当前主线共识别十三项固定键名（`KNOWN_EXTRA_CONFIG_KEYS`），**不再支持早期分支的短别名**（如 `request_timeout_sec`、`bind_host`、`advertise_host`）。

键名拼错或沿用旧短别名时，加载器初始化会打出一条明确 warning（列出所有未识别键并提醒检查拼写），然后把对应字段按未填处理：先查环境变量，查不到就用默认值或空串；若是三项必填键拼错且未设环境变量，建会话时就会抛 `RForkConfigurationError` 中止。

端口基数必须是 `[0, 65535]` 范围内的严格 JSON 整数（排除 `bool`、小数或带引号的字符串，否则直接抛 `RForkConfigurationError`）。

## 四类端口：谁监听、谁来连、由什么决定

开头图里的四类端口，由不同的东西决定：

- **API 端口**：启动命令里写的端口。
- **Planner 端口**：Planner 自己的启动参数；B 的设置包里只写它的地址。
- **seed 元数据端口**：默认由系统随机分配；设了非零端口基数，采用双槽公式 `基数 + 2 × 全局 rank + 角色槽`（主模型槽 0、草稿模型槽 1）。
- **传输引擎端点**：初始化时向引擎传 `port=0`，由引擎自行绑定并经 `get_rpc_port()` 读回（可通过 YuanRong 环境变量 `YR_TE_RPC_PORT_MIN` / `YR_TE_RPC_PORT_MAX` 限定范围；HIXL［昇腾高速点对点传输链路］数据面默认基址 `YR_TE_HIXL_BASE_PORT=22000`）。

所以「把端口固定下来」只固定了第三类那一个。宣告地址也只改报给 Planner 的 seed 元数据地址，不会顺带改传输引擎自己选的端点（后者跟 `VLLM_HOST_IP` / `get_ip()` 走；多网卡环境须与 [CANN 与 HCCL](cann-hccl.md) 的业务/集合通信网卡拓扑一并规划）。如果「清单取得到，真正读权重却失败」，要查的是第四类能不能连通。

双槽固定端口按 $\text{port} = \text{base} + 2 \times \text{global\_rank} + \text{slot}$ 计算（主模型槽 `0`、草稿槽 `1`），超出 `65535` 或端口被占用（Linux `EADDRINUSE`）时都会自动退回系统随机端口：

| 基数 `base` | 角色与槽位（`global_rank = 3`） | 算式 | 结果与行为 |
|---|---|---|---|
| `35000` | 主模型（槽 `0`） | $35000 + 2 \times 3 + 0$ | `35006` |
| `35000` | 草稿模型（槽 `1`） | $35000 + 2 \times 3 + 1$ | `35007` |
| `65530` | 主模型（槽 `0`） | $65530 + 6 = 65536$ | 超过 `65535`：打 warning 退回系统随机端口 |

主模型与草稿模型分占相邻偶/奇槽位后，同一 Worker 进程内不再撞号。同机多实例共用同一基数若遇 `EADDRINUSE`，也会自动退回动态端口；若是其他绑定错误（如监听地址不属于本机），仍会失败并记 warning，该角色不当 seed，模型照常交回。防火墙若要按固定段放行，仍须为同机多实例错开端口基数，并以实际绑定日志为准。

还有两条边界：

- **本机健康检查只证明本机能访问。** seed 服务起来后，本机会轮询它的健康检查接口，通了才算启动成功；连的是实际绑定的地址，监听「所有网卡」时改连本机回环地址。所以健康检查通过，不说明别的机器能连上宣告地址，更不说明传输通道通。
- **内建的 seed 服务是普通 HTTP。** `seed_key` 会出现在日志、URL 查询参数与示例 Planner 的 `/debug/snapshot` 中，必须把整个控制面与日志留在受信网络边界内；现场要走 HTTPS，得核对代理、地址和转发怎么配。

## 超时、重试间隔和租约有效期是三个量

这三个量常被混成「RFork 的超时」，其实各管一段：

- **单次请求超时**管每一次 HTTP 请求等连接、等回复的时间，不是「从借来源到对外服务」整件事的截止时间。
- **还租约的快速次数和间隔**管 B 读完以后在后台还租约时，前几轮快速重试的节奏；超过后遇暂态错误会转入至少 60 秒间隔的慢速重试，直到成功、被永久拒绝或关停。
- **租约有效期**是 Planner 那边的：租约从发出那一刻起算，到点就收回。示例 Planner 默认 60 秒，seed 的心跳只报平安、不续租约；但当 Planner 在 `GET /get_seed` 返回有限正数 `LEASE_TTL_SEC` 时，客户端会起后台线程按 `clamp(TTL / 3, 0.1, 30.0)` 秒周期调用 `/renew_seed_lease` 续期。

还租约默认快速阶段最多 3 次、间隔 30 秒，仅快速阶段光间隔就占 60 秒；若每次请求恰好卡满单次 `10` 秒超时（非总上限，第 4 次起遇暂态错误转每 $\ge 60$ 秒慢速重试）：

$$\text{快速阶段合计} = 3 \times 10\text{ 秒（三次请求）} + 2 \times 30\text{ 秒（两段间隔）} = 30 + 60 = 90\text{ 秒}$$

来源服务启动那 5 秒也一样不是硬截止：它用来算健康检查的截止时刻，再用剩下的时间限制排队和轮询；失败后的清理另有一份等待预算。

评估租约有效期够不够长时，要把**借到之后的取清单、真正读权重与后台还租约**都算进去（当前主线已将本地显存登记提前到借租约之前）。

若现场 Planner 不支持 `LEASE_TTL_SEC` 续期且租约读到一半过期，读取本身不会被打断，但 Planner 会提前收回名额并引发多读者争抢带宽。某次借用是否过期，需对照 Planner 记录与 B 的持有时长日志，见[生命周期](rfork-lifecycle.md)。

上文开篇图下栏已将四条独立时钟对齐在同一时间标尺上，排错时不要把单次 HTTP 超时、重试间隔与 Planner 租约 TTL 混成一个数。

## 设置写对了还不够：依赖和限制要实际核对

- 传输引擎来自 YuanRong 数据系统的 Python 包（`yr.datasystem`）。除了安装同名包，它还必须提供 `get_rpc_port` 与 `batch_register_memory_ex` 接口，缺任一项都会直接判为不支持。
- 模型已经落地的参数和缓冲区必须全部在 NPU 上（经 `local_weights.py` 完成本地加载的 Engram 宿主表除外）；未豁免的混合 CPU/NPU 状态会被拒绝，转去正常加载。
- 命中 `safety.py:mutable_weights_bypass_reason` 的三类可变权重场景——`enable_sleep_mode`（[sleep mode](sleep-mode.md)）、`weight_transfer_config`（在线权重传输）或 `parallel_config.enable_eplb`（[EPLB](eplb.md)）——时，RFork 会被整体绕过，只留一条 warning 并改走默认加载（不发布 seed）。早期 Model Runner V1 的静态/动态 EPLB 附加字段（`dynamic_eplb`、`expert_map_record_path`、`expert_map_path`）已在上游移除，不再构成绕过条件。
- 正常加载的路径必须留着：第一个实例冷启动要靠它，借不到时也要退回它。「能从来源加载」不等于可以不要磁盘上的权重文件。

不同时期文档里的安装包名差异见[官方文档核读](../sources/rfork-official-guide.md)。不要在已经在跑的环境里盲目升级同名包，先在**真正跑推理进程的那个 Python 环境**里做一次只读检查（脚本在下面「怎么开」），记下模块路径、包版本与 `get_rpc_port` / `batch_register_memory_ex` 可用性，再验证设备上的行为。

## 怎样验收这套配置真的有用

在同样的模型、输入和采样设置下，分别记录五种情况：正常加载的基线、第一个实例冷启动、第二个实例借到来源、找不到来源、中途出故障退回正常加载。每种情况都分段记时间：初始化、排布、登记内存、申请来源、取清单、读权重、还租约、自己发布成来源、服务就绪。

日志里 RFork 会报四种不同含义的「成功」，各自证明什么、不证明什么，见总览页的[四种成功](rfork.md#成功至少有四种不能压成一个开关)；最终加载汇总会输出 `source=transfer` / `local` / `fallback` / `shared_target`，分段耗时和吞吐的日志原文列在下面「开销和什么时候别开」。

比对输出或 logits 时，方法要符合这个模型的确定性和容差要求。同时看两件事：被借的那台机器上，正在跑的推理延迟有没有变差；并发扩容多个实例时，启动耗时的长尾有多长。只测一条小请求正常，不能说明所有模型、量化方式和共享路径都支持。

## 放到 GLM 双机：每台机器开多少端口，固定端口会不会撞

先说清前提，这一节是推演，不是实测：我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。官方教程没有开 RFork；GLM-5.3-Flash 的教学模型账目钉在固定镜像 `db701c1f`，下面是把上游 `main` RFork 配置机制套到该双机拓扑上的推演，见总览页的 [GLM 一节](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)。这里只看配置层面的三件事。

### 每台机器上 RFork 新开多少个端口

每台机器 8 张卡、8 个 Worker 进程。投机解码的 MTP 草稿模型和主模型在同一个 Worker 里，各有一套 RFork 会话，各自借、各自当 seed。每套会话在首次登记时初始化传输引擎端点，当上 seed 以后再开一个 seed 元数据端口：

$$\text{每台 RFork 会话} = 8\text{ 个 Worker} \times 2\text{（主模型、草稿模型）} = 16\text{ 套}, \qquad \text{每台新开端口} = 16 \times 2\text{（seed 元数据、传输引擎端点）} = 32\text{ 个}$$

另外 `node0` 还有 1 个 API 端口，`node1` 以 headless 方式只跑引擎、不开 API；Planner 是实例之外的独立服务，16 个 Worker 的 32 套会话都去连它。

这 32 个端口在默认设置下全是随机的。如果现场防火墙只放行固定端口段，需要分别规划 seed HTTP 端口段与 YuanRong 数据面环境变量范围。

### 固定端口基数怎样按主草分槽

两台机器上的全局 rank 连着数：`node0` 是 0–7，`node1` 是 8–15。当前主线采用双槽公式 `base + 2 × global_rank + slot`（主模型槽 0、草稿模型槽 1）：设基数 `35000` 时，`node0` 占用 `35000–35015`（每卡偶数为 main、奇数为 draft），`node1` 占用 `35016–35031`，**同进程内主模型与草稿模型不再撞号**。

若指定端口被其他进程占用（Linux `EADDRINUSE`），seed 服务会自动退回 OS 随机端口。传输引擎 RPC 端口与 HIXL 数据端口则须分别通过 `YR_TE_RPC_PORT_MIN/MAX` 和 `YR_TE_HIXL_BASE_PORT`（默认 `22000`）规划防火墙放行。

### 默认 60 秒的租约够不够

主模型会话每张卡所列主要语言张量的读取子账约为 `20.09 GiB`（逐项及未计项目见总览页的[每张卡读多少](rfork.md#每张卡读多少读的字节和常驻的权重是两本账)）。在不支持续期的旧 Planner（默认 60 秒租约）下，仅这一子账就要求平均读速至少约 `20.09 GiB ÷ 60 秒 ≈ 0.33 GiB/s`；实际清单还要算入视觉塔等表外张量与元数据、归还开销。

若 Planner 返回 `LEASE_TTL_SEC` 并支持 `/renew_seed_lease`，客户端会在传输期间自动周期续租（默认每 20 秒续一次），降低大权重传输过期的风险。主模型与草稿各有独立租约，不能把两者合计的 `20.91 GiB` 子账算作同一份租约的字节。

## 常见误解

- **「服务能起来，RFork 就配好了。」** 未知键名只打 warning、宣告地址填错要到借用方才暴露；须看日志里是否有 `source=transfer` 与「权重传完」那一行。
- **「固定了端口基数，RFork 的端口就都固定了。」** 只固定了 seed 元数据端口（主草双槽且遇 `EADDRINUSE` 会回退动态端口）；传输引擎 RPC 端口与 HIXL 数据面端口由 YuanRong 独立管理。
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

客户端参数全表（13 项已知键 `KNOWN_EXTRA_CONFIG_KEYS`，默认值与读取顺序来自 `RForkConfig`，不再支持旧短别名，未知键打 warning）：

| JSON 字段 | 默认值 | 有效输入与环境回退 |
|---|---|---|
| `model_url` | `""` | 必填非空字符串；`MODEL_URL` |
| `model_deploy_strategy_name` | `""` | 必填非空字符串；`MODEL_DEPLOY_STRATEGY_NAME` |
| `rfork_scheduler_url` | `""` | 必填非空字符串；`RFORK_SCHEDULER_URL` |
| `rfork_seed_timeout_sec` | `5.0` | 有限正数（接受数字串）；`RFORK_SEED_TIMEOUT_SEC` |
| `rfork_request_timeout_sec` | `10.0` | 有限正数（接受数字串）；`RFORK_REQUEST_TIMEOUT_SEC` |
| `rfork_seed_bind_host` | `"0.0.0.0"` | `RFORK_SEED_BIND_HOST` |
| `rfork_seed_advertise_host` | `None`（上报时调 `get_ip()`，优先 `VLLM_HOST_IP`） | `RFORK_SEED_ADVERTISE_HOST` |
| `rfork_seed_port_base` | `0` | 严格 JSON 整数 `[0, 65535]`；无环境回退 |
| `rfork_heartbeat_interval_sec` | `30.0` | 严格有限正 JSON number；无环境回退 |
| `rfork_lease_release_max_attempts` | `3` | 严格正 JSON integer（快速重试次数）；无环境回退 |
| `rfork_lease_release_retry_interval_sec` | `30.0` | 严格有限正 JSON number；无环境回退 |
| `rfork_model_identity_headers` | `false` | 严格 JSON 布尔值；`RFORK_MODEL_IDENTITY_HEADERS`（`0`/`1`/`true`/`false`），开启后要求 `model_url` 与策略名为 ASCII |
| `rfork_seed_removal_supported` | `false` | `false`（跳过 `/remove_seed`）/ `true`（确认支持）/ `null`（自动探测）；无环境回退 |

心跳「请求结束后再等」与 advertise 留空时由上报函数当场取本机 IP，见 `planner_client.py`。[C9]

先在具备依赖的环境启动此版本的**示例** Planner；它是协议演示，不自动提供生产级持久化或多副本共享状态：

```bash
python examples/rfork/rfork_planner.py --host 0.0.0.0 --port 1223 --lease-ttl-sec 60
```

这三个开关（以及 `--heartbeat-ttl-sec`、`--default-resource-points`、`--alloc-policy`）由示例 Planner 自己的命令行解析定义，默认值来自同名的 `RFORK_MOCK_*` 环境变量；它们配置的是**服务端**的租约与容量，和客户端参数表不是一套。[C14]

示例 Planner 的分配策略选项只接受 fifo 和 lru；未给命令行值时使用环境变量 RFORK_MOCK_ALLOC_POLICY，未设置该环境变量时回落到 fifo。这是示例 Planner 的启动选项，不是客户端 RForkConfig 的字段。

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

required = ("initialize", "get_rpc_port", "batch_register_memory_ex",
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

此检查不实例化引擎、不注册设备内存；通过只说明 API 名称可见。还需核对 `MemoryRegistration` 四参数的语义、部分失败后的注销结果、native 返回对象及 finalize 对活动传输的行为。`kNotFound` 在当前主线是可选探测，缺少时不能走对应的「已不存在」确认逻辑；不能擅自补一个猜测错误码。[C4]

### 会报什么错

- 空 `rfork_scheduler_url`、`model_url` 或 `model_deploy_strategy_name`：`RForkSession.__init__` 抛 `RForkConfigurationError`（刻意不继承 `ValueError`/`RuntimeError`），**直接中止启动**，不再静默回退到默认加载。[C2]
- 未知键名（含旧短别名如 `request_timeout_sec`/`bind_host` 或拼写错误）：加载器 `__init__` 调 `unknown_extra_config_keys` 打 warning `RFork ignored unknown model_loader_extra_config keys: ...; check the spelling.`，键本身仍按未填处理。[C12]
- `--model-loader-extra-config` 不是 JSON 对象、或 `heartbeat_interval_sec` / `lease_release_max_attempts` / `lease_release_retry_interval_sec` / `rfork_seed_port_base`（`[0, 65535]` 严格 JSON 整数，排除 bool 与字符串）/ `rfork_model_identity_headers`（严格 bool，开启时要求 ASCII）/ `rfork_seed_removal_supported`（`bool | None`）任一项非法：在 `__init__` 抛 `RForkConfigurationError`，进程起不来。
- 两个 timeout（`rfork_seed_timeout_sec`、`rfork_request_timeout_sec`）使用有限正数解析器，接受整数、浮点数及可转浮点数的字符串；非法值不报错，依次回退环境变量和默认值。
- 双槽端口 `base + 2 × global_rank + slot`（主 0、草稿 1）超过 65535 时记 warning 并退回系统随机端口；指定固定端口被占用（Linux `EADDRINUSE`）时同样自动回退 OS 随机端口；其他绑定错误（如监听地址不属于本机）抛 `OSError`，该角色不当 seed，模型照常交回。[C3][C11]
- TransferEngine 初始化传 `port=0` 并调 `get_rpc_port()` 读回真实 RPC 端口；缺 `get_rpc_port` 或 `batch_register_memory_ex` 均判为不支持。[C10]
- 实际物化的 Parameters / buffers 存在未豁免的非 NPU 状态（混合 CPU/NPU）：拒绝并尝试默认加载。[C5]
- 本地健康检查使用实际绑定地址，监听 `0.0.0.0` / `::` 时改用回环地址；健康检查 200 不证明 advertise 地址远端可达，也不证明 TransferEngine 数据端点连通。
- metadata 能拿到、native read 却失败：`rfork_seed_advertise_host` 只改发布给 Planner 的 seed HTTP 地址，TransferEngine 端点由 `get_ip()`（优先 `VLLM_HOST_IP`）+ 引擎绑定 RPC 端口确定（可选 `YR_TE_RPC_PORT_MIN/MAX`），需单独排查其可达性。

### 开销和什么时候别开

- 命中 `safety.py:mutable_weights_bypass_reason`（`enable_sleep_mode`、`weight_transfer_config` 或 `parallel_config.enable_eplb`）时 RFork 被整体绕过，调重试数不改变这个限制。[C6]
- `rfork_request_timeout_sec` 传给 Requests，约束连接 / 读等待，不是总截止时间。按 `3 × 10 + 2 × 30 = 90 秒` 计算只是三次快速尝试恰好卡满 10 秒的算例；暂态失败超过 3 次后还将按 ≥60 秒间隔慢速重试。[S13][D]
- seed 启动用单调时钟算健康检查 deadline，用剩余时间限制队列与轮询；失败清理另有等待预算。
- 双槽固定端口与 `EADDRINUSE` 回退已解决同进程主/草稿模型撞号问题，实际绑定端口仍以日志为准；内建 seed 服务为普通 HTTP，且 `seed_key` 须留在信任边界内。
- 验收：只测一条小请求正常，不能宣称所有模型、量化与共享路径都被支持。[I]
- 分段计时看四行日志：`RFork transfer stages: … registration=… metadata=… read=…`（`session.py#L266-L273`，DEBUG）；`RFork weight transfer completed: tp_rank=…, weights=…, chunks=…, bytes=… GiB, elapsed=…, throughput=… GiB/s`（`transfer_backend.py#L866-L875`，TP0 INFO / 其余 DEBUG）；`RFork … model layout processing took … seconds`（`rfork_loader.py#L827-L831`，DEBUG）；`RFork lease release outcome: … held_elapsed=…`（`session.py#L362-L369`，DEBUG）。
- 示例 Planner 的租约从 `get_seed` 发出时记 `leased_at`，到 `--lease-ttl-sec`（默认 60）后由定时清扫（`--heartbeat-sweep-sec`，默认 5 秒）或借还请求收回；心跳不更新 `leased_at`（支持 `LEASE_TTL_SEC` 时由客户端周期调 `/renew_seed_lease` 续期）。`--default-resource-points` 默认 1。

### 版本差异

| 维度 | `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|
| 客户端配置项 | 旧简化项，无独立 `RForkConfig` 严格校验 | 11 项配置，`RForkConfigurationError` 中止启动 | 13 项配置（新增 `rfork_model_identity_headers` 与 `rfork_seed_removal_supported`），未知键打 warning（`unknown_extra_config_keys`），无短别名 |
| seed HTTP 端口 | 仅随机端口 | `base + 2 × global_rank + slot`（主 0 / 草稿 1），超界或 `EADDRINUSE` 退动态端口 | 同 `v0.30.0` |
| TransferEngine 端口 | `get_open_port()` 预选后传入 | 传 `port=0` 由引擎绑定并调 `get_rpc_port()` 读回（可选 `YR_TE_RPC_PORT_MIN/MAX`） | 同 `v0.30.0` |
| 租约续期与归还 | 无续期，同步归还 1 次 | 强制 `LEASE_TTL_SEC` + `/renew_seed_lease`；3 次快试 + ≥60s 慢试 | `LEASE_TTL_SEC` 改为可选兼容旧 Planner；`/remove_seed` 默认关闭 |
| 绕过条件 | `layer_sharding`（仅 v0.23）或 V1 EPLB | `safety.py`（sleep mode / 在线权重传输）+ V1 EPLB | `safety.py:mutable_weights_bypass_reason`（sleep mode / 在线权重传输 / `enable_eplb`，移除 V1 EPLB） |

完整四版本对照见[总览](rfork.md#版本差异)，官网指南对照见[官方指南对照](../sources/rfork-official-guide.md)。

### 源码位置

以下均为社区上游 `vllm-ascend@8d6180e2`，路径省略前缀 `vllm_ascend/model_loader/rfork/`：

- `RForkConfig` 默认值、13 个已知键（`KNOWN_EXTRA_CONFIG_KEYS`）、`RForkConfigurationError`、`unknown_extra_config_keys`、字符串/超时环境回退与严格校验：`config.py#L11-L192`。
- 加载器 `__init__` 解析设置并警告未知键：`rfork_loader.py#L641-L667`；绕过安全门：`safety.py#L9-L21`、`rfork_loader.py#L766-L774`。
- 必填项 `RForkConfigurationError` 检查：`session.py#L75-L87`；双槽 seed 端口 `_resolve_seed_server_port`：`session.py#L48-L53`；越界回退、起 seed 服务、首次上报与心跳：`session.py#L588-L659`。[C19]
- `yr.datasystem` 导入、`port=0` + `get_rpc_port()` 与 `kNotFound` 可选探测：`transfer_backend.py#L227-L273`；非 NPU 状态检查：`#L368-L375`；`batch_register_memory_ex` 与 `finalize_transfer_engine`：`#L491-L694`。
- advertise 留空取 `get_ip()`（优先 `VLLM_HOST_IP`）：`planner_client.py#L362-L391`。
- seed 服务绑定（`EADDRINUSE` 退动态）、健康检查回环与 deadline：`seed_server.py#L128-L373`。
- 示例 Planner 默认值、`RFORK_MOCK_*` 环境变量与命令行参数：`examples/rfork/rfork_planner.py#L40-L80`、`#L605-L647`。
- 上游官方配置与环境回退指南：`docs/source/user_guide/feature_guide/rfork.md#L120-L275`。[S13]
- `v0.30.0` 对照：`vllm-ascend@c09d3e20` `planner_client.py#L117-L245`、`session.py#L261-L364`、`transfer_backend.py#L224-L269`。[C16]

**待核：**

1. 生产环境 Planner 的租约有效期、心跳摘除时限、每个 seed 的名额、是否返回 `LEASE_TTL_SEC` 与支持 `/remove_seed`；仓库里只有示例 Planner。
2. GLM 双机完整读取清单及实际各段耗时；约 0.33 GiB/s 只是语言子账的必要读速，缺实机日志。
3. YuanRong 传输引擎在现场环境中 `YR_TE_RPC_PORT_MIN/MAX` 与 `YR_TE_HIXL_BASE_PORT`（默认 22000）的实际防火墙放行与端口实测。
