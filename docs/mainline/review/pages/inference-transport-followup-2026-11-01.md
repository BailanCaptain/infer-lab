# 传输中断追查与新多轮案例

2026-11-01。本轮承接[容器内存批次](inference-container-memory-2026-11-01.md)留下的两次中断。第一处有日志、持久化结果和隔离复现共同支持：修改配置依赖使 Vite 重启，切断正在经过它的回答流。第二处旧记录丢失了底层错误原因，仍不能唯一还原触发原因；没有把相邻的构建刷新写成已确认根因。

已修复预览构建产物被开发服务监听、被样式工具重新扫描的问题，并补齐本批运行器的传输留证。三条未测过的合成多轮案例共九轮，经真实站内接口完整运行：能根据新证据转向、在满足条件时停止，也能在延迟和质量通过但 CPU 超预算时拒绝验收。没有修改或新增教学页、图、回答提示词或评分规则。

## 两次旧中断分别查到了什么

| 旧尝试 | 实际证据 | 结论 |
|---|---|---|
| C2-loaded 第 1 轮 | 客户端在 09:07:53.668Z 已收到 HTTP 200 和回答，随后 `TypeError: terminated`；Vite 同秒记录 sources.ts 变更触发重启，约两秒后重启完成；后端同一会话在 09:07:54.705Z 保存完整回答 | 强证据支持配置依赖重启切断代理流，不能用后来保存的回答把这次传输改算通过 |
| C3-staged-loaded 第 3 轮 | 09:15:39.742Z 开始，19.943 秒后 `TypeError: fetch failed`，没有 HTTP 状态或 SSE；会话文件仍是此前第二轮，未留下第三轮处理记录 | 失败发生在收到响应之前；缺少 cause、错误码和连接事件，无法区分连接建立、代理转发等具体位置，也不支持归因模型生成超时 |

旧运行器的主动超时是 660 秒，不能把约 20 秒直接说成它主动取消。C3 调用者是 Node fetch，没有浏览器 HMR 客户端，因此“浏览器收到刷新消息主动取消”也不能直接解释这次失败。

第一处的实际导入链是 Vite 配置 → reader 插件 → snapshot → 审阅／校验模块 → sources.ts。安装的 Vite 8.2.2 会在配置依赖变化时关闭原服务并重新监听，关闭过程销毁原连接。隔离实验中，直连、代理不改文件、普通源码变更、重启后请求均收到 30 条数据和 done；配置依赖变更时只收到 3 条，没有 done，上游仍完成。隔离异常形式是提前 EOF，与旧记录的 terminated 文本不同，只将它作为截断机制的复现。

C3 前两分钟的日志有 318 行相关刷新：49 行显式涉及 preview-dist，269 行是 tokens.css 更新。这是调查线索，不是具体故障的因果证明。独立复核、时间线、安装源码位置与完整隔离过程见[传输调查](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/private/transport-review.md)。旧 receipt、SSE 和失败结果均保留。

## 改了哪里，为什么只改这些

Vite 默认排除配置的 build.outDir；这里是 dist，另一套 preview-dist 不会因此自动排除。Tailwind 默认扫描源文本，并尊重 Git 忽略规则。产物被当作输入，会产生无用扫描、刷新，并让生成物里的工具类反过来进入 CSS。[Vite 监听说明](https://vite.dev/config/server-options#server-watch)、[Tailwind 扫描说明](https://tailwindcss.com/docs/detecting-classes-in-source-files)

只改两处：

- [.gitignore](../../../../.gitignore) 增加根目录 `/preview-dist/`，让生成产物退出自动样式扫描。
- [vite.config.ts](../../../../vite.config.ts) 在现有 watch ignored 中增加 `**/preview-dist/**`。代理目标、Host 传递和原有排除不变；不重构 reader 插件，也不另加重复的 CSS 排除规则。

隔离红／绿对照使用相同的 300 个约 10KB JS 和一个 HTML 写入：未排除时出现 442 次监听事件、两条 full-reload 广播，产物独有样式进入 CSS；排除后对应结果为零，产物独有样式未进入 CSS。写入期间代理探针最大耗时从 548.6ms 变为 6.6ms，两组 SSE 都完整。它证明这项多余工作可以消除，**没有复现历史 C3 的 20 秒失败，也不能证明 C3 已根治**。第一次脚本因过度限定异常文本失败，原结果另外保留，没有用正常 EOF 冒充完整流。

新批继续复用已有 run-chain.ts，仅增加连接／发出请求／收到响应头／收到字节／结束的时间线，以及递归 error cause 和错误码；不记录认证头。仍要求真正收到 done、保存完整回答，提前 EOF 也不能通过。参见[运行器](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/run-chain.ts)与[传输汇总](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/transport-summary.json)。

配置依赖变化引起开发服务重启本身是预期行为。本批先完成配置修改、重载与准备，再发送多轮题，运行期间不再改这些依赖；没有用自动重试掩盖断流。

## 三条新案例怎样表现

独立设计者核对前批题目、阅读相关原页，先冻结[问题与私有判据](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/private/freeze.json)。三条题依次提交现象、定位证据、复验结果；产品请求只含当轮 message 和后续 sessionId，不提供指定页、未来日志或评分答案。调用的是现有 `http://127.0.0.1:5173/api/wiki/chat`，没有改为另一个回答链路。

| 案例 | 新证据后的转向 | 第三轮结果与停止判断 |
|---|---|---|
| D1：回答快结束，网页报连接中断 | 完整流已到浏览器，离线重放仍出错；转向客户端误读合法的空 choices 用量片段，停止无依据地调代理超时 | 成功率 99.9%，首段达标率 97.0%／96.6%／96.8%，质量、客户端 CPU 和每卡内存都合格；明确可以收束，并保留每轮一条真实失败，不要求错误率归零。[末轮原答](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/runs/D1-loaded/turn-3/answer.md) |
| D2：输出 token/s 翻倍，用户反而变慢 | 请求数相同但新客户端 n=4，只展示一份，其余三份仍生成；转查额外工作与排队，按业务统一 n=1 做最小对照 | 成功率、质量、96.4%／96.8%／96.1% 的首段比例及显存通过；CPU 峰值 80%／82%／81% 高于原定 75%，拒绝整体验收，下一步只拆主机进程和工作归属。[末轮原答](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/runs/D2-loaded/turn-3/answer.md) |
| D3：点停止后后台还在生成 | 证据显示代理仍读上游、服务未收到取消；转向取消传递，不把仍活动的请求当成已证明的缓存泄漏 | 60 条取消样本在 0.12–0.26 秒内停止并归还独占引用；正常请求另计，成功率、质量、首段比例和显存均通过；认可收束，不要求权重和缓存池驻留归零。[末轮原答](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/runs/D3-loaded/turn-3/answer.md) |

知识库的帮助能追到当次材料：D1 使用原流式页区分正文、用量、结束和错误；D2 使用原测量页区分总生成量与业务合格交付，并继承 CPU 约束；D3 使用原收尾页区分停止显示、服务中止、引用归还与池驻留。各首轮只采当前可分流的记录，进入修改／验收后再展开原目标。本批没有发现需要靠新增教学内容解决的遗漏。

自动审阅九轮均为 covered；逐答独立语义复核另存[答卷审查](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/private/answer-review.md)，不以自动状态代替“读者能够照做”的判断。没有同步无库组，不声称这批测出了因果增益。

## 验证与尚未解决的边界

- **真实问答**：9 次请求尝试、9 次完整，零重试、零中断。三条链内部同一会话，九轮同一知识版本、无 reset，历史 1→2→3。34 条审阅引文逐字存在，九次保存完整回答，六次追问审阅输入包含此前实际回答；冻结材料哈希未变。见[调用清单](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/call-inventory.json)和[一致性校验](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/evidence-integrity.json)。请求模型为 Codex provider 的 gpt-6.1-sol，不以配置名独立证明服务端模型身份。
- **传输记录**：逐次响应头、字节计数与 SSE 文件一致，均收到 done，未出现底层错误。按探针开始时间分组：开始于九轮时间窗内的 64 次健康探针均返回 200，最大耗时 3276ms；开始于首个模型请求之前的 14 次中，九次返回 200、四次达到自设的 6 秒超时、一次在重载期间报 ECONNREFUSED。这四次超时中有两次跨过首个模型请求开始时刻，不能说所有等待都在正式调用前结束。健康探针包含知识快照读取，不能当成纯 TCP 检测；探针错误不混计成模型 SSE 中断，也不能由九轮完整推出今后不会断流。
- **代码与构建**：`pnpm exec vitest run src/app/wiki/chat-history.test.ts server/chat-session.test.ts server/chat-route.test.ts` 的 35 项测试通过；定向 Biome 检查、`pnpm build`（含 TypeScript 检查）通过。记录为[测试](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/tests.log)、[配置 Lint](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/config-lint.log)、[构建](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/build.log)。隔离脚本语法、断流／产物对照及资源退出检查另在传输调查中保存。
- **浏览器**：实际打开阅读指南，另用同一真实前端拦截一条缺少 done 的测试流。已有界面保留部分正文、提示回答中断，把未完成审阅标为 unavailable，并清除续答会话；无需再改 UI。此项是界面故障演练，不计入九次模型回答。见[记录与截图](../../../../tools/wiki-runtime/inference-transport-followup-2026-11-01/browser/check.json)。

**未解决项是旧 C3 的具体触发原因。** 原记录缺少底层 cause，隔离复现没有重现连接失败；新批已补留证，但不能补造过去发生的 socket 事实。此项继续保持待核，不标为“已修复”。本次其余已确认的监听／扫描问题已处理，独立审查无遗留 P1/P2。真人试读、真实设备和正式十二题有库／无库对照仍按[原验收方案](../../../superpowers/plans/2026-10-31-inference-user-field-acceptance.md)等待实际证据，没有需要用户再决定的页面归属问题。
