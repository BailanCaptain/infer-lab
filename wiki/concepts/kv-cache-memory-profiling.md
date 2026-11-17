---
id: kv-cache-memory-profiling
title: KV cache 显存预算：启动时怎样一项项扣出来
type: concept
summary: >-
  启动时先按总显存乘显存比例定预算，再用一次最大批量的 profile run 量出激活峰值和非 torch 增量，连同权重一起扣掉，剩下的切成 KV
  块；录图等后来才出现的占用从预算外支付，预算也不能直接换成固定并发数。
aliases:
  - KV Cache Memory Profiling
  - memory profiling
  - 显存探测
  - 显存量测
  - 显存预算
  - 显存容量
  - 缓存预算
  - gpu_memory_utilization
  - gpu-memory-utilization
  - '--gpu-memory-utilization'
  - kv_cache_memory_bytes
  - '--kv-cache-memory'
  - kv-cache-memory-bytes
  - '--kv-cache-memory-bytes'
  - num_gpu_blocks_override
  - num-gpu-blocks-override
  - KV 显式字节预算
  - KV 块数覆盖
  - profile_run
  - profile run
  - determine_available_memory
  - non_torch_increase
  - 非 torch 增量
chapters:
  - '11'
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L464-L497'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm@0fc695fc:vllm/utils/mem_utils.py#L96-L126'
  - 'vllm@0fc695fc:vllm/utils/mem_utils.py#L191-L256'
  - 'vllm@0fc695fc:vllm/utils/mem_utils.py#L263-L268'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L865-L867'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3729-L3794'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3683-L3696'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6227-L6241'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3460'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1660-L1666'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L244-L263'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L713-L750'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2024-L2085'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L717-L758'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L416-L460'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L742'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L575-L788'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L616-L889'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3714-L3730'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4254-L4270'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L282-L284
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L487-L489'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2080-L2081'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L722-L726'
  - >-
    raw:sha256-33dba601f999712c1a51ec9bd5b263c1cb45ff47b831f0e31ecff03e8120e6e3.md#L1-L1457
  - 'https://github.com/vllm-project/vllm/issues/56830'
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/worker.py#L563-L577
  - 'vllm@0fc695fc:vllm/config/cache.py#L67-L88'
  - 'vllm@0fc695fc:vllm/config/cache.py#L159-L167'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1116-L1132'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L27-L88'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L920-L949'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2013-L2057'
  - 'vllm@568afb3a:vllm/config/cache.py#L68-L89'
  - 'vllm@568afb3a:vllm/config/cache.py#L171-L179'
  - 'vllm@84030bbe:vllm/config/cache.py#L112-L135'
  - 'vllm@84030bbe:vllm/config/cache.py#L239-L247'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L459-L548
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_utils.py#L2615-L2640'
  - 'vllm@568afb3a:vllm/v1/core/kv_cache_utils.py#L2107-L2137'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L972-L985'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L568-L656'
  - 'vllm@0fc695fc:vllm/utils/mem_utils.py#L48-L67'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L809-L817'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L574'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L504-L615'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L787-L819'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L888-L920'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L658-L743'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L890-L933'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L4336-L4352'
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L126'
  - 'vllm@ced6857a:vllm/config/cache.py#L228-L235'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2693-L2742'
  - 'vllm@0fc695fc:docs/configuration/conserving_memory.md#L1-L185'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L97-L101'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L177-L184'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1751-L1760'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L352-L372'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L448-L451'
  - 'vllm@84030bbe:vllm/config/cache.py#L89-L99'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L233-L268'
  - 'vllm@568afb3a:docs/configuration/conserving_memory.md#L78-L185'
  - 'vllm@ced6857a:docs/configuration/conserving_memory.md#L78-L185'
  - 'vllm@84030bbe:docs/configuration/conserving_memory.md#L78-L185'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
  - main
evidence: C
relations:
  - to: device-memory
    kind: builds-on
    note: 先分清权重、临时张量和 KV cache 在设备内存里各放什么
  - to: kv-cache-spec
    kind: builds-on
    note: 可用 KV 显存要按每块字节数切块，块规格在那页
  - to: hccl-buffer
    kind: builds-on
    note: HCCL 缓冲属于非 torch 增量，各组留多大、折合多少块在那页
  - to: acl-graph
    kind: builds-on
    note: decode 图在切完 KV 之后才录，图内存从预算外支付
contradicts: []
updated: '2026-11-10'
origin: gap
rawSources:
  - >-
    raw/sha256-33dba601f999712c1a51ec9bd5b263c1cb45ff47b831f0e31ecff03e8120e6e3.md
  - >-
    raw/sha256-56af680207818f343bdc2d4b2dd36d4c1663bd196134b8a93711cb7d6ec2217f.md
  - >-
    raw/sha256-a1026f7df3575e077953d95909c1d1d1639fcad49299256f5fcb3069614b9e26.md
---

## 启动时怎样知道还能给 KV cache 多少显存？

**memory profiling（显存量测）是 vLLM 启动时做的一次显存记账：先按「总显存 × 显存比例」定下预算，再用假数据试跑一次最大批量，量出权重之外还要占多少，预算里剩下的全部交给 KV cache。** KV cache 是每条请求已经算过的历史状态，下一步前向要接着读；它分到多少显存，决定了能同时留住多少请求、多长的上下文，见 [KV cache](kv-cache.md)。

这一步在接请求之前的[引擎启动阶段](glm-5-3-flash-two-node.md#启动时发生了什么)发生。代价是多做一次试跑，而且假输入只能测到所走路径的开销；后面录图和真实请求新增的占用，还需要留出余量。

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

**权重、临时张量和 KV cache 的生命周期不同。** 权重的参数容量可以先估算，实际加载占用仍由量测确认。激活和算子工作区随这一步的token数、算子实现和执行模式变化，一步结束后可释放的空间也取决于缓冲复用。KV cache却要跨很多步保留，直到请求结束或被回收。所以不能把“空闲显存”全部分给KV cache：启动时按配置的批次上限试跑，先为这条路径量到的非KV开销留出空间。

**非 KV 开销的估计会影响能切多少 KV 块。** 非 torch 增量估少了可能让 KV 预算偏大，运行到峰值时显存不足；估多了则降低容量。配置中的缓冲大小也不能直接当成实际损失，还要核对收发方向、复用方式和分配时点。

代价落在三处：

- **启动时多一次前向。** 要按最大批量真跑一次；这次试跑同时兼做模型的首次编译，所以指定显式预算也省不掉它。部分通信路径还需要额外试跑。
- **只对这一套配置成立。** 量到的是当前批次上限、执行模式、并行布局和量化方案下的用量；换掉其中任何一项，权重和运行开销都会变，要重新量。
- **量不到后来才出现的占用。** 试跑时还没录图，有些缓冲要到第一次真实前向才创建。它们不在扣减项里，只能由预算外那一段来装；那一段留少了，就会在录图或第一条请求时显存不足。若试跑期间同卡其他进程分配或释放了内存，量测读数也会受到干扰，下面单独看这笔账。

下面三个量名字相近，读日志时最容易混：

| 量 | 怎么算 | 给谁用 |
|---|---|---|
| 预算 | 总显存 × 显存比例 | 权重、激活峰值、非 torch 增量和 KV cache 共用 |
| 可用 KV 显存 | 预算 − 权重 − 激活峰值 − 非 torch 增量 | 只给 KV cache，一次性切成块 |
| 预算外 | 总显存 − 预算 | 快照前已被占的、decode 图、后来才创建的缓冲 |

## 空闲显存变多，为什么量测反而失败

**整张卡少用了多少，与本进程用了多少，是两笔不同的账。** 若实现用整卡空闲量的前后差估算本实例的增量，就需要测量期间其他进程的占用保持稳定。容器隔开了进程环境，却不一定隔开物理 GPU；显存比例规定本实例的预算，也不阻止别人分配或释放。

看一个简化示意：开始时整卡空闲 80 GiB；本进程新占 2 GiB，同时另一个进程释放 10 GiB。只考虑这两项变化：

```calc
title: 整卡读数掩盖了本进程的增加（示意）
结束时整卡空闲 = 80 − 2 + 10 = 88 GiB
按整卡差分得到的占用增量 = 80 − 88 = −8 GiB
```

若只看整卡读数，就得到“占用减少 8 GiB”，掩盖了本进程实际增加的 2 GiB。检查“测量后空闲量不能高于初始值”的实现会在这里停止，因为这次差分已经不能可靠归因给本实例。

这类**量测断言失败**表示记账前提不成立；**OOM** 则表示某次内存分配无法满足，两者需要不同的处理。先按[启动排障](inference-troubleshooting.md#启动依赖与加载还没到接请求这一步)确定失败在加载、试跑、缓存分配还是录图，再把同一时间段的整卡空闲量、本进程实际使用/分配器保留量与峰值、同卡其他进程的分配释放时刻放在一起。分配器保留量包含留待复用的内存；只看当前张量大小会漏掉这部分。

最小对照是在相同配置下，让其他进程先完成分配并一直持有，再只改变它是否在量测窗口内释放；同时保留无共用进程的对照。只有释放组重复失败、稳定组成功，且记录对上这个窗口，才支持“量测受干扰”的判断。让启动窗口内占用稳定，是这一分支可验证的处理；删掉断言或扩大 KV 预算并没有恢复可信的记账。若量测已通过、后来录图才 OOM，就回到上一节检查后续峰值，不能继续用“别人释放了显存”解释。

## 多模态输入的量测尺寸，等于运行时限制吗？

**给试跑的尺寸提示，只改变假输入怎样造。** 多模态模型除文字外还会处理图片、视频或音频；图片宽高、视频帧数、音频长度会改变编码阶段的中间张量，所以只知道文字token上限还不足以描述这笔开销。

固定上游指南给出一种配置：每条请求最多5张图片，试跑按每张512×512构造；最多1段视频，试跑按32帧、每帧640×640构造。“最多几项”是输入数量限制，“按多大尺寸量测”是另一件事。把试跑图片尺寸设成512×512，不会自动把真实图片缩成这个大小，也不会把运行时的encoder cache（保存编码结果供语言模型使用的缓存）封顶到这个尺寸。

因此，业务允许更大媒体时，要在目标输入下核实际峰值；希望减少真实媒体数据量，则要使用该模型的预处理设置，例如限制像素数，而不是只缩小试跑提示。设备显存不足与CPU内存不足也要分开：多模态预处理缓存放在主机内存，调小设备KV预算不会直接缩小它。相关配置入口及官方范围在页末。

## 放到 GLM 双机：一张卡的预算怎样扣

[官方双机部署](glm-5-3-flash-two-node.md#部署前提)是 2 台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16，权重用 W8A8 量化；显存比例按教程设为 0.85。量测发生在[启动的第五步](glm-5-3-flash-two-node.md#启动时发生了什么)，这时还没有任何请求。16 张卡各有一个 worker（管一张卡、真正执行前向的进程），各自做一遍上面四步，再把结果交给本机的 EngineCore（每台机器一个的引擎进程，负责调度和分配 KV 块）。

下图展开预算选择分支，以及它前后的启动顺序。

```wiki-diagram
file: kv-cache-memory-profiling-flow
```

快照在建通信组之前拍，所以建组时 HCCL 占上的缓冲会算进非 torch 增量；权重在建组之后加载，单独记账。指定了显式 KV 预算时，试跑照样执行，但不再做扣减。最右一列是 EngineCore 收齐各卡结果之后的事：定块数、分配 KV 池，最后才录图。

### 试跑两次：先按 128 个 token，再按 8192 个

**GLM 的试跑分两次，为的是把 MoE 的两条通信路径都量到。** 一步最多处理 8192 个 token，这是[调度的 token 预算](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)，试跑按这个数喂假输入。可是 MoE 层在 token 数不超过 128 时走 MC2（专家计算和跨卡收发协同执行的昇腾实现），超过就换成 AllGather 路径（先用 [All-Gather](collective-communication.md#all-gather) 把各卡的 token 收齐，再各算本卡的专家），门槛见[MoE 通信那一节](one-request.md#moe-通信走-mc2-还是-allgather)。只跑 8192 个 token，量到的只是 AllGather 路径。所以一步上限超过 128、且 128 个 token 时选的是 MC2，vllm-ascend 就先按 128 个 token 跑一次 MC2 路径，再跑上游那次 8192 个 token 的试跑。两次都在同一个量测区间里，激活峰值取两次合起来的分配最高点，再减去试跑前的占用。

**试跑不建注意力元数据，GLM 两种注意力层的核心计算都没有真跑。** 试跑按 eager 方式执行（逐个下发算子，不用图），也不准备注意力要用的块表等元数据。GLM 的 45 层里有两种注意力：11 层是稀疏 MLA（MLA 把历史压成小向量存进 KV cache，稀疏是指每个查询只挑一部分历史 token 来读，见[稀疏注意力](sparse-attention.md)），34 层是 KDA（Kimi Delta Attention，一种线性注意力，把整段历史压进每个头一个固定大小的矩阵状态，见[线性注意力](linear-attention.md)）。两种层见到元数据为空，都提前返回：

- **稀疏 MLA 层**把输出填零返回，里面的索引器（给历史位置打分、挑出这一步要读哪些 token 的小网络）根本没有运行。
- **KDA 层**照常算 q、k、v、β 和门控这些投影，但在短卷积和递归计算之前就返回，输出保持全零；后面的归一化和输出投影拿着全零照常跑。

这带来两个后果：量到的激活峰值不含稀疏 MLA 的注意力计算，也不含 KDA 的短卷积和递归计算；索引器第一次运行时才转出的两份 FP32 副本（每卡约 54 MiB，见 [TP 页](tensor-parallel.md#加载权重之外每卡还会创建同样大的运行时副本)）也不在扣减项里，要到录图或第一条真实请求时才出现。

**若真实执行在被跳过的分支新增占用，试跑就会漏掉它；试跑峰值不是任意负载的上下界。** 试跑测的是固定形状和执行路径；真实请求的批量、prefill/decode 组合及张量生命周期随负载而变。各层顺序执行，不代表所有临时缓冲都立即释放：还要考虑持久运行时副本、分配器保留和异步工作。因此不能把漏量一律乘 34，也不能证明它最多只差一层。要确定安全余量，需在目标负载下量实际峰值；本页没有这项实测。

**状态容量和试跑开销要分别记账。** KDA的递归状态本身放在KV cache里，每条请求固定占12个块号（见下文）；试跑跳过递归，不会让这部分状态消失。下面算例里的激活峰值与非torch增量合计3.4GiB是教学假设，30.00GiB和3,855块随这组假设而来。试跑漏掉的执行开销则需要由[预算外](#预算外的-15图副本和启动前已被占的)的余量承担，是否足够要靠真实负载量测。

### 三项扣减在 GLM 里各是什么

| 扣减项 | GLM 双机的每张卡上 | 数值 |
|---|---|---|
| 权重 | 完整加载占用须含语言模型、视觉塔、MTP（模型自带、先猜后面几个 token 的草稿层）及辅助张量 | 算例另假设为 21 GiB；[21,078 MiB](glm-5-3-flash-two-node.md#每张卡上放了什么) ≈ 20.58 GiB 仅是所列语言模块子账 |
| 激活峰值 | 两次试跑中 PyTorch 分配的最高点减去试跑前占用 | 未实测 |
| 非 torch 增量 | HCCL 各通信组的缓冲等；建组在快照之后，所以落进这一项 | 跨卡四组按配置合计 650 M；和激活峰值合计按 3.4 GiB 假设 |

MTP 层的权重和 KV 都和主干一起记账。主要语言权重已有逐项子账，完整加载占用与另外两项仍要读实机日志；算例按双机页的教学假设取值。

双机部署的一个块号占 [7.969 MiB](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。上表 HCCL 四个跨卡逻辑组字段之和为 650 M，单位折算约 82 块，但不能当成实际损失：收发方向、组复用和分配时点还会改变实占，见[配置值怎样折算成容量参考](hccl-buffer.md#配置值怎样折算成容量参考)。

**按这组数，预算是 54.40 GiB，扣完剩 30.00 GiB，切成 3,855 块。** 这个算例假设每卡 64 GiB 显存、权重为 21 GiB、激活峰值加非 torch 增量为 3.4 GiB；只代入所列语言权重子账则是 3,908 块，尚未扣视觉塔等表外项，不能当成精确容量。完整推导、每块 8,355,840 B（每 token 13,056 B）的来历，以及两种块数各在什么时候用，都只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护，本页不重算。权重各部分为什么常驻、怎样搬进显存，见[设备内存](device-memory.md#启动预算显存里还要容纳权重之外的东西)。

### 切成块：各卡取最小，块数不等于并发数

**EngineCore 收齐本机 8 个 worker 报来的可用 KV 显存，按每块字节各自除、向下取整，再取其中最小的块数，所有卡都按它分配。** 除法和取最小都在 EngineCore 里做，worker 只负责报数。各卡的激活峰值和非 torch 增量不一定完全相同，取最小才保证每张卡都放得下；多算出的张量空间按比例收回，不白占。两台机器各有一个 EngineCore，各自取最小，彼此不再对齐；接收请求的 API 服务进程汇总时把两台的块数相加，所以它报出的总块数不是单台机器的块数。切块之前，各卡的可用显存还要过两道检查：可用显存不大于零，直接报错；连一条最大长度的请求都装不下，也报错。一个块号为什么同时占着各缓存组的空间、每块多大，见 [KV cache 规格](kv-cache-spec.md)。

**块数不等于能同时服务的请求数。** GLM 的缓存同时有 34 层 KDA 的递归状态和稀疏注意力的历史：KDA 状态每条请求固定占 12 个块号，一条只有 7 个 token 的新请求也要占 15 块，见[为什么短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)。所以同样的块数能放几条请求，要按每条请求的长度和各缓存组的状态逐条算；前缀共享、回收等机制还会改变这笔账。

### 预算外的 15%：图、副本和启动前已被占的

**0.85 意味着每卡有 15% 不进预算，按 64 GiB 的假设是 9.6 GiB**，见[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。它不是多出来的 KV cache，而是后来那些占用的去处：

- **启动快照前已被占的显存。** 启动检查要求当时的空闲量不少于预算，等于要求这部分不超过 15%。
- **decode 图。** 切完 KV 之后才按 7 个尺寸录图（见[启动第七步](glm-5-3-flash-two-node.md#启动时发生了什么)），录图用的显存不在任何扣减项里。
- **索引器的 FP32 副本。** 每卡约 54 MiB，第一次真实前向或录图时才创建。
- **试跑时没真正执行的计算。** 稀疏 MLA 的注意力，以及 KDA 的短卷积和递归计算，它们的真实执行分支可能新增临时占用；实际峰值还取决于形状和缓冲生命周期，不能从层数给出统一上界。

**录完图，每张卡打一行日志，把四项实际用量和建议值一起报出来。** 这行日志只在没有指定显式 KV 预算时才打。四项是权重、激活峰值、非 torch 增量和 NPU 图内存。建议值是「预算 − 四项 − 150 MiB」，另给一个「启动时的空闲量 − 四项 − 150 MiB」，都可以直接填进显式 KV 预算参数。多留的 150 MiB 按源码注释的说法，是用来兜住量测对设备上下文、HCCL 缓冲、驱动层这类非 torch 占用的少量低估。**这行日志是本页核对激活峰值、非 torch 增量和图内存的汇总入口**；这套部署的日志目前还没有，缺口列在页末源码区。

## 常见误解

- **「0.85 就是给 KV cache 留 85%。」** 0.85 圈出的是整份预算，权重、激活峰值和非 torch 增量都从里面扣。GLM 算例的预算是 54.40 GiB，最后留给 KV cache 的是 30.00 GiB。
- **「预算外那 15% 空着，可以再多切点 KV。」** 这一段要装录图、索引器副本、启动前已被占的显存，以及试跑没量到的临时占用。只看空闲量就把比例调高，一旦这一段装不下，录图或第一条请求时就会显存不足。
- **「试跑量到的就是运行时的最高峰。」** 试跑不录图、不建注意力元数据，稀疏 MLA 直接返回，索引器也没有运行，KDA 只算投影、跳过短卷积和递归；它不能覆盖所有真实执行路径。试跑只量当前配置和假输入的用量，真实负载可能更高也可能更低；其他进程后来改变占用，同样会改变可用余量。
- **「非 torch 增量可以按张量大小算出来。」** 这一项本来就是不经 PyTorch 分配器的显存，比如 HCCL 缓冲、试跑中顺带分配的通信缓冲，只能用快照差去量，不能拿张量元素数代替。
- **「上游 GPU 代码会先估出图内存再扣，昇腾也一样。」** 上游 GPU Worker 确实有图内存预估，但只在 CUDA 上、且要显式打开环境变量才从预算里扣；昇腾的 NPUWorker 没有这一步，图内存全部从预算外支付。
- **「块数就是能同时服务的请求数。」** 一条请求占几块取决于长度，还要加上 KDA 状态的固定开销；短请求也要 15 块。
- **「指定了显式 KV 预算，就不试跑了。」** 试跑照样执行，用来完成模型的首次编译，只是不再做扣减，直接采用指定的字节数。启动时的空闲检查、设备的实际容量和运行峰值依旧存在，而且显式值不受显存比例约束。

## 对照源码

### 怎么开

自动预算没有开关，每次启动都会执行；下面这些参数改变它的输入或绕开它。

| CLI / Python 引擎字段 | 定义默认与合法输入 | 实际作用 |
|---|---|---|
| `--gpu-memory-utilization` / `gpu_memory_utilization` | 浮点数，默认 0.92；必须大于 0 且不大于 1 | 每卡、每实例的总显存预算比例，包含权重和运行开销；GLM 教程显式覆盖为 0.85 |
| `--kv-cache-memory-bytes` / `kv_cache_memory_bytes` | 整数或 None，默认 None；使用时给正字节数；此字段定义没有正数下限校验，零/负数的执行分支见下文 | 每卡 KV 池的字节预算，不是所有 TP 卡相加的总额；固定 NPUWorker 对非零值直接试跑并返回该数，跳过自动扣减 |
| `--num-gpu-blocks-override` / `num_gpu_blocks_override` | 整数或 None，默认 None；定义没有正数下限校验；0 不是“恢复自动”，应省略或传 None | 在引擎规划阶段用指定块数替换预算推得的块数，主要用于抢占测试；GLM 两档页有下述兼容限制 |

CLI 的正式完整名字是 kv-cache-memory-bytes，旧文与部分日志中的 kv-cache-memory 是简写；检索保留旧名，示例统一用完整名。离线 LLM 可直接传 gpu_memory_utilization、kv_cache_memory_bytes，num_gpu_blocks_override 经同名引擎关键字传入；这三项都不是 Chat/Completions 的请求字段。改值需要重新启动并规划缓存池，不会让在途请求动态获得更大的池。

**覆盖顺序是先 worker 报字节，再引擎定块数。** 没设显式字节时用本页四项记账；设正字节数时仍调用 profile_run 完成首次编译，日志写 skipping memory profiling，返回指定字节数。这使 KV 池的大小脱离显存比例的扣减结果，**启动空闲量检查仍按比例执行**。上游之后若看到块数覆盖非 None，会以「指定块数 × 每块字节」重写用于 auto-fit 和容量准入的有效预算，再构建缓存池；它不是与显式字节数取较小值，调大也不会创造物理显存。日志为 `Overriding num_gpu_blocks=... with num_gpu_blocks_override=...`。

固定 GLM 的两档页不能直接套这条覆盖路径：上游换算每块字节的 helper 对混合规格走等页大小断言，而专用 Ascend 的 GLM 分组包含大小不同的页，且没有替换这个 helper。因此这组固定源码下，给 num_gpu_blocks_override 会在该换算处触发一致性断言；不要把它加入 GLM 双机命令。上述顺序描述的是上游的一般机制，GLM 继续用比例或显式字节预算决定容量。

显式字节数的 CLI 支持单位：30g 是 30,000,000,000 B，30G 是 32,212,254,720 B（30 GiB），不是同一个数；25.6g 可以，30.5G 会因二进制后缀带小数被拒。Python 用整数，例如 kv_cache_memory_bytes=30 * 1024**3。这里的 30 GiB 只演示写法，不能代替本页待核的 GLM 实机预算。

下面两行是**分别选择的启动参数片段**，接到现有完整命令中；第一行保留 GLM 教程自动预算，第二行仅演示已取得日志、确认 30 GiB 可用时的显式预算。双机要同步修改两端相应参数，保留模型、并行和地址设置。

```bash
--gpu-memory-utilization 0.85
--gpu-memory-utilization 0.85 --kv-cache-memory-bytes 30G
```

**None、0 和负数不能混用。** 固定 NPUWorker 用真值判断显式字节预算：None 和 0 都走自动扣减，但录图后建议日志要求该字段 is None，所以 0 又会让建议日志不打印；负数为真，会被返回为负预算，再被“无可用缓存空间”检查拒绝。块数覆盖则按 is not None 判断，0 或负数会得到非正有效容量，正常有缓存组的路径随后失败；GLM 可能更早撞上上述页一致性断言。字段能被解析，不等于能成功初始化。

相关设置沿用原页主说明：

- `max_num_batched_tokens`：决定试跑的 token 数，也就是 model runner 的 `max_num_tokens`；本部署为 8192。
- `enforce_eager`：为真时跳过录图，日志里的 NPU 图内存为 0。
- 多模态量测使用`limit_mm_per_prompt`中的count与尺寸提示；例如图片配置`{"count":5,"width":512,"height":512}`。指南中的尺寸提示只影响激活量测，超过模型能力会被钳到有效最大值；实际encoder cache由运行输入决定。多模态预处理缓存的主机容量由`mm_processor_cache_gb`控制；CPU推理后端的`VLLM_CPU_KVCACHE_SPACE`属于另一条路径，不能当成Ascend设备KV预算参数。

### 会报什么错

- 显存比例 0、负数或大于 1：在配置校验阶段拒绝；1 本身合法，但没有比例预留的余量，是否装得下后续峰值仍取决于实际运行。
- GLM 配置块数覆盖：两档页经过上游 `get_uniform_page_size` 时要求 `len(page_sizes) == 1`，可能在任何缓存分配前就断言失败。取消覆盖、恢复 None；不能用调高覆盖块数绕过。
- `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (0.85, z GiB)`：启动快照的空闲量小于预算。先查同卡是否还有别的进程，再决定要不要降低比例。
- `Error in memory profiling. Initial free memory ... current free memory ...`：本页固定昇腾镜像 db701c1f 要求“初始空闲量 > 试跑后空闲量”，所以试跑后等于或高于初始值都会触发断言；上游固定版 0fc695fc 的 GPU 实现要求“初始空闲量 ≥ 试跑后空闲量”，只在试跑后高于初始值时触发这条断言。同卡其他进程在窗口内释放显存是待验证的候选，取证与对照见前文[空闲显存变多](#空闲显存变多为什么量测反而失败)，不能只凭报错确定原因。
- `No available memory for the cache blocks.`：预算减完三项后不大于零。
- `To serve at least one request with the model's max seq len (...) ... larger than the available KV cache memory`：可用显存装不下一条最大长度的请求，报错会附上按可用显存估出的最大长度。
- 录图或第一条请求时显存不足，没有这条量测路径专门的报错文字，表现为设备侧的分配失败。待核：缺这套部署的实机日志。

### 开销和什么时候别开

- 自动路径和显式路径都会做那次试跑（GLM 为了量到 MC2 路径，还多跑一次 128 个 token），显式路径省掉的只是扣减计算。选显式预算是为了块数稳定，不是为了启动更快。

- 显式 KV 预算适合同一环境反复重启、希望块数稳定的场景，取值可以直接用录图后日志给的建议值。同卡还有别的进程、空闲量会变时别用它；换了量化方案、并行布局、批次上限或图模式之后，也要重新走一遍自动路径，旧的建议值不再成立。
- 调比例之前先读那行日志的四项用量，确认预算外还装得下图和后来创建的缓冲，不要只看空闲量。
- 块数覆盖主要用于可控的抢占/容量测试；它覆盖的是整个 KV 池可用块数，不是一条请求的块配额。一般路径中把它设得高于实际预算会把失败推迟到设备分配阶段，GLM 当前钉点还存在前述布局兼容错误。

### 版本差异

**v0.30.0rc2 保留“预算减去非 KV 占用”的主公式，但返回值还要经过布局修正。** Worker 在录图前记录激活峰值，避免把 graph pool 重复计入激活；随后依次处理多组 KV 布局、逐层缓冲复用、稀疏 decode 卸载与 KVPP 预算。日志中的逻辑 KV 预算不一定等于一块可任意使用的物理显存。

显式设置 kv_cache_memory_bytes 时仍执行 profile_run 以完成必要编译，但跳过按 gpu_memory_utilization 计算预算，之后仍执行稀疏卸载与 KVPP 的约束。显式字节预算不会自动为所有附加特性消除 OOM；本页旧版本的比例默认值和 GLM 0.85 配方也不能替代 rc2 的最终生效配置。

固定部署的 `db701c1f` 与 v0.23 分支的扣减函数和试跑函数逐行相同，录图仍在切完 KV 之后。四版按[KV规格页的固定钉点](kv-cache-spec.md#版本差异)对照；差别主要在扣减之后的布局修正，须满足对应条件才生效：

| 核对项 | v0.23 | v0.26 | v0.30.0rc2 | main | 对使用者意味着什么 |
|---|---|---|---|---|---|
| 预算 = 总显存 × 比例，扣权重、激活峰值、非torch增量 | 有 | 有 | 有 | 有 | 自动路径主公式一致 |
| 激活峰值在录图前读取；切完KV才录图 | 有 | 有 | 有 | 有 | 此量测分支不先扣图内存 |
| 按MC2门槛加跑一次 | 满足选择条件时执行 | 同条件；加跑时关闭编译，稀疏卸载先分配top-k缓冲 | 同v0.26 | 同v0.26 | 加跑是否发生看模型、token上限和通信选择 |
| 自动扣减后的修正 | 无 | 层复用放大逻辑预算，稀疏卸载再调整 | 多组布局、层复用、稀疏卸载、KVPP依条件处理 | 同类顺序，多组豁免条件见下文 | 返回值未必等于设备物理字节 |
| 非零显式字节路径 | 试跑后直接返回 | 仍经过稀疏卸载调整 | 仍经过稀疏卸载和KVPP | 同rc2 | 不经过自动分支的多组及层复用缩放 |
| 录图后建议值与150MiB余量 | 有 | 有，另报保留/已分配量 | 同v0.26 | 同v0.26 | 150MiB是实现余量，不是任意负载的保证 |

前述多模态数量限制、试跑尺寸提示、真实预处理和运行encoder cache的区别，在四个固定上游钉点的指南中一致。具体模型是否支持某种提示，以及Ascend执行路径和峰值，仍须按实际模型与部署核对；共同的文档约定不等于四版设备实测。

这三个参数的定义默认在四版上游均相同：比例0.92且范围(0,1]，显式字节None，块数覆盖None；CLI完整拼写相同。Ascend固定GLM分支采用教程0.85，不能据此把默认改成0.85。四版上游均先处理块数覆盖再检查容量，但rc2/main的auto-fit和准入预算会先扣掉一个保留的null block（不分给普通请求的保留块），前两版没有这一处扣减。rc2若配置hisparse还会先统一各worker可用字节。因此参数定义一致，容量临界点的结果仍可能不同；GLM覆盖断言只指前述固定组合。

**main与rc2的多组修正也不是一律缩小。** 通用修正按“最大组每块页字节 ÷ 所有组页字节之和”缩放预算；DeepSeek V4/V4.1使用专门布局，提前返回原值。注意力加Mamba的模型若采用层与块均紧凑的布局、runner支持共享底层存储，而且不是普通稀疏/压缩路径，也可保留原值。main还检查当前KV connector能否使用共享底层存储；rc2这一判断不含该门槛，并将Step3.5/3.7纳入相应豁免。

GLM的kpool索引路径在main不会被标成上述“普通稀疏”路径。保持未配置connector、没有compress_ratios字段、使用支持共享底层存储的V1 runner，并解析到层与块紧凑布局时，它符合注意力加Mamba的提前返回条件，不触发这次通用缩放。实际布局在量测之前统一解析，应结合布局日志和最终各组规格确认；这项静态路径判断不改变旧镜像的640和3,855块算例。

### 源码位置

- **快照与启动检查。** `NPUWorker._init_device` 先建 `MemorySnapshot`，按总量乘比例得到 `requested_memory`，空闲量不足就抛错；之后才调 `_init_worker_distributed_environment` 建通信组。[C2]
- **权重量测。** `NPUModelRunner.load_model` 包在 `DeviceMemoryProfiler` 里，前后之差记为 `model_memory_usage`；平台的 `get_current_memory_usage` 返回的是 `torch.npu.max_memory_allocated`。[C8][C7]
- **扣减公式。** `NPUWorker.determine_available_memory` 在 `memory_profiling` 区间里调 `profile_run()`，区间内读 `allocated_bytes.all.peak` 覆盖 `torch_peak_increase`，最后 `available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory`。[C3]

上述来源 3 的固定 `db701c1f` 第 537–553 行还限定显式预算的入口：`kv_cache_memory_bytes` 必须为真值，因此 `0` 不进入该分支；进入后仍调用试跑，再直接返回设定值。这项说明只覆盖所核固定快照。

- **非 torch 的口径。** `MemorySnapshot.measure` 定义非 torch 占用为（总量 − 空闲）− `memory_reserved`；`memory_profiling` 进区间时重置峰值统计，出区间后 `non_torch_increase` 取试跑后与 `before_create` 之差。[C4][C5][C6]
- **试跑的内容。** Ascend 的 `profile_run` 先按 `mc2_tokens_capacity` 跑一次，再调上游 `profile_run`，按 `max_num_tokens` 做 `_dummy_run(is_profile=True)` 和一次采样试跑；试跑时 `force_eager` 为真，`_should_build_dummy_attn_metadata` 返回假，SFA 在 `attn_metadata is None` 时 `output.fill_(0)`。[C9][C10][C11][C12] GLM 的 KDA 层在模型文件里直接用上游的 `KimiGatedDeltaNetAttention`；上游和 Ascend 的 `_forward` 都在 `attn_metadata is None` 时直接返回，上游注释写明这是 V1 profile run，此时短卷积和 chunk 递归都不执行。[C23][C24]
- **引擎侧汇总。** `EngineCore._initialize_kv_caches` 收齐各 worker 的可用显存；`get_kv_cache_configs` 先处理显式块数、检查够不够一条最大长度，再取 `min_num_blocks` 并按比例收缩张量。[C13][C14][C15] DP 下各 EngineCore 之间没有再同步块数，客户端在 `core_client.py` 里把各引擎报来的 `num_gpu_blocks` 相加。
- **录图与建议值。** `compile_or_warm_up_model` 先 warmup，`enforce_eager` 为假时 `capture_model()`，再按四项和 150 MiB 余量打印建议。[C16] 上游 GPU Worker 的图内存预估只在 CUDA 且 `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS` 打开时才扣。[C17]


固定 GLM 镜像会保存图捕获之前的 PyTorch 峰值，再用这个值计算激活内存的峰值增量，避免把图池分配重复计为激活内存。激活是模型计算时产生的中间表示；图内存与激活内存分开统计，才能解释探测账单，但这段统计逻辑本身不提供设备的实际占用数。

上述来源 16 的固定 `db701c1f` 第 721–738 行给出建议值的输出条件：`kv_cache_memory_bytes is None`，并且对象具有 `peak_activation_memory` 记录；注释将这项记录与完整 profiling 联系起来。因此，配置为 `0` 虽不走显式预算分支，也不满足这里的 `None` 条件。注释把 150 MiB 余量解释为补偿 ACL 上下文、HCCL 缓冲和驱动层等非 torch 分配可能被低估的占用；这是所核实现的设计理由，尚无设备实测能把它变成安全保证，也不据此认证其他分支的输出条件。

- **三版对照。** v0.23、v0.26、main 的 Worker 依次见 [C18][C19][C20]，范围覆盖扣减、修正、录图和 150 MiB 余量；v0.26 与 main 的加跑逻辑见 [C21][C22]。教程的 0.85 见 [S1]；本页用到的模型配置和固定提交，见 [GLM 来源基线](../sources/glm-5-3-flash-baseline.md)。
- **整卡读数受共用进程影响。** 来源 28 的 [issue #56830](https://github.com/vllm-project/vllm/issues/56830) 报告 H100 NVL、官方 v0.29.0 在另一容器释放显存时触发量测断言，保持占用的对照成功；这是社区复现记录。它支持区分整卡差分与进程占用，不把本页 Ascend 三版公式认证为所有 GPU 版本的实现。80/2/10/88 GiB 是教学假设及算术推导；取证与对照步骤是本站工程分析。具体报错条件、记账方式和修复归属仍要按现场安装版本核对。
- **本页的推断与假设。** HCCL 缓冲落在非 torch 增量里，是由快照先于建组推出的 [D]；激活峰值覆盖两次试跑，是因为量测区间入口只重置一次峰值统计 [D]；稀疏 MLA 的注意力计算、KDA 的短卷积和递归计算被跳过，由试跑不建注意力元数据及相应早退分支推出。真实峰值还取决于输入形状、持久副本与缓冲生命周期，不能由这些早退分支推出“只会偏低”或“不超过一层”的统一界限 [D]；预算外要装下快照前已被占的显存，由启动检查的条件推出 [D]。每卡 64 GiB、激活峰值加非 torch 增量 3.4 GiB 沿用双机页的教学假设 [A]。

**待核。**

- 这套部署的实机启动日志：`Free memory on device` 行（每卡 64 GiB 仍是假设），以及 `Actual usage` 行里的激活峰值、非 torch 增量和 NPU 图内存。拿到之前，3.4 GiB 仍是教学假设，本页也不给 GLM 的推荐比例。
- main部署实际解析的布局和最终预算转储尚缺；上文已给出GLM不触发通用缩放的源码条件，未在main镜像上实跑。
- HCCL 单成员组是否真的各占一块缓冲，见 [HCCL buffer 页的待核](hccl-buffer.md)。

- 来源29与来源3的峰值记录区间重叠，说明保存录图之前的峰值再重算非KV开销。
- 容量参数参考：来源 30–31、36–39 对照三版默认与字段约束；32 是完整 CLI 名称，33 是字节单位解析；34–35 是每块字节换算与覆盖顺序，40 是 GLM 实际混合分组，41 是 main 保留块扣减，42 是 v0.26 覆盖顺序，43 是上游等页大小断言。GLM 覆盖断言以真实上游函数配合两档混合规格做了无设备最小分支复现；它证明该分支条件，不是专用镜像启动实测。
- 来源45补足加载量测前后相减；46是GLM专用后端在无元数据时转入SFA早退的实际调用。47–50补v0.26/main的完整扣减与建议输出；51–56补rc2多组修正、录图建议、MC2试跑、字段默认与保留块准入。57为固定上游显存指南全文，正文多模态示例及提示边界据此解释；未据CUDA示例宣称Ascend全组合已实测。
- main的GLM条件判断：58是无connector时共享底层存储能力为真，59–60区分kpool与普通SFA，61–62核runner的能力与路径标记，63说明布局在量测前已解析。实际组与页的规格继续见[KV规格](kv-cache-spec.md#版本差异)。
- 64–65补KDA进入早退函数之前的投影、全零输出缓冲，以及返回后的归一化和输出投影；早退并不代表整层毫无计算或开销。
- 66–68与57对照四版上游指南的多模态部分，该范围逐行相同；复用同一段阅读记录，不计成四次独立全文阅读。
