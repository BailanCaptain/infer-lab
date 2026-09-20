---
id: ascend-config-system
title: AscendConfig 配置系统
type: feature
summary: --additional-config 的那段 JSON 由 AscendConfig 按键拆成十来个子配置对象，存成进程内单例；环境变量走另一条路。
aliases: [AscendConfig, additional_config, additional-config, init_ascend_config, get_ascend_config, envs.py]
chapters: ["10"]
order: 100
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L50
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L524-L530
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L598-L604
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L680-L690
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L913-L930
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L932-L944
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L472
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L90-L126
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L21-L105
evidence: "C"
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: init_ascend_config 是 NPUWorker.__init__ 的一步，单例什么时候有值由启动时序决定
  - to: one-request
    kind: builds-on
    note: 那条请求没配任何昇腾开关，走的全是这套默认值
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

昇腾特有的开关都从 `--additional-config` 那一段 JSON 进来。上游 vLLM 只把它原样放在 `VllmConfig.additional_config` 里，真正解释它的是 `AscendConfig`：按键拆成十来个子配置对象，存成进程内单例，全仓各处用 `get_ascend_config()` 取 [C1][C6]。

```wiki-diagram
file: config-flow
```

## 那条请求走到这里

那条请求一个 `--additional-config` 都没配，走的全是默认。

即便如此，`AscendConfig` 单例**仍然必须存在**——`NPUWorker.__init__` 里那句 `init_ascend_config(vllm_config)` 不是可选步骤 [C8]。它跑完之后，十来个子配置对象各自拿着一份空 dict 的默认值坐在那儿，等着被读。

所以那条请求真正「用到」的配置，是一串没人显式写过的默认值。这也是排查时的一个起点：**看到行为不符合预期，先确认那个键在 `ascend_config.py` 里真的存在**——键名拼错不会报错，只会安静地走默认 [A]。

## 一层 JSON 对应一个子配置类

`AscendConfig.__init__` 的主体是一串固定形状的三行：从 `additional_config` 里 `get` 一个键、拿到一个 dict、交给对应的子配置类 [C1]。例如：

```python
xlite_graph_config = additional_config.get("xlite_graph_config", {})
self.xlite_graph_config = XliteGraphConfig(xlite_graph_config, vllm_config)
```

所以「某个昇腾开关叫什么、放在哪一层」这个问题，答案全在这个文件里：搜键名就能找到它属于哪个子配置类 [A]。v0.23 分支上的子配置类包括 `FinegrainedTPConfig`、`AscendCompilationConfig`、`AscendFusionConfig`、`XliteGraphConfig`、`WeightPrefetchConfig`、`ProfilingChunkConfig`、`RejectionSamplerConfig`、`EplbConfig` 等 [C2][C3][C4]。

## 单例的两个动作分得很干净

`init_ascend_config(vllm_config)` 负责造：已经有缓存、没有传 `refresh`、且缓存绑定的还是同一个 `vllm_config` 对象时，直接返回旧的；否则新建一个 [C5]。新建之后还要过一道 `_is_ascend_config_initialized` 检查，没通过就只警告、不更新单例缓存 [C5]。

`get_ascend_config()` 负责取，而且**没初始化就直接抛 `RuntimeError`**，错误消息是 `"Ascend config is not initialized. Please call init_ascend_config first."` [C6]。这是个很有用的性质：如果你在某个新代码路径里拿到这条报错，说明这段代码跑在 `init_ascend_config` 之前，而不是配置写错了 [D]。

`init_ascend_config` 在 `NPUWorker.__init__` 里被调，位置在注册算子之后、`super().__init__()` 之前 [C8]。

## 谁最后说了算

`additional_config` 的值不是终局。`NPUPlatform.check_and_update_config` 在启动时会跑完四个校验再初始化 AscendConfig [C7]，其中 `_validate_layer_sharding_config` 这类会直接抛错、拦掉不合法的组合。所以排查「我配了但没生效」时，顺序应该是：先确认键名在 `ascend_config.py` 里存在，再看 `check_and_update_config` 有没有把它改掉或拦掉 [A]。校验族的清单见 [NPUPlatform](npu-platform.md)。

## 环境变量是另一条路

`vllm_ascend/envs.py` 里有一张 `env_variables` 表，v0.23 分支上 21 个条目 [D]，分两类：构建期的（`MAX_JOBS`、`CMAKE_BUILD_TYPE`、`COMPILE_CUSTOM_KERNELS`、`SOC_VERSION`、`ASCEND_HOME_PATH` 等）和运行期的开关（`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`、`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_BALANCE_SCHEDULING` 等）[C9]。

这些**不进 `AscendConfig`**，代码里是直接读 `envs_ascend.XXX`。判断一个开关该从哪儿配：名字带 `VLLM_ASCEND_` 前缀或全大写的去 `envs.py` 找，小写下划线的键名去 `ascend_config.py` 找 [A]。

## 常见误解

- **「`--additional-config` 是上游 vLLM 的功能，所以文档在 vLLM 那边」**——上游只提供这个口子并原样保存，键的含义全部由 `AscendConfig` 定义 [C1]。查昇腾的键要看昇腾的源码或昇腾的文档。
- **「拿不到配置是因为 JSON 写错了」**——`get_ascend_config()` 抛的那条 `RuntimeError` 说的是**时机**不对，不是内容不对 [C6]。
- **「同一进程里配置只解一次」**——`additional_config` 里带 `refresh` 时会重建；绑定的 `vllm_config` 换了对象也会重建 [C5]。
