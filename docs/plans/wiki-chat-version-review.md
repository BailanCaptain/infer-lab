# 问答版本隔离验收

日期：2026-09-15。实现位于 `../infra-view-new-llm-wiki`、分支 `feat/llm-wiki` 的未提交工作区。继续完成 F001 / F004 的地基，不增加正式知识页、不批量导入、不启动真实付费模型调用。

## 结论

一次回答的索引、正文、手册和显式引用的不可变 raw 材料现在来自同一知识版本。发布新内容后，续问会重新检索并开启新的模型会话；同版本继续追问保留上下文。读者和每条回答显示对应版本，旧回答仍保留其原版本，避免把历史回答误当作更新后的结论。

这解决“已经发布新知识，却仍沿用旧上下文”的一致性问题，不能替代真实模型的事实核对与前后收益对照。F001 AC8、F004 T5 / M1a 仍不标完整完成；F002 / F003 本轮无实现进展。

## 处理的问题

| 级别 | 位置与影响 | 复现与结果 |
|---|---|---|
| P2，已处理 | `server/snapshot.ts:15`、`server/chat-route.ts:19`：此前只冻结索引，正文继续读取活跃 wiki，回答期间发布可能混用版本 | `server/chat-route.test.ts` 在第一轮 runner 内修改正式页，断言快照 cwd 的正文仍为旧值；第二轮读取新值。`chat-snapshot.test.ts` 验证内容版本稳定、来源副本、篡改拒绝，首次运行实际因 revision 缺失失败，实施后通过 |
| P2，已处理 | `server/chat-session.ts:47`：客户端 sessionId 直接进入模型恢复参数，未绑定知识版本，发布后可能恢复旧上下文 | HTTP 测试验证更新后不带 `--resume`，只传历史问题；第三轮同版本带 `--resume` 与 `--fork-session`。单测覆盖未知 session、并发同会话、失败不覆盖成功状态和过期 attempt 回写 |
| P2，已处理 | `server/chat.ts:166`、`:217`：畸形 stream-json 可抛异常，退出码 0 也不能证明完整结束 | `null`、字符串 content 在修复前分别触发 TypeError；现在忽略非法信封。运行器要求唯一结束记录，零条 / 多条不能算成功，不提供保存入口 |

## 实现与单一真相源

- `readKnowledgeSnapshot` 从正式页文本派生 registry、索引和内容散列。目录副本写入 `tools/wiki-runtime/knowledge/<revision>/`，通过暂存目录原子落位；同版本复用前与回答结束后都核对文件内容，拒绝缺失、额外文件或链接。草稿、任务和活跃源码仓库不进入问答副本。显式 `rawSources` / `raw:` 引用会带入副本并检查 hash，旧页未绑定的历史摘录不被冒充为已验证原文。
- `chat-session.ts` 在 `wiki/_jobs/chat-sessions/` 保存应用会话、成功模型会话、知识版本及最多六个历史问题。应用会话标识与模型会话标识分离；并发请求经共享锁和 token 检查。跨版本只传问题帮助理解指代，不恢复旧回答为证据；失败不会覆盖上一次成功会话。
- `chat-route.ts` 是生产与测试共用的 HTTP 编排入口，调用同一 `retrieve()`、快照、会话记录与回答保存流程。保存仍要求引用页在回答期间未改变；当前快照即使有效，也不会静默将过时回答归档为当前结论。
- `ChatDrawer.tsx:110` 消费 `knowledge` 事件，为每条回答显示版本及重检提示；`WikiPage.tsx:57` 显示读者快照版本。模型如何处理跨版本问题的规则只维护在 HANDBOOK 查询切片中。

## CLI 权限依据与边界

本轮实际执行 `claude --version` 得到 **2.1.270**，`claude --help` 确认本机支持 `--restricted`、`--safe-mode`、`--tools`、`--fork-session` 和 `--system-prompt-snapshot off`。

当前配置显式列出 Read / Grep / Glob / WebFetch / WebSearch，使用 restricted 限定文件读取目录，禁用自定义扩展与外部 MCP，使用 dontAsk；不使用 shell fallback。恢复同版本会话时 fork，防止失败请求直接修改之前成功的模型会话。system prompt 不复用启动时的旧记录。

`--allowedTools` 是自动批准规则，不能单独当作工具可用范围；官方权限文档也区分内置工具权限与操作系统沙箱：[Claude Code permissions](https://code.claude.com/docs/en/permissions)。因此此处是原生 CLI 权限配置加引擎文件校验，**没有宣称实现 OS 级沙箱**。本轮没有真实模型工具调用，CLI 实际拒绝越界读取的模型驱动验收尚未验证；旧 CLI 不支持所需参数时应显式失败，不能回退到无隔离配置。

## 验证结果

```text
pnpm check
  Test Files 57 passed (57)
  Tests      490 passed (490)
  ok 依赖方向检查通过
  ok 内容校验：registry 19 页
  ok 内容校验：尚无章节，Term 引用检查跳过
  ok wiki:lint 通过

pnpm build
  built in 2.49s

node node_modules/vite/bin/vite.js preview --port 4173 --strictPort
pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts
  23 passed (24.5s)
```

`pnpm check` 包含 typecheck / lint，exit 0。原有 CSS 1 warning、Biome 配置 2 infos 保留。预览页面 HTML 实际加载 `assets/index-DtJo5mqg.js`，没有开发热更新客户端；测试后已关闭本轮预览进程。浏览器测试使用真实 HTTP handlers 与隔离文件夹，替换的只有模型输出；新用例核对“保存、批准、续问、再追问”的模型恢复参数依次为 **false / false / true**。截图 `test-results/wiki-review-continuing-aft-bf635--starts-fresh-model-context-chromium/wiki-chat-revision.png` 已实际查看，读者版本与新回答版本一致，旧回答保留旧版本。

最后补充的畸形 stream-json 修复属于后端解析，已纳入上述 490 项检查；浏览器模型夹具不依赖该解析器。实际知识库快照读取返回 19 页、21 个副本文件，内容版本为 `17a712287d5b255b4d3c3ddbac610a5e79a1298cbbfdd39f4013043f4cb73ec8`。实际工作树的 `wiki:jobs list`、`wiki:review list` 均为 `[]`，没有用真实编译任务充当测试。

额外验证：本轮 12 个 server 文件通过 Biome stdin 检查，输出与当前文件完全一致；21 份 feature / plan 文档的 98 个正文相对链接缺失 0（排除代码示例）；`git diff --check` 通过。原有未提交修改保留，没有提交或合并分支。

## 取舍与剩余工作

- 版本目录保留供同版本续聊复用；本轮没有增加自动清理器。它是可派生运行缓存，知识真相仍在正式 Markdown 与原始材料。
- 只读副本不包含整个上游仓库；本轮未重新证明旧页的 107 条历史 raw 摘录，上一轮 audit 的未验证范围仍成立。
- 跨版本重启会话会丢弃旧回答上下文；最多六个历史问题只能帮助理解指代，仍不明确时需澄清。离线阅读目前标“构建快照”，尚无精确的离线内容版本号。
- 下一步应固定小样本问题和依据，验证真实模型在隔离配置中的工具行为，再做独立新会话前后对照。没有这些证据，不能把“切到新版本”写成“回答更正确”。费用汇总界面、缺口队列、drop、周期维护仍未交付。

需要用户决定的问题：无。本轮没有替用户设定下一轮真实模型调用的费用上限。
