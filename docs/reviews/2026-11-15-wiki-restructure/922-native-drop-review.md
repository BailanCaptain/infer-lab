# 045 原生 SVG Drop 第 2 轮：独立代码检视

结论：**Changes Requested，0 P1 / 2 P2**。三路输入类型、校验后暂存、正常整组 Review 与中断恢复已经接通；但真实模型指令仍禁止新通道，共享资产复核仍缺少原生 SVG 内容，不能据当前协议夹具通过即批准整批。

来源：`0001794846388016-000922-4865cd81`；承接 `0001794844785707-000916-9f293eaa`。检视者：砚砚 / gpt-6-astra。2026-11-16 16:30 UTC；工作区 HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`。root 未修改作者生产实现。

## 实物与已通过证据

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-assets.ts` | `c5a2029e6aa0acffb5505d352a7c1573c04185a1897c6aa06479127be276a015` |
| `scripts/wiki/drop-integration.ts` | `552a7e3dc1834db5722fbd56c4ddca7b287158b6003b7dbce102952cd4164088` |
| `scripts/wiki/drop-receipt.ts` | `95d4d7dd0685a0ba427f99b36755223d876be3c898bef2f2a9e2ff8a4497c369` |
| `scripts/wiki/drop-assets.test.ts` | `f7bc599718d65cd34d4b9b3af15980545802420e783d2f537f58e0a46560da87` |
| `scripts/wiki/drop-native-svg.test.ts` | `7339ee5fe0755a69e9488529e0917d43705baf9f8598126744220f16b0e448f1` |

root 运行 `vitest run scripts/wiki/drop-native-svg.test.ts scripts/wiki/drop-assets.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/review.test.ts scripts/wiki/diagrams.test.ts scripts/wiki/diagram-cli.test.ts scripts/wiki/diagram-audit.test.ts server/snapshot-diagram.test.ts --reporter=dot`：**8 文件 / 83 测试 passed，exit 0，138.12 s**。日志 `%TEMP%/infra-wiki-review-20261115/922-root-tests.log`。这些确定性 RunAgent 测试证明确有三路 caller、默认验证、真实本地 Git pin 校验与发布恢复；不证明模型会遵循相互冲突的规则，也没有覆盖另一个旧页面对共享原生图的内容复核。

## P2-1：模型输出指令仍明确禁止 SVG

位置：`scripts/wiki/drop-integration.ts:3002-3003`，由 `activeRules` 共同传入 generated / section / edited。

目前返回格式只示范 `{id,yaml}`，紧接着仍写“图格式优先 figure；禁止提供 SVG 或任意代码”。新增共享 schema 并不会自动改变送给模型的规则；`DropAsk` 将这些规则交给 `restrictedArgs(rules)`，并只在返回后用 Zod 验证。遵守实际指令的模型不能正常选择已授权的原生 SVG 纯数据通道。作者测试直接硬编码 `svg`，忽略了这条禁令。

实证：`922-shared-native-probe.mts` 经真实 `startDrop` 捕获实际生成调用 `req.args`，报告 `generationForbiddenSvg: true`。进一步回读 `drop-integration.ts:2856`：`currentDiagramContract` 仍只读取 `figure.ts` 到 `export type FigureSpec` 前的 schema，模型按要求读取 `@rules/diagram-contract.ts` 也拿不到 native-svg 的伴生契约或安全属性规则。此处与输出指令属同一 P2，须一并切到真实共享输入/图通道契约，不能仅去掉禁令而仍让模型猜字段。

修复要求：在**新合法尝试**中让送出的完整规则与严格输入契约一致，清楚说明 figure/scene 只收 YAML，native-svg 必须提交同名 SVG 纯数据，并继续拒绝代码/组件/模块地址。既有 210 gen1 封存规则与缓存不得被覆盖；可沿现有规则快照机制绑定能力版本，旧尝试保留旧字节，新尝试使用新规则。需要用真实 RunAgent 入参断言三路均不再携带互相矛盾的 SVG 禁令，而不只是测试返回值通过 schema。

## P2-2：共享原生图复核及批准回执只绑定 YAML，漏掉真正的 SVG 内容

位置：`scripts/wiki/drop-integration.ts:3237-3245,3457-3484` 与 `scripts/wiki/drop-receipt.ts:269-289`。`pageAssets` 虽已为改写目标页附上 native SVG，但每个共享图使用方的 `asset` 检查仍只传 `diagrams/<id>.yaml`；批准回执同样只要求 YAML 范围。

原生图的可见文字、路径、箭头独立位于 SVG。仅改 SVG 而 YAML 不变时，未改写旧页面的复核看不到真正变化，却会通过完整性校验并发布。现有 receipt 增补 `.svg` 到 changedAssets 只保证安排了检查，未保证检查拿到了实际内容。

root 真实入口反例：`%TEMP%/infra-wiki-review-20261115/922-shared-native-probe.mts` / `922-shared-native-red.json`，隔离库 `922-shared-native-5t4OfD`，零付费、未传验证绕过。先创建“设备甲上限四请求”旧页及共享原生图 `MAX_QUEUE=4`；新材料写设备乙上限八请求，候选新页复用该图并把 SVG 改为 `MAX_QUEUE=8`，伴生 YAML 保持相同。复核夹具只有在旧页的 asset 检查实际收到新 SVG 时才指出矛盾。

实际结果：

- `asset:shared-native:old-device:0:existing` 只有旧页和 `diagrams/shared-native.yaml` 两份材料，`sawNewSvg:false`；最终 receipt 的该检查也只有这两条绑定。
- Review 写集只有 `wiki/diagrams/shared-native.svg` 与新页；`validateDropReceipt` 返回成功。
- 默认 `approveReview` 发布成功，旧页正文保持四请求，实际共享图变成八请求：`publishedState:"published"`、`newSvgVisibleInOldPage:true`。

修复要求：用同一图资产解析入口为 native 逐个使用页绑定**当前候选 YAML + SVG** 的完整有效范围；生产检查和批准时 `validateDropReceipt` 必须一致强制两份内容，漏 SVG、错 hash、过期/缺段都不能接受。旧 figure/scene 可继续仅使用决定输出的 YAML，保留旧缓存兼容。新增同一 SVG 被未改写页共享、只改 SVG、真实复核发现矛盾的反例，以及正常共享更新通过与删/换 SVG 绑定被批准门禁拒绝的测试。无需新建发布机制或重做独立 UI。

## 下一棒与边界

由原作者沿 045 完成这两项根因修复，root 定点复验；本轮不扩到 React 2D、P3、044 或教学内容。当前隔离反例是真实工程调用链上的输入覆盖验证，不冒充模型语义 E2E。正式 wiki、全部 3D/仿真、原 210 缓存、旧 888 Review 与现有端口没有被本轮探针写入。保留所有红灯文件。无需用户再次批准。
