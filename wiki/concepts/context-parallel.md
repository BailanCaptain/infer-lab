---
id: context-parallel
title: "Context Parallel：把序列维切到多张卡上，PCP 切算、DCP 切存"
type: feature
summary: 长序列放不进一张卡时沿序列维下刀；PCP 切 prefill 要算的 token 并为此加卡，DCP 把 KV Cache 交错分到 TP 组各卡、卡数不变。
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
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/context_parallel.md#L52-L65
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/context_parallel.md#L109-L123
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/context_parallel.md#L5-L7
  - vllm-ascend@b255ab59:vllm_ascend/attention/utils.py#L244-L252
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1492-L1499
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1516-L1527
  - vllm@568afb3a:vllm/config/parallel.py#L505-L520
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/context_parallel.md#L20-L25
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: 每卡 KV 预算就是那一页的 spec 按 dcp × pcp 除出来的，每 token 112 KiB 也取自那里
  - to: block-table
    kind: builds-on
    note: CP 下槽位走块表里 _compute_pcp_dcp_slot_mapping 那条分支，虚拟块与行扩展都在那一页
  - to: tensor-parallel
    kind: builds-on
    note: DCP 不新建通信域、直接骑在 TP 组上，所以 tp % dcp == 0 是硬约束
  - to: attention-backend-family
    kind: builds-on
    note: enable_cp() 为真时 get_impl_cls 换成 CP 版 impl 类，挑后端那一层在那一页
  - to: one-request
    kind: builds-on
    note: 把那条请求的问题换成 128K，每 token 112 KiB 这个数才派得上用场
  - to: sequence-parallel
    kind: conflicts-with
    note: main 的 PCP 兼容表把四个后端的 SP + PCP 全标成不兼容；v0.23 上同开则会悄悄改大 max_num_batched_tokens
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

上下文并行（Context Parallel，CP）沿**序列维**下刀：一条长请求的 token 不再整条落在同一张卡上。它是两个特性共用的名字——**PCP 切的是 prefill 这一步要算的 token，靠加卡把 TTFT 压下来；DCP 切的是写进 KV Cache 的那一份，卡数不变，把每卡 KV 占用压下来** [S1]。

`vllm_ascend/attention/context_parallel/` 这个目录三个在册版本上都在，**DCP 三版都是正经功能，PCP 换过两轮身份**：v0.23 维护分支上 `enable_cp()` 一个开关管两件事 [C8]；v0.26 分支把 PCP 从这个目录里整个摘掉，只剩 `enable_dcp()`，用户指南第一句就是「Prefill Context Parallel is not supported by vLLM Ascend」、`prefill_context_parallel_size` 必须留在 `1` [S30]；main 开发主线又把它接回来，标着 experimental，且只在 ModelRunner V2 上跑 [S34]。**PCP 千万别照着一个版本的文档去配另一个版本。**

```wiki-diagram
file: context-parallel
```

## 那条请求用不到它

[那条请求](one-request.md)单卡 TP=1、37 + 200 = 237 个 token，两条路都够不着：DCP 复用 TP 那几张卡，TP=1 时没有重复副本可消；PCP 要加卡，而 `world_size = pp × tp × pcp`，单卡这个乘积就是 1 [C23]。237 个 token 的 KV 总共 237 × 112 KiB ≈ 25.9 MiB，本来也没什么好省的。

要落到这一页只改一处：**问题从 37 个 token 换成 128K**（`--max-model-len 131072`），模型和 200 个 token 的回答都不动 [A]。一整份 KV 于是变成：

```
 65536 × 112 KiB =  7 GiB   （64K 上下文）
131072 × 112 KiB = 14 GiB   （128K 上下文）
```

每 token 112 KiB 的推导在 [KV Cache Spec](kv-cache-spec.md)。切了之后每卡剩多少不用猜——**KV 预算本来就是按 `dcp × pcp` 除过的**：`max_memory_usage_bytes` 先把 `max_model_len` 除掉，再算要几个块 [C25]。

| 配置 | 每卡存几个 token 的 KV | 每卡 KV | 全机总量 |
|---|---|---|---|
| TP=1 · DCP=1 | 131072 | 131072 × 112 KiB = **14 GiB** | 14 GiB |
| TP=16 · DCP=1 | 131072 | 131072 × 14 KiB = **1.75 GiB**（112 ÷ 8 个 KV 头） | 28 GiB |
| TP=16 · DCP=2 | 65536 | **0.88 GiB** | 14 GiB |
| TP=32 · DCP=4 | 32768 | **0.44 GiB** | 14 GiB |

第二行那个 28 GiB 才是重点。Qwen3-0.6B 只有 8 个 KV 头，TP 超过 8 之后上游 `max(1, total_num_kv_heads // tp)` 取不到 0，**注释写得很直白：replicate the KV heads** [C29]——16 张卡每张留一个头，8 个头各存了两份，多出来的那 14 GiB 是纯浪费。DCP 消掉的正是这一份重复，全机总量回到一份 [D]。GQA 那条看着莫名其妙的约束 `(tp // num_key_value_heads) >= dcp` [S3] 由此而来：**能切几份，取决于本来重复了几份。**

## 加不加卡，是两者之间最硬的那条界线

DCP 不新建通信域，直接骑在 [TP](tensor-parallel.md) 组上，所以上游只要求 `tp % dcp == 0` [C24]，世界大小一个不变。PCP 反过来：它自己建通信域，`world_size` 里就乘着一个 `pcp`，官方那条 `tp=2 pcp=2` 的例子因此要 4 张卡。

界线一划，两边的约束就完全不是一回事。PCP 与数据并行互斥，v0.23 在 `_validate_parallel_config` 里直接抛错；v0.26 配套的上游把同一条规则写进了 `ParallelConfig`，还顺带规定 PCP 开着时 DCP 只能取 `1`、`pcp` 或 `tp × pcp` [C40]。DCP 这边的限制则落在 KV Cache spec 上：滑动窗口那类 spec 的 manager 里写着一句 `assert dcp_world_size == 1` [C27]，chunked local attention 与 Mamba 的 manager 里各有一句一模一样的——**混合注意力模型上 DCP 根本进不去，而这一条官方文档没写。**

「PCP 压 prefill、DCP 压 decode」也不是口号。官方 128K 实测把两者分得很开：DeepSeek-R1-W8A8 从 TTFT 73.2s / TPOT 82ms 变成 46.0s / 83ms [S7]——TTFT 降了三成多，TPOT 纹丝不动，切 prefill 只管第一口。

## KV 不是一人一段，是交错着放的

`cp_kv_cache_interleave_size` 默认 1，也就是 token 级交错：token `i` 落在 `total_cp_rank = i % (pcp × dcp)` 上 [C22]。往上看，同一个 CP 组里的块合起来算一个虚拟块，`virtual_block_size = block_size × cp_size`；往下看，实现只有一个 mask——`_compute_pcp_dcp_slot_mapping` 算出每个 token 归谁，不归本卡的那些槽位填 `-1` [C10]。**所以各卡跑的是同一张块表、同一段代码，差别只在写进哪一格。** 块表那条分支怎么接上去见 [Block Table](block-table.md) 与 [准备输入](prepare-inputs-flow.md)；上游调度器那一侧也跟着把块大小乘了 `dcp × pcp`，[前缀缓存](prefix-caching.md)的哈希粒度正是被这一乘改掉的。

要做 KV 传输（PD 分离、KV 池）就必须把它设成 `block_size`，让交错退化成块级：

```bash
vllm serve deepseek-ai/DeepSeek-V2-Lite \
    --tensor-parallel-size 2 \
    --decode-context-parallel-size 2 \
    --cp-kv-cache-interleave-size 128 \
    --kv-transfer-config '{...}'
```

`128` 不是随手挑的，它就是 `block_size` 的默认值；配了 `--kv-transfer-config` 而两者不等、`cp_size` 又大于 1 时，v0.23 直接 `AssertionError`。**同一段代码里还藏着一条不报错的**：稀疏（SFA）模型下同样的不匹配只打一条 warning，然后把你的值改成 `block_size` [C21] `[!]`——不翻日志就看不出配置被换过。

## 每卡只有一段 KV，结果靠 lse 合回来

两种做法按阶段分工，不是二选一。

**把 KV 凑齐。** PCP 的非 chunked prefill 走这条：逐层 all-gather KV，再按 `pcp_allgather_restore_idx` 还原顺序，用完立刻扔，不留峰值 [C15]。MLA 的 chunked prefill 同样 all-gather context KV，然后 `_reorg_kvcache` 把同一条请求的 KV 排连续。Ring Attention 被评估过，设计文档写明因为开发复杂度高、重叠收益有限而没做。

**把结果合起来。** decode 与 GQA 的 chunked prefill 走这条：先沿头维 all-gather Q，各卡拿本地那段 KV 算出部分 `attn_output` 和 `softmax_lse`，拼成 `[..., D+1]` 之后 DCP 用 all-to-all 交换、PCP 再 all-gather 一次，最后按这两行合：

```
LSE_final = log(sum(exp(LSE_i)))
O_final   = sum(exp(LSE_i − LSE_final) × O_i)
```

这是 `_update_out_and_lse` 的 docstring 原文 [C14]，实际跑的是融合算子 `npu_attention_update`。**合并只要每段的 out 和 lse，不要每段的 KV**——这才是 DCP 能省显存的根由：decode 路上，完整的 KV 从头到尾没有在任何一张卡上出现过。

## 它和 Sequence Parallel 不是一回事

名字都带 parallel，都在 token 维上动刀，这是本章最常见的混淆。但切的东西、持有的时长、省下的东西没有一样相同：

| | Context Parallel | [Sequence Parallel](sequence-parallel.md) |
|---|---|---|
| 切什么 | 一条请求的 token 与它的 KV Cache | 一层里那两次 all-reduce 中间的那段激活 |
| 持有多久 | 每卡长期只有 1/cp 的 KV | 只在 norm 那几行，出了这段立刻 all-gather 回全长 |
| 卡数 | PCP 加卡，DCP 不加 | 不加，就是 TP 那几张 |
| 省什么 | 每卡 KV 占用（DCP）、TTFT（PCP） | 通信量一个字节没省，省 norm 的算力 |
| 怎么开 | `--prefill-context-parallel-size` / `--decode-context-parallel-size` | `enable_flashcomm1` 那一套 |

两者还会互相咬：SP 与 PCP 同开时 `max_num_batched_tokens` 会被悄悄向上取整到 `tp × pcp` 的倍数，只留一条 warning；main 的 PCP 兼容表干脆把四个后端的 SP + PCP 全标成不兼容。

## 三个版本上的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| PCP | 支持，用户指南整篇按 PCP + DCP 写 | 移除，`--prefill-context-parallel-size` 必须为 1 | 实验性回归，要先 `VLLM_USE_V2_MODEL_RUNNER=1` | 同一条命令三版三个结果：v0.23 能跑、v0.26 抛错、main 得先开 MRV2 `[!]` |
| 开关函数 | `enable_cp()`，一个管两件事 | 只剩 `enable_dcp()` | `enable_dcp()` 与 `enable_pcp()` 分开 [C37] | 照 v0.23 搜 `enable_cp`，新版一个都搜不到 |
| attention impl 类 | `AscendAttentionCPImpl` / `AscendMlaCPImpl` | `AscendAttentionDCPImpl`，公共逻辑收进 `DCPImplMixin` | 同 v0.26，另加 `AscendDSAPCPImpl` 一类 PCP 专用类 | 排查算子行为前先确认分支，类名对不上就是版本找错了 |
| 拦 PCP 的那道门 | `pcp > 1` 且 `dp > 1` 才抛错 | `not use_v2_model_runner and pcp > 1` 就抛错 | 与 v0.26 一字未改 [C38] | 错误信息写死「not supported by vLLM Ascend」，条件里却留着 MRV2 的活口——照错误信息理解会以为 PCP 彻底没了 `[!]` |
| PCP + DCP 同开 | 允许，`cp_size = pcp × dcp` | 不适用 | 用户指南写「cannot be enabled simultaneously」[S35]，`_validate_parallel_config` 却明确允许 `dcp ∈ {pcp, tp × pcp}` [C39] | 文档与代码矛盾，以代码为准 `[!]` |

还有一处文档没跟上自己：main 的**设计文档**开头仍写着「Prefill Context Parallel is not supported by vLLM Ascend」[S36]，同一份仓库的**用户指南**却整节在教怎么开 PCP `[!]`。PCP 那个切分函数也一样——设计文档和 docstring 都叫它 `_update_tokens_for_pcp`，源码里的名字是不带下划线的 `update_tokens_for_pcp` [C11]。

## 常见误解

- **「CP 就是序列并行，换个说法而已」**——切的东西不同。SP 切的是一层内部那段激活，出了 norm 立刻 all-gather 回全长；CP 切的是请求的 token 和它的 KV Cache，每卡长期只持有一份。
- **「开了 DCP，注意力总得先把 KV 凑齐」**——decode 路上从没凑齐过，合的是 out 和 lse。凑 KV 的是 PCP 的 prefill 和 MLA 的 chunked prefill。
- **「`cp_kv_cache_interleave_size` 默认等于 `block_size`」**——默认是 1，token 级交错。PD 分离与 KV 池必须手动设成 `block_size`，不设在 v0.23 上直接 AssertionError。
- **「DCP 想开多大开多大」**——MLA 受 `tp % dcp == 0` 限，GQA 还要 `(tp // num_kv_heads) >= dcp`；滑动窗口、chunked local、Mamba 三类 spec 上游直接 assert 不支持。
