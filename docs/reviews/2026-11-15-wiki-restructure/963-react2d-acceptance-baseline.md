# 045 人工注册 React 2D：独立验收准备

2026-11-16，砚砚 / gpt-6-astra。仅承接唯一方案 §1.3 / §5.2 / 包 4，记录只读入口与下一短批验收依据；当前仍在收口 `960-native-drop-budget-rereview.md` 的预算搜索边界。本文件不表示 React 2D 已实现，也不是平行总方案。

## 现有入口与可复用样本

- `src/content/wiki/WikiDiagram.tsx` 当前在正向清洗后的 SVG 上挂既有 `DiagramPlayer`，有正式阅读显式提供的图证据回调。未发现人工 React 2D 注册表。
- `src/app/pages/WikiPage.tsx` 的模块级 `WikiFence` 与 `DiagramEvidenceContext` 保持组件类型稳定；新入口不得退回 render 内创建组件的方式，以免开证据面板或跳锚点重挂 3D。
- 可用最小真实样本为 `wiki/diagrams/quantization-intuition.yaml` / `.svg`：既有 880×440 静态图、4 个编号步骤，caption 已说明普通动态 W8A8 Linear 的 BF16 输入路径、离线权重按输出通道/前向激活按行量化，以及缩放系数不进入整数乘加、最终输出 BF16、逻辑步骤不等于实际算子调用次数。仅复用这些已在图中的解释，不新增性能或硬件模拟结论。
- 两条现有 pin 均固定 `vllm-ascend@db701c1f` 的 `w8a8_dynamic.py`：L61–73 的 `weight_scale / weight_offset`，L75–125 的 `npu_dynamic_quant / npu_quant_matmul`。正式图证据继续使用已审 EvidencePane，不创建第二份摘录规则。

## 建议的最小验收范围

1. 人工代码注册至少一个能实际操作的 React 2D 实例，显式导入已审组件；不接受模型提供的代码、模块路径、动态 import 或任意组件名。合法普通静态图不必注册；注册表查找未知项不能执行输入提供的内容。
2. 默认静态总览，读者主动进入手动分步；清楚展示当前步、上一步、下一步与重置。键盘操作、首尾边界与焦点可用。复用现有语义令牌和图说明，不重做 `DiagramPlayer`，不引入自动播放或新物理/硬件仿真。
3. 正式阅读和未发布 Review 预览需要明确的渲染边界。Review 应忠实展示当前候选 SVG；不能因候选恰好占用已注册 ID，就被正式库当前版本的 React 内容替代。正式 live 快照若同 ID 的 SVG 已改变，也不能悄悄显示过时步骤/几何。可通过人工注册项与其审定图版本绑定，未匹配时保留本次真实静态 SVG；具体接口由作者在现有架构中选最小实现。
4. 同页多个实例的步数、SVG ID 和焦点隔离；证据面板开关和同页锚点切换保持当前分步状态；切页后不泄漏旧图状态。图下来源仍显示该图精确 pin。
5. 独立静态构建、`/nested/` 部署、断 API 的 1440px Chromium 实操：总览↔分步、首尾/重置、鼠标/键盘、两实例、证据面板切换、旧 scene/figure/native 与 Review 对照。开证据面板后图内可横滚，但控制条和说明不能制造整页水平溢出或盖住侧栏。用户 248 已取消手机阅读验收，不重加此门。

## 本次只读基线 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| `src/content/wiki/WikiDiagram.tsx` | `16f83ba9ca3167f5bd3784a609e88410f3244f955b1cbb75b2b5433278e2e91c` |
| `src/content/wiki/DiagramPlayer.tsx` | `9aba534ab4d166f0e62daa4d5e4c7376827269023b73914f9aa1df87457356d8` |
| `src/app/pages/WikiPage.tsx` | `b0bb9ffd2734ac581061aca8f7e6c68c06403e912adc0ae113d3e9668b6a3ae3` |
| `src/app/wiki/WikiScene.tsx` | `e30d1d52e223115cf58630fccf10b0f8405f082df33298703a22230fdc9a4ab7` |
| `wiki/diagrams/quantization-intuition.yaml` | `e67a3494e957b0f0cc9537095816e37e022e40996a565636d3c94140962e448d` |
| `wiki/diagrams/quantization-intuition.svg` | `1def4a3114ad4757dd3e8e6486778cd5e214f21c0829914ee9fba48f91ddc953` |

源码与 SHA 已实际读取。当前只完成验收准备，尚无本子批实现、浏览器结果或交付通过结论；既有正式 wiki、3D、210 缓存、888 Review 与服务均未改动。布局草图由 965 请墨墨提供，代码仍由烁烁单一作者实现。

## 967 布局草图回读后的实施口径

墨墨已回交纯消息草图（`0001794851929114-000967-63662586`），未改文件。采用图内顶部工具条、原 880×440 画布、下方当前步说明、完整原 caption 与图下证据入口的次序；窄正文列时工具条换行，画布自行横滚。

两处定点校准：草图中的 `[-77, 127, -45]` 不在本次读取的 YAML 内，不纳入本最小实例；不把整体降至 0.28 透明度作为验收要求，优先用选中区域轮廓/轻量强调，让其他标签仍可读。`allowInteractive` 应默认关闭，由正式页显式允许，并校验注册项对应图版本；仅比较候选与“当前正式快照”不足以防止正式 live 图已变化而人工组件仍旧的情形。

注册表负例含普通未知名称及 `constructor / toString / __proto__`，应查不到交互组件而保留安全静态阅读，不把对象原型属性当注册项。工具条范围内的快捷键不影响正文全局快捷键；多个相同图实例互不串步。
