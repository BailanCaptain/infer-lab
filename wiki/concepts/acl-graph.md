---
id: acl-graph
title: ACL Graph：捕获、批形状与重复执行
type: feature
summary: >-
  昇腾上把一步前向的设备任务连同地址录成一张图、之后整串一次提交的那套实现。讲清 decode 为什么等的是 Host、一张图里存了什么、什么进不了图，以及
  GLM 双机上录的 7 张图，以及视觉编码器按输出容量另行捕获的条件。
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
verified: []
evidence: C
relations:
  - to: graph-mode-layer
    kind: builds-on
    note: 先看懂捕获与回放的一般道理，再看昇腾这套实现
  - to: concurrent-requests
    kind: builds-on
    note: 本轮宽度补到哪一档、两组怎么对齐，账在那一页
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
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-56cb0ca4a4c911b962f03499423230ad3fa94bad9672e8915edc8bf0fed3f3a7.md
  - >-
    raw/sha256-d338b1d1b52f842832501f0d81aa4cf44e91850e104d95c6cea753a6ad052335.md
---

## 一步里的几百个任务，能不能一次交给设备

**ACL Graph 是昇腾（Ascend）上实现 graph mode 的那套代码：启动时按几个固定的宽度，把一步前向要做的设备任务连同它们读写的地址一起录下来；之后遇到同样宽度的一步，Host 只提交一次，设备就照录好的次序把整串跑完。**

先说清三个词。**设备任务**是一次矩阵乘、一次归一化、一次注意力计算这样交给 NPU 去做的活儿，一步前向由几百个这样的任务组成。**Host** 是跑模型的那个 CPU 侧进程，每个任务都要由它告诉设备「算什么、数据在哪」。**graph mode** 是「把这串任务录下来、之后整串重放」的通名；录多少（档位）、这一轮选哪张图、什么时候退回逐个下发，这些通盘规则在[图模式](graph-mode-layer.md)里。本页从实现这一侧讲：一张图里到底有什么、回放前必须满足什么、哪些活儿进不了图，以及 GLM 双机上它被配成了什么样。另外，编译期把几个小算子合成一个大算子是另一件事，和回放可以同时开，见[编译期图融合](npugraph-ex.md)。

## 为什么小批 decode 可能等在 Host 下发

Host 交任务和设备算任务是两条流水：Host 交出去一个就接着准备下一个，设备则按收到的次序一个接一个算。所以一步花多久，由慢的那一边决定。

小批 decode（生成阶段每步只处理少量新位置）更容易遇到 Host 下发跟不上的情况：每个任务的计算量变小，可层数、算子个数没有同比减少。若设备很快完成一个任务，却要等下一个任务提交，下发就进入关键路径。长历史的注意力读取、权重读取或跨卡通信也可能占主要时间，实际瓶颈须由时间轨迹判断。

代价是启动时要逐档捕获，运行期间保留图与固定缓冲；真实输入向图的固定形状补齐，还会多做一部分计算。增加档位能减少某些批次的补齐，却会增加捕获时间和常驻资源，应把两边一起比较。

```wiki-diagram
file: acl-graph
```

把图里的格数写成账，能看清省的是哪一段：

```calc
title: 一步的时间花在哪（示意格数，不是实测）
逐个下发 = 6 个任务 × 每个交 2 格 + 最后一个算完 1.5 格 = 13.5 格
整串回放 = 提交 1 格 + 6 个任务 × 每个算 1.5 格 = 10 格
设备真正在算 = 6 × 1.5 = 9 格
> 两边设备干的活一样多，差别是 Host 交任务占掉的时间
```

两点要记住。第一，**这幅示意没有减少设备计算量**，省的是 Host 交任务的次数。较大的 prefill 批次处理更多提示词位置；若设备工作已盖住下发开销，减少下发就难以缩短这段等待。小 prefill 或混合批在下发成为瓶颈时也有优化空间，能否回放还由模式与后端决定。prefill 可以分块，不要求整段提示词一次算完。第二，上面的格数是教学设定，本库没有 NPU 实测数据，不据此给出加速比。

## 一张图里录下来的是什么

录下来的不是算出来的数，而是两样东西：**一串设备任务的次序**，以及**每个任务读写哪块地址**。下面的地址与录放图按固定旧 GLM 实现展开；rc2 可更新图的条件性同步及 update/replay 次序见[版本差异](#版本差异)。

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
- **模式对不上就原样执行。** 包装器只照上游给的运行模式和描述符办事，对不上就把调用原样透传给模型，既不录也不放；该不该用图由运行器和分派器（上游按宽度与条件挑图的那一层）决定，整个流程见[图模式](graph-mode-layer.md#包装器内部透传回放还是现录)。

运行模式为 NONE 时，这个包装器也直接执行内部计算。NONE 表示本次调用不走这个包装器的捕获或回放；显存分析、热身或关闭图的调用若传入 NONE，就进入这条直接执行路径。判断本轮是否回放，要先看运行模式是否允许，再看描述符对应的缓存条目；仅凭宽度相同或缓存中已有图，还不足以确定。
- **地址是约定，不是提示。** 本轮需要变化的内容没有更新、回放任务又读取了这些位置时，就会读到旧值；包装器不会检查这些数是不是本轮的数据。调试日志级别下会核对位置参数中 Tensor 的地址是否与捕获时相同，这项检查既不比较内容，也不覆盖所有关键字参数。

## 什么能进图，什么不能

限制都从「录的是次序和地址」这一条长出来：

- **宽度要固定。** 一张图录的时候多宽，回放时就得正好多宽。真实批次几乎不会正好落在录过的宽度上，所以进模型前先往上补齐到最近的一档；补到哪一档、两个 [DP 组](data-parallel.md)（各自调度、各有 KV 池的一台机器）之间怎么再对齐，账在[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)里，本页不重算。
- **地址要固定。** 输入、输出、算子自己的工作区都绑在捕获时那几块内存上。
- **Host 上的判断不会随图自动重跑。** 固定捕获路径记录的是当时提交的设备任务；Python 在 Host 上判断要不要用图、用哪一张、这一步补到多宽，仍须在提交之前完成。这不意味着设备 kernel 内部不能有自己的条件判断。
- **每轮都在变的注意力参数要另外补。** 查询长度、已算长度、块表这些数每一步都不一样，而算子的入参在录下来的那一刻就固化了。两条补法：一是让这些数始终写在同一块稳定缓冲里，算子读的是地址，内容换了不用改图；二是回放时把已录任务的入参换掉——昇腾在普通注意力后端上就是这么做的，用一个事件把图挡在注意力那一步之前，Host 在另一条流上改完参数再放行。

- **算子自己得支持。** 每个注意力后端声明一个等级：混合批也支持、只支持「一批里每条请求位置数都一样」、只支持「每条正好 1 个位置」、完全不支持。整个模型按所有后端里最低的那个算，配置里要求的档位超出这个等级就自动降级并打一条 warning；只有「完全不支持」兜不住——要求混合批也走整趟图时，启动直接报错；只给 decode 要整趟图的，退到分段或不录图，同样打 warning。
- **只在启动窗口里录。** 服务期遇到没录过的形状不会临时补录，捕获合法性检查会直接拒绝；启动期怎么热身、怎么按宽度从大到小逐个录，见[图模式](graph-mode-layer.md#启动时录运行时放)。

## 图片先过视觉编码器，这一步也能录成图吗？

**视觉编码器先把图片或视频变成一串特征向量，语言模型随后才使用这些向量。** 前后两段可以各有自己的图；视觉图减少编码器的 Host 下发开销，仍然计算这次媒体的特征。它与[编码结果缓存](api-server-entry.md#三种缓存各自省掉哪一步)不同，缓存命中才是复用以前的结果。小图片或小批编码也可能等在 Host 下发，但另录视觉图需要额外捕获和固定缓冲。

### 图片张数相同，为什么会选不同的图？

视觉图按**编码器输出的 token 数**设置容量档位。每张图片产生的特征位置数由分辨率及处理布局等共同决定；视频还需计入各帧。因此图片张数、像素数、视觉输出 token 数和语言模型本轮生成位置数是四种量，不能拿 GLM decode 的七档宽度直接当视觉容量。

以单路径编码器为示意，已录容量为 128、256、512，每次最多放两项；原输入按 A、B、C 排列，分别产生 192、96、160 个特征位置。执行端先按大小排成 B、C、A，再按最大容量和项数上限分批，最后为每个子批选最小能装下的档位。

```wiki-diagram
file: vit-graph-packing
```

图里的排序只改变执行组合。每次回放后拆出有效结果、复制出复用的输出缓冲，再恢复 A、B、C 的原输入顺序，交给语言模型的媒体位置对应关系才保持不变。

```calc
title: 三项视觉输入怎样使用图容量（示意）
第一子批 B+C = 96 + 160 = 256 个位置
第二子批 A = 192 个位置
两次都选256档，共覆盖 = 256 + 256 = 512 个位置
实际有效位置 = 192 + 96 + 160 = 448 个
容量余量 = 512 − 448 = 64 个位置
```

余量是容量账，不是时间损失百分比；实际算子还取决于输入布局。若另有单项输出超过最大 512 档，该项走 eager，即直接执行、逐个提交设备任务。不能把这条 token 超档分支推广成任意缓冲不足都会自动退回。

### 视频帧容量和跨卡分工要另算

以 Qwen3-VL 为例，一项视频的多帧各有注意力序列终点；捕获时需要为这些长度元数据预留空间。帧容量控制这类缓冲，不是输入视频的裁剪开关。已核装箱逻辑按 token 容量和媒体项数分批，没有按总帧数自动重新拆批；把帧容量设得太小，不能期待它自动少取几帧或转 eager。视频数量的输入限制与此分开。

视觉编码也可以将不同媒体项分给同一 TP 组内的不同 rank，各自编码后收集结果、去掉补齐部分并恢复原顺序。这里的 data 模式描述视觉项怎样分工，没有另建服务 DP 实例；模型副本和 P/D 资源计数仍沿用[部署分组](glm-5-3-flash-two-node.md#部署前提)。

### 在 Ascend 上怎样保持本轮数据正确？

Model Runner V1 的 Ascend 接入会换成专用的视觉图管理器：把本轮像素与元数据写入固定缓冲，再提交回放。标准视觉注意力路径使用 FIA（融合推理注意力算子），它还需要本轮序列长度等参数；捕获时就在相应设备任务前放入等待事件，更新流改好任务参数后记录事件，计算才继续。

所以源码在 Python 层先调用 replay、再调用更新，不等于设备先用旧长度完成注意力。真正的先后关系还由图内事件决定。每次编码得到的有效输出也要从共用缓冲复制出来，否则下一个子批回放会覆盖上一批结果。310P 使用另一个注意力实现，本段 FIA 接入不能代替它的设备验证。

模型必须实现视觉图协议，提供预算、固定输入、回放准备和输出拆分等方法；仅能处理图片还不够。**固定 GLM 镜像的多模态类及其旧 GLM4V 父类没有实现这套协议，因此不能只增加视觉图开关，就认为原部署获得了视觉图。** 语言模型的七档图仍按下一节成立；新版多模态适配、裁剪条件与 runner 的入口差异放在版本表。

## 放到 GLM 双机：只给整齐的 decode 步录 7 张图

固定部署（[部署前提](glm-5-3-flash-two-node.md#部署前提)）把档位配成「只给整齐的 decode 步录整趟图，其余步一律逐个下发」，并显式给出 7 个捕获宽度：4、8、16、32、64、96、128。一条请求一步占 4 个位置（1 个已确定的 token 加 3 个 MTP 草稿，MTP 是模型自带的多 token 预测层，见[投机解码](speculative-decoding.md)），所以这 7 档对应 1、2、4、8、16、24、32 条请求；这笔账与 7 张图的清单在[图模式](graph-mode-layer.md#官方双机上录了哪-7-张图)里，本页不重复。

这一档配置和上面那条「算子自己得支持」是自洽的：GLM 的两类注意力后端——45 层主干里的 34 层 KDA（[线性注意力](linear-attention.md)）和 11 层[稀疏 MLA](sparse-attention.md)——声明的都是「一批里每条请求位置数都一样才支持」。混合批本来就上不了整趟图，所以配置检查照原样放行，不降级也不警告。反过来说，**只要有一步混进了 prefill，这一步就没有图可用**，两个 DP 组还要按较低的那一边取齐。

还有两处昇腾自己加的动作：

- **回放前先等一下。** 主模型走整趟回放时，包装器先让当前流同步一次，再提交整串。异步调度下，若第 i 步在 Host 上改参数时第 i−1 步的图还没放完，两轮就会同时访问这份参数；同步让改参数发生在上一轮回放全部结束之后。
- **本模型通过各后端的固定缓冲更新元数据。** 运行器在模型前向前构建本轮注意力元数据：主稀疏 MLA 引用公共缓冲，压缩索引器刷新自己预分配的缓冲，KDA 构建器刷新状态索引、查询起点和已接受数量。实际算子继续使用这些缓冲；机制统一见[图模式的数据准备](graph-mode-layer.md#回放之前必须先把数据写对)。另一条“在侧流上刷新整图注意力参数”的通用路径要求既不是稀疏注意力也不是压缩路径，因此 GLM 不走它；该通用调用与图执行的先后条件见版本差异。

启动期录这 7 张图要花多久、占多少设备内存，要看这套部署的启动日志，本库还没有这份日志。

## 常见误解

- **「ACL Graph 是昇腾另搞的一种图模式。」**——档位定义、按宽度分派、补齐表都在上游 vLLM 里，昇腾提供的是平台接入点和这套捕获、回放的包装器。同一个档位枚举两边共用。
- **「图里存着上次算出来的结果，回放等于拿缓存。」**——存的是次序和地址，每一轮都照原样重算一遍，结果当然会变。
- **「录一张图，什么批次都能用。」**——一张图一个宽度，还得满足描述符里的其他条件；宽度对上了不等于一定回放。
- **「回放看的是本轮数据，跟地址没关系。」**——地址就是约定。需要变化的内容没更新，图就可能沿用旧值；地址不同在 DEBUG 下还可能直接触发断言。
- **「历史长度每步都在变，所以 decode 根本录不了图。」**——变的那部分靠稳定缓冲或换已录任务的入参补上，不是把长度录死在图里。
- **「包装器自己判断这一轮该不该用图。」**——不判断。它只看运行器给的模式和描述符，模式对不上就把调用原样透传给模型。

- **「开了它这一步就一定更快。」**——省的只有 Host 交任务的时间；补齐还会让一部分位置空跑。形状长期不整齐时，收益会被补齐和退回吃掉。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 Ascend `2ed6cbba`；main 为 Ascend `baa023ad`。

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
- **宽度表还会被筛选。** 上游 sequence parallel 开着时，不是 TP 倍数的宽度被筛掉；若同时指定了捕获列表与最大宽度，而过滤后列表的最大值与该上限不一致，会先抛错。通过一致性检查后，最终最大宽度才取有效表的最大值。昇腾 A5 在分段编译路径上，对超过 4 档的表按索引等距采样到 4 档（首尾必留），并发出 warning。
- **档位还会被后端等级压低。** 运行器扫过所有 KV cache 组的注意力后端取最低等级，交给上游解析：要求混合批走整趟图而最低等级不是「混合批也支持」时，降到分段档或只给 decode 的整趟档并打 warning；最低等级是「完全不支持」时，混合批整趟图直接抛 ValueError，decode 整趟图退到分段档或不录图。四个等级的定义在上游枚举里；GLM 的稀疏 MLA 后端与 KDA 走的 GDN 构建器分别见来源 12、13，两者声明的都是「一批里每条位置数一样才支持」。

### 会报什么错

视觉图配置中，非正的显式 token 预算会被拒；开启时负项数或负帧容量会被拒。基线同时给预算和项数、且项数大于最小预算时，还会报出每项分不到一个输出位置的错误。模型没有协议时，V1 不创建视觉图管理器；Qwen3-VL 开启多模态裁剪时，模型把图支持的模态列表置空，图片和视频都会退出这条图路径。

检查是否实际生效，应看视觉管理器的初始化预算、捕获完成记录及命中/退回统计，而不是只看语言模型“图捕获成功”。基线初始化日志列 budgets、max_batch_size、max_frames_per_batch 与 use_dp，调试日志记录子批 token、所选 budget 和补齐比例；这些值用于核对配置和实际形状，设备性能还需同输入对照测量。

| 条件 | 报错或检查点 | 怎么处理 |
|---|---|---|
| 设了 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台在配置阶段抛 `ValueError`，说明两者不兼容，建议改用别的调试手段 | 要同步执行先关图 |
| 捕获时设备流资源不足 | 明确的流资源不足文本，或 `207008` 同时带 `stream resource` 文本，才命中这项错误包装；单有错误码不够 [C3] | 按提示减宽度，并确认 HDK / CANN 版本 |
| 混合结构模型开整趟图，并发上限超过状态缓存块数 | 上游在配置阶段抛 `ValueError`，提示调小并发或提高显存占用比 | 每条 decode 请求要占一块状态缓存 |
| 捕获已被上游禁用时又触发捕获 | 合法性检查抛 `RuntimeError` [C1][C28] | 检查调用时机以及描述符是否已经捕获 |
| 调试日志级别下回放，位置参数中 Tensor 的地址与录制时不同 | 包装层断言失败，打印期望与实际地址 [C2] | 检查是否换了输入 Tensor；这项检查不验证内容是否最新 |

所列 v0.26 快照捕获到“Alloc sq cq fail”这类旧 HDK 错误特征时，会提示升级到 HDK 25.5.1 或更新版本，并使用匹配的 CANN。这是该错误分支的排查建议，不是所有图模式场景的统一最低版本声明。


### 开销和什么时候别开

- **启动**：每个宽度都要跑一遍空批次并录一次；增加宽度会增加捕获工作，录好的图还要占设备内存。评估本部署的 7 个宽度时，应从启动日志分别记录捕获耗时和内存增量。
- **运行**：整趟回放前多一次当前流同步，条件是运行模式为 `FULL` 且不是 eagle 合图路径；开了 `enable_enpu` 时跳过，改由运行器自己排更新与回放的先后。
- **补齐的浪费**不在本页记账，见[多条请求](concurrent-requests.md#先补到自己这组的图尺寸)。
- **什么时候别开**：请求形状长期不整齐时，收益会被补齐和退回吃掉；排查精度或 hang 问题常用强制 eager，但它同时关掉编译期改写和图，问题消失只能把范围缩到这两层，怎么分开见[图模式](graph-mode-layer.md#对照源码) [D]。

### 版本差异

视觉图使用的固定上游分别是 0fc695fc、568afb3a、ced6857a、84030bbe；Ascend 比较点沿用本页钉点并补 rc2 的 7d825229。main 上游是独立比较快照，不由此声称它与 Ascend main 精确配套。

| 视觉图检查项 | v0.23 / 固定基线 | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| 四字段默认与 V1 总入口 | false / [] / 0 / None；总模式 NONE 先返回 | 相同 | 相同 | 相同 |
| Ascend V1 实际管理器 | 捕获上下文换为 EncoderAclGraphManager | 相同接入方式 | 相同接入方式 | 相同接入方式 |
| 上游路径组织 | 单路径预算 | 增加模型选择的全局图像/局部切片两条路径 | 通用多路径及额外捕获轴组合 | 同 rc2 |
| NPU 多路径边界 | FIA 参数按 token_budget 建账 | 仍按预算建账，多路径分账尚有 TODO，不能仅因接收 path 就宣布完整支持 | 仍按预算建账；另明确拒绝非空 capture axes，抛 NotImplementedError | 同 rc2 |
| GLM 多模态协议 | 固定 db 镜像与旧上游父类没有协议 | 上游 GLM4V 已有；Ascend 此快照没有固定 GLM5Next 本地注册 | GLM5Next 有实际注册和协议适配，去掉该视觉塔不产生的 pos_embeds | 同样有适配；仍需模型与设备验证 |
| Qwen3-VL 多模态裁剪 | 图的模态列表为空，图片和视频均退出 | 相同 | 相同 | 相同 |
| Ascend 上游视觉后端选项 | 平台重置 mm_encoder_attn_backend 为 None | 相同 | 相同 | 相同 |

较新上游的 Model Runner V2 分别判断编码器和语言图的捕获，入口不同于上表 V1 的 NONE 早退；不能直接套用 V1 条件。Ascend V2 的默认状态链和通用图适配另有实现，本节只核清 V1 专用 FIA 事件链；V2 的模型、形状与设备组合尚需实际捕获和结果对照。官方 ViT 指南的性能表使用 GPU 及指定模型，不是本站 A2/GLM 的收益数据。

**v0.30.0rc2 的可更新图有条件性的 update/replay 顺序。** FULL 加特定 attention backend 才进入该分支，普通路径仍直接 replay；enable_enpu 时先 update 后 replay，其他可更新图路径先 replay 后 update。主模型从 ContextSource 的 attention metadata 取任务，draft 从 SharedSource 的 draft metadata 取任务。FULL 通常在回放前同步流，但 ENPU 或 EAGLE draft 合图场景会跳过该屏障。不能把它概括为每步都先更新，也不能据此宣布旧 GLM 所有 FULL 图都命中可更新分支。

| 检查项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 包装器与条目结构（透传 / 查条目 / 录 / 放） | 维护分支与专用镜像是同一份文件，错误码、类、更新入口几处行号都相同 | 同，行号后移 | 同，另有一个可打断的包装器单独成文件 |
| 捕获失败识别 | 只识别设备流资源不足 | 多识别旧 HDK 的 `Alloc sq cq fail` 并提示升级 | 与 v0.26 同 |
| `ASCEND_LAUNCH_BLOCKING=1` 撞上图模式 | 启动抛 `ValueError` | 同 | 平台图模式配置函数不再含这项拒绝检查；示例和测试中仍可能设置该变量，不代表所有调试组合都受支持 |
| A5 砍到 4 档的门禁 | 按设备类型判断 | 同 | 改按硬件能力标记判断；枚举声明见来源 22，实际消费见来源 30 |
| 整图注意力参数更新入口 | 有 | 有 | 有 |

官方文档把 ACL Graph 记在 v0.9.0rc1 起，并列出五个档位；最终有效模式仍受平台与后端限制 [S23]。设计文档把参数更新概括为“回放之前” [S24]，实际非 ENPU Python 路径却先调用模型、再调用通用更新入口 [C16]。普通 paged attention 的具体机制能解释这个次序：捕获时先登记事件等待，再登记注意力任务；更新流修改该任务后记录事件，才允许注意力执行 [C18][C31]。因此更新要赶在对应注意力任务执行前，未必早于整张图的 replay 调用。固定 GLM 则走前文的缓冲更新路径，两条机制分别核对。

### 源码位置

固定 GLM 的构建先于前向见来源 119–120；稀疏 MLA 子类接公共元数据、传递查询与历史长度并进入设备算子见 121–124，结合既有来源 32–34 的块表复制。压缩索引器和状态缓存实际消费这些元数据见 125，KDA 的投机元数据封装见 126；持久缓冲更新及真实 Kimi 注册/算子消费者分别回查[图模式](graph-mode-layer.md#源码位置)与[算子页](ops-and-kernels.md#源码位置)的既有固定来源。这里限定 db701c1f 与配套上游 0fc695fc，不将新版模型实现套回这条链。

视觉图的固定官方设计见来源 37–39；四版字段、校验、V1 入口与 Qwen3-VL 裁剪分别见 40–44、45–49、50–54、55–59。NPU V1 的实际替换与回填见 60–69；各版专用捕获/回放见 70–77。FIA 按预算记账及事件更新链见 78–81，预算推断、分批、复制和 TP 收集见 82–86；双路径、多路径及较新 V2 入口见 87–90。310P 的另一注册见 91，帧元数据与真实装箱约束见 92–96，Ascend 平台视觉后端重置见 97–101。

固定 GLM 的实际注册、完整子类与旧父类见 102–104；v0.26 上游 GLM4V 协议与 Ascend 注册范围见 105、108；rc2/main 的父类与 GLM5Next 适配见 106–107、109–114，运行时协议检查见 115。新视觉图示的 128/256/512 与 A/B/C 数值是按分批算法建立的教学示意，不是这些模型的实测参数。

后三个 Ascend 快照的视觉 FIA 参数仍按 token_budget 建账，分别见来源 116–118；rc2/main 新增 capture axes 拒绝检查，没有同时解决这项多路径分账限制。

| 看什么 | 在哪 |
|---|---|
| 透传、查条目、捕获合法性检查 | 来源 1、19、28：ACLGraphWrapper 的调用与捕获检查；main 可打断变体见来源 21 |
| 地址核对、回放前同步、回放 | 来源 2：同一包装器的回放分支 |
| 捕获失败的错误重抛 | 来源 3：错误码判定；v0.26 的 HDK 提示见 20、26，main 对应分支见 35 |
| 整模型包装、最低后端等级、通用更新条件与顺序 | 来源 14–17：model_runner_v1 |
| 换已录任务入参：事件等待与参数更新 | 来源 18、31：attention_v1 的捕获与 update_graph_params；rc2 可更新图见 27 |
| 默认最大捕获宽度、A5 砍档、调试变量互斥 | 来源 4–6、29：旧 platform；main 的能力声明与消费见 22、30，v0.26 分支见 36 |
| 宽度表生成、截断与 SP 过滤 | 来源 7、33：上游 config/vllm.py |
| 投机倍数、后端降级链、状态缓存块校验 | 来源 8–10：上游 config/compilation.py |
| 四个支持等级及固定 GLM 后端声明 | 来源 11–13：上游枚举、稀疏 MLA 和 GDN 构建器 |
| 当前活跃请求行的块表复制 | 来源 32、34：block_table 的提交与模型准备输入时的调用 |

固定 GLM 元数据的构建、原地更新和算子消费链已有静态源码依据。仍待核的是 NPU 图执行中复制与读取的实际依赖、与 eager 的数值对照，以及 7 张图的捕获耗时、设备内存占用和加速比；这些需要设备记录，不能由地址稳定或源码调用顺序直接推出。本页配置、分支和报错尚无 NPU 触发记录或部署启动日志。

**包装器与配置的来源。** 来源 19 的 2c59ff10 包装器注释明确把持久输入缓冲与复制交给外部；它不证明 GLM 每个后端的元数据更新路径。db701c1f 的 acl_graph.py 138–170 行先处理 NONE/模式不匹配，再查条目并校验捕获阶段，不能把“条目不存在”解释成服务期间随时允许捕获。默认上限由来源 4 的平台分支派生；投机与 SP 倍数兼容检查见来源 8 的编译配置。上述结论限定相应固定源码，设备开销及 GLM 后端待核项仍见前段。

