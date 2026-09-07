---
id: recompute-cpu-offload
title: Recompute CPU Offload
type: feature
summary: PD 分离 D 节点被抢占的请求，把已算好的 KV 块从 HBM 拷到 CPU 内存暂存，重新排到时再拷回，避免退回 P 节点重跑 prefill。
aliases: [重算 CPU 卸载, RecomputeCPUOffloadConnector]
chapters: ["11", "12"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95
  - vllm-ascend@28bf3a2e:vllm_ascend/platform.py#L966-L996
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L39-L70
  - vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L415-L467
  - vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L222-L239
  - vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L1054-L1073
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L148-L172
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L174-L187
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L195-L216
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L308-L318
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L534-L570
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/metadata.py#L35-L52
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L2088-L2093
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L104-L122
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L165
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L227-L253
evidence: "C"
related: [kv-cache-cpu-offload, prefix-caching, block-table, kv-pool, paged-attention, kv-cache-spec]
contradicts: []
updated: "2026-09-07"
---

## 是什么

在 PD 分离部署里，Decode 节点的 `max_num_batched_tokens` 通常只按「每请求一个新 token（外加 MTP 的投机 token）」来配，一步只有几千 token 的预算。这种配置跑 decode 很划算，但一旦 HBM 的 KV 块耗尽、调度器被迫抢占一个正在 decode 的请求，那个请求已经算好的几千甚至上万 token 的 KV 就全丢了 —— 它只能被终止、退回 P 节点重跑一遍 prefill。

Recompute CPU Offload 就是给这个丢弃动作加一条退路：`RecomputeScheduler` 在复用被抢占请求的 HBM 块之前，先问一句「这些 KV 能不能先挪到 CPU 内存」；能挪就挪，请求留在本地队列里等着重新排到，再把 KV 拷回 HBM 接着 decode。它由 `RecomputeCPUOffloadConnector` 实现，注册在 KV connector 工厂里（`vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95`），必须和 `RecomputeScheduler` 配套使用。

## 形状与数值

**CPU 侧张量**：worker 按 `pin_memory=True` 一次性分配锁页内存，形状与 HBM 侧 KV 张量除首维块数外完全一致（`worker.py#L104-L122`）。所以 Docker 里 `--shm-size` 给小了会在启动阶段就分配失败。

**块数换算**（`manager.py#L148-L172`）：

```
num_cpu_blocks = max(1, num_gpu_blocks * cpu_capacity_bytes // gpu_total_bytes)
```

即按 HBM 单块字节数等比缩放，CPU 侧直接复用 HBM 的 `kv_cache_groups` 配置。

以 Qwen3-0.6B（28 层，n_kv=8，d_h=128，bf16）、`block_size=128` 为例，一个 KV 块的字节数是（推导，非实测）：

```
128 tokens × 8 heads × 128 dim × 2 (K 和 V) × 2 bytes × 28 层 = 14,680,064 B ≈ 14 MiB
```

给每卡 16 GiB（`cpu_bytes_to_use_per_rank=17179869184`）大约能放 1170 块，约 15 万 token —— 够暂存几十个被抢占的中等长度请求。

**配置项**（`recompute_cpu_offload_connector.py#L39-L70`），全部写在 `kv_transfer_config.kv_connector_extra_config` 里：

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `cpu_bytes_to_use` | `8 * 1024**3`（8 GiB） | 整个实例的 CPU 预算，代码里除以 `world_size` 得到每 rank 预算 |
| `cpu_bytes_to_use_per_rank` | 无 | 每 rank/卡预算；一旦出现就直接覆盖上一项（不一致时打 warning） |
| `enable_offload_prefix_caching` | `False` | 打开后同 hash 的整块在 CPU 侧共享 |

另需在 `additional_config` 里打开 `scheduler_config.recompute_scheduler_enable`（默认关闭），否则调度器根本不是 `RecomputeScheduler`。启动期校验在 `platform.py#L966-L996`：`kv_role="kv_producer"` 时静默改回 `False`，PD 混合（无 `kv_transfer_config` 或 `kv_role="kv_both"`）直接 `raise ValueError`，只有 `kv_role="kv_consumer"` 才会把 `scheduler_cls` 换成 `RecomputeScheduler`。

## 在哪一步出现

对应课程第 11、12 章（KV cache 管理与分布式 KV 传输）。请求路径上它只在**抢占**和**恢复**两个瞬间起作用，正常 decode 步完全不经过它。

**换出（D2H）**：

1. `RecomputeScheduler.schedule()` 里 `allocate_slots()` 返回 `None` → 从 `running` 队尾（或 PRIORITY 策略下的最低优先级请求）挑出牺牲者（`recompute_scheduler.py#L415-L467`）。
2. 调 `update_state_before_preempt(req, block_ids, num_computed_tokens)`。管理侧 `_create_preempt_state()` 逐组统计需要多少 CPU 块，够就从 `cpu_block_pool` 领块、记下 HBM→CPU 的块映射，返回 `True`；不够就打 warning 返回 `False`（`manager.py#L308-L318`）。
3. 返回 `True` → 走 `_preempt_request()`，请求进 PREEMPTED 状态留在本地；返回 `False` → 走 `_finish_recomputed_request()`（`recompute_scheduler.py#L222-L239`），请求被 `FINISHED_ABORTED` 终止，前端收到 `stop_reason="recomputed"`（`recompute_scheduler.py#L1054-L1073`）。
4. 真正的拷贝在 model runner 里，`handle_preemptions()` 必须早于 `_update_states()`（`model_runner_v1.py#L2088-L2093`）—— 因为同一步里这些物理块可能立刻被分给别的请求。worker 侧 `sync=True` 阻塞等 D2H 完成（`worker.py#L134-L165`）。
5. store event 要等 `world_size` 个 worker 全部上报完成，`state.ready` 才置 `True`（`manager.py#L534-L570`、`metadata.py#L35-L52`）。

**换回（H2D）**：

6. 请求重新排到时，调度器走的是普通的 connector 外部命中路径：`get_num_new_matched_tokens()` 返回可恢复的 token 数并置 `load_kv_async=True`（`manager.py#L195-L216`）。此时若 `ready` 还是 `False`，返回 `None`，本步跳过该请求。
7. `allocate_slots()` 分到新 HBM 块后，`update_state_after_alloc()` 构造 CPU→HBM 的反向映射。
8. forward 之前 `start_load_kv()` 提交 H2D，同样是同步等待（`worker.py#L134-L165`）；`get_finished()` 把完成的请求报回调度器，随后释放 CPU 块。

搬运本身是逐块逐层的 `torch.Tensor.copy_`（`worker.py#L227-L253`），代码里带着 TODO 说明还没换成专用 NPU 拷贝算子。

## 常见误解

- **不是 [KV Cache CPU Offload](kv-cache-cpu-offload.md) 的另一种叫法。** 后者卸载的是不活跃的 prefix cache 块，服务于跨请求复用；这里卸载的是被抢占请求自己的 KV，服务于单个请求的续跑，块在请求恢复后就释放。
- **不是「不再重算」，而是「不再退回 P 节点重算」。** 关掉这个 connector（或 CPU 容量不足）时，D 节点的抢占等于把请求 abort 掉重来一遍 prefill；开着它才把重算省下来。
- **不能在 PD 混合部署里打开。** `recompute_scheduler_enable` 在 `kv_role="kv_both"` 或没有 `kv_transfer_config` 时会直接让启动失败，不是「打开了但不生效」。
- **`cpu_bytes_to_use` 不是每卡预算。** 它会被 `world_size` 除；DP2TP8 下配 16 GiB，每卡只剩约 8 GiB。想按卡控制就用 `cpu_bytes_to_use_per_rank`。
- **`enable_offload_prefix_caching` 默认是关的。** 管理类构造函数的形参默认写的是 `True`，但 connector 从配置里读的默认值是 `False`，实际生效的是后者。
