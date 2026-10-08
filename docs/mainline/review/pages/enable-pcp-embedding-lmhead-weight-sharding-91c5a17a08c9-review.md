# enable_pcp_embedding_lmhead_weight_sharding 审阅记录

## P5 写作记录（10-02，小修）

**改了什么。** 保持参数页 4 段式（一句话 / 参数定义（自动生成） / 事实表 / 为什么存在 / 开了的代价 / 版本谱系），只动三处：

1. 一句话加了一段版本口径：这个键 2026-09-23 才随 PR #17159 进上游 main，比本库钉住的 main（`baa023ad`，09-21）晚两天，钉住的 v0.23（`2c59ff10`）、v0.26（`2ed6cbba`）也都没有；「参数定义」那张自动生成的表读的是参数扫描当时的上游 main（`4d1412d1`，09-26），不是钉住版本。原文只写「只在 main 上有」，读者会以为钉住版本能用。
2. 事实表：①「与细粒度 TP」改成逐权重判（`embed_tokens` 撞 `embedding_tensor_parallel_size`、名字带 `head` 的撞 `lmhead_tensor_parallel_size`），原文「任一开着就报错」没写清是按权重分别判的；②「覆盖版本」补钉住三版本都没有它，并区分两种后果（发布分支逐键 `.get()` 静默忽略 / 钉住 main 顶层 `AscendConfig` 是 `extra="forbid"`，写了会被当未知键拒）；③新增「GLM 双机」一行：PCP=1、DCP=1 门不成立，且 KDA 的 prefill 在 PCP>1 抛 `NotImplementedError`，一句话加链接指向 context-parallel 的 GLM 节；每卡 embedding / `lm_head` 份额只链接 glm-5-3-flash-two-node 的「每张卡上放了什么」，本页不重算。事实表 9 行，未超 10 行。
3. 开了的代价：补运行时代价（embedding 侧查表结果要先在 PCP 组交换、再在 TP 组归约，LM Head 侧这两个组都不设），并加「待核」三条——没有任何实测显存/时延（1/PCP 只是按切分方式推的量级，不当收益）、钉住版本读不到实现、「钉住 main 上写它会被拒」是按 `extra="forbid"` 推的未实跑。
4. frontmatter：summary 末句换成钉住版本口径（lint 曾因超 200 字报 schema，已缩短到合法），`updated` 改 2026-10-02。

**旧版信息清单（小修，短）。** `git diff --stat p4-checkpoint -- <页>` 为空，现版与 p4-checkpoint 完全一致，旧版结论没有丢失项。逐条勾选：①默认 `true` ✓ 保留；②TP×PCP 网格、PCP 内维、每卡 1/(TP×PCP) ✓ 保留；③生效门三条件 ✓ 保留；④与细粒度 TP 互斥 ✓ 保留并改精确；⑤与 `enable_reduce_sample` 的启动期 `ValueError` ✓ 保留；⑥`lru_cache` + `refresh` 清缓存 ✓ 保留；⑦官方文档口径 ✓ 保留；⑧`disable_tp` 复制权重被绕开 ✓ 保留；⑨「只有 main」✓ 保留并补钉住版本口径；⑩版本谱系表（自动生成）✓ 未动。

**数字与出处。** 本页不出部署数字；每卡 embedding / `lm_head` 的 151.25 MiB 份额只链接 `wiki/concepts/glm-5-3-flash-two-node.md#每张卡上放了什么`（对应底稿 `docs/mainline/02-forward.md` §2.3 第 189 行、§7.3 第 795 行），不重算、不复述。

**核实了什么（本轮实际运行）。**
- `git -C tools/repos/vllm-ascend grep -l 'enable_pcp_embedding_lmhead_weight_sharding' baa023ad -- vllm_ascend` 无输出 → 钉住 main 不含该键；`git merge-base --is-ancestor f4ee3b53 baa023ad` 为假 → PR #17159 不在钉住 main 里；`2ed6cbba`、`2c59ff10` 同样无输出。
- 默认值：`4d1412d1:vllm_ascend/ascend_config.py:578` 为 `enable_pcp_embedding_lmhead_weight_sharding: bool = True`（grep 行号），L436 是 docstring 全量键示例，L925–L930 是与 `enable_reduce_sample` 的冲突分支。
- 生效门与网格：`4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py` L100–L135（读 ≤25 行）：`disable_tp` 先返回复制布局；`is_token_embedding = "embed_tokens" in prefix`、`is_lm_head = "head" in prefix`、键为真、`prefill_context_parallel_size > 1` 四者构成门；`VocabParallelMode.PCP_X_TP`，rank = `tp_rank * pcp_world + pcp_rank`、world = `tp_world * pcp_world`（故每卡 1/(TP×PCP)）；embedding 带 `token_exchange_group=pcp_group`、`output_reduce_group=tp_group`，lm_head 两者都是 `None`；细粒度 TP 的两处 `ValueError` 分别在 L114–L122 按权重判。
- 未知键处理：`git grep -n 'extra="forbid"' baa023ad -- vllm_ascend/ascend_config.py` 共 10 处，其中顶层 `class AscendConfig`（L296）有 `model_config = ConfigDict(extra="forbid")`（L455）；`2ed6cbba` 为 0 处。站内 `enable-async-exponential` 页已有同口径表述（v0.26 静默忽略 / main 启动失败）。
- GLM 双机不开 PCP：`wiki/concepts/context-parallel.md` L157–L182（PCP=1、DCP=1；KDA prefill 在 PCP>1 抛 `NotImplementedError`），本页只引一句并加锚点链接。

**三项检查。** `pnpm wiki:lint` exit 0（通过，另有 5 处待留意，均为其他页的 mark-flood / facts-overflow）；`pnpm wiki:audit` 通过，本页 `evidence=C`、来源 10 条、正文 5085 字 → 本页 6 节；本页没有 wiki-diagram 块（队列写「沿用现有图」，页上本来就没有图），未改任何 yaml/svg。正文字数 5750 → 7739 字符（去 frontmatter 的 `wc -m`）。

**疑点 / 跳过。** ①无 P1 疑点自查结果：机制、默认值、生效门都对上了源码行。②跳过：一次 `git grep` 读 `ascend_config.py` 的未知键处理被安全分类器拦下，改用窄口径（只数 `extra="forbid"` 与类名行号）完成，没有整段读那份文件的 docstring。③未起服务、未截图、未跑 `wiki:diagrams --check`（本页无图）。

## P5 审查（10-02）

审查员：独立审查（只审不改）。口径：参数页小修，只看任务文件写明的问题 + 本轮新增/改动的句子；不按深入页骨架扣分。

**分数：7 / 10。** P1 1 条，P2 1 条，P3 3 条。`pnpm wiki:audit` 本页通过（evidence=C，来源 10 条全部 ✓，exit 0）；`pnpm wiki:lint` exit 0，本页无告警（另 5 处为别页 mark-flood / facts-overflow）。

### 旧版信息清单
- 独立的 `p5\<页面 id>-facts.md` 在两个会话 scratchpad 下都不存在；清单写在本文件「P5 写作记录」第 12 行（10 条）。小修页按此认可为「已列」，位置偏差记 P3-3。
- 抽查 6 条（对照 `git show p4-checkpoint` 旧版与现版 L59–L123）：①默认 `true` 在 L59/L104 ✓；②TP×PCP 网格、PCP 内维、每卡 1/(TP×PCP) 在 L59 ✓；③生效门三条件在 L105 ✓；④细粒度 TP 互斥在 L106 ✓（旧版「报错点名两个键」被删：源码 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py` L114–L122 两处 `ValueError` 各只点一个键，删得对）；⑥`lru_cache` + `refresh` 在 L108 ✓（源码 `utils.py` L1497–L1498、L200）；⑧`disable_tp` 绕开在 L115 ✓（源码 L98–L102）。无丢失项。
- `git diff p4-checkpoint` 删除行只有一句话 / 事实表「与细粒度 TP」「覆盖版本」三处和 summary、updated，均被更准确的表述替换，没有丢信息。

### 任务要点核对
- **版本口径（逐版本核）**：`git grep -l enable_pcp_embedding_lmhead_weight_sharding` 在 `2c59ff10`、`2ed6cbba`、`baa023ad` 均 0 个文件，`4d1412d1` 3 个；`f4ee3b53`（PR #17159，09-23）不是 `baa023ad` 的祖先。另查发布分支：`origin/releases/v0.27.1rc`（4ebd61f35）、`v0.28.0rc`（56b8bb7f8）、`v0.29.0rc`（b3d3bb680）也都是 0。页面「钉住三版本都没有、09-23 才进上游 main」✓，与版本谱系表一致。
- **默认值**：`4d1412d1:vllm_ascend/ascend_config.py:578` `bool = True` ✓；与 `enable_reduce_sample` 的冲突在 L925–L930 ✓。
- **未知键处理**：`baa023ad:vllm_ascend/ascend_config.py` L296 `class AscendConfig`、L455 `ConfigDict(extra="forbid")`，L1613–L1627 注释写明只剥掉 `refresh` 等非用户键、其余交给 pydantic 拒未知键 → 「钉住 main 上写它会被拒」推理成立，页上已标待核（未实跑）✓。
- **GLM 双机 PCP=1 的实际效果**：生效门 L106–L110 要求 `prefill_context_parallel_size > 1`，PCP=1 时走 STANDARD 的 TP 切分 → 「不生效、每卡仍是一份完整 TP 切片」✓；「34 层 KDA prefill 在 PCP>1 抛 NotImplementedError」与 `wiki/concepts/context-parallel.md` L178 一致并链到其 GLM 节 ✓。
- **不编收益、不挪用 GLM 数字**：本页无任何部署数字，L123 明确「没有实测」✓。每卡份额只链接 `glm-5-3-flash-two-node.md#每张卡上放了什么`（该页 L158 标题、L166/L174 的 151.25 MiB），本页未重算 ✓。
- 截图（写手未截，审查补截，5193 只读访问，1440 宽）：`scratchpad\enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9-review-first.png`、`-review-facts.png`，一句话、事实表、角标渲染正常。本页无图，无分镜。
- 入链：全库只有 `wiki/index.md:114` 指向本页，路径可解析。

### P1
1. **L121「LM Head 那一侧这两个组都不设，取分数的路径不变 [C2]」与源码相反。** 位置：「开了的代价」第二段（本轮新增句）。源码 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py` L72–L75 docstring 写明 PCP_X_TP 下 LM head 要先在 PCP、再在 TP 上 gather 词表分片重建 logits；L542–L543 `parallel_mode is PCP_X_TP` 时改走 `_get_logits_pcp_weight_sharding`，L564–L568 先 `pcp_group.all_gather(logits, dim=-1)` 再 `tp_group.all_gather`。普通路径只在 TP 上 gather。影响：读者会以为 LM Head 侧零运行时代价，实际每次取 logits 多一次 PCP 组 all-gather；且 [C2] 引的是 L95–L125（只覆盖生效门和切分计划），并不支撑「路径不变」。改法：改成「LM Head 一侧不设这两个组，但取分数改走专门的路径：先在 PCP 组、再在 TP 组 all-gather 词表分片拼回完整 logits，比只切 TP 多一次 PCP 组 all-gather」，来源补 `vocab_parallel_embedding.py` L536–L568 的锚点。

### P2
1. **「再省 1/PCP」「省下的那 1/PCP」量写错。** 位置：L115（旧版遗留）与 L123 待核第一条（本轮新增）。每卡从 1/TP 降到 1/(TP×PCP)，是「缩到原来的 1/PCP」，省下的是 (PCP−1)/PCP；PCP=2 时两者碰巧相等，PCP=4 时省 3/4 而不是 1/4。改法：两处统一写「每卡这两块权重缩到原来的 1/PCP」，L123 改「缩到 1/PCP 只是按切分方式推的量级」。

### P3
1. `wiki/index.md:114` 的条目仍是旧 summary（末句「只在 main 上有」），需下次 `wiki:build` 重新生成，否则首页列表和页内口径不一致。
2. 为和 o_proj 页口径一致，可在事实表「覆盖版本」一行补半句：v0.27.1 / v0.28 / v0.29 发布分支也没有（版本谱系表已列「无」，属锦上添花）。
3. 旧版信息清单写在 review 记录里而非 `p5\<页面 id>-facts.md`；记录第 12 行「`git diff --stat p4-checkpoint` 为空，现版与 p4-checkpoint 完全一致」指的是改动前的状态，现在 diff 为 13+/6−，建议注明「改前」。

**跳过：** 「参数定义（自动生成）」表与 sources 区未逐行读（由 audit 校验）。

## P5 修订记录（10-02，按审查）

**P1-1 成立，已改（核了源码）。** 原句「LM Head 那一侧这两个组都不设，取分数的路径不变」错。核对 `tools/repos/vllm-ascend` 的 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py`：L542–L543 在 `lm_head.parallel_mode is VocabParallelMode.PCP_X_TP` 时分派到 `_get_logits_pcp_weight_sharding`（L553 起），该函数 L561–L568 先 `pcp_group.all_gather(logits, dim=-1)`、再 `tp_group.all_gather(...)`，最后切回 `org_vocab_size`；普通路径（`_get_logits_normal`）只在 TP 组 gather。现在「开了的代价」第二段改成「两侧都多一道 PCP 组内通信」：embedding 侧查表后先 PCP 交换再 TP 归约，LM Head 侧取分数先 PCP、再 TP all-gather 词表分片，比不开它多一次 PCP 组 all-gather。该句角标由 [C2] 换成新加的 [C11]，frontmatter sources 第 11 条补 `4d1412d1:.../vocab_parallel_embedding.py#L536-L568`（audit 该条 ✓）。

**P2-1 成立，已改。** 「再省 1/PCP」「省下的那 1/PCP」两处口径错（每卡从 1/TP 降到 1/(TP×PCP)，是缩到原来的 1/PCP、省下 (PCP−1)/PCP）。「为什么存在」改为「每卡这两块权重缩到原来的 1/PCP（省下 (PCP−1)/PCP：PCP=4 时省 3/4）」，待核第一条改为「缩到原来的 1/PCP 只是按切分方式推出来的量级」。

**P3-2 成立，已改。** 事实表「覆盖版本」补「v0.27.1rc / v0.28.0rc / v0.29.0rc 这几条发布分支也没有」。本轮自己复核：`git grep -l enable_pcp_embedding_lmhead_weight_sharding` 在 `origin/releases/v0.27.1rc`、`v0.28.0rc`、`v0.29.0rc` 三条分支上各 0 个文件。

**P3-3 成立，已注明。** 上面「P5 写作记录」里「`git diff --stat p4-checkpoint` 为空」指的是**改前**状态；本轮改完后该页 diff 非空（正文 + summary + updated + sources 第 11 条）。

**P3-1 未做，原因写明。** 要修的是 `wiki/index.md:114` 的旧 summary，那是 `pnpm wiki:build` 从各页 frontmatter 生成的产物（`scripts/wiki-build.ts` 输出 `wiki/index.md` 与 `src/content/wiki/registry.json`），一次重建会把同批其他写手正在改的页一起写进去，超出「只改自己两页」的范围，留给主会话在批次收尾时统一 `pnpm wiki:build`。页内口径已正确。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0；`pnpm wiki:diagrams --check` exit 0（「290 张图与 spec 一致」，告警均为别页 yaml 文案）；`pnpm wiki:audit` exit 0，本页 `evidence=C`、来源 11 条全部 ✓、正文 5290 字 / 6 节。未起服务、未截图（本页无图）。

## P5 复审（10-02）

复审员：独立复审（只审不改）。范围：上一轮 P1/P2 是否修好、与姊妹页 `enable-pcp-o-proj-weight-sharding` 口径、新改动有无把推断写成定论、通信/切分类说法抽查 5 条。

**分数：8 / 10。** P1 0 条，P2 1 条（新），P3 2 条。`pnpm wiki:lint` exit 0（5 处待留意均为别页 mark-flood）；`pnpm wiki:audit` exit 0，本页 `evidence=C`、来源 11 条全部 ✓、正文 5290 字 / 6 节。

### 上一轮问题逐条复核
- **P1-1（LM Head 取分数路径）已修好。** 独立读 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py`：L542–L543 在 `parallel_mode is PCP_X_TP` 时分派到 `_get_logits_pcp_weight_sharding`；L553–L568 该函数先 `pcp_group.all_gather(logits, dim=-1)`（L564–L565，`world_size > 1` 时）、再 `tp_group.all_gather`（L567–L568），最后截到 `org_vocab_size`；普通路径 `_get_logits_normal`（L592–L611）只在 `lm_head.tp_size > 1` 且未开 `enable_reduce_sample` 时走 `_gather_logits`（vLLM `0fc695fc:vllm/model_executor/layers/logits_processor.py` L75–L83，TP 组 gather / all-gather）。页面 L123「LM Head 侧不设这两个组，但取分数先 PCP、再 TP all-gather，比只切 TP 多一次 PCP 组 all-gather」与源码一致。`enable_reduce_sample` 与本键在 PCP>1 时互斥（L924–L932），所以「不开它时只在 TP 组 gather 一次」的对照基线成立。新来源第 11 条 `4d1412d1:.../vocab_parallel_embedding.py#L536-L568` 覆盖上述分派与 gather 行，audit ✓，角标 [C11] 与 sources 序号对得上（第 7、8 条是 S7/S8，第 9、10 条是 bea70ab / 4d1412d1 的 `ascend_config.py`）。
- **P2-1（1/PCP 量）已修好。** L117 改为「缩到原来的 1/PCP（省下 (PCP−1)/PCP：PCP=4 时省 3/4）」，L125 待核第一条改为「缩到原来的 1/PCP 只是按切分方式推出来的量级」。与网格 rank = `tp_rank * pcp_world + pcp_rank`、world = `tp_world * pcp_world`（`4d1412d1` L130–L131）一致。
- **P3-2 已改**：L112 补 v0.27.1rc / v0.28.0rc / v0.29.0rc 也没有（上一轮已核 3 条分支 0 文件）。**P3-3 已注明。** **P3-1 未做**：理由（`wiki:build` 会把同批别页一起写入）成立，留主会话批末统一重建；`wiki/index.md:114` 仍是旧 summary，见下 P3-2。

### 与姊妹页口径
- `wiki/params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md`「开了的代价」L119 也是「两笔通信都在 PCP 组内」+ 待核「没有实测、1/pcp_size 只是按切法推的量级」+ GLM 链到同一锚点 `context-parallel.md#放到-glm-双机这套部署开了-cp-吗`。本页 L123/L125/L113 的写法与之同构，量的口径（缩到 1/PCP、多出 PCP−1 份）一致 ✓。版本事实不同（o_proj 键在钉住 main `baa023ad` 与 v0.28/v0.29 上有；本键都没有）是两键事实本身的差别，各自核过，不冲突。

### 推断是否写成定论
- 「钉住 main 上写它会被当未知键拒掉」：L112 带 [D]，L125 待核第三条写明未实跑。复核 `baa023ad:vllm_ascend/ascend_config.py` L439 docstring 写明未知键由 `extra="forbid"` 拒、L455 `ConfigDict(extra="forbid")`、L1660 把 `additional_config` 去掉非用户键后整体传入 → 推断有据且已标待核 ✓。
- 「发布分支写上被静默忽略」：`2c59ff10` / `2ed6cbba` 的 `ascend_config.py` 都无 `extra="forbid"`；`2ed6cbba` 唯一的未知键检查在 L950–L952，只管 `short_request_first_config` 子配置，顶层确实不拒 ✓。
- 无新编的收益数字或 GLM 数字挪用 ✓。

### 通信 / 切分说法抽查 5 条（对照源码）
1. 生效门三条件 + `disable_tp` 先返回复制布局：`39fef3f8:vllm_ascend/ops/vocab_parallel_embedding.py` L101–L110 ✓。
2. TP × PCP 网格、PCP 内维、每卡 1/(TP×PCP)：`4d1412d1` 同文件 L126–L131 ✓。
3. 细粒度 TP 逐权重判 `ValueError`：`39fef3f8` L113–L122（embedding 判 `embedding_tp_enable()`、head 判 `lmhead_tp_enable()`）✓。
4. LM Head 取分数先 PCP 再 TP all-gather：见上 P1 复核 ✓。
5. **embedding 侧「查表结果先在 PCP 组里交换、再在 TP 组里归约」——不精确（错 1 条，记 P2-1）**，见下。
（附带核：`enable_reduce_sample` 冲突 `39fef3f8:ascend_config.py` L821–L837 ✓；`lru_cache` + `clear_enable_sp` 在 `utils.py` L194–L198 / L1496–L1498 ✓；`refresh` 重建后在 `ascend_config.py` L1749 调 `clear_enable_sp()` ✓。）

### P1
无。

### P2
1. **embedding 侧通信次数说少了，且 [C2] 不覆盖这句的依据。** 位置：L123「两侧都多一道 PCP 组内通信」及 embedding 一侧那句。源码 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py` L72–L75 docstring、L299–L310（`_forward_with_token_exchange`）、L364（`all_gather_into_tensor` 收 token ID）、L395–L398（之后 TP `all_reduce`）：embedding 侧是**先在 PCP 组 all-gather token ID → 查本卡词表分片 → 在 PCP 组 reduce-scatter 回各自 token 行 → 再在 TP 组 all-reduce**（且这次 TP all-reduce 只带本 PCP rank 的 token 行）。页面只写「查表结果先在 PCP 组交换」，漏了查表前的 token ID all-gather，小标题「多一道」对 embedding 侧不对（是两次 PCP 组集合通信）。另外这句挂 [C2]（`39fef3f8` L95–L125），而 PCP / TP 两组的设置在 L132–L133、通信顺序在 L72–L75 与 L299–L398，都不在该范围内。影响：读者对 embedding 侧代价的估计偏小。改法：小标题改「两侧都多出 PCP 组内通信」；embedding 句改成上面四步（可写「比不开多两次 PCP 组通信：一次收 token ID、一次 reduce-scatter 查表结果」）；来源补 `vocab_parallel_embedding.py#L72-L75` 与 `#L299-L310`（或 L295–L398）一条，换掉这句的 [C2]。

### P3
1. L123「每取一次 logits 都多一次 PCP 组 all-gather」：`4d1412d1` L540–L541 `skip_gather=True`（spec-decode / top-k 调用方）时直接返回未 gather 的 `_apply_head` 结果，两条路径都不 gather。可补半句「`skip_gather` 的调用除外」，或改成「常规取 logits 时」。
2. `wiki/index.md:114` 仍是旧 summary（末句「只在 main 上有」）；待主会话批末 `pnpm wiki:build` 统一重建后复查。

**跳过：** 「参数定义（自动生成）」表（L65–L100）、「版本谱系」表（L127 起）与 sources 区未逐行读（由 audit 校验）；未重新截图（本页无图、本轮只改文字，上一轮审查已截两张）。

**P5 修订记录（10-02，按复审）。** 复审 P2-1 成立：embedding 侧漏了查表前那次 token ID all-gather。对照 `4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py`（L299–L310 docstring 写明「gather token IDs → 本地查表 → reduce-scatter 回原 token 所有者」，且 PCP reduce-scatter 故意排在 TP all-reduce 之前；L364–L368 `dist.all_gather_into_tensor` 收 token ID；L385 本地查表；L387–L391 `dist.reduce_scatter_tensor`；L395–L398 `output_reduce_group` 上的 `all_reduce`），把「开了的代价」第二段小标题改为「两侧都多出 PCP 组内通信」，embedding 句改成四步（PCP all-gather token ID → 查本卡词表分片 → PCP reduce-scatter 回各自 token 行 → TP all-reduce，且这次 TP 归约只带本 PCP rank 的 token 行），并写明「多两次 PCP 组通信」；该句角标由 [C2] 换成新加的 [C12]，sources 第 12 条补 `4d1412d1:.../vocab_parallel_embedding.py#L299-L398`（audit ✓）。复审 P3-1 一并修：LM Head 那句加上「常规取分数」，并补「spec-decode 这类传 `skip_gather` 的调用方两条路径都不 gather，不在此列」（源码 L540–L541）。复审 P3-2（`wiki/index.md:114` 旧 summary）仍留主会话批末 `pnpm wiki:build` 统一重建，理由同上。本轮 `pnpm wiki:lint` exit 0、`pnpm wiki:audit` exit 0（本页来源 12 条全部 ✓、正文 5461 字 / 6 节）。
