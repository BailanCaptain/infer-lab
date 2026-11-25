---
id: runtime-config-abb228bbf148
title: runtime_config
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的 Runtime Guard
  在线控制面启动覆盖字典（additional_config.runtime_config），在进程启动时叠加到默认配置并覆写
  runtime_config.json，统一管理异常检测器、水位线 dump、动态日志级别、指标粒度与事故报告；配套路径键
  runtime_config_path 一并折入本页。
aliases:
  - RuntimeConfig
  - Runtime Guard 配置
  - additional_config.runtime_config
  - runtime_config_path
  - additional_config.runtime_config_path
  - runtime_config.json
relations:
  - to: msprobe-accuracy-debug
    kind: builds-on
    note: 在线异常检测与手动水位线 KV/张量 dump 用于线上定位偶发精度或数值异常，离线算子比对见那一页
  - to: ascend-config-system
    kind: builds-on
    note: >-
      由 init_ascend_config 在构造 AscendConfig 前从 additional_config 剥离并解析为
      RuntimeConfig 实例
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 关联路径键与六大配置分区
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L700
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L697-L701'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1960-L1970'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2035-L2040'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/__init__.py#L35-L108
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/config.py#L471-L565
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L565-L610'
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/configuration/runtime_config.md#L1-L46
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/runtime_guard.md#L11-L58
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

线上服务偶发乱码、NaN、长尾毛刺或需要临时打开 `DEBUG` 日志时，传统做法必须改参数重启整组 `vllm serve` 实例，既中断流量又破坏故障现场。`main` 分支引入 **Runtime Guard** 在线控制面，用一份落盘的 `runtime_config.json` 统一管控异常检测器、按波次水位线触发的原生 dump、动态日志级别与服务指标粒度。

`runtime_config` 是 `--additional-config` 顶层的启动覆盖字典（Startup Overlay，默认 `None`），用于在服务拉起时把指定的检测器、日志或报告开关合并进内置默认值，并由每个 `EngineCore` 的 Leader Worker 写入磁盘上的 `runtime_config.json`：

```bash
vllm serve /models/Qwen3-30B-A3B \
  --tensor-parallel-size 4 --enable-expert-parallel \
  --additional-config '{
    "runtime_config_path": "/data/runtime/config/runtime_config.json",
    "runtime_config_hot_reload": true,
    "runtime_config": {
      "ascend_log": {"modules": {"vllm": "INFO"}},
      "metrics": {"level": "basic"}
    }
  }'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"runtime_config": {...}}'` | 传入非 `dict`（如列表、字符串或布尔值）在启动期直接抛 `ValueError` |
| 关联路径键 | `runtime_config_path: str \| None = None`（已折入本页） | 省略时默认落盘到 `<cwd>/runtime/config/runtime_config.json` |
| 启动覆写语义 | `内置默认 <- runtime_config 覆盖层`，并**覆写**已有 JSON 文件 | 启动前手工改过磁盘 JSON 但未写进 `runtime_config` 的内容会在拉起时被刷掉 |
| 运行时对象类型 | `AscendConfig.runtime_config` 存放解析后的 `RuntimeConfig` 实例 | 原始字典在 `init_ascend_config` 阶段剥离解析，全部功能默认关闭、零热路径开销 |
| 在线修改前提 | 须同时设 `runtime_config_hot_reload: true` | 默认 `false` 下仅启动时合并一次，运行期改磁盘 JSON 不会生效 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 关联路径键与六大配置分区

`build_runtime_config_from_additional` 会在构造 `AscendConfig` 前一并提取启动期路径种子与覆盖层字典，相关顶层附加键统一在本页说明：

| 附加配置键 / JSON 分区 | 类型与默认值 | 职责与关键约束 |
| --- | --- | --- |
| `runtime_config_path` | `str \| None = None` | 指定 `runtime_config.json` 路径（须为字符串，越出当前工作目录时打印安全提示日志）；省略时取 `<cwd>/runtime/config/runtime_config.json` |
| `runtime_report_dir` / `runtime_dump_dir` | `str \| None = None` | 可选覆盖事故报告目录（默认 `<runtime_root>/report`）与初始 `dump.dump_dir` 种子路径 |
| `runtime_config.detector` | `dict`（各检测器默认关闭） | 注册在 `detector_catalog` 中的在线数值/健康检测器开关、采样窗口与阈值 |
| `runtime_config.dump` | `dict`（默认关闭） | 控制自动异常转储配额/冷却及手动水位线 `manual_dump`（配合热重载按整数递增 `1 -> 2 -> 3` 单次抓取） |
| `runtime_config.actions` / `report` | `dict` | 控制检测到异常后的响应动作与结构化事故报告落盘开关 |
| `runtime_config.ascend_log` / `metrics` | `dict` | 动态调整模块日志级别（如 `vllm` logger）及 `ms_service_metric` 指标粒度（`"basic"` / `"detail"` 或 `0` / `1`） |

## 代价与互斥边界

- **启动覆写（Startup Overwrite）是最容易踩的坑**：Worker 启动持久化时会用「代码默认值 + `additional_config.runtime_config`」整份覆写磁盘上的 `runtime_config.json`。如果想做手动一次性水位线抓取（`dump.manual_dump`），正确顺序是先带 `runtime_config_hot_reload: true` 启动服务，等服务就绪后再编辑运行中的 `runtime_config.json` 把 `manual_dump` 逐次加 1，切勿在启动前直接把大整数写死在旧文件里。
- **不要混用内存 HTTP 端点与 JSON 文件调指标级别**：通过在线管理端点修改 `metrics.level` 仅改进程内存、不回写 `runtime_config.json`；一旦后续编辑了 `runtime_config.json` 的任意其他字段触发整文件重载，`metrics.level` 会被文件里的旧值静默覆盖。同一个部署实例应只选一种通道。
- **热重载开关不能写进 `runtime_config` 字典内部**：`runtime_config_hot_reload` 是仅启动期顶层键，不是 `runtime_config.json` 的合法 schema 字段；写进 `runtime_config` 覆盖字典内会被 `validate_runtime_config` 拒绝并回退默认配置。

## 对照源码

下表对照四个固定教学快照中 `runtime_config` 与 `runtime_config_path` 的定义及引导链路：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 顶层字段定义 | 无 [C7] | 无 [C8] | 无（严格模式拒收）[C9][!] | `AscendConfig` 定义 `runtime_config_path`（`#L697`）与 `runtime_config`（`#L700`）[C1][C2] |
| 启动剥离与解析 | — | — | — | `init_ascend_config` 调 `build_runtime_config_from_additional` 剥离路径与覆盖层并校验类型 [C3][C4][C5] |
| 默认路径与持久化覆写 | — | — | — | 默认 `<cwd>/runtime/config/runtime_config.json`；Leader Worker 启动落盘覆写已有文件 [C6][!] |

- **官方文档对照**：`runtime_config.md`（JSON schema、启动覆写契约与水位线 dump 规程，[S10]）及 `runtime_guard.md`（默认零开销与运维用法，[S11]）与 `RuntimeConfig._bootstrap` 实现完全一致。
- **待核**：本工作区未挂载 NPU 实机，尚无开启各在线检测器与连续 dump 时的单步延迟增量实测。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["runtime_config"]` |
| 所属类 | `AscendConfig` |
| 类型 | `Any` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:700` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

Runtime object constructed in init_ascend_config (not from additional_config dict).

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.runtime_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
