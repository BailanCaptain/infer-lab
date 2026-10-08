# enable_pcp_o_proj_weight_sharding 审阅记录

## P5 写作记录（10-02，小修）

**改了什么。** 保持参数页 4 段式（一句话 / 事实表 / 为什么存在 / 开了的代价 / 版本谱系 / 参数定义（自动生成）），事实表仍是 10 行（没加行，避免触发 facts-overflow），只动三处正文加 frontmatter：

1. 「存在范围」改版本口径。原文写「只在 main 开发主线上有」，与本页「版本谱系」表自相矛盾（表里 v0.28.0rc、v0.29.0rc 都是「有」）。改成：2026-09-07 由 PR #14814 引入，main 之外也进了后来拉出的 v0.28.0rc、v0.29.0rc；**本库钉住的三个对照版本里只有 main（`baa023ad`，09-21）含它**，v0.23（`2c59ff10`）、v0.26（`2ed6cbba`）没有，且那两条分支上 `vllm_ascend/weight_switch/` 整个目录都不存在。未知键的两种后果（发布分支静默忽略 / 钉住 main `extra="forbid"` 起不来）保留并点明是钉住 main。
2. 删掉悬空的旧算例句（原文「本页旧算例用不到它：Qwen3-0.6B 单卡……」——页上已没有那个算例，且 Qwen3-0.6B 不是本库主线模型），换成 GLM 双机一段：PCP=1 / DCP=1，`resolve_sfa_impl` 选的是不带 CP 的 `AscendSFAImpl`，读键的代码不在选中类里、也没有 warning；想开也开不了，34 层 KDA 在 PCP > 1 时 prefill 抛 `NotImplementedError`（一句话 + 链接 context-parallel 的 GLM 节）；稀疏 MLA 的 `o_proj` 本来按 TP8 行切，切法与每卡形状只链接 tensor-parallel 页的稀疏 MLA 节，本页不重算。
3. 「开了的代价」末尾加「待核」三条：没有任何实测显存/时延（`1/pcp_size` 与净省估式都是按切法推的量级，不当收益，也不拿 GLM 主线数字充当它的效果）；PCP+DCP 变体 `AscendSFAPCPDCPImpl` 只核到继承关系、前向路径未逐行核；GLM 的 `NotImplementedError` 取自 context-parallel 页已核结论。
4. frontmatter：summary 末句改成钉住版本口径 + GLM 不开 PCP（仍 ≤200 字，lint 通过），`updated` 改 2026-10-02。

**旧版信息清单（小修，短）。** `git diff --stat p4-checkpoint -- <页>` 为空，现版与 p4-checkpoint 一致。逐条勾选：①加载期按 PCP 组切、常驻 `1/pcp_size` ✓；②prefill all-gather、decode all-reduce 的分叉 ✓；③默认 `false` ✓；④只有 `AscendSFAPCPImpl` / `AscendSFAPCPDCPImpl` 读它 ✓；⑤对 DSA-CP 无效 ✓；⑥gather buffer 跨层共用、净省估式 ✓；⑦两条 `RuntimeError`（整除、`WeightSwitchMixin`）✓；⑧`lru_cache(maxsize=1)` + `clear_enable_sp()` ✓；⑨`layer_sharding` 缺口的唯一旋钮 ✓；⑩官方参数表无此行 ✓；⑪「只在 main 上有」✗ 已改正（与本页版本谱系冲突）；⑫Qwen3-0.6B 单卡算例句 ✗ 已删（悬空引用、非主线模型），替换为 GLM 双机段。

**数字与出处。** 本页不出部署数字。GLM 的 `o_proj` 每卡形状（KDA `[4096,1024]`、稀疏 MLA `[4096,2048]`，对应底稿 `docs/mainline/02-forward.md` §4.3 第 273/280 行、§5.2 第 396/519 行）只链接 `wiki/concepts/tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制`，不复述、不重算。

**核实了什么（本轮实际运行，均对钉住 main `baa023ad`）。**
- 键存在性：`git grep -l 'enable_pcp_o_proj_weight_sharding' baa023ad -- vllm_ascend` → `ascend_config.py`、`attention/context_parallel/sfa_cp.py`、`utils.py` 三个文件；`2ed6cbba`、`2c59ff10` 无输出。
- 默认值：`baa023ad:vllm_ascend/ascend_config.py:468` 为 `enable_pcp_o_proj_weight_sharding: bool = False`（L332 是 docstring 全量键示例里的 `false`）。
- 读取方式：`baa023ad:vllm_ascend/utils.py:1508-1519` 是 `@lru_cache(maxsize=1)` 的读取函数，docstring 自己写明「load-time option」「DSA-CP does not use this user-controlled option」；`utils.py:208-216` 的 `clear_enable_sp()` 里有它的 `cache_clear()`。
- 生效门与切法：`baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py:58-96`（读 ≤40 行）：`class AscendSFAPCPImpl(OProjWeightSwitchMixin, AscendSFAImpl)`，`__init__` 里 `WeightSwitchConfig.from_group(get_pcp_group(), shard_axis="input")`、键为假就 `return`、为真才算 `WeightLoadPartition.from_nested_groups(get_tp_group(), get_pcp_group())` 并 `prepare_layer_for_parallel_weight_load`；`process_weights_after_loading` 里再 `_enable_o_proj_full_weight_switch()`。类列表里 PCP+DCP 变体是 L1467 的 `AscendSFAPCPDCPImpl`。
- 未知键处理：`git grep -n 'extra="forbid"' baa023ad -- vllm_ascend/ascend_config.py` 共 10 处，顶层 `class AscendConfig`（L296）带 `model_config = ConfigDict(extra="forbid")`（L455）；`2ed6cbba` 为 0 处。
- GLM 不开 PCP：`wiki/concepts/context-parallel.md` L157–L182。

**三项检查。** `pnpm wiki:lint` 本页 0 报错（全库通过，另有 6 处待留意，均属其他页）；`pnpm wiki:audit` 通过，本页 `evidence=C`、来源 20 条、正文 6919 字 / 6 节；本页无 wiki-diagram 块（队列写「沿用现有图」，页上本来就没有图），未改任何 yaml/svg，故未跑 `wiki:diagrams --check`。正文字数 9753 → 11078 字符（去 frontmatter 的 `wc -m`）。

**疑点 / 跳过。** 无 P1 疑点：默认值、生效门、`RuntimeError` 两条约束都在钉住 main 的源码上对上了；原「只在 main 上有」属版本口径错，已改。跳过：一次 `git grep` 读 `ascend_config.py` 未知键处理被安全分类器拦下，改窄口径（只数 `extra="forbid"` 与类名行号）完成；两页都未起服务、未截图。

## P5 审查（10-02）

审查员：独立审查（只审不改）。口径：参数页小修，只看任务文件写明的问题 + 本轮改动的句子，顺带记下读到的旧错；不按深入页骨架扣分。与同批 `enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9` 对照口径。

**分数：9 / 10。** P1 0 条，P2 1 条，P3 4 条。`pnpm wiki:audit` 本页通过（evidence=C，来源 20 条全部 ✓，exit 0）；`pnpm wiki:lint` exit 0，本页无告警（含跨页锚点 `context-parallel.md#放到-glm-双机这套部署开了-cp-吗`、`tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制`，后者对应该页 L311 标题）。

### 旧版信息清单
- 独立 `p5\<页面 id>-facts.md` 不存在；清单在本文件「P5 写作记录」第 12 行（12 条），小修页按此认可为「已列」，位置偏差记 P3-4。
- 抽查 6 条：①常驻 `1/pcp_size` 在 L79/L96 ✓；②prefill all-gather / decode all-reduce 分叉在 L98、L111 ✓（`baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py` L105–L106 的 `DecodeOnly`/`SpecDecoding` 判断、L148 PCP 组 `all_reduce`）；③默认 `false` 在 L79/L93 ✓（`ascend_config.py:468`）；④只有 `AscendSFAPCPImpl`/`AscendSFAPCPDCPImpl` 读它在 L94 ✓（`git grep` 只命中 `sfa_cp.py` L72–L89，位于 L58 的 `class AscendSFAPCPImpl` 内）；⑧`lru_cache` + `clear_enable_sp()` 在 L99/L127 ✓（`utils.py` L1509–L1510、L214）；⑫Qwen3 算例句已删、PCP=1 → `AscendSFAImpl` [C7] 这条有用信息挪进 L85 ✓。
- `git diff p4-checkpoint` 删除行只有 summary 末句、updated、「存在范围」段和 Qwen3 句，均有对应新表述，无丢失。

### 任务要点核对
- **「v0.28/v0.29 也有」属实**（用 git 在 `tools/repos/vllm-ascend` 核）：`git grep -l enable_pcp_o_proj_weight_sharding` 在 `origin/releases/v0.28.0rc`（56b8bb7f8）、`v0.29.0rc`（b3d3bb680）各 3 个文件，默认都是 `bool = False`（L467 / L468）；`v0.27.1rc`、`v0.26.0rc` 分支头为 0；钉住的 `2c59ff10`、`2ed6cbba` 为 0，`baa023ad` 为 3。PR #14814 的提交 `78cd10dec`（2026-09-07）是 `baa023ad`、v0.28.0rc、v0.29.0rc 的祖先，不是 `2ed6cbba`、`2c59ff10` 的祖先。`vllm_ascend/weight_switch/` 在 `2c59ff10`、`2ed6cbba` 下 0 个文件、`baa023ad` 下 3 个 ✓。改正正确，与页内版本谱系表一致。
- **删 Qwen3 句删得对**：旧版 L84 是全页唯一一处「算例」字样，页上并无该算例（悬空）；句中「也不是 SFA 模型」与「`resolve_sfa_impl` 选 `AscendSFAImpl`」自相矛盾（非 SFA 模型根本不走这个选择器）。唯一有用的事实已在 L85 的 GLM 段保留并沿用 [C7]，没丢信息。
- **GLM 双机 PCP=1 的实际效果（按源码核）**：`sfa_cp.py` L1575–L1590 `resolve_sfa_impl` 按 `enable_dsa_cp` / DCP replicated indexer / PCP>1 选类；`enable_dsa_cp` 默认 `False`（`ascend_config.py:465`），底稿 02 L1058 记录教程无 `--additional-config`；`enable_sfa_dcp_replicated_indexer`（`utils.py` L201–L208）要 DCP>1 → 全不成立，返回 `AscendSFAImpl`，不读本键 ✓。`ascend_config.py` 里本键只有 L332 docstring 与 L468 字段，没有 validator → 「配上去也没有 warning」✓。「34 层 KDA、11 层稀疏 MLA」与 `glm-5-3-flash.md` L100 一致；KDA 在 PCP>1 抛 `NotImplementedError` 与 `context-parallel.md` L178 一致，并链接 ✓。
- **不编收益、不挪用 GLM 数字**：L129 明确没有实测、不拿 GLM 主线数字充当效果 ✓；`o_proj` 每卡形状只链接 TP 页（该页 L559 `[4096,2048]`），本页未重算 ✓。
- **两页口径一致**：钉住三版本口径、「钉住 main 顶层 `AscendConfig` 是 `extra="forbid"`」（`baa023ad:ascend_config.py` L296/L455，L1613–L1627 只剥非用户键）、GLM 段的两条理由（PCP=1 门不成立 + KDA `NotImplementedError`，同一锚点）两页一致 ✓。
- 截图（写手未截，审查补截，5193 只读访问，1440 宽）：`scratchpad\enable-pcp-o-proj-weight-sharding-8528cf5af9c6-review-first.png`、`-review-facts.png`，一句话 / 存在范围 / GLM 段渲染正常。本页无图，无分镜。

### P2
1. **L106「PCP 开到 2、4 就意味着这块权重在组里多存了 2、4 份」差一。**（旧版遗留，本轮未动。）PCP=2 时组里共 2 份、多出的是 1 份；PCP=4 时多出 3 份。改法：「PCP 开到 2、4，组里就存着 2、4 份一模一样的 `o_proj`（多出 1、3 份）」。

### P3
1. `wiki/params/layer-sharding.md:130` 仍写「只有 main 上才有」这个键，和本页改正后的口径（v0.28.0rc / v0.29.0rc 也有；钉住三版本里只有 main）不一致，建议改成「钉住的三版本里只有 main 有（v0.28/v0.29 发布分支也已带上）」并加链接到本页。
2. `wiki/index.md:115` 条目仍是旧 summary（「在册版本里只有 main 有」），待 `wiki:build` 重新生成。
3. L85「想开也开不了：…KDA 抛 `NotImplementedError`，**而且** 11 层稀疏 MLA 的 `o_proj` 本来就按 TP8 行切」——后半句不是「开不了」的理由，「而且」读起来像第二条原因；建议拆成单独一句「顺带一提：…」。
4. 旧版信息清单写在 review 记录里而非 `p5\<页面 id>-facts.md`；记录第 12 行「diff 为空、与 p4-checkpoint 一致」指改前状态，现在 diff 为 7+/4−，建议注明「改前」。

**跳过：** 「参数定义（自动生成）」区、sources 区、`weight_switch/` 下整除与 `WeightSwitchMixin` 两条 `RuntimeError` 的源码行（旧结论、本轮未改，由 audit 校验来源行号）。

## P5 修订记录（10-02，按审查）

**P2-1 成立，已改。** 「PCP 开到 2、4 就意味着这块权重在组里多存了 2、4 份」差一，改成「PCP 开到 2、4，组里就存着 2、4 份一模一样的 `o_proj`（比不复制多出 1、3 份）」。

**P3-3 成立，已改。** 「想开也开不了」那句里用「而且」接的后半句不是开不了的理由，已拆开：前半句只留 KDA 在 PCP > 1 抛 `NotImplementedError`；稀疏 MLA 的 `o_proj` 按 TP8 行切改成单独一句「顺带一提」，链接不变（`tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制`）。

**P3-4 成立，已注明。** 上面「P5 写作记录」里「`git diff --stat p4-checkpoint` 为空」指的是**改前**状态，改完后该页 diff 非空。

**P1 对照（本页无 P1，但按同批口径自查）。** 同批 embedding/lm-head 页的 P1 是「LM Head 取分数路径不变」写错（实际多一次 PCP 组 all-gather）。本页通篇没有 logits / 取分数的表述（grep `logits|取分数|路径不变` 无命中），不存在同类错；本页讲的是 `o_proj` 自己的两条路径：prefill 现 all-gather 权重，decode 各算部分和后在 PCP 组 all-reduce，与 `baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py` L58–L96 一致。两页「钉住三版本口径 + 钉住 main `extra="forbid"` + GLM 段两条理由」保持一致。

**P3-1 未做，原因写明。** 建议改的是另一页 `wiki/params/layer-sharding.md:130`（「只有 main 上才有」）。该文件此刻在工作区里是已修改状态（`git status --short` 显示 `M`），说明同批有别的写手正在动它；按派发纪律「只改自己两页」，不去改它。建议的新口径与链接照抄给主会话：改成「钉住的三版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上）」并链到本页。

**P3-2 未做，原因写明。** `wiki/index.md:115` 是 `pnpm wiki:build` 生成的（输出 `wiki/index.md` 与 `src/content/wiki/registry.json`），重建会连带写入同批其他写手正在改的页，超出本次范围，留给主会话收尾时统一重建。本页 frontmatter summary 已是新口径。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0；`pnpm wiki:diagrams --check` exit 0；`pnpm wiki:audit` exit 0，本页 `evidence=C`、来源 20 条全部 ✓、正文 6939 字 / 6 节。未起服务、未截图（本页无图）。
