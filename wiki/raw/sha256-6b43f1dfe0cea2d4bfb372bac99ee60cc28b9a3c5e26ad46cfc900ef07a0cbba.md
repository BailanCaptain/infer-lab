# rc2 comparison: pinned excerpts read for this update

Recorded 2026-11-03. These are exact source excerpts, not an NPU test or a reconstructed historical agent receipt.

Source: vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L729-L757
Online: https://github.com/vllm-project/vllm/blob/ced6857a/vllm/v1/core/sched/scheduler.py#L729-L757

```text
                    new_blocks = self.kv_cache_manager.allocate_slots(
                        request,
                        num_new_tokens,
                        num_lookahead_tokens=self.num_lookahead_tokens,
                    )

                    if new_blocks is not None:
                        # The request can be scheduled.
                        break

                    if (
                        self.connector is not None
                        and self.connector.has_pending_block_frees()
                    ):
                        break

                    # The request cannot be scheduled.
                    # Preempt the lowest-priority request.
                    if self.policy == SchedulingPolicy.PRIORITY:
                        preempted_req = max(
                            self.running,
                            key=lambda r: (r.priority, r.arrival_time),
                        )
                    else:
                        preempted_req = self.running[-1]

                    # A deferred free will not help with immediate allocation.
                    if not self._request_blocks_can_be_freed(preempted_req):
                        break
```

Source: vllm@ced6857a:vllm/config/scheduler.py#L42-L103
Online: https://github.com/vllm-project/vllm/blob/ced6857a/vllm/config/scheduler.py#L42-L103

```text
    DEFAULT_MAX_NUM_BATCHED_TOKENS: ClassVar[int] = 2048
    DEFAULT_MAX_NUM_BATCHED_TOKENS_FOR_BATCHED_DP: ClassVar[int] = 256
    DEFAULT_MAX_NUM_SEQS: ClassVar[int] = 128

    runner_type: RunnerType = "generate"
    """The runner type to launch for the model."""

    max_num_batched_tokens: int = Field(default=DEFAULT_MAX_NUM_BATCHED_TOKENS, ge=1)
    """Maximum number of tokens that can be processed in a single iteration.

    The default value here is mainly for convenience when testing.
    In real usage, this should be set in `EngineArgs.create_engine_config`.
    """

    max_num_scheduled_tokens: int | None = Field(default=None, ge=0)
    """Maximum number of tokens that the scheduler may issue in a single iteration.
    
    This is usually equal to max_num_batched_tokens, but can be smaller in cases
    when the model might append tokens into the batch (such as speculative decoding).
    Defaults to max_num_batched_tokens."""

    max_num_seqs: int = Field(default=DEFAULT_MAX_NUM_SEQS, ge=1)
    """Maximum number of sequences to be processed in a single iteration.

    The default value here is mainly for convenience when testing.
    In real usage, this should be set in `EngineArgs.create_engine_config`.
    """

    long_prefill_token_threshold: int = Field(default=0, ge=0)
    """For chunked prefill, a request is considered long if the prompt is
    longer than this number of tokens. 0 disables the cap (default)."""

    max_num_queued_reqs: int | None = Field(default=None, ge=0)
    """Maximum number of requests that can be in-flight (waiting or running)
    at the same time, or None for no limit. When the limit is reached, new
    requests are rejected with HTTP 503 so the client can retry on another
    instance. This bounds vLLM's otherwise unbounded request queue and is
    primarily a coarse capacity valve.

    Unlike ``max_num_seqs``, which applies per data-parallel rank, this
    limit is enforced in the API server process and counts in-flight
    requests across all DP ranks it routes to. Size it as roughly
    ``data_parallel_size * max_num_seqs`` plus the desired queue depth if
    it should not bind before per-rank admission does."""

    max_num_queued_tokens: int | None = Field(default=None, ge=0)
    """Maximum total prompt tokens of requests currently in the prefill
    phase, or None for no limit. When the limit is reached, new requests
    are rejected with HTTP 503.

    This is a TTFT QoS mechanism: by setting it to
    ``target_TTFT * prefill_throughput`` you reject requests when the
    prefill backlog would exceed the latency target.  In a disaggregated
    prefill-decode setup this maps directly to the prefill pool's
    capacity.

    Like ``max_num_queued_reqs``, this limit is enforced in the API
    server process and covers the prefill backlog across all DP ranks it
    routes to, so ``prefill_throughput`` in the formula above is the
    aggregate throughput of the deployment.

    Note: the count is conservative.  A partially prefilled request
```

Source: vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L499-L524
Online: https://github.com/vllm-project/vllm/blob/ced6857a/vllm/v1/core/kv_cache_manager.py#L499-L524

```text
        watermark_blocks = 0
        # The watermark is applied to waiting/preempted requests only, and only
        # when there's at least one request already scheduled.
        if has_scheduled_reqs and request.status in (
            RequestStatus.WAITING,
            RequestStatus.PREEMPTED,
        ):
            watermark_blocks = self.watermark_blocks

        if full_sequence_must_fit:
            # First check and fail if the full request sequence won't fit.
            full_num_tokens = min(request.num_tokens, self.max_model_len)

            num_blocks_to_allocate = self.coordinator.get_num_blocks_to_allocate(
                request_id=request.request_id,
                num_tokens=full_num_tokens,
                new_computed_blocks=new_computed_block_list,
                num_encoder_tokens=num_encoder_tokens,
                total_computed_tokens=total_computed_tokens,
                num_local_computed_tokens=num_local_computed_tokens,
                num_tokens_main_model=full_num_tokens,
                apply_admission_cap=True,
            )
            required_blocks = num_blocks_to_allocate + watermark_blocks
            if required_blocks > self.block_pool.get_num_free_blocks():
                return None
```
