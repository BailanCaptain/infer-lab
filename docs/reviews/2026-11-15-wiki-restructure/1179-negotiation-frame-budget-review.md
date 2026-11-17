# 1179 真实补读协商帧预算独立检视

结论：**Changes Requested，0 P1 / 1 P2**。真实四类样本全流程在原 generation 1 的第 312 次后停下；`1171-edit-output-recovery-final-review.md` 的定点编辑恢复已实际生效，未回退。本项是补读请求的协商帧无法装入预算，与第 260 次坏编辑修复不是同一失败。

## P2：必需原文可装入，但协商元信息令协商本身超限，且没有可执行建议

位置：`scripts/wiki/drop-integration.ts:2062` 的 `buildNegotiate`、`:2176` 的协商余量估算、`:2227` 的建议补读切片估算、`:2537` 的最终帧门禁。审阅字节 `9d8c03feba93b32b589fbbafe8d7e654d82c37f87a3c85239bf0e518a1554ee0`，`drop-run.ts=651bcf70…` 未改。

真实隔离批次 `3895c20b-11be-4200-8292-540668d0bef1` 从 271 次续跑后，坏编辑已由真实模型纠正，完成 contribution 1 并进入 contribution 2。第 312 次阶段为 `整合：chunked-prefill:2:7936`，绑定候选 `883b7951…` 的 `[7936,8318)`。模型返回合法的补读请求：该候选 `[8318,16000)` 与当前 raw 来源 `[9500,10896)`。宿主尚未向模型发送协商帧就报错：

`上下文预算不足：整合：chunked-prefill:2:7936 输入 26927 > 25721 字节，必要证据仍超量，保留未完成范围`

根因证据是完整序列化帧预算，而不是 raw 证据不可拆解：

- 当前协商帧总计 **26,927B**，该实际协商协议预算 **25,721B**；普通协议预算为 **26,424B**，不能混用。
- 去掉仅用于协商的 `navigation.budgetRequest` 后，原框架数据、完整 notes 与全部必需 materials 为 **25,271B**；必需原文仍装得下。
- notes **5,464B**、materials **11,692B** 原样保留；材料目录已分页为空（`inventory=[]`、`inventoryNext=0`），不能再仅重复目录空化。
- `budgetRequest` 自身 **1,639B**：其中 `requested` **1,100B**，包含重复资源身份及两组各八项的极小 `firstChunks`；`suggestedBatch=[]`、`availableExtraBytes=0`，没有可验证下一帧能执行的建议。`tryFitSlice` 以协商协议的余量/安全边距估算普通证据帧，需与下一帧实际使用的协议预算统一核算。

同代普通重试读取第 312 次合法 request 缓存后再次在相同位置终止；增加模型重试次数或提高预算都不能解释并修复这个协议问题。

## 实际证据

所有产物位于 `%TEMP%/infra-wiki-review-20261115`：

- `1174-real-integration-resume-295.json/log`：原同代真实调用从 271 到 295，按显式观察限额退出；旧缓存/正式资料不变。
- `1177-real-integration-resume-319.json/log` 与 `1000-framework-e2e-tTeaWJ/1162-integration-checkpoint-319.json`：真实运行在 **312** 次因上述预算错误退出 1，未到 319 限额。`originalUnchanged=true`、`existingCacheAndReceiptsUnchanged=true`，没有 Review。
- 第 312 次持久输入 hash `4761f442a185047894e280c03355e7d44c4d22282e9ca9f8bd358bff0a7851b0`，call key `4a250acf-fdea-4f04-8757-40a5b4d582fb`。输出为合法 `request.materials`，不是错误 edits 或早熟结论。
- `1179-budget-negotiation-probe.mts 1179-negotiation-red.json`，`1179-negotiation-red-command.json` **exit 1**：完整克隆 312 次批次，使用零模型 runner。仅观察并原样返回 `JSON.stringify` 字节，不改任何生产文件或预算门禁。捕获上述实际帧及各字段体积；`observations=[]`，尚未到 runner 即失败。旧 312 条调用、克隆旧缓存、原树、generation 1 全部未变。

## 本轮要求与后续顺序

在实际使用的协议预算内，统一构造可发送的协商帧，并给出至少一个经下一正常证据帧序列化验证确实可装入的补读建议；保留请求身份、未完成范围和明确的“尚未提供，不能给结论”约束。可对可恢复的导航/协商元信息分页或去重，不删完整规则、notes、必需 raw/候选原文，不改用户预算，不把已读摘要冒充本轮证据，也不再堆叠与真实序列化路径不一致的估算退路。

保留第 312 次合法 request 缓存及所有前序记录，修复后真实 312 克隆必须零重跑命中前序缓存，首个新帧为当前协商，下一帧按建议装入原文且不再协商；使用实际协议校验每帧预算。无真实模型的探针不能代替修复后的真实续跑。

按原作者分工，先完成正在执行的 AST 三项返修短轮并持久交付，再以原 044 的下一独立短轮关闭本项，隔离 apply 随后继续。当前原真实批次停在 312，不盲重试、不换代、不修改文章。阶段一仍未签署，969/993/996 停工及内容后置边界保持。
