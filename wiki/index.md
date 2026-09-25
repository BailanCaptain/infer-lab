# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 122 页。

## 概念（concept）
- [AI Core、Cube 与 Vector：设备里面谁在算](concepts/ai-core.md) — AI Core 不是 NPU 的别名。矩阵、向量和标量计算有不同单元，Cube 与 Vector 可能耦合在一起，也可能分成独立的核心。 `07`
- [四种注意力的代价](concepts/attention-cost.md) — 每记住一个 token，一层要花多少显存？Qwen3.6-35B-A3B 的全注意力层要 2 KiB，DeepSeek 系的 MLA 只要 1152 字节，稀疏注意力比 MLA 还多一点；线性注意力干脆不按 token 记，每层只留一份固定大小的状态。数字各挂各的模型，差别真正的来源是存的东西不一样。 `04`
- [注意力与 Q、K、V：每个 token 回头看前面](concepts/attention-qkv.md) — 模型里大部分计算是每个 token 各算各的，可一句话里「它」指谁、「不」否定什么，都得回头看前面才知道。每层专门有一段让每个 token 回头看：它先给前面每个 token 打一个「该看多少」的数，换算成比例，再按比例把前面各家的内容收进自己这串数字。 `04`
- [块表：请求的第几块，在显存的哪一块](concepts/block-table.md) — 一条请求的 KV 散在显存各处，要有一张表记着「它的第 0 块在显存第几块、第 1 块在第几块……」。这张表就是块表：一行一条请求，一格一个块号。每步写 K、V 之前，先按它把「第几个 token」换算成显存里的格子号。 `11`
- [CANN 与 HCCL：计算和通信由谁接到硬件](concepts/cann-hccl.md) — CANN 把上层计算框架接到昇腾设备；HCCL 是其中负责多设备通信的组件。软件库与物理链路是不同层次。 `07 09`
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md) — CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。 `07 09`
- [embedding：把编号换成一串数字](concepts/embedding.md) — 模型不会拿编号直接算。它手里有一张大表，每个编号对应表里一行；拿编号去表里找到那一行、整行抄出来，这个 token 就变成了一串数字。在贯穿例子里，每个 token 变成 2048 个数字，问题的 37 个 token 就变成 37 串，后面 40 层加工的一直是这批数字。 `01`
- [引擎有哪几个进程](concepts/engine-processes.md) — 在两颗 NPU 上跑起一个模型，机器上会有四个进程：接请求的 Main、每一步排队的 EngineCore、每颗 NPU 一个的 Worker；只用一颗 NPU 时 Worker 不另起进程，住在 EngineCore 里。昇腾要改的上游代码分散在这几处，补丁也要分三条路送进去。 `10`
- [HCCL 通信缓冲区怎么定：默认 200、DP 组自己算、MC2 组不给 pg_options](concepts/gap-a5164fe10fa9184412f8.md) — get_hccl_config_for_pg_options 按通信组名分派 hccl_buffer_size：dp 组按 dp_size 算、dynamic_eplb 组固定 100、其余走默认 200，而含 "mc2" 的组直接返回 None。 `13 14`
- [GQA：16 个 Q 头只存 2 份 K/V，省的是显存不是计算](concepts/gqa.md) — 全注意力层有 16 个 Q 头，却不给每个头各存一份 K、V，而是每 8 个头共用一份，一共只存 2 份。存下来的 K、V 因此只有各存一份时的八分之一；但 16 个 Q 头照样各自把前面全看一遍，计算一点没少。 `04`
- [NPU、卡与机器：先把数量数对](concepts/hardware-devices.md) — 一台机器、一块板卡和一个软件可见的 NPU 设备不是同一个计数单位。先确认设备边界，再决定模型分到哪里。 `07 08`
- [KV Cache](concepts/kv-cache.md) — 模型每吐一个新 token，都要回头看一遍前面所有 token。前面那些 token 被看的那一份数字算出来就不会再变，所以算一次、留在显存里，后面每步直接读，只给新来的那一个现算——这块显存就是 KV Cache。贯穿例子的 40 层里只有 10 层要存它。 `05 11`
- [层与隐藏向量：40 层接力加工](concepts/layers-and-hidden.md) — 查表拿到的那批数字不会一步变成答案。模型有 40 层接力计算，每层骨架相似，但注意力类型可以不同，并各有自己的权重。层与层之间传的那串数字叫隐藏向量，每个 token 一串、2048 个数字，每过一层被修改一次，走完 40 层的那一版拿去决定下一个 token。 `03`
- [线性注意力：不回头翻，只记一份小抄](concepts/linear-attention.md) — 全注意力保留各位置的 K、V，历史越长，逐位置回看的工作越多。线性注意力可以维护固定形状的递推状态来汇总历史。本例把 30 层这种结构与 10 层全注意力混用；状态固定不等于整个服务显存固定。 `04`
- [矩阵乘与权重：模型算的到底是什么](concepts/matmul-and-weights.md) — 大模型的大量算术工作围绕矩阵乘展开：把输入数字与权重成片相乘再相加。这一页讲权重是什么、矩阵形状怎么读，以及 35B 参数量与实际激活参数的区别。 `02`
- [MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE](concepts/mla.md) — 普通模型每层要给每个 token 存每个头的 K 和 V；MLA 只存一条压缩过的短向量，所有头共用，要用时再展开——显存省下来，换成多做的计算。 `04`
- [MLP、残差与归一化：层里除了注意力的那些事](concepts/mlp-residual-norm.md) — 注意力让 token 互相看，看完收进来的东西还得各自消化：层里另一半把每个 token 的数字换到中间宽度、筛一遍、再变回来，每个 token 各算各的。两段算出来的都只是修改量，加回原来那串数字，不是整串换掉；每段开算前还要先把数字缩到差不多大小。这一页把一层的完整顺序拼出来。 `03`
- [MoE：256 个专家，每次只叫 8 个](concepts/moe.md) — 这个模型有 350 亿个参数，可每个 token 只用上约 30 亿。原因是每层里那段计算被拆成了 256 个小份，每个 token 只挑 8 份来算，另有 1 份谁都要过；其余的存着，这次不动。 `06`
- [贯穿全库的例子：37 个 token 的问题，200 个 token 的回答](concepts/one-request.md) — 全库只跟一个例子：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，问题 37 个 token，回答 200 个 token。后面每一页讲的都是它走到某一步时，机器在做什么。 `00`
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md) — 拿那条请求里跑得最多的小算子——归一化——从 Python 一路追到 AI Core。四层里真正要做决定的只有一处分岔：一边是仓库自己编的融合算子，一边是 CANN 现成的算子再单独补一步。 `16`
- [Prefill](concepts/prefill.md) — 回答第一个字之前，先把整段问题一起算一遍、把要记的笔记写进缓存的那一步。它一步算得多，决定了「多久出第一个字」；短问题一步做完，长问题切成几步。 `05`
- [怎么读这个仓库](concepts/reading-vllm-ascend.md) — 几百个文件的仓库没法通读：手上有报错、有配置项、有上游名字，各走一条固定路线去反查；再加上几个版本之间怎么对照，和三种会得出错结论的查法。 `20`
- [一次请求的调用链](concepts/request-call-chain.md) — 一条请求从接口进来到吐出下一个 token，要走七站：前两站是上游 vLLM 在定「这一步算谁」，从第三站起全是昇腾的代码在管「怎么算」；分界线在多卡时还是一道进程边界。 `09`
- [RFork 术语：把模型、内存和调度的名词分开](concepts/rfork-terms.md) — 读 RFork 时碰到的名词，常常一个词在模型、内存、调度三层各有意思。这页按层列成表：每个词指的是什么、和长得像的词差在哪、排错时拿它查什么。
- [RoPE (Rotary Position Embedding)](concepts/rope.md) — 注意力本身分不清词的先后。RoPE 的办法是在算分数之前，把 Q 和 K 里的数字两两一对、按这个 token 的位置转一个角度；两个转过的向量相乘时，位置只剩「隔了几格」这一项。 `04`
- [超节点：连接成整体，数据仍有位置](concepts/superpod.md) — 超节点将多个计算设备通过高速互联组织成协作系统。内存池化还需要软件支持，统一访问不等于所有数据都变成本地显存。 `08`
- [token：模型眼里的字块](concepts/token.md) — 模型不认字，认编号。你打的一段话会先被切成一串 token——每个 token 是一个字块，可能是一个字、半个词或一个词——再换成一串编号交给模型。全库说的「37 个 token 的问题」，数的就是这些字块。 `01`
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md) — 让 vLLM 能在昇腾 NPU 上跑的那一层：单独装的一个包，不改 vLLM 一行代码，而是在上游留好的几个口子里换上昇腾自己的版本。 `10`
- [vllm_ascend 目录地图](concepts/vllm-ascend-repo-map.md) — 昇腾插件有十几万行 Python，按职责能分成六组。第一遍只用读其中三组，其余等碰到具体问题再去翻。 `20`
- [引擎的那个循环：转一圈就是一步](concepts/vllm-engine-core.md) — 整个推理引擎的中心是一个很短的循环：挑一批请求、算一次、每条请求各吐一个 token，然后再转一圈。那条请求的 200 个 token，就是它转了 200 圈。 `10`
- [KV 块是怎么分出来的](concepts/vllm-kv-block-allocation.md) — 全机只有一队空闲的 KV 块。请求要块就从队头取，每块记着有几条请求在用；用完计数减到 0，块排回队里等下一个人。那条 237 个 token 的请求只要了 1 块。 `11`
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md) — 上游把所有「答案取决于硬件」的问题收成一张问卷，起了个名字叫 Platform，将近八十道题，答案被上游代码在近千个地方引用。所谓 vLLM 支持一种新硬件，就是有人把这张问卷答完了；昇腾插件的本体就是一份答卷。 `10`
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md) — 调度器每一步只问每条请求一句话——还差几个 token 没算——再从这一步的名额里分给它。第一步给 37 个、之后每步给 1 个，用的是同一条规则，不是两套代码。 `12`
- [vLLM 的形状：三类角色，两道边界](concepts/vllm-v1-shape.md) — 敲下 vllm serve 之后跑起来的，是几个分了工的进程：一个管文字，一个管排队，每颗 NPU 再配一个管计算。一条请求要往下穿过两道边界再回来，每过一道，手里拿的东西就换一种：字、整数、张量。 `10`
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md) — vLLM 决定这一步算哪些 token，昇腾决定这些 token 怎么算出来。分界线就在上游把「这一步算谁」的清单交出去的那一刻，多卡时它同时是一道进程边界。 `10`

## 特性（feature）
- [ACL Graph：批的 token 数先垫到捕获过的档位，垫不上就整步退回单算子模式](concepts/acl-graph.md) — 启动的时候把整网的算子下发顺序按一批固定尺寸各录一遍，之后每一步按 token 数和「这批是不是整齐的 decode」查录过的图直接回放，省掉的是每个算子喊一次的下发时间，一次计算都没省。 `16`
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md) — 一台 NPU 往外发的三类网络流量（下发计算任务、卡间对答案、把 KV 搬去主机内存）会在交换机上互相挡路；它给每类流量贴优先级，让交换机分车道放行。它不给请求排队，也不经过推理引擎。 `08 18`
- [昇腾的开关从哪进来](concepts/ascend-config-system.md) — 昇腾特有的开关写在启动命令附带的一段 JSON 里：上游原样带着不解释，昇腾启动时按键拆成八组配置对象，整个进程只存一份，各组件随取随用；环境变量走另一条互不相通的路。 `10`
- [Patch 机制](concepts/ascend-patch-system.md) — vLLM 没给昇腾留改动口子的地方，昇腾就在程序跑起来以后，把上游的函数和类直接换成自己的版本。换的时机只有两个：Worker 出生之前换一批，Worker 出生那一刻再换一批；换了哪些，要看当前的芯片、版本和开关。 `10`
- [异步调度：下一步的调度压在上一步的执行底下](concepts/async-scheduling.md) — NPU 算这一步的时候，CPU 不等结果就先把下一步排好；还没算出来的那个 token 先记一张欠条，排的时候照样能算清每条请求这一步要算几个。 `12`
- [注意力后端家族](concepts/attention-backend-family.md) — 一层注意力由哪份「后端」代码来算，有两条路定下来：全注意力层在启动时按三个开关查一张只有四项的表；线性注意力层不查表，层自己带着后端进场。贯穿例子 10 层查到普通后端、30 层自带 GDN 后端，一台机器上两个后端同时在岗。 `04`
- [Balance Scheduling：一个 rank 顶满，所有 rank 一起停收](concepts/balance-scheduling.md) — 同一个 MoE 模型复制成好几份一起跑时，每一步各份先互报自己在跑几条请求；只要有一份顶到上限，所有份这一步都不再放新请求进来，先让顶满的那份把手上的活排空。dense 模型用不上。 `12`
- [Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位](concepts/batch-invariance.md) — 同一条请求，单独跑和混在上百条里跑，输出逐位相同。办法不是算得更准，而是把矩阵乘、求和、softmax、注意力换成加法顺序与批形状无关的实现。光设开关不够：算子包要在编译前装好，main 上还得自己关掉默认开着的 chunked prefill 与前缀缓存，见版本差异表。 `16`
- [Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列](concepts/batch-job-aware-scheduler.md) — 一大堆离线请求一起交上来时，调度器先替已经在算的请求留出下一步要用的显存块，剩下的再按「作业」挑新请求放进来；少接几条，换少被挤掉几次。只适合不在乎等待时间的离线批处理。 `12`
- [Chunked Prefill：问题太长，就切成几段分几步算](concepts/chunked-prefill.md) — 一个问题长到一步算不完时，先算这一步装得下的那一段，剩下的留到下一步接着算。它不是一个单独的模式，而是每一步名额分不完时自然留下的余数。 `12`
- [上下文并行（CP）：一条长请求分给几颗 NPU，PCP 分着算、DCP 分着存](concepts/context-parallel.md) — 一条请求太长时，把它的 token 分到几颗 NPU 上：PCP 多加几颗 NPU 一起算问题，DCP 不加 NPU、把 KV Cache 交错着分开存。 `15`
- [CPU 绑核：给每个 Worker 划一段专用的 CPU 核](concepts/cpu-binding.md) — 昇腾 ARM 服务器上默认开着的一项主机侧优化：把每颗 NPU 对应的 Worker 进程和它的两条后台线程钉在一段固定的 CPU 核上，再把它的内存搬到这段核旁边，省掉被调度器挪来挪去带来的抖动；不改模型怎么算，也不改算出来的结果。 `16`
- [数据并行（DP）：把整个引擎复制几份](concepts/data-parallel.md) — 模型已经装得下、只是请求排不过来时，把整个引擎再复制一份，请求分给不同副本各自算完。它加的是吞吐，不让单条请求变快；MoE 模型的副本之间每一步还得一起通信，不是完全各算各的。 `13`
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md) — 长问题切成一样大的几块送进流水线时，越靠后的块越慢，下一段只能干等。这个功能开机时先真跑一遍、量出「切多大要花多久」，运行时反过来算每一步该切多少，让每块花的时间一样长。只在开了流水线并行时能用，官方把它定位给 PD 分离里跑长问题的 P 节点。 `13 12`
- [DyntraLB：跨 rank 传的只有块数，没有请求 id](concepts/dyntra-lb.md) — D 节点上开了好几个 DP rank 时，各 rank 每一步互报「手上每条请求占几个 KV 块」，按同一套算法决定这一步各自暂停谁、放谁进来，免得最重的那个 rank 拖住所有人；请求从头到尾不换 rank。 `12`
- [EPD 分离：把视觉编码器也拆到单独的节点上](concepts/epd-disaggregation.md) — 多模态模型先要把图算成一串 embedding，EPD 分离把这一步单独放到一类节点（E）上跑，算好的结果交给 prefill / decode 那边直接用，PD 节点上不再跑视觉编码器。 `18`
- [EPLB：把热门专家搬到闲着的 NPU 上，但不改路由](concepts/eplb.md) — 开了专家并行之后，哪颗 NPU 忙由用户的数据决定。EPLB 先数每个专家分到多少 token，再算出新的摆法，一层一层把专家挪过去，让几颗 NPU 差不多一样忙；每个 token 选哪几个专家不变。 `14`
- [专家并行（EP）：专家不切开，按编号分给不同的 NPU](concepts/expert-parallel.md) — MoE 模型每层有几百个专家，一颗 NPU 放不下时，EP 把每层的专家按编号整份分给参与计算的几颗 NPU；每个 token 被送到它选中的专家所在的 NPU 上算完，再送回来。要写 --enable-expert-parallel，而且参与 MoE 的 NPU 多于一颗才生效。 `14`
- [Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切](concepts/fine-grained-tp.md) — 模型复制成很多份时，每颗 NPU 都存着一模一样的词表等大矩阵；细粒度 TP 让相邻几份副本把这几张表分着存，省显存，代价是每次用到都要多通信一次。 `13`
- [Flash Attention 3：不为了快，为了和训练侧算得一样](concepts/flash-attention-3.md) — 注意力后端家族里唯一要显式点名才会换上的成员：把注意力那一步的算子换成训练框架同款的 Flash Attention。官方直说可能更慢——这是为了强化学习里训练侧和推理侧算得一样而有意付的代价。 `16 04`
- [图模式层](concepts/graph-mode-layer.md) — 图模式把一整趟计算提前录下来，之后照着回放，省掉一个一个下发算子的开销；它分单算子、分段、整趟几档，录像在启动的最后一步做完。 `16`
- [KV Cache CPU Offload：把要被淘汰的块存进主机内存](concepts/kv-cache-cpu-offload.md) — 显存里的 KV 块被挤掉之前，先拷一份到主机内存；之后有请求用到同一段开头、显存里却已经没了，就从主机内存拷回来，省掉重算。昇腾只换了真正搬字节的那一段。 `11`
- [Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer](concepts/kv-cache-layerwise-offload.md) — 专职做预填充的机器算完一层，就把这一层的 KV 发去 KV 池，搬运藏进下一层的计算里；v0.26 起还能让很多层轮流用同几份显存，把这一侧的 KV 显存压成常数份。 `11`
- [KV Cache 显存怎么量出来：整卡的九成，减掉量出来的三块](concepts/kv-cache-memory-profiling.md) — 启动时先拿假数据把模型按最重的情况跑一遍，量出权重、临时数据和其他杂项各占多少；整颗 NPU 显存的九成减掉这三块，剩下的就是 KV Cache 能用的地方。录图要的显存不在这道减法里，所以「量过了」不等于「起得来」。 `11`
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md) — 把存起来的 K、V 从 bf16 换成 int8，每个 token 占的地方减半；代价是超出标定范围的大数会被截掉。它由模型文件决定开不开，开发主线上还要启动参数一起同意。 `11 17`
- [Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行](concepts/kv-cache-sparse-offload.md) — PD 分离的 D 节点把全部 KV 放进主机内存，NPU 上只留一小块热缓冲区；每生成一个 token，只把这一步要读、NPU 上又还没有的那几行搬回来。 `11`
- [KV Cache Spec：每层自己报价，引擎才算得出能分几块](concepts/kv-cache-spec.md) — 模型的每一层先向引擎交一份规格，写明自己一块要存多少字节。引擎拿剩下的显存去除这个数，算出能分几块，再回头把显存真正切出来。 `11`
- [KV Pool：命中的前缀不再只能来自本卡显存](concepts/kv-pool.md) — 把算好的 KV 块存进显存之外、多台机器都读得到的存储池；开头相同的请求先用显存里已有的块，缺的整块再从池里搬回来，不用重算。 `11`
- [KVPP：KV 按层分给 TP 组里各颗 NPU，算到哪层就把整层广播回来](concepts/kvpp.md) — 有些模型的 KV Cache 在张量并行的几颗 NPU 上是每颗各存一整份一样的；KVPP 让每颗只常驻其中几层，算到哪一层就由存着它的那颗把整层发给其他颗。省下的是重复的那几份显存，代价是每层一次整层广播。 `11 13`
- [Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面](concepts/large-scale-ep.md) — 把一个 MoE 模型铺到几十上百颗 NPU 上时的部署方式：每个 DP rank 自己起一个完整的 server，请求分给谁由 vLLM 外面的 proxy 决定，prefill 和 decode 各用一套并行配置。 `14`
- [LMCache：把算过的 KV 存到显存外面，下次直接取回](concepts/lmcache.md) — 把算过的 KV 存到 NPU 显存之外，下一条请求开头相同就直接取回、不再重算。昇腾上的两个发布分支由 vllm-ascend 替它登记名字，main 改由 LMCache-Ascend 插件自己登记；名字登记上不等于存储已经配好。 `11`
- [LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵](concepts/lora.md) — 基座模型只装一份；每个微调版只是两个小矩阵，不同请求挂不同的那份，靠每行一个槽号拼进同一批一次算完。 `17`
- [Mooncake 连接器：真正把 KV 从 P 节点搬到 D 节点的零件](concepts/mooncake-connector.md) — PD 分离时，P 节点算好的 KV 要靠连接器搬到 D 节点；昇腾用 Mooncake 写了三套，差别不在快慢，而在谁发起搬运、什么时候发起。 `18`
- [NPUModelRunner：一步之内它做的五件事](concepts/npu-model-runner.md) — 每颗 NPU 上都有一个它。调度器定下这一步算谁之后，是它把这批请求摆成模型能吃的样子、把模型从头跑到尾、从末尾挑出下一个 token，再把结果交回去。代码是一个五千多行的大文件，按「这一步走过哪几段」去读，不要从头读。 `09`
- [NPUPlatform](concepts/npu-platform.md) — 昇腾插件里的平台类。vLLM 遇到任何和硬件有关的问题都来问它；它除了回答，还会在启动时改写、拦下你给的配置。 `10`
- [NPUWorker：从出生到能接请求的六步](concepts/npu-worker-lifecycle.md) — 一颗 NPU 上守着一个 Worker。它从被建出来到能接第一条请求要走六步：换补丁、选卡、装权重、量显存、分 KV 块、录图。顺序是固定的——走到第四步，KV Cache 能有多大才第一次有答案。 `10`
- [编译期图融合：捕获之前，先把小算子并成大算子](concepts/npugraph-ex.md) — 图模式录之前还有一道工序：先在图上做「查找替换」，把背靠背的几个小算子并成一个，录下来的图更短、下发更少。npugraph_ex 是接这活的外部图路径；关掉它，同一批融合规则换昇腾自己的匹配器来跑。static kernel 与 super kernel 是它上面的两级加码。 `16`
- [算子层与自定义算子](concepts/ops-and-kernels.md) — 上游给每类算子留了换实现的口子，昇腾把自己的版本挂上去；绝大多数换完调的还是现成算子，现成里没有的才自己编译，最底下由昇腾软件栈驱动 AI Core 真正计算。 `16`
- [PagedAttention：分块是布局，那个算子默认不跑](concepts/paged-attention.md) — 显存里的 KV 被切成一个个定长的块，这个模型一块装 2048 个 token 的笔记：要一块给一块，块和块不用挨着，靠块表找。这套分块布局一直生效；但名字叫 PagedAttention 的那个算子默认一次都不执行，默认按块读缓存的是另一个融合注意力算子。 `11`
- [PD 分离：P 算完就下班，D 的第一件事是重算](concepts/pd-disaggregation.md) — 把「算问题」和「一个字一个字写回答」拆到两批机器上跑：P 节点算完问题、留下 KV，D 节点把这份 KV 整块拉过去，再接着往外吐字。 `18`
- [流水线并行：按层切开，界线上一步只传一次](concepts/pipeline-parallel.md) — 把模型的层一刀切成前后几段，每段放一组 NPU，像接力一样一段算完交给下一段。段与段之间一步只传一次中间结果，通信又少又稀；代价是一步之内各段轮流干活，要同时有好几批请求在路上才能让每一段都不闲着。 `13`
- [插件注册机制](concepts/platform-plugin-registration.md) — 装上昇腾的包，vLLM 自己就会用昇腾：包里带着一张「我能接哪几个口」的清单，vLLM 每起一个进程都去读一遍——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型。 `10`
- [前缀缓存：命中的是整块，不是 token](concepts/prefix-caching.md) — 两条请求开头一样，开头那些块直接拿来用、不重算；但它只认写满的整块，而这个模型一块就是 2048 个 token，而且在已发布的版本上默认是关着的。 `11`
- [从请求到张量：每个 token 写进哪一格](concepts/prepare-inputs-flow.md) — 调度器只说「这一步给这条请求算几个 token」，模型要的却是摆好的几排数字：这几个 token 是谁、各自排在句子第几位、算完留下的 K 和 V 写进显存哪一格。这一页讲这几排数字怎么摆出来——第一步 37 个 token 摆成一排，之后每步只摆 1 个，格子号就是「块号 × 块大小 + 位置」。 `09`
- [量化：同一个模型，权重从 65 GiB 压到约一半](concepts/quantization.md) — 把权重从 2 字节一个数换成 1 字节一个数存，省下的是显存和每一步读权重的时间。昇腾适配层自己不做量化，只负责认出、加载和执行别人离线做好的量化权重；哪一层用哪种量化写在模型目录的一份描述文件里。 `17`
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md) — D 节点显存不够、要踢掉一条正在 decode 的请求时，先把它已经算好的 KV 块搬到主机内存，重新排上再搬回来，省掉一整轮 prefill。开发主线上它换了名字。 `11 12`
- [RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点](concepts/recompute-scheduler.md) — PD 分离的 D 节点显存不够、要踢掉一条请求时，不让它在本机从头重算，而是当场结束它，由前面的代理把问题连同已经生成的回答一起重投给 P 节点。 `12 18`
- [RFork：工作版机制与排错总览](concepts/rfork.md) — 新实例起来时不从磁盘读权重，而是直接去一台已经跑着的实例的 NPU 上把权重读过来，省下加载时间。这一章只讲用户指定的工作版，这页是总图、阅读顺序和排错入口。
- [RFork 配置：四类端口、各项超时与可复制的启动示例](concepts/rfork-config.md) — 想让第二个实例从已有实例借权重，要在启动命令里写哪些设置、写在哪。这页按用途讲工作版 RFork 的十一个客户端设置：模型身份、找 Planner、 来源地址和端口、心跳与还租约；讲清楚键名写错为什么不报错、固定端口只固定了哪一个、几种超时各管什么、动态专家均衡为什么会让它不生效，最后给可复制的启动示例和验收方法。
- [RFork 身份匹配：同模型、同布局，还要同一份分片](concepts/rfork-identity.md) — B 想借 A 的权重，两边必须各自算出一模一样的 seed key：先把模型版本、数值类型、并行大小和布局算成一个指纹，再加上「我要的是哪一份分片、是主模型还是草稿模型」。本页讲这把钥匙里有什么、没有什么，为什么同一个模型也可能找不到来源，以及为什么钥匙对上了也不代表权重内容一样。
- [RFork 张量布局：先对齐算子要的形状，再决定搬什么](concepts/rfork-layout.md) — 新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则按原形状读完再处理。 要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
- [RFork 生命周期：模型可用、租约归还、成为 seed 是三件事](concepts/rfork-lifecycle.md) — 新实例读完权重之后，还要把借来的名额还给 Planner，再决定要不要自己当来源。这页讲这几件事各自什么时候算完成：还名额失败会怎样、Planner 回 400 和 404 各说明什么、心跳和租约各看哪个钟、关停时为什么不一定马上清干净，以及现在还没有续租。
- [RFork 版本维护：保留原补丁，钉住真正运行的完整代码](concepts/rfork-maintenance.md) — 同事又发来一份 RFork 补丁时，怎么弄清现在跑的是哪版代码。这页讲：工作版为什么和社区版本分开维护，原来七份补丁为什么不能直接当一条链往上叠， 代码在项目里存在哪、怎么核对没被改动，新补丁来了要回看哪几页，以及哪些事只有到真机现场才能确认。
- [RFork 内存：地址、底层存储与 main/draft 共享](concepts/rfork-memory.md) — 把权重地址登记给传输引擎时，要分清“权重自己占的那一段”和“它所在的整块内存”，还要把权重背后的存储保住，直到确认注销才放手；draft 和主模型共用的那部分权重不重复登记。
- [RFork 启动：准备模型以后才借 seed，失败后先清理再重建](concepts/rfork-startup.md) — 新实例用 RFork 启动时，先把自己的模型搭好、布局转好，再去借一份来源读权重；借不到或读失败，就把这一轮彻底清理干净，改用普通方式从磁盘重新加载。这页按真实顺序走一遍，也讲清两种提前返回和两种「没有可用来源」。
- [RFork 传输：先验整张清单，再按地址读字节](concepts/rfork-transfer.md) — 新实例找到可借权重的来源后，先向它要一份“去哪读、读哪些”的说明，把两边每一块权重的名字、个数和类型逐项对上， 整份通过才按地址分批把字节读过来；也讲清“说明拿到了”“字节读完了”“模型算得对”各自证明了什么。
- [RFork 排错：从第一条异常还原版本、阶段与资源状态](concepts/rfork-troubleshooting.md) — RFork 出错时从哪查起：先确认是哪一版代码，再找日志里最早的那条具体异常，最后看模型、租约和显存各停在哪一步。按「借不到来源、两端清单对不上、显存登记或清理出错、读数据失败、还租约被拒、看起来卡住」六类现象，分别列出能确定的事、可能的原因、该补的证据和不该做的事。
- [序列并行（SP）：把那两次 all-reduce 拆成 reduce-scatter 加 all-gather](concepts/sequence-parallel.md) — 配合张量并行用：把一层里那两次 all-reduce 各拆成 reduce-scatter 加 all-gather，归一化这类逐 token 的活只在 1/TP 的 token 上算。BF16 下线上字节一个没省；W8A8 部署下量化挪到 all-gather 之前、搬的是 INT8，通信量才真减半。 `15`
- [短请求优先：短问题先算，别让长问题堵住别人](concepts/short-request-first.md) — 排队等着被算的请求原本只有一条队，先到先得。打开它之后，队伍按问题长短分成三条车道，短问题先被挑走，一条长问题不再让后面一串短问题一起干等。 `12`
- [投机解码：先猜几个 token，一步验完](concepts/speculative-decoding.md) — decode 一步只吐一个 token，却要把全部权重读一遍。投机解码先猜几个 token，让模型一步把它们一起验完，猜对几个就多出几个，第一个猜错的地方换成模型自己的答案，后面的作废。 `17`
- [结构化输出：采样前先算一张「这一步允许哪些 token」的位图](concepts/structured-output.md) — 想让模型只回一段合法的 JSON，就在每一步挑 token 之前，先按格式要求划掉所有不合规矩的候选，再照常挑。昇腾默认把这一步搬到 CPU 上做。 `17`
- [张量并行（TP）：一层切两刀，每层要对一次答案](concepts/tensor-parallel.md) — 把每层的大矩阵横竖切开分给几颗 NPU，各算一半；切成「每颗只有半份答案」的那一刀之后，几颗必须把结果加一遍才能往下走——所以每层要对一次答案，位置是固定的。 `13`
- [UCM：共享前缀存储与 PD 传输要分开看](concepts/ucm.md) — 把算过的前缀 KV 从卡上挪到本机内存和共享存储里存着，卡装不下、服务重启也还能复用。PD 分离时它有两种用法：集中式让 P 节点把 KV 写进共享存储、D 节点再取出来；P2P 则由 Mooncake 直接把 KV 传给 D 节点，UCM 只在 P 节点旁边管前缀复用。两条路不能混为一谈。 `11 13`

## 参数（param）
- [block_table_no_commit_optimize](params/block-table-no-commit-optimize-8328d0d2d00d.md) — MRv1 块表优化的回退开关：默认 0 用「只提交脏行区间」的 OptimizedBlockTable，写 1 换回整表 H2D 拷贝的老实现。名字容易读反——它是关优化的，不是开优化的。只在 main 上有。
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md) — 让 LightningIndexer 的 C8 缓存写入改走 StoreKVBlock 算子，不再逐 token scatter。两个发布分支上是默认 false 的用户键、要配合 enable_sparse_li_c8；main 上默认 true，但还要 enable_sparse_li_c8 成立、且跑在 PD 分离的 P 节点上才算真开。 `17`
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）通信时用哪种量化：非 0 就强行覆盖模型自己推出来的模式，只认 0/2/3/4，默认 0 不干预。在册版本里只有 main 有，v0.23 与 v0.26 两个发布分支上配了会被静默忽略。 `14 17`
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，v0.25.1rc 起已整体删除，残留的这个键在 v0.26 上被静默忽略、在 main 上会让启动直接失败。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — 把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_rank 算出来的轮转表，让每个专家、每张卡收到的 token 数完全相等——压测和算子调优用，开了输出就不对。默认 false，在册版本里只有 main 有。 `14`
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 与 v0.24.0rc 有，v0.25.1rc 起整体移除，v0.26 上配了被静默忽略、main 上直接报错。 `13`
- [enable_pcp_embedding_lmhead_weight_sharding](params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md) — PCP>1 时把 embedding 与 LM Head 的权重按 TP×PCP 网格再切一份，每卡只留 1/(TP×PCP)。bool 默认 true——开着 PCP 升级到含它的 main，行为自动就是切开的；要旧行为得显式写 false。与细粒度 TP 的 embedding/lmhead 两键互斥。只在 main 上有。
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — 开了 SFA-PCP 之后，让 o_proj 权重在加载期就按 PCP 组再切一刀、常驻只留 1/pcp_size，prefill 现 all-gather 出一份全量、decode 直接用本地片。默认 false，在册版本里只有 main 有，对 DSA-CP 无效。 `15`
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外销毁 HCCL 通信域、清空 ACL 图工作区，把分配器池子之外的那两块显存也还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23 与 v0.26 都是顶层键，main 上才搬进 rl_config。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — ascend_compilation_config 里的第三级加码开关：把整网框进一个 super kernel scope 再融一次。v0.23 上没有这个键，v0.26 起有，不写就跟随 enable_static_kernel，开了必须静态内核也开。 `16`
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，v0.25.1rc 起已整体删除，v0.26 上配了被静默吞掉、main 上直接报错。 `13`
- [kvpp_config](params/kvpp-config-0445bd352140.md) — AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进 additional_config 会被静默剔掉。在册版本里只有 main 有。 `11`
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，v0.24.0rc 起已整体删除，v0.26 上照旧配置会被静默忽略、main 上直接报错。 `13`
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；v0.24.0rc 起整套实现已删除，键留在启动命令里 v0.26 上被静默忽略、main 上会让进程起不来。 `14`
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 上被静默忽略、main 上直接报错，没有替代键。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — 上游叫 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，把 PP 流水线的气泡抹平。默认关闭，要求 PP>1 且与负载均衡调度互斥；官方定位是 PD 分离里 P 节点的长序列优化。 `12 13`
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — DCP 解码路径上 query all-gather 之后，把布局还原从零拷贝的 strided view 改回真的物化一份 t-major 连续存储——上游为对照实验留的回退开关，默认 false 走优化后的零拷贝路径。在册版本里只有 main 有。 `15`
- [size](params/size-40a1c2ca47b8.md) — KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP × PCP，用户不能直接写。只在 main 开发主线上有。 `11`
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — Sparse KV Offload 在 decode 上的第二条路径开关，挂在 sparse_kv_offload_config 这个嵌套块里（不是顶层），bool、默认 false；开了就用 npu_fused_sparse_attention_overlap 直接读主机池，不再「搬 miss 再算」。在册版本里只有 main 有。 `11`
- [use_layerwise](params/use-layerwise-b475778cd352.md) — KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是 --kv-transfer-config 的 kv_connector_extra_config；三个版本都有，默认 false。 `11`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上直接报错。 `19`

## 来源（source）
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md) — 一次问答的归档。结论是分配与回收都不在块表里发生，而在上游 EngineCore 进程的 KVCacheManager / BlockPool 里；块表只事后记账。 `11`
- [RFork 官网核读：原图、全部章节与工作版差异](sources/rfork-official-guide.md) — 按用户指定的英文 latest RFork Guide 核读全文与架构图，对照独立工作版，区分官方使用说明、工作版实际调用路径和仍需现场验收的内容。

## PR（pr）
- [[Refactor] remove layer sharding](sources/pr-11953.md) — 上游 PR `21`

## 按章节

### 10 引擎架构与插件机制
- [昇腾的开关从哪进来](concepts/ascend-config-system.md)
- [Patch 机制](concepts/ascend-patch-system.md)
- [引擎有哪几个进程](concepts/engine-processes.md)
- [NPUPlatform](concepts/npu-platform.md)
- [NPUWorker：从出生到能接请求的六步](concepts/npu-worker-lifecycle.md)
- [插件注册机制](concepts/platform-plugin-registration.md)
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md)
- [引擎的那个循环：转一圈就是一步](concepts/vllm-engine-core.md)
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md)
- [vLLM 的形状：三类角色，两道边界](concepts/vllm-v1-shape.md)
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md)

### 11 KV Cache 内存系统
- [问答记录：Block Table 里的块什么时候分配、什么时候回收](sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md)
- [块表：请求的第几块，在显存的哪一块](concepts/block-table.md)
- [KV Cache](concepts/kv-cache.md)
- [KV Cache CPU Offload：把要被淘汰的块存进主机内存](concepts/kv-cache-cpu-offload.md)
- [Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer](concepts/kv-cache-layerwise-offload.md)
- [KV Cache 显存怎么量出来：整卡的九成，减掉量出来的三块](concepts/kv-cache-memory-profiling.md)
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md)
- [Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行](concepts/kv-cache-sparse-offload.md)
- [KV Cache Spec：每层自己报价，引擎才算得出能分几块](concepts/kv-cache-spec.md)
- [KV Pool：命中的前缀不再只能来自本卡显存](concepts/kv-pool.md)
- [KVPP：KV 按层分给 TP 组里各颗 NPU，算到哪层就把整层广播回来](concepts/kvpp.md)
- [kvpp_config](params/kvpp-config-0445bd352140.md)
- [LMCache：把算过的 KV 存到显存外面，下次直接取回](concepts/lmcache.md)
- [PagedAttention：分块是布局，那个算子默认不跑](concepts/paged-attention.md)
- [前缀缓存：命中的是整块，不是 token](concepts/prefix-caching.md)
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md)
- [size](params/size-40a1c2ca47b8.md)
- [UCM：共享前缀存储与 PD 传输要分开看](concepts/ucm.md)
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md)
- [use_layerwise](params/use-layerwise-b475778cd352.md)
- [KV 块是怎么分出来的](concepts/vllm-kv-block-allocation.md)

### 12 调度
- [异步调度：下一步的调度压在上一步的执行底下](concepts/async-scheduling.md)
- [Balance Scheduling：一个 rank 顶满，所有 rank 一起停收](concepts/balance-scheduling.md)
- [Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列](concepts/batch-job-aware-scheduler.md)
- [Chunked Prefill：问题太长，就切成几段分几步算](concepts/chunked-prefill.md)
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md)
- [DyntraLB：跨 rank 传的只有块数，没有请求 id](concepts/dyntra-lb.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md)
- [RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点](concepts/recompute-scheduler.md)
- [短请求优先：短问题先算，别让长问题堵住别人](concepts/short-request-first.md)
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [数据并行（DP）：把整个引擎复制几份](concepts/data-parallel.md)
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [HCCL 通信缓冲区怎么定：默认 200、DP 组自己算、MC2 组不给 pg_options](concepts/gap-a5164fe10fa9184412f8.md)
- [KVPP：KV 按层分给 TP 组里各颗 NPU，算到哪层就把整层广播回来](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [流水线并行：按层切开，界线上一步只传一次](concepts/pipeline-parallel.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [张量并行（TP）：一层切两刀，每层要对一次答案](concepts/tensor-parallel.md)
- [UCM：共享前缀存储与 PD 传输要分开看](concepts/ucm.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md)
- [EPLB：把热门专家搬到闲着的 NPU 上，但不改路由](concepts/eplb.md)
- [专家并行（EP）：专家不切开，按编号分给不同的 NPU](concepts/expert-parallel.md)
- [HCCL 通信缓冲区怎么定：默认 200、DP 组自己算、MC2 组不给 pg_options](concepts/gap-a5164fe10fa9184412f8.md)
- [Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面](concepts/large-scale-ep.md)
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 15 并行 III：SP / CP / PCP / DCP
- [上下文并行（CP）：一条长请求分给几颗 NPU，PCP 分着算、DCP 分着存](concepts/context-parallel.md)
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)
- [序列并行（SP）：把那两次 all-reduce 拆成 reduce-scatter 加 all-gather](concepts/sequence-parallel.md)
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md)

### 16 图模式与算子
- [ACL Graph：批的 token 数先垫到捕获过的档位，垫不上就整步退回单算子模式](concepts/acl-graph.md)
- [Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位](concepts/batch-invariance.md)
- [CPU 绑核：给每个 Worker 划一段专用的 CPU 核](concepts/cpu-binding.md)
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md)
- [Flash Attention 3：不为了快，为了和训练侧算得一样](concepts/flash-attention-3.md)
- [图模式层](concepts/graph-mode-layer.md)
- [编译期图融合：捕获之前，先把小算子并成大算子](concepts/npugraph-ex.md)
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md)
- [算子层与自定义算子](concepts/ops-and-kernels.md)

### 17 量化与投机解码
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md)
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md)
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md)
- [LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵](concepts/lora.md)
- [量化：同一个模型，权重从 65 GiB 压到约一半](concepts/quantization.md)
- [投机解码：先猜几个 token，一步验完](concepts/speculative-decoding.md)
- [结构化输出：采样前先算一张「这一步允许哪些 token」的位图](concepts/structured-output.md)

### 18 PD / EPD 分离与 KV 传输
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md)
- [EPD 分离：把视觉编码器也拆到单独的节点上](concepts/epd-disaggregation.md)
- [Mooncake 连接器：真正把 KV 从 P 节点搬到 D 节点的零件](concepts/mooncake-connector.md)
- [PD 分离：P 算完就下班，D 的第一件事是重算](concepts/pd-disaggregation.md)
- [RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点](concepts/recompute-scheduler.md)

### 19 性能工程
- [enable_async_exponential](params/enable-async-exponential.md)
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)

### 20 读源码
- [怎么读这个仓库](concepts/reading-vllm-ascend.md)
- [vllm_ascend 目录地图](concepts/vllm-ascend-repo-map.md)

### 21 PR 影响分析
- [[Refactor] remove layer sharding](sources/pr-11953.md)

### 00 从一次对话开始：推理到底在算什么
- [贯穿全库的例子：37 个 token 的问题，200 个 token 的回答](concepts/one-request.md)

### 01 Token、Embedding 与向量
- [embedding：把编号换成一串数字](concepts/embedding.md)
- [token：模型眼里的字块](concepts/token.md)

### 02 矩阵乘法与张量形状
- [矩阵乘与权重：模型算的到底是什么](concepts/matmul-and-weights.md)

### 03 Transformer 层的双层数据流
- [层与隐藏向量：40 层接力加工](concepts/layers-and-hidden.md)
- [MLP、残差与归一化：层里除了注意力的那些事](concepts/mlp-residual-norm.md)

### 04 Attention 深入
- [注意力后端家族](concepts/attention-backend-family.md)
- [四种注意力的代价](concepts/attention-cost.md)
- [注意力与 Q、K、V：每个 token 回头看前面](concepts/attention-qkv.md)
- [Flash Attention 3：不为了快，为了和训练侧算得一样](concepts/flash-attention-3.md)
- [GQA：16 个 Q 头只存 2 份 K/V，省的是显存不是计算](concepts/gqa.md)
- [线性注意力：不回头翻，只记一份小抄](concepts/linear-attention.md)
- [MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE](concepts/mla.md)
- [RoPE (Rotary Position Embedding)](concepts/rope.md)

### 05 Prefill 与 Decode
- [KV Cache](concepts/kv-cache.md)
- [Prefill](concepts/prefill.md)

### 06 MoE
- [MoE：256 个专家，每次只叫 8 个](concepts/moe.md)

### 07 昇腾 NPU 剖面
- [AI Core、Cube 与 Vector：设备里面谁在算](concepts/ai-core.md)
- [CANN 与 HCCL：计算和通信由谁接到硬件](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPU、卡与机器：先把数量数对](concepts/hardware-devices.md)

### 08 服务器与机柜
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md)
- [NPU、卡与机器：先把数量数对](concepts/hardware-devices.md)
- [超节点：连接成整体，数据仍有位置](concepts/superpod.md)

### 09 一次请求的硬件旅程
- [CANN 与 HCCL：计算和通信由谁接到硬件](concepts/cann-hccl.md)
- [主机内存与显存：数据现在放在哪](concepts/device-memory.md)
- [NPUModelRunner：一步之内它做的五件事](concepts/npu-model-runner.md)
- [从请求到张量：每个 token 写进哪一格](concepts/prepare-inputs-flow.md)
- [一次请求的调用链](concepts/request-call-chain.md)
