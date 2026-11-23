---
id: learning-guide
title: "阅读指南：这个知识库讲什么，按什么顺序读"
type: concept
origin: direct
legacyAnchors:
  按顺序读的五页主线: 异构旗舰双机实战全案（历史 GLM-5.3-Flash 专题）
summary: 知识库总导览：用通俗主线串联一条请求在昇腾推理服务中的完整旅程，给出零基础概念起步与工程上线速查两条入口，对齐 01–12 全部目录分组、四族昇腾硬件与四大交互工程实验室。
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

**你向一台运行着昇腾（Ascend）芯片的大模型服务发出一句话，机器背后到底做了哪些事，才把回答一个词一个词算出来？** 这个知识库只围绕这一件事展开，拆成两条相互扣合的主线：

- **服务怎样启动起来（冷启动线）**：从输入一条 `vllm serve` 启动命令开始，推理引擎如何接入昇腾适配层、把模型权重搬进显存、摸清还剩多少显存留给缓存，并把常用计算流程提前编排好，等待请求上门。
- **请求怎样算出回答（运行执行线）**：一句话进门后怎样切成模型能读懂的编号（token），多条请求怎样排队共用显存，模型逐层计算和跨卡协作到底算什么、传什么，最后怎样选出下一个词并流式发回给你。

全站只要具备基本 Python、向量与矩阵乘法概念就能读懂；没有昇腾机器也能用纸笔跟着例子复算形状、次数和字节数。需要真机实测才能确认的指标，都明确标在页末「对照源码」的**待核**条目里。

## 先选你的起步路线（01 全景入门拆成两步）

左侧目录第 **01 组《全景入门与新模型上线》** 同时面向两类读者。为了避免初学者一上来就被命令行参数和模型文件格式绊住，也方便有经验的工程师直奔上线，建议按背景选一条路线切入：

| 你的目标 | 建议起步顺序 | 为什么这样走更顺 |
| --- | --- | --- |
| **路线 A · 概念初学者**<br>（从零建立推理直觉） | 本页 → [请求全景](request-overview.md) → **直接进入 02 组** [token](token.md) → [embedding](embedding.md) → [attention](attention-qkv.md) → **03 组** [Prefill 与 Decode](prefill.md) → [KV cache](kv-cache.md) → [PagedAttention](paged-attention.md) | 先用 6 个词的迷你例子看懂整条链路，再一层层拆开单个积木、显存分页、昇腾硬件和多卡并行，全程零前置概念倒挂 |
| **路线 B · 新模型上线速查**<br>（要把模型尽快跑在昇腾上） | 在 **01 组** 内按 [读懂 HF 模型目录](hf-model-anatomy.md) → [昇腾新模型上线总览](ascend-model-onboarding.md) → [环境准备与服务启动](ascend-env-and-serve.md) 走完，随后转到 **08 组** [核心 CLI 参数](core-cli-params.md)与[通用排障](inference-troubleshooting.md) | 先学会看 `config.json` 算权重和显存，再确认模型是否受支持、怎么选容器镜像并拉起服务，遇到报错再按需回查原理页 |

```wiki-diagram
file: learning-guide-route
```

全站采用**双层标尺设计**，把主流通用原理与异构旗舰全案明确分开，避免初学者一上来就被前沿特例绊住：

- **主流入门标尺（覆盖约 `80%` 生产模型）**：日常概念页与 `v0.30.0` 标准算例统一采用 **`Qwen3-8B`**（Dense GQA，稠密分组查询架构）与 **`Qwen3-30B-A3B`**（MoE，稀疏混合专家架构）。沿路线 A 走通 01–03 组，即可掌握绝大多数线上大模型的通用推理直觉。
- **异构旗舰双机全案（进阶实战，非入门前置）**：**09 组**的 GLM-5.3-Flash 双机 16 卡专题包含四路残差（mHC）与 5 个混合缓存组（KDA + 稀疏 MLA）等前沿特性。它适合作为学完主流基础后的综合演练，**不是阅读基础页的前置条件**。

> **入门轨道 2 题通关自测**（沿路线 A 读完 01–03 组后，先自检这两问再进 09 组进阶全案）
> 1. **首 token 在哪一步产出？**（是在 Prefill 处理完最后一个提示词位置后的词表采样阶段，还是等第一轮 Decode 才生成？）
> 2. **标准 GQA 每个位置留什么缓存？**（按 KV 头数存该位置的 K、V 向量，不按查询头数翻倍，也不涉及 GLM 的四路残差或 5 组混合缓存。）

## 侧栏 01–12 全部目录一览

知识库左侧目录按知识依赖排成 **12 个分组（01–12）**。每一组都先有**主线走廊**带你走通核心概念，再在同组下方放**进阶专题**供按需深挖：

| 编号与分组 | 核心讲什么 | 推荐入口页 | 适合什么时候读 |
| --- | --- | --- | --- |
| **01 全景入门与新模型上线** | 一条请求的全景直觉（概念起步），以及看懂模型文件、确认昇腾支持并拉起服务（上线速查） | 概念起步：[请求全景](request-overview.md)<br>上线速查：[读懂 HF 模型目录](hf-model-anatomy.md) | 第一次打开本站时先分流 |
| **02 标准模型单层计算与多模态输入** | 从切词、查表、矩阵乘、注意力（Attention / RoPE / GQA）到层间残差、词表打分（`lm_head`），再扩展到 MoE 与多模态输入 | [token](token.md) → [attention-qkv](attention-qkv.md) → [lm_head](lm-head.md) | 概念路线第一段，搞懂单层到底在算什么 |
| **03 单实例调度、分页 KV 缓存与注意力状态变体** | Prefill 与 Decode 差异、KV cache 与分页块表、连续批处理、分块预填充、采样收尾，以及 MLA/稀疏/线性注意力、前缀复用与投机解码 | [Prefill 与 Decode](prefill.md) → [KV cache](kv-cache.md) → [PagedAttention](paged-attention.md) | 读完 02 组后，理解单卡服务如何省显存、提吞吐 |
| **04 昇腾硬件体系、注意力分块与现代量化** | Roofline 性能屋顶、四族昇腾硬件、HBM 显存与 AI Core、FlashAttention 分块，以及低精度格式、W8A8/W4A8 量化与 KV 量化 | [Roofline 与指标](roofline-and-metrics.md) → [昇腾硬件设备](hardware-devices.md) → [量化](quantization.md) | 想知道“为什么卡在带宽、量化怎么省显存、昇腾芯片内部怎么干活”时 |
| **05 集合通信原语、分布式并行与负载均衡** | All-Reduce 等集合通信原语、CANN/HCCL、TP/PP/DP/EP 四维基础并行，以及序列并行、MoE 通信状态机、上下文并行、KVPP 与动态负载均衡 | [集合通信](collective-communication.md) → [张量并行 TP](tensor-parallel.md) → [专家并行 EP](expert-parallel.md) | 单卡装不下或并发扛不住，需要切到多卡多机时 |
| **06 PD / EPD 分离架构与跨实例外置 KV 体系** | 把 Prefill 与 Decode（乃至视觉编码）拆到不同集群、Mooncake 跨实例传输、D 节点抢占回退、逐层/稀疏卸载，以及外部 KV Pool / LMCache / UCM | [PD 分离](pd-disaggregation.md) → [Mooncake 连接器](mooncake-connector.md) → [KV Pool](kv-pool.md) | 面向大规模长上下文在线服务，研究 PD 分离与外置缓存池时 |
| **07 vllm-ascend 两仓架构、冷启动与图编译引擎** | vLLM V1 进程分工、插件注册与补丁机制、配置系统、冷启动显存摸底、单步执行调用链、Model Runner V2、自定义算子与 ACLGraph / NPU 图编译 | [vLLM V1 形态](vllm-v1-shape.md) → [vllm-ascend 总览](vllm-ascend-overview.md) → [请求调用链](request-call-chain.md) | 需要对照源码定位实现、二次开发或调试图编译问题时 |
| **08 测量基准、核心调参、版本迁移、服务特性与排障手册** | 核心 CLI 参数与 `v0.30.0` 迁移、吞吐压测与精度评测、性能与正确性排障三大专道，以及 LoRA、结构化输出、睡眠模式、强化学习等服务能力 | [核心 CLI 参数](core-cli-params.md) → [通用排障](inference-troubleshooting.md) → [回答为什么停顿](inference-performance-walkthrough.md) | 线上调参、压测验收或排查启动/性能/精度故障时 |
| **09 旗舰异构模型端到端全案解剖** | 两大完整多机实战案例：**GLM-5.3-Flash 双机 16 卡全案**（含 3D 交互场景）与 **DeepSeek-V4.1-Flash 百万上下文跨代全案** | [GLM-5.3-Flash 模型](glm-5-3-flash.md) / [DeepSeek-V4.1-Flash](deepseek-v4-1-flash.md) | 学完基础后，把整套知识放进真实旗舰模型与集群里端到端串联 |
| **10 历史版本来源快照与开发档案** | 历史基线说明、配置与源码对照档案、PR 剖析与问答记录 | [GLM 基线说明](../sources/glm-5-3-flash-baseline.md) / [v0.30.0rc2 基线档案](../sources/v030rc2-baseline.md) | 核对历史快照与原始改动背景时按需查阅 |
| **11 RFork 权重快载专题** | 独立演进的权重快载机制：新实例直接从已加载权重的进程拉取权重，跳过重复读盘，其余前向与调度不变 | [RFork 总览](rfork.md) | 关注秒级扩容与权重快载架构时单独查阅 |
| **12 additional_config 参数字典** | `additional_config` 下具体参数键的定义、默认值、生效条件与版本差异字典 | 侧栏 **12** 组按分类检索 | 在正文或日志中遇到某个具体配置键名时随手查一条 |

### 异构旗舰双机实战全案（历史 GLM-5.3-Flash 专题）

完成上方 `Qwen3-8B` / `Qwen3-30B-A3B` 入门轨道与 2 题自测后，可以再进入 **09 组 GLM-5.3-Flash 双机 16 卡历史全案**。全案依次串通模型、16 卡部署、单条请求七站、多条并发与代码调用链，按五页顺序读即可：[认识 GLM-5.3-Flash](glm-5-3-flash.md) → [双机部署](glm-5-3-flash-two-node.md) → [一条请求](one-request.md) → [多个请求](concurrent-requests.md) → [代码路径](request-call-chain.md)。该专题含四路残差（mHC）与 5 个混合缓存组等异构特性，属于进阶演练而非入门前置；前四页只需矩阵乘法基础，第 5 页起需要看懂 Python 调用栈。

先记住多卡部署里最常碰到的三个分工名词：

- **TP（Tensor Parallel，张量并行）分矩阵计算**：把同一层的权重矩阵切给多张卡，先按列切、再按行切，算完后把部分和加齐。
- **DP（Data Parallel，数据并行）分请求**：把不同用户的请求分给不同执行组，每组独立维护自己的队列与历史缓存。
- **EP（Expert Parallel，专家并行）分专家**：把 MoE 模型的众多专家摊到多张卡上，哪个 token 选中哪个专家，就发去对应的卡算完再收回。

## 学会分析推理问题：两条进阶实践路线

### 1. 性能、容量与故障排查路线（08 组 + 09 组）

想把原理用于诊断真实的线上慢响应、抖动或精度偏差，可以按下面顺序走一遍完整分析链路：

| 顺序 | 读哪一页 | 读完试着自己判断 |
| --- | --- | --- |
| 1 | [回答为什么停顿](inference-performance-walkthrough.md) | 分块后正在生成的请求少等、新请求多等，这个取舍在什么目标下值得采用？设备早已算完时，为什么应该换排查方向？ |
| 2 | [怎样知道真的变好了](inference-benchmarking.md) | 总输出量没变，但达标请求更多了，能宣布什么？还缺哪些验收口径？ |
| 3 | [设备在算还是在等](inference-performance-analysis.md) | 为什么少算一些输入能缩短单步耗时，切得太小又会反噬？通信时间很长时，怎样区分“等人”和“传输慢”？ |
| 4 | [DeepSeek 生产实践](deepseek-serving-case.md) | 分块以外，拆开 P/D 解决什么？少排的队能否盖住状态交接和缓存搬运成本？ |
| 5 | [容量与恢复](inference-capacity-and-reliability.md) | 从压测表怎样选运行点？少一套实例后会积压多少工作，机器回来为何还没立刻恢复？ |

如果遇到输出内容不对、乱码或和参考结果对不上，可以直接读[输出为什么变了](inference-correctness-troubleshooting.md)（不依赖上面五篇全部读完）。现场救急有两个速查入口：[通用排障](inference-troubleshooting.md)覆盖启动、显存、通信、输出与接口报错；已确认是性能问题则直接查[性能排障](inference-performance-troubleshooting.md)。

### 2. 前沿异构模型与缓存策略路线（09 组 + 03/04 组）

理解了排队、交接和容量之后，可以进一步追问“前沿模型内部到底省了哪些计算与显存”：

| 顺序 | 读哪一页 | 读完试着自己判断 |
| --- | --- | --- |
| 1 | [DeepSeek-V4.1-Flash 模型与状态](deepseek-v4-1-flash.md) | 画出后半层共享 KV 从哪里来、各层滑窗从哪里来；指出长输入省去哪些计算，新 token 仍走哪些层 |
| 2 | [SWA 有界回放](swa-bounded-replay.md) | 在两层均值例子里算出 4 和 6，解释为什么读取相同位置仍可能得到不同结果 |
| 3 | [DSpark](dspark.md) | 数清一轮的 5 行输入和 3 个新输出；根据概率和耗时，判断该给谁多验证一个候选 |
| 4 | [低精度格式](low-precision-formats.md) | 把 2.8 压成四位后读回 3；区分舍入、格式读错和系数错配各自如何影响结果 |

## 四族昇腾硬件怎样承接这些计算

全站围绕**四族昇腾硬件**对照芯片能力与框架适配（硬件与通信软件栈总览见[昇腾硬件设备](hardware-devices.md)与 [CANN 与 HCCL](cann-hccl.md)）：

| 硬件族 | 核心形态与定位 | 在知识库里看哪几页 |
| --- | --- | --- |
| **Atlas 800I/T A2**（910B 家族） | 单卡/单机 8 卡主力推理与双机部署常见平台，机内 HCCS、跨机 RoCE | [昇腾硬件设备](hardware-devices.md)、[AI Core](ai-core.md)、[GLM 双机部署](glm-5-3-flash-two-node.md) |
| **Atlas 800I A3 双 Die** | 双计算 Die 封装与高带宽超节点互连形态，面向大规模 EP 与高并发 | [昇腾硬件设备](hardware-devices.md)、[大规模 EP](large-scale-ep.md)、[MoE 通信派发](moe-comm-dispatch.md) |
| **昇腾 950** | 新一代计算/搬运融合、任务执行卸载、超节点互联与内存池架构 | [昇腾 950：计算与数据搬运](ascend-950-architecture.md)、[昇腾 950：任务执行与互联](ascend-950-execution-interconnect.md) |
| **Atlas 300I Duo / 310P** | 轻量推理卡族，在算子、量化与采样/Runner 侧有独立适配边界 | [昇腾硬件设备](hardware-devices.md)、[昇腾 FlashAttention](ascend-flash-attention.md)、[NPU Model Runner](npu-model-runner.md) |

读新硬件架构时，建议先跟着一块数据的搬运轨迹走，不必死记核数与峰值。还不熟悉片内计算单元时先看 [AI Core](ai-core.md)，还不熟悉跨卡通信时先看[集合通信](collective-communication.md)；建立直觉后，再顺读[昇腾 950：计算与数据搬运](ascend-950-architecture.md)与[昇腾 950：任务执行与互联](ascend-950-execution-interconnect.md)。

## 回到三份参考资料，遇到陌生段落去哪查

如果你在读 DeepSeek 生产文档、DeepInfer 仓库或昇腾 950 白皮书时碰到陌生段落，可以直接按问题跳回站内对应机制页：

| 参考中的问题 | 从这里接着读 | 阅读时试着解释 |
| --- | --- | --- |
| DeepSeek 生产实践：E/P/D、分流与共享缓存 | [生产接力](deepseek-serving-case.md#分流看什么决定了哪些卡会一起等)、[大规模 EP](large-scale-ep.md)、[EPLB](eplb.md) | 请求数相同为什么仍可能等最慢的卡？为什么前缀亲和取决于缓存放在哪里？ |
| DeepSeek 生产实践：扩缩容和故障恢复 | [容量与恢复](inference-capacity-and-reliability.md) | 一张卡故障影响多大范围？机器回来后为何还要消化积压？ |
| DeepInfer：离线吞吐与 profiler 图 | [测量口径](inference-benchmarking.md#读-deepinfer-的性能图先弄清哪些工作被计入) | 哪些 token 是按假设计数的？拼起来的时间线能不能用来量首字等待？ |
| DeepInfer：SWA（滑动窗口注意力）、变长验证、异步与确定性 | [模型状态](deepseek-v4-1-flash.md)、[回放](swa-bounded-replay.md)、[DSpark](dspark.md)、[异步调度](async-scheduling.md)、[批次一致性](batch-invariance.md) | 分别省了计算、验证还是主机空隙？ |
| Recipe 与结构化输出 | [请求入口](api-server-entry.md#换成-deepseek-recipe入口负责到哪里)、[流式输出](streaming-output.md)、[格式约束](structured-output.md) | 普通文本和控制 token 怎么区分？跨片段的字符为什么不能逐段独立解码？ |
| 950 白皮书：计算、搬运与图像处理 | [计算与存储](ascend-950-architecture.md)、[低精度格式](low-precision-formats.md) | 哪一次搬运被省掉？图像预处理与图像模型分别做什么？ |
| 950 白皮书：通信、超节点与资源池 | [执行与互联](ascend-950-execution-interconnect.md#接入内存池以后模型就能直接多留历史了吗)、[KV Pool](kv-pool.md) | 硬件能访问远端资源以后，软件还要怎样找到并用上正确的历史？ |

遇到外部资料的配置或性能数字，先保留它的模型、硬件、版本与测量条件再与本站比较。例如 DeepInfer README 列出上下文并行（CP，把同一条请求的上下文位置分给多张卡）能力，而该快照的生产部署问答说明线上暂未使用 CP；引擎支持一种能力与某套服务实际采用它，是两件事。

## 怎么用这个知识库

- **术语风格**：vLLM、Ascend 与论文中有固定名字的组件保持英文原名（如 `KV cache`、`block table`、`All-Reduce`），与源码和报错日志一致；首次出现时都会配一句白话中文解释。
- **页末「对照源码」区**：首次阅读可专注前半段机制与图示；需要配参数、查报错、比对不同版本差异或翻源码时，展开页末默认折叠的「对照源码」即可。
- **四大交互工程实验室**：站点顶部导航的「工程实验室」内置四套与源码规则联动的交互工具，读完对应章节就能动手试算：

| 工程实验室 | 解决什么工程问题 | 建议配合阅读 |
| --- | --- | --- |
| **① 部署算账台** | 输入模型、硬件族与并发目标，估算权重占用、冷启动显存余量、KV 块预算与并行拓扑 | [KV 缓存显存画像](kv-cache-memory-profiling.md)、[Tensor Parallel](tensor-parallel.md) |
| **② `vllm serve` 配置体检器** | 静态联检单实例或 P/D 分离的 CLI 与 `additional_config` 组合，提前发现互斥、图融合与内存风险 | [核心 CLI 参数](core-cli-params.md)、[AscendConfig 配置系统](ascend-config-system.md) |
| **③ 交互式排障工作台** | 按报错日志与时序做现象分流，给出最小首取证据与对照实验 | [通用排障](inference-troubleshooting.md)、[性能排障](inference-performance-troubleshooting.md) |
| **④ AI Core 算子实验室** | 对比 910B 与 950 的 Cube/Vector 算子流水线与数据搬运重叠泳道 | [AI Core](ai-core.md)、[昇腾 950：计算与数据搬运](ascend-950-architecture.md) |

- **接着看、搜索与问答**：每页底部「接着看」推荐下一步页面；按 `Cmd/Ctrl+K` 可全文检索术语、报错或参数名；右侧「问答」面板支持直接提问或粘贴报错，附带来源与原文链接。

## 对照源码

### 版本差异

为兼顾最新正式版演进与完整多机案例的跨页自洽，全站区分三套版本基线范围，阅读源码与核对默认值时请先确认当前页所属范围：

1. **全站默认主基线（`v0.30.0`）**：对齐 `vllm-ascend@c09d3e20` + 配套 `vllm@ced6857a`，标准教学标尺采用 `Qwen3-8B`（Dense GQA）与 `Qwen3-30B-A3B`（MoE）。
2. **`RFork` 权重快载专题（11 组）**：独立演进的权重快载实现，目标主基线对齐社区上游 `vllm-ascend@8d6180e2`（`main`），详情见 [RFork 总览](rfork.md)。
3. **历史 GLM-5.3-Flash 双机绑定算例（09 组 GLM 四页及含冻结 3D 场景的绑定算例）**：继续钉住原审定镜像 `vllm@0fc695fc`（`VLLM_TAG=v0.23.0`）+ `vllm-ascend@db701c1f`（双机 `2×A2×8 TP8/DP2/EP16 W8A8`），保持跨页形状、字节与通信账单自洽，不与 `v0.30.0` 的 Qwen3 数字混算。**待核：**容器内最终安装的上游 vLLM 产物需逐项比对。详见[来源基线](../sources/glm-5-3-flash-baseline.md#镜像固定与源码对应)。[!]

各机制页文末「版本差异」统一对照以下四条正式固定快照（历史过渡期快照 `v0.30.0rc2` `7d825229` 归档于[rc2 基线档案](../sources/v030rc2-baseline.md)）：

| 分支 | 固定的代码版本 | 阅读时怎么用 |
| --- | --- | --- |
| `v0.23.0` | `vllm-ascend@2c59ff10`（`releases/v0.23.0`）；配套 `vllm@0fc695fc` | 查旧维护分支特性与默认值；09 组 GLM 全案执行侧另见专用镜像 `db701c1f` |
| `v0.26.0rc` | `vllm-ascend@2ed6cbba`（`releases/v0.26.0rc`）；配套 `vllm@568afb3a` | 查 v0.26 发布分支的特性、默认值与演进分叉 |
| `v0.30.0`（主基线） | `vllm-ascend@c09d3e20`（`releases/v0.30.0`）；配套 `vllm@ced6857a` | **全站默认主基线**：查当前正式版行为、配置入口与 Qwen3 标尺 |
| `main` | `vllm-ascend@8d6180e2`；配套 `vllm@ba15685a` | 查上游最新开发分支演进（含 MRV2 迁移与新特性），不反向覆盖 `v0.30.0` 正式版行为 |

### 源码位置

- 证据角标含义：`S` 官方文档或论文、`C` 固定 commit 源码、`M` 离线可复现实测、`D` 推导、`A` 教学假设、`I` 推断或本站编排、`!` 版本冲突、实验状态或禁配；仅集中出现在页末「对照源码」核验区。
- GLM 模型层数 45、隐藏维度 4096、词表 154880 等配置见模型页及官方配置 [S1]；阅读顺序、01–12 分组入口与两条起步路线为本站编排 [I]。
- DeepInfer 固定 README 的 Supported features 列出 balanced CP [S2]；同快照部署问答的 Inference system overview 说明所述生产部署暂不采用 TP/CP [S3]。两者适用范围不同，不能将其中一项改写为另一项的否定。
