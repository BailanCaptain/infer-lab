# 第二轮分组审查：01 基础概念、02 请求链路

审查者：独立 agent `/root/review_first_pages`。日期：2026-11-03。

两个组共 48 页，已逐页完整阅读当前正文，包括源码区、参数参考、版本区与尾部说明；逐页初读哈希、行范围、核对主题与发现映射见同目录 `groups-01-02.json`。本报告只写审查资料，没有修改教学页。根 agent 在审查期间开始修订已通知的问题，下面行号指初读版本；复核记录单列，不覆盖初读哈希。

阅读不是所有断言的独立验证。确认问题采用固定源码、同页前后算例、跨页定义和可重复的小型数学/进程实验。未运行 NPU、模型服务、浏览器或教学 3D；没有视觉通过结论。Kimi-K3、MiniMax-M3 按 JSON 记录的完整相关章节扩读，未声称读完其中全部重复部署配方。

## 需要修订的问题

### F01 · P1 · 采样首屏把 decode 讲成每次重算已有全文

- 位置：`wiki/concepts/sampling.md:313`、`:323`。
- 问题与影响：“每写一个，都要把已有的文字送进模型算一遍”“下一步和前面的文字一起送回模型”会直接破坏学习者对 KV 复用与逐步 decode 的理解。后面的普通采样算例不需要这个错误前提。
- 证据：同库 `one-request.md` 的 R1 第二圈输入与缓存读取；固定 `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py:403–416` 以待算位置减已算位置决定新输入，不每轮重新输入全部历史；拒绝候选的进度回退见 `:1417–1431`。
- 最小替换：313 开头改为“普通自回归生成每次确定一个新 token；prefill 先处理提示词并保存历史状态，之后 decode 通常只输入上一枚新 token，配合已保存状态继续计算。投机解码可一轮验证多个位置。”323 改为“抽出的编号成为下一轮新输入，前文通过保存的历史状态参与计算。”保留后面 logits 和六词算例。

### F02 · P1 · mHC 的约束不保证信号不消失，也不排除相消

- 位置：`wiki/concepts/layers-and-hidden.md:219`、`:239`。
- 问题与影响：双随机矩阵连乘“不会消失”、正系数使流“不会相互抵消”不是所述数学约束的结论。
- 证据：四条流取 `[1,-1,1,-1]`，4×4 元素全为 1/4 的矩阵非负且每行每列和为 1，乘后四项全为 0。本轮 Python 求和复现输出 `[0.0,0.0,0.0,0.0]`。
- 最小替换：“连乘仍保持非负及行列和约束，避免因总权重失衡把同向信号逐层整体放大或缩小；不同流之间的差异仍可能被平均掉。”“系数非负，不会单靠负系数翻转一条流的贡献；hidden 本身可正可负，不同流的数值仍可能相互抵消。”保留有限轮 Sinkhorn 只是近似的现有说明。

### F03 · P2 · 逻辑权重容量和理想复用被写成实际 HBM 流量、固定瓶颈

- 位置：`lm-head.md:151`、`:231`、`:240`、`:266`、`:288`；`vllm-engine-core.md:131`；`vllm-scheduler.md:157`；`prefill.md:143–153`、`:176`、`:190`；`chunked-prefill.md:122`、`:134–144`；`prepare-inputs-flow.md:123`。
- 问题与影响：“不管 n 是几都只读一遍，这是矩阵乘一般规律”“最大开销整份权重读一遍”等把张量规模推导变成设备测量。分块、缓存驻留、融合和路由都会改变实际读量；MoE 更不能统一按整份模型权重参与每步。
- 证据：`matmul-and-weights.md` 已区分逻辑容量与真实 HBM 流量；同页/部署页多处明确没有硬件测量。计算相同矩阵积可以采用不同分块与读取顺序，单靠矩阵形状不能确定 HBM 读取次数。固定 MoE 实现只对路由选择的专家求值，与“整份权重”泛化也冲突。
- 最小限定句：“下列字节数按每轮理想读取一遍所参与权重估算，用来说明并批增加复用机会；实际 HBM 流量和耗时瓶颈要结合缓存、算子与同一负载的 profile 判断。MoE 还须按本轮选中专家计。”保留 FLOPs、权重形状和理想算术强度，删除由这些量直接推出的时间保证。

### F04 · P2 · MoE 的原生回退不总与融合路径数学等价

- 位置：`wiki/concepts/moe.md:339`，与同页 `:190–198` 冲突。
- 证据：`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py:171–191` 原生路径按组内最大值选组；`:295–307` 融合调用设 `group_select_mode=1`；`csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h:40` 定义 1 为组内前两项之和。两种排名可以不同。
- 最小替换：“这些条件会转到原生实现；不能一概视为数学等价。分组路径的代表分规则不同，可能改变选中专家；本页 GLM 的 n_group=topk_group=1 时该差异退化，结果才不因选组规则改变。”

### F05 · P2 · 稀疏注意力的存储结论超出内容选取型示例

- 位置：`attention-cost.md:115`、`:134–141`、`:219`；`sparse-attention.md:108–115`；`mla.md:161`。
- 问题与影响：泛称“稀疏注意力仍存全部历史、不省缓存”，但页面随后又包含固定窗口等稀疏模式，会让读者把 GLM 内容选取型实现套给所有稀疏访问机制。
- 证据：`vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py:448–501` 释放不再被注意力需要的块；SlidingWindowManager `:767–793` 将窗口前的历史标为可跳过。此证据只证明窗口型反例，不推断任意稀疏模型都会回收历史。
- 最小限定句：“本节 GLM 的内容选取型稀疏注意力仍保留可被选中的历史，节省的是大向量读取与计算；固定窗口等访问模式可按其规则回收窗口外缓存，不能由‘稀疏’二字统一判断容量。”

### F06 · P2 · 多页仍把 prefill 定义成一次处理整段提示词

- 位置：`embedding.md:162`、`sparse-attention.md:98`、`gqa.md:145`、`mla.md:251`、`layers-and-hidden.md:257`、`glm-5-3-flash.md:122`、`one-request.md:129`、`vllm-scheduler.md:145`、`chunked-prefill.md:95`、`async-scheduling.md:113`、`npu-worker-lifecycle.md:143`、`prepare-inputs-flow.md:125`、`streaming-output.md:176`。R1 的明确小输入算例不属于泛化错误。
- 证据：`prefill.md:109` 已给阶段定义；`chunked-prefill.md:91` 与后面的多轮算例，以及固定 scheduler `:403–416` 的预算裁剪均明确允许多轮。`prepare-inputs-flow.md:207–209` 另将执行标签“每条一 token”简写为纯 decode，应与 prefill 页关于提示词尾块的边界一致。
- 最小统一句：“prefill 是处理提示词、建立历史状态的阶段，可分多轮完成；下文 R1 只有 4 个输入位置且没有缓存命中，所以本例一轮完成。”输入准备补：“这里是执行形状标签，不足以单独判断请求是否已经结束 prefill。”

### F07 · P2 · 环境变量重读被误写成已运行服务可被 shell 热改

- 位置：`wiki/concepts/ascend-config-system.md:158`、`:262`。
- 证据：`vllm-ascend@db701c1f:vllm_ascend/envs.py:118–122` 重新调用当前进程 getter；`ascend_config.py:335–346` 明确环境值可回填配置。独立子进程实验：子进程读取 before，父进程改为 after 后，子进程再次读取仍是 before。
- 最小替换 158：“只有同一个运行进程的 os.environ 确实被修改，后续未缓存的读取才可能看到新值；在启动终端重新 export 不会修改已运行服务及其他 Worker 的环境，部署配置应重启后核实。”262 改为“仅由代码直接消费、未并入配置对象的环境开关，平台配置检查未必能看见；上面的九对兼容映射是例外。”

### F08 · P2 · 插件自动生效和候选冲突条件被过度简写

- 位置：`reading-vllm-ascend.md:191`；`platform-plugin-registration.md:105`、`:205`、`:219`；`vllm-platform-interface.md:133`。
- 证据：`vllm@0fc695fc:vllm/plugins/__init__.py:32–64` 按 VLLM_PLUGINS 过滤，导入可失败；`vllm/platforms/__init__.py:231–245` 外部恰好一个时优先选择，不再检查内置候选数。内置多候选报错只发生在外部零激活时。
- 最小替换：“安装声明提供发现入口；默认允许加载且导入、调用成功后才生效，VLLM_PLUGINS 可以过滤入口。被识别也不等于设备运行可用。”冲突规则改成：“外部候选至少两个时报错；恰好一个则优先选它；没有外部候选时才判断内置候选冲突。”

### F09 · P2 · 把 MTP 的四个验证位置当成四个净推进位置

- 位置：`wiki/concepts/batch-job-aware-scheduler.md:224–233`。
- 证据：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py:1417–1431` 根据拒绝候选数扣回 num_computed_tokens 与输出占位。同库 R1 与 async-scheduling 已有部分接受的例子。
- 最小替换：“每轮通常调度 4 个验证位置，但净推进 1–4 个；只有候选持续全接受，且忽略块内起点与 lookahead 的边界差异，640÷4=160 轮才是理想示意，不能作为固定跨块周期。”后文“多数不要新块”应仅明确指 full 组，不掩盖其他状态组的临时借还。

### F10 · P2 · 并发页把载荷、跨机流量和耗时比例混为一谈

- 位置：`wiki/concepts/concurrent-requests.md:388–409`、`:415`、`:432`、`:484`。
- 问题与影响：按张量容量相加后给出“实际跨机 66 GiB”和 135 倍；MC2 的 EP16 dispatch/combine 包含同机/本卡选中专家，不能全称跨机量。专家选择量翻倍不保证整层时间翻倍。空闲 DP1 仍计算 DP0 路由到它的真实专家，不能称另一半算力没有产出。
- 证据：`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py:440–495` 是补齐和 DP all_gather 的张量路径；`:543–559` 是 reduce_scatter 与裁切，不能由此确定全部物理链路字节。页面自身 `:367–374` 的 EP16 拓扑与 `:419` 的远端真实专家工作也反驳“无产出”。
- 最小修法：表列改“张量载荷/逻辑复制量”，给出的累计量只说明所用口径；取消实际跨机 135 倍结论，补“实际跨机流量还取决于专家所在机器、集合算法与拓扑，应以链路或通信 profile 核实”。415 改“更不均的专家分配可能增加最慢卡耗时，增长比例取决于算子吞吐、通信与固定开销”。432/484 改“DP1 没有自己的请求输出，仍承担 DP0 的真实专家计算；额外代价来自填充行和为同步继续执行的工作，不能把另一台全部算力算作无产出。”

### F11 · P2 · 短请求优先算例的第二步预算并不相同

- 位置：`wiki/concepts/short-request-first.md:111`。
- 证据：该页 102–110 明确每条普通 decode 占 1 个位置；第 2 步 FCFS 为 A1+B1+C2+D2=6，SRF 为 C1+D1+A1+B4=7。本轮算术复现输出 6 与 7。
- 最小替换：“两种取法第 1 步都用满 16 个位置；预算上限相同，后续每步的实际工作量会因哪些请求已转入 decode 而不同。”不改 125–129 的首输出步数账。

### F12 · P2 · 长度停止避免多排一步需要可预判条件

- 位置：`wiki/concepts/request-teardown.md:450`，与 `:340`、`:354` 的 197→200 算例矛盾。
- 证据：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py:381–395` 要在候选全拒绝时仍能确定已达 max_tokens 才跳过调度。
- 最小替换：“只有调度时已经能确定在途步达到长度上限，才不再多排；否则仍可能提前排出下一步，随后在结果更新中丢弃。”

### F13 · P2 · prefill 调参和 PD 分离不提供绝对时延保证

- 位置：`wiki/concepts/prefill.md:417`、`:419`。
- 证据：同库 chunked-prefill 的预算权衡已正确要求同负载测 TTFT/ITL；PD 页解释 KV 交接、传输与排队成本。固定调度预算代码只决定允许位置数，不保证墙钟时间。
- 最小替换：“调大预算可能减少分段数，但 TTFT、ITL 与吞吐还受排队、同批工作量和通信影响，须在相同负载下对照。”“PD 分离可避免两阶段共享同一步计算，仍需评估 KV 传输、路由和资源竞争。”保留现有预算算例。

### F14 · P2 · KDA 页把补齐分配容量称为真正写入字节数

- 位置：`wiki/concepts/linear-attention.md:208–235`，尤其 `:215`、`:227`。
- 证据：85 MiB 的计算使用 34 层×4 状态×补齐页 655360 B；有效状态值 561152 B 另有明细。按页占有容量不是设备实际写入流量，未提供写满 padding 的算子或 profile 证据。
- 最小修法：把“真正写进去/实际写入”改为“按补齐状态页计的分配容量”，分别保留有效状态数据、页内补齐和块分组空位三笔账；不由容量数字推出写带宽。

### F15 · P2 · 结构化输出的 CPU→NPU 回程仍为 FP32

- 位置：`wiki/concepts/structured-output.md:313`，关联 `:307`。
- 证据：`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py:2421–2424` 是 `logits.to("cpu").float()`，施加 mask 后执行 `logits.to(self.device).to(logits_dtype)`，先传回再转原精度。
- 最小替换：“本例 NPU→CPU 的 BF16 张量约 37.8 MiB；CPU→NPU 在转回原精度前仍为 FP32，约 75.6 MiB，两方向张量数据量合计约 113.4 MiB/卡/步，不含其他搬运；实际耗时需实测。”不将 PyTorch 张量字节数进一步称为实测链路流量。

### F16 · P2 · 教学正文仍承担内部审计叙事，部分待核已有可读原始材料

- 代表位置：`chunked-prefill.md:318–330` 多段“归档草稿转述/未独立核验”；`sampling.md:1154–1156`“本次已核/归档第几行”；`layers-and-hidden.md:394`“本轮补充读取”；`vllm-v1-shape.md:341–347`；`vllm-ascend-overview.md:215–217`；`request-teardown.md:521`“尚未读官方完整命令”。各页映射见 JSON。
- 影响：学习者被要求理解审计轮次、草稿来源、维护者此前未读范围，混淆机制边界与维护过程。整段删除又会让未证实断言变成确定事实。
- 已做的原始复核示例：本轮 plugins/platforms 的激活逻辑、MoE 两条选择规则、scheduler 的候选回退、structured-output 的 CPU 往返；第一轮已完整阅读用户指定的 GLM/DeepSeek 官方教程，不能继续用“未读命令”作当前解释。官方 patch 设计全文和当前固定源码需区分：设计中旧限制不能直接覆盖后来插件再初始化的真实入口。
- 最小修法：将“本次/归档/草稿第几行/仍须人审”与审查过程移到 `docs/reviews/`；先逐条追到固定一手源码，再在正文留下简洁支持条件。例如并列规则改为“以下并列行为仅适用于所列 PyTorch 排序掩码分支；Ascend 融合算子的并列行为须单独确认”。保留真实的未实测、未支持、安装版本未知和组合验证边界。

### F17 · P2 · 流式输出不保证第一步即可见，也不保证总时间不变

- 复审位置：`wiki/concepts/streaming-output.md:172–174`。
- 问题与影响：原句把“首步输出”“首个 token 到达”和“第一段可见文字”合并，并把流式前后总生成时间写成恒等。该页后文已有停止串缓冲、反分词、解析与发送间隔的条件，首屏与后文相互冲突；MTP 下也不能用输出 token 数等同前向次数。
- 证据：本页停止字符串、增量反分词和请求流式参数的完整解释；固定上游 `vllm@0fc695fc:vllm/v1/engine/detokenizer.py:47–166` 的缓冲与增量状态，`vllm/v1/engine/async_llm.py:637–695` 的输出处理；这些控制流不提供端到端时延恒等保证。
- 修法：保留 200-token 算例并标明忽略缓冲/传输差异、每步生成一枚可见 token 的假设。首屏分开模型输出、可见文本与传输，说明流式不减少需生成的位置数但会改变交付时机与处理开销；同步修正 prefill 可以分轮和投机一轮多个 token。

## 扩读得到的覆盖信息

Kimi-K3 固定教程明确使用 MRV2，并把模型、tokenizer/reasoning/tool parser、DSpark、PP/DCP 和不同设备配方组合起来；例如 A5 的 PP 分段与 A3 不同，不能把现有 GLM 基线的默认 MRV1、PP 分段或参数复制过去。MiniMax-M3 的多模态限额、视觉编码塔内存、thinking_mode、解析器和工具调用流是相互独立的入口条件。现有入口/流式/调度页的 GLM 固定主线有教学价值，应保留；对新增模型应提供“模型专属入口与能力边界”跳转，而不是把所有特例塞进 GLM 的首屏。这里记录为第二方案的覆盖依据，不把未读的重复配方标成已验证。

本轮新增完整阅读的官方资料（均为本地 pinned 921ccc52）：

- `user_guide/feature_guide/batch_job_aware_scheduler.md` 1–150：作业标签、EWMA、KV 预留、配置层级、离线范围与无饥饿保护。
- `user_guide/feature_guide/structured_output.md` 1–17：Ascend 对上游用法的链接入口。
- `developer_guide/Design_Documents/patch.md` 1–75：patch 进程位置、临时性原则与设计文档的旧限制。
- `developer_guide/Design_Documents/balance_schedule_refactor.md` 1–562：全局准入冻结、collective 参与条件、波次边界死锁、版本钉点与仍未完成的 NPU 测试。该文档中的具体旧版本和 TODO 不反推为本站所有版本行为。

第一轮已完整读过的 PP、GLM5.3-Flash、DeepSeek-V4.1-Flash、supported_models、CP/CPU/Runtime Guard/投机相关官方文本，本轮仅复用既有阅读上下文；本报告没有把复用伪写成本轮重复全读。

## 验收限制与保留项

48 页中许多详细解释正确且应保留：R1 的逐站形状、token/字节区别、采样六词演算、参数默认与实际派生的区别、请求停止的跨进程顺序、DP 路由计数滞后、KV 容量与并发的区别、原固定版本与 rc2 分列。未发现问题的页表示本轮完整阅读及所列主题核对没有形成可报告问题，不表示其所有事实、全部来源或图都已验证。

浏览器本轮不可用，未作视觉验收；没有 NPU 或镜像服务实例，性能与设备支持仍需实际部署验证。图如随正文修改，须由实施方按项目标准补图文一致性及允许的验收，不可用本报告代替。

## 整改与复核闭环（2026-11-03）

初读记录保留：48 页的 sha256_read 不覆盖；JSON 另记整改后的 sha256_after_remediation。下列状态只表示所列问题已修订并由本审查者核对相关正文/源码，不表示 48 页每条事实均已证明。根审查者仍将独立复核本 agent 新改内容。

| 问题 | 状态与当前定位 | 保留的解释与边界 |
|---|---|---|
| F01 P1 | 已修并复核：sampling:313、323 | 六词 logits、概率与采样演算保留；历史状态与新输入分开 |
| F02 P1 | 已修并复核：layers-and-hidden:219、237、239、391 | 双随机矩阵与有限 Sinkhorn 教学保留；补上可抵消反例及 eps 近似边界 |
| F03 | 已修并复核：lm-head:151；engine-core:131；scheduler:157；prefill:143；chunked-prefill:134 | 保留算式，区分容量、理想批内复用与 HBM 实流量 |
| F04 | 根组修订独立复核通过：moe:339 | 原生组内 max 与融合 top-2 和的差异、GLM 单组退化条件保留 |
| F05 | 已修并复核：sparse-attention:102–108；attention-cost:115、134、219；mla:161 | 内容选择型稀疏与窗口型存储边界分开；关联图同口径 |
| F06 | 已修并复核：embedding:162；lm-head:197；one-request:129；prepare-inputs-flow:212 等 | R1 的一次 prefill 例子保留；一般定义允许分轮，attn_state 不等于请求阶段 |
| F07 | 已修并复核：ascend-config-system:158、262 | 同进程环境懒读与启动 shell、配置快照、兼容环境入口分开 |
| F08 | 已修并复核：platform-plugin-registration:97、205、219、241；platform-interface:133 | 安装、发现、筛选、导入、调用、激活分开；保留 rc2 CPU 特例 |
| F09 | 已修并复核：batch-job-aware-scheduler:228–235 | 160 轮保留为持续全接受且忽略边界的理想示意 |
| F10 | 已修并复核：concurrent-requests:383–432、484 | 原张量形状账保留；去掉实流量倍数和耗时倍数保证，空 DP 仍可处理远端真实专家工作 |
| F11 | 已修并复核：short-request-first:111 | 两步时序与小算例保留，第二步 FCFS=6、SRF=7 |
| F12 | 已修并复核：request-teardown:447 | 可预判长度才免排下一步；197→200 的反例保留 |
| F13 | 根组修订独立复核通过：prefill:417–419 | 分块预算和 PD 分离的目标保留，同时列出排队、通信和共享资源条件 |
| F14 | 根组修订独立复核通过：linear-attention:208–235 | 85 MiB、95.6 MiB 和有效状态三种容量口径保留，不冒称实际写入量 |
| F15 | 已修并复核：structured-output:304–310 | BF16 去程、FP32 回程与传回后转精度分开；113.4 MiB 是张量数据量 |
| F16 | 已整改：chunked-prefill:318 起、sampling:1154 起等 | 草稿/归档/核验轮次叙事移出教学；真实未实测、未支持和版本未知边界保留。官方/源码索引仍在页末 |
| F17 | 已修并复核：streaming-output:172–181 | 分开第一枚 token、第一段可见文本和总延迟；原算例条件化保留 |

F02 复审追加依据：`vllm-ascend@db701c1f:vllm_ascend/ops/mhc.py:5–37` 和 `glm-5-next-adapt-0826/glm-5-next-transformers.patch:1965–2000` 明确在入口 sigmoid、softmax 后及归一分母加入 eps，故“最后列和精确为 1”也已改为近似，不只删除原来的“不消失”断言。

F16 追溯后的新闭环包括：固定 HF 三版包装层的 return_dict 兼容、缺模板错误；GLM 分块状态共同边界；FP32 indexer 临时行分块；MTP 清单 128 对齐；稀疏量化返回路径差异；平台选择优先级；Worker 状态增量；V1 引擎与 V2 Runner 的区别。源码检查范围在 JSON 单独登记，未把部分源码读取写成全仓核验。

本 agent 修改的教学页 35 页、图 YAML 2 份及对应 SVG 2 份，精确清单见 JSON 的 remediation_files；根组先改并由本 agent 复审的 linear-attention、moe 等另在 root_changes_independently_reviewed，不把它们冒充本 agent 改动。并发增加的 rc2 段落与原有有效算例均保留。

实际验证：

- `pnpm check:content`：163 页内容完整、11 个主主题无重复，通过。
- `pnpm wiki:audit`：163 页、5794 来源；5437 行号有效，无无效 commit/缺失文件/越界行；强制名单 104/104 通过。357 URL 未联网验证、1913 raw 引用内容待核，这些不因审计通过而关闭。日志 `.tmp/groups-01-02-final-audit.log`。
- `pnpm wiki:lint`：通过；本组引入的重复角标已合并到页末来源索引，剩余 1 个非阻塞提醒为其他组 rfork-startup 的 C 标记比例。
- `pnpm wiki:diagrams --check`：331 张图与 spec 一致；全站原有 76 项非阻塞图建议保留。两张本组图只调整口径、短标签与 caption，未改变整体布局，未声称浏览器或视觉通过。
- 数学反例、SRF 算例和子进程环境隔离小复现结果保留于 JSON experiments。未运行 NPU、完整服务、性能压测或浏览器。

目前本组已确认的 P1/P2 修订均有闭环，无需用户决定的新问题。实际镜像与硬件组合、性能、图视觉验收仍为明确限制，而不是文档语义整改可以代替的检查。
