---
id: sfa-dcp-force-tmajor-restore-6d9c266d3ece
legacyAnchors:
  一句话: 它是回退开关而非 DCP 开关：默认保留 strided view，开 true 强制连续化
  为什么存在: 为什么汇聚后需要转回 t-major，哪些路径会直接绕过本键？
  开了的代价: 额外复制量怎么算、PCP+DCP 与 kpool 边界
  额外复制量怎么算pcpdcp-与-glm-双机边界: 额外复制量怎么算、PCP+DCP 与 kpool 边界
  源码位置: 对照源码
title: sfa_dcp_force_tmajor_restore
type: param
summary: >-
  SFA-DCP 解码路径上 query gather 后的布局对照/回退开关：默认 false 保留 strided view，设 true
  在恢复视图尚不连续时强制调用 .contiguous() 还原 t-major 连续存储。v0.30.0 与 main 保留，v0.23.0 与
  v0.26.0rc 静默忽略；含 prefill 批次或开启 DSA-CP 时不生效。
origin: seed
aliases:
  - SFA DCP t-major 还原
  - 强制 t-major 连续化
  - DCP query gather 布局回退
  - additional_config.sfa_dcp_force_tmajor_restore
  - sfa_dcp_force_tmajor_restore
  - t-major
chapters:
  - '15'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: context-parallel
    kind: builds-on
    note: 只有 decode_context_parallel_size > 1 且模型走 SFA 稀疏注意力时才有实现类读它，DCP 怎么切 KV 在那一页
  - to: attention-backend-family
    kind: builds-on
    note: >-
      读它的是 SFA 后端的 DCP 子类 AscendSFADCPImpl，后端怎么按 (use_mla, use_sparse,
      use_compress) 选出来在那一页
  - to: ascend-config-system
    kind: builds-on
    note: 与同批的 enable_dsa_cp 不同，这个读取函数没有 lru_cache，每次走到都现读一次配置单例
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L466'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L466
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1500-L1506'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1428-L1438
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1145-L1157
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1264-L1305
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1366-L1412
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1307-L1320
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1159-L1172
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L375-L399
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L1468-L1470'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1575-L1590
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L201-L208'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L334'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L477
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L492
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L575
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L177-L198'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L114-L122'
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L573
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L582
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L569
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L579
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L581
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L582
  - >-
    raw:sha256-82b2df2d49b72715d6ff0d6303643980e196c0f1d2cb5ac2a61d449239c63127.md#L1-L374
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L586
  - >-
    raw:sha256-9ebc800712b6dfb733f1b59efc57573fe130fbde7ae3b1acbd72a7cdd626c073.md#L1-L378
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/context_parallel/sfa_cp.py#L1151-L1157
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/context_parallel/sfa_cp.py#L1428-L1437
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L584
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L581-L585'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1599-L1605'
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/sfa_cp.py#L1852-L1863
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L582
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L196-L217'
  - 'https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.contiguous.html'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1467-L1488
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1689-L1709'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/triton/query_gather_prep.py#L95-L193'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1087-L1089
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1553-L1554
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/utils.py#L17-L26'
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/sfa_cp.py#L1464-L1475
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L587
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L579
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L575-L583'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1676-L1683'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/attention/context_parallel/sfa_cp.py#L1943-L1954
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L196-L218'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L668-L675'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1658-L1665'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/attention/context_parallel/sfa_cp.py#L959-L979
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/attention/context_parallel/sfa_cp.py#L630-L645
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-51e611497c9eecbfabb126c18f4a3c5701ecdb013863366e1817a73ffe118f38.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-82b2df2d49b72715d6ff0d6303643980e196c0f1d2cb5ac2a61d449239c63127.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
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
---
## 它是回退开关而非 DCP 开关：默认保留 strided view，开 true 强制连续化

**跨多张卡切分历史 KV 并拼回查询头之后，默认只改张量的维度步长（读法重排）而不搬动底层内存；`sfa_dcp_force_tmajor_restore` 设为 `true` 时，才会在恢复视图尚不连续时强制排出一份连续内存。**

它是 `--additional-config` 顶层的布局对照与回退开关（`bool`，默认 `False`，`v0.30.0` 与 `main` 可用），**不是**开启 DCP（decode context parallel，解码期上下文并行；分卡原理见[上下文并行](../concepts/context-parallel.md#历史位置怎么分着存)）的主开关。常规线上服务保持默认 `false` 即可；只有当你在支持 `LightningIndexer` 的 [SFA（稀疏注意力）](../concepts/sparse-attention.md) 模型（如 DeepSeek-V3.2）上启用 `--decode-context-parallel-size > 1`，需要排查纯 Decode 步跨步视图（strided view）是否引起精度偏差或算子退化时，才临时设为 `true` 做对照实验（以下仅展示配置形式，本工作区无 NPU 实机执行验证）：

```bash
vllm serve /models/DeepSeek-V3.2 \
  --tensor-parallel-size 8 \
  --decode-context-parallel-size 2 \
  --additional-config '{"sfa_dcp_force_tmajor_restore": true}'
```

在 SFA-DCP 的纯 Decode 查询汇聚路径中，通信接收缓冲以头为第一维（head-major），而下游注意力计算要求以 token 为第一维（t-major，`[T, H, D]`）。收回后的恢复逻辑分两条分支：

- **默认 `false`（视图路径）**：消费处令 `keep_view = not enable_sfa_dcp_force_tmajor_restore()`，只做 `permute` 生成共享底层存储的跨步视图（单 token 等退化形状下天然连续），随后直接交给 `torch.split` 拆出 `ql_nope` 与带旋转位置分量的 `q_pe`，全程不复制元素。
- **设为 `true`（连续化对照路径）**：`keep_view=False`，在 `restore_perm` 非空时紧跟 `.contiguous()`。按 PyTorch 契约，**只有 `permute` 后视图尚不连续时才会分配并重排复制数据**；若视图已连续，`.contiguous()` 直接返回原张量。

引入本键的 PR #15970 指出：`torch.split` 沿最后一维拆出的两个查询子张量原本就是跨步视图，旧实现的 `permute + contiguous` 只是顺带物化了外层 `[T, H, D]` 缓冲；将该次物化改为可选开关，便于隔离排查布局影响。

**版本范围**：`v0.23.0` 与 `v0.26.0rc` 均无此键，旧 [AscendConfig](../concepts/ascend-config-system.md) 逐键 `.get()` 静默忽略。`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）保留此键（默认 `False`，拼错键名在未装 `vllm_omni` 时直接报错）；`main` 在 `kv_cache[0]` 为 `int8`/`fp8` 量化类型时新增 `_finish_dcp_packed_gather` 分支，与非量化 `_finish_dcp_gather` 同样读取本开关控制恢复布局。

## 事实表

做 SFA-DCP 布局排障或对照实验前，先核对以下生效前提与绕过边界：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["sfa_dcp_force_tmajor_restore"]`（`bool = False`） | 默认省去 query gather 后的 `.contiguous()` 拷贝；设 `true` 强制恢复连续 t-major 存储 |
| 生效模型与并行条件 | 须命中 `AscendSFADCPImpl`（非 kpool 的 SFA 稀疏模型 + `DCP > 1`） | 普通稠密/GQA 模型（如 `Qwen3-8B`）、`DCP=1` 或带 `index_kpool` 的稀疏模型均不会读取本键 |
| 批次阶段限制 | 仅纯 Decode 步（`_has_prefill` 为假）进入该分支 | 混入 prefill 的批次走「汇聚完整 KV、query 留本地」路径并写死 `.contiguous()`，本键不参与 |
| 与 `enable_dsa_cp` 关系 | 开启 DSA-CP 时沿第 0 维汇聚（`restore_perm = None`），自动跳过本键 | 同时开 DSA-CP 时设 `true` 也不会执行 `permute` 或 `.contiguous()`，且无冲突告警 |
| 实际复制触发条件 | 仅当 `permute` 后视图非连续（如多 token `T > 1`）时分配并复制 $T \times G \times H \times D$ 元素 | 单 token（`T = 1`）等已连续形状下，`.contiguous()` 直接返回原张量、零额外拷贝 |
| 版本可用性 | `v0.30.0`、`v0.30.0rc2`、`main` 支持；`v0.23.0`、`v0.26.0rc` 静默忽略 | `main` 新增量化 KV 的 `_finish_dcp_packed_gather` 分支，同样受本开关控制 |

## 为什么汇聚后需要转回 t-major，哪些路径会直接绕过本键？

普通 DCP 把 KV cache 沿序列维交错切给组内各卡。各卡先算本地 KV 分片的注意力，再按对数求和指数（LSE）合并结果，期间需要在组内汇聚查询的头维（第 1 维）分片。因为这里的异步 `All-Gather` 辅助函数约定沿第 0 维扩展接收缓冲，发送前要先将查询重排成 head-major，收回后再 `permute` 转回 t-major。

发送准备阶段，当输入位于 NPU 且按头维汇聚时，代码优先调用 Triton 融合算子 `prep_query_head_major` 把 `ql_nope` 与 `q_pe` 一次拼成连续的 head-major 缓冲。遇到空输入、地址不满足快路径条件或运行异常时，会退回 PyTorch 拼装（但若两段输入本身的形状或 dtype 失配，会在进入快路径前直接报错）。

```wiki-diagram
file: param-sfa-dcp-force-tmajor
```

收回后的 `_finish_dcp_gather`（及 `main` 的 `_finish_dcp_packed_gather`）是本键的消费位置（开关只管等待结束后的本地布局，不改变通信量）：

```python
gathered = context.gathered
if context.restore_perm is not None:
    gathered = gathered.permute(context.restore_perm)
    if not keep_view:
        gathered = gathered.contiguous()   # ← 本键为 true 时走这里
return torch.split(gathered, context.split_sizes, dim=-1)
```

`permute` 只改视图元数据而不搬动底层内存；下游算子在不同步长下的实际快慢仍须在设备上实测。

**以下三类运行时路径会直接绕过本键，写了 `true` 也不会进入这段分支（且无告警）**：

| 运行时绕过情形 | 底层原因 | 实际表现 |
| --- | --- | --- |
| **1. 前端未选中 `AscendSFADCPImpl`** | `resolve_sfa_impl` 要求模型走非 `kpool` 的 SFA 稀疏注意力且 `decode_context_parallel_size > 1` | 根本不会实例化读取本键的 DCP 类 |
| **2. 批次混入 prefill** | `_execute_sparse_flash_attention_process` 检测到 `_has_prefill` 为真时，改走「汇聚完整 KV、查询留本地」分支并提前返回 | 该分支写死 `.contiguous()`；开启分块预填充时仅纯 Decode 步受本键控制 |
| **3. 同时开启 `enable_dsa_cp`（DSA-CP）** | `AscendSFADSADCPImpl` 按继承链采用 `AscendSFADSACPImpl` 的 `_parallel_query_gather_dim == 0`（沿 token 维汇聚） | `dim == 0` 令 `restore_perm = None`，跳过整段 `permute` 与 `.contiguous()` |

此外，在配置读取方式上，与同批带 `lru_cache(maxsize=1)` 的 `enable_dsa_cp`、`enable_pcp_o_proj_weight_sharding` 不同，`enable_sfa_dcp_force_tmajor_restore()` 每次调用都现读配置单例；但这只用于测试或配置工厂 `refresh` 重建，并不提供运行期热更新或重录图的在线接口。

## 额外复制量怎么算、PCP+DCP 与 kpool 边界

- **真实复制只发生在恢复视图非连续时**：普通 DCP 头维汇聚中，设汇聚前本地查询形状为 `[T, H, D]`（`D` 为两段查询宽度之和）、汇聚组大小为 `G`，恢复后形状为 `[T, G×H, D]`。只有 `T > 1` 等使 `permute` 后步长不再连续的情形，`.contiguous()` 才会分配并复制 $T \times G \times H \times D$ 个元素：

| 示意情形（`H = 2, D = 3, G = 2`） | head-major 形状 / 步长 | `permute` 后形状 / 步长 | 设 `true` 时 `.contiguous()` 行为 |
| --- | --- | --- | --- |
| 一般多 token（`T = 2`） | `[4, 2, 3]` / `[6, 3, 1]` | `[2, 4, 3]` / `[3, 6, 1]`（非连续） | 分配并重排复制 `24` 个元素 |
| 退化单 token（`T = 1`） | `[4, 1, 3]` / `[3, 3, 1]` | `[1, 4, 3]`（已连续） | 直接返回原张量，**不发生复制** |

  以上为形状与步长演算，实际端到端耗时与显存变化仍须在相同模型、DCP 规模和批次下对比测量。
- **PCP + DCP 组合需按实际汇聚分支核形状**：在 PCP + DCP 组合子类中，若 `DCP == PCP` 则直接使用本地 head-major 张量而不发起此次查询汇聚，否则沿对应 TP 组汇聚；恢复步骤虽仍经过本键，但元素数须按该分支实际得到的张量维度计算，不能盲套 `G = DCP`。
- **`index_kpool` 稀疏模型的通用排除边界**：在 `v0.30.0` 与 `main` 中，`model_uses_sfa_sparse` 开头即排除带 `index_kpool` 压缩池的稀疏模型（其独立后端注册见[注意力后端家族](../concepts/attention-backend-family.md#一个稀疏-mla-层其实注册了三个条目)），因此即便在这类模型上开启 `DCP > 1`，也不会进入本键所在的 `LightningIndexer` SFA-DCP 分支；历史双机部署的 `PCP = DCP = 1` 前提见[固定双机部署的参数后果](../concepts/glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)。

## 对照源码

下表对照 `sfa_dcp_force_tmajor_restore` 在四个固定版本快照中的字段、读取方式与 SFA-DCP 消费分支：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 顶层键与读取函数 | 不存在（逐键 `.get()` 静默忽略）[C17] | 不存在（逐键 `.get()` 静默忽略）[C16] | 存在，`bool = False`，读取函数无 `lru_cache` [C53][C54] | 同 `v0.30.0` [C57][C58] |
| 消费分支 | — | — | `AscendSFADCPImpl._execute_sparse_flash_attention_process` 单处调 `_finish_dcp_gather(..., keep_view=not ...)` [C55] | 量化 KV（int8/fp8）调 `_finish_dcp_packed_gather`，其余调 `_finish_dcp_gather`，均传入 `keep_view=not ...` [C59] |
| 绕过条件（prefill / DSA-CP / kpool） | — | — | 含 prefill 走 KV-gather 提前返回；DSA-CP `dim=0` 令 `restore_perm=None` 跳过；`model_uses_sfa_sparse` 排除 `index_kpool` [C56][!] | 同 `v0.30.0` [C60] |

- **历史引入、fast path 与继承链推导**：本键由 PR #15970 引入（`baa023ad` 完整走读见来源 1–14、34–35），其中 `_finish_dcp_gather` 仅在句柄非空时 `wait` 且 `restore_perm` 非空时才调用 `.contiguous()`（来源 5、8、9）、Triton `prep_query_head_major` 的快路径与回退边界（来源 6、45）、普通 DCP helper 与 PCP+DCP 不同汇聚范围（来源 43、48）以及配置工厂刷新单例（来源 44）；`AscendSFADSADCPImpl` 经 MRO 继承 `dim=0` 导致 DSA-CP 下本键失效为结合继承链推导 [D][!]；`.contiguous()` 在张量已连续时直接返回原张量依据 PyTorch 官方 API 契约（来源 42）[S42]。
- **未知键处理与旧镜像**：`v0.30.0` / `main` 严格校验未知键，仅可发现 `vllm_omni` 时告警过滤见来源 24、50；`db701c1f` 的 `model_uses_sfa_sparse` 见来源 22；`T=2` vs `T=1` 步长与元素数计算为静态推导 [D]。
- **待核**：尚缺同模型、同 DCP 组大小、同批次下 `false` 与 `true` 两种布局的真实设备输出、时延、吞吐与峰值显存对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.sfa_dcp_force_tmajor_restore` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["sfa_dcp_force_tmajor_restore"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:579` [C52] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
