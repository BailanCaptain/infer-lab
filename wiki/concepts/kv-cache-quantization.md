---
id: kv-cache-quantization
title: KV Cache Quantization
type: feature
summary: 把写进 KV cache 的 K/V 从 bf16 降到 int8（A5 上为 fp8_e4m3fn），显存减半；scale 来自 ModelSlim checkpoint 里的 kv_cache_scale，attention 算子按 antiquant scale 在核内反量化。
aliases: [KV 缓存量化, C8 KV cache, INT8 KV cache, FAKQuant]
chapters: ["11", "17"]
sources:
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/quantization.md#L122-L124
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/quant_type.py#L26-L37
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/configs/modelslim_config.py#L658-L670
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/configs/modelslim_config.py#L799-L809
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/configs/modelslim_config.py#L905-L914
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/configs/modelslim_config.py#L1097-L1115
  - vllm-ascend@28bf3a2e:vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L108-L145
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1793-L1800
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1898-L1931
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1933-L1979
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1981-L2002
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L2004-L2040
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4684-L4698
  - vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L689-L721
  - vllm-ascend@28bf3a2e:vllm_ascend/models/minimax_m3/msa_m3.py#L112-L120
  - vllm-ascend@28bf3a2e:vllm_ascend/models/layer/attention/layer.py#L177-L183
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_v1.py#L514-L522
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_v1.py#L1150-L1156
evidence: "C"
related: [kv-cache-layerwise-offload, kv-cache-sparse-offload, kv-cache-spec]
contradicts: []
updated: "2026-09-07"
---

## 是什么

长上下文推理里，显存主要不是被权重吃掉的，而是被 KV cache 吃掉的：每多一个 token，每层都要多存一份 K 和一份 V。KV Cache Quantization 就是把这份 cache 的元素类型从 bf16 换成 int8（Ascend A5 上换成 `float8_e4m3fn`），字节数直接对半，代价是读回来时要乘一个 scale 还原。

vllm-ascend 里这不是一个开关，而是三条实现完全不同的路径：

- **C8**：dense GQA 模型（源码注释举例 Qwen3）的静态 per-channel int8 KV，由 `AscendC8AttentionBackendImpl` 承接（[raw](../raw/kv-cache-quantization.md)，`vllm_ascend/attention/attention_v1.py#L1793-L1800`）。
- **FAKQuant**：MLA 模型（DeepSeek 系）的 per-head 量化，为了精度**只量化 K cache**，V 保持原 dtype（`modelslim_config.py#L905-L914`）。
- **sparse SFA / LI C8**：稀疏注意力的主 cache 与 indexer cache 量化，是运行时 per-token **动态**量化（`sfa_v1.py#L1150-L1156`），scale 跟着 cache 一起存。

前两条由 checkpoint 决定，第三条由 `additional_config` 决定。

## 形状与数值

**开关取值。** `_add_kvcache_quant_metadata` 从 ModelSlim 的量化描述里读三个字段（`modelslim_config.py#L1097-L1115`）：

| 字段 | 触发条件 | 参与层的判定 |
| --- | --- | --- |
| `kv_cache_type` | `== "C8"` → `enable_c8_quant` | 描述里出现 `.<层号>.k_proj.kv_cache_scale` |
| `fa_quant_type` | 非空 → `enable_fa_quant` | 出现 `.<层号>.fa_k.scale` |
| `indexer_quant_type` | 非空 → `enable_indexer_quant` | 出现 `.<层号>.indexer.quant_type` |

**`kv_cache_dtype` 的取值。** 这是 vLLM 的 `--kv-cache-dtype`，字符串存进 `cache_config.cache_dtype`，再由 `kv_cache_dtype_str_to_dtype` 转成 torch dtype（`models/layer/attention/layer.py#L177-L183`）。仓库里唯一显式声明白名单的后端是 MiniMax-M3 indexer：`auto`、`bfloat16`、`fp8`、`fp8_e4m3`、`fp8_e5m2`（`msa_m3.py#L112-L120`）。注意两点：deepseek_v4 的 DSA 层在 A5 上会把它**硬改写**成 `float8_e4m3fn`；而上面三条量化路径都不看这个参数（推断：GQA/MLA 主干后端未声明 `supported_kv_cache_dtypes`，未在仓库中找到对该参数的校验）。

**C8 的张量形状**（按 Qwen3-0.6B 维度：28 层，n_kv=8，d_h=128，H=1024，n_q=16）：

- KV cache：`(num_blocks, block_size, 8, 128)`，dtype 由 bf16 换成 int8。同一块 raw buffer 只是换了 `.view(dtype)`，不是另开缓存（`model_runner_v1.py#L4684-L4698`）。
- 每 token 每层 K+V：bf16 是 `2 × 8 × 128 × 2 B = 4 KiB`，int8 是 `2 KiB`；28 层合计 `112 KiB → 56 KiB` 每 token。
- scale / offset：`create_weights` 先按 `torch.ones(1)` / `torch.zeros(1)` 建出 `k_cache_scale`、`k_cache_offset`、`v_cache_scale`、`v_cache_offset`，dtype 取 `torch.get_default_dtype()`；实际形状由 checkpoint 决定，loader 形状不符时直接替换 `param.data`（`kv_c8.py#L108-L145`）。
- 首次 forward 时 `_prepare_c8_scales` 把 scale 按 TP rank 切好并 reshape 成 `(1, n_kv, d_h)` = `(1, 8, 128)`，再 view 出算子要的 BNSD 版 `(8, 1, 128)`，同时预算 `1.0 / scale`；结果挂在 layer 上、用 `_c8_scales_prepared` 标记只做一次（`attention_v1.py#L1898-L1931`）。
- 量化公式：`clamp(round(x * (1/scale) + offset), -128, 127).to(int8)`，只对前 `num_actual_tokens` 个 token 做（`attention_v1.py#L1981-L2002`）。
- 硬约束：`block_size % 32 == 0`，因为 int8 cache 走 NZ 布局、最后一维固定 32（`attention_v1.py#L2004-L2040`）。

**FAKQuant 的 dtype 规则**（`modelslim_config.py#L905-L914`）：A5 上 `float8_e4m3fn`，其余 `int8`；`model_config.use_mla` 为真时返回 `(quant_dtype, ori_dtype)`，即 V 不量化。

**稀疏路径**（`sfa_v1.py#L514-L522`）：A5 上 K cache `float8_e4m3fn` + scale cache `float32`，其余 `int8` + `float16`；scale 由 `npu_dynamic_quant` 逐 token 算出，形状 `[b*s, 1]`。

## 在哪一步出现

对应课程第 11 章（KV cache 与显存）与第 17 章（量化）。请求路径上的位置：

1. **启动 / 建图**：`AscendModelSlimConfig.get_quant_method` 在 attention 层这一支上分发——命中 `is_c8_quant_layer` 就返回 `AscendKVCacheMethod(AscendC8KVCacheAttentionMethod(...))`，命中 fa/indexer 则走通用 scheme（`modelslim_config.py#L799-L809`）。
2. **建权重**：`AscendC8KVCacheAttentionMethod.create_weights` 把 `layer.kv_cache_torch_dtype` 设成 `torch.int8`，并做一次 class surgery：`layer.impl.__class__ = AscendC8AttentionBackendImpl`，让这一层此后走 C8 forward（`kv_c8.py#L108-L145`）。
3. **加载权重**：`get_cache_scale_mapper` 把 checkpoint 里的 `.k_proj.kv_cache_scale` / `.kv_cache_offset`（v 同理）改名映射到 `.attn.k_cache_scale` 等参数上——这就是 int8 KV 的 scale 来源（`modelslim_config.py#L658-L670`）。`process_weights_after_loading` 再把它们 flatten。
4. **分配 KV cache**：`model_runner_v1` 按量化后的 dtype `view` raw tensor（`#L4684-L4698`）。
5. **每步 forward**：`AscendC8AttentionBackendImpl.forward` → `_prepare_c8_scales`（首次）→ `_quantize_kv_to_int8` → `reshape_and_cache`。
   - Decode：`_forward_c8_decode` 把 int8 paged cache 与 `key_antiquant_scale` / `value_antiquant_scale` 一起交给 `torch_npu.npu_fused_infer_attention_score`（`antiquant_mode=0`，BNSD 布局），**反量化发生在算子内部，不落回显存**（`attention_v1.py#L2004-L2040`）。
   - 续跑的 chunked prefill：算子没有对应快路径，`_dequant_paged_kv_to_dense` 先按 block table gather，再做 NZ→ND permute，最后乘 scale 还原成 bf16 稠密张量再算（`attention_v1.py#L1933-L1979`）。

**与其它特性的互斥**（`ascend_config.py#L689-L721`）：`enable_sparse_sfa_c8` 与 [sparse KV offload](kv-cache-sparse-offload.md) 冲突（主 cache 不能既量化又下沉），`enable_sparse_li_c8` 则可以共存；GQA 模型上 C8 与 MooncakeConnector 直接报错——P 节点是 bf16、D 节点是 int8，裸传会把 bf16 字节按 int8 解释，必须换成会在传输前量化的 [MooncakeLayerwiseConnector](kv-cache-layerwise-offload.md)。

## 常见误解

- **不是 `--kv-cache-dtype int8` 打开的**：C8 / FAKQuant 由 ModelSlim checkpoint 里的 `kv_cache_type` / `fa_quant_type` 字段触发，运行时只需 `--quantization ascend`（`quantization.md#L122-L124`、`modelslim_config.py#L1097-L1115`）；`kv_cache_dtype` 是另一条独立的、面向 fp8 的通路。
- **不是"KV 量化和权重量化二选一"**：两者是同一份量化描述里的两条正交轴——`QuantType` 枚举只描述 W/A 组合（W8A8、W4A8、W8A8FP……）里没有任何 KV 项（`quant_type.py#L26-L37`），而 KV 由 attention 层单独的分支处理（`modelslim_config.py#L799-L809`）。一个 W8A8 权重的模型可以完全不开 KV 量化，反之亦然。
- **int8 KV 不等于全程 int8 算注意力**：prefill 阶段新算出的 K/V 是拿浮点版本直接参与计算的，量化只发生在写 cache 这一步；而且量化时加了 offset、反量化时只乘 scale 不减 offset（源码注释标为 symmetric，`attention_v1.py#L1933-L1979`），所以该路径实际依赖 checkpoint 提供的 offset 为 0。
