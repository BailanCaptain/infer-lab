---
id: gqa
title: GQA：几个查询头共读一组 K、V，省下什么、付出什么
type: concept
summary: >-
  GQA 把查询头分组共读同一组 K、V，使 K/V 投影与 KV cache 按头数比同比例缩小，而逐头打分、汇合与输出投影不变；本页结合 Qwen3-8B（4:1）与 Qwen3-30B-A3B（8:1 及 TP=8 复制）算清开销，并拆解昇腾 FIA 直读、Mooncake+C8 边界及与 MLA、KDA 的区别。
aliases:
  - GQA
  - Grouped-Query Attention
  - 分组查询注意力
  - 分组查询
  - MQA
  - Multi-Query Attention
  - 多查询注意力
  - MHA
  - Multi-Head Attention
  - 多头注意力
  - num_key_value_heads
  - num_kv_heads
  - num_queries_per_kv
  - num_kv_head_replicas
  - KV 头数
  - 注意力头
  - head
  - 多头
  - Q 头
  - KV 头
chapters:
  - '02'
order: 15
sources:
  - 'https://arxiv.org/html/2305.13245v3'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L85-L125'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L258-L305'
  - 'vllm@ced6857a:vllm/model_executor/models/llama.py#L139-L170'
  - 'vllm@ced6857a:vllm/model_executor/models/llama.py#L286-L296'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L1040-L1065'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L1295-L1308'
  - 'vllm@ced6857a:vllm/distributed/utils.py#L52-L63'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/attention.py#L315-L338'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/attention.py#L525-L580'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L478-L535'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/mm_encoder_attention.py#L548-L558'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L550-L575'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L970-L1018'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1019-L1043'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1355-L1375'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1688-L1827'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/context_parallel.md#L50-L60'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1901-L1962'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L121-L134'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L110-L134'
  - 'vllm@0fc695fc:vllm/v1/attention/backends/cpu_attn.py#L444-L456'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1359'
  - 'vllm@568afb3a:vllm/model_executor/layers/linear.py#L1000-L1020'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L440-L451'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L140-L175'
  - 'vllm@ba15685a:vllm/model_executor/layers/linear.py#L1105-L1130'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L595-L618'
  - 'raw:sha256-96369723e69c470d91ca318d4e4d5324d91cb9d72c37ce9b045a7596a6aad1bf.md#L1-L490'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1014-L1042'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 多头各自打分与汇合在那里讲；本页展开查询头怎样分组共读 K、V 并省下投影与缓存
  - to: mla
    kind: alternative-to
    note: MLA 把每位置历史压成一条共享潜向量、用时按头还原，而不是减少 K、V 的组数
  - to: linear-attention
    kind: alternative-to
    note: KDA 等线性注意力不存逐位置的 K、V，而把历史累积进固定大小的状态
  - to: sparse-attention
    kind: alternative-to
    note: 稀疏注意力通过索引器只挑少量关键历史位置来读，而不是靠多查询头共读来减少 KV 份数
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-88aad6e2c87b2b55e02c8d48d87f34f1dc39543c6eef52e0db3e6532d6466ee5.md
  - >-
    raw/sha256-96369723e69c470d91ca318d4e4d5324d91cb9d72c37ce9b045a7596a6aad1bf.md
---

**GQA（Grouped-Query Attention，分组查询注意力）把一层里的查询头（Q 头）等分成若干组，让同一组里的几个查询头共读同一组键和值（KV 头）：各头面对的历史 K、V 相同，但仍用各自的 Q 独立打分、独立汇合出自己的输出。少了的只是 K、V 的份数，查询头数和输出份数一点不变。**

沿着[请求全景](request-overview.md)进入逐层前向时，标准 [attention](attention-qkv.md) 先把每个位置的隐藏向量乘三套权重矩阵，得到查询 Q（我要找什么）、键 K（凭什么匹配）和值 V（被找到后交出的内容）。多头注意力 MHA（Multi-Head Attention）把 Q、K、V 各切成 $n_q$ 个注意力头（attention head），见[多头](attention-qkv.md#多头同一个位置同时按几套方式去读)。为了不在生成新 token 时每步重算历史，每个历史位置的 K、V 都要存进 [KV cache](kv-cache.md)——头越多、上下文越长，缓存和每步搬运开销就越惊人，GQA 正是从这里下手。

## 几个查询头能不能共读一组 K、V？

先看一张最小结构对照图。图从下往上读：最下面是一组组 K、V，箭头指向读它的查询头；每个查询头再算出自己那一份输出。三栏的查询头都是 `4` 个，只有 K、V 的组数不同：

```wiki-diagram
file: gqa
```

对照上图，MHA、GQA 与 MQA（Multi-Query Attention，多查询注意力）并不是三种互不相干的算法，而是同一个分组旋钮在不同刻度上的名字：

| 注意力结构 | K、V 组数（`num_key_value_heads`，记为 $n_{\text{kv}}$） | 每组几个查询头（$g = n_q / n_{\text{kv}}$） | 产出几份头输出 |
|---|---|---|---|
| **MHA**（多头注意力） | $n_{\text{kv}} = n_q$（一对一独占） | $1$ 个 | $n_q$ 份 |
| **GQA**（分组查询注意力） | $1 < n_{\text{kv}} < n_q$（按组共读） | $n_q \div n_{\text{kv}}$ 个 | $n_q$ 份 |
| **MQA**（多查询注意力） | $n_{\text{kv}} = 1$（全员共读一组） | 全部 $n_q$ 个 | $n_q$ 份 |

Ainslie 等人 2023 年在 GQA 论文中把分成 $G$ 组的做法记作 `GQA-G`：当 $G = 1$ 时退化为 MQA，当 $G = n_q$ 时还原为 MHA。工程实现里常把「一组 K、V」直接称为一个 **KV 头**，组数就是 `config.json` 里的 `num_key_value_heads`。由于查询头必须等分到各组，查询头数 `num_attention_heads` 必须是 `num_key_value_heads` 的整数倍。

同时要先划清边界：**GQA 的共享只发生在同一条请求、同一层、同一个位置之内**——同组查询头共读的是这条请求自己的历史 K、V，不同请求之间的历史绝不会因为 GQA 混在一起（跨请求复用相同前缀缓存块那是 [prefix caching](prefix-caching.md) 管的事）。

## 为什么要省 K、V，代价在哪？

**省 K、V 同时解决两道瓶颈：第一是显存容量墙，第二是解码（decode）阶段的显存带宽墙。** KV cache 为每条在跑请求、每一层、每个历史位置各存一份 K 和 V。拿 [KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)的 32 层示意尺寸（`32` 个 Q 头、每头 `128` 维、`BF16` 每元素 `2 B`）算，单条 `4,096` token 请求在 MHA 下占 `2 GiB` 显存；换成 `8` 个 KV 头（`4:1` GQA）立刻降到 `512 MiB`，腾出的显存能直接换成更高并发。

在逐词生成的 decode 阶段，每步只算 1 个新位置，却要把全部历史位置的 K、V 从设备显存 HBM 读进芯片一遍。GQA 论文指出，反复搬运 K、V 的访存带宽正是自回归解码变慢的主因。编码器（encoder）自注意力因全序列并行计算、带宽通常不是主瓶颈，因此原论文未在 encoder 层改用 GQA。

MQA 把 K、V 直接砍到只剩 `1` 组，缓存和每步读取量都缩到 MHA 的 $1 / n_q$，但论文观察到这样硬砍会导致模型质量下滑甚至训练不稳定；而且模型越大、查询头越多，MQA 砍得就越狠。GQA 取了中间平衡点：论文在 T5-XXL 上改用 `8` 组（`GQA-8`）后，生成质量紧贴 MHA，解码推理速度却接近 MQA；当模型规模继续放大时，按组共享还能同步增加组数，保持稳定的压缩比例。

用 GQA 省下 K、V 要付出三笔明确代价与约束：

1. **表达多样性换显存容量**：组数越少，同一段上下文能被投影成多少套不同的键和值就越少，本质是在生成质量与显存/带宽开销之间做折中。
2. **分组比必须在预训练或继续训练（uptraining）时定死**：`num_key_value_heads` 直接决定 $W_K, W_V$ 权重矩阵的列宽，属于模型固化结构。把已有 MHA 检查点转成 GQA 时，论文先对同组各头的 $W_K, W_V$ 权重取均值池化（mean pooling）合成一个头，再投入约原预训练 `5%` 的计算量做继续训练恢复精度。推理时绝不能靠手改 `config.json` 里的 `num_key_value_heads` 来“无损开启 GQA”。
3. **逐头打分、加权汇合与输出投影一点没省**：GQA 只合并了 K、V 的源头，没有合并查询头。固定隐藏维度 $H$、查询头数 $n_q$ 与单头维度 $d_k, d_v$，只把 KV 头数从 $n_q$ 减到 $n_{\text{kv}}$ 时，一层注意力四步的开销变化必须拆开算账：

| 计算与存储环节 | 代数规模（单位置读 $S$ 个可见历史，忽略偏置） | 只减少 $n_{\text{kv}}$ 时省没省？ |
|---|---|---|
| **$Q$ 投影与输出投影 $W_O$** | 参数量 $H \cdot n_q d_k + n_q d_v \cdot H$ | **完全不省**（进出都按全部 $n_q$ 个查询头算） |
| **$K, V$ 线性投影 $W_K, W_V$** | 参数量与单 token 乘加数均为 $H \cdot n_{\text{kv}} (d_k + d_v)$ | **按 $n_{\text{kv}} / n_q$ 同比例缩小** |
| **逐位置打分 $QK^\top$ 与汇合 $PV$** | 乘加数约 $n_q \cdot S \cdot d_k + n_q \cdot S \cdot d_v$ | **完全不省**（每个 Q 头照样对 $S$ 个位置打分汇合） |
| **KV cache 容量与逻辑读取量** | 每位置每层 $n_{\text{kv}} (d_k + d_v) \times \text{bytes}$ | **按 $n_{\text{kv}} / n_q$ 同比例缩小**（物理访存视算子而定） |

因此，「GQA 只省显存、不省计算」这句口诀不够准确：**$W_K, W_V$ 投影的矩阵乘确实省了，真正没省的是 $QK^\top$、$PV$ 与 $W_O$**。反过来，也不能因为缓存缩了 `4` 倍就断言端到端吞吐一定快 `4` 倍：prefill（常受算力限制）与 decode（常受带宽限制）、批大小、序列长度及底层算子都会改变实际瓶颈，真实提速必须实测。

## 同组的查询头怎样共读一组 K、V？算一遍

**同一组里的查询头拿到同一张 K 表和 V 表，但各自拿不同的 Q 去打分，算出的权重和输出依然各不相同。** 下图左侧演示两个同组头如何共读第 0 组 K/V 算出不同权重与输出，右侧直观对比 `4:1` GQA 的四项开销真账：

```wiki-diagram
file: gqa-fig-shared-kv-cost-split
```

把第 $h$ 个查询头映射到所属 KV 组号 $g(h) = \lfloor h / (n_q / n_{\text{kv}}) \rfloor$，单头输出写成标准公式就是：

$$o_h = \text{softmax}\!\left(\frac{Q_h K_{g(h)}^\top}{\sqrt{d_k}}\right) V_{g(h)}$$

拿首图中间 GQA 那一栏做最小手算（示意设定）：`4` 个查询头 $Q_0\text{–}Q_3$ 等分成 `2` 组，$Q_0, Q_1$ 共读第 0 组 K、V，$Q_2, Q_3$ 共读第 1 组。每头宽度 $d_k = d_v = 2$，当前可见历史有 `3` 个位置（0、1、2）；第 0 组 K、V 直接沿用 [attention 页多头一节](attention-qkv.md#多头同一个位置同时按几套方式去读)里头 0 的数值：

| 第 0 组共享历史（示意） | 位置 0 | 位置 1 | 位置 2 |
|---|---|---|---|
| 键向量 $K_0$ | $k_0 = [2, 1]$ | $k_1 = [0, 1]$ | $k_2 = [1, 0]$ |
| 值向量 $V_0$ | $v_0 = [1, 0]$ | $v_1 = [0, 1]$ | $v_2 = [1, 1]$ |

跟着位置 2 走：设它的两个同组查询向量分别为 $Q_0 = [1, 2]$ 和 $Q_1 = [0, 1]$（示意）。两个查询头面对的是完全相同的 $k_0, k_1, k_2$ 与 $v_0, v_1, v_2$，各自做点积、除以 $\sqrt{2}$（缩放原因见 [为什么要除以 √d](attention-qkv.md#为什么要除以-d)）、做 Softmax 归一化（保留两位小数），再对同一组 $V_0$ 加权求和：

| 演算步骤（位置 2，共读第 0 组 $K_0, V_0$） | 查询头 $Q_0 = [1, 2]$ | 查询头 $Q_1 = [0, 1]$ |
|---|---|---|
| ① 与 `[k₀, k₁, k₂]` 逐位置点积 | $[1{\times}2+2{\times}1,\; 1{\times}0+2{\times}1,\; 1{\times}1+2{\times}0] = [4, 2, 1]$ | $[0{\times}2+1{\times}1,\; 0{\times}0+1{\times}1,\; 0{\times}1+1{\times}0] = [1, 1, 0]$ |
| ② 除以 $\sqrt{2}$ 并做 Softmax 得权重 | $\text{softmax}([2.83, 1.41, 0.71]) \approx [0.73, 0.18, 0.09]$ | $\text{softmax}([0.71, 0.71, 0]) \approx [0.40, 0.40, 0.20]$ |
| ③ 按各自权重汇合同一组 `[v₀, v₁, v₂]` | $0.73[1,0] + 0.18[0,1] + 0.09[1,1] = \mathbf{[0.82, 0.27]}$ | $0.40[1,0] + 0.40[0,1] + 0.20[1,1] = \mathbf{[0.60, 0.60]}$ |

可以看到，虽然读的是同一张 3 行 K/V 表，$Q_0$ 把 `0.73` 的比重投给了位置 0，$Q_1$ 则在位置 0、1 之间平分，两份输出完全不同。和 MHA 相比，唯一差别在于 $Q_1$ 没有专属的 $K_1, V_1$。在 [attention 页多头算例](attention-qkv.md#多头同一个位置同时按几套方式去读)的 MHA 下，$Q_1$ 权重碰巧也是 `[0.40, 0.40, 0.20]`，但读专属头 1 的值向量会算出 `[1.20, 0.80]`；改成共读第 0 组后变成了 `[0.60, 0.60]`。组越少，可提供的独立 $V$ 子空间就越少，这就是上一节说的「质量换容量」。

顺着同一个小例子（设隐藏宽度 $H = 4 \times 2 = 8$，忽略偏置），把三种结构在一层里的乘法次数和投影参数个数摆在一起，就能直观验证上一节的算账结论：

| 单层开销项（$H=8, n_q=4, d_k=d_v=2, S=3$，示意） | MHA（4 组 K/V） | GQA（2 组 K/V） | MQA（1 组 K/V） |
|---|---|---|---|
| 位置 2 打分乘法数（$n_q \times S \times d_k$） | $4 \times 3 \times 2 = 24$ 次 | `24` 次 | `24` 次 |
| 位置 2 汇合乘法数（$n_q \times S \times d_v$） | $4 \times 3 \times 2 = 24$ 次 | `24` 次 | `24` 次 |
| $K, V$ 投影参数量与单位置投影乘法（$H \times n_{\text{kv}} \times (d_k+d_v)$） | $8 \times 4 \times 4 = 128$ | $8 \times 2 \times 4 = 64$ | $8 \times 1 \times 4 = 32$ |

打分与汇合在三种结构下恒为 `24` 次，与 KV 头数无关；只有 $K, V$ 投影随 $n_{\text{kv}}$ 按 `4 : 2 : 1` 线性缩减。

## 缓存容量按 KV 头数计算

在标准（未压成潜向量或递推状态）的 KV cache 中，单 token 单层字节数只由 KV 头数 $n_{\text{kv}}$、单头宽度和元素字节数决定。**查询头数 $n_q$ 根本不出现在公式里**（$d_k = d_v = d_h$ 时即为 $2 \times n_{\text{kv}} \times d_h \times \text{bytes}$）：

$$\text{KV}_{\text{token,layer}} = n_{\text{kv}} \times (d_k + d_v) \times \text{bytes}, \qquad \frac{\text{KV}_{\text{GQA}}}{\text{KV}_{\text{MHA}}} = \frac{n_{\text{kv}}}{n_q}$$

先沿着上一节的 3 位置小算例数一遍格子：同一层缓存里，每组 K、V 为每个位置存一行 K（2 格）和一行 V（2 格），组数减半，格子总数就严格减半：

```wiki-diagram
file: gqa-cache
```

下面按 `BF16`（每元素 `2 B`）静态推导，把小算例、[KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)的 32 层基准，以及 `v0.30.0` 主基线的 **`Qwen3-8B`**（`4:1` GQA）与 **`Qwen3-30B-A3B`**（`8:1` GQA）放在同一张表里对账：

| 算例与模型标尺 | 头配置（$n_q : n_{\text{kv}}$，单头 $d_h$） | 单层投影形状 $W_Q$ vs $W_K, W_V$ | 单 token 单层 KV | 单 token 全层 KV（及 `4,096` token 请求总计） |
|---|---|---|---|---|
| **3 位置小例子**（示意） | `4Q : 4KV / 2KV / 1KV`，$d_h = 2$ | `[8,8]` vs `[8,8]` / `[8,4]` / `[8,2]` | `16` / `8` / `4` 个数 | 3 位置合计 `48` → **`24`（1/2）** → **`12`（1/4）** 个数 |
| **32 层对照算例**（同 KV cache 页，示意） | `32Q : 32KV / 8KV / 1KV`，$d_h = 128$ | `[4096,4096]` vs `[4096,4096/1024/128]` | `16,384 B` / `4,096 B` / `512 B` | 全层 `512` / `128` / `16 KiB`；4K 请求：`2 GiB` → **`512 MiB`** → `64 MiB` |
| **`Qwen3-8B`**（36 层稠密，$H=4096$） | **`32Q : 8KV`（`4:1` GQA）**，$d_h = 128$ | $W_Q$ `[4096, 4096]` vs $W_K, W_V$ **`[4096, 1024]`** | `4,096 B`（`4 KiB`） | 36 层 **`144.0 KiB/tok`**（比同尺寸 MHA 省 `4×`）；4K 请求 `576 MiB` |
| **`Qwen3-30B-A3B`**（48 层 MoE，$H=2048$） | **`32Q : 4KV`（`8:1` GQA）**，显式 $d_h = 128$ | $W_Q$ `[2048, 4096]` vs $W_K, W_V$ **`[2048, 512]`** | `2,048 B`（`2 KiB`） | 48 层 **`96.0 KiB/tok`**（比同头宽 MHA 省 `8×`）；4K 请求 `384 MiB` |

核对 `Qwen3-30B-A3B` 这一行时，先留意 [config.json 解剖页](hf-model-anatomy.md#核心尺寸与-gqahead_dim-不一定等于-hidden_size--num_attention_heads)强调过的显式头宽规则：它的 `hidden_size` 虽然只有 `2048`，但配置显式指定了 `"head_dim": 128`。因此 $W_Q$ 输出宽度仍是 $32 \times 128 = 4096$，而 $W_K, W_V$ 按 `8:1` 缩成 $4 \times 128 = 512$。

再看全层缓存对比：正因为 `Qwen3-30B-A3B` 把 KV 头压到了 `4` 个，哪怕它有 `48` 层，每 token 全层缓存（`96.0 KiB`）反而比 `36` 层的 `Qwen3-8B`（`144.0 KiB`）还省三分之一。

在 vLLM 的分页管理（见 [PagedAttention](paged-attention.md)）中，缓存按固定 `block_size`（每块容纳的 token 数）分配物理页，单层每块字节数为 $2 \times \text{block\_size} \times n_{\text{kv,local}} \times d_h \times \text{bytes}$（$n_{\text{kv,local}}$ 为本卡 KV 头数）。拿单卡 `8` 个 KV 头、`d_h = 128`、`BF16` 代入：一块装 `16` 个 token（示意）时单层每块为 `65,536 B`（`64 KiB`）；按昇腾常见 `block_size = 128` 分配时，单层每块为 `512 KiB`。

> **边界与口径**：以上均为纯逻辑载荷。设备真实占用还包含未填满尾块空位、量化缩放系数、块表元数据、算子临时工作区及跨卡复制；单卡最终能切出多少物理块由启动试跑决定（见 [KV 显存划定](kv-cache-memory-profiling.md)；历史 GLM 双机预算只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)推导一次）。

## 张量并行时，KV 头不够分就要复制

[TP（张量并行）](tensor-parallel.md)把一层的注意力头平分给多张卡，各卡独立算完本卡头输出后再通过 `RowParallelLinear` 与 All-Reduce 合回完整隐藏向量，见[先过 attention](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)。查询头数 $n_q$ 较多，通常直接按 `TP` 等分；而 KV 头数 $n_{\text{kv}}$ 较少，在 `QKVParallelLinear` 中按 `TP` 与 $n_{\text{kv}}$ 的大小关系分成两条分支：

$$n_{\text{kv,local}} = \max\!\bigl(1,\; n_{\text{kv}} / \text{TP}\bigr), \qquad \text{replicas} = \max\!\bigl(1,\; \text{TP} / n_{\text{kv}}\bigr), \qquad \text{shard\_rank} = \lfloor r / \text{replicas} \rfloor$$

- **够分就切（$n_{\text{kv}} \ge \text{TP}$）**：要求 $n_{\text{kv}}$ 被 `TP` 整除（`replicas = 1`）。每张卡分走 $n_{\text{kv}} / \text{TP}$ 个不重叠的 KV 头，本卡 KV cache 也只存这几个头。
- **不够分就复制（$n_{\text{kv}} < \text{TP}$）**：要求 `TP` 被 $n_{\text{kv}}$ 整除。每张卡保底放 `1` 个 KV 头，同一个 KV 头跨 `num_kv_head_replicas = TP // n_kv` 张卡各留一份副本。加载权重时，第 $r$ 号 TP 卡按 `r // num_kv_head_replicas` 挑出自己负责的那一个 KV 头。

下图把 `Qwen3-8B`（`8` 个 KV 头）与 `Qwen3-30B-A3B`（`4` 个 KV 头）同时放进 `TP = 8` 环境对比，并在底部标出昇腾融合算子 `FIA` 如何直接消费本卡分组头：

```wiki-diagram
file: gqa-fig-qwen3-shapes
```

把 3 位置小算例（`4Q : 2KV`，$d_h = 2$）与两款 Qwen3 模型在不同 `TP` 度下的每卡驻留头数、复制倍数 `num_kv_head_replicas` 和全组总驻留量列成一张账单，复制拐点一目了然：

| 模型或示意设定 | 并行度 `TP` | 每卡头数（$n_{q,\text{local}} : n_{\text{kv,local}}$） | 复制份数 `replicas` | 单卡每位置每层 KV | 全组 `TP` 卡合计驻留（是否翻倍冗余） |
|---|---|---|---|---|---|
| **小例子 `4Q : 2KV`**（$d_h=2$，示意） | `TP = 1` / `TP = 2` | `4Q:2KV` / `2Q:1KV` | `1` | `8` 个数 / `4` 个数 | 合计均为 `8` 个数（零冗余切分） |
| **小例子 `4Q : 2KV`**（$d_h=2$，示意） | `TP = 4`（超头数） | `1Q : 1KV` | **`2`** | 保底 `4` 个数（不再减半） | 4 卡合计 **`16` 个数**（每组存 2 份） |
| **`Qwen3-8B`**（`32Q : 8KV`，$d_h=128$） | `TP = 8` | `4Q : 1KV` | `1` | `512 B`（全层 `18 KiB`） | 8 卡合计 `4,096 B`（`8` 头刚好切完，零复制） |
| **`Qwen3-30B-A3B`**（`32Q : 4KV`，$d_h=128$） | `TP = 4` → **`TP = 8`** | `8Q:1KV` → **`4Q:1KV`** | `1` → **`2`** | 两档均为 **`512 B`**（全层 `24 KiB`） | `TP=4` 合计 `2,048 B`；**`TP=8` 涨到 `4,096 B`**（每头跨 2 卡复制） |

跨过 `TP > n_kv` 这条线会带来两个直接后果：

- **单卡 KV 缓存触底不再缩小**：以 `Qwen3-30B-A3B` 为例，从 `TP=4` 扩到 `TP=8` 时，单卡每 token 的 KV cache（单层恒为 `512 B`）与单卡 $W_K, W_V$ 权重（单层各 `[2048, 128]`）均已触到「至少 1 个 KV 头」的地板，继续加 TP 卡不再省显存。
- **单卡呈 `1Q : 1KV` 不等于退回 MHA**：小例子在 `TP=4` 下单卡表面是 `1Q : 1KV`，那只是两张卡共持同一份 KV 副本，全模型依然只有 `2` 组独立 K、V。

## 昇腾算子执行与变体边界：FIA、Mooncake+C8 与 MLA / KDA

### 昇腾 FIA 原生分组与 Mooncake+C8、上下文并行约束

在早期朴素 PyTorch 实现里，为了做分组点积，常要在调用注意力前先调 `repeat_kv` 把 K、V 张量沿头维度复制展开成 $n_q$ 份，白白吃掉成倍的 HBM 显存与带宽。在 `vllm` 与昇腾 `vllm-ascend`（`v0.30.0` 主基线）中，**调用算子前绝不在 HBM 里复制展开 K、V**：

- **昇腾主力算子 `FIA` 原生直读双头数**：`AscendAttentionBackendImpl` 初始化时校验整除并记录 `num_queries_per_kv = num_heads // num_kv_heads`。前向调用统一算子 `FIA`（`npu_fused_infer_attention_score`，选路见 [FlashAttention 与昇腾注意力算子族](ascend-flash-attention.md)）时，直接传入本卡 `num_heads`、`num_key_value_heads`、紧凑变长布局 `input_layout="TND"`（把同批变长序列首尾相接压平）与分页 `block_table`，同组映射在算子内部完成。通用 PyTorch 缩放点积注意力（`scaled_dot_product_attention`）路径则靠 `enable_gqa = (num_heads > num_kv_heads)` 开启内部广播；至于 `FIA` 核内片上缓存是否对同组查询头合并为单次物理读取，取决于底层 CANN 算子实现。
- **`Mooncake + GQA + C8` 的 P/D 分离传输红线**：对 GQA 模型开启 `C8`（`INT8`）KV cache 量化（`enable_c8_quant=True`，见 [KV cache 量化](kv-cache-quantization.md)）并搭配 [PD 分离](pd-disaggregation.md)时，Prefill 生产端保留 `BF16` 缓存，Decode 消费端分配 `INT8` 缓存。若使用整块裸字节直传的 [MooncakeConnector](mooncake-connector.md)（含 `V1` / `V2`），消费端会把 `BF16` 字节误读为 `INT8`。因此启动检查 `_check_mooncake_c8_kv_cache_quant` 会直接抛 `ValueError` 拦截，必须换用发送前逐层量化的 **`MooncakeLayerwiseConnector`** 或关闭 `C8`。
- **GQA 叠加 [上下文并行（预填充 PCP / 解码 DCP）](context-parallel.md)的整除门禁**：在 `v0.30.0` 中，对 GQA/MQA 模型同时开启 `PCP > 1` 与 `DCP > 1` 时，平台强制要求 `prefill_context_parallel_size == decode_context_parallel_size`（`PCP == DCP`）。若在投机解码下为 GQA/MQA 草稿模型单独开 `DCP > 1`（且 `PCP == 1`），还必须满足草稿 `TP > total_num_kv_heads`、`DCP <= TP // total_num_kv_heads`，且 `Q // KV` 能被 `DCP` 整除。

### 变体边界：GLM 双机的稀疏 MLA 与 KDA 为什么不是 GQA

并非所有省 KV cache 的模型都走 GQA。以 `09 旗舰异构模型全案` 的历史绑定案例 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)（`TP8 / DP2 / EP16`）为例：示例请求 R1 在[第 4 站逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)穿过 `34` 层 [KDA](linear-attention.md) 与 `11` 层稀疏 [MLA](mla.md) 外加 MTP 草拟层（交替排布见 [GLM-5.3-Flash](glm-5-3-flash.md)）。

它的 `config.json` 虽然写着 `num_attention_heads = 64` 且 `num_key_value_heads = 64`，但**整座模型没有一层是 MHA，也没有一层是 GQA**。因此绝不能套用本页 GQA 公式估算缓存字节与块数（唯一推导见[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）：

```wiki-diagram
file: gqa-flow
```

对照上图的加载、建规格与前向三步分岔，把 GQA 与稀疏 MLA、KDA 在 `TP = 8` 下的落卡形态和压缩机理放在一起对比：

| 注意力路线 | `TP = 8` 下查询头切分 | 历史缓存存什么、在 8 张卡上怎么放 | 与 GQA 的本质区别及代价 |
|---|---|---|---|
| **GQA**（如 `Qwen3-8B` / `30B-A3B`） | 按 `TP` 等分（如每卡 `4` 头） | `n_kv >= 8` 按头切分；`n_kv < 8` 每卡保底 `1` 头并跨卡复制 | 减少独立 K、V 组数，同组 Q 头读**完全相同**的 K、V；组太少伤质量 |
| **稀疏 MLA**（GLM 11 层 + MTP） | `64` 头等分，每卡 `8` 头 | 每位置只存 1 条共用 `512` 维潜向量；潜向量不分头，**8 张卡各算、各存完整一份** | 缓存规格记作 `num_kv_heads=1` 只是借用槽位记账（恰如 `KV=1 < TP=8` 全员复制），但用时各头经专属投影还原出**各不相同**的 K、V，不是 MQA |
| **KDA**（GLM 34 层线性注意力） | `64` 头等分，每卡 `8` 头 | q、k、v 同为 `64` 头（`128` 维），不存逐位置 K、V，每卡只管本卡 `8` 个头的定长 $128{\times}128$ 状态 | 状态大小不随上下文长度增长；历史保留能力受限于状态容量与更新规则 |

R1 在 GLM 两类层上的每卡张量形状见 [34 层 KDA](one-request.md#34-层-kda) 与 [11 层稀疏 MLA](one-request.md#11-层稀疏-mla)，跨卡切分细节见 [TP 页的稀疏 MLA](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制) 与 [KDA](tensor-parallel.md#kda状态跟着头一起切)。

## 常见误解

排查 GQA 显存账、多卡切分与昇腾运行约束时，最容易踩中以下认知误区，先用速查板建立全局对照：

```wiki-diagram
file: gqa-fig-myths
```

- **「GQA 把同一组的查询头合并成了一个头。」** 错。查询头一个不少，每个头仍拿各自的 $Q_h$ 打分并产出独立输出；共享的仅仅是它们共读的 K、V。
- **「GQA 只省显存、不省计算。」** 太绝对。$W_K, W_V$ 投影的参数量和乘加数按 $n_{\text{kv}} / n_q$ 同步缩小；真正没省的是逐头打分 $QK^\top$、加权汇合 $PV$ 与输出投影 $W_O$。
- **「把 `config.json` 里的 `num_key_value_heads` 改小，就能给已有模型开启 GQA。」** 错。KV 头数由训练权重形状定死；MHA 转 GQA 需同组 K/V 投影取均值并补约 `5%` 预训练计算量的继续训练（uptraining），硬改配置会导致加载失败或输出错乱。
- **「`TP` 卡数超过 KV 头数后，单卡呈 `1Q : 1KV` 就退回成了 MHA，或还能继续平分缓存。」** 两半都错。那是同一个 KV 头按 `num_kv_head_replicas` 跨多卡复制，全模型独立 KV 头数没变，且单卡 KV cache 与 $W_K, W_V$ 触底于 `1` 个头，再加卡也不再缩小。
- **「进昇腾注意力算子前必须先 `repeat_kv` 把 K、V 在 HBM 里复制展开成查询头数。」** 错。`FIA`（`npu_fused_infer_attention_score`）原生分开接收 `num_heads` 与 `num_key_value_heads`，调用前不在 HBM 展开。
- **「GQA 模型开了 C8 量化，PD 分离照样能用 `MooncakeConnector` 整块传 KV。」** 错。C8 下 P 端存 `BF16`、D 端分 `INT8`，整块裸传会把 `BF16` 字节误读成 `INT8`，必须换用发送前逐层量化的 `MooncakeLayerwiseConnector`。
- **「GLM 配置写着 64 个 KV 头就是 MHA；vLLM 给 MLA 写 `num_kv_heads=1` 就是 MQA。」** 两句都错。GLM 的稀疏 MLA 只存一条 `512` 维共享潜向量、用时按头投影还原出不同的 K、V（`1` 个头只是缓存槽位记账），KDA 则存定长状态，见 [MLA 常见误解](mla.md#常见误解)；也不能拿论文 `GQA-8` 的压缩比去估 GLM 的缓存块数。
- **「GQA 的共享和 prefix caching 的共享是一回事。」** 错。GQA 是在单条请求内部让同层同位置的多个查询头共读一组 K、V；[prefix caching](prefix-caching.md) 是在不同请求之间复用前缀命中块（见[命中条件](prefix-caching.md#哪些块能被共享)）。

## 对照源码

### 怎么开

GQA 没有运行时命令行开关，完全由模型权重和 `config.json` 的 `num_key_value_heads` 决定：

- **模型加载与 `QKVParallelLinear` 切分/复制**：`Qwen3Attention` 与 `Qwen3MoeAttention` 读取 `num_heads`、`num_kv_heads` 与显式 `head_dim` [C2][C3]（Llama 类模型在字段缺省时回退取 `num_attention_heads` 即 MHA [C5]），按 `max(1, total_num_kv_heads // tp_size)` 确定本卡 KV 头数。`QKVParallelLinear` 据此定出 Q、K、V 三段输出宽度并计算 `num_kv_head_replicas = divide(tp_size, total_num_kv_heads)` [C6]，权重加载器按 `shard_rank = tp_rank // num_kv_head_replicas` 切取对应 KV 头 [C7]。
- **注意力层与分页规格**：通用 `Attention` 校验 `num_heads % num_kv_heads == 0` [C9]，前向把 `query` 整形成 `[T, num_heads, head_size]`、`key/value` 整形成 `[T, num_kv_heads, head_size(_v)]` [C10]；`AttentionSpec` 按本卡 `num_kv_heads` 计算每页未填充字节 `unpadded_page_size_bytes`（别名 `real_page_size_bytes`）[C11]。
- **算子执行与 GLM 例外**：昇腾 `AscendAttentionBackendImpl` 算出 `num_queries_per_kv` [C13]，向 `npu_fused_infer_attention_score` 分别传入 `num_heads` 与 `num_key_value_heads` [C14]；PyTorch SDPA 路径仅在 `num_heads > num_kv_heads` 时设 `enable_gqa=True`（启用分组广播，区别于 `Attention` 允许相等的合法性断言）。GLM-5.3-Flash 配置虽默认 `64` 头 [S19]，但稀疏 MLA 在专用实现里自建潜向量缓存并固定 `num_kv_heads=1` [C21]，KDA 则按 TP 等分全部头状态，均不走 GQA 分组逻辑。

### 会报什么错

| 报错或拦截异常 | 触发条件 | 源码位置 |
|---|---|---|
| `AssertionError: num_heads (X) is not divisible by num_kv_heads (Y)` | 查询头数不是 KV 头数的整数倍 | `Attention.__init__` [C9] |
| `AssertionError: X is not divisible by Y` 或无消息 `AssertionError` | `QKVParallelLinear` / 模型层按 `TP` 切分或复制 KV 头时无法整除，或 `AscendAttentionBackendImpl` 头数不整除 | `divide` / `ensure_divisibility` [C8]；`Qwen3` / `Llama` / `attention_v1.py` |
| `ValueError: MooncakeConnector does not support C8 KV cache quantization on GQA models...` | GQA 模型开启 `enable_c8_quant=True` 且使用 `MooncakeConnector`（P 端 `bf16`、D 端 `int8`） | `AscendConfig._check_mooncake_c8_kv_cache_quant`（提示换 `MooncakeLayerwiseConnector`）[C15] |
| `ValueError: GQA/MQA PCP+DCP requires prefill_context_parallel_size to equal decode_context_parallel_size...` | 非 MLA 模型同时开启 `PCP > 1` 与 `DCP > 1` 但 `PCP != DCP`（草稿 GQA 开 `DCP > 1` 另校验 `TP > num_kv_heads` 与整除） | `platform.py:_validate_model_pcp_dcp_config` 及草稿校验函数 [C17][S18] |

### 开销和什么时候别开

- **严禁手改配置强开 GQA**：已有 MHA 权重必须经过同组 K/V 投影取均值与约 `5%` 预训练算力的继续训练（uptraining）才能转为 GQA，原论文也因编码器并行计算非带宽受限而只在解码器自注意力上采用 GQA [S1]。
- **`TP > num_kv_heads` 时的冗余拐点**：一旦 `TP` 超过总 KV 头数（如 `Qwen3-30B-A3B` 跑 `TP=8`），K/V 权重与 KV cache 会在多卡间重复驻留，单卡缓存容量不再随卡数增加而下降 [D]。

### 版本差异

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
|---|---|---|---|---|
| `QKVParallelLinear` 复制与 `Attention` 校验 | `tp_size >= total_num_kv_heads` 时设 `num_kv_head_replicas` 并按整除取分片，已支持独立 `v_head_size`（`linear.py#L1014-L1042`）；断言 `num_heads % num_kv_heads == 0` | 延续相同切分、复制、独立 `v_head_size` 与整除断言逻辑（`linear.py#L1000-L1020`） | 延续相同分片、`num_kv_head_replicas` 复制与独立 `v_head_size` 支持 | 延续相同分片、复制与独立 `v_head_size` 规则（`linear.py#L1105-L1130`） |
| `AttentionSpec` 页容量与 SDPA `enable_gqa` | `AttentionSpec` 直接按 `2 * block_size * num_kv_heads * head_size` 计字节；`cpu_attn.py` 传 `enable_gqa` | 同 `v0.23.0` 口径 | `AttentionSpec` 泛化 `head_size_v` 与 `num_head_slots`，标准 GQA 页字节不变；CPU 改走原生分页核，`mm_encoder_attention` 等保留 `enable_gqa` | 延续泛化 `AttentionSpec` 与原生核分工 |
| 昇腾 `FIA` 双头数直读与混合批执行 | `attention_v1.py` 算 `num_queries_per_kv`，向 `FIA` 传双头数，调用前不展开 K/V | 同 `v0.23.0`（`attention_v1.py#L440-L451`） | 保持双头数直传；新增 `VLLM_BATCH_INVARIANT` 或 `950DT` `CHUNKED_PREFILL_PHASE_SPLIT` 时把混合批拆成两段 `FIA` 调用（不改 GQA 数学） | 延续双头数直传与混合批拆段（`attention_v1.py#L595-L618`） |
| `Mooncake+GQA+C8` 与 `PCP/DCP` 门禁 | 已有 `_check_mooncake_c8_kv_cache_quant` 拦截 GQA+C8 裸传；无独立 GQA `PCP==DCP` 门禁 | 延续 GQA+C8 Mooncake 拦截 | 保留 GQA+C8 拦截（`MooncakeLayerwiseConnector` 分 `int8` 缓冲），新增 `_validate_model_pcp_dcp_config`（`PCP==DCP`）与草稿 GQA `DCP` 校验 | 延续 GQA+C8 拦截与 `PCP==DCP` / 草稿 `DCP` 全套校验 |
| GLM 稀疏 MLA / KDA 代码归属 | 维护分支无 `glm5next`（`09 旗舰异构模型全案` 的例外 B 双机案例钉在独立提交 `db701c1f`） | 维护分支无 `glm5next` | 社区仓 `models/glm5next/` 提供 `Glm5NextMLAAttention` 等实现（不等同于历史镜像 `db701c1f`） | 延续 `models/glm5next/` 演进；`09` 组 GLM 绑定算例仍以 `db701c1f` 为准 |

### 源码位置

- **论文与官方文档**：`GQA-G` 定义、MHA/MQA 两端关系、均值池化 + `5%` uptraining、解码带宽动机与 `GQA-8` 结论见 Ainslie 等论文 [S1]；GQA/MQA 叠用 `PCP+DCP` 要求 `DCP=PCP` 见上下文并行设计文档 `context_parallel.md#L50-L60` [S18]；GLM-5.3-Flash 头数字段见 HF `config.json` [S19]。
- **上游 `vllm` 核心实现**：`Qwen3` / `Qwen3Moe` / `Llama` 头数切分与显式 `head_dim` 见 `qwen3.py#L85-L125`、`qwen3_moe.py#L258-L305`、`llama.py#L139-L170, #L286-L296`；`QKVParallelLinear` 复制份数与加载偏移见 `linear.py#L1040-L1065, #L1295-L1308`（整除工具 `distributed/utils.py#L52-L63`）；通用层与缓存页字节见 `attention.py#L315-L338, #L525-L580` 与 `kv_cache_interface.py#L478-L535`；SDPA `enable_gqa` 对照见 `mm_encoder_attention.py#L548-L558` 及 `v0.23.0` `cpu_attn.py#L444-L456`（`v0.23.0` / `v0.26.0` / `main` 对照见 `0fc695fc` `linear.py#L1014-L1042`、`568afb3a`、`ba15685a` `linear.py`）。
- **昇腾 `vllm-ascend` 与变体对照**：`num_queries_per_kv` 与 `FIA` 双头数直传、混合批拆段见 `c09d3e20` `attention_v1.py#L550-L575, #L970-L1018`（`v0.23.0` / `v0.26.0rc` / `main` 对照见 `2c59ff10`、`2ed6cbba`、`8d6180e2` 同文件）；GQA+C8 Mooncake 拦截与逐层 `int8` 缓冲见 `ascend_config.py#L1019-L1043` 与 `mooncake_layerwise_connector.py#L1355-L1375`；`PCP/DCP` 与草稿 GQA 校验见 `platform.py#L1688-L1827`；GLM 稀疏 MLA 与 KDA 对照见 `db701c1f` `glm5_next.py#L1901-L1962`、`indexer_kpool_mla.py#L121-L134`、`0fc695fc` `kimi_gdn_linear_attn.py#L110-L134` 及社区 `c09d3e20` `models/glm5next/attention.py#L140-L175`。
- **推导与示意说明**：`Qwen3-8B`（`144.0 KiB/tok`、`4:1`）与 `Qwen3-30B-A3B`（`96.0 KiB/tok`、`8:1`、`TP=8` 下 `replicas=2`）及单层打分/投影乘加对比均由配置与代数定义严格推出 [D]；3 位置 `4Q:2KV` 手算与 `TP=1/2/4` 格子数为教学示意设定 [A]；异常触发后在进入算子前终止属静态控制流推断 [I]。

**待核：**

- 昇腾融合注意力算子 `FIA` 对不同单头宽度、每组查询头数与低比特精度的完整硬件支持矩阵，需结合具体 CANN 版本手册核对。
- 同组查询头在 `FIA` 核内片上缓存（UB / L1）是否合并为单次物理 K、V 读取：Python 接口仅证明传入双头数且不在 HBM 展开，核内访存细节待算子侧证据。
- GQA、稀疏 MLA 与 KDA 在同等参数规模下的生成质量对比尚无同基准实验数据；历史双机镜像的完整安装组合以[来源基线](../sources/glm-5-3-flash-baseline.md)为准。
