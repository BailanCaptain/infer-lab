# 全站循序渐进重构、流水线解耦与全栈缺陷根治计划

> **状态说明**：本文件为实施计划与讨论背景归档（制定于 2026-11-14），遵循 [docs/plans/README.md](README.md) 单一真相源约定——本计划写完不代表整改已完成，不在本文件中维护动态完成率，所有执行需经用户拍板后按阶段推进。

---

## 一、 讨论背景与问题起源（为什么制定本计划）

### 1.1 历史脉络：前序“覆盖率与逐项引文核验”带来的副作用

在 [2026-11-03 整改方案](2026-11-03-wiki-remediation.md) 与 [2026-11-10 接续计划](2026-11-10-wiki-continuation-plan.md) 中，项目重点解决了“官方资料漏讲、多节点参数缺失、6,400+ 来源出现项逐条核验”的问题。这批工作夯实了 164 篇正式页与 352 张规格图的事实底座，但在**自动化修订锁与机械校验指标**的共同挤压下，产生了严重的教学副作用——**“事实越来越密，正文越来越乱，初学者根本无法循序渐进读下去”**。

### 1.2 前序外部审查中断与分类器触发教训

用户在外部会话中曾尝试并发派发多个子代理审查“愿景对齐、代码缺陷、前端表现、正文循序渐进度”，但：
1. **读正文与开页面的子代理连续被外部安全分类器拦截中断**，导致最重要的“正文为什么乱”和“前端交互实测”未能完成，代码审查也在半途截断；
2. **残存的前序报告存在基于过期文档的误判**：例如误以为“主阅读页不载入 3D”（实为 [README.md](../../README.md#L3) 与 [PLAN.md](../../PLAN.md#L13) 未同步，而 [WikiPage.tsx](../../src/app/pages/WikiPage.tsx#L504-L510) 已在 19 篇正式页嵌好 23 处三维场景），以及误判 `DESIGN.md:74` 版心宽度冲突（实为 `DESIGN.md:130-161` 旧行未清理）。

### 1.3 本轮独立全量审查确立的真实基线（2026-11-14 已验证）

本轮通过只读代码核查、58 篇前中后段代表页抽样评分与本地命令实测，确立了以下可复现基线：

1. **构建与静态检查基线**：
   - `pnpm typecheck`、`pnpm check:deps`、`pnpm check:content`（164 页 / 11 章）、`pnpm build`、`pnpm wiki:diagrams --check`（352 张图，附 91 条超限/标识符警告）**均通过**；
   - `pnpm lint` 退出码 `0`（含 27 条警告，[biome.json](../../biome.json#L2) schema 版本 `2.0.0` 落后于 CLI `2.5.12`）；
   - `pnpm wiki:lint` 与 `pnpm wiki:audit` **退出码 `1`（共 2,057 处失败）**：本地 `tools/repos/vllm-ascend` 缺失 `db701c1f` 提交对象且未写入 [vllm-ascend.yaml](../../wiki/seeds/vllm-ascend.yaml) 的 `refs`；
   - `pnpm exec vitest run src/content/wiki/toc.test.ts` **稳定失败**（[toc.test.ts](../../src/content/wiki/toc.test.ts#L258)）：重写样板页 `chunked-prefill-v2` 滞留在兜底的 `"新增教学页（待编排）"`；
   - 工作区工程卫生积压：距上次提交逾 37 天，`git status -uall` 达 **100,506 条记录**（`.tmp/` 2.08 GB、`tmp/` 720 MB、`wiki/_jobs/` 非账本目录未完整纳入 [.gitignore](../../.gitignore)）。
2. **“正文杂乱、不循序渐进”的 6 大系统根因**：
   - **根因 A（目录倒置与双轨脱节）**：[learning-guide.md](../../wiki/concepts/learning-guide.md#L45-L118) 首屏塞入 55 行高阶外部专题表且推荐顺序与 [toc.ts](../../src/content/wiki/toc.ts#L55-L81) 脱节（导致 [one-request.md](../../wiki/concepts/one-request.md#L174) 引用相隔 60 页的“上一页”）；前 4 页在未讲词元、嵌入、注意力、键值缓存前堆入 7 套高阶机制；`buildToc` 尾插机制导致 `quantization` 早于 `low-precision-formats`、`sparse-attention` 早于 `mla`、`kv-cache-spec` 早于 `block-table`、`gap-a5164fe10fa9184412f8` 排在并行章第 1 页。
   - **根因 B（`assertSupplementPreserves` 逐行锁死旧文）**：[revisions.ts](../../scripts/wiki/revisions.ts#L60-L86) 要求 `supplement` 修订逐行保留旧文原序，导致 **73 / 124 篇概念页**版本段分裂（三列旧表上方硬贴粗体补丁段）、**33 / 33 篇参数页**首句被版本对照劫持、甚至劈断算式引子（[chunked-prefill.md](../../wiki/concepts/chunked-prefill.md#L166-L171)）与造成同页前后矛盾（[enable-super-kernel-ce990e186bfa.md](../../wiki/params/enable-super-kernel-ce990e186bfa.md#L120) vs [L175](../../wiki/params/enable-super-kernel-ce990e186bfa.md#L175)）。
   - **根因 C（防挑刺分支淹没首屏主干 + 提示词残留）**：入门页首屏密集插入源码异常分支（如 [token.md](../../wiki/concepts/token.md#L155-L257)、[attention-qkv.md](../../wiki/concepts/attention-qkv.md#L269)），[chunked-prefill.md](../../wiki/concepts/chunked-prefill.md#L212) 等残留“给定材料中的…”内部提示词。
   - **根因 D（异物嫁接、悬空引用与同题重复）**：[prefill.md](../../wiki/concepts/prefill.md#L221) 悬空引用外页（`sampling.md`）的“六词分布”；[device-memory.md](../../wiki/concepts/device-memory.md#L137-L162)、[async-scheduling.md](../../wiki/concepts/async-scheduling.md#L301-L328)、[pd-disaggregation.md](../../wiki/concepts/pd-disaggregation.md#L343-L416)、[structured-output.md](../../wiki/concepts/structured-output.md#L329-L673)、[request-call-chain.md](../../wiki/concepts/request-call-chain.md#L364-L395) 嫁接次要或跨平台禁用内容；[acl-graph.md](../../wiki/concepts/acl-graph.md) 与 [graph-mode-layer.md](../../wiki/concepts/graph-mode-layer.md) 内容重叠达 40%–50%。
   - **根因 E（机械审计指标反噬可读性）**：[standard.ts](../../scripts/wiki/standard.ts#L148-L170) 强制 `## 对照源码` 精确匹配全部 5 个 H3（催生 [matmul-and-weights.md](../../wiki/concepts/matmul-and-weights.md#L394) “没有独立的开启矩阵乘开关”等废话）、严卡行内代码密度导致反引号被剥离（中英标识符裸粘连）、配合 [lint.ts](../../scripts/wiki/lint.ts#L380-L399) 角标上限催生 64 篇概念页使用不可点击的纯文本“来源 85–90”，且 60 篇正式页未纳入 [standard-pages.json](../../scripts/wiki/standard-pages.json)。
   - **根因 F（机器哈希 ID 与来源页混入目录）**：`gap-a5164fe10fa9184412f8`、`answer-fbdf83...`、24 个 `-<12位哈希>` 参数页（如裸标题 `size`）与 `sources/rfork-official-guide.md` 直接暴露在读者目录与 URL 中。
3. **全栈代码与前端交互实证问题**：共确认 5 项 P1 与 6 项 P2（详见第四章任务分解），且前端阅读器存在左侧搜索仅匹配标题/别名、1200px 栏宽下纯文字段落单行达 65–70 字导致扫视疲劳、缺少页头前置概念导览等问题；动态浏览器截图因本地 `127.0.0.1:5173` 权限弹窗超时暂未执行，已纳入验收闭环。

---

## 二、 目标、架构与直线检查（Straight-Line Check）

### 2.1 核心定义

- **Goal**：在不丢失前序已核验源码事实与证据链的前提下，根除制造“补丁乱文”的流水线机制，修复全部 P1/P2 全栈缺陷，重构“从基础积木到全景拆解、页内先主干后边界”的循序渐进教学体系，并升级阅读器排版与检索体验。
- **Acceptance Criteria**：严格对齐 [写作标准](../wiki-writing-standard.md)、[教学 3D 标准](../3d-teaching-standard.md)、[设计规范](../../DESIGN.md) 及 `docs/features/` 中 F001–F005 既有验收项（本计划用分步验证命令逐条承接，不另立重复需求表）。
- **Architecture**：坚持单一真相源——目录顺序只由 [toc.ts](../../src/content/wiki/toc.ts) 定义并反向约束导读页；正文结构统一采用 [chunked-prefill-v2.md](../../wiki/concepts/chunked-prefill-v2.md) 已验证的“问题直觉 → 单一贯通玩具算例 → 收益代价 → 边界分支收尾 → 对照源码”两层解剖模型；检索分词在后端问答与前端侧栏共用同一套 [retrieve.ts](../../src/content/wiki/retrieve.ts) 实现。
- **Tech Stack**：TypeScript（Node 脚本、服务端路由、AST 批处理转换器）、React 19 + Vite、CSS 容器查询与排版令牌、Vitest、Biome 及本地浏览器实测。

### 2.2 终点线与「不做什么」

- **终点线**：
  1. `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm check:deps`、`pnpm check:content`、`pnpm wiki:diagrams --check`、`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm build` **九项门禁全绿**；
  2. 全库消除分裂版本补丁段、首句版本劫持、纯文本死角标、裸哈希目录项、跨页悬空引用与内部提示词残留；
  3. 读者从 `/wiki` 第 1 页顺点“下一节”读完前 20 篇主线页，**不出现任何未铺垫且无页内直觉解释的前置黑话**；
  4. 桌面与移动端浏览器实测通过（含三维场景按 [3d-teaching-standard.md](../3d-teaching-standard.md) 实际播放验收）。
- **不做什么（Non-Goals）**：
  1. 不推翻重来重写全部 164 页，也不丢弃 [2026-11-10 接续计划](2026-11-10-wiki-continuation-plan.md) 已积累的官方覆盖与引文判断记录；
  2. 不新建另一套 CMS、数据库或第二套前端阅读壳；
  3. 不在未解决流水线规则（`revisions.ts` / `standard.ts`）前盲目手工改文；
  4. 不触发未经授权的批量付费模型重编译任务。

### 2.3 终态核心契约（End-State Contracts）

1. **修订守恒契约（替代逐行锁）**：`scripts/wiki/revisions.ts` 中的 `supplement` 校验改为检查 `oldSources ⊆ newSources`（允许显式声明替换无效行号）及章节级关键结论保留，允许重排段落、润色衔接句、在既有 Markdown 表格内新增版本列。
2. **标准校验契约（消除反噬）**：`scripts/wiki/standard.ts` 对 `## 对照源码` 校验“至少包含 `源码入口` 且其余子标题属于标准五项有序子集”；行内 `code-density` 豁免下划线标识符、CLI 参数与类名；对照源码表内的 `[Cn]` 可点击角标不计入正文叙事角标惩罚。
3. **页面双层解剖契约（Two-Tier Page Anatomy）**：
   - **第一层（前 70% 主干区）**：一句话直觉定义 → 为什么需要它（痛点对比）→ **唯一一套最小玩具数字从头算到尾**（配合 `wiki-diagram` / `calc` / `wiki-scene`），严禁穿插版本差异与冷门配置分支；
   - **第二层（后 30% 边界与源码区）**：`### 边界条件与特殊分支`（承接防挑刺所需的异常分支、跨平台不支持项与极端条件）+ `## 对照源码`（统一四列版本谱系表：`v0.23.0 | v0.26.0rc | v0.30.0rc2 | main`）。
4. **路由兼容与语义命名契约**：所有被重命名的裸哈希页在 `frontmatter.aliases` 或路由映射表中保留原 ID 301/别名跳转，确保历史审查记录、问答引用与外部书签零死链。

### 2.4 阶段三问核验表

| 阶段 | 产物在终态原样保留吗？ | 完成后能立即验证什么？ | 去掉这步的代价是什么？ |
| --- | --- | --- | --- |
| **Phase 0：止血与门禁恢复** | 保留（`.gitignore`、种子提交固定、正选页面与同步文档均为终态基座） | `wiki:lint`、`wiki:audit`、`toc.test.ts` 由红变绿；`git status` 回归干净可控 | 门禁持续报 2,057 错，后续任何改动无法区分存量坏账与新增回归 |
| **Phase 1：流水线解耦与代码修 Bug** | 保留（正式代码、校验器与回归单测） | 新增单测覆盖 URL 异常、检索召回、Drop 循环上限、修订锁解耦与图注解码 | 服务端可崩溃、问答停止锁死账本、修好的正文会被旧校验器打回或再次写乱 |
| **Phase 2：目录重排与正文去补丁精修** | 保留（终态 `toc.ts`、清洗后的 164 篇正式页） | 全库无分裂版本表/裸哈希名/悬空引用；前 20 页前置依赖拓扑零逆序 | 只修代码不修目录和正文，用户感知的“正文杂乱、跳步严重”完全未解决 |
| **Phase 3：前端排版升级与浏览器验收** | 保留（终态 CSS/TSX 与视觉验收记录） | 散文 `72ch` 舒适行宽、左侧全文检索命中、三维场景实播无上下文泄漏 | 1200px 宽栏纯文字依旧压抑，侧栏搜不到正文概念，前端改动违反视觉验收铁律 |

---

## 三、 防分类器中断的安全执行规程（必守）

为彻底避免前序外部会话“读正文即断流、整轮工作作废”的问题，后续所有实施会话严格遵守以下三条操作纪律：

1. **机械结构债一律用本地 TypeScript AST 脚本处理**：
   - 合并 33 篇参数页与 73 篇概念页的版本补丁段、还原 64 篇概念页的纯文本来源号、重命名裸哈希文件并更新跨页链接、检查前置依赖逆序——全部编写确定性的本地脚本（放于 `scripts/wiki/` 或一次性转换测试）执行，**不把几十篇正文喂进大模型上下文**。
2. **单页教学精修严格实行“单页单上下文隔离”**：
   - 需要人工/模型润色叙事顺序的核心页（约 20 篇），每次子任务**只读取 1 篇目标 Markdown 与其引用的具体源码片段**，禁止在同一上下文中批量拼接多篇高阶架构页、禁止读取外部论文汇总表或整本手册原文。
3. **子代理汇报采用“路径 + 行号 + 结构摘要”协议**：
   - 子代理向主会话汇报修改或审查结果时，只传文件路径、行号区间、小节标题结构、测试输出与抽象逻辑说明，不粘贴可能触发误报的前沿架构词簇大段原文。

---

## 四、 分阶段实施任务清单（Red → Green）

### Phase 0：工程止血与门禁恢复

#### Task 0.1：工作区止血与 `.gitignore` 补齐
- **当前基线**：`git status -uall` 返回 100,506 条文件；`.tmp/`、`tmp/`、`wiki/_jobs/`（除 `budget/` 与 `sync/` 外）及根目录调试截图/无关文档污染工作树，且 `wiki/_jobs/` 下有 4 个历史误跟踪文件。
- **涉及文件**：[.gitignore](../../.gitignore)（不触碰、不回滚任何未提交的业务源码与 `wiki/` 正式内容）。
- **最小实现**：
  1. 在 `.gitignore` 补齐 `/.tmp/`、`/tmp/`、`/wiki/_jobs/*`（保留 `!/wiki/_jobs/budget/` 与 `!/wiki/_jobs/sync/`），并对 `wiki/_jobs/` 下已误跟踪的运行产物执行 `git rm --cached`；
  2. 将根目录散落的调试 PNG/日志移入归档或忽略范围（涉及用户个人文档先列出清单经用户确认后再移动，绝不擅自删除）。
- **验证命令与预期结果**：运行 `git status -uall --porcelain | Measure-Object -Line`，未忽略项从 100,506 降至真实业务变更规模（数百级）。

#### Task 0.2：补齐 `vllm-ascend@db701c1f` 基准引用，恢复 `wiki:lint` 与 `wiki:audit`
- **当前失败用例**：运行 `pnpm wiki:lint` 退出码 `1`，报 1,744 条 `invalid-commit` 与 313 条图 `pins` 错误。
- **涉及文件**：[wiki/seeds/vllm-ascend.yaml](../../wiki/seeds/vllm-ascend.yaml)、[wiki/seeds/vllm-ascend-code.yaml](../../wiki/seeds/vllm-ascend-code.yaml) 及本地 `tools/repos/vllm-ascend`。
- **最小实现**：在 `tools/repos/vllm-ascend` 中获取包含 `db701c1f` 的远程历史对象，并在种子配置 `refs` 中正式登记该钉点提交。
- **验证命令与预期结果**：
  - `git -C tools/repos/vllm-ascend cat-file -t db701c1f` 输出 `commit`；
  - `pnpm wiki:lint` 退出码 `0`。

#### Task 0.3：扶正 `chunked-prefill-v2` 并修复目录单元测试
- **当前失败用例**：`pnpm exec vitest run src/content/wiki/toc.test.ts` 在 [toc.test.ts](../../src/content/wiki/toc.test.ts#L258) 失败（存在 `"新增教学页（待编排）"`）。
- **涉及文件**：[wiki/concepts/chunked-prefill.md](../../wiki/concepts/chunked-prefill.md)、[wiki/concepts/chunked-prefill-v2.md](../../wiki/concepts/chunked-prefill-v2.md)、[src/content/wiki/toc.ts](../../src/content/wiki/toc.ts)。
- **最小实现**：核对旧版 `chunked-prefill.md` 中独有的有效源码引用（剔除第 212/284/317 行提示词泄漏），将其必要的边界条件收束进 `chunked-prefill-v2` 的文末边界小节后，以 `v2` 正文正式接替 `chunked-prefill` 主 ID（保留 `chunked-prefill-v2` 为兼容别名，移除冗余待编排文件）。
- **验证命令与预期结果**：`pnpm exec vitest run src/content/wiki/toc.test.ts` 与 `pnpm check:content` 全部通过。

#### Task 0.4：同步顶层架构与交接文档（消除虚假矛盾）
- **当前基线**：[README.md](../../README.md#L3)、[PLAN.md](../../PLAN.md#L13)、[src/app/App.tsx](../../src/app/App.tsx#L37) 仍写“主阅读入口不加载 3D”；[DESIGN.md](../../DESIGN.md#L130-L161) 与 [wiki/HANDBOOK.md](../../wiki/HANDBOOK.md#L178) 残留旧像素宽度；[CLAUDE.md](../../CLAUDE.md) 缺失三维教学标准引用；[HANDOFF.md](../../HANDOFF.md) 前 146 行重复 `F004` 日志且尾部保留已废止状态。
- **最小实现**：按现行代码真相统一口径，清理重复与过期段落。
- **验证命令与预期结果**：全文检索过期表述为 0 处，`pnpm check:deps` 与 `pnpm lint` 通过。

---

### Phase 1：流水线病根解除与全栈 P1/P2 代码修复

#### Task 1.1：重写 `revisions.ts` 补充修订校验（解除逐行锁死）
- **当前缺陷**：[scripts/wiki/revisions.ts](../../scripts/wiki/revisions.ts#L60-L86) 的 `assertSupplementPreserves` 强制旧文每一非空行按原序原样保留，阻碍表格扩列与段落重排。
- **最小实现**：
  1. 先写失败单测：构造“将散文补丁并入既有版本表 + 调整过渡句顺序但保留全部来源与核心算式”的 `supplement` 用例，确认旧实现抛错；
  2. 将 `assertSupplementPreserves` 改为校验：① 旧页有效的 `sources` 集合未无故删减；② H1/核心算式数值与关键结论关键词未静默丢失；③ 允许表格新增列与段落重组。
- **验证命令与预期结果**：新增修订校验单测通过，`vitest` 相关测试套件全绿。

#### Task 1.2：校准 `standard.ts` 与 `lint.ts`，消除可读性反噬并补齐 164 页覆盖
- **当前缺陷**：[scripts/wiki/standard.ts](../../scripts/wiki/standard.ts#L148-L170) 强制精确匹配 5 个 H3、误伤代码标识符反引号、将“可能”一刀切判错；[scripts/wiki/lint.ts](../../scripts/wiki/lint.ts#L380-L399) 角标计数迫使对照表退化为纯文本；[scripts/wiki/standard-pages.json](../../scripts/wiki/standard-pages.json) 漏检 60 页。
- **最小实现**：
  1. `sourceSubsections` 改为校验“包含 `源码入口` 且为标准五项的保序子集”；
  2. `code-density` 统计排除源码表并豁免标识符/CLI 参数名反引号；
  3. `mark-flood` 仅限制正文叙事段角标密度，允许 `## 对照源码` 表格内每条事实挂可点击 `[Cn]`；
  4. 收窄 `hedgeWords` 为真正的无依据猜测词组（如“大概”“也许”“猜测”），不再误杀技术条件句中的正常中文表达；
  5. 分批将全部正式概念页纳入 `standard-pages.json`。
- **验证命令与预期结果**：`pnpm wiki:audit` 与对应单元测试通过。

#### Task 1.3：修复后端畸形 URL 崩溃、413 连接残留与问答“停止”连锁故障
- **当前缺陷**：
  - [server/index.ts](../../server/index.ts#L16-L34) 及子路由 `new URL(req.url ?? "/", ...)` 未捕获非法 URL 导致进程退出；
  - [server/http.ts](../../server/http.ts#L49-L56) 返回 `413` 时未 `req.resume()` / 关闭连接；
  - [src/app/wiki/ChatDrawer.tsx](../../src/app/wiki/ChatDrawer.tsx#L333) 取消生成时清空 `sessionId.current`；[scripts/wiki/claude-cli.ts](../../scripts/wiki/claude-cli.ts#L189-L194) 与 [scripts/wiki/budget.ts](../../scripts/wiki/budget.ts#L238-L249) 在用户主动中止缺失 `total_cost_usd` 时把共享预算账本置为 `paused = true`（后续全员 503）；[server/chat-session.ts](../../server/chat-session.ts#L84-L112) 会话锁无 TTL。
- **最小实现**：先补齐各项失败单测，再统一封装 `safeParseUrl(req)` 返回 `400 Bad Request`、`413` 时显式销毁或排空流、用户 `AbortSignal` 取消时保留已建立的 `sessionId` 并在预算记账中区分 `cancelled` 与账本损坏、为会话活跃锁增加超时回收。
- **验证命令与预期结果**：服务端与问答路由单元测试全部红转绿。

#### Task 1.4：封堵 Drop 流水线无上限循环与修复修订上下文传递
- **当前缺陷**：[scripts/wiki/drop-integration.ts](../../scripts/wiki/drop-integration.ts#L219-L311)（及 `L374, 542, 581`）存在无上限循环与原地 `notes.push` 无限拆分风险；[scripts/wiki/drop-run.ts](../../scripts/wiki/drop-run.ts#L185) 漏传 `previousOutput` 且 `repairRounds` 未持久化到磁盘；[scripts/wiki/drop-assets.ts](../../scripts/wiki/drop-assets.ts#L66) 硬编码 `lineOffset: 0`；[scripts/wiki-drop.ts](../../scripts/wiki-drop.ts#L45) 遇普通未知二进制文件即 `fatal` 崩溃。
- **最小实现**：为 `DropSession.exchange()`、发现循环与笔记拆分深度补齐显式硬上限；在 `drop-run.ts` 将 `previousOutput` 注入修复请求并将 `repairRounds` 持久化进 `repairs.json`；修正切片真实起始行偏移；对非文本二进制资产做头字节检测后安全跳过或归档。
- **验证命令与预期结果**：新增 Drop 边界回归单测通过。

#### Task 1.5：修复 `retrieve.ts` 驼峰/混排分词失明并打通阅读器检索
- **当前缺陷**：[src/content/wiki/retrieve.ts](../../src/content/wiki/retrieve.ts#L167-L184) 对 `RoPE`、`W8A8`、`AllReduce`、`vLLM`、`FP8量化` 及 `--flag` 别名切词非对称导致小写查询召回为 0，`L259` 正则误含空格；[src/app/pages/WikiPage.tsx](../../src/app/pages/WikiPage.tsx#L149-L154) 仅做标题/别名 `includes` 匹配。
- **最小实现**：
  1. 先写失败单测：索引含 `RoPE`、`W8A8`、`AllReduce`、`FP8量化`、`--enable-chunked-prefill` 的正文与摘要，用全小写或中英连写查询断言命中；
  2. 在 `terms()` 中同时保留驼峰拆分词与完整小写复合词（如 `AllReduce` 同时索引 `allreduce`、`all`、`reduce`），先把中英交界处切开再分别对拉丁串和汉字二元切分，去掉 `L259` 正则中的空格，放行 `--` 开头参数别名；
  3. 在 `WikiPage.tsx` 搜索框接入轻量客户端索引（覆盖 `title + aliases + summary + H2`），展示命中摘要提示并支持 `Ctrl+K / ⌘K` 聚焦。
- **验证命令与预期结果**：`retrieve.test.ts` 与 `WikiPage` 搜索交互测试全绿。

#### Task 1.6：修复前端图注转义、路由跳转与三维 WebGL 上下文释放
- **当前缺陷**：
  - [src/content/wiki/WikiDiagram.tsx](../../src/content/wiki/WikiDiagram.tsx#L136-L138) 未解码 `<title>` XML 实体（渲染出 `&lt;think&gt;`、`TP&gt;1`）；
  - [src/app/wiki/ChatDrawer.tsx](../../src/app/wiki/ChatDrawer.tsx#L503) 使用原生 `<a href="#/wiki/...">` 不重置滚动，[src/app/wiki/ChatMarkdown.tsx](../../src/app/wiki/ChatMarkdown.tsx#L48-L52) 页内 `#锚点` 404 且外链缺 `target="_blank"`；
  - [src/app/wiki/ReaderResizeHandle.tsx](../../src/app/wiki/ReaderResizeHandle.tsx#L100) `onKeyUp` 误写盘，[src/app/pages/WikiPage.tsx](../../src/app/pages/WikiPage.tsx#L124) `directoryOpen` 跨视口残留；
  - [src/app/wiki/WikiScene.tsx](../../src/app/wiki/WikiScene.tsx#L170-L174) 与 `inference-scene-kit.ts`、`wiki-parallel-mechanism-renderer.ts`、`wiki-residual-renderer.ts`、`cityScene.ts` 销毁时未调用 `renderer.forceContextLoss()`。
- **最小实现**：改为用 `DOMParser` 解析后读取 `titleEl.textContent` 自动解码实体；统一改用 `<Link>` 与安全锚点处理；`onKeyUp` 仅响应左右方向键，切回桌面视口时重置 `directoryOpen`；所有 Three.js 渲染器 `dispose()` 补齐 `forceContextLoss()`，且单页多场景离开视口超出阈值时释放离屏上下文。
- **验证命令与预期结果**：对应组件单测全绿，`pnpm build` 无警告。

---

### Phase 2：目录重排、批量去补丁与主线正文循序渐进重构

#### Task 2.1：建立“全景直觉钩子 + 基础积木先行”的单一目录真相源
- **涉及文件**：[src/content/wiki/toc.ts](../../src/content/wiki/toc.ts)、[wiki/concepts/learning-guide.md](../../wiki/concepts/learning-guide.md)、[src/content/wiki/toc.test.ts](../../src/content/wiki/toc.test.ts)。
- **实施要点**：
  1. **导读页去杂音**：将 `learning-guide.md:63-118` 的 55 行高阶外部专题表抽离至进阶专题参考区，首屏直接给出清晰阅读地图，并增加自动化单测保证 `learning-guide.md` 中的章节链接顺序与 `toc.ts` 严格一致；
  2. **重排主线前段顺序**（默认推荐“双层开篇”，待拍板确认）：
     - **入口第 1 站**：`learning-guide`（全站路线图）→ 1 篇**零未定义公式、纯算术直觉**的“一次请求全景鸟瞰”；
     - **基础积木篇（零前置黑话）**：`token` → `embedding` → `matmul-and-weights` → `low-precision-formats` → `quantization` → `mlp-residual-norm` → `layers-and-hidden`（将原有多流矩阵高阶变体剥离后移）→ `attention-qkv` → `prefill` & `decode` → `kv-cache` → `block-table` → `sampling`；
     - **架构变体与旗舰综合算账篇**：在学完注意力、缓存与量化后，再依次进入 `mla` → `sparse-attention` → `moe` → `kv-cache-spec` → 旗舰模型单机/双机全景算账与 `one-request` / `concurrent-requests` 深度调用链；
  3. **禁止未编排尾插乱序**：清理 18 篇依靠 frontmatter `toc` 字段尾插造成的逆序，全部显式编入 `CURATED`，并在 `toc.test.ts` 增加关键前置依赖顺序断言（基于 `relations` 中的 `prerequisite` 自动校验“前置页在目录中尽量不晚于依赖页，或显式标注进阶回看”）。

#### Task 2.2：裸哈希页重命名与参数页作用域标题规范化
- **涉及文件**：`wiki/concepts/gap-*.md`、`wiki/sources/answer-*.md`、`wiki/params/*-<12hex>.md`、`scripts/wiki/params/pages.ts`、`scripts/wiki/worker.ts`、`server/answers.ts`、`src/content/wiki/toc.ts`。
- **实施要点**：
  1. 修改生成脚本：新缺口页与沉淀页必须生成语义化英文 slug；嵌套同名参数页采用 `<parent>-<leaf>` 命名并在标题中带父级路径（如 `compilation_config.size` 而非裸 `size`）；
  2. 编写本地迁移脚本：将存量裸哈希页重命名为语义化 ID，原哈希 ID 写入 `aliases` 并接入路由重定向；将 `sources/rfork-official-guide.md` 移回资料参考区，不再混入正式概念节。
- **验证命令与预期结果**：`pnpm check:content`、`pnpm wiki:lint` 及历史链接重定向测试全部通过。

#### Task 2.3：AST 脚本批量清洗“分裂版本段 / 首句版本劫持 / 纯文本死角标”
- **涉及范围**：33 篇 `wiki/params/*.md`、73 篇含粗体版本补丁段的 `wiki/concepts/*.md`、64 篇含“来源 N–M”纯文本的 `wiki/concepts/*.md`。
- **实施要点**（纯本地脚本 + 逐类抽检，不消耗批量模型调用）：
  1. 解析参数页：把 `## 一句话` 下方的 `**v0.30.0rc2 对照：**` 提取归并至文末 `### 版本谱系` 四列表格，恢复首段“一句话讲清参数作用”，并专项核平 `enable-super-kernel` 等前后矛盾项；
  2. 解析概念页 `## 对照源码`：将表格上方的散文式版本补丁段解析合并为统一四列版本矩阵（`v0.23.0 | v0.26.0rc | v0.30.0rc2 | main`）；
  3. 将对照表中的 `来源 85–90` / `见 148–168` 自动转换为可点击的 `[C85]` 等标准角标（校验对应编号在 `frontmatter.sources` 中有效）。
- **验证命令与预期结果**：编写审计断言确认全库 `**v0.30.0rc2` 散文补丁段清零、参数页首句零版本劫持、对照表纯文本来源号清零，`pnpm wiki:audit` 全绿。

#### Task 2.4：核心主线前 20 页与重叠页“单页隔离”教学精修
- **实施原则**：严格遵守第三章“单页单上下文隔离”，以 [chunked-prefill-v2.md](../../wiki/concepts/chunked-prefill-v2.md) 为样板逐页重构：
  1. **剥离首屏防挑刺分支**：将 `token.md`、`attention-qkv.md`、`one-request.md`、`concurrent-requests.md` 首屏括号里的源码异常分支统一移入正文末尾 `### 边界条件与特殊分支`；
  2. **修复错位引用与突兀场景过渡**：修复 [prefill.md](../../wiki/concepts/prefill.md#L221) 悬空的“六词分布”（改回本页 4 词元算例自洽数值）；在 [attention-qkv.md](../../wiki/concepts/attention-qkv.md#L201-L205) 为双卡三维场景补齐过渡说明或调整至并行章节对应处；将 `layers-and-hidden.md` 中占 60% 篇幅的多流矩阵机制拆成独立进阶页，让第 2 章第 1 节回归基础层间隐藏态传递；
  3. **清理异物嫁接与合并重复页**：精简 `device-memory.md`（宿主机容器退出码移至排障页）、`async-scheduling.md` 与 `pd-disaggregation.md`（目标硬件不支持的异构方案压缩为 3 行对比说明）、`structured-output.md`（拆分外部长配方，补回代码反引号）、`request-call-chain.md`（移除离线睡眠接口嫁接与充数算式）；将 `graph-mode-layer.md` 与 `acl-graph.md` 按“通用图捕获原理 vs 昇腾图包装实现”明确分工，消除 40%+ 重复。
- **验证命令与预期结果**：每改完 1 页立即运行 `pnpm check:content`、`pnpm wiki:lint`、`pnpm wiki:audit`，并对照“零未定义前置术语、单一贯通算例”清单逐页打分复核（目标全部 ≥ 8.0/10）。

#### Task 2.5：闭合建站“第四问”（双机目标硬件理论延迟算账）
- **涉及文件**：[wiki/concepts/glm-5-3-flash-two-node.md](../../wiki/concepts/glm-5-3-flash-two-node.md)、[wiki/concepts/inference-performance-analysis.md](../../wiki/concepts/inference-performance-analysis.md)、[src/sim/modelspec/parseHfConfig.ts](../../src/sim/modelspec/parseHfConfig.ts)。
- **实施要点**：基于固定公开硬件标称算力/带宽与前文已核实的模型计算量、权重/缓存访存量及跨机通信字节数，给出清晰透明的算力屋顶与访存/通信下界推导（明确标示理论下界与实测开销边界，不编造未实测吞吐数字）；同时为 `parseHfConfig.ts` 补齐主线模型结构解析或明确提示支持矩阵。

---

### Phase 3：前端阅读器体验升级与浏览器实测验收

#### Task 3.1：“散文窄栏易读 + 图表宽栏舒展”排版改造
- **涉及文件**：[src/design/wiki.css](../../src/design/wiki.css)、[src/design/knowledge-reader.css](../../src/design/knowledge-reader.css)。
- **最小实现**：保留 `.wiki-article` 最大宽度 `1200px` 供 `wiki-diagram`、`wiki-scene` 与宽事实表舒展展示；对正文纯叙事块（`.wiki-body > :is(p, ul, ol, blockquote)`）设置舒适阅读行宽（约 `72ch` / `780px`），消除一行 70 字的密集扫视疲劳。

#### Task 3.2：页头“前置概念导览条”与着陆页三条学习路线卡片
- **涉及文件**：[src/app/pages/WikiPage.tsx](../../src/app/pages/WikiPage.tsx)、[src/design/knowledge-reader.css](../../src/design/knowledge-reader.css)。
- **最小实现**：
  1. 在文章标题与摘要下方，若 `relations` 存在 `prerequisite`，直接渲染轻量可点击的“阅读本页前建议先看：[A] → [B]”，并将内部生产元数据（`源码提取 / 资料投喂` 等）弱化下移至文末来源折叠区旁；
  2. 在 `/wiki` 着陆页顶部新增“零基础推理原理线”“昇腾系统调度与图模式线”“双机部署与排障线”三张清晰入门路线卡。

#### Task 3.3：桌面与移动端浏览器全链路实测验收（含教学 3D 播放验收）
- **前置条件**：本地启动 `pnpm run dev:all`，由用户在浏览器权限提示中授权访问 `http://127.0.0.1:5173/`。
- **验收清单**：
  1. 桌面（1440×900）与移动端（390×844）分别走通首页、`/wiki` 着陆页、导读页、前 10 篇主线页、参数页、左侧全文搜索、右侧四栏面板（问答/投喂/审阅/状态）与 `/model`、`/hardware` 探索页；
  2. 按 [docs/3d-teaching-standard.md](../3d-teaching-standard.md) 逐项实播核验内嵌三维场景：镜头无裁切遮挡、步进控制与正文数值一致、连续切换 10+ 个三维场景无 WebGL 上下文报错；
  3. 验收完毕立即关闭后台开发服务，归档截图与验收记录至 `docs/reviews/`。

---

## 五、 启动前待用户拍板的 3 个关键决策

计划审阅通过后，只需确认以下 3 项即可进入实施：

1. **主线开篇结构（对应 Task 2.1）**：
   - **选项 A（推荐：全景鸟瞰 1 页 + 基础积木先行）**：第 1 章最前放导读页 + 1 篇**零未定义公式、纯白话算术**的“一次请求全景鸟瞰”建立全局直觉，紧接着讲词元、嵌入、矩阵乘、低精度与量化、注意力、预填充/解码、键值缓存，最后再进入旗舰模型重型综合算账与多机制耦合页；
   - **选项 B（纯基础先行）**：第 1 章直接从词元、嵌入、矩阵乘开始，所有全景请求页全部移到基础积木之后。
2. **裸哈希参数页重命名格式（对应 Task 2.2）**：
   - 嵌套同名参数（如 3 个不同配置类下的 `size`、`mode`）标题统一改为带父级前缀（如 `npu_compilation_config.size`）并保留原哈希 URL 自动跳转，是否认可？
3. **执行节奏授权**：
   - 建议按 **Phase 0 + Phase 1（工程止血、解开流水线锁、修完 11 个全栈 Bug，让 9 项门禁全绿）→ Phase 2（目录重排 + 脚本去补丁 + 主线前 20 页精修）→ Phase 3（前端排版升级 + 浏览器视觉实测）** 分批推进，每完成一阶段向你汇报实测证据后再进下一阶段，是否同意？
