# LLM-Wiki F001–F005 整体独立审查

审查日期：2026-10-08。工作树：`C:\Users\-\Desktop\infra-view-new-llm-wiki`，分支 `feat/llm-wiki`。本报告由独立审查 agent 编写；主会话负责修复，不由审查者代为批准正式发布。

## 审查结论

初审发现 **1 项 P1、4 项 P2**。其中一项是正式教学页的首屏定义范围错误，一项是参数身份解析在补写入口断开，一项是聊天接口漏同源写入检查，一项是现行审计与机器修订历史的协议冲突，一项是状态页对模型调用和额度边界的错误承诺。它们是实际内容、代码或浏览器观察支持的缺陷，不是为了补齐清单而推定的风险。

因此，**初审时不能维持“不附条件地全部完成、没有待处理问题”的结论**。现有证据充分支持 F001–F005 的主体能力已实现，并且完成了相当多的约定验收；不能据此推导当前正式内容没有核心错误、所有跨入口契约一致、默认检查命令稳定，或所有参数都有可用的正式教学答案。修复及复审状态见文末，以下保留初始复现，不用修复后的状态抹掉初审发现。

**16:29 发布闭合更新（主会话核验）**：用户已批准 `16282a8a656d3d907de33e76dd13298db716663b3c7a8c73baae40f7cac9ef0d`，实际状态 published；正文、图 YAML/SVG 与 raw 共 4 文件逐字一致，正式浏览器和发布后审计通过。R1 正式关闭，连同此前 R2–R5，本次发现的 5 项问题全部闭合，F001 恢复 completed。开发及限定验收完成不表示全库逐句人工审查、未确定参数或硬件证据边界已消失。下文 pending 等描述保留为审批前的历史记录。

### 初审时的正式库状态

- 本审查于北京时间 15:28 独立核对发布包 `31c511c187fc9909688a24ec46339e71aa8f4f159ddb8bf46f2f7899f60e1836`：状态为 `published`，8 项写入与正式磁盘内容逐字相同（4 个参数页、4 份 raw）。这是用户已经批准的包，不是本审查新批准。
- 内容寻址的 `sha256-*` raw 共 67 份，67/67 的文件名与内容哈希相符。该数字不包含全部历史命名 raw，也不证明 raw 与任意教学结论的语义关系正确。
- 浏览器只读查看正式页面和状态栏：145 页（106 concept、33 param、6 source）、30/30 课程术语、待审 0、排队 0，保留 1 条硬件证据缺口；夜间任务、reconcile、drift 配额均为 0。
- 本机三份扫描实际合计 1,112 条：106 certain、283 param、378 not-param、345 undetermined。跨版本记录不是唯一参数身份计数。

以上独立数据和固定源码摘录保存在 `tools/wiki-runtime/overall-review-20261008/independent-state-and-source.json`。主会话另在审查开始保存了 918 个核心代码、正式页、raw 和 feature 文件的基线哈希（`baseline.json`）。

## 按严重级别列出的发现

### R1 · P1：MLP 页面把 RMSNorm/pre-norm 示例写成所有 Transformer 子层的共同定义

**位置**：`wiki/concepts/mlp-residual-norm.md:5`（摘要）、`:51`（核心定义），以及 `:73`、`:123` 附近的无条件公式／最终 RMSNorm 必要性表述。行号针对初审版本。

**触发与实际表现**：读取目录摘要或首屏定义，读者会得到“每个 Transformer 子层都先做 RMSNorm、再做注意力／MLP、最后残差相加”的通则。同页后文又承认原始 Transformer 使用 post-norm。固定源码中也直接存在反例：`vllm@0fc695fc:vllm/model_executor/models/gpt2.py:160,164,171–181` 使用 LayerNorm；`opt.py:146,175–196` 根据 `do_layer_norm_before` 区分前置和后置 LayerNorm。pre-norm 本身也不推出最终归一化必须是 RMSNorm。

**期望**：首屏就限定这是本页采用的单路残差、RMSNorm/pre-norm 示例；保留 LayerNorm/post-norm 的不同架构选择。关于末尾归一化的说法须限定到实际所述模型，而非由 pre-norm 数学上必然推出。涉及 GLM 的 mHC 分支时继续遵守页面已经声明的版本和模型边界。

**影响／根因**：核心概念的适用条件从首屏和摘要丢失，会进入检索摘要与后续回答；靠正文后段补例外无法修复首屏通则。按 `docs/wiki-writing-standard.md` 对核心定义／概念错误的规则定 P1，不表示服务整体不可用。

**证据**：本审查实际 `git show` 固定对象，编号摘录保存于 `independent-state-and-source.json`。这不是以 lint、引文存在或语言风格推定内容错误。建议做最小修订并按正式审阅流程发布；审查者没有修改该页。

### R2 · P2：参数补正文入口没有使用已生效的身份绑定

**位置**：初审 `scripts/wiki/params/ingest.ts:24–30`；CLI `scripts/wiki-params-ingest.ts:39–47`。对照公共解析器 `scripts/wiki/params/identities.ts:28–46` 与 `publish-sync.ts` 的调用。

**复现**：运行 `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/param-identity-repro.ts`。在临时夹具里扫描 `ExampleConfig.limit`，先建立合法的 `legacy-limit` 骨架和显式 `definition` 身份绑定，再通过真实 `ingestParam` 补写；模型由本地固定 runner 代替。

**实际**：公共 `parameterPageId` 返回 `legacy-limit`，但 ingest 重新按哈希生成 `limit-ea98aca88468`，随后报“发现同名旧参数页，需先显式迁移映射，拒绝创建重复页”；runner 调用 0。`param-identity-repro.json` 保存原始结果。

**期望**：有合法定义绑定时补写该稳定 ID；显式 `reference` 不被当作独立定义再次补写；CLI 的筛选、dry-run 和实际执行须使用相同解析规则。真正未映射的冲突仍拒绝。

**影响／根因**：F002 的骨架／同步已经支持迁移身份，F002 AC5 的补正文却不能使用同一身份；实际正式映射中已有旧 ID，因此不是只有新建任意夹具才会遇到的配置形态。根因是补写和 CLI 绕过共同身份真相源。

### R3 · P2：聊天 POST 缺少本机写接口的同源检查

**位置**：初审 `server/chat-route.ts:92–94`，对照 `server/http.ts` 的 `checkWriter`；前端调用在 `src/app/wiki/ChatDrawer.tsx`。

**复现**：运行 `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/chat-origin-repro.ts`。临时夹具启动真实 `handleChat` HTTP 路由，替换模型 runner；发送 `Origin: https://untrusted.example`、`Sec-Fetch-Site: cross-site`、`Content-Type: text/plain`，不带本机写入请求头，正文为聊天 JSON。

**实际**：HTTP 200，固定 runner 被调用 1 次，SSE 出现完成事件，并写入临时会话／答案状态。`chat-origin-repro.json` 保存结果；没有真实模型调用。

**期望**：在加载快照、创建会话或调用模型前返回 403／415，前端合法聊天走统一写接口头和同源规则。

**影响／根因**：聊天也会花费模型额度、写会话和缺口，不应比 Drop／审阅／保存等入口少一道服务端边界。能到达本机服务的跨站简单请求可能触发这些副作用。浏览器的本地网络保护会影响具体攻击能否到达服务，不能把本次直接 HTTP 复现说成所有浏览器都可无条件利用；服务本身遗漏检查已经成立。

### R4 · P2：写作审计把合法机器修订尾注当作违规教学章节

**位置**：`scripts/wiki/standard.ts` 的 `source-sections` 判断与 `scripts/wiki/revisions.ts` 的 `revisePage` 历史协议；正式样本 `wiki/concepts/ascend-config-system.md` 的 `已废弃的说法` 尾注。

**复现来源**：主会话本轮运行 `pnpm wiki:audit`，退出 1。日志是 `tools/wiki-runtime/overall-review-20261008/current-wiki-audit.log`。145 页的 3,731 条本地来源检查合法；写作标准名单 104 页只有 103 页通过。审查者核读相关协议与页面后确认其跨功能冲突，没有重复运行这条正式库审计。

**实际／期望**：`revisePage` 按 F004 AC7 强制追加的 H2/H3 历史，在 F001／F005 的来源区标题规则里变成违规；应只识别结构有效的机器审计尾注，不应删除留痕、跳过历史真实性验证，或允许任意教学标题越过末尾来源区。

**影响／根因**：正常使用纠错留痕就可能使静态验收失败；“最新正式库审计全部通过”的完成声明不成立。两份规则分别执行时成立，组合后不兼容，是协议接合问题。

### R5 · P2：状态页对网页 Drop 的模型调用和额度约束作出错误说明

**位置**：初审 `src/app/wiki/StatusPane.tsx:263–279`；实际执行对照 `scripts/wiki/drop-run.ts` 的 `accountingOnly: true` 与 `scripts/wiki/budget.ts:177–193`。

**复现**：浏览器打开 `http://localhost:5193/#/wiki` →“问知识库”→“状态”。初审可见文本：“只有你在这里提问、或点「存进 Wiki」时才调用模型……大批量导入只能手动执行命令”，并称“共享暂停与次数上限仍生效”。

**实际／期望**：F005 已有网页“开始处理”，会调用模型；按 D05，Drop 正式处理只记账，不受旧共享暂停、次数和金额上限阻断。状态文案应讲明主动网页处理及其额度边界，不应为满足旧文案而给产品加回已取消的限制。

**影响／根因**：用户用该页判断何时调用模型、暂停是否阻止任务和费用边界，旧 F004 说明未随 F005 更新，构成可见的操作与成本契约错误。实测只查看 UI，没有启动 Drop 或修改预算。

## F001–F005 覆盖矩阵

“本轮核查”指本审查实际读代码、读证据或运行；“既有证据”明确不是本轮重跑。不能把一项通过外推成所有输入均正确。

| Feature / 验收主题 | 计划与当前实现对照 | 本轮独立核查与结论 |
| --- | --- | --- |
| F001 AC1–2，规则、schema、lint | schema／证据标记集中定义，手册提供写作和操作切片；七切片取代旧六切片是已记录变更 | 阅读规则、真实调用与 diff。发现 R4 组合缺陷，故当前静态审计不能一概说通过 |
| F001 AC3–5、9，提取／来源／seeds／版本 | 固定 Git 对象导出、不可变 raw、提取及整合；全局模型替代写死 Claude；seeds 与已存在页对账 | 抽读 compile-raw 和共享生产链；67 个内容寻址 raw 全部哈希相符；三扫描计数复核。未重跑付费提取，未逐条复判 1,006 条模型判定 |
| F001 AC6、10–12，阅读／检索／图／关系 | 统一检索接口、快照读取、定向关系及派生 backlinks；静态图替代旧 Mermaid；来源区集中标记 | 浏览器阅读和状态实测；核读 snapshot、review、资产发布、检索接入。R1 说明结构正确不保证知识定义正确 |
| F001 AC7–8，问答／保存／审阅 | 问答与独立评判共用已固定模型；保存为草稿；整组人工审阅 | 核读真实 chat route、answer-quality、answers、review；R3 可复现。未付费重跑答案质量评测 |
| F002 AC1–2，扫描及三态 | AST certain + 真实模型 param/not-param/undetermined；未确定项允许保留 | 1,112 条实际分布 106/283/378/345 与声明一致；读取旧独立源码重扫和引文验证证据，不把逐字引文匹配等同判定语义正确 |
| F002 AC3，谱系与版本 | 固定 ref 的文本存在、引入／移除及 PR 线索；生成页明确不承诺运行可用 | 核读身份／页面／同步和谱系证据；旧验收四名称 × 三版本，抽读相关固定源码。未逐一人工证明所有名称的语义引入史 |
| F002 AC4，骨架 | 260 个确认定义身份；16 复用、244 新骨架只在隔离库；reference 不重复出页 | 核读隔离清单、独立重建报告和实际身份解析代码。足以支持生成能力验收，不能称正式库已有 260 份完整参数教学页 |
| F002 AC5，选择性补正文 | 只补空白／骨架，保护自动定义和完整页；不得旧快照覆盖 | R2 证明稳定身份在此入口断开，必须修复。原有 `mega_moe_max_tokens` 真模型样本只证明该样本成功 |
| F002 AC6，同步和调度 | 增删改排队、分批游标及失败恢复；Windows 日任务；模型配额按用户决定为 0 | 核读 publish-sync、queue、worker；查阅实际 CLI 增删改与连续两轮维护证据。没有主动跑计划任务，未把配额 0 记为漏开发 |
| F003 AC1–4，在线检索、失败与命中率 | 9 月用户变更为双仓库有界在线搜索，不再全量首拉；冻结十题门槛 Top-5 ≥7 | 核读 searchPlan、TraceSession、searchErrors、traceChat；全失败／部分失败／截断都有独立状态，未发现把 GitHub 请求失败当零命中的新缺陷。既有真检索 Top-1 6/10、Top-5 7/10；本轮未发新外网检索或改题 |
| F003 AC5–7，PR 包含关系及文档映射 | 原修复不是祖先不等于没回移；文档自身版本映射失败不得套当前钉点；普通排错不自动变正式知识 | 核读 localFixVersions、verifyFix、mapDocRef、localDocVersions、publicTrace。不存在 ref、缺本地仓库、找不到文档路径保留 unknown/reason；issue 关联与修复因果区分。未全量审计现有 GitHub 所有关系 |
| F004 AC1–2、5，输入、隔离、origin | 共享 sanitizer 与批次收录，原始资料为数据；保留直接写作历史真实来源 | 核读 drop-batch、fetch、assets、server/drop 和 compile；采集／补证白名单及逐字引用验证。没有把 sanitizer 宣称为通用恶意内容识别器 |
| F004 AC3，缺口、独立评判、复测关单 | 回答自报不再唯一依据；模型独立评判、unknown 不自动生成、阈值排队、批准后复测 | 核读 answer-quality、gap-ledger、retest、queue、worker；当前保留硬件证据缺口符合协议。完整真实“新问题→发布→等价问法提升”使用既有评测记录，未伪称本轮新测 |
| F004 AC4、6、8–9，巡检／reconcile／drift／重复 | 检测变动表示待复核；定向补边需双端依据，drift 只是差异；周期额度不自动开启 | 核读状态流转、查阅连续批次、补边和 drift 真样本证据；不以一例 drift 分数推断事实已过期。R5 是运行边界 UI 错误 |
| F004 AC7，结论翻转留痕 | revisePage 保存原句、日期与依据，正式批准后发布 | 已批准 31c5 包 8/8 字节实查；R4 是历史协议与写作审计的真实冲突。R1 的修正也应保留应有历史 |
| F005 AC01–03、10，输入／版本系列／重试／隔离 | D01 文本与 URL，理由选填；预检不调用模型；明确开始固定批次与模型；断点重试不重复已完成步骤 | 核读 drop-run、batch、fetch、server/drop、共享契约、DropPane；针对性 contract 与 integration 测试通过。PDF/Word/图片不在 D01 范围；不构造“没支持它们”的缺陷 |
| F005 AC04–07，充分阅读、多页整合、建链与矛盾 | 全目录候选、需读全文与依据、允许增量补查；未读页不能自造关系依据；版本条件分开，真替代保留旧文 | 深读 drop-integration 的工具及约束，针对性测试覆盖八页读取、补查、生成区保护等。机械约束不能独立证明模型每次真正理解全文；R1 是存量内容的反例 |
| F005 AC08–09，整组审阅、资产与一致发布 | 无部分批准入口；页、raw、图、目录和关系纳入同一 manifest；base 与依赖变更拒绝；持久化 publishing 后可按原 bytes 恢复 | 深读 review、review-files、snapshot、assets；review/revisions/integration 四文件 41 测试通过，涵盖实际已有的冲突／恢复断言。未对真实进程强制杀进程、断电或直接改正式页模拟冲突 |
| F005 AC11–12，知识增益与兼容 | 真实问答前后对照 + 改写题／版本与无证据反例；工程 mock 与真模型证据分开 | 读取 F005 验收及最终收尾证据；其真样本有意义，但不能扩成全库每句和任意新故障正确率。R3、R4、R5 都说明单功能验收后仍需跨功能审查 |

## 后续合法决策与尚未兑现的宽泛表达

以下是有记录的范围／实现变更，不作为新缺陷：全局模型选择替代固定 Claude；固定 Git 对象导出替代为每个 ref 建 worktree；复用现有页取代无目标重复灌种；schema 与证据标记在代码中单一定义；统一可替换检索替代旧 `index.md + grep` 实现措辞；七份手册切片；正文解释优先、标记集中源码区；F003 有界在线查询替代全量镜像，普通排错只提供社区线索；F005 文本／URL 输入、理由选填、处理前不加中间审批、整组批准／退回、正式 Drop 只记账不套旧业务调用额度。

F002 的 260 个确认身份骨架验收符合“当前确认项、允许三态、避免无目标大量导入”的限定；244 个新增骨架未进入正式库本身不是漏发布。与此同时，feature `What` 中“问任意一个 vllm-ascend 参数，都能得到答案”的宽泛说法没有被现有证据普遍兑现：345 条仍未定，244 页只有隔离骨架，完整教学补写是选择性的。应以已明确的限定 AC 描述交付，不应在面向用户的完成声明中重复无条件承诺。

正式夜间模型配额 0、reconcile/drift 0 是用户的运行选择，本轮不得自行开启。剩余 Sleep Mode/固定硬件与镜像实测缺口没有可用设备入口；缺证据时保留缺口是正确结果，既不能称软件未实现，也不能宣布硬件效果验收完成。

## 实际验证及证据强度

所有本轮复现都使用系统临时夹具或 `tools/wiki-runtime/overall-review-20261008/`，没有付费模型调用，没有批准正式 Wiki，没有启动夜间任务。

| 实际操作 | 结果与证据 |
| --- | --- |
| `git status --short`、`git diff --stat`、相关真实源码／diff 阅读 | 阅读既有大量未提交改动与未跟踪文件，没有清理、回滚、提交或推送；审查对象是工作树现状，不是只看 HEAD |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/param-identity-repro.ts` | 独立复现 R2；结果 JSON 保留 canonical/generated/error 与模型调用次数 0 |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/chat-origin-repro.ts` | 独立复现 R3；不可信 Origin 实际 HTTP 200、固定 runner 1 次，未调用真实模型 |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/independent-state-and-source.ts` | 退出 0；独立确认 published 包 8/8、67/67 哈希及扫描分布；固定 Git 源码读取包含 GPT-2／OPT、Ascend 两版配置与 GLM5next MLP |
| `pnpm exec vitest run scripts/wiki/review.test.ts scripts/wiki/revisions.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/drop-contract.test.ts --pool=forks --configLoader=runner` | **4 文件 41 测试通过**，约 24.70 秒，15:30:59 启动；日志 `independent-focused-tests.log`。没有与主会话重复跑全套 |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/chat-origin-recheck.ts` | 修复后独立重放 R3 原始跨站请求：403、runner 0、无 done，旧红证据保留 |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/param-cli-disambiguation-recheck.ts` | 修复后独立重放 R2 第二分支：唯一 target 为 `legacy-limit`、无错误、模型未启动 |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/verify-mlp-package.ts 16282a8a656d3d907de33e76dd13298db716663b3c7a8c73baae40f7cac9ef0d` | 完整候选 4 项写入、2 份源码块、6 条历史、来源顺序／算式／图引用、图 caption／SVG 均通过；默认隔离发布与重复批准均 published，正式 885 个知识输入文件不变、正式包仍 pending |
| `pnpm exec tsx tools/wiki-runtime/overall-review-20261008/export-mlp-reader.ts` | 从已真实隔离发布的副本读取 `readReaderSnapshot`，保存 `mlp-candidate-reader.json` 供主会话浏览器候选回放；没有改变正式 reader |
| 5193 浏览器只读操作：目录→问知识库→状态 | 145 页／30 术语／0 待审／0 队列／1 缺口；R5 旧文案可见；未发送聊天、未点击开始处理或批准 |
| 主会话 `pnpm wiki:audit` | **退出 1**，103/104 标准页通过，R4；这是主会话提供并由本审查核读的结果，未冒称独立再执行 |

既有全套证据为 133 文件／1,089 测试（显式 `--pool=forks --configLoader=runner`）、87 个浏览器用例和 build 通过；本审查 agent 未重跑这些检查，因此本段只将它们作为有日志的既有证据。本轮修复后的全套检查由主会话执行，最终结果须看该轮实际日志。默认 `pnpm check` 曾出现 Windows 原生崩溃（退出码 3221225477），现有信息不足以判定是本改动引起还是环境问题；不能用备用参数的成功声称默认命令已经恢复稳定，也不据此虚构一个已定位的代码 P2。

## 审查边界和未证实假设

- 代码审查覆盖主要入口和跨功能接缝；不是对所有约 900 个相关文件逐行审完。分支的全部历史变更、第三方依赖、所有浏览器及操作系统行为没有穷尽。
- Wiki 采取风险导向源码抽核，包含 MLP／Residual／Norm 的首屏、公式与版本边界、async 参数条件、AscendConfig 两版行为，以及 expert-parallel 局部教学段落；没有宣称 145 页每句已经人工审核。旧报告中的全量机器检查与其他 agent 语义抽核应按各自明确范围引用。
- 本轮 raw 哈希核验只证明不可变内容寻址一致，不证明全部教学命题由对应 raw 支持；有效行号只证明引用可定位；逐字引文也不能替代因果判断。
- 已查看完整批次模型冻结、重试 cache、整组 base hash、生成区保护、发布恢复和快照隔离的代码／定向测试；未在正式库制造并发写、断电、恶意磁盘文件或停服务来测试。不能以未发现问题承诺所有故障组合都安全。
- F003 社区因果判断和文档版本提示依赖真实来源与模型推理；本轮核查了失败语义，没有实跑新的外网检索，也没有评估超出既有题集的新故障命中率。
- 默认 Windows 检查崩溃原因仍未知，保留为验证限制。未将此假设升级为已证实实现缺陷。

## 修复复审与待用户决定

### 第一轮修复复审

| 发现 | 本轮复审状态 | 证据 |
| --- | --- | --- |
| R1 | 正文候选方向正确，首图仍需同步限定 | 核读待审 `0767b90f…` 的六处正文修订、摘要和两份固定源码摘录。首图 `wiki/diagrams/mlp-residual-layer.yaml:3` 仍称“通用单路 pre-norm”，图内却固定 RMSNorm/SwiGLU；已要求只改 caption 并同步 SVG，纳入同组。没有批准旧候选 |
| R2 | 第一次修复尚有 CLI 消歧遗漏，保持打开 | `ingestParam` 已用公共身份解析且 reference 零调用跳过；但稳定 ID 筛选时对所有同名候选严格解析，未选中且尚未映射的另一 scope 会拦截正确目标。独立执行 `param-cli-disambiguation-repro.ts` 得到“旧参数页需要明确身份映射：limit”；`.json` 保留红证据。主会话继续处理，未吞异常来放宽断言 |
| R3 | 代码及独立 HTTP 复现通过，可关闭 | `checkWriter` 在请求体／会话／模型之前；ChatDrawer 发送 `x-wiki-review: 1`。独立执行 `chat-origin-recheck.ts`，原跨站请求现在 403、runner 0、无 done；原始红证据未改。主会话聊天路由 24 测试通过 |
| R4 | 代码复审及正式审计恢复通过，可关闭 | 公共 revisions 导出历史标题／有效日期键识别；standard 只识别尾部规范历史，普通额外 H2/H3、伪日期与缺失来源标题仍失败，发布保留 `verifyRevision`。主会话 standard/revisions 35 测试通过；`current-wiki-audit-green.log` 实际 104/104 标准页通过，3,731 条本地来源合法 |
| R5 | 代码与实际浏览器呈现通过，可关闭 | 5193 浏览器实际读到“启动网页 Drop 或手动运行知识生产命令时才调用模型”，以及“Drop…单独记账，不受这里的暂停、调用次数或金额上限约束”；未改预算或启动任务 |

第一轮复审当时，R2 第二分支及 R1 完整包仍须继续复审；不能把当时三个关闭外推成所有问题已关闭。下节记录其后获得的实际证据。

### 最终针对性复审

R2 第二轮已将绑定读取和重复定义检查集中到 `parameterBindings`。CLI 按 `definition` 绑定的完整身份键精确选取条目，选中后仍由 `parameterPageId` 严格检查。独立重放原失败夹具已经转绿；主会话回归同时断言“真正选中的未映射同名身份仍必须报错”，没有把错误全部吞掉。原名、稳定 ID、哈希 ID 的正常场景与 reference 不生成草稿仍有覆盖。**R2 关闭**。

R1 最终包 `16282a8a656d3d907de33e76dd13298db716663b3c7a8c73baae40f7cac9ef0d` 取代已驳回的 `0767b90f…`，实际包括教学页、首图 YAML、首图 SVG 和一份新增 raw，共 4 项写入。独立脚本用实际 `readReview` 校验整包 hash，用默认 `approveReview` 在全新隔离副本真正发布，再重复批准检查幂等。结果如下：

1. GPT-2 `L148–L242`、OPT `L135–L197` 两段 raw 与固定 Git 对象逐字一致；新增快照的内容寻址哈希正确。
2. 原 26 条 sources 及顺序不变，新增反例在 C27/C28；原算式和图引用不变，六条废弃结论与替代文字通过 `verifyRevision`。
3. 首图只有 caption 变化，明确是 RMSNorm/SwiGLU 的 pre-norm 示例；图布局和数字不变，SVG 与真实 renderer 输出逐字一致。
4. 隔离副本 4 项文件与提案 after 全部一致；第一次和重复批准均返回 published。正式 885 个知识输入文件检查前后不变，正式 review 仍 pending。
5. 新 raw 明确是本轮重新核读的证据，未伪造旧模型输入回执；本次修订以 `origin: gap` 表示审查发现的知识缺口纠正，before-image 仍保留原页的 direct 来源。该变化包含在完整 diff 中。

证据为 `independent-mlp-16282a8a656d.json` 和 `independent-mlp-final.log`。**R1 候选修复通过，可交用户整组审阅；尚未完成正式发布，不能把候选通过记成正式页已经修好。** 主会话负责该候选的实际浏览器阅读验收及最终工程检查，本审查不冒认其结果。

截至上述复审，本次确认的代码／接口／状态文案 P2 均已关闭；没有未解决的本次实现缺陷。R1 的正式生效仍是待批准事项，库的广度、未确定参数、真实硬件行为及默认 Windows 原生检查稳定性仍按前述边界描述。

功能方案没有必须重新让用户拍板的事项。R1 涉及正式知识修订，完整可审阅的最小改动与独立核查已经准备好，仍由用户按既定整组流程决定批准；审查者不代替用户批准。是否继续补未确定参数、批量发布骨架、开启夜间模型或增加硬件测试入口，都不是本轮审查擅自扩张的任务。

## 主会话收尾补充（独立审查结束后）

本节由主会话记录，不冒称独立 agent 再次执行了完整工程测试。

- 修复后全量测试使用显式 `--pool=forks --configLoader=runner`，**133 文件／1,097 测试通过**；问答与状态的浏览器回归 **12/12 通过**。Typecheck、lint、生产构建、依赖、内容、288 图一致性与 Wiki lint 均通过，保留既有警告。首轮完整测试发现 snapshot 请求夹具缺少新增写入头，已补合法请求头并保留原错误断言；失败和最终成功日志都保留。
- 正式审计已恢复标准名单 **104/104**；在独立隔离批准副本上再次检查写作标准，含新 MLP 候选同样 **104/104**。该检查补上发布校验不覆盖写作密度和章节顺序的边界。
- 用独立发布副本的实际 `readReaderSnapshot` 回放浏览器候选：首两屏、首图和图注、归一化对照表、calc、28 条来源及跨页链接均通过；主会话实际阅读截图，浏览器无页面错误、无正式写请求。真实网页可见新的唯一待审包，未点击批准。
- 真实 API 已重启加载聊天防护，跨站请求 403；正式页 145、知识版本仍 `c0ad0ab47609…`、待审 1、队列 0、夜间模型配额 0。基线中的正式知识文件没有变化；F001 已重开为 in-progress，其他相关 feature 记录修复并保留完成范围。

完整命令、警告和日志索引见 [本轮最终工程验证](wiki-final-acceptance.md#整体复审修复后的工程验证主会话执行)。**当前结论仍是四项 P2 关闭、P1 候选通过但正式发布待用户批准**；没有把测试全绿改写成全库语义或硬件行为已经全面验证。

## 用户批准后的正式验收（16:29，主会话执行）

用户确认已审批后，实际读取正式包为 `published`，4 项文件与 payload.after 逐字相同。API 返回 145 页、知识版本 `5e443dabecec30e1e0e19dcddb33b37677f94d73077a2bcdd642576a96cc4403`、待审 0、排队 0；夜间模型配额仍全为 0，Sleep Mode 硬件证据缺口仍保留。

浏览器未拦截替换响应，实际打开正式 MLP 页，确认新定义、首图图注、最终归一化适用范围、28 条来源和跨页链接；页面错误 0。`pnpm wiki:audit` 退出 0：3,733 条本地引用行号有效，104/104 标准页通过；160 URL 本轮未联网核验。

证据位于 `tools/wiki-runtime/overall-review-20261008/publication-confirmed.json`、`published-browser.json`、`published-first-screen.png`、`publication-audit.log`。此为正式批准后核验，覆盖上文审批前的 pending 状态；**R1–R5 全部关闭，本轮无需用户继续操作或决定。**
