---
id: runtime-config-hot-reload-9c9ab794933a
title: runtime_config_hot_reload
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的 Runtime Guard 仅启动期热重载开关（默认 false）：设为 true（或 1）后以固定 3.0 秒周期监听
  runtime_config.json 变更，并在末级 PP 的 TP 组内通过步进总线同步，无需重启即可动态切换日志、指标、检测器与手动 dump。
aliases:
  - additional_config.runtime_config_hot_reload
  - RuntimeConfig 热重载
  - runtime_config 热更新
relations:
  - to: runtime-config-abb228bbf148
    kind: builds-on
    note: 热重载监听的目标文件与六大配置分区 schema 均由 runtime_config 与 runtime_config_path 定义
  - to: collective-communication
    kind: builds-on
    note: 末级 PP 的多卡 TP 组通过后台总线广播热更新结果以保证同波次各卡行为一致，其余进程走本地文件轮询
  - to: ascend-config-system
    kind: builds-on
    note: 仅允许在启动时通过 additional_config 传入 bool 或 0/1，运行期无法从 JSON 内部反向开启
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 同步拓扑与防撕裂机制
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L698
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/__init__.py#L46-L77
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/_defaults.py#L26-L55
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/config.py#L510-L565
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/config.py#L1085-L1205
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_config/dist.py#L100-L145
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L565-L610'
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/runtime_guard.md#L30-L125
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

如果服务启动时未打开配置监听，[Runtime Guard](runtime-config-abb228bbf148.md) 只会在拉起阶段读取一次配置并保持完全静态，运行中途无论怎么修改磁盘上的 `runtime_config.json` 都不会触发日志调级或手动水位线 dump。

`runtime_config_hot_reload` 是 `main` 分支在 `--additional-config` 顶层提供的**仅启动期（Startup-Only）**热重载开关，默认 `false`：

```bash
vllm serve /models/Qwen3-30B-A3B \
  --tensor-parallel-size 4 --enable-expert-parallel \
  --additional-config '{"runtime_config_hot_reload": true}'
```

注意它的输入校验十分严格：`_parse_hot_reload` 只接受布尔值 `true` / `false` 或整数 `0` / `1`；若误把轮询秒数（如 `3` 或 `5`）、浮点数（如 `1.0` / `0.0`）或字符串（如 `"true"`）直接传给它，启动时立即抛 `ValueError`（周期固定为内部常量 `HOT_RELOAD_INTERVAL_SECONDS = 3.0` 秒，不支持用户自定义秒数）。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"runtime_config_hot_reload": true}'` | 仅支持 `bool` 或整数 `0` / `1`，传入 `2`、`1.0`、`"true"` 等其他值直接抛 `ValueError` |
| 默认值与检查周期 | 默认 `false`；开启后固定 `3.0` 秒（`HOT_RELOAD_INTERVAL_SECONDS`） | 默认零后台轮询、零跨卡同步；开启后不能从 JSON 里改周期或二次关闭/重开 |
| 变更识别指纹 | 文件 `mtime` + 内容摘要（Content Digest）双校验 | 同一秒内把 `true` 改成 `false` 或同字节长度改数值也不会漏检 |
| 分布式同步通道 | 末级 PP × 全量 TP 走异步总线广播；其余进程走本地文件轮询 | 保证同一个 TP 组在同一推理波次（Wave）头部同时切换开关，避免多卡状态撕裂 |
| 强依赖本开关的功能 | 在线改 `ascend_log` / `metrics.level`、手动水位线 `dump.manual_dump` | 未开本开关时手动编辑 `runtime_config.json` 完全不生效 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 同步拓扑与防撕裂机制

在多进程、多卡并行的推理实例里，如果让每张 NPU Worker 各自独立按墙钟时间轮询磁盘文件，必然会出现 Rank 0 刚读到新配置开启了集合检测或 dump，而 Rank 1 还在跑旧配置，导致同一个模型步（Wave）内多卡算子与通信序列不一致而卡死。

源码因此按进程角色拆分了两条热更新通道：
1. **API Server / EngineCore 等非 Worker 进程**：启动独立后台守护线程，每隔 `3.0` 秒轮询 `runtime_config.json`（支持手写 JSONC 注释与尾逗号；若单次编辑出现语法错误则打印错误日志并保留上一份合法配置，不会弄崩在线服务）。
2. **NPU Worker 进程（绝不跑后台线程）**：在每轮 `execute_model` 波次头部调用 `sync_runtime_config()`。对于**末级 PP 的 TP 组（`tp_size > 1`）**，由 TP0 在后台总线线程做到期检查与组内广播，尽量与前向计算重叠（若集合通信未能被前向完全掩盖，波次末尾会做限流告警），确保同组所有 TP 卡在同一波次整齐生效；对于非末级 PP、单卡 `tp_size == 1` 或跨节点多 DP 的独立 EngineCore，则退回各自按周期轮询本地文件。

## 代价与互斥边界

- **跨机多 DP 文件分发要求**：当跨多台机器运行多组 DP（每组独立 EngineCore）或非末级 PP 时，不同节点之间没有全局跨 DP 热更新广播组，运维侧需要把更新后的 `runtime_config.json` 同步到各节点对应的 `runtime_config_path`（或挂载同一共享存储路径）。
- **轻量周期开销**：开启 `runtime_config_hot_reload: true` 但保持所有检测器与 dump 关闭时，仅每 `3.0` 秒产生一次轻量级文件 `stat` 或末级 PP 的 TP 总线到期同步；在对极致尾延迟零容忍且无需在线调参的固定基准压测中，保持默认 `false` 即可彻底消除该同步点。
- **单向启动锁死**：如果启动时设为 `false`，运行期即便往 `runtime_config.json` 里塞同名字段也不会唤醒轮询器（反而会因未知 JSON 字段导致该次配置加载被拒）。

## 对照源码

下表对照四个固定教学快照中 `runtime_config_hot_reload` 的字段定义、类型校验与多卡同步实现：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 顶层字段与解析器 | 无 [C7] | 无 [C8] | 无（严格模式拒收）[C9][!] | `AscendConfig.runtime_config_hot_reload: bool = False`；`_parse_hot_reload` 仅认 `bool` 或 `0`/`1` [C1][C2] |
| 周期常量与摘要防漏检 | — | — | — | 固定 `HOT_RELOAD_INTERVAL_SECONDS` + `_content_digest` 识别同秒同长度修改 [C3][C4] |
| 非 Worker 线程与末级 PP 总线 | — | — | — | 非 Worker 跑后台轮询；Worker 在波次头同步，末级 PP × TP 走总线广播防多卡撕裂 [C5][C6][!] |

- **官方文档对照**：`runtime_guard.md` 明确指出热重载为仅启动期配置、在检测器与 dump 全关时由末级 PP 的 TP0 在 bus worker 上重叠到期广播并在未掩盖时限流告警 [S10]；跨机多 DP 需同步各节点文件由 `dist.py` 无跨 DP 广播组分支直接得出 [C6][D]。
- **待核**：尚缺大规模 TP8/PP2 下总线广播被前向掩盖比例与限流告警触发频率的实机统计。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["runtime_config_hot_reload"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:698` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.runtime_config_hot_reload` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
