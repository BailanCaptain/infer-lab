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

`shared_engram` 让独立的持有进程（Owner，`python -m vllm_ascend.shared_engram`）在主机内存中只加载一次 Engram 大词表，供多个 `vllm serve` 消费者实例共享读取。同机或多实例部署 DeepSeek-V4.1 等超大规模 Engram 模型时，不必每个实例都各自驻留上百 GiB 主机词表，也省去重复冷启动读盘时间。

它是 `main` 分支新增的 `--additional-config` 顶层字典配置（对应 `SharedEngramConfig`，默认 `None` 即关闭）。等待 Owner 输出 `POOL_READY` 后，消费者通过 `--engram-config` 开启主机卸载与本地 DP 共享，并在 `--additional-config` 中填入 `shared_engram` 连接词表池：

```bash
# Atlas A3（MemFabric BM 共享池）消费者示例
vllm serve /models/DeepSeek-V4.1-Flash \
  --tensor-parallel-size 8 \
  --engram-config '{"cpu_offload":true,"dp_shared_memory":true}' \
  --additional-config '{"shared_engram":{"backend":"a3","endpoint":"10.0.0.8:29500"}}'

# Atlas A2 / A5（HIXL RDMA / UB 远程读，需本机 Engram DP×PCP > 1 且 --shutdown-timeout > 0）消费者示例
vllm serve /models/DeepSeek-V4.1-Flash \
  --tensor-parallel-size 4 --data-parallel-size 2 --data-parallel-size-local 2 \
  --shutdown-timeout 120 \
  --engram-config '{"cpu_offload":true,"dp_shared_memory":true}' \
  --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500","capacity":65536}}'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"shared_engram": {...}}'` | 默认 `None`（走各实例本地 Engram 加载），开启时至少必填 `backend` 与 `endpoint` |
| 支持后端 | `"a3"`（MemFabric BM）与 `"a2"` / `"a5"`（HIXL RDMA/UB） | 字面量受 `Literal["a2", "a3", "a5"]` 限制，未知子键直接触发 `extra="forbid"` 报错 |
| 必填模型与并行条件 | `engram_config.cpu_offload=True`，且 `TP ∈ {1,2,4,8}`、`PP = DCP = 1` | 未开主机卸载或违反昇腾 Engram 并行约束时，启动校验阶段直接抛 `ValueError` |
| A3 专属前提 | 须启用 Model Runner V2，禁传非默认 A2/A5 专属子键 | A3 走 MemFabric BM 内存映射，传入自定义 `capacity` 或 `listen_port` 会直接报错 |
| A2 / A5 专属前提 | `dp_shared_memory=true` 且**节点本地** Engram 组 `get_engram_dp_size() > 1`、`--shutdown-timeout > 0`、惰性 safetensors 加载 | 跨节点全局 DP 大于 `1` 不能独自证明本地组达标；`--shutdown-timeout <= 0` 或本地组不达标均抛 `ValueError` |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 六个子键说明与两套后端路径

`SharedEngramConfig` 将原本分散的客户端连接与接收缓冲参数统一折入 `shared_engram` 字典内，不再单独暴露顶层裸键。六个子键的精确类型、默认值与校验边界如下：

| 子键路径 | 类型 | 默认值 | 校验范围与后端归属 |
| --- | --- | --- | --- |
| `shared_engram.backend` | `Literal["a2", "a3", "a5"]` | 必填 | 选择底层共享传输栈：`"a3"` 走 MemFabric BM；`"a2"` 与 `"a5"` 走 HIXL RDMA / UB |
| `shared_engram.endpoint` | `str` | 必填 | Owner 控制面地址，必须符合 `host:port` 且端口满足 `1 <= port <= 65535` |
| `shared_engram.capacity` | `int` | `65536` | 单次查找选中行数的启动期下限，配置范围 `[1, 262144]`；仅 `"a2"` / `"a5"` 允许修改 |
| `shared_engram.library_path` | `str \| None` | `None` | HIXL 原生适配动态库路径覆盖；仅 `"a2"` / `"a5"` 可设，`"a3"` 显式设非空报错 |
| `shared_engram.listen_port` | `int \| None` | `None` | 消费者本地 HIXL 监听端口，范围 `[1, 65535]`，与 `local_comm_res` 严格互斥；仅 `"a2"` / `"a5"` |
| `shared_engram.local_comm_res` | `str \| None` | `None` | 消费者本地通信资源描述符，与 `listen_port` 严格互斥；仅 `"a2"` / `"a5"` |

两套后端在运行时的职责边界截然不同：
- **`backend: "a3"`（直接映射共享页）**：依托 Atlas A3 的 MemFabric BM 共享内存池，Owner 装载主机词表后，消费者一次性完成 `gva_to_va(..., LOCAL_DEVICE)` 地址解析。随后消费者直接读取并反量化词表，无每步暂存拷贝。该路径要求开启 Model Runner V2，且不可开启 `--load-format dummy` 或 `--enable-sleep-mode`。传入任何非默认的 `capacity`、`library_path`、`listen_port` 或 `local_comm_res` 都会报错 `A3 does not accept A2/A5 shared Engram options`。
- **`backend: "a2"` / `"a5"`（HIXL 远端取行）**：依托 HIXL RDMA 或 UB 互联按需拉取本步命中的稀疏行。即使词表驻留 DRAM，Owner 也需占一张 NPU 服务 HIXL 传输（主机大页与锁页内存注册前提见[主机内存与大页](../concepts/host-memory-and-hugepages.md)）。消费者须同时开启 `engram_config.cpu_offload=True`、`dp_shared_memory=True`，且**节点本地** Engram `DP × PCP` 组 `get_engram_dp_size() > 1`。任一不满足即抛 `shared_engram requires Engram cpu_offload and local DP sharing enabled`，跨机全局 DP 大于 `1` 若单机本地组仅为 `1` 仍会失败。此外须保持惰性 safetensors 加载，并显式设 `--shutdown-timeout > 0`（未设环境变量时默认补 `VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS=120`）以在停机时归还读取租约。

## 代价与互斥边界

- **外部 Owner 进程与租约依赖**：消费者不再持有完整词表，Owner 不可达或 HIXL/BM 链路中断会导致启动或推理失败。异常断连时 Owner 为安全起见会保留未确认归还的暂存区，暂不支持消费者崩溃后的自动回收或 Owner 无感主备切换。回退本地模式需移除 `shared_engram` 重启消费者。
- **启动期容量预算、持有端锁页暂存与 `262144` 上限**：在 `"a2"` / `"a5"` 路径下，缓冲区大小在**启动建连时一次性确定**，并非运行期按每步动态扩容。消费者先取 `max_tokens = max(max_num_batched_tokens, max_cudagraph_capture_size)` 乘单层每 TP 分片最大头数得 `required`。随后按 `max(65536, capacity, required)` 算出协商行数，若超过 `MAX_ROWS = 262144` 则启动直接抛 `ValueError`。通过校验后，消费者每卡分配对应行数的常驻 HBM 接收缓冲，Owner 也为每个连接的 reader 分配同容量的主机锁页暂存区（见[主机内存与大页](../concepts/host-memory-and-hugepages.md)）。运行期若单层查找超出协商容量则本地报错且不自动拆分。
- **版本迁移陷阱**：`v0.30.0` 虽已支持本地 Engram 与 `multistream_engram_overlap`，但尚无 `shared_engram`。把 `main` 的共享池脚本搬回标准 `v0.30.0` 环境，会在构造 `AscendConfig` 时因未知字段直接报错。

## 对照源码

下表对照四个固定教学快照中 `shared_engram` 及其六个子键的定义与校验逻辑：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 顶层字段与子类 | 无（`.get()` 忽略）[C5] | 无（`.get()` 忽略）[C6] | 无（标准环境拒收未知键）[C7][!] | `AscendConfig.shared_engram: SharedEngramConfig \| None = None`，含 6 个子键 [C1][C2] |
| 启动期跨配置校验 | — | — | — | 平台层限制 `TP∈{1,2,4,8}` 且 `PP=DCP=1` [C12]；A2/A5 校验 `shutdown_timeout > 0`，A3 校验 MRv2 并禁传 A2/A5 子键 [C2][C3] |
| 模型层挂载与容量计算 | — | — | — | `DeepseekV41Model` 要求 `dp_shared_memory` 与节点本地 Engram 组 `get_engram_dp_size() > 1` [C4][C10]；启动期按 `max_tokens` 与 `capacity_for_batch` 协商容量（`<= 262144`）[C11] |

- **官方文档对照**：`shared_engram.md`（A3 MemFabric BM 部署与回退流程，[S8]）与 `shared_engram_rdma.md`（A2/A5 HIXL RDMA/UB 部署、`--engram-config` 双开关、Reader/Owner 同容量暂存及 `listen_port` / `local_comm_res` 互斥约定，[S9]）与 `SharedEngramConfig` 校验器逐条一致；接收缓冲按启动期协商行数一次性分配 [C4][C11][D]。
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
