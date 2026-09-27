# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 131 页。

## 概念（concept）
- [AI Core：计算单元与数据搬运](concepts/ai-core.md) — 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路径理解计算与访存的配合。 `07`
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md) — 模型层定义注意力机制，后端实现把该机制与缓存布局、批次元数据和设备算子连接起来。以 GLM 的稀疏 MLA 和 KDA 两条路径说明为什么不能只用一个通用后端名称代表整个模型。 `09 16`
- [注意力代价：容量、计算与访存](concepts/attention-cost.md) — 注意力结构改变保存的历史、查询范围和运算形状；逻辑容量可以由维度推导，实际分配、HBM 流量和耗时需要结合缓存管理、内核及工作负载分析。 `04`
- [注意力与 Q/K/V：从位置间评分到信息汇合](concepts/attention-qkv.md) — 点积注意力用 Q 与 K 计算位置间分数，经掩码与 softmax 得到权重，再汇合 V；多头、历史缓存及稀疏选择决定这段计算如何组织。 `04`
- [块表：从序列位置找到缓存槽位](concepts/block-table.md) — 块表把请求的逻辑块映射到物理块；分页寻址先求逻辑块和块内偏移，再定位物理槽位。混合模型的缓存组可采用不同规格与映射。 `11`
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md) — 从两个 rank 的张量交换区分通信语义、框架接口、通信库和物理链路，再定位 Ascend Worker 的初始化与调用。 `07 09 08`
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md) — 集合通信定义一组参与者的输入如何变成各自的输出。用同一组小张量区分拼接、求和、分发和定向交换，再理解 TP、DP、PP、EP 等并行策略。 `12`
- [多条请求：在官方双机部署上一步怎样装下它们](concepts/concurrent-requests.md) — 沿场景 M（DP0 上 12 条请求在 decode 时来了一条 6000 token 的新请求，DP1 上 7 条在 decode）和 DP1 空闲的变体 M′，在官方双机部署上看多条请求时每一站多出来的事：选组、分预算、拼输入、抢占、图尺寸补齐与两组对齐、MoE 从 MC2 翻到 All-Gather、空闲组陪跑。 `00`
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md) — CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。 `07 09`
- [嵌入：token 编号如何变成输入向量](concepts/embedding.md) — 嵌入按 token 编号从训练好的权重表中选取向量。GLM 文本嵌入的逻辑形状为 [154880, 4096]，本轮 4 个输入编号得到 [4, 4096]；后续层再结合位置与上下文更新表示。 `01`
- [进程与执行器：前端、EngineCore 和 Worker 如何协作](concepts/engine-processes.md) — 组件职责决定保存什么状态，执行器与并行配置决定它们放在哪些进程。区分逻辑角色、进程地址空间、共享内存和设备 rank，避免仅按 NPU 数猜服务进程总数。 `10`
- [HCCL 缓冲区：通信组预算与配置优先级](concepts/gap-a5164fe10fa9184412f8.md) — 区分通信张量和运行缓冲，沿建组流程解释默认组、DP、EPLB 与 MC2 的配置差异，并将缓冲预算公式与真实消息布局分开。 `13`
- [认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来](concepts/glm-5-3-flash.md) — GLM-5.3-Flash 模型形状的唯一出处：45 层里 34 层 KDA、11 层稀疏 MLA，四条 residual 流，前 3 层稠密 MLP、其余 42 层 288 选 8 的 MoE，外加 1 个 MTP 层；每种层先讲它从哪个基础机制演变来，再给 GLM 的具体维度、参数量与权重精度。 `00`
- [GQA：查询头如何共享 K/V，改变哪些开销](concepts/gqa.md) — GQA 让一组查询头共享 K/V，减少 K/V 投影宽度和缓存容量；查询头仍分别评分与汇合，实际访存和速度取决于内核、并行方式与工作负载。 `04`
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md) — 从芯片、板卡到服务器和机柜，区分物理层级、网络连接与软件可见设备，再对照 GLM 官方双机实例理解部署规模。 `07 08`
- [推理缓存：跨轮保存哪些历史状态](concepts/kv-cache.md) — 推理缓存保存后续计算所需的历史状态。GLM-5.3-Flash 同时维护 MLA 潜向量、索引及尾状态、KDA 递推与卷积状态，其增长和复用方式不同。 `04 05`
- [显存容量：从运行开销算出缓存预算](concepts/kv-cache-memory-profiling.md) — 区分权重、激活、运行时与持久缓存，解释启动 profiling 如何估计缓存预算，以及预算为什么不能直接换成固定并发数。 `11`
- [缓存规格：把模型状态转成页与缓存组](concepts/kv-cache-spec.md) — 缓存规格声明状态形状、精度与页大小，供容量规划、分组和设备张量创建使用。GLM 的主潜向量、索引、尾状态与 KDA 需要联合规划。 `11`
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md) — 模型层逐步更新本轮输入的隐藏表示。GLM 文本主干包含 45 层，注意力与前馈类型按层号配置；层间使用四路残差表示，末层汇合后再经归一化和输出投影产生词表分数。 `03`
- [阅读指南：这个知识库讲什么，按什么顺序读](concepts/learning-guide.md) — 知识库入口：模型固定为 GLM-5.3-Flash、部署固定为官方双机 16 卡，沿「一条请求」读完五页主线，再按问题展开各分组；另有术语、证据角标与问答侧栏的用法。 `00`
- [KDA：通过递推状态处理序列](concepts/linear-attention.md) — GLM-5.3-Flash 的 KDA 层用按通道衰减、误差更新和查询读出维护矩阵状态，另保留短卷积历史；Prefill 与 Decode 分别使用适合批量和递推的执行路径。 `04`
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md) — 矩阵乘用同一组权重变换本轮各 token 的表示。本页从行与列的乘加展开 GLM 的前馈投影，区分参数个数、运算量和实际访存，并说明批内权重复用的含义。 `02`
- [MLA：压缩历史表示与稀疏检索](concepts/mla.md) — MLA 用共享潜向量表示每个位置的 K/V；GLM-5.3-Flash 的稀疏层在此基础上增加索引和候选选择，主缓存、索引缓存与计算开销分别计量。 `04`
- [前馈、残差与 RMSNorm：模型子层如何更新表示](concepts/mlp-residual-norm.md) — 门控前馈网络沿两条投影分支变换特征，残差连接保留输入路径，RMSNorm 按向量均方根调整尺度。结合 GLM 的实际宽度与四路连接，理解各部件的输入、输出和作用。 `03`
- [MoE：专家选择、并行计算与结果聚合](concepts/moe.md) — MoE 让每个 token 选择部分前馈专家参与计算。以 GLM 的 288 选 8 和共享分支为例，区分专家编号、组合权重、批次负载以及模型结构与专家并行部署。 `06`
- [NPUModelRunner：组织批次、模型前向与采样交接](concepts/npu-model-runner.md) — NPUModelRunner 将调度计划转成设备输入，管理本轮模型执行及跨调用中间结果，再将采样结果映射回请求。用 A/C 四输入、两预测行的例子连接张量形状与接口职责。 `09`
- [一条请求：在官方双机部署上从提示词走到回答结束](concepts/one-request.md) — 沿一条 4 个 token 的示例请求 R1，在两台 Atlas 800 A2、DP2×TP8、EP16、MTP 草拟 3 个的官方部署上走完七站：入口、调度、准备输入、45 层前向、采样与草拟、结果更新、返回收尾；每站给出每张卡上的形状、次数和字节数。 `00`
- [从 RMSNorm 到设备 kernel：分派、融合与分块](concepts/op-to-ai-core.md) — 沿 GLM 的 RMSNorm 追踪实际设备接口，再用可选的残差融合分支解释 Host tiling 与设备核函数，区分数学语义、数据访问和性能证据。 `16`
- [Prefill 与 Decode：输入如何变成连续输出](concepts/prefill.md) — Prefill 处理已知输入并产生首个输出 token，普通 Decode 逐步输入上一次生成的 token；两者经过相同模型层，但输入规模、状态访问和调度方式不同。 `05`
- [输入准备：从请求计划到位置、边界和缓存槽位](concepts/prepare-inputs-flow.md) — Runner 将多个请求本轮安排的 token 拼接为计算输入，同时保留请求边界、序列位置及状态映射。批次行号、序列位置、物理缓存槽位是三套不同坐标。 `09`
- [源码阅读方法：从架构问题追到实现证据](concepts/reading-vllm-ascend.md) — 以请求数据、配置和实际实现为入口，记录输入输出与条件；遇到异常或版本变化时逐步缩小范围，区分源码推断和运行证据。 `20`
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md) — 沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的 worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于 vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。 `09`
- [RoPE：旋转如何把相对位置引入注意力](concepts/rope.md) — RoPE 对 Q/K 的成对分量施加与位置相关的旋转，使点积包含相对位置关系；是否使用、旋转维度及缩放方式由模型结构决定。 `04`
- [密集与稀疏注意力：从完整历史到候选位置](concepts/sparse-attention.md) — 密集因果注意力访问全部可见历史，稀疏注意力在其中进一步限制位置集合；二者仍可使用评分、softmax 和加权汇合，但输出、状态与开销需要分别分析。 `04`
- [Token 与分词：从文本到模型输入](concepts/token.md) — 分词器将文本转换为 token 编号序列。理解词表、对话模板和序列位置，才能准确解释输入长度、输出上限，以及生成的编号如何还原成文本。 `01`
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md) — 从平台注册、配置处理、Worker、模型注册和执行后端理解 Ascend 的接入位置；沿 GLM 主线区分启动时的实现选择与每轮模型执行。 `10`
- [源码目录地图：把文件放回推理架构](concepts/vllm-ascend-repo-map.md) — 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。 `20`
- [EngineCore：调度、执行与结果更新如何形成迭代](concepts/vllm-engine-core.md) — EngineCore 持续接收请求和控制消息，安排批次执行并提交结果。一次引擎迭代不等于每个请求产生一个 token，批次队列还会改变调度与执行的重叠方式。 `10`
- [缓存块分配：资源池、引用与请求生命周期](concepts/vllm-kv-block-allocation.md) — 缓存管理器为请求安排物理块，块池维护空闲状态与引用计数。分配、共享、释放和前缀保留是不同动作；资源池作用域由管理实例决定，不能称为全机唯一池。 `11`
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md) — 解释上游如何把设备属性、配置校验与实现选择交给平台接口，以及这些接口与 Worker、Runner、算子的职责边界。 `10`
- [Scheduler：按计算进度、预算与缓存安排批次](concepts/vllm-scheduler.md) — 调度器把每个请求待处理的位置数与本轮预算、运行上限和缓存可用性结合起来，形成执行计划。统一进度表示不消除 Prefill 与 Decode 的计算差别，也不保证所有运行请求每轮都能推进。 `12`
- [vLLM 与 Ascend 架构：组件、进程和数据如何协作](concepts/vllm-v1-shape.md) — 从 GLM 单请求与并发批次出发，说明 API、EngineCore、Scheduler、Executor、NPUWorker 和 NPUModelRunner 的输入输出、状态与进程关系。 `10`

## 特性（feature）
- [ACL Graph：捕获、批形状与重复执行](concepts/acl-graph.md) — 从 Host 下发开销出发，解释稳定缓冲、批描述符、补齐与三种执行路径，以及捕获和回放各自的成本。 `16`
- [Ascend 配置：输入、优先级与实际生效值](concepts/ascend-config-system.md) — 区分通用参数、additional_config 与环境变量，使用两个兼容映射说明优先级，并追踪配置对象的初始化、调整和消费。 `10`
- [运行时适配：补丁、模型注册与算子替换](concepts/ascend-patch-system.md) — 先解释进程内名称绑定，再区分平台补丁、Worker 补丁、模型注册与 CustomOp 替换；以 GLM 的配置识别和 KDA 实现为例。 `10`
- [异步调度：让主机准备与设备计算重叠](concepts/async-scheduling.md) — 跟踪计划、占位记账和结果确认，解释异步调度如何缩短设备等待，以及取消、缓存和自定义调度器需要满足的条件。 `12`
- [均衡调度：DP 执行组的统一准入条件](concepts/balance-scheduling.md) — 用各rank的运行请求数决定是否继续接纳等待请求，解释统一准入与请求迁移、实际计算负载之间的区别。 `12`
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md) — 从浮点归约顺序解释批间数值差异，再说明固定版本的算子替换、覆盖范围与验证层次。 `16`
- [批作业感知调度：为运行请求保留增长空间](concepts/batch-job-aware-scheduler.md) — 从缓存增长与抢占成本出发，解释预留预算、作业分组和输出长度估计如何共同影响等待请求的准入。 `12`
- [分块 Prefill：在轮次之间分配长输入](concepts/chunked-prefill.md) — 分块 Prefill 将长输入分多轮推进，并跨轮保存状态；它让调度器有机会混合处理生成请求与新输入，但 token 预算不保证固定时延。 `11`
- [上下文并行（CP）：位置分工与注意力结果合并](concepts/context-parallel.md) — 从密集因果注意力的跨位置依赖解释 PCP 与 DCP，推导局部 softmax 输出的合并，并明确 GLM 混合注意力的支持边界。 `15`
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md) — 模型在 NPU 执行，Host 仍负责调度和下发；本页解释怎样限制 Worker 的 CPU 运行范围，以及内存迁移、拓扑和 cpuset 的条件。 `16`
- [数据并行（DP）：请求分配与副本协作](concepts/data-parallel.md) — 先理解请求分给多个执行副本，再区分普通副本、跨副本专家并行与元数据协调；不把 DP 规模等同于固定性能收益。 `13`
- [动态分块流水线：按预测耗时选择 prefill 块](concepts/dynamic-chunked-pp.md) — 从密集注意力的历史依赖解释固定长度分块的耗时差异，再看耗时预测、时间预算与 PP 流水重叠，并保留混合模型和校准误差的边界。 `13`
- [DynTra：按历史块数调整 D 端执行集合](concepts/dyntra-lb.md) — 用块数而非请求数估计DP执行负载，说明本地暂停与准入计划、阈值和启发式代价，并保留开发快照的部署限制。 `12`
- [EPLB：专家负载统计与物理放置调整](concepts/eplb.md) — 区分逻辑专家和设备槽位，通过局部负载算例解释专家迁移、冗余副本、映射切换以及统计和传输的成本。 `14`
- [专家并行（EP）：专家放置、token 派发与结果组合](concepts/expert-parallel.md) — 从单设备 MoE 路由扩展到分布式专家，跟踪 token 与权重的归属，说明 dispatch/combine、负载不均和不同通信实现。 `14`
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md) — 从 DP 中重复保存的非专家权重出发，解释沿 DP 维度组成模块通信组，以及 embedding、词表输出和注意力输出各自不同的数据交换。 `13`
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md) — 官方双机配置下 16 张卡各放了什么、启动时按什么顺序做完哪几件事、关键参数分别管住主线的哪一步，以及这套部署给后面各章留下的后果。 `13`
- [图执行：编译、捕获与回放分别做什么](concepts/graph-mode-layer.md) — 从逐算子下发说明图执行的动机，区分计算图改写与设备任务捕获，解释运行时分派、动态输入和 GLM 混合后端的适用边界。 `16`
- [CPU 前缀备份：保存完整缓存段并按需回填](concepts/kv-cache-cpu-offload.md) — 从设备缓存淘汰后的前缀复用问题出发，解释完整段的备份、外部命中、回填和传输完成，以及主机容量与搬运成本。 `11`
- [逐层缓存传输：计算重叠与缓冲区复用](concepts/kv-cache-layerwise-offload.md) — 按模型层安排缓存读写，解释等待如何与计算重叠，以及缓存规格、完成事件和共享槽位怎样限制显存复用。 `11 18`
- [缓存量化：写入、读取与容量边界](concepts/kv-cache-quantization.md) — 解释缓存写入时的整数化、读取时的尺度恢复，并区分有效数据减半、物理页容量和混合注意力状态。 `11`
- [稀疏缓存卸载：按选中位置加载历史数据](concepts/kv-cache-sparse-offload.md) — 从稀疏注意力的访问集合出发，解释主机全量历史、设备索引状态、热缓存和缺失行加载，计算容量与搬运代价。 `11`
- [外部 KV 池：前缀匹配、加载和完成状态](concepts/kv-pool.md) — 解释外部缓存怎样补充本地前缀命中，如何识别数据归属，以及命中计划到实际可读之间需要哪些步骤。 `11`
- [KVPP：按层共享缓存与提前广播](concepts/kvpp.md) — 从 TP 中重复保存的历史状态出发，解释层 owner、暂存区和提前广播；以固定实验实现为边界，不将其写成 GLM 双机基线能力。 `13`
- [大规模 EP：请求路由、专家域与跨机通信](concepts/large-scale-ep.md) — 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端点与进程的区别。 `14`
- [LMCache：外部缓存如何接入推理引擎](concepts/lmcache.md) — 以两次共享前缀的请求解释外部缓存读写，区分设备页与存储段，以及 Ascend 包装、上游接口和外部插件的职责。 `11`
- [LoRA：低秩更新与多适配器推理](concepts/lora.md) — 从线性层的低秩更新解释 LoRA，再连接适配器槽位、批处理与昇腾执行路径。 `17`
- [Mooncake 连接器：状态生命周期与数据传输](concepts/mooncake-connector.md) — 把调度侧的块归属、元数据与完成通知，对应到执行侧的地址注册、分组搬运和逐层重叠；区分固定版本的不同连接器。 `18`
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md) — 将 Platform 契约对应到 Ascend 的启动准备、配置调整、Worker 选择和后端选择，并说明 GLM 模型专用绑定的边界。 `10`
- [NPUWorker 启动：设备、权重与状态池](concepts/npu-worker-lifecycle.md) — 追踪 Worker 从进程内适配到设备通信、权重、缓存预算和预热的依赖，区分显式内存预算与自动测算，以及启动分配池和运行时分配请求块。 `10`
- [编译图融合：改变算子边界与中间数据流](concepts/npugraph-ex.md) — 解释编译器怎样识别计算片段、替换融合实现，以及 npugraph_ex、本地匹配器、静态 kernel 与图捕获之间的关系。 `16`
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md) — 区分模型运算、框架算子与设备核函数，解释 CustomOp 分派、torch_npu 与自定义扩展的关系，并追踪 GLM 的实际算子入口。 `16`
- [PD 分离：计算阶段与历史状态的交接](concepts/pd-disaggregation.md) — 从 prefill 和 decode 的不同工作形态解释分离部署，跟踪目的块分配、状态边界、异步传输和完成后的恢复与释放。 `18`
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md) — 将连续模型层分到多个阶段，说明阶段之间的张量与通信、单请求生成依赖，以及多个批次怎样提高流水线利用率。 `13`
- [插件发现与模型注册](concepts/platform-plugin-registration.md) — 从 Python 安装元数据解释平台插件与通用插件，追踪 GLM 模型实现如何进入注册表，并区分发现、执行注册和实际加载。 `10`
- [前缀缓存：复用已计算输入的条件与边界](concepts/prefix-caching.md) — 相同前缀只有在身份匹配、状态驻留且各缓存组可共同恢复时才能复用。APC 是否启用和有效块大小依赖版本与配置，2048 不是 GLM 的通用默认值。 `11`
- [权重与激活量化：表示范围、存储和计算](concepts/quantization.md) — 从浮点数映射到整数的算例出发，区分离线权重转换、运行时激活量化以及真实的容量和精度代价。 `11`
- [抢占卸载：保存请求状态并恢复计算](concepts/recompute-cpu-offload.md) — 解释请求被抢占时哪些状态需要保存、传输完成如何决定释放与恢复，以及主机容量不足时的退路。 `11 12`
- [重计算调度：D 端容量不足时如何恢复请求](concepts/recompute-scheduler.md) — 沿分配失败、状态保存或重建、代理续接解释D端恢复路径，区分普通抢占、保存缓存以及重新进入prefill的成本。 `12`
- [RFork：工作版机制与排错总览](concepts/rfork.md) — 新实例可从兼容的已有 Worker 读取权重，复用其已加载的数据。以独立 RFork 工作版解释模型加载、身份匹配、传输与资源生命周期，区分传输成功和服务就绪。
- [RFork 配置：四类端口、各项超时与可复制的启动示例](concepts/rfork-config.md) — 想让第二个实例从已有实例借权重，要在启动命令里写哪些设置、写在哪。这页按用途讲工作版 RFork 的十一个客户端设置：模型身份、找 Planner、 来源地址和端口、心跳与还租约；讲清楚键名写错为什么不报错、固定端口只固定了哪一个、几种超时各管什么、动态专家均衡为什么会让它不生效，最后给可复制的启动示例和验收方法。
- [RFork 身份匹配：同模型、同布局，还要同一份分片](concepts/rfork-identity.md) — B 想借 A 的权重，两边必须各自算出一模一样的 seed key：先把模型版本、数值类型、并行大小和布局算成一个指纹，再加上「我要的是哪一份分片、是主模型还是草稿模型」。本页讲这把钥匙里有什么、没有什么，为什么同一个模型也可能找不到来源，以及为什么钥匙对上了也不代表权重内容一样。
- [RFork 张量布局：先对齐算子要的形状，再决定搬什么](concepts/rfork-layout.md) — 新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则按原形状读完再处理。 要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
- [RFork 生命周期：模型可用、租约归还、成为 seed 是三件事](concepts/rfork-lifecycle.md) — 新实例读完权重之后，还要把借来的名额还给 Planner，再决定要不要自己当来源。这页讲这几件事各自什么时候算完成：还名额失败会怎样、Planner 回 400 和 404 各说明什么、心跳和租约各看哪个钟、关停时为什么不一定马上清干净，以及现在还没有续租。
- [RFork 版本维护：保留原补丁，钉住真正运行的完整代码](concepts/rfork-maintenance.md) — 同事又发来一份 RFork 补丁时，怎么弄清现在跑的是哪版代码。这页讲：工作版为什么和社区版本分开维护，原来七份补丁为什么不能直接当一条链往上叠， 代码在项目里存在哪、怎么核对没被改动，新补丁来了要回看哪几页，以及哪些事只有到真机现场才能确认。
- [RFork 启动：准备模型以后才借 seed，失败后先清理再重建](concepts/rfork-startup.md) — 新实例用 RFork 启动时，先把自己的模型搭好、布局转好，再去借一份来源读权重；借不到或读失败，就把这一轮彻底清理干净，改用普通方式从磁盘重新加载。这页按真实顺序走一遍，也讲清两种提前返回和两种「没有可用来源」。
- [RFork 传输：先验整张清单，再按地址读字节](concepts/rfork-transfer.md) — 新实例找到可借权重的来源后，先向它要一份“去哪读、读哪些”的说明，把两边每一块权重的名字、个数和类型逐项对上， 整份通过才按地址分批把字节读过来；也讲清“说明拿到了”“字节读完了”“模型算得对”各自证明了什么。
- [RFork 排错：从第一条异常还原版本、阶段与资源状态](concepts/rfork-troubleshooting.md) — RFork 出错时从哪查起：先确认是哪一版代码，再找日志里最早的那条具体异常，最后看模型、租约和显存各停在哪一步。按「借不到来源、两端清单对不上、显存登记或清理出错、读数据失败、还租约被拒、看起来卡住」六类现象，分别列出能确定的事、可能的原因、该补的证据和不该做的事。
- [序列并行（SP）：让局部激活按 token 分片](concepts/sequence-parallel.md) — 从 TP 归约后的重复激活出发，解释 Reduce-Scatter、逐 token 计算与 All-Gather，区分容量收益、补齐开销和量化通信条件。 `15`
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md) — 用同一组长短输入比较准入顺序，解释恢复请求、短输入、老化长输入的优先关系，以及它与分块预填充的职责区别。 `12`
- [投机解码：提出候选、验证与提交状态](concepts/speculative-decoding.md) — 投机解码先提出多个候选，再由目标模型验证并提交可接受的前缀；收益取决于接受率和额外开销，GLM 的 MTP 与混合注意力状态需要共同管理。 `17`
- [结构化输出：文法状态怎样约束 token 采样](concepts/structured-output.md) — 以允许 token 集合解释格式约束，再连接文法编译、投机采样、推理阶段与昇腾 mask 执行。 `17`
- [张量并行（TP）：矩阵分片与结果合并](concepts/tensor-parallel.md) — 从矩阵乘的列分片和行分片推导 All-Gather 与 All-Reduce，再对应 GLM 的投影层、通信载荷和历史状态分布。 `13`
- [UCM：前缀存储与两种 PD 数据流](concepts/ucm.md) — 区分共享前缀缓存、集中式存储转交和Mooncake直接传输，解释调度计划、数据到达及持久化的边界。 `11`

## 参数（param）
- [absolute_balance_threshold](params/absolute-balance-threshold-71578a0c428d.md) — absolute_balance_threshold 的静态定义，正文待补。
- [block_table_no_commit_optimize](params/block-table-no-commit-optimize-8328d0d2d00d.md) — MRv1 块表优化的回退开关：默认 0 用「只提交脏行区间」的 OptimizedBlockTable，写 1 换回整表 H2D 拷贝的老实现。名字容易读反——它是关优化的，不是开优化的。只在 main 上有。
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md) — 让 LightningIndexer 的 C8 缓存写入改走 StoreKVBlock 算子，不再逐 token scatter。两个发布分支上是默认 false 的用户键、要配合 enable_sparse_li_c8；main 上默认 true，但还要 enable_sparse_li_c8 成立、且跑在 PD 分离的 P 节点上才算真开。 `17`
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）通信时用哪种量化：非 0 就强行覆盖模型自己推出来的模式，只认 0/2/3/4，默认 0 不干预。在册版本里只有 main 有，v0.23 与 v0.26 两个发布分支上配了会被静默忽略。 `14 17`
- [cross_node_transfer_limit](params/cross-node-transfer-limit-06ee92260b7a.md) — cross_node_transfer_limit 的静态定义，正文待补。
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，v0.25.1rc 起已整体删除，残留的这个键在 v0.26 上被静默忽略、在 main 上会让启动直接失败。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — 把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_rank 算出来的轮转表，让每个专家、每张卡收到的 token 数完全相等——压测和算子调优用，开了输出就不对。默认 false，在册版本里只有 main 有。 `14`
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 与 v0.24.0rc 有，v0.25.1rc 起整体移除，v0.26 上配了被静默忽略、main 上直接报错。 `13`
- [enable_pcp_embedding_lmhead_weight_sharding](params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md) — PCP>1 时把 embedding 与 LM Head 的权重按 TP×PCP 网格再切一份，每卡只留 1/(TP×PCP)。bool 默认 true——开着 PCP 升级到含它的 main，行为自动就是切开的；要旧行为得显式写 false。与细粒度 TP 的 embedding/lmhead 两键互斥。只在 main 上有。
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — 开了 SFA-PCP 之后，让 o_proj 权重在加载期就按 PCP 组再切一刀、常驻只留 1/pcp_size，prefill 现 all-gather 出一份全量、decode 直接用本地片。默认 false，在册版本里只有 main 有，对 DSA-CP 无效。 `15`
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外销毁 HCCL 通信域、清空 ACL 图工作区，把分配器池子之外的那两块显存也还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23 与 v0.26 都是顶层键，main 上才搬进 rl_config。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — ascend_compilation_config 里的第三级加码开关：把整网框进一个 super kernel scope 再融一次。v0.23 上没有这个键，v0.26 起有，不写就跟随 enable_static_kernel，开了必须静态内核也开。 `16`
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，v0.25.1rc 起已整体删除，v0.26 上配了被静默吞掉、main 上直接报错。 `13`
- [fused_op_type](params/fused-op-type-fc0f5fcd7be0.md) — fused_op_type 的静态定义，正文待补。
- [kvpp_config](params/kvpp-config-0445bd352140.md) — AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进 additional_config 会被静默剔掉。在册版本里只有 main 有。 `11`
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，v0.24.0rc 起已整体删除，v0.26 上照旧配置会被静默忽略、main 上直接报错。 `13`
- [load_risk_quantile](params/load-risk-quantile-d89a080ba048.md) — load_risk_quantile 的静态定义，正文待补。
- [load_window_bins](params/load-window-bins-cc21068b082d.md) — load_window_bins 的静态定义，正文待补。
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；v0.24.0rc 起整套实现已删除，键留在启动命令里 v0.26 上被静默忽略、main 上会让进程起不来。 `14`
- [placement_search_backtrack_limit](params/placement-search-backtrack-limit-82b03cef98b0.md) — placement_search_backtrack_limit 的静态定义，正文待补。
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 上被静默忽略、main 上直接报错，没有替代键。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — 上游叫 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，把 PP 流水线的气泡抹平。默认关闭，要求 PP>1 且与负载均衡调度互斥；官方定位是 PD 分离里 P 节点的长序列优化。 `12 13`
- [rank_transfer_limit](params/rank-transfer-limit-99529b37d91d.md) — rank_transfer_limit 的静态定义，正文待补。
- [relative_balance_threshold](params/relative-balance-threshold-bcbc40e7dc87.md) — relative_balance_threshold 的静态定义，正文待补。
- [replica_search_beam_size](params/replica-search-beam-size-6556d1650a62.md) — replica_search_beam_size 的静态定义，正文待补。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — DCP 解码路径上 query all-gather 之后，把布局还原从零拷贝的 strided view 改回真的物化一份 t-major 连续存储——上游为对照实验留的回退开关，默认 false 走优化后的零拷贝路径。在册版本里只有 main 有。 `15`
- [size](params/size-40a1c2ca47b8.md) — KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP × PCP，用户不能直接写。只在 main 开发主线上有。 `11`
- [stair_config](params/stair-config-cca9e594a052.md) — stair_config 的静态定义，正文待补。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — Sparse KV Offload 在 decode 上的第二条路径开关，挂在 sparse_kv_offload_config 这个嵌套块里（不是顶层），bool、默认 false；开了就用 npu_fused_sparse_attention_overlap 直接读主机池，不再「搬 miss 再算」。在册版本里只有 main 有。 `11`
- [use_layerwise](params/use-layerwise-b475778cd352.md) — KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是 --kv-transfer-config 的 kv_connector_extra_config；三个版本都有，默认 false。 `11`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上直接报错。 `19`

## 来源（source）
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md) — 一次问答的归档。结论是分配与回收都不在块表里发生，而在上游 EngineCore 进程的 KVCacheManager / BlockPool 里；块表只事后记账。 `11`
- [GLM-5.3-Flash：模型配置与官方双机来源基线](sources/glm-5-3-flash-baseline.md) — 固定贯穿模型的配置、官方双机教程、量化权重提交和镜像摘要，已定位 arm64 镜像的 Ascend 源码复制层；安装产物与权重配套仍待核实，尚未实机部署。
- [RFork 官网核读：原图、全部章节与工作版差异](sources/rfork-official-guide.md) — 按用户指定的英文 latest RFork Guide 核读全文与架构图，对照独立工作版，区分官方使用说明、工作版实际调用路径和仍需现场验收的内容。

## PR（pr）
- [[Refactor] remove layer sharding](sources/pr-11953.md) — 上游 PR `21`

## 按章节

### 10 引擎架构与插件机制
- [Ascend 配置：输入、优先级与实际生效值](concepts/ascend-config-system.md)
- [运行时适配：补丁、模型注册与算子替换](concepts/ascend-patch-system.md)
- [进程与执行器：前端、EngineCore 和 Worker 如何协作](concepts/engine-processes.md)
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md)
- [NPUWorker 启动：设备、权重与状态池](concepts/npu-worker-lifecycle.md)
- [插件发现与模型注册](concepts/platform-plugin-registration.md)
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md)
- [EngineCore：调度、执行与结果更新如何形成迭代](concepts/vllm-engine-core.md)
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md)
- [vLLM 与 Ascend 架构：组件、进程和数据如何协作](concepts/vllm-v1-shape.md)

### 11 KV cache 内存系统
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md)
- [块表：从序列位置找到缓存槽位](concepts/block-table.md)
- [分块 Prefill：在轮次之间分配长输入](concepts/chunked-prefill.md)
- [CPU 前缀备份：保存完整缓存段并按需回填](concepts/kv-cache-cpu-offload.md)
- [逐层缓存传输：计算重叠与缓冲区复用](concepts/kv-cache-layerwise-offload.md)
- [显存容量：从运行开销算出缓存预算](concepts/kv-cache-memory-profiling.md)
- [缓存量化：写入、读取与容量边界](concepts/kv-cache-quantization.md)
- [稀疏缓存卸载：按选中位置加载历史数据](concepts/kv-cache-sparse-offload.md)
- [缓存规格：把模型状态转成页与缓存组](concepts/kv-cache-spec.md)
- [外部 KV 池：前缀匹配、加载和完成状态](concepts/kv-pool.md)
- [kvpp_config](params/kvpp-config-0445bd352140.md)
- [LMCache：外部缓存如何接入推理引擎](concepts/lmcache.md)
- [前缀缓存：复用已计算输入的条件与边界](concepts/prefix-caching.md)
- [权重与激活量化：表示范围、存储和计算](concepts/quantization.md)
- [抢占卸载：保存请求状态并恢复计算](concepts/recompute-cpu-offload.md)
- [size](params/size-40a1c2ca47b8.md)
- [UCM：前缀存储与两种 PD 数据流](concepts/ucm.md)
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md)
- [use_layerwise](params/use-layerwise-b475778cd352.md)
- [缓存块分配：资源池、引用与请求生命周期](concepts/vllm-kv-block-allocation.md)

### 12 Scheduler 与调度策略
- [异步调度：让主机准备与设备计算重叠](concepts/async-scheduling.md)
- [均衡调度：DP 执行组的统一准入条件](concepts/balance-scheduling.md)
- [批作业感知调度：为运行请求保留增长空间](concepts/batch-job-aware-scheduler.md)
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md)
- [DynTra：按历史块数调整 D 端执行集合](concepts/dyntra-lb.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [抢占卸载：保存请求状态并恢复计算](concepts/recompute-cpu-offload.md)
- [重计算调度：D 端容量不足时如何恢复请求](concepts/recompute-scheduler.md)
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md)
- [Scheduler：按计算进度、预算与缓存安排批次](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [数据并行（DP）：请求分配与副本协作](concepts/data-parallel.md)
- [动态分块流水线：按预测耗时选择 prefill 块](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [HCCL 缓冲区：通信组预算与配置优先级](concepts/gap-a5164fe10fa9184412f8.md)
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md)
- [KVPP：按层共享缓存与提前广播](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [张量并行（TP）：矩阵分片与结果合并](concepts/tensor-parallel.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md)
- [EPLB：专家负载统计与物理放置调整](concepts/eplb.md)
- [专家并行（EP）：专家放置、token 派发与结果组合](concepts/expert-parallel.md)
- [大规模 EP：请求路由、专家域与跨机通信](concepts/large-scale-ep.md)
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 15 并行 III：SP / CP / PCP / DCP
- [上下文并行（CP）：位置分工与注意力结果合并](concepts/context-parallel.md)
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)
- [序列并行（SP）：让局部激活按 token 分片](concepts/sequence-parallel.md)
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md)

### 16 Graph mode 与 kernel
- [ACL Graph：捕获、批形状与重复执行](concepts/acl-graph.md)
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md)
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md)
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md)
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md)
- [图执行：编译、捕获与回放分别做什么](concepts/graph-mode-layer.md)
- [编译图融合：改变算子边界与中间数据流](concepts/npugraph-ex.md)
- [从 RMSNorm 到设备 kernel：分派、融合与分块](concepts/op-to-ai-core.md)
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md)

### 17 量化与 speculative decoding
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md)
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [LoRA：低秩更新与多适配器推理](concepts/lora.md)
- [投机解码：提出候选、验证与提交状态](concepts/speculative-decoding.md)
- [结构化输出：文法状态怎样约束 token 采样](concepts/structured-output.md)

### 18 PD / EPD 分离与 KV 传输
- [逐层缓存传输：计算重叠与缓冲区复用](concepts/kv-cache-layerwise-offload.md)
- [Mooncake 连接器：状态生命周期与数据传输](concepts/mooncake-connector.md)
- [PD 分离：计算阶段与历史状态的交接](concepts/pd-disaggregation.md)

### 19 性能工程
- [enable_async_exponential](params/enable-async-exponential.md)
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)

### 20 读源码
- [源码阅读方法：从架构问题追到实现证据](concepts/reading-vllm-ascend.md)
- [源码目录地图：把文件放回推理架构](concepts/vllm-ascend-repo-map.md)

### 21 PR 影响分析
- [[Refactor] remove layer sharding](sources/pr-11953.md)

### 00 从一次对话开始：推理到底在算什么
- [多条请求：在官方双机部署上一步怎样装下它们](concepts/concurrent-requests.md)
- [认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来](concepts/glm-5-3-flash.md)
- [阅读指南：这个知识库讲什么，按什么顺序读](concepts/learning-guide.md)
- [一条请求：在官方双机部署上从提示词走到回答结束](concepts/one-request.md)

### 01 Token、Embedding 与向量
- [嵌入：token 编号如何变成输入向量](concepts/embedding.md)
- [Token 与分词：从文本到模型输入](concepts/token.md)

### 02 矩阵乘法与张量形状
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md)

### 03 Transformer 层的双层数据流
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md)
- [前馈、残差与 RMSNorm：模型子层如何更新表示](concepts/mlp-residual-norm.md)

### 04 Attention 深入
- [注意力代价：容量、计算与访存](concepts/attention-cost.md)
- [注意力与 Q/K/V：从位置间评分到信息汇合](concepts/attention-qkv.md)
- [GQA：查询头如何共享 K/V，改变哪些开销](concepts/gqa.md)
- [推理缓存：跨轮保存哪些历史状态](concepts/kv-cache.md)
- [KDA：通过递推状态处理序列](concepts/linear-attention.md)
- [MLA：压缩历史表示与稀疏检索](concepts/mla.md)
- [RoPE：旋转如何把相对位置引入注意力](concepts/rope.md)
- [密集与稀疏注意力：从完整历史到候选位置](concepts/sparse-attention.md)

### 05 Prefill 与 Decode
- [推理缓存：跨轮保存哪些历史状态](concepts/kv-cache.md)
- [Prefill 与 Decode：输入如何变成连续输出](concepts/prefill.md)

### 06 MoE
- [MoE：专家选择、并行计算与结果聚合](concepts/moe.md)

### 07 昇腾 NPU 剖面
- [AI Core：计算单元与数据搬运](concepts/ai-core.md)
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md)

### 08 服务器与机柜
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md)

### 09 一次请求的硬件旅程
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md)
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPUModelRunner：组织批次、模型前向与采样交接](concepts/npu-model-runner.md)
- [输入准备：从请求计划到位置、边界和缓存槽位](concepts/prepare-inputs-flow.md)
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md)
