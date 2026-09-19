# F004 Implementation Plan：让使用结果进入下一次回答

**Feature:** [F004 — 知识库闭环](../features/F004-knowledge-loop.md)
**Goal:** 问题、好答案和新材料经 agent 编译、人审整合后成为可追溯的 markdown 知识，并被后续独立问答复用。
**Acceptance Criteria:** 规范和完成状态只在 feature；本计划下表覆盖 AC1–AC9，并共同交付 [F001 AC8](../features/F001-llm-wiki.md) 的聊天保存与审阅。
**Architecture:** 各入口统一形成带来源的编译任务，共用执行器、草稿和审阅流程。正式 markdown 是知识真相源，索引及反向链接均由它派生；批准后刷新问答快照。
**Tech Stack:** 沿用 TypeScript、tsx、Zod、Vitest、React、node:http 与现有本机 agent CLI；本地 JSON 状态、markdown 产物、git 证据。不引入训练、推理服务、性能基准或向量库。
**Status:** 当前完成状态只看 [feature 当前验收](../features/F004-knowledge-loop.md#2026-09-16-当前验收核对)，最新证据见 [非批量收尾报告](wiki-nonbulk-review.md)。下列任务保留设计依据；2026-09-14 的代码基线是历史快照，不代表当前仍无实现。真实模型未通过项不以工程测试替代。

## 终点、范围与顺序

原始判准见主工作树的 [llm-wiki.md](../../../infra-view-new/llm-wiki.md)，特别是持久积累、原始来源不可变、好答案回存和持续维护四项。

完整终点是 F004 全部 AC 通过。按以下顺序实施，中间检查点不能标记整个 feature 完成：

1. **P0 可信度前置条件：** 修复来源校验、版本更新、错误判定、失败隔离和关系读取。
2. **M1a 首条闭环：** 保存一条有来源的聊天答案 → 草稿与跨页整合 diff → 人审 → 发布 → 新会话受益。先验证这一条链路，再做 M1b 的文本投喂与自动缺口补写。共享清洗、证据校验和 AC7 留痕从 M1a 起生效；AC2 的跨次投喂隔离随投喂入口一起交付，不阻塞尚未开放投喂的 M1a。
3. **M2 持续维护：** patrol、reconcile、drift 与跨页重复检查；接入 F002 的每日调度。F003 可以在 M1 后接入相同编译与审阅入口。

范围遵循 feature 的 Out of scope。人负责挑材料与审阅，不要求人手写页面；自动补写始终止于待审状态。每个阶段产物都留在最终系统中，不先做一套临时直接写库流程。

### 按依赖实施，而不是等待所有入口齐全

| 检查点 | 要做的任务范围 | 当场能验证的结果 |
|---|---|---|
| 前置修复 | T0 | 多版本来源、错误退出与成功草稿选择正确 |
| 共用底座 | T1；T2 的 raw、来源 parser、sanitize 和 origin | 单个请求可重试、可追溯，正式页尚不变化 |
| M1a | T3；T5 的保存、审阅和快照；T6 的保存路径 | 一条好答案经批准后被新会话使用，驳回与重复批准的反例通过 |
| M1b | T2 的 drop / quarantine；T4；T5 剩余状态呈现；T6 全流程 | 多入口进入同一管线，缺口驱动补写且不制造重复页 |
| M2 | T7、T8、T9 | 定期维护可运行，全部 AC 有完整证据 |

T0–T9 是任务标识，拆分实施不重新命名模块。M1a 直接使用最终的工作记录和审阅 manifest；不先实现一个直写 markdown 的临时按钮。T0 修既有成功清单选择，T1 再将它接入持久工作记录，避免 T0 等待尚未存在的工作 manifest。

## 代码基线与实施前置证据

2026-09-14 在 `feat/llm-wiki`、`8175224` 上只读核对，以下是路径与代码事实，不是修复结果。实施时先重现，记录当时 HEAD，禁止沿用旧测试成绩冒充本轮验收。

| 位置 | 当前事实 | 后续任务 |
|---|---|---|
| `scripts/wiki/audit.ts:25–38` | 行数接口只接收工作树路径，不使用引用的 commit | T0 |
| `scripts/wiki/clone.ts:48–65` | 非主 ref 只新增不存在的工作树，未规划已有工作树的 pin 更新 | T0 |
| `scripts/wiki-lineage.ts:34–38` | git 异常转换为空字符串，可把读取失败当成不存在 | T0 |
| `scripts/wiki-ingest.ts:70–73,124–140,176–185` | skip-existing 漏 params；整合扫描全部草稿；应用在最终 lint 前发生 | T0、T1、T3 |
| `scripts/wiki/ingest.ts:287–391` 与 `src/content/wiki/retrieve.ts` | 整合选页及检索扩展还有旧 related；整合 prompt 有硬编码 concepts 路径 | T0 |
| `src/content/wiki/schema.ts`、`scripts/wiki/build.ts:64` | 已有单向 relations 和派生 backlinks；sources 只接受 repo 引用或 URL，尚不能引用本地 drop 原文 | T2 |
| `server/index.ts:28–53` | registry、正文与检索 index 在启动时读取，批准新知识后需要新的快照加载机制 | T5 |
| `src/content/wiki/index.ts:6–24`、`server/chat.ts` 的 `buildChatRequest` | 读者正文由构建时 glob 导入；agent 还会从 cwd 读取正文。仅刷新内存索引不能保证三者一致 | T5 |
| `docs/features/F002-param-lineage.md` AC4 | 参数骨架和生成区未交付，不能按“已有 GENERATED 区”设计保护 | T3 |

## AC 与验证映射

| Feature AC | 实施任务 | 必须留下的证据 |
|---|---|---|
| AC1 | T1、T2、T3 | 真实 markdown 投喂产草稿；本地来源可点开；注入样例 prompt 断言 |
| AC2 | T2 | 同系列与链式输入两组固定样例；隔离状态不能进入普通批准流程 |
| AC3 | T4、T5、T6 | 独立提问达到 feature 阈值只排一项；补写、人审、新会话复问全过程 |
| AC4 | T7、T9 | 死链 / 年龄加源码或文档变化 / 无变化对照；调度运行证据 |
| AC5 | T2、T5 | 旧页默认值兼容、drop 来源角标浏览器实测 |
| AC6 | T8、T9 | 全库批次覆盖记录；补边待审 diff；批准后反向派生且重复运行幂等 |
| AC7 | T3、T6 | 新旧矛盾结论与废弃依据并存；纯补充不误标废弃 |
| AC8 | T8、T9 | 固定提取器差异测试、真实重提取波动记录、预算耗尽停机证据 |
| AC9 | T8 | 模板标题豁免、无引用重叠报错、有语义关系或正文引用放行 |
| F001 AC8（聊天部分） | T3、T5、T6 | 保存、diff 审阅、批准、驳回；模型自身说法不能自证为事实 |

## 数据与单一真相源

以下是拟实施契约；落地后以对应 Zod schema 和测试为准，plan 不维护第二份完整类型代码。

| 数据 | 唯一位置 / 写入者 | 最少字段与约束 |
|---|---|---|
| 正式知识 | `wiki/{concepts,params,sources}/`；只有批准后的发布器写 | 沿用页面 schema；`origin` 只说明入口；事实证据仍逐条标注 |
| 原始来源 | `wiki/raw/`；确定性导入器写新文件 | 快照、`rawSources` 与本地引用约定见 HANDBOOK「链接与来源」，不在此重复定义。drop 的原始标识、采集时间在其入口落地时接入；已有文件只读 |
| 清洗后输入 | 每个任务的隔离工作目录 | 记录 raw hash、清洗器版本和结果 hash；agent 只得到清洗后的视图，不能另读未清洗原文 |
| 工作记录 | `wiki/_jobs/<jobId>.json`；`scripts/wiki/workflow.ts` | 已实施字段以 `jobSchema` 为准；id 为来源 / 目标 / 配方指纹，origins 保留入口，attempts 保留执行与费用历史，artifacts 保存草稿与 raw 指纹。审阅状态在 T3 扩展，不在 plan 另存类型定义 |
| 知识缺口 | `wiki/_gaps.json`；`scripts/wiki/gap-ledger.ts` | key、代表问题、去重后的 occurrence IDs、首次 / 最近时间、候选页、理由、触发信号、jobId、解决时使用的知识 revision |
| 草稿变更 | `wiki/_drafts/<id>.md`；`wiki/_jobs/reviews/<revision>.json` | 编译草稿与整合提案分开；待审包的机器契约只在 `scripts/wiki/review.ts` 定义，包含跨页候选及基础指纹，不直接改正式页 |
| 隔离草稿 | `wiki/_drafts/_quarantine/<jobId>/` | 相同 manifest 加隔离理由；保留相关历史输入 ID，不能默认放行 |
| 索引与反向链接 | `wiki/index.md`、`src/content/wiki/registry.json`；现有 build | 不另存人工关系表。registry `file` 决定页路径，不按 type 猜路径 |
| 运行记录 | `wiki/log.md` 追加；既有写入逻辑抽成 `scripts/wiki/log.ts` | runId、任务、时间、结果、费用、关联 job；不重复存正文或凭据 |
| 告警 | `wiki/warnings/`；巡检命令 | 规则、页、证据、版本和时间；从来源重新生成，不充当任务状态 |

工作状态以 `workflow.ts` 的 `jobSchema` 为准，跨页审阅状态以 `review.ts` 的 `reviewSchema` 为准；隔离与缺口分类在对应任务实施时扩展，不在 plan 再复制一套枚举。入口事件 ID 用来避免请求重放；实际编译去重键由规范化来源及其内容 hash、目标范围、编译规则版本组成，不包含 origin。同一材料从 chat / drop / pr 进入时保留所有入口记录，但复用同一工作。运行前重新检查目标页和已有待审工作；已被整合的证据可以结束为无变更，不为完成任务强行新增页。被拒绝的同版本任务不因定时重跑自动复活，新材料或显式重试才开启新 revision。

缺口“已入队”不等于“已解决”。只有正式发布后通过复问检查才关闭；材料不足进入 needs-source 并保留缺口。规范化只合并明确等价问题；版本、参数名、否定词必须保留，不靠粗暴删词合并。

共享策略集中在拟新增 `scripts/wiki/workflow-policy.ts`：缺口阈值、判断调用上限、编译调用 / 费用上限、隔离窗口、巡检年龄和 drift 阈值均从此读取。feature 中已定义的默认值由契约测试锁定；其余预算在启用前显式配置，不允许无限调用。HANDBOOK 只解释含义和行为。

本地写入共用单写入者：HTTP 与 CLI 在领取任务、更新状态、发布时使用短时仓库级排他锁和原子 JSON 替换；网络请求、agent 编译和等待人审均在锁外。领取时记录 attempt 标识，回写时核对标识和 base hash，旧进程不能覆盖新一次尝试。锁含进程信息，陈旧锁核对进程后处理。发布 manifest 承担多文件中断后的恢复依据；不引入分布式租约，也不让一个长任务堵住所有问答和审阅。

持久化限于 raw、正式 markdown、任务 / 缺口状态、批准记录和日志；锁、临时副本、agent 的问答快照是可清理的运行产物，实施时放到被忽略的 `tools/wiki-runtime/`。新增源文件按实际模块职责拆分；下面的文件清单用于定位任务，不要求一函数一文件或先建通用工作流平台。

## 实施任务

所有任务按“写指定失败用例 → 运行确认失败 → 最小实现 → 同命令确认通过”执行。测试过滤命令必须确认实际命中测试文件；不能把 Vitest 的 no-tests 成功当作通过。新路径以下均明确标为新增，命令注册到 `package.json` 后才可使用。

### T0：先修当前证据和整合基础

**本轮落地：** commit blob 审计、clone 更新既有 pin、ingest 前置 pin / 工作树检查、git 失败非零退出、成功草稿选择、relations 一跳扩展、参数页实际路径与同 ID 对照；另补整合副本校验和 build 失败保留派生物。逐项证据及能力边界以 [修复记录](wiki-foundation-review.md) 为准。

**修改：** `scripts/wiki/{audit,clone,lineage,ingest}.ts`、`scripts/wiki-{audit,clone,lineage,ingest}.ts`、`src/content/wiki/retrieve.ts`、`server/index.ts`；对应现有 `*.test.ts`，新增 `scripts/wiki/ingest-cli.test.ts`、`scripts/wiki/lineage-cli.test.ts`。

1. 红例：相同路径在两个 commit 的行数不同；无效 commit；非主工作树 pin 从 A 改 B；不存在的 ref；params 已存在；失败草稿和其他批次草稿并存；只有 relations 且跨章节的邻居。
2. 运行 `pnpm test scripts/wiki/audit.test.ts scripts/wiki/clone.test.ts scripts/wiki/lineage-cli.test.ts scripts/wiki/ingest.test.ts scripts/wiki/ingest-cli.test.ts src/content/wiki/retrieve.test.ts`，记录失败断言。
3. audit 读取 `git show <commit>:<path>` 的实际 blob 并分开报告无效 commit / 路径 / 行号；raw 对照检查完整引用，不能仅匹配文件名。clone 对全部已存在 ref 核对和更新 pin，遇未提交改动报错保留。git 失败非零退出，不输出“无”。整合使用现有提取结果的 succeeded 清单，独立 integrate 模式要求显式选择范围并排除失败项；skip-existing 用实际页清单；关系扩展用同一模型并保留 via，prompt 使用真实 `file`。
4. 同命令通过；临时 git fixture 验证多版本，不修改用户上游克隆。正常来源不得被误报，失败不得伪装成功。

**保留价值 / 省略代价：** 所有入口复用这些底座；不修就会把假校验结果和错误版本带进累积知识。

### T1：共用执行器与持久工作状态

**部分落地：** CLI seed 提取已接入 `batch.ts`、`workflow.ts`、`workflow-run.ts` 与 `persistent-extract.ts`。工作持久化、按来源与编译配方去重、attempt 防旧回写、退出进程恢复、显式重试、每任务累计预算与单次 CLI 额度均已验证。每次尝试在独立副本运行，默认只产草稿，既有 raw 不覆盖。执行预算目前仅覆盖 seed 提取；跨阶段预算、锁持有期间硬崩溃及发布恢复仍未完成，T1 不整体勾选。证据和调用方式见 [持久任务验收](wiki-workflow-review.md)。

**新增：** `scripts/wiki/{batch,workflow,workflow-policy,log}.ts` 及各自 `*.test.ts`。**修改：** `scripts/wiki/ingest.ts`、`scripts/wiki-ingest.ts`。

1. 红例：两个不同入口提交相同证据、进程在 running 中断、超预算、单项失败、同一资源并发写、旧 attempt 迟到回写、失败重试；断言成功 manifest 不含失败输出，长编译不持有状态写入锁。
2. 运行 `pnpm test scripts/wiki/batch.test.ts scripts/wiki/workflow.test.ts scripts/wiki/workflow-policy.test.ts scripts/wiki/log.test.ts scripts/wiki/ingest.test.ts`。
3. 从现有 `runExtractPhase` 提取 `runBatch`，保留默认 runner、路径约束、并发池和失败信息；seed 只做请求适配。工作状态与日志实现幂等写入、启动时核对 running 任务、显式重试。分配任务目录前检查重复工作。
4. 同命令通过；既有 seed 流程继续使用同一执行器。未审任务的正式库 hash 不变。

**费用边界：** 预算同时覆盖 coverage、联网补料、编译、整合与自动重试；领取前预留预算，结束后记实际消耗。重启和重试不重置已消耗额度；费用未知的失败保留预留额度并报告待核对，不视作零成本。未开启后台补写时可继续保存和审阅，不能隐式启动无限重试。

**保留价值 / 省略代价：** F002、F003 和所有 F004 入口共用；省略会出现多套队列和失败处理。

### T2：可引用的原文、文本投喂与隔离

**部分落地（2026-09-15）：** 不可变快照、页面映射、缓存 / lint / audit 校验已接入，见 [快照验收](wiki-raw-review.md)。本地引用链路、清洗及输入准备见 [本地来源与清洗验收](wiki-input-review.md)；单材料 CLI 已接入受限编译、screening 持久记录和共用预算，见 [受限编译验收](wiki-compile-review.md)。旧页保持兼容，没有批量迁移或导入。聊天保存进展见 T5；真实 agent 单页验证、origin 读者标记及 drop / quarantine 仍待实施。

**分段交付：** M1a 只交付共用 raw、来源解析、sanitize 和 origin；M1b 再开放 drop 命令，同时完成 quarantine。下列全套测试是 T2 完成条件，不能在只做共用部分时勾选 AC1 / AC2。

**新增：** `scripts/wiki/{raw,drop,quarantine}.ts`、`scripts/wiki/sanitize/`、`scripts/wiki-drop.ts` 及对应测试。**修改：** `src/content/wiki/{schema,evidenceMarks}.ts`、`scripts/wiki/{sources,audit,lint,build}.ts`、`wiki/HANDBOOK.md`、`package.json`。

1. 红例：本地 raw 引用当前被 schema 拒绝；路径逃逸；既有 raw 被覆盖；相同输入重复导入；清洗前文本可被 agent 读到；同系列资料和链式注入样例。
2. 运行 `pnpm test scripts/wiki/raw.test.ts scripts/wiki/drop.test.ts scripts/wiki/quarantine.test.ts scripts/wiki/sanitize src/content/wiki/schema.test.ts src/content/wiki/evidenceMarks.test.ts scripts/wiki/audit.test.ts`。
3. 本地来源格式与适用文件按 HANDBOOK「链接与来源」，schema 唯一定义 parser；audit 与角标共用，不把任意本机路径变成来源。单份已归档材料的受限编译已接入；接收新材料的 chat / drop / pr / gap 产品入口仍需交付，不得另建绕过清洗的编译器。
4. 参考已确认存在的 Multi-Agent sanitize 文件，迁入适用纯函数和测试；实现文本文件 / 目录投喂及 feature 规定的隔离窗口。保留原文、清洗记录与来源映射；隔离仅判风险，不宣称清洗可以证明输入可信。
5. 同命令通过；临时目录运行未来入口 `pnpm wiki:drop <fixture.md> --why "补充参数解释"`，验证正常草稿 / 隔离草稿分流、源文件 hash 不变、origin 默认兼容现有正式页。

**保留价值 / 省略代价：** 所有外部输入共用来源链；不实现本地引用，drop 的 sources 无法通过当前 schema 或无法供读者核对。

### T3：跨页整合先形成可审 diff，再发布

当前状态只看 F004；验证见 [审阅发布验收](wiki-review-publication.md) 与 [修订和 API 验收](wiki-revisions-api-review.md)。以下仍列完整目标，不因维护接口可用标 T3 完成。

**实现入口：** `scripts/wiki/{review,revisions,integration-run}.ts`、`server/{review,snapshot}.ts` 和对应测试。生成区协议继续由 F002 承接，不另造标记格式。**修改：** `scripts/wiki/ingest.ts`、`scripts/wiki/build.ts`、`server/index.ts`、`wiki/HANDBOOK.md`。

1. 红例：新建和更新现有页的组合 diff；批准后 lint 失败；批准时页面已被别人修改；重复批准；写入到一半进程中断；修改脚本版本节；“默认开启”被“已移除”否定；纯补充误进废弃节。
2. 运行 `pnpm test scripts/wiki/review.test.ts scripts/wiki/integration-run.test.ts scripts/wiki/revisions.test.ts server/review.test.ts server/snapshot.test.ts`。
3. 整合 agent 只在隔离副本中进行判重、补关系、标矛盾，产出完整 manifest 和跨页 diff。发布前在组合视图运行 schema / lint / audit / build 校验，审批绑定 base hash 与候选 revision；基础页变化则重新整合、重新审阅，不能沿用旧批准。
4. 正式写入仅由发布器执行；保留恢复 manifest 和原始草稿直至正式文件与派生物验证一致。中断时核对 hash，完成同一已批准 revision 或恢复自己的写入，不覆盖无关修改。log 按 runId 只追加一次。
5. 废弃结论保留原文、日期、替代事实与来源。参数页的版本节由当前 lineage 渲染器更新，agent 只能改其外正文；脚本生成的版本变更也必须包含在本次审阅 diff 中，不能一边永远冻结旧版本表、一边更新正文。F002 AC4 落地后由其唯一生成区解析器承接，禁止再定义第二套标记格式。
6. 同命令通过；批准 / 驳回 API 只接受已存在的整批 revision，关联的多个 job 由服务端 manifest 解析并核对，不让客户端选择文件或另报一套 job 处置。请求 body 的 revision 必须与路由一致。隔离任务不能通过审阅接口绕过阻塞；未来解除隔离需重新审阅。

**保留价值 / 省略代价：** 批准的是最终跨页变更，而不是批准单页后再由 agent 任意改邻居；省略会丢失人审边界和旧结论。

### T4：记录缺口并产生有证据的补写任务

**诊断交接补充（2026-09-15）：** v2 回执由程序记录材料范围，分类与理由明确保留为模型判断 / 未验证；`wiki:work prepare --job <id>` 校验知识与观察未变化后，输出不含自由文本理由的补料核对输入，禁止直接编译。旧记录只供历史查看，不静默升级；见 [诊断范围与补料核对](wiki-coverage-scope-review.md)。来源采集、现有页核对、共享预算和真正的编译交接仍待实施，不能据此标 T4 完成。

**来源准备补充（同日）：** `prepare` 已支持显式 `--source` 与 `--page`，提供经过完整性检查和清洗的归档选行、完整候选正文、目录及未提供正文列表；复用同一个 raw 清洗入口。来源真实性、语义覆盖和页面处置仍需核对；此材料准备步骤没有发起模型调用或编译，验收证据沿用上述报告的后续章节。

**历史阶段（2026-09-15）：** 信号采集与覆盖诊断证据分别见 [缺口信号验收](wiki-gap-observation-review.md)、[覆盖判定验收](wiki-coverage-assessment-review.md)。当时五个真实对照的分类与引文通过，理由仍有范围外推，见 [真实分类记录](wiki-classification-review.md)。此后已接通共享预算、`wiki:work run` 单次 worker、补写与独立复问关闭，工程证据与剩余真实验收统一见 [非批量收尾报告](wiki-nonbulk-review.md)。未知费用暂停；供应商单次请求的实际金额仍须凭回执核对。

**新增：** `scripts/wiki/{gap-ledger,gap-compile}.ts`、`server/coverage.ts`、`scripts/wiki-work.ts` 和对应测试。**修改：** `server/{chat,index}.ts`、`package.json`、HANDBOOK 查询切片。

1. 红例：三个独立问题事件达到阈值；SSE 重连同一事件不重复计数；相同词不同版本不合并；官方文档访问直接触发缺口；LLM 非法结构 / 超时 / 达预算上限；缺材料时生成无证据结论。
2. 运行 `pnpm test scripts/wiki/gap-ledger.test.ts scripts/wiki/gap-compile.test.ts server/coverage.test.ts server/chat.test.ts`。
3. coverage 以检索结果为输入，解析 `satisfied` 与理由；限定调用次数并与问答共享预算。提取官方访问事件并复用来源分类；按 feature AC3 区分知识缺失、检索漏召回、版本过期、判定失败。诊断只在预算内补一次针对已有索引的检查，仍不清楚则保留未判明，不能循环追问。已有页漏检生成带候选页和检索证据的待办，不自动改检索算法或写重复知识。
4. worker 只处理 queued 任务，复用 T1–T3。知识缺失时寻找可引用的已钉定源码、官方文档或已采集材料，保存证据快照；没有证据则 needs-source。版本过期优先更新原页。达到阈值自动排队，由本机 worker 在预算内执行；worker 未启动时 UI 明确显示等待执行。任何补写前再检查证据和已有页，避免等待期间其他工作已解决同一缺口。
5. 同命令通过；未来入口 `pnpm wiki:work --once` 在 fixture 中只处理一批并停止，重复运行不会重复排队或编译。

**保留价值 / 省略代价：** 问题变成持久待办；没有它，“多问几次”仍不产生任何可积累结果。

### T5：聊天保存、审阅面板与问答索引刷新

**新增验证（2026-09-15）：** 构建与在线读取共用快照入口，离线显示精确版本；正文与 revision 原子切换，缓存重新进入、失败保留与乱序请求保护已验证，见 [读者快照一致性验收](wiki-reader-snapshot-review.md)。真实 agent 复问及费用汇总仍未交付，T5 不整体勾选。

**部分落地（2026-09-15）：** `server/answers.ts`、`server/pages.ts` 与 `tests/wiki-review.spec.ts` 已实现回答记录、受限编译、固定版本审阅、发布后目录/正文/检索刷新，证据见 [聊天保存验收](wiki-chat-save-review.md)。保存前复核引用页未在问答期间改变。问答运行副本隔离与跨版本续聊已实现，见 [版本隔离验收](wiki-chat-version-review.md)；费用汇总界面与真实 agent 复问仍待验证或实施，不标 T5 / M1a 完成。下面保留完整终态验收。

**新增：** `server/knowledge.ts`、`src/app/wiki/ReviewPanel.tsx`、`tests/wiki-loop.spec.ts`、`server/knowledge.test.ts`。**修改：** `server/{chat,index,review}.ts`、`src/content/wiki/index.ts` 及其测试、`src/app/wiki/ChatDrawer.tsx`、`src/app/pages/WikiPage.tsx`、`src/design/wiki.css`、`tests/evidence.spec.ts`、`.gitignore`。

1. 红例：保存答案只能得到待审草稿；审阅显示跨页 diff 和证据；驳回后正式页不变；批准新页后同一服务的新会话仍查不到；不存在的页链接被当成有效引用。
2. 运行 `pnpm test server/knowledge.test.ts server/review.test.ts server/chat.test.ts` 与 `pnpm test:e2e tests/wiki-loop.spec.ts --project chromium`。
3. 保存请求走共用 job 流程，聊天摘要只作编译线索，引用原始证据而非“模型曾这样说”。面板展示任务状态、diff、证据、费用和失败原因；批准 / 驳回作用于明确 revision。
4. knowledge loader 从同一次发布生成 registry、正文和索引快照，revision 由正式内容散列派生；批准完成后切换快照，CLI 发布也触发重载。agent 的 cwd / 正文读取指向该 revision 的只读运行副本，不能只冻结索引却继续 Read 活跃 wiki。新问题使用新快照；续聊跨 revision 时附加知识更新提示并重新检索，不能让旧会话结论覆盖新证据。
5. `src/content/wiki/index.ts` 增加同一页面读取接口的运行时快照适配：连接本机问答服务时，目录、正文和角标从服务同一 revision 加载；离线静态浏览沿用构建快照并显示其版本。批准后的加载失败明确显示尚在旧版本，不呈现“更新成功但正文仍旧”。至少在一次构建后的预览中验证更新，不能依赖 Vite HMR 偶然刷新来通过验收。
6. 角标解析支持 T2 本地 raw 的受限查看入口；只读允许的 raw 文件并跳转行号。来源入口和证据等级分别展示。修复旧 evidence E2E 的 wiki-related 定位，实际操作当前 wiki-next。
7. M1a 验证保存 → diff → 批准 / 驳回 → 新会话；M1b 再补投喂和缺口状态操作。构建预览可用 `pnpm build`、`pnpm preview --port 4174`，并通过同源代理或明确配置连接本机 API，记录实际访问地址。无实际 agent 调用只能标为 stub 验证。

**保留价值 / 省略代价：** 这是用户能感知积累效果的入口；不刷新索引会出现“文件写了，回答没变”。

### T6：M1 闭环验收与收益记录

**部分真实验证（2026-09-15）：** 固定样本及评分依据唯一存于 `scripts/wiki/eval-suite.json`；`pnpm wiki:eval` 仍是零调用预检入口。真实模型的补料、编译、隔离发布与独立复问已执行，实际改善、失败、配置和费用见 [真实验收记录](knowledge-loop-review.md)。严格效果尚未全部通过，T6 / M1a / M1b 不整体勾选；下面保留完整终态步骤。

**后续新增测试：** `scripts/wiki/knowledge-loop.test.ts`；扩充 `tests/wiki-loop.spec.ts`。实际保存路径的测试和真实结果见 [验收报告](knowledge-loop-review.md)，不把这些后续测试名当成已实现入口。

1. 在编译前固定 6 个场景：库内缺少但有来源的问题、该问题未参与编译的等价改写、跨页综合、不同版本的反例、已有知识回归、无证据问题。人工按钉定来源标注预期事实、支持证据与禁止泛化范围；期待答案与保留问题不放入编译 prompt、corpus 或正式 wiki。
2. 运行 `pnpm test scripts/wiki/knowledge-loop.test.ts`，stub 贯通三次独立事件 → 单任务 → 草稿 → 审阅 → 正式发布 → 新会话；拒绝、重复、材料不足、过时批准作为反例。
3. 用真实 agent 重做保存路径（M1a）与缺口路径（M1b）。前后问题均开启新会话，固定模型配置、工具权限、来源 revision；基础对照只读相应 wiki 快照，联网补料在独立编译步骤发生，防止把临时搜到的答案当成知识积累。另跑正常联网问答记录真实使用效果，两组结果分开。
4. 每个答案分开核对检索命中、事实正确、引用支持、版本边界；由来源和人工复核定结果，不能只由生成答案的 agent 自评。原问题和保留改写均需受益，跨页题保留关系依据，不同版本与无证据反例不得误答，原有知识不得退化。失败项不通过挑换样本消除。
5. 报告逐项前后结果、知识 revision、调用次数、费用、审阅时间及重复任务数；保存 / 批准重放不得新增编译调用或页。样本只证明该闭环可用，不能外推全库正确率。逐例证据复核通过后才关闭对应缺口，保留关闭依据。

**M1 通过条件：** M1a 仅代表保存路径经过真实验证；T0–T6 的剩余路径也通过后，才达到 M1b。两次检查都要求正式库无未经审阅写入；AC 完成状态只按映射回填，AC4 / AC6 / AC8 / AC9 仍不能提前勾选。

### T7：确定性巡检

**新增：** `scripts/wiki/patrol.ts`、`scripts/wiki-patrol.ts`、`scripts/wiki/patrol.test.ts`。**修改：** `scripts/wiki/stale.ts`、`package.json`。

1. 红例：断链、孤页、只有年龄、源码变动、仅文档变动、无法解析 ref、文件删除；使用注入时钟和临时 git 仓库。
2. 运行 `pnpm test scripts/wiki/patrol.test.ts scripts/wiki/stale.test.ts scripts/wiki/lint.test.ts`。
3. 复用 lint、T0 audit 与 stale 来源解析。比较引用 commit 与本轮固定的新 tip；未知 ref / 网络失败明确报无法验证，不能跳过后给“健康”。同日多次报告保留 runId，不能静默覆盖历史。
4. 同命令通过；未来入口 `pnpm wiki:patrol` 输出 feature 要求的 warnings，问题非零退出，不写正式页、不更新 seed pin。

**保留价值 / 省略代价：** 捕获累积后的维护债；省略会让知识只增不纠错。

### T8：全库审视、差异候选与重复内容检查

**新增：** `scripts/wiki/{reconcile,drift,overlap}.ts`、`scripts/wiki-{reconcile,drift}.ts` 及对应测试。**修改：** `scripts/wiki/lint.ts`、`package.json`。

1. 红例：跨章节漏边、已有对称边重复生成、公共 H2 模板误判、真实重复无引用、同文本 / 半篇不同词的差异、LLM 同事实换措辞、预算耗尽、F002 生成节被修改。
2. 运行 `pnpm test scripts/wiki/reconcile.test.ts scripts/wiki/drift.test.ts scripts/wiki/overlap.test.ts scripts/wiki/generated-sections.test.ts`。
3. reconcile 按索引、检索与关系取有限正文，记录全库覆盖游标，复用整合器产待审 diff；不直接写关系。overlap 复用正文解析，排除模板标题与代码围栏，只在 feature 条件成立时报错。
4. drift 复用提取器，在固定来源 revision 下生成候选并做规范化集合对比，过滤日期、来源排序、脚本生成节等机械变化；记录旧 / 新来源 revision、提取器版本、分数与预算。阈值只筛复核任务，不能决定自动覆写或事实真伪。
5. 同命令通过；未来运行 `pnpm wiki:reconcile`、`pnpm wiki:drift --sample 1` 后检查只出现报告和待审工作。真实 agent 重复提取记录波动，超过预算停止并报告。

**保留价值 / 省略代价：** 共用审阅器维护跨页结构；省略会留下“内容增加、联系和矛盾无人维护”的缺口。

### T9：接入唯一每日调度并完成全部验收

**修改 / 复用：** [F002 plan](param-lineage-plan.md) 的 `scripts/wiki-sync.ts` 和 Windows 计划任务注册入口；若实施时尚不存在，由此任务补共享入口并回填 F002，不新建第二个调度器。增加 `scripts/wiki/sync.test.ts`。

1. 红例：无网络、某阶段失败、重复启动、预算耗尽、关机错过计划后补跑、工作区有待审变更。运行 `pnpm test scripts/wiki/sync.test.ts`。
2. 每日顺序：刷新上游 refs / 已接入的 F003 corpus → F002 确定性计算 → patrol → 到期的 reconcile / drift → 有预算的编译工作。每步独立结果，依赖缺失跳过并明确原因，任一失败总体非零；排他运行，不覆盖人审中的 revision。
3. 注册单一 Windows 计划任务时指定工作目录、凭据继承和隐藏运行；保留卸载命令。在实施环境实际触发一次并核对日志。本文编写不注册任务。
4. 运行 `pnpm check`、`pnpm build`、`pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml`、`pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/wiki-loop.spec.ts --project chromium`。真实库若失败，记录并修复本 feature 引入或阻塞验收的问题，不降低断言。
5. 更新 feature 的实际 AC 状态和验收报告，列出日期、HEAD、命令、关键输出、真实 agent 与 stub 的区别。未验证项保持未勾选。

## 设计时需核对的条件（历史）

以下记录描述编写计划时的边界，不代表当前状态。实际实现、真实调用、测试文件与可执行命令以 [非批量收尾报告](wiki-nonbulk-review.md) 为准；正文中的拟定测试文件名是拆分任务的设计依据，并非全部按原名落地。

- GitHub token 不阻塞本计划的离线实现；真实 agent 可用性、调用预算和外部资料访问在首次真实编译前核对。本轮未调用 agent。
- sanitize 文件存在已经核对，其适配效果和链式隔离误报率尚未验证，必须由 T2 用例与真实样例决定。
- F002 生成区和调度器是否已在其他工作中交付，实施对应任务前重查；复用最终接口，不照抄历史 plan 中已漂移的实现。
- F001 / F002 的其他历史 AC 勾选校准不在这次两份 plan 的文档改动范围；T0 涉及的前置能力重验后再回填状态。现存源码问题本轮没有修复。
