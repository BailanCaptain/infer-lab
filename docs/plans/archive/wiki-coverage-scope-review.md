# 覆盖诊断范围与补料核对入口

2026-09-15，`infra-view-new-llm-wiki` / `feat/llm-wiki` 未提交工作区。

**结果：** 覆盖诊断现在明确区分机器核对与模型判断，并提供不传递自由文本理由的补料核对入口。它为后续查来源、核对现有页面提供输入；不等于自动补写，也不证明模型理由已经正确。本轮无模型调用，无批量导入，未增加正式知识页。

## Why / 问题与影响

P2，`server/coverage-work.ts` 原成功回执：schema 与逐字引文检查通过后，分类、理由一起作为成功诊断返回，没有机器记录的材料范围和验证层次。上一轮真实缺知识样本包含“即使补齐也不构成定义页”“需要新增页面”，实际只提供了有限摘录，不能支持这些判断。原始证据保留于 [真实分类报告](wiki-classification-review.md)，并未发现它已经污染正式页面。

复现：给诊断 runner 返回合法 `missing-knowledge`、真实逐字引文和上述越界理由；旧实现成功返回 v1 回执，既不标明理由未验证，也没有隔离这些推断的补料交接入口。新固定用例先失败，见 [红例日志](../../tools/wiki-runtime/coverage-scope-red.log)。费用仍使用 fixture 假 runner，不消耗真实模型预算。

## What / 契约与行为

- 新回执 v2 记录实际提供的索引、页面摘录的 hash、字符数和截断状态，明确没有核对外部来源。范围来自清洗后实际发给模型的输入；模型不能自行声明全库已查。
- `validation` 明确：分类是模型判断、理由未验证、证据只完成逐字出现检查。旧理由保留可审计性，不用关键词黑名单冒充语义判断。成功只代表诊断记录成立。
- `pnpm wiki:work prepare --job <诊断 jobId>` 在共用锁内核对输入与回执 hash、当前知识 revision、观察集合 hash，再输出问题、有限范围、逐字引文及待核对类别。始终 `compilationAllowed=false`，不输出模型理由、猜测的参数关系或新建页目标。
- 缺知识先核对来源与现有页；漏检先复核检索；版本问题先核对版本；上下文不明先核对上下文。已有答案也不自动关闭缺口。该入口不调用模型、不创建编译任务、不写草稿，不修改知识或观察记录；一致性检查使用临时工作锁。
- v1 回执保留历史读取并标注 `legacy-unverified`，拒绝用于该准备入口。新配方身份包含回执版本，不把旧诊断静默升级为新验收；未改写任何历史付费轮次。

契约唯一实现在 [`server/coverage-work.ts`](../../server/coverage-work.ts)，CLI 只调用它；模型指导在 [HANDBOOK 查询章](../../wiki/HANDBOOK.md#查询) 引用这一契约。

## Evidence / 本轮验证

- 新增固定样例覆盖越界理由隔离、实际提供范围、真实 CLI 准备输出、知识变化、观察变化、输入篡改、旧回执保留及拒绝升级；同时检查没有新增任务或草稿、缺口仍未关闭。
- 首次相关回归 `pnpm test server/coverage-work.test.ts scripts/wiki/work-cli.test.ts`：**2 files / 24 tests passed**，见 [日志](../../tools/wiki-runtime/coverage-scope-green.log)。随后补充模型伪造验证层次与材料范围必须拒绝的用例，纳入最终全量检查。
- 最终 `pnpm check`：exit 0，**66 files / 569 tests passed（77.82s）**，类型检查、Lint、依赖方向、19 页内容检查与 wiki lint 均通过，见 [全量日志](../../tools/wiki-runtime/coverage-scope-check.log)。没有调整测试时限或断言来让本轮通过。
- `pnpm build`：exit 0，**built in 2.46s**，见 [构建日志](../../tools/wiki-runtime/coverage-scope-build.log)。既有 Vite native loader 与 Biome schema 提示保留。
- 本轮未修改前端或 UX，未新增浏览器复验；真实 CLI 的新入口已在上述集成用例实际执行。此前浏览器结果仍是历史证据，不冒充本轮验收。

## Tradeoff / 尚未验证

本轮证明的是数据交接边界，**没有证明模型自由文本理由已改善**；新 HANDBOOK 未做付费复验。准确引用仍可能不支持结论，有限摘录的缺失不能证明全库缺失。这些限制在机器输出中保留，后续来源准备不得跳过现有页核对与源码证据。

F004 T4 / AC3 保持部分实施，四个 feature 的完整验收状态不因这个入口而改变。下一步是将明确来源快照和现有页核对结果接入共用编译、人审及复问；启动自动 worker 前仍需共享预算。当前入口只准备核对材料，不承担这些尚未实现的环节。

本轮新增费用 **$0**；沿用 [上一轮关闭记账](wiki-classification-review.md#费用与关闭) **$8.7527865 / $10**（含历史未知预留 $0.50），未重置历史预算。

Open Questions：无。

## 后续：来源材料与完整页面核对输入

同日后续实施，继续保持零付费调用。此前入口只有问题、范围和引文，维护者仍需另行找出原始材料、补齐候选正文。现在 `prepare --job <id> --source <raw 行号引用> [--page <已有页 id>]` 可以一次准备这些核对材料；来源与附加页面参数均可重复。

- 来源复用 `prepareRawInput`，验证不可变 raw hash、选定行号及清洗规则；只提供所选行，保留原行号和清洗回执。任意 URL 不能冒充已归档来源，未选行及移除的隐藏内容不进入材料包。
- 提供原诊断候选页及显式附加页的完整清洗正文、文件位置和内容 hash，包括原先诊断因长度省略的段落。目录只用于导航，`unprovidedPageIds` 明确哪些正文没有提供，不能作为全库无此知识的证明。
- 材料包绑定知识 revision 并计算 `contentHash`；使用既有锁与原诊断的新鲜度检查。超量直接拒绝，不截短到刚好缺掉限制条件；离线材料上限的单一真相源为 [`coverage-material.ts`](../../server/coverage-material.ts)。这不是新的模型请求预算，不能直接整包交给付费 runner。
- 输出仍为 `needs-evidence-review`、`compilationAllowed=false`，明确未核对上游真实性与语义覆盖。一个 hash 正确的本地文件可能是模型回答或无关摘录，程序不会因此授予源码实证等级，也不会自动选择新建页面。之后的编译入口仍需核对来源、页面处置与最新版本，不能拿导出的 JSON 绕过检查。

**本次验证：** 新增样例先为 **7 failed / 24 passed**（[红例](../../tools/wiki-runtime/coverage-material-red.log)），实现后相关 **3 files / 34 tests passed**（[通过](../../tools/wiki-runtime/coverage-material-green.log)）。样例实际执行 CLI，并检查原省略段落可见、raw 选行与清洗、稳定输出、不新增任务或草稿；篡改 raw、越界、正文深处的注入、不存在的页面和过量正文均拒绝。随后补充来源数量上限、未归档 URL 与未提供正文目录的检验，纳入最终全量检查。

最终 `pnpm check`：exit 0，**66 files / 578 tests passed（99.00s）**，包含类型、Lint、依赖方向、19 页内容和 wiki lint 检查，见 [全量日志](../../tools/wiki-runtime/coverage-material-check.log)。`pnpm build`：exit 0，**built in 5.05s**，见 [构建日志](../../tools/wiki-runtime/coverage-material-build.log)；原有 native loader 提示和构建插件耗时提示保留。另对三个相关 server 文件执行 Biome 校验通过，62 个文档本地链接存在性检查通过。未修改前端或 UX，未新增浏览器验证。

**进度与费用：** 本次只完成可核对材料的准备，没有完成来源真实性或语义审查，也未接自动采集、付费审查、编译与复问关闭。T4 / AC3 保持部分实施；本次新增模型费 $0，累计记账仍为 $8.7527865 / $10。无需用户确认。
