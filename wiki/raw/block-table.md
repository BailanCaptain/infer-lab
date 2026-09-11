# Block Table 源码片段

引用自 `vllm-ascend@28bf3a2e`（ref `main`）。行号与本地仓库一致。

## vllm_ascend/worker/block_table.py#L79-L98

```python
        if self.use_hybrid_blocks:
            logical_table_size = max_num_blocks_per_req * self.blocks_per_phys_block
        else:
            logical_table_size = max_num_blocks_per_req

        duplicate_size = 1
        if self.dcp_world_size > 1:
            duplicate_size += num_speculative_tokens
        self.block_table = self._make_buffer(max_num_reqs * duplicate_size, logical_table_size, dtype=torch.int32)
        self.num_blocks_per_row = np.zeros(max_num_reqs, dtype=np.int32)
        # MTP slot preparation appends up to num_speculative_tokens - 1
        # draft positions for every request beyond the scheduler token limit.
        num_mtp_draft_slots = max(num_speculative_tokens - 1, 0) * self.max_num_reqs
        self.slot_mapping = self._make_buffer(
            self.max_num_batched_tokens + num_mtp_draft_slots,
            dtype=torch.int32,
        )

        self.kernel_sizes = kernel_sizes
        self.cp_kv_cache_interleave_size = cp_kv_cache_interleave_size
```

三个缓冲区的形状与 dtype 全在这里：块表本体、每行已填块数、slot_mapping。事实表的形状行来自这一段。

## vllm_ascend/worker/block_table.py#L100-L138

```python
    def append_row(
        self,
        block_ids,
        row_idx: int,
    ) -> None:
        if not block_ids:
            return
        block_ids = np.array(block_ids)
        if self.use_hybrid_blocks:
            block_ids = self._convert_physical_to_logical_blocks(block_ids)

        num_blocks = len(block_ids)
        start = self.num_blocks_per_row[row_idx]

        self.block_table.np[row_idx, start : start + num_blocks] = block_ids
        self.num_blocks_per_row[row_idx] += num_blocks

    def add_row(self, block_ids: list[int], row_idx: int) -> None:
        self.num_blocks_per_row[row_idx] = 0
        self.append_row(block_ids, row_idx)

    def clear_row(self, row_idx: int) -> None:
        num_blocks = self.num_blocks_per_row[row_idx]
        if num_blocks > 0:
            self.block_table.np[row_idx, :num_blocks] = 0
        self.num_blocks_per_row[row_idx] = 0

    def move_row(self, src: int, tgt: int) -> None:
        num_blocks = self.num_blocks_per_row[src]
        self.block_table.np[tgt, :num_blocks] = self.block_table.np[src, :num_blocks]
        self.num_blocks_per_row[tgt] = num_blocks

    def swap_row(self, src: int, tgt: int) -> None:
        num_blocks_src = self.num_blocks_per_row[src]
        num_blocks_tgt = self.num_blocks_per_row[tgt]
        self.num_blocks_per_row[src] = num_blocks_tgt
        self.num_blocks_per_row[tgt] = num_blocks_src

        self.block_table.np[[src, tgt]] = self.block_table.np[[tgt, src]]
```

「decode 时怎样追加」的直接依据：追加写在 `num_blocks_per_row[row_idx]` 指向的列，写完游标前移；`add_row` 是把游标清零后的 `append_row`。`move_row` / `swap_row` 说明行是可以被整体搬动的批内槽位，不是请求的稳定标识。

## vllm_ascend/worker/block_table.py#L51-L77

```python
        # If kernel_sizes is None or [0], use physical block size (no splitting)
        if kernel_sizes is None or kernel_sizes == [0]:
            self.block_size = block_size
            self.logical_block_size = block_size
            self.blocks_per_phys_block = 1
            self.use_hybrid_blocks = False
        else:
            # Find the first kernel size that divides physical_block_size evenly
            selected_kernel_size = None
            for kernel_size in kernel_sizes:
                if kernel_size > 0 and self.physical_block_size % kernel_size == 0:
                    selected_kernel_size = kernel_size
                    break

            if selected_kernel_size is None:
                raise ValueError(
                    f"None of the kernel sizes {kernel_sizes} can divide "
                    f"physical block size {self.physical_block_size} evenly"
                )

            self.block_size = selected_kernel_size
            self.logical_block_size = selected_kernel_size
            self.blocks_per_phys_block = self.physical_block_size // self.logical_block_size
            if self.blocks_per_phys_block > 1:
                self.use_hybrid_blocks = True
            else:
                self.use_hybrid_blocks = False
```

说明「物理块」与「逻辑块」在什么条件下不是一回事：`kernel_sizes` 给出内核能吃的块粒度，一个物理块可以被切成 `blocks_per_phys_block` 个逻辑块。

## vllm_ascend/worker/block_table.py#L140-L179

```python
    def compute_slot_mapping(
        self,
        num_reqs: int,
        query_start_loc: torch.Tensor,
        positions: torch.Tensor,
    ) -> None:
        num_tokens = positions.shape[0]
        total_cp_world_size = self.dcp_world_size
        total_cp_rank = self.dcp_rank
        if self.dcp_world_size > 1:
            req_indices = torch.repeat_interleave(
                torch.arange(num_reqs, dtype=torch.int32, device=query_start_loc.device),
                query_start_loc[1:] - query_start_loc[:-1],
                output_size=num_tokens,
            )
            self._compute_dcp_slot_mapping(req_indices, positions)
        else:
            TILE_BLOCK_SIZE = 1024
            kernel_kwargs = {
                "KV_CACHE_BLOCK_SIZE": self.physical_block_size,
                "BLOCKS_PER_KV_BLOCK": self.blocks_per_phys_block,
                "TOTAL_CP_WORLD_SIZE": total_cp_world_size,
                "TOTAL_CP_RANK": total_cp_rank,
                "CP_KV_CACHE_INTERLEAVE_SIZE": self.cp_kv_cache_interleave_size,
                "PAD_ID": PAD_SLOT_ID,
                "TILE_BLOCK_SIZE": TILE_BLOCK_SIZE,
                "BLOCK_TABLE_WINDOW_SIZE": _next_power_of_2(cdiv(TILE_BLOCK_SIZE, self.block_size) + 1),
            }

            _compute_slot_mapping_kernel[(num_reqs + 1,)](
                num_tokens,
                self.max_num_batched_tokens,
                query_start_loc,
                positions,
                self.block_table.gpu,
                self.block_table.gpu.stride(0),
                self.block_size,
                self.slot_mapping.gpu,
                **kernel_kwargs,
            )
```

槽位映射的入口：非 DCP 路径直接起 Triton 内核，grid 是 `num_reqs + 1`，读的是已经落到设备上的 `block_table.gpu`。`TILE_BLOCK_SIZE = 1024` 与 `BLOCK_TABLE_WINDOW_SIZE` 的算式也在这里。

## vllm_ascend/worker/block_table.py#L278-L283

```python
    def commit_block_table(self, num_reqs: int) -> None:
        self.block_table.copy_to_gpu(num_reqs)

    def clear(self) -> None:
        self.block_table.fill_(0)
        self.block_table.cpu.fill_(0)
```

「提交」的全部内容：把 CPU 侧前 `num_reqs` 行搬到设备。页面里关于 commit 语义的结论只能从这两行加调用点推出。

## vllm_ascend/worker/block_table.py#L347-L358

```python
        if max_num_blocks is None:
            # Note(hc): each dcp rank only store
            # (max_model_len//dcp_world_size) tokens in kvcache,
            # so the block_size which used for calc max_num_blocks_per_req
            # must be multiplied by dcp_world_size.
            dcp_world_size = get_decode_context_model_parallel_world_size()
            max_num_blocks = [cdiv(max_model_len, block_size * dcp_world_size) for block_size in block_sizes]

        if len(max_num_blocks) != len(block_sizes):
            raise ValueError(
                f"max_num_blocks length ({len(max_num_blocks)}) must match block_sizes length ({len(block_sizes)})"
            )
```

列数的默认算式 `cdiv(max_model_len, block_size * dcp_world_size)`，以及「每个 KV cache group 一张表」的来源。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L30-L54

```python
    req_idx = tl.program_id(0)

    if req_idx == tl.num_programs(0) - 1:
        # Pad remaining slots for CUDA graph compatibility.
        for i in range(num_tokens, max_num_tokens, TILE_BLOCK_SIZE):
            offsets = i + tl.arange(0, TILE_BLOCK_SIZE)
            tl.store(
                slot_mapping_ptr + offsets,
                PAD_ID,
                mask=offsets < max_num_tokens,
            )
        return

    start_idx = tl.load(query_start_loc_ptr + req_idx).to(tl.int64)
    end_idx = tl.load(query_start_loc_ptr + req_idx + 1).to(tl.int64)

    row_offset = req_idx * block_table_stride
    block_table_offsets = tl.arange(0, BLOCK_TABLE_WINDOW_SIZE)
    for i in range(start_idx, end_idx, TILE_BLOCK_SIZE):
        offsets = i + tl.arange(0, TILE_BLOCK_SIZE)
        mask = offsets < end_idx
        pos = tl.load(positions_ptr + offsets, mask=mask, other=0).to(tl.int32)
        if TOTAL_CP_WORLD_SIZE == 1:
            block_indices = pos // block_size
            slot_offsets = pos - block_indices * block_size
        else:
```

内核怎么按请求分工（一个 program 一条请求，最后一个 program 专做 padding）、怎么用 `query_start_loc` 取本请求的 token 区间、以及非 CP 路径把 `pos` 拆成逻辑块号与块内偏移。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L67-L84

```python
        INT32_MAX = 2147483647
        valid_block_indices = tl.where(mask, block_indices, INT32_MAX)
        block_idx_base = tl.min(valid_block_indices, axis=0)
        block_table_window_offsets = block_idx_base + block_table_offsets
        block_table_window = tl.load(
            block_table_ptr + row_offset + block_table_window_offsets,
            mask=block_table_window_offsets < block_table_stride,
            other=0,
        ).to(tl.float32)
        if TOTAL_CP_WORLD_SIZE == 1:
            relative_block_indices = tl.where(mask, block_indices - block_idx_base, 0)
        else:
            relative_block_indices = tl.where(mask & is_local, block_indices - block_idx_base, 0)
        block_numbers = tl.gather(block_table_window, relative_block_indices, 0).to(tl.int32)
        slot_ids = block_numbers * block_size + slot_offsets
        if TOTAL_CP_WORLD_SIZE != 1:
            slot_ids = tl.where(is_local, slot_ids, PAD_ID)
        tl.store(slot_mapping_ptr + offsets, slot_ids, mask=mask)
```

查表与合成 slot id 的那一步：不是逐 token 随机访存，而是先把本 tile 用得到的那一小段表行整体载入（窗口），再在窗口内 `tl.gather`；最后 `slot = block_numbers * block_size + slot_offsets`。

## vllm_ascend/ops/triton/compute_slot_mapping.md#L53-L75

```markdown
| 参数名 | 形状 / 类型 | 含义 |
| --- | --- | --- |
| `num_tokens` | int | 当前 batch 中实际的 token 数量。 |
| `max_num_tokens` | int | 预分配的最大 token 数。 |
| `query_start_loc_ptr` | `[num_reqs + 1]`, int32 | 每条请求在 batch 中的累加起始位置，类似 CSR 的 `indptr`，`req_idx` 的 token 区间为 `[query_start_loc[req_idx], query_start_loc[req_idx+1])`。 |
| `positions_ptr` | `[num_tokens]`, int64 | 每个 token 在其所属请求中的逻辑序列位置。 |
| `block_table_ptr` | `[max_num_reqs, max_num_blocks_per_req]`, int32（展平） | 块表，将「逻辑块号」映射为「物理块号」；按行展开存储。 |
| `block_table_stride` | int | `block_table` 一行的元素个数，即 `max_num_blocks_per_req`。 |
| `block_size` | int | Attention 内核使用的逻辑块大小（一个逻辑块包含多少 token）。 |
| `slot_mapping_ptr` | `[max_num_tokens]`, int32 | 输出张量，写入每个 token 对应的物理 KV Cache slot id。 |

### 2.2 编译期常量参数（`tl.constexpr`）

| 参数名 | 含义 |
| --- | --- |
| `KV_CACHE_BLOCK_SIZE` | KV Cache 物理分配块大小（物理 block 的大小）。 |
| `BLOCKS_PER_KV_BLOCK` | 一个物理 KV 块包含多少个逻辑 block，满足 `KV_CACHE_BLOCK_SIZE = BLOCKS_PER_KV_BLOCK * block_size`。 |
| `TOTAL_CP_WORLD_SIZE` | Context Parallel 通信域的总 rank 数；为 `1` 时走非 CP 路径。 |
| `TOTAL_CP_RANK` | 当前设备在 CP 通信域中的 rank。 |
| `CP_KV_CACHE_INTERLEAVE_SIZE` | CP 模式下 KV Cache 的交错大小，用于将虚拟块按 interleave 粒度切分到各 rank。 |
| `PAD_ID` | 无效槽位的填充值（通常为 `PAD_SLOT_ID = -1`），用于 padding 区域与非本 rank 槽位。 |
| `TILE_BLOCK_SIZE` | Triton 循环中的 tile 大小，控制单次迭代处理的 token 数。 |
| `BLOCK_TABLE_WINDOW_SIZE` | 一次性加载到寄存器的 block_table 窗口大小（需 ≥ `TILE_BLOCK_SIZE / block_size + 1`，并取 2 的幂以便 Triton 向量化）。 |
```

仓库内的算子文档，给出内核各参数的形状与 dtype（含 `positions` 是 int64、`slot_mapping` 是 int32）、`PAD_ID` 通常为 `PAD_SLOT_ID = -1`，以及 `BLOCK_TABLE_WINDOW_SIZE` 为什么取那个下界。

## vllm_ascend/worker/model_runner_v1.py#L1143-L1145

```python
        # OPTIMIZATION: Start copying the block table first.
        # This way, we can overlap the copy with the following CPU operations.
        self.input_batch.block_table.commit_block_table(num_reqs)
```

提交的时机：每次 `_prepare_inputs` 一进来就发 H2D，好让拷贝与后续 CPU 端准备工作重叠。

## vllm_ascend/worker/model_runner_v1.py#L1468-L1472

```python
        self.input_batch.block_table.compute_slot_mapping(
            num_reqs,
            self.query_start_loc.gpu[: num_reqs + 1],
            self.positions[:total_num_scheduled_tokens],
        )
```

槽位映射的调用点，以及它相对 `commit_block_table` 的先后顺序（同一函数内，L1145 在前、L1468 在后）。

## vllm_ascend/attention/attention_v1.py#L200-L210

```python
    # ********************** KV Cache Related Properties ********************* #
    # Block addresses per sequence (Seq id -> list of physical block).
    # (batch_size, max_blocks_per_seq)
    block_tables: torch.Tensor = None

    # The indices of the token slots that input tokens will be stored into.
    # E.g., if `slot_mapping` is [35, 2, 17] and the block size is 16, the
    # three tokens are stored in the 3rd slot in block 2, 2nd slot in block 0,
    # and 1st slot in block 1, respectively.
    # (num_tokens,)
    slot_mapping: torch.Tensor = None
```

`AscendMetadata` 里块表与 slot_mapping 的字段定义和形状注释——这是「表最终交给谁」的答案。

## vllm_ascend/attention/attention_v1.py#L113-L121

```python
    @staticmethod
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_dtype_str: str = "",
    ) -> tuple[int, ...]:
        return (2, num_blocks, block_size, num_kv_heads, head_size)
```

物理块在显存里的实际形状，用于「拿真实数字走一遍」里算一个块占多少字节、slot id 索引的是哪一维。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

Ascend attention 后端只接受 `block_size = 128`，事实表与「常见误解」都引这一条。

## vllm_ascend/attention/attention_v1.py#L251-L253

```python
        self.max_num_blocks_per_req = cdiv(
            self.model_config.max_model_len, AscendAttentionBackend.get_supported_kernel_block_sizes()[0]
        )
```

列数在 attention builder 侧的算式，和 `MultiGroupBlockTable` 的默认值对得上（非 DCP 时 `dcp_world_size = 1`）。

## vllm_ascend/attention/attention_v1.py#L1646-L1656

```python
            slots = attn_metadata.slot_mapping
            encoder_decoder = self.attn_type == AttentionType.ENCODER_DECODER
            DeviceOperator.reshape_and_cache(
                key=key[: attn_metadata.num_actual_tokens] if not encoder_decoder else key,
                value=value[: attn_metadata.num_actual_tokens] if not encoder_decoder else value,
                key_cache=self.key_cache,
                value_cache=self.value_cache,
                # quick fix to make sure slots is int32 for cross attention case.
                # see: https://github.com/vllm-project/vllm/blob/ce88756b967c2c5006746a424c15dd59a284ed8c/vllm/model_executor/layers/attention/cross_attention.py#L117
                slot_mapping=slots[: attn_metadata.num_actual_tokens] if not encoder_decoder else slots.to(torch.int32),
            )
```

slot_mapping 的最终消费者：`reshape_and_cache` 拿它把这一步算出的 K/V 写进 KV cache，且只取前 `num_actual_tokens` 个（padding 段不写）。

## vllm_ascend/attention/attention_v1.py#L380-L387

```python
        if block_table is not None and block_table.shape[0] < num_reqs_fia:
            block_table = torch.cat(
                [
                    block_table,
                    block_table.new_zeros((num_reqs_fia - block_table.shape[0], block_table.shape[1])),
                ],
                dim=0,
            )
```

表的行数在交给 FIA 算子前可能被补齐：多出来的哑请求行填 0（指向物理块 0），因为它不会写 KV cache，所以无害。

## docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L60-L64

```markdown
- system level:
  1. **Token IDs table**: stores the token IDs (i.e. the inputs of a model) of each request. The shape of this table is `(max num request, max model len)`. Here, `max num request` is the maximum count of concurrent requests allowed in a forward batch and `max model len` is the maximum token count that can be handled at one request sequence in this model.
  2. **Block table**: translates the logical address (within its sequence) of each block to its global physical address in the device's memory. The shape of this table is `(max num request, max model len / block size)`

**Note**: Both of these two tables come from the `_update_states` method before **preparing inputs**. You can take a look if you need more inspiration.
```

官方设计文档对块表的定义与形状，以及「表内容由 `_update_states` 维护、`_prepare_inputs` 只读」的分工。

## docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L191-L196

```markdown
Details:

1. (**Token level**) Use a simple formula to calculate `block table indices`: `request indices * K + positions / block size`. So it equals `[0 * 6 + 0 / 2, 0 * 6 + 1 / 2, 0 * 6 + 2 / 2, 1 * 6 + 0 / 2, 1 * 6 + 1 / 2, 2 * 6 + 0 / 2, 2 * 6 + 1 / 2, 2 * 6 + 2 / 2, 2 * 6 + 3 / 2, 2 * 6 + 4 / 2] = [0, 0, 1, 6, 6, 12, 12, 13, 13, 14]`. This could be used to select `device block number` from `block table`.
2. (**Token level**) Use `block table indices` to select out `device block number` for each scheduled token. The pseudocode is `block_numbers = block_table[block_table_indices]`. So `device block number=[1, 1, 2, 3, 3, 4, 4, 5, 5, 6]`
3. (**Token level**) `block offsets` could be computed by `block offsets = positions % block size = [0, 1, 0, 0, 1, 0, 1, 0, 1, 0]`.
4. Finally, use `block offsets` and `device block number` to create `slot mapping`: `device block number * block size + block_offsets = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12]`
```

官方文档把槽位映射写成四步（算表内索引 → 查物理块号 → 算块内偏移 → 合成 slot），页面的「怎么工作」沿用这个分步。

## docs/source/developer_guide/Design_Documents/context_parallel.md#L11-L20

```markdown
DCP stores tokens in an interleaved layout across ranks. The interleaving granularity is controlled by `cp_kv_cache_interleave_size`, whose default value is `1`.

For a DCP size of `dcp_size`, a virtual block contains `block_size * dcp_size` tokens. For token `x`:

- `virtual_block_index = x // (block_size * dcp_size)`
- `offset_in_virtual_block = x % (block_size * dcp_size)`
- `local_block_index = offset_in_virtual_block // cp_kv_cache_interleave_size`
- `target_rank = local_block_index % dcp_size`

The slot-mapping calculation uses this layout so each DCP rank stores only its local sequence shard. The current implementation requires `block_size % cp_kv_cache_interleave_size == 0`.
```

开 DCP 后槽位映射换算的官方说明：虚拟块 = `block_size * dcp_size`，每个 rank 只留自己那一份，其余 token 写 `PAD_ID`。
