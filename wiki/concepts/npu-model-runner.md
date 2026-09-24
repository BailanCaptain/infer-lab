---
id: npu-model-runner
title: NPUModelRunner：一步之内它做的五件事
type: feature
summary: 每颗 NPU 上都有一个它。调度器定下这一步算谁之后，是它把这批请求摆成模型能吃的样子、把模型从头跑到尾、从末尾挑出下一个 token，再把结果交回去。代码是一个五千多行的大文件，按「这一步走过哪几段」去读，不要从头读。
aliases: [NPUModelRunner, ModelRunner, model_runner_v1, model_runner_v1.py, execute_model, sample_tokens]
chapters: ["09"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L211-L267
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L282
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L729-L760
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L862-L880
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1950-L1970
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2404-L2428
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3367-L3383
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3843-L3865
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4915
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L505-L523
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L296-L307
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1799-L1815
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2024-L2100
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2229-L2266
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2294-L2322
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2357-L2401
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2445-L2458
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2529-L2540
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1304-L1310
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2154-L2195
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_mamba_utils.py#L217-L287
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L374
  - vllm@0fc695fc:vllm/config/vllm.py#L1902-L1903
  - vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L950-L957
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L143-L146
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L160-L163
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2001-L2001
  - vllm@568afb3a:vllm/model_executor/models/config.py#L558-L562
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L30-L47
  - vllm@0fc695fc:vllm/v1/engine/core.py#L455-L463
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prepare-inputs-flow
    kind: builds-on
    note: 五件事里的第二件「摆好输入」单独成页，张量怎么拼出来在那里讲
  - to: one-request
    kind: builds-on
    note: 贯穿例子的 200 步，每一步都要在这一站把五件事做一遍
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

调度器只决定「这一步算谁、各算几个 token」，它自己不碰模型。真正把模型跑起来的是每颗 NPU 上的 ModelRunner：每一步它接过调度结果，把这批请求摆成模型能吃的样子，把模型从第 1 层跑到最后一层，从末尾挑出下一个 token，再把这个 token 交回去。

```wiki-diagram
file: model-runner-layout
```

## 问题：调度器说「这一步算它 37 个 token」，然后呢？

拿[贯穿例子](one-request.md)的第一步来说：调度器看了一眼队列，决定这一步把那条请求的 37 个 token 全算掉。到这里为止，手里只有一张「谁、几个」的清单，还没有任何一个数字进过 NPU。

从这张清单到「回答的第 1 个 token 出来了」，中间的活全在这一站。它每一步都做同样的五件事，顺序固定：

1. **收下调度结果。** 把「这条请求是新来的、这一步算 37 个」记进自己手里那张本子。本子上记着这颗 NPU 上正在跑的每条请求：已经算到第几个 token、笔记放在哪几块。
2. **摆好输入。** 把 37 个 token 摆成一排，配上每个 token 在句子里排第几、它的笔记要写进块里的第几格。怎么摆是一整页的内容，见 [从请求到张量](prepare-inputs-flow.md)。
3. **跑一遍模型。** 37 个 token 一起从第 1 层走到第 40 层。
4. **挑出下一个 token。** 在 37 个位置里只取最后一个，把它换算成词表上 248320 个词各一个分数，再按采样规则挑出一个。这一个就是回答的第 1 个 token。
5. **交回去。** 把「这条请求这一步出了哪个 token」交还给引擎，这一步就结束了。

后面 199 步做的还是这五件事，只是第 1 件记的是「这一步算它 1 个」，第 3 件只有 1 个 token 在走。

## 为什么只取最后一个位置

第 3 件事里 37 个 token 都走完了 40 层，每个位置都有一份结果，但第 4 件事只看最后一个。

原因在模型本身：每个位置的结果是在猜「我后面那个 token 是什么」。前 36 个位置猜的是问题里本来就有的字，答案已经知道了，猜了也没用；只有第 37 个位置猜的是问题后面、还没人写出来的那个字。

所以这 36 份结果不是白算：它们在走 40 层的路上给全注意力那 10 层留下了笔记，下一步会用上。只是换算成词表分数这一步不用给它们做。

## 跑模型和挑 token 是两次分开叫它

五件事看起来是一口气做完的，其实引擎是**分两次**叫这一站的：第一次叫，它做完前三件，把「每个词的分数」留在手里，然后空着手返回；第二次叫，它才拿出这份分数做第 4、5 件。

分开的好处是中间能插进别的事。比如要求回答必须是合法的 JSON 时，引擎趁 NPU 还在跑模型，让调度器那边算出「哪些词这一步不许出现」，第二次叫它的时候一起带过来，挑 token 之前先把这些词的分数压掉。两边同时干活，谁也不等谁。

顺序是死的：上一次的分数还没被取走，就又来叫第一次，它会直接报错。

## 这个模型在这一站多了一件小事

贯穿例子的模型 40 层里有 30 层是[线性注意力](linear-attention.md)，每条请求在这 30 层各有一份固定大小的状态。按官方教程打开前缀缓存之后，这份状态也要跟着块走：请求一旦写满一个块、跨进下一个块，这一站就要在跑模型之前把状态搬到新块那一格去，这样以后别的请求开头一样时，能直接从块的边界接着算。

这件事夹在第 2 件和第 3 件之间，每一步都会查一遍。

但在这个例子里它一次也不会真搬：块是 2048 个位置，这条请求从头到尾只有 237 个 token，一直待在第一个块里。第一步时它还没有状态可搬；之后每一步查到的「上一步在哪块」和「这一步在哪块」都是第 0 块，不用动。

要让它真搬一次，请求得长过 2048 个 token。

## 两颗 NPU 各有一个

例子用两颗 NPU 把注意力对半切。每颗 NPU 上守着一个 Worker，每个 Worker 里各造一个 ModelRunner。所以同一步里有两个 ModelRunner 同时在做这五件事，各跑各的那一半，第 3 件事里需要对账的地方由它们之间传数据补上，这部分在[张量并行](tensor-parallel.md)和[专家并行](expert-parallel.md)。

## 代码怎么读：问「这一步走过哪几段」

这一站的代码是一个五千多行的文件，全仓最大的单文件之一。从第 1 行往下读是读不完的，而且这个文件里没有的东西也不代表不支持——它是在上游通用版本上改出来的，没改的部分直接用上游那一份。

正确的读法是：**先想清楚你关心的是五件事里的哪一件，再直接跳到那一段。** 贯穿例子的每一步在这个文件里只走过四段——收结果、摆输入、跑模型、挑 token；文件里剩下的大块，要么只在启动时跑一次（量显存、分配块、登记每层要多大的笔记），要么是另一条路径（启动时用来试跑的假批）。

每一件事对应哪一段、在哪一行，见下面的源码位置表。

## 对照源码

### 怎么开

- `NPUModelRunner` 继承上游 `GPUModelRunner` [C2]，文件里另外两个类 `GraphCaptureContext`、`ExecuteModelState` 只是装数据的小结构 [C1]。文件里没有的方法走上游实现 [D]。
- 对象在 `NPUWorker.init_device` 里造，不在 Worker 的构造函数里；同一处按 `use_v2_model_runner` 决定是否换成 `worker/v2/model_runner.py` 里的实验性实现 [C10]。看到 `worker/v2/` 不要以为主线已经切过去了 [D]。
- 五件事与代码的对应（v0.23 行号）：
  - 收下调度结果：主流程里调 `_update_states` [C13]。
  - 摆好输入：同一处接着调 `_prepare_inputs`，再建注意力元数据 `_build_attention_metadata`、`_preprocess`[C14]。
  - 跑一遍模型：在 `set_ascend_forward_context` 里调 `_model_forward` [C15]。
  - 只取最后一个位置：非投机解码、非上下文并行时 `logits_indices = query_start_loc[1:] - 1`，即每条请求的最后一个 token [C19]；主流程跑完模型后先按这些下标取出 `hidden_states`，再 `compute_logits` [C16]。例子第一步 37 个 token，取下标 36 [D]；248320 是官方配置的 `vocab_size` [S29]。
  - 两次调用：主流程把 logits 等存进 `self.execute_model_state` 后 `return None`；`sample_tokens` 取出这份状态并清空，先应用 `grammar_output`（结构化输出的位掩码），再 `_sample` [C17]，最后组装 `ModelRunnerOutput`（`sampled_token_ids` 等）返回 [C18]。引擎那头先以非阻塞方式发出 `execute_model`，紧接着让调度器算 `get_grammar_bitmask`，再调 `sample_tokens(grammar_output)` [C31]——结构化输出的掩码就是这样和前向重叠的。
  - 第二次叫时手里没有存下的状态（例如流水线并行的非末级），`sample_tokens` 不报错，直接返回 `None` 或空输出 [C6]。
- 混合模型在这一站多出的那件事（v0.23）：
  - 链路：`model_config.is_hybrid` 为真时调 `HybridAttentionMambaModelConfig.verify_and_update_config` [C23]，昇腾把它整个换掉，换上的版本先调 `MambaModelConfig.verify_and_update_config` [C30]。后者在打开前缀缓存、`mamba_cache_mode` 还是 `none` 时，按 `supports_mamba_prefix_caching` 定成 `all` 或 `align` [C22]。
  - 这个标记来自模型类是否声明 `SupportsMambaPrefixCaching` 协议 [C24]。上游模型目录里声明它的只有 mamba、mamba2、jamba、bamba、zamba2、nemotron_h、granitemoehybrid、falcon_h1 这几个文件，Qwen3.5 系的 `qwen3_5.py`（贯穿例子这个模型走的文件）没有 [D]，所以例子按教程打开前缀缓存后落到 `align`。此时 `mamba_block_size = block_size`，即 2048 [C25]。
  - `align` 下主流程在建注意力元数据之前调 `preprocess_mamba` [C20]。昇腾换掉了上游这个函数：只收集要搬的块，不当场搬（注释：`do not copy here, since kv_transfer still not load`），真正的 `do_mamba_copy_block` 挪到前向上下文里、`_model_forward` 之前 [C21]。
  - 搬不搬的判断：`prev_state_idx = (num_computed_tokens - 1) // block_size`，`curr_state_idx = cdiv(num_computed_tokens + num_scheduled_tokens, block_size) - 1 - num_speculative_blocks`，二者不同且 `prev ≠ -1` 才搬。例子第一步 `prev = (0 - 1) // 2048 = -1`；之后 `num_computed + 1 ≤ 237`，`curr = cdiv(≤237, 2048) - 1 = 0 = prev`，全程不搬 [D]。

### 会报什么错

- `execute_model` 进来时 `execute_model_state` 不为空（上一次的 `sample_tokens` 还没来取）：`RuntimeError("State error: sample_tokens() must be called after execute_model() returns None.")` [C5]。
- `mamba_cache_mode` 为 `align` 时要求开着分块 prefill，否则断言失败：`Chunked prefill is required for mamba cache mode 'align'.`。
- 上游在把混合模型的 `mamba_cache_mode` 自动定下来时会打一条 warning：`Mamba cache mode is set to '%s' for %s by default when prefix caching is enabled`，并附一条 info 说它对 Mamba 层的支持是实验性的。按教程启动这个模型会看到这两条，属正常。

### 开销和什么时候别开

- 只取最后一个位置换算词表分数，省的是 `(37 − 1) × 248320` 个分数的计算量 [D]；前 36 个位置走 40 层的计算省不掉，因为全注意力层要给它们留笔记。
- `align` 下的状态搬移只在请求跨进新块时发生；这个模型块是 2048，短请求基本碰不到，长请求每跨一个块搬一次 [D]。
- 这一站的大部分分支（投机解码、上下文并行、流水线并行、KV 传输、多模态）在贯穿例子里都不走；读代码时遇到这些条件可以先跳过 [D]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `__init__` 开头那段手工 pad | 先把 `prefill_context_parallel_size * 2 * max_num_seqs` 加到 `scheduler_config.max_num_batched_tokens`，注释标 TODO 并附上游 PR 链接，`super().__init__()` 之后再减回去 | 这段 pad 和那条 TODO 都没有了，`__init__` 第一件事是设 `use_compress` [C11] | 父类初始化期间的批 token 上限不再被临时顶高 [!] |
| 必须在 `super().__init__()` 前设好的字段 | 有：父类初始化可能调到 `_allocate_kv_cache_tensors`，它会读 `self.use_compress` | 同 | 读这类子类文件先看 `super().__init__()` 前后各做了什么 [A] |
| 文件行数与入口行号 | 5251 行 | 5314 行，七个入口全部漂位 [D] | 引用一律写 `repo@commit:path#L起-L止` |
| `execute_model` 位置 | L1950 | L1799，反而往前挪了 151 行 | 同上 |
| 混合模型 `align` 分支 | 有 | 有，`execute_model` 里同样的判断在 L2001 | 例子在两个版本上都落到 `align`：v0.26 上游的判定逻辑相同，Qwen3.5 仍未声明 `SupportsMambaPrefixCaching` [D] |
| v2 ModelRunner | 配套上游是 0.23.0 时即使设了 `VLLM_USE_V2_MODEL_RUNNER` 也强制退回 v1，打 warning [C26] | 没有这段退回，按 `use_v2_model_runner` 走 | 在 v0.23 上打开 v2 开关不会生效 |

`execute_model` 开头还有一段跨进程约定：`profiling_chunk_config.need_timing` 为真时，看 `scheduler_output.disable_profiling_timing` 决定是否关掉计时，注释写明这个标志通过 `scheduler_output` 跨进程传递，因为在调度器进程里改配置单例不影响 Worker 进程。这是[三个进程与 patch 注入点](engine-processes.md)那条约束的直接后果：跨进程要传状态，只能挂在本来就会传过来的对象上。

### 源码位置

十个区的划分、方法名、进入方式两个版本一样，只有行号漂了；v0.26 列是在 `2ed6cbba` 上重新数的 [D]。

| 你想看的事 | 进哪个方法 | v0.23 行号 | v0.26 行号 |
|---|---|---|---|
| 调度结果怎么合进本卡状态（第 1 件） | `_update_states` | 729 | 823 |
| 张量怎么拼出来（第 2 件） | `_prepare_inputs` | 862 | 890 |
| 一步执行的主流程（第 1–3 件） | `execute_model` | 1950 | 1799 |
| 采样与输出（第 4–5 件） | `sample_tokens` | 2404 | 2311 |
| profile 或图捕获用的假批 | `_dummy_run` | 3367 | 3374 |
| KV 张量怎么分配 | `initialize_kv_cache` / `initialize_kv_cache_tensors` | 3843 起 | 3901 起 |
| 每层每块的 KV 形状声明 | `get_kv_cache_spec` | 4909 | 4954 |
| 混合模型状态搬移（昇腾版） | `vllm_ascend/patch/worker/patch_mamba_utils.py` 的 `preprocess_mamba` | 217 | — |

- `_prepare_inputs` 本身从 862 行排到 1375 行；它所在那一区到 1663 行，后面接的是几个同样为准备输入服务的辅助方法，合起来占全文件近六分之一 [D]。
- 常见误解：「`_dummy_run` 是测试代码」——它是生产路径的一部分，profile 显存和捕获 ACL Graph 都靠它跑假批；「行号可以当书签」——这是全仓改动最频繁的文件之一，行号在两个 ref 之间就会漂。
