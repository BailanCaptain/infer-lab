---
id: kv-cache-sparse-offload
title: "Sparse KV offload：历史放主机，每步只搬这次要读的几行"
type: feature
summary: 主 attention 的完整历史放在主机内存，设备上只留 indexer cache 和一小块热缓冲；每步 sparse attention 选完位置，只把热缓冲里缺的行搬回来。讲清它与 CPU offload、抢占换出在存的对象、粒度、取回条件上的区别，一步里的顺序与代价，以及它只支持 Atlas A3、GLM 双机（A2）为什么用不上。
aliases: [Sparse KV Offload, 稀疏 KV 卸载, sparse_kv_offload, SFA, resident buffer, index_topk]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1466-L1533
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L862-L869
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L284-L311
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5878-L5890
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L196-L224
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L346-L393
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1001-L1156
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1215-L1337
  - vllm-ascend@baa023ad:csrc/torch_binding.cpp#L2266-L2400
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L213-L297
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L107-L140
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L154-L193
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L22
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L211-L282
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1042-L1090
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L618-L636
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L76-L86
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1645-L1663
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L90-L104
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L23-L27
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L42-L50
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L16-L21
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1064-L1078
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware.py#L16-L76
verified: []
evidence: "C"
relations:
  - {to: sparse-attention, kind: builds-on, note: 先看懂每个查询怎样挑出这一步要读的位置}
  - {to: kv-cache, kind: builds-on, note: 分清哪几类状态要保留，才知道搬走的是哪一份}
  - {to: kv-cache-cpu-offload, kind: alternative-to, note: 同样用主机内存，但那边是多存一份副本、按段取回}
  - {to: pd-disaggregation, kind: builds-on, note: 它只能开在 PD 分离的 D 端，先看两端怎样交接历史}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 历史全放在主机内存里，每一步只搬回这次要用的几行？

**Sparse KV offload（稀疏 KV 卸载）把主 attention 的完整历史挪到主机内存，设备上只留一小块热缓冲；每一步选出这次要读的位置之后，只把热缓冲里还没有的那几行搬回设备。**

两个前置词先说清楚。[KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的历史，后面每一步都要回头读它；[sparse attention](sparse-attention.md) 让每个查询先从全部历史里挑出一小部分位置，只在这些位置上打分、汇合，没挑中的位置这一次不参与计算——但仍要留着，下一步还要跟着一起挑。挑位置的是 sparse attention 里一个很轻的打分模块 **indexer**：它给全部历史各打一个分，取分最高的若干个；因为要看全部历史，它自己也存一份 indexer cache，和主 attention 的那份历史是两码事。

稀疏读取留下一个空子：**每一步真正读到的只是历史的一小部分，而全部历史都占着显存。** 稀疏卸载就把这份「读得少、占得多」的历史整个放到主机内存，设备上只按「这一步读到什么」保留。挑哪些位置仍由模型决定，它改的只是这些数据从哪里取。

```wiki-diagram
file: kv-cache-sparse-offload
```

先说结论：钉住版本的这套实现只在 Atlas A3 上初始化，本部署是两台 Atlas 800 A2，**用不上它**；本页把它当变体讲清楚，全部门槛见后面的 GLM 一节。

图里历史有 8 个位置，热缓冲有 4 个槽。这一步选中 2、5、6：2 和 6 上一步搬过、还在槽里，5 不在，于是只有 5 这一行从主机搬回来，装进本步没被选中、又最久没用的那个槽。位置 0 被顶掉，但它在主机那份历史里还在，下一步再被选中就再搬一次。

## 为什么不整层搬回来：decode 一步算得太少

把 KV 放到主机不是新想法，难点在于**什么时候搬**。prefill 一次算一大段，每一层的计算量都够大，可以整层整层地搬，搬运藏在计算后面；decode 一步每条请求只算一两个 token，计算量小到藏不住一整层的搬运，搬运时间会原样加到每一步的时延上。所以这套实现把两头分开：prefill 侧整层搬，decode 侧只搬这一步选中的那几行。

这也决定了它的两条通用前提：**它按 PD 分离设计**——整层搬的那一半在 prefill 实例上，只搬选中行的这一半在 decode 实例上，两者放在同一个实例只剩调试路径；**main 起它只在 Atlas A3 上跑**，别的型号一初始化就报错（v0.26 还不判型号，见[版本差异](#版本差异)）。

搬得少，是因为 sparse attention 已经先挑过一遍。挑完之后还能再省一道：**相邻两步选中的位置常有重合**，上一步搬过的行留在热缓冲里，这一步命中就不用再搬。

代价有四笔：

- **搬运挡在关键路径上。** 每一步都要先查表、再把缺的行搬进设备，attention 才能开算；不像 prefill 那样能和计算重叠。
- **省多少由模型和输入决定。** 相邻两步选中的集合重合得多就搬得少，重合得少就接近全搬，没法预先保证。
- **主机内存要预先开满**：按后面三条上限里最小的那条一次开好，而且是锁页内存（不会被操作系统换出）。
- **多出一块定额显存。** 热缓冲按「一步最多几个查询行 × 每行热槽数」开好，和上下文多长无关，开了就一直占着。

换来的是设备上不再为主 attention 的历史留整份空间。同样是把数据放到主机，站里另外两种做法存的对象、粒度和取回条件都不一样：

| | Sparse KV offload | [KV cache CPU offload](kv-cache-cpu-offload.md) | [抢占卸载](recompute-cpu-offload.md) |
|---|---|---|---|
| 主机上存什么 | 这些层主 attention 的全部历史，**唯一一份** | 前缀段的**副本**，显存里那份照常用 | 被抢占那条请求当时的状态 |
| 设备上还有什么 | indexer cache + 热缓冲；主 KV 不再开空间 | 缓存池照旧 | 该请求的块已全部还回池子 |
| 一次搬多大 | 一行 = 一个位置、一层 | 一段 = 连着的若干页 | 这条请求的全部块 |
| 什么时候搬回 | 每一步，本步选中且不在热缓冲的行 | 开头相同的请求进场时 | 这条请求被重新调度时 |

最容易混的是第一列和第二列：CPU offload 是**多存一份**，显存那份还在，省的是重算；稀疏卸载是**搬走**，设备上根本不为主 KV 开空间，省的是显存。也正因为搬走了，它每一步都必须把这一步要用的行搬回来，不能像 CPU offload 那样「命中就用、不命中就重算」。

## 一步里搬几行：命中、缺失、换出（示意数）

设一层里的历史有 8 个位置，每个位置一行；一行 1 KiB（示意数）。热缓冲给这个查询在这一层留了 4 个槽——槽是按「查询行」分的，一排槽跟着一个查询走，不同请求不共用同一排。上一步之后，槽里装着位置 0、2、4、6，最久没用的排在前面：0、4、2、6。这一步 indexer 选中 3 个位置：2、5、6。

1. **查表。** 2 在槽里、6 在槽里，都算命中，直接用；5 不在，记成缺失 1 行。
2. **挑槽。** 能腾的只有这一步没被选中的槽：装 0 的和装 4 的。按最久没用先换的顺序，5 装进原来放 0 的那个槽。
3. **搬运。** 从主机读 1 行进这个槽。
4. **换算槽号。** 这一步的清单 2、5、6 换成槽号：2 在第 2 个槽、5 在第 1 个槽、6 在第 4 个槽；attention 按槽号读热缓冲。
5. **更新表。** 槽里现在装着 5、2、4、6，最久没用的顺序变成 4、5、2、6——这一步没被碰的 4 排到了最前面。

```calc
title: 这一步搬了多少（示意数：一行 1 KiB）
不卸载也不稀疏，整段历史都在设备 = 0 行 = 0 KiB
卸载后每步搬全部选中的行 = 3 行 × 1 KiB = 3 KiB
卸载 + 热缓冲，只搬缺的行 = 1 行 × 1 KiB = 1 KiB
> 省下的 2 行是位置 2 和 6：上一步搬过，还在槽里
```

第一行是基准：不卸载时设备上就有全部历史，一步 0 字节搬运，代价是显存要一直装着 8 行。往下两行是卸载之后的两种情况，热缓冲把 3 行压成 1 行。

**重合度不由实现决定。** 下一步若还选 2、5、6，三行全命中，搬 0 行；若选 1、3、7，三行全缺失，搬 3 行。热缓冲只减少搬运，不能省掉这一步选中、但还没到设备的行——那些行必须搬完才能算 attention。

**热槽数必须不小于一次选中的位置数。** 上面 4 个槽装得下 3 个选中位置，所以腾得出槽；如果槽比选中的位置还少，就会有选中的位置没地方放。配置里那条「热缓冲不小于 top-k」的检查管的就是这件事。

## 一步 decode 的顺序：写新行、选、查表、搬、换号、算

```wiki-diagram
file: kv-cache-sparse-offload-step
```

有三处值得单独看：

- **新算出的 K/V 不写设备。** 这一步生成的那一行直接写进主机池——设备上本来就没有分页的主 cache 可写。
- **查表和挑槽在 CPU 上算。** 命中、缺失、换哪个槽都是整数运算，交给主机侧的一段原生代码做（并发时按行分给多个线程）；设备那边只负责按算好的地址表做拷贝。
- **一组卡里有一次等待。** 把同一层切到几张卡上算的那组叫 TP 组（[tensor parallel](tensor-parallel.md)），各自跑一份完整模型、各排各队的执行组叫 DP 组（[data parallel](data-parallel.md)）。一个 DP 组的主机池由组内第 0 号卡负责写新行，同组各卡共用这一份；所以每步要先确认它写完，各卡才各自把自己缺的行搬进自己的热缓冲。

还有一条容易被忽略的清理规则：热槽里如果装着**超出稳定前缀**的位置（[MTP](speculative-decoding.md) 草稿那几个还可能被改写的位置），这一步会先把这些槽作废，宁可重搬，也不拿可能过期的行去算。

## 设备上还剩什么

主 attention 的历史搬走以后，设备上留下三类东西：

| 留在设备上的 | 为什么不能搬走 | 多大 |
|---|---|---|
| indexer cache | 它要给**全部**历史打分，才能选出这一步读哪些位置；搬来搬去等于没卸载 | 随上下文长度增长，每张卡各一份 |
| 每层一对热缓冲 | attention 真正读的就是它 | 定额：一步最多几个查询行 × 每行热槽数 × 每个槽的字节 |
| 槽表、缺失清单、地址与句柄缓冲 | 每层一套，记着哪个槽装着哪个位置 | 小，但随并发和层数线性增加 |

「一对」不是 attention 的 K 和 V：[MLA](mla.md) 每个位置只存一条压缩过的潜向量，两块缓冲分别装潜向量段和 RoPE 段，而 GLM 这一配置不保存 RoPE 段，只剩前一块（见 [MLA 的 RoPE 段](mla.md#glm-的这一配置不保存-rope-段)）。

热缓冲的**查询行数**不是并发数，而是一步里最多有几个查询：取「一步的 token 预算」和「最大并发 × 每条请求每步几个 token」里小的那个。开了 [MTP](speculative-decoding.md) 的部署，后者要按每步验证的 token 数算，不是每条请求一个查询行。每一排槽跟着一个查询行走，这一排换给别的请求时整排清空，重新开始攒命中。

主机那一侧按 [data parallel](data-parallel.md) 的执行组（DP 组，各自跑一份完整模型、各自排自己的请求）记账：每个 DP rank 一个池子，要装得下这一组全部请求的完整历史；组内由 [tensor parallel](tensor-parallel.md) 合切同一层的那几张卡共用同一片主机内存，每张卡另外持有自己那份 indexer 数据。

## 池子能开多大：三条上限取最小

开了它以后，能装多少个块不再只看显存。实现把三条上限一起算出来，取最小的那条，并在日志里写明是哪条卡住了：

- **设备上限**：可用显存 ÷ 一个块在设备上占的字节（也就是不含主 KV 的那部分）。
- **主机上限**：配置给这个 DP rank 的主机内存，先扣掉按 2 MiB 对齐的预留，再除以一个块在主机上占的字节。
- **工作负载上限**：一条满长请求要几个块 × 最大并发，再加 1 个空块。

主机上限比设备上限还小时，实现会专门打一条 warning 提示调大它：主机内存给少了，设备显存再多也用不上。这也说明卸载没有把容量问题变没，只是把它从显存搬到了主机内存：上下文长度和并发仍受最紧的那条约束，只不过约束的对象换了。

## 放到 GLM 双机：硬件这一关就过不去

**这套部署没有开 Sparse KV offload。** 主线跑的是 GLM 快照 db701c1f，那份代码里根本没有这套实现（见[版本差异](#版本差异)）；下面列的是「假如换到 main」之后仍然过不去的五道门槛。部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。

1. **硬件不对：只支持 Atlas A3，本部署是 Atlas 800 A2。** main 在初始化卸载管理器时先判设备型号，不是 A3 就直接 `RuntimeError`；官方指南写的是支持 A3 与 950PR&950DT 两类节点，但代码只放行 A3（950 系列在型号映射里属于另一档）。这一条与模型、配置都无关，是本部署用不上它的根本原因。
2. **必须是 PD 分离的 D 端。** 不保留设备主 KV 时，实现要求启动参数里配了 KV 传输、且本实例是 kv consumer。主线的启动命令里没有这一项（见[部署页的启动参数](glm-5-3-flash-two-node.md#怎么开)），启动时直接断言失败。PD 分离本身是另一条变体路线，见 [PD 分离](pd-disaggregation.md)。
3. **模型不在支持清单里（这一道不报错，是「官方未验证」）。** 配置侧只检查模型带不带 `index_topk`，GLM 有，过得去；但官方指南列的是 GLM-5.1、GLM-5.2、DeepSeek-V3.2，并写明其他稀疏 attention 模型未验证，GLM-5.3-Flash 不在其中。其余四道都会当场抛异常。
4. **混合缓存布局不支持。** 设计文档写明这一条，源码里也对得上：内存规划要求全部缓存组共用一个块大小，而 GLM 的状态分成 5 个组（full 组、尾状态组、3 个 KDA 组，见 [KV 缓存规格](kv-cache-spec.md#对齐成两档页编成五个组)），尾状态组的块大小不是 640。
5. **热缓冲默认值对不上块大小。** 实现要求热槽数是块大小的整数倍；GLM 的逻辑块是 640 个 token，而默认热缓冲是 4,096，除不尽。既要不小于 `index_topk` = 2,048、又要是 640 的整数倍，最小可用值是 2,560。

假如前四道都放开（换 A3 机器、按 PD 分离部署、模型进清单、缓存布局对齐），按源码公式代入这套部署的其余参数，热缓冲要占的显存是固定的一笔：

```calc
title: 在这套部署上开它，热缓冲每卡要多少显存
一步最多几个查询行 = min(8,192 个 token 预算, 32 条并发 × 4 个 token) = 128 个查询行
一个查询行一层 = 2,560 个热槽 × 512 维 × 2 B = 2,621,440 B = 2.5 MiB
一层 = 128 × 2.5 MiB = 320 MiB
12 层（11 层稀疏 MLA + MTP 层） = 3,840 MiB = 3.75 GiB
```

这 3.75 GiB 和上下文多长无关，开了就占着。省下的则随长度增长：每个位置每层的主 KV 是 1,024 B（[一个块号占多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)里 13,056 B 的 12,288 B 那部分），12 层合起来，一条 133,120 个位置的满长请求约 1.52 GiB，32 条约 48.8 GiB——这些都挪到主机，默认给每个 DP rank 的 128 GiB 装得下。留在设备上的是 indexer 的 768 B/token 和尾状态。

搬运量则是每一步都要付的。GLM 每个查询最多读 2,048 个位置再加 0–3 个尾部（清单容量 2,051，见[稀疏什么时候才真的起作用](sparse-attention.md#稀疏什么时候才真的起作用)），全不命中时一个查询行一层要搬 2,048 × 1,024 B = 2 MiB，12 层 24 MiB；一步 128 个查询行就是 3 GiB，而且 TP8 里每张卡各搬各的——[MLA](mla.md) 的潜向量在 TP 组内是每卡各存一份相同的，不按卡切。这 3 GiB 只是字节账，不含主机侧的地址计算、TP 同步和链路争用。**所以这套东西能不能用，全看相邻两步选中集合的重合度**，而这既没有主线实测，官方也没有给出命中率：v0.26 的用户指南转述 RFC #48203 的实验，说它「有潜力显著提高序列长度或并发」，同一句也写明实际效果取决于模型、硬件和配置；main 的指南已不再写这句。

## 常见误解

- **「它和 CPU offload 一样，是在主机多存一份。」** 不是。主 attention 的历史只有主机那一份，设备上不再为它开空间；`keep_device_kv_cache` 设成真才会保留设备那份，那是调试用的路径，官方指南写明生产环境保持关闭。
- **「读得少，那存也能少。」** 不行。每一步都重新挑一次，这一步落选的位置下一步照样参与挑选，所以全部历史都要留着，只是留在主机。它省的是显存，不是存储总量。
- **「每个查询读 2,048 个位置，所以每步搬 2,048 行。」** 只搬缺的那些；上一步搬过、还在槽里的不搬。反过来说，最坏情况（全不命中）确实是这一批位置都要搬——GLM 每行清单最多 2,048 个位置加 0–3 个尾部。
- **「热缓冲越大越好。」** 它是定额显存，开大了别处就少了；而且必须不小于 `index_topk`，还要是块大小的整数倍，不是随便填一个数。
- **「GLM 有稀疏 MLA，所以能开。」** 模型带 `index_topk` 只过了模型这一道检查，前面还有硬件只限 A3、必须是 PD 分离的 D 端、缓存不能是混合布局几道，见上一节。（Model Runner V1 这一道主线本来就用 V1，能过。）
- **「开了它，indexer 的缓存也跟着省了。」** 没有。indexer cache 全量留在设备，它要给全部历史打分；卸载搬走的只有主 attention 那一份。

## 对照源码

### 怎么开

先看硬件：官方指南的安装步骤按硬件分组，写的是支持 A3 与 950PR&950DT 两类节点 [C20]；但 main 的代码只放行 A3，不是 A3 就直接 `RuntimeError` [C18]，而 950 系列在型号映射里被判成另一档（A5）[C24]——按这份代码，指南里的第二类机器同样过不去。硬件对了，再在 decode 侧加两段配置（prefill 侧相反，必须关着）[C14][C17]：

```bash
--additional-config '{
    "sparse_kv_offload_config": {
        "enabled": true,
        "topk_buffer_size": 4096,
        "dram_size_per_dp_GB": 128
    }
}' \
--kv-transfer-config '{
    "kv_connector": "SfaRemoteD2HConnector",
    "kv_role": "kv_consumer",
    "kv_port": 20050,
    "kv_connector_extra_config": {
        "transfer_backend": "memfabric",
        "use_layerwise": true
    }
}'
```

- `enabled` 一开，SFA 后端的实现类和 metadata builder 就换成带卸载的那一对，稀疏 MLA 层的缓存规格也被标成「放在主机」[C3]。
- `topk_buffer_size` 是每行的热槽数，要求不小于 `index_topk`，并且能被块大小整除；官方参数表建议取 `index_topk` 的两倍。
- `dram_size_per_dp_GB` 是给每个 DP rank 的主机内存，要装得下这一组的全部主 KV，组内 TP 各卡共用。
- decode 侧要从 `kv_port` 起预留 `DP 数 × TP 数` 个连续端口，端口号按 `kv_port + dp_rank × d_tp_size + tp_rank` 分配 [C12]。
- main 上还有一个 `use_fused_overlap`（默认关），打开后 decode 换成另一条融合路径，本页讲的是默认路径；见[参数页](../params/use-fused-overlap-75a180fff6ab.md)。
- GLM 双机主线的启动参数里没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

启动时的前置检查，按源码里的顺序 [C1]：

| 情况 | 报什么 |
|---|---|
| 模型 config 里有 `compress_ratios` | `ValueError: Sparse KV offload don't support compress now.` |
| 模型 config 里没有 `index_topk` | `ValueError: Sparse KV offload only support sparse attention model.` |
| 开了 context parallel | `ValueError: Sparse KV offload don't support context parallel now.` |
| 开了 pipeline parallel | `ValueError: Sparse KV offload don't support pipeline parallel now.` |
| 没配 KV 传输、或本实例不是 kv consumer（且 `keep_device_kv_cache` 为假） | `AssertionError: Sparse KV offload is only supported in PD disaggregate scenario and can only be used in D node.` |
| 用了 Model Runner V2 | `ValueError: Sparse KV offload doesn't support model_runner_v2 now.` |
| 热槽数小于 `index_topk` | `ValueError: sparse_kv_offload_config.topk_buffer_size must be >= topk` |

再往后是建对象和分配内存时的检查：热槽数不能被块大小整除 → `ValueError: … must be divisible by block_size` [C5]；主 cache 同时开着 sparse SFA C8 量化 → `NotImplementedError`，报文里写明 indexer 那份 C8 不受影响 [C2]；缓存规格里没有「放在主机」的层、或全部都在主机 → `ValueError`，因为设备侧至少要留 indexer；各缓存组的块大小不一致 → `ValueError: Sparse KV offload memory planning requires one shared block size`，GLM 这类多组混合缓存卡在这里（按代码推断，未实跑）[I][C10]。运行中还有两条：一步的行数超过预留的工作区、metadata 里缺请求编号映射，都直接抛错 [C8]。

还有两条和硬件有关：设备型号不是 A3 → `RuntimeError: Sparse KV offload is only support on A3`，发生在建管理器时，比上面那些配置检查更晚 [C18]；自定义算子没编进来 → `RuntimeError`，报文里直接提示「Rebuild vllm_ascend_C with Atlas A3 support」[C19]。

在 GLM 的块大小（640）上，示例里的默认热缓冲 4,096 除不尽，照抄就起不来 [!]；既要不小于 `index_topk` = 2,048、又要是 640 的整数倍，最小可用值是 2,560 [D]。

### 开销和什么时候别开

- **每一步都付一次 H2D，而且挡在 attention 前面**：查表、挑槽、算地址在主机侧做，拷贝完才能算。搬运量正比于「缺失行数」，不是历史长度 [C8]。
- **最坏情况有多贵**：代入这套部署，全不命中时一步每卡要搬 3 GiB，TP8 各搬各的，所以命中率低到一定程度就不如不开 [D]。
- **热缓冲是定额显存**，按「一步最多几个查询行 × 每行热槽数 × 每个槽的字节」一次开满，两块缓冲一起分配 [C11]。
- **主机池要锁页**，并按 2 MiB 对齐，每个主机层预留三份对齐余量；三条上限里哪一条卡住会写进日志。
- **TP 组内每步有一次广播式的等待**，确保 rank 0 的新行写完再各自搬。
- **适合开**：上下文很长、显存装不下全部历史，且相邻步选中的位置重合度高（热缓冲命中率高），部署本来就是 PD 分离。
- **别开**：硬件不是 Atlas A3（本部署的 Atlas 800 A2 就在此列，连管理器都建不起来）[D]；上下文不长（热缓冲这笔定额显存比省下的还多）；模型不是 SFA/MLA 这类稀疏 attention 模型；缓存是混合布局；只有 PD 合置。
- **怎么测**：命中率和 H2D 耗时要在真机上测，源码里没有现成的统计口径。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 | GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad |
|---|---|---|---|---|
| 有没有这套实现 | 无 | 无 | 有：`sfa_kv_offload.py` + `sparse_kv_offload/` | 有 |
| 配置键 | — | — | `enabled`、`topk_buffer_size`、`dram_size_per_dp_GB`、`keep_device_kv_cache` [C15] | 再加一个 `use_fused_overlap` [C1] |
| 多写的键 | — | — | 普通类逐个取值，认不出的静默忽略 | 走配置对象校验，多写会被拒 |
| 内存怎么定 | — | — | 按主机/设备页字节比算出需要多少主机内存，超了报错，并把省下的显存加回可用额度 [C16] | 设备、主机、工作负载三条上限取最小，日志报是哪条 [C10] |
| 硬件限制 | — | — | 建管理器时不判设备型号 [C23] | 不是 A3 直接 `RuntimeError` |
| 官方文档 | 无 | 无 | 用户指南，支持 GLM-5.2、DeepSeek-V3.2 | 用户指南 + 设计文档，支持 GLM-5.1、GLM-5.2、DeepSeek-V3.2 [C13] |

前两列的仓库里没有 `sparse_kv_offload/` 这个目录，也没有对应的注意力实现，所以这套特性在 GLM 的钉住快照上根本不存在 [I]。两个有它的版本都写明同样的限制：只支持 DP 和 TP，不支持 CP 和 PP；主 KV 必须是 BF16；MemFabric 是唯一的传输后端；联合部署要求 prefill 的 TP 数不小于 decode 的 TP 数且能整除 [C14]。

### 源码位置

| 看什么 | 在哪（`vllm-ascend@baa023ad`） |
|---|---|
| 配置字段与全部前置检查 | `vllm_ascend/ascend_config.py`，`SparseKVOffloadConfig`（L1466–L1533） |
| 开关换哪两个类 | `vllm_ascend/attention/sfa_v1.py`（L284–L311） |
| 把稀疏 MLA 规格标成「放在主机」 | `vllm_ascend/worker/model_runner_v1.py`（L5878–L5890） |
| 新算出的 K/V 写进主机池 | `vllm_ascend/attention/sfa_kv_offload.py`，`exec_kv`（L346–L393） |
| decode 主流程：掩掉无效位置、取常驻视图、搬、算 | 同文件（L1001–L1156） |
| 搬运入口：算计划、TP 广播、发起拷贝 | `…/sparse_kv_offload/sparse_kv_offload_manager.py`，`onload_topk_kv`（L1215–L1337） |
| 命中、缺失、换出与槽号重映射 | `csrc/torch_binding.cpp`，`process_one_lru_resident_row`（L2266–L2400） |
| 三条上限与对齐预留 | `…/sparse_kv_offload_manager.py`（L213–L297） |
| 热缓冲按什么公式开 | 同文件（L107–L140） |
| 只在 A3 上初始化、缺算子的提示 | 同文件（L1645–L1663、L90–L104） |
| 一步 decode 的官方描述 | `docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md`（L154–L193） |

待核：热缓冲的命中率（决定实际搬运量，源码里没有统计口径，主线也没有实测）；主机到设备的有效带宽与单步耗时；GLM-5.3-Flash 会不会进入后续版本的支持清单；混合缓存布局若被放开，GLM 的 5 个缓存组怎样对齐到一个块大小；默认路径与融合路径的浮点输出是否逐位一致。
