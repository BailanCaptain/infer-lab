# 交接说明（2026-09-06 深夜重写；新会话先读这一页，再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`）

## 现状（一句话）

**只剩地基，没有任何教学画面。** 2026-09-06 用户把我做的全部 3D 画面（`src/viz3d/`、`#/lab`、`#/model`、Spike A/B 页、3D 字体子集、three.js 依赖）整体删除（提交见 `git log`，可找回但不要找回）。原因：三版画面都被否——"幻灯片"、"怎么能这么丑"、"平片图/一坨屎"。地基（`src/sim/`、`src/timeline/`、页面配色字体、播放条）完整保留，全部测试通过。

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
- **画面怎么做还没有定，而且不许再由 AI 自作主张地"先做一版看看"**：用户对三版画面的否定都指向同一点——我画的是示意图，不是物体。下一次动画面之前，先和用户一起用参照物截图逐条定"画面纪律"，拿到明确的 yes 再写代码；先出静帧，批准前不写动效。
- 其余历史决策（技术栈、事实基线、硬件、工作台范围）见 `C:\Users\-\.claude\plans\shimmering-zooming-scroll.md` 与记忆目录。

## 下一步

1. 和用户一起定画面纪律（参照物：bbycroft.net/llm、poloclub Transformer Explainer、animatedllm.github.io、3B1B 矩阵动画）。没定之前不写任何画面代码。
2. 定了之后从一个最小对象开始（例如一个 [6,1024] 激活的真格子），只交一张图。
3. 与画面无关、可先做的：AnimatedLLM 式 token 生成条（纯 DOM，用真实 trace）；模型工作台的数字部分（参数量、KV 显存）。是否先做由用户定。

## 验证基线（2026-09-06 深夜，删除 3D 之后）

`pnpm check` 126/126（12 个测试文件）；`pnpm build` 通过；`pnpm test:e2e` 3/3（只剩 spike-c）。
