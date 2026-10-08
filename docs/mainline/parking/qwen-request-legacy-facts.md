# 停放：Qwen3.6-35B-A3B 旧算例的独有事实

这不是知识页，不进 wiki，也不参与 lint。它只存放原 `qwen-request-legacy` 页（已并入 `one-request`）里、别处没有的事实，供后面重写 `prefix-caching`、`kv-cache-spec`、`expert-parallel` 等深入页时取用。

- 来历：2026-09-27 另一位代理把 `qwen-request-legacy` 的独有事实追加到 `wiki/concepts/one-request.md` 文末；one-request 的写手精简改写成「旧算例的记录」一节；审查（`docs/mainline/review/pages/one-request-review.md` P2-1）与协调者要求移出本页，停放到这里。
- 适用范围：只属于 Qwen3.6-35B-A3B 双 NPU 那个旧算例。块大小、前缀缓存默认值、卡与芯片的计数都不能移植到 GLM 主线。
- 引用写法：每条事实后面直接写 `repo@commit:path#Lx-Ly` 或 URL，不用编号角标。取用时按目标页的 sources 重新编号。
- 仍在用 37 个 token 设定的页（审查时 grep 所得）：`wiki/concepts/rfork-identity.md:54`、`wiki/params/fuse-allreduce-rms.md:68`、`wiki/params/profiling-chunk-config.md`。

## 设定

旧算例：Qwen3.6-35B-A3B 跑在一张 Atlas A3 卡的两颗 NPU 上，提问 37 个 token、回答 200 个 token。

- Atlas A3 一张卡有两个 die，一台机器 8 张卡共 16 个芯片，vLLM 按芯片计数。来源：`vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3-30B-A3B.md#L96-L99`
- 注意力按 TP2 对半切，每层 256 个专家按编号分成 0–127 和 128–255 两份。
- 官方教程的 A2/A3 示例使用 W8A8 权重，并带 `--quantization ascend`、`--max-model-len 262144`、`--async-scheduling`、`--compilation-config` 等调优项；旧算例只取 `--tensor-parallel-size 2`、`--enable-expert-parallel`、`--enable-prefix-caching` 三项。来源：`vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L218`（`--async-scheduling` 在第 218 行，原引用 `#L200-L216` 没覆盖到，已放宽）
- `37 + 200 = 237` 不等于写进注意力状态的位置数：在无投机、无重算、最后一个输出立即结束请求的普通生成里，最后那个输出不会再进入前向。

## 模型形状

来源：`https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json`

- `num_hidden_layers: 40`；`layer_types` 中下标 3、7、…、39 共 10 层是 `full_attention`，其余 30 层是 `linear_attention`（`full_attention_interval: 4`）。
- `num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256`、`hidden_size: 2048`。
- `num_experts: 256`、`num_experts_per_tok: 8`、`moe_intermediate_size: 512`。
- 线性注意力：`linear_num_key_heads: 16`、`linear_num_value_heads: 32`、`linear_key_head_dim: 128`、`linear_value_head_dim: 128`、`linear_conv_kernel_dim: 4`、`mamba_ssm_dtype: "float32"`。
- 每颗 NPU 的 KV 头数按 `max(1, total_num_kv_heads // tensor_parallel_size)` 计算，TP 为 2、4、8 时都是 1；TP 大于 2 以后 KV 头是复制而不是再切。来源：`vllm@0fc695fc:vllm/config/model.py#L1289-L1295`
- 另有一条未被正文直接引用的来源：`vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L687-L707`

## 块大小由代码算出（素材去向：kv-cache-spec 或 attention-cost）

- 通用的 `refresh_block_size`（把块定成 128）对混合模型直接返回。来源：`vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1400`
- 块大小改由 `patch_mamba_config` 按状态页对齐计算：`attn_block_size = kernel_block_size × cdiv(ssm_block_page_size, kernel_block_size × attn_single_token_k_page_size)`，`kernel_block_size = 128`。来源：`vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L97`（另见同文件 `#L58-L70`）
- 代入这个模型：TP1 与 TP2 都得 2048，TP4 得 1024，TP8 得 512（推导）。
- `mamba_ssm_cache_dtype` 为 `auto` 时取 HF 配置的 `mamba_ssm_dtype`，即 FP32。来源：`vllm@0fc695fc:vllm/model_executor/models/config.py#L534-L560`
- 用户传的 `--block-size` 比算出来的小时会被静默改大，只留一条 info 日志；比它大则保留原值。来源：`vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L102-L107`
- 状态页与注意力页对不齐时直接断言失败。来源：同上 `#L94-L97`
- 块大小算法在 v0.26 是同一段代码：`vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L117`；main 在外面多包了一层稀疏索引模型的分支，普通混合模型仍走这条路：`vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L153`
- 「混合模型跳过通用块大小」三个版本都有：`vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1400`、`vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1240-L1268`、`vllm-ascend@baa023ad:vllm_ascend/utils.py#L1316-L1355`

## 显存账（TP2、一颗 NPU、BF16 权重；素材去向：kv-cache-spec）

```text
全注意力 KV    2 × 1 × 256 × 2 B = 1 KiB/token/层，10 层 10 KiB/token（TP1 时 20 KiB）
一个块         2048 × 10 KiB = 20 MiB；237 个 token 只写 2.31 MiB，短请求至少占住 20 MiB
线性注意力状态 conv_dim = 128 × 16 × 2 + 128 × 32 = 8192
               卷积状态 4096 × 3 × 2 B = 24 KiB，递推状态 (32 ÷ 2, 128, 128) × 4 B = 1 MiB
               30 层合计 30.7 MiB，与序列长短无关
补齐后每页     一整块注意力页 + 卷积页 = 2 MiB + 24 KiB，30 层合计 60.7 MiB，约 30 MiB 是空白
```

- 线性注意力状态的形状来自 `gated_delta_net_state_shape`：`vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py#L213-L234`
- 补齐规则：`vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L124`；上游估显存用补齐后的值：`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L616-L636`
- 讲状态本身用 30.7 MiB，估显存容量要用 60.7 MiB；每请求每颗 NPU 合计约 80.7 MiB，真正装数据的约 33 MiB。
- 补齐那条 info 日志报的是卷积页占补齐后页面的比例（这个例子约 1.2%），真正补出来的空白约占整页 49%，照日志估显存会差一倍。来源：同上补齐规则。

## 前缀缓存的默认值随版本变化（素材去向：prefix-caching 的「版本差异」）

- v0.23 维护分支默认关，上游把混合模型判为不支持前缀缓存：`vllm@0fc695fc:vllm/engine/arg_utils.py#L2374-L2409`、`vllm@0fc695fc:vllm/config/model.py#L1851-L1856`
- v0.26 分支也默认关，已判为支持，但对混合模型刻意保持手动打开：`vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2522`
- main 开发主线恢复「支持就默认开」，混合模型判为支持：`vllm@84030bbe:vllm/engine/arg_utils.py#L2773-L2813`、`vllm@84030bbe:vllm/config/model.py#L2135-L2139`
- 官方教程三个版本都在启动命令里显式打开了它：`vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L218`、`vllm-ascend@2ed6cbba:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L192-L205`、`vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L195-L208`；并提醒长上下文要留意显存：`vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L222-L228`
- A2/A3 上的支持状态：v0.23 支持（`vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150-L150`），v0.26 与 main 标为实验性（`vllm-ascend@2ed6cbba:…/supported_models.md#L133-L133`、`vllm-ascend@baa023ad:…/supported_models.md#L139-L139`）。同一份文档里 Atlas 300I DUO 那张表三个版本都标为支持，官方没有写降级原因。PD 分离在三个版本的支持矩阵里对这个模型都不支持。

## 其他数字（素材去向：expert-parallel）

- 进专家之前两颗 NPU 要把 token 对半分：37 是奇数，补一个空位凑成 38，每颗 19 个。来自 MC2 的 prepare：先补齐到 TP 的整数倍，再按 TP rank 沿 token 维切开。来源：`vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L249-L262`
- 专家权重约 60 GiB 是按未压缩权重算的上限，官方示例用的是压缩权重。

## 从 one-request 移除的 aliases

`历史算例`、`Qwen3.6-35B-A3B`、`37 token`、`237 个 token`。`qwen-request-legacy` 这个 id 仍作为 one-request 的 alias 保留。
