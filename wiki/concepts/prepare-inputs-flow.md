---
id: prepare-inputs-flow
title: 从请求到张量：每个 token 写进哪一格
type: feature
summary: 调度器只说「这一步给这条请求算几个 token」，模型要的却是摆好的几排数字：这几个 token 是谁、各自排在句子第几位、算完留下的 K 和 V 写进显存哪一格。这一页讲这几排数字怎么摆出来——第一步 37 个 token 摆成一排，之后每步只摆 1 个，格子号就是「块号 × 块大小 + 位置」。
aliases: [prepare_inputs, _prepare_inputs, NPUInputBatch, slot_mapping, compute_slot_mapping, 槽位, slot]
chapters: ["09"]
order: 20
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L729-L760
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L862-L880
  - vllm-ascend@2c59ff10:vllm_ascend/worker/npu_input_batch.py#L33-L40
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L1-L95
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L108-L130
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L180
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L305-L318
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L323-L432
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L153-L196
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L278-L283
  - vllm@0fc695fc:vllm/v1/worker/block_table.py#L141-L164
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L1-L50
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L151-L190
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L408-L411
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/block_table.py#L466-L481
  - vllm@0fc695fc:vllm/v1/worker/block_table.py#L326-L376
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L143-L144
  - vllm@0fc695fc:vllm/v1/worker/utils.py#L262-L328
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4741-L4769
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L288-L303
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L995-L1010
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L883-L885
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L138-L139
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: block-table
    kind: builds-on
    note: 块表每一行、每一列记的是什么在那一页；这里只讲它在「摆数字」这一步里怎么被查
  - to: one-request
    kind: builds-on
    note: 那条请求第一步 37 个 token、之后每步 1 个，各自写进哪一格就是在这里算出来的
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 调度器说了「算几个」，模型还要知道什么

[贯穿全库的那条请求](one-request.md)刚被调度器挑中。[调度器](vllm-scheduler.md)交代的只有一句话：**这一步给它算 37 个 token**。再往前，它已经向显存要到了一个 KV 块（[块是怎么分出来的](vllm-kv-block-allocation.md)），一块能放 2048 个 token 的 K 和 V。

可模型拿着「算 37 个」这句话是没法开工的。它要的是摆得整整齐齐的几排数字，每个 token 占一列：

- **这是哪个 token**：每个 [token](token.md) 在词表里的编号，模型拿它去查出那串 2048 个数字；
- **它排在句子第几位**：位置，从 0 数起。同一个字放在句首和句尾意思不一样，模型要靠位置分清先后；
- **算完写进哪一格**：这个 token 在全注意力层算出的 K 和 V 要存进 [KV Cache](kv-cache.md) 备查，存在块里的哪个**槽位**——一个块里能放一个 token 的格子。

还有一样不用新摆、但要一起交给模型：这条请求的[块表](block-table.md)那一行，记着「它的第几块在显存哪一块」，模型回头读前面的 K、V 时要按它去找。

这一页讲的就是：从调度器那句话，到这几排数字摆好，中间做了什么。

```wiki-diagram
file: prepare-inputs-flow
```

## 第一步：37 个 token 摆成一排

第一步，问题的 37 个 token 一起送进去。

- **token 编号**：从这条请求存着的那串编号里，按顺序取出这 37 个。
- **位置**：这条请求之前一个 token 也没算过，所以位置从 0 数到 36。
- **槽位**：这条请求只有一个块，就叫它「块号 b」。位置 0 写进这一块的第 0 格，位置 36 写进第 36 格。

显存里所有块的格子是**连着编号**的：第 0 块是第 0 到 2047 格，第 1 块接着从 2048 开始……所以「块号 b 的第 p 格」换成全显存的统一编号，就是：

**格子号 = 块号 × 2048 + 位置**

这一步摆出来的，是三排各 37 个数：37 个 token 编号、0 到 36 这 37 个位置、b × 2048 + 0 到 b × 2048 + 36 这 37 个格子号。

## 之后每步：只摆 1 个

第一步走完，模型吐出回答的第 1 个 token。第二步要把这个新 token 送回去算——这一步只有它 1 个。

- **位置**：前面已经算过 37 个 token，它就排第 37 位。
- **槽位**：还是块 b，第 37 格。

第三步的新 token 排第 38 位、写第 38 格……**每步的位置 = 这条请求已经算过的 token 个数**，格子就跟着往后挪一格。这里没有两套做法：第一步和之后每步走的是同一段代码，区别只是这一步摆 37 个还是 1 个。

这条请求一共 237 个 token，离 2048 还远，所以从头到尾都写在块 b 里，块表那一行也始终只有块 b 这一个号。

## 整除找块，余数找格

如果一条请求很长，超过了一块能装的 2048 个，第 2048 个 token 该写哪里？规则还是那一条，只是先要找到它在第几块：

- **位置 ÷ 2048 的商**：它是这条请求的第几块。拿这个数去块表那一行里查，得到显存里真正的块号；
- **位置 ÷ 2048 的余数**：它在那一块里的第几格。

位置 2048 的商是 1、余数是 0：这条请求第 1 块的第 0 格。我们的例子里位置最多两百出头，商永远是 0，查块表查到的永远是块 b。「把 KV 切成块、按块表去找」这套分页办法，落到代码里就是这一道除法。

还有一个机器内部的细节，不影响结果：昇腾上的注意力算子一次只认 128 格一段，所以机器记账时把 2048 格的一大块切成 16 小段，每段 128 格，查的是小段的号、算的是小段里的第几格。换算下来，格子号和上面那个式子一模一样。

## 一步里有好几条请求时

实际跑的时候，一步里常常不止这一条请求。几条请求的 token 就首尾相接排成一长排，另外记一张小表：「第 1 条从第几列开始、第 2 条从第几列开始……」。每个 token 还是按自己那条请求的块表、自己的位置去算格子号，互不干扰。

为了让每步摆出来的长度固定、方便机器重复使用同一套算法，一排的尾巴常常要补几列空位。空位也要填一个格子号，填的是一个专门留作「这里没人」的特殊号——往它身上写，不会弄坏任何请求的 KV。

## 这些格子只给全注意力那 10 层

这个模型 40 层里只有 10 层是全注意力，要一个 token 一格地存 K 和 V；另外 30 层是[线性注意力](linear-attention.md)，每条请求只存一份固定大小的状态，不需要「第几个 token 写第几格」。所以机器把这两种层分在不同的组里，各有各的块表，而线性注意力那边的槽位计算是直接关掉的。本页说的格子号，全是给那 10 层用的。

## 常见误解

- **「每步都把整句重新摆一遍」**——不是。第一步摆 37 个，之后每步只摆这一步新来的 1 个；前面的 token 已经算过，K、V 在块里存着，只按块表去读，不再摆。
- **「位置每步从 0 数起」**——不是。位置是这个 token 在整条请求里排第几，第二步那个 token 就是第 37 位，不是第 0 位。
- **「格子号是块里第几格」**——格子号是全显存统一编号，要把块号也算进去：b × 2048 + 位置。

## 和邻页怎么分工

- 块从哪来、什么时候要新块：[块是怎么分出来的](vllm-kv-block-allocation.md)；块表那一行怎么记：[块表](block-table.md)。
- 这几排数字摆好以后，模型怎么一层层跑完：[NPU 上的 model runner](npu-model-runner.md)。

## 对照源码

### 怎么开

这一段没有开关，每一步都要跑。影响它走哪条路的只有两处配置：

- **块大小**：这个模型不用自己设，昇腾按线性注意力状态的页大小对齐算出来，TP=2 时是 2048（推导见 [one-request](one-request.md) 的对照源码）；
- **上下文并行**：`pcp_world_size * dcp_world_size > 1` 时槽位改走 `_compute_pcp_dcp_slot_mapping`，不走 Triton kernel [C6]。

### 会报什么错

- 块大小和注意力后端支持的小段大小对不上时，上游 `select_common_block_size` 抛 `ValueError("No common block size for ...")` [C19]；昇腾 `BlockTable.__init__` 在一个 kernel size 都整除不了物理块大小时抛 `ValueError("None of the kernel sizes ... can divide physical block size ... evenly")` [C4]。本例 2048 能被 128 整除，不会触发 [D]。

### 开销和什么时候别开

- 槽位不在 Python 里逐个算。不开上下文并行时由 Triton kernel `_compute_slot_mapping_kernel` 算，grid 是 `(num_reqs + 1,)`：每条请求一个 program，最后多出来的那个 program 专门把 `num_tokens` 到 `max_num_tokens` 的尾巴填成 `PAD_ID`（注释写明是为了 CUDA graph 兼容）[C17]。昇腾传入 `PAD_ID=PAD_SLOT_ID`、`BLOCK_SIZE=1024`。想在这里加逻辑，要改的是 kernel，不是调用方 [I]。
- `_prepare_inputs` 一开头就调 `commit_block_table(num_reqs)`，把块表从 host 异步拷到设备（`non_blocking=True`），和后面的 CPU 计算重叠 [C24][C11]。
- 块表的列数是算出来的，不是配出来的 [D]。`BlockTable.__init__` 里从 `max_num_blocks_per_req` 到 buffer 列数要过三道：
  1. 若 KV Cache spec 是 `MambaSpec` 且 `pcp_world_size * dcp_world_size > 1`，先乘上这两个并行度（v0.26 上只看 `dcp_world_size`）；
  2. 统一 `max(cdiv(max_num_blocks_per_req, compress_ratio), 1)`——`compress_ratio` 从 `UniformTypeKVCacheSpecs` 里取，取不到就是 1；
  3. `use_hybrid_blocks` 时（一个物理块被拆成多个逻辑块），列数再乘 `blocks_per_phys_block`。

  排查「块表比预期窄/宽」要回到这三步 [A]。
- 混合注意力模型每个 KV Cache 组一张表，`MultiGroupBlockTable` 逐组转发，每组一次 kernel [C8]；v0.26 上可以一次融合算完，见下表。

### 版本差异

「整除取块、取余取格」、列数要算出来这几件事没变；变的是这道算式由谁的 kernel 算，以及块表还认不认 PCP：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `_compute_slot_mapping_kernel` 从哪儿来 | 从上游 `vllm.v1.worker.block_table` import，上游同一个 kernel、同样的 `(num_reqs + 1,)` grid [C12] | 换成仓内的 `vllm_ascend/ops/triton/compute_slot_mapping.py`，grid 仍是 `(num_reqs + 1,)` [C13] | 想改这道槽位算式，v0.26 上改的是昇腾自己这份 kernel，不必再等上游 [!] |
| kernel 的常量与并行度入参 | `PAD_ID=PAD_SLOT_ID`、`BLOCK_SIZE=1024`，`TOTAL_CP_*` 由 `pcp × dcp` 算出 | `BLOCK_SIZE` 改叫 `TILE_BLOCK_SIZE`，另加 `KV_CACHE_BLOCK_SIZE` 等三个常量；`pcp` 在这个文件里一处不剩，`TOTAL_CP_*` 只由 `dcp` 决定 [C14] | 照 v0.23 的名字搜 `BLOCK_SIZE=` 会落空；块表这条路上已经不认 PCP |
| 多组时的槽位计算 | 逐组转发，每组一次 kernel | 转发前先判 `_can_fuse_slot_mapping`：非 mamba 的组多于一张、且都不开 DCP 时，一次融合算完所有组 [C15][C16] | 混合注意力模型上少掉几次 kernel 启动 |
| 注意力后端支持的 kernel 块大小 | `[128]` [C18] | `[128]` [C25] | 两版都把 2048 的物理块拆成 16 段 128 |

`_prepare_inputs` 本身在 v0.23 上是 `model_runner_v1.py` 第 862 到 1375 行，v0.26 上是第 890 到 1326 行 [D]。

### 源码位置

- **三个对象**：上游 `SchedulerOutput` 说这一步跑哪些请求、各跑几个 token，`_update_states` 把它合进本卡的持久状态；`NPUInputBatch` 继承上游 `InputBatch`，按行放请求，行号稳定，所以块表上有 `move_row` / `swap_row` 这类操作[D]；`BlockTable` 是 `(请求数 × 每请求最大块数)` 的表，构造函数收 10 个参数，决定形状的是 `block_size`、`max_num_reqs`、`max_num_blocks_per_req`。
- **位置**：`positions_np = num_computed_tokens_cpu[req_indices] + query_pos`，即「已算过的个数 + 这一步里的第几个」[C22]。第一步 `num_computed_tokens = 0` 得 0…36，第二步为 37 得 37 [D]。
- **token 编号**：`token_indices = positions_np + req_indices * token_ids_cpu.shape[1]`，再 `torch.index_select` 从 `token_ids_cpu_tensor` 里取出，写进 `input_ids.cpu`。
- **槽位**：`BlockTable.compute_slot_mapping` 调上游 kernel，传入 `query_start_loc`、`positions`、`block_table.gpu` 及步长、`self.block_size`，结果写进 `self.slot_mapping.gpu`。kernel 内 `block_indices = pos // virtual_block_size`，查 `block_table` 得块号，块内偏移由 `pos - block_indices * virtual_block_size` 算出（不开 CP 时 `virtual_block_size` 就是 `block_size`）。开 CP 时先 `torch.repeat_interleave` 展开 `req_indices` 再走 `_compute_pcp_dcp_slot_mapping`。
- **2048 拆成 16 × 128**：`model_runner_v1.py` 对每个 `AttentionSpec` 组用 `select_common_block_size` 选 kernel 块大小；昇腾注意力后端 `get_supported_kernel_block_sizes()` 只返回 `[128]`，2048 不在其中，于是取能整除 2048 的 128。`BlockTable` 因此 `block_size = 128`、`blocks_per_phys_block = 16`、`use_hybrid_blocks = True`；`append_row` 把物理块号 `b` 展开成逻辑块 `b×16 … b×16+15`[C21]。槽位 = `(b×16 + p // 128) × 128 + p % 128 = b × 2048 + p`，与按 2048 直接算相同 [D]。
- **线性注意力组不算槽位**：非 `AttentionSpec`（如 Mamba）的组 `kernel_block_sizes` 设为 `[0]`，注释写明用来关掉 mamba 块的槽位计算。
- **块表上设备**：`append_row` 追加新块号，`commit_block_table` 把 host 表拷到设备，`get_device_tensor` 取出设备端张量交给算子。`MultiGroupBlockTable` 把多张 `BlockTable` 包成一组逐个转发。
- **返回值**：`_prepare_inputs` 返回的是 `logits_indices`、`spec_decode_metadata`、`total_num_scheduled_tokens` 三样；那几排张量是写进 runner 与 block table 的成员，不在返回值里。
- **官方设计文档**：`ModelRunner_prepare_inputs.md` 从上游视角描述了同一段流程 [S9]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html)）。
- **模型形状**：40 层中 10 层 `full_attention`、30 层 `linear_attention` [S26]。
