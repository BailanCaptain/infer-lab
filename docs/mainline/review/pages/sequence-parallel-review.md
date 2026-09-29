# sequence-parallel 审阅记录

## 基础讲清修订（09-29）

起点：09-29 基础页排查第 21 条——旧体例，H2 是陈述句，开篇直接用 TP 行切出口、All-Reduce、[T,H]、RMSNorm，没有面向初学者的入口；四步走查用的是并发页的 A.y₁/C.p₀ 标签；Ascend/GLM 段只有开关名。按「是什么 → 为什么 → 怎么做 → 代价 → Ascend 实现 → GLM → 误解 → 对照源码」整页重写，H2 全部改成问句。正文 1,783 字 → 13,451 字（wiki:lint 口径）。

### 逐节改了什么

1. **序列并行是什么？**（新）先讲 token、[T,H] 一行一个 token，再把每层的活分成「要看别的 token」和「各算各的」两类，SP 定义为把第二类沿 token 维分给几张卡；「今天 / 天气 / 很 / 好」两卡直觉例（不算数）；说明 SP 总和 TP 同组卡搭配、补的是 TP 没切到的逐 token 段；论文出处 [S1]；首次出现就解释「卡」「vllm-ascend」。
2. **为什么需要它：TP 之后每张卡都在重复同一份活？** 一段话回顾 TP 列切/行切/部分和/All-Reduce（链 TP 页演算），指出计算重复、存储重复；新图 `sequence-parallel` 对比两条流水线；两个前提（逐 token 独立、All-Reduce = RS + AG，链集合通信页）；论文动机是训练激活，不外推到推理。
3. **怎么做：一次 All-Reduce 拆成两半，中间只算自己的行？**（新演算）2 卡、4 token、H=2 的部分和表；新分镜 `sequence-parallel-steps`（RS → 本卡 RMSNorm → AG，可播放）；token 0 的 RMSNorm calc（[1,7] → 25 → 5 → [0.2,1.4]）；与只用 TP 结果逐数相同及一般结论 [D]；工作量对照 calc；「切行不切列」「哪些步骤能放进这一段（attention 不行、残差须同归属）」；放回一层里的两处 RS/AG 位置。
4. **省下了什么，又要付出什么？** 通信量 calc（N=2、M=8：RS 4 + AG 4 = All-Reduce ring 8）[D]；H=4096、BF16 的 32 KiB → 16 KiB calc（示意，保留旧页算例）；三样代价：调用次数与后端差异（稠密 1000 门槛 [C5]）、补齐（T=5/N=2 例，[C4][C6]）、评估四样分开报。
5. **vllm-ascend 里的 SP 是怎样接进去的？** FlashComm1 开关与默认值 [C12]；每步判定（MoE 无门槛、稠密 >1000、稠密草稿不走、补齐公式）[C5]；行切出口 RS/融合/W8A8 输出 BF16 [C3]；列切入口 AG [C2]；共享专家排除；残差切分 [C4]；MoE 入口 EP 组 AG 与 INT8 尺度 [C8]；三个相近开关（FlashComm1 / 上游 use_sequence_parallel_moe [C15] / 图编译 pass [C13]）。
6. **放到 GLM 双机：这套部署开了 SP 吗？** 三条路都关的证据（启动命令无 additional-config、上游 IS_DENSE 恒假 [C17]、Ascend 改 all2all 后端 [C16]）；所以各出口走 All-Reduce（链集合通信页 GLM 走读）；变体推算 [D]：R1 T=4、TP8 补齐到 8 行每卡 1 行、一半卡是空行（calc，标「按源码规则推算，未实测」），融合算子不用、词嵌入入口与 MoE 入口会变；GLM 四路残差（mHC）与 post/comb 同 token 切分 [C7]。
7. **常见误解**（新）7 条：多一次通信、attention 也切了（→ context-parallel）、另一组卡、按 H 切、显存除以 N、W8A8 减半、GLM 开了 FlashComm1。
8. **对照源码**（新，固定五个 H3）：怎么开（FlashComm1、shared_expert_dp 强制、图编译 pass 与 sp_min_token_num、PCP 调整）；会报什么错（无 raise，列 4 条日志）；开销和什么时候别开；版本差异表（v0.23 / v0.26 / main）；源码位置。

### 源码核对（本轮实读）

- db701c1f：`utils.py` enable_sp（L905-936）、`ascend_config.py` L84-137 与 L291-295、`envs.py` L75、`ascend_forward_context.py` L114-172、`linear_op.py` L458-611 与 L672-747、`register_custom_ops.py` L23-128、`prepare_finalize.py` L375-407、`glm5_next.py` L2171-2235、`compilation/passes/sequence_parallelism.py`、`platform.py` L246-257 与 L650-653。
- vllm@0fc695fc：`config/parallel.py` L625-640（use_sequence_parallel_moe）、`config/vllm.py` L96-101 与 L1170-1200（IS_DENSE 恒假、enable_sp 默认关）。
- 版本：2c59ff10（v0.23）与 2ed6cbba（v0.26）都保留 SequenceRow/ColumnParallelOp 与 1000 门槛；v0.26 的 enable_sp 不再被 shared_expert_dp 强制；main（baa023ad）FlashComm1 标 deprecated、enable_sp = use_sequence_parallel_moe、无 flash_comm_v1_enabled、maybe_pad_and_reduce 只剩 EP 通信。
- frontmatter 新增来源 12 条（C10–C21），summary 改成初学者能读的一句话，updated 改为 2026-09-29。行内标记 28 处（C 22、D 3、I 1、S 2）。

### 新增的演算和图

- 数值演算 6 处：部分和表 + 分镜（RS/RMSNorm/AG 全部数值）、token 0 RMSNorm calc、工作量对照 calc、通信量 calc、32→16 KiB calc、GLM T=4 补齐 calc。
- 图 2 张：`sequence-parallel`（重画：只用 TP 与 TP+SP 两条流水线对比，替换旧的 A.y₁ 标签图）、`sequence-parallel-steps`（新：exchanges 分镜，4 格可播放）。

### 新增图元

- exchanges 新增可选字段 `rows` 与 `rowLabels`（`scripts/wiki/figure.ts`）：把每卡的 slots 块排成 rows 行格子（一行一个 token、一列一个隐藏维），行名写在张量左侧；不给 rows 时排布与原来完全一致。多行时禁用 dots/labels、slots 须被 rows 整除、rowLabels 个数须等于 rows，违例记为问题。`scripts/wiki/figure.test.ts` 新增 1 条测试。改前已看 git diff（exchanges 的 sets/labels 是别的写手未提交的改动），在其基础上只做加法。

### 清单勾选

scratchpad `sequence-parallel-basics-facts.md`：23 条全部保留、0 条删除；A.y₁/C.p₀ 等别页标签换成 token 0–3（排查结论认定脱离上下文难懂）。

### 验证（本轮实跑）

- `pnpm wiki:lint`：通过，本页 0 报错、0 待留意。
- `pnpm wiki:diagrams --check`：236 张图与 spec 一致，本页两张图无提醒。
- `pnpm wiki:audit`：通过。
- `pnpm typecheck`、`npx vitest run scripts/wiki/figure.test.ts src/content/wiki/DiagramPlayer.test.ts`：通过（37 条）。
- 浏览器（Playwright 1440 宽，http://localhost:5193/#/wiki/sequence-parallel）：第一屏与分镜图截图 `sequence-parallel-shot-1.png` / `-2.png`（会话 scratchpad）；点「播放」「下一步」走到 4/4，数块从源卡飞到目的卡、最后一格两卡都是 [0.2,1.4]/[1.4,0.2]/[1,1]/[0.68,1.24]；5 个 calc 块渲染正常。控制台仅有 `/api/wiki/*` 502（问答后端未启动，与本页无关）。

## 基础讲清审查（09-29）

审查员独立审，只审不改。对象：`wiki/concepts/sequence-parallel.md`（行号为文件行号），以及 exchanges 图元新增的 `rows`、`rowLabels`（`scripts/wiki/figure.ts`、`scripts/wiki/figure.test.ts`）。「对照源码」一节按纪律只 grep 了五个 H3 标题（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置，齐全），正文未读。

**分数：8 / 10。页面 P1 0 条、P2 3 条、P3 5 条；代码 P1 0 条、P2 1 条、P3 3 条。结论：暂不入名单，页面 3 条 P2 和代码 1 条 P2 修完后建议入名单。**

### 页面

**学习顺序**：是什么（L42，token / [T,H] / 两类活 / 四个 token 两张卡的直觉例，不算数）→ 为什么（L57，TP 之后重复算、重复存）→ 怎么做（L79，数值演算 + 分镜）→ 代价（L135）→ vllm-ascend 实现（L166）→ GLM 双机（L180）→ 常见误解（L210）→ 对照源码（L220）。符合总原则，无 P1。

**核心机制**：对照 Korthikanti et al. 2022（arXiv 2205.05198）与 vllm-ascend@db701c1f，讲对了。SP 与 TP 用同一组卡（L55、L214）；行切出口的 All-Reduce 拆成 Reduce-Scatter + All-Gather，中间逐 token 的残差 + RMSNorm 每卡只算自己的行（L73-75、L130-133，与论文里 AG 放在列切之前、RS 放在行切之后的位置一致）；通信量与 All-Reduce 相同（L137-147）；只切行不切列（L126）；attention 进投影前要先收集（L128）。源码核对：`ascend_forward_context.py` L123-142（MoE 无门槛、稠密要超过 1000、稠密草稿不走、补齐公式、`mmrs_fusion` 在 TP ≤ 8 且非 MoE 时成立）、L164-170（DP 对齐取最大值再向上取 TP 倍数）、`linear_op.py` L550-611（开关关时仍是 All-Reduce；W8A8 融合路径 `output_dtype = bfloat16`）、`glm5_next.py` 中 mHC 的 residual / post / comb 走 `maybe_chunk_residual`、vllm@0fc695fc `config/vllm.py` L96 `IS_DENSE = False`、`config/parallel.py` L625-640、Ascend `platform.py` L650-653 改 all2all 后端，都和页面一致。本部署是否启用：`docs/mainline/03-sample-decode.md` L26-27、`02-forward.md` L318 均为 FlashComm1 关，页面写「三条路都关」，变体标 [D]「按源码规则推算，未实测」，没有虚构实测数字。

**逐节初学者检验（GLM 之前 5 个 H2，5 节通过，第 5 节有保留）**
1. 是什么：「SP 把逐 token、各算各的那几步沿 token 行分给 TP 那组卡，每卡只存、只算自己那几行。」通过。
2. 为什么：「只用 TP 时 All-Reduce 让每卡拿到同一份 [T,H]，后面的归一化每卡重复算、重复存；这几步逐 token 独立，All-Reduce 又能拆成 RS + AG，所以能只算自己的行。」通过。
3. 怎么做：「RS 只把属于自己的行加齐 → 本卡算自己的行、不通信 → AG 拼回，结果和只用 TP 逐数相同。」通过。
4. 代价：「通信量不变；省的是这一段激活和重复计算；代价是调用次数、补齐、要分开量。」通过。
5. vllm-ascend：「叫 FlashComm1，默认关；打开后行切出口换 RS、列切入口先 AG；MoE 每步都走，稠密超过 1000 token 才走。」能讲出主干；但 W8A8、INT8、EP、all2all 后端这些词讲不出来（见 P2-3）。

**6 处示意演算（逐个手算，全部正确）**
1. 部分和表（L83-88）：[1,3]+[0,4]=[1,7]、[3,1]+[4,0]=[7,1]、[2,2]+[3,3]=[5,5]、[8,15]+[9,16]=[17,31]。分镜 spec 初值、RS 的 8 条 add、keep 与表一致。
2. RMSNorm（L100-108）：token 0 为 (1+49)/2=25，√25=5，得 [0.2,1.4]；token 1 得 [1.4,0.2]；token 2 为 (25+25)/2=25，得 [1,1]；token 3 为 (289+961)/2=625，√625=25，得 [0.68,1.24]。分镜第 2 步的 sets 八个数全对。AG 之后两卡都是这 4 行，与「只用 TP 时 All-Reduce 得到 [1,7]…[17,31]，再各算 4 行」逐数相同（L112）。
3. 工作量（L116-124）：每卡 4 行 / 两卡 8 行 vs 每卡 2 行 / 两卡 4 行；激活 8 个数 vs 4 个数。对。
4. 通信量（L139-145）：RS = 1×8÷2 = 4，AG = 4，合计 8；ring All-Reduce = 2×1×8÷2 = 8。卡 0 发出的是 token 2、3 的 [2,2]、[8,15]，然后是 token 0、1 的归一化结果，都是 4 个数。对。
5. 容量（L151-156）：4096×2 B = 8,192 B = 8 KiB；4 行 32 KiB，2 行 16 KiB。对。
6. GLM 变体补齐（L196-201）：(8 − 4 mod 8) mod 8 = 4，共 8 行，每卡 1 行；`F.pad` 补在末尾，所以 rank 4–7 拿到空行，「4 张拿到空行」成立。另外 L163 的 T=5、N=2 补 1 行也对。

**分镜动图（Playwright 1440 宽，用户预览 5193，没有起停服务）**：截图在会话 scratchpad，文件是 `sp-review-compare.png`、`sp-review-1-start.png` 到 `sp-review-6-end.png`。不看文字也能看出：第 1 格要发的块描紫色粗框、落点描紫色虚框，两条反向箭头上分别停着「0 4 4 0」（卡 1→卡 0）和「2 2 8 15」（卡 0→卡 1），播放时每个数从源格沿箭头飞进目的格；第 2 格卡 0 的 token 0、1 与卡 1 的 token 2、3 变成深色的和，用过的输入变灰，本卡计算描橙框、没有箭头；第 3 格两条箭头上是归一化结果；最后一格两张卡 4 行都是 [0.2,1.4]/[1.4,0.2]/[1,1]/[0.68,1.24]，收到的两行是深色。播放计数 1/4 → 4/4 正常。控制台只有 `/api/wiki/*` 502（问答后端没起，和本页无关）。第一张对比图 `sequence-parallel` 两条流水线清楚，无重叠、无裁切。

**篇幅与重复**：正文约 1.35 万字（audit 口径 13,593）。TP 只用一段话回顾并链接 TP 页演算（L59）；集合通信只用一句「两半合起来是一次 All-Reduce」并链接（L73），没有重讲。「三条路都关」在 GLM 节、误解、对照源码三处出现，用途不同，可接受。没有明显注水。

**信息没丢**：从清单 `sequence-parallel-basics-facts.md` 抽 F6、F11、F12、F17、F19、F22，分别在 L96-110、L149-158、L163、L176、L171、L213 找到。`git diff` 删掉的行逐段都有落点；唯一的丢失是 F17 原话里「**一条** W8A8 路径」这个限定被写成了无条件（见 P2-2）。

**标准第 11–14 条**：GLM 部署数字没有进基础节（H=4096 见 P3-1）；GLM 之后只有误解和对照源码；第一节末尾没有堆链接。

**锚点**：`ascend-config-system`、`cann-hccl`、`collective-communication`、`embedding`、`mlp-residual-norm`、`pipeline-parallel`、`tensor-parallel` 7 页链到本页，都是整页链接、不带锚点；本页出站锚点由 wiki:lint 的 broken-anchor 规则检查，0 报。

**wiki:audit**：通过。本页 21 条来源行号全部有效；本页不在名单里，只统计、不报错。wiki:lint：本页 0 报。

#### P2（页面）
1. **L172 共享专家「仍按普通 TP 处理」讲错。** 位置：vllm-ascend 一节第 3 条。db701c1f 源码：`ops/linear_op.py` L751-755 里，层名含 shared_expert 且 `shared_expert_dp_enabled()` 为真时，`get_parallel_op` 直接返回 (None, 0, 1)，也就是 tp_size=1、不切；`utils.py` L935-936 在 `enable_sp()` 为真时让 `shared_expert_dp_enabled()` 恒为真；`ops/fused_moe/fused_moe.py` L610-614 与 L826-830 这时也不对共享专家输出做 TP All-Reduce。所以打开 FlashComm1 后，共享专家每卡存整份权重、只算本卡的 token 行。影响：这句结论反了，还连带让 L216 的误解条「权重……都不变」对 MoE 模型不成立（共享专家权重从 1/N 变成整份）。改法：L172 改成「共享专家不再按 TP 切：每卡存整份、只算本卡那几行 token，输出也不做 All-Reduce」；L216 补这个例外；GLM 变体（L203-206）补一条「共享专家从 TP8 切片变成每卡整份」。
2. **L176、L206 的 MoE 入口「改在 EP 组 All-Gather」缺少条件，套到 R1 上推错了。** 源码：只有 `PrepareAndFinalizeWithAllGather.prepare`（`prepare_finalize.py` L333-373）在 SP 打开时走 `_prepare_with_ep_group`。A2 上 `_select_a2_moe_comm_method`（`ascend_forward_context.py` L240-252）在每卡专家数 ≤ 24、EP ≥ 16、token 数不超过 MC2 容量时选 MC2。GLM 是 288÷16 = 18、EP16，R1 这种小批走 MC2（cann-hccl 页也这样写）。MC2 / All2All 的 prepare 在 shared_expert_dp 为真时跳过按 TP 切 token（L150-168），不做 EP 收集。旧页原话是「一条 W8A8 路径」，改写后丢了这个限定。改法：L176 加上「MoE 通信方式是 AllGather 时（A2 上 token 超过 MC2 容量等情况）」；L206 改成「R1 这样的小批走 MC2，入口不做 EP 收集，本卡 token 行直接派发；大批改走 AllGather 时，才在 EP 组里收集 INT8 激活和尺度」。
3. **前置概念用了但没讲。** W8A8（L171 首次出现）、INT8（L176）、EP（L176，只给了中文名）、DP（L163，只给了中文名）、KV cache（L158）、all2all 后端（L178、L188）首次出现时，既没有一句话解释，也没有链接；全页没有链 quantization / expert-parallel / data-parallel / kv-cache。违反标准第 2 条。这些词都在实现和代价节，不影响 SP 主线，所以记 P2。改法：每个词首次出现时补半句解释，再加链接。

#### P3（页面）
1. L149-156 的 H=4096 正好是 GLM-5.3-Flash 的 hidden_size（`glm-5-3-flash.md` L254）。基础节标了「常见尺寸（示意）」，但用的就是 GLM 的数。建议在 GLM 一节点明「GLM 的 H 就是 4096，这笔账就是 GLM 单路 [T,H] 的量，四路残差要乘 4」，或者基础节换一个非 GLM 的数。
2. L55「SP 不单独使用」在 Megatron 的语境里成立，但「sequence parallelism」这个名字在别的工作里（如 DeepSpeed-Ulysses）指按序列切 attention，更接近本站的 CP。建议误解一节加一句「同名不同物」。
3. 对比图 `sequence-parallel` 上没有数，只画结构。数在下一张分镜里，可以接受；可选：在格子行左边写 token 0–3，和分镜呼应。
4. 分镜 AG 那一步刚起飞时，源端几块会短暂叠在一起（`sp-review-5-ag-flying.png` 里 0.68 / 1.24 的边框压在一起），落地后正常。路上的块排成一条 4 个数，看不出是两行，要靠源格的紫框来对应。
5. L178「三个名字相近的开关」对初学者偏密，可以把一半挪到「对照源码·怎么开」。

### 代码（exchanges 的 rows / rowLabels）

- **两位写手的改动没有互相覆盖**：EP 的 `sets`、`labels` 和 SP 的 `rows`、`rowLabels` 在 schema、exchangeStates / 校验、paint、figureWords 里都在。测试：sets 2 条、labels 1 条、rows 1 条，都通过。审查期间 figure.ts 又被别的写手改了一次（04:39，新增 experts / note），改后重跑：vitest 37 条通过，`wiki:diagrams --check` 238 张一致，typecheck 通过。
- **不给 rows 时排布不变**：CC 的 10 张分镜 SVG 在 03:07 生成，早于 EP 和 SP 的改动，在当前渲染器下 `--check` 仍一致，说明不给 rows 时坐标没变；EP 的 `expert-parallel-flow.svg`（04:04）也一致。
- **回归（浏览器）**：`#/wiki/collective-communication` 第一个播放器点「播放」，块在两卡之间飞、圆点正常，1/2 → 2/2（`sp-review-regress-cc.png`）；`#/wiki/expert-parallel` 的 `expert-parallel-flow` 点「播放」，块飞向专家卡、token 标签正常，逐秒计数 1/4 → 4/4（`sp-review-regress-ep.png`）。
- **命令结果**：`npx vitest run scripts/wiki/figure.test.ts src/content/wiki/DiagramPlayer.test.ts` 2 个文件 37 条通过；`pnpm typecheck` 退出 0；`pnpm wiki:diagrams --check` 全部一致（先 236 张，重跑时 238 张），`sequence-parallel`、CC、EP 相关图都没有提醒；`pnpm lint` 退出 1（见 P2-1）。本仓的 lint 是 biome（`biome check .`），仓里没有装 eslint。

#### P2（代码）
1. **`pnpm lint` 失败，唯一的 error 出在本写手新增的测试夹具里。** `scripts/wiki/figure.test.ts` L717（SP_TWO 的 `keep: [[0, 0], [0, 1], [1, 2], [1, 3]]`）不符合 biome 格式，全仓只有这 1 个 error，其余 14 条 warning 都是 wiki.css 里原有的 noDescendingSpecificity。写手的验证清单里没有跑 lint。改法：`npx biome format --write scripts/wiki/figure.test.ts`，或者手动把这一行拆成多行，再跑 `pnpm lint`。

#### P3（代码）
1. rows 的测试只断言「不给 rows 时没有横向格子线」，没有锁住坐标；「排布完全一致」目前只靠 CC 的 SVG 间接保证。建议给 EP_TWO 加一条关键坐标断言（卡框宽高、第 0 块中心）。
2. `slots` 上限是 8，rows 模式最多画 4 token × 2 维。以后想画 4×4 要先放宽 slots 上限（只做加法）。
3. 多行模式下，路上的块仍排成一条，看不出行结构（同页面 P3-4）。可选：按行分成几小条。

### 跳过的内容
「对照源码」正文（按纪律只 grep 了 H3）、frontmatter 来源区、HANDBOOK、docs/plans。没有被拦。

## 基础讲清审查后修订（09-29）

### 页面 P2（3 条，全修）

1. **共享专家讲反了**：先复核源码。db701c1f `linear_op.py` L751-756：层名含 shared_expert 且 `shared_expert_dp_enabled()` 为真时，`get_parallel_op` 返回 (None, 0, 1)；`utils.py` L935-936：`enable_sp()` 为真时它恒为真；`fused_moe.py` L605-614：这时不对共享专家输出做 TP All-Reduce。改法：vllm-ascend 一节第 3 条后单独成段，写明「SP 打开后共享专家不再按 TP 切，每卡整份权重、只算本卡 token 行、输出不做 All-Reduce」[C22]；误解「显存除以 N」补上这个例外；GLM 变体补一条「共享专家从 TP8 切片变成每卡整份，TP 页显存账那一项要重算」。
2. **MoE 入口缺条件**：复核 `ascend_forward_context.py` L240-252（A2 上每卡专家 ≤ 24、EP ≥ 16、token 数不超过 MC2 容量时选 MC2）与 `prepare_finalize.py` L333-373（只有 AllGather 的 prepare 在 SP 下走 `_prepare_with_ep_group`）、L150-169（MC2/All2All 的 prepare 在 shared_expert_dp 为真时跳过按 TP 切 token）。改法：「MoE 层怎么接」先讲 EP 和两种搬法（MC2 / AllGather，链 EP 页），再分「走 AllGather 时」「走 MC2 时」两条 [C24][C8]；GLM 变体改成「R1 这样的小批走 MC2（每卡 18 个专家、EP16），入口不做 EP 收集；大批改走 AllGather 时才收集 INT8 激活和尺度」；误解「W8A8 减半」同步加上「只在走 AllGather 时」。
3. **前置概念**：首次出现处补半句解释并加链接——BF16（16 位浮点、2 字节）、KV cache（链 kv-cache）、DP（链 data-parallel）、W8A8（链 quantization）、EP（链 expert-parallel）、INT8（8 位整数、1 字节）、MC2、all2all 后端（在 GLM 一节第一次出现处解释）。

### 代码 P2（1 条，已修）

- `pnpm lint`（biome）的格式错误：只对 `scripts/wiki/figure.test.ts` 跑了 `npx biome format --write`（Fixed 1 file），之后 `npx biome check scripts/wiki/figure.test.ts` 0 诊断。

### P3（页面 5 条修 4 条，代码 3 条修 3 条）

- 页面 P3-1：GLM 四路残差段补「GLM hidden 正好 4096，代价一节 BF16 一行 8 KiB 就是 GLM 单路 [T,H] 的一行，四路残差是它的 4 倍」，链 glm-5-3-flash。
- 页面 P3-2：误解加一条「同名不同物」：DeepSpeed-Ulysses 等工作的 sequence parallelism 连 attention 一起按序列切，更接近上下文并行。
- 页面 P3-3：对比图不加行名（入箭头正好落在行名位置），改为两条短注「两张卡都有 token 0–3，一模一样」「卡 0 留 token 0、1，卡 1 留 2、3」。
- 页面 P3-4：路上的块现在按源卡的行分组、组间留 8px 缝（「0 4 │ 4 0」看得出是两行）。**未修**的一半：起飞瞬间几块同时向箭头起点汇合会短暂重叠，这是播放器沿 [源块 → 箭头起点 → 箭头终点 → 目的块] 路线的共同行为，改它会动 CC/EP 的动图，本轮不动。
- 页面 P3-5：「三个名字相近的开关」缩成一段「名字相近的另外两条路」，属性条件和图改写的细节挪到「对照源码·怎么开」（新增 `use_sequence_parallel_moe` 一条）。
- 代码 P3-1：新增测试锁住不给 rows 时 EP_TWO 的卡框（10,46,136×96 与 296,46）和第 0 块（26,78,52×34）坐标。
- 代码 P3-2：`slots` 上限放宽到 16（只在 rows 多行时可用）；一排超过 8 块记为问题「一排最多 8 块」，原有图不受影响。
- 代码 P3-3：同页面 P3-4，rows 多行时路上的块按行分组；一排时不留缝（有测试断言）。

改 figure.ts 前先看了最新状态（EP 写手 04:40 新增 experts / note / computeMovers），只在 exchanges 的 slots 上限、问题检查、路上块的排布三处做加法，没有动 EP 的代码。frontmatter 新增来源 4 条（C22–C25），行内标记 29 处（C 23、D 3、I 1、S 2）。

### 验证（本轮实跑）

- `npx vitest run scripts/wiki/figure.test.ts src/content/wiki/DiagramPlayer.test.ts`：2 个文件 43 条通过（新增 2 条）。
- `pnpm typecheck`：退出 0。
- `pnpm lint`（biome）：仍退出 1，7 个 error 全部不在本页改动里——`scripts/_tmp-ep-dbg.mjs`、`_tmp-ep-render.ts`、`_tmp-ep-stale.ts` 各 2 个（organizeImports + format），以及 `figure.ts` L1765 EP 写手 `computeMovers` 里的 `route` 数组换行；按「不动别人文件」没有格式化它们。本人改的 `figure.test.ts` 0 诊断，`figure.ts` 里本人新增的代码 biome format 无差异。
- `pnpm wiki:lint`：本页 0 报错（全仓退出 1 来自 vllm-engine-core，别的写手正在改）。
- `pnpm wiki:audit`：本页 25 条来源全部 ✓，0 报错（全仓唯一失败同样是 vllm-engine-core）。
- `pnpm wiki:diagrams --check`：241 张图与 spec 一致，本页两张图无提醒。
- 浏览器（Playwright 1440，5193）：重截 `sequence-parallel-shot-1.png`、`-2.png`；分镜第 1 格路上的块显示为「0 4 │ 4 0」「2 2 │ 8 15」，点「播放」块照常从源格飞向目的格，计数 1/4 → 2/4 正常。

### 入名单后补修（09-29）：prose-marks

- `pnpm wiki:audit` 报本页 `[prose-marks]`：「## 对照源码」之前有 20 个证据角标。正文里的 20 个全部去掉（S1×2、D×3、I×1、C×14），去掉后留下的多余空格一并清掉。出处挪到「对照源码·源码位置」：逐项补了 C2–C8、C12、C16、C17、C22，并新增「正文里几条不是直接读源码得到的结论」一小段，放 [S1]（论文动机）、[D]（结果逐数相同、通信量不变、GLM 变体推算、三条路都关的合并结论）和 [I]（推理里训练收益打折扣）。现在全页 26 个角标都在对照源码里（C 20、D 4、I 1、S 1），frontmatter sources 不变。
- 复跑：`pnpm wiki:audit` 显示名单 51 页、达标 51 页，全库 0 失败；`pnpm wiki:lint` 通过，本页 0 报错；`pnpm wiki:diagrams --check` 241 张一致。
