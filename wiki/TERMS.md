## 术语叫法表

本表统一叫法与简明定义；详细机制、适用条件及固定来源由“对应页面”维护。模型数字集中在主模型与来源基线页，术语表不另存一套。

- 正文用「统一叫法」；一个词第一次在页里出现时，按「简明定义」解释一遍（措辞可换，意思不变）。
- 「别的叫法」是读者可能搜的写法：讲到这个词的页，把它们收进 frontmatter 的 `aliases`。
- 「对应页面」写「缺」的词还没有专页：先用白话解释，不要造链接。
- 代码名（函数、类、配置项）不受此表约束，照源码原样写；解释职责、接口和配置时可就地使用，不强制固定分区。
- 「待核」表示该定义还没有页面能佐证，写相关页时先核实再沿用。
- 表随新页扩充：一个新词要在多页出现，先补进这张表再用。

### 一、模型计算

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| token | 词元、令牌 | 分词器输出的离散符号，通常以整数编号表示；一个 token 不必对应一个汉字或单词。 | token | 正文统一写 token。 |
| embedding（词向量） | 词嵌入、嵌入向量 | 按 token 编号从嵌入矩阵读取向量，作为模型的输入表示。 | embedding | 不同类型的 embedding 应说明来源。 |
| 层 | layer、Transformer 层 | 模型中重复堆叠的计算单元；具体子层与连接方式取决于架构。 | layers-and-hidden | 区别模型层、软件层与存储层级。 |
| 隐藏向量（hidden） | 隐藏态、hidden state | 模型为各输入位置维护的中间表示，其张量可能含批次、位置或多路连接等维度。 | layers-and-hidden | 隐藏维度是长度，不是隐藏向量的同义词。 |
| 权重 | weight、模型参数 | 训练得到的数字，固定模型推理时读取使用。 | matmul-and-weights | 和「参数量」「配置项」分开；继续训练、适配器或更新模型是另外的操作。 |
| 参数量 | 总参数、激活参数 | 模型权重中标量的数量；总参数量与一次输入参与计算的参数量分别统计。 | matmul-and-weights | 模型规模写参数量，启动选项写配置项。 |
| 矩阵乘 | matmul、GEMM、矩阵乘法 | 沿共享维度相乘并求和，把输入表示映射到输出空间。 | matmul-and-weights | 是否是性能瓶颈取决于形状与运行负载。 |
| attention | 注意力、自注意力 | 利用查询与键计算权重，并对相应值向量加权汇合；不同变体改变访问范围、表示或计算形式。 | attention-qkv | 密集因果注意力是本库基础对照。 |
| Q、K、V | query、key、value、QKV | 查询、键和值三类表示：Q 与 K 形成匹配分数，权重用于汇合 V。 | attention-qkv | 避免拟人化的提问与答案比喻。 |
| attention score | 注意力分数 | 由查询与键计算、在标准注意力中送入 softmax 的数值。 | attention-qkv | 区分归一化前的分数和归一化后的权重。 |
| softmax | 归一化指数 | 把一排分数换算成加起来等于一的比例。 | attention-qkv | |
| attention head | 注意力头、head、多头、Q 头、KV 头 | 按各自表示空间计算注意力的分支；Q 头与 KV 头数量不一定相同。 | gqa | 首次写全注意力头。 |
| 头维度 | head dim、head_size | 一个注意力头的查询、键或值向量长度，具体维度需分别说明。 | attention-qkv | 不能默认 QK 与 V 维度始终相等。 |
| causal mask | 因果掩码 | 限制当前位置只能使用当前及更早输入位置，屏蔽未来位置。 | attention-qkv | 与结构化输出的文法掩码分开。 |
| MLP | FFN、前馈网络 | 对每个位置独立施加的前馈变换，常含维度扩张、非线性与输出投影。 | mlp-residual-norm | 带门控的 FFN 与普通两投影 FFN 分别解释。 |
| residual | 残差、残差连接 | 将子层输入通过恒等路径与子层输出相加。 | mlp-residual-norm | 多路连接（mHC）见 layers-and-hidden，不把 mHC 当普通相加。 |
| RMSNorm | 均方根归一化 | 根据输入的均方根进行缩放，再应用可学习的增益。 | mlp-residual-norm | LayerNorm 会减去均值，是另一种归一化。 |
| MoE | 混合专家、Mixture of Experts | 用多个专家与路由机制组织前馈计算，稀疏 MoE 让每个输入位置选择部分专家。 | moe | 共享专家和路由专家分别计数。 |
| expert | 专家 | MoE 中执行特定前馈变换的模块；输入是否经过它由专家类型与路由决定。 | moe | 具体数量只在对应模型页定义。 |
| router | 路由器、门控、gate | MoE 每层的小网络，决定每个 token 交给哪几个专家。 | moe | 网络叫「路由器」，输出叫「路由结果」；把请求分给 DP 副本的叫「前端路由」，是另一回事。 |
| shared expert | 共享专家 | 不参与路由专家的 top-k 竞争、供输入共同使用的专家路径。 | moe | 数量、门控和组合方法按模型说明。 |
| linear attention | 线性注意力 | 可用固定形状的递推状态汇总历史的一类注意力方法，计算形式依具体变体而异。 | linear-attention | GDN、KDA 是具体机制，Mamba 不作为同义词。 |
| KV cache | KV 缓存、kv cache | 保存注意力后续计算所需的历史表示，避免重复计算已经处理的位置。 | kv-cache | 普通 K/V、MLA 压缩历史和 KDA 递推状态分别说明；框架缓存池也可能管理后者。 |
| prefill | 预填充、P 阶段 | 处理提示词中尚未计算的位置并建立历史状态，可以整段或分块执行。 | prefill | 缓存命中时可能只处理剩余部分。 |
| decode | 解码、D 阶段 | 在已有历史上继续生成输出；普通自回归常每轮处理一个新位置，投机路径可处理多个。 | prefill | 区分输入位置数、草拟数与接受输出数。 |
| dense causal attention | 密集因果注意力 | 每个查询使用当前及之前所有允许位置的键和值。 | attention-qkv | 先讲基础访问与汇合，再比较稀疏选择。 |
| sparse attention | 稀疏注意力 | 每个查询仅访问允许历史中的一个子集，选择方法依模型而异。 | sparse-attention | 稀疏选择不等于低秩表示，二者可组合。 |
| GQA | Grouped-Query Attention | 多个 Q 头共享一个 KV 头，减少 KV 表示数量。 | gqa | 是对照结构，不自动代表 GLM 的注意力实现。 |
| MLA | Multi-head Latent Attention | 用压缩潜在表示及相应投影组织多头注意力。 | mla | 缓存压缩维度与读取位置数分开。 |
| DeltaNet | delta rule | 按当前值与状态读出之间的误差修正矩阵状态的递推注意力机制。 | linear-attention | 它与加性线性注意力的更新形式不同。 |
| Gated DeltaNet | GDN | 在 delta 更新中引入遗忘门，以调节历史保留。 | linear-attention | GLM 的具体 KDA 路径另有按通道衰减。 |
| KDA | Kimi Delta Attention | 采用按通道遗忘的 delta 更新注意力机制。 | linear-attention | 说明基础与数学变化，不把概念对照擅写成发明史。 |
| mHC | Manifold-Constrained Hyper-Connections | 约束多路残差连接的混合与写回方式。 | layers-and-hidden | 路数、Sinkhorn 与代价只在对应页面讲。 |

### 二、推理框架

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| 请求 | request | 一次服务调用及其输入、生成设置、进度与输出等状态。 | one-request | 不限定为问答形式。 |
| 序列 | sequence、序列长度 | 按位置排列的输入与已生成 token；已持有长度可能大于已经计算的长度。 | one-request | 讲清逻辑位置与物理缓存的区别。 |
| 一批 | batch、批次 | 一次模型执行共同处理的输入集合，可能包含多个请求的不同数量位置。 | concurrent-requests | 批处理也包括在线连续批处理，不限定为离线作业。 |
| 一步 | step、迭代 | 引擎的一次调度、执行与结果更新过程；异步实现可让不同迭代部分重叠。 | vllm-engine-core | 一次迭代不保证每个请求都产生一个输出 token。 |
| scheduler | 调度器 | 根据请求进度、执行预算与可用状态资源选择本轮工作。 | vllm-scheduler | 同时管理等待、抢占、完成及相应资源变更。 |
| KV block | KV 块、block、物理块、页 | 缓存管理与分配的单位，具体内容和大小由缓存规格决定。 | vllm-kv-block-allocation | 注意力 token 块和递推状态块不能视为相同布局。 |
| block table | 块表、块映射表 | 把请求在某个缓存组的逻辑块位置映射到池内物理块编号。 | block-table | 编号不等于内存字节地址。 |
| slot | 槽位 | 按具体缓存布局定位待写入位置的编号。 | prepare-inputs-flow | 普通分页算例为物理块号乘块大小加偏移；LoRA 槽号是另一概念。 |
| prefix caching | 前缀缓存、APC | 在兼容的模型与状态条件下，复用已计算的相同前缀。 | prefix-caching | 复用条件、块边界与混合状态支持需明确，不仅比较文本。 |
| chunked prefill | 分块预填充 | 把尚未完成的提示词计算分配到多轮调度。 | chunked-prefill | 块大小由预算和实现约束决定。 |
| speculative decoding | 投机解码、推测解码 | 先生成候选 token，再由目标模型验证，并按算法接受或修正候选。 | speculative-decoding | 草稿来源不一定是独立小模型；有草稿和验证开销。 |
| MTP | Multi-Token Prediction | 多 token 预测结构或目标；推理可使用模型配套模块生成投机草稿。 | speculative-decoding | GLM 配置的 MTP 层数与每轮草拟 token 数是不同量，统一依据主模型来源基线。 |
| PD disaggregation | PD 分离、disaggregation、分离部署 | 把 prefill 与持续生成分配到不同执行组，通过传输相应历史状态衔接。 | pd-disaggregation | 执行组与物理服务器不必一一对应。 |
| quantization | 量化、W8A8 | 以低精度格式及相应缩放表示数值，并配合量化、反量化或低精度算子计算。 | quantization | 分别说明权重、激活与缓存；误差和收益须验证。 |
| graph mode | 图模式 | 捕获满足条件的设备操作序列并回放，以减少逐次提交开销。 | graph-mode-layer | 与编译优化分开；并非每次都捕获整个模型。 |
| ACL Graph | ACLGraph、ACL 图 | 昇腾上实现图模式的那套机制。 | acl-graph | 统一「ACL Graph」两词分开；npugraph_ex、torchair 是另外的图路径，别混为一谈。 |
| eager mode | eager 模式、单算子模式 | 按执行过程逐步提交算子，不复用该路径的捕获图。 | acl-graph | 不等于设备同步执行或没有算子内部融合。 |
| operator | 算子、op | 对张量定义输入输出和运算语义的计算操作。 | ops-and-kernels | kernel 是具体设备实现，不作为算子的严格同义词。 |
| 进程 | process | 由操作系统管理、具有独立地址空间的执行实体。 | engine-processes | 可以显式建立共享内存或其他通信机制。 |
| Worker | worker、工作进程 | 负责设备初始化、模型执行与相关资源管理的执行角色。 | npu-worker-lifecycle | 角色不总是独立进程，须结合执行器部署说明。 |
| rank | 全局 rank、组内 rank、DP rank、TP rank | 参与分布式执行的成员编号；编号的范围由全局或具体通信组决定。 | collective-communication | DP 编号和全局 worker 编号分开。 |

### 三、昇腾硬件

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| 昇腾 | Ascend | 华为的 AI 芯片和配套软件这一整套东西。 | vllm-ascend-overview | 包名、类名里的 Ascend 照原样。 |
| NPU | 昇腾芯片、device | 昇腾计算处理器；本库部署语境指软件可见的计算设备。 | hardware-devices | 软件设备、物理封装与板卡分别计数，不默认一一对应。 |
| 卡 | 单卡、加速卡 | 一块板级加速硬件。 | hardware-devices | 数计算设备用 NPU；板卡与设备的映射按具体型号核对。 |
| Atlas A2 / A3 | Atlas A2、Atlas A3 | 昇腾产品系列的称呼，具体规格还要看完整产品型号。 | hardware-devices | 不把 910B、A5 混作同义词；首次写全 Atlas A2 / Atlas A3。 |
| 显存 | 设备内存、HBM | NPU 侧供计算使用的内存，常存权重、KV Cache 和临时结果。 | device-memory | HBM 是内存技术名，不是所有设备内存的同义词；实际预算见 kv-cache-memory-profiling。 |
| 主机内存 | host memory、CPU 内存 | CPU 一侧的内存，和设备显存分别计算容量。 | device-memory | 不假定容量或速度关系；卸载过程见 kv-cache-cpu-offload。 |
| AI Core | AICore | NPU 内承担计算的一类核心，另含存储、搬运与控制部件。 | ai-core | 已按 CANN 8.0.RC2 指南核实耦合/分离模式；不是 Cube、Vector 的同义词。 |
| Cube / Vector / Scalar | AIC、AIV、AI Cube、AI Vector | 分别承担矩阵、向量、标量计算的单元。 | ai-core | AIC/AIV 是分离模式下的核心称呼，和单元层级分开讲；不推定核数比例。 |
| CANN | 昇腾软件栈 | 承接上层计算框架、提供运行时、算子、图与通信等能力的软件体系。 | cann-hccl | 环境记录中将 CANN 与驱动、固件版本分别列出。 |
| HCCL | 集合通信库 | 组织昇腾设备在同机或跨机器收发、合并数据的软件库。 | cann-hccl | 首次写「HCCL（昇腾集合通信库）」；属于 CANN，不是物理链路。 |
| 超节点 | SuperPoD | 多个计算设备通过高速互联组成的协作系统。 | hardware-devices | 已核 Atlas 900 A3 SuperPoD 官方实践；内存池化还依赖软件，不能把它说成自动合成一颗 NPU。 |
| 机器 | 节点、服务器、单机 | 一台物理服务器。 | hardware-devices | 「节点」可能指物理机器，也可能指 P/D 部署角色，正文应说明语境。 |

### 四、并行与通信

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| collective communication | 集合通信、collective | 通信组成员共同参与、按规定的归约或分发语义交换数据的操作。 | collective-communication | 调用顺序、参与组和张量必须匹配；通信组不是操作本身。 |
| tensor parallel（TP） | 张量并行 | 把一次张量计算分片到多个设备，通过相应通信组合部分结果。 | tensor-parallel | 通信类型取决于切分轴与下一步所需布局。 |
| data parallel（DP） | 数据并行 | 把不同请求或批次分配到不同执行组，各组维护相应的请求状态。 | data-parallel | 纯副本与结合 EP 的布局分开；推理通常不执行训练的梯度同步。 |
| expert parallel（EP） | 专家并行 | 在多个设备间分配专家，按路由分发激活并组合专家输出。 | expert-parallel | 专家放置、请求路由和负载均衡是不同决策。 |
| pipeline parallel（PP） | 流水线并行、流水并行 | 按模型计算顺序划分执行阶段，阶段间传递中间表示。 | pipeline-parallel | 自回归反馈与流水线空闲都影响利用率。 |
| context parallel（CP） | 上下文并行、PCP、DCP | 沿上下文维度分配计算或历史状态，并通过通信形成所需结果。 | context-parallel | PCP、DCP 是具体执行路径，不互作同义词；模型兼容分别核实。 |
| sequence parallel（SP） | 序列并行 | 与 TP 配合，按序列位置分配逐位置计算及其激活。 | sequence-parallel | cann-hccl 的 AI QoS 一节里 SP 表示严格优先级，语境不同。 |
| all-reduce | All-Reduce、AllReduce、全归约 | 对成员的对应元素执行指定归约，并使每个成员获得完整结果。 | collective-communication | 教学 SUM 不是唯一归约操作；正文与图可使用 All-Reduce。 |
| all-gather | All-Gather、AllGather | 收集各成员的分片，使每个成员得到按组顺序组织的完整集合。 | collective-communication | 拼接不做加法；与本地索引 gather 区别。 |
| reduce-scatter | Reduce-Scatter、ReduceScatter | 归约成员的对应输入，再把结果分片分给各成员。 | collective-communication | 每个成员只保留自己的结果分片。 |
| all-to-all | All-to-All、AllToAll、全交换 | 每个成员按目标成员拆分发送内容，并收集来自各成员的相应部分。 | collective-communication | 负载不均时还需相应变长协议或实现。 |
| MC2 | 通算融合 | 把矩阵计算与通信协同执行的一类昇腾实现。 | large-scale-ep | 是否减少暴露的等待取决于实现与负载，不自动降低通信字节数。 |
| dispatch / combine | 派发、结果组合 | MoE 按路由把输入分配给专家，再把返回结果按对应关系与权重组合。 | expert-parallel | token–expert 配对数、网络消息数与算子调用次数分开。 |
| process group | 通信组 | 具有明确成员及组内编号、用于组织通信的逻辑集合。 | collective-communication | 成员关系不说明物理链路。 |
| Broadcast | 广播 | 指定来源成员把同一数据传给组内其他成员。 | collective-communication | 无归约。 |
| Reduce | 归约 | 对组成员输入执行指定操作，仅目标成员得到结果。 | collective-communication | 区别于所有成员都得到结果的 All-Reduce。 |
| Gather / Scatter | 收集 / 分发 | 分别把各成员分片集中到目标，或从来源分发不同分片。 | collective-communication | 区分集合操作与本地索引。 |
| Send / Recv | 发送 / 接收 | 两个通信成员之间的点对点数据传输。 | collective-communication | 消息与接收需要匹配。 |
### 五、RFork 工作版

RFork 是同事仓库的权重加载工作版，术语自成一套；下面只收 RFork 特有的词，和前四节重复的（TP / PP / EP / DP、rank、world size、MoE、expert、MTP、MLA、quantization、shape、dtype 等）不再重列。

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| RFork | 工作版、权重直传 | 让新起的 Worker 直接从已加载好的 Worker 读权重的加载方式。 | rfork | 独立演进的工作版，不等于上游 vllm-ascend 的能力。 |
| seed | 种子 | 已加载好、可以对外提供权重的来源 Worker。 | rfork-identity | 它还可以同时服务推理；一个 Worker 先当 receiver，之后可以转成 seed。 |
| receiver | destination、接收端 | 正在接收权重的 Worker。 | rfork-transfer | 自己分配目标内存并主动发起读。 |
| Planner | scheduler、调度服务 | 管理有哪些 seed、还剩多少名额的外部服务。 | rfork-config | 名字虽叫 scheduler，但不是 vLLM 逐 token 的请求调度器。 |
| TransferEngine | 传输引擎 | YuanRong 数据系统提供的传输对象，注册可访问内存并按地址读字节。 | rfork-transfer | 不是 HTTP 服务；从 `yr.datasystem` 导入，不是 RFork 自己实现。 |
| YuanRong | yr.datasystem、数据系统 | 提供 RFork 所调用数据传输能力的外部软件。 | rfork | 不负责模型逐 token 推理；排错要单独记它的版本。 |
| RForkSession | 加载会话 | 一个 main 或 draft 加载会话的资源所有者。 | rfork-lifecycle | 持有租约、传输后端、seed 服务、心跳与释放线程。 |
| seed server | 元数据服务 | Worker 内另起线程提供地址和形状信息的 HTTP 服务。 | rfork-startup | 只发元数据，不发送权重主体。 |
| manifest | 张量清单 | 名字对应元数据的表，当前含地址、numel、元素字节数、shape、dtype。 | rfork-transfer | 描述哪些字节属于哪些张量；拿到清单不等于字节已经到位。 |
| MR | Memory Region、内存登记 | 向传输引擎登记的可访问内存范围。 | rfork-transfer | 登记成功后地址必须保持有效，直到确认注销或引擎清理完成。 |
| logical range | 逻辑范围 | 本次真正要暴露的那段张量字节范围。 | rfork-transfer | 可小于底层分配块，避免把无关内存一并当成权重。 |
| backing range | 支撑范围 | 支撑 logical range 的底层内存范围。 | rfork-transfer | 登记时逻辑起点/长度与支撑起点/长度一起提交。 |
| allocator block | 分配块 | NPU 内存分配器记录的一次分配。 | rfork-transfer | 用来证明张量范围有底层分配支撑，不是 KV block。 |
| storage owner | 保活引用 | 保持 Tensor 和原始 storage 不被释放的引用。 | rfork-transfer | 存的是 storage 对象本身，不是 Tensor。 |
| chunk | 传输批次 | 一次批量传输的一组字节段。 | rfork-transfer | 工作版按 1 GiB / 512 段上限切，不按 token 切。 |
| transfer session ID | 传输会话编号 | 远端 TransferEngine 的端点标识。 | rfork-transfer | 不是 Planner 发出的 USER_ID，也不是模型服务的 HTTP 端口。 |
| seed key | 匹配键 | 用来找到同类权重分片的哈希键。 | rfork-identity | 筛选候选 seed 用，不是访问加密密钥。 |
| fingerprint | 兼容性指纹 | 对所选配置字段规范化后算出的摘要。 | rfork-identity | 不计算权重内容，不能证明模型文件完全相同。 |
| lease | 租约 | Planner 分给接收端的一次借用名额。 | rfork-config | 不会自动锁住 source 的 NPU 内存，也不会取消超时中的 read。 |
| USER_ID | 租约凭据 | Planner 返回的这次借用的 ID。 | rfork-config | 不是人的账号；日志用其哈希关联。 |
| resource point | 资源点 | 示例 Planner 的并发容量单位。 | rfork-config | 一次分配占一个点，不是显存字节数。 |
| TTL | Time To Live、有效期 | 租约的有效期。 | rfork-lifecycle | 租约 TTL 与 seed 心跳失效时间是两个计时器。 |
| heartbeat | 心跳 | seed 定期报告自身还在。 | rfork-lifecycle | 不等于 receiver 为租约续期。 |
| renewal | 续租 | 延长仍有效租约的协议。 | rfork-lifecycle | 当前工作版没有启用：代码里没有任何续租调用，只有设计文档提过。 |
| promotion | advertisement、发布 | 把自己发布成可用的 seed，或从接收方转为来源方。 | rfork-lifecycle | 已加载好模型不代表已经发布成功。 |
| fallback | 回退 | 清理本次尝试后改走默认模型加载器。 | rfork-startup | 可能重新分配完整模型；旧注册未安全解除时必须停止。 |
| processed layout | 后处理布局 | 经过加载后处理的权重布局。 | rfork-layout | 量化打包、转置、派生张量都可能改变模型中的对象。 |
| packed weight | 打包权重 | 为算子打包后的权重。 | rfork-layout | 常藏在 `impl` 对象里，只扫 `state_dict` 可能漏掉。 |
| NZ | 昇腾分块格式 | 昇腾的一种分块存储格式。 | rfork-layout | 不能把格式转换简单理解为给 Tensor 改 shape。 |
| shard | 分片 | 一个完整模型被并行策略切开后本 Worker 持有的那部分。 | rfork-identity | 同一模型的不同分片不能互相替代。 |
| target | main、目标模型 | 正式提供验证与输出的那个模型。 | rfork-startup | 这里的 main 指模型角色，和 Git main 分支没有关系。 |
| draft | 草稿模型 | 投机解码里提出候选 token 的模型。 | rfork-startup | 可能与 target 共享部分甚至全部存储；拥有独立 RFork session。 |
