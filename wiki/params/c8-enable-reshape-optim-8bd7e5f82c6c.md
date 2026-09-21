---
id: c8-enable-reshape-optim-8bd7e5f82c6c
title: c8_enable_reshape_optim
type: param
summary: >-
  让 LightningIndexer 的 C8 缓存写入改走 StoreKVBlock 算子，不再逐 token scatter。两个发布分支上是默认 false 的用户键、要配合
  enable_sparse_li_c8；main 上被改成派生只读，并且只在 PD 分离的 P 节点才可能为真。
aliases:
  - additional_config.c8_enable_reshape_optim
  - C8 reshape 优化
  - StoreKVBlock
  - store_kv_block
chapters:
  - '17'
origin: seed
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: C
updated: '2026-09-21'
relations:
  - to: kv-cache-quantization
    kind: builds-on
    note: 它只作用在 LightningIndexer 那份 C8 量化缓存的写入路径上，indexer 不走 C8 时这个键恒等于没开
  - to: ascend-config-system
    kind: builds-on
    note: 同一个名字在三个版本上分别是用户键、用户键和派生只读属性，能不能写、写了算不算数全看那条构造链
sources:
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L526
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L780-L786
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L772-L782'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1079-L1082'
  - 'vllm-ascend@b255ab59:vllm_ascend/attention/indexer.py#L234-L274'
  - 'vllm-ascend@b255ab59:vllm_ascend/attention/indexer.py#L1068-L1080'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1650-L1668'
  - 'vllm-ascend@b255ab59:docs/source/tutorials/models/GLM5.2.md#L217'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L280-L284'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L89
  - 'https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L286-L290'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L1547-L1549'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L460-L467'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L83
  - 'https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/configuration/additional_config.html'
rawSources:
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
---
## 一句话

它只管一件事：**LightningIndexer 把自己那份 C8 量化缓存写进去时，用哪个算子**。关掉走 `npu_scatter_nd_update_`，一次一个 slot；打开走 AscendC 写的 `store_kv_block`，按「组」成段写 [C5]。两个发布分支上默认 `False`，而且在那里它还被 `enable_sparse_li_c8` 与上了——indexer 不走 C8 量化，这个键怎么配都是假 [C9]。

**存在范围：三个版本都有这个名字，但在 main 上它已经不是同一种东西了。** v0.23 维护分支与 v0.26 分支上它是 `additional_config` 顶层的用户键，官方参数表明确写着默认 `False`、要配合 `enable_sparse_li_c8`、PD 分离时只在 P 节点开 [S10]。到 main 上，PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752)（2026-09-07）把用户键整个删掉改成自动判定，PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952)（2026-09-20）又把开关加了回来、默认值改成 `True` [C1]。**钉住的那个 main 快照 `b255ab59`（2026-09-19）正好落在这两个 PR 中间**——那上面既没有这个用户键，也还没恢复 [!]。下面「版本谱系」里 v0.28.0rc 那行写「无」，就是这段空窗期的痕迹。

## 事实表

| 项 | v0.23 维护分支 / v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 它是什么 | `additional_config` 顶层的用户键 | `b255ab59` 上没有这个键；`c173a64a` 起恢复为 `AscendConfig` 字段 | 同一个名字，两代版本里是两种东西 [!] |
| 默认值 | `False` [S15] | 恢复后是 `True` [C1] | 升级到恢复后的 main，行为从「默认不用」翻成「默认用」 |
| 实际取值 | `enable_sparse_li_c8 and additional_config.get(..., False)` [C9] | `c8_enable_reshape_optim and enable_sparse_li_c8 and is_prefill_node` [C2] | main 多加了一道 PD 角色闸，少一个条件就为假 |
| 混部（没有 `kv_transfer_config`） | 可以开 | **恒为假** [C3] | main 上不做 PD 分离就永远享受不到这个优化，日志里也不会说 [!] |
| `enable_sparse_li_c8` 从哪来 | 用户在 `additional_config` 里配 | 由 `attention_config.indexer_kv_dtype` 是不是 fp8/int8 推出来 | main 上你连前提条件都不再直接控制 |
| 读它的地方 | `sfa_v1.py` 的建 metadata 与 `_use_li_c8_reshape_optim` [C13] | 搬到 `attention/indexer.py`，经只读属性 `c8_reshape_optim_enabled` 取 [C4] | 在 main 上按老文件名搜会搜空 |
| 开了写什么 | `store_kv_block` + `store_kv_block_metadata` | 同 | 两个算子配套：先算出分组元数据，再成段写 |
| 关了写什么 | `npu_scatter_nd_update_`，逐 slot 更新 | 同 | 这是默认路径，也是 indexer 不走 C8 时唯一的路径 |
| 在 `b255ab59` 上配它 | — | 启动失败（`extra="forbid"`） | 官方 GLM5.2 教程的启动行里**还留着**这个键，照抄起不来 [!][S8] |

## 为什么存在

indexer 的 K 缓存写入是个**极碎的操作**：每个 token 一个 slot，`npu_scatter_nd_update_` 把 `k_li` 摊平成 `(-1, head_dim)`、slot_mapping 摊平成 `(-1, 1)`，一行一行散写进去。开了 C8 之后更碎——量化 scale 是第二份缓存，同一套动作要再做一遍 [C5]。

`store_kv_block` 换的是写入的粒度：先由 `store_kv_block_metadata` 把 slot_mapping 归成「组」，产出 `group_len` / `group_key_idx` / `group_key_cache_idx` 三个描述符，再把整段连续的 token 一次写进块里 [C6]。这就是名字里 reshape 的意思——不是改张量形状，是把「散点写」重排成「成段写」。三个描述符缓冲在 metadata 构建期就按 `slot_mapping.numel()` 申请好，所以这条路是启动期就要决定的，不能按请求切换。

**它为什么默认关。** 上游把理由挂在 issue [#15896](https://github.com/vllm-project/vllm-ascend/issues/15896) 上，那串 URL 就是 `c8_enable_reshape_optim` 字段上方唯一的注释 [C1]，恢复这个开关的 PR 标题也直说是 "Restore C8 reshape optimization switch"——先自动开、出了问题再给回一个能关掉的开关，这条时间线本身就是它默认值的最好注脚 [I]。

## 开了的代价

**在 main 上它已经不是「开不开」，而是「符不符合条件」。** `b255ab59` 上的判定是 `self._c8_reshape_optim_enabled = self.enable_sparse_li_c8 and is_prefill_node`，结果存进一个 `init=False` 的私有字段，再由只读属性 `c8_reshape_optim_enabled` 对外提供 [C3]。`is_prefill_node` 要求 `kv_transfer_config` 非空且角色是 `kv_producer`，所以**混部部署上它永远是假**——这不是配置问题，是代码写死的 [!]。恢复开关之后也只是在这条与链前面又加了一项，减不掉那两个条件。

**跨版本搬配置，两个方向都会踩坑。**

- 拿 v0.23 / v0.26 的启动命令升到 `b255ab59`：这个键不在 `AscendConfig` 的字段里，也不在 `_NON_USER_INPUT_KEYS` 的豁免名单里，会被 `extra="forbid"` 当错别字报出来，**进程起不来** [C7]（唯一例外是装了 `vllm_omni`，那种情况下只打一条 warning）。
- 拿 main 的期望回到 v0.23 / v0.26：那两个分支上它默认 `False`，不显式写就完全没开，而且还得先把 `enable_sparse_li_c8` 也配上 [C12]。

**官方教程和代码在 `b255ab59` 上是打架的** [!]。GLM5.2 的启动行里至今还写着 `"c8_enable_reshape_optim":false` [S8]，GLM5 教程里写的是 `true`——按上一条，这两条命令在这个快照上都会直接启动失败。教程没跟上那次「删开关」的重构，照抄之前先确认你手上的 main 是哪一天的。

**它和 PD 的关系在两代里是两种约束。** 发布分支上「只在 P 节点开」是文档里的一句话，配错了没人拦 [S10]（[v0.23 线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)）；main 上这句话被写进了代码。从「靠人遵守」变成「硬判定」，是这个参数这一年里最实质的变化。

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
| main | 有（1 个文件） |

- **引入**：2026-06-10 · a53f8a023016219a3d5246a881d74d4d8d892f0c · PR [#10292](https://github.com/vllm-project/vllm-ascend/pull/10292) —— [Feature] add ascendc ops store_kv_block (#10292)
  包含该提交的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/attention/sfa_v1.py` +51 / −10（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +3 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −0（文本行变化）
  - `vllm_ascend/attention/utils.py` +4 / −0（文本行变化）
  - `vllm_ascend/spec_decode/llm_base_proposer.py` +3 / −0（文本行变化）
- **移除**：2026-09-07 · c30092741be0829dfb387103a32f433f5c0ecb5c · PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752) —— [Refactor] Auto-enable LI C8 reshape optimization (#15752)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/ascend_config.py` +21 / −10（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +2 / −2（文本行变化）
- **引入**：2026-09-20 · 1e0742722d149b99f91ece504180aa9bdf8b69af · PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952) —— [Misc][Config] Restore C8 reshape optimization switch (#16952)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ascend_config.py` +7 / −3（文本行变化）

当前含该标识符的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["c8_enable_reshape_optim"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:526` [C1] |
| 版本 | main · c173a64a44dec4ba97aaba6277b1dfc1562eda19 |

字段注释：

See https://github.com/vllm-project/vllm-ascend/issues/15896

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
