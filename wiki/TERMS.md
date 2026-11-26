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
| Gated DeltaNet（GDN） | GDN、Gated DeltaNet、门控 DeltaNet | 在线性注意力的 delta 误差修正中引入遗忘门，按当前输入动态决定保留多少旧状态、写入多少新信息。 | linear-attention | Qwen3-Next 等混合架构采用 GDN；GLM 的具体 KDA 路径另有按通道衰减。 |
| KDA | Kimi Delta Attention | 采用按通道遗忘的 delta 更新注意力机制。 | linear-attention | 说明基础与数学变化，不把概念对照擅写成发明史。 |
| SWA | Sliding Window Attention、滑动窗口注意力、滑窗注意力 | 每个查询只读取紧邻最近固定窗口长度内的历史位置，更早位置的逐词 KV 可不再常驻。 | swa-bounded-replay | 单层只看局部窗口，深层堆叠或与全局注意力层交替后仍可传递远距信息；窗口状态丢失后的近似恢复见有界回放。 |
| LSE | Log-Sum-Exp、对数指数和 | 一组注意力分数的指数和再取对数（常拆成最大值与缩放和），用来在分块或跨卡计算后无损合并多段 softmax 结果。 | ascend-flash-attention | Online Softmax 靠块级最大值与指数和递推重标定；上下文并行跨卡归约注意力分片时也靠交换输出与 LSE 精确合齐。 |
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
| LPT 调度 | Longest Processing Time first、最长任务优先 | 余额宽裕或摆放资源时，优先接纳预计输出更长的作业或按负载从重到轻放置副本的贪心策略。 | batch-job-aware-scheduler | 批作业感知调度器在空闲块宽裕时按 LPT 先接长作业；STAIR EPLB（`stair_config`）亦用带回溯约束的 LPT 摆放专家副本，故裸缩写 `LPT` 不绑单一页面。 |
| speculative decoding | 投机解码、推测解码 | 先生成候选 token，再由目标模型验证，并按算法接受或修正候选。 | speculative-decoding | 草稿来源不一定是独立小模型；有草稿和验证开销。 |
| MTP | Multi-Token Prediction | 多 token 预测结构或目标；推理可使用模型配套模块生成投机草稿。 | speculative-decoding | GLM 配置的 MTP 层数与每轮草拟 token 数是不同量，统一依据主模型来源基线。 |
| EAGLE | EAGLE-3、特征级投机草稿 | 复用主模型上层隐藏向量与前一步 token 嵌入，用轻量草稿头连续预测后续候选 token 的投机解码方法。 | speculative-decoding | 比独立小模型草稿更省显存且接受率通常更高；与模型自带的原生 MTP 模块是两种不同的草稿来源。 |
| COW | Copy-on-Write、写时复制 | 多方先将页表或块表映射到同一份只读物理空间，直到某一方改写该页或未满块时才分配新空间拷贝分离。 | vllm-kv-block-allocation | 操作系统 `fork` 复制页表让父子初始共指同一批只读物理页；vLLM V1 前缀缓存默认共享不可改写的已满整块（新版特定条件下支持部分尾块复用），续写分叉时另借新块追加而不复制已满共享块。 |
| PD disaggregation | PD 分离、disaggregation、分离部署 | 把 prefill 与持续生成分配到不同执行组，通过传输相应历史状态衔接。 | pd-disaggregation | 执行组与物理服务器不必一一对应。 |
| quantization | 量化、W8A8 | 以低精度格式及相应缩放表示数值，并配合量化、反量化或低精度算子计算。 | quantization | 分别说明权重、激活与缓存；误差和收益须验证。 |
| graph mode | 图模式 | 捕获满足条件的设备操作序列并回放，以减少逐次提交开销。 | graph-mode-layer | 与编译优化分开；并非每次都捕获整个模型。 |
| FX 图 | FX、torch.fx、FX 计算图 | `torch.compile` 捕获的算子级有向计算图表示，用于编译期图融合或按注意力边界切分子图。 | graph-mode-layer | 编译期改写 FX 图与运行时捕获回放 `ACL Graph` 分属不同阶段。 |
| ACL Graph | ACLGraph、ACL 图 | 昇腾上实现图模式的那套机制。 | acl-graph | 统一「ACL Graph」两词分开；npugraph_ex、torchair 是另外的图路径，别混为一谈。 |
| eager mode | eager 模式、单算子模式 | 按执行过程逐步提交算子，不复用该路径的捕获图。 | acl-graph | 不等于设备同步执行或没有算子内部融合。 |
| operator | 算子、op | 对张量定义输入输出和运算语义的计算操作。 | ops-and-kernels | kernel 是具体设备实现，不作为算子的严格同义词。 |
| 进程 | process | 由操作系统管理、具有独立地址空间的执行实体。 | engine-processes | 可以显式建立共享内存或其他通信机制。 |
| fork / spawn | fork、spawn、子进程启动方式 | 操作系统创建子进程的两种方式：`fork` 复制分叉瞬间的父进程内存视图，`spawn` 启动全新独立的 Python 解释器重新加载模块与补丁。 | engine-processes | 已初始化 NPU 上下文后不能直接 `fork`；`vllm serve` 多进程 Worker 默认用 `spawn`。 |
| ZMQ | ZeroMQ、进程间消息队列 | 轻量级异步消息通信库，vLLM V1 用它在前端 API server 与后端 EngineCore 进程之间收发请求与生成结果。 | engine-processes | 支持本机 IPC 套接字与跨网络 TCP 传输，承担控制面与请求流通信，不直接搬运大块 NPU 显存张量。 |
| ZMQ IPC / SHM | ZMQ IPC、SHM、进程间通信、共享内存、POSIX 共享内存 | 同机不同进程交换数据的机制；其中共享内存（SHM）让多个进程直接映射同一块主机内存，免去序列化与反复拷贝。 | engine-processes | 同机 Worker 广播调度元数据、Engram 主机表多进程只读共享等常走 `/dev/shm`（容器须确认 `--shm-size`）；RL 同机权重直传另有设备显存 IPC 路径（见 `vllm-ascend-for-rl`）。 |
| RPC | 远程过程调用、Remote Procedure Call | 让另一进程执行指定函数并取回结果的跨进程调用机制；多进程执行器（`mp`）下，EngineCore 每步借此驱动各 Worker 执行前向与采样。 | request-call-chain | 单进程 `uni` 执行器在进程内直接调用；RPC 属于控制面指令调度，不同于设备侧 HCCL 张量集合通信。 |
| EncoderCacheManager | 视觉特征缓存、多模态编码缓存、ScoreEncoderCacheManager | 按单张图像、视频或音频片段哈希独立管理编码器输出特征的缓存机制，在变前缀多轮对话、分块预填充与抢占重算时跳过重复编码。 | multimodal-encoder-cache | 不同于从序列起点连续按块哈希的文本 `prefix caching`；昇腾 `v0.30.0` 另提供两级评分晋升变体。 |
| EncoderAclGraphManager | ViT 图捕获、ViT Packing、EncoderCudaGraphManager | 按视觉输出 token 预算桶升序打包多模态输入，并用昇腾 NPUGraph 与侧流事件同步执行编码器捕获回放的管理器。 | multimodal-encoder-cache | 单项超最大预算桶时自动回退 Eager 模式。 |
| Worker | worker、工作进程 | 负责设备初始化、模型执行与相关资源管理的执行角色。 | npu-worker-lifecycle | 角色不总是独立进程，须结合执行器部署说明。 |
| rank | 全局 rank、组内 rank、DP rank、TP rank | 参与分布式执行的成员编号；编号的范围由全局或具体通信组决定。 | collective-communication | DP 编号和全局 worker 编号分开。 |

### 数值表示、量化方法与布局

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| ND | N-Dimension、ACL_FORMAT_ND | 通用 N 维张量格式，二维连续矩阵通常逐行存储。 | tensor-layout | N 指维数，不特指 batch；ND 不表示未量化。 |
| NZ | FRACTAL_NZ、Nz、ACL_FORMAT_FRACTAL_NZ | 块间按列、块内按行遍历的分块格式，名称来自大 N、小 z 的排列形状。 | tensor-layout | 与数值精度分开；不展开成两个英文单词。 |
| scale / zero-point | 缩放系数、零点 | 共同定义整数编码怎样映射回近似数值；对称方案可省去零点。 | quantization | 记录系数对应的维度、方向和类型。 |
| BF16 | bfloat16、Brain Floating Point | 16 位浮点格式，符号、指数、尾数小数位分别为 1、8、7 位。 | low-precision-formats | 指数范围和局部分辨率分别比较。 |
| NF4 | NormalFloat | QLoRA 中按正态分布设计的四位数值编码。 | low-precision-formats | 不等于 E2M1，也不是任意硬件原生 FP4。 |
| MXFP8 / MXFP4 | MXFP8、MXFP4、MXFP、微缩浮点、Microscaling FP | OCP 微缩放浮点格式：每 32 个连续元素共用一个 8 位 2 的幂次块缩放指数（E8M0），元素本体用 8 位或 4 位浮点存储。 | low-precision-formats | 细粒度块缩放显著缓解激活与权重的离群值溢出；昇腾硬件原生支持范围按具体芯片代际（如 Ascend 950）核对。 |
| PTQ | Post-Training Quantization、训练后量化 | 从已训练模型出发，通过统计、搜索或层级重构得到量化参数。 | quantization-methods | 不要求完整重跑训练；仍有量化计算成本，是否校准取决于方法。 |
| QAT | Quantization-Aware Training、量化感知训练 | 在训练中模拟目标量化误差，让参数适应部署时的低精度计算。 | quantization-methods | 伪量化不等于所有训练张量都低比特存储。 |
| 校准 | calibration、校准集 | 用代表性输入估计范围、分布或误差，帮助选择量化参数。 | quantization-methods | 不限于静态激活量化；和最终评测样本分开。 |
| AWQ | Activation-aware Weight Quantization | 利用激活信息选择权重通道缩放，以改善低比特权重量化。 | quantization-methods | 原论文不是把重要权重永久留在 FP16。 |
| GPTQ | GPTQ 权重量化 | 用层输出重建误差与近似二阶信息补偿逐步量化造成的权重误差。 | quantization-methods | 算法、文件格式与运行内核分别核对。 |
| SmoothQuant | 平滑量化 | 用等价通道缩放将激活的部分量化困难转移给权重。 | quantization-methods | 量化前数学等价，后续舍入仍有误差。 |
| per-channel / per-token / per-group | 逐通道、逐 token、分组量化 | 描述哪些元素共用一份量化参数。 | quantization-methods | 必须说明轴与组大小。 |
| QLoRA | 量化低秩适配 | 冻结量化基础权重，训练低秩适配器的微调方法。 | quantization-methods | 与整个模型的 QAT 分开。 |
| SQNR | 信号量化噪声比 | 以分贝表示信号能量与量化误差能量之比。 | quantization-evaluation | 层级误差指标不能替代任务质量。 |
| KIVI | KV cache 低比特量化 | 用不同量化方向处理 K、V 的二位缓存研究方案。 | kv-cache-quantization | 不据论文推定本站固定镜像已支持。 |

### 三、昇腾硬件

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| 昇腾 | Ascend | 华为的 AI 芯片和配套软件这一整套东西。 | vllm-ascend-overview | 包名、类名里的 Ascend 照原样。 |
| NPU | 昇腾芯片、device | 昇腾计算处理器；本库部署语境指软件可见的计算设备。 | hardware-devices | 软件设备、物理封装与板卡分别计数，不默认一一对应。 |
| 卡 | 单卡、加速卡 | 一块板级加速硬件。 | hardware-devices | 数计算设备用 NPU；板卡与设备的映射按具体型号核对。 |
| Atlas A2 / A3 | Atlas A2、Atlas A3 | 昇腾产品系列的称呼，具体规格还要看完整产品型号。 | hardware-devices | 不把 910B、A5 混作同义词；首次写全 Atlas A2 / Atlas A3。 |
| 昇腾 310P 系列 | 310P、DUO、310P Duo、Atlas 300I DUO | 面向推理部署的昇腾 310P 设备族（框架设备族 `_310P`，常见并列产品型号包括 `Atlas 300I DUO` 与 `Atlas 200I Pro`，二者并非同义词），走专用 `NPUWorker310` 与兼容算子栈。 | hardware-devices | 不支持 `BF16` 与 `npugraph_ex`，须显式指定 `--dtype float16` 并配合专用镜像或量化权重；`Atlas 200I Pro` 的容器设备挂载见 `ascend-env-and-serve`。 |
| 显存 | 设备内存、HBM | NPU 侧供计算使用的内存，常存权重、KV Cache 和临时结果。 | device-memory | HBM 是内存技术名，不是所有设备内存的同义词；实际预算见 kv-cache-memory-profiling。 |
| 主机内存 | host memory、CPU 内存 | CPU 一侧的内存，和设备显存分别计算容量。 | device-memory | 不假定容量或速度关系；卸载过程见 kv-cache-cpu-offload。 |
| 静态大页（HugeTLB） | 静态大页、大页内存、HugePages、Static HugePages、vm.nr_hugepages | 启动前在宿主机操作系统预留连续 `2 MiB` 或 `1 GiB` 物理内存页且常驻不换出的专用页池机制。 | host-memory-and-hugepages | 支撑大规模外置 KV 缓存池与 RDMA 锁页传输，大幅减少页表项与 TLB 未命中；容量核对查 `/proc/meminfo` 与 NUMA `sysfs`。 |
| THP | 透明大页、Transparent HugePages、MADV_HUGEPAGE | 内核在运行期自动或按 `madvise` 提示把普通 `4 KiB` 页合并为 `2 MiB` 大页的动态机制。 | host-memory-and-hugepages | 无需改用专用分配接口（如 Engram 共享表局部启用），但全局开启在内存碎片化时易引发后台拼页停顿抖动。 |
| TCMalloc / jemalloc | 内存分配器、主机内存分配器、ptmalloc、LD_PRELOAD | 带线程本地缓存的用户态高性能内存分配库，通过 `LD_PRELOAD` 替换默认 `ptmalloc` 以降低多线程锁争用与内存碎片。 | host-memory-and-hugepages | 通用调优推荐 `TCMalloc`；`Atlas A3` 与 `950DT` 的 `Kimi-K3` 等食谱明确禁配 `jemalloc`。 |
| 算子下发流水 | TASK_QUEUE_ENABLE、二级流水、二级下发流水、下发空泡 | 由 `torch_npu` 与 ACL 在主机侧构建的异步任务队列，使 Python 分发、Host 分块与 AI Core 计算重叠执行。 | ascend-runtime-and-tuning | 镜像默认 `TASK_QUEUE_ENABLE=1`；设为 `2` 可进一步掩盖 Host 耗时但抬高显存峰值，且在 `main` 分支与图捕获互斥。 |
| UVA | Unified Virtual Addressing、统一虚拟编址、统一虚拟寻址、Host UVA | 把锁页注册后的主机内存与 NPU 显存编入同一套虚拟地址空间，让 NPU 核函数直接按统一指针读写主机侧缓冲。 | device-memory | 可省去部分显式拷贝（如 MRV2 请求状态表、Engram 主机卸载），但数据物理上仍在主机 DRAM，带宽与容量不计入 HBM。 |
| NUMA | Non-Uniform Memory Access、非一致内存访问、NUMA 节点 | 多路服务器把 CPU 核心与本地内存条分成若干就近分组；访问本组内存和直连 PCIe/NPU 更快，跨组访问延迟更高。 | cpu-binding | Worker 绑核把主机下发线程钉在对应 NPU 就近的 NUMA 节点核心上，减少跨节点争抢与算子下发抖动。 |
| AI Core | AICore | NPU 内承担计算的一类核心，另含存储、搬运与控制部件。 | ai-core | 已按 CANN 8.0.RC2 指南核实耦合/分离模式；不是 Cube、Vector 的同义词。 |
| Cube / Vector / Scalar | AIC、AIV、AI Cube、AI Vector | 分别承担矩阵、向量、标量计算的单元。 | ai-core | AIC/AIV 是分离模式下的核心称呼，和单元层级分开讲；不推定核数比例。 |
| MTE | Memory Transfer Engine、数据搬运引擎、MTE1、MTE2、MTE3 | 昇腾 AI Core 内部专职在全局显存（GM）与各级片上缓存（L1、L0A/B、UB）之间异步搬运数据块的硬件单元。 | ai-core | 与 Cube / Vector 计算单元流水重叠执行；搬运耗时盖过计算耗时时，算子就会受限于访存或搬运等待。 |
| CANN | 昇腾软件栈 | 承接上层计算框架、提供运行时、算子、图与通信等能力的软件体系。 | cann-hccl | 环境记录中将 CANN 与驱动、固件版本分别列出。 |
| ACL（AscendCL） | ACL、AscendCL、Ascend Computing Language | CANN 面向应用与框架暴露的底层运行时接口，管理设备绑定、显存分配、流同步及算子与图任务下发。 | cann-hccl | 区别于上层图捕获回放机制 `ACL Graph`（两词分开，见 `acl-graph`）。 |
| ATB | Ascend Transformer Boost、昇腾加速库 | 昇腾神经网络加速库（NNAL）中面向大模型推理的高性能融合算子与图加速组件。 | ops-and-kernels | 裸机部署须加载对应环境脚本（官方容器已内置）；Worker 冷启动收尾常做一次小矩阵 ATB 预热以避免首请求抖动。 |
| HCCL | 集合通信库 | 组织昇腾设备在同机或跨机器收发、合并数据的软件库。 | cann-hccl | 首次写「HCCL（昇腾集合通信库）」；属于 CANN，不是物理链路。 |
| HCCS | Huawei Cache Coherence System、昇腾片间高速互联 | 昇腾芯片及同机多卡（或超节点内）之间的高速直连物理链路，带宽远高于跨机以太网。 | hardware-devices | 张量并行每层频繁同步，通常优先放在 HCCS 互联域内；具体环路或全互联拓扑依机型（如 A2 / A3）核对。 |
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
| EPLB | Expert Parallelism Load Balancer、专家负载均衡、动态专家均衡 | 在专家并行运行期统计各专家被选中的冷热负载，把热门专家复制多份或重排卡间放置，并在线搬运权重切换路由表。 | eplb | 缓解少数热门专家把单张卡堵成整批木桶短板的问题；开启冗余副本会多占显存，重排搬运也有周期开销。 |
| RoCE / RDMA | RoCE、RDMA、RoCEv2、远程直接内存访问 | 绕过操作系统内核协议栈、由网卡直接在两台机器的内存或显存之间读写数据的低延迟跨机网络技术（RoCE 即跑在以太网上的 RDMA）。 | cann-hccl | 跨机 EP 专家通信、PD 分离 KV 传输与跨节点权重直传常走高速 RoCE 网络（同机或超节点内则可走 HCCS / UB 等直连链路）；带宽仍低于机内互联，需区分机内与跨机通信域。 |
| NIXL / HIXL | NIXL、HIXL、KV 传输后端 | 面向推理实例间异步点对点显存/内存块直传的传输库层（NIXL 为 NVIDIA Inference Xfer Library，HIXL 为昇腾 Huawei Xfer Library）。 | mooncake-connector | 处于连接器与底层物理链路（HCCS / UB / RoCE / TCP）之间，按登记好的内存地址段批量读写，不走 HTTP 传张量。 |
| process group | 通信组 | 具有明确成员及组内编号、用于组织通信的逻辑集合。 | collective-communication | 成员关系不说明物理链路。 |
| Broadcast | 广播 | 指定来源成员把同一数据传给组内其他成员。 | collective-communication | 无归约。 |
| Reduce | 归约 | 对组成员输入执行指定操作，仅目标成员得到结果。 | collective-communication | 区别于所有成员都得到结果的 All-Reduce。 |
| Gather / Scatter | 收集 / 分发 | 分别把各成员分片集中到目标，或从来源分发不同分片。 | collective-communication | 区分集合操作与本地索引。 |
| Send / Recv | 发送 / 接收 | 两个通信成员之间的点对点数据传输。 | collective-communication | 消息与接收需要匹配。 |
### 五、RFork 权重快载

RFork 是社区上游 `vllm-ascend main` 中的实验性跨实例权重快载机制；下面只收 RFork 特有的词，和前四节重复的（TP / PP / EP / DP、rank、world size、MoE、expert、MTP、MLA、quantization、shape、dtype 等）不再重列。

| 统一叫法 | 别的叫法（收进 aliases） | 简明定义 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| RFork | Tensor Remote Fork、权重直传 | 让新起的 Worker 直接从已加载好的同身份 Worker 显存读取权重的快载方式。 | rfork | 已合入社区上游 `vllm-ascend main`（实验特性），借不到或校验不合时安全退回默认存储加载。 |
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
| shard | 分片 | 一个完整模型被并行策略切开后本 Worker 持有的那部分。 | rfork-identity | 同一模型的不同分片不能互相替代。 |
| target | main、目标模型 | 正式提供验证与输出的那个模型。 | rfork-startup | 这里的 main 指模型角色，和 Git main 分支没有关系。 |
| draft | 草稿模型 | 投机解码里提出候选 token 的模型。 | rfork-startup | 可能与 target 共享部分甚至全部存储；拥有独立 RFork session。 |
