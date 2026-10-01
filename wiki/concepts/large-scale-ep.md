---
id: large-scale-ep
title: 大规模 EP：请求路由、专家域与跨机通信
type: feature
summary: 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端点与进程的区别。
aliases: [Large-Scale EP, 大规模专家并行, 大规模 EP, wide-EP, Distributed DP Server, 分布式 DP server, 外置 DP 负载均衡, external DP LB, data_parallel_external_lb, data-parallel-rank, large_scale_ep, VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED, load_balance_proxy_server_example, external_online_dp]
chapters: ["14"]
order: 20
sources:
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L479-L489
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L276-L287
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L789-L806
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L898-L945
  - vllm@0fc695fc:vllm/config/parallel.py#L138-L144
  - vllm@0fc695fc:vllm/config/parallel.py#L514-L520
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L148
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L239-L282
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L5-L6
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1859-L1882
  - vllm@0fc695fc:docs/serving/data_parallel_deployment.md#L75-L106
  - vllm@0fc695fc:docs/serving/expert_parallel_deployment.md#L225-L234
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L96-L101
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L10-L13
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L239-L295
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L126-L167
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L317-L362
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L205-L211
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L352-L410
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L644-L682
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1640-L1655
  - vllm-ascend@db701c1f:examples/external_online_dp/run_dp_template.sh#L18-L21
  - vllm-ascend@db701c1f:examples/external_online_dp/launch_online_dp.py#L54-L59
  - vllm@0fc695fc:vllm/config/parallel.py#L800-L831
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1257-L1298
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L115-L133
  - https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/main/config.json
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2205-L2240
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/large_scale_ep.md#L150-L160
  - vllm-ascend@2c59ff10:examples/external_online_dp/dp_load_balance_proxy_server.py#L148-L160
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L101-L102
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1169-L1172
  - vllm@568afb3a:vllm/engine/arg_utils.py#L2010-L2030
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L33-L55
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L326-L337
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L492-L496
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1658-L1675
verified: []
evidence: "C"
relations:
  - {to: expert-parallel, kind: builds-on, note: 理解专家放置和派发组合}
  - {to: data-parallel, kind: builds-on, note: 理解请求副本与 EP 组的关系}
  - {to: pd-disaggregation, kind: builds-on, note: 理解 P/D 之间的状态交接}
  - {to: engine-processes, kind: builds-on, note: 区分服务实例与其内部进程}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: EP16 基线：两台 A2 为什么正好对上 MC2 门槛}
  - {to: concurrent-requests, kind: builds-on, note: 一个 DP 组的长 prefill 怎样把两台机器一起拖离 MC2}
  - {to: eplb, kind: builds-on, note: 每卡专家变少后，热门专家的负载怎样调整}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 大规模 EP 是什么？

**大规模 EP（large-scale EP，也叫 wide-EP）是把 MoE 模型的专家并行铺到很多台机器上：几十到上百张卡合起来只放一套专家，每张卡只分到很少几个；token 每层都要在这整组卡之间来回交换，其中很大一部分要跨机器。**

先用两句话回顾 [EP（专家并行）](expert-parallel.md)。MoE 模型每层有一池路由专家，router 给每个 token 选出分数最高的 k 个；EP 把这池专家整份分到几张卡上，token 选中哪个专家，就把它的 hidden（这个位置在层与层之间传递的一排数）**dispatch（派发）**到放着那个专家的卡上，算完再 **combine（收回并组合）**到原来的卡，按权重相加。一起分这一套专家、每层互相交换 token 的那组卡，叫一个 **EP 组**。

EP 组从一台机器的几张卡变成几十台机器的上百张卡，专家怎么摆、token 往哪发、每张卡忙不忙都跟着变。沿用 EP 页的例子：句子「我吃了苹果」切成 4 个 token，每层 8 个路由专家 E0–E7，每个 token 选 k = 2 个，路由结果和 EP 页一样：我选 E3、E4，吃选 E2、E1，了选 E3、E7，苹果选 E3、E5。上半是一台机器 4 张卡（EP4），每卡放 2 个专家；下半把同样 8 个专家摊到两台机器的 8 张卡上（EP8），每卡 1 个。下半的 4 个 token 分在两台机器上，每台 2 个：请求本来就由[数据并行（DP）](data-parallel.md)分给不同的卡去算 attention，到了 MoE 层才按专家交换。

```wiki-diagram
file: large-scale-ep
```

对照上下两半，数三样东西：

- **每卡的专家：2 个变 1 个。** 专家权重要一直放在卡上，组越大，每张卡要存的越少。
- **派发的去向。** 两种放法都有 7 份要发到别的卡（吃选的 E2 正好在本卡）。EP4 的 7 份都在一台机器里；EP8 有 3 份要跨到另一台机器：我→E4、了→E3、苹果→E3。机器之间的链路一般比机内慢，dispatch 和 combine 又要等所有份到齐，这 3 份拖住的是整层。
- **每卡的活。** 路由没变，E3 仍被 3 个 token 选中。EP4 里放着 E2、E3 的卡 1 收到 4 份，平均每卡 2 份；EP8 里 E3 独占卡 3，收到 3 份，平均却降到 1 份，还有两张卡这一步没有活。卡多了一倍，最忙的那张卡只少了 1 份。

这个例子为了只看「专家摊开」这一件事，批次固定为 4 个 token。实际加机器是为了接更多请求，新机器会带来自己的 token；但上面的趋势不变：每卡专家变少，派发的目的地变多、跨机的比例变大，各卡的工作量更容易参差。

组铺到几十台机器，部署的组织方式也跟着变：常见做法是每个 DP rank 各起一个独立的服务，由 vLLM 外面的路由程序分请求，并把 prefill 和 decode 分到不同的机器上。这两件事放在[后面两节](#每个-dp-rank-怎样各自成为一个服务)讲。

## 为什么要把 EP 组铺这么大，代价在哪？

**路由专家必须全部常驻，组越大，每张卡存得越少，省下的显存留给 KV cache，同时能服务的请求就更多；decode 每一步的时间主要花在从显存读权重，每卡的专家少了，要读的也少。代价是派发的去向更散、更多跨机，而且整组都要等最慢的那张卡。**

为什么专家要全部常驻，EP 页讲过（见[为什么需要 EP](expert-parallel.md#为什么需要-ep)）：下一个 token 选谁事先不知道，每层每个路由专家都得随时可用。接着那里的示意模型：40 层，每层 128 个专家，一个专家 12 MiB，专家权重一共 60 GiB。组越大，每卡分到的越少：

```calc
title: 示意模型每卡要存多少专家权重（数为示意）
全部专家 = 40 层 × 128 个 × 12 MiB = 61,440 MiB = 60 GiB
EP4 每卡 = 60 GiB ÷ 4 = 15 GiB，每层 32 个专家
EP16 每卡 = 60 GiB ÷ 16 = 3.75 GiB，每层 8 个专家
EP64 每卡 = 60 GiB ÷ 64 = 960 MiB，每层 2 个专家
```

省下来的显存有两处用场。**一是放 KV cache**：每条请求已经处理过的 token 都留下一份 K、V 向量，后面每一步都要读，请求越多、越长，占得越多（见 [KV cache](kv-cache.md)）；显存多出来，能同时在跑的请求就多。**二是 decode 更快**：decode 每一步每条请求只新算一两个 token，矩阵乘的行数很少，时间主要花在把权重从显存读出来（见[矩阵乘和权重](matmul-and-weights.md#同一片权重为什么能处理多行输入)）；每卡放的专家少了，一步要读的专家权重也少。组里的请求多了，每个专家一步收到的 token 也多，读一遍权重能多算几行。

代价有三处，前两处在上面的例子里已经看到：

1. **去向更散，更多跨机。** 每个 token 每层发出 k 份、收回 k 份，这笔量只跟 token 数、k 和 hidden 宽度有关，和卡数无关（见[每层两次按目的地交换](expert-parallel.md#每层两次按目的地交换)）。卡数改变的是去向：一张卡要发往的卡更多，发给每张卡的份数更少；专家均匀摊在 M 台机器上、路由也均匀时，一份派发落到别的机器的机会约为 (M − 1) ÷ M，两台约一半，八台约八分之七。
2. **整组等最慢的卡。** dispatch 和 combine 都是集合点，要等每张卡都交齐（见[负载不均](expert-parallel.md#负载不均最慢的卡决定这一层多久)）。每卡只剩一两个专家时，热门专家没有同卡的冷门专家帮它摊平，最忙的卡比平均高出更多：例子里 EP4 是 4 份对平均 2 份，EP8 是 3 份对平均 1 份。这张卡不光多算，还要多收、多开接收缓冲、多送回结果。按实际热度调整专家摆放、给热门专家多放几份副本，是 [EPLB](eplb.md) 做的事。
3. **整组一起走。** 每个 DP rank 的 attention 各算各的请求，MoE 层却要全组同时到场；某个 rank 暂时没有请求，也要拿一份假输入陪着走（见[空闲的组为什么还要陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)）。组越大，一起对齐、一起陪跑的卡就越多。

和一台机器之内的 EP 比，差别集中在这几处：

| | 一台机器之内的 EP | 大规模 EP |
| --- | --- | --- |
| EP 组 | 一台机器的几张卡 | 几十台机器、上百张卡 |
| 每卡的路由专家 | 较多 | 很少，常常只有几个 |
| dispatch 和 combine | 走机内链路 | 大部分份数跨机器 |
| 请求从哪进 | 一个服务统一分派 | 常见每个 DP rank 一个服务，外部路由分派 |

## 每个 DP rank 怎样各自成为一个服务？

**默认情况下，一个 vLLM 服务只有一个入口：主节点上的 API server 收下所有请求，再挑一个 DP rank 派过去。大规模 EP 常改用外置负载均衡：每个 DP rank 各起一个完整的服务、有自己的端口，由 vLLM 外面的路由程序决定请求去哪个 rank；这些 rank 仍在同一个 EP 组里，每层 MoE 一起交换 token。**

先说 DP rank。DP 把模型的 attention 和稠密层复制成几份，每份叫一个 DP rank，各自调度、各算各的请求；路由专家却只有一份，摊在全组的卡上（见[数据并行](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。一个 DP rank 可以只占一张卡，也可以占几张卡、再用 TP 把矩阵切开合算。

**默认的内置分派。** 一个 vLLM 服务由几类进程组成：API server 接 HTTP 请求、分词，再交给引擎；EngineCore 负责调度、驱动各卡计算；每张卡还有一个 Worker 进程守着它执行（分工见[引擎的进程](engine-processes.md)）。内置方式下，主节点上的 API server 按各 rank 排队的情况打分，挑分最低的 rank（规则见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)）。vLLM 的部署文档提醒，DP 规模很大时，这个集中在主节点上的前端可能成为瓶颈；多开几个 API server 能缓解，但它们仍挤在主节点上。

**外置负载均衡。** 另一条路是把每个 DP rank 当成一个独立部署。启动时告诉进程「你是第几号 DP rank」，它就只管自己这一个 rank：本机只起这个 rank 的引擎，只起一个 API server，也只和本机这一个 EngineCore 打交道。一个 rank 仍是一整套进程，前端、EngineCore、每卡一个 Worker 都有，所以外面能访问的端口数不等于进程数。rank 之间要约好 DP 总数，以及 DP 主节点的地址和端口：各 rank 启动后到那里握手，组成一起做 MoE 通信的组。vLLM 还有一种折中的 hybrid 方式：每台机器一个入口，只分给本机的 rank，机器之间再由外部路由分。

这套只对 MoE 模型开放。稠密模型的各个副本之间不用一起走，想从外面分派，直接起几个互不相干的 vLLM 就行；给稠密模型指定 DP rank，启动时就会报错。

```wiki-diagram
file: large-scale-ep-flow
```

**外部路由怎么挑。** 分派交出去以后，谁去哪个 rank 由外部程序决定。vllm-ascend 仓库里的示例 proxy 不是轮流发，而是给每个后端记一本账：每派出一条请求，按请求体的长度（字节数，不是 token 数）估一笔负载记上，处理完再减掉。decode 端记的就是请求体长度；prefill 端记的是由长度折算出的估分。挑 prefill 端时比各自手上的估分之和，挑 decode 端时比各自手上的请求体长度之和，都取最小的：

```calc
title: 示例 proxy 给 prefill 端记的估分（请求体长度为示意）
短请求 = 4,000 ÷ 4 × 0.0345 + 120.0745 ≈ 154.6
长请求 = 40,000 ÷ 4 × 0.0345 + 120.0745 ≈ 465.1
> 请求体长了 10 倍，估分只约 3 倍：常数 120 占了大头，更接近在数手上还有几条请求
```

这本账是 proxy 自己在派出和结束时加减的估算，不是从设备上实时读出的利用率；换一个外部路由，规则也可以完全不同。一条请求的走法见上图右半：proxy 先把请求发给挑中的 prefill 端，并限定它只生成 1 个 token；prefill 端返回 KV 传输参数，proxy 把参数交给挑中的 decode 端，decode 端再通过连接器直接从 prefill 端取 KV cache，proxy 本身不搬 KV。

## 为什么常和 PD 分离一起用？

**大规模 EP 几乎总和 PD 分离一起出现：prefill 一步有成千上万个 token，decode 一步每条请求只有一两个，两种负载要的通信方式和批大小不一样；混在一个大组里，一个 rank 上的长 prefill 就会把全组都拖到大批次的路子上。拆开以后，两边各用自己的并行布局和参数。**

PD 分离把一条请求的 prefill 和 decode 交给两组不同的机器：prefill 一侧算完提示词，把 KV cache 交给 decode 一侧接着生成（见 [PD 分离](pd-disaggregation.md)）。

为什么和大规模 EP 特别搭，要看 MoE 层怎么选通信方式。在昇腾上，每一步先看 DP 组里各 rank 这一步的 token 数，取**最大值**：不超过一个容量门槛就走 MC2（通算融合：把跨卡收发和计算协同执行的一类昇腾实现，只把被选中的 token 副本发到专家所在的卡），超过了就换成先收齐整批 token 的 All-Gather 路径（A2）或按目的地整批交换的 All-to-All 路径（A3）。按最大值选，意味着**全组用同一种方式**：只要有一个 rank 这一步塞进了一段长 prefill，其余只做 decode 的 rank 也一起换路，还要把各自的输入补齐到同样的行数（见[并发请求的第 4 站](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)）。

组越大，这种被一个 rank 拖走的步就越多。示意：假设每个 rank 每一步有 5% 的机会带着长 prefill，各 rank 互不相干：

```calc
title: 至少一个 rank 带长 prefill 的机会（p = 5% 为示意）
2 个 rank = 1 − 0.95² = 0.0975 ≈ 10%
16 个 rank = 1 − 0.95¹⁶ ≈ 56%
64 个 rank = 1 − 0.95⁶⁴ ≈ 96%
> 组越大，几乎每一步都有 rank 在做 prefill
```

拆成 P、D 两侧以后，decode 一侧的每一步只有 decode 的 token，能稳定留在小批次的路子上；prefill 一侧专门处理大批次。两侧还能各选各的参数：prefill 一侧一步收很多 token、同时处理的请求少；decode 一侧一步收的 token 少、同时处理的请求多，还能用 graph mode（把一步的算子序列录下来整段重放）省掉逐个下发算子的开销。上游 vLLM 的 EP 部署文档也是这样配的：prefill 实例用面向吞吐的通信后端，decode 实例用面向低延迟的后端。

代价是另一套东西：P、D 之间要搬 KV cache，两组资源要分别扩缩和管理。拆不拆要看输入输出长度、请求分布、网络和容量；PD 分离也不是 EP 的前提，一台机器之内的 EP 不拆照样能跑。

## 官方示例：8 台 A3 怎样分成 P、D 两个专家域

**vllm-ascend 的官方文档用 8 台 Atlas 800T A3 服务器部署 DeepSeek-R1 演示这套做法：前 4 台做 prefill，每台自成一个 EP16 组；后 4 台做 decode，合起来是一个 EP64 组；一共 72 个 DP rank，每个都是一个独立的服务。** 这是另一个模型、另一代硬件上的配置，下面的数只用来看组织方式，不代入 GLM。

DeepSeek-R1 每层 256 个路由专家，每个 token 选 8 个；每台 A3 有 16 颗 NPU。文档里的推荐配置：

| | prefill 一侧（P） | decode 一侧（D） |
| --- | --- | --- |
| 机器 | 4 台，每台 16 颗 NPU | 4 台，每台 16 颗 NPU |
| 每台怎么切 | 2 个 DP rank，每个 TP8 | 16 个 DP rank，每个 TP1 |
| EP 组 | 每台自成一个 EP16，DP 主节点各用自己 | 4 台合成一个 EP64，DP 主节点都用第 5 台 |
| 一步最多 token / 同时请求 | 16384 / 4，关掉 graph mode | 256 / 28，保留 graph mode |

文档注明这组参数不针对优化，要按实际场景调。P 一侧的 4 个 EP16 互不相干，一条请求的 prefill 只在其中一台里做；D 一侧的 64 个 rank 每层一起交换 token。所以这里并不存在一个 128 颗 NPU 的 EP 组。

```wiki-diagram
file: large-scale-ep-deploy
```

每个 DP rank 是一个服务。数一数一共有多少个服务、每颗 NPU 放多少专家：

```calc
title: 官方示例的服务数与每卡专家数
P 一侧服务 = 4 台 × 2 个 rank = 8
D 一侧服务 = 4 台 × 16 个 rank = 64
服务合计 = 8 + 64 = 72
P 每卡路由专家 = 256 ÷ 16 = 16
D 每卡路由专家 = 256 ÷ 64 = 4
```

每个服务的 HTTP 端口从 9000 起，按本机的 rank 依次加一。72 只数外面能访问的服务，没有算服务里面的进程：P 一侧每个 rank 占 8 张卡，就有 8 个 Worker。

两侧搬 KV cache 还要约一个传输端口。文档里 64 个 decode 服务写的是同一个端口号 20001，看上去会撞，其实不会：连接器实际监听的端口是「写的值 + DP rank 编号 × 这个 rank 占的卡数」，再加上本 rank 里第几张卡。D 一侧每个 rank 1 张卡，0 号 rank 用 20001，63 号用 20064；P 一侧每个 rank 8 张卡，0 号占 20001–20008，1 号占 20009–20016。4 台 P 机器的 rank 编号都从 0 起，端口号相同，靠的是机器不同。

## 在昇腾上，组要多大才走得上 MC2？

**在 Atlas A2 上，MC2 还有两条规模条件：EP 组至少 16 张卡、每卡路由专家不超过 24 个；一台 A2 只有 8 张卡，所以 A2 上的 MC2 至少要两台机器。A3 没有这两条。**

按 token 数选路的那条规则见 [PD 分离那一节](#为什么常和-pd-分离一起用)，它每一步都重判；这里的规模条件在部署时就定了：

- **A2**：每卡路由专家（总数除以 EP 组的卡数）不超过 24 个，并且 EP 组不少于 16 张卡；任一条不满足，每一步都只能走 All-Gather 路径。
- **A3**：没有规模条件。A3 上还有一种把 dispatch、专家计算和 combine 合进一个算子的融合版 MC2，默认关闭；它的一种模式只在 EP 组不超过 32 张卡时启用，组再大就退回普通 MC2 或 All-to-All。

把 A2 的这两条代入官方示例那个模型的 256 个路由专家（只看判据，不代表某个真实部署）：

| EP 组 | 每卡路由专家 | A2 上组大小与专家数两条 |
| --- | --- | --- |
| 8 张卡（一台 A2） | 256 ÷ 8 = 32 | 都不满足，只能走 All-Gather |
| 16 张卡（两台 A2） | 256 ÷ 16 = 16 | 刚好满足，再看这一步的 token 数 |
| 64 张卡 | 256 ÷ 64 = 4 | 满足，再看这一步的 token 数 |

跨机器的那部分走什么链路，也和硬件代际有关。官方文档对多机的物理要求是：所有机器在同一个局域网，所有 NPU 彼此互通；A2 机内卡间走 HCCS（昇腾机内的高速互联），机器之间走 RDMA 网络（网卡直接读写对方内存的网络传输）；A3 机内机外都走 HCCS。A2 上还可以打开分层通信，让 MC2 先在机内汇合、再跨机，减少机器之间的流量；它要求各 rank 每步的 token 数一致，打开方式见[对照源码](#开销和什么时候别开)。

## 放到 GLM 双机：EP16 是跨机的第一档

**GLM 双机的 EP16 已经是跨机 EP：16 张卡分在两台 A2 上，每卡 18 个路由专家，每层的 dispatch 和 combine 有一部分要跨机器。但它的部署形态不是大规模 EP：只有一个 API server，第二台机器以 headless 方式加入，没有外部 proxy，也没有 PD 分离。本站没有超出 EP16 的部署和实测，下面把 EP16 当作基线。**

部署前提（两台 Atlas 800T A2、每台 8 张卡、TP8/DP2/EP16、W8A8 权重）见[部署前提](glm-5-3-flash-two-node.md#部署前提)。16 张卡按「DP 组号 × 8 + 本机卡号」编号，EP 组就是全部 16 张卡（见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。288 个路由专家按编号连续分：卡 r 放 18r 到 18r + 17 号，机器 0 的 8 张卡合起来放 0–143 号，机器 1 放 144–287 号（见 [EP 页的分法](expert-parallel.md#16-张卡怎样分专家)）。

**为什么是两台，正好对上 A2 的门槛。** 同一个模型放进单机 8 卡，EP 只有 8，每卡要放 36 个专家，A2 选 MC2 的两条规模条件都不满足；放到两台 16 张卡，每卡 18 个，EP 正好 16。多出来的显存让 KV cache 的块数约翻到 2.5 倍。这笔账的唯一出处在[为什么是两台机器](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。所以 GLM 双机就是「A2 上要走 MC2 至少两台机器」的最小一档。

**入口仍是内置分派。** 机器 0 起 API server、DP 协调进程和 DP 组 0 的 EngineCore；机器 1 用 headless 方式启动，不起前端，只有 DP 组 1 的 EngineCore（进程清单见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)）。请求由机器 0 的前端按排队打分派到两组之一，没有前面那种一个 rank 一个服务的外置分派。

**通信和负载的基线。** 下表的数都已在别页推导，这里只汇总。场景 M 是[并发请求](concurrent-requests.md#示例场景-m-与变体-m)页的示例：机器 0 上 12 条请求在 decode、同时来了一条 6000 个 token 的新请求，机器 1 上 7 条请求在 decode。

| 看什么 | GLM 双机 EP16 | 推导在哪 |
| --- | --- | --- |
| 走 MC2 的条件 | 两组这一步的最大 token 数不超过 128 | [一条请求的 MoE 站](one-request.md#moe-通信走-mc2-还是-allgather) |
| 场景 M 去掉长 prefill、只剩 decode 时，每卡每步的 EP 交换 | 上界约 31.5 MiB | [EP 页的每卡账](expert-parallel.md#场景-m-的每卡账权重均分工作量看路由) |
| 场景 M | 两台一起换成 All-Gather，跨组交换约 4.15 GiB/卡/步 | [并发请求的第 4 站](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛) |
| 每卡专家计算行数（理想均分） | 纯 decode 38 行，场景 M 6048 行 | [EP 页的每卡账](expert-parallel.md#场景-m-的每卡账权重均分工作量看路由) |

场景 M 就是前面「一个 rank 拖走全组」的双机版：只有机器 0 来了长 prefill，机器 1 的 7 条 decode 也被补齐到同样的行数、一起换路。EP16 的这些数是上界或理想均分：MC2 的交换量按每个 token 的 8 份都发出去算，其中哪几份落到另一台机器，取决于这一步的路由；每卡实际收到多少行，要看专家的冷热。热门专家集中在一张卡上时，这一层要等它算完；本部署没有开 EPLB，也没有冗余专家（见[这套部署有没有开 EPLB](expert-parallel.md#这套部署有没有开-eplb)）。

**再往上扩要重核什么。** 把 GLM 铺到更多机器，每卡专家数、MC2 的两条规模条件、容量门槛、跨机的比例、是否外置分派与 PD 分离，都要按新的配置重新核对；本站没有这类部署的数字，不能把上表当作更大组的效果。

## 常见误解

- **「大规模 EP 是一个开关。」** 没有这样的开关。启动命令里和它有关的只有打开 EP 的开关和一组 DP 参数，其余都是部署方式：起多少个服务、谁当 DP 主节点、外部路由怎么挑、P 和 D 怎么分。官方文档的标题把它叫作 Distributed DP Server。
- **「外置分派以后，每个 rank 都是独立服务，互不影响。」** 独立的只是入口和调度。每层 MoE 仍要全组到场：一个 rank 塞进长 prefill，全组一起换路、补齐行数；一个 rank 没有请求，也得陪着走一步。
- **「P 和 D 两侧的 EP 组应该一样大。」** 两侧各选各的布局，这正是拆开的好处之一：官方示例的 P 侧是 4 个互不相干的 EP16，D 侧是一个 EP64。
- **「GLM 双机跨了两台机器，就已经是大规模 EP。」** 它只在「EP 组跨机」这一点上对得上；入口仍是一个 API server 加一台 headless 机器，没有外部路由，也没有 PD 分离。
- **「外置 DP 负载均衡是昇腾加的。」** 它是上游 vLLM 的能力；vllm-ascend 提供的是文档、启动脚本和示例 proxy。
- **「MC2 是通算融合，所以把通信量省掉了。」** 融合省的是收发和计算之间的干等，该发的 token 副本一份不少。MC2 比 All-Gather 路径搬得少，是因为它只发被选中的副本（W8A8 部署里还按 8 位整数发），不是因为融合。
- **「EP 组够大，就一定走 MC2。」** 规模只是 A2 的前提，每一步还要按 token 数重判，见[按最大 token 数选路](#为什么常和-pd-分离一起用)。
- **「卡翻一倍，MoE 层的时间就减半。」** 每层要等最慢的卡；热门专家独占一张卡时，最忙的卡降得比平均慢，跨机的份数还会变多。
- **「每个 token 选 8 个专家，就是 8 条网络消息。」** 8 份是逻辑上的 token–专家对；落在同一张卡上的会一起送，实现还会打包、量化，A2 的分层通信还会先在机内汇合。实际的消息数和字节要看实现和 trace。
- **「逻辑上分开的组，网络上互不干扰。」** P 一侧的几个 EP16、D 一侧的 EP64 和 P→D 的 KV 传输在逻辑上各是各的，物理上仍可能共用交换机和网卡。

## 对照源码

### 怎么开

- **前提。** 模型必须是 MoE，打开 EP（`--enable-expert-parallel`）并给出 DP 参数；EP 组大小没有单独的参数，由 TP × DP 推出，见 [EP 页的怎么开](expert-parallel.md#怎么开)。
- **让一个进程成为外置分派下的一个 rank。** 命令行给 `--data-parallel-rank`。上游把这种模式叫 external DP LB，字段 `data_parallel_external_lb` 的注释写明它面向 Kubernetes 里 one-pod-per-rank 的 wide-EP，只支持 MoE [C5]。给了编号以后：本地 DP 个数固定为 1，`api_server_count` 默认为 1，客户端只管本地 EngineCore（`local_engines_only` 为真）[C10]。
- **DP 主节点。** `--data-parallel-address` 加 `--data-parallel-rpc-port`。官方示例里 4 台 P 机器各自当主节点，4 台 D 机器都指向 192.0.0.5，D 机器的起始 rank 依次是 0、16、32、48 [S15]。
- **四种分派方式互斥。** 内置（默认）；hybrid（`--data-parallel-hybrid-lb`，或给了 `--data-parallel-start-rank` 且不是 headless）；外置（`--data-parallel-external-lb` 或给了 `--data-parallel-rank`）；multi-port 外置。启动入口按「multi-port → headless → 多个 API server → 单个 API server」的顺序落到一种，外置 rank 走最后一种 [C7]。GLM 双机的机器 1 走 headless 那一支。
- **能直接用的模板。** `examples/external_online_dp/run_dp_template.sh` 用 `--data-parallel-size`、`--data-parallel-rank`、`--data-parallel-address`、`--data-parallel-rpc-port` 四个命令行参数；`launch_online_dp.py` 按本地 rank 把可见设备切成每 rank `tp_size` 张卡，HTTP 端口从起始端口依次加一。
- **官方示例的参数。** P 侧 `--max-num-batched-tokens 16384 --max-num-seqs 4 --enforce-eager`，D 侧 256 和 28、不加 eager；推荐表另给 `max-model-len` 17000、`gpu-memory-utilization` 0.9，并注明与优化无关。DeepSeek-R1 的 256 个路由专家与每 token 8 个见模型配置。
- **KV 传输端口。** Mooncake 连接器按全局 DP rank 偏移：

  ```
  side_channel_port = kv_port + data_parallel_rank × tp_size × pp_size × pcp_size
  handshake_port    = side_channel_port + device_index
  ```

- **示例 proxy。** `load_balance_proxy_server_example.py` 的 `_priority`：prefill 端取 `active_tokens + active_kv_cache × 0.3`，decode 端取 `active_tokens`，从小顶堆里取最小，被标成故障的后端排到最后 [C2]。负载按请求体字节数 `len(req_body)` 估：prefill 估分 `长度 ÷ 4 × 0.0345 + 120.0745` 记在 `active_kv_cache` 上，decode 记请求体长度、记在 `active_tokens` 上；prefill 端的 `active_tokens` 从不增加。发给 prefill 的请求带 `do_remote_decode` 并把 `max_tokens` 设为 1；命令行要求 hosts 与 ports 个数相等，再一一配对。

### 会报什么错

- 稠密模型开外置分派：`ValueError: Non-MoE models do not support external data parallel mode. For external load balancing, launch independent vLLM instances without --data-parallel-* arguments.` [C10]
- 给了 rank，又把本地 DP 个数写成 1 以外的值：vLLM `0fc695fc` 与 `568afb3a` 是 `AssertionError: data_parallel_size_local must be 1 or None when data_parallel_rank is set`；`84030bbe` 改成 `ValueError`，缺 rank 时提示用 `--nnodes` 和 `--node-rank` 推断 [C28]。
- 同时给了两种分派方式：`ValueError: Cannot use more than one data parallel load balancing mode.` [C7]
- 照抄官方文档会遇到四处问题（v0.23 维护分支与 `db701c1f` 的文档逐字相同）：

| 文档里写的 | 代码里的事实 | 后果 |
| --- | --- | --- |
| `--kv-transfer-config` 的 JSON 最后一项后面多一个逗号 [S16] | 这个参数用 pydantic 按 JSON 严格校验 [C35]，尾逗号不是合法 JSON；实测于 pydantic 2.13.5，报 `json_invalid: Invalid JSON: trailing comma` | 启动时参数解析失败；main 的文档已删掉这些逗号 |
| proxy 命令用 `--prefiller-hosts-num`、`--prefiller-ports-inc`、`--decoder-hosts-num`、`--decoder-ports-inc` | 示例 proxy 没有这四个参数，只接受逐个列出的 hosts 与 ports | argparse 报不认识的参数；要把 72 组 host、port 列全，或自己改脚本 |
| 模板设 `VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` 和 `VLLM_DP_SIZE_LOCAL` | vllm-ascend 的 `vllm_ascend/`、`examples/` 和 vLLM 的 `vllm/` 下都搜不到读取这两个名字的代码 | 设了没有作用 |
| `--additional-config` 里的 `enable_weight_nz_layout`、`enable_prefill_optimizations` | `vllm_ascend` 包内不读这两个键。v0.23、v0.26 的昇腾附加配置按键名逐个取值，不认识的键不报错；main 改成严格校验，不认识的键直接拒绝 [C37] | v0.23、v0.26 静默无效；main 启动时报配置校验错误（装了 vllm-omni 时只告警并丢掉这些键） |

### 开销和什么时候别开

- **MC2 的选择。** A2 的 `_select_a2_moe_comm_method` 要求 `num_experts_per_device <= 24 and ep_world_size >= 16 and num_tokens <= mc2_tokens_capacity`，否则 `ALLGATHER`；`ep_world_size = world_size_across_dp // pipeline_parallel_size` [C8]。A3 的 `_select_a3_moe_comm_method` 只比 token 数，超过走 `ALLTOALL`；融合版由 `VLLM_ASCEND_ENABLE_FUSED_MC2` 控制、默认 0，取 1 时还要求 EP 组不超过 32 张卡。传入的 token 数是 DP 组里的最大值 [C13]。三个版本的差异见 [EP 页的版本差异](expert-parallel.md#版本差异)。
- **物理要求。** 所有机器在同一局域网、NPU 全互通；A2 机内 HCCS、机间 RDMA，A3 机内机外都是 HCCS [S14]。
- **A2 的分层通信。** `HCCL_INTRA_PCIE_ENABLE=1` 且 `HCCL_INTRA_ROCE_ENABLE=0`，或打开 `enable_mc2_hierarchy_comm` 时生效；代码注释说它能减少跨机流量 [C26]。它要求各 rank 的 token 数一致（`global_bs = 0`），所以和下一条的跳过同步互斥。GLM 双机的教程没有设这两个变量。
- **decode 侧跳过每步的 DP 同步。** 只在 MoE 模型的 KV consumer 一侧、没开分层通信时考虑：decode 必须走 MC2，并且 prefill 的最大批也走 MC2 或开了 recompute scheduler，才跳过 DP 组内每步对齐 token 数的那次 All-Reduce；跳过后各 rank 的 token 数可以不同，MC2 改用真实的 `global_bs`、不传 `mc2_mask` [C25]。
- **P 侧要预热。** 部分算子要跑几轮才到最佳性能，文档建议压测前先用一些请求预热服务。
- **只靠环境变量传 DP 参数。** 官方文档模板只设 `VLLM_DP_SIZE`、`VLLM_DP_RANK` 等环境变量，不给 `--data-parallel-*`；上游只在命令行 DP 大小不大于 1 时回退读这些变量，注释写的是离线 SPMD 场景 [C24]；这时外置分派的那几项检查（稠密模型拦截、本地 DP 个数为 1、只起一个 API server）都不经过。建议改用 `examples/external_online_dp` 模板的命令行参数。
- **什么时候别开。** 稠密模型直接起独立实例；一台机器装得下、并发不高时，内置分派更简单；多机之间达不到同一局域网全互通时不要拉成一个 EP 组；长 prefill 和短 decode 混在一起、又不做 PD 分离时，组越大越容易被拖离 MC2。

### 版本差异

对照的是 vllm-ascend 的 v0.23 维护分支 `2c59ff10`、v0.26 `2ed6cbba`、main `baa023ad`，以及它们配套的 vLLM `0fc695fc`、`568afb3a`、`84030bbe`；GLM 算例用的 `db701c1f` 在本页涉及的文档与示例上和 v0.23 维护分支一致。

| 项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| 官方文档 | MyST 的 tab 写法 | 换成 mkdocs-material 的写法，另加一处提示框；参数和脚本不变 | 同 v0.26，并删掉 4 处 JSON 尾逗号和 proxy 命令末尾多余的续行符 [S29] |
| 纯 DP 外置分派的 proxy 示例 | 有 `dp_load_balance_proxy_server.py`，按请求长度挑后端 | 已删除 | 已删除 |
| PD 示例 proxy 的挑法 | prefill 比估分账，decode 比长度账 | 相同 | 相同 |
| Mooncake 端口偏移 | 按 DP rank × TP × PP × PCP 偏移 | 相同 | 相同，代码拆进 `mooncake/` 子目录 |
| 上游外置分派 | 给编号即外置；本地 DP 个数不对时 AssertionError | 相同 | 改为 ValueError；fault tolerance 只能在外置分派下开 |
| 附加配置里不认识的顶层键 | 忽略，不报错 | 忽略，不报错 | 拒绝，启动报错 |
| A2 / A3 的 MoE 通信选择 | 见 EP 页 | 见 EP 页 | 见 EP 页 |

v0.26 起，不做 PD 分离的纯 DP 外置分派没有现成的 proxy，需要自己写外部路由。官方文档里「推荐在 v0.9.1 正式版上使用」这句在三个分支里都没改，而这套做法已经随 v0.23、v0.26 和 main 一起发布。三版都要显式打开 EP，外置分派也都只对 MoE 开放。

### 源码位置

| 看什么 | 在哪 |
| --- | --- |
| 外置分派字段与只管本地引擎 | `vllm@0fc695fc:vllm/config/parallel.py`，`data_parallel_external_lb`、`local_engines_only` |
| 命令行参数、稠密模型拦截、本地 DP 个数 | `vllm@0fc695fc:vllm/engine/arg_utils.py`，`create_engine_config` 的 DP 分支 |
| 四种分派方式与启动落点 | `vllm@0fc695fc:vllm/entrypoints/cli/serve.py` |
| 环境变量回退 | `vllm@0fc695fc:vllm/config/parallel.py` 的 `__post_init__`，`VLLM_DP_*` |
| 上游部署文档 | `vllm@0fc695fc:docs/serving/data_parallel_deployment.md`、`docs/serving/expert_parallel_deployment.md` |
| 官方大规模 EP 文档 | `vllm-ascend:docs/source/user_guide/feature_guide/large_scale_ep.md` |
| 启动模板 | `vllm-ascend:examples/external_online_dp/run_dp_template.sh`、`launch_online_dp.py` |
| 示例 proxy | `vllm-ascend:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`，`_priority`、`assign_instances` |
| MC2 选择与 DP 最大 token 数 | `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py` |
| 跳过 DP 同步、分层通信开关 | `vllm-ascend@db701c1f:vllm_ascend/utils.py`，`should_skip_allreduce_across_dp_group`、`is_hierarchical_communication_enabled` |
| KV 传输端口偏移 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py`，`side_channel_port` |

**正文证据索引。** 大规模 EP 与 PD 分离的关系、官方示例的机器与主节点安排见 [S9]，推荐配置表见 [S1]；内置分派的前端瓶颈、hybrid 与外置三种方式见 [S11]，prefill 与 decode 分别用不同通信后端见 [S12]；示例 proxy 的记账和挑法见 [C19]，请求先 P 后 D 的走法见 [C4]。官方示例的服务数、每卡专家数与端口值，以及正文三个算式，都是按上述配置、源码里的公式和标明的示意数代入得到的 [D]：示意模型的专家权重沿用 EP 页的设定，只做除法；「至少一个 rank 带长 prefill」假设各 rank 每步独立、概率相同，只用来说明趋势，不是任何部署的实测；示例 proxy 的估分按源码里的线性式代入示意的请求体长度。

**待核：缺以下材料。**

- 官方文档模板只用环境变量传 DP 参数、不给 `--data-parallel-rank` 时，在线服务是否仍按外置分派运行：缺按文档原样启动的日志。
- 官方示例 D 侧（一步最多 256 个 token、28 条请求）是否满足跳过 DP 同步的条件：缺该配置下的容量门槛与启动日志。
- EP16 以上的 GLM 部署：缺配置与实测，本页不给这类部署的任何数字。
- 跨机器的实际流量占比、分层通信的收益、专家负载的真实分布：缺 HCCL / 网卡 trace 和逐层逐专家的路由统计。
