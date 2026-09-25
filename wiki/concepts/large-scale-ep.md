---
id: large-scale-ep
title: "Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面"
type: feature
summary: 把一个 MoE 模型铺到几十上百颗 NPU 上时的部署方式：每个 DP rank 自己起一个完整的 server，请求分给谁由 vLLM 外面的 proxy 决定，prefill 和 decode 各用一套并行配置。
aliases: [Large-Scale EP, 大规模专家并行, 大规模 EP, wide-EP, Distributed DP Server, 分布式 DP server, 外置 DP 负载均衡, external DP LB, data_parallel_external_lb, data-parallel-rank, large_scale_ep, VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED, load_balance_proxy_server_example, external_online_dp]
chapters: ["14"]
order: 20
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L5-L6
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/large_scale_ep.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L479-L490
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L251-L257
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L285-L291
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L126-L141
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L145-L167
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L211-L232
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L321-L360
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L10-L13
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L241-L241
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L492-L496
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/large_scale_ep.md#L151-L157
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/large_scale_ep.md#L17-L17
  - vllm@0fc695fc:vllm/config/parallel.py#L138-L144
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1003-L1010
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1023-L1034
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1859-L1884
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L107
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L139-L148
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L223-L244
  - vllm@0fc695fc:vllm/config/parallel.py#L514-L520
  - vllm@0fc695fc:vllm/config/parallel.py#L825-L831
  - vllm@0fc695fc:vllm/envs.py#L1297-L1309
  - vllm-ascend@2c59ff10:examples/external_online_dp/run_dp_template.sh#L15-L32
  - vllm-ascend@2c59ff10:examples/external_online_dp/launch_online_dp.py#L53-L61
  - vllm-ascend@2c59ff10:examples/external_online_dp/README.md#L43-L57
  - vllm-ascend@2c59ff10:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L642-L683
  - vllm-ascend@2c59ff10:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L276-L281
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L240-L252
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1650-L1657
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L56
  - https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/main/config.json
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: expert-parallel
    kind: builds-on
    note: ep_size 怎么由 dp × pcp × tp 压扁出来、四种 MoE 通信按什么判据选，全在那一页；这一页只负责把 ep_size 顶到 16 以上的那套拓扑
  - to: pd-disaggregation
    kind: builds-on
    note: kv_role、Mooncake 怎么把块从 P 拉到 D、为什么 P 要撞长度上限，都在那一页；这一页只说大规模 EP 为什么几乎总把它一起开上
  - to: engine-processes
    kind: builds-on
    note: 「一个 DP rank 一个 server」多出来的，正是那一页画的 Main / EngineCore / Worker 三类进程整套再来一份
  - to: balance-scheduling
    kind: alternative-to
    note: 都在治 DP rank 之间的忙闲不均——外置 LB 在 vLLM 外面按活跃 token 数挑 rank，均衡调度在 vLLM 里面卡住所有 rank 的准入闸
  - to: data-parallel
    kind: builds-on
    note: 大规模 EP 的每个「引擎」就是一个 DP rank；DP 复制什么、MoE 下各 rank 为什么必须齐步走，在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 两颗 NPU 够跑一条请求，要服务几千人时怎么往上加

[贯穿全站的例子](one-request.md)在两颗昇腾 NPU 上部署 Qwen3.6-35B-A3B，处理一个 37 个 token 的问题。两颗 NPU 能把模型装下、把这条请求答完。可上线以后不会只有一条请求：同时有几千个人在问，两颗 NPU 忙不过来，得加到几十、上百颗。

加的办法最自然的是[数据并行（DP）](data-parallel.md)：模型复制几份，每份叫一个副本，请求分给不同副本去算。给每个副本排一个号，叫 DP rank。但 Qwen3.6-35B-A3B 是 [MoE](moe.md) 模型，每层有 256 个专家，每个 token 只挑其中 8 个来算。开了[专家并行（EP）](expert-parallel.md)以后，这 256 个专家是摊在**全部** NPU 上的，不是每个副本各存一套。所以副本之间并不独立：每一层 MoE，每个副本都要把自己的 token 发给别的副本那里的专家，再把结果收回来。NPU 越多，这个「一起走」的圈子就越大。

大规模 EP 说的就是这个圈子大到几十上百颗 NPU 时的部署方式。它不是多一个并行参数，而是**换一种部署形态**：

- 模型被切成几十个 DP rank，**每个 rank 自己起一个完整的 server 进程**，各有各的端口；
- rank 之间怎么分请求，vLLM 不管了，交给 vLLM 外面的一个转发程序（下面叫 proxy）；
- 几乎总是同时开 [PD 分离](pd-disaggregation.md)：跑 prefill 的机器和跑 decode 的机器分开，两边各用一套并行配置。

```wiki-diagram
file: large-scale-ep
```

## 官方示例：8 台机器，72 个 server

官方文档用 8 台 Atlas 800T A3 服务器（Atlas A3 这一代，下面简称 A3）演示，模型是 DeepSeek-R1。每台 16 颗 NPU，前 4 台跑 prefill（下面叫 P 节点），后 4 台跑 decode（D 节点）。本站的例子官方只给了两颗 NPU 的部署示例，没有多机示例，所以这一节的数都照文档那个模型算，不套到 Qwen3.6 上。

| 这一页的东西 | 官方那套 8 台 A3 上是多少 | 怎么来的 |
|---|---|---|
| 角色划分 | 4 台 P 节点 + 4 台 D 节点，每台 16 颗 NPU | 文档开篇 |
| P 节点一台 | DP 2 × TP 8，EP 组 16 颗 | 文档推荐配置表 |
| D 节点合起来 | DP 64 × TP 1，EP 组 64 颗，每台 16 个 DP rank | 同上 |
| 一共几个 server 进程 | 4 × 2 + 4 × 16 = **72**，每个占一个端口 | 每个 DP rank 一个端口，从 9000 往上加 |
| 每颗 NPU 放几个专家 | P 节点 256 ÷ 16 = **16**，D 节点 256 ÷ 64 = **4** | 专家总数 ÷ EP 组的颗数 |

DeepSeek-R1 恰好也是每层 256 个路由专家、每个 token 挑 8 个，和 Qwen3.6-35B-A3B 一样。所以「每颗放几个专家」这一列换成 Qwen3.6 也是同样的除法：例子里两颗 NPU 时每颗 128 个，铺到 16 颗时每颗 16 个，64 颗时每颗 4 个。

P 节点和 D 节点的参数差得很远，这正是分开部署的理由：P 节点一步最多收 16384 个 token、最多同时 4 条请求，而且用 eager 模式（不用录好的图，一个算子一个算子地下发）；D 节点一步最多 256 个 token、最多 28 条请求，没有关掉图模式。一套参数伺候不了两种负载。

## 每个 DP rank 自己当一个 server

平时开 DP，是一个 vLLM 进程管好几个副本，前端自己决定请求给谁（见[数据并行](data-parallel.md)页）。大规模 EP 反过来：启动时明确告诉 vLLM「你是第几号 DP rank」，vLLM 就进入**外置负载均衡**模式，只管自己这一个副本。

告诉它编号之后，有三件事随之改变：

1. 这个进程在本机只管 1 个副本，不许多写；
2. 只起 1 个接 HTTP 请求的前端进程，因为分请求的活已经交给外面了；
3. 它只和本机的这一个引擎打交道，别的 rank 忙不忙它不看。

所以一个 DP rank 就是一整套引擎：接请求的前端、调度的引擎进程、守着 NPU 干活的 Worker，全都各有一份（这三类进程是什么，见[引擎的进程](engine-processes.md)）。72 个 rank，就是 72 套。

rank 之间唯一还要约好的，是「主节点在哪」：每个 rank 启动时都要给出 DP 主节点的地址和端口，大家到那里握手，组成一起做专家通信的那个大圈子。官方示例里，4 台 P 节点各自当自己的主节点（每台是一个独立的 DP 2 的小圈子），4 台 D 节点共用第 5 台当主节点（合起来一个 DP 64 的大圈子）。

## 外面那层 proxy 怎么挑

vLLM 不再替你分请求，这件事就由 proxy 做。官方仓库里那份示例 proxy 不是轮流发，而是挑最闲的：

- 它给每个后端 server 记一本账：正在处理多少个 token，占着多少 KV Cache；
- 挑 P 节点时，看「正在处理的 token 数 + 占着的 KV Cache × 0.3」，挑最小的；
- 挑 D 节点时，只看正在处理的 token 数，挑最小的。

一条请求进来，proxy 先挑一个 P 节点的 server 做 prefill，再挑一个 D 节点的 server 接着 decode。

## 为什么它几乎总和 PD 分离一起出现

EP 组越大，每颗 NPU 上的专家越少，权重越省。代价是通信：每一层 MoE 都有一次 dispatch（把 token 发去专家所在的 NPU）和一次 combine（算完再把结果收回来）。几十颗 NPU 时，每颗都要给别的每颗发一份不同的 token，这种通信叫 all-to-all（每颗 NPU 给每颗 NPU 都发一份不同的数据）。

要让这笔通信划算，每一步的 token 最好是同一类负载。prefill 一步可能是一万多个 token，decode 一步是每条请求 1 个 token，两种批混着跑，通信方式每一步都要重新选，哪边都不讨好。拆成 P 和 D 以后，两边各自稳定，才能各配一套并行方式。P 节点和 D 节点之间怎么搬 KV Cache，见 [PD 分离](pd-disaggregation.md)。

## MC2 到这种规模才走得上

MC2 是昇腾的通算融合：把通信和计算揉进一个算子里，边算边传。它省的是通信被干等的时间，不是通信量——该发的 token 一个不少。

在 Atlas A2 上，要走 MC2 得同时满足三条：每颗 NPU 上的专家不超过 24 个、EP 组不少于 16 颗 NPU、这一步的 token 数不超过 MC2 能一次处理的上限。不满足就退回 all-gather（每颗 NPU 把自己那份 token 发给所有 NPU，大家都拿到全部 token，各自只算落在自己专家上的那些）。用 256 个专家算一下：

| EP 组 | 每颗 NPU 的专家 | 能走 MC2 吗（A2） |
|---|---|---|
| 2 颗（例子的规模） | 128 | 不能，两条都不过 |
| 8 颗（一台 A2） | 32 | 不能，两条都不过 |
| 16 颗（官方 P 节点那台的 EP 组） | 16 | 能，刚好卡在门槛上 |
| 64 颗（官方 D 节点） | 4 | 能，远在门槛内 |

一台 A2 只有 8 颗 NPU，所以 **A2 上 MC2 的实际门槛是至少两台机器**，这就是「大规模」三个字的分量。A3 没有「不少于 16 颗」这一条，例子的两颗 NPU 在 A3 上就已经走 MC2，完整判据见[专家并行](expert-parallel.md)。

多机还有一个硬性前提：所有 NPU 在同一个局域网里、彼此全互联。A2 是机内走 HCCS、机间走 RDMA；A3 机内机外都走 HCCS。

## 64 个 decode server 写同一个端口号也不会撞

P 节点和 D 节点之间搬 KV Cache 要约一个端口。文档里 64 个 decode server 全写同一个值 20001，看上去必撞，其实不会：实际监听的端口是「写的值 + DP rank 编号 × 每个 rank 占几颗 NPU」，再加上本 rank 里第几颗。

代到 D 节点（每个 rank 1 颗 NPU）：0 号 rank 拿 20001，63 号拿 20064。P 节点每个 rank 8 颗 NPU，0 号占 20001 到 20008，1 号占 20009 到 20016；4 台 P 节点的 rank 编号都从 0 起，靠的是机器不同而不是端口不同。所以「同一台机器上跑多个实例要错开端口」这条在别处成立的规矩，在这里已经由 rank 编号自动错开了，照抄同一个 20001 是对的。

## 照文档抄会踩的四个坑

官方那篇文档的脚本有四处和代码对不上，在三个版本上都复现过，只有第一处在 main 开发主线上修了：

1. 传给 KV 传输配置的那段 JSON 末尾多一个逗号，不是合法 JSON，启动就报参数错误；
2. 启动 proxy 用的四个参数，仓库里那份 proxy 脚本根本没有，直接报「不认识的参数」；
3. 文档设的两个环境变量，两个仓库、三个版本的代码里没有任何地方读它们，设了等于没设；
4. 传给昇腾附加配置的两个键，代码里也搜不到，昇腾配置对不认识的键既不报错也不提醒，静默无效。

还有一处不算错但会误导：文档那段脚本只靠环境变量告诉 vLLM 自己是第几号 rank，没有用命令行参数。走这条路时，上面那套外置负载均衡的检查一条都不会触发，出问题时报错的位置会离真正的原因很远。每一处的具体写法和正确做法，见下面「会报什么错」。

## 常见误解

- **「大规模 EP 是一个开关。」**它没有开关。启动命令里跟它有关的只有开 EP 的那个开关加一组 DP 参数，剩下的全是部署形态：起多少个进程、谁当主节点、外面的 proxy 怎么挑。文档标题里的 "Distributed DP Server" 说的就是这件事。
- **「外置 DP 负载均衡是昇腾加的。」**这是上游 vLLM 的能力。昇腾提供的是示例脚本和 proxy；文档里那个看着像昇腾开关的环境变量，在三个版本的代码里都不存在。
- **「dense 模型也能这么铺。」**不能。模型不是 MoE 时，给 DP rank 编号直接报错，报错信息让你改成起几个互不相干的 vLLM。dense 模型的副本之间本来就不需要一起走，用不着这套。
- **「proxy 是轮流分发的。」**示例 proxy 按负载挑，见上面「外面那层 proxy 怎么挑」。
- **「EP 组越大，MC2 一定越好。」**判据里还有「每颗专家数不超过 24」和「这一步的 token 数不超过 MC2 上限」，后者每步重算。上限怎么来的、超了走哪条路，见[专家并行](expert-parallel.md)。

## 对照源码

这一节给要读代码、查配置、排查问题的人。主叙述按 v0.23 维护分支写。

### 怎么开

- 让一个进程变成「只属于某个 rank 的 server」的开关是 `--data-parallel-rank`。help 写明：给了这个值就进外置负载均衡模式，非 MoE 模型不支持 [C16]。字段 `data_parallel_external_lb` 的注释说的是同一件事，还点名了场景：Kubernetes 里 one-pod-per-rank 的 wide-EP [C15]。
- 给了之后连着塌三件事：`data_parallel_size_local` 被按成 1，你自己写的值只能是 1 或者不写，否则 `assert` 当场失败 [C18]；`api_server_count` 默认成 1，vLLM 不再按 `data_parallel_size` 开多个 API server 进程 [C19]；`local_engines_only` 随之为真，客户端只管本地这一个 EngineCore [C22]。
- 主节点：`--data-parallel-address` 是 DP 集群头节点地址，`--data-parallel-rpc-port` 是它的 RPC 端口 [C17]，两者拼成 `tcp://ip:port` 的握手地址。
- 这跟 `--headless` 是两条路：headless 是「这台机器只出引擎、不出 server」，给内部 LB 的多机部署用；四个落点（multi-port / headless / 多 API server / 单 API server）在同一条 `if` 链里，大规模 EP 走的是最后那个——单 API server，只不过起了 72 份 [C20]。
- 能直接抄的模板不在文档正文里，而是 `examples/external_online_dp/run_dp_template.sh`：它用 `--data-parallel-size` / `-rank` / `-address` / `-rpc-port` 四个命令行参数 [C25]；配套的 `launch_online_dp.py` 按本地 rank 把 `ASCEND_RT_VISIBLE_DEVICES` 切成每 rank `tp_size` 颗 NPU [C26]。
- 文档的启动方式：P 节点 `dp_size_local = 2`、主节点 192.0.0.1，D 节点 `dp_size_local = 16`、主节点 192.0.0.5 [S4][S5]；角色划分见 [S1]。P 节点 `--max-num-batched-tokens 16384 --max-num-seqs 4 --enforce-eager` [S7]，D 节点 `256` 和 `28`、不加 eager [S8]。推荐配置表：prefill DP 2 / TP 8 / EP 16，decode DP 64 / TP 1 / EP 64，`max-model-len` 17000，`gpu-memory-utilization` 0.9；文档注明这组数与优化无关，要按实际场景调 [S3]。
- 每颗专家数：DeepSeek-R1 256 个路由专家、top-8 [S33]；Qwen3.6-35B-A3B 同为 `num_experts = 256`、`num_experts_per_tok = 8` [S34]；`local = 全局 ÷ ep_size` [D]。
- KV 传输端口：Mooncake 连接器按全局 DP rank 偏移 [C31]：

  ```
  side_channel_port = kv_port + data_parallel_rank × tp_size × pp_size × pcp_size
  handshake_port    = side_channel_port + device_index
  ```

  D 节点 TP = PP = PCP = 1 时 rank 0 拿 20001、rank 63 拿 20064；P 节点 TP=8 时 rank 0 占 20001–20008、rank 1 占 20009–20016；四台 P 节点各自 `dp_rank_start = 0` [D]。
- proxy：`load_balance_proxy_server_example.py` 每个后端维护 `active_tokens` 和 `active_kv_cache`；`_priority` 在 prefill 侧取 `active_tokens + active_kv_cache × 0.3`，decode 侧只看 `active_tokens`，每次从小顶堆里取最小的 [C29]。它要求 hosts 与 ports 等长，再 zip 起来 [C28]。
- 文档推荐在「v0.9.1 official release」上用这个特性 [S11]，而它已经跟着发到了 v0.23 / v0.26 / main。

### 会报什么错

- 非 MoE 模型：`data_parallel_size > 1` 且外置 LB 打开时抛 `ValueError: Non-MoE models do not support external data parallel mode. For external load balancing, launch independent vLLM instances without --data-parallel-* arguments.`
- 给了 `--data-parallel-rank` 又把 `data_parallel_size_local` 写成 1 以外的值：`AssertionError: data_parallel_size_local must be 1 or None when data_parallel_rank is set`。
- 照抄文档的四处错：

| 文档里写的 | 代码里的事实 | 后果 |
|---|---|---|
| `--kv-transfer-config` 的 JSON 末尾带一个逗号 | 带尾逗号不是合法 JSON；这个参数走严格 JSON 校验，`json.loads` 对同一段字符串直接抛 `JSONDecodeError` | [!] 启动即参数错误。main 上这 5 处逗号已删 [S13]，v0.23 与 v0.26 仍在 |
| proxy 命令用了 `--prefiller-hosts-num` / `--prefiller-ports-inc` / `--decoder-hosts-num` / `--decoder-ports-inc`，还配了一张参数表 [S9] | 仓库里那份 `load_balance_proxy_server_example.py` 没有这四个参数，它要求 hosts 与 ports 等长再 zip 起来 | [!] argparse 报 unrecognized arguments。要么把 72 个 (host, port) 对列全，要么自己改脚本 |
| `export VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` 和 `export VLLM_DP_SIZE_LOCAL=$7` [S6] | 这两个名字在 vllm-ascend 与 vLLM 两个仓库的三个版本里只出现在这份文档自己，没有任何代码读它们 | [!] 设了等于没设。真正被读的是 `VLLM_DP_RANK` / `VLLM_DP_RANK_LOCAL` / `VLLM_DP_SIZE` / `VLLM_DP_MASTER_IP` / `VLLM_DP_MASTER_PORT` [C24] |
| `--additional-config '{"enable_weight_nz_layout":true,"enable_prefill_optimizations":true}'` | 这两个键在 `vllm_ascend/` 下一次都搜不到；`AscendConfig` 全程用 `.get()` 取值，不认识的键既不报错也不告警 [C32] | [!] 静默无效。配置系统怎么读见 [昇腾配置系统](ascend-config-system.md) |

- 走环境变量那条路：文档那段脚本只设 `VLLM_DP_*`、一个 `--data-parallel-*` 都不给。上游把这条 env 分支的注释写成「fall back to env vars (e.g. for offline SPMD case)」[C23]，在线服务的正路是 `--data-parallel-rank`。走 env 这条路，外置 LB 的整套校验一条都不会触发 [I]——非 MoE 拦截、`data_parallel_size_local = 1`、`api_server_count = 1` 全部跳过。

### 开销和什么时候别开

- MC2 判据：A2 上 `_select_a2_moe_comm_method` 要求 `num_experts_per_device <= 24 and ep_world_size >= 16 and num_tokens <= mc2_tokens_capacity`，否则 `ALLGATHER`；`ep_world_size = world_size_across_dp // pipeline_parallel_size` [C30]。256 个专家代入 [D]：单台 A2（TP 8 × DP 1）`ep_size = 8`，每颗 32 > 24 且 8 < 16，走 all-gather；P 节点那台（TP 8 × DP 2）`ep_size = 16`，每颗 16，刚好过门槛；D 节点（TP 1 × DP 64）`ep_size = 64`，每颗 4。A3 分支里没有「≥ 16」这一条；四种通信方式的完整判据、`ep_size` 为什么等于 `dp × pcp × tp`，见 [专家并行](expert-parallel.md)。
- 物理层要求：同一局域网、NPU 全互联；A2 机内 HCCS + 机间 RDMA，A3 机内机外都是 HCCS [S10]。
- P 节点要预热：部分算子要跑几轮才到最佳性能，文档建议压测前先用一些请求预热服务 [S12]。
- 纯 DP、不做 PD 分离的外置 LB：v0.26 起仓库里只剩 PD 那份 proxy，得自己写（见版本差异）。

### 版本差异

`large_scale_ep.md` 三个版本都有，正文内容一字未改：v0.26 分支（2026-09-17 快照）只是把 MyST 的 tab 语法换成了 mkdocs-material 的写法 [S14]，main 开发主线只改了 5 处 JSON 尾逗号 [S13]。上游那套外置 DP 负载均衡（`--data-parallel-rank` → `data_parallel_external_lb`）在 vLLM v0.23.0 与 v0.26.0 上也一字不差。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `--kv-transfer-config` 的尾逗号 | 在 | 在 | 已删 | [!] v0.23 / v0.26 上照抄文档起不来，升到 main 才能直接复制 |
| DP 级别的 proxy 例子 | 有 `examples/external_online_dp/dp_load_balance_proxy_server.py`，按请求长度在多个外置 DP server 之间分发 | 已删，README 里那一节也删了 | 同 v0.26 | 新版本只剩 PD 那份 `load_balance_proxy_server_example.py`；纯 DP、不做 PD 分离的外置 LB 得自己写 |
| 文档的 tab 语法 | MyST `::::{tab-item}` | mkdocs-material `=== "A3"` | 同 v0.26 | 只影响渲染，正文逐字相同，三版可以互换着读 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 外置 LB 字段与本地引擎开关 | 上游 `vllm/config/parallel.py`，`data_parallel_external_lb`、`local_engines_only` |
| 命令行参数与非 MoE 拦截 | 上游 `vllm/engine/arg_utils.py`，`--data-parallel-rank` 与 `create_engine_config` 里的 DP 分支 |
| 四个启动落点 | 上游 `vllm/entrypoints/cli/serve.py` |
| 环境变量那条路 | 上游 `vllm/envs.py`，`VLLM_DP_*` |
| 启动模板 | `examples/external_online_dp/run_dp_template.sh`、`launch_online_dp.py` |
| proxy | `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`，`_priority` |
| MC2 判据 | `vllm_ascend/ascend_forward_context.py`，`_select_a2_moe_comm_method` |
| KV 传输端口偏移 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py`，`side_channel_port` |
