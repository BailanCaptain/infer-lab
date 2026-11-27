---
id: lora
title: LoRA：低秩更新与多适配器推理
type: feature
legacyAnchors:
  本部署有没有开: 低秩适配怎样改变量化专家的通信路径
  复杂异构实战对照glm-双机-ep16-与量化下的-lora-边界: 低秩适配怎样改变量化专家的通信路径
summary: LoRA 不改基座权重，只在旁边挂两个小矩阵；本页从一个输出数怎么算讲到一台服务怎么同时挂多个适配器，以及 MoE 专家并行与量化模型挂接适配器时的通信和容量边界。
aliases:
  - LoRA
  - LoRA 适配器
  - LoRA adapter
  - 低秩适配
  - Low-Rank Adaptation
  - Multi-LoRA
  - 多 LoRA
  - 多租户适配器
  - PunicaWrapperNPU
  - punica
  - bgmv
  - sgmv
  - LoRARequest
  - enable-lora
  - lora-modules
  - max_loras
  - max_lora_rank
  - fully_sharded_loras
  - adapter_config.json
  - LoRA resolver
  - lora_filesystem_resolver
  - lora_hf_hub_resolver
  - VLLM_LORA_RESOLVER_CACHE_DIR
  - VLLM_LORA_RESOLVER_HF_REPO_LIST
  - default_mm_loras
  - default-mm-loras
  - enable-mixed-moe-lora-format
  - is_3d_lora_weight
  - enable-tower-connector-lora
  - lora-target-modules
chapters:
  - '17'
sources:
  - 'https://arxiv.org/abs/2106.09685'
  - 'vllm@0fc695fc:vllm/lora/model_manager.py#L273-L308'
  - 'vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L15-L49'
  - 'vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L54-L115'
  - 'vllm@0fc695fc:vllm/lora/layers/base_linear.py#L99-L145'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L589-L602'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L861-L862'
  - 'vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L21-L322'
  - 'vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L324-L451'
  - 'vllm-ascend@db701c1f:vllm_ascend/lora/utils.py#L74-L88'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2945-L2964'
  - 'vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/lora.md#L9-L30'
  - 'vllm@0fc695fc:vllm/config/lora.py#L31-L46'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/lora.md#L28-L30'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L26-L29'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lora.md#L30-L37'
  - 'vllm-ascend@baa023ad:vllm_ascend/lora/punica_npu.py#L31-L34'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L52-L68'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L369-L413'
  - 'vllm-ascend@baa023ad:vllm_ascend/lora/lora_ops.py#L460-L500'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L293-L300'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L329-L352'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L361-L368'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L487-L496'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L396-L405'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/support_matrix/supported_features.md#L10-L14
  - 'vllm@0fc695fc:vllm/v1/worker/lora_model_runner_mixin.py#L52-L68'
  - 'vllm@0fc695fc:vllm/forward_context.py#L45-L60'
  - 'vllm@0fc695fc:vllm/lora/lora_weights.py#L28-L44'
  - 'vllm@0fc695fc:vllm/lora/worker_manager.py#L285-L299'
  - >-
    raw:sha256-b766298e830c764aeee09248e6d421bf5a868e3d2b98d9a44de6321ecc6d4954.md#L1-L778
  - 'vllm@0fc695fc:vllm/lora/worker_manager.py#L258-L307'
  - 'vllm@0fc695fc:vllm/config/lora.py#L26-L26'
  - 'vllm@0fc695fc:vllm/config/lora.py#L108-L116'
  - 'vllm-ascend@7d825229:vllm_ascend/lora/punica_npu.py#L23-L75'
  - 'vllm-ascend@7d825229:vllm_ascend/lora/punica_npu.py#L210-L219'
  - 'vllm-ascend@7d825229:vllm_ascend/lora/punica_npu.py#L596-L648'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/lora.md#L15-L21'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/lora.md#L15-L21
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/lora.md
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L115-L134'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L287-L328'
  - 'vllm-ascend@921ccc52:vllm_ascend/lora/lora_ops.py#L136-L453'
  - 'vllm-ascend@921ccc52:vllm_ascend/lora/lora_ops.py#L460-L501'
  - 'vllm@0fc695fc:vllm/lora/model_manager.py#L750-L779'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1306-L1322'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3788-L3798'
  - 'vllm-ascend@db701c1f:csrc/torch_binding.cpp#L2733-L2747'
  - "vllm@0fc695fc:vllm/plugins/lora_resolvers/filesystem_resolver.py#L1-L62"
  - "vllm@0fc695fc:vllm/plugins/lora_resolvers/hf_hub_resolver.py#L1-L145"
  - "vllm@0fc695fc:vllm/lora/resolver.py#L1-L88"
  - "vllm@0fc695fc:vllm/entrypoints/openai/models/serving.py#L275-L337"
  - "vllm@0fc695fc:vllm/entrypoints/openai/models/serving.py#L106-L111"
  - "vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L211-L239"
  - "vllm@0fc695fc:vllm/plugins/__init__.py#L28-L66"
  - "vllm@0fc695fc:vllm/envs.py#L1041-L1076"
  - "vllm@568afb3a:vllm/plugins/lora_resolvers/filesystem_resolver.py#L1-L62"
  - "vllm@568afb3a:vllm/plugins/lora_resolvers/hf_hub_resolver.py#L1-L145"
  - "vllm@568afb3a:vllm/lora/resolver.py#L1-L88"
  - "vllm@568afb3a:vllm/entrypoints/openai/models/serving.py#L282-L344"
  - "vllm@568afb3a:vllm/entrypoints/openai/models/serving.py#L113-L118"
  - "vllm@568afb3a:vllm/entrypoints/serve/engine/serving.py#L40-L68"
  - "vllm@568afb3a:vllm/plugins/__init__.py#L36-L74"
  - "vllm@568afb3a:vllm/envs.py#L1103-L1146"
  - "vllm@ced6857a:vllm/plugins/lora_resolvers/filesystem_resolver.py#L1-L62"
  - "vllm@ced6857a:vllm/plugins/lora_resolvers/hf_hub_resolver.py#L1-L145"
  - "vllm@ced6857a:vllm/lora/resolver.py#L1-L88"
  - "vllm@ced6857a:vllm/entrypoints/openai/models/serving.py#L282-L344"
  - "vllm@ced6857a:vllm/entrypoints/openai/models/serving.py#L113-L118"
  - "vllm@ced6857a:vllm/entrypoints/serve/engine/serving.py#L40-L68"
  - "vllm@ced6857a:vllm/plugins/__init__.py#L36-L74"
  - "vllm@ced6857a:vllm/envs.py#L1146-L1178"
  - "vllm@84030bbe:vllm/plugins/lora_resolvers/filesystem_resolver.py#L1-L62"
  - "vllm@84030bbe:vllm/plugins/lora_resolvers/hf_hub_resolver.py#L1-L145"
  - "vllm@84030bbe:vllm/lora/resolver.py#L1-L88"
  - "vllm@84030bbe:vllm/entrypoints/openai/models/serving.py#L282-L344"
  - "vllm@84030bbe:vllm/entrypoints/openai/models/serving.py#L113-L118"
  - "vllm@84030bbe:vllm/entrypoints/serve/engine/serving.py#L40-L68"
  - "vllm@84030bbe:vllm/plugins/__init__.py#L36-L74"
  - "vllm@84030bbe:vllm/envs.py#L1170-L1207"
  - "vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L467-L472"
  - "vllm@568afb3a:vllm/entrypoints/serve/engine/serving.py#L70-L76"
  - "vllm@0fc695fc:pyproject.toml#L46-L48"
  - "vllm@0fc695fc:vllm/lora/lora_model.py#L205-L296"
  - "vllm@0fc695fc:docs/design/lora_resolver_plugins.md#L1-L219"
  - "vllm@0fc695fc:docs/features/lora.md#L1-L240"
  - "vllm@0fc695fc:docs/features/lora.md#L234-L456"
  - "vllm@0fc695fc:vllm/config/lora.py#L48-L79"
  - "vllm@0fc695fc:vllm/entrypoints/offline_utils.py#L57-L107"
  - "vllm@568afb3a:vllm/entrypoints/offline_utils.py#L57-L107"
  - "vllm@ced6857a:vllm/entrypoints/offline_utils.py#L58-L108"
  - "vllm@84030bbe:vllm/entrypoints/offline_utils.py#L58-L108"
  - "vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L241-L308"
  - "vllm@568afb3a:vllm/entrypoints/serve/engine/serving.py#L128-L197"
  - "vllm@ced6857a:vllm/entrypoints/serve/engine/serving.py#L128-L197"
  - "vllm@84030bbe:vllm/entrypoints/serve/engine/serving.py#L128-L197"
  - "vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L291-L309"
  - "vllm@0fc695fc:vllm/entrypoints/openai/models/serving.py#L142-L188"
  - "vllm@0fc695fc:vllm/lora/model_manager.py#L111-L127"
  - "vllm@0fc695fc:vllm/lora/model_manager.py#L776-L789"
  - "vllm@0fc695fc:vllm/lora/model_manager.py#L912-L1003"
  - "vllm@568afb3a:vllm/lora/model_manager.py#L938-L1029"
  - "vllm@ced6857a:vllm/lora/model_manager.py#L969-L1060"
  - "vllm@84030bbe:vllm/lora/model_manager.py#L969-L1060"
  - "vllm@0fc695fc:vllm/lora/model_manager.py#L164-L268"
  - "vllm@568afb3a:vllm/lora/model_manager.py#L179-L283"
  - "vllm@ced6857a:vllm/lora/model_manager.py#L179-L297"
  - "vllm@84030bbe:vllm/lora/model_manager.py#L179-L297"
  - "vllm@0fc695fc:vllm/lora/utils.py#L260-L299"
  - "vllm@0fc695fc:vllm/lora/model_manager.py#L672-L691"
  - "vllm@ced6857a:vllm/lora/model_manager.py#L416-L502"
  - "vllm@0fc695fc:vllm/entrypoints/offline_utils.py#L523-L550"
  - "vllm@568afb3a:vllm/config/lora.py#L49-L86"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L258-L267"
  - 'vllm-ascend@c09d3e20:vllm_ascend/lora/punica_npu.py#L23-L75'
  - 'vllm-ascend@c09d3e20:vllm_ascend/lora/punica_npu.py#L216-L236'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L396-L406'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/lora.md#L1-L45'
  - 'vllm-ascend@8d6180e2:vllm_ascend/lora/punica_npu.py#L23-L75'
  - 'vllm-ascend@8d6180e2:vllm_ascend/lora/punica_npu.py#L648-L672'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L443-L453'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/lora.md#L1-L45'
  - 'vllm@ba15685a:vllm/config/lora.py#L31-L55'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 先理解线性层输入、权重与输出形状。
  - to: concurrent-requests
    kind: builds-on
    note: 不同适配器的请求可以共同组成执行批。
  - to: acl-graph
    kind: builds-on
    note: 适配器状态参与捕获图分派。
  - to: npu-model-runner
    kind: builds-on
    note: ModelRunner 在加载期替换 LoRA 线性层，并在每步前向刷新活跃适配器与槽号映射。
  - to: expert-parallel
    kind: builds-on
    note: MoE 模型同时开启 LoRA 与 EP（ep_size > 1）时，因融合 MC2 无法插入低秩旁路，v0.26 起会强制切换至 ALLTOALL 通信。
  - to: batch-invariance
    kind: builds-on
    note: 多适配器混批与单槽快路会随批形状切换算子路径，需要逐位一致性验证时需对照批不变限制。
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-b766298e830c764aeee09248e6d421bf5a868e3d2b98d9a44de6321ecc6d4954.md
  - >-
    raw/sha256-fb2709d94e04020f3db8b15c0611f0eed1fe5b225a09db2ed84e1a2903a38e43.md
---

## LoRA 是什么：基座一个数不动，旁边挂两个小矩阵

一个线性层做的事，是把输入向量乘上一张权重表 W，得到输出（这一步怎么乘见[矩阵乘法与权重](matmul-and-weights.md)）。想让模型学会一个新任务，最直接的办法是把 W 里每个数都重训一遍，这叫全参数微调。

LoRA（Low-Rank Adaptation，低秩适配）换了个办法：**基座权重 W 一个数都不改**，在它旁边挂两个小矩阵 A 和 B。A 把输入压到很窄的 r 维，B 再把这 r 维抬回输出宽度。于是这一层的输出变成两路相加：

- 原来那一路：输入 x 乘基座 W，和没挂之前完全一样；
- 新挂的那一路：x 先乘 A 压窄、再乘 B 抬回来，乘一个固定比例 s 之后加上去。

三个名字先说清楚：中间那个窄维度叫**秩**（rank）r，常见取 8、16、32；一次微调在所有被挑中的层上留下的那一包 A、B，合起来叫一个**适配器**（adapter）；加回去时乘的那个固定系数叫**缩放**（scaling）s。在 vLLM 的权重加载实现中，没有显式提供缩放时采用 `s = α / r`，这里的 r 是适配器的实际秩，α 是训练时定的超参，跟着适配器一起存下来；显式提供缩放时则采用给定值。一个适配器通常覆盖好几类层的多对 A、B，不是整个模型只有两个小矩阵。

服务保留这条计算旁路，以便按请求选择适配器；使用适配器时，要多算“压窄、抬回”两次乘法，并为适配器权重和中间结果留出存储空间。一线在 `v0.30.0` 主基线上开 `--enable-lora` 前先记住三条硬规矩：**① 设备显存按 `--max-loras × --max-lora-rank` 预付**（不挂适配器就别开总开关）；**② `max_loras=1` 在 A2/A3 上有 Triton 融合快路，但 `max_lora_rank >= 128` 会静默退回纯 PyTorch 慢路径**；**③ MoE 模型同时开 `LoRA + EP>1` 会强制切至 `ALLTOALL` 通信**（已支持非量化与 W8A8 动态量化，不支持 Fused MC2 与动态 EPLB）。

```wiki-diagram
file: lora
```

## 为什么需要它：换个任务不必再存一份模型

设想同一个基座模型要服务客服、法务、代码三类任务。按全参数微调，每类任务都要另存一整份权重：今天的大模型一份就是几十 GiB。如果三份都要同时常驻设备，就得为三份完整权重准备容量；也可以复用设备、按任务切换加载，但要付出搬运整份权重的代价。

把它想成印刷车间——**搬来四台笨重铸铁印刷机挤爆地面 vs 只摆一台共享黄金母机、旁挂一排随插随换的轻量套色板**：

```wiki-diagram
file: lora-plate-shared-press-stencils
```

LoRA 要另存的只有 A、B。一层上是 `r × (d_in + d_out)` 个数，而完整更新是 `d_in × d_out` 个。举个示意尺寸：一个 1024 进、1024 出的线性层有 104.9 万个数，秩 8 的一对 A、B 只有 `8 × (1024 + 1024) = 16384` 个，约 1.6%。层越宽、秩越小，这个比例越小。

省下来的不只是硬盘。基座既然没被改过，服务时**基座只装一份**，多个适配器同时挂着，哪条请求要哪个适配器，就在属于它的那几行计算里多加对应的那一路；挂不同适配器的请求还能拼进同一批一次算完。

代价也在这里：更新量被关在秩 r 这个很窄的空间里，能表达的变化比全参数微调少。秩开大能多表达一些，显存和计算也跟着涨。

## 怎么算：一个输出数是怎么攒出来的

按行向量写，设输入宽 `d_in`、输出宽 `d_out`、秩 r：

`y = xWᵀ + s(xAᵀ)Bᵀ`

其中 W 的形状是 `[d_out, d_in]`，A 是 `[r, d_in]`，B 是 `[d_out, r]`。

拿一个缩到能手算的示意例子走一遍（数值为示意，公式与实现一致）：设 `d_in = 4`、`d_out = 3`、`r = 1`、`s = 1`（即 α 等于 r）。取输入 `x = [2, 1, 1, 0]`，适配器 `A = [1, 0, −1, 0]`、`B = [1, 2, −1]ᵀ`，基座 `W` 的三行分别为 `[1, 0, 1, 0]`、`[1, 1, 1, 0]`、`[2, 1, 0, 0]`。盯住输出的第 2 个数：

1. 原来那一路照常算：`x` 和 W 的第 2 行逐位相乘再相加，`2×1 + 1×1 + 1×1 + 0×0 = 4`（三行都这么算，得到 `[3, 4, 5]`）；
2. 新挂的那一路先压：`xAᵀ = 2×1 + 1×0 + 1×(−1) + 0×0 = 1`，四个数被压成 1 个数；
3. 再抬：这个 1 乘 B 的第 2 行 `2`，得到 2，这就是这一路给第 2 个数的更新量；
4. 两路相加：`4 + 2 = 6`。

三个输出数都这么走一遍，更新量是 `[1, 2, −1]`，最终输出 `[4, 6, 4]`。基座那一路每个数都要算，低秩那一路只是加在它上面。

参数上，这一层的适配器是 `1 × (4 + 3) = 7` 个数，完整更新要 `4 × 3 = 12` 个。维度越大、秩越小，差距越夸张——上一节那个 1.6% 就是同一个式子算出来的。

还有一处服务侧的实际形态要提前说明：真跑起来时，权重加载阶段就把 s 乘进 B 里存好，之后每步都按 s 等于 1 算，所以设备上看不到一次单独的「乘 s」。

## 一台服务怎么同时挂多个适配器

多个适配器要在同一批里混着算，靠的是**槽号**。注册适配器时，每个适配器拿到一个全局唯一的编号；设备上另有一张槽位表，长度等于「一步里最多同时出现几个不同适配器」这个名额，适配器被启用时塞进表里第一个空位，**那个空位的下标才是槽号**。

每步前向之前，引擎把「这一行属于哪个请求、那个请求挂哪个适配器」翻成一条和这批行数一样长的槽号表，**没挂适配器的行填 −1**。比如某批四行是 `[0, 1, 0, −1]`：四行都要算基座那一路，第 1、3 行再加槽 0 的更新，第 2 行加槽 1 的更新，第 4 行什么都不加。同一适配器也不用在批里连成一段出现——例子里槽 0 就隔着一行出现了两次。两路不是二选一的岔路；算子依据槽号跳过无适配器的行，或用掩码把其更新量置零，因此挂与不挂的请求可以放在同一批。多条请求怎么拼进一批见[并发请求](concurrent-requests.md)。

几件容易记反的事：

- 设备显存是**按名额预付**的：建层的时候就按「名额 × 最大秩 × 这一层在本卡上的分片形状」把位置全开好，实际加载了几个适配器不影响这块占用；最大秩写大而适配器实际秩小，多出来的行留着零也照样占地。
- 正常调度时，超出名额的请求会等待：调度器发现这一步已排进的适配器数到了上限、新来的请求要的又不在其中，就把它放进本步跳过队列，不堵在队首（这道闸在[调度器](vllm-scheduler.md)里）。底层仍会检查实际传入的适配器数和可用槽位，超限可报错。

所以名额为 1 时，多条请求仍可共用同一个适配器进入当前批次；是否实际入批，还要满足其他调度条件。
- 默认值很保守：名额默认 1，最大秩默认 16。想同时服务多个适配器，必须显式调大。

- 旧部署的普通线性层旁路使用按段乘：把相邻且同槽的行合成一段。上游 V1 映射恒标为 [prefill](prefill.md)，所以这条路径在 decode 时也按段选择；相邻请求用了同一个适配器，还会合成同一段。MoE 和 logits 有直接按行乘的独立入口，新版本还有单槽快路与 310P 图捕获例外，不能把普通线性层的选择推广到全部 LoRA 运算。

## 请求只写适配器名，服务怎样找到权重？

**LoRA resolver 是按请求中的名字查找适配器目录的组件。** 前端先认出基座名或已注册的适配器；遇到尚未注册的名字，开启运行时更新后，才让 resolver 去找候选目录。找到目录以后，还要由引擎真正加载并检查权重；成功注册后，这条请求才能继续使用它。这个入口位于 [API server 的请求检查](api-server-entry.md)，设备上的槽号和低秩乘法仍按前文运行。

这适合适配器数量多、希望首次使用时再装入的场景。代价是第一条请求要等待查目录、读取文件或远端下载，再等待引擎加载；后续设备计算与缓存容量也照样消耗资源。启动时注册、手动动态装卸和按名字自动查找，是三种触发加载的方式，不是三套 LoRA 算法。

```wiki-diagram
file: lora-resolver-loading
```

用 task-lora 作为适配器名做示意：本地根目录是 /models/lora，请求选择 task-lora 时，文件 resolver 检查 /models/lora/task-lora/adapter_config.json。配置必须声明这是 LoRA，并且训练基座字段与服务实际加载的模型标识或路径完全一致。这里比较的是加载基座所用的值，不是另起的对外服务别名；即使两个名字指向同一套权重，字符串不同也过不了这项匹配。

配置匹配只说明“这里有一个候选”。哪怕目录里尚无权重文件，resolver 也能交出候选地址，缺失或不兼容的权重要到引擎加载时才暴露。引擎加载成功才登记这个名字；请求随后走正常的适配器选择、调度和执行。

同一前端对象会用按名字的锁合并并发查找：第二条同名请求等第一条完成，再复用已登记对象。锁属于该前端对象，多个 API 进程各有自己的锁与登记状态。已经登记的名字不会每次请求都重新查目录，因此修改磁盘文件不会自动把正在使用的适配器刷新成新版本；更新要走明确的装卸流程。

远端 Hub resolver 先检查允许的仓库和包含适配器配置的子目录，再下载相应文件，最后复用同样的基座匹配规则。它会缓存查到的子目录清单，也没有在下载调用中传入适配器 revision：基座的固定版本不会自动变成适配器的固定版本。需要固定材料时，可先把选定版本准备为本地目录，再按本地方式加载。官方的自定义存储示例展示了扩展接口，不能把示例里的 S3 resolver 当作已内置的第三种插件。

## 带图片或音频时，怎样自动选适配器？

有些多模态模型要求：请求带某种媒体时，就使用配套的适配器。**默认多模态 LoRA 把“媒体种类 → 适配器路径”交给引擎，让它按请求内容选择。** 它解决的是选哪一份适配器；前面的槽位名额仍管一批里能同时使用几份，而媒体特征复用由[多模态特征缓存](multimodal-encoder-cache.md)按媒体内容键独立管理——仅挂语言模型 LoRA 时不影响视觉编码缓存，若同时启用视觉编码器（`tower`）或连接层（`connector`）LoRA，则须单独核实缓存键与适配器身份的隔离条件。

例如注册“音频 → A、图片 → B”（示意）：只带音频的请求可自动选 A；只带图片的可选 B；同一请求同时命中这两个默认项时，不会把 A、B 两套更新叠加，而是跳过默认选择。固定实现每个 prompt 只选一个适配器。若调用者已经显式指定了适配器，仍优先保留那一份；“跳过默认项”不等于清除显式选择。

入口也影响怎样识别媒体。离线路径看预处理后真正留下的媒体占位类型；HTTP chat 路径按消息 content 的 type 匹配，所列四版取第一个下划线之前的部分。例如 audio_url 匹配 audio，而 input_audio 得到 input，不能仅因二者都携带音频就认定自动选择相同。HTTP 实际匹配的是已登记的适配器名，手动登记为 audio 或 image 的同名适配器也会参与这种匹配。媒体输入本身怎样处理，见 [API 的多模态入口](api-server-entry.md#一张图片进来怎样和文字一起交给模型)。

选中适配器，也不意味着它覆盖视觉编码器或连接层。**给语言模型挂 LoRA，与给媒体编码器（`tower`）、跨模态投影连接层（`connector`）挂 LoRA，是不同的启用范围。** 媒体编码器处理的行数、连接层处理的行数和最终进入语言模型的媒体 token 数可能不同；旁路必须为每个部件准备正确的行数与槽号映射，否则会把更新加到错误位置。因此 tower / connector 路径还要求模型实现相应计数接口，并单独准备计算包装与容量；不能看到模型支持普通 LoRA 就推断视觉部分也支持。

## MoE 适配器的二维、三维格式为什么要声明？

这里的二维、三维说的是**专家权重怎样组织**，不表示适配器有几份，也不是 LoRA 的秩。逐专家形式给每个专家分别保存投影的 A、B；融合形式把专家及部分投影组织进合并的张量，加载时要按专家和投影拆装，才能接到运行时的槽位。

固定上游提供混合格式模式，让同一个引擎接受两类 MoE 适配器，并用统一的运行包装处理；声明为融合格式的适配器会先经过转换。代价是增加加载期的整理步骤，仍要满足模型、专家分片、权重名称和形状的契约。它没有重新训练适配器，也不会替调用者确定文件究竟是哪一种布局。

尤其要检查声明：混合模式信任调用者给出的二维/三维标志，不先自动验证 checkpoint 格式。**声明错了可能在加载时不报错，却把权重放进错误的缓冲，得到错误输出。** 没开混合模式时，运行包装由基座的 MoE 布局决定，适配器必须与之匹配；非 MoE 模型也不使用这个格式标志。具体开关见下方“怎么开”，这里的上游格式能力不改变后面 Ascend 的组合限制。

## 昇腾上是谁在算这一路

上游 vLLM 把「在同一批里按槽号取小矩阵、给各行叠加各自低秩更新」的算子框架称为 **Punica**（源自多租户 LoRA 批处理论文 *Punica*），并将其做成可替换的插件位，由平台启动时交出一个类名。昇腾交出自己的 `PunicaWrapperNPU` 实现：槽号表、段的起点、是不是 prefill 这些元数据全用上游算好的，自己只重写乘法入口。真正做乘法的是昇腾用 AscendC（昇腾的算子编程语言，见[算子与核函数](ops-and-kernels.md)）写的四个核函数，对应两种批量乘模式：
- **SGMV（Segmented Gather Matrix-Vector，按段聚集乘）**：把连续相同槽号的行合成一段一起压窄（`sgmv_shrink`）和抬回（`sgmv_expand`）；
- **BGMV（Batched Gather Matrix-Vector，按行聚集乘）**：按每行各自的槽号直接索引矩阵压窄（`bgmv_shrink`）和抬回（`bgmv_expand`）。

它们注册成 torch 算子后，由 Python 侧的一层薄包装调起，源文件与注册入口见「对照源码 › 源码位置」。层替换表里也插了昇腾自己的 LoRA 层类，这样昇腾自建的线性层同样换得上；[ModelRunner](npu-model-runner.md)（模型运行器）则在加载期挂上适配器，每步刷新「这一步谁在用哪个」。

下面这张图把多适配器槽号混批、`PunicaWrapperNPU` 在 `v0.30.0` / `main` 上的三条快慢执行路径，以及 310P 与 MoE EP 边界收在一屏里：

```wiki-diagram
file: lora-fig-punica-paths
```

沿图看清三处最容易踩坑的边界：

- **MoE 模型的双层索引**：适配器索引还要和专家索引组合起来，对展开后的专家输入行算更新、再结合路由权重，比普通线性层多一层索引关系（token 怎么分派到专家见 [MoE](moe.md)）。
- **310P 与大秩静默退回纯 PyTorch**：旧部署在 310P 上，或最大秩设到 128 及以上时，会把 SGMV/BGMV 绑定到上游的纯 PyTorch 实现。`v0.30.0` 起改为检查 `HardwareProfile`（昇腾四家族硬件能力档案，见 [v0.30.0 升级清单](v030-release-baseline.md)）的 `LORA_CUSTOM_OPS` 能力位，或判定 `max_lora_rank >= 128` 走同一退路，且该选择分支没有专门提示日志。新版单槽（`max_loras=1`）路径还会另选 Triton 融合或 matmul 实现。
- **ACL Graph 捕获分桶**：批描述符记录「这一批带不带 LoRA」和「这一步有几个活跃适配器」，但捕获哪些组合由配置决定。旧上游在启用 LoRA 图专化时分别准备带与不带适配器的图；进一步启用活跃数量专化后，才把适配器数映射到捕获的数量档位。未启用数量专化时，各个非零数量共用同一个数量键；找不到匹配图时，允许 `NONE` 模式才回到普通执行，否则断言报错（图模式见 [ACL Graph](acl-graph.md)）。旧昇腾指南推荐图模式，同时对应支持矩阵将 LoRA 标为 Experimental（实验性支持）。

## 低秩适配怎样改变量化专家的通信路径

在带专家并行（`EP`）与量化的 MoE 部署上评估挂接 LoRA 时，需要把**旧版支持矩阵、正式版 `ep_size > 1` 通信改道规则和具体模型验收**三件事分开核对（例外 B 的 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)官方在线命令未传 `--enable-lora`，[示例请求](one-request.md)仅走基座通路）：

1. **旧版文档支持矩阵**：历史绑定镜像（及 `v0.23.0` / `v0.26.0rc`）的昇腾特性文档明确写出，当时 MoE 模型挂 LoRA 不支持 **expert parallel 与量化**，而该双机配置同时启用了 `EP16` 与 `W8A8`（见 [Expert Parallel](expert-parallel.md)、[量化](quantization.md)）。
2. **正式版 `ep_size > 1` 的强制通信选择**：在 `v0.30.0` 与 `main` 中，支持矩阵已放开非量化及 `W8A8` 动态量化配 `AllGather / All-to-All`（Fused MC2 与动态 EPLB 仍不支持）。一旦同时启用 `LoRA` 与 `EP` 且 `ep_size > 1`，引擎会在按硬件挑路之前将 MoE 通信强制切为 **`ALLTOALL`**（`ep_size == 1` 走 `ALLGATHER`），因为融合 `MC2` 核内部无法插入低秩旁路；原本双机 `EP16` 小批 decode 依赖的 `MC2` 快路径会随之改道。
3. **实际异构模型验收独立于通用矩阵**：通用矩阵放开 `W8A8_DYNAMIC + ALLTOALL` 不等于 `GLM-5.3-Flash` 或特定适配器已完成端到端精度与时延验收，改道后的跨机带宽与吞吐仍须实测。

再看参数量与运行期显存的账目边界：以隐藏维 `4096` 为例，单个 `4096 × 4096` 线性层含 $16{,}777{,}216$ 个参数，秩 `r = 16` 的一对 `A、B` 含 $2 \times 4096 \times 16 = 131{,}072$ 个参数，单层参数比例为 $2 \times 4096 \times 16 / 4096^2 = \mathbf{0.78125\%}$（约 **0.78%**）。作为基座体量参照，`3121f187` 量化快照下每卡所列语言权重子账约 **`20.58 GiB`**（未含视觉塔、MTP 旋转矩阵等表外项，详见[部署页的量化版本与视觉塔](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)）。注意 `0.78125%` 仅是单个同维线性层的静态参数比例；运行期按 `--max-loras × --max-lora-rank` 预分配的设备槽位、中间激活缓冲以及基座量化元数据均须另计。

## 常见误解

- **「MLA 里的 `kv_lora_rank` 就是 LoRA。」**——只是撞了名字。那是 [MLA](mla.md) 把 KV 压成低秩隐向量时的宽度，写死在模型结构里，和外挂适配器没有关系。
- **「挂 8 个适配器就比挂 1 个多占 8 倍显存。」**——配置容量不变时，设备上预分配的 A、B 槽位占用不随实际加载数改变；CPU 缓存则随加载数量增长，直到触及缓存上限。若把配置名额从 1 调到 8，预分配槽位本身也会增加。
- **「名额就是能注册的适配器总数。」**——名额管的是**一步里能同时出现几个不同适配器**；CPU 侧那个上限管的是同时缓存几份，满了就按最久没用的换出去，下次要用再从盘上加载，并不是能注册的总数。正常调度会推迟超额请求，底层容量校验仍然存在。

只有请求的适配器 ID 尚未缓存，或明确要求用新权重替换同 ID 的旧对象时，才进入加载分支：先加载新适配器，成功后移除同 ID 的旧对象，再检查容量，必要时淘汰最旧的缓存适配器，最后加入新对象。普通缓存命中则只更新最近使用记录并激活已有对象。加载分支中，新对象完成加载时旧对象尚未移除，因此缓存份数上限不能直接保证加载过程的主机内存峰值。
- **「秩减半，开销就减半。」**——按适配器实际形状计算，参数数目和理想乘加量与秩成正比；旧版设备路径却按配置的最大秩分配 A、B 和「行数 × 最大秩」的 float32 中间缓冲。只降低适配器实际秩、保持配置不变，不会让这些分配减半。即使连配置也调小，压和抬的启动开销仍在，时延也不能按比例推算；完全分片和新版融合路径需分别看其形状与执行方式。
- **「论文说 A、B 可以并回 W、推理零额外开销，那服务上就不该有额外算子。」**——同一组请求都使用同一个适配器时，可以先把它的更新合并到 W；按任务切换时也可以撤回旧更新、再合入新更新。限制在于：同一份已经合并的 W 不能同时代表混批中各请求不同的适配器。要共享一份基座又在同批选择不同适配器，本页实现就保留槽号和低秩旁路。

## 对照源码

### 怎么开

- 总开关 `--enable-lora`；`--lora-modules` 在启动时注册适配器，一个 JSON 一个 [S12]。
- 三个参数：`--max-loras`（一步里的名额，默认 1）、`--max-lora-rank`（最大秩，默认 16，取值限定在 1/8/16/32/64/128/256/320/512）、`--max-cpu-loras`（CPU 侧缓存份数，不写就等于名额）；字段声明见来源 13，最大秩的允许集合见来源 33，CPU 缓存份数的默认归一化见来源 34。[C13]
- 本部署没开这个开关：双机教程的启动命令与[部署前提](glm-5-3-flash-two-node.md#部署前提)里都没有 LoRA 相关项。

**注册名决定请求选谁。** 官方指南用 `name` 注册适配器，`path` 指向包含 `adapter_config.json` 和权重的 PEFT 目录，`base_model_name` 填写要展示的基座关系。下面是面向 `v0.30.0` 主基线 `Qwen/Qwen3-8B` 的配置形式示例（假设适配器秩为 8，未在设备上执行；上游 `2026-11-02` 指南原例以 `Qwen/Qwen3.5-27B` 演示同一 JSON 结构）：

```bash
vllm serve Qwen/Qwen3-8B \
  --enable-lora --max-loras 1 --max-lora-rank 8 \
  --lora-modules '{"name":"task-lora","path":"/models/task-lora","base_model_name":"Qwen/Qwen3-8B"}'
```

请求同一个 /v1/chat/completions 接口时，model 填 task-lora 选择这份适配器；填服务的基座名称且没有命中默认多模态适配器时，才只用基座。base_model_name 不是客户端选名，基座名称以 served-model-name 或服务实际公布的名称为准。例如请求体可写：

```json
{"model":"task-lora","messages":[{"role":"user","content":"用一句话解释 LoRA。"}],"max_tokens":64,"temperature":0}
```

`/v1/models` 返回的适配器卡中，id 是注册名，root 是适配器路径，parent 是已记录的基座名；未记录时回退到服务的第一个基座名。固定前端只在提供的 base_model_name 属于本服务基座列表时记录它。因此 parent 表达服务展示的关系，不是训练来源证明，也不能替代权重兼容检查。

默认多模态适配器用 `--default-mm-loras '{"audio":"/models/audio-adapter"}'`，Python 对应 `default_mm_loras={"audio": "/models/audio-adapter"}`；默认未设置，仍需 enable-lora 与足够的最大秩。服务器将默认项按模态名注册进静态适配器列表；离线自动分配的 ID 按已配置模态名排序，从 1 开始，混用显式 LoRARequest 时要留意 ID。固定指南给出的入口是 generate 与 chat completions；本页示例按这两条入口解释，不据此保证其他任务或模型适用。

混用 MoE 格式的开关是 `--enable-mixed-moe-lora-format`，默认 false；启用后，启动 lora-modules 的 JSON 或动态装载 JSON 用 `is_3d_lora_weight` 声明每份适配器：逐专家格式为 false，融合格式为 true。未开启混合模式、或模型不是 MoE 时，该字段不决定包装选择。不能把改一个布尔值当成文件格式转换。

若适配器要覆盖媒体编码器和连接层，还需 `--enable-tower-connector-lora`，默认 false；模型声明、计数接口与实际后端必须支持。只想选择部分投影可用 `--lora-target-modules o_proj`，对应配置 target_modules，默认 None；匹配还会考虑模型的融合父子模块映射，因此配置名与运行时模块名未必逐字相同。该选项改变部署时应用的范围，既不生成缺失的适配器权重，也不保证任意层都能替换成功。

需运行中装卸时，官方指南将生产使用限定在隔离且完全可信的环境；启动前设置 VLLM_ALLOW_RUNTIME_LORA_UPDATING=True，并保留 enable-lora。向 /v1/load_lora_adapter POST 包含 lora_name、lora_path 的 JSON；卸载向 /v1/unload_lora_adapter POST lora_name。检查装卸响应后，再用该名字发请求核对；卸载适配器不卸载基座。MoE 的融合三维权重还须匹配 is_3d_lora_weight 与实际文件布局，不能只改名字复用不兼容权重。

**按名字自动查找还要启用 resolver。** 保留上述 LoRA 总开关和运行时更新开关；本地方式将 `VLLM_LORA_RESOLVER_CACHE_DIR=/models/lora` 设为已存在的目录，并把真实适配器放到 /models/lora/task-lora。请求仍用 model=task-lora，不必先为它写启动时的 lora-modules。前提是保留模型名校验；若关闭校验，使任意名字提前被视作基座支持，就不会走这个未知名查找入口。

| 配置 | 默认与实际作用 |
|---|---|
| VLLM_ALLOW_RUNTIME_LORA_UPDATING | 默认 false；去首尾空白并转小写后，1 或 true 开启运行时更新 |
| VLLM_LORA_RESOLVER_CACHE_DIR | 默认未设置；设置有效目录后，文件插件才登记 resolver |
| VLLM_LORA_RESOLVER_HF_REPO_LIST | 默认未设置；Hub 允许仓库列表，如 org/adapters，逗号分隔；请求名可用 org/adapters/task-lora |
| VLLM_PLUGINS | 未设置时通用加载器发现全部插件；显式设置时只保留列出的入口名，不重新排列执行顺序 |

Hub 方式有额外门槛：除非仓库列表非空，且 VLLM_PLUGINS 显式包含 **lora_hf_hub_resolver**，它不会登记。文件插件入口名是 lora_filesystem_resolver；如果原来使用插件白名单，也要保留它。逗号列表不自动去每项空白，避免在逗号后加空格；空字符串也不等于“未设置”。白名单影响平台和通用插件，昇腾部署应保留既有平台入口，不能用只含 resolver 的值覆盖整个配置。

基座匹配读取 adapter_config.json 中的 peft_type=LORA 与 base_model_name_or_path，后者对照 ModelConfig.model。它与手动注册里提供的 base_model_name、HTTP 对外别名不是同一个校验入口。未使用 Tensorizer 时，旧基线加载器优先读 adapter_model.safetensors，再尝试 adapter_model.bin 或 adapter_model.pt；官方示例里的 bin 不是唯一文件格式。文件存在、基座字符串匹配和秩/模块/设备兼容分别核对。

### 会报什么错

多模态默认项命中不唯一时，固定离线路径发出警告并保留显式适配器；没有显式项就不应用默认适配器。HTTP 默认选择则直接返回无默认项。混合 MoE 格式声明错误并不保证加载失败，必须先核实文件布局，再核对模型输出。旧 tower 路径在模型缺少所需接口时会提示并忽略该部分，连接层接口缺失也会单独提示；开关被解析不代表编码器已挂上 LoRA。

自动查找要区分没有候选和候选加载失败：所有 resolver 都没有找到匹配项时返回 404；已经找到候选，但所有引擎加载尝试都失败时返回 400。引擎加载失败会继续尝试下一个已登记 resolver；resolver 自身读取配置或下载时抛出的异常位于这段加载捕获之外，不能一概期待自动换下一个。坏 JSON、配置缺少必需键要先修文件，基座不匹配则不会产生该候选。

本地根目录不存在或不是目录，文件插件登记时会报 ValueError。成功找到配置也不表示权重已读入：缺少权重文件由实际加载层报错。先用基座请求确认服务可用，再用适配器名发请求并检查加载结果；不要用关闭模型名校验来绕过定位失败。

- 正常调度发现新适配器会超过本步名额时，将请求放进跳过队列 [C6]。直接传给 worker 的适配器集合过多会抛出 `RuntimeError`（来源 32）；底层激活找不到空槽还会抛出 `No free lora slots`（来源 2）。
- 旧部署在 310P 上或最大秩 ≥ 128 时，将 SGMV/BGMV 绑定到上游纯 PyTorch 函数，该分支没有提示日志 [C8]。
- `--max-cpu-loras` 写得比 `--max-loras` 小，启动时直接报错；对应上方参数组的来源 34，在配置校验中抛出 `ValueError`。
- 想确认哪个适配器进了哪个槽，看启用时打的 debug 日志，里面写了适配器编号与槽位下标 [C2]。
- CPU 侧缓存满了也不报错：加载成功后发现超过容量，就按 LRU 换出最久没用的那一份 [C30]，下次再要它就重新从盘上加载。

### 开销和什么时候别开

首次请求的查找、下载与加载时间都进入该请求的等待。多个 resolver 按实际登记顺序尝试，VLLM_PLUGINS 中的先后位置不构成优先级配置。Hub 子目录清单缓存在 resolver 对象内，新加远端子目录不会每次请求都重扫；已登记名字又有前端复用，两层状态要分开判断。若已有固定适配器集合且希望启动时暴露加载错误，启动注册更直接；本地目录的可见范围由文件系统与部署权限控制，缓存目录参数本身不提供路径隔离。

内置 Hub resolver 明确声明不面向生产环境；正式部署可先将选定版本的适配器准备到受控本地目录，再使用固定集合注册或本地查找，避免把请求时自动远端下载当作生产部署配方。

- 预付：建层时按「名额 × 最大秩」把 A、B 的位置全部开好，与实际加载数无关 [C5]；开启 `fully_sharded_loras` 时，列并行层上这一维还会按 TP 份数再切。
- 旧版普通线性旁路分为压、抬两步，按段（SGMV）与按行（BGMV）入口都在；上游映射恒传 `is_prefill=True` [C27]，所以普通线性层的选择器在 decode 也走 SGMV。MoE 和 logits 直接调用 BGMV，不经过这个选择器，见来源 9；新版单槽路径另见版本表。
- 不打算挂适配器就别开总开关：层被替换、槽位被预付，都是白花。
- MoE 模型上，钉住版本里 EP 与量化这两个组合官方明说不支持，本部署两样都占；固定 main 开着 LoRA、EP 且 EP 组大于 1 时会强制 All-to-All [C25]，而本部署在 A2 上平时只在 MC2 与 AllGather 之间二选一。
- 缩放系数在加载阶段就被乘进 B 并把 `scaling` 置 1 [C29]，所以运行时看不到单独的乘 s；`s = α / r` 的定义也在同一处。
- 图执行的两个描述符字段见来源 28，runner 传值见来源 11；真正的捕获组合和数量归一化分别见来源 41、42。旧版支持矩阵将特性标为 Experimental [S26]。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；**本文 GLM-5.3-Flash 双机对照沿用例外 B 专用镜像钉点 `db701c1f`（配套 `vllm@0fc695fc`），与四版社区分支分别核对。**

| 昇腾与上游核验项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 硬件支持与 PyTorch 退路 | 写死判 `310P` 或 `max_lora_rank >= 128` 退回 PyTorch [C8] | 同 `v0.23.0` [C15] | 指南标明支持 Atlas 300I Duo（310P）/ A2 / A3；`punica_npu.py#L32-L50` 改查 `HardwareProfile` 能力位 `LORA_CUSTOM_OPS` 或 `max_lora_rank >= 128` 退回 PyTorch；310P 图捕获经 `_use_sgmv()`（`#L216-L219`）改走 BGMV | 同 `v0.30.0`；`punica_npu.py#L648-L672` 新增 `apply_lora_full_linear`（FP32 einsum 适配分类头，避开 BGMV shrink 的精度与维度限制） |
| MoE 挂 LoRA 的 EP 与量化 | 官方文档标明 EP 与量化均不支持 [S12] | 同 `v0.23.0` [S14] | 非量化与 W8A8 动态量化 × AllGather / All-to-All 四格均标 Supported；其他量化、Fused MC2 与动态 EPLB 仍不支持 [S16] | 同 `v0.30.0`（`docs/source/user_guide/feature_guide/lora.md#L1-L45`） |
| `LoRA + EP` 通信强制路径 | 无 LoRA 特判，按硬件默认选择 | `ep_size > 1` 且开 LoRA + EP 时在硬件选择前强制 `ALLTOALL`（`ep_size == 1` 走 AllGather），因 MC2/FusedMC2 无法插入低秩旁路 [C24] | 延续强制 `MoECommType.ALLTOALL`（`ascend_forward_context.py#L396-L406`） | 延续强制 `MoECommType.ALLTOALL`（`ascend_forward_context.py#L443-L453`） |
| 单适配器快路（`max_loras=1`） | 无快路，统一走 SGMV/BGMV | A2/A3 且配置 `max_loras=1`、未开 `fully_sharded_loras` 时切普通 matmul + 掩码 [C18] | 抽为自定义算子并优先 Triton 融合（A2/A3、BF16、`r in {8,16,32,64}`、`T <= 128`，大输出宽度更严门槛；分类输出宽 `< rank` 退 matmul）[C20] | 同 `v0.30.0`（均按配置名额 `max_loras=1` 判定，非当前批恰好 1 个适配器） |
| ACL Graph 参数表 | 1 份 `GraphParams` [C21] | 按 `has_lora` 拆成两份（仅 FULL 图按批描述符选） [C22] | 合并回 1 份，不再按 `has_lora` 拆分 [C23] | 同 `v0.30.0` |
| 上游多模态/MoE 格式与 Resolver | 默认多模态按模态选 1 个（显式优先）；混合 2D/3D 默认关；内置文件/Hub resolver 与同名锁 | 公共 HTTP 入口迁至 `serve/engine`；MoE 转换改从包装对象取专家信息；新增 `shared-outer` 开关 | tower 改查模型能力声明并按模态取计数；显式目标层与默认支持层分开筛选；Resolver 规则一致 | 延续 `v0.30.0` 契约（`vllm@ba15685a:vllm/config/lora.py#L31-L55` 保持默认 `max_loras=1`、`max_lora_rank=16`） |

单槽融合快路的精细门槛（如输出宽度 $\ge 8192$ 时秩 $\le 16$ 最多 32 token、较大秩最多 64 token；输出宽度 $\ge 5120$ 且秩 $\ge 16$ 时最多 64 token；以及需 Triton 可用、处于图捕获上下文、连续 BF16 张量与打包 A/B）以 `vllm_ascend/lora/lora_ops.py` 实际入口为准，不满足时按单槽/打包条件依次退回 matmul 或常规 SGMV/BGMV。历史 `v0.23.0` 维护分支 `2c59ff10` 不含 GLM 模型，本页 GLM 走读仍按 `db701c1f` 与 `vllm@0fc695fc` 核对；两份旧代码的 wrapper 与图参数文件均无上述单槽快路与按 `has_lora` 拆表。

### 源码位置

- `v0.30.0` 与 `main` 昇腾核心入口：`vllm-ascend@c09d3e20:vllm_ascend/lora/punica_npu.py#L23-L75`、`#L216-L236`（`HardwareProfile` 能力判定、单槽掩码、310P `_use_sgmv`），`vllm-ascend@8d6180e2:vllm_ascend/lora/punica_npu.py#L648-L672`（`apply_lora_full_linear`），`vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L396-L406` 与 `vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L443-L453`（`LoRA + EP` 强制 `ALLTOALL`），官方文档见两版 `docs/source/user_guide/feature_guide/lora.md#L1-L45`；上游最新配置见 `vllm@ba15685a:vllm/config/lora.py#L31-L55`。
- 默认多模态、格式声明、lineage 与目标模块的官方用法见来源 87，配置默认见 88；离线选择四版依次为 89–92，HTTP 匹配与显式优先为 93–96，混合 MoE 转换与 tower/connector 消费者为 99–108；Resolver 自动查找四版消费者见来源 49–86。这里只核对机制与固定版本，没有执行适配器训练、真实媒体模型或设备推理。

| 看什么 | 在哪 |
|---|---|
| 三个启动参数与默认值 | 上游 `vllm/config/lora.py` |
| 槽位表与逐行槽号 | 上游 `vllm/lora/model_manager.py` 的 `activate_adapter`、`vllm/lora/punica_wrapper/utils.py` 的 `convert_mapping` |
| 预付的权重形状 | 上游 `vllm/lora/layers/base_linear.py` 的 `create_lora_weights` |
| 名额占满的闸门 | 上游 `vllm/v1/core/sched/scheduler.py` |
| 昇腾交出的乘法实现 | `vllm_ascend/platform.py` 的 `get_punica_wrapper`、`vllm_ascend/lora/punica_npu.py` |
| 四个 AscendC 核函数 | `csrc/kernels/` 下的 `bgmv_shrink.cpp` / `bgmv_expand.cpp` / `sgmv_shrink.cpp` / `sgmv_expand.cpp`，注册在 `csrc/torch_binding.cpp`；Python 薄包装是 `vllm_ascend/lora/lora_ops.py` |
| 层替换与运行器挂钩 | `vllm_ascend/lora/utils.py`、`vllm_ascend/worker/model_runner_v1.py` |
| 恒标 prefill 的映射 | 上游 `vllm/v1/worker/lora_model_runner_mixin.py` |
| 缩放与 LRU 换出 | 上游 `vllm/lora/lora_weights.py`、`vllm/lora/worker_manager.py` |
| 图分桶字段 | 上游 `vllm/forward_context.py` 的 `BatchDescriptor` |
| MoE 通信的 LoRA 特判 | `vllm_ascend/ascend_forward_context.py`（v0.26 与 main） |
| 单适配器快路与图参数表 | `vllm_ascend/lora/punica_npu.py`、`lora/lora_ops.py`、`compilation/acl_graph.py` |
| 官方 LoRA 特性文档与支持矩阵 | `docs/source/user_guide/feature_guide/lora.md`（三个版本各一份）、`support_matrix/supported_features.md` |
| 方法本身 | LoRA 原论文 [S1] |

缩放默认与乘入 B 见来源 29，模型管理器实际调用优化见来源 45；单批名额闸门见来源 6。缓存加载、淘汰与命中复用的完整外层条件见来源 32；加载时新旧对象可暂时共存，因此缓存份数不等于峰值内存保证。加载期和每步的 runner 挂钩分别见来源 47、46，四个原生算子注册见来源 48。v0.26 单槽快路条件见来源 18，进入前还要求 dtype 已解析。注册/请求选名与动态装卸见来源 40；新版融合实际门槛、split-K 与回退分别见来源 43、44。该指南的性能条件是概括，完整运行条件以这两个代码入口为准。GLM 模型兼容和设备性能仍缺对应官方声明与实测。

本页不给 GLM 双机上的 LoRA 时延、吞吐或显存结论。**待核**：缺本模型开 LoRA 之后的实测数据（尤其是通信被换成 All-to-All 之后的开销），也缺官方对这一模型的 LoRA 支持声明。上面那个 0.78% 是按层宽推的参数量比例，不是实测效果。
