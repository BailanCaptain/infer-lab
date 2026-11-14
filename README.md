# infer-lab · 大模型推理可视化实验室

以知识库为主章节的大模型推理学习网站。首页以已有 3D 城市和一个「开始阅读」按钮作为开场，进入后按知识主题阅读完整正文。读者从模型计算进入推理过程、vLLM / vLLM-Ascend 架构、硬件、并行与工程实践。主题目录、正文、搜索与问答共用同一份知识内容，模型与硬件 3D 作为辅助探索入口。

2026-10-14 用户已推翻独立 22 章课程方案。当前方向见 `PLAN.md` 顶部；`/` 和 `/#/home` 为单按钮城市首页，按钮进入 `/#/wiki` 知识主站，`/#/archive/home` 是首页的兼容链接。旧课程深链接仍可读，不再是主站的编排依据。

## 无设备阅读知识库

知识库以 **GLM-5.3-Flash** 为贯穿模型，从模型计算、单请求与多请求进入 vLLM / vllm-ascend 架构，再学习硬件、缓存与并行。模型和官方双机案例的固定材料见 [来源基线](wiki/sources/glm-5-3-flash-baseline.md)，学习路径见 [阅读指南](wiki/concepts/learning-guide.md)。

阅读静态正文、结构图和通信演示不需要 NPU、驱动、模型权重、外部源码仓库或 glm-flow 本机服务。问答后端与真实部署是另行配置的能力；未启动后端时，正文仍可阅读。双机页是经过来源核读的工程参考，没有设备与性能实测。

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
| `docs/plans/` | 单个 feature 的分步实施计划 |
| `wiki/HANDBOOK.md` | 知识库 schema 真相源（F001） |

## 参考与授权

- 并行策略教学图包（`reference/parallelism-teaching-dark/`）：只使用其事实与证据账本，图全部重做为交互组件。
- InferFlux：只借鉴教学与交互思路，不复制其代码或图；原材料的授权条件不推广到本项目。
- LLM Visualization、Transformer Explainer（MIT）：借鉴叙事与交互设计。
- 站内嵌入的 vLLM / vLLM-Ascend 源码片段遵循 Apache-2.0，标注固定 commit 与行号。

本轮知识库图形来源与复用范围见 [资产与署名记录](docs/wiki-assets-and-attribution.md)。仓库当前没有统一的项目 LICENSE；本地构建可用性不等于已完成公开发行授权。公开前仍须由维护者确定项目许可，并处理既有 RFork 原补丁与其他材料的权属事项。
