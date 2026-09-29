---
id: use-fused-overlap-75a180fff6ab
title: use_fused_overlap
type: param
summary: >-
  Sparse KV Offload 在 decode 上的第二条路径开关，挂在 sparse_kv_offload_config
  这个嵌套块里（不是顶层），bool、默认 false；开了就用 npu_fused_sparse_attention_overlap 直接读主机池，不再「搬
  miss 再算」。在册版本里只有 main 有。
aliases:
  - sparse_kv_offload_config.use_fused_overlap
  - 融合重叠 decode
  - npu_fused_sparse_attention_overlap
  - fused_overlap decode
chapters:
  - '11'
origin: seed
verified:
  - main
evidence: C
updated: '2026-09-24'
relations:
  - to: kv-cache-sparse-offload
    kind: builds-on
    note: 它是那套卸载在 decode 上的第二条路径开关，只有 sparse_kv_offload_config.enabled 为真时才有人读它
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1478'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1478
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1467-L1486'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1488-L1496'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1605-L1607'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1678'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L43-L48'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L13-L19'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L202-L205'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1047'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L650-L657
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L714-L717
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L556-L559
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L778-L788
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L851-L855
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1090-L1093
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L219-L238
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1047-L1054'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L1535
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L1547
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L1630
  - >-
    vllm-ascend@b64b4d714484feaa6ca71edc99b98318fe6d2f0d:vllm_ascend/ascend_config.py#L1631
rawSources:
  - >-
    raw/sha256-487944627d866213f1a7080123d1b06364fdfd1236bf863485d634bc276f95bc.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

[Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 的 decode 有两条路：默认那条是「indexer 选出 top-k → 把没命中的行 H2D 搬进常驻热缓冲 → 跑一次常驻 SFA」，`use_fused_overlap` 打开的是第二条——**不搬了，直接用 `npu_fused_sparse_attention_overlap` 读主机上那份全量 KV**，NPU 上只留一块选择缓冲 [C8]。`bool`、默认 `false` [C3]。

**它不在 `additional_config` 顶层。** 它是 `SparseKVOffloadConfig` 的字段，真实路径是 `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`（见文末「参数定义」），必须写在 `sparse_kv_offload_config` 这个嵌套块里。写成顶层那样在 main 上启动，会被 `AscendConfig` 的 `extra="forbid"` 当拼写错误直接拒掉 [C6]。

**存在范围。** 在册版本里只有 main 有（上游从 main 分出的 v0.28.0rc、v0.29.0rc 也带着它，但不在册，见下面「版本谱系」）。v0.26 分支（2026-09-17 源码快照）的 `SparseKVOffloadConfig` 是普通类、逐个 `user_config.get(...)` 取值，只认 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache` 四个键 [C19]，写上它会被静默忽略；v0.23 维护分支上整套 Sparse KV Offload 都不存在。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]` [C3] | 必须嵌在 `sparse_kv_offload_config` 块里；写到顶层会让 main 启动失败 [!] |
| 类型与默认 | `bool`，默认 `False` | 不写就是老路径；它和 `enabled` 是两个独立的开关 |
| 生效前提 | 只有 `sparse_kv_offload_config.enabled` 为真时才有人构造这套对象 [C5] | 单独开它什么也不会发生，因为整套卸载没启动 |
| 官方文档 | 一个字都没有：`layerwise_and_sparse_kv_cache_offloading.md` 的启动示例只给了三个键 [S17] | 它目前是「代码里有、文档里没有」的状态，行为随时可能改 |
| 报错信息里的名字 | `kv_offload_decode_config.use_fused_overlap=true` [C11] | 这个配置块名全仓不存在，按它去配会找不到地方写 [!] |
| decode 走哪条路 | `if self.use_fused_overlap:` 换成 `_execute_fused_overlap_offload_decode` | 分叉点在注意力算子内部，不是在调度或 connector 层 |
| 同一步里有 prefill 时 | prefill 部分仍走原来的 sparse flash attention，并先 `_check_device_kv_cache_exist()` | 它只改 decode 那一半；chunked prefill 混批时两条路同时在跑 |
| TP 的分工 | 只有 `tp_rank == 0` 预热外部 LRU planner 线程、用副 stream 存当前 KV [C13] | 非 0 rank 在初始化时把共享 CPU 池恢复成 GVA 视图，TP 组内两种角色不对称 |
| 额外常驻对象 | 两条 NPU stream + 一块 `1 + max_num_topk_rows` 的 int32 计划元数据 | 开了就常驻，和实际有没有走到 fused 路径无关 |
| 覆盖版本 | 只有 main | v0.26 上写了静默忽略，v0.23 上整套特性都没有 |

## 为什么存在

默认那条 decode 路径的代价是**一次同步的 H2D 搬运**：top-k 选完，没在热缓冲里的行要先搬回 NPU，才能跑注意力。`use_fused_overlap` 想省掉的就是这一步——`npu_fused_sparse_attention_overlap` 这个算子直接读主机 pinned 池里的全量 KV，NPU 上只保留一块选择缓冲，搬运与计算在算子内部重叠掉。模块头的注释把两条路写成并列的两条，选哪条完全由这一个布尔值决定。

**它被读三次，落在三个不同的对象上。** `AscendSFAKVOffloadImpl.__init__` 从 `get_ascend_config().sparse_kv_offload_config` 取一份存成 `self.use_fused_overlap` [C9]，`SparseKVOffloadManager` 在自己的构造里另取一份，两边各判各的。真正的分叉写在 `_forward_decode` 里那句 `if self.use_fused_overlap:` [C10]；manager 那边则用它决定要不要建 `current_kv_save_stream` / `fused_plan_stream` 这两条流和那块计划元数据 [C14]。

**一开就把 TP 组拆成两种角色**，这是这个键最不像「性能开关」的地方：

- `tp_rank == 0` 负责预热外部 LRU planner 的 OpenMP 线程池——判据写成 `if not (self.use_fused_overlap and self.tp_rank == 0): return 0` [C13]；
- 存当前步 KV 时，只有 `tp_rank == 0` 且正在捕获、且这一步没有 prefill，才走副 stream [C16]；
- 其余 rank 在初始化末尾把共享 CPU 池按广播来的形状**恢复成非拥有的 GVA 视图** [C15]。

换句话说，CPU 池的所有权集中在 rank 0，别的卡看到的是同一块主机内存的视图。这也解释了为什么两处 `RuntimeError` 要把它写成硬前提：`allocate_fused_overlap_membership_map` 和 `get_fused_overlap_cpu_kv_inputs` 在它为假时直接抛，而不是降级 [C12]。

## 开了的代价

**报错信息会把你指向一个不存在的配置块。** 那两处 `RuntimeError` 的文案都写着 `kv_offload_decode_config.use_fused_overlap=true`，但 `kv_offload_decode_config` 这个名字在 `vllm_ascend/` 和 `docs/` 里一处都找不到 [D]。真正要写的是 `sparse_kv_offload_config`。看到这条报错别去搜那个名字 [!]。

**官方文档完全没有它。** main 上 Decode 侧的启动示例只列了 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` 三项 [S17]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html)），`additional_config.md` 里连 `sparse_kv_offload_config` 这一块都没有。**没有文档意味着没有兼容承诺**——它是 2026-09-07 随 PR [#14957](https://github.com/vllm-project/vllm-ascend/pull/14957) 进来的，至今没有进任何在册版本；上游后来分出的 v0.28.0rc、v0.29.0rc 带着它，但那两个分支不在册、也没人核对过。

**开了就多常驻两条 stream 和一块元数据缓冲。** `_init_offload_buffers` 在这个分支里额外建 `current_kv_save_stream`、`fused_plan_stream`，以及一块 `1 + max_num_topk_rows` 的 int32 张量（再从中切出 `fused_plan_status_npu` 和 `fused_plan_current_linear_slots_npu`）[C14]。这些是启动时按最大规模建的，和实际请求走不走到 fused 路径无关。

**它不接管 prefill。** 同一步里既有 decode 又有 prefill 时，decode 走 fused 路径、prefill 仍走原来的 `_execute_sparse_flash_attention_process`，而且先要 `_check_device_kv_cache_exist()` 确认设备上还有主 KV。也就是说在 `keep_device_kv_cache=false` 的纯 decode 部署之外用它，容易撞上这道检查。

**升级与降级都要手动改这个键。** 它挂在嵌套块里，所以两种写错方式的下场不同：写在顶层，main 上被 `extra="forbid"` 拒掉 [C6]；写在 `sparse_kv_offload_config` 里但键名拼错，`SparseKVOffloadConfig` 同样是 `@config` 修饰的 pydantic dataclass，`cls(**user_config)` 会当场报错 [C4][C7]。**反过来在 v0.26 上配它，两种写法都一声不吭**——那个分支的 `SparseKVOffloadConfig` 是逐键 `.get()`，认不得的键既不读也不报 [C19]。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 有（3 个文件） |
| releases/v0.29.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-09-07 · 1493369b754840da75c117651b50034a4cc7ae2d · PR [#14957](https://github.com/vllm-project/vllm-ascend/pull/14957) —— [Feature][Attention] Add fused sparse attention overlap decode support for Ascend SFA KV offload (#14957)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp` +0 / −336（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py` +498 / −40（文本行变化）
  - `vllm_ascend/attention/sfa_kv_offload.py` +687 / −1（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:1631` [C23] |
| 版本 | main · b64b4d714484feaa6ca71edc99b98318fe6d2f0d |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.use_fused_copy_sfa and self.use_fused_overlap:
    raise ValueError('fused_copy_sfa and use_fused_overlap are mutually exclusive')
````
