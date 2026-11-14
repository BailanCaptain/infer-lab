vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L223

    cross_node_transfer_limit: int = 1

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L205-L207

        cross_node_transfer_limit: Maximum outgoing and incoming cross-node
            expert transfers for each node in one layer plan. Minus one removes
            this limit; zero disables cross-node transfers.

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L252-L253

        if self.cross_node_transfer_limit < -1:
            raise ValueError("stair_config.cross_node_transfer_limit must be at least -1")

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L479-L512

        if rank_transfer_limit == -1:
            rank_transfer_limit = len(demands)
        if cross_node_transfer_limit == -1:
            cross_node_transfer_limit = len(demands)
        candidates = [source_candidates[dst_rank][expert] for dst_rank, expert in demands]
        source_usage = [0] * len(compact_node_ids)
        cross_out = [0] * num_nodes
        cross_in = [0] * num_nodes
        max_cross_transfers = min(len(demands), num_nodes * cross_node_transfer_limit)
        failed_states: set[tuple[int, int, tuple[int, ...], tuple[int, ...], tuple[int, ...]]] = set()

        def assign(demand_index: int, remaining_cross_transfers: int) -> bool:
            if demand_index == len(demands):
                return True
            state = (
                demand_index,
                remaining_cross_transfers,
                tuple(source_usage),
                tuple(cross_out),
                tuple(cross_in),
            )
            if state in failed_states:
                return False
            dst_rank, _ = demands[demand_index]
            dst_node = compact_node_ids[dst_rank]
            for src_rank in candidates[demand_index]:
                src_node = compact_node_ids[src_rank]
                crosses_node = src_node != dst_node
                if source_usage[src_rank] >= rank_transfer_limit or crosses_node > remaining_cross_transfers:
                    continue
                if crosses_node and (
                    cross_out[src_node] >= cross_node_transfer_limit or cross_in[dst_node] >= cross_node_transfer_limit
                ):
                    continue

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L907-L913

        """Return the best mean- and p95-non-regressing placement for one layer.

        Candidates may not regress mean or p95 imbalance. The lowest predicted
        mean ratio wins; ratios within the internal absolute tolerance are tied.
        Ties minimize cross-node migrations, same-node remote migrations,
        target expert IDs, source rank IDs, then source slot IDs. Return ``None``
        when no candidate is accepted or the winner keeps the current placement.

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L673

        """Place replicas with deterministic covariance-aware greedy LPT.

        Mean, variance, and replica counts are ``[experts]``; covariance is
        ``[experts, experts]``. Experts are processed by descending per-replica
        risk. Each replica chooses the legal rank with the lowest updated risk,
        breaking ties by rank ID. Each partial placement must have a source
        assignment within the per-rank and cross-node limits. ``None`` means bounded
        backtracking found no legal placement. The first source-feasible choice
        is free; each accepted alternative choice consumes one backtrack.
        ``rank_node_ids`` contains one non-negative node ID per rank; equal IDs
        mean that two ranks share a node. Final source assignment first minimizes
        cross-node transfers, then source rank IDs in target-slot order.

vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837

                    raise ValueError(f"Config has no attribute '{key}'")

vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L179-L180

    Migrated to ``@config`` (pydantic dataclass). Unknown-key detection is now
    handled by ``extra="forbid"`` (replaces the hand-written ``unknown`` check);

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237

    @field_validator("*", mode="before")
    @classmethod
    def _reject_bool(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError("STAIR numeric fields must not be booleans")

vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L709-L713

        controls = rank_transfer_limit, cross_node_transfer_limit, backtrack_limit
        invalid_type = any(isinstance(value, bool) or not isinstance(value, int) for value in controls)
        invalid_limits = rank_transfer_limit < -1 or rank_transfer_limit == 0 or cross_node_transfer_limit < -1
        if invalid_type or invalid_limits or backtrack_limit < 0:
            raise ValueError("STAIR transfer limits and backtrack_limit must be valid integers")

vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L223

    cross_node_transfer_limit: int = -1

vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L211

    cross_node_transfer_limit: int = -1

vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L220

    cross_node_transfer_limit: int = -1

vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L221

    cross_node_transfer_limit: int = -1