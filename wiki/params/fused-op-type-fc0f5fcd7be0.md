---
id: fused-op-type-fc0f5fcd7be0
legacyAnchors:
  一句话: 它曾经切换哪两条 decode 路径，为什么在 v0.30.0 移除？
  事实表: 对照源码
  为什么存在: 融合算子合并了哪四步，运行时回退与容量门槛怎么算？
  开了的代价: 升级后保留旧键会怎样，放到 GLM 双机能跑通吗？
title: fused_op_type
type: param
summary: >-
  曾用于切换 Sparse KV Offload decode 路径的子键（none 走四步、fused_copy_sfa 走 LIM +
  Copy-SFA）。仅见于 v0.30.0rc2 等过渡快照；v0.30.0 与 main 已移除该键并默认启用融合路径，传入旧键会报错。
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L1633
  - >-
    vllm-ascend@b64b4d714484feaa6ca71edc99b98318fe6d2f0d:vllm_ascend/ascend_config.py#L1634
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1630
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1628-L1634
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1638-L1641
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1689-L1700
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1636-L1660
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L269-L273
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L1047-L1054
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1467-L1496
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L31-L50
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L647-L650
  - 'https://github.com/vllm-project/vllm-ascend/pull/17392'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L1695
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L1671
  - >-
    vllm-ascend@8194eceae4a86366bea75309baa22fea4993da8a:vllm_ascend/ascend_config.py#L1675
  - >-
    raw:sha256-713a649f207c0f60169a93d63a7758e51994a647830f06e8755680887220599b.md#L1-L95
  - 'vllm-ascend@4ebb3090:vllm_ascend/worker/model_runner_v1.py#L3906-L4162'
  - 'vllm-ascend@4ebb3090:vllm_ascend/spec_decode/llm_base_proposer.py#L743-L846'
  - >-
    raw:sha256-80409e4542a727bf2fef283a74081a6ba9ef686a777356de6a11785de389a6e3.md#L1-L462
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L645-L650
  - >-
    raw:sha256-6bb998580ebafebdff12a46936dcf0600c0630a12238e810bd13a2a59fd501ed.md#L1-L471
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1693-L1716'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L68-L95'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L1625-L1627'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/model_runner.py#L372-L403'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L1701
  - 'vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L714-L787'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1757-L1764'
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L145-L172
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L320-L342
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L166
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L320-L342
  - 'vllm-ascend@4ebb3090:vllm_ascend/attention/sfa_kv_offload.py#L657-L783'
  - 'vllm-ascend@4ebb3090:vllm_ascend/attention/sfa_kv_offload.py#L269-L302'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1707-L1731'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1684-L1730'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/sfa_kv_offload.py#L63-L94'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L68-L75'
  - >-
    vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L138-L163
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1775-L1825'
rawSources:
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-487944627d866213f1a7080123d1b06364fdfd1236bf863485d634bc276f95bc.md
  - >-
    raw/sha256-49a563d9357dd523bc0ce40434ec5dffc0bcceb525fc745293c2ff302ec4cc22.md
  - >-
    raw/sha256-6bb998580ebafebdff12a46936dcf0600c0630a12238e810bd13a2a59fd501ed.md
  - >-
    raw/sha256-713a649f207c0f60169a93d63a7758e51994a647830f06e8755680887220599b.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-b0bf7c9b015725026d74fecb76f426e986e63df102a902ae4c3026d7e546bd7d.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
relations:
  - to: use-fused-overlap-75a180fff6ab
    kind: conflicts-with
    note: >-
      fused_op_type 设为 fused_copy_sfa 时与 use_fused_overlap=true
      互斥；此约束适用于引入融合路径后的版本，不适用于钉住的 baa023ad。
---
## 它曾经切换哪两条 decode 路径，为什么在 v0.30.0 移除？

`fused_op_type` 曾是 `additional_config["sparse_kv_offload_config"]` 下的子键，用于切换 [Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 在 decode 阶段是否走融合算子。

- 设为默认 `"none"` 时，走原始四步：索引器打分 → LRU 管理热缓冲 → 从主机搬运缺失行 → 跑 SFA。
- 设为 `"fused_copy_sfa"` 时，将这四步替换为两个融合算子：`fused_lightning_indexer_manage`（LIM，合并打分与热缓冲进出管理）和 `fused_scatter_copy_sparse_flash_attention`（Copy-SFA，边把缺失行从主机拷入边算 attention）。

该字段仅此两个枚举值，且与同嵌套块里的 [use_fused_overlap](use-fused-overlap-75a180fff6ab.md) 互斥——decode 路径只能三选一（默认、overlap、copy-SFA）。

**该用户键只短暂存在于 `v0.30.0rc2` 等过渡快照；在 `v0.30.0` 正式版与 `main` 中已随 PR #18301 / #18271 清理移除，改为默认启用融合路径**：

| 版本 / 快照 | `fused_op_type` 状态 | 关键能力与校验边界 |
| --- | --- | --- |
| `v0.23.0` 与 GLM 镜像 `db701c1f` | 无 Sparse KV Offload、无此键 | 写入不读也不报错 |
| `v0.26.0rc` | 不识别此键 | 仅按名称读取四个旧键，写入时静默忽略 |
| PR #17392（`4ebb3090`） | 存在，默认 `"none"` | 即使主开关 `enabled=false`，构造期仍先校验取值合法性与 `use_fused_overlap` 互斥；`Q_max` 限 1–7、禁用 DSpark 投机解码、热缓冲上限 `16128` |
| `v0.30.0rc2`（`7d825229`） | 存在，默认 `"none"` | `Q_max` 扩至 1–14、热缓冲上界扩至 `32512`（256 对齐，另含两块循环尾区、LIM 总上界 `32640`）；接入 V1/V2 runner 与 DSpark MRV2 remote prompt 初始化；`_lim_select` 新增 LightningIndexer 的 C8 `int8` 分支（不含 `fp8`，主 KV 仍为 BF16），须配含 LIM、LI C8 LIM、Copy-SFA 及注册 MemFabric 主机内存视图的原生扩展（普通 CPU tensor 不能替代注册 DRAM）。注：文末自动生成定义里的旧注释「C8 不由此服务路径选择」已落后于同快照代码，且 C8 从未作为第三个枚举值出现 |
| `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`） | **已删除**，传旧键直接报错 | `SparseKVOffloadConfig` 改为只读属性 `use_fused_copy_sfa`（返回 `self.enabled and not self.use_fused_overlap`）——开 offload 且未开 overlap 时默认走 LIM + Copy-SFA；`topk_buffer_size` 默认改为 `-1`（自动解析为 `(1 + num_speculative_tokens) × 2048`） |

## 融合算子合并了哪四步，运行时回退与容量门槛怎么算？

Sparse KV Offload 的每步 decode 计算量很小（见[为什么不整层搬回来](../concepts/kv-cache-sparse-offload.md#为什么不整层搬回来decode-一步算得太少)）。原始路径按「打分选位置 → 查表管热缓冲槽位 → 搬运缺失行 → 算 attention」四阶段顺序执行（见[一步 decode 的顺序](../concepts/kv-cache-sparse-offload.md#一步-decode-的顺序写新行选查表搬换号算)），中间反复传递选中位置、槽位与缺失行信息。

```wiki-diagram
file: param-fused-op-type
```

融合路径用 LIM 合并打分与热缓冲管理、用 Copy-SFA 合并缺失行拷贝与 attention，目的是减少分步调度与中间结果传递。但「四步变两步」只描述主要阶段，调用旁仍有连续化、查询准备和复用状态拷贝等开销，不能直接换算为固定减少两次 kernel 启动或两次显存读写。PR #17392 只说明加速目标而未给出分阶段计时，本仓库也无设备实测收益。

**启动期硬门槛与单步运行时回退分属两层判断**：

| 判断时机 | 触发条件与约束 | 不满足时的行为 |
| --- | --- | --- |
| **启动期校验**（开启融合路径时执行） | ① 模型 `topk == 2048`；② 每请求每步 query 行数 `Q_max = 1 + num_speculative_tokens` 落入区间（`4ebb3090` 为 1–7 且禁 DSpark 投机解码，`v0.30.0rc2`/`v0.30.0`/`main` 为 1–14）；③ `topk_buffer_size` 须为 `256` 的倍数（Copy-SFA 两块循环尾区要求 `2 × 128 = 256` 对齐）且在 `[Q_max × 2048, 上限]` 内（`4ebb3090` 上限 `16128`，新版 `LIM_MAX_HOT_TOKENS = 32640`、256 对齐最大 `32512`） | **直接报错退出**，不会自动退回默认四步路径 |
| **单步运行时回退**（启动通过后每步检查） | 某步最长 query 行数超上限，或批次混入 prefill（处理提示词尚未计算位置并建立历史状态的阶段）且未带 `offload_dummy` 标记（仅模拟批次路径如旧 runner/proposer 的 `dummy_run` 构造该标记，不代表真实混合请求放宽条件） | 该步**退回原始四阶段路径**；元数据准备将本次 bank 驻留历史标为失效（热缓冲管理状态），层前向再将本层 TopK 复用计数清零（层内复用状态）。二者仅在回退时触发，非每次前向清空全部历史，后续可复用行需重新判断 |

## 升级后保留旧键会怎样，放到 GLM 双机能跑通吗？

- **升级到 `v0.30.0` / `main` 必须删掉 `fused_op_type`**：这两版已移除该字段，并让 `use_fused_copy_sfa` 在开启 `sparse_kv_offload_config.enabled` 且关闭 `use_fused_overlap` 时默认生效；继续在 `sparse_kv_offload_config` 中保留 `"fused_op_type"` 会触发严格配置校验报错。同时 `topk_buffer_size` 默认已改为 `-1`（自动按 `(1 + num_speculative_tokens) × 2048` 计算），无需为了 MTP 手动调高默认 `4096`；用户仍可显式设置 256 倍数且不超过 `32512` 的值（多占设备显存的口径见[池子能开多大](../concepts/kv-cache-sparse-offload.md#池子能开多大三条上限取最小)）。
- **旧版容量门槛的数值算例**（下限为 $Q_{\max} \times 2048$）：

| MTP 草拟数 | 每请求每步 `Q_max` | 融合路径热缓冲下限 | 旧默认 `topk_buffer_size = 4096`（`4ebb3090` / `v0.30.0rc2`） |
| --- | --- | --- | --- |
| 0（不开 MTP） | `1` | `2048` | 通过 |
| 1 | `2` | `4096` | 通过（恰好贴下限） |
| 3（如 GLM 双机） | `4` | `8192` | **启动报错**，须显式调大（草拟 ≥ 2 均超 4096） |

- **放到 GLM 双机部署（历史例外 B 算例：两台 Atlas 800 A2、16 张卡、MTP 每轮草拟 3 个）**：固定镜像 `db701c1f` 没有 Sparse KV Offload 也没有此键，写入既不读也不报。即便换到支持 Sparse KV Offload 的版本，硬件这一关也过不去（见[逐条门槛](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。假如仅考察融合路径自己的几条检查：GLM 的 `index_topk` 为 [2048](../concepts/sparse-attention.md#对照源码) 满足 TopK 门槛，MTP 草拟 3 个对应每请求每步 `4` 行落在 1–7（及新版 1–14）范围内，但在旧默认 `4096` 下会卡在热缓冲下限 `4 × 2048 = 8192`，启动直接报 `fused_copy_sfa hot budget must be 256-aligned in [Q_max*2048, ...]` 错误。

## 对照源码

下表对照 `sparse_kv_offload_config.fused_op_type` 在四个固定版本快照中的移除演进与融合路径默认化：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| `fused_op_type` 用户键 | 不存在（无 Sparse KV Offload，忽略） | 不存在（只按名读取 4 个旧键，忽略）[C9] | 已移除（仅过渡版 `v0.30.0rc2` 存在）；传入会报错 [C37][!] | 同 `v0.30.0` [C41] |
| 融合路径选择方式 | — | — | 只读属性 `use_fused_copy_sfa = enabled and not use_fused_overlap`，默认走融合 [C37] | 同 `v0.30.0` [C41] |
| `topk_buffer_size` 默认与范围 | — | — | 默认 `-1`（自动算 `(1 + num_speculative_tokens) × 2048`）；256 对齐，最大 `32512`（LIM 上界 `32640`）[C38] | 同 `v0.30.0` |
| 查询行数 `Q_max` 与 TopK | — | — | `TopK = 2048`，`1 ≤ Q_max ≤ 14` [C38] | 同 `v0.30.0` |

- **历史过渡版（PR #17392 / `4ebb3090` 与 `v0.30.0rc2` `7d825229`）**：字段定义、合法值 `("none", "fused_copy_sfa")` 与 `use_fused_overlap` 互斥校验见来源 4–7、23、36 [C5][C36]；`4ebb3090` 的 1–7 行与 16128 上限、非融合回退（重置 bank 驻留历史与层内 TopK 复用计数）及 `dummy_run` 标记 `offload_dummy` 见来源 6、8、12、18、19、34、35；`v0.30.0rc2` 扩至 1–14 行 / 32512、加入 LI C8 `int8` 分支与 V2 初始化及原生 MemFabric 扩展要求见来源 24–26、28–31 [S30]（自动生成定义中的旧 C8 注释已落后于同快照代码 [!]）。
- **`v0.30.0` 与 `main` 清理移除**：`c09d3e20:release_notes.md#L68-L75`（PR #18301 / #18271）记录移除冗余稀疏 KV offload 配置 [S39]；`c09d3e20:layerwise_and_sparse_kv_cache_offloading.md#L138-L163` 说明默认 Copy-SFA 路径与 `topk_buffer_size = -1` / 最大 `32512` [S40]；“四步变两步”与算子功能对应出自 PR #17392 说明（来源 13）[I]；GLM `Q_max = 4` 与热缓冲下限 `8192` 为按公式推导 [D]。
- **待核**：PR #17392 未公布开与不开融合算子的分阶段计时对照，本仓库尚无设备实测收益数据。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `SparseKVOffloadConfig.fused_op_type` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["fused_op_type"]` |
| 类型 | `str` |
| 默认表达式 | `'none'` |
| 定义 | `vllm_ascend/ascend_config.py:1701` [C27] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

Generalized Q1/MTP LIM + copy-SFA. The C8 operator is built separately but is not selected by this serving path.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.fused_op_type not in ('none', 'fused_copy_sfa'):
    raise ValueError('sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa')
````
