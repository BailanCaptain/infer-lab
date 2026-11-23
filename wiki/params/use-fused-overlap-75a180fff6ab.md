---
id: use-fused-overlap-75a180fff6ab
title: use_fused_overlap
type: param
summary: >-
  Sparse KV Offload 的融合重叠 decode 开关，位于 additional_config.sparse_kv_offload_config，默认
  false；开启后把未命中 KV 的 H2D 搬运与 SFA 注意力计算放进同一流水线，并更新设备侧选择缓存。v0.23/v0.26 无此键，v0.30.0
  与 main 上开启时自动切离默认的 Copy-SFA 路径。
aliases:
  - use_fused_overlap
  - sparse_kv_offload_config.use_fused_overlap
  - 融合重叠 decode
  - npu_fused_sparse_attention_overlap
  - fused_overlap decode
legacyAnchors:
  一句话: 它控制哪条 decode 路径，和 Copy-SFA 是什么关系？
  事实表: 它控制哪条 decode 路径，和 Copy-SFA 是什么关系？
  为什么存在: 分段流水、TP 分工与对象常驻开销
  开了的代价: 报错陷阱、容量边界与版本演进
chapters:
  - '11'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: kv-cache-sparse-offload
    kind: builds-on
    note: 它选择卸载后端的融合 decode 路径；enabled 为真才选用该后端，配置解析仍先执行
  - to: ascend-config-system
    kind: builds-on
    note: 该开关嵌在 additional_config.sparse_kv_offload_config 下，误写顶层与嵌套拼错遵循 AscendConfig 校验规则
  - to: sparse-attention
    kind: builds-on
    note: 融合重叠路径面向稀疏注意力（SFA）的 TopK≤2048 token 级解码选择，与普通全注意力后端无关
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1478'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1478
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1467-L1486'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1488-L1496'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1605-L1607'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1678'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L31-L50'
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
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L284-L309'
  - >-
    vllm-ascend@b64b4d714484feaa6ca71edc99b98318fe6d2f0d:vllm_ascend/ascend_config.py#L1621-L1646
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L332'
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1627
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L1692
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L1668
  - >-
    vllm-ascend@8194eceae4a86366bea75309baa22fea4993da8a:vllm_ascend/ascend_config.py#L1672
  - >-
    vllm-ascend@9df31e4e63333c9dece50e5336c6966062b4e806:vllm_ascend/ascend_config.py#L1673
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L1682
  - >-
    vllm-ascend@f978348e9045fb045a4281d189339ef2ca1f1a45:vllm_ascend/ascend_config.py#L1684
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L1685
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L1695
  - >-
    vllm-ascend@128f35ed1461ecb34bc8b87583a67a66bc4bd1d6:vllm_ascend/ascend_config.py#L1698
  - >-
    vllm-ascend@25e376b3c7821ddf894e2a05a4e29ef019db94ad:vllm_ascend/ascend_config.py#L1707
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L1705
  - >-
    vllm-ascend@e8a6393dda93e085cd8210011c6ec12027acb8a0:vllm_ascend/ascend_config.py#L1703
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L1707
  - >-
    raw:sha256-e673ff8c635e462d628d1a511f9f6427283d9cd2efbf5252c398dd41b32b018b.md#L1-L343
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1060
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L652-L667
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L1657
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1693-L1716'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/sfa_kv_offload.py#L1625-L1674'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L1698
  - >-
    vllm-ascend@921ccc52c6d8c9864190b981792318a489aeadf4:vllm_ascend/ascend_config.py#L1667
  - >-
    vllm-ascend@baa023ad:csrc/attention/fused_sparse_attention_overlap/README.md#L14-L192
  - >-
    vllm-ascend@baa023ad:csrc/attention/fused_sparse_attention_overlap/op_kernel/arch22/fused_sparse_attention_overlap_kernel_mla.h#L795-L907
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1338-L1477
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L865-L999'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L500-L582'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L473-L554
  - >-
    vllm-ascend@baa023ad:csrc/attention/fused_sparse_attention_overlap/op_kernel/arch22/fused_sparse_attention_overlap_service_vector_mla.h#L2493-L2683
  - 'https://github.com/vllm-project/vllm-ascend/pull/14957'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L1670
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L1695
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1684-L1708'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/sfa_kv_offload.py#L535-L545'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L658-L665
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L718-L725
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1775-L1805'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L686-L693
rawSources:
  - >-
    raw/sha256-1a21571011dc2c27f03bfdbdc8f176aede00683bea89eba8fb984adc97bc1c50.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1c59da4df8253b1864559c402edec81f81a87abece768a351f9febe5ec199eb7.md
  - >-
    raw/sha256-1fb4cbc8b649883d82379cdf2ec64a7e4ac0869acc0871371595b3bf1a7c8ce8.md
  - >-
    raw/sha256-233178675e07b68d1764045d4ad6269d760d2da052af9f453da011f3c89e19a6.md
  - >-
    raw/sha256-30bfc68d9d6c6cd14e897e08621272fd2703c84fe763ca84d30ff0df03a62926.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-487944627d866213f1a7080123d1b06364fdfd1236bf863485d634bc276f95bc.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-a1e07458f4f0725bc3e24a2c5bebdf8172180f4ba17cb41d513abef524ca22b8.md
  - >-
    raw/sha256-b0bf7c9b015725026d74fecb76f426e986e63df102a902ae4c3026d7e546bd7d.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bbd4aafed4525034dfeffe1cc220567af4ff1a228edb1620d650c2bf595040b1.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-bfacc19702472408b9807eb9cbb7828d3e09d484fa40fe4128d3fa847cc446fa.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ca9a84111a41a3b9f040cdb3251cd2b13e2c00cf22725addb31dac226c9bc3b0.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
  - >-
    raw/sha256-fe2af26a94621251f96093e5a90716b5df4e857765b404015df03057b65063a0.md
---
## 它控制哪条 decode 路径，和 Copy-SFA 是什么关系？

[Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 把完整历史 KV 保存在主机内存，decode 每步只取索引器选出的部分行。默认路径 **Copy-SFA** 按设备侧元数据自动分两路：首次填充在同一 kernel 内先按请求级 `miss_*` 清单拷贝缺失行并核内同步，再执行只访问 HBM 的注意力；**稳态路径已在算子内部融合读取 `topk_src_ids`、分段搬运每路 Query 的 Miss KV 与注意力计算**。把 `use_fused_overlap`（`bool`，默认 `false`）打开后，则切入 **arch22 多流 / 双缓冲融合重叠路径**，将未命中 KV 的主机到设备（H2D）搬运、[稀疏注意力（SFA）](../concepts/sparse-attention.md)计算和设备侧 Selection KV Cache（保存选中行的缓存）更新排入分段重叠流水，供后续步骤直接命中复用。

以三行选择作概念示意：本步选中位置 `4, 8, 9`，设备选择缓存已有 `4, 8` 可直接复用，位置 `9` 仍须从主机拷入并写入选择缓存，供本步计算及下一步命中复用（三行仅为概念示意，实际按模型 TopK 与容量约束运行）。

**配置位置与生效边界**：
- **必须在嵌套块内，不能写顶层**：完整路径是 `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`。在普通 vLLM-Ascend 环境中误写到顶层会被 [AscendConfig](../concepts/ascend-config-system.md) 的未知键校验拒收；若进程装有 `vllm_omni`，工厂会先打告警再过滤未知顶层键，同样不会启用它。
- **校验先于后端切换**：工厂总是先校验嵌套块（嵌套内拼错键照样报错）；而 `AscendSFABackend` 只有在主开关 `sparse_kv_offload_config.enabled` 为真时，才会把 metadata builder 与 impl 换成卸载实现。

| 关键项 | 运行时行为 | 说明 |
| --- | --- | --- |
| 真实路径与默认 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`，`bool = False` | 与主开关 `enabled` 独立；嵌套块里拼错键会被 `SparseKVOffloadConfig` 拒绝 |
| 与 Copy-SFA 的关系 | `v0.30.0` 与 `main` 上 `use_fused_copy_sfa` 是只读派生属性 `enabled and not use_fused_overlap` | 开 `use_fused_overlap` 即切离默认 Copy-SFA 路径；过渡期 `v0.30.0rc2` / `b64b4d71` 曾设独立 `fused_op_type` 字段并与之硬互斥（见 [Copy-SFA 路径](fused-op-type-fc0f5fcd7be0.md)） |
| decode / prefill 分叉 | 在 `AscendSFAKVOffloadImpl._execute_sparse_flash_attention_process` 中仅把 decode 分叉到 `_execute_fused_overlap_offload_decode` | 不改调度或 connector 层；纯 decode 补齐到输入 token 数后返回，含 prefill 的混批在算完 decode 后仍须先执行 `_check_device_kv_cache_exist()` 再把 prefill 交回父类 SFA |
| 版本支持 | `v0.23.0` 无整套特性；`v0.26.0rc` 静默忽略此键；`v0.30.0` 与 `main` 均支持 | `v0.26.0rc` 的 `SparseKVOffloadConfig` 只 `.get()` 四个旧键（`enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache`），不识别本键 |

## 分段流水、TP 分工与对象常驻开销

```wiki-diagram
file: param-use-fused-overlap-pipeline
```

**重叠同时发生在算子内部与框架侧计划流**：
- **arch22 原生算子内部**：任务沿选出的 KV 维度分段推进——当前段合并 KV 并发出就绪信号，计算核等待就绪后执行第一次矩阵乘；前一段同步推进归一化与第二次矩阵乘，更早段处理输出，选择缓存更新也嵌在流水中。它是按依赖交错的流水线而非整层搬完再整层算，但也并不消除所有等待。
- **Python 框架侧计划流**：图捕获条件下用副流提交外部 LRU 计划并广播元数据；非捕获路径则在 rank 0 同步准备计划，不能把两者都概括为全异步。

**配置被两处各自读取并带来常驻对象**：`AscendSFAKVOffloadImpl.__init__` 决定 decode 是否进入 `_execute_fused_overlap_offload_decode`（源码中没有 `_forward_decode` 这个入口名）；`SparseKVOffloadManager.__init__` 与 `register_kv_caches` 则据此建立额外常驻资源与 TP 分工：

| 维度 | 具体分配与职责 | 关键边界 |
| --- | --- | --- |
| 常驻 NPU stream 与计划张量 | `current_kv_save_stream`、`fused_plan_stream`，以及一块长度为 `1 + max_num_topk_rows` 的 int32 计划张量（再切出状态与槽位表） | 只要开启即常驻，无论实际前向是否走到融合分支 |
| 首次融合选择状态分配 | 块表、驻留状态、membership map 与请求标识 | 不能把全部额外占用只算成那块 int32 计划张量；须在图捕获前按足够容量分配 |
| `tp_rank == 0` 职责 | 沿用主机 CPU 池分配（本就由 rank 0 分配、其余共享），并额外预热外部 LRU planner 的 OpenMP 线程池（判据 `if not (self.use_fused_overlap and self.tp_rank == 0): return 0`）；在「`tp_rank == 0` + 正在捕获 + 本步无 prefill」三条件齐备时用副流保存当前步 KV | 主机池共享并非本开关首次引入 |
| 其他 TP rank 职责 | 在初始化末尾按广播形状恢复共享 CPU 池的非拥有 GVA 视图 | 供融合算子直接读取主机 KV |

## 报错陷阱、容量边界与版本演进

- **报错字符串指向不存在的配置块名**：membership map 分配与获取主机侧 CPU KV 输入两个专用入口都将 `use_fused_overlap` 作为硬前提（关闭即报错，不静默降级）。但两条报错原文至今仍写着：
  - `mapped membership allocation requires kv_offload_decode_config.use_fused_overlap=true`
  - `get_fused_overlap_cpu_kv_inputs requires kv_offload_decode_config.use_fused_overlap=true`
  除这两条字符串本身外，全仓并不存在 `kv_offload_decode_config` 配置块——真正该写的是 `sparse_kv_offload_config`。此外，membership map 行容量必须为正，零或负容量会被分配入口直接拒绝。
- **选择缓存容量、图捕获时机与上层前提**：Python 执行路径要求单个 TopK head，并检查所需块数不超过热缓存容量；原生算子 README 限定 token 级选择、TopK 最大 `2048`，并要求状态行与映射行按规定对齐。选择状态必须在图捕获前按足够容量分配，捕获期间触发重新分配会直接报错。同时，原生算子的产品与数据类型表不能替代整套服务的支持范围：上层卸载注册仍要求 BF16 主 KV，硬件门槛（如不支持 950PR/950DT 以及历史只放行 Atlas A3 的检查）依然生效。
- **不接管 prefill、慎配 `keep_device_kv_cache=false`**：混批（如 chunked prefill）时只有 decode 走融合路径，prefill 部分交回父类 `super()._execute_sparse_flash_attention_process`，并先调用 `_check_device_kv_cache_exist()` 确认设备主 KV 仍在。非纯 decode 场景同时关闭 `keep_device_kv_cache` 容易撞上这道检查。
- **版本演进与文档示例注意**：该字段于 2026-09-07 随 [PR #14957](https://github.com/vllm-project/vllm-ascend/pull/14957) 引入，早先的 Decode 启动示例只列了 `enabled`、`topk_buffer_size`、`dram_size_per_dp_GB` 三项，不能据此误判没有本键（参考[官方指南](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html)与原生算子 README）。各阶段演进如下：

| 版本 / 快照 | 与 Copy-SFA 关系及配置变化 |
| --- | --- |
| 早期 `baa023ad` | 已有 `use_fused_overlap`，尚未引入 Copy-SFA 互斥项 |
| 过渡快照 `b64b4d71` / `v0.30.0rc2` | 引入 `fused_op_type`，同时启用 `fused_copy_sfa` 与 `use_fused_overlap` 直接报错 |
| `v0.30.0`（`c09d3e20`） | 简化移除 `fused_op_type`，`use_fused_copy_sfa` 改为只读属性 `self.enabled and not self.use_fused_overlap` |
| `main`（`8d6180e2`） | 同 `v0.30.0`，另新增 `store_port_base`（默认 `8500`）用于多服务隔离 MemFabric 端口 |

- **放到 GLM 双机（`db701c1f` 固定基线）与效果边界**：GLM 双机固定快照 `db701c1f` 连 `SparseKVOffloadConfig` 类都没有，写进 `additional_config` 只会被忽略。即使换到 `v0.30.0` 或 `main`，该双机部署（2×A2×8、TP8/DP2/EP16、W8A8，见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）仍过不了硬件等前置门槛（详见 [Sparse KV Offload 的 GLM 双机分析](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。效果上，原生实现仍存在 KV 搬运、缓存更新与流水依赖，实际能隐藏多少搬运耗时取决于命中率、输入规模与硬件，本页无固定部署下的时延、搬运字节与峰值显存对照实测。

## 对照源码

下表汇总 `sparse_kv_offload_config.use_fused_overlap` 在四个基线版本的字段与 Copy-SFA 关系对照，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段存在与默认 | 无整套 Sparse KV Offload | 类仅读 4 个旧键，静默忽略本键 [C19] | `SparseKVOffloadConfig.use_fused_overlap: bool = False` [C59] | 同 `v0.30.0`（另增 `store_port_base=8500`）[C63] | 必须写在 `sparse_kv_offload_config` 嵌套块内 |
| 与 Copy-SFA 关系 | — | — | `@property use_fused_copy_sfa = enabled and not use_fused_overlap` [C59] | 同 `v0.30.0` [C63] | 过渡期 `rc2` 的 `fused_op_type` 互斥已收拢为二选一属性 [D] |
| 报错配置块名 | — | — | 仍写 `kv_offload_decode_config.use_fused_overlap=true` [C61] | 同 `v0.30.0` [C64] | 全仓无此块名，配置仍须写 `sparse_kv_offload_config` [!] |
| 顶层误写处理 | 忽略 | 忽略 | 普通环境拒收，`vllm_omni` 告警过滤 | 同 `v0.30.0` | 嵌套拼错键始终被 `SparseKVOffloadConfig` 拒绝 |

- **配置与演化锚点**：`v0.30.0` 定义与派生属性见 `c09d3e20:ascend_config.py#L1684-L1708`（来源 58–59）及 `sfa_kv_offload.py#L535-L545`（来源 60）[C60]；`main` 见 `8d6180e2:ascend_config.py#L1775-L1805`（来源 63）。历史快照演进（`baa023ad`、`b64b4d71`、`7d825229` 与 `db701c1f`）见来源 1–7、25–26、45–47；部署文档示例见 `layerwise_and_sparse_kv_cache_offloading.md#L219-L238`（来源 17–18）[S17]。
- **执行分叉、分段流水与 TP 共享池**：后端选择见 `sfa_v1.py#L284-L309`（来源 24）；decode 分叉、混批 prefill 回退、选择状态分配见 `sfa_kv_offload.py#L202-L205, #L500-L582, #L865-L999, #L1035-L1060`（来源 8–10、42、52–53）；manager 双流、计划流、TP rank 0 预热与非拥有 GVA 视图见 `sparse_kv_offload_manager.py#L473-L559, #L650-L667, #L714-L788, #L851-L855, #L1090-L1093, #L1338-L1477`（来源 11–16、43、51、54；`c09d3e20` 报错见来源 61–62，`8d6180e2` 见来源 64）[C51]。
- **原生算子流水与容量约束**：README 与 arch22 kernel/service 实现见 `csrc/attention/fused_sparse_attention_overlap/README.md#L14-L192`（来源 49）[S49]、`fused_sparse_attention_overlap_kernel_mla.h#L795-L907`（来源 50）[C50] 与 `fused_sparse_attention_overlap_service_vector_mla.h#L2493-L2683`（来源 55）；引入记录见 PR #14957（来源 56，作者测试记录非本项目实测）[D]。
- **待核**：缺固定部署下开启与关闭 `use_fused_overlap` 的 decode 时延、实际 H2D 搬运字节与显存峰值实机对照 [!] 。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `SparseKVOffloadConfig.use_fused_overlap` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]` |
| 所属类 | `SparseKVOffloadConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:1695` [C58] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
