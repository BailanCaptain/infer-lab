---
id: kv-cache
title: "KV cache：新 token 留下历史，下一步接着读"
type: concept
summary: KV cache 保存每一层为已处理位置算好的状态：新 token 只算自己这一份并追加进去，下一步直接读取，不再重算旧位置；代价是占显存、每步要读。GLM-5.3-Flash 的 12 层 MLA 按位置存压缩潜向量和 indexer K（每 token 每卡 13,056 B），34 层 KDA 按请求存固定大小的状态；缓存池按 640 个 token 的逻辑块分配。
aliases: [KV Cache, KV 缓存, 推理缓存, 历史状态, 键值缓存, kv cache, KV 显存]
chapters: ["04", "05", "11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L198-L269
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3916-L3952
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L500-L560
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L405-L456
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L228
  - vllm@0fc695fc:vllm/config/model.py#L1851-L1857
  - vllm@568afb3a:vllm/engine/arg_utils.py#L2515-L2553
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2773-L2808
  - vllm@84030bbe:vllm/config/model.py#L2135-L2151
  - https://arxiv.org/html/2309.06180v1
  - https://arxiv.org/html/2405.04434v5
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L182-L229
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py#L119-L125
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2489-L2509
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L88-L160
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L130-L146
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L125
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1430-L1454
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1529-L1534
  - vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L47-L52
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L489-L499
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L183-L200
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4927-L4938
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3932-L3935
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1553-L1570
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1124-L1141
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5142-L5152
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L40
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L102-L111
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L58-L107
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L58-L107
verified: []
evidence: "C"
relations:
  - { to: attention-qkv, kind: builds-on, note: 缓存里存的就是那一页讲的 K 和 V；Q、K、V 各做什么、因果掩码为什么让旧 K/V 不变，本页不重讲 }
  - { to: prefill, kind: builds-on, note: 在多轮前向之间复用已计算状态 }
  - { to: mla, kind: builds-on, note: 潜向量保存按位置访问的历史 }
  - { to: linear-attention, kind: builds-on, note: 递推与卷积状态保存不同形式的历史 }
  - { to: one-request, kind: builds-on, note: 回到 A2 分配缓存与 A6 更新有效进度的请求循环 }
  - { to: glm-5-3-flash-two-node, kind: builds-on, note: 每块字节数与显存预算只在部署页推导 }
  - { to: gqa, kind: builds-on, note: 普通注意力每 token 每层的缓存按 KV 头数计，GQA 减少 KV 头省的就是这份 }
  - { to: rope, kind: builds-on, note: 普通注意力存进缓存的 K 已按位置旋转；GLM 的 MLA 与 indexer 不带 RoPE 段 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 已经算过的历史，下一步还要重算吗？

**KV cache 是模型每一层为已经处理过的位置留下的中间结果：生成下一个 token 时直接读它，不必把旧位置重新过一遍模型。** token 是分词后的一个输入位置。普通注意力里，每个位置在每一层算出三样东西：Q（query，查询）由当前位置拿去和历史比对，K（key，键）供之后的查询打分，V（value，值）按分数被加权汇合成输出；三者怎样配合见[注意力：Q、K、V](attention-qkv.md)。KV cache 存的就是各层各位置的 K 和 V。

```wiki-diagram
file: kv-cache
```

图里是同一层在相邻两步的样子。第 t 步只有位置 4 是新来的：模型只为它算出 q₄、k₄、v₄，把 k₄、v₄ 追加到缓存末尾，再用 q₄ 读取 1–4 列算注意力。第 t+1 步的新输入是位置 5，同样只算一列、追加一列，前 4 列原样读出，不再重算。

**只存 K 和 V、不存 Q，是因为它们的使用期限不同。** 查询只来自本步的新位置，q₄ 在第 t 步用完就不再需要；k₄、v₄ 却要被之后每一步的查询读到。[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)让每个位置只能看到自己和之前的位置，后来的 token 改变不了旧位置的 K、V，所以读缓存和每步重算得到的是同一组数。

**GLM-5.3-Flash 的历史不止 K/V 一种形式。** MLA 层（Multi-head Latent Attention，把 K、V 联合压缩成一条较短潜向量的注意力）仍按位置追加，只是每个位置存的是潜向量；同一层里的 indexer（给历史位置打分、挑出值得读的位置的小模块）还为每 4 个位置留一条 K 摘要。KDA 层（Kimi Delta Attention，一种线性注意力）不按位置存，而是把全部历史汇总成固定形状的矩阵状态，每步原地更新。框架把这些状态统称为 KV cache，放进同一个缓存池管理，[后文](#混合模型到底要保留哪几类状态)逐类给出每份多大。

## 省了重算，要付什么代价？

**缓存把「每步重算整段」变成「每步只算新位置」，省下的计算随输出长度按平方增长。** 以主线的[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署) 为底：prompt（提示词）4 个 token，[收尾一站](one-request.md#第-7-站-返回与收尾)设定最多生成 200 个 token。R1 实际开着 MTP（模型自带的草稿层，先猜几个 token 再交主模型验证），这里先把它当作普通逐 token 生成，只数有多少个位置要经过一次前向：

```calc
title: 普通生成 200 个输出，前向要处理多少个位置
不缓存 = 200 × 4 + (0 + 1 + … + 199) = 800 + 19,900 = 20,700 个位置
> 第 k 步把前 4 + (k − 1) 个位置整段重算一遍
缓存 = 4 + 199 = 203 个位置
> 首步处理 4 个 prompt 位置，之后 199 步各只处理上一步的输出
比值 = 20,700 ÷ 203 ≈ 102 倍
```

102 倍是经过前向的位置次数之比，不是加速比：各步可见的历史长度、矩阵形状、访存量和算子利用率都不同。第 200 个输出不再作为输入，所以是 199 步而不是 200 步，这个差别[后面](#已生成的-token为何还可能没有自己的缓存)还会用到。

**代价一：历史要一直占着显存。** 固定 GLM 部署里，按位置增长的部分（主干 11 层加 MTP 1 层，共 12 层 MLA 的潜向量和 indexer K）每个 token 在每张卡上占 **13,056 B（12.75 KiB）**，推导见[部署页的块字节](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)；一条 133,120 token 的满长请求，这部分每卡约 **1.619 GiB**。KDA 状态与长度无关，每条请求每卡固定约 **85 MiB**。能分给缓存的显存是启动时从预算里扣掉权重和激活峰值后切出来的，见[部署页的缓存预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；请求越长、并发越多，这份空间就越早用完。

**代价二：省掉的是计算，不是读取。** 普通稠密注意力每步都要把可见的全部 K/V 读一遍，历史越长读得越多。GLM 的稀疏 MLA 先由 indexer 给历史打分，每个查询位置最多读 2,051 个历史位置（选中的 512 个池展开成 2,048 个，加最多 3 个没凑满一池的最新位置），满长时约为全部历史的 1/65；R1 开着 MTP，一步有 4 个查询位置，这个上限按每个查询位置分别计，细节见 [MLA](mla.md#稀疏选择是压缩之上的另一层机制)；indexer 自己仍要扫过全部池 K，只是每条只有 256 B。KDA 每步读写的是固定大小的状态，读取量不随历史变长。

**代价三：空间要有人管。** 缓存池要分块、记地址、记每条请求算到了哪里，容量不足时还要让请求等待或被抢占。

相邻的三个概念各管一件事：**KV cache 是保存的内容；block table 是把请求内的逻辑位置映射到缓存池块号的地址表；prefix caching 是把匹配的历史借给另一条请求的复用机制。** 关闭跨请求的 prefix caching，同一请求仍会在 decode（接着历史逐步生成输出）中读取自己的缓存。围绕缓存的后续问题各有一页：启动时能切出多少块见 [KV cache 显存预算](kv-cache-memory-profiling.md)，每块多少字节见[缓存规格](kv-cache-spec.md)，卡外存放前缀见 [KV Pool](kv-pool.md)，用更小的数值格式见 [KV cache 量化](kv-cache-quantization.md)，挪到 CPU 见 [KV cache CPU 卸载](kv-cache-cpu-offload.md)，不同注意力结构每 token 存多少见[四种注意力的代价](attention-cost.md)。

## 放到 GLM 双机：一个新 token 怎样接上历史？

本页挂靠[主线 A2：调度与分配](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)，并在[主线 A6：结果更新](one-request.md#第-6-站-结果更新接受几个候选回退几格)闭合下一步。下面跟着 R1（prompt 4 个 token，开着 MTP）走一步。固定部署的 TP8 让机内 8 卡合算一层，DP2 把请求分给两台机器各自的执行组，EP16 把专家分布到全部 16 卡；完整配置只在[部署前提](glm-5-3-flash-two-node.md#部署前提)列出。

### 先拿到块号，才有地方写

**A2 分的是空间，A4 前向才往里写内容。** EngineCore 是管理请求的引擎进程，它的调度器记录每条请求算到了哪里，再由缓存管理器从块池里取出空闲的块号分给请求。Worker 是每张卡上执行模型的进程，它在启动时就把整份缓存预算建成设备上的缓存张量；之后每一步只是按块号和块内偏移算出槽位（slot，缓存里具体写哪一格），把新状态写进去，不再临时申请显存。

**块有两种尺度：调度器按 640 个 token 的逻辑块分配，稀疏注意力的算子按 128 个 token 的 kernel 块读取，1 个逻辑块正好是 5 个 kernel 块。** 一个块号在每一层对应一段显存，叫一页（物理页）。逻辑块取 640，是为了让一个 MLA 页装得下一整份 KDA 状态，两类层就能共用同样大小的物理页；同时它必须是 128 的整数倍，推导见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。Worker 在 block table 里把一个 640 的块号看成 5 个连续的 128 块交给算子，见[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)与[块表](block-table.md#分配块与内核页可能不同)。按主线算例，每张卡的缓存显存切成 **3,855 块**，每块约 7.969 MiB，两个数都在[部署页](glm-5-3-flash-two-node.md#两种块数各在什么时候用)推导；块号由 R1 所在 DP rank（也就是本机）的引擎分配，同一个块号在机内 8 张卡上各指向自己的那一块。

R1 首步处理 4 个 prompt 位置，另外为 MTP 的 3 个候选预留位置；此时有了空间，不表示候选已经写入或被接受。主线算得 **5 个缓存组共申请 15 个块号，每卡约占 119.5 MiB**，分组与分配推导见 [A2 原账](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。其中 KDA 状态组就占 12 个块号，所以短 prompt 的占用也远大于有效历史数据。

### 新 token 到每一层，各自读写本层历史

**同一个 token 在不同层留下不同的状态，下一步必须接回对应层的历史。** R1 分在 DP0，它的缓存只由 DP0 那台机器的 8 个 Worker 持有。MLA 的潜向量在机内 TP8（8 张卡合算一层）之间复制，每张卡存完整的一份；KDA 按注意力头切分，每卡只存自己负责的 8 个头的状态，切法见[张量并行](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)。另一台机器在 MoE（混合专家）层替 R1 算它选中的专家时，收到的是这一层的输入、交回的是结果，拿不到 R1 的历史缓存。

走到 MLA 层，新位置留下一条 512 维 BF16 潜向量；BF16 每个数占 2 B，所以每位置每层 **1,024 B**。本配置的潜向量不带单独的 RoPE 段，见 [MLA](mla.md#glm-的这一配置不保存-rope-段)。indexer 先把新位置的 128 维 K 和压池门控分数写进尾状态（FP32，32 位浮点）；凑满 4 个位置，就按门控把它们加权合成一条 128 维的池 K，转成 BF16 写进 indexer 缓存，每条 **256 B**，折合每位置每层 64 B。这里的「池」（kpool）指 indexer 合并的 4 个相邻位置，和管理空闲显存块的缓存池不是一回事。

**写缓存是卡内读写，不需要卡间通信。** 生成潜向量的压缩投影在 TP 组内不切，每张卡用同一份输入各自算出完整的潜向量，直接写进本卡缓存；indexer 的 K 也是每张卡各算一遍。注意力输出投影之后的那次 All-Reduce（各卡部分结果按位置相加）属于[层计算](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)，与是否跨步保存历史分开记账。

走到 KDA 层，新输入先与卷积状态里的最近几个位置做短卷积，再用 delta 规则（按「新值与矩阵当前读出值之差」修正矩阵）更新汇总历史的矩阵，读写完原地保存供下一步继续，见[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)。有效状态的形状不随历史长度增长；投机验证还要为候选边界多留空间。本层输出随后进入下一层；层间传递的[隐藏向量与四路残差](layers-and-hidden.md#本轮-hidden历史状态和权重各管什么)只活在这一次前向里，缓存不保存它们。

### 结果返回后，哪些状态可以算作有效？

**A6 更新已计算进度和确定的输出，候选写过缓存不等于被接受。** 主模型验证 MTP 候选后，引擎按拒绝数量把「已计算」计数往回退。MLA 缓存里被拒候选写下的格子不用清：进度退回后，下一步会在同样的位置写入新值把它覆盖。KDA 状态没法这样回退，所以才为候选多留几页：下一步按接受数量选出对应的那一份状态接着算，卷积窗口也按接受数量对齐。请求结束时归还的是块号的引用，设备上的缓存张量一直保留，块号回到空闲队列后给后来的请求用。

下面的流程图把进程边界与模型分支串起来，各步在页末对应到源码。“返回 A2”表示下一次调度继续读取这次留下的有效历史。

```wiki-diagram
file: kv-cache-lifecycle
```

**配置描述容量、类型与开关，patch 调整配置规则或替换实现，二者都不持有某条请求的历史数据。** CPU 侧维护分配与进度，设备侧保存并读写数值张量。完整进程链见[请求调用链](request-call-chain.md)，配置和补丁的生效顺序分别见[配置系统](ascend-config-system.md)与[patch 系统](ascend-patch-system.md)。

## 混合模型到底要保留哪几类状态？

**GLM 主干 45 层里，34 层 KDA 按请求存固定大小的状态，11 层稀疏 MLA 按位置存历史；接在主干（层号 0–44）之后的 MTP 层（层号 45）也是一层带 indexer 的 MLA，所以按位置增长的缓存共 12 层。** 下表是本部署每张卡上每类状态的大小；KDA 两份状态的形状推导见[一条请求的 KDA 一节](one-request.md#34-层-kda)。

| 对象 | 在哪些层 | 保存什么 | 每卡大小 |
|---|---|---|---|
| MLA 潜向量 | 12 层 MLA | 每个位置一条 512 维潜向量，BF16 | 1,024 B / token / 层，随长度增长 |
| indexer 缓存 | 同上 | 每 4 个位置合成一条 128 维池 K，BF16 | 256 B / 池，折合 64 B / token / 层 |
| indexer 尾状态 | 同上 | 还没凑满一池的最近位置各自的 K 与门控分数，FP32 | 4,096 B / 请求 / 层，不随长度增长 |
| KDA 递推状态 | 34 层 KDA | 本卡 8 个头各一个 128×128 矩阵，FP32 | 524,288 B / 请求 / 层 |
| KDA 卷积状态 | 同上 | 短卷积要用的最近 3 个位置，外加 3 个候选槽位，BF16 | 36,864 B / 请求 / 层 |

**按位置增长的只有前两行。** 12 层合计每 token 每卡 13,056 B，一个 640 格的块号装满就是 8,355,840 B，推导都在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。后三行按请求计：12 层尾状态一份有效容量合计 48 KiB（分配器按 4 个 token 一块给它块号，R1 首步拿到 2 块）；KDA 两份合计每层 561,152 B，34 层一份有效状态约 18.2 MiB。

**KDA 实际占的比有效状态多。** 每份状态要补齐到和 MLA 页一样大的 655,360 B，才能与 MLA 共用同样大小的物理页；再为 MTP 的 3 个候选各多留一页，每层每请求共 4 页，34 层合计约 **85 MiB/请求/卡**。这相当于约 6,827 个 token 的按位置历史，所以短请求里 KDA 状态反而是大头。

调度器把这些状态分成 **5 个缓存组**分配：MLA 潜向量与 indexer 缓存同属 full 组，按 640 个 token 一块；34 层 KDA 分成 3 组，每组每请求 4 块；indexer 尾状态单独一组，按 4 个 token 一块，随最新位置向前滑动。MLA 与 indexer 缓存保存按位置查找的历史；尾状态和 KDA 状态描述「算到这里时」接着算所需的条件。只留 MLA 潜向量接不上一条请求：indexer 历史、没凑满的池和 KDA 状态必须停在同一个有效边界上，这也是跨请求复用这类模型更难的原因。规格与缓存组见[缓存规格](kv-cache-spec.md)，稀疏读取见 [MLA](mla.md)，递推细节见[线性注意力](linear-attention.md)。

### 对照：普通注意力只存一类状态，少数模型还跨层共用

**普通注意力每层只存一类状态：K 一份、V 一份。** 这是 GLM 之外常见的做法，例如用 [GQA](gqa.md) 的模型。启动时 Worker 为每一层建好缓存张量，形状是「K、V 两份 × 块数 × 每块 token 数 × 本卡 KV 头数 × 每头维度」。每步前向里，这一层先为新位置算出 k、v，按调度给出的槽位写进对应格子，再在同一次前向里读取可见历史算注意力。每个 token 每层占「2 × 本卡 KV 头数 × 每头维度 × 每个数的字节数」：KV 头越少越省，GQA 让几个查询头共用一组 KV 头，省的正是这一份，见 [GQA 的缓存容量](gqa.md#缓存容量按-kv-头数计算)。存进去的 K 已经按位置做过 [RoPE](rope.md#rope-的位置与缓存地址不同) 旋转，V 原样保存，读出来直接能用，不必每步重转；GLM 的 MLA 潜向量和 indexer K 都不带 RoPE 段，没有这一步。

**少数模型让后面某一层直接用前面某一层的 K/V，这叫跨层共享（cross-layer KV sharing）。** 声明了共享目标的层不建自己的缓存，缓存管理器把它当作不存在；前向时它读目标层那一份，按设计不再写入。同样多的显存因此能放更长的历史或更多请求。Ascend 从 v0.26 起才在写入函数里显式跳过共享层，差别见[版本差异](#版本差异)。

**GLM 双机部署用不到这两条。** GLM 的 12 层 MLA 用模型自带的缓存层，写潜向量、indexer 缓存和尾状态三份，走 GLM 专用的稀疏注意力后端；34 层 KDA 写递推状态和卷积状态。两类层都不经过普通注意力的写入路径，也都没有声明跨层共享：主干 45 层加 MTP 1 层，各存各的状态。对应源码见[源码位置](#源码位置)。

## 有效数据增长，为什么远小于显存占用？

**新写进多少有效历史、原地改写多少状态、占住多少空间，要分开数。** R1 首步 4 个位置，主干 11 层写进 MLA 潜向量和 indexer 缓存共 **47,872 B（约 46.8 KiB）**；MTP 层在[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)草拟第 1 遍时，为这 4 个位置再写 4,352 B，12 层合计 **52,224 B（约 51 KiB）**，推导见[一次前向的账](one-request.md#一次前向的通信账)。MTP 后两遍草拟怎样执行，也在第 5 站。

同一步里 KDA 和 indexer 尾状态被原地改写：34 层各更新 561,152 B 有效数据，12 层尾状态各更新 4,096 B。**容量不增长，不等于没有写内存。**

**占住的空间远大于写进去的数据。** R1 首步已经拿到 15 个块号、每卡约 119.5 MiB，而 full 组那个 640 格的块只用了 4 格，利用率约 0.6%。所以 51 KiB 既不是这一步的全部写入流量，也不是 R1 占的显存。再看满长请求：133,120 个 token 要 208 个 full 组块号，连同 KDA 等状态组约 222 个、每卡约 1.728 GiB；按 3,855 块的算例，同时最多放 17 条这样的请求。3,855 块是示例口径，用精确权重算是 3,908 块，两者的适用条件见[部署页](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。请求数、历史长度、候选预留和页内空白一起决定能同时接多少请求。

## 已生成的 token，为何还可能没有自己的缓存？

**普通逐 token 生成里，一个 token 先被采样出来，要到下一步作为输入时才在各层留下自己的状态。** 采样是从模型给出的词表分数里选出输出 token。处理完 prompt 的那一步就能采样出第一个输出，不必把它再送进模型；此后每个输出都要等下一步当输入，才写进缓存。

回到前面普通生成 200 个输出的例子：第 200 个输出来自第 199 个输出那一步的词表分数，生成到这里就结束，不再进入下一步。所以经过前向、在缓存里有状态的位置是 **203 个**，而文本已经有 **204 个** token。

R1 实际开着 MTP，走的是[验证候选的循环](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)：每圈把上一圈确定的 1 个 token 和 3 个候选一起送进前向，被拒的候选留下的状态随后被覆盖或弃用。分块处理 prompt（chunked prefill；prefill 指一次处理整段 prompt 的那一步）和 prefix caching 命中也会改变「文本长度」与「已计算位置」的差。所以调度器要分别记住**文本已有多少、模型算到了哪里、哪些候选有效、空间预留到哪里**；分配量可以大于有效状态，后续细节见[缓存块分配](vllm-kv-block-allocation.md)。

## 常见误解

- **“KV cache 是为了省显存。”** 反了：它是拿显存换计算，多占显存，换来每步只算新位置。量化、卸载这些手段才是在缓存已经占了显存之后，想办法少占一点。
- **“KV cache 总是两份完整 K/V。”** 普通注意力按位置保存 K/V；MLA 存压缩后的潜向量，KDA 保存递推与卷积状态。先看模型每层是哪种注意力，再看实际缓存对象。
- **“缓存的是 token 编号或 embedding。”** 缓存的是每一层注意力算出来的中间量，和输入的 token 编号、embedding（把 token 编号换成向量的查表结果）都不是一回事。GLM 里同一个 token 在 12 层 MLA 各留一条互不相同的潜向量，在 34 层 KDA 则融进各层的状态，不再单独可查。
- **“模型有几层，每个 token 就存几层。”** GLM 主干 45 层里只有 11 层（加 MTP 的 1 层）按位置存；34 层 KDA 的状态与历史长度无关。
- **“TP 卡数翻倍，每卡缓存就减半。”** 本部署的 MLA 潜向量在 TP 内复制，KDA 按头切分。权重、查询头和历史状态的切分规则应分别核对。
- **“缓存让后续生成不用读旧内容。”** 缓存让旧状态可直接读取，省的是重算；普通、稀疏和递推注意力每步读取的范围不同。
- **“开了缓存，结果会和重算不一样。”** 数学上等价：缓存里的数就是不缓存时每步会重算出来的那些数。实现上 prefill 与 decode 可以走不同算子（例如 KDA 的分块算法与逐 token 递推），浮点累加顺序不同会带来微小的数值差异；个别情况下，这点差异会让后面某一步采样出不同的 token，之后的文本随之分叉。原因是计算顺序，不是缓存丢了信息，怎样判断和固定计算路径见[批不变性](batch-invariance.md#批的变化怎样影响数值)。
- **“文本以前出现过，以后必然命中。”** 跨请求共享还需要匹配模型输入身份、缓存仍驻留，以及所有状态能从相同边界恢复。关闭 prefix caching 或请求要求跳过读取时，查询直接未命中，详见[prefix caching](prefix-caching.md)。
- **“请求结束就是清空设备缓存池。”** 结束后释放请求的引用；能否留作前缀复用由缓存策略决定。容量紧张时可以淘汰可复用状态、抢占后重算，或在支持并启用时使用[卸载](kv-cache-cpu-offload.md)。分页地址与共享引用见[block table](block-table.md)。

## 对照源码

### 怎么开

正常生成路径自动维护请求自己的历史，不需要任何开关。`--enable-prefix-caching` 控制跨请求复用；`--kv-cache-dtype` 描述缓存精度选择，不能仅凭 W8A8 权重量化推断历史也是 INT8。固定 GLM 实现把 MLA 主缓存写死为 BF16（`IndexerKPoolMLACacheLayer` 里 `self.kv_cache_dtype = "bfloat16"`），indexer 尾状态要求 FP32。

逻辑块大小同样不用手动设：官方教程没有 `--block-size`，GLM 补丁在配置阶段把 `cache_config.block_size` 改成 640，启动日志出现 `Setting GLM-5 logical attention block size to 640 tokens so the contiguous MLA page covers the complete KDA state.` 即说明生效。手动给出比 640 小的值会被抬回 640，更大的值按 128 向上取整后保留。

本文数值沿用控制流 `vllm@0fc695fc` 与 GLM 执行侧 `vllm-ascend@db701c1f`。该上游钉点对 hybrid 生成模型默认关闭 prefix caching；模型专用补丁据有效开关和 Mamba 缓存模式确定状态块跨度。镜像最终安装的上游提交仍按[来源基线](../sources/glm-5-3-flash-baseline.md)待核，现场应保存启动后的有效配置。

### 会报什么错

`GLM-5 Indexer KPool MLA requires cache_config.` 表示缺少模型缓存配置。`Indexer KPool MLA metadata roles must match cache order` 表示传入元数据与三份物理缓存的角色顺序不一致；生产路径还校验缓存数量、BF16 类型及潜向量维度。KDA 则会检查序列边界、状态索引与初始状态标记是否描述相同的请求数。`GLM-5 logical block size must be divisible by the SFA kernel block size: logical=…, kernel=128.` 表示逻辑块不是 kernel 块 128 的整数倍；经补丁取整的正常路径不会出现，出现时先查是否有别的补丁或配置绕过了取整。遇到这些错误先核查配置和状态映射，不能只靠扩大显存预算解决。

### 开销和什么时候别开

同请求缓存是本页生成循环的基础；需要判断收益的是跨请求复用、卸载或额外候选预留。prefix caching 适合有重复前缀且状态可恢复的负载；卸载用搬运成本换显存；投机预留用更多状态空间换可能的多 token 接受。实际吞吐收益需测量命中率、接受率、访问流量和等待时间。

`--block-size` 调得比 640 大没有好处，理由和 KDA 页补齐的账见 [KV cache 规格](kv-cache-spec.md#开销和什么时候别开)。

### 版本差异

三版都维护正常生成时的历史缓存；区别在 hybrid 模型的跨请求复用默认值、普通注意力共享层的写入检查，以及 GLM-5.3-Flash 专用缓存路径在哪一版存在。按知识库固定快照核对：v0.23 维护分支为 Ascend 2c59ff10 / vLLM 0fc695fc；v0.26 指 2026-09-17 的 rc 分支快照 Ascend 2ed6cbba / vLLM 568afb3a；main 为 Ascend baa023ad / vLLM 84030bbe。**本页 GLM 数字取自专用镜像的 Ascend db701c1f（控制流仍按 vLLM 0fc695fc），它和 v0.23 维护分支不是同一提交，表中凡涉及 db701c1f 都单独写明。**

| 项目 | v0.23 | v0.26 | main | 对使用者意味着什么 |
|---|---|---|---|---|
| 同请求跨步保存历史 | 有，生成时使用 | 有，生成时使用 | 有，生成时使用 | 与 prefix caching 开关分开理解 |
| hybrid 的 prefix caching | 支持检查返回假，默认关 | 支持，但刻意默认关，需主动开启 | 支持，未显式设置时默认开 | 升级后状态对齐与容量账随之改变 |
| 普通注意力缓存形状 | (2, 块数, 每块 token 数, KV 头数, 每头维度) | 相同 | 默认相同；环境变量 VLLM_KV_CACHE_LAYOUT 取 LBHNC 或 HND 时，KV 头数移到每块 token 数之前 | 布局可换，每块字节数不变 |
| 普通注意力写缓存 | forward 里调用 reshape_and_cache，按槽位写入本步的 K、V | 相同 | 相同 | 写入与读取在同一次前向里完成 |
| 跨层共享 | 共享层不生成缓存规格，建张量后直接指向目标层那一份；写入函数本身不检查共享 | 规格与绑定相同；写入前检查，共享层直接返回、不写 | 同 v0.26 | 只影响声明了共享的模型，GLM 不涉及 |
| GLM-5.3-Flash 缓存路径（本页五类状态、15 块） | 2c59ff10 没有 glm5_next；本页数字取自专用 db701c1f 的 glm5_next、indexer_kpool_mla、kimi_kda | 2ed6cbba 没有 GLM-5.3-Flash 模型代码，本页 GLM 数字不适用 | 迁到 models/glm5next/，状态规格未逐项核对 | 复用本页数字前先确认实际安装的是哪份代码 |

逻辑块 640 在三版里各按什么算法定、启动日志文案怎样区分三套实现，见 [KV cache 规格的版本差异](kv-cache-spec.md#版本差异)。

GLM 代码在哪一版存在，是用 `git -C tools/repos/vllm-ascend ls-tree -r --name-only <提交> | grep -i glm` 逐版查的（2026-09-28）。2c59ff10 与 2ed6cbba 在 vllm_ascend/ 下只列出 GLM 工具调用或推理用量的补丁，教程只有 GLM4.x、GLM5、GLM5.2，没有 glm5_next / glm5next 模型文件，也没有 GLM5.3-Flash 教程；2ed6cbba 虽已带 ops/kimi_kda.py、attention/indexer.py 和通用 hybrid 对齐（两版对齐代码见 sources 40–41），但没有组装成这个模型。baa023ad 才出现 models/glm5next/ 目录和 GLM5.3-Flash 教程。

### 源码位置

按功能对照 sources 的编号，可把流程图读成实际代码：

- **声明对象与形状**：sources 1–3、22–23 的主缓存规格、独立索引与尾状态、KDA 形状及精度；尾状态是一页中的滑动窗口，不是按绝对位置取模的环形数组。[C1][C2][C3][C22][C23]
- **实际读写**：sources 4、6、7、10；KDA 从所选状态读取并写回，投机分支传入接受数量；MLA 三种角色按 `("kv", "indexer_state", "indexer")` 的顺序接入后走生产稀疏 attention 设备算子，不以单测的 PyTorch 参考实现代替生产路径。[C4][C6][C7][C10]
- **分配与进度**：sources 5、8、9、11；`allocate_slots` 为新增与候选位置保留空间，`initialize_kv_cache_tensors` 创建并绑定设备缓存，`update_from_output` 回退拒绝的候选计数，MTP 的独立缓存层必须纳入缓存组。[C5][C8][C9][C11]
- **逻辑块与 kernel 块**：source 24 的 `min_attn_block_size = 128 × cdiv(mamba_raw_size, 128 × attn_token_page_size)` 定出 640 并写回 `cache_config.block_size`，同段打印启动日志；source 25 校验逻辑块能被 `GLM5_SFA_KERNEL_BLOCK_SIZE` 整除，并算出 `kernel_blocks_per_logical_block = 640 // 128 = 5`；source 26 是 main 的 lcm 对齐版本。[C24][C25][C26]
- **配置与版本**：sources 12–16；patch 更新状态块跨度，上游依模型类型与版本决定 prefix caching 默认值；source 21 对应 main 的模型目录迁移。[C12][C13][C14][C15][C16][C21]
- **普通注意力（非 GLM）的形状与写入**：v0.23 维护分支 `vllm_ascend/attention/attention_v1.py` 的 `get_kv_cache_shape` 返回 `(2, num_blocks, block_size, num_kv_heads, head_size)`（source 27），main 在 `VLLM_KV_CACHE_LAYOUT` 取 `LBHNC` / `HND` 时换成 `(2, num_blocks, num_kv_heads, block_size, head_size)`（source 39）。Ascend 普通注意力后端沿用上游默认 `forward_includes_kv_cache_update = True`，所以上游 `Attention.forward` 不另走 `unified_kv_cache_update`（source 31 的判断）；写入发生在后端自己的 `forward` 里：它调用同文件的 `reshape_and_cache`，把本步 `key`、`value` 按 `attn_metadata.slot_mapping` 交给 `DeviceOperator.reshape_and_cache`，底层是 `torch_npu._npu_reshape_and_cache`（sources 28–30）。同文件的 `do_kv_cache_update` 是上游独立写入入口的实现，主路径不经过它，vllm_ascend 里只有 Qwen3 DFlash 补丁直接调用。每块字节数是上游 `real_page_size_bytes` 的 `2 × block_size × num_kv_heads × head_size × dtype 字节数`（source 32）。
- **跨层共享**：上游 `Attention` 声明了 `kv_sharing_target_layer_name` 的层，在独立写入入口被跳过（source 31）；Ascend model runner 的 `get_kv_cache_spec` 不为这类层生成 `KVCacheSpec`，`initialize_kv_cache_tensors` 建好张量后执行 `kv_caches[layer_name] = kv_caches[target_layer_name]`（sources 33–34）。v0.26 与 main 的 `reshape_and_cache` 在写入前检查共享并直接返回，注释说明是为了不覆盖共享的格子（sources 35–36）；v0.23 维护分支的同名函数没有这项检查。GLM 的 MLA 缓存层 `IndexerKPoolMLACacheLayer` 继承 `AttentionLayerBase` 而不是上游 `Attention`，构造后端时显式传 `kv_sharing_target_layer_name=None`（sources 38、1），db701c1f 运行器的共享判断要求 `isinstance(attn_module, Attention)`，不会命中（source 37）。
- **普通 KV cache、分页与共享原理**：[PagedAttention 论文](https://arxiv.org/html/2309.06180v1) §2.2、§4.1–4.3 说明历史复用、逻辑块到物理块映射及按需分配；本页普通生成变体的位置数依据其逐步生成语义推演。[S17][A][D]
- **MLA 的压缩对象**：[DeepSeek-V2 论文](https://arxiv.org/html/2405.04434v5) §2.1 将 K/V 联合压缩为潜向量；GLM 的维度、索引器与 KDA 组合另由本页专用源码确定。[S18]
- **模型与部署取值**：固定模型配置给出层类型、潜向量和索引维度；官方教程给出双机 TP8/DP2/EP16 与 MTP 候选数。容量结论是这些配置下的静态账，不是硬件流量实测。[S19][S20]

- **每类状态的字节数**：主线底稿逐层前向 §1.4（每卡 KV 与状态账）、§4.5（KDA 状态）、§5.4（kpool 与 top-2048）、§5.6（逻辑块与三份 cache）、§9.3（R1 写入量），以及部署底稿 A2.2（15 块与满长请求 222 块）。本页只引结论，13,056 B/token、每块字节与 3,855 块的推导在[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。[D]

待核：缺少固定镜像的最终上游安装提交、运行时缓存组日志，以及 NPU 上逐次 MTP 写入和 KDA 读写流量记录。main 上逻辑块仍为 640 是按代码静态推算，未在 main 镜像上实跑；「prefill 与 decode 算子的浮点差异可能让采样分叉」是按两条算子路径的累加顺序推断，未做数值对比；v0.23 维护分支的共享层是否真会写入目标层格子，取决于模型是否给共享层传入 K/V，本页只核了写入函数本身。模型配置外链本轮未能联网打开；数字已对照仓库主线底稿及专用源码，仍需部署现场复核。
