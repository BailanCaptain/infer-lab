---
id: sampling-advanced
title: 高阶采样、惩罚项、Beam Search 与 Logprobs：vLLM V1 采样流水线与昇腾快慢路径
type: concept
origin: direct
summary: >-
  本页讲清 vLLM V1 Sampler 的 9 步严格顺序、白名单/禁词/偏置、三类重复惩罚、自定义 LogitsProcessor、Top-k/Top-p/min_p 重归一差异、思考预算、四模式 Logprobs 与外置 Beam Search，以及 vllm-ascend v0.30.0 昇腾快慢路径分流与 MRV2 演进。
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
  - logit_bias
  - 分数偏置
  - allowed_token_ids
  - token 白名单
  - bad_words
  - 禁词
  - thinking_token_budget
  - 思考预算
  - logits_processors
  - AdapterLogitsProcessor
  - vllm_xargs
  - logprobs
  - top_logprobs
  - flat_logprobs
  - logprobs_mode
  - max_logprobs
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
  - 'vllm@ced6857a:docs/features/custom_logitsprocs.md#L1-L328'
  - 'vllm@ced6857a:docs/design/logits_processors.md#L1-L352'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L21-L150'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L152-L300'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L381-L424'
  - 'vllm@ced6857a:vllm/model_executor/layers/utils.py#L43-L82'
  - 'vllm@ced6857a:vllm/v1/sample/ops/penalties.py#L10-L56'
  - 'vllm@ced6857a:vllm/v1/sample/logits_processor/builtin.py#L23-L117'
  - 'vllm@ced6857a:vllm/v1/sample/logits_processor/__init__.py#L159-L237'
  - 'vllm@ced6857a:vllm/sampling_params.py#L281-L359'
  - 'vllm@ced6857a:vllm/sampling_params.py#L487-L662'
  - 'vllm@ced6857a:vllm/sampling_params.py#L720-L1050'
  - 'vllm@ced6857a:vllm/config/reasoning.py#L1-L125'
  - 'vllm@ced6857a:vllm/v1/sample/thinking_budget_state.py#L1-L582'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/bad_words.py#L13-L65'
  - 'vllm@ced6857a:vllm/entrypoints/generate/beam_search/offline.py#L58-L195'
  - 'vllm@ced6857a:vllm/entrypoints/generate/beam_search/online.py#L28-L229'
  - 'vllm@ced6857a:vllm/entrypoints/generate/beam_search/utils.py#L137-L154'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L646-L762'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L287-L406'
  - 'vllm@0fc695fc:vllm/logprobs.py#L12-L206'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L352-L416'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/bad_words.py#L1-L58'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/sampler.py#L18-L167'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/penalties.py#L13-L45'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L128-L192'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L122-L160'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/apply_top_k_top_p.py#L8-L38'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/gumbel.py#L27-L260'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/penalties.py#L36-L160'
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

**高阶采样（Advanced Sampling）是指模型在 `lm_head` 产出全词表打分 `logits` 之后、正式抽取下一个 token 之前，按严格顺序施加的改分、惩罚、截断、束搜索（Beam Search）与对数概率（Logprobs）采集机制。**

基础的[采样入门](sampling.md)已经讲清了单个温度参数和贪心解码怎样工作。但在真实线上推理中，只调温度往往管不住模型：低温度容易陷入复读机死循环，高温度又会在低概率词上胡言乱语；评测和生成式打分任务需要拿回精确的候选概率；而机器翻译或结构化摘要有时需要同时维护多条高概率候选路径。更重要的是，在昇腾 NPU 上，每多开一项采样特性都可能决定请求走 **~1 ms 异步快路径**还是掉进 **CPU-NPU 同步慢路径**。

## `Sampler.forward` 为什么严格区分「不可保序」与「可保序」？

vLLM V1 的 `Sampler.forward` 先把输入转成 `FP32` 精度（避免 `BF16` / `FP16` 下指数与累加精度塌缩），再按**是否可能改变最高分项（`argmax`）**把所有处理器拆成两道闸门：

```wiki-diagram
file: sampling-adv-fig-pipeline
```

这个先后次序直接决定了贪心请求（`temperature < 1e-5`）的命运：

1. **不可保序阶段（贪心也会受影响）**：依次施加 `allowed_token_ids` 白名单、`bad_words` 禁词、`min_tokens`（未达最短长度前屏蔽 EOS）、`logit_bias` 分数偏置、`is_argmax_invariant() == False` 的自定义处理器，以及三类重复惩罚。这些步骤都会改变谁是最高分，因此必须在 `greedy_sample`（`argmax`）之前完成。
2. **整批贪心快退**：若整批请求都是贪心（`sampling_metadata.all_greedy`），算完 `argmax` 就直接返回，跳过温度除法、`min_p`、全词表排序与随机数生成。**只要同一批里混进 1 条随机请求，整批就必须跑完随机采样管线**，最后再用 `torch.where(temperature < 1e-5, greedy, random)` 挑回贪心结果。
3. **可保序阶段（仅影响随机采样）**：温度缩放（`logits /= temperature`）、`is_argmax_invariant() == True` 的自定义处理器（含 `min_p`）与 Top-k / Top-p 截断都不改变最高分冠军，因此统一排在贪心分支之后。已接通思考预算（`thinking_token_budget`）的版本会在筛选与罚分之后按预算抬高思考结束串分数。另外，[结构化输出](structured-output.md#4-每张卡把-bitmask-作用到-logits)在进入 `Sampler` 之前就先把非法词压成 $-\infty$，所以默认的原始 `logprobs` 不会撤销已施加的文法掩码。

## 白名单、禁词与分数偏置：改偏好 vs 删候选

在温度缩放之前，请求可以用三种工具直接改写或屏蔽指定词的分数：**分数偏置调偏好，白名单与禁词删候选**。所有编号必须来自当前服务使用的分词器，不能把显示文字直接当编号或照抄其他模型的编号。

| 参数 | 请求交给它什么 | 每一步做什么 | 与 MTP / 投机解码兼容性 |
|---|---|---|---|
| `logit_bias`（分数偏置） | `token_id -> float` 映射 | 指定编号的 logit 加上对应值，不看历史次数；`-100` 也不是硬性禁用（若其余分数更低仍会胜出） | **不兼容**：开启 `speculative_config` 时任何非空映射（即便值全为 `0`）均被拒；设 `temperature=0` 也无法绕过 |
| `allowed_token_ids`（白名单） | 非空 `token_id` 列表 | 列表外一律置 $-\infty$，列表内保留原分；只限单步候选集，不约束多 token 顺序 | 兼容：MTP 每条候选验证行套用白名单；但不约束草拟阶段提议 |
| `bad_words`（禁词） | 字符串列表，由服务分词 | 仅当本次**已生成输出**的末尾即将补齐禁用串时，才把该串的**最后一枚 token** 置 $-\infty$ | 兼容：MTP 验证时把前序候选暂接到输出历史后再做后缀匹配 |

沿用[采样入门](sampling.md)的 6 词示意分数（猫 `3`、你 `2`、看 `1`、「。」`0`、我 `-1`、喜欢 `-2`）：
- **分数偏置**：给猫 `-2`（变 `1`）、给你 `+0.5`（变 `2.5`），greedy 立刻从猫改选你；随机路径还要再走温度、截断和 Softmax，因此 `+0.5` 不是“概率加 `0.5`”。
- **白名单**：只允许猫、你时，其余四项变 $-\infty$，在 $T=1$ 下概率直接归一为猫 $\approx 0.731$、你 $\approx 0.269$。即使白名单只留 2 个编号，引擎基线仍构造整张 `[batch_size, vocab_size]` 掩码，**不会缩小词表或省掉 `lm_head` 计算**；要约束完整多 token 标签或 JSON 语法，应使用[结构化输出](structured-output.md)。
- **禁词的分词与匹配边界**：服务对每个禁词做两次不带特殊标记的分词——去前导空白后直接编码，以及前面补 1 个空格再编码（基线仅在首编号不同且长度相同时保留空格变体）。若禁「喜欢猫」（两枚 token），生成「喜欢」时尚不拦截，直到末尾已有「喜欢」才屏蔽下一枚「猫」；单 token 禁词则每步屏蔽。匹配**不跨提示词与输出边界**，也不做大小写或同义词审查。
- **多限制叠加冲突**：执行顺序是白名单 → 禁词 → 最少长度 → 偏置 → 罚分。$-\infty$ 加任何有限偏置仍是 $-\infty$，正偏置救不回被屏蔽的词；偏置改变正负号还会影响后续 `repetition_penalty` 的乘/除分支。若白名单、禁词、`min_tokens` 或结构化输出交集为空（全 $-\infty$），或白名单未放行 EOS，生成会卡死或一直跑满 `max_tokens`。

## 三类重复惩罚：公式差别与小算例

为了防止模型反复吐出同一个词，vLLM 严格按 **`repetition_penalty` → `frequency_penalty` → `presence_penalty`** 顺序施加三种惩罚（按 token 编号统计，不判语义重复，也不修改权重）。设某词原始打分为 $z_v$，提示词出现掩码为 $m^{\text{prompt}}_v \in \{0, 1\}$；在已生成输出中出现次数为 $c^{\text{out}}_v \ge 0$，出现掩码为 $m^{\text{out}}_v = \mathbb{I}(c^{\text{out}}_v > 0)$：

$$z'_v = \begin{cases} z_v / \alpha_{\text{rep}}, & z_v > 0,\text{已出现} \\ z_v \cdot \alpha_{\text{rep}}, & z_v \le 0,\text{已出现} \\ z_v, & \text{未出现} \end{cases}$$

$$z''_v = z'_v - \beta_{\text{freq}} \cdot c^{\text{out}}_v - \beta_{\text{pres}} \cdot m^{\text{out}}_v$$

用一组示意数验证先后顺序为何不可颠倒：设提示词含「我 喜欢 看」，已生成输出为「猫 。 猫 我 喜欢」（猫出现 `2` 次，其余已输出词各 `1` 次，看仅在提示词，你未出现），启用 $\alpha_{\text{rep}} = 2$、$\beta_{\text{freq}} = 0.5$、$\beta_{\text{pres}} = 0.5$：

| 候选词与原始打分（示意） | `repetition_penalty`（$\alpha=2$） | `frequency_penalty`（$\beta=0.5$） | `presence_penalty`（$\beta=0.5$） | 最终打分 $z''$ | 关键边界 |
|---|---|---|---|---|---|
| 猫（$z=+3$，输出 `2` 次） | $3 \div 2 = +1.5$ | $-0.5 \times 2 = -1.0$ | $-0.5 \times 1 = -0.5$ | **$0.0$** | 若颠倒顺序先扣再除会错算成 $(3-1.5)\div 2 = 0.75$ |
| 我（$z=-1$，输出 `1` 次） | $-1 \times 2 = -2.0$ | $-0.5 \times 1 = -0.5$ | $-0.5 \times 1 = -0.5$ | **$-3.0$** | 负分必须乘 $\alpha$，除以 $>1$ 反而抬高分数 |
| 「。」（$z=0$，输出 `1` 次） | $0 \times 2 = 0.0$ | $-0.5 \times 1 = -0.5$ | $-0.5 \times 1 = -0.5$ | **$-1.0$** | 零分经 `repetition` 仍为零 |
| 看（$z=+1$，仅在提示词） | $1 \div 2 = +0.5$ | $0$ | $0$ | **$+0.5$** | 仅 `repetition` 计入提示词（含多轮对话中的历史 assistant 轮） |
| 你（$z=+2$，两处均未出现） | $+2.0$ | $0$ | $0$ | **$+2.0$** | 相对胜出，打破贪心复读循环 |

下图把五词在 `[-3, +3]` 数轴上的位移，以及下文自定义处理器面临的连续批次行重排画在一起：

```wiki-diagram
file: sampling-adv-fig-penalties-shift
```

工程边界：`presence_penalty` 与 `frequency_penalty` 取负值（$[-2, 0)$）、`repetition_penalty` 取 $(0, 1)$ 时反过来**鼓励重复**；**不能用 `0` 关闭 `repetition_penalty`**（关闭值为 `1.0`）。在 MTP / 投机解码验证中，验证第 1、2、3 个候选时须把前序候选暂接到输出历史（例如已有 `[猫]`、候选 `[猫, 你, 看]`，三行依次按 `[猫]`、`[猫, 猫]`、`[猫, 猫, 你]` 计数，未接受候选不会提前成为正式输出）。固定上游验证路径会先做罚分，再处理白名单、禁词与 `min_tokens`。

## 自定义 `LogitsProcessor`：批次状态同步与两阶段接入

当内置规则不够用时，可在服务启动时加载继承自 `vllm.v1.sample.logits_processor.LogitsProcessor` 的批级处理器，实现 `__init__`、`apply`、`update_state`、`is_argmax_invariant` 与 `validate_params`。请求侧通过 HTTP `vllm_xargs`（兼容 SDK 放 `extra_body.vllm_xargs`）或离线 `SamplingParams(extra_args=...)` 传入参数；处理器集合在引擎初始化后固定，HTTP 不能动态上传代码。

- **为什么必须维护批次状态（`BatchUpdate`）**：连续批处理中请求行号每步都可能增删交换（见上图下半区 `[A, B, C, D] → [B, E, D]`）。处理器必须严格按 `BatchUpdate` 的删/增/移/换顺序同步状态（详见[持久批次同步](prepare-inputs-flow.md#先同步持久批次每步只改变了的那几行)）。即便本步 `BatchUpdate` 为 `None`（成员未变），引擎仍调用 `update_state`，因为已保存的输出 token 列表引用会继续增长。
- **两阶段调度与适配器**：`is_argmax_invariant() == False`（会改最高分，如单步只留某 token）的处理器排在白名单/禁词之后、罚分与 greedy 之前；为 `True` 的排在温度缩放之后、Top-k/Top-p 之前，全 greedy 批直接跳过。历史逐请求 callable 需经 `AdapterLogitsProcessor` 包装，默认逐行调用，开销高于批级张量运算。
- **明确限制**：显式 `--logits-processors` 与投机解码（含 MTP）互斥，Pooling 模型也不支持。若仅通过 Python entry point `vllm.logits_processors` 安装了插件且同时开启投机解码，Worker 侧会提前返回仅保留 `MinTokensLogitsProcessor`（入口 `validate_params` 仍可能触发，不能把校验通过误判为 `apply` 已执行）。昇腾 A2/A3 选 Model Runner V2 时也会拒绝显式或插件自定义处理器。

## Top-k、Top-p 与 `min_p`：静态门槛、动态门槛与并列/重归一差异

温度缩放后，为砍掉长尾噪声词，采样器严格按 **`min_p` → `top_k` → `top_p`** 顺序过滤，把落选位置的 logits 原地置为 $-\infty$。三项关闭值分别为 `min_p=0`、`top_k=0` 或 `-1`、`top_p=1`；当 `top_k > vocab_size` 时，输入批次路径按词表大小截断。

- **`min_p`（相对峰值门槛）**：先做一次 Softmax 找出本步最高概率 $p_{\max} = \max_v p_v$，凡 $p_v < \text{min\_p} \cdot p_{\max}$ 的候选一律剔除。分布尖峰时（如 $p_{\max} = 0.90$、$\text{min\_p} = 0.1$）门槛拉高到 `0.09` 迅速收紧；分布平坦时（$p_{\max} = 0.20$）门槛放宽到 `0.02` 保留多样性。因 $p_{\max} \ge \text{min\_p} \cdot p_{\max}$，`MinPLogitsProcessor.is_argmax_invariant()` 恒为 `True`。**投机解码限制**：非贪心且归一化后的有效 `min_p > 1e-5` 时与 `speculative_config` 互斥被拒；贪心请求（`temperature=0`）会先将合法 `min_p` 归零再进检查，因此 `temperature=0, min_p=0.1` 放行，而非法 `min_p=1.1` 在归零前就会报错。
- **`top_k`（固定名次门槛与同分并列）**：只保留最高的前 $k$ 档。上游 PyTorch 排序掩码路径以第 $k$ 大分数为门槛，仅屏蔽**严格低于**门槛的词。若示意分数为 `[5, 4, 4, 1]` 且 `k=2`，并列的两项 `4` 会一并保留（共留 `3` 项）。
- **`top_p`（核采样，Nucleus Sampling）与重归一差异**：将概率排序并累加，丢弃落在累计阈值之外的长尾，并强制保留最大概率词防止全空。**上游 PyTorch 与昇腾普通排序路径在 `top_k + top_p` 联合截断上存在数值分岔**：上游先按 `top_k` 屏蔽后**在保留集上重算 Softmax** 再做 `top_p`；`vllm-ascend` `v0.26 / v0.30.0 / main` 的 `_apply_top_k_top_p_pytorch` 只在过滤前算一次 Softmax，随后沿用过滤前概率做 `top_p`（仅开启 `VLLM_BATCH_INVARIANT=1` 才回退上游路径）。

用 6 词分数（猫 `3`、你 `2`、看 `1`、「。」`0`、我 `-1`、喜欢 `-2`）取 `T=1, k=2, p=0.7`，双轨对齐到同一条 `0.70` 门槛线，分叉一目了然：

```wiki-diagram
file: sampling-adv-fig-topk-topp-renorm
```

| 排序实现路径 | 判断 `top_p=0.7` 时「猫」的概率 | 过门槛保留的候选 | 最终抽取分布 |
|---|---:|---|---|
| 上游 PyTorch（`top_k` 后重归一） | `0.731` | 猫一项已达 `0.7` | **猫 `1.0`** |
| 昇腾普通排序（沿用过滤前 Softmax） | `0.634` | 猫 + 你（累计 `0.867`） | **猫 `0.731`，你 `0.269`** |

## 思考预算（`thinking_token_budget`）：怎样推动模型从思考转向回答？

`thinking_token_budget` 是面向推理模型的逐请求顶层字段（Chat / Completions / `SamplingParams` 均支持），默认 `None`。HTTP 省略、`null` 或 `-1` 表示不限制，非负整数有效（含 `0`），用于限制**思考段最多继续生成多少 token**。它与 `max_tokens`（到达直接截断整条请求）、模板 `reasoning_effort`（提示模型少思考）以及流式隐藏思考字段（仅改返回格式，见[流式输出](streaming-output.md#隐藏思考少思考和不思考是同一个开关吗)）分属不同层次。

- **机制与预算账**：服务需通过 `--reasoning-parser` 或 `--reasoning-config`（指定 `reasoning_start_str` / `reasoning_end_str`，由服务分词）建立起止边界。若提示词已带未闭合的思考段，开始标记后的已有位置也计入预算。一旦模型未提前结束且用满预算，采样器会在常规筛选与罚分**之后**，按结束串的 token 序列逐枚抬高对应分数（结束串可含过渡文字，不是发 EOS 或前端截断），迫使模型闭合思考并进入正文回答。
- **总长度预留与约束边界**：设预算为 `4` 枚、结束标记占 `2` 枚；若把 `max_tokens` 也设成 `4`，请求会先因长度截断，连结束标记都写不完，更无答案空间。总输出上限必须覆盖「预算 + 结束标记 + 答案」。强制改分不能与白名单或结构化输出禁止结束编号相冲突；`thinking_token_budget=0` 也不等价于模型模板的 `enable_thinking=false`。投机解码路径会把草稿候选与额外 token 位置纳入预算状态推进。
- **版本生效门槛**：在 `v0.23.0` 与 `v0.26.0rc` 的 `vllm-ascend` 中，`npu_input_batch` 未接通预算状态（恒为 `None`，字段虽能解析但 NPU 侧不生效）。自 `v0.30.0` 与 `main` 起，昇腾普通采样与 MTP 验证，以及上游 GPU V2，均已完整接通预算状态创建、刷新与消费。

## Logprobs 四模式、扁平容器与指定编号查询

```wiki-diagram
file: sampling-adv-fig-beam-logprobs
```

对数概率是条件概率 $p$ 的自然对数 $\ln(p) \le 0$，越接近 `0` 概率越高，取 $\exp(\text{logprob})$ 可还原概率。沿用 6 词示意，同一枚「猫」在不同抓取口径下的数值完全不同：原始分布 $p \approx 0.634$ 对应 $\ln(0.634) \approx -0.456$；经 $T=1, k=3, p=0.8$ 截断后的分布 $p \approx 0.731$ 对应 $\ln(0.731) \approx -0.313$。只返回前 $k$ 名时它们之和通常小于 `1`，不可直接再归一冒充全词表概率。整句累计对数概率等价于各步条件概率连乘，既不是事实正确率，也不能直接作为不同长度回答的公平评分。

- **四种服务级模式（`--logprobs-mode`）**：`raw_logprobs`（默认）在采样器入口抓取，早于罚分、温度与截断；`processed_logprobs` 抓取处理后分布（纯 greedy 路径不做随机温度与截断，不会把所选词强变成概率 `1`）。`raw_logits` 与 `processed_logits` 返回未归一化打分，可为正数，不可取 $\exp$ 当概率，但内部字段名仍叫 `logprob` 且累计字段仍直接相加。HTTP 普通返回会把低于 `-9999` 的值（含 $-\infty$）夹到 `-9999`。提示词的 `prompt_logprobs` 见 [prefill](prefill.md#提示词已经给定为什么还要算它的概率)。
- **前 $k$ 名 vs 指定编号（`logprob_token_ids`）**：请求前 $k$ 名时，若实际抽中的词不在前 $k$ 名里也会一并附上，因此至多返回 $k+1$ 个不同编号；设 `0` 仍记录所选词，仅 `None`/`false` 关闭。传入 `logprob_token_ids`（最多 `128` 项，`0 <= id < vocab_size`）走 `gather_specific_token_logprobs` 定向采集，只观察这些编号而不限制生成；其 `rank` 按列表枚举填入（若与所选词重合还可能覆盖名次），不能当真实词表排名。
- **容器与 HTTP 格式**：Python 开启 `flat_logprobs=True`（HTTP 未暴露）时，改用 `FlatLogprobs` 把 `token_ids`、`logprobs`、`ranks`、`decoded_tokens` 存在四条连续数组里，按半开区间 `[start_indices[i], end_indices[i])` 定位每步以降低小对象 GC 开销（所选词命中前 $k$ 时底层数组存两份，按索引取字典时合并）。HTTP Chat 在 `choices[i].logprobs.content` 逐 token 返回 `token / logprob / bytes / top_logprobs`（`bytes` 为 UTF-8）；Completion 返回 `tokens / token_logprobs / top_logprobs / text_offset` 四条并行列表。带 `return_tokens_as_token_ids=true` 可用 `token_id:<id>` 避免同名文本键合并。
- **MTP / 投机解码边界**：MTP 仅保留最终被接受的输出 token 记录，滤掉被拒候选（勿与草稿接受概率混淆）。固定快照中 `logprob_token_ids` 未贯通候选验证与额外 token 拼接，且 `processed` 模式下额外 token 的 `logprobs_mode_override` 传递存在边界；定向查标签或生成式评分应在非投机实例核验。

## V1 外置 Beam Search：多路径扩展与含提示词长度惩罚

为不让束搜索状态污染连续批处理引擎，vLLM V1 把 Beam Search 移至入口层（`BeamSearchOfflineMixin` / 在线 `beam_search`）。每步把活跃的 $W$ 条候选束当成普通请求，下发 `SamplingParams(max_tokens=1, logprobs=2 * beam_width)`；拿回每条束概率最高的 $2W$ 个后续词后在 Host 侧展开、累加对数概率并剪枝，只留前 $W$ 条进入下一轮（已结束候选另存，最终一起比对）。

```wiki-diagram
file: sampling-beam-search
```

用宽度 $W=2$ 的两步示意说明为何它不同于随机多样本：第 1 步保留 A（`0.6`）与 B（`0.4`）；第 2 步 A 后接 C/D 的条件概率为 `0.4 / 0.35`，B 后接 C/D 为 `0.9 / 0.05`。按联合概率筛选：B→C（`0.4×0.9=0.36`）与 A→C（`0.6×0.4=0.24`）留存，A→D（`0.21`）与 B→D（`0.02`）剪枝。首步落后的 B 可以在次步反超，保留的两条束也可来自同一父束；但被剪枝的路径永不回头，故不保证全局最优。

**长度惩罚分母包含提示词长度**：对比不同长度候选时，vLLM 按如下公式打分（与前文修改 logits 的三类重复惩罚完全无关）：

$$\text{score}(y) = \frac{\sum_{t} \log p(y_t \mid x, y_{<t})}{\max(L_{\text{eff}}, 1)^{\,\gamma}}, \qquad L_{\text{eff}} = \begin{cases} |x| + |y| - 1, & y_{\text{last}} = \text{EOS} \\ |x| + |y|, & \text{否则} \end{cases}$$

其中 $\gamma$ 为 `length_penalty`：**分子只累加已生成部分的对数概率，分母却使用包含提示词 $|x|$ 在内的完整编号长度**（`v0.30.0` `ced6857a` 额外补了 $\max(\cdot, 1)$ 防除零）。设提示词长 `4`、$\gamma=1$：候选 A 新增 `2` 枚（扣末 EOS 后）累计 `-2`，得分为 $-2 \div (4+2) \approx \mathbf{-0.3333}$；候选 B 新增 `4` 枚累计 `-3`，得分为 $-3 \div (4+4) = -0.375$，A 排前。若误用仅新增长度当分母，会错算成 A `-1` vs B `-0.75` 导致排序翻转。

**在线 HTTP 与离线 Python 的关键差异**：
- **参数与解码**：离线用 `BeamSearchParams(beam_width, max_tokens)`，默认 `temperature=0`、`length_penalty=1.0`、`ignore_eos=False`，返回 `text` 包含提示词全文。HTTP 在 Chat/Completions 传 `use_beam_search=true`，由 **`n` 充当 `beam_width`**（默认 `1`），温度继承请求或模型默认（不套 Python 的 `0`），只传递 beam 相关字段（`top_k`/`top_p`/罚分/`structured_outputs` 不进入搜索），返回文本仅解码新增部分。
- **流式、文法与缓存**：HTTP Completion 拒绝 `use_beam_search=true` + `stream=true`；Chat SSE 正常到搜索完全结束才交出结果；独立 Chat render 也拒绝 beam。`v0.26+` 离线 beam 支持逐束重建文法状态并过滤候选（合法集合过大时仅过滤已返回候选，带 CPU 开销），但不扩展至 HTTP。因 $W$ 条束共享完整提示词与长前缀，必须配合 [前缀缓存（APC）](prefix-caching.md) 避免每步重算 Prefill。

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

- **三类惩罚（逐请求顶层字段，不放进 Ascend `additional_config`）**：`presence_penalty` 与 `frequency_penalty` 默认 `0.0`、范围 `[-2, 2]`（不在 `generation_config.json` 6 项读取名单中，省略/null 均回 `0.0`）；`repetition_penalty` 默认 `1.0`、须为有限正数（普通 HTTP 省略/null 先继承服务生成默认，显式 `1.0` 才覆盖关闭；通过兼容 SDK 传入时放 `extra_body`，线上 JSON 仍为顶层字段）。
- **偏置、白名单与禁词**：`logit_bias`（HTTP 键为整数字符串，`from_optional` 自动转整数并截到 `[-100, 100]`；直接构造 `SamplingParams` 用整数键不截断；与 `speculative_config` 互斥）；`allowed_token_ids`（非空整数列表，`None`/`null` 关闭，`[]` 非法）；`bad_words`（字符串列表，`[]` 关闭，Chat 不接受 `null` 或 `""`）。先用 `/tokenize`（`add_special_tokens=false`）或 `llm.get_tokenizer().encode(..., add_special_tokens=False)` 确认标签为单枚 token，再传入 `allowed_token_ids` 或 `logit_bias`。
- **自定义 `LogitsProcessor`**：启动时通过 CLI `--logits-processors your.module:YourProcessor`、Python `logits_processors=[YourProcessor]` 或安装声明 `vllm.logits_processors` entry point 的插件加载；单条请求用 HTTP `vllm_xargs`（SDK `extra_body.vllm_xargs`）或 `SamplingParams(extra_args=...)` 传参。
- **思考预算**：服务侧配置 `--reasoning-parser` 与/或 `--reasoning-config`（`reasoning_start_str` / `reasoning_end_str`）；请求顶层传 `"thinking_token_budget": 32` 与足够的 `"max_completion_tokens": 256`（离线用 `SamplingParams(thinking_token_budget=32, max_tokens=256)`）。
- **Logprobs 参数与服务上限**：服务级设 `--logprobs-mode`（默认 `raw_logprobs`）与 `--max-logprobs`（默认 `20`，`-1` 放宽到词表大小，`0` 仍允许仅记所选词）。请求侧：Chat 传 `logprobs: true` + `top_logprobs: k`（默认 `0`，显式 `null` 会关闭记录）；Completion 传整数 `logprobs`（`null` 关闭）；Python 另支持 `logprob_token_ids`（最多 `128` 项，若与 `logprobs` 同传须长度相等，单独传入按 `128` 检查而不受默认 `20` 拦截）与 `flat_logprobs=True`。
- **Beam Search**：离线 `LLM.beam_search(prompts, BeamSearchParams(beam_width=4, max_tokens=128, length_penalty=1.0))`；HTTP 在 Chat/Completions 设 `use_beam_search=true`、`n=4`、`max_tokens=128`（务必保持前缀缓存开启；需确认 `2 * beam_width <= max_logprobs`）。
- **确保走昇腾快路径**：环境需具备 `triton-ascend`（使 `HAS_TRITON=True` 命中 `apply_penalties_triton`），仅在需要严格批不变验收时才开启 `VLLM_BATCH_INVARIANT=1`。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `SamplingParams` 惩罚校验 | `presence/frequency` 超 `[-2, 2]`；`repetition <= 0` 或非有限（`v0.26+`） | 报 `presence_penalty/frequency_penalty must be in [-2, 2]`、`repetition_penalty must be greater than zero` / `must be a finite number` |
| 投机解码兼容检查 | 开启 `speculative_config` 时，初始化后 `min_p > 1e-5` 或非空 `logit_bias`（含全 `0` 映射） | 报 `The min_p and logit_bias sampling parameters are not yet supported with speculative decoding.` |
| `logit_bias` / `allowed_token_ids` / `bad_words` | 非整数键、越界编号、空列表 `[]`、空串 `""` 或空分词结果、禁串超限 | 报 `out-of-vocab token ids`、`allowed_token_ids is not None and empty!`、`bad_words cannot contain an empty string`、`bad_words entries must tokenize to at least one token.`、`Too many bad words after tokenization`（`VLLM_MAX_NUM_BAD_WORDS` 默认 `128`） |
| 自定义 `LogitsProcessor` | 显式列表与投机解码同开、Pooling 模型、或 A2/A3 MRV2 加载 | 报 `Custom logits processors are not supported when speculative decoding is enabled.` / `Pooling models do not support custom logits processors.` |
| `logprobs` / `top_logprobs` | Chat 设正数/`-1` 的 `top_logprobs` 未设 `logprobs=true`；超 `--max-logprobs`；`logprob_token_ids` 超 `128` 或配 beam | 报 `when using top_logprobs, logprobs must be set to true.`、`Requested sample/prompt logprobs ... greater than max allowed`；`v0.23/v0.26` Completion 传 `-1` 报 `logprobs must be a positive value.` |
| `AscendSampler.apply_penalties` | 环境缺少 Triton（`HAS_TRITON=False`） | 打印一次警告并静默退回上游 PyTorch `Sampler.apply_penalties` |
| `BeamSearch` 入口 | 输入预计算嵌入 `prompt["type"] == "embeds"`、开水印、Completion 流式、或独立 Chat render | 抛 `NotImplementedError: Embedding prompt not supported for beam search`、`_check_watermarking_unsupported` 或拒绝流式/render 组合 |
| `Sampler.sample` | 内部元数据同时标为 `all_greedy` 与 `all_random` | 触发 `assert not (all_greedy and all_random)` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| 昇腾采样模块与 Top-k/Top-p | `vllm_ascend/sample/sampler.py`；A2 走融合算子 `npu_top_k_top_p`；含 `enable_reduce_sample` 与 `enable_async_exponential` | 删 `enable_async_exponential`；改用过滤前 Softmax 排序掩码（`k=2, p=0.7` 与上游分岔）；保留 `enable_reduce_sample` | 删 `enable_reduce_sample`，统一 `global_stream` Gumbel-max；绕开 `npu_top_k_top_p`（`5–28 ms`）走排序掩码（`~1 ms`），`VLLM_BATCH_INVARIANT` 回退上游 | 旧 `sample/` 退役，迁至 `worker/v2/sample/`（`apply_top_k_top_p.py`、`gumbel.py`、`penalties.py`）；支持 `NPU_TOP_K_TOP_P` 的硬件重启用融合算子（`310P` 仍退回 PyTorch） |
| 惩罚、温度与 BatchChat 默认 | `repetition_penalty` 仅查 `>0`；`BatchChat` 温度/`top_p`/`min_p`/`rep` 默认有数值（`0.7/1/0/1`） | 新增有限性校验与温度 `[0, 2]`；`BatchChat` 改 `None` 走服务默认 | 延续 `v0.26` 校验与 `BatchChat=None` | 同 `v0.30.0` |
| `logit_bias` / `allowed_token_ids` / `bad_words` | `Completions` 无 `bad_words`；白名单按 `len(tokenizer)` 校验；非法 `logit_bias` 键抛 `ValueError` | `Completions` 补齐 `bad_words`；非法偏置键聚合抛 `VLLMValidationError` | 白名单改按词表大小校验；`bad_words` 禁空分词并限 `VLLM_MAX_NUM_BAD_WORDS`（默认 `128`）；GPU V2 另限 `VLLM_MAX_BAD_WORDS_TOTAL_TOKENS`（默认 `1024`） | 同 `v0.30.0` |
| `thinking_token_budget` | 字段存在，但 Ascend `npu_input_batch` 状态恒为 `None`（未生效）；拒绝 GPU V2 | 同 `v0.23.0` | Ascend 普通采样与 MTP 验证均接通状态创建/更新/消费；GPU V2 亦支持 | 同 `v0.30.0` |
| `logprobs` 与 `logprob_token_ids` | 仅 Python 支持 `logprob_token_ids`；Completion 拒绝 `-1`；`--max-logprobs` 无下界校验 | HTTP 新增 `logprob_token_ids`（最多 `128`，优先生效，拒配 beam / `echo+0`）；新增 `--max-logprobs >= -1` 校验 | Completion 协议接受 `-1` 但当前返回器候选映射为空；MTP 仍未贯通 `logprob_token_ids`，`processed` 额外 token 存在模式覆盖边界 | 同 `v0.30.0` |
| 外置 Beam Search | 在线按固定候选数映射父束；无离线文法路径 | 新增离线逐束 `structured_outputs` 重建过滤；在线补足候选不足/耗尽保护 | 新增 `skip_special_tokens=True`、显式收束 aborted beam 与评分分母 `max(..., 1)` 保护 | 延续 `v0.30.0`；仍不扩展 HTTP beam 文法 |
| 自定义 `LogitsProcessor` | 普通 V1 加载显式类与插件；显式列表与投机互斥，纯插件在投机 worker 提前返回；A2/A3 V2 拒绝 | 同 `v0.23.0` | 自定义 `ValueError` 包装为 `VLLMValidationError`；保留投机/Pooling/V2 限制 | 同 `v0.30.0` |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法原论文、官方设计文档与推导**：Top-p 核采样与 `min_p` 理论见两篇原论文 [S1][S2]；自定义批级 `LogitsProcessor` 接入指南与架构设计见 `docs/features/custom_logitsprocs.md` 与 `docs/design/logits_processors.md` [S3][S4]。文中 6 词偏置/白名单/三类惩罚叠加账、`k=2, p=0.7` 重归一反例、思考预算长度账、对数概率 $\ln/\exp$ 换算与两步 Beam / 含提示词长度惩罚算例均按源码公式直接推导 [D][D][D]。
- **上游 vLLM V1 采样、惩罚、过滤、思考预算与自定义处理器**：`Sampler` 9 步顺序、两阶段处理器调度、`raw_logprobs` 优先抓取、`gather_specific_token_logprobs` 与 `thinking_token_budget` 消费见 `vllm/v1/sample/sampler.py` 三段 [C5][C6][C7]；三类重复惩罚公式见 `layers/utils.py` 与 `ops/penalties.py` [C8][C9]；`MinPLogitsProcessor` 与自定义处理器加载/`BatchUpdate` 见 `logits_processor/` [C10][C11]；参数范围、默认与校验（含 `logit_bias`、`allowed_token_ids`、`bad_words`、`logprobs`）见 `sampling_params.py` 三段（来源 12–14）[C13]；思考预算配置与状态机见 `reasoning.py` 与 `thinking_budget_state.py` [C15][C16]；GPU V2 `BadWordsState`、上游 PyTorch 排序掩码并列/重归一规则、基线 `bad_words` 后缀匹配与 `FlatLogprobs` 容器见来源 17、23–25 [C23][C24]。
- **Beam Search 与 HTTP 入口协议**：外置离线/在线 Beam 循环与含提示词长度惩罚 `get_beam_search_score` 见 `beam_search/offline.py`、`online.py` 与 `utils.py` [C18][C19][C20]；Chat/Completions 对应字段（`use_beam_search`、`logprobs`、`logprob_token_ids`、`bad_words` 等）见来源 21–22。
- **昇腾快慢路径与四版本演进**：`v0.30.0` `AscendSampler`（`global_stream` Gumbel-max、`VLLM_BATCH_INVARIANT` 回退、绕开 `npu_top_k_top_p`）与 Triton 惩罚封装见 `vllm_ascend/sample/sampler.py` 与 `penalties.py` [C26][C27]；`v0.23.0` / `v0.26.0rc` 演化见来源 28–29；`main` 迁移至 MRV2 模块化采样栈（`apply_top_k_top_p.py`、`gumbel.py`、`penalties.py`）见来源 30–32 [C30]。
