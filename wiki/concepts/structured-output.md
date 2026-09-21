---
id: structured-output
title: "结构化输出：采样前先算一张「这一步允许哪些 token」的位图"
type: feature
summary: 把 JSON schema / 正则 / 文法编译成状态机，每步算出一张允许位图，把不允许的 token 的 logit 写成 -inf 再采样；昇腾默认把 logits 搬回 CPU 才贴这张位图。
aliases: [结构化输出, Structured Output, Guided Decoding, 引导解码, 受限解码, 约束解码, guided_json, structured_outputs, StructuredOutputManager, grammar bitmask, 文法位图, apply_grammar_bitmask, xgrammar]
chapters: ["17"]
order: 60
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/structured_output.md#L5-L17
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L22-L22
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/structured_output.html
  - vllm@0fc695fc:vllm/sampling_params.py#L71-L82
  - vllm@0fc695fc:vllm/v1/structured_output/request.py#L31-L57
  - vllm@0fc695fc:vllm/v1/request.py#L108-L113
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1651-L1663
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2205-L2210
  - vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L130-L171
  - vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L77-L95
  - vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L220-L229
  - vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L293-L300
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1305-L1327
  - vllm@0fc695fc:vllm/v1/engine/core.py#L450-L463
  - vllm@0fc695fc:vllm/v1/engine/core.py#L520-L536
  - vllm@0fc695fc:vllm/v1/engine/core.py#L577-L596
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L25-L29
  - vllm@0fc695fc:vllm/v1/structured_output/utils.py#L99-L122
  - vllm@0fc695fc:vllm/v1/structured_output/utils.py#L124-L135
  - vllm@0fc695fc:vllm/v1/worker/gpu/structured_outputs.py#L63-L76
  - vllm@0fc695fc:vllm/config/structured_outputs.py#L12-L25
  - vllm@0fc695fc:vllm/sampling_params.py#L933-L972
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L326-L336
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1491-L1493
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2448-L2455
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1919-L1929
  - vllm-ascend@2c59ff10:vllm_ascend/worker/v2/structured_outputs.py#L19-L23
  - vllm-ascend@2c59ff10:vllm_ascend/worker/v2/structured_outputs.py#L34-L50
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_v2/patch_triton.py#L30-L34
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_structured_output.py#L46-L53
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_structured_output.py#L116-L128
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L374-L394
  - vllm-ascend@baa023ad:vllm_ascend/patch/__init__.py#L774-L786
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_structured_output.py#L113-L118
  - vllm-ascend@baa023ad:vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py#L84-L93
  - vllm-ascend@baa023ad:vllm_ascend/ops/triton/v2/docs/apply_grammar_bitmask.md#L5-L13
  - vllm-ascend@baa023ad:vllm_ascend/ops/triton/v2/docs/apply_grammar_bitmask.md#L115-L127
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_structured_output.py#L144-L156
  - vllm-ascend@baa023ad:vllm_ascend/_310p/worker/v2/model_runner.py#L1220-L1224
  - vllm-ascend@baa023ad:tests/e2e/weekly/single_node/features/structured_output/README.md#L6-L13
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-engine-core
    kind: builds-on
    note: 取位图那一步就夹在那一页说的 execute_model(non_block=True) 与 future.result() 之间，那句「中间那几行做的是取 grammar bitmask」指的就是它
  - to: async-scheduling
    kind: builds-on
    note: 欠条还没销账时 pending_structured_output_tokens 为真，这一圈的采样被推迟到下一圈才发得出去
  - to: vllm-scheduler
    kind: builds-on
    note: 文法没编译完的请求排进的是 skipped_waiting 这条旁路队列，两条 while 和 token 预算的规则一行没动
  - to: npu-model-runner
    kind: builds-on
    note: 贴位图落在 sample_tokens 那一区，昇腾在那里把 logits 搬到 CPU 再搬回来
  - to: speculative-decoding
    kind: builds-on
    note: 位图按「1 + 草稿数」行分配，每个草稿位置各占一行；同开之后草稿 token 必须回 CPU 给文法校验
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

结构化输出（官方文档里的另一个名字是 Guided Decoding）不改模型，它改的是**采样发生前那一瞬间的 logits**：把你给的 JSON schema / 正则 / 文法编译成一台状态机，每走一步先问它「按现在这个位置，下一个 token 允许是哪些」，答案是一张按位压缩的允许位图，一个 int32 管 32 个 token；**bit 为 0 的那些 token，logit 被写成 `-inf`，然后照常采样** [S1]。温度、top-p、惩罚项一个都没动——被拿掉的只是选项。

三个版本上都有，官方支持矩阵里 `Guided Decoding` 那一行三版一字不差，都是 🟢 Functional [S2]。分叉在昇腾怎么把这张位图贴到 logits 上：v0.23 与 v0.26 的 NPU 内核在 `vllm_ascend/worker/v2/structured_outputs.py`，main 上这个文件已经不存在，内核挪进了 `vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py`——下面那张差异表摆了这三代的区别。

```wiki-diagram
file: structured-output
```

## 那条请求用不到它

[那条请求](one-request.md)要的是一段自由文本回答，没有任何 schema。`StructuredOutputRequest.from_sampling_params` 在约束字段全为空时直接返回 `None`，于是这条请求连 `structured_output_request` 这个字段都不会有，上面整条路径一步都不走。

给它加一个 JSON schema、别的设定不变，每一圈多出来的是这些 [A]：

| 加上 schema 之后多出的一步 | 那条请求上是什么 |
|---|---|
| 排队前先等文法编译 | 请求一造出来状态就是 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR`，进的是 `skipped_waiting` 旁路队列而不是 `waiting` [C6] |
| 编译完才放行 | 编译扔在 EngineCore 的线程池里跑；调度器每轮拿 **100 µs** 的超时去戳那个 future，戳通了才转成 `WAITING` [C5] |
| 每圈多算一行位图 | `schedule()` 之后、采样之前调一次 `Scheduler.get_grammar_bitmask()` |
| 一行位图多大 | 词表 151936（见 [显存怎么被分掉](kv-cache-memory-profiling.md) 里那笔 tied 词表的账），⌈151936 / 32⌉ = **4748 个 int32 = 18.5 KiB**；200 圈合计约 3.6 MiB |
| 每圈多一次 logits 往返 | 昇腾默认那条路把 `(1, 151936)` 的 logits 搬到 CPU 再搬回来：bf16 下去 **296.8 KiB**、float32 上来 **593.5 KiB**，一来一回约 **890 KiB** |

**后两行那几个数都不随回答变长而变** [D]——它们只跟词表大小有关，每一步原样再来一遍。文法编译那一次是一次性的，位图和往返是每一步的。

## 位图在 EngineCore 算，在 Worker 贴

分工是干净的：**状态机只活在 EngineCore 进程里，Worker 拿到的是一张已经算好的位图。**

填位图的是 `StructuredOutputManager.grammar_bitmask()`，按 `get_grammar_bitmask()` 收集到的请求顺序逐条 `fill_bitmask`，已经终止的文法那一行整行填满（全允许）[C13]。这块内存只分配一次，行数是 `max_num_seqs × (1 + num_speculative_tokens)`——**开了投机解码，每个草稿位置各占一行，外加 bonus token 那一行** [C11]。交出去之前它被转成 `np.ndarray`，上游注释写明理由就是这样序列化到 worker 更省。

Worker 侧只做一件事：按请求 id 把位图的行重排成本批 logits 的行序，再原地写 `-inf`。重排是必要的——位图的行序是调度器给的，跟 model runner 批内的座位号无关。

还有一件事也在 EngineCore 这一侧：`get_grammar_bitmask` 里对本步的草稿 token 逐个 `accept_tokens` 推进状态机，算完再 `rollback` 回去。**状态机吃的是已确认的 token，不是这一步的采样结果**——所以它必须等上一步的输出回来。下一节讲的就是这件事的代价。

## 开了它，异步调度的重叠就打了折

默认走的不是 `step()` 而是 `step_with_batch_queue`（理由在 [异步调度](async-scheduling.md)）。这条路上多了一个开关：`AsyncScheduler` 在调度完的当下算 `pending_structured_output_tokens |= use_structured_output and num_output_placeholders > 0` [C17]。

对那条加了 schema 的请求，这个值从第 2 圈起一直是真——第 1 圈调度完就记了一张欠条。于是每一圈都走 `else` 那支：**这一圈的采样被推迟**，`sample_tokens` 发不出去，先阻塞着把上一圈的结果取回来、`update_from_output` 记账，拿到真 token 之后才算得出这一圈的位图，再补发 `sample_tokens` [C16]。

所以准确的说法是：**forward 照样和 CPU 重叠，采样不再重叠。** 同步那条 `step()` 路径上看得更直白——`get_grammar_bitmask` 就夹在 `execute_model(..., non_block=True)` 和 `future.result()` 之间，填的正是 [EngineCore](vllm-engine-core.md) 那一页说的那个空档。

投机解码同开还要再赔一笔：异步调度本来能跳过把草稿 token 搬回 CPU 那一步，只要这一批里有结构化输出请求就跳不了 [C26]；上游在推迟的那一支里也必须先 `take_draft_token_ids()` 才算得出位图。

## 昇腾默认把 logits 搬回 CPU 才贴位图

这是昇腾侧最要紧的一条，而且三个版本一模一样：

```python
logits_dtype = logits.dtype
logits = logits.to("cpu").float()
apply_grammar_bitmask(scheduler_output, grammar_output, self.input_batch, logits)
logits = logits.to(self.device).to(logits_dtype)
```

`NPUModelRunner.sample_tokens` 里这四行 [C25]，就是上面那 890 KiB 一来一回的出处。转 `float()` 不是多余的：上游 `apply_grammar_bitmask` 的 CPU 分支本来就要把非 float32 的 logits 转一遍再转回来，昇腾提前转好正好落进它的 `else` 支。真正的原因是 **xgrammar 的 `apply_token_bitmask_inplace` 在 NPU 上没有算子**——上游的非 CPU 分支是把位图拷到 `logits.device` 上直接交给它的 [C18]。

代码上方那句注释说「上游用 `torch.compile` 优化、昇腾不支持」，**对不上钉住的源码**：`vllm/v1/structured_output/utils.py` 里没有 `torch.compile`，两条分支都是直接调 xgrammar [!]。注释描述的多半是 xgrammar 库内部的实现，不是这个函数 [I]。

NPU 上真有内核的是另一条路：v2 model runner。上游那条路径用 Triton 内核原地写 `-inf`，`BLOCK_SIZE = 8192`；昇腾在 `patch_triton.py` 里把这个内核整个换掉，理由写在文件头：**`BLOCK_SIZE=8192` 会把 UB 撑爆，而调小 BLOCK_SIZE 又会让 grid 不稳** [C27]。v0.23 的解法是保持 8192 不变、内部再按 `BLOCK_SIZE_SUB = 1024` 切一层循环。

但这条路默认走不到：昇腾另打了一个补丁，把 `use_v2_model_runner` 改成只认环境变量 `VLLM_USE_V2_MODEL_RUNNER`，不写就是 `False` [C33]。**默认配置下「贴位图」这件事发生在 CPU 上**，那个 NPU 内核要显式开 v2 runner 才用得上（v2 runner 是什么见 [NPUModelRunner 怎么读](npu-model-runner.md)）。

## 一个引擎只能有一个后端，而 `auto` 是按请求挑的

后端有四个：`xgrammar`、`guidance`、`outlines`、`lm-format-enforcer`，默认值是 `auto` [C21]。`auto` 的含义是**按这一条请求的 schema 挑**：先试 xgrammar，校验不过退到 guidance，schema 里有 guidance 也不支持的特性再退到 outlines [C22]。

问题是引擎级只保存一个后端实例——`grammar_init` 只在 `self.backend is None` 时建一次，之后来的请求无论解析成什么都用这一个 [C9]。昇腾为此打了 `patch_structured_output.py`：把第一次解析出的后端名记在配置上，后面解析出不同后端的请求直接抛 `VLLMValidationError`。补丁自己的说明写得很清楚——不拦的话，先来一条 xgrammar 请求、后来一条 guidance 请求，**会在文法编译时把引擎打挂** [C32]。

想绕开这件事就别用 `auto`。配置项是一个 JSON 串（dataclass 型配置统一按 JSON 解析）：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --structured-outputs-config '{"backend": "xgrammar", "disable_any_whitespace": true}'
```

`disable_any_whitespace` 只有 xgrammar 和 guidance 认，配在别的后端上启动就报错。请求侧的写法昇腾与 vLLM 完全一致，最小的一条是：

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="EMPTY")
client.chat.completions.create(
    model="Qwen/Qwen3-0.6B",
    messages=[{"role": "user", "content": "给我一条员工记录"}],
    extra_body={"structured_outputs": {"json": {
        "type": "object",
        "properties": {"name": {"type": "string"}, "age": {"type": "integer"}},
        "required": ["name", "age"],
    }}},
)
```

`json` / `regex` / `choice` / `grammar` / `json_object` / `structural_tag` **只能给一个**，给两个或者一个都不给，都会在 `__post_init__` 里直接报错。昇腾自己的端到端用例覆盖的正是前四种，外加流式、混合并发与非法请求恢复。

## 版本之间的差异

主叙述那套（位图机制、编译状态、CPU 贴位图那四行）三版一致。不一致的只有这几行：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| NPU 位图内核放在哪 | `worker/v2/structured_outputs.py`，内部按 `BLOCK_SIZE_SUB=1024` 二次切分 [C28] | 与 v0.23 逐字相同 | 挪到 `ops/triton/v2/apply_grammar_bitmask.py`，取消二次切分，改成按 VectorCore 数均分任务、`multibuffer=False` [C35] | 升到 main 之后这个文件路径变了，调优结论也跟着变，别照抄旧路径的性能数据 |
| 推理模型的文法边界 | 无 | 多回填一份 `grammar_bitmask` / `should_advance`，且只在 `vllm_version_is("0.26.0")` 为真时才装 [C34] | 无（上游已带） | 这是给 v0.26.0 这一个上游版本的临时垫片，换上游版本就自动不装 |
| Outlines 后端收尾 | 无 | 无 | 多一条 `OutlinesGrammar.accept_tokens` 短路：文法已完成时直接返回 True [C38] | [!] 按补丁自己的说明，没有这条短路时，JSON 写完之后那个 EOS 不在 FSM 的字母表里会被拒收，请求以 `FINISHED_ERROR` 收场——v0.23 / v0.26 上还没补 |
| 310P 的 v2 runner | 该路径不存在 | 该路径不存在 | 带 `grammar_output` 进来直接 `NotImplementedError` [C39] | [!] 310P 上开了 v2 runner 就用不了结构化输出，只能退回 v1 runner |

## 常见误解

- **「加了 schema，模型就不会生成不合法的 token 了。」**——模型照样会给非法 token 高分，只是那些分被写成了 `-inf`，采不出来而已。合法性是采样那一步保证的，不是模型学会的。
- **「位图是在 NPU 上算的。」**——不是。状态机、填位图、推进与回滚全在 EngineCore 进程的 CPU 上；送到 worker 的是一张 `np.int32` 的成品。默认配置下连「贴」这一步也在 CPU 上 [C25]。
- **「`backend` 默认是 `auto`，所以混着用不同 schema 没关系。」**——恰恰相反。`auto` 是按请求解析的，而引擎只认第一次建起来的那个后端；昇腾把这种情况改成了显式报错，不打这个补丁的结果是编译时崩引擎。
- **「开了异步调度，结构化输出照样全程重叠。」**——采样那一半不重叠了：`pending_structured_output_tokens` 一为真，这一圈的 `sample_tokens` 就得等上一圈的 token 回来 [C17]。
