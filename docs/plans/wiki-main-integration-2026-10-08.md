# LLM Wiki 合入 main（2026-10-08）

用户已授权将 F001–F005 合入本地主仓。功能范围与已知证据边界仍以各 feature 验收表、[最终验收](wiki-final-acceptance.md)和[整体审查](wiki-overall-review-2026-10-08.md)为准。

## 合入范围

- 主仓：`C:/Users/-/Desktop/infra-view-new`，分支 `main`；合入前提交 `69bf9f78365119d8dc53a2a5eb27615e70b8a12e`。
- 功能分支：`feat/llm-wiki`，最终提交 `e8af373b25214326498b52c39006dd9c68adeb51`。包含 Drop、全局模型选择、问答与内容闭环、参数谱系、正式内容及已批准的审阅记录。
- 唯一合并冲突在 `HANDOFF.md`，保留首页 / 城市背景历史，入口改为主仓；同步更新 README、PLAN、PROJECT-MAP 和 Wiki 交接入口。没有修改已验收的产品代码或教学正文。
- 功能工作树及其 `tmp/` 保留；临时目录、模型配置、预算和外部源码缓存不提交。
- 本仓库未配置 Git remote，本次为本地合入。

## 本机运行与数据保留

前端 `http://localhost:5193/#/wiki`、API `http://127.0.0.1:8790` 已从主仓启动。当前开发服务使用 `pnpm dev --configLoader runner --port 5193 --strictPort`；API 为 `node --import tsx server/index.ts`。进程信息与输出见 `tools/wiki-runtime/merge-main-20261008/servers.json` 及同目录日志。

模型选择仍为 Codex / `gpt-6.1-sol`；预算账户、维护游标、参数扫描、语料及原验收证据已复制到主仓的忽略目录。7 份固定源码缓存为独立克隆，HEAD、上游配置及远端引用均与原工作树一致，不依赖旧工作树的 `.git` 或目录链接。

原夜间任务已迁移为 `LLM-Wiki-infra-view-new`，工作目录、脚本和配置均指向主仓，保留每日 03:00、原触发器与运行设置。旧任务 XML 已备份，新旧任务不会重复调度；模型任务、交叉审视及过期抽检配额仍为 0。本次未调用真实模型。

Git 根据既有 `.gitattributes` 统一文本换行。对照 810 个知识文件：720 个字节一致，90 个仅 CRLF/LF 不同，无其他内容差异；68 份内容寻址 raw 快照全部哈希匹配。知识版本因此由 `5e443dabecec…` 变为 `3dccd0370cc9aa2f056e709d865153948fc35e1745a96384cddf07844459e453`，旧问答保留原版本记录。

原主仓 20 个未跟踪文件已核对哈希并保留，包括山境素材、个人文档和其他交接。`PLAN.md` 原有四处未提交措辞修改单独保存，合并提交后恢复为未提交状态。备份位于 `.git/codex-integration-backups/20261008-llm-wiki/`。

## 本轮验证

证据目录：`tools/wiki-runtime/merge-main-20261008/`。

| 检查 | 结果与证据 |
|---|---|
| 依赖安装 | `pnpm install --frozen-lockfile` 通过，未修改 lockfile |
| 类型、Lint、依赖与内容 | 全部通过；Lint 保留 17 warnings、3 infos，正文索引 145 页 |
| 全量单元 / 集成测试 | `pnpm exec vitest run --pool=forks --configLoader=runner`：133 文件、1,097 项通过，442.68 秒；`unit-final.log` |
| 生产构建 | `pnpm build` 通过；`build.log` |
| 图与 Wiki 格式 | 288 张图与 spec 一致；Wiki lint 通过，保留 8 处提示 |
| 固定源码审计 | 145 页、3,893 条来源；3,733 条本地引用有效，104/104 标准页通过；`audit.log` |
| 完整浏览器回归 | **87/87 通过，10.5 分钟**；使用主仓已启动的 5193 服务运行原用例，测试断言与超时保持原配置；`e2e-warm.log` |
| 实际浏览器操作 | 已打开主仓 Wiki，核对 145 页及新知识版本；点击状态、Drop、审阅入口，确认 Codex 模型选择、待审 0、排队 0 和已发布历史 |
| 数据保护 | `preservation.json`、`snapshot-comparison.json`、`content-comparison.json`；20 个原文件、7 份独立源码缓存、模型与账户记录核对通过 |

首次开发服务切换遇到旧进程尚未释放端口，重新启动后解决。主仓冷启动期间，两轮默认 4173 浏览器运行在页面加载阶段超时并中止，日志保留为 `e2e.log`、`e2e-final.log`；首次全量单测在依赖复制与冷启动并行期间中止，随后完整重跑通过。浏览器最终回归使用已实际打开并预热的主仓服务，配置记录在 `playwright-5193.config.ts`。没有修改产品代码、放宽断言或提高测试超时来规避失败。

本轮未证明默认 Windows 原生测试启动已稳定；使用既有显式 forks / runner 方式完成全量单测。源码审计不包括 160 个 URL 的联网核验、3,537 条历史 raw 引用的完整语义复核或 NPU 硬件实验；这些仍是既有证据边界。没有新增需用户拍板项。
