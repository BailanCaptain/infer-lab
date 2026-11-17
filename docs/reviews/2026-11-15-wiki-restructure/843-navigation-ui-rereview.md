# 045 导航 UI 最终独立复验

2026-11-16，承接作者 `000844` UI 交付与 `000848` 返修交付（`000843` / `000847` 同一项 P2）。**当前下列精确字节 Approved，0 P1 / 0 P2；仅导航兼容子批通过，完整 045 与框架仍在推进。**

## 改动与根因闭合

`src/app/wiki/WikiLink.tsx:49` 的 `isPlainPrimaryLinkClick` 统一过滤被阻止、非主键及 Ctrl/Meta/Shift/Alt 激活；`:85` 入口通过后才安排当前窗口的滚动/折叠展开。不取消浏览器原生新标签/新窗口行为。普通点击与同锚点重复展开继续有效。

`WikiPage` 以同一快照解析规范 ID，以 replace 保留 query 与中文 fragment；目录、正文加载、面包屑与传给聊天的 currentId 使用规范 ID。正文、聊天、推荐阅读复用同一链接组件；外链使用 noreferrer（含 noopener 语义）。未发布 Review 仍使用原 `DropReviewPreview` 通道。

## 审定字节

HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，共享未提交修改按以下 SHA-256 审查，不能仅用 HEAD 代表改动。

| 文件 | SHA-256 |
| --- | --- |
| `src/app/wiki/WikiLink.tsx` | `73c5e30c6f8550054dba3fa069e980796359cc45a5869a6097f465758bc0bf57` |
| `src/app/pages/WikiPage.tsx` | `bc336850f69aedfd7cbef538f8d2865192f0f0fde720c17fb0b53653f8bfbfe3` |
| `src/app/wiki/ChatMarkdown.tsx` | `54908b778406af716b8992ebe82cc892c4aedc9cf564b3eecb3b9335469860a1` |
| `src/app/wiki/ChatDrawer.tsx` | `b86d7601f1a0a916f3e384aefd494755104ddac3b558d6dc70549dbf1fce36bf` |
| `src/app/wiki/WikiPanel.tsx` | `3548dfaa292c7bd591d58524f8c6470375f9ded129e3a6458baa36786c165038` |
| `src/app/pages/WikiPage.test.ts` | `e09a3bbb04a6dc40098344c5af803244932c704046aab6762d1ac9ee708221c0` |
| `src/app/wiki/ChatDrawer.test.tsx` | `06b9e13ba0f00bc0e18e66e18fcceb883f604caa30a6de9f37edc85bb6c738bb` |

`DropReviewPreview.tsx` `c331faef…`、`QuickSearch.tsx` `47050b00…` 及 833 已审底层未改变。完整摘要保存于 `843-root-ui-hashes.json`。

## root 实际执行证据

以下临时材料均在 `%TEMP%/infra-wiki-review-20261115/`，隔离数据与随机端口；已有 4173/4174/4196 服务、正式 wiki、原 210 缓存、旧 Review888、3D 和仿真未写入。没有模型付费调用。

1. **原反例先红后绿**：`839-modified-click-red.json` 中 Ctrl 新标签打开导致当前文章 800→19156 / 800→0；修复后独立新构建 `813-legacy-fixture-Wb5nJJ/dist`，`843-root-modified-click-green.json` 两项通过，当前 scrollY 均保持 800、折叠状态不变，确实各打开第二标签。错误数 0。
2. **完整导航浏览器回归**：`843-root-legacy-browser/report.json` 13 项通过；`843-root-chat-navigation/report.json` 11 项通过。覆盖 replace 历史、query/中文锚点、折叠重新展开、目录高亮、同页 chunk 复用、未知 ID、聊天相对旧参数链接与推荐阅读 SPA。均断 API、`/nested/`、1440×900，浏览器错误 0。实际查看目标页截图，无当前改动引入的布局异常。
3. **实时快照路径独立执行**：读取并复用作者探针，改用 root 隔离输入和结果目录，`839-root-live-and-search/report.json` 6 项通过：旧 ID 起初不存在，HTTP 返回隔离生产函数生成的新快照后自动 replace 并展开锚点，再 Ctrl+K 搜索跳转成功。本项运行于修饰键修复前，涉及的快照、页面及搜索实现字节未变；不把夹具 HTTP 称作全量正式 API E2E。
4. **测试与工程检查**：初始 UI `WikiPage/ChatDrawer/index/markdown` 4 文件 / 44 项通过；本次仅改共用点击保护及其回归断言，定向 `WikiPage/ChatDrawer` 2 文件 / 8 项通过。两次有重复项，不累加成独立测试数量。`tsc -b --noEmit --pretty false`（最终 `843-root-tsc.log`）、7 UI 文件 `biome check`、`check:deps`、隔离生产 Vite 构建均 exit 0。日志 `839-root-ui-tests.log` / `843-root-ui-tests.log` / `843-root-fixture-build.log`。

全部 root 临时浏览器与服务已在 finally 关闭，执行会话已退出。仍需按唯一方案继续离线证据面板、2D 双通道、既定 P3 阅读交互、044 工程与四类真实完整 E2E；24/163 内容阶段保持后置，不能标全方案完成。

作者 `848` 另交付 `843-shuo-keyboard-and-hashes.json` 的键盘 Enter / 同锚点重复展开 / 推荐阅读 4 项实测；root 已回读结果及一致的文件摘要，作为作者补充证据，不冒称 root 执行。作者最终完整 4 文件 / 45 项测试与零残留进程亦已持久回交。
