---
id: npu-worker-lifecycle
title: NPUWorker 启动：一张卡按什么顺序准备好接请求
type: feature
summary: 每张 NPU 上有一个 NPUWorker。启动时它先换补丁、选卡建通信组、装本卡那份权重、试跑量出 KV cache 预算；EngineCore 收齐各卡的数、按最紧的那张卡定块数并发回配置后，每张卡再建缓存池，最后预热并录 decode 图。每一步用到上一步的产物，所以顺序固定。预算怎么扣、块怎么借、系统怎么分层各有专页，本页只讲这条先后链。
aliases: [NPUWorker, WorkerBase, Worker 生命周期, worker 启动, 启动时序, Worker 启动顺序, init_device, load_model, initialize_from_config, compile_or_warm_up_model, 六步启动]
chapters: ["10"]
order: 110
sources:
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L90-L133
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L447-L503
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L521
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L668-L691
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L905
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L789
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L626-L634
  - vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L118-L126
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L64
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L136-L191
  - vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L893-L1027
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1545-L1551
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L162
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L706-L798
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L21
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_weight_utils.py#L36-L74
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L748-L778
  - vllm-ascend@2ed6cbba:vllm_ascend/model_executor/warmup/kernel_warmup.py#L36-L49
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L549-L620
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1129-L1138
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L300-L322
  - vllm@0fc695fc:vllm/config/parallel.py#L156-L162
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2018
verified: []
evidence: "C"
relations:
  - {to: engine-processes, kind: builds-on, note: Worker 在哪个进程里、每个 EngineCore 起几个 Worker，由执行器决定}
  - {to: kv-cache-memory-profiling, kind: builds-on, note: 第四步量预算时每一项怎么扣、为什么试跑两次，推导在那一页}
  - {to: kv-cache-spec, kind: builds-on, note: 第五步按缓存配置分配张量，每层每页的形状由规格决定}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 启动只建好池子，请求来了才从池里借块、用完归还}
  - {to: graph-mode-layer, kind: builds-on, note: 第六步录下的图，运行时怎样被选中和回放}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一张卡上的 Worker，启动时按什么顺序做准备？

**NPUWorker 是 vllm-ascend 里管一张 NPU 的执行角色：每张卡一个，启动时把这张卡准备好，之后替引擎执行每一步前向。它按固定顺序做六件事：换补丁、选卡并建通信组、装权重、量出能给 KV cache 的显存、按引擎发来的配置建缓存池、预热并录图。后一步要用前一步的产物，所以顺序不能换。**

几个词先说清楚。KV cache 是每条请求已经算过的历史状态，后面每一步前向都要接着读，见 [KV cache](kv-cache.md)。通信组约定哪几张卡一起做同一次集合通信，见[通信基础](collective-communication.md)。录图是把一次前向的算子序列预先录下来，之后按同样的尺寸照着回放，省掉逐个下发算子的开销。EngineCore 是负责调度、分配 KV 块的引擎进程，管着一组一起执行前向的卡；本部署两台机器各一个，各管本机的卡。

```wiki-diagram
file: worker-lifecycle
```

图里画三个 Worker，代表「每张卡一个」；有几张卡就有几个，各自走同一条路。横跨各列的汇总框是管这几张卡的那一个 EngineCore。每个 Worker 只有两处要等别人：

- **第②步，同组的 Worker 要到齐。** 通信组要所有成员都报到才建得成，一张卡没起来，别的卡就卡在这一步。
- **第④步之后，要等 EngineCore 汇总。** 每个 Worker 只报「我还能给 KV cache 多少显存」；EngineCore 收齐后按最紧的那张卡定块数，把同一份缓存配置发回，每张卡才开始第⑤步。

六步各自留下什么：

1. **换补丁。** 在本进程里把上游 vLLM 的一部分函数换成昇腾版，注册昇腾自己的算子（在 NPU 上真正执行的一小段计算），读入昇腾的配置。从这以后，本进程跑的都是换过的代码。补丁只对当前进程生效，所以每个 Worker 进程都要各换一遍，见[进程与补丁](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。
2. **选卡，建通信组。** Worker 绑定自己那张卡，先拍一张显存快照，记下这时还空着多少；再用 HCCL（昇腾的集合通信库，见 [CANN 与 HCCL](cann-hccl.md)）建通信组；最后建 [ModelRunner](npu-model-runner.md)，它负责组织每一步的输入、调用模型、管理 KV 张量。ModelRunner 要知道用哪张卡，所以只能在选卡之后建。
3. **装权重。** 从权重文件里读出本卡分到的那一份，拷进显存，再换成昇腾算子要的存储布局。权重从此常驻，整个服务期间不再变。
4. **量预算。** 用假数据按一步的上限试跑一次前向，量出临时张量最多占多少；再拿「总显存 × 显存比例」减去权重、这个峰值和不经 PyTorch 分配的占用，剩下的就是 KV cache 的预算。每一项怎么扣，见 [KV cache 显存预算](kv-cache-memory-profiling.md)。
5. **建缓存池。** 按 EngineCore 发回的缓存配置，把 KV cache 的张量一次分配出来。池里有多少块从这里起固定；哪条请求用哪几块，是请求来了之后才借的，见 [KV 块分配](vllm-kv-block-allocation.md)。
6. **预热，录图。** 先按预热列表里的尺寸各跑一次假前向，把第一次执行才做的准备提前做掉；再按固定的几个尺寸录下 decode 步的图，见[图执行](graph-mode-layer.md)。decode 是逐个生成新 token 的阶段，每一步每个请求只算很少几个新 token；与它相对的 prefill 是一次算完整段 prompt 的那一步。

Worker 是一个角色，它是不是单独占一个进程，由执行器决定；本部署用多进程执行器，每个 Worker 是一个独立进程，见 [executor 决定 Worker 是不是独立进程](engine-processes.md#executor-决定-worker-是不是独立进程)。六步走完以后，每一步的调度计划怎样从 EngineCore 发到各个 Worker、再交给 ModelRunner，见[请求调用链](request-call-chain.md)。

## 为什么要在接请求之前一次做完？代价在哪？

**KV 池的大小是启动时定下的常数，运行期不会变多。所以必须先量清楚还剩多少显存，再一次把池子分出来，最后才录图。** 在我们的双机部署里，每张卡的池子按算例切成 3,855 块，每个块号占 7.969 MiB，推导只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护。服务跑起来以后，请求只是从这 3,855 块里借和还。「跑着跑着放不下」通常不是显存突然不够，而是块借完了，要回到第④步查预算。

顺序是由依赖推出来的，下表每一行都是一种不能成立的换法：

| 想换的顺序 | 为什么不行 |
|---|---|
| 先建缓存池，再量预算 | 池子多大，就是第④步量出来的那个数；没有它，第⑤步不知道分多少 |
| 先建 ModelRunner，再选卡 | ModelRunner 一建就要绑定设备，得先知道是哪张卡 |
| 先装权重，再换补丁 | 装完权重后的后处理入口被补丁换过；补丁晚了，GLM 的 MLA 层（一种把每个历史位置压成一条短向量来存的注意力层）会漏掉自己的后处理，见下文第①步 |
| 先录图，再装权重或建缓存池 | 录图要真跑一遍 decode 前向：没权重算不了，没缓存池没处读写 KV；图占的显存还要落在预算之外，只能等 KV 切完再录 |

**代价是启动慢，而且慢在三处。** 装权重要把整份权重文件从存储读一遍，主模型和 MTP 草稿层（模型自带、先猜后面几个 token 的那一层）还各把文件过一遍；量预算要真跑前向，GLM 跑两次；预热和录图要按每个尺寸各跑一遍。这笔时间每次启动都要付，换来的是运行期不再分配 KV 显存、decode 步可以直接回放图。另外，量出来的预算只对这一套配置成立：批量上限、执行方式、并行布局、量化方案换了任何一项，都要重新走一遍。

**本页只管这条先后链。** 第④步每一项怎么扣、为什么试跑两次，在 [KV cache 显存预算](kv-cache-memory-profiling.md)；第⑤步分出的池子里块怎样借出、共享、归还，在 [KV 块分配](vllm-kv-block-allocation.md)；每层每页存什么形状，在 [KV cache 规格](kv-cache-spec.md)；整套系统哪些部件换成了昇腾版、Worker 处在哪一层，在 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md)；平台怎样指定用 NPUWorker 这个类，在 [NPUPlatform](npu-platform.md)。

## 放到 GLM 双机：一次启动，16 个 Worker 各走一遍

[官方双机部署](glm-5-3-flash-two-node.md#部署前提)是 2 台 Atlas 800 A2、每台 8 张卡：TP8 把同一个矩阵切给机内 8 张卡，DP2 把请求分给两台机器各自排队执行，EP16 把 MoE 层的 288 个专家分到全部 16 张卡（MoE 层里有很多个叫「专家」的小网络，每个 token 只交给其中少数几个计算，见 [MoE](moe.md)）；权重用 W8A8 量化，即权重和激活都用 8 位整数计算。机器 0 起 API server、DP 协调进程和一个 EngineCore，机器 1 用 headless 模式（不带 HTTP 前端、只跑引擎）只起一个 EngineCore；每个 EngineCore 派生 8 个 Worker 进程，一个 Worker 占一张卡，合计 16 个 Worker、20 个进程。进程怎么起，见[双机部署页的启动七步](glm-5-3-flash-two-node.md#启动时发生了什么)：本页的第①步发生在它的第二步、Worker 进程刚起来时，第②到⑥步依次对应它的第三到第七步。

下图把六步落到代码上：前三步是执行器建 Worker 进程时顺手调用的，后三步由 EngineCore 在初始化 KV cache 时统一下发。

```wiki-diagram
file: worker-lifecycle-flow
```

### ① 换补丁：GLM 的 MLA 层靠它接上权重后处理

**16 个 Worker 进程各在构造函数里换一遍补丁，其中一个补丁决定 GLM 的 MLA 层装完权重后有没有人给它做后处理。** MLA（Multi-head Latent Attention）是 GLM 在 12 个层上用的注意力（主干 11 层加 MTP 层）：它把每个历史位置压成一条短的潜向量存进 KV cache，用的时候再展开，见 [MLA](mla.md)；GLM 的这 12 层还只挑一部分历史来读，这部分见[稀疏注意力](sparse-attention.md)。GLM 实际推理用的 MLA 模块是 vllm-ascend 自己写的一个类，不是上游 vLLM 的 MLA 类。上游装完权重后会逐个模块做后处理，其中注意力这一轮只认上游自己的几个注意力类；本部署镜像里的补丁换掉了这个后处理入口，把 GLM 这个 MLA 类加进名单，它才会被转交给注意力后端做自己的后处理。补丁要是晚于装权重，这 12 层的后处理就会被跳过。各类补丁在哪个进程、什么时候生效，见 [Patch 机制](ascend-patch-system.md#两类-patch-各在什么时候哪个进程里生效)。

### ② 选卡、建通信组：先拍快照，再建三类组

**每个 Worker 按「DP 组号 × 8 + 本机序号」得到全局编号 0–15，先拍显存快照，再用 HCCL 建起 TP、DP、EP 三类通信组。** 机器 0 的卡是 0–7，机器 1 的卡是 8–15；这个编号叫 rank，是卡在通信组里的编号，和 token 的位置无关。TP 组是每台机器内的 8 张卡，DP 组是两台机器上序号相同的两张卡（0 和 8、1 和 9……），EP 组是全部 16 张卡，MoE 层的 dispatch（把 token 发到持有所选专家的卡）和 combine（把专家算完的结果收回原卡、加权相加）都在这个组里走，见 [expert parallel](expert-parallel.md)。这几组怎样分出来，推导在[双机部署页](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

快照拍在建组之前，所以 HCCL 为各通信组预留的缓冲会算进第④步的「非 torch 增量」，见[三项扣减](kv-cache-memory-profiling.md#三项扣减在-glm-里各是什么)。快照同时做一道启动检查：这张卡此刻的空闲显存，必须不少于「总显存 × 0.85」这份预算，否则当场报错退出。

两台机器的 EngineCore 之间还有一条 CPU 上的通信组，只用来同步两件事：还有没有请求没做完、要不要暂停。那条组由 EngineCore 建，不是 Worker 在这一步建的，见 [data parallel](data-parallel.md)。

### ③ 装权重：只拷本卡那一份

**每张卡最后常驻约 20.58 GiB 权重，但为了挑出这一份，每个 Worker 要把整份权重文件过两遍。** 默认加载路径分四段：

1. 按本卡分片的形状，在卡上把参数一次开好，这时还是空的。
2. 逐个打开权重文件，把每个张量交给它所在层的加载函数。TP 切的层只截出本卡那一段；路由专家只收本卡的 18 个（第 r 张卡收编号 18r 到 18r+17，比如 11 号卡收 198–215），其余丢掉。截好的那段从主机内存拷进卡上的参数。
3. 全部拷完后做一遍昇腾版的后处理：int8 权重先转置，再转成 NZ（昇腾矩阵单元使用的分块存储格式），缩放系数另存一份 FP32 副本；MLA 层转交给注意力后端处理。处理后卡上张量的样子和文件里不同，叫 processed layout。第①步说的那个补丁，换的就是这一段的入口。
4. 主模型这一遍不收 MTP 层；草稿模型再把文件过一遍，只收 MTP 层。

每卡为什么是 20.58 GiB、各部分是什么精度，见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。这一段前后的显存差会被记成「权重占用」，第④步直接拿来扣。教程命令打开了预取：每个 Worker 在后台先把自己那一份文件读进操作系统的页缓存，前台同时逐个读张量。

```calc
title: 一次启动从存储读多少（按权重形状还原的估算）
其余权重还原成整份 = 1,774.5 MiB × 8 + 727.5 MiB = 14,923.5 MiB ≈ 14.57 GiB
> 每卡除路由专家外的 2,502 MiB 里，727.5 MiB 每卡整份相同，1,774.5 MiB 按 TP8 切成 8 份，所以乘 8 再加回
整份权重文件（估算） = 290.25 GiB 路由专家 + 14.57 GiB 其余 ≈ 304.8 GiB
> 不含视觉塔和缩放系数；启动日志的 Checkpoint size 把全部 safetensors 文件大小相加，真值只会比这个数大
每个 Worker 后台预取 = 304.8 GiB ÷ 16 ≈ 19.05 GiB
> 预取按文件个数分给 16 个 Worker，这里假设各文件大小均匀
每个 Worker 前台过手 = 2 × 304.8 GiB（主模型一遍、草稿一遍） = 609.6 GiB
每张卡拷进显存 = 20.58 GiB
> 同一台机器的 8 个 Worker 共用页缓存；主机内存装得下整份文件时，每台机器实际从存储读约 305 GiB
```

路由专家 290.25 GiB 的结论见 [TP 页：哪些权重归 TP、哪些由 EP 分走](tensor-parallel.md#先区分哪些权重归-tp哪些已经由-ep-分走)，逐项推导在 TP 页的开销一节；727.5 MiB 与 1,774.5 MiB 这两份怎样分出来，见 [TP 页的三档比较](tensor-parallel.md#固定卡数比较-tp4tp8tp16只缩小可切部分)。所以 304.8 GiB 是按权重形状倒推的整份大小，不是量出来的文件大小；启动日志的 Checkpoint size 把目录里全部 safetensors 文件相加，本页没算的视觉塔和缩放系数都在里面，按同样的精度口径，日志里的数只会比它大。前台每个 Worker 过手约 610 GiB，是因为默认不按专家过滤：不在本卡的专家也要读出来再丢掉；专家过滤开关默认关着，见对照源码。另有一种热启动方式 RFork，从另一个已经跑着的实例的显存里借权重，借不到再回到上面这条路径；教程没有开它，见 [RFork 启动](rfork-startup.md)。

### ④ 量预算：各卡报数，EngineCore 定块数

**每个 Worker 先报出每层要存的状态规格，再试跑两次量出 KV 预算；EngineCore 按最紧的那张卡定块数，算例是每卡 30.00 GiB、3,855 块。** 规格要先报，是因为各层存的东西不一样：MLA 层按 token 存历史，KDA 层（GLM 的线性注意力层，见[线性注意力](linear-attention.md)）每条请求存一份固定大小的状态，不能都按普通的逐 token K/V 估算。规格决定了一个逻辑块装 640 个 token、全部层编成 5 个缓存组，见 [KV cache 规格](kv-cache-spec.md)。试跑先按 128 个 token 跑一次，量到 MoE 的 MC2 通信路径（MC2 是把专家计算和跨卡收发合在一起执行的昇腾实现，一步的 token 不超过 128 时才走它，见 [MoE 通信那一节](one-request.md#moe-通信走-mc2-还是-allgather)）；再按一步的上限 8192 个跑一次，见[试跑两次](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)。

教程把显存比例设为 0.85，没有指定显式 KV 预算，所以走自动扣减这条路。上面那组算例数依赖两条教学假设：每卡显存总量，以及「激活峰值加非 torch 占用」，两者都还没有实机日志；权重一项是逐项推出的。推导和适用条件只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护。每台机器的 EngineCore 收齐本机 8 个 Worker 报来的数，各自折成块数，再取最小值；两台机器之间不再对齐，见[各卡取最小](kv-cache-memory-profiling.md#切成块各卡取最小块数不等于并发数)。

### ⑤ 建缓存池：一次分配，运行时再借

**每个 Worker 收到同一份缓存配置，把 5 个缓存组的 KV 张量一次分配出来；到这一步，池里有了块，但还没有哪一块属于哪条请求。** 同一个块号的物理空间被不同组的层共享，所以占住一个块号就等于占住 [7.969 MiB](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。分配前还要准备 KV 传输，即把 KV cache 在不同实例之间收发的连接，prefill 和 decode 分开部署时才用得上；本部署没有配置 KV 传输，这一步没有要建的连接。

启动时还没有任何请求。以示例请求 R1 为例，它的 prompt 是 4 个 token（设定见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），它的块要等调度第一步才从池里借，请求结束再还回池里。借几块、哪一步借、什么时候还，见 [R1 从借块到还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)。

### ⑥ 预热、录图：图的显存从预算外出

**主模型按 7 个尺寸录 decode 图，对应 1 到 32 个请求；录图用的显存不在第④步的任何扣减项里，从预算外那 15% 支付。** 教程把图模式设为只录纯 decode 步，捕获 4、8、16、32、64、96、128 个 token。MTP 让每个请求一步算 1 个真 token 加 3 个草稿 token，所以这 7 个尺寸对应 1、2、4、8、16、24、32 个请求，见[启动第七步](glm-5-3-flash-two-node.md#启动时发生了什么)。命令里的另一处「不录图」开关写在草稿模型的配置里，只管草稿模型，主模型照样录图。

录图之前先按预热列表里的尺寸各跑一次假前向，本部署具体有几个尺寸要看启动日志。捕获尺寸不再重复预热；教程没有设编译尺寸，预热列表只剩为覆盖编译区间补上的端点。录图的显存为什么在预算外、预算外还要装什么，见[预算外的 15%](kv-cache-memory-profiling.md#预算外的-15图副本和启动前已被占的)。

录完图还有三件收尾：没有指定显式预算时，每张卡打一行日志，报出权重、激活峰值、非 torch 占用和图内存四项实际用量，并给出建议的显式预算；在 A2 这类卡上用一次小矩阵乘预热 ATB（昇腾的一套加速算子库），免得第一条请求写 KV 时变慢；CPU 绑核默认打开，这时把 Worker 进程绑到分给它的 CPU 核上，见 [CPU 绑核](cpu-binding.md#放到-glm-双机8-个-worker-各绑在哪里)。最后重置随机种子，这张卡就可以接请求了。

## 常见误解

- **「第②步只是选卡」。** 显存快照和 ModelRunner 都在这一步：快照拍在建通信组之前，ModelRunner 建在选卡之后，在那之前它根本不存在。
- **「KV cache 有多大，看启动参数就知道」。** 显存比例只定预算，实际字节数是第④步减出来的。手工指定显式预算时，试跑照样要跑，因为它顺带完成模型的首次编译；填一个很大的数也不会多出物理显存，第⑤步分配时照样放不下。
- **「每个 Worker 自己决定分多少块」。** Worker 只报可用字节；块数由 EngineCore 按本机最紧的那张卡统一定，所有卡按同一份配置分配。
- **「启动时已经给请求分好了块」。** 第⑤步只建池子。R1 用的块是调度第一步才借的，请求结束就还回池里，见上文第⑤步。
- **「录了图，之后每一步都回放图」。** 本部署只录纯 decode 步；带 prefill 的混合批走逐算子执行，两个 DP 组里有一组不能用图，两组这一步都退回逐算子执行，见[双机部署的后果](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)和 [ACL Graph](acl-graph.md)。一个请求一步也不止 1 个 token，MTP 下是 4 个。
- **「命令里写了不录图，主模型就不录」。** 那个开关只管草稿模型，见第⑥步。
- **「省显存的 sleep mode 只影响运行期」。** 第③步和第⑤步就按它分叉：开着时，权重和 KV cache 各进一个专用内存池，以后可以整池释放；一个进程里只能有一个这样的实例。本部署没开。
- **「源码里方法的排列顺序就是执行顺序」。** 量预算的方法写在装权重前面，执行时却在它后面。执行顺序看调用方，见下面的「源码位置」。

## 对照源码

### 怎么开

启动流程没有总开关，每次启动都会走完；下面按调用方和步骤列出入口，以及改变它的参数。

- **谁来调。** `NPUWorker` 继承上游 `WorkerBase`，平台通过 `worker_cls` 指定用它，见 [NPUPlatform](npu-platform.md)。执行器的 `WorkerProc` 构造时依次调 `init_device()` 和 `load_model()`[C10]；`EngineCore._initialize_kv_caches` 先广播 `get_kv_cache_spec` 与 `determine_available_memory`，自己用 `get_kv_cache_configs` 定块数，再调执行器的 `initialize_from_config`[C11]；执行器对每个 Worker 先广播 `initialize_from_config`，紧接着广播 `compile_or_warm_up_model`[C12]。
- **① 构造函数。** 先按 `COMPILE_CUSTOM_KERNELS` 决定要不要警告，然后 `adapt_patch()` 打 worker 层 patch，接着 `ops.register_dummy_fusion_op()`、非 A5 设备注册 ATB 扩展、`register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)`、配置日志、`check_ascend_device_type()`，最后才 `super().__init__()`[C2]。
- **② `init_device`。** `_init_device` 里依次 `torch.npu.set_device`、`empty_cache`、建 `MemorySnapshot`、算 `requested_memory = total_memory × gpu_memory_utilization`、空闲不足就抛错，然后 `_init_worker_distributed_environment`，最后设随机种子[C3]。建组用 `init_distributed_environment(..., "hccl")`，再 `ensure_model_parallel_initialized` 和 `init_ascend_model_parallel`（建 MC2 等昇腾自己的组）[C5]；全局 rank 的偏移在上游 `parallel_state` 里。回到 `init_device`，先初始化 workspace 管理器，再按 `use_v2_model_runner` 在 `NPUModelRunnerV2` 与 `NPUModelRunner` 之间选，源码注释写明理由：「Init ModelRunner here, so that we have access to self.device」[C4]。
- **③ `load_model`。** `enable_sleep_mode` 开着就用 `CaMemAllocator` 的 `tag="weights"` 池，否则 `nullcontext()`；配了 `weight_transfer_config` 再建权重传输引擎[C6]。`NPUModelRunner.load_model` 整段包在 `DeviceMemoryProfiler` 里，结束时把显存增量记为 `model_memory_usage`，然后加载草稿模型[C13]。加载器由 `--load-format` 决定：默认 `auto` 对应 `DefaultModelLoader`，从本地文件读；`rfork` 改为借别的实例的显存，见 [RFork 启动](rfork-startup.md)。读盘走 `safetensors_weights_iterator`，`prefetch` 策略另起后台线程预读[C16]。后处理入口被 `patch_process_weights_after_loading` 换成 `ascend_process_weights_after_loading`，镜像版把 `AscendIndexerKPoolMLAAttention` 加进 `_ASCEND_ATTENTION_POST_LOAD_TYPES`[C14]；这个类就是 GLM 实际推理用的 MLA 模块，它的 `process_weights_after_loading` 转给 `mla_cache_layer`，再转给后端 `impl`[C15]。
- **④ `determine_available_memory`。** `kv_cache_memory_bytes` 非空时走快路径：照跑 `profile_run()`（注释写明是为了编译模型），然后原样返回；否则在 `memory_profiling` 区间里跑 `profile_run()`，得到 `available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory`[C7]。
- **⑤ `initialize_from_config(kv_cache_config)`。** 先 `ensure_kv_transfer_initialized`，sleep mode 开着时进 `tag="kv_cache"` 池，然后 `model_runner.initialize_kv_cache(kv_cache_config)` 真正分配张量[C8]。
- **⑥ `compile_or_warm_up_model`。** warmup 列表取 `compile_sizes` 的副本；非 `enforce_eager` 且 `cudagraph_mode` 不为 NONE 时，剔掉 `cudagraph_capture_sizes` 里已有的尺寸，再为没被覆盖的编译区间补上端点；从大到小逐个 `_dummy_run`。非 `enforce_eager` 才 `capture_model()`；没指定显式预算时打印四项用量和建议值（多留 150 MiB）；非 A5 设备调 `_warm_up_atb()`；`enable_cpu_binding` 为真时 `bind_cpus`，失败只告警；最后 `set_random_seed`[C9]。`enable_cpu_binding` 在昇腾配置里默认为真，见 `ascend_config.py` 第 162 行。
- **本部署的参数。** 教程两机命令写了 `--gpu-memory-utilization 0.85`、`--compilation-config` 里的 `FULL_DECODE_ONLY` 和 7 个捕获尺寸、`--speculative-config` 里的 `"enforce_eager":true`、`--safetensors-load-strategy prefetch`；`--kv-cache-memory`、`--load-format`、sleep mode、KV 传输和 `additional-config` 都没有出现[S1]。`"enforce_eager":true` 写在草稿模型的配置里，只管草稿模型，主模型仍录 decode 图[I]。

### 会报什么错

启动期出错，先看挂在第几步，范围就圈定了一半：

| 挂在哪一步 | 先查什么 | 报错或日志 |
|---|---|---|
| ① 换补丁 | 固定版本、依赖、导入条件、实际注册的类 | `COMPILE_CUSTOM_KERNELS` 为假时先打警告：without custom kernels, vllm-ascend will not function correctly |
| ② 选卡、建组 | 设备可见性（`ASCEND_RT_VISIBLE_DEVICES`）、rank 与通信组配置 | `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (...)`：快照时空闲不足预算 |
| ③ 装权重 | 架构名、加载器、张量格式、本卡分片 | 开 sleep mode 时 `Sleep mode can only be used for one instance per process.` |
| ④ 量预算 | 显式还是自动路径、非缓存占用 | `Error in memory profiling. Initial free memory ... current free memory ...` |
| ⑤ 建缓存池 | 缓存规格、块数够不够一条最长请求 | EngineCore 侧的检查，报错原文见 [KV cache 显存预算](kv-cache-memory-profiling.md#会报什么错) |
| ⑥ 预热、录图 | 最后一个成功的尺寸、图模式 | 先开 `enforce_eager` 跳过录图，确认是不是图的问题 |

- 第④步那条断言要求试跑后的空闲量小于启动快照时的空闲量；空闲反而变多，说明同一容器里别的进程在试跑期间释放了显存，报错原文直接点名了这个原因。
- 第②步选 v2 runner 时会打警告（不是错）：`npu model runner v2 is in developing, some features doesn't work for now.`，看到它说明 `use_v2_model_runner` 生效了。
- 第③步读盘时打 `Checkpoint size: … GiB. Available RAM: … GiB.`，权重文件超过可用内存的 90% 只告警、不中止；装完打 `Loading model weights took … GB`，这就是第④步扣的权重占用。

### 开销和什么时候别开

- 启动时间主要花在第③步（整份权重文件过两遍）、第④步（GLM 两次试跑）和第⑥步（逐尺寸预热加录图）[D]。
- `enforce_eager` 为真时，跳过的只是尺寸剔除、补端点和 `capture_model()`；`compile_sizes` 里的预热、ATB 预热和绑核照做。代价是运行期每一步都逐个下发算子。它适合用来确认启动失败是不是出在录图，不适合长期开着跑。
- `--kv-cache-memory` 只省掉第④步的扣减，试跑照跑，省不掉编译那份时间；它适合同一环境反复重启、希望块数稳定的场景，取值直接用第⑥步日志给的建议值，细节见 [KV cache 显存预算](kv-cache-memory-profiling.md#开销和什么时候别开)。
- `enable_ep_weight_filter` 默认关[C27]。打开后每个 Worker 只读本卡的 18 个专家，前台过手的量会大幅下降；它在昇腾上能不能直接用，见页末缺口。
- sleep mode 一个进程只能有一个实例；本部署不需要整池释放显存，教程命令里没有开它[S1]。

### 版本差异

上游调用顺序（`WorkerProc` 构造、`EngineCore` 初始化 KV cache）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页 GLM 部分读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：GLM 的模型代码只在镜像里，2c59ff10 上没有；main 上 GLM 的代码在 `models/glm5next/` 下。** 镜像和 2c59ff10 的 `worker.py` 只差一个调试日志函数，六个方法逐字相同，行号从 `load_model` 起前移 13 行[D]。

| 项目 | v0.23 | v0.26 | main |
|---|---|---|---|
| 六个方法、调用方和先后 | 有 | 同 v0.23 | 同 v0.23 |
| 权重后处理补丁认哪些注意力类 | 只认 `DSAAttention`[C20]；镜像另加 GLM 的 `AscendIndexerKPoolMLAAttention` | 只认 `DSAAttention` | 补丁已退役；GLM 改用上游的 `MultiHeadLatentAttentionWrapper`，上游后处理本来就认它[C26] |
| `patch_weight_utils`（改 DeepSeek 权重里 kv scale 的名字映射） | 有[C21] | 已删 | 已删 |
| 第⑥步预热与录图之间 | 直接 `capture_model()` | 插一次 `kernel_warmup`，预热拒绝采样、惩罚项、RMS 三类 Triton 算子，`enforce_eager` 拦不住[C22] | 同 v0.26 |
| 第④步相减之后的修正 | 无 | 见[显存预算页的版本差异](kv-cache-memory-profiling.md#版本差异) | 开头多调 `maybe_apply_startup_plan`；相减后按多缓存组布局缩放，另有几项可选特性的调整[C24] |
| 第⑤步 sleep mode 的 `kv_cache` 池包住什么 | 整个 `initialize_kv_cache` | 同 v0.23 | 只包缓存本体的分配，持久元数据留在池外[C25] |

照 v0.23 的印象去 v0.26 或 main 上找 `patch_weight_utils` 会扑空；在 v0.26 上排查第⑥步变慢，还要多认 Triton 预热这一段。

### 源码位置

六个方法都在 `vllm_ascend/worker/worker.py`。文件里的排列顺序不是执行顺序：第④步的方法排在第③步前面，第⑥步排在第⑤步前面[D]。

| 步骤 | 方法 | 镜像 db701c1f | v0.23 | v0.26 | main |
|---|---|---|---|---|---|
| ① 换补丁 | `__init__` | 90 | 90 | 99 | 118 |
| ② 选卡、建组 | `init_device`（`_init_device`） | 505（395） | 505（395） | 489（385） | 483（379） |
| ③ 装权重 | `load_model` | 668 | 681 | 723 | 824 |
| ④ 量预算 | `determine_available_memory` | 527 | 527 | 511 | 549 |
| ⑤ 建缓存池 | `initialize_from_config` | 894 | 907 | 1001 | 1129 |
| ⑥ 预热、录图 | `compile_or_warm_up_model` | 693 | 706 | 748 | 849 |

- 建组的 `_init_worker_distributed_environment` 在镜像第 975 行；上游调用方是执行器的 `WorkerProc` 与 `EngineCore._initialize_kv_caches`，见「怎么开」第一条；Runner 的加载与权重计量在 `model_runner_v1.py` 的 `load_model` 里；GLM 在镜像 `models/glm5_next.py` 第 2018 行实例化 `AscendIndexerKPoolMLAAttention`，这是「GLM 实际推理用这个 MLA 类」的直接出处。
- worker 层 patch 的清单在 `vllm_ascend/patch/worker/__init__.py`，各版本各一份。
- 本页的推断：第⑤步在本部署没有要建的 KV 传输连接，是由教程没配 KV 传输推出的[I]；每台机器实际从存储读约 305 GiB，前提是主机内存装得下整份权重文件[I]。读盘 calc 里的 304.8 GiB 按主线底稿 01 §A0.7 的办法从每卡权重倒推，不含视觉塔和缩放系数，真值看启动日志的 `Checkpoint size` 行。

**缺口。**

- 这套部署的实机启动日志：`Compile and warming up model for size` 各行（预热列表到底补了哪几个尺寸）、`Checkpoint size` 与 `Available RAM`、`Loading weights took`，以及第⑥步那行四项用量。各步耗时、每卡 64 GiB 和 3.4 GiB 的假设都要靠它定下来。
- 打开 `enable_ep_weight_filter` 在昇腾上能否直接用，没有实测；昇腾侧只在 EPLB 打开时把它换成空函数。
- GLM 的 MLA 层交给注意力后端之后，具体生成哪些运行期张量，本页没有展开。
- main 上 GLM 的 MLA 包装层怎样走上游后处理，只核到类名，没有逐行跟到返回。
