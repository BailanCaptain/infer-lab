---
id: F003
title: GitHub issue / PR 在线报错溯源
status: in-progress
owner: BailanCaptain
created: 2026-09-10
---

# F003 — GitHub issue / PR 在线报错溯源

**Status**: in-progress。2026-09-22 用户改定在线查证优先：贴报错 → 找 issue → 读解决办法 → 追修复 PR → 核对自己的版本。全量本地镜像不再是目标的前置条件。历史同步器保留，本轮不运行大规模导入。

## Why

用户要的是有依据的处理办法。全量保存不能替代读懂讨论、匹配环境、核对回移与实际版本。默认只缓存已查证据；值得沉淀的少量材料通过现有草稿审阅流程进入 Wiki。

## What

- 同查 `vllm-project/vllm-ascend` 与 `vllm-project/vllm`；初次搜索按本机当天向前一个日历年、`updated` 限定，2026-09-22 对应 2025-09-22。
- 关联证据可以早于窗口，避免截断修复链；扩大初始仓库或时间范围需用户明确要求。
- 配置唯一来源 [`wiki/github-trace.config.json`](../../wiki/github-trace.config.json)，判断流程唯一来源 [`vllm-error-trace` skill](../../.agents/skills/vllm-error-trace/SKILL.md)。
- 当前入口是 Codex skill / CLI。**网页聊天框尚未接入在线搜索**，仍使用原有本地检索，不能将本轮成果描述为网页端到端已经完成。

## Acceptance Criteria

### 验收状态（更新于 2026-09-22）

本表是当前唯一验收状态。旧全量导入口径见 Git 历史，按用户本次决定调整，不再把未首拉作为无法排错的阻碍。

| AC | 当前结论 | 证据与边界 |
|---|---|---|
| AC1 | 在线范围已真实验证 | 双仓库搜索 `UnquantizedFusedMoEMethod is_monolithic`，返回 Ascend #15815 与上游候选；输入没有 issue 编号或 URL。仓库、日期、查询与候选边界均输出。全库首拉未执行。 |
| AC2 | 按需证据链已真实验证 | 读取 #15815 正文、评论和时间线，追到 #15981 的真实 patch、评审与逐行评论。复读缓存有 `cacheHits` 和逐项时间；TTL、强制刷新、分页与请求上限有回归。证据不全显式标记，不声称全库离线可查。 |
| AC3 | 失败边界已测试 | 共用 GitHub 客户端的 auth / rate-limit / network / not-found / API 分类；原有真实无效 token 401 验收保留。新增回归确认 API 失败不等于零命中，分页或请求耗尽不冒充完整，注入文本被标记。 |
| AC4 | 在线小样本达到门槛，仍需更多真实评估 | 用原先冻结的 10 条 Ascend traceback，不带编号或 URL，双仓库近一年在线搜索：**Top-1 = 6/10、Top-5 = 8/10**，46 次有节奏的搜索请求、全部完整返回；无匹配对照为 0。另核未合并 PR 不当修复。这是自动关键词候选召回，尚不代表全仓库召回或 skill 的因果判断正确率。 |
| AC5 | 在线修复版本链已真实验证 | #15815 → #15981 → `87c345c13d3b259fac8761d68381bd91df6906aa`；在线解析 v0.26 分支为 `2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f`，compare 确认包含。详情缺失的合并 SHA 从明确 merged 事件取得，标记来源；回移、revert 与运行前提仍须另核。 |
| AC6 | 真实 PR 草稿与待审 diff 已产出 | #11953 参数删除 diff 经 sanitize → compileRaw → prepareDraftReview，产出 `pr-11953`；review `c95be1987f15bf3a9dd302c0089aeed969193d8d381f78bda4bb5aa1f878d120` 为 pending。作者是当前 Codex 会话，经通用 `RunAgent` 递交真实撰写结果，不冒称 Claude 成功或无人值守验收通过。正式库未自动发布。 |
| AC7 | 既有 10 条真实样本验收保留 | 12 个文档链接均解析版本与路径，9 个映射本地，3 个明确无对应 ref。在线 skill 继续遵循文档版本边界；新 CLI 尚未额外嵌入映射结果。 |

判准保持七项，不另扩验收机制：

- **AC1 · 有界在线搜索**：实际仓库、时间与查询可核对；候选数量不冒充全量计数。
- **AC2 · 按需取证与缓存**：正文、讨论、关联事件、PR diff 和评审有来源与时间，截断或缺失显式报告。缓存不自动成为正式页。
- **AC3 · 失败可见**：失败与零命中分开；保留可读的部分证据，不猜缺失内容，不连续重试限额错误。
- **AC4 · 报错检索质量**：固定真实 traceback，查询不带答案编号或 URL，报告 Top-1 / Top-5 与无匹配对照。10 题 Top-5 至少 7 题仅为小样本门槛；另验证 skill 的环境差异与因果判断，不能把关键词命中当修复确认。
- **AC5 · 修复版本判断**：明确修复因果、合并状态、修复 commit、目标 ref 解析出的 SHA。`not-ancestor` 只证明原提交不在祖先链，等价回移仍可能存在；证据不足返回无法确认。
- **AC6 · 重要 PR 升级**：保留触及 seeds / 参数入口的排队逻辑；清洗后由可替换作者生成草稿，经现有来源、schema、lint 与整合校验，完整 diff 可审阅，发布遵循审阅状态。不绑定一家模型。
- **AC7 · 文档链接**：解析官方 URL 并区分引用版本和当前 pin，映射失败给原因，不将 latest 当作所有版本。

## 使用与费用边界

```bash
pnpm -s wiki:github-trace plan --input <日志文件>
pnpm -s wiki:github-trace search --query "UnquantizedFusedMoEMethod is_monolithic"
pnpm -s wiki:github-trace inspect --url https://github.com/vllm-project/vllm-ascend/issues/15815
pnpm -s wiki:github-trace verify --repo vllm-project/vllm-ascend --fix 87c345c13d3b259fac8761d68381bd91df6906aa --target releases/v0.26.0rc
```

命令不调用模型、不写 GitHub；凭据只读环境 `GITHUB_TOKEN`，无凭据也可查询公开资料，限额不足如实报告。默认缓存已读响应；`--no-cache` 禁用，`--refresh` 重取，`--output` 只写本机 runtime。`complete` 只描述此次有界请求，不代表穷尽全库。skill 另行阅读、判断并组织回答。

AC6 原 Claude 调用因周额度耗尽失败，现能透传具体诊断；用户随后授权当前会话。桥接回执的 `costUsd: 0` 只表示没有新增项目 CLI/API 账单，**不表示交互会话不消耗额度，也不是交互会话美元计费数据**。默认自动 CLI 仍是 Claude，跨提供方无人值守调用尚未实现；现有 `RunAgent` 和 `wiki:stage` 可让其它作者经过同一校验、审阅流程。

本机证据：`tools/wiki-runtime/f3-online-20260922/` 下 `search-error-real.json`、`issue-real.json`、`pr-real.json`、`version-real.json`、`vllm-pr-real.json`、`nomatch-real.json`、`ac6-result.json`、`ac6-review.diff`。换机器需重跑；它们不是另一份共享状态表。

## 尚待完成

更多真实排错评估、网页聊天在线入口；待审 PR 按实际审核结果发布。`maxTasks` 保持用户既定时点：这个阶段做完、大规模导入前配置，不由本轮私自开启。其它付费开关、课程术语与硬件边界仍看交接页。

## Dependencies / Links

- [F001](F001-llm-wiki.md)：检索、知识页与证据规则。
- [F002](F002-param-lineage.md)：本地版本谱系，在线 compare 提供补充。
- [F004](F004-knowledge-loop.md)：清洗、草稿、审阅和发布共用链路。
- [历史采集计划](../plans/github-corpus-plan.md)：保留旧同步器设计，不是当前首拉指令。
- [GitHub Search](https://docs.github.com/en/rest/search/search)、[PR API](https://docs.github.com/en/rest/pulls/pulls)：搜索上限与 PR 字段的官方依据。
