---
id: large-scale-ep
title: 大规模 EP：请求路由、专家域与跨机通信
type: feature
legacyAnchors:
  放到-glm-双机ep16-是跨机的第一档: 复杂异构实战对照：GLM 双机 EP16 跨机第一档
summary: 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端点与进程的区别。
aliases:
  - Large-Scale EP
  - 大规模专家并行
  - 大规模 EP
  - wide-EP
  - 分层通信
  - enable_mc2_hierarchy_comm
  - should_skip_allreduce_across_dp_group
  - Distributed DP Server
  - 分布式 DP server
  - 外置 DP 负载均衡
  - external DP LB
  - data_parallel_external_lb
  - large_scale_ep
  - VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED
  - load_balance_proxy_server_example
  - external_online_dp
chapters:
  - '14'
order: 20
sources:
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L479-L489
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L276-L287
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L789-L806
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L898-L945
  - 'vllm@0fc695fc:vllm/config/parallel.py#L138-L144'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L514-L520'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L148'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L239-L282'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L5-L6
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1859-L1882'
  - 'vllm@0fc695fc:docs/serving/data_parallel_deployment.md#L75-L106'
  - 'vllm@0fc695fc:docs/serving/expert_parallel_deployment.md#L225-L234'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L96-L101'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L10-L13
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L239-L295
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L126-L167
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L317-L362
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L205-L211
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L352-L410
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L644-L682
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2027-L2036
  - 'vllm-ascend@db701c1f:examples/external_online_dp/run_dp_template.sh#L18-L21'
  - 'vllm-ascend@db701c1f:examples/external_online_dp/launch_online_dp.py#L54-L59'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L800-L831'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1257-L1298'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L115-L133'
  - 'https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/56d4cbbb4d29f4355bab4b9a39ccb717a14ad5ad/config.json'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2205-L2240'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/large_scale_ep.md#L150-L160
  - >-
    vllm-ascend@2c59ff10:examples/external_online_dp/dp_load_balance_proxy_server.py#L148-L160
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L101-L102'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1169-L1172'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2005-L2030'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L33-L55'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L326-L337'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L492-L496
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1658-L1679'
  - >-
    raw:sha256-d990647916dbe31b7c0c53a1b86e440803a723eba04c54600568020a9bb4461d.md#L1-L924
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1271-L1302'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1320-L1361'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_forward_context.py#L243-L274'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_forward_context.py#L373-L414'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1269-L1307'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1323-L1361'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L31-L50'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1893-L1912'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2220-L2258'
  - 'vllm@ced6857a:vllm/config/parallel.py#L515-L518'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2184-L2193'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L59'
  - 'vllm-ascend@7d825229:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L234-L240'
  - 'vllm-ascend@7d825229:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L305-L328'
  - 'vllm@ced6857a:vllm/entrypoints/cli/serve.py#L105-L154'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L659-L677'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L447-L450'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L375-L426'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1385-L1435'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L420-L455'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1389-L1445'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: collective-communication
    kind: builds-on
    note: 理解 All-to-All、All-Gather 与跨机比例 (M-1)/M 的传输量规律
  - to: cann-hccl
    kind: builds-on
    note: 区分机内 HCCS 与跨机 RoCE/RDMA 两级物理链路以及 HCCL 通信域建组边界
  - to: data-parallel
    kind: builds-on
    note: 理解请求副本与 EP 组的关系以及空闲 DP 组陪跑机制
  - to: expert-parallel
    kind: builds-on
    note: 理解专家放置和 Dispatch/Combine 派发组合
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-2faf61f38f71203ce1cbe5aff2e0f61fff521b605249a2aa721244f207336c4c.md
  - >-
    raw/sha256-d990647916dbe31b7c0c53a1b86e440803a723eba04c54600568020a9bb4461d.md
---

## 大规模 EP 是什么？

**大规模 EP（large-scale EP，也叫 wide-EP）是把 MoE 模型的专家并行铺到很多台机器上：几十到上百张卡合起来只放一套专家，每张卡只分到很少几个；token 每层都要在这整组卡之间来回交换，其中很大一部分要跨机器。**

```wiki-diagram
file: large-scale-ep-plate-cutaway
```

先用两句话回顾 [EP（专家并行）](expert-parallel.md)。MoE 模型每层有一池路由专家，router 给每个 token 选出分数最高的 $k$ 个。EP 把这池专家整份分到几张卡上：token 选中哪个专家，就把它的 hidden（层间传递的向量）**dispatch（派发）**到持有该专家的卡上，算完再 **combine（收回并组合）**回原卡按权重相加。一起分这一套专家、每层互相交换 token 的那组卡，叫一个 **EP 组**。

EP 组从一台机器的几张卡变成几十台机器的上百张卡，专家怎么摆、token 往哪发、每张卡忙不忙都跟着变。沿用 EP 页的 4 个 token 标签「我、吃、了、苹果」：每层 8 个路由专家 E0–E7，每个 token 选 k = 2 个；我选 E3、E4，吃选 E2、E1，了选 E3、E7，苹果选 E3、E5。这里的标签可以来自四条不同请求，不表示 DP 把同一句话拆开。上半是一台机器 4 张卡（EP4），每卡放 2 个专家；下半把同样 8 个专家摊到两台机器的 8 张卡上（EP8），每卡 1 个。图从 MoE 层入口开始观察：4 个 token 已在各自源卡，下半每台机器各有 2 个。[数据并行（DP）](data-parallel.md)把完整请求分给执行组，到了 MoE 层，token 才按选中的专家交换；这两次分派依据不同。

```wiki-diagram
file: large-scale-ep
```

对照上下两半，数三样东西：

- **每卡的专家：2 个变 1 个。** 专家权重要一直放在卡上，组越大，每张卡要存的越少。
- **派发的去向。** 两种放法都有 7 份要发到别的卡（吃选的 E2 正好在本卡）。EP4 的 7 份都在一台机器里；EP8 有 3 份要跨到另一台机器：我→E4、了→E3、苹果→E3。机器之间的链路一般比机内慢，dispatch 和 combine 又要等所有份到齐，这 3 份拖住的是整层。
- **每卡的活。** 路由没变，E3 仍被 3 个 token 选中。EP4 里放着 E2、E3 的卡 1 收到 4 份，平均每卡 2 份；EP8 里 E3 独占卡 3，收到 3 份，平均却降到 1 份，还有两张卡这一步没有活。卡多了一倍，最忙的那张卡只少了 1 份。

这个例子为了只看「专家摊开」这一件事，批次固定为 4 个 token。实际加机器是为了接更多请求，新机器会带来自己的 token；但上面的趋势不变：每卡专家变少，派发的目的地变多、跨机的比例变大，各卡的工作量更容易参差。

组铺到几十台机器，部署的组织方式也跟着变：常见做法是每个 DP rank 各起一个独立的服务，由 vLLM 外面的路由程序分请求，并把 prefill 和 decode 分到不同的机器上。这两件事放在[后面两节](#每个-dp-rank-怎样各自成为一个服务)讲。

外部路由程序选择的是请求入口，专家布局和 EP 通信组决定后续专家计算涉及哪些机器。请求 A 进入某台机器后，若 MoE 层选中了别的机器上的专家，就要把 hidden 发过去，再收回结果。

## 为什么要把 EP 组铺这么大，代价在哪？

**在这里的专家常驻、均匀分配示意中，EP 组越大，每张卡分到的专家权重越少，能给 KV cache 留出更多容量。能否提高并发或缩短 decode，还要看实际路由、缓存预算和通信耗时。代价是派发的去向更散、更多跨机，而且整组的进度受最慢的参与者制约。**

为什么专家要全部常驻，EP 页讲过（见[为什么需要 EP](expert-parallel.md#为什么需要-ep)）：下一个 token 选谁事先不知道，每层每个路由专家都得随时可用。接着那里的示意模型：40 层，每层 128 个专家，一个专家 12 MiB，专家权重一共 60 GiB。组越大，每卡分到的越少：

$$M_{\text{all}} = 40 \times 128 \times 12\text{ MiB} = 61{,}440\text{ MiB} = 60\text{ GiB}, \qquad M_{\text{rank}} = \frac{M_{\text{all}}}{\text{EP}}$$

| 并行档位（示意模型，共 60 GiB 专家权重） | 每卡每层专家数 | 每卡常驻专家权重算式与结果 |
| --- | --- | --- |
| EP4 | $128 \div 4 = \mathbf{32\text{ 个}}$ | $60\text{ GiB} \div 4 = \mathbf{15\text{ GiB}}$ |
| EP16 | $128 \div 16 = \mathbf{8\text{ 个}}$ | $60\text{ GiB} \div 16 = \mathbf{3.75\text{ GiB}}$ |
| EP64 | $128 \div 64 = \mathbf{2\text{ 个}}$ | $60\text{ GiB} \div 64 = \mathbf{960\text{ MiB}}$ |

省下来的显存有两处潜在用场。**一是放 KV cache**：普通注意力层为已处理的位置保存 K、V，MLA 和 KDA 的状态形式另见[KV cache](kv-cache.md)；其他占用不变时，权重少占的容量可以留给更多或更长的请求。**二是减少单卡的专家工作**：若 decode 小批次受读取权重的带宽限制，分散专家后应比较每卡本步实际选中的专家和读取量；这些量由路由、缓存与算子组织共同决定，不能按驻留容量的下降比例推加速。组里更多 token 选中同一专家时，还能增加权重复用机会（见[矩阵乘和权重](matmul-and-weights.md#同一片权重为什么能处理多行输入)）。只有这部分节省超过新增通信和等待，decode 才会更快。

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

**内置负载均衡可以对外提供同一个 HTTP 地址和端口，由主节点上的一个或多个 API server 进程接请求，再挑一个 DP rank 派过去。一个服务入口不等于一个前端进程。大规模 EP 常改用外置负载均衡：每个 DP rank 各起一套服务、有自己的端口，由 vLLM 外面的路由程序决定请求去哪个 rank；这些 rank 仍在同一个 EP 组里，每层 MoE 一起交换 token。**

先说 DP rank。DP 把模型的 attention 和稠密层复制成几份，每份叫一个 DP rank，各自调度、各算各的请求；路由专家却只有一份，摊在全组的卡上（见[数据并行](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。一个 DP rank 可以只占一张卡，也可以占几张卡、再用 TP 把矩阵切开合算。

**默认的内置分派。** 一个 vLLM 服务由几类进程组成：API server 接 HTTP 请求、分词，再交给引擎；EngineCore 负责调度、驱动各卡计算；每张卡还有一个 Worker 进程守着它执行（分工见[引擎的进程](engine-processes.md)）。内置方式下，主节点上的 API server 按各 rank 排队的情况打分，挑分最低的 rank（规则见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)）。vLLM 的部署文档提醒，DP 规模很大时，这个集中在主节点上的前端可能成为瓶颈；多开几个 API server 能缓解，但它们仍挤在主节点上。

**外置负载均衡。** 另一条路是把每个 DP rank 当作独立部署。启动时指定自己的 DP rank 编号后，本机只管这一个 rank：只起本地引擎，默认配一个 API server，且前端只连本机 EngineCore（显式调大 API server 数时，多前端也只服务这一个 rank）。单个 rank 仍是一整套进程（前端 + EngineCore + 每卡一个 Worker），所以外部可见端口数不等于进程数。各 rank 启动前须约好 DP 总数和 DP 主节点地址/端口，上线后统一握手组成 MoE 通信组。vLLM 还提供折中的 hybrid 方式：每台机器设一个入口只分给本机 rank，机器之间交由外部路由分派。

这里讨论的跨 rank 协作面向 MoE 模型。稠密模型的各个副本之间不用一起走，想从外面分派，可以直接起几个互不相干的 vLLM。固定版本的外置 DP 分派本身要求 DP 大于 1；在此前提下，非 MoE 模型还会被另一道校验拒绝。不能把后一道校验简化成“稠密模型只要给了 rank 就报错”，也不能反推 MoE 的 DP1 可以启用外置模式。

```wiki-diagram
file: large-scale-ep-flow
```

**外部路由怎么挑。** 分派交出去以后，谁去哪个 rank 由外部程序决定。vllm-ascend 仓库里的示例 proxy 不是轮流发，而是给每个后端记一本账：每派出一条请求，按请求体的长度（字节数，不是 token 数）估一笔负载记上，处理完再减掉。decode 端记的就是请求体长度；prefill 端记的是由长度折算出的估分。挑 prefill 端时比各自手上的估分之和，挑 decode 端时比各自手上的请求体长度之和，都取最小的（请求体长度为示意；请求体长 10 倍，估分只约 3 倍，因为常数项 $120.0745$ 占了大头，更接近在数手上还有几条请求）：

$$\text{Score}_{\text{prefill}}(L) = \frac{L}{4} \times 0.0345 + 120.0745$$

| 请求类型（示例 proxy 估分，示意） | 请求体长度 $L$ | 算式 | Prefill 估分 |
| --- | --- | --- | --- |
| 短请求 | $4{,}000$ B | $4{,}000 \div 4 \times 0.0345 + 120.0745$ | **约 154.6** |
| 长请求 | $40{,}000$ B | $40{,}000 \div 4 \times 0.0345 + 120.0745$ | **约 465.1** |

这本账是 proxy 自己在派出和结束时加减的估算，不是从设备上实时读出的利用率；换一个外部路由，规则也可以完全不同。一条请求的走法见上图右半：proxy 先把请求发给挑中的 prefill 端，并限定它只生成 `1` 个 token。prefill 端返回 KV 传输参数后，proxy 把参数交给挑中的 decode 端；随后 decode 端通过连接器直接从 prefill 端取 KV cache，proxy 本身不搬 KV。

## 为什么常和 PD 分离一起用？

**大规模 EP 可以与 PD 分离配合：prefill 一步可能有成千上万个 token，decode 每条请求的步宽通常较小，两种负载适合的通信方式和批大小不同。混在一个大组里，一个 rank 上的长 prefill 可能使全组改用大批次的通信路径。拆开以后，两边可以分别选择并行布局和参数。**

PD 分离把一条请求的 prefill 和 decode 交给两组不同的机器：prefill 一侧算完提示词，把 KV cache 交给 decode 一侧接着生成（见 [PD 分离](pd-disaggregation.md)）。

为什么和大规模 EP 特别搭，关键在 MoE 层的全组同路规则。以“A2 满足规模条件、A3 未开融合模式”的常规选路为例：

- **按最大值统一选路**：每一步取 DP 组内各 rank token 数的**最大值**；未超容量门槛走 MC2（通算融合，仅发被选中专家的 token 副本），一旦超限，A2 改走整批收齐的 All-Gather，A3 改走按目的地整批交换的 All-to-All。
- **一处超门槛长 Prefill 拖走全组**：只要有一个 rank 塞进一段使本步最大 token 数越过 MC2 容量门槛的长 prefill，其余只做 decode 的 rank 也跟着换路，还得把输入补齐到同一行数（见[并发请求的第 4 站](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)）。
- **A3 融合模式例外**：A3 开启模式 1 且 `EP <= 32` 时，超容量仍可选融合 MC2，详细分支见文末源码说明。

组越大，这种被一个 rank 拖走的步就越多（四族硬件如何依据 token 数、EP 规模与硬件档位选择 `MC2 / FUSED_MC2 / ALLTOALL / ALLGATHER`，详查 [MoE 通信派发](moe-comm-dispatch.md#四族硬件调度状态机hardware_profilepy--ascend_forward_contextpy)）。示意：假设每个 rank 每一步有 $p = 5\%$ 的机会带着长 prefill，各 rank 互不相干（组越大，几乎每一步都有 rank 在做 prefill）：

$$P(\text{至少 1 个 rank 带长 prefill}) = 1 - (1 - p)^R$$

| DP Rank 总数 $R$（示意，$p = 5\%$） | 算式 | 至少 1 个 rank 带长 prefill 的概率 |
| --- | --- | --- |
| $R = 2$ | $1 - 0.95^2 = 0.0975$ | **约 10%** |
| $R = 16$ | $1 - 0.95^{16}$ | **约 56%** |
| $R = 64$ | $1 - 0.95^{64}$ | **约 96%** |

拆成 P、D 两侧以后，decode 一侧的每一步只有 decode 的 token，能稳定留在小批次的路子上；prefill 一侧专门处理大批次。两侧还能各选各的参数：prefill 一侧一步收很多 token、同时处理的请求少；decode 一侧一步收的 token 少、同时处理的请求多，还能用 graph mode（把一步的算子序列录下来整段重放）省掉逐个下发算子的开销。上游 vLLM 的 EP 部署文档也是这样配的：prefill 实例用面向吞吐的通信后端，decode 实例用面向低延迟的后端。

这里的小批次只描述负载形态，实际能否命中 MC2 还要过硬件门槛。固定 Atlas A2 实现要求三个条件同时成立：每卡路由专家数（总专家数整除 EP 组大小）不超过 `24`、EP 组不少于 `16` 张卡、当前步 token 数不超过容量门槛。因此即使分离后的 decode 批很小，也必须同时核对专家分布与组大小；任一不满足就会回落其他通信路径。

代价是另一套东西：P、D 之间要搬 KV cache，两组资源要分别扩缩和管理。拆不拆要看输入输出长度、请求分布、网络和容量；PD 分离也不是 EP 的前提，一台机器之内的 EP 不拆照样能跑。

## 官方示例：8 台 A3 怎样分成 P、D 两个专家域

**`vllm-ascend` 官方文档用 8 台 Atlas 800T A3 服务器部署 DeepSeek-R1 演示这套做法。** 前 4 台做 prefill，每台自成一个 EP16 组；后 4 台做 decode，合起来是一个 EP64 组；一共 72 个 DP rank，每个都是独立服务。这是另一个模型、另一代硬件上的配置，下面的数只用来看组织方式，不代入 GLM。

DeepSeek-R1 的 MoE 层有 256 个路由专家，每个 token 选 8 个；本示例按每台 A3 的 16 个可见逻辑设备计数，物理卡与逻辑设备的区别见[硬件与设备](hardware-devices.md)。文档里的推荐配置：

| | prefill 一侧（P） | decode 一侧（D） |
| --- | --- | --- |
| 机器 | 4 台，每台 16 个逻辑设备 | 4 台，每台 16 个逻辑设备 |
| 每台怎么切 | 2 个 DP rank，每个 TP8 | 16 个 DP rank，每个 TP1 |
| EP 组 | 每台自成一个 EP16，DP 主节点各用自己 | 4 台合成一个 EP64，DP 主节点都用第 5 台 |
| 单步 token 上限 | `16384`（关掉 graph mode） | `256`（保留 graph mode） |
| 单 rank 同时请求上限 | `4` 条 | `28` 条 |

文档注明这组参数不针对优化，要按实际场景调。P 一侧的 4 个 EP16 互不相干，一条请求的 prefill 只在其中一台里做；D 一侧的 64 个 rank 每层一起交换 token。两侧合计 128 个逻辑设备，分属这些不同的 EP 组。

这组推荐配置对应的负载条件是：平均输入长度 3.5k、平均输出长度 1.1k、上下文长度 16k、数据集最大输入长度 7k。输入与输出长度会改变 prefill 和 decode 两侧承担的工作量，因此比较或借用这组配置时，也要保留这些负载条件。

```wiki-diagram
file: large-scale-ep-deploy
```

每个 DP rank 是一个服务。数一数一共有多少个服务、每个逻辑设备放多少专家：

$$N_{\text{services}} = (4 \times 2)_{P} + (4 \times 16)_{D} = 8 + 64 = 72$$

| 统计项（官方 8 台 A3 部署 DeepSeek-R1 256 专家示例） | 算式 | 结果 |
| --- | --- | --- |
| P 侧服务数（4 台 × 2 rank/台） | $4 \times 2$ | **8 个服务** |
| D 侧服务数（4 台 × 16 rank/台） | $4 \times 16$ | **64 个服务**（P+D 合计 **72 个**） |
| P 侧每逻辑设备路由专家数（每台 EP16） | $256 \div 16$ | **16 个专家** |
| D 侧每逻辑设备路由专家数（4 台合 EP64） | $256 \div 64$ | **4 个专家** |

每个服务的 HTTP 端口从 9000 起，按本机的 rank 依次加一。72 只数外面能访问的服务，没有算服务里面的进程：P 一侧每个 rank 占 8 个逻辑设备，就有 8 个 Worker。

两侧搬 KV cache 还要约定传输端口。文档里 64 个 decode 服务都写同一个基端口 `20001`，看似冲突，实则连接器会自动偏移：

- **端口偏移公式**：实际监听端口 = `基端口 + DP rank 编号 × 该 rank 所占逻辑设备数 + rank 内设备编号`。
- **D 侧（每 rank 1 卡）**：0 号 rank 用 `20001`，63 号用 `20064`，彼此错开。
- **P 侧（每 rank 8 卡）**：0 号占 `20001–20008`，1 号占 `20009–20016`；4 台 P 机器的 rank 编号均从 0 起、端口号相同，靠机器 IP 区分。

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

跨机链路随硬件代际变化。官方文档要求所有机器处于同一局域网且所有 NPU 彼此互通：A2 机内走 HCCS、跨机走 RDMA 网络（网卡直接读写对端内存），A3 机内机外均走 HCCS。面对大规模 EP 的跨机尾时延，昇腾从两处压缩等待：一是 A2 可开启**分层通信**（`enable_mc2_hierarchy_comm`），不再让本机 8 张卡各自向对端机器零散发起跨机小包（跨机比例高达 $(M-1)/M$），而是先经机内高速 HCCS 把发往同一远端节点的 token 汇聚，再经单次跨机传输送出并在目标机内二次分发，大幅降低跨机流量与小包拥塞。由于分层通信要求各 rank 每步 token 数一致（`global_bs = 0`），它不能与“decode 侧跳过每步 DP 元数据同步”同时生效。二是 A3 / 950DT 在开启融合路径（`FUSED_MC2` / `CANN MegaMoe`）时，把原本串行阻塞的 `dispatch → 专家分组矩阵乘 → combine` 切分成细粒度微块流水重叠，让网络搬运与片上专家计算并行推进，详细算子与缓冲机制见 [MoE 通信调度状态机](moe-comm-dispatch.md#四类-moe-通信实现各自做什么)。

```wiki-diagram
file: large-scale-ep-fig-hierarchy-comm
```

**落到 `v0.30.0` 主基线与 `main`，跨机选路与跳过同步有三点必须核对：**

- **硬件画像驱动选路**：MoE 通信选路已统一收敛至 `select_moe_comm_method`，开启 `LoRA + EP` 时强制走 `ALLTOALL`，不再沿用旧静态分支。
- **decode 跳过 DP 同步的额外排除项**：先满足 `kv_consumer`、关闭分层通信且 decode 走 `MC2/FUSED_MC2`。在此之上，`v0.30.0` 明确排除了 `MegaMoe` 路径并要求 prefill 侧图模式不区分 P/D；`main` 进一步排除细粒度 `qkv_iproj_tensor_parallel_size > 1`。
- **严格配置校验**：`v0.30.0` 起 `additional_config` 默认启用严格字段校验，照抄早期文档中的废弃键会直接触发启动报错（四版对照见文末[版本差异](#版本差异)）。

## 复杂异构实战对照：GLM 双机 EP16 跨机第一档

**GLM 双机的 EP16 已经是跨机 EP：16 张卡分在两台 A2 上，每卡 18 个路由专家，每层的 dispatch 和 combine 有一部分要跨机器。但它的部署形态不是大规模 EP：只有一个 API server，第二台机器以 headless 方式加入，没有外部 proxy，也没有 PD 分离。本站没有超出 EP16 的部署和实测，下面把 EP16 当作基线。**

部署前提（两台 Atlas 800T A2、每台 8 张卡、TP8/DP2/EP16、W8A8 权重）见[部署前提](glm-5-3-flash-two-node.md#部署前提)。16 张卡按「DP 组号 × 8 + 本机卡号」编号，EP 组就是全部 16 张卡（见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。288 个路由专家按编号连续分：卡 r 放 18r 到 18r + 17 号，机器 0 的 8 张卡合起来放 0–143 号，机器 1 放 144–287 号（见 [EP 页的分法](expert-parallel.md#16-张卡怎样分专家)）。

**为什么是两台：正好踩中 A2 的 MC2 最小档。** 若放进单机 8 卡，EP 只有 8、每卡 36 个专家，A2 选 MC2 的两条规模条件全不满足；铺到两台 16 卡后，每卡降到 18 个专家、EP 正好 16，满足门槛。在部署页的语言模型权重子账算例中，KV cache 可分配块数约为单机的 2.5 倍（该子账未扣视觉塔、MTP 旋转矩阵与量化辅助张量，不能当实机容量，唯一出处见[为什么是两台机器](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)）。

**入口仍是内置分派。** 机器 0 起 API server、DP 协调进程和 DP 组 0 的 EngineCore；机器 1 用 headless 方式启动，不起前端，只有 DP 组 1 的 EngineCore（进程清单见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)）。请求由机器 0 的前端按排队打分派到两组之一，没有前面那种一个 rank 一个服务的外置分派。

**通信和负载的基线。** 下表的数都已在别页推导，这里只汇总。场景 M 是[并发请求](concurrent-requests.md#示例场景-m-与变体-m)页的示例：机器 0 上 12 条请求在 decode、同时来了一条 6000 个 token 的新请求，机器 1 上 7 条请求在 decode。

| 看什么 | GLM 双机 EP16 | 推导在哪 |
| --- | --- | --- |
| 走 MC2 的条件 | 两组这一步的最大 token 数不超过 128 | [一条请求的 MoE 站](one-request.md#moe-通信走-mc2-还是-allgather) |
| 场景 M 去掉长 prefill、只剩 decode 时，每卡每步的 EP 交换 | 上界约 31.5 MiB | [EP 页的每卡账](expert-parallel.md#场景-m-的每卡账权重均分工作量看路由) |
| 场景 M | 两台一起换成 All-Gather，所列张量载荷约 4.15 GiB/卡/步，实际链路流量另测 | [并发请求的第 4 站](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛) |
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

- **前提。** 模型必须是 MoE，打开 EP（`--enable-expert-parallel`）并给出 DP 参数；外置 DP 分派本身要求 DP>1 [C55]。本页 PP1、PCP1 示例的 EP 组大小由 TP × DP 推出，其他组合见 [EP 页的怎么开](expert-parallel.md#怎么开)。
- **让一个进程成为外置分派下的一个 rank。** 命令行给 `--data-parallel-rank`。上游把这种模式叫 external DP LB，字段 `data_parallel_external_lb` 的注释写明它面向 Kubernetes 里 one-pod-per-rank 的 wide-EP，只支持 MoE [C5]。给了编号以后：本地 DP 个数固定为 1，`api_server_count` 默认为 1，客户端只管本地 EngineCore（`local_engines_only` 为真）[C10]。启动 rank 的完整取值与三版约束统一见[进程页参数参考](engine-processes.md#怎么开)。
- **DP 主节点。** `--data-parallel-address` 加 `--data-parallel-rpc-port`。官方示例里 4 台 P 机器各自当主节点，4 台 D 机器都指向 192.0.0.5，D 机器的起始 rank 依次是 0、16、32、48 [S15]。
- **四种分派方式互斥。** 内置（默认）；hybrid（`--data-parallel-hybrid-lb`，或给了 `--data-parallel-start-rank` 且不是 headless）；外置（`--data-parallel-external-lb` 或给了 `--data-parallel-rank`）；multi-port 外置。启动入口按「multi-port → headless → 多个 API server → 单个 API server」的顺序落到一种。外置 rank 默认 API 数量为 1，因而走最后一种；显式设为多个时走多 API 分支 [C7]。GLM 双机的机器 1 走 headless 那一支。
- **能直接用的模板。** `examples/external_online_dp/run_dp_template.sh` 用 `--data-parallel-size`、`--data-parallel-rank`、`--data-parallel-address`、`--data-parallel-rpc-port` 四个命令行参数；`launch_online_dp.py` 按本地 rank 把可见设备切成每 rank `tp_size` 张卡，HTTP 端口从起始端口依次加一。
- **官方示例的参数。** P 侧 `--max-num-batched-tokens 16384 --max-num-seqs 4 --enforce-eager`，D 侧 256 和 28、不加 eager；推荐表另给 `max-model-len` 17000、`gpu-memory-utilization` 0.9，并注明与优化无关。DeepSeek-R1 的 256 个路由专家与每 token 8 个见模型配置。

- **KV 传输端口。** Mooncake 连接器按全局 DP rank 偏移：

  ```
  side_channel_port = kv_port + data_parallel_rank × tp_size × pp_size × pcp_size
  handshake_port    = side_channel_port + device_index
  ```

- **示例 proxy。** `load_balance_proxy_server_example.py` 的 `_priority`：prefill 端取 `active_tokens + active_kv_cache × 0.3`，decode 端取 `active_tokens`，从小顶堆里取最小，被标成故障的后端排到最后 [C2]。负载按请求体字节数 `len(req_body)` 估：prefill 估分 `长度 ÷ 4 × 0.0345 + 120.0745` 记在 `active_kv_cache` 上，decode 记请求体长度、记在 `active_tokens` 上；prefill 端的 `active_tokens` 从不增加。发给 prefill 的请求带 `do_remote_decode` 并把 `max_tokens` 设为 1；命令行要求 hosts 与 ports 个数相等，再一一配对。

### 会报什么错

- 外置 DP 分派配 DP≤1：配置层直接拒绝，和下条非 MoE 模型校验是两道独立条件 [C55]。
- 稠密模型同时设置 DP 大小大于 1 和外置分派（显式开关或指定 rank）：`ValueError: Non-MoE models do not support external data parallel mode. For external load balancing, launch independent vLLM instances without --data-parallel-* arguments.` [C10]
- 给了 rank，又把本地 DP 个数写成 1 以外的值：vLLM `0fc695fc` 与 `568afb3a` 是 `AssertionError: data_parallel_size_local must be 1 or None when data_parallel_rank is set`；`84030bbe` 改成 `ValueError`，缺 rank 时提示用 `--nnodes` 和 `--node-rank` 推断 [C28]。
- 同时给了两种分派方式：`ValueError: Cannot use more than one data parallel load balancing mode.` [C7]
- 照抄官方文档会遇到四处问题（v0.23 维护分支与 `db701c1f` 的文档逐字相同）：

| 文档里写的 | 代码里的事实 | 后果 |
| --- | --- | --- |
| `--kv-transfer-config` 的 JSON 最后一项后面多一个逗号 [S16] | 这个参数用 pydantic 按 JSON 严格校验 [C35]，尾逗号不是合法 JSON；实测于 pydantic 2.13.5，报 `json_invalid: Invalid JSON: trailing comma` | 启动时参数解析失败；main 的文档已删掉这些逗号 |
| proxy 命令用 `--prefiller-hosts-num`、`--prefiller-ports-inc`、`--decoder-hosts-num`、`--decoder-ports-inc` | 示例 proxy 没有这四个参数，只接受逐个列出的 hosts 与 ports | argparse 报不认识的参数；要把 72 组 host、port 列全，或自己改脚本 |
| 模板设 `VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` 和 `VLLM_DP_SIZE_LOCAL` | vllm-ascend 的 `vllm_ascend/`、`examples/` 和 vLLM 的 `vllm/` 下都搜不到读取这两个名字的代码 | 设了没有作用 |
| `--additional-config` 里的 `enable_weight_nz_layout`、`enable_prefill_optimizations` | `vllm_ascend` 包内不读这两个键。v0.23、v0.26 的昇腾附加配置按键名逐个取值，不认识的键不报错；main 以 extra=forbid 严格校验，不认识的顶层键直接拒绝 [C37][C45] | v0.23、v0.26 静默无效；main 启动时报配置校验错误（检测到 vllm-omni 时先告警并过滤未知顶层键） |

### 开销和什么时候别开

- **MC2 的选择。** A2 的 `_select_a2_moe_comm_method` 要求 `num_experts_per_device <= 24 and ep_world_size >= 16 and num_tokens <= mc2_tokens_capacity`，否则 `ALLGATHER`；`ep_world_size = world_size_across_dp // pipeline_parallel_size` [C8]。A3 在 `VLLM_ASCEND_ENABLE_FUSED_MC2=0`（默认）时，容量内走 MC2，超容量走 ALLTOALL。模式 1 还看 EP 是否不超过 32：满足时容量内外都可走 FUSED_MC2；模式 2 仅在容量内、投机方法与 `w8a8_dynamic` 量化条件同时满足时走 FUSED_MC2，超容量仍为 ALLTOALL。传入的 token 数是 DP 组里的最大值 [C13]。各版差异见 [EP 页的版本差异](expert-parallel.md#版本差异)。

这里的 ALLGATHER 是整条实现路径的名称；All-Gather 则是一种集合通信操作，把各成员的分片收集到每个成员。路径名称本身不能说明整条路径只执行一次 All-Gather。
- **物理要求。** 所有机器在同一局域网、NPU 全互通；A2 机内 HCCS、机间 RDMA，A3 机内机外都是 HCCS [S14]。
- **A2 的分层通信。** `HCCL_INTRA_PCIE_ENABLE=1` 且 `HCCL_INTRA_ROCE_ENABLE=0`，或打开 `enable_mc2_hierarchy_comm` 时生效；代码注释说它能减少跨机流量 [C26]。它要求各 rank 的 token 数一致（`global_bs = 0`），所以和下一条的跳过同步互斥。GLM 双机的教程没有设这两个变量。

该分层实现还要求调用方传入专家缩放数据；已核的这段接口没有给出其形状与完整使用过程，数据的数值含义仍待核实。
- **decode 侧跳过每步的 DP 同步。** 只在 MoE 模型的 KV consumer 一侧、没开分层通信时考虑：decode 必须走 MC2，并且 prefill 的最大批也走 MC2 或开了 recompute scheduler，才跳过 DP 组内每步对齐 token 数的那次 All-Reduce；跳过后各 rank 的 token 数可以不同，MC2 改用真实的 `global_bs`、不传 `mc2_mask` [C25]。
- **P 侧要预热。** 部分算子要跑几轮才到最佳性能，文档建议压测前先用一些请求预热服务。
- **只靠环境变量传 DP 参数。** 官方文档模板只设 `VLLM_DP_SIZE`、`VLLM_DP_RANK` 等环境变量，不给 `--data-parallel-*`；固定上游在传入 DP 大小为 1、且本地 DP 个数不为 0 时回退读这些变量 [C24]。注释把离线 SPMD 列为使用场景，普通单 API 在线入口也能到达该分支，调用链见 [DP 的环境回退说明](data-parallel.md#怎么开)。这个回退不等于启用了外置 HTTP 分派，不能由环境变量推断稠密模型校验、本地引擎数和 API server 数量；应按 `examples/external_online_dp` 模板显式传入命令行参数。
- **什么时候别开。** 稠密模型直接起独立实例；一台机器装得下、并发不高时，内置分派更简单；多机之间达不到同一局域网全互通时不要拉成一个 EP 组；长 prefill 和短 decode 混在一起、又不做 PD 分离时，组越大越容易被拖离 MC2。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**本文 GLM 双机 EP16 算例沿用例外 B 专用镜像 `db701c1f`**（其文档与示例与 `v0.23.0` 一致）。四族硬件动态选路细节见 [MoE 通信派发](moe-comm-dispatch.md#四族硬件调度状态机hardware_profilepy--ascend_forward_contextpy)。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 跨机 EP MoE 选路 | A2 按 `<=24` / `>=16` / `<=capacity` 判 MC2 否则 ALLGATHER；A3 按容量与融合模式选 MC2/ALLTOALL | 同 `v0.23.0` | 收敛为硬件画像驱动的 `select_moe_comm_method`（`ascend_forward_context.py#L375-L426`），LoRA+EP 强制 `ALLTOALL`；融合配置值 2 语义调整，不可照搬旧 GLM 模式 2 [C54] | 延续 `select_moe_comm_method`（`#L420-L455`）与动态 `mc2_tokens_capacity`（见 [MoE 通信派发](moe-comm-dispatch.md#动态-mc2_tokens_capacity-怎样算为什么会多跑一次-profile-dummy-run)） |
| 跳过逐步 DP 元数据同步 | KV consumer 且关分层通信，decode 须 MC2 且（prefill 须 MC2 或开 recompute） | 同 `v0.23.0` | `utils.py#L1385-L1435` 补齐 `hierarchy`、`is_mega_moe_supported()` 与 `use_cann_megamoe` 排除项，且 prefill 侧额外要求图模式不区分 prefill/decode | `utils.py#L1389-L1445` 进一步排除细粒度 `qkv_iproj_tensor_parallel_size > 1`，并在派发层与 `not requires_lmhead_dp_sync` 联合判断 |
| 外置分派与附加配置校验 | 给 rank 即外置（要求 `DP>1`）；本地 DP 非 1 报 `AssertionError`；附加配置忽略未知顶层键 | 同 `v0.23.0`；删除纯 DP 示例 `dp_load_balance_proxy_server.py` | 本地 DP 非 1 改报 `ValueError`；`fault tolerance` 限外置分派；附加配置默认严格拒绝未知顶层键（检测到 `vllm_omni` 时告警过滤）[C46]；文档已删尾逗号 [S29] | 同 `v0.30.0` 外置校验与严格附加配置；PD 示例 proxy 保持估分/长度账 |
| Mooncake V1/V2 端口与注册 | V1 端口按 `DP rank × TP × PP × PCP + device_index` 偏移 | 同 `v0.23.0` | V1 端口公式不变；V2 在独立子目录单独注册 | 同 `v0.30.0` |

v0.26 起目录不再提供纯 DP proxy 文件，需自行提供外部路由。官方文档里「推荐在 v0.9.1 正式版上使用」这句未随版本刷新，不能当作版本选择依据。四版的这套 MoE 专家域示例均显式打开 EP，外置 DP 分派均要求 `DP > 1`。

### 源码位置

版本表的外置分派与API数量对应来源47、48、53；Mooncake端口与注册对应49、50；proxy估分和优先级对应51、52。表中公式与默认值分别按这些入口核对。

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

上述 MoE 跳过同步的规则中，KV consumer 指接收并使用历史状态的一侧；需先关闭分层通信。在这个前提下，decode 的预计最大批必须选中 MC2 或 FUSED_MC2，并且满足以下两项中的至少一项：prefill 的预计最大批也选中 MC2 或 FUSED_MC2，或启用 recompute scheduler。后一个分支同样允许 decode 选中 FUSED_MC2。仅凭上述 token 数与请求数，仍不能确认官方示例 D 侧满足条件；这里核对的是跳过同步谓词，未展开 recompute scheduler 的完整调度行为。
- EP16 以上的 GLM 部署：缺配置与实测，本页不给这类部署的任何数字。
- 跨机器的实际流量占比、分层通信的收益、专家负载的真实分布：缺 HCCL / 网卡 trace 和逐层逐专家的路由统计。

请求入口和专家协作范围不同：外置分派决定请求送给哪个 DP 引擎，专家布局与通信组选路决定 token 是否跨机。依据为固定 parallel.py（来源 5）与 ascend_forward_context.py（来源 8）；不能由入口所在机器单独推断所有专家计算的位置。

固定 A2 选路函数按整数除法计算每设备专家数，三条件同时成立才选 `MC2`，否则选 `ALLGATHER`（来源 8）。后者是路径名，不表示整条路径只有一次 All-Gather；其他硬件和版本分别核对。GLM 双机的容量门槛与实际批次推导由[一条请求](one-request.md#moe-通信走-mc2-还是-allgather)统一说明。

4P4D 示例的负载条件是平均输入 3.5k、平均输出 1.1k、上下文 16k、最大输入 7k（来源 1）；物理链路前提另见来源 14。输入和输出长度改变 P、D 两侧工作量，因此该配比不能直接套到 GLM 双机或其他负载。

分层通信入口要求 `expert_scales`，并区分统一 token 模式与跳过同步时的真实批量（来源 26）。该入口不足以解释 expert_scales 的形状和完整数值语义，仍需追踪生产与消费算子。

跳过同步先排除分层通信，并要求 MoE 路径为 KV consumer；`needs_mc2` 接受 `MC2`、`FUSED_MC2`，最终条件是 `decode_must_use_mc2 and (prefill_must_use_mc2 or recompute_enable)`（来源 25、39）。实际部署须逐项满足条件，不能由配置名直接判定已跳过同步。
