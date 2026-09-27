---
id: npu-worker-lifecycle
title: NPUWorker 启动：设备、权重与状态池
type: feature
summary: 追踪 Worker 从进程内适配到设备通信、权重、缓存预算和预热的依赖，区分显式内存预算与自动测算，以及启动分配池和运行时分配请求块。
aliases: [NPUWorker, WorkerBase, Worker 生命周期, worker 启动, 启动时序, init_device, compile_or_warm_up_model]
chapters: ["10"]
order: 110
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L90-L133
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L524
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L668-L691
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L905
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L399-L418
verified: []
evidence: "C"
relations:
  - {to: engine-processes, kind: builds-on, note: Worker 是设备执行角色，其进程位置取决于执行器}
  - {to: kv-cache-spec, kind: builds-on, note: 池内状态形状来自实际层的规格}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 运行时为请求分配与回收块}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 请求到达前要准备什么

[单请求](one-request.md)与[并发请求](concurrent-requests.md)介绍的是服务已可执行时的计算过程。启动阶段先建立这些计算依赖：设备与通信环境、模型权重、历史状态池以及可选的编译和图执行资源。

`NPUWorker` 管理设备侧生命周期，`NPUModelRunner` 组织模型执行。Worker 是角色，是否占用独立进程由执行器决定；实际实例数量与并行拓扑相关，见[进程与执行器](engine-processes.md)。

```wiki-diagram
file: worker-lifecycle
```

图展示主要依赖及条件分支；缓存预算既可能来自显式设置，也可能来自测算，预热之后是否捕获图取决于配置与支持路径。

## 进程内准备与设备通信

Worker 构造函数先加载 Worker 补丁，注册相应算子，初始化 Ascend 配置，再执行基类构造。[C1] 这些动作使后续加载与计算能找到正确的设备实现。

`init_device()` 完成设备初始化，建立工作区管理器，再创建 ModelRunner，原因是 Runner 构造需要已经确定的设备。[C2] 设备准备还包括分布式环境：相关方法以 `hccl` 初始化通信，并建立模型并行与 Ascend 并行组。[C3]

通信组规定哪些 rank 参加同一个操作。rank 是组内参与者编号，TP/PP 等组表达计算协作关系；它们不是模型的 token 编号。具体数据交接先见[通信基础](collective-communication.md)，再读各并行策略。

## 创建模型并提供权重

`load_model()` 调用 Runner 的加载路径，按配置创建模块和装载权重。[C4] 加载器决定数据从哪里获得，不能把所有路径都简化成从本地磁盘读。启用 sleep mode 时，权重放入带专门标签的内存池；还可以配置后续权重传输引擎。

对于 GLM，已注册的模型类决定 45 层混合结构；并行实现决定本 rank 需要持有哪些参数。权重形状和存储格式必须与实际实现相符。本文解释生命周期，没有验证专用镜像与权重在某台设备上的完整加载。

## 缓存预算有两条路径

`determine_available_memory()` 返回可用于历史状态的字节预算。[C5]

**显式设置 `kv_cache_memory_bytes`** 时，Worker 仍调用 `profile_run()` 以完成相应编译准备，随后直接返回指定值；这条路径跳过自动容量测算，并不按 `gpu_memory_utilization` 推导该值。

**未显式设置**时，Worker 在权重加载后执行 profiling，估计权重、非 PyTorch 占用和运行峰值等非缓存开销，再从目标内存预算扣除，得到可用缓存预算。测量依赖启动时内存快照；其他进程在期间释放内存可能破坏断言前提。

两条路径都需要后续分配成功。显式填写一个很大的数字不会增加物理容量，自动测算值也必须转换成各层可接受的[缓存规格](kv-cache-spec.md)。GLM 的 MLA 与 KDA 历史状态不同，不能统一按普通逐 token K/V 张量估算。

## 启动分配池，运行时分配请求块

`initialize_from_config(kv_cache_config)` 准备 KV 传输相关状态，并让 Runner 按缓存配置实际分配张量；sleep mode 可使用专门的缓存内存池。[C6]

这一步建立可使用的物理存储。请求 A 到来后分到哪些块、请求 C 是否复用某个完整前缀、何时释放引用，是运行时缓存管理器的工作。[C8] 启动时还不知道这些请求，因而不能说请求的物理块映射已经确定。对应关系见[块表](block-table.md)和[块分配](vllm-kv-block-allocation.md)。

## 预热与条件捕获

`compile_or_warm_up_model()` 根据编译尺寸执行 dummy run，并为捕获尺寸与编译范围处理相应准备；非 `enforce_eager` 路径才调用 `capture_model()`。[C7] 调用捕获入口也仍受实际图模式与支持范围约束，不能推断之后所有批次都回放同一张完整图。

预热使某些延迟到首次执行的准备提前完成，图捕获则服务于可复用的执行模式。运行时的批形状、分支与后端条件决定是否适用，见[图模式](graph-mode-layer.md)。普通单请求每轮输入一个 token 也不代表整个并发批次只有一个 token。

## 从失败位置判断依赖

| 失败阶段 | 先核对什么 |
|---|---|
| 模块、补丁或算子初始化 | 固定版本、依赖、导入条件与实际注册对象 |
| 设备或 HCCL 初始化 | 设备可见性、rank 与通信组配置、运行环境 |
| 权重加载 | 架构名称、加载器、张量格式与本 rank 的分片 |
| 预算测算或状态分配 | 显式预算/自动路径、非缓存占用、状态规格 |
| 预热或图捕获 | 最后成功的阶段、目标尺寸和实际图模式 |

这种定位顺序把报错放回架构依赖中。没有 NPU 的读者仍可沿方法和图理解启动过程；设备容量、通信可用性及耗时需要部署实测。
