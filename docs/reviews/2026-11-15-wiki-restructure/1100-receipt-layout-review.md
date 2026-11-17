# 调用回执存放位置的兼容性复审

2026-11-16 23:55 UTC，砚砚独立检视当前在盘代码。结论：**Changes Requested，0 P1 / 1 P2**。原 1058 覆盖问题在独立克隆中已转绿；本项是新回执布局对既有恢复契约造成的回归，仍在原 044 短轮内收口。

## P2：逐次回执混入顶层历史缓存帧集合

`scripts/wiki/drop-run.ts:45` 的 `callReceiptPaths` 目前将 `call-<key>.input.json` 写入运行目录顶层。该层已有“`<hash>.input.json` 是历史输入帧”的消费方式：`scripts/wiki/drop-integration.ts:3229` 扫描全部 `.input.json` 以恢复封存规则；`drop-convergence.test.ts:686` 的旧协议缓存复用验证也按此集合找到对应 `<hash>.json`。新回执并没有对应 `call-<key>.json` 合法缓存，导致已有恢复回归失败。

实际命令 `node node_modules/vitest/vitest.mjs run scripts/wiki/drop-call-receipts.test.ts scripts/wiki/drop-run.test.ts scripts/wiki/drop-convergence.test.ts --reporter=dot` 退出 1；`1100-root-receipts-regression.log` 记录 `drop-convergence.test.ts:694` 读取 `call-f045f051-edcd-4dad-be2f-d8ac5c423c67.json` 的 ENOENT。审阅生产 SHA-256 为 `edcc673c4f71610a07494c23f9da359780c226ec7c3d2aea2949acf5efd3d1ce`。

最小修复方向是把逐次回执放进 `runDir/calls/<callKey>.input.json`、`.output.json`，继续用调用键建立对应关系；顶层旧 hash 文件、扫描与原测试契约保留。无需改变模型协议、提示词或 generation。首轮新代理测试还曾在第三次恢复重复发越界请求，作者已将其限制到首个失败阶段；该夹具错误与本 P2 区分，不应靠放宽生产门禁解决。

## 已证明的进展

`1058-failed-receipt-retry.mts 1100-root-failed-receipt-retry.json` 退出 0：原 173 次隔离批次复制后，1 次确定性代理调用、0 次供应商调用，正常同代重试至第 174 次限额；前 173 次记录、所有旧 hash 缓存和首个失败原响应逐字节未变。原真实批次仍为 173 次断点。此结果证明覆盖问题的修复方向正确，但不能替代上述兼容性回归。

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。本轮无正式文章、3D、旧 210 缓存或现有服务改动；无需用户新增决定。
