---
id: kv-pool
title: KV Pool
type: feature
summary: 把 KV cache 存进 HBM 之外的共享存储池（Mooncake / Memcache / Yuanrong），让前缀命中能跨请求、跨实例复用；AscendStoreConnector 在调度侧查命中数、在 worker 侧按块地址把 KV 搬进搬出 HBM。
aliases: [KV 缓存池, KV Cache Pool, AscendStoreConnector, Ascend Store]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_pool.md#L11-L43
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_pool.md#L175-L179
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_pool.md#L299-L314
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L39-L49
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L116
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L204-L252
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L291-L334
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L90-L102
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L161-L172
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L456-L496
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L528-L545
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L790-L819
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L874-L930
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L854-L865
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L50-L56
evidence: "C"
related: [prefix-caching, kv-cache-layerwise-offload, kv-cache-cpu-offload, recompute-cpu-offload, paged-attention]
contradicts: []
updated: "2026-09-06"
---

## 是什么

单卡的 [prefix caching](prefix-caching.md) 只在本实例的 HBM 里找已算过的前缀：请求一结束、块一被驱逐，那段 KV 就没了；换一台实例更是从零开始。KV Pool 把 KV cache 再往外挪一层，存进一个跨实例共享的存储池（后端可选 `mooncake`、`memcache`、`yuanrong`），于是同一段系统提示词、同一份长文档，第二次来的请求——哪怕落在别的实例上——可以直接把 KV 拉回 HBM，而不是重算 prefill。

在 vLLM-Ascend 里它的实现是一个 KV connector：`AscendStoreConnector`（旧名 `MooncakeConnectorStoreV1` 指向同一个类，见 [来源](../raw/kv-pool.md) `__init__.py#L39-L49`）。它不做 PD 分离的点对点 KV 传输——PD 分离场景下文档明确让 `MooncakeConnectorV1` 负责 kv_transfer，`AscendStoreConnector` 只当「prefix-cache 节点」，两者用 `MultiConnector` 并联（`kv_pool.md#L175-L179`）。

## 形状与数值

**池里存的一个对象 = 一个 block 的 KV。** worker 在 `register_kv_caches` 收尾时算出 `block_len = block_size × num_kv_head_per_rank × head_dim × elem_size`，并把 `page_size_bytes = sum(block_len)`（K 张量 + V 张量）作为一页的字节数（`pool_worker.py#L790-L819`）。以 Qwen3-0.6B（n_kv=8，d_h=128，28 层，bf16）TP=1、block_size=128 推算：单层单块 K 是 128×8×128×2 B = 256 KiB，K+V 一层 512 KiB；整模型每 token 的 KV 是 28×2×8×128×2 B = 112 KiB，32K 上下文一条请求约 3.5 GiB——这是「为什么值得建一个池、而不是每次重算」的量级依据（此段数字为按公式推算，非实测）。

**配置项**（默认值来自 `kv_pool.md#L11-L43`，代码侧落实见 `pool_scheduler.py#L90-L102` 与 `#L161-L172`）：

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `backend` | `mooncake` | 存储后端，可选 `mooncake` / `memcache` / `yuanrong`；未知值直接 `ValueError` |
| `lookup_rpc_port` | 无默认，必填 | 调度进程 ↔ worker 进程查命中的 RPC 端口，**每个实例必须唯一** |
| `load_async` | `false` | 异步加载；只在非 layerwise 时生效（`pool_scheduler.py#L545` 返回 `self.load_async and not self.use_layerwise`） |
| `consumer_is_to_put` | `false` | Decode 节点是否往池里写 |
| `consumer_is_to_load` | `false` | Decode 节点是否从池里读 |
| `use_layerwise` | `false` | 逐层存取，仅 Prefill 节点、且仅 `memcache` 后端（代码里 `use_gva_layerwise = use_layerwise and backend == "memcache"`） |
| `prefill_pp_size` / `prefill_pp_layer_partition` | 无 | Prefill 侧开 PP 时必填，供 Decode 回写做层切分适配 |
| `kv_load_failure_policy` | `fail`（vLLM 顶层字段） | `recompute` = 回退到最后一段有效前缀重算；混合注意力模型尚不支持 |

另有环境变量 `PYTHONHASHSEED=0`，所有节点必须一致，否则各实例算出的 block hash 对不上、池里的 key 互相认不出。

**lookup 的报文**（`ascend_store_connector.py#L291-L334`）：调度侧发四段——`token_len`（4 字节大端）、`kv_group_ids`、`hbm_hit_tokens`、若干 block hash 字符串；worker 回一个 4 字节整数，就是池里命中的 token 数。

**LoadSpec**（`pool_scheduler.py#L528-L545`）记四个数：`vllm_cached_tokens`（HBM 内已命中）、`kvpool_cached_tokens`（池内命中，含前者）、`can_load`、`kvpool_store_skip_tokens`。两者之差就是这次真正要从池里搬的 token 数。

**后端接口**只有三元组（`backend/base.py#L50-L56`）：

```python
def put(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]])
def get(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]])
```

没有 tensor 参数——传的是 HBM 地址与长度。

## 在哪一步出现

课程第 11 章（KV 的多级存放）。请求路径上它挂在 vLLM 的 KV connector 钩子上，一个 connector 对象在调度进程里造 `KVPoolScheduler`、在 worker 进程里造 `KVPoolWorker`，非 layerwise 时 rank 0 还会额外起一个 `LookupKeyServer` 线程（`ascend_store_connector.py#L85-L116`）：

0. **启动期**：`register_kv_caches` → `m_store.register_buffer(ptrs, lengths)`，把 HBM 里 KV cache 张量整段基址注册给后端，并起后台传输线程（`pool_worker.py#L790-L819`）。
1. **调度：查命中**。`get_num_new_matched_tokens`（`pool_scheduler.py#L456-L496`）先按角色短路——`kv_consumer` 且没开 `consumer_is_to_load` 直接返回 0；否则把 vLLM 本地已命中的 `num_computed_tokens` 作为 `hbm_hit_tokens` 一起发给 `LookupKeyClient.lookup`，由 worker 侧的 `LookupKeyServer` 回命中 token 数。
2. **调度：定加载计划**。命中数写进 `LoadSpec`，返回 `(need_to_allocate, 是否异步)`；`update_state_after_alloc` 拿到实际分配的 block 后把 `can_load` 置真。
3. **worker：池 → HBM**。`start_load_kv`（`ascend_store_connector.py#L204-L252` 转发到 `pool_worker.py#L874-L930`）按 block hash 生成 key、按 block_id 算出 HBM 目标地址与长度，跳过前面已在 HBM 的部分，把 key/addr/size 三个列表按 `tp_rank` 做一次循环移位（错开各 rank 的访问顺序），再调 `m_store.get` 直接写进 HBM；失败的块记进 `_invalid_block_ids`，交给 `kv_load_failure_policy` 处理。
4. **worker：HBM → 池**。`wait_for_save` 在 `kv_consumer` 且未开 `consumer_is_to_put` 时直接返回，否则把请求丢给后台发送线程；线程里先 `current_event.synchronize()` 等 attention 把 KV 写完，再 `m_store.put`（`kv_transfer.py#L854-L865`）。layerwise 模式下换成逐层的 `save_kv_layer` / `wait_for_layer_load`。

## 常见误解

- **「KV Pool 就是 PD 分离的 KV 传输通道」**——不是。PD 分离里搬 prefill KV 到 decode 的是 `MooncakeConnectorV1`，KV Pool 在同一份配置里以并联 connector 的身份只当跨实例的前缀缓存（`kv_pool.md#L175-L179`）。
- **「开了池，prefill 和 decode 两侧都会自动写池、读池」**——默认只有 Prefill 侧写。Decode 侧读、写分别要显式打开 `consumer_is_to_load`、`consumer_is_to_put`，两个默认都是 `false`（`kv_pool.md#L299-L314`、`pool_scheduler.py#L90-L102`）。
- **「`use_layerwise` 随时可开」**——它只在 Prefill 节点、且后端是 `memcache` 时才真正走逐层通路，mooncake 后端下 `use_gva_layerwise` 恒为假；而且开了 layerwise 就没有异步加载。
- **「KV 要先拷到 host 内存再进池」**——后端拿到的是 HBM 地址和长度，`get`/`put` 直接对已注册的 HBM 区域读写，没有中间张量拷贝（`backend/base.py#L50-L56`、`pool_worker.py#L790-L819`）。
