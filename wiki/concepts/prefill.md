---
id: prefill
title: Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写
type: concept
origin: gap
summary: >-
  Prefill 并行处理提示词中尚未计算的位置并写入 KV 历史（可单轮或跨多轮分块完成），完结当步仅切出最后一个位置的隐藏向量经 lm_head 选出第
  1 个输出 token；随后 Decode 每轮送入新位置、复用全量历史逐词续写。两者共享同一套模型权重，但在算术强度、显存带宽压力与执行分支上截然相反。
aliases:
  - Prefill
  - Decode
  - 预填充
  - 解码
  - 首 token 阶段
  - prompt 阶段
  - prefill 阶段
  - P 阶段
  - D 阶段
  - 首 token 延迟
  - prompt_logprobs
  - prompt logprobs
  - 提示词概率
  - 提示词对数概率
chapters:
  - '03'
sources:
  - 'vllm@ced6857a:docs/design/metrics.md#L48-L81'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L589-L620'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L573'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L656-L706'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1040-L1085'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L70-L122'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L274-L331'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2834'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L440-L486'
  - 'vllm@ced6857a:vllm/config/compilation.py#L58-L88'
  - 'vllm@ced6857a:vllm/v1/cudagraph_dispatcher.py#L235-L325'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L154-L160'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1320-L1325'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1476-L1489'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1638-L1692'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1706-L1733'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2633-L2646'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L3038-L3135'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L3344-L3394'
  - 'vllm@ced6857a:vllm/sampling_params.py#L540-L645'
  - 'vllm@ced6857a:vllm/sampling_params.py#L888-L899'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L5643-L5750'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L245-L255'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L600-L660'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L710-L852'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L358-L542'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L1168-L1292'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L99-L135'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L167-L213'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/kimi_kda.py#L605-L710'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L5399-L5509'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1505'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L428-L436'
  - 'vllm@568afb3a:vllm/v1/worker/gpu_model_runner.py#L5562-L5679'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1355'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L590-L644'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L721-L733'
  - 'vllm@ba15685a:vllm/config/scheduler.py#L91-L150'
  - 'vllm@ba15685a:vllm/v1/worker/gpu_model_runner.py#L5341-L5450'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/attn_utils.py#L725-L750'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1185-L1202'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/kimi_kda.py#L598-L850'
  - >-
    raw:sha256-08c5c80fd562026f77c85a102ffd4cedae609ed7d2c5faa5498ec73d556ed625.md#L1-L700
  - 'vllm@ced6857a:vllm/config/model.py#L2137-L2139'
  - 'vllm@0fc695fc:vllm/config/model.py#L1852-L1857'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: request-overview
    kind: builds-on
    note: 承接全景鸟瞰里的“两轮四件事”，深入拆开第一轮提示词并行建档与后续逐词续写的代价与执行分路
  - to: token
    kind: builds-on
    note: Prefill 与 Decode 按 token 在序列中所占的位置编号组织输入张量与进度计数
  - to: attention-qkv
    kind: builds-on
    note: 因果掩码规定并排送入的提示词位置各自只能看见自己与前文，也决定了旧位置的 K、V 无需重算
  - to: gqa
    kind: builds-on
    note: Qwen3-8B 等标准模型的分组查询头共享 K、V 头，直接决定两阶段每位置读写缓存的字节数与注意力算术强度
contradicts: []
updated: '2026-11-18'
rawSources:
  - >-
    raw/sha256-08c5c80fd562026f77c85a102ffd4cedae609ed7d2c5faa5498ec73d556ed625.md
  - >-
    raw/sha256-25219c3037f780c50966b146e2d9ae82e574fdca65a6362f6dec23d8d7a1bfea.md
---

## 回答的第一个字出来之前，模型在算什么？

**Prefill（预填充）是处理请求提示词中尚未计算的位置、为后续生成建立历史状态的阶段：可以一轮并行算完，也可以按预算跨多轮分块处理；提示词全部算完的那一步，直接取最后一个位置的输出选出第 1 个生成 token。随后请求进入 Decode（解码）阶段：在普通自回归路径下，每轮只把上一步刚选出的 1 个新 token 送进模型，读取已有历史状态并选出下一个输出 token。**

先立住贯穿本页的两个基础词。提示词经分词器切分后变成一串离散编号（[token](token.md)），每个 token 占序列里的一个**位置**；**历史**则是模型为已算位置留在设备显存里的中间状态，供后续位置查阅。在 `Qwen3-8B` 这类标准 Transformer 中，每层通过 [attention](attention-qkv.md) 融合上下文：当前位置拿查询 `Q` 与自己及前文的键 `K` 打分，再按权重汇总值 `V`。因此每个算过的位置都会在各层存下一对 `K`、`V` 向量，合称 [KV cache](kv-cache.md)。混合线性注意力模型还会多出一类原地更新的定长状态，后文变体节再对照。

在 [一次请求全景鸟瞰](request-overview.md) 的主线基础上，下图按时间从左到右展开最干净的普通生成路径（不分块、不命中前缀缓存、不开投机候选，也不额外索取提示词概率）：

```wiki-diagram
file: prefill
```

顺着图中的三步推进，能一次看清两阶段的交接边界：

- **第 1 步（Prefill）：已知位置并排进门，因果掩码守住顺序。** 提示词 `x₀..x₃` 共 4 个 token 在请求到达时就已全部确定，无需拆成 4 次串行调用，直接拼成 4 行张量一次走完所有层。并排计算绝不等于偷看后文：注意力层的 **causal mask**（因果掩码，见 [因果掩码限定历史范围](attention-qkv.md#因果掩码限定每个位置能访问的历史)）会遮住右上角未来位置。于是位置 `i` 只能读 `0..i`——`x₀` 只看自己，只有末尾 `x₃` 读齐了整句 `x₀..x₃`。
- **只有最后一行送去选词，当场产出首词 `y₀`。** 走完最后一层得到 4 行隐藏向量 `h₀..h₃` 后，执行器通过 `logits_indices` **只切出最后一行 `h₃`**，送进输出头 `lm_head`（把隐藏向量映射到词表分数 `logits`）并采样，直接选出第 1 个输出 token `y₀`。前 3 行 `h₀..h₂` 这一步只负责把位置 `0..2` 的 `K`、`V` 写入缓存，不参与选词。
- **第 2 步起（Decode）：每轮只进 1 个新词，通读前文历史。** 第 2 个输出词必须等 `y₀` 选出来才知道接在谁后面，无法提前并排算；而旧位置 `0..3` 的 `K`、`V` 因看不见后文永远不会变，无需重算。于是第 2 步只送入 `y₀` 1 个位置，读取缓存中 `0..3` 的历史并为自己写下第 `4` 格，选出 `y₁`；第 3 步再送入 `y₁` 选出 `y₂`。

由此可以直接推出两个常被数错的工程事实：

- **生成 `200` 个输出词 = `1` 步 Prefill + `199` 步 Decode。** 在不分块、不复用前缀、不猜候选的普通自回归路径上，单条请求共经历 `200` 步前向，而非 `1 + 200` 步。这里数的是单条请求经历的前向步数；引擎总循环次数还受并发排队与空转影响。
- **“选出一个词”和“把它送进模型”隔着轮次边界。** `y₀` 在第 1 步末尾选出，到第 2 步才进模型写缓存。当最后一个输出 token 刚被选出就撞上 `eos_token_id` 或 `max_tokens` 时，它不再进入下一轮前向，也不会在 `KV cache` 里留下自己的槽位（详见 [KV cache 末词少一格](kv-cache.md#已生成的-token为何还可能没有自己的缓存)）。

## 为什么把已知的位置合成一步，代价在哪？

**把已知的提示词位置合成同一步并行前向，是为了让每步固定的“搬整套层权重、下发算子与跨卡通信”只付一次，把线性层变成高复用大矩阵乘；代价是这一步很宽，既拉长本请求的首字等待（TTFT），也会拖住同批陪跑的 Decode 请求。**

一步前向的开销要拆成三笔账：**逐位置线性层（`q/k/v/o` 投影与 FFN）**的计算量随输入位置数 $T$ 近似线性增长；**标准因果自注意力打分与加权（$QK^\top$ / $AV$）**随位置数呈二次方增长（每头 $T(T+1)/2$ 次打分，长序列下占比迅速上升）；另一笔**每步固定付一遍**——把各层权重从 HBM 搬进计算单元、由 CPU 下发算子链，多卡切分时每层还要发起集合通信。

拿一条提示词 `6000` 个 token、生成 `200` 个 token 的请求看直觉：若像 Decode 那样逐个位置串行喂进去，走到第 1 个输出词就要跑 `6000` 步前向，理想模型下需把整套权重反复读取 `6000` 轮。若在不分块的前提下合成 `1` 步 Prefill，每个提示词位置该做的数学乘加一次不少（`1 步 × 6000 行 = 6000 份`），却能在批内把同一片权重复用 `6000` 次。随后请求再走 $N_{\text{decode}} = 200 - 1 = 199$ 步单位置 Decode，两阶段单步位置宽度相差 `6000 : 1`。以上轮数是调度与理想权重复用对照，真实 HBM 读取次数还取决于片上分块、缓存与融合实现。

下面把这笔账落到全站 `v0.30.0` 主基线的标准稠密模型 **`Qwen3-8B`** 上。它的核心规格为 `36` 层、`hidden_size = 4096`、`32` 个查询头共享 `8` 个 KV 头、`head_dim = 128`、词表 `vocab_size = 151,936`。按 BF16 静态核算，纯权重体积为 `8.19B × 2 B ≈ 16.38 GB`（折合 `15.26 GiB`），全层每 token `KV cache` 占 `144.0 KiB`（唯一推导见 [HF 模型目录解剖](hf-model-anatomy.md#完整算账对照qwen3-8b-vs-qwen3-30b-a3b)）。下图直观对比两阶段的硬件瓶颈与 `logits_indices` 末行切片收益：

```wiki-diagram
file: prefill-fig-compute-vs-bw
```

按 [矩阵乘与权重](matmul-and-weights.md#同一片权重为什么能处理多行输入) 与 [Roofline 模型与性能三角](roofline-and-metrics.md) 的理想单次读写模型，考察 `Qwen3-8B` 单层 `q_proj`（形状 $[M, 4096] \times [4096, 4096]$，BF16 权重 `32.00 MiB`）。它的算术强度（每搬运 1 字节显存数据所配的浮点运算次数）随本步总行数 $M$ 变化为：

$$I_{\text{BF16}}(M) = \frac{2MNK}{2(MK + KN + MN)} = \frac{1}{\frac{1}{M} + \frac{1}{4096} + \frac{1}{4096}}$$

下表并列对照 `Qwen3-8B` 在 `N = 2048` 提示词 Prefill、单条 Decode（`M = 1`）与 `12` 条并发 Decode（`M = 12`）下的核心指标。数值均按静态张量形状推导，未计入算子工作区与跨卡通信，实机瓶颈须结合剖析确认：

| 运行阶段与批宽（`Qwen3-8B` BF16） | 全层权重理想读取 | `q_proj` 算术强度 $I_{\text{BF16}}$ | 全层 HBM `KV cache` 读写 | `lm_head` 输出分数张量（FP32） | 典型硬件受限倾向 |
| --- | --- | --- | --- | --- | --- |
| **Prefill（`N = 2048` 整段）** | `15.26 GiB` 读 1 遍复用 `2048` 行 | **`1024.0 FLOP/B`**（若 `N=6000` 达 `1526.8`） | 批量写入 `2048 × 144 KiB = 288.0 MiB` | `logits_indices` 切末行：`[1, 151936] ≈ 0.58 MiB`（省去全算 `1.16 GiB`） | 远高于硬件脊点（`~120–270`），偏 **[Cube 矩阵核](ai-core.md)算力受限** |
| **单请求 Decode（`M = 1`）** | `15.26 GiB` 仍须整套通读 1 遍 | **`1.00 FLOP/B`** | 读历史 `288.0 MiB` + 写新格 `144.0 KiB` | 单行输出：`[1, 151936] ≈ 0.58 MiB` | 深陷 **HBM 权重 + KV 带宽受限** |
| **拼批 Decode（`M = 12` 条同长历史）** | `15.26 GiB` 由 12 条请求分摊 | **`11.93 FLOP/B`**（单条的约 12 倍） | 读独立历史 `12 × 288 MiB = 3.38 GiB` | 12 行输出：`[12, 151936] ≈ 6.96 MiB` | 权重带宽摊薄，但仍处带宽斜坡且独立 KV 读取增至单路的 12 倍（`×12`） |

从上表和剖面图能读出两头截然相反的工程处境：

- **Prefill 怕“一步太宽”卡住全场，所以要设每步预算并分块。** 假设实例上已有 `12` 条请求正在 Decode（每步合占 `12` 个位置），此时闯进前面那条 `6000` token 的新提示词。如果不设单步位置上限，这一步就要硬算 `6000 + 12 = 6012` 个位置，耗时比前后两步（`12` 和 `13` 个位置）暴涨上百倍。一方面，新请求自己的 **TTFT**（Time To First Token，从请求到达到首词返回的端到端时间，含排队、调度、Prefill 前向、采样与返回）随提示词拉长；另一方面，那 `12` 条同批 Decode 请求也被迫陪等这一大步算完才能拿到下一个词。为此，vLLM 用 `--max-num-batched-tokens` 设定每步 token 预算，超出剩余预算的长提示词自动切到后续轮次接力——这就是 [chunked prefill](chunked-prefill.md)（分块预填充）。以每步预算 `2048` 个位置（示意）为例，在 `12` 条普通 Decode 持续在跑时，`6000` 个提示词位置的三步切分账如下：

| 引擎步序号 | 12 条在跑 Decode 先占 | 留给新请求 Prefill 的位置数 | 新请求累计已算进度 | 本步末尾是否产出新请求首词 |
| --- | --- | --- | --- | --- |
| 第 1 步 | `12 × 1 = 12` | $2048 - 12 = \mathbf{2036}$ | `2036 / 6000` | 否（中间分块采样结果丢弃） |
| 第 2 步 | `12 × 1 = 12` | $2048 - 12 = \mathbf{2036}$ | `4072 / 6000` | 否（中间分块采样结果丢弃） |
| 第 3 步 | `12 × 1 = 12` | $6000 - 4072 = \mathbf{1928}$（总宽 `1940 ≤ 2048`） | `6000 / 6000` | **是：末段位置 `5999` 选出首词 `y₀`** |

- **Decode 怕“一步太窄”喂不饱硬件，所以靠拼批与投机解码破局。** Decode 每条请求每步只推进 1 个位置，算力利用率极低。工程上有两条破局路径：一条用 [continuous batching](continuous-batching.md)（连续批处理）把几十条请求攒进同一步分摊权重读取；另一条开启 [speculative decoding](speculative-decoding.md)（投机解码），先由轻量草稿机制猜出几个候选词，下一步由主模型并行验证、猜中几个就前进几格。观测流式推进时，务必区分相邻两包之间的间隔 **ITL** 与首词后按生成词数均摊的 **TPOT**（统一计时口径见 [推理测量](inference-benchmarking.md#先把一个请求的几种等待分开) 与 [Roofline 指标对账](roofline-and-metrics.md#推理性能三角ttfttpot--itl-与系统吞吐为什么互相拉扯)）。

> **边界与例外（MoE 架构下的路由稀释）**：换到带 [MoE](moe.md)（混合专家）的架构，算账还要多看路由稀释。以 `Qwen3-30B-A3B` 为例，它有 `128` 个路由专家、每词选 `8` 个，总权重 `56.87 GiB`、单词激活 `3.35B`。Decode 小批时只读本步被抽中的专家，但并发一大几乎会把全部专家点亮一遍，不能笼统断言 Decode 永远只读少量或永远读全量权重。Prefill 也不能把总行数直接套给单个专家：在 `64` 个专家每词挑 `2` 个的示意设定下，`6000` 个提示词位置均摊到单个专家只有 $6000 \times 2 \div 64 \approx 188$ 行，虽远少于整步 `6000` 行，仍明显宽于单步 Decode 的寥寥数行。

把围绕两阶段的四个高频相邻机制放在一起辨析：

| 概念 | 与 Prefill 的准确关系 |
| --- | --- |
| **Decode** | Prefill 完结后的逐轮生成阶段；普通自回归每步进 `1` 个新位置，开启投机解码时每步进 `1 + 候选数` 个位置 |
| **Chunked Prefill** | 同一条长提示词跨多轮引擎步分段完成 Prefill，只有最后一段真正产出首词 `y₀` |
| **Prefix Caching** | 开头与历史请求兼容的前缀块直接复用既有 `KV cache`，Prefill 只算剩余未命中位置，见 [prefix caching](prefix-caching.md) |
| **PD 分离** | 把 Prefill 与 Decode 拆到两组独立实例（各占一组卡）并通过网络传 `KV cache`，消除长 Prefill 对 Decode 的同批干扰，见 [PD 分离](pd-disaggregation.md) |

注意前缀缓存命中以**完整块哈希身份兼容**为前提：哈希同时纳入前块指纹、本块 token 编号，以及 [LoRA](lora.md) 适配器、多模态特征、缓存盐值 `cache_salt` 与直接输入嵌入标识。光有字面相同的开头文本并不保证可复用，且复用后的剩余后缀位置依然走提示词处理逻辑，不会提前变成生成输出。

## 提示词已经给定，为什么还要算它的概率？

**提示词概率（`prompt_logprobs`）是在每个已知提示词位置旁边补一份条件评分：给定前面的上文，模型原本认为这枚已知 token 出现的对数概率有多高。** 它常用于对比提示词写法或定位突兀词位，绝不会改写提示词，也不代表回答正确率（对数概率换算见 [采样页](sampling.md#对数概率怎样读为什么不是置信度百分比)）。

沿用首屏 4 个已知位置 `x₀..x₃`：因为位置 `i` 的隐藏向量 `hᵢ` 已经看过 `xᵢ`，只能错一位投影去评下一枚 `xᵢ₊₁`。下图直接画出这套错位映射与开启后的两笔工程代价：

```wiki-diagram
file: prefill-fig-prompt-logprobs
```

对照图中的两排方块，核心规则只有三条：

- **首位置 `x₀` 无前序位置**：普通返回列表首项固定为 `None`，`flat_logprobs=true` 时首位置切片为空字典 `{}`——两者都表示「无条件概率」，绝非概率为 `0`。
- **错位取值与候选上限**：`h₀..h₂` 经 `lm_head` 投影后，按真实下一枚提示词编号取分（如 6 词示意中 `x₁` 是「你」，即便「猫」分更高仍取「你」的 $p \approx 0.233, \ln p \approx -1.457$）。传正整数 `k > 0` 时同位置至多附带 `k + 1` 项候选，传 `0` 则只保留实际词评分；末行 `h₃` 仍照常选出首词 `y₀`。
- **开销在输出头、不重跑主干**：`Qwen3-8B` 对 `N = 2048` 提示词开启记录（哪怕传 `prompt_logprobs = 0`）仍须把前 `2047` 行送进 `lm_head`，算出 `[2047, 151936]` 分数矩阵（FP32 下约 `1.16 GiB`）并做全词表归一化与跨设备拷回。分块 Prefill 期间，这些分数暂存在 `in_progress_prompt_logprobs_cpu`，等整段提示词算完一次交出。

> **边界与例外（自动跳过读取前缀缓存）**：既有 `KV cache` 只存 `K`、`V`，不保存词表分布。因此 `SamplingParams` 默认令 `skip_reading_prefix_cache = (prompt_logprobs is not None)`，只要开启提示词概率（含 `0`）就会自动跳过读取已有前缀缓存。这只跳过读取，不等于全局关闭缓存或禁止写入缓存（共享条件见 [prefix caching](prefix-caching.md#哪些块能被共享)）。

## 一步之内引擎怎样统一调度又分路执行

**vLLM V1 调度器内部不设独立的 Prefill 队列或 Decode 队列，只用同一条“未算位置进度差”公式分预算。** 真正的两阶段分路发生在 NPU 执行器侧：由 `AscendAttentionState`、整图判定 `uniform_decode` 与末行切片 `logits_indices` 分别接管。

1. **统一调度（无阶段队列）**：`Scheduler.schedule` 在注释里明确声明无阶段之分，对每条请求统一算本步新增位置数 $\text{num\_new\_tokens} = \text{num\_tokens\_with\_spec} - \text{num\_computed\_tokens}$。该数值再依次受单条长提示词上限 `long_prefill_token_threshold`、整步剩余 `token_budget`（`max_num_batched_tokens`）与上下文上限 `max_model_len` 夹断，并按缓存组申请块号（详见 [KV cache 规格](kv-cache-spec.md)、[KV cache 分块](kv-cache.md#缓存按块存放一个位置的-kv-写进哪一格) 与 [调度器](vllm-scheduler.md)）。以 4 token 短提示词为例，同一道减法同时覆盖普通 `Qwen3-8B` 与带 MTP（每步草拟 3 个候选）的请求：

| 步序 | `Qwen3-8B` 普通自回归 | 开启 MTP（草拟 3 个候选） | 语义归属 |
| --- | --- | --- | --- |
| 第 1 步 | $\text{应算 } 4 - \text{已算 } 0 = \mathbf{4}$ | $\text{应算 } 4 - \text{已算 } 0 = \mathbf{4}$ | 4 个未算提示词并行进门（Prefill） |
| 第 2 步 | $\text{应算 } 5 - \text{已算 } 4 = \mathbf{1}$（仅送 `y₀`） | $\text{应算 } (5 + 3) - \text{已算 } 4 = \mathbf{4}$（`y₀` + 3 候选） | 复用前 4 格历史续写或验稿（Decode） |

2. **执行侧状态标签与图模式派发**：`vllm-ascend` 的 runner 在准备输入时，按批内各请求进度贴上 `AscendAttentionState` 标签：
   - 整批从零起算贴 `PrefillNoCache`；全批每请求仅排 1 个位置贴 `DecodeOnly`（开启 MTP 时改贴 `SpecDecoding`）。
   - 混合批、分块续算或非 MTP 投机验证贴 `ChunkedPrefill`；关闭分块时的前缀命中贴 `PrefillCacheHit`。只要不是 `DecodeOnly` / `SpecDecoding`，就标记 `with_prefill = True`。
   - 随后 `CUDAGraphDispatcher.dispatch` 决定能否回放预录制的 `ACLGraph`（详见 [图模式](graph-mode-layer.md)）。在 **`FULL_DECODE_ONLY`**（仅录纯解码整图，`mixed_mode = NONE`）下，只有满足 `uniform_decode == True` 的纯 Decode 批能回放 `FULL` 整图，**任何含 Prefill 的步或混合批都会退回 `NONE`（Eager 模式，即不录整图、算子逐个下发）**。在默认 **`FULL_AND_PIECEWISE`** 下，不超过 `max_cudagraph_capture_size` 的短 Prefill 或混合批可命中绕开注意力算子的 `PIECEWISE` 分段图，超宽 Prefill 批同样退回 Eager。
3. **末行切片与分块中间段丢弃**：普通生成时，`logits_indices = query_start_loc[1:num_reqs+1] - 1` 只挑每条请求的末尾行算 `compute_logits`。对尚未算完提示词的中间分块，runner 为保持流水简单照常采样一次，但由 `discard_requests_mask` 标记并在 `_bookkeeping_sync` 中清空输出。若请求自带随机种子，还会调用 `gen.set_offset(gen.get_offset() - 4)` 把随机数发生器往回拨，防止白采样污染正式生成。

> **边界与例外（末 1 词尾块与 `uniform_decode` 判定）**：未开 MTP 时，恰剩最后 1 个提示词尾块的请求也会落入 `DecodeOnly` 单步执行分支，但请求语义上仍属提示词收尾。整图放行条件 `uniform_decode == True` 要求所有请求已有初始历史、混合模型已完成全部提示词，且每请求长度整齐等于 `uniform_decode_query_len`。

### 异构混合层与双机 MTP 对照（KDA / 稀疏 MLA / GLM 全案）

前面主干用的是标准稠密模型 `Qwen3-8B`。如果换成含线性注意力与投机解码的异构模型，同一套「统一调度 + 执行分路」逻辑不变，但每步表面宽度与内部算子分路会出现一个极有启发性的对照。下面切入例外 B 历史绑定算例——双机 16 卡（TP8/DP2/EP16 W8A8 + MTP 3 候选）的 `GLM-5.3-Flash`。它的主干共 `45` 层：含 `34` 层原地更新定长状态的 KDA [线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进) 与 `11` 层带打分器 indexer 的 [稀疏 MLA](sparse-attention.md)，词表 `154880`，每步 `218` 次集合通信（唯一推导见 [双机部署](glm-5-3-flash-two-node.md#部署前提) 与 [一条请求](one-request.md)）。

在短示例请求 `R1`（4 枚提示词）上，开启 MTP 后第 1 步 Prefill（`p₀..p₃`）与第 2 步 Decode（`y₀` 加 3 个候选 `d₁..d₃`）每卡张量宽度恰好都是 `4`。下图并排对比这两步以及混合批分路：

```wiki-diagram
file: prefill-flow
```

这正印证了区分两阶段的不是表面宽度，而是**提示词是否算完、读写历史的方式与图派发分支**：

- **第 1 步（Prefill）**：贴 `PrefillNoCache`。因提示词尚未算完，无法回放 4-token 解码整图而退回 Eager；DP 组对齐时，空闲组陪跑空批也一并退回 Eager（见 [并发宽度补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。KDA 从零状态按最多 64 位置一段并行推进，词表投影只出 `1` 行选出 `y₀`，再由 MTP 草拟 3 个候选。
- **第 2 步（Decode）**：贴 `SpecDecoding` 并回放 4-token 图。KDA 逐位置递推并为候选留槽，词表投影出 `4` 行、一次产出 `1..4` 个词。若后续还需 `199` 个词，Decode 步数按接受率落在 `50..199` 步之间（验稿回退见 [一条请求第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)）。

### 长提示词和多条请求：prefill 混进 decode 批以后

**长提示词插进正在运行的实例时，会与别人的 Decode 拼成混合批：这一步打破 `uniform_decode` 无法回放整图，异构模型内部还要按行分路并切换跨机通信路径。**

对比 `Qwen3-8B` 单实例（预算 `2048`）与双机 GLM [场景 M](concurrent-requests.md#示例场景-m-与变体-m)（预算 `8192`，12 条在跑 MTP Decode 遇上 `6000` token 新提示词 `N`）的混合步账单：

| 场景设定 | 同批 Decode 占位数 | 混入的新提示词位数 | 本步总宽与执行变化 |
| --- | --- | --- | --- |
| **`Qwen3-8B` 普通混合步**（预算 `2048`） | `12 × 1 = 12` | 首块分得 `2036` | 总宽 `2048`，贴 `ChunkedPrefill`；`FULL_DECODE_ONLY` 下退回 Eager |
| **双机 GLM 场景 M 第 2 步**（预算 `8192`） | `12 × (1 + 3) = 48` | 整段 `6000` 一次排入 | 总宽 **`6048 ≤ 8192`**，贴 `ChunkedPrefill` 走 Eager；KDA 拆成 12 条递推 + 6000 行分段并行再拼回；MoE 跨 `128` 门槛改 AllGather（见 [并发 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)） |

提示词再长时（如 `20,000` token 跨多轮切分，见 [并发分块推导](concurrent-requests.md#提示词超过剩余预算时分几步算)），后一块必须无缝接续前一块留下的 `KV cache` 与 KDA 状态（见 [历史状态跨段延续](chunked-prefill.md#历史状态必须跨段延续)）。注意分块能力只允许跨轮计算，不会放宽 `max_model_len` 上限。

此外还有三类可选调度变体：一是显式传 `--no-enable-chunked-prefill` 关闭分块（此时预算小于 `max_model_len` 会直接报错）；二是设 `--long-prefill-token-threshold` 单独压低单条长提示词每步配额（默认 `0` 不限）；三是启用昇腾可选的剖析分块或 [短请求优先](short-request-first.md) 调度器。

## 常见误解

先把线上调优与阅读源码时最常混淆的五组直觉摆上对照板，再逐条核实原因：

```wiki-diagram
file: prefill-fig-myths
```

- **「Prefill 只是轻量预处理，不算真正的模型推理，也不产出 token。」** 错。Prefill 完整走遍全部模型层（如 `Qwen3-8B` 的 36 层或 `GLM-5.3-Flash` 的 45 层），在长提示词下往往是整条请求单步算力消耗最重的一步，且在提示词算完当步直接产出第 1 个输出词 `y₀`；只有分块 Prefill 的中间段才把临时采样结果丢弃。
- **「提示词有 `N` 个 token，Prefill 就要选 `N` 次词。」** 错。普通生成路径下 `logits_indices` 只切出末尾 1 行进 `lm_head` 选 1 次词；前面 `N - 1` 行的价值是留下历史缓存，只有显式请求 `prompt_logprobs` 时才会额外对它们做词表投影。
- **「vLLM 调度器里分设了 Prefill 阶段队列和 Decode 阶段队列。」** 错。V1 调度器只按“应算位置减已算位置”的统一进度差分配预算，所谓 Prefill 与 Decode 是按本步送入位置的语义起的名字；`AscendAttentionState` 也只是昇腾 worker 为底层注意力与通信分路贴的执行侧标签。
- **「Prefill 一定比 Decode 宽，而 Decode 永远每步只进 1 个 token。」** 未必。开启 MTP 草拟 3 个候选时，4 token 短提示词的 Prefill 与后续 Decode 每步宽度都是 `4`（产出 `1..4` 个词）；执行器判断能否回放解码整图看的不是表面宽度，而是所有请求是否已有历史且提示词已全部算完。
- **「只要开了图模式，整条请求从头到尾都在回放整图。」** 错。在 `FULL_DECODE_ONLY` 下只有整齐的纯 Decode 批（`uniform_decode`）才回放整图，Prefill 与混合批一律退回 Eager；即便开启分段图 `FULL_AND_PIECEWISE`，超过 `max_cudagraph_capture_size` 的宽 Prefill 批同样走 Eager。
- **「TTFT 就是单次 Prefill 前向的耗时。」** 错。TTFT 从请求到达算到首词返回，包含队列等待、多轮分块调度、同批 Decode 混跑开销、采样与网络返回。

## 对照源码

### 怎么开

Prefill 无需手动开启，每条请求进门必经它。改变两阶段批宽与执行形态的核心启动参数如下（主基线 `Qwen3-8B` 未显式传参时按 `v0.30.0` 模型能力自动推导[C10]，右列附双机 GLM 历史教程取值[S2]作对照）：

| 启动参数 | 控制作用 | `Qwen3-8B`（`v0.30.0` 默认口径） | 双机 GLM 历史教程对照 |
| --- | --- | --- | --- |
| `--max-num-batched-tokens` | 每 DP 组单步最多调度的总位置预算，决定多长的提示词需要切分 | 按模型与 `--performance-mode` 推导（常配 `2048`–`8192`） | `8192` |
| `--max-num-seqs` | 单 DP 组同时在跑的最大请求数 | 默认按平台配置推导 | `32` |
| `--enable-chunked-prefill` | 允许长提示词按剩余预算跨多步切分 | 未显式传参时由模型分块能力推导开启 | 未写，按支持能力默认开启 |
| `--long-prefill-token-threshold` | 单条长提示词每步可分得的额外上限 | 默认 `0`（不另设单条上限） | 默认 `0` |
| `--enable-prefix-caching` | 兼容前缀块直接复用历史 `KV cache` | 标准稠密 GQA 与生成类 hybrid 模型均返回 `True` 默认开启（`config/model.py#L2137-L2139`） | `v0.23.0`（`0fc695fc`）历史基线中混合线性注意力模型默认关闭 |
| `--speculative-config` / `-cc` | 投机候选数与图捕获模式（如 `FULL_DECODE_ONLY`） | 默认不启用投机；图模式默认 `FULL_AND_PIECEWISE` | MTP 草拟 `3` 个；仅纯解码回放整图 |

**请求提示词概率（`prompt_logprobs`）。** 该字段是逐请求参数（Python `SamplingParams`、HTTP `/v1/completions` 与 `/v1/chat/completions` 请求体顶层整数或 `None`/`null`，默认均为 `None`，不从 `generation_config.json` 继承）[C22]：

| 取值 | 行为含义 | 返回形态与前置约束 |
| --- | --- | --- |
| `None` / `null` | 不显式索取提示词评分 | `echo=false` 时完全关闭额外投影 |
| `0` | 仅记录各位置真实提示词 token 的评分 | 仍执行前 `N - 1` 行词表投影，且默认跳过前缀缓存读取 |
| 正整数 `k` | 返回该位置前 `k` 名候选加真实提示词 token | 合并同编号后每位置至多 `k + 1` 项；须满足 `k <= max_logprobs`（服务默认 `20`） |
| `-1` | 请求返回整张词表全量分数 | 服务端启动必须把 `--max-logprobs` 放宽至覆盖 `vocab_size`，默认 `20` 会直接拒绝 |

向在线 `Qwen/Qwen3-8B` 服务发送非流式请求示例（Chat 接口把 `prompt` 换成 `messages` 即可，响应中 Completion 放在 `choices[i].prompt_logprobs`，Chat 放在响应顶层 `prompt_logprobs`；Python 端读取 `RequestOutput.prompt_logprobs`，首项为 `None`，`flat_logprobs=true` 时首位置切片为空字典 `{}`，见 [采样页容器说明](sampling.md#记录的是处理前还是处理后怎样装进返回值)）：

```json
{
  "model": "Qwen/Qwen3-8B",
  "prompt": "请用两句话解释 KV cache：",
  "max_tokens": 32,
  "prompt_logprobs": 0,
  "stream": false
}
```

**流式、`echo` 与缓存读取的精确边界。** HTTP 入参校验拒绝显式同时传入 `stream=true` 与 `prompt_logprobs > 0`（或 `-1`）；传 `0` 虽能通过该校验，但流式 SSE 响应结构没有独立的 `prompt_logprobs` 字段（`EngineCore` 内部增量输出会在 Prefill 完结时聚合交出一次，但与 HTTP 序列化是两层规则），需要完整提示词记录请使用 `stream=false`。当 `echo=true` 且 `prompt_logprobs` 省略或为 `null` 时，Completion 会从请求 `logprobs` 派生提示词记录数量，Chat 则从 `top_logprobs` 派生（默认 `0`）；若想彻底省掉额外词表投影，切勿开启会触发派生的 `echo`。`skip_reading_prefix_cache` 默认为 `None` 时自动由 `prompt_logprobs is not None` 派生为 `True`；强行传 `False` 虽能恢复缓存读取，但命中跳过的历史前缀块无法产出词表评分。

### 会报什么错

- **提示词超长或撑满上限**：输入校验直接拦截并报 `The decoder prompt (length …) is longer than the maximum model length of …`；生成任务（`runner_type == "generate"`）若提示词长度恰好等于 `max_model_len`，也会因至少要给输出留 `1` 个位置而报 `… plus the number of requested output tokens (at least 1) is longer than the maximum model length …`[C11]。
- **空提示词**：报 `The decoder prompt cannot be empty`[C11]。
- **关闭分块时预算小于最大长度**：传入 `--no-enable-chunked-prefill` 且 `max_num_batched_tokens < max_model_len` 时，启动校验立即抛出 `ValueError: max_num_batched_tokens (…) is smaller than max_model_len (…)`[C9]。
- **`prompt_logprobs` 取值或流式冲突**：Python 传入小于 `-1` 的负数报 `prompt_logprobs must be non-negative or -1`（HTTP 提示语写 `must be a positive value or -1.`，实测允许 `0`）；超出服务 `--max-logprobs` 上限报 `Requested prompt logprobs of …`；与流式同开报 `` `prompt_logprobs` are not available when `stream=True`. ``。直接传入 `prompt_embeds` 时没有提示词 token 编号，runner 会静默跳过该请求的提示词评分。

### 开销和什么时候别开

- **单步预算权衡**：调大 `--max-num-batched-tokens` 能减少超长提示词的分块轮数，但也会放大混合批宽度，拉长同批 Decode 请求的 `ITL`，并在 `FULL_DECODE_ONLY` 下打断整图回放（MoE 双机还会跨过 `128` 门槛触发 AllGather）[I]；高 SLA 在线服务可结合 `--long-prefill-token-threshold` 或采用 [PD 分离](pd-disaggregation.md) 将两阶段物理隔离（需权衡跨实例 KV 传输与资源配比）。
- **按需开启 `prompt_logprobs`**：仅在确需逐词位困惑度或提示词诊断时按请求开启；传 `0` 只能省去候选序列化体积，省不掉 `[N - 1, vocab_size]` 输出头矩阵乘与跳过前缀缓存读取的代价，传 `-1` 更会产生全词表规模的搬运与序列化洪峰。

### 版本差异

下表对照四套固定仓库基准版本在统一调度、昇腾注意力状态、整图派发、`prompt_logprobs` 与混合线性注意力分路上的真实演进：

| 机制与对照项 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) |
| --- | --- | --- | --- | --- |
| **V1 无阶段进度差调度与分块推导** | `scheduler.py#L340-L351` 统一按进度差排预算；未显式设置分块与 APC 时由模型能力推导 | 同一调度注释移至 `scheduler.py#L428-L436`，默认推导规则一致 | `scheduler.py#L561-L573` 维持同一无阶段规则[C5]，`#L656-L706` / `#L1040-L1085` 分别处理运行与等待请求[C6][C7] | `scheduler.py#L721-L733` 维持同一规则，分块与 APC 仍由模型能力推导 |
| **单条长提示词阈值 `long_prefill_token_threshold`** | 默认 `0`；旧版保留多条并发分块辅助选项 | 默认 `0` | 默认 `0`（不限），清理了“同时切分几条提示词”旧选项 | 默认 `0`，新增可选自适应开关 `long_prefill_token_threshold_adaptive`（默认 `False`） |
| **昇腾注意力状态与执行器架构** | MRV1 `model_runner_v1.py#L1477-L1505`（及 GLM 专项分支 `db701c1f`）按顺序构建 `AscendAttentionState` | MRV1 `#L1327-L1355` 判断顺序一致 | MRV1 `#L1706-L1733` 区分 `PrefillNoCache` / `DecodeOnly` / `SpecDecoding` / `ChunkedPrefill` / `PrefillCacheHit`[C18] | 移除 MRV1，迁入 MRV2 `worker/v2/attn_utils.py#L725-L750` `build_attn_state`（优先分支 `pooling`，投机状态交由各 speculator 维护）[C44] |
| **图模式派发、`logits_indices` 与中间块丢弃** | `cudagraph_dispatcher.py#L306-L327` 派发；末行切片与中间分块丢弃一致 | 派发、末行切片与丢弃回拨一致 | `FULL_DECODE_ONLY = (FULL, NONE)` 仅对 `uniform_decode`（混合模型须 `done_prefilling`）回放整图[C12][C13][C21]；`logits_indices` 切末行[C17]，中间块丢弃并回拨 RNG 偏移 `4`[C20] | MRV2 在 `worker/v2/model_runner.py#L1185-L1202` 按 `input_batch.logits_indices` 驱动 `compute_logits`，`FULL_DECODE_ONLY` 纯解码语义保持一致 |
| **`prompt_logprobs` 评分模式与 HTTP 边界** | 直接算 `log_softmax`，忽略服务 `logprobs_mode` 选择（GLM `db701c1f` 同） | `raw_logits` / `processed_logits` 返回 FP32 原始 `logits`，其余返回原始对数概率（均不叠加生成温度与罚分） | `gpu_model_runner.py#L5643-L5750` 延续 `v0.26.0rc` 四模式分路与分块聚合[C24]；HTTP 仅把 `-inf` 夹到 `-9999.0`、流式拒绝正数/`-1`、`echo` 可派生 | `#L5341-L5450` 保持相同四模式语义、流式限制与默认跳过前缀缓存读取；MRV2 通过 `prompt_logprobs_worker` 协同 |
| **混合线性注意力 KDA 分路** | 社区维护分支 `2c59ff10` 不含 GLM；专项分支 `db701c1f` 在 `kimi_kda.py` 拆两路 | 维护分支 `2ed6cbba` 不含 GLM | `ops/kimi_kda.py#L605-L710` 按行拆出 `_run_prefill` 分段并行与 `_run_recurrent` 递推两路[C32] | `ops/kimi_kda.py#L598-L850` 延续同一按行分路与状态原地更新机制 |

### 源码位置

按“单步主循环 → 统一调度 → 状态标签与整图判定 → 末行切片、分块丢弃与提示词概率”顺序对照 `v0.30.0`（`vllm@ced6857a` + `vllm-ascend@c09d3e20`）源码：

| 核查环节 | 固定源码锚点（`v0.30.0` 主基线） |
| --- | --- |
| `EngineCore` 单步循环与时延指标定义 | `vllm@ced6857a:vllm/v1/engine/core.py#L589-L620`；`vllm@ced6857a:docs/design/metrics.md#L48-L81`[S1] |
| 统一进度差调度、分块校验与提示词长度拦截 | `vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L573`、`#L656-L706`、`#L1040-L1085`；`vllm/config/scheduler.py#L70-L122`、`#L274-L331`；`vllm/v1/engine/input_processor.py#L440-L486` |
| `AscendAttentionState` 构建与 `with_prefill` 标记 | `vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L154-L160`；`vllm_ascend/worker/model_runner_v1.py#L1320-L1325`、`#L1706-L1733` |
| `FULL_DECODE_ONLY` / `PIECEWISE` 派发与 `uniform_decode` | `vllm@ced6857a:vllm/config/compilation.py#L58-L88`；`vllm/v1/cudagraph_dispatcher.py#L235-L325`；`vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L3344-L3394` |
| `logits_indices` 末行切片与中间分块丢弃/随机数回拨 | `vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1476-L1489`、`#L1638-L1692`、`#L2633-L2646`、`#L3038-L3135` |
| `prompt_logprobs` 错位投影、缓存跳读与前缀块哈希 | `vllm@ced6857a:vllm/sampling_params.py#L540-L645`、`#L888-L899`；`vllm/v1/worker/gpu_model_runner.py#L5643-L5750`；`vllm/v1/core/kv_cache_manager.py#L245-L255`；`vllm/v1/core/kv_cache_utils.py#L600-L660` |
| HTTP 提示词概率流式校验、`echo` 派生与 `-9999.0` 夹断 | `vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L710-L852`；`completion/protocol.py#L358-L542`；`chat_completion/serving.py#L1168-L1292` |

**证据归档与待核边界。** 正文中 `Qwen3-8B`（`36` 层、`H=4096`、`V=151,936`、BF16 权重 `15.26 GiB ≈ 16.38 GB`、每 token KV `144.0 KiB`）在 `N=2048` / `M=1` / `M=12` 下的 `q_proj` 算术强度（`1024.0` / `1.00` / `11.93 FLOP/B`）、`288 MiB` 缓存体积、`[1, 151936] ≈ 0.58 MiB` 与 `[2048, 151936] ≈ 1.16 GiB` 分数体积，以及 `2048` 预算下 `2036 + 2036 + 1928` 的分块切分均由配置与张量形状静态展开[D]；末词命中停止条件少存 1 格 KV、MTP 剩余 `199` 词对应 `50..199` 步范围及前缀块完整身份条件均由执行规则严格推出[D]；Prefill 偏算力受限、Decode 偏带宽受限由形状与 Roofline 关系归纳得出[I]；单次理想读写权重模型与 6 词评分近似值（`0.233` / `-1.457`）为教学静态设定，不含实机 NPU 时延实测[A]。仍待实机补测项：特定昇腾机型上不同 `--max-num-batched-tokens` 下混合步对同批 Decode `ITL` 的实测抬升幅度、开启 `prompt_logprobs` 的额外 `TTFT` 与显存峰值，以及双机 GLM 部署下 MTP 的真实接受率分布。
