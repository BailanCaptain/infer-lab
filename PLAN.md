# infer-lab 总体架构与演进基线（大模型推理可视化实验室 · vLLM-Ascend 主线）

## 一、当前产品形态（Stage 2 正式基线）

- **单入口开场首页（`/` 与 `/#/home`）**：服务器城市 3D 背景 + 「开始阅读」主入口，直达 `/#/wiki` 知识主站（`/#/archive/home` 保留历史兼容）。
- **知识库主章节（`/#/wiki`）**：由 `src/content/wiki/toc.ts` 统一编排 `01..12` 共 12 个主题目录（185 篇正式页），覆盖模型结构、推理过程、KV Cache、调度、vLLM / vLLM-Ascend V1 架构、昇腾硬件、分布式并行、量化、投机解码、分离式部署与实机性能诊断。
- **五套交互式工程工作台（`/#/tools`）**：部署计算器（`DeployCalculator`）、配置体检与升级雷达（`ConfigDoctor`）、故障排查工作台（`TroubleshootWorkbench`）、AI Core 执行实验室（`AiCoreLab`）与生产故障演练场（`IncidentWarGame`），与知识页内嵌 `wiki-tool`（含 6 模式交互公式尺 `FormulaRuler`）及 3D 整机部署透视通过 URL 深链双向互通。
- **双层视觉与交互 3D**：静态图采用 Edition-A 暖矿物色系（`PLATE` 立体剖面/趣味微缩场景 + 因景制宜 `FIG` 机制矢量图）；17 篇核心概念页通过 `wiki-scene` 内嵌交互 3D 场景，模型与硬件 3D 探索作为辅助观察入口。

## 二、版本与标尺契约

- **默认主基线**：`vllm-ascend v0.30.0 (c09d3e20)` + `vllm (ced6857a)`，同步对照 `releases/v0.23.0`、`releases/v0.26.0rc` 与 `main (8d6180e2)`；主线教学标尺采用 `Qwen3-8B`（Dense GQA）与 `Qwen3-30B-A3B`（MoE），第 `09` 篇承载 `GLM-5.3-Flash` 与 `DeepSeek-V4.1-Flash` 异构全案，并纳入 `Ascend 910B3` 1 卡/8 卡实机量测证据（`[M]`）。
- **显式例外**：例外 A（RFork 10 篇）对齐上游 `main (8d6180e2)`；例外 B（第 7 章 GLM 与 17 篇 `wiki-scene` 绑定算例）保持审定历史钉点。完整规则以 [docs/wiki-writing-standard.md](docs/wiki-writing-standard.md) 为唯一真相源。

## 三、核心技术栈与模块边界

- **前端与仿真**：Vite 8 + React 19 + TypeScript + Tailwind v4 + Zustand + Three.js + KaTeX；严格单向依赖 `design ← sim ← timeline ← viz2d ← content ← app`（由 `scripts/check-deps.ts` 校验）。
- **LLM-Wiki 知识闭环**：共用 `src/content/wiki/retrieve.ts` 支撑网页问答、CLI（`pnpm wiki:find`）与只读 MCP（`pnpm wiki:mcp`），配套缺口追踪（`pnpm wiki:gaps`）、材料投喂（`Drop`）与三出口守恒审阅发布流（`server/` + `scripts/wiki/`）。
- **核心 Feature 台账**：
  - [F001 — LLM Wiki：知识库与右侧问答](docs/features/F001-llm-wiki.md)
  - [F002 — 参数谱系与自动生成保护](docs/features/F002-param-lineage.md)
  - [F003 — GitHub 社区语料与外部核验](docs/features/F003-github-corpus.md)
  - [F004 — 知识更新与覆盖判定闭环](docs/features/F004-knowledge-loop.md)
  - [F005 — Wiki Drop 材料投喂与整组审阅](docs/features/F005-wiki-drop.md)

## 四、历史课程章号索引（供 frontmatter chapters 兼容映射）

保留历史课程标签编号：`00` · `01` · `02` · `03` · `04` · `05` · `06` · `07` · `08` · `09` · `10` · `11` · `12` · `13` · `14` · `15` · `16` · `17` · `18` · `19` · `20` · `21`（标题映射单一定义于 `src/content/chapters.ts` 与 `src/content/wiki/chapters.ts`）。
