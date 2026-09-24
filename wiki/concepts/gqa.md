---
id: gqa
title: "GQA：16 个 Q 头只存 2 份 K/V，省的是显存不是计算"
type: concept
summary: 全注意力层有 16 个 Q 头，却不给每个头各存一份 K、V，而是每 8 个头共用一份，一共只存 2 份。存下来的 K、V 因此只有各存一份时的八分之一；但 16 个 Q 头照样各自把前面全看一遍，计算一点没少。
aliases: [GQA, Grouped-Query Attention, 分组查询注意力, 分组查询, MQA, Multi-Query Attention, 多查询注意力, MHA, Multi-Head Attention, 多头注意力, num_key_value_heads, num_kv_heads, num_queries_per_kv, KV 头数, 注意力头, head, 多头, Q 头, KV 头]
chapters: ["04"]
order: 15
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L219-L235
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L267-L274
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L240-L250
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L144-L151
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L972-L1063
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L281-L292
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L452-L513
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L603-L608
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L105-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1211-L1220
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1359
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1371-L1381
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1491-L1501
  - vllm-ascend@2c59ff10:vllm_ascend/ops/mm_encoder_attention.py#L89-L96
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3-Next.md#L249-L249
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L537-L538
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L781-L788
  - https://arxiv.org/abs/2305.13245
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - https://www.hiascend.com/doc_center/source/zh/Pytorch/60RC2/apiref/apilist/ptaoplist_000787.html
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L450-L451
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1241-L1257
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求的模型本身就是 GQA，它全注意力那 10 KiB 正是拿 2 个 KV 头、而不是 16 个算出来的
  - to: kv-cache
    kind: builds-on
    note: 先看清缓存里存的是每层每个 token 的 K 和 V 两份数字，才看得出 GQA 减的是这两份的头数
  - to: attention-cost
    kind: builds-on
    note: 那一页把四种注意力每个 token 要存的字节数并排比过，本页只讲 GQA 这一条是怎么省出来的
  - to: mla
    kind: alternative-to
    note: 同一个问题（KV 太占显存）的另一条路——GQA 减 K/V 的头数，MLA 换掉存进去的东西
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

GQA 只改一个数：**Q 还是 16 个头，K 和 V 只存 2 份，每 8 个 Q 头共用一份**。换来的是 KV Cache 只剩各存一份时的八分之一；换不来计算——**16 个 Q 头照样一个不少地各自把前面全看一遍**。

```wiki-diagram
file: gqa
```

## 16 个 Q 头，为什么不配 16 份 K、V

[注意力与 Q、K、V](attention-qkv.md) 那一页讲过：全注意力层里有 16 个 Q 头并排做注意力，每个头的数字都是 256 长；每个 token 的 K 和 V 算出来就存进 [KV Cache](kv-cache.md)，后面每一步新来的 token 都要回头读它们。

最直接的做法是 Q、K、V 一样多：16 个 Q 头，就配 16 份 K、16 份 V，各问各的。这叫 **MHA**（多头注意力）。问题出在存上——Q 问完就扔，K 和 V 却要为每个 token、每一层一直存到回答结束。头越多，存得越多，每一步要读回来的也越多。

于是有人问：16 个 Q 头真的需要 16 份不同的 K、V 吗？能不能让几个 Q 头共用一份？这就是 **GQA**（分组查询注意力）。

## 每 8 个 Q 头共用一份：账怎么省

这个模型的全注意力层是 16 个 Q 头、2 个 KV 头：16 个 Q 头分成两组，每组 8 个共用同一份 K、V。8 个 Q 头各自拿着不同的问题，去对同一份 K 打分、收同一份 V，算出 8 组不同的结果。

只看「存几份」，同样是 16 个 Q 头、每个头 256 个数字、用 bf16 存（一个数 2 字节），一颗 NPU 独占整个模型时，一个 token 在一层里要存：

| 怎么配 | 存几份 K/V | 每 token 每层 | 10 层全注意力合计 |
|---|---|---|---|
| MHA：每个 Q 头各一份 | 16 | 16 KiB | 160 KiB |
| **GQA：每 8 个 Q 头共用一份（本模型）** | **2** | **2 KiB** | **20 KiB** |
| MQA：16 个 Q 头全共用一份 | 1 | 1 KiB | 10 KiB |

16 份变 2 份，存的量就是八分之一，比例就摆在头数里。这只发生在 10 层全注意力上——另外 30 层是[线性注意力](linear-attention.md)，根本不存 K、V。

[那条请求](one-request.md)部署时把注意力对半切给两颗 NPU，每颗只剩 1 个 KV 头，于是每颗每层每个 token 只存 1 KiB，10 层合计 10 KiB——就是那一页算出来的数。怎么切头是[张量并行（TP）](tensor-parallel.md)那一页的事，这里不展开。

## 省的是存和读，不是计算

decode 时每生成一个 token，每一层要做三件事：把前面所有 token 的 K、V 读回来，16 个 Q 头各自拿 K 打分，再各自按比例收 V。

- **读 K、V**：只读 2 份，比 MHA 少到八分之一。
- **打分、收内容**：16 个 Q 头一个不少，每个头都要和前面每个 token 算一遍，次数和 MHA 一模一样。

所以 GQA 不减计算，减的是要搬的数据。decode 这一步本来就是「算得快、等数据」——卡在从显存往外读上，搬得少就快得多；prefill 一次算一大批 token，卡在计算上，GQA 在那里基本感觉不到。想连计算一起省，得换结构，[MLA](mla.md) 走的是另一条路，代价也不同。

真正跟着变小的计算只有一块：把输入变成 Q、K、V 的那次乘法，K、V 那两段输出窄了，权重也跟着少了。

## 共用不等于复制

「8 个 Q 头共用一份 K、V」容易被想成：算之前先把 2 份 K、V 各复制 8 遍，凑成 16 份。在这个模型走的这条路上**并没有**。

从模型代码到缓存，K、V 一直只有 2 份；取缓存时连头与头的边界都被压平成一长串数字。到了昇腾的注意力算子那一步，程序只是把「Q 有 16 个头、K/V 有 2 个头」两个数一起交给算子，**分组在算子内部完成**，外面一次都没摊开。

同一个仓库里也有真复制的地方：多模态模型处理图片的那段注意力是自己写的，没交给这个算子，只好自己先把 K、V 复制够份数。所以「GQA 要不要复制」没有统一答案，要看这一步交给谁算。

## 2 这个数是训练时定的

MHA、GQA、MQA 不是三种并列的东西，而是同一根轴上的三个点，轴就是「KV 头有几个」：等于 Q 头数是 MHA，等于 1 是 MQA，夹在中间叫 GQA。

GQA 的原始论文正是这么提出它的：MQA 只留 1 份，decode 最快但质量会掉；GQA 取一个中间值，两头兼顾。论文还给了办法，用不多的额外训练把现成的 MHA 模型改成 GQA。所以 2 这个数是模型训练时就定下、写进配置文件的，推理框架只能照读，改不了。

推理侧对它只有两条硬要求：Q 头数必须能被 KV 头数整除（16 ÷ 2 = 8，每组一样多）；昇腾的算子还要求这个商不能太大。

切到几颗 NPU 上时，KV 头也会被分掉。本模型只有 2 个 KV 头，切给 2 颗每颗 1 个；切得更多就分不下去了，只能每颗各存一份一样的。切到每颗只剩 1 个 Q 头时，一个 Q 头配一份 K、V——这一层在每颗 NPU 上悄悄退回了 MHA，还可能撞上算子不支持的情况（见下半）。

## 常见误解

- **「GQA 省的是计算」**——省的是 KV 要存的字节数和 decode 每步要搬的字节数。16 个 Q 头照样各算一遍，打分和收内容的计算和 MHA 一样多；真变小的只有生成 K、V 的那段乘法。
- **「算之前要先把 2 份 K、V 复制成 16 份」**——这个模型走的路不用，两个头数一起交给算子，分组在算子里完成。倒是多模态处理图片的那段自写注意力真的复制。
- **「GQA、MQA、MHA 是三种不同的注意力」**——是同一根轴上的三个点。所以切 NPU 切到每颗 KV 头和 Q 头一样多时，程序不会报错，只是这一层安静地变回了 MHA。

## 对照源码

### 怎么开

没有开关。KV 头数写在模型的 config.json 里：`num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256` [S20]。Qwen3.6-35B-A3B 的全注意力层用的是 `Qwen3NextAttention` [C4]，这三个数在它的 `__init__` 里原样读进来 [C1]：

```
每颗 KV 头数 = max(1, total_num_kv_heads // tp_size)   # TP=1 时 2，TP=2 时 1
head_dim     = config.head_dim or hidden_size // num_heads   # config 给了 256，就用 256
q_size  = num_heads × head_dim
kv_size = num_kv_heads × head_dim
```

`head_dim` 不是 `hidden_size / num_heads = 2048 / 16 = 128`，源码是「给了就用给的」——所以这个模型 16 个 Q 头拼起来是 4096 维，比 hidden 的 2048 还宽一倍，容易记反。

`num_kv_heads` 接着交给 `Attention` 层 [C2]，再原样填进 `FullAttentionSpec(num_kv_heads=...)` [C8]——KV Cache 每块多少字节就在这一步定死。昇腾侧缓存形状是 `(2, num_blocks, block_size, num_kv_heads, head_size)` [C9]，第四维就是 KV 头数，不是 Q 头数。

### 会报什么错

- 整除断言：上游 `Attention.__init__` 里 `assert num_heads % num_kv_heads == 0` [C6]；昇腾 impl 再断言一次，并把商存成 `num_queries_per_kv` [C10]。本模型 16 ÷ 2 = 8，TP=2 时每颗 8 ÷ 1 = 8。
- TP 切分断言：`Qwen3NextAttention` 里 KV 头数不少于 TP 时要求 `total_num_kv_heads % tp_size == 0`，少于时要求 `tp_size % total_num_kv_heads == 0`。本模型 2 个 KV 头，TP 取 1、2、4、8、16 都满足。
- 算子上限：Ascend Extension for PyTorch 6.0.RC2 的 API 文档写明 `num_key_value_heads`「用于支持 GQA 场景」，且 `num_heads` 与它的比值不能大于 64 [S21]。本模型的比值是 8，离上限很远。v0.23 维护分支钉的是 `torch-npu==2.10.0.post4`，这条 64 在新版是否还一样没核到 [I]。

### 开销和什么时候别开

**KV 字节账**（bf16、每 token 每层，`2（K 与 V）× KV 头数 × 256 × 2 B`）[D]：

```
MHA：2 × 16 × 256 × 2 B = 16384 B = 16 KiB
GQA：2 ×  2 × 256 × 2 B =  2048 B =  2 KiB    （TP=2 时每颗 1 个 KV 头：1 KiB）
MQA：2 ×  1 × 256 × 2 B =  1024 B =  1 KiB
```

乘以 10 层全注意力，是 160 / 20 / 10 KiB 每 token；那条请求 237 个 token，TP=1 时分别约 37.0 / 4.63 / 2.31 MiB [D]。TP=2 每颗 10 KiB/token、2.31 MiB 这两个数以 [那条请求](one-request.md) 为准。

**decode 一步、一层、上下文长 S 的三笔账**（TP=1）[D]：

```
读 KV：   2 × 2 × 256 × 2 B × S = 2048·S 字节   （MHA 是 16384·S，差 8 倍）
QK 点乘：16 × S × 256 次乘加                    （和 KV 头数无关）
取 V：   16 × S × 256 次乘加                    （同上）
```

后两行跟 KV 头数没有关系：算子收到的 `num_heads` 还是 16，输出也按 `(num_tokens, num_heads, head_size)` 摆回去 [C12]。

**真正跟着缩的 GEMM 只有 `qkv_proj`**。这个模型的 Q 那段还带一个输出门：`QKVParallelLinear` 的 Q 头数传的是 `total_num_heads × (1 + attn_output_gate)` [C3]，`attn_output_gate` 在源码里缺省取 True、vLLM 的 Qwen3.5-MoE 配置类里没有定义这个字段，因此按 True 算 [I]。于是输出宽度（TP=1）[D]：

```
GQA：16 × 256 × 2（Q 与门）+ 2 × 256 + 2 × 256 = 8192 + 512 + 512 = 9216
MHA：16 × 256 × 2（Q 与门）+ 16 × 256 + 16 × 256 = 8192 + 4096 + 4096 = 16384
```

权重 `2048 × 9216` 对 `2048 × 16384`，这块 GEMM 的权重和乘加各少约 44% [D]；门那一段与 GQA 无关，两边一样。

**什么时候会出问题——TP 把它压回 MHA。** `num_kv_heads` 是每颗的数，不是模型的数；`QKVParallelLinear` 在 `tp_size >= total_num_kv_heads` 时每颗置 1 个 KV 头、另记 `num_kv_head_replicas` 份复制 [C5]。复制之后每颗占用不再下降的那笔账在[张量并行（TP）](tensor-parallel.md)。对 GQA 本身的后果是 `num_queries_per_kv` 随 TP 变小，TP ≥ 16 时每颗 1 个 Q 头配 1 个 KV 头，这一层退回 MHA [D]。

官方文档拿 Qwen3-Next 说过这件事：16 个 Q 头、只有 2 个 KV 头，TP ≥ 16 时「GQA degenerates into MHA」，而 FIA 算子在 `head_dim` 256 的 MHA 场景下跑不起来，于是这个模型不支持 TP ≥ 16 [S16]（<https://docs.vllm.ai/projects/ascend/en/v0.23.0/tutorials/models/Qwen3-Next.html>）。Qwen3.6-35B-A3B 的全注意力层是同一个 `Qwen3NextAttention`、同样是 16 / 2 / 256，这条限制按理同样适用，但没有找到针对它的官方说明 [I]。**KV 头数因此是 TP 的一道软上限**，踩过去不只是多存一份，还可能换掉算子走的分支。

**K/V 没有被复制成 16 份。** `Attention.forward` 里 query 是 `view(-1, num_heads, head_size)`，key / value 是 `view(-1, num_kv_heads, head_size)`，两个形状本来就不同，没有 expand 也没有 repeat [C7]。decode 取缓存时 `key_cache.view(num_block, block_size, -1)` 把 KV 头压进最后一维 [C11]：TP=2 下每颗块形状 `(2048, 1, 256)` 压成 `(2048, 256)`（块大小 2048 见[那条请求](one-request.md)）[D]。边界靠入参还原：`npu_fused_infer_attention_score(..., num_key_value_heads=num_kv_heads, num_heads=num_heads)`；[PagedAttention](paged-attention.md) 那个算子收的是同一对参数。反例是多模态 encoder 的自写注意力：`num_queries_per_kv > 1` 时直接 `torch.repeat_interleave(key, num_repeat, dim=1)` [C15]。

**论文出处**：GQA 被定义为 MQA 的推广，KV 头数取大于 1、小于 Q 头数的中间值，并给出用 5% 原始预训练算力把 MHA checkpoint uptrain 成 GQA 的做法 [S19]。

### 版本差异

main 指 2026-09-21 的源码快照 `baa023ad`，v0.23 维护分支指 `2c59ff10`（2026-09-10），v0.26 分支指 `2ed6cbba`，完整提交号在来源里。v0.26 两行都站在 v0.23 这边：分组那两行一字不差 [C22]，块里的摆法也还是固定压平 [C23]，`_get_kv_cache_view` 在它的 `vllm_ascend` 里 grep 不到。

| 项 | v0.23 维护分支与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 分组本身 | `assert num_heads % num_kv_heads == 0` 后算 `num_queries_per_kv` | 同样两行，一字不差 | GQA 的机制三版没有分叉，跨分支排查不用先看版本 |
| KV 头在块里怎么摆 | 固定压平：`key_cache.view(num_block, block_size, -1)` | 多一个 `_get_kv_cache_view`，`VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时不压平，四维直接进算子 [C18] | 字节数一个不差，但 profiling 上 key 一个是三维一个是四维，照 v0.23 或 v0.26 的经验读 main 的 dump 会对不上 `[!]`；布局这一刀的全貌在 [KV Cache Spec](kv-cache-spec.md) |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 全注意力层用哪个类 | 上游 `vllm/model_executor/models/qwen3_5.py`，`Qwen3_5DecoderLayer` 里 `layer_type == "full_attention"` 分支 |
| 每颗 KV 头数、`head_dim`、`q_size` / `kv_size` | 上游 `vllm/model_executor/models/qwen3_next.py`，`Qwen3NextAttention.__init__` |
| KV 头的切分与复制 | 上游 `vllm/model_executor/layers/linear.py`，`QKVParallelLinear` |
| 整除断言、Q/K/V 形状 | 上游 `vllm/model_executor/layers/attention/attention.py` |
| 缓存形状、分组、交给算子 | `vllm_ascend/attention/attention_v1.py`：`get_kv_cache_shape`、`AscendAttentionBackendImpl.__init__`、`_get_fia_params`、`npu_fused_infer_attention_score` 调用 |
| 真复制的反例 | `vllm_ascend/ops/mm_encoder_attention.py` |
