---
id: shared-engram-31bf0d820403
title: shared_engram
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的跨实例共享主机 Engram 词表池配置（SharedEngramConfig），支持 Atlas A3（MemFabric BM
  共享主机内存）与 Atlas A2 / A5（HIXL RDMA / UB 按需拉取选中行）两类后端，折入
  backend、endpoint、capacity 等六个子键。
aliases:
  - SharedEngramConfig
  - additional_config.shared_engram
  - shared_engram.backend
  - shared_engram.endpoint
  - shared_engram.capacity
  - shared_engram.library_path
  - shared_engram.listen_port
  - shared_engram.local_comm_res
  - 共享 Engram 配置
relations:
  - to: engram-conditional-memory
    kind: builds-on
    note: 单实例 Engram 主机内存卸载与门控前向原理见那一页，本页聚焦多实例共享词表池客户端配置
  - to: model-runner-v2
    kind: builds-on
    note: backend="a3" 强制要求开启 Model Runner V2，否则在 AscendConfig 校验阶段直接报错
  - to: ascend-config-system
    kind: builds-on
    note: 对应 SharedEngramConfig 子配置类并开启 extra="forbid"，六个子键按后端分支做严格组合校验
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 六个子键说明与两套后端路径
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L656
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L457-L491'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L797-L809'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/model.py#L1056-L1095'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L565-L585'
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram.md#L34-L96
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram_rdma.md#L40-L72
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/parallel.py#L26-L28'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/shared_rdma.py#L41-L49'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L2092-L2102'
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

当同一台或多台机器上拉起多个 DeepSeek-V4.1 等超大规模 Engram 推理实例（例如多组 P/D 分离消费者或灰度副本）时，如果每个实例都各自把上百 GiB 的主机侧 Engram 词表驻留一份，主机 DRAM 和冷启动读盘时间都会成倍膨胀。

`shared_engram` 是 `main` 分支新增的 `--additional-config` 顶层字典配置（对应 `SharedEngramConfig`，默认 `None` 即关闭）。独立拉起常驻词表持有进程 `python -m vllm_ascend.shared_engram` 后，各 `vllm serve` 消费者实例通过 `shared_engram` 连接到该词表池，共享同一份主机侧 Engram 权重：

```bash
# Atlas A3（MemFabric BM 共享池）消费者示例
vllm serve /models/DeepSeek-V4.1-Flash \
  --tensor-parallel-size 8 \
  --additional-config '{"shared_engram":{"backend":"a3","endpoint":"10.0.0.8:29500"}}'

# Atlas A2 / A5（HIXL RDMA / UB 远程读，需满足 DP * PCP > 1 与 --shutdown-timeout > 0）消费者示例
vllm serve /models/DeepSeek-V4.1-Flash \
  --tensor-parallel-size 4 --data-parallel-size 2 \
  --shutdown-timeout 120 \
  --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500","capacity":65536}}'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"shared_engram": {...}}'` | 默认 `None`（走各实例本地 Engram 加载），开启时至少必填 `backend` 与 `endpoint` |
| 支持后端 | `"a3"`（MemFabric BM）与 `"a2"` / `"a5"`（HIXL RDMA/UB） | 字面量受 `Literal["a2", "a3", "a5"]` 限制，未知子键直接触发 `extra="forbid"` 报错 |
| 必填模型与并行条件 | `engram_config.cpu_offload=True`，且 `TP ∈ {1,2,4,8}`、`PP = DCP = 1` | 未开主机卸载或违反昇腾 Engram 并行约束时，启动校验阶段直接抛 `ValueError` |
| A3 专属前提 | 须启用 Model Runner V2，禁传非默认 A2/A5 专属子键 | A3 走 MemFabric BM 内存映射，传入自定义 `capacity` 或 `listen_port` 会直接报错 |
| A2 / A5 专属前提 | `--shutdown-timeout > 0`、`DP × PCP > 1`（激活本地 DP 共享）与惰性 safetensors 加载 | `vllm serve` 默认 `--shutdown-timeout 0` 或 `DP=PCP=1` 均会直接抛 `ValueError`；`listen_port` 与 `local_comm_res` 互斥 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 六个子键说明与两套后端路径

`SharedEngramConfig` 将原本分散的客户端连接与接收缓冲参数统一折入 `shared_engram` 字典内，不再单独暴露顶层裸键。六个子键的精确类型、默认值与校验边界如下：

| 子键路径 | 类型 | 默认值 | 校验范围与后端归属 |
| --- | --- | --- | --- |
| `shared_engram.backend` | `Literal["a2", "a3", "a5"]` | 必填 | 选择底层共享传输栈：`"a3"` 走 MemFabric BM；`"a2"` 与 `"a5"` 走 HIXL RDMA / UB |
| `shared_engram.endpoint` | `str` | 必填 | Owner 控制面地址，必须符合 `host:port` 且端口满足 `1 <= port <= 65535` |
| `shared_engram.capacity` | `int` | `65536` | 每卡单层接收缓冲预分配行数下限提示，配置范围 `[1, 262144]`；运行期按 `max(65536, capacity, required)` 自动取大，仅 `"a2"` / `"a5"` 允许修改 |
| `shared_engram.library_path` | `str \| None` | `None` | HIXL 原生适配动态库路径覆盖；仅 `"a2"` / `"a5"` 可设，`"a3"` 显式设非空报错 |
| `shared_engram.listen_port` | `int \| None` | `None` | 消费者本地 HIXL 监听端口，范围 `[1, 65535]`，与 `local_comm_res` 严格互斥；仅 `"a2"` / `"a5"` |
| `shared_engram.local_comm_res` | `str \| None` | `None` | 消费者本地通信资源描述符，与 `listen_port` 严格互斥；仅 `"a2"` / `"a5"` |

两套后端在运行时的职责边界截然不同：
- **`backend: "a3"`**：依托 Atlas A3 的 MemFabric BM 共享内存池，Owner 统一装载并映射词表页，消费者需运行在 Model Runner V2 下，且不可开启 `--load-format dummy` 或 `--enable-sleep-mode`。因为不走每步 RDMA 行拷缓冲，`_validate_backend_options` 会拦截任何非默认的 `capacity`、`library_path`、`listen_port` 或 `local_comm_res`（报错 `A3 does not accept A2/A5 shared Engram options`）。
- **`backend: "a2"` / `"a5"`**：依托 HIXL RDMA 或 UB 互联按需读取本步命中的稀疏行，消费者每卡按 `capacity_for_batch`（`max(65536, capacity, max_tokens * (heads // tp_size))`）分配单层接收缓冲。它要求拓扑满足 `DP × PCP > 1` 以使 `resolve_dp_shared_memory` 解析为真（否则报 `shared_engram requires Engram cpu_offload and local DP sharing enabled`），并使用默认惰性 safetensors 加载（拒绝 `dummy` 或非 `lazy` 策略），同时强制要求显式传入 `--shutdown-timeout > 0`（未设环境变量时默认注入 `VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS=120`），确保进程停机时优雅归还远端读取租约。

## 代价与互斥边界

- **外部 Owner 进程强依赖**：消费者不再本地独立持有完整词表，一旦 `vllm_ascend.shared_engram` Owner 不可达或网卡/UB 链路中断，实例启动与推理会失败；回退本地模式需去掉 `shared_engram` 重启消费者。
- **`capacity` 缓冲下限与 `262144` 硬上限权衡**：在 `"a2"` / `"a5"` 路径下，`capacity` 并非截断单步 token 数的上限开关——`capacity_for_batch` 会按本步最大可能需求行数 `required = max_tokens * (heads // tp_size)` 取 `max(65536, capacity, required)` 自动扩容，只有当计算出的行数突破协议硬上限 `MAX_ROWS = 262144` 时才会在初始化阶段直接抛 `ValueError`；显式调大 `capacity` 会提前按行宽线性增加每卡常驻接收缓冲占用。
- **版本迁移陷阱**：`v0.30.0` 虽已支持本地 Engram 与 `multistream_engram_overlap`，但尚无 `shared_engram`；把 `main` 的共享池脚本原样搬回标准 `v0.30.0` 环境会在构造 `AscendConfig` 时因未知字段直接报错。

## 对照源码

下表对照四个固定教学快照中 `shared_engram` 及其六个子键的定义与校验逻辑：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 顶层字段与子类 | 无（`.get()` 忽略）[C5] | 无（`.get()` 忽略）[C6] | 无（标准环境拒收未知键）[C7][!] | `AscendConfig.shared_engram: SharedEngramConfig \| None = None`，含 6 个子键 [C1][C2] |
| 启动期跨配置校验 | — | — | — | 平台层限制 `TP∈{1,2,4,8}` 且 `PP=DCP=1` [C12]；A2/A5 校验 `shutdown_timeout > 0`，A3 校验 MRv2 并禁传 A2/A5 子键 [C2][C3] |
| 模型层挂载与容量计算 | — | — | — | `DeepseekV41Model` 要求 `DP×PCP > 1` 激活本地 DP 共享 [C4][C10]；`capacity_for_batch` 取 `max(65536, configured, required) <= 262144` [C11] |

- **官方文档对照**：`shared_engram.md`（A3 MemFabric BM 部署与回退流程，[S8]）与 `shared_engram_rdma.md`（A2/A5 HIXL RDMA/UB 部署及 `listen_port` / `local_comm_res` 互斥约定，[S9]）与 `SharedEngramConfig` 校验器逐条一致；接收缓冲随实际分配行数线性增长由每卡接收槽位结构推导 [C11][D]。
- **待核**：尚无多实例并发挂载下 A3 MemFabric BM 与 A5 HIXL UB 的跨机读延迟与带宽利用率实测对比。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["shared_engram"]` |
| 所属类 | `AscendConfig` |
| 类型 | `SharedEngramConfig \| None` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:656` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.shared_engram is not None and self.shared_engram.backend in ('a2', 'a5'):
    if getattr(vc, 'shutdown_timeout', 0) <= 0:
        raise ValueError('shared_engram requires --shutdown-timeout > 0 to retire reader leases')
    os.environ.setdefault('VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS', '120')
````

````python
if self.shared_engram is not None and self.shared_engram.backend == 'a3':
    if not vc.use_v2_model_runner:
        raise ValueError('shared_engram requires Model Runner V2')
    if not engram_config or not engram_config.cpu_offload:
        raise ValueError('shared_engram requires Engram cpu_offload')
    if vc.load_config.load_format == 'dummy' or vc.model_config.enable_sleep_mode:
        raise ValueError('Shared host Engram does not support dummy loading or sleep mode')
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.shared_engram` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
