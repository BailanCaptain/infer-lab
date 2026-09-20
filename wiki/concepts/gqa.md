---
id: gqa
title: "GQA：16 个 Q 头共用 8 组 K/V，省的是显存不是乘加"
type: concept
summary: Q 保持 16 个头，K 和 V 只留 8 个头，相邻两个 Q 头共用一组；KV Cache 因此正好减半，而注意力本身一次乘加都没少。
aliases: [GQA, Grouped-Query Attention, 分组查询注意力, 分组查询, MQA, Multi-Query Attention, 多查询注意力, MHA, Multi-Head Attention, 多头注意力, num_key_value_heads, num_kv_heads, num_queries_per_kv, KV 头数]
chapters: ["04"]
order: 15
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L79-L94
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L126-L134
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L150-L151
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L189-L196
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1033-L1042
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L281-L292
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L483-L488
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L603-L608
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L105-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1211-L1220
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1359
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1371-L1381
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1491-L1501
  - vllm-ascend@2c59ff10:vllm_ascend/ops/mm_encoder_attention.py#L89-L96
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3-Next.md#L249-L249
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L496-L497
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1304-L1311
  - https://arxiv.org/abs/2305.13245
  - https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json
  - https://www.hiascend.com/doc_center/source/zh/Pytorch/60RC2/apiref/apilist/ptaoplist_000787.html
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求的模型本身就是 GQA，它那 112 KiB 正是拿 8 个 KV 头而不是 16 个算出来的
  - to: kv-cache
    kind: builds-on
    note: 先看清缓存里躺的是每层每 token 的 K 和 V 两份向量，才看得出 GQA 减的是这两份里的头数
  - to: attention-cost
    kind: builds-on
    note: 那一页把四种注意力的每 token 字节数并排算过，GQA 那条 4096 B 是这一页的起点，不重算
  - to: mla
    kind: alternative-to
    note: 同一个问题（KV 太占显存）的另一条路——GQA 减 K/V 的头数，MLA 换掉存进去的东西
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

GQA 只改一个数：**Q 还是 16 个头，K 和 V 只留 8 个头，相邻两个 Q 头共用同一组**。换来的是 KV Cache 正好减半；换不来算力——**16 个 Q 头照样一个不少地各算一遍全序列**。

```wiki-diagram
file: gqa
```

## 那条请求走到这里

[那条请求](one-request.md)跑的 Qwen3-0.6B 本身就是 GQA 模型，一个设定都不用改。模型卡的 config.json 里 `num_attention_heads: 16`、`num_key_value_heads: 8`、`head_dim: 128` [S20]，这三个数原样传进 `Qwen3Attention`，于是这一层的 `qkv_proj` 被切成三段 [C3]：

```
q_size  = 16 × 128 = 2048
kv_size =  8 × 128 = 1024
qkv_proj 输出宽度 = 2048 + 1024 + 1024 = 4096
```

`head_dim` 是 config 里明写的 128，不是 `hidden_size / num_heads = 1024 / 16 = 64`——源码那行是 `head_dim or hidden_size // total_num_heads`，给了就用给的 [C1]。**所以 Qwen3-0.6B 的 Q 有 2048 维，比 hidden 还宽一倍**，这点容易记反。

`num_kv_heads` 接着被交给 `Attention` 层 [C2]，再原样填进 `FullAttentionSpec(num_kv_heads=...)` [C8]——**KV Cache 每块多少字节，就是在这一步定死的**。

只把 8 换成别的数，其余全不动，账是这样（`2 × n_kv × 128 × 2 B × 28 层`，推导在 [KV Cache Spec](kv-cache-spec.md)）[D]：

| 头数分配 | 每 token 每层 | 每 token 全模型 | 237 个 token 一共 |
|---|---|---|---|
| MHA：16 个 KV 头 | 8192 B | 224 KiB | 51.8 MiB |
| **GQA：8 个 KV 头（那条请求）** | **4096 B** | **112 KiB** | **25.9 MiB** |
| MQA：1 个 KV 头 | 512 B | 14 KiB | 3.2 MiB |

不多不少正好一半，因为 8/16 就摆在式子里。四种注意力结构各自的字节账在[四种注意力的代价](attention-cost.md)，不在这儿重算。

## 8 不是算出来的，是训练时定的

GQA 的原始论文把它定义成 MQA 的推广：MQA 只用一个 KV 头，decode 快但掉质量；GQA 取一个**大于 1、小于 Q 头数**的中间值，并给出用 5% 原始预训练算力把已有 MHA checkpoint uptrain 成 GQA 的做法 [S19]。所以 8 是训练时挑的、写死在 config 里的超参，推理侧只能照读 [I]。

推理侧对这个数只有一条硬约束——整除：`Attention.__init__` 里 `assert num_heads % num_kv_heads == 0` [C6]，昇腾的 impl 再断言一次，并把商存成 `num_queries_per_kv` [C10]。算子那头还多一条上限——官方 API 文档写明 `num_key_value_heads`「用于支持 GQA 场景」，且 `num_heads` 与它的比值**不能大于 64** [S21]。那份文档是 Ascend Extension for PyTorch 6.0.RC2 的，而 v0.23 维护分支钉的是 `torch-npu==2.10.0.post4`，这条 64 在新版是否还一样我没核到 [I]。

## 省的是字节数和读取量，不是乘加次数

decode 一步、一层、上下文长 S，三笔账分开看 [D]：

```
读 KV：  2 × 8 × 128 × 2 B × S = 4096·S 字节   （MHA 是 8192·S，减半）
QK 点乘：16 × S × 128 次乘加                    （和 n_kv 无关）
取 V：  16 × S × 128 次乘加                    （同上）
```

中间两行跟 `num_kv_heads` 没有任何关系：算子收到的 `num_heads` 还是 16，输出也还按 `(num_tokens, 16, 128)` 摆回去 [C12]。**真正跟着缩水的只有 `qkv_proj` 那块 GEMM**：`1024 × 4096` 而不是 MHA 的 `1024 × 6144`，权重和乘加各少三分之一 [C5]。

所以 GQA 做的是抬高算术强度：乘加次数照旧，要搬的 KV 少一半。decode 卡在访存上，这正是它见效的地方；prefill 那种算力吃紧的场景基本感觉不到 [D]。想省乘加得换结构，[MLA](mla.md) 走的是另一条路，代价也不同。

## 8 份 K/V 没有被复制成 16 份

从 Python 侧看，K 和 V 从头到尾只有 8 份。

- `Attention.forward` 里 query 是 `view(-1, num_heads, head_size)`，key / value 是 `view(-1, num_kv_heads, head_size)`——两个形状本来就不一样，没有 expand 也没有 repeat [C7]。昇腾 impl 的 docstring 把这条形状契约原样抄了一遍 [C14]。
- 取缓存那一步，8 个头干脆被压进最后一维：`key_cache.view(num_block, block_size, -1)` 把 `(128, 8, 128)` 变成 `(128, 1024)`，头的边界在张量里已经看不见了 [C11]。
- 边界靠入参还原：`npu_fused_infer_attention_score(..., num_heads=16, num_key_value_heads=8)` [C12]；[PagedAttention](paged-attention.md) 那个算子收的是同一对参数 `num_heads` / `num_kv_heads`。**分组发生在算子内部**，Python 这一侧一次都没摊开。

同一个仓库里有反例：多模态 encoder 那条自己写的注意力**真的复制**——`num_queries_per_kv > 1` 时直接 `torch.repeat_interleave(key, num_repeat, dim=1)` [C15]。它没走 FIA，只能自己把 K/V 摊平。所以「GQA 要不要复制」没有统一答案，得看这一步交给谁算。

## TP 会改这两个数，改到相等就不再是 GQA

`num_kv_heads` 是**每卡**的数，不是模型的数：`max(1, total_num_kv_heads // tp_size)`，旁边两个 assert 划出边界 [C1]；`QKVParallelLinear` 把同一件事写成 `tp_size >= total_num_kv_heads` 时置 1、另记 `num_kv_head_replicas` [C5]。KV 被复制之后每卡占用不再下降的那笔账在 [Tensor Parallel](tensor-parallel.md)，这里只说对 GQA 本身的后果：**`num_queries_per_kv` 会一路掉到 1，这一层就退回 MHA 了**。

官方文档拿 Qwen3-Next 举过这个例子：16 个 Q 头、只有 2 个 KV 头，TP ≥ 16 时「GQA degenerates into MHA」，而 FIA 算子在 `head_dim` 256 的 MHA 场景下跑不起来，于是这个模型索性不支持 TP ≥ 16 [S16]（<https://docs.vllm.ai/projects/ascend/en/v0.23.0/tutorials/models/Qwen3-Next.html>）。**KV 头数因此是 TP 的一道软上限**，踩过去不只是多存一份，还可能换掉算子走的分支。

## 两个分支只在「8 个头摆在哪」上分叉

下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`（2026-09-10），完整提交号在来源里。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 分组本身 | `assert num_heads % num_kv_heads == 0` 后算 `num_queries_per_kv` [C10] | 同样两行，一字不差 [C17] | GQA 的机制两版没有分叉，跨分支排查不用先看版本 |
| 8 个 KV 头在块里怎么摆 | 固定压平：`key_cache.view(num_block, block_size, -1)` | 多一个 `_get_kv_cache_view`，`VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时不压平，四维直接进算子 [C18] | 字节数一个不差，但 profiling 上 key 一个是三维一个是四维，照 v0.23 的经验读 main 的 dump 会对不上 `[!]`；布局这一刀的全貌在 [KV Cache Spec](kv-cache-spec.md) |

## 常见误解

- **「GQA 省的是算力」**——省的是 KV 的字节数和 decode 每步要搬的字节数。16 个 Q 头照样各算一遍全序列，QK 点乘和取 V 的乘加次数和 MHA 一模一样；真变小的只有 `qkv_proj` 那块 GEMM [D]。
- **「算注意力前要先把 8 份 K/V 复制成 16 份」**——解码器这条路不用，`num_heads` 和 `num_key_value_heads` 两个数一起交给算子，分组在算子内部完成。倒是多模态 encoder 那条自写路径真的 `repeat_interleave`。
- **「GQA 和 MQA、MHA 是三种并列的东西」**——是同一个轴上的三个点，轴就是 `num_key_value_heads`：等于 1 是 MQA，等于 `num_heads` 是 MHA，夹在中间才叫 GQA [S19]。所以 TP 把它压到 1 之后，代码和算子都不会报错，只是这一层安静地变回了 MHA。
