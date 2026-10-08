# 使用驱动的缺口信号记录验收

2026-09-15，`feat/llm-wiki`，HEAD `8175224` 的未提交工作区；实现位于 `infra-view-new-llm-wiki`。本轮没有新增模型调用或批量导入。

## 结论

问答现在能够留下持久的缺口观察：完整回答自述“未收录”，或模型发起联网工具调用时，程序记录问题、知识 revision、检索候选、原因和独立问答事件 ID。相同问题与上下文的重复观察会累计，同一事件重放不重复计数；默认三次后形成一条“待判定”记录。浏览器说明记录结果，维护者可用 `pnpm wiki:work list` 重读持久状态。

**这只是 F004 AC3 / T4 的信号捕捉与持久记录部分，不是自动补写完成。** 尚未接入预算内的结构化 `satisfied` 判定、缺知识 / 漏检 / 过期分类、worker、补写和复问关闭。`awaiting-assessment` 是账本派生的待判定视图，不是已领取预算的编译 job；代码不会因次数达标就断言缺知识或开始付费调用。整体仍为 0/4 feature 完整完成。

## 实现与证据边界

- `scripts/wiki/gap-ledger.ts` 是 `_gaps.json` 的 schema、事件去重和视图入口；复用 `WorkflowStore.locked` 与 `atomicText`。阈值由 `workflow-policy.ts` 定义，首次记录后保存在账本内，不能默默改阈值。读操作不创建文件、锁或任务；损坏账本会报错，不清空重建。
- 只修剪首尾空白，不折叠大小写、参数名、版本、否定词或标点。最近最多六个会话问题参与区分追问上下文；相同问题的重复不当成新的上下文。不同问法可能暂时分成多个记录，优先避免把不同问题误合并。上下文沿用会话层每题最多 8000 字的限制；不是语义聚类。
- `server/coverage.ts` 只抽取观察信号，不使用检索得分判定覆盖。自述未收录是模型说法；WebFetch / WebSearch 是**调用尝试**，没有声称访问成功或来源属于官方。每轮最多保留 20 次联网工具尝试；代码示例中的未收录字样不触发。`server/chat.ts` 保留同一 assistant 信封中的所有工具事件，避免第一个 Read 掩盖后面的 WebFetch。
- `server/chat-route.ts` 在完整成功、快照校验通过且连接仍在时记录，事件 ID 使用服务端 chat lease token；记录后才发送 `gap` 状态。重新发起 POST 是新问答事件，当前没有 HTTP 请求重放去重。进程在写入前退出、回答失败或连接中断时不承诺已记录。
- `ChatDrawer.tsx` 显示计数、待判定与保存失败；没有“自动补写已启动”的假提示。记录失败不撤销已返回的正文，也不会自动重问模型。原有有引用答案的保存与审阅流程继续工作。
- 运行状态必须与知识内容分开。`review-files.ts` 的 `isWikiStatePath` 同时供审阅内容指纹和整合副本复制使用，排除 `_jobs`、`_gaps.json` 及其原子写入临时文件；已有页和索引的知识 revision 不包含账本。账本中的原始问题不是编译材料，也不绕过未来补写所需的清洗与证据准备。

## 本轮处理的问题

| 级别 / 位置 | 影响与复现 | 处理 |
|---|---|---|
| P1 · `scripts/wiki/review-files.ts` | 创建待审包后写入 `_gaps.json`，原先批准时报基础内容已变化；问答活动会阻塞无关知识发布 | 运行状态排除规则由审阅与整合共用；先红后绿用例确认账本不会使已有批准失败，也不被发布覆盖。 |
| P2 · `server/chat.ts` | 同一消息依次含 Read 和 WebFetch，原先只发出 Read 事件，遗漏联网信号 | 新的事件数组解析保留所有工具；单事件解析保留兼容入口。稳定复现先失败后通过。 |
| P2 · 缺口记录失败反馈 | 不能把内存里出现过信号说成已持久记录，或因账本损坏丢掉回答 | 真实 HTTP 测试确认坏账本保留原字节、返回 `record-failed` 状态，同时保留问答结束帧。 |

## 实际验证

- 首轮 `pnpm exec vitest run scripts/wiki/gap-ledger.test.ts server/chat-route.test.ts scripts/wiki/review.test.ts`：新模块尚不存在的两套测试无法加载，审阅状态隔离回归 **1 failed / 13 passed**；[原始日志](../../../tools/wiki-runtime/gap-ledger-red.log)。模块实现后同一命令 **28 passed**，没有将导入失败冒充多个已复现的行为缺陷。
- 多工具信封红例：`pnpm exec vitest run server/chat-run.test.ts -t 'retains a web'`，遗漏第二个调用而失败；[日志](../../../tools/wiki-runtime/gap-tools-red.log)。后续相关八套测试 **58 passed**，包含工具事件、事件去重、并发累计、上下文与版本区分、未判明状态、CLI 只读和整合上下文隔离；[日志](../../../tools/wiki-runtime/gap-focused.log)。
- `pnpm check`：**65 files / 543 tests passed**，类型检查、Lint、依赖方向、19 页内容检查和 wiki lint 通过；[日志](../../../tools/wiki-runtime/gap-check.log)。
- `pnpm build`：exit 0，**built in 3.81s**；[日志](../../../tools/wiki-runtime/gap-build.log)。
- `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium`：**28 passed (45.2s)**；生产预览 4173。新用例通过实际 HTTP 快照 / 会话 / SSE / 文件账本连续提问三次，确认只有一条记录、计数为 3、状态仍未判明、编译调用为 0、正式页仍为 1（fixture）；[日志](../../../tools/wiki-runtime/gap-browser.log)、[已目视复核的截图](../../../test-results/wiki-review-three-uncovere-98306-ssessment-without-compiling-chromium/gap-awaiting-assessment.png)。模型响应为固定输出，不冒充真实模型覆盖判定；原保存、批准、驳回与阅读测试仍通过。
- `pnpm wiki:work list`：真实工作区输出 `{"gaps":[],"worker":"not-enabled"}`；没有向正式账本灌入测试提问。所有计数、坏文件和发布交互均在隔离 fixture 中验证。

真实模型能否稳定表达结构化覆盖判定、成功访问官方来源、正确分类已有页漏检、生成有证据的补写、发布后通过复问关闭缺口：**尚未验证 / 尚未实施**。既有真实问答的语义失败仍见 [真实积累验收](knowledge-loop-review.md)，不因本轮工程测试通过而关闭。

本轮新增模型费用 **0 美元**；此前四个付费轮次保持关闭，累计仍按已知 5.9398455 + 中断预留 0.50 = **6.4398455 美元**记账。现有 Vite 未来 native loader 警告仍保留。运行日志和截图在忽略目录，需作为本地验收材料保留。

下一步：按 F004 T4 接入显式预算的覆盖判定与分类，再让需要补写的记录寻找证据、进入共用编译和审阅流程；已存在的知识优先处理漏检或版本问题。待用户决定：无。
