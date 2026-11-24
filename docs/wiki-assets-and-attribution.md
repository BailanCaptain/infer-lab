# 知识库图形、来源与复用范围

本记录说明仓库内知识库图形、立体剖面插画、交互场景与固定源码摘录的来源及授权边界。项目整体代码采用根目录 [LICENSE](../LICENSE)（`Apache-2.0`）。

## 仓内视觉与内容资产清单

| 资产类别 | 生成与组织方式 | 仓内位置 / 授权条件 |
|---|---|---|
| 知识库 2D 矢量图（`703` 套） | 包含 `layout: figure` 规格渲染图与 `mode: "native-svg"` 手写原生暖矿物色矢量图，全部由本站根据固定模型配置、源码逻辑与手算推导绘制 | `wiki/diagrams/*.yaml` 与同名 `*.svg` 入库；不外链第三方页面截图 |
| 立体剖面与趣味场景插画（`42` 张 `PLATE`） | 为核心全景页、架构页与抽象工程机制页专门制作的等距立体拆解剖面（`27` 张）与趣味微缩场景破冰底图（`15` 张，透明底紧裁 `.webp`），外层中文引线与源码 `pins` 由伴生 `native-svg` 矢量承载 | `public/wiki-illustrations/*.webp`（共 `42` 张）及对应 `wiki/diagrams/*plate*.svg` |
| 通信与工程交互组件 | 本地 React/TypeScript 实现的集合通信分步演示与 `#/tools` 四套工程工作台（部署计算器、配置体检、故障排查工作台、AI Core 执行实验室） | `src/content/wiki/`、`src/app/tools/`、`src/sim/`；离线自包含，无外部运行时请求 |
| 首页城市与硬件 3D 资产 | 首页服务器城市模型、Draco 解码器与硬件探索 `.glb` 资产 | `public/models/`、`assets/city/`、`public/experiences/`、`public/draco/LICENSE`（保留原许可证） |
| 论文与官方模型材料 | 正文引用公开论文、官方文档与模型结构配置（`Qwen3-8B`、`Qwen3-30B-A3B`、`GLM-5.3-Flash`、`DeepSeek-V4.1-Flash`），固定出处记录在 `sources` | 仅引用机制、公式与公开配置数值，未打包分发任何模型权重 |
| `vLLM` / `vllm-ascend` 源码摘录与快照 | 固定 `commit/path#L起-L止` 的源码证据与不可变 `raw` 摘录 | `wiki/raw/sha256-*.md` 及 `rfork/source/`；保留上游 `Apache-2.0` 许可与版权声明 |
| Ascend 910B3 实机量测基线 | 本项目在 `1×` 与 `8× Ascend 910B3`（`CANN 9.1.0`、`vllm-ascend 0.30.0`）环境采集的一手脱敏基线数据 | `wiki/sources/ascend-910b3-measured-baseline.md` 与 `docs/benchmarks/2026-11-23-ascend-910b3-measured-evidence.md` |

## 新资料入库规范

新增图形、插画或外部材料时，先在对应页面 `sources` 或本记录明确来源、固定版本与使用方式：

1. **优先自绘**：机制流程图、张量分片图与比例账单图一律按 `docs/wiki-writing-standard.md` 与 `DESIGN.md` 暖矿物色系自绘，不直接复制未确认再发行许可的外部图片包（早期参考图包与退役山境工程源已迁出主仓）。
2. **保留上游署名**：原样引用的开源代码片段或第三方运行时解码器保留各自许可证文件与 commit/行号锚点。
3. **事实同步**：新证据导致机制结论或数值推导变化时，同步更新正文、YAML `pins`、SVG 图与受影响依赖页。
