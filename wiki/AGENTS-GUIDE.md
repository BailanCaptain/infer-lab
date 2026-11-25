# 别的 agent 怎么用这个知识库

`wiki/` 是一个 vLLM / vLLM-Ascend / 昇腾推理的知识库，每条结论钉在上游某个 commit 的某几行上。
涉及这两个项目的机制、参数、默认值、版本差异（v0.23 / v0.26 / v0.30.0 / main）的问题，**先查它，再回答**。

这一页不依赖任何具体工具，Claude Code、Codex、脚本都能照着做（Claude Code 另有 `.claude/skills/llm-wiki/SKILL.md`，内容与此一致）。
知识库的写作规范见 [docs/wiki-writing-standard.md](../docs/wiki-writing-standard.md) 与 [HANDBOOK.md](HANDBOOK.md)，那是写页的人看的，不是查页的人看的。

## 三种用法

**① 直接读文件**（零依赖，最省事）

- [index.md](index.md) —— 人读的目录，按类型列出全部 **193 篇正式页面**（含 **41 篇正式参数页**），每行是 `` `[标题](concepts/<id>.md)` — 一句话摘要 ``。
- `../src/content/wiki/registry.json` —— 机器读的索引：每页的 `id`、`title`、`aliases`、`summary`、`relations`、`backlinks`、`verified`、`file`。
  按 `aliases` 找页（别名就是为「layer share」「cudagraph_mode」这类问法写的），拿到 `file` 再读 `wiki/<file>`。
- 页面正文在 `concepts/<id>.md`（概念与特性，144 篇）、`params/<id>.md`（正式参数页，41 篇）、`sources/<id>.md`（基线快照、归档来源、PR 记录与问答记录，共 8 篇）。

**② 命令行**（能跑 shell 就能用，只读）

```bash
pnpm -s wiki:find "layer share"           # 搜：id、命中方式、文件路径、标题、摘要、已核对的版本
pnpm -s wiki:find "异步调度" --json        # 同上，机器可读；--limit N 要更多结果
pnpm -s wiki:find --page one-request      # 打印这一页的完整 markdown（含 frontmatter）
pnpm -s wiki:find --neighbors block-table # 这页和哪些页有关，每条边带一句理由
```

**③ MCP server**（给 MCP 客户端用，只读：不写文件、不调模型、不联网）

```bash
pnpm wiki:mcp     # stdio 上的 JSON-RPC，共 7 个工具（3 个知识库 + 4 个确定性昇腾仿真）
```

- 知识库工具：`wiki_search` / `wiki_get_page` / `wiki_neighbors`（覆盖全站 193 篇正式页面与 41 篇正式参数页）
- 确定性仿真工具（零幻觉纯函数）：`ascend_plan_deploy`（显存与卡数算账，内置 `qwen3-0.6b`、`qwen3-8b`、`qwen3-30b-a3b`、`qwen3-32b`、`qwen3-235b-a22b` 及异构架构预设，或直接传 HuggingFace `config.json`）/ `ascend_lint_serve_cmd`（单机或 P/D 启动命令体检、静默改写与点分 `--additional-config.<key>` 检测，P/D 模式并附带逐端 `prefill` / `decode` 环境分类与生效改写明细）/ `ascend_diagnose_log`（多卡交错报错首错 Rank 定位）/ `ascend_reconcile_startup_log`（理论预算 vs 实机启动日志逐项对账，同样支持 `qwen3-32b` / `qwen3-235b-a22b` 等全部预设）

各客户端即拷即用接入方式（将 `<本仓库绝对路径>` 替换为实际克隆目录）：

- **Claude Code（命令行一键注册）**：
  ```bash
  claude mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp
  ```
- **Codex CLI（命令行一键注册或写入 `~/.codex/config.toml`）**：
  ```bash
  codex mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp
  ```
  ```toml
  [mcp_servers.llm-wiki]
  command = "pnpm"
  args = ["--dir", "<本仓库绝对路径>", "-s", "wiki:mcp"]
  ```
- **Cursor / 标准 `mcpServers` JSON（`.cursor/mcp.json` 或 `claude_desktop_config.json`）**：
  ```json
  {
    "mcpServers": {
      "llm-wiki": {
        "command": "pnpm",
        "args": ["--dir", "<本仓库绝对路径>", "-s", "wiki:mcp"]
      }
    }
  }
  ```

②③ 共用同一个检索入口（`src/content/wiki/retrieve.ts`），命中规则和站内问答完全一致，不是另一套。

## 怎么读一页

- `sources` 是钉住 commit 的来源，形如 `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472`。
- Stage 2 Edition-A 页面保持教学正文清爽，将 `[C3]` / `[S1]`（指 `sources` 第 3 / 第 1 条：`C` 源码，`S` 官方文档或论文）及源码锚点统一收敛在文末 `## 对照源码` 中；历史未改版页仍可能保留行内角标。
- 不带编号的 `[D]` 推导、`[I]` 推断、`[A]` 教学假设、`[!]` 矛盾或会踩的坑——**这四种最该警惕，转述时把等级与适用边界带上**。
- `verified` 是有人逐条对过的版本；社区页当前以 `releases/v0.30.0`（`c09d3e20`）为默认主基线，并对照 `releases/v0.23.0`、`releases/v0.26.0rc` 与 `main`（`8d6180e2`）；RFork 页面（详见下方）当前随主线 `main` 对齐（历史上曾用 `rfork:main` 标注独立工作版）。完整规则见 `docs/wiki-writing-standard.md` 与 HANDBOOK 的「版本」。
  **没列出的版本 = 没人对过，不等于在那个版本上不成立。**
- 版本之间真有差异时，页内有一张差异表，末列写「这对使用者意味着什么」。版本相关的问题先看它。
- `--neighbors` 给出的每条边都带理由，回答里说明几页之间的关系时照它写，不要自己编。

## 三条规矩

### RFork 排错的特别入口

涉及 RFork 的报错，先 `pnpm -s wiki:find --page rfork-troubleshooting`，再按它链接的机制页查。整章入口为 [rfork](concepts/rfork.md)。RFork 实现现已合入上游 `vllm-ascend@main`（`8d6180e2`，见 `wiki/seeds/vllm-ascend.yaml`）；历史独立工作版快照与说明保留在仓库根 `rfork/` 目录（原 `seeds/rfork.yaml` 已退役移除）。

先向日志确认实际代码提交、main/draft 角色、rank、两端参数及 Planner 版本。先说已证实的阶段与影响，再列候选原因和需要补的现场证据；不能把 400 自动解释成 TTL 过期，也不能把 seed 发布失败自动解释成模型加载失败。

**RFork 排错允许按页面定位读取入库源码**：项目根 `rfork/source/` 保存当前实现、测试与示例 Planner，按报错函数/文件读取即可，不必扫完整上游仓库。完整代码维护与补丁更新规程在 `../rfork/README.md`；只分析报错时不修改源码或 Wiki。源码 C 级证据不等于真实 NPU 实测。

下面三条仍适用于一般查询；RFork 的精确源码追踪使用上述入库目录。

1. **结论带页面链接，版本说清楚。** 让人能顺着来源行号去核对；引用版本相关的结论时说明是哪个版本、`verified` 里有没有它。
2. **没收录就说没收录。** 不要拿模型自己的知识冒充知识库结论。换别名 / 英文名 / 参数名再查一次仍然没有，就如实说，并把缺口记下来（现成的清单命令是 `pnpm wiki:gaps`）。
3. **不要私自绕过规范改 `wiki/` 下的页面，不要扫整个 `tools/repos/`。** 知识库的写入遵守 [HANDBOOK.md](HANDBOOK.md) 与 [docs/wiki-writing-standard.md](../docs/wiki-writing-standard.md)，只读查页时发现错误报告出来；`tools/repos/` 是约 1.6 GiB 的第三方源码全量克隆，该引的行号页面里已经钉好了。
