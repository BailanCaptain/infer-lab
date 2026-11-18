---
id: paged-attention
title: PagedAttention（分页注意力）
type: concept
origin: direct
summary: >-
  借鉴操作系统虚拟内存分页思想，把 KV cache 显存池切成固定长度（昇腾默认 128 token）的物理块按需借还，通过块表把连续逻辑位置映射到离散物理块，彻底消灭外部显存碎片、支持相同前缀零拷贝共享，并将单序列内部预留浪费严格收敛到最后一块以内。
aliases:
  - PagedAttention
  - Paged Attention
  - 分页注意力
  - 分页布局
  - 分页 KV 缓存
  - 分页缓存
  - KV 分页
  - 内存碎片
  - 显存碎片
  - 内部碎片
  - 外部碎片
  - 物理块池
  - KVCacheBlock
  - free_block_queue
  - page_size_bytes
  - '--block-size'
chapters:
  - '03'
sources:
  - 'https://arxiv.org/abs/2309.06180'
  - 'vllm@ced6857a:docs/design/paged_attention.md#L1-L80'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L45-L65'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/non_contiguous_kv_cache.md#L1-L48'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L175-L225'
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L143-L203'
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L664-L801'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L265-L465'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L478-L530'
  - 'vllm@ced6857a:vllm/config/cache.py#L71-L80'
  - 'vllm@ced6857a:vllm/platforms/interface.py#L609-L646'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L405-L427'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1370-L1375'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1446-L1554'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L109-L152'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L897-L954'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1558-L1612'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/utils.py#L284-L318'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1420'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1240-L1291'
  - 'vllm@ba15685a:vllm/config/cache.py#L185-L195'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1460-L1547'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache
    kind: builds-on
    note: 理解每一层为什么要跨步保留历史 K、V，才能看清这些随生成逐词增长的张量为什么会耗尽显存
  - to: continuous-batching
    kind: builds-on
    note: 请求随时进场、长短交错退场的连续批处理调度，正是传统连续预留产生外部碎片与并发瓶颈的直接诱因
contradicts: []
updated: '2026-11-18'
---

**PagedAttention（分页注意力）是 vLLM 管理 [KV cache](kv-cache.md) 显存并直接跨块计算注意力的核心机制：它借鉴操作系统虚拟内存分页思想，把设备显存事先切成大小相同的固定物理块（每块容纳 `block_size` 个 token），让请求按需一块块借用，再通过整数[块表（Block Table）](block-table.md)引导注意力算子原地跨块读取历史，不再要求一条请求的缓存连续存放。**

在[一次请求全景鸟瞰](request-overview.md)与[连续批处理](continuous-batching.md)的主线中，每当新请求进场或在线请求每轮往前生成 1 个新词，调度器都要先确认“它的历史 K、V 往哪儿放”。一旦这笔空间账管不好，NPU 的算力还没跑满，HBM 显存就会先一步见底，把原本能接纳几十条并发请求的批次硬生生卡死在几条。

## 为什么连续预留 KV cache 会提前卡死并发？

在传统深度学习框架里，一个张量必须在显存里占据一整段首尾相连的连续地址。但大语言模型生成文本有一个天然难题：**请求刚进门时，谁也不知道它最终会生成 20 个词就遇到结束符停下，还是写满 `4,096` 甚至 `32,768` 个词才结束。** 如果强行要求每条请求的 KV cache 保持连续，引擎只能按模型允许的最大上下文长度（`max_model_len`）提前划出一整段连续显存，当场制造出三类显存黑洞：

1. **内部预留浪费（Internal Fragmentation，占比最大）**：为了防备极少数写满上限的长回答，短请求也被迫占死几千乃至几万个尚未写入的空白位置；这些预留空洞在请求结束前别的请求一个字节也借不走。
2. **外部碎片死角（External Fragmentation）**：在连续批处理下，长短不一的请求随时穿插退场，显存条上留下一段段互不相连的零碎夹缝；哪怕所有空闲夹缝加起来足够装下新请求，只要找不到一整段够长的连续空间，新请求就只能排队干等，或者付出高昂带宽把在途大张量整段搬家拼合。
3. **相同前缀被迫重复拷贝**：线上服务里成百上千条请求往往带着完全相同的长系统提示词（system prompt）或公共参考文档；每条请求独占一段连续缓冲区时，相同的开头只能在显存里复制几十份，白付成倍显存与重复的 Prefill 计算。

操作系统几十年前解决进程内存碎片用的是同一把钥匙——**虚拟内存分页（Paging）**：程序自己看到的是从 `0` 开始连续增长的虚拟页，底层物理内存则切成等长的物理页框，靠一张页表做翻译。PagedAttention 把这套思想原封不动搬进了 HBM 显存池：

```wiki-diagram
file: paged-attention-plate-cutaway
```

顺着上面立体剖面图的五根引线从左往右看：**①** 左侧每条请求内部只管按 `BLOCK 0, 1, 2...` 连续切分自己的逻辑历史，每块固定装 `block_size` 个位置，启动时根本不必预知最终输出长度；**②** 中央的整数块表（`BLOCK TABLE`）像操作系统页表一样，把每条请求的“第几个逻辑块”翻译成右侧显存池里的“第几号物理块”，注意力算子直接拿着块表跨块读取，全程零张量拼接拷贝；**③** 请求 A 与请求 B 完全相同的系统提示词直接共指右上角同一个 `SHARED` 物理块（引用计数 `ref_cnt = 2`），既不重复占显存也不重复算 Prefill；**④** 请求写满上一块时才按需借下一块，没用完的空位被死死关在每条请求的最后一块里；**⑤** 右下整个 `HBM KV POOL` 全部由尺寸一模一样的物理抽屉组成。把传统连续预留与定长块池放到同一条 HBM 显存带上正面对比，三类黑洞是怎样被逐一拆解的一目了然：

```wiki-diagram
file: paged-attention-fig-waste-vs-paging
```

对照上图下半幅的 8 块教学池（按昇腾默认块长 `block_size = 128` 示意，`Block 0` 为系统保留块）：请求 A（`128` 词公共系统提示词 + `90` 词独有内容，共 `218` 词）的块表记为 `[1, 3]`，请求 B（同一段 `128` 词公共提示词 + `70` 词独有内容，共 `198` 词）的块表记为 `[1, 5]`。两者共指满块 `Block 1`（`ref_cnt = 2`），直接省掉一份 `128` 词的重复显存；物理上互不挨着的 `Block 2, 4, 6, 7` 全是尺寸相同的 `128` 格抽屉，新请求 C 进场时直接拼进它的块表就能用，**外部碎片彻底归零**。

对于单条长度为 $L_{\text{seq}}$（$L_{\text{seq}} \ge 1$）、块长为 $B$ 的普通注意力序列，它借用的物理块数与落在本请求最后一块里的未写满空槽位数（内部浪费）严格满足：

$$N_{\text{blocks}}(L_{\text{seq}}) = \left\lceil \frac{L_{\text{seq}}}{B} \right\rceil, \qquad W_{\text{internal}} = N_{\text{blocks}}(L_{\text{seq}}) \cdot B - L_{\text{seq}} \le B - 1$$

也就是说，在单个按位置增长的标准注意力缓存组、且未额外开启投机解码草稿槽位预留（`num_lookahead_tokens`）的前提下，每条在途请求最多只在末尾那一块空出不超过 `B - 1` 个位置（例如上图中 A 空 `38` 格、B 空 `58` 格，上限 `127` 格）；若模型带有固定页大小的线性注意力状态组或开启了投机候选预留，则按对应缓存组规则另计预留块。

## 定长物理块池怎么运转：借块、共享与归还

要把上面的分页直觉变成每步微秒级完成的工程调度，vLLM 把**设备侧 HBM 里的真实张量**和**主机侧 CPU 上的块号账本**彻底拆开：NPU Worker 在启动阶段完成[KV cache 显存预算](kv-cache-memory-profiling.md)探测后，一次性在 HBM 里切好整座缓存张量，推理全程不再向驱动反复申请或释放显存；EngineCore 里的 `KVCacheManager` 与底层 `BlockPool` 只在 CPU 上用双向链表 `free_block_queue`（`FreeKVCacheBlockQueue`）流转轻量级 `KVCacheBlock` 元数据对象（完整多组协调与抢占细节见 [KV 块分配](vllm-kv-block-allocation.md)）。

一个物理块号从启动到复用，在 `BlockPool` 里只走四步确定性状态流转：

| 生命周期动作 | 核心入口函数 | `ref_cnt` 变化 | 空闲队列 `free_block_queue` 与 HBM 显存行为 |
| --- | --- | --- | --- |
| **启动预留 0 号块** | `BlockPool.__init__` | 不维护（`is_null = True`） | 从队头永久弹出 `block_id = 0` 作为 `null_block`（供填零占位或滑窗外淘汰位置使用），剩余 `num_gpu_blocks - 1` 块留在空闲队列 |
| **按需借出新块** | `allocate_slots` → `get_new_blocks` | `0 → 1` | 请求写满上一块越界时，从队头 `popleft_n` 取出所需块数；若原块带有旧前缀哈希，当场注销旧哈希并覆写新计算的 K、V |
| **命中前缀共享** | `get_computed_blocks` + `allocate_slots` → `touch` | `0 → 1` 或 `k → k + 1` | [前缀缓存](prefix-caching.md)先由 `get_computed_blocks` 匹配到已写满的哈希块，再在 `allocate_slots` 实际分配时调 `touch`（若 `ref_cnt == 0` 先从空闲队列摘出，再累加引用计数），HBM 零拷贝 |
| **归还未哈希块** | `free` → `free_blocks`（无哈希） | `1 → 0` | 未写满的尾块或关闭前缀缓存时的块归零后，用 `prepend_n` 插回**队头（LIFO）**优先复用，HBM 旧数据原地保留不擦除 |
| **归还已哈希满块** | `free` → `free_blocks`（带哈希） | `k → k - 1`（至 `0` 入队） | 仍有其他请求共指（`ref_cnt > 0`）时仅减计数；减至 `0` 后用 `append_n` 挂入**队尾（FIFO / LRU）**保留哈希，等后续请求命中或队头耗尽时再淘汰 |

理解这张状态表能一举打通两个关键工程细节：第一，只有写满整整 `block_size` 个已确认位置并登记了内容哈希的块才会被多条请求共享，未写满的尾块满足 `is_block_writable`（`ref_cnt == 1` 且无哈希），两条共享了系统提示词的请求一旦在各自回答段分叉，会分别借用各自的私有尾块继续追加，绝不会互相踩踏；第二，[分块预填充（Chunked Prefill）](chunked-prefill.md)把长提示词拆成多步计算时，下一步只需顺着 `allocate_slots` 在上一轮未写满的尾块后继续追加或按需补借新块，天然无缝衔接。

## 一块到底占多少显存：Qwen3-8B 与 Qwen3-30B-A3B 算账

知道了块号怎么借还，部署前最关心的问题就是：**昇腾上一个默认物理块（`block_size = 128`）究竟吃掉多少 MiB 显存？给定一块固定的 KV 预算，到底能切出多少个块？** 先看主基线两款标准模型 `Qwen3-8B`（稠密 GQA）与 `Qwen3-30B-A3B`（稀疏 MoE GQA）在 `block_size = 128`、BF16 精度下的单块字节解剖与粒度对照图：

```wiki-diagram
file: paged-attention-fig-qwen3-block-bytes
```

承接[读懂 HuggingFace 模型目录与 config.json](hf-model-anatomy.md) 与 [GQA](gqa.md) 的单 token 推导，设块长为 $B$、单卡分担的 KV 头数为 $n_{\text{kv}} / T$（张量并行度 $T \le n_{\text{kv}}$ 时按头均分；若 $T > n_{\text{kv}}$ 则每卡复制保留 $1$ 个 KV 头）、每头维度为 $d_h$、单元素字节数为 $b_{\text{dtype}}$（BF16 为 `2 B`）、模型总层数为 $L$，则单层单块页字节数（源码 `AttentionSpec.page_size_bytes`）与全模型跨 $L$ 层占用的单块总显存分别为：

$$\text{Bytes}_{\text{layer-page}} = 2 \times B \times \frac{n_{\text{kv}}}{T} \times d_h \times b_{\text{dtype}}, \qquad \text{Bytes}_{\text{block}} = L \times \text{Bytes}_{\text{layer-page}}$$

代入昇腾默认块长 $B = 128$ 与 BF16（$b_{\text{dtype}} = 2\text{ B}$），并给出一个便于直观横向对比的 `10 GiB`（`10,240 MiB`）静态每卡可用 KV 预算示意（真实服务须先经启动期探测扣除权重、激活峰值与通信缓冲，且池中 0 号块固定留给 `null_block`），两款标准模型的账单如下：

| 核算维度（BF16，昇腾默认 $B = 128$） | `Qwen3-8B`（单卡 `TP = 1`） | `Qwen3-30B-A3B`（整模口径 `TP = 1`） | `Qwen3-30B-A3B`（4 卡 `TP = 4` 每卡） |
| --- | --- | --- | --- |
| 层数 $L$ / 总 KV 头 $n_{\text{kv}}$ / 单卡 KV 头 / $d_h$ | `36` / `8` / `8` / `128` | `48` / `4` / `4` / `128` | `48` / `4` / **`1`** / `128` |
| 单层单 token 字节数 / 全层单 token 字节数 | `4 KiB` / **`144 KiB`** | `2 KiB` / **`96 KiB`** | `512 B` / **`24 KiB`**（4 卡合为 `96 KiB`） |
| 单层 1 块 `page_size_bytes`（`128` token） | `128 × 4 KiB = 512 KiB` | `128 × 2 KiB = 256 KiB` | `128 × 512 B = 64 KiB` |
| **全模型 1 个物理块占用 $\text{Bytes}_{\text{block}}$** | **`18 MiB`**（`512 KiB × 36`） | **`12 MiB`**（`256 KiB × 48`） | **`3 MiB / 卡`**（4 卡合计 `12 MiB`） |
| 单请求末块内部浪费上限（`127` 个空槽位） | `< 18 MiB`（至多 `17.86 MiB`） | `< 12 MiB`（至多 `11.91 MiB`） | `< 3 MiB / 卡`（至多 `2.98 MiB / 卡`） |
| 每卡 `10 GiB` 静态预算可切总块数（示意） | `⌊10,240 / 18⌋ = 568` 块（扣 `null_block` 后 `567` 块可借，装 `72,576` tok） | `⌊10,240 / 12⌋ = 853` 块（扣 `null_block` 后 `852` 块可借，装 `109,056` tok） | 每卡 `10 GiB` 可切 `⌊10,240 / 3⌋ = 3,413` 总块（扣 `null_block` 后 `3,412` 可借块，4 卡同步支撑 `436,736 ≈ 43.67 万` tok） |

两组数字放在一起，立刻就能看清架构参数怎样左右分页容量：`Qwen3-30B-A3B` 虽然总参数高达 `30.53B`（必须切多卡才能装下 `56.87 GiB` BF16 权重）、层数也比 `Qwen3-8B` 多出三分之一（`48` vs `36`），但因为它的总 KV 头数从 `8` 减半到了 `4`，整模 1 个 `128`-token 物理块反而从 **`18 MiB` 降到了 `12 MiB`**；切到 `TP = 4` 后每张卡只存 `1` 个 KV 头，单卡每块仅占 **`3 MiB`**（若继续扩到 `TP = 8 > 4`，KV 头触发跨卡复制，每卡仍保底存 `1` 个 KV 头即 `3 MiB/块`，不会再减半）。

## 昇腾 v0.30.0 的块长对齐：为什么默认 128，何时变成 512？

从 GPU 迁移到昇腾的开发者常会疑惑：上游 GPU 版 `CacheConfig` 长期把默认块长定为 `16`（上游 `main` 调至 `64`），为什么 `vllm-ascend` 默认采用 **`block_size = 128`**？根源在硬件访存与算子分形对齐：昇腾 AI Core 的突发 DMA 搬运、`NZ` 分形排布以及标准注意力后端 `AscendAttentionBackend`（底层调用 `torch_npu.npu_fused_infer_attention_score`，简称 FIA）均以 `128` 个位置为内核标准页；取 `128` 既满足 `C8 INT8` 缓存量化的 `32` 倍数断言，又把块表列宽压缩到块长 `16` 时的 `1/8`，避免碎片化小页拖垮 HBM 带宽利用率。

在 `v0.30.0` 主基线下，`NPUPlatform` 通过 `refresh_block_size` 与 `update_block_size_for_backend` 两道关口协同拍板最终生效的 `block_size`：

| 启动配置场景 | `v0.30.0` 生效块长 | 触发条件与运行时行为 |
| --- | --- | --- |
| **默认不传 `--block-size`**（BF16 / FP16 / C8 INT8） | **`128`** | `refresh_block_size` 与 `AscendAttentionBackend` 首选块长一致落定 `128`；若启用 `C8 INT8` 还会额外校验 `block_size % 32 == 0` |
| **显式传 `--block-size 16 / 32 / 64`**（常规模型） | **默认静默改回 `128`** | 只要 `enable_prefix_caching` 或 `enable_chunked_prefill` 任一开启（V1 默认双开），即打印提示并强制重置为 `128`；开启 `xlite` 图模式且 `> 128` 时也会钳回 `128` |
| **开启 `--kv-cache-dtype mxfp8`**（`C8_MXFP`） | **`512`（或其整数倍）** | QFA 内核要求整 `512`-token 块（`A5_C8_MXFP_KV_CACHE_BLOCK_SIZE = 512`）：未传 `--block-size` 时自动抬升为 `512`；显式错传非 `512` 倍数直接抛 `ValueError` |
| **特殊模型与混合架构**（`deepseek_v4` / Attention+Mamba） | **按模型规则对齐** | `deepseek_v4` 限定 `{32, 64, 128}`（越界告警改回 `32`）；Attention+Mamba 混合模型跳过通用 `128` 覆盖，交由多缓存组对齐逻辑处理 |

块池分配好整数块号之后，每层 HBM 缓存张量默认按 `(2, num_blocks, block_size, num_kv_heads, head_size)` 排布（当环境变量 `VLLM_KV_CACHE_LAYOUT` 设为 `LBHNC` 或 `HND` 时轴顺序切为 `(2, num_blocks, num_kv_heads, block_size, head_size)`）。前向计算时，昇腾常规路径直接把 `block_table` 和 `block_size` 传给融合算子 `npu_fused_infer_attention_score` 原地跨块读取，而名字叫 `PagedAttention` 的独立算子分支（`using_paged_attention`）仅在未开投机解码、`FULL_DECODE_ONLY` 图模式且本步 token 数命中 `additional_config.pa_shape_list`（或特定大头维回退）时才启用。至于混合模型里“调度分配块长、内核 `128` 块长、压缩索引与线性状态页”四套尺寸怎样在块表里拆分对齐并换算成每步写入槽位 `slot_mapping`，紧接着由下一站 [Block Table](block-table.md) 拆解。

## 常见误解

```wiki-diagram
file: paged-attention-fig-myths
```

- **“上了 PagedAttention，KV 显存浪费就变成 0 了。”** 错。彻底归零的是物理块之间的**外部碎片**；每条在途请求的最后一块只要没写满，仍留有至多 `block_size - 1` 个位置的**有界内部余量**（投机解码草稿槽位与混合状态页另计）。
- **“命令行写了 `--block-size 16`，昇腾上就一定按 16 切块。”** 错。V1 引擎默认同时开启前缀缓存与分块预填充，常规非混合模型只要其中任一项开着，`refresh_block_size` 就会把非 `128` 的块长静默改回 `128`。
- **“算注意力前，Worker 会先把分散的物理块拼回一段连续张量。”** 错。若每步都把历史块重拷拼接一遍，分页省下的带宽和显存当场归零；真实算子直接拿整数块表在离散物理块上原地寻址。
- **“Profiling 里只看到 `FIA` 没看到 `PagedAttention` 算子，说明分页没生效。”** 错。分页是 KV 缓存的存储与寻址机制；昇腾主力算子 `npu_fused_infer_attention_score` 原生接收 `block_table` 完成分页读取，不依赖同名算子。
- **“请求一结束，`free_blocks` 就会把物理块里的 K、V 清零。”** 错。归还动作只在 CPU 上递减 `ref_cnt` 并把空闲块挂回双向链表（无哈希插队头、带哈希挂队尾作 LRU 候选），HBM 里的数值原封不动留到下次被覆写或直接被后续相同前缀命中复用。

## 对照源码

### 怎么配与会报什么错

PagedAttention 在 vLLM V1 中常驻生效，无需手动开启。常用控制参数与典型报错/日志如下：

- `--block-size`（`CacheConfig.block_size`）：控制单个块容纳的 token 数；未显式传入时 `user_specified_block_size` 为 `False`[C10]，昇腾标准路径自动落定 `128`。
- `Block size is set to 128 if prefix cache or chunked prefill is enabled.`：常规模型传了非 `128` 的 `--block-size`，但未同时传 `--no-enable-prefix-caching` 与 `--no-enable-chunked-prefill` 时打印的重写日志。
- `ValueError: C8_MXFP requires --block-size to be a multiple of 512.`：开启 `--kv-cache-dtype mxfp8` 的同时手动指定了非 `512` 整数倍的 `--block-size`[C14]。
- `AssertionError: C8 INT8 KV cache requires block_size to be a multiple of 32`：在关闭自动重写分支后，为 `C8 INT8` 传入了非 `32` 倍数的块长[C17]。
- `ValueError: Cannot get ... free blocks from the pool`：单次 `get_new_blocks` 请求数超出 `free_block_queue` 剩余空闲块（正常调度由 `allocate_slots` 先检查余量并返回 `None` 触发排队或抢占）。

### 版本差异

| 核对维度 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) | 对使用者的实际影响 |
| --- | --- | --- | --- | --- | --- |
| 上游 `CacheConfig` 基准默认值 | `DEFAULT_BLOCK_SIZE = 16` | `DEFAULT_BLOCK_SIZE = 16` | `DEFAULT_BLOCK_SIZE = 16`，记录 `user_specified_block_size` | 上游基准提升为 `DEFAULT_BLOCK_SIZE = 64`[C21] | 昇腾未传参时均由平台与后端接管为 `128`，不受上游 `16→64` 变更影响 |
| 昇腾 `refresh_block_size` 与 `mxfp8` 规则 | 无 `C8_MXFP` `512` 分支；APC/分块预填充强制 `128`、`xlite` 钳制 `<= 128`[C19] | 同 `v0.23.0`（行号移至 `#L1240-L1291`）[C20] | 新增 `A5_C8_MXFP_KV_CACHE_BLOCK_SIZE = 512` 自动抬升与显式传参 `ValueError` 护栏，以及独立草稿模型早退保护 | 延续 `v0.30.0` 全部 `512` / `128` / `deepseek_v4` / `xlite` 护栏[C22] | `v0.30.0+` 开 `mxfp8` 切忌手写 `--block-size 128`，省略该参数即可自动对齐 `512` |
| `BlockPool` 借还与队列管理 | `null_block` 占 0 号块（已含 `metrics_collector` 回调），`get_new_blocks`、`touch`、`free_blocks` 按有无哈希分头尾入队 | 新增 `emit_cached_block_events`、`cache_partial_block`、`move_block_hashes`，并在 `free_blocks` 内部显式按 `block_hash is None` 拆分头尾入队 | 新增 `unpin_blocks` 延迟复用观察者与跨池转发释放 | 延续同一双端队列 LIFO/FIFO 语义与跨池释放 | 四版均保持“归还不清零 HBM、带哈希挂队尾保留复用” |
| 昇腾缓存张量形状与内核块长 | `get_supported_kernel_block_sizes` 返回 `[128]` | 同左 | 支持 `VLLM_KV_CACHE_LAYOUT` 切换 `LBHNC`/`HND` 轴序；MiniMax M3 FP8 返回 `[64, 128]`，常规 `[128]`[C15] | 签名接收可选 `kv_cache_spec`，标准路径仍为 `[128]` | 读取底层缓存视图时须认准当前布局轴序 |

### 源码位置

- **分页原理与官方设计文档**：Kwon 等人 SOSP'23 原始论文给出虚拟内存分页类比、末块内部碎片上界与前缀共享模型[S1]；上游 `paged_attention.md` 区分 KV 逻辑/物理块与硬件线程块[S2]；昇腾设计文档定义块表逻辑到物理地址翻译、槽位映射[S3]以及逻辑块与对齐物理页的分离视图[S4]。
- **块元数据结构与 `BlockPool` 核心账本**：`KVCacheBlock` 定义 `block_id`、`ref_cnt`、双向链表指针与 `is_null`[C5]；`BlockPool.__init__` 初始化 `free_block_queue` 并弹出 0 号 `null_block`[C6]；`get_new_blocks`、`touch`、`is_block_writable` 与 `free_blocks` 实现按需借块、引用计数共享及 LIFO/LRU 双端归还[C7]；`KVCacheManager.get_computed_blocks` 与 `allocate_slots` 驱动每步块分配[C8]。
- **单块字节数、块长重写与注意力算子接入**：`AttentionSpec.page_size_bytes` 定义单层页字节计算[C9]；`Platform.update_block_size_for_backend`[C11] 与 `NPUPlatform` 混合块长对齐及 `refresh_block_size` 检查入口串联后端首选块长[C12][C13]；`AscendAttentionBackend` 将 `block_table` 直传 FIA[C16]，并由 `using_paged_attention` 门控独立同名算子[C18]。
- **数值算例与边界口径**：正文 8 块教学池（A `218` 词、B `198` 词共享 `128` 词前缀）为便于手算对照的教学设定[A]，每卡 `10 GiB` 静态预算同样是不含激活工作区与图内存扣减的静态教学设定[A]；`Qwen3-8B`（`144 KiB/tok`、`18 MiB/块`、`10 GiB` 切 `568` 块）[D] 与 `Qwen3-30B-A3B`（整模 `96 KiB/tok`、`12 MiB/块`、`10 GiB` 切 `853` 块及 `TP = 4` 每卡 `3 MiB/块`）[D]，以及单序列末块浪费上界 $\le B - 1$[D] 均按 `config.json` 形状与源码页公式精确推出；块长 `128` 对 DMA 带宽与块表宽度的权衡由硬件分形与内核页规格归纳得出[I]。
