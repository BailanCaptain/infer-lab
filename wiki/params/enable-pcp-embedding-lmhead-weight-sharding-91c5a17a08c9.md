---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: >-
  PCP>1 且模块匹配时，把 embedding 与 LM Head 补齐后的词表权重按 TP×PCP 网格切分。bool 默认 true，要旧行为得显式写
  false；与细粒度 TP 的 embedding/lmhead 两键互斥。旧 v0.23、v0.26、固定 main 没有，rc2 已有；GLM 双机不开
  PCP 也用不到。
aliases:
  - enable_pcp_embedding_lmhead_weight_sharding
  - PCP embedding/LM-head 权重切分
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
verified:
  - main
relations:
  - to: context-parallel
    kind: builds-on
    note: >-
      PCP 是那一页讲的 prefill 上下文并行；这个键管权重侧——PCP 组里 embedding 和 LM Head 还要不要每卡各存一份完整的
      TP 切片
  - to: fine-grained-tp
    kind: conflicts-with
    note: >-
      和它的 embedding_tensor_parallel_size / lmhead_tensor_parallel_size
      切的是同一批权重，撞上在权重构建期直接 ValueError，二选一
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L480
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ops/vocab_parallel_embedding.py#L95-L134
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L329-L354
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L820-L845
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/utils.py#L1493-L1498
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/utils.py#L195-L198
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/configuration/additional_config.md#L80-L80
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/feature_guide/context_parallel.md#L67-L67
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L495
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ops/vocab_parallel_embedding.py#L536-L568
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ops/vocab_parallel_embedding.py#L299-L400
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L576
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L585
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L572
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L581
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L582
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@25e376b3c7821ddf894e2a05a4e29ef019db94ad:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L585
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L589
  - >-
    raw:sha256-326089938abf0b3c66ef428d043ed506065b100da153c865b38659afcc1ff94a.md#L1-L298
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ops/vocab_parallel_embedding.py#L98-L109
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ops/vocab_parallel_embedding.py#L331-L340
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L587
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L584-L585'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L92-L133'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L585
  - 'vllm-ascend@4d1412d1:vllm_ascend/ops/vocab_parallel_embedding.py#L185-L263'
  - 'vllm-ascend@39fef3f8:vllm_ascend/ascend_config.py#L1737-L1761'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1648'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L403'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L590
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-30bfc68d9d6c6cd14e897e08621272fd2703c84fe763ca84d30ff0df03a62926.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-5736c0dce478d0b48ce8ced966bd850c340874600180f3c4c62a49cae28e935c.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
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
---
## 一句话

**v0.30.0rc2 对照：** 已提供此键，默认 True；PCP>1 且匹配 embed_tokens/head 的模块才采用 TP×PCP 词表分片。关闭时回到普通 TP 或适用的细粒度 TP。显式 disable_tp=True 的 ParallelLMHead 优先保持完整复制，不会仅因名字含 head 被切开；PCP 词表分片与对应 embedding/lmhead 细粒度 TP 同开会报错。rc2 还要求使用 V2 model runner 才允许 PCP>1。早期快照的 enable_reduce_sample 互斥检查不再适用于 rc2：rc2 已没有该旧键，正常严格配置会将它作为未知顶层键拒收，Omni 兼容分支则告警过滤。

开了 PCP（prefill_context_parallel_size > 1，见 [Context Parallel](../concepts/context-parallel.md)）后，未禁用 TP 且名称匹配的 embedding 和 LM Head 默认按 **TP × PCP 网格**切开词表权重（PCP 是内维）。每卡的词表行数是补齐后总行数的 1/(TP×PCP)，还须满足分片整除条件；量化辅助张量和通信缓冲另计。这个键默认 true，要保持 PCP 组内各卡保存完整 TP 切片的旧行为，需显式写 false。PCP=1 时不会进入这条 PCP 分片路径。

**旧 v0.23、v0.26 与固定 main 没有，rc2 已有。** 它在 2026-09-23 随 PR #17159 进入上游 main（见[版本谱系](#版本谱系)），比固定 main `baa023ad` 晚两天；旧发布分支 `2c59ff10`、`2ed6cbba` 也没有 [D]。历史机制走读使用扫描时的 `4d1412d1`，当前自动参数定义已换成 rc2。GLM 双机主线不开 PCP，这个键在原部署上不生效也开不起来（见事实表「GLM 双机」）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:585` [C28] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` [C1] | 顶层键；配置类 docstring 的全量键示例里列着它，默认 `true` [C3] |
| 类型与默认 | bool，默认 True | 关闭需要显式写 false；默认开启仍受模块与 PCP 条件约束 |
| 生效门 | prefix 字符串包含 embed_tokens 或 head、这个键为真、PCP>1，且未先进入复制分支 [C2] | 判断是字符串包含关系；PCP=1 不安装这条分片路径 |
| 优先生效的复制分支 | 先检查 `disable_tp`；为真时直接选择复制模式 | 该判断先于 PCP 权重分片选择，需确认模块未显式禁用 TP |
| 与细粒度 TP | 逐模块判：embedding 匹配其细粒度 TP，head 匹配 LM Head 的细粒度 TP，冲突即 ValueError [C2] | 在实际构建对应模块且选择 PCP 分片时检查；显式复制分支优先返回 |
| 与 enable_reduce_sample | 39fef3f8 中，同开且 PCP>1 会抛 ValueError [C4] | rc2 已移除该旧键，见开头的版本说明 |
| 读取方式 | 访问函数缓存结果 [C5]；配置工厂发布新单例和清理配置时会清缓存 | 直接改旧对象不会更新已缓存结果，也不能自动重建权重布局 |
| 官方文档 | 39fef3f8 参数表和 CP 指南写明默认开、PCP>1 及当时的互斥条件 [S7] | 按该快照理解；关闭方式是写 false [S8]，不能把旧互斥检查套到 rc2 |
| 覆盖版本 | 固定 rc2 有；旧 v0.23 2c59ff10、v0.26 2ed6cbba、main baa023ad 无 | 旧普通构造器不消费该键；baa 通常拒收未知键，能发现 Omni 时告警过滤；rc2 还受 runner 条件限制 |
| GLM 双机 | 这套部署 PCP=1、DCP=1，生效门的 PCP 条件不成立；34 层 KDA 的 prefill 在 PCP > 1 时直接抛 `NotImplementedError`，见 [CP 页的 GLM 一节](../concepts/context-parallel.md#放到-glm-双机这套部署开了-cp-吗) | 主线上它既不生效、也开不起来；每卡 embedding 与 `lm_head` 仍是各一份完整 TP 切片，份额见[每张卡上放了什么](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)（本页不重算） |

## 为什么存在

embedding 和 LM Head 通常是「词表 × hidden」的大矩阵。TP 已按词表维切分，而 PCP 组内原本各卡保存相同的 TP 切片。本实现把 TP×PCP 网格线性化后再分词表行；在相同补齐规则、可整除且格式一致的条件下，单个矩阵每卡的行数缩到原来的 1/PCP，PCP=4 时该矩阵少存 3/4。显式 disable_tp 的复制权重仍走复制分支。

示意取补齐后的词表 8 行、hidden=2、TP=2、PCP=2。只按 TP 分时，每卡保存 4 行，即 8 个数；加入 PCP 分片后，四个逻辑分片分别保存词表行 0–1、2–3、4–5、6–7，每卡 2 行、4 个数。查询 token 5 时，只有保存行 4–5 的分片提供有效 embedding，其余分片贡献零；后面的归约把这份结果送回需要 token 5 的行。这里计算的是权重元素数，token 交换缓冲需要另算。

## 开了的代价

它默认开，需要关闭的常见情况包括：选择同一模块的细粒度 TP；在仍保留 enable_reduce_sample 的 39fef3f8 快照使用该功能；或在升级对照中先保留旧权重布局。关闭此键只控制这条 PCP 权重分片，不能替代其他配置检查。

**两侧都多出 PCP 组内通信。** embedding 一侧多两次：先在 PCP 组 all-gather 把组里的 token ID 收齐，再拿它们查本卡那片词表，查完在 PCP 组 reduce-scatter 把结果送回各自的 token 行，最后才在 TP 组 all-reduce 补齐词表维——这次 TP 归约只带本 PCP rank 的那些 token 行 [C12]。LM Head 一侧虽然不设这两个组，但常规取分数改走专门的路径：先在 PCP 组、再在 TP 组 all-gather 词表分片，才拼回完整 logits；只切 TP 时只在 TP 组 gather 一次 [C11]。所以常规取一次 logits 比不开它时多一次 PCP 组 all-gather；spec-decode 这类传 `skip_gather` 的调用方两条路径都不 gather，不在此列 [C11]。

**适用边界。** 上面的通信顺序使用 4d1412d1 走读，rc2 的配置入口、选择分支和 runner 限制另列在开头。1/PCP 是同格式、相同词表补齐条件下的分片比例；实际显存还包括交换缓冲，时延和精度需做设备对照。未知键处理是固定配置代码的推导，未提供真实启动日志。

token 交换路径还受静态容量限制：输入 token 数超过缓冲容量会直接报错，并提示检查图捕获上限和批次 token 预算。因此，权重放得下不代表 token 交换缓冲也足够。


## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_pcp_embedding_lmhead_weight_sharding` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

来源 2、23、27 对应复制分支优先、模块匹配与 TP×PCP 分片编号。来源 11、12 对应 logits 的两级 gather 与 embedding 的 token gather → PCP reduce-scatter → 条件 TP all-reduce；来源 24 是静态 token 容量拒绝条件，来源 29 给出词表补齐、分片行数和缓冲容量来源。

来源 4 的 reduce_sample 互斥属于 39fef3f8；rc2 没有该字段及执行消费者，来源 31 给出未知键过滤/拒收入口。来源 30 解释配置单例发布后的缓存清理；来源 32 是 rc2 的 V2 runner 条件，33 是固定 GLM KDA 的 PCP 拒绝，34 是旧 main 的 Omni 兼容过滤。设备占用和启动效果仍未实测。
