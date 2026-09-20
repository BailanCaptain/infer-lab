# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 95 页。

## 概念（concept）
- [四种注意力的代价](concepts/attention-cost.md) — 同样存一个 token 一层，普通 GQA 要 4096 字节，MLA 只要 1152。差别不是压缩得好，是存的东西根本不一样。 `04`
- [Block Table：逻辑块号到物理块号的唯一翻译层](concepts/block-table.md) — 一张 (请求数 × 每请求最大块数) 的 int32 表。行是请求在这一批里的座位号，列是它自己数出来的第几个块，格子里填的是显存里的物理块号。 `11`
- [三个进程与 patch 注入点](concepts/engine-processes.md) — V1 引擎跑起来是 Main、EngineCore、Worker 三类进程；昇腾的 patch 要分别进这三处，用的是三条不同的路。 `10`
- [GQA：16 个 Q 头共用 8 组 K/V，省的是显存不是乘加](concepts/gqa.md) — Q 保持 16 个头，K 和 V 只留 8 个头，相邻两个 Q 头共用一组；KV Cache 因此正好减半，而注意力本身一次乘加都没少。 `04`
- [KV Cache](concepts/kv-cache.md) — 把每一层、每个已经算过的 token 的 K 和 V 留在显存里。下一步生成新 token 时只算新的那一个，旧的直接读。 `05 11`
- [MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE](concepts/mla.md) — 每层每个 token 只存一条 512 维潜向量加 64 维 RoPE 段；prefill 把它展开回每个头的 K 和 V，decode 干脆不展开，改把展开矩阵乘到 Q 上。 `04`
- [贯穿全书的那条请求](concepts/one-request.md) — 全库只跟一条请求：Qwen3-0.6B、单卡、37 个 token 的问题、200 个 token 的回答。每一页都在讲它走到某一步时发生了什么。 `00`
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md) — 拿 RMSNorm 走一遍四层。最关键的一段是 ops/layernorm.py 里的一个 if——它两边一边是自己编的融合算子，一边是 CANN 现成的算子加一次额外的逐元素加法。 `16`
- [Prefill](concepts/prefill.md) — 生成第一个字之前，把整段问题一次过完模型、把每个 token 的 K 和 V 写进缓存的那一步。它算得多、只做一次，决定了「多久出第一个字」。 `05`
- [怎么读这个仓库](concepts/reading-vllm-ascend.md) — 三条定位路线：手上有 traceback、有特性名、有上游类名各走一条；两个 ref 的对照法与三个会得出错结论的查法。 `20`
- [一次请求的调用链](concepts/request-call-chain.md) — 从 HTTP 到 token 一共七跳。前两跳是上游 vLLM 的调度逻辑，进程边界在第二跳与第三跳之间，之后全在昇腾侧。 `09`
- [RoPE (Rotary Position Embedding)](concepts/rope.md) — 把 Q 和 K 的每两个分量当成平面上的一个点，按「位置 × 频率」转一个角度。转完之后，两个 token 的注意力分数只取决于它们相隔多远。 `04`
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md) — 一个装在 vLLM 旁边的硬件插件：自己是独立的 Python 包，靠 entry point 把昇腾实现挂进 vLLM 的各层，不改上游一行代码。 `10`
- [vllm_ascend 目录地图](concepts/vllm-ascend-repo-map.md) — 23 个子目录、442 个 .py、130661 行。按职责分成六组，主干只有 worker、attention、ops 三个。 `20`
- [EngineCore：那个 while 循环](concepts/vllm-engine-core.md) — 整个推理引擎的心脏是一个不到十行的 while 循环。那条请求的 200 步，就是它转了 200 圈。 `10`
- [block 是怎么分出来的](concepts/vllm-kv-block-allocation.md) — 那条请求一共要了两次块：第 1 步要了一块，第 92 步 decode 又要了一块。要块、给块、还块，全在上游的 EngineCore 进程里。 `11`
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md) — 上游把「凡是跟硬件有关的事」收成一个 Platform 类，78 个口子，`vllm/` 包里 873 处在问它。昇腾插件要做的就是把这张问卷答上。 `10`
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md) — 调度器只做一道减法——每条请求还差多少 token 没算——再拿 token 预算去填。prefill 和 decode 是这道减法的两个结果，不是两条代码路径。 `12`
- [vLLM 的形状：三个进程，两道边界](concepts/vllm-v1-shape.md) — 那条请求要下去两层再上来两层。每跨一道边界，它携带的东西就换一种：字 → 整数 → 张量。 `10`
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md) — vLLM 决定这一步算哪些 token，昇腾决定这些 token 怎么算出来。分界线落在调度交出 SchedulerOutput 的那一刻，也正好是进程边界。 `10`

## 特性（feature）
- [ACLGraph：批的 token 数先垫到捕获过的尺寸，垫不上就按 eager 跑](concepts/acl-graph.md) — 启动期把整网的算子下发序列按一批固定尺寸录成图，运行期按「token 数 + 这批是不是整齐的 decode」查缓存回放，省掉每个算子一次的 host 下发开销。 `16`
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md) — 给一台 NPU 发出的三类流量（算子下发、卡间集合通信、KV 搬运）打优先级标签，在 UB 交换机上映射成不同虚拟通道并按严格优先级调度；全部实现都在 tools/ 下，vLLM 引擎里一行代码都没有。 `08 18`
- [AscendConfig 配置系统](concepts/ascend-config-system.md) — --additional-config 的那段 JSON 由 AscendConfig 按键拆成八个子配置对象，存成进程内单例；环境变量走另一条路。 `10`
- [Patch 机制](concepts/ascend-patch-system.md) — 上游没留口子的地方，昇腾在运行时把上游的类和函数换掉。两个目录对应两个时机，靠 import 副作用生效。 `10`
- [异步调度：下一步的调度压在上一步的执行底下](concepts/async-scheduling.md) — EngineCore 把这一步送下去之后不等结果，直接调度下一步；调度器靠给「还没产出」的 token 记一个占位，让那道减法照样算得出来。 `12`
- [注意力后端家族](concepts/attention-backend-family.md) — attention/ 下五个后端类，其中四个按 (use_mla, use_sparse, use_compress) 三元组查表选出，FA3 那个靠显式指定；普通后端的 KV 形状是五维，MLA 系是四维。 `04`
- [Balance Scheduling：一个 rank 顶满，所有 rank 一起停收](concepts/balance-scheduling.md) — 每步 all_gather 各 DP rank 在跑的请求条数，只要有一个 rank 顶到 max_num_seqs，所有 rank 这一步都不再从 waiting 队列放新请求进来。 `12`
- [Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位](concepts/batch-invariance.md) — 开了它，一条请求不管单独跑还是混在上百条里跑，输出逐位相同——靠的是把矩阵乘、归约、softmax、注意力换成加法顺序与批形状无关的实现。 `16`
- [Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列](concepts/batch-job-aware-scheduler.md) — 把上游调度器的 waiting 队列换成按「作业」分桶的队列，先给在跑的请求预留下一轮要的块，再从桶里挑一条塞得下的；为离线批处理而生，不做饥饿防护。 `12`
- [Chunked Prefill：切开的是一条请求，填满的是一步的预算](concepts/chunked-prefill.md) — 长 prompt 不一次算完，按这一步的 token 预算切成几块依次做；它在调度器里不是一个模式，是「还差多少」减不完时留下的余数。 `12`
- [Context Parallel：把序列维切到多张卡上，PCP 切算、DCP 切存](concepts/context-parallel.md) — 长序列放不进一张卡时沿序列维下刀；PCP 切 prefill 要算的 token 并为此加卡，DCP 把 KV Cache 交错分到 TP 组各卡、卡数不变。 `15`
- [CPU 绑核：每个 Worker 钉死一段核，而且是 warmup 之后才钉](concepts/cpu-binding.md) — 把每张卡对应的 Worker 进程和它的 acl / release 线程钉到一段固定的 CPU 核上，ARM 昇腾服务器上默认就开着；核段按 NPU 拓扑亲和或全局逻辑 NPU id 切，切完进程之间互不重叠。 `16`
- [Data Parallel：复制整个引擎，一根权重都不切](concepts/data-parallel.md) — 同一份模型起多个副本，每个副本一套 EngineCore、调度器和 KV 块池；请求由前端挑一个 rank 送进去。它加吞吐，不减单请求延迟，也不省单卡显存。 `13`
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md) — PP 下固定大小的 chunk 越往后越慢，流水线就留气泡；它启动时真跑几十次 forward 量出延迟曲线，运行时反解出每一步该切多少 token，把各块耗时拉平。 `13 12`
- [DyntraLB：跨 rank 传的只有块数，没有请求 id](concepts/dyntra-lb.md) — PD 分离的 D 节点上，各 DP rank 每步 all_gather 一遍「每条请求占几个 KV 块」，同一个 planner 算出这一步谁暂停、谁放进来；一条请求都不搬家。 `12`
- [EPD 分离：把视觉编码器也拆成一类实例](concepts/epd-disaggregation.md) — 多模态模型的视觉编码器单独起一个实例（E），算出的图像 embedding 经 EC 连接器交给 prefill/decode 那边，PD 上不再跑视觉塔。 `18`
- [EPLB：把热门专家搬到闲着的卡上，但不改路由](concepts/eplb.md) — 开了 EP 之后哪张卡忙由数据决定，EPLB 数每个专家吃了多少 token，交给一个独立子进程算新摆法，再一层一层把专家权重 P2P 搬过去。 `14`
- [Expert Parallel：每张卡整份拿走一批专家，token 追着专家跑](concepts/expert-parallel.md) — MoE 层按专家切开，每张卡完整持有一批专家的权重；代价是每层多一次把 token 发出去、一次把结果收回来。 `14`
- [Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切](concepts/fine-grained-tp.md) — 全局 TP 之外，单独给 embedding、lm_head、o_proj、dense MLP 各设一个切分数；切的是 DP 轴——从同一份 DP 里借几个 rank 把这张表分掉，省的是重复的权重副本。 `13`
- [Flash Attention 3：为了和训练侧算得一样，把默认的 FIA 换掉](concepts/flash-attention-3.md) — 昇腾上第五个注意力后端，把注意力算子从 torch_npu 的 FIA 换成外部包 flash_attn_npu_v3 里的 flash_attn_with_kvcache——不是为了更快，是为了让 RL 里推理侧和训练侧用同一个算子。 `16 04`
- [图模式层](concepts/graph-mode-layer.md) — 昇腾不走上游的 torch.compile 默认路径，而是用自己的编译后端加 ACLGraphWrapper；捕获在启动最后一步发生。 `16`
- [KV Cache CPU Offload：把要被淘汰的块存进主机内存](concepts/kv-cache-cpu-offload.md) — NPU 上的 KV 块被淘汰之前先异步拷一份进主机内存；下一条请求共享同一段前缀、而 NPU 上那几块已经没了，就再拷回来，省掉重新 prefill。昇腾只换掉 worker 侧的搬运。 `11`
- [Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer](concepts/kv-cache-layerwise-offload.md) — 把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」，搬运与下一层计算重叠；main 上还能让多层轮流用同一份 HBM buffer，把 Prefill 侧的 KV 显存压成常数份。 `11`
- [KV Cache Memory Profiling：整卡的九成，减掉量出来的三块](concepts/kv-cache-memory-profiling.md) — 启动时跑一遍最大规模的假数据前向，量出权重、激活峰值、非 torch 三块；整卡容量 × gpu_memory_utilization 减掉这三块，就是 KV Cache 的字节预算。图捕获不在这个减法里。 `11`
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md) — 每层的 K、V 用离线标定的静态 per-channel scale 存成 int8，decode 时连 scale 一起交给算子就地反量化。v0.23 只认 checkpoint 里的 kv_cache_type = C8，main 还要 --kv-cache-dtype 一起点头。 `11 17`
- [Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行](concepts/kv-cache-sparse-offload.md) — PD 分离的 D 节点不再分配 NPU 主 KV 缓存。全量主 KV 住在主机 pinned 内存，每个 decode 步由 indexer 选出 top-k，再由每层一张 LRU 表决定哪几行要搬回 NPU 热缓冲区。 `11`
- [KV Cache Spec：每层自己报价，引擎才算得出能分几块](concepts/kv-cache-spec.md) — 每个注意力层向引擎报一份规格——块大小、KV 头数、头维、dtype。引擎只从里面取「一块多少字节」这一个数去做除法，块数算完再发回 Worker 分配。 `11`
- [KV Pool：命中的前缀不再只能来自本卡 HBM](concepts/kv-pool.md) — 挂在 vLLM KV Connector 接口上的外部 KV 存储。昇腾侧的实现叫 AscendStoreConnector，背后可换三种存储引擎；调度器只拿得到一个整数，搬数据的那一侧直接读写 HBM 原始地址。 `11`
- [KVPP：KV 按层分给 TP 组里各张卡，算到哪层就把整层广播回来](concepts/kvpp.md) — MLA/SFA 的 KV 在 TP 组内本来是每卡一份复制品；KVPP 把层连续均分给组里各 rank，算到某层时由 owner 把整层广播给其他卡。省的是复制的份数，花的是每层一次全量广播。 `11 13`
- [Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面](concepts/large-scale-ep.md) — 几十上百张卡跑一个 MoE 模型时的部署形态——每个 DP rank 自己起一个完整的 API server 进程，rank 之间怎么分请求由 vLLM 外面的 proxy 决定，P 和 D 各用一套并行配置。 `14`
- [LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵](concepts/lora.md) — 基座权重只装一份，一个适配器只是两个秩 r 的小矩阵；不同请求挂不同适配器，靠每 token 一个槽号拼在同一个 batch 里一次算完。 `17`
- [Mooncake 连接器：真正把 KV 从 P 搬到 D 的那半个零件](concepts/mooncake-connector.md) — 上游把 KV 连接器切成调度侧与 worker 侧两半，昇腾在这个接口下写了三套 Mooncake 实现，差别在谁发起搬运、什么时候发起。 `18`
- [NPUModelRunner 怎么读](concepts/npu-model-runner.md) — 5251 行的单文件，继承上游 GPUModelRunner。按十个区读，不要从头读；其中七个区各对应一个可以单独进入的方法。 `09`
- [NPUPlatform](concepts/npu-platform.md) — 继承上游 Platform 的那个类。vLLM 一切硬件相关的问题都问它，它还会在启动时真的改写用户给的配置。 `10`
- [NPUWorker 启动时序](concepts/npu-worker-lifecycle.md) — 从建对象到能接请求，六步固定顺序：打 patch、选卡建 runner、装权重、profile 出显存预算、分配 KV 张量、编译与捕获图。 `10`
- [编译期图融合：ACL Graph 捕获之前，FX 图上先少掉一批算子](concepts/npugraph-ex.md) — 图模式之上还有一层——把 Dynamo 交来的 FX 图先做 pattern 替换，把 RMSNorm、RoPE、量化这些背靠背的小算子并成一个；npugraph_ex 是接这活的外部后端，static kernel 与 super kernel 是它上面的两级加码。 `16`
- [算子层与自定义算子](concepts/ops-and-kernels.md) — ops/ 用 CustomOp 注册把上游算子换成昇腾实现；再往下是 torch_npu，最底下是 csrc/ 编出来的自定义 aclnn 算子，绑在 torch.ops._C_ascend 上。 `16`
- [PagedAttention：分块是布局，那个算子默认不跑](concepts/paged-attention.md) — 昇腾把每层 KV 切成 128 token 的定长块，算子拿块表跳着读。但叫 _npu_paged_attention 的那个算子默认永远不执行——默认按块读 KV 的是 FIA。 `11`
- [PD 分离：P 算完就下班，D 的第一件事是重算](concepts/pd-disaggregation.md) — 把 prefill 和 decode 拆到两批实例上跑，P 节点算完整段 prompt 的 KV 就结束请求，D 节点把这些块整块拉过去再逐 token 生成。 `18`
- [Pipeline Parallel：按层切开，界线上一步只过一份 hidden](concepts/pipeline-parallel.md) — 按层把模型切成几段、一段一组卡；段与段之间只传 hidden_states 和 residual 两条张量，一步一次。代价是一步之内各段串行，要靠同时在途的多步才填得满。 `13`
- [插件注册机制](concepts/platform-plugin-registration.md) — 装包时声明两组 entry point，vLLM 启动时扫出来：一个给平台类，四个给连接器、加载器、profiling 与模型注册。 `10`
- [Prefix Caching：命中的是块，不是 token](concepts/prefix-caching.md) — 两条请求开头一样，那段 KV 就不用重算——把算过的块按内容哈希留着，下一条直接把块号填进块表，只对不同的尾巴做前向。 `11`
- [prepare_inputs 数据流](concepts/prepare-inputs-flow.md) — 调度器给的请求集合，经 NPUInputBatch 与 BlockTable 变成算子要的四个张量；槽位由一个 Triton kernel 算出来。 `09`
- [Quantization：省的是权重显存，开关在模型目录里那份 json](concepts/quantization.md) — vllm-ascend 自己不量化，只负责加载和执行 ModelSlim / LLM-Compressor 产出的低精度权重；哪一层用哪种量化写在 quant_model_description.json 里，引擎按 (量化类型, 层类型) 这一对去注册表找实现。 `17`
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md) — PD 分离的 Decode 节点抢占一条请求时，先把它已算好的 KV 块同步拷进锁页主机内存，重新排上再拷回来，省掉一整轮 prefill。main 开发主线已把它改名成 PreemptOffloadConnector。 `11 12`
- [RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点](concepts/recompute-scheduler.md) — PD 分离的 Decode 节点上 KV 块不够要抢占时，这个调度器不让请求退回 waiting 重算，而是当场终止它，用 stop_reason="recomputed" 让 PD proxy 把它重投给 Prefill 节点。 `12 18`
- [Sequence Parallel：把那两次 all-reduce 拆成 reduce-scatter 和 all-gather](concepts/sequence-parallel.md) — 不动 TP 的切法，只把一层里那两次 all-reduce 换成 reduce-scatter + all-gather，让 RMSNorm 这类逐 token 的算子只在 1/TP 的 token 上算；线上的字节数一个没省。 `15`
- [ShortRequestFirst：把等待队列切成三条车道](concepts/short-request-first.md) — 把上游那条单一的 waiting 队列换成 immediate / short / long 三条，短 prompt 先被挑走，长 prompt 不再堵住别人的首 token。 `12`
- [Speculative Decoding：一步算 K+1 个位置，第一个对不上的地方截断](concepts/speculative-decoding.md) — 先让一个便宜的草稿器猜 K 个 token，目标模型在同一次 forward 里给这 K+1 个位置各出一个分布，逐位比对，接受多少算多少。 `17`
- [结构化输出：采样前先算一张「这一步允许哪些 token」的位图](concepts/structured-output.md) — 把 JSON schema / 正则 / 文法编译成状态机，每步算出一张允许位图，把不允许的 token 的 logit 写成 -inf 再采样；昇腾默认把 logits 搬回 CPU 才贴这张位图。 `17`
- [Tensor Parallel：一层切两刀，通信就落在两刀之后](concepts/tensor-parallel.md) — 把一层里的四个大矩阵按列或按行切给多张卡；列切完各算各的，行切完每张卡只有一份部分和，必须 all-reduce 一次——一层两次，位置写死。 `13`

## 参数（param）
- [c8_enable_reshape_optim](params/c8-enable-reshape-optim-8bd7e5f82c6c.md) — c8_enable_reshape_optim 的静态定义，正文待补。
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — combine_quant_mode 的静态定义，正文待补。
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，main 上已整体删除，残留的这个键还会让启动直接失败。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — enable_force_eplb 的静态定义，正文待补。
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 有，main 已整体移除。 `13`
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — enable_pcp_o_proj_weight_sharding 的静态定义，正文待补。
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外销毁 HCCL 通信域、清空 ACL 图工作区，把分配器池子之外的那两块显存也还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23 是顶层键，main 上已搬进 rl_config。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — enable_super_kernel 的静态定义，正文待补。
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，main 上已整体删除。 `13`
- [group](params/group-2b49ce9bdb0a.md) — group 的静态定义，正文待补。
- [kvpp_config](params/kvpp-config-0445bd352140.md) — kvpp_config 的静态定义，正文待补。
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，main 上已整体删除。 `13`
- [mask](params/mask-e1795029cbdd.md) — mask 的静态定义，正文待补。
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；main 上整套实现已删除，键留在启动命令里会让进程起不来。 `14`
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，main 开发主线已随整个 weight prefetch 特性一起删除，没有替代键。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — 上游叫 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 token，把 PP 流水线的气泡抹平。默认关闭，要求 PP>1 且与负载均衡调度互斥；官方定位是 PD 分离里 P 节点的长序列优化。 `12 13`
- [rank](params/rank-d6a905e66735.md) — rank 的静态定义，正文待补。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — sfa_dcp_force_tmajor_restore 的静态定义，正文待补。
- [shard_axis](params/shard-axis-036e26ba7f4b.md) — shard_axis 的静态定义，正文待补。
- [size](params/size-40a1c2ca47b8.md) — size 的静态定义，正文待补。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — use_fused_overlap 的静态定义，正文待补。
- [use_layerwise](params/use-layerwise-b475778cd352.md) — use_layerwise 的静态定义，正文待补。
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；main 上整套机制已删除，传这个键会直接报错。 `19`
- [world_size](params/world-size-bbb55aac584a.md) — world_size 的静态定义，正文待补。

## 按章节

### 10 引擎架构与插件机制
- [AscendConfig 配置系统](concepts/ascend-config-system.md)
- [Patch 机制](concepts/ascend-patch-system.md)
- [三个进程与 patch 注入点](concepts/engine-processes.md)
- [NPUPlatform](concepts/npu-platform.md)
- [NPUWorker 启动时序](concepts/npu-worker-lifecycle.md)
- [插件注册机制](concepts/platform-plugin-registration.md)
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md)
- [EngineCore：那个 while 循环](concepts/vllm-engine-core.md)
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md)
- [vLLM 的形状：三个进程，两道边界](concepts/vllm-v1-shape.md)
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md)

### 11 KV Cache 内存系统
- [Block Table：逻辑块号到物理块号的唯一翻译层](concepts/block-table.md)
- [KV Cache](concepts/kv-cache.md)
- [KV Cache CPU Offload：把要被淘汰的块存进主机内存](concepts/kv-cache-cpu-offload.md)
- [Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer](concepts/kv-cache-layerwise-offload.md)
- [KV Cache Memory Profiling：整卡的九成，减掉量出来的三块](concepts/kv-cache-memory-profiling.md)
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md)
- [Sparse KV Offload：主 KV 全在主机，每步只搬没命中的那几行](concepts/kv-cache-sparse-offload.md)
- [KV Cache Spec：每层自己报价，引擎才算得出能分几块](concepts/kv-cache-spec.md)
- [KV Pool：命中的前缀不再只能来自本卡 HBM](concepts/kv-pool.md)
- [KVPP：KV 按层分给 TP 组里各张卡，算到哪层就把整层广播回来](concepts/kvpp.md)
- [PagedAttention：分块是布局，那个算子默认不跑](concepts/paged-attention.md)
- [Prefix Caching：命中的是块，不是 token](concepts/prefix-caching.md)
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md)
- [block 是怎么分出来的](concepts/vllm-kv-block-allocation.md)

### 12 调度
- [异步调度：下一步的调度压在上一步的执行底下](concepts/async-scheduling.md)
- [Balance Scheduling：一个 rank 顶满，所有 rank 一起停收](concepts/balance-scheduling.md)
- [Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列](concepts/batch-job-aware-scheduler.md)
- [Chunked Prefill：切开的是一条请求，填满的是一步的预算](concepts/chunked-prefill.md)
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md)
- [DyntraLB：跨 rank 传的只有块数，没有请求 id](concepts/dyntra-lb.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算](concepts/recompute-cpu-offload.md)
- [RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点](concepts/recompute-scheduler.md)
- [ShortRequestFirst：把等待队列切成三条车道](concepts/short-request-first.md)
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [Data Parallel：复制整个引擎，一根权重都不切](concepts/data-parallel.md)
- [动态分块流水线并行：让每块耗时相等，而不是 token 数相等](concepts/dynamic-chunked-pp.md)
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切](concepts/fine-grained-tp.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [KVPP：KV 按层分给 TP 组里各张卡，算到哪层就把整层广播回来](concepts/kvpp.md)
- [layer_sharding](params/layer-sharding.md)
- [Pipeline Parallel：按层切开，界线上一步只过一份 hidden](concepts/pipeline-parallel.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Tensor Parallel：一层切两刀，通信就落在两刀之后](concepts/tensor-parallel.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [EPLB：把热门专家搬到闲着的卡上，但不改路由](concepts/eplb.md)
- [Expert Parallel：每张卡整份拿走一批专家，token 追着专家跑](concepts/expert-parallel.md)
- [Large-Scale EP：一个 DP rank 一个 server，负载均衡搬到 vLLM 外面](concepts/large-scale-ep.md)
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 15 并行 III：SP / CP / PCP / DCP
- [Context Parallel：把序列维切到多张卡上，PCP 切算、DCP 切存](concepts/context-parallel.md)
- [Sequence Parallel：把那两次 all-reduce 拆成 reduce-scatter 和 all-gather](concepts/sequence-parallel.md)

### 16 图模式与算子
- [ACLGraph：批的 token 数先垫到捕获过的尺寸，垫不上就按 eager 跑](concepts/acl-graph.md)
- [Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位](concepts/batch-invariance.md)
- [CPU 绑核：每个 Worker 钉死一段核，而且是 warmup 之后才钉](concepts/cpu-binding.md)
- [Flash Attention 3：为了和训练侧算得一样，把默认的 FIA 换掉](concepts/flash-attention-3.md)
- [图模式层](concepts/graph-mode-layer.md)
- [编译期图融合：ACL Graph 捕获之前，FX 图上先少掉一批算子](concepts/npugraph-ex.md)
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md)
- [算子层与自定义算子](concepts/ops-and-kernels.md)

### 17 量化与投机解码
- [KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处](concepts/kv-cache-quantization.md)
- [LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵](concepts/lora.md)
- [Quantization：省的是权重显存，开关在模型目录里那份 json](concepts/quantization.md)
- [Speculative Decoding：一步算 K+1 个位置，第一个对不上的地方截断](concepts/speculative-decoding.md)
- [结构化输出：采样前先算一张「这一步允许哪些 token」的位图](concepts/structured-output.md)

### 18 PD / EPD 分离与 KV 传输
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md)
- [EPD 分离：把视觉编码器也拆成一类实例](concepts/epd-disaggregation.md)
- [Mooncake 连接器：真正把 KV 从 P 搬到 D 的那半个零件](concepts/mooncake-connector.md)
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

### 00 从一次对话开始：推理到底在算什么
- [贯穿全书的那条请求](concepts/one-request.md)

### 04 Attention 深入
- [注意力后端家族](concepts/attention-backend-family.md)
- [四种注意力的代价](concepts/attention-cost.md)
- [Flash Attention 3：为了和训练侧算得一样，把默认的 FIA 换掉](concepts/flash-attention-3.md)
- [GQA：16 个 Q 头共用 8 组 K/V，省的是显存不是乘加](concepts/gqa.md)
- [MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE](concepts/mla.md)
- [RoPE (Rotary Position Embedding)](concepts/rope.md)

### 05 Prefill 与 Decode
- [KV Cache](concepts/kv-cache.md)
- [Prefill](concepts/prefill.md)

### 08 服务器与机柜
- [AI QoS：给 UB 交换机上的流量分车道，不是给请求排队](concepts/ai-qos.md)

### 09 一次请求的硬件旅程
- [NPUModelRunner 怎么读](concepts/npu-model-runner.md)
- [prepare_inputs 数据流](concepts/prepare-inputs-flow.md)
- [一次请求的调用链](concepts/request-call-chain.md)
