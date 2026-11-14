---
id: fused-op-type-fc0f5fcd7be0
title: fused_op_type
type: param
summary: >-
  Sparse KV Offload 的 decode 用不用融合算子：默认 none 走原来四步，fused_copy_sfa 换成 LIM 与
  Copy_SFA 两个融合算子。rc2 已有并接入 V1/V2，支持 LI C8 的 int8 路径；早期固定 v0.23、v0.26 与 main
  快照没有此键。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
## 一句话

**v0.30.0rc2 对照：** 已有 sparse_kv_offload_config.fused_op_type，默认 none，只接受 none/fused_copy_sfa，与 use_fused_overlap 互斥；V1/V2 runner 和 SFA 卸载 metadata 已消费它。每请求最大查询行数 Q_max 从旧实现的 1–7 扩大到 1–14，热缓存预算须覆盖 Q_max×TopK、按 256 对齐且不超过 32512；运行时另分配两块循环尾区，LIM 容量上界为 32640。DSpark 的 MRV2 remote prompt 初始化已接入。融合 serving 也已支持 LightningIndexer 的 C8 int8，尚不支持 fp8，主 KV 仍用 BF16。下文基于旧 main 扫描快照的容量、DSpark 与 C8 限制须按这些 rc2 差异阅读；完整条件见 [Sparse KV Offload](../concepts/kv-cache-sparse-offload.md#版本差异)。

`fused_op_type` 决定 [Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 的 decode 用不用**融合算子**。默认 `"none"` 走原来的四步：索引器打分（Lightning Indexer，LI）→ 按 LRU 决定热缓冲里留谁、换谁 → 把缺的行从主机搬进热缓冲（Sparse Onload）→ 跑一次 SFA。写成 `"fused_copy_sfa"`，这四步换成两个融合算子：`fused_lightning_indexer_manage`（LIM，管打分和热缓冲的进出）和 `fused_scatter_copy_sparse_flash_attention`（Copy_SFA，边把缺的行拷进来边算 attention），「四步换成两步」和两个算子名出自 [PR #17392](https://github.com/vllm-project/vllm-ascend/pull/17392) 的说明；哪几步并进哪个算子，是按算子名对应出来的 [I]。合法取值只有这两个 [C5]。

**它不在 `additional_config` 顶层**，真实路径是 `additional_config["sparse_kv_offload_config"]["fused_op_type"]`，和 [use_fused_overlap](use-fused-overlap-75a180fff6ab.md) 是同一个嵌套块里的兄弟字段，两者互斥。它也不是独立开关：同一块里的 `enabled` 没打开时，不会启用 Sparse KV Offload。但旧实现与 rc2 都先构造配置、检查取值与互斥，再判断主开关；主开关关闭也不能绕过拼写错误或互斥错误 [C7][C36]。

选择融合路径与某一步实际启用融合是两层判断，逐步条件见事实表。这里的 prefill 是处理提示词中尚未计算的位置、建立历史状态的阶段；dummy 则是用模拟批次执行模型的路径，不能与真实请求混合执行混为一谈。

**存在范围**：该字段由 PR #17392 在 2026-09-26 引入，历史走读采用 4ebb3090；当前 rc2 也已包含，运行时扩展见首段。没有它的是四个旧快照：main baa023ad、v0.26、v0.23 和 GLM db701c1f。旧 main 拒收，后三者忽略。

**rc2 还需要匹配的原生算子。** 该分支提供 Python 调用路径，官方指南要求另备包含 LIM、LI C8 LIM 和 Copy-SFA 的原生扩展。Copy-SFA 接收注册过的 MemFabric 主机内存视图，原生适配层还须允许这些 CPU tensor；普通 CPU 分配不能替代注册 DRAM。只把配置改成 fused_copy_sfa，不足以让缺少这些算子或绑定的镜像运行起来 [S30]。

**GLM 双机这套部署上它用不上。** 本部署根本没开 Sparse KV Offload，就算换到 main，硬件这一关就过不去（[逐条门槛](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。融合路径还另有几条自己的门槛，GLM 能过哪几条，见下面「开了的代价」末尾。

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

## 事实表

**下表与后面的算法解释保留旧 main 扫描范围。** 上方自动定义原样摘录 rc2 字段注释，其中“C8 不由此服务路径选择”已落后于同一快照的实现：实际 `_lim_select` 已有 int8 分支，rc2 指南也列出 LI C8 int8 支持。因此不能用这条声明注释否定 rc2 的 C8 路径；容量与阶段条件按开头的 rc2 对照及 [Sparse KV Offload 版本差异](../concepts/kv-cache-sparse-offload.md#版本差异)核对。

| 项 | 值 | 意味着什么 |
|---|---|---|
| main `baa023ad` 上写了会怎样 | 那里的 `SparseKVOffloadConfig` 没有这个字段，整块用 `cls(**user_config)` 建对象 [C10]，未知键被 `extra="forbid"` 拒收 [C11] | 启动就报错；应检查镜像是否包含此字段、调用路径及所需原生算子，不能只看版本名 |
| v0.26 / v0.23 / GLM 快照上写了会怎样 | v0.26 只按名字取四个键，其余忽略 [C9]；v0.23 维护分支与 GLM 快照上没有 Sparse KV Offload，整块不读也不报（见 [use_fused_overlap 页](use-fused-overlap-75a180fff6ab.md#一句话)） | 配了没人读，也不会提示 |
| 完整路径与默认值（`4ebb3090`） | `additional_config["sparse_kv_offload_config"]["fused_op_type"]`，`str`，默认 `"none"` | — |
| 合法取值 | 只有 `"none"` 和 `"fused_copy_sfa"`；其他值报 `sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa` | 拼错直接起不来 |
| 和 `use_fused_overlap` | 两个同时打开报 `fused_copy_sfa and use_fused_overlap are mutually exclusive` | decode 三条路三选一：默认、overlap、copy-SFA |
| 起服务时另加的检查（只在 `enabled` 打开时做） | 不支持 DSpark 投机解码；模型的 TopK 必须是 2048，每个请求每步的 query 行数（1 + MTP 草拟数）必须在 1–7；报错原文见源码 [C6] | 不是所有稀疏模型都能用 |
| 热缓冲 `topk_buffer_size` | 必须是 256 的倍数，且落在 `[行数 × 2048, 16128]` 之间 [C6] | 默认 4096 只够每请求 1–2 行；开 MTP 草拟 2 个以上就得调大 [D] |
| 每一步真走融合路径的条件 | 已选择融合路径，最长 query 在 1–7 行，且这一批没有 prefill 或带有 `offload_dummy`；否则这一步退回原来的四步 [C8] | 普通未标记 dummy 的批次混入 prefill 时不走融合；模拟批次的例外不代表真实混合请求的收益 |
| C8 版本的算子 | 字段注释说 C8 版本的算子单独编译，但这条服务路径不会选它 [C4] | 取值里没有 C8 选项，不要找 |
| 实测收益 | PR 说明只说「加速」，没有给数字；我们也没有实测 | 本页不给效果数字 |

## 为什么存在

Sparse KV Offload 的每一步 decode 本来就算得很少（[为什么不整层搬回来](../concepts/kv-cache-sparse-offload.md#为什么不整层搬回来decode-一步算得太少)），原来的主要工作分成四个阶段：先打分选出位置，再查表决定热缓冲的槽位，再把缺的行拷进来，最后才算 attention（[一步 decode 的顺序](../concepts/kv-cache-sparse-offload.md#一步-decode-的顺序写新行选查表搬换号算)）。这些阶段需要传递选中的位置、槽位和缺失行等信息；融合的目的，是让相邻工作共同完成，减少分开调度及传递中间结果的开销。

LIM 合并打分与热缓冲管理，Copy-SFA 合并缺失行拷贝与 attention。这里的“四步变两步”描述主要阶段，不能直接换算为整次 decode 必定少两次 kernel 启动或少两次显存读写：实际调用旁仍有连续化、查询准备和复用状态拷贝等操作，具体开销要看输入、复用分支及算子实现。PR 只说明加速目标，没有公开分阶段计时；源码中的两个调用也不构成实测收益 [C34]。

旧 4ebb3090 的字段注释将它描述为 Q1 / MTP 的 LIM + Copy-SFA 选择，并说 C8 算子不由该服务路径调用；rc2 已加入 int8 LI C8 分支，按开篇条件使用。两个版本的字符串合法值仍都是 none 与 fused_copy_sfa，C8 不是第三个枚举值 [C4][C28]。

## 开了的代价

下面按旧 4ebb3090 的配置约束计算容量，rc2 差异见开篇。PR #17392 没有公开开与不开的时延对照，本库也没有设备实测数据。

**能用的范围变窄了。** TopK 只能是 2048、每请求 1–7 行、热缓冲要 256 对齐且有上限、不支持 DSpark 投机解码——这几条检查在源码里都包在「选了 `fused_copy_sfa`」这个分支之下，默认路径不做 [C6]；`use_fused_overlap` 也不能同时开（事实表）。这些检查都在起服务时做，不满足就起不来，不会自动退回默认路径。

**不是每一步都走融合路径。** 起服务成功且已选择融合路径以后，最长 query 不在 1–7 行，或这一批混着 prefill 且未标记 `offload_dummy` 时，这一步就退回原来的四阶段路径。元数据准备会将本次 bank 的驻留历史标为失效；层前向再将本层 TopK 复用计数清零。前者是热缓冲管理状态，后者是层内复用状态，两者都发生在上述回退条件下，不是每次前向都清空全部历史状态。后续能复用哪些行要重新按请求与缓存状态判断 [C35][C12]。

**热缓冲可能要调大。** 下限是「每请求行数 × 2048」：不开 MTP 是 2048，草拟 1 个是 4096，草拟 3 个就是 8192 [D]。默认值 4096 撑不住 3 个草拟；调大热缓冲会多占设备显存，多占多少按 [池子能开多大](../concepts/kv-cache-sparse-offload.md#池子能开多大三条上限取最小) 那一节的口径算。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、16 张卡、MTP 每轮草拟 3 个）：

- 本部署没开 Sparse KV Offload，GLM 快照 `db701c1f` 上也没有这套实现，写了这个键既不读也不报。换到 main，第一道硬件门槛就过不去（[逐条门槛](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。
- 假如前面的门槛都过了，融合路径自己的几条里：GLM 的 `index_topk` 是 [2048](../concepts/sparse-attention.md#对照源码)，TopK 这一条过得去；MTP 草拟 3 个，每请求每步 4 行，在 1–7 之内 [D]。
- 卡住的是热缓冲：下限是 4 × 2048 = 8192，默认 4096 不够，照默认值配会在起服务时报 `fused_copy_sfa hot budget must be 256-aligned in [Q_max*2048, 16128]` 开头的错误 [D]。

旧 4ebb3090 的 runner 与 proposer 会在 dummy_run 中显式构造带 offload_dummy 的元数据，因而模拟批次可以满足例外条件；这不能放宽普通混合请求的条件。rc2 查询范围已扩到 1–14，按首段的新版本规则判断。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 有（1 个文件） |

- **引入**：2026-09-26 · 1e9e03bc53bdc53f3cc78c7af191794ee7544ad9 · PR [#17392](https://github.com/vllm-project/vllm-ascend/pull/17392) —— [Feature]Support using fused operators to improve performance of layerwise sparse offload (#17392)
  包含该提交的 tag：v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/main、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/zxy_fix_boradash
  - `vllm_ascend/spec_decode/mtp.py` +0 / −50（文本行变化）
  - `vllm_ascend/attention/sfa_kv_offload.py` +552 / −19（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py` +23 / −18（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/worker.py` +68 / −9（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +105 / −4（文本行变化）

当前含该标识符的 tag：v0.30.0rc1、v0.30.0rc2

## 对照源码

- 来源 18、19：旧 runner 与 proposer 的模拟执行会设置 offload_dummy。
- 来源 21、35：回退时分别重置层内 TopK 复用计数与对应 bank 的驻留历史。
- 来源 23–31：rc2 的取值、容量、C8、V2 初始化及原生构建条件；源码里的旧 C8 注释须结合实际分支阅读。
- 来源 34、36：融合调用及主开关关闭前仍执行的配置校验。
