---
id: glm-5-3-flash-two-node
title: 我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash
type: feature
summary: 官方双机配置下 16 张卡各放了什么、启动时按什么顺序做完哪几件事、关键参数分别管住主线的哪一步，以及这套部署给后面各章留下的后果。
aliases:
  - GLM 双机部署
  - GLM TP8 DP2
  - GLM 双机案例
  - GLM 双机启动
  - 我们的部署
  - 两机十六卡部署
chapters:
  - '13'
order: 90
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1535-L1560'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1758-L1888'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L84-L96'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L1049-L1200'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L1-L254'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L110-L247'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L190-L200'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L59-L226
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L698
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L784'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1880-L1930'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L39-L92'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L252'
  - 'vllm@0fc695fc:vllm/config/model.py#L1851-L1857'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L400-L456'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426'
  - >-
    raw:sha256-3d53f4b483d1bded454b1df9f43e5ea7dbae8ca90202b83203703ae411b267c6.md#L1-L1698
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L43'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L544-L563'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L886-L925'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L96-L117'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L43
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L544-L563
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L886-L925
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L64-L329'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L664-L706'
  - 'vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L251-L299'
  - 'vllm@0fc695fc:vllm/model_executor/models/glm_ocr.py#L106-L166'
  - 'vllm@0fc695fc:vllm/model_executor/models/glm4_1v.py#L429-L455'
  - 'vllm@0fc695fc:vllm/model_executor/layers/conv.py#L17-L102'
  - 'vllm@0fc695fc:vllm/config/multimodal.py#L145-L158'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.3-Flash.md#L15-L45'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.3-Flash.md#L305-L420'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L171-L185'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L183-L220'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L724-L729'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/GLM5.3-Flash.md#L1-L45'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L299-L325'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda_input_projection_tp.py#L18-L45'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L815-L820'
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南固定主线顺序，本页展开部署与分组
  - to: glm-5-3-flash
    kind: builds-on
    note: 先认识这台机器上要跑的模型：45 层主干、两类 attention 和 MoE
  - to: collective-communication
    kind: builds-on
    note: 先知道 process group 和 All-Reduce、All-Gather 各是什么
  - to: tensor-parallel
    kind: builds-on
    note: 机内 8 张卡怎样合切一个矩阵
  - to: data-parallel
    kind: builds-on
    note: 两台机器各是一个执行组，空闲的一组为什么要陪跑
  - to: expert-parallel
    kind: builds-on
    note: 288 个专家怎样摊到 16 张卡，dispatch 与 combine 传什么
  - to: quantization
    kind: builds-on
    note: 逐层量化配方决定所列语言权重子账，实际占用还要计视觉塔等表外项
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 启动时量剩余显存、再一次性切成 KV 块的那一步
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-10'
origin: gap
rawSources:
  - >-
    raw/sha256-220489cf9f48b5b6e3b8d251fd4131ecbdb770233c46a546f480da729c275838.md
  - >-
    raw/sha256-3d53f4b483d1bded454b1df9f43e5ea7dbae8ca90202b83203703ae411b267c6.md
---

## 部署前提

「我们的部署」固定为 vllm-ascend 官方教程的双机配置：**2 台 Atlas 800 A2，每台 8 张卡，共 16 张卡（2×A2×8），TP8 / DP2 / EP16，W8A8**。本节是主线部署前提的统一入口；官方关键参数的取值与作用见下表，完整参数对照仍在页末[怎么开](#怎么开)。后续各页的每卡容量与通信量都以此为准。

W8A8 表示权重和激活采用 8 位整数、另配缩放系数；哪些层保留其它精度，见[每张卡上放了什么](#每张卡上放了什么)。

### 这套部署长什么样

官方配置同时用了四个并行维度，它们定下了每张卡上放什么、每一步谁跟谁通信：

| 维度 | 取值 | 切的是什么 |
| --- | --- | --- |
| **TP**（tensor parallel） | 8 | 同一层的矩阵交给机内 8 张卡分工：先按列切、再按行切，成对使用，最后把各卡的部分和加起来 |
| **DP**（data parallel，数据并行） | 2 | 两台机器各是一个执行组，各自有自己的 scheduler（决定每一步跑哪些请求的那个组件）和 KV cache 池（KV cache 保存历史位置的中间表示，让后续 token 不必重算前面的内容），请求按负载分给其中一组 |
| **EP**（expert parallel，专家并行） | 16 | 288 个路由专家摊到全部 16 张卡上，每卡 18 个；哪个 token 要用哪个专家，就把它发到对应的卡 |
| **PP**（pipeline parallel，流水线并行） | 1 | 这套部署没有按层切，45 层全在同一张卡的执行序列里 |

```wiki-diagram
file: glm-two-node-topology
```

TP 的通信留在机内，EP 横跨两台机器。因此，MoE 的通信会过机间链路，attention 和稠密层的通信不会。

权重切分、请求分配与专家路由的 3D 演示分别放在 [TP](tensor-parallel.md#再过稠密-mlp本地升维和门控降维后再合齐)、[DP](data-parallel.md#放到-glm-双机每台机器一个-dp-组)、[EP](expert-parallel.md#16-张卡怎样分专家) 对应章节，按当前阅读的概念单独播放。

**为什么用两台？** 单机的限制在于留给请求的显存更少：按相同切法把 288 个路由专家放到 8 张卡，每卡要放 36 个；双机摊到 16 张卡，每卡只放 18 个。于是本页所列语言权重的每卡子账从 38.72 GiB 降到 20.58 GiB；它不含视觉塔、MTP 旋转矩阵和量化辅助张量，范围见[每张卡上放了什么](#每张卡上放了什么)。按每卡 64 GiB、显存预算 0.85、激活峰值与非 torch 占用合计 3.4 GiB 的同一组教学假设，这份子账给出的双机 KV 容量约为单机的 2.5 倍。实际容量还要扣除表外项并代入 profile 结果。代价是 MoE 要跨机通信，两组每步还要同步；容量对照和 MC2 路径条件见[为什么是两台机器，不是一台](#为什么是两台机器不是一台)。

### 关键参数各管哪一步

下面沿用官方双机配方：显存比例管容量，每步 token 数和请求数管调度，单请求长度管上下文，MTP 与图尺寸一起决定 decode 批量。取值的作用与配合关系如下；这些是本教程的固定配置，最合适的容量与性能仍要用实际负载验证。

| 参数是什么 | 取值 | 为什么这样取、会影响什么 |
| --- | --- | --- |
| 显存预算比例（`--gpu-memory-utilization`） | 0.85 | 把总显存的 85% 用作权重、激活峰值、非 torch 占用与 KV cache 的预算；其余 15% 留给切完 KV 后的录图等开销 |
| 每个 DP 执行组一步的 token 预算（`--max-num-batched-tokens`） | 8192 | 限制一步的计算量；先满足正在运行的请求，长提示词超过剩余预算时分步处理 |
| 每个 DP 执行组一步的请求数上限（`--max-num-seqs`） | 32 | 限制批处理宽度；配合每请求 4 个 token 的 decode 步，最大图尺寸为 128；能否同时容纳这些请求还受 KV 容量限制 |
| 单请求总长度上限（`--max-model-len`） | 133120 token | 按官方配方限制提示词与生成内容的总长度，并据此确定块表最大长度和 KDA 状态组的逻辑块长度 |
| MTP 草拟数（`--speculative-config`） | deepseek_mtp，每轮 3 个 | 用模型自带的 MTP 层先猜 3 个 token，再由主模型一起验证；加上当前 token，每请求的 decode 步按 4 个 token 安排 |
| 主模型图模式与捕获尺寸（`cudagraph_mode` / `cudagraph_capture_sizes`） | FULL_DECODE_ONLY；4、8、16、32、64、96、128 token | 只录纯 decode 步，把算子序列预先记录后回放以减少下发开销；七档对应 1、2、4、8、16、24、32 个请求，批量补齐到可用档位，混合批逐个下发算子执行 |

### 本页新出现的名字

模型里的八个名字可回看上一页：[MoE、expert、router gate](glm-5-3-flash.md#moe288-个专家里每次挑-8-个)、[MTP](glm-5-3-flash.md#mtp主干之外的第-45-层)、[KDA](glm-5-3-flash.md#kda把全部历史压进一个固定大小的矩阵)、[稀疏 MLA 与索引器](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)、[mHC](glm-5-3-flash.md#一层有两段计算四条-residual-流贯穿两段)。这里补充部署与执行侧的新名字：

| 名字 | 一句话 |
| --- | --- |
| MC2 | Ascend 上把矩阵计算和通信协同起来执行的一类实现，MoE 的 dispatch / combine 会用到 |
| EngineCore | 引擎进程：持有 scheduler 和 KV cache 池，定下每一步跑什么，再交给 worker 执行 |
| worker | 管一张卡、真正执行前向的那个进程，一卡一个 |
| chunked prefill | 提示词太长时分几步算完，每步只算一段 |
| graph mode / eager | graph mode 把一次前向的算子序列先录下来、之后按同样尺寸回放；eager 是每次都逐个下发算子，不回放图 |

prefill / decode 的区别见[阅读指南](learning-guide.md#按顺序读的五页主线)；logits 是词表中每个候选 token 的分数，见[模型如何产生下一个 token](glm-5-3-flash.md#模型怎样产生下一个-token)。

## 为什么是两台机器，不是一台

先说清最容易绕晕的一件事——**有几份**。在这套部署里，**attention、稠密层和共享专家每台机器各有一份，288 个路由专家 16 张卡合起来只有一份**。所以每台机器是一个独立的调度单位（下文叫「DP 执行组」），但它不是一个能单独跑完整个模型的副本。

把同样的模型放进单机 8 卡，EP 规模也变成 8。下表两列都用**所列语言权重子账**比较容量：MLA 四组投影采用 INT8，视觉塔、MTP 旋转矩阵和量化辅助张量等未计入，详见后面的权重表。后文的 [KV 算例](#两种块数各在什么时候用)另假设权重预算为 21 GiB；这两个算例都不代替实际加载占用。

| | 单机 8 卡（EP8） | 双机 16 卡（EP16） |
| --- | --- | --- |
| 每卡路由专家 | 43 层 × 36 个 × 24 MiB = 37,152 MiB | 43 层 × 18 个 × 24 MiB = 18,576 MiB |
| 每卡所列非专家权重 | 2,502 MiB | 2,502 MiB |
| 每卡所列语言权重小计 | 39,654 MiB ≈ **38.72 GiB** | 21,078 MiB ≈ **20.58 GiB** |
| 同一组假设下还剩给 KV | 55,705.6 − 39,654 − 3,481.6 = **12,570 MiB** | 55,705.6 − 21,078 − 3,481.6 = **31,146 MiB** |
| 折合块数（除以 8,355,840 B） | **1,577** 块 ≈ 101 万 token | **3,908** 块 ≈ 250 万 token |

（55,705.6 MiB 是 64 GiB × 0.85 的预算，3,481.6 MiB 是假设的 3.4 GiB 激活峰值与非 torch 占用。）

这份账说明，**不能仅凭专家参数量就断定「单机放不下」**：按这组教学假设，单机扣除所列权重后还剩十几 GiB。能否实际部署还取决于表外项、激活峰值和实现支持。两台机器买到的是三样东西：

1. **这份子账下 KV 容量约为 2.5 倍**，说明少放专家权重可以腾出更多请求空间；实际请求容量还取决于表外项、profile 和请求状态开销。
2. **每卡只放 18 个专家**，专家那一项的显存和开机要读的字节数都减半。
3. **MoE 才允许走 MC2 这条快路径。**在 A2 上选 MC2 有三个同时满足的条件：EP 规模至少 16，每卡的专家数不超过 24，并且 `num_tokens <= mc2_tokens_capacity`；否则返回 `ALLGATHER`。EP8 的规模和每卡专家数条件都不满足——EP 只有 8，每卡还要放 36 个专家——只能退回 All-Gather（把各张卡手上的分片拼成完整一份的那种集合通信）。

单机一列是同样切法与显存假设下的推算；实测缺口见页末[开销和什么时候别开](#开销和什么时候别开)。

## 16 张卡怎样分组

**process group（通信组）** 是一组卡加上组内编号；集合通信（多张卡按约定的语义一起收发数据）只在组内发生。启动时，vLLM 先给 16 张卡编上全局 **rank**（参与分布式执行的成员编号）：机器 0 是 rank 0–7，机器 1 是 rank 8–15，规则是 `rank = DP 组号 × 8 + 本机卡号`。机器 1 上操作系统看到的设备号仍然是 0–7，全局 rank 才是 8–15。

在这 16 个 rank 上一共建起四类组：

| 组 | 有几个 | 成员 | 谁在用 |
| --- | --- | --- | --- |
| TP 组 | 2 | `{0…7}`、`{8…15}`，都在机内 | 词嵌入之后、attention 输出投影之后、稠密 MLP 与共享专家输出投影之后的 All-Reduce（把各卡的部分结果逐元素加起来，再让每张卡都拿到完整结果），MoE 收尾的 All-Gather，以及 `lm_head` 之后的 All-Gather |
| DP 组 | 8 | `{0,8}`、`{1,9}` …… `{7,15}`，跨机同号卡配对 | 每组各有一条 HCCL 通道和一条 CPU（gloo）通道：两台机器每步对齐 token 数和图模式默认走 CPU 通道，MoE 改走 All-Gather 路径时那次跨组的 All-Gather / Reduce-Scatter 走 HCCL 通道 |
| EP / MC2 组 | 1 | `{0…15}` | MoE 的 dispatch（把 token 发给专家所在的卡）与 combine（把专家结果收回来） |
| 引擎之间的 CPU 组 | 1 | 两个 EngineCore 进程 | 只传一个两元素的整数张量，互相通报「还有没有没做完的请求」 |

```wiki-diagram
file: glm-two-node-groups
```

读表时区分两个层级：**DP 执行组**负责调度请求，共 2 个；**DP 通信组**负责跨机同号卡之间的同步，共 8 个。HCCL 是 Ascend 的集合通信库，gloo 提供 CPU 通道，分工见表。本页的「DP 组 0 / DP 组 1」均指执行组。

## 一条请求在这 16 张卡上怎么走

把上面的分组串起来，一条请求先归一个 DP 组调度，前向中交替用到机内 TP 和跨机 EP：

```wiki-diagram
file: glm-two-node-request-route
```

图中有两种分派：前端选择一个 DP 组持有请求，模型里的 router 再把 token 送到专家所在的卡。协调进程汇总负载，前端据此选组；指定组号与默认打分的区别见[多条请求的入口](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)。

两条执行支路在 MoE 汇合，因为完整专家集合分布在两台机器上；空闲组的陪跑规则见[多条请求](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。每步结果沿所属引擎回到前端，七站的函数与进程交接见[请求调用链](request-call-chain.md)，张量与通信量见[一条请求](one-request.md)。

沿图展开各步：[DP 选组](data-parallel.md)、[scheduler 分配本步工作](vllm-scheduler.md)、[TP 在机内合并部分结果](tensor-parallel.md)、[EP 把 token 交给专家并收回结果](expert-parallel.md)。dummy batch 是空闲组陪跑时执行的空批次；两组由协调器一起唤醒，再按同一通信步调执行。

## 每张卡上放了什么

切法分三种。按 **EP** 切的只有路由专家：288 个专家除以 16，每张卡 18 个。按 **TP** 切成 8 份的是 KDA 的 q / k / v / o 四个大投影、稀疏 MLA 的 `q_b_proj` / `kv_b_proj` / `o_proj`、前 3 层的稠密 MLP、每层那 1 个共享专家；嵌入表（embedding）和 `lm_head` 按词表的 154880 行切成 8 份。第三类是**每张卡各放一整份、根本不切**：MLA 的 `fused_qkv_a_proj`、整个索引器（`wq_b`、`wk_weights_proj`、`index_kpool_compress_gate`）、KDA 的 `f_a_proj` 与 `g_a_proj`、router gate、mHC 的混合参数，以及 MTP 层的 `eh_proj`。这一类是有意为之：索引器那 32 个头每张卡各算一遍，用冗余计算换掉一次通信。

下面保留一份可复算的**主要语言权重子账**：MLA 的 Q 压缩、KV 压缩、Q 展开和输出投影采用 INT8，其余按表中精度。这个配方对应量化目录的 3121f187 快照；9e55cbc8 快照把这四组投影留在浮点，差额见下节。表中未计视觉塔、MTP 旋转矩阵、量化 scale / offset 及未逐项列出的小型参数，因此小计不能当作整卡完整加载占用。

| 部件 | 每卡每层 | 合计 |
| --- | --- | --- |
| 嵌入表（BF16） | 19360 × 4096 × 2 B | 151.25 MiB |
| KDA 层（主要是 BF16） | 34.61 MiB | × 34 层 = 1,176.7 MiB |
| 稠密 MLP（int8） | 18.0 MiB | × 3 层 = 54.0 MiB |
| 稀疏 MLA + 索引器（int8 19.0 + BF16 18.25） | 37.25 MiB | × 11 层 = 409.75 MiB |
| 路由专家（int8） | 432.0 MiB | × 42 层 = **17.72 GiB** |
| 共享专家（int8） | 3.0 MiB | × 42 层 = 126.0 MiB |
| router gate（FP32） | 4.5 MiB | × 42 层 = 189.0 MiB |
| mHC 四路残差的混合参数（FP32） | 3.0 MiB | × 45 层 = 135.0 MiB |
| `lm_head`（BF16） | 151.25 MiB | 151.25 MiB |
| 主干 45 层小计 | | 20,537 MiB = 20.06 GiB |
| MTP 第 45 层 | | 540.75 MiB |
| **所列语言权重小计** | | **21,078 MiB = 20.58 GiB** |

KDA 合计有两种取整口径：按每层字节精算、乘完 34 层后再取一位小数，是 1,176.9 MiB；表中的 1,176.7 MiB 则是先把每层取整到 34.61 MiB，再乘 34 层并取一位小数得到的。

最大的一项是路由专家的 17.72 GiB，占这份语言权重子账的约 86%。这也是 EP 存在的理由：每卡只放 18 个专家，才压得住这一项。

**MTP 层放在哪里。** MTP 用来做 speculative decoding（先猜几个 token，再让主模型一次验证）。它是模型的第 45 层，有自己独立的一套稀疏 MLA、索引器和 288 个路由专家，不和主干共用；这一套按和主干一样的方式摊到 16 张卡上，所以**每张卡上是这么几项**：MLA 加索引器 37.25 MiB、18 个路由专家 432 MiB、共享专家 3 MiB、router gate 4.5 MiB，再加上不切 TP、每卡一整份的 `eh_proj` 64 MiB，合计 **540.75 MiB**。它没有 mHC 四路残差，也不自带输出投影——加载完成后它的输出头被换成主模型的 `lm_head`，所以那 151.25 MiB 不重复计。除了权重，它在 KV cache 里也占一层，这一点下一节再看。

540.75 MiB 也是所列模块的小计：两份量化快照都开启 QuaRot，MTP 还会在每卡加载不切 TP 的 4096 × 4096 旋转矩阵。按 BF16 计算要另加 **32 MiB**，这项随权重加载，不能归入首次前向才产生的索引器副本。

### 量化版本和视觉塔怎样补进这份账

两个量化目录使用相同的模型配置，但逐层精度不同。应按实际部署目录固定版本，不能只凭模型名相同就沿用容量：

| 量化描述快照 | MLA 四组投影 | 所列语言权重子账 | 仍需另计 |
| --- | --- | --- | --- |
| 3121f187 | W8A8 动态量化 | 20.58 GiB | MTP 旋转矩阵、视觉塔、量化辅助张量及其余小型参数 |
| 9e55cbc8 | FLOAT，按 BF16 加载计算 | 每层增加 19 MiB，12 层共加 228 MiB，约 **20.81 GiB** | 同上；20.81 不是整卡占用的上界 |

**官方双机配方会加载视觉塔。** 它允许每请求 1 张图、0 段视频；视觉模块只有在两种模态的额度都为 0 时才被跳过。仅发送纯文本请求，或省略模态额度参数，都不会自动省掉这份权重。默认的视觉编码器采用 weights 模式：大线性矩阵按 TP8 切，卷积、归一化和部分偏置仍复制在每卡；改成 data 模式时矩阵也复制，必须另算。

用同一配置的视觉宽度 1024、MLP 宽度 4096、输出宽度 4096、合并层中间宽度 10240，按 BF16、TP8、保留视觉塔计算：

| 每卡视觉权重分项（BF16、TP8、不含视觉激活和临时缓冲） | 算式 | 每卡大小 |
| --- | --- | --- |
| 24 层的大矩阵 | $24 \times (4 \times 1024^2 + 3 \times 1024 \times 4096) \div 8 \times 2\text{ B}$ | **96 MiB** |
| 合并层的大矩阵 | $(4096^2 + 3 \times 4096 \times 10240) \div 8 \times 2\text{ B}$ | **34 MiB** |
| 图块卷积及偏置 | $(1024 \times 3 \times 2 \times 14^2 + 1024) \times 2\text{ B}$ | **2.299 MiB** |
| 下采样卷积及偏置 | $(4096 \times 1024 \times 2^2 + 4096) \times 2\text{ B}$ | **32.008 MiB** |
| 其余偏置和归一化 | $(24 \times 5632 + 8192 + 1024) \times 2\text{ B}$ | **0.275 MiB** |
| **视觉权重小计** | 以上五项相加 | **164.582 MiB / 卡** |

第一行的 4 个方阵来自 Q、K、V 和输出投影，3 个升降维矩阵来自 SwiGLU。每层其余 5632 个数包括 TP 切分后的 QKV 与 gate/up 偏置、复制的输出与 down 偏置，以及归一化参数。此账只统计视觉参数；模型加载后的总占用还包括量化辅助张量、对齐与运行时缓冲，应以启动日志中的加载结果和 profile 为准。

## 剩下的显存变成多少 KV cache

启动时以卡上总显存的 0.85 为预算，减去权重、假数据前向量出的激活峰值和其它占用，把余量一次性切成 KV 块。先看每块多大，再看预算能切出多少块。

### 为什么一个逻辑块是 640 个 token

**这里的「块」比常见的大得多：一个逻辑块是 640 个 token。** 原因是 GLM 是 hybrid 模型——34 层 KDA 线性 attention 存的是固定大小的递推状态，11 层稀疏 MLA 存的是按 token 增长的压缩表示，两种状态要共用同一个池子。vllm-ascend 的做法是让块大到「一个 MLA 页刚好装得下一整份 KDA 状态」：

$$\text{kernel 块数} = \left\lceil \frac{561{,}152}{128 \times 1{,}024} \right\rceil = 5, \qquad \text{逻辑块大小} = 128 \times 5 = 640\text{ 个 token}$$

| 逻辑块大小推导项 | 算式 | 数值 |
| --- | --- | --- |
| KDA 每层每请求的状态（TP=8 之后） | 递归状态 524,288 B + 短卷积状态 36,864 B | **561,152 B** |
| MLA 每 token 每层主 cache | `kv_lora_rank` $512 \times 2\text{ B}$ | **1,024 B** |
| 需容纳整份 KDA 状态的 128-token kernel 块数 | $\lceil 561{,}152 \div (128 \times 1{,}024) \rceil$ | **5** |
| **逻辑块大小** | $128 \times 5$ | **640 个 token** |

### 占住一个块号，要用多少显存

**640 表示逻辑块覆盖的 token 数，块号则是池里分配空间的编号。** 每个块号对应所有存储层的一组空间，因此要把这些层的字节数加起来。这里包括主干和 MTP 的稀疏 MLA，也包括索引器的压缩 cache：

$$\text{每块号字节} = 12 \times 655{,}360 + 12 \times 40{,}960 = 8{,}355{,}840\text{ B} = 7.969\text{ MiB}$$

| 单个 KV 块号显存账 | 算式 | 结果 |
| --- | --- | --- |
| 存 KV 的层数 | 主干 11 层稀疏 MLA（第 3、7、…、43 层）+ MTP 第 45 层 | **12 层** |
| 每块号总字节 | $12 \times 655{,}360\text{ B（MLA 主 cache）} + 12 \times 40{,}960\text{ B（索引器压缩 cache）}$ | $8{,}355{,}840\text{ B} =$ **7.969 MiB** |
| 折合每 token | $8{,}355{,}840 \div 640$ | **13,056 B**（其中 MTP 层占 **1,088 B**） |
| 整卡块数 | $\lfloor \text{可用 KV 显存} \div 8{,}355{,}840\text{ B} \rfloor$ | 见下节预算算例 |

### 两种块数各在什么时候用

**3,855 块和 3,908 块都是教学预算算例。** 两者都假设每卡 64 GiB、激活峰值加非 torch 占用 3.4 GiB。3,855 块另外假设权重占 21 GiB；3,908 块则只代入上面所列的语言权重子账 **21,078 MiB（约 20.58 GiB）**，尚未扣视觉塔、旋转矩阵等表外项。两者相差约 0.42 GiB，不代表实际部署一定有这份余量。

先看示例算法。它把可用 KV 显存写成整齐的 30.00 GiB，便于后面的单请求、并发请求章节沿用：

| 显存余量与 KV 块数预算（假设每卡 64 GiB、权重 21 GiB、激活峰值与非 torch 占用 3.4 GiB） | 算式 | 结果 |
| --- | --- | --- |
| 总显存预算（85%） | $64\text{ GiB} \times 0.85$ | **54.40 GiB** |
| 减假设权重 | $54.40 - 21$ | **33.40 GiB** |
| 减激活峰值与非 torch 占用（可用于 KV） | $33.40 - 3.4$ | **30.00 GiB** |
| 切出的 KV 块数 | $\lfloor 30\text{ GiB} \div 8{,}355{,}840\text{ B} \rfloor$ | **3,855 块** |
| 理论可存 token 上限 | $3{,}855 \times 640$ | $\approx$ **2.47 M token** |

只代入所列语言权重子账时余下约 **30.42 GiB、3,908 块**，与 3,855 块算例相差 1.4%；比较见前面的[单机与双机表](#为什么是两台机器不是一台)。**后文的请求演算沿用 3,855；3,908 用于展示子账计算，不能当成精确设备容量。** 实际部署的块数须代入完整加载占用和启动 profile 的显存值。

**decode 图和索引器 FP32 副本从预算外的余量支付。** 量激活峰值时尚未录图，稀疏 MLA 又跳过计算，索引器没有运行；因此，这时既没有图内存，也没有索引器首次前向才创建的副本。KV 切好后它们才出现，使用预算外的 **9.6 GiB（64 GiB 的 15%）**。索引器副本每层 4.5 MiB，11 个稀疏 MLA 层加 MTP 层共约 **54 MiB/卡**；它不属于这 3.4 GiB，也不再从已经切好的 KV 池扣除。

```wiki-diagram
file: glm-two-node-card-budget
```

### 为什么短请求也占 15 个块

**12 是固定的 KDA 状态开销，15 是这条新请求的总开销。** 34 层 KDA 分成 3 个缓存组，每组要 4 块：当前状态占一页，MTP 的 3 个草稿位置各留一页。因此序列再短，KDA 也固定占 12 个块号。

再加 full 组的 1 块、索引器状态组的 2 块，一条只有 7 个 token 的新请求就占 **15 块、约 119.5 MiB**，真正装这 7 个 token 的仅约 **89 KiB**。推导与请求分配过程见[一条请求](one-request.md)。这解释了短请求的块浪费。15 块是第一步的数；进入 decode 后索引器状态组边还边借、手里 3–4 块，每条请求常驻的状态块就是 15–16 块，R1 结束时还回 16–17 块，见 [KV 块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。

## 启动时发生了什么

从敲下启动命令到服务能收请求，按顺序做完七件事。

```wiki-diagram
file: glm-two-node-startup
```

**第一步，起核心功能进程。** 机器 0 有三个角色：API server（接 HTTP、套聊天模板、分词）、DP 协调进程、EngineCore。本配方的 `--api-server-count 1` 让启动进程直接运行唯一的 API server。机器 1 用 headless 模式启动，不建 HTTP 前端；它派生一个 EngineCore，向机器 0 的握手端口报到，headless 启动父进程继续监控这个引擎。

**第二步，每张卡一个 worker。** 每个 EngineCore 再派生出 8 个 worker，并建一条共享内存广播队列，一次性把本步工作发给它们。两台机器合计 16 个 worker。

| 机器 | 进程 | 个数 |
| --- | --- | --- |
| 机器 0 | API server | 1 |
| 机器 0 | DP 协调进程 | 1 |
| 机器 0 | EngineCore（DP 组 0） | 1 |
| 机器 0 | worker（卡 0–7） | 8 |
| 机器 1 | EngineCore（DP 组 1，headless） | 1 |
| 机器 1 | worker（卡 8–15） | 8 |

表内合计 **20 个核心功能进程，其中 16 个 worker 占卡**。这是上述角色的组成账，不是操作系统的完整进程清单：机器 1 仍有 headless 启动父进程，所用多进程启动方式还会带来相应的运行时辅助进程；这些未计入表内。

**第三步，建 process group。** 每个 worker 用 HCCL 建全局通信域，再按 TP=8 建机内 TP 组、按 DP=2 建跨机配对，最后建那个 16 卡的 EP / MC2 组。上一节那张表就是这一步的产物。

**第四步，加载 W8A8 权重。** 引擎读取模型目录里的精度描述，逐层选择量化或不量化的实现。显存按**加载后**的类型算；哪些层用 INT8、BF16、FP32，见[模型页的权重精度表](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。索引器首次前向才创建的 FP32 副本及其预算归属，见上面的[两种块数与预算](#两种块数各在什么时候用)。

**第五步，量出剩余显存。** 每个 worker 用假数据按一步的上限试跑：GLM 先按 128 个 token 跑一次，再按 8192 个跑一次。试跑不建注意力元数据，稀疏 MLA 层直接返回全零，KDA 层跳过递归计算，所以这不是一次完整前向。测出激活峰值后，用预算减去权重、激活峰值和非 torch 占用，得到还能给 KV cache 多少，见 [KV cache 显存预算](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)。

**第六步，切 KV cache 块。** 按上一节的公式把可用显存一次性切成块。GLM 走的是 vllm-ascend 专门写的分组器，把 45 层分成 5 个缓存组：1 个 full 组（12 层 MLA 主 cache 和 12 份索引器压缩 cache 交错排列）、1 个索引器状态组、3 个 KDA 组（34 层按步长 3 分成 12/11/11 层）。同一个块 id 的物理空间被不同组的层共享，所以**占住一个块 id 就等于占住 7.969 MiB**，不管是哪一组在用它。

**第七步，捕获 decode 图。** 只录纯 decode 步，回放时省去逐个下发算子的开销。捕获 7 个尺寸：4、8、16、32、64、96、128 个 token。MTP 让每个请求在一步里算 1 个真 token 加 3 个草稿 token，所以这 7 个尺寸对应 **1、2、4、8、16、24、32 个请求**；最大的 128 正好等于请求数上限 32 乘 4。

## 这套部署给后面各章留下的后果

这六条是从上面的配置直接推出来的，后面各章会反复用到。

1. **DP 组里最大 token 数一过 128，两台机器一起从 MC2 翻到 All-Gather。** 判断看两组本步 token 数的最大值，和有没有 prefill 无关；短的 chunked prefill 也能走 MC2。门槛取自最大图尺寸，因此上面算出的满载纯 decode 步刚好压线，再多一点 token 就翻路径。见 [large-scale EP](large-scale-ep.md) 与 [chunked prefill](chunked-prefill.md)。
2. **空闲的 DP 组要陪跑。** 只要全局还有没做完的请求，没活干的那一组也必须一步不落地空跑一次完整前向——它本地只准备 4 个 token，但按 DP 对齐后会被拉到对端的宽度，跑满 45 层、在 EP 组里做 dispatch 和 combine，连草稿模型也陪跑一次。最后一条请求结束后，两组最多还会一起空跑 31 步才停。见 [data parallel](data-parallel.md)。
3. **图模式取两组的最小值。** 一组是混合批就没有图可用，同步之后**两组这一步都退回 eager 执行**，本来能用 decode 图的那一组也用不上。见 [ACL Graph](acl-graph.md)。
4. **块大让短请求浪费显存**，换来 KDA 状态和 MLA 历史共用一个池子；数字见[短请求为什么占 15 块](#为什么短请求也占-15-个块)，分配规则见 [KV block 分配](vllm-kv-block-allocation.md) 与 [KV cache spec](kv-cache-spec.md)。
5. **prefix caching（复用相同前缀的 KV）关着。** 相同前缀不会被复用，每条请求的提示词都要重算。见 [prefix caching](prefix-caching.md)。
6. **MTP 同时影响权重、KV 和每步 token 数。** 前两项见本页的权重表与每块字节算式；每请求每步从 1 个变成 4 个 token，还会影响图尺寸、token 预算和 MC2 的 128 门槛。见 [speculative decoding](speculative-decoding.md)。

沿着请求本身往下走，看 [一条请求的全过程](one-request.md)；多条请求同时进来时的样子，看 [并发请求](concurrent-requests.md)。

## 活跃食谱增量对照：v0.30.0 与 main 变了什么

上文全篇算例、16 卡容量子账与 3,855 / 3,908 块预算属于**例外 B 历史绑定算例**，严格钉在 `vllm@0fc695fc + vllm-ascend@db701c1f`（教程提交 `0576b647`）以确保与全站 19 篇冻结 3D 算例页数字自洽。若直接部署社区正式版 `v0.30.0`（`vllm-ascend@c09d3e20`）或开发主线 `main`（`vllm-ascend@8d6180e2`）中的活跃 `GLM5.3-Flash.md` 食谱，核心架构与参数有以下四类增量演进，不可直接把旧镜像字节账套回新版本：

```wiki-diagram
file: glm-5-3-flash-two-node-fig-v030-evolution
```

| 演进维度 | 历史绑定镜像（`db701c1f` / 教程 `0576b647`） | `v0.30.0` 活跃食谱（`c09d3e20`） | `main` 活跃食谱（`8d6180e2`） |
| --- | --- | --- | --- |
| **模型目录与缓存重构** | 单文件 `models/glm5_next.py` + `glm5_next_mtp.py` + `glm5_next_multimodal.py`；依赖 `patch/platform/` 改写块长与 5 组 KV | 重构为模块化目录 `models/glm5next/`（`model.py`、`attention.py`、`kda.py`、`mtp.py`、`cache_config.py`、`kv_cache.py`、`sparse_attn_indexer_kpool.py`、`ops/`）；尾状态改用每请求 1 格的环形缓冲规格 | 延续 `models/glm5next/`，新增 `kda_input_projection_tp.py`、`recoverssm_config.py`、`recoverssm_metadata.py` |
| **KDA / MLA 投影融合** | KDA 经 `REGISTERED_ASCEND_OPS` 替换上游类，6 路输入投影独立执行；MLA 权重按旧镜像量化描述分派 | KDA 的 `q/k/v/b/f_a/g_a` 六路输入合并为单次列切融合投影 `in_proj_qkvbfg_a`（`f_a/g_a` 仍逐卡复制）；MLA 低秩输入改用 `DeepSeekV2FusedQkvAProjLinear`，且 `kv_b_proj` 显式设 `quant_config=None` 保持 BF16 | `in_proj_qkvbfg_a` 进一步支持细粒度 `qkv_iproj_tensor_parallel_size`（`KDAInputProjectionTP`） |
| **A2 双机混部启动项与环境变量** | 2×A2×8、TP8/DP2/EP16、133120、32、8192、0.85、MTP 3、`FULL_DECODE_ONLY`（未显式写 Runner 版本与 prefetch） | 保留上述 A2 双机混部核心参数；**显式设置 `VLLM_USE_V2_MODEL_RUNNER=0`**（当时仅支持 Model Runner V1），新增 `--safetensors-load-strategy prefetch`，并显式列出 `PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`、`HCCL_OP_EXPANSION_MODE=AIV`、`HCCL_BUFFSIZE=1024`、`VLLM_RPC_TIMEOUT=3600000`、`VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS=3000`、`HCCL_EXEC_TIMEOUT=3600`、`HCCL_CONNECT_TIMEOUT=1200` 与网卡环境变量 | 同组 A2 双机脚本保留核心参数与超时变量，但 **全面切换至 Model Runner V2（`VLLM_USE_V2_MODEL_RUNNER=1`）** |
| **硬件覆盖与 PD / KV Pool 形态** | 仅覆盖 A2 双机混部 W8A8 | 扩展 **A3 单机（16 逻辑卡）** 与 **950DT 单机（`GLM-5.3-Flash-w8a8-mxfp8`）**；支持 **W8A8C8 动态 KV 量化**（A3 用 `--kv-cache-dtype int8`、950DT 用 `--kv-cache-dtype fp8`）；新增 4 机 A2 / 2 机 A3 / 2 机 950DT 的 **1P1D PD 分离** 与 DDR KV Cache Pool（`MultiConnector` = `MooncakeConnectorV2` + `AscendStoreConnector`，强制 `use_layerwise: false`、自动设 `--mamba-cache-mode align`） | A3 PD 进一步升级为 Prefill **`PCP8/TP1`** + `--mamba-ssm-cache-dtype bfloat16` + `enable_fused_mc2: 2` + `--enable-eplb`（Decode 保持 `PCP1`）；950DT 与 A2 同步收敛到 MRV2 |

因此，阅读站内「09 旗舰异构模型全案」与冻结 3D 绑定算例时，仍以本文前几节的固定钉点账单为准；若要在现网直接按 `v0.30.0` 或 `main` 启动 GLM-5.3-Flash，必须以对应提交的 `GLM5.3-Flash.md` 镜像、环境变量与实际启动 profile 重新核定 KV 块数。

## 对照源码

### 怎么开

完整的启动命令、环境变量和两端的差异，以官方教程 [GLM5.3-Flash.md](https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md)（文档提交 `0576b647`）为准。这里只解释每个参数管住主线的哪一步。

启动两端进程前，先按 [HCCL 页的网络预检](cann-hccl.md#启动多机前先检查哪一层网络)确认所用 NPU 的链路、设备地址与双向连通性，再核对主机网卡及进程端口。主机可以互访、API 端口可以连接，分别只证明对应路径可达；设备通信和后续建组还需各自验证。

| 参数 | 取值 | 它是什么意思 | 管住主线的哪一步 | 深入看 |
| --- | --- | --- | --- | --- |
| `--tensor-parallel-size` | 8 | 机内几张卡合切同一层的矩阵 | 每层 attention 和 MLP 的切分与 All-Reduce | [tensor parallel](tensor-parallel.md) |
| `--data-parallel-size` | 2 | 一共几个执行组（DP 组） | 请求分给哪一组；两组每步互相对齐 | [data parallel](data-parallel.md) |
| `--data-parallel-size-local` | 1 | 本机起几个执行组 | 启动第一步：每台机器只起一个 EngineCore | [engine processes](engine-processes.md) |
| `--enable-expert-parallel` | 开 | 专家按卡摊开，而不是每卡一整套 | MoE 那一层的 dispatch 与 combine | [expert parallel](expert-parallel.md) |
| `--quantization` | `ascend` | 按权重仓库的描述文件逐层选精度 | 启动第四步：权重字节数 | [quantization](quantization.md) |
| `--max-model-len` | 133120 | 一条请求最长能有多少 token | 块表的最大长度、KDA 状态的页大小 | [block table](block-table.md) |
| `--max-num-batched-tokens` | 8192 | 一步最多算多少 token | scheduler 每步的 token 预算 | [chunked prefill](chunked-prefill.md) |
| `--max-num-seqs` | 32 | 一步最多带几个请求 | 连续批处理的宽度上限 | [concurrent requests](concurrent-requests.md) |
| `--gpu-memory-utilization` | 0.85 | 显存预算占总量的比例 | 启动第五步：能切出多少 KV 块 | [KV cache 显存量测](kv-cache-memory-profiling.md) |
| `cudagraph_mode` | `FULL_DECODE_ONLY` | 只给纯 decode 步录图 | 启动第七步；混合批只能 eager 执行 | [ACL Graph](acl-graph.md) |
| `cudagraph_capture_sizes` | 4…128 共 7 个 | 录哪几个批量尺寸 | decode 步要补齐到最近的一个尺寸 | [graph mode](graph-mode-layer.md) |
| `--speculative-config` | `deepseek_mtp`，每轮 3 个 | 用模型自带的 MTP 层草拟 3 个 token | 采样之后的草拟与验证；也把每请求每步的 token 数变成 4 | [speculative decoding](speculative-decoding.md) |

两端启动入口 [S1]：机器 0 正常 `vllm serve`，由 `launch_core_engines` 建 DP 协调器并按 `data_parallel_size_local=1` 只拉起本机的 1 个引擎进程；机器 1 走 `run_headless`，不建前端、不建协调器，按 `data_parallel_start_rank=1` 起 1 个引擎进程并连回机器 0 的握手地址。

`--quantization ascend` 由 vllm-ascend 在参数解析阶段补入。它读模型目录下的 `quant_model_description.json`，逐层判断精度；前缀标成 `FLOAT` 的层换成不量化的实现。各层加载后的精度与文件精度对照见[模型页](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。索引器的 K 投影 `wk_weights_proj` 和压池打分投影 `index_kpool_compress_gate` 在首次前向各转一份 FP32 常驻副本；其余索引器投影为 `wq_b`，池内位置偏置为 `index_kpool_compress_ape`（每层 4 × 128 个数）。

**官方教程的矛盾与默认值**

**矛盾：每节点几张卡。** 教程的前置条件一处写每节点 16 卡，另一处写 8 卡。本知识库**以可见设备 0–7 为准，也就是每台机器 8 张卡、全局 16 张**。理由是命令里的 TP 是 8、本机 DP 是 1，两者相乘正好是 8；再乘 DP=2 才是 16。按 16 卡读，全局规模会变成 32，和命令里的其它数字对不上。

**空白一：prefix caching（前缀相同的请求复用已经算过的那部分 KV）没写。** 教程里既没有 `--enable-prefix-caching` 也没有关闭它的选项，所以走默认值。默认值不是「开」：GLM 是 hybrid 模型，vLLM 对这类模型直接判定不支持 prefix caching，于是它是**关着的**。后果是每条请求的提示词都要完整重算一遍，哪怕前缀和上一条完全相同。

**空白二：`block_size` 没写。** 教程没有 `--block-size`，GLM 补丁按[逻辑块算式](#为什么一个逻辑块是-640-个-token)把它定成 **640**，本页容量算式都按这个数。这个字段在启动中途还会被改写，而且在不同阶段、不同缓存组里指的是五种不同的块，对照表和改写过程见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。

该专用缓存路径还要求启用混合缓存管理器：摘录中，至少一个缓存规格的 `model_version` 为 `"glm5_next"` 时进入 GLM 专用分组逻辑；若禁用 hybrid KV cache manager，则抛出 `ValueError`，因此不能在该路径下通过关闭管理器来节省开销。[C24]

**空白三：`--kv-cache-dtype` 没写**，同样走默认值。这一条不影响本页的数字：MLA 主 cache 的精度在代码里就写死成 BF16，本来也不由这个选项决定。 [D]

### 会报什么错

- 草稿模型的层必须出现在 KV cache 配置里，否则 `initialize_attn_backend` 会在 `assert not missing_layers` 上直接断言失败 [C22]。MTP 第 45 层是 MLA 层、带自己的索引器，它的三份 cache 必须和主干一起进分组器。
- 两端的 `data-parallel-start-rank`、`data-parallel-size` 和握手地址任一对不上，全局 rank 就凑不成 0–15（rank 的算法见下表第一行）。**待核：**缺一份实机日志，按教程设的 `HCCL_CONNECT_TIMEOUT=1200`，表现更可能是等到超时而不是立刻报错，现在没有报错原文可引。建链、执行与 Worker 三种等待的单位、默认和覆盖见[超时参考](request-call-chain.md#怎么开)。
- 本机网卡名（`HCCL_SOCKET_IFNAME`）要填 `local_ip` 对应的那一张，这是教程给的配置约束，不是运行期报错 [S1]。Gloo 与 HCCL 的接口语法、地址优先级及 TensorPipe 变量区别统一见[通信环境参考](engine-processes.md#怎么开)。

### 开销和什么时候别开

- EP 横跨两台机器，发往远端专家的输入和返回结果需要经过机间链路；本地专家的数据不因此都变成跨机传输。通信规模按 DP 组里 token 数的最大值算，超过 128 就从 MC2 换成 All-Gather（见下表「MC2 与 All-Gather 的选择」一行）。代码里这个门槛读的是最大图尺寸，判断条件里没有「是不是 prefill」这一项 [D]。
- DP=2 的代价包括空闲请求组陪跑：没接到请求的那组也要执行 dummy 前向，并按 DP 对齐补齐宽度（见下表最后三行）。但它持有的专家仍可能为另一组的真实 token 工作，不能据此说一半算力都浪费；补齐、等待与有效专家计算各占多少，要按实际负载测量。
- graph mode 在混合批上没有收益，两组同步后取最小值，一方 eager（逐个下发算子、不回放图）就全体 eager。
- 每卡 18 个路由专家、每 token 13,056 B 由下表的源码值直接算出；3,855 块还依赖下一条的假设 [D]。
- 本页显存算例里的卡上总量 64 GiB、激活峰值加非 torch 占用 3.4 GiB 都是教学假设，换一组数字要把块数公式重算一遍 [A]。

**待核：**官方教程只给双机配方；单机账按相同切法推算，缺实机验证，也未核单机激活峰值是否变化。两份量化描述的差异和视觉、旋转矩阵的构造已能逐项计算；完整加载字节数仍须核对全部参数、辅助张量与实际启动日志，不能把 20.58 / 20.81 GiB 子账当成设备总量。

还在待核的条目：

- 卡上显存总量。64 GiB 是教学假设，需要一份官方规格或一次真实启动日志的可用显存行来定死。教程写的「64GB」若是十进制，换算成 59.6 GiB，预算会少 3.7 GiB，落到 KV 上大约是 30 万 token 的容量差。
- 权重的实际加载字节数：量化描述已经固定到下列两个版本；还需实际目录的张量形状、加载后辅助张量清单和启动日志中的权重占用，核齐整卡总账。
- 激活峰值、非 torch 占用和图内存这三个量，只能从启动日志里读。
- 索引器状态组 decode 时占 3–4 块（每个请求常驻 15–16 块）、长 prompt prefill 那一步临时约 n ÷ 4 块，是按滑窗管理器源码推出的，没有实跑确认；推导见 [KV 块分配](vllm-kv-block-allocation.md#开销和什么时候别开)。
- 草稿模型那一侧的 `enforce_eager` 已经能确认是开着的，草稿模型永远走 eager；还没核的是它会不会连带影响主模型的图选择。
- 本配方 `--api-server-count 1` 使用单 API server 分支，在当前启动进程运行前端；headless 端不启动 API server。改为多个前端时，会转入多 API 进程管理分支，需重新核对进程与主机内存开销；本页的设备权重和通信算例仍按单前端配方计算（来源 6）。

### 版本差异

四版社区分支按固定钉点核验：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0`（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；**本文双机 16 卡算例与容量推导固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，两套钉点分开核对。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 模型目录与补丁方式 | 维护分支未含 GLM-5.3-Flash（绑定算例在镜像 `db701c1f`：`models/glm5_next.py` + `patch/platform/`） | 未含 GLM-5.3-Flash 模型文件 | 拆入 `models/glm5next/` 模块目录，使用环形尾状态规格（来源 44–46）[C44] | 延续 `models/glm5next/`，新增 `kda_input_projection_tp.py` 与 `recoverssm_*`（来源 48–50）[C48] |
| 投影融合与量化保护 | 镜像 `db701c1f` 中 KDA 六路独立投影 | — | KDA 合并为 `in_proj_qkvbfg_a`（`kda.py#L171-L185`，权重映射 `model.py#L724-L729`）；MLA 用 `DeepSeekV2FusedQkvAProjLinear` 且 `kv_b_proj` 设 `quant_config=None`（`attention.py#L183-L220`） | `in_proj_qkvbfg_a` 接入细粒度 `qkv_iproj_tensor_parallel_size`（`kda.py#L299-L325`） |
| 活跃教程与 Model Runner | 仅历史教程 `0576b647`（A2 双机混部） | 无 GLM-5.3-Flash 教程 | `GLM5.3-Flash.md` 覆盖 A2 双机混部、4 机 A2 PD、A3/950DT 单机与 PD、DDR KV Pool；显式要求 `VLLM_USE_V2_MODEL_RUNNER=0`（来源 42–43）[S42] | `GLM5.3-Flash.md` 全面切换至 `VLLM_USE_V2_MODEL_RUNNER=1`（MRV2），A3 PD Prefill 启用 `PCP8/TP1` + BF16 SSM 状态（来源 47）[S47] |
| 显存与 KV 块口径 | 仅镜像 `db701c1f` 适用本文 20.58 GiB / 3,855 块算例 | 不适用 | 新 `KVCacheSpec` 与 W8A8C8（`int8`/`fp8` KV）改变每块字节，须按实际 profile 重算 | 同 `v0.30.0`，且 MRV2 改变持久输入与图缓冲开销 |

- 控制流按 `vllm@0fc695fc` 读：rank 分配、DP 组与 EP 组的构造、`launch_core_engines` 与 headless 入口、`_initialize_kv_caches` 都在这一版。
- 执行侧按 `vllm-ascend@db701c1f` 读，这是官方镜像里跑的那一版。GLM 的实现在 `vllm_ascend/models/glm5_next.py` 和 `glm5_next_mtp.py`。块大小和 KV 分组被 `vllm_ascend/patch/platform/` 下的补丁改写过；prefix caching 开不开沿用上游的判定，补丁只是读这个开关，据此决定 KDA 块大小和要不要做细粒度哈希。

### 源码位置

| 想核对的事 | 读哪里 |
| --- | --- |
| 全局 rank = DP 组号 × 8 + 本机卡号，TP/DP/EP 成员与 Ascend MC2 组 | `vllm/distributed/parallel_state.py`（L1535–L1560、L1758–L1888）；`vllm_ascend/distributed/parallel_state.py`（来源 2–4）[C2] |
| 机器 0 启动与 DP 协调器、机器 1 headless 入口、Worker 派生与 HCCL 建组 | `vllm/v1/engine/utils.py`、`vllm/entrypoints/cli/serve.py`、`vllm/v1/executor/multiproc_executor.py`、`vllm_ascend/worker/worker.py` L975–L988（来源 5–8）[C5] |
| `--quantization ascend` 注入与逐层精度分派 | `vllm_ascend/platform.py`、`vllm_ascend/quantization/modelslim_config.py`（来源 9–10）[C10] |
| 量显存、切 KV 块、640 逻辑块补丁与 5 组 KV 切分 | `vllm/v1/engine/core.py` L236–L317、`vllm_ascend/worker/worker.py` L527–L597、`patch/platform/patch_mamba_config.py`、`patch_kv_cache_utils.py`（来源 11–14）[C13] |
| warmup 与图捕获、MLA `fused_qkv_a_proj` 关 TP、MTP 第 45 层构造 | `vllm_ascend/worker/worker.py` L693–L784、`models/glm5_next.py` L1880–L1930、`models/glm5_next_mtp.py` L39–L92（来源 15–17）[C16] |
| A2 选 MC2 三条件（EP ≥16、每卡专家 ≤24、token ≤ 128）、hybrid 关 prefix caching | `vllm_ascend/ascend_forward_context.py`、`vllm/config/model.py`（来源 18–19）[C18] |
| 空闲 DP 组陪跑、两组步内对齐、草稿层 KV 校验与前端 DP 选组 | `vllm/v1/engine/core.py` L1869–L1945、`worker/model_runner_v1.py` L692–L740、`spec_decode/llm_base_proposer.py`、`vllm/v1/engine/core_client.py`（来源 20–23）[C20] |
| `v0.30.0` / `main` 活跃食谱与 `models/glm5next/` 投影融合 | `c09d3e20`：`GLM5.3-Flash.md#L15-L45`、`#L305-L420`、`glm5next/kda.py#L171-L185`、`attention.py#L183-L220`、`model.py#L724-L729`；`8d6180e2`：`GLM5.3-Flash.md#L1-L45`、`glm5next/kda.py#L299-L325`、`kda_input_projection_tp.py#L18-L45`、`model.py#L815-L820`（来源 42–50） |

量化子账的版本证据是来源 32、33 的两份固定 `quant_model_description.json`；来源 34 的模型配置与 9e55cbc8 的配置逐字相同。来源 35、38–40 给出视觉线性层、卷积、归一化及偏置的构造，来源 41 固定默认 weights 模式；来源 36、37 共同说明视觉塔的创建与跳过条件。MTP 旋转矩阵的开关和形状在来源 17 的第 46–63 行。FLOAT 表示不量化，具体驻留精度还要按配置和模块实现判断。

上表的块大小补丁（来源 13，db701c1f 的第 153–166 行）中，GLM-5 Next 专属分支在当前 block_size 与计算出的 attn_block_size 不同时覆写前者，使连续的 MLA 页覆盖完整 KDA 状态；这是相等性检查，不只是“设置过小才改”。其他模型有自己的分支，不能由此推断它们绝不调整块大小。

上表的模型初始化（来源 16，db701c1f 的第 1909–1911 行）另有头数约束：AscendGlm5NextMLAAttention 要求 attention 头数能被 TP 规模整除，否则触发断言；成立后，每卡头数才按总头数除以 TP 计算。
