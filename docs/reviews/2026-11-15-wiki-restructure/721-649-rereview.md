# 649 返修独立复审：727 交付版本

审查人：砚砚。2026-11-16。结论：**Approved，0 P1 / 0 P2**。698/717 两项问题闭合。本结论批准代码修订，不代表正式文章已生成或发布，也不证明真实模型后续每轮必然收敛。

接受来源：`thread_owned_956487d4f9f669c9e3c9c671b6bbd04ba9e56150#0001794819110133-000727-b2f0684b`。HEAD 基线 `f44c953f99e416b2dc174c3b2ad31a729b91d30f`；审查对象是下列未提交实物，回放前后及验证结束时 SHA 均一致。

| 文件 | SHA-256 |
|---|---|
| `scripts/wiki/drop-integration.ts` | `468dd6e9b82c37d82c8aba2ab4c8cdfdd8992afa943fcd3245a4d8ac424f2922` |
| `scripts/wiki/drop-run.ts` | `91c77c6b521ef712d9af8046a443456562b7a24b84adb5ee18908d24a623c39b` |
| `src/content/wiki/drop.ts` | `c89a065d2d49416ec4bbbcdd891439943ef34218d89fc57cdcda292d2a5888df` |
| `server/drop.ts` | `aba0b5260ddd916f77cffb96e3deb4f79d835f7bc2815da62699081744e99b0c` |
| `scripts/wiki/drop-convergence.test.ts` | `27dec837c526f25720c23f0236000b86be1b27f48dcfb93d9e855563a551edf1` |
| `scripts/wiki/drop-integration.test.ts` | `72ec586891a1beaa6ad5efc829673b7ea5bfd8fca359cff280075f524c1d0005` |

## 问题闭合与代码判断

1. **旧缓存校正帧兼容**：`drop-integration.ts:1303` 的旧帧投影集中剥离新增导航元数据，`1337` 根据旧帧实际字节计算压缩档位，`1363` 统一在可容纳且确有缓存时选择旧帧，越界校正 `1416`、暂存保持 `1535`、普通帧 `1833` 与补读/预算分支均接入。非发现阶段预算旧帧在 `1623` 使用空已读表重建历史输入，但命中后 `1893/1897` 仍保留当前真实已读状态，不把旧版本的失忆行为带进后续新请求。
2. **存在性探测**：生产 `drop-run.ts:314` 的 `ask.hasCache` 不触发 `onInput`；正式消费时才解析与登记输入。`hasCacheFor` 为旧调用方保留 `cached` 兼容入口，不能笼统声称任意自定义旧回调都无副作用；本次实际生产路径以及回放均使用 `hasCache`。
3. **保留历史档位的取舍**：低档完整帧、原预算协商帧及更紧缩帧三种历史形状有真实旧缓存需求，不能只保留最终最紧缩形状再付费重算。新版字段剥离与字节档位计算集中复用；只在内容寻址缓存存在时采用历史形状，无缓存仍发当前完整进度。这些分支不放宽事实证据、来源白名单或审批规则。
4. **单片读取契约**：`drop-integration.test.ts:2098` 按 `drop-extract` 与未缓存 v4 `drop-read` 区分；后者检查当前片、精确引文、单个 materials 与相同 id/start/end，仍保留 stage hold、四页收敛、比较与 receipt 断言。未删除测试或降低后续验收。

## 本轮独立验证

- **真实缓存回放**：`node --import tsx %TEMP%/infra-wiki-review-20261115/721-649-cache-replay.mts`，exit 0。脚本由先前 698 只读回放探针另存新路径，保留旧红灯证据；导入当前仓库实现和规则资源，仅在原现场副本操作，并禁止网络和真实模型。
  - 原 batch `4c552fdf-de07-4069-a5f8-33c15586903a`、generation 1 的历史账本为 210 次；回放复用旧缓存到该停点之后，首个未缓存请求为 `drop-check` / `coverage:source:raw/sha256-ede00f3a270460309c9ef296d88c6ff16605dfe3ccd292824bd0c53df9f2415b.md@ede00f3a270460309c9ef296d88c6ff16605dfe3ccd292824bd0c53df9f2415b:0`，目标 `inference-troubleshooting`。
  - 首个未缓存依赖由探针故意抛出 `ISOLATED_REPLAY_BOUNDARY_NO_MODEL_INVOKED`；副本 `state=failed` 是预期止点，不是假装真实整合成功。`requests=1`、`paidModelCalls=0`、`blockedNetworkCalls=0`；账本 210→211 只是副本记录了这次被拦截的请求。
  - 原 1,363 个文件 SHA 与 batch 内容零变化。报告 `721-649-cache-replay.json`，副本 `721-649-replay-QRq8Lj` 保留首个未缓存输入。
- **完整相关回归**：`node node_modules/vitest/vitest.mjs run --project wiki-integration scripts/wiki/drop-convergence.test.ts scripts/wiki/drop-integration.test.ts scripts/wiki/drop-run.test.ts scripts/wiki/drop-receipt.test.ts scripts/wiki/drop-context.test.ts scripts/wiki/drop-assets.test.ts scripts/wiki/review.test.ts scripts/wiki/revisions.test.ts server/drop.test.ts --reporter=default`，**9 files / 92 tests passed，121.76s，exit 0**。覆盖 v3 实际旧缓存与恢复、v4 独立事实回执、编辑意图非事实隔离、发布校验、审批并发及故障恢复。
- **类型与代码检查**：`node node_modules/typescript/bin/tsc -b --noEmit --pretty false` → `TSC_EXIT=0`；上述六文件 `biome check` → `Checked 6 files in 153ms. No fixes applied.`、`BIOME_EXIT=0`。
- **完整前端构建**：`node node_modules/vite/bin/vite.js build --outDir %TEMP%/infra-wiki-review-20261115/721-649-build-dist` → `BUILD_EXIT=0`。输出单独放 TEMP，未覆盖现有预览目录；日志 `721-649-build.log`。Vite 的未来配置加载兼容提示不属于本次失败。

## 后续边界

708 参数标题残留硬门禁已由独立消息 731 派发，不混入本批准版本。第三篇候选仍在 725 定点返修，第四篇待按新流程提炼重写。后续改变编辑意图必须经合法新尝试；本次回放只证明原 generation 可恢复，不能宣称新编辑意图也无需模型调用。正式四篇整组 Review、静态阅读、问答引用与回流验收继续作为总任务未完成项。
