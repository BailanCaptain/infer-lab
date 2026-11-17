# 覆盖判定与纯正文检索索引契约复审

2026-11-16 23:35 UTC，砚砚独立检视。结论：**Changes Requested，0 P1 / 1 P2**。这是阶段一全仓回归发现的工程问题，不涉及文章整改。

## P2：覆盖判定将检索用纯正文再次当作完整页面解析

- 位置：`server/coverage-work.ts:239`–`245`，尤其 `parsePage(file, source.text)`。
- 根因：`server/snapshot.ts:247`–`263` 以 `body.trim()` 构建检索索引；`src/content/wiki/retrieve.ts` 的 `PageIndex.text` 契约也是正文。`assessGap` 却从 `snapshot.index.byId` 取该字段交给需要 frontmatter 的 `parsePage`，因此合法页面仍报“覆盖判定正文解析失败”。
- 影响：已有页面召回后，覆盖判定在实际模型调用前失败，无法识别检索漏召回或形成缺口材料；队列调用同一路径也失败。缺口回流是阶段一必须验收的操作，因此不能仅将失败登记后留待下一阶段。
- 修复方向：从**同一锁定 snapshot 的 `registry` / `pageTexts`** 解析原页，再取受限正文，或使用明确等价的已验证正文契约。不得退回现场读取可变磁盘，不得将 frontmatter 塞回检索正文，不得删除解析/清洗/范围/版本检查。现有 `coverage-material.ts`、`answer-quality.ts`、`chat-route.ts` / `citations.ts` 已使用 `pageTexts`，此次检索未发现它们存在同一误用。

## 实际红灯证据

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。

1. `1083-root-full-vitest.log`：`node node_modules/vitest/vitest.mjs run --reporter=dot`，exit 1；208 文件中 206 通过、2 失败，1762 项中 1729 通过、33 失败，另有 1 个未处理拒绝。失败集中于 `server/coverage-work.test.ts` 和 `scripts/wiki/worker.test.ts`；并发测试因前置解析异常而超时，不应提高超时掩盖。
2. `1094-coverage-isolated-red.log`：独立运行 `node node_modules/vitest/vitest.mjs run server/coverage-work.test.ts -t 'classifies existing-page misses' --reporter=dot`，exit 1，1 failed / 34 skipped；3.17 秒内稳定在 `coverage-work.ts:243` 复现同一异常，排除全仓运行顺序造成的假失败。
3. 验证字节：`coverage-work.ts` SHA-256 `1517f75af49860849203cbf537054fdeb2dd052eaa126d1898bef5e84ef29bad`；`snapshot.ts` `d0f347f66966620e4c0cfc5b745db2759276f79e493d1dd3b041ac4f43a41914`；`retrieve.ts` `262dc261f6e0ba92a1a3434f87255ad05d7dc8552da79b12bf5273a84423d60d`。

## 后续验收与范围

原作者先收口 1094 失败回执修复，再沿活跃原 044 单独短轮修复本问题。保留现有红灯，用定向测试证明完整页面、正文截断、引文归属、回执复用、历史 revision、输入清洗、并发及 worker 路径恢复；禁止降低断言或绕过验证。修复前不宣称全仓测试通过。与正式文章、3D、旧缓存和现有服务无关；这些保护在 `1094-phase1-preservation.json` 中均实际通过。

无需用户新增决定。
