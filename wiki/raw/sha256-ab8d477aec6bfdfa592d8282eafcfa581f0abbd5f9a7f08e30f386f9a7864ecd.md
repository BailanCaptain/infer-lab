vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L352

    def schedule(self) -> SchedulerOutput:
        self.current_step += 1
        # NOTE(woosuk) on the scheduling algorithm:
        # There's no "decoding phase" nor "prefill phase" in the scheduler.
        # Each request just has the num_computed_tokens and
        # num_tokens_with_spec. num_tokens_with_spec =
        # len(prompt_token_ids) + len(output_token_ids) + len(spec_token_ids).
        # At each step, the scheduler tries to assign tokens to the requests
        # so that each request's num_computed_tokens can catch up its
        # num_tokens_with_spec. This is general enough to cover
        # chunked prefills, prefix caching, speculative decoding,
        # and the "jump decoding" optimization in the future.


vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L401-L410

                continue

            num_new_tokens = (
                request.num_tokens_with_spec
                + request.num_output_placeholders
                - request.num_computed_tokens
            )
            if 0 < self.scheduler_config.long_prefill_token_threshold < num_new_tokens:
                num_new_tokens = self.scheduler_config.long_prefill_token_threshold
            num_new_tokens = min(num_new_tokens, token_budget)

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L678-L700

                    num_new_tokens = 0
                else:
                    # Number of tokens to be scheduled.
                    # We use `request.num_tokens` instead of
                    # `request.num_prompt_tokens` to consider the resumed
                    # requests, which have output tokens.
                    num_new_tokens = request.num_tokens - num_computed_tokens
                    threshold = self.scheduler_config.long_prefill_token_threshold
                    if 0 < threshold < num_new_tokens:
                        num_new_tokens = threshold

                    # chunked prefill has to be enabled explicitly to allow
                    # pooling requests to be chunked
                    if (
                        not self.scheduler_config.enable_chunked_prefill
                        and num_new_tokens > token_budget
                    ):
                        # If chunked_prefill is disabled,
                        # we can stop the scheduling here.
                        break

                    num_new_tokens = min(num_new_tokens, token_budget)
                    assert num_new_tokens > 0

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1019

    def _update_after_schedule(self, scheduler_output: SchedulerOutput) -> None:
        # Advance the number of computed tokens for the request AFTER
        # the request is scheduled.
        # 1. The scheduler_output of the current step has to include the
        #    original number of scheduled tokens to determine input IDs.
        # 2. Advance the number of computed tokens here allowing us to
        #    schedule the prefill request again immediately in the next
        #    scheduling step.
        # 3. If some tokens (e.g. spec tokens) are rejected later, the number of
        #    computed tokens will be adjusted in update_from_output.
        num_scheduled_tokens = scheduler_output.num_scheduled_tokens
        for req_id, num_scheduled_token in num_scheduled_tokens.items():
            request = self.requests[req_id]
            request.num_computed_tokens += num_scheduled_token
            request.is_prefill_chunk = request.num_computed_tokens < (
                request.num_tokens + request.num_output_placeholders
            )
            scheduler_output.has_structured_output_requests |= (
                request.use_structured_output and not request.is_prefill_chunk
            )
            # Drop from the in-flight-prefill set once it's no longer prefilling.
            if not request.is_prefill_chunk:
                self._inflight_prefills.discard(request)

vllm@0fc695fc:vllm/config/scheduler.py#L70-L90

    max_num_partial_prefills: int = Field(default=1, ge=1)
    """For chunked prefill, the maximum number of sequences that can be
    partially prefilled concurrently."""

    max_long_partial_prefills: int = Field(default=1, ge=1)
    """For chunked prefill, the maximum number of prompts longer than
    long_prefill_token_threshold that will be prefilled concurrently. Setting
    this less than max_num_partial_prefills will allow shorter prompts to jump
    the queue in front of longer prompts in some cases, improving latency."""

    long_prefill_token_threshold: int = 0
    """For chunked prefill, a request is considered long if the prompt is
    longer than this number of tokens."""

    enable_chunked_prefill: bool = True
    """If True, prefill requests can be chunked based
    on the remaining `max_num_batched_tokens`.

    The default value here is mainly for convenience when testing.
    In real usage, this should be set in `EngineArgs.create_engine_config`.
    """

vllm@0fc695fc:vllm/config/scheduler.py#L238-L272

        if self.enable_chunked_prefill:
            logger.info_once(
                "Chunked prefill is enabled with max_num_batched_tokens=%d.",
                self.max_num_batched_tokens,
            )

        if self.max_num_partial_prefills > 1:
            if self.long_prefill_token_threshold == 0:
                self.long_prefill_token_threshold = int(max_model_len * 0.04)

            logger.info(
                "Concurrent partial prefills enabled with "
                "max_num_partial_prefills=%d, max_long_partial_prefills=%d, "
                "long_prefill_token_threshold=%d",
                self.max_num_partial_prefills,
                self.max_long_partial_prefills,
                self.long_prefill_token_threshold,
            )

        self.verify_max_model_len(max_model_len)

    def verify_max_model_len(self, max_model_len: int) -> Self:
        if (
            self.max_num_batched_tokens < max_model_len
            and not self.enable_chunked_prefill
        ):
            raise ValueError(
                f"max_num_batched_tokens ({self.max_num_batched_tokens}) is "
                f"smaller than max_model_len ({max_model_len}). "
                "This effectively limits the maximum sequence length to "
                "max_num_batched_tokens and makes vLLM reject longer "
                "sequences. Please increase max_num_batched_tokens or "
                "decrease max_model_len."
            )


vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2394

    def _set_default_chunked_prefill_and_prefix_caching_args(
        self, model_config: ModelConfig
    ) -> None:
        default_chunked_prefill = model_config.is_chunked_prefill_supported
        default_prefix_caching = model_config.is_prefix_caching_supported

        if self.enable_chunked_prefill is None:
            self.enable_chunked_prefill = default_chunked_prefill

            logger.debug(
                "%s chunked prefill by default",
                "Enabling" if default_chunked_prefill else "Disabling",
            )
        elif (
            model_config.runner_type == "generate"
            and not self.enable_chunked_prefill
            and default_chunked_prefill
        ):
            logger.warning_once(
                "This model does not officially support disabling chunked prefill. "
                "Disabling this manually may cause the engine to crash "
                "or produce incorrect outputs.",
            )
        elif (
            model_config.runner_type == "pooling"

vllm@0fc695fc:vllm/engine/arg_utils.py#L2258-L2267


    def _check_feature_supported(self):
        """Raise an error if the feature is not supported."""
        # No Concurrent Partial Prefills so far.
        if (
            self.max_num_partial_prefills != SchedulerConfig.max_num_partial_prefills
            or self.max_long_partial_prefills
            != SchedulerConfig.max_long_partial_prefills
        ):
            _raise_unsupported_error(feature_name="Concurrent Partial Prefill")

vllm@0fc695fc:vllm/engine/arg_utils.py#L2518-L2528


        if orig_max_num_batched_tokens is None:
            assert model_config.max_model_len is not None, (
                "max_model_len must be set by this point"
            )
            if not self.enable_chunked_prefill:
                # If max_model_len is too short, use the default for higher throughput.
                self.max_num_batched_tokens = max(
                    model_config.max_model_len,
                    self.max_num_batched_tokens,
                )

vllm@0fc695fc:vllm/config/model.py#L1803-L1810

            return attn_type != "encoder_decoder"
        else:
            # for generative models
            if attn_type == "encoder_decoder":
                logger.debug("Encoder decoder models do not support chunked prefill.")
                return False

            logger.debug("Generative models support chunked prefill.")

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263

        self.has_mamba_layers = kv_cache_config.has_mamba_layers
        self.needs_kv_cache_zeroing = kv_cache_config.needs_kv_cache_zeroing
        self.need_mamba_block_aligned_split = (
            self.has_mamba_layers and self.cache_config.mamba_cache_mode == "align"
        )

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L330

    def _mamba_block_aligned_split(
        self,
        request: Request,
        num_new_tokens: int,
        num_new_local_computed_tokens: int = 0,
        num_external_computed_tokens: int = 0,
    ) -> int:
        num_computed_tokens = (
            request.num_computed_tokens
            + num_new_local_computed_tokens
            + num_external_computed_tokens
        )
        # Perform block-aligned splitting at prefill phase, including:
        # * non-resumed requests: num_computed_tokens < num_prompt_tokens + 0
        # * resumed requests: num_computed_tokens < (
        #                       num_prompt_tokens + num_output_tokens
        #                     )
        # NOTE: Use `request.num_tokens - 1` to bypass normal decoding.
        if num_computed_tokens < max(request.num_prompt_tokens, request.num_tokens - 1):
            # To enable block-aligned caching of the Mamba state, `num_new_tokens`
            # must be a multiple of `block_size`.
            # As an exception, if `num_new_tokens` is less than `block_size`, the
            # state is simply not cached, requiring no special handling.
            # Additionally, when Eagle mode is enabled, FullAttn prunes the last
            # matching block. To prevent this from causing a Mamba cache miss, the
            # last chunk must be not smaller than `block_size`.
            block_size = self.cache_config.block_size
            last_cache_position = request.num_tokens - request.num_tokens % block_size
            # eagle prune
            if self.use_eagle:
                last_cache_position = max(last_cache_position - block_size, 0)
            num_computed_tokens_after_sched = num_computed_tokens + num_new_tokens
            if num_computed_tokens_after_sched < last_cache_position:
                # align to block_size
                num_new_tokens = num_new_tokens // block_size * block_size
            elif (
                num_computed_tokens
                < last_cache_position

vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57


def _mamba_block_aligned_split(
    self: Scheduler,
    request: Request,
    num_new_tokens: int,
    num_new_local_computed_tokens: int = 0,
    num_external_computed_tokens: int = 0,
) -> int:
    """Align GLM-Next prefill chunks to complete Mamba state checkpoints.

    In a hybrid cache, ``cache_config.block_size`` can be rewritten to the
    smallest physical block among cache groups. For GLM-Next that can be the
    4-token indexer-state block, while ``self.block_size`` is the resolved
    scheduler/common boundary at which a complete Mamba state is cacheable.
    Other models retain the exact upstream behavior.
    """
    if not _is_glm5_next_model(self.vllm_config.model_config):
        return _ORIGINAL_MAMBA_BLOCK_ALIGNED_SPLIT(
            self,
            request,
            num_new_tokens,
            num_new_local_computed_tokens,
            num_external_computed_tokens,
        )

    num_computed_tokens = (
        request.num_computed_tokens
        + num_new_local_computed_tokens
        + num_external_computed_tokens
    )
    if num_computed_tokens < max(
        request.num_prompt_tokens,
        request.num_tokens - 1,
    ):
        block_size = self.block_size
        last_cache_position = request.num_tokens - request.num_tokens % block_size
        if self.use_eagle:
            last_cache_position = max(last_cache_position - block_size, 0)
        num_computed_tokens_after_sched = num_computed_tokens + num_new_tokens
        if num_computed_tokens_after_sched < last_cache_position:
            num_new_tokens = num_new_tokens // block_size * block_size
        elif (
            num_computed_tokens
            < last_cache_position
            < num_computed_tokens_after_sched
        ):
            num_new_tokens = last_cache_position - num_computed_tokens

    return num_new_tokens

vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L858-L867


        # Get positions.
        cu_num_tokens = self._get_cumsum_and_arange(
            num_scheduled_tokens, self.query_pos.np
        )
        positions_np = self._positions_np_buf[:total_num_scheduled_tokens]
        np.add(
            self.input_batch.num_computed_tokens_cpu[req_indices],
            self.query_pos.np[: cu_num_tokens[-1]],
            out=positions_np,

vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1078-L1099

        num_tokens_np = np.array(num_tokens, dtype=np.int32)
        base_num_reqs = self.input_batch.num_reqs
        num_reqs = base_num_reqs
        tokens_original = None
        if self.pcp_size > 1:
            # while pcp > 1, we need the original num_scheduled_tokens before split
            # to calculate discard_requests_mask
            tokens_original = [scheduler_output.num_scheduled_tokens[i] for i in self.input_batch.req_ids]
            original_seq_lens_np = self.input_batch.num_computed_tokens_cpu[:num_reqs] + np.array(
                tokens_original, dtype=np.int32
            )
            discard_requests_mask = original_seq_lens_np < num_tokens_np
        else:
            discard_requests_mask = self.optimistic_seq_lens_cpu[:num_reqs].numpy() < num_tokens_np

        discard_request_indices = np.nonzero(discard_requests_mask)[0]
        self.num_discarded_requests = len(discard_request_indices)
        self.discard_request_indices.np[: self.num_discarded_requests] = discard_request_indices
        self.discard_request_indices.copy_to_gpu(self.num_discarded_requests)
        
        self.discard_request_mask.np[:num_reqs] = discard_requests_mask
        self.discard_request_mask.copy_to_gpu(num_reqs)

vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1470

    def _build_attn_state(self, num_reqs, num_scheduled_tokens, num_valid_tokens):
        if np.all(self.input_batch.num_computed_tokens_cpu[:num_reqs] == 0):
            attn_state = AscendAttentionState.PrefillNoCache
        # We assume it is the decode stage, where prefill occurs but only one token is not hit in cache.
        elif np.all(num_scheduled_tokens == 1):
            attn_state = AscendAttentionState.DecodeOnly
            if self.speculative_config and self.speculative_config.method == "mtp":
                # SpecDecoding now supports seq_len=1 and seq_len=2
                # In Prefilling Decoding Disaggregation scenario, SpecDecoding need to supports seq_len=1
                attn_state = AscendAttentionState.SpecDecoding
        # Speculative decoding.
        elif np.all(num_valid_tokens == 1):
            if self.speculative_config:
                attn_state = AscendAttentionState.SpecDecoding
            else:
                attn_state = AscendAttentionState.ChunkedPrefill
        # splitfuse
        elif self.scheduler_config.enable_chunked_prefill:
            attn_state = AscendAttentionState.ChunkedPrefill
        else:
            attn_state = AscendAttentionState.PrefillCacheHit

        # For the overlay of the PCP feature and the eagle3, attn_state needs to be recovered
        # TODO: Resolved the conflict between the sunset of attn_state and the PCP that requires this interface.
        if attn_state == AscendAttentionState.SpecDecoding and self.speculative_config.method != "mtp":
            self.attn_state = AscendAttentionState.ChunkedPrefill  # type: ignore
        else:

vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2636

        # TODO: implement PR 28597 from vllm
        discard_sampled_tokens_req_indices = self.discard_request_indices.np[: self.num_discarded_requests]
        for i in discard_sampled_tokens_req_indices:
            gen = self.input_batch.generators.get(int(i))
            if gen is not None:
                gen.set_offset(gen.get_offset() - 4)

vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474

        state_indices: torch.Tensor,
        has_initial_state: torch.Tensor,
        prebuilt_metadata,
    ) -> torch.Tensor:
        if get_pcp_group().world_size > 1:
            raise NotImplementedError("Kimi KDA prefill does not yet support PCP.")
        _require_ascendc_prefill_ops()

        cu_seqlens_kern = prebuilt_metadata.cu_seqlens_kern
        cu_seqlens = prebuilt_metadata.cu_seqlens_host if cu_seqlens_kern is None else cu_seqlens_kern
        keep = prebuilt_metadata.keep_meta
        if keep is not None:
            if keep.numel() != state_indices.shape[0] or keep.numel() != has_initial_state.numel():
                raise ValueError(
                    "Kimi KDA prefill metadata is inconsistent: keep_meta must have "
                    "one entry per uncompressed sequence."
                )
            state_indices = state_indices[keep]
            has_initial_state = has_initial_state[keep]

        num_sequences = (cu_seqlens.numel() if isinstance(cu_seqlens, torch.Tensor) else len(cu_seqlens)) - 1
        if state_indices.shape[0] != num_sequences or has_initial_state.numel() != num_sequences:
            raise ValueError(
                "Kimi KDA prefill metadata is inconsistent: compact cu_seqlens, "
                "state_indices, and has_initial_state must describe the same number of sequences."
            )

        # The recurrent cache uses [H,V,K].  PR141's AscendC prefill operator
        # uses [H,K,V], so transpose only at that operator boundary.
        initial_state_vk = recurrent_state[state_indices].contiguous()
        clear_ssm_states(initial_state_vk, has_initial_state)

        initial_state_kv = initial_state_vk.transpose(-1, -2).contiguous()
        cu_seqlens_ascendc = (
            tuple(cu_seqlens.detach().cpu().tolist()) if isinstance(cu_seqlens, torch.Tensor) else cu_seqlens
        )

        q = l2norm_fwd(q.contiguous())
        k = l2norm_fwd(k.contiguous())

        if self.gate_lower_bound is not None:
            gate_cumsum = torch.ops._C_ascend.kda_gate_cumsum(
                raw_gate.contiguous(),
                _KDA_CHUNK_SIZE,
                A_log=self.A_log.reshape(-1).contiguous(),
                dt_bias=self.dt_bias.contiguous(),
                cu_seqlens=cu_seqlens_ascendc,
                use_gate_in_kernel=True,
                safe_gate=True,
                lower_bound=self.gate_lower_bound,
                layout="BSND",
            )
        else:
            gate = self._recurrent_gate(raw_gate)
            gate_cumsum = torch.ops._C_ascend.kda_gate_cumsum(
                gate.contiguous(),
                _KDA_CHUNK_SIZE,
                cu_seqlens=cu_seqlens_ascendc,
                layout="BSND",
            )

        result = torch.ops._C_ascend.chunk_kda_fwd(
            q,
            k,
            v.contiguous(),
            gate_cumsum,
            beta.contiguous(),
            self.head_dim**-0.5,
            _KDA_CHUNK_SIZE,
            layout="BSND",
            initial_state=initial_state_kv,
            output_final_state=True,
            cu_seqlens=cu_seqlens_ascendc,
            chunk_indices=prebuilt_metadata.chunk_indices_chunk64_host,
            return_intermediate=False,
        )
        recurrent_state[state_indices] = result[1].transpose(-1, -2).contiguous().to(recurrent_state.dtype)

vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L477-L498

        seq_lens = common_attn_metadata.seq_lens[:num_reqs]
        query_lens = query_start_loc[1:] - query_start_loc[:-1]
        hf_config = self.model_config.hf_text_config
        metadata_op = DeviceOperator.get_sparse_attention_metadata_op_indexer_kpool_mla()
        generated_metadata = metadata_op(
            **DeviceOperator.get_sparse_attention_metadata_kwargs_indexer_kpool_mla(query_start_loc.device),
            num_heads_q=hf_config.num_attention_heads // self.vllm_config.parallel_config.tensor_parallel_size,
            num_heads_kv=1,
            head_dim=hf_config.kv_lora_rank,
            cu_seqlens_q=query_start_loc,
            cu_seqlens_ori_kv=None,
            cu_seqlens_cmp_kv=None,
            seqused_q=self._seqused_q,
            seqused_ori_kv=seq_lens,
            seqused_cmp_kv=None,
            cmp_residual_kv=None,
            max_seqlen_q=query_lens.max(),
            max_seqlen_ori_kv=seq_lens.max(),
            max_seqlen_cmp_kv=0,
            batch_size=num_reqs,
            ori_topk=hf_config.index_topk + hf_config.index_kpool - 1,
            cmp_topk=0,

vllm@0fc695fc:docs/configuration/optimization.md#L41-L62

## Chunked Prefill

Chunked prefill allows vLLM to process large prefills in smaller chunks and batch them together with decode requests. This feature helps improve both throughput and latency by better balancing compute-bound (prefill) and memory-bound (decode) operations.

In V1, **chunked prefill is enabled by default whenever possible**. With chunked prefill enabled, the scheduling policy prioritizes decode requests. It batches all pending decode requests before scheduling any prefill operations. When there are available tokens in the `max_num_batched_tokens` budget, it schedules pending prefills. If a pending prefill request cannot fit into `max_num_batched_tokens`, it automatically chunks it.

This policy has two benefits:

- It improves inter-token latency (ITL) and generation decode because decode requests are prioritized.
- It helps achieve better GPU utilization by locating compute-bound (prefill) and memory-bound (decode) requests to the same batch.

### Performance Tuning with Chunked Prefill

You can tune the performance by adjusting `max_num_batched_tokens`:

- Smaller values (e.g., 2048) achieve better ITL because there are fewer prefills slowing down decodes.
- Higher values achieve better time to first token (TTFT) as you can process more prefill tokens in a batch.
- For optimal throughput, we recommend setting `max_num_batched_tokens > 8192` especially for smaller models on large GPUs.
- If `max_num_batched_tokens` is the same as `max_model_len`, that's almost the equivalent to the V0 default scheduling policy (except that it still prioritizes decodes).

!!! warning
    When chunked prefill is disabled, `max_num_batched_tokens` must be greater than `max_model_len`.  

vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374

            if cache_config.mamba_cache_mode == "align":
                assert vllm_config.scheduler_config.enable_chunked_prefill, (
                    "Chunked prefill is required for mamba cache mode 'align'."
                )

vllm-ascend@2c59ff10:vllm_ascend/platform.py#L713-L718

        if ascend_config.SLO_limits_for_dynamic_batch != -1:
            vllm_config.scheduler_config.scheduler_cls = (
                "vllm_ascend.core.scheduler_dynamic_batch.SchedulerDynamicBatch"
            )
            vllm_config.scheduler_config.enable_chunked_prefill = True
            vllm_config.scheduler_config.SLO_limits_for_dynamic_batch = ascend_config.SLO_limits_for_dynamic_batch

vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L467

        # DP prefill balancing: on a throttled (non-cadence-aligned) step, defer
        # all prefill compute unless saturated.
        defer_prefills = (
            throttle_prefills and not self.prefill_capacity_bound
        ) and any(not r.is_prefill_chunk for r in self.running)

vllm@568afb3a:vllm/config/scheduler.py#L153-L156

    prefill_schedule_interval: int = Field(default=1, ge=1)
    """For data-parallel deployments, only admit new prefill requests
    once every N engine steps, aligned across DP ranks, to better balance
    per-step forward-pass times."""

vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1026-L1076

                elif defer_prefills and num_computed_tokens < request.num_tokens - 1:
                    # DP prefill balancing: defer this step's local prefill
                    # compute to a cadence-aligned step.
                    break
                else:
                    request_token_budget = min(token_budget, input_budget - draft_slots)
                    # Number of tokens to be scheduled.
                    # We use `request.num_tokens` instead of
                    # `request.num_prompt_tokens` to consider the resumed
                    # requests, which have output tokens.
                    num_new_tokens = request.num_tokens - num_computed_tokens

                    # Pad new decode requests to uniform spec decoding size to
                    # preserve full cudagraph for this step.
                    # Not for diffusion where draft tokens can't be padded.
                    if (
                        (self.num_spec_tokens > 0 and self.dynamic_sd_lookup is None)
                        and self.num_sampled_tokens_per_step > 0
                        and num_new_tokens == 1
                        and not prefill_scheduled
                        and (scheduled_running_reqs or num_computed_tokens > 0)
                    ):
                        padded_num_tokens = 1 + self.num_spec_tokens
                        # Pad only when there is room for the sampled token(s).
                        if (
                            num_computed_tokens
                            + padded_num_tokens
                            + self.num_sampled_tokens_per_step
                            <= self.max_model_len
                        ):
                            if padded_num_tokens > request_token_budget:
                                # Prefer to not schedule than schedule un-padded.
                                break
                            num_new_tokens = padded_num_tokens
                            pad_spec_decode = True

                    threshold = self.scheduler_config.long_prefill_token_threshold
                    if 0 < threshold < num_new_tokens:
                        num_new_tokens = threshold

                    # chunked prefill has to be enabled explicitly to allow
                    # pooling requests to be chunked
                    if (
                        not self.scheduler_config.enable_chunked_prefill
                        and num_new_tokens > request_token_budget
                    ):
                        # If chunked_prefill is disabled,
                        # we can stop the scheduling here.
                        break

                    num_new_tokens = min(num_new_tokens, request_token_budget)

vllm@84030bbe:vllm/config/speculative.py#L1811-L1850

    @property
    def max_num_new_slots_for_drafting(self) -> int:
        """Return the maximum additional drafting slots per request.

        The scheduler budget already includes one query slot per decoding request.
        Let K be ``num_speculative_tokens``. Standard configurations require:

        ==================== ============= ======== ================
        Algorithm            Method        Parallel Additional slots
        ==================== ============= ======== ================
        EAGLE3               eagle3        No       0
        P-EAGLE              eagle3        Yes      K - 1
        DFlash               dflash        Yes      K
        DSpark               dspark        Yes      K - 1
        MTP                  mtp           No       0
        N-gram               ngram         No       0
        Draft model          draft_model   No       1
        PARD                 draft_model   Yes      K
        ==================== ============= ======== ================
        """
        num_draft_tokens = self.num_speculative_tokens

        if self.use_dflash():
            # DFlash uses one bonus query followed by K mask queries.
            return num_draft_tokens

        if self.parallel_drafting:
            if self.uses_draft_model():
                # PARD does not shift the existing input, so all K query
                # positions require additional slots.
                return num_draft_tokens

            # The existing query is reused; only masked queries need new slots.
            return num_draft_tokens - 1

        if self.uses_draft_model():
            # The autoregressive draft-model input retains one unsliced token.
            return 1

        return 0

vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L188

Chunked prefill, prefix caching, and request preemption (eviction and recomputation) are not supported with batch invariance.

These scheduling features are not disabled automatically. You must explicitly disable chunked prefill and prefix caching in your configuration, and pair the chunked prefill disabling with a KV cache block size of 128 — pass `--block-size 128` together with `--no-enable-chunked-prefill` when starting the server, or `block_size=128` together with `enable_chunked_prefill=False` for offline inference — as shown in the examples above.

vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1350

    def _build_attn_state(self, num_reqs, num_scheduled_tokens, num_valid_tokens):
        if np.all(self.input_batch.num_computed_tokens_cpu[:num_reqs] == 0):
            attn_state = AscendAttentionState.PrefillNoCache
        # We assume it is the decode stage, where prefill occurs but only one token is not hit in cache.
        elif np.all(num_scheduled_tokens == 1):
            attn_state = AscendAttentionState.DecodeOnly
            if self.speculative_config and self.speculative_config.method == "mtp":
                # SpecDecoding now supports seq_len=1 and seq_len=2
                # In Prefilling Decoding Disaggregation scenario, SpecDecoding need to supports seq_len=1
                attn_state = AscendAttentionState.SpecDecoding
        # Speculative decoding.
        elif np.all(num_valid_tokens == 1):
            if self.speculative_config:
                attn_state = AscendAttentionState.SpecDecoding
            else:
                attn_state = AscendAttentionState.ChunkedPrefill
        # splitfuse
        elif self.scheduler_config.enable_chunked_prefill:
            attn_state = AscendAttentionState.ChunkedPrefill
        else:
            attn_state = AscendAttentionState.PrefillCacheHit

        if attn_state == AscendAttentionState.SpecDecoding and self.speculative_config.method != "mtp":
            self.attn_state = AscendAttentionState.ChunkedPrefill  # type: ignore

vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225

    if cache_config.enable_prefix_caching and cache_config.mamba_cache_mode == "align":
        cache_config.mamba_block_size = cache_config.block_size
    else:
        cache_config.mamba_block_size = model_config.max_model_len

vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433

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

    if model_config.hf_config.model_type == "deepseek_v4":
        if cache_config.block_size is None:
            cache_config.block_size = 32
        elif cache_config.block_size not in [32, 64, 128]:
            logger.warning(
                "For deepseek_v4 model, block size should be 32, 64 or 128. "
                "Setting block size to 32 for better performance."
            )
            cache_config.block_size = 32
        return

    if model_config.is_hybrid:
        # Hybrid attention+mamba models rely on the model-specific sizing
        # logic rather than the generic platform default.
        return

    if cache_config.block_size != 128:
        if cache_config.enable_prefix_caching or scheduler_config.enable_chunked_prefill:
            logger.info("Block size is set to 128 if prefix cache or chunked prefill is enabled.")
            cache_config.block_size = 128
            return