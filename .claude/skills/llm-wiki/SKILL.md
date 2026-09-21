---
name: llm-wiki
description: 回答或核对任何关于 vLLM / vLLM-Ascend / 昇腾推理的问题之前先查本仓库的知识库——机制、参数含义与默认值、版本差异（v0.23 / v0.26 / main）都在里面，每条结论钉住上游 commit 与行号，比模型记忆可靠。
---

# llm-wiki：先查知识库，再回答

本仓库 `wiki/` 下是一个 vLLM / vLLM-Ascend 知识库，每条结论钉在上游某个 commit 的某几行上。
凡是涉及这两个项目的机制、参数、默认值、版本差异的问题，**先查它，再回答**。

## 一、怎么查（三步）

1. **搜**：`pnpm -s wiki:find "<词或问题>"`（MCP 客户端用 `wiki_search`）。
   每条命中给出 `id`、命中方式、文件路径、标题、一句话摘要、已核对的版本。
   例：`pnpm -s wiki:find "layer share"` 第一条是 `layer-sharding  [fuzzy]  wiki/params/layer-sharding.md`。
   `--limit N` 要更多结果，`--json` 要机器可读的输出。中文词照样能查（`pnpm -s wiki:find "异步调度"`）。
2. **读**：`pnpm -s wiki:find --page <id>`（MCP：`wiki_get_page`），或直接打开上一步给的文件路径。两者内容一样。
3. **串**：`pnpm -s wiki:find --neighbors <id>`（MCP：`wiki_neighbors`）。
   `→` 是这页建立在谁之上，`←` 是谁建立在这页之上，**每条边都带一句理由**。
   例：`--neighbors block-table` 会说清块表建立在 `paged-attention`、`kv-cache-spec` 之上，
   而 `prefix-caching`、`context-parallel`、`prepare-inputs-flow` 建立在它之上。
   回答里讲几页之间的关系时，照这些边给的理由写，不要自己编一个关系出来。

接 MCP（只读：不写文件、不调模型、不联网，三个工具 `wiki_search` / `wiki_get_page` / `wiki_neighbors`）：

```
claude mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp
```

命令行与 MCP 共用同一个检索入口（`src/content/wiki/retrieve.ts`），命中规则和站内问答完全一致。

## 二、怎么读一页

- frontmatter 的 `sources` 是钉住 commit 的来源，形如 `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472`。
- 正文里的 `[C3]` / `[S1]` 指 `sources` 里的第 3 条 / 第 1 条（从 1 数起）：`C` 是源码，`S` 是官方文档或论文。
- 不带编号的标记是作者的判断：`[D]` 从来源推导，`[I]` 推断，`[A]` 教学假设，`[!]` 矛盾或会真踩到的坑。
  **这四种才是全页最该警惕的地方**——转述它们时把等级一起带上，别写成和 `[C]` 一样确凿。
- `verified` 是这页有人逐条对过的版本，取值只有 `releases/v0.23.0`、`releases/v0.26.0rc`、`main` 三个。
  **没列出的版本 = 没人对过，不等于「在那个版本上不成立」。** 不要把它读成否定结论。
- 版本之间真有差异时，页内有一张差异表，末列写「这对使用者意味着什么」。版本相关的问题先看那张表。
- `evidence` 是整页主体结论的等级（`S` 官方 / `C` 源码 / `D` 推导 / `A` 假设 / `I` 推断 / `M` / `!`），不是页内出现过的最高等级。

## 三、回答时的规矩

- 结论带页面链接（例如 `wiki/concepts/block-table.md`），让人能顺着来源行号去核对。
- 知识库没收录就明说没收录，**不要拿模型自己的知识冒充知识库结论**。确实要补自己的判断，就分开写明哪句来自知识库、哪句不是。
- 引用版本相关的结论时说清是哪个版本，以及这页的 `verified` 里有没有那个版本。

## 四、查不到怎么办

1. 换个说法再查一次：别名、英文原名、参数名（`enable_xxx`）、类名、报错里的关键字。页面的 `aliases` 就是为这类问法写的。
2. 仍然没有：如实说知识库没收录，并建议把缺口记下来——现成的缺口清单命令是 `pnpm wiki:gaps`（只读，不花钱）。
3. 不要从别处搜一段内容补上去，再当成知识库的结论讲。

## 五、不要做什么

- **不要改 `wiki/` 下的页面来「顺手修正」。** 知识库的写入有自己的流程（证据等级、来源钉点、lint、审阅），
  规则的唯一真相源是 `wiki/HANDBOOK.md`。发现哪页错了，报告出来，别就地改。
- **不要读 `tools/repos/`**：那是 196 MB 的第三方源码全量克隆，翻它会把上下文烧光；该引的行号知识库已经钉好了。
