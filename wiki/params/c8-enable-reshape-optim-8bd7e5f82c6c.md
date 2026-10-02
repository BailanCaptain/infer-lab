---
id: c8-enable-reshape-optim-8bd7e5f82c6c
title: c8_enable_reshape_optim
type: param
summary: >-
  让 LightningIndexer 的 C8 缓存写入改走 StoreKVBlock 算子，不再逐 token scatter。两个发布分支上是默认
  false 的用户键、要配合 enable_sparse_li_c8；main 上默认 true，但还要 enable_sparse_li_c8
  成立、且跑在 PD 分离的 P 节点上才算真开。GLM 双机没开，硬开会报错。
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
updated: '2026-10-02'
relations:
  - to: kv-cache-quantization
    kind: builds-on
    note: 它只作用在 LightningIndexer 那份 C8 量化缓存的写入路径上，indexer 不走 C8 时这个键恒等于没开
  - to: ascend-config-system
    kind: builds-on
    note: 三个版本上都是能写的用户键，但默认值和「写了算不算数」各不相同，全看那条构造链怎么把它与上其他条件
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L526
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L777-L786'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L524-L535'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1083-L1086'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L234-L274'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L1068-L1080'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1678'
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
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/indexer.py#L898-L914
  - >-
    vllm-ascend@0576b6471c7a35707920a665352391d33c77451c:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L635
rawSources:
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

它只管一件事：**LightningIndexer 把自己那份 C8 量化缓存写进去时，用哪个算子**（索引器缓存的 C8 属于「稀疏 C8」那条路，见 [KV cache 量化](../concepts/kv-cache-quantization.md#ascend-上的三条-kv-cache-量化路)）。关掉走 `npu_scatter_nd_update_`，一次一个 slot；打开走 AscendC 写的 `store_kv_block`，按「组」成段写 [C5]。两个发布分支上默认 `False`，而且在那里它还被 `enable_sparse_li_c8` 与上了——indexer 不走 C8 量化，这个键怎么配都是假 [C9]。

**存在范围：三个版本都有这个名字，但在 main 上它管的事情比发布分支少。** v0.23 维护分支与 v0.26 分支上它是 `additional_config` 顶层的用户键，官方参数表明确写着默认 `False`、要配合 `enable_sparse_li_c8`、PD 分离时只在 P 节点开 [S10]。main 上它这一年里被拆过又装回来：PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752)（2026-09-07）把用户键整个删掉改成自动判定，PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952)（2026-09-20）又把开关加了回来，并且默认值从 `False` 翻成了 `True` [C1]。**钉住的这个 main 快照上开关已经恢复**：`c8_enable_reshape_optim` 是 `AscendConfig` 上一个可写的字段，默认 `True` [C3]，但它只是最终判定里的第一项——另外两个条件仍然由代码推出来，用户写 `true` 并不等于开成了 [C2]。下面「版本谱系」里 v0.28.0rc 那行写「无」，是那段删掉开关的空窗期留下的痕迹。

## 事实表

| 项 | v0.23 维护分支 / v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 它是什么 | `additional_config` 顶层的用户键 | `AscendConfig` 上可写的字段，另有一个 `init=False` 的私有字段存最终判定 [C3] | 两边都能写，但 main 上「写进去的值」和「算出来的结果」是两个不同的东西 [!] |
| 默认值 | `False` [S15] | `True` [C1] | 从发布分支升到 main，这个键的默认行为从「默认不用」翻成「默认用」 |
| 实际取值 | `enable_sparse_li_c8 and additional_config.get(..., False)` [C9] | `c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node` [C2] | main 多加了一道 PD 角色闸，少一个条件就为假 |
| 混部（没有 `kv_transfer_config`） | 可以开 | **恒为假** | main 上不做 PD 分离就永远享受不到这个优化，日志里也不会说 [!] |
| `enable_sparse_li_c8` 从哪来 | 用户在 `additional_config` 里配 | 由 `attention_config.indexer_kv_dtype` 是不是 fp8/int8 推出来 | main 上你连前提条件都不再直接控制 |
| 读它的地方 | `sfa_v1.py` 的建 metadata 与 `_use_li_c8_reshape_optim` [C13] | 搬到 `attention/indexer.py`，经只读属性 `c8_reshape_optim_enabled` 取 | 在 main 上按老文件名搜会搜空 |
| 开了写什么 | `store_kv_block` + `store_kv_block_metadata` | 同 | 两个算子配套：先算出分组元数据，再成段写 |
| 关了写什么 | `npu_scatter_nd_update_`，逐 slot 更新 | 同 | 这是默认路径，也是 indexer 不走 C8 时唯一的路径 |
| 往 `additional_config` 里写它 | 收下，就是这个键本身 | 收下——它是字段、又不在 `_NON_USER_INPUT_KEYS` 里，`extra="forbid"` 放行 [C7] | 官方 GLM5.2 教程里的 `"c8_enable_reshape_optim":false` 不再因这个键被拒绝 [S8] |

## 为什么存在

indexer 的 K 缓存写入是个**极碎的操作**：每个 token 一个 slot，`npu_scatter_nd_update_` 把 `k_li` 摊平成 `(-1, head_dim)`、slot_mapping 摊平成 `(-1, 1)`，一行一行散写进去。开了 C8 之后更碎——量化 scale 是第二份缓存，同一套动作要再做一遍 [C5]。

`store_kv_block` 换的是写入的粒度：先由 `store_kv_block_metadata` 把 slot_mapping 归成「组」，产出 `group_len` / `group_key_idx` / `group_key_cache_idx` 三个描述符，再把整段连续的 token 一次写进块里 [C6]。这就是名字里 reshape 的意思——不是改张量形状，是把「散点写」重排成「成段写」。三个描述符的缓冲按「一步最多多少 token」预先留好：发布分支在 metadata builder 初始化时按 `max_num_batched_tokens` 申请 [C22]，main 按同一上限算出的固定容量、第一次用到时申请 [C23]；每步只取前「本步 slot 数」那一截。开关本身在启动时从配置读定，所以这条路整个进程只选一次，不能按请求切换。

**既然默认是开的，为什么还留一个开关。** 上游把理由挂在 issue [#15896](https://github.com/vllm-project/vllm-ascend/issues/15896) 上，那串 URL 就是 `c8_enable_reshape_optim` 字段上方唯一的注释 [C3]，而恢复这个开关的 PR 标题直说是 "Restore C8 reshape optimization switch"。先把它改成自动判定、出了问题再给回一个能关掉的旋钮——这条时间线说明这个键现在的用途是逃生口，不是调优项 [I]。

## 开了的代价

**在 main 上它是「开不开」与「符不符合条件」两道门串起来的。** 判定写成 `self._c8_reshape_optim_enabled = self.c8_enable_reshape_optim and self.enable_sparse_li_c8 and is_prefill_node`，结果存进一个 `init=False` 的私有字段，再由只读属性 `c8_reshape_optim_enabled` 对外提供 [C4]。用户能拨的只有第一项：`enable_sparse_li_c8` 由 `indexer_kv_dtype` 是不是 fp8/int8 推出来，`is_prefill_node` 要求 `kv_transfer_config` 非空且角色是 `kv_producer`。所以**混部部署上它永远是假**，把这个键写成 `true` 也改不了——这不是配置问题，是代码写死的 [!]。反过来说，这个键真正的用处只剩一个方向：在满足条件的 P 节点上把它关掉。

**跨版本搬配置，两个方向的坑不一样。**

- 拿 v0.23 / v0.26 的启动命令升到 main：键名照收，但默认值翻了——那两个分支上不写就是 `False`，main 上不写就是 `True`。想保持原行为得显式写 `false`。
- 拿 main 的期望回到 v0.23 / v0.26：那两个分支上它默认 `False`，不显式写就完全没开，而且还得先把 `enable_sparse_li_c8` 也配上 [C12]。

**教程里的这个键现在能通过配置校验。** GLM5.2 的启动行写着 `"c8_enable_reshape_optim":false`；在这个 main 快照上，`false` 和 `true` 都是字段接受的值，后者还要满足上面的派生条件才会生效。这只说明不会再因键名未知而被拒绝，不代表整条部署命令已经实测可启动；恢复开关之前的空窗期仍会拒绝这个键，照抄教程前要核对 main 的快照 [!]。

**它和 PD 的关系在两代里是两种约束。** 发布分支上「只在 P 节点开」是文档里的一句话，配错了没人拦（[v0.23 线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)）；main 上这句话被写进了代码。从「靠人遵守」变成「硬判定」，是这个参数这一年里最实质的变化。

**放到 GLM 双机：这个键在这里开不了。** 部署用的 `db701c1f` 和发布分支是同一种写法：实际取值 = `enable_sparse_li_c8` 且这个键，两者不写都是 `False` [C21]；官方教程多机部署一节的两条启动命令都没写 `--additional-config` [S24]（取值汇总见[部署页 · 怎么开](../concepts/glm-5-3-flash-two-node.md#怎么开)），所以它是假；索引器缓存也没压成 C8，这个键要换算子的那次写入在这里根本不发生——这套部署本来就没开 KV cache 量化（[KV cache 量化 · 放到 GLM 双机](../concepts/kv-cache-quantization.md#放到-glm-双机这套部署没有开-kv-cache-量化)）。就算两个键都写成 `true` 也换不来成段写：GLM 的 attention 后端在构造时见它为真就直接报错（日志里的原文含 `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim`），理由是 GLM 索引器的状态缓存有自己独立的 slot mapping [C20]——它单独成一个缓存组、块长只有 4（[块表页](../concepts/block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)），和这条按一套 slot 归组的路对不上。这个开关没有实测收益数；待核：main 上 GLM 的模型代码是否保留同样的拦截。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 有（2 个文件） |
| releases/v0.22.1rc | 有（2 个文件） |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.24.0rc | 有（2 个文件） |
| releases/v0.25.1rc | 有（2 个文件） |
| releases/v0.26.0rc | 有（2 个文件） |
| releases/v0.27.1rc | 有（2 个文件） |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 有（1 个文件） |
| main | 有（1 个文件） |

- **引入**：2026-06-10 · a53f8a023016219a3d5246a881d74d4d8d892f0c · PR [#10292](https://github.com/vllm-project/vllm-ascend/pull/10292) —— [Feature] add ascendc ops store_kv_block (#10292)
  包含该提交的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/attention/sfa_v1.py` +51 / −10（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +3 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −0（文本行变化）
  - `vllm_ascend/attention/utils.py` +4 / −0（文本行变化）
  - `vllm_ascend/spec_decode/llm_base_proposer.py` +3 / −0（文本行变化）
- **移除**：2026-09-07 · c30092741be0829dfb387103a32f433f5c0ecb5c · PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752) —— [Refactor] Auto-enable LI C8 reshape optimization (#15752)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/ascend_config.py` +21 / −10（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +2 / −2（文本行变化）
- **引入**：2026-09-20 · 1e0742722d149b99f91ece504180aa9bdf8b69af · PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952) —— [Misc][Config] Restore C8 reshape optimization switch (#16952)
  包含该提交的 tag：未找到；分支：origin/main、origin/releases/v0.29.0rc
  - `vllm_ascend/ascend_config.py` +7 / −3（文本行变化）

当前含该标识符的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["c8_enable_reshape_optim"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:635` [C25] |
| 版本 | main · 4ebb3090fc3c13c26557dcaae353882e70246649 |

字段注释：

See https://github.com/vllm-project/vllm-ascend/issues/15896

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
