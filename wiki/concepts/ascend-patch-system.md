---
id: ascend-patch-system
title: Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类
type: feature
summary: >-
  patch 是 vllm-ascend 在进程里把上游模块中的名字改指向昇腾实现的做法。global patch 由平台准备钩子和通用插件
  入口加载，worker patch 在 Worker 构造时加载；正常成功导入由标记和缓存去重。本页按固定 GLM 条件区分导入与
  实际调用，并对照 v0.23.0 / v0.26.0rc / v0.30.0 / main 的入口与清单。
aliases:
  - patch
  - adapt_patch
  - monkey patch
  - patch/platform
  - patch/worker
  - 补丁机制
  - 猴子补丁
  - 运行时替换
  - 全局补丁
  - Worker 补丁
  - is_global_patch
  - global patch
  - worker patch
  - _ensure_global_patch
  - 运行时适配
  - 运行时适配：补丁、模型注册与算子替换
  - 补丁幂等
chapters:
  - '10'
order: 90
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L189'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L130'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L16-L57'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L16-L89'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - 'vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L24'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L17-L27'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L7-L70
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L72-L75
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2580-L2598'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L69-L82'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L230-L253'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L45-L52'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L811-L831
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L64
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L60-L228
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L154
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L37-L37
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L461-L531
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L7-L60
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L88
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L79-L98'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L100-L268'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_cudagraph.py#L6-L38'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L756-L769'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_rejection_sampler.py#L1-L9
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L36-L246'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2127-L2136'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L710-L715'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3750-L3787'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_pp_mtp.py#L35-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_distributed.py#L88-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L610-L625'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L16-L57'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/worker/__init__.py#L16-L89'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/__init__.py#L16-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/__init__.py#L16-L76'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L165-L178
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/__init__.py#L16-L55'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/worker/__init__.py#L16-L83'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L27-L74'
  - 'vllm-ascend@baa023ad:vllm_ascend/__init__.py#L52-L99'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_torch_accelerator.py#L1-L16
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_mamba_utils.py#L185-L191'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_triton.py#L1-L19'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L18-L31'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_qwen3_next_mtp.py#L9-L50'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3936-L3952'
  - 'vllm@0fc695fc:vllm/v1/worker/utils.py#L494-L512'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_tool_choice_none_content.py#L30-L87
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py#L76-L145
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L19-L134
  - >-
    raw:sha256-1f3467f2513e9cc3286abe050d640e58125672d8f76ff1949f3c248ef4196fb9.md#L1-L1773
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L19-L59'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/worker/__init__.py#L18-L84'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L52
  - 'vllm-ascend@7d825229:vllm_ascend/__init__.py#L52-L103'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L30-L41'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L40-L57'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L689-L714'
  - 'vllm@0fc695fc:vllm/config/model.py#L1814-L1857'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2372-L2410'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L396'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L168-L188'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L1-L37'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L131-L150'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1252-L1279'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L665'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L49-L114'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L217-L231'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L88-L108'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L58-L93'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1244-L1253'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_v2/patch_use_v2_model_runner.py#L1-L3'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mla_prefill_backend.py#L20-L48'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_npugraph_ex_triton.py#L18-L129'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L121-L134'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L199-L246'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L436-L439'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L72-L104'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L906-L911'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L672-L683'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/__init__.py#L17-L62'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/worker/__init__.py#L18-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/__init__.py#L17-L55'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/worker/__init__.py#L18-L75'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L7'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L65'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: platform-plugin-registration
    kind: builds-on
    note: 插件怎样被发现、四个通用入口里哪三个先补 global patch，在那一页
  - to: request-call-chain
    kind: builds-on
    note: 第 2 站调度器上被换过的五处，以及 traceback 里 patch 帧属于哪一站
  - to: npu-platform
    kind: builds-on
    note: 平台准备钩子 pre_register_and_update 属于 NPUPlatform
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 逻辑块 640 与 KDA 块 133120 的推导，由 patch 过的函数算出
  - to: balance-scheduling
    kind: builds-on
    note: 被 patch 换上的 BalanceScheduler 在本部署关着时做什么
  - to: linear-attention
    kind: builds-on
    note: KDA 的数学机制；设备实现走 CustomOp 登记，不走 patch
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-1f3467f2513e9cc3286abe050d640e58125672d8f76ff1949f3c248ef4196fb9.md
  - >-
    raw/sha256-2f89614e55d0d2d94170fe47e9c2c22535a57d440e5f6fb7151824286b8f03ff.md
---

## 昇腾怎样把 vLLM 里的函数换成自己的？

先看 Python 怎样找到一个函数。一个模块（一个 .py 文件导入后的对象）里有一张「名字 → 对象」的表；代码写 `模块.名字` 时，每次都现去这张表里查。把表里某个名字改成指向另一个函数或类，此后再按这个名字去查的代码，拿到的就是新的那个。这种在程序运行起来以后改名字指向的做法，通常叫 **monkey patch**；它改的是当前进程内存里的表，磁盘上的上游源文件一个字都没动。

**patch（补丁）就是 vllm-ascend 在进程里把上游 vLLM 模块中的某个名字改指向昇腾自己的函数或类；之后凡是按这个名字去取实现的代码，执行的都是昇腾版本。**

```wiki-diagram
file: patch-binding
```

常见入口分成两组，主要在初始化期间替换各自负责的名字：

- **① 平台准备钩子或通用插件入口加载 global patch。** 它们导入 patch/platform，把前端和 EngineCore（负责调度、指挥 Worker 的引擎核心进程）较早就要用到的配置校验、KV 分组、调度器类、引擎入口等名字换掉。平台入口 `register()` 本身只返回类路径；实际替换发生在后续钩子或通用插件调用中。图左边的 Scheduler 被改指向 BalanceScheduler；在固定旧 GLM 的均衡开关关闭条件下，它的 `schedule` 立即转调父类，具体调度主体沿用上游（见[下文](#落到-glm-双机哪些-patch-真的起作用)）。
- **② Worker 启动时，打 worker patch。** 每个 Worker（守着一张 NPU、执行模型的进程）被构造时，第一件实质工作就是导入 patch/worker 目录，换掉只在 Worker 里用到的名字：通信组的类、权重加载后的处理、图尺寸的判断、采样用的函数等。图右边的例子是通信组：上游的 GroupCoordinator 被改指向补上了 all_to_all（每张卡给其余每张卡各发一份不同数据的集合通信，见 [All-to-All](collective-communication.md#all-to-all)）的 GroupCoordinatorPatch。

表按进程隔离，前端后续的改动不会自动同步到 EngineCore 或 Worker。spawn 的新解释器要加载自己的补丁，fork 可以继承当时的绑定与导入缓存；因此要逐进程确认状态，不能一概把进程数当成重新执行次数。入口传播见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。

## 为什么非打 patch 不可，代价在哪

vLLM 给硬件厂商留了几处正式的扩展点：装上一个平台插件，vLLM 就把「在什么设备上跑、用哪个 Worker、用哪套注意力后端」这些问题交给它回答；标成 CustomOp 的层允许插件登记自己的实现；模型注册表允许插件把一个架构名映射到自己的模型类。插件怎样被 vLLM 发现、过滤、激活，见[平台注册](platform-plugin-registration.md#发现过滤激活)。

现有实现有些适配通过直接改绑定完成。GLM 双机的主要注意力缓存按 **640 个 token** 的逻辑块组织；这个值由被替换的混合模型配置校验函数推导，其他缓存组有自己的块长，详细见[双机部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。同样，固定旧上游的默认模型解析不能直接识别 GLM-5.3-Flash 的配置类型及其 [MLA](mla.md) 语义，昇腾 patch 注册配置类型，并向架构转换器表写入自己的转换器。这说明本版本怎样接入，不能据此断言任何版本都只有 patch 一种扩展办法。

| 机制 | 上游留没留口子 | GLM 双机上的例子 |
|---|---|---|
| 平台插件 | 留了：安装元数据里的平台入口 | vLLM 选中 NPUPlatform |
| CustomOp 登记 | 留了：插件登记同名实现 | KDA 层换成 AscendKimiGatedDeltaNetAttention |
| 模型注册 | 留了：模型注册表 | Glm5NextForCausalLM 等架构名映射到昇腾模型类 |
| patch | 没留：直接改上游模块里的名字，或往上游的登记表里塞条目 | 逻辑块大小、KV 分组、调度器类、GLM 配置类型 |

表里最后一行有两种动作。多数 patch 是「改指向」：把上游的函数、类或方法换掉。少数是「塞条目」：GLM 的配置 patch 往 transformers 的配置类型表和 vLLM 的架构转换器表里各加几条，让解析器认得 glm5_next，并凭 kv_lora_rank 是否存在判定按 MLA 解析。两种动作都写在 patch 目录的文件里，都在导入那个文件时执行。CustomOp 登记和模型注册则分别发生在 Worker 构造和通用插件入口里，不属于 patch；GLM 的层型与计算连接见[模型介绍](glm-5-3-flash.md)，KDA 的数学机制见[线性注意力](linear-attention.md)。

代价有四条，都来自「只改一个进程里的一个名字」这个做法本身：

1. **后续修改只在当前进程生效。** 前端、EngineCore 和 Worker 的绑定要分别确认；fork 可以继承已有状态，spawn 重新加载，前端打过不能代替 Worker 的核对。
2. **只改模块表里那一个名字，已经复制走的引用不变。** 上游的 EngineCore 在导入时用 from-import 把「算调度器块大小」的函数绑定到自己模块，所以 KV 分组 patch 在末尾也替换这一份；权重后处理 patch 同样改了两个模块的引用。子类若在换名之前已定义，父类也不会自动改变。异步调度的对应条件见下文，实际继承关系可在目标进程查看 MRO。
3. **和上游版本咬死。** patch 依赖上游的函数名、参数和对象结构；上游改名或重构后，旧 patch 要么换了一个没人再调的名字，要么在导入时就报错。所以两个目录的入口文件按 vLLM 版本号挑选要导入的文件。
4. **调用栈通常不显示早先的替换动作。** 赋值已完成后，traceback 显示当前执行函数的代码位置；它可以在 patch 目录，也可以在被补丁引用的其他模块。搜不到某个函数的 patch 也不能证明行为就是上游原样，派生类、模型注册、后端选择和 CustomOp 都要合看，定位路线见[怎么读这个仓库](reading-vllm-ascend.md)。

vllm-ascend 的官方设计文档对 patch 的态度很直白：patch 不是让昇腾兼容 vLLM 的好办法，只是临时方案，最好的做法是把改动贡献回 vLLM；原则三条——能不打就不打（Less is more）、加了 patch 就必须写清将来怎么移除、任何时候清理 patch 都欢迎。为此 patch 目录的说明文件要求每加一个 patch 都登记四项：为什么改（Why）、怎么改（How）、上游有没有对应改动（Related PR，没有要说明原因）、何时移除（Future Plan）。所以 patch 的数量本身说明不了什么，要连着每条的 Related PR 和 Future Plan 一起看。

## 两类 patch 各在什么时候、哪个进程里生效

patch 没有统一的总开关或逐条启停接口，主要靠模块导入时执行赋值或调用安装函数生效。两个目录入口按条件导入文件；补丁内部还可能有自己的判断，其他代码也能直接调用补丁函数。因此要同时看导入顺序、内部安装条件和后来是否又被覆盖。分流函数 `adapt_patch` 很短：`is_global_patch` 为真导入 `patch/platform`，否则导入 `patch/worker`。两阶段导入时机、进程落点、`from-import` 副本陷阱以及 `v0.30.0` 到 `main` 的补丁收敛对照见下方全景图。

**global patch 有两个入口。** 一个是平台准备钩子：vLLM 在解析命令行参数、建配置时调用 NPUPlatform 的这个钩子，钩子第一行就调 adapt_patch 打 global patch。本例的命令行路径在 node0 的 API server 和 node1 带 headless 参数的启动进程中触发；离线调用创建引擎配置时也会经过这个钩子。另一个是通用插件入口：vLLM 在前端解析参数时、EngineCore 初始化时、Worker 初始化时各加载一次通用插件；vllm-ascend 注册的四个通用入口里，连接器、加载器、采集三个的第一件事都是确认本进程打过 global patch，没打过就打，模型入口不打，见[平台注册页](platform-plugin-registration.md#三个通用入口先补一次全局补丁)。

第二个入口让不经过 CLI 解析钩子的 EngineCore 初始化也能加载 global patch，而调度器恰好就在这里。按本页完整插件启用、成功初始化和 spawn 的教学条件，API server、两个 EngineCore、16 个 Worker 都有对应加载入口。这是 19 个核心功能角色的入口账，另有 headless 启动入口；不包括短命探测、辅助进程，也不是现场执行次数记录。

**worker 目录的常规加载入口是 NPUWorker 构造函数。** 编译告警检查之后先调 `adapt_patch`，再登记 CustomOp、初始化 Ascend 配置和上游 Worker 基类；模块本身的顶层导入和赋值则更早发生。这样，后续使用模块级 `GroupCoordinator` 建通信域时能拿到替换类。本例按 16 个新 Worker 进程各构造一次计算，有 16 次目录加载调用；成功导入后的缓存决定是否重跑模块语句。单卡若选择把 Worker 放在 EngineCore 内的执行器，补丁也落在该进程；进程布局仍取决于执行器配置。

| | global patch | worker patch |
|---|---|---|
| 谁触发 | 平台准备钩子；三个通用插件入口 | NPUWorker 构造函数开头 |
| 本部署在哪些进程 | API server、2 个 EngineCore、16 个 Worker | 16 个 Worker |
| 换哪类名字 | Worker 出生前就要用的：配置校验、KV 分组、调度器、引擎入口 | 只在 Worker 里用的：通信组、权重后处理、图尺寸、采样 |

两类的区别在**时机和进程**，不在改的对象种类：两个目录里都有叫 `patch_distributed` 的文件，`platform` 下那个在 310P 芯片上改 PyTorch 的集合通信函数，`worker` 下那个换 vLLM 的通信组类。把两阶段导入入口、`from-import` 副本陷阱，以及从旧基线到 `v0.30.0`（`32 / 19 / 14 = 65` 个 `patch_*.py`，按 `HardwareProfile` 能力表门控）再到 `main`（`29 / 30 / 0 = 59` 个，退役 `patch_v2/` 并通过 `mrv2_utils` 锁定 MRV2）的演进收在一张图里对照：

```wiki-diagram
file: ascend-patch-system-fig-lifecycle
```

两个目录也不是全部入口。还有少数 patch 由别处按配置导入：检查配置时，只有打开 profiling 分块功能才导入对应的 patch；model runner 加载 EAGLE-3 草稿模型且流水线并行大于 1 时，才调另一个 patch 函数。判断某个 patch 在不在，要从调用入口一路核到条件分支，文件在目录里并不够。每个进程从哪个入口拿到补丁、fork 和 spawn 两种启动方法下子进程是否带着父进程已换好的名字，归[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)讲；动态 EPLB 为什么要靠环境变量在 global patch 里换掉多进程执行器，见[同页后文](engine-processes.md#进程怎么摆直接决定要打哪些补丁)。

## 同一个进程里，global patch 为什么只打一遍

在一个全新 API server 解释器中，若三个通用入口都启用且成功执行，正常解析路径会三次调用 `_ensure_global_patch`，再由平台准备钩子直接调用 `adapt_patch`。这些入口通过三层机制减少重复执行：

1. **vLLM 插件加载函数带进程级标记。** 它先把标记设为真，再加载和调用入口；后续调用直接返回。因此中途失败也不能把第二次调用当作自动重试。插件过滤、加载与执行的边界见[平台注册](platform-plugin-registration.md#发现过滤激活)。
2. **`_ensure_global_patch` 带模块级标记。** 它在 `adapt_patch` 成功返回后才设标记；成功后其他通用入口直接返回。若补丁导入中途异常，标记未置，但先前完成的其他模块导入或绑定修改可能已经留下。
3. **Python 导入缓存。** 正常成功导入且未显式重载、删除缓存时，后续 import 复用已有模块。平台准备钩子绕过上一个标记，仍受这层缓存影响；导入失败、显式 reload 或直接调用安装函数须另看。

所以正常启用通用插件的启动路径中，替换通常先由通用入口触发，后到的平台钩子复用导入结果；若插件被过滤，平台钩子仍可能成为首次触发点。Worker 的目录导入同样受缓存保护。

入口去重和替换逻辑的幂等性是两件事。幂等性要求重复执行仍与执行一次效果相同；入口标记和导入缓存避免再次执行，并不能证明替换逻辑本身满足这个要求。

幂等要紧，是因为很多 patch 的写法是「先存下原函数，再换成自己的，遇到不归自己管的情况转回原函数」。KV 协调器的 patch 就是这样：先把上游的工厂函数存成一个私有名字，再把上游的名字改指向昇腾的工厂，某些缓存布局之外的情况回落到存下的原函数。这段代码若在同一进程里跑第二遍，存下的「原函数」已经是昇腾版本，兜底时转回的就不再是上游，而是昇腾自己。有些 patch 文件还自带一道保险：流水线并行与 MTP 的 patch 用模块级标记挡住重复执行，Worker 侧通信 patch 给包装过的函数打记号，投机解码配置的 patch 先检查 glm5_next_mtp 是否已在类型表里再追加。

这些标记都是**进程里的变量**。spawn 的新解释器从初始状态加载；fork 继承父进程当时的标记、绑定和模块缓存。如果 fork 时插件标记已经为真，子进程再次调用通用加载函数会直接返回；若尚未置位，不能据 fork 本身推断它会跳过加载。

## 落到 GLM 双机：哪些 patch 真的起作用

**固定条件决定入口文件走哪条分支。** 官方双机是两台 Atlas 800 A2（不是 310P），配 vLLM 0.23.0；命令没有设置动态 EPLB 的两个环境变量和 V2 model runner 环境变量。本节另以这些环境变量未被镜像注入、Triton 可用、通用插件完整启用并成功导入为条件，逐行计算入口中的直接导入数；它们不是目标镜像已实际执行的日志。部署前提见[双机部署页](glm-5-3-flash-two-node.md#部署前提)。

- **patch/platform 目录 28 个文件，导入 23 个。** 没导入的 5 个：310P 专用的块大小 patch；只在两个 EPLB 环境变量打开时才导入的多进程执行器 patch；只在 vLLM 不是 0.23.0 时才导入的两个（FusedMoE 与 DP 设备号）；以及不经入口文件、由配置检查按需导入的 profiling 分块 patch。
- **patch/worker 目录 24 个文件，直接导入 19 个**；`patch_npugraph_ex_triton` 的导入成功时再多 1 个，这次导入中的 `ImportError` 会被捕获。另四个未由该条件下的入口加载：310P 专用、非 v0.23 才导入的 FusedMoE、V2 补丁兼容标记控制的专家捕获，以及由 runner 按需调用的 EAGLE-3 流水线辅助。
- **patch/worker/patch_v2 子目录 7 个文件，直接导入 1 个。** v0.23 的入口将 V2 补丁兼容标记置为假，跳过受它控制的那一组；唯一保留的模块再导入 global patch 的同名文件。这是补丁导入规则，不代表显式开启 V2 后所有兼容性检查都会通过。

**导入、替换、调用是三件事。** 导入后的内部条件决定是否执行替换；即便替换发生，还要看调用绑定和新函数的分支。下表列出与 GLM 启动及[第 2 站调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)有关的九项，按上述静态条件解释：

| patch 文件 | 换掉或登记了什么 | 在哪一步用到 | 本部署的效果 |
|---|---|---|---|
| glm5_next_config | 往配置类型表和架构转换器表登记 glm5_next 等 | 启动时解析模型配置 | vLLM 0.23.0 由此认得 GLM，并按 MLA 解析 |
| speculative_config | 草稿配置的改写函数；MTP 类型表加 glm5_next_mtp | 建 MTP 草稿配置 | GLM 的草稿配置被改成 glm5_next_mtp 类型，才能找到昇腾的 MTP 类 |
| mamba_config | 混合模型的配置校验函数 | 建配置 | 逻辑块 640 token，KDA 组的块 133120 token |
| use_v2_model_runner | 配置里「用不用 v2 model runner」的判断 | 选 model runner | 只看环境变量，没设就用 v1 的 NPUModelRunner |
| kv_cache_utils | KV 分组、块大小解析等一组函数，连 EngineCore 模块里 from-import 的那一份 | EngineCore 初始化、切 KV 块 | 按 GLM 的布局分组；调度器的块取各组的最小公倍数 133120 |
| kv_cache_coordinator | KV 协调器的工厂函数，也补改已缓存的 from-import 引用 | 建 KV 管理器 | DSV4 规格优先走昇腾类；其他布局若只有一组或前缀缓存关闭，回落原函数。按本页非 DSV4、前缀缓存关闭的 GLM 基线，继续得到上游无前缀缓存协调器 |
| mamba_manager | KDA 状态组的管理器类 | 第 2 站分配 KV 块 | 换成 AscendMambaManager，改的是前缀命中与外部 KV 的分支 |
| glm5_next_mamba_scheduler | 调度器按状态存档点对齐切 token 的方法 | 第 2 站 | 替换发生，但只在 align 缓存模式下才调用；本部署是 none，不执行 |
| balance_schedule | 调度器类这个名字；EngineCore 进程的入口函数 | 起 EngineCore、第 2 站 | 替换发生；均衡调度开关关着，两者都直接转给原来的实现 |

后五行就是[调用链页](request-call-chain.md#源码位置)统计的「第 2 站被换过的五处」：KV 分组、KV 协调器、KDA 状态管理器、对齐切分、调度器类与引擎入口。缓存模式为 none 时不调用 align 切分；固定旧 GLM 的均衡开关关闭时，BalanceScheduler.schedule 和引擎入口直接转给原实现（v0.23 维护分支另有 producer 条件，见[版本差异](#版本差异)）。开关打开后的机制见 [Balance Scheduling](balance-scheduling.md)。异步调度类的父类由首次定义时的绑定决定：若在 Scheduler 替换之后才导入 AsyncScheduler，它继承 BalanceScheduler；若先前已导入，不会因后来换名自动改变。源码给出这一条件关系，目标进程实际导入历史仍应结合 MRO 核对。640 和 133120 的推导统一见[双机部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。

worker patch 里落在 GLM 请求路径上的有五项，在每个 Worker 进程里生效：

| patch 文件 | 换掉了什么 | 在哪一步用到 | 本部署的效果 |
|---|---|---|---|
| process_weights_after_loading | 权重加载后的处理函数，两个模块里的同名引用都换 | 启动时加载权重的最后一步 | 比上游多认 GLM 的 MLA 层，把权重转成昇腾要的排布 |
| distributed | 通信组类 GroupCoordinator；销毁分布式环境的函数 | 建通信域 | 替换后经上游 `init_world_group` / `init_model_parallel_group` 新建的对象使用补丁类；已有对象不会追溯改变。它还管理 HCCL 组资源并提供 `all_to_all` 转发，world_size=1 时直接返回输入 |
| qwen3_next_mtp | 把 KV 张量绑到各注意力层的函数 bind_kv_cache | 启动时建 KV 张量 | 上游版本在 NPU 上遇到同一层号挂着多个注意力层名会直接抛错，换成不抛的版本；文件名带 Qwen3-Next，GLM 一样经过它 |
| cudagraph | 图调度器里「按 token 数算图尺寸描述」的方法 | 每一步选图尺寸 | 改了图模式为 FULL 时对均匀 decode 批的判断 |
| rejection_sampler | 上游拒绝采样模块里的三个函数 | 第 5 站 MTP 验证 | 替换发生，但 GLM 用的 AscendRejectionSampler 重写了 forward，直接调昇腾自己的函数，不经过被换的名字 |

最后一行是另一种情况：patch 和派生类并存时，还要检查派生类的覆盖方法。昇腾的拒绝采样器是上游类的子类，它的 forward 调的是自己模块里的函数，所以上游模块里那三个名字换没换，都不影响这条路径。

API server 一侧还有三项按内容工作的 global patch。正常 chat 响应对象调用被替换的 `model_dump` / `model_dump_json` 时，会删除 message 或 delta 中为空列表的 `tool_calls`。流式生成器的包装函数检查每个数据块：只有单个 choice、`finish_reason=tool_calls` 且带非空参数时，才拆成参数块和结束块，其余原样透传。结构化输出校验先调用上游，再在能识别请求后端时检查同一引擎是否混用了后端；没有相关配置或后端就返回上游结果。请求若更早失败，不会因此经过所有响应路径。

其余导入了的 patch，按和 GLM 请求路径的关系分四种：

- **按模型与实际绑定区分。** 入口还会导入 MiniMax、Qwen、Kimi-K2.5、DeepSeek、EAGLE-3、DFlash 等适配模块；文件名说明查找方向，不能单凭模型名排除其共享函数，`patch_qwen3_next_mtp` 对 GLM 也有影响就是反例。GLM 的模型入口由独立注册项选择，KDA 前向调用昇腾的 `kda_attention` 路径，不能直接把上游 GDN/卷积函数的替换当成 KDA 的执行证据。Triton patch 还把 `next_power_of_2` 指向 vLLM 工具函数；这是兼容赋值，不足以证明每个安装环境原先都缺这个函数。
- **跟随功能选择的。** 官方双机命令没有选择工具调用解析器，FAQ 才给出 `glm47`、`glm45` 与自动工具选择的配置；新增这些配置就需要重核解析器路径。睡眠模式、[强化学习的权重同步](vllm-ascend-for-rl.md#训练端和推理端怎样交接显存与权重)和 KDA 状态拷贝也要分别追到实际消费者。例如本页所引 runner 的 `preprocess_mamba` 调用明确要求 align 模式，不能把导入状态拷贝模块当成每步都复制状态。
- **安装路径明确、调用还取决于消费者。** 可选图补丁先尝试导入 npugraph_ex，遇到 `ImportError` 再试 torchair，修改 ValuePack 与解包方法并重载相关模块；外层入口会捕获最终的 `ImportError`。global patch 则把 torch.accelerator 四个显存 API 转到 torch.npu，并把上游 MLA prefill 选择函数替换成返回 Ascend 占位后端的函数；占位后端的两个实际计算方法会抛不支持，不能当成可执行的 prefill 内核。这些名字在目标 GLM 路径是否被调用，仍需实际调用记录。
- **条件在 patch 内部。** platform 下的 patch_distributed 被导入了，但只有检测到 310P 芯片才替换，在 A2 上什么也不换。流水线并行与 MTP 的校验 patch 确实换掉了模型配置的并行校验方法，建草稿配置时也会被调用，但只在流水线并行大于 1 时改动校验，本部署流水线并行为 1，直接转回原方法。

## 排查时，怎样确认跑的是哪一份代码

读到一个上游函数，想知道昇腾上执行的是不是它，按三步核：

1. **先认进程。** 出问题的那一帧在前端、EngineCore 还是 Worker 里，决定了该看 global patch 还是 worker patch 有没有生效；前端里换好了，不能推断 Worker 里也换好了。按调用栈认进程的办法见[引擎有哪几个进程](engine-processes.md#排查时先认是哪个进程)。
2. **再看调用方怎样拿到这个实现。** 按「模块.名字」现查的，看当前绑定；from-import 复制走的，看那一份有没有一起改；注册表、派生类和 CustomOp 则沿登记与继承继续追。同样需要检查 patch 是否改动了这些入口，不能预先划成互不相干的路径。
3. **最后核安装与执行条件。** 搜到名字后，检查入口是否导入、内部是否替换、后来是否再被覆盖，以及调用时是否回退原实现。搜不到只是下一步调查的起点，不能以文本缺失证明行为一定是上游原样。

运行时先沿 traceback 找实际执行帧，再查看该进程里的绑定、方法 MRO 与函数代码位置。补丁定义的包装函数可能出现在 patch 目录，也可能直接指向其他昇腾模块的函数。`__module__` 是线索，不能单独定论：本页的流式 chat 包装就把它写回上游模块名。对 Python 函数可合看 `__code__.co_filename`、包装链与实际调用帧；[调用链页](request-call-chain.md#出问题时判断它停在哪一站)说明怎样把它们映射回请求阶段。

## 常见误解

- **「patch 目录里的文件都生效了」**——两个入口按条件直接导入，别处还可以按需调用。固定假设下 platform 的 28 个文件直接导入 23 个，worker 的 24 个直接导入 19 个，另有一个可选成功导入；还要再查内部替换和执行条件。
- **「导入了，请求就一定走新实现」**——不一定。对齐切分的 patch 因为缓存模式是 none 根本不被调用；BalanceScheduler 的开关关着，schedule 第一行就交回上游；拒绝采样的 patch 换了上游模块里的函数，GLM 走的昇腾子类却不调它们。
- **「global patch 和 worker patch 改的是不同种类的东西」**——区别在时机和进程，不在对象种类。两个目录都有同名的 patch_distributed 和 patch_fused_moe 文件，改的东西各不相同。
- **「_ensure_global_patch 保证全局只打一次」**——它只管同一个进程，标记是进程里的一个变量，每个进程各有一份；而且平台准备钩子不经过它，那一路不重打靠的是 Python 的导入缓存。

- **「patch 只在两个时间点发生」**——两个目录是主要的两个时机，不是全部：profiling 分块的 patch 在检查配置时按开关导入，EAGLE-3 加流水线并行的 patch 由 model runner 在加载草稿模型时调用。
- **「改了模块里的名字，所有调用都跟着变」**——早先用 from-import 复制走的引用、早先定义好的子类的父类，都不跟着变；所以有的 patch 要同时改好几个模块里的同名引用。
- **「补丁越多，说明代码越差」**——规范要求每条登记上游关联和移除计划，例如图尺寸判断条目写明计划在上游合入关联修复后移除。它说明该快照的维护计划，不证明关联 PR 的当前状态；判断应结合具体作用与移除条件，而非只看数量。
- **「官方设计文档说 EngineCore 进程默认打不了 patch」**——设计文档的限制一节确实这么写，但固定版本的代码已经靠三个通用插件入口在 EngineCore 进程里打上 global patch，第 2 站的调度器替换就是这样生效的；以代码为准。

## 对照源码

### 怎么开

patch 没有统一的总开关；下面列的是本页主要入口和消费者的条件，不是所有补丁内部条件的全集。取值采用本节固定教学前提。

| 条件 | 影响什么 | 本部署 |
|---|---|---|
| `is_310p()` | 块大小 patch 用哪一版；Qwen 系列 patch 与 310P 索引 patch 二选一；platform 下 patch_distributed 是否真替换 | 否（A2） |
| `vllm_version_is("0.23.0")` | GLM-4.7 与 MiniMax-M2 工具调用解析、MiniMax 用量统计三个 patch 导入；FusedMoE、DP 设备号两个 patch 反过来不导入；patch_v2 中受兼容标记控制的一组跳过，仍导入 use_v2_model_runner 兼容模块 | 是 |
| Triton 可用（`HAS_TRITON`） | worker 下 patch_triton 是否导入 | 是 |
| 环境变量 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` | 多进程执行器 patch 是否导入 | 未设 |
| 环境变量 `VLLM_USE_V2_MODEL_RUNNER` | 被 patch 过的 use_v2_model_runner 直接返回它；未设返回 False | 未设 |
| `enable_balance_scheduling` | BalanceScheduler 和引擎入口是走均衡逻辑还是转回原实现；依次读 Ascend 配置、additional_config、环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING` | 关 |
| `profiling_chunk_config.enabled` | 检查配置时是否导入 profiling 分块 patch，并换调度器类 | 关 |

版本判断先取环境变量 `VLLM_VERSION`，为 None 才取已安装 vLLM 的版本号，再用 `packaging.version.Version` 比较；无法解析的版本字符串会报错。排查补丁时，可先查 `sys.modules` 是否有对应模块，再查目标绑定、代码位置与 MRO；模块已在缓存、或某个对象的 `__module__` 指向昇腾，都不能证明整套 global patch 已完整成功执行。

### 会报什么错

- **未被捕获的 patch 导入异常会中止当前初始化。** vLLM 调用已加载的通用插件入口函数时，不在调用外包 try；入口内的补丁导入若抛出未处理异常，就会从当时初始化的进程（API server、EngineCore 或 Worker）向外传播。入口自己处理的异常另算，例如 Worker 入口会捕获可选 `patch_npugraph_ex_triton` 导入的 `ImportError`。一类未处理错误是上游改了被换的名字，patch 在替换前读取原对象时报 AttributeError。KV 分组 patch 为此对两个名字先用 hasattr 判断再替换，因为 vLLM 的不同发布版用过这两个名字。
- **vLLM 版本识别错，导入了错的一边。** 设计文档的限制一节提醒：运行改过的 vLLM 时版本号可能被自动改成带后缀的形式，`vllm_version_is` 判断失败，按版本二选一的 patch 就会导入错的一边；此时设环境变量 `VLLM_VERSION` 指定版本。
- **某个 worker patch 没打上。** 例如绑定 KV 张量的函数，上游版本在非 CUDA、XPU、CPU 平台上遇到同一层号挂多个注意力层名时抛 `NotImplementedError`；Worker 进程里看到这个错，先查 worker patch 是否在本进程生效。
- **设计文档与代码不一致。** 设计文档限制一节仍写着默认只能 patch 主进程和 Worker 进程，要改 EngineCore 需整体覆写；固定版本的代码已经通过 `_ensure_global_patch` 在 EngineCore 进程打 global patch，以代码为准。

### 开销和什么时候别开

替换绑定主要发生在导入或安装时；直接改名本身不要求每次推理重做替换。但包装型 patch 可增加调用、判断乃至实质工作，导入也可触发依赖初始化，不能仅凭“改了几个名字”估计总体开销。以均衡关闭的 BalanceScheduler.schedule 为例，它多做条件判断后转调父类；实际耗时仍需测量。

维护和排查也有代价：升级 vLLM 时要按新名字、参数和对象结构重核；请求栈通常只显示当前函数，看不到早先的赋值。是否能关闭某条适配，要看该补丁是否提供条件入口以及关闭后的上游行为。GLM 配置登记、权重后处理、KV 绑定等承担具体适配，不能靠删导入判断功能仍正确。换版本、芯片或 EPLB/V2 等配置后，本页清单应按新条件重算。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10`，GLM 双机专用镜像 `db701c1f` 同属此分支期并含 GLM5Next 专用补丁）、`v0.26.0rc`（`vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20`）与 `main`（`vllm-ascend@8d6180e2`）。**`v0.30.0` 仍保持 `patch/platform` + `patch/worker` + `patch/worker/patch_v2` 三层并存（`patch_use_v2_model_runner` 未设环境变量默认 `False` 走 MRV1）；`main` 退役 MRV1 后，将 `patch_v2/` 全部并入 `patch/worker/`，并把 `patch_use_v2_model_runner.py` 缩为 7 行薄封装，统一委托 `vllm_ascend.mrv2_utils.apply_v2_model_runner_config_patch()` 锁定 MRV2。**

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 入口机制 | `adapt_patch` 分流、平台准备钩子、三通用入口经 `_ensure_global_patch`、`NPUWorker` 构造开头 | 相同 | 相同 | 相同；`_ensure_global_patch` 先调 `apply_v2_model_runner_config_patch()` 再打全局 patch |
| `patch_*.py` 文件分布（`platform / worker / patch_v2`） | 28 / 24 / 7（共 59；GLM `db701c1f` 同数异项） | 31 / 24 / 9（共 64） | **32 / 19 / 14**（共 **65**；`#L17-L62`、`#L18-L85`） | **29 / 30 / 0**（共 **59**；`patch_v2/` 退役并扁平合入 `patch/worker/`，`#L17-L55`、`#L18-L75`） |
| 入口条件与版本门控 | 310P、`vllm_version_is("0.23.0")`、Triton、EPLB 环境变量 | 去除了 vLLM 版本分支；留 310P、Triton、EPLB；`patch_v2` 不再跳过 | 310P 改由 `HardwareProfile` 能力表门控（`STANDARD_MAMBA_PATCH`、`STANDARD_WORKER_PATCHES`）；留 Triton 与 EPLB | 延续能力表 + Triton + EPLB；在 `patch/worker/__init__.py#L73` 仅对 `patch_adaptive_verification` 保留 `vllm_version_is("0.33.0")` 门控 |
| MRV1 / MRV2 补丁入口 | `patch_use_v2_model_runner` 未设环境变量默认 `False`（MRV1） | 相同 | `patch/platform/patch_use_v2_model_runner.py#L18-L42` 仍默认 `False`（MRV1），另增支持特性白名单与投机 PP 校验 | 缩为 7 行调用 `mrv2_utils.apply_v2_model_runner_config_patch()`（`mrv2_utils.py#L29-L65` 恒返 `True`，显式 `=0` 报错）；移除 MRV1 专属 `patch_rejection_sampler`、`patch_cudagraph`，新增 `patch_ascend_ops`、`patch_staged_writes` |
| GLM 专用与调度器补丁 | 维护分支无 GLM 模型补丁（镜像 `db701c1f` 含 `glm5_next_config`/`mamba_scheduler`）；`BalanceScheduler` 在 `kv_producer` 走禁抢占 | 调度器两层继承：`KVDeliveryScheduler` → `BalanceScheduler` | `patch_glm5next_config` + `patch_mamba_block_aligned_split`；EngineCore 入口包装独立到 `patch_engine_core.py` | 延续 `patch_glm5next_config` / `patch_mamba_block_aligned_split` / `patch_engine_core`；新增 `patch_kv_cache_admission`、`patch_swa_bounded_replay` |

文件清单按各固定提交的 `patch/platform`、`patch/worker`、`patch/worker/patch_v2` 三个直接目录统计 `patch_*.py`（不含 `__init__.py` 及非 `patch_` 辅助模块），目录文件数不等于单次启动实际执行次数。

- **GLM 镜像 `db701c1f` vs `v0.23.0`（`2c59ff10`）**：文件数同为 59 但内容有别：镜像多出两个 GLM 专用 patch、少 `patch_async_swa_kv_lifetime` 与 `patch_shm_broadcast`；且 `2c59ff10` 的 `patch_balance_schedule` 在 `kv_producer` 角色下即使均衡开关关闭也不交回上游，而镜像 `db701c1f` 开关关闭即直通上游。
- **`v0.23.0` → `v0.26.0rc` → `v0.30.0` → `main` 演进主线**：`v0.26.0rc` 去掉 7 个 v0.23 工具解析补丁并引入 `patch_kv_delivery_preemption`；`v0.30.0` 将芯片判断收敛至 `HardwareProfile` 能力表、把 EngineCore 入口包装拆到 `patch_engine_core.py` 并并存 14 个 `patch_v2` 文件；`main` 退役 MRV1 后彻底移除 `patch_v2/` 子目录（连同 `patch_rejection_sampler`、`patch_cudagraph` 退役），并将 V2 补丁直接扁平化进 `patch/worker/`。

本页 GLM 清单是 `db701c1f` 在所列条件下的静态路径判断；`v0.26.0rc`、`v0.30.0` 与 `main` 的入口和文件均已演进，需按对应版本重核，不能视作目标环境的执行日志。

### 源码位置

| 看什么 | 固定源码位置 |
|---|---|
| 两个目录的分工说明 | `vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L17-L27`；登记格式见来源 11 的设计文档 |
| 分流函数 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567` |
| global patch 入口 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L189`；`vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69` |
| vLLM 调平台钩子与加载通用插件的位置 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L2580-L2598`；`vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109`；`vllm@0fc695fc:vllm/v1/worker/worker_base.py#L230-L253` |
| worker patch 入口与之后的初始化顺序 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L130` |
| 两个入口文件 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L16-L57`；`vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L16-L89` |
| 目录之外的零散入口 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L710-L715`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3783-L3787` |
| 官方设计文档 | `vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md` |
| 对照：不属于 patch 的两种扩展点 | 模型注册 `vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L24`（Glm5NextForCausalLM、Glm5NextForConditionalGeneration、Glm5NextMTP 等）；KDA 的 CustomOp 登记 `vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768`，只在 vLLM 0.23.0 时登记，键名沿用上游接口名 KimiGatedDeltaNetAttention，数学机制按 GLM 层的实际计算核对，见[线性注意力](linear-attention.md) |
| GLM 配置登记与 MLA 判定 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30` |

patch 目录说明用于解释维护目的；判断是否安装和被调用，仍要以入口、实际赋值和消费者为准。设计文档本身也可能落后于入口实现，本页 EngineCore 的例子已展示这种差异。

**正文证据索引。** 分流函数、三个通用入口与进程标记、平台准备钩子、NPUWorker 构造顺序见 [来源 1](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/utils.py#L563-L567)、[来源 2](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/__init__.py#L18-L69)、[来源 3](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L184-L189)、[来源 4](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/worker.py#L107-L130)；vLLM 在解析参数时先加载通用插件再调平台钩子、插件加载的进程级标记见 [来源 13](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/engine/arg_utils.py#L2580-L2598)、[来源 14](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/plugins/__init__.py#L69-L82)；两个入口文件的条件分支见 [来源 5](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/__init__.py#L16-L57)、[来源 6](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/worker/__init__.py#L16-L89)，目录之外的零散入口见 [来源 37](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L710-L715)。from-import 复制引用、patch 要连那一份一起改的例子见 [来源 17](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/v1/engine/core.py#L45-L52)、[来源 18](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/patch_kv_cache_utils.py#L811-L831)。对齐切分只在 align 模式被调用见 [来源 27](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/v1/core/sched/scheduler.py#L259-L263)，BalanceScheduler 开关关着时交回上游见 [来源 28](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L88)；先存原函数再替换的写法见 [来源 23](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L37-L37)。官方原则与限制见 [S11][S12]，工具调用解析器只在教程 FAQ 出现见 [S42]。三版导入条件的差异见 [来源 43](https://github.com/vllm-project/vllm-ascend/blob/2c59ff10/vllm_ascend/patch/platform/__init__.py#L16-L57)、[来源 45](https://github.com/vllm-project/vllm-ascend/blob/2ed6cbba/vllm_ascend/patch/platform/__init__.py#L16-L60)、[来源 48](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/patch/platform/__init__.py#L16-L55)。

GLM 双机两张表的出处按行序列在 sources 里：global patch 那张依次是第 7、21、20、22、18、24、25、26、29 条，worker patch 那张依次是第 19、31、56（调用点第 57 条、上游抛错处第 58 条）、32、35 条；API server 侧三项依次是第 59、60、61 条。

正文的调用数按条件推导：全新解释器、三个通用入口都启用且成功执行时，API 解析路径三次调用确保补丁的函数，再一次调用平台钩子里的分流函数；16 个新 Worker 各构造一次，则有 16 次 worker 目录加载调用 [D]。文件与直接导入数分别来自固定 git 目录和入口分支，不等于运行时新执行的模块数。

**条件与运行时核对。** 入口去重不能证明所有补丁幂等；保存原函数、替换绑定或包一层调用的实现要各自检查。[C1][C2][C23][C24] 本页已列出 KV 协调器在前缀缓存关闭时的回退链，以及异步调度继承取决于导入先后的条件。目标进程的实际类型、导入历史和完整调用次数仍没有运行记录；torch.accelerator、MLA prefill 后端与 npugraph_ex 的路径，应在实际进程里结合代码绑定、调用栈或计数确认。本页不把静态入口判断当作设备运行验证。

精确调用链：协调器规格判定与上游回退见来源 68–69，前缀缓存默认链见 70–71，调度器块长解析见 72；调度器选择、类定义和 EngineCore 消费点见 73–75；通信组构造、拒绝采样器实例化见 76–77。v0.23 producer 禁抢占的条件和循环见 78–79，v0.26 rc 的继承链与类替换见 80–82。V2 兼容模块仅复用 global patch 见 83，KDA 前向入口见 84；MLA 占位后端和 npugraph_ex/torchair 两路安装见 85–86；GLM MLA 规格标识见 87。拒绝采样的自有前向见来源 35，继承的 logprobs 方法另见 88，不能把派生类解释成全部方法都已重写。

对齐切分的实际调用见来源 89；main 调度器的父类与模块绑定见 90–91；EAGLE-3 辅助状态开关的判断见 92，并与来源 38 的 PP 条件共同决定是否安装相应补丁。
