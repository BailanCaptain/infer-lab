# 1225 第一阶段框架建设与工程验收最终签署记录与总结

- **签署时间**：2026-11-17（10:12 UTC / 18:12 +08:00）
- **授权与接力依据**：用户 `0001794851985790-000969-503fb766`、`0001794854401146-000993-608ce06d`、`0001794854797326-000996-66eced88`（第一阶段终验签署后立即停工待令，文章内容整改留二阶段）；因缅因猫/砚砚在 `001205` 触发 OpenAI 额度上限（至 `Nov 21st, 2026 7:37 PM`），用户于 `0001794892173999-001188-386a6b2e`、`0001794901952471-001208-75bdba3a`、`0001794908666148-001222-2b9b169c` 正式授权条件接力，由暹罗猫/烁烁（`@cat-yn7pk23m`）与梵花猫/墨墨（`@cat-q6r62jbu`）严格遵守跨个体独立检视铁律完成剩余工程闭环并由烁烁签署阶段一收口。
- **阶段一结论**：**第一阶段全部可做工程范围已通过跨个体独立验收（Approved，0 遗留 P1 / 0 遗留 P2）；四类真实样本同代批次因本机 OpenAI Codex 通道配额耗尽按 `001208` 第 3 条原样封存于 generation 1 第 312 次同代断点。本签署仅代表阶段一框架工程完成，绝不等于全方案完成；即日起停止全部后续派工，等待大当家另行指示。**

---

## 一、 第一阶段已独立审定通过的工程成果台账

| 模块 / 任务 | 独立终验报告与关键证据 | 状态 |
| --- | --- | --- |
| **唯一改造方案与阶段一范围定稿**（`037`/`744`/`807`/`931`/`972`） | `docs/plans/2026-11-14-progressive-restructure-and-fix-plan.md`（`d404ad0d…`）、`wiki/HANDBOOK.md`（`b6972b55…`）、`docs/wiki-writing-standard.md`（`bb8f4d00…`）；报告 `757-framework-order-review.md`、`943-framework-doc-rereview.md`、`991-phase1-scope-review.md` | Approved（`done`） |
| **包 1：工程止血与基础门禁修复**（`040` / `092`） | 畸形 URL 400、问答质检期取消保留回答与 `sessionId`、敏感 GET 环回校验、正向白名单 SVG 清洗（拦截 CSS 转义外链）、新克隆 `seeds` 恢复、计划任务暂停、实验稿归档；消息 `000139` 独立复审十项门禁 + 214 服务端测试全绿 | Approved（`done`） |
| **包 2：写管线、旧事实三出口、KaTeX、静态 `raw:` 与参数门禁**（`041`/`142`/`339`/`452`/`459`/`543`/`544`/`649`/`708`） | `editorial`/`supersede.claims` 三出口核验、`params/scan.py` `__init__` 构造参数扫描、`drop` v3/v4 并存、KaTeX 统一与纯静态 `raw:` 阅读、四项机械密度/位置规则降为可见建议（`000577`）、发现阶段收敛与 210 缓存零付费复用（`721-649-rereview.md`）、移除参数页四标题硬模板（`754-708-independent-review.md`） | Approved（`done`） |
| **包 4：2D 双通道、构建期 `Cmd/Ctrl+K` 检索、离线证据面板与阅读交互**（`045` / `751`） | 预编译全文检索索引（`782-search-foundation-review.md` + `802-quick-search-rereview.md`，2,397 查询回环通过）、`legacyIds#anchor` 路由与聊天内链（`843-navigation-ui-rereview.md`）、离线源码/原文证据面板与图多 `pin`（`886-diagram-evidence-review.md`）、`figure` `bend`/`mono`（`897-figure-foundation-review.md`）、`native-svg` 伴生 YAML 与浏览器 `Drop` Review/可恢复发布/128K 预算二分边界（`910`/`955`/`983-native-drop-budget-final-review.md`）、人工白名单交互式 React 2D `quantization-intuition`（`1008-react2d-rereview.md`）、阅读交互尾项（`1018-reader-interaction-review.md`） | Approved（`done`） |
| **包 5 阶段一工程：2A 目录导览、参数 `<parent>.<leaf>` 展示解耦与桌面回归**（`044` 工程子批） | 2A 目录与导览（`1036-directory-final-review.md`，163 页各现一次 + 15 项 Chromium 检查）、参数身份/谱系底座（`1082-param-foundation-final-review.md`，430 绑定 + 28/33 定义恢复）、`<parent>.<leaf>` 展示解耦与 60 条原生来源编号修复（`1142-param-display-final-review.md`）、52 项桌面 Playwright E2E 回归（`1148-desktop-reader-regression.md`） | Approved |
| **包 5 阶段一工程：确定性 AST 迁移工具、只读预演与显式隔离 `--apply` 演练**（`044` 工程子批） | 只读计划器与源码行号消歧（`1192-ast-readonly-final-review.md` + `1196-ast-readonly-163.json` `8b0d354a…`）；显式隔离 `--apply` 全或无预检、受保护 `wiki/` 子目录 junction 与 `--out` 别名三段防护、逆向原文还原幂等复算及 163 页隔离副本三步演练（`1224-ast-apply-final-review.md` + `%TEMP%/infra-wiki-review-20261115/1224-shuo-ast-apply-final-green.json`）：`ast-migrate.ts=d7e143f28f88ec0cce6626dffc4ffb7fe3eae5f97802eee51642ed448016f3d8`、`wiki-ast-migrate.ts=325b859fb7df9e2b631e6dca7da811c735d25ceae7752f25e5d861b0c5c86d63`、`ast-migrate.test.ts=d15ed95a557daf2308d534440b150b49a38904c8ed8aac68aeda64cb031c2291`，14/14 单测通过，正式 `wiki/` 163 页零改动 | Approved |
| **真实样本整合暴露的管线/预算/回执/恢复工程修复与全仓回归**（`1038` 及 `044` 工程短轮） | 预算协商修复（`1047-negotiation-rereview.md`）、失败调用回执不覆写（`1103-call-receipts-final-review.md`）、`assessGap` coverage 快照修复（`1113-coverage-snapshot-rereview.md`）、预算响应契约与 v3/v4 协商缓存（`1121-budget-contract-final-review.md`）、全页编辑微分片消除（`1158-edit-granularity-final-review.md`）、全仓 **211 文件 / 1,776 测试 exit 0**（`1160-full-regression.md`）、单分片编辑输出即时校验与有界恢复（`1171-edit-output-recovery-final-review.md`）、312 次紧预算补读协商帧修复（`1204-negotiation-frame-budget-rereview.md`：`drop-integration.ts=8009f123525d481b8840f8ede7f87bd989a0cfa73f286e2a160bf58a129415dd`、`drop-convergence.test.ts=4073e4209bbf1eb1973a4710f9612411c92a9974d49fc162b03d226d00414ecc`、`drop-context.ts=ab5fa469…`、`drop-run.ts=651bcf70…`） | Approved |

---

## 二、 四类真实样本同代断点保护状态与配额恢复后一键续跑指引（`001208` 第 3 条）

1. **当前精确封存态（零污染、零换代、零付费损耗）**：
   - 隔离运行根：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1000-framework-e2e-tTeaWJ`
   - 批次 ID：`3895c20b-11be-4200-8292-540668d0bef1`（四类真实样本：概念 `chunked-prefill`、公式 `quantization`、参数 `enable-super-kernel-ce990e186bfa`、排障 `inference-troubleshooting`，见 `1000-four-sample-intake-record.md` 与改前独立四会话问答基线 `1078-four-qa-before-baseline.json`）
   - 同代状态：`generation: 1`，已完成 `312` 次真实 Codex 调用缓存与完整回执；第 312 次遇到的紧预算协商帧工程问题已在隔离克隆上通过零模型协议复验（`1200-author-negotiation-green-r4.json`、`1208-momo-independent-negotiation-green.json` `8/8` 全绿）。
   - 外部通道受限证据：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1209-codex-channel-probe.json` 实测本机 `codex.exe`（`gpt-6.1-sol`）返回 `ERROR: You’ve hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase more credits or try again at Nov 21st, 2026 7:37 PM.`（`exitCode: 1`）。因此**未拿零模型协议探针冒充真实模型语义验收**，原隔离树保持 100% 未触碰。
2. **额度恢复后（`2026-11-21 19:37` 后或补充额度后）续跑步骤**：
   - 先用当前审定字节从同一 `generation: 1` 第 312 次缓存续跑完剩余模型整合帧（复用 `%TEMP%/infra-wiki-review-20261115/1180-four-sample-resume.mts`）；
   - 生成整组 `Review` 后在隔离副本内依次执行已备好的验收脚本：`1000-four-sample-review-browser.mts`（核验批准前正式页零写入、浏览器整组批准与中断恢复发布）→ 隔离静态构建与断 API 静态阅读校验 → 4 个独立新会话等价问题改后问答引用、`saveAnswer` 回流待审与 `gap-ledger` 缺口记录核验。

---

## 三、 本轮终验保护核验与保留运行服务说明

1. **最终保护与门禁实测证据**（`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1225-phase1-final-preservation.json`）：
   - `passed: true`：891 个历史运行文件 `changed: []`、398 个冻结 3D 与 `src/sim/**` 文件 `changed: []`、2,851 个正式内容与历史缓存联合摘要仍为 `205167aa29acb2438c741b695815c3f79b0c7b81868e3710d26fa001ec1618a0`；
   - `pnpm exec tsc -b tsconfig.json --noEmit`、`scripts/check-deps.ts`、`scripts/check-content.ts`（`registry` 163 页与磁盘/`wiki/index.md` 一致）、`pnpm wiki:diagrams --check`（351 张图一致）、`pnpm wiki:lint`、`pnpm rfork:verify` 全部 `exit 0`。
2. **保留正常运行的三台本地预览服务（均实测 `HTTP 200`，未关闭）**：
   - `http://127.0.0.1:4173/`（静态构建资产 `./assets/index-BHvjUg2-.js`）
   - `http://127.0.0.1:4174/`（静态构建资产 `./assets/index-BbFtn5iR.js`）
   - `http://127.0.0.1:4196/`（静态构建资产 `./assets/index-kYvu_vn9.js`）
   - 打开任意上述地址进入 `#/wiki` 即可直接体验阶段一已交付的 2A 目录导览、`Cmd/Ctrl+K` 预编译全文检索、`<parent>.<leaf>` 参数名展示、KaTeX 公式、交互式 React 2D 图解（`quantization`）、图下精确多 `pin` 与右侧离线源码/原文证据面板。

---

## 四、 留待后续指示的第二阶段与独立新产品待办清单（未启动）

1. **真实模型通道恢复后的四类样本尾部实跑收口**：待 OpenAI Codex 额度恢复后，从 `1000-framework-e2e-tTeaWJ`（`generation: 1`、`312` calls）完成真实模型语义整合收尾、隔离整组 `Review` 发布、静态阅读与 4 个新会话问答/保存/缺口核验。
2. **第二阶段：全库文档内容改造（严守三步双审闭环 + 3D 冻结，本会话未启动）**：
   - **已改 24 篇候选稿重走新三步法**（`烁烁 558 前置提炼 → 墨墨短回合重写 → 烁烁 039 对照旧稿审讲法 + 砚砚 038 核源码/参考/事实`）：
     - 包 3 首批 4 篇（`042`：保留已双审候选 `02-quantization` `931e8f05…`、`01-chunked-prefill` `0370306f…` 与已过 `038` 的 `03-enable-super-kernel-ce990e186bfa` `c18906ea…`，待补第 3 篇 `039` 教学复核与第 4 篇 `inference-troubleshooting` 提炼重写双审）；
     - 包 5.1 的 13 篇主线候选（`343`）与包 5.2 的 7 篇候选（`416`）。
   - **存量 163 篇正式页 A/B/C 分批改进**（`044` / `477`，对照 `044-abc-inventory.md` 与封存 AST 计划 `1196-ast-readonly-163.json` 中的 1,121 处拟议角标及 131 项人工审阅条目）：分批经真实写管线与整组 `Review` 发布，逐页按真实核验回执回填 `verified`，全部阶段完成后再恢复本机定时任务 `LLM-Wiki-infra-view-new`。
3. **四个独立新产品功能（已定优先级排序，后置独立立项，未启动）**：
   - ① **立项四问交互算账台** → ② **`vllm serve` 配置体检器** → ③ 排障分流向导 → ④ 算子张量数值演示 Inspector。
