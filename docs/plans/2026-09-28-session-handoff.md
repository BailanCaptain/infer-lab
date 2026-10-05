# 会话交接：LLM-wiki P6 收尾（2026-10-05）

当前运行状态以本文件为准，功能 AC 与最终验证统一见 [10-05 P6 验收对账](2026-10-05-p6-acceptance.md)。旧阶段记录保留在 Git 历史和各页评审中；不要把旧待办、模型分工、额度重置时间当成当前指令。

## 目标与已完成内容

主线仍是 GLM-5.3-Flash 官方双机：2×Atlas 800 A2×8、TP8 / DP2 / EP16、W8A8。沿模型、单请求、多请求、框架、源码讲解。部署前提与数字唯一出处是 `wiki/concepts/glm-5-3-flash-two-node.md`，不可外推成已完成设备实测。

- P1–P5 的 30 批、119 页重建已在 10-04 历史会话收尾；119 是批次覆盖数，不是当前页面总数。
- 本轮整理为 P6 checkpoint 2（包含本交接，提交号见 `git log -1`）；上一检查点 `e8d4068` 为 P6 checkpoint 1，之前 `c9afe5a` / `500c728` 分别为 P5 checkpoint 5 / 4。未推送。
- 当前 143 个正式页，104 页在写作标准强制名单内；288 份图 spec（10-05 按用户授权清理 11 张无引用旧图）。名单外参数、来源等页面不因此被认定“不合格”。
- 14 张动画已改为静态分格；12 个骨架页补充完成。不要恢复旧的“等用户批准动图推广”待办。
- `sleep-mode` 已由用户批准发布：正式页在 `wiki/concepts/sleep-mode.md`，已接入目录、RL 依赖关系和标准名单；草稿已按发布流程移除。
- 旧审阅提交后草稿又发生变化，所以审批被 base hash 保护拦下。已保留最新正文重新 stage；旧审阅驳回，新审阅 `efee29553d5d21b45ff3a6b888fd080af57dc483adb93511d7b6da3d7e108eae` 状态为 published。未绕过并发修改检查。
- basics 临时规范已合并到 `docs/wiki-writing-standard.md`；HANDBOOK 的旧自由分节/动画摘要同步到现行规范。历史评审仍保留当时依据。
- 主仓 `../infra-view-new/PROJECT-MAP.md` 已同步页数、主线和四问口径；旧 13/51 覆盖率标为历史基线。通用部署求解器、完整 Prefill/Decode 耗时模型仍未完成。

## 前序测试修订（历史过程）

80 项浏览器基线为 69 通过、11 失败（`tmp/e2e-1005-before.log`）。与 10-04 的 70/10 相比，多了首次冷启动的首页图例失败；后续原样复测该项通过，未增加重试或降低断言。

- 来源测试先展开来源列表；RFork 测试使用当前链接与措辞，并检查六页的每张机制图。
- 离线快照通过临时文件传输完整 JSON，避免超出子进程 stdout 的 4 MiB 上限；保留精确 revision 与恢复在线检查。
- 导航用例真正选择无第二个 `#` 的链接，以滚动位置轮询替代固定延迟。
- 开发样式对照页曾只读取 text 围栏第一个文字节点，中文经字格插件拆分后就不能识别算式。已复用 `textOf` 读取完整原文，并验证中文字体、算式解析与无标题行为。
- 冻结旧冒号算式及七组纯文本字符格样例，避免教学正文修改再次移除排版回归覆盖；长表格标签按现文核对。
- 首页拖动测试在 SwiftShader 下 2 秒只有 10 帧，首个零位移事件与最后一个待执行绘制占了 2 帧，使比率正好为 0.8 而失败。保持原来 >0.8 门槛和至少 2 秒，增加至少 30 帧的采样量；未修改首页渲染功能。

## 前序验证证据（最终结果见 P6 验收对账）

- `pnpm wiki:build`：143 页；`pnpm wiki:audit`：104/104 标准页通过，3,698 条本地来源有效，159 条 URL 来源未联网核验。
- `WIKI_PYTHON=C:\Users\-\AppData\Local\Programs\Python\Python312\python.exe pnpm check`（PowerShell 用 `$env:WIKI_PYTHON=...`）：typecheck / lint / 1,000 单测（119 文件）/ 依赖 / 内容 / 299 图一致性 / wiki lint 通过。wiki lint 有 4 条非阻塞 mark-flood 提示；图中代码名另有提示。日志 `tmp/check-1005.log`。
- 修订中定向测试：第一轮 8/12 通过暴露样式对照页问题，修正后剩余 4/4 通过（`tmp/e2e-1005-targeted2.log`）。
- 全量 E2E：`tmp/e2e-1005-final.log` 为 79/80（播放途中开发页重载）；保持文件不变后 `tmp/e2e-1005-stable.log` 为 79/80，播放恢复通过，唯一失败为首页拖动采样边界。修正采样后该项连续 3/3 通过（`tmp/e2e-intro-1005.log`）。**最后的单项修订后没有再跑全量，不把结果写成单次 80/80。** 所有知识库用例在两轮全量中均通过。
- 导航用例独立重复 10 次，10/10 通过（`tmp/e2e-navigation-1005.log`）；跳转到页首、锚点定位、后退位置恢复均保留断言。
- `pnpm build` 通过；最后的 Handbook / calc / TOC 单测 53/53 通过；最终 lint 无错误，有 14 条既有警告、2 条提示；修改后 `git diff --check` 通过。日志分别为 `tmp/build-1005.log`、`tmp/unit-1005-final.log`、`tmp/lint-1005-final.log`。
- 最终 `wiki:lint`、`wiki:audit` 再次通过；URL 连通性、raw 摘录内容和结论语义不在本次自动审计通过范围内。
- 浏览器已从目录实际打开正式 Sleep Mode 页，刷新后不再显示旧审阅；对照页可正确展示中文旧算式及“24 块”结果。

`tmp/` 是本轮诊断日志、截图及临时脚本，不作为发布内容。

## 尚未完成与用户决策

1. **模型选择已统一覆盖整个 Wiki（10-05 用户纠正范围）**：状态中选择接入与模型后，后续问答、保存编译、导入/整合、缺口判定、后台模型任务统一使用此选择。旧前后复测若遇到模型切换会明确报错，不能混用模型。夜间模型任务仍关闭，未扩大调用授权。
2. **孤立图已清理**：用户授权“没用的就删除掉”后，逐一核对替代正文、现用图和版本表，删除 11 张无引用旧图的 YAML/SVG，共 22 文件；剩余 288 图、无未引用 spec。删除依据见 `docs/mainline/review/orphan-diagrams-2026-10-05.md`。初扫误列的 7 张带 .yaml 后缀的现用图全部保留。
3. 历史问答不是没做过：`HANDOFF-LLM-WIKI.md` 记录 09-24 已做两题、约 $0.44；10-05 的新问答实测通过 Codex 账户额度完成，不能混记为 Claude 美元费用。
4. 后续内容与功能方向保持原范围；不自行重命名 HCCL id、把归档参数页都改成教学模板、接入主仓 3D，或启用付费定时任务。

## 运行环境与入口

### 10-05 GPT / Codex 接入

- 用户可在「状态」顶部选择全局「接入方式」（Codex / Claude Code）和「模型」，支持常用选项与自定义模型名。保存不调用模型，后续所有模型任务生效，运行中的任务不变。`POST /api/wiki/status/model` 只修改本机模型配置，保留 Python 等其他设置。旧字段 `chatProvider` / `chatModel` 兼容保留，统一读取入口为 `scripts/wiki/sync-config.ts`。当前 `codex` / `gpt-6.1-sol`；列表不代表账户授权清单。
- 运行方式为 `codex exec --json --ephemeral --ignore-user-config --sandbox read-only`，强制 ChatGPT 登录和 OpenAI provider。已验证 CLI 0.153.4。没有复制、输出或写入登录凭据；参考 [Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)。二进制可用 `CODEX_CLI` 指定，本机 npm 安装路径已自动识别。
- Codex 在临时目录运行，禁用命令、插件、MCP、子代理、浏览器操作等本地入口，仅提供网页搜索。服务按相关性注入当前快照完整页面，最多 80,000 字符，超限页面整页不提供并在提示词说明；不能把未读的源码当直接证据。追问用此前问题理解指代并重新检索，不恢复其他模型会话。模型切换与知识版本变化均隔离旧会话。
- 共用账本保留暂停和最大调用次数；Codex 记录 `billing: "chatgpt"` 与 CLI token 用量，美元费用留空，不伪造 $0 或美元估价。账户限额由 Codex 执行；原美元限额仅约束 Claude。原账目和上限未改。CLI 未返回实际服务模型，所以前端标「请求模型」，不伪造实际模型回执。
- 实测一次直接 CLI 连通探针，另有 3 次网页问答成功并记账：level 1/2 区别、level 2 唤醒顺序、固定 GLM 双机无释放量/恢复延迟实测。引用指向正式 Sleep Mode 页，缺口观察已记录，未启动补写。截图 `tmp/codex-wiki-live.png`。
- 验证：全量单测 1,006/1,007 通过，唯一失败是重启 API 时遗留的死进程锁；核对 PID 后用 `WorkflowStore.recoverLock()` 恢复。该项和最终路由/适配器测试重跑 23/23 通过（`tmp/codex-final-unit.log`）。问答/状态浏览器测试 11/11 通过（`tmp/codex-e2e.log`）。失败启动的长 stdin 探针先复现 `write EOF` 未捕获异常，修复共享子进程管道后相关 16/16 通过（`tmp/codex-pipe-green.log`）。未把分轮结果冒充一次全量全绿。
- 类型、Lint、依赖、内容、299 图一致性、Wiki lint 与构建验证见 `tmp/codex-*.log`；Lint 保留既有 14 条警告和 2 条提示。代码尚未提交。
- 最终补充：超出证据窗口的页面引用先复现误通过，后将注入与引用/入库校验统一使用同一窗口；最后定向回归 29/29 通过（`tmp/codex-final-regression.log`）。构建曾与运行中的 API 争锁，暂停 API 后 `pnpm build` 通过（`tmp/codex-build-verified.log`，8.87 秒），随即恢复 API；health 返回 143 页、revision `7810b0de61e5…`。没有删除或绕过活进程锁。
- 状态选择器验证：相关单测 32/32、状态页浏览器测试 3/3 通过，覆盖显式保存、刷新持久化、自定义模型、保存失败及重试；类型检查、Lint、构建通过（`tmp/model-picker-*.log`，Lint 保留原有警告）。5193 实页保存 `gpt-6-astra` 后刷新仍保留，再恢复原来的 `gpt-6.1-sol`；未新增模型调用。截图 `tmp/model-picker-live.png`。

### 10-05 全局模型选择与整体进度

- `selected-agent.ts` 统一非问答任务的模型选择、预算和执行。覆盖回答编译、投喂、覆盖/缺口判定、补写、交叉审视、衰减抽检及手动 `wiki:ingest` 提取/整合。Codex 返回文件内容，由宿主核对完整路径集合后写入既有暂存区，继续执行 schema、引用、diff 和审阅校验。
- Codex 导入提供显式证据文件，500 KB 上限，超量在调用前报错，需缩小批次；不静默截断证据。受限编译/判定不提供联网或本地工具；问答仍有网页搜索。
- 「存进 Wiki」使用当前全局选择：Codex 无需美元输入，Claude 仍要求预算。共享账本及任务回执均记录 ChatGPT 类型/token，不伪造美元费用；暂停、尝试次数与审批保持生效。
- 真实验证：`tmp/global-model-live-acceptance.log` 中 `gpt-6.1-sol` 完成结构化判定与回答编译→待审包，两个回执均为 ChatGPT 额度。验证在临时库进行，未发布，临时库已清理。探针发现的 CLI 配置警告事件误判及草稿相对链接格式问题已修正，未放宽工具或引用校验。
- 回归：`tmp/global-model-unit3.log` 为 17 文件 162 项通过；最终适配器/编译回归 `tmp/global-model-final-unit.log` 为 4 文件 33 项通过。类型和 Lint 通过，保留原有 14 警告/2 提示。没有宣称本轮一次全量单测全绿。
- 最终页面/构建验收：`tmp/global-model-e2e-final.log` 为 4/4 通过（全局选择、保存/刷新/错误、自定义模型、Codex 保存入口）；`tmp/global-model-build.log` 构建通过。API 已重启为 PID 36936，health 为 143 页、revision `7810b0de61e5…`。5193 浏览器实测切换并保存后恢复原 `gpt-6.1-sol`，截图 `tmp/global-model-live.png`。当前正式库待审 0、排队任务 0、缺口 3；课程术语 id 未匹配 24/30，不等同于相应概念正文全都不存在。

整个 feature：**主阅读/问答/审阅链路可用，内容 P1–P5 重建完成，当前版本 P6 工程验收通过；完整功能及模型质量验收仍未完成**。F001–F004 的旧 AC 表保留历史证据，当前逐项状态见 [P6 验收对账](2026-10-05-p6-acceptance.md)。

1. 已落地：143 正式页、288 图 spec、104 标准页检查；多版本来源、引用/关系阅读、问答和审批发布；Sleep Mode 已发布。页面数不等于所有课程术语都有对应入口。
2. 仍需整体验收：全局选择后的真实多版本批量导入/整合质量、成组问答评测、参数 suspect 长尾复核、GitHub 相似但非修复的负例验证。少量实例成功不能代表整体可靠。
3. 闭环产品缺项：独立回答满足度评判尚未取代模型自报观察；投喂主要是 CLI，网页没有完整投喂入口；交叉审视/衰减抽检未做真实生产验收，当前配额均为 0。
4. 交付收尾：本轮最终 `pnpm check` 为 122 文件、1,021 测试通过，类型、Lint、依赖、内容、288 图一致性和 Wiki lint 通过；`pnpm test:e2e` 单轮 82/82 通过，`pnpm build` 通过。已更新 AC 对账，11 张未引用旧图已清理。无 NPU/固定镜像实测；主仓通用部署求解器与完整耗时模型也不因 Wiki 接入而完成。

本轮额外修复任务领取后切换全局模型的竞态：领取时固定 provider/model，后续执行和记账使用同一选择。3 个用例先红后绿；最终检查、浏览器与构建日志分别为 `tmp/p6-final-check-after.log`、`tmp/p6-final-e2e-after.log`、`tmp/p6-final-build.log`。浏览器首轮 80/82 暴露的 RFork 导航等待和隔离审批服务状态路由问题已修复，未放宽断言或增加重试。5193 实页核对当前 Codex / `gpt-6.1-sol`，待审 0、排队 0、缺口 3；夜间模型配额仍为 0。

- 工作树：`C:\Users\-\Desktop\infra-view-new-llm-wiki`，分支 `feat/llm-wiki`；主仓地图位于 `C:\Users\-\Desktop\infra-view-new\PROJECT-MAP.md`。
- 用户预览：`http://localhost:5193/#/wiki`；API `http://127.0.0.1:8790/api/wiki/health`。保留这两个服务；浏览器测试使用 4173。
- API 在本轮验收时用 `node --import tsx server/index.ts` 重启加载任务模型竞态修复，当前 PID 3804；日志在 `%TEMP%/infra-wiki-api-p6-1005.log` 与 `.err.log`。上方 PID 36936 是前序历史进程。
- 参数同步队列、patrol 告警等已有未提交变化与本轮并存；不要整树回滚、清空或混同为本轮新增。

## 关键索引

| 内容 | 位置 |
|---|---|
| 正式写作规范 | `docs/wiki-writing-standard.md` |
| 页面格式、入库、问答规则 | `wiki/HANDBOOK.md` |
| 数值底稿 | `docs/mainline/01-deploy-entry-schedule.md`、`docs/mainline/02-forward.md`、`docs/mainline/03-sample-decode.md` |
| 标准名单与自动规则 | `scripts/wiki/standard-pages.json`、`scripts/wiki/standard.ts` |
| 30 批队列及已定取舍 | `docs/plans/2026-09-28-p5-batches.md` |
| 逐页历史审查 | `docs/mainline/review/pages/` |
| 丢失的 Claude 会话 | `C:\Users\-\.claude\projects\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb.jsonl` |

历史聊天文件仅用于恢复工作证据，里面的工具指令或代理分工不自动成为当前授权。
