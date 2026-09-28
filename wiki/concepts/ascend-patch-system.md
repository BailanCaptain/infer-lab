---
id: ascend-patch-system
title: "Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类"
type: feature
summary: patch 是 vllm-ascend 在进程里把上游模块中的名字改指向昇腾实现的做法。global patch 在平台注册时打、前端和 EngineCore 先用到；worker patch 在 Worker 启动时打；同一进程只真正执行一次。GLM 双机上逐项列出哪些 patch 被导入、哪些真在请求路径上执行，并对照 v0.23 / v0.26 / main 的清单增删。
aliases: [patch, adapt_patch, monkey patch, patch/platform, patch/worker, 补丁机制, 猴子补丁, 运行时替换, 全局补丁, Worker 补丁, is_global_patch, global patch, worker patch, _ensure_global_patch, 运行时适配, 运行时适配：补丁、模型注册与算子替换, 补丁幂等]
chapters: ["10"]
order: 90
sources:
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L189
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L130
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L16-L57
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L16-L89
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L24
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L17-L27
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L7-L13
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L72-L75
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2580-L2598
  - vllm@0fc695fc:vllm/plugins/__init__.py#L69-L82
  - vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L230-L253
  - vllm@0fc695fc:vllm/v1/engine/core.py#L45-L52
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L811-L830
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L31-L64
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L228
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L154
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L37-L37
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L461-L531
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L7-L60
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L85-L98
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L268-L268
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_cudagraph.py#L6-L38
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L756-L769
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_rejection_sampler.py#L1-L9
  - vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L221
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2127-L2136
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L710-L715
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3783-L3787
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_pp_mtp.py#L72-L84
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_distributed.py#L88-L89
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L610-L616
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L16-L57
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/__init__.py#L16-L89
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/__init__.py#L16-L60
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/__init__.py#L16-L76
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L165-L178
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/__init__.py#L16-L55
  - vllm-ascend@baa023ad:vllm_ascend/patch/worker/__init__.py#L16-L83
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L27-L59
  - vllm-ascend@baa023ad:vllm_ascend/__init__.py#L52-L99
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_torch_accelerator.py#L1-L16
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_mamba_utils.py#L185-L191
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_triton.py#L12-L19
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L18-L31
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_qwen3_next_mtp.py#L9-L50
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3936-L3952
  - vllm@0fc695fc:vllm/v1/worker/utils.py#L494-L512
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_tool_choice_none_content.py#L30-L87
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py#L123-L145
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L75-L134
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: platform-plugin-registration, kind: builds-on, note: 插件怎样被发现、四个通用入口里哪三个先补 global patch，在那一页}
  - {to: request-call-chain, kind: builds-on, note: 第 2 站调度器上被换过的五处，以及 traceback 里 patch 帧属于哪一站}
  - {to: npu-platform, kind: builds-on, note: 平台准备钩子 pre_register_and_update 属于 NPUPlatform}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: 逻辑块 640 与 KDA 块 133120 的推导，由 patch 过的函数算出}
  - {to: balance-scheduling, kind: builds-on, note: 被 patch 换上的 BalanceScheduler 在本部署关着时做什么}
  - {to: linear-attention, kind: builds-on, note: KDA 的数学机制；设备实现走 CustomOp 登记，不走 patch}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 昇腾怎样把 vLLM 里的函数换成自己的？

先看 Python 怎样找到一个函数。一个模块（一个 .py 文件导入后的对象）里有一张「名字 → 对象」的表；代码写 `模块.名字` 时，每次都现去这张表里查。把表里某个名字改成指向另一个函数或类，此后再按这个名字去查的代码，拿到的就是新的那个。这种在程序运行起来以后改名字指向的做法，通常叫 **monkey patch**；它改的是当前进程内存里的表，磁盘上的上游源文件一个字都没动。

**patch（补丁）就是 vllm-ascend 在进程里把上游 vLLM 模块中的某个名字改指向昇腾自己的函数或类；之后凡是按这个名字去取实现的代码，执行的都是昇腾版本。**

```wiki-diagram
file: patch-binding
```

替换发生在请求到来之前的两个时间点，每个时间点换一类名字：

- **① 平台注册时，打 global patch。** vLLM 解析启动参数、选定昇腾平台时，昇腾导入 patch/platform 目录，把前端和 EngineCore（负责调度、指挥各 Worker 干活的引擎核心进程）在 Worker 出生之前就要用的名字换掉：配置校验、KV cache 分组、调度器类、引擎入口函数等。图左边的例子是调度器：上游的 Scheduler 这个名字被改指向 BalanceScheduler。本部署的均衡调度开关关着，BalanceScheduler 的 schedule 第一行就交回上游：名字换了，行为没变（见[下文](#落到-glm-双机哪些-patch-真的起作用)）。
- **② Worker 启动时，打 worker patch。** 每个 Worker（守着一张 NPU、执行模型的进程）被构造时，第一件实质工作就是导入 patch/worker 目录，换掉只在 Worker 里用到的名字：通信组的类、权重加载后的处理、图尺寸的判断、采样用的函数等。图右边的例子是通信组：上游的 GroupCoordinator 被改指向补上了 all_to_all（每张卡给其余每张卡各发一份不同数据的集合通信，见 [All-to-All](collective-communication.md#all-to-all)）的 GroupCoordinatorPatch。

表是每个进程各有一份的：在前端进程里改了，EngineCore 和 Worker 进程里的同一个名字并不跟着变，所以每个进程都要各打一遍。补丁怎样送进每个进程，归[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)讲。

## 为什么非打 patch 不可，代价在哪

vLLM 给硬件厂商留了几处正式的扩展点：装上一个平台插件，vLLM 就把「在什么设备上跑、用哪个 Worker、用哪套注意力后端」这些问题交给它回答；标成 CustomOp 的层允许插件登记自己的实现；模型注册表允许插件把一个架构名映射到自己的模型类。插件怎样被 vLLM 发现、过滤、激活，见[平台注册](platform-plugin-registration.md#发现过滤激活)。

但扩展点只覆盖上游事先想到的地方。GLM 双机上，KV 池以 **640 个 token** 为一个逻辑块来分配，这个数不是用户设的，也不来自任何扩展点：它由上游一个校验混合模型配置的函数算出来，而那个函数在昇腾上已经被 patch 换成了昇腾版本，推导见[双机部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。同样，vLLM 0.23.0 认定「哪些模型按 [MLA](mla.md)（把 K、V 先压成一个小的潜向量再缓存的注意力）解析」的名单里没有 GLM-5.3-Flash 的配置类型，名单也没留登记口子，昇腾只能在 patch 里把自己的转换器塞进上游的转换器表。上游没留口子、又必须改的地方，只剩 patch 这一条路。

| 机制 | 上游留没留口子 | GLM 双机上的例子 |
|---|---|---|
| 平台插件 | 留了：安装元数据里的平台入口 | vLLM 选中 NPUPlatform |
| CustomOp 登记 | 留了：插件登记同名实现 | KDA 层换成 AscendKimiGatedDeltaNetAttention |
| 模型注册 | 留了：模型注册表 | Glm5NextForCausalLM 等架构名映射到昇腾模型类 |
| patch | 没留：直接改上游模块里的名字，或往上游的登记表里塞条目 | 逻辑块大小、KV 分组、调度器类、GLM 配置类型 |

表里最后一行有两种动作。多数 patch 是「改指向」：把上游的函数、类或方法换掉。少数是「塞条目」：GLM 的配置 patch 往 transformers 的配置类型表和 vLLM 的架构转换器表里各加几条，让解析器认得 glm5_next，并凭 kv_lora_rank 是否存在判定按 MLA 解析。两种动作都写在 patch 目录的文件里，都在导入那个文件时执行。CustomOp 登记和模型注册则分别发生在 Worker 构造和通用插件入口里，不属于 patch；GLM 的层型与计算连接见[模型介绍](glm-5-3-flash.md)，KDA 的数学机制见[线性注意力](linear-attention.md)。

代价有四条，都来自「只改一个进程里的一个名字」这个做法本身：

1. **只对当前进程有效。** 一台机器上有前端、EngineCore、每卡一个 Worker 这几类进程，每个进程要各自打一遍；前端打过了，不能推断 Worker 里也换好了。
2. **只改模块表里那一个名字，已经复制走的引用不变。** 上游的 EngineCore 模块在导入时就用 from-import 把「算调度器块大小」的函数复制成了自己模块里的名字，所以昇腾的 KV 分组 patch 在末尾专门把 EngineCore 模块里那一份也改掉；权重加载后处理的 patch 同样改了两个模块里的同名引用。类也一样：一个子类如果在替换之前就定义好了，它的父类仍是原来那个类。第 2 站用到的异步调度器类的父类到底是哪一个，[调用链页的源码位置](request-call-chain.md#源码位置)记为待核。
3. **和上游版本咬死。** patch 依赖上游的函数名、参数和对象结构；上游改名或重构后，旧 patch 要么换了一个没人再调的名字，要么在导入时就报错。所以两个目录的入口文件按 vLLM 版本号挑选要导入的文件。
4. **不在调用链里露面。** 改名字的赋值在启动时就做完了，每次推理的调用栈里看不到「替换」这一步；被换上的函数真正执行时，traceback 显示的是它实际所在的文件，也就是 vllm_ascend/patch/ 下的某个文件。反过来，搜不到某个上游函数的 patch，也不能说明行为就是上游原样：派生类、模型注册、后端选择和 CustomOp 分派都能改掉执行路径，完整的定位路线见[怎么读这个仓库](reading-vllm-ascend.md)。

vllm-ascend 的官方设计文档对 patch 的态度很直白：patch 不是让昇腾兼容 vLLM 的好办法，只是临时方案，最好的做法是把改动贡献回 vLLM；原则三条——能不打就不打（Less is more）、加了 patch 就必须写清将来怎么移除、任何时候清理 patch 都欢迎。为此 patch 目录的说明文件要求每加一个 patch 都登记四项：为什么改（Why）、怎么改（How）、上游有没有对应改动（Related PR，没有要说明原因）、何时移除（Future Plan）。所以 patch 的数量本身说明不了什么，要连着每条的 Related PR 和 Future Plan 一起看。

## 两类 patch 各在什么时候、哪个进程里生效

patch 没有开关，也没有运行时的登记表：它靠「导入一个文件时，文件里的语句会被执行一遍」生效。两个目录各有一个入口文件，入口文件按条件逐个导入 patch 文件，每个 patch 文件在自己的末尾写赋值语句完成替换。所以「打了哪些 patch、按什么顺序打」，就是入口文件里导入语句的条件和先后。把导入分流到两个目录的，是一个只有四行的函数 adapt_patch：参数 is_global_patch 为真就导入 patch/platform，否则导入 patch/worker。

```wiki-diagram
file: patch-timing
```

**global patch 有两个入口。** 一个是平台准备钩子：vLLM 在解析命令行参数、建配置时调用 NPUPlatform 的这个钩子，钩子第一行就调 adapt_patch 打 global patch。它只在执行 vllm serve 的那个进程里跑，也就是 node0 的 API server，以及 node1 上带 headless 参数的启动进程。另一个是通用插件入口：vLLM 在前端解析参数时、EngineCore 初始化时、Worker 初始化时各加载一次通用插件；vllm-ascend 注册的四个通用入口里，连接器、加载器、采集三个的第一件事都是确认本进程打过 global patch，没打过就打，模型入口不打，见[平台注册页](platform-plugin-registration.md#三个通用入口先补一次全局补丁)。

需要第二个入口，是因为 EngineCore 进程既不解析命令行也不建配置，走不到平台准备钩子，而调度器恰好就在 EngineCore 里。有了它，本部署的 API server、两个 EngineCore、16 个 Worker 进程里都有 global patch。

**worker patch 只有一个入口：NPUWorker 的构造函数。** 构造函数的第一件实质工作就是调 adapt_patch 打 worker patch（在它前面只有一条编译告警检查），之后才登记昇腾的 CustomOp、建本进程的 Ascend 配置，最后才初始化上游的 Worker 基类。排在最前面，是因为后面这些步骤以及随后的建通信域、加载权重，用到的已经是被换过的上游代码：比如通信组对象要在构造之后的设备初始化里才建，建的时候 GroupCoordinator 这个名字必须已经指向昇腾的类。本部署 16 张卡、16 个 Worker 进程，worker patch 一共打 16 遍；整个服务只有一张卡时，Worker 是 EngineCore 进程里的一个对象，worker patch 就打在 EngineCore 进程里。

| | global patch | worker patch |
|---|---|---|
| 谁触发 | 平台准备钩子；三个通用插件入口 | NPUWorker 构造函数开头 |
| 本部署在哪些进程 | API server、2 个 EngineCore、16 个 Worker | 16 个 Worker |
| 换哪类名字 | Worker 出生前就要用的：配置校验、KV 分组、调度器、引擎入口 | 只在 Worker 里用的：通信组、权重后处理、图尺寸、采样 |

两类的区别在**时机和进程**，不在改的对象种类：两个目录里都有叫 patch_distributed 的文件，platform 下那个在 310P 芯片上改 PyTorch 的集合通信函数，worker 下那个换 vLLM 的通信组类。

两个目录也不是全部入口。还有少数 patch 由别处按配置导入：检查配置时，只有打开 profiling 分块功能才导入对应的 patch；model runner 加载 EAGLE-3 草稿模型且流水线并行大于 1 时，才调另一个 patch 函数。判断某个 patch 在不在，要从调用入口一路核到条件分支，文件在目录里并不够。每个进程从哪个入口拿到补丁、fork 和 spawn 两种启动方法下子进程是否带着父进程已换好的名字，归[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)讲；动态 EPLB 为什么要靠环境变量在 global patch 里换掉多进程执行器，见[同页后文](engine-processes.md#进程怎么摆直接决定要打哪些补丁)。

## 同一个进程里，global patch 为什么只打一遍

在 API server 这一个进程里，要求打 global patch 的调用至少有四次：解析参数时 vLLM 先加载通用插件，三个通用入口各要一次；随后又调平台准备钩子，再要一次。可替换语句在一个进程里只执行一遍，这叫**幂等**（同一件事做多次，结果和做一次一样）。它由三层保证，从外到内：

1. **vLLM 的插件加载函数带一个进程级标记。** 同一进程里第二次加载通用插件时直接返回。vLLM 在这个函数的注释里也明说：插件会在不同进程里被加载多次，必须经得起重复加载。
2. **_ensure_global_patch 带一个模块级标记。** 三个通用入口都通过它打 global patch；标记已置就返回，所以三个入口里只有先到的那个真正去调 adapt_patch。
3. **Python 的导入缓存。** adapt_patch 做的只是「导入 patch/platform」。一个模块在一个进程里只在第一次导入时执行，之后的导入直接取缓存里的模块对象。平台准备钩子直接调 adapt_patch、不经过上面那个标记，它不会重打一遍，靠的就是这一层。

所以在启动进程里，真正执行替换的是先到的通用插件入口，后到的平台准备钩子只是空走一趟。worker patch 在一个 Worker 进程里只由构造函数调一次，同样受导入缓存保护。

幂等要紧，是因为很多 patch 的写法是「先存下原函数，再换成自己的，遇到不归自己管的情况转回原函数」。KV 协调器的 patch 就是这样：先把上游的工厂函数存成一个私有名字，再把上游的名字改指向昇腾的工厂，某些缓存布局之外的情况回落到存下的原函数。这段代码若在同一进程里跑第二遍，存下的「原函数」已经是昇腾版本，兜底时转回的就不再是上游，而是昇腾自己。有些 patch 文件还自带一道保险：流水线并行与 MTP 的 patch 用模块级标记挡住重复执行，Worker 侧通信 patch 给包装过的函数打记号，投机解码配置的 patch 先检查 glm5_next_mtp 是否已在类型表里再追加。

这些标记都是**进程里的变量**。「只打一遍」说的是一个进程之内；换一个进程，标记从头开始，该打还得打。spawn 起的子进程从全新的解释器开始，标记是初始值；fork 起的子进程复制了父进程内存，标记和换好的名字一起带过来，所以 vLLM 的插件加载函数在那里直接返回，通用入口根本不会被调用。

## 落到 GLM 双机：哪些 patch 真的起作用

**本部署的前提决定了入口文件走哪条分支。** 官方双机是两台 Atlas 800 A2（不是 310P 芯片），配 vLLM 0.23.0，教程的启动命令没有设动态 EPLB 的两个环境变量，也没有设 v2 model runner 的环境变量；部署前提见[双机部署页](glm-5-3-flash-two-node.md#部署前提)。GLM 的稀疏注意力索引器走 Triton 内核，说明环境里装了 Triton。按这些条件逐行过两个入口文件：

- **patch/platform 目录 28 个文件，导入 23 个。** 没导入的 5 个：310P 专用的块大小 patch；只在两个 EPLB 环境变量打开时才导入的多进程执行器 patch；只在 vLLM 不是 0.23.0 时才导入的两个（FusedMoE 与 DP 设备号）；以及不经入口文件、由配置检查按需导入的 profiling 分块 patch。
- **patch/worker 目录 24 个文件，导入 19 个**，装了 npugraph_ex 时再多 1 个。没导入的：310P 专用的一个；vLLM 不是 0.23.0 时才导入的 FusedMoE 一个；v2 model runner 可用时才导入的专家捕获一个；只由 model runner 在 EAGLE-3 加流水线并行时调用的一个。
- **patch/worker/patch_v2 子目录 7 个文件，只导入 1 个。** 在 vLLM 0.23.0 上 v2 model runner 被判为不支持，这一组整体不导入；唯一导入的那个只是在 Worker 进程里再导入一次 global patch 里的同名文件。

**导入了，不等于在请求路径上执行了。** 导入只说明替换发生了；被换的名字有没有人来调、调到以后走不走新分支，要沿主线逐站核。下表是 global patch 里落在 GLM 启动和[第 2 站调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)上的九项，都在 EngineCore 或启动进程里生效：

| patch 文件 | 换掉或登记了什么 | 在哪一步用到 | 本部署的效果 |
|---|---|---|---|
| glm5_next_config | 往配置类型表和架构转换器表登记 glm5_next 等 | 启动时解析模型配置 | vLLM 0.23.0 由此认得 GLM，并按 MLA 解析 |
| speculative_config | 草稿配置的改写函数；MTP 类型表加 glm5_next_mtp | 建 MTP 草稿配置 | GLM 的草稿配置被改成 glm5_next_mtp 类型，才能找到昇腾的 MTP 类 |
| mamba_config | 混合模型的配置校验函数 | 建配置 | 逻辑块 640 token，KDA 组的块 133120 token |
| use_v2_model_runner | 配置里「用不用 v2 model runner」的判断 | 选 model runner | 只看环境变量，没设就用 v1 的 NPUModelRunner |
| kv_cache_utils | KV 分组、块大小解析等一组函数，连 EngineCore 模块里 from-import 的那一份 | EngineCore 初始化、切 KV 块 | 按 GLM 的布局分组；调度器的块取各组的最小公倍数 133120 |
| kv_cache_coordinator | KV 协调器的工厂函数 | 建 KV 管理器 | 某些缓存布局返回昇腾的协调器，其余回落原函数；GLM 落在哪一支待核 |
| mamba_manager | KDA 状态组的管理器类 | 第 2 站分配 KV 块 | 换成 AscendMambaManager，改的是前缀命中与外部 KV 的分支 |
| glm5_next_mamba_scheduler | 调度器按状态存档点对齐切 token 的方法 | 第 2 站 | 替换发生，但只在 align 缓存模式下才调用；本部署是 none，不执行 |
| balance_schedule | 调度器类这个名字；EngineCore 进程的入口函数 | 起 EngineCore、第 2 站 | 替换发生；均衡调度开关关着，两者都直接转给原来的实现 |

后五行就是[调用链页](request-call-chain.md#源码位置)统计的「第 2 站被换过的五处」：KV 分组、KV 协调器、KDA 状态管理器、对齐切分、调度器类与引擎入口。其中对齐切分与 BalanceScheduler 两处在本部署下不改变行为：前者因为缓存模式是 none 根本不被调用；后者的 schedule 开关关着时第一行就交回上游，引擎入口函数也直接转给原函数（v0.23 维护分支的这一行多一个条件，见[版本差异](#版本差异)）。开关打开后它怎样调度，见 [Balance Scheduling](balance-scheduling.md)。开了异步调度时，每步用的调度器类是否经过 BalanceScheduler，取决于异步调度器类定义时它的父类已不已经被换掉，这是上文提到的那条待核。逻辑块 640、调度器块 133120 的推导不在本页重算，见[双机部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。

worker patch 里落在 GLM 请求路径上的有五项，在每个 Worker 进程里生效：

| patch 文件 | 换掉了什么 | 在哪一步用到 | 本部署的效果 |
|---|---|---|---|
| process_weights_after_loading | 权重加载后的处理函数，两个模块里的同名引用都换 | 启动时加载权重的最后一步 | 比上游多认 GLM 的 MLA 层，把权重转成昇腾要的排布 |
| distributed | 通信组类 GroupCoordinator；销毁分布式环境的函数 | 建通信域 | 经上游建组函数建出的通信组（本进程的全局组与 TP、DP、EP 组）都是补丁类，它补上了 all_to_all |
| qwen3_next_mtp | 把 KV 张量绑到各注意力层的函数 bind_kv_cache | 启动时建 KV 张量 | 上游版本在 NPU 上遇到同一层号挂着多个注意力层名会直接抛错，换成不抛的版本；文件名带 Qwen3-Next，GLM 一样经过它 |
| cudagraph | 图调度器里「按 token 数算图尺寸描述」的方法 | 每一步选图尺寸 | 改了图模式为 FULL 时对均匀 decode 批的判断 |
| rejection_sampler | 上游拒绝采样模块里的三个函数 | 第 5 站 MTP 验证 | 替换发生，但 GLM 用的 AscendRejectionSampler 重写了 forward，直接调昇腾自己的函数，不经过被换的名字 |

最后一行是另一种情况：patch 和派生类并存时，走的可能是派生类。昇腾的拒绝采样器是上游类的子类，它的 forward 调的是自己模块里的函数，所以上游模块里那三个名字换没换，都不影响这条路径。

API server 这一侧，还有三项 global patch 挂在 chat 请求的必经之路上，但只在特定内容出现时才改变结果：chat 响应对象的序列化方法被换过，每个 chat 响应（流式和非流式）在[第 7 站](one-request.md#第-7-站-返回与收尾)序列化时都经过它，它把空的 tool_calls 列表删掉，让 OpenAI 兼容客户端看到的是「没有工具调用」而不是一个空列表；流式 chat 的生成器被包了一层，每条流式请求都经过，只有工具调用最后几块参数才被拆开重发；采样参数的结构化输出校验也被包了一层，请求不带结构化输出时原样返回。

其余导入了的 patch，按和 GLM 请求路径的关系分四种：

- **给别的模型用的。** MiniMax、Qwen 系列（上表的 qwen3_next_mtp 除外）、Kimi-K2.5 视觉部分、DeepSeek 的 MTP 与权重加载、EAGLE-3 与 DFlash 草稿、GQA 量化等 patch，换的都是那些模型的类；GLM 用的是昇腾自写的 AscendGlm5Next 系列模型类和 AscendGlm5NextMTP，不经过它们。Triton patch 里换 vLLM 自带 GDN 与卷积内核的那几行也属于这一类：GLM 的 KDA 层调的是昇腾自己的内核。同一个文件还给 Triton 模块塞了一个 next_power_of_2 函数，因为 torch_npu 自带的 Triton 缺这个函数，而上游和昇腾代码有很多处调它；这一条对所有用到它的 Triton 代码都生效。
- **给没开的功能用的。** 工具调用解析器（GLM-4.7、DeepSeek-V4、MiniMax-M2 三种）只在启动命令指定了解析器时才被用到，官方教程只在 FAQ 里给出带解析器的写法，双机启动命令没有；MiniMax 的用量统计只绑在 MiniMax 的服务对象上；睡眠模式的显存分配器、强化学习的权重同步、KDA 状态拷贝工具，分别要开睡眠模式、权重同步、align 缓存模式才走到。
- **是否经过还没核清。** 装了 npugraph_ex 才导入的那个 patch 改的是另一套图编译器的内部结构；global patch 里把 torch.accelerator 的四个显存函数（释放缓存的 empty_cache，查询用的 memory_stats、memory_reserved，重置峰值统计的 reset_peak_memory_stats）转到 torch.npu 的一个、把上游 MLA prefill 后端选择函数换成昇腾后端的一个，替换都无条件发生，但 GLM 路径上有没有代码调到它们，见页末待核。
- **条件在 patch 内部。** platform 下的 patch_distributed 被导入了，但只有检测到 310P 芯片才替换，在 A2 上什么也不换。流水线并行与 MTP 的校验 patch 确实换掉了模型配置的并行校验方法，建草稿配置时也会被调用，但只在流水线并行大于 1 时改动校验，本部署流水线并行为 1，直接转回原方法。

## 排查时，怎样确认跑的是哪一份代码

读到一个上游函数，想知道昇腾上执行的是不是它，按三步核：

1. **先认进程。** 出问题的那一帧在前端、EngineCore 还是 Worker 里，决定了该看 global patch 还是 worker patch 有没有生效；前端里换好了，不能推断 Worker 里也换好了。按调用栈认进程的办法见[引擎有哪几个进程](engine-processes.md#排查时先认是哪个进程)。
2. **再看调用方怎样拿到这个实现。** 每次调用都按「模块.名字」现查的，patch 改了就生效；导入时就用 from-import 复制走的，要看 patch 有没有把那一份也改掉；从注册表取的、调派生类方法的、经 CustomOp 分派的，结果由登记和继承决定，和 patch 无关。
3. **最后核 patch 本身的条件。** 在 patch 目录里搜这个上游名字：搜到了，先看入口文件在本部署的条件下导没导入它，再看 patch 函数里有没有「条件不满足就转回原实现」的分支；搜不到，再找昇腾有没有派生类、注册项或 CustomOp 登记；都没有，这一段才是上游原样。

运行起来以后，最直接的证据是 traceback：被换上的函数执行时，那一帧的文件路径就在 vllm_ascend/patch/ 下，[调用链页](request-call-chain.md#出问题时判断它停在哪一站)把这些帧仍算作它们所在的那一站。也可以在出问题的那个进程里打印这个名字当前指向的对象属于哪个模块，一眼就能看出换没换。

## 常见误解

- **「patch 目录里的文件都生效了」**——不是。两个入口文件按芯片、vLLM 版本、Triton、环境变量分支导入，没导入的等于没打。本部署 platform 目录 28 个只导入 23 个，worker 目录 24 个只导入 19 个。
- **「导入了，请求就一定走新实现」**——不一定。对齐切分的 patch 因为缓存模式是 none 根本不被调用；BalanceScheduler 的开关关着，schedule 第一行就交回上游；拒绝采样的 patch 换了上游模块里的函数，GLM 走的昇腾子类却不调它们。
- **「global patch 和 worker patch 改的是不同种类的东西」**——区别在时机和进程，不在对象种类。两个目录都有同名的 patch_distributed 和 patch_fused_moe 文件，改的东西各不相同。
- **「_ensure_global_patch 保证全局只打一次」**——它只管同一个进程，标记是进程里的一个变量，每个进程各有一份；而且平台准备钩子不经过它，那一路不重打靠的是 Python 的导入缓存。
- **「patch 只在两个时间点发生」**——两个目录是主要的两个时机，不是全部：profiling 分块的 patch 在检查配置时按开关导入，EAGLE-3 加流水线并行的 patch 由 model runner 在加载草稿模型时调用。
- **「改了模块里的名字，所有调用都跟着变」**——早先用 from-import 复制走的引用、早先定义好的子类的父类，都不跟着变；所以有的 patch 要同时改好几个模块里的同名引用。
- **「补丁越多，说明代码越差」**——规范要求每条 patch 登记上游关联和移除计划，登记了的条目里相当一部分是在等上游合入改动，例如图尺寸判断那一条就写明等 vLLM 合入对应的修复后移除。判断要看这两项，不是看总数；本版本的登记清单还漏了几条，见源码位置。
- **「官方设计文档说 EngineCore 进程默认打不了 patch」**——设计文档的限制一节确实这么写，但固定版本的代码已经靠三个通用插件入口在 EngineCore 进程里打上 global patch，第 2 站的调度器替换就是这样生效的；以代码为准。

## 对照源码

### 怎么开

patch 没有总开关，也没有逐条的开关：导入即生效。能改变「导入哪些文件」或「导入后走不走新分支」的只有下面这些条件，括号里是本部署的取值。

| 条件 | 影响什么 | 本部署 |
|---|---|---|
| `is_310p()` | 块大小 patch 用哪一版；Qwen 系列 patch 与 310P 索引 patch 二选一；platform 下 patch_distributed 是否真替换 | 否（A2） |
| `vllm_version_is("0.23.0")` | GLM-4.7 与 MiniMax-M2 工具调用解析、MiniMax 用量统计三个 patch 导入；FusedMoE、DP 设备号两个 patch 反过来不导入；patch_v2 组整体跳过 | 是 |
| Triton 可用（`HAS_TRITON`） | worker 下 patch_triton 是否导入 | 是 |
| 环境变量 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` | 多进程执行器 patch 是否导入 | 未设 |
| 环境变量 `VLLM_USE_V2_MODEL_RUNNER` | 被 patch 过的 use_v2_model_runner 直接返回它；未设返回 False | 未设 |
| `enable_balance_scheduling` | BalanceScheduler 和引擎入口是走均衡逻辑还是转回原实现；依次读 Ascend 配置、additional_config、环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING` | 关 |
| `profiling_chunk_config.enabled` | 检查配置时是否导入 profiling 分块 patch，并换调度器类 | 关 |

版本判断先读环境变量 `VLLM_VERSION`，没设才取已安装 vLLM 的版本号。想确认某个进程里到底打了什么，要在那个进程里查：`sys.modules` 里有没有 `vllm_ascend.patch.platform.patch_xxx`，以及被换的名字当前指向的对象的 `__module__`，例如调度器类指向 `vllm_ascend.patch.platform.patch_balance_schedule` 就说明 global patch 已在本进程生效。

### 会报什么错

- **patch 文件导入时抛异常，整个进程起不来。** vLLM 加载通用插件时逐个调用入口函数，不包 try；patch 在导入时出错，错误就出在当时加载它的那个进程里（API server、EngineCore 或 Worker）。一类典型原因是上游改了被换的名字，patch 在替换前读取原对象时报 AttributeError。KV 分组 patch 为此对两个名字先用 hasattr 判断再替换，因为 vLLM 的不同发布版用过这两个名字。
- **vLLM 版本识别错，导入了错的一边。** 设计文档的限制一节提醒：运行改过的 vLLM 时版本号可能被自动改成带后缀的形式，`vllm_version_is` 判断失败，按版本二选一的 patch 就会导入错的一边；此时设环境变量 `VLLM_VERSION` 指定版本。
- **某个 worker patch 没打上。** 例如绑定 KV 张量的函数，上游版本在非 CUDA、XPU、CPU 平台上遇到同一层号挂多个注意力层名时抛 `NotImplementedError`；Worker 进程里看到这个错，先查 worker patch 是否在本进程生效。
- **设计文档与代码不一致。** 设计文档限制一节仍写着默认只能 patch 主进程和 Worker 进程，要改 EngineCore 需整体覆写；固定版本的代码已经通过 `_ensure_global_patch` 在 EngineCore 进程打 global patch，以代码为准。

### 开销和什么时候别开

运行时开销很小：替换在启动时一次做完，只是导入几十个文件、改几十个名字；之后按名字查找本来就要查，换没换都是一次查表。包装型 patch 每次调用多一层函数调用和一次条件判断，例如 BalanceScheduler 的 schedule 先判断开关再交回上游。

真正的代价在维护和排查：patch 和上游版本咬死，升级 vLLM 时每一条都要按新的函数名、参数、对象结构重核；请求路径上看不到「替换」这一步，出问题时要按上文三步去核。patch 不能单独关掉，只能改入口文件，而其中不少是正确运行的前提：去掉 GLM 配置登记、权重后处理、绑定 KV 张量这几条，对应环节就回到上游行为，而上游行为正是这些 patch 要绕开的。换 vLLM 版本、换芯片型号或打开 EPLB、v2 model runner 等功能后，本页的导入清单要按新条件重核。

### 版本差异

「本部署」是 GLM 专用镜像 `db701c1f`，它不是社区 v0.23 维护分支的某个提交；三个社区分支的钉点与 vLLM 配套版本见[来源基线](../sources/glm-5-3-flash-baseline.md)。

| 项 | 本部署 `db701c1f` | v0.23 `2c59ff10` | v0.26 `2ed6cbba` | main `baa023ad` |
|---|---|---|---|---|
| 入口机制：adapt_patch 分流、平台准备钩子、三个通用入口经 `_ensure_global_patch`、NPUWorker 构造开头 | 有 | 相同 | 相同 | 相同 |
| patch 文件数：platform / worker / patch_v2 | 28 / 24 / 7 | 28 / 24 / 7 | 31 / 24 / 9 | 28 / 19 / 13 |
| 入口文件的导入条件 | 310P、vLLM 0.23.0、Triton、EPLB 环境变量 | 同本部署 | 不再判断 vLLM 版本，只剩 310P、Triton、EPLB 环境变量；patch_v2 组不再整体跳过 | 310P 判断换成硬件能力表（`STANDARD_MAMBA_PATCH`、`STANDARD_WORKER_PATCHES`）；Triton、EPLB 环境变量不变 |
| GLM 专用 patch | `patch_glm5_next_config`、`patch_glm5_next_mamba_scheduler` | 无 | 无 | `patch_glm5next_config`；对齐切分改由 `patch_mamba_block_aligned_split` 换 |
| 调度器类被换成 | BalanceScheduler，父类是上游 Scheduler | BalanceScheduler，父类是上游 Scheduler；直通条件多一个：PD 分离的 P 节点（`kv_producer`）上即使均衡开关关着也不回上游，改走禁抢占分支 | 两层：先换成 KVDeliveryScheduler，BalanceScheduler 再从它派生；开关关着时走 KVDeliveryScheduler 重写的 `schedule()`，不回上游 | BalanceScheduler，父类是上游 Scheduler；替换 EngineCore 入口函数挪到 `patch_engine_core` |

文件清单的增删（按三个分支的文件列表逐一对照）。表里的文件数只数 `patch_` 开头的文件，不含 `__init__.py` 和辅助模块：v0.26 的 platform 目录另有 5 个 `kimi_k3_` 开头的辅助模块，worker 目录各版本都另有一个 `_hccl_pg_registry.py`。

- **本部署 vs v0.23**：文件数相同，内容不同。本部署多了两个 GLM 专用 patch；少了 `patch_async_swa_kv_lifetime`、`patch_shm_broadcast`，这两个在 v0.23 里都挂在 vLLM 0.23.0 分支下。worker 与 patch_v2 两组的文件名完全一致。同名的 `patch_balance_schedule` 内容也不同：v0.23 在 vLLM 0.23.0 且 KV 传输角色是 `kv_producer`（PD 分离的 P 节点）时禁止抢占，所以 schedule 第一行的直通条件是「均衡开关关着且不在 P 节点」，P 节点上即使开关关着也不交回上游，而是走 BalanceScheduler 自己的调度循环，块不够时停下而不是抢占别的请求；本部署的这份没有这段逻辑，开关关着就一律交回上游。
- **v0.23 → v0.26**：platform 去掉 7 个（`patch_async_swa_kv_lifetime`、DeepSeek-V4 / GLM-4.7 / MiniMax-M2 工具调用解析、GLM 工具调用流式、MiniMax 用量统计、tool_choice 为 none 时的内容），新增 10 个（异步调度、DeepSeek-V4 思考与工具流式、GLM 推理用量统计、Kimi-K3 解析与渲染、`patch_kv_delivery_preemption`、多模态连接器、重算对话、停止 token 校验）；worker 去掉 `patch_gqa_c8`（GQA 量化）与 `patch_weight_utils`（加载权重时借用 DeepSeek-V2 模块里的 KV scale 名称改写函数；`patch_deepseek_v2` 本身在 v0.26 仍在），新增 MoE runner 与 Step3.5；patch_v2 新增 DFlash 与 EAGLE 两个投机草稿器。
- **v0.23 → main**：platform 去掉 10 个（v0.26 去掉的那 7 个 main 上也都没有，另外还去掉了 `patch_shm_broadcast`、睡眠模式分配器、权重同步），新增 10 个（DeepSeek-V4 视觉、EngineCore、EPLB 与动态负载均衡、Engram 配置、GLM 配置、索引器与 KV cache 数据类型、对齐切分、并行配置）；worker 去掉 8 个，其中包括本部署在请求路径上用到的权重后处理 patch 和带 bind_kv_cache 的 `patch_qwen3_next_mtp`，新增 `patch_bind_kv_cache`、KV cache 数据类型与 Step3.5；patch_v2 新增 6 个，多为投机解码相关。

本页「本部署实际生效」的清单只对 `db701c1f` 成立；v0.26 与 main 上的导入条件和文件都变了，同样的核对要按那一版的入口文件重做。

### 源码位置

| 看什么 | 固定源码位置 |
|---|---|
| 两个目录的分工说明、patch 登记格式 | `vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L17-L27` |
| 分流函数 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567` |
| global patch 入口 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L189`；`vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69` |
| vLLM 调平台钩子与加载通用插件的位置 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L2580-L2598`；`vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109`；`vllm@0fc695fc:vllm/v1/worker/worker_base.py#L230-L253` |
| worker patch 入口与之后的初始化顺序 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L130` |
| 两个入口文件 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L16-L57`；`vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L16-L89` |
| 目录之外的零散入口 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L710-L715`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3783-L3787` |
| 官方设计文档 | `vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md` |
| 对照：不属于 patch 的两种扩展点 | 模型注册 `vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L24`（Glm5NextForCausalLM、Glm5NextForConditionalGeneration、Glm5NextMTP 等）；KDA 的 CustomOp 登记 `vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768`，只在 vLLM 0.23.0 时登记，键名沿用上游接口名 KimiGatedDeltaNetAttention，数学机制按 GLM 层的实际计算核对，见[线性注意力](linear-attention.md) |
| GLM 配置登记与 MLA 判定 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30` |

patch 目录说明文件里的登记清单并不完整：GLM 的两个 patch、torch.accelerator 显存函数、MLA prefill 后端这几条没有 Why / How / Related PR / Future Plan 条目；反过来，有两条条目（`patch_module.py`、`patch_qwen3_next.py`）对应的文件在这个版本里已不存在。读清单时以入口文件和实际文件为准。

**正文证据索引。** 分流函数、三个通用入口与进程标记、平台准备钩子、NPUWorker 构造顺序见 [C1][C2][C3][C4]；vLLM 在解析参数时先加载通用插件再调平台钩子、插件加载的进程级标记见 [C13][C14]；两个入口文件的条件分支见 [C5][C6]，目录之外的零散入口见 [C37]。from-import 复制引用、patch 要连那一份一起改的例子见 [C17][C18]。对齐切分只在 align 模式被调用见 [C27]，BalanceScheduler 开关关着时交回上游见 [C28]；先存原函数再替换的写法见 [C23]。官方原则与限制见 [S11][S12]，工具调用解析器只在教程 FAQ 出现见 [S42]。三版导入条件的差异见 [C43][C45][C48]。

GLM 双机两张表的出处按行序列在 sources 里：global patch 那张依次是第 7、21、20、22、18、24、25、26、29 条，worker patch 那张依次是第 19、31、56（调用点第 57 条、上游抛错处第 58 条）、32、35 条；API server 侧三项依次是第 59、60、61 条。

正文里三处数字是按源码推出来的：API server 里「至少四次」调用，来自解析参数时三个通用入口加一次平台准备钩子的先后 [D]；worker patch「打 16 遍」，来自每个 Worker 进程构造一次 [D]；各目录「导入了几个」，是按本部署条件逐行过入口文件数出来的，文件总数取自四个提交的文件列表 [D]。

**待核：**

- KV 协调器 patch 在 GLM 的缓存布局下返回昇腾协调器还是回落原函数；第 2 站异步调度器类的父类是原 Scheduler 还是 BalanceScheduler。两条与[调用链页](request-call-chain.md#源码位置)的待核是同一件事，缺启动后在 EngineCore 进程里打印这两个对象的实际类型。
- torch.accelerator 显存函数、MLA prefill 后端选择、npugraph_ex 三个 patch 在 GLM 路径上是否被调用。缺运行时证据，例如在各进程里给这三个被换的名字加调用计数，跑一条请求后读数。
