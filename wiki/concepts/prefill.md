---
id: prefill
title: Prefill
type: concept
summary: 回答第一个字之前，先把整段问题一起算一遍、把要记的笔记写进缓存的那一步。它一步算得多，决定了「多久出第一个字」；短问题一步做完，长问题切成几步。
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
updated: "2026-09-25"
origin: seed
---

你问了一句 37 个 token 的话，模型要回 200 个 token。第一个字出来之前，机器那一步到底在忙什么？为什么这一步能把 37 个 token 一起算，之后却只能一个一个来？

## 第一步 37 个，之后每步 1 个

[那条请求](one-request.md)一共走 200 步，那一页已经把这 200 步数清楚了，这里只抓一件事：**两种步子，送进去的 token 个数不一样**。

```wiki-diagram
file: prefill
```

- **第 1 步叫 prefill（预填充）。** 问题的 37 个 token（位置 0–36）一起送进去，走完 40 层。40 层里只有 10 层全注意力要记笔记，这 10 层每层各往 [KV Cache](kv-cache.md) 写 37 格。走完后只拿位置 36 的输出去挑下一个字，得到回答的第 1 个 token。
- **第 2 到第 200 步叫 decode。** 每步只送进上一步刚挑出来的那 1 个 token，全注意力那 10 层各写 1 格、读前面全部，再挑出下一个。

所以 prefill 这一步**本身就产出了回答的第 1 个 token**：200 个回答 token = 1 步 prefill + 199 步 decode，不是 200 步 decode。

为什么第一步能 37 个一起算？因为问题的 37 个 token 是**已知的**，可以并排送进去；而回答的第 2 个 token 要等第 1 个挑出来才知道是什么，天然只能一个接一个。

37 个一起送进去，也不等于它们互相乱看：注意力打分那一步，第 1 个 token 只看自己，第 37 个看全部 37 个，后面的照样被挡住。到了 decode，每步只有 1 个新 token，拿它去对前面存好的全部笔记打分。两种步子打分的形状为什么不同，在[注意力：Q、K、V](attention-qkv.md)的最后一节。

## 同一个模型，两种完全不同的活

prefill 和 decode 跑的是同一套权重、同一段代码，但对硬件来说像两种不同的活：

| | prefill | decode |
|---|---|---|
| 一步送进去几个 token | 这一步的名额装得下就是整段问题，装不下就切成几步（本例 37 个，一步做完） | 每步 1 个（本例也是 1 个） |
| 一条请求做几次 | 没切就 1 次，切了就是段数（本例 1 次） | 回答长度减 1 次——第 1 个回答 token 由 prefill 产出（本例 199 次） |
| 对 KV Cache | 一次写很多格 | 每步写 1 格、读前面全部——按本例说；投机解码一步会写多格，滑窗、稀疏这类结构也不读全部 |
| 硬件在忙什么 | **算**：大矩阵乘，算力吃满 | **搬**：每步都要把全部权重和笔记读一遍，只为算 1 个 token |
| 用户感受到的 | 多久出第一个字 | 出字的速度（每个字间隔多久） |

「算」和「搬」那一行是理解后面所有优化的钥匙：prefill 卡在算力上，所以怕的是问题太长；decode 卡在显存带宽上，所以要把很多条请求攒成一批一起算，让搬一次权重能多出几个 token。这是按两种步子的形状推出来的判断，具体到哪台机器、哪个长度，要以实测为准。

## 调度器里其实没有「prefill 阶段」

这是最容易被说法带偏的地方。vLLM 的调度器在自己的代码注释里写得很直白：调度器里既没有「prefill 阶段」也没有「decode 阶段」。每条请求只有两个数——「已经算了多少个 token」和「一共要算多少个 token」；每一步就是尽量分名额，让前者追上后者。

第 1 步这条请求差 37 个，就分给它 37 个；第 2 步差 1 个，就分 1 个。用的是同一条规则。「prefill」「decode」是我们给这两种情形起的名字，方便说话，不是代码里的两个分支。展开见[调度器：没有 prefill 和 decode 之分](vllm-scheduler.md)。

这个设计带来两个直接后果：

- **同一批里可以既有 prefill 又有 decode。** 别人的 decode 不用等你的 prefill 做完。
- **长问题的 prefill 可以切成几步做**，这就是[分块预填充](chunked-prefill.md)：一步的名额有上限，超长的问题这一步分一部分、下一步接着分，免得它一个人占满一整步、让所有正在 decode 的请求卡住。那条请求只有 37 个 token，远小于一步的名额，所以一步就做完了。

## 到了注意力这一步，区别又回来了

调度器不分阶段，但真正干活的注意力计算要分：「37 个 Q 对 37 个 K」和「1 个 Q 对缓存里的 100 多个 K」，适合的算法和读内存的方式不一样。所以昇腾这边会先给这一批贴个标签，看它属于哪种情形：

- 纯 prefill，缓存里没有能复用的开头——那条请求的第 1 步；
- prefill，但开头一段命中了 [Prefix Caching](prefix-caching.md)，那段不用重算；
- 这一批全是 decode——那条请求的第 2 到 200 步；
- prefill 和 decode 混在一批，或者 prefill 被切开了；
- 投机解码。

不管贴哪个标签，把新算的 K、V 写进缓存走的是同一个入口；不同的是接下来怎么读缓存、调哪个算子，见 [PagedAttention](paged-attention.md) 里的分派。

## 几个常见误解

- **「prefill 是预处理，不算真正的推理」。** 它就是完整走一遍 40 层，而且是整条请求里单步计算量最大的一步。
- **「prefill 不产出 token」。** 它产出回答的第 1 个 token。顺带一提，「多久出第一个字」量的是用户看见第 1 个字的时间：排队、调度、挑字都在里面，prefill 的计算只是其中一段，不能把它整个记到算力账上。
- **「问题有 37 个 token，所以 prefill 要挑 37 次字」。** 只挑 1 次。前 36 个位置的输出算出来就丢了——需要的只是它们留在缓存里的 K 和 V。

## 对照源码

### 开销和什么时候别开

- 「prefill 算、decode 搬」的对比是按两种步子的形状推出来的 [I]，不是本库实测的数。
- TTFT（首个 token 延迟）包含排队、调度和采样，prefill 前向只是其中一段 [I]。
- 「一步写多格」的例外是投机解码（下表 `SpecDecoding`）；滑窗 / 稀疏注意力不读全部历史 [I]。

### 版本差异

以下结论在 releases/v0.23.0 与 releases/v0.26.0rc 两个分支都核过；main 配套的上游没有检出，main 侧未单独核。

### 源码位置

- **调度器不分阶段**：上游 `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头注释——没有 decoding phase 也没有 prefill phase，每条请求只有 `num_computed_tokens` 和 `num_tokens_with_spec`，每步分配 token 让前者追上后者；注释里明说这套规则覆盖 chunked prefill、prefix caching 和投机解码 [C1]。
- **昇腾后端的五种情形**：`vllm_ascend/attention/attention_v1.py` 的枚举 `AscendAttentionState` [C2]。上半列表按枚举名和它在后端里的用法概括 [I]：

  | `AscendAttentionState` | 这一批是什么情形 |
  |---|---|
  | `PrefillNoCache` | 纯 prefill，缓存里没有可复用的前缀 |
  | `PrefillCacheHit` | prefill，但开头一段命中了前缀缓存 |
  | `DecodeOnly` | 这一批全是 decode |
  | `ChunkedPrefill` | prefill 和 decode 混在一批，或 prefill 被切开了 |
  | `SpecDecoding` | 投机解码 |

- **写 KV 的同一个入口**：同文件 `do_kv_cache_update` 调 `DeviceOperator.reshape_and_cache`，按 `slot_mapping` 把本步的 key / value 写进 `key_cache` / `value_cache`，不区分情形 [C3]。
- **只在每条请求最后一个位置采样**：`vllm_ascend/worker/model_runner_v1.py` 里不走投机解码时 `num_sampled_tokens` 每请求为 1，`logits_indices = query_start_loc[1:] - 1`，即每条请求本步最后一个 token 的位置；注释还说明被切开的 prefill 也照样采样，结果丢弃 [C4]。
- **写 37 格的是哪几层**：40 层里只有 10 层全注意力写 KV Cache，层数与分布见[贯穿例子](one-request.md)。
