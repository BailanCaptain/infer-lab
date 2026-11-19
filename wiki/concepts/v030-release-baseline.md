---
id: v030-release-baseline
title: v0.30.0 正式版升级与避坑清单：废弃环境变量、默认行为变更与迁移对照
type: concept
origin: direct
summary: >-
  从 v0.26 / rc2 升级至 v0.30.0 正式版（c09d3e20 + ced6857a）的生产迁移清单：涵盖退役环境变量、FLASHCOMM1 兜底、W8A8_MIX、显存默认 0.92、HardwareProfile、原生 FP8_BLOCK 与 MRV2 切换。
aliases:
  - v0.30.0 升级清单
  - v0.30.0 迁移指南
  - v0.30.0 避坑清单
  - VLLM_ASCEND_ENABLE_MLAPO
  - VLLM_ASCEND_ENABLE_FUSED_MC2
  - MSMONITOR_USE_DAEMON
  - VLLM_ASCEND_ENABLE_FLASHCOMM1
  - HardwareProfile 四家族重构
chapters:
  - '19'
order: 2
sources:
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L1-L25'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L375-L390'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L604-L620'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L654-L672'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L745-L756'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L840-L872'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L35-L50'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L1-L75'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L382'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L32'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L995'
  - 'vllm-ascend@c09d3e20:docs/source/faqs.md#L146-L150'
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L115'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_pdmix.py#L35-L95'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L70-L99'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_pdmix.py#L85-L98'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L750-L760'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L130'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L89'
  - 'vllm@ba15685a:vllm/config/cache.py#L216-L228'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: core-cli-params
    kind: builds-on
    note: 升级后同时核对四大核心启动旋钮、批预算 6 分支与跨子系统静默改写规则
  - to: model-runner-v2
    kind: builds-on
    note: 深入查看 v0.30.0 按需开启 MRV2 与 main 强制统一 MRV2 的执行器内部变化
  - to: ascend-config-system
    kind: builds-on
    note: 理解退役环境变量迁移进 additional_config 后的 Pydantic 校验链与优先级
  - to: quantization-methods
    kind: builds-on
    note: 查阅 W8A8_MIX、W8A8_DYNAMIC、MXFP8 与原生分块 FP8 的量化权重格式差异
  - to: dev-new-model-and-custom-op
    kind: builds-on
    note: 若维护自研模型或算子，需按本页 HardwareProfile 四家族能力档案迁移芯片分支判断
  - to: vllm-ascend-for-rl
    kind: builds-on
    note: 强化学习权重回写需保持 weight_nz_mode=0，详细配置见该页
contradicts: []
updated: '2026-11-19'
---

把一套在线上稳定运行了几个月的 `v0.26` 或 `v0.30.0rc2` 启动脚本直接原样搬到 **`vLLM Ascend v0.30.0` 正式版（配套上游 `vLLM v0.30.0`）**，最隐蔽的风险并不是“当场报错起不来”，而是**旧环境变量静默失效、显存水位默认多占 `2%`、或原生 FP8 权重在 A2/A3 上静默反量化回 `BF16` 导致显存直接翻倍**。与此同时，社区 `main` 分支已经在 `v0.30.0` 之上进一步删掉了 Model Runner V1 与部分回退路径；如果升级时不顺手清掉过期开关，下一次升级还会二次踩坑。

本页按生产升级自检顺序，把六类最容易引发线上回滚的变化一次拉齐：

```wiki-diagram
file: v030-mig-fig-checklist
```

## 清单 1：退役环境变量与 `additional_config` 替代对照

在 `v0.26.0rc` 时期，权重分形排布（NZ）、MLAPO 算子融合、融合 MC2 与守护监控开关仍通过环境变量暴露在 `vllm_ascend/envs.py`；从 `v0.30.0rc2` 到 `v0.30.0` 正式版，这些开关全部收口至 `--additional-config` 的 `AscendConfig` Pydantic 字段中（配置解析链见 [Ascend 配置体系](ascend-config-system.md)）。继续在 `docker run -e` 或启动脚本里 `export` 下列退役环境变量，**程序不会提示拼写错误，而是直接忽略它们**：

| 旧环境变量（`v0.26`） | `v0.30.0` 生效状态 | `v0.30.0` 正式替代字段（`--additional-config`） | 默认值与迁移注意点 |
|---|---|---|---|
| `VLLM_ASCEND_ENABLE_NZ` | **已从 `envs.py` 移除（失效）** | `weight_nz_mode`（`0` / `1` / `2`） | 默认 **`1`**；强校验仅接受 `0/1/2`；强化学习开启 `rl_config.enabled: true` 会自动强刷为 `0`（见 [RL 权重更新](vllm-ascend-for-rl.md)） |
| `VLLM_ASCEND_ENABLE_MLAPO` | **已从 `envs.py` 移除（失效）** | `enable_mlapo`（`bool`） | 默认 **`true`**；若同时配置 `mlapo_keep_prefill_weights: true` 必须保持 `enable_mlapo: true` |
| `VLLM_ASCEND_ENABLE_FUSED_MC2` | **已从 `envs.py` 移除（失效）** | `enable_fused_mc2`（`0` / `1` / `2`） | 默认 **`0`**；`1` 表示回滚到 `dispatch_ffn_combine`，`2` 尝试启用 MegaMoe（内部映射后受芯片与模型校验）；与 `multistream_overlap_shared_expert` 互斥 |
| `MSMONITOR_USE_DAEMON` | **已从 `envs.py` 移除（失效）** | `msmonitor_use_daemon`（`bool`） | 默认 **`false`**；迁移进 JSON 后便于与服务侧 profiling 配置统一校验 |
| `VLLM_ASCEND_ENABLE_FLASHCOMM1` | `envs.py` 已移除，但 `ascend_config.py` **保留 `os.getenv` 兼容兜底** | `enable_flashcomm1`（`bool`） | 虽在 `v0.30.0` 仍能被环境变量唤醒，但不应继续依赖；且在 `main` 中上游已移除 `PassConfig.enable_sp`，激活 `FlashComm1` 会打印告警并关闭量化 All-Reduce |

> 升级动作：全局搜索部署脚本、Helm Chart 和容器镜像里的 `VLLM_ASCEND_ENABLE_` 与 `MSMONITOR_USE_DAEMON`，把上述五项全部迁入 `--additional-config '{...}'` JSON 块中。

## 清单 2：量化方案命名与原生 `FP8_BLOCK` 跨卡行为差异

升级过程中涉及量化权重的两类高频坑点如下（量化原理见 [量化方法与布局](quantization-methods.md)）：

1. **`W8A8_PDMIX` 命名与 `W8A8_MIX` MoE 路径退场**：历史上常称混合静态/动态激活的 W8A8 路径为 `W8A8_PDMIX`，对应文件虽仍保留在 `quantization/methods/w8a8/w8a8_pdmix.py`，但实际注册进量化方案表的键名是 **`W8A8_MIX`**。更重要的是，在 `v0.26.0rc` 中 `@register_scheme("W8A8_MIX", "moe")` 就已打印弃用警告；到了 `v0.30.0` 正式版，**`W8A8_MIX` 的 `moe` 注册已被彻底移除，仅保留 `linear` 线性层实现（`AscendW8A8PDMixLinearMethod`）**。如果你沿用了把 MoE 专家标成 `W8A8_MIX` 的旧 `quant_model_description.json`，请改用 `W8A8_DYNAMIC` 量化描述。
2. **原生分块 `FP8_BLOCK`（`quant_method: "fp8"`）在 A2/A3 与 950 上的天壤之别**：对于社区直接发布的分块 `float8_e4m3fn` + `weight_scale_inv` 权重（例如官方注释举例的 `Qwen3.8-27B-FP8`），没有任何昇腾矩阵乘直接消费原始分块布局：
   - 在 **昇腾 950（A5）** 上，`v0.30.0` 加载后会将权重实时重定量为原生 **MXFP8**（每 32 元素共享 1 个 E8M0 缩放因子），保持 1 字节/元素的显存体量并走原生 `npu_quant_matmul`。
   - 在 **Atlas A2 / A3（910B/910C）** 上，`v0.30.0` 会把权重**静默反量化回模型浮点类型（通常为 `BF16`，2 字节/元素）**再走普通非量化 GEMM——服务能跑通、精度正确，但权重显存直接翻倍，极易挤爆原本按 FP8 算好的单卡 KV 预算。
   - **面向 `main` 预警**：`main` 分支中 `fp8_block.py` 新增了 `_require_fp8_weight_matmul()` 硬门控，在无原生 FP8 矩阵乘的 A2/A3 卡上加载分块 FP8 权重不再静默反量化，而是**直接抛 `NotImplementedError`**，明确要求改用 `BF16` 原版权重或经 ModelSlim / LLM-Compressor 重新量化的权重。

## 清单 3：`CacheConfig` 显存水位 `0.92`、`HardwareProfile` 重构与 `MRV2` 切换

除了配置项和量化，还有三项底层架构变化直接影响上线稳定性与自研插件兼容性：

- **`gpu_memory_utilization` 源码默认是 `0.92` 而非 `0.90`**：上游 `CacheConfig` 在 `v0.30.0` 中的默认值是 **`0.92`**（部分旧版 `faqs.md` 文档文案仍停留在历史值 `0.9`）。在单卡 64 GiB 设备上，默认留给图捕获（ACL Graph / `npugraph_ex`）与运行期波动的预算外余量从 `6.4 GiB` 缩减到 `5.12 GiB`。如果你的部署叠加了 `FULL_DECODE_ONLY` 大档位录图或较大 HCCL 通信缓冲，建议在命令行显式传入 `--gpu-memory-utilization 0.90`（详细联动账单见 [核心参数全分支调优指南](core-cli-params.md) 与 [KV Cache 显存预算](kv-cache-memory-profiling.md)）。在 `main` 分支中，该字段默认值进一步演进为 `None`，由 `resolved_gpu_memory_utilization` 按常规模式解析为 `0.92`（可扩展 KV 池模式解析为 `1.0`）。
- **`HardwareProfile` 四家族语义重构**：在 `v0.26.0rc` 及之前，仓内大量逻辑直接散落着 `is_310p()` 或芯片型号 `if/else`；`v0.30.0` 引入 `vllm_ascend/device/hardware_profile.py`，把硬件识别统一收拢为不可变的四家族档案——**`A2`、`A3`、`_310P`、`A5`（昇腾 950）**，通过 `HardwareCapability` 布尔能力契约、策略（`*Policy`）与实现家族（`*Family`）解耦业务逻辑。特别提醒：在 `v0.30.0` 中，`A5` 档案**暂不含 `RUNTIME_CUSTOM_OPS`**，因此 950 上会自动关闭 `vllm_ascend_C` 走标准算子回退（`main` 已补回该能力，详情见 [新模型适配与自定义算子开发](dev-new-model-and-custom-op.md)）。
- **`MRV2` 切换红线与 `rc2 → v0.30.0` 稳定性收口**：在 `v0.30.0` 正式版中，`patch_use_v2_model_runner.py` 保持未设环境变量时默认走 **MRV1**，而开启 **PCP**、**DeepSeek V4.1（A5）**、**`--enable-return-routed-experts`**、**`CPP + async_scheduling`** 或 **V2 EPLB** 时必须显式导出 `VLLM_USE_V2_MODEL_RUNNER=1`（完整边界见 [Model Runner V2](model-runner-v2.md)）。相比 `v0.30.0rc2`，正式版 `v0.30.0`（`c09d3e20`）还对齐了 CANN `9.2.1` 基线、修复了 MRV2 结构化输出中 Triton 无序锁工作区问题、收口了 EPLB 文档与配置校验，并移除了部分模型教程中无效的 `enable_flashcomm1` 示例。而面向未来升级至 `main` 时，须提前验证业务在 MRV2 下的精度与时延，因为 `main` 已删除 MRV1，且残留 `VLLM_USE_V2_MODEL_RUNNER=0` 会直接报错退出。

## 常见误解

- **误解一：“启动脚本里的 `VLLM_ASCEND_ENABLE_NZ=0` 没报错，说明 NZ 已经关掉了。”**
  错。`v0.30.0` 的 `envs.py` 已删除该变量，导出它不会触发任何警告，但实际 `AscendConfig.weight_nz_mode` 仍取默认值 `1`；在强化学习权重回写等必须关 NZ 的场景下，必须写进 `--additional-config '{"weight_nz_mode": 0}'`（或开启 `rl_config.enabled: true`）。
- **误解二：“A2 上直接拉起 `Qwen3.8-27B-FP8` 成功返回答案，说明 A2 已经支持 FP8 算力加速了。”**
  错。`v0.30.0` 在 A2/A3 上只是悄悄把原生分块 FP8 反量化回 `BF16` 来跑普通 GEMM，既没有 FP8 吞吐加速，显存还翻了一倍；且升到 `main` 后该写法会直接抛 `NotImplementedError`。
- **误解三：“FAQ 里写着 `--gpu-memory-utilization` 默认 `0.9`，所以我不传参数就留了 10% 显存给录图。”**
  错。源码 `CacheConfig` 的真实默认值是 `0.92`，实际预算外余量只有 `8%`；录图阶段报 OOM 时应先检查是否未显式传入 `0.90` 或 `0.88`。
- **误解四：“从 `v0.30.0rc2` 升到 `v0.30.0` 正式版，是不是就已经默认切到 Model Runner V2 了？”**
  不是。`v0.30.0` 正式版仍以 MRV1 为默认执行器（见官方 `release_notes.md` 顶部提示），全面默认切换并删除 MRV1 发生在 `v0.30.0` 之后的 `main` 分支。

## 对照源码

### 升级自检命令与配置模板

```bash
# 1. 排查现有部署脚本 / K8s YAML 中残留的已退役环境变量
grep -rnE "VLLM_ASCEND_ENABLE_(NZ|MLAPO|FUSED_MC2|FLASHCOMM1)|MSMONITOR_USE_DAEMON|DYNAMIC_EPLB|EXPERT_MAP_RECORD|W8A8_PDMIX" deploy/

# 2. v0.30.0 规范启动写法（以 Qwen3-30B-A3B 迁移至 JSON 字段 + 显式水位为例）
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --quantization ascend \
    --gpu-memory-utilization 0.90 \
    --additional-config '{
      "weight_nz_mode": 1,
      "enable_mlapo": true,
      "enable_fused_mc2": 0,
      "msmonitor_use_daemon": false,
      "enable_flashcomm1": false
    }'
```

- **核验退役环境变量与兜底路径**：`v0.26.0rc` 的 `envs.py` 明确注册了 `VLLM_ASCEND_ENABLE_FLASHCOMM1`、`MSMONITOR_USE_DAEMON`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_NZ` 与 `VLLM_ASCEND_ENABLE_FUSED_MC2`[C16]；到 `v0.30.0`，它们从 `envs.py` 消失并改为 `AscendConfig` 中的 `weight_nz_mode`（默认 `1`、校验 `0/1/2`、RL 强制置 `0`）、`enable_mlapo`（默认 `True`）、`enable_fused_mc2`（默认 `0`、`2` 内部映射）与 `msmonitor_use_daemon`（默认 `False`）[C3]（来源 2、4、6），唯独 `enable_flashcomm1` 仍在 `ascend_config.py` 保留了 `os.getenv("VLLM_ASCEND_ENABLE_FLASHCOMM1", "0")` 兜底[C5]。
- **核验量化、显存水位、硬件档案与 MRV2**：`w8a8_pdmix.py` 在 `v0.26.0rc` 弃用 `W8A8_MIX` MoE 注册（来源 17），在 `v0.30.0` 仅保留 `@register_scheme("W8A8_MIX", "linear")`[C7]；原生分块 `FP8` 在 `v0.30.0` 对 950 转 MXFP8、对 A2/A3 静默反量化回 `BF16`（使权重驻留字节翻倍[D]）[C8]，而在 `main` 通过 `_require_fp8_weight_matmul()` 直接抛 `NotImplementedError`[C19]。`CacheConfig.gpu_memory_utilization` 在源码中默认 `0.92`[C14]（`faqs.md` 仍残留 `0.9` 旧说明[S13]），`main` 演进为 `resolved_gpu_memory_utilization`（来源 21）。`HardwareProfile` 确立 `A2`/`A3`/`_310P`/`A5` 四家族能力契约（`v0.30.0` 下 A5 不含 `RUNTIME_CUSTOM_OPS`，来源 9–10）；`v0.30.0` 发布说明与补丁确认默认仍为 MRV1[S1]（来源 11），而 `main` 的 `mrv2_utils.py` 彻底统一 MRV2[C20]。

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 4 个旧环境变量（NZ / MLAPO / FUSED_MC2 / MSMONITOR） | 走环境变量配置 | `envs.py` 仍在读环境变量，并开始过渡至 `additional_config` | 从 `envs.py` 移除，全面改走 `AscendConfig` JSON 字段（旧变量静默忽略） | 延续纯 `additional_config` 配置，进一步移除 `profiling_chunk_config` |
| `VLLM_ASCEND_ENABLE_FLASHCOMM1` | 走 `envs.py` 注册读取 | `envs.py` 保留注册读取 | `envs.py` 移除，`ascend_config.py` 留 `os.getenv` 兜底 | 延续兜底读取，但上游移除 `PassConfig.enable_sp` 并打印告警关闭量化 AR |
| `W8A8_PDMIX` / `W8A8_MIX` | 同时注册 `W8A8_MIX` 的 `linear` 与 `moe`（来源 15） | `W8A8_MIX` `moe` 打印弃用告警 | 仅保留 `W8A8_MIX` `linear`，移除 `moe` 注册 | 仅保留 `W8A8_MIX` `linear` |
| `HardwareProfile` 与原生 `FP8_BLOCK` | 无 `HardwareProfile` 文件 | 无 `HardwareProfile` 文件 | 四家族 `HardwareProfile` 落地；A2/A3 加载原生 `FP8_BLOCK` 静默反量化回 `BF16`；A5 暂关 `RUNTIME_CUSTOM_OPS` | A2/A3 加载原生 `FP8_BLOCK` 直接抛 `NotImplementedError`；A5 恢复 `RUNTIME_CUSTOM_OPS` |
| `gpu_memory_utilization` 与 `MRV2` | 默认 `0.92`；强制禁用 MRV2 | 默认 `0.92`；默认 MRV1，按需开启 MRV2 | 默认 `0.92`；默认 MRV1，PCP/DSV4.1/R3/CPP+async 强制 MRV2 | 字段默认 `None` 按模式解析；删除 MRV1，设 `=0` 抛 `ValueError` |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–21 项（官方文档项为 `S1`、`S13`，其余为源码项 `C2`–`C12`、`C14`–`C21`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L1-L25` — `v0.30.0` 正式版发布说明、旗舰支持范围与默认 V1 声明。
- 来源 2（C2）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L375-L390` — `rl_config` 自动将 `weight_nz_mode` 覆写为 `0`。
- 来源 3（C3）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L604-L620` — `enable_fused_mc2`、`enable_mlapo`、`msmonitor_use_daemon`、`weight_nz_mode` 字段定义与默认值。
- 来源 4（C4）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L654-L672` — `weight_nz_mode` 合法值校验与 `enable_fused_mc2=2` 映射逻辑。
- 来源 5（C5）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L745-L756` — `enable_flashcomm1` 与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 兜底读取。
- 来源 6（C6）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L840-L872` — `enable_fused_mc2` 互斥约束与 `mlapo_keep_prefill_weights` 依赖校验。
- 来源 7（C7）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L35-L50` — 仅保留 `@register_scheme("W8A8_MIX", "linear")`。
- 来源 8（C8）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34` — 原生分块 FP8 在 A5 转 MXFP8、在其余芯片反量化回模型浮点类型。
- 来源 9（C9）：`vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L1-L75` — `HardwareProfile` 语义边界、`HardwareCapability` 与 `*Policy` / `*Family` 定义。
- 来源 10（C10）：`vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L382` — `310P` 与 `A5`（950）四家族能力档案详情。
- 来源 11（C11）：`vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L32` — `v0.30.0` 默认返回 `False`（MRV1）的纯环境变量补丁。
- 来源 12（C12）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L995` — DeepSeek V4.1 A5 与 MRV2 EPLB 校验红线。
- 来源 13（S13）：`vllm-ascend@c09d3e20:docs/source/faqs.md#L146-L150` — FAQ 中保留的历史 `0.9` 显存比例说明。
- 来源 14（C14）：`vllm@ced6857a:vllm/config/cache.py#L103-L115` — 上游 `CacheConfig.gpu_memory_utilization` 默认值 `0.92`。
- 来源 15–18（C15–C18）：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）旧环境变量与 `W8A8_MIX` MoE 弃用基线，以及 `v0.30.0rc2`（`7d825229`）`FLASHCOMM1` 兜底行号对照。
- 来源 19–21（C19–C21）：`main`（`8d6180e2` / `ba15685a`）中 `_require_fp8_weight_matmul()` 拒绝 A2/A3 原生 FP8、`mrv2_utils.py` 统一 MRV2 与 `resolved_gpu_memory_utilization` 演进。
