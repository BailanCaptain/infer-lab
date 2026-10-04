---
id: fused-op-type-fc0f5fcd7be0
title: fused_op_type
type: param
summary: 'Sparse KV Offload 的 decode 用不用融合算子：默认 none 走原来四步，fused_copy_sfa 换成 LIM 与 Copy_SFA 两个融合算子；只在 2026-09-26 之后的 main 上有，钉住版本都没有。'
origin: seed
evidence: C
updated: '2026-10-04'
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
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L1658-L1660
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L269-L273
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L1047-L1054
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1494
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/attention/sfa_kv_offload.py#L647-L650
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17392
rawSources:
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-487944627d866213f1a7080123d1b06364fdfd1236bf863485d634bc276f95bc.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`fused_op_type` 决定 [Sparse KV Offload](../concepts/kv-cache-sparse-offload.md) 的 decode 用不用**融合算子**。默认 `"none"` 走原来的四步：索引器打分（Lightning Indexer，LI）→ 按 LRU 决定热缓冲里留谁、换谁 → 把缺的行从主机搬进热缓冲（Sparse Onload）→ 跑一次 SFA。写成 `"fused_copy_sfa"`，这四步换成两个融合算子：`fused_lightning_indexer_manage`（LIM，管打分和热缓冲的进出）和 `fused_scatter_copy_sparse_flash_attention`（Copy_SFA，边把缺的行拷进来边算 attention），「四步换成两步」和两个算子名出自 [PR #17392](https://github.com/vllm-project/vllm-ascend/pull/17392) 的说明；哪几步并进哪个算子，是按算子名对应出来的 [I]。合法取值只有这两个 [C5]。

**它不在 `additional_config` 顶层**，真实路径是 `additional_config["sparse_kv_offload_config"]["fused_op_type"]`，和 [use_fused_overlap](use-fused-overlap-75a180fff6ab.md) 是同一个嵌套块里的兄弟字段，两者互斥。它也不是独立开关：同一块里的 `enabled` 没打开时，Sparse KV Offload 整套都不启动，写了它也没有效果 [C7]。

**存在范围**：2026-09-26 由 PR #17392 引入 main，之后字段定义没再改过；本页按 2026-10-02 的 main `4ebb3090` 核对。我们钉住的四个版本都没有它：main `baa023ad` 上写进去启动就报错，v0.26、v0.23 维护分支与 GLM 快照上则被静默忽略（各版本的表现见事实表）。

**GLM 双机这套部署上它用不上。** 本部署根本没开 Sparse KV Offload，就算换到 main，硬件这一关就过不去（[逐条门槛](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。融合路径还另有几条自己的门槛，GLM 能过哪几条，见下面「开了的代价」末尾。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["fused_op_type"]` |
| 类型 | `str` |
| 默认表达式 | `'none'` |
| 定义 | `vllm_ascend/ascend_config.py:1630` [C3] |
| 版本 | main · 4ebb3090fc3c13c26557dcaae353882e70246649 |

字段注释：

Generalized Q1/MTP LIM + copy-SFA. The C8 operator is built separately but is not selected by this serving path.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.fused_op_type not in ('none', 'fused_copy_sfa'):
    raise ValueError('sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa')
````

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| main `baa023ad` 上写了会怎样 | 那里的 `SparseKVOffloadConfig` 没有这个字段，整块用 `cls(**user_config)` 建对象 [C10]，未知键被 `extra="forbid"` 拒收 [C11] | 启动就报错；镜像要包含 `1e9e03bc`（09-26，PR #17392）才认这个键 |
| v0.26 / v0.23 / GLM 快照上写了会怎样 | v0.26 只按名字取四个键，其余忽略 [C9]；v0.23 维护分支与 GLM 快照上没有 Sparse KV Offload，整块不读也不报（见 [use_fused_overlap 页](use-fused-overlap-75a180fff6ab.md#一句话)） | 配了没人读，也不会提示 |
| 完整路径与默认值（`4ebb3090`） | `additional_config["sparse_kv_offload_config"]["fused_op_type"]`，`str`，默认 `"none"` | — |
| 合法取值 | 只有 `"none"` 和 `"fused_copy_sfa"`；其他值报 `sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa` | 拼错直接起不来 |
| 和 `use_fused_overlap` | 两个同时打开报 `fused_copy_sfa and use_fused_overlap are mutually exclusive` | decode 三条路三选一：默认、overlap、copy-SFA |
| 起服务时另加的检查（只在 `enabled` 打开时做） | 不支持 DSpark 投机解码；模型的 TopK 必须是 2048，每个请求每步的 query 行数（1 + MTP 草拟数）必须在 1–7；报错原文见源码 [C6] | 不是所有稀疏模型都能用 |
| 热缓冲 `topk_buffer_size` | 必须是 256 的倍数，且落在 `[行数 × 2048, 16128]` 之间 [C6] | 默认 4096 只够每请求 1–2 行；开 MTP 草拟 2 个以上就得调大 [D] |
| 每一步真走融合路径的条件 | 这一批没有 prefill（纯 decode），且最长 query 在 1–7 行；否则这一步退回原来的四步 [C8] | 混着 prefill 的步拿不到融合收益 |
| C8 版本的算子 | 字段注释说 C8 版本的算子单独编译，但这条服务路径不会选它 [C4] | 取值里没有 C8 选项，不要找 |
| 实测收益 | PR 说明只说「加速」，没有给数字；我们也没有实测 | 本页不给效果数字 |

## 为什么存在

Sparse KV Offload 的每一步 decode 本来就算得很少（[为什么不整层搬回来](../concepts/kv-cache-sparse-offload.md#为什么不整层搬回来decode-一步算得太少)），原来那条路却要连着发四个小算子：先打分选出位置，再查表决定热缓冲的槽位，再把缺的行拷进来，最后才算 attention（[一步 decode 的顺序](../concepts/kv-cache-sparse-offload.md#一步-decode-的顺序写新行选查表搬换号算)）。每一步之间都要把中间结果——选中的位置清单、槽位表——写回显存再读出来，还要各自付一次算子启动的开销——这是按算子融合的一般道理说的，源码与 PR 没有写到这一层 [I]。

把四步并成两步，省掉的就是两次交接和两次启动：LIM 把「打分 + 决定热缓冲进出」做在一个算子里，Copy_SFA 把「拷缺的行 + 算 attention」做在一个算子里。融合为什么能省时间、省在哪，属于算子融合的一般道理 [I]；PR 本身只写了「加速 layerwise sparse offload 的 decode」，没有给拆分到每一步的数字。

它做成一个字符串取值而不是布尔开关，字段注释的说法是「把 Q1 / MTP 的 LIM + copy-SFA 一般化」，另有一个 C8 版本的算子已经单独编译、但这条路不选 [C4]。取值以后会不会再加，源码里没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置约束和按约束推出来的数，不是测出来的效果。PR #17392 没有公开开与不开的时延对照，我们也没有在任何钉住提交上测过——钉住的版本里根本没有这个字段。

**能用的范围变窄了。** TopK 只能是 2048、每请求 1–7 行、热缓冲要 256 对齐且有上限、不支持 DSpark 投机解码——这几条检查在源码里都包在「选了 `fused_copy_sfa`」这个分支之下，默认路径不做 [C6]；`use_fused_overlap` 也不能同时开（事实表）。这些检查都在起服务时做，不满足就起不来，不会自动退回默认路径。

**不是每一步都走融合路径。** 起服务成功以后，只要这一批混着 prefill（或最长 query 不在 1–7 行），这一步就退回原来的四步 [C8]。源码注释还写明：为了退回那一步，会把热缓冲的驻留记录作废一次 [C12]——按字面理解，下一步可能要把本来在缓冲里的行重新搬一遍 [I]。prefill 和 decode 混得越频繁，这种来回切换就越多。

**热缓冲可能要调大。** 下限是「每请求行数 × 2048」：不开 MTP 是 2048，草拟 1 个是 4096，草拟 3 个就是 8192 [D]。默认值 4096 撑不住 3 个草拟；调大热缓冲会多占设备显存，多占多少按 [池子能开多大](../concepts/kv-cache-sparse-offload.md#池子能开多大三条上限取最小) 那一节的口径算。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、16 张卡、MTP 每轮草拟 3 个）：

- 本部署没开 Sparse KV Offload，GLM 快照 `db701c1f` 上也没有这套实现，写了这个键既不读也不报。换到 main，第一道硬件门槛就过不去（[逐条门槛](../concepts/kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去)）。
- 假如前面的门槛都过了，融合路径自己的几条里：GLM 的 `index_topk` 是 [2048](../concepts/sparse-attention.md#对照源码)，TopK 这一条过得去；MTP 草拟 3 个，每请求每步 4 行，在 1–7 之内 [D]。
- 卡住的是热缓冲：下限是 4 × 2048 = 8192，默认 4096 不够，照默认值配会在起服务时报 `fused_copy_sfa hot budget must be 256-aligned in [Q_max*2048, 16128]` 开头的错误 [D]。

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
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 有（1 个文件） |

- **引入**：2026-09-26 · 1e9e03bc53bdc53f3cc78c7af191794ee7544ad9 · PR [#17392](https://github.com/vllm-project/vllm-ascend/pull/17392) —— [Feature]Support using fused operators to improve performance of layerwise sparse offload (#17392)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/spec_decode/mtp.py` +0 / −50（文本行变化）
  - `vllm_ascend/attention/sfa_kv_offload.py` +552 / −19（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py` +23 / −18（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/worker.py` +68 / −9（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +105 / −4（文本行变化）

当前含该标识符的 tag：未找到
