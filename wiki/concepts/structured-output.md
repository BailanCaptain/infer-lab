---
id: structured-output
title: "结构化输出：文法怎样在采样前屏蔽不合法的 token"
type: feature
summary: 结构化输出在打分和采样之间加一道关卡：文法状态算出下一步允许的 token，其余候选的 logits 改成 −∞ 再采样。先看这个过程，再沿 GLM 双机看 bitmask 在哪个进程、哪一步算出，怎样作用到 logits，以及它和 MTP 草稿、思考阶段的配合。
aliases:
- 结构化输出
- Structured Output
- Guided Decoding
- 引导解码
- 受限解码
- 约束解码
- 文法掩码
- guided_json
- structured_outputs
- StructuredOutputManager
- grammar bitmask
- 文法位图
- apply_grammar_bitmask
- xgrammar
- guidance
- JSON schema
- response_format
chapters:
- '17'
order: 60
sources:
- https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L39-L78
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L115-L184
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L186-L300
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L302-L370
- vllm@0fc695fc:vllm/v1/structured_output/request.py#L42-L98
- vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L36-L125
- vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L148-L195
- vllm@0fc695fc:vllm/v1/structured_output/utils.py#L44-L135
- vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463
- vllm@0fc695fc:vllm/v1/engine/core.py#L505-L596
- vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L35
- vllm@0fc695fc:vllm/config/vllm.py#L957-L1001
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1305-L1327
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1462-L1475
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1745-L1795
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2205-L2210
- vllm@0fc695fc:vllm/sampling_params.py#L842-L972
- vllm@0fc695fc:vllm/config/structured_outputs.py#L12-L41
- vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L579-L612
- vllm@0fc695fc:vllm/tool_parsers/abstract_tool_parser.py#L115-L150
- vllm@0fc695fc:vllm/reasoning/__init__.py#L55-L58
- vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L319-L327
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2427
- vllm-ascend@db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L19-L68
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L44-L52
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L76-L134
- vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2449-L2455
- vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2351-L2357
- vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_structured_output.py#L114-L286
- vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2753-L2759
- vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_structured_output.py#L134-L160
- vllm-ascend@baa023ad:vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py#L27-L86
- https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/user_guide/feature_guide/structured_output.md
- vllm@0fc695fc:vllm/envs.py#L1529-L1529
- vllm@568afb3a:vllm/v1/structured_output/__init__.py#L60-L236
- vllm@84030bbe:vllm/v1/structured_output/__init__.py#L60-L243
- vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L38
- vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130
- vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L681
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: C
relations:
  - {to: one-request, kind: builds-on, note: 主线第 5 站讲 logits 怎样变成一个 token；本页讲带格式约束的请求在这一站前多出的一道屏蔽}
  - {to: token, kind: builds-on, note: 文法要按分词器的 token 判断合法性；154880 行词表与分词器编号的关系在那一页}
  - {to: speculative-decoding, kind: builds-on, note: MTP 草稿位置各要一行 bitmask，违反文法的草稿在验证前就被截掉}
  - {to: npu-model-runner, kind: builds-on, note: 前向和采样分成两次调用，bitmask 在第二次调用时作用到 logits}
  - {to: async-scheduling, kind: builds-on, note: 本部署异步调度开着，受约束请求上一步的 token 未确认时，本步整批采样要推迟}
contradicts: []
updated: '2026-09-28'
origin: seed
---

## 结构化输出怎样让模型只写出合法格式？

模型每生成一个 token，先给词表里每个候选打一个分，这组分数叫 **logits**；**采样**再按分数挑出一个 token，可以直接取最高分，也可以按概率抽，过程见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

**结构化输出（structured output）在打分和采样之间加一道关卡：按请求要求的格式，算出下一步哪些 token 还能让输出保持合法，把其余候选的 logits 改成 −∞，再交给采样。** −∞ 的候选按概率算是 0，取最高分也轮不到它，所以一定不会被选中。

请求要求的格式可以是 JSON schema（规定 JSON 里有哪些字段、每个字段是什么类型）、正则表达式、几个固定选项，或者一段形式语法（grammar）。vLLM 先把它们都编译成**文法**：一台记着"已经写到哪里"的状态机。当前状态下允许的候选集合写成一行位图，叫 **bitmask**：词表里每个 token 编号占一位，1 表示允许，0 表示禁止。

```wiki-diagram
file: structured-output
```

图里是一个只有 8 个 token 的教学词表，编号 0 到 7，模型给出的 logits 是 1、4、2、6、0、3、5、−1。请求要求输出形如 {"ok": 值} 的 JSON，值只能是布尔或 null；已经写出 {"ok":，此时只有 ␣false（编号 1）、␣null（编号 4）、␣true（编号 6）能接下去，␣ 表示开头带一个空格。屏蔽后的 logits 是 −∞、4、−∞、−∞、0、−∞、5、−∞。按取最高分采样，选中的是允许集合里分数最高的编号 6；模型原本最看好的编号 3「Sure」（6 分）已经被排除。这是单步、没有投机草稿的缩小例子。

**模型仍然负责打分，文法只决定哪些候选有资格被选。** 选出的 token 交回文法，状态推进到 {"ok": true，下一步允许的集合也跟着变，比如轮到收尾的右花括号。所以连续多步用的是一个不断前进的约束状态，而不是一张固定不变的表。

实际存储时，每 32 个编号的位打包成一个 32 位整数，最低位对应编号最小的 token。上面的例子如果单独打包，允许编号 1、4、6 就是 2¹ + 2⁴ + 2⁶ = 82，从高位到低位写成 01010010。全部位都是 1 的整数（按有符号数就是 −1）表示这一行不设限。

## 为什么需要它，代价在哪？

**只在提示词里要求"请输出 JSON"，模型照样会不时多写一句客套话、漏一个引号，或者把数字写成字符串；事后校验失败，只能整段重新生成。** 结构化输出让每一步只有合法候选参与采样，只要请求正常写到结尾，受约束的那段输出就符合编译出的文法。这是按机制推出的结论；固定部署上的实际格式正确率没有实测，其他模型或其他 runner 的结果也不能直接当成这套部署的保证。

它有两条边界。第一，格式约束不检查内容真假：符合 schema 的日期、金额或结论，照样会有错的。第二，请求被取消、触到输出长度上限或命中停止字符串时，输出会停在格式写完之前，拿到的仍是不完整的 JSON，见下文[收尾](#收尾格式写完才放行结束编号别的停止照样截断)。

难点在于 token 不等于字符。GLM 的分词器有 154820 个普通条目，多数是字节级 BPE 合并出的多字符片段，详见 [token](token.md#编号要落在-154880-行之内)。一个 token 里可以同时有引号、冒号和半个单词，所以文法不能只问"下一个 JSON 字符是否合法"，要检查每个候选的整段字节能否接在当前状态之后。为此，后端要先结合分词器把文法预处理一遍，这一步叫**编译**；之后每一步，还要为整张词表填一行 bitmask，GLM 这一行有 154880 位。

代价分成五处。编译每个请求只做一次，其余四处每个调度步都有一份，与模型层数无关：

- **编译文法**：每个带约束的请求先把 schema 编成文法。编译在引擎进程（负责调度的那个进程）CPU 上的线程池里异步进行，编好之前请求留在等待队列，不参与调度；同一个 schema 再来时可以命中编译缓存。
- **每步填 bitmask**：引擎进程把本步前向派发给各卡后不等结果，趁 NPU 算前向，在 CPU 上为每个受约束的请求填一行。填得比前向慢，采样就得等它。
- **把 bitmask 作用到 logits**：bitmask 随采样调用发到每张卡。上游 GPU 实现在显卡上原地改写 logits；vllm-ascend 默认的 [model runner](npu-model-runner.md)（每张卡上组织前向和采样的那部分代码）把 logits 拷到 CPU 改完再拷回，下文细讲。
- **与投机解码配合**：[投机解码](speculative-decoding.md)是先快速猜出后面几个 token（叫**草稿**），再让主模型一次验证、接受猜对的那一段；本部署用 **MTP**（模型自带的多 token 预测层）来草拟。每个草稿位置要各占一行 bitmask；草稿本身不受文法约束，不合法的草稿在验证前就被截掉，被截掉的部分也就没有机会被接受。
- **异步调度下整批采样要等上一步**：**异步调度**是上一步的结果还没处理完，就先把下一步排好发出去；本部署是开着的。批里只要有受约束的请求在 decode，整批的采样都要等上一步结果处理完、bitmask 填好才发出，不能再和上一步结果的处理同时进行，见下文[异步调度](#异步调度本部署开着整批采样要等上一步)。

这几处在固定部署下各慢多少，目前没有实测数，缺口列在页末。结构化输出容易和相邻的几个机制混在一起，区别在于它们作用的位置：

| 机制 | 作用在哪里 | 改变的是什么 |
| --- | --- | --- |
| 采样参数（温度、top-k、top-p） | 采样时 | 在有资格的候选里怎样挑 |
| 结构化输出 | 采样之前 | 哪些候选有资格被挑 |
| 停止条件（结束编号、停止字符串） | 采样之后 | 什么时候结束，不限制中间写什么 |
| reasoning parser、tool-call parser | 生成好的文本上 | 把思考段、工具调用拆出来；reasoning parser 还决定结构化约束从哪一步开始 |

## 放到 GLM 双机：一个带 JSON schema 的请求走一步

**官方双机命令没有为结构化输出加任何参数，它按请求开启：请求里带了 JSON schema 这类约束，这个请求才走下面的路径。同一批里不带约束的请求不受屏蔽，照常从全部候选里采样；但本部署开着异步调度，它们的采样要跟着受约束的请求一起推迟，见[下文](#异步调度本部署开着整批采样要等上一步)。** 部署设定见[部署前提](glm-5-3-flash-two-node.md#部署前提)。下面设想主线的示例请求 R1（prompt 为 4 个 token 的那条请求，见[一次请求](one-request.md)）带上一个 JSON schema，看它多走了哪几步。这些步骤挂在主线[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)：前向算出 logits 之后、采样之前。

```wiki-diagram
file: structured-output-flow
```

图分三列。左列是 node0 上接收 HTTP 请求的 API server 进程；中列是 **EngineCore**，负责调度的引擎进程，每台机器一个；右列是每张卡上的 worker 进程，一台机器 8 个。文法状态和 bitmask 都在中列的 CPU 上，右列只负责把 bitmask 作用到 logits 再采样。

### 1. 入口：API server 校验请求、定下后端

请求把 response_format 设成 json_schema，或者在扩展字段里给出正则、固定选项、语法，API server 就把它转成结构化输出参数，并校验能不能编译。

真正编译文法、填 bitmask 的库叫**后端**。vLLM 支持四个：xgrammar、guidance（基于 llguidance 库）、outlines、lm-format-enforcer。服务默认用 auto：先按 xgrammar 校验，schema 里有 xgrammar 不支持的特性时退到 guidance，少数情况退到 outlines；lm-format-enforcer 只在显式指定时使用。四个后端产出同一种打包格式的 bitmask，作用到 logits 时用的是同一个函数。

**一个引擎只建一个后端对象，由第一个带约束的请求定下。** 昇腾补丁记住这个后端，之后哪个请求解析出另一个后端，就在校验时直接报错。同一个后端可以同时服务许多不同的 schema，"多个 schema"不等于"多个后端"；但在 auto 下，一个用了 xgrammar 不支持特性的 schema 会解析成 guidance，于是被拒。要避免，就在启动时显式指定后端。

请求随后被送进 node0 或 node1 的某一个 EngineCore。两台机器的 EngineCore 各有一个 **StructuredOutputManager**（结构化输出管理器，负责编译文法、保存每个请求的文法状态、每步填 bitmask），R1 的文法状态只存在处理它的那台机器上。

### 2. EngineCore：编译文法，编好才调度

EngineCore 收到请求就开始建文法。编译交给一个线程池异步完成，线程数取 CPU 核数的一半；请求先处在"等文法"的状态，不会被调度。调度器每轮检查一次编译好了没有，这次检查最多等 100 微秒：它是单次等待的上限，不是编译总时间，也不是每轮都会花掉的时间。编好之后请求转为普通等待，才轮得到 prefill。xgrammar 自己的编译器最多再开 8 个线程，并缓存编译结果（默认上限 512 MB），同一个 schema 再来时不必重编。

有一种启动方式叫 external_launcher，每个 TP rank（[张量并行](tensor-parallel.md)组里一张卡对应的那个进程）各带一个调度器。异步编译会让各 rank 在不同时刻把请求放行，调度就对不齐了，所以这种方式下改为同步编译。官方双机命令用的是一个 EngineCore 带 8 个 worker 的多进程方式，不受影响。

bitmask 的宽度按模型配置里的词表大小建，也就是 logits 的列数 154880，而不是分词器实际会产出的 154856 个编号。154880 恰好是 32 的整数倍，所以每一行正好装满，与 logits 逐列对应，不需要截断或补位：

```calc
title: GLM 的一行 bitmask 和整块缓冲
一行的整数个数 = 154880 ÷ 32 = 4840 个 32 位整数
一行字节数 = 4840 × 4 B = 19,360 B
缓冲行数 = 32 个请求 × (1 + 3 个草稿位) = 128 行
整块缓冲 = 128 × 19,360 B = 2,478,080 B ≈ 2.36 MiB
> 在 EngineCore 进程的 CPU 内存里，第一次有带约束的请求时分配
```

每个执行组一步最多 32 个请求、每步 3 个草稿，都是官方命令里的设定，见[关键参数](glm-5-3-flash-two-node.md#关键参数各管哪一步)。多出来的 24 个编号 154856–154879 分词器从不产出（见 [token](token.md#编号要落在-154880-行之内)），文法会不会放行它们，取决于 xgrammar 对"词表比分词器大"的处理，本地没有 xgrammar 源码，列入页末待核。

### 3. 每一步：趁前向时在 CPU 上填 bitmask

**bitmask 在 EngineCore 进程里、由 CPU 算出，时机是本步前向已经派发、还没取回结果的时候。** EngineCore 每步先把前向派发给本机 8 个 worker，不等结果，接着挑出本步要填 bitmask 的请求：用了结构化输出、并且这一步会产出 token 的请求。chunked prefill（长 prompt 分几步算）的中间块不产出 token，不填。

上游为大批量准备了并行填表，要过两道门槛。第一道在启动时：请求上限 max-num-seqs 大于 128，才建填表用的线程池（和上面编译用的线程池是两个）；本部署是 32，这个线程池根本不建。第二道在每一步：受约束的请求多于 128 个、并且没开投机解码，才把填表分给线程池；本部署开了 MTP，即使建了线程池也不走并行。所以所有请求都在 EngineCore 的主线程里逐个串行填。

开了 MTP 后，R1 这样的 decode 请求每步带 1 个已确定的位置和 3 个草稿位置，要填 4 行。第 1 行按当前状态填；然后临时接受第 1 个草稿，填第 2 行；依次接受第 2、3 个草稿，填第 3、4 行；填完把这 3 步临时推进全部回滚，等真实采样结果出来再正式推进。每个位置面对的前缀不同，不能共用一行。xgrammar 的状态机为此最多保留 3 步可回滚的历史，正好等于草稿数。

有几种行直接填全 1，即不设限：文法已经走到终态的请求；还在思考阶段、不该受约束的请求，见下一节；以及 −1 占位草稿之后的行。异步调度下，不合法的草稿被截掉后会留下 −1 占位（见下一节），填到这个位置时仍按当前状态填一行，之后停止推进，剩下的行填全 1。填好的 bitmask 只含受约束请求的行，按调度顺序排好，转成 numpy 数组，随采样调用一起发出。

### 4. 每张卡：把 bitmask 作用到 logits

采样调用发给这台机器的全部 8 个 worker，只有 0 号卡回报结果。前向结束时，每张卡都已经通过 TP 组内的 [All-Gather](collective-communication.md#all-gather)（每张卡交出自己算的那一段，拼成完整的一份发给所有卡）拿到完整的 logits；R1 的一个 decode 步是 4 行 × 154880 列。worker 先按请求 ID 把 bitmask 重新排成本卡 logits 的行序，不受约束的请求那几行填全 1。请求进入、退出、重排，都不会让约束对错行。

**vllm-ascend 默认的 V1 model runner 在这里和 GPU 版不同：它把整张 logits 拷到 CPU、转成 fp32，调用 xgrammar 的 CPU 函数把禁止的位置改成 −∞，再拷回 NPU、转回原来的精度。** 源码注释给的原因是：GPU 版用 torch.compile 优化这一步，昇腾当前不支持。但固定上游里的这个函数已经不用 torch.compile，GPU 路径直接调用 xgrammar 的原地改写函数，所以注释的理由和上游对不上；昇腾改走 CPU 的实际原因，源码里没有写，列入页末待核。搬的是这次调用的整张 logits，不是只有受约束请求那几行；满载时 32 个请求里哪怕只有 R1 带 schema，也要搬全部 128 行，而且 8 张卡各搬一遍。R1 一个 decode 步的 logits 是 4 行、约 1.18 MiB，推导见[主线第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)；满载时按同样口径：

```calc
title: 昇腾 V1 每张卡为 bitmask 搬的 logits
满载 decode = 128 × 154880 × 2 B = 39,649,280 B ≈ 37.8 MiB
满载时 CPU 上的 fp32 副本 = 128 × 154880 × 4 B = 79,298,560 B ≈ 75.6 MiB
> 第一行是 bf16 logits，拷出、拷回各一次；搬运和 CPU 改写各花多少时间没有实测
```

V2 model runner 带一个在 NPU 上直接改 logits 的 Triton kernel，把打包的位展开后写入 −∞。固定版本的补丁默认不选 V2，要显式设环境变量才会切换；打开它只改变选用哪个 runner，不能说明 GLM、MTP 和图模式的组合都兼容。

### 5. 采样之后：推进文法，截断下一轮草稿

屏蔽后的 logits 进入正常的采样和草稿验证，过程见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)和[投机解码](speculative-decoding.md)。0 号卡把本步接受的 token 交回 EngineCore，调度器把它们喂给文法，状态正式前进一步。按理这些 token 都在允许集合里；万一文法拒绝，日志报错并终止这个请求。

MTP 随后草拟 3 个新 token。草拟直接取最高分，不看 bitmask，所以草稿不一定合法。这些草稿进入下一步之前，调度器先让文法检查一遍，只保留最长的合法前缀，后面的丢掉。主模型因此不会白白验证注定被拒的草稿，但被截掉的草稿也就失去了被接受的机会；对 MTP 接受率影响多大，没有实测。

## 思考阶段、异步调度与收尾有什么不同？

### 思考阶段：官方命令从第一个输出 token 起就约束

GLM 的聊天模板在 prompt 末尾放一个 `<think>` 标记，模型先写思考过程，再写答案，见 [token](token.md)；官方教程的 FAQ 写明 GLM-5.3-Flash 不支持用 enable_thinking 关掉思考。结构化输出约不约束思考段，由三件事决定：服务有没有配 **reasoning parser**（按思考标记把输出切成思考段和答案段的解析器）、enable_in_reasoning 开关、这个请求的思考是否已经结束。实现里"这一步填不填 bitmask"和"这一步推不推进文法"是分开判断的。

**官方双机命令没有配 reasoning parser。** 这时 StructuredOutputManager 没有办法判断思考在哪里结束，于是从第一个输出 token 起就填 bitmask、推进文法：思考段也被要求符合 JSON schema。针对最终答案设的格式，就这样连思考过程一起约束了，模型实际上写不出自由的思考段；这对输出质量有什么影响，没有实测。

教程 FAQ 为函数调用给出的配置里有 reasoning parser glm45，它在 vLLM 里对应一个默认按思考模式解析的 DeepSeek-V3 风格解析器。配上以后，思考没结束时 bitmask 填全 1、文法不动；看到思考结束标记的那一步，文法仍先不推进，下一步才开始，免得把结束标记当成答案的第一个 token 喂给文法。开了投机解码、约束又是 structural tag（按阶段切换格式的约束）时例外，当步就推进，因为紧接着的草稿要马上用文法检查。如果把 enable_in_reasoning 设为 true，思考段也全程受约束。

工具调用也会走这条路径：vLLM 的工具解析器在工具选择设为 required 或指定某个函数时，把工具参数的 schema 转成结构化输出约束。官方双机命令没有配工具解析器，要用时按教程 FAQ 另加。

### 异步调度：本部署开着，整批采样要等上一步

**异步调度**让主机提前准备下一步，不等上一步的结果全部处理完，见[异步调度](async-scheduling.md)。**本部署的异步调度是开着的：** 官方命令没写这个开关，vLLM 按自动判定打开，因为 MTP 属于支持异步调度的草拟方法、多进程执行器也支持，判定过程见[请求调用链](request-call-chain.md)，主线底稿 03 第 24 条是同一结论。

打开以后，受约束的请求在 decode 阶段每一步被调度时，上一步的 token 都还没确认，调度器先用占位记着。bitmask 依赖这个 token，所以 EngineCore 照常派发本步前向，但把填表和采样推迟：先等上一步的输出回来并处理完，取回上一步 MTP 草拟的 token，用文法截掉不合法的草稿、以 −1 占位，再填 bitmask、发起采样。

**推迟的是整批的采样调用，不只是受约束的那几行。** 调度器在排本步时，只要批里有一个受约束的请求带着上一步的占位，就给整批打上"要等"的标记；EngineCore 按这个标记决定整批采样是立刻发还是推迟。所以同批不受约束的请求，采样也要跟着等。

这个依赖只挡住了和采样相关的重叠：本步前向仍然提前派发，填 bitmask 时 NPU 照常在算本步前向；失去的是本步采样与上一步结果处理之间的重叠，不能概括成整条异步流水线失效。

### 收尾：格式写完才放行结束编号，别的停止照样截断

结束编号也是词表里的候选，同样要经过 bitmask。格式还没写到可以结束的位置，后端不放行结束编号，模型给它的分再高也选不到；写到可以结束的位置，结束编号才进入允许集合，被采样选中后，调度器的停止检查把请求标为正常结束。文法到达终态以后，这一行填全 1，不再设限。

bitmask 只决定模型选哪个 token，管不到请求在哪里被叫停。下面几种停止都不经过文法，会在格式写完之前生效，拿到的是不完整的格式：

- 请求被取消；
- 输出触到 max_tokens 或模型的上下文长度上限；
- 请求设了停止字符串：API server 把 token 还原成文字时一发现它就截断，再通知 EngineCore 中止请求；停止字符串哪怕出现在 JSON 某个字段的值里，也会在那里断开；
- 请求开了重复检测，检测到重复也会停。

GLM 的三个结束编号 154820、154827、154829 分别是什么，见 [token](token.md#编号要落在-154880-行之内)。vLLM 没有把它们交给 xgrammar，而是让 xgrammar 自己从分词器读结束标记；读出的是否覆盖这三个，本地没有 xgrammar 源码，列入页末待核。两种结果的后果不同：只认出 154820 一个，格式写完时只放行它，另两个照旧屏蔽，对 JSON 输出基本无害；一个都没认出，格式写完后结束编号仍被屏蔽，请求只能靠 max_tokens 这类不经过文法的停止条件收尾。

## 常见误解

- **"结构化输出是整个服务的开关。"** 它按请求开启。服务侧只决定用哪个后端、配不配 reasoning parser；请求不带约束，就完全不走这条路径。
- **"符合 schema 就说明内容对了。"** 它只保证格式。日期、金额、结论照样会错；请求被取消、触到长度上限或命中停止字符串时，连格式都写不完。
- **"bitmask 是在 NPU 上算的。"** 文法状态和 bitmask 都在 EngineCore 进程的 CPU 上；worker 只负责把它作用到 logits。在昇腾 V1 上，连"作用"这一步也是在 CPU 上做的。
- **"只有一个请求带 schema，昇腾只搬一行 logits。"** V1 搬的是这次调用的整张 logits，行数随批里的请求数和草稿位增长，8 张卡各搬一遍。
- **"100 微秒就是编译时间。"** 那是调度器每轮检查编译是否完成时的单次等待上限；编译本身在线程池里另外进行，耗时取决于 schema。
- **"不同 schema 要用不同后端，auto 能自动混用。"** 同一个后端可以服务任意多个 schema；反过来，一个引擎只能有一个后端，昇腾补丁会拒绝解析出另一个后端的请求。
- **"思考过程不受约束。"** 取决于配置。官方双机命令没有 reasoning parser，从第一个输出 token 起就受约束；配上 glm45 后，思考结束的下一步才开始约束。
- **"MTP 的 3 个草稿共用一行 bitmask。"** 每个草稿位置的前缀不同，各填一行；StructuredOutputManager 临时接受草稿、逐位置填完再回滚。
- **"异步调度遇到结构化输出就整体失效。"** 上一步 token 未确认时，本步的填表和整批采样要推迟，本部署 decode 阶段每一步都是这样；前向仍然提前派发。
- **"只有带 schema 的请求会变慢。"** 异步调度下推迟的是整批采样，同批不带约束的请求也要跟着等。
- **"打开 V2 就能在 NPU 上改 logits，而且 GLM 一定能用。"** V2 需要显式开启，开关只决定选哪个 runner；GLM、MTP 与图模式的组合是否兼容没有验证。

## 对照源码

### 怎么开

按请求开启，服务侧不需要额外参数。vllm-ascend 的用法与上游 vLLM 完全相同。请求里的写法：

| 写法 | 约束类型 |
| --- | --- |
| `response_format: {"type": "json_schema", ...}` | JSON schema |
| `response_format: {"type": "json_object"}` | 任意合法 JSON 对象 |
| 扩展字段 `structured_outputs` 的 `json` / `regex` / `choice` / `grammar` / `structural_tag` | schema、正则、固定选项、EBNF 或 Lark 语法、分阶段标签 |
| `tool_choice` 为 `"required"` 或指定函数 | 由工具解析器把参数 schema 转成 JSON 约束 |

服务侧可选项都在 `--structured-outputs-config` 里：`backend` 默认 `"auto"`，可设为 `xgrammar`、`guidance`、`outlines`、`lm-format-enforcer`；`enable_in_reasoning` 默认 `False`；`disable_any_whitespace` 只对 xgrammar 和 guidance 生效。`--reasoning-parser glm45` 会同时写进这个配置的 `reasoning_parser`。xgrammar 编译缓存上限由 `VLLM_XGRAMMAR_CACHE_MB` 控制，默认 512。切到昇腾 V2 runner 要设 `VLLM_USE_V2_MODEL_RUNNER=1`。

### 会报什么错

| 报错 | 在哪里 | 原因 |
| --- | --- | --- |
| `V1 structured outputs only supports one backend per engine. The engine is already using '...', but this request resolved to '...'` | 昇腾补丁：请求校验与 `grammar_init` | auto 下不同 schema 解析到不同后端；显式设 `backend` 即可避免 |
| `Request-level structured output backend selection is not supported.` | 上游 `SamplingParams` 校验 | 请求里自带 `_backend` 且与服务配置不同 |
| `Structured outputs requires a tokenizer so it can't be used with 'skip_tokenizer_init'` | 同上 | 服务以不加载分词器的方式启动 |
| `Failed to transform regex into a grammar: ...` | xgrammar 校验 | 显式指定 xgrammar 时，正则无法转成文法；auto 下这个错误被接住，改用 guidance |
| `Unsupported structured output backend: ...` | `grammar_init` | 后端名不在四个之内 |
| `Unexpected: grammar rejected tokens ... Terminating request.` | 调度器更新输出时 | 采样结果没被文法接受，请求被终止 |

### 开销和什么时候别开

开销分五处：CPU 编译文法（首次出现的 schema 最明显，缓存命中后很小）；EngineCore 主线程每步串行填 bitmask，本部署在开了 MTP 时每个请求填 4 行；昇腾 V1 每张卡整张 logits 往返 CPU；MTP 草稿被文法截短后，一步多推进的 token 变少；异步调度下整批采样要等上一步结果处理完才发出，同批不带约束的请求一起等。这几项在固定部署上各花多少时间都没有实测数，只能定性判断：受约束的请求越多、schema 越复杂，EngineCore 填表越可能比前向慢，采样就要等；批越大，V1 的 logits 往返越重。

不需要机器解析的输出，不要开；只是希望"大致像 JSON"，用提示词加事后校验更便宜。要约束最终答案又希望模型先思考，需要配 reasoning parser，否则思考段也会被约束。auto 下 schema 特性不统一的服务，先显式固定后端，免得被昇腾的单后端检查拒掉。

### 版本差异

| 项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| 分支 commit（vllm-ascend / vLLM） | `2c59ff10` / `0fc695fc` | `2ed6cbba` / `568afb3a` | `baa023ad` / `84030bbe` |
| 上游控制流 | 并行填表门槛 128，缓冲行数 = 请求上限 ×（1 + 草稿数） | 相同 | 相同 |
| V1 runner 施加 bitmask | logits 拷到 CPU、转 fp32、改完拷回 | 相同 | 相同 |
| V2 kernel 与默认值 | `worker/v2/structured_outputs.py`，默认不选 V2 | 相同 | kernel 移到 `ops/triton/v2/`，默认仍不选 |
| 单后端检查补丁 | 有，与执行快照 `db701c1f` 是同一份文件 | 有 | 有 |
| 其他结构化输出补丁 | 无 | 配 vLLM 0.26.0 时另外替换 `grammar_bitmask` 与 `should_advance`，按思考结束标记的位置处理边界 | 不再替换这两处；新增 outlines 文法写完后仍接受结束编号的修正 |

三版都是按请求开启、默认不选 V2、V1 在 CPU 上施加 bitmask。本页 GLM 的调用顺序按执行快照 `db701c1f` 与 `vllm@0fc695fc` 读；v0.26 的思考边界处理与 `0fc695fc` 的"结束那一步先不推进"细节不同，升级后要重新核对思考阶段的约束起点。

### 源码位置

按"谁定后端 → 谁编译 → 谁填表 → 谁施加 → 谁推进"读，能把本页流程对回实现。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 请求参数转换与后端选择 | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L579-L612`；`vllm@0fc695fc:vllm/sampling_params.py#L842-L972` |
| 单后端检查（昇腾补丁） | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L44-L134` |
| 管理器：线程池、编译、填表、思考边界 | `vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L39-L370` |
| 编译等待与约束类型 | `vllm@0fc695fc:vllm/v1/structured_output/request.py#L42-L98`；`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2205-L2210` |
| xgrammar 后端：词表大小、编译器、回滚 | `vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L36-L195` |
| 每步派发前向、填表、发起采样；异步推迟 | `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463`；`vllm@0fc695fc:vllm/v1/engine/core.py#L505-L596` |
| 整批"要等"标记；本部署异步调度的自动判定 | `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L35`（L27 对整批用或运算汇总）；`vllm@0fc695fc:vllm/config/vllm.py#L957-L1001`（MTP、未开 disable_padded_drafter_batch、多进程执行器 → 打开；启动日志 `Asynchronous scheduling is enabled.` 可直接确认） |
| 调度器挑行、推进文法、截断草稿 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1305-L1327`；`#L1462-L1475`；`#L1745-L1795` |
| 采样调用发给所有 worker | `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L319-L327` |
| worker 侧重排与施加 | `vllm@0fc695fc:vllm/v1/structured_output/utils.py#L44-L135`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2427` |
| V2 kernel 与 runner 选择 | `vllm-ascend@db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L19-L68`；`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20` |
| 收尾：停止检查、停止字符串中止 | `vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130`；`vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L681` |

**检索名称。** 管理器是 `StructuredOutputManager`，调度器入口是 `get_grammar_bitmask`，返回的 `GrammarOutput` 带请求 ID 列表和 `grammar_bitmask` 数组；worker 侧是 `sample_tokens` 里的 `apply_grammar_bitmask`，底层调用 xgrammar 的 `apply_token_bitmask_inplace`。编译等待的请求状态是 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR`；草稿截断用 `validate_tokens`，临时推进的回滚用 `rollback`。

**正文证据索引。** 官方命令不带结构化输出和 reasoning parser 参数、FAQ 的 glm45 配置与不能关思考见 [S1]；vllm-ascend 用法与上游相同见 [S33]；教学词表的分数和 token 是示意 [A]。auto 选择与请求级后端报错见 [C16]，四个后端与单后端对象见 [C3]，昇腾单后端检查见 [C26]；响应格式、工具调用转成约束和服务配置默认值依次在来源第 18、19、17 条。线程池、并行填表门槛与 external_launcher 见 [C2]；编译等待的 100 微秒与约束类型见 [C6]，等文法的请求状态在第 15 条；xgrammar 的词表大小、编译线程与回滚深度见 [C7]，缓存默认值在第 34 条。每步派发与填表时机见 [C10]，挑行规则在第 12 条；缓冲分配、串行填表、草稿临时推进与回滚见 [C4]；思考边界见 [C5]，glm45 的映射在第 20 条。采样调用发给所有 worker 见 [C21]，重排与施加见 [C9]，昇腾 V1 的 CPU 往返见 [C22]，V2 默认不选见 [C24]，kernel 在第 23 条。推进文法与拒绝时的报错见 [C13]，草稿截断与 −1 占位见 [C14]，异步推迟见 [C11]。收尾：文法终态填全 1 见 [C4]，vLLM 不向 xgrammar 传结束编号见 [C7]，停止检查与重复检测在第 38 条，停止字符串中止在第 39 条。版本差异表：v0.23、v0.26 的 V1 施加在第 27、28 条，v0.26 的思考边界补丁在第 29 条，main 的 V1、outlines 补丁、kernel 位置与 V2 默认值在第 30–32、37 条，上游 v0.26 与 main 的填表门槛和缓冲分配在第 35、36 条。

正文算式的推导口径：

- bitmask 一行 4840 个整数、19,360 B，整块 128 行约 2.36 MiB，由词表 154880、请求上限 32、草稿数 3 按"每 32 个编号一个整数"推得。[D]
- logits 往返的 1.18 MiB 与 37.8 MiB 取自主线底稿 03 §A5 的 bf16 logits 大小，fp32 副本按每数 4 B 翻倍。[D]

**待核：**

- 缺固定部署上的实测：编译耗时、每步填 bitmask 耗时是否超过前向、V1 logits 往返耗时、结构化请求对 MTP 接受率的影响、实际格式正确率，本页只做定性描述。
- 缺 xgrammar 源码或运行结果：154856–154879 这 24 个编号是否被文法一律屏蔽；xgrammar 从 GLM 分词器读出的结束编号是否覆盖 154820、154827、154829 三个。核实办法：在装有 xgrammar 的环境里，对固定 revision 的 GLM 分词器运行 `xgr.TokenizerInfo.from_huggingface(tok, vocab_size=154880)`，打印返回对象的 `stop_token_ids` 和 `special_token_ids`，两个问题一并回答。
- 缺官方命令下带 JSON schema 的实际输出：没有 reasoning parser 时思考段被约束，对答案质量的影响。
- 昇腾 V1 把 logits 搬到 CPU 施加 bitmask 的实际原因：源码注释说是上游用 torch.compile、昇腾不支持，但固定上游的 `apply_grammar_bitmask` 已不含 torch.compile（`vllm@0fc695fc:vllm/v1/structured_output/utils.py#L109-L135`）；需要确认 xgrammar 的 `apply_token_bitmask_inplace` 能否直接处理 NPU 张量。
