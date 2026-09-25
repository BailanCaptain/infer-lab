---
id: block-table
title: 块表：请求的第几块，在显存的哪一块
type: concept
summary: 一条请求的 KV 散在显存各处，要有一张表记着「它的第 0 块在显存第几块、第 1 块在第几块……」。这张表就是块表：一行一条请求，一格一个块号。每步写 K、V 之前，先按它把「第几个 token」换算成显存里的格子号。
aliases: [Block Table, 块表, 块映射表, BlockTable, 逻辑块号, 物理块号, kernel 块]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L36-L109
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L111-L149
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L151-L194
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L298-L303
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L305-L320
  - vllm-ascend@baa023ad:vllm_ascend/ops/triton/compute_slot_mapping.py#L12-L94
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L101-L143
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1142-L1157
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1228-L1253
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1576-L1580
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5635-L5661
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1316-L1342
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L1-L9
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L31-L48
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L92-L106
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L179
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L278-L283
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L153-L196
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L49-L62
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L190-L200
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L1-L290
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L52-L90
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L288-L303
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4738-L4784
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L108-L146
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L34-L51
  - vllm-ascend@baa023ad:vllm_ascend/worker/block_table.py#L44-L46
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L138-L139
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: 块表就是分页方案里的那张页表，注意力算子按它逐块取 KV
  - to: kv-cache-spec
    kind: builds-on
    note: 表的列数与块大小由 spec 的 block_size 和 max_num_blocks_per_req 算出，块表自己不决定
  - to: one-request
    kind: builds-on
    note: 表里那个块号、2048 的块大小、每颗每 token 每层 1 KiB，全是那条请求的数
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 格子里填的块号是上游分出来的；谁分、什么时候分、什么时候还，在那一页
contradicts: []
updated: "2026-09-25"
---

## 第 92 步那个 token，K 和 V 该写进显存哪一格

[那条请求](one-request.md)跑到第 92 步，送进模型的是回答的第 91 个 token。它在整条请求里排第 127 位（从 0 数：问题占了 0 到 36，回答从 37 往后排）。这一步算出它的 K 和 V（[注意力](attention-qkv.md)里每个 token 留下的两份笔记）之后，要写进显存某一格，后面的 token 才能回头读到它。

问题是：显存里存 K、V 的格子成千上万，分成一块一块（这个模型一块 2048 格），这条请求分到的是其中哪一块，是开始时临时要来的，谁也没法事先写死。于是要有一张表记着：

> 这条请求的**第 0 块**，在显存里是**第几块**。

这张表就是**块表**。有了它，「第 127 位写哪一格」就只剩两步：先算它是这条请求的第几块、块里第几格，再去表里查那一块在显存里的编号。

```wiki-diagram
file: block-table
```

## 查一次表，只要一道除法

一块 2048 格，所以：

- **127 ÷ 2048 的商是 0**：这是这条请求的第 0 块；
- **余数是 127**：在那一块里的第 127 格。

拿「第 0 块」去块表里这条请求那一行的第 0 格查，查到显存里的块号。块号是多少，由分块的那一方当时手上有哪些空块决定（见[块是怎么分出来的](vllm-kv-block-allocation.md)），我们这里假设它是 **5**。

显存里的格子是连着编号的：第 0 块是第 0 到 2047 格，第 1 块从 2048 开始……所以第 5 块的第 127 格，换成全显存统一的编号就是：

**槽位 = 5 × 2048 + 127 = 10367**

槽位就是「一个 token 的 K、V 放进哪一格」的那个统一编号。整个查表过程就这么多：**请求自己数的块号（叫逻辑块号）进去，显存里的块号（叫物理块号）出来**。块表是这两种编号之间唯一的翻译。

## 这张表长什么样

块表是一张整数表：

- **一行是一条请求**。准确说是「这一批里的第几个座位」：这一步跑哪几条请求，就按座位号排好，第 0 个座位用第 0 行。我们的例子里队列只有它一条，所以它坐第 0 行，其余行空着。
- **一格是一个块号**。第 0 格记它的第 0 块在显存哪儿，第 1 格记第 1 块，依此类推。
- **空着的格子填 0**。0 在这里是「还没用」的记号，不是说指向显存第 0 块。

表里只有块号，没有请求是谁。请求和座位的对应关系记在别处，块表只是按座位号被读写的一块内存。所以一批请求换了座位，表里整行跟着搬；两条请求对调座位，两行对调。

## 200 步里，这张表只动了两次

这条请求问题 37 个 token、回答 200 个，一共 237 个，离 2048 还远，从头到尾都住在同一块里：

| 时刻 | 第 0 行的开头几格 | 这一步表上做了什么 |
|---|---|---|
| 第 1 步（一次算完问题的 37 个 token） | 5, 0, 0, … | 放进块号 5 |
| 第 2 到第 200 步（每步 1 个 token） | 不变 | 什么都不做：第 5 块还有空格 |
| 请求结束 | 0, 0, 0, … | 用过的格子填回 0 |

对比一下每步都要算的东西：每一步每个新 token 都要按上面那道除法重新算一个槽位（第 1 步算 37 个：10240 到 10276；之后每步 1 个），**表却几乎不动**。一个变得极慢、一个变得极快，这是后面「表放在哪边、槽位在哪边算」的出发点。

如果回答很长，超过了 2048 个 token，第 2048 位的商就是 1：这条请求需要第 1 块。那时分块的一方会再给一个空块，表里第 1 格填上它的块号——整条请求一辈子里，表只在「要了新块」和「请求结束」时被改。

## 昇腾上，一大块被切成 16 小段

上面按「一块 2048 格」讲，账是对的。但昇腾上的注意力算子一次只认 **128 格**一段，于是机器记账时把 2048 格的一大块切成 **16 小段**，每段 128 格，查的是小段的号、算的是小段里的第几格。

切法很机械：显存第 5 块，就是第 5 × 16 = 80 到 95 这 16 个小段。所以这条请求那一行里，实际记的不是一个 5，而是 **80, 81, …, 95** 这 16 个数。第 127 位的查法跟着变成：

- 127 ÷ 128 的商是 0：查这一行的第 0 格，得小段 80；
- 余数 127：小段里第 127 格；
- 槽位 = 80 × 128 + 127 = **10367**。

和按 2048 直接算的结果**一模一样**。切小段只是为了配合算子，不改变任何一个 token 写到哪儿。读源码、看日志时见到「块大小 128」和「块大小 2048」同时出现，说的就是这两层：分配按 2048 一块，块表和算子按 128 一段。

还有一点：这个模型 40 层里只有 10 层是全注意力，按 token 一格一格地存 K、V；另外 30 层是[线性注意力](linear-attention.md)，每条请求只存一份固定大小的状态。两种层各有各的块表，线性注意力那边不切小段，也不按 token 算槽位。本页说的格子和槽位，全是那 10 层的。

## 表很小，它指着的东西很大

表里一个数只占 4 个字节。每个小段号背后是 128 个 token 在 10 层里的 K、V：两颗 NPU 时每颗每 token 每层 1 KiB，一段就是 128 × 10 × 1 KiB = **1.25 MiB**；一整块 2048 格是 **20 MiB**。四个字节对一兆多，差了五六个数量级。**所以别在这张表上省显存**，能省的量在噪声里。

一行有多宽也由不得它自己：按官方教程的最大长度 262144 个 token 算，一条请求最多要 262144 ÷ 2048 = 128 块，切成小段后一行 128 × 16 = 2048 格，一行 8 KiB。

## 慢的留在 CPU，快的交给 NPU

表变得慢：只在要了新块或请求结束时才动。槽位变得快：每步每个 token 都要算。两件事就被分开放：

- **表**常驻 CPU，按行一点点改；每一步开头，把这一批用到的那几行整体拷到 NPU 上。拷贝一发出就接着做别的准备，两边同时进行。
- **槽位**在 NPU 上直接算，一条请求交给一组并行的计算，算完不回 CPU。

算好的东西交给两个地方，别混：拷到 NPU 上的那几行表，给注意力算子**读**以前存下的 K、V；按 token 展开的槽位，给写缓存那一步，把这一步新算的 K、V **写**进去。同一张表既要按行给算子，又要按 token 展开成槽位，所以它 CPU、NPU 两边各有一份。

## 常见误解

- **「块表里存的是显存地址」**——存的是块号，一个整数。槽位也还只是「第几个 token 格」，不是字节偏移；字节偏移要按显存里 K、V 的摆法再算，见 [KV Cache](kv-cache.md)。
- **「每步都要重建这张表」**——那条请求 200 步里，表只在第 1 步写入、结束时清空。每步真正重算的是槽位，而且是在 NPU 上算。
- **「表里的 0 指向显存第 0 块」**——0 是「没用」的记号。看到一行后面一片 0，那是空位。
- **「块大小到底是 128 还是 2048」**——都是：分配按 2048 一块，块表和算子按 128 一段，两种算法得出的槽位相同。

## 对照源码

### 怎么开

块表没有开关，每一步都要用。决定它形状的是这几样：

- **定义**：官方设计文档说块表「把每个块在序列内的逻辑地址翻译成设备显存里的全局物理地址」，形状是 `(max num request, max model len / block size)` [S21]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html)）。
- **缓冲**：`BlockTable.block_table` 是 int32 的 `CpuGpuBuffer`，行数 `max_num_reqs`，另有长度 `max_num_reqs` 的 numpy 游标 `num_blocks_per_row` 记每行写到第几列 [C15]。`append_row` 从游标那一列写、写完推前游标；`add_row` 是「游标归零再 append」；`clear_row` 把用过的列填回 0；`move_row` / `swap_row` 整行复制 / 对调 [C27][C2]。请求与行的对应在 `NPUInputBatch` 手上，块表里没有请求 id。
- **块大小从哪来**：普通注意力模型走 `refresh_block_size` 定成 128 [C12]；混合结构模型不走这条，由昇腾 `patch_mamba_config` 按 SSM 页对齐算，本例 TP=1/2 都得 2048，推导见 [one-request](one-request.md) 的对照源码。
- **2048 拆成 16 × 128**：`model_runner_v1.py` 对每个 `AttentionSpec` 组用 `select_common_block_size` 选 kernel 块大小，非注意力组（Mamba）设 `[0]`，注释写明用来关掉 mamba 块的槽位计算 [C26]。昇腾注意力后端 `get_supported_kernel_block_sizes()` 只返回 `[128]` [C18][C30]。`BlockTable.__init__` 取第一个能整除物理块大小的 kernel size：`block_size = 128`、`blocks_per_phys_block = 2048 // 128 = 16`、`use_hybrid_blocks = True`，列数 = `max_num_blocks_per_req × 16` [C24]。`append_row` 经 `_convert_physical_to_logical_blocks` 把物理块号 `b` 展开成 `b×16 … b×16+15` [C25]。槽位 = `(b×16 + p // 128) × 128 + p % 128 = b × 2048 + p` [D]。
- **列数**：`max_num_blocks_per_req = cdiv(max_model_len, block_size × total_cp_world_size)`，由 model runner 按每个 KV cache 组的块大小算好再传进来 [C26][C11]。本例按 `--max-model-len 262144`：`cdiv(262144, 2048) = 128`，展开后 2048 列，一行 `2048 × 4 B = 8 KiB` [D]。
- **例子里的块号 5 是假设** [A]：具体是哪个整数由 [BlockPool](vllm-kv-block-allocation.md) 当时的空闲队列决定。第 92 步的位置 127 与 [谁管什么](who-owns-what.md) 的推导一致：`37 + 91 − 1 = 127` [D]。

### 会报什么错

- `BlockTable.__init__` 找不到一个能整除物理块大小的 kernel size 时抛 `ValueError("None of the kernel sizes ... can divide physical block size ... evenly")` [C24]。本例 2048 能被 128 整除，不会触发 [D]。
- main 上环形 KV cache（`is_circular`）的组开上下文并行时抛 `ValueError("Circular tail caches do not support context parallelism.")` [C1]。

### 开销和什么时候别开

- **表本身**：本例一行 8 KiB；一个小段号指着 `128 × 10 层 × 1 KiB = 1.25 MiB`，一个物理块 `2048 × 10 KiB = 20 MiB`（TP=2 每颗，数值取自 [one-request](one-request.md)）[D]。在表上做显存优化没有意义。
- **提交**：`_prepare_inputs` 最前面调 `commit_block_table(num_reqs)`，只把前 `num_reqs` 行异步拷到 NPU，源码注释写明是为了和后面的 CPU 准备工作重叠 [C9]。
- **槽位**：`compute_slot_mapping` 起 grid 为 `num_reqs + 1` 的 Triton kernel，一个 program 管一条请求，最后一个 program 专门把 `num_tokens` 到 `max_num_tokens` 的尾巴填成 `PAD_ID` [C6]。核心三行与官方文档那四步一一对应 [S20]：

  ```
  block_indices = pos // block_size                # 第几个逻辑块
  block_numbers = block_table[row, block_indices]  # 查表得物理块号
  slot_ids      = block_numbers * block_size + pos % block_size
  ```

- **两个消费者**：`block_table.gpu` 的前若干行进 `AscendMetadata.block_tables`，供算子读历史 KV；`slot_mapping` 切到 `[:num_actual_tokens]` 交给 `reshape_and_cache` 写本步新 K/V [C22][C8]。
- **块 0 是哨兵**：官方设计文档明确用 block_0 标记未使用的块 [S20]，`clear_row` 也是把用过的列填回 0。

### 版本差异

下表对照 **v0.23 维护分支**（2026-09-10 快照 `2c59ff10`）、**v0.26**（2026-09-17 快照 `2ed6cbba`）与 **main**（2026-09-21 快照 `baa023ad`）。前三行 v0.26 与 main 写法一致 [C23]；「环形 KV cache」与「按压缩比缩列」两行 v0.26 和 main 不同，分开写。三版都把 2048 的物理块按 `[128]` 拆成 16 段 [C18][C30][C7]。

| 项 | v0.23 维护分支 | v0.26 分支起 | 意味着什么 |
|---|---|---|---|
| 槽位 kernel | 从 `vllm.v1.worker.block_table` 导入上游那个 [C13]，分块大小写死 `BLOCK_SIZE=1024` [C16] | 昇腾自己的 `ops/triton/compute_slot_mapping.py`，一批 `TILE_BLOCK_SIZE = 1024` 个 token，且只把行内 `BLOCK_TABLE_WINDOW_SIZE` 个相邻列载进片上再 `tl.gather` [C3] | 算出来的槽位一样；v0.26 起避免了整行随机访存 [!] |
| 行扩展与缓冲长度 | `pcp × dcp > 1` 时行数乘 `(1 + num_speculative_tokens)`，`slot_mapping` 还多留 `2 × pcp × max_num_reqs` 个元素 [C15] | 只看 `dcp > 1`；`slot_mapping` 就是 `max_num_batched_tokens + MTP 余量` [C1] | v0.23 不开 PCP 也白留 `2 × max_num_reqs` 个 int32，不是 bug；v0.26 起 `pcp` 在这个文件里一个字都没有，照 v0.23 的行数去对新版会对不上 [!] |
| 提交方式 | 手写 `gpu[:n].copy_(cpu[:n].clone().pin_memory(), non_blocking=True)` [C17] | 直接调上游 `CpuGpuBuffer.copy_to_gpu(num_reqs)` [C4] | 行为等价，v0.23 每步多一次 clone [!] |
| 按压缩比缩列、Mamba 组按 CP 扩列 | 有：`cdiv(max_num_blocks_per_req, compress_ratio)`；Mamba 组在 `pcp × dcp > 1` 时列数乘并行度 [C14] | v0.26：仍有，Mamba 扩列只看 `dcp` [C28]；main：两步都删了，注释写明 spec 已给出每 rank 的表容量、Mamba 状态在 DCP 间复制而非切分 [C29] | 读 main 时别再到 `BlockTable` 里找列数调整，去 KV cache spec 那边找 [!] |
| 环形 KV cache | 没有这条路径 | v0.26 上也还没有；main 上 `is_circular` 的 spec 把整行压成一列、kernel size 强制等于块大小，且不许开上下文并行 [C1] | main 新增，默认不触发；读 main 的 `__init__` 时别被那一段带偏 [!] |

### 源码位置

- 块表类（main）：`vllm_ascend/worker/block_table.py` 构造 L36–L109 [C1]、行操作 L111–L149 [C2]、槽位 L151–L194 [C3]、提交 L298–L303 [C4]、物理→逻辑块展开 L305–L320 [C5]。
- 块表类（v0.23）：导入 L1–L9 [C13]、构造 L31–L48 [C14]、切小段 L52–L90 [C24]、缓冲 L92–L106 [C15]、行操作 L108–L146 [C27]、槽位 L148–L179 [C16]、提交 L278–L283 [C17]、展开 L288–L303 [C25]。
- 槽位 kernel（v0.26 起）：`vllm_ascend/ops/triton/compute_slot_mapping.py` L12–L94 [C6]。
- kernel 块大小的选择：v0.23 `model_runner_v1.py` L4738–L4784 [C26]；注意力后端 `get_supported_kernel_block_sizes`：v0.23 `attention_v1.py` L142–L144 [C18]、v0.26 L138–L139 [C30]。
- 读表与写缓存：`attention_v1.py` L190–L200 [C22]、L1142–L1157 [C8]；提交调用点 `model_runner_v1.py` L1228–L1253 [C9]。
- 官方设计文档：`docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md` L49–L62 [S21]、L153–L196 [S20]。
- 模型形状：Qwen3.6-35B-A3B 官方配置 [S31]。
