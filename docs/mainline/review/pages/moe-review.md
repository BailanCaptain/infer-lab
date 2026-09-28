# moe 页审查与写作记录

## P5 写作记录（2026-09-28，第 06 批深改）

### 改了什么

从 3,447 字（旧版 99 行、5 个 H2，按 wiki:audit 的正文字数口径）深改到 11,235 字、9 个 H2，按「先直觉、后数字」重排：

1. **第一屏换成直觉图 + 一句话定义。** 新建 `wiki/diagrams/moe-intuition.yaml`（通用图：一个 token → router 打分 → 6 个专家里选中 2 个 → 按权重相加 → 输出；未选中的画成灰色，k=2 只作示意）。首屏先解释 MoE、expert、router、top-k、路由专家、共享专家，再往下用。
2. **第二屏讲动机与代价。** 唯一的 calc「一层 MoE 里，一个 token 用上多少专家参数」：一个专家 3 × 4096 × 2048 = 25,165,824；一层 288 个 = 7,247,757,312；一个 token 8 个 = 201,326,592，占 2.8%。代价列三条：参数仍要常驻、多一步 router 与一次搬运、负载不均，后两条链接 expert-parallel。再用一张 4 行小表分开路由专家 / 共享专家 / router / 专家内部的 gate 分支。
3. **router 打分单独一节。** 四个环节（打分函数、只用于选人的校正偏置、归一化、整体缩放）＋ `moe-pick` 图 ＋ 符号式子，并补了旧版没有的**分组选择**机制（按组取最高分先选组，GLM 两个值都是 1 所以退化）。
4. **路由专家与共享专家的区别单独一节**，说法与 expert-parallel 第一节逐句对齐（已 grep 核对：路由专家是可供 router 选择的整个集合、每层 288、每 token 选 8；共享专家每层 1 个、不过 router、不参与 EP）。
5. **GLM 一节**：45 层里前 3 层稠密、第 3–44 层 MoE；router 用 sigmoid、偏置只选人、归一后乘 2.5、`n_group=1`/`topk_group=1`；打分按 FP32；R1 的 router 形状 `[4,4096] × [4096,288] → [4,288]`；沿用 `glm-flash-moe` 图。
6. **新增「共享专家走的是哪条计算路径」一节**，处理底稿 02 §3.4 的待核（见下）。新建 `wiki/diagrams/moe-branches.yaml`：左右两条分支各四步、出口相加，图上不写代码名。
7. **负载一节**：保留旧版 2 个 token 的选择表，补上「负载不均怎么产生」「整层耗时由最慢的卡决定」，并把 aux loss 与校正偏置两类训练期办法讲开。
8. **常见误解 7 条 + 对照源码五个 H3**（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置），版本差异按 v0.23（`db701c1f`、`2c59ff10`）、v0.26（`2ed6cbba`）、main（`baa023ad`）逐项写。

### 数字取自哪里

全部取自底稿 `docs/mainline/02-forward.md`：§6.1（288 + 1 个共享专家、4096→2048→4096、每卡 18 个）、§6.2（`GateLinear` FP32、`moe_gating_top_k` 的 k=8/k_group=1/group_count=1/renorm=1/norm_type=1/routed_scaling_factor=2.5、`n_group=1` 与 `topk_group=1` 退化）、§6.7（共享专家 TP8、`reduce_results=False`、多流开关默认 False、W8A8 的四步算子）、§6.9（R1 的 router 形状与 T=4）、§8.6（负载不均的放大效应、偏置只能提供统计均衡）。整批的 96,768 对 / 每专家 336 行 / 每卡 6,048 行按单一出处留在 concurrent-requests，本页只链接；每卡字节账留在 glm-5-3-flash-two-node 与 expert-parallel。

### 核心概念对照了什么

- **偏置只用于选人、组合权重用原始分数、归一化后再乘缩放系数**：`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py` 的 `_select_expert_use_group_topk`（L203-232，`original_weights` 那一段）与 `_native_select_experts`（L340-395，`topk_weights * routed_scaling_factor`），融合算子参数在 L292-309。
- **分组选择的语义**：同文件 `_native_grouped_topk`（L171-192）：按组取最高分选组，其余组置 0。
- **GLM 的 router 与共享专家怎么建**：`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538`（`GateLinear(params_dtype=float32, force_fp32_compute=True)`、`e_score_correction_bias` 只在 `topk_method == "noaux_tc"` 下创建、`shared_experts` 是 `AscendGlm5NextMLP`）。
- **静默回退**：同文件 `check_npu_moe_gating_top_k`（L139-168）。顺带发现它判断专家够不够多时用的是 `hidden_states.shape[-1]`（4096）而不是专家数（288），GLM 下不影响结论，已在「会报什么错」写明。

### 底稿 02 §3.4 待核的核实结果（不改底稿）

底稿 §3.4 的待核问：稠密 MLP 是否与共享专家一样用 `npu_dequant_swiglu_quant` 融合算子。逐行读下来，**共享专家确实用了融合算子**，而且它根本不走 `AscendGlm5NextMLP.forward`：

- `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671` 的 `_forward_shared_experts`：`has_quantized_shared`（两个投影都有 `weight_scale`）且 `quant_type in (W8A8, W4A8)` 时，直接取 `self._shared_experts.gate_up_proj.weight` / `down_proj.weight`，依次调用 `npu_dynamic_quant` → `npu_quant_matmul(output_dtype=int32)` → `torch.ops._C_ascend.npu_dequant_swiglu_quant(clamp_limit=…)` → `npu_quant_matmul`。模块自己的 `act_fn`（`SiluAndMulWithClamp`）在这条路径上不被调用。
- 条件成立：`vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L153` 的 `process_weights_after_loading` 对普通线性层保留 `weight_scale` 并另建 `weight_scale_fp32`（只有 `wq_b` + `enable_dsa_cp()` 那条分支才删掉 `weight_scale`）。
- 旁证：main（`baa023ad`）把这条路径重构成 `AscendSharedExperts`，并显式命名为 `SharedExpertMLPPath.A8_INT_FUSED`，注释写 `explicit A8 quant + fused activation quant`；未量化时才是 `LINEAR_WRAPPER`。v0.23 维护分支（`2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L726-L800`）与 v0.26（`2ed6cbba:…#L824-L900`）是同一段逻辑。

**连带发现（需要另一页处理）**：`wiki/concepts/mlp-residual-norm.md` 第 254 行与 289 行写「稠密 MLP 和 shared expert 实际走的是上游 vLLM 的 PyTorch 写法……影响范围是前 3 层稠密 MLP 和 42 层的 shared expert」。按上面的源码，W8A8 部署下共享专家不走那个模块的前向，注册名对不上这件事对它没有影响。本轮按范围只在 moe 页写明正确结论，没有改 mlp-residual-norm，也没有改底稿。

### 旧版信息清单勾选（清单存 scratchpad\p5\moe-facts.md，共 20 条）

F1–F14、F17、F18、F20 全部在新版能找到（多数讲得更细，例如 F5 的「不指定时间安排」在新版变成「本部署里共享专家与路由专家串行，多流开关默认关」）。三条有去向：

- **F16 的「每个标量 2 字节 → 单专家 48 MiB、整层 13.5 GiB」删掉**。理由：本部署路由专家按 int8 存，expert-parallel 已定稿为一个完整路由专家 24 MiB、主干 283.5 GiB；旧版按 2 字节假设算出的 48 MiB 会和部署页对不上，而且字节账按单一出处归 expert-parallel / glm-5-3-flash-two-node。新版保留同一推导的参数量部分（72.48 亿），字节改为链接。
- **F19 的「双机依据见 sources/glm-5-3-flash-baseline.md」改为链接 `glm-5-3-flash-two-node.md#部署前提`**，按写作标准「部署前提统一链接到那一节」。
- **F15 的「gate、up、down 三个无偏置投影」保留**（写在 GLM 那一节）。

### 验证

- `pnpm wiki:lint` 通过，本页 0 条提示（中途修掉的：relations 的 kind 用了枚举外的值、两个 alias 与别页重复、内联标记 34 处超上限，现为 30 处）。
- `pnpm wiki:diagrams` 生成 `moe-intuition.svg`、`moe-branches.svg`；`pnpm wiki:diagrams --check` 通过，本页两张新图无提示。
- `pnpm wiki:audit` 通过：本页 21 条来源里 18 条源码引用的文件与行号范围全部命中（另 3 条是 config.json 与两篇论文的 URL，属于该检查不覆盖的范围）。
- 用 `src/content/wiki/anchors.ts` 的 slug 规则脚本核对了本页全部 17 处内部链接与锚点，全部命中。
- 未做浏览器验收（按本批分工由审查环节负责），未跑 `pnpm check:content` 之外的构建。

### 仍待核

页末「待核」四条：前 3 层用稠密前馈网络的权衡、校正偏置在训练中如何调整、共享专家融合算子与路由分支的实际时间关系、专用镜像里最终装的算子组合。另外两篇论文（`arxiv.org/abs/1701.06538`、`arxiv.org/abs/2412.19437`）只用于说明训练侧两类均衡办法的分工，本轮未联网核对原文，已在页末写明。

## P5 审查（09-28）

审查员：Opus 5.5 独立审查，只审不改页面。读法按纪律：串行单调用、不派子代理、每次源码 ≤20 行；正文只读到「对照源码」之前，该节只用 grep 核结构。

### 1. 初学者测试（只读前两屏）

**MoE 把一层的前馈计算换成「一池专家 + 一个 router」：router 给每个 token 的隐藏向量对每个专家打分，只让分最高的几个专家算，输出按分数加权相加；好处是一层能装很多参数而每个 token 的矩阵乘只有 k 个专家那么多（GLM：288 里选 8，用到 2.8%），代价是全部专家权重仍要常驻显存、多一次 router 和跨卡搬运、各专家收到的 token 数不均而整层由最慢的卡决定。** 前两屏能独立说清概念和三样代价，术语（隐藏向量、top-k、稀疏激活、组合权重）都是先解释后用。

### 2. 核心概念逐条核实

| 页面说法 | 结论 | 证据 |
| --- | --- | --- |
| 偏置只用于选人，不进组合权重 | ✅ 对 | 原生路径 `experts_selector.py#L214-L218`（存 `original_weights`、再把偏置加到分数上）与 `#L224-L227`（用加偏置的分数取 topk、权重从 `original_weights.gather`）；GLM 实际走融合算子，kernel 层同样成立：`csrc/moe/moe_gating_top_k/op_kernel/moe_gating_top_k_e_k_fullload.h#L132-L141` 把 sigmoid 分数加偏置写入 `xBiasTensor`，`#L154` 只用它排序，`#L290` 的输出权重是从未加偏置的 `xSigmoidTensor` gather 出来的 |
| 先归一化、再整体乘 2.5 | ✅ 对 | 原生：`#L194-L200` 除以选中项之和 → `#L117-L118` 乘 `routed_scaling_factor`；融合：`#L295-L307` 同时传 `renorm=1`（`moe_gating_top_k_tiling.cpp#L40/#L217` 的 `RENORM_L1` 即 L1 归一）与 `routed_scaling_factor`。注：算子 proto 注释说 renorm「只能为 0」已过期，tiling 支持 1，不是页面问题 |
| 分组选择的语义 | ⚠️ 只写对了一半 | 原生 `_native_grouped_topk#L171-L192` 确实取组内最高分；但 GLM 走的融合算子在 `#L300` 固定传 `group_select_mode=1`，语义是「按组内前 2 名之和排序」（`moe_gating_top_k_proto.h#L40`）。本模型 `n_group=1` 两者等价，但页面 L140 把「每组最高分」写成了通用机制 → 见 P2-1 |
| router 按 FP32 计算 | ✅ 对 | `glm5_next.py#L1480-L1484` `GateLinear(..., params_dtype=torch.float32, out_dtype=torch.float32)`，偏置 `#L1489` 也是 float32；与底稿 `02-forward.md:69` 的 FP32 清单一致 |
| noaux_tc 的含义 | ✅ 对 | `glm5_next.py#L1488-L1491`：只有 `topk_method == "noaux_tc"` 才建出 288 个数的 `e_score_correction_bias`，否则为 None。页面 L219 的措辞「不用辅助损失、改用校正偏置」与 [S3] 的做法同名同义 |
| 每层 288 个路由专家、选 8 个、另有 1 个共享专家 | ✅ 对，且与 expert-parallel 一致 | `glm5_next.py#L1460-L1461`、`#L1505-L1517`（`num_experts=n_routed_experts`、`top_k=num_experts_per_tok`、`shared_experts=` 由 `n_shared_experts` 建）；底稿 `02-forward.md:30`；EP 页每卡 18 个 = 288 ÷ 16 对得上 |

### 3. 写手的核心结论：共享专家确实走融合算子 —— 成立

- `fused_moe_0_23_0.py#L559` 定义 `_forward_shared_experts`；`#L569-L572` 的进入条件是 gate_up 与 down **都有** `weight_scale` 且 `self.quant_type ∈ {W8A8, W4A8}`；`#L576-L618` 就是 `npu_dynamic_quant`（`#L576`） → `npu_quant_matmul(output_dtype=int32)`（`#L580`）→ `npu_dequant_swiglu_quant(clamp_limit=...)`（`#L596`）→ `npu_quant_matmul`（`#L612`）四步，全部直接取 `self._shared_experts.gate_up_proj.weight / weight_scale / weight_scale_fp32` 与 `down_proj.*`；只有 `#L645-L655` 的 else 分支才调模块自己的 `_shared_experts_part1/2`。
- W8A8 这个前提有据：`quantization/methods/w8a8_dynamic.py#L160` 的 `AscendW8A8DynamicFusedMoEMethod.quant_type = QuantType.W8A8`，`#L151` 建出 `weight_scale_fp32`。
- 旁证也对：main `baa023ad:ops/fused_moe/shared_experts.py#L55` 的枚举 `A8_INT_FUSED` 注释写明「W8A8/W4A8：显式 A8 量化 + 融合激活量化」，`#L511/#L546/#L549` 是选路与 `LINEAR_WRAPPER` 兜底，`#L350` 起的 `_run_a8_int_mlp` 是同一条四步链。
- 结论：**不需要回改 mlp-residual-norm**。该页 L255 与 L290 已经是「shared expert 不受注册名错位影响、走融合链」的写法，与本页一致；两页互链的锚点也命中。

### 4. 删掉 F16「2 字节 → 单专家 48 MiB / 整层 13.5 GiB」—— 删得合理

- 本部署路由专家按 int8 存，单一出处在 `expert-parallel.md#L384-L388`（完整专家 24 MiB、EP16 每卡每层 432 MiB）与 `glm-5-3-flash-two-node.md#L109`（43 层 × 18 个 × 24 MiB），底稿 `02-forward.md:67` 的 int8 清单也把路由专家和共享专家列在内。保留 2 字节的算法会同时违反单一出处与部署口径，还会让读者以为一层 13.5 GiB。
- 新版没有因此丢信息：容量口径改成链接（L97 → 模型总览参数量、L166 → 部署页权重表），calc（L88-L95）保留了标量口径 25,165,824 / 7,247,757,312 / 201,326,592 / 2.8%，并注明只算三片矩阵。全页 grep 无 MiB/GiB，口径干净。

### 5. 另抽 5 条

1. 「gate、up、down 三个都不带偏置项」（L166）✅ `glm5_next.py#L1419/#L1427` 两处 `bias=False`（投影本体在 `#L1416/#L1424`）；FusedMoE 构造（`#L1505-L1521`）也没有传 bias。
2. 「中间宽度 2048，比前 3 层稠密的 12288 窄得多」（L166）✅ 底稿 `02-forward.md:28/:30`。
3. 「R1 的 router 形状 `[4,4096] × [4096,288] → [4,288]`」（L160）✅ 底稿 `02-forward.md:753`。
4. 「打分函数只认三种，改别的抛 `Unsupported scoring function`」（L225）✅ `experts_selector.py#L351-L358`（softmax / sigmoid / sqrtsoftplus 三支 + `raise ValueError`）。
5. 「多流开关默认关闭，官方教程也没开」（L180）✅ `ascend_config.py#L139` 默认 False；官方教程钉的是 `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`，`git grep` 在该文件里既搜不到 `multistream_overlap_shared_expert` 也搜不到 `--additional-config`（与基线页 L132 的说法一致）。注意 `GLM5.md`/`GLM5.2.md` 教程是开着这个开关的，但那是别的模型，本页把话限定在本部署，成立。
6. calc 四个数与 288 ÷ 8 = 36 复核无误；2 个 token → 16 对 / 12 个专家（L192）复核无误。

### 6. 有没有丢信息

`git diff -- wiki/concepts/moe.md`（对 `14591fd`）只看删除行，逐条对回 F1–F20：F1–F14、F15、F17、F18、F20 都在新版找到且多数更细；F19 的「双机依据见 sources/…」改为链接部署页「部署前提」；只有 F16 的字节数被删（见上）。新增的 router 四环节、共享专家计算路径、训练侧两类均衡办法、7 条常见误解都是增量，没有以删代改。

### 7. 链接与锚点

正文 20 处链接（含 12 个锚点）逐个核到目标页标题：`glm-5-3-flash.md` 的「参数量…」「权重精度…」「版本差异」，`glm-5-3-flash-two-node.md` 的「部署前提」「每张卡上放了什么」，`expert-parallel.md` 的「放到 GLM 双机…」「1. router 打分，选出 top-8」「MC2 还是 AllGather」「怎么开」，`one-request.md#42 层 MoE…`，`concurrent-requests.md#第 4 站 MoE 通信…`，`tensor-parallel.md#稠密 MLP 与共享专家…`，`mlp-residual-norm.md#对照源码`，以及页内锚点「一批 token 怎样落到专家上…」——全部命中。全库指向本页的锚点链接只有 2 处（都在 `mlp-residual-norm.md` L255/L290），指向「共享专家走的是哪条计算路径」，命中。

### 8. 结构与写作标准

五个 H3 齐全且顺序正确（L215 怎么开 / L223 会报什么错 / L229 开销和什么时候别开 / L237 版本差异 / L249 源码位置）；版本差异三行分别是 v0.23（`db701c1f`/`2c59ff10`）、v0.26（`2ed6cbba`）、main（`baa023ad`），三个分支的引用都逐个验过行号与内容（main 的 router 重构成 `AscendGroupedTopKRouter`、共享专家重构成 `AscendSharedExperts` 都对得上）。「对照源码」之上 grep 不到证据角标；行内代码 8 处；全页只有 1 个 calc，与两张表都不相邻；四张图宽度 860/880/900/900，均 ≤ 900。

### 9. 跑了什么

- `pnpm wiki:audit`：本页 21 条来源（3 条 URL + 18 条源码）全部 ✓，无越界、无无效 commit。全库唯一 1 处失败在 `concepts/gap-a5164fe10fa9184412f8.md` 的 `vllm@0fc695fc:vllm/utils/mem_utils.py#L256-L276`（out-of-range），与本页无关。
- `pnpm wiki:lint`：`ok`，输出里本页 0 条提示。
- 未做：浏览器渲染核对（本轮只做内容审查）、URL 联网核对、`pnpm build`。

### 10. 打分与问题清单

**9 / 10。** 核心概念只有「分组选择」一处口径不全，其余全部与源码对得上；共享专家那条结论核准。

- **P1**：无。
- **P2-1｜L140 分组选择只写了原生语义。** GLM 实际走的融合算子按「组内前 2 名之和」排序（`group_select_mode=1`，`moe_gating_top_k_proto.h#L40`），页面写成「用每组里的最高分代表这一组」。改法：在该段补半句——两种实现对「一组的代表分」取法不同（原生取组内最高分，融合算子取组内前 2 名之和），本模型两个分组值都是 1 时等价，所以结论不变。
- **P2-2｜moe-branches 图缺「同一条隐藏向量进两支」的连线。** `wiki/diagrams/moe-branches.yaml` 的 `links` 里没有从输入框 `[330,44]` 到两条分支首格的连线，生成的 `moe-branches.svg` 只有 6 条竖线 + 2 条汇合线，输入框是悬空的。而本页 L144/L176 的核心说法正是「两者处理同一条隐藏向量、出口直接相加」。改法：加一个 `fans`（从输入框底边分到两支的第一格），与 moe-intuition 的画法一致。
- **P3-1｜引用范围差两行。** 「归一化后再乘缩放系数」在原生路径是 `experts_selector.py#L117-L118`，但 C6 只到 L115、C7 从 L139 起，正文 L269 与版本表 L243 却把这条挂在 [C7] 上。改法：把 C6 的范围改成 `#L30-L120`。
- **P3-2｜W8A8 首次出现（L154）没给一句解释。** 页面后面 L176 直接用「量化方式是 W8A8 或 W4A8」。改法：L154 那句里加「权重 8 位、激活 8 位」六个字，或把链接从「部署前提」改到 quantization 的定义处。
- **P3-3｜术语口径三页不统一。** 本页与 expert-parallel 用中文「路由专家 / 共享专家」为主名，mlp-residual-norm 用英文 routed experts / shared expert 为主名，而 `wiki/TERMS.md` L33-L36 的主名是英文（且没有 routed expert 这一行）。改法：在 TERMS 定一次，然后三页一起改，别只改本页。
- **P3-4｜本页不在 `scripts/wiki/standard-pages.json` 名单里。** 现在这一版已经满足名单里的各项检查（五个 H3、角标、行内代码、calc、图宽、hedge），建议加入名单以防回退。
- **P3-6｜W8A8 这个前提本身没被引用覆盖。** L176 的成立条件里「量化方式是 W8A8 或 W4A8」来自 `w8a8_dynamic.py#L160`（`AscendW8A8DynamicFusedMoEMethod.quant_type = QuantType.W8A8`），而本页引用只到 `#L127-L153`（那一段证明的是两个投影带缩放系数）。改法：把该条引用范围扩到 `#L127-L162`。
- **P3-5（可选）｜moe-intuition 的 router 只连了两个被选中的专家。** 文字（「每个专家一个分数」＋图注）能补回来，如要更准可给未选中的 4 个补淡色连线。

### 跳过了哪些段

按纪律跳过：frontmatter 的 sources 清单内容（由 `wiki:audit` 校验，只用于映射 C 编号）、「对照源码」的正文（只 grep 结构与版本关键字）、页内代码块与算式块的逐字复核（只核数值与算术）、HANDBOOK 与 docs/plans、TERMS.md 整份（只 grep 相关两行）。没有遇到读取被拦。

## P5 修订记录（09-28，按审查小修）

写手：Opus 5.5。只改 `wiki/concepts/moe.md` 与 `wiki/diagrams/moe-branches.yaml`、`moe-intuition.yaml`（及生成的 svg）。

### 改了什么

- **P2-1 分组选择**：正文「router 怎样打分、怎样选 top-k」末段（L141）改为「每组算一个代表分：原生实现取组内最高分；GLM 实际走的融合算子固定取组内前 2 名之和；两个分组值都是 1 时只有一组且必然入选，两种取法结果相同」。核实：`db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h#L40`（0 = max，1 = top-2 之和）与 `#L56`（默认 0）；调用方 `experts_selector.py#L284`（hash 变体）与 `#L300` 都传 `group_select_mode=1`；原生 `_native_grouped_topk#L180` 是 `.max(dim=-1)`。新增来源 C22 = proto.h `#L40-L56`，源码位置表加一行、改两行说明。
- **P2-2 moe-branches 图**：加两条连线，从输入框左右两侧（`[330,69]`、`[550,69]`）折线进入两支第一格（`[300,148]`、`[700,148]`）；没用 fans 的斜线，因为右侧斜线会穿过框标签「共享专家分支 · 不打分」。图注加「每个 token 的同一条隐藏向量同时进入两支」。画布仍是 880×470。
- **P3-1**：C6 改为 `experts_selector.py#L30-L120`（覆盖 L117–L118 乘缩放系数，已读源码核对），源码位置表同步；证据索引把「原生路径最后乘缩放系数」挂到 [C6]。
- **P3-2**：W8A8 首次出现处（GLM 小节首段）补「权重和激活都按 8 位整数算」并链接 [量化](quantization.md)。
- **P3-5**：moe-intuition 给 4 个未选中专家补 router 出发的淡色虚线（无箭头，表示打了分但没发 token），图注说明虚线含义。
- **P3-6（C13）**：C13 改为 `w8a8_dynamic.py#L127-L162`，覆盖 `#L160` 的 `quant_type = QuantType.W8A8`；源码位置表与证据索引同步。
- 证据索引重排：C9、C12 已在「会报什么错」「开销和什么时候别开」就地标注，索引里不再重复，保证全页标记数仍为 30（未触发 mark-flood）。
- 未做：P3-3（术语三页统一，需改 TERMS 与另两页，超出本页范围）、P3-4（改 `scripts/wiki/standard-pages.json`，写手不碰 scripts/）。

### 验证

- `pnpm wiki:diagrams`：写入 moe-branches.svg、moe-intuition.svg；`--check` 结果 `ok wiki:diagrams 184 张图与 spec 一致`，本页两图无提示。同次生成还写入了 `sparse-attention-path.svg`（别的写手正在改的未跟踪 yaml，只是按其现有 spec 重新生成）。
- `pnpm wiki:lint`：本页 0 条（含 mark-flood）；全库 9 处失败都在其他页（block-table、context-parallel、kv-pool、pd-disaggregation、prepare-inputs-flow、recompute-cpu-offload、vllm-kv-block-allocation 等）。
- `pnpm wiki:audit`：本页 22 条来源（3 URL + 19 源码）全部通过，含新增 C22；全库唯一失败是 `concepts/block-table.md` 的 summary 超长，与本页无关。
- 未做：浏览器渲染核对（按分工留给审查）。
