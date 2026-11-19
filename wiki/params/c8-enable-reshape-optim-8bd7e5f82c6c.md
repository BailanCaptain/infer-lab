---
id: c8-enable-reshape-optim-8bd7e5f82c6c
legacyAnchors:
  一句话: 它曾经切换哪两种 C8 缓存写入算子，为什么在 v0.30.0 移除？
  事实表: 对照源码
  为什么存在: StoreKVBlock 按组写入的原理、历史默认值反转与角色闸门
  开了的代价: 跨版本迁移、辅助缓冲容量报错与 GLM 双机 kpool 限制
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

在长上下文稀疏注意力（例如 DeepSeek-V3.2 / SFA）里，每一层除了主注意力之外，还会带一个轻量的「索引器」（**LightningIndexer**），专门快速扫描历史 token、打分并挑出最关键的少数缓存块供主注意力读取。为了省显存，索引器自己缓存的历史 Key 向量也会被压成 8 位整数再配一份缩放因子，这就是 **C8 量化缓存**（属于「稀疏 C8」路线，见 [KV cache 量化](../concepts/kv-cache-quantization.md#ascend-上的三条-kv-cache-量化路)）。

**在当前的 `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）中，`c8_enable_reshape_optim` 开关连同其背后的 `StoreKVBlock` 优化已随 PR #18128 整体移除**，`LightningIndexer.write_cache` 统一经设备适配层 `DeviceOperator.scatter_cache` 写入 K 缓存与量化 scale 缓存；若升级后仍在 `additional_config` 中保留该键，会被 `@config(extra="forbid")` 拒收报错（仅环境可发现 `vllm_omni` 时才会告警并过滤未知顶层键）。在仍保留该键的历史版本里，`c8_enable_reshape_optim` 只控制一件事：**往显存里写这份 C8 量化缓存时，用按整批 slot 索引直接写入的 scatter 路径（旧分支与早期 `main` 直接调 `npu_scatter_nd_update_`，`v0.30.0rc2` 起经 `DeviceOperator.scatter_cache` 回退），还是改走 AscendC 的 `store_kv_block_metadata` + `store_kv_block` 按连续块分组写入。**

不同版本的开关状态与演化如下：

- **`v0.23.0` 与 `v0.26.0rc`**：它是 `additional_config` 顶层用户键，默认 `False`，实际取值等于 `enable_sparse_li_c8 and additional_config.get(..., False)`（索引器不走 C8 量化时怎么配都为假）；官方参数表提示 PD 分离时只在 P 节点开启，但代码未做强制拦截，混部部署也能打开；消费点位于 `sfa_v1.py`。
- **过渡快照（`v0.28.0.rc1` 空窗期 → 早期 `main` `baa023ad` 与 `v0.30.0rc2` `7d825229`）**：PR #15752（2026-09-07）曾删掉用户键改为自动判定，随后 PR #16952（2026-09-20）把开关恢复为可写字段并将默认值反转为 `True`（因此历史 `v0.28.0.rc1` tag 不含此用户键）。恢复后的消费点搬到 `attention/indexer.py`（经只读属性 `c8_reshape_optim_enabled` 读取），且在代码里硬性叠加了 PD 角色条件：`c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node`，其中 `enable_sparse_li_c8` 改为由 `attention_config.indexer_kv_dtype` 为 `fp8`/`int8` 且模型满足稀疏条件派生；即使全局条件为真，每个 indexer 层仍会经 `is_sparse_li_c8_layer` 检查是否在模型量化配置范围内。
- **`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）**：PR #18128 移除了 `store_kv_block` 优化与 `c8_enable_reshape_optim` 字段，`LightningIndexer.write_cache` 统一通过 `DeviceOperator.scatter_cache` 写入 K 缓存及量化 scale 缓存。继续在 `additional_config` 中保留 `"c8_enable_reshape_optim"` 会被 `@config(extra="forbid")` 拒收（仅当环境可发现 `vllm_omni` 时才会告警并过滤未知顶层键）。

## StoreKVBlock 按组写入的原理、历史默认值反转与角色闸门

在未走优化的 scatter 路径下，indexer 的 K 缓存通过 slot 定位每个 token：`npu_scatter_nd_update_`（或 `DeviceOperator.scatter_cache`）接收形状为 `(-1, head_dim)` 的整批 `k_li` 与 `(-1, 1)` 的整批 `slot_mapping` 一次调用完成更新（并非每个 token 发起一次 Python 算子调用）；C8 量化另需写入独立的 scale 缓存，因此 K 与 scale 各更新一次。

在仍包含 `StoreKVBlock` 优化的版本里，`store_kv_block_metadata` 沿 `slot_mapping` 顺序扫描，跳过负 slot，只把**目标 slot 连续且属于同一缓存块**的相邻输入归为一组，产出三个分组描述符 `group_len`（每组长度）、`group_key_idx`（源数据起始位置）、`group_key_cache_idx`（目标缓存起始位置）；它既不预先排序，也不跨块合并。

拿一组具体数字走一遍（**示意**：设缓存块长 `block_size = 4`，本步输入 7 个 token 的 `slot_mapping = [2, 3, 4, 7, -1, 8, 9]`，块号为 $\lfloor \text{slot} / 4 \rfloor$）：

| 分组编号 | 源输入下标 `group_key_idx` | 对应 `slot_mapping` | 所属块号（$\lfloor \text{slot}/4 \rfloor$） | 目标起始 `group_key_cache_idx` | 组长 `group_len` | 切分原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 第 0 组 | `0` | `[2, 3]` | 块 `0` | `2` | `2` | 同块且 slot 连续，合并成段 |
| 第 1 组 | `2` | `[4]` | 块 `1` | `4` | `1` | `3 → 4` 虽数值相邻，但跨过块 `0`/`1` 边界，**不合并** |
| 第 2 组 | `3` | `[7]` | 块 `1` | `7` | `1` | 同在块 `1` 但 `4 → 7` 不连续；紧随的 `-1` 直接跳过 |
| 第 3 组 | `5` | `[8, 9]` | 块 `2` | `8` | `2` | 跳过下标 `4`（`-1`）后，块 `2` 内连续成段 |

随后 `store_kv_block` 读取这三组描述符（调用前会断言索引器注意力元数据非空）并结合块大小，对 K 缓存和量化 scale 共用同一套分组结果成段复制。分组越长成段复制机会越多，不能由打开开关直接保证加速。

分组辅助缓冲在两代实现里也有差异：`v0.23.0` / `v0.26.0rc` 在 builder 初始化时按 `max_num_batched_tokens` 分配三个 int32 数组；过渡期 `main` / `v0.30.0rc2` 改为在首次使用对应 buffer key 时按容量公式分配：

$$\text{capacity} = \max\bigl(\text{max\_num\_batched\_tokens} \times \text{PCP},\ \text{按 TP 对齐后的 max\_num\_batched\_tokens}\bigr)$$

例如（**示意**）`max_num_batched_tokens = 2048`、`PCP = 2`、`TP = 8` 时，辅助缓冲容量为 $\max(2048 \times 2,\ 2048) = 4096$ 个 int32 槽位。每步取前「本步 slot 数」切片，并在每次获取（含复用已有缓冲）时校验容量，超出即抛 `Indexer C8 group metadata buffer is too small: capacity=..., required=...`（排查时需对比 `required` 与上述容量公式）。虽然派生开关在配置构造时计算，但消费者每次查询当前配置、配置工厂也支持 `refresh` 重建，因此既不是逐请求切换接口，也不能说整个进程只决定一次。

**为什么过渡期默认开启后还一度保留关闭开关**：PR #16952 恢复该开关的直接动机是让用户能禁用 `StoreKVBlock` 写入优化。关联的 [issue #15896](https://github.com/vllm-project/vllm-ascend/issues/15896) 报告了 HDK 25.1 上 pooling 与自定义 AICPU Tiling 在同一进程组合时挂起（作者随后将影响范围限定在 HDK 26.0 之前、不含 26.0，属于特定环境问题而非普遍现象）；关闭优化既可作为排查对照，也可用于速度与数值比较。最终 `v0.30.0` 直接移除了整套 `StoreKVBlock` 路径与该开关。

## 跨版本迁移、辅助缓冲容量报错与 GLM 双机 kpool 限制

- **升级到 `v0.30.0` / `main` 须移除该键**：自 PR #18128 起 `StoreKVBlock` 优化与 `c8_enable_reshape_optim` 一并删除，继续在 `additional_config` 中保留该键（包括早期 GLM5.2 教程里写过的 `"c8_enable_reshape_optim": false`）会触发 `@config(extra="forbid")` 拒收报错（仅环境可发现 `vllm_omni` 时才会告警并过滤未知顶层键）。同时，索引器缓存量化前提已统一由 `--kv-quant-dtype` / `attention_config.indexer_kv_dtype` 控制。
- **旧版本与过渡版本间的配置迁移陷阱**：在仍保留该键的历史版本之间迁移时，两个方向的坑相反——从 `v0.23.0` / `v0.26.0rc` 升到 `v0.30.0rc2` 等过渡版时，默认值由 `False` 翻为 `True` 且混部部署因缺少 `kv_transfer_config` 恒为假（`is_prefill_node` 要求 `kv_transfer_config` 非空且 `kv_role == "kv_producer"` 或 `is_kv_producer and not is_kv_consumer`，即 PD 角色要求从“文档提醒”变成了“代码硬闸”，无日志提示）；反方向回到 `v0.23.0` / `v0.26.0rc` 时，不仅默认 `False`，还必须同时配好 `enable_sparse_li_c8` 才会生效。在 `v0.28.0.rc1` 空窗期 tag 上则因 PR #15752 删键尚未恢复，写入该键同样会被拒绝。
- **过渡版的分组辅助缓冲越界报错**：若仍在过渡版（如 `v0.30.0rc2`）上触发 `Indexer C8 group metadata buffer is too small: capacity=..., required=...`，应对比报错中的 `required` 与容量公式 `max(max_num_batched_tokens × PCP, 按 TP 对齐后的 max_num_batched_tokens)`，不能只看数组是否已分配。
- **放到 GLM 双机部署（历史例外 B 算例）**：固定镜像 `db701c1f` 与 `v0.23.0` / `v0.26.0rc` 写法相同（实际取值 = `enable_sparse_li_c8 and c8_enable_reshape_optim`，默认均为 `False`），官方多机教程命令未传 `--additional-config`（见[部署页 · 怎么开](../concepts/glm-5-3-flash-two-node.md#怎么开)），因此未启用；即使强制把两个键都写成 `true`，旧 GLM 后端也会在构造时抛出 `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim`（其状态缓存使用独立 slot mapping，几何关系见[块表页](../concepts/block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)）。在 `v0.30.0` 及 `main` 中，`model_uses_kpool_indexer` 检测 `index_kpool` 并让 `model_uses_sfa_sparse` 返回 `False`，在模型判定阶段就排除了 kpool 模型走 LightningIndexer 稀疏路径；但 SFA 主 KV 的 C8 使用另一条包含 kpool 的判定，不能因 LI 优化不可用或已移除就推断新版 GLM 的全部 KV 量化路径不可用。

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
| releases/v0.23.0 | 有 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
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
