---
id: structured-output
title: "结构化输出：采样前先算一张「这一步允许哪些 token」的位图"
type: feature
summary: 想让模型只回一段合法的 JSON，就在每一步挑 token 之前，先按格式要求划掉所有不合规矩的候选，再照常挑。昇腾默认把这一步搬到 CPU 上做。
aliases: [结构化输出, Structured Output, Guided Decoding, 引导解码, 受限解码, 约束解码, 文法掩码, guided_json, structured_outputs, StructuredOutputManager, grammar bitmask, 文法位图, apply_grammar_bitmask, xgrammar]
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
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
updated: "2026-09-25"
origin: seed
---

## 想让模型只回一段合法的 JSON，怎么办

你让模型「给我一条员工记录，只要 JSON，带 name 和 age 两个字段」。模型多半会照做，但「多半」不够：它可能在前面加一句「好的，以下是……」，可能漏一个引号，也可能把 age 写成「二十八」。下游程序一解析就崩。

结构化输出的办法不是改模型，也不是事后检查，而是**在每一步挑 [token](token.md) 之前动手**：

1. 把你给的格式要求（一份 JSON 格式说明、一条正则、或一套文法）事先编译成一台「状态机」——它记得「按规矩，现在写到哪了」。
2. 模型每一步照常给词表里每个 token 打一个分（这一行分数叫 logits）。
3. 挑之前，先问状态机：「在现在这个位置，下一个 token 允许是哪些？」答案是一张**位图**：词表里每个 token 占一个开关，允许是 1，不允许是 0。为了省地方，32 个开关压进一个 32 位整数。
4. 开关为 0 的 token，分数被改成负无穷，然后**照常采样**。

温度、top-p、惩罚项一个都没动——被拿掉的只是选项。模型照样可能给「好的」打高分，只是那个分被改成了负无穷，挑不出来。

```wiki-diagram
file: structured-output
```

这个功能在官方文档里的另一个名字叫 Guided Decoding（引导解码）。三个版本都支持，支持矩阵里写的都是「能用」。

## 给那条请求加一个 JSON 格式要求，每一步多出什么

[贯穿全库的那条请求](one-request.md)：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，问题 37 个 token，回答 200 个。它要的是一段自由文本，没有任何格式要求，所以上面这整条路径一步都不走——引擎看到它没带格式要求，就不会给它挂上状态机。

给它加一个 JSON 格式要求、别的设定不变，多出来的是这些：

| 多出的一步 | 那条请求上是什么 |
|---|---|
| 排队前先等编译 | 请求一进来先不排进正常的等待队列，而是进一条旁路，等格式要求编译成状态机 |
| 编译完才放行 | 编译在后台线程里跑；调度器每一步只花 100 微秒去看一眼编译完没有，完了才把它挪回正常队列 |
| 每一步多算一行位图 | 调度完、采样前，状态机给这条请求算一行开关 |
| 一行位图多大 | 这个模型的词表有 248320 个 token，一行要 7760 个 32 位整数，约 **30.3 KiB**；200 步合计约 5.9 MiB |
| 每一步多一趟搬运 | 昇腾默认把这一行分数从 NPU 搬到 CPU、贴完位图再搬回去：下去约 **485 KiB**，上来约 **970 KiB**，一来一回约 **1.4 MiB** |

**后两行的数都不随回答变长而变**——它们只跟词表大小有关，每一步原样再来一遍。编译是一次性的，位图和搬运是每一步的。

## 状态机在调度那一侧，贴位图在跑模型那一侧

分工很干净：**状态机只活在 CPU 上的引擎和[调度器](vllm-scheduler.md)那一侧，跑模型的 [Worker](npu-worker-lifecycle.md) 拿到的是一张已经算好的位图。**

- **填位图**：引擎按这一批里带格式要求的请求，一条一条让状态机填自己那一行。已经写完的（状态机到了终点）那一行整行填 1，全都允许。
- **位图的内存只分配一次**：行数是「最多同时跑几条请求 ×（1 + 草稿 token 数）」。开了[投机解码](speculative-decoding.md)，每个草稿 token 的位置各占一行，外加最后那个 token 一行。
- **Worker 这边只做一件事**：把位图的行按请求重新排成这一批分数的行序，然后把 0 对应的分数改成负无穷。重排是必要的——位图的行序是调度器给的，跟 Worker 那边这一批里谁坐第几行无关。

还有一件事也在调度那一侧：算位图之前，要先把上一步**已经确认**的 token 喂进状态机，让它往前走一步；投机解码的草稿 token 也逐个喂进去试一遍，算完再退回来。**状态机吃的是已确认的 token，不是这一步刚采出来的**——所以它必须等上一步的结果回来。下一节就是这件事的代价。

## 开了它，异步调度只重叠一半

[异步调度](async-scheduling.md)默认是开着的：NPU 还在算这一步，CPU 已经在排下一步。排下一步时，上一步采出的 token 还没回来，调度器先记一张「欠条」。

对那条加了格式要求的请求，这就撞上了：从第 2 步起，每一步调度完都发现「它身上有欠条，又要用状态机」。于是**这一步的采样被推迟**——先停下来把上一步的结果取回来、记好账，拿到真 token 喂给状态机，才算得出这一步的位图，然后才发出采样。

所以准确的说法是：**模型前向照样和 CPU 重叠，采样那一段不再重叠。** 不开异步时看得更直白——算位图这件事就夹在「把活发给 NPU」和「等 NPU 返回」之间，填的正是 [引擎那一页](vllm-engine-core.md) 说的那个空档。

和投机解码同开还要再赔一笔：异步调度本来可以不把草稿 token 搬回 CPU，但只要这一批里有带格式要求的请求，就必须搬回来给状态机校验。

## 昇腾默认把分数搬回 CPU 再贴

这是昇腾侧最要紧的一条，而且三个版本一模一样：**在默认配置下，「把 0 对应的分数改成负无穷」这件事发生在 CPU 上。**

每一步，昇腾把这一批的分数从 NPU 搬到 CPU、转成 32 位浮点，贴完位图再搬回 NPU、转回原来的精度——上面那张表里约 1.4 MiB 的一来一回就是从这里来的。原因是上游在 GPU 上贴位图用的那个现成函数，在 NPU 上没有对应的算子。

NPU 上真有自己内核的是另一条路：新版的模型执行器。上游那条路用一个内核原地改分数，每次处理 8192 个 token；昇腾把它整个换掉，理由是 8192 会把 NPU 片上那块小缓存撑爆，而调小它又会让任务划分不稳。v0.23 的解法是保持 8192 不变、内部再按 1024 切一层循环。

但这条路默认走不到：昇腾另打了一个补丁，只认一个环境变量来决定开不开新版执行器，不写就是不开。所以**NPU 内核要显式打开新版执行器才用得上**（新旧两版执行器见 [NPU 上跑模型的那段代码](npu-model-runner.md)）。

## 一个引擎只能用一种编译器

把格式要求编译成状态机的库有四种：xgrammar、guidance、outlines、lm-format-enforcer。默认设成 auto，意思是**按每一条请求的格式要求挑**：先试 xgrammar，不支持就退到 guidance，还不支持再退到 outlines。

麻烦在于：引擎只在第一条请求来时建一次编译器，之后所有请求都用这一个。要是先来一条挑中 xgrammar 的请求，再来一条挑中 guidance 的，**编译时会把引擎打挂**。昇腾为此打了补丁：记住第一次挑中的是哪个，后面挑出不一样的请求直接报错拒收，不让它进来。

想彻底避开这件事，就别用 auto，启动时指定一种（写法见下面「怎么开」）。

## 常见误解

- **「加了格式要求，模型就不会生成不合法的 token 了。」**——模型照样会给不合法的 token 打高分，只是那些分被改成了负无穷，挑不出来而已。合法性是挑 token 那一步保证的，不是模型学会的。
- **「这里的掩码就是注意力里那个掩码。」**——不是一回事。[注意力](attention-qkv.md)里的因果掩码挡的是「后面的 token 不许被前面看见」，作用在模型内部每一层；这里的文法掩码挡的是「这一步不许挑哪些 token」，只作用在最后挑 token 那一下。
- **「位图是在 NPU 上算的。」**——不是。状态机、填位图、往前走和退回来全在 CPU 那一侧；送到 Worker 的是一张算好的成品。默认配置下连「贴」这一步也在 CPU 上。
- **「编译器默认是 auto，所以混着用不同格式要求没关系。」**——恰恰相反。auto 是按请求挑的，而引擎只认第一次建起来的那一个；昇腾把这种情况改成了显式报错，不打这个补丁的结果是编译时崩引擎。
- **「开了异步调度，结构化输出照样全程重叠。」**——采样那一段不重叠了：每一步都得等上一步的 token 回来喂给状态机。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

机制本身写在官方特性文档里 [S1]：格式要求编译成状态机，每步算出按位压缩的允许位图，一个 int32 管 32 个 token，bit 为 0 的 token 的 logit 写成 `-inf` 再采样。支持矩阵里 `Guided Decoding` 那一行三版一字不差，都是 🟢 Functional [S2]。

编译器（后端）有四个：`xgrammar`、`guidance`、`outlines`、`lm-format-enforcer`，默认 `auto` [C21]；`auto` 的挑法是先试 xgrammar、校验不过退 guidance、guidance 也不支持的特性再退 outlines [C22]。配置项是一个 JSON 串（dataclass 型配置统一按 JSON 解析）[C23][C24]。在那条请求的启动命令上加一项：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching \
    --structured-outputs-config '{"backend": "xgrammar", "disable_any_whitespace": true}'
```

- 前三项照 [那条请求](one-request.md) 的最小命令；官方教程在 A2/A3 上用的是 W8A8 权重（`--quantization ascend`）。换成量化权重不改词表，下面按词表算的数都不变。
- `disable_any_whitespace` 只有 xgrammar 和 guidance 认，配在别的后端上启动就报错。

请求侧的写法昇腾与 vLLM 完全一致，最小的一条：

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="EMPTY")
client.chat.completions.create(
    model="Qwen/Qwen3.6-35B-A3B",
    messages=[{"role": "user", "content": "给我一条员工记录"}],
    extra_body={"structured_outputs": {"json": {
        "type": "object",
        "properties": {"name": {"type": "string"}, "age": {"type": "integer"}},
        "required": ["name", "age"],
    }}},
)
```

- `json` / `regex` / `choice` / `grammar` / `json_object` / `structural_tag` 是这份参数里的六种约束字段 [C4]，**只能给一个**。
- 约束字段全为空时 `StructuredOutputRequest.from_sampling_params` 直接返回 `None`，请求上不会有 `structured_output_request` [C5]——那条不带格式要求的请求就是这样整条路径不走的。
- 昇腾自己的端到端用例覆盖的正是 `json` / `regex` / `choice` / `grammar` 这四种，外加流式、混合并发与非法请求恢复 [C40]。

### 会报什么错

- 上面六种约束给两个或者一个都不给，在 `StructuredOutputsParams.__post_init__` 里直接报错（上游 `vllm/sampling_params.py:89-110`）。
- `disable_any_whitespace` 配在 xgrammar / guidance 以外的后端上，启动即报错（上游 `vllm/config/structured_outputs.py:64-66`）。
- 后端混用：引擎级只保存一个后端实例——`grammar_init` 只在 `self.backend is None` 时建一次 [C9]。昇腾 `patch_structured_output.py` 把第一次解析出的后端名记在配置上，后面解析出不同后端的请求直接抛 `VLLMValidationError` [C30][C31]，并在 `grammar_init` 里再拦一道，防绕过 API 侧校验的请求；补丁说明写明不拦的话会在文法编译时把引擎打挂 [C32]。
- [!] main 上 Outlines 后端多一条 `OutlinesGrammar.accept_tokens` 短路：文法已完成时直接返回 True [C38]。按补丁自己的说明，没有这条短路时 JSON 写完之后那个 EOS 不在 FSM 的字母表里会被拒收，请求以 `FINISHED_ERROR` 收场——v0.23 / v0.26 上还没补。
- [!] 310P 的 v2 runner 带 `grammar_output` 进来直接 `NotImplementedError` [C39]：310P 上开了 v2 runner 就用不了结构化输出，只能退回 v1 runner。

### 开销和什么时候别开

**编译等待。** 请求一造出来状态就是 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR` [C6]，进的是 `skipped_waiting` 旁路队列而不是 `waiting` [C7]。编译提交到 EngineCore 的线程池；调度器每轮拿 100 µs 的超时去戳那个 future，戳通了才转成 `WAITING`[C8]。

**每步一行位图。** 位图只分配一次，行数 `max_num_seqs × (1 + num_speculative_tokens)`，注释写明每个投机位置一行、外加 bonus token 一行 [C11]；由 `Scheduler.get_grammar_bitmask()` 收集请求 [C13]，`StructuredOutputManager.grammar_bitmask()` 逐条 `fill_bitmask`，已终止的文法整行填满（上游 `vllm/v1/structured_output/__init__.py:190-197`），交出去前转成 `np.ndarray`，上游注释写明理由是序列化到 worker 更省 [C12]。本步的草稿 token 逐个 `accept_tokens` 推进状态机，算完再 `rollback`（同文件 `:278-291`）。Worker 侧按请求 id 把行重排成本批 logits 行序，再拷到 logits 所在设备原地写 `-inf` [C18]。

那条请求上的数 [D]：`vocab_size = 248320` [S41]，位图宽度用的就是 `model_config.get_vocab_size()`（上游 `vllm/v1/structured_output/__init__.py:133`）。

- 一行位图：⌈248320 / 32⌉ = 7760 个 int32 = 31040 B ≈ 30.3 KiB；200 步 ≈ 5.9 MiB。
- logits 往返按一行宽 248320、bf16（配置 `dtype: bfloat16` [S41]）算：下去 248320 × 2 B = 496640 B ≈ 485 KiB；`.float()` 后上来 248320 × 4 B = 993280 B ≈ 970 KiB；合计约 1455 KiB ≈ 1.4 MiB/步，200 步约 284 MiB。
- 这些数只跟词表有关，不随回答变长、也不随 TP 变。

**CPU 贴位图那四行**（`NPUModelRunner.sample_tokens`，三版一致）[C25]：

```python
logits_dtype = logits.dtype
logits = logits.to("cpu").float()
apply_grammar_bitmask(scheduler_output, grammar_output, self.input_batch, logits)
logits = logits.to(self.device).to(logits_dtype)
```

转 `float()` 不是多余的：上游 `apply_grammar_bitmask` 的 CPU 分支本来就要把非 float32 的 logits 转一遍再转回来，昇腾提前转好正好落进它的 `else` 支。真正的原因是 xgrammar 的 `apply_token_bitmask_inplace` 在 NPU 上没有算子——上游的非 CPU 分支是把位图拷到 `logits.device` 上直接交给它[C19]。

代码上方那句注释说「上游用 `torch.compile` 优化、昇腾不支持」，**对不上钉住的源码** [!]：`vllm/v1/structured_output/utils.py` 里没有 `torch.compile`，两条分支都是直接调 xgrammar。注释描述的多半是 xgrammar 库内部的实现，不是这个函数 [I]。

**异步调度的重叠打折。** 默认走 `step_with_batch_queue`；`AsyncScheduler` 在调度完的当下算 `pending_structured_output_tokens |= use_structured_output and num_output_placeholders > 0` [C17]。对带 schema 的请求，这个值从第 2 圈起一直是真，每一圈走 `else` 支：`sample_tokens` 推迟 [C15]，先阻塞取回上一圈结果、`update_from_output`，再算位图、补发 `sample_tokens` [C16]。同步 `step()` 上 `get_grammar_bitmask` 夹在 `execute_model(..., non_block=True)` 与 `future.result()` 之间 [C14]。投机解码同开时，异步本可跳过把草稿 token 搬回 CPU，只要批里有结构化输出请求就跳不了 [C26]；推迟的那一支里也必须先 `take_draft_token_ids()` 才算得出位图。

**v2 runner 的 NPU 内核。** 上游 v2 路径用 Triton 内核原地写 `-inf`，`BLOCK_SIZE = 8192` [C20]；昇腾在 `patch_triton.py` 把 `_apply_grammar_bitmask_kernel` 整个换掉 [C29]，文件头理由：`BLOCK_SIZE=8192` 撑爆 UB、调小又让 grid 不稳，于是保持 8192、内部按 `BLOCK_SIZE_SUB = 1024` 再切 [C27][C28]。但昇腾补丁把 `use_v2_model_runner` 改成只认 `VLLM_USE_V2_MODEL_RUNNER`，不写就是 `False` [C33]，默认走不到。

**什么时候别开：** 不需要格式保证的请求别带约束——不带就一步都不走。混合负载里别用 `auto`，显式指定一个后端。310P 上别开 v2 runner。

### 版本差异

主机制（位图、编译状态、CPU 贴位图那四行）三版一致。不一致的只有这几行：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| NPU 位图内核放在哪 | `worker/v2/structured_outputs.py`，内部按 `BLOCK_SIZE_SUB=1024` 二次切分 | 与 v0.23 逐字相同 | 挪到 `ops/triton/v2/apply_grammar_bitmask.py`，取消二次切分，改成按 VectorCore 数均分任务、`multibuffer=False`[C36][C37] | 升到 main 之后文件路径变了，调优结论也跟着变，别照抄旧路径的性能数据 |
| 推理模型的文法边界 | 无 | 多回填一份 `grammar_bitmask` / `should_advance`，且只在 `vllm_version_is("0.26.0")` 为真时才装 [C34] | 无（上游已带） | 给 v0.26.0 这一个上游版本的临时垫片，换上游版本就自动不装 |
| Outlines 后端收尾 | 无 | 无 | 多一条 `OutlinesGrammar.accept_tokens` 短路 | [!] v0.23 / v0.26 上 JSON 写完后 EOS 会被拒收，见「会报什么错」 |
| 310P 的 v2 runner | 该路径不存在 | 该路径不存在 | 带 `grammar_output` 直接 `NotImplementedError` | [!] 310P 上开 v2 runner 就用不了结构化输出 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| CPU 贴位图那四行 | v0.23 `vllm_ascend/worker/model_runner_v1.py:2448-2455`；v0.26 同文件 `:2355` 起；main 同文件 `:2757` 起 |
| 注释里那句 `torch.compile` | v0.23 `vllm_ascend/worker/model_runner_v1.py:2451` |
| 欠条 × 结构化输出 | 上游 `vllm/v1/core/sched/async_scheduler.py:27-29` |
| 后端只建一次、位图宽度取词表 | 上游 `vllm/v1/structured_output/__init__.py:130-171`（`vocab_size` 在 `:133`） |
| 位图行数 `max_num_seqs × (1 + num_speculative_tokens)` | 上游 `vllm/v1/structured_output/__init__.py:220-229` |
| 昇腾 NPU 位图内核（v0.23 / v0.26） | `vllm_ascend/worker/v2/structured_outputs.py:19-23`（理由）、`:34-50`（内核） |
| 内核替换 | `vllm_ascend/patch/worker/patch_v2/patch_triton.py:15`、`:32` |
| v2 runner 只认环境变量 | main `vllm_ascend/patch/__init__.py:774-786` |
| 后端混用拦截 | `vllm_ascend/patch/platform/patch_structured_output.py` |
