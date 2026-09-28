---
id: kv-cache-memory-profiling
title: KV cache 显存预算：启动时怎样一项项扣出来
type: concept
summary: 启动时先按总显存乘显存比例定预算，再用一次最大批量的 profile run 量出激活峰值和非 torch 增量，连同权重一起扣掉，剩下的切成 KV 块；录图等后来才出现的占用从预算外支付，预算也不能直接换成固定并发数。
aliases: [KV Cache Memory Profiling, memory profiling, 显存探测, 显存量测, 显存预算, 显存容量, 缓存预算, gpu_memory_utilization, --gpu-memory-utilization, kv_cache_memory_bytes, --kv-cache-memory, profile_run, profile run, determine_available_memory, non_torch_increase, 非 torch 增量]
chapters: ["11"]
sources:
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L464-L497
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597
  - vllm@0fc695fc:vllm/utils/mem_utils.py#L96-L126
  - vllm@0fc695fc:vllm/utils/mem_utils.py#L191-L256
  - vllm@0fc695fc:vllm/utils/mem_utils.py#L263-L268
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L865-L867
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3729-L3794
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3683-L3696
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6227-L6241
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3460
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1660-L1666
  - vllm@0fc695fc:vllm/v1/engine/core.py#L244-L263
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L713-L750
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2024-L2085
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L717-L758
  - vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L416-L443
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L742
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L575-L788
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L616-L889
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3714-L3730
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4254-L4270
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L282-L284
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L487-L489
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2080-L2081
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L722-L726
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: device-memory, kind: builds-on, note: 先分清权重、临时张量和 KV cache 在设备内存里各放什么}
  - {to: kv-cache-spec, kind: builds-on, note: 可用 KV 显存要按每块字节数切块，块规格在那页}
  - {to: gap-a5164fe10fa9184412f8, kind: builds-on, note: HCCL 缓冲属于非 torch 增量，各组留多大、折合多少块在那页}
  - {to: acl-graph, kind: builds-on, note: decode 图在切完 KV 之后才录，图内存从预算外支付}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 启动时怎样知道还能给 KV cache 多少显存？

**memory profiling（显存量测）是 vLLM 启动时做的一次显存记账：先按「总显存 × 显存比例」定下预算，再用假数据试跑一次最大批量，量出权重之外还要占多少，预算里剩下的全部交给 KV cache。** KV cache 是每条请求已经算过的历史状态，下一步前向要接着读；它分到多少显存，决定了能同时留住多少请求、多长的上下文，见 [KV cache](kv-cache.md)。

```wiki-diagram
file: kv-cache-memory-profiling
```

图从上往下读，每一行比上一行多扣一项：

1. **定预算。** 预算等于这张卡的总显存乘上显存比例（参数 `gpu_memory_utilization`）。启动时先拍一张显存快照，记下当时的空闲量和总量；空闲量连这份预算都不够，就直接报错退出。
2. **扣权重。** 权重在加载时就量好了，是加载前后 PyTorch 分配器记下的占用之差。PyTorch 分配器是 torch 自己管理的显存池，张量都从这里分配。
3. **扣激活峰值。** 这一项靠 **profile run（试跑）**：用假输入，按一步最多处理的 token 数跑一次前向，结果丢掉，只看这期间 PyTorch 分配的最高点。最高点减去试跑前的占用，就是激活等临时张量的峰值。
4. **扣非 torch 增量。** 有些显存不经 PyTorch 分配器，例如 HCCL（昇腾的集合通信库）为每个通信组预留的缓冲。它们没法按张量大小去算，只能量「设备已用 − PyTorch 已保留」这个差：试跑结束时的差，减去启动快照时的差。

四项扣完，预算里剩下的就是 KV cache 的份额，按每块的字节数一次性切成 KV 块。最右边斜纹那段不在预算里：启动快照之前已经被占的显存，切完 KV 之后才录的 decode 图（把一次前向的算子序列预先录下来，之后按同样尺寸回放），以及其他后来才出现的占用，都从这一段支付。

## 为什么要先试跑？代价落在哪里？

**权重、临时张量和 KV cache 的生命周期不同，只有权重的大小能提前算准。** 权重加载后在整个服务期间常驻。激活和算子工作区随这一步的 token 数、算子实现和执行模式变化，一步结束就释放。KV cache 却要跨很多步保留，直到请求结束或被回收。所以不能把「空闲显存」全部分给 KV cache，得先知道临时张量最多会占多少；最直接可靠的办法，就是真跑一次最大的批量，把峰值量出来。

**多留或少留的每一字节，最后都变成 KV 块数。** 在我们的双机部署里，一个 KV 块号占 [7.969 MiB](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)；光是 HCCL 为四个跨卡通信组预留的缓冲，按配置就有 650 M，折合约 82 块、5 万多个 token 的历史，推导见 [HCCL buffer](gap-a5164fe10fa9184412f8.md#这些组合起来从-kv-里拿走多少)。非 torch 这一项要是量少了，KV 就切多了，运行到峰值时显存不够；量多了，就白白少存一截历史。

代价落在三处：

- **启动时多一次前向。** 要按最大批量真跑一次，GLM 还多跑一次 128 个 token；这次试跑同时兼做模型的首次编译，所以指定显式预算也省不掉它。
- **只对这一套配置成立。** 量到的是当前批次上限、执行模式、并行布局和量化方案下的用量；换掉其中任何一项，权重和运行开销都会变，要重新量。
- **量不到后来才出现的占用。** 试跑时还没录图，有些缓冲要到第一次真实前向才创建。它们不在扣减项里，只能由预算外那一段来装；那一段留少了，就会在录图或第一条请求时显存不足。试跑期间要是同卡别的进程释放了显存，测量本身也会报错。

下面三个量名字相近，读日志时最容易混：

| 量 | 怎么算 | 给谁用 |
|---|---|---|
| 预算 | 总显存 × 显存比例 | 权重、激活峰值、非 torch 增量和 KV cache 共用 |
| 可用 KV 显存 | 预算 − 权重 − 激活峰值 − 非 torch 增量 | 只给 KV cache，一次性切成块 |
| 预算外 | 总显存 − 预算 | 快照前已被占的、decode 图、后来才创建的缓冲 |

## 放到 GLM 双机：一张卡的预算怎样扣

[官方双机部署](glm-5-3-flash-two-node.md#部署前提)是 2 台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16，权重用 W8A8 量化；显存比例按教程设为 0.85。量测发生在[启动的第五步](glm-5-3-flash-two-node.md#启动时发生了什么)，这时还没有任何请求。16 张卡各有一个 worker（管一张卡、真正执行前向的进程），各自做一遍上面四步，再把结果交给本机的 EngineCore（每台机器一个的引擎进程，负责调度和分配 KV 块）。

下图是代码里的先后顺序和唯一的分支。

```wiki-diagram
file: kv-cache-memory-profiling-flow
```

快照在建通信组之前拍，所以建组时 HCCL 占上的缓冲会算进非 torch 增量；权重在建组之后加载，单独记账。指定了显式 KV 预算时，试跑照样执行，但不再做扣减。最右一列是 EngineCore 收齐各卡结果之后的事：定块数、分配 KV 池，最后才录图。

### 试跑两次：先按 128 个 token，再按 8192 个

**GLM 的试跑分两次，为的是把 MoE 的两条通信路径都量到。** 一步最多处理 8192 个 token，这是[调度的 token 预算](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)，试跑按这个数喂假输入。可是 MoE 层在 token 数不超过 128 时走 MC2（专家计算和跨卡收发协同执行的昇腾实现），超过就换成 AllGather 路径（先用 [All-Gather](collective-communication.md#all-gather) 把各卡的 token 收齐，再各算本卡的专家），门槛见[MoE 通信那一节](one-request.md#moe-通信走-mc2-还是-allgather)。只跑 8192 个 token，量到的只是 AllGather 路径。所以一步上限超过 128、且 128 个 token 时选的是 MC2，vllm-ascend 就先按 128 个 token 跑一次 MC2 路径，再跑上游那次 8192 个 token 的试跑。两次都在同一个量测区间里，激活峰值取的是两次合起来的最高点。

**试跑不建注意力元数据，GLM 两种注意力层的核心计算都没有真跑。** 试跑按 eager 方式执行（逐个下发算子，不用图），也不准备注意力要用的块表等元数据。GLM 的 45 层里有两种注意力：11 层是稀疏 MLA（MLA 把历史压成小向量存进 KV cache，稀疏是指每个查询只挑一部分历史 token 来读，见[稀疏注意力](sparse-attention.md)），34 层是 KDA（Kimi Delta Attention，一种线性注意力，把整段历史压进每个头一个固定大小的矩阵状态，见[线性注意力](linear-attention.md)）。两种层见到元数据为空，都提前返回：

- **稀疏 MLA 层**把输出填零返回，里面的索引器（给历史位置打分、挑出这一步要读哪些 token 的小网络）根本没有运行。
- **KDA 层**照常算 q、k、v、β 和门控这些投影，但在短卷积和递归计算之前就返回，输出保持全零；后面的归一化和输出投影拿着全零照常跑。

这带来两个后果：量到的激活峰值不含稀疏 MLA 的注意力计算，也不含 KDA 的短卷积和递归计算；索引器第一次运行时才转出的两份 FP32 副本（每卡约 54 MiB，见 [TP 页](tensor-parallel.md#加载权重之外每卡还会创建同样大的运行时副本)）也不在扣减项里，要到录图或第一条真实请求时才出现。

**漏掉的计算只会让激活峰值偏低，最多偏一层的量。** 激活峰值是整次试跑里 PyTorch 分配的最高点。没跑的计算不分配临时张量，所以测出来的只会等于或小于真实峰值，不会偏高。每层的临时张量在这一层算完就释放，下一层重新分配，所以 34 层 KDA 的漏量不会累加：偏低的上限，是单独一层 KDA（每卡 8 个头）在 8192 个 token 下做短卷积和递归时的临时占用；而且只有这一层的占用超过试跑中别处的最高点，才会真的拉高峰值。这一层到底多大，没有实测，本页不给数。

**它不改本页的结论。** 第一，KDA 的递归状态本身放在 KV cache 里（每条请求固定占 12 个块号，见下文），从可用 KV 里切，跳过递归不影响状态占多少、块数怎么切。第二，GLM 的激活峰值本来就没有实测，下面算例里的 3.4 GiB 是教学假设，30.00 GiB 和 3,855 块都不依赖试跑量到的值。第三，这部分漏量和稀疏 MLA 的一样，运行时从预算外那 15% 支付，已经列进[预算外](#预算外的-15图副本和启动前已被占的)的清单。

### 三项扣减在 GLM 里各是什么

| 扣减项 | GLM 双机的每张卡上 | 数值 |
|---|---|---|
| 权重 | W8A8 加载后的主干 45 层和 MTP 层（模型自带、先猜后面几个 token 的草稿层），路由专家每卡 18 个 | [21,078 MiB](glm-5-3-flash-two-node.md#每张卡上放了什么) ≈ 20.58 GiB，算例取整为 21 GiB |
| 激活峰值 | 两次试跑中 PyTorch 分配的最高点 | 未实测 |
| 非 torch 增量 | HCCL 各通信组的缓冲等；建组在快照之后，所以落进这一项 | 跨卡四组按配置合计 650 M；和激活峰值合计按 3.4 GiB 假设 |

MTP 层的权重和 KV 都和主干一起记账。三项里只有权重有逐项推导，另外两项要等实机日志，眼下按双机页的教学假设取值。

**按这组数，预算是 54.40 GiB，扣完剩 30.00 GiB，切成 3,855 块。** 这个算例假设每卡 64 GiB 显存、权重取整为 21 GiB、激活峰值加非 torch 增量为 3.4 GiB；权重不取整则是 3,908 块。完整推导、每块 8,355,840 B（每 token 13,056 B）的来历，以及两种块数各在什么时候用，都只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护，本页不重算。权重各部分为什么常驻、怎样搬进显存，见[设备内存](device-memory.md#启动预算显存里还要容纳权重之外的东西)。

### 切成块：各卡取最小，块数不等于并发数

**EngineCore 收齐本机 8 个 worker 报来的可用 KV 显存，按每块字节各自除、向下取整，再取其中最小的块数，所有卡都按它分配。** 除法和取最小都在 EngineCore 里做，worker 只负责报数。各卡的激活峰值和非 torch 增量不一定完全相同，取最小才保证每张卡都放得下；多算出的张量空间按比例收回，不白占。两台机器各有一个 EngineCore，各自取最小，彼此不再对齐；接收请求的 API 服务进程汇总时把两台的块数相加，所以它报出的总块数不是单台机器的块数。切块之前，各卡的可用显存还要过两道检查：可用显存不大于零，直接报错；连一条最大长度的请求都装不下，也报错。一个块号为什么同时占着各缓存组的空间、每块多大，见 [KV cache 规格](kv-cache-spec.md)。

**块数不等于能同时服务的请求数。** GLM 的缓存同时有 34 层 KDA 的递归状态和稀疏注意力的历史：KDA 状态每条请求固定占 12 个块号，一条只有 7 个 token 的新请求也要占 15 块，见[为什么短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)。所以同样的块数能放几条请求，要按每条请求的长度和各缓存组的状态逐条算；前缀共享、回收等机制还会改变这笔账。

### 预算外的 15%：图、副本和启动前已被占的

**0.85 意味着每卡有 15% 不进预算，按 64 GiB 的假设是 9.6 GiB**，见[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。它不是多出来的 KV cache，而是后来那些占用的去处：

- **启动快照前已被占的显存。** 启动检查要求当时的空闲量不少于预算，等于要求这部分不超过 15%。
- **decode 图。** 切完 KV 之后才按 7 个尺寸录图（见[启动第七步](glm-5-3-flash-two-node.md#启动时发生了什么)），录图用的显存不在任何扣减项里。
- **索引器的 FP32 副本。** 每卡约 54 MiB，第一次真实前向或录图时才创建。
- **试跑时没真正执行的计算。** 稀疏 MLA 的注意力，以及 KDA 的短卷积和递归计算，它们在实际运行时的临时占用没有被量到；不过每层用完就释放，最多差一层的量。

**录完图，每张卡打一行日志，把四项实际用量和建议值一起报出来。** 这行日志只在没有指定显式 KV 预算时才打。四项是权重、激活峰值、非 torch 增量和 NPU 图内存。建议值是「预算 − 四项 − 150 MiB」，另给一个「启动时的空闲量 − 四项 − 150 MiB」，都可以直接填进显式 KV 预算参数。多留的 150 MiB 按源码注释的说法，是用来兜住量测对设备上下文、HCCL 缓冲、驱动层这类非 torch 占用的少量低估。**这行日志是激活峰值、非 torch 增量和图内存唯一的实测来源**；这套部署的日志目前还没有，缺口列在页末源码区。

## 常见误解

- **「0.85 就是给 KV cache 留 85%。」** 0.85 圈出的是整份预算，权重、激活峰值和非 torch 增量都从里面扣。GLM 算例的预算是 54.40 GiB，最后留给 KV cache 的是 30.00 GiB。
- **「预算外那 15% 空着，可以再多切点 KV。」** 这一段要装录图、索引器副本、启动前已被占的显存，以及试跑没量到的临时占用。只看空闲量就把比例调高，一旦这一段装不下，录图或第一条请求时就会显存不足。
- **「试跑量到的就是运行时的最高峰。」** 试跑不录图、不建注意力元数据，稀疏 MLA 直接返回，索引器也没有运行，KDA 只算投影、跳过短卷积和递归；所以量到的峰值只会偏低，不会偏高。它量的也只是当前配置下试跑那一刻的用量。别的进程在这之后改变占用，量测结果同样不再成立。
- **「非 torch 增量可以按张量大小算出来。」** 这一项本来就是不经 PyTorch 分配器的显存，比如 HCCL 缓冲、试跑中顺带分配的通信缓冲，只能用快照差去量，不能拿张量元素数代替。
- **「上游 GPU 代码会先估出图内存再扣，昇腾也一样。」** 上游 GPU Worker 确实有图内存预估，但只在 CUDA 上、且要显式打开环境变量才从预算里扣；昇腾的 NPUWorker 没有这一步，图内存全部从预算外支付。
- **「块数就是能同时服务的请求数。」** 一条请求占几块取决于长度，还要加上 KDA 状态的固定开销；短请求也要 15 块。
- **「指定了显式 KV 预算，就不试跑了。」** 试跑照样执行，用来完成模型的首次编译，只是不再做扣减，直接采用指定的字节数。启动时的空闲检查、设备的实际容量和运行峰值依旧存在，而且显式值不受显存比例约束。

## 对照源码

### 怎么开

自动预算没有开关，每次启动都会执行；下面这些参数改变它的输入或绕开它。

- `--gpu-memory-utilization`（`gpu_memory_utilization`）：自动路径的显存比例。本部署按教程设为 0.85；上游默认值和三版是否一致，见[设备内存的版本差异](device-memory.md#版本差异)。
- `--kv-cache-memory`（`kv_cache_memory_bytes`）：直接指定每卡给 KV cache 的字节数。Worker 仍调用 `profile_run()`，日志写明 skipping memory profiling，然后原样返回这个值，不受 `gpu_memory_utilization` 约束。录图后的建议值只在没有指定它时打印。
- `num_gpu_blocks_override`：上游在切块前把每卡可用显存改写成「指定块数 × 每块字节」，日志为 `Overriding num_gpu_blocks=... with num_gpu_blocks_override=...`。
- `max_num_batched_tokens`：决定试跑的 token 数，也就是 model runner 的 `max_num_tokens`；本部署为 8192。
- `enforce_eager`：为真时跳过录图，日志里的 NPU 图内存为 0。

### 会报什么错

- `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (0.85, z GiB)`：启动快照的空闲量小于预算。先查同卡是否还有别的进程，再决定要不要降低比例。
- `Error in memory profiling. Initial free memory ... current free memory ...`：试跑结束时的空闲量不小于启动时，通常是同卡其他进程在试跑期间释放了显存。昇腾版用严格大于判断，上游用大于等于。
- `No available memory for the cache blocks.`：预算减完三项后不大于零。
- `To serve at least one request with the model's max seq len (...) ... larger than the available KV cache memory`：可用显存装不下一条最大长度的请求，报错会附上按可用显存估出的最大长度。
- 录图或第一条请求时显存不足，没有这条量测路径专门的报错文字，表现为设备侧的分配失败。待核：缺这套部署的实机日志。

### 开销和什么时候别开

- 自动路径和显式路径都会做那次试跑（GLM 为了量到 MC2 路径，还多跑一次 128 个 token），显式路径省掉的只是扣减计算。选显式预算是为了块数稳定，不是为了启动更快。
- 显式 KV 预算适合同一环境反复重启、希望块数稳定的场景，取值可以直接用录图后日志给的建议值。同卡还有别的进程、空闲量会变时别用它；换了量化方案、并行布局、批次上限或图模式之后，也要重新走一遍自动路径，旧的建议值不再成立。
- 调比例之前先读那行日志的四项用量，确认预算外还装得下图和后来创建的缓冲，不要只看空闲量。

### 版本差异

固定部署的 `db701c1f` 与 v0.23 分支的扣减函数和试跑函数逐行相同，录图仍在切完 KV 之后。三版的差别集中在相减之后的修正上，而且都只在对应特性开启或布局需要时生效：

| 核对项 | v0.23 | v0.26 | main | 对使用者意味着什么 |
|---|---|---|---|---|
| 预算 = 总显存 × 比例，扣权重、激活峰值、非 torch 增量 | 有 | 有 | 有 | 三版公式一致 |
| 激活峰值在录图前读取；切完 KV 才录图 | 有 | 有 | 有 | 三版的图内存都从预算外支付 |
| 先按 MC2 门槛加跑一次 | 有 | 有，这次试跑关闭编译；开了稀疏 KV 卸载时先分配 top-k 缓冲 | 同 v0.26 | 本部署没开卸载，加跑逻辑三版相同 |
| 相减之后的修正 | 无 | 层复用时按比例放大逻辑预算；稀疏 KV 卸载时再调整 | 先按多缓存组布局缩放；另有层复用、KV 卸载和 KVPP 的调整 | 不能把 main 的返回值当成固定镜像的行为 |
| 录图后打印建议值并多留 150 MiB | 有 | 有 | 有 | 三版一致 |

### 源码位置

- **快照与启动检查。** `NPUWorker._init_device` 先建 `MemorySnapshot`，按总量乘比例得到 `requested_memory`，空闲量不足就抛错；之后才调 `_init_worker_distributed_environment` 建通信组。[C2]
- **权重量测。** `NPUModelRunner.load_model` 包在 `DeviceMemoryProfiler` 里，前后之差记为 `model_memory_usage`；平台的 `get_current_memory_usage` 返回的是 `torch.npu.max_memory_allocated`。[C8][C7]
- **扣减公式。** `NPUWorker.determine_available_memory` 在 `memory_profiling` 区间里调 `profile_run()`，区间内读 `allocated_bytes.all.peak` 覆盖 `torch_peak_increase`，最后 `available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory`。[C3]
- **非 torch 的口径。** `MemorySnapshot.measure` 定义非 torch 占用为（总量 − 空闲）− `memory_reserved`；`memory_profiling` 进区间时重置峰值统计，出区间后 `non_torch_increase` 取试跑后与 `before_create` 之差。[C4][C5][C6]
- **试跑的内容。** Ascend 的 `profile_run` 先按 `mc2_tokens_capacity` 跑一次，再调上游 `profile_run`，按 `max_num_tokens` 做 `_dummy_run(is_profile=True)` 和一次采样试跑；试跑时 `force_eager` 为真，`_should_build_dummy_attn_metadata` 返回假，SFA 在 `attn_metadata is None` 时 `output.fill_(0)`。[C9][C10][C11][C12] GLM 的 KDA 层在模型文件里直接用上游的 `KimiGatedDeltaNetAttention`；上游和 Ascend 的 `_forward` 都在 `attn_metadata is None` 时直接返回，上游注释写明这是 V1 profile run，此时短卷积和 chunk 递归都不执行。[C23][C24]
- **引擎侧汇总。** `EngineCore._initialize_kv_caches` 收齐各 worker 的可用显存；`get_kv_cache_configs` 先处理显式块数、检查够不够一条最大长度，再取 `min_num_blocks` 并按比例收缩张量。[C13][C14][C15] DP 下各 EngineCore 之间没有再同步块数，客户端在 `core_client.py` 里把各引擎报来的 `num_gpu_blocks` 相加。
- **录图与建议值。** `compile_or_warm_up_model` 先 warmup，`enforce_eager` 为假时 `capture_model()`，再按四项和 150 MiB 余量打印建议。[C16] 上游 GPU Worker 的图内存预估只在 CUDA 且 `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS` 打开时才扣。[C17]
- **三版对照。** v0.23、v0.26、main 的 Worker 依次见 [C18][C19][C20]，范围覆盖扣减、修正、录图和 150 MiB 余量；v0.26 与 main 的加跑逻辑见 [C21][C22]。教程的 0.85 见 [S1]；本页用到的模型配置和固定提交，见 [GLM 来源基线](../sources/glm-5-3-flash-baseline.md)。
- **本页的推断与假设。** HCCL 缓冲落在非 torch 增量里，是由快照先于建组推出的 [D]；激活峰值覆盖两次试跑，是因为量测区间入口只重置一次峰值统计 [D]；稀疏 MLA 的注意力计算、KDA 的短卷积和递归计算以及索引器副本不在扣减项里，由试跑不建注意力元数据推出，这部分漏量只让峰值偏低、且不超过单层的量，由峰值取最高点、每层临时张量用完即释放推出，没有实测 [D]；预算外要装下快照前已被占的显存，由启动检查的条件推出 [D]。每卡 64 GiB、激活峰值加非 torch 增量 3.4 GiB 沿用双机页的教学假设 [A]。

**待核。**

- 这套部署的实机启动日志：`Free memory on device` 行（每卡 64 GiB 仍是假设），以及 `Actual usage` 行里的激活峰值、非 torch 增量和 NPU 图内存。拿到之前，3.4 GiB 仍是教学假设，本页也不给 GLM 的推荐比例。
- main 上多缓存组缩放对 GLM 的布局是否生效，未逐行跟到返回值。
- HCCL 单成员组是否真的各占一块缓冲，见 [HCCL buffer 页的待核](gap-a5164fe10fa9184412f8.md)。
