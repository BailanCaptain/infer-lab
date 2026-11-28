---
id: moe-comm-dispatch
title: MoE 通信调度状态机与运行期权重重切分：AllGather / MC2 / Fused MC2 / MegaMoe / AllToAll 与 WeightSwitchMixin
type: concept
origin: direct
summary: >-
  vllm-ascend v0.30.0 将四族昇腾硬件的 MoE 通信收拢进 HardwareProfile 与 select_moe_comm_method 状态机，依动态 mc2_tokens_capacity 切换 AllGather / MC2 / MegaMoe / AllToAll，并以 WeightSwitchMixin 实现运行期权重零拷贝重切分。
aliases:
  - MoE 通信状态机
  - MoE 通信派发
  - MoECommType
  - MoECommPolicy
  - select_moe_comm_method
  - AllGather
  - AllToAll
  - MC2
  - Fused MC2
  - FUSED_MC2
  - MegaMoe
  - CANN_MEGAMOE
  - symm buffer
  - dispatch_ffn_combine
  - DispatchFFNCombine
  - npu_moe_distribute_dispatch
  - npu_moe_distribute_combine
  - MoeDistributeDispatch
  - MoeDistributeCombine
  - MoeDistributeDispatchV2
  - MoeDistributeCombineV2
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/token_dispatcher.py#L153-L234'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/token_dispatcher.py#L327-L333'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/moe_comm_method.py#L580-L606'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L660-L671'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L840-L860'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L995-L1007'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1050-L1161'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L770-L790'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L84-L87'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/token_dispatcher.py#L440-L645'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L738-L749'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L160-L170'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: hardware-devices
    kind: builds-on
    note: 四族昇腾芯片（A2/A3/310P/950DT）的硬件能力画像直接决定可选的 MoE 通信策略枚举
  - to: collective-communication
    kind: builds-on
    note: 先掌握 All-Gather、All-to-All 与 MC2 的数据交换语义与传输量差异
  - to: data-parallel
    kind: builds-on
    note: 多 DP 组步宽对齐与是否开启跨 DP 专家并行直接触发不同的派发策略与缓冲约束
  - to: expert-parallel
    kind: builds-on
    note: 先掌握专家并行中路由专家跨卡分散与 Dispatch/Combine 的基本逻辑，再看不同硬件与批长下的选路状态机
  - to: expert-parallel
    kind: variant-of
    note: 在基础 EP Dispatch/Combine 之上，按硬件画像与每步批长动态切换 AllGather / AllToAll / MC2 / MegaMoe 四条通路，并辅以 WeightSwitchMixin 运行期权重重切分
  - to: hccl-buffer
    kind: builds-on
    note: 常规 MC2 与融合 DispatchFFNCombine 的容量上限受 HCCL_BUFFSIZE 约束，而新一代 CANN MegaMoe 改走独立对称内存 symm buffer
  - to: large-scale-ep
    kind: builds-on
    note: 多机大规模 EP 的跨机分层通信、全组按 max(tokens) 选路与跳过 DP 同步守卫都直接受本页状态机裁决
contradicts: []
updated: '2026-11-24'
---

**MoE 通信调度状态机（`select_moe_comm_method`）是推理引擎进入 MoE 层前按硬件、配置和本步 token 数选择分发路径的决策组件。** 它根据昇腾芯片族、专家并行规模以及本步批长与适配开关，在 `ALLGATHER`、`MC2`、`FUSED_MC2 / MegaMoe` 和 `ALLTOALL` 四条路径之间切换，解决“小批延迟卡同步、大批吞吐卡带宽”的矛盾。

## 先用 4 张卡看懂：MoE 通信在发什么、为什么会选不同的路

先把两个基本词立住（概念详见[专家并行（EP）](expert-parallel.md#ep-怎么做4-个-token-走一遍)）：**路由专家（routed experts）**指一整层里所有可供门控网络（router）挑选的专家全集；**共享专家（shared expert）**则不参与挑选，每个 token 都会经过它。

用一个**4 卡小算例**走完一次分发与收回：假设整层共 `8` 个路由专家（`E0..E7`），按专家并行（EP）平均分到 `4` 张卡上（卡 0 放 `E0, E1`，卡 1 放 `E2, E3`，卡 2 放 `E4, E5`，卡 3 放 `E6, E7`）。卡 0 上来了 `1` 个 token，router 为它挑出 `top_k = 2` 个目标专家——比如 `E3`（在卡 1）和 `E6`（在卡 3）：

1. **Dispatch（派发）**：卡 0 把这个 token 的隐藏向量分别发往卡 1 和卡 3（若挑中本卡 `E0`，就留在本地）。
2. **本地计算**：每张卡只用自己持有的专家权重，对收到的 token 做前馈网络（FFN）计算。
3. **Combine（收回）**：卡 1 和卡 3 把算出的结果传回源卡 0，卡 0 按 router 权重加权求和，拼回原来的 token 顺序。

流程只有三步，但真实推理会撞上两个截然相反的瓶颈。**Decode 阶段**每卡只有几个 token，发完再算再收的小包同步和内核启动开销占主导，最需要把“发-算-收”压进核内或融合算子（`MC2` / `FUSED_MC2`）。

**Prefill 阶段**每卡一次上千个 token，小包启动占比微乎其微，带宽与通信缓冲成了主矛盾，通常会切到只发目标专家的 `ALLTOALL`，或在满足模型门控与对称缓冲时改走 `MegaMoe`。不同昇腾芯片家族支持的算子不同，叠加低秩微调适配器（**LoRA**，挂在主权重旁的可切换小矩阵分支）时又无法插进整块融合 C++ 算子，因此引擎在每次前向之前都需要统一状态机选路；A3 与 950DT 的触发边界及后文提到的稠密层运行期权重重切分 `WeightSwitchMixin`，分别收束在下方对应小节对照。

## 四族硬件调度状态机：`hardware_profile.py` + `ascend_forward_context.py`

理解了“小批要低同步延迟、大批要省带宽/大缓冲”的动机，就能看懂 `v0.30.0` 为什么把四族昇腾硬件抽象进 `HardwareProfile` 与 `MoECommPolicy` 策略枚举，再由 `select_moe_comm_method` 按两道全局闸门和四条策略分支实时裁决：

```wiki-diagram
file: moe-dispatch-fig-state-machine
```

先看 `v0.30.0` 对 `enable_fused_mc2` 的两步预处理。配置读取期若用户传 `0` 或 `1`，`_MEGA_MOE_SUPPORTED` 置为 `False`。若传 `=2`（`main` 另支持 `=3` 融合共享专家），则按能否导入 `cann_ops_transformer` 设置 `_MEGA_MOE_SUPPORTED`，并统一将 `self.enable_fused_mc2` 规范化为 `1`。

紧接着 `derive_and_validate()` 依次校验两项规则：

- **规则 1（`MiniMaxM3` 缺包拒启）**：此拒启只看三项条件——归一化后 `enable_fused_mc2 == 1`、`is_minimax_m3` 为真且 `is_mega_moe_supported()` 为 `False`。用户传 `=1` 或传 `=2` 却缺 `cann_ops_transformer` 时均命中。常规启动经 `VllmConfig.__post_init__` 校验时外层抛出 `pydantic_core.ValidationError`（`type=assertion_error`）；直接单测 `init_ascend_config` 时见原始 `AssertionError`。传 `enable_fused_mc2=0` 不命中。
- **规则 2（模型门控不达标清零）**：仅当同时满足已传 `enable_fused_mc2=2` 激活探测且装有 `cann_ops_transformer`（即 `is_mega_moe_supported()` 为真）时，才调用 `_is_megamoe_supported_by_config(vc)`（含 `MiniMaxM3`）。不达标会把归一化后的 `enable_fused_mc2` 清零。反之若显式传 `=1`（即便装有该包，`_MEGA_MOE_SUPPORTED` 仍置 `False`），或非 `MiniMaxM3` 传 `=2` 缺包，`=1` 会保留并按硬件策略截入旧融合。

随后在每次前向时按两道前置闸门与四套硬件策略分支选路：

1. **两道全局前置闸门（高于一切硬件策略）**：
   - 未开 EP 或 `ep_world_size == 1` → 一律走 **`ALLGATHER`**（单卡判断排在 LoRA 之前，即便开 LoRA 仍走 `ALLGATHER`）。
   - 开启 LoRA（低秩适配器）、启用 EP 且 `ep_world_size > 1` → 一律强制走 **`ALLTOALL`**（融合 C++ 算子无法插桩 LoRA）。
2. **Atlas A2（`CAPACITY_AND_EXPERT_DENSITY`）**：要求每卡专家数 $\le 24$、`ep_world_size >= 16` 且 `num_tokens <= mc2_tokens_capacity`。三者同时满足才走 **`MC2`**；任一不满足即回落 **`ALLGATHER`**（A2 不切 `ALLTOALL`，也不含 `CANN_MEGAMOE`）。
3. **Atlas A3（`FUSED_OR_CAPACITY`）**：
   - **优先判 `use_cann_megamoe(vllm_config)`**：须原配置传 `=2` 且装有 `cann_ops_transformer` 使 `is_mega_moe_supported()` 为真、`enable_fused_mc2 == 1`、`1 < EP <= 64` 且无 LoRA。同时须在校验期通过非 A5 尺寸与量化门控：`hidden_size ∈ [1024, 8192]` 且被 512 整除，`moe_intermediate_size ∈ [1024, 3072]` 且被 512 整除。量化仅支持无量化（`None`）、`w8a8`、`w4a8`、`w8a8_dynamic` 或 `w4a8_dynamic`（如 `fp8` 返回 `False`）。全部命中才走 **`FUSED_MC2`**（`MegaMoe`）。如 `Qwen3-30B-A3B`（`768 < 1024`）传 `=2` 且装包时会在校验期被清零归 `0`；若直接显式传 `=1`，即便装包也不激活 `MegaMoe`，仍保留 `=1` 走下方旧融合。
   - **次判旧融合截流**：未走 `MegaMoe` 时，只要当前 `enable_fused_mc2 == 1` 且 `EP <= 32`，就绕过 `mc2_tokens_capacity` 直接走 **`FUSED_MC2`**。此处调用旧融合 `dispatch_ffn_combine`，显式传 `=1`（不论是否装包）或非 `MiniMaxM3` 传 `=2` 缺包均会命中。
   - **其余常规路径**：批长未超 `mc2_tokens_capacity` 走 **`MC2`**，超限则切 **`ALLTOALL`**。
4. **昇腾 950 / A5（`CAPACITY_AND_WORLD_SIZE`）**：
   - **选路条件**：须 `enable_fused_mc2 == 1` 且 `is_mega_moe_supported()` 为真（即传 `=2` 有包），并通过下方 **A5 独立门控**，选择器才返回 **`FUSED_MC2`**。未装该包（非 `MiniMaxM3`）或传 `=1` 均跳过 `FUSED_MC2`。MTP 草稿层若量化不在 `A5_SUPPORT_MEGA_MOE_QUANT_TYPES` 内，同样跳过融合落回下方分支。
   - **前向 `EP > 64` 分叉**：A5 选路器未限 `EP <= 64`，但前向入口按 `use_cann_megamoe(vllm_config)` 写入 `forward_context.use_mega_moe`（要求 `1 < EP <= 64`）。因此 **`EP <= 64` 时才走 `CANN MegaMoe`**；若 **`EP > 64`** 仍开融合，选路仍返回 `FUSED_MC2` 但 `use_mega_moe` 为 `False`。此时运行期跌入 `FusedMC2CommImpl` 的 `else` 分支，先校验 `w1_scale_bias` / `w2_scale_bias` 非空再调用 `dispatch_ffn_combine`。
   - **A5 独立门控（`_is_a5_megamoe_supported_by_config`）与 A3 不同**，拆成三条核对：
     - **隐藏维 `hidden_size`**：须属于 `{1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192}`（例如 `1536` 虽能整除 512，在 A5 仍被拒）。`KimiK3` 另允许 `3584`，并改读 `routed_expert_hidden_size`。
     - **专家中间维 `2 * moe_intermediate_size`**：须在 `{1024, 2048, 3072, 4096, 7168}` 内（`MiniMaxM3` / `KimiK3` 另允许 `6144`）。按此换算，`moe_intermediate_size=512` 通过，而 `768` 与 `2560` 均被拒。
     - **并行整除与 `top_k`**：要求 `ep_world_size = world_size_across_dp // pp >= 2`。同时须满足 `num_experts % ep_world_size == 0` 且 `1 <= num_top_k <= 32`。
   - **常规批长选路**：未命中上述融合分支时，若批长未超限且 `world_size > 1` 走 **`MC2`**。
   - **超限后静态启发式回退**：若 `world_size <= num_experts_per_tok` 直接走 **`ALLGATHER`**，否则走 **`ALLTOALL`**。注意源码只静态比较这两个数，不检查本步路由 ID 实际落到几张卡。
5. **Atlas 310P（`ALLGATHER`）**：兼容硬件族，固定走 `AllGatherCommImpl310`。

## 四类 MoE 通信实现各自做什么？

| 通信模式（`MoECommType`） | 底层核心算子与实现类 | 通信与计算关系 | 典型适用场景 |
|---|---|---|---|
| **`ALLGATHER`** | `AllGatherCommImpl`：`All-Gather` 汇聚全批 token + `npu_moe_init_routing_v2` / `npu_moe_token_unpermute` | 先广播整批，再各自过滤本卡专家，尾部规约 | `EP=1`、`310P` 兼容硬件或 A2 非 MC2 场景。950DT 未命中 `FUSED_MC2` 且批长超 `mc2_tokens_capacity` 时，也覆盖 `world_size <= top_k` 小集群 |
| **`ALLTOALL`** | `AlltoAllCommImpl`：`TokenDispatcherWithAll2AllV` 变长点对点 `All-to-All-v` + `npu_grouped_matmul` | 仅把每个 token 发给目标专家卡，免全量复制 | A3 大批 Prefill（未走融合且超 `mc2_tokens_capacity`）。950DT 未走融合、超限且 `world_size > top_k`（`<= top_k` 改走 `ALLGATHER`）。`ep_world_size > 1` 开 LoRA 时强制走此路（`= 1` 先走 `ALLGATHER`） |
| **`MC2`** | `MC2CommImpl`：`npu_moe_distribute_dispatch_v2` + 分组矩阵乘 + `npu_moe_distribute_combine_v2` | 把 Dispatch/Combine 通信与片上核调度紧耦合，大幅压低小包同步时延 | **小批 Decode 主力**（占用 `HCCL_BUFFSIZE` 缓冲，见 [HCCL buffer](hccl-buffer.md)） |
| **`FUSED_MC2` / `MegaMoe`** | `FusedMC2CommImpl`：`use_mega_moe` 为真（`=2`、有包、过门控且 `1 < EP <= 64`）走 **`CANN MegaMoe`**。否则走 `else` 分支调 `dispatch_ffn_combine`（A3 `=1` 且 `EP ≤ 32`，或 A5 `EP > 64`） | 将 Dispatch、门控上投影、SwiGLU 激活、下投影与 Combine 揉进单一超级算子，支持通信计算深度流水重叠 | A3 与 950DT（`EP ≤ 64`）高吞吐融合主力。A5 `EP > 64` 开融合会跌入 `else` 分支并校验 `w1_scale_bias`。**`MegaMoe` 走对称内存 `symm buffer`，不吃 `HCCL_BUFFSIZE`** |

## 一笔直觉账：为什么小批选 `MC2`，大批切 `AllToAll`？

用一组**示意数**算清小批 Decode 和大批 Prefill 的差别。假设一台 16 逻辑设备的 Atlas A3 集群按 **`TP = 1`、`DP = 16`、`EP = 16`** 运行（`Qwen3-30B-A3B` 口径）。每 token 激活 `top_k = 8` 个专家，隐藏维 `H = 2048`，BF16 占 `4 KiB/token`，未开融合即 `enable_fused_mc2 = 0`。常规 `MC2` 每卡缓冲上限 `L_rank = 512` token，因 `TP = 1` 故 `mc2_tokens_capacity = 512 × 1 = 512`。下文会说明扩至 `TP = 8` 时该容量会乘以 `8` 变 `4,096`。比较链路流量前，先把**全批拼齐缓冲**、**单阶段跨卡收发量**与**均衡路由下的组平均往返**三个口径对齐（暂略 router 分数与同目的卡副本合并）：

- **`AllGather` 路径**：拼齐后的全批缓冲为 $\text{EP} \times B_{\text{rank}} \times 4\text{ KiB}$（含本卡自有的 $1$ 份），均衡 Ring 下入口 `All-Gather` 的**单卡跨卡远端接收量与发送量**均为 $(\text{EP} - 1) \times B_{\text{rank}} \times 4\text{ KiB}$；算上出口同规模 `Reduce-Scatter`，主隐藏态**一进一出单卡发送总量**为 $2(\text{EP} - 1) \times B_{\text{rank}} \times 4\text{ KiB}$。
- **`AllToAll` 路径**：入口 `Dispatch` 按各卡本批输入 `input_splits` 外发，因此**单卡 Dispatch 发送量**有严格上界 $\text{top\_k} \times B_{\text{rank}} \times 4\text{ KiB}$（假设 `top_k` 全落远端且未合并同卡重复目的地；均匀命中扣掉本卡 $1/\text{EP}$ 份时约 $\text{top\_k}\frac{\text{EP}-1}{\text{EP}} B_{\text{rank}} \times 4\text{ KiB}$）。但出口 `Combine` 是把**本卡收到的别卡请求算完后按 `output_splits` 送回源卡**：只有路由均匀或按全组平均时，单卡 Combine 才与 Dispatch 对称、**全组平均往返上界**为 $2 \times \text{top\_k} \times B_{\text{rank}} \times 4\text{ KiB}$；一旦出现热点专家（大量 token 集中落到少数卡），热点卡的 `Combine` 发送量随实际接收量（`output_splits` 之和）放大，可能超过该均摊往返界。

$$\text{Send}_{\text{AG+RS, card}} = 2(\text{EP} - 1) B_{\text{rank}} H \cdot 2\text{ B}, \qquad \text{Send}_{\text{A2A, dispatch, card}} \le \text{top\_k}\cdot B_{\text{rank}} H \cdot 2\text{ B}, \qquad \overline{\text{Send}}_{\text{A2A round-trip, group}} \le 2\,\text{top\_k}\cdot B_{\text{rank}} H \cdot 2\text{ B}$$

| 场景（`TP = 1, DP = 16, EP = 16`，`top_k = 8`，`H = 2048`，开 `enable_prefill_mc2` 示意） | 每卡输入 $B_{\text{rank}}$ | `AllGather` 路线单卡流量（同口径发送量） | `AllToAll` 路线 Dispatch 上界与均衡往返均值 | 状态机选路与原因 |
| --- | --- | --- | --- | --- |
| **小批 Decode（`Qwen3-30B-A3B`，`enable_fused_mc2=0`）** | **`8` token/卡**<br>（全组 128 token） | 单阶段发 `480 KiB`（拼齐缓冲 `512 KiB`）；AG+RS 往返发 **`960 KiB`** | Dispatch 单卡至多发 `256 KiB`（均匀扣本卡 `240 KiB`）；均衡往返均值上界 **`512 KiB`**（热点卡 Combine 随 `output_splits` 升高） | 载荷很小、瓶颈在核间同步与小包启动时延；`8 ≤ 512` 装得进通信缓冲，走 **`MC2`** |
| **大批 Prefill（`Qwen3-30B-A3B`，`enable_fused_mc2=0`）** | **`2,048` token/卡**<br>（全组 32,768 token） | 单阶段发 `120 MiB`（拼齐缓冲 `128 MiB`）；AG+RS 往返发 **`240 MiB`** | Dispatch 单卡至多发 `64 MiB`（均匀扣本卡 `60 MiB`）；均衡往返均值上界 **`128 MiB`**（热点卡 Combine 随 `output_splits` 升高） | **`TP = 1` 时 `mc2_tokens_capacity = 512`**，未开融合且 `2,048 > 512` 切 **`ALLTOALL`** 省近半跨卡流量；若改 **`TP = 8, DP = 2, EP = 16`**（批预算 `≥ 4,096`），容量升为 `4,096` 则同批 `2,048` 仍走 **`MC2`**。若 A3（`EP=16 ≤ 32`）显式开 `enable_fused_mc2=1`，选路直接截入 **`FUSED_MC2`** |
| **大批 Prefill（满足门控的通用同维模型，配 `enable_fused_mc2=2` 开启 `CANN MegaMoe`）** | **`2,048` token/卡** | — | — | 若模型过门控且装有 `cann_ops_transformer`，改用 `symm buffer` 走 **`FUSED_MC2`**。门控要求 `[1024, 3072]` 且为 `512` 倍数，故 `Qwen3-30B-A3B`（`768`）传 `=2` 且有包时清零，在 `TP = 1` 下仍受常规 `512` 上限约束而切回 `ALLTOALL`。而通过门控并走 `MegaMoe` 的模型，在 `TP = 1` 下单卡容量上限才升至 `16,384` token（`2,048 ≤ 16,384`，走 **`FUSED_MC2`**）。若 A3 缺包或显式传 `=1`，`enable_fused_mc2` 留 `1` 并按 `EP ≤ 32` 截入旧融合 |

反过来，以昇腾 950 小集群（`world_size=4`、`top_k=8`）为例：若批长 8 token 且关融合，仍先走 **`MC2`**。若启用合格融合，即使 513 token 也先走 **`FUSED_MC2`**。只有**未命中 `FUSED_MC2`** 且批长超 `mc2_tokens_capacity`（如 513 token 关融合）时，才按 `world_size <= top_k` 静态启发式回退 **`ALLGATHER`**。源码仅静态比较这两个数，不在运行期检查选中专家实际落到几张卡上。

## 动态 `mc2_tokens_capacity` 怎样算，为什么会多跑一次 profile dummy run？

请求一步步落到 MoE 通信选路的位置见[一条请求 MoE 通信选路](one-request.md#moe-通信走-mc2-还是-allgather)；早期历史文档（如[GLM-5.3-Flash 双机算例](one-request.md#示例请求-r1-与官方双机部署)）中常见“MC2 固定门槛 128”的印象。而在 `v0.30.0` 中，门槛已升级为在引擎初始化阶段由 `set_mc2_tokens_capacity` 按并行配置与算子上限动态计算：

$$T_{\text{cap}} = \min\!\left(\left\lceil \frac{T_{\text{max}}}{\text{TP}} \right\rceil,\; L_{\text{rank}}\right) \times \text{TP}$$

其中 $T_{\text{max}}$ 的取值分三档。若开启 `enable_prefill_mc2`，或启用 `MegaMoe` 且未命中纯 D 节点判定（`_is_decode_only_node` 须同时满足 `kv_consumer` / `DecodeBenchConnector` 且开启 `recompute_scheduler_enable`），则取 `max_num_batched_tokens`。否则若有图捕获尺寸列表则取 `max_cudagraph_capture_size`；再否则取 `max_num_reqs * uniform_decode_query_len`。每卡上限常量 $L_{\text{rank}}$ 随算子而异：

- **常规 `MC2` 与旧 `dispatch_ffn_combine`**：$L_{\text{rank}} = 512$（例如 `TP=8` 时，单实例上限 $T_{\text{cap}} = 512 \times 8 = 4096$ token）；
- **`CANN MegaMoe`**：$L_{\text{rank}} = 16384$（`TP=8` 时理论上限高达 $16384 \times 8 = 131072$ token，借助独立 `symm buffer` 直接覆盖长上下文 Prefill 批）。

**一个隐蔽的冷启动显存保护机制**：当 `self.max_num_tokens > mc2_tokens_capacity` 时，常规最大批 `profile_run` 通常会走 `ALLTOALL` 或 `ALLGATHER` 而触碰不到 `MC2` 缓冲（少数例外如 A3 `EP <= 32` 开 `enable_fused_mc2=1` 时最大批与门槛同走 `FUSED_MC2`）。

为此，显存摸底阶段都不回查 `max_num_tokens` 自身命中哪一档，只直接校验容量与门槛返回值：`model_runner_v1` 比较 `self.max_num_tokens > mc2_tokens_capacity` 并传 `with_prefill=True`。`worker/v2/model_runner` 则额外检查 `mc2_tokens_capacity is not None` 并传 `skip_attn=True, skip_eplb=True`。只要二者同时满足 `select_moe_comm_method(mc2_tokens_capacity, vllm_config)` 返回 `MC2` 或 `FUSED_MC2`，就**额外补跑一次批长为 `mc2_tokens_capacity` 的 `_dummy_run(..., is_profile=True)`**，把 MC2 / MegaMoe 运行期临时缓冲提前计入显存峰值。

## `WeightSwitchMixin`：运行期权重动态重切分

在长上下文并行（如 `PCP`）或混合注意力/MoE 协同部署里，部分稠密投影层（典型如注意力的 `o_proj`）面临一对尖锐矛盾：按大并行域切分能省静态权重显存，可前向计算又需要完整权重来做全维矩阵乘。`vllm-ascend v0.30.0` 为此抽象出 **`WeightSwitchMixin`**（`vllm_ascend/weight_switch/linear.py`）及其 `o_proj` 专用封装 **`OProjWeightSwitchMixin`**：

```wiki-diagram
file: moe-dispatch-fig-weight-switch
```

这套机制把“权重省显存”与“计算零拷贝”串成四步闭环：

1. **加载期二次切分**：`_prepare_layer_for_nested_weight_load` 在权重加载前沿目标轴（`input` 或 `output`，要求至多有 1 条既有切分轴且长度可被 `world_size` 整除）再切出 $1/N$ 本地常驻分片 `local_tensor`，同时保持该层原有前向通信组不变。
2. **显式声明量化元数据规约**：接入的量化线性方法须置 `supports_weight_switch = True`，并给出两张清单——跨卡拼接清单 `weight_switch_gather_specs`（权重本体与逐通道量化 scale）与本地复制清单 `weight_switch_repeat_specs`（各卡同值的元数据）。
3. **跨层共享内存池 + 异步拉齐**：`enable_weight_switch` 按 `(prefix, attr, device, dtype, dim, full_shape)` 复用共享 `pool` 里的同一块全量目标缓冲，避免每层私占全量显存；计算前调 `all_gather_weight` 异步发起 `all_gather_async`，与前置算子重叠。
4. **零拷贝视图切换与自动归位**：进入 `_use_full_o_proj_weights()` 后先 `wait_weight_all_gather`，再对每个属性调用 `getattr(layer, attr_name).set_(full_tensor)` 原地改指底层存储；退出 `finally` 块时立刻 `set_(local_tensor)` 切回本地分片。

## 常见误解

- **「MoE 模型开了 `enable_expert_parallel` 就一定会走 `MC2`？」**：错。在 A2 上还要求每卡专家数 $\le 24$、`EP >= 16` 且当前批 token 数不超过 `mc2_tokens_capacity`；在 310P 上恒走 `ALLGATHER`；若未开 EP 或 `ep_world_size == 1`，即便叠加 LoRA 仍先命中单卡前置分支走 `ALLGATHER`，只有 `enable_expert_parallel=True` 且 `ep_world_size > 1` 时叠加 LoRA 才会被全局闸门强制切到 `ALLTOALL`。
- **「开了 `CANN MegaMoe` 也要把 `HCCL_BUFFSIZE` 调得极大？」**：错。常规 `MC2` 消耗 `HCCL_BUFFSIZE`（且每卡上限 `512` token），而 `MegaMoe` 走的是独立 Torch 分配的对称内存 `symm buffer`，每卡上限放宽到 `16,384` token，不依赖扩大 `HCCL_BUFFSIZE`。
- **「`WeightSwitchMixin` 每次切全量权重都会重新 `malloc` 并搬一份新显存，会导致严重碎片？」**：错。`enable_weight_switch` 通过跨层复用的 `pool` 字典缓存全量目标张量，并在 `switch_weight` 中用 `tensor.set_()` 原地切换视图指针，退出上下文后即刻释放逻辑占用供下一层复用。
- **「950DT（A5）配了 `enable_fused_mc2=2`，主模型和 MTP 草稿层一定都会走 `MegaMoe`？」**：错。`A5` 的选择器专门拦截了不兼容量化格式的 MTP 草稿层（`is_draft_model and draft_moe_quant_type not in A5_SUPPORT_MEGA_MOE_QUANT_TYPES`），会让草稿层平滑落回 `MC2 / ALLGATHER / ALLTOALL` 而不报错崩溃；且 `MegaMoe` 本身还要满足模型隐藏维、专家中间维与量化门控，否则回落关闭。

## 对照源码

### 怎么开

- **常规 EP 与 `FUSED_MC2 / MegaMoe` 启用**：启动 MoE 模型时开启 `--enable-expert-parallel`。注意 A3 与 950DT（A5）在 `enable_fused_mc2` 与模型门控上存在双重差异：
  - **开关、缺包回落与 `MiniMaxM3` 拒启**：
    - **Atlas A3**：设 `enable_fused_mc2=1` 会把 `_MEGA_MOE_SUPPORTED` 置为 `False`。此时在 `EP <= 32` 下改走旧 `dispatch_ffn_combine`。非 `MiniMaxM3` 模型传 `=2` 且缺 `cann_ops_transformer` 时，`self.enable_fused_mc2` 已被规范为 `1` 且不清零，在 `EP <= 32` 下仍走旧融合。仅有该包且模型不达标时才清零归 `0`。
    - **`MiniMaxM3` 拒启与清零**：传 `enable_fused_mc2=0` 可正常关闭融合启动。若传 `=1` 或传 `=2` 缺包，归一化值为 `1` 且 `is_mega_moe_supported()` 为 `False`。此时 `ascend_config.py#L846` 触发断言（经 `platform.py#L520` 与 `VllmConfig.__post_init__` 在常规启动外层抛 `pydantic_core.ValidationError` `type=assertion_error`，见来源 19）。装有该包且原配传 `=2` 时 `MiniMaxM3` 仍须过 `#L856` 门控，不达标则清零。
    - **950DT（A5）**：非 `MiniMaxM3` 传 `=1` 或缺 `cann_ops_transformer` 均跳过 `FUSED_MC2`。开融合且 **`EP > 64`** 时，因 `use_cann_megamoe()` 要求 `1 < EP <= 64`，`forward_context.use_mega_moe` 置为 `False`（来源 26）。运行期随即将跌入 `FusedMC2CommImpl` 的 `else` 分支校验 `w1_scale_bias` 并尝试调 `dispatch_ffn_combine`（来源 17）。
    - **稳定启用条件**：两类硬件启用 **`CANN MegaMoe`**，均须传 `--additional-config '{"enable_fused_mc2": 2}'`（`main` 另支持 `=3` 融合共享专家）。同时须装有 `cann_ops_transformer` 并满足 `1 < EP <= 64`。
  - **两套独立模型门控与大 Prefill `MC2`**：
    - **A3（非 A5）**：要求未开 LoRA，且 `1 < EP <= 64`。`hidden_size` 须在 `1024–8192` 且为 `512` 倍数，`moe_intermediate_size` 须在 `1024–3072` 且为 `512` 倍数（`Qwen3-30B-A3B` 为 `768` 不达标）。量化只允许无量化、`w8a8`、`w4a8`、`w8a8_dynamic` 或 `w4a8_dynamic`。
    - **A5（`_is_a5_megamoe_supported_by_config`）**：`hidden_size` 须属于 `{1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192}`（故 `1536` 被拒）。`KimiK3` 另允许 `3584` 并改读 `routed_expert_hidden_size`。`2 * moe_intermediate_size` 须属于 `{1024, 2048, 3072, 4096, 7168}`，`MiniMaxM3` 与 `KimiK3` 另含 `6144`。按此规则 `moe_intermediate_size=512` 通过，而 `768` 与 `2560` 被拒。同时须满足 `ep_world_size = world_size_across_dp // pp >= 2`。此外要求 `num_experts % ep_world_size == 0` 且 `1 <= num_top_k <= 32`。
    - **大 Prefill 常规 `MC2`**：若希望常规 `MC2` 也覆盖大 Prefill 批，可按需开启 `enable_prefill_mc2` 并同步核算 `HCCL_BUFFSIZE`。
- **运行期权重重切分**：面向 `PCP` 等二次静态权重切分部署，对应后端经 `OProjWeightSwitchMixin` 与 `WeightSwitchConfig` 自动接入。按配置开关（如 `enable_pcp_o_proj_weight_sharding`）生效，无需手工调底层 `switch_weight`。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `WeightSwitchMixin._get_weight_switch_specs` | 目标线性层同时在 `input` 与 `output` 两条轴上已切分 | 抛出 `RuntimeError: Weight switching requires a linear layer with at most one pre-existing sharded axis` |
| `WeightSwitchMixin.split_tensor_for_parallel` | 切分维长度不能被并行域 `world_size` 整除 | 抛出 `RuntimeError: Cannot split tensor because the target dimension is not divisible...` |
| `WeightSwitchMixin.all_gather_weight` | 上一轮异步 `state.handles` 尚未 `wait` 就重入发起新一轮拉齐 | 抛出 `RuntimeError: Weight all-gather is still pending; wait before launching another one.` |
| `select_moe_comm_method` | 开启 LoRA、`enable_expert_parallel=True` 且 `ep_world_size > 1` | 不报错，由全局闸门静默强制切到 `MoECommType.ALLTOALL`（若未开 EP 或 `ep_world_size == 1` 则先命中单卡分支走 `ALLGATHER`） |
| `parallel_state.py` | MC2 通信组尚未初始化即进入派发路径 | 触发断言 `mc2 group is not initialized` |
| `token_dispatcher.py#L164`（派发参数准备 `get_dispatch_mc2_kwargs`） | MC2 dispatch 参数准备阶段未提供 `expert_map`（来源 15；后续派发 `npu_moe_distribute_dispatch_v2` 见 `token_dispatcher.py#L232`，收回 `MoeDistributeCombine` / `npu_moe_distribute_combine_v2` 另见 `token_dispatcher.py#L331` 来源 16） | 抛出 `AssertionError: expert_map is required for MC2 token dispatch.` |
| `moe_comm_method.py#L591` / `dispatch_ffn_combine_tiling.cpp`（融合 `DispatchFFNCombine`） | 旧融合 MC2 算子（及 A5 `EP > 64` 因 `use_mega_moe=False` 跌入的 `else` 分支，来源 17、26）的 `HCCL_BUFFSIZE` 不足、`w1_scale_bias` 缺失或 `worldSize` 超出 `(0, 768]` | 报错 `DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL`、`worldSize is invalid` 或 `AssertionError`（窗口公式与调大策略见 [HCCL buffer](hccl-buffer.md)） |
| `ascend_config.py#L846` / `platform.py#L520` | `MiniMaxM3` 模型在归一化后 `enable_fused_mc2 == 1` 且 `is_mega_moe_supported()` 为 `False`（即传 `=1`，或传 `=2` 但缺 `cann_ops_transformer`；`=0` 不触发，来源 19） | 常规引擎启动经 `VllmConfig.__post_init__`（`vllm@ced6857a:vllm/config/vllm.py#L1842`）包装后，外层抛出 `pydantic_core.ValidationError`（`type=assertion_error`），内层含 `AssertionError: MiniMax M3 does not support enable_fused_mc2=1 (dispatch_ffn_combine)...` |
| `ascend_config.py` | 同时开启融合 MC2 与层级通信（`hierarchy`），或层级通信总专家数（仅在 `dynamic_eplb` 开启时计入 EPLB 冗余专家）超过 512 | 抛出 `fused mc2 op cannot be used with hierarchy communication.` 或 `supports at most 512 experts` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 硬件路由组织方式 | `select_moe_comm_method` 直接按 `soc_version == A2/A3/A5/_310P` 分支硬编码，尚无 LoRA+EP 闸门 | 新增 LoRA+EP 强走 `ALLTOALL` 闸门，仍按 `soc_version` 分支调度；`use_cann_megamoe()` 源码写死 `return False` 暂禁 MegaMoe（来源 23） | **架构重构**：引入 `HardwareProfile` 与四套 `MoECommPolicy` 枚举策略表，启用 A3/A5 `CANN_MEGAMOE`（`enable_fused_mc2=2` 探测并规范为 `1`，每卡 `16384` 上限）及 A5 草稿量化回退 | 延续 `HardwareProfile` 策略表；`enable_fused_mc2` 扩展至 `2`（MegaMoE）/ `3`（MegaMoE+共享专家融合，来源 22）；**修复 A5 分支缺陷**——将 `world_size_across_dp` 改为除以 `pipeline_parallel_size` 得到真实 `ep_world_size`，避免 PP 干扰选路 |
| `WeightSwitchMixin` 运行期权重重切分 | 不存在 | 不存在 | **正式新增** `vllm_ascend/weight_switch/{linear,o_proj}.py`，支持 `gather/repeat` 双规约与共享 `pool` 零拷贝视图切换 | 完整保留并继续支持量化线性层接入 |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法参考、官方指南与推导**：大规模 MoE 专家并行 Dispatch/Combine 通信计算重叠设计背景见 DeepSeek-V3 论文 [S1]；昇腾大规模 EP 部署形态与 `MC2 / AllToAll` 角色见 `large_scale_ep.md` [S2]。文中动态门槛公式 $T_{\text{cap}}$ 在 `TP=8` 下的 `4,096` 与 `131,072` 算例由源码常量直接推导 [D]。
- **四族硬件档案、融合门控与调度状态机**：`A2 / A3 / _310P / A5` 各自绑定的 `MoECommPolicy` 与 `CANN_MEGAMOE` 能力集见 `hardware_profile.py:279-383` [C3]；`enable_fused_mc2=2`（`main` 为 `2/3`）探测 `cann_ops_transformer`、模型尺寸与量化允许清单（`#L1056-L1088`：`hidden_size` 检查 `#L1065`、`moe_intermediate_size` 拒绝 `768` 见 `#L1073`、量化允许清单 `#L1076-L1088`）、`MiniMaxM3` 拒启断言（`#L843-849`，来源 19）及 `dynamic_eplb` 冗余专家计数见 `ascend_config.py`（来源 18–22）；`MoECommType` 枚举、三档 per-rank 上限常量（`16384 / 512 / 512`）与 `use_cann_megamoe` 见 `ascend_forward_context.py:27-98` [C4]；前向入口 `forward_context.use_mega_moe = use_cann_megamoe(vllm_config)` 赋值见 `ascend_forward_context.py:168`（来源 26）；`set_mc2_tokens_capacity` 及三套策略选择器函数见 `ascend_forward_context.py:239-371` [C5]；`select_moe_comm_method` 全局闸门与分派主入口见 `ascend_forward_context.py:373-426` [C6]。
- **四类通信实现、Dispatch/Combine 分工与冷启动显存保护**：`AllGatherCommImpl`、`MC2CommImpl`、`AlltoAllCommImpl` 与 `FusedMC2CommImpl`（按 `forward_context.use_mega_moe` 走 MegaMoe 对称内存或跌回 `else` 分支 `dispatch_ffn_combine`）见 `moe_comm_method.py:211-323` [C7] 及 `#L580-606`（来源 17）；All-to-All-v 按 `input_splits` 外发（`token_dispatch` `#L475-557`）与按 `combine_metadata.input_splits` / `output_splits` 回传（`token_combine` `#L559-578`）、以及 `TokenDispatcherWithAll2AllV._preprocess` 计算 `input_splits` / `output_splits`（`#L616-645`）均见 `token_dispatcher.py:440-645`（来源 24）；MC2 派发参数准备（含 `token_dispatcher.py#L164` `expert_map is required` 断言）与 `npu_moe_distribute_dispatch_v2` 调用（`#L232`）见来源 15，`token_combine` / `npu_moe_distribute_combine_v2`（`#L331`）见来源 16；V1 与 V2 runner 冷启动额外补跑 `mc2_tokens_capacity` 摸底分别见 `model_runner_v1.py:4336-4346` [C8] 与 `worker/v2/model_runner.py:738-749`（来源 25）。
- **`WeightSwitchMixin` 与跨版本演进**：`WeightSwitchMixin` 规约声明与二次切分准备见 `weight_switch/linear.py:146-285` [C9]，共享 `pool`、异步 `all_gather_weight` 与 `tensor.set_` 零拷贝切换见同文件 `446-565` 行 [C10]，`OProjWeightSwitchMixin` 上下文管理见 `weight_switch/o_proj.py:13-80` [C11]；`v0.23.0`、`v0.26.0rc`（含 `use_cann_megamoe()` 暂禁 `return False`，来源 23）旧硬编码分流及 `main` 修复 A5 `ep_world_size` 剔除 `pipeline_parallel_size` 见三分支 `ascend_forward_context.py` [C12][C13][C14]；经树核验 `hardware_profile.py` 与 `weight_switch/` 均自 `v0.30.0` 引入 [D]。
