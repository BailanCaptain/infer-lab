---
id: mooncake-connector
title: "Mooncake 连接器：真正把 KV 从 P 搬到 D 的那半个零件"
type: feature
summary: 上游把 KV 连接器切成调度侧与 worker 侧两半，昇腾在这个接口下写了三套 Mooncake 实现，差别在谁发起搬运、什么时候发起。
aliases: [Mooncake 连接器, Mooncake Connector, KV Connector, KV 连接器, MooncakeConnector, MooncakeLayerwiseConnector, MooncakeHybridConnector, MooncakeConnectorV2, MooncakePullConnector, KVConnectorBase_V1, KVConnectorRole, kv_transfer_config, kv_connector_extra_config, Mooncake TransferEngine, 逐层推 KV]
chapters: ["18"]
order: 20
sources:
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L7-L24
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L26-L40
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L124-L130
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L453-L458
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L542-L561
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1508-L1522
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1580-L1592
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L29-L55
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L89-L93
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L59
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L247-L260
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L17-L20
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/disaggregated_prefill.html
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L47-L54
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L962-L969
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L936-L982
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1808-L1837
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L494-L527
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1359-L1398
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L26-L61
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2066-L2086
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2029-L2038
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L809-L812
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1163-L1169
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L603-L607
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1551-L1558
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1716-L1723
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2057-L2062
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L213-L237
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1762-L1782
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1522-L1530
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L24-L29
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/utils/utils.py#L428-L445
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/utils/utils.py#L55-L61
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L221-L242
  - vllm@0fc695fc:vllm/envs.py#L222-L222
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L101-L101
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L189-L200
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.html
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2464-L2472
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: 为什么要把 P 和 D 拆开、那条请求在 1P1D 上的完整走法都在那一页，这一页只拆开负责搬运的那个零件
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 连接器自己不分块，它只在上游把块分完之后拿到块号，再把块号翻成 HBM 地址
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 同样是按层搬 KV，那边搬进大家共用的 KV 池、按块哈希复用，这边点对点推给指定的那一个 D
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

KV 连接器是上游给「把 KV 从一个实例搬到另一个实例」留的接口，**它从文件头第一行就被切成两半**：调度侧那半跑在 EngineCore 进程里，只回答「这条请求还差多少 token」「结束时块能不能放」；worker 侧那半跑在每张卡的 worker 进程里，登记 HBM 地址、开后台线程、真正发字节。昇腾在这个接口下写了三套 Mooncake 实现，**它们的差别不是快慢，是谁发起搬运、以及什么时候发起**。

三套（`mooncake_connector.py`、`mooncake_layerwise_connector.py`、`mooncake_hybrid_connector.py`）在 v0.23 维护分支、v0.26 分支、main 开发主线上都在——三个 commit 上 `git ls-tree vllm_ascend/distributed/kv_transfer` 各自都列出这三个文件。下面按 v0.23 讲；新增的连接器和真实的行为分叉在差异表里。

```wiki-diagram
file: mooncake-connector
```

## 那条请求用不到它

[那条请求](one-request.md)是单卡混部，命令行没有 `--kv-transfer-config`，`is_kv_transfer_instance` 为假，连接器一个都不造。最小的改法是拆成 1P1D：两张卡各起一个实例，一边 `kv_role: kv_producer`、一边 `kv_consumer`，两边都把 `prefill` 和 `decode` 两段写成 `tp_size: 1, dp_size: 1`。

代进端口公式（`kv_port` 取 30000）：`side_channel_port = 30000 + 0 × 1 × 1 × 1 = 30000`，唯一那个 worker 的握手端口 `= 30000 + (0 × 1 + 0) × 1 + 0 = 30000`。要搬的是 1 块 14 MiB、28 层（数取自 [PD 分离](pd-disaggregation.md)）：走整块传是**一次** `batch_transfer_sync_read`，走逐层传就是 **28 次** `batch_transfer_sync_write`，每次 1 块 × 512 KiB [D]。搬的总字节一样，切成 28 刀的目的是让前 27 刀藏进 P 还在算的时间里。

## 一个连接器类，在两个进程里各活半个

`KVConnectorRole` 只有 `SCHEDULER` 和 `WORKER` 两个取值，同一个连接器类在这两个进程里各被造一次。昇腾三套实现都照同一个骨架写：`MooncakeConnector.__init__` 按 role 二选一造出 `MooncakeConnectorScheduler` 或 `MooncakeConnectorWorker`，另一个留 `None`，每个公开方法进来先 `assert` 对应那半不是 `None`。**所以「连接器」这个词在代码里从来不指一个对象，它指一对。**

调度侧真正强制要实现的只有三个抽象方法：`get_num_new_matched_tokens`（还能从远端拿到多少 token、是不是异步加载）、`update_state_after_alloc`、`build_connector_meta`。`request_finished` 有默认实现，基类直接返回 `(False, None)`——意思是「块现在就放，也没有参数要带回去」，扣住块是子类自己选的。

worker 侧的抽象方法是 `start_load_kv`、`wait_for_layer_load`、`save_kv_layer`、`wait_for_save`。**整块传那一套把后三个全写成 `pass`** [C7]——这正是「整块」的定义：它不按层做任何事，一次把全部层读回来。逐层传那一套的全部重量都压在 `save_kv_layer` 上。

## 拉还是推，分水岭是谁先拿到这条请求

官方设计文档把两条路写成一句话：整块的那套 D 从 P 拉，逐层的那套 P 往 D 推。真正的区别在更前面——**代理先找谁**。

| 注册名 | 方向 | 代理先找谁 | 一次搬的粒度 |
|---|---|---|---|
| `MooncakeConnectorV1` | D 拉 | 先 P；P 算完、请求结束，参数才转给 D | 全部块全部层，一次 `batch_transfer_sync_read` [C15] |
| `MooncakeLayerwiseConnector` | P 推 | 先 D；D 占好块再经 metaserver 转给 P | 一层一次 `batch_transfer_sync_write` [C18] |
| `MooncakeHybridConnector` | D 拉 | 同 V1 | 同 V1，另外整块搬 Mamba 的 conv 与 ssm 状态 |

逐层那条路的六步在文档里写得很清楚：代理先 `select_decoder`，D 把请求标成 `WAITING_FOR_REMOTE_KVS`、**先把块占好**，再把自己的块号、host、port 打包发给代理的 metaserver 端点，代理这才去挑 P。于是 P 算第一层的时候，落点地址已经在手上了：`save_kv_layer` 在每层注意力之后被调一次，把这一层打包扔进发送队列就返回，`current_layer += 1`；后台线程做 `batch_transfer_sync_write`，**只有最后一层传完才回调一次 `DONE_SENDING`**。

所以逐层传省下来的是两段：**D 的块分配从「P 结束之后」提前到了「P 开算之前」**，以及第 0 到 26 层的传输和 P 算第 1 到 27 层重叠。它没有让 D 提前出字——D 仍要等全部层到齐 [S14]。

## 配置里那两段写的是对面长什么样，不是本机

一份能跑的最小配置（P 侧；D 侧改 `kv_role` 和 `kv_port`）：

```bash
--kv-transfer-config '{"kv_connector": "MooncakeConnectorV1", "kv_role": "kv_producer",
  "kv_port": "30000",
  "kv_connector_extra_config": {"prefill": {"dp_size": 1, "tp_size": 1},
                                "decode":  {"dp_size": 1, "tp_size": 1}}}'
```

上游 `KVTransferConfig` 里跟这条路有关的只有四个字段：`kv_connector` 是注册名、`kv_role` 是角色、`kv_port` 是握手端口基址（默认 **14579**）、`kv_connector_extra_config` 是留给连接器自己解释的口袋；`engine_id` 不写会自动生成一个 uuid [C20]。口袋里被逐个 `assert` 的是 `prefill` 与 `decode` 两段各自的 `tp_size`、`dp_size`，少一个就是启动即 `AssertionError`；`pp_size` 可以不写，默认 1，但 `decode.pp_size` 必须是 1 [C21]。

`kv_port` 只是基址，每个 rank 自己往上加。**三套连接器的偏移公式并不相同**，照搬会算错：

| 连接器 | `side_channel_port` = `kv_port` + | 每个 worker 再加 |
|---|---|---|
| V1 | `dp_rank × tp × pp × pcp` | `(pp_rank × pcp + pcp_rank) × tp + tp_rank` [C22] |
| Layerwise · 调度侧 | `dp_rank × tp` [C23] | 调度侧把这个值当作基址发给对面 |
| Layerwise · worker 侧 | `dp_rank × pcp × tp + pcp_rank × tp` [C24] | `tp_rank`，接收线程就 listen 在这里 |
| Hybrid | `dp_rank × tp × pp` [C26] | `pp_rank × tp + tp_rank` |

V1 那行和 [大规模 EP 部署](large-scale-ep.md)记的公式是同一条，一个 `kv_port` 能给几十个 DP rank 用的道理在那一页。但 **Layerwise 自己的两条公式在 `pcp > 1` 时对不上**：D 的调度侧告诉 P 的基址少乘了一个 `pcp_size`，而 D 的接收线程按 worker 那条公式绑端口，P 会照着一个没人 listen 的端口去要元数据 `[!]`。三个版本都是这样。

## P 的 TP 比 D 大时，多出来的 KV 头得有人拼

这两个键的第二个用处是算 KV 头怎么对应。**拉和推把这件事交给了不同的一方。**

V1 是 D 拼：`tp_num_need_pulls = (kv_heads ÷ D_tp) ÷ (kv_heads ÷ P_tp)`，也就是一个 D rank 得从几个 P rank 那里各拉一份才凑得齐自己该有的 KV 头；MLA 模型恒为 1，因为它每 rank 只有一个头 [C28]。

Layerwise 是 P 拼：`ascend_config` 从同样那两个键算出 `pd_head_ratio = P_tp ÷ D_tp`（两边先各自跟 `kv_heads` 取 min），并 `assert P_tp % D_tp == 0` [C29]；P 在推之前先把这一层的 K、V 按块重排，再做一次 `kv_alltoall_and_rearrange`，**写出去的已经是 D 想要的那一份** [C30]。代价是 P 侧多一条 resharding stream 和一份中转 buffer。

Mamba 那条路不许不等：hybrid 连接器初始化时 `assert self._prefill_tp_size == self._decode_tp_size` [C31]，线性注意力的状态是整份的，没有按头切的办法。

## 块押在 P 上，押到对面说收完，或者 480 秒

P 侧的块不是请求结束就放，是 worker 侧 `get_finished` 报出 `finished_sending` 才放；在那之前 `KVCacheTaskTracker` 把它押在 `delayed_free_requests` 里。押过 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT` 就强制释放并打一条 error，这个环境变量**默认 480 秒** [C36]。D 挂了、端口错了、网络断了，症状都是 P 上的块被押满八分钟。

底下走的是 Mooncake 的 `TransferEngine`，初始化参数写死成 `initialize(hostname, "P2PHANDSHAKE", "ascend", device_name)`——协议名就是 `ascend`，握手是点对点的，不需要 Mooncake 的 metadata server。KV 张量的 HBM 区间在 `register_kv_caches` 里一次性 `register_memory` 登记给它，之后搬运收的就是裸地址和长度。

两条会真踩到的硬上限：

- **登记的区间数不能超过 256**（HCCL 每进程的限制），超了直接 `RuntimeError`，错误信息让你去减少 KV 分配的碎片 [C33]。层多、K/V/scale 分开分配的模型全靠 `collect_storage_merged_register_regions` 按底层 storage 把相邻区间并起来才登记得下。
- **传输超时不是上面那个 480 秒**。worker 初始化时把 `ASCEND_TRANSFER_TIMEOUT` 写成 `4.096 × 2^HCCL_RDMA_TIMEOUT × HCCL_RDMA_RETRY_CNT ÷ 1000 + 3000` 毫秒 [C34]；默认的 20 和 7 代进去是 `4.096 × 1048576 × 7 ÷ 1000 + 3000 ≈ 33064` 毫秒，**约 33 秒** [D]。另外收发线程起不来时还有一道 5 分钟的就绪超时。

## 三个版本上，连接器清单和端口都在动

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| p2p 连接器清单 | V1 / Layerwise / Hybrid 三套 | 多一个 `SfaRemoteD2HConnector` [C9] | 再多 `MooncakeConnectorV2` 与 `MooncakePullConnector` [C10] | 名字变多，但默认那条路三版都是 V1 |
| V2 能不能逐层推 | 没有 V2 | 没有 V2 | 不能：`MooncakePushConnector` 直接 `NotImplementedError`，`MooncakeConnectorV2` 只是 Pull 的别名 [C11] | `[!]` 想逐层推，main 上也仍得用老的 `MooncakeLayerwiseConnector` |
| V2 要不要填 prefill/decode 的 tp_size | 没有 V2 | 没有 V2 | 不要：`kv_p2p/mooncake/` 下 `git grep extra_config` 零命中，对面的 TP 布局从握手元数据里的块形状反推 | 换 V2 时这两段可以删；换回 V1 又得加回来 |
| V2 支不支持 PCP | 没有 V2 | 没有 V2 | `assert pcp_size == 1` [C37] | `[!]` 开了 prefill context parallel 就只能留在 V1 |
| Hybrid 的端口基址 | `dp_rank × tp × pp` | 同 v0.23 | 多乘一个 `pcp_size` [C27] | `[!]` 同机多实例又开了 PCP 时，升到 main 端口分配会变，照抄旧配置会撞 |

## 常见误解

- **「逐层传是为了让 D 提前出字。」**——不是。官方那六步里 P 把最后一层推完才通知 D 开始 decode。提前的是 D 的块分配，重叠的是传输和 P 后面那些层的计算。
- **「`mooncake_layerwise_adaptation_and_optimization.md` 讲的就是 `MooncakeLayerwiseConnector`。」**——不是同一个东西。那篇文档只在 main 上有，它给的配置写的是 `"kv_connector": "AscendStoreConnector"` 加 `"use_layerwise": true` [S38]，讲的是 KV 池那条路的逐层存取，见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)。PD 这条 p2p 路的逐层推在三个版本上都没有自己的官方文档 `[!]`。
- **「三套连接器判角色的方式一样。」**——不一样。V1 和 Hybrid 拿 `kv_role` 做字符串相等比较，Layerwise 用的是上游的 `is_kv_producer` / `is_kv_consumer` 两个属性，而 `kv_both` 对这两个属性同时为真，所以同一个 `kv_both` 在 Layerwise 上会把收、发两个线程都起起来，在 V1 上只起接收线程。
