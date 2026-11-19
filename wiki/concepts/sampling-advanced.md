---
id: sampling-advanced
title: 高阶采样、惩罚项、Beam Search 与 Logprobs：vLLM V1 采样流水线与昇腾快慢路径
type: concept
origin: direct
summary: >-
  本页讲清 vLLM V1 Sampler 的 9 步严格顺序、Top-k / Top-p / min_p 与三类重复惩罚公式、四模式 Logprobs 与外置 Beam Search，以及 vllm-ascend v0.30.0 昇腾快慢路径分流与 MRV2 演进。
aliases:
  - 高阶采样
  - Beam Search
  - 束搜索
  - BeamSearchParams
  - min_p
  - min-p
  - presence_penalty
  - frequency_penalty
  - repetition_penalty
  - 重复惩罚
  - 频率惩罚
  - 存在惩罚
  - logprobs
  - logprobs_mode
  - logprob_token_ids
  - 对数概率
  - AscendSampler
  - AscendTopKTopPSampler
chapters:
  - '05'
order: 80
sources:
  - 'https://arxiv.org/abs/1904.09751'
  - 'https://arxiv.org/abs/2407.01082'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L21-L150'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L152-L300'
  - 'vllm@ced6857a:vllm/model_executor/layers/utils.py#L43-L82'
  - 'vllm@ced6857a:vllm/v1/sample/ops/penalties.py#L10-L56'
  - 'vllm@ced6857a:vllm/v1/sample/logits_processor/builtin.py#L23-L117'
  - 'vllm@ced6857a:vllm/entrypoints/generate/beam_search/offline.py#L55-L145'
  - 'vllm@ced6857a:vllm/entrypoints/generate/beam_search/utils.py#L137-L163'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/sampler.py#L18-L167'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/penalties.py#L13-L45'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L128-L192'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L122-L160'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/apply_top_k_top_p.py#L8-L38'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: sampling
    kind: builds-on
    note: 先掌握基础温度缩放、Softmax 与贪心解码概念，再深入高阶过滤、惩罚与昇腾快慢路径
  - to: lm-head
    kind: builds-on
    note: 采样器直接消费 lm_head 投影产出的全词表原始 logits 张量 [batch_size, vocab_size]
  - to: prefix-caching
    kind: builds-on
    note: V1 外置 Beam Search 每轮以 max_tokens=1 扩展候选束，极度依赖前缀缓存复用共同历史 KV
  - to: batch-invariance
    kind: variant-of
    note: 开启批不变模式 VLLM_BATCH_INVARIANT 时，昇腾 Top-k/Top-p 会退回上游确定性原生路径
contradicts: []
updated: '2026-11-19'
---

**高阶采样（Advanced Sampling）是指模型在 `lm_head` 产出全词表原始打分 `logits` 之后、正式抽取下一个 token 之前，按严格先后顺序施加的规则改分、重复惩罚、动态概率截断、束搜索（Beam Search）以及对数概率（Logprobs）采集机制。**

基础的[采样入门](sampling.md)已经讲清了单个温度参数和贪心解码怎样工作。但在真实线上推理中，只调温度往往管不住模型：低温度容易陷入复读机死循环，高温度又会在低概率词上胡言乱语；评测和生成式打分任务需要拿回精确的候选概率；而机器翻译或结构化摘要有时需要同时维护多条高概率候选路径。更重要的是，在昇腾 NPU 上，每多开一项采样特性都可能决定请求走 **~1 ms 异步快路径**还是掉进 **CPU-NPU 同步慢路径**。

## `Sampler.forward` 为什么严格区分「不可保序」与「可保序」？

vLLM V1 的 `Sampler.forward` 不是把各种开关随便堆在一起，而是先把输入转成 `FP32` 精度（避免 `BF16` / `FP16` 下指数与累加精度塌缩），再按**是否可能改变最大分项（`argmax`）**把所有处理器拆成两道闸门：

```wiki-diagram
file: sampling-adv-fig-pipeline
```

这个先后次序直接决定了贪心请求（`temperature < 1e-5`）的命运：

1. **不可保序阶段（贪心也会受影响）**：`allowed_token_ids` 白名单、`bad_words` 禁词、`min_tokens`（未达最短长度前屏蔽 EOS）、`logit_bias` 分数偏置，以及三类重复惩罚，都会改变谁是最高分，因此必须在做 `greedy_sample`（`argmax`）之前完成；
2. **整批贪心快退**：如果这一批所有请求都是贪心（`sampling_metadata.all_greedy`），算完 `argmax` 即可立刻返回，完全跳过温度除法、`min_p` 过滤、全词表排序与随机数生成；**反之，只要同一批里混进 1 条随机请求，整批就必须跑完随机采样管线**，最后仅用 `torch.where(temperature < 1e-5, greedy, random)` 挑回贪心结果；
3. **可保序阶段（仅影响随机采样）**：温度缩放（`logits /= temperature`）、`min_p` 截断、Top-k 与 Top-p 截断都不会改变最高分 token 的冠军地位，因此统一放在贪心分支之后执行。

## 三类重复惩罚：公式差别与小算例

为了防止模型反复吐出同一个词，vLLM 依次施加三种惩罚——先做乘除型 **`repetition_penalty`**，再做减法型 **`frequency_penalty`** 与 **`presence_penalty`**。设某词的原始分数为 $z_v$，它在提示词中出现掩码为 $m^{\text{prompt}}_v \in \{0, 1\}$，在已生成输出中出现次数为 $c^{\text{out}}_v \ge 0$、出现掩码为 $m^{\text{out}}_v = \mathbb{I}(c^{\text{out}}_v > 0)$：

$$z'_v = \begin{cases} z_v / \alpha_{\text{rep}}, & z_v > 0,\text{已出现} \\ z_v \cdot \alpha_{\text{rep}}, & z_v \le 0,\text{已出现} \\ z_v, & \text{未出现} \end{cases}$$

$$z''_v = z'_v - \beta_{\text{freq}} \cdot c^{\text{out}}_v - \beta_{\text{pres}} \cdot m^{\text{out}}_v$$

用一组极简示意数就能看出三者的脾气差异：设某候选词在已生成文本里出现过 $c^{\text{out}} = 3$ 次，参数设为 $\alpha_{\text{rep}} = 1.2$、$\beta_{\text{freq}} = 0.5$、$\beta_{\text{pres}} = 0.4$：

| 原始打分场景（示意） | `repetition_penalty`（$\alpha=1.2$）作用 | `frequency_penalty`（$\beta=0.5$）扣减 | `presence_penalty`（$\beta=0.4$）扣减 | 最终打分 $z''$ | 核心特点 |
|---|---|---|---|---|---|
| 正分已出现词 $z = +2.4$ | 除以 $1.2 \to +2.0$ | $-0.5 \times 3 = -1.5$ | $-0.4 \times 1 = -0.4$ | **$+0.1$** | 同时受提示词与输出词影响（仅 `rep` 看提示词） |
| 负分已出现词 $z = -2.0$ | **乘以** $1.2 \to -2.4$（压得更低） | $-0.5 \times 3 = -1.5$ | $-0.4 \times 1 = -0.4$ | **$-4.3$** | 负分不能除以 $>1$ 的数，否则反而抬高分数 |
| 未出现新词 $z = +1.0$ | 不变 $\to +1.0$ | $0$ | $0$ | **$+1.0$** | 相对胜出，模型转向新词 |

注意工程细节：`repetition_penalty` 同时扫描**提示词与已生成词**，而符合 OpenAI API 语义的 `frequency_penalty` 与 `presence_penalty` 只统计**已生成输出（`output_bin_counts` / `output_mask`）**。

## Top-k、Top-p 与 `min_p`：静态门槛 vs 动态相对门槛

温度缩放后，为了砍掉长尾噪声词，采样器按顺序施加 **`min_p` → `top_k` → `top_p`**，把落选位置的 logits 原地置为 $-\infty$：

- **`min_p`（相对峰值门槛）**：先做一次 Softmax 找出本步最高概率 $p_{\max} = \max_v p_v$，凡是满足 $p_v < \text{min\_p} \cdot p_{\max}$ 的候选一律剔除。当模型高度确信（如 $p_{\max} = 0.90$、$\text{min\_p} = 0.1$）时，门槛自动拉高到 $0.09$ 迅速收紧；当模型认为多个答案皆可（如 $p_{\max} = 0.20$）时，门槛自动放宽到 $0.02$ 保留合理多样性。因为 $p_{\max}$ 本身永远满足 $p_{\max} \ge \text{min\_p} \cdot p_{\max}$（对 $\text{min\_p} \le 1$），所以 `MinPLogitsProcessor` 的 `is_argmax_invariant()` 恒为 `True`。
- **`top_k`（固定名次门槛）**：只保留概率最高的前 $k$ 个词。它的短板是不管分布尖锐还是平坦都死守同一个 $k$。
- **`top_p`（核采样，Nucleus Sampling）**：把概率升序排列并求前缀累加和 `cumprob`，丢弃满足 $\text{cumprob} \le 1 - p$ 的尾部词，并强制把最大概率位置保留（`top_p_mask[:, -1] = False`）防止全空。

## Logprobs 四种模式与 V1 外置 Beam Search

```wiki-diagram
file: sampling-adv-fig-beam-logprobs
```

1. **Logprobs 抓取口径（V1 关键变化）**：vLLM V1 默认 `logprobs_mode = "raw_logprobs"`，即在**任何惩罚、温度缩放和截断之前**直接对原始 logits 计算 `log_softmax`（而早期 V0 返回的是采样后分布）。若需要采样后结果或未归一化打分，可切换为 `raw_logits`、`processed_logprobs` 或 `processed_logits`。对于生成式分类/打分接口，传入 `logprob_token_ids` 会走定向 `gather_specific_token_logprobs` 快速通道，只抽指定几个 token 的对数概率而不做全词表 Top-k 排序。
2. **V1 外置 Beam Search**：为了不让束搜索状态污染连续批处理的核心引擎，vLLM V1 把 Beam Search 移到了入口层（`BeamSearchOfflineMixin.beam_search`）。它把每条候选束当成普通请求，每步下发 `SamplingParams(max_tokens=1, logprobs=2 * beam_width)`，拿回每条束概率最高的 $2W$ 个后续词后在 Host 侧展开、按长度惩罚公式排序剪枝，只留前 $W$ 条进入下一轮：

$$\text{score}(y) = \frac{\sum_{t} \log p(y_t \mid x, y_{<t})}{\max(L_{\text{eff}}, 1)^{\,\gamma}}$$

$$L_{\text{eff}} = \begin{cases} |y| - 1, & y_{\text{last}} = \text{EOS} \\ |y|, & \text{否则} \end{cases}$$

其中 $\gamma$ 为 `length_penalty`。因为同一条请求的 $W$ 条候选束共享完整提示词和大部分历史前缀，必须开启 [前缀缓存（APC）](prefix-caching.md) 才能避免每步重算 Prefill。

## 昇腾 NPU 采样快慢路径剖析（`v0.30.0`）

在 `vllm-ascend v0.30.0` 中，`AscendSampler` 与 `AscendTopKTopPSampler` 针对 NPU 执行特性做了三处关键设计：

| 采样环节 | 昇腾快路径实现（`v0.30.0`） | 触发慢路径回退的条件与影响 |
|---|---|---|
| **三类惩罚** | `HAS_TRITON=True` 时走 `apply_penalties_triton` 融合核，避免在全词表（如 `151,936` 维）上反复构造稠密 `bin_counts` | 未安装 Triton-Ascend 时告警并退回上游 `Sampler.apply_penalties`（PyTorch scatter），大词表下显著变慢 |
| **Top-k / Top-p** | `_apply_top_k_top_p_pytorch` 走升序 `sort + gather + mask`（实测稳定约 `1 ms`）；源码明确注释绕开 `npu_top_k_top_p`，因其在大 $k$ 或混合 $k$ 批下会退化至 **`5–28 ms`** | 开启 `VLLM_BATCH_INVARIANT=1` 时为保批不变确定性，退回上游 `super().forward_native` |
| **按概率随机抽取** | `random_sample` 在独立 `global_stream()` 生成指数分布噪声 $q \sim \text{Exp}(1)$，以 `probs.div_(q).argmax(dim=-1)` 完成等价 Gumbel-max 抽取，全程零 Host 同步 | 规避 `torch.multinomial` 的 CPU-NPU 同步停顿；但若单批内大量请求携带各自独立 `seed`（`generators` 非空），逐条 `for` 循环填充 `q[i]` 仍会放大调度开销 |

## 常见误解

- **「`logprobs` 返回的一定是加完温度和 Top-p 之后的采样概率？」**：错。vLLM V1 默认 `logprobs_mode="raw_logprobs"`，抓取的是惩罚、温度与截断之前的原始分布；若业务依赖截断后概率，必须在启动参数显式配置 `--logprobs-mode processed_logprobs`。
- **「`min_p` 和 `top_k` 一样会破坏贪心解码结果？」**：错。`min_p` 的阈值是 $\text{min\_p} \cdot p_{\max} \le p_{\max}$，最高概率词永远不会被砍掉；反倒是 `repetition_penalty`、`logit_bias`、`min_tokens` 和 `bad_words` 会改变 `argmax`，即使 `temperature=0` 也会生效。
- **「在昇腾上调用专用算子 `npu_top_k_top_p` 一定比 PyTorch `sort+mask` 快？」**：错。在 `vllm-ascend v0.30.0` 中，工程团队专门将 `_apply_top_k_top_p_torch_npu` 指向 `_apply_top_k_top_p_pytorch`，正是因为旧版 `npu_top_k_top_p` 在大 $k$ 或同批混合 $k$ 场景下会退化到 `5–28 ms`，而排序掩码稳定在 `~1 ms`；直至社区 `main` 分支的 MRV2 采样模块才在非 `310P` 硬件上重新对接新版融合算子。
- **「Beam Search 是在 GPU/NPU 采样核里一次算完所有束的？」**：错。vLLM V1 中 Beam Search 位于入口层外置循环，每轮按 `max_tokens=1` 与 `logprobs=2*beam_width` 反复向引擎提交普通推理请求，不依赖专用核内束搜索算子。

## 对照源码

### 怎么开

- **单请求高阶采样与惩罚参数**：在 OpenAI API 或 `SamplingParams` 中直接传入 `top_k`、`top_p`、`min_p`、`repetition_penalty`、`frequency_penalty`、`presence_penalty`、`logprobs` 与 `logprob_token_ids`；服务级全局抓分口径通过 `--logprobs-mode`（可选 `raw_logprobs`、`raw_logits`、`processed_logprobs`、`processed_logits`）设定。
- **离线 / 在线 Beam Search**：通过 `LLM.beam_search(prompts, BeamSearchParams(beam_width=4, max_tokens=128, length_penalty=1.0))` 调用，并确保开启前缀缓存（默认开启）以复用共同前缀 KV。
- **确保走昇腾快路径**：环境需具备 `triton-ascend`（使 `HAS_TRITON=True` 命中 Triton 惩罚核），且仅在需要严格批不变验收时才开启 `VLLM_BATCH_INVARIANT=1`。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `AscendSampler.apply_penalties` | 环境缺少 Triton（`HAS_TRITON=False`） | 打印一次警告并静默退回上游 PyTorch `Sampler.apply_penalties` |
| `BeamSearchOfflineMixin.beam_search` | 输入为预计算嵌入 `prompt["type"] == "embeds"` | 抛出 `NotImplementedError: Embedding prompt not supported for beam search` |
| `BeamSearchOfflineMixin.beam_search` | 同时开启水印配置与 Beam Search | `_check_watermarking_unsupported(beam_search=True)` 拒绝组合 |
| `Sampler.sample` | 内部元数据同时标为 `all_greedy` 与 `all_random` | 触发 `assert not (all_greedy and all_random)` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 昇腾采样模块位置 | `vllm_ascend/sample/sampler.py`（MRV1 `AscendSampler`） | 沿用 `vllm_ascend/sample/sampler.py` | 沿用 `vllm_ascend/sample/sampler.py`，新增 `HardwareProfile` 能力判定 | 旧 `vllm_ascend/sample/` 退役，整体迁至 `vllm_ascend/worker/v2/sample/` 与 `_310p/worker/v2/sample/` 模块化目录 |
| 异步指数与分布采样开关 | 同时包含 `enable_reduce_sample`（TP 局部 Top-k + `all_gather`）与 `enable_async_exponential` | 保留 `enable_reduce_sample`，移除 `enable_async_exponential` 分支 | 精简移除 `enable_reduce_sample`，统一走 `global_stream` Gumbel-max `random_sample` | MRV2 拆出独立 `gumbel.py`、`min_p.py`、`penalties.py`、`logprob.py` 与 Triton `categorical_sample` |
| `Top-k / Top-p` 底层算子 | `_apply_top_k_top_p_pytorch`（排序掩码） | 沿用排序掩码 | `_apply_top_k_top_p_torch_npu` 显式注释绕开 `npu_top_k_top_p` 退化，转调排序掩码 | `worker/v2/sample/apply_top_k_top_p.py` 在支持 `NPU_TOP_K_TOP_P` 的卡上调用 `torch_npu.npu_top_k_top_p`（`310P` 仍退回 PyTorch） |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法原论文与推导**：Top-p 核采样动机与长尾退化分析见 Holtzman 等论文 [S1]；`min_p` 相对峰值截断理论见 Minh 等论文 [S2]。文中三类重复惩罚的正负分示意对账与长度惩罚展开式由源码公式直接推导 [D]。
- **上游 vLLM V1 采样、惩罚、过滤与 Beam Search**：`Sampler` 9 步顺序与 `raw_logprobs` 优先抓取见 `vllm/v1/sample/sampler.py:21-150` [C3]；`gather_specific_token_logprobs`、`all_greedy` 快退与温度/处理器调度见同文件 `152-300` 行 [C4]；`apply_penalties` 中 `repetition_penalty`、频率与存在惩罚公式见 `model_executor/layers/utils.py:43-82` [C5] 与 `ops/penalties.py:10-56` [C6]；`MinPLogitsProcessor` 实现与 `is_argmax_invariant() -> True` 见 `logits_processor/builtin.py:23-117` [C7]；外置 `BeamSearchOfflineMixin` 的 `max_tokens=1, logprobs=2*beam_width` 见 `beam_search/offline.py:55-145` [C8]，长度惩罚评分函数 `get_beam_search_score` 见 `beam_search/utils.py:137-163` [C9]。
- **昇腾快慢路径与四版本演进**：`v0.30.0` `AscendSampler`、`random_sample`（`global_stream` Gumbel-max）、`VLLM_BATCH_INVARIANT` 回退及绕开 `npu_top_k_top_p` 退化注释见 `vllm_ascend/sample/sampler.py:18-167` [C10]；Triton 惩罚封装 `apply_all_penalties` 见 `vllm_ascend/sample/penalties.py:13-45` [C11]；`v0.23.0` 与 `v0.26.0rc` 演化见两分支 `sample/sampler.py` [C12][C13]；`main` 迁移至 MRV2 并在支持 `NPU_TOP_K_TOP_P` 设备启用 `torch_npu.npu_top_k_top_p` 见 `worker/v2/sample/apply_top_k_top_p.py:8-38` [C14]。
