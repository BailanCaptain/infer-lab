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

## 基础讲清修订（09-29）

按 09-29 基础页标准（总原则：是什么 → 为什么 → 怎么算 → 细节 → GLM → 误解 → 源码）重排并补演算。正文字数（写作标准口径）3654 → 5771。

### 逐节改动

| 新节 | 来源与改动 |
| --- | --- |
| MoE 是什么？ | 旧 §1。先交代它替换的是每层的前馈网络（隐藏向量、attention、FFN 各一句 + 链接），再讲专家池 / router / top-k，加医院分诊比喻（注明专家分工是训练形成的）；引入贯穿全页的示意例：6 个专家、k = 2、「我吃了苹果」4 个 token，「苹果」选专家 2、4。路由专家定义保留「整池可挑选的集合，不是这次选中的子集」。moe-intuition 图只把「一个 token」改成「苹果」。 |
| 为什么需要 MoE，代价在哪？ | 旧 §2。GLM 的 288 专家 / 2.8% calc 按标准第 12 条移到 GLM 节；这里换成示意数表（每专家 4→8→4 共 96 参数；6 选 2、60 选 2、同参数稠密三行对比），讲清「参数随专家数涨、每 token 计算只随 k 涨」。三样代价保留，第 1 条加一句说明专家并行并链 expert-parallel。四名字对照表挪到共享专家一节末尾（gate 分支讲完再列）。 |
| MoE 怎么算？跟着一个 token 走一遍 | 旧 §3 的 P1。用「苹果」走六步示意数：① x=[1,0,2,1] 与专家 2 那列点积得 z₂=2；② sigmoid 得 s=[0.27,0.88,0.82,0.73,0.12,0.62]，和 3.44 不是 1，附 softmax 对照；③ 偏置 b（专家 3 −0.2、专家 4 +0.1）后 s+b 选中 2、4，不加偏置会选 2、3；④ 权重回到 s 取 0.88、0.73 → 0.547、0.453（误用 s+b 会得 0.515、0.485）；⑤ ×2（示意）→ 1.09、0.91，和为 2；⑥ 1.09×E₂(x)+0.91×E₄(x)=[1.09,1.82,3.09,−0.18]。新图 moe-router-calc + calc 块，再给四行通式。「原始分数」统一指 s（未加偏置），z 叫 router 算出的数，与 moe-pick 图用词一致。 |
| 分组选择：先选组，再在组里选专家 | 旧 §3 末段独立成节并补演算：同一组 s+b 两两分 3 组、选 1 组，按组内最高分选中组 1（专家 1、2），按前 2 名之和选中组 2（专家 3、4），不分组是 2、4；两值为 1 时退化。原生 / 融合算子各用哪种取法原文保留。 |
| 共享专家：每个 token 都要过的那一个 | 旧 §4。补接续演算：共享专家输出 [0.2,−0.1,0.3,0] 直接加，得 [1.29,1.72,3.39,−0.18]；分工用意、同名 gate、部署切法（GLM 的 TP8 细节挪到 GLM 节）、四名字对照表。 |
| 一批 token 怎样落到专家上，负载为什么会不均 | 旧 §7，按标准第 13 条挪到 GLM 之前。示例从 GLM k=8 的 A/B 两 token 换成「我吃了苹果」4 token 各选 2 个（8 配对、5 个专家、专家 2 收 4 行、专家 6 为 0）；新图 moe-batch-load 画按专家归拢成矩阵、卡 A 6 行 vs 卡 B 2 行空等。aux loss / 校正偏置两类办法保留，并接回第 ③④ 步；推理时偏置固定用本批专家 2 被全选来印证。 |
| 落到 GLM 双机（5 个 H3） | 旧 §5 + §6 + 从基础节挪来的 GLM 内容：形状（glm-flash-moe、4096→2048→4096、共享专家与路由专家同形，已对 glm5_next.py#L1468 `moe_intermediate_size * n_shared_experts` 核实）；参数比例 calc（2.8%、36 倍、总览链接）；router 配置（sigmoid、288 偏置、归一化 ×2.5、分组退化、FP32、R1 形状、moe-pick 图，并点明与「苹果」例同一算法）；共享专家（TP8 切 + 融合算子四步 + 串行 + MC2 一句解释）；负载（noaux_tc 属第二类、42 层逐层累加、concurrent-requests 链接、EPLB 默认关）。部署前提补一句 TP8/DP2/EP16 各指什么（与 two-node 页表格一致）。 |
| 常见误解 | 第 1 条例子改指新表（4 token 用到 5 个专家）；新增「加了偏置，组合权重也跟着变」（用 0.73 vs 0.83 说明）。 |
| 对照源码 | 五个 H3 不动；只把「源码位置」末段 [A] 示例说明从旧 2 token/12 专家改成新示意例。 |

### 核实
- 路由专家 / 共享专家定义：`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538`，`FusedMoE(num_experts=n_routed_experts, top_k=num_experts_per_tok)` 是整池可选专家；`shared_experts` 是单独的 `AscendGlm5NextMLP`，不经 gate。与 DeepSeekMoE / DeepSeek-V3 的 shared / routed 划分一致。
- 偏置只选人：`experts_selector.py#L139-L232` 先存 `original_weights`、加偏置后分组与 topk，再 `original_weights.gather(1, topk_ids)` 取权重、归一化；分组代表分也基于加了偏置的分数。
- 示意数：sigmoid(−1, 2, 1.5, 1, −2, 0.5) = 0.269, 0.881, 0.818, 0.731, 0.119, 0.622；0.88/1.61=0.547，×2=1.09；softmax 对照 0.022, 0.441, 0.268, 0.162, 0.008, 0.098。

### 清单勾选
现有信息清单（scratchpad/moe-basics-facts.md）原有 60 项（机制 53 + 误解 7）全部勾选：59 项保留（多数原文照搬、只挪位置），1 项换例子（GLM k=8 两 token 示例 → 贯穿全页的示意例，结论不变）。无删除。

### 图
- 新增 moe-router-calc（900×520）：四排表 z / s / b / s+b，选中格高亮，实线从 s 排取数、虚线按编号，下面归一化、×2、加权相加三步都带数；只用现有 grids / items / links / badges / texts。
- 新增 moe-batch-load（900×400）：一批 4 行输入 → 两张卡六个专家各自归拢的矩阵 → 两条耗时条（卡 B 空等）。
- 改 moe-intuition：标签改成「苹果」。
- 新增图元：无。

### 检查
- `pnpm wiki:lint`：通过，本页 0 条。
- `pnpm wiki:diagrams --check`：220 张图与 spec 一致；本页新图无提示（初稿 moe-router-calc 有「文字超 8 段」提示，已改用格子行标签收敛）。
- `pnpm wiki:audit`：本页写作标准全 ✓（5771 字、行内代码 0.2/千字、calc 0.35/千字、免责 0.0%、图先行、图宽），22 条来源通过。
- 浏览器（Playwright，1440 宽，http://localhost:5193/#/wiki/moe）：第一屏与新图截图 scratchpad/moe-shot-1.png、moe-shot-2.png（另有 moe-shot-3.png 批次图、moe-shot-calc.png 算式块）；数字清晰、无重叠裁切，控制台无报错；页内 5 个新锚点与 mlp-residual-norm 两个新锚点均在页面上找到对应 id。

## 基础讲清审查（09-29）

**分数：8.5 / 10。逐节初学者检验 6/6 通过；P1 0 条，P2 1 条，P3 8 条。`pnpm wiki:audit` 本页通过（写作标准 8 项全 ✓，5771 字，calc 0.35/千字，22 条来源行号全部解析）；`pnpm wiki:diagrams --check` 222 张图与 spec 一致；`pnpm wiki:lint` 通过。**

### 1. 学习顺序
第一节先交代 MoE 换掉的是每层的前馈网络（隐藏向量、attention、FFN 各一句），再讲专家池 / router / top-k，配医院分诊的直觉和「我吃了苹果」的具体例子，不算数；第二节讲为什么（参数随专家数涨、计算只随 k 涨，示意表）和三样代价；第三节才开始演一个 token 的路由。顺序符合「是什么 → 为什么 → 怎么算」，无 P1。

### 2. 逐节初学者检验（GLM 双机之前 6 个 H2）
| 节 | 初学者读完能讲出的一句话 | 结论 |
| --- | --- | --- |
| MoE 是什么？（71–89） | 每层的一个前馈网络换成一池小专家，router 给每个 token 挑 k 个去算，结果按权重加回原宽度；没选中的专家不算但仍占显存 | 通过 |
| 为什么需要 MoE，代价在哪？（91–109） | 专家从 6 加到 60，参数涨 10 倍，每个 token 仍只乘 2 个专家的 192 个参数；代价是参数全得常驻、多一步打分和搬运、负载不均 | 通过 |
| MoE 怎么算？（111–153） | 点积得 z → sigmoid 得 s → 加偏置 b 后选前 k → 回到没加偏置的 s 归一化再乘 r → 按权重加专家输出 | 通过；「偏置只改选谁」在 ③④、calc、通式、负载节、误解里讲了五遍，同一组数前后对得上 |
| 分组选择（155–169） | 先按组代表分挑组再在组里挑专家，代表分取最高分还是前 2 名之和会选出不同专家；两个值都为 1 时退化 | 通过（组与卡的对应关系只是隐含，见 P3-4） |
| 共享专家（171–190） | 共享专家不打分、不乘权重，直接加到路由分支输出上；专家内部的 gate 和选专家的「门控」不是一回事 | 通过 |
| 一批 token 与负载（192–216） | 一批 token 各选各的，按专家归拢成矩阵；热门专家所在的卡行数多，整层等最慢的卡；训练用 aux loss 或校正偏置压平，推理时偏置固定 | 通过 |

### 3. 演算逐个手算
- 为什么节示意表：3×4×8=96；6×96=576、2×96=192、1/3；60×96=5,760、192/5,760=1/30≈3.3%；稠密多乘 30 倍 ✓。
- ① x=[1,0,2,1] 与 [0.5,1,0.5,0.5] 点积 = 0.5+0+1+0.5 = 2 ✓。
- ② sigmoid(−1, 2, 1.5, 1, −2, 0.5) = 0.269, 0.881, 0.818, 0.731, 0.119, 0.622，两位小数与页面一致，和 3.44 ✓；softmax 对照 e^z 之和 16.74，得 0.022, 0.441, 0.268, 0.162, 0.008, 0.098 ✓。
- ③ s+b：0.82−0.2=0.62、0.73+0.1=0.83；前 2 名 0.88（专家 2）、0.83（专家 4）；不加偏置前 2 名 0.88、0.82（专家 2、3）✓。**同一组分数加偏置前后选中的专家确实不同。**
- ④ 0.88+0.73=1.61，0.547/0.453 ✓；误用 s+b：1.71，0.515/0.485 ✓（全精度 0.8808/1.6119=0.546，差异在舍入内）。
- ⑤ ×2 → 1.094/0.906 → 1.09/0.91，和 2 ✓。
- ⑥ 1.09×[1,0,2,−1]+0.91×[0,2,1,1] = [1.09, 1.82, 3.09, −0.18] ✓。
- 分组：组和 1.15 / 1.45 / 0.74，组最大 0.88 / 0.83 / 0.62；按最大选组 1 → 专家 1、2，按前 2 名之和选组 2 → 专家 3、4 ✓。
- 共享专家：[1.09,1.82,3.09,−0.18]+[0.2,−0.1,0.3,0] = [1.29, 1.72, 3.39, −0.18] ✓。
- 批次：专家 2 收 4 行，1/3/4/5 各 1，6 为 0，共 8 配对、5 个专家；卡 A 1+4+1=6、卡 B 1+1+0=2 ✓。与第一节「苹果 2、4」「吃 2、5」一致。
- GLM calc：3×4096×2048=25,165,824；×288=7,247,757,312；×8=201,326,592；8/288≈2.78%；288/8=36 ✓。
- 两张新图（moe-router-calc、moe-batch-load）里的数与正文逐格一致。

### 4. 核心概念核实
- **偏置只改选谁、不改权重**：钉住版本 `vllm-ascend@db701c1f` 的 `experts_selector.py` 原生路径 L214–L231 先存未加偏置的分数、加偏置后分组与 topk，再按选中编号从原分数取值、归一化；融合算子参考实现（`tests/e2e/nightly/.../test_npu_moe_gating_top_k.py` L80–L108）同样是 sigmoid → 存原分数 → 加偏置选组选专家 → 取原分数 → 除以和（+eps）→ 乘 routed_scaling_factor。DeepSeek-V3 论文 §2.1.2 原意相同：偏置只用于路由，门控值仍来自原始亲和分数。页面正确。
- **top-k 之后的归一化**：GLM 走 sigmoid 后在选中的 k 个里除以它们的和（不是 softmax），再乘 2.5；GLM 满足融合算子条件（sigmoid 且 renormalize=True、分组两值为 1），走 `moe_gating_top_k`。页面通式 αⱼ = r·sⱼ/Σsᵢ 正确。
- **分组代表分**：原生 `_native_grouped_topk` 取组内最大值（L180）；融合算子 `group_select_mode=1`，算子原型注释写明 1 = 组内前 2 名之和；两者都在加了偏置的分数上比较。页面正确。
- **路由专家 / 共享专家**：`glm5_next.py` 中 `FusedMoE(num_experts=n_routed_experts, top_k=num_experts_per_tok)` 是整池可选专家，`shared_experts` 单独建、不经 gate；DeepSeek-V3 输出式把共享专家项直接相加、路由专家项对全部 N_r 个求和（未选中的门控为 0），即「路由专家」指整池。页面第 89 行与误解第 2 条定义正确，没有再出现「被挑选的专家」式误写。

### 5. 没丢信息
随机抽清单 6 条：F9（下一层重新选）→ 87 行 ✓；F13（总参数与激活参数另一套口径）→ 243 行 ✓；F32（前 3 层为何不用 MoE 无公开说明）→ 228 行 ✓；F35（R1 的 [4,4096]×[4096,288]）→ 253 行 ✓；F43（串行、多流开关默认关）→ 269 行 ✓；F48（aux loss 最早、拔河、掉效果；GLM 用校正偏置）→ 213–214、274 行 ✓。`git diff` 删掉的行逐条对过：均为挪位或改写；唯一换掉的是旧版 GLM k=8 两 token（A:0–7、B:4–11）示例，结论（top-k 只约束单 token、按专家归拢、批次越大几乎全用到）保留在新例子里，误解第 1 条与源码位置 [D] 同步改了。无丢失。

### 6. 标准第 11–14 条
- 11：五处「怎么算」都有数值演算 ✓。
- 12：基础节（71–216 行）没有 288 / 4096 / 2.5 / TP8 等部署数字，只有指向 GLM 一节的链接；分组节一句「GLM 实际走的融合算子」是在说哪种实现用哪种取法，不是部署数字 ✓。
- 13：负载节已挪到 GLM 之前；GLM 之后只有常见误解和对照源码 ✓。
- 14：第一节末尾没有堆链接；75 行一段内有 5 个链接，但每个都当场一句话讲清，不算堆 ✓。

### 7. 图
- moe-shot-1：第一屏是定义、上下文、分诊比喻、「苹果」例和直觉图，字清晰无裁切。
- moe-router-calc（moe-shot-2）：四排 z / s / b / s+b 一眼看出偏置把第 3 格换成第 4 格；实线「从 s 这一排取数」和虚线「按编号取」把「选人用 s+b、权重用 s」画出来了；下面三步带数。不看文字能看懂。
- moe-batch-load（moe-shot-3）：4 行输入 → 两张卡六个专家各自叠成的矩阵（专家 2 是 4 行）→ 6 行 vs 2 行 + 空等，机制清楚。
- moe-shot-calc：calc 块渲染正常。
- 小问题见 P3-1、P3-5。

### 8. 锚点
- 本页出链的新锚点（mlp-residual-norm `#前馈网络怎样变换一个位置的特征`、`#门控-mlpswiglu`、`#对照源码`；expert-parallel、glm-5-3-flash、two-node、one-request、tensor-parallel、concurrent-requests 各锚点）在目标页都有对应标题 ✓；页内 5 个锚点与本页标题一致 ✓。
- **入链有断的：** `wiki/concepts/mlp-residual-norm.md` 第 255、290 行链到 `moe.md#共享专家走的是哪条计算路径`，这个 H2 在本轮改写中改成了 H3「共享专家：按 TP8 切，走融合算子」，旧锚点已不存在（见 P2-1）。全库其他入链只有这两处。`wiki:lint` 没有查出这一类跨页锚点。

### 9. 打分与问题清单（8.5 / 10）

**P1：无。**

**P2**
1. **入链锚点断了**（`wiki/concepts/mlp-residual-norm.md` 255、290 行）：两处仍指向旧标题 `#共享专家走的是哪条计算路径`，点进来只落到页首，读者找不到融合算子那一段。改法：两处都改成 `moe.md#共享专家按-tp8-切走融合算子`（255 行的链接文字可同步改成新标题）；复现：`grep -n "moe.md#共享专家走的是哪条计算路径" wiki/concepts/*.md`。

**P3**
1. moe-intuition 图右侧「× 权重 1」「× 权重 2」：图已经绑定「苹果」例，初学者容易读成「乘 1」「乘 2」，和后文 1.09 / 0.91 对不上。改成「× 专家 2 的权重」「× 专家 4 的权重」或直接写 1.09 / 0.91。
2. 第 ④ 步（127 行）只说「模型不是这样算的」，为什么这样设计（均衡压力不直接扭曲输出）要到 214 行才讲；④ 末补半句。
3. 偏置的调法（125、214 行）只说「选得多的调低」；DeepSeek-V3 原文是超载减 γ、欠载加 γ，补「选得少的调高一点」。
4. 分组选择（157 行）「命中的组少，要联系的卡就少」默认了「一组专家放在同一台机器 / 同一批卡上」；补半句（DeepSeek-V3 的按机器限流正是按机器分组、取每台前几名之和）。
5. moe-router-calc 图从 z 开始，第 ① 步「x 与专家 2 那一列点积得 2」只在正文；可在图左加 x 和第 2 列一小条，也可保持现状。
6. 通式后一句（153 行）「换成低精度或融合算子执行时……」出现在「融合算子」于 159 行定义之前，轻度先用后讲；加括注或挪后。
7. 为什么节（95 行）「三片」依赖门控 MLP 的知识，只给了链接；补半句「gate、up 两片把 4 扩到 8，down 一片缩回 4」。
8. 「选得多一倍，这一层就慢一倍」在 209、274 行各出现一次，且是忽略通信与固定开销的粗略说法；保留一处并加「粗略地说」。

**旁注（不计分，页面没写错）：** 钉住版本原生选择路径里，`_native_select_experts` 已在 L369 / L391 乘过 routed_scaling_factor，`select_experts` 在 L117–L118 又乘一次；GLM 走融合算子不受影响，调用方是否传 1.0 未查。

### 跳过了什么
frontmatter 来源区、「对照源码」正文（只 grep 了五个 H3 标题和源码位置 [D] 那一行）、HANDBOOK、docs/plans 未读；GLM 的 config.json 取值（288 / 8 / 2.5 / 分组 1 / noaux_tc）本轮未改动，沿用 P5 审查的核实，没有重新拉取；DeepSeek-V3 论文 §2.1.2 用网页抓取核对了偏置只用于路由、门控值来自原分数、超载减欠载加、共享与路由两项的输出式。未起停任何服务，未开子代理。

## 基础讲清审查后修订（09-29）

### P2
- 入链锚点：`wiki/concepts/mlp-residual-norm.md` 第 255、290 行两处只改锚点部分，`moe.md#共享专家走的是哪条计算路径` → `moe.md#共享专家按-tp8-切走融合算子`；链接文字和该页其他内容未动（`git diff --stat` 该页 2 行增 2 行删）。
- 全库 `grep -rn 'moe.md#'`（wiki/、src/、scripts/、docs/mainline/ 底稿）：入链只有这两处，已无指向不存在锚点的链接（`docs/mainline/review/` 里的历史审查记录照原样保留）。
- 浏览器实测：在 mlp-residual-norm 页点这条链接，跳到 `#/wiki/moe#共享专家按-tp8-切走融合算子`，目标标题滚到视口顶部（top = 16px）。

### P3（8 条全修）
1. moe-intuition 图「× 权重 1 / 2」→「× 专家 2 的权重」「× 专家 4 的权重」。
2. 第 ④ 步末补一句：训练时为均衡负载调偏置，不会直接扭曲这一层的输出。
3. 偏置调法两处（第 ③ 步、负载节「校正偏置」）补「选得少就调高一点」。
4. 分组选择补一句：部署时让一组专家放在同一台机器（或同一批卡）上，命中的组少，要联系的机器和卡就少；DeepSeek-V3 的分组就是按机器分的。
5. moe-router-calc 图 z 排右侧加「专家 2：x · 第 2 列 = 2」（图上文字 8 段，未超限）。
6. 「融合算子」的括注定义挪到首次出现的通式后一句，分组节第二次出现时去掉括注。
7. 为什么节「三片」改写：两片 4 × 8（gate、up）把 4 个数扩到 8 个，一片 8 × 4（down）缩回 4 个。
8. 「选得多一倍就慢一倍」只保留负载节一处，并加「粗略地说（不算通信和固定开销）」；GLM 负载小节改成「负载不均的代价 42 层逐层累加」。

### 检查
- `pnpm wiki:lint`：通过，moe、mlp-residual-norm 0 条。
- `pnpm wiki:diagrams --check`：222 张图与 spec 一致，本页三张图无提示。
- `pnpm wiki:audit`：通过；moe 写作标准 8 项全 ✓（5866 字、calc 0.34/千字、免责 0.0%），mlp-residual-norm 仍全 ✓。
- 截图更新：scratchpad/moe-shot-1.png（第一屏）、moe-shot-2.png（router 演算图）、moe-shot-4-intuition.png（直觉图），数字清晰、无重叠裁切，控制台无报错。
