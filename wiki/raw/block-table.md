# Block Table 源码片段

引用基线：`vllm-ascend@28bf3a2e`（ref `main`）。

## vllm_ascend/worker/block_table.py#L44-L98

```python
        self.max_num_blocks_per_req = max_num_blocks_per_req
        self.max_num_batched_tokens = max_num_batched_tokens
        self.pin_memory = pin_memory
        self.device = device
        self.physical_block_size = block_size
        self.is_mamba_group = is_mamba_group

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

页面用它说明 `block_table` / `slot_mapping` 两个缓冲区的形状与 dtype、逻辑块拆分（`use_hybrid_blocks`）以及 DCP+MTP 下的行数放大。

## vllm_ascend/worker/block_table.py#L100-L119

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
```

页面用它说明「追加」的写入位置由 `num_blocks_per_row` 这个 CPU 侧游标决定，以及 `add_row` 与 `append_row` 的区别。

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

页面用它说明 slot mapping 走的是 Triton kernel（非 DCP 路径）、启动网格 `num_reqs + 1`、以及各编译期常量的取值来源。

## vllm_ascend/worker/block_table.py#L278-L283

```python
    def commit_block_table(self, num_reqs: int) -> None:
        self.block_table.copy_to_gpu(num_reqs)

    def clear(self) -> None:
        self.block_table.fill_(0)
        self.block_table.cpu.fill_(0)
```

页面用它说明「提交」这一步就是把 CPU 侧前 `num_reqs` 行搬到设备。

## vllm_ascend/worker/block_table.py#L285-L300

```python
    def _convert_physical_to_logical_blocks(self, physical_blocks: np.ndarray) -> np.ndarray:
        """Convert physical block IDs to logical block IDs."""
        if not self.use_hybrid_blocks:
            return physical_blocks

        # Create logical block IDs by splitting each physical block
        logical_blocks: list[int] = []
        for phys_block in physical_blocks:
            # Convert physical block to multiple logical blocks
            # Physical block 1 becomes logical blocks
            # [1*split_ratio, 1*split_ratio+1, ...]
            # But we need to account for the fact that block 0 is special
            base_logical = phys_block * self.blocks_per_phys_block
            logical_blocks.extend(range(base_logical, base_logical + self.blocks_per_phys_block))

        return np.array(logical_blocks, dtype=np.int32)
```

页面用它说明 hybrid 模式下一个物理块如何在表里展开成连续多个逻辑块号。

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

页面用它给出每行容量（列数）的默认公式。

## vllm_ascend/worker/block_table.py#L417-L431

```python
    def compute_slot_mapping(
        self,
        num_reqs: int,
        query_start_loc: torch.Tensor,
        positions: torch.Tensor,
        positions_compressed_list: list[np.ndarray] | None = None,
        req_indices_compressed_list: list[np.ndarray] | None = None,
    ) -> None:
        for i, block_table in enumerate(self.block_tables):
            if block_table.is_mamba_group:
                continue
            if positions_compressed_list and req_indices_compressed_list:
                block_table.compute_slot_mapping_draft(req_indices_compressed_list[i], positions_compressed_list[i])
            else:
                block_table.compute_slot_mapping(num_reqs, query_start_loc, positions)
```

页面用它说明多 KV cache group 时每组各有一张表，且 Mamba 组被跳过。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L30-L84

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
            virtual_block_size = KV_CACHE_BLOCK_SIZE * TOTAL_CP_WORLD_SIZE
            virtual_block_indices = pos // virtual_block_size
            virtual_block_offsets = pos - virtual_block_indices * virtual_block_size
            is_local = (virtual_block_offsets // CP_KV_CACHE_INTERLEAVE_SIZE) % TOTAL_CP_WORLD_SIZE == TOTAL_CP_RANK
            local_block_offsets = (
                virtual_block_offsets // (TOTAL_CP_WORLD_SIZE * CP_KV_CACHE_INTERLEAVE_SIZE)
            ) * CP_KV_CACHE_INTERLEAVE_SIZE + (virtual_block_offsets % CP_KV_CACHE_INTERLEAVE_SIZE)

            block_indices = virtual_block_indices * BLOCKS_PER_KV_BLOCK + local_block_offsets // block_size
            slot_offsets = local_block_offsets % block_size

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

页面用它逐行解释「position → 逻辑块号 + 块内偏移 → 查表得物理块号 → slot id」这条主线，以及最后一个 program 负责尾部填 `PAD_ID`。

## vllm_ascend/ops/triton/compute_slot_mapping.md#L11-L19

```markdown
- 每个 `program_id(0) == req_idx` 处理一条请求（一个 sequence）。
- 通过 `query_start_loc_ptr` 得到该请求在 batch 中的 token 起止区间 `[start_idx, end_idx)`。
- 对区间内每个 token：
    - 读取其逻辑序列位置 `pos`；
    - 根据 `block_size` 将 `pos` 拆分为 `block_indices`（块内逻辑块号）与 `slot_offsets`（块内偏移）；
    - 通过 `block_table` 把逻辑块号转换为物理块号 `block_numbers`；
    - 计算 `slot_id = block_numbers * block_size + slot_offsets`，写回 `slot_mapping_ptr`。
- 当 `TOTAL_CP_WORLD_SIZE > 1`（启用 Context Parallel，CP）时，会按 `CP_KV_CACHE_INTERLEAVE_SIZE` 交错布局把虚拟块切分到各 rank：仅属于本 rank 的 token 写入真实 slot id，其余写入 `PAD_ID`（详见下文「多 CP 域下的计算说明」）。
- **最后一个 program**（`req_idx == num_programs(0) - 1`）专门用于把 `slot_mapping_ptr` 中 `[num_tokens, max_num_tokens)` 这段填充为 `PAD_ID`
```

仓库内随算子附带的说明文档，页面用它印证对 kernel 行为的解读（与源码读法一致）。

## vllm_ascend/attention/attention_v1.py#L114-L121

```python
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_dtype_str: str = "",
    ) -> tuple[int, ...]:
        return (2, num_blocks, block_size, num_kv_heads, head_size)
```

页面用它算每块字节数，并说明 slot id 为什么等于「块号 × 块大小 + 块内偏移」。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

页面用它固定 `block_size = 128` 这个前提。

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

页面用它给出 attention metadata 里两个字段的形状与含义（含上游注释里的 slot 例子）。

## vllm_ascend/attention/attention_v1.py#L250-L253

```python
        self.device = device
        self.max_num_blocks_per_req = cdiv(
            self.model_config.max_model_len, AscendAttentionBackend.get_supported_kernel_block_sizes()[0]
        )
```

页面用它给出「每行列数 = ceil(max_model_len / 128)」这条算式。

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

页面用它说明 `slot_mapping` 的最终消费者是 `reshape_and_cache` 这一步写入。

## vllm_ascend/worker/model_runner_v1.py#L1143-L1145

```python
        # OPTIMIZATION: Start copying the block table first.
        # This way, we can overlap the copy with the following CPU operations.
        self.input_batch.block_table.commit_block_table(num_reqs)
```

页面用它说明「提交」为何排在 `_prepare_inputs` 的最前面。

## vllm_ascend/worker/model_runner_v1.py#L1468-L1472

```python
        self.input_batch.block_table.compute_slot_mapping(
            num_reqs,
            self.query_start_loc.gpu[: num_reqs + 1],
            self.positions[:total_num_scheduled_tokens],
        )
```

页面用它给出 slot mapping 的实际调用点与三个输入。

## vllm_ascend/worker/model_runner_v1.py#L3152-L3158

```python
                blk_table = self.input_batch.block_table[kv_cache_gid]
                slot_mapping = blk_table.slot_mapping.gpu[:num_tokens_padded]
                blk_table_tensor = blk_table.get_device_tensor()[:num_reqs_padded]
                # Fill unused with -1. Needed for reshape_and_cache in full cuda
                # graph mode. `blk_table_tensor` -1 to match mamba PAD_SLOT_ID
                slot_mapping[num_tokens:num_tokens_padded].fill_(-1)
                blk_table_tensor[num_reqs:num_reqs_padded].fill_(0)
```

页面用它说明设备张量如何被切片进 attention metadata，以及图模式下的 padding 约定。

## vllm_ascend/worker/npu_input_batch.py#L131-L144

```python
        # Block table.
        self.block_table = MultiGroupBlockTable(
            max_num_reqs=max_num_reqs,
            max_model_len=max_model_len,
            max_num_batched_tokens=max_num_batched_tokens,
            pin_memory=pin_memory,
            device=device,
            block_sizes=block_sizes,
            max_num_blocks=max_num_blocks_per_req,
            num_speculative_tokens=num_speculative_tokens,
            kernel_sizes=kernel_block_sizes,
            cp_kv_cache_interleave_size=cp_kv_cache_interleave_size,
        )
```

页面用它说明块表的持有者是 `InputBatch`，生命周期与整个 batch 槽位一致。

## docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L49-L62

```markdown
- **`block table`**: translates the logical address (within its sequence) of each block to its global physical address in the device's memory.
- `max query len`: the longest scheduled tokens length in this request batch.
- `slot mapping`: indices of each token that input token will be stored into.
- `attention mask`: mask matrix applied to attention scores before softmax to control which tokens can attend to each other (usually a causal attention).

## Before start

There are mainly three types of variables.

- token level: represents one attribute corresponding to each scheduled token, so the length of this variable is the number of scheduled tokens.
- request level: represents one attribute of each scheduled request, whose length usually is the number of scheduled requests. (`query start location` is a special case, which has one more element.)
- system level:
  1. **Token IDs table**: stores the token IDs (i.e. the inputs of a model) of each request. The shape of this table is `(max num request, max model len)`. Here, `max num request` is the maximum count of concurrent requests allowed in a forward batch and `max model len` is the maximum token count that can be handled at one request sequence in this model.
  2. **Block table**: translates the logical address (within its sequence) of each block to its global physical address in the device's memory. The shape of this table is `(max num request, max model len / block size)`
```

官方开发者设计文档，页面用它给出块表的定义与形状（行=请求槽位、列=逻辑块号）。

## docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L191-L196

```markdown
Details:

1. (**Token level**) Use a simple formula to calculate `block table indices`: `request indices * K + positions / block size`. So it equals `[0 * 6 + 0 / 2, 0 * 6 + 1 / 2, 0 * 6 + 2 / 2, 1 * 6 + 0 / 2, 1 * 6 + 1 / 2, 2 * 6 + 0 / 2, 2 * 6 + 1 / 2, 2 * 6 + 2 / 2, 2 * 6 + 3 / 2, 2 * 6 + 4 / 2] = [0, 0, 1, 6, 6, 12, 12, 13, 13, 14]`. This could be used to select `device block number` from `block table`.
2. (**Token level**) Use `block table indices` to select out `device block number` for each scheduled token. The pseudocode is `block_numbers = block_table[block_table_indices]`. So `device block number=[1, 1, 2, 3, 3, 4, 4, 5, 5, 6]`
3. (**Token level**) `block offsets` could be computed by `block offsets = positions % block size = [0, 1, 0, 0, 1, 0, 1, 0, 1, 0]`.
4. Finally, use `block offsets` and `device block number` to create `slot mapping`: `device block number * block size + block_offsets = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12]`
```

官方文档给出的四步法，页面用它作为 `compute_slot_mapping` 的权威口径。

## docs/source/developer_guide/Design_Documents/context_parallel.md#L13-L20

```markdown
For a DCP size of `dcp_size`, a virtual block contains `block_size * dcp_size` tokens. For token `x`:

- `virtual_block_index = x // (block_size * dcp_size)`
- `offset_in_virtual_block = x % (block_size * dcp_size)`
- `local_block_index = offset_in_virtual_block // cp_kv_cache_interleave_size`
- `target_rank = local_block_index % dcp_size`

The slot-mapping calculation uses this layout so each DCP rank stores only its local sequence shard. The current implementation requires `block_size % cp_kv_cache_interleave_size == 0`.
```

官方文档，页面用它说明 DCP 分支下的「虚拟块」语义与 `block_size % cp_kv_cache_interleave_size == 0` 约束。
