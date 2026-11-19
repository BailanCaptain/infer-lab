---
id: learning-guide
title: "阅读指南：这个知识库讲什么，按什么顺序读"
type: concept
origin: direct
summary: 知识库总导览：串联服务冷启动与请求执行两条生命线，说明 Core-26 三层阅读轨道、四族昇腾硬件、四大交互工程实验室与三级版本基线契约，并保留 GLM-5.3-Flash 五页全案主线入口。
aliases: [学习路线, 阅读顺序, 入门指南, 无设备学习]
chapters: ["00"]
order: 1
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/README.md
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/doc/inference_deployment_qa.md
relations: []
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: "2026-11-19"
---

## 这个知识库讲什么

一段文字交给一套真实的昇腾推理服务，它被怎样算成了回答——这个知识库围绕这一件事，串联起**两条生命线**：

- **服务冷启动线（启动期）**：从 `vllm serve` 命令起服出发，依次经过平台插件注册与双阶段 Patch（[插件注册](platform-plugin-registration.md)、[Patch 机制](ascend-patch-system.md)）、权重加载与 7 级显存预算体检（[NPU Worker 生命周期](npu-worker-lifecycle.md)、[KV 缓存显存画像](kv-cache-memory-profiling.md)），直到 ACLGraph / NPU 图编译就绪（[图模式分层](graph-mode-layer.md)）。
- **请求执行线（运行期）**：一条请求进门分词（[请求入口](api-server-entry.md)、[token](token.md)），进入调度与分页 KV 分配（[vLLM 调度器](vllm-scheduler.md)、[KV 块分配](vllm-kv-block-allocation.md)），沿逐层前向与多卡并行完成计算（[请求全景](request-overview.md)、[Tensor Parallel](tensor-parallel.md)），最后经过采样、流式反分词与请求收尾把结果送回客户端并释放显存块（[Sampling](sampling.md)、[流式输出](streaming-output.md)、[请求收尾](request-teardown.md)）。

为了兼顾最新社区演进与完整案例自洽，全站统一遵守**三级版本基线契约**：

1. **全站默认主基线（`v0.30.0`）**：对齐 `vllm-ascend@c09d3e20` + 配套 `vllm@ced6857a`，标准教学标尺采用 `Qwen3-8B`（Dense GQA）与 `Qwen3-30B-A3B`（MoE），覆盖新模型上线、单卡与多卡机制、显存画像与排障（起步见[请求全景](request-overview.md)、[新模型上线](ascend-model-onboarding.md)与[核心 CLI 参数](core-cli-params.md)）。
2. **显式例外 A（`RFork` 权重快载专题）**：独立演进的权重快载实现，目标主基线对齐上游 `vllm-ascend@8d6180e2`（`main`），详情见[RFork 总览](rfork.md)。
3. **显式例外 B（历史 GLM-5.3-Flash 绑定算例）**：五页全案主线与 19 篇含冻结 3D 场景的历史绑定算例继续钉住原审定镜像 `vllm@0fc695fc + vllm-ascend@db701c1f`（双机 2×A2×8 TP8/DP2/EP16 W8A8），确保跨页形状、字节与通信总账 100% 自洽，不与 `v0.30.0` 的 Qwen3 数字混算。

五页全案主线使用下面这套固定前提，换页时可直接延续背景；生产实践与标准主基线页会在各自开头交代模型与来源：

| 固定的前提 | 一句话结论 | 展开在哪一页 |
| --- | --- | --- |
| 模型 | GLM-5.3-Flash。attention 把前文信息汇到当前位置；MoE（mixture of experts）把前馈计算分给多个专家，每个位置只挑少数几个来算 | [模型结构与配置数字](glm-5-3-flash.md) |
| 部署 | vLLM 是开源推理引擎，vllm-ascend 是它的昇腾适配层；主线采用官方双机配置。W8A8 表示在采用该量化方式的计算中，权重和激活都用 8 位整数表示；激活是计算中的中间数值，并非全模型所有数据都变成 8 位 | [硬件、并行规模与关键参数](glm-5-3-flash-two-node.md#部署前提) |
| 源码 | 以官方教程的镜像为基线；需要逐行核对时，再看页末[版本差异](#版本差异) | [来源基线](../sources/glm-5-3-flash-baseline.md#镜像固定与源码对应) |

部署里有三个分工名称，先记住各自分的是什么：

- **TP（tensor parallel）分矩阵计算**：同一层的矩阵交给多张卡，先按列切、再按行切，成对使用；各卡先算出完整的几列，再算出下一次乘法的部分和，最后相加。
- **DP（data parallel）分请求**：把请求分给不同执行组，各组分别安排自己的请求在哪一步计算；这里每台机器是一个执行组。
- **EP（expert parallel）分专家**：把不同专家放到不同卡上，需要哪个专家，就把输入送到那张卡，算完收回结果；这里两台机器共同持有完整的专家集合。

具体哪些层量化、每卡放什么，继续读[部署页](glm-5-3-flash-two-node.md#每张卡上放了什么)。

用纸笔就能跟着例子复算形状、次数和字节数；需要 NPU（neural processing unit，昇腾的计算设备）实测才能确定的事项，列在页末「对照源码」的**待核**条目里。

## 三层阅读轨道与新模型上线起步

左侧目录把全站页面分成**三层阅读轨道**，初学者不必一上来通读全部专题：

| 阅读轨道 | 覆盖什么 | 适合什么时候读 |
| --- | --- | --- |
| `🔥 Core-26` | 全站 26 篇核心基石页：从[请求全景](request-overview.md)、[新模型上线](ascend-model-onboarding.md)、[HF 模型文件解剖](hf-model-anatomy.md)到单层计算、分页 KV、四族硬件与量化、四维基础并行、冷启动显存画像与[核心 CLI 参数](core-cli-params.md) | 首次系统学习或需要按 `v0.30.0` 标准主基线把推理链路从头贯通时，优先打通这 26 篇 |
| `🎯 主线支撑` | 各章主线走廊页面：补齐 Embedding/RoPE/lm_head、采样与流式收尾、两仓插件与图编译、评测基准与排障入口 | 读完 `Core-26` 后，或遇到具体链路断点需要补齐上下游因果时 |
| `🌿 同章进阶` | 深入机制与工程专题：MoE 与多模态、MLA/稀疏/线性注意力、高阶并行耦合链、PD/EPD 分离与外置缓存池、RFork 权重快载、参数字典与历史快照 | 已有主线直觉，面向特定模型架构、多机扩展或专项排障时按需查阅 |

## 按顺序读的五页主线

第一次读，按下面五页的顺序走：模型 → 部署 → 单条请求 → 多条请求 → 代码路径。

| 顺序 | 读哪一页 | 读完能回答的问题 |
| --- | --- | --- |
| 1 | [认识 GLM-5.3-Flash](glm-5-3-flash.md) | 一次前向里到底算了什么？一层里的两段计算各做什么？两种 attention 怎样用历史？生成一个 token（词元，文本分词后用编号表示的处理单位，不一定是一个字）之后留下了哪些状态？ |
| 2 | [我们的部署](glm-5-3-flash-two-node.md) | 16 张卡上各放了什么？为什么要两台机器？启动时按顺序做完了哪几件事？权重占掉之后，剩下的显存变成多少 KV cache（保存历史位置的中间结果，让后面的 token 不用重算前面的内容）？ |
| 3 | [一条请求](one-request.md) | 一条请求要走过哪七站？每一站在每张卡上的形状、次数和字节数是多少？处理尚未算过的提示词位置（prefill，可以整段也可以分块），与利用已有历史继续生成（decode，一步不一定只推进一个位置），各要做哪些工作？首个输出怎样得到？ |
| 4 | [多个请求](concurrent-requests.md) | 新请求先进哪个调度组？一步的 token 预算怎么分给十几条请求？显存不够时谁让位？两个组为什么要互相等对方？ |
| 5 | [代码路径](request-call-chain.md) | 每一站在哪个进程里执行？经过哪些类和函数？进程之间走哪条通道？出问题时怎么判断请求停在哪一站？ |

前四页只要会矩阵乘就能读；第 5 页开始需要能看懂 Python 调用栈。读完这五页，再按下一节的表挑分组。

想把主线用于分析实际问题，可以接着读[推理性能分析：为什么回答到一半会停顿](inference-performance-walkthrough.md)。跟着一条中途停顿的请求，先找出它在等什么，再检验减少每步工作量能否改善；有现场问题时，可以直接查[需要采集哪些记录](inference-performance-walkthrough.md#现场怎样拿到这些记录)。

```wiki-diagram
file: learning-guide-route
```

## 学会分析推理问题，接下来怎样读

先沿一条连续的问题读下去，每一站都用上一站留下的结果继续判断：

| 顺序 | 读哪一页 | 读完试着自己判断 |
| --- | --- | --- |
| 1 | [回答为什么停顿](inference-performance-walkthrough.md) | 分块后 D 少等、N 多等，这个改动在什么目标下值得采用？设备早已算完时，为什么要换方向？ |
| 2 | [怎样知道真的变好了](inference-benchmarking.md) | 总输出量没变，达标请求更多了，能宣布什么？还缺哪些验收？ |
| 3 | [设备在算还是在等](inference-performance-analysis.md) | 为什么少算一些输入能缩短一步，切得太小又会有代价？通信时间很长，怎样区分等人和传输慢？ |
| 4 | [DeepSeek 生产实践](deepseek-serving-case.md) | 分块以外，分开 P/D 解决什么？少排的队能否覆盖状态交接和缓存搬运？ |
| 5 | [容量与恢复](inference-capacity-and-reliability.md) | 从压测表怎样选运行点？少一套实例后会积多少工作，机器回来为何还没恢复？ |

再读另一类完整案例：[输出为什么变了](inference-correctness-troubleshooting.md)。先完成一次模板差异的定位与修正，再看输入相同、分数不同或只在客户端重复时，排查路线怎样改变。它训练的是正确性分析，不依赖前面五篇全部读完。

现场查阅有两个入口：[通用排障](inference-troubleshooting.md)用于启动、内存、通信、输出、接口等问题；已经确认主要是性能问题时，直接用[性能排障](inference-performance-troubleshooting.md)选择实验。这两页按需要查，不必把十类和六类分支逐项背完。参数、缓存、通信和调度的完整原理仍链接到各自机制页。

## 从生产现象继续读模型与策略

理解前面的等待、交接和容量以后，再追问“模型内部到底省了什么”。前两篇接着看同一份长历史：先弄清谁生成它，再看窗口丢失后怎样恢复。后两篇分别研究生成和数值表示，可以按问题单独读。每篇先走完具体例子，再进入实际配置与现场检查；首次阅读不需要背配置表。

| 顺序 | 读哪一页 | 读完试着自己判断 |
| --- | --- | --- |
| 1 | [DeepSeek 模型与状态](deepseek-v4-1-flash.md) | 画出后半共享 KV 从哪里来、各层窗口从哪里来；指出长输入省去哪些计算，新 token 仍走哪些层 |
| 2 | [SWA 有界回放](swa-bounded-replay.md) | 在两层均值例子里算出 4 和 6，解释为什么读取相同位置仍可能得到不同结果 |
| 3 | [DSpark](dspark.md) | 数清一轮的 5 行输入和 3 个新输出；再根据概率和耗时，判断该给谁多验证一个候选 |
| 4 | [低精度格式](low-precision-formats.md) | 把 2.8 压成四位后读回 3；区分舍入、格式读错和系数错配，并算出它们怎样影响结果 |

从业者可按现象查：缓存命中后仍要重算看第 2 篇；接受率高但不提速看第 3 篇；降低精度后异常或变慢看第 4 篇。输入模板、协议转换与流式字段仍分别由 [token](token.md)、[请求入口](api-server-entry.md)、[流式输出](streaming-output.md)、[结构化输出](structured-output.md)解释，避免为新模型再复制一套服务基础知识。

## 继续看硬件怎样承接这些计算

全站围绕**四族昇腾硬件**展开设备能力与代码适配对照（完整硬件与软件栈总览见[昇腾硬件设备](hardware-devices.md)与 [CANN 与 HCCL](cann-hccl.md)）：

| 硬件族 | 核心形态与定位 | 在知识库里看哪几页 |
| --- | --- | --- |
| **Atlas 800I/T A2**（910B 家族） | 单卡/单机 8 卡主力推理与双机部署基线，机内 HCCS、跨机 RoCE | [昇腾硬件设备](hardware-devices.md)、[AI Core](ai-core.md)、[GLM 双机部署](glm-5-3-flash-two-node.md) |
| **Atlas 800I A3 双 Die** | 双计算 Die 封装与高带宽超节点互连形态，面向大规模 EP 与高并发 | [昇腾硬件设备](hardware-devices.md)、[大规模 EP](large-scale-ep.md)、[MoE 通信派发](moe-comm-dispatch.md) |
| **昇腾 950** | 新一代计算/搬运融合、任务执行卸载、超节点互联与内存池架构 | [昇腾 950：计算与数据搬运](ascend-950-architecture.md)、[昇腾 950：任务执行与互联](ascend-950-execution-interconnect.md) |
| **Atlas 300I Duo / 310P** | 轻量推理卡族，在算子、量化与采样/Runner 侧有独立 `_310p` 适配边界 | [昇腾硬件设备](hardware-devices.md)、[昇腾 FlashAttention](ascend-flash-attention.md)、[NPU Model Runner](npu-model-runner.md) |

读新硬件白皮书时，先跟一块数据走，不急着记核数和峰值。还不熟悉设备内部的读者，先看 [AI Core](ai-core.md) 的矩阵计算与逐项计算；还不熟悉跨卡交换的读者，先看[集合通信](collective-communication.md)的两卡相加。

| 顺序 | 读哪一页 | 读完试着自己判断 |
| --- | --- | --- |
| 1 | [昇腾 950：计算与数据搬运](ascend-950-architecture.md) | 矩阵结果交给向量计算时，哪次写出和重读可以省？跨步取数与缓冲复用分别要解决什么问题？ |
| 2 | [昇腾 950：任务执行与互联](ascend-950-execution-interconnect.md) | 两张卡的结果合并前，到底在等提交、等另一张卡，还是等数据传输？通信卸载后哪些等待仍在？ |

现场分析也可以直接进入两页后半段，核对实际设备、软件版本、执行路径与测量记录。硬件具备某种能力，只能帮助提出要验证的优化方向；是否被当前框架使用、是否改善整条请求，仍要拿到对应证据。PR/DT 原始规格集中在第一篇，已有的 A2 双机部署数字继续留在部署页。

## 回到三份参考资料，遇到陌生段落去哪查

现在可以把教程里学到的分析方法带回原文。下面按阅读中遇到的问题找已有页面；首次学习仍按前面的路线走，不必为了读参考资料先把所有分支读完。

| 参考中的问题 | 从这里接着读 | 阅读时试着解释 |
| --- | --- | --- |
| DeepSeek 生产实践：E/P/D、分流与共享缓存 | [生产接力](deepseek-serving-case.md#分流看什么决定了哪些卡会一起等)、[大规模 EP](large-scale-ep.md)、[EPLB](eplb.md) | 请求数相同为什么仍可能等最慢的卡？为什么前缀亲和取决于缓存放在哪里？ |
| DeepSeek 生产实践：扩缩容和故障恢复 | [容量与恢复](inference-capacity-and-reliability.md) | 一张卡故障影响多大范围？机器回来后为何还要消化积压？ |
| DeepInfer：离线吞吐与 profiler 图 | [测量口径](inference-benchmarking.md#读-deepinfer-的性能图先弄清哪些工作被计入) | 哪些 token 是按假设计数的？拼起来的时间线能不能用来量首字等待？ |
| DeepInfer：SWA、变长验证、异步与确定性 | [模型状态](deepseek-v4-1-flash.md)、[回放](swa-bounded-replay.md)、[DSpark](dspark.md)、[异步调度](async-scheduling.md)、[批次一致性](batch-invariance.md) | 分别省了计算、验证还是主机空隙？DeepInfer 的确定性组合见 DSpark 页末，不能套用其他框架的开关。 |
| Recipe 与结构化输出 | [请求入口](api-server-entry.md#换成-deepseek-recipe入口负责到哪里)、[流式输出](streaming-output.md)、[格式约束](structured-output.md) | 普通文本和控制 token 怎么区分？跨片段的字符为什么不能逐段独立解码？ |
| 950 白皮书：计算、搬运与图像处理 | [计算与存储](ascend-950-architecture.md)、[低精度格式](low-precision-formats.md) | 哪一次搬运被省掉？图像预处理与图像模型分别做什么？ |
| 950 白皮书：通信、超节点与资源池 | [执行与互联](ascend-950-execution-interconnect.md#接入内存池以后模型就能直接多留历史了吗)、[KV Pool](kv-pool.md) | 硬件能访问远端资源以后，软件还要怎样找到并用上正确的历史？ |

遇到原文的配置或性能数字，先保留它的模型、硬件、版本与测量条件，再与教程比较。例如 DeepInfer README 列出上下文并行（CP，把同一条请求的上下文工作分给多张卡）能力，而该快照的生产部署问答说线上暂未使用 CP；支持一种分工与某套服务实际采用它，是两件事。CP 怎样分位置由[上下文并行](context-parallel.md)解释，不从另一框架的参数名猜默认行为。

## 每个分组展开主线的哪一步

按主线的步骤找到该读的分组；点击小节名可进入该小节的第一页。

| 分组 | 小节 | 展开主线的哪一步 | 什么时候读 |
| --- | --- | --- | --- |
| 开始学习 | 阅读路线（就是你正在读的这页）；[模型与请求概览](glm-5-3-flash.md) | 主线入口、模型计算、单请求与多请求 | 第一次阅读时，从本页进入五页主线 |
| 模型结构与计算 | [输入表示与张量计算](token.md)；[数值表示与量化](quantization.md)；[Decoder 层、MoE 与 lm_head](layers-and-hidden.md)；[Attention 与位置编码](attention-qkv.md) | 部署时的权重表示；准备输入与逐层前向 | 读完第 1 页，展开 embedding（词向量）、矩阵乘和 attention；读第 2 页权重预算时查量化 |
| 推理过程 | [Prefill、Decode 与 KV cache](prefill.md)；[Block table 与 prefix caching](block-table.md)；[Chunked prefill 与 speculative decoding](chunked-prefill.md)；[调度与执行重叠](async-scheduling.md)；[KV cache 量化与分层存储](kv-cache-quantization.md)；[外部 KV cache 与 connector](kv-pool.md) | 部署时的缓存预算；请求调度、decode 与缓存复用 | 读完第 3 页展开缓存与生成过程；读完第 4 页展开调度；缓存容量问题从第 2 页接入 |
| vLLM 与 Ascend 架构 | [组件、职责与进程](vllm-v1-shape.md)；[启动与平台适配](platform-plugin-registration.md)；[EngineCore、Scheduler 与 KV block 分配](vllm-engine-core.md)；[Model runner 与 attention backend](prepare-inputs-flow.md)；[源码阅读](vllm-ascend-repo-map.md) | 部署与启动；从请求入口、调度、执行到返回的代码实现 | 读第 5 页或开始查源码时；启动问题可从第 2 页接入 |
| Ascend 硬件与软件栈 | [设备、内存与计算单元](hardware-devices.md)；[软件栈与互连](cann-hccl.md) | 部署时的设备与显存；逐层前向的计算与通信 | 读完第 2 页，想了解卡、显存和卡间通信时 |
| 分布式推理与部署 | [集合通信与 HCCL](collective-communication.md)；[并行维度](tensor-parallel.md)；[并行策略进阶](fine-grained-tp.md)；[DP 组分流与 expert 负载](balance-scheduling.md)；[贯穿案例](glm-5-3-flash-two-node.md)；[PD 分离与 KV 传输](pd-disaggregation.md) | 部署与分组、前向中的卡间通信、多请求分流与专家负载 | 第 2 页前补通信与并行基础；第 4 页后看负载；主线读完再看进阶部署 |
| 性能与工程优化 | [性能分析与排障](inference-performance-walkthrough.md)；[生产部署与容量](deepseek-serving-case.md)；[模型与推理策略](deepseek-v4-1-flash.md)；[Graph mode 与主机资源](graph-mode-layer.md)；[数值一致性](batch-invariance.md) | 测量、资源成本与问题定位；生产接力、扩缩容与恢复；状态复用、候选验证与低精度 | 学习者从样例继续读；现场问题从[排障入口](inference-troubleshooting.md)分流 |
| 服务能力 | [LoRA 与 structured output](lora.md) | 模型适配、采样约束与返回格式 | 需要定制模型或约束输出格式时 |

剩下三个分组不在上表里，用法各不相同：

- **RFork 工作版**是一套独立演进的实现，只动主线上的一个位置——启动时加载权重那一步：新实例从一个已经加载好权重的 worker（管一张卡、真正跑前向的执行角色）那里直接读权重，省掉重新从磁盘加载。前向、调度和采样每一步都照旧。沿[总览](rfork.md)进去，版本边界写在那一章里。
- **参数参考**是字典，不是课文：正文里出现一个参数名，想知道它的定义、默认值和版本差异时，到这里查一条。先在正文里读懂机制，再来查参数，顺序反过来会很难懂。
- **来源与更新记录**是底稿：固定的配置与源码依据、PR 记录、历史问答，以及还没编排进目录的新页都在这里。核对某一页的结论时，从这里找一手材料。

## 怎么用这个知识库

**术语。** 术语用英文原名，和源码、日志、官方文档里看到的写法一致；第一次出现时，旁边的中文解释帮助你理解它在做什么。

**对照源码怎么读。** 第一次读可以先看正文，理解机制。需要配置功能、排查报错或核对实现时，再查「对照源码」中的相应小节：开关用法、报错条件、开销、版本差异和源码位置；概念页按内容选用，特性页按这五项补齐。源码位置表可帮你找到对应的类、函数或配置。

**角标是什么意思。** 来源处的角标说明结论的依据：S 官方文档或论文、C 固定 commit 的源码、M 离线可复现实测、D 推导、A 教学假设、I 推断或本站编排、! 版本冲突、实验状态或当前禁配。悬停可看说明；点击带编号的 S、C、M 可打开来源。页头的证据等级概括整页的依据。

**四大交互工程实验室。** 除了阅读概念与源码，站点顶部导航的「工程实验室」提供四套与源码规则联动的交互工具：

| 工程实验室 | 解决什么工程问题 | 建议配合阅读 |
| --- | --- | --- |
| **① 部署算账台** | 「立项四问」双模算账：输入模型、硬件族与并发目标，估算权重、7 级显存余量、KV 块预算与并行拓扑 | [KV 缓存显存画像](kv-cache-memory-profiling.md)、[Tensor Parallel](tensor-parallel.md) |
| **② `vllm serve` 配置体检器** | 静态联检单实例或 P/D 分离的 CLI 与 `additional_config` 组合，提前发现版本互斥、图融合与内存风险 | [核心 CLI 参数](core-cli-params.md)、[AscendConfig 配置系统](ascend-config-system.md) |
| **③ 交互式排障工作台** | 按报错日志与相对时序做现象分流，给出最小首取证据与对照实验 | [通用排障](inference-troubleshooting.md)、[性能排障](inference-performance-troubleshooting.md) |
| **④ AI Core 算子实验室** | 对比 910B 与 950 的 Cube/Vector 算子流水线与数据搬运重叠泳道 | [AI Core](ai-core.md)、[昇腾 950：计算与数据搬运](ascend-950-architecture.md) |

**接着看与问答侧栏。** 每页底部的「接着看」列出相关页面，悬停可预览标题、摘要和证据等级。遇到不熟悉的名词或报错，可以打开右侧「问答」侧栏，输入问题或粘贴报错；回答附有来源角标和相关阅读链接。窄屏上点击「问答」打开抽屉。

## 对照源码

### 版本差异

全站遵守三级版本基线契约：标准主基线页面对齐 `v0.30.0`（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）；`RFork` 专题按独立工作版对照上游 `main`；而 GLM-5.3-Flash 五页全案主线及历史 3D 绑定算例沿用例外 B 专用镜像钉点——执行侧源码核到 **`vllm-ascend@db701c1f`**，控制流按镜像元数据中的 `VLLM_TAG=v0.23.0` 取 **vLLM v0.23.0（`vllm@0fc695fc`）**。**待核：**容器内最终安装的上游 vLLM 代码，需逐项比对安装产物。镜像与源码的对应见[来源基线](../sources/glm-5-3-flash-baseline.md#镜像固定与源码对应)，控制流的代码入口见[调用链](request-call-chain.md)。[!]

知识库各机制页统一在文末对照以下四条正式固定快照，读源码时可按 commit 切到同一份代码（历史过渡期快照 `v0.30.0rc2` `7d825229` 归档于[rc2 基线档案](../sources/v030rc2-baseline.md)）：

| 分支 | 固定的代码版本 | 阅读时怎么用 |
| --- | --- | --- |
| `v0.23.0` | `vllm-ascend@2c59ff10`（`releases/v0.23.0`）；配套 `vllm@0fc695fc` | 查旧维护分支特性与默认值；GLM 全案主线执行侧另见专用镜像 `db701c1f` |
| `v0.26.0rc` | `vllm-ascend@2ed6cbba`（`releases/v0.26.0rc`）；配套 `vllm@568afb3a` | 查 v0.26 发布分支的特性、默认值与演进分叉 |
| `v0.30.0`（主基线） | `vllm-ascend@c09d3e20`（`releases/v0.30.0`）；配套 `vllm@ced6857a` | **全站默认主基线**：查当前正式版行为、配置入口与 Qwen3 标尺 |
| `main` | `vllm-ascend@8d6180e2`；配套 `vllm@ba15685a` | 查上游最新开发分支演进（含 MRV2 迁移与最新特性），不反向覆盖 `v0.30.0` 正式版行为 |

读到具体特性时，到特性页的「对照源码」一节里查「版本差异」小节：哪条分支有这个特性、默认值是什么、行为有什么不同。各页正按这个结构补齐；阅读尚在整理的页面时，可先沿来源链接核对固定版本。

### 源码位置

模型层数 45、隐藏维度 4096、词表 154880 等配置见模型页及官方配置 [S1]。阅读顺序、分组入口与统一背景是本站编排 [I]。

DeepInfer 固定 README 的 Supported features 列出 balanced CP [S2]；同快照部署问答的 Inference system overview 说明所述生产部署暂不采用 TP/CP [S3]。两者的适用范围不同，不能把其中一项改写为另一项的否定。

