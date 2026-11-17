# 同代重试的失败回执覆盖问题

2026-11-16 22:07 UTC，砚砚独立检视。结论：**Changes Requested，0 P1 / 1 P2**。这是 1047 修复后的真实续跑暴露的失败重试路径，不撤销已证明的 151 次协议恢复、合法缓存复用和早熟结论拒绝结果；第一阶段全流程尚未通过。

## 真实断点与根因

原四类样本隔离批次 `3895c20b-11be-4200-8292-540668d0bef1`、generation 1 从 151 次续跑至 160 次检查点，并完成两个此前未通过的 comparison 复核。第二短段在第 173 次调用停下，错误为“上下文预算协商未完成”。这次末帧 `f663060b0737a4849ba1f29308e48aab13fb2c18a5266a6f80491674b6d7fa07` 已正确给出可容纳的 `suggestedBatch`，明确禁止未完成协商时直接给结论；模型仍返回 `checked` 结果。门禁拒绝是正确的，不能将该模型结果当作检查通过。

但 `scripts/wiki/drop-run.ts:290` 附近按输入 hash 写 `.input.json`，`:316` 附近按同一 hash 写 `.output.json`。本次正确拒绝不生成 `<hash>.json` 合法缓存；再次执行正常 `retry:true` 会重新请求该输入，随后覆盖第一次失败的原始 `.output.json`。批次 `calls[]` 仍保留两次调用，首次调用的原响应却被第二次响应替换，破坏可追溯性，也违反本轮同代缓存/回执保留边界。

审阅生产字节：`drop-run.ts` SHA-256 `b9581134d95f3bfc83c93b7d94b11eacf3b6747df282f03a6e3cbc8bde39f491`；`drop-integration.ts` `43f77e1020e5956eca0a2fe6ecc034293930f638646f55231b166991ffe6a4d8`。

## 独立稳定复现

证据在 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`：

- `1058-real-resume-173-stop.json` 保存真实 152–173 次新帧摘要及模型原输出；`1047-integration-checkpoint-160.json` 与 `1047-integration-checkpoint-184.json` 在原隔离验收根内，均记录正式文件和已有缓存未变。
- `1058-failed-receipt-retry.mts 1058-failed-receipt-retry-red.json`：exit 1。在全新克隆 `1058-failed-retry-7FuMpv` 使用生产 `startDrop` 正常同代重试，仅将供应商替换为确定性协议代理；第一次未缓存输入与真实 `f663…` 完全一致，代理返回其 `suggestedBatch`，第 174 次检查点立即结束。
- 代理调用 1 次、供应商调用 0 次；原批次、原缓存及前 173 次调用记录均未变。克隆中唯一被改写的既有文件是 `f663…output.json`，SHA 从 `29165cb3ea93c07eb4eefdd6bdb639f4fee04b5b2f90934aa29c226d794c802a` 变为 `b4c472db23cdbf5ab45b6d434dab55a6ddf232a5f61cbcac010ba00dc060e8f2`，`failedOutputPreserved=false`。

## 修复要求与边界

同一输入的每次真实执行都应保留可对应调用记录的原始请求/响应；兼容现有 hash 缓存，既有文件不可覆盖。接受缓存仍只能由通过当轮 schema 的响应生成；失败结果不能冒充合法缓存。正常重试应能继续，不删缓存、不重开 generation、不放宽协商或原文门禁。若保持历史默认文件名，额外尝试使用明确且可追踪的独立回执身份即可，不需要重做整条管线。

先红后绿覆盖失败→成功重试、重复失败、有效缓存零重跑及旧回执字节不变，再用上述 173 次克隆回放独立复验。原真实批次先保留断点，修复通过前不再真实重试，避免覆盖失败证据。作者先完成当前 044 参数底层短段再用原 1038 正确绑定处理，不并行修改同一生产文件。

无文章整改、额外产品或 3D 范围；本轮待用户决定事项：无。
