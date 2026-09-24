> LLM WIKI 新会话请先读 [最新交接](C:/Users/-/Desktop/infra-view-new-llm-wiki/HANDOFF-LLM-WIKI.md)，并在 `C:/Users/-/Desktop/infra-view-new-llm-wiki` 的 `feat/llm-wiki` 工作树继续。此 main 工作区不是 Wiki 当前实现；以下项目背景保留。

# 交接说明（2026-09-06 深夜重写）

## 当前开篇：大模型推理之旅 · 城市背景

用户随后提供新的服务器城市参考图，要求换风格，并强调性能。首页已切换为 `src/app/intro/cityScene.ts` + `src/design/city.css`：GPU / NPU 地标、服务器楼群、互联高架、海湾与观景台。源文件是 `assets/city/compute-city.blend`，网页只加载 `public/models/compute-city.glb`；配置真相源是 `src/app/intro/city.json`。建模与性能约定见 `assets/city/README.md`。用户最新要求恢复上一版「云隐 / 大模型推理之旅」标题和左侧十章目录（复用 `world.json`），保留城市背景；已移除悬浮地标、点击拾取、镜头拉近和硬件详情面板。目录仅静态展示，手动旋转/缩放与环游保留。最新性能修复：移除手动拖动的 30 FPS 节流，自动环游独立限帧；绘图缓冲最多 250 万像素；默认镜头距离增加 25%，JSON 与 Blender 源相机已同步。教学表现层仍待定。

## 上一版：开篇山境（本地草稿，未纳入当前版本）

用户最初提供云海悬山参考图，授权 Blender + Three.js 开篇。该版源文件、模型及生成脚本仅在原工作区保留，未纳入当前城市版本；全新检出无需这些草稿。当前首页复用已提交的 `src/app/intro/world.json` 中的十章目录。

新会话读这一页了解**现在在哪**，读 `PLAN.md` 了解**要去哪**（总体大纲：22 章、工作台、架构、M1 任务表、里程碑），再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`。

## 现状（一句话）

**只剩地基，没有任何教学画面。** 2026-09-06 用户把我做的全部 3D 画面（`src/viz3d/`、`#/lab`、`#/model`、Spike A/B 页、3D 字体子集、three.js 依赖）整体删除（提交见 `git log`，可找回但不要找回）。原因：三版画面都被否："幻灯片"、"怎么能这么丑"、"平片图/一坨屎"。地基（`src/sim/`、`src/timeline/`、页面配色字体、播放条）完整保留，全部测试通过。

## 地基有什么（全部有测试，不要动）

| 位置 | 作用 |
|---|---|
| `src/sim/modelspec/` | 解析 HF `config.json` → `ModelSpec`（全站唯一形状来源）；内置 Qwen3-0.6B / 8B / 30B-A3B；参数量与 KV 字节分析 |
| `src/sim/model/forwardLayer.ts` | 真实维度的一层前向 21 步（每步中文 brief/detail/公式、lineage、高亮、证据）；权重按哈希惰性生成 `[A01]` |
| `src/sim/hardware/` | 昇腾 910B 概念剖面：13 种算子的驻留/搬运规则，`buildHardwareTimeline` 把硬件层填进每一步 |
| `src/sim/model/presets.ts` | 三句预设句的真实 Qwen3 tokenizer id（生成物，`pnpm gen:presets`） |
| `src/sim/model/traces/` | 真实 Qwen3-0.6B（ONNX q8）贪心生成 12 token 的 top-10 概率 trace `[M]`（`pnpm gen:trace`） |
| `src/timeline/` | 播放引擎：zustand 离散状态 + 瞬态 `progress.t`、Worker 构建时间线、快捷键、URL 深链接、reduced-motion |
| `src/app/PlaybackBar.tsx` | 播放条（DOM，播放期零 commit） |
| `src/app/pages/dev/SpikeCPage.tsx` | 播放引擎验收页 `#/dev/spike-c`（纯 DOM 进度条），Playwright `tests/spike-c.spec.ts` |
| `src/design/tokens.css`、`DESIGN.md` | 暖白纸面 + 深色课程轨道的页面配色、字阶、圆角；无 3D 条目 |

## 已确认决策（不要再问）

- 教学章一律真实模型尺寸（默认 Qwen3-0.6B），`ModelSpec` 唯一形状来源；权重不下载，哈希生成。
- 页面风格：暖白纸面、深色 248px 课程轨道、很重的显示体标题、橙色唯一行动色（沿用旧 infra-view 的观感，不复用其代码）。
- 用户要的体验：Transformer Explainer 的横向流水线总览 + AnimatedLLM 的逐 token 生成与概率分布 + bbycroft 式"一个模型是一个物体、镜头在里面飞"。文字极少，靠悬停。
- **画面怎么做还没有定，而且不许再由 AI 自作主张地"先做一版看看"**：用户对三版画面的否定都指向同一点，就是我画的是示意图，不是物体。下一次动画面之前，先和用户一起用参照物截图逐条定"画面纪律"，拿到明确的 yes 再写代码；先出静帧，批准前不写动效。
- 其余历史决策（技术栈、事实基线、硬件、工作台范围）见 `PLAN.md`（已从 `~/.claude/plans/` 移入仓库并按现状更新）。

## 下一步

阻塞在 `PLAN.md` 的 **Spike S1：定表现层的画面纪律**。和用户一起对着参照物截图定规则，写进 `DESIGN.md` 并经用户确认，才能写画面代码。

不依赖画面选型、可以先做的（是否先做由用户定）：内容管线与 `03` 章正文（PLAN 任务 10、12）、模型工作台页面（任务 13，数字引擎已就绪）。

**暂时没有消费者但保留的代码**（表现层或工作台页面重建后会用到，都有测试，不要当死代码删）：
- `src/sim/timeline/plane.ts` 的 `planeView`：张量到二维视图的轴选择规则。
- `Step.camera`、`Step.beats`：步的镜头与子节拍字段。
- `src/sim/modelspec/analyze.ts` 的 `analyzeParams` / `weightBytes` / `fmtBytes`：工作台数字引擎，等 PLAN 任务 13 的页面。
- `src/sim/model/traces.ts` 的 `GENERATION_TRACES` / `getTrace`：真实生成 trace，等 token 生成条。
- `src/timeline/index.ts` 导出的播放引擎 API：目前只有 `#/dev/spike-c` 一个消费者。

## 工作区约定

- **不是 AI 写的文件一律不动**（用户 2026-09-06 明确要求）。仓库里属于用户的东西：`GLM5_Next_3D_Source.zip`（GLM-5-Next 3D 可视化源码包，含 HTML/OBJ/JSON/shader）、`parallelism-teaching-dark-png.zip` 与 `reference/parallelism-teaching-dark/`（并行策略教学图包）。只报告，不处置。
- 可再生、可随时清的：`dist/`、`test-results/`、`tsconfig.*.tsbuildinfo`（已 gitignore）。
- 重下代价大、不要随手清：`tools/hf-cache/`（598 MB，gen:trace 的模型缓存）、`tools/tokenizer/`（11 MB，gen:presets 的词表）。两者都已 gitignore。
- 空目录 `src/viz2d/`、`src/content/` 是分层占位，`scripts/check-deps.ts` 的层序引用它们，别删。

## 验证基线（2026-09-06 深夜，删除 3D 之后）

`pnpm check` 126/126（12 个测试文件）；`pnpm build` 通过；`pnpm test:e2e` 3/3（只剩 spike-c）。
