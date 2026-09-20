# F003 Implementation Plan：社区语料检索与修复溯源

**Feature:** [F003 — GitHub issue / PR 语料与报错溯源](../features/F003-github-corpus.md)
**Goal:** 学习者提交报错后能查到相关讨论、修复 PR 和已证实的版本范围；重要变更进入既有知识积累闭环。
**Acceptance Criteria:** 规范和完成状态只在 feature；下表逐项覆盖 AC1–AC7。
**Architecture:** REST 分页采集为本地可重建语料，聊天仍只经统一 retrieve 入口。修复结论依据结构化关联与本地 git，重要 PR 经 F004 共用清洗、编译、审阅和发布，不建立第二套写库流程。
**Tech Stack:** 沿用 TypeScript、tsx、Zod、Vitest、Node fetch、git 与现有 agent CLI；采集本身不调用 LLM。不引入向量检索、训练、推理服务或性能基准。
**Status:** 本计划不维护状态。验收状态看 feature 的验收表；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；会变的数字现查。下方基线是 2026-09-14 的历史记录，任务条目只保留设计依据。

## 终点与依赖顺序

完整终点以 feature 全部 AC 为准。第一阶段让社区材料可查和可追溯，第二阶段让重要 PR 经过人审更新正式 wiki。全量语料本身不会让 wiki 自动积累；AC6 接入 [F004 的 M1 闭环](knowledge-loop-plan.md) 后才构成材料 → 知识 → 后续回答的完整链路。

1. G0 核对 API 与真实样本，G1–G2 做可靠采集；离线实现不依赖 token，也不等待 F004 全部完成。
2. G3 接入报错检索，G4 接入来源与 git 版本溯源。G1 日志复用 F004 T1；G3 在线接线复用 F004 T2 的清洗与 T5 的知识快照，离线 provider 可先独立验证。共享模块需要提前落地时按 F004 契约实现并回填其任务，不复制一份。
3. G5 依赖 F004 T0–T5，复用唯一任务、草稿与审阅入口；G6 与 F004 T9 共用 F002 的每日调度。

真实接入使用生产采集器的 `--numbers <编号列表>` 小样本模式；明确数量边界且不推进全量检查点。全量仍按 AC1 验收；当前用户排除大规模导入，不能用样本通过代替全量。具体参数以 CLI 与测试为准。

不做全量 issue 转 wiki、上游 vllm 仓库采集、webhook 或未经命中率证据支持的向量化。讨论里有建议不等于功能已实现；合并进某分支也不等于所有版本都已修复。

## 现状与 API 依据

2026-09-14 核对 `8175224`：`package.json` 尚无 `wiki:sync-github`；`server/index.ts:106` 只检索 wiki；`src/content/wiki/schema.ts` 的页面来源类型不能表达完整社区状态；现有 `scripts/wiki/lineage.ts` 处理参数出现 / 消失，不是任意修复提交的通用证明。

官方文档核对了以下端点语义，真实仓库的请求量、访问条件和完整性仍由 G0 验证：

- 仓库 issues 列表包含 PR，带 `pull_request` 标记；`since` 可筛选更新时间。采集时必须分类去重，PR 详情需另取。[GitHub issues REST](https://docs.github.com/en/rest/issues/issues)
- 必须沿分页的 `Link` 遍历，不能只读取第一页或以最大编号推算条数。[GitHub 分页说明](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)
- PR 详情、提交与变更文件各有对应端点，合并状态和提交解释应结合详情核对。[GitHub pulls REST](https://docs.github.com/en/rest/pulls/pulls)
- PR review comments 是独立资源，不能假设普通 issue comments 已覆盖代码审阅讨论。[GitHub review comments REST](https://docs.github.com/en/rest/pulls/comments)

历史 feature 中的条数只作 2026-09-10 快照，不作本轮总数或成本依据。全量采集不以 Search 返回结果集作为来源；计数核对也须记录查询时间与口径。

## AC 映射

| Feature AC | 任务 | 必须留下的证据 |
|---|---|---|
| AC1 | G0、G1、G6 | 分页覆盖、断点恢复、issue / PR 分开计数；真实抽样 5 条字段和评论对照 |
| AC2 | G2、G6 | 同秒更新、评论更新、失败恢复；无变化第二轮新增 / 更新为 0 |
| AC3 | G1、G2、G6 | 鉴权 / 限额 / 网络失败分类、非零退出、日志，凭据不出现在输出 |
| AC4 | G3、G6 | 固定 10 条真实 traceback，命中原 issue ≥ 7；保留逐条命中与漏检原因 |
| AC5 | G4、G6 | issue → PR → merge commit → 含提交 tags / branches；未知与否定分开 |
| AC6 | G5、G6 | 真实参数 PR 的待审跨页 diff；注入 prompt 反例；批准后新问答受益 |
| AC7 | G4、G6 | 10 条带官方文档链接的 issue，解析版本与路径，映射失败明确原因 |

## 数据与共享接口

拟新增的语料 schema 放 `scripts/wiki/github/schema.ts`；浏览器 / 问答共用检索 hit 类型仍由 `src/content/wiki/retrieve.ts` 承接。下面是设计约束，不在两个 feature 分别定义完整类型。

| 产物 | 契约 |
|---|---|
| `tools/corpus/vllm-ascend/{issues,prs}/<n>.md` | 单条最新规范化记录；含 repo、kind、number、URL、标题、正文、状态、标签、作者、created / updated / closed、merged / mergedAt / mergeCommit（可空）、带 ID / URL / 更新时间的评论、结构化关联和文档引用 |
| corpus 中的关系 | 类型区分 mentioned、claims-to-fix、confirmed-fix；保留来源 URL、原句及采集时间。仅 `fixes #n` 文本不能单独证明修复已合入 |
| `tools/corpus/vllm-ascend/_sync.json` | schemaVersion、各资源游标 / 水位、在途分页、每条详情完成状态、最近完整成功时间、失败项；已落盘 ID 清单从记录派生，不再持久维护第二份全量清单。分资源推进，不把局部完成写成全量完成 |
| `tools/corpus/vllm-ascend/_runs/<runId>.json` | API 请求数、抓取 / 新增 / 更新 / 未变 / 失败条数、观测窗口、计数差异、覆盖范围；不存 token |
| 检索命中 | 保留现有 wiki hit 兼容；新增 kind=issue/pr、原始 URL、摘要片段、命中依据、updatedAt。provider 内部不能直接拼聊天 prompt |
| 文档引用 | URL、请求版本、站点路径、解析 ref / commit、本地文件（可空）、映射状态 / 原因；原链接永远保留 |
| 修复证明 | issue / PR 标识、关联证据、merged 状态、验证过的 commit、含该提交的 tags / branches、检查时 refs 快照；无法查明则 unknown，不猜版本 |
| PR 编译任务 | 调用 F004 的工作接口；去重依据 repo + PR + 变更 revision + 目标页。任务状态只在 F004 工作记录中维护，corpus 不再复制队列 |

corpus 是可更新、可重建的检索缓存，不进 git；正式知识引用的证据快照进入 `wiki/raw/` 并只追加，不能因为缓存更新而失去旧结论的依据。只在重要 PR 编译时保存用于知识的不可变快照，无需把整个 corpus 复制进 raw。

复用 F004 的 sanitize、raw 引用解析、运行日志、预算策略和单写入者。复用 seeds 当前唯一解析器取得仓库与入口文件，不在 F003 再写一组 ref/pin；若后续抽出仓库 manifest，只改共享解析器。参数定义路径优先来自 F002 扫描结果；扫描器未交付时明确标示参数覆盖未完成，不能只扫一份配置文件就宣称全覆盖。

## 实施任务

每项实现都按红例 → 命令确认失败 → 最小实现 → 同命令通过。测试先使用注入 fetch、时钟、临时目录和小型 git 仓库；真实网络验收另外记录。所有新增 CLI 在 package.json 注册后才存在。

### G0：Spike，核对访问、分页和样本（限时 45 分钟）

**产出：** 在本计划的实施记录中追加端点表、样本 ID、权限需求、观测日期、评论覆盖和计数口径；不编写临时采集器当成成品。

1. 只检查 `GITHUB_TOKEN` 是否存在，不读取到对话输出。无凭据先使用固定 API fixtures 做 G1–G4；真实全量验收保持尚未验证。
2. 小规模只读探测：已关闭 issue、未合并 PR、已合并 PR、含普通评论和 review comments 的 PR、含官方文档链接的 issue。核对 body 为 null、已删除用户、分页响应和更新时间。
3. 确认评论 / review / timeline 的覆盖端点及各自增量方式；验证它们是否会更新父条目的时间，未证明的资源使用独立水位或补扫，禁止猜测父条目一定更新。
4. 确定全量计数核对方法：完整分页 ID 清单为主，同窗口可用 API 总数为交叉证据。仓库在变动时记录前后计数与补扫差异；不得以不稳定计数强行制造一致。
5. 记录 rate-limit headers、重试语义和版本请求头。若限时内无法确定评论更新或计数，列明未知项并继续离线开发，不将对应 AC 标完成。

**保留价值 / 省略代价：** 端点与样本进入正式采集测试；省略会把错误 API 假设固化到游标结构。

### G1：可靠全量采集与规范化

**新增：** `scripts/wiki/github/{schema,client,normalize,store,sync}.ts` 及对应 `*.test.ts`、`scripts/wiki-sync-github.ts`。**修改：** `package.json`、`.gitignore`。

1. 红例：issues 混有 PR、分页三页、编号有空洞、评论两页、PR 详情缺失、null body、同一记录重复返回、第二页失败、落盘后检查点前中断。
2. 运行 `pnpm test scripts/wiki/github/schema.test.ts scripts/wiki/github/client.test.ts scripts/wiki/github/normalize.test.ts scripts/wiki/github/store.test.ts scripts/wiki/github/sync.test.ts`。
3. 实现 REST 客户端、Link 分页、受控重试和规范化。PR 需完整详情，讨论评论 / review comments 按 G0 端点表采集；缺详情的条目记录 incomplete 并重试，不当完整成功。
4. 条目原子替换，检查点在该批落盘成功后推进。恢复时允许重读边界页并幂等 upsert；完整遍历后补扫运行期间更新。缓存记录原始字段的必要信息，不能只保留 LLM 摘要。
   补扫设置轮次 / 时长上限；持续变化或限额导致窗口未收敛时保留检查点，输出 incomplete 并非零退出，下次继续。不承诺对持续更新的远端取得事务快照，也不无限追赶到“全局零变化”。
5. 对鉴权、主 / 次限额、网络、不可访问资源给结构化错误。403 不一律叫鉴权；有限重试耗尽后非零退出，脱敏摘要经 F004 共用日志入口追加到 wiki/log。
6. 同命令通过；未来 `pnpm wiki:sync-github --full` 在 fixture 中完成所有 ID、字段和评论；异常恢复最终结果与不中断运行一致。

**保留价值 / 省略代价：** 全量和增量使用同一 store；省略会出现只拉标题或断点恢复漏条。

### G2：增量、失败重试与可解释统计

**修改：** `scripts/wiki/github/{sync,store,client}.ts`；扩充对应测试，新增 `scripts/wiki/github/incremental.test.ts`。

1. 红例：两个条目 updatedAt 相同、边翻页边修改旧条目、只有评论更新、评论编辑 / 删除、一次请求失败、重跑无变化、重开 issue、PR 从未合并变为合并。
2. 运行 `pnpm test scripts/wiki/github/incremental.test.ts scripts/wiki/github/client.test.ts scripts/wiki/github/store.test.ts`。
3. 每轮固定观测窗口，水位采用重叠读取加内容 hash 去重；不要依赖时间戳严格大于边界就不漏记录。资源有独立更新时间语义时独立同步；删除无法由增量接口体现的资源周期性按父项重新对账。
4. 本轮部分成功可以保存有效条目，但成功水位不能越过失败区间。运行结果分开打印 fetched、created、updated、unchanged、failed，避免把网络请求数当新增条数。
5. 同命令通过；未来连续两次 `pnpm wiki:sync-github`，上游无变化时第二次 created=0、updated=0、failed=0、退出 0；鉴权 fixture 失败必须退出非零且日志不泄漏凭据。

**保留价值 / 省略代价：** 每日同步沿用此协议；省略会累积“第一次有，后续漏修正”的陈旧语料。

### G3：报错检索接入同一 retrieve

**新增：** `scripts/wiki/github/{traceback,retrieve}.ts`、对应测试、`scripts/wiki-eval-github.ts`、`scripts/wiki/github/fixtures/tracebacks.json`。**修改：** `src/content/wiki/retrieve.ts`、`server/{chat,index,knowledge}.ts`、`src/app/wiki/ChatDrawer.tsx`、`package.json`。`server/knowledge.ts` 由 F004 T5 建立；未落地时先测试 provider，接线时再复用。

1. 红例：相同 traceback 只有本地路径 / 行号变化、多行错误、空堆栈、两个不同异常共有参数名、只有社区命中无 wiki 页、含注入的评论、恶意构造的搜索文本。
2. 运行 `pnpm test scripts/wiki/github/traceback.test.ts scripts/wiki/github/retrieve.test.ts src/content/wiki/retrieve.test.ts server/chat.test.ts`。
3. 规范化异常类与稳定错误片段，保留关键参数和值；先词面 / 固定文本检索，按证据匹配程度排序。通过 JS 文本匹配或参数数组调用 rg，不拼 shell 命令，不把用户输入当正则程序执行。
4. 把 provider 接入唯一 retrieve；wiki 与社区 hit 明确区分来源，聊天不另写 grep。编译和问答读到的社区文本都经共用清洗；不要只对“升级成页”的路径清洗。
5. 按 feature AC4 固定验收集，原 issue 正常存在于 corpus，样本的答案标注和保留问题单独存放。调参使用另一组问题；验收输入移除 issue 编号、URL、评论中的反向链接等答案线索，保留真实错误文本。报告各例候选、排序、命中依据与 corpus revision；无匹配对照即使返回弱候选，也必须显示未确认，不能编造修复链路。
6. 同命令通过；未来运行 `pnpm wiki:eval-github --fixtures scripts/wiki/github/fixtures/tracebacks.json`，输出每条候选和总命中数。低于 feature 要求时先按漏检原因改规范化 / 覆盖；仍不足才依据 F001 约定评估向量，不自动引入。

**保留价值 / 省略代价：** 同一检索入口服务回答和缺口判断；省略会让 corpus 只是磁盘文件。

### G4：修复链路与官方文档映射

**新增：** `scripts/wiki/github/{links,provenance,doc-links}.ts` 及对应测试；`scripts/wiki/git-history.ts`、`scripts/wiki/git-history.test.ts`。**修改：** `scripts/wiki/lineage.ts` 复用通用 git 查询；`server/chat.ts` 展示证据链。

1. 红例：正文声称 fixes 但 PR 未合并、关闭但没修复、引用其他仓库同号 PR、未知 SHA、浅历史、squash 合并、cherry-pick 不同 SHA、分支包含但没有 tag、官方 URL 版本不同 / 页面改名 / 页面删除。
2. 运行 `pnpm test scripts/wiki/github/links.test.ts scripts/wiki/github/provenance.test.ts scripts/wiki/github/doc-links.test.ts scripts/wiki/git-history.test.ts scripts/wiki/lineage.test.ts`。
3. 关联解析保留“提及”和“修复声明”的区别。经 PR merged 状态及已验证提交确认后，使用 `git tag --contains <sha>`、`git branch -r --contains <sha>` 查询包含关系；refs 不完整或命令失败为 unknown。未包含原 SHA 不能直接证明补丁没有被 cherry-pick，回答明确证明范围。
4. 通用提交包含查询抽进 git-history，F002 参数谱系和 F003 复用；不要拿参数“存在”表推断任意修复。tag 列表按真实 git 输出，不凭版本号推断发布先后或部署状态。
5. 文档映射解析官方域名、版本、路径、fragment；利用该版本仓库树和构建配置映射 Sphinx / MkDocs 路径。缺版本、重定向、已删除或无法解析分别给原因，不能默默跳到 main 的同名页。显示 URL 原版本和当前 pin 差异。
6. 同命令通过；真实取一条确认修复的 issue 和 10 条文档链接 issue，逐项核对证据链和映射结果，保持原 URL 可跳转。

**保留价值 / 省略代价：** 确定性版本证据供参数与社区共同使用；省略会把“有人提了 PR”误说成“你用的版本已修复”。

### G5：重要 PR 接入 F004 审阅闭环

**新增：** `scripts/wiki/github/promote.ts`、`scripts/wiki/github/promote.test.ts`。**修改：** `scripts/wiki-ingest.ts` 支持 feature 约定的 `--pr <n>`，`scripts/wiki/github/sync.ts` 接自动筛选，HANDBOOK 增加 PR 请求适配说明。

1. 红例：仅 README 改动、不完整变更文件列表、触及 seed 入口、触及参数定义、同一 PR 重复同步、PR 新 revision、未合并 PR、提示注入评论；必须断言普通问答和编译 prompt 都不含测试注入片段。
2. 运行 `pnpm test scripts/wiki/github/promote.test.ts scripts/wiki/ingest-cli.test.ts scripts/wiki/workflow.test.ts scripts/wiki/review.test.ts`。
3. 用 seeds / F002 扫描器数据匹配完整 changed-files 列表；分页或端点截断导致不完整时，补本地 git diff，仍不完整就报告并停止筛选。自动当前知识更新以已合并 PR 为准；未合并 PR 作为讨论材料，不能改写已实现状态。
4. 为匹配 PR 提交一个 F004 job，保存可复核的 PR 文本、diff 和版本证据快照；复用 raw、sanitize、隔离、预算及跨页整合器。手动 `wiki:ingest --pr` 也进入同一队列，不另开直接晋升通道。
5. 提取源码 / 参数变更及适用范围；更新现有概念页或参数页优先于机械地每 PR 新建一页。候选若否定旧结论，遵守 F004 AC7 留痕；守住 F002 生成区。
6. 同命令通过；挑真实参数变更 PR 生成可审 diff，人工批准后通过新会话查询新版本结论，同时仍能查旧版本与废弃依据。驳回后正式库不变，重复同步无重复 job。

**反重复验收：** 同一 PR 的证据已从聊天保存时，再由自动筛选发现，应复用 F004 的规范化来源身份、合并入口记录并检查当前页，不再编译一份相同知识。合并提交不变但评论有新观点时先判是否新增可引用事实；仅计数或排版更新不触发全文重编译。

**保留价值 / 省略代价：** 此步把“检索材料增加”转成“知识积累”；省略则 F003 只能增强临时搜索。

### G6：真实验收与每日接入

**复用：** [F004 T9](knowledge-loop-plan.md) 的唯一调度入口；不额外创建独立 Windows 每日任务。**验收报告拟放：** `docs/plans/github-corpus-review.md`，有实测结果再创建。

1. 运行 `pnpm test scripts/wiki/github scripts/wiki/git-history.test.ts src/content/wiki/retrieve.test.ts server/chat.test.ts`；确认所有目标文件实际被发现。
2. 有效访问条件下运行 `pnpm wiki:sync-github --full`，记录观测窗口、分页覆盖、条数差异和字段抽样；中断恢复再跑，最终无遗漏 / 重复。两轮增量验证更新数为 0 的口径。
3. 无效凭据只在临时子进程环境中验证，保留原环境；分别验证鉴权、限额和网络 fixture。检查非零退出、日志原因与脱敏。
4. 运行真实 `wiki:eval-github` 并保存逐条结果；浏览器粘贴报错，操作 issue / PR / 文档链接，核对未合并、版本未知时的呈现。不以 stub 回答替代真实命中率。
5. 完成 AC5 / AC7 的真实样本对照和 G5 的 PR → 草稿 → 批准 → 新会话复问；只有这一步通过才可声称社区资料让正式 wiki 受益。
6. 调度顺序与排他写入遵循 F004 T9，关闭机器错过计划后可补跑，失败不推进成功水位；执行一次计划任务并核对日志。控制 LLM 编译预算，纯采集不得触发逐条 LLM 调用。
7. 最终 `pnpm check`、`pnpm build`、`pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml`、`pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/wiki-loop.spec.ts --project chromium`。新增 `tests/wiki-corpus.spec.ts` 覆盖社区命中与链路显示，并单独运行 `pnpm test:e2e tests/wiki-corpus.spec.ts --project chromium`。
8. 记录实际 HEAD、命令、退出码、费用、GitHub 请求量、未解决项；逐条回填 feature 状态。没有 token / 网络 / 真实 agent 结果时，对应 AC 保持尚未验证。

## 取舍与未验证项

- 全量正文和讨论有磁盘与请求成本，优先保证覆盖与可恢复；性能优化只在实际瓶颈出现后做，不先建设数据库或向量库。
- 设计时尚无采集和检索实测；当前小样本、分页与评论增量测试证据见 [非批量收尾报告](archive/wiki-nonbulk-review.md)。全库数量、覆盖率和耗时仍未验证，不沿用历史估算作承诺。
- 同提交包含关系只证明当前 refs 中的可达性，不覆盖语义等价补丁、部署环境或运行时效果。本项目不训练、不部署推理服务、不做性能测试。
- F002 通用版本证明、F004 审阅与调度是代码依赖，不是要求用户先手动搭另一套流程。实施时遇到已交付模块直接复用，并更新任务状态。
