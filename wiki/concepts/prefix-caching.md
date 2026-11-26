---
id: prefix-caching
title: Prefix caching：相同的开头只算一次，靠什么认
type: feature
legacyAnchors:
  glm-双机上它开着吗: 异构混合模型边界：KDA 与稀疏 MLA 多组对齐（GLM 双机对照）
summary: >-
  通过链式块指纹复用相同开头已算好的 KV 块，省去重复的 prefill 计算；对比 vLLM 整块哈希与 RadixAttention 基数树差异，并拆解混合注意力模型的多缓存组对齐边界。
aliases:
  - Prefix Caching
  - 前缀缓存
  - 自动前缀缓存
  - Automatic Prefix Caching
  - APC
  - block hash
  - 块指纹
  - RadixAttention
  - Radix Tree
chapters:
  - '11'
sources:
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L195-L235'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L525-L561'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L563-L590'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L656'
  - 'vllm@0fc695fc:vllm/config/model.py#L1758-L1759'
  - 'vllm@0fc695fc:vllm/config/model.py#L1814-L1857'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L337-L394'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2419'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L582-L683'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1349-L1401'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L410
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L60-L90
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L125-L160
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L216-L225
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L20-L50
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L1-L60
  - 'vllm-ascend@db701c1f:vllm_ascend/models/layer/attention/layer.py#L100-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/dsa_v1.py#L191-L199'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2430-L2440'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2524'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2775-L2812'
  - 'vllm@84030bbe:vllm/config/model.py#L2130-L2142'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L82-L136
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L835-L845'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L402-L425'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_coordinator.py#L674-L684'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_coordinator.py#L657-L673'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2834'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L450-L452'
  - 'vllm@0fc695fc:vllm/config/cache.py#L133-L141'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1121-L1230'
  - 'vllm@0fc695fc:docs/design/prefix_caching.md#L1-L236'
  - 'vllm@0fc695fc:docs/features/automatic_prefix_caching.md#L1-L25'
  - 'vllm@0fc695fc:examples/features/automatic_prefix_caching/automatic_prefix_caching_offline.py#L1-L103'
  - 'vllm@0fc695fc:vllm/config/cache.py#L92-L109'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1133-L1142'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L388-L398'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L34-L91'
  - 'vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L950-L975'
  - 'vllm@84030bbe:vllm/model_executor/models/config.py#L609-L657'
  - 'vllm@568afb3a:vllm/model_executor/models/config.py#L551-L595'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1172-L1204'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L717-L809'
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_utils.py#L701-L793'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L84-L140'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L137-L138'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L155-L188'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L177'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L90-L190'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L302-L332'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L835-L845'
  - 'vllm@ced6857a:vllm/config/model.py#L2135-L2141'
  - 'vllm@ced6857a:vllm/config/cache.py#L130-L154'
  - 'vllm@84030bbe:vllm/config/cache.py#L139-L156'
  - 'vllm@568afb3a:vllm/config/cache.py#L56-L67'
  - 'vllm@568afb3a:vllm/config/cache.py#L93-L110'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L100-L135'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L413-L434'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L84-L140'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_mamba_config.py#L122-L176'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L205-L295'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L361-L405'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_mamba_config.py#L122-L176'
  - 'vllm@ba15685a:vllm/v1/core/kv_cache_manager.py#L288-L350'
  - 'vllm@ba15685a:vllm/v1/core/kv_cache_coordinator.py#L806-L860'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L3106-L3142'
  - 'https://arxiv.org/abs/2312.07104'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache
    kind: builds-on
    note: 被复用的就是已算好的 KV 历史
  - to: paged-attention
    kind: builds-on
    note: 固定大小物理块分页管理是 vLLM 按块哈希与引用计数共享的基础
  - to: block-table
    kind: builds-on
    note: 命中共享块时只改写请求逻辑块到物理块号的映射表，不复制显存字节
  - to: kv-cache-spec
    kind: builds-on
    note: 5 个缓存组怎么编、各组块大小是唯一出处
  - to: chunked-prefill
    kind: builds-on
    note: APC 跳过已命中前缀后由 Chunked Prefill 切分剩余未命中后缀；混合模型 align 模式要求开启分块预填充
  - to: linear-attention
    kind: builds-on
    note: KDA 递推状态没有逐 token 的 K/V，只能按档恢复
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 纯显存前缀缓存受 HBM 容量限制、冷前缀易被驱逐重算；主机内存富余时可选用 CPU offload 增设第二层冷前缀缓存
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 两条请求开头相同，开头要算两遍吗？

满足复用条件时，可以省去命中部分的计算。**Prefix caching（前缀缓存，自动复用也叫 Automatic Prefix Caching，简称 APC）给算过的开头登记输入指纹，后来请求找到可用的前缀块，直接共享它们并接着算。**

把它想成一间文书房——**每人各自重抄三卷相同红皮开场白 vs 共享中央火漆封印卷宗柜、只在薄本上续写差异结尾**：

```wiki-diagram
file: prefix-caching-plate-wax-ledger
```

多条请求经常共享同一段开头——同一段系统提示、同一份文档、同一场对话的历史。这些开头的计算结果本来就躺在 [KV cache](kv-cache.md) 里，prefix caching 让后来的请求接着用，而不是从头再算一遍。

```wiki-diagram
file: prefix-caching
```

图里画普通整块命中：请求 A 先来，开头两块已经算完且登记还在；请求 B 通过输入身份检查后共享这两块，各自不同的尾巴继续写自己的块。为看清省掉多少计算，假设一块装 $4$ 个位置，B 有 $10$ 个输入位置，其中前 $2$ 块（$8$ 个位置）命中：

| 两块共享前缀核算项（示意：每块 $4$ 位置，共 $10$ 位置） | 算式 | 结果 |
| --- | --- | --- |
| 命中的前缀位置数 | $2 \times 4$ | **$8$ 个**（跳过重算） |
| 本次仍须计算的位置数 | $10 - 8$ | **$2$ 个** |

这里还有 2 个未命中位置，能够正常计算下一 token 所需的输出；整段输入都命中时仍有末 token 重算规则，见后文。新版在满足特定边界条件时可复用部分物理尾块，完整条件在[哪些块能被共享](#哪些块能被共享)。

放到 `v0.30.0` 主基线的标准单组模型 **`Qwen3-8B`**（昇腾默认 `block_size = 128`、每块 `18 MiB`，前缀缓存默认开启）上，流程最直接。两条请求共享一段 `256` 词系统提示词时，请求 A 算完前 `2` 块（`Block 1, 2`）并登记链式哈希。请求 B 进场命中这两块后，调度器直接调 `touch` 把引用计数从 `1` 加到 `2`，零拷贝共享 `36 MiB` 显存并跳过前 `256` 词 Prefill，只算各自后面的独有问题。

## 为什么值得做，代价是什么

**直接省的是 prefill 计算。** 命中并可恢复的前缀不必从头执行这些位置的 embedding、各层矩阵乘与注意力；新请求从实际恢复边界继续。长文档问答和多轮对话常有长共享开头，因而有机会明显缩短首 token 等待时间 **TTFT**（Time to First Token，首词时延）；实际收益还取决于命中长度、排队和缓存管理开销。

**省不掉新位置对历史的读取。** 新位置过注意力层时仍要回看全部可见历史（若为稀疏注意力，索引器仍须扫描相应历史，见[注意力的代价](attention-cost.md)）；前缀命中不会取消这些读取。它也不会跳过后续生成及投机候选验证：普通 decode 和投机解码验证都要照常计算。共享块可能间接释放容量、影响整体吞吐，但不能从命中率直接推出 decode 每步加速。

代价有三条：

- **登记与查表。** 按哈希粒度计算输入指纹，再为可复用的状态登记，后来请求逐段查表。这些工作消耗 CPU，长输入、哈希算法和登记数量都会影响开销，不能统一当作零成本。
- **保留登记与淘汰管理。** 没人用的块带着登记排在空闲队列里，仍可立即分配给别的请求；保留内容不等于继续独占容量。命中这些空闲块时才会将它们摘出队列，池子的会计规则见[「池子的预算怎么分」](#池子的预算怎么分满了怎么办)。
- **混合模型要为递推状态留档。** 带[线性注意力（如 KDA/Mamba）](linear-attention.md)的混合模型不存逐 token 的 K/V，要从中间接着算必须留出对应边界的状态档；`align` 模式只保存对齐的调度步终点，旧档可归还池子留作可淘汰缓存，详见后半段[GLM 双机一节](#glm-双机上它开着吗)。

若每条请求开头都不同，或共同部分达不到该版本、该缓存组的可恢复边界，就没有命中收益，却仍有管理开销。

## 哪些块能被共享

一句话：**写满、指纹相同、登记还在、而且每个缓存组都能从那个位置接着算——四个条件同时满足，才能共享。** 查之前还有一道请求级门槛：被标记「跳过缓存读取」的请求（比如按默认派生规则要求 [prompt logprobs](prefill.md#提示词已经给定为什么还要算它的概率) 的），查都不查，直接按未命中处理。

```wiki-diagram
file: prefix-caching-fig-hash-hybrid
```

上图拆开了决定命中的两条主线：上半区看标准链式块指纹怎样把前块哈希与额外身份键串在一起，交给共享池做引用计数（`touch`）与淘汰；下半区看混合模型怎样通过「只砍不涨」把多组对齐到公共恢复边界。

- **输入指纹和可复用块要分开看。** `block hash`（块指纹）把这一段 token、前段指纹和额外输入身份一起哈希，识别的是累计前缀（哈希存在理论碰撞可能，不是数学相等证明）。标准整块路径只登记写满的物理块，尾部不足一块的位置无法复用；后续版本支持部分尾块登记的条件见[块分配版本表](vllm-kv-block-allocation.md#版本差异)，不把旧版规则推广到所有版本。
- **指纹认输入身份，不能只看文本。** 在兼容的模型实例内，额外身份键包括 [LoRA](lora.md) 标识、多模态内容指纹、请求方提供的 `cache_salt`（隔离复用的盐值）以及直接输入的 embedding 身份。相同文字配不同图片或 LoRA，不会复用同一前缀状态；跨实例传输还须遵守 [KV pool 的兼容条件](kv-pool.md)。
- **登记还得在。** 命中查的是「指纹 → 块」登记表。块被驱逐后登记被抹掉，就查不到了；曾经算过不等于现在还能拿来用。

查到块不代表本步一定能执行：还要通过容量检查与状态依赖检查。启用 APC 且不需延迟登记时，调度分配会先按本步已确定的位置登记块号，随后 worker 再执行前向并写入状态；登记记录不等于字节已写完，递推状态还要满足本步依赖限制。

## 池子的预算怎么分，满了怎么办

**没有单独的缓存预算。** prefix caching 不给共享块划专属显存，用的就是启动时切出的同一个块池。共享靠引用计数（`touch`）：几条请求指着同一块，计数就是几，显存始终只占一份（完整机制见[块分配页](vllm-kv-block-allocation.md#引用计数什么时候大于-1共享登记与驱逐)）。这里只列三条和「预算」直接有关的结论：

- **共享不复制数据。** 命中仍被其他请求持有的块，只增加引用计数，空闲块数不变；命中已经归还队列的块，则会占用相应空闲容量。两种情况都省掉了另存一份相同内容。
- **驱逐是「被借走时顺手发生」的。** 计数减到 0 的块带着登记排回空闲队列；被借走之前仍能被后续请求捡回来，真被借走登记才被抹掉。归还按倒序排队，序列开头的块留得最久——前缀恰好在开头，这就是想要的效果。如果显存池放不下大量冷前缀、频繁被驱逐重算，而主机内存富余，可以搭配 [KV cache CPU offload](kv-cache-cpu-offload.md) 在主机内存增设一层冷前缀备份。
- **命中空闲队列里的块不是白拿。** 要把它从队列里摘出来，所以它算进本步「池子够不够」的账。

「满了怎么办」等于「借不到块怎么办」：宁可抢占整条请求，也不借一半，见同页[「池子不够时」](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。

遇到“前缀命中很多，继续生成仍有额外准备”，先核对命中覆盖了哪类状态。[SWA 回放案例](swa-bounded-replay.md#encoder-与-decoder-回放解决的是两件事)区分已保存的长历史与缺失窗口；它补充的是具体模型的恢复条件，不改变本页的通用前缀匹配规则。

共享与归还可以在[缓存生命周期 3D](block-table.md#scene-inference-mechanism-1)的“共享前缀”阶段观察：两条请求指向同一个完整块，R1 结束只撤销自己的引用，R2 仍能继续使用。直到所有引用都撤下，块才回到空闲队列。

### 固定分块链式哈希 APC vs RadixAttention（基数树），以及与 Chunked Prefill 的协同

业界前缀缓存主要有两条实现路线：**vLLM 的固定分块链式哈希 APC**，以及以 SGLang 为代表的 **RadixAttention（基数树 / Radix Tree）**。两者目标相同，但在匹配粒度与数据结构开销上各有取舍：

| 对比维度 | vLLM 固定分块链式哈希 APC | SGLang RadixAttention（基数树） |
| --- | --- | --- |
| **索引结构** | 固定块长 `block_size` 的链式哈希表 `hash(前块哈希, 本块 token, 额外键)` | 压缩前缀树（Radix Tree），每条边存可变长 token 序列 |
| **命中粒度** | 整块对齐（如 `16` 或昇腾默认 `128` token；不足一整块的尾部默认不命中，新版在特定条件下才支持部分尾块） | 树边可在任意分叉点劈开；`page_size=1` 时达**逐 token 粒度**，分页部署（`page_size > 1`）仍向下对齐到 `page_size` 边界 |
| **查表与维护开销** | 逐块 $O(1)$ 哈希查找，无树节点分裂、合并与指针维护，与 [PagedAttention](paged-attention.md) 物理页天然对齐 | 命中与淘汰需维护树边劈分、节点引用和叶节点 LRU（最近最少使用）驱逐队列，树结构管理略重 |
| **典型适用面** | 固定块分页执行器（含昇腾 `block_size=128` 向量化访问）、多组混合缓存按块对齐 | 多轮树状分支搜索、短分叉频繁、配合细粒度页或部分页复用减少尾部重算的场景 |

**与 [Chunked Prefill（分块预填充）](chunked-prefill.md) 的协同分工也非常清晰：先由 APC 跳过已命中前缀，再由 Chunked Prefill 切分剩余未命中后缀。** 请求进入调度时，`get_computed_blocks` 先查出已命中的连续前缀并推进 `num_computed_tokens`；随后分块预填充只对剩下的未命中后缀（`num_prompt_tokens - num_computed_tokens`）按当步实际可用预算（扣除同批在跑请求占用及单条上限后）切块计算。例如在无其他在跑请求占预算、也未设更紧单请求截断阈值的空载示意下，一段 `10,000` token 的输入若前缀缓存命中前 `4,096` token、单步预算 `2,048` token，引擎直接跳过前 `4,096` token，仅对后 `5,904` token 分 `3` 步完成 Prefill。对于带线性注意力的混合模型，在 `align` 模式下若单步预算够跨过可留档块边界，调度器会把切分终点向下对齐到块边界以便状态落档；当块长大于单步可用长度时，新版主基线也允许先推进不落档的子块步、持有私有状态直至跨过整块边界。

## 异构混合模型边界：KDA 与稀疏 MLA 多组对齐（GLM 双机对照）

上面讲完了标准单组模型（如 `Qwen3-8B`）的链式指纹复用与共享块池规则。下面转入本站 `09 旗舰异构模型全案` 的历史混合模型绑定案例（`vllm@0fc695fc + vllm-ascend@db701c1f`，部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)）。

**默认关着。** GLM-5.3-Flash 同时有全注意力（稀疏 MLA）和线性注意力（KDA）两类层，vLLM 把这类模型标为 hybrid。`v0.23` 上游判定 hybrid 默认不支持 prefix caching（实验阶段），官方双机命令未显式写该开关，因此本部署默认关闭：无登记、无命中、无驱逐，[R1](one-request.md#示例请求-r1-与官方双机部署)（4 个 token）一定完整重算（见[部署页后果清单](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)）。

**显式打开会发生什么（照镜像源码推演，未实跑）：** 「判不支持」只决定默认值，不拦显式设置，开关写上就开。随后三件事连着变：

1. **KDA 的缓存模式从「不留档」变成 `align`。** `all` 模式保存每个块边界的状态；`align` 只在一次调度步结束、且终点恰好落在块边界时保存。GLM 未声明支持 `all`，上游回退到 `align` 并要求开启 [chunked prefill](chunked-prefill.md)；镜像将需要留档的 prefill 切分终点对齐到调度粒度，但单次切分仍可跨多个块。
2. **KDA 的可留档边界改成逻辑块。** 关缓存时状态的「块」盖住整条最长长度；开了后块长改为[逻辑块 640](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。例如一次 prefill 从 0 算到 7,680，`align` 可以留下 7,680 的状态，不会自动留下 640、1,280 等步内边界；旧状态块可归还池子，未淘汰的已登记档才能被复用。
3. **指纹粒度变细。** 关缓存时指纹粒度取调度粒度（各组块大小最小公倍数 `133,120`，等于不做细哈希）；开了后取各组块大小最大公约数，照[缓存规格](kv-cache-spec.md)算出为 `4` 个位置一段。

**混合多组对齐与「只砍不涨」边界：** GLM 有 [5 个缓存组](kv-cache-spec.md)，每个组对同一前缀位置的恢复条件不同：

- **full 组**（MLA 压缩历史和 indexer K）：MLA 按位置保存，indexer K 每 4 个位置压成一条，逻辑覆盖按 `640` 整块；复用要求写满、身份匹配且登记仍在。
- **KDA 组**（3 个）：不存逐 token 的 K/V，只有按边界留的状态档；有恰好停在目标位置的档就够（前面填占位块），没有档就完全接不上。
- **尾状态组**（indexer 滑动窗口）：只要求窗口盖住的最近一小段在缓存里。

调度器在[请求第 2 站调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)用「只砍不涨」循环取公共长度：从最长候选开始挨个组查，哪个组接不上就把候选砍到它能接上的位置并让所有组重查，直到都点头。**因此旧镜像虽每 `4` 个位置算指纹，但 full 组按 `640` 整块砍、KDA 只在 `640` 边界留档，公共恢复长度总是 `640` 的整数倍**（不足 640 token 无命中收益，R1 的 4 token 命中恒为 0）：

```wiki-diagram
file: prefix-caching-flow
```

## 常见误解

- **「开着它，相同内容就绝不会存两份。」** 命中现有块时只填[块表](block-table.md)、增加计数，不复制数据；若不同请求先各自算出了相同内容，旧版登记表允许一个指纹对应多个物理块，不会立即合并已分配块。
- **「命中省的是显存读。」** 直接省的是前缀计算，新位置需要的历史仍要读取。TTFT和整体吞吐应分别测量，不能把prefill收益当成decode每步收益。
- **「文本相同一定命中。」** 还要匹配token及LoRA、多模态内容、盐值等输入身份，并且所需状态仍在缓存里。
- **「指纹能对到4个位置，就能按4个位置恢复。」** 输入哈希的粒度不等于状态保存粒度；固定旧GLM的公共恢复长度被full整块和KDA边界档限制为640的整数倍。
- **「hybrid 被判不支持，等于不能开。」** 那只是默认值。显式写上开关就开（v0.23 会走 align 模式），要不要开是另一个问题。
- **「整段 prompt 全命中，就一个 token 都不用算。」** 最后一个 token 必须重算——要用它的输出预测下一个 token；已算位置又要对齐块边界，所以可能整块重算。

## 对照源码

### 怎么开

- 开关是 `--enable-prefix-caching`。没写时取模型判定：GLM 的 `attn_type` 是 `"hybrid"`，`is_prefix_caching_supported` 对 hybrid 返回 False [C6]，`enable_prefix_caching` 未显式给出时取它 [C8]。官方双机命令没写这个开关，见[部署页](glm-5-3-flash-two-node.md#怎么开)。
- 显式打开不会被旧版“hybrid默认不支持”这一判定拒绝，其他组合条件仍需满足（来源8）。镜像的配置校验先调用上游：默认 `mamba_cache_mode="none"` 根据模型能力改成all或align。GLM未声明 `supports_mamba_prefix_caching=True`，因此走align；能力判断读取这个属性，不仅看类继承名（来源7、12、19、39）。镜像随后把 `mamba_block_size` 定为已对齐的 `block_size=640`（来源13–14）。main的默认模式逻辑另见版本表。
- 指纹粒度：镜像给 GLM 单独写了分支 `_ascend_resolve_kv_cache_block_sizes`——调度粒度取各组块大小的最小公倍数；APC 和 KV connector 都不开时指纹粒度直接等于它（不做细粒度哈希），开了就取各组最大公约数 [C11]。上游原版遇到「Mamba 组块大小不等于逻辑块」会放弃细哈希退回调度粒度 [C4]，镜像注释写明这条对 GLM 不对，所以绕开。
- 镜像 `Scheduler._mamba_block_aligned_split` 在抵达最后可缓存位置前向下对齐chunk，或把跨过该位置的一步截到那里；最后不足整块的部分仍可不对齐。它使实际满足留档条件的步终点可缓存，不保证沿途每个边界都有档（来源16）。

哈希与隔离还有两项配置，不能只看总开关：

| 入口 | 控制什么 | 选择时要看什么 |
|---|---|---|
| `--prefix-caching-hash-algo` | 默认sha256；sha256_cbor用规范CBOR序列化，xxhash及xxhash_cbor用128位非加密哈希 | 后两项需要xxhash包；更快的哈希与碰撞风险须结合负载和租户隔离权衡。CBOR提供稳定的序列化，不使不同模型状态兼容。 |
| 请求字段 `cache_salt` | 盐值进入首段指纹，随后通过前段哈希影响整个前缀 | 只让应共享的请求使用同一盐值；隔离用途应使用受保护、不可预测的值。它不是身份认证，也不是显存独占配额。 |

源码与官方设计见来源32、35–37。官方离线示例启用 APC 后，先运行一条请求，再运行共享长开头的另一条。验证收益时可照此记录耗时与实际命中量，再自行关闭 APC、重启实例并重跑相同请求作对照。示例本身没有自动完成开关对照，也没有提供本部署的性能结果（来源33–34）。

### 会报什么错

- 开 APC、关 chunked prefill：断言失败 `Chunked prefill is required for mamba cache mode 'align'.` [C7]。
- 开成功时有两条日志可确认：warning 说 cache mode 因开了 prefix caching 被设为 `align`，info 说 Mamba 层的 prefix caching 仍是实验性的。排查时以这两条和启动日志里的判定为准，别拿配置类的字段默认值当有效配置。
- 手动指定的指纹粒度除不尽某个组的块大小：`ValueError`，上游和 GLM 分支各有一条、报文不同 [C11]。
- 一条容易误读的死分支：DeepSeek-V4 压缩式 attention 的层文件里有 `cache_config.enable_prefix_caching = False`，条件是后端名等于 `TRITON_MLA` 或 `FLASHINFER` [C17]；这条路上后端固定是 `AscendDSABackend`，名字只会是 `ASCEND_DSA` 或 `FLASH_ATTN` [C18]，永远不触发；GLM 的 DSA 式稀疏 MLA 也不走这个文件（见 [sparse attention](sparse-attention.md)）。别据此以为昇腾会自动关掉 APC。

### 开销和什么时候别开

- **本部署默认关。** 要研究「开了怎样」，第一步是确认状态：看启动日志，不是看代码里的默认值。
- **命中粒度 640。** 由 full 组整块和 KDA 边界档共同卡出 [I]。共享开头不足 640 个 token 的负载——短对话、每条请求开头各不相同——开了只有登记和查表的开销；R1 的 4 个 token 命中恒为 0 [A]。
- **KDA 留档的显存。** align 的留档粒度是对齐的调度步终点，不是沿途所有 640 边界；分配器为当前状态和候选保留块，用 null 占位跳过中间边界，并回收不再需要的旧状态块。已登记的旧档在空闲队列中仍可被命中或淘汰。每份实体页仍要补齐到和注意力页一样大（见[缓存规格](kv-cache-spec.md)），实际留存量还取决于调度切分、共享引用和淘汰，不能按序列长度直接线性累加。[D]
- **整块重算。** 全命中也要留最后一个 token 拿 logits，已算位置对齐块边界，可能触发整块重算 [C1]。
- **正确性与收益都没有 GLM 上的实跑证据。** 复用应保持模型计算语义，但浮点执行顺序和内核差异可能影响逐 token 结果；上游对 hybrid 开 align 的措辞是「实验性」[C7]。本知识库没有在 GLM 双机上实测过开 APC 的输出一致性和 TTFT 收益，均标待核 [!]。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**正文 GLM 双机绑定算例固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，不代表 `v0.23.0` 发布分支包含 GLM 代码。** 前两个 Ascend 发布钉点没有该模型，`v0.30.0` 与 `main` 在 `models/glm5next/` 下提供实现。

`v0.30.0` 与 `main` 配套上游放宽了部分 hybrid cache 的 DCP 条件：`HybridKVCacheCoordinator` 在 `DCP > 1` 时只接受 `FullAttentionSpec` / `MambaSpec` 组合（前者历史分片，后者状态复制），`PCP` 仍要求 1，滑窗等其他 spec 仍拒绝。指纹粒度整除检查只针对 `is_prefix_cacheable` 组，GLM KPool tail 等私有临时状态不纳入。Ascend GLM KPool 自身仍拒绝 PCP/DCP；上游这个放宽不改变模型后端的限制（来源 26–29）。

| 核对项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 生成式 hybrid 的 APC 默认值 | 关：模型判定不支持，未显式配置时取该值 | 关：虽判支持，hybrid 仍要求手动打开 | 开：按模型支持取默认（`arg_utils.py#L2794-L2834`） | 开：按模型支持取默认（`arg_utils.py#L3106-L3142`） |
| GLM 模型与 Mamba `align` 模式 | 发布分支无 GLM；旧镜像 `db701c1f` 显式开 APC 后走 `align` | 发布分支无 GLM；支持 `all` 选 `all`，否则 `align` | 有 `models/glm5next/`；`patch_mamba_config.py#L122-L176` 对齐逻辑块并走 `align` | 同 `v0.30.0`（`patch_mamba_config.py#L122-L176`）；默认打开不保证实际有命中 |
| 混合注意力缓存组过滤与指纹粒度 | 旧镜像 APC 开启时全部组参与得 4；发布分支无 GLM 路径 | 无 GLM 路径 | `patch_kv_cache_utils.py#L84-L140` 用 `is_prefix_cacheable` 排除私有尾状态组再按上游解析 | 由 `patch_kv_cache_coordinator.py#L205-L295`、`L361-L405` 统一筛 `is_prefix_cacheable` 并协同 `find_longest_cache_hit`（上游见 `kv_cache_coordinator.py#L806-L860`） |
| 细匹配配置入口与哈希算法 | 内部字段 `hash_block_size`；默认 `sha256`（含 `sha256_cbor`、`xxhash`、`xxhash_cbor`） | CLI `--prefix-match-unit`，默认不指定；哈希算法同左 | 同 `v0.26.0rc`，并检查各可缓存组整除与状态压缩边界；算法同左 | 同 `v0.30.0`（`kv_cache_manager.py#L288-L350`） |

默认开关链见来源 6、8、20–22、28、52；模式与模型见 7、19、24、40–41、47–48、51；算法见 35、53–54、56。旧版“整块才可登记”也已变化：`v0.26.0rc` 起的部分尾块路径及 full/Mamba 各自的条件，统一见[块分配版本表](vllm-kv-block-allocation.md#版本差异)。

`v0.30.0` / `main` 下，保持这套 GLM 模型配置、未显式放大块长、不开上下文并行、不指定更小匹配单元且 APC 走 `align` 时：full 和 KDA 组的逻辑块都为 640，私有 tail 组被排除，默认哈希粒度由剩余组最大公约数得到 640。它不同于旧镜像的 4，不能混用。依据是模型规格、尾状态不可缓存标志、Mamba 块长设定与最终解析调用（来源 23、43–50、57）。显式减小匹配单元还须满足整除与状态压缩对齐，能够实际复用多细要看各组留下的状态；本页没有新版 GLM 设备运行证据。[I]

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

all 与 align 的保存时机见来源 30；来源 31 的 1165–1195 行用 null 跳过中间边界、复用候选块，1203–1209 行给出旧状态的可回收范围，1211–1227 行登记实际留下的非 null 状态。640 是可恢复边界的必要粒度，不保证每个这样的边界都有档。

普通前缀设计及其八张图见32，包含重复块允许存在的示例；实际一hash多块映射见38。长文档、多轮对话的适用负载与可重复的离线示例见33–34，均为官方文档或示例依据。[S33] SGLang 提出的 RadixAttention 压缩前缀树（Radix Tree）按可变长 token 边匹配与叶节点 LRU 淘汰的架构对照见 [S67]。指纹粒度字段与CLI见36、42、55；请求盐值见37。表中的哈希粒度推导不等于物理页大小，也不等于每段输入都有递推状态档。

调度分配阶段预先登记见58，排除尚未确定的投机候选；Mamba本步依赖检查见[块分配源码说明](vllm-kv-block-allocation.md#源码位置)，须把“已登记”与“状态已就绪”分开。
