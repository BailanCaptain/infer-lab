vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L1633

    fused_op_type: str = "none"

vllm-ascend@b64b4d714484feaa6ca71edc99b98318fe6d2f0d:vllm_ascend/ascend_config.py#L1634

    fused_op_type: str = "none"

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1630

    fused_op_type: str = "none"

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1628-L1634

    # Generalized Q1/MTP LIM + copy-SFA. The C8 operator is built separately
    # but is not selected by this serving path.
    fused_op_type: str = "none"

    @property
    def use_fused_copy_sfa(self) -> bool:
        return self.fused_op_type == "fused_copy_sfa"

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1638-L1641

        if self.fused_op_type not in ("none", "fused_copy_sfa"):
            raise ValueError("sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa")
        if self.use_fused_copy_sfa and self.use_fused_overlap:
            raise ValueError("fused_copy_sfa and use_fused_overlap are mutually exclusive")

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1689-L1700

        if self.use_fused_copy_sfa:
            if vllm_config.speculative_config and vllm_config.speculative_config.method == "dspark":
                raise ValueError("fused_copy_sfa does not support DSpark speculative decoding")
            width = 1 + (vllm_config.speculative_config.num_speculative_tokens if vllm_config.speculative_config else 0)
            if self.topk != 2048 or not 1 <= width <= 7:
                raise ValueError("fused_copy_sfa serving requires TopK=2048 and 1–7 query rows per request")
            if not width * self.topk <= self.topk_buffer_size <= 16256 or self.topk_buffer_size % 256:
                raise ValueError(
                    "fused_copy_sfa hot budget must be 256-aligned in [Q_max*2048, 16128]: "
                    "the dense short-sequence layout only lines up with the circular "
                    "tail slots when topk_buffer_size is a multiple of 256"
                )

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1658-L1660

    def _validate_preconditions(self, vllm_config: VllmConfig) -> None:
        if not self.enabled:
            return

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L269-L273

        metadata.fused_copy_sfa_enabled = (
            self.use_fused_copy_sfa
            and (num_prefills == 0 or common_attn_metadata.offload_dummy)
            and 1 <= common_attn_metadata.max_query_len <= 7
        )

vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L1047-L1054

    def __init__(self, vllm_config: "VllmConfig", user_config: dict[str, Any]):
        self.enabled = bool(user_config.get("enabled", False))
        if not self.enabled:
            return

        self.topk_buffer_size = int(user_config.get("topk_buffer_size", 4096))
        self.dram_size_per_dp_GB = int(user_config.get("dram_size_per_dp_GB", 128))
        self.keep_device_kv_cache = bool(user_config.get("keep_device_kv_cache", False))

vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1494

        config = cls(**user_config)  # type: ignore[call-arg]

vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43

    merged_config = ConfigDict(extra="forbid")

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L647-L650

        if self.use_fused_copy_sfa and attn_metadata is not None and not attn_metadata.fused_copy_sfa_enabled:
            # Attention metadata preparation invalidates residency history
            # once for fallback execution; only layer-local TopK reuse resets here.
            self.lim_reuse_request_count = 0

vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L1695

    fused_op_type: str = "none"

vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L1671

    fused_op_type: str = "none"

vllm-ascend@8194eceae4a86366bea75309baa22fea4993da8a:vllm_ascend/ascend_config.py#L1675

    fused_op_type: str = "none"

vllm-ascend@4ebb3090:vllm_ascend/worker/model_runner_v1.py#L3906-L4162

    def _dummy_run(
        self,
        num_tokens: int,
        with_prefill: bool = False,
        cudagraph_runtime_mode: CUDAGraphMode | None = None,
        force_attention: bool = False,
        uniform_decode: bool = False,
        is_profile: bool = False,
        create_mixed_batch: bool = False,
        allow_microbatching: bool = True,
        skip_eplb: bool = False,
        remove_lora: bool = True,
        is_graph_capturing: bool = False,
        num_active_loras: int = 0,
        profile_seq_lens: int | None = None,
        profile_cpp: bool = False,
        skip_gdn_state_update: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        mm_config = self.vllm_config.model_config.multimodal_config
        if mm_config and mm_config.mm_encoder_only:
            # The current dummy run only covers LM execution, so we can skip it.
            # mm encoder dummy run may need to add in the future.
            return torch.tensor([]), torch.tensor([])

        # only support eager mode and piecewise graph now
        assert cudagraph_runtime_mode is None or cudagraph_runtime_mode.valid_runtime_modes()
        # If cudagraph_mode.decode_mode() == FULL and
        # cudagraph_mode.separate_routine(). This means that we are using
        # different graphs and/or modes for mixed prefill-decode batches vs.
        # uniform decode batches. A uniform decode batch means that all
        # requests have identical query length, except a potential virtual
        # request (shorter) in the batch account for padding.
        # Uniform decode batch could either be common pure decode, where
        # max_query_len == 1, or speculative decode, where
        # max_query_len == 1 + num_spec_decode_tokens.

        # When setting max_query_len = 1, we switch to and capture the optimized
        # routine of FA2 for pure decode, i.e., Flashdecode + an optimization
        # for GQA/MQA.
        max_query_len = self.uniform_decode_query_len if uniform_decode else num_tokens
        # Set num_scheduled_tokens based on num_tokens and max_num_seqs
        # for dummy run with LoRA so that the num_reqs collectively
        # has num_tokens in total.
        assert num_tokens <= self.scheduler_config.max_num_batched_tokens
        max_num_reqs = self.scheduler_config.max_num_seqs
        if create_mixed_batch:
            raise NotImplementedError("create_mixed_batch is used for warmup deepgemm, vllm-ascend does not need it")
        elif uniform_decode:
            num_reqs = min(max_num_reqs, cdiv(num_tokens, max_query_len))
            num_scheduled_tokens_list = [max_query_len] * num_reqs
            if num_tokens % max_query_len != 0:
                num_scheduled_tokens_list[-1] = num_tokens % max_query_len
        elif profile_cpp:
            num_reqs = 1
            num_scheduled_tokens_list = [num_tokens] * num_reqs
        else:
            num_reqs = min(num_tokens, max_num_reqs)
            min_tokens_per_req = num_tokens // num_reqs
            num_scheduled_tokens_list = [min_tokens_per_req] * num_reqs
            num_scheduled_tokens_list[-1] += num_tokens % num_reqs
        assert sum(num_scheduled_tokens_list) == num_tokens
        assert len(num_scheduled_tokens_list) == num_reqs

        if not is_profile and self.dynamic_eplb:
            self.eplb_updator.forward_before()

        num_scheduled_tokens = np.array(num_scheduled_tokens_list, dtype=np.int32)
        self.query_lens = torch.from_numpy(num_scheduled_tokens)
        num_tokens_unpadded = int(num_scheduled_tokens.sum())
        num_sampled_tokens = np.ones(num_reqs, dtype=np.int32)
        _cudagraph_mode, batch_desc, _, num_tokens_across_dp, _ = self._determine_batch_execution_and_padding(
            num_tokens=num_tokens_unpadded,
            num_reqs=num_reqs,
            num_scheduled_tokens_np=num_scheduled_tokens,
            max_num_scheduled_tokens=max_query_len,
            use_cascade_attn=False,
            allow_microbatching=allow_microbatching,
            force_eager=is_profile or (cudagraph_runtime_mode == CUDAGraphMode.NONE) or profile_cpp,
            # `force_uniform_decode` is used for cudagraph capture; because for
            # capturing mixed prefill-decode batches, we sometimes use
            # num_tokens == num_reqs which looks like a uniform decode batch to the
            # dispatcher; but we actually want to capture a piecewise cudagraph
            force_uniform_decode=uniform_decode,
            # `force_has_lora` is used for cudagraph capture; because LoRA is
            # activated later in the context manager, but we need to know the
            # LoRA state when determining the batch descriptor for capture
            force_has_lora=num_active_loras > 0,
            force_num_active_loras=num_active_loras,
        )
        dcp_dummy_metadata = None
        if cudagraph_runtime_mode is None:
            cudagraph_runtime_mode = _cudagraph_mode
        else:
            assert cudagraph_runtime_mode == _cudagraph_mode, (
                f"Cudagraph runtime mode mismatch in dummy_run. "
                f"Expected {_cudagraph_mode}, but got {cudagraph_runtime_mode}."
            )
        num_tokens_padded = batch_desc.num_tokens
        num_reqs_padded = batch_desc.num_reqs if batch_desc.num_reqs is not None else num_reqs
        if num_tokens_across_dp is not None and num_tokens_padded != num_tokens:
            # pad is needed if the pad of `num_tokens` is triggered inside CudagraphDispatcher
            if _cudagraph_mode == CUDAGraphMode.NONE:
                # Preserve the eager DP dummy-run contract used by legacy DSA
                # CP. Graph-only padding below must not turn its replicated
                # request metadata into an empty request on idle DP ranks.
                num_scheduled_tokens = num_scheduled_tokens.repeat(num_reqs_padded)
            else:
                # Requests added by CudagraphDispatcher have zero query length.
                num_scheduled_tokens = np.pad(num_scheduled_tokens, (0, num_reqs_padded - num_reqs))

        if self.dynamic_eplb:
            self.update_eplb_heat_collection_status(num_tokens_padded, num_tokens_across_dp)

        # vllm-ascend does not support ubatch now
        ubatch_slices, ubatch_slices_padded = None, None
        attn_metadata: PerLayerAttnMetadata | None = None
        # _dummy_run shares pinned CPU buffers (seq_lens, query_start_loc,
        # gdn_query_start_loc, etc.) with execute_model. It must participate in
        # the same event protocol so that back-to-back dummy/real steps don't
        # overwrite pinned memory while a prior non_blocking H2D DMA is still
        # reading. Mirrors upstream gpu_model_runner._dummy_run.
        with self.synchronize_input_prep():
            # Build attention metadata for dummy_run
            if self._should_build_dummy_attn_metadata(force_attention, is_profile, cudagraph_runtime_mode):
                if create_mixed_batch:
                    raise NotImplementedError(
                        "create_mixed_batch is used for warmup deepgemm, vllm-ascend does not need it"
                    )
                self.attn_state = AscendAttentionState.DecodeOnly
                if self.speculative_config and self.speculative_config.method == "mtp":
                    # `AscendAttentionState.SpecDecoding` is only designed for mla
                    if self.vllm_config.model_config.use_mla:
                        self.attn_state = AscendAttentionState.SpecDecoding
                    else:
                        self.attn_state = AscendAttentionState.ChunkedPrefill
                # The reason why we use a fixed seq_len rather than max_query_len is that
                # _npu_paged_attention_get_workspace only returns max workspace with specific
                # seq_lens. We use this seq_len only when capturing graph, and still use max_query_len
                # in inference. This will be removed once npu_fused_infer_attention_score
                # outperforms _npu_paged_attention on all cases.
                if profile_seq_lens is not None:
                    seq_lens = profile_seq_lens
                else:
                    seq_lens = (
                        SEQ_LEN_WITH_MAX_PA_WORKSPACE
                        if is_graph_capturing and using_paged_attention(num_tokens, self.vllm_config)
                        else max_query_len
                    )  # type: ignore[assignment]

                if self.use_dcp:
                    dcp_dummy_metadata = (
                        self.dcp_manager.prepare_dummy_run_metadata(
                            num_scheduled_tokens=num_scheduled_tokens,
                            num_reqs=num_reqs,
                            seq_len=int(seq_lens),
                            num_computed_tokens=(
                                self.input_batch.num_computed_tokens_cpu
                            ),
                            num_prompt_tokens=self.input_batch.num_prompt_tokens,
                            uniform_decode=uniform_decode,
                        )
                    )
                    if dcp_dummy_metadata is not None:
                        seq_lens = dcp_dummy_metadata.seq_len

                self.optimistic_seq_lens_cpu[:num_reqs] = seq_lens
                self.optimistic_seq_lens_cpu[num_reqs:].fill_(0)
                self.seq_lens.copy_(self.optimistic_seq_lens_cpu, non_blocking=True)

                cum_num_tokens = self._get_cumsum_and_arange(
                num_scheduled_tokens, self.query_pos.np)
                self.query_start_loc.np[1 : num_reqs_padded + 1] = cum_num_tokens
                self.query_start_loc.copy_to_gpu()
                if self._has_gdn:
                    if skip_gdn_state_update:
                        self.gdn_query_start_loc.np.fill(0)
                    else:
                        self.gdn_query_start_loc.np[
                            1 : num_reqs_padded + 1
                        ] = cum_num_tokens
                    self.gdn_query_start_loc.copy_to_gpu()

                if not profile_cpp:
                    num_reqs_padded = self._pad_query_start_loc_for_fia(
                        self.query_start_loc,
                        num_tokens_padded,
                        num_reqs_padded,
                        num_reqs,
                        cudagraph_runtime_mode,
                        batch_desc.num_reqs,
                    )

                # Dummy graph runs do not go through _prepare_inputs(), but GDN/Mamba
                # metadata reads block_table[:num_reqs_padded] below. Sync padded
                # rows as well so device-side metadata does not see stale block ids.
                # Dummy requests bypass scheduler allocation. Give each active
                # request a distinct non-null state ID before metadata/capture.
                for gid, group in enumerate(self.kv_cache_config.kv_cache_groups):
                    if skip_gdn_state_update or not is_circular_kv_cache_spec(group.kv_cache_spec):
                        continue
                    table = self.input_batch.block_table[gid]
                    table.block_table.np[:num_reqs_padded].fill(0)
                    table.block_table.np[:num_reqs, 0] = np.arange(1, num_reqs + 1)
                    context = self.compilation_config.static_forward_context
                    for name in group.layer_names:
                        context[name].kv_cache[0][1:num_reqs + 1].zero_()
                self.input_batch.block_table.commit_block_table(num_reqs_padded)

                # Invalidate real-request slots before attention backends derive
                # or copy their backend-specific metadata for dummy execution.
                if not is_graph_capturing:
                    for kv_cache_gid in range(len(self.kv_cache_config.kv_cache_groups)):
                        blk_table = self.input_batch.block_table[kv_cache_gid]
                        blk_table.slot_mapping.gpu.fill_(-1)
                else:
                    for kv_cache_gid, group in enumerate(self.kv_cache_config.kv_cache_groups):
                        group_spec = group.kv_cache_spec
                        if not isinstance(
                            group_spec, UniformTypeKVCacheSpecs
                        ) or not is_deepseek_v41_cache(self.kv_cache_config.kv_cache_groups):
                            continue
                        # V4.1 derives backend-specific 2D slot mappings from
                        # this buffer. Dummy capture has no scheduler-owned
                        # slots, so stale active entries must not write caches.
                        blk_table = self.input_batch.block_table[kv_cache_gid]
                        blk_table.slot_mapping.gpu[:num_tokens_padded].fill_(-1)

                pad_attn = cudagraph_runtime_mode == CUDAGraphMode.FULL
                # check how to build dummy
                if self.use_compress:
                    self.positions.fill_(127)
                    self._dsa_positions_cpu_buf.fill_(127)
                elif self.uses_positions_for_attention:
                    # A dummy batch reports seq_lens == max_query_len but leaves
                    # self.positions holding the previous real step's values.
                    # Sparse attention backends derive each token's visible
                    # history from positions, so an idle rank plans for a history
                    # the dummy sequence lengths do not describe, and the ACL
                    # Graph replay that follows consumes that inconsistent plan.
                    # Dense and MLA backends address from seq_lens and the block
                    # table instead, so they are left untouched.
                    self.positions[:num_tokens_padded].fill_(0)
                attn_metadata, _ = self._build_attention_metadata(
                    num_tokens=num_tokens_unpadded,
                    num_tokens_padded=num_tokens_padded,
                    num_reqs=num_reqs,
                    num_reqs_padded=num_reqs_padded,
                    max_query_len=max_query_len,
                    ubatch_slices=ubatch_slices_padded if pad_attn else ubatch_slices,
                    for_cudagraph_capture=is_graph_capturing,
                    offload_dummy=True,
                    num_scheduled_tokens_np=num_scheduled_tokens,
                    dcp_dummy_metadata=dcp_dummy_metadata,
                    cudagraph_runtime_mode=cudagraph_runtime_mode,
                    batch_descriptor=batch_desc,
                    skip_gdn_state_update=skip_gdn_state_update,
                )

vllm-ascend@4ebb3090:vllm_ascend/spec_decode/llm_base_proposer.py#L743-L846

    def dummy_run(
        self,
        num_tokens: int,
        with_prefill: bool = False,
        in_graph_capturing: bool = False,
        num_reqs: int = 0,
        num_tokens_across_dp: torch.Tensor | None = None,
        aclgraph_runtime_mode: CUDAGraphMode = CUDAGraphMode.NONE,
        batch_descriptor=None,
        dummy_compute_logits=lambda hidden_states: None,
        is_profile=False,
    ):
        (
            num_tokens,
            num_tokens_across_dp,
            _,
        ) = self.runner._sync_metadata_across_dp(num_tokens, is_draft_model=True)
        dcp_manager = getattr(self.runner, "dcp_manager", None)

        multi_steps_attn_metadata = []
        if not self.use_cuda_graph:
            aclgraph_runtime_mode = CUDAGraphMode.NONE

        # init block table tensor clone is only available after profile run and is only used for graph mode
        if self.dcp_size > 1 and self.use_cuda_graph and not is_profile and self.block_table_tensor_clone is None:
            self.block_table_tensor_clone = torch.zeros(
                (
                    self.runner.max_num_tokens + 2 * self.runner.max_num_reqs,
                    self.runner.input_batch.block_table[0].get_device_tensor().shape[1],
                ),
                dtype=torch.int32,
                device=self.device,
                pin_memory=self.runner.pin_memory,
            )

        # dummy_run shares pinned CPU buffer (query_start_loc, etc.) with
        # execute_model. It must participate in the same event protocol so that
        # back-to-back dummy/real steps don't overwrite pinned memory while a
        # prior non_blocking H2D DMA is still reading. Mirrors upstream
        # gpu_model_runner._dummy_run.
        with self.runner.synchronize_input_prep():
            if aclgraph_runtime_mode == CUDAGraphMode.FULL and len(self.runner.attn_groups) > 0:
                num_computed_tokens_cpu = self.runner.input_batch.num_computed_tokens_cpu_tensor[:num_reqs]

                # num_reqs is already the padded version
                self.query_start_loc.cpu[: num_reqs + 1].copy_(self.runner.query_start_loc.cpu[: num_reqs + 1])
                self.query_start_loc.copy_to_gpu()
                if self.runner._offload_pool_slots is not None:
                    assert self.runner._offload_pool_active is not None
                    prepare_copy_sfa_dummy_slots(
                        self.runner._offload_pool_slots.np,
                        self.runner._offload_pool_active.np,
                        num_reqs,
                    )
                    self.runner._copy_sfa_need_eager_tail_restore = False
                req_ids_tensor, token_to_req = prepare_sparse_kv_offload_mtp_dummy_metadata(
                    num_tokens,
                    num_reqs,
                    self.query_start_loc.cpu,
                    self.runner._offload_req_ids_tensor,
                    self.runner._offload_token_to_req,
                )

                common_attn_metadata = AscendCommonAttentionMetadata(
                    query_start_loc=self.query_start_loc.gpu[: num_reqs + 1],
                    query_start_loc_cpu=self.query_start_loc.cpu[: num_reqs + 1],
                    seq_lens_cpu=self.runner.optimistic_seq_lens_cpu,
                    _seq_lens_cpu=self.runner.optimistic_seq_lens_cpu,
                    seq_lens_cpu_upper_bound=self.runner.optimistic_seq_lens_cpu,
                    seq_lens=self.runner.seq_lens[:num_reqs],
                    num_reqs=num_reqs,
                    num_actual_tokens=num_tokens,
                    num_input_tokens=num_tokens,
                    max_query_len=self.num_speculative_tokens + 1,
                    num_computed_tokens_cpu=num_computed_tokens_cpu,
                    actual_seq_lengths_q=self.runner.actual_seq_lengths_q,
                    block_table_tensor=self.runner.input_batch.block_table[self.kv_cache_gid].get_device_tensor()[
                        :num_reqs
                    ],
                    # This is used to hold a position.
                    slot_mapping=self.runner.input_batch.block_table[self.kv_cache_gid].slot_mapping.gpu,
                    positions=self.runner.positions,
                    positions_cpu=self.runner._dsa_positions_cpu_buf if self.use_compress else None,
                    attn_state=self.runner.attn_state,
                    decode_token_per_req=self.runner.decode_token_per_req,
                    is_prefilling=torch.zeros(num_reqs, dtype=torch.bool),
                    max_seq_len=0,
                    group_len=self.runner.group_len.gpu[:num_reqs],
                    group_key_idx=self.runner.group_key_idx.gpu[:num_reqs],
                    group_key_cache_idx=self.runner.group_key_cache_idx.gpu[:num_reqs],
                    req_topk_buffer_slots=(
                        self.runner._offload_pool_slots.cpu[:num_reqs]
                        if self.runner._offload_pool_slots is not None
                        else None
                    ),
                    req_topk_buffer_active=(
                        self.runner._offload_pool_active.cpu[:num_reqs]
                        if self.runner._offload_pool_active is not None
                        else None
                    ),
                    offload_dummy=True,
                    req_ids_tensor=req_ids_tensor,
                    token_to_req=token_to_req,
                )

vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L645-L650

        self._current_layer_name = layer_name
        self._copy_sfa_metadata = attn_metadata
        if self.use_fused_copy_sfa and attn_metadata is not None and not attn_metadata.fused_copy_sfa_enabled:
            # Attention metadata preparation invalidates residency history
            # once for fallback execution; only layer-local TopK reuse resets here.
            self.lim_reuse_request_count = 0

vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1693-L1716

    enabled: bool = False
    topk_buffer_size: int = 4096
    dram_size_per_dp_GB: int = 128
    keep_device_kv_cache: bool = False
    topk: int = dataclasses.field(default=0, init=False)
    use_fused_overlap: bool = False
    # Generalized Q1/MTP LIM + copy-SFA. The C8 operator is built separately
    # but is not selected by this serving path.
    fused_op_type: str = "none"

    @property
    def use_fused_copy_sfa(self) -> bool:
        return self.fused_op_type == "fused_copy_sfa"

    @model_validator(mode="after")
    def _validate_values(self):
        if self.fused_op_type not in ("none", "fused_copy_sfa"):
            raise ValueError("sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa")
        if self.use_fused_copy_sfa and self.use_fused_overlap:
            raise ValueError("fused_copy_sfa and use_fused_overlap are mutually exclusive")
        if self.topk_buffer_size <= 0:
            raise ValueError("sparse_kv_offload_config.topk_buffer_size must be positive")
        if self.dram_size_per_dp_GB <= 0:
            raise ValueError("sparse_kv_offload_config.dram_size_per_dp_GB must be positive")

vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L68-L95

LIM_TOPK = 2048
LIM_MAX_QUERY_ROWS = 14
LIM_MAX_HOT_TOKENS = 32640
LIM_CACHE_BLOCK_SIZE = 128

# Copy-SFA's two-block circular tail requires stronger alignment than LIM.
COPY_SFA_TAIL_BLOCKS = 2
COPY_SFA_TAIL_TOKENS = COPY_SFA_TAIL_BLOCKS * LIM_CACHE_BLOCK_SIZE


def _validate_fused_copy_sfa_config(vllm_config: VllmConfig, cfg: SparseKVOffloadConfig) -> None:
    """Check kernel and circular-tail bounds before allocating fused buffers."""
    if not cfg.use_fused_copy_sfa:
        return
    speculative = vllm_config.speculative_config
    width = 1 + (speculative.num_speculative_tokens if speculative else 0)
    if cfg.topk != LIM_TOPK or not 1 <= width <= LIM_MAX_QUERY_ROWS:
        raise ValueError(f"fused_copy_sfa requires TopK={LIM_TOPK} and 1–{LIM_MAX_QUERY_ROWS} query rows per request")
    if (
        not width * cfg.topk <= cfg.topk_buffer_size <= LIM_MAX_HOT_TOKENS
        or cfg.topk_buffer_size % COPY_SFA_TAIL_TOKENS
    ):
        raise ValueError(
            f"fused_copy_sfa hot budget must be {COPY_SFA_TAIL_TOKENS}-aligned "
            f"in [Q_max*{LIM_TOPK}, {LIM_MAX_HOT_TOKENS}]: "
            "the dense short-sequence layout only lines up with the circular "
            f"tail slots when topk_buffer_size is a multiple of {COPY_SFA_TAIL_TOKENS}"
        )

vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L1625-L1627

        if attn_metadata.fused_copy_sfa_enabled:
            result = self._copy_sfa_attention(ql_nope, q_pe, topk_indices, attn_metadata, manager, layer_name)
            return self._pad_to_input_tokens(result, ql_nope.shape[0])

vllm-ascend@7d825229:vllm_ascend/worker/v2/model_runner.py#L372-L388

        # transfer. It must never alias target layerwise scratch buffers.
        persistent_draft_names = resident_draft_names | set(getattr(kv_cache_config, "dspark_draft_layer_names", ()))
        apply_layerwise_kv_cache_plan(kv_cache_config, self.vllm_config, excluded_layer_names=persistent_draft_names)
        if sparse_cfg.enabled:
            self.sparse_kv_offload_manager = init_sparse_kv_offload_manager(
                self.vllm_config, kv_cache_config, sparse_cfg
            )
            self.model_state._offload_live_req_ids = self.req_states.req_id_to_index
            self.model_state._offload_draft_layer_names = (
                getattr(self.speculator, "draft_attn_layer_names", set[str]()) - resident_draft_names
                if sparse_cfg.use_fused_copy_sfa
                else set()
            )
        with graph_manager_wrapper(self):
            super().initialize_kv_cache(
                kv_cache_config,
                kv_cache_allocation_context=kv_cache_allocation_context,

vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L1701

    fused_op_type: str = "none"

vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L719-L747

        request_state = metadata.lim_request_state
        prefix = metadata.copy_sfa_prefix_lens
        cache = metadata.copy_sfa_cache_tokens
        index_cache = indexer.k_cache.kv_cache[INDEXER_K_CACHE_SLOT].view(-1, 128, 1, 128)
        table = indexer_metadata.block_table[:count].contiguous()
        if indexer.enable_sparse_li_c8:
            n_head = indexer.n_head
            assert query_scale is not None, "C8 LIM requires query_dequant_scale from the indexer"
            key_scale = indexer.k_cache.kv_cache[INDEXER_SCALE_CACHE_SLOT]
            if key_scale.dim() == 4:
                key_scale = key_scale.squeeze(2)
            key_scale = key_scale.reshape(index_cache.shape[0], 128, 1)
            torch.ops._C_ascend.npu_fused_quant_lightning_indexer_manage(
                weights[:tokens].contiguous(),
                query_scale.view(-1, n_head)[:tokens].contiguous(),
                query.view(-1, n_head, 128)[:tokens].contiguous(),
                key_scale.contiguous(),
                index_cache,
                table,
                metadata.copy_sfa_query_ends,
                metadata.copy_sfa_seq_lens,
                prefix,
                cache,
                request_state,
                metadata.copy_sfa_pool_entries,
                self.lim_slot_map,
                self.lim_topk_src[:tokens],
                self.lim_topk_dst[:tokens],
                self.lim_topk_misses[:tokens],

vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1757-L1764

        speculative = getattr(vllm_config, "speculative_config", None)
        if (
            speculative is not None
            and speculative.method == "dspark"
            and not getattr(vllm_config, "use_v2_model_runner", False)
        ):
            # Only V2 initializes the resident draft KV from remote prompt context.
            raise ValueError("Sparse KV offload with DSpark requires V2 remote prompt-context initialization")

vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L166

LIM C8 uses `npu_fused_quant_lightning_indexer_manage`, which is included on
this branch. Enable it with `--attention_config.indexer_kv_dtype int8`. The
indexer then Hadamard-rotates and int8-quantizes query and key, and
`_lim_select` forwards that int8 query and the fp16 dequant scales to the C8
LIM. The 19-parameter management ABI matches BF16 LIM, so Copy-SFA and miss H2D
stay unchanged. The C8 kernel is int8-only; `indexer_kv_dtype fp8` is not a
LIM C8 serving path.

vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L320-L342

The fused path has these additional requirements:

- The model must use `index_topk=2048` and a cache block size of `128`.
- Let `Q_max = 1 + num_speculative_tokens`, or `1` without speculative decoding.
  `Q_max` must be between `1` and `14`.
- `topk_buffer_size` must be a multiple of `256`, at least `Q_max * 2048`,
  and at most `32512` (the largest aligned value within LIM's `32640` limit).
  The runtime allocates two additional tail blocks;
  do not add them to this setting.
- Keep `use_fused_overlap=false`; it cannot be combined with `fused_copy_sfa`.
- Use BF16 for the main KV cache. Sparse SFA C8 is not supported.
  Sparse LI C8 serving is supported for the device-resident indexer:
  add `--attention_config.indexer_kv_dtype int8` so fused Copy-SFA
  selects `npu_fused_quant_lightning_indexer_manage`.

| Draft tokens | `Q_max` | Minimum `topk_buffer_size` |
| :--- | :--- | :--- |
| No speculative decoding | 1 | 2048 |
| MTP1 | 2 | 4096 |
| MTP2 | 3 | 6144 |
| MTP3 | 4 | 8192 |
| MTP5 | 6 | 12288 |
| DSpark8 | 9 | 18432 |