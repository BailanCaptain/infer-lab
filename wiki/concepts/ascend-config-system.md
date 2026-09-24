---
id: ascend-config-system
title: 昇腾的开关从哪进来
type: feature
summary: 昇腾特有的开关写在启动命令附带的一段 JSON 里：上游原样带着不解释，昇腾启动时按键拆成八组配置对象，整个进程只存一份，各组件随取随用；环境变量走另一条互不相通的路。
aliases: [AscendConfig, additional_config, additional-config, init_ascend_config, get_ascend_config, envs.py, AscendConfig 配置系统]
chapters: ["10"]
order: 100
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L50
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L524-L530
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L598-L604
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L662-L723
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L913-L930
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L932-L944
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L475
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L90-L126
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L21-L113
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L763-L840
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L337-L346
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L86
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1039
  - vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 造配置单例是 Worker 启动的一步，单例什么时候有值由启动时序决定
  - to: one-request
    kind: builds-on
    note: 那条请求没配任何昇腾开关，走的全是这套默认值
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

昇腾特有的开关不是上游 vLLM 的正式启动参数，而是全从启动命令附带的**一段 JSON** 进来的：上游只负责把这段 JSON 原样带在身上、一个字都不解释；昇腾插件在启动时把它按键拆成八组配置对象，整个进程只存这一份，各组件要用时直接取。环境变量是另一条互不相通的路。

```wiki-diagram
file: config-flow
```

## 配了一个开关，行为却没变

先摆一个排查现场：你照着文档，在启动命令附带的那段 JSON 里加了一个昇腾开关，重启服务——行为一点没变，日志里也**没有任何报错**。开关去哪了？

答案几乎总是下面三种之一：

1. **键名拼错了，或者层级放错了**。拆 JSON 的时候只按认识的键拿，不认识的直接略过，不报错，安静地走默认值。
2. **这个键在你用的版本里不存在**。键在不同版本之间会挪位置、会被删掉，写一个已经不存在的键和拼错一样：不报错，不生效。
3. **它根本是个环境变量**，不在 JSON 这条路上，写进 JSON 里没人会去读。

三种情况都「安静」，所以排查不能靠等报错，得知道配置从命令行走到组件手里的这条路长什么样。

## 两条互不相通的路

昇腾的开关分两拨，走两条完全分开的路：

- **小写下划线的键名**，写在启动命令附带的 JSON 里——走配置对象这条路，也就是本页主要讲的这条。
- **全大写、带昇腾前缀的名字**——是环境变量，代码里哪里用哪里直接读，**不进配置对象**，启动检查也管不到它。

看到一个开关，先按名字的长相判断它在哪条路上，再去对应的地方查。把环境变量写进 JSON、或者把 JSON 的键设成环境变量，都属于第 3 种「安静失效」。

## 一段 JSON 怎么变成能用的配置

上游 vLLM 收到这段 JSON 后不做任何解释，原样存着往下传。真正拆它的是昇腾插件：启动时按 JSON 第一层的键，一个键对应一组配置对象（v0.23 上一共八组，图优化一组、算子融合一组、专家均衡一组……各管一摊），没写的键一律用默认值补上。

拆完的结果存成**进程里唯一的一份**。之后全仓任何组件要看开关，都从这一份里取——不会有两个组件各拿一份、值还不一样的事。

这个「唯一一份」不是可选的：每个 Worker 进程（见[引擎有哪几个进程](engine-processes.md)）启动时都必须先把它造出来，哪怕你一个开关都没配。取的一侧也有讲究：**造好之前就来取，会直接报错**，错误消息明说「配置还没初始化」——所以那条报错说的是取的时机不对，不是你的 JSON 内容写错了。

## 你写的值不是终局

JSON 里的值拆完之后，启动时平台还有一道检查（见 [NPU 平台](npu-platform.md)），会跑完几个校验再放行：不合法的组合会被**当场报错拦下**——这是这条路上少数会大声说话的地方；有些值也会在这一步被改写。

所以「配了没生效」的完整排查顺序是：

1. 先确认键名在你这个版本里**真的存在**、层级放对了；
2. 再看启动检查有没有把它改掉或拦掉；
3. 如果压根找不到这个键，去环境变量那条路上找——它可能根本不走 JSON。

## 那条请求一个开关都没配

全库跟的例子（Qwen3.6-35B-A3B 跑在两颗 NPU 上，见[那条请求](one-request.md)）一个昇腾开关都没配。即便如此，那份配置还是在每个 Worker 启动时被完整造了出来：八组配置对象各自拿着默认值坐在那儿，等着被读。

所以那条请求真正「用到」的配置，是一串没人显式写过的默认值。这也解释了为什么拼错键名不报错——对拆 JSON 的代码来说，「你写了一个它不认识的键」和「你什么都没写」看起来是一回事。

## 常见误解

- **「这段 JSON 是上游 vLLM 的功能，所以文档在 vLLM 那边」**——上游只提供这个口子并原样保存，每个键的含义全部由昇腾插件定义。查昇腾的键要看昇腾的源码或昇腾的文档。
- **「拿不到配置是因为 JSON 写错了」**——「配置还没初始化」那条报错说的是**时机**不对：取配置的代码跑在造配置之前。JSON 内容写错的典型表现恰恰是没有报错。
- **「同一进程里配置只解一次」**——通常是，但带刷新标记时会重建；绑定的上游配置对象换了，也会重建。

## 对照源码

### 怎么开

**JSON 这条路**：启动命令加 `--additional-config '{...}'`。上游把它原样存进 `VllmConfig.additional_config`，解释它的是 `AscendConfig`：`__init__` 的主体是一串固定形状的两行——从 `additional_config` 里 `.get()` 一个键、拿到一个 dict，再交给对应的子配置类 [C1]。例如：

```python
xlite_graph_config = additional_config.get("xlite_graph_config", {})
self.xlite_graph_config = XliteGraphConfig(xlite_graph_config, vllm_config)
```

所以「某个键叫什么、放在哪一层」的答案全在 `ascend_config.py` 这一个文件里：搜键名就能找到它属于哪个子配置类 [A]。v0.23 分支上的子配置类一共八个：`FinegrainedTPConfig`、`AscendCompilationConfig`、`AscendFusionConfig`、`XliteGraphConfig`、`WeightPrefetchConfig`、`ProfilingChunkConfig`、`RejectionSamplerConfig`、`EplbConfig` [C2][C3][C4][C10]。

单例的两个动作分得很干净：

- `init_ascend_config(vllm_config)` 负责造：已经有缓存、缓存过得了 `_is_ascend_config_initialized`、没有传 `refresh`、且缓存绑定的还是同一个 `vllm_config` 对象时，直接返回旧的；否则新建 [C5]。调用点在 `NPUWorker.__init__` 里，位置在注册算子之后、`super().__init__()` 之前 [C8]。
- `get_ascend_config()` 负责取，全仓各处直接调它 [C6]。

**环境变量这条路**：`vllm_ascend/envs.py` 里一张 `env_variables` 表，v0.23 分支上 21 个条目 [D]，分两类：构建期的（`MAX_JOBS`、`CMAKE_BUILD_TYPE`、`COMPILE_CUSTOM_KERNELS`、`SOC_VERSION`、`ASCEND_HOME_PATH` 等）和运行期开关（`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`、`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_BALANCE_SCHEDULING` 等）[C9]。这些不进 `AscendConfig`，代码里直接读 `envs_ascend.XXX` [A]。判断规则：名字带 `VLLM_ASCEND_` 前缀或全大写的去 `envs.py` 找，小写下划线的键名去 `ascend_config.py` 找 [A]。

### 会报什么错

- `get_ascend_config()` 在没初始化时直接抛 `RuntimeError`，消息是 `"Ascend config is not initialized. Please call init_ascend_config first."`。这是个有用的性质：在新代码路径里拿到这条报错，说明这段代码跑在 `init_ascend_config` 之前，而不是配置内容写错了 [D]。
- 拼错键名**不会报错**：`AscendConfig.__init__` 全程 `.get()`，接 `**` 的那两个子配置类也都带 `**kwargs` 兜底，两个发布分支上不认识的键都被静默忽略 [D]。
- `init_ascend_config` 新建实例后还要过一道 `_is_ascend_config_initialized` 检查，没通过时**只警告、不更新单例缓存**。
- 启动校验会大声拦：`NPUPlatform.check_and_update_config` 在初始化 AscendConfig 前后跑完四个校验 [C7]，其中 `_validate_layer_sharding_config` 这类会直接抛 `ValueError`、拦掉不合法组合 [C11]。校验族的完整清单见 [NPU 平台](npu-platform.md)。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `AscendConfig.__init__` 的写法 | 逐键 `.get()` 拿 dict，再交给子配置类 | 一字不差还是这一套，没有换成 pydantic [C12] | [!] main 开发主线上这块已迁到 pydantic（`extra="forbid"`）；照 main 写的说明去 v0.26 上找严格校验会扑空 |
| `__init__` 直接造的子配置类 | 8 个，含 `WeightPrefetchConfig` 与 `ProfilingChunkConfig` | 还是 8 个，但 `WeightPrefetchConfig` 已删、`ProfilingChunkConfig` 挪进 `scheduler_config` 下，换上 `SchedulerConfig` 与 `SparseKVOffloadConfig` | 照 v0.23 配 `weight_prefetch_config` 在 v0.26 上不报错也不生效 |
| 调度相关的键放哪一层 | 只有顶层 | 推荐嵌在 `scheduler_config` 下；顶层仍然认，但打一条 deprecated 警告，两处都写时以嵌套的为准 [C13] | 受影响的是这五个键：`enable_balance_scheduling`、`recompute_scheduler_enable`、`short_request_first_config`、`profiling_chunk_config`、`batch_job_sched_config` |
| 不认识的键怎么处理 | 静默忽略 | 一样静默忽略 [D] | 两个发布分支上拼错键名都不会报错，只会安静走默认 |
| 启动校验 | 四个校验，含 `_validate_layer_sharding_config` | 只剩两个校验，`_validate_layer_sharding_config` 连同 `layer_sharding` 这个键一起没了 | 同一个键「配了会被拦」还是「压根不存在」，取决于版本 |
| `env_variables` 条目数 | 21 个 | 20 个：删了 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 与 `VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE`，新增 `VLLM_ASCEND_MLA_FIA_SPLIT` [C14] | 「怎么开」里举的 matmul-allreduce 那个开关是 v0.23 的例子，在 v0.26 上设它没有任何作用 |

### 源码位置

- `AscendConfig.__init__` 逐键拆分：`vllm_ascend/ascend_config.py:27-50`；子配置类：`:524-530`、`:598-604`、`:662-723`、`:763-840`
- 单例造与取：`ascend_config.py:913-930`（`init_ascend_config`）、`:932-944`（`get_ascend_config`）
- 调用点：`vllm_ascend/worker/worker.py:90-126`（`NPUWorker.__init__`）
- 启动校验：`vllm_ascend/platform.py:450-475`（`check_and_update_config`）、`:337-346`（`_validate_layer_sharding_config`）
- 环境变量表：`vllm_ascend/envs.py:21-113`
- v0.26 分支：`ascend_config.py:61-86`（子配置类清单）、`:968-1039`（`scheduler_config` 嵌套与 deprecated 警告）、`envs.py:30-107`、`platform.py:408-426`（只剩两个校验）
