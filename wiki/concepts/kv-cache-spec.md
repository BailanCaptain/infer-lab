---
id: kv-cache-spec
title: KV Cache Spec
type: feature
summary: 每个注意力层向引擎申报一张"规格单"（block_size、num_kv_heads、head_size、dtype），引擎据此算出每 block 字节数与总 block 数，再回头按规格单分配真实张量。
aliases: [KV Cache 规格, KVCacheSpec, 按层 KV 规格声明]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L983-L994
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L1009-L1020
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L374-L376
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4947-L4986
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5076-L5085
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3910-L3938
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3986-L4000
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4032-L4052
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4288-L4317
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4598-L4614
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4647-L4659
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4693-L4704
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L114-L121
  - vllm-ascend@28bf3a2e:vllm_ascend/core/kv_cache_interface.py#L50-L61
  - vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1171-L1179
  - vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1380-L1382
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L608-L619
evidence: "C"
related: [paged-attention, block-table, kv-cache-memory-profiling, prefix-caching, kv-cache-quantization, kv-cache-cpu-offload, kv-cache-layerwise-offload, kv-cache-sparse-offload, recompute-cpu-offload]
contradicts: []
updated: "2026-09-07"
---

## 是什么

引擎启动时要回答一个问题：这块卡上到底能放下多少 KV Cache？但引擎自己不知道模型每层长什么样——有的层是 MHA，有的是 MLA，有的干脆不需要 KV（encoder-only、跨层共享）。KV Cache Spec 就是解决这个的：**每个注意力层自己申报一张规格单**，说明它一个 block 需要多少字节、按什么形状排布。

流程是严格的两段式，中间隔着一次显存探测：

1. **声明**：`NPUModelRunner.get_kv_cache_spec()` 遍历所有注意力层，产出 `dict[layer_name, KVCacheSpec]`（`model_runner_v1.py#L4947-L4986`）；`NPUWorker.get_kv_cache_spec()` 只是往上转发（`worker.py#L983-L994`）。此时**一个字节都还没分配**。
2. **分配**：引擎拿规格单加上探测到的可用显存，算出 `num_blocks`，打包成 `KVCacheConfig` 发回 Worker；`initialize_from_config` → `initialize_kv_cache` → `initialize_kv_cache_tensors` 才真正 `torch.zeros` 出显存（`worker.py#L1009-L1020`）。

中间那次显存探测见 [KV Cache 显存 profiling](kv-cache-memory-profiling.md)。

## 形状与数值

### 规格单里有什么

普通 attention 层的 spec 由四个字段决定字节数：`block_size`、`num_kv_heads`、`head_size`、`dtype`。其中 `block_size` 直接取自 `cache_config.block_size`（`model_runner_v1.py#L374-L376`），Ascend 上默认值是 **128**（`utils.py#L1171-L1179`，`block_size is None` 时置 128）。

### 每 token 每层的 KV 字节

仓库里唯一显式写出这个量的是 sparse offload 路径（`sparse_kv_offload_manager.py#L608-L619`）：

```
token_size_bytes_k = num_kv_heads × head_size × dtype.itemsize
token_size_bytes_v = num_kv_heads × head_size_v × dtype.itemsize
```

K 和 V 分开算。对 MHA/GQA 两者相等，所以：

> **每 token 每层 KV 字节 = 2 × num_kv_heads × head_size × dtype 字节数**

用 **Qwen3-0.6B**（n_kv = 8，d_h = 128，28 层，bf16 每元素 2 字节）算一遍：

| 量 | 计算 | 结果 |
|---|---|---|
| 每 token 每层 K | 8 × 128 × 2 | 2048 B = 2 KiB |
| 每 token 每层 V | 8 × 128 × 2 | 2048 B = 2 KiB |
| 每 token 每层 KV | 2048 + 2048 | **4096 B = 4 KiB** |
| 每 token 全 28 层 | 4096 × 28 | **114688 B = 112 KiB** |

注意分母里没有 `n_q = 16`。Qwen3-0.6B 是 GQA，16 个 query head 共享 8 组 KV head，KV Cache 只按 **8** 算，这正是 GQA 省显存的地方——若按 MHA（n_kv = 16）则要 224 KiB/token，翻一倍。

### 每 block 的字节数（page_size_bytes）

`_reshape_kv_cache_tensors` 里有一条断言把 page 的定义钉死了（`model_runner_v1.py#L4598-L4614`）：

```python
sum_page_size_bytes = raw_k_tensor.numel() + raw_v_tensor.numel()
assert sum_page_size_bytes % current_kv_cache_spec.page_size_bytes == 0
num_blocks = sum_page_size_bytes // current_kv_cache_spec.page_size_bytes
```

`sum_page_size_bytes` 是 K 与 V 字节之和，除以 `page_size_bytes` 得到 block 数——所以 **一个 page 必须同时覆盖 K 与 V**，即

> **page_size_bytes = 2 × block_size × num_kv_heads × head_size × dtype 字节数**

（此式由上述断言与形状约束推导，非仓库内某行直接写出；Ascend 自己重写的 MLA 版本见 `kv_cache_interface.py#L50-L61`，形式同为 `storage_block_size × num_kv_heads × 每 head 字节`，只是 MLA 的 K/V 合并成一份。）

Qwen3-0.6B，block_size = 128：

| 量 | 计算 | 结果 |
|---|---|---|
| 每层每 block | 2 × 128 × 8 × 128 × 2 | **524288 B = 512 KiB** |
| 全 28 层每 block | 512 KiB × 28 | **14 MiB** |

自洽性检查：112 KiB/token × 128 token/block = 14336 KiB = 14 MiB ✓。

给个体感：14 MiB/block 意味着 1 GiB KV Cache 只够 `1024 / 14 ≈ 73` 个 block，约 9344 个 token。

### 实际张量形状

`AscendAttentionBackend.get_kv_cache_shape` 返回 5 维（`attention_v1.py#L114-L121`）：

```
(2, num_blocks, block_size, num_kv_heads, head_size)
```

首维的 2 就是 K 和 V。但**这个 5 维张量并不真实存在**——分配时 K 与 V 被拆成两个独立张量（`model_runner_v1.py#L4288-L4317`），reshape 时各自取 `kv_cache_shape[1:]`（`#L4647-L4659`），最后每层拿到的是一个二元组 `(k_cache, v_cache)`（`#L4693-L4704`）。

Qwen3-0.6B 每层实际是两个张量，各自：

```
k_cache: (num_blocks, 128, 8, 128)  bf16
v_cache: (num_blocks, 128, 8, 128)  bf16
```

拆开的理由写在注释里：PD 分离（prefill disaggregation）要求 KV 张量的第 0 维必须是 `num_blocks`，5 维那个首维是 2，不满足。切分比例由 `calc_split_factor` 给出（`utils.py#L1380-L1382`）：`[total/k_dim, total/v_dim]`，k_dim == v_dim == 128 时是 `[2.0, 2.0]`，即各占裸 buffer 的一半。

## 在哪一步出现

第 11 章。这是**引擎启动期**的事，不在请求路径上——请求到达之前 KV Cache 张量就已经躺在显存里了，运行时只是通过 [Block Table](block-table.md) 往里面写。

调用链（`vllm_ascend/worker/`）：

**声明阶段**
- `NPUWorker.get_kv_cache_spec` — `worker.py#L983-L994`，转发 + 为 sparse offload 留一份副本
- `NPUModelRunner.get_kv_cache_spec` — `model_runner_v1.py#L4947-L4986`，遍历 `get_layers_from_vllm_config(..., AttentionLayerBase)`，按层类型分派：
  - `kv_sharing_target_layer_name` 非空 → 记入 `shared_kv_cache_layers`，**不产 spec**（跨层共享，省一整层显存）
  - `Attention` → 层自己的 `get_kv_cache_spec()`，返回 None 就跳过（encoder-only）
  - `MLAAttention` → 改写成 `AscendMLAAttentionSpec`（num_kv_heads 恒为 1）
  - `MambaBase` → 收集后统一处理，并把 attention 层的 page 补齐到 mamba page 大小（`#L5076-L5085`）

**分配阶段**
- `NPUWorker.initialize_from_config` — `worker.py#L1009-L1020`，sleep mode 下套一层 `CaMemAllocator` 内存池
- `NPUModelRunner.initialize_kv_cache` — `model_runner_v1.py#L3910-L3938`，先定 attention backend / input batch，再要张量
- `initialize_kv_cache_tensors` — `#L3986-L4000`，两步：`_allocate_kv_cache_tensors`（按字节申请 int8 裸 buffer）→ `_reshape_kv_cache_tensors`（view 成目标 dtype 与形状）
- `_get_layer_kv_cache_specs` — `#L4032-L4052`，把 group 级 spec 摊回每一层，后续所有字节计算都基于它

一个容易忽略的细节：裸 buffer 一律以 `torch.int8` 申请，bf16/fp16 是在 reshape 阶段 `.view(dtype)` 出来的（`#L4693-L4704`）。这样分配层只需关心字节数，不需要关心 dtype。

## 常见误解

- **「KV Cache 是一个大张量」**——不是。它是 `dict[layer_name, (k_cache, v_cache)]`，每层两个独立张量；`get_kv_cache_shape` 返回的 5 维形状只是描述用的，首维 2 在分配时就被拆开了（`model_runner_v1.py#L4288-L4317`）。
- **「每 token 的 KV 大小按 query head 数算」**——按 **KV head 数**算。Qwen3-0.6B 有 16 个 query head 但只有 8 组 KV head，每 token 每层是 4 KiB 而非 8 KiB。
- **「spec 声明的 page_size_bytes 就是实际占用」**——混合模型里不一定。`#L5076-L5085` 会把 attention 层的 `page_size_padded` 顶到 mamba page 的大小，多出来的部分是填充，真实占用大于 spec 算出的字节数。
- **「所有注意力层都会出现在规格单里」**——不会。跨层 KV 共享的层、`get_kv_cache_spec()` 返回 None 的 encoder-only 层都不进字典，KV 管理逻辑当它们不存在。
