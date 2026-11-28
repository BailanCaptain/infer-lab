---
id: ascend-config-system
title: Ascend 配置：三个地方能写，哪个值真的生效
type: feature
legacyAnchors:
  落到-glm-双机一个-json-键都没传: 省略-json-时怎样核对最终生效值
  复杂异构实战对照glm-双机为何一个-json-键都没传: 省略-json-时怎样核对最终生效值
  v0300-与-main-的严格校验与环境变量收口: 解析完还会被改写：生效值不是你写的值
summary: >-
  昇腾开关分散在三个入口——命令行通用参数、--additional-config JSON 与环境变量。本页先以 v0.30.0
  主基线的 Pydantic 严格解析链路和 Qwen3 常用配置讲清合并、校验与改写机制，再对照 GLM 双机案例与四版本差异。
aliases:
  - AscendConfig
  - additional_config
  - additional-config
  - init_ascend_config
  - get_ascend_config
  - envs.py
  - multistream_overlap_shared_expert
  - AscendConfig 配置系统
chapters:
  - '10'
order: 100
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1488-L1490'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L355-L363'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L476-L486'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2223-L2230'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L94'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L160'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L256'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L560'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L745'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L30-L113'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L112-L124'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L200'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L676-L695'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L332'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L744-L782'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L360'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L430-L608'
  - 'vllm-ascend@baa023ad:vllm_ascend/envs.py#L38-L90'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1536-L1700'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L876'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L317-L346'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L609-L628'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - >-
    raw:sha256-e33d10f727ae241a4c63517340397bd46f2b5da6eed35c991c5eb541a6ca79a9.md#L1-L1264
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L565-L677'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1793-L1944'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L752-L806'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L679'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L283-L314'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L204-L239'
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L956-L966'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L268-L276'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L1024-L1084'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L80-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1624-L1635'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1176-L1187'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L579-L682'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L867-L874'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L659'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1402-L1440'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L562-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L745-L756'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1795-L1951'
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L652-L737'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L845-L865'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1909-L2078'
  - 'vllm-ascend@8d6180e2:vllm_ascend/envs.py#L51-L95'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L685'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: engine-processes
    kind: builds-on
    note: 配置缓存是进程里的一个变量，进程边界决定它属于谁
  - to: npu-platform
    kind: builds-on
    note: NPUPlatform.check_and_update_config 在前置校验后触发 init_ascend_config 并按角色改写开关
  - to: ascend-patch-system
    kind: builds-on
    note: patch 换的是名字指向谁，发生得比配置更早
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-1d32b572cfa7effcf6bc2b6876b3b8d672a41e7c59caf52ef95d8903f1aa02f7.md
  - >-
    raw/sha256-e33d10f727ae241a4c63517340397bd46f2b5da6eed35c991c5eb541a6ca79a9.md
---

昇腾的开关不止一个入口：有的是 vLLM 自己的命令行参数，有的要写进 `--additional-config` 这段 JSON，还有一些只认环境变量。**`AscendConfig` 是 `vllm-ascend` 的进程内配置对象：它把 `--additional-config` 中的 JSON 拆成多组强类型子配置，供 Worker、调度器和算子使用。** 该对象在各进程初始化时建立并缓存；最终是否生效，还要经过派生校验、平台改写与消费者条件判断。

## 同一个开关，为什么有三个地方可以写

启动命令描述这次服务要跑什么模型、开多大并行、每步多少 token 以及如何执行。在 `v0.30.0` 主基线下，这些输入分三路进入进程：

- **命令行通用参数**：上游 vLLM 声明的正式字段（如 `--tensor-parallel-size`、`--gpu-memory-utilization`），解析后进入 `VllmConfig` 的模型、并行与调度子配置。参数名写错会当场启动失败。
- **`--additional-config` JSON 容器**：上游留给硬件插件的不透明字典，上游自己不解释里面的键，只在计算编译缓存 hash 时整段纳入。绝大多数键由 `vllm-ascend` 解析，少数由上游内部写入（例如 GDN prefill 后端选择键）。以常见 `Qwen3-8B` / `Qwen3-30B-A3B` 昇腾部署为例，开启融合编译或序列并行时常见写法如下：
  ```bash
  --additional-config '{"ascend_compilation_config":{"fuse_norm_quant":true},"enable_flashcomm1":true}'
  ```
- **环境变量**：`vllm_ascend/envs.py` 在 `v0.30.0` 维护着 14 条环境变量表（另有代码直接调 `os.getenv` 读表外变量如动态 EPLB 开关，以及由 TorchNPU / CANN 运行时直接消费的 `TASK_QUEUE_ENABLE`、`PYTORCH_NPU_ALLOC_CONF`、`HCCL_OP_EXPANSION_MODE` 等底层表外变量，详见[昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）。绝大多数构建期或极早期开关由消费者直接读取，只有极少数参与 `AscendConfig` 兜底。读取表的属性访问每次都会重读当前进程的 `os.environ`。

```wiki-diagram
file: config-inputs
```

图从左往右看：通用参数进上游 `VllmConfig` 字段，JSON 键交给 `AscendConfig` 拆成子配置，环境变量则分为「喂入配置对象」与「消费者直读」两股。直接读环境变量的路径不经过 `AscendConfig`，排查时必须顺着具体消费者核对校验逻辑。

## 为什么不合成一路，代价是什么

昇腾开关不全部做成上游 CLI 参数，是为了在不修改 vLLM 参数解析器的前提下独立迭代。代价是**平台键的含义、层级与组合约束都必须由插件自己兜底**，同时 JSON 语法、容器类型与可哈希性仍须满足上游要求。

环境变量得以保留，则出于两类硬时机约束：一是全局 patch 在解析 CLI 参数时就导入，早于 `AscendConfig` 构造（如动态 EPLB 必须靠环境变量触发，见[进程怎么摆决定要打哪些补丁](engine-processes.md#进程怎么摆直接决定要打哪些补丁)）；二是自定义算子编译阶段使用的构建期开关与推理服务无关。

| 入口 | 谁负责解释键名 | 拼错名字会怎样（`v0.30.0` 主基线） |
|---|---|---|
| 命令行通用参数 | 上游 vLLM 解析器 | 直接报错，服务无法启动 |
| `--additional-config` JSON | `vllm-ascend`（少数键归上游） | Pydantic `extra="forbid"` 立即拒收（装 `vllm_omni` 时未知顶层键先告警后过滤） |
| 环境变量 | 具体消费者或配置兜底逻辑 | 拼错通常无统一提示，且可能存在表外直读 |

> **历史版本边界**：在旧版 `v0.23.0`（含 GLM 镜像）与 `v0.26.0rc` 的手写 `.get()` 路径上，顶层和多数子配置会静默忽略未知键并走默认值，只有 `eplb_config` 等自行遍历字典的子配置会报错（详见[会报什么错](#会报什么错)）。

三路入口并存还会带来两项隐性工程代价：

1. **影响编译缓存键**：上游把非空 `--additional-config` 的完整内容纳入配置 hash，进而影响默认编译缓存目录标识。改一个看似无关的键也可能导致未命中旧缓存（不会主动删除已有产物，是否重编仍取决于编译模式与缓存开关）。
2. **双入口兼容与退役迁移**：同一开关既能写 JSON 又能写环境变量时，必须明确覆盖顺序。旧版在回退环境变量时会打迁移提示；到 `v0.30.0`，`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON` 等旧变量均已从 `envs.py` 退役并收归 `additional_config`，仅留 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 做兜底。

## JSON 进来以后被拆成什么

在 `v0.30.0` 主基线中，`init_ascend_config` 工厂先取出兼容的旧顶层调度键（5 个，含 `profiling_chunk_config`；`main` 为 4 个），转交 `scheduler_config` 构造。Omni 场景在检测到 `vllm_omni` 入口时，对未知顶层键先打告警再过滤。余项进入 **Pydantic dataclass**（`ConfigDict(extra="forbid")`）严格构造，一次拆成 **12 组强类型子配置**与若干顶层开关（`main` 移除 `dynamic_spec_config`，新增 `shared_engram`、`kv_trace` 与 `quantized_all_reduce_config` 扩至 14 组，另含 `runtime_config`）：

| 子配置键名 | 负责什么 |
|---|---|
| `ascend_compilation_config` | 图编译期融合 pass（例如将 norm 与紧随量化融合成单算子） |
| `ascend_fusion_config` | 运行期融合算子开关（例如 MoE 中 **GMM**［Grouped MatMul，分组矩阵乘］、**SwiGLU** 门控激活与量化三步合一） |
| `ascend_warmup_config` | 启动预热开关（`v0.30.0` 两项默认 `false`） |
| `scheduler_config` | 昇腾扩展调度配置（收拢均衡调度、重算调度与 profiling 分块等） |
| `finegrained_tp_config` | 细粒度 TP，为注意力输出投影、词嵌入、LM head 等模块单独指定 TP 规模（见[细粒度 TP](fine-grained-tp.md)） |
| `eplb_config` | 专家负载均衡，统计专家热度并调整分布（见 [EPLB](eplb.md)） |
| `xlite_graph_config` | Xlite（昇腾轻量整图执行引擎）图执行路径配置 |
| `rejection_sampler_config` | 投机解码拒绝采样选项（见[投机解码](speculative-decoding.md)） |
| `rl` / `dynamic_spec` / `sparse_kv_offload` / `kvpp` | 强化学习权重同步、动态投机解码、稀疏 KV 卸载与 [KVPP](kvpp.md)（KV 预取并行）扩展 |

> **历史结构对照（`v0.23.0` / GLM 镜像）**：旧版手写 `.get()` 路径共拆 8 组子配置——包含已被后续版本删除的 `weight_prefetch_config`（注意力/MoE/MLP 权重预取比例）与独立顶层的 `profiling_chunk_config`（启动量测 prefill 耗时拟合分块曲线）；且旧版在 Worker 类为 `auto`、非 310P 分支下才按 `xlite_graph_config` 自动切换 Xlite 专用 Worker。

**层级决定谁能读到。** 子配置只读取属于自己那一层的字典：把子配置键误写在顶层，`v0.30.0` 会被 `extra="forbid"` 当场拦下（旧版则会静默忽略）；顶层键与子配置同名键也不等价。拿不准层级时必须核对当前版本的 `ascend_config.py`。

拆解结果缓存在进程级模块变量 `_ASCEND_CONFIG` 中。`spawn` 启动的新解释器各自初始化缓存，`fork` 虽继承分叉瞬间状态但后续修改互不可见（边界见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)）。[Patch](ascend-patch-system.md) 改的是模块符号指向，且全局 patch 早于配置构造，两件事不能混为一谈。

## 三路撞在一起时，谁说话

同一开关同时出现在 JSON 与环境变量里时，旧版 `v0.23.0` 与新版 `v0.30.0 / main` 会给出**截然相反的结果**。把同一组合法冲突输入 `JSON=false` 与 `VLLM_ASCEND_ENABLE_FLASHCOMM1=1` 分别送入两代解析流水线，再一路追到原子发布、角色改写与消费者读取，全链路如下：

```wiki-diagram
file: ascend-config-fig-two-gen-precedence
```

在 `v0.30.0` 主基线下，用户输入按三条规则收敛：

1. **绝大多数开关只认 `--additional-config` JSON**：写则取值、缺省用默认值，拼错或类型错在 Pydantic 构造期直接报错。旧版 `VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON` 等均已从 `envs.py` 退役。
2. **唯一保留的环境变量兜底（`VLLM_ASCEND_ENABLE_FLASHCOMM1`）**：`derive_and_validate` 读取该环境变量（去空白转小写后仅 `1` / `true` 为真），与 JSON 的 `enable_flashcomm1` 做**逻辑或（`or`）**合并。环境已开启时，JSON 显式写 `false` 盖不掉它。
3. **无 JSON 对应键的环境变量**：直接由消费者读取（如构建期变量或全局 patch 阶段的 EPLB 变量）。

**边界与历史兼容（`v0.23.0` / GLM 镜像 9 对兼容映射）**：旧版有 9 个字段同时支持 JSON 与环境变量（完整对照表见[怎么开](#怎么开)，命名不能靠猜，如 `weight_nz_mode` 对应 `VLLM_ASCEND_ENABLE_NZ`，监控守护变量不带昇腾前缀）。旧版按「键是否在 JSON 字典里」定胜负——**JSON 出现即优先**（显式 `false` 盖掉环境 `true`）。但调用方会先对环境变量求值：一旦环境字符串非法，即使 JSON 已写该键也会提前报错退出：

| JSON 写法（旧版 9 对映射） | 环境变量读值 | 旧版解析结果 |
|---|---|---|
| `true` | `false` | `true` |
| `false` | `true` | `false` |
| 省略该键 | `true` | `true` |
| 省略该键 | 未设（用读取器默认） | 读取器默认值 |

**缓存与懒读的时机边界**：写入 `_ASCEND_CONFIG` 的字段在构造完成那一刻即定型；`envs.py` 则在每次属性访问时现读当前进程的 `os.environ`。在终端重新 `export` 不会改变已运行服务或其他 Worker 的环境，配置变更必须重启服务并核对日志。

## 解析完还会被改写：生效值不是你写的值

拿到解析后的字段值，还不等于运行时真正生效的值。配置从环境变量持续收口到强类型子配置，落地前还须穿过两道关卡（校验收尾阶段平台还会补写 `PYTORCH_NPU_ALLOC_CONF` 等表外运行时环境变量，见[昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）：

```wiki-diagram
file: ascend-config-system-fig-pydantic-flow
```

**第一道：构造与派生校验（`init_ascend_config`）**

在 `v0.30.0` 与 `main` 中，Pydantic 解析完成后顺序执行 `derive_and_validate` 以及 RL、细粒度 TP、Xlite 前置校验。全部通过后才原子发布 `_ASCEND_CONFIG` 并清理派生的序列并行缓存（`clear_enable_sp()`）；任一环节失败时保留旧单例。典型跨字段约束如下：

- **profiling 分块**：开启要求 `PP > 1`，且与均衡调度互斥；最小块大于每步 token 预算时会被裁至预算值并打日志；即便未开启，传入的 `min_chunk`、`smooth_factor`、`max_fit_chunk` 仍须通过范围检查。
- **细粒度 TP 约束（历史边界）**：旧 GLM 实现中，若注意力输出投影（`oproj_tensor_parallel_size`）或词嵌入（`embedding_tensor_parallel_size`）大于 0，会强制要求 `recompute_scheduler_enable=true`；LM head（`lmhead_tensor_parallel_size`）不受此约束。

**第二道：平台准备与角色改写（`NPUPlatform.check_and_update_config`）**

平台先运行前置校验，再构造配置，随后按部署角色改写部分开关（完整校验族见 [NPU 平台](npu-platform.md#校验与改写怎样影响执行)）：

- **PD 分离角色改写**：在 PD 分离的 `producer`（prefill）侧，重算调度开关会被忽略并重置为关闭（仅打警告）；若既不是 `producer` 也不是 `consumer` 却开启该开关，则直接报错。
- **进程内缓存守卫**：旧版逐键路径中，平台与 Worker 共用同一建配置函数，仅在「已有缓存 + 绑定同一 `VllmConfig` + `refresh` 为假 + 具备 `ascend_compilation_config` 与 `eplb_config` 两项属性」四条全满足时复用；不满足守卫的新实例只打警告不覆盖旧缓存。直接改动字典不触发重解析；取配置时缓存为空或缺必要属性会直接抛「配置未初始化」。

## 省略 JSON 时，怎样核对最终生效值

启动命令省略 `--additional-config` 只表示没有从 CLI JSON 入口传入昇腾键；省略 JSON 后仍要逐级核对环境兜底、部署角色改写和最终消费者条件（例如共享专家 DP 仍可刷新派生的序列并行状态，PD 角色仍可重置重算调度）。历史 GLM 双机教程未传 `--additional-config` 时的四项默认派生分支与六项通用 CLI 显式配置（`0.85`、`8192`、`32`、`133120`、MTP `3` 与七档 decode 图）统一收束在[双机关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)。

## 排查时怎样从症状回到某一路

- **配了却没有效果。** 先确认这个键在你用的版本里真的存在、层级放对了；再看日志里这个字段是从 JSON 取的还是从环境回退来的；最后看消费者那一侧的条件分支——解析出 true 只表示配置选择，能不能执行还要看平台检查和消费者条件。

  v0.26 rc 的调度配置要把调用链一起看：选择函数的回退日志打印的是调用者传入的备用值，这一层不再读取或转换环境变量的值。以均衡调度为例，环境值已在创建调度子配置前读取并转换；因此要核对调用者怎样准备这个值，不能把打印日志的位置当成读取环境的位置。具体键名、层级优先顺序与转换见页末来源。
- **报「配置还没初始化」。** 取配置时，缓存为空或缓存对象缺少守卫检查的任一必要属性，完整性检查就会报这个错误。先认清自己在哪个进程，再查该进程是否经过初始化、初始化是否成功，以及留下的对象是否满足守卫。
- **启动时直接拒绝某个组合。** 按报错定位到是哪一道检查，再去看它要求的前提；不要靠删掉检查来判断这个组合可用。
- **改了环境变量却没变。** 如果这个名字属于配置构造期读取的兼容项（如 `v0.30.0` / `main` 的 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 或旧镜像 `v0.23.0` / `db701c1f` 的九对映射），仅改环境不会自动更新已经缓存进 `_ASCEND_CONFIG` 的结果；需经过受支持的配置重建或服务重启路径，并核对消费者有没有另外缓存旧值。重新导出启动终端的环境，也不会修改已经运行的服务进程环境。

不确定某个开关该写进环境变量还是 `--additional-config`、或担心组合后被派生逻辑静默重置时，可在下方调优旋钮雷达中按目标反查并实时模拟冲突：

```wiki-tool
tool: knob-radar
mode: minimal
preset: preset-legacy-docs-minefield
title: 昇腾三路配置入口与静默重置排雷雷达
summary: 按调优目标检索环境变量与 additional_config 键，实时模拟 extra="forbid" 拒收、退役环境变量与平台静默覆写
```

## 常见误解

- **「这段 JSON 是上游 vLLM 的功能，文档该在上游」**——上游提供容器并将内容纳入配置 hash，平台定义自己的键；上游也会写入少数键。查某个键要找到实际读取它的代码。
- **「环境变量和 JSON 是两条互不相通的路」**——`v0.30.0` 与 `main` 仍对 `enable_flashcomm1` / `VLLM_ASCEND_ENABLE_FLASHCOMM1` 做逻辑或合并，历史 `v0.23.0` 与旧镜像 `db701c1f` 更曾保留九对同名兼容映射。把「全大写只找环境变量表、小写下划线只找 JSON」当绝对规则，就会漏掉跨入口合并逻辑。
- **「取不到配置是因为 JSON 写错了」**——缓存为空或缺少守卫检查的属性，会触发未初始化错误；JSON 错误则可能在解析、类型转换或具体子配置校验时另行报错，也可能因旧版忽略未知键而没有提示。
- **「同一个进程里配置只解析一次」**——可复用时不会重建；旧版 `refresh` 为真、绑定对象变了或缓存不完整时会重建，不能把“写了这个键”与“值为真”等同。
- **「拼错键名总会报错」和「拼错键名从不报错」都不对**——钉住的两个发布分支上，顶层和多数子配置安静走默认，EPLB 那一组会报错；main 通常由 pydantic 严格校验报错；若能发现 vLLM-Omni，未知顶层键会先警告并过滤，不能概括为一律报错。结论要连版本和所在层级一起说。

## 对照源码

遇到“开关写了却没效果”或升级回归，按进程保留最终配置、安装文件路径和实际执行路径，再与启动命令比较。配置值已开启、功能实际触发、目标指标改善是三次不同的核对；对照方法见[版本与配置回归](inference-troubleshooting.md#版本与配置回归同一命令不等于同一路径)。

### 怎么开

**JSON 这条路。** 启动命令加 `--additional-config '{...}'`（上游注册的参数），解析后的容器进入 `VllmConfig.additional_config`，期间上游也可以补键。固定旧 GLM 由 `AscendConfig.__init__` 从字典里 `.get()` 子字典，再交给对应的子配置类。这样构造出来的类有八个：`XliteGraphConfig`、`AscendCompilationConfig`、`AscendFusionConfig`、`FinegrainedTPConfig`、`EplbConfig`、`WeightPrefetchConfig`、`ProfilingChunkConfig`、`RejectionSamplerConfig`。顶层字段也逐键取，例如 `recompute_scheduler_enable`、`enable_shared_expert_dp`、`enable_reduce_sample`。本页这些字段的层级在 `ascend_config.py` 中定义；其他键仍要追实际消费者，不能仅凭没有在这个文件里找到就判它无效。

**历史旧镜像（`v0.23.0` / `db701c1f`）九对兼容映射的完整清单**（该快照按键是否在字典里择一：`v0.30.0` 与 `main` 已退役除 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 外的八项环境变量）：

| JSON 里的键 | 对应的环境变量 |
| --- | --- |
| `enable_balance_scheduling` | `VLLM_ASCEND_BALANCE_SCHEDULING` |
| `enable_flashcomm1` | `VLLM_ASCEND_ENABLE_FLASHCOMM1` |
| `enable_matmul_allreduce` | `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` |
| `enable_fused_mc2` | `VLLM_ASCEND_ENABLE_FUSED_MC2` |
| `enable_mlapo` | `VLLM_ASCEND_ENABLE_MLAPO` |
| `enable_flashcomm2_parallel_size` | `VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE` |
| `msmonitor_use_daemon` | `MSMONITOR_USE_DAEMON` |
| `enable_transpose_kv_cache_by_block` | `VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` |
| `weight_nz_mode` | `VLLM_ASCEND_ENABLE_NZ` |

判断逻辑在 `_get_config_value`：`config_key in additional_config` 为真就返回字典里的值，否则返回传进来的环境值；走回退时按 `env_key in os.environ` 决定要不要打那条「下个版本将删除该环境变量」的提示。环境值是在调用前求出的，优先级规则不会跳过这个求值过程。

**环境变量这条路。** `vllm_ascend/envs.py` 的 `env_variables` 表在固定旧 GLM 上有 21 条，其中 9 条带 `VLLM_ASCEND_` 前缀，其余包括构建期变量（编译并发度、编译类型、是否编自定义算子、芯片型号、CANN 安装路径等）和通用项。模块的 `__getattr__` 是懒读：每次访问 `envs_ascend.X` 都会重新调一遍 lambda，读当前的 `os.environ`。这不是完整环境变量清单，例如全局 patch 直接读取 `DYNAMIC_EPLB` 和 `EXPERT_MAP_RECORD`，不经过这张表。

**昇腾还会往解析器里补选项。** 平台钩子 `pre_register_and_update` 在解析参数阶段把 `ascend` 加进 `--quantization` 的候选，所以 `--quantization ascend` 不是上游自带的取值。

**建与取。** `init_ascend_config(vllm_config)` 建（复用条件见正文），`get_ascend_config()` 取，`clear_ascend_config()` 清缓存时会连带清掉派生的序列并行判断缓存。调用点：`NPUPlatform.check_and_update_config` 里在四个校验之后；`NPUWorker.__init__` 里在登记昇腾算子之后、`super().__init__()` 之前；另外 profiling 分块的调度器和两个 mooncake connector 也各有一处。

### 会报什么错

- `RuntimeError: Ascend config is not initialized. Please call init_ascend_config first.` —— 取配置时缓存为空或未通过完整性检查。它说明取的时机不对，不是 JSON 内容错。
- `ValueError`：profiling 分块要求 pipeline parallel 大于 1；以及分块与 `enable_balance_scheduling` 不能同时开。两条都在建配置时抛出。
- `AssertionError`：`finegrained_tp_config` 里 `oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 时，要求 `recompute_scheduler_enable=true`；`lmhead_tensor_parallel_size` 不受这条约束。
- `ValueError`（平台阶段）：开了重算调度但角色既不是 PD 的 producer 也不是 consumer。在 producer 上则只警告并把它重置为关。
- `ValueError`（本页固定旧 GLM 与 v0.23 的平台阶段）：层切分配置校验会拦掉不合法组合。`layer_sharding` 在本页 v0.26 rc 与 main 的配置路径中已删除，不能把旧键未报错当作仍生效。
- `ValueError: Config has no attribute '<键名>'`：`eplb_config` 这一组是自己遍历用户字典的，遇到它不认识的键当场抛错。所以「未识别的键一律静默忽略」不成立，要按子配置类分别看。
- **不报错的两种情况：** 顶层和多数子配置里未识别的键（顶层全程 `.get()`，接 `**` 的 `AscendCompilationConfig` 与 `AscendFusionConfig` 带 `**kwargs` 兜底，其余几个子配置也是逐键 `.get()`）；新建实例没通过完整性检查时只打警告、不更新缓存。

### 开销和什么时候别开

配置解析主要发生在初始化或重建时；源码没有给出其实际耗时，不能从“有缓存”直接推出开销可忽略。部署时还要权衡下面几项。

- 非空 JSON 的完整内容进入配置 hash，改变内容会影响默认编译缓存的选择；已有产物不会因此被统一删除，是否重新编译还取决于实际编译与缓存路径。
- 仅由执行代码直接消费、未并入配置对象的环境开关，平台配置检查未必能看见；上面的九对兼容映射会并入 AscendConfig。排查时同时核对环境、映射规则和最终生效值。
- 九对兼容映射带迁移提示，长期运维脚本应记录所依赖的版本和入口；v0.26 rc 上调度相关的顶层键也已打 deprecated 警告。不要把提示中的“下个版本”当成所有后续版本行为相同的证据。
- 官方双机配方没有传 JSON 键。新增覆盖时先确认该层级和版本支持，再一次只改一项，记录最终值并验证目标指标；本页的静态推导不替代部署实测。

### 版本差异

**`v0.30.0`（`c09d3e20`）已完成 `AscendConfig` 字段收口与严格校验，并在 `main`（`8d6180e2`）进一步扩展 `runtime_config` 与 `quantized_all_reduce_config`：**
- **`extra="forbid"` 严格解析与 Omni 兼容例外**：`v0.30.0` 与 `main` 统一采用 Pydantic dataclass（`ConfigDict(extra="forbid")`），构造期即拒绝未知键与非法类型；内部派生键与调度兼容旧键由 `init_ascend_config` 工厂提前消费或剔除；只有可发现 `vllm_omni` 时，未知顶层键才告警后从 `AscendConfig` 输入过滤（不代表未知子配置一并放行）。构造期类型/范围检查之后，再顺序执行 `derive_and_validate`、RL `apply` 与细粒度 TP / Xlite 等前置校验，最后才发布进程内单例；失败不覆盖旧缓存，但派生过程可能已经修改传入的总配置，不是整个初始化事务回滚。
- **退役环境变量与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 兜底**：`v0.30.0` 与 `main` 的 `envs.py` 均已移除 `VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON`、`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`、`VLLM_ASCEND_BALANCE_SCHEDULING`、`VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE`、`VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` 等旧兼容变量，对应开关收归 `additional_config` 的 `weight_nz_mode`、`enable_mlapo`、`enable_fused_mc2`、`msmonitor_use_daemon` 等字段。`AscendConfig.derive_and_validate` 仍保留对 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 的直读兜底（去除空白并转小写后仅 `1` / `true` 为真），且与 JSON `enable_flashcomm1` 做逻辑或（`or`），因此 JSON 写 `false` 不会盖掉环境里的开启值，且后续还与 DSA-CP / SP MoE / 稠密 SP 判定联动。
- **历史 `v0.30.0rc2` / 旧字段归档说明**：`v0.30.0` 与 `main` 均已从输入 schema 移除 `enable_reduce_sample`（旧固定 `baa023ad` 曾短暂保留声明），MRV2 的 `enable_batch_sharded_sampling` 属于上游 `parallel_config` 入口且与非零细粒度 LMHead TP 互斥；`ascend_warmup_config` 两项默认仍为 `false`；STAIR 默认策略及 HIXL/Gloo 回退见 [EPLB 版本差异](eplb.md#版本差异)。正文配置流程图与 GLM 双机算例按固定旧镜像 `db701c1f`（与 `2c59ff10` 相比，后者在采样归约上增加了实验性警告以及与细粒度 LM head TP / PD producer 互斥拒绝，环境变量表与四个前置平台校验相同）绘制，不能把逐键静默忽略套到 `v0.30.0` / `main`。

| 核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
| --- | --- | --- | --- | --- |
| 解析与未知键策略 | 逐键 `.get()` + 手写校验；顶层与多数子配置静默忽略，`eplb_config` 报错 | 同 `v0.23.0` | Pydantic dataclass（`ConfigDict(extra="forbid")`）严格拒收；检测到 `vllm_omni` 时未知顶层键先告警后过滤 | 延续 `extra="forbid"` 与 `vllm_omni` 顶层过滤例外 |
| 调度相关键层级 | 仅顶层键 | 推荐嵌在 `scheduler_config`；顶层仍认但打 deprecated 警告，两处都写以嵌套为准 | 工厂提前剥离 5 个顶层旧调度键（含 `profiling_chunk_config`）并交给 `scheduler_config` 构造 | 工厂提前剥离 4 个顶层旧调度键（已移除 `profiling_chunk_config`） |
| 子配置构成 | 8 组（含权重预取与独立 profiling 分块） | 删除权重预取；profiling 分块迁入 `scheduler_config`，新增批作业调度与短请求优先 | 12 组：含 `ascend_compilation` / `fusion` / `warmup`、`eplb`、`rejection_sampler`、`rl`、`xlite_graph`、`finegrained_tp`、`scheduler`、`dynamic_spec`、`sparse_kv_offload`、`kvpp` | 14 组强类型子配置（计入 `runtime_config` 为 15 项）：移除 `dynamic_spec_config`，新增 `shared_engram`、`kv_trace` 与 `quantized_all_reduce_config`（并含 `runtime_config` 热更新引导） |
| 环境变量兼容映射 | 9 对兼容映射，`_get_config_value` 按 JSON 键优先 | 顶层 6 字段 + `scheduler_config` 均衡调度 | 退役 `VLLM_ASCEND_ENABLE_NZ/MLAPO/FUSED_MC2/MSMONITOR_USE_DAEMON` 等；仅 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 在 `derive_and_validate` 保留逻辑或兜底 | 延续退役收口与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 逻辑或兜底（并新增 Qwen3.5 稠密 SP 联动） |
| `envs.py` `env_variables` 条目 | 21 条（9 条带 `VLLM_ASCEND_` 前缀） | 20 条（8 条带前缀） | 14 条（3 条带前缀：`ENABLE_BATCH_MEMCPY`、`KVPOOL_RANGE_DEBUG`、`ROPE_UB_SIZE_KB`） | 12 条（1 条带前缀：`VLLM_ASCEND_ENABLE_BATCH_MEMCPY`） |
| 建配置前平台校验 | 4 个前置校验（含已删除的 `layer_sharding`） | 2 个前置校验（已删 `layer_sharding`） | 7 个前置校验（runner、indexer-PP、routing replay、PCP/DCP、draft DCP、parallel、engram）+ 量化/FP8 能力检查与 `_fix_incompatible_config` | 同类前置校验链，且入口首行调用 `apply_v2_model_runner_config_patch()` 固定 MRV2 |
| 进程内缓存 | 模块变量 `_ASCEND_CONFIG` + `_INIT_VLLM_CONFIG` + `refresh` 标记 | 同 `v0.23.0` | 校验完整后原子发布 `_ASCEND_CONFIG` 并 `clear_enable_sp()`；失败保留旧单例 | 同 `v0.30.0`（额外校验 `quantized_all_reduce` 与 `xlite_graph` 前置条件） |

### 源码位置

| 想核对什么 | 固定源码位置 |
| --- | --- |
| `--additional-config` 的注册 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L1488-L1490` |
| 上游把它当不透明字典、只算进 hash | `vllm@0fc695fc:vllm/config/vllm.py#L355-L363`；`vllm@0fc695fc:vllm/config/vllm.py#L476-L486` |
| 上游自己往容器里写键 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L2223-L2230` |
| 逐键拆出七组子配置、前两对兼容映射、分块的两条校验 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L94` |
| 顶层字段与 fine-grained TP 的那条断言 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L160` |
| 其余七对兼容映射与顶层开关 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L256` |
| 优先级判断与迁移提示 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346` |
| `finegrained_tp_config` 的五个字段（默认都是 0） | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L560` |
| 权重预取与 profiling 分块子配置 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L745` |
| `rejection_sampler_config` 子配置（两个开关默认关） | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L744-L782` |
| 采样归约开关默认关、`rejection_sampler_config` 的取出 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L332` |
| 建、取、清与完整性检查 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925` |
| 环境变量表与懒读 | `vllm-ascend@db701c1f:vllm_ascend/envs.py#L30-L113`；`vllm-ascend@db701c1f:vllm_ascend/envs.py#L112-L124` |
| 平台补 `--quantization` 候选 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L200` |
| 四个校验与建配置的先后 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480` |
| 按 PD 角色改写重算调度 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L676-L695` |
| Worker 里建本进程那一份 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126` |
| v0.26 rc 的顶层构造与嵌套层 | `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L360`；`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040` |
| v0.26 rc 的环境变量表 | `vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107` |
| `v0.30.0 (c09d3e20)` 严格校验、12 组子配置、FlashComm1 兜底与工厂发布 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L562-L635`、`#L745-L756`、`#L1795-L1951` |
| `v0.30.0 (c09d3e20)` 环境变量收口（14 条）与平台前置校验 | `vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L90`；`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525` |
| `main (8d6180e2)` 14 组强类型子配置（另含 `runtime_config`）、FlashComm1 兜底与工厂发布 | `vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L652-L737`、`#L845-L865`、`#L1909-L2078` |
| `main (8d6180e2)` 环境变量表（12 条）与平台 MRV2 入口前置校验 | `vllm-ascend@8d6180e2:vllm_ascend/envs.py#L51-L95`；`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L685` |
| 历史 `baa023ad` main 存档与 Omni 过滤参考 | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310`、`#L430-L608`、`#L1536-L1700`、`#L1660-L1671` |
| 配置 hash 怎样参与默认编译缓存目录 | 来源 46，`vllm/compilation/backends.py` 1024–1084 行；缓存开关与编译模式另有门控 |
| SP 可以覆盖 FlashComm1 关闭值的实际消费者 | 来源 47，`vllm_ascend/utils.py` 905–931 行 |
| 分块调度器、普通与混合 Mooncake 的初始化调用点 | 来源 48–50，分别覆盖调用和紧随的配置读取 |
| 旧版两个编译/融合子配置接受额外键，Xlite 逐键读取 | 来源 51，`ascend_config.py` 579–682 行 |
| 读取表之外的环境入口 | 来源 52，全局 patch 直接读取 EPLB 两个环境变量 |
| rc2 EPLB 扩展的安装调用 | 来源 53；策略扩展、回退条件与官方说明见来源 39–42、45 |
| Xlite Worker 的自动选择条件 | 来源 54，`platform.py` 650–659 行；显式 Worker 和 310P 分支不由这个开关替换 |
| 历史 main 的 profiling 分块仍归 scheduler 子配置 | 来源 55，`ascend_config.py` 1402–1440 行；不把顶层组数当成全部嵌套配置数 |

**关键路径对应来源。** 上游容器被声明为不透明字典 [C3]；参数注册、完整内容进入配置 hash、上游内部写键分别见来源 2、4、5，缓存消费者见来源 46。构造配置时逐键拆分并建立子配置 [C6]；层级不等价、顶层字段及构造期检查需合看来源 6–8，EPLB 子配置拒绝未知键见来源 30，优先级判断与迁移提示见来源 9，环境变量表与每次访问重读见来源 14。平台前置校验与按 PD 角色改写见来源 15–17，建/取/清缓存与 Worker 侧调用点见来源 12、18。GLM 双机命令没有那段 JSON [S1]；相关默认值见来源 10、19、20，SP 条件须合看来源 47 与[来源基线](../sources/glm-5-3-flash-baseline.md)。四版演进对照：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）分别见来源 21–23、28、56–65 [C56][C61]。

子配置八组（旧 GLM）到 12 组（`v0.30.0`）与 14 组强类型子配置（`main`，另含 `runtime_config` 共 15 项）、兼容映射九对、环境变量表 21 / 20 / 14 / 12 条（带 `VLLM_ASCEND_` 前缀 9 / 8 / 3 / 1 条），均按对应提交源码实点 [D]。旧版两个「9」不是同一批名字：兼容映射的九对里有一对的环境名不带昇腾前缀，而带前缀的那 9 条里也有一条没参与映射 [D]。教程未传 JSON 只支持“未从该 CLI 入口覆盖”，最终生效值还需合看派生与消费者 [I]。`v0.30.0` 与 `main` 虽已移除通用回退函数及四个旧环境变量，但 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 仍保留逻辑或直读兜底（来源 57、62）[C57]。

本页的日志说明来自固定源码，尚无目标镜像启动日志证明实际采用了哪条分支。官方教程与公开代码也不能代替安装产物：部署时应保存各进程的最终配置、环境来源与代码版本，核对镜像是否另有注入或改写。

v0.26 rc 固定快照 2ed6cbba 的调度子配置先取 scheduler_config 内的同名键；顶层也写了时警告它被忽略。只有顶层写了时仍采用并警告迁移；两层均未写才返回调用者给出的 default。均衡调度的 default 来自 VLLM_ASCEND_BALANCE_SCHEDULING 的整数布尔转换，重算开关传 False，三组子配置传空字典。因此，“回退到 default”不等于所有字段都回退到同一种来源；其他开关和版本应分别判断。取值链见来源 21–23。
