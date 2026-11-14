---
id: enable-force-eplb-b7ec3661121f
title: enable_force_eplb
type: param
summary: >-
  把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_rank 算出来的轮转表，让每张卡收到的 token
  分布更可控——压测和算子调优用，会改变模型路由语义，不能拿其输出测原模型精度。默认 false，固定 main 与 rc2 有此键；GLM
  双机部署用的旧版本里没有，没开。
origin: seed
aliases:
  - 强制 EPLB
  - 强制专家均衡路由
  - force_eplb
  - 轮转 topk_ids
chapters:
  - '14'
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

**v0.30.0rc2 对照：** 默认仍为 False。启用后在 routed experts 返回前替换 topk_ids，保留的 topk_weights 不能恢复原始路由含义；它仍用于压测与调优。MoE 同时打开它与 eplb_config.dynamic_eplb 会在配置派生时抛 ValueError，不能把强制均匀路由当作保持模型结果的动态 EPLB。

名字里有 EPLB，但改变的对象和 [EPLB](../concepts/eplb.md) 不同：EPLB 换的是**专家摆在哪张卡**，`enable_force_eplb` 换的是**路由结果**——把 router 选出来的 `topk_ids` 整张表换成按 `ep_size` / `ep_rank` 算出来的轮转 id。单张表按常规连续专家摆放分配时，各目标卡的槽位数最多差 1；跨多个发出 rank 的总量是否均匀，要另算，不能把单表结论直接推广。代价是专家选择不再服从模型的 router。

**这不是一个「优化」开关，是一个压测夹具。** `topk_weights` 原封不动、`topk_ids` 全换掉，等于拿真实的门控权重去加权一组随便指定的专家输出。默认 `false`；真要开，只该出现在测 MC2 通信带宽、测算子在均匀负载下的上限这类场景里。

**存在范围。** 固定 main 与 rc2 有此键，2026-09-02 由 PR [#15499](https://github.com/vllm-project/vllm-ascend/pull/15499) 引入；v0.23 维护分支与 v0.26 固定快照连 `force_eplb.py` 文件都没有，旧 `AscendConfig` 逐键 `.get()`，配上静默无效。固定 main 和 rc2 使用严格配置，拼错通常启动失败；能发现 vllm_omni 时警告并过滤未知顶层键。

GLM 双机部署跑的是含 GLM 代码的 db701c1f 快照，里面没有这个键，没开；换到 main 上会怎样，见「开了的代价」末尾的「放到 GLM 双机」。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / 默认；GLM 双机 | `bool` / `False`；本部署跑的 db701c1f 里没有这个键，没开 | 只有开和不开，没有强度可调。本部署写进配置也被静默忽略；其他版本能否启动须核完整兼容条件 |
| 换掉的是什么 | 只有 `topk_ids`，`topk_weights` 不动 | 权重来自真 router、专家来自轮转表，两者对不上——**输出没有意义**，别拿它测精度。打开 mix_placement 时，追加在末尾的共享专家那几列也一起被换成路由专家编号 |
| 生效范围 | 每一次 MoE 前向，不只是 profile / dummy run | 它排在 `enable_force_load_balance` 那条 `elif` 前面，所以连显存探测那一趟原本的随机均衡也被顶掉 |
| 与 EPLB 摆放的关系 | `log2phy` 先映射一遍，随后被整表覆盖 | 轮转编号不保留前面的映射结果。互斥检查只针对 dynamic EPLB；静态摆放和冗余专家不会被这条条件拦住，但编号只覆盖逻辑专家数范围，不能保证符合实际物理摆放或让冗余位置均衡受载 |
| 互斥 | 本键 + `eplb_config.dynamic_eplb` + MoE 模型 → `ValueError` | 条件缺一不可（源码里还有一条「模型配置已就位」，共四条）：模型不是 MoE 时**不报错**，只是这个键无处生效 |
| 硬约束 | `num_logical_experts % ep_size != 0` 直接 `ValueError` | 逻辑专家数优先读配置字段；字段缺失才由总数减去冗余和共享专家推得。错误在建表时发生，可能早在启动预热期；GLM 的 288 ÷ 16 = 18 仅通过这一项整除检查 |
| 轮转表长什么样 | 8 专家、`ep_size=2`、`ep_rank=1`、2 token、`top_k=2` → `[[6, 3], [7, 0]]` | 此例同一 token 的两个槽位落在不同 rank；偏移量与 ep_rank 有关，但不保证所有 rank 的表互不相同 |
| 缓存 | 按 `(num_tokens, top_k, 专家数, ep_size, ep_rank, dtype, device)` 缓存在 comm method 上 | 形状固定时只算一次；eager 模式下 `num_tokens` 每变一种就多留一张表 |
| 图捕获前预建 | model_runner_v1 的非捕获 `_dummy_run` 按各 capture size × `{int32, int64}` 建表 | 完整缓存键匹配时直接复用；尺寸表为空则只建 max_num_tokens，对其他缓存未命中仍会现场建表 |
| 官方说明入口 | 配置字段、运行时分支与 PR #15499 | 类文档字符串提供配置入口示例；PR 说明了统一配置、缓存和捕获前预建的设计 |

## 为什么存在

不同模型和 prompt 会产生不同的专家负载，较忙的卡可能拖长一次 MoE 通信和计算。轮转表让专家选择只由形状和 rank 决定，适合构造可重复的负载对照。它控制的是分配序列，不是直接保证实际吞吐上限。PR #15499 还明确说明了工程动机：把先前分散的环境变量解析、逐层缓存和预建逻辑集中到配置生命周期与通信方法缓存中。

`_build_round_robin_topk` 摁的方式是纯算术，不看数据：

```python
experts_per_rank = num_logical_experts // ep_size
expanded_offset  = num_tokens * top_k * ep_rank + ep_rank
cursor = arange(num_tokens * top_k) + expanded_offset
col = cursor % ep_size                                  # 落到哪张卡
row = (cursor // ep_size) % experts_per_rank            # 卡内第几个专家
expert_ids = row + col * experts_per_rank
```

`col` 逐个槽位轮换 EP rank，`row` 在卡内再轮换专家：任意连续 ep_size 个槽位正好每张卡各一个，任意连续「专家数」个槽位正好每个专家各一个。所以一张表里，槽位总数（token 数 × top_k）是 ep_size 的倍数时，各目标卡槽位严格相等；专家之间最多差 1，只有槽位总数是专家数的倍数时，各专家才恰好相等。这里假定专家按每卡连续一段的编号摆放。拿事实表的例子走一遍：8 个专家、2 张卡（每卡 4 个），2 个 token × top-2 = 4 个槽位，排出来是 6、3、7、0——专家 3 和 0 在 rank 0，专家 6 和 7 在 rank 1，每卡 2 个；8 个专家里只有 4 个分到槽位，另外 4 个是 0。

**偏移不保证不同 rank 的表互异，也不保证跨 rank 合计均匀。** 示意 8 个专家、EP=4，每个发出 rank 都有 1 token、top-k=3。四个起点分别为 0、4、8、12，按专家数取模后 rank 0 与 2 的表都是 [0, 2, 4]，rank 1 与 3 都是 [1, 3, 5]。每卡连续放 2 个专家时，四个目标卡总共收到 [4, 4, 4, 0] 个槽位。单张表最多差 1 的结论仍成立，但多张表偏差可以累积。

代码里只有一行是入口：`_select_experts` 拿到 router 的结果、做完 `log2phy` 物理映射之后，直接整表替换（见事实表「换掉的是什么」）。

策略函数还检查本次前向的通信方法：没有通信方法时返回空值，有通信方法时才取得或构造强制分配表。因此，开启配置不等于每次调用都会返回专家编号。


`build_force_eplb_topk` 是配套预热：main 与 rc2 的 model_runner_v1 在**非捕获** dummy run 中，把 capture size 和两种 dtype 对应的表先放进缓存；这一步还带着「模型是 MoE」的条件。随后只有完整缓存键匹配才直接复用；例如 top-k、设备或 token 数不一致仍会走建表分支。预建减少捕获路径中新建表的机会，不是“捕获期间绝无分配”的保证，也不能据此概括 ACLGraph 对所有张量分配的规则。

## 开了的代价

**输出不能作为原模型的精度结果。** 替换路由的这段代码没有专门的 warning：它保留原门控权重，却换掉权重所对应的专家。即使个别编号或最终 token 恰好相同，也不能据此当作原模型推理。压测结束后应恢复配置再测精度；这段代码本身不保证整个服务一定能启动。

**和 dynamic EPLB 是硬互斥。** 配置派生时，本键、dynamic EPLB、模型配置已就位、模型是 MoE 四个条件同时成立就抛 `ValueError("enable_force_eplb cannot be mixed with dynamic_eplb.")`。强制路由覆盖映射后的编号，也不再反映 router 的真实专家热度，因此不能拿它评估动态摆放对真实流量的效果。检查在配置派生中进行，依赖模型配置已经就位。

**非 MoE 模型不触发这里的互斥检查和预热。** 两处都带 is_moe 条件，路由替换的消费点也在 MoE 层里。因此本键没有相应的 MoE 路由可替换；这不排除模型其他配置报错。

**形状错误发生在建表时，可能早于接收请求。** token 数、top-k、EP 大小必须为正，逻辑专家数必须被 EP 大小整除；上游对这四条有参数化用例。启动时的非捕获预热会调用建表，因而可能当场失败；若某个新缓存键直到实际请求才出现，也可能在那时才报错。

**放到 GLM 双机：固定部署没有这个键。** db701c1f 使用逐键取值的旧配置路径，写入它也不会生效。若在其他兼容版本中让同样的 288 个路由专家走这条实现，EP16 满足 288÷16=18 的整除条件；不开 dynamic EPLB 也避开上述互斥。它们只覆盖两项条件，不证明迁移后的 GLM 一定能启动。若实际进入强制路由分支，对应 MoE 层的 top-8 编号就会被替换，不能再测原模型精度。

可用它构造受控负载，对照真实 router 的分布。EPLB 页的每卡 6,048 行、纯 decode 每卡 38 行是特定场景的理想均分估算，前提统一见[负载有多不均](../concepts/eplb.md#负载有多不均只有理想均分没有实测)。使用轮转表时仍应核每个发出 rank 的槽位数和最终计数，不能保证自动复现这两个数。待核：没有该 GLM 双机配置的强制路由耗时实测，也没有可报告的收益。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_force_eplb` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_force_eplb"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:583` |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_force_eplb and self.eplb_config.dynamic_eplb and (vc.model_config is not None) and vc.model_config.is_moe:
    raise ValueError('enable_force_eplb cannot be mixed with dynamic_eplb.')
````

## 对照源码

- 来源 33：vllm-ascend@baa023ad，vllm_ascend/ops/fused_moe/force_eplb.py，L90–L104。
来源 5 的取模公式支持单表均分条件与跨 rank 反例；这两项是数学演算，未执行 NPU 路由。缓存未命中建表及预热参数见来源 7–9，rc2 的对应旧 model runner 调用见来源 40；rc2 未知键过滤边界见来源 39。PR #15499 的提交说明记录的是配置与缓存重构及静态检查，并明确未做该提交的 NPU/ACLGraph 验证，不能把它当作设备运行保证。

**正文依据索引。** 下列编号与“查看来源”中的编号一致；链接保留固定版本和原文范围。源码与官方说明只支持各行写明的主张，推导、风险和假设另列。

| 正文中的主张 | 对应原文 |
|---|---|
| 路由编号整表替换、权重不变及前向分支优先级 | [来源 4](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/routed_experts.py#L594-L633)、[来源 5](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/force_eplb.py#L108-L142)、[来源 12](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/routed_experts.py#L649-L650) |
| 旧版本及 GLM 的配置读取、main 的严格配置与未知键过滤 | [来源 16](https://github.com/vllm-project/vllm-ascend/blob/2ed6cbba/vllm_ascend/ascend_config.py#L61-L67)、[来源 17](https://github.com/vllm-project/vllm-ascend/blob/2c59ff10/vllm_ascend/ascend_config.py#L32-L38)、[来源 21](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/ascend_config.py#L32-L38)、[来源 14](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L455)、[来源 15](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L1660-L1671) |
| dynamic EPLB 互斥的四项条件 | [来源 3](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L562-L570) |
| 逻辑专家数、整除约束与 8 专家轮转表算例 | [来源 5](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/force_eplb.py#L108-L142)、[来源 22](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/moe_utils.py#L265-L276)、[来源 10](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/tests/ut/ops/test_force_eplb.py#L11-L33) |
| 完整缓存键、capture size 与两种 dtype 的预建、MoE 与非捕获条件 | [来源 7](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/force_eplb.py#L22-L56)、[来源 8](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ops/fused_moe/force_eplb.py#L59-L86)、[来源 9](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/worker/model_runner_v1.py#L4193-L4195) |
| 配置入口示例与建表形状错误的参数化用例 | [来源 13](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L316-L334)、[来源 11](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/tests/ut/ops/test_force_eplb.py#L36-L58) |
| 自动生成参数定义中的声明位置 | [来源 38](https://github.com/vllm-project/vllm-ascend/blob/7d825229c77025cfb185a010c25819c1214b9450/vllm_ascend/ascend_config.py#L583) |

轮转公式的两项推导分别是：覆盖映射后的编号不能保证适配所有静态或冗余专家摆放 [D]；在每卡连续一段的编号布局下，槽位总数能被 EP 大小整除时各卡相等，能被专家数整除时各专家才相等 [D]。真实权重与替换后的专家不对应，因此不能拿来测原模型精度 [!]；互斥检查须四条件同时成立，模型不是 MoE 时不会因这一条报错 [!]。这些解释仍按正文所列条件使用。
