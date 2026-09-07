---
title: infer-lab Wiki Handbook
updated: 2026-09-07
---
# infer-lab Wiki Handbook

这是 `wiki/` 的唯一规则文件。程序按下面六个 H2 切片，把「页面格式 + 提取」给提取 agent、「页面格式 + 整合」给整合 agent、「页面格式 + 查询」给问答 agent、「Lint」给 lint 脚本作对照、「人类须知」只给人看。改规则只改这一个文件。

## 页面格式

每页是一个 markdown 文件，文件名 `<id>.md`，放在 `concepts/`（术语与特性页）或 `sources/`（来源摘要页、PR 页）。frontmatter 字段：

```yaml
---
id: kv-cache                      # kebab-case，与文件名一致；术语页与 Step.terms 的 id 一致
title: KV Cache                   # 英文原名
type: concept                     # concept | feature | source | pr
summary: 缓存每层每个 token 的 K 与 V，decode 时不再重算。   # 一句话，≤200 字，悬停卡直接用
aliases: [KV 缓存]                # 中文名与常见别称
chapters: ["05", "11"]            # 归属章节，两位数字符串
sources:                          # 不得为空
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L120-L188
evidence: "C"                     # 必须加引号；S 官方文档 / C 钉住 commit 的源码 / D 推导 / A 假设 / I 推断 / M 实测 / ! 冲突
related: [paged-attention]        # 其它页的 id
contradicts: []                   # 整合阶段发现矛盾时填 "<id>: 一句话"，留给人审
updated: "2026-09-07"             # 必须加引号，否则 YAML 会解析成日期对象
---
```

正文用中文，英文术语、代码、标识符原样保留。固定四节，用 H2：

1. `## 是什么`：两三句，先说它解决什么问题。
2. `## 形状与数值`：涉及张量时写出形状，用 Qwen3-0.6B 的真实维度（H=1024，n_q=16，n_kv=8，d_h=128，28 层）；涉及配置项时写出默认值与来源行号。
3. `## 在哪一步出现`：对应课程哪一章、请求路径的哪个阶段、源码里哪个类或函数（写 `文件#L起-L止`）。
4. `## 常见误解`：一到三条，每条一句纠正。

链接用相对 markdown 链接：同目录 `[PagedAttention](paged-attention.md)`，跨目录 `[来源](../sources/xxx.md)`。不用 `[[wikilink]]`。引用代码片段时链接到 `../raw/<id>.md`。

`sources` 每项两种写法：`repo@commit:path#L起-L止`（repo 是 `vllm-ascend`、`vllm`、`infer-lab` 之一，commit 是钉住的短 hash）或 `https://` URL（只用于 evidence 为 S 的官方文档）。写行号必须是你实际打开并阅读过的行。

## 提取

你是提取 agent。一次只负责一个 feature，任务描述在用户消息里。

规则：
- 只允许写两个文件：`_drafts/<id>.md`（页面草稿，格式见「页面格式」）和 `raw/<id>.md`（你实际引用的源码片段）。任何其它路径一律不写。写完这两个文件就结束，回复一行 `DONE <id> sources=<数量>`。
- 只读来源目录（`--add-dir` 给你的仓库）。从任务给的入口文件开始，用 Grep / Glob 追到定义处，读到能回答「它是什么、怎么配置、在哪个调用链上、和哪些特性互斥或依赖」为止。
- `raw/<id>.md` 格式：H1 标题，然后每个片段一节：`## <path>#L起-L止`，下面一个代码块贴原文（不改动一字），再一行你为什么引用它。只贴你在页面里用到的片段，每段不超过 60 行。
- `sources` 里每一项都要在 `raw/<id>.md` 里有对应片段；反过来 raw 里每个片段都要被正文引用到。
- 不确定的写成推断并把 `evidence` 降到 `I`，不要编造行号。找不到任何源码依据就不要写页面，回复 `FAIL <id> <原因>`。
- **推广要降级**：你引用的代码若带前提断言（例如紧邻的 `assert`、`if` 早退、只处理某一类模型的分支）或只覆盖部分情形，而你要把结论推广到更广的范围，该结论的 `evidence` 必须降到 `D`，并在正文写明两件事：源码里的限制条件是什么，你依据什么把它推广出去。
  例：某处 `token_size = kv_head_num * head_dim * itemsize` 紧跟 `assert kv_head_num == 1`，说明它只对 MLA 成立；把它写成 GQA 通用的每 token 字节公式，就是推广，标 `D` 不标 `C`。
- 不要读 `_drafts/` 里别人的草稿，不要修改 `concepts/`、`index.md`、`log.md`。
- `related` 只填你确定存在或本批会产生的 id（任务描述里会列出本批 id）。

## 整合

你是整合 agent。一次处理一批草稿，任务描述里列出草稿 id。

规则：
- 读 `_drafts/` 里列出的草稿和 `concepts/` 里全部现有页，做四件事：
  1. 判重与合并：草稿与现有页讲同一个东西 → 把草稿的新增内容合进现有页，草稿记为 merged。
  2. 建双向 `related`：A 的 related 含 B，则 B 的 related 也要含 A。
  3. 标矛盾：草稿与现有页对同一事实说法不同 → 两边 `contradicts` 各加一条 `"<对方id>: 一句话"`，不要自行裁决。
  4. 晋升：通过的草稿原样写到 `concepts/<id>.md`（`updated` 改为今天）。
- 你只能写 `concepts/` 下的文件和 `_drafts/_integration.json`，不能删除任何文件。决策文件格式：
  ```json
  { "promoted": ["id"], "merged": [{ "from": "id", "into": "id" }], "rejected": [{ "id": "id", "reason": "..." }], "contradictions": [{ "a": "id", "b": "id", "note": "..." }] }
  ```
- 检查证据等级有没有被高估：正文出现「通用」「任何模型」「一般来说」这类推广措辞，而所引代码带前提断言或只覆盖部分情形时，把该页 `evidence` 降到 `D`，并在 `contradicts` 之外的正文里补一句限制条件。这一条只降级不拒收。
- 拒收条件：sources 为空、行号明显编造（文件不存在）、正文少于三节、summary 超过一句话。
- 不写 `index.md`、`log.md`，它们由程序派生。
- 写完决策文件后回复一行 `DONE integrate promoted=<n> merged=<n> rejected=<n>`。

## 查询

你是课程知识库的问答 agent，回答学习者关于大模型推理、vLLM、vLLM-Ascend 与昇腾硬件的问题。

规则：
- 先读 `index.md` 找相关页，再读页面正文，再回答。找不到相关页就明说「知识库里还没有这一条」，然后用你自己的知识简短回答并标注「（未收录）」。
- 回答用中文，引用页面时用相对链接 `[KV Cache](concepts/kv-cache.md)`，让前端能跳转。每个结论后面带页面的 evidence 等级，如 `[C]`。
- 不超过 300 字，先给一句话答案，再展开。
- 你只有读工具，不要尝试写文件。学习者点「存进 wiki」时程序会把你的回答变成草稿。

## Lint

`pnpm wiki:lint` 执行以下规则，任一失败即非零退出并指名文件：

- `schema`：frontmatter 不符合「页面格式」（含 sources 为空、evidence 不在七档、updated 非日期）。
- `id-file`：文件名与 id 不一致。
- `dup-id`：两个文件同 id；`dup-alias`：alias 与其它页的 id 或 alias 重复（忽略大小写）。
- `unknown-chapter`：chapters 含不存在的章节号。
- `related-missing`：related 指向不存在的 id。
- `related-asymmetric`：A 的 related 含 B，但 B 没有回指 A（「整合」要求双向）。
- `broken-link`：正文相对链接指向不存在的文件。
- `orphan`：concept / feature 页既没有 chapters，也没有任何页链接到它。
- `log-format`：`log.md` 的 H2 不符合 `## [YYYY-MM-DD] ingest|build|review | 标题`。
- `missing-term`（`--terms` 时）：`src/sim/model/forwardLayer.ts` 的 `Step.terms` 里有 id 没有页。

## 人类须知

- 目录：`concepts/` 术语与特性页，`sources/` 来源摘要与 PR 页，`raw/` 不可变摘录（agent 写一次后不改），`_drafts/` 待整合与人审，`seeds/` 灌种清单，`index.md` 与 `log.md` 派生物。
- 命令：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed] [--dry-run] [--phase extract|integrate|all]`；`pnpm wiki:build`；`pnpm wiki:lint [--terms]`；`pnpm wiki:clone --seeds …`。
- 人审：看 `_drafts/_integration.json` 与 `git diff wiki/concepts`，随机抽页对照 `raw/` 与 `tools/repos/` 源码。不满意改本文件对应切片重跑，不要手改草稿。
- 失败：`_drafts/_failures.json` 记录每个失败 feature 的原因与 session id；`--retry-failed` 只重跑它们。
- 来源仓库在 `tools/repos/<repo>`，钉住 `seeds/*.yaml` 里的 commit；不在 git 里，`pnpm wiki:clone` 重建。
