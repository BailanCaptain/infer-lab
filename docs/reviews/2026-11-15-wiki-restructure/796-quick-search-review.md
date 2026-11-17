# 751 快捷搜索独立复审（796）

结论：**Changes Requested，0 P1 / 3 P2**。索引底层已获批结论保留；当前 UI 批次尚不可标完成。

审定基线：HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 加工作区文件，来自消息 `0001794824944910-000796-9018a0a6`。本次未修改实现文件。

| 文件 | SHA-256 |
| --- | --- |
| `src/app/wiki/QuickSearch.tsx` | `b92ad02cd2191ca9814384f65f3f007e38df17f4a5c83e2aa0f7b27e5911b885` |
| `src/app/wiki/QuickSearch.test.tsx` | `91ee927f34494793376127b265801f97800678dceecb082263ce2e19eebfc1d8` |
| `src/app/AppShell.tsx` | `2427fbfcea21aaea16d7cd7be58cd2833c08928582b1880303e6aba22063c678` |
| `src/app/pages/WikiPage.tsx` | `bea807342b944c642b9c58796f5d855896c471d1c331753cc8e0d8f2251941f2` |
| `src/design/knowledge-reader.css` | `e41d7e71fdf56e8aa1af9eb0275cbecc952bf72318500b10f436e3ba3e43b0c9` |
| `scripts/wiki/reader-plugin.ts` | `87f10d1b33ee7007e2af223c138159abc3b481ef90942ae329db6fb66a872daa` |

## P2-1：弹窗父级截获所有 Enter，关闭按钮反而打开文章

位置：`QuickSearch.tsx:174`、`:244`、`:491`。

真实 Chromium 复现：打开搜索 → 输入 RoPE → Tab 聚焦 `aria-label="关闭快捷搜索"` → Enter。预期关闭并归还原焦点；实际 URL 从 `#/wiki/acl-graph` 跳到 `#/wiki/rope`。原因是弹窗根节点无目标区分地把冒泡键盘事件送入选项导航逻辑，并 `preventDefault` 吞掉按钮原生激活。

修复要求：搜索框/结果区选择行为与独立按钮激活分开；关闭、重试按钮保留各自 Enter/Space 行为，Esc 仍可在弹窗范围关闭。补实际 DOM 或浏览器回归，不能只调用控制器证明键盘正确。

## P2-2：模态焦点未约束，重试成功也丢失键盘入口

位置：`QuickSearch.tsx:241`、`:292`、`:437` 附近。

真实 Chromium 复现两条同类路径：

- 查询有结果时，Tab 从输入框到关闭按钮，再到滚动区，再到 BODY，已经离开声明 `aria-modal=true` 的弹窗；此时按 Esc，弹窗仍开着。
- 索引首次请求中止 → 点击“重试加载” → 成功后重试按钮卸载，焦点落到 BODY；直接按上下/Enter 无效。root 第一遍未手工重新聚焦输入框时，跳转断言稳定超时；第二遍显式聚焦才继续完成验收。

修复要求：实现真实模态焦点约束（可采用现有合适模式或原生 dialog），覆盖 Tab/Shift+Tab、Esc、重试按钮卸载后的焦点恢复；不要仅添加 ARIA。保留关闭时归还打开前元素。

## P2-3：新查询加载中仍可打开上一词的结果

位置：`QuickSearch.tsx:91`、`:135`、`:183`、`:305`。

root 实际导入该模块，用受控异步搜索复现：先查询 old 得到 old 页，再发起尚未 resolve 的 new 查询；此时状态为 `{query:"new",status:"loading",items:["old"]}`，按 Enter 导航到 old 并关闭弹窗。序号检查只阻止晚到响应覆盖，未阻止已显示旧结果被当作新查询选择。

修复要求：等待新结果期间清空或禁用旧选项，键盘与鼠标选择入口一致；非 ready 状态不可导航旧项。覆盖慢查询、快照刷新触发重查及直接点击选择。

## 已通过的本轮独立证据

- `vitest run`：QuickSearch、WikiPage、check-content、reader-build、raw-viewer 五文件 **12/12 通过**，日志 `796-ui-tests.log`。
- 当前 SHA 独立 `vite build --outDir .../796-ui-dist`，exit 0，日志 `796-ui-build.log`。
- 该构建在随机端口 `53173`、`/nested/` 子路径真实 Chromium 运行，API 请求由本测试拦截，未停止任何现有服务。
- 首开 block-table 不请求索引；正文独有词 `encoder_cudagraph_max_vision_` 在索引首请求中止后能 fetch 重试成功，首项 ACL Graph；导航前不加载其他文章 chunk，Enter 后仅增加目标 ACL Graph 的文章 chunk（另有字体）。无 pageerror。
- Cmd/Ctrl 两种入口、正常输入框上下选择与 IME Enter 防误跳实测通过。桌面截图已查看，布局无新增遮挡。
- 查询状态探针实跑，确认上述 P2-3，非代码推测。

所有临时证据位于 `%TEMP%/infra-wiki-review-20261115/`：`796-ui-browser-probe.mjs`、`796-ui-browser-final/report.json` 与 PNG，`796-query-state-probe.mts/json`。最早未重聚焦版本的报告保存在 `796-ui-browser/report.json`。测试进程和随机端口已关闭。原缓存、旧 Review、正式文章、3D 与已有服务未改。
