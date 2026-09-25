---
id: context-parallel
title: "上下文并行（CP）：一条长请求分给几颗 NPU，PCP 分着算、DCP 分着存"
type: feature
summary: 一条请求太长时，把它的 token 分到几颗 NPU 上：PCP 多加几颗 NPU 一起算问题，DCP 不加 NPU、把 KV Cache 交错着分开存。
aliases: [Context Parallel, 上下文并行, CP, PCP, DCP, Prefill Context Parallel, Decode Context Parallel, 前缀上下文并行, 解码上下文并行, prefill_context_parallel_size, decode_context_parallel_size, cp_kv_cache_interleave_size, enable_cp, enable_dcp, enable_pcp, AscendAttentionCPImpl, AscendMlaCPImpl, AscendAttentionDCPImpl]
chapters: ["15"]
order: 20
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/context_parallel.md#L5-L12
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/context_parallel.md#L11-L20
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/context_parallel.md#L64-L74
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/context_parallel.md#L76-L85
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/context_parallel.md#L35-L49
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/context_parallel.md#L126-L144
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/context_parallel.md#L91-L96
  - vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L123-L126
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L231-L263
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L269-L276
  - vllm-ascend@2c59ff10:vllm_ascend/worker/pcp_utils.py#L663-L688
  - vllm-ascend@2c59ff10:vllm_ascend/worker/pcp_utils.py#L704-L722
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/common_cp.py#L111-L130
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/common_cp.py#L186-L197
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/attention_cp.py#L830-L839
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/attention_cp.py#L573-L581
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/attention_cp.py#L284-L285
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/mla_cp.py#L263-L267
  - vllm-ascend@2c59ff10:vllm_ascend/attention/context_parallel/mla_cp.py#L757-L760
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L349-L358
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L743-L761
  - vllm@0fc695fc:vllm/config/parallel.py#L343-L356
  - vllm@0fc695fc:vllm/config/parallel.py#L774-L780
  - vllm@0fc695fc:vllm/config/parallel.py#L482-L491
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L226-L234
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L66-L70
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L613-L617
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L983-L987
  - vllm@0fc695fc:vllm/config/model.py#L1290-L1295
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/context_parallel.md#L5-L7
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L336-L344
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/utils.py#L189-L192
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/context_parallel/attention_cp.py#L173-L174
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/context_parallel.md#L52-L65
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/context_parallel.md#L109-L123
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/context_parallel.md#L5-L7
  - vllm-ascend@baa023ad:vllm_ascend/attention/utils.py#L196-L204
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1498
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1515-L1526
  - vllm@568afb3a:vllm/config/parallel.py#L505-L520
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/context_parallel.md#L20-L25
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L508-L509
  - vllm@568afb3a:vllm/v1/core/kv_cache_coordinator.py#L570-L580
  - vllm@568afb3a:vllm/v1/core/kv_cache_coordinator.py#L757-L770
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L702-L714
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: 每颗 NPU 的 KV 预算就是那一页的 spec 按 dcp × pcp 除出来的
  - to: block-table
    kind: builds-on
    note: CP 下槽位走块表里 _compute_pcp_dcp_slot_mapping 那条分支，虚拟块与行扩展都在那一页
  - to: tensor-parallel
    kind: builds-on
    note: DCP 不新建通信组、直接骑在 TP 组上，所以 tp % dcp == 0 是硬约束
  - to: attention-backend-family
    kind: builds-on
    note: enable_cp() 为真时 get_impl_cls 换成 CP 版 impl 类，挑后端那一层在那一页
  - to: one-request
    kind: builds-on
    note: 把那条请求的问题换成 128K，每 token 每层每颗 1 KiB 这个数才派得上用场
  - to: sequence-parallel
    kind: conflicts-with
    note: main 的 PCP 兼容表把四个后端的 SP + PCP 全标成不兼容；v0.23 上同开则会悄悄改大 max_num_batched_tokens
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 问题换成 12.8 万个 token

[那条请求](one-request.md)的问题只有 37 个 token。现在把它换成一份 12.8 万个 token（128K）的长文档，模型还是 Qwen3.6-35B-A3B，还是两颗 NPU、每颗分一半注意力。会发生两件事：

- **第一步要算很久。** prefill（先把问题里所有 token 一起算一遍）要把 12.8 万个 token 走完 40 层，才吐出回答的第一个字。第一个字要等多久（TTFT），几乎全花在这里。
- **KV Cache 变大了。** KV Cache 就是把算过的 K 和 V 存起来、下一步直接读的那份「笔记」。这个模型只有 10 层全注意力要存它，每个 token 在每颗 NPU 上一共 10 KiB。37 个 token 时这点不值一提；12.8 万个 token 就是每颗 NPU 1.25 GiB，一条请求。

上下文并行（Context Parallel，CP）就是冲着「一条请求太长」来的：**把这一条请求的 token 分到几颗 NPU 上**。它是两个特性共用的名字，解决的正好是上面两件事：

- **PCP（Prefill Context Parallel）** 分的是 prefill 这一步要算的 token。多加几颗 NPU，一起算第一步，目的是让第一个字早点出来。
- **DCP（Decode Context Parallel）** 分的是写进 KV Cache 的那一份。NPU 一颗不加，每颗只存这条请求的一部分 KV，目的是压每颗 NPU 上的 KV 占用。

两者分工不同，条件也完全不同，下文每一句都会写清说的是哪一个。另外先记一句：**PCP 在三个版本上换过两轮身份**——v0.23 能用，v0.26 被整个拿掉，main 又以实验功能接回来。照一个版本的文档配另一个版本，大概率出错。

## DCP：消掉 TP 多存的那几份 KV

DCP 省显存，省的是一种很具体的浪费。先看这个模型的注意力有几个 KV 头：**只有 2 个**。

张量并行（TP）把注意力按头切给几颗 NPU。TP=2 时正好一颗一个 KV 头，不多不少。可如果把 TP 开到 4，2 个头不够 4 颗 NPU 分——每颗至少得拿一个头才能算，于是 vLLM 让每个头**复制一份**，两颗 NPU 拿同一个头、存同一份 KV。TP 开到 8，每个头就存了 4 份。

DCP 做的就是把这几份重复的去掉：本来两颗 NPU 存着同一个头的同一段 KV，现在一颗存单号 token、一颗存双号 token。算一下这条 128K 的请求，只看 10 层全注意力：

| 配置 | 每颗 NPU 存几个 token 的 KV | 每颗 NPU 的 KV | 所有 NPU 加起来 |
|---|---|---|---|
| TP=2 · DCP=1 | 131072 | 1.25 GiB | 2.5 GiB（正好一份） |
| TP=4 · DCP=1 | 131072 | 1.25 GiB | 5 GiB（两份） |
| TP=4 · DCP=2 | 65536 | 0.625 GiB | 2.5 GiB |
| TP=8 · DCP=1 | 131072 | 1.25 GiB | 10 GiB（四份） |
| TP=8 · DCP=4 | 32768 | 320 MiB | 2.5 GiB |

规律一眼能看出来：**DCP 能开多大，取决于 KV 本来重复了几份。** 这也是本页例子的尴尬之处——TP=2 时根本没有重复，DCP 只能取 1。想用 DCP，得先把 TP 开到 4 以上，让重复出现，再用 DCP 把它消掉。

DCP 不需要新的 NPU，它就借 TP 那几颗用，所以 DCP 必须能整除 TP。

## PCP：多加几颗 NPU，一起算第一步

PCP 反过来，它要加 NPU。开 TP=2、PCP=2，就是两组 TP 各两颗，一共 4 颗 NPU；12.8 万个 token 的问题切开，两组各算一部分。

切法有个讲究：不是简单地前一半给第一组、后一半给第二组。注意力里每个 token 要回头看它前面所有 token，越靠后的 token 要看的越多、算得越重。所以 PCP 把问题切成 2 × PCP 段，**第一段和最后一段配成一对**、第二段和倒数第二段配成一对，分给同一组，这样每组的计算量才差不多。

官方在 DeepSeek-R1 上测过 128K 长问题：加上 PCP 之后，第一个字出来的时间从 73.2 秒降到 46.0 秒，之后每吐一个字的时间（TPOT）几乎没变，82 毫秒对 83 毫秒。**PCP 只管第一步，之后的 decode（一次吐一个 token）它帮不上。**

PCP 目前不能和数据并行（DP，把整个模型复制几份，请求分给不同副本各算各的）同时开。

## KV 交错着放，谁也没有完整的一份

不管是 PCP 还是 DCP，写 KV 的时候都不是「一颗存前半段、一颗存后半段」，而是**一个 token 一个 token 轮着放**：第 0 个 token 给第 0 颗，第 1 个给第 1 颗，再回到第 0 颗……

```wiki-diagram
file: context-parallel
```

各颗 NPU 跑的是同一张块表、同一段代码。区别只在于：轮到别人的那些位置，这颗就跳过不写。

这个「一个一个轮」可以改粗。改成「一块一块轮」——第 0 颗的一块写满了，才轮到第 1 颗——要把 KV 整块传给别的机器时（比如 [PD 分离](pd-disaggregation.md)：prefill 和 decode 放在不同机器上跑）就得这么设，否则传输那边对不上。

## 每颗只有一段 KV，注意力怎么算完整

注意力要拿当前 token 去和前面**所有** token 的 KV 比。可现在每颗 NPU 手里只有一段 KV，有两种办法：

**办法一：先把 KV 凑齐。** PCP 在 prefill 时走这条。每算一层，各颗 NPU 做一次 all-gather——每颗把自己那份发给所有 NPU，最后大家都有全部——凑出这一层完整的 KV，算完立刻扔掉，不留着占显存。

**办法二：各算各的，再把结果合起来。** DCP 在 decode 时走这条。每颗拿自己那段 KV 先算出一个「局部答案」，外加一个记录「这一段占了多少分量」的校正数（数学上叫 log-sum-exp，简称 lse）。然后各颗 NPU 用 all-to-all（每颗 NPU 给每颗 NPU 都发一份不同的数据）交换这些局部答案，按校正数加权合并，结果和一次看完全部 KV 算出来的一模一样。

办法二是 DCP 省显存的根本：**合并只要每段的答案和校正数，不要每段的 KV**。decode 路上，完整的 KV 从头到尾没在任何一颗 NPU 上出现过。

## 这个模型开 CP，会先撞上什么

Qwen3.6-35B-A3B 的 40 层里，有 30 层是[线性注意力](linear-attention.md)。这 30 层不存 KV Cache，只存一份固定大小的「状态」，和问题多长无关。CP 分的是按 token 增长的 KV，这份状态它分不了，也不必分。

麻烦在于，这种「全注意力 + 线性注意力」混着用的模型，调度器那一层对 CP 有专门的限制，而且两个版本不一样：

- **v0.23 配套的上游**：混合模型只要开着[前缀缓存](prefix-caching.md)（重复出现的问题开头直接复用已算好的 KV），启动时就要求 DCP 和 PCP 都必须是 1，否则直接报错。
- **v0.26 配套的上游**：DCP 放行了——全注意力那部分 KV 照常分开存，线性注意力的状态每颗各存一整份；PCP 仍然不允许。

这只是上游调度那一层的门。昇腾这边的 DCP 实现能不能跑这个模型，本库还没有核到。

## 它和序列并行（SP）不是一回事

名字都带「并行」，都在 token 这个方向上动刀，这是本章最常见的混淆。但切的东西、持有多久、省下什么，没有一样相同：

| | 上下文并行（CP） | [序列并行（SP）](sequence-parallel.md) |
|---|---|---|
| 切什么 | 一条请求的 token，以及它的 KV Cache | 一层里两次对答案之间的那段中间结果 |
| 持有多久 | 每颗 NPU 长期只存一部分 KV | 只在那几行里切开，过了马上凑回全长 |
| NPU 数 | PCP 加，DCP 不加 | 不加，就是 TP 那几颗 |
| 省什么 | 每颗的 KV 占用（DCP）、第一个字的等待时间（PCP） | 通信量没省，省的是那几步的计算 |

两者还会互相干扰：SP 和 PCP 同开时，一步最多算多少 token 的上限会被悄悄改大；main 干脆把 SP + PCP 标成不兼容。

## 常见误解

- **「CP 就是 SP，换个说法而已」**——切的东西不同。SP 切的是一层内部的中间结果，马上就凑回去；CP 切的是请求的 token 和它的 KV Cache，每颗 NPU 长期只存一部分。
- **「开了 DCP，注意力总得先把 KV 凑齐」**——decode 路上从没凑齐过，合的是局部答案和校正数。先凑 KV 的是 PCP 的 prefill。
- **「KV 默认是一块一块分的」**——默认是一个 token 一个 token 轮着分。要做 PD 分离、KV 池这类传 KV 的事，必须手动改成按块分。
- **「DCP 想开多大开多大」**——开多大取决于 KV 本来重复了几份。本页的例子 TP=2 没有重复，DCP 只能是 1。

## 对照源码

### 怎么开

两个开关分别管两件事：`--prefill-context-parallel-size`（PCP）与 `--decode-context-parallel-size`（DCP），交错粒度是 `--cp-kv-cache-interleave-size`，默认 1 [C22]。官方示例 `tp=2 pcp=2` 要 4 颗 NPU：世界大小是 `pp × tp × pcp` [C23]，用户指南写作 `tensor_parallel_size * prefill_context_parallel_size` [S3]。DCP 不新建通信组，上游只要求 `tp % dcp == 0` [C24]。

DCP 的约束按注意力类型分 [S3]：

- MLA 类（如 DeepSeek-R1）：`tp >= dcp` 且 `tp % dcp == 0`。
- GQA 类（如 Qwen3-235B）：`(tp // num_key_value_heads) >= dcp` 且 `(tp // num_key_value_heads) % dcp == 0`。

代入本页的模型（`num_key_value_heads: 2` [S42]）[D]：TP=2 时 `2 // 2 = 1`，DCP 只能取 1；TP=4 时可取 2；TP=8 时可取 2 或 4。每颗 NPU 的 KV 头数是 `max(1, total_num_kv_heads // tp)`，注释原话「replicate the KV heads」[C29]，上半那张表的「几份」就是从这里来的。

要做 KV 传输（PD 分离、KV 池）时，交错粒度必须设成 `block_size`，让交错变成块级 [S4]：

```bash
vllm serve deepseek-ai/DeepSeek-V2-Lite \
    --tensor-parallel-size 2 \
    --decode-context-parallel-size 2 \
    --cp-kv-cache-interleave-size 128 \
    --kv-transfer-config '{...}'
```

示例里的 `128` 是通用模型 `block_size` 的默认值。本页这个混合模型的块大小不是 128：TP=2 时 2048、TP=4 时 1024、TP=8 时 512（推导在[那条请求](one-request.md)），照抄示例会对不上。

main 上 PCP 要先 `VLLM_USE_V2_MODEL_RUNNER=1`，只在 ModelRunner V2 上跑 [S34]。

### 会报什么错

- **v0.23 · PCP 与 DP 同开**：`_validate_parallel_config` 在 `pcp > 1` 且 `dp > 1` 时抛错 [C20]。
- **v0.26 配套上游 · 同一条规则搬进 `ParallelConfig`**：`ValueError("PCP does not support data parallelism yet.")`；PCP 开着时 DCP 只能取 `1`、`pcp` 或 `tp × pcp`，否则报 `When PCP is enabled, DCP must be disabled, span the PCP axis, or span the full TP x PCP axis.` [C40]。
- **v0.23 · 交错粒度与块大小不等**：配了 `--kv-transfer-config`、`cp_size > 1` 而 `cp_kv_cache_interleave_size != block_size` 时直接 `AssertionError`。**同一段代码里还藏着一条不报错的**：稀疏（SFA）模型下同样的不匹配只打一条 warning，然后把值改成 `block_size` [C21] `[!]`——不翻日志就看不出配置被换过。
- **v0.26 / main · 拦 PCP 的那道门**：`not use_v2_model_runner and pcp > 1` 就抛错，信息写死「not supported by vLLM Ascend」[C31][C38]，条件里却留着 MRV2 的活口 `[!]`。
- **上游 KV spec 那一层**：滑动窗口的 manager 里 `assert dcp_world_size == 1, "DCP not support sliding window attn now."` [C27]；chunked local attention 与 Mamba 的 manager 各有一句同样的 assert [C28]。这几句都在查前缀缓存命中的那个函数里。
- **上游 v0.23 · 混合模型**：`HybridKVCacheCoordinator` 构造时 `assert dcp_world_size == 1, "DCP not support hybrid attn now."`、`assert pcp_world_size == 1, "PCP not support hybrid attn now."` [C43]。这个类只在开前缀缓存、且 KV Cache 分组多于一个时才用；关掉前缀缓存走的是另一个 coordinator [C46]。本页模型（全注意力 + 线性注意力两组）开前缀缓存时会撞上这一句 [D]；关掉之后能不能跑通未核。
- **上游 v0.26 · 混合模型**：PCP 的 assert 还在；DCP 改成只允许全注意力与 Mamba 两类分组，注释写「DCP shards full-attention KV across ranks and replicates Mamba state」[C44]；查前缀命中时只给全注意力那组传真实的 `dcp_world_size`，其余组传 1 [C45]，所以 Mamba manager 里那句 assert 不再触发。

### 开销和什么时候别开

- **短请求别开。** [那条请求](one-request.md) 237 个 token，KV 每颗一共 2.31 MiB，没什么可省；而且 TP=1 或 TP=2 时这个模型的 DCP 只能是 1。
- **每颗 KV 占用** [D]：`131072 × 10 KiB = 1.25 GiB`（TP=2，每 token 每层每颗 1 KiB、10 层，数取自[那条请求](one-request.md)）；DCP 取 d 时除以 d。KV 预算本来就是按 `dcp × pcp` 除过的：`max_memory_usage_bytes` 先把 `max_model_len` 除掉，再算要几个块 [C25]；上游调度那一侧也把块大小乘了 `dcp × pcp` [C26]，[前缀缓存](prefix-caching.md)的哈希粒度正是被这一乘改掉的。
- **DCP 的代价是通信。** decode 路上先沿头维 all-gather Q，各颗用本地那段 KV 算出部分 `attn_output` 与 `softmax_lse`，拼成 `[..., D+1]`；DCP 用 all-to-all 交换、PCP 再 all-gather 一次 [C13][C16]，最后按
  ```
  LSE_final = log(sum(exp(LSE_i)))
  O_final   = sum(exp(LSE_i − LSE_final) × O_i)
  ```
  合并，这是 `_update_out_and_lse` 的 docstring 原文 [C14]，实际跑的是融合算子 `npu_attention_update`（MLA 那一路同样先 `_process_attn_out_lse` 再合 [C19]）。
- **PCP 的代价是加 NPU 和每层一次 all-gather。** 非 chunked prefill 逐层 all-gather KV，再按 `pcp_allgather_restore_idx` 还原顺序，用完即扔 [C15]；MLA 的 chunked prefill 同样 all-gather context KV，再 `_reorg_kvcache` 排连续。收益只在第一步：DeepSeek-R1-W8A8 128K 从 TTFT 73.2s / TPOT 82ms 到 46.0s / 83ms [S7]。
- **PCP 的头尾配对**：每条请求的 token 数先补齐到 `2 × pcp` 的整数倍，切成 `2 × pcp` 段，第 i 段与倒数第 i 段配给同一个 PCP rank [C11][C12]。
- **Ring Attention 没做**：设计文档写明因为开发复杂度高、重叠收益有限而没有采用 [S6]。
- **线性注意力状态不分**：本页模型 30 层线性注意力的状态是 30.7 MiB/请求/NPU、补齐后 60.7 MiB（见[那条请求](one-request.md)），与长度无关，CP 不减它。
- **和 SP 同开**：SP 与 PCP 同开时 `max_num_batched_tokens` 会被悄悄向上取整到 `tp × pcp` 的倍数，只留一条 warning；main 的 PCP 兼容表把四个后端的 SP + PCP 全标成不兼容 [S41]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| PCP | 支持，用户指南整篇按 PCP + DCP 写 [S1] | 移除，`--prefill-context-parallel-size` 必须为 1 [S30] | 实验性回归，要先 `VLLM_USE_V2_MODEL_RUNNER=1` [S34] | 同一条命令三版三个结果：v0.23 能跑、v0.26 抛错、main 得先开 MRV2 `[!]` |
| 开关函数 | `enable_cp()`，一个管两件事 [C8] | 只剩 `enable_dcp()` [C32] | `enable_dcp()` 与 `enable_pcp()` 分开 [C37] | 照 v0.23 搜 `enable_cp`，新版一个都搜不到 |
| attention impl 类 | `AscendAttentionCPImpl` / `AscendMlaCPImpl`[C18] | `AscendAttentionDCPImpl`，公共逻辑收进 `DCPImplMixin` | 同 v0.26，另加 `AscendDSAPCPImpl` 一类 PCP 专用类 | 排查算子行为前先确认分支，类名对不上就是版本找错了 |
| 拦 PCP 的那道门 | `pcp > 1` 且 `dp > 1` 才抛错 | `not use_v2_model_runner and pcp > 1` 就抛错 | 与 v0.26 一字未改 | 错误信息写死「not supported by vLLM Ascend」，条件里却留着 MRV2 的活口——照错误信息理解会以为 PCP 彻底没了 `[!]` |
| PCP + DCP 同开 | 允许，`cp_size = pcp × dcp` | 不适用 | 用户指南写「cannot be enabled simultaneously」[S35]，`_validate_parallel_config` 却明确允许 `dcp ∈ {pcp, tp × pcp}` | 文档与代码矛盾，以代码为准 `[!]` |
| 混合模型（全注意力 + 线性注意力） | 上游开前缀缓存时 DCP、PCP 都 assert 为 1 | 上游放行 DCP、PCP 仍 assert | main 配套上游无检出，未核 | 本页的 Qwen3.6-35B-A3B 在 v0.23 上开前缀缓存就进不了 CP `[!]` |

还有一处文档没跟上自己：main 的**设计文档**开头仍写着「Prefill Context Parallel is not supported by vLLM Ascend」[S36]，同一份仓库的**用户指南**却整节在教怎么开 PCP `[!]`。PCP 那个切分函数也一样——设计文档和 docstring 都叫它 `_update_tokens_for_pcp`，源码里的名字是不带下划线的 `update_tokens_for_pcp`。

### 源码位置

| 看什么 | 去哪 |
|---|---|
| CP 版注意力实现 | `vllm_ascend/attention/context_parallel/`（三个版本都在）；`attention_cp.py`、`mla_cp.py`、`common_cp.py` |
| 开关判断 | `vllm_ascend/attention/utils.py`：v0.23 `enable_cp()`，main `enable_dcp()` / `enable_pcp()` |
| 每个 token 的 KV 写到哪颗、不归本颗的槽位填 `-1` | `vllm_ascend/worker/block_table.py`，`_compute_pcp_dcp_slot_mapping`[C10]；接法见 [Block Table](block-table.md) 与 [准备输入](prepare-inputs-flow.md) |
| PCP 头尾配对切分 | `vllm_ascend/worker/pcp_utils.py`，`update_tokens_for_pcp` |
| 合并 out 与 lse | `common_cp.py`，`_update_out_and_lse` |
| 平台侧校验 | `vllm_ascend/platform.py`：v0.23，v0.26，main |
| 上游并行配置 | `vllm/config/parallel.py`：交错粒度、世界大小、`tp % dcp`；v0.26 |
| KV 预算按 CP 除 | `vllm/v1/kv_cache_interface.py`，`max_memory_usage_bytes` |
| 各类 KV spec 的 DCP 限制 | `vllm/v1/core/single_type_kv_cache_manager.py` |
| 混合模型的 CP 限制 | `vllm/v1/core/kv_cache_coordinator.py`：v0.23，v0.26 |
| 每颗 NPU 几个 KV 头 | `vllm/config/model.py`，`get_num_kv_heads` |
