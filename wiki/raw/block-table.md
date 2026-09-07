# Block Table 源码片段

## vllm_ascend/worker/block_table.py#L84-L98

```python
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

两个核心缓冲区的形状与 dtype：block_table 是 `(max_num_reqs, max_num_blocks_per_req)` 的 int32，slot_mapping 是一维 int32。页面的「形状与数值」一节据此写出行列含义。

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

追加逻辑：新块从 `num_blocks_per_row[row_idx]` 处写入 numpy 视图，空列表直接返回。页面用它说明 decode 每步「有新块才追加」以及有效列数的记账方式。

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

入口：非 DCP 路径把 GPU 上的 block_table、positions、query_start_loc 交给 Triton kernel，grid 是 `num_reqs + 1`。页面用它说明 slot_mapping 在设备侧一次算完，以及多出的那个 program 用于 padding。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L43-L84

```python
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

槽位公式的原文：`block_indices = pos // block_size`，`slot_offsets = pos % block_size`，查表得 `block_numbers`，最后 `slot = block_numbers * block_size + slot_offsets`。页面的「形状与数值」示例算式直接来自这几行。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L30-L41

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
```

grid 里最后一个 program 的职责：把 `[num_tokens, max_num_tokens)` 填成 `PAD_SLOT_ID`。页面用它解释 grid 为什么是 `num_reqs + 1`。

## vllm_ascend/worker/block_table.py#L248-L272

```python
        total_cp_world_size = self.dcp_world_size
        virtual_physical_block_size = self.physical_block_size * total_cp_world_size
        physical_block_idx = positions // virtual_physical_block_size
        virtual_block_offsets = positions % virtual_physical_block_size

        self.current_rank = self.dcp_rank
        mask = virtual_block_offsets // self.cp_kv_cache_interleave_size % total_cp_world_size == self.current_rank
        local_physical_offsets = (
            virtual_block_offsets
            // (total_cp_world_size * self.cp_kv_cache_interleave_size)
            * self.cp_kv_cache_interleave_size
            + virtual_block_offsets % self.cp_kv_cache_interleave_size
        )
        logical_block_idx = physical_block_idx * self.blocks_per_phys_block + (
            local_physical_offsets // self.block_size
        )

        block_table_indices = req_indices * self.max_num_blocks_per_req * self.blocks_per_phys_block + logical_block_idx

        block_offsets = local_physical_offsets % self.block_size

        if block_table_indices.device.type != "cpu":
            block_numbers = self.block_table.gpu.flatten()[block_table_indices]
            slot_mapping = block_numbers * self.block_size + block_offsets
            self.slot_mapping.gpu[: req_indices.shape[0]] = torch.where(mask, slot_mapping, -1)
```

DCP 分支：按 `cp_kv_cache_interleave_size` 判断 token 是否属于本 rank，不属于的槽位写 -1。页面末尾用它说明 DCP 下的差异。

## vllm_ascend/worker/block_table.py#L278-L283

```python
    def commit_block_table(self, num_reqs: int) -> None:
        self.block_table.copy_to_gpu(num_reqs)

    def clear(self) -> None:
        self.block_table.fill_(0)
        self.block_table.cpu.fill_(0)
```

commit 的全部内容就是把前 num_reqs 行从 CPU 拷到 NPU。页面用它纠正「commit 只提交增量」的误解。

## vllm_ascend/worker/block_table.py#L347-L353

```python
        if max_num_blocks is None:
            # Note(hc): each dcp rank only store
            # (max_model_len//dcp_world_size) tokens in kvcache,
            # so the block_size which used for calc max_num_blocks_per_req
            # must be multiplied by dcp_world_size.
            dcp_world_size = get_decode_context_model_parallel_world_size()
            max_num_blocks = [cdiv(max_model_len, block_size * dcp_world_size) for block_size in block_sizes]
```

列数默认值的来源：`cdiv(max_model_len, block_size * dcp_world_size)`。页面用它给出表宽的数值推导。

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
            kv_cache_groups=kv_cache_groups,
        )
```

block table 挂在 InputBatch 上，每个 KV cache group 一张表。页面用它说明「在哪一步出现」的持有者。

## vllm_ascend/worker/model_runner_v1.py#L1143-L1145

```python
        # OPTIMIZATION: Start copying the block table first.
        # This way, we can overlap the copy with the following CPU operations.
        self.input_batch.block_table.commit_block_table(num_reqs)
```

每步 `_prepare_inputs` 的第一件事就是 commit，用来和后续 CPU 工作重叠。页面用它说明 commit 的时机。

## vllm_ascend/worker/model_runner_v1.py#L1468-L1472

```python
        self.input_batch.block_table.compute_slot_mapping(
            num_reqs,
            self.query_start_loc.gpu[: num_reqs + 1],
            self.positions[:total_num_scheduled_tokens],
        )
```

commit 之后、构造 attention metadata 之前调用 compute_slot_mapping，输入是设备侧的 query_start_loc 与 positions。页面用它确定调用顺序。

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

两个缓冲区被切片成 `[:num_reqs_padded]` / `[:num_tokens_padded]` 交给 attention metadata，padding 区域填 -1 / 0。页面用它说明表是常驻缓冲、每步只取前若干行。

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

AscendMetadata 里对两个字段语义的原文注释，页面「是什么」一节的行列含义以此为准。

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

slot_mapping 的消费端：`reshape_and_cache` 按槽位号把本步 K/V 写进 KV cache。页面用它说明写入路径。
