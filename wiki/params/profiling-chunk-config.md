---
id: profiling-chunk-config
title: 动态切块配置（profiling_chunk_config）
type: param
summary: >-
  通过启动时的 profiling 调整 chunk 大小，默认关闭。main 开发主线要求 PP>1，且不能与负载均衡调度同时开启；与 v0.23
  维护分支对 need_timing 的处理不同。
aliases:
  - profiling chunk
  - 动态 chunk 大小
  - ProfilingChunkConfig
  - smooth_factor
chapters:
  - '12'
  - '13'
sources:
  - >-
    raw:sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md#L1-L130
  - >-
    raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339
evidence: I
relations: []
contradicts: []
updated: '2026-09-17'
origin: seed
rawSources:
  - >-
    raw/sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md
  - >-
    raw/sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md
---

## 一句话

`profiling_chunk_config` 控制基于 profiling 的动态 chunk 大小，默认 `enabled: False`。v0.23 维护分支的代码说明：开启后，调度器在初始化时测量 prefill 延迟，再用二次模型在运行时预测合适的 chunk 大小。两版行为有分叉 [!]：
- main 开发主线开启时要求 `pipeline_parallel_size > 1`，且与 `enable_balance_scheduling` 互斥。
- 两版对 `need_timing` 的联动处理不同。

本页对比 **[main 开发主线（2026-08-29 源码快照）](https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e8e8db396ee5dcfa6812626eee2d394ab/vllm_ascend/ascend_config.py#L1021-L1057)**与 **[v0.23 维护分支（2026-09-10 源码快照）](https://github.com/vllm-project/vllm-ascend/blob/2c59ff1047573f40a471cf7535f01a8877344415/vllm_ascend/ascend_config.py#L723-L760)**。下文均指这两个固定快照，对应提交可在来源中核对。

本页只依据配置源码摘录，没有性能实验。

## 事实表

| 项 | main 开发主线 | v0.23 维护分支 | 意味着什么 |
|---|---|---|---|
| `enabled` 默认 | `False` | 同左 | 不显式打开就不生效。摘录中的三项跨配置检查以 `enabled` 为前提 |
| 不设 `need_timing` 时 | 以 `None` 作哨兵，由 after-validator 补成 `enabled` 的值 | `config.get("need_timing", self.enabled)` | 未显式设置时，两版配置对象的 `need_timing` 都跟随 `enabled`；v0.23 维护分支的注释另外描述了在线计时校准，配置值本身不证明实际执行情况 |
| `enabled=False` 但显式设 `need_timing=True` | 打 warning，并强制改为 `False` | 摘录的 `_validate` 里没有这条修正，值保持 `True` [!] | v0.23 维护分支中配置对象可保留 enabled=False、need_timing=True 的组合。这种组合的实际后果，材料没有说明 [I] |
| `smooth_factor` | 必须在 `(0, 1]` 内，否则 `ValueError` | 同左 | 填 0 或大于 1 会在启动时直接失败。main 配置默认 1.0，参与下文的线性插值；维护分支的运行公式尚未核对 |
| `min_chunk` 下限 | 必须 `> 0`，默认 4096 | 同左 | 填 0 或负数会在启动时失败 |
| `min_chunk` 与 `max_num_batched_tokens` | 开启时若 `max_num_batched_tokens < min_chunk`，打 warning，再把 `min_chunk` 钳到 `max_num_batched_tokens` | 材料未覆盖 | `max_num_batched_tokens` 设在 4096 以下时，默认的 `min_chunk` 会被改小。这一分支仅告警并调整数值；后续 PP 或互斥检查仍可能报错 |
| `max_fit_chunk` 校验 | `<= 5` 报错，默认 30 | 同左 | 报错文案建议「至少 30 个数据点」，硬阈值却是 6。填 6–29 能通过，摘录里也没看到对应的警告 [D] |
| PP 要求 | 开启且 `pipeline_parallel_size <= 1` 时 `ValueError` | 材料未覆盖 | 在 main 开发主线上，单卡或只开 TP 的部署无法打开此项 |
| 与 `enable_balance_scheduling` | 两者同开时 `ValueError` | 材料未覆盖 | 在 main 开发主线上只能二选一 |

## 为什么存在

材料对动机的直接描述只有 v0.23 维护分支的 docstring：这是「profiling-based dynamic chunk sizing」。调度器在初始化阶段测量 prefill 延迟，用二次模型拟合，运行时再用这个模型预测 chunk 大小。材料没有说明以下几点，本页不补结论：
- 为什么要替代固定 chunk 大小；
- 预测出的 chunk 在调度中具体怎么用；
- main 开发主线 为什么要求 PP > 1。

v0.23 维护分支 在 `need_timing` 的注释里描述了第二层机制，即在线的 history-aware calibration：
- `need_timing` 为 `True` 时，model runner 每步同步设备、测量执行时间，并把测量值反馈回去做增量重拟合。
- 校准完成后，`need_timing` 会被自动置为 `False`。
- 用户可以一开始就设为 `False`，跳过在线校准，只用启动时的 profiling 模型，这样也避免了每步同步的开销。

main 开发主线的 docstring 没有重述这段机制，只说明用 `None` 哨兵保留了「未设置时跟随 `enabled`」的原语义。所以「在线校准」这一描述在 main 开发主线上是否仍然准确，材料无法确认 [I]。

`max_fit_chunk` 的含义只能从报错文案推断：它是拟合所用的数据点数 [I]。

两版的配置实现也不同：
- main 开发主线把 `ProfilingChunkConfig` 迁移为 `@config`（pydantic dataclass），范围检查移到了 `mode="after"` 的 `model_validator` 中。
- v0.23 维护分支 是普通类，在 `__init__` 里从 dict 读值，数值字段用 `float()` / `int()` 显式转换，再调用 `_validate()`。

v0.23 维护分支 docstring 给出的启用方式如下：

```bash
vllm serve <model> --additional-config '{"profiling_chunk_config": {"enabled": true}}'
```

下面将原注释中的小写 `true` 改为 Python 布尔字面量 `True`；原始摘录保持不变。

```python
llm = LLM(model, additional_config={"profiling_chunk_config": {"enabled": True}})
```

main 开发主线的校验代码经由 `self.scheduler_config.profiling_chunk_config` 访问这组配置。摘录没有给出这个版本在 `additional_config` 里的写法，所以上面的 JSON 路径在 main 开发主线上是否仍是顶层 key，材料无法确认 [I]。

### smooth_factor 怎样影响块大小（main 开发主线）

以下补充对应本页已固定的 main 源码快照。调度器将配置值传给 `ProfilingChunkManager`，再传给 `ChunkSizePredictor`；两条预测路径 `predict`、`predict_with_history` 使用相同的平滑和对齐步骤。

`smooth_factor` 的配置默认值是 **1.0**。虽然 `ProfilingChunkManager` 构造参数的默认值是 0.8，调度器显式传入 `profiling_cfg.smooth_factor`，所以这条实际调用路径默认使用 1.0。

设原始预测为 `x`、基准块大小为 `base`，则：

```text
smoothed = base + smooth_factor * (x - base)
chunk_size = max(int(smoothed), min_chunk)
align = max(page_size, 64)
chunk_size = ceil(chunk_size / align) * align
```

这里的 `base` 来自调度器的 `max_num_scheduled_tokens`，`page_size` 来自 KV cache 的 `block_size`。系数越小，结果越靠近基准；系数为 1 时，平滑值等于原始预测。它在基准与本次预测之间插值，不使用上一次 chunk 作为平滑输入。[D]

例如基准为 8192、原始预测为 3000、系数为 0.5、`min_chunk=4096`、`page_size=128`：平滑值为 `8192 + 0.5 × (3000 - 8192) = 5596`，下限处理后仍为 5596，向上对齐得到 **5632**。[D] 这是公式示例，不是性能实测。

调用链是 `scheduler_profiling_chunk.py` → `ProfilingChunkManager.predict_chunk_size` → `predict` 或 `predict_with_history`。在补料覆盖的第二处调度调用点，预测结果通过 `min(num_new_tokens, predicted_chunk)` 限制本步 token 数；预测返回 `None` 时不作这一步截断。系数变小不代表 chunk 必然变小，也不能据此保证吞吐或延迟改善。

这些运行代码只核对了 main；不能把它们直接套用到 v0.23 维护分支。来源中保留了配置、预测器与调度器的固定源码摘录。

## 开了的代价

- **部署形态受限（main 开发主线）**：必须同时满足 `pipeline_parallel_size > 1`，否则启动报错。v0.23 维护分支 是否有同样的限制，摘录没有覆盖 [!]。
- **与 balance scheduling 互斥（main 开发主线）**：同时打开 `enable_balance_scheduling` 会直接报错，需要关掉其中一个。
- **每步同步开销**：`need_timing` 默认跟随 `enabled`。按 v0.23 维护分支的注释，校准完成前每步都要同步设备来计时。不想承担这部分开销，可以显式写 `"need_timing": false`，只用启动时的 profiling 模型。开销有多大，材料没有数据。
- **启动阶段的额外工作**：docstring 说 profiling 发生在初始化期间，所以启动耗时很可能增加 [I]。材料没有具体数字。
- **`min_chunk` 可能在告警后被调小（main 开发主线）**：`max_num_batched_tokens` 小于 `min_chunk`（默认 4096）时，这一分支只打 warning 并钳位；后续检查仍可能报错。排查 chunk 行为时要看启动日志。
- **`max_fit_chunk` 的文案和阈值不一致**：填 6 能通过校验，但报错文案建议至少 30。调小这个值时不要以为「不报错就等于达到了建议值」[D]。
- **材料缺口**：本页没有依据回答以下问题：
  - 开启后吞吐或延迟有什么收益；
  - 二次模型的具体形式；
  - v0.23 维护分支上是否存在 PP、互斥、钳位这三项全局校验。

## 已废弃的说法

### 2026-09-17 · 修订 0dd1cfc402eaaba8

旧说法（历史记录，已废弃）：

```text
材料没有解释这个系数的语义
```

替代结论：

```text
main 配置默认 1.0，参与下文的线性插值；维护分支的运行公式尚未核对
```

废弃依据（来源是否支持结论仍须人审）：

- `raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339`

旧说法（历史记录，已废弃）：

```text
- `smooth_factor` 的语义；
```

替代结论：

```text
`smooth_factor` 的配置默认值是 **1.0**。
```

废弃依据（来源是否支持结论仍须人审）：

- `raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf11365fda371d6e0ed69185712bcf375f.md#L1-L339`

旧文的来源编号（仅解释上方历史原文）：

1. `raw:sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md#L1-L130`
