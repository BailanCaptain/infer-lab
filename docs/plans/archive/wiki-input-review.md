# 本地来源与清洗验收（2026-09-15）

本轮在 `infra-view-new-llm-wiki` 工作树继续 T2，保留前轮修改。没有批量导入、真实 agent 调用、上游同步或主干合入。当前完成状态仍以 [F004](../../features/F004-knowledge-loop.md#design-decisions) 为准，本文只保存本轮证据。

## 结论

**本地材料已能被页面引用、按原文行号审计、在浏览器中点击查看。** 原文始终保留，不执行其中的 HTML，也不因为存下文件就把它认作官方或源码实证。这补齐了此前“有快照，但还不能作为本地引用核对”的缺口。

**清洗与编译输入准备器已实现，生产编译接线尚未完成。** `prepareRawInput` 校验原文 hash，输出清洗后的选定行、原始行号和清洗 receipt；被阻塞的输入没有 compilerData。receipt 目前是返回值，尚未接入 job 的持久记录。该函数不是 OS 沙箱，也不能限制未来 agent 自己调用 Read 去找原文。T2 后续必须把受限工具、隔离视图和入口一起接上，不能把本轮结果算成 F004 AC1 / AC2 完成。

## 改动与证据

| 能力 | 实现位置 | 复现与验证 |
|---|---|---|
| 唯一本地引用 parser | `src/content/wiki/schema.ts:28`、`:37` | `schema.test.ts` 验证内容 hash 路径和正整数行号；拒绝路径逃逸、盘符、编码逃逸、缺行号、倒序和超出安全整数的行号。首轮 parseRawRef 缺失，实施后通过 |
| 真正读取引用快照审计 | `scripts/wiki/audit.ts:40`、`wiki-audit.ts`、`wiki-ingest.ts` | P2 接入风险：此前通用分支把 raw 当 URL，失败测试实际返回 verdict=url、inRaw=false。现在按快照完整性及原文行数核对；CLI fixture 验证有效两行、第三行越界、篡改失败 |
| lint 不把本地材料自动升档 | `scripts/wiki/lint.ts:407`、`:512`；`scripts/wiki/sources.ts` | C 且仅 raw 来源会报 source-local-evidence；行号越界报 raw-line-range；缺失和 hash 不符报 raw-integrity。S 仍沿用官方来源要求 |
| 只读原文查看 | `server/raw.ts:13`、`server/index.ts:77`、`src/app/pages/WikiPage.tsx:211` | Chromium 从页面引用打开原文，指定两行高亮，点击行号跳转；原文 script 只作为文字出现，window.rawExecuted 未定义。路径逃逸返回 400，缺失 / 越界返回 422 |
| 可追溯清洗视图 | `scripts/wiki/sanitize.ts:52`、`scripts/wiki/prepare-input.ts:10` | 注释清除但换行与行号保留；原始快照字节不变；相同输入得到相同 receipt；清除的文本不在 compilerData 或 receipt 中；阻塞与全空选区返回 null |

清洗检测借鉴本地 Multi-Agent 的 Unicode、HTML、角色标记、编码指令思路，按本项目需求实现小型纯函数；没有整套搬入其状态机，也没有引用其历史验收作为本项目证据。当前测试覆盖跨行 / 全角 / 隐形字符指令、中文指令、角色伪装、script 与 Base64 指令，以及正常代码和公式保持原样。

**规则真相源**是 [HANDBOOK](../../../wiki/HANDBOOK.md#链接与来源)，机器格式只由 schema 定义。F004 AC1 的旧日期序号原文命名改为引用该约定，避免未来 drop 再建一套与当前快照不兼容的命名规则。

## 本轮实际命令

- `pnpm test src/content/wiki/schema.test.ts scripts/wiki/audit.test.ts scripts/wiki/sanitize.test.ts scripts/wiki/prepare-input.test.ts scripts/wiki/sources.test.ts`：5 文件、38 项通过。
- `pnpm test scripts/wiki/audit-cli.test.ts`：5 项通过，含真实临时 Git fixture 与本地引用 CLI 验证。
- `pnpm exec playwright test tests/raw-source.spec.ts tests/evidence.spec.ts tests/wiki.spec.ts`：**19 项 Chromium 测试通过**，40.3 秒。新材料和 HTTP 服务均在临时 fixture；只替换浏览器收到的 registry 来源，真实 wiki 页面未改。
- `pnpm check`：exit 0，**45 个测试文件、431 项通过**；typecheck、代码 lint、依赖、19 页内容及 wiki lint 通过。既有 1 warning / 2 infos 保留；尚无章节，Term 检查跳过。
- `pnpm build`：exit 0，`built in 3.88s`。
- `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml`：exit 0；19 页、410 来源，403 本地行号有效，7 URL 未联网验证，107 raw 引用待核对；无效 commit / 缺文件 / 越界 / 未知仓库均为 0。
- `git diff --exit-code -- wiki/raw`、`git diff --check`：exit 0。主工作树 status 与本轮开始时一致。

代码 lint 的既有范围不包含 server；新增 `server/raw.ts` 另经 Biome stdin `check --write`，exit 0 且再次输出与文件逐字一致。stdin 无 write 模式仍返回“contents aren't fixed”，因此不把该调用算作通过；类型检查和真实浏览器行为验证均另已通过。

## 限制与后续

1. **已知规则过滤不等于注入安全证明。** 有大小和编码检测层数上限，语义改写、未知混淆和跨次链式输入并未全部覆盖；讲解攻击样例的正常材料也可能被阻塞。当前未开放真实投喂，不宣称已有完整隔离 / 人工解除流程。
2. **没有提前勾选完整 AC。** 受限编译接线、清洗 receipt 持久化、origin 读者标记及 drop / quarantine 仍待实施，聊天保存、人审与新会话复用也未完成。
3. **原文查看依赖本地 API。** dev 通过现有 `/api` 代理访问；纯静态部署须同时提供该 API，不能只发布前端就声称本地引用可用。没有部署变更。
4. **下一步按依赖推进**：清洗接入受限编译并记录入口 → 形成待审变更 manifest / diff → 批准、驳回和发布恢复 → 新会话复用；继续保持批量灌种暂停。

待用户决定的问题：无。
