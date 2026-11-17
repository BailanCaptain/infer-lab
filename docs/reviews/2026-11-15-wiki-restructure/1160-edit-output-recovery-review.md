# 1160 真实编辑输出校验与同代恢复

结论：**Changes Requested，0 P1 / 1 P2**。这是四类真实全流程新发现的输出恢复问题；`1158-edit-granularity-final-review.md` 的分片预算与历史缓存续接结论保持有效。阶段一尚未通过。

## P2：错误编辑延迟到整页合并才发现，无法定点修复，普通同代重试永久命中坏结果

位置：`scripts/wiki/drop-integration.ts:3824–3838`、`scripts/wiki/drop-run.ts:406–425`、`scripts/wiki/drop-context.ts:182–212`。

真实隔离批次 `3895c20b-11be-4200-8292-540668d0bef1` 在新分片策略下完成第 259–271 次调用，首个贡献完整覆盖后抛出 `局部修订原文不匹配`。逐份回执与绑定材料核验确认，唯一坏编辑来自第 **260** 次、阶段 `整合：chunked-prefill:0:3792`，绑定 `[3792,5212)`，编辑 `[4294,4327)` 声称原文为 `updated: 2026-11-03T00:00:00.000Z`，实际该位置是 `rawSources` 的另一段文字。范围本身合法，但 `old` 与对应原文不相等。其余 29 个编辑帧分别应用均不报错。

当前循环仅就地检查范围越界，原文/重叠/Unicode 边界等验证直到收集全贡献的编辑后才由 `applyDropEdits` 执行。因此无效输出已写入缓存，随后还执行了 11 个编辑调用；报错时 `lastStage` 已指向末片。该错误文字也不在已有自动修复分类中。普通 `retry:true` 重新命中全部缓存，再次同样失败，既没有定点反馈，也没有新的可执行修复帧。仅把此错误加入末片的重试正则不能解决根因，会修错阶段。

## 证据与复现

目录：`%TEMP%/infra-wiki-review-20261115`。

- `1159-real-integration-resume-282.json/log`：真实生产 `startDrop`、默认验证、同一 generation 1，退出 1，271 次时因上述错误停下；不是调用限额。`1000-framework-e2e-tTeaWJ/1151-integration-checkpoint-282.json` 记录正式资料和原回执/缓存均未改变。
- `1160-edit-mismatch-inspect.mts` → `1160-edit-mismatch-inspection.json`：只读逐个核对 30 份原始输入/输出及候选 hash，精确定位第 260 次唯一不匹配。
- `1160-edit-repair-clone-probe.mts 1160-edit-repair-red.json`，`1160-edit-repair-red-command.json` 退出 1：克隆完整 271 次批次，使用受控零模型 runner 再调用 `startDrop(...,{retry:true})`；`observations=[]`，仍为原文不匹配，未进入任何可修复帧。271 份调用、全部不可变缓存、原批次、generation 均保持。

## 要求

把候选 hash、原文匹配、合法 UTF-16 边界及编辑互不重叠等已有真实约束，收敛到对应编辑片段刚返回时的共同校验入口；失败应归到该片段并复用现有有界修复机制。不得自动挪动模型偏移、丢弃错误编辑、改写旧缓存、重开 generation 或要求人工修改文章正文来绕过。原 271 次回执保留；只针对坏片生成带明确失败理由的修复输入，其余已成功阶段继续复用。整体编辑集合仍须有最终一致性检查。

验收至少含真实 271 克隆的定点修复与继续到下一贡献、保持相同规则/notes/必需原文/预算、缓存与正式资料保护，以及原文不匹配/重叠/代理对/合法编辑的正反例。克隆的空编辑只证明恢复协议，修复通过后仍须继续真实模型全流程。

按原分工，烁烁先交回当前 AST 只读计划短段，再以原 044 下一短轮处理本项；砚砚独立复验。文章整改、3D、旧 Review 和站点服务边界不变。

## 04:26 UTC 在盘返修复验（尚未签署）

生产端已提取 `drop-context.ts:184` 的共用 `validateDropEdits`，在 `drop-integration.ts:3836` 对累计编辑即时检查，并在最终 `applyDropEdits` 再验。root `1168-root-edit-repair.json` 的真实 271 克隆 **8/8 通过，exit 0**：首个修复帧仍为 `[3792,5212)`，包含具体失败位置与原坏输出，24,167B ≤ 26,424B，原 rules/notes/materials 不变，随后进入 contribution 1；271 次旧记录、缓存、原批次与代次均保留。仅受控协议探针，零真实模型调用。

root 类型、Biome、依赖检查通过；相邻 `drop-integration` / `drop-receipt` / `server/drop` 共 37 项通过，原定向三套另有 23 项通过。当前新增 1160 测试仍在 `drop-convergence.test.ts:2486` 因 `补充修订不能删改旧正文` 失败；`1168-root-edit-tests.log` 与更新夹具后的 `1169-edit-target-test.log` 均保留。该夹具的成功分支仍在 `start + 2` 向旧行内部插入文字，和它声明的 `revision.kind = supplement` 及 `revisions.ts:75` 的逐行保留契约冲突。需要保留所有恢复断言，构造符合所声明修订类型的合法成功输出，不放宽正文保护或删断言。测试收口前不批准真实续跑；已审微分片和 AST 的独立状态不受此进度更新影响。
