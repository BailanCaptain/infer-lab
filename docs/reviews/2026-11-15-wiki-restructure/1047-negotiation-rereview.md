# 1038 预算协商与同代缓存独立复验

2026-11-16 21:57 UTC，砚砚独立检视作者交付 `001047`。结论：**Approved，0 P1 / 0 P2**；闭合 `1036-e2e-negotiation-review.md` 的协议矛盾。本结论只覆盖本次工程修复，不代表四类真实样本已完成整合、发布、问答或第一阶段终验。

## 审定范围与原因

共享工作区 HEAD 为 `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，包含未提交改动，因此以下实际文件 SHA-256 才是本轮审定字节：

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-integration.ts` | `43f77e1020e5956eca0a2fe6ecc034293930f638646f55231b166991ffe6a4d8` |
| `scripts/wiki/drop-run.ts` | `b9581134d95f3bfc83c93b7d94b11eacf3b6747df282f03a6e3cbc8bde39f491` |
| `scripts/wiki/drop-convergence.test.ts` | `7b17f4265d60ad5abf6f640f4bc802671cf83e6e178dc11f995d53a6145ad6cc` |

已对照 `1038-root-code-baseline` 检查生产差异。`drop-integration.ts:1914` 按当前 `materials` 计算缺失范围，而非把历史“已读”当作当前持有原文；独立 check 与 discovery 的提示、暂存和收敛契约分别处理。较小补读建议经过同一序列化预算试装。`:1483`、`:2312` 的当轮响应 schema 把未完成协商限定为请求；`:2402` 附近对 discovery 的未封存引文和未交代旧页保留补读门禁。

`drop-run.ts:330` 的缓存探测校验当前允许的响应形状，保留合法历史请求帧，跳过旧矛盾结论帧而不修改原文件。`:262` 附近在接受响应缓存之前保留协商失败原义，不把该错误转成自动修复或合法缓存。旧协议帧候选的兼容分支有明确用途：保护已封存的合法调用字节；不是放宽证据校验。

## root 实际复验

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。原红灯、原 151 次批次和 210 次封存缓存均保留。

1. `node --import tsx 1038-root-negotiation-replay.mts 1047-root-negotiation-green.json`：exit 0。在新隔离副本中重放，前序有效调用复用；旧矛盾帧不再阻断。首个新帧给出可容纳的补读范围，第二帧实际装入原文且没有 `budgetRequest`。`protocolPassed=true`、`inputs=2`、`providerCalls=0`，原批次和缓存均未改变。
2. `node --import tsx 1038-root-cache210-probe.mts 1047-root-cache210-green.json 1038-root-cache210-baseline.json`：exit 0。210 次历史调用复用，首个未缓存输入 SHA 仍为 `885c8172df81ef8d0b2d2d5cf97e474e82080da9547585c706570d096247219a`，与修复前完全一致；旧记录、克隆已有缓存、原批次与原缓存均未改变，供应商调用为 0。
3. `node --import tsx 1047-root-negotiation-rejection.mts`：exit 0（成功验证预期拒绝）。对新的协商帧故意返回形状合法的早熟结论，仍得到“上下文预算协商未完成”。`newAcceptedCacheFiles=[]`、`repairStateUnchanged=true`、原批次和缓存未变。对应 `1047-root-negotiation-rejection.json`。
4. 独立运行 `vitest run scripts/wiki/drop-convergence.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/drop-native-shared-review.test.ts scripts/wiki/drop-run.test.ts scripts/wiki/drop-receipt.test.ts server/drop.test.ts --reporter=dot`：**6 files / 53 tests passed，exit 0**，耗时 135.39 秒；完整输出 `1047-root-tests.log`。Vite 配置加载仍提示仓库既有无扩展名导入，未将其描述为零警告。
5. `tsc -b tsconfig.json --noEmit --pretty false`：exit 0；三个变更文件只读 Biome 检查 exit 0；`node scripts/check-deps.ts` exit 0。测试结束后重新核对三个文件，SHA 与上表一致。

上述克隆回放是确定性协议检验，不冒充真实模型语义验收；210 次探针明确使用历史缓存协议专用验证边界。真实批次后续调用继续使用生产验证，不带该豁免。

## 后续与范围

允许从真实隔离批次 `3895c20b-11be-4200-8292-540668d0bef1`、generation 1 的 151 次断点继续，保留原始输入、输出、调用记录与失败缓存；先设短轮新增调用上限，遇非检查点错误先定位，不盲目重试。Task 1038 可按本报告收口；Task 044 的参数展示解耦、迁移工具及只读预演，以及四类样本后续完整验收仍未完成。

继续遵守用户 969 / 993 / 996：正式文章与示例不整改，写入、Review、发布演练只在隔离副本；阶段一最后一项由砚砚独立签署并发布结果后停工，第二阶段与独立产品不启动。现有服务保持运行。

重要取舍：只跳过不符合当前协商契约的旧结论缓存，不删除它，也不把历史已读等同于本轮已核实。待用户决定事项：无。
