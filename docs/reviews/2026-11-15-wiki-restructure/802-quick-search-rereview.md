# Task 751 独立终验

结论：**Approved（0 P1 / 0 P2）**。`796-quick-search-review.md` 三项 P2 已在同任务内闭合；751 的分词、预编译检索资源、加载一致性及 Cmd/Ctrl+K 读者入口可收口。此结论不代表其余框架工程或全库内容改造完成。

审查来源：`0001794826871316-000802-6bdfae32`；HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 加在盘未提交改动。

## 本轮精确文件

| 文件 | SHA-256 |
| --- | --- |
| `src/app/wiki/QuickSearch.tsx` | `47050b0062e9970ff711f4e9422ad0329ef04dfcf794e3a76d15d3611982e29a` |
| `src/app/wiki/QuickSearch.test.tsx` | `eb761726597d7951b490a6139277062fa95080343c5771febcfcf0c54fc8395a` |

已重新核对 `AppShell.tsx`、`WikiPage.tsx`、`knowledge-reader.css`、`reader-plugin.ts` 保持 796 报告的精确 SHA；六个检索底座文件也保持 782 审定 SHA。此次未覆盖其他已有改动。

## 问题闭合

1. **关闭按钮 Enter 误导航**：输入框负责选项导航，dialog 只处理 Escape 与 Tab。root Chromium 实测聚焦关闭按钮，Enter、Space 均关闭且 URL 保持 ACL Graph，不跳 RoPE。
2. **焦点逃出及重试后失焦**：root 正常态 Tab 连续八次、Shift+Tab 四次均留在弹窗，Esc 能关闭。点击重试及另一个新浏览器页面中键盘 Enter 激活重试后，焦点都是搜索 INPUT；全程没有调用 `input.focus()` 补救，直接方向键/Enter 即可导航。关闭后的截图显示焦点归还顶栏触发器。
3. **加载中新词可选择旧项**：原探针独立重跑，并同时调用 Enter 与 `pickItem(0)`，输出 `{"query":"new","status":"loading","selectableItems":[],"navigations":[],"open":true}`。代码和单测覆盖快照变更重查、ready 恢复后正常选择以及视图不显示旧项。

## 本轮 root 实跑

- `vitest run` QuickSearch、WikiPage、retrieve、reader-store、check-content、reader-build：**6 文件 / 63 项通过**，exit 0。
- `tsc -b --noEmit --pretty false`、六个 UI 相关文件 `biome check`、`check-deps.ts`：均 exit 0，Biome 零提示。
- 最终源码独立构建 `vite build --outDir %TEMP%/infra-wiki-review-20261115/802-ui-dist`：exit 0。
- 从该构建启动随机端口 `62727`，以 `/nested/` 子路径进入、拦截全部 API，Chromium 1440×900 实测：首屏索引请求 0；正文独有词命中 ACL Graph；一次人工网络失败后纯 JSON fetch 重试成功；搜索不新增其他文章 chunk；跳转只新增目标文章 chunk（另有字体资源）；Cmd/Ctrl、上下键、IME、空结果态、键盘按钮与双向 Tab 均通过，零 pageerror。
- 已查看两张最终截图，搜索列表和跳转后的正文呈现正常。

证据目录 `%TEMP%/infra-wiki-review-20261115/`：`802-ui-tests.log`、`802-ui-build.log`、`802-query-state-probe.mts/json`、`802-ui-browser-probe.mjs`、`802-ui-browser-green/report.json` 与两张 PNG。旧 `796-*` 红灯记录保留。最初的 root 空结果测试词含常见词 `no`/`match`，有合法召回；更换为单一不存在的词后通过，未修改检索实现或降低业务断言。

## 与既有证据的衔接及限制

- 分词/索引基础覆盖沿用 `782-search-foundation-review.md`：15 套 119 项、163 页 2397 查询回环等，相关底座 SHA 本轮已复核未变。
- `reader-plugin` 从动态 JS import 改为纯 JSON fetch 的变化已在 796 与本轮实际构建/浏览器验证，并保留同一快照与索引格式、按需加载和失败重试。
- 索引 JSON 实际约 6.56 MB，gzip 约 1.55 MB，不能写成方案早期估计的“百余 KB”；本轮环回网络从触发失败到重试命中约 759 ms，不宣称远程慢网表现。未为压缩省略正文可检索词或改变排序。
- 现有服务、正式 wiki、原 210 缓存、历史 Review 与全部 3D 未改变；本轮临时服务及浏览器均已关闭。下一棒为原 045 的旧 ID/锚点导航兼容，而非开始批量文档改写。
