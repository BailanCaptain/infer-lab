---
id: request-call-chain
title: 一条请求的代码路径：七站各在哪个进程、经过哪些函数
type: concept
summary: 沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的 worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于 vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。
aliases: [调用链, call chain, 请求路径, 请求调用链, 一次请求的调用链, 请求调用链：从调度计划到模型输出, execute_model 链路,
  代码路径, 按 traceback 认站, 请求停在哪一站]
chapters: ["09"]
order: 10
sources:
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L219-L356
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1426
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L515-L559
  - vllm@0fc695fc:vllm/v1/engine/utils.py#L1000-L1045
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1118-L1164
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1273
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598
  - vllm@0fc695fc:vllm/config/vllm.py#L497-L507
  - vllm@0fc695fc:vllm/config/vllm.py#L957-L1002
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L967
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L400
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L969-L1031
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L666
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1917-L2370
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2582
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2803-L2839
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L259
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2123
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L135-L184
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L169-L260
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L420-L557
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1650
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L660
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L21-L41
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L660
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L823
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L10-L24
  - vllm@0fc695fc:vllm/utils/system_utils.py#L201-L253
  - vllm@0fc695fc:vllm/v1/engine/core.py#L386-L400
  - vllm@0fc695fc:vllm/logging_utils/dump_input.py#L56-L81
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1193-L1198
  - vllm@0fc695fc:vllm/v1/engine/exceptions.py#L9-L18
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L270-L290
  - vllm@0fc695fc:vllm/envs.py#L1647-L1648
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L636-L648
  - vllm-ascend@baa023ad:vllm_ascend/models/__init__.py#L82-L91
  - vllm@0fc695fc:vllm/config/scheduler.py#L168-L173
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L643-L692
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L7-L60
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L461-L531
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L12-L67
  - vllm@0fc695fc:vllm/v1/engine/core.py#L106-L136
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L227-L236
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L82
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L527
verified: []
evidence: "C"
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南给出五页主线的顺序，本页把七站对回代码
  - to: one-request
    kind: builds-on
    note: 七站的站名和编号沿用那一页；每一站上的形状、字节、通信次数和块数都在那一页，本页只讲代码走哪条路
  - to: engine-processes
    kind: builds-on
    note: 进程是怎样被拉起来的、每种进程里还有哪些对象，在那一页展开；本页只用到「谁在哪个进程里」
  - to: npu-model-runner
    kind: builds-on
    note: 第 3 到第 5 站的大部分函数都在 model_runner_v1.py 这一个文件里，那一页讲这个文件怎么分区
  - to: async-scheduling
    kind: builds-on
    note: 官方部署默认开着异步调度，EngineCore 因此走带批次队列的那条循环；占位 token 的记账规则在那一页
  - to: reading-vllm-ascend
    kind: builds-on
    note: 本页给出一条请求沿途的入口函数，那一页讲整个仓库的目录怎么分工
contradicts: []
updated: "2026-09-27"
origin: seed
---

[调用链](#七站分在三种进程里)是一串函数的调用关系：A 调 B，B 再调 C。本页沿[一条请求](one-request.md)的七站，跟着提示词为 4 token 的示例请求 R1，看代码在哪个进程里跑、跨进程怎样交接，以及报错时该打开哪个文件；形状、通信字节与 [KV block](kv-cache.md)（保存历史的显存块）用量见前页。

Python 报错时打印的 traceback 列出出错那一刻的调用链；跨进程交接则需要把几份日志连起来读。

## 七站分在三种进程里

**进程**是操作系统里一份独立运行的程序，有自己的一块内存。两个进程不能直接读对方的变量，要交换数据就必须经过某种通道，比如网络连接或者一块专门划出来的共享内存。所以「一站做完交给下一站」有两种情况：同一个进程里是一次普通的函数调用，跨进程就要把数据编码、送过通道、在对面解码。

本页沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)，启动后的 20 个进程中，一条请求会经过以下三种：

- **API server**：node0 上唯一接收 HTTP 请求的前端进程。第 1 站和第 7 站在这里。
- **EngineCore**：每个 DP 执行组一个引擎进程，分别记作 `EngineCore_DP0`、`EngineCore_DP1`，日志也用这两个前缀。内部的 EngineCore 对象持有 **scheduler**：每步决定算哪些请求、各算几个 token、分哪些 KV 块。第 2 站和第 6 站在这里。
- **worker**：每张卡一个，共 16 个，负责把调度结果变成 NPU（昇腾的 AI 计算芯片）上的计算。每个 EngineCore 管本机 8 个 worker，第 3、4、5 站在这里；[TP](tensor-parallel.md) 与 [EP](expert-parallel.md) 分组见部署页。

第四种是 node0 上的 **DP 协调器**，它不经手请求本身，只汇总两个 DP 组各有多少请求，并在两组之间传递「开始干活」「可以停了」的信号。

| 站 | 在哪个进程 | 从哪个函数进 | 代码属于 |
|---|---|---|---|
| 1 入口 | API server | `OpenAIServingChat.create_chat_completion` | vLLM |
| 2 调度 | EngineCore_DP0 | `Scheduler.schedule` | vLLM，五处被 vllm-ascend 换过 |
| 3 准备输入 | node0 的 8 个 worker | `NPUWorker.execute_model` | vllm-ascend |
| 4 逐层前向 | node0 的 8 个 worker | `NPUModelRunner._model_forward` | vllm-ascend |
| 5 采样与草拟 | node0 的 8 个 worker | `NPUModelRunner.sample_tokens` | vllm-ascend |
| 6 结果更新 | EngineCore_DP0 | `Scheduler.update_from_output` | vLLM |
| 7 返回与收尾 | API server | `OutputProcessor.process_outputs` | vLLM |

```wiki-diagram
file: request-call-chain
```

R1 被分到了 DP0，所以它的第 2 到第 6 站都在 node0 上。node1 的 EngineCore_DP1 和 8 个 worker 不经手 R1，但它们每一步都要跟着跑：MoE 层的专家分散在 16 张卡上，node0 的卡算 MoE 时要和 node1 的卡交换 token，node1 没有请求也得陪着执行一次空批次。这条陪跑走的是哪几个函数，放在「同一条请求，第 1 步和第 2 步走的分支不同」一节里讲。

## 进程之间的四条通道

图上的连线分四种。前两种按先后顺序把请求和结果从一个进程送到下一个进程；后两种是几个进程同时参与的集合通信，按固定的节奏发生，R1 的每一步都会用到其中一部分。

**ZMQ：API server 和每个 EngineCore 之间。** ZMQ 是一个在进程之间收发消息的库，同一台机器上和跨机器都能用。API server 开两个口子，一个专门往外发请求，一个专门收结果，两个 EngineCore 都连进来。两组引擎分在两台机器上，所以地址是 node0 上的 TCP 端口，而不是本机的临时文件。消息用 msgpack（一种紧凑的二进制编码格式）打包。EngineCore 进程里另有两个后台**线程**（同一个进程里同时执行的几条执行流，共享这个进程的内存）专管收发：收线程把解码后的请求放进一个进程内队列，发线程从另一个队列取出结果发回去；主线程只跑一个不停转圈的**忙循环**：取新请求，跑一步，放结果。

**共享内存队列：EngineCore 和本机 8 个 worker 之间。** 共享内存是同一台机器上几个进程都能读写的一块内存，传数据不经过网络。EngineCore 进程里有一个 `MultiprocExecutor` 对象，负责管理本机的 8 个 worker。它把「要执行的函数名和参数」写进一个广播队列一次，8 个 worker 各自读到同一条消息。回程每个 worker 各有一条自己的响应队列，但 `MultiprocExecutor` 只读第 0 号 worker（TP 组里编号为 0 的那张卡）的那一条。

**HCCL：worker 和 worker 之间，搬张量。** HCCL（昇腾集合通信库）负责卡与卡之间的数据交换。机内 8 张卡在每层的张量并行里合并结果，16 张卡在 MoE 层里互相派发 token。这些通信各发生几次、每次多少字节，见[一条请求](one-request.md)第 4 站的「一次前向的通信账」。

**gloo：进程之间对几个小数字。** gloo 是 PyTorch 自带的一种集合通信后端，用 CPU 和普通网络收发，适合传很小的数据。它用在两处：两个 EngineCore 每 32 步交换一次「我这边还有没有请求」，两边都没有了才一起停下；两台机器上对应的 worker 每一步开算之前对齐一次「这一步算多宽、用不用图」。后者在 vllm-ascend 的配置项 `dp_allreduce_on_npu` 打开时改走 HCCL，默认不开。

所以 R1 的一个新 token 走的是：ZMQ（API server → EngineCore_DP0）→ 共享内存（EngineCore_DP0 → 8 个 worker）→ worker 里的函数调用，途中穿插卡间的 gloo 对齐和 HCCL 通信 → 共享内存（第 0 号 worker → EngineCore_DP0）→ ZMQ（EngineCore_DP0 → API server）。

## 一步之内：EngineCore 给 worker 发两次调用

让另一个进程执行某个函数、再把返回值送回来，叫**远程过程调用**（RPC）。生成循环每转一圈（一步），EngineCore 都要对本机 8 个 worker 发两次 RPC：

1. `execute_model`：把调度结果 `SchedulerOutput`（调度器这一步交出的清单：哪些请求、各算几个 token、新分到哪些块）送过去，worker 做第 3 站和第 4 站，一直算到需要出 token 的那几行的词表分数（logits）。logits 先存在 worker 进程里的一个 `ExecuteModelState` 对象里，这次调用返回空值。
2. `sample_tokens`：worker 取出 logits，做第 5 站：采样选出新 token，再让 MTP（多 token 预测）草稿层猜后面的候选。这次调用返回 `ModelRunnerOutput`，里面是每个请求这一步新得到的 token 编号。

拆成两次以后，EngineCore 可以趁 worker 做前向的时候算一张结构化输出要用的表（结构化输出限定模型只能生成合法 JSON 这类格式，这张表写明下一个 token 允许是哪些），随第二次调用一起送过去，见[结构化输出](structured-output.md)。

```wiki-diagram
file: request-call-chain-step
```

**异步调度让两步叠在一起。** 本部署未显式设置异步调度开关，所用的 MTP 投机解码方法与执行器都支持异步调度，因此按自动判定打开：上一步的结果还没回来，就先把下一步排好发出去，见[异步调度](async-scheduling.md)。EngineCore 的忙循环因此走带批次队列的分支：

图中 future 是「结果以后才会到」的占位对象。普通文本请求发出两次 RPC 后将 future 入队；队列未满且仍能推进时，沿左侧回环优先安排下一批。队列已满或没有后续请求可调度时，沿向下分支等待最老一批，再做第 6 站。结构化输出依赖前批 token 时，第二次 RPC 会延后到前批更新之后。

所以 worker 可能正在算第 N 步，EngineCore 已经把第 N+1 步排好发出去了。读 traceback 时，第 6 站正在处理的清单属于上一步，不能与刚发出的清单混为一谈。实际是否启用，以启动日志为准，日志格式见页末。

异步调度还换用 AsyncScheduler，主要增加候选占位和结果更新的记账。因此第 2、6 站的 traceback 可能同时经过普通调度器与异步调度器；具体方法和继承关系的待核项见页末[源码位置](#源码位置)。

## vllm-ascend 从六个口子接进 vLLM

vLLM 是主程序，vllm-ascend 是装在它上面的插件，不单独起自己的进程。它的代码之所以出现在请求路径上，是因为 vLLM 在六个地方留了口子，或者被它从外面改了：

1. **平台插件回答硬件问题。** vLLM 启动时发现插件，拿到 NPUPlatform，此后用它决定昇腾上怎么执行，见[平台注册](platform-plugin-registration.md)。
2. **worker 类接管执行。** 平台选择 NPUWorker，它创建 NPUModelRunner；后者继承上游 GPUModelRunner，重写请求路径上的主要方法。
3. **注意力后端选择实现。** 走通用路径的模型建层时按 attention 类型向平台查询，平台用一张按注意力类型查后端的表回答；GLM 的稀疏 MLA（压短每条历史、只挑部分读取）不查这张表，由层自己返回 AscendIndexerKPoolMLABackend，只有它的实现类继承自 SFA 的实现类（SFA 即昇腾这边稀疏注意力的那套实现，`sfa_v1.py` 里的类名、方法名和设备算子名都写作 sparse flash attention），见[后端家族](attention-backend-family.md)与[稀疏注意力](sparse-attention.md)。
4. **custom op 替换整层。** 标为 custom op 的层允许硬件插件换实现；worker 初始化时把 MoE 与 KDA 换成昇腾版本。KDA 用固定大小状态保存历史，见[线性注意力](linear-attention.md)。
5. **patch 改变已有入口的指向。** 每个进程加载 general plugin（通用插件）时，把部分上游函数或类换成昇腾实现；EngineCore 也会加载，所以第 2 站也受影响，见[Patch 机制](ascend-patch-system.md)。
6. **模型注册选择 GLM 实现。** 将权重配置里的架构名映射到昇腾的模型类。具体注册名、路径和版本条件集中在页末。

所以「这一站属于哪个仓库」不能只看站号：第 2 站的主体是 vLLM 的调度器，却跑着 vllm-ascend 打进去的补丁；第 4 站的 GLM 模型文件在 vllm-ascend 里，它的层又继承 vLLM 的基类。按报错定位时，看的是出错那一帧的文件路径。

## 七站逐站：从哪个函数进，往下调谁

图把七站的主要调用串起来：竖向箭头表示先后顺序，横向箭头表示跨进程交接。各站的细分方法保留在页末「源码位置」表；形状、数字和字节数见[一条请求](one-request.md)。

```wiki-diagram
file: request-call-chain-functions
```

**① 入口为⑦返回留下接收点。** AsyncLLM 把输入包成引擎请求，并登记**反分词器**（detokenizer，把 token 编号还原成文字的组件）和输出队列；后续结果按请求 ID 回到这里。选 DP 组的规则见[数据并行](data-parallel.md)。

**②的入口是等待队列，出口是本步清单。** [EngineCore](vllm-engine-core.md) 从输入队列取出请求，预处理后交给 scheduler 等候；下一圈调度决定本步工作并申请块号。running、waiting 与抢占的判断见[多条请求的调度图](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。

这里的 patch 涉及缓存分组、分配协调、KDA 状态管理，也涉及可选的负载平衡调度。本部署的 `mamba_cache_mode=none`，因此只在 align 模式调用的 `_mamba_block_aligned_split` 不执行；BalanceScheduler 的负载平衡开关也关着，直接转给原来的实现，五处补丁并非都在当前调用路径上生效。读 traceback 时，沿补丁函数继续向下找到实际执行的方法，就能判断卡在「排本步工作」还是「分配缓存」；五处替换清单与继承关系的验证方法见页末[源码位置](#源码位置)。

**③ 是清单变成张量的边界。** 调度清单经广播队列交给每张卡的 [worker](npu-worker-lifecycle.md)；[model runner](npu-model-runner.md) 先同步**持久批次**（input_batch，跨步保存请求、块号和进度的表），本步有 token 才准备输入和 attention 元数据。位置与槽位的逐行算法见[准备输入](prepare-inputs-flow.md)，图模式的判断见下一张分支图。

**④ 把结果暂存在 worker，⑤再消费它。** 前向上下文保存本步宽度和 MoE 通信方式，供模型各层读取。主干的 attention 按层型进入 KDA 或稀疏 MLA，随后前馈进入稠密 MLP 或 MoE；MoE 经 prepare / finalize 派发和收回 token。前向结束后，词表分数留在 ExecuteModelState，等第二次 RPC 取用；MoE 的版本文件差异见页末。

**⑤交回确定的 token，并为下一步留下候选。** 采样器执行普通采样或验证候选，整理实际产出后，草稿器再生成下一步候选。GLM 草拟固定走 eager，具体迭代见[一条请求](one-request.md)第 5 站。ModelRunnerOutput 经第 0 号 worker 的响应队列交回 EngineCore；异步调度还要等待 NPU 结果拷回 CPU。

**⑥的向上箭头延续生成，向下箭头持续返回。** 结果更新按拒绝数修正进度，再追加 token、检查停止条件。结束时归还块号，完成的请求 ID 随下一份清单通知 worker 清理。每步结果都经 ZMQ 发回前端。

**⑦沿请求 ID 找回①留下的队列。** 后台输出任务反分词并检查停止字符串；HTTP 侧从收集器取出文字，以 SSE（HTTP 上分段推送的格式）返回。两处停止判断怎样衔接，见[一条请求的返回与收尾](one-request.md#第-7-站-返回与收尾)。

## 同一条请求，第 1 步和第 2 步走的分支不同

上面是每一步都要走的主干。R1 的第 1 步（prefill，把提示词一次算完）和第 2 步（decode，在已有历史上继续往后生成，这是第一个 decode 步）走的是同一串函数，但在几个岔口上拐向不同的分支。要看的数字都在[一条请求](one-request.md)的第 2 到第 6 站和「第二圈」一节，这里只标岔口：

```wiki-diagram
file: request-call-chain-branches
```

沿左右两列看，三个判断各管一件事：队列决定从哪里调度，输入进度与形状决定主模型能否回放图，候选元数据决定用哪个采样器。`AscendRejectionSampler` 逐位接受或修正候选；两列汇合后都继续草拟。图模式完整条件和两组宽度的计算统一见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

第 2 步的 3 个候选从哪来？异步调度开着时，候选 token 留在 worker 进程里，下一步直接取用，不经 EngineCore 转手；只有异步调度关掉时，EngineCore 才在每步末尾把它们取回来交给调度器。

**node1 每一步在做什么。** R1 在 DP0 上，node1 的调度器一直是空的。`DPEngineCoreProc.run_busy_loop` 发现这一圈没有可跑的请求，但另一组还在忙，就改走 `execute_dummy_batch` → `MultiprocExecutor.execute_dummy_batch` → `NPUWorker.execute_dummy_batch` → `NPUModelRunner._dummy_run`，也就是执行一次空批次。空批次同样经过 `_sync_metadata_across_dp`，宽度和图模式跟 node0 对齐，然后完整跑一遍 45 层，连草稿层也陪跑一次，这样 node0 的 MoE 通信才凑得齐 16 张卡。所以排查时在 node1 worker 的报错栈或性能剖析里看到 `_dummy_run`，那是正常的陪跑，node1 并没有收到请求。

## 出问题时，判断它停在哪一站

服务出问题时，先定位「停在哪个进程」，再定位「停在哪一站」。手上一般有两样东西：日志，和报错时打印的调用链。

```wiki-diagram
file: request-call-chain-log-route
```

图的上半部先沿异常回传方向找到原始日志，下半部再认进程和站点。日志前缀格式是 `(名字 pid=进程号)`；worker 名字依次带 DP、TP、EP 编号，例如 node1 本机编号 3 的卡是 `Worker_DP1_TP3_EP11`。进程把范围缩到几站，最内层 traceback 再把范围缩到具体函数。

**第二步看报错链。** Python 打印的调用链是从外往里排的，最下面一行是最里层，也就是真正出错的地方。按最里层那一帧的文件路径判断：

| 最里层在哪 | 是哪一站 | 先看什么 |
|---|---|---|
| `vllm/entrypoints/` | 1 或 7 | 请求参数、聊天模板、分词 |
| `vllm/v1/core/sched/scheduler.py` 的 `schedule`、`vllm/v1/core/kv_cache_manager.py`、`block_pool.py`、`async_scheduler.py` 的 `_update_after_schedule`，或 `vllm_ascend/patch/platform/` 下的文件 | 2 | 预算、块够不够；patch 目录下的帧仍是第 2 站，只是那一段被换过 |
| `scheduler.py` 的 `update_from_output`，或 `async_scheduler.py` 的 `_update_request_with_output` | 6 | 追加、回退、停止条件 |
| `vllm_ascend/worker/model_runner_v1.py` 的 `_update_states`、`_prepare_inputs` | 3 | 请求和批次的对应关系、块号、位置越界 |
| `vllm_ascend/attention/`、`vllm_ascend/ops/`、`torch_npu` 或 aclnn 的调用 | 4 | 形状、数据类型、算子支持范围 |
| `vllm_ascend/sample/`、`vllm_ascend/spec_decode/` | 5 | 采样参数、候选的接受与回退 |
| `vllm/v1/engine/output_processor.py`、`detokenizer.py` | 7 | 停止条件、特殊 token |

反过来不成立：栈里出现 `vllm/` 的文件不代表问题在上游，因为 vllm-ascend 的类继承上游的类，也可能把上游的函数换掉了。

**用原始日志补齐图上的线索。** worker 异常要看它自己的日志；EngineCore 异常前会 dump 本步输入与调度清单；进程直接退出则查看监视线程日志及退出原因。可搜索的完整报错串见页末[会报什么错](#会报什么错)。

**卡住不动怎么判断。** 两次 RPC 默认各等 300 秒；超时表示 worker 没及时回话，可能是前向很慢，也可能是在集合通信里等别的卡。通信要组内成员到齐才结束：机内是 8 张，MoE 是全部 16 张。一张卡故障会让其余卡一起等，因此要将 16 个 worker 的日志按时间对齐，并核对两机时钟；超时设置与报错格式见页末。

**图模式下怎样定位算子。** 先看 plog（CANN 的运行日志）；若要用同步调试，让每个算子提交后立刻等待完成，就须先关闭 ACL Graph，此时第 4 站改走 eager。开关和日志目录见页末。

## 常见误解

- **「一次 HTTP 请求对应一次模型执行」**——一条请求要走几十上百步，每步都是一次完整的执行；反过来，一步里的一次执行同时服务着这一步排进来的所有请求。
- **「worker 那一站在跑模型」**——`NPUWorker.execute_model` 本身只做几件杂事就转交给 `NPUModelRunner`。这套部署没开流水线并行，它连卡间收发中间结果都不用做。
- **「第 3 站开始就全是 vllm-ascend 的代码」**——`NPUModelRunner` 继承 vLLM 的 `GPUModelRunner`，没被重写的方法仍然执行上游的代码；反过来第 2 站虽然是上游的调度器，跑的却是被 patch 换过的类。
- **「前端报出来的那一句就是根因」**——跨进程的错会被重新抛出一次，前端和 EngineCore 看到的往往是转达，根因在更靠里那个进程的日志里。
- **「node1 没接到请求就是空闲的」**——它每一步都在陪跑一次完整的前向，MoE 的通信要 16 张卡凑齐。

## 对照源码

### 怎么开

部署参数统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。启动命令未显式传 `--async-scheduling`；vLLM 在 MTP 方法与执行器都支持时自动启用，运行状态用 `Asynchronous scheduling is enabled.` / `... disabled.` 日志确认。两次 RPC 与批次队列的代码入口见下文。

### 会报什么错

- worker 的 `WorkerProc hit an exception.` 是原始异常；EngineCore 会转报 `Worker failed with error '...'`。进程死亡则是 `Worker proc ... died unexpectedly, shutting down executor.` [C40]。
- EngineCore 先以 `Dumping input data for V1 LLM engine` 开头 dump 本步清单（`vllm@0fc695fc:vllm/logging_utils/dump_input.py#L56-L81`），再报 `EngineCore encountered a fatal error.`；前端的 `EngineDeadError` 用于指路。
- RPC 默认等 300 秒，由 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` 设置；超时报 `RPC call to {method} timed out.`，例如 `RPC call to execute_model timed out.` [C12]。
- `ASCEND_LAUNCH_BLOCKING=1` 让每个算子提交后同步等待，与 ACL Graph 互斥；同时打开会在启动时报错并提示看 plog [C42]。plog 默认目录是 `$HOME/ascend/log/debug`；使用同步调试前关闭图模式，第 4 站改走 eager。

待核：非 0 号 worker 抛异常时，EngineCore 收到超时还是转达的异常，尚缺本基线的实证。

### 开销和什么时候别开

异步调度用最多两批的队列重叠调度和执行，EngineCore 最多领先 worker 一步；排错时需将清单与对应批次配对。通信还要求所有成员到齐，一张卡卡住可能让同组其余卡一起超时，报错卡不一定是根因 [D]。同步调试用于定位算子，但关闭图模式后不再代表原来的图回放性能。

### 版本差异

本页的控制流依据 `vllm@0fc695fc`（对应 vLLM v0.23.0），执行侧依据 `vllm-ascend@db701c1f`。和 vllm-ascend 的 main 分支（`baa023ad`）相比，请求路径上有两处改名。七站的划分和每一站的职责不变，变的是「按文件名和类名认站」这件事：

| 项 | `db701c1f`（本页） | main（`baa023ad`） | 意味着什么 |
|---|---|---|---|
| GLM 实现放在哪 | 单文件 `vllm_ascend/models/glm5_next.py`，类名带 `Ascend` 前缀 [C34] | 目录 `vllm_ascend/models/glm5next/`，拆成 `model.py`、`kda.py`、`attention.py`、`mtp.py` 等，类名去掉前缀 [C43] | [!] 第 4 站报错栈里的文件名和类名两边都不一样，按本页的名字去 main 上搜会搜不到 |
| MoE 走哪个文件 | vLLM 是 0.23.0 时用 `ops/fused_moe/fused_moe_0_23_0.py` [C23] | 同一目录下另一套实现（`fused_moe.py` 里 `vllm_version_is("0.23.0")` 不成立的那一支） | [!] 同一个类名 `AscendFusedMoE` 在两边指向不同的文件，贴行号前先确认读的是哪一支 |

两个发布分支 `releases/v0.23.0` 与 `releases/v0.26.0rc` 上这条链路的差异本轮没有核，所以 `verified` 留空。

### 源码位置

**读源码的顺序。** 先确认版本，GLM 的文件名和类名变化见上表；模型文件可能仍写上游类名，运行时对象已被替换，搜索时要追到注册入口。

1. `vllm/v1/engine/core.py`：`EngineCoreProc.run_busy_loop` 和 `EngineCore.step_with_batch_queue`，看一步的骨架。
2. `vllm/v1/core/sched/scheduler.py`：`Scheduler.schedule` 和 `update_from_output`，看第 2、6 站。
3. `vllm/v1/executor/multiproc_executor.py`：`MultiprocExecutor.collective_rpc` 和 `WorkerProc.worker_busy_loop`，看跨进程交接。
4. `vllm_ascend/worker/model_runner_v1.py`：`NPUModelRunner.execute_model` 和 `sample_tokens`，看第 3–5 站，其余方法按调用跳转。
5. `vllm_ascend/models/glm5_next.py`：`AscendGlm5NextDecoderLayer`，看一层怎样分派到 KDA、稀疏 MLA、MoE。

七站的编号沿用[一条请求](one-request.md)，是教学上的分段，源码里没有叫这个名字的东西 [A]。

**一步的骨架**

- 引擎忙循环：`EngineCoreProc.run_busy_loop` → `_process_input_queue` → `_process_engine_step` → `self.step_fn()`。
- `step_fn` 指向 `step` 还是 `step_with_batch_queue`，由批次队列的长度决定：异步调度打开、用 v1 runner、没开流水线并行时 `max_concurrent_batches` 是 2（`vllm@0fc695fc:vllm/config/vllm.py#L497-L507`），于是走后者 [C8]。官方启动命令里没写 `--async-scheduling`，按自动判定它是开着的 [I]，启动日志的 `Asynchronous scheduling is %s.` 那一行可以确认 [C10]。
- 调度器类：异步调度打开时 `get_scheduler_cls` 返回 `AsyncScheduler` [C44]，它除了构造函数 `__init__`（调完父类后只建 `_spec_token_placeholders`、记下 `pp_size`）之外，只重写 `_update_after_schedule` 和 `_update_request_with_output` 两个方法 [C49]。EngineCore 初始化时先 `load_general_plugins()`、再取调度器类（`vllm@0fc695fc:vllm/v1/engine/core.py#L106-L136`），`async_scheduler.py` 在这之后才第一次被导入，所以它的父类应当是已被换名的 `BalanceScheduler` [I]；要实证，可在启动后打印调度器对象的 `__mro__`。
- `step_with_batch_queue` 的普通文本路径见两次 RPC 图；队列已满或没有后续请求可调度时，取最老一批 `future.result()`，再 `update_from_output`。需要前批 token 的结构化输出会延后采样。队列最多装两批，所以 EngineCore 最多领先 worker 一步 [D]。

**进程边界**

| 边界 | 通道与代码 |
|---|---|
| API server ↔ EngineCore | `MPClient` 建一个 ROUTER 口发、一个 PULL 口收；本部署两组引擎跨机器，地址取 node0 的 TCP 端口而不是本机 IPC 路径 [C5] |
| EngineCore → 8 个 worker | `collective_rpc` 把 `(方法名, args, kwargs, output_rank)` 写进 `rpc_broadcast_mq`，`non_block=True` 时返回 future |
| worker → EngineCore | `worker_busy_loop` 取出消息、`getattr(self.worker, method)` 调用，再把结果写回自己的响应队列；执行器只读 `output_rank` 那一路，它等于 `world_size − tp × pcp`（pcp 是 prefill 上下文并行的组大小，本部署为 1），算出来是 0 [C14] |
| 每一步的 DP 对齐 | `_sync_metadata_across_dp` 把 `[num_tokens, cudagraph_mode]` 拼成 `2 × dp_size` 的 int32 张量做一次 All-Reduce，默认走 DP 组的 CPU（gloo）组，`dp_allreduce_on_npu` 打开才走 NPU 组 [C28] |
| 两个 EngineCore 之间 | `DPEngineCoreProc.run_busy_loop` 里没活可跑就 `execute_dummy_batch`，每 32 步用 `_has_global_unfinished_reqs` 做一次 All-Reduce [C27] |

`MultiprocExecutor` 在一种情况下会被换成 `AscendMultiprocExecutor`：设了环境变量 `DYNAMIC_EPLB` 或 `EXPERT_MAP_RECORD` 时才导入那个 patch（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L47-L48`），它只重写 `_init_executor`。官方双机部署没设这两个变量，所以本页写的类名在官方配置下成立；开了 EPLB 的部署会在栈里看到另一个类名。

**第 2 站的五处 patch**

| 被换的东西 | 换成什么、什么时候生效 |
|---|---|
| `get_kv_cache_groups` | 按 GLM 的布局把各层分成缓存组，见 `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548` |
| `get_kv_cache_coordinator` | 换成 vllm-ascend 的工厂函数，某些缓存布局下返回 `AscendHybridKVCacheCoordinator`，其余情况回落到原函数 [C48]；GLM 落在哪一支待核 |
| `MambaManager` | 换成 `AscendMambaManager`，改的是前缀命中与外部 KV 的分支（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84`） |
| `Scheduler._mamba_block_aligned_split` | 换成对 GLM 按状态存档点对齐切 token 的版本 [C46]；`schedule` 只在 `mamba_cache_mode == "align"` 时调用它（`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263`），官方部署为 `none`，R1 的路径上不执行 |
| `Scheduler` 这个名字与 `EngineCoreProc.run_engine_core` | 指向 `BalanceScheduler` 与补丁版启动函数；`enable_balance_scheduling` 关着时两者都直接转给原来的实现 [C33]，见 [Balance Scheduling](balance-scheduling.md) |

**七站的函数**

| 站 | 入口 | 往下调 |
|---|---|---|
| 1 | `OpenAIServingChat.create_chat_completion` | `render_chat_request` → `AsyncLLM.add_request`（`process_inputs`，构造 `EngineCoreRequest`）→ `_add_request`（`output_processor.add_request`、`add_request_async`）；选 DP 组见[数据并行](data-parallel.md) |
| 2 | EngineCore 收件经 `preprocess_add_request` 构造 `Request` → `Scheduler.add_request` 入队 → `schedule`（`Scheduler` 上定义；按上述导入顺序推断经 `BalanceScheduler` 转入，待 MRO 验证） | `KVCacheManager.allocate_slots` → 各缓存组管理器 → `BlockPool.get_new_blocks`；收尾 `AsyncScheduler._update_after_schedule`；规则见[调度器](vllm-scheduler.md) |
| 3 | `NPUWorker.execute_model` [C15] | `NPUModelRunner.execute_model` → `_update_states` → `_prepare_inputs` → `_determine_batch_execution_and_padding` → `_build_attention_metadata` |
| 4 | `_model_forward` | `ACLGraphWrapper.__call__` → `AscendGlm5NextDecoderLayer` → `AscendSFAImpl` / `AscendKimiGatedDeltaNetAttention` / `AscendFusedMoE.forward_impl` |
| 5 | `NPUModelRunner.sample_tokens` | `_sample` → `_bookkeeping_sync` → `propose_draft_token_ids` → `_run_merged_draft` |
| 6 | `update_from_output`（`Scheduler` 上定义） | `AsyncScheduler._update_request_with_output` → `_free_request` → `KVCacheManager.free` |
| 7 | `OutputProcessor.process_outputs` | `detokenizer.update` → `RequestOutputCollector` → `chat_completion_stream_generator` |

- 第 3 站这一步没有 token 名额时，`execute_model` 在 `_prepare_inputs` 之前就返回空结果；第 4 站算完 `compute_logits` 把结果存进 `ExecuteModelState` 并返回空值，第 5 站从那里取 [C16]。
- 第 4 站的 `set_ascend_forward_context` 保存宽度和 MoE 通信方式；第 6 站 `_free_request` 后，`finished_req_ids` 随下一份清单通知 worker，`EngineCoreOutputs` 经 ZMQ 回前端。
- `NPUWorker.execute_model` 在这套部署下只记显存统计、按 msmonitor 配置计步，然后转交；流水线并行的收发分支因为只有一个 stage 不执行。
- 草拟总走 eager：草稿器初始化时 `_is_glm_model` 为真就把 `use_cuda_graph` 置回 False，并打一条 `GLM series models with speculative decoding currently do not support graph mode` 的警告 [C51]。

**vllm-ascend 的六个接入点**

| 接入点 | 代码 |
|---|---|
| 平台插件 | 包元数据里的 `vllm.platform_plugins` 入口 `vllm_ascend:register` 返回 `"vllm_ascend.platform.NPUPlatform"`；general plugin 入口里的 `_ensure_global_patch` 调 `adapt_patch(is_global_patch=True)`，注释写明是为了让 EngineCore 子进程里也打上补丁 |
| worker 类 | `NPUPlatform.check_and_update_config` 把 `parallel_config.worker_cls` 设成 `vllm_ascend.worker.worker.NPUWorker` |
| 注意力后端 | `get_attn_backend_cls` 按 `(use_mla, use_sparse, use_compress)` 查表，走通用路径的稀疏 MLA 命中 `(True, True, False)` → `AscendSFABackend`；GLM 的稀疏 MLA 层不经过这张表，后端由层内部的缓存层返回 `AscendIndexerKPoolMLABackend`（`ops/indexer_kpool_mla.py#L78`、`#L136-L137`），该后端直接继承 `AttentionBackend`，和 `AscendSFABackend` 是兄弟类；继承只发生在下一层——实现类 `AscendIndexerKPoolMLAImpl` 继承 `AscendSFAImpl`，元数据类和它的构建器同样各自继承 SFA 的对应类 |
| custom op | `register_ascend_customop` 在 worker 初始化时逐个 `CustomOp.register_oot`；vLLM 是 0.23.0 时将 `FusedMoE` 与 `KimiGatedDeltaNetAttention` 分别替换为 `AscendFusedMoE` 与 `AscendKimiGatedDeltaNetAttention` [C32] |
| patch | 第 2 站的五处见上表 |
| 模型注册 | `Glm5NextForConditionalGeneration` → `AscendGlm5NextForConditionalGeneration`，它内部再按 `Glm5NextForCausalLM` 建文本模型 |

进程名兼日志前缀：EngineCore 进程是 `EngineCore_DP{rank}`，worker 按并行配置拼成 `Worker_DP{}_TP{}_EP{}` [C13]，整体格式是 `(名字 pid=N) `；异常字符串统一见上方「会报什么错」。
