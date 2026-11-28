---
id: enable-cpu-binding-f0fbd89fe35b
title: enable_cpu_binding
type: param
summary: >-
  控制 NPU Worker 启动时是否执行基于拓扑感知或全局切片的 NUMA 亲和 CPU 绑核（默认 True）；开启 Engram
  主机内存卸载时自动跳过跨节点内存迁移。
aliases:
  - Ascend CPU 绑核
  - 昇腾原生绑核开关
relations:
  - to: cpu-binding
    kind: builds-on
    note: 对应底层 CPU 核池切分、NUMA 亲和与全局切片绑定实现
  - to: engram-conditional-memory
    kind: builds-on
    note: 开启 Engram cpu_offload (HOST_UVA) 时自动禁用 NUMA 内存迁移
  - to: ascend-config-system
    kind: builds-on
    note: AscendConfig 用户开关及平台屏蔽 --numa-bind 的配置入口
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
origin: seed
evidence: C
updated: '2026-11-28'
sources:
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L565
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/worker/worker.py#L963-L971
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/cpu_binding.py#L375-L558
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/cpu_binding.py#L784-L802
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/platform.py#L894-L918
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/device/hardware_profile.py#L281-L353
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L655
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L162
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L174
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，和上游 --numa-bind 有什么区别？

`enable_cpu_binding` 控制是否在昇腾 ARM 宿主机的每个 NPU Worker 初始化时启用原生 CPU 绑核与 NUMA 亲和分配；它默认为 `True`，并会自动屏蔽上游 vLLM 自带的 `--numa-bind` 机制。

## 为什么存在

在多卡多路 ARM 服务器上，如果调度线程和主机预处理线程在不同 NUMA 节点之间漂移，跨 Socket 访问内存与 PCIe 队列的延迟会直接拉长每一步的 Dispatch 开销（机制细节见 [CPU 绑核](../concepts/cpu-binding.md)）。

`vllm-ascend` 的绑核模块不只调用 `taskset`，还会按硬件拓扑、进程可见卡号和通信线程角色精细切分核心：

- **自动屏蔽上游 `--numa-bind`**：昇腾平台默认启用原生绑核后，`platform.py` 会把上游 `parallel_config.numa_bind_cpus` 清空为 `None`，避免两套策略互相覆盖。
- **拓扑不可用时的全局切片回退**：当容器隔离或驱动输出缺失导致 `npu-smi` 找不到 NUMA 亲和信息时，自动回退到基于 `ASCEND_RT_VISIBLE_DEVICES` 与全局逻辑 NPU ID 的均匀切片（`global-slice`），防止多个独立容器/DP 进程绑到同一批 CPU 核上打架。
- **与 Engram CPU Offload 协同**：Worker 传参给 `bind_cpus()` 时会显式检查 `engram_config.cpu_offload`；一旦启用基于固定页的 `HOST_UVA` 主机内存卸载，就令 `migrate_memory=False`，避免在启动阶段错误迁移已锁定的跨节点共享内存。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 默认值 | `True` | 无需额外配置即自动触发，平台检查亦通过 `setdefault` 补 `True` |
| 架构前置条件 | `is_arm_cpu()` | 非 ARM 架构（如 x86_64 宿主）打印日志后直接跳过，不报错 |
| A2 策略 | `CPUBindingMode.TOPO_AFFINITY` | 解析 `npu-smi` 拓扑亲和；解析失败则降级为 `global-slice` |
| A3 策略 | `CPUBindingMode.GLOBAL_SLICE` | 按全局逻辑 NPU ID 切分可用核池，适配双 Die 形态 |
| A5（950）策略 | `CLUSTER_CPU_TOPOLOGY` | 按集群拓扑划分核池（`build_ascend_950_cpu_pools`）与专有角色线程 |
| 多容器/多 DP 处理 | `ASCEND_RT_VISIBLE_DEVICES` | 按全局 NPU 编号偏移切片，多 DP 独立进程不会挤在同一组 core 上 |
| Engram Offload 联动 | `migrate_memory=False` | 保留线程绑核，但跳过 NUMA 内存页迁移，保护 `HOST_UVA` pinned 内存 |
| 失败行为 | 捕获异常并警告 | `worker.py` 抓异常打印 warning 后继续启动，不中断推理服务 |

## 开了的代价与常见坑

1. **受限容器核数极少时可能触发警告或性能抖动**：若容器仅分配极少量 CPU 核（少于每张 NPU 最小核阈值）或未挂载完整 `/sys`/`npu-smi` 权限，绑核可能回退或抛出告警跳过；多租户混部且由外部调度器（如 Kubernetes CPU Manager）统一绑核时，可显式设为 `false` 避免双重限制。
2. **A3 `global-slice` 依赖环境变量一致性**：`build_global_slice_cpu_pool` 会同时对照进程 `ASCEND_RT_VISIBLE_DEVICES` 与物理/逻辑卡总数分配核心区间；如果手动篡改可见卡顺序或 cgroup `cpuset.cpus` 与宿主总核数不一致，需在启动日志里核对 `[cpu_global_slice]` 打印的绑定范围。
3. **非 `AscendConfig` 定义前的早期版本差异**：在 `v0.23.0` 仅通过 `local_rank` 调用 `bind_cpus(self.local_rank)`；自 `v0.26.0rc` 起改为同时传入解析后的物理设备 `npu_id`，再到 `v0.30.0` 新增 Engram `migrate_memory` 开关，容器内有卡号映射时更准确。

## 何时改用其他组合

- **标准昇腾 ARM 单机或多机推理**：保持默认 `enable_cpu_binding: true`，不要再额外传 `--numa-bind`。
- **Kubernetes 严格独占 CPU 绑核或排障对比基准**：设为 `{"enable_cpu_binding": false}` 对比延迟，排查是否因核池切分过窄拖慢了 Python 预处理或异步调度。

想确认 `enable_cpu_binding` 与 `OMP_NUM_THREADS` 等线程类环境变量叠加后有没有冲突，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=enable-cpu-binding-f0fbd89fe35b&q=enable_cpu_binding&sel=%7B%22cfg_enable_cpu_binding%22%3Atrue%7D)。链接预装 `enable_cpu_binding: true`。

## 对照源码

| 版本 | 字段与类型 | 平台与 Worker 调用入口 | 绑核策略与关键演进 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `additional_config.get(..., True)` | `platform.py:1225`、`worker.py:779` | `bind_cpus(self.local_rank)`，仅传 local rank [!] |
| `releases/v0.26.0rc` (`2ed6cbba`) | `additional_config.get(..., True)` | `platform.py:1225`、`worker.py:827` | 传入 `rank_id` 与物理 `npu_id`；`A3`、`950` 与 `global-slice` 池切分成形 [!] |
| `releases/v0.30.0` (`c09d3e20`) | `AscendConfig.enable_cpu_binding: bool = True` | `platform.py:894`、`worker.py:963` | 转入类型化 `AscendConfig`；Engram `cpu_offload` 联动设置 `migrate_memory=False` [!] |
| `main` (`8d6180e2`) | `AscendConfig.enable_cpu_binding: bool = True` | `worker.py:1094`、`cpu_binding.py:797` | 与 `v0.30.0` 逻辑一致，`worker.py` 行号随前置逻辑后移 |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L565` [C1] 与 `8d6180e2:vllm_ascend/ascend_config.py#L655` [C7]：`AscendConfig` 字段定义。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/worker/worker.py#L963-L971` [C2] 与 `platform.py#L894-L918` [C5]：Worker 绑核调用（含 `engram_config.cpu_offload` 判断）与 `--numa-bind` 屏蔽。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/cpu_binding.py#L375-L558` [C3]、`#L784-L802` [C4] 与 `hardware_profile.py#L281-L353` [C6]：A2 `TOPO_AFFINITY`、A3 `GLOBAL_SLICE`、A5 集群绑核、`is_arm_cpu()` 与 `migrate_memory` 控制流。
- `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L162` [C8] 与 `2ed6cbba:vllm_ascend/ascend_config.py#L174` [C9]：旧版字典读取入口。
- **待核**：本机暂未在多容器隔离或 Engram `HOST_UVA` 场景下实测开关前后 TTFT/TPOT 差值。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_cpu_binding"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:565` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

---- user-input switches: bool/int/list/str, auto type validation ----

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_cpu_binding` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
