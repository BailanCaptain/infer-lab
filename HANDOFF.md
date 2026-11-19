> **2026-11-19 Stage 2 主站与全库审校收尾：** 全站已稳定在 Stage 2 基线（`vllm-ascend v0.30.0 c09d3e20` + `main 8d6180e2`，12 主题目录 / 184 篇正式页，含 `db0776d` 与 `2f788ac` 交付的 Edition-A 排版、双层教学图与 `#/tools` 四套工程工作台）。本轮同步收口 `src/sim/` 6 项引擎/规则缺陷、诊断规则中文体验、第 `01` 篇目录拆分、`biome.json` 2.5.12 升级与顶层文档对齐。全量状态与现查命令：`pnpm check`、`pnpm lint`、`pnpm wiki:lint`、`pnpm wiki:diagrams --check`、`pnpm wiki:audit`。下方 2026-11-02 及更早条目均为历史交接留档。

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

> **2026-10-24 06:01 当前：新预算根因已修，等待完整回归后续跑，整轮未验收。** context-index 已05:48:13检查点exit1，77项含跳过/3失败，37156/60928已实际CIM核无进程、lease inactive。原177为50待审/24因正式版本变化关闭/103失败，不把关闭当生成成功。新NPU raw已真实3/3恢复且复用2段，但正文在模型调用前出现“分段预算过小”：材料先占总预算1/3，未先计完整来源表、已有修改上下文，正文空间变负。现在先保留完整固定frame、上下文与反馈空间，再分配材料；不提高假定窗口、不删规则来源。真实复现+先红1，相关4文件40项、类型/构建/Lint及独立审查通过；独立真实NPU隔离fixture12段完整重建/缓存复用、转义和反馈通过。完整 section-frame-budget-full-suite 日志/exit仍须读最终结果，最新此前完整166文件1341项通过。新runner failed-worker-recovery-frame-budget-20261023.ps1已准备，未启动；不得和别的worker重叠。
>
> **已落地正文与剩余项：** KVPP、LoRA、fineTP、pipeline四修正版以及Prefill813be2f032已独立核源并strict stage pending，原问题包rejectReview留史且payload未改，正式正文未改。Prefill25raw逐段匹配固定源，新增source29实际读源，4P2已关闭；新标题/摘要与跨轮定义同步，仅待审。Prefill与LoRA均在已有IAB实读pending正文diff/来源/历史，prefill-corrected-pending-ui-20261024.json/png及body截图；未发问题保留。最新严格审计57有效正文/60问题或替代历史/0结构和正式基线错误。dynamic新fc1e4d58已恢复产出，但review_pending_corrections正在独立查源/教学重复，未算语义通过；28真实索引请求26非空，预算/已接受修改覆盖通过，尚无压缩样本，不保证无重复。另prepare-inputs-flow首raw引文617字、其余2段保存；reading-vllm-ascend的prior-edit引文丢JSON反斜杠而非逐字，准确回执context-index-material-failures-20261024.json，下一次按既有ID/选行策略恢复，旧失败保留。全部后续新稿pending、原69发布授权不扩大、每日03:00不改；完成后仍须原177逐项结局、正文独立核源/UI及基线，真正整轮通过才停临时跟进。

> **2026-10-24 05:23 历史：已请求检查点停止，整轮未验收。** context-memory wrapper39568/node22892仍须核exit/CIM，不能与它重叠stage或启动。05:20为73项含跳过、2失败，原177实际48待审/23版本变化关闭/105失败/1运行（prefill）；快照/lint合法。新增LoRA输入证实非空摘要漏掉上一段刚接受的缓存顺序，后段再次添加。现确定性priorChangeIndex保留每项修改范围/理由，预算不足只能有标识地保留至少64码点或完整短理由，否则停止留检查点；详情预算≥4096，未削弱引用或旧文校验。先红2；独立审查空索引P2另先红1再修；4文件38项、类型/构建/Lint通过，context-index-independent为0P1/P2。最终整套context-index-final-full-suite尚须读exit，初始整套运行中加入边界红灯的1失败回执保留。索引尚未实跑验收。新runner failed-worker-recovery-context-index-20261023.ps1已准备，必须等旧进程退出和验证完成。
>
> KVPP与LoRA手工候选已父独立复核、分别30/29段raw匹配固定源码，本地严格通过，仍未stage。空闲后用prepare/retire-teaching对应 --context-kvpp 与 --context-lora；新包pending，旧包rejectReview留史。LoRA只追加来源32补齐缓存未命中或load_inplace外层条件。fine-grained-tp新b13bca09含来源错配、重复及插断表格，review_pending_corrections在读源并准备候选，须父复核；新pipeline-parallel487e4838待读源，prefill看实时。dynamic原raw已3/3恢复且复用2段，现新失败是prior-edits摘要非逐字；npu-model-runner首raw引文超600且余2段保存。见context-memory-real-recovery、context-index-root-cause、current-nightly-verification及实时报告。全部新稿待审，后续重做正文审计/原177结局/来源与UI；不改每日03:00任务，只旧69授权发布，整轮真正通过才停临时跟进。

> **2026-10-24 05:00 历史：原177恢复继续，整轮仍未验收。** context-memory 于04:59:44启动，wrapper39568/node22892，实际CIM命令已核。读取 failed-worker-recovery-context-memory-20261023.json、process/exit/err 及 last-run；勿重复启动。旧context已04:48:33检查点exit1结束（69项含跳过、3失败），旧binding已04:22:53结束。新启动前原177为45待审、21因正式版本变化关闭、111失败；用 check-context-recovery-state-20261024.ts --context-memory 核实时结局，关闭/跳过不算模型成功。只原177/142页、同页串行并发3、daily-lease，新稿不发布。
>
> **新增根因与证据：** 分段曾漏传此前修改，现传预算受控 priorChanges；实际压缩又把“非新证据”误当无关材料，返回空 evidence，导致防重复上下文丢失。已增加专门 prior-changes 用途并在缓存前拒绝空结果，普通来源的无关空结果仍允许。先红后绿、完整166文件1338项、类型/构建/Lint通过；同一个真实失败输入已恢复出2049字节且逐字校验的事实与条件。见 context-empty-root-cause-20261024.json、context-memory-real-probe-20261024.json。摘要仍非完整原文，不据此保证全文无重复；旧失败全部保留，来源/600字符/历史校验未降。
>
> **正文与剩余工作：** KV/balance/DP、Dyntra/EPLB/CPU offload六份以及layers/collective/sparse-offload/lm-head/largeEP五份均独立逐源修正、严格stage为pending，旧包rejectReview留史且payload不变；最新 binding-final-corrections-retired-20261024.json。五份复核128段raw与固定源码一致；largeEP仅追加来源39补全FUSED_MC2谓词。04:59严格审计52有效新正文、55历史、0结构/正式基线错误。DP与layers修正版已有真实待审UI，layers-corrected-pending-ui-20261024.json/png；问答未发文字保留。新KVPP1c983已生成，但独立发现1P1/2P2（PCP先用后定义、重复、错误声称材料缺调度证据），正在准备手工候选，未解决前不算通过。见context-kvpp-independent-20261024.json；不要与运行worker抢维护锁stage。dynamic还剩1段选行越600，下一次已有界ID策略；fineTP引文跳过中间解释、LoRA插在旧行中间，准确回执context-live-failures-20261024.json，须核带反馈的真实恢复。全部结束仍须逐项结局、独立读源、pending/正式基线和UI验收。只旧69获准发布；每日03:00不改，整轮真正通过后才删除临时跟进。

> **2026-10-24 04:12 历史：binding继续，整轮未验收。** 原177项当时为39待审、18旧版本已变化关闭、117失败、3运行；本恢复59项含跳过、2失败。此后状态以顶部及current-nightly-verification实际回执为准。

> **03:57 追加实证：** binding 仍运行；原引文绑定失败已真实恢复并产出KV块分配待审正文b7c6524a…（section-binding-real-recovery-20261024.json）。balance/data-parallel长材料分别2/2、3/3完成，复用1/2个已成功段，所有选中原文逐字匹配且≤600（binding-material-real-recovery-20261024.json）。这不等于正文语义通过：KV新包又发现2项来源/重复P2，本地候选03:58已独立复审通过（binding-corrections-independent-20261024.json），等待维护空闲stage替代；balance新正文c16b99cd…待独立读源。动态分块PP的新raw首次2段失败（非此前JSON问题），看binding-live-failures-20261024.json，保留成功段，等本worker结束后按检查点自适应恢复。最新严格审计42有效待审正文/41历史/0结构和正式基线错误，仍不能声称整轮通过。

> **2026-10-24 03:48 当前：修复后继续原177项，整轮未验收。** binding 于03:47:14启动，wrapper49796/node63188，实际命令和父子关系已核；报告 failed-worker-recovery-binding-20261023.json，退出看 binding-exit，勿重复启动。source-notes 已于03:36:43检查点exit1，48项/3失败，旧25496/37224已结束。启动前原177为33待审、13因正式版本变化关闭、131失败；关闭/跳过不算模型成功。仍仅142页、同页串行并发3、daily-lease，不发布。
>
> **根因及实证：** vllm-kv-block-allocation 把不相邻内容拼成引文，被正确拦截，但旧通用错误没有给重试具体修正提示。现增加固定 allowlist 反馈并识别历史同类错误，不传模型错误自由文本、不放松逐字/唯一匹配。先红2再4文件39项、完整166文件1334项、类型/构建/相关Lint通过；section-binding-feedback-root-cause-20261024.json。balance-scheduling 与 data-parallel 首次超600引文的失败和成功分段保留，须在新恢复中核既有有界ID策略真实完成，不仅看测试。
>
> **正文验收：** 本次9份新稿独立审查发现1项P1/14项P2（首屏术语顺序、重复讲解、来源错位、返回条件），均已人工修订、独立复审并严格staging成pending；旧包驳回留史，payload不变，正式正文未改。两批回执 source-notes-corrections-retired-20261024.json / source-notes-later-corrections-retired-20261024.json。严格审计40份有效待审正文、41份问题/被替代历史、0结构和当前正式基线错误。稀疏注意力02e5b0cd…已在用户已有IAB普通刷新后实际打开正文diff，截图及记录 sparse-corrected-{pending,body}-ui-20261024；无新发布。新产出仍需逐页读源、独立审查和可用UI核验，测试与本次局部读稿不能代替整轮。只授权旧69份已发布；每日03:00定义保持原样。后续以current-nightly-verification-20261023.json为准，完成才删除临时跟进。

> **2026-10-24 03:05 当前：已继续原177项，整轮未验收。** source-notes 于03:03:27启动，wrapper25496/node37224实际命令已核对；读取 failed-worker-recovery-source-notes-20261023.json、process/exit/err，勿重复启动。仅原177任务/142页，同页串行并发3，维护锁，跳过已解决项，无发布。03:04报告29项/0失败包含跳过，不能当29次模型成功；启动前24待审、8因旧正式版本失效关闭、145失败。每日03:00自动触发的新扫描已在patrol阶段、尚无模型子进程时停止以免重跑；计划定义未改，下次仍10月25日03:00，证据scheduled-overlap-interrupted-20261024.json。
>
> **本次修复与实证：** 编译草稿行号曾被误标raw坐标，现明确_drafts正文身份；传入I级材料时，新增段落/页末出处不允许把raw编号标为C/S/M，缓存前拒绝并反馈。先红后绿，最新6文件73相关项、完整166文件1332项、类型/构建、3文件Lint通过。根因draft-coordinate-root-cause-20261024.json、raw-evidence-level-root-cause-20261024.json。25份教学/来源修正版及GLM重基经独立审查和严格staging生成pending，4页并行新增完整保留；原5份纠错历史也保留。严格正文审计31份有效待审、32份问题或被替代历史、0结构/当前正式基线失败。CANN修正版f490ad86…已在已有IAB标签实际读取正文diff，C23与待审状态可见，无发布，证据cann-corrected-pending-ui-20261024.json/png。以上不代替原177队列及新增正文的最终验收。
>
> **后续：** 以current-nightly-verification-20261023.json及source-notes实时回执为准。重复失败先核输入输出、复现根因，必要时用source-notes前缀.stop在检查点停下装载修复；不并发整轮、不改每日任务、不覆盖他人编辑、不放宽校验。全部新稿待审，旧69发布授权不扩大。整队列结束后重审pending/正式基线、独立读源和UI，再据实报告与删除临时跟进。

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

> **2026-10-23 23:31 当前：失败 worker 已恢复执行，尚未完成验收。** 23:26 完整快照 158 页与全库 lint 已通过（13 条非阻塞警告）。23:30 启动仅原 177 个失败任务的恢复，覆盖 142 页，同页串行、最多 3 组并发；复用既有 workOne/检查点并持有维护锁，避免与每日任务重叠。wrapper PID33728、node PID52284；真实进度看 tools/wiki-runtime/failed-worker-recovery-20261023.json 及退出回执。原整轮 178 条失败历史保留，7 份已生成正文仍待审；不得批准后续新草稿。临时跟进已同步更新。

> **2026-10-23 23:18 当前实跑结果：未通过整轮验收。** 原整轮于 23:14:48 结束，exitCode=1；跨页 127/127、来源复查 151/151 已处理。178 条失败中 172 条来自共享编辑期间的页面校验阻塞，另有 5 条正文输出校验失败及 1 条已有真实恢复回执的 JSON 失败。7 份新正文仍 pending，结构和正式基线检查通过，双机草稿已对照 raw/固定源码并实测页面。23:16 完整快照恢复合法，但全库 lint 尚有 3 处共享编辑问题；临时 heartbeat 已更新为待校验通过后从失败队列续跑。详见 F004 顶部和 tools/wiki-runtime/current-nightly-verification-20261023.json，勿把下方旧进程状态当作当前状态。

> **2026-10-23 22:38 临时跟进已启用：** 用户明确同意每 10 分钟跟进当前整轮，完成后停用。Codex heartbeat「知识库本轮夜间更新验收」已创建成功（ID：automation，ACTIVE）；原每日 03:00 任务保持原样。最近实跑为跨页 127/127、来源复查 112/151，整轮仍未验收完成；本轮后续新草稿继续待审。恢复与下一步以 tools/wiki-runtime/current-nightly-verification-20261023.json 为准。

> **2026-10-23 当前：** 用户已授权继续生产夜间更新，并明确要求批准当前一批变更。已通过页面批量发布锁定的 69 份 revision（4 份正文、65 份关系提案，合并为 37 页、48 条关系），逐页核对正式文件与批准内容一致；后来新增的 1 份仍 pending。读取差异实测 483ms；代理请求从 7949ms 降到 652ms，Vite 已排除运行记录与仓库镜像监听。模型失败根因是计划任务误用旧 npm Codex；机器本地配置已固定经过真实请求验证的桌面 CLI。21:15:43 已恢复完整夜间更新，尚未完成整轮验收。当前证据与下一步统一见 [F004](docs/features/F004-knowledge-loop.md)。下方 10 月 21 日外发授权和浏览器阻塞均为已解除的历史记录。

> **2026-10-21 05:01 夜间长材料任务：未完成整轮验收。** 200K 只是用户举例，窗口已做可配置预算。现有页统一精确片段修改，失败分段、缓存重新校验和重试保留历史，正文引用与保留检查在缓存前执行。完整回归 164 文件/1,291 项通过；随后状态接口 9 项通过；最终构建、依赖、内容检查通过。双机正文实际恢复为待审包 b85085d143e33e923805383ca8f1da4cfab22bbe98566611478d8430515271e0，已对照 raw 与固定 Git 源码；另核对 HCCL、attention-cost，正式页均未改。3 份裸编号引用旧包已校验驳回，未发布；68 份待审包结构与正式基线通过。详见 docs/features/F004-knowledge-loop.md 顶部及 tools/wiki-runtime/recovered-bodies-independent-verification-20261021.json。
>
> **阻塞与下一步：** 完整生产重跑两次被自动审批拒绝：虽核实为现有 OpenAI/Codex ChatGPT 连接、gpt-6.1-sol，审批仍要求用户明确授权发送 Wiki/源码归档至该外部服务。已发异步授权问题，尚无回答；不要换命令绕过。获明确授权后运行 tools/wiki-runtime/recovery-nightly-20261021.ps1，再用 audit-nightly-progress.ts --recovery 核对整轮完成情况。最新完整运行于 04:44 中断，当前没有整轮进程；本地 API 已实测返回 interrupted、production、limitUsd/maxCalls=null。服务 API PID 2876，Vite PID 24796。浏览器仍为连接错误页且自动导航有 URL 安全拒绝，等待用户手动打开；不要用别的浏览器自动化绕过。新正文 UI 尚未复验。未提交 Git，保留其他任务的无关改动。

> **2026-10-15 用户纠正后续方向（最高优先级）。** 用户：“不是，我想的是，我们有了母版，去改进当前的知识库就行了。” 后续以当前知识页为工作单位，利用已有模型／硬件母版改进正文讲解、配图与阅读排布。知识库承载完整主章节，母版作为按需复用的讲解材料。不要把下方“先串跨页学习路径”的助手建议继续当成已确认目标。本次只校正并记录工作方向，尚未改写知识正文；实际改页前仍须遵守 docs/wiki-writing-standard.md，并保留已核实信息及原始证据。
>
> **2026-10-15 四个入口之间的切换优化（当前）。** 用户明确最卡的是首页／主章节／模型／硬件之间切换。本轮把首页和知识库从阻塞导航的 route.lazy 改成目标页内部的 React.lazy + Suspense，先切换页头和加载状态，卸载离开的 3D；不把所有 3D 常驻后台。首页阅读按钮悬停或聚焦时暂停城市绘制，移开／失焦恢复既有环绕状态，拖动暂停和 reduced-motion 仍有效。硬件按需加载机柜及当前平台（默认约 11.96 MB，对比原 21.85 MB），同页切换复用已载入平台，失败可重试；柜门改为 650ms 时间动画，解决低帧率下按帧插值持续数秒的问题。画质、几何、紧凑控件与知识正文未更改。
>
> **证据：** tools/wiki-runtime/knowledge-main-rebuild/ 内 navigation-red.log 复现旧路由等下载、hardware-loading-red.log 复现额外平台下载、navigation-hover-red.log 复现按钮交互期间持续绘制；最终 navigation-verified.log 的 15 项浏览器测试全部通过，覆盖加载阻塞、四入口往返、平台重试、首页环绕／释放、硬件交互、桌面手机布局。navigation-final-unit.log 为 3 项生成文件校验通过；navigation-final-lint.log 的 7 文件通过；navigation-final-build.log 的类型检查及构建通过；源和 dist 的 viewer SHA256 一致。截图 navigation-hardware.png、navigation-home.png。IAB 刷新后实际操作首页→开始阅读→模型→硬件→主章节→硬件，最终硬件预览留在既有标签。
>
> **限制与未实施项：** 模型初次初始化期间 IAB 曾发生一次 3 秒点击工具超时；待模型载入后同入口再点成功。不能声称所有冷启动卡顿已消除。软件渲染测试的硬件完整就绪约 2.1–2.4 秒，首页首跳仍有等待；不能把导航地址改变时间等同于 3D 完整显示时间，也不能用软件渲染帧率推断实体设备表现。硬件批处理、降低画质、首页异步 shader 准备均只做诊断，没有采用；实验保存在证据目录，不在发布代码或正式测试中。下一步产品建议仍是以 wiki/one-request 为样板串联正文、对应模型步骤、相关硬件与返回原段落，尚未实施。没有提交 Git，未覆盖既有无关变更。无待用户授权事项。
>
> **2026-10-15 目录层级与紧凑探索控件（当前）。** 用户指出左侧标题不明显，并否定此前模型视图的大卡片，要求硬件控件与 3D 放在同一页面区域。本条取代下方 72／76px 大按钮方案：模型四视图改成 36px 高、图标文字同排的紧凑切换组，桌面与标题同排，手机一行四项；硬件去掉编号卡片，层级切换沿画布上沿、视角操作沿下沿，使用同一背景形成连续 3D 展示区，说明留在右侧，手机纵向排列。
>
> **左侧目录：** 主题使用 44px 起的标题行、编号和浅色分组底色；主题 14px、分组 12px 加重、文章 13px 深色，文章列表用缩进和细线显示归属，当前文章有绿色背景及左侧标记。保持 240px 目录宽度、完整标题、独立滚动及原搜索功能，未减少正文宽度。
>
> **验证与补充修复：** `compact-browser.log` 12 项通过，覆盖目录搜索／滚动、模型四视图、硬件柜门／俯视／环绕／展开、旧章节入口与手机布局。IAB 实际操作目录、手机模型切换、390px 硬件展开和桌面俯视。实看发现旧单层模型标题在手机上挤成竖排，根因是桌面 `max-width: calc(100% - 600px)`；在共享 `reader-theme.css` 内仅对窄屏直接模型视图改为正常文档流标题与工具栏。`compact-title-red.log` 复现标题宽度仅 20px，`compact-title-green.log` 最终 3 项通过（新增标题检查与两项相关回归），截图核对正常换行及画布显示。相关 Lint、最终类型检查及构建均通过，日志为 `compact-lint.log`、`compact-hardware-lint.log`、`compact-title-lint.log`、`compact-final-build.log`。
>
> **交付与边界：** 4174 预览保持运行，最后打开硬件页。证据位于 `tools/wiki-runtime/knowledge-main-rebuild/`，包括 `compact-directory-desktop.png`、`compact-model-desktop.png`、`compact-hardware-desktop.png`、`compact-hardware-expanded.png` 与各移动截图；修改前副本为 `compact-before/`。本轮没有修改知识正文或模型几何，没有新增依赖。更紧凑的按钮减少占用；手机硬件说明仍需纵向滚动。没有待用户决定的阻塞问题，视觉效果待查看。
>
> **2026-10-15 全站导航与模型视图入口（历史，模型大卡片已被用户否定）。** 用户指出全站四入口和模型四视图不明显。全站导航改为带图标的紧凑按钮组，活动页深绿色，桌面点击高度至少 44px；模型四视图在标题下方居中排列，图标加文字，72px 高，活动视图同样深绿色。复用现有 Lucide 图标、阅读配色和路由，未增加依赖。手机品牌与导航分两行，导航保留图标和完整文字。
>
> **适配与证据：** 统一 `--reader-header-height` 为桌面 80px、760px 以下 128px，目录、正文锚点、本页目录和问答侧栏跟随同一高度。`navigation-browser.log` 20 项通过，覆盖四视图、344／359／390px 导航、目录独立滚动、硬件交互、宽图与字体；新增手机锚点避开目录的断言通过。`navigation-legacy-browser.log` 旧章节模型播放／切换／返回 1 项通过。`navigation-lint.log` 四文件无问题，`navigation-build.log` 类型检查与构建通过。IAB 实际操作桌面模型与二维架构、390px 主章节和本页目录跳转：页头底边 128px，目录底边 177px，目标标题 194px，未被遮住。
>
> **交付与取舍：** 4174 预览继续运行；截图为 `navigation-model-desktop.png`、`navigation-model-mobile.png`、`navigation-reading-mobile.png`、`navigation-hardware-desktop.png`，日志和修改前备份 `navigation-before/` 均在 `tools/wiki-runtime/knowledge-main-rebuild/`。手机页头占用更多高度以保证入口可见和可点，模型与知识正文未改。没有待决定的阻塞问题，视觉效果待用户查看。
>
> **2026-10-15 硬件控件显著性调整。** 用户指出四个观察层级以及复位／俯视／环绕的位置不明显。本轮只调整 `public/experiences/hardware-site.css`：层级导航在模型上方居中，1—4 编号、14px 字号、76px 高按钮（窄屏 72px），当前项深绿色；视角操作在模型下方居中的独立工具条内，14px 字号、最少 44px 点击高度，自动环绕开启时深绿色高亮；展开滑杆和提示也沿模型中心对齐。保留原层级、镜头与按需绘制行为，复用上一轮的 ResizeObserver 适配画布高度。
>
> **证据：** 修改前 IAB 测得层级按钮 39px 高、复位按钮 35px 高，集中在画布左侧；修改后 344px 视口（内部可用 329px）四层级按钮 72px 高、四视角按钮 44px 高，各组同排，scrollWidth=clientWidth=329。IAB 查看 1440／390／344px 并操作层级与自动环绕，确认活动状态。`hardware-controls-browser.log` 三项生产浏览器回归全部通过，覆盖柜门、视角、环绕、展开、旧上下文及窄屏画布无覆盖；`hardware-controls-build.log` TypeScript 与构建通过；`hardware-controls-lint.log` 样式 Lint 通过（public 不在默认范围，使用临时副本检查后已删除）。未增加新测试或依赖，知识正文与模型文件未改。所有日志及 `hardware-controls-{desktop,expanded,mobile}.png` 位于 `tools/wiki-runtime/knowledge-main-rebuild/`，修改前 CSS 保存为 `hardware-controls-before.css`。
>
> **交付与边界：** 4174 预览继续运行并打开硬件页；按钮变大占用更多纵向空间，窄屏说明区继续纵向滚动。没有待用户决定的阻塞问题。用户同时询问“完整学习路径”的含义，已解释为从正文直达对应模型／硬件，再返回原文位置；该路径本轮未实施。
>
> **2026-10-14 首页环绕恢复、AI Infra 品牌与硬件布局统一。** 用户要求找回首页环绕，指出硬件探索不搭，并明确采用 AI Infra 名称。对外品牌、首页英文引导、浏览器标题已统一为 AI Infra；包名与技术概念 inference 未作机械替换。本条取代下方“默认城市静止”的要求：首页仍只有「开始阅读」一个入口，模型加载后默认环绕，沿用 30 FPS 上限；拖动或 Esc 暂停，减少动态效果偏好下不自动播放，离开首页释放绘制循环。
>
> **硬件页面：** 统一为顶部观察层级、左侧画布、右侧完整说明栏和底部视角／展开控件；手机纵向排列并自然滚动。共享主站纸色与绿色，站内移除圆形展台，保留硬件几何与语义颜色，地面使用透明阴影材质。操作与说明优先于 2D 图解显示。适配同时写入 `scripts/experience-performance.mjs`，已核对适配输出与发布文件一致，并更新资源清单哈希。
>
> **复现与修复：** `orbit-red.log` 先记录默认首页 1.2 秒新增绘制为 0 的失败，恢复自动启动后通过。IAB 另复现展开滑杆后画布底边 720px、控件顶边 686px，画布遮挡 34px；根因是只监听窗口尺寸，没有监听画布容器。改用站内 ResizeObserver 后两者均为 686px，新增浏览器断言保护该行为。
>
> **验证证据：** `orbit-hardware-browser.log` 15 项通过，覆盖首页、减少动态效果、失败入口、离开自动环绕后的停止绘制、目录滚动、品牌标题、主站往返及硬件。最终硬件回归 `hardware-final-browser.log` 3 项通过、1 项在同时查看实时 3D 时，于末尾等待处达到 90 秒；暂停另一页面后保留原断言和超时，单独复跑 `hardware-interaction-final.log` 通过。四项最终硬件检查均已取得通过结果，覆盖窗口内画布尺寸、柜门／俯视／环绕／展开画面变化、空闲 0 次 RAF、旧入口及手机布局。`orbit-final-unit.log` 3 项资源单测通过，`orbit-final-lint.log` 8 文件通过，最终增加截图语句后该测试文件再次 Lint 通过；`orbit-final-build.log` 类型检查和构建通过。IAB 亲自操作了桌面层级切换、首页拖动暂停、390px 模组／滑杆与 2D 图解放大。
>
> **交付：** `http://127.0.0.1:4174/` 继续运行。日志与截图在 `tools/wiki-runtime/knowledge-main-rebuild/`，主要为 `ai-infra-home.png`、`ai-infra-hardware.png`；`ai-infra-hardware-390.png` 是保留旧课程上下文的移动入口截图，主站 390px 另已在 IAB 检查。保留本轮修改前备份 `orbit-hardware-before/`。自动环绕需要持续绘制，硬件静止仍按需绘制；实体手机帧率未测，视觉效果待用户评价。没有待用户决定的阻塞问题。
>
> **建议下一步（未实施）：** 先打通“一条请求”的完整学习路径：原文 → 对应模型步骤 → 相关硬件 → 返回原文位置，再把验证后的衔接方式推广到其他主题。继续以知识正文为主章节，不重建第二套课程正文。
>
> **2026-10-14 性能、统一导航与宽屏阅读：** 用户要求解决卡顿、模型／硬件像另一个网站，以及正文两侧留白过大。现在 `/wiki`、`/model`、`/hardware` 共用 `AppShell` 中的阅读页头；探索页不再显示旧版大标题与左侧课程栏，旧章节深链接仍保留课程上下文。主站与嵌入演示共用 `public/experiences/reader-palette.css`，几何、模型语义颜色及知识正文未改。此条取代下方“正文固定 780px”要求：目录 240px，正文上限 1200px；右侧本页目录只在容器宽度达到 1422px 时展开。长目录项可换行；窄屏计算演示上下排列，移除主站探索页的 760px 最小画布宽度。
>
> **性能实现与证据：** 硬件改为按需绘制，柜门、镜头、惯性与自动环绕仍驱动刷新；静止场景不重复生成阴影。模型与硬件按原生 DPR、1.5 上限及 250 万像素预算绘制，模型同一帧的重复绘制请求合并；正文使用 `memo` 避免搜索目录时重解析，开发试验页改为懒加载。发布适配集中在 `scripts/experience-performance.mjs` 并接入 `sync-experiences.mjs`，对应运行文件清单哈希已更新。`performance-before.log` 记录两项失败：切换模型→硬件约 11.86s、硬件→阅读 2.61s、静止每秒 16 次 RAF；正文 780px、四图均需横滚。最终 `performance-acceptance.log` 为同环境 1.38s、0.18s、静止 0 次 RAF；1440px 视口正文 1136px，四图均完整显示。这些是本机测量，不是跨设备速度承诺。
>
> **本轮验收：** 最终生产预览 17 项通过（主题目录滚动、首页往返、长目录项换行、四种模型视图、内嵌视图继续使用主站主题、硬件柜门／俯视／自动环绕／展开后的实际画面变化、窄屏画布边界和字体）；此前 `performance-final-browser.log` 11 项通过，包括五项本页目录定位检查。旧章节及硬件上下文的六项检查在 `performance-regression.log` 通过；该轮目录旧断言按页头下方的实际 scroll-margin 约束修正后已通过，未改动定位逻辑。`performance-mobile-red.log` 先复现模型越出 390px 屏幕到 760px，再修复并通过最终验收。3 项资源单测通过，`pnpm build`（含 TypeScript）、13 文件 Biome 检查通过。IAB 已实际操作模型播放／暂停、硬件柜门与整机层级、返回正文，并检查桌面及 390px 布局。
>
> **交付与限制：** 预览仍在 `http://127.0.0.1:4174/`。日志及实图 `reader-{wide,model,hardware,explore-mobile}.png` 位于 `tools/wiki-runtime/knowledge-main-rebuild/`。首进 3D 仍需加载和初始化；极窄屏的复杂知识图保留局部滚动以维持文字大小，3D 在高分屏采用自适应分辨率。未测试实体手机帧率，未发布到公网，未把测试通过等同于用户视觉认可。无待用户决定的阻塞问题。
>
> **2026-10-14 当前方向：知识库就是主章节。** 用户明确推翻旧方案，并选择“按主题目录直接阅读完整内容”。本条取代下方关于独立 22 章、课程与 Wiki 分离、固定 3D 母版及第 03 章继续迭代的历史要求；不要再把它们作为主站设计约束。
>
> **最新：首页只留一个阅读按钮。** 用户否定了加回导航和主题目录的首页，明确要求“首页就一个按钮，然后进入刚才整合的网页”。当前 `/`、`/#/home` 与旧别名都显示城市开场，唯一链接为「开始阅读」→ `/#/wiki`；已有城市、暖灰绿底、宋体双行大标题与简短引导语组成画面。首页不再导入知识快照，不显示导航、目录、环游或重置按钮；默认城市静止，保留拖动和按需绘制。加载状态与失败提示均不阻止进入主站。知识主站仍保留四个导航入口；“全部主题”、面包屑“主章节”和模型／硬件“返回主章节”均指向 `/wiki`，品牌与「首页」返回开场。此条取代下方“根路径直接阅读”“首页 11 个主题”及“保留环游按钮”的前一轮记录。
>
> **单按钮首页验证：** `single-browser.log` 的 14 项最终生产预览检查全部通过，包含桌面／手机唯一入口、手机无整页滚动与键盘 Tab / Enter、场景失败、旧首页链接、城市绘制预算与拖动、344／359px 导航和首页往返、知识目录滚动、完整正文及模型／硬件返回。保留原 4K 画布像素预算后，`single-mobile-final.log` 再验通过。`single-lint.log` 九文件通过，`single-build.log` 类型检查与生产构建通过。IAB 实际查看 1440×900、390×844，点击「开始阅读」确认进入 `/wiki` 并看到“大模型推理”，再点击品牌返回开场；首页 AX 只有一个链接。截图为 `single-home-desktop.png`、`single-home-390.png` 与 `single-home-359.png`，位于 `tools/wiki-runtime/knowledge-main-rebuild/`。当前首页已在 IAB 打开，4174 预览按用户要求继续运行。本轮不改知识正文和城市渲染器；实体手机性能未测，视觉仍待用户评价。待用户决定的阻塞问题：无。
>
> **此前加回已有首页（已被上条替代）：** 用户要求把已有首页也加上。全站导航增加「首页」`/#/home`，保留已有 3D 城市、旋转与环游；首页左栏从旧 22 章改为 11 个知识主题，与阅读页共用 reader store 和 `buildToc`，点击进入新版正文。根路径仍默认知识主题，`/#/archive/home` 保留为首页别名。IAB 实测首页目录 scrollTop=338、clientHeight=394、scrollHeight=732，正文 scrollY=0；点击「开始学习」进入阅读指南，再通过导航返回首页。359px IAB 视口保留原生滚动条后实际内容宽 344px，曾复现品牌与导航各高 44px（两行）；限制换行并收紧间距后目视确认恢复单行，回归额外覆盖 344px 内容宽度。最终生产预览 10 项浏览器检查通过，涵盖首页往返／刷新、1440／344／359px、首页手机滚动、知识目录滚动、旧链接与场景失败重试、环游以及默认阅读入口不加载 3D；七文件 Biome、类型检查及最终生产构建通过。证据为下述目录中的 `home-browser-final.log`、`home-build.log`、`home-lint.log` 和 `home-restored-{desktop,mobile}.png`。首次开发验证有冷加载与往返超时，原断言复跑通过，随后以最终生产预览为验收；未改超时或降低断言。`home-nav-initial-headless.log` 的 359px 无头浏览器未复现 IAB 原生滚动条占宽问题，不能当作失败测试。当前 `http://127.0.0.1:4174/#/home` 已打开并保持预览运行，临时开发服务已关闭。未修改城市渲染实现和知识正文；实体手机性能未测。无待用户决定的阻塞问题。
>
> **本轮左栏滚动修复与预览：** 用户要求直接启动网站，并指出左栏无法滚动。实际复现：900px 视口下目录被撑到 1029px，自身 scrollHeight 与 clientHeight 相等；滚轮移动整页而目录 scrollTop 仍为 0。原因是 `details` 匿名内容盒内的 `height: 100%` 未继承固定高度。现目录直接用视口减页头高度，手机保留自动高度与 65dvh 上限，并通过 overscroll containment 阻止滚到边缘后带动正文。1440／390px 两项先红后绿，连同首页和手机目录共 4 项回归通过；两文件 Biome、类型检查和生产构建通过。证据为 `sidebar-{red,green,build}.log` 与 `directory-scroll-{1440,390}.png`，均在下述证据目录。生产预览实滚后目录 scrollTop=201、正文 scrollY=0。当前 `http://127.0.0.1:4174/` 已打开并按用户要求保持运行；临时开发验收服务关闭。当前记录移至文件开头，历史记录完整保留。
>
> **实现：** 默认入口 `/`、`/#/chapters` 和 `/#/wiki` 都进入知识主题目录。11 个主题与 149 篇正文由现有 `toc.ts` 和知识快照统一供给；没有复制或改写第二套课程正文。新的阅读界面包含主题搜索、完整文章、来源与适用版本、本页小节导航和前后翻页；手机目录选文后收起。模型和硬件作为辅助探索，旧课程深链接仍作历史兼容；城市首页已按上条重新加入导航。
>
> **阅读规则：** 正文最大 780px，宽图保持原字号，宽图和宽表只在各自容器内滚动，整页不得横滚；这取代旧版 1034px 正文栏与桌面表格必须完全容纳的断言。表格使用 `text-wrap-style: balance` 平衡短段落，同时保留短标签的 nowrap。返回探索页的回归曾复现地址变化后旧画面滞留；路由关闭延迟 transition 后，模型／硬件往返和滚动恢复检查均通过。
>
> **验证：** 分批运行并修正／复跑失败项后，44 项知识阅读回归、3 项新主入口检查、3 项旧链接兼容检查、2 项字体与对比度检查均通过，共 52 项浏览器检查。相关单测 6 文件 57 项通过；最终 `pnpm build`（含 TypeScript）成功，`check:content` 确认 11 主题／149 正文完整且无重复，`check:deps` 通过。本轮 13 个受检代码／测试文件 Biome 无问题；全仓 lint 无错误，仍有 27 条警告与 3 条提示。
>
> **证据位置：** `tools/wiki-runtime/knowledge-main-rebuild/` 保存修改前副本、`browser-final.log`、`browser-repair.log`、`table-container-final.log`、`build-final.log` 和 `changed-files-lint.log`。前两份浏览器日志含已修正的失败，须结合后续复测结果阅读；旧 30 秒自定义时限导致的加载超时已按项目默认时限复跑。截图为 `knowledge-home-desktop.png`、`knowledge-reading-desktop.png` 与 `knowledge-reading-mobile.png`。IAB 已实际操作桌面／手机目录、搜索、文章锚点及辅助入口返回。
>
> **生产实测：** 最终构建在 4174 预览中实际打开：首页显示知识主题，点击 Embedding 可读完整正文；刷新深链接后仍正确显示，4 张 SVG 与 26 条来源入口均存在，点击品牌返回主题首页。验收用服务随后关闭；日常启动方式为 `pnpm dev`。
>
> **取舍与限制：** 本轮重建入口和阅读层，不重新制作历史 3D、不改知识正文、不启动真实问答模型服务；问答 UI 回归使用测试响应。构建保留已有大包及原生配置加载提示，实体手机帧率未测。没有覆盖或回滚原有无关修改，也未提交 Git。功能检查通过不代表用户已认可审美；新版视觉待用户查看。待用户决定的阻塞问题：无。下方均为历史记录。
>

> **2026-10-11 第 03 章整列运算（最新）：** 用户指出“还是抽两个小方块”，要求整列参与计算、清晰来源与整列写回，并质疑输入复制的 3D。`layer-calculation.ts` 已从单值 Operation 改为完整 ColumnStage，`layer-renderer.ts` 移除标量算术场景，采用与 RMS 相同的分组实例及母版纹理映射。残差两列保持完整形状靠拢，色带原位相加后形成完整新列并写回；注意力全列乘系数、全列累加；投影将输入整列与四组权重列依次相乘并沿输入维归约，结果接成完整输出列；ReLU 对各组实际负值比例演示归零，槽位仍保留。数值核对继续使用完整实际数据，列旁数字仅为辅助。已移除 split 场景及其调用、类型和测试枚举，分路改为正文中的数据依赖示意。
>
> **本轮验证：** `chapter03-columns-red.log` 先复现三项失败；`chapter03-columns-unit.log` 四文件 35 项通过，覆盖分组覆盖全维度、整列残差、因果列加权、完整 FFN、全部输入维参与的投影。`chapter03-columns-layout.log` 五项浏览器检查通过，含 1440/390px 的逐阶段画面、标签不互相重叠、分路无 3D 以及整列写回；另有七项交互与内容顺序检查通过（`chapter03-columns-check.log`）。`chapter03-columns-rms-check.json` 六个受保护 RMS 文件 SHA256 全未变。生产构建和最终生产回归结果见同目录 `chapter03-columns-build.log`、`chapter03-columns-production.log`。IAB 已实际从取列播放到整列写回。未测实体手机帧率，未把自动检查通过当成用户视觉认可。
>
> **最终验收证据：** `chapter03-columns-production.log` 20 项生产浏览器检查通过，包含十项原 RMS 回归。实播发现注意力移动后来源线仍留在旧端点，已改为跟随移动整列并在写回前淡出；`chapter03-columns-guides-final.log` 五项相关生产检查再次通过，`chapter03-columns-guides-lint.log` 无问题，最新生产构建包含类型检查并成功完成。最终实图为 `chapter03-columns-{1440,390}-{aligned,adding}.png`；`chapter03-residual-route.png` 为移除复制 3D 后的两路依赖示意。所有日志和实图位于 `tools/wiki-runtime/site-shell/`。
>
> **限制：** 几千维采用连续区间分组展示，细纹表达结构，不是逐格数值热图；全部维度仍实际参与计算。没有待用户决定的阻塞问题。下方标量运算方案已经被用户否定。
>
> **2026-10-11 第 03 章单维运算动作（已被否定）：** 用户要求亲自播放核对，确认新增动画仍是柱子移动、缩放，与认可 RMS 的取数、算术、返回不是一回事，随后授权“直接改”。该轮重写新增 `layer-renderer.ts`，保留整章正文、已认可 RMS 和完整计算链。
>
> **实现：** `layer-calculation.ts` 定义与实际计算数据对应的取值位置、运算及写回位置。残差从同位置、同维度取两数并相加；注意力逐位置乘实际权重、逐项累加、再做输出投影；前馈显示 W₁/W₂ 的母版权重几何，展示输入与对应权重相乘、乘积累加，以及正负值 ReLU。`projectionWeight` 由原八组因子导出同一组稠密权重，没有另造一套图内数值。投影先展开前两项，其余各项明确汇总，全部输入维度仍参与计算。图内跟踪一个维度，输出标为“本维已写入”，不伪装全矩阵逐格播放。结果按真实单元形状接回对应位置，落点保留细框。输入工作列保留母版纹理；操作数与结果沿用 RMS 的标注、细线、数值和读数停顿。小值自动增加显示精度。原先仅拉长柱子的动画已替换。
>
> **验证：** `chapter03-arithmetic-red.log` 先复现缺少图内算术；真实播放另发现首帧时间戳小于 effect 开始时刻会导致负阶段，现已夹紧时间差并补测试。`chapter03-arithmetic-final-unit.log` 3 文件 33 项通过；`chapter03-arithmetic-final-lint.log` 8 文件通过；`chapter03-arithmetic-final-browser.log` 18 项通过，包含原 RMS 的 10 项回归。最后算术区间距调整后，`chapter03-arithmetic-spacing-final.log` 7 项通过，覆盖 1440/390/444px、运算结果、文字不重叠、播放/暂停/旋转/复位。`chapter03-protected-rms-check.json` 确认 MatrixPart.tsx、MatrixPart.css、matrix-renderer.ts、matrix-rms-animation.ts、matrix-playback.ts、matrix-parts.ts 六个文件 SHA256 全部未变。所有日志在 `tools/wiki-runtime/site-shell/`。IAB 实际播放了残差完整过程、注意力乘法与累加、前馈乘法和 ReLU；没有只用静态截图替代播放检查。
>
> **最终生产验证：** `chapter03-arithmetic-production-final.log` 8 项通过。实际播放发现注意力累加的取数线交叉，已按来源左右位置排列加数；之后 `chapter03-arithmetic-source-final.log` 3 项生产浏览器测试通过，覆盖桌面与手机宽度的图内算术；33 项单测和生产构建重新通过。`chapter03-arithmetic-residual-result.png` 为最终残差相加实图，预览停在第一次残差起点。
>
> **限制与状态：** 当前仍为用户待评价版本；未测实体手机帧率。不把母版材质复用或自动检查通过称为用户认可。投影的其余项使用完整计算后的汇总展示，未逐项播放几千个乘积。无待用户决定的阻塞事项。下方是历史记录。
>
> **2026-10-11 第 03 章新增 3D 外观纠正（后续被指出播放过程仍不合格）：** 用户明确否定上一轮新增图，指出它们与认可的 RMS 不是同一套视觉。核对发现新增渲染器虽然调用 flow-look，却自行设置薄片比例、4096 条显示分格、全轴切线、数值纹理覆盖及另一套相机和控件。此前“复用母版”的表述不充分；下方数值纹理方案已移除，不得继续作为设计依据。
>
> **修改：** 新增 `layer-layout.ts` 从母版 `shapeOf` 取完整矩阵的原始比例、厚度、分组和切线，统一场景缩放；4096 维保持 16 组，8192 维保持真实的两倍高度。八维注意力保留明确说明的局部放大。`layer-renderer.ts` 移除额外片元着色和 DataTexture，输入恢复原生紫色；抽出的列继承原矩阵纹理坐标与随机种子。相机朝向和固定比例旋转沿用认可版 RMS，输出保留完整实体并标明等待/正在/已写入。`LayerPart` 复用 RMS 字阶和播放控件，起点/展开画布高度同 RMS。没有修改认可的 RMS 文件、章节正文顺序或计算数据。
>
> **证据：** `chapter03-native-red.log` 先复现新增图缺少母版分组；修复后 `chapter03-native-unit.log` 2 文件 28 项单测通过，`chapter03-native-lint.log` 7 文件 Biome 通过。`chapter03-native-browser.log` 15 项通过，覆盖新增五幅图在 1440/390/444px 的播放、暂停、旋转、复位及 10 项既有 RMS 回归。`chapter03-native-build.log` 类型检查与生产构建通过。日志均位于 `tools/wiki-runtime/site-shell/`。IAB 已完整刷新并实际播放残差、检查相加中间帧；截图 `chapter03-{1440,390}-{split,attention,residual-attn,ffn,residual-ffn}.png` 已更新。
>
> **生产预览：** 最终 `chapter03-native-production.log` 5 项通过，覆盖 5194 构建产物的母版分组与五幅图交互、1440/390/444px 布局。开发端口 5193 与局域网生产预览 `192.168.0.104:5194` 均已更新。
>
> **取舍：** 母版细纹表示结构，实际数值在已有核对区；不再用额外热图改变矩阵外观。数学仍使用完整数据。修正版视觉未获用户验收，实体手机帧率未测；无待用户决定的阻塞事项。下方均为历史记录。
>
> **2026-10-11 第 03 章通用 Transformer 主线（新增视觉已被否定，见上方纠正）：** 用户确认先做第 03 章，同时只固定 01—06 章边界。本轮已实现九段正文：输入 hidden、整层路线、残差分路、现有 RMS、注意力汇总、第一次相加、第二次归一化与基础前馈、第二次相加、返回整层。标题改为“一层 Transformer 怎样更新表示”。采用单条残差 pre-norm + RMSNorm 的教学结构，GLM mHC/KDA/SwiGLU 移入章末折叠延伸；知识库仍不进入正文导航。其余章节正文没有扩写。
>
> **实现：** `src/content/course/chapter03.ts` 独立承载正文，`foundations.ts` 引用。`chapter-layer.ts` 从现有 RMS 的 collapsed_attn / x_attn 开始，使用固定教学权重实际计算单头 8 维因果注意力、两次残差、第二次 RMS 与 4096→8192→4096 ReLU FFN；八组因子构造稠密投影以避免存储巨大权重数组，页面明确说明这是通用教学层，并非 GLM L00 全前向。`LayerPart.tsx` / `layer-renderer.ts` / `LayerPart.css` 提供五幅原位可播放旋转的 3D，复用母版 flow-look；矩阵叠加实际数值纹理，注意力累积实际贡献，ReLU 抽样前八维从负值收至零，数值核对折叠在图下。离屏暂停释放 WebGL，接近时重载。既有 MatrixPart、matrix-renderer、matrix-rms-animation、matrix-playback 与 RMS CSS 未修改。
>
> **边界与约定：** `PLAN.md` 顶部列出 01—06 的问题、交接和不在本章展开的内容，`DESIGN.md` 记录新增场景原则。只把本轮视为实现和功能验证，不冒称用户已认可新的注意力/FFN视觉。RMS 是此前用户认可的版本，后续继续保护。
>
> **验证：** `chapter03-chain-unit.log`：4 文件 30 项单测通过，含实际母版全部 6×4096 输入的 RMS 一致性与两次相加。`chapter03-chain-lint.log`：13 文件 Biome 通过；`chapter03-final-lint.log`：最后 3 文件通过。`chapter03-chain-content.log`：146 页 registry 和 22 章内容校验通过。`chapter03-final-build.log`：类型检查与生产构建通过，保留既有大包提示。`chapter03-chain-browser.log`：15 项浏览器回归通过，含 10 项既有 RMS 空间/播放检查。IAB 实测发现 444px FFN 标签顶部裁切，`chapter03-label-red.log` 先稳定复现，修复相机中心和标签行高；`chapter03-final-browser.log` 4 项通过。最终局域网生产预览 `chapter03-final-production.log` 7 项通过，覆盖新增3D、1440/390/444px、原生 RMS 材质、阅读字阶与22章导航。上述日志都在 `tools/wiki-runtime/site-shell/`。最终截图 `chapter03-{1440,390}-{split,attention,residual-attn,ffn,residual-ffn}.png`。IAB 已实际播放残差、前馈、注意力，前馈完整结束且标题未裁切。
>
> **取舍 / 未检查：** 采用明确说明的未训练教学权重，保留真实形状与完整逐维计算，不作语义归因；省略偏置和位置编码。未使用实体手机测帧率。未提交 git；原有大量无关修改未回滚。无待用户决定的阻塞事项，新增视觉待用户查看。下方为历史记录。
>
> **2026-10-11 RMS 白色输出与起点空白（最新）：** 用户指出白色矩阵意义不明、对比度不足，且未播放时下方空白过大。现 RMS 输出与运动结果列采用现有 `--color-matrix-output` 绿色，参数、RMS 分母及相关副本采用现有 `--color-matrix-parameter` 色；输入保留母版紫色，原生材质、厚度、纹理保留。待写入输出的褪色由 0.56/0.7 降至 0.28，并在形状标签下显示“等待写入／正在写入／本列已写入”，初始说明直接解释三个对象。运动副本从对应原矩阵继承配色，避免计算中重新变白。
>
> **布局：** 进度 0 且未播放时画布收为桌面 420px / 窄屏 280px；点击播放或拖到非零进度时展开到原有 700px / 480px，暂停保留展开，拖回 0 再收起。相机在两种状态下使用对应边界与中心；旋转不重新适配比例。播放时的自动滚动在展开后的 effect 中执行。只改 RMS 及其共享渲染器的必要支撑，不重排整章。
>
> **证据：** `rms-compact-red.log` 先复现初始画布仍为 700px，超过 440px 的断言失败。23 项相关单测通过（`rms-compact-unit.log`）、5 文件 Biome 通过（`rms-compact-lint.log`）、类型检查和生产构建通过（`rms-compact-build.log`）。最终 5194 生产预览 15 项浏览器回归通过（`rms-compact-browser.log`），覆盖起点收起/播放展开/暂停/回退、输出状态、连线、取值、旋转、其他算子及 1440/390px。截图 `tools/wiki-runtime/site-shell/rms-compact-{1440,390}-{idle,complete}.png`。IAB 已完整重载，实际从头播放至写回，回到起点并旋转检查，最后保留复位后的紧凑初始画面。局域网预览同步最终构建。
>
> **取舍与限制：** 初始状态与播放状态各适配一次相机，状态切换会调整矩阵比例；各状态内拖动旋转比例固定。没有实体手机性能数据，构建保留既有大包提示。待用户决定事项：无，本轮视觉仍待用户评价。下方均为历史记录。
>
> **2026-10-11 RMS 来源线可见性与对比度（最新）：** 用户仍指出遮挡和过淡。此前只避让空间路径不足以保证来源标注可读；本轮明确将来源线与来源框作为讲解标注，在实体之后绘制并关闭其深度测试，保留真实三维锚点、旋转联动和既有绕行路线。线宽由 1px 调为 1.6px，读数透明度由 0.45 提高到 0.9，来源色加深，背后用 3.8px 纸面色细描边与矩阵轮廓分开；合并末段再淡出。平方和缩放先移出完整列，再展开下方算术，避免开头两种动作重叠。只改 RMS 局部；母版材质、4096 维计算与 36 秒总时长保留。
>
> **证据：** 先用 `rms-annotation-red.log` 和 `rms-annotation-motion-red.log` 复现标注深度遮挡与提前出现的算术副本。最终 23 项单测通过（`rms-annotation-unit.log`），3 文件 Biome 通过（`rms-annotation-lint.log`），类型检查和生产构建通过（`rms-annotation-build-final.log`）。5194 生产预览 14 项浏览器回归通过（`rms-annotation-browser-final.log`），包括播放、旋转、取值、桌面与 390px 尺寸。截图 `rms-links-{1440,390}-{early,hold,moving,merging,rotated}.png` 及 `rms-arithmetic-path-{1440,390}-*.png` 均在 `tools/wiki-runtime/site-shell/`。IAB 完整刷新后实际播放到写回，再拖动旋转并检查取数、除 RMS 的来源连接；局域网生产预览已同步最终构建。
>
> **取舍与限制：** 来源标注优先保持可见，因此不再服从实体深度遮挡；这条规则取代下方历史版本的深度测试约定。矩阵本身仍有正常三维深度。窄屏已验证，实体手机性能未测；构建保留既有大包提示。本轮视觉仍待用户评价，待用户决定事项：无。下方为历史记录。
>
> **2026-10-11 RMS 播放中的连线遮挡修正（上一版）：** 用户实播发现线被遮挡。IAB 复现：平方阶段工作列移出，但来源轮廓和线仍固定在原输入深度，连线前半段被工作列盖住。现平方及缩放的输入锚点直接读取正在运动的整列实例位置与前表面深度，来源点随同一列移动。取数线道绕到其侧面，并限制在参数列之前的空隙内，避免贴着侧面或挤到 γ 上。最初的小零件沿前凸轨迹落到算术区，避开原矩阵内部；完整连线端点仍跟随零件。保留深度测试、淡线、外侧数字、母版材质与原时序。
>
> **证据：** `rms-occlusion-red.log` 先复现来源坐标滞后及射线遮挡。最终 21 项单测通过（`rms-occlusion-unit.log`），含默认阅读视角 50 个动画时刻的连线遮挡检查；3 文件 Biome、类型检查和生产构建通过（`rms-occlusion-build.log`）。生产浏览器完整回归 14 项通过（`rms-occlusion-browser.log`）；最后收窄线道后补测 3 项相关桌面/窄屏用例通过（`rms-occlusion-final.log`）。截图新增早期取数 0.05、0.1 与缩放 0.05，位于 `tools/wiki-runtime/site-shell/rms-arithmetic-path-{1440,390}-*.png`。IAB 实际从头播放到写回；最终重载后再次播放，暂停在原先遮挡的平方阶段供用户比较。5194 局域网预览已同步。
>
> **限制：** 几何遮挡回归针对默认阅读视角；旋转到背面仍保留正常三维遮挡。实体手机性能未测，无新的 FPS 结论。待用户决定事项：无。下方为历史记录。
>
> **2026-10-11 RMS 完整来源连线纠正（上一版，播放遮挡见上方修正）：** 用户明确要求保留从取出位置到下方零件的直观连线，否定用 A/B 替代。现移除字母标记；细线从真实来源轮廓边缘接出，沿工作列旁空隙向下接到零件顶面，读数时不断开，合并时线端随零件移动并淡出。下方操作数上移 10 个模型单位，数字放在外侧下方，给连线和向中间合并的动作留出空间；运算标题放在算术区底部。修正母版 sRGB Vector3 被当成 Three Color 复制而产生无效颜色分量的问题，连接线恢复淡紫等来源色，去掉低透明度 alpha-to-coverage 导致的断续。母版矩阵材质、真实 4096 维计算、36 秒时序、默认比例与旋转均保留，只修改 RMS 局部。
>
> **证据：** `rms-links-red.log` 先复现读数时连接线隐藏。最终 19 项单测通过（`rms-links-unit.log`），包括来源位置、完整线端连接、颜色分量和归约计算；4 文件 Biome 通过；`pnpm build` 包含类型检查并成功完成（`rms-links-build-final.log`）。最终 5194 生产预览浏览器回归 14 项通过，1.1 分钟（`rms-links-browser-final.log`），覆盖实际播放、暂停、复位、旋转、取值、桌面与 390px 布局。截图 `rms-links-{1440,390}-{hold,moving,merging,rotated}.png` 均位于 `tools/wiki-runtime/site-shell/`。IAB 已重载最终版本，实际播放、旋转并检查停留画面，最后回到未播放状态；5194 局域网预览同步最终构建。
>
> **取舍与限制：** 连线保留真实三维深度，自由旋转到遮挡角度时会被前面的实体遮住；没有强制置顶穿过矩阵。已测浏览器窄屏，实体手机性能未测，未报告本轮 FPS。既有构建大包警告保留。待用户决定事项：无。下方为历史记录。
>
> **2026-10-11 RMS 来源关系重做（历史，A/B 方案已被用户明确否定）：** 用户否定长线穿过文字和矩阵、视觉违和，要求一眼看清来源。已删除跨区弧线，改为源位置细描边与 A/B 小标记，下方操作数显示相同标记和维度范围。平方与缩放的数值块也从来源移出；原来的成对归约轨迹保留。线只作为移出时紧随零件的短轨迹，长度不超过 0.65 个块宽，停留读数时隐藏；根据当前视角检查文字、完整矩阵和运动工作列的投影包围盒，遇到遮挡就不绘制短轨迹。无需点击增加解释层。初始进度 0 仍不显示运算副本与来源标记；不改母版、整页布局或其他算子。
>
> **本轮证据：** 长连线回归先失败（`rms-provenance-red.log`）；相关单测 18 项通过（`rms-provenance-unit.log`），包含准确来源位置、轨迹长度、读数时消失及文字遮挡。5 文件 Biome、类型检查及生产构建通过（`rms-provenance-build.log`）。旋转截图发现相机矩阵未在标注投影前刷新，已修正同帧更新顺序。截图测试原先点击距离过近时落在滑块上而未改变进度，现改为真实拖动并核对输入值。最终 5194 生产浏览器回归 14 项通过（`rms-provenance-browser-final.log`），含完整播放、来源对应、旋转、暂停、取值、初始状态与桌面/窄屏。截图 `rms-provenance-{1440,390}-{hold,moving,rotated}.png` 位于 `tools/wiki-runtime/site-shell/`。IAB 已完整刷新，实际播放和旋转检查，最后复位至未播放状态；手机预览同步最终构建。
>
> **限制：** 读数时通过原位轮廓与 A/B 对应辨认来源，不保留完整连接线；短轨迹遮挡检查采用保守包围盒，靠近物体时可能整段隐藏。实体手机性能未测，本轮未重新报告 FPS，既有构建大包警告保留。待用户决定事项：无。下方为历史记录。
>
> **2026-10-11 RMS 初始状态与来源线（上一版，长曲线已被用户否定）：** 用户认为图内运算“稍微好点”，指出未播放就出现两个运算块，并要求用优美、不违和的线看清来源。进度 0 现同时隐藏算术副本、标注与引导线；播放开始才出现，暂停保留当前画面，拖回起点再次隐藏。RMS 取数与读数期间显示至多两条 1px 三维曲线，源点对应所选输入维度、当前归约组、已算出的 RMS 或参数 γ；沿用来源颜色，向下展开后从数值块外侧接入，避免大弧线绕过输出矩阵。归约零件抵达读数位置后线才淡入，合并时淡出，4096 和 ε 不伪造矩阵来源。复用线条顶点缓冲区，并在卸载时释放；没有移动点、粗箭头或常驻连线网。仅 RMS 局部修改。
>
> **本轮证据：** 起点几何回归先失败（`rms-idle-red.log`），修复后相关单测 16 项通过（`rms-guides-unit.log`），3 文件 Biome 通过；最终类型检查与生产构建通过（`rms-guides-build-final.log`）。5194 局域网生产预览 13 项浏览器检查通过（`rms-guides-browser-final.log`），含实际完整播放、暂停、回到起点、旋转比例、取值、桌面与窄屏。IAB 已完整刷新，实际拖动确认线跟随场景旋转，并复位至未播放状态。截图 `tools/wiki-runtime/site-shell/rms-idle-{1440,390}.png` 和 `rms-arithmetic-{1440,390}-0-operands.png`。构建曾遇到 Wiki 锁：核对 PID 44952 已退出后用 `WorkflowStore.recoverLock()` 恢复；另一次短暂竞争等待锁释放后串行重建成功，没有删除活进程的锁或更改 Wiki 内容。
>
> **限制：** 仅浏览器窄屏实测，未测实体手机性能；自由旋转下保留三维遮挡关系，当前细线视觉仍待用户评价。没有重排正文或修改其他算子。待用户决定事项：无。下方为历史记录。
>
> **2026-10-11 RMS 图内运算（上一版）：** 用户指出运算全部在文字里，图中只是突然合并。本轮仅重做 RMS 的运算演示：每轮取出相邻两组到同一三维场景下方，显示各组范围和真实平方和，先停留、相加成一个结果，再回到原列参与下一轮。第一轮为 384.06 + 392.20 ≈ 776.26；四轮 16→8→4→2→1，随后在图内演示除以 4096、加 ε、开方，以及原数除 RMS、乘 γ。操作数合并后保留淡色参照；结果用约等号表示显示舍入。动画 36 秒，每轮归约约 3.3 秒。删除与图内部分和错时出现的下方重复算表，保留展开核对单维数值。
>
> **实现与范围：** `matrix-parts.ts` 的 `rmsColumn` 共用真实 4096 维数据，16 组仅为显示分组；`matrix-playback.ts` 统一阶段和四轮归约时序；`matrix-rms-animation.ts` 复用母版材质绘制三维操作数及结果，数字跟随对应空间位置；选中维度与图内缩放同步。保留整列抽出、避让 γ 的写回路径、固定缩放的旋转和大矩阵细节。画布桌面 700px、窄屏 480px，为图内算术留空间；1440px 默认投影 6.4047 CSS px/模型单位，旋转后比例为 1。没有重做正文整页或其他算子。
>
> **本轮验证：** 先用浏览器失败测试复现缺少图内操作数；几何测试发现并修正四轮边界浮点误差导致的位置跳变。18 项相关单测通过，12 项完整浏览器检查通过，最终局域网生产预览 3 项专项通过；10 文件 Biome 与 `pnpm build`（含类型检查）通过。日志 `tools/wiki-runtime/site-shell/rms-arithmetic-{red,unit,browser,production,build}.log`，截图 `rms-arithmetic-{1440,390}-{0,1,2,3}-{operands,sum}.png` 与 `rms-arithmetic-{1440,390}-stage-*.png`。独立 12 秒采样 720 帧、60.00 FPS、P95 16.7ms、0 个 >50ms 帧、6.68 次绘制/帧、0 次纹理上传，见 `rms-profile-arithmetic.json`。现有 IAB 已完整重载并实际播放，停在第一轮加法结果；5194 手机预览同步最终构建。
>
> **限制：** 视觉尚未获用户认可；仅验证浏览器窄屏，未测实体手机性能。自由旋转保持真实深度关系；构建保留既有大包警告。待用户决定事项：无。下方是历史记录。
>
> **2026-10-11 RMS 放大与计算解释（上一版）：** 用户要求默认放大、拖动只旋转、计算讲清楚，表示其他部分还行。根因是 OrbitControls 的 change 事件调用 resize，按当前角度重新调整 camera.zoom；浏览器捕获投影矩阵稳定复现一次拖动后比例变成 0.7247（`rms-camera-red.log`）。RMS 旋转现仅重绘，初始朝向负责视口适配；桌面画布 480px、窄屏 300px，横向适配由 0.88 调到 0.95。1440px 浏览器默认投影从 4.897 增至 6.353 CSS px/模型单位（约 +30%），拖动后比例为 1，复位正常。没有更改母版材质、动画路径或其他算子。
>
> **计算说明：** 图下按阶段列出原始数、平方、全部 4096 维的平方和、均方、加 ε 开方；缩放拆为原输入除以共同 RMS，再乘本维 γ。当前运算用既有行动色突出，其余中间结果保留可读。输入、γ 与归一化中间值用三位小数辅助核对；所有计算仍取完整精度。说明补清平方避免正负抵消、16 组仅为显示分组、每词单独算 RMS、γ 跨词共享与输出形状不变。
>
> **本轮证据：** 16 项相关单测通过，4 文件 Biome 通过；最终 `pnpm build`（含类型检查）通过。局域网生产预览 11 项浏览器测试通过，最终数值精度与窄屏间距调整后 2 项专项再次通过；日志为 `tools/wiki-runtime/site-shell/rms-camera-{unit,build,browser,final}.log`。截图 `rms-camera-{default,rotated}.png` 和 `rms-spatial-{1440,390}-{square,reduce,scale,place}.png`。独立 12 秒采样 720 帧、59.92 FPS、P95 16.8ms、0 个 >50ms 帧、4.85 次绘制/帧、0 次纹理上传，见 `rms-profile-camera.json`。现有 IAB 已完整重载并操作播放、查看缩放算例；5194 手机预览同步最终构建。
>
> **限制：** 仅浏览器窄屏验证，未测实体手机性能；自由旋转保留实际观察方向下的遮挡关系，相机使用正交投影，没有动态缩放来保持每个角度相同占屏面积。构建保留既有大包警告。待用户决定事项：无，本轮视觉仍待评价。下方是历史记录。
>
> **2026-10-11 RMS 抽出与中段遮挡（上一版）：** 用户指出“第一下出来难看、中间挡住矩阵”。在现有浏览器播放中复现开头逐行错位形成斜面，以及结果列投影盖住原 γ；另发现停在上方的 RMS 方块压到 γ 标题。仅改 RMS 运动：整列先完整脱离输入表面再平移到空位，去掉错行和深度波浪；归一化、乘 γ 在同一工作列原位完成，通过母版颜色过渡保持完整形状；原 γ 保留可见，结果整列从其后方经过再接入输出。RMS 分母停在列下方，场景边界同步调整；窄屏输入标签解除原先为上方标量预留的 36px 下限，避免形状文字压住矩阵。保留 3D 旋转、播放、4096 维数据与整页排版。
>
> **本轮验证：** 先新增真实母版几何测试，旧实现的整列对齐与 γ 投影分离两项失败（`rms-path-red.log`），修复后三份相关测试文件 16 项通过（`rms-path-unit.log`）。`pnpm build` 含类型检查通过，4 个相关代码/测试文件 Biome 通过。真实局域网生产预览 10 项浏览器测试通过（`rms-path-browser.log`）；截图检查后修正窄屏标签，再次构建、2 项针对性浏览器检查通过（`rms-path-final.log`）。桌面/390px 抽出、中段及写回截图为 `rms-path-{1440,390}-{0.05,0.1,0.15,0.5,0.6,0.66,0.7,0.8,0.85}.png`，均在 `tools/wiki-runtime/site-shell/`。独立 12 秒采样 720 帧、59.92 FPS、P95 16.7ms、0 个 >50ms 帧、4.85 次绘制/帧、0 次纹理上传，见 `rms-profile-path.json`。
>
> **预览与限制：** 5193 开发预览、5194 手机静态预览已更新。已将现有 IAB 标签页完整 reload 并停在播放起点：只依赖热更新可能保留 useEffect 中旧的 Three.js 动画对象，检查新几何必须重新载入。默认阅读视角下的避让已有几何与截图证据，自由旋转保持真实三维深度，极端侧视自然仍会重叠。实体手机 FPS 未测；构建仍有既有大包提示。用户未验收本轮视觉，无其他待决定事项。下方是历史记录。
>
> **2026-10-10 RMS 合并与直接播放（上一版，待用户视觉评价）：** 用户反馈“这一版有点意思”，但合并不清楚，也不需要分词选择。本轮仅修改 RMS：移除选词按钮，默认示例列可直接播放；归约由同时缩小消失改为相邻 16→8→4→2→1 组逐轮相接，合并前后保持实体外轮廓连续，最后停留展示平方和、均值、RMS。`matrix-playback.ts` 的归约时序供动画与图下算例共用；点选原矩阵仍可核对其他列，部分和不误映射为单个通道。手机图内只标“均值”，完整除法位于图下，避免压到 γ 列。正文整页和其他算子未重做。
>
> **本轮证据：** 浏览器回归先失败，确认仍有选词栏且缺少 8/4/2 组中间绘制（`rms-merge-red.log`）；修改后开发预览 9 项浏览器检查通过，最终局域网生产预览 4 项 RMS 检查通过，含真实播放、逐轮实例数、矩阵点选、阶段数值和 1440/390px 中间帧。`pnpm build` 含类型检查通过、13 项相关单测通过、6 个代码/测试文件 Biome 通过。日志统一在 `tools/wiki-runtime/site-shell/rms-merge-{build,unit,browser,production}.log`。12 秒本机采样 720 帧、60.00 FPS、P95 16.7ms、无 >50ms 帧、平均 5.35 次绘制/帧、无纹理上传，见 `rms-profile-merge.json`。截图 `rms-merge-{1440,390}-{0.255,0.295,0.335,0.375,0.42,0.4475,0.47}.png`。
>
> **限制 / 预览：** 用户只肯定了上一版的部分方向，当前视觉未获验收。16 组是演示分组，数学仍覆盖完整 4096 维；未测实体手机性能，构建保留既有大包警告。开发地址 `http://127.0.0.1:5193/#/chapters/03#rms`，手机同 Wi-Fi 地址 `http://192.168.0.104:5194/#/chapters/03#rms`，均已更新。下方是历史记录。
>
> **2026-10-10 RMS 连续三维动作（上一版，待用户视觉验收）：** 用户否定“静态矩阵表面几个数字变化”，确认整列抽出、平方归约成单个 RMS、分母广播与 γ 配对、写回输出的方向，并要求保留符合当前排版的辅助数字。本轮重写 `src/app/course/matrix-rms-animation.ts`：原始输入、γ、输出始终保留；母版 fragment shader、原始厚度与纹理复用，vertex shader 只局部适配实例位移，四组 InstancedMesh 批量绘制 16 组整列运动，不把 16 组当 16 个数。计算仍使用全部 4096 维。删除 7 维表面数字、折叠放大逻辑和完整/局部切换。`MatrixPart.tsx` 图下用既有正文与等宽字阶显示阶段算例，点选保持当前阶段并切换数值；详细算式仍可展开。只改 RMS，未重排整页或修改母版发布文件。下方表面细化等是被否定的历史试作。
>
> **本轮验证已补齐（2026-10-10，用户明确允许沙箱外运行）：** `pnpm build`（含类型检查）通过；相关 Vitest 3 文件 13 项通过，9 个相关文件 Biome 通过。实际局域网生产预览 `http://192.168.0.104:5194` 上的 8 项浏览器测试通过，覆盖原生母版材质、整列实例绘制、播放/暂停/进度、旋转/复位/离屏暂停、点选保留阶段、首尾维度、桌面 1440/1600px、390px 与 900px 布局、Wiki 字体一致性和其他算子。截图检查发现手机形状标签换行压到矩阵，新增断言稳定复现（36px 高而单行应不超过 19px），已修复；完整 8 项复验通过，最后 CSS 选择器整理后重新构建并再次通过数字/标签的桌面与手机专项检查。日志：`rms-spatial-build.log`、`rms-spatial-unit.log`、`rms-spatial-browser.log`、`rms-shape-label-red.log`、`rms-spatial-label-final.log`，均在 `tools/wiki-runtime/site-shell/`。
>
> **当前状态 / 限制：** 审批阻塞已解除，`5194` 手机静态预览已更新到最终构建，`5193` 开发预览保留。本机 12 秒独立采样 720 帧、60.00 FPS、P95 16.7ms、0 个 >50ms 帧，平均 5.71 次绘制/帧、0 次纹理上传，见 `tools/wiki-runtime/site-shell/rms-profile-spatial-final.json`。截图为同目录 `rms-spatial-1440-{square,reduce,scale,place}.png` 与 `rms-spatial-390-{square,reduce,scale,place}.png`。未测实体手机 FPS；构建仍有既有大包警告。用户确认的是方向与数值要求，本轮视觉仍待评价，不能标为用户验收。无需再次询问运行许可。
>
> **2026-10-10 RMS 表面细化（历史，已被用户否定）：** 用户指出矩阵粗糙，近景复现格线/色块边界锯齿、数字不随平面倾斜。仅细化 RMS：显示坐标中绘制连续细格，同时抗锯齿处理格线及色块边界；折叠部分分组取真实数值着色，侧面延续分格；矩阵厚度由 2.4 收到 1.4，γ 宽度由 10 扩到 12，数字用同一正交投影贴合表面。正文、控件、FFN/mHC 和母版保持原状。近景为 `tools/wiki-runtime/site-shell/rms-surface-final.png`，修改前为 `rms-surface-before.png`。不能将本轮记作用户认可。
>
> **本轮证据：** 15 项单测通过；局域网生产预览 8 项浏览器测试通过（`rms-surface-browser.log`），最终折叠区域着色修正后 4 项 RMS 检查再次通过（`rms-surface-final.log`）。新增检查验证数字的基线与同维矩阵行倾角一致，旋转、复位后仍成立。4 文件 Biome、包含类型检查的生产构建通过（`rms-surface-build.log`，既有大包警告）。12 秒本机采样 720 帧，60.00 FPS、P95 16.7ms、无 >50ms 帧、3 次绘制/帧、无纹理上传（`rms-profile-surface.json`）。手机生产预览已随 dist 更新，验证包含 390px 浏览器；未在实体手机验证。开始时自动审批服务 403 导致实时浏览器无法运行，先用本地构建离线截图；随后恢复并完成真实局域网预览验证。
>
> **2026-10-10 RMSNorm 正文局部试作（上一轮）：** 用户指定参考 [Mechanical Watch](https://ciechanow.ski/mechanical-watch/) 的正文内局部演示，结合 [Bycroft](https://bbycroft.net/llm) 的立体矩阵，只重做 RMS。现为 760px 单列图文、同一场景的输入/γ/输出、正向投影数值标注、四步观察与播放。保留旋转、拖进度、换词和全部维度取值；数值核对默认折叠，点击矩阵自动打开。7 个连续维度展开，其余明确折叠；概览按维度分组显示。完整 4096 维数据与计算仍来自母版教学数据。初始显示输入和待生成输出，播放在原矩阵上逐项改变数值。只调整 RMS，FFN/mHC、其他章节与原母版未重做。用户尚未视觉验收。
>
> **播放性能：** 本机 Chromium 独立采样 12 秒，720 帧，约 60.00 FPS，P95 16.7ms，无超过 50ms 的卡帧；每帧 3 次绘制、播放期间无纹理上传。见 `tools/wiki-runtime/site-shell/rms-profile-article.json`。这不是实体手机性能保证。手机数值字号最终为 12px、维度索引 10px。
>
> **验证：** 15 项相关单测通过；局域网生产预览 7 项浏览器检查全部通过（35.3s），覆盖四步数值、桌面/390px 字符不重叠、旋转、概览/局部切换、首尾维度、离屏暂停及其他算子回归。旧测试因输入移入展开项失败，已改为先展开再检查，数值断言保留。类型检查、9 文件 Biome、生产构建通过（既有大包提示仍在）。日志：`tools/wiki-runtime/site-shell/rms-article-release.log`、`rms-article-build.log`；截图：`rms-article-1440.png`、`rms-article-390.png`。手机预览 `http://192.168.0.104:5194/#/chapters/03#rms` 已更新，实体手机显示尚未验证。
>
> **2026-10-10 手机局域网预览：** 手机同 Wi‑Fi 仍看不到，日志已出现另一台局域网设备读取页面/JS/CSS 的 200 响应；根因是 Windows 上 Python 默认静态服务将 `.js` 返回为 `text/plain`，ES module 被浏览器拒绝。`tools/wiki-runtime/site-shell/serve-mobile.py` 仅提供 `dist`，明确 JS/MJS/CSS/JSON/WASM 类型，并强制重新返回资源、设置 `no-store`，避免旧错误 MIME 被 304 缓存保留。启动：`F:/ProgramData/Anaconda3/python.exe tools/wiki-runtime/site-shell/serve-mobile.py 192.168.0.104 5194`。当前地址 `http://192.168.0.104:5194/#/chapters/03#rms`，绑定 WLAN，不改防火墙；IP 变化时须按新地址重启。本机已验证 JS 为 200 / text/javascript（携带旧缓存条件头仍为 200）；真实 Chromium 访问该局域网生产预览，两项 RMS 浏览器测试通过，含 390px 布局、数据/3D 加载、播放、旋转与取值。日志 `tools/wiki-runtime/site-shell/mobile-preview-verified.log`。实体手机最终效果待用户重试确认。
>
> **2026-10-10 RMS 单场景连续展开（当前）：** 用户明确确认“同一个 3D 矩阵上放大某一列、看清对应元素、演示计算并写入结果”。此前上下双视图未满足要求。现删除独立数值块、第二场景/相机与分屏渲染，直接扩展母版三个原始网格的表面：连续 7 维局部展开，周围维度压缩保留，输入/γ/输出按相同坐标对应。γ 移至两矩阵之间；“查看完整矩阵”恢复完整比例，旋转角度不变。着色与数字读取完整连续教学张量，平方和用全部 4096 维；平方、累加、除 RMS、乘 γ、写入均在原矩阵上表现，可选择任意维度。局部显示比例经过放大，不能当作完整几何比例；整体视图保留母版比例。没有修改母版、FFN/mHC 动画或批量推广其他章节。
>
> **验证：** 新增同一矩阵切换测试先红后绿；15 项单测通过，包括全部维度映射的可逆性、首尾连续范围、真实 RMS 数值核对。6 项浏览器检查通过，涵盖单一完整视口、桌面/390px 四阶段、旋转/复位、取值、换词、首尾维度、离屏暂停及现有 FFN/mHC。窄屏标题区域重叠已修；最后留白调整后 3 项相关浏览器检查再次通过。类型检查、8 文件 Biome 与生产构建通过，构建仍有已有大包警告。IAB 实际播放、拖进度和拖动旋转。相同 Chromium 配置的 12 秒采样：60.00 fps、P95 16.7ms、3 次绘制/帧；文件为 `tools/wiki-runtime/site-shell/rms-profile-single-scene.json`，不代表所有设备表现。截图 `test-results/chapter03-rms-1600-scale.png`、`chapter03-rms-390-scale.png`。**方向已确认，当前视觉尚未获用户验收。**
>
> **2026-10-10 流畅度与矩阵细节修复（历史，双视图已被否定）：** 用户反馈“很卡”“是不是丢失了矩阵细节”。已测出此前 30fps 门槛在本机实际落到约 22fps，并复现展开时完整矩阵被隐藏。RMS 改为一个 WebGL 画布的整体/局部双视图：完整输入、γ、输出网格始终保留，所选词高亮，输出写入叠在完整淡色网格上；下方显示同一词的选定维度，写回时不再清空局部。上下同步旋转，点击整体或局部均能取值。WebGL 直接随 requestAnimationFrame 推进，React 文字每 150ms 同步；取消六面分材质，数值块每块一次绘制；静态标签不再每帧重排。点击播放会把不完整可见的画布带回视野，避免立即触发离屏暂停。
>
> **验证：** 同一台机器、同一 Chromium 配置、同样 12 秒采样窗口，渲染约 21.98 → 60.00 fps，P95 帧间隔 50.0 → 16.8ms，单帧绘制约 62 → 16 次。数据与可复现脚本在 `tools/wiki-runtime/site-shell/rms-profile-before.json`、`rms-profile-after.json`、`profile-rms.mjs`；这是本机测试浏览器结果，不保证所有设备同帧率。14 项单测、5 项浏览器检查通过；新加的标签间距检查先发现重叠约 1px，修正位置后通过。类型检查/构建通过（25.97s，已有大包警告），5 文件 Biome 通过。IAB 实际播放并拖动，确认整体/局部同步旋转且结束后均保留；截图 `chapter03-rms-computation-1600.png`、`chapter03-rms-computation-390.png`。完整数据仍为 4096 维，放大区只是取样，不能说每一维都已单独画出。用户尚未认可本轮视觉；FFN/mHC 的详细数值编排不在本轮范围。
>
> **2026-10-10 RMS 播放重做（历史，独立数值块已替代）：** 用户实际播放后否定“就是一个点在里面移动”。已复现并回读母版 `play.js` 的 `normScene/pairScene`：问题是此前没有把参与计算的数值与中间结果演出来，不能靠继续修线条解决。当前先改 RMS：同一画布内从所选词的原矩阵位置抽出真实数值，展示平方、归约为均方根、除以 RMS 并与同维 γ 配对、写回原输出列，20 秒一轮。新增 `src/app/course/matrix-rms-animation.ts`，格子是真正可旋转的 3D 网格，文字使用项目等宽字体；可点击展开格子检查对应通道。最多展示 5 维且明确标注索引，计算使用全部 4096 维。移除各局部图连线上的移动点；RMS 展开期间不显示连接线。母版和其他章节未改，FFN/mHC 仍待细化运算演示，勿把本轮记成全页动画完成或用户认可。
>
> **验证证据：** IAB 实际点击播放并观察取数、平方归约、缩放和最终完整矩阵；14 项相关单测通过，原 4 项浏览器回归通过，新增 RMS 桌面/390px 四阶段、旋转、点击取值、换词重算与完成恢复检查通过。新增测试最初仅测旋转后的横向位移不足，改为足够拖动并检查二维位移后通过，没有降低旋转断言。类型检查与生产构建通过（22.16s，有已有大包警告）。截图 `tools/wiki-runtime/site-shell/chapter03-rms-computation-1600.png` 与 `chapter03-rms-computation-390.png`；日志 `rms-computation-final.log`、`rms-computation-build.log`。视觉仍待用户评价。
>
> **2026-10-10 嵌入式 3D 播放：** 用户认为上一版“稍微好点”，要求直接嵌入可播放、可旋转的 3D，并改善线条。保留第 03 章图文布局；三处矩阵已加播放/暂停、可拖动进度和复位视角，每次演示所选词的当前运算，前馈四步分别播放。直接复用母版 `grow/front` 逐步生成输出；RMS 扫描输入、mHC 四路贡献与对应流高亮联动。旋转改用母版同类 `OrbitControls`，播放时可自由拖动，不驱动镜头，也不跳整模型播放器。细化连接线、取消粗箭头，计算时沿路径显示运动点；进度条同样收细。离屏/切换标签页暂停，换词/通道/前馈步骤回到完整结果。
>
> **本轮验证：** 13 项相关单测、4 项浏览器检查通过，包含前馈四步播放、暂停不推进、拖动进度改变 3D 画面、旋转与复位、离屏暂停及桌面/390px/900px 布局；IAB 实际点击播放成功。类型检查、7 文件 Biome、生产构建通过，仍有已有大包警告。截图 `tools/wiki-runtime/site-shell/chapter03-embedded-playback.png`、`chapter03-embedded-mobile.png`。只涉及第 03 章局部演示，未修改母版；本轮视觉仍待用户评价。
>

> **2026-10-09 最新视觉要求（优先于旧方案）：** 用户继续否定上一版，明确回答“3D 本身与整页组织两者都是，要整体重新设计”。这轮仅重做第 03 章：去掉矩阵外的大卡片，宽屏正文与图并排，窄屏按引言、图、详细讲解顺排；沿用 Wiki 字体与段落样式。输入蓝、输出青、参数金，颜色统一定义在 `tokens.css`；母版仅校准模型和计算，不锁定配色、构图。RMS 改成左右输入/输出、γ 紧邻输出，保持形状和通道轴相同；使用正交 3D 相机，避免同形状因透视产生大小差异。三处图均可直接旋转、取值、选词，公式跟随更新；FFN 四步在原位切换，mHC 仍表示真实四流深度。未修改母版、其余章节或加入播放器跳转。
>
> **本轮验证与状态：** 相关单测 12 项、桌面/390px/900px 浏览器检查 3 项通过（包括旋转不误选、前馈四步、标签边界、计算结果与连续教学数据一致）；类型检查与生产构建通过，10 个修改代码文件 Biome 通过，IAB 实际打开并拖动验证。构建仍有大包警告。当前截图为 `tools/wiki-runtime/site-shell/chapter03-editorial-desktop.png` 与 `chapter03-editorial-mobile.png`；旧 `chapter03-3d-final.png` 是被否定的上一版。**本轮视觉仍待用户评价，不把测试通过记作用户认可。**
>
> **2026-10-09 正文装配方式：** 用户再次否定“正文中播放母版片段”：需要直接拆用母版的矩阵、张量和计算零件，由正文讲解决定如何组合；排版直接复用 LLM-Wiki。第 03 章现改为 `CourseChapter03Page`，使用现有 `wiki.css`、`CalcBlock`、`PageToc`；不挂整模型 iframe、不调用整段播放器。`src/app/course/MatrixPart.tsx` 在 RMSNorm、门控前馈、四路读入处分别按需组合母版矩阵，支持选词、选通道、前馈运算切换。连续教学数据来自已发布母版模块，只有 `flow-look.js` 的 Three 导入地址经过发布适配，原母版未改。已移除第 03 章的旧片段播放配置和 `from=mix` 适配。22 章保留；仅此页试做，其他章节未批量改版。LLM-Wiki 仍仅为独立导航入口。
>
> **2026-10-08 当前课程整合已被用户否定：** 用户明确反馈正文“完全偏离愿景”“非常割裂”。上一轮 22 章重写、表格和段落 iframe 均仍是未获接受的实现，不能凭测试通过标为教学完成，也不能把助手新增布局规则当成用户定稿。已回查 `PLAN.md` §1.3、`DESIGN.md` Overview 与模型母版已定 A1–A3：详细讲解需要带出前置概念和因果，左文右图围绕同一物体、同一批 token 连续推进，模型与硬件按步骤对应。当前缺的是共同对象、共同进度与讲解铺垫；不是继续增加字数。这轮仅纠正状态记录，未改动页面或回滚母版。先用完整的一章核对学习过程，避免再批量扩写 22 章。
>
> **2026-10-08 整站骨架：** 用户确认恢复 22 章，LLM-Wiki 仅作独立入口、不出现在课程正文。首页、课程目录、GLM 和硬件的接入范围、快照同步与验证见 [站点骨架说明](docs/plans/site-shell-integration.md)。下方“静态十章目录”“表现层待定”等为历史记录。
> **同日纠正：** 首轮接入混入早期 A2 单模组试作，且页面割裂。现只使用用户认可的 `whole/` 硬件母版；章节和演示共用浅色目录与首页风格，演示保留章节路由。勿恢复旧 `experiences/index.html`。
> **同日内容与排版修订（最新）：** 已去掉“云隐”，课程、模型、硬件、LLM-Wiki 四个入口常驻左侧；首页和手机使用两列入口卡片。22 章基础正文位于 `src/content/course/`，每章有讲解、算例、自测答案和小结，内部来源不渲染到正文。课程总览只列一次 22 章，阅读页增加本章定位目录。13 项浏览器检查、4 项内容/快照检查、类型检查、Lint 与构建通过。逐章专属动画、模型/硬件逐步联动和模型工作台仍待实现，不能把基础正文接入等同于全站最终验收。
> **同日字体校正：** 主站和演示共用 `public/experiences/font-families.css`，iframe（包括 GLM 内层画布）独立加载自托管字体。首页品牌和硬件展示标题保留宋体；课程标题、目录、正文与控件统一 Inter + Noto Sans SC。修正手机 6.5px 小字与浅色文字对比度。同步脚本已纳入字体接入，勿直接修改快照后忘记同步规则。
> **同日模型发布清理：** 已根据“查看 data-claude 压缩包”末次交付保留 45 层 / 40 段连续计算版，移除调色及旧外观试样。`scripts/model-release.mjs` 在同步时固定母版 `PALETTES.user`，不读取旧浏览器调色；不要恢复 `flow-tune.js`。播放、分层探索和真实长度开关保留。两项浏览器回归、三项快照检查、类型检查、Lint 和构建通过；未重播全章全部拍子。
>
> LLM WIKI 已合入本仓库 `main`，当前状态见 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)。以下保留首页 / 城市背景等其他工作的历史项目背景，其中的旧 Wiki 状态已过期。

# 交接说明（主干：首页与教学表现层）

## 当前开篇：大模型推理之旅 · 城市背景

用户随后提供新的服务器城市参考图，要求换风格，并强调性能。首页已切换为 `src/app/intro/cityScene.ts` + `src/design/city.css`：GPU / NPU 地标、服务器楼群、互联高架、海湾与观景台。源文件是 `assets/city/compute-city.blend`，网页只加载 `public/models/compute-city.glb`；配置真相源是 `src/app/intro/city.json`。建模与性能约定见 `assets/city/README.md`。当前标题为“大模型推理之旅”，已移除“云隐”；左侧为四个站点入口和可点击的 22 章目录，课程数据使用 `src/content/chapters.ts`。此前已移除悬浮地标、点击拾取、镜头拉近和硬件详情面板，手动旋转/缩放与环游保留。性能修复：移除手动拖动的 30 FPS 节流，自动环游独立限帧；绘图缓冲最多 250 万像素；默认镜头距离增加 25%，JSON 与 Blender 源相机已同步。

## 上一版：开篇山境（本地草稿，未纳入当前版本）

用户最初提供云海悬山参考图，授权 Blender + Three.js 开篇。该版源文件、模型及生成脚本仅在原工作区保留，未纳入当前城市版本；全新检出无需这些草稿。`src/app/intro/world.json` 中的十境数据仅供历史山境使用。

新会话读这一页了解**现在在哪**，读 `PLAN.md` 了解**要去哪**（总体大纲：22 章、工作台、架构、M1 任务表、里程碑），再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`。

## 现状（一句话）

**首页与教学表现层的下述记录保留历史背景（现行 `main` 已包含首页 3D 城市 `src/app/intro/cityScene.ts`、19 篇概念页内嵌 `wiki-scene` 3D 场景 `src/app/wiki/WikiScene.tsx` 与 `src/app/wiki/scene-*.ts` 以及模型/硬件辅助探索入口，且现有 3D 当前保持冻结）；LLM WIKI F001–F005 已完成并合入 `main`，当前知识库状态见 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)。** 2026-09-06 用户把我做的全部 3D 画面（`src/viz3d/`、`#/lab`、`#/model`、Spike A/B 页、3D 字体子集、three.js 依赖）整体删除（提交见 `git log`，可找回但不要找回）。原因：三版画面都被否："幻灯片"、"怎么能这么丑"、"平片图/一坨屎"。地基（`src/sim/`、`src/timeline/`、页面配色字体、播放条）完整保留，全部测试通过。

## 知识库 F001–F005（已合入 main）

**这一节不维护知识库的状态。** 验收状态看 `docs/features/F001-llm-wiki.md`–`F005-wiki-drop.md` 各自的验收表；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)；页数、预算、待审数这类会变的数字按它 §2 的命令现查；实际花费以 `pnpm wiki:budget status` 为准。设计依据与历史发现留在五份 feature 和 `docs/plans/`，09-10 至 09-18 的逐轮报告在 [docs/plans/archive/](docs/plans/archive/README.md)。

**目标**：agent 写、人只审、进 git 的课程知识库，学习者在 `#/wiki` 问名词就有基于知识库的回答。规则唯一真相源是 [wiki/HANDBOOK.md](wiki/HANDBOOK.md)，按六个二级标题切片注入不同角色的 agent（映射表在 `scripts/wiki/handbook.ts:9`）。命令清单见 `package.json` 的 `wiki:*` 脚本。

**踩过的坑，别再踩**

- `--allowedTools` 在 `-p` 无人值守模式下是**白名单**不是免确认表。放开联网要两步：从黑名单拿掉、往白名单加上，只做前者等于没做。
- 越界守卫只删**本批新建**的文件。它曾把 `wiki/HANDBOOK.md`（规则唯一真相源）当越界写入删掉，并让 11 个正常 agent 全判失败——那次改动来自引擎外部，agent 根本没有写它的权限。
- **`TaskStop` 只杀外层 shell，`claude.exe` 子进程会活下来继续写文件**。要停 ingest 用 `taskkill /pid <pnpm 的 pid> /t /f`。
- 定性规则（「只留三类」「删到合理密度」）实测不落地，**换成硬指标并由引擎算好数字写进任务**才有效——标记数与事实表行数都是这么治住的。
- 整合 agent 没有 `--add-dir` 也不能联网，它只读草稿与现有页。所以它能发现**页与页之间的矛盾**，发现不了**页与源码之间的偏差**（实测漏掉一处过度概括）。要抓后者得扩 `wiki:audit` 或加一个能读源码的核对角色。
- 正文不走 `rehype-raw`：裸 HTML 标签与 `<!-- 注释 -->` 都会原样显示在页面上。`stray-tag` 规则管这个。
- 别用 python heredoc 写含 `\n` 的 TS——反斜杠会被吃掉，正则和字符串都会断。用 Edit 工具。

## 地基有什么（全部有测试，不要动）

| 位置 | 作用 |
|---|---|
| `src/sim/modelspec/` | 解析 HF `config.json` → `ModelSpec`（全站唯一形状来源）；内置 Qwen3-0.6B / 8B / 30B-A3B；参数量与 KV 字节分析 |
| `src/sim/model/forwardLayer.ts` | 真实维度的一层前向 21 步（每步中文 brief/detail/公式、lineage、高亮、证据）；权重按哈希惰性生成 `[A01]` |
| `src/sim/hardware/` | 昇腾 910B 概念剖面：13 种算子的驻留/搬运规则，`buildHardwareTimeline` 把硬件层填进每一步 |
| `src/sim/model/presets.ts` | 三句预设句的真实 Qwen3 tokenizer id（生成物，`pnpm gen:presets`） |
| `src/sim/model/traces/` | 真实 Qwen3-0.6B（ONNX q8）贪心生成 12 token 的 top-10 概率 trace `[M]`（`pnpm gen:trace`） |
| `src/timeline/` | 播放引擎：zustand 离散状态 + 瞬态 `progress.t`、Worker 构建时间线、快捷键、URL 深链接、reduced-motion |
| `src/app/PlaybackBar.tsx` | 播放条（DOM，播放期零 commit） |
| `src/app/pages/dev/SpikeCPage.tsx` | 播放引擎验收页 `#/dev/spike-c`（纯 DOM 进度条），Playwright `tests/spike-c.spec.ts` |
| `src/design/tokens.css`、`DESIGN.md` | 暖白纸面 + 深色课程轨道的页面配色、字阶、圆角；无 3D 条目 |

## 已确认决策（不要再问）

- 教学章一律真实模型尺寸（默认 Qwen3-0.6B），`ModelSpec` 唯一形状来源；权重不下载，哈希生成。
- 页面风格：暖白纸面、深色 248px 课程轨道、很重的显示体标题、橙色唯一行动色（沿用旧 infra-view 的观感，不复用其代码）。
- 用户要的体验：Transformer Explainer 的横向流水线总览 + AnimatedLLM 的逐 token 生成与概率分布 + bbycroft 式"一个模型是一个物体、镜头在里面飞"。文字极少，靠悬停。
- **画面怎么做还没有定，而且不许再由 AI 自作主张地"先做一版看看"**：用户对三版画面的否定都指向同一点，就是我画的是示意图，不是物体。下一次动画面之前，先和用户一起用参照物截图逐条定"画面纪律"，拿到明确的 yes 再写代码；先出静帧，批准前不写动效。
- 其余历史决策（技术栈、事实基线、硬件、工作台范围）见 `PLAN.md`（已从 `~/.claude/plans/` 移入仓库并按现状更新）。

## 下一步

阻塞在 `PLAN.md` 的 **Spike S1：定表现层的画面纪律**。和用户一起对着参照物截图定规则，写进 `DESIGN.md` 并经用户确认，才能写画面代码。

不依赖画面选型、可以先做的（是否先做由用户定）：内容管线与 `03` 章正文（PLAN 任务 10、12）、模型工作台页面（任务 13，数字引擎已就绪）。

知识库 F001 走的是独立分支，不受 Spike S1 阻塞；术语注册表（PLAN 任务 10 需要的 `<Term id>` 数据源）已由它的 `src/content/wiki/registry.json` 提供，不必另建 terms 表。

**暂时没有消费者但保留的代码**（表现层或工作台页面重建后会用到，都有测试，不要当死代码删）：
- `src/sim/timeline/plane.ts` 的 `planeView`：张量到二维视图的轴选择规则。
- `Step.camera`、`Step.beats`：步的镜头与子节拍字段。
- `src/sim/modelspec/analyze.ts` 的 `analyzeParams` / `weightBytes` / `fmtBytes`：工作台数字引擎，等 PLAN 任务 13 的页面。
- `src/sim/model/traces.ts` 的 `GENERATION_TRACES` / `getTrace`：真实生成 trace，等 token 生成条。
- `src/timeline/index.ts` 导出的播放引擎 API：目前只有 `#/dev/spike-c` 一个消费者。

## 工作区约定

- **不是 AI 写的文件一律不动**（用户 2026-09-06 明确要求）。仓库里属于用户的东西：`GLM5_Next_3D_Source.zip`（GLM-5-Next 3D 可视化源码包，含 HTML/OBJ/JSON/shader）、`parallelism-teaching-dark-png.zip` 与 `reference/parallelism-teaching-dark/`（并行策略教学图包）。只报告，不处置。
- 可再生、可随时清的：`dist/`、`test-results/`、`tsconfig.*.tsbuildinfo`（已 gitignore）。
- 重下代价大、不要随手清：`tools/hf-cache/`（598 MB，gen:trace 的模型缓存）、`tools/tokenizer/`（11 MB，gen:presets 的词表）。两者都已 gitignore。
- `tools/repos/`（wiki 的来源仓库浅克隆，已 gitignore）：删了可以用 `pnpm wiki:clone` 重建，但要重新下载；里面是只读的上游代码，任何情况下不要在其中改动或提交。
- 空目录 `src/viz2d/`、`src/content/` 是分层占位，`scripts/check-deps.ts` 的层序引用它们，别删。

## 验证基线

- main（2026-09-06 深夜，删除 3D 之后）：`pnpm check` 126/126（12 个测试文件）；`pnpm build` 通过；`pnpm test:e2e` 3/3（只剩 spike-c）。
- `feat/llm-wiki`（2026-09-07）：`pnpm check` 168/168（20 个测试文件）；`pnpm build` 通过；`pnpm wiki:lint` 与 `pnpm wiki:audit` 通过；`pnpm wiki:build` 幂等。
> **2026-10-24 04:36 当前：context 恢复已启动，整轮仍未验收。** binding 已于04:22:53在检查点退出exit1（66项含跳过、3失败），旧49796/63188已退出。跨段重复的真实根因是后续片段看不到此前已接受修改；现增加预算受控、可恢复的已有修改上下文，不能作为新证据，不丢最终正文。先红2、再4文件33项、完整166文件1336项、类型/构建/Lint通过，见 section-context-root-cause-20261024.json；实际模型效果仍待新回执。04:34:42启动 failed-worker-recovery-context-20261023.ps1，wrapper64816/node21372，父子命令已核，仅原177项/142页、同页串行并发3、daily-lease，无发布。启动前原177为44待审、20旧版本已变化关闭、113失败；新报告处理数含跳过，不能当模型成功。当前以context报告/process/exit/err、last-run及original177-context-live为准，勿重复启动。
>
> **纠错与验收：** KV块分配、balance、DP及Dyntra、EPLB、CPU offload六份已手工修正、独立逐源复审并严格staging成替代pending。两批原问题包及三个中间版本均rejectReview留史、payload未改、队列指向修正版；回执 binding-corrections-retired / binding-later-corrections-retired-20261024.json。后组三份88/88 raw摘录逐字对照固定源码通过，新增事实仍保留适用边界。DP最终75b80f9c…已在用户已有IAB实际查看正文diff、100ms非固定周期修订及待审状态，截图 dp-corrected-pending-ui-20261024.png；无发布、未碰问答输入。严格审计51有效新正文、50问题/替代历史、0结构及正式基线错误。新增layers-and-hidden、collective-communication、kv-cache-sparse-offload、lm-head、large-scale-ep、gqa由现有review_pending_corrections独立读源，报告binding-final-bodies-independent-20261024.json，尚未语义通过。
>
> **待继续：** dynamic新raw两段（额外缩进/667字符）、fine-grained-tp引文拼接、kvpp首段612字符三项真实失败仍须核新恢复；成功材料段及原失败均保留。不要把旧JSON恢复当这些新问题解决。新context改变实际分段输入身份，不保证复用旧section调用；已完成任务跳过、raw检查点仍可复用。共享snapshot/lint无效先停安排，不覆盖他人编辑。新稿全部待审；整队列真实结局、逐源教学及UI验收未完成，每日03:00定义不改，临时跟进继续，完成后才删除。

> **2026-10-24 05:42 当前：context-index 已启动，整轮未验收。** 05:39:08 启动 wrapper37156/node60928，实际 CIM 命令及 daily-lease 已核；只原177任务/142页、同页串行并发3，不发布。旧 context-memory 已05:34:51检查点退出（exit1、74项含跳过/2失败），39568/22892已实际消失，不能按旧running处理。最新结局查 `check-context-recovery-state-20261024.ts --context-index`，新回执 `failed-worker-recovery-context-index-20261023.json` / process / exit / err。启动前49待审、23正式版本变化关闭、105失败；关闭和跳过不算模型成功。
>
> 确定性已接受修改索引已先红后绿并独立审查：4文件38项、完整166文件1341项、类型/构建/Lint通过，最终 `context-index-final-full-suite-exit-20261024.json` exit0。原始边界失败日志保留。新协议的实际输入核验用 `audit-context-index-real-inputs-20261024.ts`，05:40尚无匹配模型调用，不能声称真实防重复已通过；此索引仍有明确容量与语义限制。
>
> KVPP、LoRA、fine-grained-tp、pipeline-parallel四份修正版已逐源独立复核、严格stage为pending，旧包rejectReview留史且payload原样；见 `context-kvpp-correction-retired`、`context-memory-lora-correction-retired`、`context-final-corrections-retired-20261024.json`。pipeline两项P2（历史空行、条件措辞）已复审关闭，决策/历史由引擎重生；独立基线hash曾误用LF口径已改真实bytes，严格校验未放松。05:39正文审计56有效/59历史/0结构及正式基线失败。LoRA新6b8eb534已在已有IAB实际打开pending正文diff，来源32缓存未命中或load_inplace条件及历史可见，`lora-corrected-pending-ui-20261024.json/png`与body截图；未发问、未审批。
>
> 新Prefill34c5ab77独立发现4P2：新增插断表、重复、44角标、DecodeOnly分支条件漏述，尚不能验收；review_pending_corrections正在准备手工候选，父须独立复核，不能为stage抢运行worker锁。见 `context-memory-prefill-independent-20261024.json`。npu-model-runner原raw首段668字符失败及其余2段保留、dynamic原raw3/3已恢复但新prior-edits引文非逐字，见 `context-memory-material-failures-20261024.json`；继续核既有自适应恢复实际回执，不盲重跑。其他历史/每日03:00/旧69审批边界不变。全部完成后仍须原177逐项结局、pending及正式基线、逐源与UI实际验收，才报告成功并删除临时跟进。

