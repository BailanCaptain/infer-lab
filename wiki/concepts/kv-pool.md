---
id: kv-pool
title: "KV Pool：命中的前缀不再只能来自本卡 HBM"
type: feature
summary: 挂在 vLLM KV Connector 接口上的外部 KV 存储。昇腾侧的实现叫 AscendStoreConnector，背后可换三种存储引擎；默认非 layerwise 路径经 worker 查询命中 token 数，搬数据时直接读写 HBM 原始地址。
aliases: [KV Pool, KV Cache Pool, KV 缓存池, Ascend Store, AscendStoreConnector]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L3-L44
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L3-L15
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L38-L52
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L46-L81
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L104-L147
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L321-L342
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L234-L253
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L409-L452
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L574-L626
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L166-L189
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1146-L1161
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L37
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L815-L830
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1004-L1035
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1085-L1173
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2595-L2639
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1175-L1186
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L116-L126
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L66-L76
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L436-L464
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L40-L55
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L52-L75
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L123-L142
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L19-L35
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L3254-L3264
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L108-L119
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L405-L415
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L148-L153
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L114-L124
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L249-L258
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L99-L103
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L248-L256
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 池查询把 HBM 里已命中的 token 数当起点，只把多出来的那一段搬进来；命中的单位同样是写满的块
  - to: paged-attention
    kind: builds-on
    note: 池里一条 key 对应 HBM 里一个块的全部层，地址由 block_id × block_stride 直接算出
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样是把 KV 挪出 HBM，但落点是跨节点共享的外部存储池，而不是本机 DRAM
  - to: vllm-v1-shape
    kind: builds-on
    note: 默认非 layerwise 路径用 ZMQ 把命中查询交给 worker，跨的是那一页讲的调度器与 worker 两个进程
contradicts: []
updated: "2026-09-22"
---

## 一句话

KV Pool 把算过的前缀从本卡 HBM 里挪出来，放进一个 **DRAM、SSD、别的节点都看得见**的外部存储。昇腾侧的实现叫 `AscendStoreConnector`，挂在 vLLM V1 的 KV Connector 接口上，背后可换 `mooncake` / `memcache` / `yuanrong` 三种存储引擎 [C5]。它不替代 [prefix caching](prefix-caching.md)，而是接在它后面：**HBM 里命中到第几个 token 是起点，池只补上多出来的那一段**。

```wiki-diagram
file: kv-pool
```

## 那条请求走不到这里，差一个块

[那条请求](one-request.md)的问题只有 37 个 token。给它配上 `kv-transfer-config`、走下图的默认非 layerwise 路径时，`get_num_new_matched_tokens` 会在查池前退出：`discard_partial_chunks` 默认为真，先把 prompt 长度向下取整到传输粒度，`37 // 128 × 128 = 0`，`0 < 128`，`return 0, False` [C10]。**这条默认路径只查询写满的块**——连一个块都凑不出来的请求，池根本不会被问到。

要让这一页有数可算，把那条请求的问题拉长到顶格 4096 token，其余设定不变 [A]：

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 切成几条 key | 4096 / 128 = **32 条** | 传输粒度 = 各 group `block_size` 的 lcm = 128 |
| 一条 key 搬多少字节 | **14 MiB** | `prepare_value` 对该 group 的每个 cache 张量各生成一条 `(addr, size)`：28 层 × K/V 两张 [C21] |
| 全量落池 | 32 × 14 MiB = **448 MiB** | 每 token 112 KiB，两个数都取自[那条请求](one-request.md) [D] |
| 示例配置每卡装得下几条 | `global_segment_size: "1GB"` → **两条多一点** | 那是**每张卡**贡献给池的内存，不是全池容量 [S27] |

示例值只够跑通流程，上生产得按「并发 × 前缀长度 × 112 KiB/token」重估。112 KiB 也只对 GQA 布局成立：`_as_cache_tuple` 只管「是张量就包成一元组，否则原样转 tuple」，一层注册成几个张量由注意力后端交上来的结构决定，MLA 把 KV 合成一张就对不上了 [D]。

## 默认非 layerwise 路径把查表交给 Worker

同一个 `AscendStoreConnector` 类在两种角色下长得不一样：`KVConnectorRole.SCHEDULER` 造 `KVPoolScheduler`，其余角色造 `KVPoolWorker`，而且**只有 `rank == 0` 且没开 layerwise 的 worker** 才额外起一个 `LookupKeyServer` [C6]。默认非 layerwise 查询用 `LookupKeyClient` 经 ZMQ 去问这个 REP 后台线程，答案是 **4 个字节的大端整数**：池里一共命中到第几个 token。这次查询把 vLLM 自己算出的 `num_computed_tokens` 当作 `hbm_hit_tokens` 一起发过去，返回值减掉它才是真要搬的量——官方文档把这条叫「只取多出来的块，其余直接用片上的」[S4]，**这就是 KV Pool 和 prefix caching 的接缝**。worker 那侧把这段 token 的块哈希拼成 key，整批丢给存储引擎问 `exists`。所以池只知道块在不在，不知道块里是什么。

**不能据此推成「调度器没有存储客户端」。** main 的 `KVPoolScheduler` 构造时会调用后端的 `create_scheduler_client` [C11]；layerwise 查询按数据面另走分支，不经过上面这条默认 ZMQ 路径 [C10]。图里画的是非 layerwise 模式，逐层模式要看 [Layerwise KV Offload](kv-cache-layerwise-offload.md)。

这也解释了后面为什么搬运那么直白：源和目的都是 KV cache 张量的**原始 HBM 地址**。`register_buffer` 把这些区间登记给存储引擎之后，`put` / `get` 收的就是裸地址列表和长度列表，没有 LMCache 那样的中转 buffer——官方设计文档说得很直白：不把 MooncakeStore 挂在 LMCache 的 remote backend 后面，就是为了用上贴合昇腾硬件的传输策略 [S3]。

## 换个并行切分，池里的旧数据就全部作废

非 layerwise 模式下**层不是 key 的一部分**：一条 key 一次覆盖该 kv cache group 在本 rank 上的全部 28 层，地址由 `base_addr + block_id × block_stride` 直接算出。key 串里带的是模型名、各并行维度的 rank、group、cache_role、cache_family，最后才是那个块哈希——换模型名、换 TP/PP/DCP 切分，池里的旧数据一条都对不上。**升级也算换切分**：v0.23 维护分支的 key 以 `@pcp<n>@dcp<n>` 开头 [C20]，v0.26 分支写成 `@pcp:<n>@dcp:<n>` [C30]，main 开发主线把 `pcp` 这一段整个删掉，只剩 `@dcp:<n>` [C19]。三个分支的池数据两两不通用。

## 默认只有 Prefill 碰池；读是同步的，写交后台线程

`kv_role == "kv_consumer"` 且没开 `consumer_is_to_load` 时，`get_num_new_matched_tokens` 第一行就返回 0 [C10]；写回侧由 `consumer_is_to_put` 把关，两个开关默认都是 `false`。PD 分离部署里 Decode 的 KV 由 `MooncakeConnectorV1` 点对点送来，池只服务 Prefill。两个方向的同步性却完全不同，这直接决定它压在哪条关键路径上：

- **读默认是同步的。** `load_async` 同样默认关，不开时 `start_load_kv` 里直接调 `m_store.get(...)`，这一步的耗时算进前向。
- **写交后台线程，但不是不等。** `wait_for_save` 录一个 `torch.npu.Event` 后把请求塞进发送线程队列，随即 `request_queue.join()` 等队列排空（这一等在 main 上已经挪到下一步开头，见下表）；发送线程在真正 `put` 之前会 `current_event.synchronize()`，确保前向已经把 KV 写进 HBM [C18]。

一份能直接跑的 PD 混部配置（`kv_both` = 既读也写池）[S28]。`lookup_rpc_port: "0"` 是本节点第一个实例，第二个改 `"1"`；`backend` 名字写错是启动即 `ValueError`，不会静默退回默认值 [C11]。main 上还多一个 `qos_priority`，整数 0–4，越大越优先，类型错或越界同样是启动即 `ValueError` [C25]：

```bash
export PYTHONHASHSEED=0   # 所有节点必须一致，否则块哈希对不上
KV_CONFIG='{
  "kv_connector": "AscendStoreConnector", "kv_role": "kv_both",
  "kv_connector_extra_config": { "backend": "mooncake", "lookup_rpc_port": "0" }
}'
```

## 三个分支在这一页上的差别

下表对照 **v0.23 维护分支**（源码快照 `2c59ff10`）、**v0.26 分支**（`2ed6cbba`）与 **main 开发主线**（2026-09-21 的源码快照 `baa023ad`）。此外 main 把 `config_data.py` 改名成 `metadata.py`、`backend/backend.py` 改名成 `backend/base.py`，v0.26 仍用 v0.23 那两个文件名——那只是重构，import 路径不兼容，数据兼不兼容看下表第一行。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| key 串开头 | `@pcp<n>@dcp<n>@…` | `@pcp:<n>@dcp:<n>@…` | 去掉 `pcp`，只剩 `@dcp:<n>@…` | [!] 三版的池数据两两不通用，升级等于清池 |
| layerwise 下 Decode 写不写池 | `save_kv_layer` 只看 `kv_role`，是 consumer 就直接 return [C8] | 和非 layerwise 一样看 `consumer_is_to_put` [C31] | 同 v0.26，只是抽成 `is_kv_save_role()` [C7] | [!] 同时开 `use_layerwise` 和 `consumer_is_to_put` 的 Decode 节点，只有 v0.23 仍不写池 |
| mooncake + layerwise | 没有这条路，`use_gva_layerwise` 写死只认 `memcache` [C29] | 同 v0.23，仍只认 `memcache` [C32] | 多一条 mooncake 专属的 block-key 路径，且只支持纯 TP：PP / PCP / DCP 任一 > 1 就 `ValueError` [C23] | main 新增，但用户文档的参数表仍写着 `use_layerwise` 需要 `memcache` [S1]——照文档配会漏掉它；逐层传输本身见 [Layerwise KV Offload](kv-cache-layerwise-offload.md) |
| 写回等在哪一步 | `wait_for_save` 末尾 `request_queue.join()`，本步不排空不返回 | 同 v0.23 | `wait_for_save` 只登记一个 save batch 就返回，改由下一步的 `handle_preemptions` → `wait_for_previous_save()` 等它落地 [C17][C33] | [!] main 上写回真正跨出了本步，profiling 里这段耗时记在下一步的开头；栅栏挪到了「块被复用之前」，不是「本步结束之前」 |

## 常见误解

- **「`lookup_rpc_port` 是个 TCP 端口，要挑没被占用的。」**——不是。它只是拼进 IPC 套接字路径 `ipc://$VLLM_RPC_BASE_PATH/lookup_rpc_port_<n>_dp_rank<r>` 的一段字符串 [C12]。文档说「每个实例需要唯一配置」是对的，但唯一性的作用域是同机的这条路径，跟端口占用无关。
- **「开了 KV Pool，prefix caching 就被替代了。」**——反过来，它建立在 prefix caching 之上：命中先在 HBM 里算，池只补上多出来的那一段，其余块仍从片上直接取。关掉 prefix caching，池也就没有可衔接的命中前缀了。
- **「池里查到了就一定能用上。」**——`get` 返回非 0 的块会被记进 `_invalid_block_ids` [C16]，而 vLLM 侧 `kv_load_failure_policy` 默认是 `fail`，请求直接报错终止；要让它退回重算必须显式配 `recompute`，且混合注意力模型还不支持 [S1]。
