---
id: large-scale-ep
title: "Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面"
type: feature
summary: 几十上百张卡跑一个 MoE 模型时的部署形态——每个 DP rank 自己起一个完整的 API server 进程，rank 之间怎么分请求由 vLLM 外面的 proxy 决定，P 和 D 各用一套并行配置。
aliases: [Large-Scale EP, 大规模专家并行, 大规模 EP, Distributed DP Server, 分布式 DP server, 外置 DP 负载均衡, external DP LB, data_parallel_external_lb, data-parallel-rank, large_scale_ep, VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED, load_balance_proxy_server_example, external_online_dp]
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
updated: "2026-09-22"
origin: seed
---

## 一句话

大规模 EP 不是多一个并行参数，是**换一种部署形态**：一个 MoE 模型摊在几十上百张卡上，被切成几十个互不相干的 DP rank，**每个 rank 自己起一个完整的 API server 进程**；rank 之间怎么分请求，vLLM 不管了，交给外面一个 proxy。官方那篇文档给的例子是 8 台 Atlas 800T A3，前 4 台当 prefiller、后 4 台当 decoder，decoder 侧以 192.0.0.5 为 DP 主节点 [S1]。

`large_scale_ep.md` 三个版本都有，**正文内容一字未改**：v0.26 分支（2026-09-17 快照）只是把 MyST 的 tab 语法换成了 mkdocs-material 的写法，main 开发主线只改了 5 处 JSON 尾逗号 [S13]。上游那套外置 DP 负载均衡（`--data-parallel-rank` → `data_parallel_external_lb`）在 vLLM v0.23.0 与 v0.26.0 上也一字不差。主叙述按 v0.23 维护分支写。

```wiki-diagram
file: large-scale-ep
```

## 那条请求用不到它，而且「铺开一点」这条路是被堵死的

[那条请求](one-request.md)是单卡 Qwen3-0.6B，dense 模型。这里有一道比默认值更硬的门：`data_parallel_size > 1` 且外置 LB 打开时，非 MoE 模型直接 `ValueError`，错误信息把替代方案也写死了——「launch independent vLLM instances without --data-parallel-\* arguments」[C18]。**把 0.6B 摊到 8 张卡上、每张卡一个 server，恰恰是上游明说不支持的用法**；dense 模型要横向扩就起 8 个互不相干的 vLLM，别碰 DP。

换成官方那套拓扑才走得到这里。下面的数除末行外全部取自文档：

| 这一页的东西 | 官方那套 8 台 A3 上是多少 | 怎么来的 |
|---|---|---|
| 角色划分 | 4 台 prefiller + 4 台 decoder，每台 16 卡 | 文档开篇 |
| P 侧一台 | `DP 2 × TP 8`，`ep_size` = **16** | 推荐配置表的 DP / TP / EP 三列 [S3] |
| D 侧全局 | `DP 64 × TP 1`，`ep_size` = **64**，每台 16 个 rank | 同上，启动脚本里 `dp_size_local = 16` |
| 一共几个 server 进程 | 4×2 + 4×16 = **72**，每个占一个端口 | 每个 DP rank 一个 `--port`，起始 9000 往上加 |
| 每张卡放几个专家 | P 侧 256 ÷ 16 = **16**，D 侧 256 ÷ 64 = **4** | DeepSeek-R1 有 256 个路由专家、top-8 [S33]；`local = 全局 ÷ ep_size` [D] |

P 和 D 的参数差得很远，这正是分开部署的理由：P 侧是 `--max-num-batched-tokens 16384 --max-num-seqs 4` 还加 `--enforce-eager`，D 侧是 `256` 和 `28`、不加 eager。一套参数伺候不了两种负载。

## 「distributed DP server」就是：显式给出 rank，vLLM 就只管自己这一个引擎

DP 本身是「同一份模型复制几份、各收各的请求」，总览见[数据并行](data-parallel.md)页；这里只说它铺到多机上之后的那个形状。让一个进程变成「只属于某个 rank 的 server」的开关是 `--data-parallel-rank`。它的 help 写得很直白：**给了这个值就进外置负载均衡模式**，非 MoE 模型不支持 [C16]。字段注释说的是同一件事，还点名了场景：Kubernetes 里 one-pod-per-rank 的 wide-EP [C15]。

给了之后连着塌三件事：`data_parallel_size_local` 被按成 **1**，而且你自己写的值只能是 1 或者不写，否则 `assert` 当场失败；`api_server_count` 默认成 **1**——由外面那层分发，vLLM 不再按 `data_parallel_size` 开多个 API server 进程 [C19]；`local_engines_only` 随之为真，客户端只管本地这一个 EngineCore。

剩下两个参数只回答「主节点在哪」：`--data-parallel-address` 是 DP 集群头节点地址，`--data-parallel-rpc-port` 是它的 RPC 端口 [C17]，两者拼成 `tcp://ip:port` 的握手地址。**这跟 `--headless` 是两条路**：headless 是「这台机器只出引擎、不出 server」，给内部 LB 的多机部署用；四个落点（multi-port / headless / 多 API server / 单 API server）在同一条 `if` 链里，大规模 EP 走的是最后那个——单 API server，只不过起了 72 份。

仓库里能直接抄的模板不在文档正文里，而是 `examples/external_online_dp/run_dp_template.sh`：它老老实实用 `--data-parallel-size` / `-rank` / `-address` / `-rpc-port` 四个命令行参数 [C25]，配套的 `launch_online_dp.py` 按本地 rank 把 `ASCEND_RT_VISIBLE_DEVICES` 切成每 rank `tp_size` 张卡。

## 一个 `kv_port` 够 64 个 decode 引擎用，因为端口按 DP rank 自己错开

文档里 P 侧和 D 侧都写 `"kv_port": "20001"`，64 个 decode 引擎全写同一个值——看上去必撞。不会撞，因为 Mooncake 连接器算握手端口时先按全局 DP rank 偏移 [C31]：

```
side_channel_port = kv_port + data_parallel_rank × tp_size × pp_size × pcp_size
handshake_port    = side_channel_port + device_index
```

代到 D 侧（TP = PP = PCP = 1）：rank 0 拿 20001，rank 63 拿 20064。P 侧 TP=8，rank 0 占 20001–20008、rank 1 占 20009–20016；四台 prefiller 各自 `dp_rank_start = 0`，靠的是机器不同而不是端口不同 [D]。**所以「同机多实例必须错开 kv_port」这条在别处成立的规矩，在这里被 rank 偏移接管了**，照抄同一个 20001 是对的。

## 为什么它几乎总和 PD 分离一起出现，MC2 也是到这时候才划算

两件事同一个原因：**EP 组越大，单张卡上的专家越少、权重越省，但每一层都要把 token 发出去再收回来**。要让这笔通信划算，就得让每一步的 token 尽量同质——prefill 那种一步 16384 个 token 的批和 decode 那种一步几十个 token 的批混着跑，通信方式每步重选，谁都不讨好。拆成 P 和 D 之后两边各自稳定，才能各配一套 `ep_size`（怎么拆、KV 怎么搬见 [PD 分离](pd-disaggregation.md)）。

MC2 的判据把这件事量化了。A2 上要同时满足「每卡专家数 ≤ 24」和「EP 卡数 ≥ 16」，否则退回 all-gather [C30]。把 DeepSeek-R1 的 256 个专家代进去 [D]：

- 单台 A2（8 卡，`TP 8 × DP 1`）：`ep_size = 8`，256 ÷ 8 = 32 > 24，且 8 < 16，**两条都不过，走 all-gather**；
- P 侧那台（`TP 8 × DP 2`）：`ep_size = 16`，256 ÷ 16 = 16 ≤ 24，16 ≥ 16，**刚好卡在门槛上**；
- D 侧（`TP 1 × DP 64`）：`ep_size = 64`，256 ÷ 64 = 4，**远在门槛内**。

也就是说 **A2 上 MC2 的真实门槛是「至少两台机器」**——这正是「大规模」三个字的含义。官方这套跑在 A3 上，A3 的分支里没有「≥ 16 卡」这一条，四种通信方式的完整判据表、以及 `ep_size` 为什么等于 `dp × pcp × tp`，都在 [Expert Parallel](expert-parallel.md)。硬性前提写在文档的物理层要求里：同一局域网、NPU 全互联，A2 是机内 HCCS + 机间 RDMA，A3 机内机外都是 HCCS [S10]。

## 照文档那段脚本原样抄，有四处对不上代码

这一节是本页最该记住的部分。四处在三个版本上都复现过，只有第一处 main 已修：

| 文档里写的 | 代码里的事实 | 后果 |
|---|---|---|
| `--kv-transfer-config` 的 JSON 末尾带一个逗号 | 带尾逗号不是合法 JSON；这个参数走的是严格 JSON 校验，`json.loads` 对同一段字符串直接抛 `JSONDecodeError` | `[!]` 启动即参数错误。main 上这 5 处逗号已删掉，v0.23 与 v0.26 仍在 |
| proxy 命令用了 `--prefiller-hosts-num` / `--prefiller-ports-inc` / `--decoder-hosts-num` / `--decoder-ports-inc`，还配了一张参数表 [S9] | 仓库里那份 `load_balance_proxy_server_example.py` **没有这四个参数**，它要求 hosts 与 ports 等长再 zip 起来 [C28] | `[!]` argparse 报 unrecognized arguments。要么把 72 个 (host, port) 对列全，要么自己改脚本 |
| `export VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` 和 `export VLLM_DP_SIZE_LOCAL=$7` [S6] | 这两个名字在 vllm-ascend 与 vLLM 两个仓库的三个版本里**只出现在这份文档自己**，没有任何代码读它们 | `[!]` 设了等于没设。真正被读的是 `VLLM_DP_RANK` / `VLLM_DP_RANK_LOCAL` / `VLLM_DP_SIZE` / `VLLM_DP_MASTER_IP` / `VLLM_DP_MASTER_PORT` [C24] |
| `--additional-config '{"enable_weight_nz_layout":true,"enable_prefill_optimizations":true}'` | 这两个键在 `vllm_ascend/` 下一次都搜不到；`AscendConfig` 全程用 `.get()` 取值，不认识的键既不报错也不告警 [C32] | `[!]` 静默无效。配置系统怎么读见 [昇腾配置系统](ascend-config-system.md) |

还有一处不算错但会误导：文档那段脚本只设 `VLLM_DP_*` 环境变量、一个 `--data-parallel-*` 都不给。上游把这条 env 分支的注释写成「fall back to env vars (e.g. for offline SPMD case)」[C23]，而在线服务的那条路是上面讲的 `--data-parallel-rank`。**走 env 这条路，外置 LB 的整套校验一条都不会触发** [I]——非 MoE 拦截、`data_parallel_size_local = 1`、`api_server_count = 1` 全部跳过，出问题时报错位置会离真正的原因很远。文档自己还推荐在「v0.9.1 official release」上用这个特性，而它已经跟着发到了 v0.23 / v0.26 / main。

## 三个版本的差别

差异只在例子和文档层面，机制没变：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `--kv-transfer-config` 的尾逗号 | 在 | 在 | 已删 | `[!]` v0.23 / v0.26 上照抄文档起不来，升到 main 才能直接复制 |
| DP 级别的 proxy 例子 | 有 `examples/external_online_dp/dp_load_balance_proxy_server.py`，按请求长度在多个外置 DP server 之间分发 [C27] | 已删，README 里那一节也删了 | 同 v0.26 | 新版本只剩 PD 那份 `load_balance_proxy_server_example.py`；纯 DP、不做 PD 分离的外置 LB 得自己写 |
| 文档的 tab 语法 | MyST `::::{tab-item}` | mkdocs-material `=== "A3"` | 同 v0.26 | 只影响渲染，正文逐字相同，三版可以互换着读 |

## 常见误解

- **「大规模 EP 是一个开关。」**——它没有开关。启动命令里跟「大规模」有关的只有 `--enable-expert-parallel` 加一组 `--data-parallel-*`，剩下的全是部署形态：起多少个进程、谁当主节点、外面那层 proxy 怎么挑。文档标题里的 "Distributed DP Server" 说的就是这件事。
- **「外置 DP 负载均衡是昇腾加的。」**——是上游 vLLM 的能力，`data_parallel_external_lb` 定义在 `vllm/config/parallel.py`。昇腾提供的是示例脚本和 proxy；`VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED` 这个看着像昇腾开关的名字，在三个版本的代码里都不存在。
- **「proxy 是按轮询分发的。」**——那份示例按负载挑：每个后端维护 `active_tokens` 和 `active_kv_cache`，prefill 侧的优先级是 `active_tokens + active_kv_cache × 0.3`，decode 侧只看 `active_tokens`，每次从小顶堆里取最小的那个 [C29]。
- **「EP 卡数越多，MC2 一定越好。」**——判据里还有「每卡专家数 ≤ 24」和「这一步的 token 数不超过 MC2 容量」两条，后者每步重算。容量怎么来的、超了掉到哪条分支，见 [Expert Parallel](expert-parallel.md)。
