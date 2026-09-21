# 别的 agent 怎么用这个知识库

`wiki/` 是一个 vLLM / vLLM-Ascend / 昇腾推理的知识库，每条结论钉在上游某个 commit 的某几行上。
涉及这两个项目的机制、参数、默认值、版本差异（v0.23 / v0.26 / main）的问题，**先查它，再回答**。

这一页不依赖任何具体工具，Claude Code、Codex、脚本都能照着做（Claude Code 另有 `.claude/skills/llm-wiki/SKILL.md`，内容与此一致）。
知识库的写作规则在 [HANDBOOK.md](HANDBOOK.md)，那是写页的人看的，不是查页的人看的。

## 三种用法

**① 直接读文件**（零依赖，最省事）

- [index.md](index.md) —— 人读的目录，按类型列出全部页面，每行是 `[标题](concepts/xxx.md) — 一句话摘要`。
- `../src/content/wiki/registry.json` —— 机器读的索引：每页的 `id`、`title`、`aliases`、`summary`、`relations`、`backlinks`、`verified`、`file`。
  按 `aliases` 找页（别名就是为「layer share」「cudagraph_mode」这类问法写的），拿到 `file` 再读 `wiki/<file>`。
- 页面正文在 `concepts/<id>.md`（概念与特性）、`params/<id>.md`（参数）、`sources/<id>.md`（存进来的问答记录，目前还是空的）。

**② 命令行**（能跑 shell 就能用，只读）

```bash
pnpm -s wiki:find "layer share"           # 搜：id、命中方式、文件路径、标题、摘要、已核对的版本
pnpm -s wiki:find "异步调度" --json        # 同上，机器可读；--limit N 要更多结果
pnpm -s wiki:find --page one-request      # 打印这一页的完整 markdown（含 frontmatter）
pnpm -s wiki:find --neighbors block-table # 这页和哪些页有关，每条边带一句理由
```

**③ MCP server**（给 MCP 客户端用，只读：不写文件、不调模型、不联网）

```bash
pnpm wiki:mcp     # stdio 上的 JSON-RPC，三个工具：wiki_search / wiki_get_page / wiki_neighbors
```

接进 Claude Code：`claude mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp`

②③ 共用同一个检索入口（`src/content/wiki/retrieve.ts`），命中规则和站内问答完全一致，不是另一套。

## 怎么读一页

- `sources` 是钉住 commit 的来源，形如 `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472`。
- 正文里 `[C3]` / `[S1]` 指 `sources` 的第 3 / 第 1 条（从 1 数起）：`C` 源码，`S` 官方文档或论文。
- 不带编号的 `[D]` 推导、`[I]` 推断、`[A]` 教学假设、`[!]` 矛盾或会踩的坑——**这四种最该警惕，转述时把等级带上**。
- `verified` 是有人逐条对过的版本（只有 `releases/v0.23.0`、`releases/v0.26.0rc`、`main` 三个取值）。
  **没列出的版本 = 没人对过，不等于在那个版本上不成立。**
- 版本之间真有差异时，页内有一张差异表，末列写「这对使用者意味着什么」。版本相关的问题先看它。
- `--neighbors` 给出的每条边都带理由，回答里说明几页之间的关系时照它写，不要自己编。

## 三条规矩

1. **结论带页面链接，版本说清楚。** 让人能顺着来源行号去核对；引用版本相关的结论时说明是哪个版本、`verified` 里有没有它。
2. **没收录就说没收录。** 不要拿模型自己的知识冒充知识库结论。换别名 / 英文名 / 参数名再查一次仍然没有，就如实说，并把缺口记下来（现成的清单命令是 `pnpm wiki:gaps`）。
3. **不要改 `wiki/` 下的页面，不要读 `tools/repos/`。** 知识库的写入有自己的流程（见 HANDBOOK.md），发现错了报告出来、别就地改；`tools/repos/` 是 196 MB 的第三方源码全量克隆，该引的行号页面里已经钉好了。
