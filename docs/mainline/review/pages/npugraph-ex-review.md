# npugraph-ex 审查记录

## P5 写作记录（2026-10-02，第 19 批深改，接手 GPT 半成品）

**接手说明。** 本页先由一位 GPT 写手动过（主会话确认是撤回不干净的残留进程，04:39 终止），留下写到一半的正文（到「GLM 双机」为止，缺常见误解与对照源码）和两张新图 `npugraph-ex-intuition.yaml`、`npugraph-ex-flow.yaml`。它的结论一律按钉住源码重核，核对结果见下；旧版信息清单重做了一份，存在旧会话 scratchpad 的 `p5/npugraph-ex-facts.md`（GPT 留在仓库 `tmp/p5/npugraph-ex-facts.md` 的那份只做参考，没有采信）。

**改了什么。** 正文从 p4-checkpoint 的 5 个 H2（去 frontmatter 后 42 行）改成 6 个正文 H2 + 常见误解 + 对照源码，审计口径 8,877 字 / 8 节。顺序：是什么（融合 + 分档复用，直觉图）→ 为什么值得合（中间张量的一写一读，带 calc）→ 怎么找出能合的一段（pattern/replacement 机制 + 归一化接量化的数值演算 + 四条规则表）→ 两条编译路径（流程图 + 相邻概念表）→ static kernel（宽度筛选 calc）→ GLM 双机 → 常见误解 → 对照源码（五个 H3 按固定顺序）。补齐账、7 张图、回放五条判据全部只写结论加链接，分别指向 `concurrent-requests.md`、`graph-mode-layer.md`，本页不重推。

**核心概念对照了哪些源码（全部 `git show` 钉住 commit 读的）。**
- 四条融合规则与开关：`graph_fusion_pass_manager.py` 的 `configure`（`fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_allreduce_rms` / `fuse_muls_add` 都按原始配置字典读、默认真，310P 跳过第一、四条，`enable_sp` 另加两条 SP pass）。**旧版与 GPT 稿都漏了 `fuse_allreduce_rms` 这一条**，已补。
- 规则注册：`passes/base_pattern.py` 的 `register` 同时调上游 `pm.register_replacement` 和外部后端的 `nge.register_replacement`，并带 stream scope 的额外检查；同名 pattern 全局只注册一次。配合 `vllm/compilation/backends.py#L846-L848`、`#L948` —— pass manager 由上游实例化并 `configure`，与后面走哪条编译路径无关。**所以「关掉 `enable_npugraph_ex` 等于关掉融合」是错的，但 GPT 稿「关闭外部后端后本地规则仍可能工作」的因果也不准**：本地 pass manager 只有在 `fusion_pass_compile` 这条路上才会被取出来应用（`compiler_interface.py#L47-L68`、`#L301`），默认路径上是外部后端按自己登记的替换改图。页面按这个机制写成「规则只注册一次，应用的人不一样」。
- 归一化接量化：pattern 是 `npu_add_rms_norm_bias` 之后接 `torch.ops.vllm.quantize`，替换成一个 `npu_add_rms_norm_quant`，一次输出量化张量和残差。页面的 calc 就按这个结构演：[3,4]+[1,2] → RMS √26 ≈ 5.10 → 归一化 → ÷0.1 取整 = [8,12]，并点明消失的是中间那一行 BF16 结果。
- 乘系数接相加：`muls_add_pass.py` 的 pattern 是 `x * scale` 再 `+ y`，正好是「中间结果只被下一步消费」的最小例子，两张教学图都改用它，不再画抽象的 A / B 圆圈。
- Q/K 归一化接 RoPE：`qknorm_rope_fusion_pass.py#L196-L226` 有三道检查，dtype 非 BF16、`get_layers_from_vllm_config(..., Attention)` 取不到层都**直接 return**，head_size ≠ 128 则 `continue`；而 GLM 的注意力层是 `AscendGlm5NextMLAAttention` 与 `KimiGatedDeltaNetAttention`（`models/glm5_next.py#L2081`、`#L2089`），上游 `MLAAttention` 又不是 `Attention` 的子类（`mla_attention.py#L322` 对 `attention/attention.py#L177`，两者都只继承 `AttentionLayerBase`）。**结论：这一档配置下这条规则一个候选都注册不出来**，页面按「源码推断，待启动日志确认」写，并进了待核。旧版「要检查真实算子图、不能用隐藏维度推算命中次数」的保留意见升级成了这条具体结论。
- All-Reduce 接归一化：`allreduce_rmsnorm_fusion_pass.py#L155-L159` 的 `is_applicable_for_range` 要求编译区间起点 > 512，所以整齐 decode 的 4–128 宽度用不上，只有大批 prefill 的区间才可能。
- 默认值分歧：`ascend_config.py#L474-L489` 里，开着外部后端时按字段默认（`fuse_allreduce_rms` 为假）决定要不要加 512 这个编译区间切分点，关掉时又按原始字典默认（真）加；而 pass manager 始终按字典默认真注册这条 pass。页面把它写进「配置打开 ≠ 生效」那条误解，作为「字段默认值不能代替最终运行配置」的实证。
- static kernel：`compiler_interface.py#L71-L79` 的筛选是 `uniform_decode_query_len ≤ x ≤ max_num_seqs × uniform_decode_query_len`；`ascend_config.py#L639-L641` 的断言要求同时开外部后端；`#L88-L108` 还要推算本机进程数、建按节点的 Gloo 组来协调编译与 `.run` 包安装。`_configure_backend` 里 `inplace_pass=False` / `disable_reinplace_inplaceable_ops_pass=True` 的注释写明是避免 gelu 回退 CPU。
- 平台档位：`platform.py#L593-L634`，NONE、需要分段编译、不受支持的档位都把 `enable_npugraph_ex` 置假；整趟图这一档把 `splitting_ops` 清空。310P 的降级在 `ascend_config.py#L622-L631`。

**数字出处。** 捕获宽度 `[4,8,16,32,64,96,128]`、`uniform_decode_query_len = 1 + 3 = 4`、最大 128 = 32 × 4 取自 01 底稿 §A0.6；补齐、DP 对齐、场景 M 的 64 与 6048、空闲组陪跑取自 03 底稿 §B4，页面只写结论并链接 `concurrent-requests.md`，一个数都没有重算。教学示意数（4 行 8 列 × 2 B = 64 B、[3,4]/[1,2]/s=0.1、捕获表 2/4/8/16/32 的筛选例）都标明是示意，不是 GLM 实测。

**三张图。**
- `npugraph-ex-intuition.yaml`（重画 GPT 版）：上半「原来的两步 → 换上的融合实现」，下半同一段计算按宽度 4 / 宽度 64 各录一份，底下两条「本轮几个位置 → 放哪一份」。
- `npugraph-ex.yaml`（重画）：改用乘系数接相加这个真实规则，上下两带对照——上带中间结果进「设备显存」框再读回（64 B 写 + 64 B 读 = 128 B），下带中间结果留在「一个融合算子」框内。
- `npugraph-ex-flow.yaml`（改 GPT 版）：补上「规则登记两处」这一步，两条编译路径合流到录图，再到 B4 判一次。
- `pnpm wiki:diagrams` 重生成三张 SVG，`--check` 全库一致；按渲染器提示去掉了图上的整句、代码名，并把 `npugraph-ex.yaml` 的文字压到 8 段以内。

**旧版信息清单勾选。** 26 条逐条核过（清单在 scratchpad `p5/npugraph-ex-facts.md`），全部保留或升级：F9、F11 升级成「这条规则在 GLM 上零注册」；F13 补上第三、四条规则；F12/F15 改写成「注册一次、应用的人不同」；其余原样保留在对应小节。没有删除任何旧结论。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错；全库 5 处 mark-flood 属于别的页）；`pnpm wiki:diagrams --check` 一致（两条提示属于 `vllm-ascend-repo-map.yaml`）；`pnpm wiki:audit` 本页 23 条来源行号全部有效（初稿 main 那条 pass manager 行号越界，已改成 `#L50-L73`）。自查：对照源码之上角标 0 处，全页 30 处（上限 30），[C] 占 24/30 = 80%；教学正文行内代码 10 处（约 2.5/千字）；三个 calc 分属三节，没有与表格相邻；首图在第一屏、图前无 calc。没有起服务、没有截图，浏览器验收留给审查环节。

**参考。** 看了参考图库 `refs/INDEX.md`、`HOW-THEY-TEACH.md` 和 `xzclass-09.png`。本页不涉及通信原语，只借了它的画法：并排两种做法、同一套方块编码、各给一个短标题，不照抄配色与图式。

**遗留与疑点。**
- `graph-mode-layer.md`「旁边的另外两条路」里写「把它关掉只是换一条编译路径，昇腾的 pass manager 照样把同一批融合做掉」。按源码，关掉之后确实是本地 pass manager 来做，但默认开着时它不会被调用，是外部后端按同一批登记的替换去改。那页不归本轮改，留给审查员判断是否要把措辞改成「同一批规则、换人应用」。
- 四条规则各自命中几处、外部后端自己还做了哪些改写，都缺启动日志与它的源码，已写进页末待核。
- 写页过程中两次被安全分类器拦下（一次在读完旧版正文之后、一次在首次汇报时），被拦内容未重述，不影响本页结论；除此之外没有跳过任何计划内的核对。

## P5 审查（09-29）

**结论：8.5 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（23 条来源、21 条代码行号全 ✓，2 条 URL 未联网）。P1 0 条，P2 2 条，P3 6 条。**

**初学者测试（只读前两屏）。** 能说清：编译图融合是在编译阶段把计算图里相邻的几步整段换成一个融合实现，省掉中间结果写进设备显存又读回来的那趟搬运；代价是编译器得先认出这一段、准备好实现，而且会改变浮点次序、精度要另验。第一屏是问题式 H2 + 一句话定义 + 乘加这个真实例子 + 直觉图，没有一上来堆 GLM 数字（GLM 只在 `concurrent-requests` 的链接里出现一次），符合「是什么 → 为什么 → 怎么算 → 细节 → GLM → 误解 → 对照源码」。

**核心概念逐条核（全部 `git show` 钉住 commit 读的，行号为审查员自核）。**
- 四条规则 + 开关：db701c1f `compilation/graph_fusion_pass_manager.py` L63–L79 —— `fuse_norm_quant`/`fuse_qknorm_rope`/`fuse_allreduce_rms`/`fuse_muls_add` 全部 `dict.get(..., True)`；`is_310p()` 只卡第一、四条；`enable_sp` 另加 `SequenceParallelismPass` 与 `SequenceParallelismMoePass`。页面表格与「怎么开」第 4 条**完全对得上**。
- 归一化接量化：`passes/norm_quant_fusion_pass.py` L49–L91，pattern 是 `npu_add_rms_norm_bias` → `torch.ops.vllm.quantize`，替换成一个 `npu_add_rms_norm_quant`，输出量化张量 + 残差。页面 calc 的四步（[3,4]+[1,2]=[4,6]、√26≈5.10、[0.78,1.18]、÷0.1 取整 [8,12]）我手算一遍全对。
- 乘系数接相加：`passes/muls_add_pass.py` L86–L90，dtype 限 FP16/BF16/FP32，与表格一致。
- All-Reduce 接归一化：`passes/allreduce_rmsnorm_fusion_pass.py` L29 `ALLREDUCE_NORM_FUSE_THRESHOLD = 512`、L155–L159 `compile_range.start > 512`。页面「整齐 decode 最大 128，全在门槛以下」成立。
- 默认值分歧：`ascend_config.py` L594 字段默认假，L489 字典默认真，L475 又按字段判断要不要加 512 切分点 —— 页面在误解与「怎么开」里写的两处不一致属实。
- static kernel：`compiler_interface.py` L71–L79 的筛选确为 `uniform_decode_query_len ≤ x ≤ max_num_seqs × uniform_decode_query_len`，只从 `cudagraph_capture_sizes` 里筛、不补新宽度；`ascend_config.py` L640 的断言、L622–L631 的 310P 降级、L115/L136 的 `inplace_pass=False` 注释（避免 gelu 回退 CPU）都与页面一致。
- 平台档位：`platform.py` L604–L634，分段编译档与不受支持档把 `enable_npugraph_ex` 置假，整趟图档清空 `splitting_ops`；L636–L645 才是 `ASCEND_LAUNCH_BLOCKING` 的 `ValueError`。

**写手那条推断的核验（重点）。** 推断链成立，且页面写成了推断而不是定论：
1. `passes/qknorm_rope_fusion_pass.py` L196–L205：dtype 非 BF16 直接 return；`get_layers_from_vllm_config(vllm_config, Attention)` 为空直接 return；L207–L209 `head_size != 128` 则 continue，什么都不注册。
2. `vllm@0fc695fc:vllm/config/vllm.py` L2242–L2264：该函数是对 `static_forward_context` 做 `isinstance(layer, layer_type)` 过滤，取不到就是空字典。
3. `vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py` L322：`class MLAAttention(nn.Module, AttentionLayerBase)`，确实不是 `Attention` 的子类。
4. GLM 这一侧：`models/glm5_next.py` L1881 `AscendGlm5NextMLAAttention(nn.Module)`、L2081 `KimiGatedDeltaNetAttention`（追到 `vllm/model_executor/layers/mamba/gdn/base.py` L22 `GatedDeltaNetAttention(PluggableLayer, MambaBase)`）、L2018 `AscendIndexerKPoolMLAAttention`（`ops/indexer_kpool_mla.py` L146，`nn.Module`），整份文件没有 import 过上游 `Attention`；`models/glm5_next_mtp.py` L32/L85 复用同一个 `AscendGlm5NextDecoderLayer`，MTP 侧也不会多出 `Attention` 实例。
→ 「这条 pass 在 GLM 双机上零注册」证据链完整，缺的只有启动日志。页面正文（GLM 双机第 2 条）写「这是按源码推断的结论，仍需启动日志确认」，页末「待核」也点名了这条，**定性合规，不记问题**。

**数字唯一出处。** 本页没有重算：4 个位置 = 1 + 3 草稿、32 条并发、最大 128、7 个捕获宽度都只给结论并链到 `graph-mode-layer.md#官方双机上录了哪-7-张图`（该页 L121–L130 的 calc 与本页数字一致）；补齐、DP 对齐、空闲组陪跑链到 `concurrent-requests.md` 的两个锚点（L260、L370，都在）；回放判据链到 `graph-mode-layer.md` L136 的五条，本页把第 2、3 条合并成「每条请求都按 4 个位置」，与那页「第 2、3 条合起来才等于每条都是 4」的说法一致。示意数三处全部标了「示意」。**数字项无 P1。**

**信息丢失。** `git diff` 删除 27 行，逐行对回：旧版 5 个 H2 的结论（F1–F26）在新版都能找到落点，F9/F11 升级成具体结论、F13 补到四条，没有删除项。抽查 F1/F3/F6/F9/F18/F24/F25 七条均在（分别落在「为什么值得合」「开销」「calc」「四条规则表 + GLM 双机」「static kernel」「开销」「会报什么错」）。清单勾选属实。

**链接与校验。** `pnpm wiki:lint` 通过（5 处 mark-flood 属别页）；`pnpm wiki:diagrams --check` 281 张一致、无本页提示；全库入链只有 `acl-graph.md` L64、`graph-mode-layer.md` L51/L87/L182 和 `params/enable-super-kernel-*.md`，都指向页面根、不带锚点，改 H2 没有破链。

**浏览器实测（Playwright，1440 宽，只读用户的 5193，没有起停服务）。** 截图：`scratchpad/npugraph-ex-review-first.png`（第一屏）、`npugraph-ex-review-diagram1.png`（直觉图）、`npugraph-ex-review-fig4.png`（两条编译路径流程图）。页面渲染正常：8 个正文 H2 + 接着看，5 个 figure、4 张表，控制台只有 4 条 502（属于侧栏问答后端，与本页无关）。流程图清晰、分支标注完整。

### P2

1. **重画的 `npugraph-ex.yaml` / `.svg` 页面根本没引用**（`git status` 显示两文件本轮已改；全库 `grep "file: npugraph-ex$"` = 0）。结果是「为什么值得合：中间张量也要写出再读回」这一整节只有 calc、没有图，而写作记录第 「三张图」 节写的是三张 —— 两位写手交接后的口径不一致 + 孤儿产物。改法：在正文第 89 行（calc 之前）插入 `file: npugraph-ex` 的图块（它正是为这节重画的 64 B 写 + 64 B 读对照），或者删掉这两个孤儿文件并改写作记录。
2. **直觉图右侧连线压字且是裸斜线**（见 `npugraph-ex-review-diagram1.png`）：`links` 里 `{from:[700,180], to:[660,270]}` 这条斜线直接穿过 texts「中间结果留在算子内部」，与站内「同向进出的 S 形、并排不交叉、不压字」的连线规矩冲突；左边那条 via 折线反而是对的。改法：把这条改成先下后右（或先右后下）的折线，起点落到「换上的融合实现」框底边中点，并把那行文字下移约 12px。

### P3

3. 版本差异表「融合规则文件」行把 main 的 `breakable_aclgraph.py`、`updatable_graph.py` 当成多出来的融合规则文件，实际它们在 `compilation/` 下、属于图捕获那一层；`passes/` 目录里 main 相对 v0.26 只少了两条 SP 规则。建议把那半句挪到别的行或改成「另多出两套与捕获有关的实现」。
4. 「会报什么错」表里 Triton kernel 那一行没有角标（其余四行都有），而结论可核：`compiler_interface.py` L184–L191。补一个 [C] 即可。
5. [C8] 的行范围 `platform.py#L589-L634` 不覆盖 `ASCEND_LAUNCH_BLOCKING` 那条 `ValueError`（在 L636–L645），表格那一行引的是够不着的范围。
6. 直觉图里「宽度 4」画 4 格、「宽度 64」只画 16 格，比例不一致，初学者可能按格子数读宽度；建议在图上标「示意」或改成带省略号的同比例画法。
7. 直觉图顶部强调句与「原来的两步」框标题几乎贴在一起（`texts[0]` y=38 对 frame label y=70），留白不足。
8. 写手留的疑点属实，但不在本页范围：`graph-mode-layer.md` L182 的「昇腾的 pass manager 照样把同一批融合做掉」在「默认开着」的语境里会被读成本地 pass manager 一直在跑；按源码默认路径是外部后端应用同一批登记的替换。建议那页改成「同一批规则、换人应用」，列入该页待办。

**跳过了什么。** 按纪律没读 HANDBOOK、`docs/plans/`、frontmatter 的 sources 区整块（只按需 grep 单行）；「对照源码」的五个 H3 只核了顺序、齐全性与版本差异三列，正文按需抽读。读正文的一次工具调用后被安全分类器拦过一次（内容已返回，未重述，改成每次 ≤12 行续读），没有因此跳过任何核对项。

## P5 修订记录（2026-10-02，按上面的 P5 审查逐条）

**P2-1 图没引用、「为什么值得合」缺图（已修，没有删任何文件）。** `npugraph-ex.yaml` 画的就是这一节的账（上带中间结果进「设备显存」再读回、下带留在「一个融合算子」内），内容对口，所以按审查建议把图块放回正文：这一节现在是「示意数设定 → `file: npugraph-ex` 图 → 一句读图的话 → calc → 结论」。写作记录「三张图」的口径因此成立，三张图全部在用（直觉图、本节对照图、流程图），没有孤儿产物，也没有删除任何图文件。

**P2-2 直觉图右侧裸斜线压字（已修）。** 两条下行连线都改成正交折线：左路 `[560,190] → via [[560,240],[220,240]] → [220,290]`，右路 `[790,190] → via [[790,254],[700,254]] → [700,290]`，起点都落在「换上的融合实现」框底边、同向进出不交叉；「中间结果留在算子内部」从 y=196 下移到 212，「录的是任务次序…」移到 [300,270]，两条横段都走在文字外侧。改完用 Playwright 把重生成的 SVG 单独渲染出来看过（截图在本会话 scratchpad `intuition-after.png`）：连线不再穿字，四个框与文字无重叠。

**P3-3 版本差异表错位（已修）。** 「融合规则文件」行改名「`passes/` 里的融合规则」，main 一列只写「也没有那一条，两条 sequence parallel 也不在了」；`breakable_aclgraph.py`、`updatable_graph.py` 另起一行「捕获那一层的实现」，并写明它们在 `compilation/` 下、不是融合规则。

**P3-4 Triton 那一行补角标（已修）。** 该行补 [C6]（`compiler_interface.py#L149-L223` 覆盖 L184–L191）。为守住「全页角标 ≤30」，同时去掉「开销」里重复的那个 [C5]（同一来源在「怎么开」已标）。现在全页 30 处、[C] 24 处（80%，未触发 mark-flood）。

**P3-5 [C8] 行范围够不着（已修）。** 第 8 条来源由 `platform.py#L589-L634` 改成 `#L589-L645`，覆盖 `ASCEND_LAUNCH_BLOCKING` 的 `ValueError`。`pnpm wiki:audit` 行号仍全部有效。

**P3-6 两档格子数不同比（已修）。** 「宽度 64」那档改成「3 格 + ⋯ + 1 格」的省略画法，图注补一句「格子数是示意，宽度 64 那份用省略号表示没画全」，避免按格子数读宽度。

**P3-7 顶部留白不足（已修）。** 强调句从 y=38 提到 y=28，两个上框从 y=70 下移到 y=80，内部元件、连线和说明文字同步下移；渲染后标题与框标题之间有约 50px 留白。

**P3-8 `graph-mode-layer.md` 的措辞（不在本页范围，未改）。** 审查员与我的判断一致：按 `compiler_interface.py#L47-L68`/`#L301`，默认路径由外部后端应用同一批登记的替换，本地 pass manager 只在关掉外部后端时才被取出来跑。那页不归本轮改，建议改成「同一批规则、换人应用」，留作该页待办。

**复跑结果。** `pnpm wiki:lint` 通过（本页 0 报错，5 处 mark-flood 属别页）；`pnpm wiki:diagrams --check` 285 张与 spec 一致、无本页提示；`pnpm wiki:audit` 本页 0 个 ✗，全库行号越界 0。

**收尾清扫（2026-10-02）P3-8 已改。** `graph-mode-layer.md`「编译期融合」那段改成「同一批登记好的融合规则默认由这个后端应用；关掉才轮到昇腾自己的 pass manager——同一批规则、换人应用」，「关掉 enable_npugraph_ex」那段的「照样」改为「改由…pass manager 把同一批规则作用到计算图上」。复跑 `pnpm wiki:lint` 退出 0、该页无提示；`pnpm wiki:audit` 该页写作标准全 ✓。
