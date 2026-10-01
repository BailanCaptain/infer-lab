---
id: prefix-caching
title: "Prefix caching：相同的开头只算一次，靠什么认"
type: feature
summary: 写满的块按 block hash 登记，开头相同的请求直接指向同一份、计数加一。GLM 是 hybrid 模型，v0.23 上游判它不支持而默认关；显式打开会走 align 模式，KDA 状态按 640 边界留档，能复用的长度仍按 640 对齐，不足一块零收益。
aliases: [Prefix Caching, 前缀缓存, 自动前缀缓存, Automatic Prefix Caching, APC, block hash, 块指纹]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L195-L235
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L525-L561
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L563-L590
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L656
  - vllm@0fc695fc:vllm/config/model.py#L1758-L1759
  - vllm@0fc695fc:vllm/config/model.py#L1814-L1857
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L337-L394
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2419
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L582-L683
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1349-L1401
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L410
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L60-L90
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L125-L160
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L216-L225
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L20-L50
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L1-L60
  - vllm-ascend@db701c1f:vllm_ascend/models/layer/attention/layer.py#L100-L120
  - vllm-ascend@db701c1f:vllm_ascend/attention/dsa_v1.py#L191-L199
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2430-L2440
  - vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2524
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2775-L2812
  - vllm@84030bbe:vllm/config/model.py#L2130-L2142
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L82-L136
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L835-L845
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L402-L425
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: vllm-kv-block-allocation, kind: builds-on, note: 登记、引用计数、驱逐、抢占的完整机制在那页；本页讲什么能命中、GLM 上开不开 }
  - { to: kv-cache, kind: builds-on, note: 被复用的就是已算好的 KV 历史 }
  - { to: kv-cache-spec, kind: builds-on, note: 5 个缓存组怎么编、各组块大小是唯一出处 }
  - { to: glm-5-3-flash-two-node, kind: builds-on, note: 部署前提、逻辑块 640、官方命令没写这个开关 }
  - { to: one-request, kind: builds-on, note: R1 教学设定与七站主线 }
  - { to: chunked-prefill, kind: builds-on, note: align 模式要求 chunked prefill 开着 }
  - { to: linear-attention, kind: builds-on, note: KDA 递推状态没有逐 token 的 K/V，只能按档恢复 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 两条请求开头相同，开头要算两遍吗？

不必。**Prefix caching（前缀缓存；vLLM 里的开关叫 Automatic Prefix Caching，简称 APC）就是：把算过的开头按整块登记指纹，后来开头相同的请求直接指向这些块，不再重算。**

多条请求经常共享同一段开头——同一段系统提示、同一份文档、同一场对话的历史。这些开头的计算结果本来就躺在 [KV cache](kv-cache.md) 里，prefix caching 让后来的请求接着用，而不是从头再算一遍。

```wiki-diagram
file: prefix-caching
```

图里只画份数：请求 A 先来，开头写满的两块已经算完；请求 B 开头相同，这两块直接指向同一份，显存里不复制，只有各自的尾巴各写各的块。「写满才算数」和「指同一份而不是复制」这两点是全部机制的骨架，命中的完整条件在[「哪些块能被共享」](#哪些块能被共享)一节。

## 为什么值得做，代价是什么

**省的是 prefill 的计算。** 命中的位置不再进前向：它们的 embedding、每一层的矩阵乘、注意力全都跳过，新请求从第一个没命中的位置开始算。开头越长、相同比例越高，第一个 token 出来之前的等待（TTFT）缩得越多。

**省不掉读。** 新位置过全注意力层时照样要回看前面的历史，命中的块不因为命中而少读。GLM 上「回看」具体读多少另有一本账——主注意力是稀疏 MLA，每个查询只精读挑中的少量位置，扫全程的是 indexer，见[注意力的代价](attention-cost.md)；但 prefix caching 不减少其中任何一项。所以它改善的是 prefill，对 decode 每一步的速度几乎没有影响——decode 本来每步只算一个新 token，没什么可省。

代价有三条：

- **登记与查表。** 每写满一块要算一次指纹、登记一条；每条新请求进来要逐块查表。这部分是 CPU 上的小开销。
- **块池被占用的时间变长。** 没人用的块不再是「还了就算完」，它带着登记排在空闲队列里，指望被后来的请求捡走；池子的会计规则见[「池子的预算怎么分」](#池子的预算怎么分满了怎么办)。
- **混合模型要为递推状态留档。** 像 GLM 的 KDA 这类层不存逐 token 的 K/V，要支持「从中间接着算」，就得沿途留状态档，显存占用随长度涨。GLM 上具体怎么发生，见下一节。

负载不合适就没有收益：每条请求开头各不相同，或者共享的开头凑不满一个块，命中为 0，只剩上面的开销。

## GLM 双机上它开着吗？

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。

**默认关着。** GLM-5.3-Flash 同时有全注意力（稀疏 MLA）和线性注意力（KDA）两类层，vLLM 把这类模型标为 hybrid，v0.23 上游判定 hybrid「不支持 prefix caching（特性还在实验阶段）」；开关没显式写时就取这个判定。官方双机教程的启动命令恰好没写这个开关，所以本部署它是关的：没有登记、没有命中、没有驱逐，每条请求的 prompt 完整重算，[R1](one-request.md#示例请求-r1-与官方双机部署)（教学设定，prompt 4 个 token）的 4 个 token 一定重算。这也是[部署页](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)列出的后果之一。

**显式打开会发生什么（照镜像源码推演，未实跑）：** 「判不支持」只决定默认值，不拦显式设置，开关写上就开。随后三件事连着变：

1. **KDA 的缓存模式从「不留档」变成 align。** 递推状态要支持从中间接着算，要么每个位置都留（all 模式），要么只在块边界留（align 模式）。GLM 的模型类没有声明支持前者，上游回退到 align，并要求 [chunked prefill](chunked-prefill.md) 开着；镜像还专门把 prefill 的每一刀切在块边界上，保证每个边界真的留下一份档。
2. **KDA 状态从整条一份变成按块留档。** 关缓存时 KDA 状态的「块」盖住整条最长长度，一条请求只有一份最新状态；开了后按[逻辑块 640](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token) 对齐，每跨过一个 640 边界留一份。
3. **指纹粒度变细。** 关缓存时指纹粒度直接取调度粒度——各缓存组块大小的最小公倍数，本部署是 133,120 个位置，等于不做细粒度哈希；开了后取各组块大小的最大公约数，照各组块大小（唯一出处见[缓存规格](kv-cache-spec.md)）算出来是 4 个位置一段。

但**能复用的长度仍按 640 对齐**：full 组只认写满的 640 整块，KDA 只在 640 边界有档，最终取的是所有组都能接上的公共长度。所以在 GLM 上，两条请求共享的开头不足 640 个 token 时，prefix caching 一点用都没有；R1 这样的短请求命中恒为 0。指纹按 4 个位置一段登记，不改变这个结论，原因见下一节末尾。

## 哪些块能被共享

一句话：**写满、指纹相同、登记还在、而且每个缓存组都能从那个位置接着算——四个条件同时满足，才能共享。** 查之前还有一道请求级的门槛：被标记「跳过缓存读取」的请求（比如要求 prompt logprobs 的），查都不查，直接按未命中处理。

**只有写满的块有指纹。** block hash（块指纹）是给每个写满的块算的一个身份：不只混入本块的 token，还连着前一块的指纹一起算，所以两个块指纹相同，就说明从第一个 token 到这一块末尾全都一样。没写满的块不算指纹——它还会被继续写，内容不固定，拿它当凭据不可靠。于是命中总是整块整块的，prompt 末尾凑不满一块的零头永远复用不上；块越大，这截尾巴越长。

**指纹认的是「模型输入的身份」，不只是文本。** 除了 token 序列，指纹还混入所有会改变计算结果的东西：用了哪个 LoRA、多模态输入的内容指纹、请求方特意用来隔离缓存的 cache salt（盐值）、直接传入的 embedding。两条请求文本一样、LoRA 不一样，指纹就不同，不命中——这是对的，它们的 K 和 V 本来就不一样。反过来说，文本显示相同不保证命中。

**登记还得在。** 命中查的是「指纹 → 块」的登记表。块被驱逐后登记被抹掉，就查不到了；曾经算过不等于现在还能拿来用。什么时候被驱逐，见下一节。

**混合模型：每个缓存组都得能接上。** GLM 有 [5 个缓存组](kv-cache-spec.md)，对同一个前缀位置，各组「能不能接着算」的条件不一样：

- **full 组**（MLA 压缩历史和 indexer K）：逐 token 存，认写满的整块，条件就是上面三条；
- **KDA 组**（3 个）：不存逐 token 的 K/V，只有按边界留的状态档。一份停在目标位置的档就够——递推状态本身包含了它之前的一切，前面的位置全用占位块填；没有恰好停在那里的档，就完全接不上；
- **尾状态组**（indexer 的滑动窗口）：只要求窗口盖住的最近一小段在缓存里。

调度器用一个「只砍不涨」的循环取公共长度：从最长候选开始，挨个组查，哪个组接不上就把候选砍到它能接上的位置，砍过就让所有组重查，直到都点头。**所以指纹在更细的位置对上了，不代表每个组都能恢复到那里**——GLM 上指纹粒度是 4，但 full 组按 640 整块砍、KDA 只在 640 边界有档，公共长度总是 640 的整数倍。

## 池子的预算怎么分，满了怎么办

**没有单独的缓存预算。** prefix caching 不给共享块划一块专属显存：用的就是启动时切出来的那一个块池，共享靠引用计数——几条请求指着同一块，计数就是几，显存始终一份。登记、计数、驱逐的完整机制在[块分配页](vllm-kv-block-allocation.md#引用计数什么时候大于-1共享登记与驱逐)，这里只列三条和「预算」直接有关的结论：

- **共享不额外花预算。** 第二条请求命中几块，池子一块都不少，反而省下了它本来要另借的那几块。
- **驱逐是「被借走时顺手发生」的。** 计数减到 0 的块带着登记排回空闲队列；它被借走之前仍能被后来的请求捡回来，真被借走登记才被抹掉。归还按倒序排队，序列开头的块留得最久——前缀恰好在开头，这就是想要的效果。
- **命中空闲队列里的块不是白拿。** 要把它从队列里摘出来，所以它算进本步「池子够不够」的账。

「满了怎么办」等于「借不到块怎么办」：宁可抢占整条请求，也不借一半，见同页[「池子不够时」](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。

## 常见误解

- **「开着它，同一段开头会在显存里存两份。」** 相反，它把两份变一份：命中是把块号填进自己的[块表](block-table.md)、计数加一，不复制数据。
- **「命中省的是显存读。」** 省的是计算。新位置过全注意力层照样要面对全部历史（GLM 上精读挑中位置、indexer 扫全程），命中的块不因命中而少读；所以受益的是 TTFT，不是 decode 吞吐。
- **「文本相同一定命中。」** 指纹还混着 LoRA、多模态内容、cache salt 等身份信息，文本相同只是必要条件。
- **「指纹能对到 4 个位置，就能按 4 个位置复用。」** 指纹粒度是登记的粒度；能复用的长度是所有缓存组都能接上的公共长度，GLM 上被 full 组整块和 KDA 边界档卡在 640 的整数倍。
- **「hybrid 被判不支持，等于不能开。」** 那只是默认值。显式写上开关就开（v0.23 会走 align 模式），要不要开是另一个问题。
- **「整段 prompt 全命中，就一个 token 都不用算。」** 最后一个 token 必须重算——要用它的输出预测下一个 token；已算位置又要对齐块边界，所以可能整块重算。

## 对照源码

### 怎么开

- 开关是 `--enable-prefix-caching`。没写时取模型判定：GLM 的 `attn_type` 是 `"hybrid"`，`is_prefix_caching_supported` 对 hybrid 返回 False [C6]，`enable_prefix_caching` 未显式给出时取它 [C8]。官方双机命令没写这个开关，见[部署页](glm-5-3-flash-two-node.md#怎么开)。
- 显式写上不会被拒：上面那条链只填默认值，对生成模型没有再检查 [C8]。打开后昇腾替换版的 `verify_and_update_config` 开头就调上游同名逻辑 [C12]：`mamba_cache_mode` 从 `"none"` 改成 `"align"`——GLM 的模型类（镜像 `AscendGlm5NextForCausalLM`，main 的 `Glm5NextForCausalLM`）都没实现 `SupportsMambaPrefixCaching`，拿不到 `"all"` [C7]。镜像随后把 `mamba_block_size` 定为 `block_size` [C14]，GLM 的 `block_size` 此前已被写成 640 [C13]。
- 指纹粒度：镜像给 GLM 单独写了分支 `_ascend_resolve_kv_cache_block_sizes`——调度粒度取各组块大小的最小公倍数；APC 和 KV connector 都不开时指纹粒度直接等于它（不做细粒度哈希），开了就取各组最大公约数 [C11]。上游原版遇到「Mamba 组块大小不等于逻辑块」会放弃细哈希退回调度粒度 [C4]，镜像注释写明这条对 GLM 不对，所以绕开。
- 镜像还为 align 对齐了切分：`Scheduler._mamba_block_aligned_split` 的 GLM 分支把 chunked prefill 的每一刀切在调度粒度的整数倍上，保证每个边界都真的留下状态档 [C16]。

### 会报什么错

- 开 APC、关 chunked prefill：断言失败 `Chunked prefill is required for mamba cache mode 'align'.` [C7]。
- 开成功时有两条日志可确认：warning 说 cache mode 因开了 prefix caching 被设为 `align`，info 说 Mamba 层的 prefix caching 仍是实验性的。排查时以这两条和启动日志里的判定为准，别拿配置类的字段默认值当有效配置。
- 手动指定的指纹粒度除不尽某个组的块大小：`ValueError`，上游和 GLM 分支各有一条、报文不同 [C11]。
- 一条容易误读的死分支：DeepSeek-V4 压缩式 attention 的层文件里有 `cache_config.enable_prefix_caching = False`，条件是后端名等于 `TRITON_MLA` 或 `FLASHINFER` [C17]；这条路上后端固定是 `AscendDSABackend`，名字只会是 `ASCEND_DSA` 或 `FLASH_ATTN` [C18]，永远不触发；GLM 的 DSA 式稀疏 MLA 也不走这个文件（见 [sparse attention](sparse-attention.md)）。别据此以为昇腾会自动关掉 APC。

### 开销和什么时候别开

- **本部署默认关。** 要研究「开了怎样」，第一步是确认状态：看启动日志，不是看代码里的默认值。
- **命中粒度 640。** 由 full 组整块和 KDA 边界档共同卡出 [I]。共享开头不足 640 个 token 的负载——短对话、每条请求开头各不相同——开了只有登记和查表的开销；R1 的 4 个 token 命中恒为 0 [A]。
- **KDA 留档的显存。** 开了后 KDA 状态从每请求常数份变成每 640 个位置一份档，每份档还要按页对齐补齐到和注意力页一样大（KDA 状态本身多大，见[缓存规格](kv-cache-spec.md)）。涨多少本知识库没有算过：底稿只覆盖关缓存形态的块账，此处标待核 [!]。
- **整块重算。** 全命中也要留最后一个 token 拿 logits，已算位置对齐块边界，可能触发整块重算 [C1]。
- **正确性与收益都没有 GLM 上的实跑证据。** 复用应保持模型计算语义，但浮点执行顺序和内核差异可能影响逐 token 结果；上游对 hybrid 开 align 的措辞是「实验性」[C7]。本知识库没有在 GLM 双机上实测过开 APC 的输出一致性和 TTFT 收益，均标待核 [!]。

### 版本差异

钉点沿用[块分配页](vllm-kv-block-allocation.md#版本差异)：v0.23 为 Ascend `2c59ff10` / vLLM `0fc695fc`，v0.26 为 Ascend `2ed6cbba` / vLLM `568afb3a`，main 为 Ascend `baa023ad` / vLLM `84030bbe`。**本页 GLM 行为按专用镜像 Ascend `db701c1f`（配 vLLM `0fc695fc`）读，它是 orphan commit，不算进 v0.23 列**：GLM 的模型代码 `2c59ff10`、`2ed6cbba` 上都没有，main 在 `models/glm5next/` 下有一份。

| 项 | v0.23 | v0.26 | main | 意味着什么 |
|---|---|---|---|---|
| hybrid 模型的 APC 默认值 | 关：上游判为不支持 [C6][C8] | 关：已判为支持，但注释写明对 hybrid 刻意保持手动打开 [C20] | 开：恢复「支持就默认开」[C21] | [!] 同一条不写开关的命令，两个发布版不命中，main 命中 |
| GLM 模型代码 | 无 | 无 | 有；模型类同样没实现 `SupportsMambaPrefixCaching`，开 APC 仍走 align [C24] | 前两列谈不上「GLM 开不开」，GLM 行为要看镜像 `db701c1f` |
| 指纹粒度怎么算 | 镜像有 GLM 专用分支：全部组参与最大公约数 [C11]；`2c59ff10` 无此分支 | 无 GLM 分支 | 先筛掉不可缓存的私有组（如固定尾块组）再算，DeepSeek V4.1 例外另走一条 [C23] | 镜像上尾状态组参与、算出 4；main 上它被筛掉，粒度随剩余组变（未逐项核，待核 [!]） |

### 源码位置

| 想看什么 | 去哪 |
|---|---|
| 命中入口、跳过条件、最后一个 token 重算 | `vllm/v1/core/kv_cache_manager.py`，`get_computed_blocks` |
| 指纹怎么算、额外身份键有哪些 | `vllm/v1/core/kv_cache_utils.py`，`hash_block_tokens`、`generate_block_hash_extra_keys` |
| 混合模型取公共长度的循环 | `vllm/v1/core/kv_cache_coordinator.py`，`HybridKVCacheCoordinator.find_longest_cache_hit` |
| 每种缓存组归哪个管理器管 | `vllm/v1/core/single_type_kv_cache_manager.py`，`register_all_kvcache_specs`：MLA 归 full 管理器、滑窗 MLA 归滑窗管理器、Mamba 类归 Mamba 管理器 |
| hybrid 默认关在哪判 | `vllm/config/model.py`，`is_prefix_caching_supported`；`vllm/engine/arg_utils.py` |
| align 模式与留档规则 | 上游 `vllm/model_executor/models/config.py`；镜像 `patch_mamba_config.py` |
| KDA 组「一份档就够」的命中 | 镜像 `patch_mamba_manager.py`，`AscendMambaManager.find_longest_cache_hit`：从后往前找最近一份对齐的档，前面全用占位块 |
| GLM 的调度粒度与指纹粒度 | 镜像 `patch_kv_cache_utils.py`，`_ascend_resolve_kv_cache_block_sizes` |
| chunked prefill 的刀口对齐 | 镜像 `patch_glm5_next_mamba_scheduler.py` |
| 登记、计数、驱逐 | 上游 `BlockPool`，见[块分配页](vllm-kv-block-allocation.md#源码位置) |

**正文证据索引。** 角标按 frontmatter sources 顺序编号：命中入口与最后一个 token 重算（第 1 条）、额外身份键（第 2 条）、指纹连着前块算（第 3 条）、上游粒度解析与回退（第 4 条）、hybrid 判定（第 5、6 条）、align 模式与断言（第 7 条）、默认值填法（第 8 条）、公共长度循环（第 9 条）、组到管理器的登记（第 10 条）、镜像 GLM 粒度分支（第 11 条）、镜像 mamba 配置补丁（第 12–14 条）、KDA 命中（第 15 条）、刀口对齐（第 16 条）、死分支（第 17、18 条）、镜像与 main 的 GLM 模型类（第 19、24 条）、v0.26 与 main 的默认值（第 20–22 条）、main 筛组（第 23 条）、直觉图 pin 的命中加计数（第 25 条）。

