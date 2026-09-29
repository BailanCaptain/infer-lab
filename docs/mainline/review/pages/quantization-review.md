# quantization · 审查记录

## P5 写作记录（2026-09-28，第 03 批，Opus 5.5 深改）

### 改了什么

整页重写，旧版 1,224 字 → 5,720 字（正文 3,171 字，`## 对照源码` 之前），H2 从 5 节变 9 节，按「第一屏定义＋通用直觉图 → 为什么需要与代价 → 双机推演 → 常见误解 → 对照源码」排。

- 新增两张图：`wiki/diagrams/quantization-intuition.yaml`（880×440，机制直觉图：权重按输出通道离线压成 INT8、激活按 token 现场压成 INT8、整数乘加、缩放系数不进乘加只在最后乘回来）、`wiki/diagrams/quantization-flow.yaml`（880×400，代码流程图＋主线站点：加载时逐层判精度的分支，前向时每一步的算子，虚线表示加载期选中的方法决定前向路径）。旧的数值算例图 `quantization.yaml` 保留不动。
- 新增小节：动态与静态量化的对照表（系数由谁定、什么时候定、粒度、代价）、「哪些矩阵是 8 位」（讲按层生效的机制并给出依据强度表）、「为什么 EP dispatch 搬的是 int8」、常见误解 6 条。
- 单一出处：W8A8 的逐部件分层表和加载后转置只链 `matmul-and-weights`，不重复；每卡权重字节链 `glm-5-3-flash-two-node#每张卡上放了什么`；dispatch 的每副本字节账链 `cann-hccl#数据精度和本地计算怎样影响通信`；派发路线链 `expert-parallel`；KV 的降精度链 `kv-cache-quantization`。
- 本页唯一新推导（calc）：每卡每层路由专家的缩放系数与偏移 576 KiB、加载后另存的 FP32 系数副本 288 KiB，辅助合计约占权重主体（432 MiB，引自部署页）的 0.2%。
- 角标 25 处（C 19、S 2、D 2、I 2），全部在 `## 对照源码` 之后；正文行内代码 4 处 / 3,171 字。

### 数字取自哪一节

底稿 `docs/mainline/02-forward.md`：§0.4（量化范围与精度划分的推断依据、描述文件缺失）、§1.3（每卡每层路由专家 432 MiB、42 层 17.72 GiB、整卡 20.58 GiB）、§3.4（稠密 MLP 的 W8A8 算子路径）、§6.6（专家段的量化算子、分组矩阵乘与中间再量化、加载后转置与设备格式）。calc 里的 4096 通道数与 18 个本地专家取自 §6.3、§6.6 的形状。

### 核心概念对照了什么

按 `vllm-ascend@db701c1f`（orphan commit，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）逐项核实：

| 结论 | 对照的源码 |
|---|---|
| W8A8 动态方法：权重按 `[输出维, 输入维]` 建 INT8，每个输出通道一个 `weight_scale` 与 `weight_offset`；前向先对输入逐 token 动态量化，再调量化矩阵乘，输出类型跟随输入 | `quantization/methods/w8a8_dynamic.py#L48-L152` |
| 专家侧：两块权重都是 INT8，系数按专家 × 通道保存；加载后转置并转成设备分块格式，另存一份 FP32 系数 | 同文件 `#L155-L289`、`#L353-L370` |
| 静态 W8A8 的区别在激活：建参数时就留了整张量共享的 `input_scale`/`input_offset`，还有整数偏置与反量化系数；且只注册了 linear，没有 moe | `quantization/methods/w8a8_static.py#L33-L141`、`methods/registry.py#L19-L62` |
| 精度按层生效：读 `quant_model_description.json` 的 `<前缀>.weight`，`FLOAT` 换不量化实现；融合层各分片精度必须一致；注册表键是（精度名称, 层类型） | `quantization/modelslim_config.py#L60-L70`、`#L365-L470`、`#L632-L736` |
| 自动探测与用户值优先 | `quantization/utils.py#L83-L205` |
| EP dispatch 传 int8：`dispatch_with_quant` 对 W8A8 为真，目标类型 `torch.int8`、系数类型 `torch.float32` | `ops/fused_moe/moe_stage_params.py#L91-L119` |
| 专家段在 dispatch 已量化时跳过一次量化，中间结果由融合算子再量化 | `ops/fused_moe/moe_mlp.py#L133-L215` |
| **精度划分的依据强度（本轮新核实）**：KDA 层的九个投影（q/k/v、f_a、f_b、b、g_a、g_b、o）与索引器的 `wk_weights_proj` 建层时传 `quant_config=None`，与描述文件无关，必然不走量化实现；稠密 MLP 的 gate_up/down、MoE 的 `experts`、`shared_experts`、稀疏 MLA 的四个投影、索引器的 `wq_b` 都接了 `quant_config`（P5 修订更正：原写把 router 的 `gate` 列在这里、投影数写成六个，均错，见文末修订记录），实际精度仍由描述文件决定 | `models/glm5_next.py#L1235-L1300`（索引器）、`#L1403-L1540`（稠密 MLP 与 MoE）、`#L1541-L1680`（KDA）、`#L1881-L1960`（稀疏 MLA） |
| 三版差异：v0.23 `2c59ff10`、v0.26 `2ed6cbba` 的动态/静态方法路径、默认与步骤一致（含超大投影拆块分支）；main `baa023ad` 把方法移到 `methods/w8a8/`、去掉拆块分支，配置类移到 `quantization/configs/modelslim_config.py`，描述文件名与探测函数不变 | 三个 commit 的 `w8a8_dynamic.py`（`#L48-L152`、`#L47-L151`、`#L59-L127`）、`baa023ad:quantization/configs/modelslim_config.py#L80-L90` |

### 旧版信息清单勾选（清单在 scratchpad\p5\quantization-facts.md）

旧版 = `git show p4-checkpoint:wiki/concepts/quantization.md`（与改前工作区一致，diff 为空）。22 条逐条核：

- 保留在新版：F1（权重/激活的角色与「另存恢复参数」）、F2、F3、F4、F5、F5b（数值算例图原样保留）、F6、F7、F8、F9、F10（合成式 `ŷ = sₓ × s𝑤 × Σ q q` 写在「一个数怎样压下去」）、F11、F12、F15、F16、F17、F18、F19、F20（换精度要记录的清单移到「开销和什么时候别开」）、F21（KV 降精度另算，正文链 `kv-cache-quantization`）。
- 改写但结论保留：F13 的 `2²⁰` 元素算例换成真实部署的口径——按元素的字节对照表（BF16 2 B / INT8 1 B＋系数、偏移、可能的填充）加上 432 MiB 与 864 KiB 的 calc，「INT8 只是主体减半、另有辅助参数」这个结论没丢。F14 的「不能按一个 W8A8 名称统一减半」移到「哪些矩阵是 8 位」与常见误解第一条，`moe.md` 链接保留在动机段。
- 元数据：F0a 别名全部保留并新增（动态量化、静态量化、缩放系数）；F0b 的 `matmul-and-weights` builds-on 保留并另加四条 relations；F0c 旧的五条来源都在新来源表里（`utils.py` 的两段并成 `#L83-L205`）。
- 删除：无。

### 本轮验证

- `pnpm wiki:lint` 通过（22 处待留意都在别的页，本页 0 条）；`pnpm check:content` 通过；`pnpm wiki:diagrams` 生成两张新图后 `--check` 报 168 张图与 spec 一致；`pnpm wiki:audit` 通过，本页 21 条来源行号全部有效。
- 本页不在 `scripts/wiki/standard-pages.json` 的名单里（写手不改 scripts/），所以写作标准只统计不报错。按名单口径自算：正文 3,171 字、行内代码 4 处（1.3/千字，上限 13）、calc 1 块（0.3/千字，上限 1.2）、正文角标 0、免责句 0、首图在第 1 个 H2 且在首个 calc 之前、表与 calc 不相邻、三张图画布宽都是 880 ≤ 900、`## 对照源码` 的 H3 依次是怎么开/会报什么错/开销和什么时候别开/版本差异/源码位置且其后无 H2。
- 未做：浏览器实测与截图（按本轮写手要求，浏览器验收留给独立审查）；`quant_model_description.json` 仍缺，第二级精度划分仍是推断。

### 给协调者的两件事

1. `matmul-and-weights` 的分层表现在整段标「精度划分是推断」。本轮核实后可以细化：表里 BF16 那一行的「KDA 层的全部投影」与索引器的 K/打分投影是源码写死的（建层时 `quant_config=None`），与描述文件无关；只有接了 `quant_config` 的那批（稠密 MLP、路由专家、共享专家、稀疏 MLA 四个投影、索引器 `wq_b`、词表投影）才是推断。依据见本记录上表末两行。（P5 修订更正：原写把 router 列进推断、投影数写成六个，均错；router 不接量化配置、按 FP32 建和算，`matmul-and-weights` 的 FP32 一行本来就对，无需改。见文末修订记录。）
2. 本页可以考虑加入 `scripts/wiki/standard-pages.json` 名单，让写作标准对它强制生效。

## P5 审查（09-28）

审查员：Opus 5.5 独立审查（只审不改）。审的是工作区的 `wiki/concepts/quantization.md`（已改未提交）与两张新图 spec。

**分数：7.5 / 10。** 核心机制（W8A8 四步、动态与静态之分、calc 的字节账）逐条核到源码行号，全部成立；扣分集中在「精度划分依据」这一节的两处事实错误，都会误导读者，也都已被写进本文件的 §给协调者，有扩散风险。

### 初学者测试（只读前两屏）

「量化把权重按输出通道、激活按 token 分别压成 INT8，各留一组缩放系数；乘加只在整数里做，最后乘回两份系数、输出回到 BF16。省的是字节（本部署路由专家 42 层 17.72 GiB，占每卡 20.58 GiB 的大头），付的是舍入与截断误差、多出来的系数与量化步骤，而且只有能量化的层才省。」前两屏能独立说清，通过。

### P1

**P1-1 router 的打分矩阵被归错类（第 142、144 行）。** 表第二行把 router 列进「建层时接了量化配置，实际精度由描述文件决定」，正文又写「router 的打分矩阵虽然接了量化配置……」。源码相反：`va:vllm_ascend/models/glm5_next.py#L1480-L1487` 建 `GateLinear` 时根本没有传 `quant_config`，而 `v:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L59-L65` 对 `super().__init__` 写死 `quant_config=None`；同文件 `#L47-L57` 的 `force_fp32_compute` 在非 CUDA 平台把 `params_dtype` 设成 FP32。router 属于第一行「与描述文件无关，一定不走量化实现」，结论强度被写弱了，而且「接了量化配置」这句话本身是错的。
改法：把 router 移到表第一行；正文那句改成「router 的打分矩阵连量化配置都没接，权重按 FP32 建、打分也强制在 FP32 里算」。本文件 §给协调者 第 1 条同错，需一并改，否则会被搬进 `matmul-and-weights`。

**P1-2 流程图把「描述文件没有条目」讲反了（`wiki/diagrams/quantization-flow.yaml` 的 texts 第一条 / 渲染后图上方灰字）。** 图注写「描述文件里没有条目时也按不量化处理」。源码：`va:vllm_ascend/quantization/modelslim_config.py#L729-L733` 的 `is_layer_skipped_ascend` 非融合分支是 `any(key.startswith(prefix) … and value == "FLOAT")`，没有条目 → `False` → **不**换不量化实现；随后 `get_linear_quant_type`（`#L397`）直接 `quant_description[prefix + ".weight"]`，缺条目抛 KeyError，融合分支在 `#L719` 同样是字典直取。也就是说缺条目既不会退回浮点，也不会安静兜底，而是报错。
同一处偏差还出现在正文报错表（第 176 行）：`Could not determine quantization type for layer …` 被解释成「这一层在描述文件里查不到精度」，但该 ValueError 只在 `get_quant_type_for_layer` 返回 `None` 时触发（`#L452-L455`），查不到条目的真实症状是 KeyError。
改法：图注改成「描述文件要覆盖每一层，查不到条目会直接报错，不是按浮点兜底」；报错表那一行的触发条件同步改写。

### P2

**P2-1 「稀疏 MLA 的六个投影」多算了两个（第 142 行）。** `va:.../glm5_next.py#L1917-L1948` 是 if/else：`q_lora_rank` 非空建 `fused_qkv_a_proj` + `q_b_proj`，否则才建 `kv_a_proj_with_mqa` + `q_proj`。GLM-5.3-Flash 的 `q_lora_rank=1536`（底稿 02 §0.2、§5.7 的每卡权重表只列 `fused_qkv_a_proj`/`q_b_proj`/`o_proj`/`kv_b_proj`），本部署只建四个，「六」把两条互斥分支都算了；`matmul-and-weights` 写的是「三个大投影」+`kv_b_proj`，两页对不上。改成「稀疏 MLA 的四个投影（压缩投影、Q 展开投影、输出投影、KV 展开投影）」，本文件 §核心概念对照 与 §给协调者 同步。

**P2-2 MC2 先用后讲（第 150 行）。** 「本部署的 MoE 走 MC2 路径」是该节论证的前提，但 MC2 在本页从未解释，也没链接；`expert-parallel`（第 108 行）和 `cann-hccl`（第 114 行）都给了一句话定义。补一句「MC2 是昇腾把计算与通信协同起来的一类实现」并链到 `collective-communication#mc2` 或 `cann-hccl`。

### P3

- **P3-1 ±127 与 −128…127 不一致。** 直觉图写「舍入并截断到 ±127」，正文第 47、81 行是「−128 到 127」与 `clamp(round(x/s), −128, 127)`。对称量化常用 ±127，但页面没解释这一点，两处口径应统一或加半句说明。
- **P3-2 KDA 先用后讲。** 第 141 行表格里先出现 KDA，第 144 行才解释它是 GLM 的两种 attention 层之一；把解释句提到表前即可。
- **P3-3 常见误解第 1 条把分层表复述了一遍**（KDA 投影/索引器/嵌入表/词表 BF16、router 与 mHC FP32），与 `matmul-and-weights` 的表重合。虽然给了链接，仍是双份表述，改一处容易漂；压成一句加链接更稳。

### 核过并成立的部分（附行号）

- **W8A8 六点全对**：权重按 `[输出维, 输入维]` 建 INT8、每输出通道一个 scale 与 offset（`w8a8_dynamic.py#L61-L73`）；激活 `npu_dynamic_quant` 按 token 现算（`#L82`）；`npu_quant_matmul` 吃两份 INT8（`#L115-L121`）；`output_dtype=x.dtype` 所以输出跟随输入回到 BF16；缩放系数不进乘加、只在反量化时用上；加载后转置并按条件转设备格式（`#L128`、`#L146-L152`）。
- **动态 vs 静态**：静态方法建参数时就留 `input_scale`（形状 `[1]`，整张量一个）、`input_offset`（int8）、`quant_bias`（int32）、`deq_scale`（`w8a8_static.py#L55-L69`），与表里「校准定好、整张量一个、前向不再求系数、另有整数偏置与反量化系数」一致；`W8A8` 只注册 linear、`W8A8_DYNAMIC` 注册 linear 与 moe，与 `methods/registry.py` 一致。
- **calc 复算通过**：`4 × 18 × 4096 × 2 B = 589,824 B = 576.0 KiB`；`18 × 4096 × 4 B = 294,912 B = 288.0 KiB`；`864 ÷ 442,368 = 0.195% ≈ 0.2%`。「只另存一份 FP32 系数」也对：`#L362` 只建 `w13_weight_scale_fp32`，w2 侧没有 FP32 副本。w13 的通道数 `2 × I = 4096`、w2 的 `H = 4096` 与底稿 §6.6 的形状一致。
- **底稿数字一致**：432.0 MiB / 层 / 卡、42 层 17.72 GiB、整卡 20.58 GiB 与底稿 02 §1.3 逐字对上。
- **依据表第一行成立**：KDA 九个投影 `quant_config=None` 在 `#L1581, 1588, 1595, 1602, 1609, 1621, 1661, 1668, 1675`；索引器 `wk_weights_proj` 在 `#L1288`；索引器 `wq_b` 确实接了 `quant_config`（`#L1281`），与表第二行一致。
- **dispatch 搬 int8 成立**：`ops/fused_moe/moe_stage_params.py#L92-L100` 的 `dispatch_with_quant` 含 `QuantType.W8A8`，`#L102-L112` 目标类型 `torch.int8`，`#L114-L119` 系数类型 `torch.float32`。
- **单一出处**：分层表与加载后转置只链 `matmul-and-weights`（后者的 `#开销和什么时候别开` 确实有转置与数学形状那段，第 209 行），dispatch 字节账只链 `cann-hccl#数据精度和本地计算怎样影响通信`，KV 降精度只链 `kv-cache-quantization`，本页没有重算。唯一新推导就是那一块 calc。
- **旧版清单抽查 6 条（F1、F9、F13、F14、F17、F20）**：F1 在第 45 行、F9 在第 114 行、F14 在第 64 行与常见误解第 1 条、F17 在第 167 行（探测顺序、compressed-tensors、fp8 标记、用户值优先与 warning）、F20 在第 190 行与第 220 行的来源基线链接；F13 的 `2²⁰` 算例按写手说明换成每元素字节表加真实口径 calc，结论没丢。没有发现被静悄悄删掉的信息。

### 本轮验证

- `pnpm wiki:audit`：通过；本页 21 条来源行号全部有效（`concepts/quantization.md … 来源 21 条`）。
- 链接与锚点：页内 17 条 `.md`/`.md#锚点` 链接按 `src/content/wiki/anchors.ts` 的 slug 规则全部解析，无失效。全库指向本页的链接只有 `embedding.md` 的 `quantization.md#哪些矩阵是-8-位哪些保持-bf16`——旧版没有这个标题，这次改动顺带把它从断链修好了（其余 `quantization.md#L…` 命中的是上游仓库同名文档，与本页无关）。
- 写作标准（本页不在名单，自算）：正文 3,246 字、行内代码 4 处（1.2/千字）、calc 1 块（0.31/千字）、正文角标 0、表与 calc 不相邻、免责词 0。注意本文件写「三张图画布宽都是 880」，实际 `quantization.svg` 是 900（仍 ≤ 900，不违规）。
- 浏览器实测（`pnpm dev` + 1440×900）：正文列宽 1032px，三张图 880 / 900 / 880 全部放得下，无横向滚动；`pnpm wiki:figshots quantization` 截了三张，两张新图排版清楚、无重叠，P1-2 的错误图注就是在截图里复核的。
- 按读文件纪律跳过的段落：frontmatter 的 sources 清单（第 8–29 行）、`## 对照源码` 正文（第 163–234 行，只用 grep 核了五个 H3 的齐全与顺序、版本差异里 v0.23 / v0.26 / main 三行齐全、正文无角标，另外按 P1-2 需要 grep 读了报错表第 176 行）。

### 补充核对（协调者追加项：索引器是否被整体写成源码证实）

**不成立，不记 P2。** 本页已经把索引器拆开写了：依据表第一行（第 141 行）只写「索引器的 K 投影与打分投影」，对应 `va:vllm_ascend/models/glm5_next.py#L1284-L1290` 的 `wk_weights_proj`（`MergedColumnParallelLinear(hidden_size, [head_dim, n_head])`，即 K 投影与每头打分权重合成一个，建层传 `quant_config=None`）；`wq_b` 被放在第二行的推断那一批（第 142 行「索引器的 Q 投影」），与 `#L1281` 接 `quant_config` 一致。措辞与行号都对得上，无需改动。

**顺带一条 P3（可选）**：嵌入表比本页给的结论更硬——`#L2263-L2267` 建 `VocabParallelEmbedding` 时连 `quant_config` 参数都没传，属于「与描述文件无关」那一行；而词表投影 `lm_head`（`#L2455-L2459`）接了 `quant_config`，属于推断那一批。本页常见误解第一条（第 156 行）把「嵌入表和词表投影」并列说成 BF16，结论没错，但两者的依据强度不同。若要补，依据表第一行可加「嵌入表」，并在第 144 行点出 lm_head 仍是推断。

## P5 修订记录（09-28，Opus 5.5 写手）

按上面「P5 审查」与协调者的补充逐条改，范围只有 `wiki/concepts/quantization.md` 与 `quantization-flow.yaml`、`quantization-intuition.yaml` 两张图。

### P1
- **P1-1 router 归类**：先核行号，全部成立——`va:vllm_ascend/models/glm5_next.py#L1480-L1487` 建 `GateLinear` 不传 `quant_config`，还显式传 `params_dtype=torch.float32`、`out_dtype=torch.float32`、`force_fp32_compute=True`；`v:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L59-L65` 对父类写死 `quant_config=None`（第 64 行），`#L47-L57` 在非 CUDA 平台把 `params_dtype` 设成 FP32。页面：router 移到依据表第一行并标「按 FP32」，表下正文改成「连量化配置都没接，权重按 FP32 建，打分也强制在 FP32 里算」；「源码位置」加一行 gate_linear.py，来源加第 22 项 `vllm@0fc695fc:…/gate_linear.py#L47-L65`，来源与结论对应里单列一条。`matmul-and-weights` 的分层表把 router 放在 FP32 一行（第 97 行），归类正确，未改。
- **P1-2 缺条目的行为**：核实 `modelslim_config.py#L729-L733` 非融合分支 `any(... value == "FLOAT")` 缺条目得 False（不跳过），`#L397` 直接 `quant_description[prefix + ".weight"]` 抛 KeyError；`#L452-L455` 的 ValueError 只在 `quant_type is None` 时抛（`#L401-L430` 看过，None 只可能来自查到的值本身为空）。改动：flow 图注改成「描述文件要覆盖每一层：查不到条目会直接报错，不按浮点兜底」，并补一个 pin `modelslim_config.py#L364-L398`（`get_linear_quant_type`），重新生成 svg；「精度按层生效」段补一句「接了量化配置的每一层都要有条目，缺条目不算 FLOAT、不兜底，取精度时直接报错」；报错表新增 `KeyError: '<前缀>.weight'` 一行承接缺条目，`Could not determine quantization type…` 改为「条目查到了但值为空（如 JSON 写成 null）」，表后「前三条…第四条」相应改成「前四条…第五条」。

### P2
- **P2-1 投影数**：核 `glm5_next.py#L1917-L1950` 的 if/else，`q_lora_rank=1536` 时建 `fused_qkv_a_proj`、`q_b_proj`，另有 `kv_b_proj`、`o_proj`，共四个。依据表第二行改为「稀疏 MLA 的四个投影（Q 与 KV 合并的压缩投影、Q 展开投影、输出投影这三个大投影，加上 KV 展开投影）」，与 `matmul-and-weights` 第 94、96 行「三个大投影」+「KV 展开投影」对齐；来源与结论对应一行同步。
- **P2-2 MC2**：首次出现处加链接 `collective-communication.md#mc2`（该页 `### MC2` 在第 171 行）和一句解释「昇腾把分块计算与通信排成相互重叠的流水的一类实现，不是新的集合通信语义」，口径取自该页首句。
- **P2-3 索引器**：按协调者补充核对的结论（页面已拆开写），不改。

### P3
- **P3-1**：直觉图 `quantization-intuition.yaml` 的「±127」改成「舍入后截到 −128…127」（原「舍入并截断到」加长后超框 4px，缩成「舍入后截到」），与正文第 47、81 行一致。
- **P3-2 KDA**：把「KDA 与稀疏 MLA 是两种 attention 层…索引器…router…」的解释句提到依据表之前，并给 KDA 链到 `linear-attention.md`（标题「KDA：通过递推状态处理序列」）。
- **P3-3 常见误解第 1 条**：删掉逐部件清单，改成一句加三处链接（`matmul-and-weights` 分层表、本页依据表、模型页权重精度）。
- **协调者可选 P3（嵌入表 / 词表投影）**：核 `glm5_next.py#L2263-L2268`（`VocabParallelEmbedding` 不传 `quant_config`）与 `#L2455-L2459`（`ParallelLMHead` 传 `quant_config=quant_config`）。嵌入表加进依据表第一行，词表投影加进第二行，表下正文点明词表投影的 BF16 只是按上游清单推断；来源加第 23、24 项，「源码位置」行号同步。常见误解第 1 条已不再并列两者。

### 本文件内的连带更正
- §核心概念对照 末两行里「router 的 `gate`」「六个投影」、§给协调者 第 1 条里「router」「六个投影」都已就地加注更正，避免被搬进 `matmul-and-weights`。

### 本轮验证
- `pnpm wiki:diagrams`：第一次因直觉图副标题超框（148px > 144px）失败，缩短后通过，更新 2 张（quantization-flow、quantization-intuition）；`pnpm wiki:diagrams --check`：169 张图与 spec 一致。
- `pnpm wiki:lint`：通过（22 处待留意都在别的页）。
- `pnpm wiki:audit`：通过；本页来源 24 条，行号全部有效（全库无效 commit 0、文件不存在 0、行号越界 0）。
- 未做：浏览器实测（留给审查环节）。按读文件纪律，源码只按行号读了 ≤20 行的短片段。

## P5 复审（09-28）

审查员：Opus 5.5 独立复审（只审不改）。范围只核上一节「P5 修订记录」有没有落实，审的是工作区未提交的 `wiki/concepts/quantization.md` 与 `quantization-flow` / `quantization-intuition` 两张图。

**分数：9.0 / 10。** 上轮 P1 两条、P2 两条、P3 三条加协调者的嵌入表补充全部落实，逐条核到源码；本页审计通过。未满分的原因：本轮没有重做浏览器实测（两张图只核了 yaml 与 svg 文本），流程图图注写「直接报错」没有点名 KeyError（点名在正文报错表，可接受）。

| # | 核对项 | 结论 | 证据 |
|---|---|---|---|
| 1 | router 移到「一定不走量化实现」并写明 FP32 | **落实** | 页面第 144 行依据表第一行「router 的打分矩阵（按 FP32）」；第 147 行「连量化配置都没接，而且权重按 FP32 建，打分也强制在 FP32 里算」；第 221 行源码位置、第 30 行来源已加 gate_linear.py。源码：`vllm-ascend@db701c1f glm5_next.py#L1480-L1487` 建 `GateLinear` 不传 `quant_config`，传 `params_dtype/out_dtype=torch.float32`、`force_fp32_compute=True`；`vllm@0fc695fc gate_linear.py#L56-L57` 非特化核时 `params_dtype = torch.float32`，`#L59-L65` 对父类写死 `quant_config=None`。 |
| 2 | 缺条目报 KeyError；ValueError 只在 quant_type 为 None | **落实** | 图注 `quantization-flow.yaml` 第 39 行「描述文件要覆盖每一层：查不到条目会直接报错，不按浮点兜底」，svg 已重生成含该句，全库（wiki/、public/）已无旧句「没有条目时也按不量化」；正文第 134 行补「缺条目既不算 FLOAT，也不会按浮点兜底，而是在取精度时直接报错」；报错表第 179 行新增 `KeyError: '<前缀>.weight'`，第 180 行 `Could not determine…` 改为「条目查到了但值为空」；第 184 行「前四条…第五条」同步。源码：`modelslim_config.py#L397` `quant_description[prefix + ".weight"]` 直取；`#L452-L455` 仅 `quant_type is None` 时 `raise ValueError`；`#L730-L733` 非融合分支只认 `value == "FLOAT"`。 |
| 3 | 稀疏 MLA 投影数改为 4 个，与 matmul-and-weights 一致 | **落实** | 页面第 145 行「稀疏 MLA 的四个投影（…三个大投影，加上 KV 展开投影）」，第 234 行来源对应同为「四个投影」，页内已无「六个投影」。`matmul-and-weights.md` 第 94 行「三个大投影」+ 第 96 行「KV 展开投影」，口径一致。源码 `glm5_next.py#L1917-L1950` 为 if/else（`q_lora_rank` 非空建 `fused_qkv_a_proj`、`q_b_proj`，否则 `kv_a_proj_with_mqa`、`q_proj`），外加 `kv_b_proj`（#L1950）与 `o_proj`（#L1957）；底稿 `02-forward.md` 第 32 行 `q_lora_rank=1536`，本部署走第一支，共 4 个。 |
| 4a | MC2 首次出现处解释或链接 | **落实** | 第 153 行链到 `collective-communication.md#mc2`（目标页第 171 行 `### MC2`），并有一句解释。 |
| 4b | KDA 首次出现处解释或链接 | **落实** | 第 140 行（依据表之前）解释 KDA 与稀疏 MLA 是两种 attention 层、34 层与 11 层（与底稿 02 第 28 行一致），并链到 `linear-attention.md`。 |
| 4c | 嵌入表的依据 | **落实** | 第 144 行依据表第一行加「嵌入表」，第 145 行第二行加「词表投影」，第 147 行点明词表投影 BF16 是推断；来源第 31、32 行、源码位置第 220 行、来源对应第 236 行同步。源码 `glm5_next.py#L2264-L2268` `VocabParallelEmbedding` 未传 `quant_config`，`#L2455-L2459` `ParallelLMHead` 传 `quant_config=quant_config`。 |
| 4d | ±127 写法统一 | **落实** | `quantization-intuition.yaml` 第 17 行改为「舍入后截到 −128…127」，svg 中「±127」计数为 0；正文第 50、84、86 行均为 −128…127 / 127 上限，口径一致。 |
| 4e | 常见误解第 1 条改成链接 | **落实** | 第 159 行只剩一句加三处链接：`matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影`（目标第 86 行）、本页 `#哪些矩阵是-8-位哪些保持-bf16`（第 132 行）、`glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么`（目标第 304 行），标题均存在。 |
| 5 | `pnpm wiki:audit` 本页通过 | **本页通过；全库命令退出码 1** | 本页：`concepts/quantization.md … 来源 24 条`，22 条行号 ✓、2 条 URL 未联网验证，无 x 行。全库汇总：无效 commit 0、文件不存在 0、行号越界 0；唯一失败是 `x concepts/layers-and-hidden.md [schema] summary: summary 是一句话，不超过 200 字`，与本页无关（该页有他人未提交改动 +181/−37，本轮未碰）。 |

### 本轮新发现

无新的 P1、P2。P3 仅一条可选：流程图图注若想与正文完全同口径，可把「直接报错」写成「直接报 KeyError」，不改也不影响理解。

### 本轮验证与跳过

- 源码均用 `git show <commit>:<path> | sed -n` 在 `tools/repos/` 钉住的仓库里读，每段 ≤20 行；`glm5_next.py#L1917-L1950` 与 `#L1951-L2000` 只用 grep 取分支与构造行。
- `pnpm wiki:audit`：见上表第 5 行。
- 未做：浏览器实测、`pnpm wiki:diagrams --check`（修订记录自报 169 张一致，本轮未复跑）。
- 跳过：frontmatter sources 清单只 grep 了新增的第 30–32 行；`## 对照源码` 只 grep 了报错表第 179、180、184 行与源码位置第 220、221 行、来源对应第 234、236 行，未通读。

## 基础讲清修订（09-29）

起点：基础页排查结论「基本讲清，小修」——「省下什么」用 MoE、路由专家、KV cache 和部署数字（432 MiB / 17.72 GiB / 20.58 GiB）论证，这些概念在本页之前都没讲，且 GLM 数字进了基础节。按「是什么 → 为什么 → 怎么算 → 细节 → GLM → 误解 → 对照源码」调整顺序，以挪动和补句为主，没有整页重写。正文 11,168 → 13,864 字（wiki:audit 口径）。

### 逐节改了什么

- **量化是什么？**（原「量化是什么，为什么能少存一半字节？」）：保留定义、张量/权重/激活、BF16/INT8、W8A8 定义。新增一段直觉：定一个系数 0.1（示意），0.26、1.04、−0.18 记成 3、10、−2，乘回得 0.3、1.0、−0.2，13 被截到 127。原在「一个数」一节的 s=0.1 图挪到这里作直觉图（图说明改成初学者能读懂的一句，「恢复值」改「还原值」与正文一致）。补一句「一批数共用一个系数，所以多存的只是少量系数」。「隐藏向量」当场加括号解释。原来的四步图和四步列表挪到新的第 4 节。
- **为什么需要量化？**（新增）：权重常驻卡上内存、每步前向都要读一遍；示意数 1,000 亿参数 × 2 B = 200 GB；KV cache 一句话说明并链 kv-cache，设备内存链 device-memory，token、attention 各一句并链接；读权重是瓶颈的直觉。没有用 GLM 数字。
- **一个数怎样压下去、再还原回来**：保留公式、s=0.1 两个例子和非对称方案；补 round / clamp 的白话、0.26 ÷ 0.1 = 2.6 这一步；新增「s 取多大是一笔取舍」：舍入误差 ≤ s/2、范围 −128s…127s、常见取法 s = 最大绝对值 ÷ 127，用同一组数演示 s = 13 ÷ 127 ≈ 0.102 时前三个数仍是 3、10、−2（引出离群值）。
- **放进一次矩阵乘：W8A8 的四步**（新节，内容来自原第 1 节和原第 3 节）：矩阵乘一句话回顾并链 matmul-and-weights → 四步图 → 四步列表（原文不动）→ ŷ 公式（补 Σ 的含义和系数能提到外面的原因）→ 新图 quantization-dot → 新 calc → 误差来源与更宽累加的解释 → 系数高精度保存（原文）→ 粒度取舍（原文，「元数据」加括号解释）。
- **省下什么，付出什么**：挪到四步之后。删掉的 GLM 段（MoE / 路由专家 / 432 MiB 等）整段挪到 GLM 节；换成示意矩阵 4096 × 4096 的 calc；三笔代价、BF16/INT8 表、「省下的字节不原样变成 KV cache 额度」原文保留。
- **动态量化和静态量化**：表和「固定版本两套实现」保留；「本部署走动态这一路」一段挪到 GLM 节开头。
- **放到 GLM 双机**：新增接收两段——「本部署走动态」（原动态/静态节）和「每张卡的权重大头是专家」（原「省下什么」的 432 MiB / 17.72 GiB / 20.58 GiB 段，MoE 改成一句话说明并链 moe，补「45 层里 42 层是 MoE」，取自 moe 页）。其余不动。
- 「哪些矩阵是 8 位」「为什么 EP dispatch 搬的是 int8」「常见误解」「对照源码」：未改。

### 新增的演算和图

- calc「一个输出元素的四步（示意数）」：x = [0.523, −0.31, 1.27]、w = [0.40, −2.54, 0.86]，sₓ = 0.01、s𝑤 = 0.02，qₓ = [52, −31, 127]、q𝑤 = [20, −127, 43]，整数乘加 10438，ŷ = 2.0876，原数直接算 2.0888，差 0.0012 = 0.003 × 0.40。
- calc「一个权重矩阵换成 INT8 省多少（示意尺寸）」：4096 × 4096，BF16 32 MiB、INT8 16 MiB、每通道系数 + 偏移 16 KiB，合计 ≈ 50.05%。
- 新图 wiki/diagrams/quantization-dot.yaml（900 × 322）：x、w → 除以系数舍入 → qₓ、q𝑤 → 对应位置相乘 → Σ → 10438 → × 0.01 × 0.02 → 2.0876；一个张量一行格子，图上无代码名，文字 8 段。
- 改动的图：quantization.yaml 只改 caption 和一个行标签。
- 新增图元：无（用现有 grids / nodes / links / texts）。

### 信息清单勾选

清单在 scratchpad quantization-basics-facts.md，共 F1–F36。全部保留：F6–F11、F23、F25 挪到「W8A8 的四步」；F12、F15–F19 随「省下什么」挪到四步之后；F13、F14、F29 挪到 GLM 节；F24 挪到第 1 节；其余原位。删除 0 条。

### 本轮验证

- pnpm wiki:lint：通过，本页 0 报错、0 待留意。
- pnpm wiki:diagrams --check：226 张图与 spec 一致；quantization-dot 无提示。
- pnpm wiki:audit：通过；本页写作标准全绿（行内代码 0.9/千字、calc 0.65/千字、相邻块 0、图先行、免责 0.0%、图宽）。
- 浏览器（Playwright，1440 宽，http://localhost:5193/#/wiki/quantization）：第一屏、quantization-dot 图、两个新 calc 均截图查看，数字清楚、不重叠、不被裁。

## 基础讲清审查（09-29）

审查员：Opus 5.5 独立审查（只审不改页面）。依据：basics-standard 总原则与第 1–14 条、排查结论第 4 节、写手本轮记录、facts 清单 F1–F36、固定版本 vllm-ascend@db701c1f 源码。

### 0. 学习顺序
新 H2 顺序：量化是什么 → 为什么需要量化 → 一个数怎样压下去、再还原回来（s=0.1）→ 放进一次矩阵乘：W8A8 的四步 → 省下什么，付出什么（4096×4096 示意）→ 动态/静态 → GLM 双机 → 哪些矩阵是 8 位 → EP dispatch → 常见误解 → 对照源码。第一节先给直觉（「每个数只记它是 0.1 的几倍」+ 四个数的图，不开算），第二节讲为什么，之后才上公式和演算，符合总原则。「省下什么」已排在四步之后，MoE、路由专家、432 MiB / 17.72 GiB / 20.58 GiB 已整段挪到 GLM 节，本节只剩示意矩阵；KV cache 在第二节已有一句话解释，不再先用后讲。通过。

### 1. 逐节初学者检验（GLM 节之前 6 节，6 节通过）
- 量化是什么：「给一批数定一个系数，每个数只记成系数的几倍的整数，用时乘回去；每个数从 2 字节变 1 字节，只差一点，超出 127 的会被截断。」通过。
- 为什么需要量化：「权重常驻卡上内存、每生成一个 token 都要整读一遍，存窄一半就少占一半内存、少读一半字节，给 KV cache 多留地方。」通过（1,000 亿 × 2 B = 200 GB 为示意数）。
- 一个数怎样压下去：「除以 s、四舍五入、截到 −128…127，还原乘 s；误差最多半格；s 取最大绝对值 ÷ 127 就不截断，但离群值会让格子变粗。」通过。非对称方案只有一句，见 P2-1。
- W8A8 的四步：「权重每列一个系数离线压好，激活每行一个系数现压，整数乘加用更宽的整数累加，最后乘回行系数 × 列系数；例子 10438 × 0.0002 = 2.0876，和原数 2.0888 差 0.0012。」通过。
- 省下什么，付出什么：「一个 4096×4096 矩阵从 32 MiB 变 16 MiB，系数只占千分之一；代价是误差、多一步量化与多存系数、只有被量化的层才省；省下的显存不会原样变成 KV cache。」通过。
- 动态/静态：「权重侧一样；动态每次前向按 token 现算激活系数，静态部署前用校准数据定一个整张量系数。」通过（表后一段有几个未解释的词，见 P3-3）。

### 2. 演算逐个手算
- 第 1 节 / quantization 图：0.26÷0.1=2.6→3→0.3；1.04→10.4→10→1.0；−0.18→−1.8→−2→−0.2；13→130→127→12.7。误差 0.04、截断 0.3。全对。
- 第 3 节：s=13÷127≈0.1024，0.26/1.04/−0.18 分别得 2.54/10.16/−1.76，仍舍入为 3/10/−2。对。舍入误差 ≤ s/2、范围 −128s…127s，对。
- calc「一个输出元素的四步」与 quantization-dot 图：sₓ=1.27÷127=0.01，s𝑤=2.54÷127=0.02；qₓ=[52,−31,127]，q𝑤=[20,−127,43]；1040+3937+5461=10438；0.0002×10438=2.0876；原数 0.2092+0.7874+1.0922=2.0888；差 0.0012=0.003×0.40。图与 calc 数字一致。全对。
- calc「一个权重矩阵换成 INT8 省多少」：4096²=16,777,216；BF16 32 MiB、INT8 16 MiB；4096×2×2 B=16 KiB；16,400÷32,768≈50.05%；「千分之一」=1/1024，「省约 16 MiB」对。
- GLM 节：18×3×4096×2048×1 B=432 MiB；42×432 MiB=17.72 GiB；calc 72×4096×2 B=576 KiB、18×4096×4 B=288 KiB、864÷442,368≈0.2%。对。「45 层里 42 层是 MoE」与 moe 页一致。

### 3. 核心概念对照源码（db701c1f）
- `w8a8_dynamic.py` 线性层：权重按「输出维 × 输入维」建 INT8，`weight_scale` / `weight_offset` 形状 `[output_size, 1]`、dtype 取 params_dtype（BF16 即 2 B）——按输出通道、与 calc 的 2 B 一致；`apply` 里 `npu_dynamic_quant` 返回 `pertoken_scale`——激活按 token 动态量化；`npu_quant_matmul(..., output_dtype=x.dtype)`——输出跟随输入即 BF16；加载后转置 + `maybe_trans_nz` + 另存 FP32 系数。页面说法全部对得上。
- `w8a8_static.py`：`input_scale` / `input_offset` 形状 `[1]`（整张量一个），另有 `quant_bias`（int32）和 `deq_scale`。与动态/静态对照表一致。
- 旁证：动态路径的线性与 MoE `apply` 都不把 `weight_offset` 传给矩阵乘（偏移只存、只整形），实际等于对称量化。页面公式写「忽略零点时」没错，但第 5 节「偏移要一起存、一起读」对本部署略宽，见 P3-4。
- 未发现讲错的核心概念。

### 4. 信息没丢
抽查 F3、F11、F16、F19、F22、F29、F33 七条，均在新版写明的位置（F29 在 GLM 节第二段，F33 在「专家是同一套方法的 MoE 版本」）。`git diff` 删掉的行：旧 H2 标题、旧 W8A8 段、旧 432 MiB 段、旧「一个数」节、旧 quantization 图位置、旧粒度段、旧「本部署走动态」段——全部能在新版找到对应内容（多数原文照搬，MoE 解释改写为更完整的一句）。删除 0 条，通过。

### 5. 标准第 11–14 条
- 11：三处「怎么算」都有数值演算；非对称方案没有（P2-1）。
- 12：基础节无 GLM 部署数字；4096×4096 标了示意。「本部署的粒度…」「本部署没有精度对比实测」两句是部署事实而非数字，可接受。
- 13：GLM 节之后还有「哪些矩阵是 8 位」「为什么 EP dispatch 搬的是 int8」两个 H2，但内容全是 GLM/本部署特有（KDA、稀疏 MLA、MC2），属 GLM 的延续，不是通用理解的节；见 P3-5。
- 14：第一节末尾没有堆链接；第二节的 device-memory、kv-cache、attention、token 链接都在用到处，各带一句解释。通过。

### 6. 图
- quantization-shot-1：四个数三行格子，数字清楚、无重叠裁切；不看文字也能看出「原数 → 整数 → 还原」。
- quantization-shot-2（quantization-dot）：数字清楚、无重叠；x、w → qₓ、q𝑤 → 逐位相乘 → Σ → 10438 → ×0.01×0.02 → 2.0876 一眼能读。两个小瑕疵见 P3-6。
- quantization-intuition 四步图是示意流程（无数），由紧随其后的 quantization-dot 补上数值，合理。
- `pnpm wiki:diagrams --check`：226 张图与 spec 一致。

### 7. 锚点
全库指向本页的锚点只有 `#哪些矩阵是-8-位哪些保持-bf16`（3 处 + 历史记录），标题未改，可解析；页内锚点同一个。旧标题「量化是什么，为什么能少存一半字节？」无外部锚点引用。通过（`_jobs` 缓存里的 `#Lnn` 行号引用不是页面链接，不计）。

### 8. audit
`pnpm wiki:audit`：本页 13,864 字 / 11 节，写作标准 ✓行内代码 0.9/千字、✓角标 0、✓对照源码、✓calc 0.65/千字、✓相邻块 0、✓图先行、✓免责 0.0%、✓图宽；全库名单 49/49 达标，命令 ok。本页通过。

### 9. 打分：8.5 / 10

**P1**：无。

**P2**
1. 位置：「一个数怎样压下去」末段（非对称方案）。问题：零点 / 整数偏移只有一句抽象描述，没有公式、没有数，而「偏移」随后在第 5 节 calc 与表、第 6 节静态量化（偏移、整数偏置）、GLM 节反复出现，初学者说不出偏移怎么参与计算。改法：补 `x̂ = s × (q − z)` 和一个三四个数的小例子（如一批全为正、落在 0…25.5 的数，s=0.1、z=−128，某个数怎么变成 q 再还原），并补一句「本部署动态路径虽存了偏移，矩阵乘不用它，等于按对称算」（依据 db701c1f `w8a8_dynamic.py` 线性与 MoE `apply` 均不传 offset）。

**P3**
1. 位置：第 1 节 W8A8 段括号「每个 token 在层间传递的那一排数」。问题：token 在第 2 节才解释，先用后讲（轻微）。改法：把「token = 文本切出的一个小片段」挪到第一次出现处。
2. 位置：第 4 节粒度段「还要看算子支持哪种粒度」、第 5 节「多一个算子」「算子工作区」。问题：「算子」在基础节首次出现无解释。改法：首次出现加括号「设备上执行一种运算的程序，如矩阵乘」。
3. 位置：第 6 节表后一段。问题：「固定版本」「整数偏置」「反量化系数」对初学者是生词。改法：各加一句括号（固定版本 = 本站核对的 vllm-ascend 源码版本；反量化 = 本页说的「还原」）。
4. 位置：第 5 节代价第 2 条「缩放系数、偏移要一起存、一起读」。问题：对本部署的动态路径，偏移只占内存、不被矩阵乘读取，「一起读」略宽。改法：改为「一起存、一起加载」，或随 P2-1 的补句一并说明。
5. 位置：GLM 节之后的两个 H2。问题：标题看起来像通用节，读者可能以为通用内容排在了 GLM 之后。改法：降为 GLM 节下的 H3，或标题前加「GLM 双机：」；不改锚点时需同步 3 处外链。
6. 位置：quantization-dot 图。问题：只有 q𝑤 一行向下画了三根箭头进「qₓ × q𝑤」，qₓ 一行没有连线，看图像是乘积只来自 q𝑤；另外 𝑤 用的是数学斜体字符，渲染成「qw / sw」与 qₓ 下标风格不一。改法：箭头从两行合并处引出（或给两行加一个竖向括号再引一根箭头）；下标改成普通字符。

## 基础讲清审查后修订（09-29）

针对上一节「基础讲清审查（09-29）」的 P2 1 条、P3 6 条，全部修了。

- **P2-1 非对称量化没有公式和数**：在「一个数怎样压下去」末尾，把原来一句话展开为：为什么要零点（0 放在正中，全是正数时负的那一半格子空着，s = 0.1 只能表示到 12.7）→ 零点 z 的含义 → 公式 `q = clamp(round(x / s) + z, −128, 127)`、`x̂ = s × (q − z)` → 新 calc「非对称量化：同样 s = 0.1，13 不再被截断」（z = −128：13 → 2 → 13.0；0.26 → −125 → 0.3）→ 一句说明 GLM 动态 W8A8 实际按对称算。核对 db701c1f：`w8a8_dynamic.py` 的 `npu_dynamic_quant` 只返回量化结果和 `pertoken_scale`（激活无偏移），线性层与 MoE 的 `apply` 都不把 `weight_offset` 交给矩阵乘，偏移只在加载后整形；`w8a8_static.py` 的激活 `input_offset` 在 `apply` 里真的参与量化。
- **P3-1** token 先用后讲：token 的一句话解释和链接挪到第 1 节第一次出现处，第 2 节去掉重复解释。
- **P3-2** 算子：第一次出现（粒度段）加括号「设备上执行某一种运算的程序，比如矩阵乘」。
- **P3-3** 动态/静态一节的生词：表前加一句解释偏置与整数偏置；表里「固定版本」改为「本站核对的源码版本如此，下称固定版本」；「反量化系数」加括号说明反量化 = 本页的「还原」。整数偏置的说法对照 `w8a8_static.py`：`quant_bias` 为 int32，作为 bias 交给 `npu_quant_matmul`。
- **P3-4** 代价第 2 条「一起存、一起读」改为「跟权重一起存、一起加载」。
- **P3-5** GLM 之后的两个 H2 降为 GLM 节下的 H3，标题文字不变，锚点 `#哪些矩阵是-8-位哪些保持-bf16` 不变（浏览器里 h3 的 id 仍是这个值）。3 处外链与页内链接不用改。
- **P3-6** quantization-dot 图：左右两边都改成 2 行 × 3 列的一张表（上行 x、下行 w），三根箭头从配对表的底边引出，读作「上下两个整数相乘」；图上不再用数学斜体 𝑤，行标签改成「x 的整数 / w 的整数 / 上下相乘」，系数注释改成「x 的系数 = … / w 的系数 = …」。图高 322 → 300，文字 8 段。

### 本轮验证

- pnpm wiki:lint：通过（含跨页锚点校验），本页 0 报错。
- pnpm wiki:diagrams --check：226 张图与 spec 一致，quantization-dot 无提示。
- pnpm wiki:audit：通过；本页正文 14,623 字，写作标准全绿（行内代码 1.2/千字、calc 0.81/千字、相邻块 0、图先行、免责 0.0%、图宽）。
- 浏览器（Playwright 1440 宽）：重截 quantization-shot-2（新图）和 quantization-shot-5（非对称 calc），数字清楚、不重叠、不被裁；两个 H3 的 id 与原锚点一致。
