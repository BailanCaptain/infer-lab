# 987 人工注册 React 2D 在盘独立检视

2026-11-16 19:07 UTC。**Changes Requested，0 P1 / 1 P2**。只审原 Task 045 / 987 的交互 2D 子批；不是 Task 045 或阶段一终验。作者烁烁，独立检视砚砚 / gpt-6-astra；基准 HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 加现有 WIP。

## P2：交互/静态分支替换滚动宿主后，ResizeObserver 仍绑定旧 DOM

位置：`src/content/wiki/WikiDiagram.tsx:14` 的 `useScrollHint`，尤其仅依赖稳定 `measure` 的 effect（约 L24–32），及交互组件/静态图分支（约 L91–126）。

`hint.ref` 会从交互组件内部 `.wiki-diagram-svg` 改指向静态分支的新节点，但 effect 没有因宿主替换而重新绑定；旧宿主的 ResizeObserver 不再接收新宿主宽度变化。该新路径由同 ID 正式 SVG 指纹变化触发，属于本子批明确支持的 live 回退场景。

实跑 Chromium：正式 `quantization-intuition` 开启交互，在 2560px 桌面打开右栏，旧图不溢出；用真实阅读器“刷新知识库”安装隔离的新 revision（同 ID SVG 文本变为“新版图标记”），确认正确回退新静态图；关闭右栏并调整至 1200px。新滚动宿主 `clientWidth=802, scrollWidth=880, slack=78`，但 `tabindex=null`、提示 `hint=false`。键盘用户无法通过 Tab 聚焦该横滚区，右侧图内容不能按既有键盘滚动路径访问。反向从溢出态切换后变宽，也会错误保留提示与多余 Tab 停靠点。

证据：`%TEMP%/infra-wiki-review-20261115/1000-react2d-live-wide-red/report.json`，命令 `node --import tsx .../1000-react2d-tail.mts 1000-react2d-live-wide-red --wide-live` exit 1；窄到宽反例为 `1000-react2d-tail-verified/report.json`。图版本回退本身正确，`pageErrors=[]`；失败只在宿主替换后的测量/可聚焦状态。

修复应以实际滚动宿主为观察生命周期，切换时断开旧节点、观察新节点并立即测量，覆盖双向交互/静态切换、同实例 SVG 更新与后续宽度变化；不要通过重挂整个 WikiDiagram/3D 场景或删掉横滚提示来规避。保留现有 DiagramPlayer 与步骤、滚动位置语义。

## 已验证通过

- 新静态白名单只有 `quantization-intuition`，默认 `allowInteractive=false`，绑定审定 SVG SHA；未知/原型名拒绝，正式图字节变化退回真实静态图。步骤文案和几何已对照现有 YAML，未新增算例或改正文。
- 5 文件 / 19 测试 exit 0（`interactive-diagrams`、`WikiDiagram`、`WikiPage`、`EvidencePane`、`ReviewPane`），独立生产构建 exit 0；`tsc -b --noEmit`、只读 Biome 与 `check-deps` exit 0。Biome 对整份既有 CSS 报 19 个 specificity 警告，未称零警告，不作为本轮新增问题。
- API-off、`/nested/`、1440×900 实测：默认总览、四步选择、前后/首尾边界、画布四个按钮、局部键盘、Ctrl+K 共存、多实例独立、锚点跳转保持状态、marker ID 隔离、普通 figure/scene/native-svg 控制样本均通过。图 pin 精确为 61–73（13 行）与 75–125（51 行），仅 1 次证据资源下载；正文右缘 830.8125 <= 面板左缘 893.8125，页面宽 1440。
- 1200px 下非零横滚位置 78px 在右栏开关前后保持，步骤仍为 3；真实 Review HTTP 只读预览显示候选“候选图标记”，两张前后图均无交互工具条和正式证据按钮，Review 仍为 pending。
- 浏览器报告：`1000-react2d-browser/report.json`（前半交互通过；最初预览 locator 错误已由 tail 探针更正，不归因为产品缺陷）、`1000-react2d-tail-verified/report.json`、`1000-react2d-live-wide-red/report.json`。截图已实际打开检查。所有临时 HTTP 与 Chromium 均在 finally 关闭。

## 本次受审字节

| 文件 | SHA-256 |
| --- | --- |
| `src/content/wiki/interactive-diagrams.ts` | `1825d025252874738a3a06e0b923936050ff75c2a90076dfd3c77aa5fcf2c757` |
| `src/content/wiki/QuantizationIntuitionInteractive.tsx` | `ced7c68b032bc16002745a8cd775e7a3be34976db934d3ecf7e8cf10ae756bc7` |
| `src/content/wiki/interactive-diagrams.test.ts` | `d2539d479f9c8a3708fe3555104d93a38e27304bf51e31d1104dcd9e69d2a79f` |
| `src/content/wiki/WikiDiagram.tsx` | `b560f4fd3023a91883ab52e3d7ef8be36977880e4acc21284d9ce738d2d6f0e3` |
| `src/app/pages/WikiPage.tsx` | `56ac1e600c16826b4f61b2c5fde0dea709738c92e075c8584e5c8b04f46c3aa6` |
| `src/design/wiki.css` | `e80c95f31e618054ab1dd6ec89c42a1fc0a96d67b92a759c0862158cde9e54ae` |

只在隔离副本验收；正式文章/候选、原缓存、旧 Review、3D 和现有服务未改。按用户 969/993/996，文章整改全留第二阶段；本子批修复完成后继续第一阶段剩余工程，最终签署后停止派工。
