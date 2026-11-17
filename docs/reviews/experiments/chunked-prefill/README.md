# Chunked Prefill 教学实验稿归档说明

本目录归档了围绕 [Chunked prefill 正式页](../../../../wiki/concepts/chunked-prefill.md) 开展的多版本教学与认知阶梯对照实验稿及其专属 2D 图表素材，以便从正式发布区（`wiki/concepts/` 与 `wiki/diagrams/`）移出后，仍完整保留历史探索与可追溯的对照索引。

## 1. 归档文稿清单

| 归档文件 | 原路径 | 定位与特点 | 内嵌图表 / 3D 场景 |
|---|---|---|---|
| [chunked-prefill-v2.md](chunked-prefill-v2.md) | `wiki/concepts/chunked-prefill-v2.md` | 早期循序渐进重写样板（含 36 处代码锚点 `[C1]`–`[C36]`、四版本对照表） | 专属图 [`diagrams/chunked-prefill-intuition-v2.yaml`](diagrams/chunked-prefill-intuition-v2.yaml)（[.svg](diagrams/chunked-prefill-intuition-v2.svg)）、正式共用图 [`../../../../wiki/diagrams/chunked-prefill-flow.yaml`](../../../../wiki/diagrams/chunked-prefill-flow.yaml)（[.svg](../../../../wiki/diagrams/chunked-prefill-flow.svg)） |
| [chunked-prefill-v3.md](chunked-prefill-v3.md) | `wiki/concepts/chunked-prefill-v3.md` | 机制主线精简对照版（聚焦预算减法、跨段状态续接与 GLM 20,000 token 三步拆解） | 专属图 [`diagrams/chunked-prefill-v3-compare.yaml`](diagrams/chunked-prefill-v3-compare.yaml)（[.svg](diagrams/chunked-prefill-v3-compare.svg)）、3D 场景 `inference-mechanism:7` |
| [chunked-prefill-agy.md](chunked-prefill-agy.md) | `wiki/concepts/chunked-prefill-agy.md` | 重构对照版（结合 `v3` 首屏直觉对比与 `v2` 完整源码证据及四版本矩阵） | 专属图 [`diagrams/chunked-prefill-v3-compare.yaml`](diagrams/chunked-prefill-v3-compare.yaml)（[.svg](diagrams/chunked-prefill-v3-compare.svg)）、正式共用图 [`../../../../wiki/diagrams/chunked-prefill-flow.yaml`](../../../../wiki/diagrams/chunked-prefill-flow.yaml)（[.svg](../../../../wiki/diagrams/chunked-prefill-flow.svg)）、3D 场景 `inference-mechanism:7` |
| [chunked-prefill-free.md](chunked-prefill-free.md) | `wiki/concepts/chunked-prefill-free.md` | 自由结构探索稿（按“不切 vs 切开”时间线与 KV 缓存跨步续写展开） | 专属图 [`diagrams/chunked-prefill-free-timeline.yaml`](diagrams/chunked-prefill-free-timeline.yaml)（[.svg](diagrams/chunked-prefill-free-timeline.svg)）、[`diagrams/chunked-prefill-free-kv.yaml`](diagrams/chunked-prefill-free-kv.yaml)（[.svg](diagrams/chunked-prefill-free-kv.svg)） |

## 2. 专属 2D 图表素材（已随实验稿归档至 [`diagrams/`](diagrams/)）

以下 4 组（共 8 个 `.yaml` + `.svg` 文件）仅被上述实验稿引用，不参与正式页构建：

- [`diagrams/chunked-prefill-intuition-v2.yaml`](diagrams/chunked-prefill-intuition-v2.yaml) / [`diagrams/chunked-prefill-intuition-v2.svg`](diagrams/chunked-prefill-intuition-v2.svg)（由 `chunked-prefill-v2.md` 引用）
- [`diagrams/chunked-prefill-v3-compare.yaml`](diagrams/chunked-prefill-v3-compare.yaml) / [`diagrams/chunked-prefill-v3-compare.svg`](diagrams/chunked-prefill-v3-compare.svg)（由 `chunked-prefill-v3.md` 与 `chunked-prefill-agy.md` 引用）
- [`diagrams/chunked-prefill-free-timeline.yaml`](diagrams/chunked-prefill-free-timeline.yaml) / [`diagrams/chunked-prefill-free-timeline.svg`](diagrams/chunked-prefill-free-timeline.svg)（由 `chunked-prefill-free.md` 引用）
- [`diagrams/chunked-prefill-free-kv.yaml`](diagrams/chunked-prefill-free-kv.yaml) / [`diagrams/chunked-prefill-free-kv.svg`](diagrams/chunked-prefill-free-kv.svg)（由 `chunked-prefill-free.md` 引用）

## 3. 保留在正式目录的共用资源

以下资源仍由正式页 [`wiki/concepts/chunked-prefill.md`](../../../../wiki/concepts/chunked-prefill.md) 正常使用，保留在原位置不动：

- 正式 2D 图：[`wiki/diagrams/chunked-prefill.yaml`](../../../../wiki/diagrams/chunked-prefill.yaml)（[.svg](../../../../wiki/diagrams/chunked-prefill.svg)）、[`wiki/diagrams/chunked-prefill-flow.yaml`](../../../../wiki/diagrams/chunked-prefill-flow.yaml)（[.svg](../../../../wiki/diagrams/chunked-prefill-flow.svg)）
- 3D 场景：`inference-mechanism:7`（入口位于 `src/app/wiki/WikiScene.tsx:64`，课程配置位于 `src/app/wiki/scene-lessons.ts:46-60`、`src/app/wiki/scene-inference.ts:86-90` 与 `src/app/wiki/scene-optimization.ts:78-100`，按 3D 冻结策略保持不变）
