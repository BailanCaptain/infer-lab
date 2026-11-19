---
id: moe-comm-dispatch
title: MoE 通信调度状态机与运行期权重重切分：AllGather / MC2 / Fused MC2 / MegaMoe / AllToAll 与 WeightSwitchMixin
type: concept
origin: direct
summary: >-
  vllm-ascend v0.30.0 将四族昇腾硬件的 MoE 通信收拢进 HardwareProfile 与 select_moe_comm_method 状态机，依动态 mc2_tokens_capacity 切换 AllGather / MC2 / MegaMoe / AllToAll，并以 WeightSwitchMixin 实现运行期权重零拷贝重切分。
aliases:
  - MoE 通信状态机
  - MoECommType
  - MoECommPolicy
  - select_moe_comm_method
  - MC2
  - Fused MC2
  - FUSED_MC2
  - MegaMoe
  - CANN_MEGAMOE
  - mc2_tokens_capacity
  - set_mc2_tokens_capacity
  - WeightSwitchMixin
  - OProjWeightSwitchMixin
  - 运行期权重重切分
chapters:
  - '14'
order: 35
sources:
  - 'https://arxiv.org/abs/2412.19437'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/large_scale_ep.md#L1-L30'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L279-L383'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L27-L98'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L239-L371'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L373-L426'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/moe_comm_method.py#L211-L323'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4336-L4346'
  - 'vllm-ascend@c09d3e20:vllm_ascend/weight_switch/linear.py#L146-L285'
  - 'vllm-ascend@c09d3e20:vllm_ascend/weight_switch/linear.py#L446-L565'
  - 'vllm-ascend@c09d3e20:vllm_ascend/weight_switch/o_proj.py#L13-L80'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L303-L355'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L451-L512'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L378-L412'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: expert-parallel
    kind: builds-on
    note: 先掌握专家并行中路由专家跨卡分散与 Dispatch/Combine 的基本逻辑，再看不同硬件与批长下的选路状态机
  - to: hccl-buffer
    kind: builds-on
    note: 常规 MC2 占用 HCCL_BUFFSIZE 通信缓冲，而 MegaMoe 改走独立对称内存缓冲 symm buffer
  - to: large-scale-ep
    kind: variant-of
    note: 跨机大规模 EP 部署中，MC2、MegaMoe 与 AllToAll 的切换直接决定 Prefill 与 Decode 两阶段吞吐
  - to: one-request
    kind: alternative-to
    note: 历史 GLM-5.3-Flash 双机算例中的固定 MC2 容量门槛 128 推导见该页单一出处，本页聚焦 v0.30.0 动态容量体系
contradicts: []
updated: '2026-11-19'
---

**MoE 通信调度状态机是推理引擎在每次进入 MoE 层前自动“挑路”的决策组件**：它会按当前昇腾芯片型号、专家并行卡数和这一步要算多少个 token，实时在四类卡间通信与融合算子之间切换，让小批低延迟和大批高吞吐都能走最快的通路；配套的**运行期权重动态重切分（`WeightSwitchMixin`）**则让部分线性层平时只存 $1/N$ 权重省显存、算到时再异步拼齐并原地切换视图。

理解了[专家并行（EP）](expert-parallel.md)“选专家 → Dispatch 发往持有卡 → 本地算 FFN → Combine 传回源卡”之后，很快就会遇到一个现实困惑：**同一台昇腾机器跑同一个 MoE 模型（如 `Qwen3-30B-A3B`），为什么 Decode 小批走 `MC2` 或融合算子极快，到了 Prefill 大批却自动切走？不同卡型（A2、A3、310P、950DT）为什么走的路完全不一样？** 答案全部收拢在 `v0.30.0` 新抽象出的硬件档案（`HardwareProfile`）与选路函数（`select_moe_comm_method`）里。

## 四类 MoE 通信实现各自做什么？

| 通信模式（`MoECommType`） | 底层核心算子与实现类 | 通信与计算关系 | 典型适用场景 |
|---|---|---|---|
| **`ALLGATHER`** | `AllGatherCommImpl`：`All-Gather` 汇聚全批 token + `npu_moe_init_routing_v2` / `npu_moe_token_unpermute` | 先广播整批，再各自过滤本卡专家，尾部规约 | `EP=1`、`310P` 兼容硬件、A2 非 MC2 场景，或 `world_size <= top_k` 的小集群 |
| **`ALLTOALL`** | `AlltoAllCommImpl`：`TokenDispatcherWithAll2AllV` 变长点对点 `All-to-All-v` + `npu_grouped_matmul` | 仅把每个 token 发给被选中的目标专家卡，免全量复制 | A3 / 950DT 大批 Prefill（超出 `mc2_tokens_capacity`）及 **LoRA + EP 强制路径** |
| **`MC2`** | `MC2CommImpl`：`npu_moe_distribute_dispatch` + 分组矩阵乘 + `npu_moe_distribute_combine` | 把 Dispatch/Combine 通信与片上核调度紧耦合，大幅压低小包同步时延 | **小批 Decode 主力**（占用 `HCCL_BUFFSIZE` 缓冲，见 [HCCL buffer](hccl-buffer.md)） |
| **`FUSED_MC2` / `MegaMoe`** | `FusedMC2CommImpl`：旧融合算子 `dispatch_ffn_combine`（A3 `EP ≤ 32`）或新一代 **`CANN MegaMoe`**（A3 / 950DT `1 < EP ≤ 64`） | 将 Dispatch、门控上投影、SwiGLU 激活、下投影与 Combine 揉进单一超级算子，支持通信计算深度流水重叠 | A3 与 950DT 开启 `enable_fused_mc2=1` 时的高吞吐主力；**MegaMoe 走独立对称内存 `symm buffer`，不吃 `HCCL_BUFFSIZE`** |

## 一笔直觉账：为什么小批选 `MC2`，大批切 `AllToAll`？

先用一组**示意数**算清小批 Decode 和大批 Prefill 的根本差别：假设一台 16 逻辑设备的 Atlas A3 集群运行 `EP = 16`（`Qwen3-30B-A3B` 口径：每 token 激活 `top_k = 8` 个专家，隐藏维 `H = 2048`、BF16 占 `4 KiB/token`；常规 `MC2` 每卡缓冲上限 `L_rank = 512` token）。

$$\text{单卡 AllGather 接收总量} = \text{EP} \times B_{\text{rank}} \times H \times 2\text{ B}, \qquad \text{单卡 AllToAll 发出总量} \le \text{top\_k} \times B_{\text{rank}} \times H \times 2\text{ B}$$

| 场景（`EP = 16`，`top_k = 8`，`4 KiB/token`，示意） | 每卡输入 $B_{\text{rank}}$ | `AllGather` 每卡汇聚整批 | `AllToAll` 每卡只发命中专家 | 状态机选路与直觉原因 |
| --- | --- | --- | --- | --- |
| **小批 Decode** | **`8` token/卡**<br>（全组 128 token） | `128 × 4 KiB = 512 KiB` | 至多 `8 × 8 × 4 KiB = 256 KiB` | 数据量极小、瓶颈在多次核间同步与小包启动时延；`8 ≤ 512` 装得进片上/通信缓冲，走 **`MC2`**（或 **`FUSED_MC2`**）把通信与算子紧耦合最快 |
| **大批 Prefill（未开 MegaMoe）** | **`2,048` token/卡**<br>（全组 32,768 token） | `32,768 × 4 KiB = 128 MiB`<br>（广播全组，大量无用 token） | 至多 `2,048 × 8 × 4 KiB = 64 MiB`<br>（只发去命中的专家卡） | `2,048 > 512` 超出常规 `MC2` 每卡 `HCCL_BUFFSIZE` 上限；大批下带宽占主导，自动切 **`ALLTOALL`** 免去无用广播、流量立省一半以上 |
| **大批 Prefill（开启 `CANN MegaMoe`）** | **`2,048` token/卡** | — | — | `MegaMoe` 改用独立对称内存 `symm buffer`，每卡上限拉高到 `16,384` token（`2,048 ≤ 16,384`），连大 Prefill 也能留在 **`FUSED_MC2`** 融合流水线内 |

反过来，如果集群极小（例如昇腾 950 上 `world_size <= top_k`，比如 4 张卡却要选 8 个专家），几乎每个 token 的路由目标都覆盖全部卡，`AllToAll` 反而失去了“少发”的优势，因此 950 策略在超限后会回退到 **`ALLGATHER`**。看懂这三笔账，下面四族硬件的状态机分支就一目了然。

## 四族硬件调度状态机：`hardware_profile.py` + `ascend_forward_context.py`

在 `v0.30.0` 中，`vllm-ascend` 不再在调度函数里到处写 `if soc == A2 / A3 / A5` 硬编码，而是由 `HardwareProfile` 为四族昇腾硬件各自绑定一套 `MoECommPolicy` 策略枚举，再由 `select_moe_comm_method` 按两道全局闸门和四条策略分支实时裁决：

```wiki-diagram
file: moe-dispatch-fig-state-machine
```

梳理四族硬件在 `EP > 1` 且未开 LoRA 时的完整分支条件：

1. **两道全局前置闸门（高于一切硬件策略）**：
   - 未开 EP 或 `ep_world_size == 1` → 一律走 **`ALLGATHER`**；
   - 开启 LoRA 且启用 EP → 一律强制走 **`ALLTOALL`**（因为 `dispatch_ffn_combine` / `MegaMoe` 是整块融合 C++ 算子，昇腾 MoE LoRA 无法在其内部插桩）。
2. **Atlas A2（`CAPACITY_AND_EXPERT_DENSITY`）**：只有同时满足“每卡专家数 $\le 24$”、“`ep_world_size >= 16`”且“`num_tokens <= mc2_tokens_capacity`”三个条件才走 **`MC2`**；任一不满足即回落 **`ALLGATHER`**（A2 在该策略下不切 `ALLTOALL`，也不具备 `CANN_MEGAMOE` 能力）。
3. **Atlas A3（`FUSED_OR_CAPACITY`）**：优先检查 `use_cann_megamoe`（需 `enable_fused_mc2 == 1`、`1 < EP <= 64` 且无 LoRA）或旧融合路径（`enable_fused_mc2 == 1` 且 `EP <= 32`），命中即走 **`FUSED_MC2`**；否则批长未超 `mc2_tokens_capacity` 走 **`MC2`**，超限则自动切 **`ALLTOALL`**。
4. **昇腾 950 / A5（`CAPACITY_AND_WORLD_SIZE`）**：开启 `enable_fused_mc2 == 1` 且硬件支持 MegaMoe 时走 **`FUSED_MC2`**（但遇到投机解码 MTP 草稿层且其量化格式不在 `A5_SUPPORT_MEGA_MOE_QUANT_TYPES` 内时，会自动跳过 `FUSED_MC2` 落入下方分支）；否则批长未超限且 `world_size > 1` 走 **`MC2`**；超限后若 `world_size <= num_experts_per_tok`（全员都会收到大部分 token，广播反而更省）则走 **`ALLGATHER`**，否则走 **`ALLTOALL`**。
5. **Atlas 310P（`ALLGATHER`）**：兼容硬件族，固定走 `AllGatherCommImpl310`。

## 动态 `mc2_tokens_capacity` 怎样算，为什么会多跑一次 profile dummy run？

早期历史文档（如例外 B 的 [GLM-5.3-Flash 双机算例](one-request.md)）中常见“MC2 固定门槛 128”的印象；而在 `v0.30.0` 中，门槛已升级为在引擎初始化阶段由 `set_mc2_tokens_capacity` 按并行配置与算子上限动态计算：

$$T_{\text{cap}} = \min\!\left(\left\lceil \frac{T_{\text{max}}}{\text{TP}} \right\rceil,\; L_{\text{rank}}\right) \times \text{TP}$$

其中 $T_{\text{max}}$ 的取值分三档：若开启 `enable_prefill_mc2` 或在非纯 D 节点启用 `MegaMoe`，则取 `max_num_batched_tokens`；否则若有图捕获尺寸列表则取 `max_cudagraph_capture_size`；再否则取 `max_num_reqs * uniform_decode_query_len`。每卡上限常量 $L_{\text{rank}}$ 随算子而异：

- **常规 `MC2` 与旧 `dispatch_ffn_combine`**：$L_{\text{rank}} = 512$（例如 `TP=8` 时，单实例上限 $T_{\text{cap}} = 512 \times 8 = 4096$ token）；
- **`CANN MegaMoe`**：$L_{\text{rank}} = 16384$（`TP=8` 时理论上限高达 $16384 \times 8 = 131072$ token，借助独立 `symm buffer` 直接覆盖长上下文 Prefill 批）。

**一个隐蔽的冷启动显存保护机制**：当 `self.max_num_tokens > mc2_tokens_capacity` 时，常规最大批 `profile_run` 会走 `ALLTOALL` 或 `ALLGATHER`，根本触发不到 `MC2 / FUSED_MC2` 所需的缓冲分配！为此，`model_runner_v1` 与 `worker/v2/model_runner` 在显存摸底阶段会专门检查：如果 `mc2_tokens_capacity` 落入 `{MC2, FUSED_MC2}`，就**额外补跑一次批长为 `mc2_tokens_capacity` 的 `_dummy_run(..., is_profile=True)`**，提前把 MC2 / MegaMoe 运行期临时缓冲计入显存峰值，防止线上进入 Decode 阶段突然 OOM。

## `WeightSwitchMixin`：运行期权重动态重切分

在长上下文并行（如 `PCP`）或混合注意力/MoE 协同部署里，某些稠密投影层（典型如注意力的 `o_proj`）面临一对尖锐矛盾：按大并行域切分可大幅节省每卡静态权重显存，可前向计算某一阶段又需要完整权重来做全维矩阵乘。`vllm-ascend v0.30.0` 为此抽象出 **`WeightSwitchMixin`**（`vllm_ascend/weight_switch/linear.py`）及其 `o_proj` 专用封装 **`OProjWeightSwitchMixin`**：

```wiki-diagram
file: moe-dispatch-fig-weight-switch
```

这套机制把权重省显存和计算零拷贝结合成四步闭环：

1. **加载期二次切分**：`_prepare_layer_for_nested_weight_load` 在权重加载前把目标轴（`input` 或 `output`，要求至多存在 1 条既有切分轴且可被 `world_size` 整除）进一步切出 $1/N$ 本地常驻分片 `local_tensor`，同时保持该层原有前向通信组不变；
2. **显式声明量化元数据规约**：接入的量化线性方法须显式置 `supports_weight_switch = True`，并声明两张清单——跨卡拼接清单 `weight_switch_gather_specs`（权重本体与逐通道量化 scale）和本地复制清单 `weight_switch_repeat_specs`（各卡同值的元数据）；
3. **跨层共享内存池 + 异步拉齐**：`enable_weight_switch` 按 `(prefix, attr, device, dtype, dim, full_shape)` 在共享 `pool` 中复用同一块全量目标缓冲区，避免每一层都私占一份全量权重显存；计算前调用 `all_gather_weight` 异步发起 `all_gather_async`，与前置算子重叠；
4. **零拷贝视图切换与自动归位**：进入 `_use_full_o_proj_weights()` 上下文时，先 `wait_weight_all_gather` 再对每个属性执行 `getattr(layer, attr_name).set_(full_tensor)` 原地改指底层存储；退出 `finally` 块后立刻 `set_(local_tensor)` 切回本地分片。

## 常见误解

- **「MoE 模型开了 `enable_expert_parallel` 就一定会走 `MC2`？」**：错。在 A2 上还要求每卡专家数 $\le 24$、`EP \ge 16$ 且当前批 token 数不超过 `mc2_tokens_capacity`；在 310P 上恒走 `ALLGATHER`；任何硬件一旦叠加 LoRA + EP 都会被全局闸门强制切到 `ALLTOALL`。
- **「开了 `CANN MegaMoe` 也要把 `HCCL_BUFFSIZE` 调得极大？」**：错。常规 `MC2` 消耗 `HCCL_BUFFSIZE`（且每卡上限 `512` token），而 `MegaMoe` 走的是独立 Torch 分配的对称内存 `symm buffer`，每卡上限放宽到 `16,384` token，不依赖扩大 `HCCL_BUFFSIZE`。
- **「`WeightSwitchMixin` 每次切全量权重都会重新 `malloc` 并搬一份新显存，会导致严重碎片？」**：错。`enable_weight_switch` 通过跨层复用的 `pool` 字典缓存全量目标张量，并在 `switch_weight` 中用 `tensor.set_()` 原地切换视图指针，退出上下文后即刻释放逻辑占用供下一层复用。
- **「950DT（A5）开了 `enable_fused_mc2=1`，主模型和 MTP 草稿层一定都会走 `MegaMoe`？」**：错。`A5` 的选择器专门拦截了不兼容量化格式的 MTP 草稿层（`is_draft_model and draft_moe_quant_type not in A5_SUPPORT_MEGA_MOE_QUANT_TYPES`），会让草稿层平滑落回 `MC2 / ALLGATHER / ALLTOALL` 而不报错崩溃。

## 对照源码

### 怎么开

- **常规 EP 与 `FUSED_MC2 / MegaMoe` 启用**：启动 MoE 模型时开启 `--enable-expert-parallel`；在 A3 或 950DT（A5）上，可通过 `--additional-config '{"enable_fused_mc2": 1}'` 启用融合 `FUSED_MC2` / `CANN MegaMoe` 通路（需满足 `1 < EP <= 64` 且未开启 LoRA）；若希望常规 `MC2` 也覆盖大 Prefill 批，可按需开启 `enable_prefill_mc2` 并同步核算 `HCCL_BUFFSIZE`。
- **运行期权重重切分**：面向 `PCP` 等需要二次静态权重切分的部署，由对应模型/注意力后端通过 `OProjWeightSwitchMixin` 与 `WeightSwitchConfig` 按配置开关（如 `enable_pcp_o_proj_weight_sharding`）自动接入，无需手工调用底层 `switch_weight`。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `WeightSwitchMixin._get_weight_switch_specs` | 目标线性层同时在 `input` 与 `output` 两条轴上已切分 | 抛出 `RuntimeError: Weight switching requires a linear layer with at most one pre-existing sharded axis` |
| `WeightSwitchMixin.split_tensor_for_parallel` | 切分维长度不能被并行域 `world_size` 整除 | 抛出 `RuntimeError: Cannot split tensor because the target dimension is not divisible...` |
| `WeightSwitchMixin.all_gather_weight` | 上一轮异步 `state.handles` 尚未 `wait` 就重入发起新一轮拉齐 | 抛出 `RuntimeError: Weight all-gather is still pending; wait before launching another one.` |
| `select_moe_comm_method` | 开启 LoRA + EP | 不报错，由全局闸门静默强制切到 `MoECommType.ALLTOALL` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 硬件路由组织方式 | `select_moe_comm_method` 直接按 `soc_version == A2/A3/A5/_310P` 分支硬编码，尚无 LoRA+EP 闸门 | 新增 LoRA+EP 强走 `ALLTOALL` 闸门，仍按 `soc_version` 分支调度 | **架构重构**：引入 `HardwareProfile` 与四套 `MoECommPolicy` 枚举策略表，新增 A3/A5 `CANN_MEGAMOE`（每卡 `16384` 上限）及 A5 草稿量化回退 | 延续 `HardwareProfile` 策略表；**修复 A5 分支缺陷**——将 `world_size_across_dp` 改为除以 `pipeline_parallel_size` 得到真实 `ep_world_size`，避免 PP 干扰选路 |
| `WeightSwitchMixin` 运行期权重重切分 | 不存在 | 不存在 | **正式新增** `vllm_ascend/weight_switch/{linear,o_proj}.py`，支持 `gather/repeat` 双规约与共享 `pool` 零拷贝视图切换 | 完整保留并继续支持量化线性层接入 |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法参考、官方指南与推导**：大规模 MoE 专家并行 Dispatch/Combine 通信计算重叠设计背景见 DeepSeek-V3 论文 [S1]；昇腾大规模 EP 部署形态与 `MC2 / AllToAll` 角色见 `large_scale_ep.md` [S2]。文中动态门槛公式 $T_{\text{cap}}$ 在 `TP=8` 下的 `4,096` 与 `131,072` 算例由源码常量直接推导 [D]。
- **四族硬件档案与调度状态机**：`A2 / A3 / _310P / A5` 各自绑定的 `MoECommPolicy` 与 `CANN_MEGAMOE` 能力集见 `hardware_profile.py:279-383` [C3]；`MoECommType` 枚举、三档 per-rank 上限常量（`16384 / 512 / 512`）与 `use_cann_megamoe` 见 `ascend_forward_context.py:27-98` [C4]；`set_mc2_tokens_capacity` 及三套策略选择器函数见 `ascend_forward_context.py:239-371` [C5]；`select_moe_comm_method` 全局闸门与分派主入口见 `ascend_forward_context.py:373-426` [C6]。
- **四类通信实现与冷启动显存保护**：`AllGatherCommImpl`、`MC2CommImpl`、`AlltoAllCommImpl` 与 `FusedMC2CommImpl`（加载 MegaMoe 对称内存算子）见 `moe_comm_method.py:211-323` [C7]；冷启动额外补跑 `mc2_tokens_capacity` 摸底见 `model_runner_v1.py:4336-4346` [C8]。
- **`WeightSwitchMixin` 与跨版本演进**：`WeightSwitchMixin` 规约声明与二次切分准备见 `weight_switch/linear.py:146-285` [C9]，共享 `pool`、异步 `all_gather_weight` 与 `tensor.set_` 零拷贝切换见同文件 `446-565` 行 [C10]，`OProjWeightSwitchMixin` 上下文管理见 `weight_switch/o_proj.py:13-80` [C11]；`v0.23.0`、`v0.26.0rc` 旧硬编码分流及 `main` 修复 A5 `ep_world_size` 剔除 `pipeline_parallel_size` 见三分支 `ascend_forward_context.py` [C12][C13][C14]；经树核验 `hardware_profile.py` 与 `weight_switch/` 均自 `v0.30.0` 引入 [D]。
