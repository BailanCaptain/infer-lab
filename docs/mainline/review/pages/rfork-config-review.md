# rfork-config 审查记录

## P5 写作记录（第 21 批，2026-10-02，Opus 写手）

### 改了什么

- 字数（正文，JS 字符数）：10,321 → 17,486；对照源码以上 4,230 → 8,837。
- 新结构：第一屏「启动命令里多写什么」（开关 + 设置包 + 入口别放错）+ 直觉图 → 为什么要专门讲配置（多数写错不报错，三种后果表）→ 四个名字 → 十一项设置（四组，每项按 管什么 / 默认 / 什么时候改，填错后果归到上一节三类）→ 键名写错 → 四类端口（表 + 端口基数 calc）→ 超时、还租约、租约有效期三个量（90 秒 calc）→ 依赖与限制 → 验收 → GLM 双机（每台端口数 calc、固定基数撞号、60 秒租约门槛）→ 常见误解 → 对照源码。
- 新图 `wiki/diagrams/rfork-config-ports.yaml/.svg`：A、B 两台机器，Planner 在上；1 业务方→A 的 API 端口，2 两边 RFork 进程→Planner（登记/心跳、借/还），3 B→A 的 seed 元数据服务，4 两端传输引擎端点之间读权重字节；子标题写每类端口由什么决定。只用本页自己的临时脚本渲染了这一张，没跑全量 `wiki:diagrams`，避免改到别的写手的 svg。
- 「参数类内容保持 4 段式」按 管什么 / 默认值 / 什么时候改 / 填错会怎样 四段落实：前三段在设置表四列里，第四段集中在「为什么要专门讲配置」的三种后果表和「键名写错」一节。
- 对照源码：会报什么错改写首两条并新增「设置包不是 JSON 对象」「端口绑定失败」；开销节补四行日志原文和示例 Planner 的租约/名额机制；版本差异只链接总览页版本表；源码位置全部给到行号，末尾加四条待核。
- frontmatter：只改 summary（151 字）与 updated；sources 区未读未动。

### 改正旧版的两处说法（P1 级，按源码）

1. 旧版说「身份串或策略名留空，加载一开始就会失败」。实际：`RForkSession.__init__` 抛的 `ValueError` 发生在 `load_model` 的回退保护内（`rfork_loader.py#L563-L565` 创建会话，`#L652-L655` 捕获后记 warning），随后走默认加载；会话为 None，`#L698-L702` 不登记 seed。Planner 地址为空同理。已改成「warning + 退回正常加载 + 不当 seed」。
2. 旧版说主模型与草稿模型「也可能」用同一 rank 撞端口。实际：global rank 取自 `torch.distributed.get_rank()`（`rfork_loader.py#L446`），两者同进程，`session.py#L364-L379` 无任何按 draft 偏移的逻辑，固定基数时必然同端口；`seed_server.py#L105-L124` 只设 `SO_REUSEADDR`，后起者绑定失败，`session.py#L414-L425` 记 warning 后不当 seed。正文标注「按源码推断，未实测」。

### 数字出处

- 默认值 5/10/30/3/30 秒、别名、环境变量：`rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L11-L139`。
- 端口 1223、租约 TTL 60 秒、心跳 TTL 60 秒、清扫 5 秒、名额 1：`rfork@3284850b:examples/rfork/rfork_planner.py#L39-L75`；工作版指南示例命令同为 1223 / 60（`docs/source/user_guide/feature_guide/rfork.md#L183-L224`、`#L267`）。页面示例里的 8000、10.0.0.x 沿用旧版命令块（未改）。
- GLM：16 卡、TP8/DP2/EP16/W8A8 链 D 页部署前提；node0 带 API、node1 headless 取 01 §A0；每卡 8 Worker × 主/草稿 2 套会话、32 次借用取 01 §A0.8「在我们部署下的具体数字」与总览 GLM 节；主模型会话每卡约 20.09 GiB 取 01 §A0.8 / 总览「每张卡读多少」，本页只链接不重算；0.33 GiB/s = 20.09 ÷ 60 是本页唯一新算的数。
- 每台 32 个端口 = 8 × 2 × 2：会话数取 01 §A0.8，每会话一个传输端点（`session.py#L49` 每个会话 new 一个 `RForkTransferBackend`，`transfer_backend.py#L220-L229`）+ 一个 seed 端口（`session.py#L380-L392`）。

### 核心概念对照

- 回退保护范围、严格校验时机：`rfork_loader.py#L416-L418`、`#L563-L565`、`#L652-L702`；`config.py#L69-L81`。
- 传输端点 IP/端口：`transfer_backend.py#L220`；`vllm@0fc695fc:vllm/utils/network_utils.py#L33-L69`（`VLLM_HOST_IP` 优先）、`#L150-L221`（`VLLM_PORT`）。
- 心跳不续租、租约过期释放名额：`rfork_planner.py#L210`（只在发出时写 `leased_at`）、`#L276-L286`；指南 `rfork.md#L222-L224`。
- seed 侧不看租约（`seed_server.py` 无 lease 字样），所以租约过期不打断读取。

### 旧版信息清单勾选（清单在 scratchpad `p5/rfork-config-facts.md`，F1–F37）

- F1–F4、F6–F8、F10–F11、F13–F23、F25–F31：正文保留或改写后保留，全部 ✓。
- F5、F12：保留并按源码改正（见上「改正」1）。
- F9：保留，补「端口基数的三种非法值同样在 `__init__` 报错」。
- F18：保留并加强（见上「改正」2），GLM 节落到 node0/node1 端口段。
- F24：保留，补示例 Planner 60 秒、心跳不续租、过期后名额被放回。
- F25：「openYuanrong」统一成总览页用的「YuanRong 数据系统」。
- F3：保留在第一节末。
- F32–F35（示例 Planner、启动示例、只读检查脚本、`yr.datasystem` 三接口）：对照源码「怎么开」「会报什么错」原样保留，代码块未动。
- F36：版本差异改为只链接总览页版本表（本批验收要点）。
- F37：源码位置扩成带行号的清单。
- 删掉的：无。

### 验证

- `pnpm wiki:lint`：本页 0 报错（期间出现过别页 rfork-transfer 缺 svg 的报错，非本页）。
- 本图单独渲染并 `--check` 一致；全量 `pnpm wiki:diagrams --check` 通过（284 张一致）。
- `pnpm wiki:audit` 通过；临时把本页放进写作标准名单跑 `auditStandard`：行内代码 0/千字、角标 0、calc 0.56/千字、相邻块 0、图先行、免责 0.0%、图宽，全部 ✓（未改 standard-pages.json）。
- Playwright 只读打开 5193 `#/wiki/rfork-config` 截图：直觉图、三个 calc、设置表渲染正常；控制台 4 条 502 来自后端接口，与本页无关。

### 跳过 / 未做

- 没看参考图库 refs（本页不涉及通信原语与 TP/DP/EP）。
- 「怎么开」里三个代码块按纪律未读正文，只 grep 了端口相关的几个值。
- 待核四条已列页末：生产 Planner 的 TTL/名额/回码；GLM 实机读速；主/草稿撞端口实机日志；YuanRong 是否另用端口。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（第 21 批，2026-10-02）。只审未改页面。

**分数：8 / 10**。学习顺序通过；audit 本页通过；P1 0 条；P2 3 条；P3 4 条。

### 初学者测试（只读前两屏）

我的一句话：RFork 配置就是在 B 的启动命令里加一个「用 RFork 加载」的开关和一包 JSON 设置（身份、Planner 地址、seed 地址与端口、心跳和还租约），代价是多数写错不报错，只会悄悄退回正常加载或用默认值，所以服务能起来不等于配对了。——能说清。

### 学习顺序

第一屏问题式 H2 + 一句话 + 四类端口直觉图 → 为什么要专门讲（三种后果表）→ 四个名字 / 十一项 / 键名 / 端口（带 calc）→ 超时与租约、依赖、验收 → GLM 双机 → 常见误解 → 对照源码。GLM 数字只在 GLM 节（L235–L260），基础节用示意数。**通过**。

### 写手改正的两处说法（独立对照 `rfork@3284850b`，即仓内 `rfork/source/`）

1. 必填项留空：`session.py#L37-L43` 对 Planner 地址、`model_url`、策略名为空抛 `ValueError`；会话在 `rfork_loader.py#L563-L565` 的 try 内创建（`#L535` 先置 `session=None`），`#L652-L655` 捕获后记 warning 走默认加载；`#L702` 要求 `session is not None` 才登记 seed。页面 L99、L119、L161 的「warning + 退回正常加载 + 不当 seed」**正确**。
2. 主/草稿撞端口：`rfork_loader.py#L446` global rank 取 `torch.distributed.get_rank()`，主/草稿同进程同值；`#L149-L150` 两套会话只是属性名不同，共用同一个 `load_config`（01 §A0.8 第 9 步亦写草稿继承主模型 `load_config`）；`session.py#L364-L379` 无 draft 偏移；`seed_server.py#L105-L124` 只设 `SO_REUSEADDR`，后绑定者失败；`session.py#L415-L425` 记 warning 返回 False。页面「固定基数时必然同端口、后起的那套不当 seed」**正确**。

### 「怎么开」三个代码块抽查

- 设置包键名与默认值：`model_url`、`model_deploy_strategy_name`、`rfork_scheduler_url`、`rfork_seed_advertise_host`、`rfork_seed_port_base` 0、`rfork_request_timeout_sec` 10.0、`rfork_heartbeat_interval_sec` 30.0、`rfork_lease_release_max_attempts` 3、`rfork_lease_release_retry_interval_sec` 30.0，与 `config.py#L84-L139` 一致；`--load-format rfork` 对应 `rfork_loader.py#L414` 的注册名。
- 示例 Planner：`--host/--port/--lease-ttl-sec/--heartbeat-ttl-sec/--default-resource-points/--alloc-policy` 均存在（`examples/rfork/rfork_planner.py#L545-L580`），默认端口 1223、租约 60（`#L39`、`#L69-L75`）。
- 只读检查脚本：`yr.datasystem`、`batch_register_memory_ex`、`batch_unregister_memory`、`batch_transfer_sync_read`、`finalize`、`MemoryRegistration`、`kNotReady`、`kNotFound` 在 `transfer_backend.py` 均有对应（L209–L232、L405、L478、L584、L760）。
- 结论：一致，无问题。

### 其他核心概念抽查（均正确）

- 七项环境变量名与「同名大写」相符，端口基数和三项运维字段无环境回退（`config.py#L92-L139`）。
- 两超时宽松、别名看第一个出现的键（`config.py#L18-L52`）；端口基数 `"35000"`、`35000.0` → 0，bool 透传后被 `#L80` 拒（`#L132`）。
- 每个会话构造时即初始化传输端点（`session.py#L49` → `transfer_backend.py#L189-L229`），每台 8×2×2=32 个端口推导成立；全局 rank 0–15 与 01 §A0.8「EP 组序号 = 全局 rank」一致。
- 20.09 GiB 与 01 L478、总览 calc 的 20,572 MiB 一致；20.09÷60≈0.33 GiB/s 手算无误。calc 35000+3、65530+7=65537、3×10+2×30=90 均无误。

### 旧版信息清单

`13898c74…/scratchpad/p5/rfork-config-facts.md` 存在（F1–F37）。抽查 F1、F7、F12、F13、F17、F21、F22、F29、F30、F33 到新版，均在（L70–L73、L150、L160–L163、L180–L189、L200、L206–L211、L225、L229、L314/L336）。`git diff` 删除行逐段对过，旧「来源服务/全局编号」改称 seed / 全局 rank，内容未丢。写手勾选基本属实；F18「保留并加强」时把旧版的「隔开实例」建议也一并留下了，见 P2-2。

### P2

1. **同页重复（注水）**：四类端口在第一节列表 L81–L86、「四类端口」表 L169–L178 各讲一遍，「端口基数只固定第 3 类」在 L86、L178、L265 和图注重复，「租约归 Planner、B 改不了」在 L82、L202、L260、L267 重复。改法：第一节每类端口只留一句「谁的、干什么」，删 L86（交给后文）；「四类端口」节去掉与第一节重复的表或只保留「由什么决定」一列并入正文，误解节保留。
2. **L189 补救建议与 L256 矛盾**：「开了投机解码时，要么保持随机端口，要么按实际部署把实例隔开」——主/草稿在同一 Worker 进程里，隔开实例解决不了它们之间的撞号，只有基数为 0 能避开（L256 写对了）。改法：拆成两句——同机多个实例：隔开或错开基数；开了投机解码：只能保持端口基数 0，并确认两个模型角色的 seed 服务都起来了。
3. **「后果只有三种」不全，4 段式里「写错会怎样」缺两项**：监听地址填成本机没有的 IP、固定端口被占或撞号，会落到第四种后果——自己照常起来（借到或退回都可能），但 seed 服务起不来、不当 seed（`seed_server.py#L105-L124`、`session.py#L415-L425`）；宣告地址填错则是登记成功、别人借不到。L94–L100 的表和设置表都没有这一类，监听地址、宣告地址两项的「写错会怎样」无着落。改法：三种后果表加第四行「能起来，但当不上 seed / 别人借不到」，列出这三种情况和对应 warning。

### P3

1. L222「这两个开关一个在并行参数里，一个在附加设置里」：源码有三个触发项（`parallel_config.enable_eplb`、附加设置 `eplb_config.dynamic_eplb`、`expert_map_record_path`，`rfork_loader.py#L373-L382`），附加设置里的 `dynamic_eplb` 在正文漏了（对照源码 L383 有）。改成「并行参数或附加设置里打开动态 EPLB，或配专家分布记录路径」。
2. L82、L247「Planner 是集群外的」：源码与底稿无此说法，示例里 Planner 可跑在任一台机器。改成「推理实例之外的独立服务」。
3. 「seed」「租约」在 L71、L82 首次出现没有半句解释（图里「已在服务，当 seed」算半个）。建议首次出现处各补半句，如「被借权重的实例叫 seed」「租约 = Planner 发的一次借用许可，到点收回」。
4. 直觉图里 A 侧编号 2（登记、心跳）从「seed 元数据服务」框发出，实际登记与心跳由 Worker 里的 RFork 会话（Planner 客户端，`session.py#L393-L406`）发出，读者可能以为 seed HTTP 服务自己去连 Planner。可在 A 里补一个「RFork 会话」小框，或把箭头起点挪到框外并在图注说明。

### 验证与截图

- `pnpm wiki:audit`：通过，本页行无报错（evidence=C，正文 17,486 字 / 12 节）。
- `pnpm wiki:lint`：通过（5 处待留意均为别页）；全库入链 11 个文件，无锚点入链。
- 对照源码以上：0 角标、0 行内代码；三个 calc 分属三节，均不与表格相邻；无分镜动图；无 meta 文本。
- Playwright 只读打开 5193（1440 宽）：第一屏 `scratchpad/rfork-config-review-first.png`、直觉图 `scratchpad/rfork-config-review-diagram.png`（审查员会话 1237c9d2 的 scratchpad）。第一屏为问题式 H2 + 一句话 + 图开头，图清晰；控制台 502 来自后端接口，与本页无关。

### 跳过

- 「对照源码」的「会报什么错」「开销和什么时候别开」正文未读，只 grep 了绑定失败和 EPLB 两行；「源码位置」只读了路径清单。
- 未看参考图库（本页不涉及通信原语与 TP/DP/EP）。
- 无读取被拦。

## P5 修订记录（2026-10-02，Opus 写手）

逐条对应「P5 审查」：

- **P2-1 同页重复：已改。** 第一节四类端口每类只留「谁的、干什么」，删掉「设置包能管到的只有两处…」整段；「四类端口」一节把与第一节重复的表换成只讲「由什么决定」的四行列表。H2 标题保留原名，因为 rfork-maintenance.md 第 99 行有锚点 `#四类端口谁监听谁来连由什么决定` 指向它（试改名时 lint 报 broken-anchor，已改回）。「端口基数只管第 3 类」从图注删掉，只留端口一节和误解节。「租约归 Planner、B 改不了」从第一节删掉，集中到「超时、重试间隔和租约有效期」一节（并入「一个 seed 借给几家」的名额），GLM 节缩成「不够时调 Planner 的租约有效期」，误解节保留。
- **P2-2 补救建议矛盾：已改。** 端口一节拆成两种撞号两种补救：同机多实例可隔开实例或错开基数；投机解码时主模型与草稿模型同进程同 rank，只能保持基数 0。对照源码「开销」里的同一条也改成同样说法。依据：`rfork_loader.py#L446` global rank 取自 `torch.distributed.get_rank()`；`session.py#L364-L379` 无 draft 偏移。
- **P2-3 后果分类不全：已改。** 「后果只有三种」改为「分四种」，表加第四行「自己照常起来，但当不上 seed，或登记了别人也借不到」：监听地址填成本机没有的 IP、固定端口被占或撞号（`seed_server.py#L105-L124` 绑定失败 → `session.py#L414-L425` warning 后不当 seed）；宣告地址填错（登记成功，来借方取清单失败后回退）。十一项一节的「已经归成三种」同步改成四种。
- **P3-1 EPLB 触发项：已改。** 改为「在并行参数或附加设置里打开动态 EPLB，或在附加设置里配了专家分布记录路径」，对应 `rfork_loader.py#L373-L383` 三个触发项。
- **P3-2「集群外」：已改。** 第一节与 GLM calc 旁注都改成「推理实例之外的独立服务」。
- **P3-3 seed、租约首现无解释：已改。** 首段补「被借的一方叫 seed」；第一节 Planner 一条补「租约（一次借用许可，到点收回）」。
- **P3-4 图中登记、心跳的起点：已改。** A 侧编号 2 的虚线改从实例 A 的机框边上出发，不再从 seed 元数据服务框发出；旁注改为「A 的 RFork 会话：登记、心跳」，图注改为「A、B 各自 Worker 里的 RFork 会话都去连 Planner」。依据：`session.py#L393-L406` 心跳线程跑在会话里，调 `planner.run_seed_heartbeat`。

验证：

- `pnpm wiki:lint` 通过，本页 0 报错；`pnpm wiki:diagrams --check` 285 张一致（本图只用临时脚本单独重渲染）。
- `pnpm wiki:audit` 最终输出 ok（中途有一次「失败 4 处」，来自别页写手的中间状态，复跑后消失）。本页还不在 standard-pages.json 名单里，所以 audit 输出没有本页的「写作标准」行；用临时脚本把本页按名单页跑 `auditStandard`：行内代码 0.0/千字、角标 0、对照源码、calc 0.55/千字、相邻块 0、图先行、免责 0.0%、图宽，全部 ✓，problems 0。
- Playwright 只读截图 5193：新图的箭头起点、四行后果表渲染正常。
