---
id: sfa-dcp-force-tmajor-restore-6d9c266d3ece
legacyAnchors:
  一句话: 它是回退开关而非 DCP 开关：默认保留 strided view，开 true 强制连续化
  为什么存在: 为什么汇聚后需要转回 t-major，哪些路径会直接绕过本键？
  开了的代价: 额外复制量怎么算、PCP+DCP 与 GLM 双机边界
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

`sfa_dcp_force_tmajor_restore` 是 `--additional-config` 顶层的**张量布局对照 / 回退开关**（`bool`，默认 `False`，`v0.30.0` 与 `main` 可用），**不是**开启 DCP（decode context parallel，解码期上下文并行；历史位置如何分卡存储见[上下文并行](../concepts/context-parallel.md#历史位置怎么分着存)）的主开关。常规线上服务**保持默认 `false` 不要改动**；只有当你在支持 LightningIndexer 的 [SFA（稀疏注意力）](../concepts/sparse-attention.md) 模型（如 DeepSeek-V3.2，不含普通稠密 `Qwen3-8B` 或带 `index_kpool` 的 GLM）上启用 `--decode-context-parallel-size > 1`，需要排查纯 Decode 阶段跨步张量视图（strided view）是否引发精度偏差或 kernel 退化时，才临时设为 `true` 做对照实验（以下仅展示配置形式，本工作区无 NPU 实机执行验证）：

```bash
vllm serve /models/DeepSeek-V3.2 \
  --tensor-parallel-size 8 \
  --decode-context-parallel-size 2 \
  --additional-config '{"sfa_dcp_force_tmajor_restore": true}'
```

先抓一句话物理直觉：**跨多张卡切分历史 KV 时，拼回查询头之后默认只改维度步长（视图重排）而不真正搬动内存；只有怀疑这种非连续视图在特定算子上引起精度或性能异常时，才打开本开关强制重排出一份连续内存做对照。**

在 SFA-DCP 的普通解码 query 汇聚路径中，通信缓冲以 head 为第一维（head-major），而注意力计算要求以 token 为第一维（t-major，`[T, H, D]`）。汇聚收回后转回 t-major 有两条分支：

- **默认 `false`（优化路径）**：消费处将开关取反传入 `keep_view = not enable_sfa_dcp_force_tmajor_restore()`，只做 `permute` 得到共享原存储的 strided view（通常为带跨步的非连续张量视图；单 token 等退化形状下步长天然连续），直接交给 `torch.split` 拆成不带旋转位置分量的 `ql_nope` 与带旋转分量的 `q_pe`，两步均不复制数据。
- **设为 `true`（对照 / 回退路径）**：`keep_view=False`，在 `restore_perm` 非空时紧跟一次 `.contiguous()`，要求恢复后的整体张量以 `[T, H, D]` 连续存储。按 PyTorch 契约，**只有恢复视图尚不连续时才会真正分配并复制数据**；若视图本来已连续，`.contiguous()` 直接返回原张量。

引入它的 PR #15970（2026-09-16，“Optimize the DCP decode query-gather layout path”）指出：交给 `npu_sparse_flash_attention` 的 query 片段经 `torch.split` 沿最后一维切分后本身即为带跨步视图（即使整块缓冲连续，沿最后一维拆分后的子张量也不连续），旧写法的 `permute + contiguous` 只是顺带物化了底层 t-major 存储；本开关把那次物化保留为可选项，专供精度或性能对照实验。

**版本存在范围**：`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 均无此键、`enable_sfa_dcp_force_tmajor_restore()` 及 `ops/triton/query_gather_prep.py`，旧 [AscendConfig](../concepts/ascend-config-system.md) 逐键 `.get()` 静默忽略。`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）均保留此键（默认 `False`），且 `AscendConfig` 示例 docstring 收录了它（`main` 在 `kv_cache[0]` 为 `int8`/`fp8` 量化类型时改走 `_finish_dcp_packed_gather`，其余走 `_finish_dcp_gather`，两条分支都继续传入 `keep_view=not enable_sfa_dcp_force_tmajor_restore()`）；拼写错误在两版会被严格校验拒收（仅可发现 `vllm_omni` 时告警过滤未知顶层键）。

## 事实表

做 SFA-DCP 布局排障或对照实验前，先核对以下生效前提与绕过边界：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["sfa_dcp_force_tmajor_restore"]`（`bool = False`） | 默认省去 query gather 后的 `.contiguous()` 拷贝；设 `true` 强制恢复连续 t-major 存储 |
| 生效模型与并行条件 | 须命中 `AscendSFADCPImpl`（非 kpool 的 SFA 稀疏模型 + `DCP > 1`） | 普通稠密/GQA 模型（如 `Qwen3-8B`）、`DCP=1` 或带 `index_kpool` 的 GLM 均不会读取本键 |
| 批次阶段限制 | 仅纯 Decode 步（`_has_prefill` 为假）进入该分支 | 混入 prefill 的批次走「汇聚完整 KV、query 留本地」路径并写死 `.contiguous()`，本键不参与 |
| 与 `enable_dsa_cp` 关系 | 开启 DSA-CP 时沿第 0 维汇聚（`restore_perm = None`），自动跳过本键 | 同时开 DSA-CP 时设 `true` 也不会执行 `permute` 或 `.contiguous()`，且无冲突告警 |
| 实际复制触发条件 | 仅当 `permute` 后视图非连续（如多 token `T > 1`）时分配并复制 $T \times G \times H \times D$ 元素 | 单 token（`T = 1`）等已连续形状下，`.contiguous()` 直接返回原张量、零额外拷贝 |
| 版本可用性 | `v0.30.0`、`v0.30.0rc2`、`main` 支持；`v0.23.0`、`v0.26.0rc` 静默忽略 | `main` 新增量化 KV 的 `_finish_dcp_packed_gather` 分支，同样受本开关控制 |

## 为什么汇聚后需要转回 t-major，哪些路径会直接绕过本键？

普通 DCP 将 KV cache 沿序列维交错切分给组内各卡，各卡算完本地那部分 KV 的注意力后按 LSE 合并，同时需要在组内汇聚 query 的 head 维（dim 1）分片。因为此处异步 All-Gather helper 按第 0 维扩展接收缓冲（这是该 helper 的接口约定，并非所有 All-Gather API 都限于第 0 维），代码先将 query 转成 head-major 再发，收回后再 `permute` 转回 t-major。

热路径上，普通 DCP 在头维汇聚且输入为 NPU 张量时，优先调用 Triton 融合准备算子 `prep_query_head_major` 把 `ql_nope` 与 `q_pe` 一次拼成 head-major（合并两次 gather 以规避流依赖，并将 `cat`、`permute` 与连续化合成一次写入；空输入或无法证明 fast path 地址合法时返回空值、调用异常时退回 PyTorch 拼装，但两片段形状或 dtype 不匹配会在进入尝试前直接报错，不能靠回退修复）。

```wiki-diagram
file: param-sfa-dcp-force-tmajor
```

收回后的核心代码即为本键唯一生效处（`_finish_dcp_gather` 仅在通信句柄非空时先 `wait`，开关不改变等待的通信对象，因此不能据此推导通信量减少）：

```python
gathered = context.gathered
if context.restore_perm is not None:
    gathered = gathered.permute(context.restore_perm)
    if not keep_view:
        gathered = gathered.contiguous()   # ← 本键为 true 时走这里
return torch.split(gathered, context.split_sizes, dim=-1)
```

`permute` 只改视图维度与步长、不搬动底层数据（不等于 Python 调用与元数据操作零耗时）。上游利用注意力算子接受跨步 query 的条件省去默认连续化，但下游 kernel 对两种布局的实际性能表现仍须在设备上测量，不能仅因少一次调用就断言端到端更快。

**有四类情况会直接绕过本键，写了 `true` 也不会生效（且无告警）**：

| 绕过 / 边界情形 | 底层原因 | 实际表现 |
| --- | --- | --- |
| **1. 未选到 `AscendSFADCPImpl`** | `resolve_sfa_impl` 要求模型走 SFA 稀疏注意力（且不被 `model_uses_kpool_indexer` 排除）且 `decode_context_parallel_size > 1` | 不会进入读此键的 DCP 实现类 |
| **2. 批次包含 prefill** | `_execute_sparse_flash_attention_process` 先检 `_has_prefill`（含 `num_prefills > 0` 或 PCP 全局 prefill），为真时走「汇聚完整 KV、query 留本地」分支并提前 `return` | 该分支自身写死 `.contiguous()`；在常开 chunked prefill 服务里本键仅纯 decode 步生效 |
| **3. 同时开启 `enable_dsa_cp`（DSA-CP）** | 名字里的 `dcp` 指 decode context parallel，与 DSA-CP 不是一套；`AscendSFADSADCPImpl` 按 MRO 继承自 `AscendSFADSACPImpl` 的 `_parallel_query_gather_dim` 返回 `0`（token 维汇聚） | `_all_gather_dim_async` 在 `dim == 0` 返回 `restore_perm = None`，整段跳过 `permute` 与 `.contiguous()` |
| **4. 读取方式无 `lru_cache` ≠ 支持在线改配** | 与同批带 `lru_cache(maxsize=1)` 的 `enable_dsa_cp`、`enable_pcp_o_proj_weight_sharding` 不同，`enable_sfa_dcp_force_tmajor_restore()` 每次走到都现读配置单例 | 配置工厂虽支持 `refresh` 发布新单例并清缓存，但没有提供在线重配置与图重捕获接口 |

## 额外复制量怎么算、PCP+DCP 与 GLM 双机边界

- **是否发生复制看视图连续性，复制元素数看实际 query 缓冲**：普通 DCP 头维汇聚中，设汇聚前本地形状为 `[T, H, D]`（`D` 为两段 query 宽度之和）、汇聚组大小为 `G`，恢复后整体形状为 `[T, G×H, D]`。仅当恢复视图不连续时，`.contiguous()` 才复制全部 $T \times G \times H \times D$ 个元素：

| 示意情形（`H = 2, D = 3, G = 2`） | head-major 形状 / 步长 | `permute` 后形状 / 步长 | 设 `true` 时 `.contiguous()` 行为 |
| --- | --- | --- | --- |
| 一般多 token（`T = 2`） | `[4, 2, 3]` / `[6, 3, 1]` | `[2, 4, 3]` / `[3, 6, 1]`（非连续） | 分配并重排复制 `24` 个元素 |
| 退化单 token（`T = 1`） | `[4, 1, 3]` / `[3, 3, 1]` | `[1, 4, 3]`（已连续） | 直接返回原张量，**不发生复制** |

  以上是形状与步长演算，不能直接换算为固定微秒或吞吐收益；分配开销能否与其他操作重叠也须实测。
- **PCP+DCP 组合不能直接套用 `G = DCP`**：在 PCP+DCP 组合子类中，当 `DCP == PCP` 时直接使用本地 head-major 张量、不发起此次 query gather，否则沿其 TP 组汇聚；恢复步骤仍经过本键，但复制量应按该分支实际得到的张量形状计算。
- **默认保持 `false`，做布局对照实验时再开 `true`**：引入提交说明曾跑过 AISBench / GSM8K，但未公开开与不开的对照数表。做布局对照应固定模型、批次、DCP 组大小与其他配置，确认进入受本键控制的恢复分支后，再对比输出、时延、吞吐与峰值显存，不能把对照开关当成已验证的通用故障修复。
- **放到 GLM 双机部署（历史例外 B 算例）**：本站[固定部署](../concepts/glm-5-3-flash-two-node.md#部署前提)的 `DCP = 1, PCP = 1` 且 `db701c1f` 没有此键。在 `v0.30.0` 与 `main` 中，`model_uses_sfa_sparse` 开头即排除带 `index_kpool` 的模型（GLM-5.3-Flash 属于此类，kpool 后端入口见[注意力后端家族](../concepts/attention-backend-family.md#一个稀疏-mla-层其实注册了三个条目)）；即便升级新版并开 `DCP > 1`，GLM 也不会进入本键控制的 LightningIndexer SFA-DCP 实现（旧 `db701c1f` 同名函数虽无该排除，但它本来就没有本开关）。

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
