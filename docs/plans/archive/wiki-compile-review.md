# 受限材料编译验收（2026-09-15）

本轮在 `infra-view-new-llm-wiki` 工作树继续 T2。没有批量导入、真实付费编译或合入主干；保留前轮修改。当前状态仍以 [F004](../../features/F004-knowledge-loop.md#design-decisions) 为准。

## 本轮交付

**清洗已接入可执行的单材料 CLI，并在调用前持久记录结果。** 已归档 raw → 清洗选定行 → 受限文本编译 → schema / 来源 / lint 校验 → 草稿与 receipt。这一段复用已有任务、预算、重试及整合入口核对，没有另建一套工作队列。

`wiki:compile` 是维护命令，只处理一个已归档来源，不接收新文件或目录，也不自动整合。它不是尚未交付的聊天保存按钮或 `wiki:drop`；原文必须先经上游入口归档。`--origin` 保存维护者声明的入口，不能据此认定对应产品流程已经存在。

| 内容 | 实现与证据 |
|---|---|
| 单材料编译入口 | `scripts/wiki-compile.ts`、`scripts/wiki/compile-raw.ts:33`。CLI fixture 验 dry-run 无任务目录、只显示清洗数据；缺预算非零退出、不创建任务 |
| 持久清洗记录 | `scripts/wiki/screening.ts:5`、`scripts/wiki/workflow.ts:140`。来源 hash、清洗版本、结果 hash、阻塞状态和原因保存于 job.screening；在 mock agent 开始时重新读取磁盘即可看到。不存清除的原文片段 |
| 阻塞不启动 agent | `scripts/wiki/compile-raw.ts:74`。真实临时 CLI fixture 输出失败，任务 state=blocked、attempts=[]；即使带 retry 也不能领取。没有把阻塞算成一次付费失败 |
| 固定受限配置 | `scripts/wiki/restricted-claude.ts:5`、`:28`。无工具、空 MCP、safe-mode、无会话持久化、无自定义设置来源；使用临时空目录。配置额外加入 add-dir 或只能 shell 回退时，transport 调用次数为零 |
| 严格结果处理 | 同文件 runner 测试验证唯一成功文本；缺 result、重复 result、错误 result、tool_use、异常 content 和超大输出均拒绝。不把进程 exit 0 独自算成成功 |
| 草稿校验与保护 | `scripts/wiki/compile-raw.ts:90` 起。只允许引用给定来源，rawSources 由引擎绑定；原文 hash 或草稿在运行中变化时拒绝写回。正式页面不变，成功草稿可通过 verifyDrafts 核对 |
| 费用与显式重试 | 共用 `WorkflowStore.claim/finish`；重开 store 后未知费用仍各占一次预留。未指定 retry 不运行，达到次数上限不再调用；测试实际调用总数为 2 |

规则只维护在 [HANDBOOK](../../../wiki/HANDBOOK.md) 的页面格式及人类须知；CLI 与其他未来调用方读取同一份。运行配置只有 restrictedArgs 一份，runner 对完整参数核对，防止调用方悄悄加权限。工作 ID 包含来源、清洗及编译配置，入口标签不参与知识去重。

## 验证结果

- 先运行新增 compile-raw 测试，因模块尚未实现报错；未把“no tests”算作通过。
- `pnpm test scripts/wiki/compile-raw.test.ts scripts/wiki/restricted-claude.test.ts scripts/wiki/compile-cli.test.ts`：初次定向 3 文件、16 项通过；随后补充未知费用重试用例，由最终全量覆盖。
- `pnpm check`：exit 0，**48 文件、448 项测试通过**；typecheck、代码 lint、依赖、19 页内容及 wiki lint 通过。既有 1 warning / 2 infos 保留；尚无章节，Term 引用检查跳过。
- `pnpm build`：exit 0，`built in 3.77s`。
- 本机实际 `claude --help` 确认支持 safe-mode、空 tools、strict-mcp-config、no-session-persistence、setting-sources 和 max-budget-usd。仅查帮助，没有执行真实编译；参数存在不等于真实调用效果已验证。
- `pnpm wiki:compile --help`：exit 0，展示单份归档来源、预算、dry-run 和 retry 用法。
- `pnpm wiki:jobs list` 输出 `[]`；真实库没有新任务。`git diff --exit-code -- wiki/raw`、`git diff --check` 均 exit 0。

本轮不涉及前端交互，没有重新跑浏览器；上一轮 19 项 Chromium 通过属于历史证据。本轮 source/raw 语义没有重新人工验收。

## 调用方式

以下为调用示意，没有对真实库执行编译。source 使用已经存在的快照与真实行号；origin 按实际生产入口填写。

```powershell
pnpm wiki:compile --id <目标id> --source "raw:sha256-<hash>.md#L1-L20" --origin chat --dry-run
pnpm wiki:compile --id <目标id> --source "raw:sha256-<hash>.md#L1-L20" --origin chat --job-budget-usd <累计额度> --attempt-budget-usd <单次额度> --max-attempts <次数>
# 对同一失败任务显式重试，预算参数必须保持一致
# 在上述实际运行命令末尾加 --retry-failed
```

## 剩余工作与取舍

1. **真实 agent 调用尚未验证。** 本轮验证了实际代码、CLI 预检 / 阻塞链路、模拟 transport 与结果处理；没有声称模型事实正确或运行环境已构成 OS 沙箱。受限配置依赖本机 CLI 的支持，旧版本或不兼容配置应失败而非降级。
2. **清洗仍是已知规则检测。** 新语义混淆和跨次链式材料尚无完整隔离验收；blocked 不能自动解除。目前 CLI 不代替 drop / quarantine，AC1 / AC2 保持未完成。
3. **只产生草稿。** 完整待审 manifest / diff、批准 / 驳回、跨页发布恢复与新会话复用仍待 T3–T6；已有显式整合命令的行为未在本轮改为完整人审流程。
4. **入口记录与页面标记分开。** job.origins 已持久记录；页面 origin 默认值与读者角标仍待 AC5。来源证据等级不由入口决定。
5. **下一步**进入 T3 的待审变更 manifest / diff 与发布恢复，再由聊天保存入口调用同一编译器。不会为 chat 再造一条直接写正式页的路径。

待用户决定的问题：无。
