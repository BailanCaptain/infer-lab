---
id: moe
title: MoE：一层里放很多专家，每个 token 只用几个
type: concept
legacyAnchors:
  落到-glm-双机45-层里-42-层是-moe: 复杂异构实战对照：同样选 8 个专家，谁决定最后的权重？
  复杂异构实战对照: 复杂异构实战对照：同样选 8 个专家，谁决定最后的权重？
summary: >-
  MoE 把前馈层换成一池专家，router 选 k 个加权求和，总参随专家数涨而每 token 计算只随 k 涨。本页以 Qwen3-30B-A3B（128
  选 8、Softmax 重归一、零共享专家）为主线讲清机制、负载不均与算子交接，最后对照 DeepSeek-V3 / GLM 的 288
  选 8、偏置路由与共享专家。
aliases:
  - MoE
  - 混合专家
  - Mixture of Experts
  - 专家
  - expert
  - 路由器
  - router
  - 门控
  - gate
  - 路由结果
  - routed expert
  - 共享专家
  - shared expert
  - top-k
  - top-8
  - 稀疏激活
  - 组合权重
  - 负载不均
  - aux loss
  - 辅助损失
  - e_score_correction_bias
  - noaux_tc
  - routed_scaling_factor
chapters:
  - '06'
order: 80
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'https://arxiv.org/html/1701.06538v1'
  - 'https://arxiv.org/html/2412.19437v2'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L30-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L139-L232'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L286-L312'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L340-L395'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L672-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L229'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L162
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L139-L177'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L726-L800'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/experts_selector.py#L205-L230'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/fused_moe.py#L824-L914'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L126
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/shared_experts.py#L43-L60'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/shared_experts.py#L340-L560'
  - >-
    vllm-ascend@db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h#L40-L56
  - >-
    raw:sha256-f07c72006321564656641044ce1a4d548cefade8a2cddd9b5a9c7eb0366901eb.md#L1-L1289
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/models/glm5_next.py#L1503-L1511
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ops/fused_moe/experts_selector.py#L222-L231
  - >-
    vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L128
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L93-L126'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L390-L502'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L504-L630'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L100-L118'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L351-L393'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/experts_selector.py#L95-L113'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/experts_selector.py#L346-L388'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/fused_moe.py#L425-L540'
  - 'vllm-ascend@db701c1f:csrc/moe/moe_gating_top_k/op_kernel/moe_gating_top_k_without_group.h#L190-L259'
  - 'vllm@0fc695fc:docs/design/fused_moe_modular_kernel.md#L1-L245'
  - 'vllm@0fc695fc:docs/design/moe_kernel_features.md#L1-L112'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L83-L157'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L199-L246'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L263-L418'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L471-L581'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L815-L860'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1031-L1092'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1106-L1192'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1275-L1341'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1491-L1561'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/experts/fused_batched_moe.py#L296-L325'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/experts/fused_batched_moe.py#L717-L833'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L71-L85'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L222-L308'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L139-L153'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L229-L342'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L372-L410'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L11-L121'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L153-L298'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L329-L370'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L53-L88'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L294'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L479-L545'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L84-L93'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L97-L115'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L473-L502'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L537-L582'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1051-L1112'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1127-L1229'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1312-L1378'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1539-L1571'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L87-L88'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L194-L264'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L269-L322'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L146-L147'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L229-L326'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L372-L410'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/experts/fused_batched_moe.py#L817-L837'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L78-L86'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L155-L199'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L193-L309'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L11-L41'
  - 'vllm@568afb3a:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L44-L77'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L86-L95'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L99-L121'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L481-L513'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L548-L593'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1117-L1196'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1211-L1298'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1384-L1450'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1616-L1648'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L87-L88'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L194-L264'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L269-L322'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L146-L147'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L229-L326'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L372-L410'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/experts/fused_batched_moe.py#L865-L885'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L132-L171'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L173-L184'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L208-L326'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L11-L41'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L44-L77'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L86-L95'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L99-L121'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L488-L520'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L555-L600'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1124-L1203'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1218-L1305'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1391-L1457'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1623-L1655'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L87-L88'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L194-L264'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ht.py#L269-L322'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L146-L147'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L229-L326'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L372-L410'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/experts/fused_batched_moe.py#L865-L885'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L132-L171'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/unquantized_fused_moe_method.py#L173-L184'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L208-L326'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L11-L41'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/topk_weight_and_reduce.py#L44-L77'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L48-L163'
  - 'vllm@84030bbe:vllm/model_executor/layers/fused_moe/oracle/unquantized.py#L48-L163'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L127'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/shared_experts.py#L64-L130'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L373-L426'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L127'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/shared_experts.py#L72-L145'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L420-L465'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: mlp-residual-norm
    kind: builds-on
    note: 专家内部就是一个门控前馈网络；MoE 在它之外加了选择和加权合并
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-99129f27842731203229eb685a78a5daf03fbe6927129ff81f1c2002ab080cf1.md
  - >-
    raw/sha256-f07c72006321564656641044ce1a4d548cefade8a2cddd9b5a9c7eb0366901eb.md
---

## MoE 是什么？

**MoE（mixture of experts，混合专家）用多个 expert（专家，各自执行前馈变换的网络）和选择专家的路由机制组织前馈计算。本页讲的稀疏 MoE 为每个 token 选择其中一部分路由专家计算，再把选中专家的输出按权重合起来。**

先看它换掉的是什么。模型由几十层堆成，每个 [token](token.md)（文本切出的小片段）在每层都维护一条**隐藏向量**，记着该位置截至当前的上下文信息（见[层与隐藏表示](layers-and-hidden.md)）。一层内对它做两件事：先用 [attention](attention-qkv.md) 让各位置互相读信息，再过**前馈网络**（FFN / MLP），用几次[矩阵乘](matmul-and-weights.md)把这排数先拓宽再缩回原宽（见[前馈网络](mlp-residual-norm.md#前馈网络怎样变换一个位置的特征)）。普通稠密模型每层只有一个前馈网络，每个 token 都要把它完整算一遍。

MoE 把这一个前馈网络换成一池专家，每个专家本身也是一个前馈网络；细粒度 MoE（如 `Qwen3-30B-A3B` 与 GLM）常把单个专家做得比稠密前馈网络窄、数量更多，但专家较小不是 MoE 的定义。每层再配一个 **router（路由器）**：一个打分网络，给当前 token 对每个专家打一个分，再按模型的选择规则交给其中几个。本文的 top-k 路由每次选固定的 k 个；最标准的路径是全池 Softmax 后直接取前 k 个并重归一化，部分变体还会额外加入偏置和分组，后文会展开。这有点像医院分诊：每个病人只挂最对口的一两个科室，不必把全院医生都看一遍。不同的是，专家各管什么不是人分配的，是训练中自己形成的，不一定对得上人能叫出名字的科目。

举一个示意的例子：一层有 6 个专家，k = 2。「我吃了苹果」切成「我」「吃」「了」「苹果」4 个 token（为了好读，一个词算一个），每个 token 在这一层各选各的：「苹果」交给专家 2 和 4，「吃」交给专家 2 和 5。下图跟着「苹果」走一遍：

```wiki-diagram
file: moe-intuition
```

图里有三件事值得记住。第一，本页采用权重常驻的部署：发给专家的是这个 token 的隐藏向量，专家权重留在所在设备上。第二，没被这个 token 选中的专家不为它计算，但仍可能服务同批的其他 token，参数也仍占着显存。第三，出口把几个专家的输出**按权重相加**，这一层保持相同的隐藏宽度，后续层无需因专家数改变输入形状。

同一个 token 进到下一个 MoE 层，那一层有自己的 router 和自己的一池专家，要重新选。

这一池要经过 router 打分、才有机会被选中的专家叫**路由专家**（routed expert），图里就是那 6 个：它指整个可供挑选的集合，不是某个 token 这一次选中的那 2 个。像 `Qwen3-30B-A3B` 这样的纯路由稀疏 MoE 只设路由专家（`num_shared_experts = 0`）；另一些模型（如 DeepSeek-V3 / GLM）还会额外配**共享专家**（shared expert）：它不经过 router，每个 token 都要过它，放在后文[复杂异构实战对照](#共享专家每个-token-都要过的那一个)展开。

## 为什么需要 MoE，代价在哪？

**MoE 用条件计算扩大参数容量：单个专家结构不变时，增加专家数会增加总参数，而每个 token 的专家矩阵乘仍只涉及选中的 k 个。** 这不表示知识量由参数数目单独决定，也不表示 router 的打分与通信没有成本。一层里放得下很多专家参数，而一个 token 只计算其中一部分专家，这叫**稀疏激活**。

用示意数算一下。设每个专家是一个「4 → 8 → 4」的小前馈网络，由三片各 32 个数的权重矩阵组成：两片 4 × 8（叫 gate 和 up）把 4 个数扩到 8 个，一片 8 × 4（叫 down）再缩回 4 个，为什么这样分见[前馈网络](mlp-residual-norm.md#门控-mlpswiglu)，一个专家有 3 × 4 × 8 = 96 个参数；每个 token 选 2 个专家。这里只比较专家矩阵乘：每用到一个矩阵元素，约对应一次乘加；按乘和加各计一次 FLOP，运算数约是这些元素数的两倍，未计激活、router 等工作：

| 这一层的做法 | 这一层的参数 | 一个 token 乘到的参数 | 占比 |
| --- | --- | --- | --- |
| 6 个专家，每个 token 选 2 个 | 6 × 96 = 576 | 2 × 96 = 192 | 1/3 |
| 60 个专家，每个 token 选 2 个 | 60 × 96 = 5,760 | 2 × 96 = 192 | 1/30 ≈ 3.3% |
| 参数一样多的稠密前馈网络 | 5,760 | 5,760 | 全部 |

专家从 6 个加到 60 个，这一层的参数涨了 10 倍，一个 token 的矩阵乘法量却没变，仍是 2 个专家那么多；参数一样多的稠密网络，每个 token 要多乘 30 倍。MoE 因此可以把模型容量做得很大，而不成比例地变慢。`Qwen3-30B-A3B` 一层的真实比例在[下一节标准模型核算](#放到标准模型qwen3-30b-a3b-的-128-选-8-与全层纯稀疏-moe)算，GLM 288 选 8 的对照见[后半实战对照](#一个-token-用上多少专家参数)。

省下计算不等于免费，代价有三样：

1. **总权重容量没有随激活比例缩小。** 本页的常驻部署会把所有专家权重放在加速卡内存里；这是部署方式，不是所有 MoE 必须遵守的存放位置。一张卡放不下，就把专家分到多张卡上，每张卡只放一部分专家，token 选中的专家在哪张卡，就把它送到哪张卡去算，这叫**专家并行**（expert parallel，EP），见[专家并行](expert-parallel.md)，本页不展开。
2. **多了一步 router，还多了一次搬运。** 打分本身很小，但选中的专家要是在别的卡上，就得把隐藏向量发过去、把结果收回来。发和收怎么做、每层几次通信，见[专家并行](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

3. **负载不均。** 选谁由数据决定，热门专家会分到更多 token；当各卡需要等待这些专家结果时，较慢的计算或通信会拖长这一层的关键路径。机制在[后面那一节](#一批-token-怎样落到专家上负载为什么会不均)。

路由器为输入选择专家，专家并行则安排专家所在的设备和输入、输出的传输。因此，专家数量分得一样多，并不代表每张卡实际收到的计算任务一样多；上表的专家矩阵乘计算量比例也不能直接当作端到端加速比例，还要计入路由、通信、临时张量和负载不均的影响。

## MoE 怎么算？跟着一个 token 走一遍

**标准 Softmax Top-k 重归一路由（`Qwen3-30B-A3B` 采用）走四步：router 给全池专家算出原始打分，经 FP32 Softmax 转成和为 `1` 的概率后直接挑出前 `k` 个，再对入选的 `k` 项除以之和做重归一化（`norm_topk_prob = true`）使权重严格和为 `1.0`，最后把选中专家的输出按权重相加。** router 的分数有两个去处：一个**决定选谁**，一个决定选中专家的**组合权重**。

下面用 6 选 2 的示意数演一遍标准路径（隐藏向量缩成 4 维，数都是为演示编的，算法与 `Qwen3-30B-A3B` 的 128 选 8 一致）：

```wiki-diagram
file: moe-router-calc-qwen3
```

**① router 打分。** router 是一个「隐藏宽度 → 专家个数」的线性层（本例为 `4 × 6` 权重矩阵，每一列对应一个专家），在 FP32 精度下用隐藏向量与每列做点积，算出 6 个原始分数 $z = [0,\; 2,\; 1,\; 0,\; -1,\; 0]$。

**② 全池 Softmax 转概率。** 对这 6 个数一起做 Softmax（$p_j = e^{z_j} / \sum_m e^{z_m}$），得到加起来等于 `1.00` 的全池概率 $p \approx [0.07,\; 0.55,\; 0.20,\; 0.07,\; 0.03,\; 0.07]$。标准路径不加路由校正偏置 $b$，直接用 $p$ 排序。

**③ 挑出 Top-k。** $k = 2$ 时直接选出概率最大的**专家 2**（`0.55`）与**专家 3**（`0.20`），其余 4 个专家本轮不参与计算。

**④ Top-k 重归一化（`norm_topk_prob = true`）。** 入选的 2 个概率之和为 $0.55 + 0.20 = 0.75$（小于 `1`，因为丢掉了其余 4 个专家占去的 `0.25`）。为了保持本层输出尺度稳定，把这两项各自除以 `0.75`，得到组合权重 $[0.73,\; 0.27]$，两项之和严格等于 **`1.00`**，且不乘额外缩放系数。

**⑤ 加权相加输出（零共享专家）。** 设专家 2 输出 $E_2(x) = [2,\; 0,\; 1,\; -1]$、专家 3 输出 $E_3(x) = [0,\; 1,\; 2,\; 1]$。逐位加权相加（例如第 3 维 $0.73 \times 1 + 0.27 \times 2 = 1.27$），得到最终输出 $[1.46,\; 0.27,\; 1.27,\; -0.46]$，宽度仍为 4。因无共享专家，它就是本层 MoE 的全部输出。

| 步骤（标准 Softmax Top-k 路由手算，6 选 2 示意） | 计算过程 | 结果 |
| --- | --- | --- |
| ① router 打分 $z$ | 隐藏向量与 6 列门控权重做点积 | $[0,\; 2,\; 1,\; 0,\; -1,\; 0]$ |
| ② 全池 Softmax 概率 $p$ | $e^{z_j} / \sum_m e^{z_m}$（保留两位小数，全池和 $= 1$） | $[0.07,\; 0.55,\; 0.20,\; 0.07,\; 0.03,\; 0.07]$ |
| ③ 直接选 Top-2（无偏置 $b$） | 按 $p$ 降序取前 2 名 | **专家 2（`0.55`）、专家 3（`0.20`）** |
| ④ Top-2 重归一化（`norm_topk_prob = true`） | $[0.55,\; 0.20] \div 0.75$（无额外缩放） | 组合权重 **$[0.73,\; 0.27]$**（和严格 $= 1.00$） |
| ⑤ 加权求和输出（`0` 共享专家） | $0.73 \times E_2(x) + 0.27 \times E_3(x)$ | **$[1.46,\; 0.27,\; 1.27,\; -0.46]$** |

写成通式（$z_j$ 为专家 $j$ 的门控分数，$S$ 为选中的 $k$ 个专家集合）：

$$p_j = \frac{e^{z_j}}{\sum_{m=1}^{N} e^{z_m}}, \qquad S = \text{TopK}_k(p_j), \qquad \alpha_j = \frac{p_j}{\sum_{i \in S} p_i} \quad (j \in S), \qquad y_{\text{MoE}} = \sum_{j \in S} \alpha_j E_j(x)$$

> **变体提示**：并非所有 MoE 都采用「Softmax + 重归一 + 无偏置 + 零共享专家」。DeepSeek-V3 与 GLM-5.3-Flash 改用 `sigmoid` 打分、校正偏置 `e_score_correction_bias` 选人、`routed_scaling_factor` 缩放（权重和不再等于 `1`）并叠加常驻共享专家，完整手算见后半[复杂异构实战对照](#复杂异构实战对照同样选-8-个专家谁决定最后的权重)。

## 放到标准模型：Qwen3-30B-A3B 的 128 选 8 与全层纯稀疏 MoE

**在全站 `v0.30.0` 主基线的标准 MoE 标尺模型 `Qwen3-30B-A3B` 上，全部 48 层均为纯稀疏 MoE（无前几层稠密 FFN、零共享专家 `num_shared_experts = 0`）：隐藏宽度 `H = 2048`，每层设 `128` 个路由专家、单专家中间维 `I_moe = 768`，每个 token 经全量 FP32 Softmax 选出 `top_k = 8` 个并重归一（`norm_topk_prob = true`，8 项权重和严格 `= 1.0`）。全模型总参数约 `30.5B`，单 token 激活参数约 `3.3B`。**

先用上节同一口径算清 `Qwen3-30B-A3B` 单层与全模型的静态参数账（仅计路由专家 gate/up/down 三片无偏置矩阵；完整模型分项账见 [HF 模型目录解剖](hf-model-anatomy.md#完整算账对照qwen3-8b-vs-qwen3-30b-a3b)）：

$$P_{\text{expert}} = 3 \times H \times I_{\text{moe}} = 3 \times 2{,}048 \times 768 = 4{,}718{,}592 \approx 4.72\text{ M}$$

| `Qwen3-30B-A3B` 稀疏 MoE 核算项（`H = 2048`，`I_moe = 768`，48 层纯 MoE） | 算式 | 参数量 / BF16 规模 |
| --- | --- | --- |
| 单个路由专家（gate / up / down） | $3 \times 2{,}048 \times 768$ | **`4,718,592`**（BF16 恰为 **`9.0 MiB`**） |
| 单层 `128` 个路由专家合计 | $128 \times 4{,}718{,}592$ | **`603,979,776`**（约 `604.0 M`，BF16 **`1.125 GiB`**） |
| 单 token 本层激活专家（`top_k = 8`） | $8 \times 4{,}718{,}592$ | **`37,748,736`**（约 `37.75 M`，单层激活占比 **`6.25%` = 1/16**） |
| `48` 层路由专家总计 | $48 \times 603{,}979{,}776$ | 约 **`28.99 B`**（占总参数 `30.5 B` 约 **`95%`**） |
| 全模型总参数 vs 单 token 激活参数 | 官方模型卡口径（含 Attention / 词表 / Router） | 总参约 **`30.5 B`** / 单 token 激活约 **`3.3 B`**（约 **`10.8%`**） |

三个关键工程特征让 `Qwen3-30B-A3B` 成为理解稀疏 MoE 的最干净标尺：

1. **零共享专家，无双支合并开销**：`num_shared_experts = 0`，没有独立的共享分支投影与多流重叠路径，路由分支加权求和就是整层 FFN 输出。
2. **全量 FP32 Softmax + Top-8 重归一**：每层 router 仅 `[2048, 128]`（262,144 个参数），全池做 FP32 Softmax 后直接取 Top-8 并除以这 8 项之和，保证 `sum(topk_weights) = 1.0`；没有分组选择（`n_group`）也没有额外缩放因子。
3. **小专家、高稀疏度**：单个专家仅 `9.0 MiB`（BF16），单层放 `128` 个却只激活 `8` 个（`1/16`），训练期依靠极小辅助损失系数（`router_aux_loss_coef = 0.001`）约束均衡；推理期一旦跨卡走 EP，仍需配合通信调度与负载均衡机制。

## 一批 token 怎样落到专家上，负载为什么会不均

一个 token 的 top-k 只约束它自己。把一批 token 放在一起看，用到的专家个数通常远多于 k。还是 6 个专家、k = 2，「我吃了苹果」4 个 token 在这一层各选 2 个（示意）：

| token | 选中的专家 |
| --- | --- |
| 我 | 1、2 |
| 吃 | 2、5 |
| 了 | 2、3 |
| 苹果 | 2、4 |

这 4 个 token 产生 4 × 2 = 8 个 token–专家配对，涉及 5 个不同的专家：专家 2 收到 4 个 token，专家 1、3、4、5 各收到 1 个，专家 6 一个也没收到。执行时按专家把输入行归拢在一起：专家 2 把 4 个 token 的隐藏向量叠成一个 4 行的矩阵，批量执行专家内的 gate、up、down 投影和激活，算完再把各行按原 token 的组合权重合并。**所以「每个 token 选 k 个」绝不等于「一批只用 k 个专家」**；批次增大可覆盖更多专家，但若路由一直集中，也不保证用遍全部专家。

```wiki-diagram
file: moe-batch-load
```

**负载不均就是这么来的：** 本页的逐 token 路由不保证每个专家收到同样多的行。设专家 1–3 放在卡 A、专家 4–6 放在卡 B，这一批里卡 A 要算 1 + 4 + 1 = 6 行，卡 B 只算 1 + 1 + 0 = 2 行。MoE 层有回收和归约这样的同步点，关键路径上的慢卡会让其他参与者等待。若假设每行成本相同且线性、忽略通信和固定开销，这个例子中卡 B 早算完就要等卡 A；实际矩阵利用率、通信与重叠会改变耗时，不能由行数翻倍直接推出整层时间翻倍。

训练侧有两类办法把负载压平：

- **辅助损失（aux loss）**：在训练目标里额外加一项，惩罚「专家被选到的次数分布太不均」，让模型自己学着摊平。这是稀疏门控 MoE 最早的做法。代价是这一项和语言建模目标在拔河，压得太狠会掉效果。
- **校正偏置**：这项均衡机制通过调整选择偏置工作，不靠它自身增加损失项。DeepSeek-V3 论文描述为：训练时监测负载，过载专家的偏置调低，欠载的调高。偏置不直接进入组合权重的数值公式，但换了入选专家仍会改变输出。该论文还保留很小的序列级辅助损失，因此“用偏置均衡”不等于整个训练完全没有辅助损失。

要注意的是：**推理时这个偏置是固定不变的权重，只能提供统计上的大致均衡**，不会根据当前批次实时调整。真实批次照样会偏，上面这一批里专家 2 就被每个 token 都选中了。按实测负载搬动或复制专家的做法叫 [EPLB](eplb.md)（Expert Parallelism Load Balancer，专家并行负载均衡）。

## 通信和专家计算之间，交接的行怎样排列？

**同一组“token 找专家”的任务可用不同张量排布交接，通信端与计算端必须遵守同一份数据契约。** 上游模块化 MoE 把流程拆为成对的 `prepare`（准备并派发）→ `experts`（矩阵乘与激活）→ `finalize`（收回并合并）：准备与收尾共享映射句柄，单换专家 kernel 仍须满足两端约定。

```wiki-diagram
file: moe-fig-router-shared-flow-qwen3
```

对照上图下半区的真实 24 格排布（设 $K$ 为隐藏宽、$E$ 为本卡专家数、$M$ 为提交行数、$T$ 为单专家预留上限），两种上游布局的区别与三笔账一目了然：

| 交接布局 | 张量形状 | 配套元数据与典型路径 |
|---|---|---|
| `Standard`（紧凑二维行） | `[M, K]` | 附 `topk_ids`、组合权重与全局→本地映射（DeepEP，即 DeepSeek 开源的 GPU 专家并行通信库的高吞吐路径使用，支持延后输入量化） |
| `BatchedExperts`（按专家预留） | `[E, T, K]` | 另列每专家实际有效行数；$T$ 是预留容量而非负载（DeepEP 低时延路径使用，拒绝延后量化） |

沿用上节卡 A（持有专家 1–3，有效负载 `[1, 4, 1]`、隐藏宽缩为 `4`）：若有 `2` 个派发端、每端最多 `4` 行，则每专家预留 $T = 8$ 行，输入容量为 `[3, 8, 4]`（共 `24` 槽：上图 `6` 个实色有效格 + `18` 个虚框空槽，BF16 输入区占 $3 \times 8 \times 4 \times 2\text{ B} = \mathbf{192\text{ B}}$，不含权重、缩放、输出与临时工作区）。空槽不代表新增请求也不必为零，而部分生命周期不重叠的临时工作区可复用存储——因此**预留容量、实际有效负载与同时存活缓冲是三笔独立账**，绝不能混算。

除了排布与设备/量化/激活/路由全套能力匹配（仅同标 FP8 不足以保证兼容），交接还须锁死三条接口契约：

- **量化时点由两端共同支持**：输入可在派发前、接收后或专家内延后量化；DeepEP 高吞吐支持延后量化，低时延明确拒绝。
- **组合权重只乘一次**：若专家实现已做加权归约，收尾直接跳过；若委托给 `combine`，则仅由回收算子乘一次。且因专家内含非线性，输出加权不能任意改成先缩放输入。
- **异步通信必须显式等待回调**：异步 `prepare` / `finalize` 返回的完成回调必须按契约调用后结果才可读；是否能与共享专家或另一微批重叠取决于后端与调度，不能消除通信载荷。

昇腾 `v0.30.0` 已把四族硬件（A2 / A3 / 950 / 310P）在 `AllGather`、`MC2`、`Fused MC2 / MegaMoe` 与 `AllToAll` 间的选路收拢为统一状态机（详见 [MoE 通信调度状态机与运行期权重重切分](moe-comm-dispatch.md)）；后文 GLM 双机算例则沿用固定镜像的 Ascend `prepare/finalize` 链（MC2 与 AllGather 对比见 [EP 的两条搬法](expert-parallel.md#mc2-还是-allgather)），切勿把上游 GPU 类名直接套进昇腾命令。

## 复杂异构实战对照：同样选 8 个专家，谁决定最后的权重？

标准 `Qwen3-30B-A3B` 与 DeepSeek-V3 / GLM-5.3-Flash（例外 B 固定基线）同样为每个 token 选 8 个专家，但后者改写了决定权重的四处规则：**① `sigmoid` 独立打分替代 Softmax；② 校正偏置 `e_score_correction_bias` 仅参与选人；③ 归一化后乘整体缩放系数 `routed_scaling_factor`（权重和不再等于 `1`）；④ 叠加常驻共享专家与可选分组路由**。下面完整保留这套异构手算、双支结构与 GLM 双机 288 选 8 对照。

### Sigmoid 偏置选人与缩放：以 DeepSeek-V3 / GLM 路由规则为例

**这类路由规则把「选谁」和「按什么比例相加」进一步拆开：router 给每个专家打分，经 `sigmoid` 压到 0 到 1 之间，加校正偏置后选出前 k 个；再用选中专家没加偏置的原始分数归一化，并乘以整体缩放系数 `r`，最后把输出按权重相加。**

需要说明的是，下文手算遵循的是「偏置只用于选人、组合权重回到原始分数计算」的分组路由规则；另有一类不分组的实现，会直接对加过偏置的分数取 top-k 并延续计算，不再恢复原始分数。因此不能把这套手算规则套到所有路由路径上，具体实现对应关系见文末 `## 对照源码`。

沿用「苹果」的 6 选 2 示意例子（隐藏向量 4 维，数均为示意，算法与 DeepSeek-V3 / GLM 一致）。图里上半张表是偏置选人，下面两排是回原分数归一化、乘缩放系数与加权相加：

```wiki-diagram
file: moe-router-calc
```

**① router 打分。** 4 × 6 权重矩阵与「苹果」的隐藏向量 $x = [1, 0, 2, 1]$ 逐列点积（以专家 2 的列 $[0.5, 1, 0.5, 0.5]$ 为例，点积为 $2$），得到 6 个原始 logits $z = [-1, 2, 1.5, 1, -2, 0.5]$。

**② 打分函数：sigmoid。** `sigmoid(z) = 1 ÷ (1 + e^(−z))` 把每个专家单独压到 0 到 1 之间，得到原始分数 $s = [0.27, 0.88, 0.82, 0.73, 0.12, 0.62]$。每个专家只看自己的 $z$，6 项之和为 `3.44` 而非 `1`（对照 Softmax 对同一排 $z$ 会给出和为 `1` 的约 `[0.02, 0.44, 0.27, 0.16, 0.01, 0.10]`）。

**③ 加校正偏置，只用来选人。** 设专家 3 的校正偏置 $b_3 = -0.2$、专家 4 的 $b_4 = +0.1$，其余为 `0`。选人时比较 $s + b = [0.27, 0.88, 0.62, 0.83, 0.12, 0.62]$，前 2 名变为**专家 2 与专家 4**（若不加偏置，前 2 名本是专家 2 与专家 3）。

**④ 归一化：用原始分数，不用加了偏置的分数。** 回到没加偏置的 $s$ 取 `0.88` 和 `0.73`，除以之和 `1.61` 得 `[0.547, 0.453]`（若误用 `s + b` 的 `0.88` 和 `0.83`，会误得 `[0.515, 0.485]`）。偏置不直接进组合权重，但它改变了入选集合，因此仍会影响最终输出。

**⑤ 整体缩放。** 再乘模型规定的缩放系数 $r = 2$，组合权重变成 `[1.09, 0.91]`，两项之和等于 `2` 而非 `1`——所以在这类模型上**不能把最终组合权重当成「和为 1 的概率」**。

**⑥ 按组合权重把专家输出加起来。** 设 $E_2(x) = [1, 0, 2, -1]$、$E_4(x) = [0, 2, 1, 1]$，逐位加权求和（例如第 3 维 $1.09 \times 2 + 0.91 \times 1 = 3.09$），路由分支输出为 $[1.09, 1.82, 3.09, -0.18]$。

| 步骤（DeepSeek-V3 / GLM 路由规则手算，示意） | 计算过程 | 结果 |
| --- | --- | --- |
| ① router 打分 $z$ | 隐藏向量与 6 列权重做点积 | $[-1,\, 2,\, 1.5,\, 1,\, -2,\, 0.5]$ |
| ② 原始分数 $s = \text{sigmoid}(z)$ | 保留两位小数（之和 `3.44 ≠ 1`） | $[0.27,\, 0.88,\, 0.82,\, 0.73,\, 0.12,\, 0.62]$ |
| ③ 选人分数 $s + b$ | 只看 $s$ 会选专家 2、3；偏置改选专家 2、4 | $[0.27,\, 0.88,\, 0.62,\, 0.83,\, 0.12,\, 0.62] \rightarrow$ **专家 2、4** |
| ④ 归一化（用 $s$，不用 $s + b$） | $[0.88,\, 0.73] \div 1.61$ | **$[0.547,\, 0.453]$** |
| ⑤ 整体缩放（$r = 2$） | $2 \times [0.547,\, 0.453]$ | 组合权重 **$[1.09,\, 0.91]$**（和 $= 2$） |
| ⑥ 路由分支输出 | $1.09 \times E_2(x) + 0.91 \times E_4(x)$ | **$[1.09,\, 1.82,\, 3.09,\, -0.18]$** |

写成通式（$z_j$ 为原始分数，$b_j$ 为校正偏置，$S$ 为选中的 $k$ 个专家，$r$ 为缩放系数）：

$$s_j = \text{sigmoid}(z_j), \qquad S = \text{TopK}_k(s_j + b_j)$$

$$\alpha_j = r \cdot \frac{s_j}{\sum_{i \in S} s_i}\quad (j \in S), \qquad y_{\text{routed}} = \sum_{j \in S} \alpha_j E_j(x)$$

分子分母里都只有 $s$、没有 $b$；换成低精度或融合算子执行时，数值细节以对应算子为准。

### 分组选择：先选组，再在组里选专家

**分组选择是更粗一层的选法：先把专家按编号切成若干组，给每组算一个「代表分」，按代表分先选出几组，再只在这几组里选专家。** 它是为跨设备部署省通信用的：部署时让一组专家放在同一台机器（或同一批卡）上，一个 token 命中的组少，要联系的机器和卡就少。DeepSeek-V3 的分组就是按机器分的。

代表分有两种取法：一种取组内的最高分，原生实现（逐步骤写成的 Python 版本）用这种；一种取组内前 2 名的分数之和，GLM 实际走的融合算子固定用这种。两种都拿加了偏置的选人分数来比。接着上面的例子：6 个专家按编号两两分成 3 组，先选 1 组，再在组里选 2 个。

| 组 | 组内的 s + b | 代表分：组内最高分 | 代表分：组内前 2 名之和 |
| --- | --- | --- | --- |
| 组 1（专家 1、2） | 0.27、0.88 | 0.88，三组里最高 | 1.15 |
| 组 2（专家 3、4） | 0.62、0.83 | 0.83 | 1.45，三组里最高 |
| 组 3（专家 5、6） | 0.12、0.62 | 0.62 | 0.74 |

按组内最高分取，选中组 1，最后选的是专家 1 和 2；按前 2 名之和取，选中组 2，最后选的是专家 3 和 4；不分组时选的是专家 2 和 4。三种结果都不一样：分组把选择限制在少数几组里，代表分怎么取也会改变结果。选完之后，组合权重照样按上一节第 ④⑤ 步，从选中专家的原始分数 s 算。

组数和选组数都是模型配置里的固定值。两个值都设成 1 时，只有一组且必然入选，两种取法结果相同，这一层退化成「在全部专家里直接选 k 个」。

### 共享专家：每个 token 都要过的那一个

**共享专家不参加路由专家的 top-k 竞争，每个 token 都要过它。** 在 GLM 和这类双支结构里，两者都是门控前馈网络；层出口把路由分支的加权和与共享专家的输出**直接相加**，共享专家不参与那次路由归一化，也不带该组合权重。其他模型是否另有共享分支门控，要按模型确认。

接着上面的「苹果」例子：设这一层还有 1 个共享专家，它拿同一条 x 算出（示意）[0.2, −0.1, 0.3, 0]。它不打分、不乘组合权重，直接加到前面算出的路由分支输出上：[1.09, 1.82, 3.09, −0.18] + [0.2, −0.1, 0.3, 0] = [1.29, 1.72, 3.39, −0.18]，这才是这一层 MoE 交给后面的输出。

```wiki-diagram
file: moe-fig-router-shared-flow
```

这样安排的用意是分工：所有 token 都需要的那部分共性计算交给共享专家，路由专家就可以各自专门化，不必每个都重复学一遍共性。共享专家越多，固定要算的部分就越多，稀疏省下的计算越少。

共享专家并非所有 MoE 的必备部分：如前文 `Qwen3-30B-A3B` 设为 0 个共享专家，存在直接返回路由专家输出的实现分支。是否设置共享专家、包含多少个模块以及怎样并行，取决于具体模型与实现；上面的相加算例以存在共享专家为前提。

还有一处同名不同事要区分：共享专家和路由专家的**内部**都有 gate 和 up 两条分支，gate 过一个非线性后与 up 逐元素相乘。那是**逐通道**（通道就是向量里的一个位置）的强弱开关，作用在一个专家里面；选专家是在**一层的专家之间**做选择。两件事都叫「门控」，但不是一回事，内部那一层见[前馈网络](mlp-residual-norm.md#门控-mlpswiglu)。

在部署侧，两者的切法也不同：路由专家整份整份地分到各卡，是[专家并行](expert-parallel.md)的对象；共享专家怎么切，见下文 [GLM 双机共享专家一节](#共享专家按-tp8-切走融合算子)。

四个容易混的名字对照如下：

| 名字 | 要不要经过 router | 哪些 token 用到它 |
| --- | --- | --- |
| 路由专家 | 要打分，选中才算 | 每个 token 选 k 个 |
| 共享专家 | 不打分，直接算 | 所有 token 都过 |
| router | 它本身就是打分的那个网络 | 所有 token 都过 |
| 专家内部的 gate 分支 | 与选专家无关，是一个专家内部逐通道的强弱开关 | 所有走进这个专家的 token |

**GLM-5.3-Flash 的 45 层文本主干里，前 3 层用稠密前馈网络，第 3–44 层这 42 层用 MoE；每个 MoE 层有 288 个路由专家、每个 token 选 8 个，另有 1 个共享专家。** 请求在[一条请求的第 4 站](one-request.md#42-层-moe每卡-18-个专家)走到这里，前提是[官方双机配置](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、每台 8 卡、TP8/DP2/EP16、W8A8。TP8 分切采用 TP 的矩阵；DP2 让请求调度和历史状态各归一个执行组，路由专家计算则可跨两个组；EP16 把 288 个路由专家摊到全部 16 张卡。W8A8 只概括所量化层的权重与激活，router 等层保留浮点，见[量化](quantization.md)。

### 一层 MoE 的形状：288 选 8，外加 1 个共享专家

```wiki-diagram
file: glm-flash-moe
```

一个专家是 4096 → 2048 → 4096 的 gate、up、down 三个投影，三个都不带偏置项；中间宽度只有 2048，比前 3 层稠密前馈网络的 12288 窄得多：GLM 走的是「专家切得细、数量多」这条路。共享专家只配 1 个，形状和一个路由专家相同。所引配置和推理实现没有解释前 3 层采用稠密结构的训练权衡；这三层的计算见[前馈网络](mlp-residual-norm.md)。

### 一个 token 用上多少专家参数

**一层 288 个路由专家，一个 token 只用 8 个，用到的专家参数不到 3%。** 算法和前面示意的那张表相同，只是数换成了真的（以下仅计路由专家三片矩阵，不含共享专家、router 和注意力）：

| 一层 MoE 参数核算项（GLM-5.3-Flash，每专家 $4096 \to 2048 \to 4096$） | 算式 | 参数量 / 比例 |
| --- | --- | --- |
| 单个路由专家 | $3 \times 4096 \times 2048$ | **25,165,824** |
| 一层 288 个路由专家合计 | $288 \times 25{,}165{,}824$ | **7,247,757,312** |
| 单个 token 本层实际用到（top-8） | $8 \times 25{,}165{,}824$ | **201,326,592** |
| 单 token 激活比例 | $201{,}326{,}592 \div 7{,}247{,}757{,}312$ | **$\approx 2.8\%$**（$8/288 = 1/36$） |

如果这一层是个参数量相同的稠密前馈网络，这 72 亿个参数每个 token 都要乘一遍。**MoE 把这一层的参数量做到了 8 个专家的 36 倍（288 ÷ 8），每个 token 的矩阵乘法量却仍然是 8 个专家那么多。** 路由专家占了全模型参数的绝大部分，具体占比见[模型总览](glm-5-3-flash.md#参数量3133-亿里-97-是路由专家)；全模型的总参数与每个 token 的激活参数是另一套口径，也统一在那一节。每张卡实际放多少字节，见[双机部署的权重表](glm-5-3-flash-two-node.md#每张卡上放了什么)。

### router：sigmoid、只选人的偏置、归一化后乘 2.5

上文「Sigmoid 偏置选人与缩放」一节的四个环节，GLM 的正常融合路径全都用上了，只是 6 选 2 换成 288 选 8、缩放系数从示意的 2 换成 2.5。固定配置用 sigmoid、每层 288 个校正偏置；选中的原始分数归一化后乘 **2.5**；分组两个值都为 1，不再筛掉其他组。因此数学示意中的权重和为 2.5；实际融合算子还在分母加极小的 eps，并有浮点舍入。原生回退的版本差异见页末，不能沿用这个系数和。

```wiki-diagram
file: moe-pick
```

打分这一步按 **FP32**（每个数 32 位浮点）计算，这是全模型少数几处不降精度的地方之一，原因见[量化的 FP32 链](quantization.md)。以 R1 的 4 个提示词 token 为例，按完整 token 轴表示，router 的逻辑形状是 `[4, 4096] × [4096, 288] → [4, 288]`，每行取 8 个；这不代表经过切片或补齐后每张卡的实际调用都恰有 4 行。

### 共享专家：按 TP8 切，走融合算子

路由专家整份整份地分到 16 张卡上；共享专家在本页采用的 SP 关闭、未启用共享专家复制条件下，矩阵按机内 TP8 合切。这些是[共同教学基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)的附加条件，不能仅凭启动命令省略参数就断言运行时一定成立。分片形状与每卡字节见[张量并行的共享专家小节](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)。

**在这套 W8A8 部署里，共享专家不走它自己那个前馈模块的激活函数，而是走一条把反量化、限幅 SwiGLU 与再量化合在一起的融合算子。** 这一点和前 3 层的稠密前馈网络不同：稠密那边的限幅激活因为注册名对不上，退回了逐元素的写法（见[前馈网络](mlp-residual-norm.md#对照源码)）；共享专家不受这件事影响，因为这条路径根本没有调用那个模块的前向，而是直接取它的两份权重和缩放系数去调算子。

```wiki-diagram
file: moe-branches
```

四步依次是：把隐藏向量按 token 动态量化成 8 位整数；用量化矩阵乘算出 gate 和 up；把这两半反量化、按上限夹住、做 SwiGLU、再量化成 8 位整数（这三件事在一个融合算子里）；最后再做一次量化矩阵乘降回隐藏宽度。固定镜像这条整数分支要求两个投影都有量化缩放系数，且量化类型为 W8A8 或 W4A8；另有 W4A8MXFP 分支，其余情况走模块包装。不能把“走包装”统一解释为没有量化。

这条路径还有两点值得知道：

- **共享专家和路由专家在本部署里是串行的。** 代码里留了把共享分支切到另一条执行流、与路由专家的派发和矩阵乘重叠的开关，但默认关闭，官方教程也没开。所以共享分支照样执行，只是不与路由分支重叠。
- **共享专家算的是完整的 token 集合**，路由分支在 MC2 路径下（MC2 是昇腾上把 MoE 的派发、回收通信和计算协同执行的一类实现）已经在回收时把贡献汇齐了，所以两份结果的归约安排不同，不会重复做一次整层求和。具体次数与路径见[专家并行](expert-parallel.md#mc2-还是-allgather)。

### 负载：42 层逐层累加，偏置固定，EPLB 默认关

GLM 的推理实现采用带校正偏置的选择规则，配置名见[对照源码](#怎么开)。这不能单凭名称证明训练时没有辅助损失，也不能还原偏置的训练更新过程。推理路径把偏置作为已加载参数使用，没有按当前批次更新它；真实批次仍可偏斜。一个 token 依次经过 42 个 MoE 层，各层关键路径上的等待会累积。整批配对数、每专家和每卡理想行数见[多请求同时在跑](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)；[EPLB](eplb.md) 在本部署默认关闭。

## 常见误解

- **「每个 token 选 8 个，所以一层只用 8 个专家。」** 只对单个 token 成立。一批里不同 token 各选各的：前面 4 个 token 各选 2 个，已经用到 5 个专家；实际覆盖多少仍由路由决定。
- **「路由专家就是被选中的专家。」** 路由专家指整个可供 router 挑选的集合（`Qwen3-30B-A3B` 每层 128 个，GLM 每层 288 个）；被选中的 8 个是它的子集。共享专家不在这个集合里。
- **「所有 MoE 的组合权重之和都等于 1。」** `Qwen3-30B-A3B` 开启 `norm_topk_prob = true` 且无额外缩放时，8 项权重之和严格等于 `1.0`；而 DeepSeek-V3 / GLM 在归一化之后还乘以整体缩放系数（GLM 正常融合路径下 8 项权重和约为 `2.5`，受小常数与浮点舍入影响；旧版原生回退的额外缩放见下方版本差异），且 sigmoid 打分本身也不构成概率分布。
- **「校正偏置直接加进组合权重。」** 在 DeepSeek-V3 / GLM 的分组偏置规则中，偏置只参与排序选人；选定之后，组合权重回到没加偏置的分数去算。前面偏置算例里，偏置把专家 3 换成了专家 4，入选集合的变化仍会间接改变归一化和输出，但专家 4 进归一化的是 `s = 0.73`，不是 `s + b = 0.83`。
- **「每个 MoE 模型都必须带共享专家，而且共享专家也要在 top-k 中胜出才轮到它。」** `Qwen3-30B-A3B` 设为 0 个共享专家；带共享专家的模型（如 GLM）里，共享专家也不参加路由竞争，其输出直接与路由分支相加，不带路由组合权重。
- **「专家没被选中就等于没占资源。」** 没被选中省的只是这一次的矩阵乘；权重照样常驻显存，这正是要做专家并行的原因。
- **「把不常被选中的专家删掉，是一种部署优化。」** 改专家数或 k 都会改变模型的计算，输出随之改变，那是换了一个模型，不是同一个模型跑得更快。
- **「总参数乘 `8/128`（或 `8/288`）就是每个 token 的计算量。」** 这个比例只描述所列路由专家矩阵；注意力、共享专家（若有）、router 等另算，embedding 则按 token 编号取行，不能把整张表当每 token 的矩阵乘。

## 对照源码

**路由边界的来源范围。** 已核来源 7 的镜像 `experts_selector.py` 第 203–232 行及来源 19 的固定 main `grouped_topk_router.py` 第 97–126 行：有校正偏置时，分组路径保存原分数，并按选中编号从原分数取组合权重；来源 19 的非分组路径则直接对加偏置分数取 top-k，再归一化和缩放。来源 11 的镜像 `fused_moe_0_23_0.py` 第 700–701 行在没有共享专家时直接返回路由输出。这些指定路径不代表所有路由变体；专家均分不等于任务均衡、计算量比例不等于端到端收益，是职责与开销口径的推断，没有设备加速实测，也不据此扩大发布分支验证范围。

### 怎么开

MoE 没有开关：一层是稠密前馈网络还是 MoE、288 选 8、共享专家有几个，全由模型配置决定，改不了。配置里对应的字段是 `n_routed_experts=288`、`num_experts_per_tok=8`、`n_shared_experts=1`、`moe_intermediate_size=2048`，router 侧是 `scoring_func=sigmoid`、`topk_method=noaux_tc`、`norm_topk_prob=true`、`routed_scaling_factor=2.5`、`n_group=1`、`topk_group=1`。[S1][C4]

固定 GLM 实现只有在 `topk_method=noaux_tc` 时才创建那份 288 个数的校正偏置参数。这个推理侧条件证明如何路由，不足以证明完整训练目标中是否含辅助损失。

能开关的是部署侧的三处，都不改数学：专家怎么分卡（`enable_expert_parallel`，见[专家并行的怎么开](expert-parallel.md#怎么开)）、要不要按真实负载搬专家（`enable_eplb`，见 [EPLB](eplb.md)）、共享分支要不要切到另一条流与路由分支重叠（`multistream_overlap_shared_expert`、`multistream_overlap_gate`，两个默认都是 `False`，本部署没开）。

上游通信后端的入口、硬件适用范围与 Ascend 的区别见 [EP 的后端选择](expert-parallel.md#怎么开)。模块化 MoE 本身不是另一个统一的启动开关；具体量化方法负责创建通信与专家实现。固定上游未量化路径由 oracle（实现选择器）筛选候选，显式指定时检查该候选，自动模式按顺序找支持的实现；CPU、TPU、OOT 等还有独立分支。类替换与算子方法开关也不同，见 [CustomOp 与整层替换](ops-and-kernels.md#换了-python-类就一定经过同一种前向分派吗)。

### 会报什么错

在上述固定上游模块化路径中，通信端与专家端的 activation format 不一致会触发配对检查；BatchedExperts 缺 max_num_tokens 或 num_dispatchers 时会报 ValueError。未量化选择器对显式不支持的候选报 ValueError，自动模式全部候选都不支持时才报 NotImplementedError。DeepEP 低延迟 prepare 收到 defer_input_quant=True 会明确拒绝。遇到这些问题先核对两端的形状、类型与能力，不能通过把有效行数改成容量、跳过量化或重复套加权来“凑合跑通”。

选专家这一步有两条硬边界。第一，打分函数只认三种：softmax、sigmoid 和 sqrtsoftplus，改成别的值会在选专家时抛 `Unsupported scoring function`。[C9] 第二，分组选择要求组数和选组数自洽（选组数不能超过组数），否则走不进融合算子。

融合入口的条件不满足时，会转到逐步骤的原生路由实现：自定义路由函数、sigmoid 打分但关闭归一化、以及分组参数不满足要求，都会影响选择。[C6][C7] **不能统一称两条路径数学等价**：原生分组代表分取最大值，融合设置 group_select_mode=1 取 top-2 之和；此外，固定 db701c1f 的原生 grouped 和普通 top-k 分支已乘一次 routed_scaling_factor，返回外层后又乘一次。无自定义路由、归一化成立且 r=2.5 时，原生结果的系数和因此为 6.25，而非本页融合路径的约 2.5。单组只能消除选组差异，不能消除重复缩放。固定 GLM 满足融合门槛，前文正常路径算例保留；换配置导致回退时须重新核验输出。检查中的维度门槛读取隐藏宽度而非专家数，也不能推广为所有配置的等价校验。

### 开销和什么时候别开

MoE 在专家矩阵乘之外还有三类开销：router 的窄矩阵乘与选择；按专家归拢输入行、算完再散回原 token 的重排；以及跨卡时的派发与回收。[C12] 它们占多少时间取决于批次、专家负载、链路与重叠程度，不能统一断言远小于专家计算。每层的通信次数和逻辑字节数见[专家并行](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

专家数与 k 是训练定下来的结构，推理侧不能拿来当调优旋钮。其他条件相同时，增大 k 会增加选中专家的计算工作量与 token–expert 对数量；实际搬运量还取决于目的卡和实现中的复用。共享专家则是每个 token 都经过的额外计算。

R1 的 4 个源 token 在 TP8 内切片后，rank 4–7 只有补位；这些卡和另一台机器仍可能接收命中本地专家的真实工作。小批次的代价要区分源行补齐、专家实际负载与同步等待，见[专家并行的 router 那一步](expert-parallel.md#1-router-打分选出-top-8)。批次变化如何影响这些成本，见[多请求同时在跑](concurrent-requests.md)。

### 版本差异

模块化交接按四个上游正式钉点分别核对：`v0.23.0` 为 `0fc695fc`，`v0.26.0rc` 为 `568afb3a`，`v0.30.0` 主基线为 `ced6857a`，`main` 为 `ba15685a`（早先过渡比较点 `84030bbe` 见下方来源清单）。它没有统一的“开了就默认用某一专家 kernel”的开关；具体组合仍由量化方法、后端选择和支持条件决定。

| 交接约定 | `v0.23.0` (`0fc695fc`) | `v0.26.0rc` (`568afb3a`) | `v0.30.0` (`ced6857a`) | `main` (`ba15685a`) |
|---|---|---|---|---|
| 输入布局与容量 | `Standard` / `BatchedExperts` 都存在；后者必须给每端容量与派发端数，有效行元数据单列 | 相同 | 基础约定相同，元数据字段有扩展 | 新增 `FusedMoEActivationFormat.PaddedStandard`（兼容接收 `Standard` 输入）与 `ExpertTokensMetadata.rank_expert_offset`（`modular_kernel.py#L117-L155`） |
| 计算端配对检查 | 检查设备、量化、激活、并行、路由、形状和布局；两端单体/模块化类型也要一致 | 相同 | 相同 | 相同（兼容 `PaddedStandard` 布局匹配） |
| 工作区与预留形状 | 输入容量与有效行分开；BatchedTriton 采用派发端数×每端容量；部分输出与中间区可复用存储 | 相同 | 这些约定保留；CPU 分支直接分配所需张量，其他平台仍向工作区管理器取空间 | 新增 `allocate_fused_expert_output` 输出分配接口（`modular_kernel.py#L247`） |
| DeepEP 两种布局与量化 | 高吞吐 Standard、支持延后输入量化；低延迟 BatchedExperts、拒绝延后量化；两者该参数默认 false | 相同 | 相同 | 相同 |
| 加权与异步完成 | 已加权归约则跳过，委托 combine 则由回收完成；异步 prepare/finalize 需要完成回调 | 相同 | 相同；NoOP 已有输出与目标为同一对象时省自拷贝 | 新增 `supports_dbo()` 与 `supports_deferred_moe_finalize()` 能力查询，并移除旧 `on_commit` 钩子（`modular_kernel.py#L305-L315`） |
| 未量化初始化 | 由选择器筛候选，再组装通信与专家；本类旧 select_gemm_impl 直接报错 | 相同；内核设置保留权重更新时的存储地址 | 设置步骤拆出 `_init_moe_kernel`；本类不再声明旧 `select_gemm_impl`；CPU 也进入候选选择 | 同 `v0.30.0` |

这里的“相同”限定表内契约，不表示所有实现文件相同。例如 `v0.26.0rc` 的 prepare 包装另有按补位标记屏蔽专家编号的条件分支，`v0.30.0` / `main` 的同一包装不含该分支；每次真实处理的行仍须以所用 runner 和后端为准。旧设计文字的工厂名不能越过量化方法的实际初始化直接套用。下面原有 GLM/Ascend 分支与算例继续使用各自注明的版本。

`v0.30.0` 与 `main` 的共享专家具备真正移动执行时点的重叠路径：量化输入准备可提前到 router 之前；Gate-Up 则等待 `router_output` 事件后提交，与后续 top-k/dispatch 重叠。两者的启动时点不同，仅有实现入口不等于所有模型都会命中，仍受多流配置、LoRA 和量化方法能力等条件控制。正文旧 GLM 关闭多流的图与通信账单保留原范围。

**`v0.30.0` 与 `main` 的 grouped-topk 仍把选专家分数与输出权重分开。** `AscendGroupedTopKRouter` 在带 correction bias 的 grouped 分支用加偏置的分数选专家，再从 `original_weights` 取路由权重，按需归一化并乘 `routed_scaling_factor`；打分函数还支持 `sqrtsoftplus`。这个“偏置只影响选择”的结论有 grouped-topk 前提，无 grouped 的分支会直接修改 `topk_weights`。共享专家由 `AscendSharedExperts` 执行，是否复制权重由 `enable_shared_expert_dp` 单独决定，不能仅依据 SP 状态推断。

各版本都可表达本页“偏置选人、原分数算权重”的 grouped 路由规则，但分支选择、缩放次数和执行条件必须分别核对。上述旧原生回退重复缩放在 2c59ff10、2ed6cbba 也存在，不能由单组配置推出所有分支结果相同。

按四版本正式钉点核对昇腾 MoE 实现：`v0.23.0`（`2c59ff10`，GLM 固定镜像为 `db701c1f`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）：

| 核对项 | `v0.23.0`（`2c59ff10` / `db701c1f`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| router 打分与选择 | `experts_selector.py`：偏置只用于选人、原始分数归一化后乘缩放系数 [来源 7](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/ops/fused_moe/experts_selector.py#L139-L232) | grouped 分支仍取原始分数，外层回退缩放问题见上文 [C17] | `AscendGroupedTopKRouter`（`grouped_topk_router.py#L80-L127`）：grouped+bias 取原分数归一化并单次缩放，支持 `sqrtsoftplus` [C19] | 同 `v0.30.0`（`grouped_topk_router.py#L80-L127`） |
| 共享专家 W8A8 与重叠路径 | `_forward_shared_experts` 量化分支走融合反量化-SwiGLU-量化算子 [来源 10](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671)、[来源 16](https://github.com/vllm-project/vllm-ascend/blob/2c59ff10/vllm_ascend/ops/fused_moe/fused_moe.py#L726-L800) | 保留整数融合路径，新增共享输入就绪事件与 SiTU 分支 [C18] | `AscendSharedExperts`（`shared_experts.py#L64-L130`）：W8A8/W4A8 无 LoRA 走 `A8_INT_FUSED`，支持共享输入提前准备与 Gate-Up 事件重叠；权重复制仅由 `enable_shared_expert_dp` 决定 [C20][C21] | 延续 `AscendSharedExperts`（`shared_experts.py#L72-L145`），支持路由与共享专家混合量化路径 |
| 四路通信调度状态机 | `ascend_forward_context.py` 按硬件分支硬编码选路 | 延续分支选路 | 抽象 `HardwareProfile` + `select_moe_comm_method`（`ascend_forward_context.py#L373-L426`），在 `AllGather / MC2 / Fused MC2 (MegaMoe) / AllToAll` 间按动态容量选路，详见 [MoE 通信调度状态机](moe-comm-dispatch.md) | 延续状态机与动态容量选路（`ascend_forward_context.py#L420-L465`） |

main 的路径选择由 scale、具体量化类型和 LoRA 条件共同决定；枚举名称本身不能证明某次部署命中哪条路径。GLM 入口在各分支的状态见[模型总览的版本差异](glm-5-3-flash.md#版本差异)，也不能把其他模型的 SiTU 或 MXFP 分支推回旧镜像的 GLM W8A8 算例。

### 源码位置

四版模块化布局/容量、配对检查、缓冲、延后量化、完成回调、加权跳过和未量化初始化见来源 60–121；每一列使用各自固定快照，仅比较版本表列出的契约。

**模块化交接的范围。** 设计与能力表母文见来源 36–37；其中示意图用于解释分工，具体接口按当前代码核对。Standard/BatchedExperts 与有效行元数据见 38，容量、索引类型和异步能力接口见 39–40；设备、量化、激活、并行、路由、形状与布局筛选见 41。工作区接口与实际复用见 42–43；prepare 的延后量化消费、接收回调及 finalize 的完成等待见 44–45；两端类型和布局配对见 46。

有效行数确实进入 batched Triton 的边界判断，见来源 47；[E, 派发端数×每端容量, K] 的输出与工作区形状来自 48。前文 3 个专家、2 个派发端、4 行上限与 4 维输入是教学代入，不是 DeepEP 支持尺寸或设备运行记录；其有效行数沿用旧“我吃了苹果”示例。高吞吐的布局与量化位置见 49–50，低延迟的布局、拒绝延后量化、有效计数与合并加权见 51–53；跳过或委托加权的对象见 54。未量化候选选择、实际组装及旧入口报错分别见 55–57。固定 GLM 的兼容文件入口和 Ascend 自己的调用链见 58–59。以上没有新增 GPU/NPU 数值、性能或网络实测。

按「谁打分 → 谁选人 → 谁算 → 两支怎么合」读，能把本页机制对回实现。

**检索名称。** 路由专家在源码里是 `FusedMoE` 管的 `num_experts` 那一批，共享专家是挂在同一个模块下的 `shared_experts`；选人的入口是 `select_experts`，融合算子版本是 `moe_gating_top_k`，原生版本是 `_native_select_experts`，分组选择在 `_native_grouped_topk`。选择结果的两半分别是 `topk_ids`（专家编号）和 `topk_weights`（组合权重），校正偏置是 `e_score_correction_bias`，缩放系数是 `routed_scaling_factor`。路由专家的矩阵乘按专家分组进行，分到每个本地专家的行数由 `group_list` 给出。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 288 选 8、共享专家、router 建成 FP32、偏置只在 `noaux_tc` 下创建 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538` |
| 专家内部就是一个门控前馈网络（共享专家用的同一个类） | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442` |
| 选专家的入口、融合与原生分岔、原生返回后外层再次乘缩放 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L30-L120` |
| 偏置只用于排序、归一化、分组选择（原生取组内最高分） | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L139-L232` |
| 融合算子的参数：k、组数、组代表分取法、归一化、sigmoid、缩放、偏置 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L286-L312` |
| 融合算子组代表分的两种取法（0 取最高分，1 取前 2 名之和） | `vllm-ascend@db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h#L40-L56` |
| 原生实现的打分函数分支与不支持时的报错 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L340-L395` |
| 共享专家的四步计算、串行与多流开关、单独归约 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671` |
| 路由分支与共享分支怎么进来、两份结果怎么返回 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L672-L719`；`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680` |
| 路由专家的分组矩阵乘与 SwiGLU 融合 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L229` |
| 共享专家的两个投影确实带着量化缩放系数；该方案的量化类型登记为 W8A8 | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L162` |
| 多流重叠开关的默认值 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L139-L177` |

**正文证据索引。** 模型参数和 router 配置见来源 1、4，专家结构见来源 5。原生内外两次缩放分别见来源 9、6；分组取最大值和原分数归一化见来源 7；融合参数与组代表分定义见来源 8、22，单组内核的 eps、归一化和缩放见来源 35。共享整数融合、两支合并与多流默认值见来源 10、11、13–15，分组矩阵乘见来源 12。v0.23、v0.26 rc 的重复缩放对应来源 30–33；main 的包装选择见来源 21 的 532–549 行；rc2 提前提交的实际调用链见来源 34，方法实现见来源 28、29。

训练方法的原始说明见稀疏 MoE 论文 §2–4、附录 A（来源 2）和 DeepSeek-V3 §2.1.2（来源 3）：前者区分 importance 与 load 辅助损失，后者说明偏置更新、节点受限路由及仍存在的序列级辅助损失。它们支持方法解释，不证明 GLM 的训练配方与论文完全相同。

正文算式的推导口径：一层路由专家的参数量与一个 token 用到的比例按「三片矩阵 × 专家个数」静态相乘，不含共享专家、router、注意力，也不是量化后的字节数。[D] 「苹果」的 router 分数、偏置、专家输出，以及「我吃了苹果」4 个 token 在 6 个专家里各选 2 个的例子，都是为说明机制而编的示意数，不是某次真实路由的记录；sigmoid、归一化与加权求和按真实公式算。[A]

**适用边界。** 所引 GLM 配置与推理源码没有说明稠密层数量的训练权衡，也不能还原校正偏置的训练更新过程。两个公开量化描述已经取得，具体层精度见[模型权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)；它们仍不能证明现场目录、算子安装或编译后的时间关系。共享分支实际是否与路由重叠，需要部署记录与 profiling，本页没有设备实测。

- 来源 24：vllm-ascend@db701c1f，vllm_ascend/models/glm5_next.py，L1503–L1511。
- 来源 25：vllm-ascend@db701c1f，vllm_ascend/ops/fused_moe/experts_selector.py，L222–L231。
