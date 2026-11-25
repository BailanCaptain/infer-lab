---
id: kv-cache
title: KV cache：新 token 留下历史，下一步接着读
type: concept
summary: >-
  KV cache 保存每一层为已处理位置算好的 K、V 等历史状态：新 token 只算自己这一份并按块追加，后续步骤直接读取，省去 O(t²)
  的整段重算；代价是线性占用显存、每步读取历史带宽以及分页空间管理。除标准 GQA 逐位置存 K、V 外，MLA 存压缩潜向量、稀疏注意力只读挑中位置、线性注意力原地更新固定大小状态。
aliases:
  - KV Cache
  - KV 缓存
  - 推理缓存
  - 历史状态
  - 键值缓存
  - kv cache
  - KV 显存
chapters:
  - '03'
sources:
  - 'https://arxiv.org/html/2309.06180v1'
  - 'https://arxiv.org/html/2405.04434v5'
  - 'https://huggingface.co/Qwen/Qwen3-8B/raw/main/config.json'
  - 'https://huggingface.co/Qwen/Qwen3-30B-A3B/raw/main/config.json'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L478-L555'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/attention.py#L538-L670'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L108-L124'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1170-L1204'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1318-L1381'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L143-L173'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L2020-L2039'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4699-L4701'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L6314-L6406'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L250-L385'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1613-L1670'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1874-L1895'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2834'
  - 'vllm@ced6857a:vllm/config/model.py#L2135-L2151'
  - 'vllm@ced6857a:vllm/config/cache.py#L39-L95'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L901-L943'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/cache_config.py#L1-L44'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/cache_config.py#L90-L148'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L96-L119'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_mamba_config.py#L120-L155'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L3072-L3112'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L113-L124'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L1251-L1286'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/device_op.py#L276-L306'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/attn_utils.py#L199-L235'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/cache_config.py#L41-L49'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L198-L269'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436'
  - 'vllm@0fc695fc:vllm/config/model.py#L1851-L1857'
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L325-L380'
  - 'vllm@0fc695fc:vllm/v1/attention/backend.py#L55-L66'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1430-L1454'
  - 'vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L47-L52'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_qwen3_dflash.py#L45-L59'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2515-L2553'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1553-L1570'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json'
  - 'https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L130-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L88-L160'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L664-L698'
  - 'raw:sha256-db0aa5f4bce49076d38bcfb2b8989e17e966c146a35d96e9f005c6f608e5b0a2.md#L1-L1317'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L570-L587'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L725-L744'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_c8_mxfp.py#L181-L192'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1444-L1515'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L55-L65'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L1889-L1899'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 缓存里保存的正是各层算出的 K 和 V；查询打分、加权汇合与因果掩码为什么保证旧 K/V 不变，在此基础上展开
  - to: gqa
    kind: builds-on
    note: 标准注意力每 token 每层的缓存字节数按 KV 头数计，GQA 减少 KV 头省下的正是这份容量与每步读取带宽
  - to: prefill
    kind: builds-on
    note: Prefill 建立提示词历史并产出首个生成词，Decode 每步在已有缓存上只补算新位置
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-2a28422539646c75979505776b955f43b90df34b9bea504dc8c318c36f21b2ed.md
  - >-
    raw/sha256-db0aa5f4bce49076d38bcfb2b8989e17e966c146a35d96e9f005c6f608e5b0a2.md
---

## KV cache 是什么？

**KV cache（KV 缓存）是生成模型跨步保留的历史状态：标准因果 attention 把每一层为已处理位置算好的 `k`、`v` 留在显存里，生成下一个 token 时直接读取，不必把旧位置重新过一遍模型。** 前半程先用标准 GQA 模型（`Qwen3-8B` 与 `Qwen3-30B-A3B`）把核心机制与容量账讲透；MLA 存压缩潜向量、稀疏注意力只读挑中位置、KDA 原地更新固定大小状态，放在后半程变体与混合模型章节逐一接上。

在[一次请求全景鸟瞰](request-overview.md)（以及端到端案例[一条请求的七站闭环](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)）的主线里，请求每次进入逐层前向之前都要先拿到缓存空间，算完这一步再更新有效进度、决定哪些空间继续保留或归还。

大模型写文本是一个 [token](token.md) 接一个 token 往外写的。请求先在 [prefill](prefill.md)（预填充）阶段读完用户提示词（prompt），选出第 1 个输出 token 接到末尾；随后进入 decode（解码）阶段，每步以整段已有文本为上下文生成下一个 token，循环直到结束。

每写一个词，最新位置都要做一次 [attention](attention-qkv.md)（注意力）：每个位置算出查询 `q`（拿去找别人的）、键 `k`（等着被找的）和值 `v`（被找到后交出的内容）。最新位置用自己的 `q` 和前面所有位置的 `k` 打分，再按权重把各位置的 `v` 加起来（见 [attention 逐步演算](attention-qkv.md#attention-怎么算跟着一个位置走一遍)）。关键事实只有一句：**新位置每一步都要用到前面所有位置的 `k` 和 `v`。**

而前面位置的 `k`、`v` 一旦算出就永远不会再变。沿用 attention 页的示意小例子（3 个提示词位置、每条向量 4 个数，数值为示意，机制真实）：第 1 步模型把位置 `0, 1, 2` 一起算完，每个位置在本层留下一行 `k`、一行 `v`，并采样出位置 `3` 的新词；第 2 步只有位置 `3` 是新的：

```wiki-diagram
file: kv-cache
```

第 2 步里，$k_0, k_1, k_2$ 和 $v_0, v_1, v_2$ 与第 1 步分毫不差。引擎只需为新位置 `3` 算出 $q_3, k_3, v_3$，把 $k_3, v_3$ 各追加成新的一行，再用 $q_3$ 对 4 行 `K` 打分、汇合 4 行 `V`。存这两张表的地方就是 **KV cache**。这里有三条定死缓存形态的铁律：

1. **为什么历史 $K_{0..t-1}, V_{0..t-1}$ 绝不会变？** 生成模型受[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)约束，每个位置只能看见自己和前面的位置：位置 `1` 在任意一层的隐藏表示与 $k_1, v_1$ 只由位置 `0..1` 决定，后面新接上的 token `t` 对历史零反向影响，读缓存与从头重算在数学上严格等价。
2. **为什么只存 `K`、`V`，不存 `Q`？** 查询只来自本步正在计算的新位置：$q_3$ 在第 2 步打完分使命即终结，后续步骤再也不会回头读取历史位置的 `q`。
3. **为什么每一层都必须各自存一份？** 模型由几十层堆叠而成，各层的 `k`、`v` 由该层自己的隐藏向量（见[层与隐藏表示](layers-and-hidden.md)）乘本层投影矩阵得到，层与层数值完全不同，因此每一层、每个历史位置都要存下属于本层的 `k` 和 `v`。

## 为什么需要 KV cache：不存的话要重算多少？

**不存的话，每生成一个新 token 都要把整段文本从头过一遍模型，前向计算量随输出长度按 $O(t^2)$ 平方爆炸；存了以后，每步只算新来的 1 个位置，前向计算量降为 $O(t)$ 线性增长。**

初学者常问：为什么不能只在需要时把旧位置的 `k`、`v` 投影重算一下？因为只有第 1 层的 `k`、`v` 直接来自词表查表向量（[embedding](embedding.md)）；第 2 层的输入依赖第 1 层算完注意力和前馈网络后的隐藏向量，第 3 层又依赖第 2 层，环环相扣。想重新拿到旧位置在每一层的 `k`、`v`，就必须把旧位置从第 1 层一路算到最后一层，相当于整段重跑前向。

把上面的 3 位置提示词例子接着走完，一共生成 4 个输出词。第 1 步整段处理提示词叫 [prefill](prefill.md)，后续每步送入 1 个新词往下接叫 decode。下图每行代表一步，每格代表一个序列位置：

```wiki-diagram
file: kv-cache-recompute
```

设提示词长度为 $P$、共生成 $G$ 个输出 token。由于第 $G$ 个输出词被采样出来后生成即告结束、不再送回模型跑下一轮前向，实际经历的 decode 步数为 $G - 1$ 步（这一步差在[后文](#已生成的-token为何还可能没有自己的缓存)还会再次遇到）。不存缓存与存缓存经过前向的位置总次数分别为：

$$N_{\text{no-cache}} = \sum_{k=0}^{G-1} (P + k) = G \cdot P + \frac{G(G - 1)}{2}, \qquad N_{\text{cached}} = P + (G - 1)$$

把上图小例子、短提示词生成 `200` 词（同主线[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署) 的长度设定，此处按普通逐词生成计数）与常见长对话放在一起对照：

| 序列设定 | 前向总步数（`1` 步 prefill + `G - 1` 步 decode） | 不存缓存的位置前向次数 $N_{\text{no-cache}}$ | 存缓存的位置前向次数 $N_{\text{cached}}$ | 位置前向比值 |
| --- | --- | --- | --- | --- |
| 图示小算例（`P = 3, G = 4`，示意） | `1 + 3 = 4` 步 | `3 + 4 + 5 + 6 = 18` 个位置次 | `3 + 1 + 1 + 1 = 6` 个位置次 | **`3×`** |
| 短输入长答（`P = 4, G = 200`） | `1 + 199 = 200` 步 | `200 × 4 + 19,900 = 20,700` 个位置次 | `4 + 199 = 203` 个位置次 | **`≈ 102×`** |
| 常规长回答（`P = 512, G = 2,048`，示意） | `1 + 2,047 = 2,048` 步 | `1,048,576 + 2,096,128 = 3,144,704` 个位置次 | `512 + 2,047 = 2,559` 个位置次 | **`≈ 1,229×`** |

注意表末的 `102×` 或 `1,229×` 是**经过前向的位置次数之比**，不能直接等同于端到端墙钟加速比：prefill 一次算整批位置属于矩阵乘矩阵，而 decode 每步单序列只算 1 个位置、还要读取全部历史缓存，两者的矩阵形状、访存带宽占比与硬件算力利用率完全不同。

## 存一份要多少？从一个位置、一层往上乘

**标准注意力的 KV cache 容量 = 单位置单层元素数 × 模型层数 × 缓存位置数 × 单元素字节数。** 先从最小单元一层层往上乘，建立空间直觉：

```wiki-diagram
file: kv-cache-size
```

顺着上图的示意小尺寸（每层 1 组 `k`、`v` 各 `4` 个数，共 `3` 层，BF16 每数 `2 B`）心算一遍：1 个位置在 1 层存 `4 + 4 = 8` 个数，跨 `3` 层存 `24` 个数。生成 4 个输出后缓存里存着位置 `0..5` 共 `6` 个位置，总计 `24 × 6 = 144` 个数，折合 `144 × 2 B = 288 B`。

### 多个 KV 头与 Qwen3 标准模型实算

真实大模型的一层注意力会并排拆成多个头（见[多头注意力](attention-qkv.md#多头同一个位置同时按几套方式去读)），并普遍采用 [GQA](gqa.md#缓存容量按-kv-头数计算) 让多个查询头共享同一组 KV 头。设模型总层数为 $L$、总 KV 头数为 $n_{\text{kv}}$、张量并行卡数为 $T$、每头维度为 $d_h$、缓存数值字节数为 $b_{\text{dtype}}$（BF16/FP16 为 `2 B`，INT8/FP8 主体为 `1 B`）。上游 `FullAttentionSpec` 对应的每卡每 token 单层与全模型缓存字节数为：

$$\text{Bytes}_{\text{tok, layer}} = 2 \times \max\!\left(1, \frac{n_{\text{kv}}}{T}\right) \times d_h \times b_{\text{dtype}}, \qquad \text{Bytes}_{\text{tok, model}} = L \times \text{Bytes}_{\text{tok, layer}}$$

> **边界与例外（TP > n_kv 跨卡复制）**：当 $T \le n_{\text{kv}}$ 时，每卡均分 $n_{\text{kv}} / T$ 个 KV 头；当 $T > n_{\text{kv}}$ 时跨卡复制，每卡保底存 `1` 个头。例如 $n_{\text{kv}} = 4$ 的 `Qwen3-30B-A3B` 在 `TP = 8` 下每卡仍驻留 `1` 个头（即 `24 KiB/tok`），不会减半至 `12 KiB/tok`。

公式最前面的系数 `2` 对应 `K` 和 `V` 两张表。作为心算参照，常见 32 层、`8` 个 KV 头、`128` 维的 BF16 模型每词占 `128 KiB`，`4K` 占 `512 MiB`，`16` 条并发占 `8 GiB`。下面统一落到 `v0.30.0` 主基线的两款真实预设模型 [Qwen3-8B 与 Qwen3-30B-A3B](hf-model-anatomy.md)：

```wiki-diagram
file: kv-cache-fig-qwen3-scaling
```

按 `1 KiB = 1,024 B`、`1 MiB = 1,024 KiB`、`1 GiB = 1,024 MiB` 精确核算两款模型从单词到 `B = 32` 长上下文批次的显存账：

| 核算尺度 | `Qwen3-8B`（稠密 GQA，`TP = 1`） | `Qwen3-30B-A3B`（稀疏 MoE，整模口径） | `Qwen3-30B-A3B`（`TP = 4` 每卡口径） |
| --- | --- | --- | --- |
| 结构参数（$L$ / $n_q$ / $n_{\text{kv}}$ / $d_h$） | `36` 层 / `32` Q 头 / `8` KV 头 / `128` | `48` 层 / `32` Q 头 / `4` KV 头 / `128`（`128` 专家） | 每卡分担 `4 ÷ 4 = 1` 个 KV 头 |
| **1 token 单层 / 全模型（BF16 `2 B`）** | `4,096 B`（`4 KiB`）/ **`147,456 B`（`144 KiB`）** | `2,048 B`（`2 KiB`）/ **`98,304 B`（`96 KiB`）** | `512 B` / **`24 KiB / 卡`** |
| 单序列 `4K`（`4,096` tok，BF16） | **`576 MiB`** | **`384 MiB`** | **`96 MiB / 卡`** |
| 单序列 `32K`（`32,768` tok，BF16） | **`4.5 GiB`** | **`3.0 GiB`** | **`0.75 GiB / 卡`** |
| `B = 32` 并发 × `32K`（BF16） | **`144 GiB`**（单卡 `64 GiB` 根本装不下） | **`96 GiB`** | **`24 GiB / 卡`** |
| `C8`（INT8 8 比特 KV 量化，`1 B` 主体理想压缩值 `0.5×`） | `72 KiB/tok`；`B=32×32K` 理想值 **`72 GiB`** | `48 KiB/tok`；`B=32×32K` 理想值 **`48 GiB`** | `12 KiB/tok`；`B=32×32K` 理想值 **`12 GiB / 卡`** |

这张表把三个工程真相直接摆在台面上：

- **GQA 砍的是 KV 头数**：若 `Qwen3-8B` 不用 4:1 GQA 而存满 `32` 个 KV 头（MHA），单词立刻翻 4 倍至 `576 KiB`，单条 `32K` 序列就会吃掉 `18 GiB`。
- **KV 容量只看注意力层与 KV 头，不看总参数量**：`Qwen3-30B-A3B` 虽有 `30.5B` 参数和 `48` 层，但 `128` 个路由专家只占权重、不占逐词 KV。由于 $n_{\text{kv}} = 4$ 减半，整模每词反而比 `8B` 省三分之一（`96 KiB` vs `144 KiB`）。
- **`C8` 量化压低主存储字节**：当长上下文乘上高并发导致 BF16 缓存冲破百 GiB 时，昇腾 `C8` [KV cache 量化](kv-cache-quantization.md)可将主 K/V 从 `2 B` 压向 `1 B`。表中 `72 / 48 KiB/tok`（及 `B = 32 × 32K` 下的 `72 / 48 GiB`）是按 **`1 B` 主体计算的理想压缩值**。

> **边界与例外（`INT8 C8` 与 `MXFP8` 落地门槛）**：
> - **`INT8 C8`（A2 / A3 / 950 GQA 模型）**：必须配对经 ModelSlim `C8` 校准导出的量化检查点，同时满足 `--quantization ascend`、`quant_model_description.json` 声明 `"kv_cache_type": "C8"` 与 `--kv-cache-dtype int8`。对纯 BF16 权重单独传 `--kv-cache-dtype int8` 会在启动期直接抛 `ValueError`。
> - **`MXFP8`（`--kv-cache-dtype mxfp8`，即 `C8_MXFP`）**：要求 Ascend 950（`A5`）与 `512` token 整数倍 `block_size`，另加 `+1/32` 字节的 `E8M0` 缩放因子（约 `1.03125 B/数`，单词实际约 `74.25 / 49.5 KiB`）。

```wiki-tool
tool: formula-ruler
mode: kv-token-bytes
model: qwen3-8b
title: 随文活体算例标尺 · 单词与分块 KV 容量
summary: 切换模型预设、昇腾卡型、TP 并行度或自定义 config.json，实时换算单层/全层每 token 字节数、128-token 物理块大小与可用 KV 池容量。
```

## 省了重算，要付什么代价？

**KV cache 拿空间和访存换计算：省掉的是旧位置 $O(t^2)$ 的整趟前向重算，多付的是常驻占用的显存、每步解码读取历史的带宽，以及分页空间管理的开销。**

1. **代价一：历史状态一直占住 HBM 显存。** 缓存容量随序列长度和在途并发数线性增长。推理引擎不会每步向驱动临时要显存，而是在 Worker 启动期做峰值探测（见 [NPUWorker 启动时序](npu-worker-lifecycle.md) 与 [KV cache 显存预算](kv-cache-memory-profiling.md)），扣掉权重与激活峰值后把余量一次性切成固定缓存池；池满时新请求只能排队或抢占在途请求。想省在线显存可用 [KV cache 量化](kv-cache-quantization.md)或外置到 [KV Pool](kv-pool.md)；而 [KV cache CPU 卸载](kv-cache-cpu-offload.md)把收回的块暂存主机内存，省的是再次调度时的重算，而非在线显存。
2. **代价二：省掉的是重算，不是每步读取。** Decode 阶段新位置仍要对全部可见历史打分汇合：历史有 `1,000` 个位置，标准注意力每层每步就从 HBM 读 `1,000` 行 `K` 和 `1,000` 行 `V`。到 `Qwen3-8B` 单序列 `32K` 上下文时，仅解码 1 个新词就要通读整整 `4.5 GiB` 缓存，使 decode 彻底落入显存带宽受限区。想砍掉读取流量，要靠[稀疏注意力](sparse-attention.md)（只读打分挑中的子集）或[线性注意力](linear-attention.md)（原地读写定长状态矩阵）。
3. **代价三：空间必须按块精细调度。** 引擎必须追踪每条请求算到哪一格、借了哪些块，以及池满时谁等待、谁抢占。三个相邻概念分工明确：**KV cache** 是状态数据本体；**[block table](block-table.md)** 是把逻辑位置翻译成物理块号的地址表；**[prefix caching](prefix-caching.md)** 是把写满的公共前缀块借给其他请求共读的复用机制。即便关闭跨请求 prefix caching，同一条请求在 decode 期间照样每步读取自己的 KV cache。

## 缓存按块存放：一个位置的 k、v 写进哪一格？

**推理引擎不给每条请求预留大段连续显存，而是通过 [PagedAttention](paged-attention.md) 把缓存池切成固定长度（`block_size`）的物理块按需借还。** 每条请求用一张整数[块表（block table）](block-table.md)记录「第几个逻辑块落在池里第几号物理块」，彻底消除块间外部碎片，把未写满的空白严格关在最后一块里，归还的块也能立刻借给别的请求。

给定序列内的逻辑位置 $p$ 与块长 $B$，写入哪一格（槽位 `slot`）只需一次整除取余加一次查表：

$$b_{\text{logical}} = \left\lfloor \frac{p}{B} \right\rfloor, \qquad o = p \bmod B, \qquad \text{slot} = \text{BlockTable}[b_{\text{logical}}] \times B + o$$

下图用一条 `12` 个位置的请求、每块 $B = 4$ 个位置（示意）走完位置 $p = 6$ 查到槽位 `10` 的全过程（池中 `块 0` 永久留作占位 `null_block`，不发给普通写入）：

```wiki-diagram
file: block-table
```

**空间启动建好，前向按槽写入。** 标准注意力每层在启动时一次性分配缓存张量：`AscendAttentionBackend.get_kv_cache_shape` 默认形状为 `(2, num_blocks, block_size, num_kv_heads, head_size)`。当环境变量 `VLLM_KV_CACHE_LAYOUT` 设为 `LBHNC` 或 `HND` 时，块内位置轴与头轴对调为 `(2, num_blocks, num_kv_heads, block_size, head_size)`——两者元素总数相同，但轴序互不兼容，算子必须按实际布局读取。

每步前向算到本层时，昇腾后端因声明 `forward_includes_kv_cache_update = True`，上游 `Attention` 跳过外部写入，交由后端 `reshape_and_cache` 按 `slot_mapping` 调用 `DeviceOperator.reshape_and_cache` 把新算出的 `k`、`v` 散射进对应槽位。其中 A2/A3/A5 主力路径下发 `torch_npu.npu_scatter_pa_kv_cache`，`310P` 适配器下发 `torch_npu._npu_reshape_and_cache`。算子随即在同一次前向里跨块读取历史完成注意力计算；请求结束时只把块号挂回空闲队列，设备上的大张量纹丝不动。

**占住的物理槽位与已写入的数据量要分开算。** 物理块按整块借出，最后一块没写满的空槽位在归还前也归该请求独占。以写入 `6` 个位置为例对照不同块长：

| 块长设定 $B$ | 借用块数 $\lceil 6 / B \rceil$ | 实际占住槽位数 | 已写数据利用率 | 工程含义 |
| --- | --- | --- | --- | --- |
| `B = 4`（小图示意） | `2` 块 | `2 × 4 = 8` 格 | `6 ÷ 8 = 75.0%` | 仅空 `2` 格，但块表极长 |
| `B = 16`（上游 GPU 早期默认） | `1` 块 | `1 × 16 = 16` 格 | `6 ÷ 16 = 37.5%` | 空 `10` 格 |
| `B = 128`（昇腾 NPU 标准默认） | `1` 块 | `1 × 128 = 128` 格 | `6 ÷ 128 ≈ 4.7%` | 契合 NPU 突发 DMA（直接内存访问搬运），超短请求末块空余占比高 |

块号借还与抢占细节见[缓存块分配](vllm-kv-block-allocation.md)，每块字节规格见[缓存规格](kv-cache-spec.md)；想直观观察新 K/V 写入、前缀零拷贝共指与释放复用，可播放交互场景[块表中的缓存生命周期](block-table.md#scene-inference-mechanism-1)。

## 已生成的 token，为何还可能没有自己的缓存？

**一个输出 token 在本步末尾被采样出来，要等下一步作为输入送进模型跑前向时，才会写下它自己的 `k`、`v`。** 下图把 `3` 词提示词 + `4` 词输出的 `7` 格文本与 `6` 格有效缓存对齐，并列出另外三类会让文本总长（`all_token_ids`）与已算进度（`num_computed_tokens`）错开的调度时刻：

```wiki-diagram
file: kv-cache-fig-computed-vs-text
```

同理，短输入长答（提示词 `4` 个词、生成 `200` 个输出）结束时，完整文本有 **`204` 个 token**，缓存里真正写入状态的只有 **`203` 个位置**。真实调度器（`Scheduler` 与 `KVCacheManager`）里四类错位时刻的账本处理汇总如下：

| 典型运行时刻 | 文本或候选进展 | 缓存真实状态 | 调度器账本处理 |
| --- | --- | --- | --- |
| **刚采样出新词 / 末词结束** | 已追加最新输出词 | 该词尚未跑过前向，**无自身 KV 槽位数据** | 下一步作为输入调度时补写；若已结束则直接释放块 |
| **[分块预填充](chunked-prefill.md)** | 长 prompt 已完整入队 | 仅前几块已算完，后半段未进前向 | `num_computed_tokens` 停在已算分块边界，后续步续算 |
| **[Prefix caching](prefix-caching.md) 命中** | 前缀与历史块哈希一致 | 直接挂接旧满块，免重算；全命中上限限为 `num_tokens - 1` | 至少留最后 1 个词（按块对齐时可能整块）重算以产出 `logits` |
| **[投机解码](speculative-decoding.md)草稿 / 抢占重算** | 草稿猜出多个候选词送验 | 被拒候选虽写过槽位但作废；被抢占请求块号已收回 | 验证后回退 `num_computed_tokens` 下步覆写；抢占恢复时重借块重算 |

## 不是每种 attention 都存完整的 K、V

**前文核算的是标准多头/分组查询注意力：每层、每个 KV 头、每个位置各存一条 `k` 和一条 `v`（且带 [RoPE](rope.md#在推理引擎里旋转发生在哪一步) 的模型会在写进缓存前先把 `k` 按位置旋转好，后续读出即用，无需每步重转）。** 为了进一步压低显存占用或每步读取带宽，现代模型衍生出多类注意力变体；推理框架把这些跨步保留的状态统称为 KV cache，统一纳入同一个块池管理（定量对比见[四种注意力的代价](attention-cost.md)与[缓存规格](kv-cache-spec.md)）：

| 机制与对应规格 | 缓存里实际存什么 | 容量随长度 $t$ | 单步读取随长度 $t$ | 核心取舍与边界 |
| --- | --- | --- | --- | --- |
| **标准 [GQA](gqa.md)**（`FullAttentionSpec`） | 每组共享 KV 头的完整 `k`、`v` | $O(t)$ 线性增长 | 通读全部 $t$ 个位置 | 结构简单通用，长序列受限于容量与读取带宽 |
| **压缩 [MLA](mla.md)**（`MLAAttentionSpec`） | `k`、`v` 联合压缩的短潜向量（加可选 RoPE 段；部分配置设宽度为 `0`） | $O(t)$，但单位置大幅变窄 | 通读压缩潜向量 | 解压矩阵可吸收进查询与输出投影，免展开完整多头 K/V |
| **[稀疏注意力](sparse-attention.md) / SWA** | 稀疏 MLA 存全量潜向量与压缩索引 K；滑窗 SWA（Sliding Window Attention，滑动窗口注意力）可只留近期窗口 | 稀疏 MLA 为 $O(t)$；纯 SWA 有界 | 仅读 `top-k` 挑中位置或窗口内位置 | 稀疏 MLA 省读取不省主存；长历史命中但滑窗已淘汰时需走 [SWA 有界回放](swa-bounded-replay.md) |
| **[线性注意力](linear-attention.md)**（KDA / GDN，`MambaSpec`） | 固定形状的递推矩阵状态 + 最近几个位置的短卷积状态 | **$O(1)$ 恒定大小** | **$O(1)$ 原地读写** | 长文本极省，但回退与跨请求任意切点复用受状态边界限制 |
| **跨层共享**（`kv_sharing_target_layer_name`） | 消费层**不建缓存**，直接共指前序目标层的 `K`、`V` | 共享层增量为 `0` | 读目标层同一份缓存 | 缓存管理器跳过消费层规格，前向写入入口拦截防误覆写 |

## 延伸实例：混合模型（GLM-5.3-Flash）里的多态缓存闭环

上文先用标准 GQA 模型（`Qwen3`）算清了纯按位置增长的缓存账；一旦换成把线性注意力、稀疏压缩注意力和 MTP 草稿层混在同一个块池里的架构，单块页大小和状态回退就会立体重叠。下面用双机 16 卡的 `GLM-5.3-Flash` 完整走一遍这套多态闭环。

> **案例基线说明：** 本节数字专属于双机 16 卡（`TP8 / DP2 / EP16`、开启模型自带草稿层 MTP 一次猜 `3` 个候选）的历史绑定案例 `GLM-5.3-Flash`（控制流 `vllm@0fc695fc` + 执行侧 `vllm-ascend@db701c1f`，部署前提见 [GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)，七站主线见 [一条请求](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)），不与前文 `v0.30.0` `Qwen3` 标尺混算。

### 混合模型到底要保留哪几类状态？

**`GLM-5.3-Flash` 同时把两类截然不同的历史装进同一个缓存池**：主干 `45` 层含 `34` 层 KDA（按请求存定长状态）与 `11` 层稀疏 MLA（按位置追加历史），接在主干后的第 `45` 号 MTP 层同样是带 indexer 的稀疏 MLA，因此按位置增长的共 `12` 层。每层稀疏 MLA 除存潜向量外，还由 indexer 每 `4` 个相邻位置合并（kpool）留一条池 K，并用尾状态暂存尚未凑满 `4` 个的最新位置（KDA 形状推导见[一条请求的 KDA 一节](one-request.md#34-层-kda)）：

| 状态对象 | 所在层数 | 保存内容与精度 | 本部署每卡大小 |
| --- | --- | --- | --- |
| **MLA 潜向量** | `12` 层 MLA | 每位置 1 条 `512` 维潜向量（RoPE 段宽为 `0`），BF16 | `1,024 B / token / 层`（随长度增长） |
| **indexer 缓存** | 同上 | 每 `4` 个位置按门控加权合成 1 条 `128` 维池 K（无 RoPE），BF16 | `256 B / 池`，折合 `64 B / token / 层` |
| **indexer 尾状态** | 同上 | 未凑满一池的最近位置 K 与门控分数，FP32 | `4,096 B / 请求 / 层`（不随长度增长） |
| **KDA 递推状态** | `34` 层 KDA | 本卡分担的 `8` 个头各一个 `128 × 128` 矩阵，FP32 | `524,288 B / 请求 / 层` |
| **KDA 卷积状态** | 同上 | 短卷积最近 `3` 个位置外加 `3` 个候选槽位，BF16 | `36,864 B / 请求 / 层` |

按位置增长与按请求定长的两组缓存账单拆开看最清晰：

- **按位置增长项（MLA 潜向量 + indexer 池 K）**：`12` 层合计 **`13,056 B`（`12.75 KiB`）/ token / 卡**（见[部署页块字节](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）。满长 `133,120` token 时每卡约 `1.619 GiB`，一个 `640` 格逻辑块装满为 `8,355,840 B`。
- **按请求定长项与物理页补齐**：`12` 层尾状态有效容量合计 `48 KiB`（按 `4` token 一块分配，R1 首步拿 `2` 块）。KDA 两份有效状态每层 `561,152 B`（`34` 层约 `18.2 MiB`），为与 MLA 共用同尺寸物理页需补齐到 `655,360 B/页`，再为 MTP 的 `3` 个候选各多留 1 页（每请求 `4` 页）。由此 **`34` 层 KDA 页子账达约 `85 MiB / 请求 / 卡`**，折合 `≈ 6,827` 个 token 的按位置历史（整块计费还含同块号下未用的大小页槽位，预算推导见[部署页缓存预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）。
- **`5` 个缓存组与对齐边界**：调度器将上述状态划为 `5` 个缓存组——MLA 与 indexer 共属 `full` 组（`640` tok/块），`34` 层 KDA 分 `3` 组（每请求 `4` 块），尾状态单独 `1` 组（`4` tok/块）。恢复或跨请求复用时，五类状态必须停在同一有效边界上。

### 每步读多少：稀疏 MLA 只读挑中的位置

**`GLM-5.3-Flash` 的稀疏 MLA 先由 indexer 扫过全部池 K（每条 `256 B`）打分，每个查询位置最多只读 `2,051` 个历史位置**：选中的 `512` 个池展开为 `2,048` 个位置，外加至多 `3` 个未凑满一池的最新位置；满长 `133,120` token 下仅占全部历史的约 `1/65`。

R1 开启 MTP 验证「`1` 个确定词 + `3` 个候选」时单步有 `4` 个查询位置，读取上限按每个查询位置分别计算（见 [MLA 稀疏选择](mla.md#稀疏选择是压缩之上的另一层机制)）。`34` 层 KDA 则每步原地读写定长状态，流量不随历史增长。

### 双尺度分块、跨卡归属与状态闭环

在这套部署里，`EngineCore` 在 CPU 侧按 **`640` token 的逻辑块**分配块号，稀疏注意力算子则按 **`128` token 的 kernel 块**读取，`1` 个逻辑块恰好拆成 `5` 个连续的 `128` 块（见[为什么逻辑块是 640](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)、[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)与[分配块与内核页](block-table.md#分配块与内核页可能不同)）。按权重 `21 GiB` 计，每卡缓存池切成 **`3,855` 块**（每块约 `7.969 MiB`）；若仅扣语言权重子账、未扣视觉塔等项则为 `3,908` 块（见[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)）。

落到示例请求 `R1`（分在 `DP0` 所在机器的 8 个 Worker，另一台机器在 MoE 层跨机算专家时拿不到 `R1` 的缓存），跨卡归属与全生命周期如下：

- **机内跨卡归属**：MLA 潜向量与无 [RoPE](mla.md#glm-的这一配置不保存-rope-段) 的 indexer K 在机内 `TP8` 间整份复制、卡内直写零跨卡通信（输出投影后的 All-Reduce 属[层计算](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)）。KDA 按头切分，每卡管 `8` 个头并原地更新[短卷积与递推矩阵](linear-attention.md#矩阵状态之外还有短卷积历史)；层间[隐藏向量与四路残差](layers-and-hidden.md#本轮-hidden历史状态和权重各管什么)用完即释，不进缓存。
- **首步占块与满长上限**：`R1` 首步申请 `15` 个块号（约 `119.5 MiB/卡`），decode 期持有 `16–17` 块并在结束时一次还清（见[缓存块分配](vllm-kv-block-allocation.md#结束1617-块一次还清)）。`4` 个位置在 `11` 层主干与[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)首遍 MTP 草拟共写入 **`52,224 B`（约 `51 KiB`）** 按位置数据（`640` 格块利用率仅 `0.6%`，见[一次前向的通信账](one-request.md#一次前向的通信账)），同时原地改写 KDA 与尾状态。满长 `133,120` 请求需约 `222` 块（`1.728 GiB/卡`），静态除 `3,855` 上限为 `17` 条。
- **A6 验稿回退**：到 [A6 验证更新](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)时，被拒候选在 MLA 中回退进度计数、下步原地覆盖；在 KDA 中则直接选出对应接受数的候选页续算，并弃用其余页（调用与补丁边界见[请求调用链](request-call-chain.md)、[配置系统](ascend-config-system.md)与 [patch 系统](ascend-patch-system.md)）：

```wiki-diagram
file: kv-cache-lifecycle
```

## 常见误解

```wiki-diagram
file: kv-cache-fig-myths
```

- **“KV cache 是为了省显存，缓存的是 token 编号或词向量。”** 全反了：它是**拿显存换计算**，多占 HBM 换取每步只算新位置；量化与卸载才是在占住显存后设法省空间。缓存里存的也不是输入 token 编号或 [embedding](embedding.md)，而是各层注意力算出的历史状态（如 `GLM` 在 `12` 层 MLA 各留互不相同的潜向量，在 `34` 层 KDA 融进定长矩阵不再逐词可查）。
- **“文本已有 $N$ 个词，缓存里就一定有 $N$ 个位置的状态；模型有几层，每个词就存几层。”** 刚采样出的最新输出词要到下一步进前向才写缓存，分块预填充未算完时差额还会更大；混合模型里也只有按位置追加的注意力层随长度增长，KDA 等线性层与长度无关。
- **“TP 卡数翻倍，每卡缓存一定减半；有了缓存就不用再读旧内容。”** 标准注意力仅当 $T \le n_{\text{kv}}$ 时按头均分，超出则跨卡复制（`GLM` 的 MLA 潜向量更在 `TP8` 内整份复制）；且缓存省的是重算，标准注意力每步仍需通读历史。
- **“开了缓存，生成结果会和从头重算不一样。”** 数学上严格等价；工程上 prefill 与 decode 可能走分块与逐词两套算子，浮点累加顺序差异偶尔在临界处改变采样结果（原因在计算顺序而非缓存丢信息，判别与固定方法见[批不变性](batch-invariance.md#为什么末位会跟着批变同一个和分几份来加)）。
- **“关闭 prefix caching 就没有 KV cache；文本以前出现过就必免全部计算；请求结束会清零显存池。”** 同请求跨步缓存常驻开启，`--enable-prefix-caching` 只管跨请求共享（见 [prefix caching](prefix-caching.md)）。即便前缀全命中，上限也锁在 `num_tokens - 1`，至少重算末词（按块对齐时可能重算整块）以取 `logits`；请求结束只释放块引用，HBM 数值原地留待复用或覆写（见 [block table](block-table.md) 与 [CPU 卸载](kv-cache-cpu-offload.md)）。

## 对照源码

### 怎么开与会报什么错

同请求跨步 KV cache 常驻开启，无需开关。跨请求复用由 `--enable-prefix-caching` 控制（`v0.30.0` 对生成类 hybrid 模型默认开启）；缓存精度由 `--kv-cache-dtype`（`CacheConfig.cache_dtype`）控制，不能凭权重量化 W8A8 推断缓存也为 INT8：在 `v0.30.0`（`c09d3e20`）中，GQA 模型的 `--kv-cache-dtype int8` 必须搭配 `--quantization ascend` 与含 `"kv_cache_type": "C8"` 的 ModelSlim 校准权重（`modelslim_config.py#L725-L744`），`--kv-cache-dtype mxfp8`（`C8_MXFP`）要求 Ascend 950（`A5`）、`512` 整数倍 `block_size` 并计入 `+1/32` `E8M0` 缩放字节[C55]，稀疏模型另设 SFA `C8` 与 `turboquant_4bit_nc` 开关；而在历史 `db701c1f` 案例中 `IndexerKPoolMLACacheLayer` 主缓存写死为 `bfloat16`[C44]。逻辑块长在常规模型上默认定为 `128`（`C8_MXFP` 默认抬至 `512`）；在 `GLM-5` 混合模型上，**历史 `db701c1f`** 仅按 `128` 整数倍向上取整至 `640`（无 `lcm` 对齐，`patch_mamba_config.py#L131-L159`），而 **`v0.30.0`（`c09d3e20`）** 的 `patch_mamba_config.py` 按 `lcm(128, index_kpool * 16)` 对齐至 `640`，且在启用紧凑打包 `SFA C8`（`sfa_c8_packed`）时通过 `min(attn_block_size, c8_block_size)` 将更大请求块长封顶压回 `640`（`patch_mamba_config.py#L127-L136`）以避免跨块空洞。

常见配置与运行报错须区分两套版本路径：在 **`v0.30.0`（`c09d3e20`）** 中，GQA 模型对无 `C8` 校准配方的纯 BF16 权重单传 `--kv-cache-dtype int8` 直接抛 `ValueError`[C53]；`C8_MXFP` 手动指定非 `512` 整数倍 `--block-size` 抛 `ValueError`（`utils.py#L1509-L1515`）；开启 `enable_kv_nz` 但非 MLA、含稀疏或非 PD 解码节点时抛 `RuntimeError` / `NotImplementedError`[C20]；`models/glm5next/cache_config.py` 缺少主 MLA、压缩索引或 `indexer_tail` 规格、层号不匹配或主/索引逻辑块长不一致时抛 `ValueError`。而在 **历史 `db701c1f`（`GLM-5.3-Flash` 绑定案例）** 中，缺少 `cache_config`、三类缓存角色顺序与 `("kv", "indexer_state", "indexer")` 元组不符（`indexer_kpool_mla_v1.py#L818-L830`）、KDA 状态批大小不一致或逻辑块非 `128` 整数倍时直接报错阻断。遇到此类报错应先核对版本配置与分组映射，不能单靠调大显存解决。

### 开销和什么时候别开

同请求缓存是自回归解码的前提；需权衡收益的是跨请求 prefix caching（适合高重复前缀且各缓存组边界可对齐的负载）、CPU 卸载（拿主机搬运带宽换显存）与投机候选预留（多占状态槽位换多词接受率）。手动调大 `--block-size` 会放大末块空余与混合模型状态页补齐开销（补齐细账见 [KV cache 规格](kv-cache-spec.md#开销和什么时候别开)，量化选择见 [KV 量化](kv-cache-quantization.md#版本差异)）。

### 版本差异

固定对照提交依次为：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`）、`v0.26.0rc`（`568afb3a` / `2ed6cbba`）、**`v0.30.0` 主基线（`ced6857a` / `c09d3e20`）**与 **`main`（`ba15685a` / `8d6180e2`）**；正文中 `GLM-5.3-Flash` 历史绑定案例单独对应专用提交 `db701c1f`（控制流 `0fc695fc`）。

| 核对维度 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) | 对使用者的实际影响 |
| --- | --- | --- | --- | --- | --- |
| 普通注意力缓存张量形状 | `(2, num_blocks, block_size, num_kv_heads, head_size)` | 同左 | 默认同左；`VLLM_KV_CACHE_LAYOUT` 取 `LBHNC`/`HND` 时头轴移至块内位置轴前[C7] | 同 `v0.30.0` | 换轴不改元素总数，读取算子须认准布局轴序 |
| 普通注意力前向写缓存 | `reshape_and_cache` 调 `torch_npu._npu_reshape_and_cache` | 标准路径已切至 `torch_npu.npu_scatter_pa_kv_cache`[C57]，仅 `310P` 保留 `_npu_reshape_and_cache`（`device_op.py#L1889-L1899`） | 标准路径调 `npu_scatter_pa_kv_cache`[C10]，`310P` 调 `_npu_reshape_and_cache`[C11]，PCP 独立整理后写入[C9] | 延续 `npu_scatter_pa_kv_cache` 与 `310P` 分流 | 均在单次前向内完成写与读；独立 `do_kv_cache_update` 仅服务特殊补丁 |
| 跨层 KV 共享保护 | 共享层不建规格、张量共指目标层；`reshape_and_cache` 未拦截写入[C37] | 写入前检查 `kv_sharing_target_layer_name` 直接返回 | `model_runner_v1` 跳过建规格[C13]，写入前拦截并为 producer 记录缓存事件[C8] | 迁入 `worker/v2/attn_utils.py` 跳过建规格[C29]，写入拦截同左 | 仅影响声明跨层共享的模型；`GLM` 未声明跨层共享 |
| Hybrid 模型 `enable_prefix_caching` | `is_prefix_caching_supported` 返回 `False`，默认关 | 支持开启，但默认仍关 | 生成类 hybrid 模型未显式传参时默认开[C17] | 同 `v0.30.0` | 仍须结合具体模型的 `patch_mamba_config` 与有效配置核对 |
| `GLM-5.3-Flash` 缓存与量化路径 | `2c59ff10` 无该模型；本文历史案例取自专用 `db701c1f`[C50] | `2ed6cbba` 无该模型 | `models/glm5next/`：主历史与索引共块号、尾状态独立，分大小两类物理页[C22]，支持 SFA `C8` | 延续 `glm5next/` 并在 `_Glm5NextCacheLayout` 拆出 `draft_groups` | 历史 `15` 块与字节账保留 `db701c1f` 前提，升级 `v0.30.0+` 按新规格核计 |

### 源码位置

- **原理与官方材料**：PagedAttention 论文定义跨步历史复用、逻辑到物理块映射及按需分配[S1]；DeepSeek-V2 论文给出 MLA 潜向量联合压缩[S2]；`GLM-5.3-Flash` 双机并行与 MTP 设定见官方教程[S43]。
- **标准注意力规格、形状与写入**：上游 `AttentionSpec` / `FullAttentionSpec` 定义 `state_content_size_bytes` 与 `page_size_bytes`[C5]；`Attention` 因后端 `forward_includes_kv_cache_update = True` 跳过外部更新并产出 `FullAttentionSpec`[C6]；昇腾 `AscendAttentionBackend` 定义缓存轴序、`reshape_and_cache` 槽位写入与 `C8 INT8` 量化通道，底层由 `DeviceOperator` 分发至 `npu_scatter_pa_kv_cache` 或 `_npu_reshape_and_cache`（独立 `do_kv_cache_update` 仅在如 Qwen3 DFlash 补丁等路径单独调用）。
- **前缀命中上限、槽位分配与跨层共享**：`KVCacheManager.get_computed_blocks` 将全命中上限锁在 `request.num_tokens - 1` 并配合块对齐 `allocate_slots`[C14]；`NPUModelRunner`（及 `main` 的 `v2/attn_utils.py`）跳过跨层共享目标规格。
- **数值推导与边界口径**：前文 3 位置 / 4 维与 `B = 4` 分块为便于手算的教学示意设定[A]；位置前向次数比值公式、`Qwen3-8B`（`144 KiB/tok`、`32K` 占 `4.5 GiB`、`B=32` 占 `144 GiB` 及 `C8` `1 B` 主体理想值 `72 GiB`，`MXFP8` 另加 `+1/32` `E8M0` 缩放即 `1.03125 B/数`）[D]与 `Qwen3-30B-A3B`（整模 `96 KiB/tok`、`TP=4` 与 `TP=8` 复制下每卡均为 `24 KiB/tok`）[D]，以及历史案例 `13,056 B/tok`、`85 MiB` KDA 子账与 `2,051` 读取上限[D]均由模型 `config.json` 与源码公式严格推出（整块计费含大小两类槽位之和）；长上下文 Decode 受显存读取带宽主导由单步全历史读取量与算术强度归纳得出[I]，`B = 32` 并发规模为典型压力对照设定[A]。

待核：历史 `db701c1f` 镜像最终安装的上游提交哈希、线上缓存组启动日志，以及 NPU 硬件实测的逐次 MTP 写入与 KDA 读写带宽轨迹仍待现场采集；prefill 与 decode 浮点累加顺序差异触发采样分叉的概率需实测对比；`v0.23.0` 分支跨层共享消费层是否传入非空 K/V 取决于具体模型实现。
