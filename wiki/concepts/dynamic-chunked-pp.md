---
id: dynamic-chunked-pp
title: "动态分块流水线并行：让每块耗时相等，而不是 token 数相等"
type: feature
summary: 长问题切成一样大的几块送进流水线时，越靠后的块越慢，下一段只能干等。这个功能开机时先真跑一遍、量出「切多大要花多久」，运行时反过来算每一步该切多少，让每块花的时间一样长。只在开了流水线并行时能用，官方把它定位给 PD 分离里跑长问题的 P 节点。
aliases: [动态分块流水线并行, ProfilingChunkScheduler, ChunkSizePredictor, ProfilingChunkManager, profile_prefill_latency, 动态分块 PP, 等耗时切块]
chapters: ["13", "12"]
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L69-L74
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L90-L94
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L720-L725
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L17-L21
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L85-L93
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L127-L168
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L178-L198
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L202-L220
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L248-L251
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L313-L342
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L405-L412
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L545-L567
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L69-L107
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L121-L142
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L237-L271
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L259-L271
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L374-L388
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L808-L856
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1959-L1968
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L55-L74
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L112-L127
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L200-L212
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L741-L751
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L9-L18
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L54-L63
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L65-L83
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L146-L152
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L16-L22
  - vllm-ascend@2c59ff10:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L86-L104
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.html
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L667-L671
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L993-L997
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L9-L16
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L38-L41
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L969-L973
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1011-L1012
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1271-L1280
  - vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L91-L103
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L89-L103
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: pipeline-parallel
    kind: builds-on
    note: 它治的是 PP 那页讲的气泡里的一种——同样大的块越往后越慢造成的那一种
  - to: chunked-prefill
    kind: builds-on
    note: 它改的就是那页讲的「每步切多少」，把固定的 token 预算换成按耗时反解出来的数
  - to: vllm-scheduler
    kind: builds-on
    note: ProfilingChunkScheduler 把上游 schedule() 整段抄过来改，被改的 num_new_tokens 预算逻辑在那页
  - to: async-scheduling
    kind: builds-on
    note: 它直接继承 Scheduler、没有 Async 版，官方启动命令里那句 --no-async-scheduling 的真实代价在那页
  - to: profiling-chunk-config
    kind: builds-on
    note: 每个配置键的默认值、取值范围和开了之后的代价在参数页，这页只讲机制不重抄
  - to: balance-scheduling
    kind: conflicts-with
    note: 三个版本上同开都是启动直接 ValueError，没有自动降级
  - to: dyntra-lb
    kind: conflicts-with
    note: main 开发主线上 DyntraLB 的校验里单列一条，同开 ValueError
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一篇 128k 的长文，切成 4 块送进流水线

[那条请求](one-request.md)用不上这个功能，先把话说在前面：它用张量并行（TP）把每层对半切给两颗 NPU，没有开流水线并行（PP），而这个功能**只在 PP 大于 1 时才能开**，否则启动直接报错；况且问题只有 37 个 token，一步就算完，根本不用切块。

所以这一页换个场景。还是同一个模型 Qwen3.6-35B-A3B、还是两颗 NPU，但做两处改动：

- 不用 TP，改用 [PP](pipeline-parallel.md)：40 层切成前 20 层、后 20 层，一颗 NPU 一段，像接力一样一段算完交给下一段。
- 问题不再是 37 个 token，而是一篇 131072 个 token（128k）的长文。这个模型最长能读 262144 个 token，128k 放得下。

128k 个 token 一步算不完，要用 [Chunked Prefill（分块预填充）](chunked-prefill.md)切成几块、分几步算。假设每步最多 32768 个 token，那就是 4 块，每块一样大。

问题来了：**这 4 块一样大，算起来却一块比一块慢，第 4 块要花第 1 块的好几倍时间。** 第 2 段 NPU 每次都得等第 1 段交棒，第 1 段越算越慢，第 2 段就越等越久。为什么？有没有办法让每一棒跑得一样长？

先说清楚：这个模型的官方示例没有用 PP，也没有用这个功能；这一页的场景是为了讲清楚机制做的示意。

## 同样大的一块，为什么越往后越慢

回想[注意力](attention-qkv.md)在做什么：每个 token 要回头看一遍前面所有 token。第 1 块的 32768 个 token 只需要互相看；第 4 块的 32768 个 token 除了互相看，还要回头看前面已经算过的 98304 个。**块一样大，要看的东西却越来越多。**

如果只算注意力这一项，4 块的耗时正好是 1 : 3 : 5 : 7。把第 1 块的耗时叫 T，四块就是 T、3T、5T、7T。

落到这个模型上要打个折。它 40 层里只有 10 层是全注意力，会越往后越慢；另外 30 层是[线性注意力](linear-attention.md)，每层只带着一份固定大小的状态往下走，算一块的时间只跟这一块多长有关，跟前面算过多少无关。专家那部分也一样。所以在这个模型上，真实的差距比 1 : 3 : 5 : 7 温和，1 : 3 : 5 : 7 是「只剩注意力」时最极端的情况。下面先按最极端的情况讲，道理最清楚。

## 流水线为什么会被拖慢

两段接力时，一块要先在第 1 段算完前 20 层，再交给第 2 段算后 20 层，每段各花这块耗时的一半。

- 第 1 块：第 1 段花 0.5T，交给第 2 段；第 2 段花 0.5T 就做完了。
- 第 2 块：第 1 段要花 1.5T。第 2 段早就做完了上一块，只能干等。
- 第 3、第 4 块同理，而且越等越久。

这段干等就是流水线的**气泡**。四块走完一共要 11.5T。

```wiki-diagram
file: dynamic-chunked-pp
```

## 反过来切：先定好每块花多久，再算这一块装多少 token

这个功能的想法很直接：**不让每块 token 数一样，而是让每块耗时一样。** 前缀短的时候切厚一点，前缀越长切得越薄。

目标耗时就定成第 1 块的耗时 T。之后每一步都问一句：「前面已经算了 L 个 token，这一步要刚好花 T，能装多少个？」这是一个能直接解的方程。按最极端的情况解出来，128k 的长文会被切成这样：

| | 固定块 | 动态块 |
|---|---|---|
| 每块多少 token | 32768、32768、32768、32768 | 32768 → 13572 → 10415 → 8780 → 7735 → … → 4162 |
| 几步走完 | 4 | 16 |
| 每步耗时 | T、3T、5T、7T | 每步都是 T |
| 两段流水线走完一共多久 | 11.5T | 8.5T |

动态块的时候，第 1 段一块接一块地算，第 2 段每次都刚好接上，中间没有空等。

有两件事要看清楚：

- **总计算量一点没省。** 两边加起来都是 16T 的活，省下的 3T 全是第 2 段原来空等的时间。
- **步数从 4 变成了 16。** 每一步都有一笔固定开销：调度器挑请求、两段之间传一次中间结果、NPU 上启动一遍算子。步数多 12 次，这笔开销就多付 12 次。所以官方在一个 128k 的例子上实测只快了约 17%，比这里算的 26% 保守。

## 这个模型的块很大，对齐会打折扣

表里的数是「刚好花 T」的理论值。实际切的时候，每块还要向上凑成**块大小的整数倍**——块就是给 [KV Cache](kv-cache.md) 一次分的那一片位置。

大多数模型的块是 128 个位置，凑一下差得不多。但这个模型因为混了线性注意力，块被撑得很大：一段一颗 NPU 时是 2048 个位置（怎么算出来的见[那条请求](one-request.md)下半）。凑成 2048 的倍数之后，128k 的长文实际是这样切的：

32768 → 14336 → 12288 → 10240 → 8192 → 8192 → 6144 × 7 → 最后剩 2048，一共 14 步。

后半程的块被一律抬到 6144，比「刚好花 T」该切的多出一截，这几步的耗时从约 1.1T 涨到约 1.4T，气泡又回来了一点。**块越大，对齐越粗，拉平得越差。**

## 开了它，换掉的是整个调度器

这个功能不是在原来的调度器上加一个小钩子，而是把[调度器](vllm-scheduler.md)——每一步决定这一批放哪些请求、每条算多少 token 的那段代码——整个换成了一份自己的版本。它把上游挑请求的那一大段整个抄过来，只在里面改了两处。代价是上游一改调度器，这份副本就得跟着手改。

改的那两处做的是同一件事：原来的逻辑先算出这一步给这条请求多少 token，然后它再拿预测出来的数截一刀，取两者中小的那个。所以：

- **只会切小，不会切大。** 每步最多多少 token 那个上限照样有效，想让第一块更大只能调那个上限。
- **预测失败就不截。** 方程无解、解出来不是正数、曲线还没量好，都按原来的块走。

它还多记了一本**时间账**：每一步开头有一笔时间预算，就是目标耗时 T。每挑进一条还在 prefill 的请求，就按预测扣掉它要花的时间，扣完了这一步就不再往里塞。已经在 decode 的请求不扣，免得一步里塞满 decode、把 prefill 饿死。开了它之后，一步能塞多少不只看 token 数，还看预测出来的耗时。

## 曲线是开机时真跑出来的

「切多大要花多久」这条曲线不是估的，是开机时在这台机器上真跑出来的。

引擎准备好之后、开始接请求之前，它会从最大块往下均匀挑 64 种块大小，每种都让 NPU 真跑一遍 prefill 并计时，第一次当热身丢掉。PP 下所有段都要一起跑（不然彼此对不上），但只取第 1 段的计时。量到的点够了，就拟合出一条曲线；少于 8 个点就放弃，整个功能**悄悄退回固定块**，不报错。

所以开了它，启动会明显变慢，这不是故障。

服务起来之后，它还可以一边跑一边校准。校准期间有三条规矩：

- **曲线没量好之前，一律不截**，刚开机的请求按固定块走。
- **只管 prefill，不碰 decode。**
- **每条请求的第一块故意不截**，因为只有从零开始的那一块才拿来标定目标耗时，标够 3 次才算定下来。

校准攒够 30 个点就停，以后不再重新拟合。停了以后 NPU 也不用每步停下来计时，省掉一笔同步开销；但官方说不做在线校准，结果会差一些。

## 什么时候能开，和谁不能一起开

能开的条件：

- **必须开 PP，而且 PP 大于 1。** 不满足启动直接报错。
- **必须开分块预填充。** 官方文档写成硬性要求，但代码里没有拦这一条。
- **官方定位是 [PD 分离](pd-disaggregation.md)里的 P 节点、跑长问题。** PD 分离就是把 prefill 和 decode 放到不同机器上跑，P 节点是专跑 prefill 的那边。v0.23 的文档口气还比较宽，只说推荐在 PD 分离场景用；v0.26 起改成「就是给 P 节点设计的」，D 节点不用配。

不能一起开的：

| 和谁 | 结果 |
|---|---|
| [负载均衡调度](balance-scheduling.md) | 三个版本都是启动直接报错，二选一 |
| [DyntraLB](dyntra-lb.md) | 启动直接报错（DyntraLB 只 main 有） |
| [批作业感知调度](batch-job-aware-scheduler.md) | **不报错，但会被悄悄盖掉**，这个功能实际没生效 |
| [短请求优先](short-request-first.md) | 看版本：v0.26 报错；main 放行，但此时不能再开异步调度 |
| [异步调度](async-scheduling.md) | 不报错，但它没有异步版本；官方启动命令里明确关掉了异步调度 |

回到这一页的例子：那条 37 个 token 的请求 PP=1，第一条就不满足；而且官方支持矩阵里这个模型不支持 PD 分离，也就不在这个功能的官方定位里。

## 常见误解

- **「它是个调优开关，打开试试就行。」**——打开就换掉了整个调度器，而且要先跑完开机那一轮测量才开始服务。启动明显变慢不是故障。
- **「切得更细，所以每步更快、总时间更短。」**——总计算量不变。128k 那个例子里两边都是 16T 的活，快的是流水线不用空等，代价是步数从 4 变成 16。
- **「动态块会比固定块切得更大。」**——不会。它只会把原来的数往小里截，每步 token 数的上限还是天花板。
- **「预测一开机就生效。」**——开机测量没成功就一直按固定块走，而且不报错；开着在线校准时，每条请求的第一块也不截。

## 对照源码

下面以 **v0.23 维护分支**（2c59ff10）为准。三个在册版本上都有这个功能：三处源码加三处文档，六个路径在三个钉住的提交上都在。版本之间真正分叉的只有配置路径、和 ShortRequestFirst 的关系、以及官方定位这三处，见「版本差异」。

### 怎么开

官方 tutorial 的 P 节点设定是 `--pipeline-parallel-size 2`、`--enable-chunked-prefill`、`--max-num-batched-tokens 32768`、`smooth_factor 1.0`、`min_chunk 4096` [S29]。那份 tutorial 用的是 DeepSeek-V3.1，不是 Qwen3.6。v0.23 上配置写在 `additional_config.profiling_chunk_config`，v0.26 起的写法见版本差异。每个键的默认值和取值范围在[动态切块配置](../params/profiling-chunk-config.md)，这页不重抄。

开了之后 `scheduler_cls` 会被整个换成 `ProfilingChunkScheduler` [C3]。它的两个输入：`base_chunk_size` 就是调度器的 `max_num_scheduled_tokens`（上面是 32768），`page_size` 取 `cache_config.block_size` [C5]。

**128k 那张表的推导**。假设延迟里只有注意力那一项、常数项与线性项忽略（`b = c = 0`）[A]，延迟曲线是 `f(l) = a·l²`。目标耗时 `T = f(32768) − f(0) = a·32768²`，求解 `a·x² + 2aL·x − T = 0` [C15]，得到 [D]：

```
x = −L + √(L² + 32768²)           # L 是这条请求已经算过的前缀长度
⟹ L_{n+1}² = L_n² + 32768²       ⟹ L_n = 32768·√n
```

`L_n = 32768·√n` 走到 131072 要 `n = 4² = 16` 步。固定块的四块耗时是 `f(32768k) − f(32768(k−1)) = (2k−1)·T`，即 `T : 3T : 5T : 7T`。两段各花一半，总时长固定块 `16T/2 + 7T/2 = 11.5T`，动态块 `16T/2 + T/2 = 8.5T` [D]。表里的块大小 13572、10415 等是未对齐的正根。

Qwen3.6 的 30 层线性注意力和 MoE 专家只贡献线性项 `b`，所以这个模型上 `a` 的相对占比比纯全注意力模型小，1 : 3 : 5 : 7 是上界 [I]。

**对齐**。代码在正根之后先做平滑 `base + smooth_factor·(x − base)`，再取 `max(·, min_chunk)`，最后向上对齐到 `max(page_size, 64)` 的倍数：`((chunk_size + align - 1) // align) * align` [C16]。

- 旧例的 tutorial 设定（`page_size = 128`）下：`13572 → 13696`，最后一块 `4162 → 4224`，再往下一块 `32768×(√17−4) = 3927` 就会被 `min_chunk = 4096` 顶住。官方那张「64k 配 20480、128k 配 32768」的推荐表要避开的就是这件事。
- Qwen3.6 的 `page_size`：混合模型的块大小由 `patch_mamba_config` 按 SSM 页对齐算出，再写回 `cache_config.block_size` [C40]。PP 不改变每层每颗的 KV 头数和 SSM 页，所以按 [那条请求](one-request.md) 下半 TP=1 那一格取 2048。代入逐步递推（`smooth_factor = 1.0`，`min_chunk = 4096` 在 6144 之下不起作用）[D]：前缀 32768 时正根 13572 → 14336；47104 时 10277 → 12288；59392 时 8440 → 10240；69632 时 7325 → 8192；77824 时 6617 → 8192；86016 起正根落在 6030 到 4294 之间，一律 → 6144，共 7 块；最后剩 2048，被 `min(predicted_chunk, num_new_tokens)` 截成 2048。合计 14 步。6144 一块的耗时是 `a(6144² + 2L·6144)`：`L = 92160` 时约 1.09T，`L = 122880` 时约 1.44T。

设计文档写对齐是 "Round down to multiple of `page_size`"，代码是向**上**取整——以代码为准 [!]。

**调度器怎么改的**。`ProfilingChunkScheduler` 直接继承上游 `Scheduler`。除了 `__init__`，它唯一覆盖的上游方法就是 `schedule()`：整段照抄再改，改动处用 `>>> PROFILING CHUNK` 注释框起来。文件头写着 "Compatible with vLLM v0.15.x scheduler. When the upstream `schedule()` method is refactored, this override should be updated accordingly" [C4]；v0.26 与 main 上这个文件的改动大半是在追这件事 [D]。

真正改的只有两处，RUNNING 和 WAITING 队列各一处，形状一样：

```python
predicted_chunk = self.profiling_chunk_manager.predict_chunk_size(...)
if predicted_chunk is not None and predicted_chunk > 0:
    num_new_tokens = min(predicted_chunk, num_new_tokens)   # 只会切小，不会切大
```

上游算完 token 预算后再截一刀，所以 `max_num_batched_tokens` 仍是上限 [C10]。预测返回 `None`（判别式为负、根非正、模型还没拟合好）时这一步原样不动。

时间预算 `time_budget` 初值就是 `target_latency`，两个 while 循环都多要求 `time_budget > 0` [C9]。预测时传进去的 `target_time` 就是剩下的 `time_budget`，所以同一步里越靠后的请求分到的块越小。每调度一个还在 prefill 的请求就扣掉 `predict_time(...)`；已经进 decode 的（`num_computed_tokens >= num_prompt_tokens`）不扣 [C11]。

**开机测量**。`patch_profiling_chunk.py` 包住 `EngineCore.__init__`：引擎构造完、`model_executor` 就绪后立刻调 `scheduler.run_profiling_chunk_init(model_executor)` [C22]。它从 `base_chunk_size` 往下均匀采 64 个 chunk size，逐个 `collective_rpc("profile_prefill_latency", ...)`，第 0 次当 warm-up 丢掉 [C6]。worker 那边跑的是 `_dummy_run(num_tokens, force_attention=True, profile_cpp=True)` [C18]——不给 `force_attention` 就可能整段注意力被跳过，量出来的数没意义。样本少于 8 个就放弃，静默退回固定块 [C7]。拟合走 `np.linalg.lstsq`，失败再退 `np.polyfit` [C13]。PP 下所有 rank 都得跑，但只取第一级 PP rank 的计时：`_build_rpc_kwargs` 把 `unique_reply_rank` 算成 `world_size − tp_size × prefill_context_parallel_size`。

**运行时的三道门**，少看一道都会算错：

- `is_ready`：启动 profiling 成功之前一律返回 `None` [C17]；
- `num_computed_tokens < num_prompt_tokens`：只管 prefill；
- `num_computed_tokens > 0 or not need_timing`：开着在线校准时，每条请求的第一块故意不截。只有 `total_hist_tokens == 0` 的批次才拿去 `set_target_latency`，攒够 3 次才算标定完 [C21]。日志里那句 `[Dynamic Chunk] Online calibration stage. Long requests are better` 就是这个阶段打的。

校准会自己停：`fit_chunk` 攒到 `max_fit_chunk`（默认 30）个点后直接返回 `False` 并置上 `history_fitted`，从此不再重拟合 [C14]。标定和拟合都完成后，补丁把 `need_timing` 改成 `False`，并给后续每个 `SchedulerOutput` 挂上 `disable_profiling_timing` [C20]。调度器进程里改配置单例管不到 worker 进程，这条在 [NPU model runner](npu-model-runner.md) 那页记过。

### 会报什么错

| 和谁 | 结果 | 拦在哪，谁先记下的 |
|---|---|---|
| PP = 1 | 启动 `ValueError`："profiling_chunk_config requires pipeline parallelism (pp > 1)" | `AscendConfig` [C1]；[流水线并行](pipeline-parallel.md)那页提过这条硬门槛 |
| chunked prefill 没开 | 文档列为硬约束，代码里却找不到对应的 `raise` [!] | Constraints [S27]；[Chunked Prefill](chunked-prefill.md) |
| balance scheduling | 启动 `ValueError`，三版一致 | `AscendConfig` [C2]；[负载均衡调度](balance-scheduling.md) |
| DyntraLB | 启动 `ValueError`（DyntraLB 只 main 有） | `platform.py` [C36]；[DyntraLB](dyntra-lb.md) |
| 批作业感知调度 | **不报错，静默覆盖**：先把 `scheduler_cls` 指向 `ProfilingChunkScheduler` 并 import 它的 patch，紧接着批作业那段又改掉 [!] | `platform.py` [C37]；[批作业感知调度](batch-job-aware-scheduler.md)先记下的 |
| ShortRequestFirst | 按版本分叉，见版本差异 | [短请求优先](short-request-first.md) |
| 异步调度 | 不报错，但根本没有 `ProfilingChunkAsyncScheduler` 这个类 [!] | 官方只以「prefill 阶段性能劣化」为由建议 `--no-async-scheduling` [S34]，真实风险在[异步调度](async-scheduling.md)那页 |

### 开销和什么时候别开

- **启动变慢**：64 次真跑 forward 发生在开始服务之前。
- **步数变多**：128k 例子里 4 步变 16 步，调度、段间传输、算子启动这些固定开销多付 12 次 [D]。官方给的 128k 实测只降了约 17%，比上面算的 26%（`1 − 8.5/11.5`）保守——那个模型忽略了线性项和通信，偏乐观 [I]。实测数在[动态切块配置](../params/profiling-chunk-config.md)。
- **校准期间每步同步一次设备来计时**；关掉在线校准就没这笔开销，但官方说结果次优。
- **块很大的模型收益打折**：对齐粒度是 `max(page_size, 64)`，Qwen3.6 在 TP=1 时是 2048，后半程块被抬高到约 1.1T–1.4T [D]。
- **别开的场景**：PP=1（开不了）；短输入一步就能算完（没有块可切）；不是长序列 prefill 的节点（v0.26 起官方只在 PD 分离的 P 节点上验证 [S33]）；需要异步调度或负载均衡调度的部署。贯穿全库的那条请求三条全中；另外按 [那条请求](one-request.md) 的记录，Qwen3.6-35B-A3B 在官方支持矩阵里三个版本都不支持 PD 分离。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置写在哪 | 只认 `additional_config.profiling_chunk_config` | 推荐 `additional_config.scheduler_config.profiling_chunk_config`，顶层仍认但打弃用告警 | 同 v0.26 | [!] 照新文档抄的嵌套写法在 v0.23 上会被整个忽略：服务照起，开关没开 |
| 配 ShortRequestFirst | 没有 ShortRequestFirst | 同开直接 `ValueError` | 放行，`ProfilingChunkScheduler.__init__` 自己装那条短请求队列；但 `async_scheduling` 为真时 `ValueError` | [!] 两个一起用得升到 main，并且显式 `--no-async-scheduling` |
| 官方怎么定位它 | "CPP is recommended for PD ... disaggregation scenarios"，通用 PP 特性的口气，没点名 P 节点 [S28] | 改口成 "**designed to be used on the Prefiller (P) node**"，D 节点不用配 [S33] | 同 v0.26 | v0.23 上照通用 PP 场景开也说得通；v0.26 起官方只在 PD 分离的 P 节点上验证 |

### 源码位置

| 看什么 | 在哪（v0.23） |
|---|---|
| 启用校验：PP>1、与 balance scheduling 互斥 | `vllm_ascend/ascend_config.py` L69-L74、L90-L94 |
| 换掉 `scheduler_cls` | `vllm_ascend/platform.py` L720-L725 |
| 调度器副本、两处截断、时间预算 | `vllm_ascend/core/scheduler_profiling_chunk.py` |
| 求根、平滑、对齐、`min_chunk` | `vllm_ascend/core/profiling_chunk_predictor.py` L237-L271 |
| 开机测量的 RPC 入口 | `vllm_ascend/worker/worker.py` L808-L856、`vllm_ascend/worker/model_runner_v1.py` L1959-L1968 |
| 包住 `EngineCore.__init__`、在线校准 | `vllm_ascend/patch/platform/patch_profiling_chunk.py` |
| 混合模型的块大小（决定对齐粒度） | `vllm_ascend/patch/platform/patch_mamba_config.py` L89-L103 |
| 设计文档 / 用户指南 / tutorial | `docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md`、`docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md`、`docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md` |
