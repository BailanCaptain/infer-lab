# fuse-allreduce-rms 审查记录

## P5 写作记录（2026-10-02，第 28 批小修）

**旧版信息清单（小修，短版）。** `git show p4-checkpoint:wiki/params/fuse-allreduce-rms.md` 的正文与改前现版逐行相同，这一页从 p4 起没被动过。旧版结论逐条核对，全部保留：

1. 开关作用：多注册一个图改写 pass，把 `matmul → AllReduce → 加残差 → RMSNorm` 换成 `matmul_allreduce_add_rmsnorm` —— 保留。
2. 官方默认 `False`（理由：与 sequence parallel 冲突），但 v0.23 线上真正决定注册的那段读原始 dict、缺省 `True`，默认值是分裂的 —— 保留，并本轮重新核过两处读法（见下）。
3. 存在范围：到 v0.24.0rc 还在，v0.25.1rc 起整体删除；v0.26 被 `**kwargs` 吞掉、main 被 `extra="forbid"` 拒掉 —— 保留。
4. 事实表十行（替换成的算子、`compile_range.start > 512` 门槛、512 tiling 块、两个 pattern、与 SP 的关系、插入切分点）—— 保留，未动。
5. 为什么存在：AllReduce 拆成 ReduceScatter + AllGather 才能让 norm 在分片上先算，省的是串行等待不是字节数；与 SP 争同一子图、融合 pass 排在前面导致 SP 静默失效 —— 保留。
6. 代价四条 + 「它去哪了」「两件事不是同一版发生的」—— 保留。

**本轮改了五处（4 段式结构与节名未动；沿用现有的 `fuse-allreduce-rms` 图，图与 yaml 未改）。**

1. **P1 级错句修正。** 「为什么存在」原文写「每个 Linear 的**列切分**结果都要做一次 AllReduce 才能拼回完整的 hidden」——方向错了：需要 All-Reduce 的是**按行切**（切输入维）的那一半，它算出的是部分和；列切的那一半输出的是完整列的一段，不需要 All-Reduce。现改为「按行切的那半个 Linear 算出的是部分和，要 All-Reduce 把各卡部分和加齐」，与 tensor-parallel 页先列后行、成对使用的口径一致。
2. **通信与形状推导链回概念页（本批验收要点）。** 同一句里把张量并行链到 `tensor-parallel.md`、All-Reduce 链到 `collective-communication.md`、RMSNorm 链到 `mlp-residual-norm.md`，并写明「为什么非得是 All-Reduce、形状怎么切」在那两页、本页不重推。改前本页正文只有 1 个站内链接（`enable-matmul-allreduce`）。
3. **只解释自身开关 + 与 npugraph-ex 口径一致。** 一句话节补一句：它是 npugraph_ex 那套算子级融合规则里的一条，四条规则各自合哪两步、各自额外条件（含本条的「编译区间起点 > 512 token」）在 npugraph-ex 的规则清单一节，链接过去，本页只讲这个开关自己。
4. **去掉指代不明的句子。** 原「**本页旧算例用不到它。** 单卡 TP=1…37 个 token…」里的「旧算例」和 37 这个数在本页已无出处（本页用的是 Qwen3-0.6B TP=2 例），改成自洽的「什么情况下它根本不可能生效」：TP=1 没有那次 All-Reduce；多卡但编译区间下界够不着 512 也不行。
5. **新增 GLM 双机一段，按源码写，不虚构收益。** TP8 下一次前向的 TP 域 All-Reduce 是 91 次（1 嵌入 + 45 注意力 `o_proj` + 3 稠密 `down_proj` + 42 共享专家，单次 T × 4096 × 2 B，T=4 即 32,768 B），数字取自 02 §1.2 与 §2.3，在站内链到 one-request 的「第 4 站 逐层前向」那一节（该页 91/32,768 B 的写法与此一致，本页不重算）。结论是候选点虽多却一处也匹配不到，两个原因都来自源码：pattern 开头要 `torch.ops.vllm.unquantized_gemm`，而 MLA 层 `o_proj` 按这份部署的配方是 W8A8（02 §0.4）；pattern 结尾要 `npu_add_rms_norm_bias`，而 GLM 每层的残差与归一化走 mHC 的 `npu_hc_post`（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2163-L2168`，`#L2224`、`#L2235` 两处调用），整份 `glm5_next.py` grep 不到任何 `add_rms_norm`。再加上 decode 判定 MC2 的 token 数上界 128 远低于 512。明确写出**待核**：逐层精度是按上游 `config.json` 推断（本机没有 `quant_model_description.json`）、没有真机 dump 图确认「零命中」、没有任何实测收益数，本页不给加速比。

**本轮重新核过的源码（版本口径按派发说明）。** GLM 线 `db701c1f`：`AscendCompilationConfig.__init__` 的 `fuse_allreduce_rms: bool = False`（`ascend_config.py#L594`）；`update_compile_ranges_split_points` 在 `enable_npugraph_ex` 为真的分支读**类型化字段**（`#L474-L476`），在 else 分支才读**原始 dict 且缺省 `True`**（`#L488-L492`）；`graph_fusion_pass_manager.configure` 读原始 dict、缺省 `True`（`graph_fusion_pass_manager.py#L64`）。即旧版「默认值分裂」的说法成立，且「真正决定注册的是 pass manager 那一处」这个细分法也成立。pattern 两端的算子在 `db701c1f:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L57-L70`（中间层）与 `#L106-L117`（末层）核过，与本页既有的 `2c59ff10` 来源一致。

**sources 变化。** 追加第 22 条 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2163-L2168`，正文用 `[C22]`；为压住 mark-flood（上限 30）把「代价一」里重复的一处 `[D]` 去掉（同一条推导在「为什么存在」已标过）。`updated` 改为 2026-10-02。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错 0 警告）；`pnpm wiki:diagrams --check` 290 张图一致（本页图未改）；`pnpm wiki:audit` 本页通过，来源 22 条。正文 9732 → 10798 字。

**疑点。** 无 P1。P3 两条：(a) GLM「零命中」是源码对照得出的结论，未经真机 dump 图验证，已在正文标待核；(b) 本页 Qwen3-0.6B TP=2 的 56 处可融合点、2 MiB 载荷仍是旧版的 `[D]` 推算，本轮未重算、未升级标记。

## P5 审查（10-02）

**结论：8 / 10。P1 0 条，P2 2 条，P3 3 条。`pnpm wiki:audit` 本页通过。**

### 四段式与小修范围
节序仍是 一句话 / 事实表 / 为什么存在 / 开了的代价 + 版本谱系、参数定义；沿用原有 `fuse-allreduce-rms` 图，`pnpm wiki:diagrams --check` 一致。`git diff` 8 增 5 删，改动都落在任务文件写明的项上。

### 重点核一：行/列切分的修正（写手自报的 P1 级错句）
修对了。`wiki/concepts/tensor-parallel.md#L75-L78`、`#L96`、`#L100-L102` 的口径是：按列切 → 每张卡算出完整的几列、靠 All-Gather 拼；按行切 → 每张卡只得部分和、必须相加合齐。现版 L90 写的「按行切的那半个 Linear 算出的是部分和，要做一次 All-Reduce 把各卡的部分和加齐」与之一致；旧句把 All-Reduce 挂在列切上确实是反的。同一句把张量并行、All-Reduce、RMSNorm 三处链回概念页，并写明形状与通信推导不在本页，符合本批「通信与形状推导链回概念页」的验收要点。

### 重点核二：GLM「零命中」的推断链（逐环）
已核实的环：
- pattern 两端：`db701c1f:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L58`/`#L61`（中间层）与 `#L107`/`#L110`（末层）确实是 `torch.ops.vllm.unquantized_gemm` 开头、`torch.ops._C_ascend.npu_add_rms_norm_bias` 结尾。
- 门槛：`#L29` `ALLREDUCE_NORM_FUSE_THRESHOLD = 512`，`#L154-L158` 判 `compile_range.start > 512`，与页面写法一致。
- GLM 侧尾部对不上：`db701c1f:vllm_ascend/models/glm5_next.py` 全文 `add_rms_norm` 命中数为 0，残差与归一化走 `torch.ops._C_ascend.npu_hc_post`（`#L2164`）。这一环是硬证据，也是「零命中」真正的支点。
- decode 侧 128 < 512：`docs/mainline/02-forward.md#L96`（§1.2 标题即「MC2 路径，DP 组内最大 token 数 ≤ 128」）与 `#L654`（128 = 32 × 4 的推导）支持，页面说法与底稿一致。
- 量化配方：`02 §0.4`（`#L44-L70`）的结论里，int8 的那一档确实包含 MLA 的 `o_proj`、稠密 MLP 与专家的 `down_proj`，所以这几类候选点的头部条件对不上；该节自己标 `[I]`（本机缺 `quant_model_description.json`，按上游 `config.json` 推断），页面照抄了这个「待核」，处理得当。

### P2
1. **「头部对不上」只对 11 个 MLA 层成立，漏了 34 个 KDA 层（L132）。** `02 §0.4#L55` 的表里 `self_attn.o_proj` 等各出现 34 次、正好覆盖 `kda_layers`，推断精度是 **BF16**；也就是说 45 次注意力 All-Reduce 里有 34 次前面挂的是**未量化**的 gemm，`unquantized_gemm` 这一端其实能对上。现在页面写成「开头要的是未量化的 gemm，而 MLA 层的 `o_proj` 是 W8A8」，读者一查底稿就会发现多数候选点不是这个情况，结论会显得站不住。结论本身不变（尾部 `npu_add_rms_norm_bias` 在 GLM 这条线上根本不出现，34 个 KDA 层同样走 `npu_hc_post`），但论证要写全。改法：按候选点分类写——34 个 KDA 层 `o_proj` 头部能对、靠尾部 `npu_hc_post` 挡掉；11 个 MLA 层（含 MTP 层）`o_proj` 与 3 个稠密、42 个共享专家的 `down_proj` 是 int8，头尾都对不上；嵌入那一次前面没有 matmul。按 CLAUDE.md，P2 需在本轮处理。
2. **「零命中」现在是定论语气，派发要求标待核（L132 段首与段中）。** 小标题「候选点看着很多，一处也匹配不到」和「图上也不会有任何一处变成 `matmul_allreduce_add_rmsnorm`」都是断言，`**待核**` 在段尾才出现，读者先读到的是结论。考虑到逐层精度本身是 `[I]` 推断、也没有真机 dump 图，建议把断言改成「按源码对照应当零命中，待真机 dump 确认」，或把待核那句提到结论句紧后面。

### P3
1. **91 次 All-Reduce 的拆分在本页重述了一遍。** 数值与唯一出处完全一致（`wiki/concepts/one-request.md#L381`：`91 = 1 嵌入 + 45 注意力 + 3 稠密 + 42 共享专家`，单次张量 32,768 B），页面也链了过去、没有自己重算，所以不记 P1；但按单一真相源，这里可以压成「TP8 下一次前向有 91 次 TP 域 All-Reduce（见链接）」，少一处将来会漂的副本。
2. **旧版信息清单没放在约定位置。** 未找到 `scratchpad\p5\fuse-allreduce-rms-facts.md`（全盘查过 `*facts*`），清单写在本 review 的写作记录里。未升级为 P1 的理由：我用 `git diff p4-checkpoint -- wiki/params/fuse-allreduce-rms.md` 独立核过，整页 8 增 5 删，六条旧结论在现版逐条可见（开关作用 L65；默认值分裂 L67/L79/L100；存在范围 L71；事实表十行 L77-L86；ReduceScatter+AllGather 与 SP 冲突 L81/L96/L98；代价四条与「它去哪了」「两件事不同版」L104/L116/L118/L120/L126/L128），没有丢信息。
3. **Qwen3-0.6B 的 56 处、2 MiB 仍是 `[D]` 推算**（L104）。本轮未重算；我核了算术自洽：28 层 × 2 = 56，1024 × 1024 × 2 B = 2 MiB，1024 token 正好 2 个 512 tiling 块。标记保持 `[D]` 合适，页面也没有由此编出任何加速比。

### 另外核过、没有问题的点
- 存在范围：`2ed6cbba` 与 `baa023ad` 两条线上 `fuse_allreduce_rms` 在 `vllm_ascend/*.py` 里命中数为 0，`compilation/passes/` 下也没有 `allreduce_rmsnorm_fusion_pass.py`（`db701c1f` 有），页面「v0.25.1rc 起整体删除、v0.26 被 `**kwargs` 吞掉、main 被 `extra="forbid"` 拒掉」成立。
- 默认值分裂：`db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L64` 读原始 dict、缺省 `True`，而类型化字段 `ascend_config.py#L594` 默认 `False`，页面与事实表的说法成立。
- 只解释自身开关：一句话节把四条规则各自合什么推给 npugraph-ex 的规则清单，本页不重讲（本页在 v0.23 这条线上，四条规则确实都在，与那一页口径一致）。

### 未做到的部分
浏览器实测**未做**：5193 没有监听（`netstat` 查无该端口，Playwright 报 `ERR_CONNECTION_REFUSED`），按派发要求不起停服务，所以本页改动没有读者视角截图，图是沿用的旧图（`wiki:diagrams --check` 一致）。
`pnpm wiki:lint` 全库通过（跨页锚点硬校验含本页新增的三条站内链接与 one-request 锚点）；`pnpm wiki:audit` 139 页 3568 条来源，行号越界 0、无效 commit 0。

## P5 修订记录（10-02，按上面的审查逐条处理）

**P2-1：GLM 候选点按精度分三类写全。** 审查说得对，原句只提 MLA 层的 `o_proj` 是 W8A8，漏了 34 个 KDA 层。现在 GLM 那段改成三类：(a) 34 个 KDA 层的 `o_proj` 按配方是 BF16，pattern 开头那一端（未量化 gemm）其实对得上，挡住它的是结尾；(b) 11 个 MLA 层的 `o_proj`、3 个稠密层与 42 层共享专家的 `down_proj` 走 W8A8，开头就对不上；(c) 词嵌入那一次前面是查表不是 matmul，第一步根本不存在。三类共同撞的是同一堵墙：pattern 结尾要 `npu_add_rms_norm_bias`，GLM 走 mHC 的 `npu_hc_post`（`db701c1f:vllm_ascend/models/glm5_next.py#L2163-L2168`，调用在 `#L2224`、`#L2235`），整份 `glm5_next.py` grep 不到 `add_rms_norm`。精度分档的出处是 02 §0.4（`docs/mainline/02-forward.md#L55` 起那张表：`self_attn.o_proj` 等各 34 次、正好覆盖 `kda_layers`，推断 BF16；MLA 层的 `o_proj` 不在表里，推断量化）加 §3.4（稠密 MLP 走 `AscendW8A8DynamicLinearMethod`）、§6.6（专家侧 W8A8 算子）。

**P2-2：「零命中」改成推断语气，待核提前。** 段首小标题改为「候选点看着很多，按源码对照应当一处也匹配不到——这一条是推断，还没在真机上 dump 图确认」，结论句由「图上也不会有任何一处变成…」改为「照源码推，…也不该有任何一处变成…」，段尾的 `**待核**` 三项（逐层精度是上游 `config.json` 推断、没有真机 dump 图、没有实测收益数）保留并点明对应的是上面这个零命中。

**P3-1：91 次的拆分不再在本页重述。** 改成「TP8 下一次前向里 TP 域的 All-Reduce 有 91 次（拆分与单次载荷见链接，本页不重列）」，链 `one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节`。本页现在只保留按精度分类所必需的层数（34 / 11 / 3 / 42 / 1），这是另一种切分，不是站点清单的副本。

**P3-2：旧版信息清单补到约定位置。** 已写入 `scratchpad\p5\fuse-allreduce-rms-facts.md`（八条旧结论 + 新版位置 + 处理）。

**P3-3（Qwen3-0.6B 的 56 处 / 2 MiB 仍是 `[D]`）：按审查意见不改。**

**npugraph-ex 未改**，理由见 enable-super-kernel 那份记录：那一页讲钉住的 v0.23 源码（四条规则都在），版本差异表已写明 v0.26 / main 没有这一条，与本页的「v0.25.1rc 起删除」一致。

**验证。** 本页 `pnpm wiki:lint` 0 报错 0 警告（内联标记 30 处，未触 mark-flood）；`pnpm wiki:diagrams --check` 290 张图一致（沿用原图，未改 yaml/svg）；`pnpm wiki:audit` 本页通过（来源 22 条）。正文 10798 → 10896 字。**全站 lint 当前 2 处报错都在 `params/prefetch-ratio.md`（别的写手在改，`mark-unnumbered`），不在我的范围，未动。**
