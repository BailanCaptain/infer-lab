# 预算响应契约修复的在途独立检视

2026-11-17 00:45 UTC，砚砚。原 044 / 1116 同一工程短轮，当前生产 `scripts/wiki/drop-integration.ts` SHA-256 为 `573a8fb6a0b50652612d1ed39f6ee2edae30f3c507ca262a702667b5f864fdaf`。结论：**Changes Requested，0 P1 / 1 P2**；尚未收到最终交付，此记录用于当前作者定点收口，不新增任务或扩大范围。

## 已验证恢复的主路径

`1116-budget-contract-probe.mts 1116-root-budget-contract-current.json` exit 0。以原 174 次批次的两个隔离克隆实跑生产入口，零真实模型调用：新协商帧实际规则明确只接受 request；73,718 字节输入与 `budgetRequest.limit=100123` 一致，正确 request 后进入 40,351 字节普通原文帧（上限 100826）。原提前结论仍拒绝，新的实际调用 hash 未生成合法缓存；原 174 次记录、所有旧回执、原批次与原目录逐文件摘要保持不变。

`tsc -b tsconfig.json --noEmit --pretty false` exit 0；两个改动文件只读 Biome 检查与依赖方向检查 exit 0。

## P2：v3 的旧合法协商 request 缓存遗漏兼容

位置：`scripts/wiki/drop-integration.ts:2187`、`:2245`。两处旧协商缓存选择均限制在 `this.protocol === 4`，而 `buildNegotiate` 已为 v3 同样切换至新增强制协商规则并扣除其字节。结果是旧 v3 协商帧的 rules、limit 和 hash 变化，现存合法 request 响应不再复用，续跑会再次执行模型调用。普通 v3 帧不受影响，因此现有“前两次调用缓存复用”用例不能覆盖这条路径。

独立反例：`1116-v3-budget-cache-probe.mts 1116-v3-budget-cache-current.json` exit 1。该探针在临时副本导出真实 `DropSession.exchange`，控制组只还原 pre-1108 v3 的规则文本及对应预算，不修改任何生产文件；先缓存普通帧、合法 budget request 帧、后续原文帧，再以当前实现续跑。普通两帧全部命中，唯独预算协商帧重新进入执行回调：旧上限 22635、新上限 21932，`allLegacyFramesReused=false`。原始资料和真实模型均未触碰。这是确定性工程反例，不冒充真实模型语义验收。

修复应沿现有缓存选择入口覆盖 v3：仅在旧响应通过当前协商 schema 时复用旧规则与旧帧；没有有效缓存时仍发送修正后的规则并使用最终规则预算。保留旧矛盾非 request 响应拒绝、v4 主路径和 discover 合法封存收敛，不增加 newAttempt、不删除旧缓存。补 v3 合法协商帧的可复现兼容测试。

## 尚需核实的测试失败

`1116-root-budget-regression.log`：6 文件，53 passed / 1 failed，exit 1，133.14 秒。唯一失败在新增 `drop-convergence.test.ts:1406`：捕获到的 `discoverSealedBudgetRules` 含强制协商文本。需检查该测试捕获时实际已读区间及暂存状态，区分真正的生产分支问题与夹具尚未完成全文读取；不能删除合法收敛断言或用空字符串未捕获值制造通过。其余 53 项通过，不重复泛化为额外缺陷。

全部证据位于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。真实批次继续保持 174 次，修复独立通过前不恢复真实调用。
