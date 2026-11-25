---
id: acl-graph
title: ACL Graph：捕获、批形状与重复执行
type: feature
summary: >-
  昇腾上把一步前向的设备任务连同地址录成一张图、之后整串一次提交的实现。本页讲清小批 decode 为何等在 Host、图内录了什么与什么进不了图，先以
  v0.30.0 标准 Qwen3-8B 默认捕获预算（封顶 512）走通，再对照历史 GLM 双机 7 档 FULL_DECODE_ONLY 与视觉编码器图条件。
aliases:
  - ACLGraph
  - ACL 图
  - FULL_DECODE_ONLY
  - FULL_AND_PIECEWISE
  - npugraph_ex
  - 图捕获与回放
  - ViT 图
  - cudagraph_mm_encoder
  - encoder_cudagraph_token_budgets
chapters:
  - '16'
order: 40
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L170'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L226-L259'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L28-L54'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L207-L241'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L76-L124'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L634-L646'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1690-L1763'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1437-L1518'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1343-L1428'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1453-L1468'
  - 'vllm@0fc695fc:vllm/v1/attention/backend.py#L506-L519'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L324'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L224'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5269-L5299'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2778-L2800'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2803-L2835'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3807-L3816'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L454-L518'
  - 'vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L28-L106'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L215-L235'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/breakable_aclgraph.py#L38-L60'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L129'
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L78-L96
  - >-
    raw:sha256-d338b1d1b52f842832501f0d81aa4cf44e91850e104d95c6cea753a6ad052335.md#L1-L807
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/compilation/acl_graph.py#L221-L228
  - 'vllm-ascend@7d825229:vllm_ascend/compilation/acl_graph.py#L284-L319'
  - 'vllm@0fc695fc:vllm/compilation/monitor.py#L87-L99'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L599-L623'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1184-L1229'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1117-L1172'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L284-L288'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1545-L1566'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L830-L837'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L227-L244'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L581-L619'
  - "vllm@0fc695fc:docs/design/cuda_graphs_multimodal.md#L1-L229"
  - "vllm@568afb3a:docs/design/cuda_graphs_multimodal.md#L1-L289"
  - "vllm@ced6857a:docs/design/cuda_graphs_multimodal.md#L1-L315"
  - "vllm@0fc695fc:vllm/config/compilation.py#L535-L565"
  - "vllm@0fc695fc:vllm/config/compilation.py#L1007-L1033"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6340-L6366"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6525-L6566"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L1770-L1798"
  - "vllm@568afb3a:vllm/config/compilation.py#L543-L573"
  - "vllm@568afb3a:vllm/config/compilation.py#L1023-L1049"
  - "vllm@568afb3a:vllm/v1/worker/gpu_model_runner.py#L6540-L6566"
  - "vllm@568afb3a:vllm/v1/worker/gpu_model_runner.py#L6745-L6786"
  - "vllm@568afb3a:vllm/model_executor/models/qwen3_vl.py#L1846-L1874"
  - "vllm@ced6857a:vllm/config/compilation.py#L550-L580"
  - "vllm@ced6857a:vllm/config/compilation.py#L1046-L1072"
  - "vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6625-L6651"
  - "vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6830-L6871"
  - "vllm@ced6857a:vllm/model_executor/models/qwen3_vl.py#L1974-L2002"
  - "vllm@84030bbe:vllm/config/compilation.py#L543-L573"
  - "vllm@84030bbe:vllm/config/compilation.py#L1039-L1065"
  - "vllm@84030bbe:vllm/v1/worker/gpu_model_runner.py#L6590-L6616"
  - "vllm@84030bbe:vllm/v1/worker/gpu_model_runner.py#L6795-L6836"
  - "vllm@84030bbe:vllm/model_executor/models/qwen3_vl.py#L1974-L2002"
  - "vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5101-L5111"
  - "vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5223-L5240"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5330-L5340"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5452-L5469"
  - "vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L5159-L5169"
  - "vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L5286-L5303"
  - "vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L6430-L6444"
  - "vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L6567-L6584"
  - "vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L6078-L6092"
  - "vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L6215-L6232"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/encoder_acl_graph.py#L274-L332"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/encoder_acl_graph.py#L334-L396"
  - "vllm-ascend@2ed6cbba:vllm_ascend/worker/encoder_acl_graph.py#L274-L314"
  - "vllm-ascend@2ed6cbba:vllm_ascend/worker/encoder_acl_graph.py#L316-L364"
  - "vllm-ascend@7d825229:vllm_ascend/worker/encoder_acl_graph.py#L275-L314"
  - "vllm-ascend@7d825229:vllm_ascend/worker/encoder_acl_graph.py#L316-L368"
  - "vllm-ascend@baa023ad:vllm_ascend/worker/encoder_acl_graph.py#L275-L314"
  - "vllm-ascend@baa023ad:vllm_ascend/worker/encoder_acl_graph.py#L316-L368"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/encoder_acl_graph.py#L37-L62"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/encoder_acl_graph.py#L177-L250"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/mm_encoder_attention.py#L223-L314"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/mm_encoder_attention.py#L316-L350"
  - "vllm@0fc695fc:vllm/v1/worker/encoder_cudagraph.py#L56-L168"
  - "vllm@0fc695fc:vllm/v1/worker/encoder_cudagraph.py#L171-L181"
  - "vllm@0fc695fc:vllm/v1/worker/encoder_cudagraph.py#L320-L442"
  - "vllm@0fc695fc:vllm/v1/worker/encoder_cudagraph.py#L444-L622"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L3058-L3078"
  - "vllm@568afb3a:vllm/v1/worker/encoder_cudagraph.py#L161-L243"
  - "vllm@ced6857a:vllm/v1/worker/encoder_cudagraph.py#L185-L282"
  - "vllm@ced6857a:vllm/v1/worker/gpu/model_states/interface.py#L63-L98"
  - "vllm@ced6857a:vllm/v1/worker/gpu/model_runner.py#L997-L1028"
  - "vllm-ascend@db701c1f:vllm_ascend/utils.py#L740-L815"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L697-L791"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L1996-L2021"
  - "vllm@ced6857a:vllm/model_executor/models/qwen3_vl.py#L753-L847"
  - "vllm@ced6857a:vllm/model_executor/models/qwen3_vl.py#L2202-L2228"
  - "vllm@ced6857a:vllm/v1/worker/encoder_cudagraph.py#L454-L547"
  - "vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1090-L1099"
  - "vllm-ascend@db701c1f:vllm_ascend/platform.py#L1080-L1089"
  - "vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L1090-L1099"
  - "vllm-ascend@7d825229:vllm_ascend/platform.py#L754-L763"
  - "vllm-ascend@baa023ad:vllm_ascend/platform.py#L676-L685"
  - "vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L10-L17"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L638-L706"
  - "vllm@0fc695fc:vllm/model_executor/models/glm4_1v.py#L1589-L1929"
  - "vllm@568afb3a:vllm/model_executor/models/glm4_1v.py#L1942-L1970"
  - "vllm@ced6857a:vllm/model_executor/models/glm4_1v.py#L1937-L1965"
  - "vllm@84030bbe:vllm/model_executor/models/glm4_1v.py#L1936-L1964"
  - "vllm-ascend@2ed6cbba:vllm_ascend/models/__init__.py#L1-L34"
  - "vllm-ascend@7d825229:vllm_ascend/models/__init__.py#L82-L85"
  - "vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L916-L930"
  - "vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L1025-L1030"
  - "vllm-ascend@baa023ad:vllm_ascend/models/__init__.py#L85-L88"
  - "vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L916-L930"
  - "vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L1025-L1030"
  - "vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L1657-L1660"
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/encoder_acl_graph.py#L37-L48'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/encoder_acl_graph.py#L38-L49'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/encoder_acl_graph.py#L38-L49'
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2183-L2212"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2262-L2291"
  - "vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L459-L464"
  - "vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1668-L1687"
  - "vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2002"
  - "vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L786"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1180-L1230"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L416-L450"
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L66-L250'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/breakable_aclgraph.py#L38-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/xlite/xlite_worker.py#L22-L36'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L905-L955'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/acl_graph.py#L66-L255'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/breakable_aclgraph.py#L38-L90'
  - 'vllm-ascend@8d6180e2:vllm_ascend/xlite/xlite_worker.py#L27-L49'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/aclgraph_utils.py#L83-L235'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1034-L1085'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L950
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1466-L1505
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L319'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L664-L715'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/updatable_graph.py#L101-L137'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L212-L224'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6888-L6932'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/acl_graph.py#L283-L325'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: graph-mode-layer
    kind: variant-of
    note: ACL Graph 是通用图模式（graph mode）在昇腾 NPU 上的捕获与回放实现，对照分派规则先看该页
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: capture_model 录图显存由 1−u 预算外余量支付，910B3 u=0.90 捕获期 OOM 账本见该页
  - to: npu-model-runner
    kind: builds-on
    note: 决定本轮用不用图、把数据写进固定缓冲的是它
  - to: attention-backend-family
    kind: builds-on
    note: 整图捕获能力受各注意力后端的支持等级约束，GLM 的 KDA 与稀疏 MLA 分支共同决定可用的图模式。
  - to: device-memory
    kind: builds-on
    note: 捕获与回放依赖设备内存中的固定缓冲和地址；理解主机与设备的存储边界，是理解回放输入约定及图资源占用的基础。
  - to: ops-and-kernels
    kind: builds-on
    note: >-
      理解 ACL Graph 捕获和回放的设备任务，需要先区分模型运算、算子接口与实际执行的 kernel；模型运算次数不能直接当作图内 kernel
      数。
contradicts: []
updated: '2026-11-23'
origin: gap
rawSources:
  - >-
    raw/sha256-56cb0ca4a4c911b962f03499423230ad3fa94bad9672e8915edc8bf0fed3f3a7.md
  - >-
    raw/sha256-d338b1d1b52f842832501f0d81aa4cf44e91850e104d95c6cea753a6ad052335.md
  - >-
    raw/sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md
---

## 一步里的几百个任务，能不能一次交给设备

**ACL Graph 是昇腾（Ascend）基于 ACL（Ascend Computing Language，昇腾计算语言运行时接口）实现 graph mode 的那套代码：启动时按几个固定的宽度，把一步前向要做的设备任务连同它们读写的地址一起录下来；之后遇到同样宽度的一步，Host 只提交一次，设备就照录好的次序把整串跑完。**

先说清三个词。**设备任务**是一次矩阵乘、归一化或注意力计算这样交给 NPU 执行的活儿，一步前向由几百个任务组成；**Host** 是跑模型的 CPU 进程，负责告诉设备「算什么、数据在哪」；**graph mode** 是「录下任务次序、之后整串重放」的通名。档位划分、选图判据与退回规则见[图模式](graph-mode-layer.md)。本页聚焦昇腾实现：图里录了什么、回放前必须满足什么、哪些活儿进不了图，以及标准与 GLM 双机配方如何落地。编译期算子融合是另一件事，可与回放同时开，见[编译期图融合](npugraph-ex.md)。

先把这两种执行方式想成锅炉房派工——**传令员过长桥逐张送纸条导致大熔炉断续空烧 vs 打孔母带机直连炉门整串连发回放**：

```wiki-diagram
file: acl-graph-plate-tape-replay
```

## 为什么小批 decode 可能等在 Host 下发

Host 交任务和设备算任务是两条流水：Host 交出去一个就接着准备下一个，设备则按收到的次序一个接一个算。所以一步花多久，由慢的那一边决定。

小批 decode（生成阶段每步只处理少量新位置）更容易遇到 Host 下发跟不上的情况：每个任务的计算量变小，可层数、算子个数没有同比减少。若设备很快完成一个任务，却要等下一个任务提交，下发就进入关键路径。长历史的注意力读取、权重读取或跨卡通信也可能占主要时间，实际瓶颈须由时间轨迹判断。

代价是启动时要逐档捕获，运行期间保留图与固定缓冲；真实输入向图的固定形状补齐，还会多做一部分计算。增加档位能减少某些批次的补齐，却会增加捕获时间和常驻资源，应把两边一起比较。

```wiki-diagram
file: acl-graph
```

把图里的格数写成账，能看清省的是哪一段（示意格数，不是实测；两边设备干的活一样多，差别是 Host 交任务占掉的时间）：

$$T_{\text{eager}} = 6 \times 2 + 1.5 = 13.5\text{ 格}, \qquad T_{\text{replay}} = 1 + 6 \times 1.5 = 10\text{ 格}, \qquad T_{\text{device}} = 6 \times 1.5 = 9\text{ 格}$$

| 执行方式（示意 6 个设备任务） | Host 下发 + 设备计算拆解 | 总耗时（示意格数） |
| --- | --- | --- |
| 逐个下发（eager） | 6 个任务 × 每个交 2 格 + 最后一个算完 1.5 格 | **13.5 格** |
| 整串回放（ACL Graph） | 整串提交 1 格 + 6 个任务 × 每个算 1.5 格 | **10 格** |
| 设备真正在算 | $6 \times 1.5$ 格 | **9 格** |

两点要记住。第一，**这幅示意没有减少设备计算量**，省的是 Host 交任务的次数。较大的 prefill 批次处理更多提示词位置；若设备工作已盖住下发开销，减少下发就难以缩短这段等待。小 prefill 或混合批在下发成为瓶颈时也有优化空间，能否回放还由模式与后端决定。prefill 可以分块，不要求整段提示词一次算完。第二，上面的 6 任务格数是教学示意设定，不能据此折算加速比；`Ascend 910B3` 上的真实录图显存账与服务态对照见后文实测小节。

## 一张图里录下来的是什么

录下来的不是算出来的数，而是两样东西：**一串设备任务的次序**，以及**每个任务读写哪块地址**。下面的地址与录放图按固定旧 GLM 实现展开；`v0.30.0` 与 `main` 可更新图的条件性同步及 `update`/`replay` 次序见[版本差异](#版本差异)。

```wiki-diagram
file: acl-graph-buffers
```

于是每一轮的流程固定成三步：

1. **准备当前数据。** 模型运行器确保捕获时用的缓冲中有本轮有效的 token 编号、位置与已算长度、[block table](block-table.md)（记录这条请求的 KV 放在哪些块里的表）。这是内容正确性的要求，不等于每次重写整个已分配缓冲。例如固定 GLM 代码每步提交块表时，复制的是当前 `num_reqs` 行的全部列，非活跃行不在这次复制范围内。

这里的缓冲需要跨多次执行保留，但保存缓冲和写入当前输入并不是图包装器的职责：这些准备工作由包装器外部完成。因此，捕获成功只说明设备任务已经录下，后续每轮仍需要准备好当前输入。
2. **提交一次。** 包装器按本轮的**描述符**（宽度，加上「是不是每条请求位置数都一样的 decode 步」「有没有带 LoRA」这类条件）在自己的缓存里找对应条目：找到就整串提交给设备，没找到就在启动窗口里现录一张。
3. **取结果。** 回放完，结果落在录制时那块输出缓冲里，运行器从中取本轮有效的那部分。

有三个细节值得单独记住：

- **一个描述符对一张图。** 条目是按描述符存的，不是按请求存的；一条请求走很多步，一步里又有很多条请求，图和请求边界没有关系。
- **模式对不上就原样执行。** 包装器只按上游给的运行模式和描述符办事：一旦模式不符或为 `NONE`（如显存分析、热身或关图），就直接透传给模型，既不录也不放。该不该用图由运行器和分派器决定，流程见[图模式](graph-mode-layer.md#包装器内部透传回放还是现录)。因此判断本轮是否回放，须先核模式允许、再核描述符命中，仅凭宽度相同不足以确定。
- **地址是约定，不是提示。** 本轮需要变化的内容没有更新、回放任务又读取了这些位置时，就会读到旧值；包装器不会检查这些数是不是本轮的数据。开启 `VLLM_LOGGING_LEVEL=DEBUG` 时，`ACLGraphWrapper` 每步回放前会遍历位置参数中的 `torch.Tensor` 核对 `data_ptr()` 是否与捕获时一致——这项检查既不比较张量内容，也不覆盖所有关键字参数，且会在每步热路径上增加额外的 Host 遍历开销。

## 什么能进图，什么不能

限制都从「录的是次序和地址」这一条长出来：

- **宽度要固定。** 一张图录的时候多宽，回放时就得正好多宽。真实批次几乎不会正好落在录过的宽度上，所以进模型前先往上补齐到最近的一档；补到哪一档、两个 [DP 组](data-parallel.md)（各自调度、各有 KV 池的一台机器）之间怎么再对齐，账在[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)里，本页不重算。
- **地址要固定。** 输入、输出、算子自己的工作区都绑在捕获时那几块内存上。
- **Host 上的判断不会随图自动重跑。** 固定捕获路径记录的是当时提交的设备任务；Python 在 Host 上判断要不要用图、用哪一张、这一步补到多宽，仍须在提交之前完成。这不意味着设备 kernel 内部不能有自己的条件判断。
- **每轮都在变的注意力参数要另外补。** 查询长度、已算长度与块表每步都在变，而录下的算子入参已固化。两条补法各管一类后端：一是写入固定地址缓冲，让算子直接读最新内容；二是用侧流事件在回放期原地改写已录任务入参（见下文三轨时序图）。

- **算子自己得支持。** 每个注意力后端声明一个支持等级：支持混合批、仅支持「同批每条请求位置数相等」、仅支持「每条正好 1 个位置」、或完全不支持。模型按所有后端里的最低等级定界，要求超出该等级时自动降级并告警。只有「完全不支持」兜不住：要求混合批走整图时启动直接报错，只给 decode 要整图时则退到分段或不录图。
- **只在启动窗口里录。** 服务期遇到没录过的形状不会临时补录，捕获合法性检查会直接拒绝；启动期怎么热身、怎么按宽度从大到小逐个录，见[图模式](graph-mode-layer.md#启动时录运行时放)。
- **录图显存走 `1 - u` 余量。** 将 `--gpu-memory-utilization` 统一记作符号 $u$（`v0.30.0` 上游 `CacheConfig` 默认 `0.92`，生产脚本常手传 `0.90`，早期惯例多取 `0.9`；七级显存账见 [KV cache 显存预算](kv-cache-memory-profiling.md)）。显存探测先按 $u \times \text{total\_memory}$ 扣除权重、激活峰值与非 torch 占用，把余款全部分给 KV cache；随后 `capture_model()` 的录图显存（`npugraph_memory_bytes`）实际从设备剩下的 $(1 - u)$ 余量里划出。捕获档位过多或 $u$ 设得过满吃干余量时，会在录图期 OOM。`v0.30.0` 与 `main` 会在录图后合并权重、激活、非 torch 与 `npugraph_memory_bytes` 为 `non_kv_memory`，扣 `150 MiB` 安全冗余后打印推荐 `--kv-cache-memory`。

在 `v0.30.0` 及 `main` 中，昇腾的图捕获生态分化为三条互补实现：

- **`ACLGraph`**：默认整图/分段包装器 `ACLGraphWrapper` 与 `updatable_graph`；
- **`BreakableACLGraph`**：`BreakableACLGraphWrapper`，允许分段捕获在动态切分点打断；
- **`XliteGraph`**：开启 `xlite_graph_config` 时，平台在 `worker_cls="auto"` 且非 310P 下选中的独立 `XliteWorker` 图执行路径。

下面这张对照图把四档捕获模式矩阵、三大图路径与 `u / (1 - u)` 录图显存账放在同一视图（版本演进见文末[版本差异](#版本差异)）：

```wiki-diagram
file: acl-graph-fig-mode-budget
```

## 图片先过视觉编码器，这一步也能录成图吗？

**视觉编码器先把图片或视频变成一串特征向量，语言模型随后才使用这些向量。** 前后两段可以各有自己的图；视觉图减少编码器的 Host 下发开销，仍然计算这次媒体的特征。它与[编码结果缓存](api-server-entry.md#三种缓存各自省掉哪一步)不同，缓存命中才是复用以前的结果。小图片或小批编码也可能等在 Host 下发，但另录视觉图需要额外捕获和固定缓冲。

### 图片张数相同，为什么会选不同的图？

视觉图按**编码器输出的 token 数**设置容量档位。每张图片产生的特征位置数由分辨率及处理布局等共同决定；视频还需计入各帧。因此图片张数、像素数、视觉输出 token 数和语言模型本轮生成位置数是四种量，不能拿 GLM decode 的七档宽度直接当视觉容量。

以单路径编码器为示意，已录容量为 128、256、512，每次最多放两项；原输入按 A、B、C 排列，分别产生 192、96、160 个特征位置。执行端先按大小排成 B、C、A，再按最大容量和项数上限分批，最后为每个子批选最小能装下的档位。

```wiki-diagram
file: vit-graph-packing
```

图里的排序只改变执行组合。每次回放后拆出有效结果、复制出复用的输出缓冲，再恢复 A、B、C 的原输入顺序，交给语言模型的媒体位置对应关系才保持不变。

$$\text{覆盖容量} = 256 + 256 = 512, \qquad \text{有效位置} = 192 + 96 + 160 = 448, \qquad \text{容量余量} = 512 - 448 = 64$$

| 视觉输入分批（三项视觉输入使用图容量·示意） | 组成与计算式 | 位置数 |
| --- | --- | --- |
| 第一子批 `B + C`（选 256 档） | $96 + 160$ | **256**（满档） |
| 第二子批 `A`（选 256 档） | $192$ | **192**（占 256 档） |
| 两次共覆盖容量 / 实际有效位置 | $256 + 256$ vs $192 + 96 + 160$ | **512 / 448** |
| 容量余量（补齐空位） | $512 - 448$ | **64** |

余量是容量账，不是时间损失百分比；实际算子还取决于输入布局。若另有单项输出超过最大 512 档，该项走 eager，即直接执行、逐个提交设备任务。不能把这条 token 超档分支推广成任意缓冲不足都会自动退回。

### 视频帧容量和跨卡分工要另算

以 Qwen3-VL 为例，一项视频的多帧各有注意力序列终点；捕获时需要为这些长度元数据预留空间。帧容量控制这类缓冲，不是输入视频的裁剪开关。已核装箱逻辑按 token 容量和媒体项数分批，没有按总帧数自动重新拆批；把帧容量设得太小，不能期待它自动少取几帧或转 eager。视频数量的输入限制与此分开。

视觉编码也可以将不同媒体项分给同一 TP 组内的不同 rank，各自编码后收集结果、去掉补齐部分并恢复原顺序。这里的 data 模式描述视觉项怎样分工，没有另建服务 DP 实例；模型副本和 P/D 资源计数仍沿用[部署分组](glm-5-3-flash-two-node.md#部署前提)。

### 在 Ascend 上怎样保持本轮数据正确？

Model Runner V1 的 Ascend 接入会换成专用的视觉图管理器：先将本轮像素与元数据写入固定缓冲，再提交回放。标准视觉注意力路径与通用语言可更新图都依赖 FIA（融合推理注意力算子）的**侧流 Event 同步**：捕获时在注意力任务前放入 `Wait Event`，更新流改好序列长度等入参后再 `Record Event` 放行计算。

```wiki-diagram
file: acl-graph-fig-event-timeline
```

因此默认非 ENPU 路径先调 `replay` 再调 `update_graph_params`，设备并不会用旧长度跑注意力——先后由图内事件锁死。每次视觉子批回放后，须把有效输出**复制出共用缓冲**，避免下一子批原地覆盖。310P 用另一套注意力实现，本段 FIA 接入不能替代其验证。

模型还须实现视觉图协议（提供预算、固定输入、回放准备与输出拆分）。**固定 GLM 镜像的多模态类及其旧 GLM4V 父类未实现该协议，不能只开视觉图开关就认为原部署支持视觉图。** 语言模型的七档图仍按后文成立，新版多模态与 runner 差异见文末版本表。

## 标准主干走读：Qwen3-8B 的默认图捕获预算与回放

在 `v0.30.0` 主基线下，**Qwen3-8B**（36 层同构 GQA、默认无投机、单卡或 TP 多卡）无需手写档位即可启用 ACL Graph：

- **默认捕获上限**：昇腾去掉了上游上限的 `×2` 放大。默认最大捕获宽度为 $\min(\text{max\_num\_seqs} \times \text{query\_len},\; 512)$，并自动生成 `1, 2, 4, 8, …, 512` 等档位表。
- **单后端模式**：全 36 层共用 `AscendAttentionBackend`。`check_and_update_config` 默认落到 `FULL_AND_PIECEWISE`（纯 decode 整图、混合批分段图），也可显式选 `FULL_DECODE_ONLY` 叠加 `npugraph_ex` FX 图融合。
- **变长历史更新**：decode 每步历史长度都在涨，`AscendAttentionBackend` 靠上图侧流事件同步把 `seq_lens` 与 `block_table` 写进已录任务，无需重录图。
- **录图显存账**：捕获占用 `npugraph_memory_bytes` 从 `--gpu-memory-utilization`（`v0.30.0` 默认 `0.92`，生产常传 `0.90`，记为 $u$）之外的 $(1 - u)$ 余量划出。录完后日志汇总 `non_kv_memory` 并扣 `150 MiB` 冗余，打印推荐 `--kv-cache-memory`。

### Ascend 910B3 真机实测：捕获期 OOM 与扩 TP 图显存逆向增长

在单卡与八卡 `Ascend 910B3` 的 `v0.30.0` 实测（完整环境与数据见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）中，`capture_model()` 的 $(1 - u)$ 余量边界、扩 TP 后的图显存变化以及 `DEBUG` 回放校验有直接的量化记录：

```wiki-diagram
file: acl-graph-fig-910b3-u090-oom-and-tp-growth
```

1. **为什么 `u = 0.90` 通过了试跑与分段图，却在 `FULL` 第 `1/35` 档触发 FIA 捕获期 OOM？** `Ascend 910B3` 物理标称 `64.00 GiB`，但 `acl.rt.get_mem_info` 暴露给操作系统的可见总容量为 **`60.96 GiB`**（相差 `3.04 GiB` 为底层预留，预算公式 `total × u` 以 `60.96 GiB` 为基数）。在 `Qwen3-0.6B`（`max_model_len = 4096`，默认 `FULL_AND_PIECEWISE` 共 35 档）下，设 `u = 0.90` 时 `profile_run()` 顺利通过并划出 **`53.47 GiB`** KV cache（`500,480 tokens`、`122.19×` 并发），随后 35 档 `PIECEWISE` 分段图也全部录完。直到进入 `FULL` Decode 第 `1/35` 档时，调用栈在 `device_op.py` 的 `npu_fused_infer_attention_score`（FIA）内申请 **`1.98 GiB`** 临时空间，而当时设备仅剩 **`1.71 GiB`** 空闲显存（`allocated = 54.62 GiB`、`reserved = 58.75 GiB`），当场触发捕获期 OOM。将 $u$ 下调至 **`0.82`**（KV `48.59 GiB`、`454,912 tokens`、`111.06×`）留足 $(1 - u)$ 余量后，全档捕获在 **`21 s`** 内以 **`3.90 GiB`** 图显存顺利通过——因此既不能把这次失败误判为 `profile_run()` 阶段越界，也不能把 `Qwen3-8B` 的 `2.59 GiB` 套作 `0.6B` 的图开销。
2. **为什么 `Qwen3-8B` 从 `TP=1` 扩到 `TP=2/4/8` 时单卡权重递减，图显存差值反而递增？** 固定 `u = 0.85`、`max_model_len = 32768` 的 `INFO` 干净态 rank 0 实测显示：

| 并行度（`Qwen3-8B`，`u = 0.85`） | 单卡权重 | 每卡可用 KV | 每层本地 K+V 视图 | 捕获前后空闲差值（`INFO` 耗时） |
| --- | ---: | ---: | ---: | ---: |
| `TP=1` | `15.29 GiB` | `36.29 GiB` | `1.008 GiB` | **`2.59 GiB`**（`22 s`） |
| `TP=2` | `7.66 GiB` | `43.52 GiB` | `1.209 GiB` | **`2.92 GiB`**（`32 s`） |
| `TP=4` | `3.84 GiB` | `47.36 GiB` | `1.315 GiB` | **`3.10 GiB`**（`35 s`） |
| `TP=8` | `1.94 GiB` | `49.27 GiB` | `1.368 GiB` | **`3.21 GiB`**（`36 s`） |

日志中的“NPU graph memory”由上游 `gpu_model_runner.py` 按捕获前后设备空闲显存差（`start_free_gpu_memory - end_free_gpu_memory`）算出。固定 $u$ 扩 TP 时，权重切薄省出的空间被自动划回每卡本地 KV 池，每层本地 K+V 视图反从 **`1.008 GiB` 扩至 `1.368 GiB`**。捕获多档形状时，FIA 通过 `get_capture_resource` 接收更大的 KV 输入视图查询工作区，同时多 rank 集合通信图对象、运行时资源与缓存分配器保留量也会计入该差值（`DEBUG` rank 0 对应为 `2.59 / 2.93 / 3.10 / 3.21 GiB`，耗时 `28 / 40 / 40 / 43 s`）。由于缺少逐算子分配快照，`+0.62 GiB` 增量尚无法闭合拆解到单一算子，不能归因为纯 HCCL 或单一 Slice 开销。
3. **关闭图模式与开启 `DEBUG` 校验的线上代价对照**：在 `2.4 GHz` 禁睿频 ARM Host 上，`Qwen3-30B-A3B` 从四卡混部 `ACLGraph` 切到双端 `--enforce-eager` 的八卡 `4P4D`（该组同时改变了拆池拓扑、图模式、前缀缓存、最大长度与 `u`，纯 Eager 独立份额尚待单变量拆解）。切换后 `c=1` `TPOT` 从 `77.90 ms` 升至 `307.83 ms`（`3.952×`），48 层 MoE 逐算子发射与同步开销在持续解码期被显著放大。即便保持图模式开启，若误留 `VLLM_LOGGING_LEVEL=DEBUG`，每步回放前的 `data_ptr()` 遍历校验与 Worker 分配器读数日志也会增加 Host 开销（`Qwen3-8B` `TP=8` `c=1` 单样本对照下 `TTFT` 由 `139.07 ms` 升至 `193.98 ms`，`+39.48%`）。

## 放到 GLM 双机：只给整齐的 decode 步录 7 张图

从同构 `Qwen3-8B` 切到含 KDA、稀疏 MLA 与 MTP 的异构配方时，须手工对齐捕获倍数并收口到纯 decode 整图。下面对照例外 B 历史绑定算例（[部署前提](glm-5-3-flash-two-node.md#部署前提)）。

该配方显式设 `FULL_DECODE_ONLY`（仅整齐 decode 录整图，其余 eager），手写 **7 个捕获宽度**：`4, 8, 16, 32, 64, 96, 128`。开 3 步 MTP 后每请求每步占 $1 + 3 = 4$ 位（见[投机解码](speculative-decoding.md)）。这 7 档正好对应 `1, 2, 4, 8, 16, 24, 32` 条请求（见[图模式](graph-mode-layer.md#官方双机上录了哪-7-张图)）。

该配置与前文「算子支持等级」自洽：34 层 KDA（[线性注意力](linear-attention.md)）与 11 层[稀疏 MLA](sparse-attention.md) 仅支持等宽批次，混合批本就上不了整图，因此配置检查原样放行。**只要一步混进 prefill，本步就无图可用**，且两 DP 组按较低一侧取齐。

昇腾在该路径还加了两处动作：

- **回放前同步当前流。** 主模型整图回放前，包装器先同步当前流。异步调度下，这避免第 $i$ 步在 Host 改参时覆盖第 $i-1$ 步尚未回放完的同一缓冲。
- **刷新各后端固定缓冲。** 运行器前向前构建元数据：稀疏 MLA 引公共缓冲，压缩索引器刷预分配缓冲，KDA 刷状态索引、查询起点与接受数（见[图模式数据准备](graph-mode-layer.md#回放之前必须先把数据写对)）。通用「侧流刷整图参数」要求非稀疏且非压缩，GLM 不走它（调用次序见[版本差异](#版本差异)）。

启动期录 7 张图的耗时与显存须看实机启动日志，本库尚无实测。

## 常见误解

- **「ACL Graph 是昇腾另搞的图模式。」**——档位枚举、宽度分派和补齐表都在上游 vLLM，昇腾提供平台接入与捕获回放包装器。
- **「图里存着上次算出的结果。」**——图只存任务次序与地址，每轮照原样重算。
- **「录一张图，什么批次都能用。」**——一张图绑定固定宽度与描述符条件，宽度命中不等于一定回放。
- **「回放只看本轮数据，跟地址无关。」**——地址即契约；未更新的缓冲会沿用旧值，DEBUG 下地址变了直接触发断言。
- **「历史长度每步变，decode 录不了图。」**——可变参数靠固定缓冲或侧流改已录任务入参更新，无需把长度录死。
- **「包装器自己决定用不用图。」**——它只读运行器给的模式与描述符，对不上就原样透传。
- **「开了图一定更快。」**——省的只是 Host 下发；批次不整齐时，补齐空跑与退回会吃掉收益。

## 对照源码

钉点：`v0.23.0` 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码；**正文 GLM 绑定算例按专用镜像 Ascend `db701c1f`**）；`v0.26.0rc` 为 Ascend `2ed6cbba`（配套 vLLM `568afb3a`）；`v0.30.0` 为 Ascend `c09d3e20`（配套 vLLM `ced6857a`）；`main` 为 Ascend `8d6180e2`（配套 vLLM `ba15685a`）。

### 怎么开

**视觉编码器图另配 compilation_config。** 对已实现协议、满足当前模型与平台条件的 V1 路径，配置片段为 `--compilation-config '{"cudagraph_mm_encoder":true}'`。它是新增配置的写法，不是固定 GLM 原配方的可用性承诺；现有 compilation_config 中的语言图配置须一并保留。四个字段在本页四个固定上游快照中的默认值相同：

| 字段 | 默认 | 作用与约束 |
|---|---|---|
| cudagraph_mm_encoder | false | 请求捕获多模态编码器；还检查多模态输入能力、模型协议和实际入口 |
| encoder_cudagraph_token_budgets | 空列表 | 自动从模型最小预算逐次翻倍，并补上最大预算；显式非空列表每项须为正，不能概括为所有档位都是绝对的2次幂 |
| encoder_cudagraph_max_vision_items_per_batch | 0 | 自动推断每个编码子批的媒体项数；开关开启时拒绝负数。显式项数与显式预算同时给出时，项数不得超过最小预算 |
| encoder_cudagraph_max_frames_per_batch | None | 自动按每批项数与模型每项最大帧数准备帧元数据容量；开启时拒绝负数。显式0不表示禁止视频或无限容量 |

基线自动项数取“模型最大预算÷最小预算”的整数部分，并受最小图预算约束；只给项数时会抬高自动预算的起点，只给预算时也会限制推断项数，不能把四个字段视为互不相关。禁止视频输入使用多模态输入限制的 video=0，这时帧容量也取0；启用视频时，应按真实处理后的帧数核对固定缓冲。

四版 V1 的捕获入口都会先在总图模式为 NONE 时返回，然后才创建视觉图管理器。因此“视觉与语言图分别有预算和对象”不等于 V1 可以绕过总入口。强制 eager 及图模式的派生继续见[图模式](graph-mode-layer.md#怎么开)。mm_encoder_tp_mode=data 在 TP>1 时将视觉项分给 TP ranks；它不增加服务 DP 数。Ascend 平台会重置上游的 mm_encoder_attn_backend，官方 GPU 示例中的 FLASH_ATTN/FLASHINFER 不能直接照搬。

- **本部署显式配。** 档位设成 `FULL_DECODE_ONLY`、捕获宽度给了 7 个值，完整命令在[部署页](glm-5-3-flash-two-node.md#怎么开)统一维护，本页不复制。权重加载完之后，整个模型被包一层 `ACLGraphWrapper`，运行模式是 `FULL`。
- **参数与默认尺寸。** compilation_config、cudagraph_mode、cudagraph_capture_sizes、max_cudagraph_capture_size 与主模型 enforce_eager 的入口、默认派生和报错统一见[图模式参数参考](graph-mode-layer.md#怎么开)。那里保留了 Ascend 默认上限去掉上游 ×2 的条件、512 截断、逐档生成、预算过滤，以及显式表和显式上限必须一致的规则；此处来源 4、7 仍对应平台注入和上游派生。
- **开了投机解码要对齐倍数。** 整趟 decode 图加上草稿时，宽度表整体向上取整到「1 + 草稿数」的倍数；只有同时开了上游的 sequence parallel 且 TP > 1，倍数才改成它与 TP 的较大值。本部署是 MoE 模型，那个开关取假，倍数就是 4。

在这条整趟 decode 路径中，若统一查询长度大于 1，并且同时启用上游的 sequence parallel、TP 大于 1，取出的较大值还必须同时被查询长度和 TP 大小整除；不满足就抛错。这一步没有自动改用最小公倍数，因此较大值并不总能成为合法的对齐倍数。
- **宽度表还会被筛选。** 上游 sequence parallel 开着时，不是 TP 倍数的宽度被筛掉；若同时指定了捕获列表与最大宽度，而过滤后列表的最大值与该上限不一致，会先抛错。通过一致性检查后，最终最大宽度才取有效表的最大值。早期版本（`v0.23.0` / `v0.26.0rc`）中，昇腾 A5 在分段编译路径上对超过 4 档的表按索引等距采样到 4 档（首尾必留）并发出 warning；`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）已移除该 4 档裁剪逻辑。
- **档位还会被后端等级压低。** 运行器扫过所有 KV cache 组的注意力后端取最低等级，交给上游解析：要求混合批走整趟图而最低等级不是「混合批也支持」时，降到分段档或只给 decode 的整趟档并打 warning；最低等级是「完全不支持」时，混合批整趟图直接抛 ValueError，decode 整趟图退到分段档或不录图。四个等级的定义在上游枚举里；GLM 的稀疏 MLA 后端与 KDA 走的 GDN 构建器分别见来源 12、13，两者声明的都是「一批里每条位置数一样才支持」。

### 会报什么错

视觉图配置中，非正的显式 token 预算会被拒；开启时负项数或负帧容量会被拒。基线同时给预算和项数、且项数大于最小预算时，还会报出每项分不到一个输出位置的错误。模型没有协议时，V1 不创建视觉图管理器；Qwen3-VL 开启多模态裁剪时，模型把图支持的模态列表置空，图片和视频都会退出这条图路径。

检查是否实际生效，应看视觉管理器的初始化预算、捕获完成记录及命中/退回统计，而不是只看语言模型“图捕获成功”。基线初始化日志列 budgets、max_batch_size、max_frames_per_batch 与 use_dp，调试日志记录子批 token、所选 budget 和补齐比例；这些值用于核对配置和实际形状，设备性能还需同输入对照测量。

| 条件 | 报错或检查点 | 怎么处理 |
|---|---|---|
| 早期版本（`v0.23.0` / `v0.26.0rc`）设了 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台在配置阶段抛 `ValueError`，说明两者不兼容，建议改用别的调试手段（`v0.30.0` 与 `main` 平台层已移除该显式拒绝） | 要同步执行先关图 |
| 捕获时设备流资源不足 | 明确的流资源不足文本，或 `207008` 同时带 `stream resource` 文本，才命中这项错误包装；单有错误码不够 [C3] | 按提示减宽度，并确认 HDK / CANN 版本 |
| 混合结构模型开整趟图，并发上限超过状态缓存块数 | 上游在配置阶段抛 `ValueError`，提示调小并发或提高显存占用比 | 每条 decode 请求要占一块状态缓存 |
| 捕获已被上游禁用时又触发捕获 | 合法性检查抛 `RuntimeError` [C1][C28] | 检查调用时机以及描述符是否已经捕获 |
| `u` 过高通过试跑与分段图，在 `FULL` 捕获的 FIA 内耗尽 $(1 - u)$ 余量 | `capture_model()` 栈落入 `device_op.py:216` 抛 `NPU out of memory`（如 `Qwen3-0.6B` 在 `u=0.90` 申请 `1.98 GiB`、仅剩 `1.71 GiB`）[M137] | 下调 `u`（如 `0.82`）或改用录图后建议的 `--kv-cache-memory` |
| 调试日志级别下回放，位置参数中 Tensor 的地址与录制时不同 | `acl_graph.py:275-281`（`main` 为 `283-290`）遍历 `args` 核对 `data_ptr()`，不符则断言失败 [C2][C138] | 检查是否换了输入 Tensor；生产压测切回 `INFO` 免除每步地址遍历与分配器日志税 |

所列 v0.26 快照捕获到“Alloc sq cq fail”这类旧 HDK 错误特征时，会提示升级到 HDK 25.5.1 或更新版本，并使用匹配的 CANN。这是该错误分支的排查建议，不是所有图模式场景的统一最低版本声明。


### 开销和什么时候别开

- **启动**：每个宽度都要跑一遍空批次并录一次；增加宽度会增加捕获工作，录好的图还要占设备内存。评估本部署的 7 个宽度时，应从启动日志分别记录捕获耗时和内存增量。
- **运行**：整趟回放前多一次当前流同步，条件是运行模式为 `FULL` 且不是 eagle 合图路径；开了 `enable_enpu` 时跳过，改由运行器自己排更新与回放的先后。
- **补齐的浪费**不在本页记账，见[多条请求](concurrent-requests.md#先补到自己这组的图尺寸)。
- **什么时候别开**：请求形状长期不整齐时，收益会被补齐和退回吃掉；排查精度或 hang 问题常用强制 eager，但它同时关掉编译期改写和图，问题消失只能把范围缩到这两层，怎么分开见[图模式](graph-mode-layer.md#对照源码) [D]。

### 版本差异

**`v0.30.0`（`c09d3e20`）集齐 `ACLGraph` / `BreakableACLGraph` / `XliteGraph` 三类图路径，并在录图后给出扣除 `npugraph_memory_bytes` 与 150 MiB 余量的 `--kv-cache-memory` 建议；`main`（`8d6180e2`）进一步收口为 MRV2 `ModelAclGraphManager` 统一编排。**

| 图捕获核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 三类图实现（`ACLGraph` / `Breakable` / `XliteGraph`） | 仅 `ACLGraphWrapper` 与独立 `XliteWorker`；无 `BreakableACLGraphWrapper` | 同 `v0.23.0`（行号后移） | 齐备 `ACLGraphWrapper`、`updatable_graph`、`BreakableACLGraphWrapper` 与 `XliteWorker` | 同左，且 MRV2 经 `worker/v2/aclgraph_utils.py` 的 `ModelAclGraphManager` 统一管理整图/可打断图与可更新图 |
| 捕获失败识别与 `ASCEND_LAUNCH_BLOCKING` | 只识别设备流资源不足；A5 分段砍至 4 档；`ASCEND_LAUNCH_BLOCKING=1` 撞图模式抛 `ValueError` | 新增识别旧 HDK `Alloc sq cq fail` 并提示升级 HDK 25.5.1+；同左保留 A5 4 档裁剪与 `ValueError` 拒绝 | 保留 `Alloc sq cq fail` 提示；已移除 A5 4 档裁剪（`prune_capture_sizes_for_950`）与平台对 `ASCEND_LAUNCH_BLOCKING=1` 的显式拒绝（不代表所有组合均支持） | 同 `v0.30.0`（均无 A5 4 档裁剪与 `ASCEND_LAUNCH_BLOCKING=1` 显式拒绝） |
| 录图预算与 `1 - u` 余量 | 录图显存落在 `gpu_memory_utilization`（$u$）之外的 $(1 - u)$ 设备余量 | 同 `v0.23.0` | 同左；录图后汇总 `non_kv_memory`（含 `npugraph_memory_bytes`）并扣 150 MiB 输出推荐 `--kv-cache-memory` | 同 `v0.30.0`（改经 `_get_gpu_memory_utilization()` 与 HiSparse 非 KV 显存分支计算） |
| 可更新图 `update` / `replay` 次序 | 普通 paged attention 经侧流事件同步，非 ENPU 先调模型再调通用更新 | 同 `v0.23.0` | `FULL` 加特定后端进入可更新分支：`enable_enpu` 先 update 后 replay，其余先 replay 后 update；`FULL` 通常回放前同步流（ENPU/EAGLE 合图跳过） | 延续可更新图条件次序，由 `ModelAclGraphManager._updatable_graph_replay` 承接 |
| 视觉图（`cudagraph_mm_encoder`）与多模态 | 单路径预算，Ascend V1 换用 `EncoderAclGraphManager`；`db701c1f` GLM 无视觉图协议；平台重置 `mm_encoder_attn_backend` 为 `None` | 上游增加全局/局部双路径；NPU FIA 仍按 `token_budget` 建账 | 通用多路径；NPU 拒绝非空 `capture axes` 抛 `NotImplementedError`；`GLM5Next` 补齐协议适配（去掉 `pos_embeds`） | 同 `v0.30.0`；MRV2 分开判断视觉图与语言图入口，Qwen3-VL 裁剪仍置空图模态 |

官方文档把 ACL Graph 记在 v0.9.0rc1 起并列出五个档位，最终有效模式仍受平台与后端限制 [S23]。设计文档把参数更新概括为“回放之前” [S24]，实际非 ENPU Python 路径先调用模型再调用通用更新入口 [C16]，原因在于捕获时先登记事件等待再登记注意力任务，更新流改参后记录事件才放行注意力 [C18]。较新上游 MRV2 分别判断编码器和语言图的捕获，不能直接套用 V1 的 NONE 早退条件；官方 ViT 指南的性能表使用 GPU 与指定模型，不作为 A2/GLM 收益数据。

### 源码位置

- `v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 实核：`ACLGraphWrapper` 见 `c09d3e20:compilation/acl_graph.py#L66-L250`、`#L275-L319`（含 `DEBUG` 下 `data_ptr()` 核对）与 `8d6180e2:compilation/acl_graph.py#L66-L255`、`#L283-L325`；`BreakableACLGraphWrapper` 见 `c09d3e20` / `8d6180e2:compilation/breakable_aclgraph.py#L38-L90`；`XliteWorker` 见 `c09d3e20:xlite/xlite_worker.py#L22-L36` 与 `8d6180e2:xlite/xlite_worker.py#L27-L49`；`main` MRV2 图管理器见 `8d6180e2:worker/v2/aclgraph_utils.py#L83-L235`；录图走 `1 - u` 余量与 150 MiB 推荐公式见 `c09d3e20:worker/worker.py#L905-L955` 与 `8d6180e2:worker/worker.py#L1034-L1085` [C130][C135]；捕获前后设备空闲显存差计算见 `vllm@ced6857a:v1/worker/gpu_model_runner.py#L6888-L6932` [C142]，FIA 图工作区申请与复用作用于 `c09d3e20:attention/attention_v1.py#L664-L715`、`compilation/updatable_graph.py#L101-L137` 与 `device/device_op.py#L212-L224`；`Ascend 910B3` 真机 `TP=1..8` 图显存逆向增长、`DEBUG` 热路径对比与 `u=0.90` OOM 标本见来源 136–137 [M136][M137]。
- 固定 GLM（`db701c1f`）元数据构建、块表复制、稀疏 MLA 与 KDA 封装见来源 119–126；视觉图官方设计与四版字段/入口/FIA 事件更新链见来源 37–118；`v0.23.0` / `v0.26.0rc` 包装器、平台与宽度表派生见来源 1–36。新视觉图示的 128/256/512 与 A/B/C 数值、以及 6 任务格数账单均为教学示意设定 [A][D]。

| 看什么 | 在哪 |
|---|---|
| 透传、查条目、捕获合法性检查 | 来源 1、19、28：ACLGraphWrapper 的调用与捕获检查；main 可打断变体见来源 21 |
| 地址核对、回放前同步、回放 | 来源 2、138、143：包装器回放分支与 `DEBUG` 下 `data_ptr()` 遍历校验 |
| 捕获失败的错误重抛与 FIA 捕获期 OOM | 来源 3：错误码判定；v0.26 的 HDK 提示见 20、26，main 对应分支见 35；FIA 捕获期栈与实测标本见 137、141 |
| 整模型包装、最低后端等级、通用更新条件与顺序 | 来源 14–17：model_runner_v1；捕获前后空闲显存差计量见 142 |
| 换已录任务入参：事件等待与参数更新 | 来源 18、31、139、140：attention_v1 与 updatable_graph 的工作区申请及参数更新；`v0.30.0` / `main` 可更新图见来源 27、130 |
| 默认最大捕获宽度、A5 砍档、调试变量互斥 | 来源 4–6、29：旧 platform；main 的能力声明与消费见 22、30，v0.26 分支见 36 |
| 宽度表生成、截断与 SP 过滤 | 来源 7、33：上游 config/vllm.py |
| 投机倍数、后端降级链、状态缓存块校验 | 来源 8–10：上游 config/compilation.py |
| 四个支持等级及固定 GLM 后端声明 | 来源 11–13：上游枚举、稀疏 MLA 和 GDN 构建器 |
| 当前活跃请求行的块表复制 | 来源 32、34：block_table 的提交与模型准备输入时的调用 |

`Ascend 910B3` 上 `Qwen3-0.6B`（`u=0.90` vs `u=0.82`）与 `Qwen3-8B`（`TP=1..8`）的图捕获显存差值与服务态耗时已由实机快照验证；`+0.62 GiB` 的扩 TP 图差值增量尚缺逐算子分配快照闭合分摊。固定 GLM（`db701c1f`）元数据的构建、原地更新和算子消费链已有静态源码依据，仍待核的是该双机部署下 7 张图的捕获耗时、设备内存占用、与 eager 的数值对照和加速比，以及视觉编码器图的实机触发日志。

**包装器与配置的来源。** 来源 19 的 2c59ff10 包装器注释明确把持久输入缓冲与复制交给外部；它不证明 GLM 每个后端的元数据更新路径。db701c1f 的 acl_graph.py 138–170 行先处理 NONE/模式不匹配，再查条目并校验捕获阶段，不能把“条目不存在”解释成服务期间随时允许捕获。默认上限由来源 4 的平台分支派生；投机与 SP 倍数兼容检查见来源 8 的编译配置。上述结论限定相应固定源码，设备开销及 GLM 后端待核项仍见前段。

