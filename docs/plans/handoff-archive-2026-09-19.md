> **归档**：这是 2026-09-19 之前逐轮累积的交接流水账，原样保留备查，**不再更新**。当前交接见仓库根 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)。文内相对链接按原位置（仓库根）书写，从这里点会失效；页数、预算等数字是当时的快照。

# LLM WIKI 新会话交接（2026-09-19，接续更新）

> **2026-09-19 新增 vLLM-Ascend 代码导览板块**：正式库 20 → 35 页（第 10 章 6 页、第 20 章 9 页），新增 17 张图。图的载体从 mermaid 换成「手写 spec → 脚本渲染 SVG」；concept / feature 的固定七节骨架放开，只保留 `## 一句话`。这批页**没有走付费 ingest**（我直接读本地钉住的源码手写），也**没有走 `wiki:review approve` 人审流程**——它们已在 `wiki/concepts/` 里、过了全部生产校验，但用户尚未逐页读过。详见第 9 节。
>
> smooth_factor 补充已获用户批准并写入正式参数页，公式、默认值、算例及两个来源已通过浏览器验证。正式库仍20页，其余19页和原raw未变；四题后测尚未运行。累计占用 $17.3115764、48/52 次、paused=true，金额上限仍29美元；保留新增$1未知预留，具体恢复方案待确认。 详见 [真实缺口接续](archive/wiki-real-gap-review.md)。F001–F004仍在进行，三项批量工作继续暂缓。

## 1. 先进入正确目录，保留现场

- **继续实施的目录**：`C:/Users/-/Desktop/infra-view-new-llm-wiki`；分支 `feat/llm-wiki`，HEAD `8175224`。
- 用户默认打开的目录是 `C:/Users/-/Desktop/infra-view-new`；它是 `main`，HEAD `009412b`。**两者不是同一份现状，不要在 main 上重做 Wiki。**
- 原始理念文档：`C:/Users/-/Desktop/infra-view-new/llm-wiki.md`，保持未改。
- 最新文档交接检查，实施目录 `git status --short` 有 **269 条记录**，包含很多未跟踪的新代码、测试和状态文件；不是全由本轮产生。未提交、未合并。不要 reset、clean、覆盖或只从 HEAD 新建一个空工作树后继续，否则会漏掉实现。
- `tools/repos/`、`tools/corpus/`、`tools/wiki-runtime/`、`wiki/_jobs/budget/`、`wiki/_jobs/sync/` 被忽略。新会话应继续用此目录；换电脑或全新 clone 不会带上本地仓库、语料、账本、回执和日志。
- 先读本文件，再读 `AGENTS.md`、四个 feature 的“当前验收核对”、[独立复查报告](archive/wiki-independent-closure-review.md)。根目录旧 `HANDOFF.md` 的首页/城市背景部分保留给其他工作，不能用其历史 Wiki 数字覆盖这里。

## 2. 用户目标与持续生效的约束

面向教学的可视化项目。Wiki 用 agent 将 vllm-ascend 源码、PR 和输入材料增量编译为可维护 Markdown；不训练模型、不部署推理服务、不做性能基准。

外层理念是不可变 raw → 持久 Wiki → 持续更新既有页、交叉引用、矛盾和历史，值得保留的问答也能归档。人负责选材、提问、判断和批准，agent 负责归纳、归档、建链和维护。**“越用越聪明”指持久知识让独立后续回答变好，不是训练模型、堆页数、命中链接或复述上轮会话。**

- 用户已授权常规修复和优化，不需要每个小步骤再问；发现问题要有证据，修 bug 先红后绿，前端要实际浏览器验收。
- **除大规模导入外继续推进**；大规模导入是暂不执行，不是取消需求，也不是 AC 通过。
- 用户已明确扩额至累计 $30 以下，当前政策为 **$29 / 52 次，单次最高 $2**。占用 $17.3115764、48 次、paused=true；旧未知预留 $0.65 与新增 $1 保留，没有清零账目。已有金额授权无需重批；新未知费用暂停的恢复方案单独待确认。
- 正式知识内容必须经过具体 revision 人审；用户已批准显存预算的具体修订并完成发布。此次批准不外推到未来其他事实结论。本轮用户明确要求处理版本名称可读性，已据此完成编辑性修订，无需重复批准。
- 早期仅写交接的轮次已过去。最新已完成真实编译、整合、源码审阅和用户批准发布，并跑完六题前后测、三题引用修复复测及本轮六次可读性/问答复测；生产默认同步仍未重跑。用户当前使用电脑，可直接打开正式阅读页与报告。
- 不再宣称“非批量全部完成”“完美验收”。需要区分：工程机制通过、真实小样本、真实语义未通过、用户暂不执行的批量项、外部失败。

## 3. 三项批量工作，必须全部保留在进度里

| Feature / AC | 最终目标 | 当前进度与边界 |
|---|---|---|
| **F001 AC5 · 批量灌种** | 第 10–21 章全部特性及 `forwardLayer.ts` 的 30 个术语；预计 120–160 页；`wiki:lint --terms` 核对术语覆盖 | **未执行全量灌种**。现有 11 页 KV Cache 试点 + 9 页参数，共 20 页；新参数页为本次单页补写，不是全量灌种完成率。全章节 seeds 补全、30 术语全部有页均未完成验收。放量还需试点语义复核与上下文/预算验证 |
| **F002 AC4 · 全部参数骨架** | 已确认参数全量确定性生成，lint 与重复生成幂等 | **未生成全量参数页**。生成器和保护规则可用，只接入 8 个旧页。历史 main 扫描 542 候选 / 405 suspect 是候选数，不能当确认参数数；本次 scanner 又补了形态，不能把旧数当最新扫描数。大规模分类、骨架与后续补文均未执行 |
| **F003 AC1 · GitHub 全库初拉** | 全部 issue / PR、正文/评论、完整分页续传、同窗口总数核对、抽样对照 | **未执行全库初拉**。生产语料仅 2 issue + 2 PR；没有全量完成检查点。检索评测另有 30 条冻结样本，不等于生产已导入 30 条，更不等于全库 |

F004 没有另一项“灌满全库”的目标，但真实投喂、真实缺口补写和真实维护判断仍未全部验收。不要因没有批量项而标 F004 完成。

## 4. 四个 feature 的全部 AC 快照（12 + 6 + 7 + 9 = 34）

规范和后续状态唯一维护在 feature；下表只是交接当天的摘要，不新建另一套百分比。计划文件都已存在：F001 `docs/plans/llm-wiki-plan.md`，F002 `param-lineage-plan.md`，F003 `github-corpus-plan.md`，F004 `knowledge-loop-plan.md`。旧 plan 中“尚未实施”的阶段性描述可能过时，以当前 AC 表、实际代码和证据为准。

### F001 · [LLM Wiki](../features/F001-llm-wiki.md)

| AC | 已有与仍缺 |
|---|---|
| AC1 | Handbook 规则/格式底座已有工程回归 |
| AC2 | build / lint / 索引派生与一致性已有工程回归 |
| AC3 | 批次执行、pin、并发、失败隔离、持久草稿、整合机制已测；真实多 ref 提取未在最近修复后重新完整验收 |
| AC4 | 历史 11 页试点保留；Prefix Caching 过度纠错已撤回。107 条 raw 提示完成逐项核查：99 全范围一致、1 局部原文、6 差异另有阅读说明、1 URL 可访问；不是 107 条材料缺失。显存预算与上游的错误对比已批准发布；19 页未逐句全面重审 |
| AC5 | **全量灌种未执行**，见上一节，不能漏列 |
| AC6 | 阅读、目录、跳转、证据角标、快照/离线机制有浏览器证据 |
| AC7 | 原对照保留；最终输入修复后三题引用结构3/3，仍有语义边界。smooth_factor 已批准发布，四题后测尚未运行，不能算真实问答质量全部通过 |
| AC8 | 聊天保存与 PR 接入共用待审管线；真实 PR #11953 编译超时，未成功生成草稿 |
| AC9 | 多 ref pin / clone 工程回归及真实 Git 统计有证据；不能替代真实 agent 多 ref 重提取 |
| AC10 | retrieve 单一入口接关系与报错检索，工程回归通过 |
| AC11 | 图符号来源检查接 lint / 审阅；本地 pin 检查有证据，不代表图中每个语义断言均经人工确认 |
| AC12 | 成功且引用通过后派生相关页，实际浏览器点击通过 |

### F002 · [参数谱系](../features/F002-param-lineage.md)

| AC | 已有与仍缺 |
|---|---|
| AC1 | AST 字段、字典键、字符串查找及 Ascend 包装器；保留默认表达式和条件线索，8 个旧定义已在真实 pin 核对 |
| AC2 | 疑似项三态、逐字证据、未定项保留和预算机制已测；真实 LLM 分类准确性未验收 |
| AC3 | Git 谱系可用；`layer_sharding` 按全仓 `*.py` 口径为 8/9/14/0/0/1/0/0，移除提交 89601215 / PR #11953；文本残留不是功能恢复 |
| AC4 | 骨架/生成区保护、旧 ID 映射、原 raw 保留已测；8 个旧页刷新静态事实，正文 8/8 保持；**全量生成未执行** |
| AC5 | 选择性补文与生成区保护有固定输出回归；最近这套链路的真实 LLM 补文未通过验收。历史 8 页内容存在不等于新版机制真实验收 |
| AC6 | 增量 Git / CLI 用例通过；09-16 03:00 实际执行失败。当前副本复现 Python 3.9 无法解析新语法，换 3.12 后触发 13 页超过上限 3；已固定同步解释器、保留超限暂缓并允许后续巡检、持久记录错误。生产到点运行未重新验收 |

### F003 · [GitHub 语料](../features/F003-github-corpus.md)

| AC | 已有与仍缺 |
|---|---|
| AC1 | 分页和断点机制已测；**全量初拉未执行**，实际 2 issue / 2 PR |
| AC2 | 编辑/删除、检查点、重复采集机制及真实小样本 changed=0 有证据；全库计数核对未做 |
| AC3 | 真实无效 token 的 401 及离线网络/限额/404 分类有历史证据；本次没有重新联网验证 |
| AC4 | 固定 10 个真实 traceback 对 30 条样本：Top-1=9/10、Top-5=9/10，无匹配对照=0；不外推全库 |
| AC5 | 真实链路 #15815 → #15981 → 87c345c1 → `origin/releases/v0.26.0rc`；当时 tags=[]，不虚构发布 tag |
| AC6 | 重要 PR 排队、清洗、diff 材料和待审管线已实现；真实 #11953 编译失败，须先核费用，不能当作已成页 |
| AC7 | 10 条真实样本的 12 个文档链接已解析，9 个映射成功，3 个因本地缺对应 ref 明示失败；不是所有版本映射已齐全 |

### F004 · [知识积累](../features/F004-knowledge-loop.md)

| AC | 已有与仍缺 |
|---|---|
| AC1 | 投喂归档、清洗、去重、草稿后跨页整合和统一 reviewId 有工程证据；真实投喂完整质量验收仍缺 |
| AC2 | 七日投喂隔离、普通系列放行、阻塞输入不调用模型有回归；不是注入防御的完备证明 |
| AC3 | 真实生产三次观察→唯一任务→独立诊断→四类前测→编译→离线整合→用户批准发布已有证据。自动整合超时；后测和缺口关闭未完成，不外推全自动闭环成功 |
| AC4 | 巡检机制已测；首次每日运行失败。修复后的真实源码隔离副本已执行巡检，findings=[]，不代表生产每日运行通过 |
| AC5 | origin 默认 seed 与投喂标签有 schema / 浏览器证据；真实正式库仍全部 seed |
| AC6 | 分批交叉审视、引文支持关系 diff、批准后派生反向边和去重已测；真实关系/矛盾判断准确性未验收 |
| AC7 | supersede 旧结论/日期/依据留痕和批准校验已测；Prefix Caching 提案已撤回，显存预算实质纠错已由用户批准并发布，保留原结论历史 |
| AC8 | 差异检测、阈值和重写队列有固定提取回归；真实模型重提取波动及是否真过期未验收 |
| AC9 | 跨页重复 lint 的失败/加关系后通过有回归 |

## 5. 夜间维护调查与纠错提案重建

本轮只读查 Windows 计划任务与运行记录，得到：

```text
TaskName: LLM-Wiki-infra-view-new-llm-wiki
State: Ready
LastRunTime: 2026-09-16 03:00:00 +08:00
LastTaskResult: 1
NextRunTime: 2026-09-17 03:00:00 +08:00
wiki/_jobs/sync/daily-lease.json: active=false
```

`wiki/log.md` 末尾的失败记录保留。原始 stderr 未落盘、未找到可还原的任务事件；无法保证还原了历史唯一根因。本轮在临时 Wiki 副本禁联网/禁模型执行实际同步代码，稳定复现 Python 3.9 对 `c267db73:.../patch_speculative_config.py:125` 的语法错误；换用 3.12 后又复现新增骨架 13 超过上限 3。没有为排查重跑生产默认 sync。

已修复：同步配置 `python` 固定本机 3.12；AST 继续严格失败、不跳源码；超限整批暂缓、不推进该 ref 检查点，仍执行巡检并非零退出；`wiki/_jobs/sync/last-run.json` 与 `run-<指纹>.json` 持久保存阶段/错误/结果。真实本地源码隔离复验 main deferred=13、v0.23.0 changed=false、patrol findings=[]、modelCallsAllowed=false。生产任务仍待下次到点证据，日志与测试见 [接续报告](archive/wiki-resume-review.md)。

配置 `wiki/sync.config.json`：fetch=true、parameters=true、github=true、每个 repo/ref 新参数页上限 3；maxTasks=0、reconcileBatches=0、driftSample=0。没有全库检查点时不自动首次全拉；目前收费维护关闭，但不是整项任务暂停，后续仍会按时运行。若要复现，应先准备保留错误输出、限制写入/网络范围的诊断方式；别用默认 sync 当只读检查。

已批准发布的纠错：

- 已发布 ID：`e6061568bf6f6a08bac26cb5c95c07e877df66e930f43a76e207f0cf996b16d5`，**published**。用户回复“同意”后，将“昇腾侧和上游的关键分歧在分母”改为“这里的预算按整卡显存计算，上游 vLLM v0.23.0 也是这样算的”，补固定提交来源，保留公式、算例与旧说法历史。
- 上游 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/worker/utils.py:405–425` 明确使用 `total_memory * gpu_memory_utilization`。旧包 `18039172…` 首次批准时被历史校验拦截：本地生成器修改 gray-matter 共享元数据，导致新增来源误列入旧文来源。已改用独立解析重建；独立进程核对正文及决策逐字相同，唯一差异为删去错误的旧来源第 22 条，旧包 rejected。沿用用户对该内容的批准完成发布，无需重复审批。
- 发布命令完整校验通过，日志 `tools/wiki-runtime/memory-approved-publish.log`；重建差异证据 `memory-rebuild-verification.json`。正式页及 registry 已写入；生成脚本仅用于本地提案，没有改生产校验规则。
- Prefix Caching 包 `dd3bf215fb029b5c8f3ddcc13d3defb9866e6fea19f89331753c66b5baba434c` 已 **rejected**：测试未覆盖不能推翻缓存原理，用测试边界替换原理解释不适合教学。不再要求用户批准，也不要运行旧脚本恢复。
- 更早 `6d313556018a19d5f815dd0187273f1ade4437ed4c051dff793ca048bd1eb707`、`453e524890ec6202609b925f7a0e0c5adebebb82db331fbb69a11bceba5adaae` 也均 rejected。旧 diff 和验证日志只保留为历史。

## 6. 预算、正式补页与真实验收

**本轮最新暂停原因**：自动整合60秒超时，原始回执没有实际费用，新增$1未知预留保留。已批准内容通过正确修订分类发布为137c1532…；原eca7bf4e…因误标纯追加已归档驳回，同一已批准正文未改变，仅追加系统历史。四题后测方案已准备，暂停尚未解除，不需要重复审批正式页。

smooth_factor 补充已获用户批准并写入正式参数页，公式、默认值、算例及两个来源已通过浏览器验证。正式库仍20页，其余19页和原raw未变；四题后测尚未运行。累计占用 $17.3115764、48/52 次、paused=true，金额上限仍29美元；保留新增$1未知预留，具体恢复方案待确认。 补料判断曾用原始付费响应本地重新校验恢复，原失败与费用保留。

用户明确授权“预算可以到30以下都行”，当前共享 policy：limitUsd=29、reserveUsd=2、maxCalls=52；**chargedUsd=17.3115764、calls=48、paused=true**，剩余 $11.6884236 / 4 次。占用包含历史未知 $0.65 和新增未知 $1，不等于全部确认实付。原账本与原失败尝试完整保留，授权原文及前后状态见 tools/wiki-runtime/budget-30-authorization.json。不能另开账本重置次数；本次授权无需重复询问。

历史未知调用 76128abc-ee51-43ce-aac7-ece041eec60a（PR #11953 worker-compile，60 秒超时）仍 unknown；对应 026efb56… 任务 failed。75de3a19… 为 superseded-source 而 closed，不是成功补页。本轮新增调用都有费用回执，没有新增未知费用。

原 $0.15 轮六题有五份完整、一份失败，之后编译失败且 8/8 耗尽，见 [历史停点](archive/wiki-real-baseline-review.md)。这不是当前限制。扩额后原任务重试拿到正文，但孤立草稿被 lint 拒绝；修复编译输入缺导航后，新 recipe 任务 b2ca1518… 产出有效草稿，旧 cf28e5a3… 失败与费用保留。真实整合及源码审阅后，用户明确批准 38cca26d…；发布器完整校验通过，原 19 页逐字保持，新增 params/profiling-chunk-config.md。完整证据见 [本轮报告](archive/wiki-budget-30-review.md)。

新固定对照：suiteRevision=d8fde337…，模型 claude-sonnet-4-6，前后均每题 $1 / 300 秒、独立会话、只读快照、禁联网；前测知识 fbdf0fa7…，后测知识 84e2d9aa…；判准未进入编译或问答输入。tools/wiki-runtime/eval-budget-30/ 保存前后各 6 份完整原始回执。配置检查及 need_timing 版本答案有改善；两轮引用结构均只有 3/6。改写题后测冒用 C1，槽位题出现先 896 后 898 的矛盾，不能算完整验收通过。

追加引用修复从当前候选页生成可复制的真实编号并复用生产校验器，不放宽结果检查。单独三题复测在 eval-citation-guide-30/：引用结构 2/3；槽位本次一致为 898，但来源标记的语义对应仍未全过；改写题还把 2c59ff10 误称 main。不得把结构通过当作事实和版本通过，也不得将这轮提示修复归因于新文章。

最新可读性编辑 66ca6029… → 2d179f39… 已发布，原 19 页与 raw 未变。正文分支名称依据 seeds 与真实 Git 核对，原来只留短哈希属于过度修正。本轮四题修复验证引用结构 2/4；再简化问答后两题 1/2。最后从实际请求查出 sourceLinks 复制指令与手册冲突，已删除程序层的重复引用/组织指令，只注入页面链接和关系导航；46 项工程回归通过，未进行此最终代码修复后的真实模型复测。记录见 [本轮可读性报告](archive/wiki-readable-versions-review.md)。

本次为直接源码补页，未伪造生产 gap 三次观察/诊断/排队/关闭。生产 wiki/_jobs/retests/ 的四类逐任务冻结方案，与 scripts/wiki/eval-suite.json 的六场景协议不同，接续时不要混为一套。仍需真实自动 gap 闭环、参数复核/补文及维护判断的验收。当前没有待重复批准的内容包。

## 7. 产物与证据债务

- 最新正式库：**35 页**，concepts=26、params=9，schema problems=0，origin 仍全部 seed。其中 15 页是 2026-09-19 新增的 vLLM-Ascend 代码导览（见第 9 节），另 20 页为原有内容、正文未改。新增 profiling-chunk-config 已批准发布；没有正式 drop / chat / gap / pr 页面。原 19 页及 raw 原文保持，见 profiling-publication-verification.json。
- `readCorpus`：issue #15815、#16625；PR #11953、#15981，共 4 条。
- 8 个旧参数页身份在 `wiki/params/identities.json`，包含 8 个定义、4 个 reference；新页 hash ID 与旧公开 ID 不混用。旧页更新生成区，不把 suspect 自动认定为真实参数。
- 上一轮、显存修订发布前重新运行来源审计：418 来源，411 本地行号有效，7 URL 不由该命令联网校验，107 raw 结构提示；无无效 commit / 缺文件 / 越界 / 未知仓库。日志 `tools/wiki-runtime/evidence-review-audit.log`。另实际打开 CPU Offload 官方 URL，当前可访问。本次发布新增 1 个固定上游 URL，旧审计总数不能冒充发布后总数。
- 107 条集中在 Block Table 20、CPU Offload 1、Memory Profiling 21、Quantization 26、fuse_allreduce_rms 16、layer_sharding 23。本轮逐项比较为 99 全范围一致、1 局部原文、6 差异另行阅读、1 URL；结果与哈希见 `tools/wiki-runtime/legacy-excerpt-comparison.json`，详细解释见 [核查报告](archive/wiki-evidence-review.md)。原 raw 未改，不把今天读取的源码伪装成旧 agent 已读记录。
- 所有正式页尚未逐句全面语义复核。显存预算的上游对比有直接源码反证，最小修订已批准发布；Prefix Caching 旧纠错依据不足，已撤回。文件和行号存在不是“结论正确”。

## 8. 最近实际验证记录与关键实现位置

本轮全量 `pnpm check`：93文件/651项通过（157.96s，显式WIKI_PYTHON为同步配置的Python3.12）。随后编译失败输出持久化修改的4文件/28项回归通过；最终构建3.41s。预算拒绝恢复、单一JSON围栏解析、编译失败响应保留均有先红后绿证据。详见真实缺口报告。

本轮最终验证：4 文件 / 46 项通过（5.38s），服务端 3 文件 Biome 检查通过，构建含 TypeScript 通过（3.28s）；标题、分支名、来源已实际浏览器验证。日志见可读性报告。

前轮完整验证：`pnpm check` 93 文件 / 648 项通过（168.85s），类型、项目 Lint、依赖、内容和 Wiki lint 通过；server 本轮 5 文件另用继承原规则的临时 includes 检查通过。`pnpm build` 通过（3.42s）。日志 `tools/wiki-runtime/citation-guide-check.log`、`citation-guide-build.log`。真实桌面审阅与正式阅读页、来源链接已操作验证；`profiling-review-browser.json`、`profiling-reader-browser.json`。批准 manifest 与实际写入匹配，原 19 页未改、正式页 20，`profiling-publication-verification.json`。详情见 [本轮报告](archive/wiki-budget-30-review.md)。

最新文档核对：13 个文件的 34 条 AC 全部保留，104 个本地链接无断链，正式页 20、schema problems=0，见 `tools/wiki-runtime/budget-30-doc-check.json`；`git diff --check` 通过。

前轮验证：修复“知识库内没有”正常拒答误判，先红后绿；`pnpm check` 93 文件 / 645 项通过（250.96s），类型、Lint、依赖、内容和 Wiki lint 通过；`pnpm build` 通过（5.50s）。日志 `baseline-followthrough-check.log`、`baseline-followthrough-build.log` 均在 `tools/wiki-runtime/`。手机尺寸浏览器验证正常拒答及无引用断言两种状态，2 passed（34.1s），`baseline-abstention-browser.log`。裸编号未绑定页面仍拒绝，未放宽事实引用要求；这些测试不算知识改善后测。

前轮文档检查覆盖 12 个入口/feature/报告文件：34 条 AC 全部保留，97 个本地链接无断链，正式页 19、schema problems=0；证据 `tools/wiki-runtime/baseline-followthrough-doc-check.json`。`git diff --check` 通过；大量既有未提交文件保留。

此前预算恢复实现：93 文件 / 644 项通过（166.20s）、构建通过（3.91s），见 [预算恢复记录](archive/wiki-budget-resume-review.md)。该报告只读预览及首题状态属于历史，当前以第 6 节为准。

前一轮维护修复的完整验证：`pnpm check` 退出 0，92 文件 / 638 项通过（105.44s），类型/Lint/依赖/内容/Wiki lint 均通过；`pnpm build` 通过（3.03s）。日志 `tools/wiki-runtime/resume-check-final.log`、`resume-build.log`；设置 `WIKI_PYTHON` 为同步配置中的 Python 3.12 路径。真实源码隔离复验和先红后绿见 [接续报告](archive/wiki-resume-review.md)。显存修订已通过正式发布校验，发布后 Wiki lint 通过、构建通过（2.57s，`memory-publication-build.log`），所有正式写入与批准包一致（`memory-publication-verification.json`）。没有重跑这 638 项，不冒充最新结果；无 UI 改动、无新浏览器验收。

以下均为前一轮执行、本轮重新读取的日志，不冒充本次新跑测试：

| 命令 / 证据 | 结果 | 日志（相对 tools/wiki-runtime） |
|---|---|---|
| pnpm check | 92 files / 634 tests，103.54s；类型、Lint、依赖、内容、Wiki lint 通过 | loop-check-final.log |
| 追加 server/answers.test.ts | 9 passed，2.67s；其中新增一个元数据兼容参数化回归，不与 634 简单相加 | loop-save-metadata-test.log |
| 五个 Wiki / evidence Playwright 文件 | 修复元数据可见问题后 30 passed，46.3s | loop-browser-green.log |
| pnpm build | 最终 built in 2.06s | loop-build-final.log |
| pnpm lint | 269 files；保留 CSS 1 warning / Biome 2 infos | loop-lint-final.log |
| pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml | 上述 19 页 / 418 来源 / 107 raw 未验证 | loop-audit.log |
| 8 个旧参数真实 pin / CLI / 正文保持 | count=8、新增 0、authoredPreserved=8 | legacy-static-refresh.log、legacy-static-preservation.json |

实现入口：`scripts/wiki/draft-review.ts` 共用跨页提案；`worker.ts` / `drop.ts` 产 reviewId；`retest.ts` 冻结与前后测；`params/identities.ts` / `provenance.ts` / `publish-sync.ts` 维护旧参数；`server/coverage.ts` 与 `gap-sources.ts` 处理中文/版本；`repo-roots.ts` 统一 seeds 仓库解析。`ChatDrawer.tsx` 用 skipHtml 隐藏覆盖协议，后端观察仍保留。

旧复查发现的断点已修：手动拼接整合、前测方案后置、旧 ID 静默漏更新、get 默认值漏报、中文信号漏记、多 seeds 路径不一致。新的 worker 正/反例经过完整校验器，没有 `validate: () => []`。**固定模型输出仍然只证明机制**。

## 9. 新会话继续的顺序

1. 读本 handoff、AGENTS、当前 feature 表及本轮报告；确认 feat/llm-wiki 工作目录并保留所有未提交文件。
2. 预算金额已授权累计30美元以下，已发布内容无需重批。后测安排四次、每次预留1美元，调用保护已调整52；新增未知收费暂停尚未解除。具体方案 ec588c10… 及完整账本见 real-smoothing-gap/posttest-budget-preparation.json。
3. 原六题前后测、三题引用复测及本轮六次修复验证均已保留。先读实际请求冲突修复及剩余语义问题；当前优先不收费的来源/输入检查。最终输入修复后三题结构3/3，但改写题有提交映射疑问，随后已把分支名绑定固定源码；不能改判准、改旧答案或反复收费碰运气。完整真实验收尚未通过。
4. smooth_factor 已批准发布为137c15321ae02fd3c6b3c7a2529b6e4bb2df310cd3d62592432d1613a8b79831。先处理新的未知收费恢复确认，再以同一任务和已冻结问题运行四题后测并逐题核对；禁止重复补写、重做前测或只按引用格式关闭。其他参数补文、维护判断及19页全面语义审查仍缺。
5. 03:00 维护仍需到点生产回执；隔离副本复现及修复不能替代生产成功。当前收费维护默认关闭，不手动重跑默认 sync 当只读检查。
6. F001 灌种、F002 全量参数页、F003 全库初拉继续暂缓。不提交、不合并，除非用户另行要求。

当前无需用户再次审批已发布页或已有预算授权；本轮已准备本地次数与后测计划，新未知收费恢复待确认；真正未完成的是上述真实质量和自动化验收，不是“只剩人工确认”。


## 9. 2026-09-19 · vLLM-Ascend 代码导览板块

用户要求在知识库里加 vllm-ascend 板块，让问答能精准回答代码结构类问题；明确要求**不要 mermaid**（要手绘图）、**不要固定的标题排版**（「每个知识点都应该不一样」）。这两条都与既有机制冲突，所以先改了工程再写内容。

### 9.1 两处机制改动

**图的载体换掉。** 原来正文里唯一能进 DOM 的图是 ```mermaid``` 围栏（`WikiPage.tsx` 的 react-markdown 没挂 rehype，裸 SVG 只会变字面量，`stray-tag` 还会报错）。现在：

- 真相源是手写的 `wiki/diagrams/<id>.yaml`——方块文字、**人工指定的坐标尺寸**、边、以及每个方块对应哪个钉住的源码 `source` + `symbols`；
- `pnpm wiki:diagrams` 把 spec 确定性渲染成 `<id>.svg` 并入库，`--check` 接进 `pnpm check`；跑两次字节相同；
- 正文用 ```wiki-diagram 围栏引用，`WikiDiagram.tsx` 按白名单重建后内联（照 `Mermaid.tsx` 的既有模式）；
- AC11 的图符号来源检查从 mermaid 迁到 spec：逐方块对钉住 blob 查 `symbols`，比原来按整页 sources 合并查更严，错的方块能指名道姓。旧 18 张 mermaid 的检查路径**原样保留**，两套机制并存。
- **为什么不是直接手画 SVG**：手画 SVG 的箭头是坐标，问答 agent 读得出方块上的字、说不准谁指向谁。spec 的 nodes / edges 是显式的。已实测：`materializeSnapshot` 出来的 agent cwd 里有全部 17 个 spec + svg，读 spec 直接拿到 `{from, to, label}`。

**固定分节放开。** `REQUIRED_SECTIONS` 里 concept / feature 收缩成 `["一句话"]`（param 的四节不动，那是脚本生成的参考骨架）。关键细节：`cross-page-overlap` 的样板标题表原来**从 `REQUIRED_SECTIONS` 派生**，不解耦的话「不再强制骨架」会顺手把重复检测一起关掉——已抽成独立常量 `BOILERPLATE_HEADINGS` 并配回归测试。证据类规则（sources 非空、标记编号绑定、relation note、来源白名单）一条没放宽。

顺带修掉一个既存 bug：`WikiPage.tsx` 的 `TYPE_LABEL` 漏了 `param`，9 张参数页在阅读页显示的是原始字符串 `param`，现已显示「参数」。

### 9.2 内容

15 页，全部钉在 `releases/v0.23.0@2c59ff10`（主叙述）+ `main@28bf3a2e`（对照），与既有 20 页同一组 pin，没有重新 clone。seeds 落在 `wiki/seeds/vllm-ascend-code.yaml`，让这批页以后能被 `wiki:audit` / `wiki:sync` 巡检。

- 第 10 章：`vllm-ascend-overview`、`platform-plugin-registration`、`npu-platform`、`ascend-patch-system`、`engine-processes`、`ascend-config-system`
- 第 20 章：`vllm-ascend-repo-map`、`npu-worker-lifecycle`、`npu-model-runner`、`request-call-chain`、`prepare-inputs-flow`、`attention-backend-family`、`ops-and-kernels`、`graph-mode-layer`、`reading-vllm-ascend`

这两章此前是 PLAN.md §1.1 里**预留但零页**的槽位，不是新开的分类。

### 9.3 已验证与未验证

已验证（本轮实跑）：

| 项 | 结果 |
|---|---|
| `pnpm check` | 665 项测试通过、依赖 / 内容 / `wiki:diagrams --check` / `wiki:lint` 全绿 |
| `pnpm build` | 4880 模块，4.38s |
| `pnpm wiki:build` ×2 | `index.md` 与 `registry.json` 两次字节相同 |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend-code.yaml` | 35 页 / 550 条来源，行号有效 536、无效 commit 0、文件不存在 0、越界 0 |
| 浏览器实测（dev server） | 15 页全部渲染；17 张图全部以内联 `<svg>` 出现、`failed=0`；证据角标点进钉住行号（如 `…/blob/2c59ff10/vllm_ascend/platform.py#L128-L146`）；关系导航可跳；参数页类型标签已修正；桌面宽度无横向溢出 |
| 检索（免费，无模型调用） | 8 道代码结构题，正确页全部命中 Top-1 |

**未验证 / 未做**：

- **没有跑真实问答**。预算仍 paused（$17.31 / $29、48/52 次），本轮一次付费调用都没发起。检索命中 ≠ 回答质量。
- **没有走 `wiki:review approve`**。这 15 页是直接写进 `wiki/concepts/` 的，过了全部生产校验，但用户尚未逐页读过、也没有批准记录。
- **旧 18 张 mermaid 图没有迁移**，全站两套图机制并存，是明知的临时状态。
- **手机上密集图会被缩到约 300px 宽，字太小**。给图加 `min-width` 会让整页横向溢出（阅读栏本身是内容撑宽的），要修得动 `.wiki-shell` 的共享布局、影响已发布的 20 页，本轮已还原该实验，留作单独一轮。
- 15 页正文未经逐句语义复核；文件与行号存在不等于结论正确。
- 未提交、未合并。

### 9.4 新增与改动的文件

新增：`scripts/wiki/diagrams.ts`、`scripts/wiki-diagrams.ts`、`src/content/wiki/WikiDiagram.tsx`、`wiki/diagrams/`（17 组 yaml + svg）、`wiki/seeds/vllm-ascend-code.yaml`、`wiki/concepts/` 下 15 页、测试 `scripts/wiki/diagrams.test.ts`、`server/snapshot-diagram.test.ts`。

改动：`scripts/wiki/lint.ts`（必需小节、样板标题解耦、spec 校验接入）、`scripts/wiki/diagram-audit.ts`（加 spec 路径，保留 mermaid 路径）、`server/snapshot.ts`（图进 digest 与快照目录）、`scripts/wiki/reader-plugin.ts`、`scripts/wiki-audit.ts`、`src/content/wiki/schema.ts`、`src/content/wiki/reader-store.ts`、`src/app/pages/WikiPage.tsx`、`wiki/HANDBOOK.md`、`package.json`，以及三个既有测试文件。
