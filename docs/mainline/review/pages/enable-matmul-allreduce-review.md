# enable-matmul-allreduce 审查记录

## P5 写作记录（2026-10-02，第 27 批小修）

**改了什么。** 保留参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容，沿用现有图（wiki/diagrams/enable-matmul-allreduce.yaml 无旧模型数字，未改、未重新生成）；正文 10,141 → 11,162 字（wiki:audit 口径）。
1. 一句话节：「本页旧算例用不到它（单卡 TP=1）」改为不带旧算例的生效前提说明；新增「放到 GLM 双机」三段：本部署两个版本都有开关、默认关，官方 GLM 双机教程启动命令里没有这个键也没有环境变量 → 没开；假如打开，48 处行并行线性被换（45 层注意力输出投影 = 34 KDA + 11 MLA，加 3 层稠密 down_proj；嵌入与共享专家那 43 次不受影响），W8A8 下 int8 层权重已转置、融合分支不经量化路径 → 按源码推断第 0 层稠密 down_proj 出错、显存探测过不去（[D]，未实跑，待核实际报错原文）；KDA 层 R1 每次 32,768 B 填不满一块、场景 M 47.25 MiB 约 12 块，不给收益数字。
2. 事实表（仍 10 行）：「类型 / 默认值」行并入 GLM 双机「两版都有、都没开」与「W8A8 下打开按源码推断出错」。
3. 为什么存在：行并行「部分和必须加起来」补一句链接到 tensor-parallel「两种切法各算一遍」（不重讲）；Qwen3-0.6B TP2 o_proj 算例换成不带模型的示意数（2048 行 → 4 块 → 暴露约 1/4；1 行填不满一块），512 的 [D] 说明保留；「28 层 × 2 = 56 处」改为「满足前提的行并行线性一律被换，GLM 上 48 处」。
4. 开了的代价：示例命令里的模型名换成「未量化的 BF16 模型」占位，并加一句 GLM 的 W8A8 部署不适用；「量化模型走不通」补 int8 权重加载后转置、形状也对不上，指向 GLM 段。
5. frontmatter：summary 末尾补「GLM 双机部署没开，W8A8 下按源码看开了也走不通」（约 150 字）；relations 由空改为 builds-on tensor-parallel；sources 追加第 26–29 条（db701c1f ascend_config.py#L167-L172、linear_op.py#L427-L441、w8a8_dynamic.py#L127-L128，0576b647 GLM5.3-Flash.md#L237-L353）；updated 改为 2026-10-02。内联标记控制在 30 处（mark-flood 上限）。

**数字出处。** 45 处注意力 o_proj、3 处稠密 down_proj、42 次共享专家、91 次 TP8 All-Reduce：docs/mainline/02-forward.md §1.2 集合通信清单与 §9.2 通信表；34 KDA + 11 MLA：02 §1.3 每卡权重账（页面链接 tensor-parallel「从一层走到整次前向：R1 的通信账」，那里已列 1 + 34 + 11 + 3 + 42 = 91）；R1 单次 32,768 B、场景 M DP0 6,048 行单次 47.25 MiB：02 §3.3。int8 / BF16 分布（MLA o_proj 与稠密 MLP int8、KDA 全部投影 BF16）：02 量化结论段（L66–L69）。共享专家 reduce_results=False、由外层归约：02 §6 共享专家段（L715–L717），页面链接 tensor-parallel「共享专家：切法仍是列接行，归约由外层安排」。6,048 ÷ 512 ≈ 11.8 → 约 12 块为按页面已有 512 行假设的推算。没有该开关的 GLM 收益实测，未写任何效果数字。

**核对的源码（钉住版本）。**
- 开关存在与默认：2c59ff10 与 db701c1f 的 ascend_config.py:167–172（_get_config_value，additional_config 命中即返回，否则取环境变量值）、envs.py:71（默认 "0"，bool(int())）、:335–346 的回落提示；2ed6cbba、baa023ad 的 vllm_ascend 下 0 处。
- 派发顺序：db701c1f linear_op.py:709–736，前四条依次是 wo_b 细粒度 TP、DSA CP 层分片的 o_proj、细粒度 MLP TP 的 down_proj、细粒度 o_proj TP，第五条才是本开关（与现有图「站在第五位」一致）。enable_dsa_cp_with_layer_shard 只在 kv_producer 角色下为真（utils.py:1566–1576），本部署不是 PD 分离，不触发。
- 融合分支：db701c1f linear_op.py:427–441，reduce_results 且 tp>1 时直接 self.layer.weight.t() 交 npu_mm_all_reduce_base，否则才走 quant_method.apply。
- 量化权重排布：db701c1f w8a8_dynamic.py:127–128 加载后 weight.transpose(0, 1)；02 §3.4 说明稠密 MLP 走 AscendW8A8DynamicLinearMethod。
- 本部署是否开启：0576b647 docs/source/tutorials/models/GLM5.3-Flash.md 全文 grep「matmul」「additional-config / additional_config」0 处；多机段落 L237–L353。
- GLM 层是否走自定义行并行：02 §3.2 第 5 步（utils.py#L741-L745 把 RowParallelLinear 换成 AscendRowParallelLinear）。

**旧版信息清单勾选**（清单存旧会话 scratchpad p5/enable-matmul-allreduce-facts.md，M1–M24；旧版 = p4-checkpoint，与改前现版 diff 为空）。
- M1、M3–M8、M12–M24：原样保留（M16 补充了转置排布与 GLM 指向，M13 命令里模型名改占位）。
- M2：保留生效前提与适用场景；「本页旧算例用不到它」删除（旧算例已不是主线）。
- M9（Qwen3-0.6B 的 [2048,1024]、4.29 GFLOP、4 MiB）：删除，旧模型数字；「4 块、暴露约 1/4」与 512 的 [D] 说明保留在示意数演算里；GLM 对应量（32,768 B / 47.25 MiB / 约 12 块）放进 GLM 段。
- M10：「填不满一块、只剩固定开销、收益跟 token 数走」保留；2 KiB 这个旧模型数删除。
- M11（28 × 2 = 56 处）：删除，换成 GLM 的 48 处（来源同上）；「无 prefix 过滤」结论保留。

**P1 疑点。** 无已确认的 P1。待核一条：GLM W8A8 下打开本开关，按源码推断 int8 层（第 0 层稠密 down_proj 起）进融合算子时形状、类型都对不上，会出错且发生在启动的显存探测阶段；未在设备上实跑，报错原文缺，页面写明待核。本部署没开，不影响主线。

**三检。** pnpm wiki:lint 退出码 0（中途一次本页 mark-flood 31 处，替换旧算例后回到 30）；pnpm wiki:diagrams --check 290 张一致；pnpm wiki:audit 退出码 0，本页来源 29 条，行号全部有效。

**跳过。** 无。

## P5 审查（10-02）

审查员：独立审查（只审不改页面）。口径：参数页小修，保持四段式与现有图，不按深入页骨架扣分。

**结论：9 / 10。P1 0 条，P2 1 条，P3 2 条。** wiki:audit 本页通过（来源 29 条、行号全部有效，整站 exit 0）；wiki:lint 整站 exit 0，本页无报错无提示。

**W8A8 待核项：核清了（源码层面可判定，报错原文仍需实跑）。** 结论：GLM 的 W8A8 部署下打开这个开关，int8 线性层确实走不通，页面写法（按源码推断 [D]、未实跑、待核报错原文）合适，不必改成定论。证据链（均为钉住的部署版本 db701c1f）：
1. 派发不看量化也不看层名：`vllm_ascend/ops/linear_op.py:709-736`，`matmul_allreduce_enable()` 为真即无条件返回 `MatmulAllreduceRowParallelOp`，前面四条细粒度分支本部署都没开（官方 GLM 双机教程启动命令里没有 additional_config，见下）。
2. 融合分支绕开量化路径：`linear_op.py:427-441`，`reduce_results and tp_size > 1` 成立时直接 `npu_mm_all_reduce_base(input_parallel, self.layer.weight.t(), ...)`，只有前提不成立才落回 `quant_method.apply`。
3. int8 权重排布已被改过：`vllm_ascend/quantization/methods/w8a8_dynamic.py:127-128`，`process_weights_after_loading` 把权重 transpose 成「输入 × 输出」。融合分支再 `.t()` 一次就变回「输出 × 输入」，与融合算子要的排布相反；稠密 MLP 的降维投影 in=12288、out=4096，形状不等，必然不匹配，且传进去的是 int8 张量而融合算子这条调用没有任何反量化参数。
4. 哪些层是 int8：02-forward.md L66–L69（稠密 MLP、MLA 的 `o_proj` 等为 int8；KDA 全部投影 BF16），稠密 MLP 走 `AscendW8A8DynamicLinearMethod`（02 L235）。
5. 先炸在哪一层：02 L28 与 L209，第 0–2 层注意力是 KDA（BF16，能过），MLP 是稠密 int8，所以第一处失败是第 0 层稠密 MLP 的降维投影，与页面写法一致；发生在启动显存探测那一趟也成立（探测会跑真实前向）。
缺的只有一样：实际报错原文（哪个算子抛、报形状还是报 dtype），需要在设备上实跑，本审查无设备，未补。

**其余核实。**
- 开关存在与默认：db701c1f `ascend_config.py:167-172` 用 `_get_config_value`（additional_config 命中即返回，否则取环境变量），`envs.py:71` 默认 `"0"`、`bool(int(...))`。2c59ff10 同路径同实现。属实。
- 本部署没开：0576b647 的 `docs/source/tutorials/models/GLM5.3-Flash.md` 全文既无 `matmul`，也无 `additional_config`／`additional-config`（grep 0 处）。结论「停在默认关闭」成立；顺带佐证前面几条细粒度分支也都没开。
- 48 处：34 KDA + 11 MLA 的输出投影 + 3 层稠密降维 = 48，取自 91 次 All-Reduce 的拆分（tensor-parallel.md L285：1 + 34 + 11 + 3 + 42 = 91），页面只做链接不重算，符合单一出处。共享专家那 42 次 `reduce_results=False`、不满足融合前提，页面说明正确。
- 32,768 B（4 × 4096 × 2）与场景 M 47.25 MiB：对应 tensor-parallel.md L286 与 02-forward.md L231，属实；6,048 ÷ 512 ≈ 12 块明确系于「512 行一块」这个 [D] 假设之下。
- 没有任何该开关的收益数字，GLM 段明确写「本页不给收益数字」，MC2 族那条 GPT-3 约 10% 是官方量级并带 [S20]，不是本部署实测，不触发 P1。

**旧版信息清单。** 存在：旧会话 scratchpad `p5/enable-matmul-allreduce-facts.md`（M1–M24）。抽 6 条确认：M5（事实表三列存在性、类型默认、环境变量默认与解析、两者优先级、落地算子、生效前提、作用范围无 prefix 过滤）→ 事实表 9 行全在；M14（图模式同族 `compile_range.start > 512` 当量级参考）→「什么规模下才划算」在；M17（别当 prefill-only，release note 与代码不一致）→ 在；M18（batch-invariant 强制改回 False）→ 在；M19（升到 main 起不来，三条分支 + extra=forbid + `_NON_USER_INPUT_KEYS`）→ 在；M20（vLLM-Omni 例外降级 warning）→ 在。`git diff` 删掉的行逐条对照：旧 summary、`relations: []`、旧算例三条（M9/M10/M11 的 Qwen3-0.6B 数字，按写手说明删除并换成示意数）、量化段首句（已扩写）均有对应新文，无丢信息。

**链接与锚点。** `tensor-parallel.md#两种切法各算一遍拼起来还是加起来`、`#从一层走到整次前向r1-的通信账`、`#共享专家切法仍是列接行归约由外层安排` 对应现有标题（L86 / L260 / L325）；入链 batch-invariance.md:237、index.md:113/200、log.md:143、fuse-allreduce-rms.md:125、layer-sharding.md:118 均为整页链接，可解析；lint 通过。

**浏览器实测。** Playwright 1440 宽打开 http://localhost:5193/#/wiki/enable-matmul-allreduce，首屏与「为什么存在」节（含派发次序图）渲染正常，示意数演算四条、图内分支标注可读（截图 scratchpad `enable-matmul-allreduce-review-1.png`、`-review-2.png`，审查会话 1237c9d2）。

**问题清单。**
- **P2-1 学习顺序：GLM 双机三段放在「一句话」节内，排在「为什么存在」之前。** 位置：一句话节第 4–6 段。影响：读者还没读到「行并行为什么要 AllReduce、融合省的是什么」，就先遇到 48 处、int8 排布、32,768 B 这些细节，第一屏负担偏重；共同要求是先讲为什么和代价，再落 GLM 数字。不记 P1：定义和生效前提已先讲，且 W8A8 结论本身正确。改法：把「假如打开……」与「就算只看 KDA 层……」两段挪到「开了的代价」里「量化模型走不通」之后，一句话节只留「本部署两版都有这个开关、默认关，官方教程没配，没开」一句加下文指向。
- P3-1 一句话节称「本部署钉住的两个 vllm-ascend 版本（v0.23 维护分支、含 GLM 代码的那份快照）」。执行侧实际跑的是 db701c1f 那份快照，2c59ff10 维护分支没有 GLM 代码（见 glm-5-3-flash-two-node.md「版本差异」）。结论不受影响（两版都有这个键、都默认关），但措辞容易让读者以为两版都在跑，建议改成「本部署跑的是含 GLM 代码的 db701c1f 快照，v0.23 维护分支同样带着这个开关、默认关」。
- P3-2 「启动时显存探测那一趟就过不去」没有写明显存探测会跑真实前向这一前提，初学者会疑惑为什么探测阶段就触发；可补半句「显存探测会先跑一遍真实前向」。

**跳过。** 无（代码块、sources 区、版本谱系与自动生成节按纪律未读正文）。

## P5 修订记录（10-02）

正文 11,162 → 11,585 字（wiki:audit 口径）。按「P5 审查（10-02）」逐条处理：

**P2-1（清）。** 「放到 GLM 双机」三段从「一句话」节挪进「开了的代价」，紧跟在「量化模型走不通」之后（四段式不变）；一句话节只留一句「本部署跑的 db701c1f 快照带着开关、默认关，官方双机教程没配，所以没开，开了会怎样见下文」。「量化模型走不通」末句、「为什么存在」示意数第 4 条、事实表第 2 行里指向 GLM 段的「见上文」同步改为「见下一段 / 见下文」；KDA 那段里「按下文 512 行一块的假设」改为「按上文」。

**W8A8 推断链写进正文（按审查员核清的链条）。** 「问题出在 W8A8」改为四步编号链：① 融合分支前提成立时直接把权重转置交融合算子、不经量化方法 [C27]（db701c1f linear_op.py:427–441）；② W8A8 动态量化加载后把权重转成「输入 × 输出」[C28]（w8a8_dynamic.py:127–128），再转置一次与融合算子要的排布相反，稠密 MLP 降维投影每卡输入 1536、输出 4096（02 §3.3），形状必然不等，且 int8 张量没带反量化参数；③ int8 / BF16 分布（02 L66–L69）；④ 第 0–2 层注意力是 KDA、MLP 是稠密 int8，第一处失败在第 0 层稠密 down_proj，显存探测先跑真实前向，故启动阶段就起不来 [D]。派发不看层名与量化、前四条细粒度分支本部署没开（教程无 additional_config）写进「假如打开」段。保留单独一行「待核：实际报错原文（哪个算子抛、报形状还是报类型），需要在设备上实跑」，未写成定论。

**P3。**
1. 清：GLM 段首句改为「本部署跑的是含 GLM 代码的 db701c1f 快照，它带着这个开关、默认关 [C26]，v0.23 维护分支同样带着、同样默认关」；事实表第 2 行改为「本部署跑的 db701c1f 有、没开（维护分支同样有）」。
2. 清：第 4 步写明「启动时的显存探测会先跑一遍真实前向」。

**三检。** pnpm wiki:lint 整站退出码 0（本页无报错无提示，内联标记仍为 30 处）；pnpm wiki:diagrams --check 290 张一致；pnpm wiki:audit 整站退出码 0，本页来源 29 条、行号全部有效。图未改。
