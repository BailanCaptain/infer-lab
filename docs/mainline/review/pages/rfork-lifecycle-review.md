# rfork-lifecycle 审查记录

## P5 写作记录（第 23 批，2026-10-02，Opus 写手）

### 改了什么

- 按「是什么 → 为什么 → 怎么走（示意数）→ 细节 → GLM 双机 → 常见误解 → 对照源码」重排全页，14 个 H2。正文（对照源码之前）2,812 → 6,318 字（写作标准口径）；全页 7,684 → 约 16,700 字（wiki:audit 口径，含源码区英文日志原文）。
- 标题、summary、aliases（补四个类名、`can_schedule_seed`、`RForkSession`）、relations（加 rfork、rfork-startup）、updated 改为 2026-10-02。
- 第一屏：问题式 H2「B 的权重传完了，它算『起来了』吗」，把「起来了」拆成权重传完 / 交出模型 / 当上 seed / 接请求四个时刻，再定义生命周期与加载会话（RForkSession，TERMS 里该词归属本页），配一个 503 → 30 秒后 200 的具体例子。
- 直觉图 `rfork-lifecycle.yaml` 重画：三条线的状态转换——模型线（读权重 → 权重传完 → 交出模型 → 实例接请求）、当 seed 线（等租约还上 / 发布 seed / 服务中 / 不当 seed）、失败线（清理 → 回退）和进程退出收尾。即队列要求的「权重就绪、seed 发布、请求可服务和清理的状态转换」。
- 新增代码流程图 `rfork-lifecycle-threads.yaml`：时间轴四条泳道（启动线程、还租约线程、seed 服务、心跳线程），示意数与正文 calc 一致（3 秒交出、2 秒收 503、隔 30 秒、34 秒确认、36 秒服务中、66 秒首次心跳）。
- 新增内容（旧版没有）：七个状态里「进就绪前是否重新登记显存看布局」「心跳失败不改状态」「停服务回到就绪」；还租约线程「一张租约同时只有一条」、异常与准备出错按被拒、日志的「rejected」警告对 503 也打、同一会话再借先看旧账（接住 rfork-startup 第 133 行指向本页的那条）；发布 seed 的 7 步检查顺序；回退前清理结果三项与 `can_schedule_seed`（接住 rfork.md「回退前的清理结果在生命周期页展开」）；回退后再发布时延期/直接发布两种情形；关停挂在进程退出钩子上、撤销登记自身 3 次重试、等心跳线程上限 21 秒 calc；被拒后显存登记不注销；「四件事分开验收」表（队列验收要点：加载、传输、发布 seed、可服务分开验收）；GLM 32 个会话、心跳频率 calc、主模型与草稿的先后、端口撞号、冷启动直接发布。
- 400 与 TTL：按源码写清「400 本身不能证明 TTL 过期」——示例 Planner 过期走 404（先清过期租约再查编号，查不到或身份不符回 404「lease not found」），400 只在请求头缺字段或取值不合法时出现；现场 Planner 的 400 含义只有设计文档里一次现场记录（响应体没留下；伪造编号试探只说明不存在编号怎么回），不当定论。
- 对照源码五个 H3 齐全；版本差异补了社区版 v0.23 / v0.26 / main 的实际行为（同步发一次 put_seed、只认 200、失败只记日志后丢掉租约、照常起 seed 服务，三版本一致），以及工作版内部「早先同步还租约 → 现在后台有界」的变化。
- sources 由 13 条增到 20 条：rfork_loader.py 83–110、621–710，设计文档 rfork_lease_lifecycle.md 1–160，社区版 2c59ff10 的 rfork_worker.py 102–108 与 seed_protocol.py 157–187，baa023ad 的 rfork_loader.py 393–405，session.py 38–62。全页角标 26 处，C 级 20 处（77%）。

### 数字出处

- 32 个会话 / 32 张租约、主模型每卡约 20.09 GiB、草稿约 844 MiB、seed 端口 = 基数 + global rank、默认 3 次 / 30 秒 / 心跳 30 秒：主线底稿 01 §A0.8「怎么走的」第 7、9 步与「在我们部署下的具体数字」；字节只链接 rfork.md，不重算。
- 「无就绪耗时实测值」：页内不写任何 GLM 就绪耗时；设计文档里一次约 23 秒的登记加传输观测（未注明模型）只放在「开销」里，明说不是上限、不是 GLM 的数；待核第 2 条列出要收集的日志。
- 心跳频率 32 ÷ 30 ≈ 1.07 次/秒、关停等待 max(5, 10+10+1) = 21 秒：由钉住版本默认值算出（config.py 11–15、session.py 32 的 HEARTBEAT_STOP_GRACE_SEC = 1.0）。
- 时间轴与第一个 calc 是示意数，页面上已标明。

### 核心概念对照（rfork@3284850b，读法 `git -C tools/repos/rfork show 3284850b:<path>`）

- 七个状态与迁移：types.py 12–19；session.py 50（INITIALIZED）、90（LEASED）、117（开始登记即 CLEANUP_REQUIRED）、137（TRANSFERRED）、200–201（归还成功时 LEASED → INITIALIZED）、255–272（注销后回 LEASED / INITIALIZED）、321–335（重新登记后 READY）、408（SERVING）、466–469（停服务回 READY / 待清理）、490（FINALIZED）。
- 还租约：session.py 150–218（单线程守卫、锁内取租约、锁外请求、同租约对账、REJECTED 或耗尽后取消延期且不注销）；planner_client.py 111–155（200/404 → RELEASED，408/429/5xx 与 RequestException → RETRYABLE，其余与准备失败 → REJECTED，allow_redirects=False，非 200/404 先打 rejected 警告、响应体截 256 字符）。
- 发布 seed：session.py 296–347（7 步检查顺序）、349–425（端口、首次 add_seed、心跳线程、失败时停服务并注销）；rfork_loader.py 83–110（DEFERRED 返回 False 不打警告，FAILED / 异常打 warning，均照样返回模型）。
- 回退：types.py 37–49（三项字段，`__bool__` 三项全真，`can_schedule_seed` 只看服务与显存）；session.py 274–287；rfork_loader.py 59、657–671、697–709。
- 关停：session.py 62（atexit 注册）、427–451（join 上限）、477–501；planner_client.py 18–21、169–211（撤销登记 3 次、0.1 × 次数退避）。
- 心跳：planner_client.py 237–267（initial_delay 先等一个间隔、失败只记警告、请求结束后再等）。
- 示例 Planner：rfork_planner.py 39–75（两个 TTL 默认 60）、215–229（put_seed 先 gc 过期租约）、276–287、410–416 与 468–484（HeaderError → 400，未找到 → 404）。
- 设计文档：docs/source/developer_guide/Design_Documents/rfork_lease_lifecycle.md 5–27（现场 400、响应体未留、伪造编号试探、示例 404 会掩盖提前过期）、39–55（晚申请、约 23 秒观测）、77–115（后台有界归还、早先同步做法、不把 400 当成功）、116–160（续租提案未实现）。
- 社区版：vllm-ascend 2c59ff10 / 2ed6cbba / baa023ad 的 rfork_worker.py `post_transfer` 与 seed_protocol.py `release_seed` 一致（seed_protocol.py 三版本相对 db701c1f 无 diff；2ed6cbba 的 loader 差异只是去掉 layer_sharding 绕过；baa023ad 的 post_transfer 文本相同）。

### 旧版信息清单勾选（清单在 scratchpad `p5/rfork-lifecycle-facts.md`，F1–F44）

- F1–F3（400 场景、后台有限重试、不假装成功、不续租、被拒后不当 seed 但模型可交出）：§为什么要拆开、§还租约、§五个钟。
- F4（「卡住」要分五处看）：§常见误解最后一条，链接 rfork-troubleshooting「卡住了」一节。
- F5–F7（七阶段表与「不能推断」、待清理在正常传输中也会进入、就绪/服务中不是 vLLM 就绪信号）：§会话的七个状态。
- F8–F13（后台线程、一租约一线程、锁的三步、三类结果、3 次 / 30 秒、被拒后状态、不占锁只限这段）：§按时间走一遍、§还租约。
- F14–F22（四种请求与 404 语义、get_seed 响应头要求、REFCNT 0、示例 Planner 404 不证明按时、生产 Planner 400/404 不能照搬）：§400 和 404，细节表在「会报什么错」。
- F23–F25（五个钟、心跳不碰租约起算、无续租与短 TTL 风险）：§五个钟；GLM 的 TTL 够不够链接 rfork-config。
- F26–F27（三种发布结果、延期只承诺还上就发布）：§发布 seed。
- F28–F32（关停顺序、join 上限、留资源、单进程内存字典、本机租约方向）：§关停。
- F33（三条误解）：§常见误解，另加四条。
- F34–F42（键名默认值、状态名、结果名、四接口、lease= 哈希、版本差异、源码位置、renew_seed 与 leased_at）：§对照源码各 H3。
- F43（rfork-review P5 修订记录 P2-1 写的「类名留给 rfork-lifecycle 展开」）：那条记录已更正为「类名放在 rfork.md 源码位置，机制在本页」。本页接住两件：「会报什么错」列出 RForkLifecycleState、LeaseReleaseResult、RForkSeedServiceStartResult、RForkFallbackCleanupResult 及取值；正文新增「中途失败：清理结果决定能不能回退」一节，展开 rfork.md 第 170 行指向本页的「回退前的清理结果」。transfer_from_seed / fetch_seed_transfer_info / ImportError 已在 rfork.md 与 rfork-transfer 处理，本页只在源码位置提 transfer_from_seed。
- F44（rfork.md 章节表：为什么传完了还不能成为 seed、什么时候允许回退或销毁）：§为什么要拆开、§中途失败、§关停。
- 删除：无。旧版第一节「400 场景」改成 503 例子开篇，400 的结论挪到 §还租约与 §400 和 404。

### 讲法

- 参考图库（refs/）只有通信原语与 TP/DP/EP 的讲法，本页不涉及，未借用；按「先直觉再演算」用状态图 + 时间轴 + 示意数 calc。
- 未加 exchanges 动图（09-29 暂停令）。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错（每写完一段保存后都跑过）。
- `pnpm wiki:diagrams --check`：287 张图与 spec 一致；本页两张图无规则告警。
- `pnpm wiki:audit`：本页 20 条来源全部 ✓，0 条有问题；图钉 symbols 无报错。
- 写作标准（本页不在名单内，用 scripts/wiki/standard.ts 的 checkStandard 单独量）：正文 6,318 字，行内代码 0/千字，角标 0（对照源码之上），calc 0.47/千字，相邻块 0，图先行，免责 0.6%，图宽合格。
- 5193 只读截图（Playwright，未起停服务）：首屏、时间轴图、GLM 一节渲染正常，控制台 0 报错，14 个 H2 都正常渲染。

### 跳过 / 未做

- 没读 HANDBOOK 与 docs/plans/。
- 没碰 rfork-transfer、rfork-official-guide、rfork-maintenance 等别的写手正在改的页；scripts/wiki/standard-pages.json 未改。
- 疑点（留给审查核）：生产 Planner 的 400 语义只有设计文档里的现场描述；端口撞号、草稿词表张量钉住两条沿用 rfork-config / rfork.md 的源码推断，未实测。

## P5 审查（09-29）

审查人：独立审查员（Opus 5.5），2026-10-02。只审未改页面。读法：正文用去 frontmatter 的 awk 分段读，源码 `git -C tools/repos/rfork show 3284850b:<path>` 先 grep 行号再读 ≤20 行。

**分数：8.5 / 10。** P1 0 条，P2 1 条，P3 6 条。学习顺序通过；audit 本页 20 条来源全 ✓；写作标准（本页不在名单，单独用 checkStandard 量）全 ✓。

### 初学者测试

只读前两屏能说出：B 借完权重后，「权重传完、交出模型、当上 seed、接请求」是四个不同时刻；替一个 Worker 记账的是加载会话；代价是当 seed 会推迟甚至当不上，「起来了」要分四件事分别取证。通过。

### 学习顺序

是什么（四个时刻 + 503→30 秒后 200 的例子 + 状态图）→ 为什么拆开 / 代价 → 七个状态 → 按时间走一遍（示意数 calc）→ 还租约、400/404、五个钟、发布、回退、关停等细节 → 四件事验收 → GLM 双机 → 常见误解 → 对照源码。基础节没有 GLM 数字（30 秒、3 次是钉住版本的默认值，不是部署数）；GLM 之后只有误解和对照源码。通过。

### 专项：400 与 TTL

通过。页面第 184–190 行把「400 本身不能证明租约过期」写成结论、理由三条，均与源码一致：
- 示例 Planner `put_seed` 先 `gc_expired_leases_locked` 再查编号，查不到或身份不符返回 False（`examples/rfork/rfork_planner.py#L215-L229`），接口转 404「lease not found」（`#L482`）；400 只来自 `HeaderError`（`#L472-L473`，`_required` / `_parse_int` 在 `#L379-L392`）。
- 现场 400 只有设计文档一次记录：响应体没留、伪造编号试探只说明不存在编号的回复（`rfork_lease_lifecycle.md#L12-L15`），页面原意转述准确，没有写成定论。
- 第 3 条「找不到不只过期一种原因」写成可能性，不是断言。
- 第 310 行常见误解也只说「示例里过期回 404，现场 400 要看响应体和服务端记录」。

### 出错 / 回退 / 报错说法逐条对源码

- 还租约三类结果（第 153–159 行）：`planner_client.py#L111-L155` 一致（200/404 → RELEASED；408/429/5xx 与 RequestException → RETRYABLE；其余、准备失败 → REJECTED；`allow_redirects=False`）；线程内异常按 REJECTED（`session.py#L180-L185`）。✓
- 「503 也打 rejected 警告」（第 167 行）：`planner_client.py#L140-L150` 先打警告再分类，✓；响应体截 256 字符、编号替换为 `<lease-id>`（`#L22`、`#L140-L141`）✓。
- 线程守卫「一张租约同时只有一条」：`session.py#L150-L168` ✓；重试间隔在收到回应后才开始等（`#L214`），calc 的 2 + 30 = 32 秒成立。
- 被拒 / 耗尽：取消延期、不注销显存（`session.py#L204-L213`）✓。
- 发布 seed 7 步顺序（第 212–218 行）：`session.py#L302-L347` 逐条一致；关停信号即 `lease_release_stop_event`（只在 `#L481` 置位）✓。第 7 步失败的清理（`#L414-L425`）✓。
- 加载器对三种结果的处理：`rfork_loader.py#L83-L110`，DEFERRED 返回 False 不打警告 ✓。
- 回退清理三项、`can_schedule_seed`、最多两轮、拒绝回退的 RuntimeError：`types.py#L36-L49`、`session.py#L274-L287`、`rfork_loader.py#L59`、`#L655-L672` ✓；回退后再发布的两种情形（`#L697-L709`）✓。
- 关停顺序、join 上限 max(5, 10+10+1)=21、撤销登记 3 次 0.1/0.2 秒退避：`session.py#L427-L452`、`#L477-L501`、`planner_client.py#L19-L21` ✓。
- 「会报什么错」15 条日志原文逐条 `grep -F` 对 `session.py` / `planner_client.py` / `rfork_loader.py`：全部逐字一致（`deferred seed promotion failed` 与 `seed promotion is deferred` 两条是 Python 相邻字符串拼接，拼起来与页面一致）；`lease=` 是 SHA256 前 12 位（`planner_client.py#L25-L28`）✓；`RForkSeedServiceStartResult.__bool__` 只认 STARTED（`types.py#L26-L32`）✓。
- 社区版本差异：`vllm-ascend@2c59ff10` `rfork_worker.py#L102-L108` 同步还一次后丢租约，`seed_protocol.py#L157-L187` 只认 200、失败只记日志 ✓。

### 数字

32 个会话 / 32 张租约、20.09 GiB、844 MiB 与 01 §A0.8（本节第 73、83、86 行）一致，字节只链接 rfork.md 不重算 ✓。两个 calc 手算：0→2→32→34→36→66 秒 ✓；32 ÷ 30 ≈ 1.07 ✓；max(5, 21) = 21 ✓。线程图 spec（`rfork-lifecycle-threads.yaml`）秒数与 calc 一致。约 23 秒观测对 `rfork_lease_lifecycle.md#L54-L55` ✓，页面明说不是 GLM 的数、不是上限。没有虚构 GLM 就绪耗时。

### 旧版信息清单

清单存在（旧会话 `p5/rfork-lifecycle-facts.md`，F1–F44）。抽查 F4（卡住分五处看，第 312 行）、F6（待清理在正常传输中也会进，第 111 行）、F11（3 次 / 30 秒，第 159 行）、F19（get_seed 字段在正文会被放弃，第 180 行）、F29（join 上限，第 254–260 行）、F32（会话租约是本机外借那份，第 267 行），另看了 F20、F39、F42：都在新版。写手勾选属实。

### 外页留给本页的内容

`rfork-review.md` 第 37 行原说「类名留给 rfork-lifecycle 展开」，第 127 行已更正为类名放 rfork.md 源码位置；本页「会报什么错」仍列出四个类名及取值 ✓。`rfork.md` 第 170 行指向本页的「回退前的清理结果」由「中途失败」一节接住 ✓；第 199 行章节表的问题由「为什么要拆开」「中途失败」「关停」三节回答 ✓。`rfork-startup.md` 第 161 行的「会话自己拒绝」与本页第 166 行对得上（见 P3-1 的小出入）。

### 链接与锚点

`pnpm wiki:lint` 通过（含跨页锚点硬校验），本页 0 报错；全库 16 个文件链到本页，都不带锚点，不受改标题影响。

### audit 与写作标准

`pnpm wiki:audit` 退出码 0，本页 20 条来源全部 ✓。本页不在 `standard-pages.json` 名单内，用 `checkStandard` 单独量：6318 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.47/千字 · 相邻块 0 · 图先行 ✓ · 免责 0.6% · 图宽 ✓，全 ✓。对照源码五个 H3 齐全、顺序正确，版本差异里有 v0.23、v0.26、main。

### 浏览器

Playwright 只读打开 `http://localhost:5193/#/wiki/rfork-lifecycle`（1440 宽，未起停服务），控制台 0 报错，5 个 figure（2 张图 + 3 个 calc）都渲染出来。截图：scratchpad `rfork-lifecycle-review-first.png`（第一屏）、`rfork-lifecycle-review-fig0.png`（状态图）、`rfork-lifecycle-review-fig1.png`（线程时间轴）。没有新加分镜动图。

### P2

- **P2-1 GLM 一节没说部署其实没开 RFork，也没说这是推演。** 位置：第 285 行与第 302 行。问题：01 §A0.8 第 74 行写明官方 GLM 双机教程没开 RFork，§A0.8 开头的版本口径写明工作版 rfork@3284850b 里没有 GLM 模型代码、本节是两边放在一起推演（rfork.md 第 212 行也写了教程没开）。本页第 302 行「现在只有一个实例。第一次冷启动时 Planner 上没有来源，32 个会话都走回退……直接发布」读起来像是现有部署的实际行为。没有虚构数字，所以不记 P1。改法：在第 285 行开头补一句「教程命令没开 RFork；下面按加了 `--load-format rfork`、再起一个同构实例推演，工作版里没有 GLM 模型代码，见[总览](rfork.md#这套部署现在能不能受益)」；第 302 行改成「如果开了 RFork，第一次冷启动……」。

### P3

- P3-1 第 166 行「先看旧账」比源码窄。`session.py#L66-L73`：手里还有没了结的租约时，即使线程没在跑、也没停止重试，会话也会先补起一条还租约线程，然后这次不借。改法：补成「线程还活着、已停止重试，或者手里还留着没还的旧租约（这时会先补起还租约线程）」，与 rfork-startup 第 161 行一致。
- P3-2 第 92 行图下说明和状态图里「当 seed 线从交出模型那一刻分出来」。源码是先调发布、再 `return model`（`rfork_loader.py#L83-L110` 与 `#L637-L644`），第 210 行正文也写的是「模型交出之前」。租约若在交出前就已确认，seed 服务会在交出模型之前起来。改法：说明改成「从交出模型前的那次发布分出来」，或在图下补半句。
- P3-3 第 220 行把「失败」和「抛异常」合成一条「模型已经就绪……」的警告。源码中抛异常那条是 `logger.exception`（error 级，带堆栈），措辞是 `seed service startup raised; inference can continue.`，没有 is ready。改法：分开说，并在「会报什么错」补上异常那条原文。
- P3-4 第 99 行「工作版的设计文档也要求……或者 Planner 给出的明确过期结论」出自续租提案一节（`rfork_lease_lifecycle.md#L149-L153`），这一节没实现；当前客户端只认确认过的归还（200/404）。改法：写明是续租提案里的要求，当前代码只认 200/404。
- P3-5 「五个钟」表里的单次请求超时、seed 健康检查两行，以及第 206 行「到期只改账本、短 TTL 名额会再借出」，和 rfork-config 第 197–213 行基本重复。这是本页旧版就有的内容（F23–F25），不记 P2。可以把第 206 行后半压成一句 + 链接到 rfork-config「超时、重试间隔和租约有效期是三个量」。
- P3-6 线程时间轴图：启动线程 0–3 秒、还租约线程 0–2 秒和 32–36 秒这几段没有文字，初学者不知道深色块是什么。改法：给 0–3 秒标「后处理」，32–34 秒标「第 2 次还」，34–36 秒标「起服务、首次登记」。

### 跳过

对照源码里「开销和什么时候别开」「版本差异」「源码位置」三段按通用做法没读正文，只 grep 了第 375、383、403–404 行；没读 sources 区、HANDBOOK、docs/plans/。没有被拦的读取。

## P5 修订记录（2026-10-02，Opus 写手）

- **P2-1 已修。** GLM 一节开头加一段前提：官方 GLM 双机教程的命令没开 RFork，工作版代码里没有 GLM 模型实现，本节是「加上 RFork 加载、再起一个同构实例」时把工作版加载器和 GLM 模型放在一起推演的，不是现有部署的实测行为，链接 rfork.md「这套部署现在能不能受益」。只在开头集中说一次，没有逐句加限定词。「现在只有一个实例」一段改成「如果给它开了 RFork，第一次冷启动时……」。依据：01 §A0.8 开头的版本口径与「适用条件」里的官方 GLM 教程一条。
- **P3-1 已修。** 「同一个会话再去借时，先看旧账」补上第三种情况：手里还留着没还的旧租约时，会先补起一条还租约线程，这次不借（session.py 66–73 → _release_seed_locked → _ensure_lease_release_retry_locked）。
- **P3-2 已修。** 状态图下的说明改成「当 seed 那条线从交出模型之前的那次发布分出来；租约早已确认的话，seed 服务会在交出模型之前就起来」（rfork_loader.py 636–644：先发布、后 return model）。图本身的箭头起点在「交出模型」方块上，和说明一致，未改图。
- **P3-3 已修。** 正文把「失败」和「抛异常」分开：失败打 warning「模型已经就绪、seed 服务没起来」；抛异常打 error 级带堆栈的日志。「会报什么错」补上异常那条原文 `RFork %s model loaded from %s, but seed service startup raised; inference can continue.`（rfork_loader.py 91–99）。
- **P3-4 已修。** 「借来的账没了结」一条改成：当前代码只认确认过的归还（200/404）；「Planner 给出明确过期结论」只出现在设计文档的续租提案里，没有实现。
- **P3-5 已修。** 「现在没有续租」一段后半压成一句，TTL 太短的后果和几个时长怎样一起评估链接到 rfork-config「超时、重试间隔和租约有效期是三个量」，GLM 的 60 秒估算仍链到「默认 60 秒的租约够不够」。五个钟的表保留（旧版 F23 的内容，本页是 TTL 一词的归属页）。
- **P3-6 已修。** 线程时间轴：启动线程那段改成「前 3 秒做后处理；之后交出模型，vLLM 接着往下启动」；还租约线程的三个深色块在时间轴下方标「↑ 第 1 次还」「第 2 次还 ↑」「↑ 起服务、首次登记」（文字放在轴下方，避开 wiki:diagrams 的重叠检查），画布高 250 → 268。

验证：`pnpm wiki:lint` 退出码 0（通过）；`pnpm wiki:diagrams --check` 退出码 0（288 张图与 spec 一致，本页两张图无告警）；`pnpm wiki:audit` 退出码 0（本页 20 条来源 0 问题，名单页写作标准通过）。按名单口径（scripts/wiki/standard.ts 的 checkStandard，阈值取 standard-pages.json）自测本页：正文 6,482 字，行内代码 0/千字，对照源码之上角标 0，calc 0.46/千字，相邻块 0，图先行，免责 0.6%，图宽，全 ✓。时间轴图用 Playwright 单独渲染截图核对过，未起停 5193 / 8790。
