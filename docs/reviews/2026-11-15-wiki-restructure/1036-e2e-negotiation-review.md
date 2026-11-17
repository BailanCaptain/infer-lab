# 四类真实样本整合：预算协商指令矛盾

2026-11-16 20:36 UTC，砚砚独立检视。第一阶段工程验收发现 **1 项 P2**；尚未形成整组 Review，不宣称全流程通过。

## 实际失败与影响

隔离根 `1000-framework-e2e-tTeaWJ`，批次 `3895c20b-11be-4200-8292-540668d0bef1`，generation 1。真实生产 `startDrop` 完成 151 次 Codex 调用后，于 20:31:24 UTC 返回 `上下文预算协商未完成：请求原文尚未提供，不能直接给出结论`。这是协议错误，区别于前面有意设置的限量检查点退出。四份材料的发现/覆盖步骤已完成，失败发生在 chunked-prefill 的比较复核任务 `comparison:568b1b80485de060750d6e4cd954ee3889bf44b38bdd04e7841b74b08a553e52`。

`1000-integration-checkpoint-160.json` 实测 `originalUnchanged=true`、`existingCacheUnchanged=true`；正式库与前序缓存未改变。全部原始输入、输出和失败回执保留，未删缓存、重开 generation、放宽门禁或重新付费试跑。

## P2：提示允许结论，执行器无条件拒绝

位置：`scripts/wiki/drop-integration.ts:1993` 的 `buildNegotiate` 提示生成，以及 `:2195` 的结果处理。

末轮缓存 `0284ae0e044c59168425ae57cec94715d7a91efb45ab2aa888aa029c4ccaf30a.input.json`：

- 请求候选原文范围 `[6029,24775)`，此前本任务确实完整提供过；当前轮只有必要的候选首段与旧页相关段。
- `budgetRequest.limit=100826`、`availableExtraBytes=22396`、`suggestedBatch=[]`，所请求项 `uninspectedRanges=[]`。
- 宿主 instruction 明确要求“所请求范围在本阶段前序轮次已全部提供核验……请依据已核实的 discoveryProgress 与当前必读原文作答”。但本任务是 `drop-check`，没有 discovery 的暂存结论契约，通用 check 规则也明确历史摘要不能替代本轮原文。
- 模型随后返回合法 `checkedSchema` 结果，附带未核共享图/场景/源码的限制；执行器因 `negotiate === true` 无条件抛错。没有执行验收结论的正常出口。

只重试会再次命中已缓存的同一输入/结论，不能解决提示与状态机契约的矛盾。仅关闭 guard 或信任前轮“已读”也不合格：必须保留独立复核所需的当前原文和预算约束。

## 修复与复验要求

由原代码作者在目录短批收口后处理；不与当前作者并行修改生产文件。统一预算协商的提示、请求形状与状态迁移，区分 discovery 暂存语义和独立 check 的证据要求；使重新请求精确可容纳范围有可执行出口，避免一边要求答结论一边拒绝。保留 fail-closed 原文门禁，不能将缺证据检查记为通过。

以此封存帧/输出建立确定性红灯复现，并覆盖已读范围再次请求、未读范围协商、独立 check 与 discovery 的相关分支。既有 210 次封存调用与本批前 151 次缓存均不删除/改写；修复后沿相同 batch/generation 恢复。任何 schema 或提示变更必须说明缓存兼容范围，独立复验后再执行后续真实调用。

完整紧凑证据：临时目录 `1036-e2e-negotiation-red.json`（七轮输入摘要与原结果）；原缓存位于隔离根 `wiki/_jobs/drops/runs/<batchId>/1/`。新问题属于工程验收，不涉及文章整改，后者继续留第二阶段。

20:38:37 UTC 独立执行 `1036-e2e-cache-replay.mts`：实际生产 `startDrop` 在相同 generation 上重放，禁止任何新模型调用；结果再次为同一协商错误，`calls=151`、`newAgentCalls=0`、`priorCallRecordsUnchanged=true`、`cacheUnchanged=true`。探针 exit 0 表示成功复现预期红例，不代表整合通过。证据另存 `1036-e2e-cache-replay-red.json`。

随后新增独立反例 `1038-root-negotiation-replay.mts`：复制整份隔离验收根到新的临时副本，接入只检查协议的确定性代理（不调用供应商）。旧代码在命中末轮缓存后失败，代理调用次数为 0，无法得到可执行的较小补读建议；`1038-root-negotiation-red.json` 记录 exit 1、原批次与原缓存均未改变。修复复验应在新副本/新报告中确认：此前合法缓存仍复用，矛盾帧不再阻断，给出的较小请求确实可装入下一帧，且不会把历史“已提供”当作本轮已核实的结论。
