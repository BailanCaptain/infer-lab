---
id: pd-disaggregation
title: "PD 分离：P 算完就下班，D 的第一件事是重算"
type: feature
summary: 把「算问题」和「一个字一个字写回答」拆到两批机器上跑：P 节点算完问题、留下 KV，D 节点把这份 KV 整块拉过去，再接着往外吐字。
aliases: [PD 分离, PD Disaggregation, Prefill/Decode 分离, disaggregated prefill, 分离部署, P 节点, D 节点, kv_role, MooncakeConnectorV1]
chapters: ["18"]
order: 10
sources:
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L5-L11
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/disaggregated_prefill.html
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L17-L23
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L107
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L103
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L13
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L119
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L59
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L72-L79
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1882-L1928
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1712-L1735
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2066-L2085
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1979-L1986
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L951-L969
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L322-L386
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2429-L2494
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2474-L2494
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L804-L824
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2176-L2186
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2236-L2248
  - vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L117
  - vllm-ascend@2c59ff10:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L790-L806
  - vllm-ascend@2c59ff10:docs/source/tutorials/features/pd_disaggregation_mooncake_single_node.md#L161-L186
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1111-L1119
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L697-L705
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2072-L2075
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L93
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L105
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150
  - vllm-ascend@2ed6cbba:docs/source/user_guide/support_matrix/supported_models.md#L133
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L139
  - https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefill
    kind: builds-on
    note: 「算」和「搬」是两种负载这件事在那一页讲清了，PD 分离就是把这两种负载拆到两批机器上
  - to: one-request
    kind: builds-on
    note: 37 个 token 的问题、200 个 token 的回答沿用那条请求；但那条请求的 Qwen3.6-35B-A3B 三个版本都不支持 PD 分离，所以这里的块和字节换成纯注意力小模型来算
  - to: vllm-scheduler
    kind: builds-on
    note: D 上那条请求能「一个 token 都不分也占一步」，前提是调度器每步只发 token 名额、不分阶段
  - to: kv-cache-spec
    kind: builds-on
    note: 昇腾把 K、V 拆成两条独立张量的理由，就是 PD 的传输侧只接受首维为 num_blocks 的张量
  - to: kv-pool
    kind: alternative-to
    note: 同样是把算好的 KV 给别的实例用，池按块哈希共享给所有人，PD 是点对点送给指定的那个 D
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 把一条请求拆到两台机器上，会发生什么

一个 37 个 token 的问题，要回答 200 个 token。平常这件事在一台机器上从头做到尾：先把问题一次算完（prefill），再一步吐一个 token（decode）。现在把它拆开——**一台机器只算问题，另一台只写回答**。那么：问题那台要算几次？中间要搬多少东西？回答那台要算几次？谁在等谁？

这就是 PD 分离。跑 prefill 的机器叫 **P 节点**，跑 decode 的叫 **D 节点**。P 节点只算整段问题的 KV（每个 token 在每层留下的「笔记」，见 [KV Cache](kv-cache.md)），算完就把这条请求结束掉；D 节点把这份 KV 整块拉过去，再一个 token 一个 token 往外吐。**代价是一次整块的跨机器搬运，外加 D 上一次重算。**

先说清例子用的是哪个模型。全库贯穿的[那条请求](one-request.md)跑的是 Qwen3.6-35B-A3B，**而官方支持矩阵里这个模型的 PD 分离一栏，三个版本（v0.23、v0.26、main）都是 ❌**——它根本走不到这一页。所以这里沿用那条请求的「问题 37 个、回答 200 个」，模型换成一个纯注意力的小模型 Qwen3-0.6B：28 层，每层都留笔记，一个块装 128 个 token。机制和模型无关，换个模型只是让账算得清楚。

```wiki-diagram
file: pd-disaggregation
```

## 为什么要拆

官方给的理由是两条：

- **两边能各自配。** 算问题吃算力，写回答吃显存带宽，两种活要的并行方式和机器数量不一样。拆开之后 P 节点和 D 节点可以各挑各的并行策略、各开各的实例数。
- **不再互相拖慢。** 混在一台机器上时，新请求的 prefill 插进来，正在写回答的那些请求就得陪着等这一步。拆开后，D 节点上只剩写回答的活。

## 算一笔账：P 算 1 次，搬 1 块，D 算 200 次

| 这一步在做什么 | 值 | 为什么 |
|---|---|---|
| P 上跑几次前向 | **1 次**：37 个 token 一步算完，这条请求在 P 上就结束了 | 前面的代理把这条请求在 P 上的「最多生成几个」改成了 1 |
| 搬几块 | 37 ÷ 128 向上取整 = **1 块** | 只搬装着问题的那几块 |
| 一次搬多少字节 | **14 MiB**（整块），真正装着数据的只有约 **4.05 MiB** | 块是整块搬的，128 个位置只写了 37 个；推导见下半「开销」 |
| D 上跑几次前向 | **200 次**：第 1 次只重算问题最后那个位置，之后 199 次每次 1 个 token | KV 全到了也得自己算出最后一个位置的输出，才有东西可以抽下一个字 |

最后一行值得停一下：**拆开之后总共 201 次前向，比单机多一次。** 多的那次只算 1 个 token，代价可以忽略，但它不是 bug——D 必须自己把最后那个位置算一遍，才拿得到「下一个字是什么」的概率分布。P 当时其实也抽出过一个字，它会被附在交接信息里带过去，但 D 不用它，照样自己重算、自己抽。所以第一个字实际上被算了两次。

## KV 是 D 拉走的，P 只管押着块

很多人以为是 P 算完把 KV「推」给 D。默认那条路恰好反过来：

1. **D 先占位，不算。** D 收到请求，一看交接信息里写着「KV 在别处算好了」，就先给它分好块，然后让它在「等远端 KV」的状态里待着。这一步 D 为它一个 token 都不算，模型也不跑。
2. **D 自己去拉。** D 的后台线程一次把所有层的那几块从 P 的显存里批量读过来。能直接读对面的显存，是因为两边启动时都把各自存 KV 的那段显存登记给了传输引擎。
3. **D 告诉 P「收完了」。** P 那边负责「发送」的线程其实不发 KV，它只回答对面问的元数据、记下对面什么时候收完。
4. **两边各自收尾。** D 这条请求这才回到排队里，下一步开始重算、吐字；P 这时才真正把那块放掉。

所以「谁等谁」是：**D 上这条请求从下发到能算，中间隔着整个传输；P 上的块被押着，押到 D 说收完为止。** 传输期间同一份 KV 在两台机器的显存里各占一份。两边的主循环都没被堵住——等的是这一条请求，不是整台机器，别的请求照常跑。

## P 那条请求得「写满长度」才会交棒

P 只让这条请求生成 1 个 token，不是为了省算力，而是为了让它**以「写到长度上限」的方式结束**。只有这样结束，P 才会把块号、自己的地址这些交接信息打包交给代理，并且先不释放块。

麻烦在于判断「结束了没有」时，先看是不是结束符，最后才看长度。如果 P 抽出的那唯一一个 token 恰好就是结束符，这条请求就算「正常说完」而不是「写满长度」：块当场释放，交接信息是空的。代理拿不到交接信息，转给 D 时也就不会说「KV 在别处」，D 只好把整段问题自己重算一遍。**结果仍然正确，但 P 那次 prefill 白做了。**

## 能拿什么来搬

昇腾这边的连接器分两类：**点对点**的一类把一条请求的 KV 送给指定的那个 D；**池**的一类按块的内容存进大家都看得见的外部存储（见 [KV Pool](kv-pool.md)）。PD 分离走点对点。点对点里默认那条是 D 拉；另有一条是反过来，P 每算完一层就往 D 推一层（逐层传输本身见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)）。连接器自己一层的细节在 [Mooncake Connector](mooncake-connector.md)。

## 常见误解

- **「P 算完会把 KV 推给 D。」**——默认那条路是 D 拉，P 只答复和记账。要「推」得换成逐层推的那个连接器。
- **「P 抽出的第一个字会交给 D 用。」**——会带过去，但没人读它；D 拿到全量 KV 后照样把最后一个位置重算一遍再自己抽。
- **「D 上那一步没算东西，是调度器空转。」**——那一步是特意留给搬运的：这一步只跑收发，请求这时连「正在跑」的队列都还没进。
- **「角色填『两边都当』最省事。」**——点对点这条路不认这个值，在 v0.23、v0.26 上不报错，但请求会一直卡住。见下半「会报什么错」。

## 对照源码

### 怎么开

官方设计文档给的两条理由：P 和 D 可以各自选并行策略与实例数，以及避免插入的 prefill 拖慢正在 decode 的请求 [S1]。

一份能跑的 1P1D 配置（裁自官方单机教程 [S24]，模型换成本页的 Qwen3-0.6B）：

```bash
# P 节点。D 节点改三处：--port 13701、"kv_role": "kv_consumer"、"kv_port": "30100"
vllm serve /model/Qwen3-0.6B --port 13700 --tensor-parallel-size 1 \
  --no-enable-prefix-caching \
  --kv-transfer-config '{"kv_connector": "MooncakeConnectorV1", "kv_role": "kv_producer",
    "kv_port": "30000",
    "kv_connector_extra_config": {"prefill": {"dp_size": 1, "tp_size": 1},
                                  "decode":  {"dp_size": 1, "tp_size": 1}}}'
```

- **代理改长度。** 示例代理把发给 P 的请求 `max_tokens`、`min_tokens` 都改成 1 [C23]。用处是让 P 上这条请求以 `RequestStatus.FINISHED_LENGTH_CAPPED` 结束：`request_finished` 的门是两个条件同时成立——`kv_transfer_params` 里有 `do_remote_decode`，且状态是 `FINISHED_LENGTH_CAPPED`。过了门才把块号、engine id、握手 host/port 打包成新的 `kv_transfer_params` 交回代理，并返回 `delay_free_blocks=True` 让引擎先别释放块；P 抽出的 token 以 `last_token_id` 一并带走 [C11]。只传装着 prompt 的那几块，MTP 多出来的块被切掉 [C12]。
- **D 侧怎么接。** D 的调度器看到 `do_remote_prefill`，`get_num_new_matched_tokens` 返回 `(37, True)`（第二个值表示异步加载）；调度器分好块、状态置成 `WAITING_FOR_REMOTE_KVS`，这一步 `num_new_tokens = 0` [C19]。worker 侧这一步走 `kv_connector_no_forward`，只跑收发、返回只带连接器输出的结果 [C27]。`start_load_kv` 把请求丢进队列就返回，后台线程用一次 `batch_transfer_sync_read` 批量读回所有层的块地址 [C15]；两边启动时都已把 KV 张量的 HBM 区间 `register_buffer` 给传输引擎。搬完 D 给 P 发 `DONE_RECVING_MSG`；P 的 `KVCacheSendingThread` 只是个 ZMQ ROUTER，答复元数据请求并记录「对面收完了」，不发 KV [C16]。两侧在 `get_finished` 里上报：D 报 `finished_recving`，请求回到 WAITING；P 报 `finished_sending`，块才释放 [C21]。KV 全量到齐后 D 仍要重算最后一个 token 才能采样 [C20]。
- **`kv_role`。** 上游把角色定义成两个 Literal 的并集，`kv_both` 同时落在生产者和消费者里，`is_kv_producer` 与 `is_kv_consumer` 对它同时为真 [C6][C7]。但 Mooncake P2P 判角色用字符串相等：`kv_role == "kv_producer"` 才起发送线程，否则一律起接收线程；上报完成时也是 `== "kv_producer"` 才收 `done_sending`、`== "kv_consumer"` 才收 `done_recving` [C17]。**P2P 只能写 `kv_producer` 或 `kv_consumer`；`kv_both` 是给[外部 KV 池](kv-pool.md)那条路用的。**
- **`kv_port`** 是握手端口的基址，实际监听端口按 rank 往上加，同机两个实例必须错开。
- **`prefill` 和 `decode` 两段两侧都得写全**，说的不是本机的并行度，而是对面长什么样——D 要拿 P 的 `tp_size` 算出一个块得分几次拉 [C13]。
- `--no-enable-prefix-caching` 是照抄官方示例：代码并不要求关掉它（D 要拉多少是拿 `actual - num_computed_tokens` 算的，本地命中会被减掉），文档也没说为什么要关 [I]。

### 会报什么错

- 四个键（两段各自的 `dp_size`、`tp_size`）worker 初始化逐个 `assert`，少一个就是启动即 `AssertionError`。
- `prefill_tp_size < decode_tp_size` 直接 `ValueError`，这正是官方限制里「只支持 P_tp 是 D_tp 的整数倍」的由来。
- **`kv_both` 配 P2P 不报错也不工作** `[!]`：走 else 分支只有接收线程，两个上报都是空集 [C18]——启动正常，请求永远等不到「传完了」，排查时只看得到「请求卡住」。main 开发主线新加的那套 Mooncake 连接器在初始化时就拦：`is_kv_consumer == is_kv_producer` 直接 `ValueError` [C10]。
- **P 抽到 EOS 时静默退化**：上游 `check_stop` 先判 EOS、再判 stop token、最后才判长度 [C22]。P 采出的唯一 token 若是 EOS，状态成了 `FINISHED_STOPPED`，`request_finished` 第一个 if 直接 `return False, None`：块当场释放、参数为空，代理转发给 D 时不带 `do_remote_prefill`，D 把整段 prompt 重算一遍——结果正确，但 P 那次 prefill 白做 [D]。
- **Qwen3.6-35B-A3B 不支持**：A2/A3 支持矩阵里它的 Prefill-decode Disaggregation 一栏在 v0.23 [S30]、v0.26 [S31]、main [S32] 都是 ❌。

### 开销和什么时候别开

- **本页的字节数** [D]：Qwen3-0.6B 为 28 层、8 个 KV 头、head_dim 128、bf16 [S33]。每 token 每层 `2（K 与 V）× 8 × 128 × 2 B = 4 KiB`，28 层合计 112 KiB/token；一块 128 个位置，每层 `128 × 4 KiB = 512 KiB`，28 层合计 **14 MiB**；真正写了数据的是 `37 × 112 KiB = 4144 KiB ≈ 4.05 MiB`。
- **多一次前向**：D 上第 1 次前向只为重算最后一个位置，总前向数比单机多 1；P 采出的首 token 带在 `last_token_id` 里，两个仓库都没有读它的地方，首 token 实际算了两次 [D]。
- **传输期间双份占用**：P 的块押到 D 上报收完才放，这段时间同一份 KV 在两台机器的 HBM 里各占一份。

### 版本差异

整体流程（代理改长度为 1、P 必须以长度上限结束、D 拉 KV、D 上多算一次）三版一字不差；连接器自己那一层的版本差异都在 [Mooncake Connector](mooncake-connector.md)。这里只留总览层面的几行。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| Mooncake 连接器 | 只有 `kv_p2p/mooncake_connector.py` 这一套 | 同 v0.23，另多注册一个 p2p 连接器 `SfaRemoteD2HConnector` | 另加 `kv_p2p/mooncake/` 包，注册成 `MooncakeConnectorV2` 和 `MooncakePullConnector` | 老连接器三版都在、行为一致；换 V2 才有下一行那道校验 |
| `kv_both` 配 P2P | 静默退化成只收不发，两个方向都报不出完成 | 同 v0.23，照样静默 | 初始化即 `ValueError` | [!] v0.23 和 v0.26 上这个配置不报错也不工作 |
| LMCache | 注册了 `LMCacheAscendConnector` | 同样注册着 | 注册表里没有这一项 | [!] 按 v0.23 或 v0.26 配 LMCache 的部署升到 main 会「连接器不存在」 |
| 设计文档的限制清单 | 列了「P 节点不支持非默认 `max_num_partial_prefills`」[S4] | 这条已经删掉 [S29] | 同 v0.26 | [!] 限制并没有解除：三版平台层都无条件把它重置回 1，而且这跟 PD 无关，是整个昇腾平台的行为[C26] |
| Qwen3.6-35B-A3B 的 PD 分离 | ❌ [S30] | ❌ [S31] | ❌ [S32] | 贯穿例子走不到这一页，本页换小模型算账 |

### 源码位置

`register_connector()` 一次把十来个连接器注册进上游的 `KVConnectorFactory`，路径里的 `kv_p2p` 与 `kv_pool` 就是两类东西。PD 分离走前者。

| 名字 | 归哪类 | 管什么 |
|---|---|---|
| `MooncakeConnectorV1` | kv_p2p | PD 分离的默认路：D 把 KV 从 P 拉过来 [S3] |
| `MooncakeLayerwiseConnector` | kv_p2p | 反过来，P 算完一层就往 D 推一层 |
| `AscendStoreConnector` | kv_pool | 外部 KV 池，`MooncakeConnectorStoreV1` 是它的另一个注册名；见 [KV Pool](kv-pool.md) |
| `RecomputeCPUOffloadConnector` | kv_pool | D 上抢占时把 KV 存进主机内存，见 [Recompute CPU Offload](recompute-cpu-offload.md) |

同一个连接器类在两个进程里各造一份：`KVConnectorRole.SCHEDULER` 造 `MooncakeConnectorScheduler`，WORKER 造 `MooncakeConnectorWorker`——上游接口本来就分成调度侧和 worker 侧两组方法。

| 看什么 | 在哪 |
|---|---|
| P 何时交棒、打包什么 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py`，`request_finished` |
| D 怎么拉 | 同文件，`batch_transfer_sync_read` 与接收线程 |
| P 的「发送线程」做什么 | 同文件，`KVCacheSendingThread` |
| 角色判定与完成上报 | 同文件，`get_finished` |
| D 上先占块不算 | 上游 `vllm/v1/core/sched/scheduler.py`，`WAITING_FOR_REMOTE_KVS` |
| 结束判断的顺序 | 上游 `vllm/v1/core/sched/utils.py`，`check_stop` |
| 那一步不跑模型 | `vllm_ascend/worker/model_runner_v1.py`，`kv_connector_no_forward` |
| 角色的定义 | 上游 `vllm/config/kv_transfer.py` |
| 连接器注册表 | `vllm_ascend/distributed/kv_transfer/__init__.py` |
