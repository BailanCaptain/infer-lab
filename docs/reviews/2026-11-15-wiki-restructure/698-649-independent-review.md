# 649 独立复审：696 交付版本

审查人：砚砚。时间：2026-11-16。结论：**Changes Requested，0 P1 / 2 P2**。

审查来源：`thread_owned_956487d4f9f669c9e3c9c671b6bbd04ba9e56150#0001794815873337-000696-68dd2ef0`。工作区 HEAD 为 `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，本次审查的是下列未提交文件实物，不把 HEAD 当作全部改动版本。

| 文件 | SHA-256 |
|---|---|
| `scripts/wiki/drop-integration.ts` | `36c786ea9301386b4dd0e8b2a1066a7bbc339e8c5d27852aae7f485e0c530b73` |
| `scripts/wiki/drop-run.ts` | `91c77c6b521ef712d9af8046a443456562b7a24b84adb5ee18908d24a623c39b` |
| `src/content/wiki/drop.ts` | `c89a065d2d49416ec4bbbcdd891439943ef34218d89fc57cdcda292d2a5888df` |
| `server/drop.ts` | `aba0b5260ddd916f77cffb96e3deb4f79d835f7bc2815da62699081744e99b0c` |
| `scripts/wiki/drop-convergence.test.ts` | `f9987886d885ebfe700dba60da9a83728c275cb6a9361703d926252ab9cebb97` |

## P2-1：真实旧缓存的越界校正帧仍未兼容

**位置**：`scripts/wiki/drop-integration.ts:1322` 的 `pendingRangeErrors` 分支，尤其 `1348`、`1365`；与 `1778`、`1821` 的普通帧缓存兼容逻辑对照。

当前 range-error 帧给非发现阶段 `activeResources` 增加 `inspectedInStage` / `remainingRanges`，却没有走普通帧已有的旧缓存匹配。原先已经成功并持久缓存的提取结果因此会重新调用模型，违反本任务保留并复用已有付费缓存的约定。

**复现**：在原现场的独立副本运行 `node --import tsx %TEMP%/infra-wiki-review-20261115/698-649-cache-replay.mts`。脚本禁止网络，首个未缓存调用立即以 `ISOLATED_REPLAY_BOUNDARY_NO_MODEL_INVOKED` 停止，没有调用真实模型。

- 原现场：`042-pipeline-gLwOzm`；batch `4c552fdf-de07-4069-a5f8-33c15586903a`，generation 1，protocol 4，210 次历史调用。
- 首个未命中是第四份来源 `sha256-ede00f3a...` 的 `drop-extract` 越界纠正帧；不是整批第一次提取请求，也不能声称 210 次已全部回放。
- 旧缓存输入：`370dd55d97ea33afee74c35a26ba3a07471ea7b40172496ad8f582c01ca6adda.input.json`。
- 新输入：`a0e4892a1c1dc541209dd0dbe145b72d198c1b74ec82869861f5fd1301cc8602.input.json`。
- JSON 精确差异仅两处：`navigation.activeResources[0].inspectedInStage = [{start:0,end:20000}]`；`remainingRanges = [{start:20000,end:21063}]`。规则文本双方相同，均 1023 个字符。
- 证据：TEMP 下 `698-649-cache-replay.json`、`698-cache-frame-diff.json`；副本 `698-649-replay-u4mnxF`。付费调用 0、网络调用 0、原 1363 个缓存文件及 batch 内容零变化；回放前后上述实现文件 SHA 不变。

**修正要求**：统一当前帧与旧帧的选择入口，覆盖正常、预算协商和越界校正出口；存在性探测保持纯函数语义，不触发 `onInput`。本次同一文件已出现多处分支式 fallback，不能继续按发现一处漏口就复制一层兼容分支的方式堆补丁。保留 v3 行为及旧文件；补实际越界校正缓存回归和正常新帧的已读范围断言，最后再跑真实副本到首个确实不存在的缓存边界。

## P2-2：旧回归用例尚未跟上单片读取的明确契约

**位置**：`scripts/wiki/drop-integration.test.ts:2098`–`2101`，用例 `enforces consistent v4 drop-discover stage contract, holds unaccounted evicted page slices instead of silent drop, and converges across 4+ pages without re-pulling staged slices`。

9 文件完整独立回归实际结果 **90 passed / 1 failed**。失败是该用例仍把 `drop-read` 与 `drop-extract` 一起要求使用旧的交互式补读提示词；当前 v4 未缓存 `drop-read` 已改为宿主逐片遍历，并只核对当前片内引文。这个失败不能直接当成发现阶段语义退化，也不能忽略而声称整套全绿。

为确定影响范围，独立临时复制原测试，只把这一处断言按阶段区分：`drop-extract` 保留原断言；`drop-read` 核对“只盘点当前 range”、引文必须来自当前片、`materials` 恰一项且 id/start/end 与 range 一致。其余 stage hold、四页收敛、独立 comparison/check 原文与 receipt 断言全部原样保留。

实跑该用例 **1 passed / 33 skipped，exit 0**，证明这处契约更新后后续断言可以通过。临时文件已从工作区移除，副本留在 TEMP `698-contract-probe.test.ts`（SHA `bc02b84c7aad724d9da88db117633362993c5d49ecaf5f2c9ffcbc0fe29d4efc`）；**作者正式测试尚未修改，完整 91 项当前仍是 90/91**。请作者把等价行为断言正式收口，不能删测试或只删失败断言。

## 已通过的范围与边界

- 独立命令：`node node_modules/vitest/vitest.mjs run --project wiki-integration scripts/wiki/drop-convergence.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/drop-run.test.ts scripts/wiki/drop-receipt.test.ts scripts/wiki/drop-context.test.ts scripts/wiki/drop-assets.test.ts scripts/wiki/review.test.ts scripts/wiki/revisions.test.ts server/drop.test.ts --reporter=default`。9 文件 91 项，用时 114.55 秒，结果如上。
- 5 项新增收敛用例全部通过；原 v3 真实缓存、v4 独立事实回执与离线批准、来源隔离、Review 并发/恢复/拒绝/过期校验等通过。
- 独立执行 `node node_modules/typescript/bin/tsc -b --noEmit --pretty false`，明确捕获 `TSC_EXIT=0`；对交付 5 个文件执行 Biome，`Checked 5 files in 118ms. No fixes applied.`、`BIOME_EXIT=0`。
- 编辑参考的合法 `raw:sha256-<guideHash>.md#L1-L2` 伪装来源被白名单拒绝，合法第二次生成在隔离夹具形成 Review 并离线批准；这不是正式四篇文章已发布的证据。
- 没有启动新付费整合、修改正式 wiki、旧 Review、3D 或 4173/4174/4196 服务。完整构建与最终放行留待上述问题闭合后验证。

## 下一棒

分块预填充已由 679（事实）与 702（教学/2D）双审通过，连同量化当前为 **2/24 篇候选双审完成**。第三篇参数页的 558 前置提炼已通过 704 单独派发。本文两项 649 返修在该提炼短回合结束后交原作者，以避免同一次执行混入不同 Task；不把代码等待扩成文章停工。
