---
id: ascend-patch-system
title: Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类
type: feature
legacyAnchors:
  落到-glm-双机哪些-patch-真的起作用: 复杂异构实战对照：GLM 双机上哪些 patch 真的起作用
summary: >-
  patch 是 vllm-ascend 在进程内把上游模块中的名字改指向昇腾实现的机制。本页先按 v0.30.0 主基线讲清
  platform/worker 两类补丁的注入时机、去重与边界条件，再以 GLM 双机案例对照导入与实际调用，并汇总四版本入口与清单演进。
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
  - to: engine-processes
    kind: builds-on
    note: 补丁只改当前进程内存里的模块符号表，fork 与 spawn 如何决定各进程何时重打见进程页
  - to: platform-plugin-registration
    kind: builds-on
    note: 插件怎样被发现、四个通用入口里哪三个先补 global patch，在那一页
  - to: npu-platform
    kind: builds-on
    note: 平台准备钩子 pre_register_and_update 属于 NPUPlatform
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

先看 Python 怎样找到一个函数。一个模块（`.py` 文件导入后的对象）内部维护一张「名字 → 对象」的表；代码执行 `模块.名字` 时，每次都会现场查表。在程序启动后把表里某个名字改指向另一个函数或类，就叫 **monkey patch**——它只改当前进程内存里的表，磁盘上的上游源码一字未动。

**patch（补丁）就是 `vllm-ascend` 在进程内把上游 vLLM 模块中的某个名字改指向昇腾实现；此后凡按这个名字查表的代码，都会执行昇腾版本。**

```wiki-diagram
file: patch-binding
```

在 `v0.30.0` 主基线下，补丁按注入时机与进程落点分为两组（图左），并须提防 `from ... import ...` 副本滞留（图右）：

- **① global patch（`patch/platform`）**：在前端和 EngineCore 较早阶段生效，替换配置校验、KV 分组、调度器与引擎入口。平台插件 `register()` 本身只返回类路径，真正改名发生在后续准备钩子或通用插件调用里。例如 `Scheduler` 被改指向 `BalanceScheduler`；均衡开关关闭时，它的 `schedule` 直接转调父类，调度主体仍沿用上游。
- **② worker patch（`patch/worker`）**：每个 Worker 实例化时在构造开头导入，替换通信组类、权重后处理、图尺寸判断与采样函数。例如 `GroupCoordinator` 被换成补上 `all_to_all`（每张卡向其余各卡发送各自独立分片的集合通信，见 [All-to-All](collective-communication.md#all-to-all)）的 `GroupCoordinatorPatch`。

模块符号表按进程隔离，前端后续改名不会自动同步到 EngineCore 或 Worker。`spawn` 启动的新解释器会重新加载补丁，`fork` 仅继承分叉瞬间的绑定与导入缓存；排查时须逐进程核对，入口传播见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。

## 为什么非打 patch 不可，代价在哪

vLLM 给硬件厂商留了三类正式扩展点：平台插件接管设备探测、Worker 选择与注意力后端；`CustomOp`（自定义算子注册机制，见[自定义模型与算子](dev-new-model-and-custom-op.md)）允许插件按同名算子登记昇腾实现；模型注册表则将模型架构名映射到昇腾模型类。插件的发现、过滤与激活流程见[平台注册](platform-plugin-registration.md#发现过滤激活)。

当上游尚未开放正式扩展点，或某个标准流程需要拦截内部工厂函数与配置校验时，`vllm-ascend` 只能借助 patch 直接替换符号或向内部登记表追加条目。以 `v0.30.0` 上运行常见模型（如 `Qwen3-8B` / `Qwen3-30B-A3B`）为例，四类接入机制分工如下：

| 机制 | 上游是否留口子 | 典型用途 |
|---|---|---|
| 平台插件 | 留了（安装元数据平台入口） | vLLM 选中 `NPUPlatform` |
| `CustomOp` 登记 | 留了（插件登记同名算子） | 将标准/线性注意力或融合算子切到昇腾实现 |
| 模型注册 | 留了（模型注册表） | 将模型架构名映射到昇腾模型类 |
| patch | 没留（改上游模块符号或向内部表塞条目） | KV 分组与协调器、调度器入口、通信组类、特定模型配置转换 |

patch 的动作主要有两种：多数是**改指向**（替换函数、类或方法），少数是**塞条目**（向 `transformers` 配置类型表或 vLLM 架构转换器表追加新条目），都在模块导入时执行。`CustomOp` 登记与模型注册分别发生在 Worker 构造和通用插件入口，属于正式扩展而非 patch。

「只改一个进程里的一个名字」会带来四项工程代价：

1. **进程隔离**：前端、EngineCore 与 Worker 各自的绑定须分别确认；`fork` 仅继承分叉前状态，`spawn` 从头加载，前端生效不等于 Worker 生效。
2. **`from-import` 副本滞留**：只改原模块表里的名字，不会更新早先通过 `from ... import ...` 复制走的引用，也不会改变已定义子类的父类。例如上游 EngineCore 提前导入了块大小计算函数，因此 `patch_kv_cache_utils` 必须在末尾同步覆写 EngineCore 模块里的那份副本；权重后处理补丁也同样双处改名。
3. **强绑定上游版本**：patch 依赖上游的函数名、签名与对象结构；一旦上游重构，旧 patch 要么改了没人调的名字，要么导入即报错。为此入口文件会按硬件能力表与版本条件筛选导入项。
4. **调用栈隐藏赋值现场**：`traceback` 只展示当前执行的函数位置（可能在 `patch/` 下，也可能在被引用的昇腾模块里），不会记录此前何时改过名。搜不到某函数的 patch 也不代表跑的是上游原版，必须连同派生类、模型注册、后端选择与 `CustomOp` 一起查，定位路线见[怎么读这个仓库](reading-vllm-ascend.md)。

`vllm-ascend` 官方设计文档对 patch 的态度很明确：它只是临时方案，长期目标是把改动合入上游。文档定下三条原则——能不打就不打（Less is more）、新增必写移除计划、随时欢迎清理；并要求每条补丁登记 **Why / How / Related PR / Future Plan** 四项。因此评估补丁健康度，不能只数文件个数，要连着上游关联与移除计划一起看。

## 两类 patch 各在什么时候、哪个进程里生效

patch 没有总开关或逐条启停接口，主要在模块导入时改写绑定或调用安装函数。分流函数 `adapt_patch(is_global_patch=...)` 逻辑直接：参数为真导入 `patch/platform`，为假导入 `patch/worker`。下面用四层漏斗与三层去重护栏，把「文件存在 → 条件导入 → 双处改写 → 实际调用」和入口去重一次画清：

```wiki-diagram
file: ascend-patch-system-fig-lifecycle
```

两类入口的核心区别在于**注入时机与所在进程**，而不是修改的对象类型（两个目录都有同名 `patch_distributed.py`，分别改芯片集合通信钩子与通信组类）：

| 入口 | 所在进程 | 执行时机与主要替换 |
|---|---|---|
| **平台准备钩子** `NPUPlatform.pre_register_and_update` | API server、`--headless` 启动进程、离线脚本 | 解析 CLI 参数与建配置前首行调 `adapt_patch(is_global_patch=True)`；覆盖配置校验、KV 分组、调度与引擎入口 |
| **三个通用插件入口**（连接器、加载器、采集） | API server、每个 EngineCore、每个 Worker | 各进程初始化加载通用插件时先调 `_ensure_global_patch()`（模型入口不调，见[平台注册页](platform-plugin-registration.md#三个通用入口先补一次全局补丁)），让不经过 CLI 解析的 EngineCore 也能在建调度器前打上 global patch |
| **Worker 构造开头** `NPUWorker.__init__` | 每个 Worker 进程（`uni` 时落 EngineCore 内） | 检查编译告警后立刻调 `adapt_patch()`，随后登记 `CustomOp`、初始化 `AscendConfig` 并调基类，确保后续建通信域直接拿到补丁版 `GroupCoordinator` |
| **按需延迟入口**（目录外） | 配置校验进程 / Worker `model_runner` | `profiling_chunk` 在确认开关开启时导入；`EAGLE-3 + PP > 1` 补丁在加载草稿模型时调用 |

`v0.30.0` 下 `patch/platform` 有 32 个 `patch_*.py`（按 `HardwareProfile` 能力表门控），`patch/worker` 有 19 个加 `patch_v2/` 14 个；`main` 退役 `patch_v2/` 并扁平合入为 30 个。`fork` / `spawn` 的跨进程传播及动态 EPLB 为何必须靠环境变量在 global patch 阶段换执行器，见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)与[进程怎么摆直接决定要打哪些补丁](engine-processes.md#进程怎么摆直接决定要打哪些补丁)。

## 同一个进程里，global patch 为什么只打一遍

新 API server 解释器启用全部通用插件时，三个通用入口会连续三次调用 `_ensure_global_patch`，随后的平台准备钩子又直接调 `adapt_patch`。如上图下半所示，链路靠三层进程内护栏去重：

1. **vLLM 插件加载器标记（`plugins_loaded`）**：**调用前置真**，再执行入口；若中途抛错，后续同进程调用直接返回且不重试（边界见[平台注册](platform-plugin-registration.md#发现过滤激活)）。
2. **`_ensure_global_patch` 模块标记（`_GLOBAL_PATCH_APPLIED`）**：**成功返回后置真**，拦住其余通用入口；若中途抛错，此前已完成的部分模块赋值仍留在内存中。
3. **Python 模块导入缓存（`sys.modules`）**：导入成功后后续 `import` 直接复用缓存。平台准备钩子绕过第 2 层，正是靠这一层和 `worker patch` 一样避免重跑（显式 `reload` 或直调安装函数另算）。

正常启用通用插件时，首次替换多由通用入口完成，后到的平台钩子直接命中导入缓存；若插件被过滤，平台钩子成为首次触发点。

**入口去重不等于补丁本身幂等。** 许多补丁采用「先保存原函数 → 再改写符号 → 非目标场景回落原函数」的包装写法（例如 KV 协调器工厂补丁）。若强行在同进程重跑第二遍，存下的「原函数」会变成昇腾版本自己，兜底回落将陷入自调用。为此部分补丁另加防重入保护：PP+MTP 用模块级标记，Worker 通信补丁给包装函数打记号，投机解码配置补丁先确认 `glm5_next_mtp` 不在类型表中再追加。

三层标记都是进程内变量：`spawn` 从初始状态重跑；`fork` 继承分叉瞬间的标记、符号绑定与 `sys.modules`（若分叉前插件标记已置真，子进程再调加载器直接返回）。

## 复杂异构实战对照：GLM 双机上哪些 patch 真的起作用

下面切到例外 B 历史绑定算例（GLM-5.3-Flash 双机，Atlas 800 A2、vLLM `0.23.0` + `vllm-ascend@db701c1f`，前提见[双机部署页](glm-5-3-flash-two-node.md#部署前提)），用四层漏斗逐层核对。

官方命令未设动态 EPLB 与 V2 model runner 环境变量。在「镜像未另行注入、Triton 可用、通用插件全开、`spawn` 模式」前提下，共 **19 个核心角色入口**加载 global patch（1 前端 + 2 EngineCore + 16 Worker，另含 node1 `headless` 启动入口；不含辅助进程），16 个 Worker 构造时各触发一次 `patch/worker`：

| 目录（`db701c1f`） | 目录文件数 | 静态条件直接导入 | 被门控跳过或可选的条目 |
|---|---|---|---|
| `patch/platform` | 28 | **23** | 跳过 310P 块长、2 个 EPLB 门控执行器、非 `0.23.0` FusedMoE / DP 设备号、延迟导入 `profiling_chunk`（共 5 项） |
| `patch/worker` | 24 | **19**（可选 +1） | 可选 `patch_npugraph_ex_triton` 捕获 `ImportError`；跳过 310P、非 `0.23.0` FusedMoE、V2 专家捕获与按需 EAGLE-3 流水线辅助 |
| `patch/worker/patch_v2` | 7 | **1** | `0.23.0` 将 V2 兼容标记置假，仅留复用 global patch 同名模块的 1 项 |

本部署里模型架构（`Glm5NextForCausalLM` 等）走模型注册表，KDA 线性注意力（`AscendKimiGatedDeltaNetAttention`，见[线性注意力](linear-attention.md)）走 `CustomOp` 登记，其余深入上游内部的位置才走 patch（GLM 层型见[模型介绍](glm-5-3-flash.md)）。与启动及[第 2 站调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)直接相关的 9 项 `global patch` 如下：

| patch 文件 | 替换或登记对象 | 用在哪一步 | GLM 双机上的实际效果 |
|---|---|---|---|
| `glm5_next_config` | `transformers` 配置表与架构转换器表 | 启动解析配置 | 识别 `glm5_next`，并凭 `kv_lora_rank` 按 [MLA](mla.md) 解析 |
| `speculative_config` | 草稿配置改写函数；MTP 类型表追加 `glm5_next_mtp` | 建 MTP 配置 | 将草稿类型转为 `glm5_next_mtp`，定位昇腾 MTP 类 |
| `mamba_config` | 混合模型配置校验函数 | 建配置 | 推导出主逻辑块 640 token、KDA 状态组块 133120 token |
| `use_v2_model_runner` | V2 runner 选用判定 | 选 runner | 仅查环境变量，未设则用 V1 的 `NPUModelRunner` |
| `kv_cache_utils` | KV 分组与块长函数（含 EngineCore 副本） | 建 KV 块 | 按 GLM 布局分组，调度器块长取最小公倍数 133120 |
| `kv_cache_coordinator` | KV 协调器工厂（含缓存副本） | 建 KV 管理器 | 非 DSV4 且关闭前缀缓存时回落上游无前缀缓存协调器 |
| `mamba_manager` | KDA 状态组管理器类 | 第 2 站分块 | 换为 `AscendMambaManager`，改前缀命中与外部 KV 分支 |
| `glm5_next_mamba_scheduler` | 状态存档点对齐切分方法 | 第 2 站 | 已替换但仅 `align` 模式调用；本部署为 `none`，不执行 |
| `balance_schedule` | 调度器类与 EngineCore 入口 | 启动与第 2 站 | 均衡开关关闭，二者均直接转回原实现 |

上表后五行即[调用链页](request-call-chain.md#源码位置)的「第 2 站五处替换」（640 与 133120 推导见[双机部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)，均衡开启见 [Balance Scheduling](balance-scheduling.md)，维护分支 `kv_producer` 例外见[版本差异](#版本差异)）。`AsyncScheduler` 的父类取决于首次导入时机：晚于 `Scheduler` 替换则继承 `BalanceScheduler`，早于替换则保持原父类，实机须核 MRO。

落在 GLM 请求路径上的 5 项 `worker patch`（各 Worker 进程生效）：

| patch 文件 | 替换对象 | 用在哪一步 | GLM 双机上的实际效果 |
|---|---|---|---|
| `process_weights_after_loading` | 权重后处理函数（双模块引用） | 权重加载末步 | 额外识别 GLM 的 MLA 层，转为昇腾排布 |
| `distributed` | `GroupCoordinator` 与销毁函数 | 建通信域 | 仅对新建组生效，管理 HCCL 并提供 `all_to_all`（单卡直通） |
| `qwen3_next_mtp` | `bind_kv_cache` | 建 KV 张量 | 解除同层号多注意力层名报错；虽带 Qwen 名，GLM 同样经过 |
| `cudagraph` | 图尺寸描述计算方法 | 每步选图 | 修正 `FULL` 图模式下均匀 decode 批的判定 |
| `rejection_sampler` | 上游拒绝采样三个函数 | 第 5 站验证 | 已替换，但 `AscendRejectionSampler.forward` 直调自有函数不经过它 |

最后一行提醒：**patch 与派生类并存时，须核对子类是否重写调用路径**。其余已导入的 patch（含 API server 侧 3 项输出补丁）按与 GLM 路径的关系归为五类：

| 归类 | 代表补丁 | 在 GLM 双机上的实际状态 |
|---|---|---|
| **API 侧按内容触发（3 项）** | 响应 `model_dump`/`model_dump_json` / 流式工具拆块 / 结构化输出校验 | 同时包装 `model_dump` 与 `model_dump_json` 剔除空列表 `tool_calls`；仅单 choice + `finish_reason=tool_calls` 且非空参数拆块；先调上游再查同引擎混用后端 |
| **跨模型共享 vs 独立路径** | `patch_qwen3_next_mtp` / `patch_triton` / 上游 GDN 补丁 | 不可凭文件名排除共享函数；GLM 的 KDA 直走 `kda_attention`，不经上游 GDN 补丁；`next_power_of_2` 仅作兼容兜底 |
| **随功能开关激活** | 工具调用解析（FAQ 给 `glm47`/`glm45`）、睡眠、[RL 同步](vllm-ascend-for-rl.md#训练端和推理端怎样交接显存与权重)、`preprocess_mamba` | 官方主命令未开对应开关或非 `align` 模式，须追到实际消费者 |
| **消费者待日志确认** | `npugraph_ex`/`torchair` `ValuePack`、`torch.accelerator` 显存 API、MLA prefill 占位后端 | 已替换符号：将 4 个 `torch.accelerator` 显存 API 重定向到 `torch.npu`；MLA prefill 占位后端若被调用直接抛 `NotImplementedError`（GLM 路径是否触发仍须运行日志核对） |
| **内部条件早退** | `patch/platform/patch_distributed`、PP+MTP 校验补丁 | 前者仅 310P 替换（A2 无操作）；后者仅 `PP > 1` 生效（本部署 `PP=1` 直回原方法） |

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
