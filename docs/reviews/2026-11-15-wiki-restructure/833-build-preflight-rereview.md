# 045 导航底层最终返修复验

对象：`0001794829353390-000833-e0f98cfd`。**Approved，0 P1 / 0 P2，仅覆盖导航底层与构建门禁；045 UI 和其余工程尚未验收。**

`826-legacy-foundation-rereview.md` 的构建写入顺序 P2 已闭合。root 实际读取 `scripts/wiki/build.ts:93` 起的最终实现，跨目录重复规范 ID 与 legacyIds 冲突先拒绝，完整 `buildRegistry` 校验和 `renderIndex` 均在 mkdir/write 之前完成。没有为此引入额外事务层。

## 本轮独立证据

- `scripts/wiki/build.ts` SHA-256：`8104120245fafe3b613f5701a491a655ce7f7eba854e802b75146fc1644a1b3c`。
- `scripts/wiki/check-content.test.ts` SHA-256：`54ecba977e176ad3adc9d1c78dc9df377f077fcf1190a8a5aa9e082e0876d3e4`。
- 原隔离反例 `825-build-collision-probe.mts` 本轮结果 `833-root-build-collision-green.json`：`pageCount=2, problems=1, indexPreserved=true, registryPreserved=true`，旧红灯文件保留。
- `vitest run scripts/wiki/build.test.ts scripts/wiki/check-content.test.ts`：**2 文件 / 6 项通过，exit 0**，日志 `833-root-build-tests.log`。
- schema `889ed0aa…`、reader-store `b596ee5a…`、snapshot `096b8028…`、lint `7bec27d6…` 与 826 精确摘要一致，上一轮独立 11 项对抗检查与 91 项回归证据继续适用，不将重复测试累加为新总量。

## 下一段验收

作者已按 830 原授权直接推进 UI，无需额外阶段审批。root 已准备两份独立真实 Chromium 红灯脚本，均使用隔离正式页副本与生产应用、子路径 `/nested/`、阻断 API、0 付费模型调用，结束后已关闭临时服务/浏览器：

- `813-root-legacy-browser-probe.mjs` / `813-root-legacy-browser-red-v2/report.json`：旧 URL 规范化、目录高亮、Forward 返回规范地址三项待绿，其余 query/中文折叠锚点、同页单次下载、未知 ID 已通过。
- `830-root-chat-navigation-probe.mjs` / `830-root-chat-navigation-red/report.json`：浏览器本地合成导航对话（不是事实回答）复现纯 `#怎么开` 跳出文章、外链缺少新标签与 noopener、相对旧参数链接未规范化。该夹具下推荐阅读跳转及回到文章起点已经通过，不把它们描述成已实证失败。

临时产物均位于 `%TEMP%/infra-wiki-review-20261115/`。完整 UI 须重新构建后实操，不以这里的底层 Approved 代替浏览器验收。
