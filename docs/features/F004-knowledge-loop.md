> **2026-11-15 渐进改造包 1 / 包 2 契约同步：** 依据 项目渐进改造与问题修复方案（历史归档 `../plans/2026-11-14-progressive-restructure-and-fix-plan.md`），知识闭环与审阅/整合管线同步以下契约：① **包 1（任务 `040` 已落盘并通过独立复审；当前工作区尚未提交 commit）：** 正式阅读页（`WikiDiagram.tsx`）与 `ReviewPane` 浏览器预览共享 `src/content/wiki/diagram-sanitize.ts` 的 SVG 正向属性值语法白名单清洗；`wiki:lint`（离线检查 `[diagram-missing]`）与 `wiki:audit` / `integration-check.ts`（`[diagram-identifier]` / `[diagram-symbol]` 单图同名符号去重、配合 `git.ts` 单次运行期有界缺失 SHA 负缓存）门禁分层；② **包 2（任务 `041` 待代码核验，核验前不冒充已验收现状）：** 复用 `supersede.claims`（`claims[].old` / `replacement` / `sources[]`）承载有证纠错，结合 `base.json` 校验 `editorial` / `supersede` 旧事实三出口守恒（本页保留/等价改写、同批候选 `Review.writes` 包含目标承接页且具备真实承接锚点与实际承接事实正文并过 `base` 校验的跨页迁移、或走 `supersede.claims` 有证纠错，并经独立语义复核；严禁拿 `sources` 数量不减/子串/数字/字数代替保真判断、无独占来源免检删句、或要求必须有新上游 commit 才准纠错三类伪判据）；`verified` 仅在对过该版本源码后凭真实核验回执登记（如 `pnpm wiki:versions --mark`），严禁无证据默认填满四版或机械补写；参数页自动生成区先经 `publishParamSync` / `pnpm wiki:lineage:apply` / `pnpm wiki:build-param-pages` 确定性入口刷新取新 `base` 再提正文修订，`review.ts:459-464` 继续严格保护自动生成区。
>
> **2026-11-02 00:32 八条既有 Wiki 警告已局部处理并验收收尾。** 四页整理重复引用与固定来源映射，一页合并分标签唤醒表格（保留 None、空列表、weights/kv_cache 条件及未实测边界）；另精确登记 DeepSeek 官方 Q&A 引用的单篇知乎文章与 Berkeley Lab 单个 Roofline 页面，未放开整站域名。五页经修订包 `208cfd470c7cb06028d0156d16ab3df4432eb9b6b4b4a21dcaff28e58434b683` 发布，未调用模型或整批重跑。
>
> **本次证据：** `tools/wiki-runtime/eight-warning-cleanup-20261102/completion.json`；独立复审 0 P1/P2，81 项相关测试、项目构建/类型、所改来源文件格式检查及 helper 严格类型通过。发布后实际 IAB 五页与截图通过，最终快照合法、Wiki Lint 0 error / 0 warning、待审 0 / 发布中 0、租约 inactive。815 份原审阅记录、423 个原任务及 1843 份受保护知识文件未改；来源顺序、raw、历史与生成区保留。全项目 `pnpm lint` 仍有另外四个共享 3D 文件格式错误（非本次改动，未覆盖），不据此声称全项目 Lint 通过。完整限制与日志见回执。
>
> **本轮无未决事项。** 本次只关闭上述八条警告，不扩大此前冻结范围，不将历史日更失败或未核项改称成功；每日任务与其他聊天保持原状。下方八条 warning 状态为历史。

> **2026-11-01 19:24 五份用户已发布建议的局部修正已验收收尾。** 按用户授权，MLA 已纠正为固定 GLM 配置 `qk_rope_head_dim=0`、`mla_use_nope=true`，主 attention 缓存为 512 维潜向量且无额外 RoPE 段；另四页（absolute-balance-threshold、CANN/HCCL、fused-op-type、GLM MLP 来源）已独立核源码与适用条件，修正错误归因、过期的“未核验”措辞及重复说明。共5页13处局部操作，经单一修订包 `d3e12631b99ff4f6237627bcdae0d1e13c3b3663b5672ba271a0b2430ff5448f` 于19:21发布，旧说法用真实 supersede 留史，未重新生成或整批重跑。
>
> **证据与保全：** `tools/wiki-runtime/five-post-publication-20261101/completion.json` 为本次权威回执；同目录独立复审0P1/P2，93条原raw绑定与18段补充固定源码核验，5页实际审阅差异和发布后页面/截图通过，正式字节与已审候选一致。原814份review、423任务均未改，期间7个其他共享知识改动完整保留；待审0/发布中0、daily-lease inactive、快照合法、Wiki Lint0error8条既有warning。38项相关测试、项目构建/类型检查、Lint及helper严格类型检查通过，未发送问题仍保留。
>
> **范围已结束：** 这5份已无本次未决问题；此前17份发布、8份重复退役及这5份核清共同结束本会话已授权收尾。历史日更失败与误筛审计未覆盖项仍按原回执单列，不宣称全库无问题或日更全部成功。临时nov1跟进此前已删除，Windows每日03:00任务和其他聊天保持原状。下方19:00“尚未验收”状态仅为历史。

> **2026-11-01 19:00 用户自行发布5份后的状态核对：** 这5份均已由批次 `96ba6e3d586b7ad11b9026a774f831de758e448be019738725411452ac711c0c` 原样发布，当前pending=0/publishing=0、daily-lease inactive。发布不等于语义验收：MLA原P2仍在，`wiki/concepts/mla.md:119` 新增位置段说法与同页257/289的GLM零RoPE宽度条件冲突；另4份的价值/措辞待确认状态没有因发布而消失。本次仅读取核对并记录，未改正文或review。证据 `tools/wiki-runtime/publication-seventeen-20261101/user-published-five-status.json`。下方“5份保留”是本助手此前交付时的历史状态。

> **2026-11-01 18:51：用户授权的17份有用建议已修正、对齐最新正文并同批发布；8份重复已退役留史，5份保留。** 发布父批次 `b97a53507868d1573357b342cd2c82d133de5584c498ddfdaf8d8c433f1133e6`，包含9份正文的15处条件/纠错/说明（含教学算例）和8条导航。14份以修正版接替旧包，3份复用既有包；中断表格、条件过宽和正式基线漂移已在限定增量内处理。未整批重跑、未调用模型，未处理其他失败或扩大清理。
>
> **保全和验证：** 当前待审仅4份待确认（absolute-balance-threshold、cann-hccl、fused-op-type、glm-mlp-version-source）及1份有问题的MLA，5份记录逐字不变。原798份payload全部保留，非本次任务与知识文件未变，13条固定源码/raw绑定再核通过；正式17页与已独立审查候选逐字一致。17份实际审阅差异与17个发布后页面均已核验；readKnowledgeSnapshot合法、Wiki Lint0error8warning，38项审阅/批次/退役/修订测试、项目类型检查和构建通过，项目Lint退出0（27warnings/3infos，无自动修复）。未发送问题“那它与 TP 有什么区别？”仍保留。
>
> **权威证据：** `tools/wiki-runtime/publication-seventeen-20261101/completion.json`、`final-verification.json`、`publication.json`、`ui-published-pages.json`；17逐项新旧ID、来源、精确delta、独立回执、UI快照及截图同目录。此次发布完成不改变下方Nov1日更部分失败及误筛覆盖边界；每日03:00任务与其他聊天未变。

> **2026-11-01 收尾：Nov1限定跟进已收尾，续接部分失败；未宣称整轮成功或零误筛。** 自然03:00仍是额度预检失败；授权续接13:15启动、17:48实际exit1，CIM父子进程均退出、daily-lease inactive。64新任务最终21待审/39失败/4因正文版本变化关闭；另有8个来源提取失败和1个关系组失败。成功分段与准确输入输出保留，未启动重试或下一轮。
>
> **本轮30份待审（28个正式页面）的独立价值审计及最终字节复核已完成：** 17份/17页含23处有用增量＝15处正文条件/纠错/说明（含1个教学算例）＋8条导航；8份重复、4份待确认、1份MLA适用条件错误。含有用增量不等于可直接发布：3份候选中断表格、3份有用关系须对齐最新正式基线，其他降格措辞见逐项审计。全部仍pending，本跟进未stage/reject/publish、未改原payload或正式页。
>
> **误筛结论有明确边界：** 30条被过滤关系当前都找到独立语义覆盖；其中27条完整原始pair绑定、2条已有边跳过已核、1条原pair仍不完整。95组旧决策复用中94组完整材料身份可验证，1组仍缺原始完整基线。54次正文补充判断为53保留/0丢弃/1失败，没有新的空包退役。85同源跳过中41份原批准增量仍在、14份历史退役另核；27旧版本关闭＋3旧失败未证明语义涵盖，6页当前来源变化另记。尚无已证实误筛，但不能据此保证整轮零误筛；失败与未核不计“没有价值”。
>
> **证据与保全：** 权威结果 `tools/wiki-runtime/nightly-resume-20261101/completion.json`，含30包/64任务逐项ID及全部证据hash；6493份实际证据文件最终hash校验无误，768份基线review未改，21正文包raw/指针/正式before与已审一致，关系原包与当前覆盖引文一致。最终readKnowledgeSnapshot合法、Lint0error8warning；共享编辑全部保留。39个worker失败中25个为校验保护、8个分段材料失败、2个schema、1个旧文绑定、2个传输、1个共享快照变化。未修改运行代码，不假定失败草稿已验收。
>
> **本次跟进结束：** 已向用户如实汇报部分失败与未验证项，并通过automation工具删除仅临时nov1，回执 `followup-deleted.json`；保留Windows每日03:00、其他任务和当前聊天。不延至下一晚；当前无需用户决定，若以后要处理这些保留项须以当时最新正文继续局部核对。下方进行中数字均为历史。

> **2026-11-01 17:47：当前30份新待审已完成首轮独立内容审计，续接尚未退出。** 64个本轮新任务为21待审/38失败/4因版本变化关闭/1运行，已无排队；实际CIM与lease最近17:44仍匹配，尚无exit，不重启、不循环重试。首轮21正文包：9份含15处有用增量、7份已涵盖、4份待确认、1份MLA遗漏GLM RoPE宽度为0的适用条件。9份关系包：8条有用导航、1份重复；合计17份/17源页/23处增量（含8条导航与1个教学算例，并非23条新事实），不代表可直接批准。C8/EPLB/LM-head三份候选中断表格；3份有用关系基线已漂移，后续需对齐。未改任何原包或正式页。
>
> **过滤与保全：** 39条关系原候选均独立语义核过；30条过滤当前有覆盖依据，其中27条覆盖判定已绑定原完整两端hash、2条为已有关系跳过，剩sampling→api-server-entry一条原完整pair仍缺，不能声称整轮零误筛。85同源跳过中41份原已批准增量仍在、14份历史退役另核（3空包/9已涵盖/2无依据弱化）；27旧版本关闭与3旧失败仍未证明语义覆盖，6页当前来源已变化，明确单列。正文补充过滤已绑定54次判定，53保留/0丢弃/1未完成，不把模型保留数当价值数。768份基线review字节未变，39个既有知识文件共享改动保留。
>
> **证据与剩余：** 本轮report/任务/模型原输入输出已复制并hash（6288份文件＋64份raw；raw-path-correction.json说明实际目录wiki/raw），审计见 `nightly-resume-20261101/audit-progress-1747.json` 及其全部指针。新鲜进程readKnowledgeSnapshot合法，Lint0error8warning；23个已归类worker失败指向共享页面的历史校验，sources.ts在启动后已变化，不擅自刷新活跃worker或认定每个草稿都有效。等待最后1项结束，只审新增产物；退出且维护空闲后复核全部已审字节、指针、正式基线，局部变化局部复核。22:00前据实汇报，不把失败/未核当零，不为凑成功重跑。下方检查点为历史。

> **2026-11-01 17:15：用户要求加快，已改为健康worker生成与冻结副本只读审计同步推进。** 实核wrapper74248/node70216仍在、lease active、无exit；当前64任务状态以 `tools/wiki-runtime/nightly-resume-20261101/acceleration-checkpoint.json` 为准。39条关系候选已逐条语义核对：30条过滤均有当前覆盖依据，其中4条原完整两端hash仍待补核；9份保留中8份暂定有导航价值，1份lm-head→token重复。不能把这些局部结果称整轮零误筛或验收完成。另已冻结21份正文建议及168个证据文件，开始审前两份：识别1项有用条件、1项待定细节及重复内容，C8候选新增段中断表格须单列，未修改原包。
>
> **加速边界与时限：** 审计写入仅在nightly-resume-20261101及本交接；未启动新轮、未调并发、未重试失败、未stage/reject/publish、未覆盖正文。期间部分任务因共享编辑中的source-domain/alias校验失败留史；最新readKnowledgeSnapshot合法、splitProblems(runLint)为0error8warning，不能把历史失败当当前持续阻塞。22:00前据实汇报承诺不变，失败和未核单列；临时nov1跟进已更新为提前审稳定副本、最后复核hash的顺序。详细关系审计见inflight-relations/independent-audit-progress.json，正文进度见inflight-bodies/first-two-independent-audit.json。下方16:20数字是历史。

> **2026-11-01 16:20：用户要求明确时限，本轮按现有产物收尾，不循环重跑失败或扩大清理。** 实核 worker 健康，本次64新任务为9待审/3失败/3运行/49排队；按约34分钟12项终态估计还需3–5小时（生成2–3小时、独立审计1–2小时，不是保证）。临时跟进 nov1 已更新：北京时间今晚22:00前汇报，21:30后首次心跳若仍未完成，明确已核结果与失败/未核项，不把部分审计称完整验收；不擅停健康worker。见 `nightly-resume-20261101/deadline-20261101.json`。
>
> **用户追问数量后实核：** 来源检查167页为85同源跳过、2延后、8无可重提取来源、64成功提取、8失败；64成功提取全部超过0.3文本差异阈值并新建候选。`maintenance.ts:88/134`的词元差异不等于实质新增事实；生成前尚缺语义价值核验。这个观察不能证明64有用或64误报。建议后续先核与最新正文的确切事实/条件/纠错增量，再生成局部草稿，疑项保留、不设数量上限；当前仅诊断，未改运行代码、未停worker或覆盖正文。证据 `nightly-resume-20261101/candidate-volume-diagnosis.json`。

> **2026-11-01 13:15：用户确认额度恢复后，已实际验证并唯一启动 Nov1 未执行模型环节的续接，审计未完成。** 严格 JSON 预检 ready:true/exit0；续接 startedAt=2026-11-01T05:15:00.805Z，wrapper74248/node70216，真实 CIM 与 daily-lease active70216 匹配。配置关闭 fetch/parameters/github/checkUrls，跳过今早已完成工作，沿用成功模型/分段缓存；现有 runner 仅额外做本地静态巡检，后续 reconcile/drift/worker 只生成待审，不发布、不覆盖正式正文。
>
> **保全与证据：** 原03:00额度失败回执保留。第一次 wrapper 因 PowerShell JSON 日期自动转换误比较，启动 node 前即退出，未运行模型；已复现失败，使用 DateKind String 修正并核变更父检查点仍会拒绝，改用 attempt-2 独立日志。768份review/1701知识输入基线、配置plan、预检及进程回执在 `tools/wiki-runtime/nightly-resume-20261101`；当前入口已运行，禁止复用或并发重启。只读价值/误筛核验待本次结束后完成，尚无最终数量。已重新建立当前聊天临时跟进 `nov1` 每30分钟实核本次续接，完成或确认中断后报告并删除；保留Windows每日03:00及其他聊天。下方失败结论是自然03:00批次，不能误作此续接结果。

> **2026-11-01：本次自然日更在模型预检失败，未执行内容生成或新过滤；临时跟进已删除。** 实际Windows任务03:00:02启动，sync run `b1cf8681232c11cff157ac182a94a6c526745c9c27623d5e3b83e35a4dd6b034` startedAt=2026-10-31T19:00:03.439Z、finishedAt=19:07:10.266Z，status=failed、phase=model-preflight；ChatGPT/gpt-6.1-sol一次预检明确返回usage limit。CIM无相关node、daily-lease inactive、Windows LastResult=1，未把旧reconcile历史报告算作本轮。原768份审阅记录逐字hash均未变，新增包=0、pending=0/publishing=0、新quality回执=0；**有用建议数与误筛数均未评估，不是零有用/零误筛，也不是过滤机制整轮验收通过。**
>
> **证据与边界：** 报告中的30 findings为静态巡检（4角标、3来源白名单、1事实表、14来源未跟踪、8来源变化），不是30份生成建议。审计仅读取并复制实际run/lease/patrol和预检账目到 `tools/wiki-runtime/nightly-followup-20261101/evidence`；完整结论为同目录 `completion.json`、进程/Windows状态为 `process-verification.json`。基线后20个知识输入变化只记录，不推定归属、不回滚；本跟进未整批重跑、未stage/reject/publish、未购买/reset、未改正式正文。预检输出所称恢复时间未经当前额度工具复核，不作为保证。
>
> **跟进不足及收尾：** 本目录在用户追问前只有baseline/followup两文件，没有实际检查点；临时跟进未及时告知这次失败，不能声称这些时段已完成巡检。用户追问后已核实并如实报告。automation工具确认删除当前临时heartbeat `automation`，保留Windows每日03:00任务（实查下一次2026-11-02 03:00）、其他自动任务与聊天；不延长这次范围到下一晚。下方“等待Nov1验收”状态已结束，原因是预检失败而非成功验收。

> **2026-10-31 23:56：已设置下一次自然日更的临时跟进，尚未开始验收。** Windows 每日任务实查下一次为 2026-11-01 03:00（北京时间），Ready、当前无日更进程、pending=0/publishing=0；每日任务未改。当前聊天 heartbeat `automation` 从03:15起每半小时只读检查，绑定本次自然调度，结束后逐项核有用增量、重复/空包、不确定项及全部过滤回执是否误筛；不整批重跑、不覆盖正文、不自动批准。基线768份review/1701知识输入及本轮范围在 `tools/wiki-runtime/nightly-followup-20261101/baseline.json`，实际创建与查看回执在 `followup.json`。结果未出，不能沿用Oct31回放数字冒充Nov1整轮结果。完成或确认失败并报告后删除本临时跟进，保留每日03:00与聊天。

> **2026-10-31 23:41：按用户“有用的保留、无用的别反复生成”要求，已将定点质量门接入日更关系建议与草稿整合；不增加数量上限，未启动整轮日更。** 关系检查复用内容身份相同的判定，身份只排除 updated 日期，正文、来源、证据等级及其余元数据变化仍会重查。正文存在精确目标链接时另做独立覆盖判断：核对实际新增的关系方向、用途、说明和全部限定，必须用唯一逐字旧文证明；不能因有链接或同词就丢弃。新增限制、部分匹配、核验失败和不确定情况继续保留。新产生的同案退役回执绑定两端完整依据，旧退役记录不做无依据批量屏蔽。
>
> **空包及保全：** 无文件、日志或矛盾变化的整合结果保留原材料/判定并移入历史，相关 rewrite 关闭，避免空待审和空包驳回后重编；日志或矛盾仍保留。暂存前重新核全部输入页精确字节，发布基线包含目标页，防止依据变化时写入旧建议。未改正式正文、未新增/批准审阅，原4份仍 published，当前 pending=0、publishing=0；每日03:00、聊天与冻结待办不变。
>
> **本轮证据：** 10测试文件76项通过，新增关系去重与空包问题先红后绿；strict 类型、项目类型/构建及项目 Lint 通过（0error/27warning/3info），最终快照合法、Wiki Lint 0error/8warning。有限真实回放用原始完整输入：2条重复导航均拦截、3条有用关系均保留；另1条“已有链接但新增版本限制”对照也保留。初版过严判断及引文坐标失败均留史，最终引文由程序逐字定位；累计8次受限只读判定，无整批生成。最终回放正式页和全部审阅记录无变化；早期回放期间其他聊天对5页的修改另列保留。权威回执 `tools/wiki-runtime/nightly-quality-20261031/completion.json`；未把小样本回放当成下一晚实际日更验收，间接导航等不能证明重复时仍可能入待审。

> **2026-10-31 23:07：用户授权的最后4份已在同一批次正式发布，pending=0、publishing=0。** 批次 `1dc769305006e675345cbb09acac99d2e8cb0f29ff103e00f6c40ef7984adab3`，包含GQA两处版本断言纠正，以及稀疏卸载→内存、950互联→内存、注意力代价→GQA三条关系。发布前全部精确匹配最新正式before，发布后4个文件逐字匹配已审after；767份原payload保全，其他review与任务未改，0模型调用、没有整批重跑。实际IAB显示“待审已清空”，禁止重复发布。
>
> **保全与验证：** 1688个未涉及知识文件与发布前一致；期间其他聊天继续修改API入口、KV显存量测/量化/规格4页及规格图2文件，均在本批写入清单之外，保留并单列hash，不将共享目录说成完全没变。完整发布器校验、最终快照与Wiki Lint通过（0error/8既有warning）；项目类型/构建、临时helper strict、24项来源测试通过。项目Lint在本次未修改的并行3D代码/测试处报4error/27warning/3info，按既有冻结范围留在其所属工作，不宣称全项目Lint通过。UI首次受常驻旧后端的NumPy来源规则拦截，未写正文；随后用当前代码的CLI批准同一个已准备批次，完整校验未跳过、未放宽来源规则。权威回执 `tools/wiki-runtime/publication-four-20261031/completion.json`，UI为同目录 `published-ui.txt/png`。
>
> **夜间数量原因已定位，尚未新增修复：** 本日原26份中21份来自跨页关系建议，其中18份导航已被正文涵盖，另5份是3份空包和2份重复静态声明。production模式检查全部关系组（本日144组，不等于144次新模型调用）；现有去重核正式/pending关系字段，未覆盖正文已有链接或已退役的同义建议。Oct30同源正文去重与这条流程不同，因此不能说夜间重复建议已彻底解决。后续应定点补关系建议的内容变化/正文覆盖/退役决定去重，不重跑全库。证据 `nightly-cause.json`。每日03:00、聊天及冻结待办保留；本次未发送问题。下方4待审及更早库存为历史。

> **2026-10-31 17:20：本日新增26份已逐项筛选，最终只留4份待审，未发布。** 原26份退役23份（18份已涵盖导航、3份无写入、2份重复静态声明），保留稀疏卸载→内存、950互联→内存、注意力代价→GQA这3条关系；本轮发现的GQA版本矛盾已核固定源码，另生成1份只纠正两处断言的待审包 `41be929a02`，真实supersede旧文与来源顺序保全。
>
> **定点恢复与保全：** Oct31日更仅重试失败的reconcile 37、118两组，实际exit0；成功分段缓存不变，原失败报告留史。恢复新增的1份包含4条已覆盖导航，独立复核后同样退役。因此本次共24份退役、5个rewrite任务关闭，没有整批重跑。暂存前后1701个知识输入与注册表逐字不变，766份既有payload不变，published记录仍298，Oct30的68份已发布批次保持原状，禁止重复发布。
>
> **验收与边界：** 保留内容的独立语义、固定源/hash、当前正式基线与旧文保护、隔离构建及实际IAB四份差异和截图通过；正式/候选Wiki Lint均0error/8既有warning，无新增告警。项目类型与构建、helper strict及项目Lint（0error/27warning/3info）通过，快照合法，daily-lease inactive。原8条告警和此前冻结待办保留；4份仍需批准才发布，不把定点恢复等同于下一次日更已验收。日更03:00及聊天保留，没有发送问题。权威回执 `tools/wiki-runtime/pending-26-20261031/completion.json`，明细 `result.md`，独立审查与UI回执在同目录。下方26待处理、68待批及更早库存均为历史。

> **2026-10-30 23:43：用户明确授权的68份已通过实际IAB全选，在同一个批次正式批准发布；pending=0、publishing=0。** 最终批次 `abee4792badf727cdf385b27eba35ab71a1919a7f63039a66cc9170480c2726e`，68份对应111处已核验局部差异。实际205个写出/消费文件逐字核对一致，原68份payload完整留史；65份原包与3份保全修正版发布，没有重跑模型、没有扩大清理。
>
> **保全：** 发布前采样与KV显存量测页持续出现共享编辑，先对齐完整最新正文、元数据、来源顺序及历史，再重放原3处/1处局部增量；保留最后一次KV来源说明调整。未涉及的容量与可靠性页新编辑保留。发布前后1615个未涉及知识输入逐字不变、663份其他review不变；只调整对应任务指针。旧失败父批次与替换包驳回留史，不复用；没有覆盖其他聊天的修改。
>
> **验证与边界：** 初次完整发布审计拦截engine-processes来源末行1063越界（固定文件实际1062行，末尾LF曾误算），已修正引用端点并保留正文结论；正式发布重新经过完整结构/旧文/来源审计。实际快照合法，Wiki Lint 0error/8warning，项目类型与构建通过，相关临时脚本strict检查通过。8条既有告警和此前冻结待办仍保留，不宣称全库继承正文或NPU实机重新验收。权威回执 `tools/wiki-runtime/publication-68-20261030/completion.json`，界面 `published-ui.json/png`，逐项ID `publication-items-v2.json`；日更03:00与聊天保留，未发送任何问题。下方68待批准及72/146/158等均为历史，禁止再次发布本批。

> **2026-10-30：剩余72份待审的固定来源核验已完成，实际收窄为68份、111处局部差异；仍待批准，未发布。** 123处原差异逐项核对固定提交源码/raw，纠正版本、分支和适用条件；12处重复、无必要或不成立的差异撤回，其中cross-node-transfer-limit、npugraph-ex、PR11953、AI Core四份整包移入历史。68份修正版已串行stage/retire，原72份payload不改；旧入口与旧包禁止重复执行。
>
> **保全与验证：** 核验期间基准测试、采样、正确性排错3页新增共享编辑已并入候选基线，1754个知识输入与注册表文件在本轮暂存前后字节变化0；published仍229，模型调用0。候选旧文/生成区/谱系保护及隔离构建通过，正式与整批候选Wiki Lint均0error/8warning，新增错误和告警均0。实际IAB逐份打开68份新包，111处差异及固定源码位置全部可见，文本/DOM/截图回执完整；最终实读包字节、正式before、raw hash、任务指针、快照及库存通过，daily-lease inactive。4个临时核验脚本strict类型检查通过；没有修改产品运行代码。
>
> **范围与证据：** 这是111处局部增量的固定快照来源核验，不是NPU实机测试或对全部继承正文的重新审计；原8条告警和此前冻结的格式待办保留。完整结果 `tools/wiki-runtime/pending-source-review-20261030/result.md`；逐项差异与hash为同目录 `completion.json`，来源片段 `source-verification.json`，写入/验收 `staged.json`、`validation.json`、`ui-verification.json`。当前只有68份待审，需批准后才进入正式知识库；不扩大整理、不重新跑模型，日更03:00与聊天保留。下方72/146/158及旧验收记录仅为历史。

> **2026-10-30：146份待审已逐项与最新正文比对，实际收窄为72份、123处局部差异；未重跑模型、未发布。** 移出74份＝71份已涵盖/重复导航＋3份与固定源码冲突的建议；原146份payload完整留史。72份保留包已替换为最新正文基线，含期间其他编辑改动的6页；不覆盖共享修改。51个退役rewrite任务关闭，72个保留任务指向新包，避免旧包继续重编。
>
> **证据与边界：** 清理前后1754个知识库输入及注册表文件字节变化0，其他review/queue记录不变，published仍229。候选修订、生成区/版本谱系保护及隔离构建通过，Wiki Lint 0error/21warning（正式基线0error/8warning；候选仍有角标等写作告警）。实际IAB已显示72待审。此次完成的是内容去重与差异收窄，**72份仍待来源核验和批准，不宣称全部可发布**；未扩大既有格式清理范围。逐项清单 `tools/wiki-runtime/pending-content-review-20261030/result.md`，完整差异/hash及实写回执为同目录 `completion.json`、`staged.json`、`validation.json`。下方146/158等库存数字为历史。

> **2026-10-30：按用户授权修复日更重复生成，并本地去重本轮158份；未重跑模型、未发布、未覆盖正式正文。** 固定源码/raw内容身份已处理则跳过，成功无差异检查也留回执；正文/日期变化不再自行触发同源再生成。同页有未结束改写时延后新来源，失败的content-drift任务不再由日更盲目重试；关系建议在共享锁内同时核正式和pending的边，避免并发重复。
>
> **当前146 pending＝123份正文建议＋23份关系建议，涉及130个不同页面。** 已退役10份writes=[]无变化包和2份重复关系包，原payload完整留史，10个关联rewrite任务关闭，防止驳回后自动重编。其余建议未做语义验收，130页不等于130页都需重写。按页分组与逐项保留/退役清单见 `tools/wiki-runtime/daily-dedup-verification-20261030.json`；本次核对1754个知识库输入及注册表文件，字节变化0；其他review/queue记录不变，published数量不变。
>
> **验证：** 10测试文件68项通过；strict node类型、项目类型与构建通过，项目Lint0error/27warning/3info，Wiki Lint0error/8warning。只读核167页：146同来源跳过、9因既有任务延后、8无可重提取源、4来源身份未命中；全部0模型调用，这组数字与pending数量是不同口径。未实际启动日更，Oct30既有CLI路径预检失败未在本轮修复；03:00计划、聊天、未发送问题及旧格式待办保留。完整证据 `tools/wiki-runtime/daily-dedup-completion-20261030.json`。下方库存数字均为历史。

> **2026-10-29 02:08：用户追加授权的最后7份已对齐最新正式内容，并由实际IAB全选后在同一个批次正式批准；当前pending=0、publishing=0。** 原138份整批已处理为131份原包发布＋7份最新基线包发布。最后7份中6份有正式写入，fused-op-type的一份建议已被最新正文完整涵盖，按0正文写入批准；全部138份原payload未修改，旧7包驳回留史，CP新Ring Attention场景、SP共享重写、GLM新纠错及其余页新内容均保留。最终批次87a7d4e3a9fc8720217462214d34a1c2b9d8104f4c2a55be05e8d827b66fb608；权威回执：`tools/wiki-runtime/final-seven-publication-verification-20261029.json`。
>
> **全选UI已实质重做。** 顶部独立固定操作条包含全选复选框、半选状态、已选/总数及整行绿色“批准并发布所选N份”；列表选择框与卡片对齐、已选项高亮，发布结束显示“待审已清空”。真实浏览器验证全选/取消、键盘Space、半选、详情返回半选保留、未选禁用及最终7份发布；截图与回执见`final-seven-ui-verification-20261029.json`、`final-seven-select-all-final-ui-20261029.png`、`final-seven-published-ui-20261029.png`。未发送问题仍保留且未发送。
>
> **验证与限制：** 31项相关测试通过；最终类型/构建exit0、项目Lint0error（27warning/3info）；实际知识快照1021文件合法、Wiki Lint0error/8warning。父核当前全文/hash、固定源码/raw与独立语义核验均通过。首次发布被CP/SP新加rawSources与共享origin:direct冲突拦住，正式未写；仅移除这两页本次新加的rawSources字段，保留origin、正文及sources中不可变raw引用，独立真实Lint红2→绿0后重新组批成功，旧失败回执保留，未放宽任何保护。原冻结的额外格式待办仍单列；本次批准不等于这些待办已经整改。临时automation仍已删除，每日03:00任务与聊天保留。下方未完成数量均为历史。
> **2026-10-29 01:30：用户新授权“当前这一批一次性通过”，已从138份待审中正式发布131份，7份因正式基线变化继续待审。** 这次授权覆盖当前整批，独立于此前“只入pending”的恢复任务。所有138份原payload hash均保持，131份子包及6个父批次已published，全部实际写出文件逐字核对一致；当前无publishing、daily-lease inactive。7份为context-parallel、sequence-parallel、glm-5-3-flash-two-node、cann-hccl关系包、batch-invariance关系包、fused-op-type关系包、api-server-entry关系包，未覆盖共享新内容，未把它们计为已通过。权威回执：`tools/wiki-runtime/bulk-approval-final-verification-20261029.json`；初次分批及修复后续发的历史分别见`bulk-approval-publication-20261029.json`、`bulk-approval-generated-draft-resume-20261029.json`。
>
> **审阅入口已改为“全选待审（数量）/取消全选”。** 实际IAB验证全选138份；最终7份全选与取消全选有效、审阅显示7、已发布稿进入历史；截图`tools/wiki-runtime/bulk-approval-ui-20261029.png`。发布过程中真实复现并修复“消费带生成区的草稿被误判为删除正式生成区”：保护仅针对正式页，正式参数定义/版本谱系防改测试仍通过。相关31测试、类型/构建通过；项目Lint0error（27warning/3info），Wiki Lint0error/8warning，合法知识快照1019文件。早先构建被正在发布的工作锁阻止，发布结束后完整重跑通过。未发送问题仍保留；每日03任务和聊天保留，临时automation仍已删除。以下恢复结案与未发布数量为本次发布前的历史，原冻结的新增格式待办仍未整改，批量批准不等于这些格式待办已修正。

> **2026-10-29：按用户明确选择“冻结本轮范围，新增问题单列”收尾。** 原177失败/142页已全部得到结局：**119待审、58版本变化关闭、0失败、0运行**。最后 `mlp-owner-init` 于00:23:25真实exit0；176项已解决跳过与1项新pending分列留证，禁止重启任何旧prefix。截止00:54:44的独立覆盖绑定全部119个实际待审ID、固定源码/raw/正式before及实际UI；已列15份格式修正、2份日期重基和最后MLP修正均完成，未发布。父收尾再次核119包字节/任务指针与149份UI材料hash。权威结案：`tools/wiki-runtime/recovery-frozen-scope-acceptance-20261029.json`；逐项结局：`original177-final-ledger-20261029.json`。
>
> **冻结不等于当前整个工作区全通过。** 用户已授权将新增问题单列：早期6页8条角标格式问题、双机旧pending的正式基线对齐、截止后context-parallel/sequence-parallel共享重写及其校验问题、11份关系元数据包尚未完成的关系语义验收。01:04:52实读快照拒绝、Lint9error/12warning是共享目录当时状态，不覆盖或回滚其编辑，也不计通过。详见 `tools/wiki-runtime/final-scope-cutoff-and-followups-20261029.json` 和 `frozen-scope-shared-workspace-diagnostic-20261029.json`。准确库存为138 pending＝137本轮新包（119恢复＋7早期正文＋11关系包）＋1旧包；这些数不等于已验收教学正文数，2份无正文包及归档/声明缺口仍按原分类保留。
>
> **临时跟进 `automation` 已通过应用工具删除；本聊天与Windows每日03:00任务保留。** `LLM-Wiki-infra-view-new`实际Ready、下一次2026-10-29 03:00；旧69批准范围不变，没有新稿发布、购买或reset。IAB tab3/5193仍实际可见未发送问题“那它与 TP 有什么区别？”，未发送。三个运行检查点已更新并保存此前完整历史；下方全部为历史，不是继续恢复或扩大整改的指令。后续新增待办需另行安排，不由已删除的临时跟进继续推进。


> **2026-10-29 00:21 实核：原177为118待审/58版本变化关闭/1运行，整轮未完成。** 15格式与2日期重基已全部父核和实际IAB验收，禁止重复stage。最后MLP由新唯一 `mlp-owner-init` 于00:20启动wrapper55116/node60824；00:21真实CIM和daily-lease active60824匹配，无exit，报告176已解决跳过/0失败。已出现00:21新的模型输入/输出，尚无最终待审包；状态脚本用 `--mlp-owner-init`。先读实际 `mlp-owner-init-current-status-20261029.json` 和report/exit/out/err，旧PID/数字仅历史，不重启或复用prefix，活跃worker时不stage/reject。
>
> **文件锁竞态已实际复现和修复，而非继续猜测重启。** 3独立进程共享快照捕获“新锁创建后owner尚空”导致早退，固定原30秒内只等待并重试exclusive、不抢删锁。父4红测→21测试通过，strict/构建/Lint通过；独立8行为控制、3真实进程500次竞争全通过及新入口134控制0P1/P2。见 `mlp-lock-retry-actual-race-independent-20261029.json`、`mlp-owner-init-fix-independent-20261029.json`、`mlp-owner-init-runner-independent-20261029.json`；00:12真实严格ready:true预检exit0。历史23:58故障持锁者仍未知，不混同新复现。
>
> 快照7e2681a6合法、Lint0error12warning；118旧待审的116正文回执/2无正文均已绑定，缺失/漂移0，但不自动覆盖未来MLP稿。接下来仅最后MLP独立raw固定源/hash/旧文/当前正式与实际UI，以及177结局和全覆盖终验。不扩清理、不发布新稿、不购买/reset，旧69及每日03任务保留。未发送问题“那它与 TP 有什么区别？”保留。用户已获真实状态，原30–60分钟估计不保证；不得把模型中间输出或通过计划算整轮完成。下方为历史。

> **2026-10-29 00:02 实际收尾：15格式与2日期重基已全部验收；最后MLP仍未恢复，整轮未完成。** 两日期包23:50/23:51串行stage/retire，新RFork `f5621671`、ops `518dcf3a`仍pending；父独立实核raw39固定范围/hash/旧全文payload/currentformal/精确delta及实际IAB差异/条件/来源/截图，见 `date-rebase-two-staged-verification-20261028.json`。保全共享updated10-28；ops新增句仅准确说明disabled分派及编译开关，MC2失败条件、量化缺口保留。helper83及2稿独立0P1/P2。禁止重复stage。
>
> **最新MLP lock-retry已23:58:47 exit1，不能沿旧running记录等待。** 实际177结果176已解决跳过、1MLP工作状态锁失败；00:02真实CIM无31064/61508，daily-lease inactive61508，锁当时已不存在。见 `mlp-lock-retry-exit-verification-20261029.json`，准确旧模型输入/输出和成功材料缓存hash未变，无新pending。已复现修复的state-first及owner-read ENOENT竞态经94入口/9行为/17测试/strict/构建/Lint独立通过，但未证明这次实际失败分支已解决；继续捕捉真实只读并发snapshot的owner/code/时序，禁止猜测重启、复用prefix、抢锁或放宽30秒。
>
> **23:59原177为118待审/58版本变化关闭/1失败，快照7e2681a6合法，Lint0error12warning。** 独立 `mark-date-closure-semantic-coverage-20261028.json`实读118待审，116正文回执/2无正文，15格式+2日期UI证据齐，缺失/漂移/并发读取变化0；结构113有效正文/171历史/0错误。此覆盖不包含未来MLP新稿，不能代替整轮验收。仅继续这最后1项和总验收，不扩清理。旧各批次不重做，pending不发布。每日03与旧69保留，无购买/reset；23:54实际tab3/5193问题“那它与 TP 有什么区别？”未发送。下方均为历史。

> **2026-10-28 23:39 纠正：MLP resume 已于23:31:09实际 exit1，整轮未完成。** 报告 blocked，仅9条已解决跳过，未到MLP模型调用；真实CIM无30676/71660、daily-lease inactive，观察时workflow.lock已不存在。readKnowledgeSnapshot申请工作锁失败，历史持锁者及确切原因尚待复现，不能据锁已消失推定根因。见 `tools/wiki-runtime/mlp-resume-lock-exit-verification-20261028.json`。下方23:30健康记录及此前“已恢复实际运行”已过时；禁止复用该prefix或盲目重启。15格式包验收保持完成，两日期候选已落盘但尚未stage；旧ops免责比例机械提示仍须核，不能以旧通过报告覆盖。当前继续诊断和这两项收尾，不扩清理。

> **2026-10-28 23:33 实际收尾：15份格式修正版已全部入待审并完成父字节核验与实际IAB，最后1项MLP恢复已唯一启动，整轮未完成。** 15份于19:40前串行stage/retire，23:29补齐最后3份UI并实读全部15包before/after/旧payload/任务指针；见 `tools/wiki-runtime/mark-format-fifteen-staged-verification-20261028.json`。全部pending未发布，禁止重复stage。helper81独立0P1/P2、296控制/strict/项目构建/Lint通过。来源与旧文保护未放宽。
>
> **新MLP恢复进程须读实际状态。** 23:29启动wrapper30676，23:30实际CIM与daily-lease active71660匹配，无exit；读 `failed-worker-recovery-mlp-resume-20261028.json`、exit/out/err及`mlp-resume-process-verification-20261028.json`，状态脚本用`--mlp-resume`。23:26真实ChatGPT/gpt-6.1-sol严格ready:true/exit0预检通过，独立入口0P1/P2、61控制/strict/实际plan177/142并发3通过；未购买/reset。旧mlp-transport170跳过的running文字已失真，旧进程不存在、原因/退出码未知，不复用prefix。新CLI路径修复只解释新预检路径错误，不认定为旧中断原因。
>
> **余项边界明确。** 23:27原177仍118待审/58版本变化关闭/1未恢复，快照fc997b7b合法、Lint0error13warning。MLP新稿尚待结果及独立raw/固定源/旧文/基线/UI核验。另两页rfork-layout、ops-and-kernels当前正式仅updated日期变化，正文/历史/sources/raw逐字不变；见`mark-closure-semantic-coverage-20261028.json`的baselineDriftDiagnostics，离线精确重基候选已委托既有agent，尚未stage。活跃worker时禁止stage/reject；不停止健康worker。仅收已知项，不扩额外清理。
>
> 最新结构与全pending绑定仍须合并15替换及MLP随后实际新稿再收尾。已验收final-four3及15/6/7/1、28/5/27等均不重做。23:28实际IAB tab3/5193仍见未发送问题“那它与 TP 有什么区别？”，勿发送；23:27只恢复已不存在的5193验收服务，复用8790后端且未停5173。每日03与旧69范围保留。用户已获30–60分钟估计（依赖模型成功，非保证）；旧自动提示已更新。完整状态见 `tools/wiki-runtime/recovery-progress-2331-20261028.json`；整轮真正通过后才删除临时跟进。下方检查点均为历史。

> **2026-10-28 19:05 最新实核：整轮未完成，MLP 恢复进程已不在。** 两次真实 CIM 无 wrapper71092/node73872，亦无恢复/维护 node；报告停在170个已解决跳过、仍写running，daily-lease遗留active73872且无exit，不能视为健康运行，退出原因/代码未知。未重启、未stage/reject。证据见 `tools/wiki-runtime/mlp-transport-interrupted-process-verification-20261028.json`、`recovery-status-response-checkpoint-20261028.json`。原177最新118待审/58版本变化关闭/1未恢复；快照已变为3bd53096，Lint0error13warning，共享修改须逐页保留。收尾仅剩这1项及已列15页格式问题；10页目前只完成父独立核源计划，agent明确候选正文尚未落盘，不能计为修正验收完成。既有完成批次保留，严禁重复stage。下方running及45/170记录均为历史。

> **2026-10-28 18:40 当前：MLP transport 已唯一启动，整轮未验收。** wrapper71092/node73872，18:37真实CIM与daily-lease active73872匹配，无exit；状态脚本用 `--mlp-transport`，实际报告本次读得45/177、45已解决跳过，尚须以最新report/exit/out/err/租约/CIM为准。18:34真实ChatGPT/gpt-6.1-sol严格JSON ready:true、exit0预检通过，实际plan为原177/142、同页串行并发3、pending不发布。禁止再次启动同prefix、并发另一轮或stage/reject；不停止健康worker。见 `mlp-transport-launch-20261028.json`、`mlp-transport-process-verification-20261028.json`、`recovery-checkpoint-20261028.json`。原final-four已17:59 exit1，173跳过/3新pending/1TLS失败留史，不再重启。
>
> **final-four三份修正版均已完成父独立核源/hash/旧文、串行stage/retire和实际IAB。** Sleep新e3807418、Ascend新3115e6e0、Mooncake新de2a77d8仍pending；旧包驳回留史、payload不改。见 `final-four-sleep-staged-verification-20261028.json`、`final-four-two-staged-verification-20261028.json`。Ascend来源聚合后23标/18C、Mooncake28标/22C，旧句由真实supersede保留历史，未虚增D/I。helper66与MLP入口独立0P1/P2、66guard/39入口控制、strict/项目类型/构建/Lint通过；实际plan已提权通过，独立审查时sandbox EPERM仅是历史验证边界。严禁重复stage这些候选及此前15/6/7/1、28/5/27等批次。
>
> **新发现15份concept格式P2，尚须保全修正，不能凭旧覆盖宣告整轮通过。** 父全118待审扫描19机械flags；独立分诊排除2份非concept，另2份为刚完成的Ascend/Mooncake；余15份强制名单概念页有7份本轮新增后超30角标、8份继承C占比≥80%。context-parallel机械34含2个行内代码示例，渲染32仍超。既有agent正在逐项核来源聚合计划，未改候选；保留事实/限制/来源，继承旧句必须精确supersede留史，不trim、不放松600字逐字或生成区保护。18:36结构113有效正文/154历史/0错误、18:38原177为118待审/58关闭/1失败、快照合法Lint0error14warning，这些不等于语义和格式全部通过。
>
> 每日03:00、旧69批准范围不变，无购买/reset；18:32实际IAB tab4/5193仍见未发送问题“那它与 TP 有什么区别？”，勿发送。RFork两页及config-source/async/multistream/scheduler/RL/weight-prefetch仅归档，hotreload/range/runtime仅声明与缺口，2份writes=[]不计正文。最终原177逐项结局、全部当前pending独立raw固定源/正式基线/实际UI/结构与格式都通过才完成并删除临时跟进。正常推进保持安静。下方全部为历史。

> **2026-10-28 18:20 当前：final-four 已17:59 exit1，整轮未验收。** 实际177结果为173已解决跳过（115待审/58关闭）/3新pending/1失败，无新关闭。18:15真实CIM无恢复或维护进程、daily-lease inactive；原177为118待审/58关闭/1失败，快照合法、Lint0error14warning。见 `recovery-checkpoint-20261028.json`、`final-four-post-sleep-process-20261028.json` 和 `final-four-new-pending-review-queue-20261028.json`。禁止复用final-four或任何已运行prefix。
>
> **sleep修正版已独立核源/hash/旧文、串行stage/retire并实际IAB通过。** 新e3807418仍pending，旧634786b2驳回留史、payload未改；见 `final-four-sleep-staged-verification-20261028.json`，严禁重stage。helper64精确入口、guard/strict/项目类型/构建/Lint和独立0P1/P2通过。ascend77cd4fff与Mooncake816d16c0仍未验收：原稿来源误述/条件缺失/重复与角标问题已冻结，父已实核全部raw固定源；另发现原正式基线C占比超标，须以来源聚合和supersede保留旧文处理，不虚增证据，不放宽保护。候选仍待父核、维护和UI。
>
> **仅剩MLP为真实TLS握手EOF失败。** 精确input/output及成功分段缓存见 `final-four-mlp-failure-diagnostics-20261028.json`；尚未另启恢复。维护收尾后需新严格ready:true预检与唯一prefix，保留缓存、600字逐字和生成区旧文保护。旧15/6/7/1及28/5/27等已完成批次不重做。115旧待审覆盖不自动涵盖3新稿，结构旧快照不能替代整轮验收。18:07实际tab4/5193仍见未发送问题“那它与 TP 有什么区别？”，勿发送；每日03:00和旧69范围不变。只有原177逐项结局、新pending独立源/基线/UI及结构全部通过才完成并删临时跟进。下方均为历史。

> **2026-10-28 17:50 当前：final-four 仍运行，已有首份新稿，整轮未验收。** 17:45真实CIM仍为wrapper74320/node74592，租约active，无exit；17:50报告171结果为170已解决跳过（115待审/55关闭）和1新pending。17:47原177为116待审/58关闭/3运行，快照合法、Lint0error14warning。新sleep-mode包634786b269f3ede1仍pending未发布，见 `final-four-new-pending-review-queue-20261028.json`。父已实际读完整diff、旧文及raw对应的30份固定源范围（29份物理全等、1份仅终止LF差异，未trim），定位两处新增事实；发现新增来源说明误称无法定位，独立审查及候选修正推进中，不能计验收通过。见 `final-four-sleep-parent-source-check-20261028.json`；实际结构111有效正文/151历史/0错误不能代替语义。不得重启或停止健康worker、不得并发stage/reject。已完成批次不重做；等待实际退出且租约空闲后才做维护。下方为历史检查点。

> **2026-10-28 17:32 当前：final-four 状态 running，整轮未验收。** 先读 `tools/wiki-runtime/recovery-checkpoint-20261028.json` 和真实 report/exit/out/err/CIM/租约。新轮 wrapper74320/node74592，进程实测时间 2026-10-28T17:30:52.3291458+08:00；报告已处理 24/177，已解决跳过 24、新pending 0、新关闭 0、失败 0。原177当前状态 {"needs-review": 115, "closed": 58, "failed": 4}。状态脚本用 `--final-four`；不得重启同prefix、并发另一轮或在worker活跃时stage/reject，不停止健康worker。
>
> **15份细化、6份材料恢复稿和7份正式基线重基均已完成父核与实际UI。** 分别见 `schema-feedback-detail-staged-verification-20261028.json`、`material-retry-six-acceptance-20261028.json`、`formal-rebase-seven-staged-verification-20261028.json`。全部仍pending未发布。7份保留其他编辑的新30ce来源、ca9a raw与版本谱系；PCP默认值明确分版本，旧结论supersede留史。hotreload首次stage已生成2963，仅因rawSources排序后验失败；随后只校正raw列表顺序、核完整after/decision/before/base并接管已有包，没有再次stage。旧包退役留史，其余6份串行stage/retire完成。上述及此前28/5/27、memory/graph已完成项禁止重复。
>
> **另1份force-EPLB归档包的基线漂移也已保全重基。** 当前正式全文、谱系及30ce自动区逐字保留，29条正式来源原序不变，归档raw引用移为索引30；正文未新增。父独立重核旧28段raw（27段物理字节全等，最后一段仅缺终止LF，保留双hash）与新ca9a完整raw/30ce源码，未trim或改原文。helper63仅加一项精确入口，guard、strict、项目构建/Lint及独立0P1/P2通过；该包串行stage/retire和实际IAB完成，见 `formal-force-eplb-staged-verification-20261028.json`。仅正文结构审计曾跳过此归档包，最终还须按最新独立覆盖核全部pending基线。
>
> **恢复入口与结构分别有实证。** 原material-retry已15:23 exit1，177结果165跳过（109待审、56关闭）/6新pending/2新关闭/4失败，旧prefix不再使用。四失败准确输入输出见 `material-retry-final-failure-diagnostics-20261028.json`；新入口仍只原177/142、同页串行并发3、daily-lease、跳过已解决。17:19真实ChatGPT/gpt-6.1-sol握手通过；独立入口0P1/P2，严格ready:true合同、27门控、2正16负握手、strict runtime、项目类型/构建/Lint通过。helper62和raw排序补核独立0P1/P2。最新结构审计 110 有效正文/151历史/0错误，知识库Lint 0error/14warning；这些不能代替整轮语义验收。
>
> **启动前待审覆盖已补齐。** `latest-semantic-coverage-20261028.json`（eb0ad3a6…）绑定115份待审中的113份正文写入回执和2份无正文包；17:26独立二次实读全部任务指针、审阅包字节和正式before，缺失/开放发现/基线问题均0。此结论只覆盖启动前这115份，不能自动覆盖final-four随后产生的新稿。旧force漂移回执保留。
>
> **尚需实际剩余结局与覆盖收尾。** 逐份检查final-four实际新稿及失败，补最新pending具体ID/hash的独立语义覆盖，再核177逐项结局、正式基线、raw固定源、实际UI与结构。RFork两页/config-source/async/multistream及scheduler/RL/weight-prefetch仅归档，hotreload/range-debug/runtime-path仅声明和证据缺口，2份writes=[]不计正文。保持600字逐字、生成区旧文保护和成功段缓存；新稿pending不发布，旧69仅既定scope。不覆盖其他聊天编辑。每日03:00保留，无购买/reset；未发送问题“那它与 TP 有什么区别？”在17:23实际IAB tab4/5193可见，勿发送；原tab2为错误页。正常推进保持安静，只有整轮真正通过或必须用户决定才通知；通过后删除临时跟进，保留每日任务及聊天。下方记录均为历史。

> **2026-10-28 17:12 当前：维护继续，final-four尚未启动，整轮未验收。** 旧material-retry于15:23 exit1；不要重启其prefix。17:05真实CIM无恢复/维护进程、租约空闲，随后仅接管已存在的hotreload2963并退役旧包，17:06实际exit0。其余六份formal重基串行stage/retire已全部exit0。15份detail、6份material和7份formal均已父独立核源/hash/旧文并实际IAB读差异/条件/来源及截图；见 `schema-feedback-detail-staged-verification-20261028.json`、`material-retry-six-acceptance-20261028.json`、`formal-rebase-seven-staged-verification-20261028.json`。新稿均pending未发布，禁止重复stage。hotreload首次后验仅rawSources排序失败，后来只接管已有2963，没有再次stage。
>
> **新发现一份归档包基线漂移，正在保全重基。** 独立全pending覆盖发现force-EPLB d1d4ecb7的正式页追加30ce来源、ca9a raw并更新谱系/自动区；旧包仅归档，现正式全文须保留，不能只替换baselineHash。见 `latest-coverage-force-eplb-formal-drift-20261028.diff`。17:09结构110有效正文/150历史/0错误，但该脚本跳过仅归档正文，因此不能把0错误当全基线通过。原177为115待审/58关闭/4失败，快照合法、Lint0error/14warning。
>
> **新恢复入口已验证，待上述维护收尾。** `failed-worker-recovery-final-four-20261028.ps1` 使用新prefix和 `--final-four`；16:33真实ChatGPT/gpt-6.1-sol严格ready:true预检通过，独立入口0P1/P2、27门控、2正16负握手、strict runtime、项目类型/构建/Lint通过。helper62及raw排序补核、hotreload接管脚本均独立0P1/P2。仍只原177/142、同页串行并发3、daily-lease、跳过已解决；不得并发worker与stage/reject。先核真实进程/租约/最新状态，不能按本段直接重启。每日03:00和旧69范围不变，无购买/reset；未发送问题“那它与 TP 有什么区别？”保留。整轮原177结局、当前pending独立语义覆盖、raw固定源、实际UI与全部正式基线完成后才通知并删除临时跟进。下方记录均为历史。

> **2026-10-28 15:33 当前：material-retry 已退出，整轮未验收。** 先读 `tools/wiki-runtime/recovery-checkpoint-20261028.json` 和真实 report/exit/租约/CIM。15:23:10实际exit1，177结果165已解决跳过（109待审、56关闭）/6新pending/2新版本变化关闭/4失败；15:24真实CIM无wrapper34244/node21100及其他恢复worker，15:28 daily-lease inactive。15:25原177为115待审/58关闭/4失败/0运行，快照合法、Lint0error/14warning。状态脚本用 `--material-retry`；禁止重用同prefix，任何stage/reject或后续恢复前重核进程与维护租约。
>
> **6份新稿仍待验收。** scheduler e0024e60、sequence e792d1d7、rfork-lifecycle 1b24db3d、glm-mlp-version-source 57aa366a、vllm-ascend-for-rl e16c01e8、weight-prefetch-config 3facbbf4；见 `material-retry-new-pending-review-queue-20261028.json`。scheduler/sequence独立审查各发现2项P2，修正版已冻结但父核/stage/UI均待。4失败中sleep-mode、mlp-residual-norm、mooncake-connector为实际model capacity；ascend-config-system为section-edit-binding。逐项读精确输入输出并保留成功缓存，尚未重启。
>
> **旧轮与已入队修正版保留。** schema-feedback Oct26 23:03 exit1的164跳过/1关闭/12失败及逐项input/output诊断留史。14:46真实ChatGPT/gpt-6.1-sol预检通过，没有购买/reset；Oct27/28每日03:00仅预检失败未生成正文，日程保留。memory新68346fd2、graph新775dbd71已在本轮启动前串行stage/retire且父核与实际IAB差异/条件/来源/截图完成，禁止重复；concurrent cfbea7ba补覆盖完成。此前28修正版、5重基、27较早修正版均不重做。
>
> **15份旧稿细化已独立审查，尚未入队。** KV/gap/MLA/engine/linear/lifecycle/matmul/embedding/patch/spec/rope/platform/MoE共13候选已父核raw、固定源、精确delta、hash和旧文，父报告见 `schema-feedback-detail-*-parent-independent-20261028.json`（KV为20261026）。TP最终候选7e057c4e已修345–346行引用，待父收尾；plugin旧来源索引和异常捕获范围P2须显式supersede留历史。15份均未入helper/stage/UI，不能当完成。既有独立agent因capacity结束，可继续原agent；不是用户待决项。
>
> **7份正式基线漂移未解决。** 14:54结构审计107有效正文/123历史/7基线错误是历史快照，不包含随后全部6新稿。hotreload、kvpp-config、range-debug、combine-quant-mode、runtime-path、sfa-dcp-force-tmajor-restore、enable-pcp-o-proj-weight-sharding的新30ce5af来源、ca9a raw及版本谱系须保留。见 `schema-feedback-formal-drift-20261028.json`；重核精确delta和固定源后受保护重基，不能覆盖其他聊天编辑。
>
> 只原177/142、同页串行并发3、daily-lease、跳过已解决；新稿pending不发布、旧69范围不扩大。不trim或放松600字逐字/生成区旧文保护。RFork两页/config-source/async/multistream仅归档，hotreload/range-debug/runtime-path仅声明及证据缺口，2份writes=[]不计正文。未发送问题“那它与 TP 有什么区别？”勿发送；原tab2错误页，验收tab4/5193续验。最终177逐项结局（关闭/跳过分列）、全部新pending及正式基线、独立raw固定源、实际UI和结构全部通过后才通知并删除临时跟进，保留每日任务及聊天。下方均为历史。

> **2026-10-26 22:26 当前：schema-feedback 恢复已运行，整轮未验收。** wrapper51792/node70116于22:22启动，22:23真实CIM和daily-lease active70116已核，无exit；不得重启同prefix、并发另轮或stage/reject。读 `failed-worker-recovery-schema-feedback-20261026.json`、exit/out/err和`schema-feedback-process-verification-20261026.json`；状态脚本改用 `--schema-feedback`。22:26报告93结果均为已解决项跳过，尚无新模型稿；原177在22:23为109待审/55版本变化关闭/13失败。后续以实际文件为准，关闭和跳过不算生成成功。
>
> **28修正版和5重基已完成入队及实际UI。** 28份compile-stage修正版均父逐源复核、stage为新pending、旧稿rejectReview留史、payload未改，并实际IAB读差异/条件/来源与截图；见`compile-stage-corrections-staged-verification-20261026.json`、UI与30-bodies-coverage。另5较早pending（hardware/op-core/RFork布局/ops/CANN）已保留其他编辑的新链接和NZ/量化纠错，父独立复核精确delta后受保护重基，22:18串行完成且5份实际IAB通过；见`formal-baseline-rebase-{parent-independent,staged-verification,ui}-20261026.json`。全部仍pending，严禁再次stage或发布。CANN旧稿31角标失败留史，新稿只把同一QoS结论精确移到既有来源23说明后，未放宽30角标保护。
>
> **实际证据与边界。** helper33仅增5精确入口，prepare/retire两处只补类型，生成JS与原版相同；完整strict runtime、项目类型/构建/Lint通过，独立0P1/P2。22:20结构审计107有效正文/121历史/0结构和基线错误，22:23快照合法、知识库Lint0error/14warning。这不是全语义验收；RFork两页/config-source/async/multistream仅归档，hotreload/range-debug/runtime-path仅字段声明及证据缺口，2个writes=[]不计正文。旧compile-stage177结果134跳过/30新pending/13失败于Oct25 17:51 exit1保留。现有review_pending_corrections核全部待审语义覆盖与新实际稿；不另开同页worker。
>
> 只原177/142、同页串行并发3、daily-lease、已解决跳过；新稿pending不发布。重复失败先读准确输入输出，保留成功段，继续既有选行/quoteID与600字逐字/旧文生成区保护；确需代码修复才检查点stop。每日03:00及旧69范围不变，无购买/reset；未发送问题“那它与 TP 有什么区别？”保留。最终原177逐项结局、全部新pending/正式基线/独立raw固定源/实际UI均通过才通知并删除临时跟进。下方均为历史。

> **2026-10-26 21:38 历史：整轮未验收，新 schema-feedback worker 尚未启动。** 28 份 compile-stage 修正版已全部父独立核 raw/固定源/旧文和候选 hash，受保护 helper28 guard、严格 runtime 类型及独立审查 0P1/P2 通过。前11份实际 stage 新 pending 并 rejectReview 旧包留史完成，且11份均已实际 IAB 读差异/条件/来源并截图；其余17份未 stage，严禁重做前11。见 `compile-stage-corrections-ui-20261026.json`、`compile-stage-correction-helper28-independent-20261026.json` 和 `current-nightly-verification-20261023.json`。
>
> **共享编辑与恢复分列。** 21:35实际快照合法，Lint8error/15warning，涉及量化重复别名/证据级别与950页关系/来源；此前图表 YAML 解析错误已由共享编辑纠正。其他聊天仍在工作，不覆盖它们的正式页。21:36结构审计110正文/99历史，5份较早pending出现正式基线变化：hardware-devices、op-to-ai-core、rfork-layout、ops-and-kernels、cann-hccl；见 `compile-stage-body-audit-2139-20261026.log`（文件名时间标签不等于实测时间）。这些不能算通过，先只读核差异，保留他人新增和纠错，再做受保护重基或按真实任务状态关闭，不能覆盖正式页。
>
> **剩余验收。** 17未stage为rank/relative/beam/radius/stages/pcp/config-source/stair/async/sfa/layer-sharding/multistream/netloader/hotreload/range-debug/runtime-path/size。size旧独立零问题报告漏掉新增流程话术，原报告保留，父addendum与修正版独立核源已补全，候选7b15eb77；三个字段声明页保留证据缺口，不算完整教学。RFork两页/config-source/async/multistream仅归档；另2份writes=[]无正文包不计生成成功。旧compile-stage177结果134跳过/30新pending/13失败，原177最新109待审/55版本变化关闭/13失败/0运行。快照/Lint合法且维护空闲后才串行入队剩余修正版，再启动已有schema-feedback入口；状态必须读真实report/exit/CIM/租约，不能按本段旧数字重启。所有新稿pending、不发布，每日03:00和旧69范围不变，问答草稿仍未发送（21:27实际IAB tab3/5193可见）。下方均为历史。

> **2026-10-26 21:09 历史：整轮未验收，新恢复worker尚未启动。** 原18修正版串行入队中，前11份实际stage新pending并rejectReview旧包留史完成；第12份rank因共享wiki临时缺图被整合校验拦下，循环已退出、租约已释放，其后6份未尝试。不得重做前11。实际证据见 `compile-stage-correction-stage-execution-20261026.json`、`compile-stage-corrections-staged-verification-20261026.json` 与 `compile-stage-shared-edit-validation-20261026.json`。相关其他任务正在补图，先重核readKnowledgeSnapshot/splitProblems(runLint)，不覆盖他人编辑。
>
> 新stair/async/SFA/layer-sharding/multistream5候选已父独立核raw和固定源，受保护helper23 guard和严格runtime类型通过，独立helper23仍待。SFA通过规范supersede保留旧行历史，把活跃角标31改30；layer-sharding纠正完整storage释放/单元素占位及临时广播条件，精确追加来源34/35；async和multistream仅归档。剩netloader/hotreload/range-debug/runtime-path4候选已作者冻结，待父核；后三份只有字段声明和证据缺口，不能计完整教学成功。
>
> 新UI已实际核KVPP/prefetch/profiling/RFork身份4份，读差异/条件/来源并截图，见 `compile-stage-corrections-ui-20261026.json`；其余继续，不能按文件回执推定UI通过。旧compile-stage177结果134跳过/30新pending/13失败、原177任务109待审/55版本变化关闭/13失败不变。新schema-feedback入口只读177/142/3计划与独立通过但未启动；所有新稿仍pending、不发布，每日03:00及旧69范围不变。下方均为历史。

> **2026-10-26 20:54 历史：整轮未验收，正在串行入队18份父核修正版。** 旧compile-stage轮已于10月25日17:51:11以exit1结束，实际177结果为134跳过/30新pending/13失败；原177任务为109待审/55版本变化关闭/13失败/0运行。20:36实际CIM确认旧wrapper30960/node66904退出。不得按下方17:23旧检查点重启旧prefix；当前维护操作见 `compile-stage-correction-stage-execution-20261026.json`，须等18份stage/reject循环实际退出、租约空闲后再开恢复。
>
> **18份修正版已有父逐源复核及严格工具独立0P1/P2。** KVPP配置、prefetch、profiling、RFork身份/启动、absolute、fused-op、cross-node、load-risk、load-window、backtrack、rank、relative、beam、radius、stages、PCP、config-source逐份stage新pending并rejectReview旧包留史；读取各prepared/retired实际回执，已完成项不得重做。RFork两页和config-source正文全等旧文，只算归档。新UI逐份进行，不能由文件回执推定完成；旧27已全UI通过，不再stage。agent新增stair/async/SFA候选仍待父核，SFA既有31角标问题另列，不假称通过。
>
> **下一恢复入口已准备但此时尚未启动。** `failed-worker-recovery-schema-feedback-20261026.ps1` 调用 `resume-failed-worker-20261023.ts --schema-feedback`；独立0P1/P2与只读177/142/3计划通过，后续状态使用 `check-context-recovery-state-20261024.ts --schema-feedback`。GLM草稿id错误已加入同job、显式retry的有界schema校验反馈，先红后绿、全套167文件1362项通过；本日类型/构建/Lint exit0（27warning/3info），严格runtime类型与18入口guard通过。实际13项恢复仍待，不把测试当全语义验收。材料失败保持既有选行/quoteID与600字逐字限制，准确输入输出见 `compile-stage-final-five-failure-diagnostics-20261026.json` 等，成功段缓存保留。
>
> **每日任务与授权边界。** 10月26日03:00只在模型预检遇额度失败，未开始正文；20:38真实ChatGPT/gpt-6.1-sol预检已成功，无购买/reset。每日03:00不改，下次10月27日。只原177/142页、并发3且同页串行、daily-lease；新稿pending、不发布，旧69范围不扩大。未发送问题“那它与 TP 有什么区别？”仍在IAB tab2/5193。临时跟进保留至整轮真实通过。下方为历史。

> **2026-10-25 17:23 历史：恢复当时仍运行，整轮未验收。** 17:22真实CIM确认wrapper30960/node66904及3个模型子进程，daily-lease active66904、无exit；该时点报告150结果=127跳过/18新pending/5失败，原177为97待审/55版本变化关闭/22失败/3运行。关闭与跳过不计生成成功；实际结束结局以上方10月26日检查点及report/exit为准。
>
> **实际恢复与语义分列。** `compile-stage-contract-real-recovery-20261025.json` 已父核原9编译失败中的5份：真实模型中间稿1 raw来源、无旧编号/生成区，最终pending生成区保留、正式页未改。其余不得由此推定通过。原27人工修正版现全部实际IAB读pending差异、条件与来源并截图，聚合27新ID逐项匹配；force/fuse仅归档，不计新增教学。新6候选KVPP配置8f2ff901、prefetch3ec945d3、profiling1738d8af、RFork identity8c5edbf3/startup652d8229、absolute24efd158已父核25/34/28/33/22/16段raw和固定源，详见current-nightly.compileStageSemanticCandidates及对应compile-stage-*-correction-independent回执。profiling只准精确追加9来源32–40；prefetch父发现类名误写已纠为ModuleWeightPrefetchConfig，3条supersede/MLP零值例子保留；absolute2条supersede同步门控条件；两RFork正文全等旧文，只留归档。6候选全部未stage、旧问题pending未退役、候选UI未核；helper尚未接6入口，须保留hash/decision/正式基线/精确metadata/租约保护，实际worker退出且维护空闲后才stage/reject。不要为此停止健康worker。size原稿独立0P1/P2；agent已冻结fused-op771165a3、cross-node d91c7731、load-risk d362337e三个候选，均待父独立复核，未stage/UI；前两份分别精确追加2/3条固定来源，见对应author/decision，不能只信自查。agent继续后续新稿。
>
> **5失败已读准确输入输出。** scheduler新c53e上下文伪引文“topic”，原24e7 raw未到；sequence同8ec选行超maxEndLine，612/746字；lifecycle新cbaba prior-edits身份把JSON反斜杠解为换行，不是旧6c7341；ai-qos同88df选行超界691/873字、保留3成功段；ascend-config-system新4430 quote6三行各多4空格，260字仍非逐字、保留2成功段。准确5路径见current-nightly.currentFailureDiagnoses，均compile-stage前缀。下一已有选行/有界quoteID策略，不放松600/逐字、不并发重跑。每日03:00和旧69范围不变，问答草稿未发送、新稿pending、不发布。完成全轮才通知并删临时跟进。下方为历史。

> **2026-10-25 16:58 实际进展：仍未整轮验收。** 16:57最新CIM仍有wrapper30960/node66904和3个模型子进程，daily-lease归属66904、无exit，健康运行不得重启。110结果=105跳过/3新pending/2失败；原177为82待审/55版本变化关闭/37失败/3运行。新KVPP配置9106568e、prefetch751e0670、profiling c6b29322已生成，后续读真实回执。KVPP配置原d840材料已实际按quoteID完成1段，父独立核8引文逐字且≤600，旧612字失败保留；见 `compile-stage-kvpp-config-material-recovery-20261025.json`。但正文独立审查已发现DP/PP组边界重复1P2，现有agent正做候选，再接prefetch/profiling及后续；不得把新稿或材料恢复当语义通过，候选须父复核且空闲后stage。
>
> **两失败已准确分流，不需为此停止健康worker。** `compile-stage-scheduler-material-failure-20261025.json`：新c53e上下文首段返回伪引文“topic”，这不是原24e7 raw；第二段8引文逐字已缓存，原raw尚未到，下次先上下文选行再原raw恢复。`compile-stage-sequence-material-failure-20261025.json`：同8ec manifest确已进入选行，模型选352–365但maxEndLine364（612字）、208–219但maxEndLine216（746字）；现有下一quoteID策略已适用，后段成功缓存未丢，不trim/放松600或盲重跑。16:55结构86有效正文/88历史/0错误是当时快照，新增稿还须再审计。原27替换已全部完成，其中NPU、reading、prepare、recompute-scheduler、recompute-cpu、short、engine-core、layerwise、sampling、troubleshooting、repo-map共11份已实际读IAB差异并截图，其余16份UI继续。当前无用户决定项，临时跟进保留，所有新稿仍pending、不发布。下方16:47为启动时点记录。


> **2026-10-25 16:47 当前：原177继续，整轮未验收。** 新 `compile-stage` 轮16:45:09启动 wrapper30960/node66904，真实CIM父子命令与daily-lease active66904已核；当前仍运行、无exit，严禁重启或并发另一轮/同页worker。读 `failed-worker-recovery-compile-stage-20261023.json`、process/exit/out/err、`compile-stage-process-verification-20261025.json` 与 `compile-stage-recovery-handoff-20261025.json`；状态和记录脚本均加 `--compile-stage`。启动前原177为79待审/55正式版本变化关闭/43失败，关闭与跳过单列。开始只有已解决项跳过，还不能称实际模型根因恢复。
>
> **旧轮已实际检查点退出，新的编译阶段契约已修。** redundancy 于16:21:42 exit1，141结果=94跳过/29新待审/18失败（9材料或上下文、9编译角标）；真实CIM证实36028/59984退出，旧租约已释放。size等9项的真实输入只允许新raw单来源，却要求保留旧生成区；输出照抄旧C12–C18及解释，mark-index正确拦截。现中间草稿明确只提新材料、不能携旧编号/生成区，最后正文组装仍拿完整旧页并严格保留生成区。先红后绿，5文件50相关项、完整167文件1360项、类型/构建/Lint及独立0P1/P2通过；另入口独立0P1/P2与只读177/142/3 plan通过。见 `compile-stage-contract-verification-20261025.json`、`compile-stage-runner-independent-20261025.json`。不提高窗口、不放松来源/逐字/600，不以测试替代实际恢复。
>
> **27份人工修正版已父逐源复核，并在worker退出后的空闲期全部strict stage为新pending。** 旧问题包rejectReview留史、payload未改、原任务指新包、正式基线不变；聚合 `redundancy-corrections-staged-verification-20261025.json` 列全部新旧ID和父报告。各 `redundancy-*-correction-{independent,prepared,retired}-20261025.json` 为证据。helper仅27显式入口，short只准精确summary；layerwise只追加固定2ed6cbba来源26，repo-map只追加0fc695fc outputs298–307来源15。最终runtime类型与2正8负来源边界通过。force/fuse仅保留归档、存活正文等于正式旧文，不计新增教学成功。troubleshooting计数漏单行L796已父git实际补核为25段/24物理全等；末session63空行差异保留。repo-map原有13角标/100%warning如实保留，没有新增角标或假I。
>
> **实测与剩余验收分列。** 16:44完整快照合法、Lint0error/14warning，结构84有效正文/88历史/0结构与正式基线错误，不代表全语义。NPU、reading、prepare、recompute-scheduler、layerwise修正版已有实际IAB pending diff/来源边界/规范历史与截图；其余UI继续，不能说全部UI完成。现有review_pending_corrections已审旧轮29新稿：27问题稿均替换、block-table参数和combine原稿独立通过，后续新模型稿仍逐稿审。原问答草稿“那它与 TP 有什么区别？”未发送，5193/8790预览、IAB tab2保留。
>
> **下轮材料恢复沿现有策略，旧证据不改。** sequence/scheduler缩进或截注释、startup/lifecycle的JSON反斜杠、ai-qos两空格误抄四空格，下一已有选行；KVPP配置612/prefetch680/profiling610/rfork636字已有有界quoteID。9项准确input/output及成功分段见 redundancy-*-material/context-failure 回执，当前新worker旁不单独重跑。重复失败核实际输入输出，必要时新prefix.stop让任务检查点退出后加载修复。只有原177/142页、同页串行并发3、daily-lease；所有新稿pending，不发布。旧69批准范围不变，每日03:00不改（Oct25旧CLI缺失已仅修本地路径，Oct26继续）。全部真实恢复后仍须核177每项结局、所有新pending/正式基线、独立raw/固定源/UI；真正整轮通过才通知并删临时跟进，保留每日任务和聊天。下方均为历史。


> **2026-10-25 15:45 当前：恢复仍运行，整轮未验收。** 最新真实CIM确认wrapper36028/node59984父子命令及3个模型子进程，daily-lease active59984、无exit。15:44报告106结果=81已解决跳过/19新待审/6材料失败，原177为69待审/55正式版本变化关闭/50失败/3运行；跳过与关闭不算生成成功。15:42快照合法、Lint0error/14warning；15:44结构审计76有效正文/61历史/0error，均不替代语义验收。健康worker继续，禁止重启或并发另轮。
>
> **十份候选父独立核源通过，但均未stage、旧包未退役、UI未验收。** 原六份外新增answer23e90dd4、c8 3f0b253c、engine-core f153eab8、force-eplb d21a8e8f，见 current-nightly 的 semanticCandidates 和各 redundancy-*-correction-independent-20261025.json。engine修正异步并发外层条件、队列提前返回及7/8/3/11来源映射，显式supersede旧过宽说法；35raw中34物理全等，末patch源为CRLF且raw少L73空行，非空源码一致。c8限定main容量检查及接口角色，24raw中23全等/末LF缺失；force正文等于旧文，只留来源归档，28raw中27全等/末LF缺失。answer17raw中16全等/末LF缺失。原问题历史保留，不把候选通过当现有pending通过。
>
> **严格入队工具已接十入口，只读检查10/10通过。** prepare/retire-teaching支持 --redundancy=<npu|reading|prepare|recompute-scheduler|recompute-cpu|short|answer|c8|engine-core|force-eplb>，绑定父复核candidate/decision/正式基线，参数页纳入，short只允许精确summary一字段替换。retire新增daily-lease与running rewrite防护；真实CLI隔离反例拒绝活租约且未改字节。类型/构建通过，项目Lint exit0带27warning/3info，新模块另经Biome；runtime显式类型检查和guard自检见 redundancy-correction-tooling-verification-20261025.json。尚未调用 --prepare 或退役；等维护空闲且实际worker退出后再strict stage新pending、rejectReview旧包留史、更新原任务指针并查UI，不为此打断健康worker。
>
> **六项材料失败均已保存准确输入输出，未并发重跑。** 原sequence缩进与scheduler截注释走已有选行恢复；新增KVPP配置612字、prefetch已有正文why上下文680字、profiling首段610字、rfork第二段636字均逐字但超600，下一无重叠恢复走已有有界quoteID。prefetch同job前三次为两次模型不可用和一次额度失败，本次才首次内容校验失败；历史不删。profiling/rfork各1成功段保留，KVPP/prefetch相应manifest无成功段。回执 redundancy-{kvpp-config,prefetch-ratio,profiling-chunk-config,rfork-identity}-material-failure-20261025.json，勿放宽600/逐字。现有review_pending_corrections继续matmul/super/sleep等新稿，block-table参数与combine新增已独立0P1/P2，UI仍待。下方为历史。

> **2026-10-25 15:22 当前：恢复仍运行，整轮未验收。** 15:21实际CIM再次确认wrapper36028/node59984父子命令，daily-lease仍active59984、无exit；91结果为77跳过、12新待审、2材料失败，原177为62待审/55正式版本变化关闭/57失败/3运行。关闭/跳过不算生成成功。15:21共享快照合法、Lint0error/14warning，结构审计69有效正文/61历史/0error；92个真实当前轮请求预算通过，均不替代语义验收。禁止并发重启。
>
> **五份候选已父独立核源，仍未stage：** 原NPU/reading/prepare三份之外，recompute-scheduler（原2P1/2P2）候选8f1909c7已核39段raw和抢占/代理/版本固定源码；recompute-cpu-offload（原4P2）候选231328e2已核新建状态前提、共享块即时ready与新搬运等齐报告、V1/PD范围及来源15/3/5/6/7。CPU raw28段中27段连物理行结尾全等，最后worker305仅缺一个空行，非空源码全等；旧raw未改，不能写28段完全一致。父回执`redundancy-recompute-{scheduler,cpu}-correction-independent-20261025.json`绑定候选/decision/正式基线；五份原问题pending均未退役，空闲后才能strict stage/rejectReview留史并查UI。
>
> **15:26追加第六份父复核：** short-request-first原4P2已修在候选df00f52d，decision2ee032f9；父独立读2ed分类/恢复/pin/文档和上游预算代码，25段raw中24段物理范围全等、末段仅缺716空行。summary只允许回执中精确一字段替换为等待门槛/非时限保证，9项supersede留史、3段calc算式完整不变、30角标/教学0；见`redundancy-short-correction-independent-20261025.json`。六份均未stage，旧包未退役；staging helper还须接六入口及summary精确校验。现有review_pending_corrections继续answer、block-table参数、c8/量化参数等后续真实新稿，读取`redundancy-semantic-review-queue-20261025.json`。两项材料失败仍只有sequence缩进与scheduler截注释，各保留成功段，下次无重叠恢复按已有选行策略；不放宽逐字/600、不在当前worker旁重跑。下方为历史。

> **2026-10-25 15:10 历史：恢复与逐稿核源继续，整轮未验收。** redundancy wrapper36028/node59984 的真实CIM父子关系、daily-lease active pid59984再次核实；本轮84结果为76跳过、6新待审、2失败，原177为56待审/55正式版本变化关闭/63失败/3运行，关闭和跳过单列。禁止并发重启，后续读取实际report/exit。
>
> **三份人工候选已父独立复核，仍未stage：** NPU（原2P2）、reading（原1P1/4P2及父发现草拟范围残余P2）、prepare（原2P2）分别逐字核39/22/34段raw与固定源码，报告`redundancy-{npu,reading,prepare}-correction-independent-20261025.json`绑定候选和decision hash。reading最终候选fb523d42明确EAGLE草拟范围并通过revisePage保留旧说法；prepare d4ed9fc7保留上游source33的缓存/匹配/候选计数条件，NPU3a7f2a4c只保留核验边界。等维护空闲才严格stage为新pending、旧rejectReview留史并查UI，不能把原问题pending计作已验收。现有review_pending_corrections继续recompute-scheduler（已报具体后果弱化/版本与角标问题）、recompute-cpu-offload、short-request-first及后续，查语义队列。
>
> **两项材料失败已定位而未重跑：** sequence-parallel把整段代码每行多抄4空格；vllm-scheduler把同一注释行前半句截掉，均被逐字校验正确拦截。准确input/output及成功分段见`redundancy-sequence-material-failure-20261025.json`与`redundancy-scheduler-material-failure-20261025.json`；下次无重叠恢复已有按行选择策略，保留各1成功段，不trim或放宽600限制。15:05快照合法/Lint0error，结构审计62有效正文/61历史/0error；角标warning及语义问题另核，不等于全部通过。新稿一律待审，每日03:00不改。

> **2026-10-25 14:58 新实证：** NPU与reading-vllm-ascend原任务已真实生成待审 `20b18986429da20048565929807af2c122f6dfedffc97efde8a95f262b592a0f`、`e0f83bbcb1817cd073887b0b45c449351d19b73e10c87b1d1267a2b520a1267d`，正式页未改。`recovered-body-context-real-20261025.json`独立核NPU18段/reading7段完整覆盖旧文，所有先前已接受修改索引匹配；reading3个实际压缩请求的引用逐字且≤600，新2个manifest完成，旧ce76失败历史保留而非宣称旧包已恢复。NPU越过原模型前负预算，但独立审阅已报2P2（重复旧回退事实、来源17误指应为19），现有review_pending_corrections正在准备人工候选并继续reading审查；查redundancy-npu/reading-independent-20261025.json及对应correction目录，父复核后等维护空闲stage，不能算语义通过。prepare-inputs材料3/3已恢复、旧2段复用、8引文逐字≤600，正文继续。14:55原177为52待审/55版本变化关闭/67失败/3运行，76结果含74跳过/2新待审/0失败；严格审计59有效正文/61历史/0结构基线错误。worker仍运行，新稿不发布。

> **2026-10-25 14:49 当前：原177恢复已继续，整轮仍未验收。** 新 redundancy 轮于14:44:54启动 wrapper36028/node59984，实际CIM与daily-lease归属已核，严禁重复启动或并发同页worker。14:49报告74项全为已解决跳过、0新失败；原177实时为50待审/55正式版本变化关闭/69失败/3运行，关闭与跳过不算模型成功。读 `tools/wiki-runtime/failed-worker-recovery-redundancy-20261023.json`、process/exit/err及 `redundancy-recovery-handoff-20261025.json`；状态检查用 `check-context-recovery-state-20261024.ts --redundancy`。只原177/142页、同页串行并发3、持维护锁，不发布。
>
> **旧失败与实际恢复入口：** frame-budget其实已10月24日06:21:03 exit1结束（177结果含105跳过/关闭、72失败，没有新正文生成成功），旧64236/56968实际退出。原frame预算完整回归已166文件1343项通过，但NPU实际正文尚未证明恢复。10月25日03:00每日任务另在模型预检失败：原本地CLI路径已不存在；只将sync.config.local.json改为实际2993767bd1dfb009二进制，gpt-6.1-sol/ChatGPT真实预检14:24成功，无改模型或购买/重置用量。每日03:00定义不变，下次10月26日。旧失败回执保留。
>
> **新根因修复与边界：** 已有修改索引只覆盖本轮新修改，未覆盖别段未修改旧事实。现正文组装前对完整补充逐段读取存活旧文，只有整项全冗余且原文坐标逐字合法才舍弃；混有新条件或来源身份一律保留整项。独立审查发现来源缓存身份P2，已先红后绿修复，绑定编号来源、证据等级及raw身份。5文件62相关项、最终完整167文件1357项、类型/构建/Lint通过，独立代码0未闭P1/P2。真实隔离正负控制通过；真实dynamic四项都因混合来源/条件被保留，不能宣称自动消重成功或全语义通过。证据section-redundancy-{independent,real-controls,real-probe,final-full-suite}-20261025系列。
>
> **dynamic已纠正并待审：** 原fc1e4d58的重复、术语先用后解释与角标膨胀3P2经人工修订；父独立核32段raw和固定源码，正文只增3段、旧文保留、角标28/教学段0。来源12为scheduler采样循环（旧复核误写来源8已留更正历史），保留仅P节点教程范围、分支内条件及性能未测边界。strict stage新 `e53a3f9c573d4c31a0232ebf05aceb4ca5c27fec6e94aa1626df66dca04faf84` pending，旧包rejectReview留史/payload不变/原任务指新包，正式页未改。已有IAB实读新待审diff/PD定义/来源范围与计时限制，dynamic-corrected-pending-ui-20261025.json及三张截图，未发问题“那它与 TP 有什么区别？”保留。最新严格审计57有效正文/61历史/0结构及正式基线错误，不算全库语义验收。
>
> **剩余：** 核新轮NPU正文实际恢复，prepare-inputs的617字与reading-vllm-ascend反斜杠失败按保留检查点/有界引文策略真实恢复；重复失败先查准确输入输出，必要时当前prefix.stop检查点退出后加载修复。新产出逐页独立核raw/固定源和可用UI，最后核原177全部结局（关闭分列）、pending/正式基线。所有新稿待审，旧69发布授权不扩大；整轮真正通过才通知并删除临时跟进。下方均为历史，实时回执优先。

> **2026-10-24 06:01 实跑：原177未验收，新预算修复等待完整回归。** context-index已05:48:13检查点exit1（77项含跳过/3失败），37156/60928实际退出、维护锁空闲。当前50待审/24因正式版本变化关闭/103失败。NPU材料已3/3真实恢复且复用2段；其正文仍在模型前因完整frame未预留而负预算失败。现先计来源/引用规则/已有修改上下文/反馈，再分配新材料与正文，不提高窗口或削弱来源、历史、发布校验。真实复现先红1，相关4文件40项、类型/构建/Lint、独立审查通过；独立隔离NPU12段逐字覆盖、转义、缓存/反馈通过。section-frame-budget-full-suite日志/exit尚待最终结果，不能当实跑恢复；准备的frame-budget runner只续原177，旧进程退出与全套检查确认后才能启动。
>
> Prefill813be2f032修正版已独立核25段raw/固定源与新增source29，修复断表、重复、角标过多和分支条件4P2，经严格stage保持pending；旧包留史，正式正文未改。标题/摘要同步跨轮定义，新来源与规范历史已在已有IAB实际查看，prefill-corrected-pending-ui-20261024.json/png及body截图，未发问题未动。加上KVPP/LoRA/fineTP/pipeline修正版，最新57有效正文/60历史/0结构及正式基线错误。dynamic新fc1e4d58仍待独立教学/来源审查；28真实索引请求26非空覆盖通过，未据此声称语义通过。prepare-inputs首引文617字（2成功段保留）与reading-vllm-ascend摘要非逐字准确回执context-index-material-failures-20261024.json，按已验证ID/选行恢复，不盲重跑。后续新稿全待审、旧69审批范围/每日03:00不变；整轮完成仍需原177逐项结局（关闭分列）、独立核源/UI及正式基线。

> **2026-10-24 05:23 历史：请求检查点停止，仍未整轮验收。** context-memory 39568/22892等当前任务结束再装载修复；05:20为73项含跳过、2失败，原177为48待审/23版本变化关闭/105失败/1运行。新实际输入证明“摘要非空”仍会漏掉上一段已写事实。现分段添加确定性修改索引，保证每项位置/理由可见；预算紧时明确标记逐字前缀，少于64码点（短理由保留全部）则停止留检查点，不以空索引继续。详情预算≥4096，最终输入、逐字、来源、旧文与历史校验不变。先红2，独立审查边界另先红1再修，4文件38项、类型/构建/Lint通过；context-index-independent为0P1/P2。最终全套context-index-final-full-suite及真实模型尚待核，不能称防重复全部通过。
>
> KVPP/LoRA候选已手工修正并父独立复核（30/29段raw逐字匹配固定源码），尚未stage，须等维护空闲；用prepare/retire-teaching的 --context-kvpp/--context-lora生成替代pending、旧包驳回留史。fineTP新稿已发现来源错配、重复及插断表格，独立报告与候选准备中；pipeline新稿待读源。dynamic原raw3/3已真实恢复复用2段，但新上下文摘要非逐字；npu-model-runner首raw超600，成功段保留。证据context-index-root-cause、context-memory-real-recovery及current-nightly-verification。旧worker真实退出和检查通过后，只续原177的context-index脚本已准备。每日任务、审批边界不变，全部结束后仍需逐项结局/正文来源/待审基线/UI验收。

> **2026-10-24 05:00 历史实跑：仍未整轮验收。** context-memory 已于04:59:44启动（wrapper39568/node22892，实际命令已核），只继续原177任务/142页，同页串行并发3并持daily-lease。旧context04:48:33检查点exit1结束，69项含跳过、3失败；新启动前45待审、21正式版本已变化关闭、111失败。实时结局用 tools/wiki-runtime/check-context-recovery-state-20261024.ts --context-memory 核对，关闭和跳过不算模型成功，禁止重叠worker。
>
> **真实暴露的上下文问题已修并复验：** 分段此前漏传已接受修改；补传后又发现通用材料提取把“不是新证据”误判成可丢弃的无关材料，真实返回空上下文。现增加专门 prior-changes 提取用途、缓存前非空校验，普通无关来源仍可为空；不升证据等级、不放松逐字/600字符与输入预算。完整166文件1338项及类型/构建/Lint通过；原失败输入真实恢复出2049字节、逐字匹配的具体事实和适用条件，旧失败留存。证据 context-empty-root-cause-20261024.json、context-memory-real-probe-20261024.json；这只证明空上下文恢复，摘要未包含全部修改，不承诺自动消除所有重复。
>
> **正文实证：** 前六份与最新五份纠错均经不同作者/审查者逐源核对、严格staging为pending，旧问题包通过审阅契约留史，正式正文未改。最新五份raw128/128与固定源码一致；largeEP追加唯一来源39补全MC2/FUSED_MC2跳过同步条件，回执 binding-final-corrections-retired-20261024.json。04:59严格审计52份有效新正文/55历史/0结构和正式基线错误。layers修正版2cc45aac已在已有IAB实际读取pending正文diff、MTP定义、90次主干范围及来源对应，layers-corrected-pending-ui-20261024.json/png；未批准。KVPP新包1c983虽然生成，独立读稿仍有1P1/2P2，正在修订，不算语义通过。dynamic剩一段行选择超600、fineTP不连续引文、LoRA旧行中间插入均记录于context-live-failures-20261024.json，后续核既有反馈/有界ID的真实恢复。最终仍需原177逐项结局、新正文逐源教学与UI验收。旧69授权不扩大，每日03:00定义不改；真正整轮通过后才删除临时跟进。

> **2026-10-24 04:12 历史：** binding当时仍运行，原177为39待审/18关闭/117失败/3运行，59项处理含跳过、2失败；后续状态以顶部和current-nightly-verification为准。

> **03:57 追加实证：** binding 仍运行；原引文绑定失败已真实恢复并产出KV块分配待审正文b7c6524a…（section-binding-real-recovery-20261024.json）。balance/data-parallel长材料分别2/2、3/3完成，复用1/2个已成功段，所有选中原文逐字匹配且≤600（binding-material-real-recovery-20261024.json）。这不等于正文语义通过：KV新包又发现2项来源/重复P2，本地候选03:58已独立复审通过（binding-corrections-independent-20261024.json），等待维护空闲stage替代；balance新正文c16b99cd…待独立读源。动态分块PP的新raw首次2段失败（非此前JSON问题），看binding-live-failures-20261024.json，保留成功段，等本worker结束后按检查点自适应恢复。最新严格审计42有效待审正文/41历史/0结构和正式基线错误，仍不能声称整轮通过。

> **2026-10-24 03:48 当前：修复后继续原177项，整轮未验收。** binding 于03:47:14启动，wrapper49796/node63188，实际命令和父子关系已核；报告 failed-worker-recovery-binding-20261023.json，退出看 binding-exit，勿重复启动。source-notes 已于03:36:43检查点exit1，48项/3失败，旧25496/37224已结束。启动前原177为33待审、13因正式版本变化关闭、131失败；关闭/跳过不算模型成功。仍仅142页、同页串行并发3、daily-lease，不发布。
>
> **根因及实证：** vllm-kv-block-allocation 把不相邻内容拼成引文，被正确拦截，但旧通用错误没有给重试具体修正提示。现增加固定 allowlist 反馈并识别历史同类错误，不传模型错误自由文本、不放松逐字/唯一匹配。先红2再4文件39项、完整166文件1334项、类型/构建/相关Lint通过；section-binding-feedback-root-cause-20261024.json。balance-scheduling 与 data-parallel 首次超600引文的失败和成功分段保留，须在新恢复中核既有有界ID策略真实完成，不仅看测试。
>
> **正文验收：** 本次9份新稿独立审查发现1项P1/14项P2（首屏术语顺序、重复讲解、来源错位、返回条件），均已人工修订、独立复审并严格staging成pending；旧包驳回留史，payload不变，正式正文未改。两批回执 source-notes-corrections-retired-20261024.json / source-notes-later-corrections-retired-20261024.json。严格审计40份有效待审正文、41份问题/被替代历史、0结构和当前正式基线错误。稀疏注意力02e5b0cd…已在用户已有IAB普通刷新后实际打开正文diff，截图及记录 sparse-corrected-{pending,body}-ui-20261024；无新发布。新产出仍需逐页读源、独立审查和可用UI核验，测试与本次局部读稿不能代替整轮。只授权旧69份已发布；每日03:00定义保持原样。后续以current-nightly-verification-20261023.json为准，完成才删除临时跟进。

> **2026-10-24 03:05 实跑状态：未完成整轮验收。** 原177项已从检查点继续，source-notes wrapper25496/node37224，03:03:27启动，实际命令已核；仅142页、同页串行并发3、维护锁、跳过已解决、无发布。03:04已处理29项/0失败包含跳过；启动前仍145失败、24待审、8因正式版本变化关闭，不将关闭项算作模型生成成功。实时证据 tools/wiki-runtime/failed-worker-recovery-source-notes-20261023.json。03:00每日自动扫描在patrol阶段被停止，避免重复原已完成阶段；每日计划配置未改，后续仍03:00执行。
>
> **新增根因修复与验收证据：** 长编译草稿的行号身份改为_drafts正文，原始来源单列，避免把草稿第N行写成raw第N行；对传入I级材料，在缓存前拦截新增C/S/M指向raw的证据升级。对应先红后绿；最新完整166文件/1332项、相关6文件/73项、类型/构建、相关Lint通过。25份已知教学/来源问题逐条修订并独立审查，再经现有来源/引用/历史/发布前校验生成pending；另将GLM及两份KV、attention-cost安全重基，保留并行正式编辑。严格审计31份有效新正文、32份问题/被替代历史、0结构与当前正式基线错误；新稿没有发布。CANN修正版f490ad86…已在现有IAB页面实际显示待审正文diff及C23，截图tools/wiki-runtime/cann-corrected-pending-ui-20261024.png。新证据不等于全库事实保证或整轮通过。
>
> 恢复与限制统一见tools/wiki-runtime/current-nightly-verification-20261023.json；根因证据draft-coordinate-root-cause-20261024.json、raw-evidence-level-root-cause-20261024.json；人工纠错证据四份 *corrections-retired* / glm-rebase-correction-retired 回执。全部结束后须再次审计所有有效待审正文、核原177每项结局、独立读源和页面实测，才可报告完成并删除临时跟进。保留原178失败历史、已真实恢复的JSON证据与每日任务。

> **2026-10-24 02:30 当前：恢复在检查点退出，等待共享快照合法；整轮未验收。** budget 于02:15:35 exit1结束，27项/3失败：1项引文超长，现直接选择程序预切的原文ID；2项被并行修改的图spec挡住。旧PID64696/50860已实际结束。已准备 source-notes 恢复脚本，但不能在当前共享页面非法时启动：deepseek-v4-1-flash、swa-bounded-replay、dspark、low-precision-formats 的部分 relation.kind 写成非法 related；不覆盖其他任务改动。最新7文件Lint、6文件69相关测试、类型/构建通过；完整回归165文件通过，1个语料suite因共享schema失败（1321通过/6跳过），不能称全绿。18份教学候选已逐份人工修订并独立审查无P1/P2，block-table补上固定源码中的DCP=1条件、等待独立审查；19份本地严格候选校验通过。新生成rope也在独立审查。所有候选尚未创建替代review；31份有效待审正文结构/基线0失败，仍不代表语义/UI通过。下一步先核 recovery-current-preflight-20261024.json；合法后再启动 failed-worker-recovery-source-notes-20261023.ps1，仅原177项，不能并发。全部新稿待审，每日03:00任务不改。

> **2026-10-24 02:04 当前：原177项恢复已继续，整轮未验收。** quote-probe于01:57:37 exit0，block-table真实生成pending正文63f4eb42；材料恢复5/5并复用4段。独立读稿仍发现新增角标位置及重复表述，不能算教学验收通过。根因是分段接口没有独立页末出处字段：现增加sourceNote，由程序放入源码区、既有历史尾注之前，正文新增角标在缓存前拒绝，原文及成立条件保留。先红1再5文件57项通过、类型/构建通过，最新完整section-source-notes-full-suite日志/exit仍须核最终结果；此前166文件1324项通过。02:04:25启动budget恢复，wrapper50860/node64696（核实际进程），仅原177任务/142页、同页串行并发3、daily-lease、跳过已解决，无发布；报告failed-worker-recovery-budget-20261023.json。五份教学候选（双机、one-request、TP、KV、engine）已人工修正并独立复核，仍仅在teaching-corrections-20261024，未创建替代review；其余13份复制稿及新增block-table待修。30份有效待审正文结构/基线0失败不代表语义/UI通过。源接口根因见section-source-notes-root-cause-20261024.json，所有新稿待审，不改每日03:00任务。

> **2026-10-24 01:55 当前：长材料单项已恢复，正文仍在执行，整轮未验收。** 旧checkpoint-probe于01:25:41、line-bounds-probe于01:32:04均exit1结束；maxEndLine仍被模型越过，已改为再次选行失败后选择程序预切的原文片段ID。完整原文、精确偏移、来源及600字符上限不放宽。01:50:43启动quote-probe（wrapper26300、node65876，须查实际进程），仅原block-table一项；材料5/5完成，4段复用，真实证据bounded-quotes-real-recovery-20261024.json。相关34项、完整166文件1324项、类型/构建与Lint通过。正文以failed-worker-recovery-quote-probe-20261023.json和exit为准，不能把材料成功当整轮成功。正文成功并核源后再启动已准备的budget原177队列，不重叠worker。另18份早期新稿角标仍待逐份修正，teaching-corrections-20261024只是副本；双机/one-request两份已人工修订、独立复核指出的来源尾注位置及过时未核声明正在修正，尚未创建新review。新稿一律待审，保留每日03:00任务。

> **2026-10-24 01:25 更新：** budget-probe 已于01:18:23失败退出，不能继续视为running：预算问题已越过，但同一片段第二次超600字符。已查明输出预算参与manifest身份，换预算后忘了该段需要改用行号选择；现v2检查点按topic和完整分段身份绑定，输出预算仅记在回执，兼容读取旧当前预算报告，保留旧记录。回归先红1项、再4文件37项全绿，构建通过。01:24:49启动 checkpoint-probe（wrapper PID33936，node以实际进程为准），仍只跑原block-table一项；报告 failed-worker-recovery-checkpoint-probe-20261023.json。成功后再续跑已准备的budget整队列脚本，不能同时启动。此前完整166文件1320项已通过；包含此最后修复的 material-budget-checkpoint-full-suite-20261024.log 尚在执行。其余纠错证据与待审边界沿用下条，整轮仍未通过。

> **2026-10-24 01:19 当前：先核验预算修复的真实单项，整轮未通过。** validation 于 01:04:31 检查点结束（23 项、1 失败）；standard 恢复于 01:09:54 结束（50 项、20 失败），完整写作标准加入后真实暴露规则占用过多输入空间，不能算恢复成功。现保留完整标准与证据校验，只按材料选择术语，并让既有页文字修订不再携带不能使用的绘图指南；block-table 输入材料预算从 15466 恢复至 34473 字节，没有提高假定窗口。01:16:54 启动 budget-probe，仅原 block-table 一项，wrapper PID60552、node PID56168；成功前不要启动其余队列。报告 failed-worker-recovery-budget-probe-20261023.json，退出看 budget-probe-exit；通过后已准备 failed-worker-recovery-budget-20261023.ps1 仅续跑原177项。
>
> **待审纠错与验证：** 五份旧问题包已逐条对照固定源码、经独立审查并修订三处 P2；修正版全部 pending，旧错误包通过既有驳回契约留史，payload 未改、正式正文未改，队列指向修正版。证据 pending-corrections-retired-20261024.json；严格审计为29份有效待审正文、0结构/基线问题，另列5份错误历史，不代表语义和UI全通过。复现并修复同一草稿错误复用被驳回旧包；Windows锁EPERM四进程6000次真实复现2次，修复后0次。8文件/71项相关回归、Lint及类型/构建通过；最新完整测试 writing-budget-lock-full-suite-20261024.log 仍须读取最终回执。根因与状态以 writing-budget-lock-root-causes-20261024.json 和 current-nightly-verification-20261023.json 为准。保持新稿待审，保留每日03:00任务；整轮实际通过前不宣称完成。

> **2026-10-24 00:43 当前：新增校验已装载，原队列继续恢复，仍未整轮通过。** feedback 恢复于 00:39:00 在检查点结束，13 项已处理、0 项失败（含跳过此前已解决项）；真实新增恢复 one-request、gap-a5164fe10fa9184412f8、kv-cache-memory-profiling。00:39:38 启动 validation 恢复，wrapper PID67784、node PID33992，实际命令已核对，报告 failed-worker-recovery-validation-20261023.json，勿重复启动。分段整合现在保留 draftEvidence，并明确未核实 raw 用 I、归档出处留在来源列表；裸编号检测同时拦截 I 后拼编号。76 项相关回归、完整 165 文件/1314 项、类型检查和构建均通过。one-request 新待审 c5d8b2a8 的四处新增逐条对照 raw 及固定 0fc695fc 源码通过，证据 one-request-independent-verification-20261024.json；不代表新 UI 已通过。4 份更早新包的裸编号和 concurrent 错误 M/S 等级仍是已知待审问题，不能写成全部草稿通过；原包未默改，新稿均未发布。最新状态与根因实证见 current-nightly-verification-20261023.json、provenance-citation-root-causes-20261024.json。

> **2026-10-24 00:00 当前：独立读源又发现分段整合漏传写作规则，正在检查点切换修复。** concurrent-requests 新待审包 675f5084 的新增句把源码依据标成了 M（实测），事实本身有源码支持，但证据等级不正确；该包仍 pending，未发布，也未默改其内容。根因是 draft-review 两条分段路径只传 HANDBOOK 的「整合」，漏掉包含证据定义的「页面格式」。现已从单一 writingRules 同时传两节，短/长页回归先红 2 项，再 3 文件/18 项全绿，构建通过；完整测试 165 文件/1310 项通过（section-rules-full-suite-20261023.log）。已创建 fixed 恢复的 .stop，在任务检查点停止，不中断已完成成果；待旧进程退出后用 failed-worker-recovery-rules-20261023.ps1 仅续跑原177项。当前状态与已发现待审语义问题详见 current-nightly-verification-20261023.json 及 section-rules-root-cause-20261023.json。整轮仍未验收，所有新草稿继续待审。

> **2026-10-23 23:44 当前：已修复重复失败的三个根因，原 177 项正在续跑，尚未整轮验收。** 精确片段补充可能插在旧行中间并被缓存，现改为缓存前核验完整旧正文；首次整合输入明确带等级的引用语法；普通编译明确原封不动使用所给 raw 来源范围。回归先复现 3 项失败，再 38 项相关测试通过，类型检查与构建通过；完整测试 165 文件/1310 项通过（repeated-failures-full-suite-20261023.log）。23:30 旧进程已于 23:43 停止加载修复，成功检查点和原失败记录保留；23:44 修复后恢复 wrapper PID5124、node PID34868，只处理原队列、同页串行、并发3、持有维护锁。当前报告 tools/wiki-runtime/failed-worker-recovery-fixed-20261023.json，退出看 fixed-exit 回执，勿重复启动。根因实证 repeated-failure-root-causes-20261023.json。新草稿全部待审；待实际整轮、正文读源和界面核验通过才通知用户。

---
id: F004
title: 知识库闭环：投喂、补写、巡检
status: in-progress
owner: BailanCaptain
created: 2026-09-11
---

# F004 — 知识库闭环：投喂、补写、巡检
> **2026-10-23 23:31 当前：失败 worker 已恢复执行，尚未完成验收。** 23:26 完整快照 158 页与全库 lint 已通过（13 条非阻塞警告）。23:30 启动仅原 177 个失败任务的恢复，覆盖 142 页，同页串行、最多 3 组并发；复用既有 workOne/检查点并持有维护锁，避免与每日任务重叠。wrapper PID33728、node PID52284；真实进度看 tools/wiki-runtime/failed-worker-recovery-20261023.json 及退出回执。原整轮 178 条失败历史保留，7 份已生成正文仍待审；不得批准后续新草稿。临时跟进已同步更新。

> **2026-10-23 23:18 当前实跑结果：未通过整轮验收。** 原整轮于 23:14:48 结束，exitCode=1；跨页 127/127、来源复查 151/151 已处理。178 条失败中 172 条来自共享编辑期间的页面校验阻塞，另有 5 条正文输出校验失败及 1 条已有真实恢复回执的 JSON 失败。7 份新正文仍 pending，结构和正式基线检查通过，双机草稿已对照 raw/固定源码并实测页面。23:16 完整快照恢复合法，但全库 lint 尚有 3 处共享编辑问题；临时 heartbeat 已更新为待校验通过后从失败队列续跑。详见 F004 顶部和 tools/wiki-runtime/current-nightly-verification-20261023.json，勿把下方旧进程状态当作当前状态。

**2026-10-23 23:10 定向重试遇共享编辑阻塞：** 下述三项重试均于 23:09:02 前结束，在模型调用前被完整知识快照校验拦住，未恢复成功。两篇刚在 23:08:52 更新的页面 `concepts/deepseek-serving-case.md`、`concepts/inference-capacity-and-reliability.md` 含非法关系类型 `related`；具体证据为 `tools/wiki-runtime/live-pages-validation-20261023-2309.json`。这属于其他进行中编辑，未覆盖其内容、未放宽 schema。后续先检查完整快照已合法，再按失败回执定向续跑；仍不能宣布整轮通过。

**2026-10-23 23:09 引用校验定向续跑：** 本轮新正文待审增至 7 份，结构与正式基线检查均通过。`one-request`、`tensor-parallel` 的整合输出缺少引用等级，`ascend-patch-system` 的编译输出引用了未提供的来源，三项被既有校验拦住，其余 worker 继续运行。已于 23:08:57 使用现有 `wiki-work.ts run --retry-failed` 串行重试这三项，未修改或降低校验；原失败记录保留。进程与结果分别记录在 `tools/wiki-runtime/worker-validation-retries-process-20261023.json`、`worker-validation-retries-results-20261023.json`，下次先检查回执，勿重复启动。整轮仍未结束。

**2026-10-23 22:59 新正文实际核验：** 来源复查已处理 151/151 页；`learning-guide` 没有可在本地重提取的源码引用，明确标为 needs-source；此前 JSON 失败仍保留原始记录，恢复回执见下。worker 已生成 GLM 模型、双机部署、EP 三份新正文待审包，三份结构与正式基线检查均通过。独立阅读双机包 `9165b2ded7cf5e11285cfb81f7925a7eca100a3548ba54aa322fecccc05d9d9b` 的两条新增事实，逐项对照 raw 与固定 `db701c1f` 源码，并在真实浏览器打开待审正文、查看两处差异；正式文件仍与 before 相同，未批准任何新包。独立核对（历史归档 `../../tools/wiki-runtime/new-body-independent-verification-20261023.json`）、页面截图（历史归档 `../../tools/wiki-runtime/new-body-pending-ui-20261023.png`）。这证明本轮正文待审链路已实际产出，整轮 worker 仍运行，尚不等于整轮验收通过。

**2026-10-23 22:11 实跑恢复：** 跨页核对 127/127 完成、零失败；来源复查仍在进行。dynamic-chunked-pp 的首次模型输出含非法 JSON 数学转义，其他页继续执行。新增重试反馈：解析语法失败只反馈固定 JSON 格式提示，不采纳坏输出、不改证据、不删除历史。稳定复现先红后绿，18 项相关测试、Node 类型检查及 Lint 通过；随后包含该修复的完整回归为 165 文件/1307 项通过（final-with-json-retry-suite-20261023.log）。使用原始真实输入单独重试成功，生成 8178 字符的有效提取；同一任务保留 failed→draft 两次回执，并通过原来源一致性与摘要哈希检查后补完 recordDrift，正文仍未发布。完整原始报告保留这次失败，恢复证据单独保存在 json-real-retry（历史归档 `../../tools/wiki-runtime/json-real-retry-20261023.json`） 与 json-drift-recovery（历史归档 `../../tools/wiki-runtime/json-drift-recovery-20261023.json`）。整轮还未结束，不能声称全部通过。首次新增临时跟进因尚无周期授权被自动审批拒绝；用户随后明确同意“允许临时跟进，完成后停用”。22:38 已创建本聊天 heartbeat「知识库本轮夜间更新验收」（ID automation，ACTIVE），每 10 分钟检查，完成验收后暂停；新草稿保持待审。原每日 03:00 任务不变。
**2026-10-23 当前：69 份变更已按用户授权发布，完整夜间更新仍在实跑。** 本条取代下方历史阻塞状态，未将单元测试或部分草稿作为整轮通过。

- **运行根因：** 03:00 计划任务实际执行，但调用旧 npm Codex 0.153.4 后大量报 `gpt-6.1-sol` 不支持。相同最小请求在桌面 CLI 0.163.0-alpha.11.2 成功，在旧 CLI 稳定复现失败。机器本地 `codexCli` 指向已验证桌面二进制；模型不变。流程在展开模型任务前增加一次真实预检，预检失败保留任务、结束本轮并明确报告，不再批量制造同类失败。计划任务仍每日 03:00，下次为 10 月 24 日。
- **发布实证：** 用户要求“这一批你帮我同意了吧”，于 20:48 锁定 69 份 revision，正文新增内容逐项核对归档和固定源码。页面实际勾选并发布，父批次 `47c425bd1039130d85965916c3d68615d3b33e51179cf7718c6d60081259dc30`；69 个子回执全部 published，37 页逐字匹配批准内容，48 条去重关系，4 份正文。后来新增的 1 份仍待审。范围（历史归档 `../../tools/wiki-runtime/approved-batch-scope-20261023.json`）、发布后核对（历史归档 `../../tools/wiki-runtime/batch-published-verification-20261023.json`）、实际页面（历史归档 `../../tools/wiki-runtime/batch-published-ui-20261023.png`）。
- **审阅交互：** 新增显式勾选和批准所选；请求携带完整 revision 列表，后台不会包含后续新增草稿。同页只有新增关系可合并；正文竞争、基线变化和校验失败仍拦截；中断可按原批次恢复。自动审批曾拒绝扩大到所有 pending 的方案，已改为上述显式版本范围。读取差异实际浏览器 483ms，代理同请求由 7949ms 降至 652ms；根因之一是 Vite 监听了大量运行记录与克隆源码，现已排除。发布后列表重新读取，刷新被较新请求替代不再误报失败。
- **验证：** 模型路径和预检相关 55 项、随后完整 164 文件/1299 项通过；批量审阅相关 32 项通过，类型检查及构建通过。最终完整回归为 165 文件/1304 项全部通过（final-nightly-batch-suite-20261023.log）；最终类型检查、5 文件 Lint、构建通过（final-review-*）。模型前后对照、批量测试与性能记录均在 tools/wiki-runtime/ 下带 20261023 日期的文件。
- **整轮状态：** 20:40 生产运行完成跨页核对、内容复查推进到 22/151；21:04 为装载新批次协议主动停止，检查点保留。69 份发布后，于 21:15:43 运行 `tools/wiki-runtime/resumed-nightly-20261023.ps1`；用 `audit-nightly-progress-20261023.ts --resumed` 核对进度。必须取得最终报告并核对失败、正文草稿和正式文件后才能说整轮完成。用户已授权当前 OpenAI/Codex 目的地，无待答权限问题。
- **原构想与边界：** 原始构想与代码链路仍对齐于“材料→持久知识→发现缺口→带证据修订→人审→下一次复用”。这不等于模型自身持续训练，也不能保证自动正确。200K 仅为示例，输入预算可配置；硬件复测、来源首次导入、事实判断与有限输入入口等边界仍见下方独立核对，不能称所有愿景已经全部实现。


**05:00 当前结论：局部恢复验证通过，完整生产重跑等待外发授权，当前没有整轮进程运行。** 完整回归为 164 文件、1,291 项通过；随后修正状态接口把退出进程误显示为 running 的问题，另跑该接口 9 项测试通过。最终构建、依赖、内容检查通过，项目 Lint 无错误；服务端两文件另经 stdin 代码检查，原文未被 lint 修改。真实 API 已返回双机正文待审包，未发布。双机、HCCL、attention-cost 的新增事实已独立对照 raw 哈希与本地固定提交的 Git blob，版本、别名、关系和来源前缀保留，修订历史验证通过；现有 68 份 pending 包的结构与正式页基线检查通过。这不替代人工批准，也不是全库事实正确性的保证。全量回归（历史归档 `../../tools/wiki-runtime/long-material-final-suite-v11.log`）、状态回归（历史归档 `../../tools/wiki-runtime/nightly-live-status-green.log`）、最终构建（历史归档 `../../tools/wiki-runtime/long-material-final-build-v12.log`）、三份正文独立核对（历史归档 `../../tools/wiki-runtime/recovered-bodies-independent-verification-20261021.json`）。

恢复完整夜间流程的脚本已准备为 `tools/wiki-runtime/recovery-nightly-20261021.ps1`，但启动两次被自动审批拒绝。第一次要求核实模型目的地；核实到当前配置为 `codex/gpt-6.1-sol`、CLI 强制 OpenAI provider 和 ChatGPT 登录后，第二次仍要求用户明确授权向该外部模型服务发送项目 Wiki 和源码归档。已向用户询问，尚未得到答复；未换命令绕过限制。待授权后才能启动并使用 `audit-nightly-progress.ts --recovery` 核对完整结果。浏览器仍停在连接错误页，之前的自动导航触发 URL 安全限制；等待用户手动打开，不通过其他自动化入口绕过。最新正文的 UI 尚未复验，文件、源码及真实 HTTP 接口已有证据。

**04:53 实跑复核更新：整轮仍未通过。** 04:13 运行在完成 122 批关系检查和 151 页内容检查（150 checked、1 needs-source）后，于 04:44 停止。实际正文阶段暴露两类遗漏：无效引用的局部修改先被缓存、最后才被拒绝；短页的整页补充会删改旧文。现在所有同 id 现有页使用精确片段修改，补充保留规则与引用校验前移；显式恢复会重新校验旧缓存，只重试不再合格的决策，保留旧尝试及费用记录。新增复现先红后绿，相关 95 项测试、包含类型检查的构建、正式 Wiki 校验通过。回归（历史归档 `../../tools/wiki-runtime/body-cache-final-green.log`）、构建（历史归档 `../../tools/wiki-runtime/long-material-final-build-v11.log`）、中断回执（历史归档 `../../tools/wiki-runtime/resumed-nightly-interrupted-20261021.json`）。

重新检查全部待审正文后，发现 EP、GLM 和请求主线三份旧包存在裸编号引用 `[39]` / `[28]` / `[40]`，无法被阅读器解析。三包已校验驳回，原文和原因保留，正式页未变；因此下文 EP 的历史事实核对不等于该包当前合格，不能再将其列为有效待审证明。Attention backend 旧包的引用格式复核通过。双机页于 04:53:20 真实恢复生成新正文待审包 `b85085d143e33e923805383ca8f1da4cfab22bbe98566611478d8430515271e0`，正式正文未变，新增语义仍待独立核对；全量回归正在运行。待审正文复核（历史归档 `../../tools/wiki-runtime/pending-body-audit-20261021.json`）、驳回记录（历史归档 `../../tools/wiki-runtime/invalid-body-proposals-rejected-20261021.json`）、双机恢复（历史归档 `../../tools/wiki-runtime/body-recovery-glm-5-3-flash-two-node-20261021.json`）。

当前重开状态以正式全量复验为准，历史分项验收保留。最新代码回归为 163 个文件、1,286 项测试通过，构建、依赖与内容检查通过；Lint 为 0 错误、27 警告、3 提示。另核对待审包后，将 2 份只有反向重复关系、没有正文修改的旧包标为校验驳回，保留原文和原因，未发布；随后 54 份待审包的别名、关系方向和正式页基线检查通过，语义仍待人工审阅。全量测试（历史归档 `../../tools/wiki-runtime/long-material-final-suite-v8.log`）、错误提案处理（历史归档 `../../tools/wiki-runtime/invalid-relation-proposals-rejected.json`）、结构检查（历史归档 `../../tools/wiki-runtime/pending-structure-audit-20261021.json`）。

**04:13 续跑（尚无整轮结果）：** 03:44 那轮已完成 122 批跨页检查及 151 页内容检查（150 checked、1 needs-source），但正文编译报出正式磁盘中不存在的反向关系。独立文件哈希与 `wiki:lint` 确认正式页未变；失败测试定位为生成关系提案时修改了 `gray-matter` 共享缓存数组。另一个同类问题会在修订历史时把旧来源加入原草稿的解析缓存。两处均改为复制后修改，并阻止关系提案重复声明已有边的反方向。正文核对输入还显式保留原页别名，避免旧文压缩后模型把其他概念的名字登记为本页别名。新增复现先红后绿，相关 55 项回归及包含类型检查的构建通过。04:09 停止污染内存的旧进程，04:13:41 重新启动完整流程，保留旧回执并复用成功材料；不得把本段写成整轮已成功。中断原因（历史归档 `../../tools/wiki-runtime/final-nightly-interrupted-20261021.json`）、缓存与别名回归（历史归档 `../../tools/wiki-runtime/proposal-cache-alias-green-v2.log`）、本轮回执（历史归档 `../../tools/wiki-runtime/resumed-nightly-audit-20261021.json`）。

**2026-10-21 长材料与恢复复验（仍在实跑，不能宣称整轮通过）：** 用户说明 200K 只是未来模型可能的窗口，不是固定规格。新增 `contextWindowTokens` / `outputReserveTokens` 配置，目前默认按 128,000 / 16,384 计算保守输入预算，并扣除规则和传输预留。超窗材料逐段提取可逐字核对的引文，分段、筛选、编译均留回执；失败段不用于合成正文，续跑复用成功段。现有长页用精确片段修改，未修改正文由程序保留；新长草稿经分段判断后保留全文进入待审。单文件投喂的 1 MiB 接收限制仍是现有入口约束，不是模型窗口，也不能把这次修复说成无限文件容量或所有模型的自动窗口识别。

已取得一份真实**正文**待审包：`28391be2c6d20b5091957728e484bc9e1e1ede8c37ebacd8a8044415557f9e48`。它为 `expert-parallel` 增加两段说明，原正文 33,450 字符的所有非空行按原顺序保留，原来源、版本与关系保留；正式文件仍逐字等于修改前内容。已逐项核对归档源码中的 EP 内部配置及 `baa023ad` 的 `mega_moe_max_tokens` 说明，未把新版本能力套入固定部署。真实审阅 API 返回 `pending` 及正文 diff，未批准。独立内容核对（历史归档 `../../tools/wiki-runtime/long-body-review-verification-20261021.json`）、真实审阅接口（历史归档 `../../tools/wiki-runtime/long-body-review-api-20261021.json`）。该包生成时保留了旧页 `updated`，后续分段整合代码已修正为本次修订日期；旧包不可变，日期以包内原值为准。

实跑同时发现并修复：正常事务持锁超过约一秒时其他任务误失败；退出进程留下模型任务运行标记；直接撰写页合入 raw 后来源入口未更新；Codex JSONL 的过程说明被拼入最终结构化答复。最后一项改用 CLI 的最终答复文件，并保留事件流的用量、结束与工具隔离检查，依据 [OpenAI 官方接口说明](https://learn.chatgpt.com/docs/non-interactive-mode)。相关复现先失败、修复后通过；发生输出格式错误的真实三页批次已重跑成功。Tokenizer 教学中的单个反引号特殊标记误拦截也已修正，指令内容与角色载荷仍拦截；实际 `prefill` / `token` 批次生成带逐字引文的待审关系包。中文引文压缩的单条尾组不再被要求缩小至无法容纳任何完整引文的预算，先红后绿，相关编译和长草稿回归 20 项通过。整轮仍有失败项，回执保留，尚不能据单份草稿或单元测试宣布全量成功。持续进度与输入预算核对（历史归档 `../../tools/wiki-runtime/nightly-progress-audit-20261021.json`）。

断点续跑已有真实证据：GLM、EP、请求主线、调用链、API 入口、Mooncake 六份材料分别完成 22、36、36、55、53、56 段，分别复用了 20、33、35、54、51、55 个成功段。请求主线有一段连续把 Python 注释的行首文字抄漏；增加提示仍未解决，最终改为失败段选择原文行号、由程序取出原文，记录该段的恢复方式并继续复用其他分段。选行仍校验行号、顺序、非空及 600 字符上限。该次真实恢复把 Mamba 配置段判为与固定部署主题无关，返回空证据及理由；这是留痕的主题筛选，不能拿它声称所有源文件细节已纳入正文。Mooncake 又暴露了超长引文未进入选行恢复的遗漏，先红后绿修正后，真实恢复返回 6 个有效原文范围与 3 条限定说明（判定任务 `5c4296d9f687…`），只新增 1 次分段尝试。非空行选择、越界/倒序/超长/空范围和再次复用均已通过隔离回归。首轮恢复（历史归档 `../../tools/wiki-runtime/failed-material-resume-verification.json`）、请求主线最终恢复（历史归档 `../../tools/wiki-runtime/one-request-final-material-verification.json`）、API 入口恢复（历史归档 `../../tools/wiki-runtime/material-resume-api-server-entry-verification.json`）、Mooncake 恢复（历史归档 `../../tools/wiki-runtime/material-resume-mooncake-connector-verification.json`）。独立维护 CLI 也已修正为存在失败项时返回非零退出码，保留完整 JSON 报告。

**原构想的独立核对：** 已重读 原始 LLM Wiki 构想（历史归档 `../../llm-wiki.md`），检查 `chat-route`、`answer-quality`、`worker`、`review` 和 `retest` 的实际链路，并直接阅读 HCCL 缺口的历史前后问答，未以旧的 completed 标签或 accepted 记录替代正文核查。核心仍是不可变材料、持久 Wiki、发现缺口、带证据的修订、人审后复用。边界也必须说清：内容差异分数只排复核，不证明事实过期；缺口补写仍需来源和预先冻结的复测方案，硬件实测缺失不能自动补齐；GitHub 无初始镜像时夜间不会擅自全库首拉；跨页检查覆盖全库的相关页分批，不是穷举所有页对。当前不能宣称“任何问题都会自动变成正确知识”或“所有原始愿景已完全达成”。

**03:12 复跑暴露的新问题（整轮仍未通过）：** 122 个跨页核对批次全部通过，内容复查走完 151 页；正文阶段多页旧文因被再次序列化成带转义符的 JSON，造成逐字引文校验失败。03:31 停止该进程以避免重复失败，成功回执保留。已改为分别读取上下文的原始字符串，并保留任务标识；包含换行、引号、反斜杠及完整还原的回归先红后绿，相关 49 项通过。同时复现并修正缓存批量处理不让出 I/O、CLI 警告覆盖真实退出原因的问题；不能仅凭旧回执中的 PowerShell 警告断言失败原因。调用链重提取的独立真实续跑成功，保留前次失败，返回正文 6,624 字符。中断记录（历史归档 `../../tools/wiki-runtime/verified-nightly-interrupted-20261021.json`）、调用链恢复（历史归档 `../../tools/wiki-runtime/call-chain-extraction-resume.json`）。

**03:44 正文恢复实证：** `attention-backend-family` 的 8 条旧文摘录均能在正式原页逐字找到，证明原文已正确传递；后续编译还暴露导航缺少已有关系方向的问题，现已提供当前页入边/出边并保留重复边校验。实际恢复生成正文待审包 `d3dfa907facd8e59899d03a5cf42fead2372168cdf97f02870fab8d30bbe3a0b`，HTTP 接口返回 `pending`，未批准。原正文 9,346 字符的所有非空行、来源顺序与关系保留；新增 213 字符的两处说明分别由 `db701c1f` 的 LSE 异常分支及 FA3 文档支持，没有推广至其他版本，正式文件逐字未变。原文传递核对（历史归档 `../../tools/wiki-runtime/context-text-real-verification.json`）、正文逐项核对（历史归档 `../../tools/wiki-runtime/attention-body-review-verification.json`）、真实接口（历史归档 `../../tools/wiki-runtime/production-status-long-material-v7.json`）。包含全部修复的最终整轮已于 03:44:39 启动，尚无最终结果。

**2026-10-21 首次正式全量运行结果：未通过整轮验收。** 用户要求立即手动运行，实际执行时间为北京时间 00:14:05–00:27:53，17 次模型调用，退出码 1。产生 5 份 `pending` 关系补充提案，涉及 6 页、7 条新关系；页面正文未变，也未自动批准。网页审阅列表已实际打开核对。运行结果（历史归档 `../../tools/wiki-runtime/manual-nightly-20261021.out.json`）、待审内容摘要（历史归档 `../../tools/wiki-runtime/manual-nightly-review-summary-20261021.json`）、页面截图（历史归档 `../../tools/wiki-runtime/manual-nightly-reviews-20261021.png`）保存在本机运行目录。

本轮关系检查完成 12 批后，第 13 批把同一页两段内容列为跨页矛盾，被校验拒绝；内容复核完成 4 次模型提取后遇到超出输入窗口的材料；随后 expert-parallel、glm-5-3-flash、glm-5-3-flash-two-node、one-request 的 4 个重写任务超过 64,000 字符编译窗口而失败，未生成正文重写提案。参数扫描正常推进（main 的确定性同步写入 1 页），巡检有 8 条提示。GitHub 镜像仍无初始检查点，本轮未做全库首拉；F003 在线排错范围不变。

另复现并修正了关系分批静默跳过 3 篇长页的问题：长页与相关页使用完整材料窗口，超过窗口明确报错；规划覆盖从 147/150 恢复为 150/150（122 批），不等同于这些批次已全部实跑。提示词已明确跨页矛盾必须来自不同页面，证据校验未放宽。修复的 16 项相关回归、改动文件 Biome 及服务端类型检查通过；全项目类型检查、构建被同期新增的 `wiki-parallel-mechanism-renderer.ts:196` 未使用变量阻塞，整体 Lint 也有该组并行机制文件的错误，未改动这组无关文件。长材料分段、单项失败后继续检查其余页面及修复后的全量复跑尚未完成。下方历史 completed 指此前分项约定验收，不能据此宣称当前正式全量夜间闭环已稳定通过。

**2026-10-20 正式运行决定：** 用户明确要求取消测试额度，按正式使用运行知识库。运行方式由 `wiki/sync.config.json` 的 `mode` 统一控制：`production` 取消项目内金额、调用次数、任务尝试次数和每晚处理数量上限，旧账目与回执保留；问答、保存、后台模型任务和生产 CLI 共用这一规则。`test` 保留原有限额，供隔离测试使用。下方“夜间模型配额 0”均为历史决定，不覆盖本条。

正式夜间运行处理本轮已有待办，完成一轮可分批的关系检查及页面内容复核，不循环重复处理同一轮任务。新增参数定义不再按每晚 10 页截断。计划任务保留每日 03:00 与禁止并发执行，取消测试期的两小时整轮截止；模型单次超时、上下文边界与失败回执仍有效。模型服务商的账户额度和限流不由本项目控制。

用户流程是“提问或投喂 → 记录问题、整理资料 → 形成待审变更 → 人工批准后供后续问答使用”。缺来源、真实硬件数据或冻结复测方案的任务仍按既有证据契约停在待补状态，不能通过取消额度伪造完成。普通 GitHub 排错仍按 F003 在线取证，不自动升级为正式知识。夜间某个模型阶段失败时记入 `last-run.json` 的 `failures` 并返回失败状态，后续独立阶段仍可继续。

**2026-10-21 启用验证：** 本机实际配置已设为 `production`，服务端状态返回金额、次数及四项夜间数量上限均为 `null`；Windows 任务 `LLM-Wiki-infra-view-new` 保留每日 03:00、禁止重入，执行时限已改为 `PT0S`。真实 Codex 连接检查返回 `{"ready":true}`，调用回执为 `accountingOnly: true`，历史账目保留。计划任务回执（历史归档 `../../tools/wiki-runtime/scheduled-task-production-20261021.json`）、服务状态（历史归档 `../../tools/wiki-runtime/production-status-20261021.json`）、模型检查（历史归档 `../../tools/wiki-runtime/production-smoke-20261020.json`）、页面实测截图（历史归档 `../../tools/wiki-runtime/wiki-production-20261021.png`）保存在本机运行目录。

本轮全量单元回归最初 1,246 项通过、1 项因旧测试日期超过 30 天而失败；将该用例改为当天的新页面后，该文件 3 项复跑通过。额外补齐正式模式 Claude 保存回答无需测试预算的路径，其相关 11 项测试通过。类型检查、Lint、依赖检查及最终构建通过；Lint 仍有既有 27 个警告、3 个提示，构建保留资源体积警告。问答与状态页的 12 项浏览器回归通过，实际页面显示“正式运行”和“无项目上限”。完整正式模式夜间维护尚未在启用后执行，下一次为 2026-10-21 03:00；这些验证不代替整晚运行结果，也不表示所有知识缺口已经补齐。

**10-08 整体复审修复：** 写作审计已识别引擎的规范修订尾注，正式 `verifyRevision` 继续验证历史真实性；普通附录、无效日期和缺失来源标题仍拒绝。实际全库审计恢复 104/104 达标，R4 独立复审关闭。MLP 内容纠错包已由用户批准，16:29 复核正式发布、待审 0；见 整体审查（历史归档 `../plans/wiki-overall-review-2026-10-08.md`）。

**10-08 完成：** AC1–AC9 的开发与约定验收完成，包括真实双轮维护、遗漏关系补齐、反向边和幂等、衰减入复核。正式夜间模型任务继续关闭；Sleep Mode 的硬件数据缺口继续保留，不能靠完成软件功能虚构关单。本轮四页纠错包已由用户批准，15:08 核对正式落盘、待审为 0。证据与边界（历史归档 `../plans/wiki-final-acceptance.md`）。

**10-07 收尾增量：** 已执行真实交叉审视、衰减抽检、外链检查与来源纠错审阅；衰减只排复核、不自动改文。外链 116 可达、25 本次未确认、0 确认死链；新来源 30 段 raw 独立逐字核对。夜间模型配额继续为 0，Sleep Mode 实测缺口不伪造关闭。完整记录与待审包（历史归档 `../plans/wiki-final-acceptance.md`）。

**10-07 AC3：** 真实多页/版本问答暴露的审阅截断、章节引用及 Windows 回执/换行问题已修正。六类真实样本逐类闭合，完整过程与失败留痕见 增量验收（历史归档 `../plans/wiki-qknorm-multiversion-acceptance.md`）；不将本组问答当作全库质量证明。

**10-06 缺口对账：** 历史记录核对（历史归档 `../plans/wiki-terms-gap-audit.md`）已修正关单后仍显示待处理的误报。状态页区分新观察和已关闭历史，原验收记录保留；Sleep Mode 缺少真实硬件数据仍待补证据。

**10-06 AC3 增量：** 独立回答质量评判已接入网页问答与发布前后复测，使用本轮固定的全局模型、新会话、只读证据与可追溯回执。错误/未判明进入既有缺口观察，明确不满足的回答不能直接保存；审批与人工复测验收保留。实施与验收（历史归档 `../plans/wiki-answer-quality-acceptance.md`）记录工程回归、5 个真实模型检查样本和真实 HTTP 链路。下方 9 月表格保留历史口径，“独立评判仍未做”已由此增量替代；跨版本、全库质量及其他 AC 不因此完成。

**Status**: completed（2026-10-08；功能及约定验收完成，不代表每个后续知识缺口已获证据）

**10-06 实施承接：** [F005 Drop 资料收录与知识整合](F005-wiki-drop.md) 已完成，承接的 AC1/AC2 产品化及真实资料闭环已通过，并复用 AC5/AC7/AC9。最终逐项状态与证据统一由 F005 维护；本文件原始 AC 与历史证据保留原文，其他知识闭环项目不因此标为完成。

当前验收状态以下方 10-08 对账为准；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；实际花费以 `pnpm wiki:budget status` 为准。10-05 对账（历史归档 `../plans/2026-10-05-p6-acceptance.md`）与逐轮 review 归档（历史归档 `../plans/archive/README.md`）只代表当时，不代表现状。

**Created**: 2026-09-11

## Why

用户 2026-09-10 提出的问题：

> 我们 LLM-wiki 整体是否符合越用越聪明？假设做出来之后问问题是 agent 怎么查？如果查不到怎么办？是否会有如果是 LLM-wiki 查不到，但是会自动去整合写 wiki 给人工审批是否需要加入 wiki，加入 wiki 的时候是否会交叉审视、建链等各种操作，死链是否会有定期审查？

> Multi-Agent 中是可以手动 drop 资料进来的，我们有吗？如果有逻辑是怎么样，如果没有，我需要。

截至 2026-09-14 的现状：**已有手动生产与重跑管线，尚无使用驱动的知识积累闭环**。问答只读不回写；仅增加问答次数不会改变正式知识库。逐条差距：

| 能力 | F001 现状 |
|---|---|
| 查不到怎么办 | 只会答「知识库里还没有这一条」，然后用自身知识回答并标「（未收录）」。**不记录、不回写** |
| 自动整合写 wiki 给人审 | F001 AC8 的「存进 wiki」与审阅面板尚未实现 |
| 交叉审视、建链 | 页面已使用单向 `relations`，`backlinks` 由 build 派生；整合与检索仍有旧 `related` 路径待统一，**无周期性全库审视** |
| 死链定期审查 | 有一半：lint 有 `broken-link` 规则，但只在 `pnpm check` 时跑，**无定期巡检** |
| 手动投喂资料 | **完全没有** |

规划 F001 时砍掉了 Multi-Agent 的租约 / CAS / cron 巡检，理由是「扇出 + 整合不需要锁」。它只覆盖单次 ingest 内的写入安排；闭环增加 HTTP、CLI 和每日任务后，仍需本地单写入者与中断恢复。当时把需求理解成「批量灌种 + 问答」，没把闭环当需求，本 feature 补上。

## What

用户能感知到的变化：

- 手里有一份资料（论文、内部文档、聊天记录、报错日志），投进去就能变成待审草稿，不用手写。
- 问了知识库答不上来的问题，这个缺口会被记下来；攒够了自动去写，写完等你审。
- 每天自动查死链、孤页、过期页，问题落到一份 warnings 文件，不用你去翻。
- 页面上能看出这一页是 agent 读源码写的、还是别人投喂来的——两者可信度不同。

## Acceptance Criteria

### 2026-10-08 验收对账

真实模型验收使用完整隔离库；正式库继续执行用户已定的人工审批和夜间模型配额 0。证据见 最终验收记录（历史归档 `../plans/wiki-final-acceptance.md`），投喂细节由 [F005](F005-wiki-drop.md) 单一维护。

| AC | 已取得的验收证据 |
| --- | --- |
| 1 | F005 网页／CLI 收录、原始快照、真实资料多页整合、审批及新会话复用通过。 |
| 2 | 正常系列、同源更新、拆分注入隔离与提示清洗回归通过；隔离规则不宣称能识别所有恶意材料。 |
| 3 | 独立回答评判接回缺口和前后测；真实 HTTP、五例初验及六类多版本问答通过，历史关单去重已核。Sleep Mode 仍缺硬件实测，保留缺口是正确行为。 |
| 4 | 巡检与调度、死链和受跟踪来源变动回归通过；实际 141 个外链中 116 可达、25 unknown、0 确认死链，不把未知当有效。 |
| 5 | origin 与阅读角标回归通过；历史直写页保留真实 direct 来源，不伪造 ingest 回执。 |
| 6 | 两次真实 syncWiki 推进 119 批中的第 1、2 批；另用遗漏边正例真实补出 prefix-caching→kv-cache，双端逐字证据有效，默认隔离批准后反向边正确，重跑不重复。 |
| 7 | 多版本配置纠错及本轮四页修订使用 revisePage 留旧结论；最终纠错包独立源码审查、默认隔离批准和重复批准通过，随后由用户批准正式发布，实际文件已核对。 |
| 8 | 真实重提取 expert-parallel 差异分数约 0.539，进入复核；第二轮复用相同证据及任务不重复入队。大材料完整保留回归通过；文本差异不等于事实过期。 |
| 9 | 跨页重复 lint 及红绿测试通过；正式库与 389 页参数隔离库均无 lint 错误。 |

### 当前对账与历史证据

当前结论见 2026-10-05 P6 验收与功能对账（历史归档 `../plans/2026-10-05-p6-acceptance.md`）。下表保留 2026-09-24 的历史记录；原始 AC 条文继续作为需求基线，未复测项目不自动升级为通过。

### 历史验收状态（2026-09-24）

**2026-09-22 补记（AC4 的内容维护）**：main 来源已重钉到 `baa023ad`，同步更新正文、图与参数生成区后，只读 `pnpm wiki:stale --seeds wiki/seeds/vllm-ascend-code.yaml` 报「引用的上游代码都没变」。下表 09-21 的来源变动是历史观测；这次归零不改变 AC4 的「部分实现」结论，也不代表补测了站外 URL 或付费维护链路。

这张表记录 2026-09-24 的历史验收状态，不代表当前全量复测结果。「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；缺口数、预算这类会变的数字现查，或看阅读页右侧「状态」页签。分级取 2026-09-19 审视（历史归档 `../plans/wiki-audit-2026-09-19.md`） §3 的口径：真实实现并测试 / 只用固定输出验证 / 部分实现 / 未执行 / 与 AC 文本不符。

| AC | 当前结论 | 证据与未满足条件 |
|---|---|---|
| AC1 | 只用固定输出验证 | 文本归档、清洗、目录边界、幂等、`--why`、草稿后自动跨页整合与统一 reviewId 都有固定输出测试；注入片段不进 prompt 有断言。**真实投喂未用真实模型复测**，本轮未改动、未重跑。阅读页面板上仍没有 drop 入口，只有命令行（审视状态 §4）。 |
| AC2 | 只用固定输出验证 | 七日关键词链、互相引用、同来源高重叠、普通分章例外各有用例；隔离原文与 warnings 落盘，全程不启动模型。本轮未改动、未重跑。 |
| AC3 | 与 AC 文本不符 + 部分实现（但补写闭环已有两条真实走完） | AC 要的是「检索完由一个有预算上限的评判 agent 判 `satisfied`」；实际是**回答模型在自己回答末尾自报** `<!-- wiki-coverage: {...} -->`（`server/coverage.ts:5` 的 `COVERAGE_REPORT_INSTRUCTION`，同文件 `:9` 的注释自己写明「这些是观察，不是 AC3 要的预算内判定」）。**独立评判仍未做，仍挂在「等用户拍板」**（审视状态 §6）——这半边 09-24 没变。**「攒够了自动去写」那半边 09-23 已经不是纸上的了**：两条真实缺口走完了全程——smooth_factor 复测通过并关闭（任务 `53a289cd`，第一条走完闭环的缺口）；HCCL 缓冲区从 3 次真实提问 → 诊断 → 复测 → 补写 → 待审包 `700c047d` → 批准发布（`wiki/concepts/gap-a5164fe10fa9184412f8.md`，origin: gap）→ 后测 4 题用户判「通过」→ 任务 `b55b91f0` 关闭（关闭计数 5，含缺口认题合并进来的 2 次）。沿途修的七处见 09-23 增量审视（历史归档 `../plans/wiki-audit-2026-09-23.md`） §八。09-23 缺口认题也改了：自含问题不带会话上下文、说法不同走一次判定记别名、判错可 `split-gap` 拆回（HANDOFF §4.5）。2026-09-24 现查 `wiki/_gaps.json`：2 条缺口都已闭环关单，队列没有待处理的缺口任务。 |
| AC4 | 部分实现（生产连跑成功，死链一项已补齐） | patrol 复用 `lintPages` 纯函数，死链与「年龄 + 来源变动」两类红绿用例都有。**2026-09-21 03:00 的定时任务再次实跑成功**：`wiki/_jobs/sync/last-run.json` 为 `status: "succeeded"`、`deferred: 0`、`findings: 0`（`startedAt` 2026-09-20T19:00:02Z = 北京时间 09-21 03:00）。**原先「按日报告没被当作验收项核对」这条已补**：`wiki/warnings/patrol-2026-09-20.md`（09-21 03:02 落盘）本轮打开核对过，内容是「未发现结构或受跟踪来源变化问题」，与 `findings: 0` 对得上，同目录还有 09-16 起每天一份。**09-21 新增站外死链**：`pnpm wiki:urls` 真发 HTTP，404 / 410 才判死链，403 / 5xx / 超时只列「这次没验证到」（否则夜里断一次网就是几十条假警报），共享配置 `checkUrls: true` 已让每晚巡检自动跑，死链以规则名 `dead-url` 写进同一份 `patrol-<日期>.md`（`scripts/wiki/urls.ts:105`、接进 `scripts/wiki/sync.ts:168-171`，提交 `a64bce1`）；首跑 95 条里 1 条死链（官方文档站把 `patch.html` 挪到 `Design_Documents/`）已修。2026-09-21 本轮实跑 `pnpm wiki:urls`：站外链接 96 条，可达 90，**死链 0**，这次没验证到 6 条（全是 huggingface.co 的客户端 `TypeError`）。同类检查的手工入口 `pnpm wiki:stale --seeds wiki/seeds/vllm-ascend-code.yaml` 2026-09-21 可跑通，报出一批 `b255ab59 → c173a64a4` 的来源变动——**这是预期内的**，库里钉的是 09-19 的快照（09-22 已重钉 `baa023ad` 归零，见表头补记）。**最近一晚（09-24 03:00，`startedAt` 2026-09-23T19:00Z）实跑 `status: "findings"`、16 条**：全是 `mark-flood` 软警告（13 个教学页内联标记超 30 处——其中一部分是 09-24 条件修正加角标加出来的——另有 2 个参数页、1 个问答记录页 91% 是 [I]），没有死链、没有结构问题；巡检把它如实报出来，属预期行为不是故障。 |
| AC5 | 真实实现并测试 | `origin` 是带默认值的可选字段（`src/content/wiki/schema.ts:127`），现有正式页不改一字仍通过 `pnpm wiki:lint`；来源角标与视觉区分经浏览器实测。**09-23 起 `origin` 开始携带真信息**：闭环发布的三页各标各的来路——`pr-11953.md` 是 `pr`、问答记录页是 `chat`、HCCL 缺口页是 `gap`（2026-09-24 现查 frontmatter）。**未满足的还剩存量**：其余 100 来页一律 `seed`，而 09-20 之后直写的那批并不是 ingest 产物——这笔来路欠账见表后「欠账」一段。 |
| AC6 | 只用固定输出验证；**从未在生产跑过** | 分批覆盖、双端逐字引文、补边 diff、批准后反向边由 build 派生、重跑不产生重复边，都有固定输出测试。但 `wiki/sync.config.json` 的 `reconcileBatches` 2026-09-21 仍是 0，而 `scripts/wiki/sync.ts:47` 要求非 0 时必须有 `paid` 配置——交叉审视至今只存在于测试里。**这是用户定的暂缓，不是漏做**：09-21 的结论仍是「先不开，等页数再多一些」，要开必须用户点头（审视状态 §6）。 |
| AC7 | 部分实现（有一例真实纠错） | 「已废弃的说法」一节的留痕有回归。真实一例：显存预算与上游的错误对比经用户批准发布（`e6061568…`），旧结论、日期与来源都保留；同期 Prefix Caching 的过度纠错已撤回。**一例不能推广成「模型的纠错判断都准」**。本轮未新增实例：09-20 / 09-21 对旧页的更正（默认调度器类被 patch 换掉、那条请求默认走异步调度、`kv-cache-quantization` 的 `--quantization ascend` 可不写，`551a0b7`、`d18d319`）与 09-24 的 24 页条件修正（`20aaffa`）都是人核源码后直接改——前者是纠错、后者多数是补条件不是否定旧结论，版本上翻转的那处（`get_device_total_memory` main 改守卫式）按「版本差异 + `[!]`」写，都不属于 AC7 的留痕场景。 |
| AC8 | 只用固定输出验证；**从未在生产跑过** | 固定提取结果的 jaccard 比较、规范化相同为 0、超阈值入重写队列都有用例。`wiki/sync.config.json` 的 `driftSample` 2026-09-21 仍是 0，真实 agent 重跑的波动未测过。同 AC6，是用户定的暂缓。 |
| AC9 | 真实实现并测试 | `cross-page-overlap` 规则在 `scripts/wiki/lint.ts:552`，模板标题按 `:98` 的 `BOILERPLATE_HEADINGS` 清单跳过；红绿用例齐全，`pnpm wiki:lint` 2026-09-21 在全库 90 页上通过（`ok wiki:lint 通过`）。 |


**一笔明确的欠账（2026-09-21）：「agent 写、人只审」这条流程目前是暂时绕开的。** 本 feature 的全部入口（drop / gap / chat / pr）都设计成「产草稿 → 人在面板上审 → 批准后整合」，Design Decisions 里也写死了「投喂产物一律进草稿区」。但 09-20 到 09-21 新写与重写的页**全部**是 Opus 子代理直接写进 `wiki/concepts/`、`wiki/params/`，主会话对着钉住的源码每页抽查 2–4 条事实后提交——不走待审、没有 `wiki/raw/` 摘录、`wiki/log.md` 里没有对应的 ingest / review 记录，`origin` 一律是默认的 `seed`（见 AC5）。用户 09-20 同意了这个做法（「你写好直接更新知识库就行了」），09-21 看到审视状态初稿后更正：「**这里我的意思只是暂时这样，要做**」。

所以这是欠账不是终态，要还的有两笔：①补这批直接发布的页的来路（补 raw 与 log，或给它们一个如实的 `origin`，需要的话扩 `PAGE_ORIGINS`，`src/content/wiki/schema.ts:28`——先改 HANDBOOK 再改 schema）；②把 `wiki:ingest` → `_drafts/` → `wiki:review` 真跑通一遍。**第二笔不等于打开 `maxTasks`**（09-21 这里写成「同一件事、一开欠账一并还上」，不成立）：开 `maxTasks` 只让夜间任务处理队列里已有的任务（缺口、PR、重写，以及审阅被驳回要重编的），不会替新内容跑 `wiki:ingest`；队列眼下是空的，开了当晚也是空转（2026-09-23 审视核实）。要还「agent 写、人只审」这笔账，新写的页得改走 `wiki:ingest` / `wiki:drop` / `wiki:stage` → `_drafts/` → 审阅面板——这是写作流程的改变，不是一个开关。**还账时点用户 09-21 已定：这个阶段做完、大规模导入之前**（开的时候必须同时配 `paid`，否则 `scripts/wiki/sync.ts:47` 直接报错——这是防夜里偷偷花钱的保险，不要绕过）。明细见 wiki-audit-status-2026-09-21（历史归档 `../plans/wiki-audit-status-2026-09-21.md`） §3。在那之前照旧用现在的人工闸。

**闭环效果判准**：先用一条有证据的聊天答案跑通保存、跨页审阅、批准和新会话复用，再接入投喂与自动缺口补写。前后验证使用相同模型配置、工具权限和固定来源范围；除原问题外，必须有未用于编译的等价改写问题，并保留版本不同与无证据的反例。只增加页面、命中链接或复述上一轮聊天不算通过；需核对答案是否正确、引用是否支持结论、版本边界是否保留。具体样本和操作步骤由 plan 的 T6 承接，全部 AC 完成前仍保持 feature 未完成。

- **AC1 · 手动投喂**：`pnpm wiki:drop <文件或目录> --why "<为什么值得收>"` 把资料变成待审草稿。链路：读取 → 共用清洗与输入准备器 → agent 按「页面格式」切片加一句投喂专用的附加约束编译成草稿 → 落 `wiki/_drafts/`（**2026-09-20 更正**：HANDBOOK 只有六个 H2——页面格式 / 提取 / 整合 / 查询 / Lint / 人类须知，**没有「投喂」切片**；投喂的规则实际在 `scripts/wiki/drop.ts:131-133`，它取 `pageFormat` 切片再追加「仅本地材料不能升为源码实证 C」），原文按 HANDBOOK「链接与来源」存为不可变快照；保留原始标识、采集时间与投喂理由。验收：投一份真实 markdown，草稿生成且 `sources` 指向存下来的原文；构造一份含提示注入的文件，注入片段不出现在 agent 的 prompt 里（断言 prompt 文本）。
- **AC2 · 投喂隔离区**：连续投喂做交叉关联检测——7 天窗口内比对历史投喂，命中「关键词链」或「互相引用」或「同来源高相似」的判为 `chained_suspect`，草稿进 `wiki/_drafts/_quarantine/` 而不是正常待审区，并在 warnings 里告警。验收：用 Multi-Agent 的 `series-vs-chained` 样例形态构造两组输入，续传的判为同系列放行、拆分注入的判为隔离。
- **AC3 · 知识缺口捕捉**：问答走 F001 AC10 的 `retrieve()`；**「够不够」由 LLM 判定而不是阈值**——检索完让 agent 回答 `satisfied: true/false` 加理由（借 Multi-Agent 的 critique agent，`adaptive-recall/critique-agent.ts`），判不够就把问题、时间、检索到的候选、判定理由写进 `wiki/_gaps.json`。**问答 agent 联网查了官方文档也算一次缺口信号**，直接记录，但访问可能是查新或验证，不能单凭访问就断言库内没有知识。判定要有预算上限（最多 N 次调用），触顶记录「尚未判明」而不再追问。同一缺口累计到阈值（默认 3 次）自动排进处理队列；预算内先区分知识缺失、已有页漏检、版本过期与判定失败。知识缺失走补写，已有页漏检优先修检索或建链，版本过期更新原页，判定失败不得自动当成新知识生成。验收：连问三次知识库没有的词，`_gaps.json` 计数到 3 并只排一项；跑一次补写产出草稿；已有页漏检的对照不产生重复新页。
- **AC4 · 定期巡检**：`pnpm wiki:patrol` 复用 `lintPages` 的纯函数，检查死链、孤页，以及 `updated` 超过 N 天且引用的**源码或文档**相对于对应受跟踪 ref 的新 tip 已变动的页。引用里的 commit 不会自行变化；报告必须列出旧 commit、新 tip 和变动路径。文件变动只表示待复核，不直接断言结论错误；两类来源都要查。结果写 `wiki/warnings/patrol-<日期>.md`，有问题非零退出。挂进 F002 的每日调度。验收：人为造一条死链与一页满足年龄和来源变动条件的页，巡检报出两项并指名文件；只有年龄增长、来源没变的页不报过期。
- **AC5 · 页面来源标记**：frontmatter 增加可选 `origin` 字段（`seed` / `drop` / `chat` / `pr` / `gap`，默认 `seed`），阅读页显示来源角标，投喂来源的页有视觉区分。`origin` 表示生产入口，不能替代事实的证据等级。验收：现有正式页不改一字仍通过 lint（默认值生效）；投喂产出的页 `origin: drop` 且页面上可见。
- **AC6 · 周期性交叉审视**：`pnpm wiki:reconcile` 定期生成判重、补关系、标矛盾的待审变更，范围是全库而不只当批草稿。复用现有 `relations` 类型，只存声明方向，反向 `backlinks` 由 build 派生，不恢复双写 `related`。为控制上下文，只读 `index.md` 摘要 + 按 chapter、检索和关系选取相关页，分批覆盖全库。验收：构造证据支持但遗漏的一条关系，reconcile 提出含类型、方向与理由的补边 diff；批准后两端分别显示声明边和派生反向边，lint 通过；再跑不产生重复边。

- **AC7 · 结论被推翻要留痕**：页面正文被改写时，若新结论与旧结论矛盾（不是补充而是否定），旧结论不能被静默覆盖——在页面里保留一节「已废弃的说法」，记原文、废弃日期、依据（哪个 commit / PR 让它不成立）。借 Multi-Agent 决策账本的 tombstone / `superseded_by` 协议（`viewfinder/decision-ledger.ts`），但落到 markdown 而不是 SQL。验收：构造一页说「X 默认开启」，用新事实「X 已被移除」重写，改后页面同时能看到新结论与被废弃的旧结论。
- **AC8 · 页面衰减检测**：`pnpm wiki:drift [--sample N]` 定期对抽样页面重跑一次提取，把新产出与现有页做 token 集合的 jaccard 对比，`drift = 1 - jaccard`；超过阈值（默认 0.3）记为「内容差异待复核」，写进 warnings 并排进重写队列，不据此自动认定事实过期。借 Multi-Agent 的 `viewfinder/monthly-snapshot.ts`。验收：用固定提取结果和含不同内容词的样本，删掉半篇后分数超阈值并进队列；相同规范化内容分数为 0。真实 agent 重跑的波动另行记录，不能声称未改动页必定接近 0。
- **AC9 · 跨页内容重复 lint**：新增 lint 规则 `cross-page-overlap`——两页的 H2 标题与首段出现显式重叠（排除公共模板标题），**且彼此没有 `relations` 或正文链接**时报红；有交叉引用则放行。借 Multi-Agent 的 `cross-file-dedupe-lint.ts` 协议（重叠 + 有 cross-ref = 合规，重叠 + 无 cross-ref = 违规）。验收：造两页讲同一件事且互不引用，lint 报红并指名两个文件；给其中一页加上语义适当的 `relations` 后转绿。

**Out of scope**：向量检索（F001 已定按实测命中率决定，且只考虑 issue 语料）；自动晋升（草稿一律人审，不做自动合入）；投喂二进制与图片（先只收文本类）；多用户与权限（单机单人）。

**有意不整套搬的 Multi-Agent 机制**：SQL `wiki_events` 与通用 `startup-reconciler`、多用户 ACL 与分布式租约 / 围栏令牌、SQLite FTS5 与嵌入召回、跨 agent 的 handoff 中性改写。本项目仍需最小的本地工作状态、排他写入和批准变更的恢复 manifest；git 历史保留知识版本，不能替代未完成任务和多文件写入的恢复。

## Dependencies

- **F001 AC10（阻塞 AC3）**：可替换的 `retrieve()` 接口。若 AC7 把 grep 内联进聊天层，AC3 要重写聊天层——见 F001 的风险登记。
- **F001 AC8（共同交付）**：本 feature 的最小闭环实现聊天保存与草稿批准 / 驳回；F003 AC6 接入同一管线。sanitize 参考 `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\sanitize\` 的纯函数和测试，核对适用部分后引入，全项目共用一份。
- **F002 Task 21/22（共享）**：`wiki:sync` 的调度器与 Windows 计划任务，AC4 的巡检搭同一班车。
- **`runBatch` 重构（阻塞 AC1、AC3）**：见 Design Decisions 第一条。**[F002](F002-param-lineage.md) AC2/AC5 同样需要它**，若 F002 先做则本 feature 直接受益，无需重复。
- **[F002](F002-param-lineage.md) 的生成区约定（约束 AC6）**：骨架页与生成区尚待 F002 AC4 落地；届时 reconcile 与整合必须保护该区，标记格式和渲染器只由 F002 定义。此前也必须保持现有脚本生成的版本节，不能假定生成区已经存在。

## Design Decisions

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| 驱动器与 seeds 解耦 | 各写各的池 / 抽出 `runBatch` | **抽出共用请求执行器**，seed / drop / chat / gap / pr 只负责构造请求 | 保留并发限制、超时、路径约束和失败记录；先补成功清单与失败隔离的回归用例，不按「十行重构」估算 |
| 链式注入检测的相似度 | 引入 embedding / 不用向量 | **不用向量**：关键词链 + 互相引用 + 来源指纹三路 | F001 已决定不引入嵌入与向量库；Multi-Agent 的 `keyword-chain.ts` 与 `reference-link.ts` 本来就不依赖向量，够用。真不够再议 |
| 缺口触发阈值 | 一次就写 / 累计 N 次 | **累计 3 次（可配）** | 一次就写会被随口一问触发，浪费额度；累计能筛出真实反复出现的缺口 |
| 投喂产物去向 | 直接进正式区 / 进草稿区 | **一律进草稿区，人审后才晋升** | 所有入口共用同一审阅流程；不因输入来源不同绕过审阅 |
| `origin` 字段 | 必填 / 可选带默认 | **可选，默认 `seed`** | 现有页无需回改；schema 默认值须由 lint、build、registry 与读者侧测试验证 |
| 巡检的「过期」定义 | 只看日期 / 日期 + 源码与文档双查 | **日期 + 来源路径变动，报告待复核** | 文件 diff 不能直接证明行为或结论变化；记录版本差异，再由证据复核语义 |
| 文档占位符的巡检 | 不管 / 报红 | **报红** | 页面正文出现 `{{ }}` 说明照抄了本地文档的占位符，学习者复制到的是跑不了的命令。lint 的 `unexpanded-placeholder` 规则在巡检里同样执行 |
| 周期性交叉审视的读取范围 | 读全量正文 / 读索引 + 相关页 | **索引 + 相关页** | 见 F001 风险登记「整合读全量页会撞上下文」。本 feature 的 AC6 直接按新策略写，不重蹈 |
| reconcile 与生成区 | 全文改写 / 保护脚本产物 | **保护现有版本节；F002 AC4 落地后复用其生成区协议** | 版本表由脚本维护，agent 不能覆盖；生成区格式只定义一次 |
| 巡检失败的处置 | 自动修 / 只报告 | **只报告，不自动改页面** | AC6 生成待审变更；批准后复用统一整合入口 |

各轮的历史实施证据在 逐轮 review 归档（历史归档 `../plans/archive/README.md`），只作历史保留；当前状态一律以上方验收表为准，花费以 `pnpm wiki:budget status` 为准。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-11 | 用户指出 F001 不满足「越用越聪明」，并明确要手动投喂能力。核对 Multi-Agent 的 `multi-drop`、`llm-compile`、`sanitize`、`promote-audit` 后立此 feature；同时评估出对 F001–F003 的改动为「小」，唯一机械重构是 `runBatch` |
| 2026-09-14 | 补实施计划；按现有代码校正关系模型、生成区状态及差异检测语义；把新会话复问作为最小闭环验收，撤回对共享执行器改动量的过早判断。全部 AC 仍待实施与验证 |
| 2026-09-23 | 用户追问「越用越聪明」是否做到，复审发现闭环真跑会断：问答命令行超 Windows 上限起不来、整合 60 秒超时、交叉审视每批超输入上限、过期巡检只认一份钉点表、驳回的任务永远卡住，且没有一条缺口真正走完闭环。第一步零花费修复已完成；为批量导入把六处每次都带全库目录的调用改成按需取子集（最多 30 页）。细节与剩余步骤见 wiki-audit-2026-09-23（历史归档 `../plans/wiki-audit-2026-09-23.md`） §七 |
| 2026-09-23 | 第二步付费验证在正式库上真跑：smooth_factor 缺口复测通过并关闭（第一条走完闭环）；问答记录、PR 11953 发布；新缺口 HCCL 缓冲区从三次真实提问走到待审包。沿途修七处、留三张 chip，见同页 §八 |

## Links

- Plan: knowledge-loop-plan.md（历史归档 `../plans/knowledge-loop-plan.md`）
- 依赖: [F001](F001-llm-wiki.md) AC8、AC10；[F002](F002-param-lineage.md) 调度器
- 参照实现: `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\` 的 `multi-drop/`、`llm-compile/`、`sanitize/`、`promote-audit/`

## Evolution

- **Evolved from**: [F001](F001-llm-wiki.md)（把一次性生产扩成闭环）
- **Blocks**: 无
- **Related**: [F003](F003-github-corpus.md)（issue 语料同样是不可信输入，共用 sanitize）
> **2026-10-24 04:36 实跑追踪：未完成整轮验收。** binding已04:22:53检查点结束；04:34:42启动context恢复（wrapper64816/node21372），仅原177任务/142页，勿并发另一轮。启动前44待审、20因正式版本变化关闭、113失败，关闭和跳过分列。跨段重复根因为后续调用缺少此前已接受修改：现按输入预算携带、超限复用可恢复材料提取；上下文仅防重复，不代替证据，最终完整修改不截断。先红2、相关33、完整166文件1336项及类型/构建/Lint通过，实际模型修复效果待本轮回执；证据 section-context-root-cause-20261024.json。
>
> 六份来源/教学纠错已独立读源复审并生成替代待审：KV、balance、DP、Dyntra、EPLB、CPU offload；旧问题与中间包通过rejectReview留史，payload原样、正式正文未改。后组三份88/88 raw摘录与固定源码逐字匹配。DP最终75b80f9c…已实测浏览器正文差异和待审状态，截图dp-corrected-pending-ui-20261024.png。严格审计51有效新正文/50问题与替代历史/0结构及基线错误，不是全库语义保证；另六份新增正文正在独立审查。当前恢复、失败材料及后续以current-nightly-verification和original177-context-live为准。新草稿保持pending，旧69发布授权不扩大，每日03:00计划不改，整轮验收通过后才删除临时跟进。

> **2026-10-24 05:42 实跑：原失败队列继续，整轮未验收。** context-index 已05:39:08启动，wrapper37156/node60928实际CIM与维护锁已核；只原177/142页、同页串行并发3、新稿待审。context-memory 已05:34:51在检查点exit1结束，74项含跳过/2失败，旧进程已消失。启动前49待审/23版本变化关闭/105失败，关闭另列不当模型成功。新实时报告及原177状态以 `current-nightly-verification-20261023.json` 和 `check-context-recovery-state-20261024.ts --context-index` 为准。
>
> 确定性修改索引完整回归166文件1341项、相关38项、类型/构建/Lint与独立代码审查通过；边界先红记录保留，`context-index-final-full-suite-exit` exit0。真实模型核验仍须 `audit-context-index-real-inputs-20261024.ts`，05:40尚无新索引输入，测试不代替实跑。四份手工修正版KVPP/LoRA/fineTP/pipeline已逐源复核、严格生成pending，旧问题包原payload留史，正式正文未改；三批retired回执及LoRA6b8eb534实际待审UI截图已保存。正文审计56有效/59历史/0结构及基线错误，但新Prefill34c5ab77独立发现4P2正在修订，不能称语义全部通过。npu首raw引文668字符和dynamic新上下文非逐字失败须按检查点真实恢复，原raw成功段及旧失败保留。其他来源、引用、历史、发布校验与每日计划不变；全部177实际验收前不删除临时跟进、不发布新稿。

