# 045 导航 UI 独立浏览器复核

2026-11-16。恢复来源 `000839`，作者原任务 `045` / `000830`，在盘 UI 实现的阶段性检查。**Changes Requested：0 P1 / 1 P2**。833 构建前置校验的 Approved 不受影响。

## P2：修饰键在新标签打开链接，却同时移动当前文章

- 位置：`src/app/wiki/WikiLink.tsx:61`，`WikiContentLink` 的 `<Link onClick>`。
- 原因：React Router 会对 Ctrl/Meta/Shift 等修饰键保留浏览器原生导航，但组件自己的 onClick 无条件安排 requestAnimationFrame，仍修改当前窗口的滚动位置或折叠区。
- 实际影响：读者 Ctrl+点击链接准备稍后在新标签阅读，当前文章突然跳到页尾/页首，打断正在阅读的位置。正文、聊天和推荐阅读共用此组件，须在共用入口修复。
- Chromium 实证（真实鼠标 Ctrl+点击、1440×900、`/nested/`、API 阻断）：当前量化页 scrollY=800，折叠区关闭；Ctrl+点击“同页锚点”后确实新开第二标签，当前 URL 未变，但 scrollY=19156 且折叠区被展开。Ctrl+点击无锚点推荐阅读后，同样新开标签且当前 URL 未变，当前页却从 800 跳到 0。
- 复现：`%TEMP%/infra-wiki-review-20261115/839-modified-click-probe.mjs <dist> <output.json>`；红灯结果 `839-modified-click-red.json`，两个断言失败，pageErrors 为空。
- 修改方向：仅在属于当前文档的普通主键激活时安排手动滚动/展开；跳过已 preventDefault、非主键及 Ctrl/Meta/Shift/Alt 修饰事件。保留普通点击、键盘 Enter 及重复同锚点展开行为。不要拦截原生新标签/新窗口操作。

## 已通过的独立证据

使用正式页隔离副本与生产应用重新构建：`813-legacy-fixture-T2Jw1t/dist`，构建日志 `839-root-fixture-build.log`。正式 wiki 未写入，既有服务未改动；临时服务/浏览器均在 finally 关闭。

- `813-root-legacy-browser-probe.mjs` → `839-root-legacy-browser/report.json`：13 项全通过，覆盖旧 ID replace、query/中文折叠锚点、规范目录高亮、单页 chunk 复用、后退/前进、未知 ID 不加载文章，浏览器错误为 0。
- `830-root-chat-navigation-probe.mjs` → `839-root-chat-navigation/report.json`：11 项全通过，覆盖聊天 currentId、相对旧参数链接、重复同锚点重新展开、推荐阅读 SPA 与回到文章起点、外链新标签及 noreferrer；浏览器错误为 0。noreferrer 已隐含 noopener，不要求冗余属性。
- `vitest run src/app/pages/WikiPage.test.ts src/app/wiki/ChatDrawer.test.tsx src/content/wiki/index.test.ts src/content/wiki/markdown.test.ts`：4 文件 / 44 项通过，exit 0，日志 `839-root-ui-tests.log`。
- 本轮前文件指纹保存在 `839-ui-before-hashes.json`；截图在两个浏览器结果目录，已实际查看相对参数目标页的布局。

本结论只覆盖当前导航短批；证据面板、2D 双通道、044 工程与四类完整 E2E 仍待接续，不能以导航检查代替框架验收。
