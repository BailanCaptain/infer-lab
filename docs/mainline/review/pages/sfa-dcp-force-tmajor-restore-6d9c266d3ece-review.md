# sfa_dcp_force_tmajor_restore 页审查记录

本文件由 P5 写手于 10-02 新建（此前本页没有 review 文件）。

## P5 写作记录（第 29 批小修，10-02）

### 旧版信息清单（现版 == `p4-checkpoint`，`git diff p4-checkpoint` 对本页无输出，故旧版=改前版）

1. 它是回退开关不是特性开关：DCP 解码 query all-gather 之后把 head-major 还原成 t-major，两条路——`permute` 出 strided view（默认）或再 `.contiguous()` 物化。
2. 默认 `false` 走 PR 优化后的路；PR 保留那次物化只为对照实验。
3. 存在范围：只在 main 开发主线；2026-09-16 PR #15970 引入；v0.23 / v0.26 分支上键、读取函数、`ops/triton/query_gather_prep.py` 都没有；那两个分支逐键 `.get()` 静默忽略，main 是 `extra="forbid"`。
4. 旧的「本页算例」一段：Qwen3-0.6B 单卡、DCP=1、非 SFA 稀疏模型，选到 `AscendSFAImpl`。
5. 事实表九行：类型/默认、唯一消费点、生效前提、只影响无 prefill 的那一趟、开了多做一次 `.contiguous()` 及元素数公式、关了零拷贝、DSA-CP 下失效、没有 `lru_cache`、官方参数表里没有这一行。
6. 「为什么存在」：DCP 沿序列切 KV、解码要 all-gather query；`all_gather` 只能在 dim 0 拼，所以先 `permute` 成 head-major；`prep_query_head_major` Triton kernel 省掉两次背靠背 all-gather、kernel 不适用时退回纯 torch；还原那几行的代码片段；`permute` 零成本、`.contiguous()` 才贵。
7. 「开了的代价」：每解码步每层一次整张 query 拷贝；批里有 prefill 时走 KV-gather 分支提前 `return`，本键到不了；DSA-CP（gather 维 0、`restore_perm=None`）下无行为差异且无告警；名字里的 `dcp` 不是 DSA-CP；没有 `lru_cache` 但配置是启动期单例，等价于常量。
8. 自动生成的「版本谱系」「参数定义」两节。

逐条勾选：1、2、3、5（除生效前提一行补了一层条件）、6、7、8 全部保留；第 4 条删掉并换成 GLM 双机一段，理由见下。

### 改了什么（四处，均为小修）

1. **第 4 条旧算例删除，换成「放到 GLM 双机：这个键是个死键，而且不是因为没开 DCP」。** Qwen3-0.6B 单卡是旧局部算例时代的残留，与本站 GLM 双机主线无关；本页此前一次都没提到 GLM 钉住的提交。新段写三层：①部署没传 `--decode-context-parallel-size`，DCP=1、PCP=1（一句话 + 链接 `context-parallel.md#放到-glm-双机这套部署开了-cp-吗`，不重讲）；②更靠前的门在源码里——`model_uses_sfa_sparse` 开头先 `model_uses_kpool_indexer` 排除，函数注释原文说的就是 GLM-5.3-Flash 这类模型（`vllm-ascend@baa023ad:vllm_ascend/utils.py#L177-L198`，作为本页第 21 条来源新增）；③因此即便换到 main 把 DCP 开大，`enable_sfa_dcp_replicated_indexer` 对 GLM 仍为假，`resolve_sfa_impl` 选不到带 DCP 的类，本键那一行永远走不到。末尾加 `attention-backend-family.md#一个稀疏-mla-层其实注册了三个条目` 链接（队列指定的两个依赖页现在正文里都有入链，此前只写在 frontmatter 的 relations 里）。
2. **「存在范围」补 GLM 钉住提交的版本证据。** 原文只对照 v0.23 / v0.26，没提 `db701c1f`。补一句：`db701c1f` 同样没有这个键，`AscendConfig` 与那两个分支同一套逐键 `.get()` 写法，所以写进 `additional_config` 既不报错也不生效。
3. **事实表「生效前提」补一层条件**：「模型走 SFA 稀疏注意力（kpool indexer 那一类被判断开头排除在外）」，并在「意味着什么」里点明 GLM 卡在第一条上。原写法只写两条与 `decode_context_parallel_size > 1`，照字面读会让人以为 GLM 只要把 DCP 开大就能用上。
4. **「开了的代价」补一段「配置推出来的量 ≠ 测出来的效果」**：那串乘法是被多拷贝的元素个数（由形状定），换算成微秒取决于带宽与 kernel 排布；PR 只给了优化理由没给前后数据，官方文档也没有，本站这套部署开不到它。按要求写了缺口：待核：缺一组同模型、同 DCP 组大小下开与关的解码时延对照。

### 版本证据（本轮实际运行的核对，均在 `tools/repos/vllm-ascend`）

- `git log -1 --format='%h %ad %s' --date=short baa023ad` → 2026-09-21。钉住的 main 晚于 PR #15970（2026-09-16），所以本站 main 口径上这个键确实存在。
- `git show baa023ad:vllm_ascend/utils.py | sed -n '1500,1506p'` → `enable_sfa_dcp_force_tmajor_restore()` 读 `get_ascend_config().sfa_dcp_force_tmajor_restore`，确无 `lru_cache`（相邻的 `enable_dsa_cp`、`enable_pcp_o_proj_weight_sharding` 都有）。
- `git grep -c 'sfa_dcp_force_tmajor_restore' <commit> -- vllm_ascend`：`2c59ff10`（v0.23 维护分支）、`2ed6cbba`（v0.26）、`db701c1f`（含 GLM 代码的 orphan）三个提交都是 0 命中。
- `git show db701c1f:vllm_ascend/ascend_config.py | sed -n '28,40p'` → `__init__` 里对每个键 `additional_config.get(...)`，未知键无日志、无报错。
- `resolve_sfa_impl`（`baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1575-L1590`）：DCP 分支的门是 `enable_sfa_dcp_replicated_indexer()`；该函数（`utils.py#L201-L208`）= `model_uses_sfa_sparse(model_config) and decode_context_parallel_size > 1`。
- `model_uses_sfa_sparse`（`utils.py#L187-L198`）第一件事是 `if model_uses_kpool_indexer(model_config): return False`；`model_uses_kpool_indexer`（`#L177-L184`）的 docstring 自述覆盖「GLM-5.3-Flash style kpool indexer models」。
- 唯一消费点与 prefill 分支复核：`sfa_cp.py#L1436-L1438` 传 `keep_view=not enable_sfa_dcp_force_tmajor_restore()`；`_finish_dcp_gather`（`#L1146-L1157`）里 `restore_perm is None` 时 `permute`/`contiguous` 整段跳过；`#L1380-L1392` 有 prefill 时走 KV-gather 分支，并用 `tuple(t.contiguous() ...)` 自己写死连续化，与本键无关。页面原有的这三条结论与源码一致，未改。

### 数字出处

本页没有新增任何部署数字。拷贝量仍是形状推导（`num_tokens × dcp_size × num_heads × (head_dim + rope_dim)` 个元素，标 `[D]`），本轮只补了「这是配置推导量、不是实测效果」的说明。GLM 侧的部署参数只以一句话 + 链接的形式引用 `context-parallel.md` 与 `glm-5-3-flash-two-node.md#部署前提`，不重算。

### 图

按队列要求沿用现状：本页原本没有 `wiki-diagram`，本轮不新增、不改任何 yaml/svg。

### 验证（本轮实际运行）

- `pnpm wiki:lint`：本页 0 报错。中途曾报两条并当场修掉——`[mark-index] [C27] 指向第 27 条来源，但本页只有 21 条`（来源计数把 `rawSources` 算进去了，改为 `[C21]`）和 `[mark-flood] 内联标记 32 处，超过 30`（删掉两处可由上下文承担的标记，现 29 处）。
- `pnpm wiki:diagrams --check`：`ok wiki:diagrams 290 张图与 spec 一致`（另有他页 `vllm-ascend-repo-map.yaml` 的代码名提示，不在本页）。
- `pnpm wiki:audit`：本页一行为 `evidence=C 章节=15 正文 6379 字 / 6 节 来源 21 条`，无报错。
- 字数：去空白的正文字符数 7967 → 9745（`awk` 去 frontmatter 后 `tr -d '[:space:]' | wc -m`）；audit 口径现 6379 字。
- 未起服务、未截图（按派发要求，浏览器验收归审查）。

### 自查疑点

- 无 P1。可提的 P3：事实表「同时开了 DSA-CP 本键失效」这一条仍是顺着 MRO 推的（页面已标 `[D]` `[!]`），没有一行源码直接写「DSA-CP 时忽略本键」；若审查希望坐实，需要跑一次 `enable_dsa_cp: true` 的用例看 `restore_perm`。
- 读 `docs/mainline/02-forward.md` §5.5 时被安全分类器拦了一次，之后未再读该底稿；本轮没有从该节取数（本页也不需要新数字），GLM 侧事实改为直接核钉住版本源码 + 引用已达标的 CP 页。

## P5 审查（10-02）

审查员：独立审查（只审不改页）。口径：参数页小修，四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 自动生成两节，不按深入页骨架扣分。

### 结论：8.5 / 10；audit 本页通过；P1 0 条，P2 1 条，P3 4 条

### 旧版信息清单
- 清单存在：写手自建在本文件「P5 写作记录 → 旧版信息清单」，共 8 条。
- 抽查 6 条到新版（`awk` 去 frontmatter 后对行）：第 1 条（回退开关、两条还原路）→ 第 82 行在；第 2 条（默认 false 是优化路、物化留作对照）→ 第 84 行在；第 3 条（只在 main、#15970、v0.23/v0.26 无键无函数无 kernel 文件、`.get()` 静默 vs `extra="forbid"`）→ 第 86 行在；第 5 条（事实表九行）→ 第 94–102 行九行齐；第 6 条（dim 0 拼接、head-major、Triton 预处理与 torch 回退、代码片段、permute 零成本）→ 第 106–121 行在；第 7 条（每步每层拷贝、prefill 分支提前 return、DSA-CP 无差异无告警、dcp≠DSA-CP、无 lru_cache 但单例）→ 第 125–133 行在。勾选属实。
- `git diff -- <页>` 只删了 4 行正文（第 86、88、96、106 行的旧写法，均被同位置新行取代）和 `updated`；没有别的删减。

### 重点 1：新结论「GLM 即便 DCP>1 也走不到本键」——独立核实，成立
推断链逐环对照钉住版本源码（`tools/repos/vllm-ascend`）：
1. GLM 的 config 带 `index_kpool` 字段（底稿 01 第 209 行：`compress_ratio = index_kpool = 4`）。
2. `baa023ad:vllm_ascend/utils.py#L177-L184` `model_uses_kpool_indexer` 就是查 hf config 有没有 `index_kpool` → GLM 为真；docstring 原话指 GLM-5.3-Flash 一类，页面转述准确。
3. 同文件 `#L187-L198` `model_uses_sfa_sparse` 在第 192 行先排除 kpool → GLM 为假；`#L201-L208` `enable_sfa_dcp_replicated_indexer` = 前者 且 DCP>1 → GLM 恒假。
4. `sfa_cp.py#L1575-L1590` `resolve_sfa_impl` 只在 `dcp_enabled` 时返回三个带 DCP 的类；`git grep` 全仓：本键唯一读点 `sfa_cp.py:1437` 在 `AscendSFADCPImpl`（第 1034 行起）里，子类只有同文件第 1467、1553 行两个，选择入口只有 `sfa_v1.py:312` 一处。没有旁路。
5. 另外两条更强的佐证（页面没写，不扣分）：`utils.py#L1750-L1759` `enable_sfa` 同样先排除 kpool，GLM 在 main 上根本不走 SFA 后端；`attention/indexer_kpool.py:316` 遇 PCP/DCP 直接 `NotImplementedError`。
6. 版本侧：`git grep -c sfa_dcp_force_tmajor_restore` 在 2c59ff10 / 2ed6cbba / db701c1f 为 0，baa023ad 有 3 个文件命中；db701c1f 的 `AscendConfig.__init__` 确为逐键 `.get()`（第 32–40 行）。写手新增的 db701c1f 一句成立。
7. 「PR 只写了优化理由、没有开/关对照数据」：读了合入提交 8f26bb734 的提交说明，测试只写了 AISBench + GSM8K，无时延数据，成立。

### 重点 2：删掉旧 Qwen3 算例——没丢有用信息
旧第 87 行只说 Qwen3-0.6B 单卡 DCP=1、非 SFA 稀疏模型、`resolve_sfa_impl` 回落到 `AscendSFAImpl` [C12]。这是旧局部算例时代的残留，且「非 SFA 模型走 `resolve_sfa_impl`」本身就别扭（非 SFA 模型不进 SFA 后端）。唯一被拿掉的信息点是「门不满足时回落到哪个类」，新文「选不到带 DCP 的实现类」已足够。见 P3-3。

### 数字
页面没有新增任何部署数字：GLM 部署形状只一句话 + 链接（部署前提、CP 页 GLM 节），DCP=1/PCP=1 引 CP 页第 161 行，拷贝量仍是形状公式 `[D]`，「开了的代价」新加的一段明确写成「配置推出来的量 ≠ 实测效果」并留了待核。没有重算、没有虚构收益、没有把 GLM 主线数字当成本键效果。写手未读底稿 02 §5.5 不影响本页（本页不需要该节数字）。

### 链接与校验（本轮实际运行）
- 新增 4 个链接的锚点都在：`glm-5-3-flash-two-node.md:49`、`context-parallel.md:107`、`:157`、`attention-backend-family.md:124`。
- `pnpm wiki:lint`：通过，本页 0 条；`pnpm wiki:audit`：exit 0，本页 `evidence=C 章节=15 正文 6379 字 / 6 节 来源 21 条`，无报错。
- 入链：全库只有 `wiki/index.md` 指向本页。
- 浏览器：Playwright 1440 宽打开 `http://localhost:5193/#/wiki/sfa-dcp-force-tmajor-restore-6d9c266d3ece`，第一屏渲染正常，新段落与四个链接显示正常（截图 `1237c9d2-…/scratchpad/sfa-dcp-force-tmajor-restore-6d9c266d3ece-review-1.png`、`-2.png`）。本页无图、无分镜。

### P2
1. **第 88 行「更靠前的一道门」没标版本，和 CP 页会读出矛盾。** kpool 排除只在 main 上有：GLM 钉住的 `db701c1f:vllm_ascend/utils.py#L114-L122` 里 `model_uses_sfa_sparse` 没有这道排除，GLM 会被认作 SFA 稀疏模型——CP 页第 179 行「平台层放行了」说的就是这个版本。本页结论没错（db701c1f 上本键根本不存在），但这句没写「main 上」，读者对照两页会以为互相打架。改法：这句前加「main 上」，并顺手补半句 main 的 kpool 索引器遇 DCP 直接报 NotImplementedError（链接 CP 页那一节，不重讲）。

### P3
1. 第 82 行（首次出现）就用 DCP，全称和链接到第 106 行才给——写手把解释加在了第二次出现处。改法：把「DCP（decode context parallel…；见上下文并行）」挪到第 82 行首次出现处。kpool indexer 第 88 行首次出现也可加四五个字的白话。
2. 第 88 行以 docstring 为「GLM 属于这一类」的依据，真正的判据是 config 有没有 `index_kpool`（GLM = 4）。可改成点名这个字段，比引注释更硬。
3. 删掉旧算例后，第 12 条来源在正文里已无引用（现正文引到 C13、C20、C21，无 C12）；lint 不报，可留可删。
4. 「放到 GLM 双机」一段放在「一句话」节里、早于「为什么存在」。参数页四段式下可接受（旧算例原本也在这个位置），只作提示。

### 跳过
未读 frontmatter 的 sources 区、代码块、版本谱系与参数定义两节正文；未读底稿 02 §5.5（本页不需要）。

## P5 修订记录（10-02，按审查）

**P2-1 成立，已改。** 「一句话」节 GLM 段里的 kpool 排除那道门补上了版本限定：明写「这道门只在 main 上有」，并给出钉住提交的反证——`db701c1f:vllm_ascend/utils.py#L114-L122` 的同名 `model_uses_sfa_sparse` 只查 `index_topk` 与 `compress_ratios`，没有 kpool 这一句，连 `model_uses_kpool_indexer` 这个函数都还不存在（本轮核：`git grep -c 'model_uses_kpool_indexer' <commit> -- vllm_ascend/utils.py` 在 `2c59ff10`、`2ed6cbba`、`db701c1f` 上都是 0 命中，只有 `baa023ad` 命中 3 处）。同时说明那个提交上本键本身也不存在，所以与 CP 页不构成两种说法。该反证作为本页第 22 条来源新增（`[C22]`）。

**P3-1 成立，已改。** DCP 的全称与链接从「为什么存在」挪到了「一句话」第一句的首次出现处（`DCP（decode context parallel，解码期的上下文并行；历史位置怎么分着存见上下文并行）`），「为什么存在」里那处改回裸用 DCP。

**P3-2 成立，已改。** 不再以 docstring 作为「GLM 属于这一类」的唯一依据，改为点名硬判据：`model_uses_kpool_indexer` 看 hf config 上有没有 `index_kpool` 字段，GLM 的配置里有（它就是稀疏 MLA 里 kpool 的粒度；`baa023ad:vllm_ascend/attention/indexer_kpool.py#L325` 读的就是这个字段），docstring 的点名改成旁证。

**P3-3 不改。** 第 12 条来源在正文里已无引用，但来源编号是按位置算的，删掉它会把 C13–C22 全部前移、页面上所有标记要跟着改，风险大于收益；lint 不报此项。

**P3-4 不改。** 「放到 GLM 双机」一段留在「一句话」节内（旧算例原本也在这个位置），参数页四段式下这是唯一能承接「本部署用不到它」的位置。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0（`ok wiki:lint 通过（另有 5 处待留意）`，5 处均为他页 mark-flood 提示）；`pnpm wiki:diagrams --check` exit 0；`pnpm wiki:audit` exit 0，本页 `evidence=C 章节=15 正文 6632 字 / 6 节 来源 22 条`。内联标记 30 处（上限 30）。未起服务、未截图。
