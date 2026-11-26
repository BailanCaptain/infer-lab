---
id: msprobe-accuracy-debug
title: msprobe 逐层精度对齐与输出异常定位：从张量转储到算子分歧隔离
type: concept
origin: direct
summary: >-
  介绍在昇腾上用 MindStudio msprobe 定位乱码、NaN 与量化掉点的逐层精度比对方法，厘清 Eager 与图模式接入、L0/L1/mix 采集、四类算子分歧指纹及与 Runtime Guard、batch_invariant 的分工。
aliases:
  - msprobe
  - MindStudio msprobe
  - mindstudio-probe
  - PrecisionDebugger
  - AclGraphDumper
  - aclgraph_dump
  - dump_config
  - dump_config_path
  - 逐层精度对齐
  - 张量转储
  - 精度比对排障
  - 余弦相似度
chapters:
  - '19'
order: 7
sources:
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/msprobe_guide.md#L1-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1163-L1190'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L430-L450'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L279-L312'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L379-L393'
  - 'vllm-ascend@c09d3e20:vllm_ascend/batch_invariant.py#L166-L189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L556-L565'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/batch_invariance.md#L1-L45'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/runtime_guard.md#L1-L60'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L345-L360'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L358-L372'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L296-L315'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: inference-correctness-troubleshooting
    kind: builds-on
    note: 先按该页排除聊天模板、分词与采样差异并锁定同输入首分歧，再进本页做逐层张量对账
  - to: batch-invariance
    kind: builds-on
    note: 理解批大小变动引起的浮点归约漂移与确定性核替换，再决定是否先用批不变模式做对照
  - to: aisbench-and-evalscope
    kind: builds-on
    note: 通常先由 AISBench 或 EvalScope 发现评测集掉点，再挑出单条典型错题送入本页排查
  - to: acl-graph
    kind: builds-on
    note: 若 Eager 模式正常、开启 ACL Graph 后异常，需按本页切换到 AclGraphDumper 捕图侧张量
  - to: model-runner-v2
    kind: builds-on
    note: MRV1 与 MRV2 在 load_model 与 sample_tokens/pool 均内建了等价的 msprobe 启停钩子
contradicts: []
updated: '2026-11-24'
---

按 [输出异常排查](inference-correctness-troubleshooting.md) 对齐后，两套服务收到的 **token ID（词元编号）** 已完全一致，采样也锁死 `temperature=0`。如果此时昇腾仍输出乱码、`NaN/Inf`（无效数值或无穷大），或在 [AISBench / EvalScope](aisbench-and-evalscope.md) 基准里相比标杆（如 BF16 脑浮点原版或参考 GPU）大幅掉点，单看输出文字已无法猜出哪一层出错。此时需要抓取模型内部逐层、逐算子的输入输出特征图分段比对——这正是昇腾 **MindStudio `msprobe`**（面向昇腾训练与推理的逐层精度比对与张量转储工具）的核心用途。

不过，把全模型几十层、几百个算子的全量张量直接落盘动辄占满几十 GiB 磁盘且拖慢百倍。工程上的正确姿势是：**先分清 `Runtime Guard`、`batch_invariant` 与 `msprobe` 三类工具的分工，再按「统计初筛 → 缩小范围 → 真实张量」由粗到细四步锁定首个分歧算子**。

```wiki-diagram
file: msprobe-fig-layer-isolation
```

## `msprobe` 与 `Runtime Guard`、`batch_invariant` 怎么分工？

这三套工具都服务于推理正确性，但触发时机、性能代价与回答的问题截然不同：

| 工具 | 适用阶段与版本可用性 | 回答什么问题 | 运行开销与副作用 |
|---|---|---|---|
| **Runtime Guard** | 线上生产监控（`main` 分支引入，默认关闭、支持 `runtime_config.json` 热更新） | 在线捕获**偶发性**复读（`token_repeat`）、乱码、非有限 logits（`logits_finite`）并自动生成结构化报告与可选 KV cache 切片转储（`dump_kv`） | 检测关闭时近零开销；不改模型结构，但只定位到请求/KV 级，不直接拆解单层内部算子 |
| **`batch_invariant` 模式** | 稳定性复现实验（`v0.30.0` 及前后版本可用：`enable_batch_invariant: true` / `VLLM_BATCH_INVARIANT=1`） | 判断分歧是否源自**并发批大小/形状变化导致的浮点归约顺序差异**（见 [批不变性](batch-invariance.md)） | 会关闭 `vllm_ascend_C` 自定义算子库并切到确定性核，吞吐显著下降；若打开后错误消失，说明是批相关数值敏感或自定义核引入的差异 |
| **`msprobe` 逐层转储** | 离线精确定位（`v0.30.0` V1/V2 双轨均内建钩子，`v0.23.0` 仅 V1、`main` 仅 V2：`additional_config.dump_config`） | 针对**稳定复现的单条样本**，逐模块（`L0`）或逐算子（`L1`/`mix`）抓统计值与原始张量，与标杆对齐找出**第一处分歧算子** | 磁盘与耗时开销大，严禁直接开在生产高并发节点；须用单条固定请求、关闭干扰特性后在隔离环境采集 |

一个高效的联合排查顺序分三步走：先用线上 **Runtime Guard** 拦下坏样本与 KV 现场；再到测试环境分别在 `--enforce-eager` 与 `VLLM_BATCH_INVARIANT=1` 下做对照，切分是否涉及图模式或 `vllm_ascend_C` 自定义核/批形状；确认稳定复现后，最后启用 **`msprobe`** 精准打点。

## Eager 与图模式（ACL Graph）的接入边界，以及由粗到细四步法

在 `vLLM Ascend` 中，**MRV1**（第一代模型执行器 `Model Runner V1`）与 [Model Runner V2](model-runner-v2.md) 均已内建 `msprobe` 启停钩子，无需改模型代码。只需通过 `--additional-config` 传入内联 `dump_config`（引擎自动落盘至 `.vllm_ascend/msprobe/msprobe_dump_config.json`）或旧版 `dump_config_path`；二者互斥，不可同时设置。

但 **Eager 模式** 与 **图模式（[ACL Graph](acl-graph.md)）** 背后的转储后端并不相同：

- **Eager 模式（`cudagraph_mode == NONE`，即 `--enforce-eager`）**：实例化 `PrecisionDebugger`（Eager 逐算子挂钩调试器），通过 `pip install mindstudio-probe` 即可直接启用，并支持全部字段（`step`、`scope`、`list`、`dump_enable`）。
- **图模式（`FULL` 全路径整图 / `FULL_DECODE_ONLY` 仅解码整图 / `PIECEWISE` 在注意力边界分段编译）**：实例化 `AclGraphDumper`（面向静态图捕获与回放插桩的专用转储器），并在 `load_model()` 末尾、**图捕获开始之前**自动触发启动钩子以便对图捕获与回放插桩。该模式必须从 `msprobe` 源码带上 `include-mod=aclgraph_dump` 编译安装；且**暂不支持按 `step`、`scope`、`dump_enable` 过滤**，只能依赖 `list` 收缩算子范围。

执行抓取时严禁第一步就跑全模型 `task: "tensor"`，标准四步法如下：

1. **锁死单请求与对比基准**：准备 1 条稳定复现错误的 prompt，锁定 `temperature=0`，`max_completion_tokens` 覆盖首次出错步前后几步。若为单卡调试，`dump_config` 中的 `rank` 必须设为 `[]`。
2. **第一轮 `statistics` + `L1` / `L0` 粗筛**：设 `"task": "statistics"`，先抓每模块（`L0`，生成 `construct.json`）或每算子（`L1`）的 `max / min / mean / norm` 摘要与 `dump.json`。按执行序逐行比对标杆，30 秒内即可找到**第一个出现 `NaN/Inf` 或均值/幅值断崖偏离的层号 `layers.k` 与迭代步 `step`**。
3. **第二轮收窄 `scope` / `list` 与 `step`**：锁定第 `k` 层第 `t` 步后，在 Eager 下填入 `"step": [t]` 与 `"scope": [start_name, end_name]` 起止范围（单层定位须给该层起止模块名，或改用 `"level": "mix"` + `"list"` 指定该层子模块，不可传单元素 `scope`），再把 `"task"` 切换为 `"tensor"`，仅落盘这一层的真实 `.pt` 张量。
4. **单算子数值核验与根因收敛**：计算首个分歧算子输入与输出的**余弦相似度**（衡量两个张量方向一致程度，越接近 `1.0` 越一致）与**最大绝对误差**。若**输入高度一致而输出骤然发散**，该算子即为高优先调查起点；接着结合原始张量核实究竟是算子/缩放实现缺陷，还是前序微小浮点差异在近似相等的路由 `top-k` 边界触发了正常名次翻转，避免仅凭余弦骤降一票定案。

## 四类高频首分歧算子的排查指纹

在昇腾推理精度排障实战中，绝大多数底层分歧都会收敛到以下四类核心模块。先对照指纹图定位症状形态，再按下方清单逐项核查：

```wiki-diagram
file: msprobe-fig-four-fingerprints
```

| 首分歧落点 | 典型统计与张量指纹 | 优先检查清单 |
|---|---|---|
| **RoPE（旋转位置编码）** | 第 `0` 层注意力前的 `Q` / `K` 投影还完全对齐，但经过 RoPE 旋转后立即出现大误差 | 检查位置索引 `positions`、`cos/sin` 预计算缓存（MRV2 MLA 的 `update_cos_sin`）、[RoPE](rope.md) 的交错（interleave）与分段旋转排布是否与模型权重一致 |
| **QuantMatmul（量化线性层）** | 进入 `W8A8` / `MXFP8` / `FP8` 线性层前输入一致，输出整体缩放倍数漂移或局部分布截断 | 核对权重 `scale` / `offset`、是否开启了 `weight_nz_mode`（NZ 转置与 RL/特定量化冲突）、或 `quant_description` 中 `norm.bias` / 量化类型（`W8A8` vs `W8A8_DYNAMIC`）是否误配（参见 [量化原理](quantization.md)） |
| **MoE 路由与融合专家** | 路由器（Gate）输出 `logits` 正常，但 `top-k` 专家索引分叉，或经 EP Dispatch/Combine 后某几行变全零/幅值减半 | 检查门控精度与 `top-k` 并列打平规则、**EPLB**（动态专家负载均衡）的逻辑-物理专家映射表（`AscendEplbState`）、以及融合 **MC2**（计算与通信协同融合算子）/ `vllm_ascend_C` 核（用 `VLLM_BATCH_INVARIANT=1` 关掉自定义库即可秒判，参见 [MoE](moe.md)） |
| **FlashAttention / PagedAttention** | 首步 Prefill（`step 0`）全层对齐，但从第 `1` 步 Decode 开始逐步发散 | 重点查写入与读取 KV cache 的 `slot_mapping`（把本步各 token 映射到物理 KV 块槽位的索引表）、块表偏移、非连续或 **C8**（`INT8` 8 位量化 KV 缓存）的 scale 还原（如 GQA/MLA C8 缩放因子），以及 [Ascend FlashAttention](ascend-flash-attention.md) 在 Eager vs `FULL_DECODE_ONLY` 图模式下的 **FIA**（FusedInferAttentionScore 融合注意力算子）填充边界 |

## 常见误解

- **误解一：“`pip install mindstudio-probe` 装完后，直接开着 `FULL_DECODE_ONLY` 图模式就能抓 `msprobe`。”**
  错。图模式走的是 `AclGraphDumper`，普通 pip 轮子不含该扩展，启动会直接报 `Failed to import AclGraphDumper from msprobe`；要么加 `--enforce-eager` 切到 `PrecisionDebugger`，要么按官方步骤加 `-e include-mod=aclgraph_dump` 源码编包。
- **误解二：“单卡测试时，`dump_config` 里把 `rank` 写成 `[0]` 最保险。”**
  错。官方 `msprobe_guide.md` 明确规定，单卡任务必须将 `"rank"` 设为 `[]`（空列表）；误写 rank 列表在单卡非分布式上下文中容易导致过滤掉全部数据。
- **误解三：“打开 `batch_invariant` 之后精度恢复正常，说明原问题一定是浮点随机误差，不是算子 bug。”**
  不一定。`VLLM_BATCH_INVARIANT=1` 除了替换确定性规约核，**还会让 `enable_custom_op()` 返回 `False` 从而全局禁用 `vllm_ascend_C` 自定义算子库**；如果打开后异常消失，务必继续对比“仅关 `vllm_ascend_C`”与“仅改批大小”，避免把某个 AscendC 自定义核的真实 bug 误判为浮点抖动。

## 对照源码

### 怎么开与标准采集命令

```bash
# 1. Eager 模式第一轮粗筛：仅抓 L1 算子统计量，避免磁盘爆炸
vllm serve /path/to/Qwen3-8B \
    --dtype bfloat16 \
    --enforce-eager \
    --additional-config '{
      "dump_config": {
        "task": "statistics",
        "level": "L1",
        "dump_path": "/data/msprobe_dump",
        "rank": [],
        "step": [0, 1],
        "async_dump": false,
        "statistics": {"scope": [], "list": [], "data_mode": ["all"], "summary_mode": "statistics"}
      }
    }'

# 2. 发送单条确定性请求触发 start -> forward -> stop -> step 完整周期
curl http://localhost:8000/v1/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"/path/to/Qwen3-8B","prompt":"Explain gravity in one sentence.","max_completion_tokens":8,"temperature":0}'
```

- **核验配置物化与双模式调试器**：`AscendConfig._resolve_dump_config_path` 强制校验 `dump_config` 与 `dump_config_path` 互斥，并将内联字典写入 `.vllm_ascend/msprobe/msprobe_dump_config.json`[C2]。在 MRV1 与 MRV2 中，若 `cudagraph_mode == CUDAGraphMode.NONE` 则实例化 `PrecisionDebugger`，否则尝试导入 `AclGraphDumper`（缺失时抛 `RuntimeError`）并在 `load_model()` 末尾、图捕获之前先启动转储器，随后在 `sample_tokens()` / `pool()` 等全部出口调用 `_finalize_dump_data()` 收尾[C3][C4][C5]。
- **核验三类工具边界**：`msprobe_guide.md` 定义了 `L0`/`L1`/`mix` 三级精度级别、Eager 与图模式字段支持矩阵（图模式不支持 `step` / `scope` / `dump_enable`）与单卡 `rank: []` 要求[S1]；`init_batch_invariance()` 在 `VLLM_BATCH_INVARIANT=1` 时覆写确定性环境并注册批不变核[C6][S8]，同时 `enable_custom_op()` 会直接返回 `False` 禁用 `vllm_ascend_C`[C7]；`Runtime Guard` 则位于 `main` 分支，提供在线检测器（`token_repeat`、`logits_finite` 等）与按需 `dump_kv` 热更新能力[S9]。具体余弦相似度与绝对误差的合格阈值需结合模型量化位宽（BF16 / W8A8 / MXFP4）及业务精度基线实测确定[I]。

### 会报什么错

| 触发场景 | 报错现象 | 根因与修法 |
|---|---|---|
| `--additional-config` 同时传入 `dump_config` 和 `dump_config_path` | `ValueError: Only one of additional_config.dump_config_path or additional_config.dump_config can be set.` | 仅保留其中一项，推荐直接传内联 `dump_config`（来源 2） |
| 开启图模式但仅用 `pip install mindstudio-probe` 安装标准包 | `RuntimeError: Failed to import AclGraphDumper from msprobe.` | 加 `--enforce-eager` 退回 `PrecisionDebugger`，或按官方步骤带 `include-mod=aclgraph_dump` 编译安装（来源 1、4） |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| `msprobe` 在 Model Runner 中的支持 | 仅接入 MRV1（`model_runner_v1.py`）[C10] | 延续 MRV1 接入（`PrecisionDebugger` / `AclGraphDumper`）[C11] | MRV1 与 MRV2 双轨均完成对等接入（含 `sample_tokens` 与 `pool` 收尾）[C4][C5] | MRV1 移除后由 MRV2 唯一承接 `msprobe` 钩子[C12] |
| `Runtime Guard` 在线异常守卫 | 尚未引入 | 尚未引入 | 尚未合入 `v0.30.0` 正式版文档与主干 | 正式提供 `runtime_config` 热更新检测器与 `dump_kv` 能力[S9] |
| `batch_invariant` 确定性对照模式 | 早期适配阶段 | 支持 `VLLM_BATCH_INVARIANT=1` | 完整提供 `enable_batch_invariant` 入口，自动联动禁用 `vllm_ascend_C`[C6][C7] | 延续批不变模式与 Triton/AscendC 确定性核 |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–12 项（官方文档项为 `S1`、`S8`、`S9`，源码项为 `C2`–`C7`、`C10`–`C12`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/msprobe_guide.md#L1-L170` — `msprobe` 三级精度级别、图模式源码构建方法、字段支持表与采集周期说明。
- 来源 2（C2）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1163-L1190` — `dump_config` 自动落盘与 `dump_config_path` 互斥校验。
- 来源 3（C3）：`vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L430-L450` — MRV1 中按 `cudagraph_mode` 切换 `PrecisionDebugger` / `AclGraphDumper`。
- 来源 4（C4）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L279-L312` — MRV2 中调试器初始化与图模式下 `load_model()` 末尾提前启动。
- 来源 5（C5）：`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L379-L393` — MRV2 在 `sample_tokens()` 与 `pool()` 出口收尾 `_finalize_dump_data()`。
- 来源 6（C6）：`vllm-ascend@c09d3e20:vllm_ascend/batch_invariant.py#L166-L189` — `init_batch_invariance()` 启用确定性环境与批不变核。
- 来源 7（C7）：`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L556-L565` — `VLLM_BATCH_INVARIANT=1` 同步关闭 `vllm_ascend_C` 自定义库。
- 来源 8（S8）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/batch_invariance.md#L1-L45` — 批不变模式使用边界与限制文档。
- 来源 9（S9）：`vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/runtime_guard.md#L1-L60` — `main` 分支 `Runtime Guard` 在线异常检测与 `dump_kv` 配置指南。
- 来源 10–12（C10–C12）：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）与 `main`（`8d6180e2`）下 `msprobe` 钩子从 MRV1 到 MRV2 的演进对照。
