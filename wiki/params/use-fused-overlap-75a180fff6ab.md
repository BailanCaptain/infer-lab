---
id: use-fused-overlap-75a180fff6ab
title: use_fused_overlap
type: param
summary: >-
  Sparse KV Offload 的融合重叠 decode 开关，位于 sparse_kv_offload_config，默认
  false；融合路径把未命中 KV 的主机到设备搬运与 attention 计算流水化，并更新设备选择缓存。固定 main 与 rc2 都有，rc2 还与
  fused_copy_sfa 互斥，仍受硬件和执行阶段条件限制。
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
updated: 2026-11-03T00:00:00.000Z
relations:
  - to: kv-cache-sparse-offload
    kind: builds-on
    note: 它选择卸载后端的融合 decode 路径；enabled 为真才选用该后端，配置解析仍先执行
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
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
  - >-
    raw/sha256-fe2af26a94621251f96093e5a90716b5df4e857765b404015df03057b65063a0.md
---
## 一句话

**v0.30.0rc2 对照。** rc2 保留 sparse_kv_offload_config.use_fused_overlap，默认 false，decode 分支仍可调用融合 overlap offload。它与 fused_op_type=fused_copy_sfa 硬互斥，不能同时开启。纯 prefill 和 mixed batch 的非 decode 部分仍有自己的处理路径，因此这个键不能解释成整次前向都换成同一个融合核；模型、精度和 CPU pool 注册条件仍见 Sparse KV Offload 主页面。

[Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 把完整历史 KV 放在主机内存，decode 每步只使用索引器选出的部分行。固定 main 的默认路径先把未命中的行搬进 NPU 热缓冲，再算 SFA；`use_fused_overlap` 打开后，融合算子把**未命中 KV 的搬运和 attention 计算放进同一条流水**。设备上仍有 Selection KV Cache（保存选中行的缓存），未命中行仍要从主机拷入，并留下供后续步骤复用 [S49]。字段是 `bool`，默认 `false`。

**它不在 `additional_config` 顶层。** 它是 `SparseKVOffloadConfig` 的字段，真实路径是 `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`（见文末「参数定义」），必须写在 `sparse_kv_offload_config` 这个嵌套块里。固定 main 普通 vLLM 环境会拒绝顶层未知键；安装了 vLLM-Omni 时，工厂会先警告并过滤这些顶层未知键，因此写错位置也不会启用它 [C6]。

**存在范围。** 固定 main 与 rc2 有此键；此前核对的 v0.28.0rc、v0.29.0rc 分支也有。旧 v0.26 快照的 `SparseKVOffloadConfig` 是普通类，逐个 `user_config.get(...)` 读取，只认 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache` 四个键 [C19]，写上它会被静默忽略；v0.23 维护分支上整套 Sparse KV Offload 都不存在。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]` | 必须嵌在 `sparse_kv_offload_config` 块里；顶层未知键的拒绝或 Omni 过滤见上文 |
| 类型与默认 | `bool`，默认 `False` | 不写就是老路径；它和 `enabled` 是两个独立的开关 |
| 生效前提 | `AscendSFABackend` 只在 `sparse_kv_offload_config.enabled` 为真时才把 metadata builder 与 impl 换成卸载类 [C24] | 主开关关闭时不会选择融合后端，但配置工厂仍会解析嵌套字段，拼错键仍可能报错 |
| 文档入口 | 固定 main 的部署示例未列此键，原生算子的 README 另有机制和形状说明 [S17][S49] | 部署示例不是全部字段与算子约束的清单 |
| 报错信息里的名字 | `kv_offload_decode_config.use_fused_overlap=true` | 除了这两条报错字符串本身，仓里再无这个配置块名，按它去配会找不到地方写 [!] |
| decode 走哪条路 | `if self.use_fused_overlap:` 换成 `_execute_fused_overlap_offload_decode` | 分叉在注意力后端的 Impl 里，不在调度或 connector 层 |
| 同一步里有 prefill 时 | prefill 部分仍走原来的 sparse flash attention，并先 `_check_device_kv_cache_exist()` | 它只改 decode 那一半；chunked prefill 混批时两条路同时在跑 |
| TP 的分工 | 只有 `tp_rank == 0` 预热外部 LRU planner；捕获且无 prefill 时也由它用副 stream 存当前 KV | 非 0 rank 恢复共享 CPU 池的 GVA 视图；CPU 池由 rank 0 分配是整套卸载的分工，不是本开关才引入的 |
| 额外常驻对象 | 两条 NPU stream + 一块 `1 + max_num_topk_rows` 的 int32 计划元数据 | 开了就常驻，和实际有没有走到 fused 路径无关 |
| 覆盖版本 | 固定 main `baa023ad` 与 rc2 有；历史扫描 `b64b4d71` 晚于固定 main [C25]，当前自动定义取 rc2 | v0.26 静默忽略，v0.23 没有整套特性；fixed main 无融合互斥项，rc2 已有 |

融合分支按批次内容继续分流：只有 decode 时，将输出补齐到输入 token 数后返回；混有 prefill 时，算完 decode 仍需检查设备 KV cache，再处理 prefill 部分。因此，启用融合 decode 路径并没有消除混合批次对设备 KV cache 的需要。


## 为什么存在

**先分清配置解析与执行选择。** 工厂先读取并校验嵌套配置；`AscendSFABackend` 再按主开关选择普通 SFA 或卸载实现。主开关关闭时，use_fused_overlap 不会选择融合后端，并不意味着这个字段不经过解析。固定 main 有默认与 overlap 两条 decode 路径；rc2 还增加了互斥的 [Copy-SFA 路径](fused-op-type-fc0f5fcd7be0.md)。

默认 decode 路径在 top-k 选完后，先把热缓冲缺少的行 H2D 搬回 NPU，再运行常驻 SFA。overlap 路径将这两项工作合并调度。例如用三行作示意：本次选择位置 4、8、9，设备选择缓存已有 4、8，就可复用这两行，而位置 9 仍须从主机读取并写入选择缓存。后续计算使用这些 KV 行，下一步再次选中 9 时才有机会命中缓存。这里的三行只是解释命中与未命中，实际模型按自己的 TopK 和容量约束运行。

**重叠发生在算子内的 KV 分段流水，也有框架侧的计划流。** arch22 实现沿选出的 KV 维度划分任务：当前任务合并 KV 并发出就绪信号，计算核等待对应数据后做第一次矩阵乘；前一任务继续归一化及第二次矩阵乘，更早任务处理输出。选择缓存的更新也在该流水中执行。它按依赖交错各段工作，不是整层搬完之后才开始整层计算，也不意味着所有等待都消失 [C50][C55]。Python 侧还在图捕获条件下用副流提交外部 LRU 计划并广播元数据；非捕获路径在 rank 0 同步准备计划，二者不能都概括为全异步 [C51]。

**配置被读两次，落在两个对象上。** `AscendSFAKVOffloadImpl.__init__` 从 `get_ascend_config().sparse_kv_offload_config` 取一份存成 `self.use_fused_overlap` [C9]，`SparseKVOffloadManager` 在自己的构造里另取一份，两边各判各的。真正的分叉在 `AscendSFAKVOffloadImpl` 覆盖的 `_execute_sparse_flash_attention_process` 里，就是那句 `if self.use_fused_overlap:` [C10]（源码里没有 `_forward_decode` 这个名字）；manager 那边则用它决定要不要建 `current_kv_save_stream` / `fused_plan_stream` 这两条流和那块计划元数据 [C14]。

**融合路径沿用 TP 组内的主机池分工，并增加计划处理：**

- `tp_rank == 0` 负责预热外部 LRU planner 的 OpenMP 线程池——判据写成 `if not (self.use_fused_overlap and self.tp_rank == 0): return 0` [C13]；
- 存当前步 KV 时，只有 `tp_rank == 0` 且正在捕获、且这一步没有 prefill，才走副 stream [C16]；
- 其余 rank 在初始化末尾把共享 CPU 池按广播来的形状**恢复成非拥有的 GVA 视图** [C15]。

CPU 池本来就由 TP rank 0 分配，其他 rank 共享；开启融合路径后，其他 rank 还会恢复供算子读取的非拥有 CPU tensor 视图 [C54]。两个专用入口——membership map 分配与 CPU KV 输入获取——要求本开关为真，关闭时直接报错。这是接口的调用前提，不代表普通卸载没有 TP 共享池。

## 开了的代价

**报错信息会把你指向一个不存在的配置块。** 那两处 `RuntimeError` 的原话逐字是 `mapped membership allocation requires kv_offload_decode_config.use_fused_overlap=true` [C11] 和 `get_fused_overlap_cpu_kv_inputs requires kv_offload_decode_config.use_fused_overlap=true` [C12]，但除了这两条报错字符串本身，`kv_offload_decode_config` 在 `vllm_ascend/` 和 `docs/` 里再无一处 [D]。真正要写的是 `sparse_kv_offload_config`。看到这条报错别去搜那个名字 [!]。抛错的两个函数正是 fused 路径自己要用的（一个分配选择用的 membership map，一个取主机侧那份 KV 输入），所以它们是防误用的硬前提，不是「开关没开就降级」的分叉点。


membership map 的行容量还必须为正；分配入口会拒绝零或负容量。开启融合路径只是进入该分配入口的一个条件。

**文档要按快照读。** 固定 main 的 Decode 启动示例只列 enabled、topk_buffer_size、dram_size_per_dp_GB 三项；该示例的遗漏不能推成没有此功能。字段在 2026-09-07 随 [PR #14957](https://github.com/vllm-project/vllm-ascend/pull/14957) 引入，rc2 也已有；使用时仍须核对硬件、阶段及互斥条件。

**注册缓存时多建两条 stream 和一块计划元数据。** register_kv_caches 在融合分支里额外建 current_kv_save_stream、fused_plan_stream，以及一块长度为 1 + max_num_topk_rows 的 int32 张量，再从中切出状态与槽位表。它们按规划规模建立；此外，第一次准备融合选择状态时还会分配块表、驻留状态、membership map 与请求标识，不能把全部额外占用只算成这块 int32 张量。

**选择缓存也有容量和捕获时机的要求。** Python 执行路径要求单个 TopK head，并检查所需块数不超过热缓存可容纳的块数；membership map 的行容量必须为正。原生 README 还限定 token 级选择、TopK 最大 2048，并要求状态行和映射行按规定对齐。选择状态必须在图捕获前按足够容量分配，捕获时发现要重新分配会报错 [C52][C53][S49]。原生算子的产品表与数据类型表不等于整个服务支持范围：上层卸载注册仍要求 BF16 主 KV，服务的硬件门槛也仍适用。

**它不接管 prefill。** 同一步里既有 decode 又有 prefill 时，decode 走 fused 路径、prefill 那一半交回父类的同名实现（`super()._execute_sparse_flash_attention_process`），而且先要 `_check_device_kv_cache_exist()` 确认设备上还有主 KV。也就是说在 `keep_device_kv_cache=false` 的纯 decode 部署之外用它，容易撞上这道检查。

**版本切换时要重新核对键的消费位置。** 固定 main 普通环境拒绝顶层未知键，Omni 环境的顶层过滤例外见开篇；嵌套块里的拼错键仍由 SparseKVOffloadConfig 拒绝 [C4][C7]。旧 v0.26 对该键的顶层和嵌套写法均不消费，不会因此启用融合路径。正确配置在支持它的版本间迁移，并不必然要改键值。

**固定 main、历史扫描与当前参数定义各有范围。** `baa023ad` 的 `SparseKVOffloadConfig` 只有 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache` / `topk` / `use_fused_overlap` 六个字段，没有互斥键。历史扫描 `b64b4d714484feaa6ca71edc99b98318fe6d2f0d` 已多出 `fused_op_type`（默认 `none`）及派生值 `use_fused_copy_sfa`，同时启用时报 `fused_copy_sfa and use_fused_overlap are mutually exclusive` [C25]。当前自动定义来自 rc2，也保留这道互斥；不能用旧固定 main 无此检查来放行 rc2 的组合。

**GLM 双机上它开不起来，也没有重叠收益的实测数。** 主线跑的 GLM 代码线是快照 `db701c1f`，那份 `AscendConfig` 里连 `SparseKVOffloadConfig` 这个类都没有，各块配置是逐块 `additional_config.get(...)` 取的，整个 `sparse_kv_offload_config` 块写上去既不读也不报 [C26]。换到 main 也仍然开不了：这套部署（2×A2×8、TP8/DP2/EP16、W8A8，见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）要先过五道拦路条件，第一道是设备型号只放行 Atlas A3，逐条见 [Sparse KV Offload 放到 GLM 双机](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)。

**效果边界：** 原生代码证明仍有 KV 搬运、缓存更新与流水依赖；实际能遮住多少搬运时间，取决于命中率、输入规模和硬件。本页没有固定部署下两条路径的 decode 时延、实际搬运字节与显存峰值对照数据。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `SparseKVOffloadConfig.use_fused_overlap` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:1698` [C47] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.use_fused_copy_sfa and self.use_fused_overlap:
    raise ValueError('fused_copy_sfa and use_fused_overlap are mutually exclusive')
````

## 对照源码

- 来源 42：vllm-ascend@baa023ad，vllm_ascend/attention/sfa_kv_offload.py，L1035–L1060。
- 来源 43：vllm-ascend@baa023ad，vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py，L652–L667。
- 来源 49–55：原生机制与容量、arch22 分段流水、计划流、实际算子输入、选择状态分配及共享主机池。它们支持上述执行机制，不代替 NPU 性能测量。
- 来源 56：引入 PR 的目的与作者测试记录；不是本项目执行过的测试结果。
