# 1018 阅读交互尾项：独立检视

2026-11-16 19:57 UTC，砚砚。范围为 Task 045 两项阅读交互尾项；以用户 969、993、996 为边界，不修改文章。以下结论锁定本页列出的工作区字节，不代表第一阶段整体完成。

结论：**Approved，0 P1 / 0 P2**。

## 审定范围与根因

- ReaderResizeHandle.tsx：原来的结束事件会在任意 keyup 后写入宽度。现在仅有效方向键调整或实际发生位移的拖拽保存测量后的最终宽度；未变化的点击/边界操作不保存，失焦提交尚未结束的键盘调整，双击清除偏好，存储不可用时保留交互能力。
- WikiPage.tsx：跨越桌面断点时清除窄窗目录的临时展开状态；目录分组自身的手动展开集合保留。条件状态更新不更换文章或图组件类型。
- 两个对应测试文件覆盖非调整键、无位移、限宽、方向键与拖拽、失焦、双击、存储异常及断点往返。

| 文件 | SHA-256 |
| --- | --- |
| src/app/wiki/ReaderResizeHandle.tsx | 5e23413c66175baacb6ad1320432d92ba110446ad9d2ab7f8dc76461e4e6016e |
| src/app/wiki/ReaderResizeHandle.test.ts | 847c71f7f07cca77c9d206f23dbed1a5c1759a5f910a87ae0da117ab07a5cb85 |
| src/app/pages/WikiPage.tsx | 2b3dec82230b7a5c21d398b07c0c344327e06338ad1505337f6a0c878e0c802f |
| src/app/pages/WikiPage.test.ts | ccf6825cf3446fcf2ea623b94a02e920c50145ea3fb300f3aab7bb920e12da64 |

## 独立验证

原红灯 1000-reader-interaction-red/report.json 保留，包含无关按键错误写宽度以及 1440 → 1000 手动展开 → 1440 → 1000 后目录残留展开的真实浏览器反例。

root 以当前代码重新构建既有隔离夹具（987-root-react2d-build.mts --build-existing），19:54:50 UTC 完成，exit 0。没有覆盖项目正式构建或运行中的站点服务。

执行原反例脚本 1000-reader-interaction-probe.mts 1018-reader-interaction-root-green，exit 0。真实 Chromium /nested/、API 503、1440×900 下：

- 两侧无关按键均为 0 次保存；目录方向键 240 → 256、拖拽 → 288，右栏 547 → 563 → 595，保存值等于实际列宽。
- 双击分别恢复 240 / 547 并移除偏好；存储抛错时方向键及双击仍可用。
- 断点往返最终窄窗目录收起，手动分组状态保持；13 项检查全通过，errors 为空、closed 为 true。
- reader-after-controls.png 已实际查看，目录、正文和浮动按钮布局正常。

定向回归 ReaderResizeHandle.test.ts、WikiPage.test.ts、WikiDiagram.test.ts、QuickSearch.test.tsx、EvidencePane.test.tsx：5 文件 / 22 测试通过。另单跑正确路径 src/content/wiki/interactive-diagrams.test.ts：4 测试通过（最初命令将其误写为 app/wiki 路径，未将未执行的文件计入前述 22 项）。合计 6 文件 / 26 测试通过。全仓 tsc -b tsconfig.json --noEmit、四个改动文件只读 Biome、scripts/check-deps.ts 均 exit 0。

产物均在 %TEMP%/infra-wiki-review-20261115/：1018-root-p3-tests.log、1018-root-p3-interactive.log、1018-reader-interaction-root-green/。没有整改文章、修改 3D/仿真或重放旧缓存。

## 交接与限制

本检视关闭阅读交互尾项，沿用此前已审的搜索、导航、证据、2D 与整组 Review 基线，不重复宣称这些历史测试是本轮重跑。已完整回读作者交付 1020（0001794859018994-001020-f22e803d）：四文件 SHA 与上表完全一致，作者报告临时句柄为 0；补充的 1017-author-no-remount/report.json 证明实例及步骤/pin 保持，作为作者证据标注，不冒充 root 重跑。

下一工程范围为原 044 的目录/导览、参数展示与稳定身份解耦、AST 工具及只读预演；四类真实样本全流程独立验收仍在进行。阶段一最后签署后停工，第二阶段文章整改及四个独立产品均不启动。未决技术问题：无。
