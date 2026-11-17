---
id: sfa-dcp-force-tmajor-restore-6d9c266d3ece
title: sfa_dcp_force_tmajor_restore
type: param
summary: >-
  DCP 解码路径上 query gather 之后，是否要求恢复为 t-major 连续存储；只有恢复视图尚不连续时才额外复制。 这是布局对照开关，默认
  false 保留视图。固定 main 与 rc2 都有；它只影响命中该分支的 SFA-DCP 布局恢复。
origin: seed
aliases:
  - SFA DCP t-major 还原
  - 强制 t-major 连续化
  - DCP query gather 布局回退
chapters:
  - '15'
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
## 一句话

**v0.30.0rc2 对照。** rc2 已包含此键，默认 false，延续已钉 main 的布局对照语义。DCP query gather 后，消费处把开关取反传给 keep_view：false 保留 strided view，true 要求 t-major 连续布局；若恢复视图本来就连续，连续化调用直接返回原张量。它仍是布局回退开关，不是开启 DCP 的开关；两种布局的快慢需要在具体设备上比较。

这是一个**回退开关**，不是一个特性开关。DCP（decode context parallel，解码期的上下文并行；历史位置怎么分着存见[上下文并行](../concepts/context-parallel.md#历史位置怎么分着存)）的普通 query 汇聚路径把头维分片收集起来：通信缓冲以头为第一维，注意力计算则以 token 为第一维。转回的方式有两种：`permute` 出一个共享原存储的视图（默认），或者再跟一次 `.contiguous()`，要求 `[T, H, D]` 连续存储。这个键为真就选后者；只有视图尚不连续时才真的物化另一份数据 [C5]。

**默认 `false` 走的是优化后的那条路。** 引入它的 PR 标题写得很直白——「Optimize the DCP decode query-gather layout path」；代码注释也说，交给 `npu_sparse_flash_attention` 的那几段 query 一直都是 strided view（`torch.split` 从不拷贝），旧写法的 `permute + contiguous` 只是顺带把 t-major 存储物化了一遍，而这个键**把那次物化保留成可选项，供对照实验用** [C4]。

**存在范围。** 固定 main 与 rc2 有此键，2026-09-16 由 PR [#15970](https://github.com/vllm-project/vllm-ascend/pull/15970) 引入。v0.23 和 v0.26 固定快照没有该键、`enable_sfa_dcp_force_tmajor_restore` 函数和 `ops/triton/query_gather_prep.py`，旧 `AscendConfig` 逐键 `.get()`，配了静默忽略 [C16][C17]。固定 main 与 rc2 严格校验拼写；能发现 vllm_omni 时，仅未知顶层键会先警告并过滤 [C15][C24]。GLM 部署 `db701c1f` 同样没有该键、沿用旧 `.get()` 解析，写入不报错也不生效。

**固定GLM镜像没有这个键；新版也不能仅靠开启DCP让它作用于kpool。** 本站[固定部署](../concepts/glm-5-3-flash-two-node.md#部署前提)的DCP、PCP都为1，且db701c1f没有该字段。main baa023ad与rc2的model_uses_sfa_sparse还会排除带index_kpool的模型，GLM-5.3-Flash属于这类；旧db701c1f同名函数没有这道排除，但它本来就没有本开关。新版中，即便DCP>1，GLM也不会因此进入本键控制的LightningIndexer SFA-DCP实现。kpool的后端入口见[注意力后端家族](../concepts/attention-backend-family.md#一个稀疏-mla-层其实注册了三个条目)，rc2排除判断在utils.py 196–217。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / 默认 | `bool` / `False` | 默认即「不物化」，也就是 PR 优化后的行为 |
| 唯一消费点 | `AscendSFADCPImpl._execute_sparse_flash_attention_process` 里的 `keep_view=not enable_sfa_dcp_force_tmajor_restore()` [C4] | 全仓库只有这一处读它，没有第二条路径 |
| 生效前提 | 模型走 SFA 稀疏注意力（kpool indexer 那一类被判断开头排除在外）**且** `decode_context_parallel_size > 1` [C13] | 两条缺一条，`resolve_sfa_impl` 就不会选到带 DCP 的实现类；GLM 卡在第一条上 |
| 只影响哪一趟 | 批次里**没有** prefill 的那一趟 [C7] | 有 prefill 时走的是 KV-gather 分支、提前 `return`，那条分支自己写死 `.contiguous()`，与本键无关 [!] |
| 开了多做什么 | 恢复排列非空时调用 `.contiguous()` [C5] | 若恢复后的整体视图不连续，就复制其中全部元素；不同实现的 gather 范围需分别算 |
| 关了少做什么 | `permute` 之后直接 `torch.split`，这两步不复制数据 | 保留原缓冲的视图；视图可能连续，也可能不连续，不能仅由开关值断言 |
| 同时开了 DSA-CP | 本键**失效** [D] | DSA-CP 的 query gather 维是 0，`restore_perm` 为 `None`，`permute` / `contiguous` 整段被跳过 [C9] [!] |
| 读取方式 | 没有 `lru_cache`，每次走到现读一次配置单例 | 同批的 `enable_dsa_cp`、`enable_pcp_o_proj_weight_sharding` 都带 `lru_cache(maxsize=1)`，这个没有 |
| 官方说明入口 | 配置字段和运行时分支 | `AscendConfig` 文档字符串给出了配置入口示例 [C14]；PR #15970 说明了布局优化动机 |

整块查询缓冲连续，不等于拆出的每个片段也连续：沿最后一维切分仍可能得到带跨步的视图。这个开关控制恢复时的整体布局，不能单凭开关值判断后续片段是否连续。


## 为什么存在

DCP 把 KV cache 沿序列维交错分给组内各卡，各卡算自己那部分 KV 的注意力，最后按 LSE 合并。普通 DCP 路径还需汇聚 query 的头维分片。这次汇聚的**布局**是有讲究的：此处使用的异步 helper 按第 0 维扩展接收缓冲，而要 gather 的是 head 维（dim 1），所以代码先 `permute` 成 head-major 再发，收回来再 `permute` 回去。这是该 helper 的接口约定，不是所有 All-Gather API 都只能按第 0 维汇聚。

热路径上还有一步单独的准备：普通 DCP 在头维汇聚、输入为 NPU 张量时，优先调 Triton 的 `prep_query_head_major`，把 `ql_nope` 和 `q_pe` 一次拼成 head-major。把两个 query 片段合并通信，是为避免源码注释记录的连续两次 gather 流依赖问题；融合准备 kernel 则把 cat、permute 和连续化合成一次写入。空输入或无法证明 fast path 地址合法时返回空值，调用 kernel 抛异常也会退回 torch 拼装；但两片段形状或 dtype 不匹配，在进入尝试前就会报错，不能靠回退修复 [C6]。

收回来之后的那一步就是本键管的地方：

```python
gathered = context.gathered
if context.restore_perm is not None:
    gathered = gathered.permute(context.restore_perm)
    if not keep_view:
        gathered = gathered.contiguous()   # ← 本键为真时走这里
return torch.split(gathered, context.split_sizes, dim=-1)
```

`permute` 改的是视图的维度和步长，不搬动底层数据；这不等于 Python 调用和元数据操作完全没有耗时。上游利用注意力算子接受跨步 query 的条件，让恢复时的整块连续化成为可选项。它可能省掉一次复制，但下游 kernel 对布局的性能反应仍需测量，不能只看少了一次调用就保证端到端更快。

## 开了的代价

**是否复制，看恢复视图；复制多少，看实际 query 缓冲。** 对普通 DCP 的头维汇聚，设汇聚前本地形状为 [T, H, D]，D 是两个 query 片段的宽度之和，组大小为 G，恢复后的整体形状是 [T, G×H, D]。若它不连续，额外复制 T×G×H×D 个元素。示意 T=2、H=2、D=3、G=2：头优先缓冲 [4, 2, 3] 的步长是 [6, 3, 1]，交换前两维后形状 [2, 4, 3]、步长 [3, 6, 1]，连续化会重排 24 个元素。若 T=1，则 [4, 1, 3] 交换成 [1, 4, 3] 后已连续，无须复制。这些是形状与步长演算，不是设备实测。

**PCP+DCP 不能直接套上面的 G=DCP 倍数。** baa023ad 的组合子类另写了 query 准备：DCP 大小等于 PCP 大小时直接使用本地 head-major 张量，不发这次 query gather；否则沿其 TP 组汇聚。恢复仍经过本键，但复制量要按该分支实际拿到的张量计算。

**默认保持 false；需要比较布局影响时再开 true。** 上面的乘法只在实际需要复制时给出元素数，不能换算成固定微秒或吞吐收益。引入提交说明使用 AISBench/GSM8K 测试，但未给开关对照数表。待核：缺同模型、同 DCP 组大小、同批次下两种布局的输出与时延实测。

**批次里只要有 prefill，这个键就不起作用。** `_execute_sparse_flash_attention_process` 先判 `_has_prefill`：有就走「gather 完整 KV、query 留本地」那条分支并直接 `return`，本键所在的那几行根本到不了 [C7]。连 query gather context 的记录都带着同一个判断 [C8]。所以在 chunked prefill 常开的部署里，它只在纯解码的那些步上有效 [!]。

**开了 DSA-CP 它就彻底没意义。** DSA-CP 切的是 token（gather 维 0），`_all_gather_dim_async` 在 `dim == 0` 这一支直接返回 `restore_perm=None` [C9]；而 `restore_perm` 为 `None` 时 `permute` 和 `contiguous` 两句一起被跳过 [C5]。`AscendSFADSADCPImpl` 按 MRO 拿到的 `_parallel_query_gather_dim` 是 `AscendSFADSACPImpl` 那个返回 0 的版本 [C10]，不是基类返回 1 的版本 [C11]——这一步是顺着继承链推的，不是源码里写死的一句话 [D]。结论：`enable_dsa_cp: true` 时配这个键完全不产生任何行为差异，也没有告警 [!]。名字里的 `dcp` 指的是 decode context parallel，不是 DSA-CP——这两个键不是一套，别当成要一起配的。

**读取函数没有缓存，不代表提供在线改配置接口。** 每次 Python 执行走到 getter 都读当前配置对象的属性。配置工厂可以发布新的、已验证的单例，并清理其他派生缓存，因此不能说对象启动后永远不变；这也不等于修改启动参数能即时改变正在服务的实例。这里没有在线重配置和图重捕获的完整流程说明。

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

## 对照源码

### 源码位置

来源 3 的 `utils.py` 1500–1506 行已按 baa023ad 核对：本键读取函数没有 `lru_cache`，调用时读取配置单例；读取方式表格的实现依据保留在这里。

baa023ad的_finish_dcp_gather仅在句柄非空时先wait，再在恢复排列非空且不保留视图时连续化；开关不改变等待的通信对象，所以不能由此推导通信量减少（来源5）。第0维分支返回空恢复排列，含prefill分支提前返回，因此不受这项恢复选择影响（来源7–9，sfa_cp.py 1145–1172、1307–1320、1366–1412）。

布局对照应固定模型、批次、DCP 组大小及其他配置，并确认进入了实际受本键控制的恢复排列分支，再检查输出、时延、吞吐和峰值显存。此处仅核了源码，尚无这样的设备对照，不能把对照开关说成已经验证的具体故障修复；分配开销与其他操作能否重叠也仍待实测。

- 来源 34、35：vllm-ascend@baa023ad，vllm_ascend/attention/context_parallel/sfa_cp.py，L1151–L1157、L1428–L1437。
连续化在已连续时直接返回原张量，依据 PyTorch API 契约（来源 42）；普通 DCP 的 helper 与 PCP+DCP 的不同汇聚范围分别见来源 48、43。fast path 的空输入、地址条件和回退边界见来源 6、45；prefill 判断与 DSA-DCP 继承关系见来源 46、47。配置工厂替换单例见来源 44。rc2 的恢复分支和未知键处理分别见来源 49、50。
