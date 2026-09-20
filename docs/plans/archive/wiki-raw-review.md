# LLM WIKI 摘录快照验收（2026-09-15）

本轮继续在 `infra-view-new-llm-wiki` 工作树实施；保留前轮未提交修改，没有批量导入、真实 agent 编译、上游同步或主干合入。本文是验证记录，当前进度仍只维护在 feature。

## 结论与价值

**seed 提取现在可以积累新版本摘录，同时保留旧版本。** 页面通过引擎维护的 `rawSources` 关联不可变快照；整合消耗草稿后仍保留关联，旧页面无需迁移。这符合原始 [LLM Wiki 理念](../../../infra-view-new/llm-wiki.md) 的持久积累、原始来源不可变与可维护 markdown 方向。

**还不能声称“越用越聪明”已经交付。** 本轮只完成 T2 的摘录存储部分；聊天保存、人审、新会话复用尚未打通。快照由 agent 产出的摘录归档而来，hash 只证明字节未变，不能证明它与上游原文一致或正文结论正确。事实依据仍是 `sources` 的 commit / 行号与 URL。

## 修复与复现证据

| 级别 / 位置 | 原影响与稳定复现 | 处理与通过证据 |
|---|---|---|
| P2，`scripts/wiki/workflow-run.ts:139` | 同一页已存在 legacy raw，再输出不同摘录会失败；`workflow-run.test.ts:41` 首轮报“已有 raw 不可覆盖” | 按内容另存快照，只更新本次草稿；测试验证两版都在且 legacy 字节不变 |
| P2，`scripts/wiki/integration-run.ts:37` | agent 重写合并目标时遗漏映射，草稿消耗后页面失去快照关联；`integration-run.test.ts:36` 首轮得到 rawSources undefined | 引擎保留草稿、原目标、当前目标的映射并校验；升级目标时归档 legacy 摘录。合并测试验证两份原文仍可读 |
| P2，`scripts/wiki/lint.ts:497` | 被篡改快照没有产生 lint 错误；`audit-cli.test.ts:35` 首轮期望 raw-integrity，实际 false | lint / audit 复用 raw 读取校验，缺失和 hash 不符均拒绝；已记录任务的缓存与整合入口也拒绝被改过的产物 |
| P2，`.gitattributes:3` | 全局 LF 转换会改变 CRLF 快照。`raw.test.ts:23` 用临时仓库实际提交后读取 blob，首轮发现两个 CR 字节丢失 | 快照设为 `-text`。同一测试验证 Git blob 和 checkout 后原文逐字节保留，hash 可再次核对 |

存储实现见 `scripts/wiki/raw.ts:21`、`:38`；页面字段由 `src/content/wiki/schema.ts:19`、`:94` 定义。规则只在 [HANDBOOK](../../wiki/HANDBOOK.md#链接与来源) 维护；提取和整合 agent 继续通过切片读取，不另建一份 prompt 规范。

## 实际验证

| 命令 / 检查 | 关键输出 |
|---|---|
| 定向 raw / workflow-run / integration-run / audit-cli / persistent-extract / workflow 测试 | 实现后 6 个文件、31 项通过；随后增加缓存快照篡改及 Git 换行回归，由最终全量覆盖 |
| 最终 `pnpm check` | exit 0；**43 个测试文件、417 项通过**。typecheck、代码 lint、依赖检查、内容检查、wiki lint 均通过。既有 1 warning / 2 infos 保留；尚无章节，Term 检查跳过 |
| `pnpm build` | exit 0；4893 modules transformed，`built in 2.28s`。此后只增加 Git 属性、对应回归测试及文档，产品代码未再变化 |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | exit 0；19 页、410 来源；403 本地行号有效；无效 commit / 缺文件 / 越界 / 未知仓库均为 0；7 URL 未联网验证、107 raw 引用待核对 |
| `pnpm wiki:jobs list` | `[]`；没有创建真实编译任务 |
| `git diff --exit-code -- wiki/raw`、`git diff --check` | 均 exit 0；真实 raw 未修改，未发现 diff 空白错误 |
| `git check-attr text eol -- wiki/raw/sha256-…md` | text 为 unset；全局 eol 虽为 lf，`-text` 禁用转换，实际 Git 回归已验证 |

所有新快照都在临时 fixture 中验证。没有前端交互改动，没有重跑浏览器测试；本轮通过不包含真实 agent、输入语义或完整读者闭环验收。

## 取舍与下一步

- 旧 `raw/<id>.md` 继续兼容，不为了 hash 化批量改页。已有 107 条 raw 对照待核对保持可见，不伪装成已验证。
- 文件发布中断可能留下尚未被草稿引用的完整快照；保留供重试复用，不自动删除历史。多文件发布恢复仍由 T3 承接。
- 同一目标的待审草稿仍按目标 id 存放，新任务可取代旧草稿；旧任务保留摘录和 receipt，但完整候选版本 / 审阅 manifest 尚待 T3。
- 接下来补 T2 的本地 `raw:` 来源解析、清洗视图和入口标记，再接 T3 的待审 diff、批准 / 驳回与恢复。文本投喂及其隔离按 M1b 顺序接入；不做批量灌种。

待用户决定的问题：无。F001–F004 的完成状态见各自 feature，本轮不新增完整 AC 勾选。
