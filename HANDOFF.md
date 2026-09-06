# 交接说明（2026-09-06 晚重写；新会话先读这一页，再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`）

## 现状（一句话）

底层扎实，用户能看的画面刚刚重来：唯一给用户看的入口是 **`#/model`**（一个模型 = 一个 3D 物体，静帧第一版），正在等用户批准这张图。`#/lab`（21 步分别构图 + 右栏长文）被用户整体否定，保留代码但**不要再给用户看、不要再往上加东西**；`#/dev/*` 是工程验收页，同样不给用户看。

## 已确认决策（不要再问）

- 产品单元是**一个模型的整体 3D 结构**（bbycroft 式）：Qwen3-0.6B 全部 28 层是一个物体，第 0 层展开，其余层折成薄片；教学步骤以后是这个物体里的镜头位置，不是独立画面。它同时就是模型工作台的"粘贴 config → 3D 结构"。
- 视觉：暖白纸面页面 + 深色左栏 + 白卡片 3D 画布（`scene-*` 已是浅色）；块 = 身份色淡填充 + 同色实线边，**不逐值着色**；边长 ∝ √元素数，全模型一把尺；标签平放在地面，屏幕上小于 9px 的字自动隐藏。
- 文字：右栏长文砍掉，画面里只有名字 + 形状，细节在悬停条。
- 流程：**先出静帧给用户批准，批准前不写动效**；用户在 `http://localhost:5173/#/model` 热更新实时看。
- 数据：真实 trace 已生成（`src/sim/model/traces/*.trace.json`，Qwen3-0.6B ONNX q8 贪心 12 token，脚本 `pnpm gen:trace`，Node 需 `NODE_USE_ENV_PROXY=1`），UI 尚未使用。
- 其余历史决策（技术栈、事实基线、硬件、真实尺寸、哈希权重、工作台范围）见 `C:\Users\-\.claude\plans\shimmering-zooming-scroll.md` 与记忆目录，本文件不重复。

## 代码地图（只列会碰的）

| 位置 | 作用 |
|---|---|
| `src/viz3d/model/layout.ts` | ModelSpec → 块布局（纯函数，6 个测试）。流向沿 −z（近处输入、远处输出），并行分支沿 x |
| `src/viz3d/model/frame.ts` | 包围盒 → 相机位姿（纯函数，2 个测试） |
| `src/viz3d/model/ModelScene.tsx` | 纸面块、平放标签、层叠薄片、组底板、镜头飞行、标签 LOD、OrbitControls |
| `src/app/pages/ModelPage.tsx` | `#/model` 页：左栏结构目录、四个视图按钮、悬停条、模型切换（0.6B / 8B） |
| `tests/model.spec.ts` | 四个视图截图 + 悬停断言，图在 `test-results/model-*.png` |
| `src/sim/**` | 模型解析、21 步前向、硬件映射、预设句、trace（全部有测试，不动） |
| `src/timeline/**` | 播放引擎 + Worker（可复用，暂未接到 `#/model`） |

## 下一步（按序）

1. 用户对 `#/model` 静帧的反馈 → 改到批准为止（只改画面纪律，不加功能）。
2. 批准后：在这个物体里加第一段动效（建议 X·W_q → Q，3B1B 式行×列→格），仍先给一帧再给动。
3. 再后：AnimatedLLM 式 token 生成条（用真实 trace）、镜头沿计算路径的步骤导航、硬件层。

## 验证基线（2026-09-06 晚）

`pnpm check` 168/168；`pnpm build` 通过；`pnpm test:e2e` 8/8。UI 改动必须看截图（troika 的字形块问题只有截图能发现）。
