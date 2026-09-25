---
id: mooncake-connector
title: "Mooncake 连接器：真正把 KV 从 P 节点搬到 D 节点的零件"
type: feature
summary: PD 分离时，P 节点算好的 KV 要靠连接器搬到 D 节点；昇腾用 Mooncake 写了三套，差别不在快慢，而在谁发起搬运、什么时候发起。
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
    note: 为什么要把 P 和 D 拆开、一条请求在 1P1D 上的完整走法都在那一页，这一页只拆开负责搬运的那个零件
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 连接器自己不分块，它只在上游把块分完之后拿到块号，再把块号翻成 HBM 地址
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 同样是按层搬 KV，那边搬进大家共用的 KV 池、按块哈希复用，这边点对点推给指定的那一个 D 节点
contradicts: []
updated: "2026-09-25"
origin: seed
---

## P 节点算好的 KV，怎么到 D 节点手里？

[PD 分离](pd-disaggregation.md)把一条请求拆成两段：P 节点把整段提问算一遍、填好 KV Cache，D 节点接着一个 token 一个 token 往外吐。中间有一步必须有人做——**把 P 节点显存里那几块 KV 原样搬到 D 节点的显存里**。做这件事的零件叫 KV 连接器；昇腾基于 Mooncake 的传输引擎写了三套，这一页就讲它们。

先说例子。本库贯穿的那个模型 Qwen3.6-35B-A3B，**三个版本的支持矩阵里 PD 分离都是 ❌**（见[一条请求](one-request.md)的版本差异表），拿它讲搬运会讲一件跑不起来的事。所以这一页沿用 PD 分离页的旧例子：一个 28 层的小模型（Qwen3-0.6B），单卡，一条请求占 1 块 KV，整块 14 MiB，每层 512 KiB。机制和模型无关，换成别的模型只是层数和字节数变。

把这 14 MiB 从 P 节点送到 D 节点，有两种做法：

- **整块拉**：P 节点把 28 层全算完、请求结束，D 节点再一次把 14 MiB 全读走。
- **逐层推**：P 节点每算完一层，就把这一层的 512 KiB 推给 D 节点，一共推 28 次。

搬的总字节一样。切成 28 刀的目的，是让前 27 刀藏进 P 节点还在算的时间里。

```wiki-diagram
file: mooncake-connector
```

## 一个连接器，拆成两半住在两个进程里

vLLM 跑起来至少有两类进程：一个管调度（决定这一步算哪些请求、给谁分块），每张卡还有一个工作进程（真正在显存上算）。KV 连接器从设计上就被切成两半，**同一个连接器在这两类进程里各造一次，各干各的**：

- **调度那半**只回答账目问题：这条请求还能从远端拿到多少 token、要不要等；请求结束时，它占的块能不能马上放。它碰不到显存。
- **工作进程那半**干体力活：启动时把 KV 所在的显存区间登记给传输引擎，开后台线程，真正发字节、收字节。

所以文档里说「连接器」，指的其实是这一对。整块拉那套的工作进程那半，在「按层做点什么」的几个接口上全是空的——这正是「整块」的意思：它不按层做任何事，一次把所有层读回来。逐层推那套则把全部重量压在「每层算完之后」那个接口上。

## 拉还是推：看代理先找谁

两台机器前面有个代理，用户请求先到代理。三套连接器的真正区别在更前面——**代理先把请求交给谁**：

| 做法 | 方向 | 代理先找谁 | 一次搬多少 |
|---|---|---|---|
| 整块拉（默认那套） | D 节点拉 | 先 P 节点；P 算完、请求结束，搬运参数才转给 D 节点 | 全部块全部层，一次 |
| 逐层推 | P 节点推 | 先 D 节点；D 占好块再把地址转给 P 节点 | 一层一次 |
| 混合模型那套 | D 节点拉 | 同整块拉 | 同整块拉，另外整份搬[线性注意力](linear-attention.md)的状态 |

逐层推的顺序是：代理先挑一个 D 节点；D 节点把请求标成「等远端 KV」、**先把块占好**，再把自己的块号和地址交给代理；代理这才去挑 P 节点。于是 P 节点算第一层的时候，落点地址已经在手上了。每层注意力算完，这一层的 KV 被打包扔进发送队列就返回，后台线程负责写过去；**只有最后一层写完，才通知一次「发完了」**。

## 逐层推省下的是两段等待

对照上面那张图，逐层推省下来的是：

1. **D 节点的分块时间**，从「P 节点结束之后」提前到了「P 节点开算之前」；
2. **第 1 到 27 层的传输**，和 P 节点算后面那些层重叠了。

它**没有**让 D 节点提前出字——D 节点仍要等 28 层全部到齐才开始生成。

## 两边 TP 不一样大时，谁来拼 KV 头

P 节点常用更大的 [TP](tensor-parallel.md)（算得快），D 节点用更小的。这时一张 D 卡要的 KV 头，分散在好几张 P 卡上，总得有人把它们拼起来。**拉和推把这件事交给了不同的一方：**

- **整块拉是 D 节点拼**：一张 D 卡从几张 P 卡那里各拉一份，凑齐自己该有的 KV 头。[MLA](mla.md) 模型每张卡只有一个头，永远只拉一份。
- **逐层推是 P 节点拼**：P 节点在推之前先把这一层的 K、V 重排、在 P 卡之间交换一次，**写出去的已经是 D 卡想要的那一份**。代价是 P 节点多一条专门做重排的流和一份中转缓冲。
- **混合模型那套不许两边 TP 不等**：线性注意力的状态是整份的，没有按头切开的办法。

## 块押在 P 节点上，直到对面说收完

P 节点上的块不是请求一结束就放，而是**押着，等 D 节点那边报告收完才放**。押太久（默认 480 秒，也就是 8 分钟）会被强制释放并打一条错误日志。所以 D 节点挂了、端口配错了、网络断了，P 节点上的症状都一样：块被押满八分钟，新请求分不到块。

底下真正搬字节的是 Mooncake 的传输引擎，走的是昇腾自己的协议、点对点握手，不需要 Mooncake 另外的元数据服务。启动时每张卡把 KV 的显存区间一次性登记给它，之后搬运时只传「地址 + 长度」。登记的区间数有上限（256 个），层多、K/V 分开分配的模型要靠把相邻区间合并才登记得下。

## 常见误解

- **「逐层推是为了让 D 节点提前出字。」**——不是。P 节点把最后一层推完才通知 D 节点开始生成。提前的是 D 节点的分块，重叠的是传输和 P 节点后面那些层的计算。
- **「官方那篇 Mooncake 逐层文档讲的就是这里的逐层推。」**——不是同一个东西。那篇文档只在 main 上有，讲的是 KV 池那条路的逐层存取，见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)。PD 这条点对点路的逐层推，三个版本上都没有自己的官方文档。
- **「三套连接器判断自己是 P 还是 D 的方式一样。」**——不一样。同一个「两边都是」的角色，在逐层推那套上会把收、发两个线程都起起来，在整块拉那套上只起接收线程。细节见下面「开销和什么时候别开」。

## 对照源码

下面按 v0.23 维护分支讲；三套实现（`mooncake_connector.py`、`mooncake_layerwise_connector.py`、`mooncake_hybrid_connector.py`）在 v0.23、v0.26、main 三个 commit 上都在 [C8][C9][C10]，新增的连接器和行为分叉在版本差异表里。

### 怎么开

一份能跑的最小配置（P 节点；D 节点改 `kv_role` 和 `kv_port`）：

```bash
--kv-transfer-config '{"kv_connector": "MooncakeConnectorV1", "kv_role": "kv_producer",
  "kv_port": "30000",
  "kv_connector_extra_config": {"prefill": {"dp_size": 1, "tp_size": 1},
                                "decode":  {"dp_size": 1, "tp_size": 1}}}'
```

不传 `--kv-transfer-config` 时 `is_kv_transfer_instance` 为假，一个连接器都不造——单卡混部就是这样。

上游 `KVTransferConfig` 里跟这条路有关的只有四个字段：`kv_connector` 是注册名、`kv_role` 是角色、`kv_port` 是握手端口基址（默认 **14579**）、`kv_connector_extra_config` 是留给连接器自己解释的口袋；`engine_id` 不写会自动生成一个 uuid [C20]。**口袋里那两段写的是对面长什么样，不是本机**：`prefill` 与 `decode` 两段各自的 `tp_size`、`dp_size` 被逐个 `assert`；`pp_size` 可以不写，默认 1，但 `decode.pp_size` 必须是 1 [C21]。

三个注册名与方向：`MooncakeConnectorV1`（D 拉，一次 `batch_transfer_sync_read` 读回全部块全部层 [C15]）、`MooncakeLayerwiseConnector`（P 推，一层一次 `batch_transfer_sync_write` [C18]）、`MooncakeHybridConnector`（D 拉，另外整块搬 Mamba 的 conv 与 ssm 状态）。逐层推的六步（`select_decoder` → D 标 `WAITING_FOR_REMOTE_KVS` 并占块 → 块号、host、port 发给代理的 metaserver 端点 → 代理挑 P → `save_kv_layer` 每层入队、`current_layer += 1` → 最后一层传完回调一次 `DONE_SENDING`）见官方设计文档 [S12][S13][S14] 与 [C16][C17][C19]。

骨架：`KVConnectorRole` 只有 `SCHEDULER` 和 `WORKER` 两个取值 [C3]；`MooncakeConnector.__init__` 按 role 二选一造出 `MooncakeConnectorScheduler` 或 `MooncakeConnectorWorker`，另一个留 `None`，每个公开方法先 `assert` 对应那半不是 `None` [C6][C7]。调度侧强制实现的抽象方法是 `get_num_new_matched_tokens`、`update_state_after_alloc`、`build_connector_meta`；`request_finished` 基类默认返回 `(False, None)`，扣住块是子类自己选的 [C1][C4][C5]。worker 侧抽象方法是 `start_load_kv`、`wait_for_layer_load`、`save_kv_layer`、`wait_for_save`，整块传那一套把后三个全写成 `pass`。

`kv_port` 只是基址，每个 rank 自己往上加。**三套连接器的偏移公式并不相同**，照搬会算错：

| 连接器 | `side_channel_port` = `kv_port` + | 每个 worker 再加 |
|---|---|---|
| V1 | `dp_rank × tp × pp × pcp` | `(pp_rank × pcp + pcp_rank) × tp + tp_rank` [C22] |
| Layerwise · 调度侧 | `dp_rank × tp` [C23] | 调度侧把这个值当作基址发给对面 |
| Layerwise · worker 侧 | `dp_rank × pcp × tp + pcp_rank × tp` [C24] | `tp_rank`，接收线程就 listen 在这里 |
| Hybrid | `dp_rank × tp × pp` [C26] | `pp_rank × tp + tp_rank` |

代进 1P1D、`kv_port` = 30000：`side_channel_port = 30000 + 0 × 1 × 1 × 1 = 30000`，唯一那个 worker 的握手端口 `= 30000 + (0 × 1 + 0) × 1 + 0 = 30000` [D]。V1 那行和[大规模 EP 部署](large-scale-ep.md)记的公式是同一条，一个 `kv_port` 能给几十个 DP rank 用的道理在那一页。

KV 头怎么对应：V1 是 D 拼，`tp_num_need_pulls = (kv_heads ÷ D_tp) ÷ (kv_heads ÷ P_tp)`，MLA 恒为 1 [C28]；Layerwise 是 P 拼，`ascend_config` 从同样那两个键算出 `pd_head_ratio = P_tp ÷ D_tp`（两边先各自跟 `kv_heads` 取 min），并 `assert P_tp % D_tp == 0` [C29]，推之前先按块重排再做一次 `kv_alltoall_and_rearrange` [C30]。

传输引擎初始化写死成 `initialize(hostname, "P2PHANDSHAKE", "ascend", device_name)` [C32]；KV 张量的 HBM 区间在 `register_kv_caches` 里一次性 `register_memory` 登记。

### 会报什么错

- `kv_connector_extra_config` 缺 `prefill` / `decode` 的 `tp_size` 或 `dp_size`：启动即 `AssertionError`；`decode.pp_size` 不是 1 同样断言失败。
- Layerwise 上 `P_tp % D_tp != 0`：断言失败。
- Hybrid 上两边 TP 不等：初始化时 `assert self._prefill_tp_size == self._decode_tp_size` [C31]。
- 登记的区间数超过 256（HCCL 每进程限制 `MAX_HCCL_REGISTER_REGIONS`）：直接 `RuntimeError`，信息让你减少 KV 分配碎片或进一步合并 k/v/dsa/scale 的分配 [C33]；合并靠 `collect_storage_merged_register_regions` 按底层 storage 把相邻区间并起来。
- 块押过 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT`：`KVCacheTaskTracker` 把它从 `delayed_free_requests` 里强制释放并打一条 error [C35]，默认 **480 秒** [C36]。
- **Layerwise 在 `pcp > 1` 时端口对不上** `[!]`：D 的调度侧告诉 P 的基址少乘了一个 `pcp_size`，而 D 的接收线程按 worker 那条公式绑端口，P 会照着一个没人 listen 的端口去要元数据。三个版本都是这样。

### 开销和什么时候别开

- **传输超时不是上面那个 480 秒**。worker 初始化时把 `ASCEND_TRANSFER_TIMEOUT` 写成 `4.096 × 2^HCCL_RDMA_TIMEOUT × HCCL_RDMA_RETRY_CNT ÷ 1000 + 3000` 毫秒 [C34]；默认 20 和 7 代进去是 `4.096 × 1048576 × 7 ÷ 1000 + 3000 ≈ 33064` 毫秒，**约 33 秒** [D]。另外收发线程起不来时还有一道 5 分钟的就绪超时。
- 例子里的搬运量：1 块 14 MiB、28 层；V1 是**一次** `batch_transfer_sync_read`，Layerwise 是 **28 次** `batch_transfer_sync_write`、每次 1 块 × 512 KiB [D]（数取自 [PD 分离](pd-disaggregation.md)）。
- Layerwise 在 P_tp > D_tp 时，P 侧多一条 resharding stream 和一份中转 buffer。
- 判角色的方式不同：V1 和 Hybrid 拿 `kv_role` 做字符串相等比较，Layerwise 用上游的 `is_kv_producer` / `is_kv_consumer` 两个属性，而 `kv_both` 对这两个属性同时为真——所以 `kv_both` 在 Layerwise 上会把收、发两个线程都起起来，在 V1 上只起接收线程。
- 官方 `mooncake_layerwise_adaptation_and_optimization.md` 只在 main 上有，配置写的是 `"kv_connector": "AscendStoreConnector"` 加 `"use_layerwise": true` [S38][S39]，不是 `MooncakeLayerwiseConnector` `[!]`。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| p2p 连接器清单 | V1 / Layerwise / Hybrid 三套 | 多一个 `SfaRemoteD2HConnector` | 再多 `MooncakeConnectorV2` 与 `MooncakePullConnector` | 名字变多，但默认那条路三版都是 V1 |
| V2 能不能逐层推 | 没有 V2 | 没有 V2 | 不能：`MooncakePushConnector` 直接 `NotImplementedError`，`MooncakeConnectorV2` 只是 Pull 的别名 [C11] | `[!]` 想逐层推，main 上也仍得用老的 `MooncakeLayerwiseConnector` |
| V2 要不要填 prefill/decode 的 tp_size | 没有 V2 | 没有 V2 | 不要：`kv_p2p/mooncake/` 下 `git grep extra_config` 零命中，对面的 TP 布局从握手元数据里的块形状反推 | 换 V2 时这两段可以删；换回 V1 又得加回来 |
| V2 支不支持 PCP | 没有 V2 | 没有 V2 | `assert pcp_size == 1` [C37] | `[!]` 开了 prefill context parallel 就只能留在 V1 |
| Hybrid 的端口基址 | `dp_rank × tp × pp` | 同 v0.23 | 多乘一个 `pcp_size` | `[!]` 同机多实例又开了 PCP 时，升到 main 端口分配会变，照抄旧配置会撞 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 连接器两半的接口 | 上游 `vllm/distributed/kv_transfer/kv_connector/v1/base.py`，`KVConnectorBase_V1`、`KVConnectorRole` |
| 配置字段 | 上游 `vllm/config/kv_transfer.py`，`KVTransferConfig` |
| 整块拉 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py` |
| 逐层推 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py` |
| 混合模型 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py` |
| 注册清单 | `vllm_ascend/distributed/kv_transfer/__init__.py` |
| 传输引擎、超时、区间上限 | `vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py`、`utils/utils.py` |
| P/D 的 TP 比值 | `vllm_ascend/ascend_config.py`，`pd_head_ratio` |
| main 上的 V2 | `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/` |
