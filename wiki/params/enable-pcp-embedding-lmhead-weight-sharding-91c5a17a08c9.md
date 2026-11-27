---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: >-
  PCP>1 且模块匹配 embed_tokens/head 且未禁用 TP 时，按 TP×PCP 网格切分词表权重；默认 true，与同模块细粒度
  TP 互斥，main 还互斥 enable_batch_sharded_sampling。
aliases:
  - enable_pcp_embedding_lmhead_weight_sharding
  - additional_config.enable_pcp_embedding_lmhead_weight_sharding
  - PCP embedding/LM-head 权重切分
  - TP×PCP 词表切分
legacyAnchors:
  一句话: 它怎么按 TP×PCP 切分词表，生效门是什么？
  为什么存在: 网格切分示例与两侧新增通信
  开了的代价: 互斥规则、静态缓冲容量与部署边界
  互斥规则静态缓冲容量与版本与-glm-边界: 互斥规则、静态缓冲容量与部署边界
origin: seed
evidence: C
updated: 2026-11-19T00:00:00.000Z
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
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
  - to: ascend-config-system
    kind: builds-on
    note: 该顶层布尔键通过 AscendConfig 解析并带缓存读取，配置工厂刷新与未知键校验机制见该页
  - to: embedding
    kind: builds-on
    note: 开启后 embed_tokens 词表查表按 TP×PCP 网格分片并新增 PCP 组内 All-Gather 与 Reduce-Scatter
  - to: lm-head
    kind: builds-on
    note: 开启后 lm_head 词表投影按 TP×PCP 网格分片，常规路径在 TP 汇聚前多一次 PCP All-Gather
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
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L582
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/vocab_parallel_embedding.py#L92-L133'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1652-L1658'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L675-L675'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1037-L1053'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/vocab_parallel_embedding.py#L92-L133'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L2107-L2113'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1322-L1436'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1432-L1467'
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
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 它怎么按 TP×PCP 切分词表，生效门是什么？

开启 PCP（`prefill_context_parallel_size > 1`，预填充上下文并行，见 [Context Parallel](../concepts/context-parallel.md)）后，若只按 TP 切词表维，PCP 组内每张卡仍会重复保存同一份词表切片。`enable_pcp_embedding_lmhead_weight_sharding`（`bool`，默认 **`True`**）把这份重复切片沿 PCP 维度再均分一刀，让每张卡少存 $(1 - 1/\text{PCP})$ 的词表行（多模态模型的图像特征走独立的[多模态编码器缓存](../concepts/multimodal-encoder-cache.md)，不经过这里的文本词表矩阵）。

只要模块未设 `disable_tp=True` 且名称含 `embed_tokens`（首层词表查表，见 [embedding](../concepts/embedding.md)）或 `head`（末层词表投影，见 [LM Head](../concepts/lm-head.md)），补齐后的词表行数就会按 **TP × PCP 网格**（PCP 为内维）切成 $1 / (\text{TP} \times \text{PCP})$。之所以两侧新增通信次数不同，是因为输入查表要先凑齐各卡的 token 编号、查完再把向量归约发回对应卡（多 2 次通信），而输出投影只需在算完本地词表分片分数后拼回完整词表维（常规路径多 1 次通信）。

常规 PCP 部署保持默认 `true` 即可。若要改用 `finegrained_tp_config` 下的[细粒度 TP](../concepts/fine-grained-tp.md)（仅限 MoE 模型，且模块 TP 大小必须整除 `data_parallel_size`），或在 `main` 上同时开启 `enable_batch_sharded_sampling`，则必须把本键显式设为 `false` 以避开 `ValueError`。下面以 MoE 模型 `Qwen/Qwen3-30B-A3B` 演示关闭本键、让路 `finegrained_tp_config.lmhead_tensor_parallel_size` 的写法（若在 `Qwen/Qwen3-8B` 等稠密模型上仅需回退旧词表布局，只传 `'{"enable_pcp_embedding_lmhead_weight_sharding": false}'` 即可；本工作区无 NPU 实机执行验证）：

```bash
VLLM_USE_V2_MODEL_RUNNER=1 vllm serve Qwen/Qwen3-30B-A3B \
  --data-parallel-size 4 \
  --tensor-parallel-size 1 \
  --prefill-context-parallel-size 2 \
  --enable-expert-parallel \
  --additional-config '{"finegrained_tp_config": {"lmhead_tensor_parallel_size": 2}, "enable_pcp_embedding_lmhead_weight_sharding": false}'
```

## 事实表

启用 `PCP > 1` 或组合细粒度 TP 时，先核对下表中的生效门与硬互斥条件：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]`（`bool = True`） | `v0.30.0` 与 `main` 默认开启；带缓存读取，不支持运行期热切换 |
| 生效门与优先级 | `disable_tp` 为真时优先保持复制；否则要求 `prefix` 含 `embed_tokens` 或 `head`、本键为真且 `PCP > 1` | `PCP = 1` 不触发；显式传 `disable_tp=True` 的特殊头（如 `markov_head`）不会被切开 |
| 细粒度 TP 与采样互斥 | 与 `finegrained_tp_config` 同模块切分同开抛 `ValueError`；`main` 另互斥 `enable_batch_sharded_sampling`（`PCP > 1` 时） | 细粒度 TP 的关闭默认值在 `v0.30.0` 为 `0`、`main` 为 `1`（兼容 `0`），启用时还须满足 MoE 模型与整除 `DP` |
| 新增通信与缓冲约束 | `embed_tokens` 多 2 次 PCP 通信（All-Gather 凑齐输入 + Reduce-Scatter 归约发回），`lm_head` 常规路径多 1 次 PCP All-Gather | 词表侧受静态 token 交换缓冲上限约束，单步 token 超限会直接报错 |
| 版本与 runner 门槛 | PR #17159 引入；`v0.30.0` 与 `main` 支持且要求 [Model Runner V2](../concepts/model-runner-v2.md) 才允许 `PCP > 1` | `v0.23.0` 与 `v0.26.0rc` 无此键（旧构造器静默忽略） |

## 网格切分示例与两侧新增通信

```wiki-diagram
file: param-pcp-embed-lmhead-sharding
```

用一个整数示意观察切分与通信：假设补齐后的词表共 8 行、`hidden = 2`、`TP = 2`、`PCP = 2`。只按 TP 切时每卡存 4 行（8 个数）；开启 PCP 分片后，四个逻辑分片分别保存词表行 `0–1`、`2–3`、`4–5`、`6–7`，每卡只存 2 行（4 个数）。查询 token 5 时，只有保存行 `4–5` 的分片给出有效向量、其余分片贡献 0，再通过后续归约把结果送回需要 token 5 的位置（此例只计权重元素，不含交换缓冲）。

**权重省下来，两侧都会多出 PCP 组内通信**：

| 模块侧 | 开启 PCP 词表分片后的通信顺序 | 相对仅 TP 切分的增量 |
| --- | --- | --- |
| **`embed_tokens` 侧** | ① PCP 组内 All-Gather（把各卡负责的子序列 token 编号收集拼齐到每张卡） → ② 本地查表（未命中本分片行置 0） → ③ PCP 组内 Reduce-Scatter（把各分片查出的向量相加归约，再按卡切分发回各自持有段） → ④ TP 组内 All-Reduce 补齐词表维 | **多 2 次 PCP 通信**（All-Gather + Reduce-Scatter） |
| **`lm_head` 侧** | ① 本地词表分片投影 → ② 常规路径先在 PCP 组 All-Gather（收集各 PCP 分片的词表分数） → ③ 再在 TP 组 All-Gather 拼回完整 logits | 常规路径 **多 1 次 PCP All-Gather**；spec-decode 等传 `skip_gather` 的调用方两条路径均不 gather，不受影响 |

## 互斥规则、静态缓冲容量与部署边界

- **细粒度 TP 与采样互斥规则**：为同一模块配置 `finegrained_tp_config.embedding_tensor_parallel_size` 或 `finegrained_tp_config.lmhead_tensor_parallel_size` 时，必须把本键设为 `false`。注意两版的关闭默认值不同：`v0.30.0` 中细粒度 TP 字段默认 `0` 表示关闭（`> 0` 即启用），而 `main` 默认 `1` 表示关闭（`> 1` 才启用，同时兼容旧配置写 `0`）；启用细粒度 TP 还要求模型为 MoE 且 `data_parallel_size` 能被该模块 TP 大小整除。此外，`main` 在 `PCP > 1` 时将本键与批次切分采样 `enable_batch_sharded_sampling` 设为互斥，升级对照或启用上述任一特性时均需显式传 `false`（关闭本键不跳过其他配置校验）。
- **静态 token 交换缓冲容量限制**：`embed_tokens` 侧的 PCP token 交换使用预分配的静态缓冲区。即使权重显存充足，只要单步输入 token 数超出该缓冲上限，运行期仍会直接报错并提示核对图捕获上限与单步批 token 预算。
- **拓扑与混合架构边界**：当 `PCP = 1` 时本键不进入 `TP × PCP` 分片路径，词表仍保持纯 TP 切分。历史双机案例中的 `PCP = 1` 限制、KDA 预填充拦截与每卡 `151.25 MiB` 词表切片口径，统一汇总在[固定双机的参数边界](../concepts/glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)与[每张卡上放了什么](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)。

## 对照源码

下表汇总 `enable_pcp_embedding_lmhead_weight_sharding` 在四个基线版本的字段、复制分支与互斥规则对照，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认 | 无（旧构造器忽略） | 无（旧构造器忽略） | `bool = True` [C36] | `bool = True` [C39] | 要回退旧布局须显式设 `false` [S8] |
| 复制分支与模块匹配 | — | — | `disable_tp` 优先；匹配 `embed_tokens` / `head` 且 `PCP > 1` [C37] | 同 `v0.30.0` [C41] | 显式 `disable_tp=True` 的 `ParallelLMHead` 保持复制不被切开 |
| 细粒度 TP 默认与互斥 | — | — | 细粒度 TP 默认 `0` 为关（需 MoE 且整除 `DP`）[C43]；与本键同开抛 `ValueError`；`PCP > 1` 需 V2 runner [C37][C38] | 细粒度 TP 默认改为 `1`（兼容 `0`）[C44]；新增与 `enable_batch_sharded_sampling` 互斥 [C40][C42] | 早期 `enable_reduce_sample` 旧键已在 `v0.30.0` / `main` 移除 [!] |

- **配置定义、互斥与缓存清理**：`v0.30.0` 见 `c09d3e20:ascend_config.py#L582, #L1322-L1436`、`vocab_parallel_embedding.py#L92-L133` 与 `platform.py#L1652-L1658`（来源 36–38、43）；`main` 见 `8d6180e2:ascend_config.py#L675, #L1037-L1053, #L1432-L1467`、`vocab_parallel_embedding.py#L92-L133` 与 `platform.py#L2107-L2113`（来源 39–42、44）。历史引入快照（`39fef3f8`、`4d1412d1`、`7d825229`）、缓存清理与官方文档见来源 1–8、23–27、30–32 [S7][D]。
- **切分、通信顺序与缓冲容量**：`4d1412d1:vocab_parallel_embedding.py#L185-L263, #L299-L400, #L536-L568`（来源 11–12、24、29）对应词表补齐、分片行数、缓冲容量拒绝条件、LM Head 两级 gather（及 `skip_gather` 例外）与 embedding token gather → PCP reduce-scatter → 条件 TP all-reduce [C11][C12]；GLM KDA 拒绝 `PCP > 1` 与旧 Omni 过滤见来源 33–34。
- **待核**：`1/PCP` 为同格式同补齐条件下的权重分片比例，实际整卡显存（含交换缓冲）、时延与精度对照在本工作区尚无 NPU 实机验证 [D]。


## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_pcp_embedding_lmhead_weight_sharding` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:582` [C36] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
