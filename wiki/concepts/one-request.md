---
id: one-request
title: "一条请求：在官方双机部署上从提示词走到回答结束"
type: concept
summary: 沿一条 4 个 token 的示例请求 R1，在两台 Atlas 800 A2、DP2×TP8、EP16、MTP 草拟 3 个的官方部署上走完七站：入口、调度、准备输入、45 层前向、采样与草拟、结果更新、返回收尾；每站给出每张卡上的形状、次数和字节数。
aliases: [单请求推理, 单请求全过程, 请求生命周期, 首 token, 自回归闭环, decode 输入反馈, single request,
  一条请求的七站, 示例请求 R1, qwen-request-legacy, 那条请求, 样例请求, 贯穿例子, 贯穿全站的例子,
  一条请求走到哪, worked example, 例子设定]
chapters: ["00"]
order: 10
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L734-L772
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1054-L1120
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L92-L228
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L660-L698
  - vllm@0fc695fc:vllm/config/model.py#L1851-L1857
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2323
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L500-L560
  - vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L131-L237
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L252
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L141-L236
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L449-L470
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L219-L356
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L380
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L814-L975
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L250
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L479-L557
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2436-L2517
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2486
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L94-L142
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1456-L1519
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L259
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1694-L1910
  - vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L681
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L12-L67
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南固定模型、部署与主线顺序，本页沿请求逐站计算
  - to: glm-5-3-flash
    kind: builds-on
    note: 先知道 GLM 的模型输入、45 层计算与词表输出，再看引擎怎样组织每轮执行
  - to: vllm-scheduler
    kind: builds-on
    note: 第 2 站只走了 R1 一条请求；预算、等待队列和抢占的完整规则在调度器那一页
  - to: prepare-inputs-flow
    kind: builds-on
    note: 第 3 站的 positions、块表提交和槽位怎样逐行算出来，在准备输入那一页
  - to: expert-parallel
    kind: builds-on
    note: 第 4 站 MoE 的 18 个专家、MC2 与 AllGather 两条通信路径，展开在专家并行那一页
  - to: speculative-decoding
    kind: builds-on
    note: 第 5、6 站的草拟、验证与回退是投机解码的一种实现，一般原理在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 640 个 token 一块、5 个缓存组、每块号 8,355,840 B 的规格来源在那一页
verified: []
evidence: C
contradicts: []
updated: "2026-09-27"
---

## 一条请求要走过七站

你向一套部署在两台服务器、16 个 NPU 上的 GLM-5.3-Flash 服务发了一句话。这句话被切成 4 个 token：token 是分词器（把文字切成小段的程序）切出的最小单位，用整数编号表示，一个 token 不一定正好是一个字。4 是本页为演示取的长度，真实请求套上对话格式后至少十几个 token，说明见[示例请求 R1](#示例请求-r1-与官方双机部署)。几十毫秒后第一个字回到屏幕上，随后一段一段地流出来，直到回答结束。这段时间里，16 个 NPU 各自算了什么形状的张量，互相搬了多少字节，最后又怎样把占用的显存还回去？本页跟着这一条请求走一遍。NPU 是昇腾（华为的 AI 芯片及配套软件）的 AI 计算芯片；这套部署用的 Atlas 800 A2 上一张卡就是一个 NPU，下文说「卡」和「NPU」指同一个东西。

先分清两个角色。**模型**负责算：GLM-5.3-Flash 每次读入一串 token，算出下一个 token 最可能是什么，结构见[认识 GLM-5.3-Flash](glm-5-3-flash.md)。**推理引擎**负责组织：vLLM 是开源的推理框架，负责接收请求、决定每一步算谁、管理已经算过的历史；vllm-ascend 是 vLLM 的昇腾插件，负责把这些决定变成 NPU 上的计算。

生成回答要一个 token 一个 token 地往后接，分两个阶段：

- **prefill**（预填充）：请求来了以后的第一步，把整段提示词一次算完，为每个提示词位置留下历史，并给出回答的第一个 token；
- **decode**（解码）：之后的每一步，在已有历史上继续往后算，每步产出新的 token。

每一步算新位置时，都要参考前面所有位置。为了不把前面的位置重算一遍，引擎把前面位置算出的中间结果留在显存里，后面的步反复读，这份历史叫 **KV cache**。普通模型存的是每个位置的 K（key，供后面位置来匹配的向量）和 V（value，被匹配上以后取走的内容向量），GLM 存的形式不同，见[第 2 站的缓存组](#第-2-站-调度4-个-token-的预算和-15-个块号)。显存按固定大小的 **KV block**（KV 块）分给各条请求。

这套部署还开了 **MTP**（Multi-Token Prediction，多 token 预测）：模型自带一层很轻的草稿层，每步先猜出后面 3 个 token 当候选，下一步由主模型一次验证，猜对几个就一次多出几个。

请求沿途经过七站：

1. **入口**：HTTP 请求在前端进程（接收 HTTP 的那个进程）里变成 token 编号，被送进某一台机器的引擎进程，也就是负责调度的那个进程；
2. **调度**：引擎决定这一步给它算几个 token、分给它几个 KV 块；
3. **准备输入**：把调度决定翻译成张量，同时发给这台机器上的 8 个 **worker**，worker 是每张卡一个、负责执行计算的进程；
4. **逐层前向**：前向是模型从输入 token 算到输出分数的一次完整计算，45 层在 8 张卡上并行，层间用集合通信（几张卡一起参与的数据交换）拼回完整结果；
5. **采样与草拟**：从最后位置的词表分数里选出下一个 token，这叫采样，再用 MTP 草拟 3 个候选；
6. **结果更新**：引擎把新 token 追加到请求上，按候选被接受了几个回退计数，检查是否该结束；
7. **返回与收尾**：把 token 编号还原成文字流回客户端，结束后归还 KV 块。

第 2 到第 6 站构成生成循环。每转一圈叫**一步**（step）：一次调度、一次前向、一次采样、一次结果更新。prefill 是第一圈，之后每一圈都是 decode，直到遇到结束条件；每一圈产出的 token 都经第 7 站流回客户端。

```wiki-diagram
file: one-request-system
```

图中编号与七站一一对应。两台服务器分别叫 node0 和 node1。左边一列在 node0 的前端进程里，中间一列在引擎进程里，右边一列在每张卡的 worker 进程里，最下面是另一台机器 node1。第 1、2、6、7 站只在 CPU 上做决定和记账，第 4、5 站的计算在 NPU 上，第 3 站在两者之间把决定翻译成张量。

## 示例请求 R1 与官方双机部署

**示例请求 R1**：提示词经过聊天模板（模型训练时约定的对话格式）和分词后是 4 个 token，记作 `p₀ p₁ p₂ p₃`；服务上此刻只有这一条请求。4 是为演示取的长度，好让每张卡上的张量能逐行写出来；真实请求到不了这么短：GLM-5.3-Flash 的聊天模板给一条消息加的特殊标记就有 6 个，再加 system 行和正文，套完模板至少十几个 token。换成真实长度，和 token 数有关的形状与字节随之变大，各站的机制不变。后面所有数字都按这条请求算，模型维度全部取 GLM-5.3-Flash 的真实配置。

本页沿用上一页的[官方双机部署前提](glm-5-3-flash-two-node.md#部署前提)，模型结构见[认识 GLM-5.3-Flash](glm-5-3-flash.md)，所需数值随请求走到各站时再用。

## 第 1 站 入口：从 HTTP 到 node0 的引擎

**发生在哪里**：node0 的 API server 进程，以及它和两个 EngineCore 之间的消息通道。

**为什么这样做**：套模板、分词和把 token 还原成文字都是纯 CPU 的字符串工作，放在单独的前端进程里，引擎进程就能一直忙于调度和驱动 NPU。两台机器各有一个引擎，前端要决定这条请求交给谁。

1. 客户端 `POST /v1/chat/completions`。聊天接口先套**聊天模板**（模型训练时约定的对话格式，规定 system、user 各段怎么拼、用哪些特殊标记分隔），再用分词器把文本切成 token 编号，得到 `prompt_token_ids = [p₀, p₁, p₂, p₃]` 和采样设置。这里只有 4 个是 R1 的演示设定，真实请求套完模板至少十几个，见[示例请求 R1](#示例请求-r1-与官方双机部署)。
2. `AsyncLLM` 是面向服务端的异步引擎接口。它把输入包成 `EngineCoreRequest`（引擎之间传递请求的数据结构），同时在前端进程里给 R1 登记一个输出收集器：之后 R1 的每批 token 编号都回到这里，由它还原成文字。
3. **选 DP 组。** DP 把请求分给不同执行组；前端按 `分数 = 等待数 × 4 + 运行数` 给两台机器的引擎打分，取分数小的那个。R1 到来时两边都空，分数都是 0，从 0 号开始比较，R1 落到 **DP0，也就是 node0 的引擎**。选中后前端先把 DP0 的等待数在本地加 1，这样紧接着来的下一条请求会被分到 DP1，不必等协调器每 100 ms 一次的计数刷新。
4. 请求通过 ZMQ（一个进程间消息库）送进 DP0 引擎进程的输入队列，引擎把它构造成 `Request` 对象，放进调度器（引擎里决定每一步算谁的那部分）的等待队列。

到这里，R1 在 node0 上有了两份记录：前端进程里的输出收集器，和引擎进程里的 `Request`。node1 的引擎还不知道 R1 存在。进程之间怎样分工见[引擎进程](engine-processes.md)，两台机器之间的请求分配见[数据并行](data-parallel.md)。

## 第 2 站 调度：4 个 token 的预算和 15 个块号

**发生在哪里**：DP0 的 EngineCore 进程，CPU 上。

**为什么这样做**：KV 块的池子是所有请求共享的。每一步开始前，**scheduler**（调度器）要决定这一步给每条请求算几个 token，并保证它们要写的历史有地方放；块不够时宁可让请求等，也不能让前向写越界。

引擎每一步调用一次调度，它先照顾已经在跑的请求，再看等待队列里能不能加入新的。R1 在等待队列里，这一步的账是：

```calc
title: 首步要分配多少 token 预算和 KV 位置
token 预算 = 8192
> R1 需要 4 → 给 4
KV 需求位置数 = 4 个新 token + 3 个预留给 MTP 候选 = 7
```

预留的 3 个位置叫 lookahead：下一步 MTP 的 3 个候选也要先写进 KV cache 才能被验证，调度器现在就把它们的位置算进去。

有了 7 这个数，调度器就去缓存池要**块号**，即已分配显存块的编号。这一站用到两个部署取值：一块覆盖 640 个 token，每个块号在每张卡占 8,355,840 B，约 7.969 MiB；推导见[剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，分配规则见 [KV 块分配](vllm-kv-block-allocation.md)。

块号按**缓存组**申请：同组的层存储格式相同，共用一张块号清单。GLM 分成 5 组，其中 MLA（Multi-head Latent Attention）保存每个位置的压缩历史，KDA（Kimi Delta Attention）保存整条请求的固定大小状态，索引器负责挑出 MLA 要读的位置。表里的 ceil 是向上取整：

| 缓存组 | 装的是什么 | 算式 | 块号数 |
|---|---|---|---|
| full 组 | 12 层 MLA 的压缩历史，和 12 层索引器的压缩 K | `ceil(7 / 640)` | 1 |
| 3 个 KDA 组 | 34 层 KDA 的状态，按层号步长 3 分成 12/11/11 层 | 每组 `ceil((7 + 133120 × 3) / 133120) = 4` | 12 |
| indexer-state 组 | 12 层索引器的暂存状态：索引器每 4 个 token 压成一条，还没凑满 4 个的先存在这里 | `ceil(7 / 4)` | 2 |
| 合计 | | `1 + 12 + 2` | **15 个块号，每张卡 ≈ 119.5 MiB** |

```wiki-diagram
file: one-request-blocks
```

15 个块号乘以每个 7.969 MiB，就是每张卡上的 119.5 MiB。KDA 组的算式看起来奇怪，是因为 KDA 的状态**每条请求一份、大小与序列长度无关**：它的「块大小」被设成最大长度 133120，所以 1 个块号就装得下整条请求的状态；另外 3 个是给 3 个候选位置各留的一格状态：验证时每个位置算出的状态分别写一格，下一步按实际接受了几个候选，从对应那一格接着算。于是一条只有 4 个 token 的请求，15 个块号里有 12 个花在 KDA 状态上。

**前缀缓存在这里是关的。** **prefix caching**（前缀缓存）让不同请求共用相同开头已经算好的 KV cache。GLM-5.3-Flash 同时有 KDA 和 MLA 两种注意力，vLLM 在这一版本里对这类混合模型默认不开前缀缓存，所以 R1 的 4 个 token 一定要从头算。条件见[前缀缓存](prefix-caching.md)。

调度结果装进 `SchedulerOutput`：`{R1: 4 个 token}`、15 个新块号（按组分开）、候选为空。调度器同时把 R1 的「已计算 token 数」提前记成 4，下一步就从位置 4 接着排。调度器的完整规则见[调度器](vllm-scheduler.md)。

## 第 3 站 准备输入：一份计划发给 8 个 worker

**发生在哪里**：从 DP0 引擎进程到 node0 的 8 个 worker 进程，再到每个 worker 里的 `NPUModelRunner`（worker 里负责组织输入、调用模型和采样的对象）。EP 把 MoE 的专家放在不同卡上；本部署的 EP16 跨两台机器，因此这里还要准备让两边一起执行。

**为什么这样做**：TP 把同一层的矩阵切给多张卡；TP8 下 8 张卡算的是同一批 token，只是各持 1/8 的矩阵，所以它们需要完全相同的输入。引擎把同一份 `SchedulerOutput` 通过一块共享内存的广播队列一次发给 8 个 worker，每个 worker 自己把它翻译成张量；算完后只有其中一个 worker 把结果交回引擎。

每个 worker 做三件事：

1. 更新自己的**持久批次**，也就是 worker 在两步之间保留的那份记录：哪些请求在跑、各自的块号和进度，每步只改变化的部分。R1 和它的 15 个块号在这里登记进 **block table**（块表，把请求的逻辑块位置映射到池里的块号）；
2. 算出每个 token 的位置和编号；
3. 算出每个 token 的 KV cache 该写进池里哪一格，这个格号叫 **slot**（槽位）。GLM 的一个 token 要同时写 MLA 历史、索引器压缩 K 和索引器暂存状态三处，所以要算三套格号。

调度器按 640 个 token 一块分配，稀疏注意力的算子却按 128 个 token 一块读，所以 worker 在块表里把 1 个 640 的块看成 5 个 128 的算子块。

R1 第一步在 node0 每张卡上的输入完全相同：

```calc
title: 首步输入怎样标出请求边界
num_reqs = 1
input_ids = [p₀, p₁, p₂, p₃]
> int32 [4]
positions = [0, 1, 2, 3]
> int64 [4]
query_start_loc = [0, 4]
> 本批只有 R1 一段，从 0 开始、到 4 之前结束
attn_state = 含 prefill
```

`int32`、`int64` 是 32 位、64 位整数。位置序号不同于 token 编号：同一个 token 可以出现在不同位置。R1 还没有已计算的位置，所以从 0 开始。这些张量怎样一步步算出来，见[准备输入的流程](prepare-inputs-flow.md)和[块表](block-table.md)。

**node1 此刻在陪跑。** DP1 的调度器没有请求，但 EP16 下 MoE 的通信需要 16 张卡同时参与，缺一张整个通信就卡住。所以 DP1 的引擎每一步都让自己的 8 个 worker 跑一次 4 个 token 的 dummy batch（空闲时陪跑的空批次）。每一步开始前，两台机器还要交换一次「这一步有几个 token、能不能用图」。**graph mode**（图模式）把算子序列预先录下，遇到同样尺寸就整段回放，省掉 CPU 逐个下发的时间；昇腾用 [ACL Graph](acl-graph.md) 实现。R1 的第一步含 prefill，没有录好的图可用，两边都按 4 个 token 的宽度逐个下发算子，这叫 **eager mode**。

## 第 4 站 逐层前向：每张卡上的形状、通信和字节

**发生在哪里**：node0 的 8 张卡上各跑一份 GLM 的前向；node1 的 8 张卡同时在跑 dummy batch，只在 MoE 的专家通信里和 node0 真正交换数据。

**为什么这样做**：一张卡放不下整份模型，也不该让一张卡独自算完一层。TP8 把每层注意力和稠密层的矩阵切成 8 份，每张卡算自己那 1/8；切开以后，每张卡手里只有部分结果，要靠集合通信拼回完整的**隐藏向量**（hidden state，即模型为每个 token 位置维护、在层间不断加工的一条数值向量），下一层才能接着算。MoE 的专家则按 EP16 分在 16 张卡上，token 要被送到专家所在的卡去算。

每层先做 **attention**，让各位置读取前文信息，再做 **MLP**，对各位置单独做矩阵乘与非线性变换。45 层按这两部分的类型分成三种：

| 层号 | 注意力 | MLP | 层数 |
|---|---|---|---|
| 0, 1, 2 | KDA | 稠密 MLP | 3 |
| 3, 7, 11, …, 43 | 稀疏 MLA | MoE | 11 |
| 其余（4–6, 8–10, …, 44） | KDA | MoE | 31 |

下面沿着 R1 的 4 个 token 往上走。每一段都写 node0 **每张卡**上的形状；`T` 是这一步的 token 数，R1 的第一步 `T = 4`。

### 词嵌入与四路残差

**embedding**（词嵌入）按 token 编号从嵌入矩阵里读出一条向量；这条在层间加工的表示叫**隐藏向量**。TP8 下词表 154880 行按行切成 8 段，每卡 19360 行：

```calc
title: 嵌入查表的权重与通信量有多大
每卡嵌入权重 = 19360 × 4096 × 2 B = 151.25 MiB（BF16：16 位浮点，每个数 2 字节）
本卡查表 = input_ids [4] → [4, 4096]，编号不在本卡那一段的行填 0
All-Reduce = TP8 内按元素相加 → 每卡都得到完整的 [4, 4096]
单次张量 = 4 × 4096 × 2 B = 32,768 B
```

每个编号只落在 8 段中的一段里，所以 8 张卡的结果相加，正好拼出完整的嵌入，见 [embedding](embedding.md)。这里的 **All-Reduce** 是集合通信的一种：组内每个成员拿出同形状的张量，按元素相加，然后每个成员都拿到相加后的完整结果。

GLM 的残差和常见模型不同：**residual**（残差）是每个子层旁边那条把输入直接加回输出的旁路，普通模型只有一条，**mHC**（Manifold-Constrained Hyper-Connections）把它扩成 4 条并行的残差流，每个子层前把 4 条加权合成 1 条送进去，算完再写回 4 条并在 4 条之间混合。机制见[层与隐藏表示](layers-and-hidden.md#一层接过什么交出什么glm-为什么在层间传四条)，R1 在这一站的形状如下：

```text
进入第 0 层前   [4, 4096] → 复制 → [4, 4, 4096]   R1 占 4 × 4 × 4096 × 2 B = 128 KiB
每个子层之前    4 条流 → 加权求和 → [4, 4096]     送进注意力或 MLP；同时算出 4×4 混合矩阵
每个子层之后    输出 [4, 4096] → 写回并混合 → [4, 4, 4096]
第 44 层之后    4 条流求平均 → [4, 4096]
```

每层有注意力和 MLP 两个子层，所以每层做两次合成与写回，都在卡内计算，不产生通信；多出的矩阵乘、Sinkhorn 轮数和混合参数显存见[层与隐藏表示](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)。

### 前 3 层的稠密 MLP

第 0、1、2 层的注意力是 KDA（见下一节），MLP 是普通的 SwiGLU 前馈网络：先把 4096 维升到两份 12288 维（gate 和 up），gate 那份过一次 SiLU（一种平滑的非线性函数）后与 up 逐元素相乘，再降回 4096 维。TP8 把 12288 这一维切成 8 份：

```text
gate_up_proj  [4, 4096] × [4096, 3072] → [4, 3072]   每卡 3072 = 2 × 12288 ÷ 8
激活          silu(gate) × up          → [4, 1536]
down_proj     [4, 1536] × [1536, 4096] → [4, 4096]   只是部分和
All-Reduce    TP8 相加部分和            → 完整 [4, 4096]，单次张量 32,768 B
每卡权重      (3072 + 1536) × 4096 × 1 B = 18.0 MiB（int8），3 层 54.0 MiB
```

`down_proj` 的输入维被切开了，每张卡只乘了 1536 维，得到的是完整输出的一个部分和，所以必须 All-Reduce。这个「列切、行切、最后一次相加」的套路在整个模型里反复出现，原理见[张量并行](tensor-parallel.md)。

### 34 层 KDA

注意力通常被拆成若干路并行的分支各算各的，每一路叫一个注意力头；KDA 有 64 个头。KDA 把整段历史压进每个头一个 `128 × 128` 的状态矩阵。每来一个新 token，就用带遗忘门的 delta 规则更新这个矩阵：先按比例忘掉一部分旧状态，再按新旧之差写入新信息；然后用当前位置算出的查询向量（query）去读它。前面还有一个宽度为 4 的因果短卷积，只混合当前和前 3 个位置。所以 KDA 层不随序列变长而多占显存，属于用固定大小的递推状态汇总历史的 **linear attention**（线性注意力），原理见[线性注意力](linear-attention.md)。

64 个头切给 8 张卡，每卡 8 个头：

```text
q/k/v_proj    [4, 4096] → 各 [4, 1024]              每卡 1024 = 8 头 × 128
短卷积        [4, 3072] 与本请求的卷积状态 (3072, 6) 拼接，宽度 4
递推          8 个头各更新一个 [128, 128] FP32 状态
o_proj        [4, 1024] × [1024, 4096] → [4, 4096]   部分和
All-Reduce    TP8，单次张量 32,768 B
每卡权重      34.61 MiB/层（BF16 为主），34 层 1.149 GiB
```

状态写在第 2 站分到的 KDA 块号里。每层每卡的状态：

```calc
title: KDA 为一条请求保留多少状态
卷积状态 = 3072 × 6 × 2 B = 36,864 B
> 6 = 卷积宽度 4 − 1 + 候选 3
递推状态 = 8 × 128 × 128 × 4 B = 524,288 B
> 递推状态是 FP32（32 位浮点，每个数 4 字节）
```

prefill 时 4 个 token 按 64 个一组分块并行地推进状态，这里只有 1 组；decode 时逐个推进。每张卡只保存自己 8 个头的状态，下一步也只读自己的，所以状态本身不需要跨卡同步，整层只有 `o_proj` 后的 1 次 All-Reduce。

### 11 层稀疏 MLA

这一步让每个 token **只挑一部分历史位置来做 attention**，减少长历史的读取和计算，这就是 **sparse attention**（稀疏注意力）。

先看挑选过程：索引器（indexer）把每 4 个历史 token 压成一个摘要，叫 **kpool**，给这些摘要打分；选中一个池，就展开成它代表的 4 个位置。还没凑满一个池的末尾位置叫**尾部**，直接补进清单。每个 query 只能读自己及之前的位置，这就是因果范围。

**选出的清单里装的是位置编号。** R1 的 4 个 query 各有一行，每行预留 2051 个位置名额，所以 `topk_indices` 的形状是 [4, 2051]：4 是当前 token 数，2051 是每个 token 的清单容量，不是头数，也不是已选中的数量。R1 只有 4 个 token，实际内容如下；−1 表示空名额，不会去读历史。

| 当前 query 的位置 | 能读的位置编号 | 编号从哪里来 | 其余名额 |
|---|---|---|---|
| 0 | 0 | 只有 1 个尾部位置 | 填 −1 |
| 1 | 0、1 | 2 个尾部位置 | 填 −1 |
| 2 | 0、1、2 | 3 个尾部位置 | 填 −1 |
| 3 | 0、1、2、3 | 刚好凑成 1 个完整池，展开为 0–3 | 填 −1 |

因此 R1 仍读到自己的全部因果历史，等价于稠密因果注意力；历史更长时才真正挑选，到 133120 个 token 时只读其中 1/65，推导见[稀疏注意力](sparse-attention.md#稀疏什么时候才真的起作用)。压池、打分和 2051 上限的来历见[模型页的索引器](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

**挑好位置后，再用 MLA 读内容。** MLA 把每个 token 的 K、V 压成一条 512 维隐向量保存，省去 64 个头各存 256 维 K、V 的开销。读时把「解压 K」的矩阵提前乘到 query 上，让它直接与 512 维缓存比较，这叫**矩阵吸收**；V 侧的解压则并入输出计算。下面分开看准备、读取和输出，所有形状都按每卡写：

| 步骤 | 形状 | 每一维代表什么 |
|---|---|---|
| 生成压缩表示 | [4, 4096] → [4, 2048]，拆成 [4, 1536] 与 [4, 512] | 4 个 token；4096 是隐藏宽度；2048 拆成 query 的 1536 维和 KV 的 512 维 |
| 索引器准备打分 | query [4, 32, 128]、K [4, 128]、头权重 [4, 32] | 4 个 token；32 个索引器头；每头匹配宽度 128；每个 token 给每个头一个权重 |
| 索引器写摘要 | 4 个 token → 一个 [128] 的 kpool | 池里有 4 个 token；摘要本身是 128 维向量 |
| 展开 attention query | [4, 1536] → [4, 8, 256] | 4 个 token；本卡 8 个 attention 头；每头 query 宽度 256 |
| 吸收 K 解压 | [8, 4, 256] × [8, 256, 512] → [8, 4, 512] | 先把头维移到最前；8 个头各将 4 条 query 从 256 维映射到缓存的 512 维 |
| 按清单读取历史 | 输出 [4, 8, 512] | 维度顺序换回 token、头、压缩内容；每个头读出一条 512 维结果 |
| V 解压与输出投影 | [4, 8, 512] → [4, 2048]；再乘 [2048, 4096] → [4, 4096] | 8 个头各还原 256 维并拼成 2048 维；投影回每个 token 的 4096 维部分和 |

MLA 历史写入前做 RMSNorm：按向量的均方根缩放，再乘可学习系数。每层写 [4, 512]，每 token 1024 B、本层 4096 B；索引器另写一条 128 维摘要，占 256 B。输出部分和经 TP8 All-Reduce 相加，单次张量 32,768 B；每卡权重 37.25 MiB/层，11 层共 409.75 MiB。

这里有两处不按 TP 切：生成压缩表示的投影和索引器在 8 张卡上各存整份、各算 32 个索引器头，用重复计算省去通信；512 维 MLA 历史也各存完整一份，供本卡的 8 个 attention 头共用。投影函数名见页末源码位置，机制细节见[稀疏注意力](sparse-attention.md)和 [MLA](mla.md)。

### 42 层 MoE：每卡 18 个专家

第 3 到 44 层的 MLP 是 MoE：288 个小专家，每个是 `4096 → 2048 → 4096` 的前馈网络，外加 1 个所有 token 都经过的 **shared expert**（共享专家）。**router**（路由器）给每个 token 打 288 个分，选分最高的 8 个专家。

**专家怎么分到卡上。** vLLM 把 DP2 和 TP8 拍平成一个 EP16 维度，第 `r` 张卡（`r = DP 编号 × 8 + 机内编号`）持有第 `18r` 到 `18r + 17` 号专家，专家内部的 2048 维不再切：

```calc
title: 路由专家的权重怎样分摊到每张卡
每卡专家数 = 288 ÷ 16 = 18
每卡每层权重 = 18 × (4096 × 4096 + 4096 × 2048) × 1 B = 432 MiB（int8）
42 层 = 17.72 GiB，占主干 45 层权重的 88%
```

所以 R1 的一个 token 选中的 8 个专家，通常散在不同的卡上，甚至在另一台机器上。token 要被送过去（**dispatch**，派发），算完的结果再按路由权重收回来相加（**combine**，结果组合）。

### MoE 通信：走 MC2 还是 AllGather

Atlas A2 上 vllm-ascend 只在两种通信方式里选：**MC2**（通算融合，把专家计算和跨卡收发协同执行的一类昇腾实现，只搬被选中的 token 副本）和 **AllGather**（先把两台机器的全部隐藏向量互相收集一遍，每张卡再挑出路由到自己专家的行）。这里的 AllGather 是这条通信路径的名字；下文单独出现的集合操作写作 All-Gather。门槛是 128 个 token：

```calc
title: 什么时候走 MC2
每卡每次最多 = ceil(128 ÷ 8) = 16 个 token
TP8 共 = 16 × 8 = 128
判断用的是两台机器里较大的那个 token 数
```

128 正好是 32 条请求 × 每条 4 个 token，也就是最大的 decode 图尺寸：纯 decode 步一定走 MC2；只要任一边这一步超过 128 个 token，比如混进一段较长的 prefill，两边就一起翻到 AllGather。R1 这一步两边都是 4 个 token，走 **MC2**。

**R1 在一层 MoE 里的每一步：**

```text
router        [4, 4096] × [4096, 288]（FP32）→ [4, 288] → 每个 token 选 8 个专家
补齐与切片    4 行补到 8 行，TP8 每卡分 1 行；机内编号 0–3 的卡拿到真 token，4–7 的卡拿到填充行
dispatch      每卡发出 ≤ 1 个 token × 8 个专家 × (4096 B int8 + 4 B 缩放系数) = 32,800 B
专家计算      落到本卡 18 个专家上的（token, 专家）对，期望 4 × 8 × 18 ÷ 288 = 2 行
combine       每卡收回 ≤ 1 × 8 × 4096 × 2 B = 65,536 B
拼回          TP8 All-Gather，每卡发 1 行 8,192 B，拼回完整 [4, 4096]
共享专家      在完整 [4, 4096] 上算，按 TP8 切，每卡 3.0 MiB；之后 TP8 All-Reduce，单次张量 32,768 B
```

这里 TP8 被当成 token 维的切分用：8 张卡各负责 1/8 的 token 去派发，最后用 **All-Gather**（每个成员拿出自己的分片，拼成完整集合发给所有成员）拼回来。dispatch 送出去的是 int8 量化后的隐藏向量加一个 FP32 缩放系数；combine 收回的是 BF16 结果。一个 token 一层 dispatch 加 combine 最多 `32,800 + 65,536 = 98,336 B`，42 层 `98,336 × 42 = 4,130,112 B ≈ 3.94 MiB`。

R1 这种单请求下，node0 有一半卡在这一层只拿到填充行，node1 的 8 张卡整步都在陪跑。它们仍然必须参与 dispatch 和 combine，因为 MC2 要求 16 张卡同时进出这次通信。专家怎样分布、何时翻到 AllGather，见[专家并行](expert-parallel.md)和[大规模 EP](large-scale-ep.md)。

### 最终归一化与词表投影

第 44 层结束后，4 条残差流取平均折回 `[4, 4096]`，做一次 RMSNorm，再乘 **lm_head**（词表投影，把隐藏向量变成词表里每个词的分数，这些分数叫 logits）。lm_head 与嵌入矩阵是两份独立的权重，同样按词表切成 8 份：

```text
每卡权重              [19360, 4096] BF16 = 151.25 MiB
prefill 只取最后位置   [1, 4096] × [4096, 19360] → [1, 19360]，38,720 B
TP8 All-Gather        拼成 [1, 154880]，309,760 B
```

prefill 只需要最后一个位置的分数：每个位置只能看到自己和它前面的位置，位置 3 已经看过 `p₀ … p₃` 全部提示词，它的隐藏向量用来预测提示词之后的第一个 token。前 3 个位置在这一步的作用是把历史写进 KV cache 和 KDA 状态。

### 一次前向的通信账

下图把上面各段串起来，图中的标签是每一段的集合通信和次数。

```wiki-diagram
file: one-request-forward
```

R1 的 prefill 和之后的 decode 步，每张卡上的张量宽度都是 `T = 4`，所以两者的通信几乎一样，差别只在 lm_head 要出几行分数。下表按 decode 步（出 4 行分数）记；「每次的量」一列，All-Reduce 写的是参与相加的张量大小，其余写的是每卡发出或收回的字节：

| 类型 | 次数 | 每次的量 | 合计 |
|---|---|---|---|
| TP8 All-Reduce | 91 = 1 嵌入 + 45 注意力 + 3 稠密 + 42 共享专家 | 张量 32,768 B | 2.84 MiB |
| MC2 dispatch | 42 | 每卡发出 ≤ 32,800 B | ≤ 1.31 MiB |
| MC2 combine | 42 | 每卡收回 ≤ 65,536 B | ≤ 2.63 MiB |
| TP8 All-Gather（MoE 拼回） | 42 | 每卡发出 8,192 B | 0.33 MiB |
| TP8 All-Gather（lm_head） | 1 | 每卡发出 154,880 B | 0.15 MiB |
| 合计 | **218 = 91 + 42 × 3 + 1** | | **≤ 7.3 MiB** |

prefill 那一步 lm_head 只出 1 行，这一行每卡发出 38,720 B，合计约 7.15 MiB。两种步都不含第 5 站 MTP 草拟三遍的通信。为了 4 个 token，每张卡要做 218 次集合通信。数据量只有几 MiB，这一步的耗时更可能由 218 次通信和几百个算子各自的固定开销决定，这也是 decode 步要用图模式的原因。

这一步主干前向写进 KV cache 的新历史：11 层 MLA 各 4 个 token 的隐向量加索引器压缩 K，共 `4 × 11 × (1024 + 64) B = 47,872 B ≈ 46.8 KiB`；KDA 状态原地更新，不增加占用。第 12 层是 MTP 草稿层，它在第 5 站草拟第 1 遍时为这 4 个位置再写 `4 × 1,088 = 4,352 B`，两者合计 52,224 B ≈ 51 KiB。这 51 KiB 已经占住了一个 640 格的块号，短请求的块利用率只有 `4 ÷ 640 ≈ 0.6%`，这是让一个块号能同时装下 KDA 状态付出的代价。

## 第 5 站 采样与 MTP 草拟：选出 y₀，再猜 3 个

**发生在哪里**：node0 每个 worker 里，紧接在前向之后，仍在 NPU 上。

**为什么这样做**：模型算出的是 154880 个词的分数，还不是一个 token，要按请求的采样设置从中选出一个。选完之后，如果每步只出这 1 个 token，每个 token 都要付一次完整的 45 层前向和 218 次通信；MTP 用一层很轻的草稿层先猜出后面 3 个，下一步把它们和确定的 token 一起送进主模型验证，猜对几个就一次多出几个。

**先采样。** 8 张卡都拿到完整的 `[1, 154880]` 分数，各自按相同的随机种子跑一遍同样的 sampling（采样）：请求的温度（把分数拉平或拉尖的系数）接近 0 时直接取分数最大的词；否则先除以温度，再只在分数最高的一小批词里（top-k、top-p 截断）按概率抽一个。8 张卡的结果一致，只有机内编号 0 的那张卡把结果交回引擎。R1 这一步选出第一个回答 token `y₀`，这就是**首 token**。

**再草拟。** MTP 是模型自带的第 45 层，结构和主干的稀疏 MLA + MoE 层相同，但只有单条残差，没有四路 mHC。**speculative decoding**（投机解码）指的就是这种先草拟、再由主模型验证的做法。

MTP 要接着刚选出的 token 再往后猜。因此，它既需要主模型对已有上下文的理解，也需要知道**刚选出的下一个 token 是什么**。例如最后一行的隐藏向量已经读过 p₀ 到 p₃，主模型据此选出 y₀；草稿层把这条隐藏向量与 y₀ 的嵌入配在一起，继续猜 d₁。

同样的配对应用到每一行，就要把 token 向前错开一格，让它和前一个位置的隐藏向量相遇。这就是「左移一格」；移动的是 token 输入，隐藏向量和第一遍的 positions 都保持原来的行号：

| 第一遍的行号／positions | 隐藏输入已读到 | 与它配对的 token（左移后的输入） | 这一行要预测的位置 |
|---|---|---|---|
| 0 | p₀，位置 0 | p₁，位置 1 | 位置 2 |
| 1 | p₁，位置 1 | p₂，位置 2 | 位置 3 |
| 2 | p₂，位置 2 | p₃，位置 3 | 位置 4 |
| 3 | p₃，位置 3 | 刚采出的 y₀，位置 4 | 位置 5，取此行得到 d₁ |

也就是第 i 行用位置 i 的隐藏向量和位置 i + 1 的 token，预测位置 i + 2。R1 只取最后一行作为后续候选。每行的两份输入各有 4096 维，先各自归一化，拼成 8192 维，再投影回 4096 维；4 行一起算，形状如下：

```text
第 1 遍  token 输入 = [p₁, p₂, p₃, y₀] 的嵌入，位置 [0, 1, 2, 3]
         隐藏输入   = 主模型这一步的隐藏向量 [4, 4096]
         两者各做一次归一化后拼成 [4, 8192] → 投影回 [4, 4096]
         → 一层稀疏 MLA + MoE → 词表投影 → 取最后一行 → d₁（位置 5）
第 2 遍  token 输入 = d₁，位置 +1，隐藏输入 = 第 1 遍的输出   → d₂（位置 6）
第 3 遍  token 输入 = d₂，位置 +1，隐藏输入 = 第 2 遍的输出   → d₃（位置 7）
```

后两遍仍按第 1 遍的 4 行宽度跑，真正取出来算分数的只有 R1 那 1 行。三遍用的是同一层权重，每遍都取分数最大的词，与请求自己的温度设置无关。MTP 层每卡约 540.75 MiB 权重，其中 432 MiB 是它自己的 18 个路由专家；嵌入表和 lm_head 与主模型共用同一份。它的 MLA 也要写 KV cache，这就是块号里第 12 层的来历。

草拟不走图模式：vllm-ascend 对「GLM 系列加投机解码」这个组合，把草稿层强制切回 eager mode，每遍按实际宽度下发。三遍各自也要做 MLA 和 MoE 的通信，并在两台机器之间对齐一次宽度，node1 的草稿层同样陪跑。

三遍也各自重算索引器，接口条件见页末[源码位置](#源码位置)。

这一步得到 1 个确定的 `y₀` 和 3 个候选 `d₁ d₂ d₃`。本部署默认异步调度：确定的 token 回传引擎，候选留在 worker 供下一步使用；引擎以占位数记账，代码路径见[请求调用链](request-call-chain.md#同一条请求第-1-步和第-2-步走的分支不同)。投机解码的一般原理见[投机解码](speculative-decoding.md)。

## 第 6 站 结果更新：接受几个候选、回退几格

**发生在哪里**：DP0 的 EngineCore 进程，CPU 上。

**为什么这样做**：worker 只负责算，请求的进度由引擎统一记账。下一步给 R1 排几个 token、从哪个位置开始、要不要结束，都取决于这里记下的数。

**prefill 这一圈的更新。** 引擎追加 `y₀` 后，R1 持有 5 个 token，已计算数是 4；这次继续生成，`y₀` 同时经第 7 站返回。worker 保留具体候选，引擎的 `AsyncScheduler` 维护候选与待返回输出的占位数。

**decode 的更新**先按拒绝数回退计数。接受 `k` 个候选时，已计算数退回 `3 − k` 格，再逐个追加本轮的 `k + 1` 个 token 并检查停止条件。下面两圈给出数值；第 6、7 站的停止分支集中画在[返回与收尾](#第-7-站-返回与收尾)的图里。

## 第二圈和第三圈：decode 步一次验证 1 + 3 个 token

decode 每一圈都从第 2 站走到第 6 站。普通自回归每步只送 1 个新 token；有了 MTP 的候选，主模型一次前向同时算出 4 个位置的分数，用前 3 个位置检查候选对不对，候选全对时第 4 个位置还能多给出一个 token。计算从 1 个位置变成 4 个，但权重读取和那 218 次通信只付一次。

这套配置按默认会打开 **async scheduling**（异步调度）：调度器不等上一圈的结果回来，先用占位数把下一圈排好，结果回来后再补账。时间上两圈交错，但每圈算几个 token、写哪几格的账和下面一样，见[异步调度](async-scheduling.md)。

### 第二圈（decode 1）：② → ⑥

**② 调度**：R1 持有 5 个 token，加上 3 个候选是 8 个，已计算 4 个，所以这一圈要算 `8 − 4 = 4` 个 token。KV 需求是 `8 + 3 = 11` 个位置：full 组仍在那个 640 格的块号里，KDA 组的 12 个块号也不变；indexer-state 组要把块列表补到 `ceil(11 / 4) = 3` 块。它先还窗口外的整块，窗口是最后 4 个位置，已算 4 个时窗口外只有 `4 − 3 = 1` 个位置、凑不满一块，一块都不还，所以这一圈新借 1 块、手里 3 块。此后每前进 4 个位置还 1 块、借 1 块，decode 时手里一直是 3 或 4 块，算法见 [KV 块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。

**③ 准备输入**：

```calc
title: 下一圈在哪些位置验证草稿
input_ids = [y₀, d₁, d₂, d₃]
> int32 [4]
positions = [4, 5, 6, 7]
KV 写入 = full 组那个块号的第 4–7 格
```

R1 的整条序列都住在同一个 640 格的块号里，所以块内格号就等于位置号。

**图模式回放**：这一圈 DP0 是 1 条请求、4 个 token，正好是一个整齐的 decode 批次；DP1 的 dummy batch 也是 4 个 token。两边对齐后都能用图，于是 16 张卡各自**回放**启动时录好的那张 4-token 图，而不是由 CPU 把几百个算子和 218 次通信一个个下发。输入尺寸与录制时不符的圈，比如混进了 prefill，就整圈退回 eager mode。条件和代价见[图模式](graph-mode-layer.md)。

**④ 前向**：每张卡上的形状和 prefill 那圈完全相同，都是 `T = 4`，区别在注意力要读历史。稀疏 MLA 的 4 个 query 各自读缓存里自己及之前的位置，位置 7 的 query 读 0–7 共 8 个位置；KDA 走逐 token 的递推路径，每推进一个位置，就把那时的状态写进一格候选状态。

**⑤ 验证与再草拟**：lm_head 这次要出 4 行分数，TP8 All-Gather 后每卡 `[4, 154880]` BF16，即 `4 × 154880 × 2 B = 1,239,040 B ≈ 1.18 MiB`。前 3 行用来验 3 个候选，第 4 行是候选全对时才用得上的 bonus token。worker 按 **rejection sampling**（拒绝采样，逐位决定候选留不留的规则）逐位检查；以贪心采样为例，就是逐位比较分数最大的词：

```text
第 0 行（位置 4 的输出）预测位置 5：分数最大的是 d₁   与候选 d₁ 相同 → 接受
第 1 行（位置 5 的输出）预测位置 6：分数最大的是 y₂   与候选 d₂ 不同 → 写下 y₂，停止
本圈产出：y₁ = d₁、y₂，共 2 个 token
```

接着 MTP 从第 1 行（位置 5）接着猜，得到新候选 `d₁′ d₂′ d₃′`，对应位置 7、8、9。

**⑥ 结果更新**：接受了 `k = 1` 个候选，追加 `y₁ y₂` 两个 token，R1 持有 7 个。调度器在排这一圈时已经把已计算数加到 8，现在退回 `3 − 1 = 2` 格：`8 − 2 = 6`。位置 6、7 已经写进缓存的 KV cache 是用错误候选算的，但块号不释放，下一圈会从位置 6 起原地覆盖。

### 第三圈（decode 2）

```calc
title: 拒绝草稿后从哪些位置继续
input_ids = [y₂, d₁′, d₂′, d₃′]
positions = [6, 7, 8, 9]
> 位置 6、7 覆盖上一圈写错的两格
图 = 还是那张 4-token 图，回放
```

假设 3 个候选全对：前 3 行各接受一个，第 4 行的 bonus 也采纳，产出 `y₃ y₄ y₅ y₆` 共 4 个 token，已计算数从 6 推进到 10，不用回退；MTP 再猜出 `d₁″ d₂″ d₃″` 留给下一圈。

### 三步的账

| 圈 | 送进主模型 | 位置 | 验证结果 | 本圈产出 | 已计算位置数 | 请求持有的 token 数 |
|---|---|---|---|---|---|---|
| prefill | `p₀ p₁ p₂ p₃` | 0–3 | 没有候选 | `y₀` | 4 | 5 |
| decode 1 | `y₀ d₁ d₂ d₃` | 4–7 | 接受 1 个 | `y₁ y₂` | 8，回退到 6 | 7 |
| decode 2 | `y₂ d₁′ d₂′ d₃′` | 6–9 | 全部接受 | `y₃ y₄ y₅ y₆` | 10 | 11 |

```wiki-diagram
file: one-request-token-steps
```

每一圈主模型都跑 45 层、草稿层跑 3 遍，共 48 个层次，每个层次 4 个 token 位。两个 decode 圈产出 `2 + 4 = 6` 个 token，平均每圈 3 个；一圈最少出 1 个（第一个候选就错），最多出 4 个。这里的「接受 1 个」「全部接受」是为了把算式走通设的例子，不是实测的接受率。

「请求持有的 token 数」始终比「已计算位置数」多 1：最新产出的那个 token 还没作为输入经过主干，它要等下一圈和新候选一起送进去。

每一圈结束后，留给下一圈用的东西和用完就丢的东西分得很清楚：

| 对象 | 放在哪里 | 下一圈怎样用 |
|---|---|---|
| 模型权重 | 每卡约 20.58 GiB | 常驻，所有请求、每一圈都复用 |
| R1 的进度、输出 token 和候选 | 引擎进程的 `Request`，以及每个 worker 的持久批次 | 决定下一圈送哪几个 token、从哪个位置起 |
| MLA 历史和索引器压缩 K | full 组的块号，node0 的 8 张卡各存一份 | 按位置追加，后面的 query 来读 |
| KDA 状态 | 3 个 KDA 组各 4 个块号，每卡只存自己 8 个头 | 原地更新，按接受了几个候选从对应那格接着算 |
| 本圈的激活和分数 | 各卡的临时显存 | 采样用完即丢 |

## 第 7 站 返回与收尾

**发生在哪里**：token 编号从 DP0 的引擎进程回到 node0 的前端进程，在那里还原成文字；请求结束后，引擎在 CPU 上把块号还回池子。

**为什么这样做**：token 编号到文字的还原是逐步的，一个汉字可能跨几个 token，一个 token 也可能只是半个词，所以前端为每条请求保留一个增量反分词器（把 token 编号一点点还原成文字的组件），攒够能显示的文字再发。块号是所有请求共享的，一条请求结束就应该立刻还回去，让等待中的请求能被调度。

结束 token 是模型用来表示回答到此为止的特殊 token；停止 token 是请求通过 `stop_token_ids` 指定的终止编号；**stop string** 是请求参数 `stop` 指定的停止字符串，需要把编号还原成文字后才能匹配。

```wiki-diagram
file: one-request-finish-flow
```

stop string 可以横跨多个 token，所以匹配放在持有增量反分词器的前端。每步文字通过 SSE（服务器推送事件，HTTP 流式响应的一种格式）发出，分段取决于文字边界，一圈的 1–4 个编号可以组成不同长度的文字。

**沿图走一次长度到限的分支。** 设 R1 的 `max_tokens = 200`，本圈前已有 197 个输出，验证又产出 4 个。追加到第 200 个时命中长度条件，本圈只返回前 3 个。结束 token（GLM 配置为 154820、154827、154829）和请求指定的停止 token 也在引擎侧判断；stop string 走图中前端终止的分支，客户端取消同样需要通知引擎释放请求。

**归还块号。** R1 结束时整条序列 `4 + 200 = 204` 个 token，KV 需求 `204 + 3 = 207` 个位置，仍在 full 组那个 640 格的块号里。所以 R1 从头到尾，full 组只用 1 个块号，KDA 组始终是那 12 个；indexer-state 组跟着 4 个 token 的窗口向前滑，每前进 4 个位置还 1 个旧块、补 1 个新块，decode 时手里 3 或 4 个。按上面这条分支，最后一圈调度时已算 `4 + 197 − 1 = 200` 个位置，indexer-state 组手里是 `ceil(207 / 4) − floor(197 / 4) = 52 − 49 = 3` 个，合计 **`1 + 12 + 3 = 16` 个块号**；最后一圈前的输出数换成 196–199 里别的数，已算位置除以 4 余 2 时这一组是 4 个、合计 17 个。indexer-state 组这一生共借过 52–53 个块号，其中 49 个途中已经还掉。结束时 R1 手上的这 16–17 个块号一次性还回空闲队列。R1 的 ID 随下一次 `SchedulerOutput` 通知 node0 的 8 个 worker，各自清掉为它保存的持久批次记录。

**两台机器停下来。** DP0 的运行数减 1，协调器把新的负载推给前端，影响下一条请求的去向。两个引擎每 32 步交换一次「还有没有活」，发现两边都空了才一起停下；在这之前 node1 和 node0 都会继续跑 dummy batch，最后一条请求结束后最多多跑 31 步。新请求到来时，前端通知协调器把两边一起叫醒。

## 这个例子看不见什么

R1 是一条短请求，服务上也只有它一条，所以下面几件事在这一页里都没有出现：

- **真实的提示词长度**：R1 的 4 个 token 是演示设定，真实请求套完聊天模板至少十几个 token，见[示例请求 R1](#示例请求-r1-与官方双机部署)。所以本页 prefill 和 decode 宽度都是 `T = 4` 只是巧合，真实请求的 prefill 更宽；
- **多条请求拼一批**：每一步的批次怎样由不同进度的请求拼成、两台机器的负载不均时谁决定宽度，见[多请求并发](concurrent-requests.md)；
- **块不够时抢位置**：KV 块用完时调度器会让一部分请求让出块、之后重算，这叫 preemption（抢占），见[调度器](vllm-scheduler.md)；
- **长提示词切块算**：提示词比每步 8192 个 token 的预算还长时，prefill 要分几步做完，也就是 chunked prefill，见[分块预填充](chunked-prefill.md)；
- **稀疏注意力真正起作用**：历史超过 2051 个位置以后，索引器才开始真的挑位置，见[稀疏注意力](sparse-attention.md#稀疏什么时候才真的起作用)；
- **prefill 和 decode 分开部署**：把两个阶段放到不同的执行组，再传 KV cache，见 [PD 分离](pd-disaggregation.md)。

## 常见误解

- **「DP2 就是两台机器各跑各的。」** 两台机器各有自己的调度器和 KV 块池，但 MoE 的专家分在 16 张卡上，任何一边算 MoE 都需要另一边同时参与通信。所以空闲组也要每步跑 dummy batch；图模式取两组较低值，宽度按各组是否允许 DP 补齐分别决定，见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

- **「TP8 下每张卡只存 1/8 的 KV cache。」** KDA 状态按头切，每卡只存自己 8 个头的；MLA 历史里的 512 维隐向量对所有头都有用，8 张卡各存一份完整的。每 token 13,056 B 是每张卡都要付的数。

- **「块大小 640 就是注意力算子的块。」** 640 是调度器和 KV 块池分配的单位，由「一个 MLA 块要装得下一份 KDA 状态」算出来；稀疏注意力的算子看到的是 128 个 token 一块，1 个 640 的块等于 5 个算子块。

- **「短请求几乎不占显存。」** R1 只有 4 个提示词 token，起步就在每张卡上占 15 个块号约 119.5 MiB，其中 12 个是 KDA 状态，与序列长度无关。

- **「MTP 让每一步算得更少。」** 每个 decode 步主模型要算 4 个位置，再加 3 遍草稿层，一步的计算比普通自回归更多。省下的是步数：候选猜对得越多，同样长的回答需要的步数越少，每步那 218 次通信和权重读取被更多 token 分摊。

- **「被拒绝的候选要把 KV 块还回去。」** 回退只改请求的已计算计数，块号不动；下一圈从回退后的位置起写，原地覆盖写错的那几格。

- **「开了图模式，整条请求都在回放图。」** 本部署只给整齐的 decode 批次录了图。R1 的 prefill 那一圈、MTP 的三遍草拟、以及任何混进 prefill 的圈都是 eager mode。

## 对照源码

### 怎么开

沿用[部署页的官方参数](glm-5-3-flash-two-node.md#怎么开)：MTP 使用 `deepseek_mtp`，每步草拟 3 个；主模型使用 `FULL_DECODE_ONLY`。完整启动命令、W8A8 精度分布与调度上限在该页统一维护。

### 会报什么错

遇到 traceback 时，先按[请求调用链](request-call-chain.md)的进程与最内层文件定位七站，再查[源码位置](#源码位置)中的对应实现；不要仅凭 HTTP 接口所在的第 1 站判断故障位置。本页跟踪正常请求，没有单独收录报错字符串。

### 开销和什么时候别开

MTP 每步增加 3 遍草拟，收益取决于候选接受数；本页 218 次通信只计主干。接受率低时应结合实测耗时评估，不能把示例的平均每圈 3 个 token 当作收益保证。

**核验范围与待核。** 本页的形状、次数和字节数由配置与源码推出，没有在设备上实测。要拿一次真实部署来定的有：卡上显存总量与实际块号数（启动日志的可用显存与 KV 块数行）；W8A8 权重的 `quant_model_description`，它决定 MLA 的三个大投影是否量化，整卡权重在 20.58 与 20.81 GiB 之间；异步调度是否实际开启（启动日志的 `Asynchronous scheduling` 行）；真实的候选接受率（它决定 R1 结束时还 16 个还是 17 个块号；indexer-state 组 decode 时 3–4 块是按源码推的，未实跑）；slot 三套格号的逐行对应；MC2 是否合并落在同一张卡上的专家副本，本页 dispatch 与 combine 的字节数按不合并的上界记；稀疏 MLA 与 KDA 的元数据在图回放时怎样更新；GLM 三个结束编号怎样分到 `eos_token_id` 与 `stop_token_ids`；每一步的实测耗时。

### 版本差异

- 控制流按 vLLM v0.23.0（`vllm@0fc695fc`）核读，NPU 执行侧按 GLM 专用的 vllm-ascend 源码快照（`vllm-ascend@db701c1f`）核读。只有在 `vllm_version_is("0.23.0")` 为真时，vllm-ascend 才把 `FusedMoE` 和 `KimiGatedDeltaNetAttention` 换成本页描述的 Ascend 实现。专用镜像里最终安装的上游版本尚未核实，记录见[来源基线](../sources/glm-5-3-flash-baseline.md)。
- vllm-ascend 的 `main`（`baa023ad`）把 MTP 挪到 `vllm_ascend/models/glm5next/mtp.py`，并把 MTP 输入的几步预处理（嵌入与隐藏向量各自归一化、拼接）融合成一个算子，数学上等价；「GLM 加投机解码时草稿强制 eager」的那段在 `main` 上仍在。
- v0.26.0rc（`vllm-ascend@2ed6cbba`，配套 `vllm@568afb3a`）：已核实该分支没有 GLM-5.3-Flash 的模型代码。依据是对 2ed6cbba 执行 `git ls-tree -r --name-only 2ed6cbba | grep -i glm`，vllm_ascend/ 下只有一个 GLM 推理用量补丁，教程只有 GLM4.x、GLM5、GLM5.2，没有 glm5_next 模型文件和 GLM5.3-Flash 教程；上面的固定部署数字不适用于该分支，逐版对照见 [KV cache 的版本差异](kv-cache.md#版本差异)。

### 源码位置

**实现细节。** MTP 的 `index_share_for_mtp_iteration=true` 只有在草稿模型提供 `set_skip_topk` 接口时才能复用索引；`db701c1f` 的 GLM 草稿模型没有该接口，proposer 用 `hasattr` 检查后让三遍都执行完整索引器，见下表「同一层跑 3 遍」。MTP 配对表展示送入的 token；进入草稿层时，`positions == 0` 的 token 嵌入会清零，判断依据是 token 的位置，不是 batch 的第一行；R1 取末行产生候选不受影响，见 `glm5_next_mtp.py` 第 94–142 行（来源第 29 条）。稀疏 MLA 形状表里的压缩投影、query 展开和输出投影分别对应 `fused_qkv_a_proj`、`q_b_proj`、`o_proj`，压缩 query 记作 `q_c`，压缩历史记作 `kv`。

**部署数据的出处。** 并行分工、官方参数、20 个进程、权重明细与 KV 容量统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)、[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)、[KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)和[启动顺序](glm-5-3-flash-two-node.md#启动时发生了什么)。图捕获尺寸 4/8/16/32/64/96/128 对应每请求 4 个 token 时的 1、2、4、8、16、24、32 条请求；如何补齐见[多请求页](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

| 站 | 想核对的事 | 阅读位置 |
|---|---|---|
| 0 部署 | 45 层、4096、154880 词表、288 选 8、KDA 与 MLA 的层号 | GLM-5.3-Flash 的 `config.json` [S1] |
| 0 部署 | DP2、TP8、EP16、MTP 3、图尺寸、8192 / 32 / 133120 | 官方 GLM-5.3-Flash 双机教程 [S2] |
| 1 入口 | 按 `waiting × 4 + running` 选 DP 组 | `DPLBAsyncMPClient.get_core_engine_for_request` [C3] |
| 1 入口 | 聊天模板、分词与生成 `EngineCoreRequest` | `OpenAIServingChat.create_chat_completion`、`AsyncLLM.add_request`，见[引擎进程](engine-processes.md) |
| 2 调度 | 等待队列里的请求带 `num_lookahead_tokens = 3` 要块 | `Scheduler.schedule` 的 waiting 分支 [C5] |
| 2 调度 | KDA 组每请求 1 + 3 块 | `MambaManager.get_num_blocks_to_allocate` [C6] |
| 2 调度 | 640 的由来与 KDA 状态 561,152 B | `verify_and_update_config` 的替换版 [C7] |
| 2 调度 | GLM 的 5 个缓存组 | vllm-ascend 替换的 `get_kv_cache_groups` [C8] |
| 2 调度 | 每块号 `12 × (655,360 + 40,960) = 8,355,840 B` | GLM 布局的块字节公式 [C9]，推导见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache) [D] |
| 2 调度 | R1 第一步 `1 + 12 + 2 = 15` 个块号 | 由第 2 站三行算式相加 [D] |
| 2 调度 | 混合模型默认不开前缀缓存 | `is_prefix_caching_supported` [C10] |
| 3 准备 | 广播给 8 个 worker、位置与块表 | `MultiprocExecutor.execute_model`、`NPUModelRunner._prepare_inputs`，见[准备输入的流程](prepare-inputs-flow.md) |
| 3 准备 | 两台机器对齐宽度与图模式 | `_sync_metadata_across_dp` [C11] |
| 3 准备 | 空闲的一边跑 dummy batch、每 32 步查一次全局 | `DPEngineCoreProc.run_busy_loop` [C4] |
| 4 前向 | mHC 展开、每层两次 `hc_pre`、四路求均值 | `AscendGlm5NextDecoderLayer` 与 `AscendGlm5NextModel` [C12] |
| 4 前向 | KDA 的候选状态格与 `num_accepted_tokens` | `AscendKimiGatedDeltaNetAttention._forward` 的 spec 分支 [C13] |
| 4 前向 | 512 个 kpool、展开 2048、尾部 3 | `ops/triton/glm5_next_lightning_indexer.py` 的 `glm5_next_lightning_indexer_triton` [C14] |
| 4 前向 | A2 上 MC2 与 AllGather 的门槛 128 | `mc2_tokens_capacity`、`_select_a2_moe_comm_method` [C15] |
| 4 前向 | 218 = 91 + 42 × 3 + 1 次集合通信 | 由第 4 站各段相加 [D] |
| 4 前向 | 嵌入、稀疏注意力、MoE 通信、lm_head 的通用实现 | 见 [embedding](embedding.md)、[稀疏注意力](sparse-attention.md)、[专家并行](expert-parallel.md) |
| 5 采样 | GLM 加投机解码时草稿强制 eager | `_is_glm_model` 与 proposer 初始化里的覆盖 [C16] |
| 5 采样 | 同一层跑 3 遍、每遍取分数最大；索引复用的接口检查 | `_run_merged_draft`（含 `hasattr(draft_model, "set_skip_topk")`）[C17] |
| 5 采样 | 采样、MTP 左移一格的输入 | `NPUModelRunner.sample_tokens`、`set_inputs_first_pass`，见[投机解码](speculative-decoding.md) |
| 6 更新 | 贪心下逐位比较、首个不等处停止 | `rejection_sample` 的贪心分支 [C18] |
| 6 更新 | `num_computed_tokens -= num_rejected` | `Scheduler.update_from_output` [C19] |
| 6 更新 | 图的回放与不回放时的透传 | `ACLGraphWrapper.__call__`，见 [ACL Graph](acl-graph.md) |
| 6 更新 | 逐个追加、截断、停止条件与释放块号 | `_update_request_with_output`、`check_stop`、`_free_request`；`check_stop` 先过 `min_tokens`，再查结束 token、停止 token、长度与重复检测，见[调度器](vllm-scheduler.md) |
| 7 返回 | 增量反分词与输出收集 | `OutputProcessor.process_outputs`，见[引擎进程](engine-processes.md) |
| 7 返回 | 前端命中 stop string 后通知引擎终止并回收 | `OutputProcessor.process_outputs` 的 `reqs_to_abort` → `abort_requests_async` → `Scheduler.finish_requests` [C35] |
| 5/6 | 异步调度下候选留在 worker，引擎维护占位数 | `AsyncScheduler._update_after_schedule` [C36] |
