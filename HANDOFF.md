> LLM WIKI 已合入本仓库 `main`，新会话先读 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)。以下保留首页 / 城市背景等其他工作的历史项目背景，其中的旧 Wiki 状态已过期。

# 交接说明（主干：首页与教学表现层）

## 当前开篇：大模型推理之旅 · 城市背景

用户随后提供新的服务器城市参考图，要求换风格，并强调性能。首页已切换为 `src/app/intro/cityScene.ts` + `src/design/city.css`：GPU / NPU 地标、服务器楼群、互联高架、海湾与观景台。源文件是 `assets/city/compute-city.blend`，网页只加载 `public/models/compute-city.glb`；配置真相源是 `src/app/intro/city.json`。建模与性能约定见 `assets/city/README.md`。用户最新要求恢复上一版「云隐 / 大模型推理之旅」标题和左侧十章目录（复用 `world.json`），保留城市背景；已移除悬浮地标、点击拾取、镜头拉近和硬件详情面板。目录仅静态展示，手动旋转/缩放与环游保留。最新性能修复：移除手动拖动的 30 FPS 节流，自动环游独立限帧；绘图缓冲最多 250 万像素；默认镜头距离增加 25%，JSON 与 Blender 源相机已同步。教学表现层仍待定。

## 上一版：开篇山境（本地草稿，未纳入当前版本）

用户最初提供云海悬山参考图，授权 Blender + Three.js 开篇。该版源文件、模型及生成脚本仅在原工作区保留，未纳入当前城市版本；全新检出无需这些草稿。当前首页复用已提交的 `src/app/intro/world.json` 中的十章目录。

新会话读这一页了解**现在在哪**，读 `PLAN.md` 了解**要去哪**（总体大纲：22 章、工作台、架构、M1 任务表、里程碑），再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`。

## 现状（一句话）

**首页与教学表现层的下述记录保留历史背景；LLM WIKI F001–F005 已完成并合入 `main`，当前知识库状态见 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)。** 2026-09-06 用户把我做的全部 3D 画面（`src/viz3d/`、`#/lab`、`#/model`、Spike A/B 页、3D 字体子集、three.js 依赖）整体删除（提交见 `git log`，可找回但不要找回）。原因：三版画面都被否："幻灯片"、"怎么能这么丑"、"平片图/一坨屎"。地基（`src/sim/`、`src/timeline/`、页面配色字体、播放条）完整保留，全部测试通过。

## 知识库 F001–F005（已合入 main）

**这一节不维护知识库的状态。** 验收状态看 `docs/features/F001-llm-wiki.md`–`F005-wiki-drop.md` 各自的验收表；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)；页数、预算、待审数这类会变的数字按它 §2 的命令现查；实际花费以 `pnpm wiki:budget status` 为准。设计依据与历史发现留在五份 feature 和 `docs/plans/`，09-10 至 09-18 的逐轮报告在 [docs/plans/archive/](docs/plans/archive/README.md)。

**目标**：agent 写、人只审、进 git 的课程知识库，学习者在 `#/wiki` 问名词就有基于知识库的回答。规则唯一真相源是 [wiki/HANDBOOK.md](wiki/HANDBOOK.md)，按六个二级标题切片注入不同角色的 agent（映射表在 `scripts/wiki/handbook.ts:9`）。命令清单见 `package.json` 的 `wiki:*` 脚本。

**踩过的坑，别再踩**

- `--allowedTools` 在 `-p` 无人值守模式下是**白名单**不是免确认表。放开联网要两步：从黑名单拿掉、往白名单加上，只做前者等于没做。
- 越界守卫只删**本批新建**的文件。它曾把 `wiki/HANDBOOK.md`（规则唯一真相源）当越界写入删掉，并让 11 个正常 agent 全判失败——那次改动来自引擎外部，agent 根本没有写它的权限。
- **`TaskStop` 只杀外层 shell，`claude.exe` 子进程会活下来继续写文件**。要停 ingest 用 `taskkill /pid <pnpm 的 pid> /t /f`。
- 定性规则（「只留三类」「删到合理密度」）实测不落地，**换成硬指标并由引擎算好数字写进任务**才有效——标记数与事实表行数都是这么治住的。
- 整合 agent 没有 `--add-dir` 也不能联网，它只读草稿与现有页。所以它能发现**页与页之间的矛盾**，发现不了**页与源码之间的偏差**（实测漏掉一处过度概括）。要抓后者得扩 `wiki:audit` 或加一个能读源码的核对角色。
- 正文不走 `rehype-raw`：裸 HTML 标签与 `<!-- 注释 -->` 都会原样显示在页面上。`stray-tag` 规则管这个。
- 别用 python heredoc 写含 `\n` 的 TS——反斜杠会被吃掉，正则和字符串都会断。用 Edit 工具。

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

知识库 F001 走的是独立分支，不受 Spike S1 阻塞；术语注册表（PLAN 任务 10 需要的 `<Term id>` 数据源）已由它的 `src/content/wiki/registry.json` 提供，不必另建 terms 表。

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
- `tools/repos/`（wiki 的来源仓库浅克隆，已 gitignore）：删了可以用 `pnpm wiki:clone` 重建，但要重新下载；里面是只读的上游代码，任何情况下不要在其中改动或提交。
- 空目录 `src/viz2d/`、`src/content/` 是分层占位，`scripts/check-deps.ts` 的层序引用它们，别删。

## 验证基线

- main（2026-09-06 深夜，删除 3D 之后）：`pnpm check` 126/126（12 个测试文件）；`pnpm build` 通过；`pnpm test:e2e` 3/3（只剩 spike-c）。
- `feat/llm-wiki`（2026-09-07）：`pnpm check` 168/168（20 个测试文件）；`pnpm build` 通过；`pnpm wiki:lint` 与 `pnpm wiki:audit` 通过；`pnpm wiki:build` 幂等。
