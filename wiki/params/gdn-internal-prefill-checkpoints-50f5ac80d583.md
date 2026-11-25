---
id: gdn-internal-prefill-checkpoints-50f5ac80d583
title: gdn_internal_prefill_checkpoints
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的门控增量网络（GDN）线性注意力 Prefill 内部检查点开关（默认 false）：设为 true 且满足
  mamba_cache_mode="align"、BF16、PCP=1、head_dim=128 等条件时，以 64 token 对齐切走 Triton
  分块算子导出 FP32 中间递推状态以提升前缀缓存复用率。
aliases:
  - additional_config.gdn_internal_prefill_checkpoints
  - GDN 内部检查点
  - GDN Prefill Checkpoints
relations:
  - to: linear-attention
    kind: builds-on
    note: 线性注意力按递推状态推进历史上下文，中间块缺少快照时无法像标准 KV 那样任意块边界复用前缀
  - to: paged-attention
    kind: builds-on
    note: 导出的块起点递推状态按 64 token 对齐交给前缀缓存规划器复用，减少长提示重复重算
  - to: ascend-config-system
    kind: builds-on
    note: 作为 AscendConfig 顶层布尔键配置，不满足层能力门槛时在层初始化阶段静默保持关闭
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 64-token 检查点导出与生效门槛
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L741
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/gdn_checkpoint.py#L1-L100'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L580-L625'
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/configuration/additional_config.md#L332-L360
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

在 Qwen3-Next 等含门控增量网络（Gated DeltaNet，简称 GDN，属[线性注意力](../concepts/linear-attention.md)家族）的混合架构模型里，层状态沿着序列一步步递推更新。默认 AscendC `FwdH` Prefill 算子一趟只算出整段序列末尾的终态——如果下一条请求只命中了前半段提示词（Prefix Caching），调度器因为拿不到中间块的递推状态快照，不得不退回切分重算。

`gdn_internal_prefill_checkpoints` 是 `main` 分支在 `--additional-config` 顶层提供的可选布尔开关（默认 `false`）。显式开启后，符合条件的 GDN 层会在 Prefill 阶段注册 `64` token 对齐粒度（`GDN_CHECKPOINT_ALIGNMENT = 64`），并在本步注意力元数据携带检查点计划（`metadata.checkpoint` 非空）时改走 Triton `chunk_gated_delta_rule_checkpoint` 算子，写出并导出规划块边界上的中间递推状态与卷积窗口快照供前缀缓存直接恢复：

```bash
vllm serve /models/Qwen3-Next-80B-A3B \
  --tensor-parallel-size 4 \
  --mamba-cache-mode align \
  --additional-config '{"gdn_internal_prefill_checkpoints": true}'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"gdn_internal_prefill_checkpoints": true}'` | 默认 `false`（保持默认 AscendC `FwdH` Prefill 递推路径） |
| 检查点对齐粒度 | `GDN_CHECKPOINT_ALIGNMENT = 64` tokens | 规划器按 64 token 边界对齐；前向仅在 `metadata.checkpoint` 非空时写出并导出对应中间状态 |
| 必需运行条件 | `mamba_cache_mode == "align"`、`dtype == bfloat16`、`PCP == 1`、未开 `--enable-dbo`（`use_ubatching`） | 任一条件不满足时 `initialize_gdn_checkpoints` 直接提前返回，保持原切分回退策略 |
| 必需模型头维 | `head_k_dim == 128` 且 `head_v_dim == 128` | 非 `128 × 128` 头维的线性注意力层自动跳过，不虚报导出能力 |
| 上游 vLLM 依赖 | `MambaSpec` 须包含 `num_prefill_checkpoint_blocks`（vLLM PR #60050） | 若配套 vLLM 版本过旧缺少该字段，开启后会直接抛 `ValueError` |
| 边界回退场景 | 启用 `kv_transfer_config`（P/D 分离）或无前瞻哈希的旧式 EAGLE 丢块 | 打印单次警告并回退常规 Prefill 调度，避免跨实例或投机边界不一致 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0`/`v0.26.0rc` 静默忽略 |

## 64-token 检查点导出与生效门槛

层初始化函数 `initialize_gdn_checkpoints(layer)` 采取「全满足才挂牌」的保守策略：只有当 `gdn_internal_prefill_checkpoints` 为 `true`，且同时满足 `mamba_cache_mode == "align"`、`prefill_context_parallel_size == 1`、模型精度为 `torch.bfloat16`、未开启微批流水 `use_ubatching`、层头维 `head_k_dim == head_v_dim == 128` 以及无 `kv_transfer_config` / 旧式 EAGLE 块丢弃冲突时，才会把 `layer._ascend_internal_checkpoint_enabled` 置为 `True` 并挂载 `MambaPrefillCheckpointExporter`。

一旦激活，Worker 在显存压测（Profiling）前向阶段就会通过 `ensure_gdn_checkpoint_workspace` 预分配一块形状为 `(max_num_seqs, num_v_heads // tp_size, 128, 128)` 的 `float32` 临时工作区（同 `VllmConfig` 下形状匹配的 GDN 层沿单流顺序复用同一块 scratch 缓冲，不按层数重复叠加），把这部分常驻开销如实计入 KV Cache 可用容量扣减，避免运行期突发 OOM。

## 代价与互斥边界

- **AscendC `FwdH` 切 Triton 算子的单趟算力权衡**：开启后 Prefill 主递推从融合 AscendC `FwdH` 切换到带中间快照写出的 Triton 分块核。在长公共前缀频繁命中的多轮对话/Agent 场景能省掉大段重复 Prefill；但在几乎零前缀复用的纯随机短请求负载下，只会多出算子切换与快照导出开销，应保持默认 `false`。
- **FP32 工作区显存占用**：虽然同流各 GDN 层共享同一块 `float32` scratch，但它的第一维与 `max_num_seqs` 成正比——单槽位即占 `(num_v_heads / TP) × 128 × 128 × 4` 字节。若把 `--max-num-seqs` 盲目拉得很大，这块工作区会直接挤占可用于分配 KV 块的显存预算。
- **P/D 分离下自动失效**：由于昇腾侧连接器切分规则可能与上游 Worker 检查点规划器的页边界不一致，只要配置了 `--kv-transfer-config`，源码都会主动告警并退回原有调度。

## 对照源码

下表对照四个固定教学快照中 `gdn_internal_prefill_checkpoints` 的定义、门槛校验与工作区共享实现：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 顶层字段定义 | 无 [C3] | 无 [C4] | 无（严格模式拒收）[C5][!] | `AscendConfig.gdn_internal_prefill_checkpoints: bool = False` [C1] |
| 层能力门槛与 PR 校验 | — | — | — | 校验 `align` / `PCP==1` / `BF16` / `128` 头维及 vLLM PR #60050；P/D 分离告警回退 [C2][!] |
| 跨层 FP32 工作区共享 | — | — | — | Profiling 期分配 `(max_num_seqs, local_v_heads, 128, 128)` FP32 缓冲并在各层间复用 [C2] |

- **官方文档与显存算式**：`additional_config.md` 说明了启用方式、Triton 路径切换及前缀缓存适用负载 [S6]；单槽位 `(num_v_heads / TP) × 128 × 128 × 4` 字节随 `max_num_seqs` 线性增长由 `ensure_gdn_checkpoint_workspace` 张量形状直接推导 [C2][D]。
- **待核**：尚缺 Qwen3-Next 混合模型在高/低前缀命中率两档流量下开闭本开关的 TTFT 收益拐点实测。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["gdn_internal_prefill_checkpoints"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:741` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

---- derived fields: sentinel default, after-validator overwrites ---- This switches the prefill recurrence; keep opt-in until cold/cache-hit numerical equivalence and performance are qualified on supported NPUs.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.gdn_internal_prefill_checkpoints` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
