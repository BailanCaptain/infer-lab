---
id: prepare-inputs-flow
title: prepare_inputs 数据流
type: feature
summary: 调度器给的请求集合，经 NPUInputBatch 与 BlockTable 变成算子要的四个张量；槽位由一个 Triton kernel 算出来。
aliases: [prepare_inputs, _prepare_inputs, NPUInputBatch, slot_mapping, compute_slot_mapping]
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
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: block-table
    kind: builds-on
    note: 表的行列含义、逻辑块到物理块的映射在那一页，这里只讲它在数据流里的位置与上下游
  - to: one-request
    kind: builds-on
    note: 那条请求第 92 步的 slot 下标就是在这里算出来的
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

`_prepare_inputs` 是 `model_runner_v1.py` 里最长的一段（v0.23 上第 862 到 1375 行，v0.26 上第 890 到 1326 行）[D]。它的工作是把「调度器说这一步跑这些请求」翻译成「算子能吃的几个张量」：`input_ids`、`positions`、`block_table`、`slot_mapping`。

```wiki-diagram
file: prepare-inputs-flow
```

## 那条请求走到这里

第 92 步 decode，上游交过来的只有两样东西：**这一步给它 1 个 token**，以及**它手上有 `[b0, b1]` 两块**。

这一段要把这两个整数变成「写进显存哪一格」。算式只有一行：

```
slot = block_table[req][128 // 128] × 128 + 128 % 128
     = b1 × 128 + 0
```

`128 // 128 = 1` 取到块表这一行的第 1 列，也就是 `b1`；`128 % 128 = 0` 说明落在那一块的第 0 格。**整除取块、取模取格**——分页在代码里就是这一道除法和一道取模 [D]。

这条算式不在 Python 里跑。不开上下文并行时它由一个 Triton kernel 算，grid 是 `(num_reqs + 1,)` [C6]；想在这里加逻辑，要改的是 kernel，不是调用方。

## 三个对象各自持有什么

**`SchedulerOutput`**（上游的）说的是意图：这一步跑哪些请求、各自跑几个 token。`_update_states` 负责把它合进本卡的持久状态 [C1]。

**`NPUInputBatch`** 继承上游 `InputBatch` [C3]，是「本卡当前这一批」的容器，按槽位放请求。请求在批里的槽位是稳定的，所以才有 `move_row` / `swap_row` 这类操作 [D]。

**`BlockTable`** 是那张 `(请求数 × 每请求最大块数)` 的表 [C4]。构造函数收 10 个参数，其中三个决定表的形状：`block_size`、`max_num_reqs`、`max_num_blocks_per_req`。行列含义见 [Block Table](block-table.md)。

## 表的列数不是直接用传进来的值

`BlockTable.__init__` 里，从 `max_num_blocks_per_req` 到 buffer 真正的列数要过三道 [C4]：

1. 若 KV Cache spec 是 `MambaSpec` 且 `pcp_world_size * dcp_world_size > 1`，先乘上这两个并行度（v0.26 上这一条只看 `dcp_world_size`）；
2. 然后统一 `max(cdiv(max_num_blocks_per_req, compress_ratio), 1)`——按压缩比整除并保底 1；
3. 建 buffer 时，若 `kernel_sizes` 把一个物理块拆成了多个逻辑块（`use_hybrid_blocks`），列数再乘 `blocks_per_phys_block`。

`compress_ratio` 从 `UniformTypeKVCacheSpecs` 里取，取不到就是 1 [C4]。所以**表的列数是算出来的，不是配出来的** [D]；排查「块表比我预期的窄/宽」要回到这两步 [A]。

## 槽位是一个 Triton kernel 算的

`compute_slot_mapping` 分两条路 [C6]：

- 没开上下文并行（`pcp_world_size * dcp_world_size == 1`）时，直接调 `_compute_slot_mapping_kernel`，一个 Triton kernel，grid 是 `(num_reqs + 1,)`，把 `query_start_loc`、`positions`、`block_table.gpu` 和步长传进去，结果写进 `self.slot_mapping.gpu`；
- 开了的话先用 `torch.repeat_interleave` 按每个请求的 token 数展开出 `req_indices`，再走 `_compute_pcp_dcp_slot_mapping` [C6]。

kernel 的参数里有 `PAD_ID=PAD_SLOT_ID` 与 `BLOCK_SIZE=1024` [C6]。`PAD_SLOT_ID` 那一项是关键：批里没排满的位置要填成一个不会被写坏的哨兵槽位 [I]。

每步 decode 之后靠 `append_row` 追加新块号 [C5]、`commit_block_table` 把整张表拷到设备 [C11]，再由 `get_device_tensor` 取出设备端张量交给算子 [C7]。

## 混合注意力模型每组一张表

`MultiGroupBlockTable` 把多张 `BlockTable` 包成一组，`append_row` / `compute_slot_mapping` 这些方法逐个转发 [C8]。混合注意力（比如 full attention 与 mamba 混排）的模型每个 KV Cache 组有自己的块大小，所以不能共用一张表 [D]。

v0.26 上转发前多了一道判断 `_can_fuse_slot_mapping`：非 mamba 的组超过一张、而且它们都不开 DCP 时，槽位改成一次融合算完 [C15]。

官方设计文档 `ModelRunner_prepare_inputs.md` 从上游视角描述了同一段流程 [S9]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html)）；昇腾侧的差异只在上下文并行那条分支：Triton kernel 本身是上游的，昇腾从 `vllm.v1.worker.block_table` 直接 import 过来 [C4]，上游那边也是同一个 kernel、同样的 `(num_reqs + 1,)` grid [C12]。这句话到 v0.26 上不再成立，见下表第一行。

## v0.23 与 v0.26 的差异

四个张量、整除取块取模取格、列数要算出来这几件事没变；变的是这道算式由谁的 kernel 算，以及块表还认不认 PCP：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `_compute_slot_mapping_kernel` 从哪儿来 | 从上游 `vllm.v1.worker.block_table` import | 换成仓内的 `vllm_ascend/ops/triton/compute_slot_mapping.py`，grid 仍是 `(num_reqs + 1,)` [C13] | 想改这道槽位算式，v0.26 上改的是昇腾自己这份 kernel，不必再等上游 [!] |
| kernel 的常量与并行度入参 | `PAD_ID=PAD_SLOT_ID`、`BLOCK_SIZE=1024`，`TOTAL_CP_*` 由 `pcp × dcp` 算出 | `BLOCK_SIZE` 改叫 `TILE_BLOCK_SIZE`，另加 `KV_CACHE_BLOCK_SIZE` 等三个常量；`pcp` 在这个文件里一处不剩，`TOTAL_CP_*` 只由 `dcp` 决定 [C14] | 照 v0.23 的名字搜 `BLOCK_SIZE=` 会落空；块表这条路上已经不认 PCP |
| 多组时的槽位计算 | 逐组转发，每组一次 kernel | 非 mamba 的组多于一张、且都不开 DCP 时，一次融合算完所有组 [C16] | 混合注意力模型上少掉几次 kernel 启动 |

## 常见误解

- **「`slot_mapping` 是 Python 算的」**——不开上下文并行时它由 Triton kernel 算。想在这里加逻辑，要改的是 kernel 而不是调用方。
- **「块表列数等于 `max_num_blocks_per_req`」**——还要除压缩比、在 Mamba + 上下文并行时先乘并行度、在混合块模式下再乘 `blocks_per_phys_block` [C4]。
- **「`_prepare_inputs` 返回的是那几个张量」**——它返回的是 `logits_indices`、`spec_decode_metadata`、`total_num_scheduled_tokens` 三样 [C2]；张量是写进 runner 与 block table 的成员，不在返回值里。
