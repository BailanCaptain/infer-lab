---
name: infer-lab
description: 大模型推理可视化实验室（vLLM-Ascend 主线）的设计真相源。frontmatter 是机器可读 token，正文是应用规则。改视觉先改 src/design/tokens.css 与本文件，禁止在组件里造色。
mode: light-only
visual-density: 5
motion-intensity: 3
colors:
  canvas: "#f5f2ea"
  surface: "#fbfaf6"
  surface-elevated: "#ffffff"
  surface-sunken: "#ece9df"
  line: "#d8d8cf"
  ink: "#17211f"
  ink-muted: "#66716d"
  ink-faint: "#8a928f"
  rail: "#17211f"
  accent: "#e85b32"
  token: "#087f73"
  weight: "#c78300"
  kv: "#4c65b6"
  comm: "#9a4b86"
  control: "#66716d"
  danger: "#b54237"
  tp: "#4ea3f5"
  pp: "#f5a54e"
  dp: "#5ecf7a"
  ep: "#c774f2"
  cp: "#3ec9d9"
  pcp: "#f08a3c"
  dcp: "#e458c8"
typography:
  display: { fontFamily: "Inter 800 / Noto Sans SC 900", letterSpacing: "-0.04em" }
  body: { fontFamily: "Inter / Noto Sans SC", fontSize: 14px, lineHeight: 22px }
  label: { fontFamily: "Inter / Noto Sans SC", fontSize: 12px, lineHeight: 16px, fontWeight: 500 }
  caption: { fontSize: 11px, lineHeight: 15px }
  micro: { fontSize: 10px, lineHeight: 14px, fontWeight: 500 }
  mono: { fontFamily: "JetBrains Mono / Consolas", fontSize: 13px }
rounded:
  field: 10px
  card: 16px
  panel: 24px
  floating: 24px
---

# infer-lab 设计真相源

## Overview

这是一台可拆开、可播放、可调参的推理系统，不是概念卡片集。学习者始终看到同一批 token 从请求进入，经过模型层与硬件层，最终流出答案。章节只改变观察尺度，不改变对象身份。

气质（2026-09-06 用户改定）：**浅色暖底的学习图谱**，沿用上一版 infra-view 的页面风格与字体：暖白纸面、白卡片、很重的显示体标题、橙色唯一行动色；左侧课程轨道是页面里的**深色内嵌面板**（ink），不做全深色。密度中等（5），动效只做叙事性与反馈性（3）。light-only。

## Colors

一切颜色来自 `src/design/tokens.css` 的 `@theme`。组件里只写语义 token 类（`bg-surface`、`text-token`、`border-line`），禁裸 hex/rgba。

- **Accent（橙）是唯一行动色**：当前步骤、播放头、主按钮、焦点环、正文中与当前步联动的高亮。一屏一个主行动。
- **对象身份色**：Token/激活 = 青，权重 = 暖金，KV Cache = 蓝，通信/collective = 紫，控制面/调度 = 灰，错误/禁配 = 红。同一对象在正文与图中颜色一致；概念身份与健康状态不复用颜色。
- **并行维度色**：TP 蓝、PP 橙、DP 绿、EP 紫、CP 青、PCP 橙、DCP 品红；rank 轮转 R0 红 / R1 绿 / R2 蓝 / R3 黄（沿用并行策略图片包）。
- **证据等级色**：官方 `[S]` 绿、源码 `[C]` 蓝、推导 `[D]` 青、假设 `[A]` 金、推断 `[I]` 黄、实测 `[M]` 紫、冲突 `[!]` 红。
- 表面四档做层次（sunken < canvas < surface < elevated），平面之间靠表面档位与 1px 线区分，投影只给卡片（`shadow-card`）与主按钮光晕。
- 深色内嵌面板只有一处：课程轨道（`rail-*`）。

## Typography

Inter + Noto Sans SC（自托管），代码与数字 JetBrains Mono。

- 字阶 `micro(10) < caption(11) < label(12) < compact(13) < body(14) < lead(16) < title(20) < display(34) < hero(48)`。**10px 是地板**。禁止 `text-[Npx]`。
- 显示体（`.display`）：Inter 800 / Noto Sans SC 900，字距 −0.04em，只用于章节标题与首屏。眉题（`.eyebrow`）：橙色等宽大写 10px，`CH.03 · MODEL LAYER`。
- **等宽 = 机器可核对的事实**（shape、公式、rank、字节、来源号），**比例字体 = 解释性叙述**。所有数字 `tabular-nums`。
- 层级靠字重与颜色（ink / ink-muted / ink-faint 三档），不靠猛加字号。
- 术语中英并存：Prefill、Decode、KV Cache、Rank、HBM 等保留英文，首次出现给中文解释并可悬停查词条。

## Layout

- 章节页：左课程轨道 248px 深色固定；顶栏 54px 毛玻璃（面包屑 + 动作）；内容区 `min(1360px, 100%)` 居中；实验区 = 白色控制/播放条 + 画布容器（圆角 panel）；解读栏 380px 或落在画布下方。画布内容的表现形式待定，见 `PLAN.md` §2.4。
- 播放条固定在画布容器内底部 56px，不覆盖画布内容。
- 4px 基线；组件内 gap 8、块间 12、卡片内边距 14、面板 16。
- 窄于 1024px 纵向堆叠：画布 4:3 + 播放条 sticky，右栏变底部抽屉。

## Elevation & Depth

层次优先靠表面档位与 1px 线。卡片 `shadow-card`（极轻）、浮层 `shadow-floating`、主按钮 `shadow-glow`。禁冷黑投影、禁霓虹大屏、禁玻璃拟态、禁满屏渐变。

## Shapes

圆角：field 10 / card 16 / panel 24。禁 `rounded-[Npx]`。

## Components

- **按钮**：主 CTA = accent 底深色字 + `hover:accent-hover` + `active:scale-[0.97]`；次要 = surface-elevated 底 line 边；禁用 = 去光晕降对比。
- **播放器**：播放/上一步/下一步/进度 scrubber（带 step 刻度与 beat 标记）/倍速/当前步标题。Space 播停，←/→ 步进，Esc 重置视角。
- **图标**：lucide-react 一个家族；emoji 不当结构图标。
- **焦点**：全局 `:focus-visible` 2px accent 环；禁裸 `outline-none`。
- **加载/空态**：>300ms 给 skeleton；空态教下一步。
- **动效**：150–300ms，只动 transform/opacity；`prefers-reduced-motion` 与 `?nofx=1` 下停止循环动画、过渡直接到终态。

## 画面纪律（待定）

### 当前开篇：大模型推理之旅 · 城市背景（2026-09-06）

用户用新的服务器城市参考图替换山境，并明确强调性能。最新要求保留城市背景，恢复上一版「云隐」朱印、宋体「大模型推理之旅」标题、英文副标题与左侧十章目录。手机上直接显示目录，目录内容复用 `src/app/intro/world.json`。城市色彩、镜头与建筑数据真相源为 `src/app/intro/city.json`。移除悬浮地标、点击拾取、镜头拉近和详情面板；目录仅静态展示，保留手动旋转/缩放及环游。

性能规则：立面灯光使用图集，网页模型按材质合并，DPR ≤ 1.25 且绘图缓冲 ≤ 250 万像素、一个静态阴影图、按需 RAF，空闲不绘制；手动拖动跟随浏览器刷新，只有主动环游 ≤ 30 FPS（保留计时余数）。默认镜头距离已增加 25%。设备能力和软件渲染环境要区分，不能把目标帧率写成实测帧率。模型预算和性能验收见 `tests/intro.spec.ts`，建模流程见 `assets/city/README.md`。

### 上一版开篇山境（保留记录，非当前首页）

本次用户提供云海悬山与山门参考图，并明确要求 Blender + Three.js 的开篇展示。该授权用于首页风景建模；下面教学表现层的画面纪律仍待定。

- 首页使用参考图的暖灰底、宋体标题、朱砂印章、青灰飞檐与左侧十境目录。场景是可旋转的完整几何；不将参考图贴作假三维背景。
- `src/app/intro/world.json` 是篇章、位置、材质色的单一来源，Blender 生成脚本和 Three.js 共同读取。首页 DOM 从该源传入 CSS 变量，辅助文字与分隔线复用全局 token。
- 默认静止总览，手动拖动旋转、滚轮缩放、点击目录或山门定位；环游由用户主动开启。减少动态效果和 `?nofx=1` 停止环游，定位直接抵达。
- 十境是开篇导览分类，不代表现有 22 章正文已经实现；点击显示导览并定位山门。

原「3D 场景语法」一节已随 3D 代码删除（2026-09-06）。表现层重建前必须先完成 `PLAN.md` 的 Spike S1，把画面纪律写回这里并经用户确认，才能写画面代码。已知的硬约束：看得见矩阵维度、切分、计算与聚合；画布内只放短标签，长文进画布外 DOM；禁止平铺立方体阵列、伪 3D 流程图、光点在方块间移动、为动画虚构流程；若一个画面可以用「一个方块 + 一个标签」完整替代，视为未达标。

## Do's and Don'ts

- Do：改色改字改圆角先来本文件 + tokens.css；组件里只写语义 token 类。
- Do：新颜色先问「这是对象身份、并行维度、证据等级还是状态」，再选族。
- Do：每个可调参数都要有量化后果（shape、字节、FLOPs、通信量）。
- Don't：用户可见文案禁用 em-dash，用句号/逗号/顿号重写。
- Don't：不引第二个图标库、不手绘 SVG 图标、不用纯 #000/#fff。
- Don't：不为动画效果虚构技术流程；性能方向性结论只能来自 `[S]`/`[M]`。
