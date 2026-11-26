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
  body: { fontFamily: "Inter / Noto Sans SC", fontSize: 16px, lineHeight: 26px }
  prose: { fontFamily: "Inter / Noto Sans SC", fontSize: 18px, lineHeight: 34px }
  label: { fontFamily: "Inter / Noto Sans SC", fontSize: 14px, lineHeight: 22px, fontWeight: 500 }
  caption: { fontSize: 13px, lineHeight: 20px }
  micro: { fontSize: 12px, lineHeight: 18px, fontWeight: 500 }
  mono: { fontFamily: "JetBrains Mono / Consolas，中文回退 Noto Sans SC", fontSize: 15px }
rounded:
  field: 10px
  card: 16px
  panel: 24px
  floating: 24px
---

# infer-lab 设计真相源

本文件的 YAML frontmatter 是机器可读视觉令牌，与 `src/design/tokens.css` 保持单一真相源一致；组件只使用语义 token，禁止散落裸色值或高饱和冷调霓虹色。

## 1. 整体气质与色彩语义（Warm-Mineral Light Mode）

- **暖白纸面基座**：画布 `#f5f2ea`、阅读纸面 `#fbfaf6`、浮起卡片 `#ffffff`、下沉槽位 `#ece9df`、暖灰分隔线 `#d8d8cf`，主墨色 `#17211f`、次级文字 `#66716d`。
- **唯一行动色**：Accent 陶橙 `#e85b32`（主按钮、播放头、焦点环、当前步骤联动高亮）。
- **对象身份色（正文、工作台、2D SVG 与 3D 统一）**：
  - Token / 激活 / 通过态：青 `#087f73`（浅底 `#ddf4ef`、深字 `#065f56`）
  - 权重 / 计算单元：琥珀 `#c78300`（浅底 `#fff4cf`、深字 `#936300`）
  - KV Cache / 显存层级：靛蓝 `#4c65b6`（浅底 `#e8edff`、深字 `#3a4f93`）
  - 集合通信 / 跨卡传输：梅紫 `#9a4b86`（浅底 `#f7e7f2`、深字 `#7a3a6a`）
  - 控制面 / 调度：暖灰 `#66716d`
  - 错误 / 禁配 / 退化瓶颈：陶红 `#b54237`（浅底 `#fff0e9`、深字 `#8f3229`）
- **并行维度与证据等级色**：TP 蓝、PP 橙、DP 绿、EP 紫、CP 青、PCP 橙、DCP 品红；证据等级 `[S]` 绿、`[C]` 蓝、`[D]` 青、`[A]` 金、`[I]` 黄、`[M]` 紫、`[!]` 红。

## 2. 阅读字阶与响应式版式

- **字体栈**：正文与界面统一 `Inter` + `Noto Sans SC`（自托管于 `public/experiences/font-families.css`），代码、形状与可核对数值统一 `JetBrains Mono`（`tabular-nums`）。
- **阅读字阶**：长文阅读与问答 `18px / 34px`（`prose`），导语/表格/输入框 `16px`，目录主项 `16px`、文章链接 `15px`、分组说明 `14px`，辅助说明 `13px`，次要短编号 `12px`（`micro`）。
- **阅读主站布局（`src/design/wiki.css`）**：桌面正文最大宽度 `--wiki-measure: 1200px`，右侧本页目录宽 `220px`（间距 `32px`）；打开右侧问答/证据侧栏时推挤正文并支持拖拽调宽；窄屏与移动端（`390px`）自动收起侧栏，宽表格、超宽代码块与单行长公式在自身容器内横向滚动，严禁撑出整页横向滚动条。

## 3. 双层 2D 教学图、工程工作台与 3D 场景规范

- **`PLATE` 立体拆解剖面与趣味微缩场景图（`public/wiki-illustrations/*.webp` + `native-svg`）**：现有 42 张透明去底紧裁 `.webp` 插画直接浮于 `.wiki-diagram` 暖纸面上，外层采用高清矢量圆点引线与开放式中文编号直标，位图内部禁止塞中文小字。
- **`FIG` 因景制宜机制矢量图（`layout: figure` 或 `mode: native-svg`）**：画布宽度推荐 `860–900px`（硬上限 `<= 900px`），分栏标题 `16px`、主标签 `14–15px`、辅助说明 `>=12.5px`、次要短标 `>=12px`（由 `pnpm wiki:svg-geometry` 守护）；按机制本质选用泳道时间轴、比例张量格网、真实比例瀑布条/坐标曲线、硬件端口拓扑或开放状态机，严禁外层大底框或套框卡片八股。
- **「部署与排障」五套工程工作台（`/#/tools`，`src/design/tools.css`）**：估算要几张卡（部署计算器）、检查启动命令（配置体检）、分析报错日志（在线排障）、芯片算子沙盘（AI Core 实验室）与生产故障通关场共享统一卡片圆角（`16px`）、1px 暖色细线与轻量阴影。
- **首页城市与 17 篇 `wiki-scene` 交互 3D**：首页城市模型保持 `DPR <= 1.25`、按需绘制与悬停按钮暂停优化；知识页内嵌 3D 与模型/硬件探索遵守 [教学 3D 标准](docs/3d-teaching-standard.md)。
