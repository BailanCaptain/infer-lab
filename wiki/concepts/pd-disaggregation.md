---
id: pd-disaggregation
title: "PD 分离：P 算完就下班，D 的第一件事是重算"
type: feature
summary: 把 prefill 和 decode 拆到两批实例上跑，P 节点算完整段 prompt 的 KV 就结束请求，D 节点把这些块整块拉过去再逐 token 生成。
aliases: [PD 分离, PD Disaggregation, Prefill/Decode 分离, disaggregated prefill, 分离部署, P 节点, D 节点, kv_role, MooncakeConnectorV1]
chapters: ["18"]
order: 10
sources:
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L5-L11
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/disaggregated_prefill.html
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L17-L23
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L107
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L103
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L13
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L119
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L59
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L72-L79
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
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L695-L703
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2072-L2075
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L93
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L105
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefill
    kind: builds-on
    note: 「算」和「搬」是两种负载这件事在那一页讲清了，PD 分离就是把这两种负载拆到两批机器上
  - to: one-request
    kind: builds-on
    note: 这一页的 1 块、14 MiB、200 步都是那条请求的数，只是把它摆到 1P1D 上重走一遍
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
updated: "2026-09-21"
origin: seed
---

## 一句话

PD 分离把**同一个模型的两种负载拆到两批实例上**：P 节点（Prefiller）只算整段 prompt 的 KV，算完就把请求结束掉；D 节点（Decoder）把这份 KV 整块拉过去，再一个 token 一个 token 往外吐。官方给的理由是两条：P 和 D 能各自挑并行策略和实例数，以及不再让插进来的 prefill 把正在 decode 的请求拖慢 [S1]。**代价是一次整块的跨节点搬运，外加 D 上一次重算。**

```wiki-diagram
file: pd-disaggregation
```

## 那条请求得改成 1P1D 才走到这里

[那条请求](one-request.md)是单卡混部，没有 `kv_transfer_config`，连接器一个都造不出来。把它原样搬到 1P1D：两张卡各起一个实例、TP 都是 1、`block_size` 仍是 128、问题 37 个 token、回答 200 个 [A]。它就变成这样：

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| P 上跑几次 forward | **1 次**，37 个 token 一步算完，然后这条请求在 P 上就结束了 | 代理把 `max_tokens`、`min_tokens` 都改成 1 |
| 传几块 | `cdiv(37, 128)` = **1 块** | 只传装着 prompt 的那几块，MTP 多出来的块被切掉 [C12] |
| 一次搬多少字节 | **14 MiB**（整块），有效只有 37 × 112 KiB ≈ **4.05 MiB** | 每块每层 512 KiB × 28 层，两个数都取自[那条请求](one-request.md) [D] |
| D 上跑几次 forward | **200 次**：第 1 次只重算位置 36，之后 199 次每次 1 个 token | KV 全量到齐了也要重算最后一个 token 才能采样 [C20] |

最后一行值得停一下：**拆开之后总共 201 次前向，比单卡多一次**。多的那次只算 1 个 token，代价可以忽略，但它不是 bug——D 必须自己算出最后那个位置的输出才有 logits 可采。

## P 上那条请求必须「撞到长度上限」，否则白算

`request_finished` 的门是两个 and：`kv_transfer_params` 里得有 `do_remote_decode`，**且结束状态必须是 `RequestStatus.FINISHED_LENGTH_CAPPED`** [C11]。这才是代理把 `max_tokens` 设成 1 的真正用处——不是省算力，是让 P 上这条请求以「撞到长度上限」的方式结束。过了这道门它才把块号、engine id、握手 host 和 port 打包成新的 `kv_transfer_params` 交回代理，并返回 `delay_free_blocks=True` 让引擎先别释放块。

而上游 `check_stop` 的判断顺序是先 EOS、再 stop token、最后才轮到长度 [C22]。P 采出的那唯一一个 token 若正好是 EOS，状态就成了 `FINISHED_STOPPED`，第一个 if 直接 `return False, None`：块当场释放，参数返回空。代理拿不到参数，转发给 D 时就不带 `do_remote_prefill`，D 只好把整段 prompt 重算一遍——**结果仍然正确，但那次 prefill 白做了** [D]。

## KV 是 D 拉走的，P 那个「发送线程」一个字节都不发

1. D 的调度器看到 `do_remote_prefill`，问连接器还差多少——`get_num_new_matched_tokens` 返回 `(37, True)`，第二个值是「异步加载」。
2. 调度器把块分好，状态置成 `WAITING_FOR_REMOTE_KVS`，这一步 `num_new_tokens = 0`：**块占上了，一个 token 都不算** [C19]。worker 侧这一步走 `kv_connector_no_forward`，模型压根不跑。
3. `start_load_kv` 把请求丢进队列就返回；真正的搬运在后台线程里，一次 `batch_transfer_sync_read` 把所有层的块地址批量读回来。对面的地址能直接读，是因为两边启动时都把 KV 张量的 HBM 区间 `register_buffer` 给了传输引擎。
4. 搬完，D 给 P 发一个 `DONE_RECVING_MSG`。**P 那个叫 `KVCacheSendingThread` 的线程只是个 ZMQ ROUTER**，答复元数据请求、记录「对面收完了」，它不发 KV [C16]。
5. 两侧各自在 `get_finished` 里上报：D 报 `finished_recving`，请求这才回到 WAITING 排队；P 报 `finished_sending`，块这才真正释放 [C21]。

所以「谁等谁」是：**D 上这条请求从下发到能算，中间隔着整个传输；P 上的块被押着，押到 D 说收完为止。** 传输期间同一份 KV 在两台机器的 HBM 里各占一份。两边的引擎循环都没被堵住——等的是这一条请求，不是这个实例。

## kv_role 不是三选一：上游认 kv_both，Mooncake 不认

上游把角色定义成两个 Literal 的并集，`kv_both` 同时落在生产者和消费者里，于是 `is_kv_producer` 与 `is_kv_consumer` 对它**同时为真** [C7]。但 Mooncake 这条 P2P 路判角色用的是字符串相等：建线程时 `kv_role == "kv_producer"` 才起发送线程，**否则一律起接收线程**；上报完成时也是 `== "kv_producer"` 才收 `done_sending`、`== "kv_consumer"` 才收 `done_recving` [C17]。

合起来看 `kv_both` 的下场：它走 else 分支只有接收线程，而两个上报都是空集 [C18]——启动不报错，请求却永远等不到「传完了」`[!]`。main 开发主线新加的那套 Mooncake 连接器干脆在初始化时就拦：`is_kv_consumer == is_kv_producer` 直接 `ValueError` [C10]。**P2P 只能写 `kv_producer` 或 `kv_consumer`；`kv_both` 是给[外部 KV 池](kv-pool.md)那条路用的。**

一份能跑的 1P1D 配置（裁自官方单机教程 [S24]，模型换成那条请求的 Qwen3-0.6B）：

```bash
# P 节点。D 节点改三处：--port 13701、"kv_role": "kv_consumer"、"kv_port": "30100"
vllm serve /model/Qwen3-0.6B --port 13700 --tensor-parallel-size 1 \
  --no-enable-prefix-caching \
  --kv-transfer-config '{"kv_connector": "MooncakeConnectorV1", "kv_role": "kv_producer",
    "kv_port": "30000",
    "kv_connector_extra_config": {"prefill": {"dp_size": 1, "tp_size": 1},
                                  "decode":  {"dp_size": 1, "tp_size": 1}}}'
```

`kv_port` 是握手端口的基址，实际监听端口按 rank 往上加，同机两个实例必须错开。**`prefill` 和 `decode` 两段两侧都得写全**：worker 初始化对这四个键逐个 `assert`，少一个就是启动即 `AssertionError` [C13]。它们说的不是本机的并行度，而是对面长什么样——D 要拿 P 的 `tp_size` 算出一个块得分几次拉，`prefill_tp_size < decode_tp_size` 直接 `ValueError`，这正是官方限制里「只支持 P_tp 是 D_tp 的整数倍」的由来。`--no-enable-prefix-caching` 是照抄官方示例：代码并不要求关掉它（D 要拉多少是拿 `actual - num_computed_tokens` 算的，本地命中会被减掉），文档也没说为什么要关 [I]。

## 昇腾侧的连接器：模块路径就是分类

`register_connector()` 一次把十来个连接器注册进上游的 `KVConnectorFactory`，路径里的 `kv_p2p` 与 `kv_pool` 就是两类东西 [C8]：**p2p 是把一条请求的 KV 点对点送给指定的那个 D，pool 是按块哈希存进大家都看得见的外部存储**。PD 分离走前者。

| 名字 | 归哪类 | 管什么 |
|---|---|---|
| `MooncakeConnectorV1` | kv_p2p | PD 分离的默认路：D 把 KV 从 P 拉过来 [S3] |
| `MooncakeLayerwiseConnector` | kv_p2p | 反过来，P 算完一层就往 D 推一层；逐层传输本身见 [Layerwise KV Offload](kv-cache-layerwise-offload.md) |
| `AscendStoreConnector` | kv_pool | 外部 KV 池，`MooncakeConnectorStoreV1` 是它的另一个注册名；见 [KV Pool](kv-pool.md) |
| `RecomputeCPUOffloadConnector` | kv_pool | D 上抢占时把 KV 存进主机内存，见 [Recompute CPU Offload](recompute-cpu-offload.md) |

同一个连接器类在两个进程里各造一份：`KVConnectorRole.SCHEDULER` 造 `MooncakeConnectorScheduler`，WORKER 造 `MooncakeConnectorWorker`——上游接口本来就分成调度侧和 worker 侧两组方法。

## 三个分支的差别

整体流程（代理把 `max_tokens` 改成 1、P 必须以长度上限结束、D 拉 KV、D 上多算一次）三版一字不差；连接器自己那一层的版本差异都在 [Mooncake Connector](mooncake-connector.md)。这里只留总览层面的四行。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| Mooncake 连接器 | 只有 `kv_p2p/mooncake_connector.py` 这一套 | 同 v0.23，另多注册一个 p2p 连接器 `SfaRemoteD2HConnector` [C28] | 另加 `kv_p2p/mooncake/` 包，注册成 `MooncakeConnectorV2` 和 `MooncakePullConnector` [C9] | 老连接器三版都在、行为一致；换 V2 才有下一行那道校验 |
| `kv_both` 配 P2P | 静默退化成只收不发，两个方向都报不出完成 | 同 v0.23，照样静默 | 初始化即 `ValueError` | [!] v0.23 和 v0.26 上这个配置不报错也不工作，排查时只看得到「请求卡住」 |
| LMCache | 注册了 `LMCacheAscendConnector` | 同样注册着 | 注册表里没有这一项 | [!] 按 v0.23 或 v0.26 配 LMCache 的部署升到 main 会「连接器不存在」 |
| 设计文档的限制清单 | 列了「P 节点不支持非默认 `max_num_partial_prefills`」[S4] | 这条已经删掉 [S29] | 同 v0.26 | [!] 限制并没有解除：三版平台层都无条件把它重置回 1，而且这跟 PD 无关，是整个昇腾平台的行为 [C25] |

## 常见误解

- **「P 算完会把 KV 推给 D。」**——默认那条路是 D 拉：`batch_transfer_sync_read` 由 D 的接收线程发起，P 侧那个 `KVCacheSendingThread` 只答复元数据和记账。要「推」得换成 `MooncakeLayerwiseConnector`。
- **「P 采样出的第一个 token 会交给 D 用。」**——不会。它被塞进 `kv_transfer_params` 的 `last_token_id` 传过去，但两个仓库里没有任何地方读它；D 拿到全量 KV 后照样把最后一个位置重算一遍再自己采样。第一个 token 实际上被算了两次 [D]。
- **「D 上那一步没算东西，是调度器空转。」**——那一步是特意留给连接器的：`kv_connector_no_forward` 只跑收发、返回一个只带连接器输出的结果，请求这时连 running 队列都还没进。
