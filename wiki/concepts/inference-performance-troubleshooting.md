---
id: inference-performance-troubleshooting
title: 性能排障：找到等待以后，怎样选优化办法
type: concept
origin: gap
summary: 从排队、长执行步、主机空隙、缓存压力、通信偏斜和返回等待六条证据路径选择优化实验；同时解释无故障时怎样提高吞吐、压低长尾、节省内存与比较并行策略。
aliases:
  - 推理性能优化
  - 首字慢
  - 吞吐低
  - 长尾延迟
  - 并发高变慢
  - 主机瓶颈
  - KV 抢占
  - 通信瓶颈
  - 负载偏斜
  - 性能优化排查
  - 推理调优
  - 并行策略选择
  - 图优化
  - 没有提速
  - 单位卡产出
  - 性能瓶颈排查
  - 延迟优化
  - 吞吐调优
chapters:
  - '19'
order: 5
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L416'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996'
  - 'vllm@0fc695fc:docs/configuration/optimization.md#L41-L62'
  - >-
    https://docs.vllm.ai/projects/ascend/en/main/developer_guide/performance_and_debug/service_profiling_guide.html
  - >-
    raw:sha256-9a505e371ad9cac4f50bfdeb032e492d47015235f0b895f1dbee4633f0f4c326.md#L1-L206
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/model_runner_v1.py#L2914-L2996
  - >-
    raw:sha256-3e27f506a54dd667865dd7464a2a928d626d75896ef7442f2fc6695208165fd5.md#L1-L292
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L569-L587'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L624-L656'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1223-L1251'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L565'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L940-L962'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L555'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1034-L1056'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L498-L518'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L567-L666'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1230-L1252'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L664-L785'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1317-L1348'
relations:
  - to: inference-performance-walkthrough
    kind: builds-on
    note: 先看输出停顿的完整故事，本页用于现场按证据选择其他路径
  - to: inference-benchmarking
    kind: builds-on
    note: 保持负载、计时、失败统计和冷暖状态可比较
  - to: inference-performance-analysis
    kind: builds-on
    note: 用资源成本与关键路径判断局部收益能否影响用户等待
  - to: inference-troubleshooting
    kind: builds-on
    note: 有异常退出、输出错误或版本问题时返回总入口分流
  - to: concurrent-requests
    kind: builds-on
    note: GLM 批次与执行路径的数字统一回到多请求页
  - to: tensor-parallel
    kind: builds-on
    note: 比较并行方案时，核对矩阵分片和新增通信
  - to: data-parallel
    kind: builds-on
    note: 比较单位卡产出时，先明确请求怎样分组以及组间依赖
  - to: expert-parallel
    kind: builds-on
    note: 核对专家放置和逐卡容量，不把总显存当作每张卡可用容量
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: '2026-11-24'
rawSources:
  - >-
    raw/sha256-3e27f506a54dd667865dd7464a2a928d626d75896ef7442f2fc6695208165fd5.md
  - >-
    raw/sha256-cbea3138f689d2e0c2616e9c0f68b78f616fb8e3df66d36f4666d0d437b45f72.md
---

**性能优化是在找到主要等待以后，用一个可比较的实验，检查某项改动是否减少了这段等待。** 每次同时记录收益和代价，才能判断它适不适合当前服务。

本页是现场查阅入口。已经读过[贯穿样例](inference-performance-walkthrough.md)时，可以直接按记录进入下面六条路径；尚不清楚慢在哪里，先保留客户端、调度、设备和返回的关联记录。

## 同样是慢，为什么不先找一个参数调大

三条请求都迟迟没有开始回答，原因却可以不同：第一条大部分时间在队列里，第二条主要耗在设备计算，第三条早已算完、内容却堵在返回途中。图中把每条请求的时间依次切成“等调度、执行、返回”三段。先找到最长的一段，才能选一个能检验原因的动作。

后文说的“一步”，指调度器选出一组请求后执行的一轮。模型用 **token（词元）**表示文本；处理提示词叫 **prefill**，利用历史继续生成叫 **decode**。增加一步容纳的输入，可能让长提示词更集中地算完，却也让同批正在回答的请求等得更久。它能影响图里的执行段，却不能直接消除代理把输出暂存起来的等待。

这里有几个核心时延指标：**TTFT**（Time to First Token）是提交请求到收到首个输出 token 的等待时间，**ITL**（Inter-Token Latency）是相邻两个输出 token 之间的间隔，**TPOT**（Time Per Output Token）是首字之后平均每个输出 token 的耗时。启用 chunked prefill（将未完成的提示词计算分配到多轮调度）时，所核上游文档给出的调优方向是：较小的每轮 token 预算减少同轮 prefill 对 decode 的拖慢，有利于 ITL；较大的预算让一轮处理更多提示词位置，有利于 TTFT。实际效果取决于负载，应分别测量这些指标。

```wiki-diagram
file: inference-performance-choice
```

因此，先把“慢”放到一个位置：没轮到计算、计算本身长、设备没有及时拿到任务、在等其他卡，还是算完以后没有送到客户端。完整的停顿故事见[贯穿样例](inference-performance-walkthrough.md)；这里沿不同证据继续走。

## 先给这次实验写一个能被推翻的判断

[贯穿样例的实验](inference-performance-walkthrough.md#怎样验证是长提示词拖慢了回答)已经完整演示长输入分块：旧回答少等，新请求的首字多等。这里换一类证据，避免遇到任何“慢”都去缩小预算。

假设某请求从 0 ms 入队到 800 ms 才开始计算，计算用 50 ms，返回用 10 ms；同类请求在低负载下的计算也约 50 ms。以下时间均为**教学示意**。这次主要等待发生在开算之前，因此先检验“到达工作超过可用能力”，同时观察是否只集中在一个执行组。先只看这条请求，暂时固定排队与返回时间，算计算减半的直接收益（教学示意）：

$$T_{\text{原}} = 800 + 50 + 10 = 860\text{ ms}, \qquad T_{\text{算减半}} = 800 + 25 + 10 = 835\text{ ms}, \qquad \Delta T = 860 - 835 = 25\text{ ms}$$

| 阶段拆分（单请求排队主导·示意） | 当前基线 | 仅把计算缩短一半 | 固定其余等待时节省 |
| --- | --- | --- | --- |
| 排队 + 计算 + 返回 | $800 + 50 + 10$ | $800 + 25 + 10$ | — |
| 端到端等待 | **860 ms** | **835 ms** | **25 ms** |

持续负载下，计算加速还可能提高服务率，进一步缩短队列，因此 25 ms 不是整体收益上限。这个小账的作用是提醒我们：除了计算时间，还必须观察排队怎样变化。

保持请求组合和配置，单独降低到达速率后，若排队降到 100 ms、计算仍约 50 ms，说明调度前的容量压力值得继续调查。这是减少负载得到的缓解，不能冒充同负载下加速。要保持原到达量，下一步再区分总容量不足与路由偏斜，选择扩容或重新分配工作，并回到原负载验收。

若到达量降低后仍只在一个组长时间等待，就削弱“整体都忙不过来”的解释，转查分配与该组状态。假设另一组还有空闲，且慢组持续收到更多长输入，那么下一次实验应固定总到达量、调整分配，看两组队列是否一起改善。若两组都随负载上升而积压，就应转向总容量与服务目标；只有总请求条数，没有长度和逐组记录，还无法在这两者之间作判断。

每次实验都保留输入、输出要求、缓存条件及实际路径；主动改变一个条件，再回原条件复测，才能发现机器负载漂移或伴随变化。下面六条路径各从一个已观察到的阶段进入：只读符合现场记录的一条，再沿链接查机制即可。

排查沿同一条请求的阶段顺次取证，站点与[一条请求的七站](one-request.md#一条请求要走过七站)一致。其中 **Scheduler** 安排每步工作，**ModelRunner** 整理输入并组织执行，**worker** 管理设备进程，**抢占**指缓存紧张时暂停请求、让出缓存后续再恢复或重算（阶段证据流见[性能排障实战](inference-performance-walkthrough.md#现场怎样拿到这些记录)）。下方的六阶段锚定图把这些阶段直接映射到最小首取证据、单变量实验与必检代价边界：

```wiki-diagram
file: inference-performance-troubleshooting-fig-funnel
```

## 请求还没轮到计算：先分到达过多和分配不均

- **适用现象与首取证据**：首字慢且服务记录显示主要时间在等待队列。保留计划/实际到达速率、输入长度、输出长度、活跃数、逐组队列和进入首个执行步骤的时间——请求数量相同，长短差异也能让一组承担更多工作。
- **区分实验**：固定请求集合，降低到达速率，观察队列是否消退、首字是否随之恢复。若是，就获得了等待与负载相关的证据；但还要区分持续超出处理能力、突发积压和路由偏斜，不能只凭一次降压有效就认定总容量不足。**DP** 把请求分给不同执行组；若总资源有余而单个组持续积压，比较分组后的工作量与路由规则，沿 [DP 请求路由](dp-request-routing.md)与[负载调度](balance-scheduling.md)继续查。
- **可选动作与代价边界**：按业务目标限制进入量、调整路由、控制批预算或扩展容量，每项都要验证成本与失败处理。降低到达量改善延迟，不能宣传为同负载下的引擎加速；扩卡还会改变通信和模型布局，先沿[并行策略](tensor-parallel.md)核对可行性。

## 已经安排，但每一步都很长：先看这一批做了什么

- **适用现象与首取证据**：单步设备时间变长，或 decode 与长输入同批时出现停顿。记录该步 prefill/decode 位置数、历史长度、实际批形状、算子时间和执行方式。**算子**是设备执行的一项运算；**attention** 让当前位置读取、汇合相关历史信息。长输入增加当前工作量；长历史增加某些 attention 读取；更大的批次还会改变执行路径。
- **区分实验**：固定输入与到达表，只控制每步预算，确认实际分块和设备步骤长度是否改变。若长步随分块缩短，继续按首字、输出间隔、吞吐和失败数评估；若主要成本随历史长度增长，沿 [attention 成本](attention-cost.md)找实际读取对象。计算与读取谁更紧，使用[性能模型](inference-performance-analysis.md)判断，不能只凭设备利用率选量化或加卡。
- **预算与算子边界**：预算表示每轮可安排的工作量，预算翻倍不能推出服务快一倍。上游文档还给出以吞吐量为目标的尝试方向：尤其对于大 GPU 上的较小模型，可尝试大于 8192 的每轮 token 预算——这个条件不能直接转成 GLM 双机 NPU 的推荐值，批次变大后单轮耗时、输出间隔和总轮数都要实际测量（若涉及流水线并行下的动态分块，另见 `v0.30.0` 的 [`profiling_chunk_config`](../params/profiling-chunk-config.md) 参数页，注意该特性已在 `main` 移除）。**量化**用较少位数表示数值，能改变数据量与计算路径，但同时需要验证输出质量及支持的算子；**speculative decoding** 先猜多个后续 token 再验证，收益取决于接受数量和验证成本，候选数增长不等于实际产出增长（深入机制分别见[量化](quantization.md)与[投机解码](speculative-decoding.md)）。
- **真机反直觉负扩展对照**：切勿在未取设备轨迹时盲目堆并行或拆池——例如在 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md) 中，固定 `u=0.85` 将 `Qwen3-8B` 从 `TP=1` 扩至 `TP=8` 时，`c=1` `TPOT` 反而从 `78.54 ms` 升至 `94.42 ms`（每卡本地 KV 增大叠加非连续整池 `Slice` 候选机制与行并行 `AllReduce`）；而 `Qwen3-30B-A3B` 在 `4P4D` 叠加 `--enforce-eager` 等配置下 `c=1` `TPOT` 相对四卡混部图模式恶化 `3.952×`（`77.90 → 307.83 ms`）。

## 设备两段工作之间空着：它在等主机还是等依赖

- **适用现象与首取证据**：设备时间线反复出现空隙，而单个算子并不突出。保留主机输入准备、任务提交、设备就绪/开始及结果回传的时间；CPU 提交完成不等于设备依赖已经满足，先按[关键路径](inference-performance-analysis.md#时间线怎样告诉你应该先优化哪一段)区分。
- **区分实验与杠杆**：若空隙前主机仍在整理输入，在固定设备路径下检查 CPU 竞争和输入准备，再按现场条件比较 [CPU 绑定](cpu-binding.md)或[异步调度](async-scheduling.md)；若主机已经提交而设备仍等其他任务，先追那个依赖，不能把空隙统称为 CPU 瓶颈。**graph mode** 通过预先捕获并重放执行流程来省去逐算子下发。启用它后，应先核实实际命中了图、哪些尺寸回退，再看主机空隙与端到端指标是否同步下降（图的资源占用、补齐与支持条件见[图模式分层](graph-mode-layer.md)、[ACLGraph](acl-graph.md)及 [NPUGraph-ex](npugraph-ex.md)；若在旧版脚本中看到 [`weight_prefetch_config`](../params/weight-prefetch-config.md)、[`multistream_overlap_gate`](../params/multistream-overlap-gate.md) 或 [`enable_async_exponential`](../params/enable-async-exponential.md) 等早期副流重叠开关，须先按对应参数页核对其在 `v0.30.0` 是否已移除，避免触发严格配置拒收）。
- **阶段判别边界**：判断阶段要结合提示词计算进度，不能只数本轮 token——PD 交接时，一个 token 的块仍可能属于 prefill；启用投机解码时，尾部提示词块也可能恰好具有验证批次的宽度。固定镜像在投机路径中先检查全部提示词是否已算完，再判断整齐 decode；最终图模式还要经过分派与 DP 协调。

## 缓存紧张，暂停和重算越来越多

适用于活跃请求增加后空闲块很少、抢占增多、单请求反复被暂停。**KV cache** 保存已计算的历史，避免后续重算。收集逐时点的活跃长度、空闲块、请求暂停与恢复、重算位置数和实际内存占用，先分容量不足与其他阶段的等待。

保持模型、精度与路径，先降低并发，或单独控制长输入比例。若抢占和重算下降、等待随之恢复，支持缓存压力这条路径。随后再比较并发限制、最大长度、缓存预算或适用的缓存精度/卸载方案。预算增加会挤占图、通信和临时内存，卸载会增加搬运，不能把“缓存块更多”当作无代价提升。

具体容量计算只在[部署预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护；探测与运行峰值见[显存探测](kv-cache-memory-profiling.md)，迁移代价见[KV 分层卸载](kv-cache-layerwise-offload.md)。未出现缓存压力而单步计算长时，先回上一分支，不先放大缓存。

## 多卡一起慢：先找最后到达的那张卡

适用于跨卡区间长、少数卡明显更忙，或换并行规模以后吞吐下降。记录同一通信组、同一次交换、各 rank 的设备侧到达与完成；**rank** 是参与分布式执行的进程编号。**专家**是模型按输入选择来执行的子网络。另记每组请求的工作量，以及每个专家实际收到的 token 数，二者分别说明请求分流和专家分配。

如果其他卡一直等某一张卡，先控制这张卡之前的工作量，看等待是否随之减少；这能区分迟到与交换本身慢。若参与者都已具备条件，则固定交换规模核对拓扑、链路和并行通信。机制见[集合通信](collective-communication.md)，解释等待的方法见[关键路径](inference-performance-analysis.md)。

请求偏斜去查 [DP 路由](dp-request-routing.md)，专家偏斜去查 [EPLB](eplb.md)，即调整专家放置或副本以缓解不均的机制。移动专家也有开销、支持范围和触发条件；单次短窗口偏斜不代表应立即重排。比较并行方案时，既计减少的本地计算，也计新增通信和各卡容量——例如在 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md) 中，`Qwen3-30B-A3B` 在 `c ≤ 16` 负载下从 `TP=4+EP=4` 扩到 `DP=2+TP=4+EP=8` 后，单卡权重虽降 `47.32%`，但跨 DP 通信、低并发分流与前缀命中率下降使总吞吐反而从 `179.70` 降至 `149.45 tok/s`。

## 设备算完了，客户端却还在等

适用于引擎已有输出，而首个可见文本或后续片段很晚才到。保留引擎输出、前端解码/发送、代理收到/转发、客户端读到的同一请求记录。一次流式片段可以携带多个 token，不能仅从片段稀疏推断模型推进慢。

先对同一服务做可控的直连与代理路径比较，保留原始响应；若直连正常、经过代理后才堆积，继续查缓冲与连接处理。若前端本身取走结果不及时，查 CPU、输出合并和解析；若内容被停止字符串或工具解析器暂存，按[流式输出](streaming-output.md)的规则判断预期行为。随机生成时两次文本本来就会不同，路径比较应固定输入与生成条件。

调整发送频率会在客户端连贯性、CPU 开销和消息数量间取舍。验收应同时观察首个答案内容与整体输出，不能把空角色片段更早到达当作用户已看到答案。

这里可以做一个方向检验：预算改小后设备步已经变短，客户端间隔却没变，是否继续调预算？应先把同一份输出沿“引擎交出→服务发送→代理转发→客户端读取”追完。[通用入口的超时例子](inference-troubleshooting.md#把没反应变成能继续查的一条记录)展示了如何用保存的响应流复现返回等待，避免每次对照都重新生成一段不同答案。

## 没有故障，怎样选择下一项优化

没有报错，也可以用同一套证据工作。先看清“排队主导时只提速计算为何杯水车薪”以及“单改一个参数如何牵动后续路径”，再按四类优化目标核对收益与必检代价，避免把所有特性一起打开：

```wiki-diagram
file: inference-performance-troubleshooting-fig-tradeoffs
```

| 目标 | 先量什么、怎样比较 | 必须一起验收的代价 |
| --- | --- | --- |
| 提高吞吐 | 固定业务输入与到达方式，逐档比较批量/预算；确认有效输出和达标请求增长 | 首字、输出间隔、失败数、峰值内存 |
| 压低长尾 | 按输入/输出长度分组，定位最慢请求的阶段，再控制长短请求相互影响 | 不能靠拒绝或丢弃慢请求制造 P95 改善；统计所有结局 |
| 节省内存 | 分清权重、历史、图与临时空间，选择可用的量化、长度限制或卸载实验 | 任务质量、传输时间、重算与峰值变化 |
| 选择并行策略 | 固定模型与质量要求，比较每卡容量、单步关键路径、实际负载和单位资源产出 | 通信增长、放置限制、路由与故障范围 |

**goodput（达标请求吞吐）**是每秒成功且满足约定目标的请求数，目标和统计口径见[推理测量](inference-benchmarking.md)。若改动提高总吞吐却降低达标吞吐，应按用户目标判断，不把更大的数字自动当成胜出。

## 放到 GLM 双机，单个参数会牵动哪些路径

上面六条分支同样适用于标准 `v0.30.0` 部署（如 `Qwen3-8B` / `Qwen3-30B-A3B`）；若落到例外 B 的[GLM-5.3-Flash 固定双机部署](glm-5-3-flash-two-node.md#部署前提)（TP8 分矩阵、DP2 分请求、EP16 分专家），还需要额外盯住跨组联锁。长输入使批次变大时，不仅计算量变了，图选择、补齐与专家通信方案也会随条件变化。另一组即使请求少，仍要参与共同的专家计算。

因此 A/B 记录除了主动修改的预算，还要保存实际执行尺寸、图模式、专家通信方案、各组工作量以及 MTP 候选/接受数量；**MTP** 是模型猜测后续 token 后再验证的路径。每项门槛及场景 M 的数字继续复用[多请求页](concurrent-requests.md)，不在这里再推一套。

“这项配置在这类负载下改善了等待”可以由匹配的 A/B 支持；“收益完全来自某个算子”还需要对应路径证据。当前页面没有目标 NPU 的实测改善比例。

## 常见误解

- **“每次只改一个参数，就只有一个机制变化。”** 参数跨过门槛后会连带改变批形状、图和通信路径，必须一起记录。
- **“关掉图后问题消失，就用这组结果报告优化收益。”** 定位实验改变了路径；最终收益要在目标运行配置下复测。
- **“知识库应该给出一组通用最佳参数。”** 目标、负载、模型与版本决定取舍；可靠的答案应给出条件、证据和实验。

## 对照源码

### 怎么开

配置入口放在对应机制页，本页只决定先检验哪条路径。每次保存原配置、最终生效值、实际触发路径和恢复方式；先小范围复现，再按同一负载复测。

需要补齐请求、批次和设备记录时，复用[贯穿样例的最小取证步骤](inference-performance-walkthrough.md#怎么开)，先确认缺哪一段，再启用相应采集。

### 会报什么错

若同时出现 OOM、worker 退出或通信错误，先按[总入口](inference-troubleshooting.md)处理失败阶段。成功样本变快但失败增多，不能认定优化通过。

### 开销和什么时候别开

细粒度日志与 profiler 单独用于解释；收益测量回到未采集状态。路径切换和资源缩减在可控环境进行，调试实验、临时缓解和最终修复分别记录。

### 版本差异

**跨版本排查性能回归时，除遵循单项实验与六阶段取证方法外，还必须把最终配置、实际 runner（MRV1 vs MRV2，历史过渡边界见 [v0.30.0rc2 快照说明](../sources/v030rc2-baseline.md)）与 KV 显存预算后处理链路一并记入实验档案。** 在 `v0.30.0` 及 `main` 中，显式 `kv_cache_memory_bytes` 仍跑 `profile_run`，但不走按利用率自动算预算的相同分支，而是继续应用多组缩放、稀疏 KV 卸载与 [`kvpp_config`](../params/kvpp-config-0445bd352140.md)（KVPP）约束；PCP 权重分片与 SFA C8 也会同时牵动通信与显存布局，单个“可用字节数”不能直接跨版本对比请求容量；旧 GLM 的图/MTP/MC2 账单仍锚定固定镜像 `db701c1f` 不随之重算。

| 核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| Runner 路径与主机空隙取证 | 仅 MRV1（`model_runner_v1.py`） | 仅 MRV1（`model_runner_v1.py`） | 默认 MRV1，`use_v2_model_runner` 可选切 MRV2（`worker.py#L498-L518`） | MRV2 唯一路径（`worker.py#L589-L618`），常驻设备缓冲与异步调度路径不同 |
| KV 显存预算计算（`determine_available_memory`） | 基础利用率扣除权重/激活/非 torch（`worker.py#L527-L565`） | 延续基础探测（`worker.py#L511-L555`） | 叠加多组缩放、KV 卸载与 KVPP 预算裁剪（`worker.py#L567-L666`） | 同 `v0.30.0`，并扩展 `_get_gpu_memory_utilization()` 与 HiSparse 显存统计（`worker.py#L664-L785`） |
| 剖析器入口（`NPUWorker.profile`） | 惰性构造 `TorchNPUProfilerWrapper`（`worker.py#L940-L962`） | 同左（`worker.py#L1034-L1056`） | 同左（`worker.py#L1230-L1252`） | 同左，兼容 MRV2 调用链（`worker.py#L1317-L1348`） |
| 现场方法复用与边界 | 六类取证方法可复用；GLM 专用分支见 `db701c1f` | 方法可复用；参数默认值与新特性查对应机制页 | 方法可复用；须同步记录最终 runner、多组/卸载/KVPP 预算 | 方法可复用；结合 MRV2 与在线采集指南核对现场包 |

### 源码位置

- 四版 `vllm-ascend` Worker 的 runner 选择、KV 显存预算探测与惰性剖析入口实核：`2c59ff10:worker/worker.py#L527-L565`、`#L940-L962`；`2ed6cbba:worker/worker.py#L511-L555`、`#L1034-L1056`；`c09d3e20:worker/worker.py#L498-L518`、`#L567-L666`、`#L1230-L1252`；`8d6180e2:worker/worker.py#L589-L618`、`#L664-L785`、`#L1317-L1348` [C16][C20]。
- 调度预算与已算/待算位置的关系 [C1]；固定 GLM 执行图和尺寸分派入口见来源 2、6 [C2]。图复用已审查的贯穿样例，函数链只在[请求调用链](request-call-chain.md)维护；若同时伴随异常退出或版本配置回归，返回[推理排障入口](inference-troubleshooting.md)分流。
- 缩小分块预算对 TTFT、ITL 与吞吐的取舍见固定版[优化文档](https://github.com/vllm-project/vllm/blob/0fc695fc/docs/configuration/optimization.md#L41-L62)（来源 3，前提是启用 chunked prefill；其中大于 8192 的建议指向大 GPU 上的较小模型，不是 GLM 双机 NPU 的最优预算或收益实测）[S3]。
- 采集入口见[官方 Profiling 指南](https://docs.vllm.ai/projects/ascend/en/main/developer_guide/performance_and_debug/service_profiling_guide.html) [S4]。
- 排队时间与局部加速数值为教学假设 [A]，耗时相加为推导 [D]；六类分支与无故障优化表是本站依据机制组织的实验方法 [I]，是否适用需现场基准与正确性结果。
