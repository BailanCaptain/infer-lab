vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L124-L130

class KVConnectorRole(enum.Enum):
    # Connector running in the scheduler process
    SCHEDULER = 0

    # Connector running in the worker process
    WORKER = 1


vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L251-L375

    def register_kv_caches(self, kv_caches: dict[str, torch.Tensor]):
        """
        Initialize with the KV caches. Useful for pre-registering the
        KV Caches in the KVConnector (e.g. for NIXL).

        Args:
            kv_caches: dictionary of layer names, kv cache
        """
        return

    def register_cross_layers_kv_cache(
        self, kv_cache: torch.Tensor, attn_backend: type["AttentionBackend"]
    ):
        """
        Initialize with a single KV cache tensor used by all layers.
        The first dimension should be num_layers.
        This function will only be called for models with uniform layers,
        and only if the prefers_cross_layer_blocks is set to True.
        Only one of the functions
        {register_kv_caches, register_cross_layers_kv_cache} will be called.

        Args:
            kv_cache: a cross-layers kv cache tensor
            attn_backend: The attention backend that corresponds to all layers
        """
        return

    def set_host_xfer_buffer_ops(self, copy_operation: CopyBlocksOp):
        """
        Set the xPU-specific ops for copying KV between host and device.
        Needed when host buffer is used for kv transfer (e.g., in NixlConnector)
        """
        return

    def handle_preemptions(self, kv_connector_metadata: KVConnectorMetadata):
        """
        Handle preempted requests or evicted blocks BEFORE they are overwritten.
        Needed for connectors which use async saves (e.g., OffloadingConnector)
        """
        return

    @abstractmethod
    def start_load_kv(self, forward_context: "ForwardContext", **kwargs: Any) -> None:
        """
        Start loading the KV cache from the connector to vLLM's paged
        KV buffer. This is called from the forward context before the
        forward pass to enable async loading during model execution.

        Args:
            forward_context (ForwardContext): the forward context.
            **kwargs: additional arguments for the load operation

        Note:
            The number of elements in kv_caches and layer_names should be
            the same.

        """
        pass

    @abstractmethod
    def wait_for_layer_load(self, layer_name: str) -> None:
        """
        Block until the KV for a specific layer is loaded into vLLM's
        paged buffer. This is called from within attention layer to ensure
        async copying from start_load_kv is complete.

        This interface will be useful for layer-by-layer pipelining.

        Args:
            layer_name: the name of that layer
        """
        pass

    @abstractmethod
    def save_kv_layer(
        self,
        layer_name: str,
        kv_layer: torch.Tensor,
        attn_metadata: "AttentionMetadata",
        **kwargs: Any,
    ) -> None:
        """
        Start saving a layer of KV cache from vLLM's paged buffer
        to the connector. This is called from within attention layer to
        enable async copying during execution.

        Args:
            layer_name (str): the name of the layer.
            kv_layer (torch.Tensor): the paged KV buffer of the current
                layer in vLLM.
            attn_metadata (AttentionMetadata): the attention metadata.
            **kwargs: additional arguments for the save operation.
        """
        pass

    @abstractmethod
    def wait_for_save(self):
        """
        Block until all the save operations is done. This is called
        as the forward context exits to ensure that the async saving
        from save_kv_layer is complete before finishing the forward.

        This prevents overwrites of paged KV buffer before saving done.
        """
        pass

    def get_finished(
        self, finished_req_ids: set[str]
    ) -> tuple[set[str] | None, set[str] | None]:
        """
        Notifies worker-side connector ids of requests that have
        finished generating tokens on the worker.
        The scheduler process (via the Executors) will use this output
        to track which workers are done.

        Returns:
            ids of requests that have finished asynchronous transfer
            (requests that previously returned True from request_finished()),
            tuple of (sending/saving ids, recving/loading ids).
            The finished saves/sends req ids must belong to a set provided in a
            call to this method (this call or a prior one).
        """
        return None, None

    def get_block_ids_with_load_errors(self) -> set[int]:

vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L453-L562

    @abstractmethod
    def get_num_new_matched_tokens(
        self,
        request: "Request",
        num_computed_tokens: int,
    ) -> tuple[int | None, bool]:
        """
        Get number of new tokens that can be loaded from the
        external KV cache beyond the num_computed_tokens.

        Args:
            request (Request): the request object.
            num_computed_tokens (int): the number of locally
                computed tokens for this request

        Returns:
            A tuple with the following elements:
                - An optional number of tokens that can be loaded from the
                  external KV cache beyond what is already computed.
                  If None, it means that the connector needs more time to
                  determine the number of matched tokens, and the scheduler
                  should query for this request again later.
                - `True` if external KV cache tokens will be loaded
                  asynchronously (between scheduler steps). Must be
                  'False' if the first element is 0.

        Notes:
            The connector should only consider the largest prefix of prompt-
            tokens for which KV cache is actually available at the time of the
            call. If the cache cannot be loaded for some tokens (e.g., due to
            connectivity issues or eviction), those tokens must not be taken
            into account.
        """
        pass

    @abstractmethod
    def update_state_after_alloc(
        self, request: "Request", blocks: "KVCacheBlocks", num_external_tokens: int
    ):
        """
        Update KVConnector state after block allocation.

        If get_num_new_matched_tokens previously returned True for a
        request, this function may be called twice for that same request -
        first when blocks are allocated for the connector tokens to be
        asynchronously loaded into, and second when any additional blocks
        are allocated, after the load/transfer is complete.

        Args:
            request (Request): the request object.
            blocks (KVCacheBlocks): the blocks allocated for the request.
            num_external_tokens (int): the number of tokens that will be
                loaded from the external KV cache.
        """
        pass

    @abstractmethod
    def build_connector_meta(
        self, scheduler_output: SchedulerOutput
    ) -> KVConnectorMetadata:
        """
        Build the connector metadata for this step.

        This function should NOT modify fields in the scheduler_output.
        Also, calling this function will reset the state of the connector.

        Args:
            scheduler_output (SchedulerOutput): the scheduler output object.
        """
        pass

    def on_new_request(self, request: "Request") -> None:
        """Called by the scheduler when a new request is added.

        Connectors can override this to inspect the request and perform
        bookkeeping. The default implementation is a no-op.
        """
        return

    def update_connector_output(self, connector_output: KVConnectorOutput):
        """
        Update KVConnector state from worker-side connectors output.

        Args:
            connector_output (KVConnectorOutput): the worker-side
                connectors output.
        """
        return

    def request_finished(
        self,
        request: "Request",
        block_ids: list[int],
    ) -> tuple[bool, dict[str, Any] | None]:
        """
        Called exactly once when a request has finished, before its blocks are
        freed.

        The connector may assumes responsibility for freeing the blocks
        asynchronously by returning True.

        Returns:
            True if the request is being saved/sent asynchronously and blocks
            should not be freed until the request_id is returned from
            get_finished().
            Optional KVTransferParams to be included in the request outputs
            returned by the engine.
        """
        return False, None


vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L115

KVProducer = Literal["kv_producer", "kv_both"]
KVConsumer = Literal["kv_consumer", "kv_both"]
KVRole = Literal[KVProducer, KVConsumer]


def kv_buffer_device_default_factory() -> str:
    from vllm.platforms import current_platform

    return current_platform.device_type


@config
class KVTransferConfig:
    """Configuration for distributed KV cache transfer."""

    kv_connector: str | None = None
    """The KV connector for vLLM to transmit KV caches between vLLM instances.
    """

    engine_id: str | None = None
    """The engine id for KV transfers."""

    kv_buffer_device: str = field(default_factory=kv_buffer_device_default_factory)
    """The device used by kv connector to buffer the KV cache. Choices are
    'cuda', 'cpu' and 'xpu'."""

    kv_buffer_size: float = 1e9
    """The buffer size for TorchDistributedConnector. Measured in number of
    bytes. Recommended value: 1e9 (about 1GB)."""

    kv_role: KVRole | None = None
    """Whether this vLLM instance produces, consumes KV cache, or both. Choices
    are 'kv_producer', 'kv_consumer', and 'kv_both'."""

    kv_rank: int | None = None
    """The rank of this vLLM instance in the KV cache transfer. Typical value:
    0 for prefill instance, 1 for decode instance.
    Currently only 1P1D is supported."""

    kv_parallel_size: int = 1
    """The number of parallel instances for KV cache transfer. For
    P2pNcclConnector, this should be 2."""

    kv_ip: str = "127.0.0.1"
    """The KV connector ip, used to build distributed connection."""

    kv_port: int = 14579
    """The KV connector port, used to build distributed connection."""

    kv_connector_extra_config: dict[str, Any] = field(default_factory=dict)
    """any extra config that the connector may need."""

    kv_connector_module_path: str | None = None
    """The Python module path to dynamically load the KV connector from.
    Only supported in V1."""

    enable_permute_local_kv: bool = False
    """Experiment feature flag to enable HND to NHD KV Transfer"""

    kv_load_failure_policy: Literal["recompute", "fail"] = "fail"
    """Policy for handling KV cache load failures.
    'recompute': reschedule the request to recompute failed blocks
    'fail': immediately fail the request with an error finish reason (default)"""

    def compute_hash(self) -> str:
        """
        WARNING: Whenever a new field is added to this config,
        ensure that it is included in the factors list if
        it affects the computation graph.

        Provide a hash that uniquely identifies all the configs
        that affect the structure of the computation
        graph from input ids/embeddings to the final hidden states,
        excluding anything before input ids/embeddings and after
        the final hidden states.
        """
        # no factors to consider.
        # this config will not affect the computation graph.
        factors: list[Any] = []
        hash_str = safe_hash(str(factors).encode(), usedforsecurity=False).hexdigest()
        return hash_str

    def __post_init__(self) -> None:
        if self.engine_id is None:
            self.engine_id = str(uuid.uuid4())

        if self.kv_role is not None and self.kv_role not in get_args(KVRole):
            raise ValueError(
                f"Unsupported kv_role: {self.kv_role}. "
                f"Supported roles are {get_args(KVRole)}"
            )

        if self.kv_connector is not None and self.kv_role is None:
            raise ValueError(
                "Please specify kv_role when kv_connector "
                f"is set, supported roles are {get_args(KVRole)}"
            )

    @property
    def is_kv_transfer_instance(self) -> bool:
        return self.kv_connector is not None and self.kv_role in get_args(KVRole)

    @property
    def is_kv_producer(self) -> bool:
        return self.kv_connector is not None and self.kv_role in get_args(KVProducer)

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L119-L130

        self.connector = None
        self.connector_prefix_cache_stats: PrefixCacheStats | None = None
        self.recompute_kv_load_failures = True
        if self.vllm_config.kv_transfer_config is not None:
            assert not self.is_encoder_decoder, (
                "Encoder-decoder models are not currently supported with KV connectors"
            )
            self.connector = KVConnectorFactory.create_connector(
                config=self.vllm_config,
                role=KVConnectorRole.SCHEDULER,
                kv_cache_config=self.kv_cache_config,
            )

vllm@0fc695fc:vllm/distributed/kv_transfer/kv_transfer_state.py#L65-L87

def ensure_kv_transfer_initialized(
    vllm_config: "VllmConfig", kv_cache_config: "KVCacheConfig"
) -> None:
    """
    Initialize KV cache transfer parallel group.
    """

    global _KV_CONNECTOR_AGENT

    if vllm_config.kv_transfer_config is None:
        return

    if (
        vllm_config.kv_transfer_config.is_kv_transfer_instance
        and _KV_CONNECTOR_AGENT is None
    ):
        _sync_engine_id_across_tp(vllm_config)

        _KV_CONNECTOR_AGENT = KVConnectorFactory.create_connector(
            config=vllm_config,
            role=KVConnectorRole.WORKER,
            kv_cache_config=kv_cache_config,
        )

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1888-L1910

    def _free_request(
        self, request: Request, delay_free_blocks: bool = False
    ) -> dict[str, Any] | None:
        assert request.is_finished()

        self._inflight_prefills.discard(request)
        connector_delay_free_blocks, kv_xfer_params = self._connector_finished(request)
        self.encoder_cache_manager.free(request)
        request_id = request.request_id
        self.finished_req_ids.add(request_id)
        if self.finished_req_ids_dict is not None:
            self.finished_req_ids_dict[request.client_index].add(request_id)

        delay_free_blocks |= connector_delay_free_blocks
        if not delay_free_blocks:
            self._free_blocks(request)

        return kv_xfer_params

    def _free_blocks(self, request: Request):
        assert request.is_finished()
        self.kv_cache_manager.free(request)
        del self.requests[request.request_id]

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2221-L2250

    def _update_from_kv_xfer_finished(self, kv_connector_output: KVConnectorOutput):
        """
        KV Connector: update the scheduler state based on the output.

        The Worker side connectors add finished_recving and
        finished_sending reqs to the output.
        * if finished_sending: free the blocks
        # if finished_recving: add to state so we can
            schedule the request during the next step.
        """

        if self.connector is not None:
            self.connector.update_connector_output(kv_connector_output)

        # KV Connector:: update recv and send status from last step.
        for req_id in kv_connector_output.finished_recving or ():
            logger.debug("Finished recving KV transfer for request %s", req_id)
            assert req_id in self.requests
            req = self.requests[req_id]
            if req.status == RequestStatus.WAITING_FOR_REMOTE_KVS:
                self.finished_recving_kv_req_ids.add(req_id)
            else:
                assert RequestStatus.is_finished(req.status)
                self._free_blocks(self.requests[req_id])
        for req_id in kv_connector_output.finished_sending or ():
            logger.debug("Finished sending KV transfer for request %s", req_id)
            assert req_id in self.requests
            self._free_blocks(self.requests[req_id])

    def _update_requests_with_invalid_blocks(

vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L576-L587

                # try to promote blocked statuses while traversing skipped queue.
                if self._is_blocked_waiting_status(
                    request.status
                ) and not self._try_promote_blocked_waiting_request(request):
                    if request.status == RequestStatus.WAITING_FOR_REMOTE_KVS:
                        logger.debug(
                            "%s is still in WAITING_FOR_REMOTE_KVS state.",
                            request_id,
                        )
                    request_queue.pop_request()
                    step_skipped_waiting.prepend_request(request)
                    continue

vllm@0fc695fc:vllm/v1/worker/kv_connector_model_runner_mixin.py#L85-L105

        # Update KVConnector with the KVConnector metadata forward().
        kv_connector = get_kv_transfer_group()
        assert isinstance(kv_connector, KVConnectorBase)
        assert scheduler_output.kv_connector_metadata is not None
        kv_connector.bind_connector_metadata(scheduler_output.kv_connector_metadata)

        # Background KV cache transfers happen here.
        # These transfers are designed to be async and the requests
        # involved may be disjoint from the running requests.
        # Do this here to save a collective_rpc.
        kv_connector.start_load_kv(get_forward_context())
        try:
            yield output
        finally:
            if wait_for_save and not defer_finalize:
                kv_connector.wait_for_save()

            output.finished_sending, output.finished_recving = (
                kv_connector.get_finished(scheduler_output.finished_req_ids)
            )
            output.invalid_block_ids = kv_connector.get_block_ids_with_load_errors()

vllm@0fc695fc:vllm/model_executor/layers/attention/kv_transfer_utils.py#L45-L58

        attn_metadata, _, kv_cache, _ = get_attention_context(layer_name)
        connector = get_kv_transfer_group()
        if attn_metadata is None or not connector.has_connector_metadata():
            return func(*args, **kwargs)

        # Wait for KV layer on entry
        connector.wait_for_layer_load(layer_name)

        # Execute the function
        result = func(*args, **kwargs)

        # Save KV cache layer on exit
        connector.save_kv_layer(layer_name, kv_cache, attn_metadata)


vllm@0fc695fc:vllm/envs.py#L1684-L1686

    "VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT": lambda: int(
        os.getenv("VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT", "480")
    ),

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L55

def register_connector():
    # override multi_connector as ascend_multi_connector
    if "MultiConnector" in KVConnectorFactory._registry:
        KVConnectorFactory._registry.pop("MultiConnector")
    KVConnectorFactory.register_connector(
        "MultiConnector", "vllm_ascend.distributed.kv_transfer.ascend_multi_connector", "AscendMultiConnector"
    )

    KVConnectorFactory.register_connector(
        "MooncakeConnectorV1", "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_connector", "MooncakeConnector"
    )

    KVConnectorFactory.register_connector(
        "MooncakeHybridConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_hybrid_connector",
        "MooncakeConnector",
    )

    KVConnectorFactory.register_connector(
        "MooncakeConnectorStoreV1",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )

    KVConnectorFactory.register_connector(
        "AscendStoreConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )

    KVConnectorFactory.register_connector(
        "MooncakeLayerwiseConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_layerwise_connector",
        "MooncakeLayerwiseConnector",
    )

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1506-L1590

class MooncakeConnector(KVConnectorBase_V1, SupportsHMA):
    def __init__(self, vllm_config: VllmConfig, role: KVConnectorRole, kv_cache_config: KVCacheConfig | None = None):
        assert vllm_config.kv_transfer_config is not None
        self.engine_id = vllm_config.kv_transfer_config.engine_id
        self._connector_metadata = MooncakeConnectorMetadata()

        if role == KVConnectorRole.SCHEDULER:
            self.connector_scheduler: MooncakeConnectorScheduler | None = MooncakeConnectorScheduler(
                vllm_config, str(self.engine_id), kv_cache_config
            )
            self.connector_worker: MooncakeConnectorWorker | None = None
        elif role == KVConnectorRole.WORKER:
            self.connector_scheduler = None
            self.connector_worker = MooncakeConnectorWorker(vllm_config, str(self.engine_id), kv_cache_config)

    ############################################################
    # Scheduler Side Methods
    ############################################################

    def get_num_new_matched_tokens(self, request: "Request", num_computed_tokens: int) -> tuple[int, bool]:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.get_num_new_matched_tokens(request, num_computed_tokens)

    def update_state_after_alloc(self, request: "Request", blocks: "KVCacheBlocks", num_external_tokens: int):
        assert self.connector_scheduler is not None
        return self.connector_scheduler.update_state_after_alloc(request, blocks, num_external_tokens)

    def build_connector_meta(
        self,
        scheduler_output: SchedulerOutput,
    ) -> KVConnectorMetadata:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.build_connector_meta(scheduler_output)

    def request_finished(
        self,
        request: "Request",
        block_ids: list[int],
    ) -> tuple[bool, dict[str, Any] | None]:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.request_finished(request, (block_ids,))

    def request_finished_all_groups(
        self,
        request: "Request",
        block_ids: tuple[list[int], ...],
    ) -> tuple[bool, dict[str, Any] | None]:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.request_finished(request, block_ids)

    ############################################################
    # Worker Side Methods
    ############################################################
    def register_kv_caches(self, kv_caches: dict[str, torch.Tensor]):
        assert self.connector_worker is not None
        self.connector_worker.register_kv_caches(kv_caches)

    def get_finished(self, finished_req_ids: set[str]) -> tuple[set[str], set[str]]:
        """Get the finished recving and sending requests."""
        assert self.connector_worker is not None
        return self.connector_worker.get_finished()

    def get_block_ids_with_load_errors(self) -> set[int]:
        """Get the block ids whose KV load failed."""
        assert self.connector_worker is not None
        return self.connector_worker.get_block_ids_with_load_errors()

    def start_load_kv(self, forward_context: "ForwardContext", **kwargs) -> None:
        assert self.connector_worker is not None
        assert isinstance(self._connector_metadata, MooncakeConnectorMetadata)
        self.connector_worker.start_load_kv(self._connector_metadata)

    def wait_for_layer_load(self, layer_name: str) -> None:
        """MooncakeConnector does not do layerwise saving."""
        pass

    def save_kv_layer(
        self, layer_name: str, kv_layer: torch.Tensor, attn_metadata: "AttentionMetadata", **kwargs
    ) -> None:
        """MooncakeConnector does not save explicitly."""
        pass

    def wait_for_save(self):
        """MooncakeConnector does not save explicitly."""
        pass

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1784-L1879

    def get_num_new_matched_tokens(self, request: "Request", num_computed_tokens: int) -> tuple[int, bool]:
        """
        For remote prefill, pull all prompt blocks from remote
        asynchronously relative to engine execution.

        Args:
            request (Request): the request object.
            num_computed_tokens (int): the number of locally
                computed tokens for this request
        Returns:
            * the number of tokens that can be loaded from the
              external KV cache beyond what is already computed.
            * true if the external KV cache tokens will be loaded
              asynchronously (between scheduler steps).
        """

        params = request.kv_transfer_params
        logger.debug(
            "MooncakeConnector get_num_new_matched_tokens: num_computed_tokens=%s, kv_transfer_params=%s",
            num_computed_tokens,
            params,
        )

        if params is not None and params.get("do_remote_prefill"):
            # Remote prefill: get all prompt blocks from remote.
            token_ids = request.prompt_token_ids or []
            actual = self._state_prefill_token_count(len(token_ids))
            params["num_computed_tokens"] = num_computed_tokens
            count = max(actual - num_computed_tokens, 0)
            if count > 0:
                return count, True

        if params is not None and params.get("do_remote_decode") and self.need_truncate:
            self._truncate_request_for_prefill(request)

        # No remote prefill for this request.
        return 0, False

    def update_state_after_alloc(self, request: "Request", blocks: "KVCacheBlocks", num_external_tokens: int):
        params = request.kv_transfer_params
        logger.debug(
            "MooncakeConnector update_state_after_alloc: num_external_tokens=%s, kv_transfer_params=%s",
            num_external_tokens,
            params,
        )

        if params is not None and (params.get("do_remote_prefill", False) or params.get("do_remote_decode", False)):
            self._reqs_in_batch.add(request.request_id)
        if params is not None and params.get("do_remote_prefill"):
            if params.get("remote_block_ids"):
                if all(p in params for p in ("remote_engine_id", "remote_host", "remote_port", "remote_request_id")):
                    local_block_ids = blocks.get_unhashed_block_ids_all_groups() if num_external_tokens > 0 else []
                    local_full_block_ids = blocks.get_block_ids() if num_external_tokens > 0 else tuple()
                    # Get unhashed blocks to pull from remote.
                    self._reqs_need_recv[request.request_id] = (
                        request,
                        local_block_ids,
                        local_full_block_ids,
                        num_external_tokens,
                    )
                else:
                    logger.warning("Got invalid KVTransferParams. params=%s. ", params)
            else:
                assert num_external_tokens == 0
            # Only trigger 1 KV transfer per request.
            params["do_remote_prefill"] = False

    def build_connector_meta(
        self,
        scheduler_output: SchedulerOutput,
    ) -> KVConnectorMetadata:
        meta = MooncakeConnectorMetadata()

        # Loop through scheduled reqs and convert to ReqMeta.
        for req_id, (req, block_ids, full_block_ids, num_external_tokens) in self._reqs_need_recv.items():
            assert req.kv_transfer_params is not None
            # For the case where there are no remote blocks to pull
            # (block_ids is empty), we don't need to schedule
            # an async read on the worker side.
            meta.add_new_req(
                request_id=req_id,
                local_block_ids=block_ids,
                local_full_block_ids=full_block_ids,
                num_external_tokens=num_external_tokens,
                kv_transfer_params=req.kv_transfer_params,
            )

        # Clear the list once workers start the transfers
        self._reqs_need_recv.clear()
        meta.requests_to_send = self._reqs_need_send
        self._reqs_need_send = {}
        meta.reqs_in_batch = self._reqs_in_batch
        self._reqs_in_batch = set()

        return meta


vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926

    def request_finished(
        self,
        request: "Request",
        block_ids: BlockIds,
    ) -> tuple[bool, dict[str, Any] | None]:
        """
        Once a request is finished, determine whether request blocks
        should be freed now or will be sent asynchronously and freed later.
        """

        params = request.kv_transfer_params
        logger.debug(
            "MooncakeConnector request_finished, request_status=%s, kv_transfer_params=%s", request.status, params
        )

        if (
            params is None
            or not params.get("do_remote_decode")
            or request.status != RequestStatus.FINISHED_LENGTH_CAPPED
        ):
            return False, None

        num_prompt_blocks = math.ceil(len(request.prompt_token_ids) / self.block_size)
        computed_block_ids = self._get_transfer_block_ids(block_ids, len(request.prompt_token_ids))
        computed_block_ids = self._get_swa_transfer_block_ids(computed_block_ids)
        computed_block_lens = [len(block_id_list) for block_id_list in computed_block_ids]
        delay_free_blocks = sum(computed_block_lens) > 0
        if delay_free_blocks:
            logger.info("Delaying free of %d blocks for request %s", sum(computed_block_lens), request.request_id)
            self._reqs_need_send[request.request_id] = time.time()

        return delay_free_blocks, dict(
            do_remote_prefill=True,
            do_remote_decode=False,
            remote_block_ids=computed_block_ids,
            remote_engine_id=self.engine_id,
            remote_request_id=request.request_id,
            remote_host=self.side_channel_host,
            remote_port=self.side_channel_port,
            remote_pcp_size=self.pcp_size,
            remote_dcp_size=self.dcp_size,
            remote_ptp_size=self.tp_size,
            last_token_id=request.output_token_ids[-1],
            remote_multi_nodes_meta_mapping=self.multi_nodes_meta_mapping,
            num_prompt_blocks=num_prompt_blocks,
            remote_block_size=self.block_size,
        )

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2332-L2471

    def register_kv_caches(self, kv_caches: dict[str, torch.Tensor]):
        """Register the KV Cache data."""
        self.use_mla = self.vllm_config.model_config.is_deepseek_mla
        self.use_sparse = hasattr(self.vllm_config.model_config.hf_text_config, "index_topk")
        self.enable_sfa_dcp_replicated_indexer = enable_sfa_dcp_replicated_indexer(self.vllm_config)

        self.num_blocks = self.kv_cache_config.num_blocks
        logger.info("num_blocks: %s", self.num_blocks)
        self.kv_caches = kv_caches
        # Maps each KV cache group to its serialized group spec and physical
        # layer indices: {group_id: (group_spec, [layer_idx0, layer_idx1, ...])}.
        self.kv_group2layeridx = self._build_kv_group2layeridx()
        self._is_hma_required = self._is_hma_required or self._requires_group_aware_attention_transfer()
        has_mamba_group = self._has_mamba_group()
        layer_name_to_idx = {
            layer_name: layer_idx
            for _, (group_spec, layer_indices) in self.kv_group2layeridx.items()
            for layer_name, layer_idx in zip(group_spec["layer_names"], layer_indices)
        }
        metadata_layers = max(layer_name_to_idx.values(), default=-1) + 1
        # Per-layer registered KV cache base addresses:
        # [layer_idx][cache_idx] -> data_ptr of one cache tensor, e.g. K/V.
        self.kv_caches_base_addr: list[list[int]] = [[] for _ in range(metadata_layers)]
        # Per-layer block scaling between logical KV blocks and tensor blocks:
        # [layer_idx][cache_idx] -> cache tensor num_blocks / logical num_blocks.
        self.block_size_scale: list[list[int]] = [[] for _ in range(metadata_layers)]
        # Per-layer byte length of one tensor block:
        # [layer_idx][cache_idx] -> element_size * prod(block_shape).
        self.block_len_per_addr: list[list[int]] = [[] for _ in range(metadata_layers)]
        # Per-layer full tensor shape for each registered KV cache address:
        # [layer_idx][cache_idx] -> cache tensor shape, including num_blocks.
        self.block_shape_per_addr: list[list[int]] = [[] for _ in range(metadata_layers)]
        # Per-layer byte stride between consecutive tensor blocks:
        # [layer_idx][cache_idx] -> stride(0) * element_size.
        self.block_stride_per_addr: list[list[int]] = [[] for _ in range(metadata_layers)]

        # TODO: For DSV4 use_compress, metadata/transfer can be optimized by
        # aggregating layer views that share the same raw KVCacheTensor.
        for layer_name, kv_cache_tuple in kv_caches.items():
            layer_idx = layer_name_to_idx[layer_name]
            for single_kv_cache in self._as_kv_cache_tuple(kv_cache_tuple):
                tensor_num_blocks = single_kv_cache.shape[0]
                block_size_scale = tensor_num_blocks // self.num_blocks
                block_shape = single_kv_cache.shape[1:]
                self.block_len_per_addr[layer_idx].append(single_kv_cache.element_size() * math.prod(block_shape))
                self.block_stride_per_addr[layer_idx].append(single_kv_cache.stride(0) * single_kv_cache.element_size())
                self.block_shape_per_addr[layer_idx].append(single_kv_cache.shape)
                self.block_size_scale[layer_idx].append(block_size_scale)
                self.kv_caches_base_addr[layer_idx].append(single_kv_cache.data_ptr())

        if has_mamba_group:
            ptrs, lengths = self._get_registered_kv_tensor_buffers(kv_caches)
            register_regions = RegisterRegions(ptrs=ptrs, lengths=lengths)
        elif self.use_hybrid:
            ptrs, lengths = self._get_registered_kv_tensor_buffers_hybrid(kv_caches)
            register_regions = RegisterRegions(ptrs=ptrs, lengths=lengths)
        else:
            # For normal attention / sparse-c8 KV cache, keep metadata at the
            # logical tensor level but merge registration ranges by underlying
            # storage to avoid exceeding the HCCL per-process region limit.
            register_regions = collect_storage_merged_register_regions(kv_caches)

        validate_register_region_count(register_regions)
        global_te.register_buffer(register_regions.ptrs, register_regions.lengths)

        logger.debug(
            "Mooncake register kv caches metadata: kv_group2layeridx=%s, kv_caches_base_addr=%s, "
            "block_len_per_addr=%s, block_stride_per_addr=%s, block_shape_per_addr=%s, "
            "block_size_scale=%s, ptrs=%s, lengths=%s",
            self.kv_group2layeridx,
            self.kv_caches_base_addr,
            self.block_len_per_addr,
            self.block_stride_per_addr,
            self.block_shape_per_addr,
            self.block_size_scale,
            register_regions.ptrs,
            register_regions.lengths,
        )
        # After KV Caches registered, start the sending or receiving thread.
        metadata = MooncakeAgentMetadata(
            engine_id=self.engine_id,
            te_rpc_port=self.te_rpc_port,
            kv_group2layeridx=self.kv_group2layeridx,
            block_size=self.block_size,
            kv_caches_base_addr=self.kv_caches_base_addr,
            block_size_scale=self.block_size_scale,
            num_blocks=self.num_blocks,
            block_lens=self.block_len_per_addr,
            block_strides=self.block_stride_per_addr,
            local_ip=get_ip(),
            handshake_port=self.handshake_port,
        )
        self.xfer_handshake_metadata = metadata

        ready_event = threading.Event()
        if self.kv_role == "kv_producer":
            self.kv_send_thread = KVCacheSendingThread(
                self.vllm_config,
                self.tp_rank,
                self._prefill_tp_size,
                self.engine_id,
                self.side_channel_host,
                self.side_channel_port,
                metadata,
                ready_event,
                self.kv_caches,
                self.pcp_rank,
            )
            self.kv_send_thread.start()
        else:
            self.kv_recv_thread = KVCacheRecvingThread(
                self.tp_rank,
                self.tp_size,
                self._prefill_pp_size,
                self.engine,
                self.engine_id,
                self.handshake_port,
                self.side_channel_port,
                self.kv_caches_base_addr,
                self.block_len_per_addr,
                self.block_stride_per_addr,
                self._is_hma_required,
                ready_event,
                self.vllm_config,
                self.kv_caches,
                self._prefill_pp_layer_partition,
                self.kv_group2layeridx,
                self.block_size_scale,
            )
            self.kv_recv_thread.start()
        start_wait_time = time.time()
        thread = self.kv_send_thread if self.kv_role == "kv_producer" else self.kv_recv_thread
        assert thread is not None
        while not ready_event.is_set():
            if not thread.is_alive():
                raise RuntimeError("KV Cache sending/receiving thread failed to start.")
            if time.time() - start_wait_time > 5 * 60:
                raise RuntimeError("Timeout waiting for KV Cache thread to be ready.")
            time.sleep(3)


vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L96-L146

class MooncakeAgentMetadata(msgspec.Struct, omit_defaults=True, dict=True):
    engine_id: str
    te_rpc_port: int
    kv_group2layeridx: dict[int, tuple[dict[str, Any], list[int]]]
    block_size: int
    kv_caches_base_addr: list[list[int]]
    block_size_scale: list[list[int]]
    num_blocks: int
    block_lens: list[list[int]]
    block_strides: list[list[int]]
    local_ip: str = ""
    handshake_port: int = 0


@dataclass
class ReqMeta:
    local_block_ids: BlockIds
    num_external_tokens: int
    num_computed_tokens: int
    remote_block_ids: BlockIds

    remote_host: str
    remote_port: int
    remote_engine_id: str
    remote_request_id: str
    remote_pcp_size: int
    remote_dcp_size: int
    remote_ptp_size: int | None
    remote_multi_nodes_meta_mapping: dict[str, dict[str, Any]]
    num_prompt_blocks: int
    remote_block_size: int
    local_full_block_ids: BlockIds = tuple()


@dataclass(frozen=True)
class GroupPull:
    group_id: int
    remote_tp_offset: int
    num_group_pulls: int
    prefill_pp_rank: int = 0
    is_group_transfer_end: bool = False


@dataclass(frozen=True)
class GroupTransferInfo:
    tokens_per_block: int
    blocks_per_window: int
    is_state_group: bool


@dataclass

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L774-L962

    def _transfer_kv_cache_all_groups(self, req_meta: dict[str, Any]):
        """Handle a KV cache transfer request."""
        remote_request_id = req_meta["remote_request_id"]
        local_block_ids: BlockIds = req_meta["local_block_ids"]
        remote_block_ids: BlockIds = req_meta["remote_block_ids"]
        local_block_ids_replicate_k: BlockIds = req_meta.get("local_block_ids_replicate_k", tuple())
        remote_block_ids_replicate_k: BlockIds = req_meta.get("remote_block_ids_replicate_k", tuple())
        has_replicate_k_blocks = any(local_block_ids_replicate_k) and any(remote_block_ids_replicate_k)
        group_pulls: list[GroupPull] = req_meta["group_pulls"]
        remote_engine_id = req_meta["remote_engine_id"]
        remote_host = req_meta["remote_host"]
        remote_handshake_port = req_meta["remote_handshake_port"]
        # Full prefix cache hit: do not need to read remote blocks, just notify
        # P worker that we have the blocks we need.
        num_local_blocks = sum(len(group_block_ids) for group_block_ids in local_block_ids)
        if num_local_blocks == 0 and not has_replicate_k_blocks:
            return

        # Check if we have the remote metadata cached.
        with self.remote_metadata_lock:
            has_remote_metadata = (
                remote_engine_id in self.kv_caches_base_addr
                and remote_handshake_port in self.kv_caches_base_addr[remote_engine_id]
            )
        if not has_remote_metadata:
            self._get_remote_metadata(remote_host, remote_handshake_port)
        with self.remote_metadata_lock:
            remote_kv_caches_base_addrs = self.kv_caches_base_addr[remote_engine_id][remote_handshake_port]
            local_kv_caches_base_addrs = self.kv_caches_base_addr[self.local_engine_id][self.local_handshake_port]
            remote_transfer_port = self.remote_te_port[remote_engine_id][remote_handshake_port]
            remote_block_stride_per_addr = self.remote_block_stride_per_addr[remote_engine_id][remote_handshake_port]
        session_id = f"{remote_host}:{remote_transfer_port}"

        req_start_time = time.perf_counter()
        src_list: list[int] = []
        dst_list: list[int] = []
        length_list: list[int] = []
        attention_group_reformat_block_ids: list[tuple[tuple[int, list[list[int]], int, list[int]], bool]] = []
        grouped_remote_k_block_ids: list[list[int]] = []
        grouped_local_k_block_ids: list[list[int]] = []
        if self.enable_sfa_dcp_replicated_indexer and has_replicate_k_blocks:
            grouped_remote_k_block_ids, grouped_local_k_block_ids = group_concurrent_contiguous(
                remote_block_ids_replicate_k[0],
                local_block_ids_replicate_k[0],
            )

        def pp_layer_indices(layer_indices: list[int], prefill_pp_rank: int) -> list[int]:
            first_layer_index, end_layer_index = self.pp_layer_indices[prefill_pp_rank]
            if self.vllm_config.speculative_config is not None and prefill_pp_rank == self._prefill_pp_size - 1:
                end_layer_index += self.num_draft_layers
            return [layer_idx for layer_idx in layer_indices if first_layer_index <= layer_idx < end_layer_index]

        for group_pull in group_pulls:
            group_idx = group_pull.group_id
            group_spec, layer_indices = self.kv_group2layeridx[group_idx]
            kv_cache_group_id = group_spec.get("kv_cache_group_id", group_idx)
            layer_indices = pp_layer_indices(layer_indices, group_pull.prefill_pp_rank)
            if not layer_indices:
                continue
            tp_num_need_pulls = group_pull.num_group_pulls
            inner_offset = group_pull.remote_tp_offset
            is_mamba_group = group_spec["kv_cache_spec_type"] == "MambaSpec"
            local_group_block_ids = local_block_ids[kv_cache_group_id]
            remote_group_block_ids = remote_block_ids[kv_cache_group_id]
            has_group_blocks = bool(local_group_block_ids)
            if not has_group_blocks and (is_mamba_group or not has_replicate_k_blocks):
                continue
            if not is_mamba_group:
                grouped_remote_block_ids: list[list[int]] = []
                grouped_local_block_ids: list[list[int]] = []
                if has_group_blocks:
                    is_group_transfer_end = group_pull.is_group_transfer_end
                    # Block ids are already expanded to kernel granularity and truncated in
                    # _get_kv_split_metadata, so consume them directly here.
                    kernel_remote_block_ids = remote_group_block_ids
                    kernel_local_block_ids = local_group_block_ids

                    if tp_num_need_pulls == 1:
                        grouped_remote_block_ids, grouped_local_block_ids = group_concurrent_contiguous(
                            kernel_remote_block_ids, kernel_local_block_ids
                        )
                    else:
                        grouped_remote_block_ids = [[block_id] for block_id in kernel_remote_block_ids]
                        grouped_local_block_ids = [[block_id] for block_id in kernel_local_block_ids]
                    attention_group_reformat_block_ids.append(
                        (
                            (group_idx, grouped_local_block_ids, tp_num_need_pulls, layer_indices),
                            is_group_transfer_end,
                        )
                    )
            else:
                # When Prefix Caching is enabled on both P and D nodes, num_block should not be forced to match,
                # as the D-node requires dynamic allocation based on its specific cache hit rate.
                transfer_block_idx = len(remote_group_block_ids) - self.num_speculative_tokens - 1
                grouped_remote_block_ids = [[remote_group_block_ids[transfer_block_idx]]]
                grouped_local_block_ids = [[local_group_block_ids[0]]]

            if is_mamba_group:
                for layer_idx in layer_indices:
                    start_meta_idx = len(src_list)
                    self._append_mamba_transfer_meta(
                        src_list,
                        dst_list,
                        length_list,
                        group_spec=group_spec,
                        src_layer_base_addr=local_kv_caches_base_addrs[layer_idx],
                        dst_layer_base_addr=remote_kv_caches_base_addrs[layer_idx],
                        block_len=self.block_len_per_addr[layer_idx],
                        block_stride=self.block_stride_per_addr[layer_idx],
                        remote_block_stride=remote_block_stride_per_addr[layer_idx],
                        remote_block_id=grouped_remote_block_ids[0][0],
                        local_block_id=grouped_local_block_ids[0][0],
                        tp_num_need_pulls=tp_num_need_pulls,
                        remote_tp_offset=inner_offset,
                    )
                    if logger.isEnabledFor(logging.DEBUG):
                        for src, dst, length in zip(
                            src_list[start_meta_idx:], dst_list[start_meta_idx:], length_list[start_meta_idx:]
                        ):
                            logger.debug(
                                "Mooncake mamba transfer meta: request_id=%s group_idx=%s layer_idx=%s "
                                "local_block_id=%s remote_block_id=%s tp_num_need_pulls=%s "
                                "remote_tp_offset=%s  session_id=%s",
                                remote_request_id,
                                group_idx,
                                layer_idx,
                                grouped_local_block_ids[0][0],
                                grouped_remote_block_ids[0][0],
                                tp_num_need_pulls,
                                inner_offset,
                                session_id,
                            )
                continue

            for layer_idx in layer_indices:
                for cache_idx in range(len(local_kv_caches_base_addrs[layer_idx])):
                    src_layer_base_addr = local_kv_caches_base_addrs[layer_idx][cache_idx]
                    dst_layer_base_addr = remote_kv_caches_base_addrs[layer_idx][cache_idx]
                    block_len = self.block_len_per_addr[layer_idx][cache_idx]
                    block_stride = self.block_stride_per_addr[layer_idx][cache_idx]
                    remote_block_stride = remote_block_stride_per_addr[layer_idx][cache_idx]
                    inner_block_len = block_len // tp_num_need_pulls
                    if self.enable_sfa_dcp_replicated_indexer and self.block_size_scale[layer_idx][cache_idx] > 1:
                        if has_replicate_k_blocks:
                            transfer_remote_block_ids = grouped_remote_k_block_ids
                            transfer_local_block_ids = grouped_local_k_block_ids
                        else:
                            continue
                    else:
                        if not has_group_blocks:
                            continue
                        transfer_remote_block_ids, transfer_local_block_ids = split_if_not_byte_contiguous(
                            grouped_remote_block_ids,
                            grouped_local_block_ids,
                            src_block_stride=remote_block_stride,
                            dst_block_stride=block_stride,
                            block_len=inner_block_len,
                        )
                    for remote_block_id, local_block_id in zip(transfer_remote_block_ids, transfer_local_block_ids):
                        src = src_layer_base_addr + local_block_id[0] * block_stride + inner_offset * inner_block_len
                        dst = dst_layer_base_addr + remote_block_id[0] * remote_block_stride
                        length = inner_block_len * len(local_block_id)
                        src_list.append(src)
                        dst_list.append(dst)
                        length_list.append(length)
                    logger.debug(
                        "Mooncake kv transfer meta: request_id=%s group_idx=%s layer_idx=%s local_block_ids=%s "
                        "remote_block_ids=%s tp_num_need_pulls=%s remote_tp_offset=%s session_id=%s",
                        remote_request_id,
                        group_idx,
                        layer_idx,
                        grouped_local_block_ids,
                        grouped_remote_block_ids,
                        tp_num_need_pulls,
                        inner_offset,
                        session_id,
                    )
        if not src_list:
            return

        logger.debug(
            "Mooncake transfer request=%s session id=%s src=%s dst=%s length=%s",
            remote_request_id,
            session_id,
            src_list,
            dst_list,
            length_list,
        )
        ret = self.engine.batch_transfer_sync_read(session_id, src_list, dst_list, length_list)

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2052-L2084

        # kv_transfer variables
        self.vllm_config = vllm_config
        self.block_size = vllm_config.cache_config.block_size
        if self.vllm_config.model_config.is_deepseek_mla:
            self.tp_num_need_pulls = 1
        else:
            num_d_block_heads = max(1, self.num_key_value_heads // self.tp_size)
            num_p_block_heads = max(1, self.num_key_value_heads // self._prefill_tp_size)
            self.tp_num_need_pulls = num_d_block_heads // num_p_block_heads
        self.local_remote_block_port_mapping: dict[str, list[list[int]] | None] = {}
        self.remote_port_send_num: dict[str, dict[int, RemotePortInfo]] = {}

    def _get_prefill_decode_size(self, vllm_config: VllmConfig):
        # get prefill tp and dp size from extra config
        prefill_parallel_config: dict[str, Any] = vllm_config.kv_transfer_config.get_from_extra_config("prefill", {})

        assert "tp_size" in prefill_parallel_config
        self._prefill_tp_size = prefill_parallel_config["tp_size"]

        assert "dp_size" in prefill_parallel_config
        self._prefill_dp_size = prefill_parallel_config["dp_size"]
        # get prefill pp size from extra config
        self._prefill_pp_size = prefill_parallel_config.get("pp_size", 1)
        # get decode tp and dp size from extra config
        decode_parallel_config: dict[str, Any] = vllm_config.kv_transfer_config.get_from_extra_config("decode", {})
        assert "tp_size" in decode_parallel_config
        self._decode_tp_size = decode_parallel_config["tp_size"]
        assert "dp_size" in decode_parallel_config
        self._decode_dp_size = decode_parallel_config["dp_size"]
        # get prefill pp size from extra config
        self._decode_pp_size = decode_parallel_config.get("pp_size", 1)
        assert self._decode_pp_size == 1, "decode pp size must be 1"
        self._prefill_pp_layer_partition = prefill_parallel_config.get("pp_layer_partition")

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L166-L242

class KVCacheTaskTracker:
    def __init__(self):
        super().__init__()

        self.done_task_lock = threading.Lock()
        self.finished_requests: set[str] = set()
        # Only used in prefill node. Tracks requests whose kv blocks freeing is
        # intentionally delayed. Each entry is a tuple of (request_id,
        # timestamp). If a request remains in this queue for too long, it will
        # be force-freed.
        self.delayed_free_requests: OrderedDict[str, float] = OrderedDict()
        self.reqs_to_process: set[str] = set()

    def add_req_to_process(self, request_id: str):
        self.reqs_to_process.add(request_id)

    def add_not_transfer_request(self, request_id: str):
        with self.done_task_lock:
            self.finished_requests.add(request_id)
            self.reqs_to_process.discard(request_id)

    def update_done_task_count(self, request_id: str):
        with self.done_task_lock:
            if request_id in self.reqs_to_process:
                self.finished_requests.add(request_id)
                self.reqs_to_process.discard(request_id)
                self.delayed_free_requests.pop(request_id, None)
            else:
                logger.warning(
                    "MooncakeConnector finish req not in reqs to process. "
                    "request_id=%s. "
                    "Possible cause: Request was already completed or not properly tracked. "
                    "Check: Verify request lifecycle and tracking logic.",
                    request_id,
                )

    def get_and_clear_finished_requests(self) -> set[str]:
        """
        Get and clear the requests that have been completed.
        Returns:
            A set of request IDs that have been completed.
        """
        with self.done_task_lock:
            finished_requests = self.finished_requests.copy()
            expired_requests = self._retrieve_expired_requests()
            finished_requests.update(expired_requests)
            self.finished_requests.clear()
        return finished_requests

    def add_delayed_request(self, request_id: str, delay_start_time: float):
        """Add a delayed free request."""
        with self.done_task_lock:
            if request_id in self.reqs_to_process:
                self.delayed_free_requests[request_id] = delay_start_time

    def _retrieve_expired_requests(self):
        """Retrieve all expired delayed requests."""
        expired_requests: set[str] = set()
        # Free delayed requests if they exceed the timeout
        current_time = time.time()
        while self.delayed_free_requests:
            request_id = next(iter(self.delayed_free_requests))
            delay_start_time = self.delayed_free_requests[request_id]
            if current_time - delay_start_time > envs.VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT:
                self.delayed_free_requests.popitem(last=False)
                self.reqs_to_process.discard(request_id)
                expired_requests.add(request_id)
                logger.error(
                    "Force freed expired request: %s. "
                    "Reason: Request exceeded timeout threshold (%s seconds). "
                    "Action: Resources have been forcibly released to prevent memory leak.",
                    request_id,
                    envs.VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT,
                )
            else:
                break
        return expired_requests

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3374-L3470

    def start_load_kv(self, metadata: MooncakeConnectorMetadata):
        """Start loading KV blocks from remote engine."""
        for req_id in metadata.reqs_in_batch:
            if self.kv_send_thread is not None:
                self.kv_send_thread.task_tracker.add_req_to_process(req_id)
            if self.kv_recv_thread is not None:
                self.kv_recv_thread.task_tracker.add_req_to_process(req_id)

        for req_id, meta in metadata.requests.items():
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "start_load_kv for request %s from remote engine %s. "
                    "Num local_block_ids: %s. Num remote_block_ids: %s. ",
                    req_id,
                    meta.remote_engine_id,
                    len(meta.local_block_ids),
                    len(meta.remote_block_ids),
                )

            remote_req_id = meta.remote_request_id
            prefill_tp_size: int = meta.remote_ptp_size if meta.remote_ptp_size is not None else self._prefill_tp_size
            (
                local_block_ids_replicate_k,
                remote_block_ids_replicate_k,
            ) = self._get_sfa_replicate_k_block_ids(meta)

            (
                remote_handshake_port_list,
                local_block_ids_list,
                remote_block_ids_list,
            ) = self._get_kv_split_metadata(remote_req_id, meta)
            has_replicate_k_blocks = any(local_block_ids_replicate_k) and any(remote_block_ids_replicate_k)
            remote_transfer_ports = [port for remote_ports in remote_handshake_port_list for port in remote_ports]
            if has_replicate_k_blocks and not remote_transfer_ports:
                raise AssertionError("SFA replicate-K requires at least one normal KV transfer port.")
            replicate_k_transfer_port = remote_transfer_ports[0] if has_replicate_k_blocks else None
            group_pulls_list = self._get_group_pulls_metadata(
                remote_req_id,
                remote_handshake_port_list,
                prefill_tp_size,
                meta.remote_port,
                meta.remote_pcp_size,
                meta.remote_dcp_size,
            )

            for pcp_dcp_rank, remote_ports in enumerate(remote_handshake_port_list):
                for remote_tp_offset, remote_handshake_port in enumerate(remote_ports):
                    assert self.kv_recv_thread is not None
                    remote_host, remote_engine_id = self._get_remote_host_info_by_port(
                        meta.remote_port,
                        remote_handshake_port,
                        meta.remote_host,
                        meta.remote_engine_id,
                        meta.remote_multi_nodes_meta_mapping,
                    )
                    remote_port_send_num = (
                        self.remote_port_send_num[meta.remote_engine_id]
                        if meta.remote_pcp_size * meta.remote_dcp_size > 1
                        else None
                    )
                    local_block_ids_replicate_k_for_port = (
                        local_block_ids_replicate_k
                        if replicate_k_transfer_port is not None and remote_handshake_port == replicate_k_transfer_port
                        else None
                    )
                    remote_block_ids_replicate_k_for_port = (
                        remote_block_ids_replicate_k
                        if replicate_k_transfer_port is not None and remote_handshake_port == replicate_k_transfer_port
                        else None
                    )
                    self.kv_recv_thread.add_request(
                        request_id=req_id,
                        remote_request_id=remote_req_id,
                        local_block_ids=local_block_ids_list[pcp_dcp_rank],
                        remote_block_ids=remote_block_ids_list[pcp_dcp_rank],
                        group_pulls=group_pulls_list[pcp_dcp_rank][remote_tp_offset],
                        remote_engine_id=remote_engine_id,
                        remote_host=remote_host,
                        remote_handshake_port=remote_handshake_port,
                        remote_port_send_num=remote_port_send_num,
                        num_computed_tokens=meta.num_computed_tokens,
                        all_task_done=(
                            pcp_dcp_rank == len(remote_handshake_port_list) - 1
                            and remote_tp_offset == len(remote_ports) - 1
                        ),
                        shard_idx=pcp_dcp_rank,
                        remote_block_size=meta.remote_block_size,
                        local_block_ids_replicate_k=local_block_ids_replicate_k_for_port,
                        remote_block_ids_replicate_k=remote_block_ids_replicate_k_for_port,
                    )

        if self.kv_send_thread is not None and self.pcp_size * self.dcp_size == 1:
            for req_id, delay_start_time in metadata.requests_to_send.items():
                if self.tp_rank in self._prefill_get_remote_rank(req_id):
                    self.kv_send_thread.add_delayed_request(req_id, delay_start_time)
                else:
                    self.kv_send_thread.add_not_transfer_request(req_id)

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1150

    def _append_mamba_transfer_meta(
        self,
        src_list: list[int],
        dst_list: list[int],
        length_list: list[int],
        group_spec: dict[str, Any],
        src_layer_base_addr: list[int],
        dst_layer_base_addr: list[int],
        block_len: list[int],
        block_stride: list[int],
        remote_block_stride: list[int],
        remote_block_id: int,
        local_block_id: int,
        tp_num_need_pulls: int,
        remote_tp_offset: int,
    ) -> None:
        remote_tp_size = self.tp_size * tp_num_need_pulls
        assert remote_tp_size >= self.tp_size, "Mamba prefill TP size must be >= decode TP size."
        assert remote_tp_size % self.tp_size == 0, "Mamba prefill TP size must be divisible by decode TP size."

        remote_conv_addr, remote_ssm_addr = dst_layer_base_addr[:2]
        local_conv_addr, local_ssm_addr = src_layer_base_addr[:2]
        local_conv_len, local_ssm_len = block_len[:2]
        local_conv_stride, local_ssm_stride = block_stride[:2]
        remote_conv_stride, remote_ssm_stride = remote_block_stride[:2]

        tp_ratio = tp_num_need_pulls
        remote_conv_len = local_conv_len // tp_ratio
        remote_ssm_len = local_ssm_len // tp_ratio

        if tp_ratio == 1:
            src_list.extend(
                [
                    local_conv_addr + local_block_id * local_conv_stride,
                    local_ssm_addr + local_block_id * local_ssm_stride,
                ]
            )
            dst_list.extend(
                [
                    remote_conv_addr + remote_block_id * remote_conv_stride,

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L11-L43

    def get_transfer_engine(self, hostname: str, device_name: str | None):
        if self.transfer_engine is None:
            with self.transfer_engine_lock:
                # Double-Checked Locking
                if self.transfer_engine is None:
                    try:
                        from mooncake.engine import TransferEngine  # type: ignore
                    except ImportError as e:
                        raise ImportError(
                            "Please install mooncake by following the instructions at "
                            "https://github.com/kvcache-ai/Mooncake/blob/main/doc/en/build.md "  # noqa: E501
                            "to run vLLM with MooncakeConnector."
                        ) from e
                    self.transfer_engine = TransferEngine()
                    device_name = device_name if device_name is not None else ""
                    ret_value = self.transfer_engine.initialize(hostname, "P2PHANDSHAKE", "ascend", device_name)
                    if ret_value != 0:
                        raise RuntimeError(f"TransferEngine initialization failed with ret_value: {ret_value}")
        return self.transfer_engine

    def register_buffer(self, ptrs: list[int], sizes: list[int]):
        with self.register_buffer_lock:
            assert self.transfer_engine is not None, "Transfer engine must be initialized"
            if self.is_register_buffer:
                return
            for ptr, size in zip(ptrs, sizes):
                ret_value = self.transfer_engine.register_memory(ptr, size)
                if ret_value != 0:
                    raise RuntimeError("Mooncake memory registration failed.")
            self.is_register_buffer = True


global_te = GlobalTE()

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L55-L61

def get_transfer_timeout_value():
    ascend_transfer_timeout = os.getenv("ASCEND_TRANSFER_TIMEOUT", "")
    if len(ascend_transfer_timeout) > 0:
        return int(ascend_transfer_timeout)
    hccl_rdma_timeout = int(os.getenv("HCCL_RDMA_TIMEOUT", "20"))  # type: ignore
    hccl_rdma_retry_cnt = int(os.getenv("HCCL_RDMA_RETRY_CNT", "7"))  # type: ignore
    return int((4.096 * (2**hccl_rdma_timeout)) * hccl_rdma_retry_cnt // 1000 + 3000)

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L428-L445

def validate_register_region_count(regions: RegisterRegions) -> None:
    region_count = len(regions.ptrs)
    if region_count <= MAX_HCCL_REGISTER_REGIONS:
        return

    detail = f"registered_bytes={regions.registered_bytes}"
    if regions.logical_tensor_count is not None:
        detail += f", logical_tensors={regions.logical_tensor_count}, logical_bytes={regions.logical_total_bytes}"

    raise RuntimeError(
        "Mooncake register_buffer region count "
        f"{region_count} exceeds HCCL per-process limit "
        f"{MAX_HCCL_REGISTER_REGIONS}. "
        "KV cache registration would fail. "
        f"{detail}. "
        "Please reduce KV cache allocation fragmentation or merge "
        "k/v/dsa/scale allocations further."
    )

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L928-L990

    def update_state_after_alloc(self, request: "Request", blocks: "KVCacheBlocks", num_external_tokens: int):
        params = request.kv_transfer_params
        logger.debug(
            "MooncakeLayerwiseConnector update_state_after_alloc: num_external_tokens=%s, kv_transfer_params=%s",
            num_external_tokens,
            params,
        )

        if params is not None and params.get("do_remote_prefill"):
            do_virtual = params.get("do_virtual", False)
            local_block_ids = (blocks.get_block_ids()) if num_external_tokens > 0 else []
            remote_block_ids = self._trim_hybrid_remote_block_ids(local_block_ids, len(request.prompt_token_ids))
            remote_cached_tokens = request.num_computed_tokens
            # Get unhashed blocks to pull from remote.
            logger.debug(
                "MooncakeLayerwiseConnector update_state_after_alloc: add %s to need recv queue", request.request_id
            )
            self._reqs_need_recv[request.request_id] = (
                request,
                [],  # request._all_token_ids,
                local_block_ids,
            )

            params["do_remote_prefill"] = False

            logger.info("Send request: %s to proxy metaserver: %s", request.request_id, params.get("metaserver", None))
            # All parameters here should appear in the returned dict of
            # request_finished in the scheduler side except "request_id".
            # change the format of request_id if vllm-version >= 0.14.0
            external_req_id = get_external_request_id(request.request_id)
            kv_transfer_params = dict(
                token_ids=[],
                request_id=external_req_id,
                do_remote_prefill=False,
                do_remote_decode=True,
                remote_block_ids=remote_block_ids,
                remote_block_size=self.block_size,
                remote_engine_id=self.engine_id,
                remote_host=self.side_channel_host,
                remote_port=self.side_channel_port,
                remote_tp_size=self.vllm_config.parallel_config.tensor_parallel_size,
                remote_pcp_size=self.vllm_config.parallel_config.prefill_context_parallel_size,
                remote_dcp_size=self.vllm_config.parallel_config.decode_context_parallel_size,
                remote_cached_tokens=remote_cached_tokens,
            )
            if not do_virtual:
                future = self.executor.submit(
                    self._access_metaserver, url=params.get("metaserver", None), message=kv_transfer_params
                )

                def handle_exception(future):
                    if future.exception():
                        logger.error("Access metaserver fail. error=%s. ", future.exception())

                future.add_done_callback(handle_exception)

        # Layerwise prefiller add request need send
        if params is not None and params.get("do_remote_decode"):
            local_block_ids = list(blocks.get_block_ids())
            logger.debug(
                "MooncakeLayerwiseConnector update_state_after_alloc: add %s to need send queue", request.request_id
            )
            remote_cache_tokens = params["remote_cached_tokens"]

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1100-L1124

                    raise e

    def request_finished(
        self,
        request: "Request",
        block_ids: list[int],
    ) -> tuple[bool, dict[str, Any] | None]:
        """
        Once a request is finished, determine whether request blocks
        should be freed now or will be sent asynchronously and freed later.
        """
        # layer_wise push, not need delay_free_blocks
        return False, None

    def request_finished_all_groups(
        self,
        request: "Request",
        block_ids: tuple[list[int], ...],
    ) -> tuple[bool, dict[str, Any] | None]:
        """
        Once a request is finished, determine whether request blocks
        should be freed now or will be sent asynchronously and freed later.
        """
        # layer_wise push, not need delay_free_blocks
        return False, None

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L476-L528

            session_meta[session_id].src.extend(src_list)
            session_meta[session_id].dst.extend(dst_list)
            session_meta[session_id].length.extend(length_list)
            session_meta[session_id].req_ids.append(req_id)

        if send_task.k_quant_cache is not None:
            self.resharding_stream.synchronize()
        elif self.pd_head_ratio == 1:
            """
            Note: Due to a bug in ADXL, calling current_event.synchronize() may occasionally hang.
            This issue will be fixed in CANN version 8.5.rc1.
            You can manually build the master branch of the project at https://gitcode.com/cann/hixl
            to resolve this issue before the 8.5.RC1 release.
            """
            send_task.wait_event.synchronize()  # type:ignore
        elif self.pd_head_ratio > 1:
            self.resharding_stream.synchronize()

        for session_id, transfer_meta in session_meta.items():
            if len(transfer_meta.src) > 0:
                req_start_time = time.perf_counter()
                ret = self.engine.batch_transfer_sync_write(
                    session_id, transfer_meta.src, transfer_meta.dst, transfer_meta.length
                )
                if ret < 0:
                    logger.error(
                        "Mooncake transfer failed for send requests. req_ids=%s, destination=%s, ret=%d. ",
                        transfer_meta.req_ids,
                        session_id,
                        ret,
                    )
                    self.failed_reqs.add(req_id)
                else:
                    req_end_time = time.perf_counter()
                    total_transfer_size = sum(transfer_meta.length) / 1024
                    req_transfer_elapsed = (req_end_time - req_start_time) * 1000
                    logger.debug(
                        "Layer%d KV cache transfer task %dKB to remote_session_id [%s] took %.3f ms.",
                        send_task.layer_idx,
                        total_transfer_size,
                        session_id,
                        req_transfer_elapsed,
                    )
                if send_task.layer_idx == (self.total_layers - 1):
                    for req_id in transfer_meta.req_ids:
                        req_meta = send_task.send_request[req_id]
                        if req_meta.chunk_finish:
                            if req_id in self.failed_reqs:
                                self.callback_func(req_id, req_meta, layer_group_idx, trans_flag=False)
                                self.failed_reqs.discard(req_id)
                            else:
                                self.callback_func(req_id, req_meta, layer_group_idx, trans_flag=True)


vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1690-L1840

    def save_kv_layer(
        self,
        layer_name: str,
        kv_layer: list[torch.Tensor],
        attn_metadata: "AttentionMetadata",
        connector_metadata: MooncakeLayerwiseConnectorMetadata,
        **kwargs,
    ) -> None:
        """MooncakeLayerwiseConnector does not save explicitly."""
        if self.vllm_config.kv_transfer_config.is_kv_producer and connector_metadata.requests.keys():
            if self.current_layer >= self.total_layers:
                self.current_layer += 1
                return
            # get reshape and cache event
            if layer_name == "":
                layer_name = self.index_to_name[self.current_layer][0]
            if (
                isinstance(attn_metadata, dict)
                and hasattr(attn_metadata[layer_name], "reshape_cache_event")
                and attn_metadata[layer_name].reshape_cache_event is not None
            ):
                reshape_cache_event = attn_metadata[layer_name].reshape_cache_event
            elif (
                attn_metadata
                and hasattr(attn_metadata, "reshape_cache_event")
                and attn_metadata.reshape_cache_event is not None
            ):
                reshape_cache_event = attn_metadata.reshape_cache_event
            else:
                reshape_cache_event = torch.npu.Event()
                reshape_cache_event.record()
            send_task = connector_metadata.send_task
            layer_group_idx = self.layer_metadata[layer_name].tensor_group_idx[0]
            keys = None
            values = None
            quant_keys = None
            quant_values = None
            if (
                (
                    self.pd_head_ratio != 1
                    and (isinstance(self.kv_cache_specs[layer_group_idx], (FullAttentionSpec, SlidingWindowSpec)))
                    and send_task.group_num_blocks[layer_group_idx] > 0
                )
                or (self.enable_c8_quant and self.current_layer in self.vllm_config.quant_config.c8_quant_layers)
                or (self.enable_kv_quant and self.current_layer in self.vllm_config.quant_config.kvcache_quant_layers)
            ):
                assert self.resharding_stream is not None
                with npu_stream_switch(self.resharding_stream):
                    reshape_cache_event.wait()
                    device = self.k_buffer.device  # type: ignore
                    # Initialize buffers
                    keys = torch.empty(
                        (send_task.group_num_tokens[layer_group_idx], *kv_layer[0].size()[-2:]),
                        dtype=kv_layer[0].dtype,
                        device=device,
                    )
                    values = torch.empty(
                        (send_task.group_num_tokens[layer_group_idx], *kv_layer[1].size()[-2:]),
                        dtype=kv_layer[1].dtype,
                        device=device,
                    )

                    # Load cache data into buffers
                    torch_npu.atb.npu_paged_cache_load(
                        kv_layer[0],
                        kv_layer[1],
                        send_task.group_block_table[layer_group_idx],
                        send_task.group_block_len_tensor[layer_group_idx],
                        seq_starts=send_task.group_seq_start_tensor[layer_group_idx],
                        key=keys,
                        value=values,
                    )
                    if self.pd_head_ratio != 1:
                        # sort kv caches for each block
                        keys = (
                            keys.view(
                                send_task.group_num_blocks[layer_group_idx], self.pd_head_ratio, -1, *keys.shape[1:]
                            )
                            .transpose(0, 1)
                            .reshape_as(keys)
                        )
                        values = (
                            values.view(
                                send_task.group_num_blocks[layer_group_idx], self.pd_head_ratio, -1, *values.shape[1:]
                            )
                            .transpose(0, 1)
                            .reshape_as(values)
                        )
                        # reshard kv cache
                        keys = keys.reshape(-1, *kv_layer[0].shape[2:])
                        values = values.reshape(-1, *kv_layer[1].shape[2:])

                        (keys, values) = kv_alltoall_and_rearrange(self.pd_head_ratio, keys, values)
                    if self.enable_c8_quant:
                        layer = self.vllm_config.compilation_config.static_forward_context[layer_name]
                        quant_keys = torch.clamp(
                            torch.round(keys * layer._c8_k_inv_scale + layer._c8_k_offset),
                            -128,
                            127,
                        ).to(torch.int8)
                        quant_values = torch.clamp(
                            torch.round(values * layer._c8_v_inv_scale + layer._c8_v_offset),
                            -128,
                            127,
                        ).to(torch.int8)
                        quant_keys = self.get_nz_cache(quant_keys, layer_group_idx)
                        quant_values = self.get_nz_cache(quant_values, layer_group_idx)
                    if (
                        self.enable_kv_quant
                        and self.current_layer in self.vllm_config.quant_config.kvcache_quant_layers
                    ):
                        layer = self.vllm_config.compilation_config.static_forward_context[layer_name]
                        keys = torch.ops.vllm.quantize(
                            keys, layer.fak_descale, layer.fak_descale_reciprocal, layer.fak_offset
                        )
                        quant_keys = self.get_nz_cache(keys, layer_group_idx)
                        quant_values = self.get_nz_cache(values, layer_group_idx)

            assert self.kv_send_layer_thread is not None
            assert reshape_cache_event is not None
            layer_send_task = SendTask(
                wait_event=reshape_cache_event,
                k_cache=keys,
                v_cache=values,
                k_quant_cache=quant_keys,
                v_quant_cache=quant_values,
                layer_idx=self.current_layer,
                layer_name=layer_name,
                group_rearrange_block_ids=send_task.group_rearrange_block_ids,
            )
            for req_id, req_meta in connector_metadata.requests.items():
                if len(req_meta.local_block_ids[layer_group_idx]) == 0:
                    continue
                try:
                    req_meta_update = self.update_decoder_info(req_id, req_meta)
                except Exception as e:
                    logger.warning(
                        "MooncakeLayerwiseConnector transfer fail. req_id=%s, layer_idx=%s, error=%s. ",
                        req_id,
                        self.current_layer,
                        e,
                    )
                    continue
                logger.debug("Add request %s to kv send layer thread. req_meta_update=%r", req_id, req_meta_update)
                layer_send_task.send_request[req_id] = req_meta_update

            self.kv_send_layer_thread.send_queue.put(layer_send_task)
            self.current_layer += 1

    # NOTE: Due to the FIA operator constraints, the expected kv cache is ND format, NZ shape,
    # while the npu_format_cast method only modifies the memory layout, we manually convert it to NZ shape here

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1340-L1432

        mtp_layer_name = ""
        for layer_name in kv_caches:
            if "mtp" in layer_name:
                mtp_layer_name = layer_name
                continue
            self.index_to_name[extract_layer_index(layer_name, num_attn_module)].append(layer_name)
            assert len(self.index_to_name[extract_layer_index(layer_name, num_attn_module)]) == 1, (
                "Mooncake Layerwise Connector does not support multiple `attn_module` in one layer now."
            )
        if mtp_layer_name != "":
            self.index_to_name[max(self.index_to_name.keys()) + 1].append(mtp_layer_name)
        if self.total_layers < len(self.layer_metadata.keys()):
            self.total_layers = len(self.layer_metadata.keys())

        # After KV Caches registered, start the sending or receiving thread.
        metadata = MooncakeAgentMetadata(
            te_rpc_port=self.te_rpc_port,
            layer_metadata=self.layer_metadata,
        )
        if self.vllm_config.kv_transfer_config.is_kv_producer:
            ready_event = threading.Event()
            self.kv_send_layer_thread = KVCacheSendingLayerThread(
                engine=self.engine,
                vllm_config=self.vllm_config,
                kv_cache_config=self.kv_cache_config,
                kv_cache_specs=self.kv_cache_specs,
                attn_resharding_group_idx=self.attn_resharding_group_idx,
                total_layers=self.total_layers,
                ready_event=ready_event,
                tp_size=self.tp_size,
                tp_rank=self.tp_rank,
                pd_head_ratio=self.pd_head_ratio,
                num_head_replica=self.num_head_replica,
                layer_metadata=self.layer_metadata,
                use_mla=self.use_mla,
                use_attn_mamba_hybrid=self.use_attn_mamba_hybrid,
                k_buffer=self.k_buffer,
                v_buffer=self.v_buffer,
                enable_kv_quant=self.enable_kv_quant,
                enable_c8_quant=self.enable_c8_quant,
                resharding_stream=self.resharding_stream,
                callback_func=self.send_done_send_signal,
            )
            self.kv_send_layer_thread.start()
            ready_event.wait()

        if self.vllm_config.kv_transfer_config.is_kv_consumer:
            ready_event = threading.Event()
            self.kv_recv_layer_thread = KVCacheRecvingLayerThread(
                self.tp_rank,
                self.side_channel_port,
                self.tp_size,
                self.pd_head_ratio,
                self.engine_id,
                metadata,
                ready_event,
            )
            self.kv_recv_layer_thread.start()
            ready_event.wait()

    def get_finished(self) -> tuple[set[str], set[str]]:
        done_recving = (
            self.kv_recv_layer_thread.get_and_clear_done_requests(  # type: ignore[union-attr]
            )
            if self.vllm_config.kv_transfer_config.is_kv_consumer
            else set()
        )
        done_recving = {self.request_map[s] for s in done_recving if s in self.request_map}
        done_recving.update(self.virtual_request)
        self.virtual_request = set()

        failed_recving = (
            self.kv_recv_layer_thread.get_and_clear_failed_requests()
            if self.vllm_config.kv_transfer_config.is_kv_consumer and self.kv_recv_layer_thread is not None
            else set()
        )
        failed_recving = {self.request_map[s] for s in failed_recving if s in self.request_map}
        for req_id in failed_recving:
            if meta := self._recving_metadata.get(req_id):
                self._invalid_block_ids.update(block_id for group in meta.local_block_ids for block_id in group)
        for req_id in done_recving.union(failed_recving):
            org_req_id = req_id[:-9]
            self.request_map.pop(org_req_id, None)
            self._recving_metadata.pop(req_id, None)
        if len(done_recving) > 0:
            logger.info(
                "Number of completed KV cache recv requests: %s, receive requests: %s", len(done_recving), done_recving
            )
        return set(), done_recving

    def get_block_ids_with_load_errors(self) -> set[int]:
        """
        Return and clear the set of block IDs that failed to load.

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L805-L815

                "Prefill context parallel is not support on decoder nodes"
            )

        # Handshake base port
        self.side_channel_port = (
            vllm_config.kv_transfer_config.kv_port
            + vllm_config.parallel_config.data_parallel_rank * vllm_config.parallel_config.tensor_parallel_size
        )

        # Requests that need to start recv.
        # New requests are added by update_state_after_alloc in

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1160-L1170

        else:
            self.total_num_kv_heads = self.vllm_config.model_config.get_total_num_kv_heads()

        # Handshake base port
        self.side_channel_port = (
            vllm_config.kv_transfer_config.kv_port
            + self.dp_rank * self.pcp_size * self.tp_size
            + self.pcp_rank * self.tp_size
        )
        self.handshake_port = self.side_channel_port + self.tp_rank
        self.sockets: dict = {}

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1522-L1547

        # Mamba metadata
        self._is_mamba_group = [isinstance(group.kv_cache_spec, MambaSpec) for group in kv_cache_config.kv_cache_groups]
        mamba_ssm_size = (0, 0)
        self.use_mamba = any(self._is_mamba_group)
        if self.use_mamba:
            assert self.use_hybrid
            assert self._prefill_tp_size == self._decode_tp_size, (
                "Mooncake connector does not support different TP size with Mamba."
            )
            self.layer_specs = {
                layer: group.kv_cache_spec for group in kv_cache_config.kv_cache_groups for layer in group.layer_names
            }
            mamba_spec = next(spec for spec in self.layer_specs.values() if isinstance(spec, MambaSpec))
            conv_nbytes, ssm_nbytes = (
                torch.tensor([], dtype=mamba_spec.dtypes[0]).element_size(),  # type: ignore[misc]
                torch.tensor([], dtype=mamba_spec.dtypes[1]).element_size(),  # type: ignore[misc]
            )
            conv_shape, ssm_shape = (
                torch.Size(mamba_spec.shapes[0]),
                torch.Size(mamba_spec.shapes[1]),
            )
            mamba_ssm_size = (
                conv_shape.numel() * conv_nbytes,
                ssm_shape.numel() * ssm_nbytes,
            )
        self._mamba_ssm_size = mamba_ssm_size

vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L210-L237

        self.pd_tp_ratio = 1
        self.pd_head_ratio = 1
        self.num_head_replica = 1
        if (
            vllm_config.kv_transfer_config is not None
            and vllm_config.model_config is not None
            and not vllm_config.model_config.is_deepseek_mla
        ):
            prefill_tp_size = vllm_config.kv_transfer_config.get_from_extra_config("prefill", {"tp_size": 1})["tp_size"]
            decode_tp_size = vllm_config.kv_transfer_config.get_from_extra_config("decode", {"tp_size": 1})["tp_size"]
            assert prefill_tp_size % decode_tp_size == 0, "Prefill TP size must be divisible by Decode TP size."
            self.pd_tp_ratio = prefill_tp_size // decode_tp_size
            if self.pd_tp_ratio > 1:
                # Total KV heads from vLLM's resolved architecture (ModelArchConfigConvertor).
                num_kv_head = vllm_config.model_config.get_total_num_kv_heads()
                if not num_kv_head or num_kv_head < 1:
                    raise ValueError(
                        "Could not determine a positive total KV head count for PD "
                        "disaggregation (pd_tp_ratio > 1). Check that the model config "
                        "is compatible with vLLM."
                    )
                self.num_head_replica = prefill_tp_size // num_kv_head if prefill_tp_size >= num_kv_head else 1
                prefill_tp_size = min(prefill_tp_size, num_kv_head)
                decode_tp_size = min(decode_tp_size, num_kv_head)
                self.pd_head_ratio = prefill_tp_size // decode_tp_size

            if self.pd_tp_ratio == 0:
                raise AssertionError("Only support P node tp size lagger then D node tp size")

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L125-L150

        # ASCEND_ENABLE_USE_FABRIC_MEM: Enable unified memory address direct transmission scheme
        # and only can be used for 800 I/T A3 series.
        # Required supporting hardware versions are as follows:
        if not self._use_fabric_mem:
            transfer_engine = global_te.get_transfer_engine(local_hostname, device_name=None)
            self.local_seg = local_hostname + ":" + str(transfer_engine.get_rpc_port())
            ret = store.setup(
                local_hostname=self.local_seg,
                metadata_server=self.config.metadata_server,
                global_segment_size=self.config.global_segment_size if self._contribute_memory else 0,
                local_buffer_size=self.config.local_buffer_size if self._contribute_memory else 0,
                protocol=self.config.protocol,
                rdma_devices=self.config.device_name,
                master_server_addr=self.config.master_server_address,
                engine=transfer_engine.get_engine(),
                **ssd_kwargs,
            )
        else:
            self.local_seg = local_hostname
            ret = store.setup(
                local_hostname=self.local_seg,
                metadata_server=self.config.metadata_server,
                global_segment_size=self.config.global_segment_size if self._contribute_memory else 0,
                local_buffer_size=0,
                protocol=self.config.protocol,
                rdma_devices=self.config.device_name,

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L180-L250

    def register_buffer(self, ptrs: list[int], lengths: list[int]):
        if not self._use_fabric_mem:
            local_hostname = get_ip()
            global_te.get_transfer_engine(local_hostname, device_name=None)
            global_te.register_buffer(ptrs, lengths)

    def exists(self, keys: list[str]) -> list[int]:
        if self._lazy_init and not self._store_initialized:
            logger.debug(
                "MooncakeBackend.exists called before store initialization; treating %d keys as missing.",
                len(keys),
            )
            return [0] * len(keys)
        assert self.store is not None
        return self.store.batch_is_exist(keys)

    def put(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        self.ensure_initialized()
        assert self.store is not None
        try:
            config = ReplicateConfig()
            if self.config.preferred_segment:
                config.preferred_segment = self.local_seg
            config.prefer_alloc_in_same_node = self.config.prefer_alloc_in_same_node
            res = self.store.batch_put_from_multi_buffers(keys, addrs, sizes, config)
            failed_codes = [int(value) for value in res if value < 0]
            failed_count = len(failed_codes)
            if failed_count:
                error_codes = sorted(set(failed_codes))
                logger.error(
                    "Failed to put %d keys out of %d. error_codes=%s. Check memory and store capacity.",
                    failed_count,
                    len(keys),
                    error_codes,
                )
                logger.debug("Failed to put key details. keys=%s, result=%s", keys, res)
                if self._lazy_init:
                    logger.warning("First DSV4(compress) request failure is expected. This is normal behavior.")
        except Exception as e:
            logger.error(
                "Failed to put %d keys out of %d. type=%s, error=%s. Check store state and memory.",
                len(keys),
                len(keys),
                type(e).__name__,
                e,
            )
            logger.debug("Failed to put key details. keys=%s", keys)
            if self._lazy_init:
                logger.warning("First DSV4(compress) request failure is expected. This is normal behavior.")

    def get(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        if self._lazy_init and not self._store_initialized:
            logger.error(
                "Failed to get %d keys out of %d. Store is not initialized; "
                "call put() first to trigger initialization.",
                len(keys),
                len(keys),
            )
            logger.debug("Failed to get key details. keys=%s", keys)
            return
        assert self.store is not None
        logger.debug(
            "MooncakeBackend.get enter keys=%d sample_keys=%s",
            len(keys),
            keys[:3],
        )
        try:
            res = self.store.batch_get_into_multi_buffers(keys, addrs, sizes)
            res_list = list(res)
            failed_codes = [int(value) for value in res_list if value < 0]
            failed_count = len(failed_codes)

vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L428-L460

def wait_for_kv_layer_from_connector(layer_name: str):
    if not has_kv_transfer_group() or not is_v1_kv_transfer_group():
        return

    connector = get_kv_transfer_group()

    forward_context: ForwardContext = get_forward_context()
    attn_metadata = forward_context.attn_metadata
    if attn_metadata is None:
        return
    # TODO: assert ascendMetadata
    connector.wait_for_layer_load(layer_name)


def maybe_save_kv_layer_to_connector(
    layer_name: str,
    kv_cache_layer: list[torch.Tensor],
):
    if not has_kv_transfer_group() or not is_v1_kv_transfer_group():
        return

    connector = get_kv_transfer_group()

    forward_context: ForwardContext = get_forward_context()
    attn_metadata = forward_context.attn_metadata
    if attn_metadata is None:
        return
    # TODO: assert ascendMetadata
    connector.save_kv_layer(layer_name, kv_cache_layer, attn_metadata)


def notify_kv_cache_written(layer_name: str = ""):
    """Notify the connector that the paged KV cache for ``layer_name`` has been

vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L55

def register_connector():
    # override multi_connector as ascend_multi_connector
    if "MultiConnector" in KVConnectorFactory._registry:
        KVConnectorFactory._registry.pop("MultiConnector")
    KVConnectorFactory.register_connector(
        "MultiConnector", "vllm_ascend.distributed.kv_transfer.ascend_multi_connector", "AscendMultiConnector"
    )

    KVConnectorFactory.register_connector(
        "MooncakeConnectorV1", "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_connector", "MooncakeConnector"
    )

    KVConnectorFactory.register_connector(
        "MooncakeHybridConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_hybrid_connector",
        "MooncakeConnector",
    )

    KVConnectorFactory.register_connector(
        "MooncakeConnectorStoreV1",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )

    KVConnectorFactory.register_connector(
        "AscendStoreConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )

    KVConnectorFactory.register_connector(
        "MooncakeLayerwiseConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_layerwise_connector",
        "MooncakeLayerwiseConnector",
    )

vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L85-L93

        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )

    KVConnectorFactory.register_connector(
        "SfaRemoteD2HConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.sfa_pd_rd2h.connector",
        "SfaRemoteD2HConnector",
    )

vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L60

    KVConnectorFactory.register_connector(
        "MooncakeConnectorV1", "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_connector", "MooncakeConnector"
    )

    KVConnectorFactory.register_connector(
        "MooncakeConnectorV2",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake.connector",
        "MooncakeConnector",
    )

    KVConnectorFactory.register_connector(
        "MooncakePullConnector",
        "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake.connector",
        "MooncakePullConnector",
    )


vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L228-L261

class MooncakePullConnector(MooncakeBaseConnector):
    """Pull-based Mooncake KV transfer connector."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        super().__init__(vllm_config, role, kv_cache_config)

        if role == KVConnectorRole.SCHEDULER:
            self.connector_scheduler = MooncakePullConnectorScheduler(vllm_config, str(self.engine_id), kv_cache_config)
        elif role == KVConnectorRole.WORKER:
            self.connector_worker = MooncakePullConnectorWorker(vllm_config, str(self.engine_id), kv_cache_config)
        else:
            raise ValueError(f"Unsupported KVConnectorRole: {role}")


class MooncakePushConnector(MooncakeBaseConnector):
    """Placeholder for the not-yet-implemented push-based connector."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        raise NotImplementedError("MooncakePushConnector is not implemented yet.")


# Backward compatibility: MooncakeConnector is the pull-based connector.
MooncakeConnector = MooncakePullConnector


vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L60-L70

        self.ascend_config = get_ascend_config()

        self.local_ip = get_ip()
        self.side_channel_host = self.local_ip
        self.pp_size = vllm_config.parallel_config.pipeline_parallel_size
        self.tp_size = vllm_config.parallel_config.tensor_parallel_size
        self.pcp_size = vllm_config.parallel_config.prefill_context_parallel_size
        assert self.pcp_size == 1, f"Mooncake temporarily requires prefill context parallel size 1, got {self.pcp_size}"
        self.dcp_size = vllm_config.parallel_config.decode_context_parallel_size
        self.max_device_id = (
            self.tp_size

vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L15-L55

## Usage

vLLM Ascend currently supports two types of connectors for handling KV cache management:  

- **MooncakeConnector**: D nodes pull KV cache from P nodes.
- **MooncakeLayerwiseConnector**: P nodes push KV cache to D nodes in a layered manner.  

For step-by-step deployment and configuration, refer to the following guide:  
[https://docs.vllm.ai/projects/ascend/en/latest/tutorials/features/pd_disaggregation_mooncake_multi_node.html](https://docs.vllm.ai/projects/ascend/en/latest/tutorials/features/pd_disaggregation_mooncake_multi_node.html)

---

## How It Works

### 1. Design Approach

Under the disaggregated-prefill, a global proxy receives external requests, forwarding prefill to P nodes and decode to D nodes; the KV cache (key-value cache) is exchanged between P and D nodes via peer-to-peer (P2P) communication.

### 2. Implementation Design

Our design diagram is shown below, illustrating the pull and push schemes respectively.
![alt text](../../assets/disaggregated_prefill_pull.png)
![alt text](../../assets/disaggregated_prefill_push.png)

#### Mooncake Connector

1. The request is sent to the Proxy's `_handle_completions` endpoint.
2. The Proxy calls `select_prefiller` to choose a P node and forwards the request, configuring `kv_transfer_params` with `do_remote_decode=True`, `max_completion_tokens=1`, and `min_tokens=1`.
3. After the P node's scheduler finishes prefill, `update_from_output` invokes the schedule connector's `request_finished` to defer KV cache release, constructs `kv_transfer_params` with `do_remote_prefill=True`, and returns to the Proxy.
4. The Proxy calls `select_decoder` to choose a D node and forwards the request.
5. On the D node, the scheduler marks the request as `RequestStatus.WAITING_FOR_REMOTE_KVS`, pre-allocates KV cache, calls `kv_connector_no_forward` to pull the remote KV cache, then notifies the P node to release KV cache and proceeds with decoding to return the result.

#### Mooncake Layerwise Connector

1. The request is sent to the Proxy's `_handle_completions` endpoint.
2. The Proxy calls `select_decoder` to choose a D node and forwards the request, configuring `kv_transfer_params` with `do_remote_prefill=True` and setting the `metaserver` endpoint.
3. On the D node, the scheduler uses `kv_transfer_params` to mark the request as `RequestStatus.WAITING_FOR_REMOTE_KVS`, pre-allocates KV cache, then calls `kv_connector_no_forward` to send a request to the metaserver and waits for the KV cache transfer to complete.
4. The Proxy's `metaserver` endpoint receives the request, calls `select_prefiller` to choose a P node, and forwards it with `kv_transfer_params` set to `do_remote_decode=True`, `max_completion_tokens=1`, and `min_tokens=1`.
5. During processing, the P node's scheduler pushes KV cache layer-wise; once all layers pushing is complete, it releases the request and notifies the D node to begin decoding.
6. The D node performs decoding and returns the result.


vllm-ascend@db701c1f:docs/source/tutorials/features/pd_disaggregation_mooncake_single_node.md#L172-L186

  --kv-transfer-config \
  '{"kv_connector": "MooncakeConnectorV1",
  "kv_role": "kv_producer",
  "kv_port": "30000",
  "kv_connector_extra_config": {
            "prefill": {
                    "dp_size": 1,
                    "tp_size": 1
             },
             "decode": {
                    "dp_size": 1,
                    "tp_size": 1
             }
      }
  }'

vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L36-L62

Layerwise mode currently requires the **memcache** backend
(`backend: "memcache"`). Install and configure memcache_hybrid before
proceeding — see the [KV Pool guide](kv_pool.md) for memcache installation,
config files (`mmc-meta.conf` / `mmc-local.conf`), and MetaService startup.

Additional setup:

```bash
# Huge pages (required by memcache device transfer)
echo 200000 > /proc/sys/vm/nr_hugepages

# Source memcache environment
source /usr/local/memcache_hybrid/set_env.sh
source /usr/local/memfabric_hybrid/set_env.sh

# Uniform hashing across nodes
export PYTHONHASHSEED=0
```

## Configuration

Add `use_layerwise: true` to the `AscendStoreConnector` extra config:

```json
{
    "kv_connector": "AscendStoreConnector",
    "kv_role": "kv_both",

vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L185-L200


python -m vllm.entrypoints.openai.api_server \
  --model /path/to/model \
  --tensor-parallel-size 2 \
  --enforce-eager \
  --kv-transfer-config '{
    "kv_connector": "AscendStoreConnector",
    "kv_role": "kv_both",
    "kv_connector_extra_config": {
      "backend": "mooncake",
      "use_layerwise": true,
      "layerwise_prefetch_layers": 2,
      "layerwise_max_transfer_blocks": 64,
      "layerwise_max_transfer_bytes": 16777216
    }
  }'

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1194

    def _append_mamba_transfer_meta(
        self,
        src_list: list[int],
        dst_list: list[int],
        length_list: list[int],
        group_spec: dict[str, Any],
        src_layer_base_addr: list[int],
        dst_layer_base_addr: list[int],
        block_len: list[int],
        block_stride: list[int],
        remote_block_stride: list[int],
        remote_block_id: int,
        local_block_id: int,
        tp_num_need_pulls: int,
        remote_tp_offset: int,
    ) -> None:
        remote_tp_size = self.tp_size * tp_num_need_pulls
        assert remote_tp_size >= self.tp_size, "Mamba prefill TP size must be >= decode TP size."
        assert remote_tp_size % self.tp_size == 0, "Mamba prefill TP size must be divisible by decode TP size."

        remote_conv_addr, remote_ssm_addr = dst_layer_base_addr[:2]
        local_conv_addr, local_ssm_addr = src_layer_base_addr[:2]
        local_conv_len, local_ssm_len = block_len[:2]
        local_conv_stride, local_ssm_stride = block_stride[:2]
        remote_conv_stride, remote_ssm_stride = remote_block_stride[:2]

        tp_ratio = tp_num_need_pulls
        remote_conv_len = local_conv_len // tp_ratio
        remote_ssm_len = local_ssm_len // tp_ratio

        if tp_ratio == 1:
            src_list.extend(
                [
                    local_conv_addr + local_block_id * local_conv_stride,
                    local_ssm_addr + local_block_id * local_ssm_stride,
                ]
            )
            dst_list.extend(
                [
                    remote_conv_addr + remote_block_id * remote_conv_stride,
                    remote_ssm_addr + remote_block_id * remote_ssm_stride,
                ]
            )
            length_list.extend([remote_conv_len, remote_ssm_len])
            return

        conv_shape = group_spec["shapes"][0]
        conv_dtype_size = group_spec["dtype_sizes"][0]

        linear_key_head_dim = self.vllm_config.model_config.hf_text_config.linear_key_head_dim
        linear_num_key_heads = self.vllm_config.model_config.hf_text_config.linear_num_key_heads
        linear_value_head_dim = self.vllm_config.model_config.hf_text_config.linear_value_head_dim
        linear_num_value_heads = self.vllm_config.model_config.hf_text_config.linear_num_value_heads
        remote_num_key_heads = linear_num_key_heads // remote_tp_size
        remote_num_value_heads = linear_num_value_heads // remote_tp_size
        remote_conv_width = (
            remote_num_key_heads * 2 * linear_key_head_dim + remote_num_value_heads * linear_value_head_dim
        )
        remote_conv_offsets = [
            0,
            remote_num_key_heads * linear_key_head_dim,
            remote_num_key_heads * 2 * linear_key_head_dim,
        ]
        remote_conv_sizes = [
            remote_num_key_heads * linear_key_head_dim,
            remote_num_key_heads * linear_key_head_dim,
            remote_num_value_heads * linear_value_head_dim,
        ]

        for i in range(conv_shape[0]):
            for remote_conv_offset, remote_conv_size in zip(remote_conv_offsets, remote_conv_sizes):
                remote_addr_offset = (i * remote_conv_width + remote_conv_offset) * conv_dtype_size
                local_addr_offset = (
                    (i * remote_conv_width + remote_conv_offset) * tp_ratio + remote_tp_offset * remote_conv_size
                ) * conv_dtype_size
                src_list.append(local_conv_addr + local_block_id * local_conv_stride + local_addr_offset)
                dst_list.append(remote_conv_addr + remote_block_id * remote_conv_stride + remote_addr_offset)
                length_list.append(remote_conv_size * conv_dtype_size)

        src_list.append(
            local_ssm_addr + local_block_id * local_ssm_stride + remote_tp_offset * local_ssm_len // tp_num_need_pulls
        )
        dst_list.append(remote_ssm_addr + remote_block_id * remote_ssm_stride)
        length_list.append(remote_ssm_len)

vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1200-L1206

        # Handshake base port
        self.side_channel_port = (
            vllm_config.kv_transfer_config.kv_port
            + vllm_config.parallel_config.data_parallel_rank
            * vllm_config.parallel_config.tensor_parallel_size
            * vllm_config.parallel_config.pipeline_parallel_size
        )

vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1334-L1341

        # Handshake base port
        self.side_channel_port = (
            vllm_config.kv_transfer_config.kv_port
            + vllm_config.parallel_config.data_parallel_rank
            * vllm_config.parallel_config.tensor_parallel_size
            * vllm_config.parallel_config.pipeline_parallel_size
            * vllm_config.parallel_config.prefill_context_parallel_size
        )

vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1715-L1723

        # Handshake base port
        self.side_channel_port = (
            vllm_config.kv_transfer_config.kv_port
            + vllm_config.parallel_config.data_parallel_rank
            * vllm_config.parallel_config.tensor_parallel_size
            * vllm_config.parallel_config.pipeline_parallel_size
            * vllm_config.parallel_config.prefill_context_parallel_size
        )
        device_index = (self.pp_rank * self.pcp_size + self.pcp_rank) * self.tp_size + self.tp_rank

vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L577-L587

    def has_pending_push_work(self) -> bool:
        """Return True if the connector has push-mode work that requires
        the engine main loop to keep stepping (e.g. a P-side request whose
        KV blocks are waiting to be WRITTEN to a D node).

        Connectors that don't implement push-based KV transfer should
        leave this as False.
        """
        # TODO: replace with a more general connector hook for keeping the
        # scheduler alive (e.g. extend has_unfinished_requests).
        return False

vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2313-L2324

    def has_requests(self) -> bool:
        # Override the interface default to also keep the engine alive while a
        # connector still has pending push work (e.g. push-mode WRITE transfers
        # in flight after all "live" requests have finished). Without this hook
        # the engine would quiesce before the connector can drain completions.
        # TODO: replace with a more general mechanism for connectors to keep
        # the scheduler alive.
        return (
            self.has_unfinished_requests()
            or self.has_finished_requests()
            or (self.connector is not None and self.connector.has_pending_push_work())
        )

vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1194-L1196

        self.pcp_size = vllm_config.parallel_config.prefill_context_parallel_size
        self.dcp_size = vllm_config.parallel_config.decode_context_parallel_size
        assert self.pcp_size * self.dcp_size == 1, "Mooncake Hybrid Connector only support cp_world_size == 1. "

vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1325-L1328

        self.pcp_size = vllm_config.parallel_config.prefill_context_parallel_size
        self.dcp_size = vllm_config.parallel_config.decode_context_parallel_size
        assert self.dcp_size == 1, "Mooncake Hybrid Connector requires decode_context_parallel_size=1."
        self.max_device_id = (

vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1662-L1666

        self.pcp_rank = get_pcp_group().rank_in_group
        self.dcp_size = vllm_config.parallel_config.decode_context_parallel_size
        assert self.dcp_size == 1, "Mooncake Hybrid Connector requires decode_context_parallel_size=1."
        assert not (self.pp_size > 1 and self.pcp_size > 1), "pp and pcp cannot open in same time"
        self.kv_caches: dict[str, torch.Tensor] = {}

vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L247-L260

class MooncakePushConnector(MooncakeBaseConnector):
    """Placeholder for the not-yet-implemented push-based connector."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        raise NotImplementedError("MooncakePushConnector is not implemented yet.")


# Backward compatibility: MooncakeConnector is the pull-based connector.
MooncakeConnector = MooncakePullConnector

vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L17-L20

vLLM Ascend currently supports two types of connectors for handling KV cache management:  

- **MooncakeConnector**: D nodes pull KV cache from P nodes.
- **MooncakeLayerwiseConnector**: P nodes push KV cache to D nodes in a layered manner.  

vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L90-L114

        self.tp_rank = get_tensor_model_parallel_rank()
        self.tp_size = vllm_config.parallel_config.tensor_parallel_size
        self.tp_group = get_tp_group()
        self.pp_rank = get_pp_group().rank_in_group
        self.pp_size = vllm_config.parallel_config.pipeline_parallel_size
        self.dp_rank = vllm_config.parallel_config.data_parallel_rank_local
        if self.dp_rank is None:
            raise ValueError("Mooncake worker requires a local DP rank")
        self.dp_size = vllm_config.parallel_config.data_parallel_size_local
        pcp_group = get_pcp_group()
        self.pcp_rank = pcp_group.rank_in_group
        self.pcp_size = pcp_group.world_size
        self.dcp_size = get_decode_context_model_parallel_world_size()
        self.dcp_rank = get_decode_context_model_parallel_rank() if self.dcp_size > 1 else 0

        self.max_device_id = self.tp_size * self.dp_size * self.pcp_size * self.pp_size
        self.side_channel_host = get_ip()
        self.side_channel_port = (
            self.kv_transfer_config.kv_port
            + vllm_config.parallel_config.data_parallel_rank * self.tp_size * self.pp_size * self.pcp_size
        )
        device_index = (self.pp_rank * self.pcp_size + self.pcp_rank) * self.tp_size + self.tp_rank
        self.handshake_port = self.side_channel_port + device_index

        device_name = str(torch.npu.current_device()) if self.pp_size > 1 else None

vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L42-L90

        vllm_config: VllmConfig,
        engine_id: str,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        assert vllm_config.kv_transfer_config is not None

        self.vllm_config = vllm_config
        self.kv_transfer_config = vllm_config.kv_transfer_config
        if self.kv_transfer_config.is_kv_consumer == self.kv_transfer_config.is_kv_producer:
            raise ValueError(
                f"Mooncake scheduler requires exactly one KV transfer role, got {self.kv_transfer_config.kv_role!r}"
            )
        self.kv_cache_config = kv_cache_config
        self.engine_id = engine_id
        self.block_size = vllm_config.cache_config.block_size
        self.num_speculative_tokens = (
            vllm_config.speculative_config.num_speculative_tokens if vllm_config.speculative_config is not None else 0
        )

        init_ascend_config(vllm_config)
        self.ascend_config = get_ascend_config()

        self.local_ip = get_ip()
        self.side_channel_host = self.local_ip
        self.pp_size = vllm_config.parallel_config.pipeline_parallel_size
        self.tp_size = vllm_config.parallel_config.tensor_parallel_size
        self.pcp_size = vllm_config.parallel_config.prefill_context_parallel_size
        self.dcp_size = vllm_config.parallel_config.decode_context_parallel_size
        self.max_device_id = (
            self.tp_size
            * vllm_config.parallel_config.data_parallel_size
            * self.pcp_size
            * vllm_config.parallel_config.pipeline_parallel_size
        )

        # Worker handshake ports occupy
        # [kv_port, kv_port + dp_size * pp_size * pcp_size * tp_size).
        # Keep one scheduler control port per DP rank immediately after that
        # range so it cannot collide with a worker handshake socket.
        self.side_channel_port = (
            self.kv_transfer_config.kv_port + self.max_device_id + vllm_config.parallel_config.data_parallel_rank
        )

        self.kv_cache_groups = kv_cache_config.kv_cache_groups
        self.group_block_size = [group.kv_cache_spec.block_size for group in self.kv_cache_groups]
        self.group_unique_specs = [self._get_group_unique_specs(group) for group in self.kv_cache_groups]
        self.need_truncate = self._needs_prefill_token_truncation()

        logger.info("Initializing Mooncake Scheduler %s", engine_id)

vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L115-L154

        """Return prompt blocks while retaining evicted-block padding.

        Attention groups are clipped by their block size. Circular groups keep
        their single state page. Mamba groups are not prompt-block aligned, so
        only their speculative tail blocks are removed.
        """
        if not block_ids:
            return block_ids

        assert len(block_ids) == len(self.group_unique_specs), "Number of KV cache groups must match"

        transfer_block_ids: list[list[int]] = []
        for blocks, block_size, group_specs in zip(
            block_ids,
            self.group_block_size,
            self.group_unique_specs,
        ):
            if all(is_circular_kv_cache_spec(spec) for spec in group_specs):
                # Circular caches own one request-lifetime ring block. It is
                # state, not a prompt-aligned attention-block sequence.
                transfer_block_ids.append(blocks)
            elif any(isinstance(spec, MambaSpec) for spec in group_specs):
                if self.num_speculative_tokens > 0:
                    transfer_block_ids.append(blocks[: -self.num_speculative_tokens])
                else:
                    transfer_block_ids.append(blocks)
            else:
                # SWA remains TP-sharded/replicated and keeps its original
                # logical block size even when FullAttention uses DCP.
                cp_size = (
                    1 if all(isinstance(spec, SlidingWindowSpec) for spec in group_specs) else max(1, self.dcp_size)
                )
                num_prompt_blocks = cdiv(prompt_len, block_size * cp_size)
                transfer_block_ids.append(blocks[:num_prompt_blocks])
        return tuple(transfer_block_ids)

    def _state_prefill_token_count(self, num_prompt_tokens: int) -> int:
        """Return the prompt token count transferred for stateful models."""
        if self.need_truncate and num_prompt_tokens > 1:
            return num_prompt_tokens - 1

vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L233-L265

class MooncakePullConnector(MooncakeBaseConnector):
    """Pull-based Mooncake KV transfer connector."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        super().__init__(vllm_config, role, kv_cache_config)

        if role == KVConnectorRole.SCHEDULER:
            self.connector_scheduler = MooncakePullConnectorScheduler(vllm_config, str(self.engine_id), kv_cache_config)
        elif role == KVConnectorRole.WORKER:
            self.connector_worker = MooncakePullConnectorWorker(vllm_config, str(self.engine_id), kv_cache_config)
        else:
            raise ValueError(f"Unsupported KVConnectorRole: {role}")


class MooncakePushConnector(MooncakeBaseConnector):
    """Placeholder for the not-yet-implemented push-based connector."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig",
    ) -> None:
        raise NotImplementedError("MooncakePushConnector is not implemented yet.")


# Backward compatibility: MooncakeConnector is the pull-based connector.
MooncakeConnector = MooncakePullConnector