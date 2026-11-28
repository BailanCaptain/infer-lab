---
id: enable-static-kernel-0a7b93dc8b97
title: enable_static_kernel
type: param
summary: >-
  控制是否在图捕获编译期针对固定批大小预编译 Static Kernel 算子二进制（默认 False）；依赖 enable_npugraph_ex=True
  且在 PIECEWISE / FULL_AND_PIECEWISE / NONE 模式下会被静默清零，同时默认级联启用
  enable_super_kernel。
aliases:
  - 静态核编译
  - AscendCompilationConfig.enable_static_kernel
relations:
  - to: enable-npugraph-ex-ffc890dd7afe
    kind: builds-on
    note: 强依赖 enable_npugraph_ex=True；未开启则断言失败
  - to: enable-super-kernel-ce990e186bfa
    kind: builds-on
    note: 是 enable_super_kernel 的前置条件，且缺省时会自动同步开启超核
  - to: acl-graph
    kind: builds-on
    note: 仅在 FULL / FULL_DECODE_ONLY 捕获解码档位时生效，PIECEWISE 下静默关闭
  - to: graph-mode-layer
    kind: builds-on
    note: 静态算子二进制预编译与模型运行图模式层级配合
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
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L123
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L133-L169
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L72-L176
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L266-L289
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/platform.py#L1306-L1352
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/worker/worker.py#L197-L236
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:docs/source/user_guide/feature_guide/graph_mode.md#L180-L243
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L130
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/compilation/compiler_interface.py#L73-L135
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L610-L660
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L602-L662
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，和超核优化如何联动？

`enable_static_kernel` 控制是否在 ACLGraph 捕获编译阶段为解码批大小预编译专用静态算子二进制（Static Kernel）；它默认 `False`，在 `v0.30.0` 开启后若未显式覆写，会自动串联打开 [enable_super_kernel](enable-super-kernel-ce990e186bfa.md)。

## 为什么存在

通用 `aclnn` 动态形状算子为了兼容任意输入维数，核内与运行时分支多、Tiling 计算开销不小。在 Decode 场景中，`ACLGraph` 本身就已经把请求固定在少数几个捕获批大小（`cudagraph_capture_sizes`）上。

开启 `enable_static_kernel=True` 后，编译器（经由 `npugraph_ex` 或 `torchair`）会针对解码阶段所需的捕获批大小，预先编译出专用定形算子二进制（`static_kernel_compile=True`），进一步压缩算子准备与执行耗时：

- **只覆盖 Decode 捕获档位**：通过 `_compute_decode_cudagraph_batch_sizes` 提取 `[uniform_decode_query_len, max_num_seqs * uniform_decode_query_len]` 范围内的捕获档位传入编译范围（`_vllm_aclnn_static_kernel_sym_range`）。
- **与超核默认连携**：自 `v0.26.0rc`/`v0.30.0` 起，只要显式启用 `enable_static_kernel=True` 而省略 `enable_super_kernel`，验证器就自动将 `enable_super_kernel` 同步置为 `True`。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 默认值 | `False` | 需要显式传入 `true`，避免每次服务启动都耗费数分钟至数十分钟编核 |
| 硬前置条件 | `enable_npugraph_ex == True` | `enable_npugraph_ex=False` 时启动直接触发 `AssertionError` |
| 默认继承行为 | 带动 `enable_super_kernel=True` | 想只用静态核而不开超核，须显式传 `"enable_super_kernel": false` |
| `PIECEWISE` 静默陷阱 | 自动置回 `False` | 图模式为 `PIECEWISE`、`FULL_AND_PIECEWISE` 或 `NONE` 时，启动会被 `platform.py` 清零 |
| 拓扑环境变量 | 自动计算 `LOCAL_WORLD_SIZE` | 若未手动设置，取 `local_world_size * data_parallel_size_local`（外部 DP 则按 `world / nodes` 计算） |
| 外部 DP 约束 | 全量世界且可被节点数整除 | `data_parallel_external_lb` 不满足时直接在 `_initialize_static_kernel_runtime` 抛 `RuntimeError` |
| 不兼容算子黑名单 | 自动跳过静态编译 | `v0.30.0` 跳过 `TopKV2`、`QuantBatchMatmulV3` 等 5 个算子；`main` 增至 6 个（含 `PoolKeyIndexer`） |
| 退出清理钩子 | `$ASCEND_HOME_PATH/opp/static_kernel/ai_core/uninstall.sh` | Worker 捕获 `SIGTERM`/`SIGINT` 时带文件锁执行卸载清理 |

## 开了的代价与常见坑

1. **在 `PIECEWISE` / `FULL_AND_PIECEWISE` 图模式下被静默置零**：这是最常见的“配置写了却零加速”陷阱。`platform.py` 在准备编译后端时，只要检测到图模式不是全图（`NONE` 或需要分段），就会把 `enable_npugraph_ex`、`enable_static_kernel` 与 `enable_super_kernel` 全部设为 `False`。实际是否编译了静态核，要看启动日志是否出现 `Starting static kernel compilation`，或采集 PyTorch Profiler 在 `op_statistic.csv` 中检索 `static_kernel`。
2. **首次冷启动耗时从分钟级到数十分钟**：服务启动阶段在图捕获期执行 C++/算子编译，算子种类和模型层数越多，耗时越久；并且 `enable_super_kernel` 的开关值直接进入编译器 `compute_hash()` 哈希因子，切换超核会导致整个静态核缓存重建。
3. **拓扑与信号退出前提**：在 Atlas A3 双 Die 或多实例部署、`data_parallel_external_lb` 外部 DP 均衡场景下，需保证实际进程数等于全局 DP 世界大小且能被节点数整除（或手动正确设置 `LOCAL_WORLD_SIZE`），否则运行期报错。此外不要用 `SIGKILL (-9)` 强杀进程，以免跳过 `uninstall_static_kernel` 残留旧算子包。

## 何时改用其他组合

- **追求极低 Decode 尾延迟的长期常驻生产实例**：配置 `cudagraph_mode: "FULL_DECODE_ONLY"` + `enable_npugraph_ex: true` + `enable_static_kernel: true`；若需保守稳定，加 `"enable_super_kernel": false`。
- **快速开发迭代、频繁改模型参数、短时测试或 `PIECEWISE` / `310P` 部署**：保持默认 `enable_static_kernel: false`。

想确认打开 `enable_static_kernel` 后 `enable_super_kernel` 是否随之开启、与图模式和 `enable_npugraph_ex` 是否冲突，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=enable-static-kernel-0a7b93dc8b97&q=ascend_compilation_config.enable_static_kernel&sel=%7B%22cfg_enable_static_kernel%22%3Atrue%7D)。链接预装 `enable_static_kernel: true`。

## 对照源码

| 版本 | 类定义与继承 | 黑名单与批大小计算 | 平台与退出处理 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `AscendCompilationConfig.__init__`（`:610`） | 基于 `cudagraph_capture_sizes` 与黑名单列表 | `platform.py:596-643` 分段置 `False`；`worker.py:167` 注册 `uninstall_static_kernel` [!] |
| `releases/v0.26.0rc` (`2ed6cbba`) | 默认继承 `enable_super_kernel`（`:635`） | 同上 | `platform.py:552-604` 同步关闭三个图编译项 |
| `releases/v0.30.0` (`c09d3e20`) | `@config` + model_validator 继承（`:123-169`） | 5 类不兼容算子黑名单；支持外部 DP 推导 `LOCAL_WORLD_SIZE` | 仅 `has_full_cudagraphs()` 清空 `splitting_ops` 保留静态核 [!] |
| `main` (`8d6180e2`) | `@config`（`ascend_config.py:130`） | V2 Runner 投机圆整批大小（`round_up`）；黑名单增至 6 个（`PoolKeyIndexer`） | 其余逻辑与 `v0.30.0` 一致 |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L123` [C1]、`#L133-L169` [C2] 与 `8d6180e2:ascend_config.py#L130` [C8]：默认 `False`、与 `enable_super_kernel` 继承、与 `enable_npugraph_ex` 强断言。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L72-L176` [C3]、`#L266-L289` [C4] 与 `8d6180e2:compiler_interface.py#L73-L135` [C9]：解码批大小、外部 DP 推导 `LOCAL_WORLD_SIZE`、不兼容黑名单与缓存哈希。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/platform.py#L1306-L1352` [C5] 与 `worker/worker.py#L197-L236` [C6]：`PIECEWISE`/`NONE` 静默覆盖与退出信号卸载脚本。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:docs/source/user_guide/feature_guide/graph_mode.md#L180-L243` [S7]：官方使用示例、冷启动耗时提示及 Profiler 验证方法。
- `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L610-L660` [C10] 与 `2ed6cbba:ascend_config.py#L602-L662` [C11]：早期配置形态演进。
- **待核**：本机 `910B3` 尚未完成开启 `enable_static_kernel` 前后的端到端编译耗时与 TPOT 实测采集。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_static_kernel"]` |
| 所属类 | `AscendCompilationConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:123` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if isinstance(data, ArgsKwargs):
    if data.kwargs is None:
        return data
    kw = dict(data.kwargs)
    if 'enable_super_kernel' not in kw and 'enable_static_kernel' in kw:
        kw['enable_super_kernel'] = kw['enable_static_kernel']
    return ArgsKwargs(data.args, kw)
````

````python
if isinstance(data, dict):
    if 'enable_super_kernel' not in data and 'enable_static_kernel' in data:
        data = dict(data)
        data['enable_super_kernel'] = data['enable_static_kernel']
````

````python
if not get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX):
    if self.enable_npugraph_ex:
        logger.warning('npugraph_ex is not supported by the current hardware profile. Disabling it.')
    if self.enable_static_kernel:
        logger.warning('static kernel requires npugraph_ex, which is not supported by the current hardware profile. Disabling it.')
    if self.enable_super_kernel:
        logger.warning('super kernel requires static kernel, which is not supported by the current hardware profile. Disabling it.')
    self.enable_npugraph_ex = False
    self.enable_static_kernel = False
    self.enable_super_kernel = False
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendCompilationConfig.enable_static_kernel` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 有 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
