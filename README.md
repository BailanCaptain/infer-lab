# infer-lab · 大模型推理可视化实验室

以知识库为主章节的大模型推理学习网站（vLLM / vLLM-Ascend 主线）。首页以已有 3D 城市和一个「开始阅读」按钮作为开场，进入 `/#/wiki` 后按 12 个主题章节阅读完整正文（支持因果图谱漫游与内嵌 6 模式交互公式尺）；`/#/tools` 提供五套与知识库双向深链的交互式工程工作台（部署计算器、配置体检与升级雷达、故障排查工作台、AI Core 执行实验室与生产故障演练场）。主题目录、正文、搜索、问答与工具共用同一套知识与规则基座，模型与硬件 3D（含整机显存部署透视）作为辅助探索入口（17 篇正式概念页另通过 `wiki-scene` 内嵌交互 3D 场景；新建或修改教学 3D 遵守 `docs/3d-teaching-standard.md`）。

2026-10-14 用户已推翻独立 22 章课程方案。当前方向见 `PLAN.md` 顶部；`/` 和 `/#/home` 为单按钮城市首页，按钮进入 `/#/wiki` 知识主站，`/#/archive/home` 是首页的兼容链接。旧课程深链接仍可读，不再是主站的编排依据。

## 无设备阅读知识库

知识库（Stage 2）以 **`vllm-ascend v0.30.0 (c09d3e20)`** 为默认主基线（同步对照 `releases/v0.23.0`、`releases/v0.26.0rc` 与 `main (8d6180e2)`），主线讲解采用 **Qwen3-8B（Dense）** 与 **Qwen3-30B-A3B（MoE）**，并在第 `09` 篇「旗舰异构模型全案」给出 **GLM-5.3-Flash** 与 **DeepSeek-V4.1-Flash** 的端到端剖析。12 个主题目录与学习路径见 [阅读指南](wiki/concepts/learning-guide.md)，旗舰模型固定材料见 [GLM-5.3-Flash 来源基线](wiki/sources/glm-5-3-flash-baseline.md)（全库当前共 193 篇正式页，现查命令见 `HANDOFF-LLM-WIKI.md`）。

阅读静态正文、结构图、交互工作台（`#/tools`）和通信演示不需要 NPU、驱动、模型权重、外部源码仓库或本机后端服务。问答后端与真实部署是另行配置的能力；未启动后端时，正文与工作台仍可离线使用。双机页是经过来源核读的工程参考，没有设备与性能实测。

需要 Node.js 22.21+（22.x）或 24.5+，以及 `package.json` 中固定的 pnpm 版本。首次安装依赖需要访问包仓库：

```powershell
pnpm install --frozen-lockfile
pnpm wiki:build
pnpm dev
```

打开终端实际打印的本地地址即可进入主题目录，`/#/wiki` 仍可使用。Vite 默认端口为 5173；端口被占用时以启动输出为准。生产静态构建与本地预览：

```powershell
pnpm build
pnpm preview
```

产物位于 `dist/`。浏览器从页面内加载仓库打包的正文与图；来源外链的访问需要网络。部署到静态主机不提供问答/更新服务。

阅读页内提供两类查找入口：左栏目录搜索框仅按页面名称与目录项筛选；顶栏「搜索全文」按钮（或快捷键 `Cmd+K` / `Ctrl+K`）打开全库全文搜索弹窗，支持 `↑` / `↓` 选择结果、`Enter` 跳转目标页、`Esc` 关闭弹窗。全文搜索在纯静态预览/部署下同样按需加载可用；若索引请求失败，可在弹窗内点击「重试加载」恢复。

## 使用 Claude Code Router（CCR）

问答与 Drop 可以通过 Claude Code 接入 CCR。项目会自行启动 Claude Code，因此要把 CCR 的连接环境变量传给**启动项目后端的终端**；单独打开一个 `ccr code` 会话，不会自动配置另一个终端中的网站服务。模型选择使用 `chatProvider: "claude"`，支持 CCR 的 `provider,model` 名称。启动步骤、Windows 配置和实测边界见 [CCR 接入与验收](docs/wiki-ccr-setup.md)。

## 内容与开发验证

```powershell
pnpm wiki:diagrams         # 图 YAML → SVG，修改图后执行
pnpm wiki:build            # 正文 → 索引与 registry
pnpm wiki:lint             # 页面、关系和证据格式
pnpm check                # 类型、代码、单测、依赖与内容检查
pnpm build                # 生产构建
pnpm test:e2e             # 需要本机浏览器依赖的完整验收
```

`pnpm wiki:audit` 用固定源码仓库核对路径和行号，需要按 seeds 准备 `tools/repos/`；它不是普通阅读或静态构建的前提，也不证明每条结论的语义正确。RFork 的入库快照可用 `pnpm rfork:verify` 独立检查，进一步 Git 重放需要完整源码仓库。开发问答功能时使用 `pnpm dev:all`，服务设置见现有交接文档。

知识库与历史模拟实验分别声明模型：历史 `src/sim/` 中的 Qwen 教学配置、固定种子权重和真实 trace 保留原身份，不能当作 GLM 的执行结果。正文中的官方资料、源码、推导、假设、推断和实测分别标注，新的模型资料也不会自动改写贯穿案例。

目录与依赖方向：`design ← sim ← timeline ← viz2d ← content ← app`，见 `scripts/check-deps.ts`。

## 文档

| 文件 | 作用 |
|---|---|
| `PLAN.md` | **总体方向**：知识库主章节、主题目录与验收；下方保留历史方案 |
| `HANDOFF.md` | 主干（首页 / 教学表现层）的当前状态与下一步 |
| `HANDOFF-LLM-WIKI.md` | 已合入 `main` 的知识库当前状态与下一步；页数、预算等会变的数字在那里给了现查命令 |
| `DESIGN.md` | 设计真相源：配色、字阶、圆角、组件、画面纪律 |
| `PITFALLS.md` | 踩过的坑 |
| `CLAUDE.md` / `AGENTS.md` | 协作规则（两份内容相同，改动要同步） |
| `docs/features/` | 单个 feature 的聚合文件（Why / What / AC / 决策 / Timeline），**验收状态的唯一真相源**就是每份里的验收表；索引见 `PLAN.md` 七 |
| `wiki/HANDBOOK.md` | 知识库 schema 真相源（F001） |

## 参考与授权

- 站内嵌入的 `vLLM` / `vllm-Ascend` 源码片段遵循上游 `Apache-2.0`，标注固定 commit 与行号。
- 图形、立体剖面插画与实测基线来源说明见 [资产与署名记录](docs/wiki-assets-and-attribution.md)。
- 本项目采用 [Apache-2.0 许可证](LICENSE)。
