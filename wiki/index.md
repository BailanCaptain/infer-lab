# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 184 页。

## 概念（concept）
- [AI Core：计算单元与数据搬运](concepts/ai-core.md) — 从矩阵乘与逐项/归约运算出发，拆解昇腾 AI Core 内 Cube、Vector、Scalar 三类执行单元与各级片上缓冲（L1、L0A/L0B/L0C、UB）及搬运引擎（MTE、FixPipe）的分工；对照三级流水重叠与双缓冲条件，辨析 910B（A2/A3）AIC/AIV 经核外 GM 交接与昇腾 950（A5）L0C→UB 片上直通的架构差异。 `04`
- [AISBench 与 EvalScope 实战：压测模式、指标口径对齐与精度基线评测](concepts/aisbench-and-evalscope.md) — 系统拆解在昇腾 vLLM Ascend 上使用 AISBench 与 EvalScope 开展性能压测和数据集精度评测的完整规范，厘清固定并发与到达率模式差异、冷启动预热与前缀缓存污染剔除、客户端与服务端 Prometheus /metrics 的 TTFT/TPOT/ITL 口径对齐，以及推理模型思维链剥离与长度截断避坑要点。 `19`
- [API server 入口：一个 HTTP 请求怎样变成引擎里的请求](concepts/api-server-entry.md) — vLLM 前端进程从收到 HTTP 请求到交给某个 EngineCore 之间做的事：检查、套聊天模板、分词、定输出上限和采样参数、包成 EngineCoreRequest、先在本进程登记反分词器和输出槽，再选 DP 组经 ZMQ 发出。讲清每一步在哪里拒绝请求、流式与非流式的差别、独立 CPU renderer、工具解析插件，以及 GLM 双机上 node0 一个前端接全部请求。 `10`
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md) — 沿矩阵结果交给向量计算的小例，理解昇腾 950 的 Cube/Vector 直通、多维搬运与缓冲同步；再区分 SIMD/SIMT、存储层次、低精度和 PR/DT 规格，把硬件能力变成可验证的推理分析假设。 `07 19`
- [昇腾 950：两张卡怎样接着把工作做完](concepts/ascend-950-execution-interconnect.md) — 沿两张卡的部分结果走过本地计算、交换求和和下一段计算，理解 STARS 2.0 如何安排设备任务、CCU 如何承担通信，以及 URMA、UB Memory 和 UBoE 分别改变哪一段交接；用一组时间记录区分下发开销、参与者迟到与传输等待。 `16`
- [容器镜像、核心环境变量与 vllm serve 最小起服务清单](concepts/ascend-env-and-serve.md) — 锁死镜像并读懂模型目录后，把昇腾容器挂载（/dev/davinci*、驱动库、--shm-size 与 A3 双裸片成对映射）、四层环境变量真伪甄别与单机 vllm serve 最小启动及三步冒烟测试一次跑通。 `01`
- [FlashAttention 与昇腾注意力算子族：片上 Tiling、Online Softmax 与 FA / FIA / PA / FA3 选路](concepts/ascend-flash-attention.md) — 标准注意力若把整张 N×N 分数表写回 HBM，单层中间张量在 32K 长度下就会暴涨到数十 GiB。本页从 Qwen3-8B 访存账出发，拆解片上分块（Tiling）与 Online Softmax 动态重标定怎样做到零近似、零 N×N 落盘，再厘清 v0.30.0 昇腾算子族（FIA、PA、早期 PFA/IFA 与训推一致 FA3）的选路条件及 FA3 绑定 PIECEWISE 图模式的根因。 `04`
- [新模型上线标准流程：五维版本锁死、活跃食谱识别与权重选型](concepts/ascend-model-onboarding.md) — 在昇腾上跑通一个新模型，先锁死 vllm、vllm-ascend、CANN、torch_npu 与硬件卡型五维配套，再从 v0.30.0 的 25 篇活跃模型食谱（剔除 27 篇停服桩，注意 GLM5.md 中 GLM-5 停服而 GLM-5.1 活跃）与三路注册机制确认支持路径，最后按代际完成权重与启动配置选型。 `01`
- [注意力后端：模型机制、状态布局与设备实现的连接](concepts/attention-backend-family.md) — 注意力后端是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定用哪份状态、按什么形状组织这批 token、最后调哪个算子。GLM 的一次前向同时走 KDA 和稀疏 MLA 两条分支，不存在"这个模型的后端"。 `09 16`
- [注意力代价：容量、计算与访存](concepts/attention-cost.md) — 历史变长时，密集注意力每一步读的份数跟着增长，稀疏注意力的主读取到预算就封顶、打分和缓存却照样增长，固定状态始终只读写同一块；放到 GLM 双机上，按一个 token 核算 34 层 KDA 与 11 层稀疏 MLA 各存多少、读多少。 `04`
- [Attention 与 Q/K/V：当前位置怎样从历史里取信息](concepts/attention-qkv.md) — attention 让每个位置按相关程度，从自己和前面的位置取信息，模型靠它把上下文用起来。本页先讲它是什么、为什么需要，再用一个 3 个位置的小例子一步步演示 Q/K/V 打分、softmax 和加权汇合，讲清为什么除以 √d、causal mask 和多头，最后看 GLM 的稀疏 MLA 与 KDA 各改了哪一步。 `02`
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md) — block table（块表）是一张整数表：一行对应批次里的一条请求，第 i 格记着它的第 i 个块在缓存池里的块号；worker 每步按它把位置换算成槽位，注意力算子也按它逐块读历史。GLM 的 5 个缓存组各有一张表，full 组的 640 块号还要展开成 5 个 128 的 kernel 块号。 `11`
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md) — CANN 提供昇腾计算软件能力，HCCL 负责组内通信；沿框架请求、通信库和物理链路看数据怎样到另一张卡，再解释 GLM 双机通信域与 AI QoS 的适用边界。 `07 09 08`
- [昇腾多实例集群部署与路由：DP 外部拉起、前缀感知分发与优雅摘流](concepts/cluster-serving.md) — 面向昇腾多机多卡生产在线服务，系统对比 DP 外部协同拉起与独立多实例代理两种集群架构，拆解基于 /load、动态长度分桶与 ZMQ KVEventsConfig 的 KV 感知路由，并给出覆盖长冷启动图捕获期的 /health 探针设计与 --shutdown-timeout 优雅摘流规范。 `13 19`
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md) — 集合通信规定一组参与者怎样交换数据以及结束后每张卡持有什么：用 2 卡与 4 卡分格图演示八种通信操作与 ring All-Reduce，区分逻辑载荷与链路传输量、机内 HCCS/UB 与跨机 RoCE 带宽悬崖，再沿 GLM 双机解释 HCCL 与 MC2。 `04`
- [多条请求：在官方双机部署上一步怎样装下它们](concepts/concurrent-requests.md) — 沿场景 M（DP0 上 12 条请求在 decode 时来了一条 6000 token 的新请求，DP1 上 7 条在 decode）和 DP1 空闲的变体 M′，在官方双机部署上看多条请求时每一站多出来的事：选组、分预算、拼输入、抢占、图尺寸补齐与两组对齐、MoE 从 MC2 翻到 AllGather、空闲组陪跑。 `00`
- [Continuous Batching（连续批处理）](concepts/continuous-batching.md) — 摒弃整批对齐补零与慢请求锁死，按单步迭代动态挑选请求、一维无填充拼接 token，并在每步末尾对完结请求即退即释块；配合 waiting 与 running 两队列、三道预算闸门及 LIFO 抢占重算，撑起高吞吐低延迟在线服务。 `03`
- [vllm serve 核心参数全分支调优指南：显存水位、批预算 6 分支与图编译联动](concepts/core-cli-params.md) — 打通 vllm serve 四大核心旋钮与单卡显存水位的联动机制，完整拆解昇腾 v0.30.0 上 max-num-batched-tokens 早退回落 2048 的 6 分支决策树与 SP+PCP 静默向上取整，并收拢图编译、调度器覆盖链与 Mooncake P/D 双实例互斥红线。 `06`
- [DeepSeek 生产实践：一条请求怎样走过整套服务](concepts/deepseek-serving-case.md) — 从长输入干扰已有回答出发，推演为什么把 E/P/D 分开、要交接哪些状态以及何时得不偿失；再沿带图长文的追问拆开缓存就绪与计算等待，对照 DeepInfer 的实际发布边界。 `19`
- [DeepSeek-V4.1-Flash：长历史怎样少存、少重算](concepts/deepseek-v4-1-flash.md) — 同一份长文，哪些计算可以省、哪些历史必须留下？先用四层模型走一遍，再区分少存、少读和跨层共享，最后核对实际配置与缓存大小。 `19`
- [新模型适配与自定义算子开发实战：权重映射、量化注册与三条 NPU 算子路径](concepts/dev-new-model-and-custom-op.md) — 串通新 HuggingFace 模型接入 vLLM Ascend 的架构注册、WeightsMapper、@register_scheme 量化注册与 OOT 分发，对比 torch_npu、AscendC 与 Triton-Ascend 三条算子路径及 950/310P 能力门控。 `16 20`
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md) — CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。 `07 09`
- [DP 请求路由：新请求派给哪一个 DP 组](concepts/dp-request-routing.md) — 开了 DP 以后，前端给每条新请求挑一个 DP 组：请求头写了组号就直接去，否则按 waiting × 4 + running 取分数最小的组，并在本地先记一笔。讲清计数从哪来、为什么会过时、挑偏的代价（排队、KV 池、每步对齐、前缀缓存），几种部署方式与各版本打分差异，以及 GLM 双机上怎样选。 `13`
- [Embedding：按编号查表取出 token 的向量](concepts/embedding.md) — Embedding 把每个 token 编号换成一条向量：编号是几，就到嵌入表里取第几行，只有查表没有乘法。本页先讲它是什么、为什么需要，再用一张 6 行的小表演示查表、one-hot 等价和 2 张卡切表求和；最后落到 GLM 双机，看 8 张卡怎样分着查同一张表。 `01`
- [引擎有哪几个进程：API server、EngineCore 与 Worker](concepts/engine-processes.md) — vLLM 用三类角色协作——API server 收发请求、EngineCore 每步调度、Worker 执行设备上的模型；客户端模式与执行器决定角色如何分布到进程，请求状态、补丁和 Ascend 配置缓存按进程管理；GLM 双机按角色计 20 个进程，executor（执行器）决定 Worker 是否独立成进程。 `10`
- [Engram 条件记忆：N-gram 哈希查表与 Host DRAM / RDMA 共享](concepts/engram-conditional-memory.md) — Engram 是模型自带的只读条件记忆表：按相邻短 token 序列的 N-gram 哈希稀疏查表，反量化后经门控融入残差流。因整表体积可达数百 GiB 且每步仅随机读取命中行，昇腾推理将其卸载到 Host DRAM（经 ACL 钉页直读与 POSIX 机内共享）或跨实例 MemFabric / HIXL 共享池，把宝贵的 NPU HBM 留给权重主干与动态 KV cache。 `07`
- [认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来](concepts/glm-5-3-flash.md) — GLM-5.3-Flash 模型形状的唯一出处：45 层里 34 层 KDA、11 层稀疏 MLA，四条 residual 流，前 3 层稠密 MLP、其余 42 层 288 选 8 的 MoE，外加 1 个 MTP 层；每种层先讲它从哪个基础机制演变来，再给 GLM 的具体维度、参数量与权重精度。 `00`
- [GQA：几个查询头共读一组 K、V，省下什么、付出什么](concepts/gqa.md) — GQA 把查询头分组共读同一组 K、V，使 K/V 投影与 KV cache 按头数比同比例缩小，而逐头打分、汇合与输出投影不变；本页结合 Qwen3-8B（4:1）与 Qwen3-30B-A3B（8:1 及 TP=8 复制）算清开销，并拆解昇腾 FIA 直读、Mooncake+C8 边界及与 MLA、KDA 的区别。 `02`
- [昇腾四族硬件体系：NPU、板卡、服务器与超节点](concepts/hardware-devices.md) — 分清昇腾 NPU 裸片、加速板卡、服务器与超节点机柜四级物理结构及运行时逻辑 Device 边界，掌握 v0.30.0 四族硬件能力档案（A2/A3/310P/A5）、主机内存与设备显存分账以及机内 HCCS/UB 与跨机 RoCE 带宽差距。 `04`
- [HCCL buffer：通信缓冲怎样配置与占用显存](concepts/hccl-buffer.md) — HCCL buffer 为集合通信提供设备中转空间；讲清逐组配置、环境变量和底层通信组复用的区别，以及 GLM 双机的配置预算怎样影响 KV cache 可用显存。 `13`
- [读懂 HuggingFace 模型目录与 config.json：从字段认清架构、显存与坑点](concepts/hf-model-anatomy.md) — 启动 vllm serve 前，拆解 HF 模型目录里的 config.json、tokenizer_config.json、safetensors 索引与 generation_config.json，对照 Qwen3-8B 与 Qwen3-30B-A3B 算清架构、权重与每 token KV 占用，并提前排查 head_dim、长度截断与量化陷阱。 `01`
- [推理测量：怎样知道服务真的变快了](concepts/inference-benchmarking.md) — 沿用停顿样例的 A/B 配置，把一次请求的改善放进整组压测：总吞吐相同但达标请求更多意味着什么，怎样把失败、未完成、分位数和真实到达负载一起算进结论。 `19`
- [容量与恢复：平时够用，为什么出故障就排长队](concepts/inference-capacity-and-reliability.md) — 从一张逐级加压的结果表选出单实例可用运行点，再算正常与容错需要几套实例、故障积压多久能消退；沿就绪时间线和流式重试记录判断恢复是否真的完成。 `19`
- [输出异常排查：同样的问题，回答为什么变了](concepts/inference-correctness-troubleshooting.md) — 完成一次从回答异常、输入编号差异到修正模板和回归验证的排查；再换成输入相同的情况，沿首次分歧区分采样、数值和状态，覆盖乱码、重复、空输出、NaN 与质量回归。用固定评测集和业务指标检验变更后的任务质量。 `19`
- [性能分析：设备到底在算，还是在等](concepts/inference-performance-analysis.md) — 接着 D/N 的分块实验，解释少算一些输入为什么能缩短一步、为什么切得更小也会有成本；通过矩阵流量与关键路径推演，区分算得慢、数据搬得慢和等其他卡。 `19`
- [性能排障：找到等待以后，怎样选优化办法](concepts/inference-performance-troubleshooting.md) — 从排队、长执行步、主机空隙、缓存压力、通信偏斜和返回等待六条证据路径选择优化实验；同时解释无故障时怎样提高吞吐、压低长尾、节省内存与比较并行策略。 `19`
- [推理性能分析：为什么回答到一半会停顿](concepts/inference-performance-walkthrough.md) — 跟踪 D 的一次输出停顿，读懂它与长请求 N 的计算记录，再完整比较分块前后的时间线：D 少等了多少、N 多等了多少、什么条件下值得采用，并练习证据改变后怎样换方向。 `19`
- [推理排障入口：先找到问题发生在哪一步](concepts/inference-troubleshooting.md) — 面对启动失败、慢、内存不足、输出异常、图与通信错误等十类问题，先找最后成功阶段与首错 Rank，再沿最小证据、候选原因和区分实验进入已有机制页；内嵌双模交互式排障工作台，支持真实日志与 /metrics 规则诊断及六类阻塞示意沙箱。 `19`
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md) — KV cache 保存每一层为已处理位置算好的 K、V 等历史状态：新 token 只算自己这一份并按块追加，后续步骤直接读取，省去 O(t²) 的整段重算；代价是线性占用显存、每步读取历史带宽以及分页空间管理。除标准 GQA 逐位置存 K、V 外，MLA 存压缩潜向量、稀疏注意力只读挑中位置、线性注意力原地更新固定大小状态。 `03`
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md) — 每张 NPU 在启动期按「总显存 × 显存比例」划定实例预算，加载权重后通过一次最大批量的 profile run 量出激活峰值与包含 HCCL 缓冲在内的非 Torch 增量，三项扣完后将剩余预算按每块字节数切成物理 KV 块；ACLGraph 录图与运行期新增缓冲由预算外 1−u 余量支付，切出的块数也不等于固定并发请求数。 `05`
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md) — KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的说明：一块覆盖多少个位置、每个位置或每份状态占多少字节。管理器据此算出一页多大，再把能共用块号清单、管理方式兼容的层编成缓存组。GLM 的四类状态被对齐成两档页、编成 5 个组；本页也是 block_size 五种含义的唯一出处。 `11`
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md) — hidden 是模型为每个输入位置维护、逐层改写的向量。GLM-5.3-Flash 的 45 层之间用 mHC 传四条残差流：每个子层把四条加权合成一条去算，再把输出写回，旧流经 Sinkhorn 约束的 4×4 矩阵混合；每层两次，一次前向 90 次、1,800 轮 Sinkhorn，末层求平均回到一条。 `03`
- [阅读指南：这个知识库讲什么，按什么顺序读](concepts/learning-guide.md) — 知识库总导览：串联服务冷启动与请求执行两条生命线，说明 Core-26 三层阅读轨道、四族昇腾硬件、四大交互工程实验室与三级版本基线契约，并保留 GLM-5.3-Flash 五页全案主线入口。 `00`
- [KDA：用一个固定大小的状态代替逐位置历史](concepts/linear-attention.md) — linear attention 去掉逐位置的 softmax，让历史先合成一个形状固定的状态矩阵；KDA 在此之上加按 key 通道的衰减和 delta 规则的纠错写入。本页先讲机制，再落到 GLM-5.3-Flash 的 34 层 KDA：每卡状态多大、为什么固定占 12 个块号、prefill 与 decode 两条执行路径差在哪。 `04`
- [lm_head：把最后的隐藏向量变成每个 token 的分数](concepts/lm-head.md) — lm_head 是模型最后一步的输出投影：把最后一层交出的隐藏向量乘一张每个词一列的权重，给词表里每个 token 打一个分数（logits），再交给采样挑下一个 token。本页先用 4 维、6 个词的小例子演示一个分数怎么算，再看 GLM 双机上它按词表切成 8 段、各卡算一段、All-Gather 拼回 154880 个分数。 `03`
- [BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样](concepts/low-precision-formats.md) — 从 FP32、FP16、BF16 与 INT8 出发，拆解 FP8、HiF8、NF4、MXFP8、MXFP4 与 NVFP4 的位域分配和块级缩放；区分权重文件精度、加载后 HBM 驻留格式与 Cube 实际计算类型，对照 vllm-ascend v0.30.0 下 A2/A3、310P 与 Ascend 950 的四族选路边界。 `04`
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md) — 权重是模型训练学到、推理时只读的一张数表，每一列是一个配方；矩阵乘就是照配方把一个位置的几个数重组成新的一排。模型里几乎所有计算都是这一步。先用示意数演一个输出数怎么算、一批 token 怎么一起算，再分清参数量、计算量、容量与访存，最后落到 GLM 双机的前馈投影与 MoE 边界。 `02`
- [MLA：历史压成一条潜向量，用时再展开](concepts/mla.md) — MLA（Multi-head Latent Attention）把每个位置给所有头用的 K/V 压成一条共用的潜向量存进 KV cache，读取时由各头的上投影展开，或把展开吸收进查询和输出投影；GLM-5.3-Flash 的稀疏 MLA 每位置只存 512 维潜向量、不带 RoPE 段，读哪些位置由 indexer 另行决定，主缓存、indexer 缓存与计算开销分别计量。 `04`
- [MLP、residual 与 RMSNorm：一个子层怎样更新 hidden](concepts/mlp-residual-norm.md) — 以单条 residual、pre-norm 和 RMSNorm 为例，讲清「旁路保留输入 + 支路计算改变量 + 两路相加」。区分 LayerNorm 与 RMSNorm、pre-norm 与 post-norm；再讲 SwiGLU 的 gate、up、限幅和 down，以及 GLM 前 3 层稠密 MLP 与四条流。 `03`
- [Model Runner V2：常驻设备缓冲、异步调度与从可选到统一的执行引擎演进](concepts/model-runner-v2.md) — 解析 vLLM Ascend 从单文件 Model Runner V1 演进到模块化 Model Runner V2 的核心动因，拆解常驻设备侧缓冲 AscendInputBuffers、UVA 请求状态、异步调度兼容性、PCP 与 EPLB V2 集成边界，以及 v0.30.0 显式开关到 main 彻底统一的版本切换路径。 `10`
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md) — MoE 把一层的前馈网络换成一池专家，router 给每个 token 打分，只交给其中 k 个去算，输出按组合权重相加：参数随专家数涨，每个 token 的计算只随 k 涨。本页先讲它是什么、为什么需要，再用 6 选 2 的示意数演一遍打分、偏置选人、归一化与加权相加，讲清分组选择、共享专家和负载不均，最后落到 GLM 的 288 选 8。 `06`
- [MoE 通信调度状态机与运行期权重重切分：AllGather / MC2 / Fused MC2 / MegaMoe / AllToAll 与 WeightSwitchMixin](concepts/moe-comm-dispatch.md) — vllm-ascend v0.30.0 将四族昇腾硬件的 MoE 通信收拢进 HardwareProfile 与 select_moe_comm_method 状态机，依动态 mc2_tokens_capacity 切换 AllGather / MC2 / MegaMoe / AllToAll，并以 WeightSwitchMixin 实现运行期权重零拷贝重切分。 `14`
- [msprobe 逐层精度对齐与输出异常定位：从张量转储到算子分歧隔离](concepts/msprobe-accuracy-debug.md) — 介绍在昇腾上用 MindStudio msprobe 定位乱码、NaN 与量化掉点的逐层精度比对方法，厘清 Eager 与图模式接入、L0/L1/mix 采集、四类算子分歧指纹及与 Runtime Guard、batch_invariant 的分工。 `19`
- [多模态推理与视觉编码基础：Patch 展开、M-RoPE、ViT 数据并行与两级编码缓存](concepts/multimodal-inference.md) — 多模态推理先在前端完成媒体下载、CPU 预处理与占位展开，再经 ViT 编码原地覆写进文本嵌入并以三维 M-RoPE 注入时空坐标；本页讲清前端预处理、四级缓存分工、ViT --mm-encoder-tp-mode data 并行与 v0.30.0 两级 ScoreEncoderCacheManager。 `01`
- [NPUModelRunner：每张卡上把一步计划跑成 token 的执行者](concepts/npu-model-runner.md) — model runner 是每张卡的 Worker 里执行一步的对象：按调度计划对账跨步保留的请求记录，拼输入、定执行方式、跑前向，只把每条请求要预测的那几行变成词表分数，暂存进执行状态；引擎第二次调用时再取出来采样、草拟候选，按请求交回 token。前向和采样拆成两次调用，中间靠执行状态交接。 `09`
- [一条请求：在官方双机部署上从提示词走到回答结束](concepts/one-request.md) — 沿一条 4 个 token 的示例请求 R1，在两台 Atlas 800 A2、DP2×TP8、EP16、MTP 草拟 3 个的官方部署上走完七站：入口、调度、准备输入、45 层前向、采样与草拟、结果更新、返回收尾；每站给出每张卡上的形状、次数和字节数。 `00`
- [从算子到 AI Core：分工、融合与分块](concepts/op-to-ai-core.md) — 在 A4 逐层前向中，算子怎样分成矩阵与向量执行段，Host 怎样划分工作，设备怎样搬入、计算、写回；以 GLM 实际 RMSNorm 路径和可选残差融合分支对照说明。 `16`
- [PagedAttention（分页注意力）](concepts/paged-attention.md) — 借鉴操作系统虚拟内存分页思想，把 KV cache 显存池切成固定长度（昇腾默认 128 token）的物理块按需借还，通过块表把连续逻辑位置映射到离散物理块，彻底消灭外部显存碎片、支持相同前缀零拷贝共享，并将单序列内部预留浪费严格收敛到最后一块以内。 `03`
- [Pooling 与非自回归推理：Embedding / Reranker / 生成式评分与 Whisper ASR](concepts/pooling-and-non-ar.md) — 本页拆解 --runner pooling（Embedding / Reranker / Reward）单轮池化路径、双向与因果掩码硬件分岔、CLS / LAST / MEAN 池化头、生成式评分（/generative_scoring）概率比较，以及 Whisper Encoder-Decoder 与语音上传/实时转写入口。 `05`
- [Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写](concepts/prefill.md) — Prefill 并行处理提示词中尚未计算的位置并写入 KV 历史（可单轮或跨多轮分块完成），完结当步仅切出最后一个位置的隐藏向量经 lm_head 选出第 1 个输出 token；随后 Decode 每轮送入新位置、复用全量历史逐词续写。两者共享同一套模型权重，但在算术强度、显存带宽压力与执行分支上截然相反。 `03`
- [准备输入：把一步的请求计划拼成模型能吃的几张表](concepts/prepare-inputs-flow.md) — 调度器每步只说「哪些请求、各算几个 token、新借了哪些块」；worker 里的 model runner 把这些 token 首尾相接排成一排，逐个 token 配上 token id、位置和 KV 槽位，再按请求记下边界、长度和选行，按缓存组组装成注意力元数据交给各层后端。批次行号、位置、槽位是三套不同的编号。 `09`
- [量化验收：怎样判断省了内存、保住质量、真正提速](concepts/quantization-evaluation.md) — 把量化验收拆成产物一致性、中间数值、任务质量、实际内存和服务性能；用误差与耗时小例子解释为什么文件变小不等于推理变快，并给出固定 GLM 双机可复核的对照流程。 `11 19`
- [量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择](concepts/quantization-methods.md) — 从权重、激活、缓存分别量化出发，解释 W4A16、W8A8、分组粒度和校准，再比较 PTQ、QAT、RTN、AWQ、GPTQ、SmoothQuant 的目标与代价；用等价缩放的手算例连接方法、量化产物和昇腾加载器，并区分加载时量化、工具导出格式与 GGUF 插件。 `11 19`
- [怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现](concepts/reading-vllm-ascend.md) — vllm-ascend 是装在 vLLM 上的昇腾平台插件，靠入口点、patch、custom op 等扩展点接进请求路径，所以一条请求跑的是两个仓库拼起来的代码。先沿七站读通主线，再按数据、配置、实现三条路线带着问题追；遇到异常或版本变化时先划清证据边界，区分源码推断和运行证据。 `20`
- [一条请求的代码路径：七站各在哪个进程、经过哪些函数](concepts/request-call-chain.md) — 沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的 worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于 vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。 `09`
- [一次请求全景鸟瞰：从输入文字到逐词生成](concepts/request-overview.md) — 不引入多机并行与混合模型术语，用一个 6 词教学小词表从头到尾跟完一条请求「我喜欢 → 猫。」的两轮（Prefill 与 Decode）、四件事，以及「Host CPU — HBM 显存 — AI Core」三块硬件地盘的配合。 `01`
- [请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去](concepts/request-teardown.md) — 请求收尾是一条请求停下后，前端、引擎和 worker 各自删掉为它存的记录、还回它对 KV 块的引用。先分清引擎判停、停止字符串、客户端断开、出错四条路谁先动手，再分清还块（引用计数减 1）和清空前缀缓存（抹掉全部登记），最后看 GLM 双机上 R1 结束时还了什么。 `09`
- [Roofline 模型与性能三角：算力墙 vs 带宽墙与算术强度拐点](concepts/roofline-and-metrics.md) — 连接第三章的请求调度与第四章的昇腾硬件：先拆清首字时延 TTFT、流式间隔 ITL、每词均值 TPOT 与系统吞吐组成的性能三角，再用算术强度与 Roofline 折线解释为什么单请求 Decode 卡在 HBM 带宽斜坡、Prefill 撞上 Cube 算力屋顶，以及批处理与 W8A8 量化如何移动工作点。 `04`
- [RoPE：把位置变成旋转，让注意力分数只看相隔多远](concepts/rope.md) — RoPE 在 q、k 点积之前按各自的位置编号旋转它们的二维分量对，点积里只剩两者的位置差；频率基数和 YaRN 等缩放决定能覆盖多长。固定部署的 GLM-5.3-Flash 把 RoPE 维数设为 0：稀疏 MLA 与索引器都不旋转，KDA 层本来就不用 RoPE。 `04`
- [Sampling：从词表分数里定下一个 token](concepts/sampling.md) — 模型给词表里每个词打完分，sampling（采样）按请求的设置从中定下一个 token。本页用 6 个词的小例子手算 temperature、softmax、top-k、top-p 和按概率抽取，对照 greedy，再讲参数优先级与停止条件；最后落到 GLM 双机：8 张卡各采一遍、只交回一份，MTP 候选怎样验证。 `05`
- [高阶采样、惩罚项、Beam Search 与 Logprobs：vLLM V1 采样流水线与昇腾快慢路径](concepts/sampling-advanced.md) — 本页讲清 vLLM V1 Sampler 的 9 步严格顺序、白名单/禁词/偏置、三类重复惩罚、自定义 LogitsProcessor、Top-k/Top-p/min_p 重归一差异、思考预算、四模式 Logprobs 与外置 Beam Search，以及 vllm-ascend v0.30.0 昇腾快慢路径分流与 MRV2 演进。 `05`
- [稀疏注意力：先挑位置，再只读这些位置](concepts/sparse-attention.md) — 稀疏注意力让每个查询只在因果范围内挑出的少量历史位置上做 attention；GLM 用 indexer 按 4 个位置一池打分，每个查询最多读 2051 个位置，没选中的历史仍须全部保留。 `04`
- [流式输出：token 编号怎样变成一段段推给客户端的文字](concepts/streaming-output.md) — 流式输出让客户端边生成边看到文字：引擎每步交回新的 token 编号，前端的增量反分词把它们接上已有字节、还原出新增文字，查过停止字符串后包成一个 SSE 片段推出。先分清 token 与文本增量，再沿 GLM 双机看一步 1–4 个 token 怎样变成片段、在哪里判停和收尾。 `09`
- [ND 与 NZ：张量的数值没变，内存里怎样重新排列](concepts/tensor-layout.md) — ND 是 N-Dimension，NZ 按块间大 N、块内小 z 的遍历形状命名；用同一张矩阵演示分块重排、补齐和地址变化，再区分 shape、stride、dtype、量化打包与设备格式，核对昇腾权重和 KV cache 的布局边界。 `07 11`
- [Token、分词与 chat_template：从文本消息到模型编号序列](concepts/token.md) — Token 是模型用整数编号表示的文本基本单元。本页从子词权衡与字节级 BPE 合并讲起，串联 chat_template 渲染、增量反分词与 Qwen3-8B 的 151936 词表校验，并对照特殊标记区间与 GLM 入口边界。 `02`
- [v0.30.0 正式版升级与避坑清单：废弃环境变量、默认行为变更与迁移对照](concepts/v030-release-baseline.md) — 从 v0.26 / rc2 升级至 v0.30.0 正式版（c09d3e20 + ced6857a）的生产迁移清单：涵盖退役环境变量、FLASHCOMM1 兜底、W8A8_MIX、显存默认 0.92、HardwareProfile、原生 FP8_BLOCK 与 MRV2 切换。 `19`
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
- [Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类](concepts/ascend-patch-system.md) — patch 是 vllm-ascend 在进程里把上游模块中的名字改指向昇腾实现的做法。global patch 由平台准备钩子和通用插件 入口加载，worker patch 在 Worker 构造时加载；正常成功导入由标记和缓存去重。本页按固定 GLM 条件区分导入与 实际调用，并对照 v0.23.0 / v0.26.0rc / v0.30.0 / main 的入口与清单。 `10`
- [Async scheduling：趁卡在算，先把下一步排好](concepts/async-scheduling.md) — 异步调度让 CPU 在 NPU 算这一步时就排好下一步：调度器用输出占位记下还没回来的 token，Worker 在卡上补真值，结果回来再销账。讲清收益与代价、投机解码下先按全接受排再改正、在途结果怎样收尾、换调度器的特性为何要备异步版，以及 GLM 双机上 R1 每一步的占位账。 `12`
- [Balance Scheduling：一组顶满，各组一起停收新请求](concepts/balance-scheduling.md) — MoE 模型的多个 DP 组每步互报 running 条数，最满的一组顶到上限时所有组暂停接纳 waiting；讲清为什么需要、闸门与互报放在哪、只数条数的局限，以及 GLM 双机未启用时的对照。 `12`
- [批不变性：相同输入为何会随同批请求改变结果](concepts/batch-invariance.md) — 同一条请求换了同批的伙伴，浮点加法的分组就可能变，末位随之变化。本页先讲这件事怎么发生，再讲把加法顺序钉死的做法、要付的代价，以及 GLM 双机上的启用状态与缺口。 `16`
- [Batch-Job-Aware Scheduler：先给正在生成的请求留块，再按作业接新请求](concepts/batch-job-aware-scheduler.md) — vllm-ascend 为离线批处理准备的调度器：接新请求前先估计 running 下一步要借几块 KV 块并扣下来，只拿余额接新请求；waiting 按作业分桶，用已自然结束请求的输出长度估计决定先接哪个作业，桶内挑放得进预算的最长提示词。只改 waiting 一段，不防饿死；GLM 双机钉住的镜像里没有它。 `12`
- [Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住](concepts/chunked-prefill.md) — Chunked prefill 让调度器在一条长提示词装不下本步剩余预算时，只排预算容得下的那一段、下一步从断点续算，历史与递推状态跨段延续，仅最后一段产出首个输出 token；它保护同批 decode 请求不被长提示词卡住，代价是长请求首字更晚与前缀历史重复读取。 `03`
- [上下文并行（CP）：怎样分位置，又怎样算完整 attention](concepts/context-parallel.md) — 长序列怎样分给多张卡，为什么会头尾配对；用同一组位置追踪 All-Gather、Ring Attention 和 Ulysses，演算局部结果怎样恢复完整 attention，再对照 Ascend PCP/DCP 与 GLM 的支持边界。 `15`
- [CPU 绑核：线程亲和性与 NUMA 局部性](concepts/cpu-binding.md) — 模型在 NPU 上算，主机侧的 Worker 仍要准备张量、下发算子；绑核从这颗卡的亲和节点出发，通常再补上编号下一个 NUMA 节点里允许的核组成一个池，共用一个池的卡按卡序平分，线程钉在分到的核上，已分配的内存页迁到其中编号最小的核所在的节点。本页讲它怎么挑核、默认开关、GLM 双机上 8 个 Worker 各绑在哪里，以及拿不到拓扑或核数不够时会怎样。 `16`
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md) — DP 把请求分给不同执行组独立排队调度。稠密模型各组自持权重、互不等待；MoE 路由专家跨全部组只放一份，触发空闲组 dummy batch 陪跑（与是否开 EP 无关）。本页结合 v0.30.0 跨机 RoCE PP×DP 禁配与 DP 缓冲规则，落到 GLM 双机 DP2。 `04`
- [DSpark：先猜几个，再决定值得验证几个](concepts/dspark.md) — 用两条请求的候选概率算出怎样分配验证预算，再加入实际每轮耗时判断收益；解释半自回归草稿、置信度累乘、CPU/设备异步分工，以及接受率高却不更快时的排查方法。 `19`
- [动态分块流水线：按预计耗时切 prefill 块](concepts/dynamic-chunked-pp.md) — 开了 PP 时，长提示词按「已经算了多少、这一块预计要多久」反推每块切多大，让各块耗时相近、后一段少空等；讲清等长块为什么越来越慢、23 格变 17 格的账、二次曲线反解、开机试跑与时间账，以及 GLM 双机 PP=1 开不了的边界。 `13`
- [DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组](concepts/dyntra-lb.md) — vllm-ascend v0.30.0 与 main 中 PD 分离 decode 端的 DP 负载均衡：各组每步互报按 token 数估计的 KV 块数，下一步在本组内暂停或接纳请求，让各组注意力负载接近；不搬请求，暂停不还 KV。讲清与 EPLB、Balance Scheduling 的分工、计划怎样算、何时生效，以及本部署为何没开。 `12`
- [EPD 分离（多模态编码器 / Prefill / Decode 三池解耦）：ECConnector 缓存交接与独立扩缩](concepts/epd-disaggregation.md) — EPD 分离把多模态视觉编码器拆为独立 E 节点池，经 ECConnector（ECExampleConnector / v0.30.0 ECMemcacheConnector / main AscendECMooncakeConnector）跨进程交接编码缓存，并与 MooncakeLayerwise PD 分离组成独立扩缩的 E/P/D 三池集群。 `18`
- [EPLB：按实测热度调整专家放在哪张卡](concepts/eplb.md) — EPLB 在推理中统计每个专家接到的 token–expert 配对数，按峰均比重排专家位置、必要时加副本，再逐层搬权重并换表；本部署未启用，只给开启条件与估算。 `14`
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md) — EP 把完整专家分放到不同卡上，让 token 去找选中的专家，算完再收回结果。先看这个过程，再沿 GLM 双机部署跟一个 token 走过 MoE，最后核对通信、陪跑与多请求负载。 `04`
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
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md) — 每张可见 NPU 对应一个 NPUWorker（310P 为 NPUWorker310）。冷启动按严格依赖依次完成打补丁与算子注册、绑卡拍快照与建 HCCL 通信组、解析架构并加载分形权重、试跑量测 KV 预算、按 EngineCore 全局最小块数建缓存池，最后跑完 7 类预热机制并捕获 ACLGraph 图池。 `05`
- [编译图融合：把相邻两步合成一个算子，再分档复用执行](concepts/npugraph-ex.md) — 从中间张量的一写一读讲清编译期融合，列出固定源码里的四条融合规则、它们各自的条件，并区分 npugraph_ex 后端、static kernel 与分档捕获在 GLM 双机 MTP 验证那一步各自管什么。 同时说明编译缓存怎样复用产物，以及视觉编码器编译与视觉图捕获的区别。 `16`
- [算子与 kernel：从数学语义到设备实现](concepts/ops-and-kernels.md) — 模型里的一次运算怎样经框架替换表、量化方法或模型自己的调用，落到 torch_npu 已有算子或仓库自编译扩展，再经 CANN 下发成设备 kernel；并沿 GLM 双机的一层列出各站的实际算子。 另解释 IR 怎样按参数选择实现，以及它与 Ascend 类替换和原地复用的关系。 `16`
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md) — 把一条请求的 prefill 与 decode 交给 P、D 两套实例，中间由连接器交接历史状态。沿 Mooncake V1 看交棒、D 拉取、完成信号与押块，讲清 GLM 这类混合模型为何让 P 少算最后一个位置；本站双机主线没有开 PD，只作变体对照。 `18`
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md) — 把模型的隐藏层按先后顺序切成几段放到不同的卡组上，让请求像工件一样依次流过各段；讲清层分段与 TP 的区别、段间状态交接、流水线气泡与微批填充，拆解 v0.30.0 非末段 PPMissingLayer 消除词表峰值并放大批 token 预算的机制，以及 GLM 双机为什么没开 PP。 `04`
- [插件发现与模型注册](concepts/platform-plugin-registration.md) — 昇腾包通过入口点清单接入 vLLM；入口须被允许加载并成功执行，设备可用性另行检查。vLLM 在相应进程的初始化入口按组名加载——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型实现；次数取决于启动方式与进程内防重状态。 `10`
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md) — 通过输入指纹找到可复用的前缀块，后来的请求共享命中块，省去相应的prefill计算。固定旧GLM镜像默认关，显式打开走align，公共恢复边界按640对齐；新版的默认值与部分尾块能力须分别确认。 `11`
- [W8A8 与 Ascend 量化：怎样压到 8 位、按层与硬件怎么选路](concepts/quantization.md) — 量化把权重和激活换成较少位数并保留缩放系数。本页先讲清缩放、零点、舍入、截断与反量化，以及 W8A8 矩阵乘的四步计算，再按 vllm-ascend v0.30.0 基线结合 Qwen3-8B 与 Qwen3-30B-A3B 说明显存节省、动态/静态/PD 混合（W8A8_MIX）与原生 block-wise FP8 在不同昇腾硬件上的选路差异。 `11`
- [Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回](concepts/recompute-cpu-offload.md) — vllm-ascend 给 PD 分离 D 节点配的连接器：RecomputeScheduler 让出一条请求前先问它，主机块够就把这条的全部 KV 块同步拷到主机，重新排上时在前向前搬回，完成通知后再调度；旧版保存失败则交代理退回 P。讲清两条恢复路径的取舍（示意数）、和 CPU 备份、KV Pool 的区别；新版失败路径需按并行设置区分。GLM 双机主线不拆 P/D，没有启用。 `11 12`
- [RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算](concepts/recompute-scheduler.md) — PD分离的D节点续块失败时，优先尝试保存被抢占请求的状态，稍后恢复；旧版不能保存时发recomputed结束帧，由代理重投P做prefill。客户端结束、引擎收尾和状态保存是不同步骤；v0.30.0 与 main 细粒度TP还可能直接中止。GLM双机主线不拆PD，不启用此调度器。 `12`
- [RFork：权重远端复用机制与排错总览](concepts/rfork.md) — 新实例启动时可按地址读取兼容来源显存中的权重；借不到或读取失败时，停止 seed 服务并安全清理登记内存后可退回默认加载。本页是社区上游 vllm-ascend main（8d6180e2）RFork 专题的入口：借的步骤、四种「成功」、GLM 双机推演和全章唯一的四版本对照。
- [RFork 配置：四类端口、各项超时与可复制的启动示例](concepts/rfork-config.md) — 想让第二个实例从已有实例借权重，启动命令里要多写什么。这页讲上游 main（8d6180e2）RFork 的十三项客户端设置和四类端口：配置错误何时中止启动、未知键为何告警；双槽固定端口与 EADDRINUSE 动态回退；单次超时、快慢重试与可选续租各管什么；GLM 双机每台开多少端口、默认租约够不够，以及怎样验收。
- [RFork 身份匹配：同模型、同布局，还要同一份分片](concepts/rfork-identity.md) — B 的每张卡凭一把 seed key 向 Planner 找 seed：先把版本、数值类型、量化、并行大小和昇腾排布算成部署指纹，再加上 TP / PP / EP 编号和主 / 草稿角色做一次 SHA256。本页讲钥匙里有什么、没有什么，为什么同一个模型也可能借不到，钥匙对上为什么不代表内容一样，以及 GLM 双机上 32 把钥匙各写什么编号。
- [RFork 张量布局：先对齐算子要的形状，再决定搬什么](concepts/rfork-layout.md) — 新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则先读取，再执行适用的后处理。 要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
- [RFork 生命周期：传完权重、交出模型、当上 seed、接请求各是一步](concepts/rfork-lifecycle.md) — B 的一个 Worker 借完权重后，传完、交出模型、还上租约当 seed、整个实例接请求是四个时刻。讲会话八个状态（含先登记的 REGISTERED）、还租约快慢重试与 400/404 各说明什么、可选 LEASE_TTL_SEC 周期续租、发布 seed 的已启动/延期/失败、回退清理与关停留下什么。
- [RFork 版本维护：上游演进脉络、历史补丁归档与升级隔离](concepts/rfork-maintenance.md) — RFork 已完成从早期工作分支到社区上游 vllm-ascend main（8d6180e2）的演进与合入。这页讲：如何核对当前运行代码与上游提交， 早期七份历史补丁与衔接差异为何曾分叉、如今怎样对应社区 PR，升级时要回看哪几页并如何隔离旧 seed 池，以及哪些事只能到真机现场确认。
- [RFork 启动：准备模型以后才借 seed，失败后先清理再重建](concepts/rfork-startup.md) — 新实例用 RFork 加载模型时，每个 Worker 先在本卡搭好模型、转好布局，再向 Planner 借 seed、按地址读权重；借不到或读失败，先清理干净再从存储普通加载。本页按十步走一遍，讲清为什么晚申请租约、两处提前离开、回退怎样清理、三类「没有可用 seed」，以及 GLM 双机第一次冷启动怎么走。
- [RFork 传输：登记空位、核对清单、分批读字节](concepts/rfork-transfer.md) — 借到 seed 后，B 的每个 Worker 先把放权重的空位登记给传输引擎，再用 HTTP 向 seed 要清单、整份逐项核对， 通过后由 B 按地址分批把字节读进来；任何一步失败都先注销登记、撤掉半成品再回退。也讲登记怎样保住内存， 以及主模型和草稿模型共享地址时字节怎么分开算。
- [RFork 排错：从第一条异常还原版本、阶段与资源状态](concepts/rfork-troubleshooting.md) — RFork 出错时从哪查起：四步检查失败共用同一句汇总、要往前找具体异常，直接抛的异常则写在汇总里；再看模型、租约和显存各停在哪一步。按借不到来源、清单对不上、显存登记或清理出错、读数据失败、还租约被拒、看起来卡住六类现象，列出能确定的事、候选原因、该补的证据和不该做的事；示例 Planner 的 400 只来自请求头解析失败，到期回 404。
- [序列并行（SP）：让局部激活按 token 分片](concepts/sequence-parallel.md) — Megatron SP 配合 TP，让归一化、残差等区域按 token 分工；沿同一组数看清部分和怎样归约、每卡怎样计算、何时收集并交给下一次投影，并区分 Ulysses、CP 与 Ascend FlashComm1。 `15`
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md) — 等待的新请求按提示词长短分进短、长两条车道，每步用剩余预算接纳新请求时先取短的；被抢占或算过一部分的请求排在最前，长请求达到等待门槛可提升候选优先级，但不保证时限。它只改从哪条队里拿下一个，不改预算和切分；本部署钉住的代码里没有它，v0.26 起才有。 `12`
- [Sleep Mode：暂停推理时怎样把显存让给训练](concepts/sleep-mode.md) — Sleep Mode 在保留引擎进程的同时释放可睡眠内存池：level 1 把权重备份到 CPU，level 2 丢弃权重，两者都丢弃旧 KV cache。说明唤醒顺序、请求处理、GLM 双机未启用的原因与版本差异。 `19`
- [Speculative decoding：先猜几个 token，再让主模型一次验完](concepts/speculative-decoding.md) — Speculative decoding（投机解码）先用便宜的办法猜出后面几个 token，再让主模型一次前向验证：猜对几个就多出几个，第一个猜错处换成主模型自己的答案。讲清接受规则、被拒位置的收场、为什么也可能变慢，以及 GLM 双机上 MTP 每步猜 3 个的做法与版本差异。 `17`
- [结构化输出：文法怎样在采样前屏蔽不合法的 token](concepts/structured-output.md) — 结构化输出在打分和采样之间加一道关卡：文法状态算出下一步允许的 token，其余候选的 logits 改成 −∞ 再采样。先看这个过程，再沿 GLM 双机看 bitmask 在哪个进程、哪一步算出，怎样作用到 logits，以及它和 MTP 草稿、思考阶段的配合。 `17`
- [SWA bounded replay：历史窗口丢了，为什么只重算一小段](concepts/swa-bounded-replay.md) — 用窗口为三个位置的小例子推演回放为何近似，分清 encoder 缺失恢复与 decoder 窗口准备、128/134/140 的不同口径，以及 mask/compact 一致不能证明与完整重算一致。 `19`
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md) — 把同一层的矩阵分给多张卡：先列切，各卡算出完整数值的几列；本地激活后接行切，最后一次求和合齐结果。沿 GLM 双机的一次前向，核对通信和显存代价。 `04`
- [UCM：把算过的前缀分三层存到显存之外](concepts/ucm.md) — UCM（Unified Cache Manager）是经 KV connector 接进 vLLM 的外部缓存软件包：把算过的前缀 KV 从显存存到本机内存、再落到共享存储，按官方文档换实例或重启后也能取回，省掉重复的 prefill。讲清它和 KV Pool、LMCache 的分工，PD 分离时的两种数据流，以及 GLM 双机为什么没开、开了还缺什么。 `11`
- [vLLM-Ascend for RL：生成样本后，怎样安全换上新权重](concepts/vllm-ascend-for-rl.md) — RL 训练框架用 vLLM-Ascend 生成样本，再把新权重交回推理端。本页串起暂停、同卡与跨卡权重传输、训练数据返回和数值一致性，并区分 main 的统一配置与 GLM 固定版本。 `19`

## 参数（param）
- [absolute_balance_threshold](params/absolute-balance-threshold-71578a0c428d.md) — STAIR 判断某层是否重新规划的绝对滞回门槛：当前均衡度（平均峰均比的倒数）跌至本值（默认 0.90，约合峰均比 1.11，合法范围 (0, 1]）及以下即放行该层进入规划，与相对门槛为“或”关系。v0.30.0 与 main 已在 MRv2 STAIR 中生效。
- [block_table_no_commit_optimize](params/block-table-no-commit-optimize-8328d0d2d00d.md) — 已移除的历史回退键：曾在 main 短暂存在一天（2026-09-23 随 MRv1 脏区提交优化引入、09-24 随该优化整体回退），v0.23.0、v0.26.0rc、v0.30.0 与 main 均无此键。当时默认 0 用增量提交的 OptimizedBlockTable，设 1 才退回整行 H2D 拷贝；新版保留该键通常启动报错。
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md) — 曾用于将 LightningIndexer C8 缓存写入由 scatter 切换为 StoreKVBlock 的开关。v0.23/v0.26 默认 false，v0.30.0rc2 改为默认 true 并限 P 节点；v0.30.0 与 main 已移除（PR #18128），统一走 scatter。 `17`
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — MoE MC2 combine 阶段通信量化强制覆盖开关：仅认整数 0/2/3/4，默认 0 不干预（沿用模型 comm_quant_mode 或 W8A8MXFP 默认模式 4）。v0.30.0 与 main 可用，v0.23/v0.26 忽略，受硬件与非融合 MC2 路径约束。 `14 17`
- [cross_node_transfer_limit](params/cross-node-transfer-limit-06ee92260b7a.md) — STAIR 单层一轮规划里每个节点跨节点发出与接收专家搬运的各自上限：-1 不限，0 禁止跨节点，正整数按节点双向封顶。v0.30.0 与 main 已接入 MRv2，声明默认 -1；未显式指定通信器而自动回退 torch_gloo 时，仅将未显式配置的限额收紧为 1。
- [enable_async_exponential](params/enable-async-exponential.md) — 旧版采样优化开关：将随机采样用的指数分布随机数 q 提前到副流与 model forward 重叠生成。v0.23.0 默认关闭并已标记待废弃，自 v0.25.1rc1 起整体移除；v0.26.0rc 静默忽略，v0.30.0 与 main 通常拒收（可发现 vllm_omni 时告警过滤）。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — 压测与上限分析专用开关：开启后丢弃 MoE 路由器算出的真实 topk_ids，改为按 ep_size / ep_rank 确定的轮转专家编号，保留原 topk_weights（模型精度失效，严禁用于生产或精度评估）。默认 false，v0.30.0 与 main 均支持，与 dynamic_eplb 互斥。 `14`
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 旧版行并行线性通算融合开关：将 RowParallelLinear 的「矩阵乘 + AllReduce」换为 npu_mm_all_reduce_base。 v0.23.0/v0.24.0rc 可用，v0.25.1rc1 起移除；v0.26 忽略，v0.30.0 与 main 通常拒收（vllm_omni 告警过滤）。 `13`
- [enable_pcp_embedding_lmhead_weight_sharding](params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md) — PCP>1 且模块匹配 embed_tokens/head 且未禁用 TP 时，按 TP×PCP 网格切分词表权重；默认 true，与同模块细粒度 TP 互斥，main 还互斥 enable_batch_sharded_sampling。
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — PCP>1 时在加载期按 PCP 组切分输出投影权重，每卡常驻 1/pcp_size；prefill 临时 all-gather，decode 用本地片加 PCP all-reduce。v0.30.0 与 main 默认 true，覆盖 SFA-PCP 与 DSA-PCP。 `15`
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外释放 HCCL 设备侧通信组并清空 ACL 图工作区，默认关闭；v0.23/v0.26 用顶层键，v0.30.0 与 main 迁至 rl_config.sleep_mode_extra_cleanup 并引入 HCCL anchor。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — ascend_compilation_config 中的 Super Kernel 优化开关：在编译与 ACL Graph 捕获时提交优化选项与 scope，把符合条件的静态子 kernel 合并。v0.26 维护快照、v0.30.0 及 main 可用，省略时跟随 enable_static_kernel；实际生效还受图模式与硬件能力限制。 `16`
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 旧版 ascend_compilation_config 开关：将 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成单算子；因与序列并行争抢子图而官方默认关闭（v0.23.0 实际注册逻辑存在默认值分裂），自 v0.25.1rc1 起已整体移除，v0.26 静默吞掉、v0.30.0 与 main 严格校验直接报错。 `13`
- [fused_op_type](params/fused-op-type-fc0f5fcd7be0.md) — 曾用于切换 Sparse KV Offload decode 路径的子键（none 走四步、fused_copy_sfa 走 LIM + Copy-SFA）。仅见于 v0.30.0rc2 等过渡快照；v0.30.0 与 main 已移除该键并默认启用融合路径，传入旧键会报错。
- [kvpp_config](params/kvpp-config-0445bd352140.md) — AscendConfig 上的冻结 KVPP 派生子配置，仅含 size 字段，由 enable_kvpp 与 TP×PCP 自动算出而非用户输入；直接写进 additional_config 会被静默剔除，v0.30.0 与 main 均支持。 `11`
- [layer_sharding](params/layer-sharding.md) — v0.23.0 的层间权重分片列表，将同构 Linear 按层号轮流常驻在组内 rank i % K，其余卡前向异步 broadcast 取回；仅限 P 节点，v0.24.0rc 起已删，v0.26 忽略、v0.30.0 与 main 拒收。 `13`
- [load_risk_quantile](params/load-risk-quantile-d89a080ba048.md) — STAIR 评估专家与卡负载风险时所用的单侧标准正态分位数：把负载记为均值 + z × 标准差（卡级风险计入同卡专家协方差），默认 0.75（z ≈ 0.674），合法范围 (0.5, 1)。只影响候选生成（副本数与摆放），不影响门槛和最终优胜筛选。v0.30.0 与 main 已接入 MRv2。
- [load_window_bins](params/load-window-bins-cc21068b082d.md) — STAIR 在分析上游 EPLB 负载窗口前按时间顺序压缩的最多分段数：默认 64，合法范围 2–256。每段保留段均负载与步数权重，后续均衡度、p95 峰均比、方差与协方差均基于压缩后的分段计算。v0.30.0 与 main 已在 MRv2 STAIR 中实际读取。
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控多流重叠开关，把 MoE 共享专家前向与 select_experts 路由放到副流，与 prepare 阶段的动态量化及 EP All-Gather 并行；v0.24.0rc 起整套实现已删除，v0.26 静默忽略，v0.30.0 与 main 通常拒收未知键（发现 vLLM-Omni 时告警并过滤）。 `14`
- [placement_search_backtrack_limit](params/placement-search-backtrack-limit-82b03cef98b0.md) — STAIR 用带约束 LPT 为单个候选摆放专家副本时允许接受替代可行分支的回溯预算上限：默认 32，合法范围 0–64，每个候选单独计数；设为 0 只禁止接受替代可行选择，仍会执行首个可行选择及跳过来源不可行的试放。v0.30.0 与 main 已接入 MRv2。
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn、moe、mlp 三组共五个权重分别指定「预取权重前百分之几」；仅在 v0.23.0 维护分支可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 静默忽略，v0.30.0 与 main 通常拒收未知键（Omni 环境告警过滤），没有等价替代键。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — 动态切块配置（CPP）：启动期实测 prefill 延迟曲线，运行时按前缀长度反解每步 token 切块大小以缓解 PP 流水等待。默认关闭，要求 PP>1 且互斥 balance scheduling，v0.30.0 仍支持，main 已于 PR #21310 移除。 `12 13`
- [rank_transfer_limit](params/rank-transfer-limit-99529b37d91d.md) — STAIR 单层一轮规划里每张卡换入专家与充当搬运来源的次数上限（两方向分别计数），同时截断一轮副本数调整步数。v0.30.0 与 main 声明默认 -1（不限），合法值为 -1 或正整数；未显式指定通信器而自动回退 torch_gloo 时，未显式填写的限额会自动收紧为 1。
- [relative_balance_threshold](params/relative-balance-threshold-bcbc40e7dc87.md) — STAIR 判断某层是否重新规划的相对滞回门槛：当前平衡度 ÷ 上次提交摆法时预测的平衡度 ≤ 本值（默认 0.95，合法范围 (0, 1]）即放行该层，与绝对门槛为“或”关系；从未提交过或锚点为空/NaN 的非零负载层直接放行。v0.30.0 与 main 已在 MRv2 STAIR 中生效。
- [replica_search_beam_size](params/replica-search-beam-size-6556d1650a62.md) — STAIR 副本数搜索的束宽：每段展开后保留的最多候选状态数、最终生成的目标副本数上限，以及真正进入带约束 LPT 摆放的候选上限；默认 64，合法范围 1–128。注意设为 1 时唯一位置会被强制保留的“份数不变”占满，等于关闭副本数调整。v0.30.0 与 main 已接入 MRv2。
- [replica_search_num_stages](params/replica-search-num-stages-e4b10925ff97.md) — STAIR 分阶段副本数搜索把按风险降序排列的专家切成的阶段组数：前面各组逐段探索额外副本预算，最后一组贪心补齐；默认 4，合法范围 1–8，实际组数取配置值与专家数的较小者，设为 1 时目标退化为纯贪心。v0.30.0 与 main 已接入 MRv2。
- [replica_search_radius](params/replica-search-radius-cd3118b5aae5.md) — STAIR 分阶段副本数搜索中每段的预算试探半径：以贪心分配给该组的额外副本位个数为中心，向少与多两侧各试至多本值个取值并按可行区间裁剪；默认 8，合法范围 0–32，设为 0 只试贪心中心预算（不关闭 EPLB）。v0.30.0 与 main 已接入 MRv2。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — SFA-DCP 解码路径上 query gather 后的布局对照/回退开关：默认 false 保留 strided view，设 true 在恢复视图尚不连续时强制调用 .contiguous() 还原 t-major 连续存储。v0.30.0 与 main 保留，v0.23.0 与 v0.26.0rc 静默忽略；含 prefill 批次或开启 DSA-CP 时不生效。 `15`
- [size](params/size-40a1c2ca47b8.md) — KVPPConfig 唯一字段：KVPP 将单个 PP stage 上的层缓存划分给多少张卡，int 类型、默认 1（关闭），开启 enable_kvpp 后按 TP × PCP 自动推导且对象冻结，用户不能直接写入。v0.23.0 与 v0.26.0rc 无此字段，v0.30.0 与 main 保留并由 PCP × TP 组内 rank 判定层归属。 `11`
- [stair_config](params/stair-config-cca9e594a052.md) — additional_config.eplb_config 下给 MRv2 STAIR（StairEplbPolicy）调参的嵌套字典，十个数值键分管负载窗口压缩、滞回重排门槛、风险分位数、副本数搜索、搬运上限与有界回溯。v0.30.0 与 main 已接入 MRv2 并默认启用 stair 策略，未指定通信器回退 Gloo 时自动收紧未显式配置的搬运限额。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — Sparse KV Offload 的融合重叠 decode 开关，位于 additional_config.sparse_kv_offload_config，默认 false；开启后把未命中 KV 的 H2D 搬运与 SFA 注意力计算放进同一流水线，并更新设备侧选择缓存。v0.23/v0.26 无此键，v0.30.0 与 main 上开启时自动切离默认的 Copy-SFA 路径。 `11`
- [use_layerwise](params/use-layerwise-b475778cd352.md) — AscendStoreConnector 的逐层 KV 存取开关，位于 --kv-transfer-config 的 kv_connector_extra_config，默认 false；开启后按层搬运 KV，并在含整图配置下改用 PIECEWISE。 `11`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的权重预取子配置，在独立流上把 linear 权重提前从 HBM 搬进 L2 cache 与 vector 计算重叠；v0.24.0rc 起已删除，v0.26 忽略，v0.30.0 与 main 通常拒收（Omni 告警过滤）。 `19`

## 来源（source）
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md) — 一次问答的归档：块表里既不分配也不回收，分配与回收在上游 EngineCore 进程的 KVCacheManager / BlockPool 里，块表只事后记账。算例是当时的 Qwen3-0.6B 单卡旧例，不是 GLM 双机实测；机制说法已按钉住源码补核。 `11`
- [AscendConfig 四版本来源摘要](sources/ascend-config-version-source.md) — 四个固定快照展示共享专家开关、动态分块设置和配置缓存的取值变化；main 与 rc2 仍读取 FlashComm1 输入，环境值的解析和优先级需分版本核对。 `10`
- [GLM-5.3-Flash：模型配置与官方双机来源基线](sources/glm-5-3-flash-baseline.md) — 固定 GLM 主线的模型配置、双机教程、控制流与执行侧提交，区分配置、源码推导、量化假设和镜像证据；最终安装产物与权重配套仍待核实，尚未实机部署。
- [GLM 稠密 MLP 固定版本源码摘录](sources/glm-mlp-version-source.md) — 固定 main 与 rc2 的 GLM 稠密前馈实现相同，记录激活限制和序列并行设置；v0.23、v0.26 的指定路径缺失，不能据此判定整个功能不存在。 `10`
- [RFork 官网核读：原图、全部章节与上游演进差异](sources/rfork-official-guide.md) — 对照社区上游 main（8d6180e2）官方指南、v0.30.0（c09d3e20）与历史旧指南快照（baa023ad），说明身份、端口、租约、绕过条件与布局协议的演进差异，避免把移动的 latest 或过时模型表当成现行验收证明。
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
- [Model Runner V2：常驻设备缓冲、异步调度与从可选到统一的执行引擎演进](concepts/model-runner-v2.md)
- [NPUPlatform：配置校验与设备实现选择](concepts/npu-platform.md)
- [插件发现与模型注册](concepts/platform-plugin-registration.md)
- [v0.30.0rc2 的版本基线与阅读边界](sources/v030rc2-baseline.md)
- [vllm-ascend 如何接入 vLLM](concepts/vllm-ascend-overview.md)
- [EngineCore：vLLM 里一圈一圈推着请求往前走的循环](concepts/vllm-engine-core.md)
- [Platform：硬件适配的接口契约](concepts/vllm-platform-interface.md)
- [vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环](concepts/vllm-v1-shape.md)

### 11 KV cache 内存系统
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md)
- [Block Table：请求里的第几个位置，落在缓存池的哪一格](concepts/block-table.md)
- [KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存](concepts/kv-cache-cpu-offload.md)
- [Layerwise KV offload：KV cache 一层一层搬，边算边搬](concepts/kv-cache-layerwise-offload.md)
- [KV cache 量化：以 INT8 C8 为例，历史怎样存窄再读回](concepts/kv-cache-quantization.md)
- [Sparse KV offload：历史放主机，每步只搬这次要读的几行](concepts/kv-cache-sparse-offload.md)
- [KV cache 规格：每层的状态怎样换算成页、编进缓存组](concepts/kv-cache-spec.md)
- [KV Pool：把算过的开头存进外部池，别的实例也能取回](concepts/kv-pool.md)
- [kvpp_config](params/kvpp-config-0445bd352140.md)
- [LMCache：接在引擎外面的一层 KV 缓存](concepts/lmcache.md)
- [Prefix caching：相同的开头只算一次，靠什么认](concepts/prefix-caching.md)
- [W8A8 与 Ascend 量化：怎样压到 8 位、按层与硬件怎么选路](concepts/quantization.md)
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
- [DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组](concepts/dyntra-lb.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回](concepts/recompute-cpu-offload.md)
- [RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算](concepts/recompute-scheduler.md)
- [短请求优先：等待顺序与长请求公平性](concepts/short-request-first.md)
- [Scheduler：每一步给哪些请求算几个 token](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [昇腾多实例集群部署与路由：DP 外部拉起、前缀感知分发与优雅摘流](concepts/cluster-serving.md)
- [DP 请求路由：新请求派给哪一个 DP 组](concepts/dp-request-routing.md)
- [动态分块流水线：按预计耗时切 prefill 块](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [细粒度 TP：为特定模块选择分片组](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [我们的部署：两台机器 16 张卡上的 GLM-5.3-Flash](concepts/glm-5-3-flash-two-node.md)
- [HCCL buffer：通信缓冲怎样配置与占用显存](concepts/hccl-buffer.md)
- [KVPP：KV cache 按层分给各卡常驻，算到时整层广播](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md)
- [EPLB：按实测热度调整专家放在哪张卡](concepts/eplb.md)
- [大规模 EP：请求路由、专家域与跨机通信](concepts/large-scale-ep.md)
- [MoE 通信调度状态机与运行期权重重切分：AllGather / MC2 / Fused MC2 / MegaMoe / AllToAll 与 WeightSwitchMixin](concepts/moe-comm-dispatch.md)
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
- [新模型适配与自定义算子开发实战：权重映射、量化注册与三条 NPU 算子路径](concepts/dev-new-model-and-custom-op.md)
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
- [EPD 分离（多模态编码器 / Prefill / Decode 三池解耦）：ECConnector 缓存交接与独立扩缩](concepts/epd-disaggregation.md)
- [Layerwise KV offload：KV cache 一层一层搬，边算边搬](concepts/kv-cache-layerwise-offload.md)
- [Mooncake 连接器：先对好块号，再按层搬历史状态](concepts/mooncake-connector.md)
- [PD 分离：prefill 与 decode 分给两组实例时怎样交接历史](concepts/pd-disaggregation.md)

### 19 性能工程
- [AISBench 与 EvalScope 实战：压测模式、指标口径对齐与精度基线评测](concepts/aisbench-and-evalscope.md)
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md)
- [昇腾多实例集群部署与路由：DP 外部拉起、前缀感知分发与优雅摘流](concepts/cluster-serving.md)
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
- [msprobe 逐层精度对齐与输出异常定位：从张量转储到算子分歧隔离](concepts/msprobe-accuracy-debug.md)
- [Netloader Guide：新实例怎样从已有 NPU 接过权重](concepts/netloader-guide.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [量化验收：怎样判断省了内存、保住质量、真正提速](concepts/quantization-evaluation.md)
- [量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择](concepts/quantization-methods.md)
- [Sleep Mode：暂停推理时怎样把显存让给训练](concepts/sleep-mode.md)
- [SWA bounded replay：历史窗口丢了，为什么只重算一小段](concepts/swa-bounded-replay.md)
- [v0.30.0 正式版升级与避坑清单：废弃环境变量、默认行为变更与迁移对照](concepts/v030-release-baseline.md)
- [vLLM-Ascend for RL：生成样本后，怎样安全换上新权重](concepts/vllm-ascend-for-rl.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)

### 20 读源码
- [新模型适配与自定义算子开发实战：权重映射、量化注册与三条 NPU 算子路径](concepts/dev-new-model-and-custom-op.md)
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
- [容器镜像、核心环境变量与 vllm serve 最小起服务清单](concepts/ascend-env-and-serve.md)
- [新模型上线标准流程：五维版本锁死、活跃食谱识别与权重选型](concepts/ascend-model-onboarding.md)
- [Embedding：按编号查表取出 token 的向量](concepts/embedding.md)
- [读懂 HuggingFace 模型目录与 config.json：从字段认清架构、显存与坑点](concepts/hf-model-anatomy.md)
- [多模态推理与视觉编码基础：Patch 展开、M-RoPE、ViT 数据并行与两级编码缓存](concepts/multimodal-inference.md)
- [一次请求全景鸟瞰：从输入文字到逐词生成](concepts/request-overview.md)

### 02 矩阵乘法与张量形状
- [Attention 与 Q/K/V：当前位置怎样从历史里取信息](concepts/attention-qkv.md)
- [GQA：几个查询头共读一组 K、V，省下什么、付出什么](concepts/gqa.md)
- [矩阵乘与权重：从输入向量到输出表示](concepts/matmul-and-weights.md)
- [Token、分词与 chat_template：从文本消息到模型编号序列](concepts/token.md)

### 03 一层 Transformer 怎样更新表示
- [Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住](concepts/chunked-prefill.md)
- [Continuous Batching（连续批处理）](concepts/continuous-batching.md)
- [KV cache：新 token 留下历史，下一步接着读](concepts/kv-cache.md)
- [层与隐藏表示：GLM 的 45 层如何连接](concepts/layers-and-hidden.md)
- [lm_head：把最后的隐藏向量变成每个 token 的分数](concepts/lm-head.md)
- [MLP、residual 与 RMSNorm：一个子层怎样更新 hidden](concepts/mlp-residual-norm.md)
- [PagedAttention（分页注意力）](concepts/paged-attention.md)
- [Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写](concepts/prefill.md)

### 04 Attention 深入
- [AI Core：计算单元与数据搬运](concepts/ai-core.md)
- [FlashAttention 与昇腾注意力算子族：片上 Tiling、Online Softmax 与 FA / FIA / PA / FA3 选路](concepts/ascend-flash-attention.md)
- [注意力代价：容量、计算与访存](concepts/attention-cost.md)
- [通信基础：rank 之间怎样交换和归约张量](concepts/collective-communication.md)
- [Data parallel：请求怎样分进两组，空闲的组为什么陪跑](concepts/data-parallel.md)
- [Expert parallel：16 张卡怎样分专家、发 token、收结果](concepts/expert-parallel.md)
- [昇腾四族硬件体系：NPU、板卡、服务器与超节点](concepts/hardware-devices.md)
- [KDA：用一个固定大小的状态代替逐位置历史](concepts/linear-attention.md)
- [BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样](concepts/low-precision-formats.md)
- [MLA：历史压成一条潜向量，用时再展开](concepts/mla.md)
- [流水线并行（PP）：层分段、状态交接与气泡](concepts/pipeline-parallel.md)
- [Roofline 模型与性能三角：算力墙 vs 带宽墙与算术强度拐点](concepts/roofline-and-metrics.md)
- [RoPE：把位置变成旋转，让注意力分数只看相隔多远](concepts/rope.md)
- [稀疏注意力：先挑位置，再只读这些位置](concepts/sparse-attention.md)
- [Tensor Parallel：一台机器的 8 张卡怎样合算一层](concepts/tensor-parallel.md)

### 05 Prefill 与 Decode
- [KV cache 显存预算：启动时怎样一项项扣出来](concepts/kv-cache-memory-profiling.md)
- [NPUWorker 启动：一张卡按什么顺序准备好接请求](concepts/npu-worker-lifecycle.md)
- [Pooling 与非自回归推理：Embedding / Reranker / 生成式评分与 Whisper ASR](concepts/pooling-and-non-ar.md)
- [Sampling：从词表分数里定下一个 token](concepts/sampling.md)
- [高阶采样、惩罚项、Beam Search 与 Logprobs：vLLM V1 采样流水线与昇腾快慢路径](concepts/sampling-advanced.md)

### 06 MoE
- [vllm serve 核心参数全分支调优指南：显存水位、批预算 6 分支与图编译联动](concepts/core-cli-params.md)
- [MoE：一层里放很多专家，每个 token 只用几个](concepts/moe.md)

### 07 昇腾 NPU 剖面
- [AI QoS：共享链路拥塞时，哪类流量先走](concepts/ai-qos.md)
- [昇腾 950：一块数据怎样少绕路、少等候](concepts/ascend-950-architecture.md)
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [Engram 条件记忆：N-gram 哈希查表与 Host DRAM / RDMA 共享](concepts/engram-conditional-memory.md)
- [ND 与 NZ：张量的数值没变，内存里怎样重新排列](concepts/tensor-layout.md)

### 08 服务器与机柜
- [CANN 与 HCCL：计算、通信和物理链路](concepts/cann-hccl.md)

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
