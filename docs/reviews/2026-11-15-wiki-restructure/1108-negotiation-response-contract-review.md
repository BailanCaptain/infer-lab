# 真实预算协商的响应契约复审

2026-11-17 00:07 UTC，砚砚独立检视。结论：**Changes Requested，0 P1 / 1 P2**。回执保护已通过 1107，此处是同一真实隔离批次恢复后暴露的宿主协议缺口，不撤销 1047 已验证的可装入切片、缓存续接和拒绝早熟结论的结果。

## 实际断点

`3895c20b-11be-4200-8292-540668d0bef1` generation 1 正常同代重试，从 173 次到第 174 次仍在同一比较复核任务失败：`上下文预算协商未完成：请求原文尚未提供，不能直接给出结论`。第 174 次真实模型返回普通 `issues/contradictions/dependencies/report` 复核结果；其报告明确认为当前材料已足够核对九项比较引文，并限定没有核验未来写入。这不是可接受的协商响应，宿主拒绝正确，不能将其当作通过。

同一原 hash `f663…fa07` 的两次真实响应现分别保留；新回执键为 `9e9c94a6-938f-4865-8b95-8e7170ed570b`。旧失败响应 SHA 仍为 `29165cb3ea93c07eb4eefdd6bdb639f4fee04b5b2f90934aa29c226d794c802a`，未生成合法缓存，正式文件及旧回执全未变。`1079-integration-checkpoint-184.json` 记录本次退出 1；不再无诊断地重复相同请求。

## P2：实际发送的规则没有表达宿主当前只接受 request 的硬条件

- `scripts/wiki/drop-integration.ts:768` 的通用协议只说“需要补读时”返回 request，普通检查规则又明确要求返回 `issues/.../report`。它对 `navigation.rangeErrors` 有专门强制 request 规则，对 `budgetRequest` 没有。
- `:2076` 附近的预算说明只位于 JSON 数据 `navigation.budgetRequest.instruction`，并用“不得跳过未核原文”等条件措辞。系统规则首先声明材料是数据而非操作指令；当前 task 又只要求核对比较引文，模型因而可能认为当前必需材料已足够，选择普通结论分支。第 173、174 次真实响应均证明该失败路径实际发生。
- `:2310–2318` 的 `negotiateRequiresRequest` 对非 discover 协商帧**无条件只接受 request**，但实际发送的 `protocol` 不随这个门禁切换。`1108-real-budget-protocol-mismatch.json` 实读证明 `rulesMentionBudgetRequest=false`、`rulesMentionRangeErrors=true`。这是可修复的宿主响应契约不一致；不能只靠再试相同输入期待模型自行理解未写入规则的硬条件。

## 修复与验收要求

在同一真相源下，让实际发送给模型的响应要求与 `effectiveTurnSchema` 一致：当前是只允许协商 request 的回合时，应明确表达该状态及合法出口，即使模型认为现有必需材料足够，也不能直接交普通结论。保留现有 discover 已封存证据的合法收敛规则，不把所有 discover 协商一律改死。继续拒绝未按契约返回的响应，不人工伪造 request 或结论、不在验收 harness 注入代理冒充真实流程。

如规则文本变化，预算计算必须基于实际最终规则与序列化帧；不能重现 953 的预算误算。前序普通帧与有效历史 request 缓存必须同代复用，失败旧响应原字节保留。沿现有缓存选择机制处理兼容性，避免再堆叠多层兜底；不得删缓存或 newAttempt 重跑。

先在原 174 次隔离克隆验证：前 174 次调用与历史有效缓存不变，首个未缓存协商帧带清晰且与 schema 一致的响应要求；确定性失败响应仍拒绝，正确 request 能进入有原文的下一帧，全部输入落在实际预算内。通过独立检视后再恢复真实模型，不拿代理测试替代语义闭环。

证据：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1108-real-budget-protocol-mismatch.json`；生产 `drop-integration.ts` 为 `43f77e1020e5956eca0a2fe6ecc034293930f638646f55231b166991ffe6a4d8`。原作者先完成已派 1108 coverage 小批，再沿原活跃 044 单独处理本项，避免交错范围；不重开已关闭 1038。

无文章整改、额外产品或用户新增决策。

## 独立 174 次克隆反例（00:16 UTC）

`1113-budget-contract-probe.mts 1113-budget-contract-red-v2.json` 实际退出 1；两个隔离克隆均从原 174 次同代记录恢复，无真实 provider 调用。提前提交原模型结论的分支仍被预算门禁拒绝；按 `suggestedBatch` 提交 request 的分支进入实际包含全部建议切片的下一帧，输入分别为 73,718 / 41,122 字节，均小于 100,826 字节。全部原调用、旧文件、逐次回执及原隔离根完整性检查通过，唯一验收红灯是实际规则仍无 `budgetRequest` 响应约束。其具体措辞仍需人工检视，关键字探针不能代替语义审查。

此前 `1113-budget-contract-red.json` 是探针误用对象引用相等断言导致的工具自身失败，保留作调试记录，**不作生产缺陷证据**。改用深相等后的 `red-v2` 才是上述有效反例。修复后应另写 green 文件，不覆盖红灯。
