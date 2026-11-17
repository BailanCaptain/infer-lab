# 调用回执与同代恢复独立终验

2026-11-17 00:01 UTC，砚砚独立检视。结论：**Approved，0 P1 / 0 P2，仅本回执子批**。关闭 `1058-failed-attempt-receipt-review.md` 的失败响应覆盖问题及 `1100-receipt-layout-review.md` 的顶层扫描兼容性回归；不表示 044 或第一阶段整体完成。

## 实现与锁定字节

作者为烁烁，原 044 任务内实现；砚砚未修改生产代码。新调用按 `calls[].key` 写入 `runDir/calls/call-<key>.input.json` 与 `.output.json`，输入记录携带对应 hash 与 stage。独占原子发布避免覆盖另一份回执；旧 hash 输入、原响应及合法缓存保留首次字节。只有通过当前 schema 的响应生成合法缓存，协商失败仍拒绝，协议、提示词与 generation 未改变。

- `scripts/wiki/drop-run.ts`：`651bcf7015b385901a102891c7fbb76576457aab422561b95835d81e8cd3e022`。
- `scripts/wiki/drop-call-receipts.test.ts`：`224a6dfcbdfd23155e2af5a0b09b375a14aa81d943a4cfb6de809e2bb422abad`。

通过与 `1094-drop-run-before.ts` 的精确差异核对，缓存选择、协商门禁和写管线其它实现未改。新回执不再进入顶层 `.input.json` 扫描；旧协议恢复测试没有被改写或降级。

## 独立实跑证据

证据目录为 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。

1. `1103-root-receipts-final-tests.log`：`drop-call-receipts`、`drop-run`、`drop-convergence`、`drop-integration`、`drop-native-shared-review`、`drop-receipt`、`server/drop`，**7 文件 / 56 项通过，exit 0，123.02 秒**。覆盖失败后成功重试、重复失败、合法缓存零重跑、旧协议缓存恢复、长篇修订与共享图整合。原 `1100-root-receipts-regression.log` 红灯保留。
2. `1103-root-failed-receipt-final.json`：从原 173 次隔离批次复制，生产 `startDrop` 同代重试到第 174 次受控限额；1 次确定性代理、0 次供应商调用，原批次与原缓存未变、前 173 次调用记录未变、克隆内所有旧 hash 文件未变。原失败响应 SHA 仍为 `29165cb3ea93c07eb4eefdd6bdb639f4fee04b5b2f90934aa29c226d794c802a`。
3. `1103-root-receipt-association.json`：独立逐项回读新调用键、输入 hash/data、原响应和合法缓存，确认它们互相对应；再次恢复命中合法缓存时 **0 次供应商调用**，原回执和缓存全部不变。随后在下一个未缓存调用前命中 174 次限额，是刻意的边界，不是宣称整批已完成。
4. `1103-root-receipts-typecheck.log`：`tsc -b tsconfig.json --noEmit --pretty false`，exit 0；只读 Biome 两文件检查与 `scripts/check-deps.ts` 均 exit 0。

## 继续条件与范围

原真实批次 `3895c20b-11be-4200-8292-540668d0bef1` 可在相同 generation 1 下从 173 次断点继续，保留每次真实调用证据；不得把失败模型结果当作通过。后续 coverage 快照契约、来源编号、参数展示、AST 只读预演与四类工程闭环仍需完成。文章整改、四个独立产品仍留待；第一阶段最终独立签署后停止派工，保留现有服务。

本子批不需要前端视觉复测；真实写入恢复和阅读界面在后续隔离全流程验收。无新增依赖，无正式文章或旧 210 缓存改动。待用户决定事项：无。
