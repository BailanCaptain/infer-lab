---
id: c8-enable-reshape-optim-8bd7e5f82c6c
legacyAnchors:
  一句话: 它曾经切换哪两种 C8 缓存写入算子，为什么在 v0.30.0 移除？
  为什么存在: StoreKVBlock 按组写入的原理、历史默认值反转与角色闸门
  开了的代价: 跨版本迁移、辅助缓冲容量报错与 kpool 边界
  跨版本迁移辅助缓冲容量报错与-glm-双机-kpool-限制: 跨版本迁移、辅助缓冲容量报错与 kpool 边界
title: c8_enable_reshape_optim
type: param
summary: >-
  曾用于将 LightningIndexer C8 缓存写入由 scatter 切换为 StoreKVBlock 的开关。v0.23/v0.26 默认
  false，v0.30.0rc2 改为默认 true 并限 P 节点；v0.30.0 与 main 已移除（PR #18128），统一走 scatter。
aliases:
  - additional_config.c8_enable_reshape_optim
  - C8 reshape 优化
  - StoreKVBlock
  - store_kv_block
chapters:
  - '17'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: kv-cache-quantization
    kind: builds-on
    note: 它只作用在 LightningIndexer 那份 C8 量化缓存的写入路径上，indexer 不走 C8 时这个键恒等于没开
  - to: ascend-config-system
    kind: builds-on
    note: 本页四个固定快照都有此用户键，默认值与派生条件存在差异；还须核对具体层的运行时消费者
  - to: sparse-attention
    kind: builds-on
    note: 该历史开关仅作用于稀疏注意力 LightningIndexer 的 C8 量化缓存写入路径
  - to: pd-disaggregation
    kind: builds-on
    note: 过渡版 v0.30.0rc2 将该优化硬性限定为 PD 分离的 P 节点（is_prefill_node），混部部署恒为关闭
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L526
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L777-L786'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L524-L535'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1083-L1086'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L234-L274'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L1068-L1082'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1697'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/GLM5.2.md#L217'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L280-L284'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L89
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L286-L290'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L1547-L1549'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L460-L467'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L83
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/configuration/additional_config.html
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L540
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L554
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L637
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/attention/indexer_kpool_mla_v1.py#L556-L568
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L280-L284
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/attention/sfa_v1.py#L289-L294
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/indexer.py#L898-L919
  - >-
    vllm-ascend@0576b6471c7a35707920a665352391d33c77451c:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L635
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L646
  - >-
    raw:sha256-d9bc903482e7ff010b8f925059e0ac5b1d40550ea2feed01e412195f1444b3f8.md#L1-L358
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L774-L777
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/indexer.py#L232-L263
  - >-
    raw:sha256-0cd8d15da55b94d91a8e83caf4bbd5f50d07cb8926122e16f99b98aed9d69eb4.md#L1-L400
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L640-L657'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L906-L940'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer.py#L1149-L1163'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L646
  - 'vllm-ascend@baa023ad:csrc/attention/store_kv_block_metadata/op_kernel_aicpu/store_kv_block_metadata_aicpu.cpp#L57-L125'
  - 'vllm-ascend@baa023ad:csrc/attention/store_kv_block/op_kernel/store_kv_block.h#L98-L126'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L524-L532'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L177-L198'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L196-L217'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer.py#L275-L334'
  - 'vllm-ascend@7d825229:vllm_ascend/device/device_op.py#L93-L103'
  - 'https://github.com/vllm-project/vllm-ascend/issues/15896'
  - 'https://github.com/vllm-project/vllm-ascend/pull/16952'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1064-L1081'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L181-L190'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L1981-L2019'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L68-L75'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/release_notes.md#L220-L227'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/indexer.py#L267-L301'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1895-L1910'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L196-L218'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/indexer.py#L403-L436'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033'
rawSources:
  - >-
    raw/sha256-0cd8d15da55b94d91a8e83caf4bbd5f50d07cb8926122e16f99b98aed9d69eb4.md
  - >-
    raw/sha256-25913d0730e85a0f90de751faef5da5ca9ce2bc609ada06beb18ce089987dd6f.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-d9bc903482e7ff010b8f925059e0ac5b1d40550ea2feed01e412195f1444b3f8.md
---
## 它曾经切换哪两种 C8 缓存写入算子，为什么在 v0.30.0 移除？

**`c8_enable_reshape_optim` 曾用于在「按槽位分散写入（scatter）」与「按连续块分组写入（`StoreKVBlock`）」之间切换稀疏注意力索引器的 C8 缓存写入路径；`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）已随 PR #18128 移除该开关与 `StoreKVBlock` 算子，升级后必须从 `--additional-config` 中删掉此键，否则会被 [AscendConfig](../concepts/ascend-config-system.md) 的 `@config(extra="forbid")` 拒收报错（仅环境可发现 `vllm_omni` 时才会告警并过滤未知顶层键）。**

在长上下文[稀疏注意力](../concepts/sparse-attention.md)（如 DeepSeek-V3.2 / SFA）里，每一层除了主注意力之外，还配有一个轻量索引器（**LightningIndexer**），负责快速扫描历史 token、打分挑出少数关键缓存块。为节省显存，索引器缓存的历史 Key 向量会被压成 8 位整数并配一份反量化缩放因子（scale），即**索引器 C8 量化缓存**；它与**主 KV C8 量化**分属两条独立判断路径（见 [KV cache 量化](../concepts/kv-cache-quantization.md#ascend-上的三条-kv-cache-量化路)）。

在仍保留该键的历史版本里，关闭优化走整批 `slot_mapping` 分散写入的 scatter 路径（旧分支直调 `npu_scatter_nd_update_`，`v0.30.0rc2` 起统一经 `DeviceOperator.scatter_cache`），开启优化则改走 AscendC 的 `store_kv_block_metadata` + `store_kv_block` 成段写入；`v0.30.0` 与 `main` 现已统一收敛为 `DeviceOperator.scatter_cache`。

## 事实表

排查跨版本迁移报错或复核历史部署脚本时，可速查下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史配置路径 | `additional_config["c8_enable_reshape_optim"]`（`bool`） | 仅作用于 LightningIndexer 的 C8 量化缓存写入，indexer 不走 C8 时恒为关闭 |
| `v0.30.0` / `main` 现状 | 已随 PR #18128 删除，统一经 `DeviceOperator.scatter_cache` 写入 | 旧教程（如早期 GLM5.2 教程中的 `false`）迁至 `v0.30.0` 必须删除该键，否则启动报错 |
| `v0.23.0` / `v0.26.0rc` 行为 | 顶层键，默认 `False` | 须同时开启 `enable_sparse_li_c8` 才生效；官方建议仅 P 节点开启，但代码未拦截混部 |
| `v0.30.0rc2` 过渡行为 | PR #16952 恢复并反转默认 `True`（`v0.28.0.rc1` 曾短暂删键） | 代码硬性要求 `is_prefill_node`（PD 分离 P 节点），混部部署恒为关闭且无提示 |
| 过渡版缓冲越界条件 | 报 `Indexer C8 group metadata buffer is too small` | 需核对本步 slot 数是否超过 $\max(\text{max\_num\_batched\_tokens} \times \text{PCP}, \text{TP 对齐值})$ |
| GLM kpool 索引器边界 | 旧 `db701c1f` 显式报错拒绝；`v0.30.0` / `main` 在模型判定阶段排除 `index_kpool` | GLM-5.3-Flash 使用独立 kpool 缓存，从不走本开关控制的 `StoreKVBlock` 路径 |

## 四个版本周期的开关演进与消费点

细看四个版本周期的开关演进与消费点变化：

| 版本 / 快照 | 字段与默认 | 生效条件与消费点 |
| --- | --- | --- |
| `v0.23.0` / `v0.26.0rc` | 顶层键，默认 `False` | 实际取值 `enable_sparse_li_c8 and additional_config.get(..., False)`（索引器不走 C8 时恒为假）；官方表建议 [PD 分离](../concepts/pd-disaggregation.md)只在 P 节点开，但代码未拦截、混部可开；消费点在 `sfa_v1.py` |
| `v0.28.0.rc1` 空窗期 | 暂删（PR #15752，2026-09-07） | 曾改为自动判定，该 tag 写入此键会被拒绝 |
| 早期 `main`（`baa023ad`）与 `v0.30.0rc2`（`7d825229`） | PR #16952（2026-09-20）恢复并**反转默认 `True`** | 消费点迁至 `attention/indexer.py`（只读属性 `c8_reshape_optim_enabled`），硬性叠加 PD 角色：`c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node`。其中 `enable_sparse_li_c8` 改由 `attention_config.indexer_kv_dtype` 为 `fp8`/`int8` 且模型满足稀疏条件派生；全局为真后，每层仍经 `is_sparse_li_c8_layer` 检查是否在模型量化配置范围内 |
| `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`） | **已删除**（PR #18128） | `LightningIndexer.write_cache` 统一经 `DeviceOperator.scatter_cache` 写入 K 与 scale 缓存；保留旧键被 `@config(extra="forbid")` 拒收（装 `vllm_omni` 时告警过滤未知顶层键） |

## StoreKVBlock 按组写入的原理、历史默认值反转与角色闸门

在默认的 scatter 路径下，索引器 K 缓存通过槽位号（slot）定位每个 token。`npu_scatter_nd_update_`（或 `DeviceOperator.scatter_cache`）一次接收形状为 `(-1, head_dim)` 的整批 `k_li` 与 `(-1, 1)` 的 `slot_mapping` 完成更新，并非逐个 token 发起 Python 调用；C8 量化另有一份独立 scale 缓存，因此 K 与 scale 各更新一次。

在曾包含 `StoreKVBlock` 的版本里，`store_kv_block_metadata` 沿 `slot_mapping` 顺序扫描并跳过负数槽位，只把**目标槽位连续且落在同一缓存块内**的相邻输入归为一组。它产出三个一维数组：`group_len`（每组长度）、`group_key_idx`（源数据起点）与 `group_key_cache_idx`（目标缓存起点），既不预先重排顺序，也不跨块合并。

```wiki-diagram
file: param-c8-enable-reshape-optim
```

拿一组示意数字核对分组规则（设缓存块长 `block_size = 4`，本步输入 7 个 token 的 `slot_mapping = [2, 3, 4, 7, -1, 8, 9]`，块号为 $\lfloor \text{slot} / 4 \rfloor$）：

| 分组编号 | 源输入下标 `group_key_idx` | 对应 `slot_mapping` | 所属块号（$\lfloor \text{slot}/4 \rfloor$） | 目标起始 `group_key_cache_idx` | 组长 `group_len` | 切分原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 第 0 组 | `0` | `[2, 3]` | 块 `0` | `2` | `2` | 同块且 slot 连续，合并成段 |
| 第 1 组 | `2` | `[4]` | 块 `1` | `4` | `1` | `3 → 4` 虽数值相邻，但跨过块 `0`/`1` 边界，**不合并** |
| 第 2 组 | `3` | `[7]` | 块 `1` | `7` | `1` | 同在块 `1` 但 `4 → 7` 不连续；紧随的 `-1` 直接跳过 |
| 第 3 组 | `5` | `[8, 9]` | 块 `2` | `8` | `2` | 跳过下标 `4`（`-1`）后，块 `2` 内连续成段 |

随后 `store_kv_block` 读取这三份描述符（调用前断言索引器注意力元数据非空），对 K 缓存和量化 scale 共用同一套分组结果成段复制。连续分组越长，成段拷贝收益越大；仅打开开关本身并不保证加速。

分组辅助缓冲的分配口径经历过两代变化。`v0.23.0` / `v0.26.0rc` 在构造期直接按 `max_num_batched_tokens` 分配三个 `int32` 数组；`v0.30.0rc2` 等过渡版改为首次访问对应 buffer key 时按以下公式分配：

$$\text{capacity} = \max\bigl(\text{max\_num\_batched\_tokens} \times \text{PCP},\ \text{按 TP 对齐后的 max\_num\_batched\_tokens}\bigr)$$

以示意配置 `max_num_batched_tokens = 2048`、`PCP = 2`、`TP = 8` 代入，辅助缓冲容量为 $\max(2048 \times 2,\ 2048) = 4096$ 个 `int32` 槽位。每次前向（含复用已有数组）都会取本步 slot 数切片并校验上界，一旦超出即抛 `Indexer C8 group metadata buffer is too small: capacity=..., required=...`。此外，消费者在调用时读取当前配置单例（工厂支持 `refresh` 重建），因此它虽非逐请求动态开关，也不是进程内永不可变的死常量。

过渡期默认开启后仍短暂保留关闭入口，源于 PR #16952 与 [issue #15896](https://github.com/vllm-project/vllm-ascend/issues/15896) 的排障需求：后者在 HDK 25.1 环境（作者限定在 HDK 26.0 之前）观察到 pooling 与自定义 AICPU Tiling 同进程组合时挂起，需要保留开关做隔离与速度对照。到 `v0.30.0` 正式版，整套 `StoreKVBlock` 路径与该开关一并退役。

## 跨版本迁移、辅助缓冲容量报错与 kpool 边界

- **升级到 `v0.30.0` / `main` 必须删键**：`StoreKVBlock` 与 `c8_enable_reshape_optim` 已随 PR #18128 移除。继续在 `additional_config` 中保留该键（包括早期 GLM5.2 教程写过的 `"c8_enable_reshape_optim": false`）会触发 `@config(extra="forbid")` 报错（仅 `vllm_omni` 环境告警过滤）。当前索引器缓存量化统一由 `--kv-quant-dtype` / `attention_config.indexer_kv_dtype` 控制。
- **历史版本间的默认值与角色门差异**：若仍在旧分支之间迁移，需分清三段行为：
  - `v0.23.0` / `v0.26.0rc` 默认 `False`，须显式配齐 `enable_sparse_li_c8` 才生效，混部节点未做代码拦截；
  - `v0.28.0.rc1` 曾因 PR #15752 暂删该键，写入会被拒绝；
  - `v0.30.0rc2` 等过渡版默认反转为 `True`，但代码硬性叠加 PD 分离 P 节点检查（`is_prefill_node` 要求 `kv_transfer_config` 非空且承担 producer 角色），混部部署恒为关闭且不打日志。
- **过渡版辅助缓冲越界排查**：在 `v0.30.0rc2` 等快照遇到 `Indexer C8 group metadata buffer is too small: capacity=..., required=...` 时，直接对照报错中的 `required` 与上文 `max(max_num_batched_tokens × PCP, TP 对齐值)` 容量公式核查本步 slot 数。
- **区分「索引器 C8」与「主 KV C8」两条路径**：在 `v0.30.0` 与 `main` 中，`model_uses_kpool_indexer` 识别带 `index_kpool` 压缩池的模型并令 `model_uses_sfa_sparse` 返回 `False`，在模型判定阶段就把 `kpool` 模型排除在 `LightningIndexer` 稀疏路径之外；而 SFA 主 KV 的 C8 量化使用另一条包含 `kpool` 的独立判定，切勿因索引器 C8 优化下线或不适用就误判主 KV 量化不可用。历史双机镜像的 `kpool` 构造报错与块表关系已归入[固定双机的参数边界](../concepts/glm-5-3-flash-two-node.md#固定双机的参数边界)与[块表页](../concepts/block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)。

## 对照源码

下表对照 `c8_enable_reshape_optim` 在四个固定版本快照中的开关状态、写入算子与角色约束：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 开关是否存在 | 有，`additional_config` 顶层键，默认 `False` [C9][S10] | 同 `v0.23.0` [C12][S15] | 已随 `StoreKVBlock` 一并移除（PR #18128）；传入报错（`vllm_omni` 告警过滤）[S48][C50][!] | 同 `v0.30.0` [C53] |
| 实际写入算子 | 开启且 `enable_sparse_li_c8=True` 时走 `store_kv_block`；关闭走 `npu_scatter_nd_update_` [C14][C46] | 同 `v0.23.0` | 统一经 `DeviceOperator.scatter_cache` 写入 K 与 scale 缓存 [C49] | 同 `v0.30.0`（支持非连续 hybrid page 视图）[C52] |
| PD 角色约束 | 仅官方文档建议“只在 P 节点开”，混部可开 [S10] | 同 `v0.23.0` [S15] | 优化已移除，无此角色闸门 | 同 `v0.30.0` |
| kpool 模型判定 | 旧 GLM 镜像 `db701c1f` 构造时显式报错拒绝 [C20] | — | `model_uses_sfa_sparse` 排除 `index_kpool` [C51] | 同 `v0.30.0` |

- **历史过渡版（PR #15752 删键 → PR #16952 恢复默认 `True` → `v0.30.0rc2` `7d825229`）**：字段恢复、私有派生字段及 `c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node` 角色闸门见来源 1–4、28、31、32 [C2]（关联 issue #15896 与恢复 PR #16952 见来源 42、43 [I]）；`store_kv_block_metadata` 顺序扫描、不跨块合并与辅助缓冲容量校验见来源 5、6、23、29、35–37 [C35]；`is_sparse_li_c8_layer` 逐层判定与 `v0.30.0rc2` 引入 `DeviceOperator.scatter_cache` 回退见来源 40、41、45；官方 GLM5.2 旧教程写法见来源 8 [S8]。
- **`v0.30.0` 与 `main` 移除依据**：发布说明 `c09d3e20:release_notes.md#L68-L75` 与 `#L220-L227`（PR #18128 / #18301）明确记录移除 `StoreKVBlock` 优化与 `c8_enable_reshape_optim` 开关 [S47][!]。
- **旧发布快照文档与 GLM 双机**：`v0.23.0` / `v0.26.0rc` 参数表见[v0.23 线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)（来源 10、11、15、16）；GLM 固定双机镜像默认配置与多机命令见来源 21、24。**待核**：本仓库无 `StoreKVBlock` 历史版本的实机吞吐对照数据。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.c8_enable_reshape_optim` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["c8_enable_reshape_optim"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:646` [C34] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

See https://github.com/vllm-project/vllm-ascend/issues/15896

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
