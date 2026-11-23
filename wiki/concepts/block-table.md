---
id: block-table
title: Block Table：请求里的第几个位置，落在缓存池的哪一格
type: concept
summary: >-
  block table（块表）是一张整数表：一行对应批次里的一条请求，第 i 格记着它的第 i 个块在缓存池里的块号；worker
  每步按它把位置换算成槽位，注意力算子也按它逐块读历史。标准单组模型（如 Qwen3-8B）全层共用一张表；异构混合模型（如 GLM-5.3-Flash）则按 5
  个缓存组分表，并把 full 组的 640 块号展开为 5 个 128 kernel 块号。
aliases:
  - Block Table
  - BlockTable
  - MultiGroupBlockTable
  - 块表
  - 块映射表
  - 逻辑块号
  - 物理块号
  - slot mapping
  - 槽位映射
chapters:
  - '11'
sources:
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L18-L101'
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L102-L201'
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L223-L282'
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L325-L380'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L14-L101'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L103-L185'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L284-L309'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L329-L462'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4943-L5026'
  - 'vllm@0fc695fc:vllm/v1/worker/utils.py#L262-L327'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L834-L837'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1246-L1254'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4484-L4528'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L115-L172'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L175-L283'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L27-L52'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L342-L371'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L553-L554'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L545-L600'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L335-L528'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L566-L757'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1366-L1401'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L26-L83'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L90-L119'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L173-L177'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L440'
  - 'https://arxiv.org/abs/2309.06180'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L49-L62
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L153-L196
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L104-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L246'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L1-L180'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L278-L283'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L10-L108'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L289-L290'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/triton/compute_slot_mapping.py#L12-L86'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L36-L110'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L298-L299'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L415-L490'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L303-L318'
  - >-
    raw:sha256-60066a112b62266d1a64ee662bb2e7c96078f0778d6fcd89bdc26d5fc7f58546.md#L1-L2586
  - 'vllm-ascend@7d825229:vllm_ascend/worker/block_table.py#L36-L60'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/block_table.py#L154-L300'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L36-L74'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1554'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L389-L426'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/block_table.py#L50-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/block_table.py#L32-L109'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1475-L1547'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/block_table.py#L29-L85'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: R1 第一步的 15 个块号怎样按组算出来、第 3 站怎样登记进表，都在主线第 2、3 站
  - to: kv-cache-spec
    kind: builds-on
    note: 5 个缓存组怎样编成、block_size 五种含义的唯一出处；块表只按组的块大小建表
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 一个块号每张卡占多少字节、KV 预算能切出多少块，在部署页推导
  - to: sparse-attention
    kind: builds-on
    note: 稀疏注意力选出的历史位置，就是按这张表到缓存池里取的
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-09d9fe34460514f6a6c15a0c2b458d5d0989c7e35abbd7d6f08ae3b7be89359a.md
  - >-
    raw/sha256-60066a112b62266d1a64ee662bb2e7c96078f0778d6fcd89bdc26d5fc7f58546.md
  - >-
    raw/sha256-a9a1d51dedc32b21b632436524adce0ff490e3ad1e64ccc33b64b2b4c98864d8.md
---

## 请求里的第 p 个位置，KV 该写进缓存池的哪一格？

**block table（块表）是一张整数表：一行对应这一批里的一条请求，第 i 格记着「这条请求的第 i 个块，落在缓存池的第几号块上」。** [KV cache](kv-cache.md) 是每一层为已经算过的位置留下的状态，新 token 读它就不必重算旧位置。

存这些状态的显存事先切成一个个等长的**块**，每块装固定个数的位置。整片显存叫**缓存池**，每块有一个编号叫**块号**。一条请求分到哪几块，由它推进到哪里、池里当时哪块空着决定，事先写不死；块表就是记这笔账的地方。

有了块表，「第 p 个位置写到哪」只剩两步：先算它是这条请求自己的第几块、块里第几格，再到表里查那一块在池里的编号。请求自己从 0 往后数的块序号叫**逻辑块号**，池里的编号叫**物理块号**（下文直接叫块号）；块表是这两种编号之间唯一的翻译。

```wiki-diagram
file: block-table
```

图里一块只装 4 个位置，只为了手算方便；标准模型 `Qwen3-8B`（块长 `128`）与异构旗舰模型的真实块长都在后文展开。读图分三步：

1. **拆位置。** 位置 6 除以块长 4，商 1、余 2：它在这条请求的逻辑块 1 里，块内偏移 2。
2. **查表。** 到这条请求那一行的第 1 格，读出块号 2。
3. **算槽位。** 池里的格子从块 0 起连续编号，块 b 的第 j 格编号是 b × 块长 + j。块 2 的第 2 格就是 2 × 4 + 2 = 10。这个统一编号叫**槽位**（slot），新 token 的 K、V 就按它写进缓存。

注意第 3 步用的是块内偏移，不是完整位置：写成「块号 × 块长 + 6」，一过第一块就会写到别人的格子上。

同一条请求的三个块在池里是 7、2、9，互不相邻，中间夹着别的请求的块。表里的顺序就是这条请求读历史的顺序，和块在显存里挨不挨着无关。在这个普通分页示例里，查表定位后的写入只更新槽位里的缓存内容；只要还在使用已分配的块，表里的块号本身不会改变——缓存内容更新与块表映射更新是两件事。

下面先追踪一次写入：**位置 6 属于 4–7 这一组，查表得到块 2，再找到其中第 3 行。** 蓝色的一行落进去后留在原位，块表仍是 `[7,2,9]`，变的是缓存内容。K、V 在图中各取两个示意通道，位置 p 的一行依次为 `[p,p+1,p+2,p+3]`；块 9 已预留但尚未写入。

画面接着演示共享与释放：把刚才这条生成任务称为**请求 A**，新来的另一条称为**请求 B**。B 共用已算好、内容与身份都匹配的完整前缀块 7，两条关系线连到同一块；蓝色行所在的块 2 仍由 A 单独使用。随后 A、B 依次结束，只有没有请求再用的块才能归还。全程使用同一个缓存池，不复制数据，也不切换场景。

```wiki-scene
inference-mechanism:1
```

## 为什么要一张表？代价在哪？

**因为请求开始时，没人知道它最终会写多长。** 不查表，就只能让每条请求的历史在显存里连成一段；这段要多长，只能按上限预留。以标准模型 **`Qwen3-8B`** 为例，它的默认上下文上限是 `40,960` 个位置，按昇腾默认块长 `128` 换算需要 `320` 个块；如果一条刚进来的短提示词只有几十个 token，第一步实际只需 `1` 个块。按上限预留会让绝大部分空间永远空置，并发一上来显存就被空洞吃光；退一步「不够再挪」也不行，换一段更大的连续空间就得把已有历史整段搬运。

块表的做法借自操作系统的虚拟内存：程序看到的是连续的逻辑地址，内存按定长的页管理，一张页表把逻辑页翻译成物理页，页和页不必相邻。KV cache 照搬这个思路，这套布局因此得名 PagedAttention（分页注意力，[vLLM 论文](https://arxiv.org/abs/2309.06180)）。「页」只出现在这个类比和专名里；vLLM 里存储单位叫**块**，「页」另指一个块号落到某一层上的那段显存（见 [KV cache 规格](kv-cache-spec.md)）。分块布局有三个性质，各换来一样东西：

- **定长**：块长启动时就定死。任何空块都能给任何请求，池里不会剩下「长度不合适、塞不进谁」的碎片。
- **按需**：写满一块才要下一块，回答多长占多少，用不着预知未来。
- **不连续**：新要的块拿到哪块算哪块，所以读写都要先查表。

代价有三处。

**第一，每次寻址都要翻译。** 写新 token 时要先查表算槽位；读历史时，注意力算子也要按表一块一块跳着读。所以分块必须由算子自己支持。如果先在算子外面把 K、V 拼回一段连续的再算，等于每步把整段历史复制一遍，分块就白分了。

**第二，末块会空着一截。** 只看单个按位置增长的标准注意力缓存组、且没有前缀共享与额外预留时，长度 $n$、块长 $B$ 的历史要 $\lceil n / B \rceil$ 块。最后一块空着 $\lceil n / B \rceil \times B - n$ 格，最多浪费 $B - 1$ 格。在 `Qwen3-8B`（`block_size = 128`）上，这个单组尾部上限是 `127` 格；块越长，末块空置上限越高。

> **边界与例外**：开启[投机解码](speculative-decoding.md)为候选 token 预留位置，或遇到带多缓存组补页与固定线性注意力状态的混合模型（如后文 GLM 的 5 组与 `640` 块长）时，额外预留块和固定状态页会远超单一末块，不能把「最多浪费不到一块」直接套用到整条请求。

**第三，表本身要维护。** 请求加入、结束、换位置时要改表；每一步开头要把表送到 NPU，再为每个 token 算一次槽位。这一页后面讲的，基本都是这笔维护账怎样做得便宜。

相邻的几个概念各管一件事：

| 概念 | 回答的问题 | 什么时候变 |
|---|---|---|
| 块号 | 池里哪一块，归谁用 | 调度器分块、请求结束还块时（[KV 块分配](vllm-kv-block-allocation.md)） |
| block table | 这条请求的第 i 块是哪个块号 | 请求要了新块、换了行、结束时 |
| 槽位映射（slot mapping） | 这一步每个新 token 写进池里哪一格 | 每一步都重算 |
| 缓存组 | 哪些层共用一张块表 | 启动时定一次（[KV cache 规格](kv-cache-spec.md)） |

## 表怎样随请求变化，槽位每步怎样算？

**一行对应的是这一批里的一个座位，不是某条请求的身份。** 每张卡上有一个 worker 进程，负责把调度结果翻译成张量、调用模型。它在两步之间保留一份「持久批次」，记录哪些请求在跑、各自坐第几行、进度到哪。请求编号和行号的对应记在持久批次里；块表只是一块按行号读写的整数内存，里面没有请求编号。行号一旦和请求对错，读写的就是别人的历史；每行另有一个游标，记着这一行已经写到第几格。

表只在这几种时候改：

- **新请求加入**：给它一个空行，游标归零，写入调度器发来的块号。
- **老请求要了新块**：从游标那一格往后追加，游标前移。每当请求推进跨过块长整数倍（例如在标准 `block_size = 128` 下跨过位置 `128` 或 `256`），逻辑块号加 `1`，这一行才追加一个新块号。
- **请求结束**：用过的格子填回 `0`，游标归零。
- **批次压紧、重排**：某一行空出来，就把最后一行整行搬进来；两条请求对调位置，两行整行对调。
- **被抢占后恢复**：块号整组换成新分的一批，当作新请求重新入座。

没用到的格子填 `0`，但 `0` 不会和普通分配的块号撞车：缓存池启动时就把块号 `0` 取出来当占位块（`null_block`），从不作为普通块分给请求。别处的填充值不一样：槽位映射用 `-1` 表示不写入；多组异构模型里折回的索引器块表则保留占位块号 `0`。追一个具体的数时，先弄清它属于块表还是槽位映射，不能把某一处的填充值当全局的「空」标记。

**落到标准模型 `Qwen3-8B`：全层共用 `1` 张块表，跨过 `128` / `256` 才追加新块。** `Qwen3-8B` 的 `36` 层全都是同构的标准 GQA（分组查询注意力），昇腾 `v0.30.0` 默认 `block_size = 128`。因此整座模型只有 `1` 个缓存组、**只有 `1` 张块表**，所有 `36` 层读写的逻辑块号与物理块号一一对应，不需要 kernel 块展开。一条普通请求从位置 `0` 推进到 `300` 的块表变化如下：

| 推进阶段（`Qwen3-8B`，单组 `block_size = 128`） | 逻辑块号与块内偏移 | 块表该行动作与槽位算式 |
| --- | --- | --- |
| 位置 `0–127` | 逻辑块 `0`，偏移 `0–127` | 写入首块 `b₀`；槽位 `b₀ × 128 + 偏移` |
| 跨过 `pos = 128`（`128 ÷ 128 = 1` 余 `0`） | 逻辑块 `1`，偏移 `0` | 游标前移，向第 `1` 格追加新块号 `b₁` |
| 跨过 `pos = 256`（`256 ÷ 128 = 2` 余 `0`） | 逻辑块 `2`，偏移 `0` | 游标前移，向第 `2` 格追加新块号 `b₂` |
| 写入 **`pos = 300`**（`300 ÷ 128 = 2` 余 `44`） | 逻辑块 `2`，偏移 `44` | 查第 `2` 格得物理块号 `b`（即 `b₂`），槽位 = **`b × 128 + 44`** |

这张单表本身极轻。按默认最大长度 `40,960` 与块长 `128` 计算，一行只需 `40,960 ÷ 128 = 320` 格 `int32`（每格 `4 B`），单行仅 **`1,280 B`（`1.25 KiB`）**。即便按 `max_num_seqs = 256` 留满 `256` 行，整张表也只有 **`320 KiB`**（CPU 与 NPU 各一份），相比单块 `18 MiB` 的全层 KV 缓存完全可以忽略。

**表很少动，槽位每步都算。** 一条请求生命周期里，它那一行只在「要了新块」和「结束」时变；而每一步、每个新 token 都要做一次「除、查、乘加」算槽位。两者节奏相差悬殊，因此分别落在 CPU 与 NPU 两端，并按「读历史用块表、写新词用槽位」拆开交接：

```wiki-diagram
file: block-table-fig-cpu-npu-sync
```

- **表留在 CPU 上按行改**：步首准备输入时先异步拷前 `num_reqs` 行到 NPU，拷贝一发出就继续其余 CPU 准备，两边并行重叠。
- **槽位在 NPU 上并行算**：核函数按 `num_reqs + 1` 路展开，各请求并行算槽位，多出的一路把用不到的尾部统一填 `-1`（`PAD_SLOT_ID`），固定[图模式](acl-graph.md)重放尺寸。
- **读、写各自领走**：拷到 NPU 的那几行 `block_table` 交给注意力算子**读**历史；按 token 展开的 `slot_mapping` 交给写入算子把新状态**写**进池中。CPU 与 NPU 因此各存一份块表。

> **边界与例外**：开启[上下文并行](context-parallel.md)（把一条长请求的历史切给多张卡）时，槽位计算会把位置按卡交错分开，不归本卡的位置写入 `-1`；未开启上下文并行的部署不走这一支。

## 异构旗舰对照：GLM-5.3-Flash 的五张块表与块长展开

标准单组 GQA 模型只需一张块表、内外块长一致；换成把稀疏压缩注意力与线性递推状态混在一个池里的旗舰模型后，块表会拆成多组、块长也会分出内外两层。下面转入例外 B 历史绑定算例——**GLM-5.3-Flash 官方双机**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，2 台 Atlas 800 A2，每台 8 张卡，TP8、DP2、EP16，W8A8，详见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。

它的最大长度是 `133,120`（按 `640` 块长折合 `208` 块，而 4-token 的 [R1](one-request.md#示例请求-r1-与官方双机部署) 第一步只借 `1` 个 full 块、仅用其中 `4` 格）。由于同时混用稀疏 MLA、索引器尾状态与 KDA 线性注意力，它拆出 **5 个缓存组、5 张块表**，并引入 `640 → 5 × 128` 的 kernel 块号展开。

### 放到 GLM 双机：R1 的 15 个块号进了哪几张表？

R1 落在 DP0（第一台机器），机内 8 个 worker 拿到同一份调度结果，各自建一模一样的 5 张表；同一个块号在 8 张卡上各指向自己那份显存。

**混合模型的每个缓存组各有一张块表。** GLM 要存四类状态：MLA 按位置存的潜向量历史、indexer 每 4 个位置压出的池 K（下文称 indexer K）、未凑满 4 个位置的尾状态，以及 KDA 每条请求一份的固定状态（细账见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)）。这四类状态编成 5 个缓存组（规则见 [KV cache 规格](kv-cache-spec.md)），同组各层共用一串块号，因此 worker 维护 5 张块表。R1 在 5 张表里坐同一行，调度器按组发来 5 串块号，worker 分别写进对应表。

块号本身来自同一个池：每个组有自己的分配器，但都从同一块池取号，同一时刻一个块号只属于一个组，因此 15 个块号互不重复。等 R1 占用位置（含给下一步 `3` 个 MTP 候选预留的位置）超过 `640` 时，位置 `640` 的商变成 `1`，full 组该行才追加第二个 `640` 块。

| 缓存组 | 一块覆盖几个位置 | R1 第一步这一行写进什么 | 意味着什么 |
|---|---|---|---|
| full 组（12 层 MLA、12 份 indexer K） | 640 | 1 个块号，展开成 5 个 kernel 块号 | 表里一格管 128 个位置；R1 要超过 640 个位置才追加 |
| indexer 尾状态组（12 层） | 4 | 2 个块号 | 块最短，同样的最大长度下一行要留得最宽 |
| 3 个 KDA 组（34 层，按 12/11/11 分） | 133,120，一条请求一页 | 每组 4 个块号：1 份状态，3 个候选位置各 1 份 | 这 12 个块号不算槽位，直接当状态页的编号用 |
| 合计 | | 15 个块号 | 每组块数的算法在第 2 站，本页不重算 |

12 层 MLA 由主干 11 层稀疏 MLA 加第 45 层 MTP（每步草拟 3 个候选的草稿层）组成。`15 = 1 + 2 + 12` 的算法与每卡 `119.5 MiB` 细账见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)；单块字节与整卡块数见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；`block_size` 五种含义对照见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。

```wiki-diagram
file: block-table-flow
```

图从上往下对应主线三站。[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)的调度器按组要块号；[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)的 worker 把 R1 登记进持久批次、5 张表各写一行，再拷表到 NPU 并算槽位；第 4 站逐层前向时，各层只看所属组的那张表。

四类层用表的方式各不相同：

- **MLA 主缓存**按槽位写入这一步的新位置；稀疏注意力读历史时，把选中的位置和 full 组的表一起交给算子，由算子按块号去池里取。
- **indexer K** 和 MLA 同在 full 组，但它每 4 个位置才压出一条，存储按 640 的块排，不按 128 的 kernel 块排。所以它拿到表后先折回 640 的块号，槽位也要换算，细节在下一节。
- **indexer 尾状态**块长 4，本组的表按 4 个位置一块算出槽位，直接用。
- **KDA** 那 3 个组根本不算槽位：状态不随位置增长，块号就是状态页的编号。不带候选的一步（比如 R1 第一步算 prompt）只读这一行的第 0 格；一步里同时验证 1 + 3 个位置时读前 4 格，每个位置的状态各写一页，下一步按实际接受了几个候选，从对应那一页接着算。

### 分配块与内核页可能不同

**调度器按 640 个位置一块分配，稀疏注意力的算子却按 128 个位置一块读；worker 在 full 组的表里把每个块号拆成 5 个，表按 128 一格记，算出的槽位和按 640 直接算的一模一样。** 640 是为了让一个 MLA 页装得下一整份 KDA 状态倒推出来的，推导在[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)；128 是稀疏注意力算子一次读取的块长，叫 **kernel 块**。

算子读取的单位由 worker 按组去问：同组各层的注意力后端各自报出支持哪些块长，worker 挑一个大家都支持、又能整除分配块长的值。MLA 的后端只认 128；indexer K 和尾状态的后端写的是「任意整数倍都行」。于是 full 组取 128，一个块号拆成 640 ÷ 128 = 5 个；尾状态组的块长 4 本身就被接受，不拆；KDA 组不是注意力，不拆，也不算槽位。

候选顺序也会影响选择。本页固定执行侧快照按列表顺序选择第一个大于零、且能整除分配块长的候选值。因此，有多个可用候选值时，选中的不一定是最小值；没有提供 kernel 大小列表，或列表恰好只含一个零时，则直接保留分配器块号，不做拆分。

拆开不需要搬数据。worker 切显存时，就把 MLA 每一页看成 5 段首尾相接的 128 个位置，整层的缓存张量按「块号数 × 5」段来排。kernel 块号 5b + j 正好是块号 b 那一页的第 j 段，所以只要在表里把 b 写成 5b 到 5b + 4 五个数，算子按 128 一块去找，落到的还是原来那页。设 b 是位置 p 所在那个 640 块的块号：

$$\text{slot}(p) = \left(5b + \left\lfloor\frac{p \bmod 640}{128}\right\rfloor\right) \times 128 + (p \bmod 128) = 640b + (p \bmod 640)$$

| `full` 组块号展开项（设 $b$ 为位置 $p$ 所在 640 块的物理块号） | 算式与映射规则 | 说明 |
| --- | --- | --- |
| 每个 640 块对应的 kernel 块数 | $640 \div 128 = \mathbf{5}$ | 必须整除，否则启动报错 |
| 块号 $b$ 在 `full` 组表里的展开项 | $5b,\; 5b+1,\; 5b+2,\; 5b+3,\; 5b+4$ | 连续 5 格，不搬动显存数据 |
| 位置 $p$ 的 kernel 块号 | $5b + \lfloor (p \bmod 640) \div 128 \rfloor$ | 落在该页 5 段 128 中的对应一段 |
| 位置 $p$ 的最终槽位 | $640b + (p \bmod 640)$ | 与按 640 一块直接算的结果完全相同 |

所以读源码、看日志时见到块长 128 和 640 同时出现，说的是这两层：分配按 640 一块，full 组的表和算子按 128 一格。两者必须整除，640 不是 128 的倍数时启动就会报错。

**indexer K 要把拆开的表再折回去。** 它和 MLA 同在 full 组，共用那张按 128 拆开的表，但它的存储按 640 的块排：每 4 个位置压成一条，一个块号对应 160 条。所以它每隔 5 格取一个 kernel 块号、除以 5，还原出 b；槽位也从 full 组的槽位换算：先拆出 b 和块内偏移，再把偏移除以 4。只有凑满 4 个位置的那个 token 才写压缩条目，其余位置的槽位记成 −1，只更新尾状态。

R1 第一步算位置 0 到 3。设 full 组那个块号是 b、尾状态组的两个块号是 s₀ 和 s₁（具体是几，看池里当时哪几块空着），一个 token 要写三处：

- **MLA 主缓存**：槽位 640b + 0 到 640b + 3，都在 kernel 块 5b 里。
- **indexer K**：只有位置 3 凑满了 4 个，写进压缩条目 160b + 0；位置 0 到 2 是 −1。
- **indexer 尾状态**：位置 0 到 3 都在本组第 0 块，槽位 4s₀ + 0 到 4s₀ + 3；s₁ 是给下一步的候选位置预留的。

KDA 那 12 个块号不参与这一步的槽位计算。

除了上面「640 分配块拆成 5 个 128 内核块」的两层映射，昇腾 `v0.30.0` 在启动服务时还会按固定顺序执行四路 `block_size` 对齐检查。具体次序是：A5 `C8_MXFP` 量化要求 `512` 倍数，`deepseek_v4` 限定 `32/64/128`，混合架构交由模型与平台钩子对齐，普通模型开启前缀缓存、分块预填充或 `xlite` 时自动钳回 `128`。下图把四路对齐漏斗、`640 → 5 × 128` 的零搬运展开，以及块表占位 `0` 与槽位填充 `-1` 的区别收在一处对照：

```wiki-diagram
file: block-table-fig-size-alignment
```

### 表本身占多少，每步花多少？

**表里一格是 4 字节的整数，它指着的东西以 MiB 计。** full 组的一个块号，在每张卡上占住 7.969 MiB 的缓存（推导在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)），在表里只是 5 个整数。所以别在块表上省显存，能省的量在噪声里。

表有多宽，由不得请求自己：启动时按最大长度 133,120 给每个组留够一行的格数，和请求实际多长无关。块越短，一行越宽，所以块长只有 4 的尾状态组，一行反而最宽。行数按同时在跑的请求上限留，本部署最多 32 条请求并发，就是 32 行。

表行容量还必须容纳分配器实际交付、并经块号转换后得到的全部表项。固定执行侧源码的 GLM-5 indexer kpool 注释指出，缓存规格带有压缩比字段，并不代表分配器会按压缩后的 token 数分配块；若仅凭这个字段缩短表行，长序列追加块号时可能超出容量。这项限制要求按实际分配规则核对表行，不能据此缩减本部署上面的容量设定。

| 缓存组（最大长度 133,120，每格 `int32` 占 4 B） | 单行格数算式 | 单行字节数 |
| --- | --- | --- |
| `full` 组 | $\lceil 133{,}120 \div 640 \rceil \times 5 = 208 \times 5 = \mathbf{1{,}040\text{ 格}}$ | $1{,}040 \times 4\text{ B} =$ **4,160 B** |
| 尾状态组 | $133{,}120 \div 4 = \mathbf{33{,}280\text{ 格}}$ | $33{,}280 \times 4\text{ B} = 133{,}120\text{ B} =$ **130 KiB** |
| 每个 KDA 组（共 3 组） | $1 + 3 = \mathbf{4\text{ 格}}$ | $4 \times 4\text{ B} =$ **16 B** |
| **5 张表 × 32 行合计** | $32 \times (4{,}160 + 133{,}120 + 3 \times 16)\text{ B}$ | $\approx \mathbf{4.19\text{ MiB}}$（NPU 与 CPU 各存一份） |

合起来约 4.19 MiB，大约半个块号；和整张卡能切出的约 3,855 个块号（[部署页](glm-5-3-flash-two-node.md#两种块数各在什么时候用)的算例）比，同样可以忽略。

每步真正花的是两件事。一是拷表：这一批有几条请求，就把 5 张表的前几行整行拷到 NPU。R1 独自在跑时每步拷 1 行，5 张表合计约 134 KiB，其中尾状态组那一行占了约 97%。二是算槽位：每个新 token 一次「除、查、乘加」，在 NPU 上并行做完。执行器提前发起拷贝，让它有机会与 CPU 上的其余准备重叠；实际隐藏了多少时间、槽位计算是否落在关键路径上，仍需 profiling，不能只从字节数判定开销可忽略。

## 分页布局和同名算子是两回事

**「用了分页缓存」说的是历史怎样存、怎样寻址；「调用了哪个注意力算子」说的是怎样计算。** 不能因为没看到一个叫 PagedAttention 的算子，就说系统没用分页缓存。

在标准单组模型（如 `Qwen3-8B`）上，所有 `36` 层 GQA 均通过 `block_table` 按分页布局读写 KV 池，但平时走的是昇腾通用融合注意力后端，而不是那个同名算子。同样，GLM 所有带缓存的层（`11` 层稀疏 MLA、MTP 层、`34` 层 KDA）也全部按块表寻址，同样没有一层调用同名算子：

- **稀疏 MLA 层**先由 indexer 选出要读的历史位置，再把这些位置和 full 组的 kernel 块表一起交给稀疏注意力算子；传给算子的缓存布局参数就是分页布局，块号换算在算子内部完成。这一层同时叠加分页存储、MLA 潜向量压缩（512 维）与稀疏读取三个独立维度，分别见 [MLA](mla.md) 和[稀疏注意力](sparse-attention.md)。
- **KDA 层**走线性注意力的后端，块号直接当状态页编号，见[线性注意力](linear-attention.md)。

昇腾普通注意力后端里确实有一个名字就叫 PagedAttention 的算子，但它只是给个别纯 decode 批次留的调优口子。判断函数第一句就是「开了投机解码就不走」，其余几道门槛列在页末对照源码里；默认情况下 `pa_shape_list` 为空，不会命中。

**块怎样分配、共享、回收，归 [KV 块分配](vllm-kv-block-allocation.md)。** 块表只记结果：调度器分给谁，表里就写谁；请求结束、块号还池后，对应列清回 `0`。共享同一段前缀的请求会在各自的行里写入同一个块号，该块在还有引用时禁止覆写（标准 `Qwen3-8B` 默认开启[前缀缓存](prefix-caching.md)；GLM 这类混合模型在本版本默认关闭，R1 走不到这条路）。池里块不够时，调度器让请求排队等待（见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)）。

## 常见误解

- **「块表里存的是显存地址。」** 存的是块号，一个整数。槽位也只是「池里第几格」，不是字节偏移；一格对应多少字节、落在哪一层，要按缓存布局（层、头数、维度、精度）再算，见 [KV cache](kv-cache.md)。
- **「每一步都要重建这张表。」** 一行只在要了新块、换了行、请求结束时变。每步重算的是槽位，而且在 NPU 上算。
- **「表里的 0 是请求实际分到的普通块。」** `0` 指向池里保留的占位块，不是请求分到的有效缓存块；indexer 折回块表时也保留这个 `0`。槽位映射用 `-1` 表示不写入，两种标记不能混用。
- **「一个模型永远只有一张块表。」** 准确说是一个缓存组一张。标准单组模型（如 `Qwen3-8B`）全层共用 `1` 张；GLM 这类混合模型有 `5` 张，其中 `3` 张 KDA 的表不算槽位，块号直接当状态页编号。
- **「块长到底是 128 还是 640？」** 标准 `Qwen3-8B` 上分配块长与算子块长都是 `128`；GLM 双机上分配按 `640` 一块、full 组的表和算子按 `128` 一格，两种算法得出的槽位相同。尾状态组的 `4`、KDA 组的 `133,120` 也叫块长，五种含义对照见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。
- **「源码里的 logical block 就是本页的逻辑块号。」** 昇腾块表代码里的 `physical_block_size` 指分配块（`640`），`logical_block_size` 指 kernel 块（`128`），说的是块长的两层；本页的逻辑块号则是请求从 `0` 数的块序号（对应论文里的 logical block），读代码时需按上下文区分。
- **「没看到 PagedAttention 算子，就是没用分页缓存。」** 分页是存储布局，算子名是计算实现。标准 GQA 与 GLM 所有带缓存的层都按块表寻址，默认却都不会走那个同名算子。
- **「分块以后，一条请求最多浪费不到一块。」** 这只对单个按位置增长、且无投机预留的缓存组成立。一旦开启投机解码或遇到 GLM 这样的 5 组混合模型，额外预留块和固定 KDA 状态页会远超单一末块（R1 第一步的 `15` 个块号里，`12` 个是 KDA 状态，full 组那一块也只用了 `4` 格）。

## 对照源码

**固定块表的选择规则。** `kernel_sizes` 为 `None` 或恰好为 `[0]` 时不拆分，逻辑块长与物理块长相同，转换直接返回物理块数组；其他列表按顺序取第一个大于零且能整除物理块长的值，所以候选顺序可能影响结果，并非总选最小值（来源 5、7）。表行容量只对压缩感知的 `AscendMLAAttentionSpec` 使用压缩比；GLM indexer kpool 使用上游 `MLAAttentionSpec`，仍按未压缩 token 数分配，不能仅凭同名字段缩减表行。缓存内容与块映射是不同的写入对象，改变前者不自动改后者。

### 怎么开

块表没有开关，每一步都要用。昇腾官方设计文档把它定义为把每个块在序列内的逻辑地址翻译成设备显存全局物理地址的表，形状是 (max num request, max model len / block size) [S30]；PagedAttention 论文 §4 给出逻辑块、物理块与块表的原始设计 [S29]。决定它形状和行为的是下面几样。

- **按组建表。** 调度侧 `KVCacheBlocks.get_block_ids()` 返回「每个缓存组一个列表」的元组；协调器给每个组一个 manager，共用一个 `BlockPool`，块号 0 在池初始化时被取出当 `null_block`，从不分配（来源 26–27）；官方设计文档同样用 `block_0` 标记未用的块。worker 侧 `MultiGroupBlockTable` 按组建 `BlockTable`，行操作对各组同一个 `row_idx` 依次执行。[C26]
- **缓冲与行操作。** 每个 `BlockTable` 的表是 int32 的 CPU/NPU 双份缓冲，行数 `max_num_reqs`，另有 numpy 游标 `num_blocks_per_row`；`add_row` = 游标归零再 `append_row`，`clear_row` 把用过的列填回 0，`move_row` / `swap_row` 整行复制或对调（来源 6）。调用方在上游持久批次：`add_request` → `add_row`、`remove_request` → `clear_row`、`swap_states` → `swap_row`、`condense` → `move_row`；老请求的新块在 `_update_states` 里 `append_row`，抢占恢复时整组替换 `block_ids` 再重新入座（来源 22、24）。[C6]
- **kernel 块长。** model runner 对每个 `AttentionSpec` 组调 `select_common_block_size(块长, 该组后端)`，非注意力组填 `[0]`，注释写明用来关掉 Mamba 组的槽位计算（来源 9）。该函数先看分配块长本身是否被所有后端接受，否则从各后端 int 形式的块长里由大到小挑第一个能整除、又被所有后端接受的。GLM 的 MLA 后端只返回 `[GLM5_SFA_KERNEL_BLOCK_SIZE]` 即 128（来源 18），indexer K 与尾状态后端返回 `MultipleOf(1)`。[C9]
- **拆块。** 昇腾 `BlockTable.__init__` 取第一个能整除 `physical_block_size` 的 kernel 块长：`block_size = 128`、`blocks_per_phys_block = 640 // 128 = 5`、`use_hybrid_blocks = True`，列数 = 每请求最大块数 × 5；`append_row` 经 `_convert_physical_to_logical_blocks` 把 b 展开成 `b*5 … b*5+4`（来源 5、7）；上游 vLLM 的同一逻辑叫 `map_to_kernel_blocks`。worker 切显存时把 GLM 主 MLA 缓存按 `num_blocks * blocks_per_scheduler_block` 段、每段 128 个位置取形状（来源 13）。[C5]


- **列数。** `max_num_blocks_per_req = cdiv(max_model_len, block_size × CP 总数)`，Mamba 组在此基础上加 `num_speculative_blocks`；昇腾块表只对 `AscendMLAAttentionSpec` 按 `compress_ratio` 缩列，GLM 的 indexer K 用上游 `MLAAttentionSpec`，不缩。本部署三类行宽 1,040 / 33,280 / 4 格 [D]。
- **槽位公式。** 上游 Triton kernel 的核心三行，与官方文档「块号 × 块长 + 块内偏移」的四步对应 [C4][S31]：

  ```
  block_indices = pos // virtual_block_size          # 第几个块（不开 CP 时 virtual = block_size）
  block_numbers = load(block_table + row_offset + block_indices)
  slot_ids      = block_numbers * block_size + local_block_offsets
  ```

- **GLM 的三套槽位。** full 组的槽位按 128 一格算出；indexer builder 取 `expanded_block_table[:, ::split] // split` 还原 640 的块号，再用 `format_indexer_kpool_slot_mapping` 换算压缩槽位：`(positions + 1) % compress_ratio == 0` 的位置得 `b × 160 + 偏移 // 4`，其余为 −1 [C16]。尾状态 builder 直接用本组的 `block_table_tensor` 与 `slot_mapping`。KDA 走 `AscendGDNAttentionBackend`，不带候选时用 `block_table_tensor[:, 0]` 作状态索引，验证候选时取前 `num_spec + 1` 列 [C21]。
- **同名算子的门槛。** `using_paged_attention` 依次判断：配置了投机解码 → 假；A5 → 假；head_size 为 Gemma4 的大头维 → 真；图模式不是 `FULL_DECODE_ONLY` → 假；最后看本步 token 数在不在 `pa_shape_list` 里 [C32]。这个列表填的是 token 数，不是块长，默认是空列表，所以不专门配置就一次都不会走。

### 会报什么错

- `None of the kernel sizes [...] can divide physical block size ... evenly`：没有能整除分配块长的 kernel 块长。640 能被 128 整除，本部署不触发。


- `Block table row capacity exceeded: row=..., capacity=...`：镜像 db701c1f 在 `append_row` 里新增的检查。同文件注释说明，若像 v0.23 那样对带 `compress_ratio` 字段的规格一律缩列，GLM indexer 的长序列会写穿一行、让引擎退出，所以缩列只认 `AscendMLAAttentionSpec`。
- `GLM-5 logical block size must be divisible by the SFA kernel block size`、`GLM-5 indexer received a partially expanded SFA block table`、`GLM-5 indexer block table exceeds its persistent buffer`：indexer builder 的三道检查 [C14]。
- `No common block size for ...`：同组后端找不到共同的 kernel 块长。
- `kernel_sizes length (...) must match block_sizes length (...)`：两张列表长度对不上。
- main 上 `Circular tail caches do not support context parallelism.`：环形组开了 DCP。

### 开销和什么时候别开

- **关不掉，也不必省。** 5 张表一行合计 137,328 B，32 行约 4.19 MiB，NPU、CPU 各一份；一个块号每卡 7.969 MiB 的推导在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存) [D]。
- **提交。** `_prepare_inputs` 最前面调 `commit_block_table(num_reqs)`，注释写明先发起拷贝，与后续 CPU 工作重叠 [C11]。db701c1f 的实现是 `cpu[:num_reqs].clone().pin_memory()` 后 `non_blocking` 拷到 NPU，拷的是整行，所以 R1 独自在跑时每步约 134 KiB，尾状态组那行占约 97%。
- **槽位。** 不开 PCP 时在准备输入中段调 `compute_slot_mapping`；`MultiGroupBlockTable` 跳过 `is_mamba_group` 的组。kernel 的 grid 是 `num_reqs + 1`，最后一个 program 把 `num_tokens` 之后到 `max_num_tokens` 的尾部填成 `PAD_SLOT_ID`。昇腾的槽位缓冲是 int32，上游是 int64。
- **稀疏注意力读表。** 生产路径 `_execute_sparse_flash_attention_process` 把 `attn_metadata.block_table` 与 top-k 索引交给 `npu_sparse_flash_attention`，`layout_kv="PA_BSND"` （调用位置见来源 19，设备接口见来源 20）[C20]。旧版出处指向的 `_sparse_attention_pytorch` 只被单元测试调用，推理时不执行。
- **待核。** 拷表与算槽位每步的耗时及与 CPU 准备的重叠量缺 profiling 数据。尾状态组在长序列下窗口外的块怎样回收（decode 时手里 3–4 块，窗口外的整块换成 null block 还池），见 [KV 块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)；表中已回收位置的具体填充值还需核对执行器更新分支。

### 版本差异

**`v0.30.0` 的平台 `refresh_block_size` 与后端校准形成四路 `block_size` 对齐逻辑，同时在块表层延续逻辑块/物理块分离与环形尾状态特例。** 按 `vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1554` 与 `platform.py#L389-L426`（来源 47–48）核实，四路对齐顺序如下（先排除共享目标配置的独立 draft 模型，未指定 `--block-size` 时默认 `128`）：[C47]

1. **A5 `C8_MXFP` KV 量化路径**：要求 `block_size` 为 `A5_C8_MXFP_KV_CACHE_BLOCK_SIZE`（512）的整数倍；用户显式指定非倍数直接抛 `ValueError`，未显式指定则自动改为 `512` 并返回。
2. **`deepseek_v4` 模型路径**：仅接受 `[32, 64, 128]`，超出范围则打告警并强制设为 `32` 后返回。
3. **混合架构路径（`model_config.is_hybrid`）**：`refresh_block_size` 直接返回，把块长对齐交给模型专属与平台钩子——`NPUPlatform._align_hybrid_block_size` 对 MLA + `int8`/`fp8` + kpool indexer 调用 `HybridAttentionMambaModelConfig.verify_and_update_config` 复用打包几何；`update_block_size_for_backend` 在关 prefix caching、启用 KV 传输且 `mamba_cache_mode == "align"` 时，要求 `mamba_block_size % block_size == 0`。
4. **通用与 `xlite` 路径**：非混合模型启用 `enable_prefix_caching` 或 `enable_chunked_prefill` 且 `block_size != 128` 时统一改回 `128`；开启 `xlite_graph_config` 且 `block_size > 128` 时同样钳回 `128`。

普通 DCP 槽位以 `physical_block_size × DCP` 定位虚拟物理块再映射到本卡，不再把 PCP 额外乘入；Mamba 状态在 DCP rank 间复制，表容量直接取规格给出的每卡容量；环形尾缓存要求 `DCP=1`，每请求一格物理环，不拆成普通逻辑页，通用 `compute_slot_mapping` 对该组填 `PAD_SLOT_ID`。因此本页旧镜像的尾状态表长度和 `PCP × DCP` 扩列公式不能直接套用于 `v0.30.0` / `main`。

四版社区分支钉点：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）、`main`（`8d6180e2` / `ba15685a`）；**本文 GLM 绑定算例按例外 B 镜像 `vllm-ascend@db701c1f` 解释**，`v0.23.0` 与 `v0.26.0rc` 未含 GLM-5.3-Flash 模型文件。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 块表模块形态 | 仅 V1 `worker/block_table.py` | 仅 V1 `worker/block_table.py` | V1 `worker/block_table.py` 与 V2 `worker/v2/block_table.py` 并存 | **移除 V1 `worker/block_table.py`**，统一收敛到 `worker/v2/block_table.py` 的 `AscendBlockTables`（适配上游 `#57169` 本地保留 kernel 块展开） |
| GLM 尾状态与环形组 | 无 GLM 模型路径 | 无 GLM 模型路径 | `glm5next` 尾状态改用环形规格；`is_circular` 组要求 `DCP=1`、一行 1 格且 `kernel_sizes=[block_size]`（来源 49） | 同 `v0.30.0` 语义，经 V2 `AscendBlockTables` + `slot_mapping_enabled` 与 `dcp_sharded` 管理（来源 52） |
| 槽位计算 kernel | 导入上游 Triton kernel，一批 1024 token（来源 34） | 昇腾自有 tiled kernel，只把行内相邻列载入片上再 gather（来源 38） | V1 延续 tiled kernel 并支持多非 Mamba 组融合计算；V2 调 `_compute_slot_mappings_kernel`（来源 50） | V2 统一使用 `ops/triton/block_table/compute_slot_mappings.py` |
| 平台 `block_size` 对齐 | 仅基础 `128` 约束 | 沿用通用检查 | 四路 `refresh_block_size`（C8_MXFP 512 / `deepseek_v4` / hybrid 放行 / 通用与 xlite 128）+ `platform.py` hybrid 钩子 | 同 `v0.30.0` 四路逻辑（`utils.py#L1475-L1547`，清理了 `deepseek_v4` 的死分支 `None` 判断） |
| 提交与行扩列方式 | `clone().pin_memory()` 非阻塞拷；按 `pcp × dcp` 扩列、带 `compress_ratio` 缩列 | 改为上游 `copy_to_gpu`；扩列只看 `dcp` | 沿用 `copy_to_gpu`；删除手动 `compress_ratio` 缩列与 Mamba 扩列，由 spec 给出每卡容量 | V2 全量基于设备张量缓冲与 `AscendBlockTables` 维护 |

镜像 `db701c1f` 在块表上与 `v0.23.0` 基本一致：导入上游 kernel、用 `clone()` 提交。不同有三处：缩列只认 `AscendMLAAttentionSpec`；`append_row` 多了行容量检查；槽位缓冲只多留 `2 × pcp × 最大请求数`，没有 MTP 草稿余量。上游 vLLM `0fc695fc` 自带同构的 `BlockTable` 与 `MultiGroupBlockTable`，昇腾用自己的版本替换。[C52]

### 源码位置

| 要找的 | 位置 |
|---|---|
| 昇腾块表类（镜像与 `v0.30.0` / `main`） | `vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py`（L14–L101、L103–L185、L284–L309、L329–L462）；`c09d3e20:worker/block_table.py#L50-L85` 与 `worker/v2/block_table.py#L32-L109`；`8d6180e2:worker/v2/block_table.py#L29-L85` |
| 四路 `block_size` 对齐逻辑 | `vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1554`、`platform.py#L389-L426`；`vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1475-L1547` |
| 上游块表类与槽位 kernel | `vllm@0fc695fc:vllm/v1/worker/block_table.py`：构造 L18–L101，行操作 L102–L201，多组 L223–L282，kernel L325–L380 |
| 每组 kernel 块长与列数 | `vllm_ascend/worker/model_runner_v1.py` L4943–L5026；`vllm/v1/worker/utils.py` L262–L327 |
| 提交与算槽位的调用点 | `model_runner_v1.py` L834–L837、L1246–L1254 |
| MLA 页按 kernel 块切形状 | `model_runner_v1.py` L4484–L4528 |
| indexer 折表、压缩槽位、尾状态 | `vllm_ascend/attention/indexer_kpool_mla_v1.py` L115–L283、L342–L371、L553–L554；`vllm_ascend/core/kv_cache_interface.py` L27–L52 |
| 稀疏注意力按表读取（生产路径） | `indexer_kpool_mla_v1.py` L1065–L1104 → `vllm_ascend/device/device_op.py` L719–L793 |
| KDA 用块号当状态索引 | `vllm_ascend/ops/gdn_attn_builder.py` L545–L600 |
| 持久批次的行操作调用方 | `vllm/v1/worker/gpu_input_batch.py` L335–L528、L566–L757；`vllm/v1/worker/gpu_model_runner.py` L1366–L1401 |
| 调度侧按组的块号与占位块 | `vllm/v1/core/kv_cache_manager.py` L26–L83；`kv_cache_coordinator.py` L90–L119；`block_pool.py` L173–L177、L333–L440 |
| 普通注意力的 PagedAttention 门槛 | `vllm_ascend/attention/utils.py` L104–L120；默认值 `vllm_ascend/ascend_config.py` L246 |
| 官方设计文档 | `docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md` L49–L62、L153–L196 |
| 历史版本对照 | `2c59ff10` 块表 L1–L180、L278–L283；`2ed6cbba` 块表 L10–L108、L289–L290 与 `ops/triton/compute_slot_mapping.py` L12–L86 |

**正文推导口径。** 首屏与示意图用一块 4 个位置、块表 [7, 2, 9] 的假设，只为手算 [A]。R1 的 15 个块号、640、133,120、32 取自主线底稿 01 §A0.4–A0.5、§A2.1–A2.2，每 token 字节取自底稿 02 §5.6；行宽、4.19 MiB、每步 134 KiB 与三套槽位的换算是按上面源码公式代入这些数得出的 [D]。

indexer 折表的空标记由来源 15 的第 236–243 行确定：来源 46 对本部署的 storage_block_size=160 返回一个完整 indexer 块，因而直接复制折回的块号，0 仍为 0；来源 16 才把无效写入槽位变成 −1。不能用槽位的 PAD 规则解释块表。
