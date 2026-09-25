---
id: kv-cache-memory-profiling
title: KV Cache 显存怎么量出来：整卡的九成，减掉量出来的三块
type: feature
summary: >-
  启动时先拿假数据把模型按最重的情况跑一遍，量出权重、临时数据和其他杂项各占多少；整颗 NPU 显存的九成减掉这三块，剩下的就是 KV Cache
  能用的地方。录图要的显存不在这道减法里，所以「量过了」不等于「起得来」。
aliases:
  - KV Cache Memory Profiling
  - 显存探测
  - KV Cache 显存探测
  - KV Cache 显存测算
  - KV Cache 内存探测
  - KV Cache 显存预算
  - 显存预算探测
  - 显存 profiling
  - determine_available_memory
chapters:
  - '11'
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L445-L458'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L464-L480'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L548-L619'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L621-L648'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L526-L574'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L576-L597'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L504-L538'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L877-L923'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L730-L771'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4254-L4270'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3684-L3697'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4377-L4380'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L6078-L6092'
  - 'vllm-ascend@baa023ad:vllm_ascend/_310p/worker_310p.py#L113-L137'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/worker_310p.py#L103-L123'
  - 'vllm-ascend@baa023ad:tests/ut/worker/test_worker_multi_instance.py#L171-L224'
  - 'vllm-ascend@baa023ad:tests/ut/worker/test_worker_multi_instance.py#L147-L169'
  - 'vllm-ascend@baa023ad:tests/ut/worker/test_worker_v1.py#L1318-L1325'
  - 'vllm-ascend@baa023ad:docs/source/faqs.md#L139-L149'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/Dots3-Note.md#L398-L408'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L138-L138
  - >-
    https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/v1/worker/utils.py#L405-L425
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L650-L732'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L540-L546'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1107'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L605'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3714-L3730'
  - 'https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L356-L363'
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: C
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: 这一步只产出一个字节数，除以规格里每块的字节数才变成块数
  - to: one-request
    kind: builds-on
    note: 这一页算出每颗 NPU 约 21.5 GiB 的 KV 预算，那条请求只占约 80.7 MiB；除数就是从那条请求来的
contradicts: []
updated: "2026-09-25"
rawSources:
  - >-
    raw/sha256-28e0c42a4da3e1d1ae42ea272529d11b6a688cde2e0759b672471cc832358025.md
  - >-
    raw/sha256-a1026f7df3575e077953d95909c1d1d1639fcad49299256f5fcb3069614b9e26.md
---

## 一颗 NPU 到底能拿出多少显存给 KV Cache

[那条请求](one-request.md)在每颗 NPU 上占掉约 80.7 MiB。那一颗 NPU 能同时装下多少条这样的请求？

答案取决于 KV Cache（把算过的 K 和 V 存起来，下一步直接读，不重算）一共能分到多少显存。而这个数在启动那一刻谁都不知道：权重多大要看模型和[量化](quantization.md)方式，运行时的临时数据要看算子怎么实现，还有一大块驱动、通信缓冲之类的杂项，没人数得清。

所以引擎不去猜，而是**量**：先记下启动时显存的样子，再故意拿假数据按最重的情况把模型跑一遍，前后一比就知道这三块各占多少。**整颗 NPU 显存的九成，减掉这三块，剩下的就是 KV Cache 的预算。** 后面所有的分块、调度、抢占，都在这个总量里打转。

但这道减法漏了一块：**录图要的显存不在里面。** 这是这一页最值得记住的一条。

```wiki-diagram
file: kv-cache-memory-profiling
```

## 算一遍：Qwen3.6 在一颗 NPU 上

拿[那条请求](one-request.md)的部署来算：Qwen3.6-35B-A3B，两颗 NPU 分担一个模型，下面都是**一颗 NPU 上的量**。一颗按 64 GiB 算；权重按不压缩的 2 字节一个数算；临时数据和杂项这两块只能实测，这里取一组典型值。

| 这一步 | 怎么算 | 结果 |
|---|---|---|
| 先圈出九成 | 64 GiB × 0.9 | 57.60 GiB |
| 减权重 | 约 350 亿个数 × 2 字节，两颗各一半 | 约 32.60 GiB |
| 减临时数据和杂项 | 实测值，这里假设 2.30 + 1.20 | 3.50 GiB |
| 剩下给 KV | 57.60 − 32.60 − 3.50 | **21.50 GiB** |
| 换成请求数 | 21.50 GiB ÷ 每条约 80.7 MiB | 约 270 条这么长的请求 |

**那条请求只用掉这块预算的不到 0.4%。** 它自己永远碰不到上限；真正会撞上它的是同时来很多条、或者来很长的请求——这正是这个数存在的理由。

两点要注意：

- **权重是大头。** 这个模型光权重就吃掉一颗 NPU 一半的显存，KV 只分到三分之一。官方示例用的是压缩过的权重，权重那一行会小很多，KV 预算相应变大。
- **80.7 MiB 里大部分不是 KV。** 对这种「注意力 + 线性注意力」的混合模型，一条请求约 20 MiB 是注意力那 10 层的一个 KV 块，约 60.7 MiB 是线性注意力那 30 层的状态（和回答长短无关），细节见[那条请求](one-request.md)。两份都从同一块预算里出。

## 九成是整颗的九成，不是空闲的九成

那个 0.9 乘的是**整颗 NPU 的总显存**，不是启动时还空着的那部分。上游 vLLM 也是这么算的，不是昇腾改出来的。

这个选择有好处也有代价。好处是：同一颗 NPU 上起两个实例、各自只要四成，第二个实例照样按 64 × 0.4 = 25.6 GiB 立预算，不会因为第一个实例已经占走 25.6 GiB 就把自己算成负数。代价是：别人占走的显存不会自动从预算里扣，启动时只粗查一次「空闲的够不够你要的」，不够就直接报错退出。

反过来也能拿它当手柄用：把这个比例调小，NPU 上的 KV 块就少，旧块被挤出去得更勤，挪到主机内存那边的块被再用到的机会就更多——见 [KV Cache CPU Offload](kv-cache-cpu-offload.md)。

## 三块各是怎么量的

三块的来路各不相同，混着看会以为出自同一次测量：

- **权重**不是这一步现量的：装完模型那一刻就记下了，这里只是拿来用。
- **杂项**（驱动、通信缓冲之类）是拿跑之前、跑之后两次记下的显存一减，扣掉能认领的，剩下的都算它。
- **临时数据的最高点**是专门单独读的，而且特意在录图之前读——不然录图占的那份会被错算成临时数据。

「按最重的情况跑一遍」这件事，昇腾各版本还往里加过不同的料。其中一种会先把这次试跑的 token 数缩小再跑，测出的临时数据就偏小，KV 预算就偏大——具体是哪个版本、在什么配置下，见下半「版本差异」。

## 录图的显存不在这道减法里

录图（把每一步要做的计算录成一张图，之后照着重放，省掉每次现发指令的开销）发生在 KV Cache 已经按上面的预算申请完**之后**。它要的那份显存，吃的是九成之外那一成的尾巴。

**所以「量过了」不等于「起得来」。** 官方模型手册里就记着这种事故：自动量出一个很大的 KV 预算，到录图时显存冒顶，进程直接死掉。

补救办法写在日志里。录完图，引擎会把四块（权重、临时数据、杂项、录图）加起来，再留出 150 MiB 的余量，打印一个可以直接抄过去的「手动指定 KV 大小」建议值。接着上面那组数，假设录图吃了 1.80 GiB：

```text
四块合计          = 32.60 + 2.30 + 1.20 + 1.80 = 37.90 GiB
按九成算的建议值  = 57.60 − 37.90 − 0.15 ≈ 19.55 GiB
```

比刚才的 21.50 GiB 少了 1.95 GiB，正是录图那 1.80 GiB 加上余量。**这也解释了默认值为什么是 0.9 而不是 0.99**：64 × 0.1 = 6.4 GiB 的那段尾巴，就是留给录图和运行时零碎的。官方的显存不足排查指南让你把 0.9 调小，调的就是这段尾巴。

## 减完之后，还可能被改写

在较老的版本上，减完这一下就交差了。开发主线上不是：这个数还要再过四道手，每一道都可能改它：

1. **多组缩放。** 模型里有好几种不同的层（比如 Qwen3.6 的注意力层和线性注意力层）时，有的实现得给每种各留一块连续的地方，预算就得按比例缩小。Qwen3.6 正是这种混合模型；不过在默认的摆法下，开发主线能让几种层共用同一块底座，满足条件就不缩。
2. **层复用缩放。** 打开[按层卸载](kv-cache-layerwise-offload.md)且几层共用一块缓冲时，预算按比例放大。
3. **稀疏重规划。** 打开[稀疏 KV 卸载](kv-cache-sparse-offload.md)时，整个数交给另一套规划，按 NPU、主机内存、负载三个上限重排。
4. **KV 流水并行。** 打开之后，先换算成块数再乘回字节。

后三道那条请求都不触发：第二、三道要配合把问题和回答拆到不同机器上跑，第四道要开 KV 流水并行。

开发主线还多了一件事：把这次量出来的结果存下来，下次同样配置启动时直接套用，不再量一遍。

还有一种小卡（Atlas 300I Duo）整个走另一条路：算完的预算**再砍一半**，给算子的工作区和其他缓存留地方。

预算定下来之后怎么切成一块块，是 [KV Cache Spec](kv-cache-spec.md) 的事。

## 常见误解

- **「0.9 是最多用掉空闲显存的 90%」**——乘的是整颗的总显存，不是空闲的。NPU 上已经跑着别的东西时，0.9 意味着你要的是整颗的九成；只有启动那一刻会查一次「空闲的够不够」。
- **「量过了就不会爆显存」**——预算里没有录图那一块，录图在 KV Cache 申请之后才吃显存。官方模型手册里就有量过了、录图时把进程撑死的实测记录。
- **「预算算成负数会兜底成 0」**——不会，负数原样交出去，测试专门锁住了这个行为。真正的报错要等到拿这个数去切块时才出现。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

这一步不用开，每次启动都会走。和它有关的旋钮只有两个：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --gpu-memory-utilization 0.9
```

- `--gpu-memory-utilization` 默认就是 `0.9`，官方显存不足排查指南就是从这个旋钮开始调 [S19]。
- `--kv-cache-memory=<字节数>` 走快路径：`profile_run()` 照跑（为了编译），但跳过整套计算，直接用这个值，**不受 `gpu_memory_utilization` 约束**，日志会明说这一点 [C3]。
- 块大小不用设：Qwen3.6 是混合模型，块大小由 SSM 页对齐倒算，TP=2 下是 2048，推导在 [那条请求](one-request.md) 的下半。
- 入口是 `NPUWorker.determine_available_memory()`。预算的主算式 `requested_memory − non_kv_cache_memory`，其中 `requested_memory = init_snapshot.total_memory × gpu_memory_utilization` 在 `_init_device()` 里就已算好 [C1]；上游 vLLM v0.23.0 的 `request_memory()` 是同一个算式 [C22]。
- 三块的来路：
  - `weights_memory` 是 `load_model()` 结束时记下的 `model_memory_usage` [C12]，作为参数传进上游的 `memory_profiling` 上下文 [C3]；
  - `non_torch_increase` 由 `memory_profiling` 从进出两张快照的差值推出，ACL context、HCCL 缓冲、驱动层分配都落在这一项 [C3]；
  - `torch_peak_increase` 被**手动覆写**：在 `memory_profiling` 上下文**内部**、图捕获之前单独读一次 `allocated_bytes.all.peak`，再减去 profiling 前的峰值，为的是不把图池分配算进激活 [C3]。
- 多实例：两个实例各 `0.4` 共用一颗时，第二个实例照样按整卡立预算，上游为此留了回归测试 [C16]。
- CPU offload 文档把调小 `gpu_memory_utilization` 当成驱动卸载的手柄 [S21]。

### 会报什么错

- 启动时空闲显存 < `total_memory × gpu_memory_utilization`：`_init_device()` 直接抛 `ValueError: Free memory on device (...) on startup is less than desired GPU memory utilization ...`，建议调小比例或让出别的进程的显存 [C1]。
- profiling 期间同容器里别的进程释放了显存，导致跑完后空闲反而更多：断言 `Error in memory profiling. Initial free memory ... current free memory ...` 失败，提示隔离容器 [C3]。
- 预算算成负数不兜底，`int()` 后原样返回，单元测试锁住了这个行为 [C18]；真正的报错推迟到按字节数切块时。
- 图捕获冒顶：自动 profiling 分到一个很大的 KV，图捕获阶段峰值超限，worker 直接 `died unexpectedly` [S20]。原因是图池不在预算里：`capture_model()` 在 `compile_or_warm_up_model()` 里才调用，那时 KV Cache 张量已经按预算申请完毕，返回值是实测的图池字节数 [C13]；单元测试钉住了 profiling 期间不调上游的 `profile_cudagraph_memory`、也不设 `npugraph_memory_estimate` [C17]。
- 补救：图捕获完成后，worker 把四块相加、扣掉固定的 150 MiB 安全余量，打出一条可以直接抄的 `--kv-cache-memory=<字节数>` 建议 [C8]。

### 开销和什么时候别开

上半那张表的依据。卡按 64 GiB、TP=2 的一颗 NPU 算 [A]：

- 立预算：`64 × 0.9 = 57.60 GiB` [D]。
- 权重：官方配置 [S28] 给的是 bf16；约 350 亿参数 × 2 B ≈ 65.2 GiB，两颗对半取约 32.60 GiB。这是粗估：词表、各层复制与切分的部分并不严格对半 [A]。官方示例实际用 W8A8 权重，权重更小、KV 预算更大。
- 激活峰值与非 torch 两块只能实测，这里取 2.30 + 1.20 GiB [A]。
- KV 预算：`57.60 − 32.60 − 3.50 = 21.50 GiB` [D]。
- 每条请求：注意力一个块 `2048 × 10 KiB = 20 MiB` 加线性注意力状态补齐后 60.7 MiB，合计约 80.7 MiB/NPU（已核值，见那条请求）；`21.50 × 1024 ÷ 80.7 ≈ 272`，取约 270 条 [D]。那条请求占比 `80.7 ÷ 22016 ≈ 0.37%` [D]。
- 建议值：假设图池 1.80 GiB [A]，
  ```
  non_kv_memory          = 32.60 + 2.30 + 1.20 + 1.80 = 37.90 GiB
  suggested_to_requested = 57.60 − 37.90 − 0.146 ≈ 19.55 GiB
  ```
  比主公式的 21.50 少 1.95 GiB，差额正是图池加安全余量 [D]。默认值留出的 `64 × 0.1 = 6.4 GiB` 就是给图池和运行期碎片的，官方显存不足指南让调小它，调的就是这段 [D]。另一个建议值 `suggested_to_gpu_limit` 以启动时空闲显存为上限，算法同理 [C8]。
- 310P 预算整除 2，这个模型的体量在 310P 上不现实，上半不代数。

### 版本差异

「跑一遍最坏情况」被昇腾加过料，各分支加的不是同一件事 [!]：v0.26 起多了 sparse offload 的 topk 缓冲预分配 [C27][C10]；v0.23 多了 PCP 分支——`pcp_size > 1` 时把 `max_num_tokens` 缩小到 `ceil(max_num_tokens / (pcp_size × 2)) × 2` 再跑，跑完还原 [C11]，这会直接压低测出的激活峰值、放大 KV 预算。

v0.23 算完主式就 `return`。main 的返回值还要过四层，每层都可能改写它 [C4]；v0.26 只接了其中第 2、3 两层 [C26]：

1. **多组缩放** `_scale_kv_cache_memory_for_multi_group`——按「最大一组的每块字节 ÷ 所有组的每块字节之和」缩小预算。`deepseek_v4` / `deepseek_v41` 走共享布局，直接跳过；attention + Mamba 混合模型在布局 layer/block compact、runner 支持共享 backing 及 KV 传输兼容、且没有 sparse / compress 时也跳过 [C23]。main 默认 runner 的 `supports_standardized_shared_kv_backing = True`，`supports_shared_backing_with_kv_transfer` 取决于连接器 [C29]；Qwen3.6 默认布局下是否全部满足，没逐项核到。
2. **层复用缩放**——Layerwise Offload 开启且存在层复用时，预算乘上「层数 ÷ 缓冲区个数」[C4]。
3. **稀疏重规划**——Sparse KV Offload 开启时，整个数字交给 `plan_sparse_kv_offload_memory` 按 NPU、DRAM、workload 三个上限重排，返回 `final_planner_bytes` [C7]。
4. **KV 流水并行预算**——`_apply_kvpp_memory_budget` 把字节数换算成块数再乘回每块字节；只有 `kvpp_config.size > 1` 时才建这个计划，否则原样透传 [C24][C25]。

main 还在 profiling 的第一行插了 `maybe_apply_startup_plan(self)`，并在建议值为正时调 `maybe_save_startup_plan()`——上游新加的机制，把这次量出来的结果存下来，下次同样配置的启动直接套用 [I]。这两个名字在 v0.26 的 `vllm_ascend` 里 grep 不到。

310P 整个方法被覆盖，预算**再整除 2**，注释说明是给算子 workspace 和其它缓存留地方；RC 形态下还改用 `psutil.virtual_memory()` 统计，因为主机内存与设备内存共享 [C14]。三版的折半逻辑逐字相同，main 只是在它后面接了第 1 条的多组缩放 [C15]。

下表对照 **v0.23 维护分支**（2026-09-10 的源码快照 `2c59ff10`）、**v0.26 分支**（2026-09-17 的 `2ed6cbba`）与 **main 开发主线**（2026-09-21 的源码快照 `baa023ad`）。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 主公式之后 | 直接 `return` | 层复用 → 稀疏，两道 [C26] | 多组缩放 → 层复用 → 稀疏 → kvpp，四道 | 这些特性开了，返回值就不等于主公式 [!] |
| `--kv-cache-memory` 快路径 | 跳过全部计算，原样返回该值 | 也跳过，但仍过稀疏一道 | 也跳过，但仍过稀疏与 kvpp 两道 | 三版都不受 `gpu_memory_utilization` 约束 [!] |
| `profile_run()` 的加料 | EPLB 预热 + MC2 dummy run + PCP token 切分 | 同 main | EPLB 预热 + MC2 dummy run + sparse topk 缓冲 | v0.23 开 PCP 会压低激活峰值、放大预算 [!] |
| 跨次启动 | 每次启动都重量一遍 | 同 v0.23 | profiling 前 apply、给出建议值后 save | main 上第二次启动可能根本没量 [!] |
| 310P | 主公式结果 `// 2` | 同 v0.23 | 同式，后接多组缩放 | 同样的卡同样的配置，310P 只拿到一半 |

三版一致的有三条：分母都是整卡 `total_memory`、`non_kv_cache_memory` 都只有三项（图池不在内）、建议值的安全余量都是 `150 MiB`。

### 源码位置

| 看什么 | 文件（main） |
|---|---|
| 快照与 `requested_memory` | `vllm_ascend/worker/worker.py`，`_init_device()` [C1]；v0.23 [C2] |
| 主算式与快路径 | `vllm_ascend/worker/worker.py`，`determine_available_memory()` [C3][C4]；v0.23 [C5][C6]；v0.26 [C26] |
| 多组缩放 | `vllm_ascend/worker/worker.py`，`_scale_kv_cache_memory_for_multi_group()` [C23] |
| 稀疏与 kvpp 两道 | `vllm_ascend/worker/worker.py`，`_apply_kv_offload_decode_memory_constraints()` [C7]、`_apply_kvpp_memory_budget()` [C24] |
| 建议值日志 | `vllm_ascend/worker/worker.py`，`compile_or_warm_up_model()` [C8]；v0.23 [C9] |
| 最坏情况试跑 | `vllm_ascend/worker/model_runner_v1.py`，`profile_run()` [C10]；v0.23 [C11]；v0.26 [C27] |
| 权重字节数从哪来 | `vllm_ascend/worker/model_runner_v1.py`，`load_model()` 末尾 [C12] |
| 图捕获 | `vllm_ascend/worker/model_runner_v1.py`，`capture_model()` [C13] |
| 310P | `vllm_ascend/_310p/worker_310p.py` [C14]；v0.23 [C15] |
| 上游算式 | `vllm/v1/worker/utils.py`，`request_memory()` [C22] |

## 已废弃的说法

### 2026-09-16 · 修订 ce37962dd2e9737a

旧说法（历史记录，已废弃）：

```text
昇腾侧和上游的关键分歧在**分母**。
```

替代结论：

```text
这里的预算按**整卡显存**计算，上游 vLLM v0.23.0 也是这样算的 [C22]。
```

废弃依据（来源是否支持结论仍须人审）：

- `https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/v1/worker/utils.py#L405-L425`

- `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L441-L454`

旧文的来源编号（仅解释上方历史原文）：

1. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L441-L454`
2. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L464-L480`
3. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L536-L584`
4. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L586-L630`
5. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L526-L574`
6. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L576-L597`
7. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L500-L534`
8. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L778-L821`
9. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L730-L771`
10. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3713-L3727`
11. `vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3684-L3697`
12. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3834-L3837`
13. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5175-L5185`
14. `vllm-ascend@28bf3a2e:vllm_ascend/_310p/worker_310p.py#L113-L133`
15. `vllm-ascend@2c59ff10:vllm_ascend/_310p/worker_310p.py#L103-L123`
16. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_multi_instance.py#L172-L223`
17. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_multi_instance.py#L146-L168`
18. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_v1.py#L1109-L1116`
19. `vllm-ascend@28bf3a2e:docs/source/faqs.md#L138-L148`
20. `vllm-ascend@28bf3a2e:docs/source/tutorials/models/Dots3-Note.md#L398-L408`
21. `vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L109-L110`
