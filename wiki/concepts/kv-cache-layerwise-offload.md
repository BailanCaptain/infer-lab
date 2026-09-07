---
id: kv-cache-layerwise-offload
title: Layerwise KV Offload
type: feature
summary: 把 KV cache 的存/取从「整个 forward 一次性搬运」拆成「每层算完就搬」，用后一层的注意力计算掩盖前一层的传输，并让多层共用少量 NPU buffer。
aliases: [逐层 KV 卸载, 逐层 KV 传输, Layerwise KV Pool, Layerwise Prefill Offload]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L18-L36
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L77-L88
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L224-L245
  - vllm-ascend@28bf3a2e:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L98-L146
  - vllm-ascend@28bf3a2e:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L192-L202
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L196
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L473-L521
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/mla_v1.py#L1356-L1362
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/mla_v1.py#L1898-L1907
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/mla_v1.py#L2016-L2020
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_v1.py#L1546-L1551
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/dsa_v1.py#L1250-L1261
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L27-L61
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L76-L91
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L227-L251
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L236-L247
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L463-L471
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1618-L1645
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1647-L1699
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1147-L1164
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1467-L1479
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1481-L1502
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1533-L1535
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L89-L102
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L114-L134
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L136-L178
evidence: "C"
related: [kv-cache-sparse-offload, kv-cache-quantization, kv-cache-spec, kv-cache-memory-profiling, kv-pool, kv-cache-cpu-offload]
contradicts: []
updated: "2026-09-07"
---

## 是什么

不开这个特性时，一个请求的 KV cache 是「整包」进出 KV pool 的：整个 forward 跑完才把全部层的 KV 存出去，或者在 forward 开始前把全部层的 KV 取回来。长 prompt 下这就是一段谁也掩盖不了的串行停顿（[raw](../raw/kv-cache-layerwise-offload.md)，`layerwise_kv_pool.md#L18-L36`）。

Layerwise KV Offload 把这个搬运拆到**层粒度**：第 *i* 层算完注意力就立刻把这一层的 KV 送去后端，第 *i+1* 层的计算与这次传输并行；反方向上，第 *i* 层注意力开始前只等第 *i* 层的 KV 到位，第 *i+1* 层的加载与第 *i* 层的计算重叠。搬运延迟被摊到整个 forward 里，而不是堆成一次阻塞。

它还带来第二个收益：既然任一时刻只有少数几层的 KV 需要真的躺在 NPU 上，多个逻辑层就可以轮流复用同一块物理 buffer，把 Prefill 侧的主 KV 显存占用压到「层数分之几」。这一半叫 Layerwise Prefill Offload，是 P/D 分离部署里 Prefill 节点省显存的主要手段。

开关是 `AscendStoreConnector` 的 `use_layerwise: true`（`ascend_store_connector.py#L76-L91`）。

## 形状与数值

**配置项与默认值**（代码为准，`layerwise_cache_layout.py#L114-L178`）：

| 配置项 | 代码默认值 | 含义 |
| :--- | :--- | :--- |
| `use_layerwise` | `false` | 总开关，要求 `backend: "memcache"` |
| `backend` | `"mooncake"` | 只有 `"memcache"` 会走 GVA layerwise 路径（`layerwise_cache_layout.py#L89-L102`） |
| `layerwise_num_shared_buffers` (B) | `num_layers`（即不复用） | 可复用物理 buffer 个数，文档建议 2–4 |
| `layerwise_independent_layers` (I) | `[0]` | 独占 buffer 的层；`"all"` 关闭跨层复用 |
| `layerwise_prefetch_layers` | `min(B, 8)` | 预取深度（注意：文档写的是 `1`，见「常见误解」） |
| `layerwise_max_transfer_blocks` / `_bytes` | `0`（不限） | 单批传输上限 |
| `h2d_stagger_us` | `0` | TP rank 间 H2D 错峰的微秒数 |

**buffer 数量与显存占用**（设计文档给出的公式，`layerwise_and_sparse_kv_cache_offloading.md#L98-L146`）：

```text
N = 带 KV cache 的层数
I = 独立层数
R = N - I
B = layerwise_num_shared_buffers

物理 buffer 数 = I + min(B, R)
主 KV 的 NPU 占用比 ≈ 物理 buffer 数 / N
```

按官方 Prefill 配置样例 `B=3`、`layerwise_independent_layers: [0]`（`layerwise_and_sparse_kv_cache_offloading.md#L160-L196`）：`I=1`，物理 buffer = `1 + 3 = 4`。若 N=28（纯算术示例，Qwen3-0.6B 走 `attention_v1`，并不接入本特性，见下节），占用比 ≈ 4/28 ≈ 14%；N 越深省得越多。这个比例只算主 KV，不含 indexer 与其它固定分配。

**复用映射**：可复用层按 round-robin 分到 B 个槽位，于是层 `reused[k]` 与层 `reused[k-B]` 共用同一块 buffer，代码里存成 `prefetch_layer_map[reused[k]] = reused[k-B]`；`has_layer_reuse` 仅在可复用层数 > B 时为真（`layerwise_cache_layout.py#L136-L178`）。

**每层的同步原语**：开启 layerwise 后，worker 会按层数各开三组数组（`pool_worker.py#L463-L471`）——`layer_load_finished_events`（CPU `threading.Event`）、`layer_save_finished_events`（CPU `threading.Event`）、`sync_save_events`（NPU `torch.npu.Event`）。

## 在哪一步出现

对应课程第 11 章 KV cache 卸载/分级存储。请求路径上它落在 **Prefill 的每一层注意力前后**（decode 步的 KV 搬运是另一套，见 [kv-cache-sparse-offload](kv-cache-sparse-offload.md)）。

**调用链**。注意力后端通过 `vllm_ascend/attention/utils.py#L473-L521` 的三个薄封装打到 connector 上：

- `wait_for_kv_layer_from_connector(layer_name)` → `connector.wait_for_layer_load(layer_name)`
- `maybe_save_kv_layer_to_connector(layer_name, kv_cache)` → `connector.save_kv_layer(...)`
- `notify_kv_cache_written(layer_name)` → 可选的 `connector.on_kv_cache_written(...)`

在 `AscendStoreConnector` 里这两个方法在 `use_layerwise` 为假时直接 return；为真时转给 `KVPoolWorker`，而且整包版的 `wait_for_save()` 会被短路掉（`ascend_store_connector.py#L227-L251`）。注意 `layer_name` 只用于开关判断，真正的层号是 worker 内部的 `current_layer` 计数器，在每次 `save_kv_layer` 末尾自增（`pool_worker.py#L1647-L1699`）。

**一层内的顺序**，以 MLA 为例：`wait_for_kv_layer_from_connector` 在本层 preprocess 之前、且只在 `has_prefill` 时调用（`mla_v1.py#L1898-L1907`）；`record_attention_compute_start()` 紧贴在 `npu_fused_infer_attention_score` 之前（`mla_v1.py#L1356-L1362`）；`maybe_save_kv_layer_to_connector` 在 o_proj 之后（`mla_v1.py#L2016-L2020`）。SFA 把等待放在 indexer 预处理之后（`sfa_v1.py#L1546-L1551`），DSA 放在 `_prepare_caches_before_attention` 之前（`dsa_v1.py#L1250-L1261`）。

**重叠是怎么做到的 —— stream 与同步点**。这里没有第二条 NPU 计算流；重叠靠的是「计算主线程 + 两个后台传输线程（`KVCacheStoreLayerSendingThread` / `RecvingThread`）+ NPU event」：

1. **预取投递**（`pool_worker.py#L1618-L1645`）：第 0 层一次投 `num_prefetch_layers` 个加载任务，之后每层补投 1 个，让加载始终跑在计算前面。任务里带两个东西：`wait_for_save_layer`（要复用的那块 buffer 上一个占用层）和 `attention_start_gate`。
2. **attention gate**（`attention_fence.py#L27-L61`）：`wait_for_layer_load` 先 `reset_attention_compute_start_gate()` 建新门，注意力算子提交前 `record()` 在当前 stream 上打一个 NPU event，接收线程 `wait()` 里 `event.synchronize()`。这样传输是等 **compute stream 真的跑到 attention 边界**才开始，而不是等 Python 调用返回就开始——否则预取会和本层计算抢带宽（`kv_transfer.py#L1533-L1535`）。
3. **加载完成**：接收线程做完 H2D 后 set `layer_load_finished_events[i]`；计算线程在 `wait_for_layer_load` 里以 10 秒为周期轮询这个事件（`pool_worker.py#L1647-L1699`）。
4. **保存是异步的**：`save_kv_layer` 只做三件事——`sync_save_events[i].record()` 在 compute stream 上打点、把任务扔进发送线程队列、`current_layer += 1`，**不等**。发送线程在真正 `m_store.put()` 之前 `sync_save_events[i].synchronize()`，确保 attention 已把 KV 写进 buffer，写完再 set `layer_save_finished_events[i]`（`kv_transfer.py#L1147-L1164`）。唯一的同步点是最后一层：`save_kv_layer` 会阻塞等 `layer_save_finished_events[num_layers-1]`。
5. **buffer 复用门**（`kv_transfer.py#L1481-L1502`）：接收线程要往某块 buffer 里写之前，先等上一占用层的 `layer_save_finished_events`，再 `sync_save_events[...].synchronize()`。两道都要走——CPU 事件只说明 event 已被 record，不保证 NPU 侧的 D2H 已完成（非保存 rank 尤其如此）。
6. **H2D 错峰**（`kv_transfer.py#L1467-L1479`）：多 TP 时按 `(tp_rank + layer_id) % tp_size * h2d_stagger_us` 忙等自旋，错开各 rank 的 H2D 提交。

**与 P/D 分离联合部署时**，Prefill 用 `MultiConnector` 同时挂 `SfaRemoteD2HConnector` 和 `AscendStoreConnector`；buffer 释放门要等两条路径都完成——AscendStore 存进 Prefill host pool，且 Decode 侧远程读已 ack，否则会在 Decode 还在读的时候覆盖共享 buffer（`layerwise_and_sparse_kv_cache_offloading.md#L192-L202`；代码侧对应 `external_slot_release_waiter`）。

**适用的模型与注意力类型**。代码里接入了逐层 wait/save 钩子的后端是 `mla_v1`、`sfa_v1`、`dsa_v1`（以及 `context_parallel/dsa_cp.py`）；`attention_v1`（普通 GQA/MHA）没有这些调用，所以 Qwen3-0.6B 这类稠密注意力模型走不到本特性。联合部署官方验证过的模型是 GLM-5.1 / GLM-5.2 / DeepSeek-V3.2 这类稀疏注意力族，MLA 系的 DeepSeek-V2/V3 也支持（`layerwise_kv_pool.md#L224-L245`）。硬约束：`backend` 必须是 `memcache`；开启后要求 PIECEWISE cudagraph、实际部署用 `--enforce-eager`（`ascend_store_connector.py#L76-L91`）；hybrid KV cache 布局不支持；TP mismatch 与 layerwise 互斥，会直接 `ValueError`（`pool_worker.py#L236-L247`）。

## 常见误解

- **「`layerwise_prefetch_layers` 默认是 1」**——文档表格写的是 1，但代码里不传该项时取 `min(layerwise_num_shared_buffers, 8)`，而 `layerwise_num_shared_buffers` 不传时又等于层数，所以默认预取深度实际是 8（`layerwise_cache_layout.py#L114-L134` vs `layerwise_kv_pool.md#L77-L88`）。这条文档与代码不一致，配置时以代码为准。
- **「不填 `layerwise_num_shared_buffers` 也能省显存」**——不填时它等于层数，`has_layer_reuse` 为假，等于每层一块独立 buffer，只拿到传输重叠，拿不到显存收益（`layerwise_cache_layout.py#L136-L178`）。
- **「重叠靠的是一条独立的拷贝 stream」**——不是。计算侧仍在默认 stream 上，重叠来自后台 Python 传输线程；NPU event 只用来做「attention 已提交」和「KV 已写完」两个跨线程的时序保证（`attention_fence.py#L27-L61`、`kv_transfer.py#L1481-L1502`）。
- **「layerwise 支持的后端就是文档 Supported Models 那两个」**——该清单只列了 `mla_v1` / `sfa_v1`，但代码里 `dsa_v1` 和 `dsa_cp` 也已接入 wait/save 钩子（`dsa_v1.py#L1250-L1261`）；清单落后于代码。
