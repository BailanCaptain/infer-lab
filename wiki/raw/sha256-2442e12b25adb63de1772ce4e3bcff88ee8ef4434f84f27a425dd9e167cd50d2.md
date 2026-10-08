# enable_async_exponential 引用片段

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L256-L263

```python
        # when enable_async_exponential is True, AscendSampler will be different from vllm Sampler,
        # which make batch_invariant mode not working.
        # so we disable async exponential when batch_invariant mode is enabled.
        import vllm.envs as envs

        self.enable_async_exponential = (
            bool(additional_config.get("enable_async_exponential", False)) and not envs.VLLM_BATCH_INVARIANT
        )
```

参数唯一的读取点：默认 `False`，且 `VLLM_BATCH_INVARIANT` 为真时被静默按下为 `False`。

## vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L90-L103

```python
    def do_async_exponential(self, b_s, head_dim, generators):
        # Calculating exponential randoms in a different stream
        # and overlapping with model executing.
        with torch.npu.stream(global_stream()):
            global_stream().wait_stream(torch.npu.current_stream())
            q = torch.empty((b_s, head_dim), device="npu", dtype=torch.float32)
            # Goes to async exponential with AI-CPU exponential or default exponential.
            if len(generators) != q.shape[0]:
                q.exponential_()
            if generators:
                for i, generator in generators.items():
                    q[i].exponential_(generator=generator)
            self.async_exponential_event.record()
        self.set_q_event(q, self.async_exponential_event)
```

特性主体：在副 stream 上提前把 `q ~ Exp(1)` 生成好，形状 `(b_s, head_dim)`、dtype fp32，并录一个 event。

## vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L182-L191

```python
            probs = logits.softmax(dim=-1, dtype=torch.float32)
            if get_ascend_config().enable_async_exponential:
                # Add synchronize to prevent synchronize error.
                logger.debug_once(
                    "[sample/sampler] Using async-exponential sampling path. "
                    "Pre-computed exponential randoms from separate stream will be used.",
                )
                self.async_event.synchronize()
                return probs.div_(self.q).argmax(dim=-1).view(-1), logits_to_return
            return random_sample(probs, generators), logits_to_return
```

消费点：softmax 之后用预生成的 `q` 做 `probs/q` 的 argmax；证明 exponential 不在 softmax 内部，且这里只在非 `enable_reduce_sample` 分支。

## vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L20-L43

```python
def random_sample(
    probs: torch.Tensor,
    generators: dict[int, torch.Generator],
) -> torch.Tensor:
    """Randomly sample from the probabilities.

    We use this function instead of torch.multinomial because torch.multinomial
    causes CPU-NPU synchronization.
    """
    # NOTE(woosuk): To batch-process the requests without their own seeds,
    # which is the common case, we first assume that every request does
    # not have its own seed. Then, we overwrite the values for the requests
    # that have their own seeds.
    with npu_stream_switch(global_stream()):
        q = torch.empty_like(probs)
        if len(generators) != probs.shape[0]:
            q.exponential_()
        if generators:
            # TODO(woosuk): This can be slow because we handle each request
            # one by one. Optimize this.
            for i, generator in generators.items():
                q[i].exponential_(generator=generator)
    torch.npu.current_stream().wait_stream(global_stream())
    return probs.div_(q).argmax(dim=-1).view(-1)
```

关掉参数时走的同步路径：同样的指数分布随机数与同样的 `probs.div_(q).argmax`，区别只在生成时机与同步方式（`wait_stream`，device 侧）。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2278-L2283

```python
        if self.ascend_config.enable_async_exponential:
            self.sampler.do_async_exponential(
                b_s=logits_indices.shape[0],
                head_dim=self.model_config.get_vocab_size(),
                generators=self.input_batch.sampling_metadata.generators,
            )
```

触发点：在 model forward 之前、每步无条件调用；`head_dim` 实为词表大小，`b_s` 为本步要采样的行数。

## vllm-ascend@2c59ff10:vllm_ascend/utils.py#L531-L537

```python
def global_stream() -> torch.npu.Stream:
    global _GLOBAL_STREAM
    if _GLOBAL_STREAM is None:
        # when this function is called before any stream is set,
        # we return the default stream.
        _GLOBAL_STREAM = torch_npu.npu.Stream()
    return _GLOBAL_STREAM
```

副 stream 是进程级单例，不是本特性独占。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L76

```markdown
| `enable_async_exponential`          | bool | `False` | Whether to enable asynchronous exponential overlap. To enable asynchronous exponential, set this config to True.        |
```

v0.23.0 官方参数表里的原文；main 的同一张表已无此行。

## vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L122

```markdown
### Ready to Deprecate

The following features and optimizations are planned for deprecation in a future release:

- Layer sharding.
- FlashComm2.
- The FlashComm3 multistream-overlap gate.
- Hamming sparse.
- Asynchronous exponential overlap.
```

官方在 v0.23.0 就把本特性列入待废弃清单，是 main 上删除的依据。

## vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_sampler.py#L72-L96

```python
def test_qwen3_exponential_overlap(monkeypatch: pytest.MonkeyPatch) -> None:
    # enable_async_exponential is mutually exclusive with VLLM_BATCH_INVARIANT
    # (see vllm_ascend/ascend_config.py). The module-level os.environ setting
    # would silently disable async_exponential, so this test creates its own
    # LLM instance with batch invariant mode turned off.
    model_cache.clear()
    gc.collect()
    torch.npu.empty_cache()

    monkeypatch.setenv("VLLM_BATCH_INVARIANT", "0")

    llm = LLM(
        model=ModelName.QWEN3_06B,
        quantization=None,
        max_model_len=8192,
        dtype="bfloat16",
        gpu_memory_utilization=0.9,
        enable_prefix_caching=False,
        max_num_seqs=32,
        tensor_parallel_size=1,
        distributed_executor_backend="mp",
        compilation_config={"cudagraph_mode": "FULL_DECODE_ONLY", "cudagraph_capture_sizes": [1, 2, 4, 8]},
        additional_config={"enable_async_exponential": True},
    )
```

唯一的 e2e 用例，给出可复制的配置写法，并把「与 batch invariant 互斥且是静默生效」写进了注释。

## vllm-ascend@28bf3a2e:vllm_ascend/sample/sampler.py#L20-L44

```python
def random_sample(
    probs: torch.Tensor,
    generators: dict[int, torch.Generator],
) -> torch.Tensor:
    """Randomly sample from the probabilities.

    We use this function instead of torch.multinomial because torch.multinomial
    causes CPU-NPU synchronization.
    """
    # NOTE(woosuk): To batch-process the requests without their own seeds,
    # which is the common case, we first assume that every request does
    # not have its own seed. Then, we overwrite the values for the requests
    # that have their own seeds.
    with npu_stream_switch(global_stream()):
        q = torch.empty_like(probs)
        if len(generators) != probs.shape[0]:
            q.exponential_()
        if generators:
            # TODO(woosuk): This can be slow because we handle each request
            # one by one. Optimize this.
            for i, generator in generators.items():
                q[i].exponential_(generator=generator)
    torch.npu.current_stream().wait_stream(global_stream())
    q.record_stream(torch.npu.current_stream())
    return probs.div_(q).argmax(dim=-1).view(-1)
```

main 上同步路径保留，且新增了 `q.record_stream(...)`——跨 stream 分配的张量要向当前 stream 登记，否则缓存分配器可能提前复用其显存。

## vllm-ascend@28bf3a2e:vllm_ascend/sample/sampler.py#L74-L85

```python
    def __init__(self, logprobs_mode=DEFAULT_LOGPROBS_MODE):
        # TODO: support logprobs_mode in vllm-ascend
        super().__init__(logprobs_mode=logprobs_mode)
        self.topk_topp_sampler = AscendTopKTopPSampler(logprobs_mode=logprobs_mode)
        logger.debug(
            "[sample/sampler] AscendSampler initialized. logprobs_mode=%s, triton_available=%s",
            logprobs_mode,
            HAS_TRITON,
        )

    def prepare_sampling(self, top_k):
        self.topk_topp_sampler.prepare_sampling(top_k)
```

main 上 `AscendSampler.__init__` 已无 `async_exponential_event`，类里也不再有 `set_q_event` / `do_async_exponential`——特性整体删除的直接证据。

## vllm-ascend@28bf3a2e:docs/source/user_guide/release_notes.md#L1328

```markdown
- Add async exponential while model executing. [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501)
```

特性引入的记录（v0.13.0 段落），给出引入 PR 号。

## https://huggingface.co/Qwen/Qwen3-0.6B —— config.json

```json
  "hidden_size": 1024,
  "num_hidden_layers": 28,
  "vocab_size": 151936
```

算例中 `q` 张量大小所用的词表维度来源。
