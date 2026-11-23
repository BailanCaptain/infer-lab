# 大模型并行教学图：权威来源索引

核验日期：2026-08-29（UTC）

源码固定基线：

- upstream vLLM：[`cacc429f62c3738c9c95093e9bd410e96103221a`](https://github.com/vllm-project/vllm/commit/cacc429f62c3738c9c95093e9bd410e96103221a)
- vLLM Ascend：[`28bf3a2e8e8db396ee5dcfa6812626eee2d394ab`](https://github.com/vllm-project/vllm-ascend/commit/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab)

图中标记规则：

- `[Sxx]`：官方文档、论文或固定源码直接支持的陈述。
- `[Dxx]`：由官方公式、shape 或 rank 规则直接推导，推导过程见 `CLAIM_LEDGER.md`。
- `[Axx]`：为把图画清楚而显式规定的教学假设，不冒充真实 checkpoint 或 benchmark。
- `[!]`：实验状态、版本漂移、未联测组合或 current runtime 明确拒绝。

## 来源表

| ID | 一手来源 | 本套图主要使用内容 |
|---|---|---|
| S01 | [Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism](https://arxiv.org/abs/1909.08053) | 经典 Transformer TP：Attention heads、MLP 矩阵切分与局部结果求和。 |
| S02 | [Megatron Core — tensor parallel layers](https://docs.nvidia.com/megatron-core/developer-guide/latest/apidocs/core/core.tensor_parallel.layers.html) | `ColumnParallelLinear`、`RowParallelLinear` 的 weight/output shape 与 gather/reduce 语义。 |
| S03 | [vLLM — Basic Model / tensor parallel implementation](https://docs.vllm.ai/en/latest/contributing/model/basic/) | vLLM QKV、row/column parallel 接口及 GQA/MQA KV-head 复制边界。 |
| S04 | [vLLM Ascend — Pipeline Parallelism](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/pipeline_parallel.html) | PP 定义、连续层分段、TP×PP rank 关系、activation 传递、bubble、`PP × PCP` 当前禁配。 |
| S05 | [vLLM — Data Parallel Deployment](https://docs.vllm.ai/en/latest/serving/data_parallel_deployment/) | 推理 DP 复制模型、独立 request batches / engine / KV cache、DP+TP 卡数、MoE forward alignment。 |
| S06 | [vLLM — Expert Parallel Deployment](https://docs.vllm.ai/en/latest/serving/expert_parallel_deployment/) | `EP_SIZE=TP×DP`、Attention 与 Expert 层的不同分组、All2All backend 边界。 |
| S07 | [Megatron Core — MoE Router](https://docs.nvidia.com/megatron-core/developer-guide/latest/apidocs/core/core.transformer.moe.router.html)；[MoE Token Dispatcher](https://docs.nvidia.com/megatron-core/developer-guide/0.15.0/apidocs/core/core.transformer.moe.token_dispatcher.html) | Top-k routing、token assignment、dispatch/combine、expert-TP 通信、router-weighted merge。 |
| S08 | [Korthikanti et al. — Reducing Activation Recomputation in Large Transformer Models](https://ar5iv.labs.arxiv.org/html/2205.05198) | 经典 Megatron SP、AG/RS 布局转换、训练 activation memory。 |
| S09 | [Megatron Core — Context Parallelism](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html) | SP 与 CP 的官方对比、CP 全层 sequence shard、KV 通信、TP×CP×PP×DP。 |
| S10 | [Ring Attention with Blockwise Transformers](https://arxiv.org/abs/2310.01889) | KV block ring P2P、通信与计算重叠、exact attention。 |
| S11 | [vLLM — Context Parallel Deployment](https://docs.vllm.ai/en/latest/serving/context_parallel_deployment/) | PCP / DCP 定义；Partial-Q+Full-KV 与 Partial-Q+Partial-KV 两种候选策略及 active-development 状态。 |
| S12 | [vLLM Ascend — Context Parallel 用户指南（用户指定正文）](https://docs.vllm.ai/projects/ascend/zh-cn/main/user_guide/feature_guide/context_parallel.html) | PCP / DCP 定义、CLI、world-size 差异、兼容矩阵、GQA/MLA DCP 约束、`B=I`。 |
| S13 | [vLLM Ascend — Context Parallel 设计文档](https://docs.vllm.ai/projects/ascend/zh-cn/main/developer_guide/Design_Documents/context_parallel.html) | DCP KV-cache interleave、Decode 本地 KV attention、partial output/LSE 通信；同时保留了与用户指南不同步的 PCP 状态说明。 |
| S14 | [vLLM `ParallelConfig` @ `cacc429f`](https://github.com/vllm-project/vllm/blob/cacc429f62c3738c9c95093e9bd410e96103221a/vllm/config/parallel.py) | `world_size=TP×PP×PCP`、跨 DP 再乘、DCP 不增 rank、PCP×DP 校验、PCP 存在时 DCP 合法 size。 |
| S15 | [vLLM `PCPManager` @ `cacc429f`](https://github.com/vllm-project/vllm/blob/cacc429f62c3738c9c95093e9bd410e96103221a/vllm/v1/worker/gpu/pcp_manager.py#L196-L230) | `2×PCP` DualChunkSwap、Decode rows replicated、hidden-state restore。 |
| S16 | [Ascend GQA backend @ `28bf3a2e`](https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab/vllm_ascend/attention/attention_v1.py#L85-L104)；[Ascend MLA backend](https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab/vllm_ascend/attention/mla_v1.py#L93-L121) | current Ascend MRV2 在 PCP 与 DCP 同开时抛 `NotImplementedError`。 |
| S17 | [Ascend `PCPManager` @ `28bf3a2e`](https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab/vllm_ascend/worker/v2/pcp_manager.py#L59-L70) | current HEAD 只允许 MLA、拒绝 PP / encoder-decoder / MM / LoRA / speculative decoding；用于披露 docs↔code 漂移。 |
| S18 | [SGLang `dp_attention.py`](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/layers/dp_attention.py)；[SGLang v0.4 DPA 说明](https://www.lmsys.org/blog/2024-12-04-sglang-v0-4/) | DPA 的 request-level Attention、Attention↔MoE layout conversion、RS/AG 实现边界。 |
| S19 | [知乎原文：大模型并行策略图解](https://zhuanlan.zhihu.com/p/2035106376138085860) | 视觉风格、章节顺序与术语参照；技术结论仍由上面的一手文档/论文/源码复核。 |
| S20 | [vLLM `parallel_state` API](https://docs.vllm.ai/en/latest/api/vllm/distributed/parallel_state/) | TP2×PP2 的 TP groups 与 PP lanes。 |
| S21 | [PyTorch — DDP Theory](https://docs.pytorch.org/tutorials/beginner/ddp_series_theory.html) | 训练 DDP backward / gradient synchronization，用于与推理 DP 对照。 |
| S22 | [vLLM `pcp.py` @ `cacc429f`](https://github.com/vllm-project/vllm/blob/cacc429f62c3738c9c95093e9bd410e96103221a/vllm/v1/attention/ops/pcp.py#L11-L45) | current Prefill cache-write K/V AllGather 与 Decode 本地写入分支。 |
| S23 | [Ascend `common_cp.py` @ `28bf3a2e`](https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab/vllm_ascend/attention/context_parallel/common_cp.py#L222-L233) | DCP partial output / LSE 的 softmax-correct 合并公式。 |
| S24 | [vLLM rank layout @ `cacc429f`](https://github.com/vllm-project/vllm/blob/cacc429f62c3738c9c95093e9bd410e96103221a/vllm/distributed/parallel_state.py#L1817-L1908) | `ExternalDP×DP×PP×PCP×TP` 轴顺序、DCP “spans PCP first, then TP”。 |

## 重要的版本治理结论

当前 `latest/main` 材料本身存在漂移：用户指南把 PCP 列为 MRV2 experimental、GQA/DSA 部分支持；设计文档仍写 PCP 不支持；固定 HEAD 的 Ascend PCPManager 又只允许 MLA。故本套图采取以下优先级：

1. 定义、公开 CLI、兼容矩阵：引用用户指定的 current-main 用户指南。
2. DCP KV 布局与 O/LSE 合并：引用设计文档和固定源码。
3. PCP 通用候选策略：引用 upstream guide，并明确写“开发中”。
4. 当前是否能启动：服从固定源码的配置校验和 `NotImplementedError`。
5. 生产部署：必须锁 release / commit、目标模型、硬件和启动命令，再做准确性与性能测试。
