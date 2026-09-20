---
id: block-table
title: Block Table：逻辑块号到物理块号的唯一翻译层
type: concept
summary: 一张 (请求数 × 每请求最大块数) 的 int32 表。行是请求在这一批里的座位号，列是它自己数出来的第几个块，格子里填的是显存里的物理块号。
aliases: [Block Table, 块表, 块映射表, BlockTable]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:vllm_ascend/worker/block_table.py#L36-L108
  - vllm-ascend@b255ab59:vllm_ascend/worker/block_table.py#L110-L148
  - vllm-ascend@b255ab59:vllm_ascend/worker/block_table.py#L150-L190
  - vllm-ascend@b255ab59:vllm_ascend/worker/block_table.py#L291-L296
  - vllm-ascend@b255ab59:vllm_ascend/worker/block_table.py#L298-L313
  - vllm-ascend@b255ab59:vllm_ascend/ops/triton/compute_slot_mapping.py#L12-L94
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L106-L148
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1665-L1680
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L1200-L1225
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L1546-L1550
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5357-L5383
  - vllm-ascend@b255ab59:vllm_ascend/utils.py#L1252-L1278
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L1-L9
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L31-L48
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L92-L106
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L179
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L278-L283
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L153-L196
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L49-L62
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L195-L205
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: 块表就是分页方案里的那张页表，attention 算子按它逐块取 KV
  - to: kv-cache-spec
    kind: builds-on
    note: 表的列数与逻辑块大小由 spec 的 block_size 和 max_num_blocks_per_req 算出，BlockTable 自己不决定
  - to: one-request
    kind: builds-on
    note: 表里那两个块号、第 92 步换块换的那一列，全是那条请求的数
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 格子里填的物理块号是上游分出来的；谁分、什么时候分、什么时候还，在那一页
contradicts: []
updated: "2026-09-20"
---

## 一句话

`BlockTable` 是一张 int32 的二维表。**行是请求在这一批里的座位号，列是这个请求自己数出来的第几个块，格子里填的是显存里的物理块号** [C15]。[分页](paged-attention.md)把一条请求的 KV 散到显存各处之后，从「这是第几个 token」到「它该写进哪一格」就只剩这一条路可走——官方设计文档给它的定义正是「把每个块在序列内的逻辑地址翻译成设备显存里的全局物理地址」[S21]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html)）。

```wiki-diagram
file: block-table
```

## 那条请求走到这里

[那条请求](one-request.md)是队列里唯一的一条，所以它坐第 0 行，256 行里只有这一行有东西。上游分给它的两块记作物理块 5 和 42 [A]——具体是哪两个整数由 [BlockPool](vllm-kv-block-allocation.md) 当时的空闲队列决定，这一页只管把它们放进表里。

| 时刻 | 第 0 行的前四列 | 这一步在表上做了什么 |
|---|---|---|
| 第 1 步 prefill | 5, 0, 0, 0 | `add_row([5], 0)`：游标归零，再写第 0 列 |
| 第 1–91 步 decode | 不变 | 什么都不做——第 0 块还有空格 |
| 第 92 步 decode | 5, 42, 0, 0 | `append_row([42], 0)`：从游标指的第 1 列开始写 |
| 请求结束 | 0, 0, 0, 0 | `clear_row(0)` 把用过的列填回 0 |

**整整 200 步里，这张表只被改动过 8 个字节**，而 `slot_mapping` 是 200 步每步全量重算。这两件事的量级根本不同，**把它们拆开，是这一页后面所有设计的出发点**。

第 92 步那个 token 的槽位就这么算出来：`block_table[0][128 // 128] × 128 + 128 % 128 = 42 × 128 + 0 = 5376` [D]。

## 行号是座位号，不是请求 id

第 `i` 行对应的是「batch 里第 `i` 个位置」，不是某个固定的请求。批次一重排，行就得跟着搬：`move_row(src, tgt)` 整行复制过去，`swap_row` 两行对调 [C2]。表里没有任何地方记着请求 id——请求与行的对应关系在 `NPUInputBatch` 手上，块表只是被它按行号驱动的一块内存。**读源码时最容易迷路的地方就在这里**：在块表里找不到任何请求身份。

CPU 侧还有一个不起眼但关键的东西：`num_blocks_per_row`，一个长度为 `max_num_reqs` 的 numpy 游标数组，记着每行写到第几列了 [C15]。`append_row` 从游标那一列开始写、写完把游标推前；`add_row` 只是「游标归零后再 append」。没有它，追加一个块号之前得先扫一遍行去找末尾。

## 表本身 32 KiB，它指着的东西以 GiB 计

那条请求的配置下（`--max-model-len 4096`、`--max-num-seqs 256`），列数 = `cdiv(4096, 128) = 32`，行数 = 256，整张表 **256 × 32 × 4 B = 32 KiB**；而每一个表项指着一整块 KV——按那条请求的数，一块是 **14 MiB**。四个字节和十四兆，差了六个数量级 [D]。**所以别在这张表上做显存优化**，能省的量在噪声里。

它的形状也基本由不得自己。列数是 `max_num_blocks_per_req`，由 KV cache spec 按 `max_model_len` 算好后传进来 [C11]；`BlockTable` 拿到之后还会按压缩比再调一次，那一段属于 [prepare_inputs 数据流](prepare-inputs-flow.md)。块大小同样如此：昇腾 GQA 后端的 `get_supported_kernel_block_sizes` 只返回 `[128]` [C18]，而上游分出来的物理块也是 128，见 [block 是怎么分出来的](vllm-kv-block-allocation.md)。两者相等，于是 `blocks_per_phys_block == 1`，把一个物理块拆成多串逻辑块的 hybrid 路径默认根本不启用 [D]。

## 慢的那一半留在 CPU，快的那一半留在 NPU

块表变得很慢：只有调度器分配或释放块时才动，decode 一步最多加一个块号。槽位变得极快：每步每个 token 都要重算一遍。这两件事被拆开放在了两侧。

**慢的那一半**常驻 CPU、按行增量更新，每步只把前 `num_reqs` 行异步拷到 NPU。这一句被放在 `_prepare_inputs` 的最前面，源码注释写明了理由——先把拷贝发出去，好和后面那一大段 CPU 准备工作重叠 [C9]。

**快的那一半**根本不回 CPU。`compute_slot_mapping` 起一个 grid 为 `num_reqs + 1` 的 Triton kernel，一个 program 管一个请求，最后那个 program 专门把 `num_tokens` 到 `max_num_tokens` 之间的尾巴填成 `PAD_ID` [C6]。kernel 的核心就三行，和官方文档那四步一一对应 [S20]：

```
block_indices = pos // block_size                # 第几个逻辑块
block_numbers = block_table[row, block_indices]  # 查表得物理块号
slot_ids      = block_numbers * block_size + pos % block_size
```

翻译出来的东西有两个消费者，别混：`block_table.gpu` 的前若干行进 `AscendMetadata.block_tables`，供算子读历史 KV；`slot_mapping` 切到 `[:num_actual_tokens]` 交给 `reshape_and_cache`，写本步新算的 K/V [C22][C8]。**这解释了后面很多看起来绕的设计**——同一张表既要按行给算子，又要按 token 展开成槽位，所以它必须同时活在 CPU 和 NPU 两份缓冲里。

## 两个分支在这张表上的差别

下表对照 **v0.23 维护分支**（2026-09-10 的源码快照 `2c59ff10`）与 **main 开发主线**（源码快照 `b255ab59`）。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 槽位 kernel | 从 `vllm.v1.worker.block_table` 导入上游那个 [C13]，分块大小写死 `BLOCK_SIZE=1024` [C16] | 昇腾自己的 `ops/triton/compute_slot_mapping.py`，一批 `TILE_BLOCK_SIZE = 1024` 个 token，且只把行内 `BLOCK_TABLE_WINDOW_SIZE` 个相邻列载进片上再 `tl.gather` [C3] | 算出来的槽位一样；main 这版避免了整行随机访存 [!] |
| 行扩展与缓冲长度 | `pcp × dcp > 1` 时行数乘 `(1 + num_speculative_tokens)`，`slot_mapping` 还多留 `2 × pcp × max_num_reqs` 个元素 [C15] | 只看 `dcp > 1`；`slot_mapping` 就是 `max_num_batched_tokens + MTP 余量` [C1] | 同样开 PCP + 投机解码两版行数不同；v0.23 不开 PCP 也多留 512 个 int32，不是 bug [!] |
| 提交方式 | 手写 `gpu[:n].copy_(cpu[:n].clone().pin_memory(), non_blocking=True)` [C17] | 直接调上游 `CpuGpuBuffer.copy_to_gpu(num_reqs)` [C4] | 行为等价，v0.23 每步多一次 clone [!] |
| 环形 KV cache | 没有这条路径 | `is_circular` 的 spec 把整行压成一列，且不许开上下文并行 [C1] | main 新增，默认不触发；读新版 `__init__` 时别被那一段带偏 [!] |

## 常见误解

- **「块表里存的是显存地址」**——存的是块号，一个 int32。地址要现算，而且算出来的 `slot` 仍然是「第几个 token 槽」，不是字节偏移；字节偏移由算子按块张量的布局推，见 [KV Cache](kv-cache.md)。
- **「decode 每步都要重建这张表」**——那条请求 199 步 decode 里只往表里写过一次 [D]。每步真正全量重算的是 `slot_mapping`，而它在 NPU 上算。
- **「块 0 是一块正常可用的 KV 块」**——官方设计文档明确用 block_0 标记未使用的块 [S20]，`clear_row` 也是把用过的列填回 0 [C2]。看到表里一片 0，那是空位，不是都指向第一块。
