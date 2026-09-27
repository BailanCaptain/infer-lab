# 审查：wiki/concepts/expert-parallel.md（深入页试点）

- 审查对象：`wiki/concepts/expert-parallel.md`（389 行，工作区已改未提交，`git status` 显示 ` M`），写手 GPT-6 Astra，2026-09-27
- 对照底稿：`docs/mainline/02-forward.md`（§6.5、§6.9、§7.5、§8.5、§8.6、§12），按纪律只 grep 命中后读片段
- 对照页面：`wiki/concepts/one-request.md`（第 4 站 MoE 小节）、`concurrent-requests.md`（第 4 站、陪跑小节）、`glm-5-3-flash-two-node.md`、`tensor-parallel.md`
- 源码：`git -C tools/repos/vllm show 0fc695fc:<path>`、`git -C tools/repos/vllm-ascend show db701c1f:<path>`，三版分别用 `2c59ff10` / `2ed6cbba`+`568afb3a` / `baa023ad`+`84030bbe`；每次只读一个函数
- 实际运行：`npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 22 处待留意）`，22 条全在别的页，本页 0 条；`npx tsx scripts/wiki-diagrams.ts --check` → `ok wiki:diagrams 152 张图与 spec 一致`，本页 4 张图 0 告警；写手留下的 `check-content.log`（`ok 内容校验 registry 131 页`）、`wiki-audit.log`（`ok wiki:audit 本地引用与行号校验通过`，0 行号越界）
- 浏览器：没有自己起服务，使用写手留下的证据 `scratchpad/p4/expert-parallel/`：`browser-check.json`（1440 宽、页高 15596、`overflows: []`、`errors: []`、10 个跨页锚点全部 `exists: true`）、`figure-1..4.png`、`screen-01..16.png` 全部看过
- 本轮没有文件被安全分类器拦截；最后一次读源码的批量命令被中断一次，改为只读单个函数后结论不受影响

## 一、10 项评分

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 开头能否让初学者明白 EP 是什么、在我们的部署里起什么作用 | 2 | 第 61 行第一句就是定义（"把不同专家的完整权重放到不同卡上，把需要它们的 token 发过去计算，再收回结果"），紧接着落到本部署：EP16、每卡 18 个；63 行补 MoE / expert / token / router / hidden 的中文解释；67 行"为什么 MoE 特别需要 EP"用 17.72 GiB 说清了动机（省的是算力，权重仍要常驻）。扣分点只在 69 行一次性砸出 TP8/DP2/EP16/W8A8/BF16/FP32/两个 commit，见 P3-9。 |
| 2 | 是否写清挂在主线哪一站并链到主线页小节 | 2 | 65 行："请求在[一条请求的第 4 站](one-request.md#42-层-moe每卡-18-个专家)，做完本层 attention 后，进入这里"，同段接上场景 M 的链接；全页 10 个跨页锚点经 `browser-check.json` 验证全部存在。第 4 站、场景 M、两组补齐、陪跑、部署页权重表五处都指回了主线。 |
| 3 | 数字能否复核 | 2 | 逐个重算，全部对得上，且与底稿 02 修订后的口径一致，没有漂移。明细见第三节。 |
| 4 | 机制对不对 | 2 | router top-8 + 共享专家、dispatch→专家计算→combine、A2 上 MC2/AllGather 二选一及三条件、共享专家按 TP8 切、DP 陪跑、EPLB 未开，六项逐条对源码核过，没有发现机制错误。明细见第四节。两处措辞不够准确记为 P3-1、P3-2。 |
| 5 | 图 | 1 | 4 张图都在讲机制、没有假数据，排版也没问题（`overflows: []`）。但：①本页最核心的对比（55.1 MiB vs 6.09 GiB、113 倍）没有图，而姊妹页 concurrent-requests 恰恰有同比例条形图；②`expert-parallel`、`expert-parallel-split`、`expert-parallel-fit` 三张都是同构的单列框-箭头流程图，连看三张信息形态没有变化；③`expert-parallel-assign` 只画了两条通用箭头，正文反复强调的"同一张卡既是源卡又是目的卡"图上看不出来。见 P2-5。 |
| 6 | 单一出处 | 1 | 做对的部分：MC2 门槛 128 只写结论并指回 one-request（174 行）、两层补齐与 64 行指回 concurrent-requests（188、209 行）、陪跑指回 concurrent-requests（261 行）、整卡权重表指回部署页（89 行），都没有重新推导。扣分在与 `tensor-parallel.md` 的共享专家一段实打实重复（P2-2），以及 87 行刚说"完整推导统一在部署页"又自己把 432 MiB / 17.72 GiB / 三种占比推了一遍（P3-6）。 |
| 7 | `## 对照源码` 抽查与版本差异 | 2 | 抽查 20 处（含全部 15 个 `[C]` 角标的指向），全部命中，无一处错位；三版 EP 结论逐条核实通过。明细见第五节。只有"main 的容量函数重构"这一句没有逐行核（列入未核）。 |
| 8 | 术语 | 1 | 抽 15 个看下来，首次出现给中文解释的比例很高，大小写与代码名写法也合规（明细见第六节）。扣分有三处：`图尺寸`/`图模式` 用中文自造名，没给 graph mode / capture size 的英文原名，和 concurrent-requests 的写法不一致（P2-4）；MC2、AllGather 在 107 行先用、113/172 行才解释（P3-7）；MTP 只给了中文功能解释，没写出 Multi-Token Prediction（P3-10）。 |
| 9 | 免责句占比 < 3%、无玩具规模、无"完整模型副本" | 1 | 玩具规模彻底清干净：全页没有"四个专家、每 token 选两个"这类示意，所有维度都是 GLM 真值；"完整模型副本"类说法 0 处（267 行那句是在否定这个想法）。扣分在免责句：按前几轮审查同一关键词集（不能/不等于/尚未/并非/不代表）统计 **9 / 225 = 4.00%**，只统计「待核」也有 **7 / 207 = 3.38%**，两种口径都超过 3%。见 P2-1。 |
| 10 | 结构约束 | 2 | `## 对照源码` 在 310 行，其后没有 H2；下面只有固定 5 个 H3，顺序正确（怎么开 312 → 会报什么错 328 → 开销和什么时候别开 343 → 版本差异 349 → 源码位置 373）。角标 21 处 ≤ 30；`[C]` 15 / 21 = **71.4%** < 80%（另有 `[D]` 4、`[S]` 2）。`wiki:lint` 对本页零告警。 |
| | **总分** | **16 / 20** | |

## 二、结构与约束检查

| 约束 | 结果 |
|---|---|
| `## 对照源码` 之后没有 H2 | 通过（最后一个 H2 在 310 行） |
| 只用固定 5 个 H3 且按序 | 通过（312 / 328 / 343 / 349 / 373） |
| 角标 ≤ 30 处 | 通过（21 处） |
| `[C]` 占比 < 80% | 通过（71.4%） |
| 免责句 < 3% | **不通过**（4.00% / 3.38%，见 P2-1） |
| 玩具规模数字 | 通过（0 处） |
| "完整模型副本"类说法 | 通过（0 处） |
| 跨页链接目标存在 | 通过（10 个锚点全部 `exists: true`） |
| lint / diagrams / audit / check:content | 全部通过，本页 0 告警 |

角标全部落在 `## 对照源码` 之前（15 处）与"版本差异"节内（6 处）。注意这与 `glm-5-3-flash-review` 当时记的"`## 对照源码` 以上 0 处角标"是**相反**的做法；两种写法在 lint 下都合法，定标准时需要拍板取哪一种（见开放问题）。

## 三、数字复核明细（全部通过）

| 页面里的数 | 位置 | 复算 | 结论 |
|---|---|---|---|
| 每卡 18 个专家 | 61、75 | 288 ÷ 16 = 18；`n_local_physical_experts = n_physical_experts // ep_size`、`physical_expert_start = ep_rank × n_local`（`va@db701c1f:models/glm5_next.py` 的 `AscendGlm5NextMoE.__init__`） | 对 |
| 每卡每层 432 MiB | 87 | `w13 [18,4096,4096] int8` = 301,989,888 B = 288 MiB；`w2 [18,4096,2048] int8` = 150,994,944 B = 144 MiB；合 432 MiB。形状与 `AscendW8A8DynamicFusedMoEMethod.get_weight` 的 `[E, 2I, H]` / `[E, H, I]` 一致 | 对 |
| 主干 17.72 GiB | 67、87 | 432 × 42 = 18,144 MiB = 17.71875 GiB；与底稿 02:123、02:625 一致 | 对 |
| 占比 88.3 / 86.1 / 88.1% | 91–97 | 18,144 ÷ 20,537 = 88.35%；18,144 ÷ 21,078 = 86.08%；(18,144+432) ÷ 21,078 = 88.13%；分母引自部署页 163/165 行 | 对 |
| 共享专家每层 3 MiB | 105 | (512×4096 + 4096×256) × 1 B = 3,145,728 B = 3 MiB | 对 |
| MC2 每对 4,100 / 8,192 B | 215–216 | 4096×1 B + 4 B；4096×2 B。与底稿 02:691-692 同口径 | 对 |
| 纯 decode 每层 1,376,512 B | 217–221 | 8×8×4,100 = 262,400；8×8×8,192 = 524,288；8×4096×2 = 65,536；64×4096×2 = 524,288；合 1,376,512 | 对 |
| **≤55.1 MiB** | 222 | 42 × 1,376,512 = 57,813,504 B ÷ 1024² = 55.13 MiB。底稿 02:904 已按同一修订改过（41.4 → 55.1），**两处不再漂移** | 对 |
| 跨 EP16 ≤31.5 MiB | 249 | 42 × 786,688 = 33,040,896 B ÷ 1024² = 31.51 MiB | 对 |
| AllGather 每层 155,602,944 B | 233–237 | 6048×4096×2 = 49,545,216（47.25 MiB）；6048×288×4 = 6,967,296（6.645 MiB）；3×49,545,216 + 6,967,296 = 155,602,944 | 对 |
| **6.09 GiB** | 238 | 42 × 155,602,944 = 6,535,323,648 B ÷ 1024³ = 6.087 GiB；与底稿 02:891 的 148.4 MiB/层同源 | 对 |
| **约 113 倍** | 239、253 | 155,602,944 ÷ 1,376,512 = 113.04；底稿 02:916 同值 | 对 |
| DP 交换 4.15 GiB | 250 | 42 × 106,057,728 = 4,454,424,576 B ÷ 1024³ = 4.148 GiB | 对 |
| 94.5 MiB/卡/层 | 255 | 12096×4096×2 = 99,090,432 B ÷ 1024² = 94.5 MiB | 对 |
| R1 每层 32,800 / 65,536 / 8,192 / 32,768 B | 168 | 1×8×4,100；1×8×8,192；1×4096×2；4×4096×2。与 one-request:385-389 一致 | 对 |
| 608 / 38 / 96,768 / 336 / 6,048 | 277–281 | 76×8=608；608÷16=38；12,096×8=96,768；96,768÷288=336；336×18=6,048 | 对 |
| 48 / 28 / 64 / 6048 | 209、229 | 12 条 × 4 行 = 48；7 条 × 4 行 = 28；图尺寸补齐后两组同为 64；场景 M 两组最大值 6048、全局 12096 | 对，与 concurrent-requests 一致 |
| EP8 每卡 36 个专家 | 182 | 288 ÷ 8 = 36 > 24，且 EP 规模 8 < 16，两条件都不满足 | 对 |
| MC2 容量 128 | 174 | `min(ceil(128/8), 512) × 8 = 128`，128 来自教程 `cudagraph_capture_sizes` 的最大值；本页只写结论并指回 one-request，未重复推导 | 对 |

## 四、机制复核明细（全部通过）

1. **router 选 top-8 加共享专家**：`glm5_next.py` 的 `AscendGlm5NextMoE` 里 `gate` 用 `params_dtype=torch.float32`、`out_dtype=torch.float32`，带 `e_score_correction_bias`；`experts_selector.py#L292-L309` 的 `moe_gating_top_k` 用 `norm_type=1`（sigmoid）、`routed_scaling_factor`、`bias_opt`。页面 121–123 行的描述与之相符。
2. **dispatch → 专家计算 → combine**：MC2 侧 `token_dispatcher.py` 的 `TokenDispatcherWithMC2` 优先 `npu_moe_distribute_dispatch_v2`、无 v2 时回落旧接口，`assert expert_map is not None, "expert_map is required for MC2 token dispatch."`；专家侧 `moe_mlp.py#L133-L215` 是 grouped matmul + swiglu + 量化；combine 走 `npu_moe_distribute_combine_v2`。页面 125–150 行相符。
3. **A2 上只在 MC2 与 AllGather 之间二选一、条件 EP≥16 且 token≤容量**：`ascend_forward_context.py` 的 `_select_a2_moe_comm_method` 原文是 `if num_experts_per_device <= 24 and ep_world_size >= 16 and num_tokens <= mc2_tokens_capacity: return MoECommType.MC2`，否则 `ALLGATHER`；容量由 `set_mc2_tokens_capacity` 用 `min(ceil(max_num_tokens/tp), 512) × tp` 算出。页面 174 行的三条件与"每步现选"都对。
4. **共享专家按 TP8 切**：`AscendGlm5NextMLP` 用 `MergedColumnParallelLinear` + `RowParallelLinear`，`disable_tp=is_sequence_parallel`，而 `is_sequence_parallel = parallel_config.use_sequence_parallel_moe`；`platform.py#L650-L653` 的注释原文是"this is a tricky way to disable `use_sequence_parallel_moe` in vllm"，未开 SP 时走该分支。所以 `disable_tp=False`、共享 MLP 保留 TP 切分，页面 101–107 行成立。归约时点：`fused_moe_0_23_0.py` 的 `_forward_shared_experts` 只在 `moe_comm_type ∈ {ALLTOALL, MC2, FUSED_MC2}` 时对共享输出做 `tensor_model_parallel_all_reduce`；`register_custom_ops.py#L159-L167` 的 `_maybe_all_reduce_tensor_model_parallel_impl` 正好相反（这两种情况直接返回）。页面 107、150、199 行的"两条路归约安排不同"完全对得上。
5. **DP 组陪跑**：本页只给结论并指回 `concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m`，该节确实有空批次 4 行 → 64 / 6048 的推导；本页 261–267 行三条含义（空闲组仍算真实专家工作、两组共用通信选择、形成共同等待点）与 AllGather 的 `_prepare_with_dp_group` / `_finalize_with_dp_group` 行为一致。
6. **EPLB 未开**：上游 `enable_eplb: bool = False`、`num_redundant_experts: int = 0`、`expert_placement_strategy = "linear"`；昇腾侧默认 `dynamic_eplb: False`、`expert_map_path: None`；官方双机教程的启动命令只有 `--enable-expert-parallel`，没有 `--enable-eplb`，导出的环境变量里也没有 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD`；`enable_force_load_balance = _EXTRA_CTX.in_profile_run`（`fused_moe_0_23_0.py:435`）。两行启动日志 `Dynamic EPLB is %s` / `The number of redundant experts is %s` 在 `ascend_config.py:874-875`，落在页面引的 `#L817-L875` 内。页面 286–298 行的表逐格成立。

另外核过的两点：MC2 用的是独立的 `mc2` 通信组，其 `group_ranks` 与 EP 组同样由 `all_ranks.transpose(1,2).reshape(-1, dp×pcp×tp)` 得到（16 张卡），页面说"EP16 通信域"没有夸大；AllGather 的 DP 路径 `_prepare_with_dp_group` 返回 `pertoken_scale=None`，即跨机搬的确实是 BF16 未量化 hidden，与页面 194、253 行一致。

## 五、`## 对照源码` 抽查（20 处，全部命中）

角标指向（`[Cn]` 的 n 指 frontmatter `sources` 第 n 条，逐条核对）：

| 角标 | 行 | 指向的来源 | 核对结果 |
|---|---|---|---|
| C3 | 316 | `vllm@0fc695fc:.../fused_moe/config.py#L1074-L1209` | 命中 `flatten_tp_across_dp_and_pcp` 与 `FusedMoEParallelConfig.make`，`use_ep` 与 `tp_size`/`ep_size` 的设定都在范围内 |
| C4 | 75 | `va@db701c1f:models/glm5_next.py#L1403-L1539` | 命中 `n_local_physical_experts` / `physical_expert_start` / `physical_expert_end` |
| C7 | 174 | `va@db701c1f:ascend_forward_context.py#L164-L252` | 命中 `padded_num_tokens`、`mc2_mask`、`set_mc2_tokens_capacity`、`_select_a2_moe_comm_method` |
| C8 | 121 | `va@db701c1f:.../prepare_finalize.py#L193-L314` | 命中 `PrepareAndFinalizeWithMC2.prepare` 的补齐 + `tensor_split` 取本 rank 片 + mask 对齐 |
| C9 | 194 | 同文件 `#L440-L560` | 命中 `_prepare_with_dp_group` 的 `dp_group.all_gather(hidden_states)` 与 `all_gather(router_logits)` |
| C10 | 129 | `va@db701c1f:.../token_dispatcher.py#L102-L339` | 命中 `enable_dispatch_v2` 判断与 `npu_moe_distribute_dispatch_v2` 调用 |
| C11 | 195 | 同文件 `#L342-L438` | 命中 `TokenDispatcherWithAllGather` 的 `active_expert_range` 与 `npu_moe_init_routing` 量化 |
| C14 | 150 | `va@db701c1f:.../fused_moe_0_23_0.py#L559-L719` | 命中 `_forward_shared_experts` 的归约条件与 `shared_forward_impl` 的先路由后共享次序 |
| C16 | 107 | `va@db701c1f:platform.py#L650-L653` | 命中关闭 `use_sequence_parallel_moe` 的那段 |
| C18 | 298 | `va@db701c1f:ascend_config.py#L817-L875` | 命中 `dynamic_eplb` / `expert_map_path` 默认值、`The expert_map is not json.` / `not exist` 两个报错、两行启动日志 |
| C20 | 371 | `va@2c59ff10:ascend_forward_context.py#L202-L252` | 命中 v0.23 的容量函数与 `_select_a2_moe_comm_method`；全文件 grep `lora` 无命中，"没有优先覆盖分支"成立 |
| C21 | 371 | `va@2ed6cbba:ascend_forward_context.py#L324-L342` | 命中 v0.26 的 `if num_experts > 512: return ALLGATHER` 与主判据 |
| C22 | 371 | `va@2ed6cbba:ascend_forward_context.py#L482-L497` | 命中 LoRA + EP 强制 `ALLTOALL` 的优先分支 |
| C23 | 371 | `va@baa023ad:ascend_forward_context.py#L296-L315` | 命中 `_select_capacity_and_expert_density_moe_comm_method`，确实**没有** >512 那条 |
| C24 | 371 | `va@baa023ad:ascend_forward_context.py#L373-L425` | 命中 `moe_comm_policy` 查表 + LoRA 优先分支 |

"源码位置"表另抽 5 处：`w8a8_dynamic.py#L188-L289`（权重形状与 `Number of global experts mismatch` 报错原文）、`moe_mlp.py#L133-L215`（grouped matmul + swiglu）、`register_custom_ops.py#L159-L167`（`_maybe_all_reduce_tensor_model_parallel_impl`）、`fused_moe.py#L290-L294`（`vllm_version_is("0.23.0")` 时导入旧接口）、`moe_runner.py#L650-L680`（共享输出与路由输出相加后再归约），全部命中。`moe_comm_method.py#L122-L221` 核到 `assert moe_comm_method is not None, "Missing communication context"`（L137）。

**版本差异逐条核实**：三版 `enable_expert_parallel` 默认都是 `False`、`enable_eplb` 默认 `False`、`expert_placement_strategy` 默认 `linear`（`vllm@0fc695fc:L154-178`、`@568afb3a:L163-187`、`@84030bbe:L167-198`）→ "三版都支持 EP、默认关"成立；A2 选择：v0.23 与 v0.26 主判据相同、v0.26 多 >512 一条、main 改为硬件策略表 `CAPACITY_AND_EXPERT_DENSITY`（`baa023ad:device/hardware_profile.py#L256-L269` 命中）且无 >512 条 → "v0.26 与 main 在通信方式选择上有差异"成立；LoRA 分支 v0.23 无、v0.26/main 有 → 成立；GLM 专用实现：`2c59ff10`、`2ed6cbba` 的 `vllm_ascend/models/` 下无 glm5 文件，`baa023ad` 有 `models/glm5next/` → 成立。

## 六、术语抽查（15 个）

| 术语 | 首次出现 | 写法与解释 |
|---|---|---|
| expert parallel | 61 | `expert parallel（EP，专家并行）`，句中小写 ✓ |
| MoE / expert | 63 | `**MoE**（mixture of experts）是一种前馈层……叫 expert` ✓ |
| token | 63 | "（分词后的一个位置）" ✓ |
| router | 63 | "选谁由 router 决定，它给 token 对每个专家打分" ✓，小写 ✓ |
| hidden | 63 | "（隐藏向量）" ✓ |
| attention | 65 | "（汇集历史信息的计算）" ✓ |
| rank | 73 | "是卡在通信组内的编号" ✓，小写 ✓ |
| dispatch / combine | 81 | "把 hidden 交给选中专家所在的卡" / "按 token 原位置收回结果并加权" ✓ |
| mask | 121 | "是标明有效行的布尔数组" ✓ |
| grouped matmul | 135 | "把多个专家的矩阵乘组织成分组计算" ✓，小写 ✓ |
| All-Gather / All-Reduce / Reduce-Scatter | 105、150、197 | 写法合规 ✓，首次出现都给了一句作用说明 ✓ |
| MC2 / AllGather（路径名） | 107 先用、113/172 才解释 | 机制名按原样 ✓，但先用后解释（P3-7） |
| trace | 144 | "是逐算子、逐次通信的运行记录" ✓ |
| EPLB | 288 | `**EPLB**（expert parallel load balancing）` ✓ |
| 图尺寸 / 图模式 | 174 | **只有中文自造名**，没给 graph mode / capture size（P2-4） |

类名、函数名与配置键（`FusedMoEParallelConfig.tp_size`、`PrepareAndFinalizeWithAllGather`、`mc2_mask`、`active_expert_range`、`enable_prefill_mc2`、`npu_moe_distribute_dispatch_v2`）都按源码写法放在行内代码里 ✓。

## 七、问题清单

| 级别 | 位置 | 问题 | 证据 | 建议改法 |
|---|---|---|---|---|
| P2-1 | expert-parallel.md:203,225,253,284,298,306,326,347,369 | 免责/限定句超标 | 按前几轮同一关键词集统计 9 / 225 = **4.00%**；只统计「待核」也有 7 / 207 = 3.38%，两种口径都 > 3% | 合并同类：203 的"每步不等于每个生成 token"并进 MTP 那一句；284 与 306 讲的是同一件事（专家数均分 ≠ 负载均分），留一处；326、347、369 各留一句，其余删掉或改写成正面结论 |
| P2-2 | expert-parallel.md:101-107 ↔ tensor-parallel.md:229-239,255 | 与 tensor-parallel 重复推导共享专家 | 两页都给 `gate_up [512,4096]` / `down [4096,256]` / 每层 3 MiB，并且都解释 MC2 与 AllGather 下共享输出的归约位置差异 | 单一出处二选一：形状与 3 MiB 归 tensor-parallel（TP 那一刀），本页只留"共享专家按 TP8 切（见 tensor-parallel#共享专家走 TP8）"+ 本页独有的归约时点对比；或反向，但两页必须同时改 |
| P2-3 | expert-parallel.md:71-83、304 | 丢了旧版讲得最好的一段：为什么 MoE 用 EP 而不是把每个专家按 TP 切 | 旧版 `git show HEAD:wiki/concepts/expert-parallel.md:100-112` 用"矩阵越切越窄、归约量不随切份变少"正面回答过；新版只在常见误解第 3 条一句带过 | 在"16 张卡上分别放哪些专家"后补一小段，用 GLM 真值：专家中间维 2048，EP16 下每个专家仍是整块 2048；若改按 16 卡切专家矩阵，每卡只剩 128 列，而归约量不变 |
| P2-4 | expert-parallel.md:174,180 | `图尺寸` / `图模式` 只有中文自造名 | 术语规则要求有固定英文名的术语用英文原名；concurrent-requests.md:250 写的是 graph mode（图模式） | 首次出现改为 graph mode（图模式）与 capture size（图尺寸，预先捕获的执行 token 宽度） |
| P2-5 | expert-parallel.md:77,115,176,190 四张图 | 图的形态单一，且最核心的对比没有图 | 3 张是同构单列流程框图；55.1 MiB ↔ 6.09 GiB（113 倍）只有表和 calc；`expert-parallel-assign` 图上看不出"同一张卡既发又收" | 加一张同比例条形图对比两条路径的每层载荷（可参照 concurrent-requests 的同类图）；在 assign 图里给某一张 rank 画出"既是源卡又是目的卡"的双向线，并把 figure-3 底部与 caption 重复的 note 删掉 |
| P3-1 | expert-parallel.md:103 | "288 个路由专家才交给 `FusedMoE` 按 EP 分"措辞会误导 | 源码里共享专家也作为参数传进去：`self.experts = FusedMoE(shared_experts=self.shared_experts, gate=self.gate, ...)`；它只是不参与 EP 切分 | 改成"共享专家同样挂在 `FusedMoE` 下，只是不参与 EP 切分；按 EP 分的只有 288 个路由专家" |
| P3-2 | expert-parallel.md:172 | "无 LoRA"这个前提在本快照里是空条件 | `db701c1f` 的 `select_moe_comm_method` 根本没有 LoRA 分支，该分支是 `2ed6cbba` / `baa023ad` 才有 | 加半句："LoRA 这条前提是为了与 v0.26 / main 对齐，执行侧快照里还没有这条判断" |
| P3-3 | expert-parallel.md:341 | 漏了更靠前的一条返回 AllGather 的情况 | `db701c1f:ascend_forward_context.py` 的 `select_moe_comm_method` 第一条判断是 `if not enable_expert_parallel or get_ep_group().world_size == 1: ALLGATHER`；旧版 HEAD:169 写过这条 | 在"会报什么错"末尾或"怎么开"里补一句：没开 EP、或 EP 组只有一张卡时不报错，直接回到 AllGather |
| P3-4 | expert-parallel.md:201 | 小节标题把两个批次混成一个 | 标题说"场景 M：每卡通信量为什么从 55.1 MiB 变成 6.09 GiB"，但 55.1 MiB 那档是"场景 M 去掉 prefill"的对照批次（正文 209 行才说明） | 标题改成"场景 M 与它的纯 decode 对照：每卡通信量为什么差 113 倍" |
| P3-5 | expert-parallel.md frontmatter | 3 条 sources 既无角标也不在"源码位置"表 | `ascend_config.py#L139-L177`、`moe_comm_method.py#L122-L221`、`vllm parallel_state.py#L1833-L1875` | 给 318 行的参数默认值表、`Missing communication context` 那一行各挂一个角标，`parallel_state` 用于"EP16 通信域"的说明或删掉 |
| P3-6 | expert-parallel.md:83,87-97 | 刚声明整卡账统一在部署页，又自己推了一遍每卡 432 MiB / 17.72 GiB / 三种占比 | 83 行"布局和整卡账的完整推导统一在部署页"；87–97 行重新推导 | 口径句改成"部署页给整卡账，本页只把其中路由专家那一行拆到形状"，或把三种占比的 calc 精简成引用 + 一句结论 |
| P3-7 | expert-parallel.md:107 | MC2 与 AllGather 先用后解释 | 107 行已在用"MC2 路径 / AllGather 路径"，解释在 113 行与 172 行 | 在 69 行的部署前提里先给一句话解释，或把 107 行那句改成指向后文 |
| P3-8 | wiki/diagrams/expert-parallel-fit.yaml:23,26 | 判断框的"否"标签浮在右侧远处，底部 note 与 caption 重复 | `texts[3]` 在 `[779,246]`，距离折线起点较远；`texts[6]`"判据：专家密度、EP 规模、执行宽度"与 caption 说的是同一件事 | "否"移到折线起点旁，删掉底部 note |
| P3-9 | expert-parallel.md:69 | 开头第三段一次性砸出全部配置 | 一句话里有 TP8 / DP2 / EP16 / W8A8 / BF16 / FP32 / 两个 commit | 拆成两句：先讲 TP8 / DP2 / EP16 的分工，数值精度与 commit 挪到本节末尾或脚注式的一句 |
| P3-10 | expert-parallel.md:87 | MTP 只给中文功能解释，没写英文原名 | "MTP（先猜候选 token、再交主模型验证的模块）" | 改成"MTP（Multi-Token Prediction，先猜候选 token、再交主模型验证的模块）" |

**P1（事实或数字错误）：0 条。** 第三、四、五节列出的数字、机制与源码引用逐项复核通过，没有发现与源码或底稿冲突的结论。

## 八、以初学者身份读下来，最卡住的三处

1. **131 行之前的"为什么 MC2 要先把 token 分给 8 张卡"。** 121 行说 prepare 把 4 行补到 8 行、再按 TP rank 切成每卡 1 行，但没说为什么要这么切（组内 8 张卡本来持有同一份输入，不切就会重复派发）。后面"源卡负责一行、目的卡收到 N_r 行"这整套理解全压在这一步上，读者在这里断档，到 131 行"rank 4–7 没有自己的 token 却仍可能收到工作"就跟不上了。建议在 121 行补一句话讲清动机。
2. **§场景 M 一节里三套口径同时开工。** 205 行先定"逻辑载荷"口径，225 行说 55.1 MiB 是上界，253 行又说 113 倍是"两个不同批次"的比值不能当成换算法的加速比；同一节里还要读者去并发页取 6048 与 64 的来历。三件事各自都对，但叠在一起，初学者读完记不住"到底哪个数能用来说明什么"。建议在小节开头用两句话给结论（什么变了、为什么变这么多），把限定条件压到段末。
3. **MC2 路径里"combine 完了为什么还要一次 TP8 All-Gather"。** 148 行刚说 combine 已经按权重合成了该卡的路由结果，150 行马上又做 All-Gather；同时共享专家是在完整 `[4,4096]` 上算的，而路由分支每卡只算 1 行——这种不对称页面没有点破。读者容易以为 All-Gather 是在合并专家结果。建议在 150 行明确写出："All-Gather 拼回的是被切开的 token 行，不是专家结果；共享分支从来没被切过。"

## 九、和 09-25 Codex 那一版、以及 HEAD 旧版的对比

**对比对象**：当前 `git diff` 对应的那一版（09-25 Codex 改坏的版本）已被写手删除重建，工作区里取不到；从 Codex 会话记录里恢复出写手动手前读到的原文（91 行，`title: 专家并行（EP）：专家放置、token 派发与结果组合`，`verified: []`，`updated: "2026-09-26"`），小节是：从单设备 MoE 到分布式专家 / EP 与专家矩阵的 TP 切分 / 多个 token 怎样形成专家工作量 / dispatch、专家计算、combine / 同一层可以有不同通信路径 / 容量收益与执行代价。另用 `git show HEAD:wiki/concepts/expert-parallel.md` 取了 09-24 的旧版（204 行，Qwen3.6-35B-A3B 双卡）。

**比 Codex 版好在哪（都是实打实的）**：

- Codex 版用的是玩具示意：四个专家、每个 token 选两个、"A 选 E0/E2"；专家权重按 BF16 估成 48 MiB / 个、288 个 13.5 GiB，还假设"均匀放在两个 EP rank 上，每个持有 144 个"——和我们的双机 16 卡部署完全不是一回事。新版整页只有 GLM 真值（288/8/1、18 个/卡、432 MiB、17.72 GiB、64 行、6048 行、12096 行）。
- Codex 版**没有 `## 对照源码` 这一节**，没有版本差异表、没有报错表、`verified: []`；新版 5 个 H3 齐全，三版结论逐条给出并且我这一轮核实通过。
- Codex 版通篇是"不能把 A 当成 B"式的句子（"不能把图中的连续编号当成唯一布局""不能一律说成两次公开 All-to-All API""不将估量或示意写成 GLM 的性能实测"），免责密度远高于本轮的 4%。
- Codex 版没有把页面挂到主线上（没有第 4 站、没有场景 M）；新版第一屏就给出站点位置和两个场景的链接。

**Codex 版里丢掉但值得回收的**：那张"三种通信组织方式"的对照表（All-to-All / All-Gather+Reduce-Scatter / MC2 各自怎么组织、读代码时看什么）。新版除了 LoRA 那一行之外几乎不提 `ALLTOALL`，读者看到源码里的四个枚举值会对不上。建议在"A2 怎样选择"一节加一句：A2 上选择器只会产出 MC2 / ALLGATHER，`ALLTOALL` 与 `FUSED_MC2` 属于别的设备代次或 LoRA 场景。

**HEAD 旧版（Qwen 双卡）里讲得好、这次保住了的**：一个 token 在一层 MoE 里的分步讲法（旧版四步，新版 ①–⑩ 更细）、"专家权重留在原地、搬的是激活"这个核心直觉、启动开关与默认值、A2 与 A3 选择条件不同、EPLB 与 EP 是两回事。

**HEAD 旧版里讲得好、这次没保住的**：

1. **"两种拆法"的正面对比**（旧版 :100-112）：先给 TP 切专家，再给 EP 分专家，并解释卡数一多为什么 EP 更合算。新版只在常见误解里一句"本部署路由专家在 EP 持有卡上完整计算"。→ 已记为 P2-3。
2. **"开了也没用"的边界**（旧版 :145、:169）：单卡参与 MoE 时开关不生效、非 MoE 模型不生效，都不报错。新版只写了 EP8/超容量回到 AllGather。→ 已记为 P3-3。
3. 旧版给了一个可复制的最小启动命令代码块；新版把参数写在行内。这一条不算丢失（教程链接在，双机命令属于部署页），只记一笔。

**结论**：相对 09-25 那一版是彻底换代，方法（沿主线把每一站的数字算出来）和结构（对照源码五节、三版差异）都回来了，而且数字这次和底稿对齐、没有漂移；相对 09-24 的 Qwen 旧版，覆盖面和证据强度都更高，只丢了"为什么选 EP 不选 TP"和"开了也没用"两处，都可以用两小段补回来。

## 十、未核清单

1. `baa023ad` 的 `set_mc2_tokens_capacity` 没有逐行读，版本差异表里 main 那格的"容量函数重构"只核到了 v0.26 的 mega-moe 分支限幅，main 的具体改动**未核**。
2. `docs/plans/` 按纪律没读，单一出处的判断基于页面自述 + 与 one-request / concurrent-requests / glm-5-3-flash-two-node / tensor-parallel 的实际比对，可能与计划 §5.1 的单一出处表有出入。
3. `wiki/TERMS.md` 按纪律没有整份读，术语结论按任务里给的规则判。
4. 浏览器没有自己起服务复现，用的是写手留下的 `browser-check.json` 与 16 张截图；窄屏（<1440）下的表格与 calc 块表现**未核**。
5. 页面自报的待核项这一轮同样无法核：真实算子 trace 的各卡 `N_r`、缓冲与峰值显存、HCCL/网卡实际流量、CANN 内部是否合并同目的卡副本、运行实例的配置转储与路由 trace。
6. `quant_model_description.json` 没有取到，87 行"这些是权重矩阵账"的逐层量化类型假设**未核**（页面自己也标了待核）。
7. `routed_scaling_factor = 2.5`、`first_k_dense_replace = 3` 这两个模型配置值是与 `wiki/concepts/glm-5-3-flash.md:250-252`、`wiki/sources/glm-5-3-flash-baseline.md:53-54` 对齐的，**没有再回 HuggingFace 的 `config.json` 原文核一次**。
8. `wiki:audit`、`check:content` 用的是写手留下的日志（均为 ok），本轮**没有自己重跑**；`wiki:lint` 与 `wiki:diagrams --check` 是自己跑的。

## 十一、给"全库深入页标准"的开放问题（需用户或计划拍板）

1. **角标位置**：本页 15 处角标在 `## 对照源码` 之前，而 `glm-5-3-flash-review` 当时把"`## 对照源码` 以上 0 处角标"记为通过项。两种做法 lint 都放行，深入页标准要定一种。
2. **免责句阈值的统计口径**：本页按「待核」算 3.38%、按关键词集算 4.00%，前几轮审查用的是关键词集。建议把口径写进标准，并把"待核：缺 X"这类正当的证据缺口是否计入说清楚。
3. **深入页与主线页的边界**：本页在"部署页负责整卡账"的前提下仍然推导了每卡专家权重（P3-6），共享专家又与 tensor-parallel 重复（P2-2）。建议标准里写死一句：深入页可以展开机制，但只要某个数在别的页有推导，就只允许引用结论。

## 十二、第二轮修订记录（2026-09-27）

本轮按用户指定范围修订 `wiki/concepts/expert-parallel.md`、它的四组 YAML/SVG，并在本报告追加记录；未改 `tensor-parallel.md`、其他页面、`src/` 或 `tests/`，未提交 Git。沿用旧版“两种拆法”的讲解方法，数字使用本部署的 288 专家、16 卡、W8A8；TP16 是同一模型的矩阵分片对照，实际部署仍为 TP8 / DP2 / EP16。

### 问题处理

| 审查项 | 本轮修订与定位 |
| --- | --- |
| P2-1 | 否定式限定改为直接回答；将显存、路由、网络与实例配置的同类缺口集中到页末，保留各项所需证据。正文 119、369、412 行三处“待核”，未靠删去待核材料降低比例。 |
| P2-2 | 121–123 行仅保留共享专家 TP8、3 MiB/卡/层的结论；用 `rg` 找到 TP 页标题“共享专家走 TP8，路由专家走 EP16”，链接 `tensor-parallel.md#共享专家走-tp8路由专家走-ep16`。本页撤去共享矩阵形状与字节推导，归约时点随 EP 流程保留。 |
| P2-3 | 87 行起增加 TP16/EP16 对照表与 calc：单专家 24 MiB；TP 每专家每卡 1.5 MiB、中间维 128，EP 每卡 18 个完整 2048 维专家；两者每卡每层均 432 MiB。逐项说明 top-8 计算分工、部分和归约与专家结果派发回收；346 行补回开关不生效边界。 |
| P2-4 | 190 行首次解释 capture size 与 graph mode，后文和选择图使用相同术语。 |
| P2-5 | 仍为四张图：`expert-parallel-assign` 改为 16 卡布局加 rank 0 收发双角色；`expert-parallel` 合并 MC2/AllGather 为并排流程；`expert-parallel-fit` 保留代码选择流程；`expert-parallel-split` 的原流程内容并入前图，原文件改画每卡每步 55.1 MiB 与 6.09 GiB 的线性比例条形图。画布宽分别为 960、960、900、960px。 |
| P3-1 | 123 行明确共享专家同样挂在 `FusedMoE` 下，按 EP 分的只有路由专家。 |
| P3-2 | 188 行明确执行快照没有 LoRA 优先分支；无 LoRA 是与 v0.26/main 比较时的前提。补充 `ALLTOALL`、`FUSED_MC2` 的分支归属。 |
| P3-3 | 346 行补全非 MoE 返回 `None`、单卡 `use_ep=False`、未开 EP 或 EP 组单成员返回 AllGather；新增来源 `db701c1f:ascend_forward_context.py#L311-L363`。 |
| P3-4 | 213 行标题改为“场景 M 与它的纯 decode 对照”，首段先说明批次宽度与通信方式同时变化，113 倍是两档逻辑载荷比。 |
| P3-5 | 原未使用来源分别落到 `[C19]`（默认配置）、`[C30]`（通信上下文报错）、`[C33]`（EP/MC2 组覆盖范围）。 |
| P3-6 | 整卡占比的重复 calc 撤去，17.72 GiB、MTP 432 MiB 与整卡 20.58 GiB 引回部署页；本页只展开用户要求的专家切法比较。 |
| P3-7 | MC2 与 AllGather 在 129 行就地解释，先于后面的两路执行讲解。 |
| P3-8 | 选择图的“否”移到折线起点旁，删除与 caption 重复的底部 note。 |
| P3-9 | 开头只交代 TP8/DP2/EP16 分工；精度移到单专家权重推导，提交号移到该节末尾。 |
| P3-10 | 117 行补出 Multi-Token Prediction。 |

另补审查第八节的两处教学断点：137 行说明 TP8 输入原本复制，切源 token 是为了每行只派发一次；166 行区分 combine 汇合专家贡献与 All-Gather 拼回 token 行，共享分支始终保留本组完整输入。浏览器发现旧 calc 的全角括号被解析成旁注，已改为方括号，求和表达式保持在同一行。

### 本轮验证证据

- 用 `git show HEAD:wiki/concepts/expert-parallel.md` 核读旧版；核读底稿相关段落与固定源码。补核上轮未逐行读的 `baa023ad:ascend_forward_context.py#L241-L275`，版本表将“容量函数重构”改成普通 MC2、融合算子、MegaMoE 分别限幅的具体行为。
- 新增计算独立复算：24 MiB/专家、TP16 中间维 128、两种切法 432 MiB/卡/层；MC2 为 1,376,512 B/层、55.13525390625 MiB/步，AllGather 为 155,602,944 B/层、6.086494445800781 GiB/步，比值 113.04147294030129。图采用未舍入的 MiB 数值与同一比例。
- 免责统计脚本及结果见 `content-check.json`：去 frontmatter、围栏、标题、表格和孤立角标，按 `。！？` 或换行分句；关键词 `待核|不能|不等于|尚未|并非|不代表` 命中 **3 / 221 = 1.36%**。保留表格内容行的另一口径为 **3 / 299 = 1.00%**；两种口径都把“待核：缺……”计入分子。角标 **27** 处，其中 `[C]` **20 / 27 = 74.1%**；源码节后无 H2，五个 H3 顺序正确。
- 最终依次运行 `pnpm.cmd wiki:lint`、`pnpm.cmd check:content`、`pnpm.cmd wiki:diagrams --check`、`pnpm.cmd wiki:audit`，**全部退出 0**。Windows PowerShell 禁止运行 `pnpm.ps1`，故使用等价的 `pnpm.cmd`。lint 的 22 条非阻塞提示均在其他页面；本页及四张图零提示。内容校验通过 131 页 registry；152 张 SVG 与 spec 一致；audit 无无效 commit、缺失文件或行号越界。audit 的通过范围仍是本地引用与行号，URL 内容、raw 摘录语义不在其通过范围内。
- 只通过已有 `renderDiagram` 为本页四个指定 id 生成 SVG；未执行全库 SVG 写入。`git diff --check --` 限定本页及八个图文件，未发现空白错误。
- 用 `pnpm.cmd dev --port 4174 --strictPort` 起服务，Playwright Chromium 在 **1440×1000** 下截图；最终全页高 **15638px**、文档宽 **1440px**，正文溢出 **0**，页面错误 **0**。四张图实际宽均不超过 960px。检查 `screen-01..18.png`，修正后的算式另复看 `screen-07.png`；四图、表格、calc 均完整可读。
- 浏览器核验 **35 个去重锚点（含 11 个跨页锚点）全部存在**；实际点击共享专家链接并确认目标标题显示，结果见 `link-click.json`。截图后已终止本轮服务，`Get-NetTCPConnection -LocalPort 4174 -State Listen` 确认无监听；未操作 4173、5193、8790。

证据目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p4\expert-parallel-r2\`。包含 `full-page.png`、18 张逐屏截图、图/算式截图、`browser-check.json`、`link-click.json`、`content-check.json` 及四项校验日志。

### 取舍与剩余事项

保留必要的实际运行边界：权重量化描述、实例版本/配置/环境变量、逐层专家 trace、缓冲与峰值显存、HCCL/网卡 trace、CANN 副本合并行为、同负载 TP/EP 及单双机性能对照仍需运行材料；页面逐项写明缺什么。当前完成的是文档、源码静态核对和浏览器验证，未做 NPU 性能实测。需用户决定的问题：无。

## 十三、第三轮修订记录（2026-09-27）

按 `codex-p4-intuition.md` 重排教学顺序：先解释 MoE、专家与 EP，第一屏呈现一个 token 经 router 选 k 个专家、派发、各卡计算、收回加权的过程；第二节解释通信代价与 TP 的区别，再进入 GLM 双机实例。八个 H2 按用户指定顺序排列；“对照源码”仍保留原五个 H3。

- 新增 `expert-parallel-intuition.yaml/.svg`，画布 900 × 292，无字节或 GLM 形状。原 16-rank 图退出正文，全部专家编号改存第三节八行对照表，rank 0 的源卡、目的卡双角色保留在紧随其后的文字里。原 dispatch/combine、选择流程、通信量比例图仍使用；选择图 caption 的 commit 移回源码节。正文共四张图。
- 已审过的事实与数字保留。参数、配置推导、EPLB 检查表、权重打包名、算子接口、commit 和 TP16/EP16 详细对照移入源码节；场景 M 的形状、通信账与负载不均集中到第六节。原 32 行算式的等号右侧逐行比对全部保留，数值集合无遗漏，见 `preservation-check.json` 与 `content-check.json`。各 H2 最多一个 calc，表格与 calc 相邻次数为 0。
- 自查口径：去 frontmatter，以中文字符数作“千字”分母；行内代码计单反引号片段，排除围栏。全文 8167 个中文字符、3 个 calc、101 处行内代码，密度分别 **0.37 / 千字、12.37 / 千字**。源码节之上 5354 个中文字符、2 个 calc、0 处行内代码，密度分别 **0.37 / 千字、0 / 千字**。首图围栏在 **第 67 行**，图前 **0 个 calc、1 个具体数字（288）**。源码节之上 **0 个证据角标**；全页 25 个，C 为 19 / 25 = 76%。
- 初学者测试，仅读前两屏：**EP 把完整专家分到多张卡，让 token 去找选中的专家算完再收回加权，代价是派发和回收两次通信。**
- 最终依次运行 `pnpm.cmd wiki:lint`、`pnpm.cmd check:content`、`pnpm.cmd wiki:diagrams --check`、`pnpm.cmd wiki:audit`，全部退出 0；指定文件 `git diff --check` 通过。lint 的 22 条非阻塞提示均不在本页；内容校验 131 页，154 张图与 spec 一致；audit 无无效 commit、文件不存在或行号越界，其通过范围仍为本地来源与行号，不含 URL 内容与结论语义。`pnpm.cmd wiki:diagrams` 实际只写入本页新增直觉图和修改 caption 的选择图两个 SVG。
- Playwright Chromium 在 **4175、1440 × 900** 下打开并逐屏滚动，保存并检查 **18 张逐屏截图**及全页图；最终页高 **16027px**，页面宽 **1440px**，正文右侧溢出 0，最终浏览器验证中 pageerror 为 0。首图上下边界为 **417–795px**，四张 SVG 实际宽均为 900px。14 个去重页内/跨页锚点均存在；实际点击共享专家链接并读到目标标题。验证时发现同时修订的 TP 页已更名旧小节，只在本页更新链接到“稠密 MLP 与共享专家：每卡各留一段通道”，未修改 TP 页。
- 截图后通过本轮进程会话关闭服务，再请求 4175 得到 `ECONNREFUSED`，见 `server-stopped.json`。没有操作 5193 或 8790，没有 Git 提交。修改范围仅为本页、新直觉图、选择图 caption 及本修订记录。

证据目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p4-r3\expert-parallel\`。包含 `screen-01.png` 至 `screen-18.png`、`full-page.png`、`browser-check.json`、两份内容自查 JSON、服务关闭记录及四项校验日志。既有 NPU 实测材料与量化描述缺口均保留在页末；本轮只调整讲法、布局与引用，不重新认定性能结论。需用户决定的问题：无。

## 十四、第三轮审查（09-27）

- 审查对象：`wiki/concepts/expert-parallel.md`（443 行，工作区 ` M`）与新增 `wiki/diagrams/expert-parallel-intuition.yaml/.svg`（`??`）。只审，没有改页面。
- 读法：页面分三段读完；写手截图看了 `screen-01/02/03/05/06`；底稿 `docs/mainline/02-forward.md` 只 grep 后读 634–659 行；本报告第 1–248 行分两段读；第二轮稿（写手留存的 `before.md`）只用脚本比对数字、标题和角标，没有通读。没读 HANDBOOK、`docs/plans/`，`wiki/TERMS.md` 只 grep 了第 80 行（昇腾）。没有文件被拦。
- 自己跑的：`npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 22 处待留意）`，本页 0 条；`npx tsx scripts/wiki-diagrams.ts --check` → `ok wiki:diagrams 154 张图与 spec 一致`，本页 5 个图文件 0 告警；`npx tsx scripts/wiki-audit.ts` → `ok`，行号越界 0；链接脚本 `scratchpad/ep-r3-links.mjs`（照 `src/content/wiki/anchors.ts` 的 `headingSlug`）→ 25 个链接 0 失效；统计脚本 `scratchpad/ep-r3-stats.py`；自起 vite（5199 端口）后用 Playwright 在 1440×900 下实测，结果见 B7，测完已停掉服务；官方教程外链用 curl 访问，返回 200。

### A. 初学者测试

只看前两屏（screen-01、screen-02 上半，md 61–79 行），我用自己的话复述：

> EP 就是把 MoE 的专家整份分到不同的卡上放。router 给一个 token 挑出 k 个专家后，把这个 token 发到这些专家所在的卡上去算（dispatch），算完再送回原卡按权重加起来（combine）。代价是每层都要一去一回两次卡间通信，还要等其他卡。

能说出来，所以不记 P1。说不出来的是“为什么非拆不可”：标题说“一张卡放不下”，前两屏却只有“288 个”这一个数，初学者不知道 288 个专家到底有多大（见 P2-1）。

### B. 七条标准逐条

| # | 结论 | 证据与说明 |
|---|---|---|
| 1 | 部分符合 | **H2 用问题命名：不符合**。61 行「288 个专家，一张卡放不下」是陈述句，GLM 的数排在概念前面。这一节讲的其实是“EP 是什么”，“为什么”写在 73 行「代价」那节的 77 行（P2-2）。**一句话定义：符合**。63 行先解释 MoE、expert、token、router，65 行才下定义；只有“前馈”到 104 行才解释（P3-1）。**直觉图：部分符合**。图里有 token 和 k，router → dispatch → 算 → combine 加权这条流程完整，也没写字节（intuition.yaml 6–21 行）。但没标卡数；图上只有两个“持有选中专家的卡”框，既看不出“专家分放在各卡”这半句定义，也看不到源卡（P2-3）。 |
| 2 | 部分符合 | **为什么需要 EP：不符合**。77 行只说“288 个路由专家都得常驻”，容量账推给了部署页，没有一个能说明“放不下”的数（P2-1）。**代价：符合**，75 行讲了 dispatch/combine 两次通信和等待。**和 TP 的区别：符合**，79 行一段话讲完；小瑕疵是“张量并行（TP）”没用英文原名（P3-3），“输出归约”没解释（P3-1）。 |
| 3 | 部分符合 | **一个 token 走一遍：符合**，116/122/130/143 四步。**每节先一句结论：部分符合**。83 行 H2 的首句只交代位置，不是结论；83–110 行 8 段加 1 张表，token 起步前就塞进 10 多个新概念（P2-4）；118 行首句是形状，132 行首句是术语定义（P3-6）。**每节最多 1 个 calc：符合**。**表格和 calc 不挨着：勉强符合**，149–154 行的 calc 和 158–165 行的表之间只隔 156 行一句引语，screen-05/06 上看是连着的（P3-5）。**场景 M 单独成 H2：部分符合**。212 行已经单独成节，但 112 行双列图的右列就是“AllGather · 场景 M · 本组 6048 行”，放在了“一个 token 走”这一节里（P2-5）。 |
| 4 | 符合 | 291 行是常见误解，301 行是对照源码；五个 H3 依次在 303/337/352/384/410 行，顺序正确；版本差异表（390–402 行）覆盖 v0.23、v0.26、main；301 行之后没有 H2（文件在 443 行结束）。 |
| 5 | 符合 | 301 行以上证据角标 0 处（全页 25 处都在源码节）。行内代码：301 行以上 0 处；全页 101 处，按全部可见字符（16,310）算是 6.2/千字，按写手的中文字符口径算是 12.37/千字，都 ≤13。免责句：按“待核 / 证据缺口 / 另测”算，全页 8/336 = 2.4%，源码节以上 5/237 = 2.1%，都 <3%。如果把字面上的“可能”全算进去，是 14/336 = 4.2%；但 128、250、293、296 行的“可能”说的是路由结果本身不确定，属于事实描述（P3-8）。 |
| 6 | 部分符合 | MC2、AllGather、dispatch、combine、dummy run、capture size、graph mode、grouped matmul、MTP 都用了英文原名。问题有三处。①正文里直接写“Ascend”（110、141、222、228 行，源码节 315–346 行也有），而 TERMS.md:80 规定正文用“昇腾”，只有包名、类名照原样（P3-2）。②79 行“张量并行（TP）”（P3-3）。③先用后讲，明细见 P3-1；另外 AllGather（路径）和 All-Gather（集合通信）只差一个连字符，页面没说明两者不同（P3-4）。 |
| 7 | 符合 | 四张 SVG 的 viewBox 宽都是 900：intuition 900×292、expert-parallel 900×850、fit 900×656、split 900×396。Playwright 在 1440×900 下实测：`documentElement.scrollWidth = 1440`，越界元素 0，横向滚动容器 0，四张 SVG 实际宽度都是 900px。 |

### C. 事实核对

| 数 | 页面行 | 底稿 | 结论 |
|---|---|---|---|
| 288 个路由专家、top-8、1 个共享专家 | 83 | 02-forward.md:30、572 | 一致 |
| EP16，每卡 18 个专家 | 85 | 02:615、636 | 一致 |
| 每卡专家权重 17.72 GiB | 106 | 02:123、625（432 MiB × 42 = 18,144 MiB） | 一致 |
| MC2 容量 128 | 173 | 02:651–654 | 一致 |
| MC2 每卡每步 ≤55.1 MiB | 214、264 | 02:904、914；42 × 1,376,512 B = 55.14 MiB | 一致 |
| AllGather 6.09 GiB | 214、273 | 02:891、915；42 × 155,602,944 B = 6.087 GiB | 一致 |
| 约 113 倍 | 214、275 | 02:916；155,602,944 ÷ 1,376,512 = 113.04 | 一致 |
| A2 上只在 MC2 与 AllGather 之间二选一 | 171 | 02:637–642 | 一致；页面限定了“开启 EP”，404 行还说明 v0.26/main 加 LoRA 后会离开这个前提 |
| 抽查：每个专家 24 MiB | 102 | 3 × 4096 × 2048 × 1 B；02:623 | 一致 |
| 抽查：整卡 20.58 GiB | 106 | 02:130 | 一致 |
| 抽查：MTP 专家 432 MiB | 106 | 02:819 | 一致 |
| 抽查：共享专家每卡每层 3 MiB | 104 | 02:124、717 | 一致 |
| 抽查：跨机 4.15 GiB、EP 交换 31.5 MiB | 242、265、274 | 02:891、914 | 一致 |
| 抽查：94.5 MiB/卡/层 | 246 | 02:886 | 一致 |
| 抽查：R1 dispatch ≤32,800 B | 167 | 02:754、969 | 一致 |

附带一条（不算本页的问题）：底稿 02:654 写“任何一个 chunked prefill 混进来就翻到 ALLGATHER”；本页 298 行按“是否超过 128”来判断，R1 的 4-token prefill 仍走 MC2，这比底稿的措辞更准确。

### D. 信息有没有丢

用脚本比对第二轮稿和本稿：正文里的数字从 191 个变成 212 个，丢失 0 个；`[Cn]`/`[Sn]` 角标没有少；标题从 24 个变成 22 个，少掉的两个 H3（“为什么 MoE 用 EP，而不是把每个专家按 TP 切”“共享专家仍按 TP8 切”）内容分别搬到了 356–380 行和 104、323 行。

前几轮要求补的点逐条核对：第一轮 P2-2 共享专家单一出处（104 行）✓；P2-3 两种拆法（79 行，以及 356–380 行）✓；P2-4 capture size / graph mode（173 行）✓；P2-5 的比例条形图（216 行）✓；P3-1 FusedMoE（323 行）✓；P3-2 LoRA 前提（388 行）✓；P3-3 开了也没用（319 行）✓；P3-4 场景 M 与纯 decode 对照（212–214 行）✓；P3-5 的 C19/C30/C33（317、345、429 行）✓；P3-6 整卡账引回部署页（106 行）✓；P3-7 MC2/AllGather 先讲后用（110 行）✓；P3-10 MTP 英文名（106 行）✓；第八节三个断点（118、214、147 行）✓；ALLTOALL/FUSED_MC2 归属（388 行）✓；EPLB 检查表、报错表、版本表（325–333、341–348、390–402 行）✓。

**结论：数字、机制和源码结论都没丢。唯一丢掉的是“rank 0 既是源卡又是目的卡”的图示**：assign 图退出了正文，只剩 100 行的文字（P3-7）。

### E. 链接

页内 25 个链接（包括 3 个本页锚点和 1 个 sources 相对链接）都能解析到存在的文件和标题，失效 0 个。tensor-parallel 相关的两处按定稿标题核对：79 行链到页首，有效；104 行 `tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道` 对应 tensor-parallel.md:266 的「### 稠密 MLP 与共享专家：每卡各留一段通道」，有效。官方教程外链返回 HTTP 200。

### F. 评分与问题

**7 / 10**。扣分原因：直觉图只画了 token 走的路，没画专家怎么分（−1）；“为什么要 EP”缺关键的数，H2 也和内容错位（−1）；GLM 段开场过载，场景 M 混进了单 token 的走读（−1）。事实、链接、源码节结构和图宽都没有扣分。

**P1：无。**

| 级别 | 位置 | 问题 | 改法 |
|---|---|---|---|
| P2-1 | 61、77 | 标题说“一张卡放不下”，前两屏却没有一个能说明“放不下”的数；17.72 GiB 挪到了 106 行，而且那是分摊之后的数 | 77 行补一句量级：“42 层 × 288 个路由专家按 INT8 共约 283.5 GiB（= 16 × 17.72 GiB），而一张 A2 卡约 64 GB 显存”（依据 02:625、02:137）；部署页链接保留 |
| P2-2 | 61、73 | H2 不是读者会问的问题，标题和内容也错位：第一节讲“是什么”，标题却是“放不下”；第二节叫“代价”，却同时讲了“为什么”和“与 TP 的区别” | 例如改成「## EP 是什么：专家分到各卡，token 去找专家」和「## 为什么要拆，代价是什么」，后一节放 P2-1 的数、dispatch/combine 和 TP 对比 |
| P2-3 | 67–69；intuition.yaml | 直觉图没标卡数，也没画“专家分放在各卡”：只有两个“持有选中专家的卡”框，看不到没被选的专家，也看不到源卡 | 画几张卡（例如标“4 张卡、k=2”，或直接用“16 张卡、k=8”），每张卡画几个专家格；token 放在卡 0，被选中的专家高亮，没选中的置灰；dispatch 箭头指向持有卡，combine 回到卡 0 加权。再让卡 0 自己也持有专家、也接收别的卡发来的 token，顺便把 rank 0 的双角色补回来 |
| P2-4 | 83–110 | token 起步前堆了 8 段加 1 张表，10 多个新概念（rank、W8A8/INT8/BF16/FP32、MTP、17.72 GiB/432 MiB/20.58 GiB、prefill/decode、MC2/AllGather），H2 首句也不是结论。这仍然是用户说的“塞满参数名” | H2 首句写结论，例如“EP16 下每卡持有 18 个完整专家，一个 token 选中的 8 个专家通常散在不同卡上，还可能跨机”；只保留 EP16 和 rank 表；精度挪到第 2 步 dispatch 量化那里；MTP 和三项权重并成一句，链到部署页；MC2/AllGather 的定义挪到「MC2 还是 AllGather」一节 |
| P2-5 | 110–114、187 | 双列图的右列是“AllGather · 场景 M · 6048 行”，却放在“一个 token 走”这一节里，违反“场景 M 单独放在后面”；187 行又要读者回头翻这张图 | 双列图挪到「MC2 还是 AllGather」一节，紧挨 187 行的讲解；token 走读那里只配 MC2 单列图，或者不配图 |
| P2-6 | frontmatter 第 6 行（首屏“也叫”） | 首屏标题下列了 20 个别名，其中 11 个是代码名或枚举（ep_size、MoECommType、select_moe_comm_method、determine_expert_map、PrepareAndFinalizeWithMC2 等），初学者第一眼看到的就是参数名 | 别名只留人读的名字。上面 5 个代码名目前只出现在别名里，先把它们写进「源码位置」正文，保证检索不受影响，再从 aliases 删掉。如果要前端统一只显示非代码别名，需要跨页决定 |
| P3-1 | 63、75、77、79、112、118、179、202 | 先用后讲：前馈（63 行用，104 行才讲）、归约（75/79 行用，147 行才讲）、路由专家（77 行用，83 行才讲）、集合通信（118 行起用，全页都没解释）、图里的 prepare 和 N_r（112 行出现，118/126 行才讲）、场景 M（179 行用，212 行才讲）、M′（202 行出现，全页没解释） | 就地补半句解释；M′ 写成“DP1 一条请求都没有的变体”；集合通信链到 collective-communication |
| P3-2 | 110、141、222、228（源码节 315–346 行的正文同样） | 正文写“Ascend”；TERMS.md:80 规定正文用“昇腾”，包名、类名才照原样 | 改成“昇腾” |
| P3-3 | 79 | “张量并行（TP）”没用英文原名 | 改成“tensor parallel（TP，张量并行）”，和 65 行 EP 的写法一致 |
| P3-4 | 110、147 | AllGather（路径）和 All-Gather（集合通信）只差一个连字符，页面没有说明 | 147 行加一句，说明两者的区别 |
| P3-5 | 149–165 | calc 和汇总表之间只隔一句引语，屏幕上看是连着的 | 把汇总表挪到 H3-4 末尾一段正文之后，或者并到 H2 结尾 |
| P3-6 | 118、132 | H3 首句不是结论（一个是形状，一个是术语定义） | 把 118 行的加粗句提到首句；132 行先写“每张卡把收到的行按 18 个专家分组，各做一次三段矩阵乘” |
| P3-7 | wiki/diagrams/expert-parallel-assign.* | assign 图退出正文后成了孤儿文件，rank 0 双角色只剩文字；另有一份说明文档仍把它列为本页四张图之一（grep 命中，没有展开读） | 按 P2-3 把双角色并进直觉图后，删掉 assign 并同步那份说明；或者恢复引用 |
| P3-8 | 128、250、293、296 | 按字面口径算，“可能”让免责率到了 4.2% | 改成确定的说法，例如“收到多少由 top-8 决定” |

### 未核

1. 窄屏没测（知识库前端只管桌面端）。
2. 源码行号本轮没有逐行重核：角标集合和第二轮完全一样，这一轮只挪了位置，而前两轮已经逐条核过；`wiki:audit` 本轮自己重跑，行号越界 0。
3. `check:content` 没有重跑，用的是写手留下的日志（ok）。

## 十五、第四轮修订记录（2026-09-28）

本轮由页面写手依据第十四节修订，并完成内容检查与浏览器自查；这是修订记录，不是新一轮独立审查。范围仅为 `wiki/concepts/expert-parallel.md`、本页的 intuition / assign 两张图及派生 SVG、本文末尾记录；未修改其他页面、src/ 或 tests/，未做 git 提交。

### 修订内容与位置

| 审查项 | 本轮处理 | 当前页位置 |
|---|---|---|
| P2-1 首屏缺容量依据 | 补 GLM-5.3-Flash 主干路由专家按 8 位整数存储约 **283.5 GiB**，对照 A2 单卡标称 **64 GB**；用一句正文说明，保留部署页链接，不加 calc。依据底稿 `02-forward.md:11、123、625`，总量取未舍入的每卡权重账；64 GB 保持硬件标称口径。 | 67 行；screen-01 |
| P2-2 H2 与内容不合 | 前两个 H2 改为「EP 是什么，专家怎样分到各卡？」和「为什么要拆，代价是什么？」。 | 61、75 行 |
| P2-3 直觉图缺卡数与专家分布 | 4 张卡的原理示意，k=2；各卡各放一部分完整专家，亮色为本 token 选中，灰色为未选中；卡 0 的 token 经 router 派到卡 1、卡 2，结果回卡 0 加权。图内无字节、无 GLM 张量形状。 | 69–71 行；`expert-parallel-intuition.yaml`；screen-01 |
| P2-4 GLM 开场术语过载 | 开头只交代 EP16 分工、部署分组和 rank 表；R1 从第 1 步出发，FP32 在打分时解释，W8A8 / INT8 / BF16 在 dispatch 量化时解释，专家矩阵与 24 MiB 在本地计算时解释，共享专家在 combine 后解释。前 3 层、第 3–44 层、42 层、MTP、decode 与三项权重移到后续 H2。 | 83–175 行 |
| P2-5 场景 M 双列图位置错误 | 双列图移到「场景 M」下的长 prefill 小节，左列回顾 R1，右列跟场景 M；图前解释 prepare、finalize 和 Nᵣ。 | 238–246 行；screen-10、11 |
| P2-6 首屏代码别名过多 | aliases 只留「专家并行、Expert Parallel、EP」；其余旧别名和代码名均在「源码位置」的检索名称段保留。 | 6、428 行 |
| P3-1、P3-4 术语先用后讲 | 补前馈、路由专家、归约、集合通信的就地解释；场景 M 定义放到判定图前，M′ 说明是 DP1 无请求的变体；明确 AllGather 是整条 MoE 路径，All-Gather 是两条路径都会用的集合通信操作。 | 63、77、108、179、183、210、242 行 |
| P3-2、P3-3 术语写法 | 正文中的 Ascend 改为「昇腾」，包名与标识符保留；TP 首次写成 tensor parallel（TP，张量并行）。 | 81 行及正文、对照源码相关段落 |
| P3-5、P3-6 阅读顺序 | calc 与汇总表之间改为解释源卡 / 目的卡和两种合并的完整段落；token 四步均先给结论。 | 104–167 行；screen-03–06 |
| P3-7 rank 0 双角色图 | 恢复 assign 引用，并将原图的专家编号总览交给前文 rank 表；图聚焦同一 rank 0 发出 / 收回自己的 token，以及接收 / 返回其他源卡的专家工作。画布从 900×760 收到 **900×380**，原图的专家编号、432 MiB 和 2048 维仍保留在页面中。 | 120–124 行；`expert-parallel-assign.yaml`；screen-04 |
| P3-8 含糊措辞 | 将所列「可能收到」「top-8 可能不同」改成由 top-8 决定、命中本地专家就接收等明确条件，保留负载和通信的不确定性来源。 | 118、264 行及常见误解 |

### 信息保留与自查

- 对照本轮开始时的 `before.md`，正文数字字符串去重集合缺失 **0**，原 `[Cn]` / `[Sn]` 集合缺失 **0**；逐段核对迁移内容，保留 R1、场景 M、MTP、权重、通信次数与载荷、EPLB、错误表、版本差异和运行证据缺口。没有重算或替换原有算例。
- 第一张图的围栏在 **69 行**，前面 **0 个 calc**。图前的具体量为 **8 位、283.5 GiB、64 GB**；另有模型名 GLM-5.3-Flash 与硬件名 A2 中的数字。
- 按「frontmatter 之后、对照源码之前的 Markdown 字符」口径，正文 14,230 字符、2 个 calc，约 **0.14 个 calc / 千字符**；行内代码 **0**，证据角标 **0**。统计口径保存在 `content-check.json`。
- 页面现有 **5 张图**，宽度全部为 900px：直觉图、rank 0 双角色图、通信选择图、场景 M 载荷比较图、R1 / 场景 M 双列流程图。
- 前两屏的初学者回答：**EP 把完整专家分到各卡，token 去找选中的专家，算完回源卡加权；它省每卡权重空间，代价是输入和结果的搬运，以及等待其他卡。**

### 验证证据

最终稿用 `pnpm.cmd` 执行用户指定的四项命令（系统 PowerShell 禁止执行 pnpm.ps1，因此改用同一安装的 .cmd 入口）：

| 命令 | 实际结果 |
|---|---|
| `pnpm wiki:lint` | 通过；22 处既有非阻塞提示，本页无提示 |
| `pnpm check:content` | 通过，registry 131 页；尚无章节，Term 引用检查按脚本跳过 |
| `pnpm wiki:diagrams --check` | 通过，154 张图与 spec 一致；35 处非阻塞提示均不在本页图中；只生成了本页 intuition / assign 的 SVG |
| `pnpm wiki:audit` | 通过；131 页、1478 条来源，行号有效 1393，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0 |

另外：本页 **28 个本地链接及锚点全部有效**；本页及修改图的 `git diff --check` 通过。完整命令输出在截图目录的 `validation.txt`，链接检查在 `links-check.json`。

浏览器使用 **4175** 端口、Playwright Chromium、**1440×900** 视口。已逐屏截图并逐张查看 `screen-01.png` 至 `screen-22.png`，另存 `full-page.png`；第 6–8 屏在把场景 M 定义移到判定图前后重新截取并复看。首屏看得到容量数与完整直觉图，第二屏能读到通信代价；页面 scrollWidth 为 1440，正文越界元素和横向滚动容器均为 0，5 张 SVG 的实际宽度均为 900px。实际点击 MC2、场景 M 和 tensor-parallel 共享专家链接，三处目标标题均滚动到视口 y=16；未修改 tensor-parallel。记录见 `browser-check.json`。

截图与检查输出目录：

`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p4-r4\expert-parallel\`

截图完成后关闭本轮启动的 Vite 服务，连接 `127.0.0.1:4175` 返回 **ECONNREFUSED**。未操作 5193、8790；浏览器验收拦截 /api 请求，使用本地构建快照，避免接触 8790 后端。

### 取舍与检查范围

直觉图只讲一个 token 的往返，rank 0 双角色单独放在 GLM dispatch 小节，避免首图同时追两条 token 路径。保留了精确 rank 表，双角色图不再重复该表。没有待用户决定的问题。

本轮核验了结构、内容迁移、图文布局与本地来源行号，没有重新逐条验证已审过的版本语义，也没有测 NPU 实际通信；URL 85 条未联网验证、raw 摘录 1219 条待核对是全库 audit 的范围说明。逐屏采集的 pageErrors 为 0；链接操作期间 Vite 输出过一次 `ResizeObserver loop completed with undelivered notifications`，目标标题和截图均正常，未改动前端代码。

## 十六、第四轮复审（09-28）

- 审查对象：`wiki/concepts/expert-parallel.md`（459 行，工作区 ` M`）、`wiki/diagrams/expert-parallel-intuition.yaml`（`??`）与 `expert-parallel-assign.yaml`（` M`）。只审，没有改页面和图。
- 读法：页面分四段读完（1–150、150–299、300–449、449–459 行）；写手截图只看了 `p4-r4/expert-parallel/screen-01～03`；本报告读了第 245–392 行（第十四、十五节）；底稿 `docs/mainline/02-forward.md` 先 grep，再读 612–641、934–943 行；`concurrent-requests.md` 只 grep 后读 406 行；`tensor-parallel.md` 只 grep 标题。没读 HANDBOOK、`docs/plans/`、`wiki/TERMS.md`。没有文件被拦。
- 自己跑的：`npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 22 处待留意）`，其中本页 0 条；`npx tsx scripts/wiki-diagrams.ts --check` → `ok wiki:diagrams 154 张图与 spec 一致`，本页图 0 告警；`npx tsx scripts/wiki-audit.ts` → `ok`，行号越界 0；链接脚本 `scratchpad/ep-r3-links.mjs`（照 `src/content/wiki/anchors.ts:8-14` 的 `headingSlug`）→ 29 个链接 0 失效；与写手 `before.md` 的比对脚本 `scratchpad/ep-r4-review/diff.py`、统计脚本 `scratchpad/ep-r4-review/stats.py`；用 PIL 取 screen-01 像素，未选中专家格为浅灰 (236,233,223)，和页面底色 (251,250,246) 能分开。本轮没有自起浏览器，截图用的是写手的。

### A. 核心概念核对

| # | 条目 | 结论 | 证据 |
|---|---|---|---|
| 1 | MoE 和「专家」在 EP 之前解释 | 对，但有一处定义错（P2-1） | 63 行先讲 MoE、expert、token、router，65 行才下 EP 定义。问题在 63 行末句“这些被挑选的专家叫**路由专家**”：照字面，路由专家就是本次被选中的那几个；可是 67、79、85 行说的是“288 个路由专家”“每卡持有 18 个完整路由专家”，指的是全部可以被 router 挑选的专家。前两屏也没提共享专家，“EP 只分路由专家”要到 145 行才看得出来 |
| 2 | EP 是整份专家分卡，不切矩阵 | 对 | 65 行定义“把完整专家分放到不同卡上”；81 行和 TP 对比“TP 把每个专家的矩阵切成小片……EP 把不同专家整份分开”；128 行“EP 保留完整的 2048 维”；309、374–376 行再次确认 |
| 3 | router 给每个 token 选 k 个；GLM top-8；k=2 示意要说明 | 基本对 | 63 行“只选其中几个……由 router 决定”；73 行“k 表示每个 token 选中的专家数”；图标题“4 张卡 · k = 2 · 只示意分工”（intuition.yaml:31）；GLM 的 8 个在 85、104、110 行。缺口：图旁没有一句“GLM 实际是 16 张卡、k=8”，读者要到第三屏才对得上（并入 P2-2） |
| 4 | dispatch 发到持有卡，combine 收回原卡按 router 权重相加 | 对 | 77 行定义两者；143 行“combine 把各专家的结果送回原源卡，加权合成”；149–154 行 calc；161–163 行表格。页面内部一致；底稿只 grep 到 02:753 的 router → top-8，combine 细节沿用前几轮的核对 |
| 5 | 共享专家不走 EP，按 TP8 切 | 对 | 145 行“由每台机器的 TP8 合切，每卡每层占 3 MiB”，并链到 TP 页；309、337 行重申“按 EP 分的只有 288 个路由专家”。与 02:715（共享专家不参与 EP，TP8 切分）、02:717（3.0 MiB/层）一致 |
| 6 | 直觉图与文字一致；看得出卡数、每卡专家、token 去回 | 部分对（P2-2） | 卡数：4 张，标题写明 ✓。去和回：卡 0 的 router 两条 dispatch 线到卡 1、卡 2 的亮色格，两条 combine 线回到“收回结果，按权重相加” ✓（screen-01）。卡 0 标“源卡，也持有专家” ✓。**看不出每卡放了哪些专家**：格子全写“完整专家”，没有编号；卡 0/1/2 各画 2 个，卡 3 画了 4 个（intuition.yaml:11–23），和 EP16 均分（85、264 行）不一致。图注（yaml:3）和 73 行正文几乎逐句重复（P3-3） |
| 7 | 283.5 GiB 与 64 GB 与底稿一致；口径 | 对 | 283.5 GiB = 16 × 18,144 MiB（02:625，每卡 42 层 × 432 MiB）= 290,304 MiB；也等于 02:629 的 304.4 B 路由专家参数 × 1 B（304,405,807,104 B ÷ 1024³ = 283.50）。**口径只算主干 42 层的 288 个路由专家**，不含 MTP 层专家（另有 432 MiB × 16 = 6.75 GiB，02:819）、共享专家和其他权重；67 行写的是“主干的路由专家权重”，口径表述正确。64 GB 取教程标称（02:11），底稿按 64 GiB 折算（02:136），两种算法的结论都是“单卡放不下”；页面把 GiB 和 GB 写在同一句里（P3-2） |

### B. 初学者测试

只看前两屏（screen-01、screen-02，md 61–81 行），我能用一句话复述：

> EP 把 MoE 的完整专家分放到多张卡上（GLM 主干路由专家约 283.5 GiB，一张卡只有 64 GB），router 给 token 选好专家后，把 token 的 hidden 发到持有卡去算（dispatch），再送回原卡按权重相加（combine）；代价是每层这一去一回的卡间通信，以及等待其他卡。

“是什么”“为什么非拆不可”“代价在哪”都说得出来，上一轮缺的“放不下的数”已经补上。读到 63 行时会被“这些被挑选的专家叫路由专家”带偏，到 67 行看到“主干的路由专家……全部专家要常驻”才能自己纠正（P2-1）。

### C. 上一轮 6 条 P2

| 条目 | 结论 | 证据 |
|---|---|---|
| P2-1 首屏缺“放不下”的数 | 已改 | 67 行“约 283.5 GiB……A2 卡标称显存是 64 GB”，screen-01 首屏可见。余留：数放在第一节，第二节 79 行“为什么必须拆到多卡？”反而没有数，还把同一个部署页链接又放了一次（P3-1） |
| P2-2 H2 不是问题、与内容错位 | 已改 | 61 行「EP 是什么，专家怎样分到各卡？」、75 行「为什么要拆，代价是什么？」；第二节放了 dispatch/combine（77）、为什么（79）、TP 对比（81）。余留见 P3-1 |
| P2-3 直觉图没卡数、没专家分布 | 大部分已改 | 4 张卡、k=2、卡 0 是源卡也持有专家、亮灰区分、dispatch 与 combine 箭头都有（intuition.yaml:6–33，screen-01）。余留：专家没编号、各卡数量不等（P2-2） |
| P2-4 GLM 开场术语过载 | 已改 | 85 行首句是结论；87–102 行只剩 TP8/DP2/EP16、rank 与编号表；FP32 挪到 108 行，W8A8/INT8/BF16 挪到 114 行 dispatch，24 MiB 挪到 128 行，共享专家挪到 145 行，前 3 层/42 层/MTP/decode/三项权重挪到新 H2（169–175 行），MC2/AllGather 的定义挪到 179 行 |
| P2-5 场景 M 双列图位置错 | 已改 | 双列图在 244 行，属于「混入长 prefill」H3（238 行）；242 行图前解释 prepare、finalize、Nᵣ；195 行改为“场景 M 的双列流程图……放在后面的整批账里”。token 走读一节只剩 assign 图 |
| P2-6 首屏别名是代码名 | 已改 | frontmatter 第 6 行只剩「专家并行, Expert Parallel, EP」，screen-01 “也叫”一行只有这三个；脚本核对上一稿 20 个别名全部仍在正文里（428 行检索名称段，另有 319、321、402 行等），检索不受影响 |

顺带核了上一轮的 P3：正文（非代码）里 Ascend 0 处；81 行已写“tensor parallel（TP，张量并行）”；179 行说明了 AllGather 与 All-Gather 的区别；assign 图恢复引用（122 行）；“可能”只剩 216、262、368 三行，说的都是真实的不确定性；源码节以上证据角标 0 处、行内代码 0 处。

### D. 信息有没有丢

脚本比对写手留存的 `before.md`：正文数字 212 → 214 个，缺失 0；`[Cn]`/`[Sn]`/`[D]` 角标 25 → 25，集合无缺失；标题 22 → 23 个（新增「其他层与后续生成也这样算吗？」），没有删标题；图从 4 张变成 5 张（恢复 assign）。

| 内容 | 页面行 | 底稿 | 结论 |
|---|---|---|---|
| 288 个路由专家、top-8、1 个共享专家 | 79、85、104–110、145、171 | 02:753（288、top-8）、715（共享专家）；上一轮已核 02:30、572 | 在，一致；但“288 选 8 + 1 共享”不再集中交代，到 171 行才合成一句 |
| EP16、每卡 18 个、17.72 GiB | 85、87、102、175 | 02:615、625 | 在，一致 |
| MC2 容量 128 | 181 | 02:651、654 | 在，一致 |
| ≤55.1 MiB、6.09 GiB、约 113 倍 | 222、255–256、278、287、289 | 02:904、914、891、915、916 | 在，一致 |
| A2 上只在 MC2 与 AllGather 之间二选一 | 179、418 | 02:637–642 | 在，一致 |
| dummy run | 210、214 | 02:938 | 在；见 P3-4 |
| 场景 M | 183（定义）、218（H2）、220 | — | 在，单独成节 |

对照源码 5 个 H3：怎么开 317、会报什么错 351、开销和什么时候别开 366、版本差异 398、源码位置 424，顺序正确，其后没有 H2。版本差异表（404–416 行）覆盖 v0.23、v0.26、main。

### E. 链接

页内 29 个链接（5 个本页锚点、1 个外链、1 个 sources 相对链接，其余为跨页）全部能解析，失效 0。指向 tensor-parallel 的两处：81 行链到页首；145 行 `tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道` 对应第四轮后的 tensor-parallel.md:263「### 稠密 MLP 与共享专家：每卡各留一段通道」，有效。反向：全库只有 tensor-parallel.md:136 带锚点链到本页（`#放到-glm-双机一个-token-走过一层-moe`），对应本页 83 行，有效。外链本轮没有联网复测（上一轮返回 200）。

### F. 评分与问题

**8 / 10**。上一轮 6 条 P2 全部落实，首屏现在能回答“是什么、为什么、代价”。扣分：63 行把“路由专家”定义成“被挑选的专家”，和后文用法矛盾（−1）；直觉图的专家没有编号、各卡数量不等（−1）。

**P1：无。** EP 定义、整份分卡、router 选 k、dispatch/combine、共享专家走 TP8 都讲对了。P2-1 是一个辅助术语的定义句写错，EP 机制本身没错，后文用法也能纠正，所以记 P2；如果按“术语定义错也算核心概念讲错”的更严口径，它应升为 P1，请主会话定夺。

| 级别 | 位置 | 问题 | 改法 |
|---|---|---|---|
| P2-1 | 63 | “这些被挑选的专家叫路由专家”把路由专家定义成“本次被选中的那几个”；67、79、85 行的“288 个路由专家”“每卡 18 个完整路由专家”指的是全部可被 router 挑选的专家，定义与用法矛盾。前两屏也没提共享专家，看不出 EP 只分路由专家 | 改成类似：“router 从中挑选的这批专家叫**路由专家**（GLM 每层 288 个，每个 token 选 8 个）；另有所有 token 都要经过的**共享专家**，它不参与 EP，见后文。”这样 A1、A3、A5 在首屏就能对上 |
| P2-2 | 69–73；intuition.yaml:11–23 | 直觉图看不出“每卡放了哪些专家”：格子全写“完整专家”，没有编号；卡 0/1/2 各 2 个、卡 3 有 4 个，和 EP16 均分（85、264 行）不一致，初学者会以为专家分得不均。图旁也没说 GLM 实际是 16 张卡、k=8 | 画 8 个专家 E0–E7，每卡 2 个（卡 0：E0–E1……卡 3：E6–E7），亮色标 token 选中的两个（例如 E3、E4），卡 3 与其他卡格数相同。73 行补一句“GLM 实际是 16 张卡、每卡 18 个专家、每个 token 选 8 个，放法见下方 rank 表” |
| P3-1 | 67、79 | “放不下”讲了两遍，同一个部署页链接出现两次；数在第一节，第二节 79 行“为什么必须拆到多卡？”反而没有数；第二节标题先问“为什么”，正文先讲“代价” | 把 67 行的数并进 79 行并删掉 67 行；或者 79 行只讲“为什么要常驻”，删掉重复链接。第二节把 79 行挪到 77 行前面 |
| P3-2 | 67 | 283.5 GiB 与 64 GB 单位混写；首屏的“主干”没解释 | 写成“64 GB（本库按 64 GiB 折算，见部署页）”，或直接说“约等于 4.4 张卡的全部显存”；“主干”改成“42 个 MoE 层” |
| P3-3 | 73；intuition.yaml:3 | 图注和 73 行正文几乎逐句重复（4 张卡、每卡一部分完整专家、亮色/灰色） | 73 行只留图注没说的内容：k 的含义、hidden 是什么、权重不动 |
| P3-4 | 214 | 页面把“dummy run 时 DP1 仍为 DP0 做真实专家计算”写成确定事实；底稿 02:940 和 concurrent-requests.md:406 仍把 `_dummy_run` 的层内分支列为待核。按集合通信要求全员到场的道理，页面的说法很可能对，但三处口径不一致 | 在 214 行附一句依据（EP16 集合通信要全员参与，缺一方就会卡住），或者链到 concurrent-requests 的待核；最好先由底稿关掉这条待核 |

### 未核

1. 没有自起浏览器复测，直接看写手的 screen-01～03；视口、越界、图宽等以写手的 `browser-check.json` 为准，本轮没有复核。
2. 源码行号没有逐行重核：角标集合与上一稿完全一致，`wiki:audit` 本轮自己重跑，行号越界 0。
3. `check:content` 没有重跑，用的是写手 `validation.txt` 里的结果。
4. 官方教程外链本轮没有联网复测。

## 十七、第五轮修订记录（09-28）

本轮按用户指定的 P1 / P2 小修，修正候选专家与本次选中专家的混淆，并使直觉图的专家数量、编号与均分含义一致。

### 修改与范围

- `wiki/concepts/expert-parallel.md:63`：路由专家定义为经过 router 打分才可能被选中的专家；集中写清 GLM-5.3-Flash 每个 MoE 层有 288 个路由专家，每个 token 选 8 个（top-8），另有 1 个不经过 router、每个 token 都使用的共享专家，且共享专家不参与 EP。
- 全页核对「路由专家」「被选中的专家」「共享专家」及其变体。第 197 行进一步明确为「8 个被选中的路由专家输出加权」，与第 85、110、145、171、309、337 行的候选集合、选中子集和共享分支用法一致。
- 第 73 行补充「这里用 k=2 做示意，GLM 实际是 k=8」。其余正文不动。
- `wiki/diagrams/expert-parallel-intuition.yaml`：卡 0 放 E0、E1；卡 1 放 E2、E3；卡 2 放 E4、E5；卡 3 放 E6、E7。每卡都是 2 个完整路由专家，亮色选中 E3、E4；保留 token 发出、专家计算和结果返回的路径。画布保持 **900×370**，仅重新生成这张图的 SVG。
- 与本轮留存的 `before.md` 按行比较，正文只有 **63、73、197** 三行变化，其他行相同；原有数字逐行计数无缺失，既有算例、来源和链接未改。除本页、该图 YAML / SVG 和本报告追加记录外，未修改其他项目文件；未改 tensor-parallel、src/、tests/，未做 git 提交。

### 验证证据

命令使用同一 pnpm 安装的 `pnpm.cmd` 入口，输出保存在本轮截图目录：

| 命令 | 结果 |
| --- | --- |
| `pnpm wiki:lint` | 退出码 0；22 处非阻塞提示，本页无提示 |
| `pnpm check:content` | 退出码 0；registry 131 页，尚无章节，Term 引用检查按脚本跳过 |
| `pnpm wiki:diagrams --check` | 最终退出码 0；154 张图与 spec 一致，36 处非阻塞提示均不在本页图中 |
| `pnpm wiki:audit` | 退出码 0；131 页、1478 条来源，行号有效 1393，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0 |

生成 SVG 前的 diagrams 检查曾报告本图与 spec 不一致；通过仓库 `loadDiagrams` 解析默认值、仅渲染本图后重跑通过。本页及图的 `git diff --check` 通过。`content-check.json` 记录每卡专家数为 `[2,2,2,2]`、E0–E7 无重复、原数字保留及正文三行差异。

浏览器在 **4175** 端口使用 Playwright Chromium、**1440×900** 视口，保存并逐张查看 `screen-01.png`、`screen-02.png`。正文滚动 800px 后截第二屏，首屏完整显示直觉图，第二屏显示 k=2 / k=8 说明与通信代价。实际 SVG 宽 900px、文档宽 1440px、正文右侧越界元素 0、pageErrors 0。浏览器拦截 `/api/` 请求并使用本地快照，未连接 8790；未操作 5193。截图后关闭本轮 Vite 服务，4175 连接返回 **ECONNREFUSED**，见 `service-closed.json`。

截图与命令输出目录：

`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p4-r5\expert-parallel\`

### 自查与限制

- 第一张图仍在 69 行，图前 0 个 calc；本轮按要求前置 288 / 8 / 1 的定义，原容量数字保持不变。
- 按第 61–314 行正文字符计，14,347 字符、2 个 calc（约 0.14 个 / 千字符）；行内代码 0、源码节以上证据角标 0。
- 前两屏的初学者复述：EP 把完整路由专家均分到卡上，token 找到被选中的专家计算，再收回结果加权；省每卡权重空间，代价是每层输入和结果的通信及等待，共享专家则每个 token 都使用。
- 本轮只修用户指定问题，沿用其余已审内容；未重新审查版本语义或实测 NPU。audit 的 URL 85 条未联网验证、raw 摘录 1219 条待核对仍是该检查的范围限制。
- 待用户决定的问题：无。
