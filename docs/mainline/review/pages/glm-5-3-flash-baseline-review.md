# GLM-5.3-Flash 来源基线审查记录

## P5 写作记录（2026-09-28，第 01 批）

本次为 source 归档页小修，沿用原有五个 H2 和 `glm-two-node-topology`，不套教学页骨架；未修改 D/R/C/K/M 页面、共享图、代码、测试或计划，未提交 git。

### 修改内容与数字出处

- 把模型配置主钉点统一为 `690b705278a3a58e538fcb37c2ca8b5f9511213c`；保留旧 `eb9eb208` 的配置等价记录和来源，旧引用仍有效。
- 补齐教程 `0576b647`、控制流 `0fc695fc`、执行侧 `db701c1f` 的职责与证据边界。`git rev-parse` 确认两侧完整提交，`git describe --tags --exact-match 0fc695fc` 返回 `v0.23.0`。历史镜像取证明确归于 2026-09-25，不冒充本轮重做，也不把源码复制层等同于最终安装产物。
- **01 §0**：区分 2 个 DP 执行组与 8 个 DP 通信组，EP/MC2 为 16 rank；补缓存、块大小的口径与 D 的推导链接。逻辑块 640 token、每 block id 每卡 8,355,840 B、5 组、12 个带 KV 的 MLA 层；内核/状态/调度的块大小不得互换。
- **02 §0.1–0.4**：补 8192/32/0.85、图捕获尺寸、主干与 MTP 层、模型形状、GB/GiB 单位、量化范围的假设。每卡 20.58 GiB、MTP 540.75 MiB 仅说明沿用图的口径；3,855/3,908 仅引用 D，不重推预算。
- **03 §0**：修正“先按普通自回归解释”的旧主线，保留真实 MTP 配置；区分查询 1+3 行与实际接受数，补 `deepseek_mtp → mtp`，明确草稿 eager 不关闭主模型 decode 图；补默认开关及环境变量覆盖边界。
- 新增 D/R/M 的 relations；修正“通信组及 prefix caching 全部待查”为“固定源码已核、最终镜像产物待核”。保留权重配方、安装产物、设备数冲突等全部缺口。

### 原始证据与核心概念

- 本轮经 HTTPS 下载两份固定 revision 的完整 `config.json`，各 69,416 字节；解析完整 JSON 后比较为相等。统计 `layer_types` 得 34 个线性层、11 个稀疏层。副本存于截图目录。未重新检查本机不存在的 glm-flow 母版；其三者一致结论保留为 09-25 历史记录。
- 教程按本地 Git 对象 `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 核对 §5.2 两端命令；在线 web 工具未取回，未把失败称为联网通过。
- `vllm@0fc695fc`：`distributed/parallel_state.py:1833–1875` 核 DP/EP 组；`config/model.py:1805–1810、1851–1857` 与 `engine/arg_utils.py:2370–2405` 核 chunked prefill、prefix caching 默认值；`v1/worker/gpu_model_runner.py:814` 核查询长度；`config/speculative.py:550–554` 核方法归一化。
- `vllm-ascend@db701c1f`：`distributed/parallel_state.py:84–96` 核 MC2 组；`quantization/modelslim_config.py:632–736` 核逐层 `FLOAT` 跳过量化；`patch/platform/patch_mamba_config.py:126–159` 核逻辑块对齐。缓存字节推导继续由 D 承担。
- 同一 Ascend 提交的 `ascend_config.py:320、511–512、778–781`、`envs.py:75`、`utils.py:905–931` 核默认开关与环境覆盖。无 additional-config 不能单独证明 FlashComm1 关闭，正文已加“未额外设置相关环境变量”。
- 没有读取 W8A8 权重或其逐层量化配方，没有 NPU 部署或性能实测；保留 `[I]` 与待核。

### 独立审查与自查

独立审查者 `/root/baseline_review` 读取修改前副本、当前页、底稿与固定源码，初审 P1=0、P2=1：缺 03 §0 默认开关边界。补齐并增加 C21–C26 后独立复查确认闭环，无新增 P1/P2。该审查者未编辑文件，浏览器验收由写手执行。

字数使用项目 `measureStandard` 口径（汉字数＋拉丁单词数，去 frontmatter、链接地址和围栏）：改前 **2170**，改后 **3209**。本页是来源归档，统计整篇归档正文，不称为教学正文。calc=0；证据角标 30 处；行内代码 83 处（25.86/千字）；原图仍位于第三个 H2，图前有来源/配置表、无 calc。图仍为原来的 900×580 双机拓扑，未新增直觉图。上述源码字段密度及来源角标保留归档格式，不套教学页首图/源码区限制。

本页五个 H2 的生成锚点与修改前完全一致；7 个正文跨页链接均能解析到当前目标标题。独立来源检查：13 条 Git 引用的 commit、路径及行号全部有效，13 条 URL 不由本地审计证明可访问，26 条尚无完整 raw 对照。共享图重新渲染结果与已有 SVG 相等。页面 schema 无问题。

### 验证记录

截图及完整输出目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p5\glm-5-3-flash-baseline\`。

- Windows 执行策略阻止 `pnpm.ps1`，实际使用等价的 `pnpm.cmd`，未修改执行策略。
- `pnpm.cmd check:content`：通过，registry 131 页。
- 首轮修改后 `pnpm.cmd wiki:audit`：通过，131 页、1505 条来源；本页后加的默认开关来源又用 `auditPage` 单独核对，13 条 Git 引用全部有效。
- 全库 lint/图检查的输出受到其他并行编辑影响：改前 lint 14 处、audit 1 处；中途 lint 曾报告其他页 schema/重复关系及缺图，图检查曾报告 collective-communication 两张 SVG 不一致。本页后来增加的角标告警已通过去除重复角标关闭。详细前后输出留存于目录，不将不同时间的全库差异归因于本页。
- 浏览器首次被其他页的缺 SVG、随后 device-memory 的非法关系类型阻断，保留 `diagnostic.png`；该外部状态恢复后，4173 已能打开本页，首屏无水平溢出。最终截图与操作结果另记下方。
- `wiki:build` 会写共享索引与 registry，按共同要求交协调者串行集成，本次不写派生物；不触碰 5193、8790 服务。

**最终验证与截图：**

- 最后一轮 `check:content` 通过；`wiki:diagrams --check` 通过，158 张图与 spec 一致；`wiki:audit` 通过，131 页、1550 条来源，本地无无效 commit、缺文件或越界行号。
- 最后一轮 `wiki:lint` 仍有 1 处其他页错误：`concepts/hardware-devices.md [source-domain]`，两条 `e.huawei.com` URL 不在可引来源白名单。本页无错误或提醒；不扩大范围改白名单或其他页。
- `pnpm.cmd check` 的类型检查、代码 Lint 已通过，测试阶段为 113 文件/936 测试通过，3 文件失败：两个 reader suite 在读取其他页非法 schema 时未加载；`scripts/wiki/params/scan.test.ts` 的 Python AST 测试因解释器不支持上游语法失败（需 Python 3.11+）。该命令在测试阶段中止，后续内容/图/Wiki 检查已按上面四项单独执行。后续 reader 重跑曾与生产构建争用 workflow lock，再改串行复核；未清理或抢占锁。
- 关闭本次 Vite、等待构建结束后的 reader 串行复核：11 测试通过、2 失败。`index.test.ts:20` 要求 block-table 标题匹配 `^Block Table`，实际为“块表：从序列位置找到缓存槽位”；`reader-build.test.ts:7` 的构建/实时快照 revision 不同。后者发生在工作区持续并行改稿期间，未认定为本页引入；二者均保留原断言，不改其他页或测试。输出在 `reader-serial-recheck.log`。
- `pnpm.cmd build --outDir <截图目录>\build` 通过，生产产物放到临时目录，不改共享索引或 registry。
- 4173 的 Chromium 浏览器以 1440×1000、deviceScaleFactor=1 打开本页，实际点击 **13 个站内链接**（7 个正文锚点链接＋6 个 relation 链接）、本页目录“镜像固定与源码对应”，并展开全部 **26 条来源**。无 pageerror；5 张表均无横向溢出，拓扑图实际为 900×580。
- `01.png`–`07.png` 覆盖整页及展开的来源列表，逐张读取截图检查；首两屏、配置表、拓扑、双机参数、镜像摘要与末尾来源均可读。`browser-check.json` 保存链接、布局及运行结果。`diagnostic.png` 只记录此前外部编辑导致的错误，不计入 7 屏验收截图。
- 截图完成后已用 Ctrl+C 关闭本次启动的 4173 Vite 会话，随后 HTTP 探测返回连接失败；5193/8790 的服务未操作。

### 仍需保留的限制

教程 §3.1 与 §5.2 的每机设备数冲突维持原记录；没有发现新的底稿算错。最终镜像、量化配方及权重配套仍待核，不因本次来源小修而宣称部署已验证。队列/source 不套教学骨架，按用户明确指示执行，没有未决的编排问题。

## P5 审查（09-28）

独立审查，只读不改页面（2026-09-28 约 01:15–01:20）。**评分 8/10；P1 = 0，P2 = 1，P3 = 4。**

### 方法与读取纪律

- 页面 172 行，分 1–101、102–172 两段读；写作记录整份 57 行读一次。底稿三份只用 grep 取 §0 行；源码用 `git show <commit>:<path> | sed` 取 ≤60 行片段；学习指南只读 `learning-guide.md:90-109`。
- 未读 HANDBOOK、`docs/plans/`、`wiki/TERMS.md`；读取没有被拦截。教程启动命令块未整段读：参数用 `grep -o` 从 §5.2（教程 L237–330）抽取，只有 §5.2 开头 14 行（L237–250）顺带看到 node 0 脚本前 3 行（网卡名注释）。
- `wiki/sources/glm-5-3-flash-baseline.md` 未入 git（`??`），`git diff` 无输出；改用写手留下的改前副本 `scratchpad/p5/glm-5-3-flash-baseline/before.md` 做 `git diff --no-index -U0`，只看删除行。
- 为复核字数，临时建 `scripts/wiki/__tmp_measure_review.ts` 调 `measureStandard`，跑完即删，仓库里已无该文件。

### 逐项核对

**1. 版本钉住 ✓（与三份底稿 §0 一致）**

| 钉点 | 页面位置 | 底稿 / 独立核对 |
|---|---|---|
| `vllm@0fc695fc` = v0.23.0 | L23–35、L73 | 01 L5、02 L18/L20、03 L6；本地 `git rev-parse` 得 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`，`git describe --tags --exact-match` → `v0.23.0` |
| `vllm-ascend@db701c1f` | L19–21、L27–34、L74、L151、L158 | 01 L6、02 L17、03 L7；本地 rev-parse 得完整 hash 与页面一致 |
| 教程 `0576b647` | L12、L72、L106 | 01/02 各有引用；本地对象里存在 `docs/source/tutorials/models/GLM5.3-Flash.md` |
| HF config `690b7052` | L11、L71、L78 | 02 L840、03 L110；本轮重新从 HF 下载 690b7052 与 eb9eb208 两份 config（各 69,416 B），解析后完全相等；页面配置表 14 个值、`layer_types` 34/11 与稀疏层 3、7、…、43 全部对上 |
| `main` = `baa023ad` | 页面未写 | 03 §0 L8 定为“只在关键差异处标注”，页面不写不构成冲突 |
| v0.26 = `2ed6cbba` + `vllm@568afb3a`、`rfork@3284850b` | 页面未写 | 三份底稿 §0 都没有；v0.26/main 的登记表在 `learning-guide.md:95-101`，rfork 在 01 L396–398。页面没写这些，与 §0 也不矛盾，见 P3-3 |

其余抽查：vLLM `model.py:1851-1857`（hybrid 关 prefix caching）、`gpu_model_runner.py:814`（1+spec）、`speculative.py:550-554`（`deepseek_mtp`→`mtp`）、`parallel_state.py:1833-1875`（DP 组 `{i,i+8}`、EP 组）、va `parallel_state.py:84-96`（MC2）、`ascend_config.py:84-89/114-118/320/511-512/778-781`、`envs.py:75`、`utils.py:905-931` 均支持页面措辞；`shared_expert_dp` 默认 False，所以“`enable_sp()` 为假”在默认命令下成立。教程 §5.2 参数（133120、DP2/本地 1/起始 0 与 1、TP8、EP、32、8192、ascend、0.85、`deepseek_mtp`、3、eager、`FULL_DECODE_ONLY`、4/8/16/32/64/96/128、`--headless`）逐项对上。D 页的 20.58 GiB、540.75 MiB、8,355,840 B、3,855/3,908、640、5 组、12 层与页面一致。13 条 URL 在 01:17 实测均返回 200/206；quay 的 index 仍列 amd64 `5bff4b7b…`、arm64 `7fe19dc7…`，标签仍指向 `d46b8603…`；arm64 配置 blob 含 `VLLM_TAG=v0.23.0` 和 `b830f5a0…`；W8A8 仓库 config 的 `text_config` 与原模型相等。`measureStandard` 复算得改前 2170、改后 3209，与写手一致。

**2. 教程设备数冲突 ——问题在页面对原文的转述（P2-1）**

原文（`0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`）：

- §3.1 L21：`requires 2 Atlas 800 A2 (64GB × 16) nodes`，没有写“每节点”。
- §5.2 L241：`2 Atlas 800 A2 (64GB × 8) nodes with DP2 across the two nodes (one DP rank per node) and TP8 inside each node`。
- A2 容器只映射 `/dev/davinci0–7`（L130–137），两端 `ASCEND_RT_VISIBLE_DEVICES=0,…,7`（L267、L316）。
- 同一教程对 A3 也写了两种记法：§3.1 L20 为 `A3 (128GB × 8)`，§5.1 L190 为 `A3 (64GB × 16)`。可见括号里的计数单位本来就不统一。

所以真正的不一致只是 §3.1 那一行的记法：“16”最自然的读法是两机合计 2×8=16，与 §5.2 正文、容器映射、可见设备三处都一致，也与我们的 2×A2×8 共 16 卡完全吻合。只有“每机 16 卡”这一种读法，才会同时和这三处冲突。页面 L116 却写成“教程 §3.1 写**每节点** `64GB × 16`”，把一种读法当成原文，并把它称为“未获作者澄清”的冲突；L169 还把“设备数量冲突的最终澄清”列为可复现部署的缺口。页面的结论和拓扑图是对的（每机 8 个可见设备），但读者会误以为官方明确要求每机 16 卡，进而怀疑 16 卡部署是否只配了一半资源。`hardware-devices.md:194` 的引述是准确的，而且把原文差异交给本页保存；作为全库的单一出处，本页不能有这处转述错误。

**3. 锚点 ✓**

- 本页 5 个 H2 与改前副本逐字相同，锚点不变。
- 用 `anchors.ts` 的同一 slug 规则脚本扫全库：指向本页的 50 条链接和本页链出的 7 条链接，共 57 条，**0 失效**。`learning-guide.md` 的两处 `#镜像固定与源码对应` 均能解析；本页链到 D 页的 4 个锚点、M 页的 2 个锚点、R 页的 1 个锚点，按当前文件复算全部存在。6 个 relation 目标 id 都存在。
- 附注：写手 00:48 的 `readonly-hashes.json` 与现在对比，D/R/C/K/M 五页哈希**都已变化**（mtime 01:02–01:13），拓扑 yaml/svg 未变。本页最后写入时间是 00:58:58，早于这些改动；同一时段 hardware-devices、device-memory、collective-communication 的 review 在 01:12–01:14 写入，说明有并行写手。无法归因到本页写手，建议协调者确认是谁改了只读页。

**4. 删除行 ✓（无实质信息丢失）**

删除 24 行，外加 2 个列表项。逐条归类：普通自回归教学假设 `[A]` 及对应 relation note 被有意替换为真实 MTP 口径，与 03 §0 一致；“不把 2048 当作通用块大小”移到 L92 和 L134；“DP/TP/EP 组须对照镜像源码确认”改为“固定源码已核、镜像运行结论待核”（L110、L162），没有多承诺跨机通信算子；glm-flow 三方一致改记为 09-25 历史（L94）；`eb9eb208` 的来源移到 sources 末尾（S13），引用仍有效；旧页并存说明改写到 L172。唯一的细微丢失见 P3-4，另有两处角标调整见 P3-1、P3-2。

### 问题清单

- **P2-1 设备数冲突转述不实**（L116、L169）。影响见上文第 2 项。复现方法：`git -C tools/repos/vllm-ascend show 0576b647:docs/source/tutorials/models/GLM5.3-Flash.md | sed -n '21p;241p'`。建议：L116 改为逐字引用 L21 与 L241，写明“16 可读作两机合计 2×8，与 §5.2、容器映射、可见设备一致；只有‘每机 16’的读法与三者冲突”，并顺带提 A3 的 128GB×8 与 64GB×16 两种记法；`[!]` 保留为“记法不一致”。L169 从“可复现部署仍缺”里拿掉，或改成“概览行记法待作者澄清（不影响 2×8）”。
- **P3-1** L116 由 `[S3][!]` 改成只有 `[!]`，L108 的 `[S3]` 也删了。冲突句逐字讲的是教程，最近的 `[S3]` 却在 L106。如果 lint 允许，建议在 L116 恢复 `[S3]`。
- **P3-2** L149 写“arm64 元数据记录 `VLLM_TAG`… `b830f5a…`”，只剩 `[S11]`（Dockerfile.a2）；“元数据”对应的是 S8。数值本身两处都有（blob 已核；`Dockerfile.a2` L54、L90），不算事实错误，只是出处和句子对不上。
- **P3-3** 版本范围没有划界：“四个钉点”只覆盖 GLM 主线，没有说明社区 `releases/v0.23.0`（va `2c59ff10`）、v0.26（`2ed6cbba` + `vllm@568afb3a`）、main（`baa023ad`）和 rfork（`3284850b`，01 L398 记其树内没有 GLM-5.3-Flash 模型实现）都不在本基线内。L67 的“不能只写一个 v0.23”只覆盖了一部分。建议在「后续页面的引用边界」加一句，链到 `learning-guide.md#版本差异`，不要复制那张表。
- **P3-4** 旧参数表“图执行：不说所有阶段都运行在图模式”被删。新行讲了草稿 eager、主模型捕获 decode 图，但没有明说 prefill 不走图（`FULL_DECODE_ONLY`=(FULL, NONE)，03 L19）。可在该格补半句。

### 结论

版本钉点、配置值、源码行号、镜像摘要、D 页数字、URL、锚点、字数全部实测对上；写作记录与实际相符。唯一需要当前处理的是 P2-1：本页作为来源基线，对教程原文的转述要逐字准确，并且不能把一处记法差异写成部署缺口。改完 P2-1 可到 9 分。

## P5 修订（09-28）

- P2-1：按本地固定教程 `0576b647` 的 §3.1、§5.2 核对，改为两机合计 16 卡、每机 8 卡，撤销设备数量属于部署缺口的判断，保留其余部署待核项。
- P3-1/2：教程计数段恢复 S3；将前段的 S8 移到 arm64 元数据段，与 S11 一起对应元数据及 Dockerfile，角标总数保持 30。
- P3-3/4：补社区分支及 RFork 不在本基线完整核查范围内的说明，链接学习指南版本差异；图执行表补明 prefill 不走图。
- 验证：`pnpm.cmd wiki:lint` 本页无报错，全库仍有 hardware-devices 的 source-domain 错误，将在第三页任务处理；`pnpm.cmd wiki:audit` 通过，131 页本地引用无无效 commit、缺失文件或行号越界，8 个强制页达标。与本轮改前副本逐行对比，数值、来源列表、五个 H2 和原有链接均保留，D/R/C/K/M 页未修改。
- 限制：浏览器清单为空，Chrome 与内置浏览器均返回 `Browser is not available`，本轮未完成浏览器实测；远端教程抓取失败，事实核对使用本地固定提交。无 git 提交。
