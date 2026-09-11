---
title: infer-lab Wiki Handbook
updated: 2026-09-11
---
# infer-lab Wiki Handbook

这是 `wiki/` 的唯一规则文件。程序按下面六个 H2 切片，把「页面格式 + 提取」给提取 agent、「页面格式 + 整合」给整合 agent、「页面格式 + 查询」给问答 agent、「Lint」给 lint 脚本作对照、「人类须知」只给人看。改规则只改这一个文件。

## 页面格式

每页是一个 markdown 文件，文件名 `<id>.md`，放在 `concepts/`（术语与特性页）、`params/`（参数页）或 `sources/`（来源摘要页、PR 页）。

### frontmatter

```yaml
---
id: kv-cache                      # kebab-case，与文件名一致；术语页与 Step.terms 的 id 一致
title: KV Cache                   # 英文原名
type: concept                     # concept | feature | param | source | pr
summary: 缓存每层每个 token 的 K 与 V，decode 时不再重算。   # 一句话，≤200 字，悬停卡直接用
aliases: [KV 缓存]                # 中文名与常见别称
chapters: ["05", "11"]            # 归属章节，两位数字符串
prerequisites: [attention]        # 读这页前该先懂什么，其它页的 id；没有就留空数组
sources:                          # 不得为空
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L120-L188
evidence: "C"                     # 必须加引号。这是**整页主体结论**的等级，不是「出现过的最高等级」
related: [paged-attention]        # 其它页的 id，双向
contradicts: []                   # 整合阶段发现矛盾时填 "<id>: 一句话"，留给人审
updated: "2026-09-07"             # 必须加引号，否则 YAML 会解析成日期对象
---
```

### 正文分节

正文用中文，英文术语、代码、标识符原样保留。

分节的依据是 [Diátaxis](https://diataxis.fr/) 的核心主张：**解释（为什么、怎么理解）与参考（精确事实）是两种不同的东西，必须分开**。混在一起的后果很实际——想查形状的人要跳过叙述，想理解原理的人被一串数字打断。骨架取自 [Kubernetes 的 concept 页模板](https://www.kubernetes.io/docs/contribute/style/page-content-types/)：概览 → 主体 → 接着看。

**术语页与特性页（`type: concept` / `feature`）用这七节，顺序不能变：**

1. `## 一句话`
   一段，不超过三行。和 frontmatter 的 `summary` 说同一件事但可以展开一点。这一节要能独立成立——读者只看它就该知道这页讲什么。

2. `## 为什么需要它`
   **解释**。先说没有它会怎样（具体到哪一步会慢、会爆显存、会算错），再说它怎么解决。可以讲历史与取舍：上游为什么这么设计、有没有别的做法、昇腾侧和上游有什么不同。这一节允许有观点，但观点要写明依据。

3. `## 怎么工作`
   **解释 + 图**。讲清楚数据怎么流、谁调用谁、状态怎么变。
   涉及结构关系时**必须画图**，用 mermaid 代码块（`flowchart` / `sequenceDiagram` / `stateDiagram-v2`）。图里出现的标识符必须是源码里真实存在的类名、函数名或字段名，不要为了画得好看编造盒子。图讲不清的细节写在图下方，不要把长句塞进节点。

4. `## 拿真实数字走一遍`
   **worked example**。用 Qwen3-0.6B 的真实维度（H=1024，n_q=16，n_kv=8，d_h=128，28 层）从头算到尾，每一步写出算式和结果，让读者能拿计算器复核。
   涉及配置项的页，这一节给一个完整可复制的配置片段并说明每个值的来由。
   实在不涉及可计算的量（例如纯流程类特性），可以省这一节，但要在 `## 怎么工作` 里给一个具体的调用实例。

5. `## 事实表`
   **参考**。只放能扫读的事实，不夹叙述：张量形状、默认值、取值范围、约束、对应的源码位置。用表格。每行的最后一列给来源（`文件#L起-L止`）。
   这一节的判断标准：读者扫一眼就能拿到数，不需要读句子。

6. `## 常见误解`
   一到三条，每条一句话点破，再一句说明为什么。这一节在试点里被验证有效，保留。

7. `## 接着看`
   **最多五条**，每条一个相对链接加半句理由（为什么现在该看它）。内容来自 `related`，但要挑选与排序，不是把 `related` 全倒出来。

**参数页（`type: param`）以参考为主，用这五节：**

1. `## 一句话`
2. `## 事实表`（默认值、类型、取值范围、联动、版本谱系；这一节由脚本生成，人和 agent 都不要手改）
3. `## 为什么存在`（解释）
4. `## 开了的代价`（什么时候该开、和谁互斥、有什么副作用）
5. `## 接着看`

**来源页与 PR 页（`type: source` / `pr`）** 不强制分节，按材料本身的结构写，但必须有 `## 一句话` 与 `## 接着看`。

### 链接与来源

链接用相对 markdown 链接：同目录 `[PagedAttention](paged-attention.md)`，跨目录 `[来源](../sources/xxx.md)`。不用 `[[wikilink]]`。引用代码片段时链接到 `../raw/<id>.md`。

`sources` 每项三种写法：

- `repo@commit:path#L起-L止` —— 源码。repo 是 `vllm-ascend`、`vllm`、`infer-lab` 之一，commit 是钉住的短 hash。
- `repo@commit:docs/source/<路径>.md#L起-L止` —— **官方文档的本地副本**。官网 <https://docs.vllm.ai/projects/ascend/> 就是这个目录渲染出来的，读本地文件与读官网内容同源，且能给出行号。
- `https://docs.vllm.ai/projects/ascend/en/<版本>/<路径>.html` —— 官方文档的线上地址。

**页级 `evidence` 取整页主体结论的等级，不是出现过的最高等级。** 一页引了两条官方文档、十五条源码，主体结论仍来自读源码，那它就是 `C` 不是 `S`。判断方法：把这页最核心的三条论断挑出来，看它们主要靠什么支撑。

**逐条结论用内联标记**（这是 PLAN §1.4 的原设计，页级字段表达不了混合来源）：在句末加 `[S]` / `[C]` / `[D]` / `[A]` / `[I]` / `[M]` / `[!]`，标明这一条的依据类型。例如：

> 后端只支持 `block_size = 128`，`get_supported_kernel_block_sizes` 直接返回 `[128]` [C]。官方文档建议长序列场景开启此项以降低碎片 [S]。按每 token 每层 4 KiB 推算，28 层共 112 KiB [D]。

引用官方文档时**本地行号与线上 URL 两个都要给**：前者可核对、后者可点开。版本段用你实际读的那个 ref 对应的版本（`main` 对应 `latest`，`releases/v0.23.0` 对应 `v0.23.0`）。官方文档站有 26 个活跃版本，不要笼统写 `latest`。

`docs/source/llms.txt` 是上游专门为 LLM 写的官方索引，逐节给出 canonical URL。找官方文档的入口先看它。

### 可引来源

**「读什么」不限，「引什么」才限。** 读得广理解才准——读一篇博客搞懂了某个机制，回源码核实后照常写进正文。但 `sources` 是「你可以去核对」的承诺，只能放下面这张表里的来源。

| 域名 | 是什么 | 档 |
|---|---|---|
| `docs.vllm.ai` | vLLM 与 vllm-ascend 官方文档 | 官方 |
| `www.hiascend.com` | 昇腾 / CANN 官方文档 | 官方 |
| `blog.vllm.ai` | vLLM 官方博客 | 官方 |
| `discuss.vllm.ai` | 官方用户论坛 | 官方 |
| `github.com/vllm-project/` | 上游仓库、issue、PR、release | 官方 |
| `gitee.com/ascend/` | 昇腾一手仓库（ATB 算子库等） | 官方 |
| `gitcode.com/Ascend/` | 昇腾一手仓库（msmodelslim 等） | 官方 |
| `gitcode.com/cann/` | CANN 一手仓库（ops-transformer 等） | 官方 |
| `arxiv.org` | 论文 | 论文 |
| `pytorch.org` | PyTorch / torch_npu 文档 | 生态 |
| `triton-lang.org` | Triton 文档 | 生态 |
| `huggingface.co` | 模型卡 | 生态 |
| `modelscope.cn` | 模型卡 | 生态 |
| `modelers.cn` | 模型卡 | 生态 |

规则：

- **`evidence: S` 要求至少一条「官方」或「论文」档的来源。** 生态站撑不起 S——引 PyTorch 文档说明 torch_npu 的行为是合理的，但那不是「vllm-ascend 官方直接支持」。
- **表外的站点可以引，但撑不起高等级**。白名单管的是「什么配得上高等级证据」，不是「什么都不许引」——引一篇博客并诚实标成 `I`（推断）是有用的，它告诉读者你的理解从哪来、且没能从一手来源确认。具体分三档：
  - 表外来源 + `evidence` 是 `S` 或 `C` → **报错**。拿博客冒充官方实证是真问题。
  - 表外来源 + `evidence` 是 `D`/`I`/`A` → **只警告**，人审时扫一眼。
  - 一页的来源**全部**在表外 → **报错**。这页没有任何可核对的一手依据，不该进知识库。
- **镜像站不可引**（`hf-mirror.com`、`mirrors.tuna.tsinghua.edu.cn`、`mirrors.huaweicloud.com` 等）——内容是别处的副本，要引就引原站。
- **AI 生成的二手知识库不可引**，包括 vllm-ascend README 挂徽章的 `deepwiki.com`。
- **本地优先**：本地仓库里能读到的就读本地（快、钉得住 commit、能给行号）。官网用于两种情况——渲染后才有的内容，以及本地没克隆的版本。
- 这张表与 `scripts/wiki/sources.ts` 的 `CITABLE_DOMAINS` 必须逐条一致，有测试锁住。发现新的权威来源就两边一起加。

写行号必须是你实际打开并阅读过的行。

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
- **三路对照读，不要只读源码**：
  1. **源码**（`--add-dir` 给你的本地仓库）——它是行为的最终依据，回答「实际怎么跑」。
  2. **本地文档**（同一仓库的 `docs/source/**.md`）——回答「为什么这么设计、什么时候该开、和谁互斥」，这些源码里没有。`docs/source/llms.txt` 是上游为 LLM 写的官方索引，先看它找入口，别顺着源码碰运气。
  3. **联网**（你有 WebFetch 与 WebSearch）——官网渲染页、昇腾官方文档、论文、社区讨论，读什么都行。
     但**读与引是两回事**：`sources` 只能放「可引来源」表里的；表外的读了可以帮你理解、可以写进正文叙述，但那条结论的 `evidence` 只能标 `I`。
     **本地优先**：本地仓库能读到的先读本地（快、钉得住 commit、能给行号），联网用于本地拿不到的东西。

  页级 `evidence` 取整页主体结论的等级——引了几条文档不等于整页都是 `S`（判定见「页面格式」）。逐条结论用内联标记 `[S]` / `[C]` / `[D]` 区分依据类型。引用文档时本地行号与线上 URL 都要给。
- **本地文档里的 `{{ 变量 }}` 用任务给的变量表展开，不要原样抄**。这套文档在正文里写的是占位符（全仓 226 处，`{{ vllm_ascend_version }}` 一个就占 167 处），且集中在安装命令、pip 版本、镜像 tag。照抄会把 `pip install vllm-ascend=={{ pip_vllm_ascend_version }}` 写进页面，学习者复制粘贴得到一条跑不了的命令。
  任务的 stdin 里会给出该 ref 的**文档变量表**——引擎已经从仓库里解好了（main 在 `mkdocs.yml` 的 `extra:`，v0.23.0 在 `docs/source/conf.py` 的 `myst_substitutions`），你直接查表替换即可，**不需要也不能上网**。表里没有的变量原样留着，会被 lint 抓出来当问题处理，不要自己猜一个值填上。
- **该画图就画图**。`## 怎么工作` 涉及数据流、映射关系、状态变化时必须给 mermaid 图。图里的标识符必须在源码里真实存在——你会被 lint 检查这一条。上游 `docs/` 里已有的图可以参考其表达方式，但不要复制图片文件，自己用 mermaid 重画。
- **`## 事实表` 里不写解释句**，只放能扫读的数与来源；解释归 `## 为什么需要它` 与 `## 怎么工作`。这两类混在一起是上一版格式最大的毛病。

## 整合

你是整合 agent。一次处理一批草稿，任务描述里列出草稿 id。

规则：
- 读 `_drafts/` 里列出的草稿，以及**任务里列出的那些现有页**（程序已按 related 与章节交集挑好，通常几页到几十页）。**不要自己去扫 `concepts/` 全库**——放量后那是上百页、几十万 token，会撞上下文且每批重读一遍。任务说「没有相关的」就是真的没有，直接晋升。对这些页做四件事：
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
- 检查 `## 接着看` 是否超过五条、是否只是把 `related` 原样倒出来。超了或没挑选就自己删减到五条以内，每条补上半句理由。
- 不写 `index.md`、`log.md`，它们由程序派生。
- 写完决策文件后回复一行 `DONE integrate promoted=<n> merged=<n> rejected=<n>`。

## 查询

你是课程知识库的问答 agent，回答学习者关于大模型推理、vLLM、vLLM-Ascend 与昇腾硬件的问题。

规则：
- 先读 `index.md` 找相关页，再读页面正文，再回答。
- **知识库里没有时，你可以联网查官方文档再答**（你有 WebFetch 与 WebSearch）。这种回答要明确写「知识库未收录，以下来自官方文档」并给出 URL，不要混在知识库结论里。实在查不到就说查不到，然后用自己的知识简短回答并标注「（未收录）」。
- 你需要联网这件事本身说明知识库缺了这一块，程序会记下来补页，所以不必为「显得知识库很全」而勉强用现有页硬答。
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
- `missing-section`：正文缺少「页面格式」为该 `type` 规定的必需 H2，或顺序不对。
- `whatsnext-overflow`：`## 接着看` 超过五条。
- `diagram-identifier`：mermaid 图里标注的文件名或符号，在该页 `sources` 覆盖的范围里找不到。
- `prerequisites-missing`：`prerequisites` 指向不存在的 id。
- `doc-evidence`：`sources` 里**多数**是官方文档（本地 `docs/` 副本或「官方」「论文」档的 URL）但 `evidence` 不是 `S`；或页级 `evidence` 为 `S` 而没有任何「官方」「论文」档的来源（生态站撑不起 S）。只查主体来源与页级等级是否一致，不因为引了一条文档就要求改标签。
- `source-domain`：表外来源撑起了 `S`/`C`，或一页的来源全在表外。
- `source-unlisted`（只警告不阻塞）：表外来源配 `D`/`I`/`A`，合法但值得人审留意。
- `unexpanded-placeholder`：正文里出现 `{{ ... }}`，说明照抄了本地文档的占位符而没去官网取展开值。
- `legacy-format`（迁移期，只警告不阻塞）：页面还是 2026-09-11 改版前的旧四节格式（是什么 / 形状与数值 / 在哪一步出现 / 常见误解）。重跑成新格式后这条应归零，届时删掉豁免。
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
- 官方文档站 <https://docs.vllm.ai/projects/ascend/> 有 26 个活跃版本，版本清单查 `https://app.readthedocs.org/api/v3/projects/vllm-ascend/versions/?active=true`。站上内容由仓库 `docs/source/` 渲染而来，但**版本号等占位符只有渲染后才有值**，所以本地与线上两路都要读。
