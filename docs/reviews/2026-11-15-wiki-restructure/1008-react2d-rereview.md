# 987 / 1008 人工注册 React 2D 独立终验

2026-11-16 19:28 UTC。**Approved，0 P1 / 0 P2**。关闭 `1000-react2d-review.md` 的滚动宿主观察器 P2；只批准原 Task 045 的 React 2D 子批，不代表 Task 045 或第一阶段全部完成。作者烁烁；独立检视砚砚 / gpt-6-astra。HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 加当前 WIP。

## 修复与实测

`WikiDiagram.tsx` 以实际 DOM 的稳定 callback ref 绑定/解除观察器，并在同一宿主内部 `safe` SVG 替换后重绑子节点；切换时立即测量，状态未变时不通知。旧观察器在解绑/卸载时断开。原 `DiagramPlayer` 仍取得同一个实例的宿主引用；没有重挂整个 WikiDiagram、3D 或重写播放器。交互组件 `scrollRef` 的类型同步接纳 callback ref。

- root 隔离生产构建 `987-root-react2d-build.mts --build-existing` exit 0，构建完成于 19:21:57 UTC，日志 `1008-react2d-root-build.log`。
- 原 Chromium 反例：`1000-react2d-tail.mts 1008-react2d-root-green --wide-live` exit 0。同 ID 新 SVG 的真实阅读器刷新后，1920px 的滚动宿主 `1166 / 1166`、无提示/无额外 tabindex；1200px 下 `802 / 880`、余量 78、`tabindex=0`、提示可见。原红灯的两个方向均转绿。
- 同一浏览器运行同时验证：Review 两张候选前后图保留“候选图标记”、无正式交互组件/证据按钮、Review 仍 pending；右栏打开/关闭时非零横滚 78px 和步骤 3 保留；新版 SVG 静态回退正确；`pageErrors=[]`。报告 `1008-react2d-root-green/report.json`，已实际打开其窄窗截图。临时 HTTP 与 Chromium 已关闭。
- root 定向回归：`interactive-diagrams.test.ts`、`WikiDiagram.test.ts`、`WikiPage.test.ts`、`EvidencePane.test.tsx`、`ReviewPane.test.tsx`，**5 文件 / 20 项通过**，日志 `1008-react2d-root-tests.log`。新增用例覆盖双向宿主切换、同宿主更换 SVG 子节点、横滚到末尾与卸载断连。测试随后仅修正 FakeHost 泛型和 import 排版，断言未变；最终字节 `tsc -b tsconfig.json --noEmit`、只读 Biome 3 文件、`check-deps.ts` 全部 exit 0。
- 沿用 `1000-react2d-review.md` 已完成的 1440px 四步、局部键盘、Cmd/Ctrl+K 共存、双实例、图 pins、普通 figure/scene/native-svg、无几何重叠等独立实测；不重复把未改区域当新交付。

## 最终受审文件

| 文件 | SHA-256 |
| --- | --- |
| `src/content/wiki/interactive-diagrams.ts` | `1825d025252874738a3a06e0b923936050ff75c2a90076dfd3c77aa5fcf2c757` |
| `src/content/wiki/QuantizationIntuitionInteractive.tsx` | `17a11e2ea577fddc513493099ae94d8d81d5bd51706a17259b4b9a2114e77447` |
| `src/content/wiki/interactive-diagrams.test.ts` | `d2539d479f9c8a3708fe3555104d93a38e27304bf51e31d1104dcd9e69d2a79f` |
| `src/content/wiki/WikiDiagram.tsx` | `08aaf5d595eb2ef3b335bfa4a211bd018c04b20b08b2a8e8d05872ea34e32c52` |
| `src/content/wiki/WikiDiagram.test.ts` | `da90e491801e91612ff9d19db33a832bd26d8b58047cc72c018fe7f9ab0c67cb` |
| `src/app/pages/WikiPage.tsx` | `56ac1e600c16826b4f61b2c5fde0dea709738c92e075c8584e5c8b04f46c3aa6` |
| `src/design/wiki.css` | `e80c95f31e618054ab1dd6ec89c42a1fc0a96d67b92a759c0862158cde9e54ae` |

第一阶段继续完成既定阅读交互尾项、044 工程与四类全流程独立验收。文章整改和新产品继续留待，最终由砚砚签署后停止派工并保留服务；不以本子批 Approved 冒充阶段一或全方案完成。
