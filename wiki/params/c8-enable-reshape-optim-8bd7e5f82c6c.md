---
id: c8-enable-reshape-optim-8bd7e5f82c6c
title: c8_enable_reshape_optim
type: param
summary: >-
  让 LightningIndexer 的 C8 缓存由 scatter 更新改走 StoreKVBlock 分组写入。旧 v0.23/v0.26 快照默认
  false；固定 main 与 rc2 默认 true，但还须满足模型、索引 C8 和 PD 的 P 节点条件。本站旧 GLM
  双机部署没开，旧后端会拒绝启用；新版 kpool 模型在派生条件中被排除。
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
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
## 一句话

**v0.30.0rc2 对照：** 声明默认 True，与固定 main 相同、与旧 0.23/0.26 的 False 不同。最终生效还须启用 LightningIndexer C8 且实例是 PD 的 P 侧；索引 C8 由 indexer_kv_dtype 和模型类型派生。默认开不等于混部或 D 侧实际使用 StoreKVBlock，也不改变本站旧 GLM 部署的结果。rc2 的非优化分支已经通过 `DeviceOperator.scatter_cache` 选择设备实现，再回退到 `npu_scatter_nd_update_`，不能把下文固定 main 的直接调用当作 rc2 的完整路径 [C40][C41]。

它只管一件事：**LightningIndexer 把自己那份 C8 量化缓存写进去时，用哪个算子**（索引器缓存的 C8 属于「稀疏 C8」那条路，见 [KV cache 量化](../concepts/kv-cache-quantization.md#ascend-上的三条-kv-cache-量化路)）。固定 main 关掉时走 `npu_scatter_nd_update_`，一次调用传入整批 slot 索引和更新数据；打开时走 AscendC 写的 `store_kv_block`，按「组」成段写。两个旧发布快照默认 `False`，而且还与 `enable_sparse_li_c8` 取逻辑与——indexer 不走 C8 量化，这个键怎么配都是假，具体条件见下表。

**存在范围：四个固定快照都有这个名字，但 main 与 rc2 增加了角色条件。** v0.23 维护分支与 v0.26 分支上它是 `additional_config` 顶层的用户键，官方参数表明确写着默认 `False`、要配合 `enable_sparse_li_c8`、PD 分离时只在 P 节点开 [S10]。PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752)（2026-09-07）把用户键删掉改成自动判定，PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952)（2026-09-20）又把开关加了回来，默认值改为 `True`。**固定 main 的开关已经恢复**：`c8_enable_reshape_optim` 是可写字段，但它只是派生判定的第一项，用户写 `true` 并不等于实际使用该算子。历史 `v0.28.0.rc1` tag 处在删除之后、恢复之前，不含这个用户键；固定 main 与 rc2 已经恢复。

## 事实表

| 项 | v0.23 维护分支 / v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 它是什么 | `additional_config` 顶层的用户键 | `AscendConfig` 上可写的字段，另有一个 `init=False` 的私有字段存最终判定 | 两边都能写，但 main 上「写进去的值」和「算出来的结果」是两个不同的东西 [!] |
| 默认值 | `False` [S15] | `True` [C1] | 从发布分支升到 main，改为默认请求开启；实际使用仍须满足下述角色与路径条件 |
| 实际取值 | `enable_sparse_li_c8 and additional_config.get(..., False)` [C9] | `c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node` [C2] | main 多加了一道 PD 角色闸，少一个条件就为假 |
| 混部（没有 `kv_transfer_config`） | 可以开 | **恒为假** | main 上不做 PD 分离就永远享受不到这个优化，日志里也不会说 [!] |
| `enable_sparse_li_c8` 从哪来 | 用户在 `additional_config` 里配，再检查稀疏模型类型 | 由 `attention_config.indexer_kv_dtype` 为 fp8/int8 且模型满足稀疏条件派生 | 通过索引缓存 dtype 配置控制量化前提，不能继续依赖旧顶层键 |
| 读它的地方 | `sfa_v1.py` 的建 metadata 与 `_use_li_c8_reshape_optim` | 搬到 `attention/indexer.py`，经只读属性 `c8_reshape_optim_enabled` 取 | 在 main 上按老文件名搜会搜空 |
| 开了写什么 | `store_kv_block` + `store_kv_block_metadata` | 同 | 两个算子配套：先算出分组元数据，再成段写 |
| 关了写什么 | `npu_scatter_nd_update_`，按整批 slot 索引更新 [C46] | 同 | 此表限定这两个 LightningIndexer 实现；rc2 另经设备适配层，kpool 等其他后端不在此表范围内 |
| 往 `additional_config` 里写它 | 收下，就是这个键本身 | 收下——它是字段、又不在 `_NON_USER_INPUT_KEYS` 里，`extra="forbid"` 放行 [C7] | 官方 GLM5.2 教程里的 `"c8_enable_reshape_optim":false` 不再因这个键被拒绝 [S8] |

LI C8 还要求模型走相应稀疏注意力路径：索引缓存类型为 fp8 或 int8 只是其中一个条件。实际 indexer 实例还通过 `is_sparse_li_c8_layer` 检查该层是否在模型量化配置的适用范围内；全局条件为真，也不代表每个 indexer 层都采用 C8 写入 [C45]。


## 为什么存在

indexer 的 K 缓存通过 slot 定位每个 token：`npu_scatter_nd_update_` 接收形状为 `(-1, head_dim)` 的整批 `k_li` 和 `(-1, 1)` 的整批 slot_mapping，按索引更新缓存。这里不是每个 token 发起一次 Python 算子调用。C8 还需写入独立的 scale 缓存，因此 K 和 scale 各有一次更新 [C5]。

三个分组描述符分别说明每组多长、从源数据哪里取、写到目标缓存哪里；写入算子还接收块大小，把分组与缓存位置对应起来。K 与量化 scale 使用同一组辅助信息。

优化分支读取分组字段前，会断言索引器注意力元数据非空。


`store_kv_block_metadata` 沿 slot_mapping 顺序扫描，只把**目标 slot 连续且属于同一缓存块**的相邻输入归为一组，跳过负 slot，再产出 `group_len` / `group_key_idx` / `group_key_cache_idx`。它不先排序，也不跨块合并；StoreKVBlock 按这些描述符复制数据段 [C35][C36]。例如块长为 4，slot 序列 `[2,3,4,7,-1,8,9]` 会形成 `[2,3]`、`[4]`、`[7]`、`[8,9]` 四组：3 和 4 虽然相邻，却属于不同块。分组更长才有更多成段复制机会，不能由开启开关直接保证加速。

辅助缓冲也有版本差异：旧分支在 builder 初始化时按 `max_num_batched_tokens` 申请三个 int32 数组 [C22]；固定 main 的容量为 `max(max_num_batched_tokens × PCP, 按 TP 对齐后的 max_num_batched_tokens)`，按 buffer key 首次使用时分配，每步取前「本步 slot 数」的切片 [C23][C37]。派生开关在配置构造时计算，但消费者每次查询当前配置，配置工厂支持 refresh 重建；这不等于提供了逐请求切换接口，也不能说整个进程只决定一次。

**既然默认是开的，为什么还留一个开关。** 恢复开关的 PR 明确说明，用户需要能禁用 StoreKVBlock 写入优化。关联 [issue #15896](https://github.com/vllm-project/vllm-ascend/issues/15896) 报告了 HDK 25.1 上 pooling 与自定义 AICPU Tiling 在同一进程中组合时挂起，作者随后将范围说明为 HDK 26.0 之前、不包括 26.0；这是特定环境的问题报告，不是所有开启此参数的模型都会挂起。排查相似问题时，关闭优化可作为对照；它同样可以用于速度和数值比较，不能只凭恢复开关的历史断言其唯一用途 [I]。

## 开了的代价

**在固定 main 上，开关不能越过角色条件。** `is_prefill_node` 要求 `kv_transfer_config` 非空，并满足两个角色条件之一：`kv_role` 为 `kv_producer`，或者 `is_kv_producer` 为真且 `is_kv_consumer` 为假。无 KV transfer 配置的混部部署不满足它，单把开关设为 `true` 无法启用该优化 [!]。满足模型、C8 和角色条件的 P 节点则可通过 `false` 关闭。

**跨版本搬配置，两个方向的坑不一样。**

- 拿 v0.23 / v0.26 的启动命令升到 main：键名照收，但默认值翻了——那两个分支上不写就是 `False`，main 上不写就是 `True`。想保持原行为得显式写 `false`。
- 拿 main 的期望回到 v0.23 / v0.26：那两个分支上它默认 `False`，不显式写就完全没开，而且还得先把 `enable_sparse_li_c8` 也配上 [C12]。

**教程里的这个键现在能通过配置校验。** GLM5.2 的启动行写着 `"c8_enable_reshape_optim":false`；在这个 main 快照上，`false` 和 `true` 都是字段接受的值，后者还要满足上面的派生条件才会生效。这只说明不会再因键名未知而被拒绝，不代表整条部署命令已经实测可启动；恢复开关之前的空窗期仍会拒绝这个键，照抄教程前要核对 main 的快照 [!]。

**它和 PD 的关系在两代里是两种约束。** 发布分支上「只在 P 节点开」是文档里的一句话，配错了没人拦（[v0.23 线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)）；main 上这句话被写进了代码。从「靠人遵守」变成「硬判定」，是这个参数这一年里最实质的变化。

固定 main 的分组辅助缓冲区在每次获取时都会先检查 slot 数，复用已有缓冲时也检查；超过容量就抛出 `Indexer C8 group metadata buffer is too small: capacity=..., required=....`。排查时应比较报错中的 required 与上面的容量公式，不能只看数组是否已分配。

**放到 GLM 双机：这个键在这里开不了。** 部署用的 `db701c1f` 与两个旧发布快照写法相同：实际取值 = `enable_sparse_li_c8` 且这个键，两者不写都是 `False` [C21]；官方教程两条多机命令都没写 `--additional-config` [S24]（取值汇总见[部署页 · 怎么开](../concepts/glm-5-3-flash-two-node.md#怎么开)），因此没有启用这条 C8 写入优化。即使两个键都写成 `true`，旧 GLM 后端也会在构造时抛出 `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim`：其状态缓存使用独立 slot mapping [C20]，几何关系见[块表页](../concepts/block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)。这是旧后端的明确限制，不是实测收益结论。

固定 main 与 rc2 在更早的模型判定中就排除了 kpool：`model_uses_kpool_indexer` 检测 `index_kpool`，而 `model_uses_sfa_sparse` 遇到它返回 False，所以该类模型的 LightningIndexer C8 条件不成立，这个 reshape 开关也不会生效 [C38][C39]。rc2 对 SFA 主 KV 的 C8 使用另一个包含 kpool 的判定，不能因 LI 优化不可用就推断新版 GLM 的所有 KV 量化路径都不可用 [C32]。

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

## 对照源码

- 来源 28：vllm-ascend@baa023ad，vllm_ascend/ascend_config.py，L774–L777。
- 来源 29：vllm-ascend@baa023ad，vllm_ascend/attention/indexer.py，L232–L263。

角色条件依据来源 2 的固定 main `baa023ad`、`ascend_config.py` L777–L786：KV transfer 配置非空是两条角色分支的共同前提；这是配置判定，不是实机收益验证。
