---
id: enable-force-eplb-b7ec3661121f
title: enable_force_eplb
type: param
summary: >-
  压测与上限分析专用开关：开启后丢弃 MoE 路由器算出的真实 topk_ids，改为按 ep_size / ep_rank 确定的轮转专家编号，保留原
  topk_weights（模型精度失效，严禁用于生产或精度评估）。默认 false，v0.30.0 与 main 均支持，与 dynamic_eplb 互斥。
origin: seed
aliases:
  - 强制 EPLB
  - 强制专家均衡路由
  - force_eplb
  - 轮转 topk_ids
  - additional_config.enable_force_eplb
chapters:
  - '14'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它改变什么为什么只是压测夹具
  事实表: 它改变什么为什么只是压测夹具
  为什么存在: 轮转表怎么算何时建表与缓存
  开了的代价: 代价互斥边界与放到-glm-双机
relations:
  - to: eplb
    kind: conflicts-with
    note: 和 dynamic EPLB 同开直接报错；EPLB 只换专家摆在哪张卡，本键换的是路由结果本身
  - to: expert-parallel
    kind: builds-on
    note: 轮转表按 ep_size / ep_rank 算，单张表的目标卡槽位数最多差 1；多张表合计是否均分还要核输入和专家摆放
  - to: acl-graph
    kind: builds-on
    note: 旧 model runner 在非捕获 dummy run 预建 capture size 对应表，减少捕获时缓存未命中的分配；完整缓存键仍须匹配
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 main 上 pydantic AscendConfig 的顶层 bool 字段，互斥检查跑在 derive_and_validate 而不是
      pydantic 校验里
  - to: collective-communication
    kind: builds-on
    note: 强制轮转路由用于构造均匀专家负载、压测 MC2 通信，其用途建立在 MC2 dispatch/combine 的派发与返回机制之上。
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L467'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L467
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L562-L570'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/routed_experts.py#L594-L633'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/force_eplb.py#L108-L142'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/force_eplb.py#L89-L105'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/force_eplb.py#L22-L56'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/force_eplb.py#L59-L86'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4193-L4195'
  - 'vllm-ascend@baa023ad:tests/ut/ops/test_force_eplb.py#L11-L33'
  - 'vllm-ascend@baa023ad:tests/ut/ops/test_force_eplb.py#L36-L58'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/routed_experts.py#L649-L650'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L334'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L478
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L493
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L576
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L32-L38'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_utils.py#L265-L276'
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L574
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L583
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L570
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L579
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L580
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L582
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L583
  - >-
    raw:sha256-1b4cc51a1f4a636b27d98f768b38bfd6df906729a912d35174f3b0963d7b958e.md#L1-L374
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L587
  - >-
    raw:sha256-22663fbb67b94b78a94597908871214213cd0d543e4e24aa6c5658c47df995d6.md#L1-L378
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ops/fused_moe/force_eplb.py#L90-L104
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L585
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L581-L585'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L696-L702'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/routed_experts.py#L679-L691'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L583
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L4274-L4279'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L588
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L580
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L690-L696'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/force_eplb.py#L24-L144'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/routed_experts.py#L670-L691'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4267-L4269'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L673'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L819-L833'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/force_eplb.py#L22-L112'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/routed_experts.py#L678-L688'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L214-L231'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1b4cc51a1f4a636b27d98f768b38bfd6df906729a912d35174f3b0963d7b958e.md
  - >-
    raw/sha256-322c4fa331ac972b9e6abed51ca84110948141f0fda37981d15a68d828a38b39.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
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
## 它改变什么，为什么只是压测夹具？

`enable_force_eplb` 是 `additional_config` 顶层的布尔开关，默认 `false`。它与 [EPLB](../concepts/eplb.md) 改变的对象完全不同：

- **真实 EPLB** 调整专家权重摆放在哪张卡上，路由器逻辑不变，模型精度保持等价。
- **`enable_force_eplb`** 改写的是路由结果本身——在每次 MoE 前向返回前，丢弃真实 router 算出的 `topk_ids`（每个 token 选中的专家编号），替换成按 `ep_size` 与 `ep_rank` 纯算术生成的轮转专家编号表，同时原封不动保留原始 `topk_weights`（各选中专家的加权系数）。

**这不是生产优化开关，而是压测与性能上限分析夹具。** 拿真实门控权重去加权一组强行指定的专家输出，模型输出与精度会彻底失效。它只适合在均匀、可重复的专家负载下测 MC2 通信带宽，或评估 EPLB 路径的性能天花板。

```wiki-diagram
file: param-enable-force-eplb-round-robin
```

各版本支持与启动校验差异如下：

| 版本 / 镜像 | 字段与实现状态 | 写入后的启动行为 |
| --- | --- | --- |
| `v0.23.0` / `v0.26.0rc` / GLM 固定镜像 `db701c1f` | 无此键，也无 `force_eplb.py` | 旧版 `AscendConfig` 逐键 `.get()` 会静默忽略 |
| `v0.30.0`（`c09d3e20`） | 已提供该键并启用严格顶层校验 | 拼错键名通常启动失败（检测到 `vllm_omni` 时告警并过滤未知顶层键）；路由替换处不打精度警告 |
| `main`（`8d6180e2`） | 已提供该键并启用严格顶层校验 | 拼错规则同 `v0.30.0`；在启动派生阶段主动打印精度失效与禁止生产警告 |

下面按核心维度汇总本开关的配置入口、生效优先级与硬约束：

| 维度 | 行为与约束 | 工程含义 |
| --- | --- | --- |
| 配置入口与默认 | `additional_config["enable_force_eplb"]`，`bool`，默认 `False` | 只有开关两档，无强度可调；通过 `--additional-config '{"enable_force_eplb": true}'` 开启 |
| 替换对象 | 仅整表替换 `topk_ids`，`topk_weights` 不变；开启 `mix_placement` 时追加在末尾的共享专家列也一并被换成路由专家编号 | 权重与专家编号脱钩，输出无意义，严禁用于精度验证 |
| 生效时机与优先级 | 每次 MoE 前向均生效；分支排在显存探测 `enable_force_load_balance`（`elif`）之前 | 连 profile / dummy run 原有的随机均衡也会被覆盖；当前向无通信方法时返回 `None` |
| 与 EPLB 摆放关系 | 先完成 `log2phy`（逻辑专家号到物理槽位的映射）物理映射，随后整表覆盖；编号仅覆盖 `0..num_logical_experts-1` | 不保留物理映射结果，也不保证适配静态/冗余专家摆放 |
| 互斥与硬约束 | 同时开启本键、`eplb_config.dynamic_eplb`、模型配置已就位且模型为 MoE 时抛 `ValueError`；建表要求 `num_tokens > 0`、`top_k > 0`、`ep_size > 0` 且 `num_logical_experts % ep_size == 0` | 非 MoE 模型不触发互斥报错与预热；整除失败在建表时直接抛 `ValueError` |

## 轮转表怎么算，何时建表与缓存？

不同模型与 prompt 会产生悬殊的专家热度分布，最忙的卡会拖慢整次 MoE 通信与计算。`enable_force_eplb` 通过 `_build_round_robin_topk` 生成只与形状和 rank 相关的确定性路由表，把过去分散的环境变量、逐层缓存与预建逻辑收口到配置生命周期和通信方法缓存中：

```python
experts_per_rank = num_logical_experts // ep_size
expanded_offset  = num_tokens * top_k * ep_rank + ep_rank
cursor = arange(num_tokens * top_k) + expanded_offset
col = cursor % ep_size                                  # 落到哪张卡
row = (cursor // ep_size) % experts_per_rank            # 卡内第几个专家
expert_ids = row + col * experts_per_rank
```

`col` 逐槽位轮换 EP rank，`row` 在卡内轮换专家，单张表内具备两条确定性质：

- **单表均匀边界**：任意连续 `ep_size` 个槽位正好每张卡各 1 个，任意连续 `num_logical_experts` 个槽位正好每个专家各 1 个。在每卡连续存放一段逻辑专家编号的前提下，只要 `num_tokens × top_k` 是 `ep_size` 的倍数，各目标卡槽位严格相等；各专家之间最多差 1，且当槽位总数是专家数的倍数时各专家恰好相等。
- **单表手算例（示意）**：8 专家、`ep_size=2`、`ep_rank=1`、2 token、`top_k=2` 时，4 个槽位排成 `[[6, 3], [7, 0]]`。同一 token 的两个槽位落在不同 rank，rank 0 收到专家 3、0，rank 1 收到专家 6、7，每卡各 2 个，其余 4 个专家为 0。

**偏移量不保证不同 rank 的表互异，也不保证跨 rank 合计均匀。** 示意 8 专家、EP4，每个发出 rank 各有 1 token、`top_k=3`：四个起点分别为 0、4、8、12，按专家数取模后 rank 0 与 2 均为 `[0, 2, 4]`，rank 1 与 3 均为 `[1, 3, 5]`。在每卡连续放 2 个专家的布局下，四个目标卡合计收到 `[4, 4, 4, 0]` 个槽位——单张表各卡最多差 1 仍成立，但多张表累加后偏差会叠加（见上图右栏）。

**逻辑专家数读取、覆盖时机与缓存键**：

- **逻辑专家数与覆盖点**：优先读取配置字段，缺失时再由总数扣除冗余和共享专家推得。`_select_experts` 做完 `log2phy` 物理映射（以及 `mix_placement` 追加共享专家列）后直接整表覆盖；若本次前向不存在 `moe_comm_method`，策略函数返回 `None`。
- **缓存粒度**：轮转表按完整键 `(num_tokens, top_k, num_logical_experts, ep_size, ep_rank, dtype, device)` 缓存在通信方法对象上。形状固定时只算一次；eager 模式下每种新的 `num_tokens` 都会多存一张表。

| 版本 | 预热与建表路径 | 捕获期与按需行为 |
| --- | --- | --- |
| `v0.30.0`（保留 MRV1） | 在非捕获 `_dummy_run` 中对 MoE 模型调用 `build_force_eplb_topk`，按全部 `cudagraph_capture_sizes`（空时用 `max_num_tokens`）× `{int32, int64}` 预建表 | 减少图捕获期缓存未命中；未命中其他完整缓存键时仍现场建表，不是“捕获期绝无分配”的保证 |
| `main` | 已移除 `model_runner_v1.py` 并删去 `build_force_eplb_topk` | 仅在首次遇到对应缓存键时按需建表并缓存 |

## 代价、互斥边界与放到 GLM 双机

- **模型精度完全失效，压测后必须关闭**：保留原门控权重却替换专家编号，即使个别编号或最终 token 偶合一致，也不能视为原模型推理。`v0.30.0` 在替换路由处不打印警告；`main` 在配置派生期打印明确的精度失效与禁止生产警告。
- **与 `dynamic_eplb` 四条件硬互斥**：配置派生时，若以下四条件同时成立，直接抛 `ValueError("enable_force_eplb cannot be mixed with dynamic_eplb.")`：
  1. 开启 `enable_force_eplb`；
  2. 开启 `eplb_config.dynamic_eplb`；
  3. `model_config is not None`；
  4. `model_config.is_moe` 为真。
  强制路由覆盖 `log2phy` 映射并抹除真实热度，不能拿它评估动态 EPLB 效果。静态摆放与冗余专家不被这条校验拦住，只是轮转编号仅覆盖逻辑专家范围，无法保证匹配实际物理摆放或均匀覆盖冗余位。非 MoE 模型不触发互斥报错与预热，路由替换也无 MoE 消费点（不排除其他配置报错）。
- **建表形状约束可能早于请求触发**：`num_tokens > 0`、`top_k > 0`、`ep_size > 0` 与 `num_logical_experts % ep_size == 0` 在建表时校验。`v0.30.0` 的 MRV1 路径在启动期非捕获预热就会立即建表；未预热的新缓存键或 `main` 按需建表路径则在首次遇到对应形状时触发。
- **放到 GLM 双机部署**：固定双机镜像 `db701c1f` 没有此键，旧配置路径会将其静默忽略。若迁移到包含此键的版本并沿用 288 个路由专家与 EP16，仅说明满足 `288 ÷ 16 = 18` 整除检查（不开 `dynamic_eplb` 亦避开互斥），不构成完整启动兼容证明；一旦进入强制路由分支，top-8 编号即被替换，不可用于精度验证。此外，[EPLB 负载不均估算](../concepts/eplb.md#负载有多不均只有理想均分没有实测) 中的每卡 6,048 行与纯 decode 每卡 38 行属于特定场景的理想均分估算，使用轮转表仍须核对每个发出 rank 的槽位合计，不能假定自动复现。

## 对照源码

下表对照 `enable_force_eplb` 在四个固定版本快照上的字段声明、互斥校验、预热路径与前向消费：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与文件 | 无（`force_eplb.py` 不存在）[C17] | 无 [C16] | `AscendConfig.enable_force_eplb: bool = False` [C42] | 同左 [C47] | 旧版 `.get()` 静默忽略；`v0.30.0` 与 `main` 有效 |
| 启动精度警告 | — | — | 无启动警告 | `derive_and_validate` 打印精度失效与禁用于生产告警 [C48] | `main` 显式提醒不可用于精度或生产 [!] |
| 互斥校验 | — | — | 4 条件同时成立抛 `ValueError` [C43] | 同左 [C48] | 非 MoE 模型不会触发该条互斥报错 [!] |
| 捕获前预建 | — | — | MRV1 非捕获 `_dummy_run` 调 `build_force_eplb_topk` [C46] | 已移除 `model_runner_v1.py` 与 `build_force_eplb_topk`，仅按需建表缓存 [C49] | `main` 不再走 MRV1 预热，首次遇到新缓存键时建表 |
| 前向消费 | — | — | `routed_experts.py` 先于 `enable_force_load_balance` 替换 `topk_ids` [C45] | 同左 [C50] | `mix_placement` 追加的共享专家列也一并被覆盖 |

- **轮转公式与整除校验**：`v0.30.0`（`force_eplb.py#L24-L144`，[C44]）与 `main`（`force_eplb.py#L22-L112`，[C49]）共用同一套取模轮转与缓存键逻辑；由该公式可推得单表按连续布局每卡至多差 1、跨 rank 偏移可累积形成 `[4, 4, 4, 0]` 偏差，以及覆盖 `log2phy` 后不保证适配静态/冗余摆放 [D]。
- **官方文档与历史引入**：`main` 的官方特性文档 `expert_parallelism_load_balancer.md#L214-L231` 将其明确定位为性能上限分析开关并警示精度失效 [S51]；早期 PR #15499 引入该键时主要完成了配置与缓存重构及静态检查，未附 NPU/ACLGraph 实测，且在连续编号假设外不可外推均分结论 [D]。
- **待核**：本工作区无 NPU 实机环境，尚无 GLM 双机或标准 MoE 部署下开启 `enable_force_eplb` 的端到端耗时与 MC2 吞吐实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_force_eplb` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["enable_force_eplb"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:580` [C42] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_force_eplb and self.eplb_config.dynamic_eplb and (vc.model_config is not None) and vc.model_config.is_moe:
    raise ValueError('enable_force_eplb cannot be mixed with dynamic_eplb.')
````
