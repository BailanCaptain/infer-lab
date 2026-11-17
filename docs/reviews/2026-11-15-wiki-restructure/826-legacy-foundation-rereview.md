# 045 legacyIds 底层返修独立复验

审定对象：`0001794828762800-000826-7c9b2dfe` 的在盘交付。当前结论 **Changes Requested，0 P1 / 1 P2**。上一轮坏页规范 ID 被抢占的问题已闭合；下列问题来自本轮新增的 `buildRegistry` 拒绝重复规范 ID 的入口。

## 已闭合：被跳过页的规范 ID 占位

- 实际回读 `collectLegacyIdConflicts(pages, reservedCanonical)`、manifest/live snapshot 联合校验、reader store 与源快照生产路径；schema-invalid 与 missing-diagram 均保留占位。合法无冲突坏页仍可被跳过，其余文章可阅读。
- root 原反例 `813-skipped-id-probe.mts` 本轮输出 `813-skipped-id-green.json`：`rejected: true`，明确拒绝 healthy 页用 legacyIds 抢占 unavailable。
- `825-legacy-adversarial-green.json`：11 项独立检查全部通过，含同页只加载一次、展示 aliases 不参与路由、冲突 install 保留旧状态、跨 revision 重绑/移除旧 ID、迟到旧加载不污染。检查前后 SHA 一致。
- root 定向回归：schema / reader-store / reader-skip 共 25 项通过；build / lint / check-content 共 66 项通过，合计 **6 文件 / 91 项，exit 0**。日志 `825-root-skipped-tests.log`、`825-root-build-tests.log` 位于 `%TEMP%/infra-wiki-review-20261115/`。

## P2：runBuild 在验证 registry 之前先覆盖了 index.md

- 位置：`scripts/wiki/build.ts:110` 先写 `wiki/index.md`，到 `:113` 才调用新加入校验的 `buildRegistry(pages)`。
- 精确复现：root 脚本 `%TEMP%/infra-wiki-review-20261115/825-build-collision-probe.mts`，输出 `825-build-collision-valid-red.json`。隔离目录放 `concepts/duplicate.md` 与 `sources/duplicate.md`（各自 frontmatter 合法，文件名与 id 一致，但跨目录 id 相同），预置原 index/registry，然后执行真实 `runBuild`。
- 实际结果：`buildRegistry` 抛出“规范 id「duplicate」重复出现”，但 `indexPreserved: false`、`registryPreserved: true`。失败构建已将原索引覆盖成带歧义页面的新索引，两个派生产物分属不同版本。
- 最小修正：在任何派生文件写入前先计算并验证完整 registry 和 index 字符串；验证失败返回/抛错均可，但两个原文件应原样保留。补跨目录重复规范 ID 的失败构建无副作用测试，不需要增加事务框架。修正后直接继续原已授权 UI 短轮，root 并行复验此点。
- 早期 `825-build-collision-red.json` 使用未被扫描的 features 目录，只是夹具失误，不作为 finding 证据；有效反例为上述 `valid-red` 文件。

## 当前精确摘要与浏览器边界

- schema.ts `889ed0aa6f2a15ea55a0a57e939f876e2502d252d4fd159544046f2477d3bb47`
- reader-store.ts `b596ee5a968742312a3fdb5e12af1ac5144f9b6b71fdb20cd1b8997dcf9faadb`
- server/snapshot.ts `096b802827df3b4f4d28dbd4ec7f7a51c581899ce3e56139674a08a8df11e2e4`
- build.ts `28eba19f348e867323614b0d14b72041b82cd556953130da16001dbe84704401`
- lint.ts `7bec27d6e4266344e358d4dcabab8e1fe7c06421e94b6623fa01f35bb30e6366`

root 已用生产应用及三篇正式样本的隔离副本（仅增加 legacyIds）实际运行 Chromium，`813-root-legacy-browser-red-v2/report.json` 中旧 URL 尚未 replace 规范化、目录未高亮、Forward 仍为旧地址为三项预期红灯；中文锚点与折叠区、同页单次下载、未知 ID、不刷新文档已通过。脚本 `813-root-legacy-browser-probe.mjs` 可在 UI 完成后直接复跑；首次 red 的超时来自夹具误用了“分块”标题，已更正为真实标题且保留旧输出。尚未做 UI 最终验收，不将第一段结果冒充整个 045 完成。
