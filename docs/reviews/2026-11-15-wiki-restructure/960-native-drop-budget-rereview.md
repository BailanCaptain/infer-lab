# 960 动态预算分块独立复验

2026-11-16 17:54 UTC，砚砚 / gpt-6-astra。结论：**Changes Requested，0 P1 / 1 P2**。原 953 的长文超预算路径已转绿；新增 UTF-16 精确切分分支存在不收敛边界，需要在本子批闭合。

## 验证字节与已通过结果

- `scripts/wiki/drop-integration.ts`：`9d2775fc8397d1b65718154380c5678c26443e6a165982b61d0b4c8a30cf503c`。
- `scripts/wiki/drop-native-shared-review.test.ts`：`a0288cdf1bd701720e8f4088dbc6430a8419ae2a5e1b8870f52143f68c471884`。其余资产/receipt 文件保持 953 审定版本。
- root `955-budget-boundary-probe.mts` 的正常正文与 JSON 转义/emoji 正文两组均进入 `review`，实际输入全部在完整系统规则扣除后的预算内，UTF-16 区间连续覆盖全文，260 处原事实完整保留。报告 `960-root-budget-green.json`、`960-root-budget-escaped-green.json`。
- root `vitest run scripts/wiki/drop-native-shared-review.test.ts scripts/wiki/drop-native-svg.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/drop-context.test.ts --reporter=dot`：4 files / 47 tests passed，exit 0，108.43s；`960-root-budget-regression.log`。全仓 `tsc -b --noEmit` exit 0，6 文件只读 Biome 检查通过。
- root `960-native-cache-replay.mts`：隔离复用原 210 次缓存，第 211 次未缓存的 drop-discover 在禁止模型调用的边界主动终止；付费调用 0，网络请求 0，原 1363 文件及 batch 完全未变。报告 `960-native-cache-replay.json`。此为缓存兼容回放，不冒充整合完成。
- `955-native-drop-browser-review.md` 的实际 Review 批准、恢复发布、静态重建与离线图 pin 浏览器验收仍有效，本次未改 UI。

## P2：代理对边界回退使二分区间不再缩小

位置：`scripts/wiki/drop-integration.ts:863-870`，`fittingChunks` 最后的 UTF-16 分支。

此处先把二分中点传入 `safeSliceEnd`，再用**修正后的** `mid` 更新 `lo = mid + 1` 或 `hi = mid - 1`。当原中点处在代理对内部，`safeSliceEnd` 会减一；例如已经有 `lo = hi = 3`，当前文本开头为两个 emoji，`safeSliceEnd(..., 3)` 返回 2。范围 `[0,2)` 若能容纳，则 `lo` 再次变为 3，`hi` 仍为 3。循环持续检查相同范围，同步阻塞线程，不能正常给出 Review 或可恢复的预算失败。

稳定反例保存在 `%TEMP%/infra-wiki-review-20261115/960-chunk-boundary-probe.mts` 与 `960-chunk-boundary.json`。探针通过 TypeScript AST 提取当前生产方法原文（`activeResources`、协议/帧预算、`fitsExchange`、`fittingChunks` 及区间帮助函数），使用真实 `DropContext`、128000 窗口/16384 输出预留与完整必需 support；未改生产文件、未调用模型或发布。必需帧 6919 B，完整规则扣除后的输入上限 6942 B（剩余 23 B），候选为 `🔍`.repeat(64) 时，默认最小 UTF-8 分块无法容纳、单字符范围可容纳，进入该精确分支后反复检查 `[0,2)`。含反斜杠/双引号/emoji 的对照也复现。观察器在同一范围第 41 次求值时主动抛出 `REPEATED_SAME_RANGE:0:2:0`，避免真的挂死进程；它不改变任何拟合判定或二分边界。

报告中少量 `fits:false` 是预算不足时正常返回默认块、随后应由正式调用拒绝的样本，不作为额外缺陷。唯一发现是可容纳最小切片时的循环不推进。

## 收口要求

保证每轮搜索边界严格缩小，同时输出端点始终位于完整 Unicode 字符之间；宜把二分搜索坐标与最终安全切片端点分开，或直接在合法端点上搜索，不增加新的重试/超时兜底。先用此反例做失败验证，再覆盖窄预算下 emoji、重转义单行、正常 ASCII 的有限终止与连续覆盖。原 47 项、两组长文预算与缓存兼容结果不撤销；只复验改动影响，不重复未变 UI 或扩张到 React 2D。
