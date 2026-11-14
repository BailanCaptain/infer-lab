# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 163 页。

## 概念（concept）
- [AI Core：计算单元与数据搬运](concepts/ai-core.md) — 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路径理解计算与访存的配合。 `07`
- [API server 入口：一个 HTTP 请求怎样变成引擎里的请求](concepts/api-server-entry.md) — vLLM 前端进程从收到 HTTP 请求到交给某个 EngineCore 之间做的事：检查、套聊天模板、分词、定输出上限和采样参数、包成 EngineCoreRequest、先在本进程登记反分词器和输出槽，再选 DP 组经 ZMQ 发出。讲清每一步在哪里拒绝请求、流式与非流式的差别、CPU 开销，以及 GLM 双机上 node0 一个前端接全部请求。 `10`
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md) — 沿矩阵结果交给向量计算的小例，理解昇腾 950 的 Cube/Vector 直通、多维搬运与缓冲同步；再区分 SIMD/SIMT、存储层次、低精度和 PR/DT 规格，把硬件能力变成可验证的推理分析假设。 `07 19`
- [昇腾 950：两张卡怎样接着把工作做完](concepts/ascend-950-execution-interconnect.md) — 沿两张卡的部分结果走过本地计算、交换求和和下一段计算，理解 STARS 2.0 如何安排设备任务、CCU 如何承担通信，以及 URMA、UB Memory 和 UBoE 分别改变哪一段交接；用一组时间记录区分下发开销、参与者迟到与传输等待。 `16`
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md) — 注意力后端是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定用哪份状态、按什么形状组织这批 token、最后调哪个算子。GLM 的一次前向同时走 KDA 和稀疏 MLA 两条分支，不存在"这个模型的后端"。 `09 16`
- [注意力代价：容量、计算与访存](concepts/attention-cost.md) — 历史变长时，密集注意力每一步读的份数跟着增长，稀疏注意力的主读取到预算就封顶、打分和缓存却照样增长，固定状态始终只读写同一块；放到 GLM 双机上，按一个 token 核算 34 层 KDA 与 11 层稀疏 MLA 各存多少、读多少。 `04`
- [Attention 与 Q/K/V：当前位置怎样从历史里取信息](concepts/attention-qkv.md) — attention 让每个位置按相关程度，从自己和前面的位置取信息，模型靠它把上下文用起来。本页先讲它是什么、为什么需要，再用一个 3 个位置的小例子一步步演示 Q/K/V 打分、softmax 和加权汇合，讲清为什么除以 √d、causal mask 和多头，最后看 GLM 的稀疏 MLA 与 KDA 各改了哪一步。 `04`
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md) — block table（块表）是一张整数表：一行对应批次里的一条请求，第 i 格记着它的第 i 个块在缓存池里的块号；worker 每步按它把位置换算成槽位，注意力算子也按它逐块读历史。GLM 的 5 个缓存组各有一张表，full 组的 640 块号还要展开成 5 个 128 的 kernel 块号。 `11`
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md) — CANN 提供昇腾计算软件能力，HCCL 负责组内通信；沿框架请求、通信库和物理链路看数据怎样到另一张卡，再解释 GLM 双机通信域与 AI QoS 的适用边界。 `07 09 08`
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md) — 集合通信规定一组参与者怎样交换数据，以及结束后每张卡持有什么。用 4 张卡逐步演示 Broadcast、Scatter、Gather、All-Gather、Reduce、Reduce-Scatter、All-Reduce、All-to-All 和 ring All-Reduce，区分逻辑载荷和传输量，再沿 GLM 双机解释 HCCL 与 MC2。 `12`
- [多条请求：在官方双机部署上一步怎样装下它们](concepts/concurrent-requests.md) — 沿场景 M（DP0 上 12 条请求在 decode 时来了一条 6000 token 的新请求，DP1 上 7 条在 decode）和 DP1 空闲的变体 M′，在官方双机部署上看多条请求时每一站多出来的事：选组、分预算、拼输入、抢占、图尺寸补齐与两组对齐、MoE 从 MC2 翻到 AllGather、空闲组陪跑。 `00`
- [DeepSeek 生产实践：一条请求怎样走过整套服务](concepts/deepseek-serving-case.md) — 从长输入干扰已有回答出发，推演为什么把 E/P/D 分开、要交接哪些状态以及何时得不偿失；再沿带图长文的追问拆开缓存就绪与计算等待，对照 DeepInfer 的实际发布边界。 `19`
- [DeepSeek-V4.1-Flash：长历史怎样少存、少重算](concepts/deepseek-v4-1-flash.md) — 同一份长文，哪些计算可以省、哪些历史必须留下？先用四层模型走一遍，再区分少存、少读和跨层共享，最后核对实际配置与缓存大小。 `19`
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md) — CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。 `07 09`
- [DP 请求路由：新请求派给哪一个 DP 组](concepts/dp-request-routing.md) — 开了 DP 以后，前端给每条新请求挑一个 DP 组：请求头写了组号就直接去，否则按 waiting × 4 + running 取分数最小的组，并在本地先记一笔。讲清计数从哪来、为什么会过时、挑偏的代价（排队、KV 池、每步对齐、前缀缓存），几种部署方式与各版本打分差异，以及 GLM 双机上怎样选。 `13`
- [Embedding：按编号查表取出 token 的向量](concepts/embedding.md) — Embedding 把每个 token 编号换成一条向量：编号是几，就到嵌入表里取第几行，只有查表没有乘法。本页先讲它是什么、为什么需要，再用一张 6 行的小表演示查表、one-hot 等价和 2 张卡切表求和；最后落到 GLM 双机，看 8 张卡怎样分着查同一张表。 `01`
- [引擎有哪几个进程：API server、EngineCore 与 Worker](concepts/engine-processes.md) — vLLM 用三类角色协作——API server 收发请求、EngineCore 每步调度、Worker 执行设备上的模型；客户端模式与执行器决定角色如何分布到进程，请求状态、补丁和 Ascend 配置缓存按进程管理；GLM 双机按角色计 20 个进程，executor（执行器）决定 Worker 是否独立成进程。 `10`
- [HCCL buffer：通信缓冲怎样配置与占用显存](concepts/gap-a5164fe10fa9184412f8.md) — HCCL buffer 为集合通信提供设备中转空间；讲清逐组配置、环境变量和底层通信组复用的区别，以及 GLM 双机的配置预算怎样影响 KV cache 可用显存。 `13`
- [认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来](concepts/glm-5-3-flash.md) — GLM-5.3-Flash 模型形状的唯一出处：45 层里 34 层 KDA、11 层稀疏 MLA，四条 residual 流，前 3 层稠密 MLP、其余 42 层 288 选 8 的 MoE，外加 1 个 MTP 层；每种层先讲它从哪个基础机制演变来，再给 GLM 的具体维度、参数量与权重精度。 `00`
- [GQA：几个查询头共读一组 K、V，省下什么、付出什么](concepts/gqa.md) — GQA 把查询头分组，同组共读一组 K、V，K/V 投影与缓存按 KV 头数缩小，打分与汇合仍逐头计算，且须在训练时定下。GLM 的稀疏 MLA 与 KDA 都不是 GQA，本页只作对照。 `04`
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md) — 分清芯片、板卡、服务器与软件可见设备，沿 GLM 双机的一条输入理解主机内存、设备显存、机内 HCCS 与跨机 RoCE 的边界，并核对官方规格峰值和启动源码。 `07 08`
- [推理测量：怎样知道服务真的变快了](concepts/inference-benchmarking.md) — 沿用停顿样例的 A/B 配置，把一次请求的改善放进整组压测：总吞吐相同但达标请求更多意味着什么，怎样把失败、未完成、分位数和真实到达负载一起算进结论。 `19`
- [容量与恢复：平时够用，为什么出故障就排长队](concepts/inference-capacity-and-reliability.md) — 从一张逐级加压的结果表选出单实例可用运行点，再算正常与容错需要几套实例、故障积压多久能消退；沿就绪时间线和流式重试记录判断恢复是否真的完成。 `19`
- [输出异常排查：同样的问题，回答为什么变了](concepts/inference-correctness-troubleshooting.md) — 完成一次从回答异常、输入编号差异到修正模板和回归验证的排查；再换成输入相同的情况，沿首次分歧区分采样、数值和状态，覆盖乱码、重复、空输出、NaN 与质量回归。用固定评测集和业务指标检验变更后的任务质量。 `19`
- [性能分析：设备到底在算，还是在等](concepts/inference-performance-analysis.md) — 接着 D/N 的分块实验，解释少算一些输入为什么能缩短一步、为什么切得更小也会有成本；通过矩阵流量与关键路径推演，区分算得慢、数据搬得慢和等其他卡。 `19`
- [性能排障：找到等待以后，怎样选优化办法](concepts/inference-performance-troubleshooting.md) — 从排队、长执行步、主机空隙、缓存压力、通信偏斜和返回等待六条证据路径选择优化实验；同时解释无故障时怎样提高吞吐、压低长尾、节省内存与比较并行策略。 `19`
- [推理性能分析：为什么回答到一半会停顿](concepts/inference-performance-walkthrough.md) — 跟踪 D 的一次输出停顿，读懂它与长请求 N 的计算记录，再完整比较分块前后的时间线：D 少等了多少、N 多等了多少、什么条件下值得采用，并练习证据改变后怎样换方向。 `19`
- [推理排障入口：先找到问题发生在哪一步](concepts/inference-troubleshooting.md) — 面对启动失败、慢、内存不足、输出异常、图与通信错误等十类问题，先找最后成功阶段，再沿最小证据、候选原因和区分实验进入已有机制页；证据不足时也有明确下一步。 `19`
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md) — KV cache 保存每一层为已处理位置算好的 k、v 等状态：新 token 只算自己这一份并追加进去，下一步直接读取，不再重算旧位置；代价是占显存、每步要读、要按块管理空间。GLM-5.3-Flash 同时存两类历史：MLA 层按位置存压缩潜向量和 indexer K，KDA 层按请求存固定大小的状态。 `04 05 11`
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md) — 启动时先按总显存乘显存比例定预算，再用一次最大批量的 profile run 量出激活峰值和非 torch 增量，连同权重一起扣掉，剩下的切成 KV 块；录图等后来才出现的占用从预算外支付，预算也不能直接换成固定并发数。 `11`
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md) — KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的说明：一块覆盖多少个位置、每个位置或每份状态占多少字节。管理器据此算出一页多大，再把能共用块号清单、管理方式兼容的层编成缓存组。GLM 的四类状态被对齐成两档页、编成 5 个组；本页也是 block_size 五种含义的唯一出处。 `11`
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md) — hidden 是模型为每个输入位置维护、逐层改写的向量。GLM-5.3-Flash 的 45 层之间用 mHC 传四条残差流：每个子层把四条加权合成一条去算，再把输出写回，旧流经 Sinkhorn 约束的 4×4 矩阵混合；每层两次，一次前向 90 次、1,800 轮 Sinkhorn，末层求平均回到一条。 `03`
- [阅读指南：这个知识库讲什么，按什么顺序读](concepts/learning-guide.md) — 知识库入口：模型固定为 GLM-5.3-Flash、部署固定为官方双机 16 卡，沿「一条请求」读完五页主线，再按问题展开各分组；另有术语、证据角标与问答侧栏的用法。 `00`
- [KDA：用一个固定大小的状态代替逐位置历史](concepts/linear-attention.md) — linear attention 去掉逐位置的 softmax，让历史先合成一个形状固定的状态矩阵；KDA 在此之上加按 key 通道的衰减和 delta 规则的纠错写入。本页先讲机制，再落到 GLM-5.3-Flash 的 34 层 KDA：每卡状态多大、为什么固定占 12 个块号、prefill 与 decode 两条执行路径差在哪。 `04`
- [lm_head：把最后的隐藏向量变成每个 token 的分数](concepts/lm-head.md) — lm_head 是模型最后一步的输出投影：把最后一层交出的隐藏向量乘一张每个词一列的权重，给词表里每个 token 打一个分数（logits），再交给采样挑下一个 token。本页先用 4 维、6 个词的小例子演示一个分数怎么算，再看 GLM 双机上它按词表切成 8 段、各卡算一段、All-Gather 拼回 154880 个分数。 `03`
- [BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样](concepts/low-precision-formats.md) — 从 FP32、FP16、BF16 和 INT8 基线出发，分清 FP8、FP4、NF4、MX 与 HiF8 的元素编码和缩放；解释昇腾 910B/910C 为何不只支持 FP8 推理，区分模型文件精度、加载后权重与实际计算，并核对 A2/A3 的 BF16、FP16、INT8 路径及版本边界。 `19`
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md) — 权重是模型训练学到、推理时只读的一张数表，每一列是一个配方；矩阵乘就是照配方把一个位置的几个数重组成新的一排。模型里几乎所有计算都是这一步。先用示意数演一个输出数怎么算、一批 token 怎么一起算，再分清参数量、计算量、容量与访存，最后落到 GLM 双机的前馈投影与 MoE 边界。 `02`
- [MLA：历史压成一条潜向量，用时再展开](concepts/mla.md) — MLA（Multi-head Latent Attention）把每个位置给所有头用的 K/V 压成一条共用的潜向量存进 KV cache，读取时由各头的上投影展开，或把展开吸收进查询和输出投影；GLM-5.3-Flash 的稀疏 MLA 每位置只存 512 维潜向量、不带 RoPE 段，读哪些位置由 indexer 另行决定，主缓存、indexer 缓存与计算开销分别计量。 `04`
- [MLP、residual 与 RMSNorm：一个子层怎样更新 hidden](concepts/mlp-residual-norm.md) — 以单条 residual、pre-norm 和 RMSNorm 为例，讲清「旁路保留输入 + 支路计算改变量 + 两路相加」。区分 LayerNorm 与 RMSNorm、pre-norm 与 post-norm；再讲 SwiGLU 的 gate、up、限幅和 down，以及 GLM 前 3 层稠密 MLP 与四条流。 `03`
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md) — MoE 把一层的前馈网络换成一池专家，router 给每个 token 打分，只交给其中 k 个去算，输出按组合权重相加：参数随专家数涨，每个 token 的计算只随 k 涨。本页先讲它是什么、为什么需要，再用 6 选 2 的示意数演一遍打分、偏置选人、归一化与加权相加，讲清分组选择、共享专家和负载不均，最后落到 GLM 的 288 选 8。 `06`
- [NPUModelRunner：每张卡上把一步计划跑成 token 的执行者](concepts/npu-model-runner.md) — model runner 是每张卡的 Worker 里执行一步的对象：按调度计划对账跨步保留的请求记录，拼输入、定执行方式、跑前向，只把每条请求要预测的那几行变成词表分数，暂存进执行状态；引擎第二次调用时再取出来采样、草拟候选，按请求交回 token。前向和采样拆成两次调用，中间靠执行状态交接。 `09`
- [一条请求：在官方双机部署上从提示词走到回答结束](concepts/one-request.md) — 沿一条 4 个 token 的示例请求 R1，在两台 Atlas 800 A2、DP2×TP8、EP16、MTP 草拟 3 个的官方部署上走完七站：入口、调度、准备输入、45 层前向、采样与草拟、结果更新、返回收尾；每站给出每张卡上的形状、次数和字节数。 `00`
- [从算子到 AI Core：分工、融合与分块](concepts/op-to-ai-core.md) — 在 A4 逐层前向中，算子怎样分成矩阵与向量执行段，Host 怎样划分工作，设备怎样搬入、计算、写回；以 GLM 实际 RMSNorm 路径和可选残差融合分支对照说明。 `16`
- [Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写](concepts/prefill.md) — Prefill 处理提示词中尚未计算的位置并建立历史，可以一轮完成，也可以跨多轮；处理完成后，用最后一个位置选出回答的第一个 token。随后 decode 在已有历史上接着生成。两者用同一套权重，区别在输入位置的用途、已有历史以及调度与执行分支。 `05`
- [准备输入：把一步的请求计划拼成模型能吃的几张表](concepts/prepare-inputs-flow.md) — 调度器每步只说「哪些请求、各算几个 token、新借了哪些块」；worker 里的 model runner 把这些 token 首尾相接排成一排，逐个 token 配上 token id、位置和 KV 槽位，再按请求记下边界、长度和选行，按缓存组组装成注意力元数据交给各层后端。批次行号、位置、槽位是三套不同的编号。 `09`
- [量化验收：怎样判断省了内存、保住质量、真正提速](concepts/quantization-evaluation.md) — 把量化验收拆成产物一致性、中间数值、任务质量、实际内存和服务性能；用误差与耗时小例子解释为什么文件变小不等于推理变快，并给出固定 GLM 双机可复核的对照流程。 `11 19`
- [量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择](concepts/quantization-methods.md) — 从权重、激活、缓存分别量化出发，解释 W4A16、W8A8、分组粒度和校准，再比较 PTQ、QAT、RTN、AWQ、GPTQ、SmoothQuant 的目标与代价；用等价缩放的手算例连接方法、量化产物和昇腾加载器，并区分加载时量化、工具导出格式与 GGUF 插件。 `11 19`
- [怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现](concepts/reading-vllm-ascend.md) — vllm-ascend 是装在 vLLM 上的昇腾平台插件，靠入口点、patch、custom op 等扩展点接进请求路径，所以一条请求跑的是两个仓库拼起来的代码。先沿七站读通主线，再按数据、配置、实现三条路线带着问题追；遇到异常或版本变化时先划清证据边界，区分源码推断和运行证据。 `20`
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md) — 沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的 worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于 vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。 `09`
- [请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去](concepts/request-teardown.md) — 请求收尾是一条请求停下后，前端、引擎和 worker 各自删掉为它存的记录、还回它对 KV 块的引用。先分清引擎判停、停止字符串、客户端断开、出错四条路谁先动手，再分清还块（引用计数减 1）和清空前缀缓存（抹掉全部登记），最后看 GLM 双机上 R1 结束时还了什么。 `09`
- [RoPE：把位置变成旋转，让注意力分数只看相隔多远](concepts/rope.md) — RoPE 在 q、k 点积之前按各自的位置编号旋转它们的二维分量对，点积里只剩两者的位置差；频率基数和 YaRN 等缩放决定能覆盖多长。固定部署的 GLM-5.3-Flash 把 RoPE 维数设为 0：稀疏 MLA 与索引器都不旋转，KDA 层本来就不用 RoPE。 `04`
- [Sampling：从词表分数里定下一个 token](concepts/sampling.md) — 模型给词表里每个词打完分，sampling（采样）按请求的设置从中定下一个 token。本页用 6 个词的小例子手算 temperature、softmax、top-k、top-p 和按概率抽取，对照 greedy，再讲停止条件；最后落到 GLM 双机：8 张卡各采一遍、只交回一份，MTP 候选怎样验证。 `05`
- [稀疏注意力：先挑位置，再只读这些位置](concepts/sparse-attention.md) — 稀疏注意力让每个查询只在因果范围内挑出的少量历史位置上做 attention；GLM 用 indexer 按 4 个位置一池打分，每个查询最多读 2051 个位置，没选中的历史仍须全部保留。 `04`
- [流式输出：token 编号怎样变成一段段推给客户端的文字](concepts/streaming-output.md) — 流式输出让客户端边生成边看到文字：引擎每步交回新的 token 编号，前端的增量反分词把它们接上已有字节、还原出新增文字，查过停止字符串后包成一个 SSE 片段推出。先分清 token 与文本增量，再沿 GLM 双机看一步 1–4 个 token 怎样变成片段、在哪里判停和收尾。 `09`
- [ND 与 NZ：张量的数值没变，内存里怎样重新排列](concepts/tensor-layout.md) — ND 是 N-Dimension，NZ 按块间大 N、块内小 z 的遍历形状命名；用同一张矩阵演示分块重排、补齐和地址变化，再区分 shape、stride、dtype、量化打包与设备格式，核对昇腾权重和 KV cache 的布局边界。 `07 11`
- [Token 与分词：从文本到模型输入](concepts/token.md) — Token 是模型用整数编号表示的文本单元。先讲 token 是什么、为什么切成子词，再用一个例子演示字节级 BPE 怎样把文字拆成字节、按合并表一步步并成 token；接着讲聊天模板和生成的编号怎样变回文字，最后落到 GLM 双机的分词器、154880 行词表和 R1 的入口。 `01`
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md) — vllm-ascend 是让 vLLM 跑在昇腾 NPU 上的单独插件包：沿用 vLLM 的请求与引擎框架，提供 NPU 执行实现，也会调整部分调度行为。本页是地图：五个扩展点（平台、patch、模型、算子、配置）各一句，再沿 GLM 双机主线 A0–A4 看每站接管了什么，最后给各版本差异与源码入口。 `10`
- [源码目录地图：把文件放回推理架构](concepts/vllm-ascend-repo-map.md) — 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。 `20`
- [EngineCore：vLLM 里一圈一圈推着请求往前走的循环](concepts/vllm-engine-core.md) — EngineCore 是 vLLM 里专门跑「收消息 → 调度 → 交出执行 → 按结果更新」循环的核心，归属同一 EngineCore 的请求共用循环，转一圈叫一步；它默认单独占一个进程，让前端收发和后端计算互不阻塞。本页讲一圈的顺序、一圈交回几个 token、空闲与取消、批次队列，以及 GLM 双机上两个 EngineCore 怎样逐圈推进 R1。 `10`
- [KV 块分配：块从池里借出、共享、归还](concepts/vllm-kv-block-allocation.md) — 启动时切好的 KV 块由 BlockPool 记账：请求要写新历史时从空闲队列队头借块号、计数 0 → 1，前缀相同的请求共用同一块，请求结束或被抢占时计数减回 0、块排回队列，数据不擦。GLM 双机上每个 DP 组一个池子，5 个缓存组共用；R1 首步借 15 块；按完整投机步示意，尾状态组持有 3–4 块，R1 结束时还回 16–17 块。截短步、长度封顶和异步在途计数另按实际块表核算。 `11`
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md) — Platform 约定上游怎样询问设备属性、校验配置和选择执行实现；沿 A0 启动分清平台、Worker 与模型的职责，以及主机内存、设备显存和 token 预算的边界。 `10`
- [Scheduler：每一步给哪些请求算几个 token](concepts/vllm-scheduler.md) — Scheduler 在 EngineCore 每步开头只看每条请求还差几个位置，在 token 预算、请求数上限和KV 块之内先续 running、再用余量接 waiting，借不到块就抢占或停止接纳，在调度器里不分 prefill 和 decode（worker 侧仍有分路）；GLM 双机上每个 DP 组一步最多 8192 个 token、32 条请求，纯 decode 步只用 128 个。 `12`
- [vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环](concepts/vllm-v1-shape.md) — vLLM V1 把推理服务拆成前端、EngineCore、Worker 三类角色：前端管文字，EngineCore 每一步排一份调度计划、拿回结果更新进度，Executor 把计划交给每张卡上的 Worker 执行。本页讲这个循环里各组件的分工、两道边界上交接什么，以及 R1 在双机部署上绕一圈的样子。 `10`

## 特性（feature）
- [ACL Graph：捕获、批形状与重复执行](concepts/acl-graph.md) — 昇腾上把一步前向的设备任务连同地址录成一张图、之后整串一次提交的那套实现。讲清 decode 为什么等的是 Host、一张图里存了什么、什么进不了图，以及 GLM 双机上录的 7 张图，以及视觉编码器按输出容量另行捕获的条件。 `16`
- [AI QoS：共享链路拥塞时，哪类流量先走](concepts/ai-qos.md) — AI QoS 在受支持的 A3 网络上给流量分类、映射虚拟通道并设置服务先后。理解关键通信与 KV 搬运的争用，再核对端点和交换机两步配置、恢复边界及各版本差异。 `07 09`
- [Ascend 配置：三个地方能写，哪个值真的生效](concepts/ascend-config-system.md) — 昇腾开关有三个入口——命令行通用参数、启动命令附带的那段 JSON、环境变量。本页讲它们怎样汇进每个进程各自的 AscendConfig，谁覆盖谁，构造与平台两道检查会怎样改写，以及官方 GLM 双机为什么一个 JSON 键都没传。 `10`
- [Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类](concepts/ascend-patch-system.md) — patch 是 vllm-ascend 在进程里把上游模块中的名字改指向昇腾实现的做法。global patch 由平台准备钩子和通用插件 入口加载，worker patch 在 Worker 构造时加载；正常成功导入由标记和缓存去重。本页按固定 GLM 条件区分导入与 实际调用，并对照 v0.23 / v0.26 rc / main / rc2 的入口与清单。 `10`
- [Async scheduling：趁卡在算，先把下一步排好](concepts/async-scheduling.md) — 异步调度让 CPU 在 NPU 算这一步时就排好下一步：调度器用输出占位记下还没回来的 token，Worker 在卡上补真值，结果回来再销账。讲清收益与代价、投机解码下先按全接受排再改正、在途结果怎样收尾、换调度器的特性为何要备异步版，以及 GLM 双机上 R1 每一步的占位账。 `12`
- [Balance Scheduling：一组顶满，各组一起停收新请求](concepts/balance-scheduling.md) — MoE 模型的多个 DP 组每步互报 running 条数，最满的一组顶到上限时所有组暂停接纳 waiting；讲清为什么需要、闸门与互报放在哪、只数条数的局限，以及 GLM 双机未启用时的对照。 `12`
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md) — 同一条请求换了同批的伙伴，浮点加法的分组就可能变，末位随之变化。本页先讲这件事怎么发生，再讲把加法顺序钉死的做法、要付的代价，以及 GLM 双机上的启用状态与缺口。 `16`
- [Batch-Job-Aware Scheduler：先给正在生成的请求留块，再按作业接新请求](concepts/batch-job-aware-scheduler.md) — vllm-ascend 为离线批处理准备的调度器：接新请求前先估计 running 下一步要借几块 KV 块并扣下来，只拿余额接新请求；waiting 按作业分桶，用已自然结束请求的输出长度估计决定先接哪个作业，桶内挑放得进预算的最长提示词。只改 waiting 一段，不防饿死；GLM 双机钉住的镜像里没有它。 `12`
- [Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住](concepts/chunked-prefill.md) — Chunked prefill 让调度器在一条长提示词装不下这一步时，只给它排剩余预算那么多个位置，下一步从断开处接着算；历史和状态跨段延续，只有最后一段产出首个 token。它让正在 decode 的请求每步照常前进，代价是长请求的首 token 更晚、旧历史要重复读、每步多一点杂活。 `11`
- [上下文并行（CP）：怎样分位置，又怎样算完整 attention](concepts/context-parallel.md) — 长序列怎样分给多张卡，为什么会头尾配对；用同一组位置追踪 All-Gather、Ring Attention 和 Ulysses，演算局部结果怎样恢复完整 attention，再对照 Ascend PCP/DCP 与 GLM 的支持边界。 `15`
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md) — 模型在 NPU 上算，主机侧的 Worker 仍要准备张量、下发算子；绑核从这颗卡的亲和节点出发，通常再补上编号下一个 NUMA 节点里允许的核组成一个池，共用一个池的卡按卡序平分，线程钉在分到的核上，已分配的内存页迁到其中编号最小的核所在的节点。本页讲它怎么挑核、默认开关、GLM 双机上 8 个 Worker 各绑在哪里，以及拿不到拓扑或核数不够时会怎样。 `16`
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md) — DP 把请求分给不同执行组，各组独立排队调度。稠密模型通常每组持有一份权重；本页固定 vLLM 的 MoE 路由专家跨组切分，因此一个请求虽然归属一组，专家计算仍需其他组参加，空闲组也要陪跑；这由 MoE 触发，与是否开 EP 无关。最后落到 GLM 双机的 DP2。 `13`
- [DSpark：先猜几个，再决定值得验证几个](concepts/dspark.md) — 用两条请求的候选概率算出怎样分配验证预算，再加入实际每轮耗时判断收益；解释半自回归草稿、置信度累乘、CPU/设备异步分工，以及接受率高却不更快时的排查方法。 `19`
- [动态分块流水线：按预计耗时切 prefill 块](concepts/dynamic-chunked-pp.md) — 开了 PP 时，长提示词按「已经算了多少、这一块预计要多久」反推每块切多大，让各块耗时相近、后一段少空等；讲清等长块为什么越来越慢、23 格变 17 格的账、二次曲线反解、开机试跑与时间账，以及 GLM 双机 PP=1 开不了的边界。 `13`
- [DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组](concepts/dyntra-lb.md) — 已钉 vllm-ascend main 与 rc2 中 PD 分离 decode 端的 DP 负载均衡：各组每步互报按 token 数估计的 KV 块数，下一步在本组内暂停或接纳请求，让各组注意力负载接近；不搬请求，暂停不还 KV。讲清与 EPLB、Balance Scheduling 的分工、计划怎样算、何时生效，以及本部署为何没开。 `12`
- [EPLB：按实测热度调整专家放在哪张卡](concepts/eplb.md) — EPLB 在推理中统计每个专家接到的 token–expert 配对数，按峰均比重排专家位置、必要时加副本，再逐层搬权重并换表；本部署未启用，只给开启条件与估算。 `14`
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md) — EP 把完整专家分放到不同卡上，让 token 去找选中的专家，算完再收回结果。先看这个过程，再沿 GLM 双机部署跟一个 token 走过 MoE，最后核对通信、陪跑与多请求负载。 `14`
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md) — 细粒度 TP 让词表嵌入、lm_head、attention 输出投影、稠密 MLP 各自单独设分片组：沿 DP 方向把服务不同请求的几张卡编成一组，合存一份权重；代价是进出这一层要收集输入、送回结果。GLM 双机没有开启。 `13`
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md) — 官方双机配置下 16 张卡各放了什么、启动时按什么顺序做完哪几件事、关键参数分别管住主线的哪一步，以及这套部署给后面各章留下的后果。 `13`
- [graph mode：录一次执行次序，之后整串回放](concepts/graph-mode-layer.md) — 从 Host 逐个提交任务讲起，说明 graph mode 录的是执行次序而不是结果；区分编译改写、捕获与回放，列出官方双机上 FULL_DECODE_ONLY 配方指定的 7 个捕获尺寸、一轮选择哪张图的五条判据，以及回放前必须更新什么。 `16`
- [KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存](concepts/kv-cache-cpu-offload.md) — 把可保存的KV状态复制到主机，后续命中时搬回设备以减少重算。用普通整段路径说明页、段、带宽和异步等待，再区分新版部分尾状态、私有锁页与共享mmap。GLM主线未开，释放的池容量也不能当成实际恢复字节。 `11`
- [Layerwise KV offload：KV cache 一层一层搬，边算边搬](concepts/kv-cache-layerwise-offload.md) — 把 KV cache 在显存和外部存储之间的搬运，从「整趟前向搬一次」拆成「每层搬一次」，通过提前加载让不同层的搬运与计算重叠。 讲清重叠条件、能省多少等待（示意数）、每层什么时候要等、共享槽怎样省显存，以及 GLM 双机主线为什么没开。 `11 18`
- [KV cache 量化：以 INT8 C8 为例，历史怎样存窄再读回](concepts/kv-cache-quantization.md) — KV cache 量化降低历史 k、v（MLA 模型是潜向量）的存储精度；本页以 INT8 C8 为例，演示写入压缩和读取时的缩放。相对 16 位缓存，元素载荷约减半，代价是量化误差留在缓存里。再区分元素与整卡容量、decode 与 prefill、FP8 与 KIVI，以及 Ascend 上的三条实现；固定 GLM 双机部署没有开它。 `11`
- [Sparse KV offload：历史放主机，每步只搬这次要读的几行](concepts/kv-cache-sparse-offload.md) — 主 attention 的完整历史放在主机内存，设备上只留 indexer cache 和一小块热缓冲；每步 sparse attention 选完位置，只把热缓冲里缺的行搬回来。讲清它与 CPU offload、抢占换出在存的对象、粒度、取回条件上的区别，一步里的顺序与代价，以及它只支持 Atlas A3、GLM 双机（A2）为什么用不上。 `11`
- [KV Pool：把算过的开头存进外部池，别的实例也能取回](concepts/kv-pool.md) — KV Pool（外部 KV 池）让推理实例经 KV connector 把算完的整段 KV 存进主机内存、SSD 或别的节点拼成的共享存储；开头相同的请求先看本地 prefix caching 命中几段，池只补多出来的整段。讲一次查询怎样取整相减、查到后的搬运与写回、记录的名字，以及和抢占换出的区别；GLM 双机没有开它。 `11`
- [KVPP：KV cache 按层分给各卡常驻，算到时整层广播](concepts/kvpp.md) — TP 组里 MLA 的 KV cache 每张卡各存一份一样的；KVPP 把各层分给不同的卡长期保存，每卡另留 2 个暂存区，算到某层时由常驻卡提前一层整层广播。讲清分法、容量账、广播与等待、能和谁一起开；已钉 main 与 rc2 都有此实现，只接受非混合 MLA 模型，GLM 双机没有开也开不了，GLM 段只做变体推导。 `13`
- [大规模 EP：请求路由、专家域与跨机通信](concepts/large-scale-ep.md) — 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端点与进程的区别。 `14`
- [LMCache：接在引擎外面的一层 KV 缓存](concepts/lmcache.md) — LMCache 是装在推理引擎外面的一层 KV cache 缓存，经 vLLM 的 KV connector 插口对接：引擎管调度和显存，它管外部数据并回答能提供到第几个位置。本页讲这条交接边界、按 chunk 取整的账、和 AscendStore 版 KV Pool 的区别，以及 GLM 双机上为什么没开。 `11`
- [LoRA：低秩更新与多适配器推理](concepts/lora.md) — LoRA 不改基座权重，只在旁边挂两个小矩阵；本页从一个输出数怎么算讲到一台服务怎么同时挂多个适配器，最后核实本部署没有启用。 `17`
- [Mooncake 连接器：先对好块号，再按层搬历史状态](concepts/mooncake-connector.md) — vLLM 的 KV connector 在昇腾上的 Mooncake 实现：调度器那一半记账（远端能补几个位置、押哪些块），worker 那一半把块号换成显存地址，用 Mooncake 传输引擎在 P、D 之间直接读写；V1 整批拉，Layerwise 逐层推。官方双机没有开。 `18`
- [Netloader Guide：新实例怎样从已有 NPU 接过权重](concepts/netloader-guide.md) — Netloader 在启动时从已有实例的 NPU 接收同一分片的权重，省去重复读取权重文件。解释握手、逐张量传输、量化缓存、失败回退，以及 GLM 双机未启用的事实和 main 的布局传输变化。 `19`
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md) — 昇腾插件交给 vLLM 的平台实现。启动时它按组合校验整份配置、就地改写，再答出 Worker 类、注意力后端与图包装的类名；也是「查不到设备显存以后默认 token 预算怎么定」的唯一推导处。 `10`
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md) — 每张 NPU 上有一个 NPUWorker。启动时它先换补丁、选卡建通信组、装本卡那份权重、试跑量出 KV cache 预算；EngineCore 收齐各卡的数、按最紧的那张卡定块数并发回配置后，每张卡再建缓存池，最后预热并录 decode 图。每一步用到上一步的产物，所以顺序固定。预算怎么扣、块怎么借、系统怎么分层各有专页，本页只讲这条先后链。 `10`
- [编译图融合：把相邻两步合成一个算子，再分档复用执行](concepts/npugraph-ex.md) — 从中间张量的一写一读讲清编译期融合，列出固定源码里的四条融合规则、它们各自的条件，并区分 npugraph_ex 后端、static kernel 与分档捕获在 GLM 双机 MTP 验证那一步各自管什么。 同时说明编译缓存怎样复用产物，以及视觉编码器编译与视觉图捕获的区别。 `16`
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md) — 模型里的一次运算怎样经框架替换表、量化方法或模型自己的调用，落到 torch_npu 已有算子或仓库自编译扩展，再经 CANN 下发成设备 kernel；并沿 GLM 双机的一层列出各站的实际算子。 另解释 IR 怎样按参数选择实现，以及它与 Ascend 类替换和原地复用的关系。 `16`
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md) — 把一条请求的 prefill 与 decode 交给 P、D 两套实例，中间由连接器交接历史状态。沿 Mooncake V1 看交棒、D 拉取、完成信号与押块，讲清 GLM 这类混合模型为何让 P 少算最后一个位置；本站双机主线没有开 PD，只作变体对照。 `18`
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md) — 把模型的层按顺序切成几段放到不同的卡上，一个请求依次流过各段；讲清为什么这样切、段间交接什么、气泡从哪来，以及 GLM 双机为什么没开 PP。 `13`
- [插件发现与模型注册](concepts/platform-plugin-registration.md) — 昇腾包通过入口点清单接入 vLLM；入口须被允许加载并成功执行，设备可用性另行检查。vLLM 在相应进程的初始化入口按组名加载——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型实现；次数取决于启动方式与进程内防重状态。 `10`
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md) — 通过输入指纹找到可复用的前缀块，后来的请求共享命中块，省去相应的prefill计算。固定旧GLM镜像默认关，显式打开走align，公共恢复边界按640对齐；新版的默认值与部分尾块能力须分别确认。 `11`
- [W8A8 量化：权重压成 INT8，算完再乘回缩放系数](concepts/quantization.md) — 量化用较少位数和相应缩放表示数值。本页用 INT8 W8A8 讲缩放、零点、舍入、截断与反量化，再分清动态与静态量化，最后落到 GLM 双机：两个 8 位分别从哪来、哪些矩阵保持 BF16、缩放系数占多少字节；其他格式、算法、ND/NZ 与验收各有延伸页。 `11`
- [Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回](concepts/recompute-cpu-offload.md) — vllm-ascend 给 PD 分离 D 节点配的连接器：RecomputeScheduler 让出一条请求前先问它，主机块够就把这条的全部 KV 块同步拷到主机，重新排上时在前向前搬回，完成通知后再调度；旧版保存失败则交代理退回 P。讲清两条恢复路径的取舍（示意数）、和 CPU 备份、KV Pool 的区别；新版失败路径需按并行设置区分。GLM 双机主线不拆 P/D，没有启用。 `11 12`
- [RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算](concepts/recompute-scheduler.md) — PD分离的D节点续块失败时，优先尝试保存被抢占请求的状态，稍后恢复；旧版不能保存时发recomputed结束帧，由代理重投P做prefill。客户端结束、引擎收尾和状态保存是不同步骤；rc2细粒度TP还可能直接中止。GLM双机主线不拆PD，不启用此调度器。 `12`
- [RFork：工作版机制与排错总览](concepts/rfork.md) — 新实例启动时可按地址读取兼容来源显存中的权重；借不到或读取失败时，停止 seed 服务并安全清理登记内存后可退回默认加载。本页是 RFork 工作版的入口：借的步骤、四种「成功」、GLM 双机推演和全章唯一的版本对照。
- [RFork 配置：四类端口、各项超时与可复制的启动示例](concepts/rfork-config.md) — 想让第二个实例从已有实例借权重，启动命令里要多写什么。这页讲工作版 RFork 的十一项客户端设置和四类端口：多数写错为什么不报错、只会退回正常加载；固定端口只固定了哪一个、主模型和草稿模型为什么会撞；单次超时、还租约重试和租约有效期各管什么；GLM 双机每台开多少端口、默认租约够不够，以及怎样验收。
- [RFork 身份匹配：同模型、同布局，还要同一份分片](concepts/rfork-identity.md) — B 的每张卡凭一把 seed key 向 Planner 找 seed：先把版本、数值类型、量化、并行大小和昇腾排布算成部署指纹，再加上 TP / PP / EP 编号和主 / 草稿角色做一次 SHA256。本页讲钥匙里有什么、没有什么，为什么同一个模型也可能借不到，钥匙对上为什么不代表内容一样，以及 GLM 双机上 32 把钥匙各写什么编号。
- [RFork 张量布局：先对齐算子要的形状，再决定搬什么](concepts/rfork-layout.md) — 新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则先读取，再执行适用的后处理。 要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
- [RFork 生命周期：传完权重、交出模型、当上 seed、接请求各是一步](concepts/rfork-lifecycle.md) — B 的一个 Worker 借完权重后，传完、交出模型、还上租约当 seed、整个实例接请求是四个时刻。讲会话七个状态、还租约的三种结果与 400/404 各说明什么、发布 seed 的已启动/延期/失败、回退前的清理结果、关停留下什么，以及为什么没有续租。
- [RFork 版本维护：保留原补丁，钉住真正运行的完整代码](concepts/rfork-maintenance.md) — 同事又发来一份 RFork 补丁时，怎么弄清现在跑的是哪版代码。这页讲：工作版为什么和社区版本分开维护，原来七份补丁为什么不能直接当一条链往上叠， 代码在项目里存在哪、怎么核对没被改动，新补丁来了要回看哪几页，以及哪些事只有到真机现场才能确认。
- [RFork 启动：准备模型以后才借 seed，失败后先清理再重建](concepts/rfork-startup.md) — 新实例用 RFork 加载模型时，每个 Worker 先在本卡搭好模型、转好布局，再向 Planner 借 seed、按地址读权重；借不到或读失败，先清理干净再从存储普通加载。本页按十步走一遍，讲清为什么晚申请租约、两处提前离开、回退怎样清理、三类「没有可用 seed」，以及 GLM 双机第一次冷启动怎么走。
- [RFork 传输：登记空位、核对清单、分批读字节](concepts/rfork-transfer.md) — 借到 seed 后，B 的每个 Worker 先把放权重的空位登记给传输引擎，再用 HTTP 向 seed 要清单、整份逐项核对， 通过后由 B 按地址分批把字节读进来；任何一步失败都先注销登记、撤掉半成品再回退。也讲登记怎样保住内存， 以及主模型和草稿模型共享地址时字节怎么分开算。
- [RFork 排错：从第一条异常还原版本、阶段与资源状态](concepts/rfork-troubleshooting.md) — RFork 出错时从哪查起：四步检查失败共用同一句汇总、要往前找具体异常，直接抛的异常则写在汇总里；再看模型、租约和显存各停在哪一步。按借不到来源、清单对不上、显存登记或清理出错、读数据失败、还租约被拒、看起来卡住六类现象，列出能确定的事、候选原因、该补的证据和不该做的事；示例 Planner 的 400 只来自请求头解析失败，到期回 404。
- [序列并行（SP）：让局部激活按 token 分片](concepts/sequence-parallel.md) — Megatron SP 配合 TP，让归一化、残差等区域按 token 分工；沿同一组数看清部分和怎样归约、每卡怎样计算、何时收集并交给下一次投影，并区分 Ulysses、CP 与 Ascend FlashComm1。 `15`
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md) — 等待的新请求按提示词长短分进短、长两条车道，每步用剩余预算接纳新请求时先取短的；被抢占或算过一部分的请求排在最前，长请求达到等待门槛可提升候选优先级，但不保证时限。它只改从哪条队里拿下一个，不改预算和切分；本部署钉住的代码里没有它，v0.26 起才有。 `12`
- [Sleep Mode：暂停推理时怎样把显存让给训练](concepts/sleep-mode.md) — Sleep Mode 在保留引擎进程的同时释放可睡眠内存池：level 1 把权重备份到 CPU，level 2 丢弃权重，两者都丢弃旧 KV cache。说明唤醒顺序、请求处理、GLM 双机未启用的原因与版本差异。 `19`
- [Speculative decoding：先猜几个 token，再让主模型一次验完](concepts/speculative-decoding.md) — Speculative decoding（投机解码）先用便宜的办法猜出后面几个 token，再让主模型一次前向验证：猜对几个就多出几个，第一个猜错处换成主模型自己的答案。讲清接受规则、被拒位置的收场、为什么也可能变慢，以及 GLM 双机上 MTP 每步猜 3 个的做法与版本差异。 `17`
- [结构化输出：文法怎样在采样前屏蔽不合法的 token](concepts/structured-output.md) — 结构化输出在打分和采样之间加一道关卡：文法状态算出下一步允许的 token，其余候选的 logits 改成 −∞ 再采样。先看这个过程，再沿 GLM 双机看 bitmask 在哪个进程、哪一步算出，怎样作用到 logits，以及它和 MTP 草稿、思考阶段的配合。 `17`
- [SWA bounded replay：历史窗口丢了，为什么只重算一小段](concepts/swa-bounded-replay.md) — 用窗口为三个位置的小例子推演回放为何近似，分清 encoder 缺失恢复与 decoder 窗口准备、128/134/140 的不同口径，以及 mask/compact 一致不能证明与完整重算一致。 `19`
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md) — 把同一层的矩阵分给多张卡：先列切，各卡算出完整数值的几列；本地激活后接行切，最后一次求和合齐结果。沿 GLM 双机的一次前向，核对通信和显存代价。 `13`
- [UCM：把算过的前缀分三层存到显存之外](concepts/ucm.md) — UCM（Unified Cache Manager）是经 KV connector 接进 vLLM 的外部缓存软件包：把算过的前缀 KV 从显存存到本机内存、再落到共享存储，按官方文档换实例或重启后也能取回，省掉重复的 prefill。讲清它和 KV Pool、LMCache 的分工，PD 分离时的两种数据流，以及 GLM 双机为什么没开、开了还缺什么。 `11`
- [vLLM-Ascend for RL：生成样本后，怎样安全换上新权重](concepts/vllm-ascend-for-rl.md) — RL 训练框架用 vLLM-Ascend 生成样本，再把新权重交回推理端。本页串起暂停、同卡与跨卡权重传输、训练数据返回和数值一致性，并区分 main 的统一配置与 GLM 固定版本。 `19`

## 参数（param）
- [absolute_balance_threshold](params/absolute-balance-threshold-71578a0c428d.md) — STAIR 判断某层要不要重排的绝对门槛：均衡度（峰均比的倒数）跌到 0.90 及以下就进规划。rc2 已接入 MRV2 的 EPLB；早期扫描快照 4d1412d1 尚未接入服务。
- [block_table_no_commit_optimize](params/block-table-no-commit-optimize-8328d0d2d00d.md) — 已不存在的键：曾是 MRv1 块表优化的回退开关，只在 main 上存在过一天（09-23 引入，09-24 随优化一起回退），钉住的各版本都没有它。当时默认 0 用只提交脏行区间的 OptimizedBlockTable，写 1 换回整行 H2D 拷贝的老实现——名字容易读反，它是关优化的。
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md) — 让 LightningIndexer 的 C8 缓存由 scatter 更新改走 StoreKVBlock 分组写入。旧 v0.23/v0.26 快照默认 false；固定 main 与 rc2 默认 true，但还须满足模型、索引 C8 和 PD 的 P 节点条件。本站旧 GLM 双机部署没开，旧后端会拒绝启用；新版 kpool 模型在派生条件中被排除。 `17`
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）通信时用哪种量化：非 0 就强行覆盖模型自己推出来的模式，只认 0/2/3/4，默认 0 不干预。固定 main 与 rc2 有此键，v0.23 与 v0.26 两个旧发布分支上配了会被静默忽略；rc2 最终模式还受硬件能力与消费者约束。 `14 17`
- [cross_node_transfer_limit](params/cross-node-transfer-limit-06ee92260b7a.md) — STAIR 一次层规划里每个节点跨节点发出、接收的专家搬运各自的上限：-1 不限、0 禁止跨节点。rc2 已接入 MRV2，声明默认 -1；自动回退 Gloo 时仅把未显式配置的限额收紧为 1。早期扫描快照默认 1。
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，v0.25.1rc 起已整体删除，残留的这个键在 v0.26 上被静默忽略、在 main 通常拒收，能发现 vLLM-Omni 时会警告并过滤未知顶层键。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — 把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_rank 算出来的轮转表，让每张卡收到的 token 分布更可控——压测和算子调优用，会改变模型路由语义，不能拿其输出测原模型精度。默认 false，固定 main 与 rc2 有此键；GLM 双机部署用的旧版本里没有，没开。 `14`
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 与 v0.24.0rc 有，v0.25.1rc 起整体移除，v0.26 上配了被静默忽略、main 通常拒收（可发现 vllm_omni 时告警过滤）。GLM 双机部署没开，W8A8 下按源码看开了也走不通。 `13`
- [enable_pcp_embedding_lmhead_weight_sharding](params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md) — PCP>1 且模块匹配时，把 embedding 与 LM Head 补齐后的词表权重按 TP×PCP 网格切分。bool 默认 true，要旧行为得显式写 false；与细粒度 TP 的 embedding/lmhead 两键互斥。旧 v0.23、v0.26、固定 main 没有，rc2 已有；GLM 双机不开 PCP 也用不到。
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — 加载期按 PCP 组切 o_proj 权重，常驻留 1/pcp_size；prefill all-gather 全量，decode 用本地片。本文讲 baa023ad 的 SFA-PCP：静态默认 false，v0.23/v0.26 无，对 DSA-CP 无效。rc2 已有且声明默认 true，实际启用仍须满足 PCP 与 runner 条件；GLM 双机不开 PCP，用不到。 `15`
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外释放 HCCL 设备侧通信组、清空 ACL 图工作区；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23 与 v0.26 使用顶层键，固定 main 与 rc2 使用 rl_config。rc2 还用跨休眠周期的 HCCL anchor 保护通信域清理与恢复。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — ascend_compilation_config 中的 Super Kernel 优化开关：在编译与图捕获时提交优化选项和 scope。固定 v0.26 维护快照及 main 中可用，省略时跟随 enable_static_kernel；实际生效还受图模式和硬件限制。 `16`
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，v0.25.1rc 起已整体删除，v0.26 上配了被静默吞掉、main 上直接报错。 `13`
- [fused_op_type](params/fused-op-type-fc0f5fcd7be0.md) — Sparse KV Offload 的 decode 用不用融合算子：默认 none 走原来四步，fused_copy_sfa 换成 LIM 与 Copy_SFA 两个融合算子。rc2 已有并接入 V1/V2，支持 LI C8 的 int8 路径；早期固定 v0.23、v0.26 与 main 快照没有此键。
- [kvpp_config](params/kvpp-config-0445bd352140.md) — AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进 additional_config 会被静默剔掉。固定 main 与 rc2 有此派生对象；旧 GLM 部署没有。rc2 新增 PIECEWISE 与固定候选数 mtp/dspark 组合，仍须满足完整 KVPP 检查。 `11`
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重常驻在通信组内第 i % K 张卡上，其他卡前向时通过窗口接收广播。 v0.23 固定代码只允许 P 节点使用非空列表；v0.26、rc2 与 main 固定代码已删除旧路径。 GLM 双机基线是混部，非空配置会触发启动校验。 `13`
- [load_risk_quantile](params/load-risk-quantile-d89a080ba048.md) — STAIR 估负载时按多悲观的分位数算：专家与每张卡的负载记作均值加 z 倍标准差，z 由这个分位数换算，默认 0.75 即 z 约 0.674。rc2 已接入 MRV2 的 EPLB；早期扫描快照尚未接入服务。
- [load_window_bins](params/load-window-bins-cc21068b082d.md) — STAIR 把上游 EPLB 负载窗口按时间顺序压成至多这么多段再算均衡度、方差与协方差：默认 64，范围 2 到 256。rc2 保留压缩含义并已接入 MRV2；早期快照 4d1412d1 的规划器尚未接入服务。
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；v0.24.0rc 起整套实现已删除，键留在启动命令里 v0.26 上被静默忽略、main 通常拒收，能发现 vLLM-Omni 时会警告并过滤未知顶层键。 `14`
- [placement_search_backtrack_limit](params/placement-search-backtrack-limit-82b03cef98b0.md) — STAIR 为每个候选限制接受可行替代摆放的次数：默认 32，范围 0 到 64；0 仍允许每个决策的首个可行选择及跳过不可行试放，只禁止接受替代可行选择。 rc2 已接入 MRV2 的 EPLB；历史走读使用的 4d1412d1 规划器尚未接入服务。
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 上被静默忽略、main 与 rc2 通常拒收，Omni 环境告警过滤，没有等价替代键。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — Ascend 中称为 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，减少 PP 流水线因各块耗时不均产生的等待。默认关闭，要求 PP>1 且与负载均衡调度互斥；官方定位是 PD 分离里 P 节点的长序列优化。 `12 13`
- [rank_transfer_limit](params/rank-transfer-limit-99529b37d91d.md) — STAIR 的每卡搬运上限：一层一次规划里限制每卡换入专家与充当搬运来源的次数，也约束副本数调整步数。rc2 声明默认 -1 表示不限；自动回退 Gloo 时仅将未显式配置的限额收紧为 1。历史扫描快照默认 1。
- [relative_balance_threshold](params/relative-balance-threshold-bcbc40e7dc87.md) — STAIR 的相对重排门槛：某层当前平衡度 ÷ 上次提交新摆法时预测的平衡度 ≤ 本值（默认 0.95）就重新规划这一层，与绝对门槛是「或」的关系；从没提交过的层不看门槛。rc2 已接入 MRV2 的 EPLB；早期扫描快照尚未接入服务。
- [replica_search_beam_size](params/replica-search-beam-size-6556d1650a62.md) — STAIR 副本数搜索的束宽：每一段只留这么多个最好的候选往下走，最终至多这么多组副本份数进入带约束的摆放；默认 64，合法 1–128。写 1 时唯一的候选会被换成「份数不变」，副本数不调。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
- [replica_search_num_stages](params/replica-search-num-stages-e4b10925ff97.md) — STAIR 搜「每个专家放几份副本」时分几段做决定：专家按风险从高到低切成这么多组，前面每组各选一次「这组多拿几个副本位」，最后一组贪心补齐；默认 4，合法 1–8，写 1 时目标只剩贪心那一个。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
- [replica_search_radius](params/replica-search-radius-cd3118b5aae5.md) — STAIR 副本数搜索每一段的试探范围：以贪心给这一组的额外副本位个数为中心，向两边各试多少个取值；默认 8，合法 0–32，写 0 时目标只剩贪心那一个。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — DCP 解码路径上 query gather 之后，是否要求恢复为 t-major 连续存储；只有恢复视图尚不连续时才额外复制。 这是布局对照开关，默认 false 保留视图。固定 main 与 rc2 都有；它只影响命中该分支的 SFA-DCP 布局恢复。 `15`
- [size](params/size-40a1c2ca47b8.md) — KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP × PCP，用户不能直接写。固定 main 与 rc2 都有；rc2 保留派生规则，运行组合的变化见 KVPP 页。 `11`
- [stair_config](params/stair-config-cca9e594a052.md) — eplb_config 下给 STAIR（vllm-ascend 为 model runner v2 写的 EPLB 规划算法）调参的嵌套 dict，十个键分管负载窗口、重排门槛、副本数搜索、搬运上限与回退次数。rc2 已接入 MRV2 且默认策略为 stair；旧 v0.23、GLM 镜像、v0.26 和固定 main baa023ad 没有这个键。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — Sparse KV Offload 的融合重叠 decode 开关，位于 sparse_kv_offload_config，默认 false；融合路径把未命中 KV 的主机到设备搬运与 attention 计算流水化，并更新设备选择缓存。固定 main 与 rc2 都有，rc2 还与 fused_copy_sfa 互斥，仍受硬件和执行阶段条件限制。 `11`
- [use_layerwise](params/use-layerwise-b475778cd352.md) — KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是 --kv-transfer-config 的 kv_connector_extra_config；v0.23、v0.26、固定 main 与 rc2 都有，默认 false。GLM 双机没开；连接器在含整图的配置下要求改用 PIECEWISE。 `11`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 vector 计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上通常报错。GLM 双机默认没开；手动开启后 MoE 路径取不到权重，两份固定量化目录均不进入静态 attn 预取；稀疏 MLA 仍有不读比例的独立预取。 `19`

## 来源（source）
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md) — 一次问答的归档：块表里既不分配也不回收，分配与回收在上游 EngineCore 进程的 KVCacheManager / BlockPool 里，块表只事后记账。算例是当时的 Qwen3-0.6B 单卡旧例，不是 GLM 双机实测；机制说法已按钉住源码补核。 `11`
- [AscendConfig 四版本来源摘要](sources/ascend-config-version-source.md) — 四个固定快照展示共享专家开关、动态分块设置和配置缓存的取值变化；main 与 rc2 仍读取 FlashComm1 输入，环境值的解析和优先级需分版本核对。 `10`
- [GLM-5.3-Flash：模型配置与官方双机来源基线](sources/glm-5-3-flash-baseline.md) — 固定 GLM 主线的模型配置、双机教程、控制流与执行侧提交，区分配置、源码推导、量化假设和镜像证据；最终安装产物与权重配套仍待核实，尚未实机部署。
- [GLM 稠密 MLP 固定版本源码摘录](sources/glm-mlp-version-source.md) — 固定 main 与 rc2 的 GLM 稠密前馈实现相同，记录激活限制和序列并行设置；v0.23、v0.26 的指定路径缺失，不能据此判定整个功能不存在。 `10`
- [RFork 官网核读：原图、全部章节与工作版差异](sources/rfork-official-guide.md) — 对照固定官方指南、社区 rc2 与独立 RFork 工作版，说明身份、端口、租约和布局协议的差异；保留旧指南的模型记录及适用日期，避免把移动的 latest 当成工作版支持证明。
- [v0.30.0rc2 的版本基线与阅读边界](sources/v030rc2-baseline.md) — 固定用户指定的 Ascend rc2 分支及配套 vLLM，区分 PCP、DCP、DSA-CP、执行器和 GLM 教学基线，避免把正式版或浮动 main 的行为混入对照。 `10 15`

## PR（pr）
- [[Refactor] remove layer sharding](sources/pr-11953.md) — vllm-ascend PR #11953（2026-07-15 合并）的归档：删除 layer_sharding。 v0.24.0rc1 是已核标签中最早包含这次删除的版本；v0.23 维护分支和本站 GLM 钉住的 db701c1f 上它还在，GLM 双机混部不适用。 `21`

## 按章节

### 10 引擎架构与插件机制
- [API server 入口：一个 HTTP 请求怎样变成引擎里的请求](concepts/api-server-entry.md)
- [Ascend 配置：三个地方能写，哪个值真的生效](concepts/ascend-config-system.md)
- [AscendConfig 四版本来源摘要](sources/ascend-config-version-source.md)
- [Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类](concepts/ascend-patch-system.md)
- [引擎有哪几个进程：API server、EngineCore 与 Worker](concepts/engine-processes.md)
- [GLM 稠密 MLP 固定版本源码摘录](sources/glm-mlp-version-source.md)
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md)
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md)
- [插件发现与模型注册](concepts/platform-plugin-registration.md)
- [v0.30.0rc2 的版本基线与阅读边界](sources/v030rc2-baseline.md)
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md)
- [EngineCore：vLLM 里一圈一圈推着请求往前走的循环](concepts/vllm-engine-core.md)
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md)
- [vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环](concepts/vllm-v1-shape.md)

### 11 KV cache 内存系统
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md)
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md)
- [Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住](concepts/chunked-prefill.md)
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md)
- [KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存](concepts/kv-cache-cpu-offload.md)
- [Layerwise KV offload：KV cache 一层一层搬，边算边搬](concepts/kv-cache-layerwise-offload.md)
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md)
- [KV cache 量化：以 INT8 C8 为例，历史怎样存窄再读回](concepts/kv-cache-quantization.md)
- [Sparse KV offload：历史放主机，每步只搬这次要读的几行](concepts/kv-cache-sparse-offload.md)
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md)
- [KV Pool：把算过的开头存进外部池，别的实例也能取回](concepts/kv-pool.md)
- [kvpp_config](params/kvpp-config-0445bd352140.md)
- [LMCache：接在引擎外面的一层 KV 缓存](concepts/lmcache.md)
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md)
- [W8A8 量化：权重压成 INT8，算完再乘回缩放系数](concepts/quantization.md)
- [量化验收：怎样判断省了内存、保住质量、真正提速](concepts/quantization-evaluation.md)
- [量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择](concepts/quantization-methods.md)
- [Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回](concepts/recompute-cpu-offload.md)
- [size](params/size-40a1c2ca47b8.md)
- [ND 与 NZ：张量的数值没变，内存里怎样重新排列](concepts/tensor-layout.md)
- [UCM：把算过的前缀分三层存到显存之外](concepts/ucm.md)
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md)
- [use_layerwise](params/use-layerwise-b475778cd352.md)
- [KV 块分配：块从池里借出、共享、归还](concepts/vllm-kv-block-allocation.md)

### 12 Scheduler 与调度策略
- [Async scheduling：趁卡在算，先把下一步排好](concepts/async-scheduling.md)
- [Balance Scheduling：一组顶满，各组一起停收新请求](concepts/balance-scheduling.md)
- [Batch-Job-Aware Scheduler：先给正在生成的请求留块，再按作业接新请求](concepts/batch-job-aware-scheduler.md)
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md)
- [DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组](concepts/dyntra-lb.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回](concepts/recompute-cpu-offload.md)
- [RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算](concepts/recompute-scheduler.md)
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md)
- [Scheduler：每一步给哪些请求算几个 token](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md)
- [DP 请求路由：新请求派给哪一个 DP 组](concepts/dp-request-routing.md)
- [动态分块流水线：按预计耗时切 prefill 块](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [HCCL buffer：通信缓冲怎样配置与占用显存](concepts/gap-a5164fe10fa9184412f8.md)
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md)
- [KVPP：KV cache 按层分给各卡常驻，算到时整层广播](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md)
- [EPLB：按实测热度调整专家放在哪张卡](concepts/eplb.md)
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md)
- [大规模 EP：请求路由、专家域与跨机通信](concepts/large-scale-ep.md)
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 15 并行 III：SP / CP / PCP / DCP
- [上下文并行（CP）：怎样分位置，又怎样算完整 attention](concepts/context-parallel.md)
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)
- [序列并行（SP）：让局部激活按 token 分片](concepts/sequence-parallel.md)
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md)
- [v0.30.0rc2 的版本基线与阅读边界](sources/v030rc2-baseline.md)

### 16 Graph mode 与 kernel
- [ACL Graph：捕获、批形状与重复执行](concepts/acl-graph.md)
- [昇腾 950：两张卡怎样接着把工作做完](concepts/ascend-950-execution-interconnect.md)
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md)
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md)
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md)
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md)
- [graph mode：录一次执行次序，之后整串回放](concepts/graph-mode-layer.md)
- [编译图融合：把相邻两步合成一个算子，再分档复用执行](concepts/npugraph-ex.md)
- [从算子到 AI Core：分工、融合与分块](concepts/op-to-ai-core.md)
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md)

### 17 量化与 speculative decoding
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md)
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [LoRA：低秩更新与多适配器推理](concepts/lora.md)
- [Speculative decoding：先猜几个 token，再让主模型一次验完](concepts/speculative-decoding.md)
- [结构化输出：文法怎样在采样前屏蔽不合法的 token](concepts/structured-output.md)

### 18 PD / EPD 分离与 KV 传输
- [Layerwise KV offload：KV cache 一层一层搬，边算边搬](concepts/kv-cache-layerwise-offload.md)
- [Mooncake 连接器：先对好块号，再按层搬历史状态](concepts/mooncake-connector.md)
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md)

### 19 性能工程
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md)
- [DeepSeek 生产实践：一条请求怎样走过整套服务](concepts/deepseek-serving-case.md)
- [DeepSeek-V4.1-Flash：长历史怎样少存、少重算](concepts/deepseek-v4-1-flash.md)
- [DSpark：先猜几个，再决定值得验证几个](concepts/dspark.md)
- [enable_async_exponential](params/enable-async-exponential.md)
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md)
- [推理测量：怎样知道服务真的变快了](concepts/inference-benchmarking.md)
- [容量与恢复：平时够用，为什么出故障就排长队](concepts/inference-capacity-and-reliability.md)
- [输出异常排查：同样的问题，回答为什么变了](concepts/inference-correctness-troubleshooting.md)
- [性能分析：设备到底在算，还是在等](concepts/inference-performance-analysis.md)
- [性能排障：找到等待以后，怎样选优化办法](concepts/inference-performance-troubleshooting.md)
- [推理性能分析：为什么回答到一半会停顿](concepts/inference-performance-walkthrough.md)
- [推理排障入口：先找到问题发生在哪一步](concepts/inference-troubleshooting.md)
- [BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样](concepts/low-precision-formats.md)
- [Netloader Guide：新实例怎样从已有 NPU 接过权重](concepts/netloader-guide.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [量化验收：怎样判断省了内存、保住质量、真正提速](concepts/quantization-evaluation.md)
- [量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择](concepts/quantization-methods.md)
- [Sleep Mode：暂停推理时怎样把显存让给训练](concepts/sleep-mode.md)
- [SWA bounded replay：历史窗口丢了，为什么只重算一小段](concepts/swa-bounded-replay.md)
- [vLLM-Ascend for RL：生成样本后，怎样安全换上新权重](concepts/vllm-ascend-for-rl.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)

### 20 读源码
- [怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现](concepts/reading-vllm-ascend.md)
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

### 03 一层 Transformer 怎样更新表示
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md)
- [lm_head：把最后的隐藏向量变成每个 token 的分数](concepts/lm-head.md)
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
- [Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写](concepts/prefill.md)
- [Sampling：从词表分数里定下一个 token](concepts/sampling.md)

### 06 MoE
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md)

### 07 昇腾 NPU 剖面
- [AI Core：计算单元与数据搬运](concepts/ai-core.md)
- [AI QoS：共享链路拥塞时，哪类流量先走](concepts/ai-qos.md)
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md)
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md)
- [ND 与 NZ：张量的数值没变，内存里怎样重新排列](concepts/tensor-layout.md)

### 08 服务器与机柜
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [NPU、板卡、服务器与机柜](concepts/hardware-devices.md)

### 09 一次请求的硬件旅程
- [AI QoS：共享链路拥塞时，哪类流量先走](concepts/ai-qos.md)
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md)
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPUModelRunner：每张卡上把一步计划跑成 token 的执行者](concepts/npu-model-runner.md)
- [准备输入：把一步的请求计划拼成模型能吃的几张表](concepts/prepare-inputs-flow.md)
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md)
- [请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去](concepts/request-teardown.md)
- [流式输出：token 编号怎样变成一段段推给客户端的文字](concepts/streaming-output.md)
