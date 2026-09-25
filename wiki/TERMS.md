## 术语叫法表

全库同一个东西用同一个叫法。写页、改页时照这张表：

- 正文用「统一叫法」；一个词第一次在页里出现时，按「一句白话」解释一遍（措辞可换，意思不变）。
- 「别的叫法」是读者可能搜的写法：讲到这个词的页，把它们收进 frontmatter 的 `aliases`。
- 「对应页面」写「缺」的词还没有专页：先用白话解释，不要造链接。
- 代码名（函数、类、配置项）不受此表约束，照源码原样写，且只出现在「对照源码」半区。
- 「待核」表示这句白话还没有页面能佐证，写相关页时先核实再沿用。
- 表随新页扩充：一个新词要在多页出现，先补进这张表再用。

### 一、模型计算

| 统一叫法 | 别的叫法（收进 aliases） | 一句白话 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| token | 词元、令牌 | 模型眼里的一个字块，一段话会被切成很多个 token。 | token | 全库已统一用 token，不用中文译名。 |
| embedding（词向量） | 词嵌入、嵌入向量 | 把一个 token 换成一串数字，模型只认数字。 | embedding | |
| 层 | layer、Transformer 层 | 模型里重复很多遍的同一套计算，一遍叫一层。 | layers-and-hidden | 写「第 N 层」「注意力层」，别单写「层」（另有软件层等含义）。 |
| 隐藏向量（hidden） | 隐藏态、hidden state、隐藏维度 | 层与层之间传的那串数字，一个 token 一串。 | layers-and-hidden | 数据叫「隐藏向量」，长度叫「隐藏维度」；别写裸 hidden。 |
| 权重 | weight、模型参数 | 训练得到的数字，固定模型推理时读取使用。 | matmul-and-weights | 和「参数量」「配置项」分开；继续训练、适配器或更新模型是另外的操作。 |
| 参数量 | 总参数、激活参数 | 一个模型里权重的总个数，常写成 7B、35B。 | matmul-and-weights | 模型规模写「参数量」，启动选项写「配置项」；别用裸「参数」两头指。 |
| 矩阵乘 | matmul、GEMM、矩阵乘法 | 把一批数字和权重成片相乘，模型里最费算力的一步。 | matmul-and-weights | 正文写「矩阵乘」，代码名照写 matmul。 |
| 注意力 | attention、自注意力 | 让每个 token 去看前面的 token，再按看到的调整自己。 | attention-qkv | 专名保留原形：PagedAttention、Flash Attention。 |
| Q、K、V | query、key、value、QKV | 每个 token 算出的三份数字：Q 去问，K 被问，V 是答案。 | attention-qkv | 正文用单字母；配置里的 key 不是注意力的 K。 |
| 注意力分数 | attention score | Q 和某个 K 算出来的一个数，表示该看它多少。 | attention-qkv | 别用裸「分数 / 打分」——专家负载均衡也在用。 |
| softmax | 归一化指数 | 把一排分数换算成加起来等于一的比例。 | attention-qkv | |
| 注意力头 | head、多头、Q 头、KV 头 | 同一层里并排做好几份注意力，一份叫一个头。 | gqa | 写「注意力头 / Q 头 / KV 头」，不单用「头」。 |
| 头维度 | head dim、head_size | 一个注意力头里那串数字有多长。 | attention-qkv | |
| 因果掩码 | causal mask、mask | 挡住后面的 token，让每个 token 只看得见前面。 | attention-qkv | 别和结构化输出的「文法掩码」混。 |
| MLP | FFN、前馈网络 | 注意力之后逐个加工 token 的前馈计算，每个 token 各算各的。 | mlp-residual-norm | 带门控的 MLP 可有三片逻辑权重，不能一概说只有两次矩阵乘。 |
| 残差 | residual、残差连接 | 把这一层算出来的加回原来那串数字，而不是换掉。 | mlp-residual-norm | |
| RMSNorm | 归一化、LayerNorm | 把一串数字整体缩放到差不多大小，免得越算越偏。 | mlp-residual-norm | LayerNorm 是另一种做法，不当同义词。 |
| MoE | 混合专家、Mixture of Experts | 把 MLP 换成很多份，每个 token 只用上其中几份。 | moe | |
| 专家 | expert | MoE 里的一份前馈网络，由路由选择参与计算。 | moe | 专家数量依模型而定，本例每层有 256 个路由专家。 |
| 路由器 | router、门控、gate | MoE 每层的小网络，决定每个 token 交给哪几个专家。 | moe | 网络叫「路由器」，输出叫「路由结果」；把请求分给 DP 副本的叫「前端路由」，是另一回事。 |
| 共享专家 | shared expert | 不参加 top-k 选择，所有 token 都经过的专家路径。 | moe | 是否设置、设置几个依模型而定；本例每层一个，输出还有门控。 |
| 线性注意力 | linear attention、GDN、Gated DeltaNet | 可用递推状态汇总历史，不必每步逐位置回看所有 K、V。 | linear-attention | 本例采用 Gated DeltaNet。Mamba 是选择性状态空间模型，不列为同义词。 |
| KV Cache | KV 缓存、kv cache | 把算过的 K 和 V 存起来，下一步直接读，不重算。 | kv-cache | 两个词都大写；简称 KV 在每页首次出现时写全。 |
| prefill | 预填充、P 阶段 | 先把问题里所有 token 一起算一遍，填好 KV Cache。 | prefill | 「P 节点」指跑 prefill 的机器，不是阶段本身。 |
| decode | 解码、D 阶段 | 问题算完后，一次吐一个 token，吐一次算一步。 | 缺（vllm-scheduler 讲两者关系） | 「解码」被投机解码、引导解码借用，统一写 decode。 |

### 二、推理框架

| 统一叫法 | 别的叫法（收进 aliases） | 一句白话 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| 请求 | request | 用户发来的一次提问，服务要为它生成回答。 | one-request | |
| 序列 | sequence、序列长度 | 一条请求的问题加已生成回答，连起来的那串 token。 | 缺 | 调度对象叫「请求」；只在讲长度、讲沿哪一维切时用「序列」。 |
| 一批 | batch、批次 | 同一步里一起算的那些请求，凑成一批。 | 缺（vllm-scheduler 讲怎么凑） | 量词写「批大小」；「批处理」只留给离线批作业。 |
| 一步 | step、迭代 | 引擎转一圈：挑出一批请求，算一次，各吐一个 token。 | vllm-engine-core | |
| 调度器 | scheduler | 每一步决定这一批放哪些请求进来的那段代码。 | vllm-scheduler | 裸「调度」当动词用没问题。 |
| KV 块 | block、物理块、页 | KV Cache 被切成的小段，一段存固定个数的 token。 | vllm-kv-block-allocation | 存储单位一律「块」；「页」只留给分页类比和专名 PagedAttention。每页首次写「KV 块」，后文可简写「块」。 |
| 块表 | Block Table、块映射表 | 一张表，记着一条请求的第几块 KV 在显存的哪一块里。 | block-table | |
| 槽位 | slot | 一个块里能放一个 token 的格子，编号连着排。 | prepare-inputs-flow | LoRA 页的「槽号」是另一个东西。 |
| 前缀缓存 | Prefix Caching、APC | 两条请求开头一样，开头那些块直接拿来用，不重算。 | prefix-caching | |
| Chunked Prefill | 分块预填充 | 问题太长就切成几段，分几步 prefill 完。 | chunked-prefill | 首次写「Chunked Prefill（分块预填充）」。 |
| 投机解码 | Speculative Decoding、推测解码 | 先让小模型猜几个 token，大模型一次验完，猜对就白赚。 | speculative-decoding | 组成部分统一叫「草稿模型」「草稿 token」。 |
| MTP | Multi-Token Prediction | 在本例投机解码中，用模型配套的多 token 预测模块生成草稿。 | speculative-decoding | 已核：Qwen3.6-35B-A3B 的 text_config.mtp_num_hidden_layers 为 1；这不表示服务默认已启用投机解码，开关见该页下半。 |
| PD 分离 | disaggregation、分离部署 | prefill 和 decode 放到不同机器上跑，算完把 KV 搬过去。 | pd-disaggregation | 两边的机器写「P 节点 / D 节点」，不写「P 实例」。 |
| 量化 | quantization、W8A8 | 把权重从大数字换成小数字存，省显存，精度略降。 | quantization | 具体格式（W8A8、int8）照原样写，不翻译。 |
| 图模式 | graph mode | 把一整趟计算提前录下来，之后照录好的重放，省下发开销。 | graph-mode-layer | 两个动作叫「捕获」「回放」。 |
| ACL Graph | ACLGraph、ACL 图 | 昇腾上实现图模式的那套机制。 | acl-graph | 统一「ACL Graph」两词分开；npugraph_ex、torchair 是另外的图路径，别混为一谈。 |
| eager 模式 | 单算子模式 | 不用录好的图，一个算子一个算子地下发。 | 缺（acl-graph 里讲） | |
| 算子 | kernel、内核 | 在 NPU 上真正执行的一小段计算，比如一次矩阵乘。 | 缺 | 概念叫「算子」；kernel 只在指具体实现文件时保留原文；不用「内核」。 |
| 进程 | process | 操作系统里同时跑着的一份程序，互相不共享内存。 | engine-processes | 通信语境的「进程组」指通信组。 |
| Worker | worker、工作进程 | 守着一颗 NPU 干活的那个进程，模型真正在它手里算。 | npu-worker-lifecycle | 正文统一大写 Worker；单 NPU 时它住在 EngineCore 进程里。 |
| rank | DP rank、TP rank | 多颗 NPU 跑同一个模型时，给每份进程排的号。 | 缺（data-parallel 讲 DP rank） | 尽量带前缀写「DP rank / TP rank」——两种粒度不同，裸写会混。 |

### 三、昇腾硬件

| 统一叫法 | 别的叫法（收进 aliases） | 一句白话 | 对应页面 | 备注 |
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
| 超节点 | SuperPoD | 多个计算设备通过高速互联组成的协作系统。 | superpod | 已核 Atlas 900 A3 SuperPoD 官方实践；内存池化还依赖软件，不能把它说成自动合成一颗 NPU。 |
| 机器 | 节点、服务器、单机 | 一台物理服务器。 | hardware-devices | 「节点」可能指物理机器，也可能指 P/D 部署角色，正文应说明语境。 |

### 四、并行与通信

| 统一叫法 | 别的叫法（收进 aliases） | 一句白话 | 对应页面 | 备注 |
| --- | --- | --- | --- | --- |
| 集合通信 | collective、通信组 | 一组 NPU 按固定套路一起收发数据，少一个就卡死。 | 缺 | 参加同一次通信的那组 NPU 叫「通信组」。 |
| 张量并行（TP） | Tensor Parallel | 把每层的大矩阵横竖切开分给几颗 NPU，一层要对一次答案。 | tensor-parallel | 每页首次写全「张量并行（TP）」，之后用 TP。DP / EP / PP / CP / SP 同理。 |
| 数据并行（DP） | Data Parallel | 整个模型复制好几份，请求分给不同副本，各算各的。 | data-parallel | MoE 下各副本仍要一起做集合通信，不是完全独立。 |
| 专家并行（EP） | Expert Parallel | MoE 的专家按编号分给不同 NPU，token 发过去算完再收回。 | expert-parallel | |
| 流水线并行（PP） | Pipeline Parallel、流水并行 | 按层把模型切成几段，一段一组 NPU，接力算。 | pipeline-parallel | 中文只用「流水线并行」这一种写法。 |
| 上下文并行（CP） | PCP、DCP、Context Parallel | 一条请求太长时，把它的 token 分到几颗 NPU 上。 | context-parallel | 具体路径必须写清 PCP 还是 DCP，别用裸 CP 指其中一种。 |
| 序列并行（SP） | Sequence Parallel | 配合 TP 用，把逐 token 的那几步也分给各 NPU 算。 | sequence-parallel | 首次必写全——ai-qos 页的 SP 是「严格优先级」，另一回事。 |
| all-reduce | AllReduce、全归约 | 每颗 NPU 把自己那份结果发出去，最后各自拿到加总。 | 缺（tensor-parallel 讲它落在哪） | 统一小写连字符写法；all-gather、reduce-scatter、all-to-all 同理。 |
| all-gather | AllGather | 每颗 NPU 把自己那份发给所有 NPU，最后大家都有全部。 | 缺 | 裸 gather 多指单 NPU 上的取数动作，别混。 |
| reduce-scatter | ReduceScatter | 先把各份结果加总，再切开，每颗 NPU 只留自己那段。 | 缺（sequence-parallel 讲它怎么替代 all-reduce） | |
| all-to-all | AllToAll、全交换 | 每颗 NPU 给每颗 NPU 都发一份不同的数据。 | 缺（expert-parallel 讲 MoE 怎么用） | |
| MC2 | 通算融合 | 昇腾把通信和计算揉进一个算子，边算边传。 | 缺 | 省的是通信被干等的时间，不是通信量——别写成「省通信量」。 |
| dispatch / combine | 派发、收回 | MoE 每层把 token 发去专家所在的 NPU，算完再收回来。 | 缺（expert-parallel 讲） | 保留英文（它们同时是算子名），首次补一句「发出去 / 收回来」。 |
