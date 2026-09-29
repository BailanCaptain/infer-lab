# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 133 页。

## 概念（concept）
- [AI Core：计算单元与数据搬运](concepts/ai-core.md) — 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路径理解计算与访存的配合。 `07`
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md) — 注意力后端是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定用哪份状态、按什么形状组织这批 token、最后调哪个算子。GLM 的一次前向同时走 KDA 和稀疏 MLA 两条分支，不存在"这个模型的后端"。 `09 16`
- [注意力代价：容量、计算与访存](concepts/attention-cost.md) — 历史变长时，密集注意力每一步读的份数跟着增长，稀疏注意力的主读取到预算就封顶、打分和缓存却照样增长，固定状态始终只读写同一块；放到 GLM 双机上，按一个 token 核算 34 层 KDA 与 11 层稀疏 MLA 各存多少、读多少。 `04`
- [Attention 与 Q/K/V：当前位置怎样从历史里取信息](concepts/attention-qkv.md) — attention 让每个位置按相关程度，从自己和前面的位置取信息，模型靠它把上下文用起来。本页先讲它是什么、为什么需要，再用一个 3 个位置的小例子一步步演示 Q/K/V 打分、softmax 和加权汇合，讲清为什么除以 √d、causal mask 和多头，最后看 GLM 的稀疏 MLA 与 KDA 各改了哪一步。 `04`
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md) — block table（块表）是一张整数表：一行对应批次里的一条请求，第 i 格记着它的第 i 个块在缓存池里的块号；worker 每步按它把位置换算成槽位，注意力算子也按它逐块读历史。GLM 的 5 个缓存组各有一张表，full 组的 640 块号还要展开成 5 个 128 的 kernel 块号。 `11`
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md) — CANN 提供昇腾计算软件能力，HCCL 负责组内通信；沿框架请求、通信库和物理链路看数据怎样到另一张卡，再解释 GLM 双机通信域与 AI QoS 的适用边界。 `07 09 08`
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md) — 集合通信规定一组参与者怎样交换数据，以及结束后每张卡持有什么。用 4 张卡逐步演示 Broadcast、Scatter、Gather、All-Gather、Reduce、Reduce-Scatter、All-Reduce、All-to-All 和 ring All-Reduce，区分逻辑载荷和传输量，再沿 GLM 双机解释 HCCL 与 MC2。 `12`
- [多条请求：在官方双机部署上一步怎样装下它们](concepts/concurrent-requests.md) — 沿场景 M（DP0 上 12 条请求在 decode 时来了一条 6000 token 的新请求，DP1 上 7 条在 decode）和 DP1 空闲的变体 M′，在官方双机部署上看多条请求时每一站多出来的事：选组、分预算、拼输入、抢占、图尺寸补齐与两组对齐、MoE 从 MC2 翻到 AllGather、空闲组陪跑。 `00`
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md) — CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。 `07 09`
- [Embedding：按编号查表取出 token 的向量](concepts/embedding.md) — Embedding 把每个 token 编号换成一条向量：编号是几，就到嵌入表里取第几行，只有查表没有乘法。本页先讲它是什么、为什么需要，再用一张 6 行的小表演示查表、one-hot 等价和 2 张卡切表求和；最后落到 GLM 双机：[154880, 4096] 的表 TP8 按行切成每卡 19360 行，查不到的位置填 0，All-Reduce 后每卡得到完整的 [4, 4096]。 `01`
- [引擎有哪几个进程：API server、EngineCore 与 Worker](concepts/engine-processes.md) — vLLM 把推理服务拆成三类进程——API server 收发请求、EngineCore 每步调度、Worker 每卡一个执行模型，彼此只发消息，请求状态、补丁和 Ascend 配置缓存各归各的进程；GLM 双机按角色计 20 个进程，executor（执行器）决定 Worker 是否独立成进程。 `10`
- [HCCL buffer：每个通信组各自预留的一块显存](concepts/gap-a5164fe10fa9184412f8.md) — HCCL 为每个通信组在每张成员卡上预留一块中转内存；讲清它为什么必须提前占住、怎样按组名挑大小、在 GLM 双机上有哪些组各留多大，以及为什么这笔钱直接从 KV cache 的预算里扣。 `13`
- [认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来](concepts/glm-5-3-flash.md) — GLM-5.3-Flash 模型形状的唯一出处：45 层里 34 层 KDA、11 层稀疏 MLA，四条 residual 流，前 3 层稠密 MLP、其余 42 层 288 选 8 的 MoE，外加 1 个 MTP 层；每种层先讲它从哪个基础机制演变来，再给 GLM 的具体维度、参数量与权重精度。 `00`
- [GQA：几个查询头共读一组 K、V，省下什么、付出什么](concepts/gqa.md) — GQA 把查询头分组，同组共读一组 K、V，K/V 投影与缓存按 KV 头数缩小，打分与汇合仍逐头计算，且须在训练时定下。GLM 的稀疏 MLA 与 KDA 都不是 GQA，本页只作对照。 `04`
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md) — 分清芯片、板卡、服务器与软件可见设备，沿 GLM 双机的一条输入理解主机内存、设备显存、机内 HCCS 与跨机 RoCE 的边界，并核对官方规格峰值和启动源码。 `07 08`
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md) — KV cache 保存每一层为已处理位置算好的 k、v 等状态：新 token 只算自己这一份并追加进去，下一步直接读取，不再重算旧位置；代价是占显存、每步要读、要按块管理空间。GLM-5.3-Flash 同时存两类历史：MLA 层按位置存压缩潜向量和 indexer K，KDA 层按请求存固定大小的状态。 `04 05 11`
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md) — 启动时先按总显存乘显存比例定预算，再用一次最大批量的 profile run 量出激活峰值和非 torch 增量，连同权重一起扣掉，剩下的切成 KV 块；录图等后来才出现的占用从预算外支付，预算也不能直接换成固定并发数。 `11`
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md) — KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的说明：一块覆盖多少个位置、每个位置或每份状态占多少字节。管理器据此算出一页多大，再把页大小和管理方式相同的层编成缓存组。GLM 的四类状态被对齐成两档页、编成 5 个组；本页也是 block_size 五种含义的唯一出处。 `11`
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md) — hidden 是模型为每个输入位置维护、逐层改写的向量。GLM-5.3-Flash 的 45 层之间用 mHC 传四条残差流：每个子层把四条加权合成一条去算，再把输出写回，旧流经 Sinkhorn 约束的 4×4 矩阵混合；每层两次，一次前向 90 次、1,800 轮 Sinkhorn，末层求平均回到一条。 `03`
- [阅读指南：这个知识库讲什么，按什么顺序读](concepts/learning-guide.md) — 知识库入口：模型固定为 GLM-5.3-Flash、部署固定为官方双机 16 卡，沿「一条请求」读完五页主线，再按问题展开各分组；另有术语、证据角标与问答侧栏的用法。 `00`
- [KDA：用一个固定大小的状态代替逐位置历史](concepts/linear-attention.md) — linear attention 去掉逐位置的 softmax，让历史先合成一个形状固定的状态矩阵；KDA 在此之上加按 key 通道的衰减和 delta 规则的纠错写入。本页先讲机制，再落到 GLM-5.3-Flash 的 34 层 KDA：每卡状态多大、为什么固定占 12 个块号、prefill 与 decode 两条执行路径差在哪。 `04`
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md) — 权重是模型训练学到、推理时只读的一张数表，每一列是一个配方；矩阵乘就是照配方把一个位置的几个数重组成新的一排。模型里几乎所有计算都是这一步。先用示意数演一个输出数怎么算、一批 token 怎么一起算，再分清参数量、计算量、容量与访存，最后落到 GLM 双机的前馈投影与 MoE 边界。 `02`
- [MLA：历史压成一条潜向量，用时再展开](concepts/mla.md) — MLA（Multi-head Latent Attention）把每个位置给所有头用的 K/V 压成一条共用的潜向量存进 KV cache，读取时由各头的上投影展开，或把展开吸收进查询和输出投影；GLM-5.3-Flash 的稀疏 MLA 每位置只存 512 维潜向量、不带 RoPE 段，读哪些位置由 indexer 另行决定，主缓存、indexer 缓存与计算开销分别计量。 `04`
- [MLP、residual 与 RMSNorm：一个子层怎样更新 hidden](concepts/mlp-residual-norm.md) — 每个子层都是「residual 旁路原样保留输入 + 支路先 RMSNorm 再做 MLP 或注意力 + 两路相加」。讲清残差为什么让深网络训得动、推理为什么删不掉，RMSNorm 与 LayerNorm 差在哪，pre-norm 放在哪，SwiGLU 的 gate、up、限幅和 down，再落到 GLM 前 3 层稠密 MLP 与四条流。 `03`
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md) — MoE 把一层的前馈计算交给许多个专家，router 为每个 token 打分并选出 top-k，输出按组合权重相加。本页讲稀疏激活省的是什么、router 怎样打分选人、路由专家与共享专家的分工、负载为什么不均，并落到 GLM 的 288 选 8。 `06`
- [NPUModelRunner：组织批次、模型前向与采样交接](concepts/npu-model-runner.md) — NPUModelRunner 将调度计划转成设备输入，管理本轮模型执行及跨调用中间结果，再将采样结果映射回请求。用 A/C 四输入、两预测行的例子连接张量形状与接口职责。 `09`
- [一条请求：在官方双机部署上从提示词走到回答结束](concepts/one-request.md) — 沿一条 4 个 token 的示例请求 R1，在两台 Atlas 800 A2、DP2×TP8、EP16、MTP 草拟 3 个的官方部署上走完七站：入口、调度、准备输入、45 层前向、采样与草拟、结果更新、返回收尾；每站给出每张卡上的形状、次数和字节数。 `00`
- [从 RMSNorm 到设备 kernel：分派、融合与分块](concepts/op-to-ai-core.md) — 沿 GLM 的 RMSNorm 追踪实际设备接口，再用可选的残差融合分支解释 Host tiling 与设备核函数，区分数学语义、数据访问和性能证据。 `16`
- [Prefill 与 Decode：提示词怎样一步算完，回答怎样接着往下写](concepts/prefill.md) — Prefill 是一条请求的第一步，把提示词里已知的全部位置一次送进模型，为每个位置留下历史，并用最后一个位置选出回答的第一个 token；之后每一步是 decode，在已有历史上接着往后写。两者用同一套权重，区别在送进来的是什么、有没有历史可读、调度与执行分支怎样走。 `05`
- [输入准备：从请求计划到位置、边界和缓存槽位](concepts/prepare-inputs-flow.md) — Runner 将多个请求本轮安排的 token 拼接为计算输入，同时保留请求边界、序列位置及状态映射。批次行号、序列位置、物理缓存槽位是三套不同坐标。 `09`
- [源码阅读方法：从架构问题追到实现证据](concepts/reading-vllm-ascend.md) — 以请求数据、配置和实际实现为入口，记录输入输出与条件；遇到异常或版本变化时逐步缩小范围，区分源码推断和运行证据。 `20`
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md) — 沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的 worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于 vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。 `09`
- [RoPE：把位置变成旋转，让注意力分数只看相隔多远](concepts/rope.md) — RoPE 在 q、k 点积之前按各自的位置编号旋转它们的二维分量对，点积里只剩两者的位置差；频率基数和 YaRN 等缩放决定能覆盖多长。固定部署的 GLM-5.3-Flash 把 RoPE 维数设为 0：稀疏 MLA 与索引器都不旋转，KDA 层本来就不用 RoPE。 `04`
- [稀疏注意力：先挑位置，再只读这些位置](concepts/sparse-attention.md) — 稀疏注意力让每个查询只在因果范围内挑出的少量历史位置上做 attention；GLM 用 indexer 按 4 个位置一池打分，每个查询最多读 2051 个位置，没选中的历史仍须全部保留。 `04`
- [Token 与分词：从文本到模型输入](concepts/token.md) — Token 是模型用整数编号表示的文本单元。先讲 token 是什么、为什么切成子词，再用一个例子演示字节级 BPE 怎样把文字拆成字节、按合并表一步步并成 token；接着讲聊天模板和生成的编号怎样变回文字，最后落到 GLM 双机的分词器、154880 行词表和 R1 的入口。 `01`
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md) — vllm-ascend 是让 vLLM 跑在昇腾 NPU 上的单独插件包：上游决定每一步算什么，计划越过平台边界后，怎么在 NPU 上算由它决定。本页是地图：五个扩展点（平台、patch、模型、算子、配置）各一句，再沿 GLM 双机主线 A0–A4 看每站接管了什么，最后给三版差异与源码入口。 `10`
- [源码目录地图：把文件放回推理架构](concepts/vllm-ascend-repo-map.md) — 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。 `20`
- [EngineCore：调度、执行与结果更新如何形成迭代](concepts/vllm-engine-core.md) — EngineCore 持续接收请求和控制消息，安排批次执行并提交结果。一次引擎迭代不等于每个请求产生一个 token，批次队列还会改变调度与执行的重叠方式。 `10`
- [KV 块分配：块从池里借出、共享、归还](concepts/vllm-kv-block-allocation.md) — 启动时切好的 KV 块由 BlockPool 记账：请求要写新历史时从空闲队列队头借块号、计数 0 → 1，前缀相同的请求共用同一块，请求结束或被抢占时计数减回 0、块排回队列，数据不擦。GLM 双机上每个 DP 组一个池子，5 个缓存组共用；R1 首步借 15 块，此后尾状态组边借边还、手里 3–4 块，结束时一次还回 16–17 块；池子不够就抢占，不借一半。 `11`
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md) — Platform 约定上游怎样询问设备属性、校验配置和选择执行实现；沿 A0 启动分清平台、Worker 与模型的职责，以及主机内存、设备显存和 token 预算的边界。 `10`
- [Scheduler：每一步给哪些请求算几个 token](concepts/vllm-scheduler.md) — Scheduler 在 EngineCore 每步开头只看每条请求还差几个位置，在 token 预算、请求数上限和KV 块之内先续 running、再用余量接 waiting，借不到块就抢占或停止接纳，在调度器里不分 prefill 和 decode（worker 侧仍有分路）；GLM 双机上每个 DP 组一步最多 8192 个 token、32 条请求，纯 decode 步只用 128 个。 `12`
- [vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环](concepts/vllm-v1-shape.md) — vLLM V1 把推理服务拆成前端、EngineCore、Worker 三类角色：前端管文字，EngineCore 每一步排一份调度计划、拿回结果更新进度，Executor 把计划交给每张卡上的 Worker 执行。本页讲这个循环里各组件的分工、两道边界上交接什么，以及 R1 在双机部署上绕一圈的样子。 `10`

## 特性（feature）
- [ACL Graph：捕获、批形状与重复执行](concepts/acl-graph.md) — 从 Host 下发开销出发，解释稳定缓冲、批描述符、补齐与三种执行路径，以及捕获和回放各自的成本。 `16`
- [Ascend 配置：三个地方能写，哪个值真的生效](concepts/ascend-config-system.md) — 昇腾开关有三个入口——命令行通用参数、启动命令附带的那段 JSON、环境变量。本页讲它们怎样汇进每个进程各自的 AscendConfig，谁覆盖谁，构造与平台两道检查会怎样改写，以及官方 GLM 双机为什么一个 JSON 键都没传。 `10`
- [Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类](concepts/ascend-patch-system.md) — patch 是 vllm-ascend 在进程里把上游模块中的名字改指向昇腾实现的做法。global patch 在平台注册时打、前端和 EngineCore 先用到；worker patch 在 Worker 启动时打；同一进程只真正执行一次。GLM 双机上逐项列出哪些 patch 被导入、哪些真在请求路径上执行，并对照 v0.23 / v0.26 / main 的清单增删。 `10`
- [异步调度：让主机准备与设备计算重叠](concepts/async-scheduling.md) — 跟踪计划、占位记账和结果确认，解释异步调度如何缩短设备等待，以及取消、缓存和自定义调度器需要满足的条件。 `12`
- [均衡调度：DP 执行组的统一准入条件](concepts/balance-scheduling.md) — 用各rank的运行请求数决定是否继续接纳等待请求，解释统一准入与请求迁移、实际计算负载之间的区别。 `12`
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md) — 从浮点归约顺序解释批间数值差异，再说明固定版本的算子替换、覆盖范围与验证层次。 `16`
- [批作业感知调度：为运行请求保留增长空间](concepts/batch-job-aware-scheduler.md) — 从缓存增长与抢占成本出发，解释预留预算、作业分组和输出长度估计如何共同影响等待请求的准入。 `12`
- [分块 Prefill：在轮次之间分配长输入](concepts/chunked-prefill.md) — 分块 Prefill 将长输入分多轮推进，并跨轮保存状态；它让调度器有机会混合处理生成请求与新输入，但 token 预算不保证固定时延。 `11`
- [上下文并行（CP）：位置分工与注意力结果合并](concepts/context-parallel.md) — 从密集因果注意力的跨位置依赖解释 PCP 与 DCP，推导局部 softmax 输出的合并，并明确 GLM 混合注意力的支持边界。 `15`
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md) — 模型在 NPU 上算，主机侧的 Worker 仍要准备张量、下发算子；绑核从这颗卡的亲和节点出发，通常再补上编号下一个 NUMA 节点里允许的核组成一个池，共用一个池的卡按卡序平分，线程钉在分到的核上，已分配的内存页迁到其中编号最小的核所在的节点。本页讲它怎么挑核、默认开关、GLM 双机上 8 个 Worker 各绑在哪里，以及拿不到拓扑或核数不够时会怎样。 `16`
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md) — DP 把请求分给几个各自排队、各自调度的执行组，同一个请求的前向不拆开；MoE 模型在 DP>1 时，MoE 层横跨所有组的卡，各组每一步都要一起进入这层的通信，所以空闲组要陪跑：没有请求的那组也要用一份假输入走完同一步。这件事由 MoE 触发，和是否开 EP 无关。先看这个机制，再落到 GLM 双机的 DP2。 `13`
- [动态分块流水线：按预测耗时选择 prefill 块](concepts/dynamic-chunked-pp.md) — 从密集注意力的历史依赖解释固定长度分块的耗时差异，再看耗时预测、时间预算与 PP 流水重叠，并保留混合模型和校准误差的边界。 `13`
- [DynTra：按历史块数调整 D 端执行集合](concepts/dyntra-lb.md) — 用块数而非请求数估计DP执行负载，说明本地暂停与准入计划、阈值和启发式代价，并保留开发快照的部署限制。 `12`
- [EPLB：专家负载统计与物理放置调整](concepts/eplb.md) — 区分逻辑专家和设备槽位，通过局部负载算例解释专家迁移、冗余副本、映射切换以及统计和传输的成本。 `14`
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md) — EP 把完整专家分放到不同卡上，让 token 去找选中的专家，算完再收回结果。先看这个过程，再沿 GLM 双机部署跟一个 token 走过 MoE，最后核对通信、陪跑与多请求负载。 `14`
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md) — 从 DP 中重复保存的非专家权重出发，解释沿 DP 维度组成模块通信组，以及 embedding、词表输出和注意力输出各自不同的数据交换。 `13`
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md) — 官方双机配置下 16 张卡各放了什么、启动时按什么顺序做完哪几件事、关键参数分别管住主线的哪一步，以及这套部署给后面各章留下的后果。 `13`
- [graph mode：录一次执行次序，之后整串回放](concepts/graph-mode-layer.md) — 从 Host 逐个提交任务讲起，说明 graph mode 录的是执行次序而不是结果；区分编译改写、捕获与回放，列出官方双机上 FULL_DECODE_ONLY 录了哪 7 张图、一轮回放哪一张的五条判据，以及回放前必须更新什么。 `16`
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
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md) — 昇腾插件交给 vLLM 的平台实现。启动时它按组合校验整份配置、就地改写，再答出 Worker 类、注意力后端与图包装的类名；也是「查不到设备显存以后默认 token 预算怎么定」的唯一推导处。 `10`
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md) — 每张 NPU 上有一个 NPUWorker。启动时它先换补丁、选卡建通信组、装本卡那份权重、试跑量出 KV cache 预算；EngineCore 收齐各卡的数、按最紧的那张卡定块数并发回配置后，每张卡再建缓存池，最后预热并录 decode 图。每一步用到上一步的产物，所以顺序固定。预算怎么扣、块怎么借、系统怎么分层各有专页，本页只讲这条先后链。 `10`
- [编译图融合：改变算子边界与中间数据流](concepts/npugraph-ex.md) — 解释编译器怎样识别计算片段、替换融合实现，以及 npugraph_ex、本地匹配器、静态 kernel 与图捕获之间的关系。 `16`
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md) — 模型里的一次运算怎样经框架替换表、量化方法或模型自己的调用，落到 torch_npu 已有算子或仓库自编译扩展，再经 CANN 下发成设备 kernel；并沿 GLM 双机的一层列出各站的实际算子。 `16`
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md) — 把一条请求的 prefill 与 decode 交给 P、D 两套实例，中间由连接器交接历史状态。沿 Mooncake V1 看交棒、D 拉取、完成信号与押块，讲清 GLM 这类混合模型为何让 P 少算最后一个位置；本站双机主线没有开 PD，只作变体对照。 `18`
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md) — 将连续模型层分到多个阶段，说明阶段之间的张量与通信、单请求生成依赖，以及多个批次怎样提高流水线利用率。 `13`
- [插件发现与模型注册](concepts/platform-plugin-registration.md) — 装上昇腾的包，vLLM 自己就会用昇腾：包里带着一张「我能接哪几个口」的入口点清单，vLLM 每起一个进程都按组名读一遍——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型实现。 `10`
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md) — 写满的块按 block hash 登记，开头相同的请求直接指向同一份、计数加一。GLM 是 hybrid 模型，v0.23 上游判它不支持而默认关；显式打开会走 align 模式，KDA 状态按 640 边界留档，能复用的长度仍按 640 对齐，不足一块零收益。 `11`
- [W8A8 量化：权重压成 INT8，算完再乘回缩放系数](concepts/quantization.md) — 量化把权重和激活换成 8 位整数，另存一组缩放系数把结果换回原来的数值范围。先看一个数怎样压下去再还原，再分清动态与静态量化，最后落到 GLM 双机：两个 8 位分别从哪来、哪些矩阵保持 BF16、缩放系数占多少字节。 `11`
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
- [结构化输出：文法怎样在采样前屏蔽不合法的 token](concepts/structured-output.md) — 结构化输出在打分和采样之间加一道关卡：文法状态算出下一步允许的 token，其余候选的 logits 改成 −∞ 再采样。先看这个过程，再沿 GLM 双机看 bitmask 在哪个进程、哪一步算出，怎样作用到 logits，以及它和 MTP 草稿、思考阶段的配合。 `17`
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md) — 把同一层的矩阵分给多张卡：先列切，各卡算出完整数值的几列；本地激活后接行切，最后一次求和合齐结果。沿 GLM 双机的一次前向，核对通信和显存代价。 `13`
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
- [replica_search_num_stages](params/replica-search-num-stages-e4b10925ff97.md) — replica_search_num_stages 的静态定义，正文待补。
- [replica_search_radius](params/replica-search-radius-cd3118b5aae5.md) — replica_search_radius 的静态定义，正文待补。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — DCP 解码路径上 query all-gather 之后，把布局还原从零拷贝的 strided view 改回真的物化一份 t-major 连续存储——上游为对照实验留的回退开关，默认 false 走优化后的零拷贝路径。在册版本里只有 main 有。 `15`
- [size](params/size-40a1c2ca47b8.md) — KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP × PCP，用户不能直接写。只在 main 开发主线上有。 `11`
- [stair_config](params/stair-config-cca9e594a052.md) — stair_config 的静态定义，正文待补。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — Sparse KV Offload 在 decode 上的第二条路径开关，挂在 sparse_kv_offload_config 这个嵌套块里（不是顶层），bool、默认 false；开了就用 npu_fused_sparse_attention_overlap 直接读主机池，不再「搬 miss 再算」。在册版本里只有 main 有。 `11`
- [use_layerwise](params/use-layerwise-b475778cd352.md) — KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是 --kv-transfer-config 的 kv_connector_extra_config；三个版本都有，默认 false。 `11`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上直接报错。 `19`

## 来源（source）
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md) — 一次问答的归档。结论是分配与回收都不在块表里发生，而在上游 EngineCore 进程的 KVCacheManager / BlockPool 里；块表只事后记账。 `11`
- [GLM-5.3-Flash：模型配置与官方双机来源基线](sources/glm-5-3-flash-baseline.md) — 固定 GLM 主线的模型配置、双机教程、控制流与执行侧提交，区分配置、源码推导、量化假设和镜像证据；最终安装产物与权重配套仍待核实，尚未实机部署。
- [RFork 官网核读：原图、全部章节与工作版差异](sources/rfork-official-guide.md) — 按用户指定的英文 latest RFork Guide 核读全文与架构图，对照独立工作版，区分官方使用说明、工作版实际调用路径和仍需现场验收的内容。

## PR（pr）
- [[Refactor] remove layer sharding](sources/pr-11953.md) — 上游 PR `21`

## 按章节

### 10 引擎架构与插件机制
- [Ascend 配置：三个地方能写，哪个值真的生效](concepts/ascend-config-system.md)
- [Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类](concepts/ascend-patch-system.md)
- [引擎有哪几个进程：API server、EngineCore 与 Worker](concepts/engine-processes.md)
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md)
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md)
- [插件发现与模型注册](concepts/platform-plugin-registration.md)
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md)
- [EngineCore：调度、执行与结果更新如何形成迭代](concepts/vllm-engine-core.md)
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md)
- [vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环](concepts/vllm-v1-shape.md)

### 11 KV cache 内存系统
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md)
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md)
- [分块 Prefill：在轮次之间分配长输入](concepts/chunked-prefill.md)
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md)
- [CPU 前缀备份：保存完整缓存段并按需回填](concepts/kv-cache-cpu-offload.md)
- [逐层缓存传输：计算重叠与缓冲区复用](concepts/kv-cache-layerwise-offload.md)
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md)
- [缓存量化：写入、读取与容量边界](concepts/kv-cache-quantization.md)
- [稀疏缓存卸载：按选中位置加载历史数据](concepts/kv-cache-sparse-offload.md)
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md)
- [外部 KV 池：前缀匹配、加载和完成状态](concepts/kv-pool.md)
- [kvpp_config](params/kvpp-config-0445bd352140.md)
- [LMCache：外部缓存如何接入推理引擎](concepts/lmcache.md)
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md)
- [W8A8 量化：权重压成 INT8，算完再乘回缩放系数](concepts/quantization.md)
- [抢占卸载：保存请求状态并恢复计算](concepts/recompute-cpu-offload.md)
- [size](params/size-40a1c2ca47b8.md)
- [UCM：前缀存储与两种 PD 数据流](concepts/ucm.md)
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md)
- [use_layerwise](params/use-layerwise-b475778cd352.md)
- [KV 块分配：块从池里借出、共享、归还](concepts/vllm-kv-block-allocation.md)

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
- [Scheduler：每一步给哪些请求算几个 token](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md)
- [动态分块流水线：按预测耗时选择 prefill 块](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [HCCL buffer：每个通信组各自预留的一块显存](concepts/gap-a5164fe10fa9184412f8.md)
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md)
- [KVPP：按层共享缓存与提前广播](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md)
- [EPLB：专家负载统计与物理放置调整](concepts/eplb.md)
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md)
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
- [graph mode：录一次执行次序，之后整串回放](concepts/graph-mode-layer.md)
- [编译图融合：改变算子边界与中间数据流](concepts/npugraph-ex.md)
- [从 RMSNorm 到设备 kernel：分派、融合与分块](concepts/op-to-ai-core.md)
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md)

### 17 量化与 speculative decoding
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md)
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [LoRA：低秩更新与多适配器推理](concepts/lora.md)
- [投机解码：提出候选、验证与提交状态](concepts/speculative-decoding.md)
- [结构化输出：文法怎样在采样前屏蔽不合法的 token](concepts/structured-output.md)

### 18 PD / EPD 分离与 KV 传输
- [逐层缓存传输：计算重叠与缓冲区复用](concepts/kv-cache-layerwise-offload.md)
- [Mooncake 连接器：状态生命周期与数据传输](concepts/mooncake-connector.md)
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md)

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
- [Embedding：按编号查表取出 token 的向量](concepts/embedding.md)
- [Token 与分词：从文本到模型输入](concepts/token.md)

### 02 矩阵乘法与张量形状
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md)

### 03 Transformer 层的双层数据流
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md)
- [MLP、residual 与 RMSNorm：一个子层怎样更新 hidden](concepts/mlp-residual-norm.md)

### 04 Attention 深入
- [注意力代价：容量、计算与访存](concepts/attention-cost.md)
- [Attention 与 Q/K/V：当前位置怎样从历史里取信息](concepts/attention-qkv.md)
- [GQA：几个查询头共读一组 K、V，省下什么、付出什么](concepts/gqa.md)
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md)
- [KDA：用一个固定大小的状态代替逐位置历史](concepts/linear-attention.md)
- [MLA：历史压成一条潜向量，用时再展开](concepts/mla.md)
- [RoPE：把位置变成旋转，让注意力分数只看相隔多远](concepts/rope.md)
- [稀疏注意力：先挑位置，再只读这些位置](concepts/sparse-attention.md)

### 05 Prefill 与 Decode
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md)
- [Prefill 与 Decode：提示词怎样一步算完，回答怎样接着往下写](concepts/prefill.md)

### 06 MoE
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md)

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
