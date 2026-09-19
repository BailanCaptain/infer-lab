# 聊天保存与浏览器审阅验收

日期：2026-09-15。实现位于 `../infra-view-new-llm-wiki`，分支 `feat/llm-wiki` 的未提交工作区。当前状态只维护在 feature 文件，本报告记录本轮证据。

## 结论

有引用的完整回答可以生成待审问答来源页，人在浏览器检查固定版本 diff 后批准或驳回；批准后的目录、正文和独立检索读到新内容。方向符合 LLM WIKI 的“有依据的知识积累”：保留原始问答与页面快照、连接已有页面、共享规则与审阅发布入口。不过，本轮使用固定模型输出，尚不能声称真实新会话的回答质量已经提升。

## 实现与证据

- `server/index.ts` 只给成功结束的回答生成后端记录；`server/answers.ts` 校验记录 hash，保存接口不接受浏览器替换答案。无页面引用、未知引用（含真假混合引用）及代码示例中的伪引用不会产生可保存标识。问答期间引用页变化或存在中断发布时也不记录，防止把回答绑定到不一致的页面文本。
- `server/answers.ts` 归档问答和请求开始时的引用页，冻结编译规则，复用 `compileRaw`、清洗记录、任务指纹和预算。总预算由用户输入，最多两次尝试，每次预留一半；失败只能显式重试，预算不能重置。`server/answers.test.ts` 验证并发保存只调用一次编译器、失败不变相重置次数、注入材料不启动编译。
- `scripts/wiki/compile-raw.ts` 的 `answer-record` 产物必须为 source / I，只能关联提供的页面；未知关系在生成草稿前失败。`prepareSourceReview` 复用隔离候选、lint / audit / build 与统一 review 引擎，正式页不在保存步骤修改。
- `AnswerSave.tsx` 提供预算和重试；`ReviewPanel.tsx` 展示完整 diff，正文页排在派生文件之前，批准 / 驳回绑定所读 revision。`server/pages.ts` 返回同一锁内的正式目录与正文，`installReaderSnapshot` 同时替换派生缓存和检索索引；批准后主动刷新，不依靠重新构建。
- `tests/wiki-review.spec.ts` 用真实本地 HTTP handlers 和 Chromium 操作验证保存 → 待审 → 批准 → 新页正文 → 独立检索命中；另验驳回不入库，以及窄屏下拒绝过期批准。仅 agent 输出被替换，正式仓库没有加入测试页。

## 本轮命令

```text
pnpm check
  Test Files 53 passed (53)
  Tests      482 passed (482)
  ok 依赖方向检查通过
  ok 内容校验：registry 19 页
  ok 内容校验：尚无章节，Term 引用检查跳过
  ok wiki:lint 通过

pnpm build
  4896 modules transformed
  built in 2.76s

pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml
  审计 19 页，来源 410 条
  行号有效 403，URL 未联网验证 7
  无效 commit 0，文件不存在 0，行号越界 0，未知仓库 0
  raw 引用待核对 107
  ok wiki:audit 本地引用与行号校验通过
```

`pnpm check` 包含 typecheck 与 lint，exit 0；保留原有 CSS 1 warning、Biome 配置 2 infos。`wiki:audit` 的通过仅覆盖本地引用与行号，不能外推 URL、raw 摘录内容或结论语义通过。首次直接运行不带参数的 `pnpm wiki:audit` 返回用法错误（CLI exit 2），补齐 seeds 后才获得上述结果。

构建后运行 `node node_modules/vite/bin/vite.js preview --port 4173 --strictPort`，访问 `http://localhost:4173` 确认 HTML 引用 `assets/index-BFRXB7mJ.js`（没有开发热更新客户端）。在该预览上运行 `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts`：**22 passed (28.9s)**。API 由测试代理转发至隔离的真实本地 handlers，模型输出为固定夹具。待审 diff 与发布后正文的截图已实际查看；测试后关闭本轮启动的预览进程。

额外检查：8 个 server 文件逐一送入 Biome stdin，exit 0 且输出与当前文件相同；`git diff --check` 通过。文档链接检查排除代码示例后覆盖 20 份文档、94 个本地链接，缺失 0。正式 `wiki/raw`、`wiki/concepts`、`wiki/sources` 本轮没有新增或修改。

红绿证据：混合真实 / 虚构引用、问答中途页面变化两项测试先分别返回不应存在的记录 id，再修改实现后通过。浏览器第一次回归 21 / 22 通过，原文用例因只替换构建注册表、被运行时 API 覆盖而超时；改为提供同一完整快照后，该用例原有的 HTML 不执行、显示原文和行号跳转断言全部通过，没有降低断言。

## 取舍与未完成项

- 当前沉淀的是带引用的综合问答来源页；不会自动判断某个已有概念应被覆写。引擎校验引用存在与材料完整性，人审仍须核对结论是否得到材料支持，模型回答自身不能自证为事实。
- 问答记录保存原页文本及其引用，不等同于重新抓取全部上游原文。联网补料、drop / quarantine、缺口队列、自动维护、origin 读者标签尚未实现。
- 后端新请求与读者已刷新；问答 agent 的正文读取仍在活跃目录。当前保存前比较引用页避免归档期间的版本不一致，但整个问答的只读 revision 副本、跨 revision 续聊提示及显式版本展示尚未实施。
- 真实 agent 受限编译、六个预设场景的独立新会话前后对照尚未验证。因此 F001 AC8、F004 T5 / M1a 仍是部分交付，四个 feature 均不改成整体完成。
- 本轮没有批量导入、真实付费 agent 调用或新增调度任务；`wiki:jobs list`、`wiki:review list` 在实际工作树均为 `[]`。下一步优先补问答 revision 隔离，再完成小样本真实复问验收。

## 全 feature 进度入口

| Feature | 本轮推进 | 状态单一来源 |
|---|---|---|
| F001 | 聊天保存、审阅 UI、发布后读者刷新；PR ingest 与真实完整验收仍缺 | [F001](../features/F001-llm-wiki.md) |
| F002 | 本轮未改实现；现有 8 个参数页和部分谱系，扫描 / 骨架 / sync 仍缺 | [F002](../features/F002-param-lineage.md) |
| F003 | plan 已存在，采集 / 检索 / 溯源尚未实施 | [F003](../features/F003-github-corpus.md) |
| F004 | 增加聊天保存的可操作路径；真实复问、缺口队列与自动维护仍缺 | [F004](../features/F004-knowledge-loop.md) |

需要用户决定的问题：无。尚未验证的项目如上，不以测试夹具替代真实知识收益验收。
