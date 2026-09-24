---
id: enable-force-eplb-b7ec3661121f
title: enable_force_eplb
type: param
summary: >-
  把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_rank 算出来的轮转表，让每个专家、每张卡收到的 token
  数完全相等——压测和算子调优用，开了输出就不对。默认 false，在册版本里只有 main 有。
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
updated: '2026-09-24'
relations:
  - to: expert-parallel
    kind: builds-on
    note: 轮转表按 ep_size / ep_rank 算，目的就是把 EP 那两次 all-to-all 的每卡收发量压成完全相等
  - to: acl-graph
    kind: builds-on
    note: 表必须在图捕获之前按每个 capture size 预先建好，预建那一步挂在 _dummy_run 上，跑的是非捕获那一趟
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 main 上 pydantic AscendConfig 的顶层 bool 字段，互斥检查跑在 derive_and_validate 而不是
      pydantic 校验里
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
rawSources:
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

名字里有 EPLB，做的事和 [EPLB](../concepts/eplb.md) 相反：EPLB 换的是**专家摆在哪张卡**、不碰路由结果，`enable_force_eplb` 换的正是**路由结果**——把 router 选出来的 `topk_ids` 整张表丢掉，换成一串按 `ep_size` / `ep_rank` 算出来的轮转 id [C4] [C5]。每个专家、每张卡收到的 token 数由此完全相等，代价是模型选的专家全不对。

**这不是一个「优化」开关，是一个压测夹具。** `topk_weights` 原封不动、`topk_ids` 全换掉，等于拿真实的门控权重去加权一组随便指定的专家输出。默认 `false`；真要开，只该出现在测 MC2 通信带宽、测算子在均匀负载下的上限这类场景里。

**存在范围。** 只在 main 开发主线上有，2026-09-02 由 PR [#15499](https://github.com/vllm-project/vllm-ascend/pull/15499) 引入（见下面「版本谱系」）；v0.23 维护分支与 v0.26 分支（2026-09-17 的源码快照）上连 `force_eplb.py` 这个文件都没有。那两个分支的 `AscendConfig` 是逐键 `.get()` 的普通类 [C16] [C17]，配上这个键静默无效；main 是 `extra="forbid"` 的 pydantic 模型 [C14]，拼错名字直接启动失败（装了 vLLM-Omni 才降成一条 warning）[C15]。

[那条请求](../concepts/one-request.md)用不到它：Qwen3-0.6B 没有 MoE 层，`AscendRoutedExperts._select_experts` 一次都不会被调到。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / 默认 | `bool` / `False` | 只有开和不开，没有强度可调 |
| 换掉的是什么 | 只有 `topk_ids`，`topk_weights` 不动 [C4] | 权重来自真 router、专家来自轮转表，两者对不上——**输出没有意义**，别拿它测精度 [!] |
| 生效范围 | 每一次 MoE 前向，不只是 profile / dummy run | 它排在 `enable_force_load_balance` 那条 `elif` 前面，所以连显存探测那一趟原本的随机均衡也被顶掉 [C12] |
| 与 EPLB 摆放的关系 | `log2phy` 先映射一遍，随后被整表覆盖 | 开了它，EPLB 那张物理映射表做的功等于白做——这就是两者互斥的技术原因 |
| 互斥 | 本键 + `eplb_config.dynamic_eplb` + MoE 模型 → `ValueError` [C3] | 三个条件缺一不可：模型不是 MoE 时**不报错**，只是这个键无处生效 [!] |
| 硬约束 | `num_logical_experts % ep_size != 0` 直接 `ValueError` [C5] | 用冗余专家把逻辑专家数弄成不能整除 EP 卡数时，开它跑第一次 MoE 层就炸 |
| 轮转表长什么样 | 8 专家、`ep_size=2`、`ep_rank=1`、2 token、`top_k=2` → `[[6, 3], [7, 0]]` [C10] | 同一个 token 的两个 top-k 落在不同 rank 上；`ep_rank` 进了偏移量，所以各卡的表互不相同 |
| 缓存 | 按 `(num_tokens, top_k, 专家数, ep_size, ep_rank, dtype, device)` 缓存在 comm method 上 [C7] | 形状固定时只算一次；eager 模式下 `num_tokens` 每变一种就多留一张表 |
| 图捕获前预建 | `_dummy_run` 里对每个 `cudagraph_capture_sizes` × `{int32, int64}` 各建一份 [C8] | 捕获期不再现场分配张量；`capture_sizes` 为空时退化成只建 `max_num_tokens` 一份 |
| 官方文档 | 参数表里**没有**这一行 | 唯一的官方痕迹是 `AscendConfig` 文档字符串那份样例 dict [C13]；没有 feature guide，行为只能读源码 |

## 为什么存在

MoE 的性能数据很难测准，原因是路由本身不稳定：同一批 token 在不同模型、不同 prompt 下打到专家上的分布天差地别，而 MC2 的 dispatch / combine 是按最忙的那张卡收敛的——测出来的吞吐里混着「今天这批数据刚好不均衡」的噪声。要测算子和通信的上限，就得先把负载这个变量摁死。上游没给这个键写过设计文档，这段动机是从实现和 PR 标题反推的 [I]。

`_build_round_robin_topk` 摁的方式是纯算术，不看数据：

```python
experts_per_rank = num_logical_experts // ep_size
expanded_offset  = num_tokens * top_k * ep_rank + ep_rank
cursor = arange(num_tokens * top_k) + expanded_offset
col = cursor % ep_size                                  # 落到哪张卡
row = (cursor // ep_size) % experts_per_rank            # 卡内第几个专家
expert_ids = row + col * experts_per_rank
```

`col` 逐个槽位轮换 EP rank，`row` 在卡内再轮换专家，于是展开后的 `num_tokens × top_k` 个槽位严格均分到所有专家上——整除条件成立时每个专家恰好拿到 `num_tokens × top_k / num_logical_experts` 个槽位 [D]。`ep_rank` 被加进起始偏移，保证不同卡生成的序列相互错开，而不是所有卡都从专家 0 开始发。

代码里只有一行是入口：`_select_experts` 拿到 router 的结果、做完 `log2phy` 物理映射之后，直接整表替换 [C4]。

`build_force_eplb_topk` 是配套的预热：ACLGraph 捕获期不允许现场分配新张量，所以 `_dummy_run` 在**非捕获**的那一趟里，把每个 capture size 和两种 dtype 的表先算出来放进缓存，捕获时命中缓存即可；这一步还带着「模型是 MoE」的条件 [C9]。

## 开了的代价

**输出直接作废，而且没有任何提示。** 没有 warning、没有日志、没有「实验特性」标记：服务照常起来，照常吐 token，只是 token 是错的 [C4]。压测跑完忘了把这个键摘掉，后面所有精度结论都不成立——这是它最现实的风险 [!]。

**和 dynamic EPLB 是硬互斥。** `derive_and_validate` 的第一条检查就是它，三个条件同时成立就抛 `ValueError("enable_force_eplb cannot be mixed with dynamic_eplb.")` [C3]。道理不难：EPLB 统计的是真实专家热度，轮转表让热度永远完美均匀，统计出来的摆法毫无意义。注意这条检查跑在 `derive_and_validate` 而不是 pydantic 字段校验里，所以它依赖 `vllm_config.model_config` 已经就位。

**非 MoE 模型上它既不报错也不生效。** 互斥检查和预热都带 `model_config.is_moe` 条件 [C9]，而唯一的消费点在 MoE 层里。dense 模型上配 `true` 会安静地什么都不做——不是「不支持」的报错，是彻底的无声 [!]。

**形状不合法是运行期错误，不是启动期。** `num_tokens` / `top_k` / `ep_size` 必须为正、`num_logical_experts` 必须被 `ep_size` 整除，四条上游都写了参数化用例 [C11]，但它们抛在建表的时候。服务能起来，第一次真跑到 MoE 层才炸。

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
| releases/v0.28.0rc | 有（3 个文件） |
| releases/v0.29.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-09-02 · 2825e368b0ee0cd5ecfddc075cee92be658508f9 · PR [#15499](https://github.com/vllm-project/vllm-ascend/pull/15499) —— [Feature] add force EPLB Feature through additional config (#15499)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor、origin/rfc/megakernel
  - `vllm_ascend/ops/fused_moe/routed_experts.py` +4 / −4（文本行变化）
  - `vllm_ascend/ascend_config.py` +9 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/force_eplb.py` +142 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +4 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_force_eplb"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:478` [C18] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_force_eplb and self.eplb_config.dynamic_eplb and (vc.model_config is not None) and vc.model_config.is_moe:
    raise ValueError('enable_force_eplb cannot be mixed with dynamic_eplb.')
````
