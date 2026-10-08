# Block Table —— 引用到的源码片段

对照两个 ref：`main = vllm-ascend@28bf3a2e`，`releases/v0.23.0 = vllm-ascend@2c59ff10`。

## vllm_ascend/worker/block_table.py#L37-L95

（main，28bf3a2e）

```python
        is_mamba_group = (
            kv_cache_group is not None
            and hasattr(kv_cache_group, "kv_cache_spec")
            and get_kv_cache_spec_kind(kv_cache_group.kv_cache_spec) == KVCacheSpecKind.MAMBA
        )
        # The KV cache spec already provides the per-rank table capacity.
        # Mamba state is replicated across DCP ranks, not sharded then expanded.
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
```

块表张量的形状（行 = `max_num_reqs * duplicate_size`，列 = `logical_table_size`）、dtype（int32）、`num_blocks_per_row` 游标、slot_mapping 缓冲长度，以及物理块 / 逻辑块拆分规则都在这里。main 上没有 `compress_ratio`、也没有 Mamba × CP 扩表——注释直接说明「spec 已经给出 per-rank 容量」。

## vllm_ascend/worker/block_table.py#L100-L138

（main，28bf3a2e）

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

decode 每步「追加」的实际动作：只往 `num_blocks_per_row[row]` 指向的下一列写新块号，不重写整行；`add_row` = 游标归零后 append；`clear_row` 把已用列填 0。`move_row` / `swap_row` 的存在说明行号是 batch 内的位置而非请求身份——批次重排时要把整行搬过去。这段在 v0.23.0（L108-L146）逐字相同。

## vllm_ascend/worker/block_table.py#L140-L179

（main，28bf3a2e）

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

main 的 slot mapping 走 vllm-ascend 自带的 triton kernel，grid 是 `num_reqs + 1`（最后一个 program 负责补 PAD），并多传了 `TILE_BLOCK_SIZE` / `BLOCK_TABLE_WINDOW_SIZE` 两个 Ascend 侧的分块参数。

## vllm_ascend/worker/block_table.py#L278-L283

（main，28bf3a2e）

```python
    def commit_block_table(self, num_reqs: int) -> None:
        self.block_table.copy_to_gpu(num_reqs)

    def clear(self) -> None:
        self.block_table.fill_(0)
        self.block_table.cpu.fill_(0)
```

main 的提交动作：交给上游 `CpuGpuBuffer.copy_to_gpu`，只拷前 `num_reqs` 行。

## vllm_ascend/worker/block_table.py#L285-L300

（main，28bf3a2e）

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

hybrid 模式下一个物理块被拆成 `blocks_per_phys_block` 个连续逻辑块号写进同一行，因此列数也要相应放大。两版逐字相同（v0.23.0 在 L288-L303）。

## vllm_ascend/ops/triton/compute_slot_mapping.py#L43-L84

（main，28bf3a2e）

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

槽位公式的权威出处：`block_indices = pos // block_size`、`slot_offsets = pos % block_size`、`slot_ids = block_numbers * block_size + slot_offsets`；同时说明 main 是按 `TILE_BLOCK_SIZE` 个 token 一批、只把行内 `BLOCK_TABLE_WINDOW_SIZE` 个相邻列载入片上再 `tl.gather`。

## vllm_ascend/attention/attention_v1.py#L113-L153

（main，28bf3a2e）

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

    @staticmethod
    def swap_blocks(
        src_kv_cache: list[torch.Tensor],
        dst_kv_cache: list[torch.Tensor],
        src_to_dst: torch.Tensor,
    ) -> None:
        src_key_cache, src_value_cache = src_kv_cache[0], src_kv_cache[1]
        dst_key_cache, dst_value_cache = dst_kv_cache[0], dst_kv_cache[1]
        src_indices = src_to_dst[:, 0]
        dst_indices = src_to_dst[:, 1]

        dst_key_cache[dst_indices] = src_key_cache[src_indices].to(dst_key_cache.device)
        dst_value_cache[dst_indices] = src_value_cache[src_indices].to(dst_key_cache.device)

    @staticmethod
    def copy_blocks(
        kv_caches: list[torch.Tensor],
        src_to_dists: torch.Tensor,
    ) -> None:
        src_indices = src_to_dists[:, 0]
        dst_indices = src_to_dists[:, 1]

        for kv_cache in kv_caches:
            key_caches = kv_cache[0]
            value_caches = kv_cache[1]
            key_caches[dst_indices] = key_caches[src_indices]
            value_caches[dst_indices] = value_caches[src_indices]

    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

块号在显存里指向什么：KV cache 每层张量是 `(2, num_blocks, block_size, num_kv_heads, head_size)`，所以「块号 × block_size + 偏移」正好是第二、三维展平后的下标。同时给出 Ascend GQA 后端只支持 `block_size = 128` 这一硬约束。

## vllm_ascend/attention/attention_v1.py#L1646-L1656

（main，28bf3a2e）

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

slot_mapping 的消费端：每层 attention 用它把本步算出的 K/V 散写进 KV cache。

## vllm_ascend/worker/model_runner_v1.py#L1143-L1147

（main，28bf3a2e）

```python
        # OPTIMIZATION: Start copying the block table first.
        # This way, we can overlap the copy with the following CPU operations.
        self.input_batch.block_table.commit_block_table(num_reqs)

        req_indices = np.repeat(self.arange_np[:num_reqs], num_scheduled_tokens)
```

`commit_block_table` 在 `_prepare_inputs` 的第一行调用，目的是让 H2D 拷贝与随后的 CPU 侧准备工作重叠。

## vllm_ascend/worker/model_runner_v1.py#L1468-L1472

（main，28bf3a2e）

```python
        self.input_batch.block_table.compute_slot_mapping(
            num_reqs,
            self.query_start_loc.gpu[: num_reqs + 1],
            self.positions[:total_num_scheduled_tokens],
        )
```

`compute_slot_mapping` 的唯一主调用点，说明它吃的是设备上的 `query_start_loc` 与全局 `positions`。

## vllm_ascend/worker/model_runner_v1.py#L4773-L4799

（main，28bf3a2e）

```python
            elif isinstance(kv_cache_spec, AttentionSpec):
                # This is an attention backend that supports virtual
                # block splitting. Get the supported block sizes from
                # the backend.
                attn_groups = self.attn_groups[kv_cache_group_id]
                backends = [attn_group.backend for attn_group in attn_groups]
                kv_manager_block_size = kv_cache_group.kv_cache_spec.block_size
                selected_kernel_size = select_common_block_size(
                    kv_manager_block_size, backends
                )
                self.kernel_block_sizes.append([selected_kernel_size])
            else:
                # This is likely Mamba or other non-attention cache,
                # no splitting.
                # NOTE: set kernel_block_sizes to 0 to disable slotmapping computation
                # of mamba block. In this case, BlockTable.block_size will never equal
                # to kernel_block_sizes[0]
                self.kernel_block_sizes.append([0])

        max_num_blocks = []
        max_model_len = max(self.max_model_len, self.max_encoder_len)
        for kv_cache_group in non_encoder_groups:
            max_num_blocks_per_req = kv_cache_group.kv_cache_spec.max_num_blocks_per_req(
                self.vllm_config,
                max_model_len,
            )
            max_num_blocks.append(max_num_blocks_per_req)
```

列数（`max_num_blocks_per_req`）与逻辑块大小（`kernel_block_sizes`）都不是 BlockTable 自己定的，而是由 KV cache spec 与后端声明的 kernel block size 决定。

## vllm_ascend/utils.py#L1167-L1181

（main，28bf3a2e）

```python
def refresh_block_size(vllm_config):
    """
    Refresh the block size in cache config.
    """
    cache_config = vllm_config.cache_config
    scheduler_config = vllm_config.scheduler_config
    model_config = vllm_config.model_config

    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128

    if not scheduler_config or not model_config:
        return
```

用户不显式指定 `--block-size` 时，昇腾平台把它置成 128。

## vllm_ascend/worker/block_table.py#L1-L9

（v0.23.0，2c59ff10）

```python
import numpy as np
import torch
from vllm.distributed import get_dcp_group, get_pcp_group
from vllm.utils.math_utils import cdiv
from vllm.v1.attention.backends.utils import PAD_SLOT_ID
from vllm.v1.kv_cache_interface import KVCacheGroupSpec, MambaSpec, UniformTypeKVCacheSpecs
from vllm.v1.utils import CpuGpuBuffer
from vllm.v1.worker.block_table import _compute_slot_mapping_kernel
from vllm.v1.worker.cp_utils import get_total_cp_world_size
```

v0.23.0 的 slot mapping kernel 直接从上游 `vllm.v1.worker.block_table` 导入；main 已改成导入 `vllm_ascend.ops.triton.compute_slot_mapping`（见本页 main 版 block_table.py L14-L17 与 compute_slot_mapping.py 片段）。

## vllm_ascend/worker/block_table.py#L31-L48

（v0.23.0，2c59ff10）

```python
        compress_ratio = 1
        if (
            kv_cache_group is not None
            and hasattr(kv_cache_group, "kv_cache_spec")
            and isinstance(kv_cache_group.kv_cache_spec, UniformTypeKVCacheSpecs)
        ):
            kv_cache_spec = next(iter(kv_cache_group.kv_cache_spec.kv_cache_specs.values()), None)
            if kv_cache_spec is not None and hasattr(kv_cache_spec, "compress_ratio"):
                compress_ratio = kv_cache_spec.compress_ratio
        if (
            kv_cache_group is not None
            and hasattr(kv_cache_group, "kv_cache_spec")
            and (self.pcp_world_size * self.dcp_world_size > 1)
            and isinstance(kv_cache_group.kv_cache_spec, MambaSpec)
        ):
            max_num_blocks_per_req = max_num_blocks_per_req * self.pcp_world_size * self.dcp_world_size
        max_num_blocks_per_req = max(cdiv(max_num_blocks_per_req, compress_ratio), 1)
        self.max_num_blocks_per_req = max_num_blocks_per_req
```

v0.23.0 会在构造时二次调整列数：按 `compress_ratio` 缩小、在 Mamba + CP 场景按 `pcp * dcp` 放大。main 把这两段删掉了，直接用传入值。

## vllm_ascend/worker/block_table.py#L92-L106

（v0.23.0，2c59ff10）

```python
        duplicate_size = 1
        if self.pcp_world_size * self.dcp_world_size > 1:
            duplicate_size += num_speculative_tokens
        self.block_table = self._make_buffer(max_num_reqs * duplicate_size, logical_table_size, dtype=torch.int32)
        self.num_blocks_per_row = np.zeros(max_num_reqs, dtype=np.int32)
        # MTP slot preparation appends up to num_speculative_tokens - 1
        # draft positions for every request in addition to graph padding.
        num_mtp_draft_slots = max(num_speculative_tokens - 1, 0) * self.max_num_reqs
        self.slot_mapping = self._make_buffer(
            self.max_num_batched_tokens + 2 * self.pcp_world_size * self.max_num_reqs + num_mtp_draft_slots,
            dtype=torch.int32,
        )

        self.kernel_sizes = kernel_sizes
        self.cp_kv_cache_interleave_size = cp_kv_cache_interleave_size
```

v0.23.0 的行数扩展条件含 PCP，slot_mapping 缓冲另外预留 `2 * pcp_world_size * max_num_reqs`。

## vllm_ascend/worker/block_table.py#L148-L179

（v0.23.0，2c59ff10）

```python
    def compute_slot_mapping(
        self,
        num_reqs: int,
        query_start_loc: torch.Tensor,
        positions: torch.Tensor,
    ) -> None:
        num_tokens = positions.shape[0]
        total_cp_world_size = self.pcp_world_size * self.dcp_world_size
        total_cp_rank = self.pcp_rank * self.dcp_world_size + self.dcp_rank
        if self.dcp_world_size * self.pcp_world_size > 1:
            req_indices = torch.repeat_interleave(
                torch.arange(num_reqs, dtype=torch.int32, device=query_start_loc.device),
                query_start_loc[1:] - query_start_loc[:-1],
                output_size=num_tokens,
            )
            self._compute_pcp_dcp_slot_mapping(req_indices, positions)
        else:
            _compute_slot_mapping_kernel[(num_reqs + 1,)](
                num_tokens,
                self.max_num_batched_tokens,
                query_start_loc,
                positions,
                self.block_table.gpu,
                self.block_table.gpu.stride(0),
                self.block_size,
                self.slot_mapping.gpu,
                TOTAL_CP_WORLD_SIZE=total_cp_world_size,
                TOTAL_CP_RANK=total_cp_rank,
                CP_KV_CACHE_INTERLEAVE_SIZE=self.cp_kv_cache_interleave_size,
                PAD_ID=PAD_SLOT_ID,
                BLOCK_SIZE=1024,
            )
```

v0.23.0 把上游 kernel 的分块大小写死成 `BLOCK_SIZE=1024`，没有 `TILE_BLOCK_SIZE` / `BLOCK_TABLE_WINDOW_SIZE` 这两个参数；CP 路径合并了 PCP 与 DCP。

## vllm_ascend/worker/block_table.py#L278-L283

（v0.23.0，2c59ff10）

```python
    def commit_block_table(self, num_reqs: int) -> None:
        self.block_table.gpu[:num_reqs].copy_(
            self.block_table.cpu[:num_reqs].clone().pin_memory(),
            non_blocking=True,
        )
```

v0.23.0 的提交是手写的：先把 CPU 行 clone 到一块 pinned 内存再异步 H2D；main 换成了 `CpuGpuBuffer.copy_to_gpu`。

## vllm_ascend/attention/attention_v1.py#L142-L144

（v0.23.0，2c59ff10）

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

v0.23.0 同样只支持 128，`block_size = 128` 这条约束两版一致。

## vllm_ascend/utils.py#L1369-L1381

（v0.23.0，2c59ff10）

```python
def refresh_block_size(vllm_config):
    """
    Refresh the block size in cache config.
    """
    cache_config = vllm_config.cache_config
    scheduler_config = vllm_config.scheduler_config
    model_config = vllm_config.model_config

    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128
```

v0.23.0 的默认 block_size 同样是 128。

## docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L153-L196

（main，28bf3a2e；线上同页 <https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html>）

````markdown
In the current **Block Table**, we use the first block (i.e. block_0) to mark the unused block. The shape of the block is `(max num request, max model len / block size)`, where `max model len / block size = 12 / 2 = 6`.

```shell
| 1  | 2  | 0  | 0  | 0  | 0  |
| 3  | 0  | 0  | 0  | 0  | 0  |
| 4  | 5  | 6  | 0  | 0  | 0  |
| 0  | 0  | 0  | 0  | 0  | 0  |
......
```

The KV cache block in the device memory is like:

```shell
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | ......
```

Let's say `K = max model len / block size = 6`, and we can get token `device block number`.

The workflow of achieving slot mapping:

1. Get `block table indices` using `K`, `positions` and `request indices`.
2. Get `device block number` using `block table indices`.
3. Get `block offsets` using `positions` and `block size`.
4. construct `slot mapping` using `device block number` and `block offsets`.

Details:

1. (**Token level**) Use a simple formula to calculate `block table indices`: `request indices * K + positions / block size`. ... = `[0, 0, 1, 6, 6, 12, 12, 13, 13, 14]`.
2. (**Token level**) Use `block table indices` to select out `device block number` for each scheduled token. The pseudocode is `block_numbers = block_table[block_table_indices]`. So `device block number=[1, 1, 2, 3, 3, 4, 4, 5, 5, 6]`
3. (**Token level**) `block offsets` could be computed by `block offsets = positions % block size = [0, 1, 0, 0, 1, 0, 1, 0, 1, 0]`.
4. Finally, use `block offsets` and `device block number` to create `slot mapping`: `device block number * block size + block_offsets = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12]`
````

官方设计文档对块表形状、block_0 作未使用哨兵、以及四步 slot mapping 的说明（为控制长度省略了原文中的说明句与部分算式，公式与结果未改）。同一段文字在 v0.23.0 的同路径同行号处一致。
