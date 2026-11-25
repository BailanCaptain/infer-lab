---
name: llm-wiki
description: 回答或核对任何关于 vLLM / vLLM-Ascend / 昇腾推理的问题之前先查本仓库的知识库——机制、参数含义与默认值、版本差异（v0.23 / v0.26 / v0.30.0 / main）都在里面，每条结论钉住上游 commit 与行号，比模型记忆可靠。
---

# llm-wiki：先查知识库，再回答

本仓库 `wiki/` 下是一个 vLLM / vLLM-Ascend / 昇腾推理知识库，每条结论钉在上游某个 commit 的某几行上。
凡是涉及这两个项目的机制、参数、默认值、版本差异（`v0.23.0` / `v0.26.0rc` / `v0.30.0` / `main`）的问题，**先查它，再回答**（与 `wiki/AGENTS-GUIDE.md` 同步）。

## 一、三种查法（只读）

1. **直接读文件**：目录见 `wiki/index.md`（共 **193 篇正式页面**，含 **41 篇正式参数页**），机器索引见 `src/content/wiki/registry.json`（含 `id`、`title`、`aliases`、`summary`、`relations`、`backlinks`、`verified`、`file`），正文在 `wiki/concepts/<id>.md`（144 篇）、`wiki/params/<id>.md`（41 篇）、`wiki/sources/<id>.md`（8 篇正式来源/PR 页）。
2. **命令行检索**：
   - `pnpm -s wiki:find "<词或问题>"`（支持 `--json`、`--limit N`）
   - `pnpm -s wiki:find --page <id>`（输出完整 Markdown）
   - `pnpm -s wiki:find --neighbors <id>`（输出双向 `relations` / `backlinks` 及每条边的理由 `note`）
3. **MCP Server**：`pnpm wiki:mcp`（stdio JSON-RPC，共 7 个只读工具：`wiki_search` / `wiki_get_page` / `wiki_neighbors` 与命令行及站内问答共用 `src/content/wiki/retrieve.ts`；另提供 `ascend_plan_deploy` / `ascend_lint_serve_cmd`［支持点分 `--additional-config.<key>`，P/D 模式附带逐端 `prefill` / `decode` 的 `envClassifications` 与 `effectiveRewrites`］ / `ascend_diagnose_log` / `ascend_reconcile_startup_log` 四个零幻觉确定性仿真工具，内置 `qwen3-0.6b`、`qwen3-8b`、`qwen3-30b-a3b`、`qwen3-32b`、`qwen3-235b-a22b` 及异构模型预设）。
   - **Claude Code**：`claude mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp`
   - **Codex CLI（或写入 `~/.codex/config.toml` 的 `[mcp_servers.llm-wiki]`）**：`codex mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp`
   - **Cursor / 标准 `mcpServers` JSON**：`{"mcpServers":{"llm-wiki":{"command":"pnpm","args":["--dir","<本仓库绝对路径>","-s","wiki:mcp"]}}}`

## 二、怎么读一页

- `sources` 是钉住 commit 的来源，形如 `vllm-ascend@c09d3e20:vllm_ascend/...#L10-L40`。
- Stage 2 页面将 `[C#]` / `[S#]` / `[M#]` 及源码锚点统一收敛在文末默认折叠的 `## 对照源码` 核验区，教学正文用自然语言写明成立条件。
- 不带编号的 `[D]` 推导、`[I]` 推断、`[A]` 教学假设、`[!]` 版本差异或易踩坑——转述时必须把等级与适用边界一起带上。
- `verified` 表示已逐条核对过的版本：社区页默认以 `releases/v0.30.0`（`c09d3e20`）为主基线，同步对照 `releases/v0.23.0`、`releases/v0.26.0rc` 与 `main`（`8d6180e2`）；RFork 专章现已对齐上游 `main`（`8d6180e2`）。**未列出的版本 = 尚未核对，不等于在该版本不成立。**

## 三、三条规矩与 RFork 入口

- **RFork 排错入口**：先跑 `pnpm -s wiki:find --page rfork-troubleshooting`，整章入口 `wiki/concepts/rfork.md`；历史工作版源码快照保存在 `rfork/source/`，维护说明见 `rfork/README.md`。
- **结论带页面链接与版本条件**，没收录就如实说明并可用 `pnpm wiki:gaps` 查看缺口，严禁拿模型记忆冒充知识库结论。
- **只读查页时不私自绕过规范改 `wiki/`，也不全盘扫描约 1.6 GiB 的 `tools/repos/`**；写入与审校遵守 `docs/wiki-writing-standard.md` 与 `wiki/HANDBOOK.md`。
