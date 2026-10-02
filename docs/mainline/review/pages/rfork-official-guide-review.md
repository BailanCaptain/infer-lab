# rfork-official-guide 审查记录

## P5 写作记录（2026-10-02，第 21 批小修）

本页是来源核读页，小修：沿用原有 8 个 H2，不套教学页骨架；没有图（队列写「沿用现有图」，本页原本只链接官网 Flowchart 原图并逐项读图，未新增 yaml）。只改了 wiki/sources/rfork-official-guide.md，未碰其他页、图、代码，未提交 git。

### 改了什么

- 一句话：去掉「用户指定的」「便于站内 Agent 离线追溯」这类 meta 说法；补一句 RFork 是什么 + 链到总览，不重讲；把 frontmatter 字段名 `verified: rfork:main` 改成读者能懂的「已核只指工作版代码」；新增一段说明社区三版本与工作版的逐补丁对照只在总览 `rfork.md#版本差异`，本页只比官网 latest 与工作版（验收要点「来源页仅链接版本表」）。
- 小节对照表：Flowchart 行链到总览 `#三条通道协调清单字节各走各的`；Tested Models 行链到本页模型表锚点。
- 差异表「成功日志」行：补上结束行还带 elapsed、throughput 两个字段，官网要找的耗时就在 elapsed 里（transfer_backend.py 783–792 行）。
- 新增「工作版自带指南也没跟上代码」一段：自带指南在申请时机（指南 102 行）、哈希式 key（252 行）、租约未还延期发布（104 行）上和代码一致；但成功日志仍写旧两条（293 行），端口仍写随机分配（381 行）且配置表里没有 rfork_seed_port_base。代码：session.py 364–375 行按 base + global_rank 算端口，0 才随机；config.py 63、79–81、132 行解析该字段。
- 量化一节：给初学者补 MLA 背景——缓存存压缩向量，kv_b_proj 把它投影回各头的 Key（不含 RoPE 部分）和 Value；按 sfa_v1.py 708–720 行写清 W_UK_T 来自 Key 段（permute 后 contiguous）、W_UV 来自 Value 段（transpose 后 contiguous），已有时 copy_。链到 kv-cache、mla。「详见布局与内存页」改为链到布局页和传输页（rfork-memory 页已并入传输页，不再单独存在）。
- 模型表一节：`wiki/TERMS.md` 文件路径改成可点的量化、投机解码链接；新增 GLM 一段（数字取自 01 §A0.8「适用条件」：官方 GLM-5.3-Flash 教程无 RFork、测试表无 GLM-5.3-Flash W8A8、工作版树无 GLM 模型实现），只链总览 `#这套部署现在能不能受益`，不重算每卡字节。
- 证据一节：剩余缺口改成四条「待核：缺什么」（Ex 注册范围、native finalize 对在途读者、量化/MTP 数值与启动收益、官网 09-22 后是否改过）。
- frontmatter：summary 改写（约 100 字）、updated 改为 2026-10-02。

### 核心说法对照的源码（本轮实际读过的行）

工作版 rfork@3284850b，路径相对 vllm_ascend/model_loader/rfork/：
- 先搭后借：rfork_loader.py 573（initialize_model）→ 601–603（processed 路径先后处理并 synchronize）→ 612（acquire_seed）→ 623（transfer）。
- 参数校验早于 try：rfork_loader.py 418（__init__ 里解析配置）、config.py 75–81（ValueError）；load_model 的 try 在 563 行。
- 清理安全门：rfork_loader.py 660–669（cleanup 失败抛 RuntimeError，不回退）。
- 发布延期：session.py 60、202–241（_deferred_seed_start 与租约释放后 promote）。
- seed key：identity.py 193、251、287 三处 sha256；全目录 grep 无 rfork_seed_key_separator 读取（只有 json 的 separators 参数）；146–157 行指纹含模型 revision，不含 RFork 代码提交。
- 依赖：transfer_backend.py 207–217（从 yr.datasystem 导入 TransferEngine、MemoryRegistration、ErrorCode，失败抛 ImportError）、222（initialize 传 "ascend"）、405–422（batch_register_memory_ex）、584（finalize）、760（batch_transfer_sync_read）。
- 日志：transfer_backend.py 753（starts 仍在）、785–791（completed 行含 elapsed、throughput）；rfork_loader.py 655（RFork transfer failed）。
- EPLB 与混合设备：rfork_loader.py 373–382（动态 EPLB 判定）、540；transfer_backend.py 292（拒绝混合设备）；全目录 grep 无 layer_sharding。
- 官网列交叉核：社区 main baa023ad 的 docs/source/user_guide/feature_guide/rfork.md 49（separator 默认 $）、78（两条旧日志）、102（openyuanrong-transfer-engine）、153（端口随机）、154（动态 EPLB caveat），与本页「官网当日说明」列一致。官网 latest 网页本轮没有重新打开，沿用 09-22 核读。
- GLM 前提：vllm-ascend@0576b647 的 GLM5.3-Flash 教程 grep rfork/load-format 计数为 0；rfork 树 vllm_ascend/models/ 下无 glm 文件。

### 旧版信息清单勾选

清单在 scratchpad\p5\rfork-official-guide-facts.md，共 19 条，现版 = p4-checkpoint。19 条全部仍在本页：第 1–3 条在一句话（措辞改为面向读者）；第 4 条小节表；第 5–9 条原图一节（未改）；第 10–12 条差异表与其后两段（日志行补字段，新增自带指南一段）；第 13–14 条量化一节（扩写）；第 15–16 条模型表一节；第 17–18 条改代码一节（未改）；第 19 条证据一节（改成待核列表，四项缺口都在）。无删除项。

### 字数与校验

- 字数（measureStandard 口径）：改前 2930，改后 3179。行内代码 28（8.8/千字），角标 30（lint 阈值 30，未超），calc 0。
- pnpm wiki:lint 通过（本页无报错、无待留意）；pnpm wiki:diagrams --check 284 张一致；pnpm wiki:audit 通过。
- 浏览器：Playwright 只读打开 http://localhost:5193/#/wiki/rfork-official-guide，8 个 H2 正常渲染，新加的版本差异、三条通道、模型表、GLM 双机推演四个链接 href 正确；截图在本会话 scratchpad（rog-top.png、rog-models.png）。

### 取舍与疑点

- 身份、配置、布局、维护四页正被其他写手改，本页对它们只做页级链接，不链节锚点，避免对方改标题后本页断链；等那几页定稿后可把「配置页的只读检查」「四类端口」「验收项」改成节锚点。传输页讲内存登记那一节的标题带「原 rfork-memory 页」字样，可能会改，也只做页级链接。
- 参考图库（refs）只适用于通信原语与 TP/DP/EP 页，本页是来源核读页，未查看。
- 来源：未新增来源条目。新段落只标 [S15]（工作版自带指南）；用 awk 只数出 S15 的序号，把它的行号范围从 L320-L325（只盖安装命令）放宽为 L102-L381，盖住本段引用的 102、104、252、293、381 行；audit 行号校验通过。代码侧说法沿用差异表同行已有的 C8、C12。
- 跳过：frontmatter sources 区除 S15 那一行外未读；HANDBOOK、docs/plans 未读。

## P5 审查（09-29）

审查日期 2026-10-02，独立审查员（只审不改页面）。本页 type: source，按来源核读页审，不套深入页骨架；任务以 p5q/21 队列行与验收要点为准。

### 结论

- 分数：**8.8 / 10**。P1 0 条，P2 1 条，P3 6 条。
- 学习顺序：通过。「一句话」先交代本页做什么（官网管用法、代码管行为、对不上逐条并列），再用一句话说 RFork 是什么并链总览，不重讲；没有一上来堆 GLM 数字，GLM 只在模型表一节出现且不带独立数字。
- `pnpm wiki:audit`：本页通过（138 页全过，本页 evidence=C、8 节、来源 16 条）。`pnpm wiki:lint`：通过，本页无报错、无待留意。
- 初学者测试（前两屏）：这页是拿英文官网 RFork 指南逐节对照工作版代码的核读记录，告诉你官网每节在本章哪页展开、哪些说法和代码对不上；代价是官网和自带指南都不能直接当排错依据，要以代码为准。

### 任务要求逐项核对

- 挂靠 A0·来源、依赖 rfork：一句话段链总览（页面第 69 行），版本差异只链总览 `rfork.md#版本差异`（第 75 行），符合「来源页仅链接版本表」。总览第 296 行 H3 版本差异确为全章唯一版本表。
- 数字取自 01 §A0.8、无独立双机数字：第 147 行三条前提（测试表无 GLM-5.3-Flash W8A8、官方 GLM 教程无 RFork、工作版树无 GLM 模型实现）与 01 第 506–516 行「适用条件」一致；每卡字节只链总览，没有重算。
- 直觉图沿用现有：本页原本只链官网 Flowchart 并逐项读图，未新增图，符合「沿用」。
- 「身份、配置、布局各管自己的锚点」：本页对三页只做页级链接，没有重讲它们的机制细节；差异表里的 seed key、端口内容是「官网 vs 工作版」差异本身，属于本页职责。写手因三页并行在改而不链节锚点，可接受（见 P3-6）。
- 写手记录所列改动（去 meta、日志行补 elapsed/throughput、自带指南也落后一段、MLA 背景、TERMS 路径改链接、GLM 段、待核列表、summary/updated）在现文第 69–75、82、88、119、122–124、130–132、145–147、159–166 行均已落实。

### 官网/自带指南与工作版源码对不上处是否标出（逐条对照源码）

源码取自 tools/repos/rfork 的 3284850b（manifest.json 第 55 行登记的工作版 patchCommit）。

- 成功日志（第 119 行）：transfer_backend.py 第 753 行仍打 starts；第 785–791 行结束行含 weights/chunks/bytes/elapsed/throughput。全 rfork/source 下 grep 不到旧的 time 日志。「官网要找的耗时就在 elapsed」：对照社区 main baa023ad 的 transfer_backend.py 第 621、661–662 行，旧 time 与新 elapsed 都从 starts 前的 perf_counter 量到循环结束，口径相同，说法成立。正确。
- 端口（第 116、124 行）：session.py 第 364–378 行按 base + global_rank 算端口，base 为 0 走随机；config.py 第 63、79–81、132 行解析 rfork_seed_port_base。正确（溢出细节见 P3-2）。
- 自带指南也落后（第 124 行，新增）：工作版自带 rfork.md 第 102 行（初始化与布局早于申请租约）、104 行（租约未还延期发布）、252 行（SHA256 不透明 key）与代码一致；第 293 行仍写两条旧日志、第 381 行仍写端口随机，全文无 seed_port_base。逐条属实，且明确写成「以代码为准」。
- separator 不读（第 115 行）：rfork 目录 grep 无 rfork_seed_key_separator。正确。
- 申请时机（第 114 行）：rfork_loader.py 第 573 行 initialize_model、603 行 synchronize、612 行 acquire_seed，先搭后借。正确。
- 派生权重（第 130 行，扩写）：sfa_v1.py 第 708 行按 qk_nope_head_dim / v_head_dim 拆 kv_b_proj，第 715、717 行分别 transpose / permute 后 contiguous，第 719–720 行已有时 copy_。「Key 不含 RoPE 部分」与 qk_nope 一致。正确。
- 推断是否写成定论：图上不能证明绕过 CPU 暂存（第 108 行）、layer_sharding 不能反推已实测（第 126 行）均带 [I] 并明确限定；两包可互换明确不断言（第 122 行）；现场缺口改成四条「待核：缺什么」（第 163–166 行）。未见把推断写成定论。

### 丢信息核对

- `git diff` 删除行逐条看过：旧 69/71/73 行的范围、日期、latest 可移动、不推定构建提交、已核口径、社区固定提交仅供离线对照，均在新 69–73 行；旧 117 行日志行在新 119 行并扩充；旧 120 行安装命令在新 122 行；旧 126/128 行在新 130/132 行扩写；旧 141 行「MTP、dtype、scale 见 TERMS」改成 MTP 正文解释 + scale 链量化页，dtype 一词去掉（BF16 已解释为浮点格式，不算丢）；旧 153/155 行在新 159–166 行。
- 旧版信息清单（旧会话 scratchpad\p5\rfork-official-guide-facts.md）存在，19 条全部到新版核对：第 1–3 条在第 69–73 行，第 4 条第 81–90 行（十行十条边界都在），第 5–9 条第 94–108 行，第 10–12 条第 114–126 行，第 13–14 条第 130–132 行，第 15–16 条第 136–149 行，第 17–18 条第 153–155 行，第 19 条第 159–166 行。写手勾选属实。

### 链接与锚点

- 出链：总览三个锚点（三条通道、这套部署现在能不能受益、版本差异）在 rfork.md 第 129、246、296 行存在；rfork-startup / identity / config / layout / transfer / lifecycle / maintenance、kv-cache、mla、quantization、speculative-decoding 文件均存在；页内锚点「官方已测模型不等于本工作版已验收」对应第 134 行 H2。rfork-memory.md 已不存在，本页不再链它。
- 入链：rfork、rfork-config、rfork-layout、rfork-maintenance、rfork-troubleshooting、index 共 10 处，全是页级链接，无锚点依赖。

### 浏览器

写手截图在本会话 scratchpad（rog-top.png、rog-models.png，1440 宽），已看：标题、徽标、一句话、小节表、模型表与 GLM 段渲染正常，链接为站内红色链接样式。

### 问题清单

**P1**：无。

**P2**
- P2-1 meta 文本残留。位置：第 155 行末句「本页没有替用户执行任何服务重启」。问题：这是写作过程的自述，不帮读者理解；写手清掉了一句话段的 meta，这句漏了（按派发口径 meta 文本算 P2）。改法：删掉该句；如需保留边界，前一句「不应在仍有活动传输时把清空账本当成释放内存的证明」已足够。

**P3**
- P3-1 第 116 行「patch7」先用未讲，初学者不知道是什么。改法：改成「工作版」或加括注「工作版所在的第 7 个补丁」并链总览版本差异。
- P3-2 第 116 行「端口 0 时才由 OS 随机分配」的「才」不严：session.py 第 370–378 行 base + global_rank 超过 65535 时也会退回随机端口并打 warning。改法：补半句「或超出 65535 时」，或链配置页四类端口一节。
- P3-3 第 130 行「（稀疏注意力的一种，见总览）」的「总览」没有链接。改法：加链接，或直接链 sparse-attention 页。
- P3-4 第 147 行链接文字说「能不能受益、每张卡借多少」，但锚点只到 H3「这套部署现在能不能受益」（总览第 246 行）；「每张卡读多少」在第 222 行 H3。改法：链到上层 H2「放到 GLM 双机」。
- P3-5 第 147 行「官方 GLM-5.3-Flash 部署教程的命令里没有用 RFork」未注明核的是哪个版本（01 写的是 vllm-ascend@0576b647 的教程 grep 计数为 0），而本页别处严格区分 latest 网页与固定提交。改法：括注「社区仓库 0576b647 版教程」。
- P3-6 S15 行号范围从 L320–L325 放宽到 L102–L381，第 122 行安装命令那处引用精度下降；另外小节表第 85、86、89 行「配置的完整参数表」「身份的规范化、指纹、rank」「配置的 Linux 命令和四类端口」是无链接纯文本。改法：S15 拆成安装命令一条、指南落后一条（角标总数不变）；待 identity / config 定稿后把这几格改成节锚点（config 现有「十一项设置」「四类端口」「怎样验收」等 H2，identity 有「钥匙怎么算」「部署指纹里写了什么」）。

### 跳过

frontmatter 来源区未读（只 grep 了 title/summary/updated/type/evidence 行和 0576b647 计数）；HANDBOOK、docs/plans 未读；未起停 5193/8790，未另行截图（用写手现成截图）。无被拦段落。

## P5 修订记录（10-02）

逐条对应上面「问题清单」：

- **P2-1 已改。** 删掉「改代码后」一节末句写作自述（本页没有替用户执行服务重启），前一句「活动传输时清账本不等于释放内存」保留为边界。
- **P3-1 已改。** 差异表端口行「patch7」改为「工作版（第 7 个补丁起，见版本差异）」，链到 `rfork.md#版本差异`。
- **P3-2 成立，已改。** 复核 rfork@3284850b `session.py` 367–378 行：基数 > 0 时加 global_rank，和超过 65535 就打 warning 并把端口置 0（改由操作系统分配）。端口行改为「基数为 0，或两者相加超过 65535（此时打一条 warning）时，才由操作系统随机分配」。
- **P3-3 已改。** 「稀疏注意力的一种，见总览」改为直接链 `sparse-attention.md`（该页是 sparse attention 的概念页；SFA 这个缩写只在总览一句话里出现，链概念页对初学者更有用）。
- **P3-4 已改。** 链接改到上层 H2 `rfork.md#放到-glm-双机再起一个同构实例每张卡借多少`，链接文字顺序改成「每张卡借多少、能不能受益」，与 H2 下两个 H3 对应；lint 锚点校验通过。
- **P3-5 已改。** 补括注「社区仓库 0576b647 版」；本轮复核 `git show 0576b647:docs/source/tutorials/models/GLM5.3-Flash.md | grep -c -i 'rfork\|load-format'` 输出 0。
- **P3-6 已改（第二半按审查自己的条件分步）。**
  - 来源拆分：S15 恢复为 `rfork@3284850b:…/feature_guide/rfork.md#L320-L325`（只管安装命令）；新增第 17 条 `#L102-L381`（指南落后于代码那段），该段角标由 [S15] 改为 [S17]。正文角标总数仍为 30，来源 16 → 17 条，audit 行号校验通过。
  - 小节表无链接纯文本：第 86、87、90、91 行四格都加了页级链接（配置的十一项设置表、身份的两次哈希/部署指纹/分片编号、配置的启动命令和四类端口、配置的依赖与限制），措辞按两页现有 H2 对齐。**改成节锚点这一步暂缓**：两页 review 文件目前只有「P5 写作记录」、还没有审查结论（identity 05:22、config 05:21 仍在改），审查给的条件是「待定稿后」；现在链节锚点，对方修订改标题就会让本页断链、整站打不开。待两页审查通过后把这四格换成对应 H2 锚点。

### 校验

- pnpm wiki:lint 通过（本页无报错、无待留意）；pnpm wiki:diagrams --check 285 张一致；pnpm wiki:audit 通过（本页来源 17 条）。
- 字数 3179 → 3214；行内代码 28；角标 30；calc 0。
- 浏览器：Playwright 只读打开 5193 本页，页面文本里已没有「没有替用户执行」和「patch7」，有「超过 65535」，S 角标正常渲染。随后补截图时 8790 后端已不响应（curl 8790 返回 000，5193 页面资源 502、画面全黑），按纪律没有起停服务，所以修订后这一版没有截图。
