---
id: kv-cache-memory-profiling
title: KV Cache Memory Profiling
type: feature
summary: 启动时跑一次假的前向，量出权重、激活峰值和非 torch 显存，用 total_memory×gpu_memory_utilization 减掉它们，得到能分给 KV Cache 的字节数。
aliases: [KV Cache 显存探测, 显存 profiling, determine_available_memory]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L441-L454
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L500-L517
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L536-L563
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L565-L600
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L602-L630
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L778-L821
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3713-L3727
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3836-L3837
  - vllm-ascend@28bf3a2e:vllm_ascend/_310p/worker_310p.py#L113-L133
  - vllm-ascend@28bf3a2e:docs/source/tutorials/models/Dots3-Note.md#L400-L408
evidence: "C"
related: [paged-attention, block-table, kv-cache-spec, kv-pool, kv-cache-layerwise-offload, kv-cache-sparse-offload, prefix-caching, kv-cache-cpu-offload]
contradicts: []
updated: "2026-09-07"
---

## 是什么

KV Cache 要预分配成一大块连续显存（见 [PagedAttention](paged-attention.md)），可是「一大块」到底该多大？没人能提前算准：权重多大取决于量化方式，激活峰值取决于 `max_num_batched_tokens`，还有一堆不归 torch 管的显存（ACL context、HCCL 通信 buffer、驱动层）根本不出现在 `torch.npu.memory_allocated()` 里。

vLLM-Ascend 的做法是**先量后分**：`NPUWorker.determine_available_memory()` 在启动时用假输入跑一次满负载前向（`profile_run()`），把这次跑下来的显存占用拆成三类实测量，再从显存预算里减掉它们，剩下的全部给 KV Cache（[源码](../raw/kv-cache-memory-profiling.md)，`vllm_ascend/worker/worker.py#L536-L630`）。

预算本身由 `gpu_memory_utilization` 定义。这个参数在昇腾上的语义是**整卡 HBM 总量的比例**，不是「空闲显存的比例」：

```python
self.requested_memory = self.init_snapshot.total_memory * self.cache_config.gpu_memory_utilization
```

紧接着有一道硬检查：如果开机时的 `free_memory` 已经小于 `requested_memory`（比如同卡上还跑着另一个实例），直接 `raise ValueError`，而不是悄悄缩水（`worker.py#L441-L454`）。

## 形状与数值

预算与扣除项（`worker.py#L565-L600`）：

```text
requested_memory     = total_memory × gpu_memory_utilization
non_kv_cache_memory  = weights_memory          # load_model() 里 DeviceMemoryProfiler 实测
                     + torch_peak_increase     # profile_run 期间 torch 分配器的峰值增量
                     + non_torch_increase      # 同期非 torch 占用的增量
available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory
```

三项扣除的来源各不相同：

- `weights_memory` 来自 `model_runner.model_memory_usage`，是 `load_model()` 用 `DeviceMemoryProfiler` 实测的 `consumed_memory`，不是按参数量估的（`model_runner_v1.py#L3836-L3837`）。
- `torch_peak_increase` 取自 `torch.npu.memory_stats()["allocated_bytes.all.peak"]`，且**在 with 块内、graph capture 之前**取值，再手动覆盖 `memory_profiling` 退出时算的值——否则 graph pool 的分配会被误记成激活峰值，重复扣两遍。
- `non_torch_increase` 由 vLLM 的 `memory_profiling` 上下文用 `mem_get_info()` 与 torch reserved 之差算出。

**没有被扣除的**：NPU graph（ACL graph）显存。它在 `capture_model()` 里分配，发生在 `determine_available_memory()` 返回**之后**，所以只在 `compile_or_warm_up_model()` 里补记账，用于打印建议值，并额外留 150 MiB 冗余（`worker.py#L778-L821`）：

```text
non_kv_memory        = weights + peak_activation + non_torch + npugraph
suggested_to_requested = requested_memory  − non_kv_memory − 150 MiB
suggested_to_gpu_limit = init free_memory  − non_kv_memory − 150 MiB
```

拿 Qwen3-0.6B（28 层，n_kv=8，d_h=128，bf16）估一下这块预算能装多少 token（推导，非实测）：每 token 每层要存 K 与 V 各 `8 × 128 = 1024` 个元素，合 `2 × 1024 × 2 B = 4 KiB`；28 层就是 **112 KiB/token**。若卡上 `requested_memory` 减掉扣除项后剩 40 GiB，可容纳约 `40 × 1024 × 1024 / 112 ≈ 374k` 个 token 的 KV。真实块数还要按 [KV Cache Spec](kv-cache-spec.md) 的 `page_size_bytes` 向下取整成整块。

平台差异：310P 覆写了同名方法，结果**再整除 2**（`(requested − non_kv − empty_cache 释放量) // 2`），给算子 workspace 留量；RC 设备因主机与设备内存共享，改用 `psutil.virtual_memory()` 计算（`_310p/worker_310p.py#L113-L133`）。

## 在哪一步出现

课程第 11 章「显存预算」。请求路径上它属于**启动期**，一次性执行，在任何请求到达之前：

1. `NPUWorker._init_device()`（`worker.py#L441-L454`）— 拍下 `init_snapshot`，算出 `requested_memory`，做 free ≥ requested 的检查。
2. `NPUWorker.determine_available_memory()`（`worker.py#L536-L630`）— 主体。
   - 快路径：若用户显式给了 `--kv-cache-memory`，仍跑一次 `profile_run()` 把模型编译出来，但**跳过全部 profiling 计算**并直接返回该值，日志明确写着 "This does not respect the gpu_memory_utilization config"（`#L547-L563`）。
   - 慢路径：`memory_profiling(...)` 包住 `NPUModelRunner.profile_run()`（`model_runner_v1.py#L3713-L3727`，昇腾侧还会做 EPLB warmup、sparse offload 的 topk buffer 预分配、MC2 容量下的额外 dummy run），退出后算差值。
   - 一致性断言：`init_snapshot.free_memory > after_profile.free_memory`。若同容器内别的进程在 profiling 期间释放了显存，这条会失败并提示隔离容器（`#L591-L599`）。
   - 后处理：layerwise KV 复用会把预算乘上 `num_layers / num_buffer_assignments`（[Layerwise Offload](kv-cache-layerwise-offload.md)）；sparse KV offload 开启时，`_apply_kv_offload_decode_memory_constraints()` 用 DRAM 上限重新规划并**替换**返回值（`#L500-L517`，见 [Sparse Offload](kv-cache-sparse-offload.md)）。
3. 返回的字节数交给 vLLM 核心换算成块数，最终决定 [Block Table](block-table.md) 的规模与 [KV Pool](kv-pool.md) 的容量。
4. `compile_or_warm_up_model()`（`worker.py#L778-L821`）— capture graph，补记账，打印 `--kv-cache-memory=` 建议值。

## 常见误解

- **「`gpu_memory_utilization=0.9` 是说 KV Cache 占 90% 显存」**——不是。0.9 是给**整个实例**（权重 + 激活 + 非 torch + KV）的总预算上限，KV 只拿减完剩下的那部分；权重越大、`max_num_batched_tokens` 越大，剩给 KV 的越少。
- **「它按剩余空闲显存的比例分配」**——不是。乘的是 `total_memory`。同卡上已有别的进程时，free 会小于 requested 而直接报错，必须自己调小 util，见多实例场景（`worker.py#L443-L454`）。
- **「profiling 量出来的就是安全上限」**——不一定。ACL graph 显存不在 `determine_available_memory()` 的扣除项里，仓库实测记录过自动 profiling 分配过大、graph capture 阶段峰值超限导致 `Worker proc VllmWorker-* died unexpectedly` 的案例；规避手段是显式 `--kv-cache-memory-bytes`，或关掉 graph 显存估计（`docs/source/tutorials/models/Dots3-Note.md#L400-L408`）。
- **「显式给了 `--kv-cache-memory` 就不跑 profile 了」**——仍会跑 `profile_run()`（要靠它编译模型），只是不做那套减法。
