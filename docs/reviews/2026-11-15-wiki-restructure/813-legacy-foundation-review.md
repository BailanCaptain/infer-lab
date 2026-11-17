# 045 导航底层在盘增量检视

当前结论：**Changes Requested，0 P1 / 1 P2**。对象为 `813` 第一短轮在盘底层；UI 路由和聊天导航尚未进入本轮验收，不表示整个 045 已审完。

## P2：损坏页保留的规范 ID 被另一页的 legacyIds 抢占

- 位置：`server/snapshot.ts:205` 在过滤掉无效页/缺图页之后只对 `kept` 调用 `collectLegacyIdConflicts`；`src/content/wiki/schema.ts` 的 reader manifest / snapshot 对 `registry.pages` 与 `skipped[].id` 没有联合身份检查。
- 稳定复现：root 运行 `%TEMP%/infra-wiki-review-20261115/813-skipped-id-probe.mts`，原始结果 `813-skipped-id-red.json`。隔离目录中有有效 `healthy.md` 声明 `legacyIds: [unavailable]`，另有现存正式文件 `unavailable.md`（仅将 type 改成非法值，触发既有 reader skip 策略）。`readReaderSnapshot` 接受快照且记录 skipped ID `unavailable`，但 reader 的 `getPage('unavailable').fm.id` 返回 **`healthy`**。
- 影响：原本应显示“该页暂不可用”的已有 URL 被静默指向无关内容；修复坏页后又变成全局冲突，路由归属随页面健康状态变化。违背“旧 ID 不能占用其他页规范 ID”，也破坏已有坏页隔离语义。
- 修正边界：冲突检测应保留被跳过页的规范 ID 占位（读者协议中已携带 `skipped`），在源快照生产与 reader manifest/live install 入口一致拒绝歧义，或确保占位路由绝不被旧 ID 映射覆盖。不要为修复此点取消原本可用的 skip 坏页机制。覆盖 schema-invalid 与 missing-diagram 两类跳过路径；合法无冲突坏页仍应允许其他页阅读。

## 已通过的独立检查

- `813-legacy-adversarial.mts`：旧 SHA 七项红灯；目前 schema `ef6bfc00…` / reader-store `1d8440af…` 下 11 项检查全部通过，包含多旧 ID 共用规范加载、展示别名不路由、冲突快照原状态保留、跨 revision 重新绑定/移除旧 ID 和迟到旧加载不污染。完整输入/输出保留在 TEMP。
- `vitest run` schema、reader-store、lint、build、reader-build、snapshot：6 文件 / 88 项通过，exit 0，日志 `813-root-foundation-tests.log`。这不覆盖上面的 skipped 身份组合反例。
- 已用生产 Vite 配置和同一 reader plugin 构建隔离的三篇正式样本副本，仅增加 legacyIds；`813-legacy-fixture-build.mts/json/log` 及临时输出保留，正式 wiki 未变。待 UI 实现后用该入口测试 URL 与中文折叠锚点。

尚未签最终底层 Approved；上述 P2 修复后复验，再进入 UI 短轮。
