---
id: model-runner-v2
title: Model Runner V2：常驻设备缓冲、异步调度与从可选到统一的执行引擎演进
type: concept
origin: direct
summary: >-
  解析 vLLM Ascend 从单文件 Model Runner V1 演进到模块化 Model Runner V2 的核心动因，拆解常驻设备侧缓冲 AscendInputBuffers、UVA 请求状态、异步调度兼容性、PCP 与 EPLB V2 集成边界，以及 v0.30.0 显式开关到 main 彻底统一的版本切换路径。
aliases:
  - MRV2
  - NPUModelRunnerV2
  - VLLM_USE_V2_MODEL_RUNNER
  - AscendInputBuffers
  - AscendRequestState
  - AscendPCPManager
  - AscendEPLBController
  - apply_v2_model_runner_config_patch
chapters:
  - '10'
order: 42
sources:
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L193-L195'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L509-L517'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L49'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L135-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L349-L393'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L789-L845'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/input_batch.py#L29-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/states.py#L24-L46'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/block_table.py#L29-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/pcp_manager.py#L44-L70'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L20-L70'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L999'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1085'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1639-L1658'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/model_runner_v2_eplb.md#L16-L90'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L9-L10'
  - 'vllm@ced6857a:vllm/config/vllm.py#L674-L724'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/input_batch.py#L19-L41'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/states.py#L9-L51'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L160-L164'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L498-L501'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L89'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: npu-model-runner
    kind: builds-on
    note: 先理解单卡每步前向与采样拆成两次调用的基本骨架，再对照本页看 V2 如何重写状态与缓冲层
  - to: prepare-inputs-flow
    kind: builds-on
    note: V1 在宿主侧组装输入批与注意力元数据的逐项步骤见该页，本页展开 V2 常驻缓冲的替代路径
  - to: async-scheduling
    kind: builds-on
    note: 异步调度让主机提前准备下一步，本页说明为什么 CPP 异步与部分新特性必须建立在 MRV2 之上
  - to: context-parallel
    kind: builds-on
    note: 理解 PCP 预填充上下文并行的序列切分原理后，回看本页的 AscendPCPManager 局部/全局批映射
  - to: eplb
    kind: builds-on
    note: 专家负载均衡策略与搬迁参数见该页，本页划清 MRV1 环境变量控面与 MRV2 上游控制面的互斥边界
contradicts: []
updated: '2026-11-19'
---

**Model Runner V2（简称 MRV2）**是 vLLM 与 vLLM Ascend 新一代单卡执行器，用来替代长期把所有职责塞在一个大文件里的第一代执行器（Model Runner V1，简称 MRV1）。每一步推理里，执行器都要把调度器发来的“本轮算哪些请求、各算几个 token”翻译成 NPU 上的张量、跑完前向并采样出新 token；当并发拉高、单步时间压到毫秒级时，旧版每步在 CPU 上反复重排整张请求表再同步拷给 NPU 的开销，很容易超过设备本身的计算时间。MRV2 的核心思路是**“状态常驻、缓冲预留、横切拆分”**：把输入缓冲和块表映射直接常驻在 NPU 侧，只每步送入少量变更索引，同时把上下文并行、专家负载均衡与投机解码拆成边界清晰的独立模块。

以一轮 **4 条并发请求各解 1 个 token 的示意 decode 步**来体会差别。在旧版 MRV1 里，CPU 先维护大表增删改，再把这 4 条请求的输入编号、位置编码和整批块表重新打包成连续数组拷贝到 NPU。而在 MRV2 里，输入张量与块表缓冲在启动时已常驻 NPU，CPU 每步只需异步写入 4 个槽位索引，由设备侧轻量核就地填好有效区间，随后沿固定显存地址回放图。

在 `vLLM Ascend v0.30.0` 主基线上，MRV1 仍是默认执行器，MRV2 需通过环境变量 `VLLM_USE_V2_MODEL_RUNNER=1` 按需开启。但 PCP 上下文并行、DeepSeek V4.1（Ascend 950/A5）、路由专家回传与 CPP 异步调度等新特性已强制要求 MRV2。社区 `main` 分支则彻底删除了旧版执行器，统一收口到 MRV2 模块目录。

## 为什么需要从 MRV1 演进到 MRV2？

先对照同一轮解码 step 在两代执行器里的工程分工。在 [NPUModelRunner](npu-model-runner.md)（MRV1）中，数千行逻辑集中在 `vllm_ascend/worker/model_runner_v1.py`，宿主 CPU 通过 `NPUInputBatch` 维护一张大表。每步先在 `_update_states` 增删改请求行，再在 `_prepare_inputs` 串行打包输入编号、位置编码与块表拷贝到 NPU（细节见 [输入拼装流程](prepare-inputs-flow.md)）。当引入 **PCP**（Prefill Context Parallelism，预填充上下文并行）、**EPLB**（Expert Parallelism Load Balancer，专家并行负载均衡）或混合状态模型时，所有分支都得挤进同一个巨型类里打补丁。

MRV2 把这条路径拆成了职责清晰的组件目录 `vllm_ascend/worker/v2/`，直接继承上游 vLLM 的 V2 `GPUModelRunner`，只在昇腾硬件语义确实不同的边界做子类覆写：

```wiki-diagram
file: mrv2-fig-v1-vs-v2
```

对照上图，两代执行器在五个工程维度上的分工变化可以收束为下表：

| 对比维度 | MRV1（单体版） | MRV2（`worker/v2/`）与工程收益 |
|---|---|---|
| 代码组织与对齐 | 单体大类，大量方法整段复制自上游 V1 并做昇腾改写 | 拆分为 `states`、`input_batch`、`block_table`、`pcp_manager`、`eplb`、`aclgraph_utils`、`spec_decode` 等子模块薄继承上游 V2，免去重复维护主干 |
| 请求状态存放 | CPU 侧 `NPUInputBatch` 维护全量请求元数据与历史 token | `AscendRequestState` 将大词表 `all_token_ids` 放进 **UVA**（统一虚拟地址映射主机内存），并以 `torch.from_numpy` 零拷贝共享长度缓冲，省显存且免重复拷贝 |
| 输入缓冲与块表 | 每步在 CPU 整理 NumPy 数组再整体 H2D 拷贝 | `AscendInputBuffers` 在 NPU 预分配常驻缓冲，`AscendBlockTables` 用 Triton 核直接在设备侧算 `slot_mapping`，压低 CPU 准备耗时并契合固定地址图回放 |
| KV Cache 组织 | 按层/按注意力类型各自分配，混合模型复用困难 | 开启标准化共享 KV 底板（`shared_kv_backing`），保留上游共享页池并按昇腾连续 K/V 与 2 MiB 对齐切出视图，消除混合状态模型碎片 |
| 扩展能力边界 | 仅留旧 `DYNAMIC_EPLB`；不支持 PCP、路由专家回传与 CPP 异步 | 原生接入 `AscendPCPManager`、`AscendEPLBController`、统一 `spec_decode` 族与标准 `kv_connector`，承接新模型与高阶并行主干 |

## 常驻设备缓冲与异步调度怎样配合？

MRV2 能压低每步 CPU 开销并天然契合 [ACL Graph](acl-graph.md) 录图回放，关键在 `AscendInputBuffers` 的“先预分配、步内就地切片”机制。上游基类 `InputBuffers` 在启动时一次性在设备侧分配好最大容量张量，包括 `input_ids`（长 `max_num_tokens`）、`positions`、`is_padding`、`query_start_loc`、`seq_lens` 与 `dcp_local_seq_lens`。每步不再重新 `malloc`，只需异步搬入少量索引并用设备核就地填好有效区间，图回放时直接读固定显存地址。

昇腾在此基础上做了三处精准适配，而不是另起炉灶：

- **为 FIA `FULL` 图模式预留双尾位**：`AscendInputBuffers` 删掉基类长度为 `max_num_reqs + 1` 的 `query_start_loc`，重分配为 `max_num_reqs + 2`。多出的 1 格专门给 **FIA**（Fused Infer Attention，昇腾融合注意力算子）在完整图模式下的尾端 padding 留出安全越界槽位。
- **零拷贝 CPU 视图桥接昇腾注意力后端**：当前昇腾注意力元数据构造仍需在 CPU 读取序列长度与已算 token 数。因此 `AscendInputBuffers` 分配 `seq_lens_cpu` 并以 `.numpy()` 共享内存暴露 `seq_lens_np`；`AscendRequestState` 则用 `torch.from_numpy` 包装 `num_computed_tokens_np` 共享底层缓冲，避免二次复制。
- **与 [异步调度](async-scheduling.md) 协同**：开启异步调度时，调度器不等上一轮采样结果完全回 CPU 就先排下一轮；MRV2 用 `async_tensor_h2d` 异步拷贝请求映射索引 `idx_mapping`，并在 `prepare_inputs` 结合 `BatchExecutionDescriptor` 对齐图档位与草稿数。在 `v0.30.0` 上，同时开启 **CPP**（动态分块流水线 `profiling_chunk_config`）与 `async_scheduling` 时，MRV1 无法提供同等异步采样与跨段广播保证，平台校验会直接拦截并要求切换 MRV2。

## PCP 与 EPLB 如何在 MRV2 中边界清晰地集成？

在 MRV1 时代，上下文并行和专家负载均衡曾因直接插桩在执行器内部而导致维护冲突；MRV2 把这两项高耦合特性抽离成独立管理器，严格划定了“上游控面 vs 昇腾数据面”的职责边界：

```wiki-diagram
file: mrv2-fig-pcp-eplb
```

1. **PCP 上下文并行（`AscendPCPManager`）**：开启 **PCP**（`prefill_context_parallel_size > 1`）时，长提示词会被切分到多个 PCP 秩并行做 Prefill。`AscendPCPManager` 先经 `get_global_graph_num_reqs` 算出跨秩一致的图档位，再构建冻结对象 `AscendPCPAttentionContext`，成对保存全局批 `global_batch` / `global_slot_mappings` 与本秩局部切片 / 还原索引 `hidden_restore_idx`。到 `sample_tokens` 阶段，即便当前卡非末段流水线（`not self.is_last_pp_rank`），Runner 也会先把 `execute_model_state.input_batch` 切回 `pcp_manager.global_batch`，保证 PP 跨段接收与后处理沿用全局行序。`v0.30.0` 下 MRV1 完全不支持 PCP，未开 MRV2 而设 `prefill_context_parallel_size > 1` 会在启动期抛 `ValueError`。
2. **EPLB 专家负载均衡（`AscendEPLBController`）**：MRV2 不再维护昇腾私有控制器，而是直接继承上游 `EPLBController` 复用窗口统计、策略求解与后台异步重排，仅在三个边界做昇腾适配：
   - **搬迁面**：启动期在所有 EP 秩之间协商异步通信后端（默认 **HIXL** 零拷贝单边读，缺失时回退 `torch_gloo` CPU 中转）。
   - **控制面**：批首按 `load_collection_phase`（`all` / `prefill` / `decode`，供 `STAIR` 策略过滤）决定本批是否记账。
   - **数据面**：每层 MoE 经实例绑定的路由适配器将逻辑专家 ID 映射为本地物理专家 ID，后台搬完后于主线程步间原地刷新 `AscendEplbState`。相应地，MRV2 严格禁止混入 MRV1 遗留的 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` 环境变量或非白名单 `eplb_config` 字段。

## `v0.30.0` 按需开启 vs `main` 彻底统一

很多人读了上游 vLLM 源码后容易误判昇腾默认开的究竟是 V1 还是 V2。下图把跨仓与跨版三条开关决策以及 `v0.30.0` 的五类强制 MRV2 场景放在一起对照：

```wiki-diagram
file: mrv2-fig-version-switch
```

- **上游 `vLLM v0.30.0`**：未设 `VLLM_USE_V2_MODEL_RUNNER` 时，若 `HAS_TRITON` 为真且未命中 MRV2 不支持特性清单，上游默认自动返回 `True`（启用 MRV2）。
- **`vLLM Ascend v0.30.0`（默认主基线）**：补丁 `patch_use_v2_model_runner.py` 覆写了 `VllmConfig.use_v2_model_runner`——**仅读环境变量，未设时显式返回 `False`（默认 MRV1）**。只有显式导出 `VLLM_USE_V2_MODEL_RUNNER=1`，`NPUWorker` 才实例化 `worker/v2/model_runner.py`。
- **社区 `main` 分支**：`model_runner_v1.py`、`npu_input_batch.py` 等 V1 文件已物理删除，`mrv2_utils.py` 通过 `apply_v2_model_runner_config_patch()` 将开关恒定覆写为 `True`。若旧脚本残留 `VLLM_USE_V2_MODEL_RUNNER=0`，启动不再静默忽略，而是直接抛 `ValueError` 提醒清理（升级清点见 [v0.30.0 升级与避坑清单](v030-release-baseline.md)）。

而在 `v0.30.0` 中，以下五类场景已硬性要求导出 `VLLM_USE_V2_MODEL_RUNNER=1`，否则启动直接抛 `ValueError`：

1. 开启预填充上下文并行（`prefill_context_parallel_size > 1`）；
2. 在昇腾 950（A5）上运行 `DeepseekV41ForCausalLM` 或 `DeepseekV41DSparkModel`（细节见 [DeepSeek-V4.1-Flash](deepseek-v4-1-flash.md)）；
3. 开启路由专家回传（`enable_return_routed_experts`）；
4. 同时开启动态分块流水线 `profiling_chunk_config` 与异步调度 `async_scheduling`；
5. 使用 MRV2 新控面 EPLB（`--enable-eplb` 配 `load_collection_phase` / `stair_config`）。

## 常见误解

- **误解一：“装了 `triton-ascend`，`v0.30.0` 就会跟上游 vLLM 一样自动切到 MRV2。”**
  错。`vllm-ascend@v0.30.0` 的 `patch_use_v2_model_runner.py` 屏蔽了上游自动开启逻辑。未设 `VLLM_USE_V2_MODEL_RUNNER=1` 时默认仍走 MRV1，触发 PCP 等特性时也不会自动切换，而是报错退出。
- **误解二：“MRV2 是昇腾自己另写的一套全新 Runner，和上游 vLLM 互不相干。”**
  恰恰相反，MRV2 的首要目标就是缩小两仓分叉。昇腾 `v2/model_runner.py` 直接继承上游 `GPUModelRunner` 并经 `torch_cuda_wrapper` 复用状态更新、图管理与采样编排。昇腾只在 FIA `query_start_loc +2`、CPU `seq_lens_np` 视图、连续 K/V 与 2 MiB 对齐以及 PCP/EPLB 边界处覆写。
- **误解三：“切到 MRV2 后还能继续用 `DYNAMIC_EPLB=1` 控专家均衡。”**
  错。`DYNAMIC_EPLB` 与 `EXPERT_MAP_RECORD` 属于 MRV1 私有路径；在 MRV2 下设置它们会被 `_validate_eplb_config` 直接拦截，必须取消这两个环境变量并改用上游标准 `--enable-eplb` 入口。
- **误解四：“升到 `main` 后只要设 `VLLM_USE_V2_MODEL_RUNNER=0` 就能随时回退 MRV1。”**
  错。`main` 分支已物理删除 `model_runner_v1.py`，显式传 `0` 会触发 `apply_v2_model_runner_config_patch()` 抛出 `ValueError`。若确需停留在 MRV1，只能使用 `releases/v0.30.0` 分支。

## 对照源码

### 怎么开与如何核验

```bash
# 1. 在 v0.30.0 上显式启用 Model Runner V2（以 Qwen3-30B-A3B 开启 EPLB 为例）
export VLLM_USE_V2_MODEL_RUNNER=1
vllm serve /path/to/Qwen3-30B-A3B \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --enable-eplb \
    --additional-config '{"eplb_config":{"load_collection_phase":"decode"}}'

# 2. 启动日志核验：出现下述提示说明已实例化 worker/v2/model_runner.py
grep -E "npu model runner v2|Model Runner V2" serve.log
```

- **核验开关与实例化入口**：`NPUWorker.__init__` 缓存 `self.vllm_config.use_v2_model_runner`（来源 1），随后在 `init_device()` 分支导入 `vllm_ascend.worker.v2.model_runner.NPUModelRunner` 并打印 `npu model runner v2 is in developing` 日志[C2]。在 `v0.30.0` 上，该属性被 `patch_use_v2_model_runner.py` 覆写为纯环境变量控制（未设置时返回 `False`）[C3]，覆盖了上游 vLLM 依据 `HAS_TRITON` 自动返回 `True` 的逻辑[C17]（官方发布说明亦明确 `v0.30.0` 默认 V1、下一版切换 V2[S16]）。
- **核验常驻缓冲与状态零拷贝**：`AscendInputBuffers` 继承上游 `InputBuffers`（来源 18）并将 `query_start_loc` 扩至 `max_num_reqs + 2` 同时维护共享内存的 `seq_lens_cpu` / `seq_lens_np`[C7]；`AscendRequestState` 继承上游 UVA 承载的 `RequestState`（来源 19）并以 `torch.from_numpy` 零拷贝暴露 `num_computed_tokens_cpu`[C8]；`AscendBlockTables` 接入 Triton `_compute_slot_mappings_kernel`（来源 9）。
- **核验 PCP 与 EPLB 边界**：`AscendPCPManager` 通过 `AscendPCPAttentionContext` 维护全局与局部批映射（来源 10），并在非末段 PP 的 `sample_tokens()` 前切回 `pcp_manager.global_batch`[C5]；`AscendEPLBController` 复用上游控制面与 HIXL/Gloo 异步搬迁并按 `load_collection_phase` 做批级过滤（来源 11）[S15]；同时 `platform.py` 在启动校验期拦截 MRV1 下的 PCP、R3、DeepSeek V4.1 A5、CPP 异步以及 MRV2 下的旧 EPLB 环境变量[C12]（来源 13–14）。具体单步 CPU 准备耗时降幅随模型与并发形态而异，须以同配置实机 profiling 对照确认[I]。

### 会报什么错

| 触发场景 | 报错信息 | 根因与修法 |
|---|---|---|
| `v0.30.0` 开启 `--prefill-context-parallel-size > 1` 但未设 V2 环境变量 | `ValueError: PCP (Prefill Context Parallelism) is not supported by vLLM Ascend.` | 导出 `VLLM_USE_V2_MODEL_RUNNER=1`（来源 14） |
| `v0.30.0` 在 A5 运行 DeepSeek V4.1 或开启 `--enable-return-routed-experts` | `ValueError: ... requires Model Runner V2 (VLLM_USE_V2_MODEL_RUNNER=1).` | 导出 `VLLM_USE_V2_MODEL_RUNNER=1`（来源 12、14） |
| `v0.30.0` 在 MRV2 下保留 `DYNAMIC_EPLB=1` 或传非白名单 `eplb_config` 键 | `ValueError: DYNAMIC_EPLB and EXPERT_MAP_RECORD are Model Runner V1 controls.` | 取消旧环境变量，改用 `--enable-eplb` 与 `load_collection_phase` / `stair_config`（来源 12） |
| `main` 分支启动脚本残留 `VLLM_USE_V2_MODEL_RUNNER=0` | `ValueError: Model Runner V1 has been removed from vllm-ascend...` | 删除 `VLLM_USE_V2_MODEL_RUNNER=0` 环境变量（来源 22） |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 默认执行器与开关行为 | `worker.py` 检测 `vllm_version_is("0.23.0")` 时强制把 `use_v2_model_runner` 置回 `False` 并告警回退 V1[C20] | 默认 MRV1，支持通过 `VLLM_USE_V2_MODEL_RUNNER=1` 启用实验性 MRV2（来源 21） | `patch_use_v2_model_runner.py` 保持未设变量默认 `False`（MRV1），设 `=1` 开启 MRV2（来源 3） | **彻底删除 MRV1**；`mrv2_utils.py` 恒定返回 `True`，显式设 `=0` 抛 `ValueError`[C22] |
| 强制依赖 MRV2 的特性 | 尚不支持 MRV2 生产路径 | `PCP > 1` 开始要求 MRV2 | `PCP > 1`、DeepSeek V4.1 (A5)、`--enable-return-routed-experts`、`CPP + async_scheduling`、新版上游控面 EPLB 均要求 MRV2 | 全部特性统一收敛至 MRV2 唯一执行路径 |
| KV Cache 底层与插件结构 | V1 独立分配与拷贝逻辑 | 早期 `worker/v2/` 骨架，尚无标准化共享 KV 底板 | `supports_standardized_shared_kv_backing = True`；补齐 `pcp_manager`、`eplb`、`kvpp`、多族 `spec_decode` 与 `msprobe` 收尾钩子 | 进一步补充 `encoder_only`、`hybrid_encoder`、`gemma4`/`lilicorr`/`multi_module_mtp` 投机与 `310P` V2 采样分发 |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–22 项（源码项为 `C1`–`C14`、`C17`–`C22`，官方文档项为 `S15`–`S16`）：

- 来源 1（C1）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L193-L195` — `NPUWorker.__init__` 读取并缓存 `use_v2_model_runner`。
- 来源 2（C2）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L509-L517` — `init_device()` 按开关分支实例化 `NPUModelRunnerV2` 或 V1 `NPUModelRunner`。
- 来源 3（C3）：`vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L49` — 覆写 `VllmConfig.use_v2_model_runner` 为纯环境变量控制（未设默认 `False`）。
- 来源 4（C4）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L135-L170` — V2 `NPUModelRunner(GPUModelRunner)` 类声明、`supports_standardized_shared_kv_backing` 与初始化。
- 来源 5（C5）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L349-L393` — `sample_tokens()` 中 PCP 全局批还原、PP 草稿广播及 `msprobe` 收尾。
- 来源 6（C6）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L789-L845` — `prepare_inputs()` 异步拷贝 `idx_mapping`、PCP 图档位计算与 `attn_state` 构建。
- 来源 7（C7）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/input_batch.py#L29-L85` — `AscendInputBuffers`（`query_start_loc +2`、共享内存 `seq_lens_cpu`/`seq_lens_np`）与 `AscendInputBatch`。
- 来源 8（C8）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/states.py#L24-L46` — `AscendRequestState` 共享底层 NumPy 缓冲的 `num_computed_tokens_cpu`。
- 来源 9（C9）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/block_table.py#L29-L60` — `AscendBlockTables` 接入 Triton `_compute_slot_mappings_kernel`。
- 来源 10（C10）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/pcp_manager.py#L44-L70` — `AscendPCPAttentionContext` 与 `AscendPCPManager`。
- 来源 11（C11）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L20-L70` — `AscendEPLBController` 批级相位过滤与 `AscendEplbState` 构造。
- 来源 12（C12）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L999` — DeepSeek V4.1 A5 强制 MRV2 与 MRV2 EPLB 字段/旧环境变量互斥校验。
- 来源 13（C13）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1085` — `profiling_chunk_config` 与 `async_scheduling` 同开强制要求 MRV2。
- 来源 14（C14）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1639-L1658` — `--enable-return-routed-experts`（R3）与 `PCP > 1` 强制要求 MRV2。
- 来源 15（S15）：`vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/model_runner_v2_eplb.md#L16-L90` — MRV2 EPLB 三平面架构（控制面/数据面/搬迁面）与批级相位过滤设计文档。
- 来源 16（S16）：`vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L9-L10` — `v0.30.0` 默认 V1 与下一版本全面切换 V2 的发布声明。
- 来源 17（C17）：`vllm@ced6857a:vllm/config/vllm.py#L674-L724` — 上游 `VllmConfig.use_v2_model_runner` 按 `HAS_TRITON` 与不支持特性自动求值逻辑。
- 来源 18（C18）：`vllm@ced6857a:vllm/v1/worker/gpu/input_batch.py#L19-L41` — 上游 `InputBuffers` 常驻设备张量分配。
- 来源 19（C19）：`vllm@ced6857a:vllm/v1/worker/gpu/states.py#L9-L51` — 上游 `RequestState` 使用 UVA 承载 `all_token_ids` 与长度缓冲。
- 来源 20–22（C20–C22）：`v0.23.0`（`2c59ff10`）强制回退 V1、`v0.26.0rc`（`2ed6cbba`）按需开启与 `main`（`8d6180e2`）`mrv2_utils.py` 彻底移除 V1 的版本演进。
