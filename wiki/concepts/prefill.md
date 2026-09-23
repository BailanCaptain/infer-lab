---
id: prefill
title: Prefill
type: concept
summary: 生成第一个字之前，把问题里每个 token 的 K 和 V 算出来写进缓存的那一步。它算得多，短问题一步做完、长问题切成几步，决定了「多久出第一个字」。
aliases: [预填充, 首 token 阶段, prompt 阶段, prefill 阶段, TTFT]
chapters: ["05"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L147-L152
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1408-L1428
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1296-L1310
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 这一页所有的数（37 个 token 一步算完、之后 199 步每步 1 个）都是那条请求的数
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 一句话

生成第一个回答 token 前，模型先把问题里已知的 token 过一遍，这个计算阶段叫 prefill。**这些位置是并行算完的，不分先后；每层顺手把它们的 K 和 V 写进 [KV Cache](kv-cache.md)。采样只取最后一个位置的输出，得到回答的第 1 个 token** [C4]。随后逐个往下生成的阶段叫 decode。

```wiki-diagram
file: prefill
```

## 同一个模型，两种完全不同的负载

prefill 和 decode 跑的是同一套权重、同一段代码，但对硬件来说像两种不同的活：

| | prefill | decode |
|---|---|---|
| 一步送进去几个 token | 这一步的 token 名额吃得下就是整段问题，吃不下就切成几步（本例 37 个，一步做完） | 每步 1 个（本例也是 1 个） |
| 一条请求做几次 | 没切块就 1 次，切了就是块数（本例 1 次） | 回答长度减 1 次——第 1 个回答 token 由 prefill 产出（本例 199 次） |
| 对 KV Cache | 一次写很多格 | 每步写 1 格、读前面全部——按本例说；投机解码一步写多格（下表 `SpecDecoding`），滑窗/稀疏结构不读全部 |
| 硬件在忙什么 | **算**：大矩阵乘，算力吃满 | **搬**：每步都要把全部权重和缓存读一遍，只为算 1 个 token |
| 用户感受到的 | 多久出第一个字（TTFT） | 出字的速度（每个字间隔多久） |

「算」和「搬」那一行是理解后面所有优化的钥匙 [I]：prefill 的瓶颈在算力，所以怕的是问题太长；decode 的瓶颈在显存带宽，所以要把很多条请求攒成一批一起算，让搬一次权重能多出几个 token。

为什么 prefill 能一次算 37 个、decode 却只能一个一个来？因为问题的 37 个 token 是**已知的**，可以并排送进去；而回答的第 2 个 token 要等第 1 个采样出来才知道是什么，天然只能串行。

## 那条请求走到这里

[那条请求](one-request.md)总共 200 步：

- **第 1 步是 prefill。** 37 个 token（位置 0–36）一次 forward。每一层写 37 格缓存。28 层全部过完后，只取位置 36 的输出去采样，得到回答的第 1 个 token。
- **第 2 到第 200 步是 decode。** 每步送进上一步刚采样出来的那 1 个 token，写 1 格、读全部，采样出下一个。

注意 prefill 这一步**本身就产出了回答的第 1 个 token**，所以 200 个回答 token 对应的是 1 步 prefill 加 199 步 decode，不是 200 步 decode。

## 调度器里其实没有「prefill 阶段」

这是最容易被说法带偏的地方。vLLM 的调度器在 `schedule()` 开头的注释里写得很直白：调度器里没有「prefill 阶段」也没有「decode 阶段」，每条请求只有「已经算了多少 token」和「一共要算多少 token」两个数，每一步就是尽量分 token 名额让前者追上后者 [C1]。

第 1 步这条请求差 37 个，就分给它 37 个；第 2 步差 1 个，就分 1 个。用的是同一条规则。「prefill」「decode」是我们给这两种情形起的名字，方便说话，不是代码里的两个分支。展开见[调度器：没有 prefill 和 decode 之分](vllm-scheduler.md)。

这个设计带来两个直接后果：

- **同一批里可以既有 prefill 又有 decode。** 别人的 decode 不用等你的 prefill 做完。
- **长问题的 prefill 可以切成几步做**，这就是[分块 prefill](chunked-prefill.md)：一步的 token 名额有上限，超长的问题这一步分一部分、下一步接着分，免得它一个人占满一整步、让所有正在 decode 的请求卡住。那条请求只有 37 个 token，远小于一步的名额，所以一步就做完了。

## 到了注意力算子，区别又回来了

调度器不分阶段，但算子要分——「37 个 Q 对 37 个 K」和「1 个 Q 对缓存里的 100 多个 K」适合的算法和内存访问方式不一样。昇腾后端用一个枚举标记这一批属于哪种情形 [C2]：

| `AscendAttentionState` | 这一批是什么情形 |
|---|---|
| `PrefillNoCache` | 纯 prefill，缓存里没有可复用的前缀——那条请求的第 1 步 |
| `PrefillCacheHit` | prefill，但开头一段命中了 [Prefix Caching](prefix-caching.md) |
| `DecodeOnly` | 这一批全是 decode——那条请求的第 2 到 200 步 |
| `ChunkedPrefill` | prefill 和 decode 混在一批，或 prefill 被切开了 |
| `SpecDecoding` | 投机解码 |

第二列是按枚举名和它在后端里的用法概括的 [I]。不管哪种情形，把新算的 K、V 写进缓存用的是同一个入口 [C3]；不同的是接下来怎么读缓存、调哪个算子，见 [PagedAttention](paged-attention.md) 里的分派。

## 常见误解

- **「prefill 是预处理，不算真正的推理」。** 它就是完整的 28 层前向，而且是整条请求里单步计算量最大的一步。
- **「prefill 阶段不产出 token」。** 它产出回答的第 1 个 token。顺带一提，TTFT 量的是用户看见第 1 个字的时间：排队、调度、采样都在里面，prefill 的计算只是其中一段，不能把 TTFT 整个记到算力账上 [I]。
- **「问题有 37 个 token，所以 prefill 要采样 37 次」。** 只采样 1 次。前 36 个位置的输出算出来就丢了——需要的只是它们留在缓存里的 K 和 V。
