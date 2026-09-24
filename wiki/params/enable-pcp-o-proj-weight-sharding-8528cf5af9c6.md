---
id: enable-pcp-o-proj-weight-sharding-8528cf5af9c6
title: enable_pcp_o_proj_weight_sharding
type: param
summary: >-
  开了 SFA-PCP 之后，让 o_proj 权重在加载期就按 PCP 组再切一刀、常驻只留 1/pcp_size，prefill 现 all-gather
  出一份全量、decode 直接用本地片。默认 false，只在 main 开发主线上有，对 DSA-CP 无效。
origin: seed
aliases:
  - PCP o_proj 权重分片
  - SFA-PCP O-proj 权重切分
  - o_proj weight switch
chapters:
  - '15'
verified:
  - main
evidence: C
updated: '2026-09-22'
relations:
  - to: context-parallel
    kind: builds-on
    note: 它只在 prefill_context_parallel_size > 1 且模型走 SFA 稀疏注意力时才有实现类接手，PCP 怎么切序列在那一页
  - to: layer-sharding
    kind: alternative-to
    note: >-
      两者都是为了不让每层都常驻一份全量 o_proj；layer_sharding 按层轮流放、v0.24 起已删，这个按 PCP 组切且只针对
      o_proj
  - to: ascend-config-system
    kind: builds-on
    note: 读这个键的 utils 函数带 lru_cache(maxsize=1)，值在第一次读取后冻结，只有 clear_enable_sp() 能清
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L468'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L468
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1509-L1519'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L58-L91
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L93-L110
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L112-L158
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1575-L1590
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L259-L296'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L441-L456'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/o_proj.py#L28-L51'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L211-L215'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L77
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1522-L1537'
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L1281-L1295'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L479
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

开了 SFA-PCP（[Context Parallel](../concepts/context-parallel.md) 的 prefill 那一半）之后，`o_proj` 的权重原本还是每张卡一份 TP-local 全量。这个键让它**在加载期就按 PCP 组再切一刀**：常驻的只剩 `1/pcp_size`，prefill 需要全量时现 all-gather 一份、用完切回去，decode 干脆不 gather——各 PCP rank 只算自己那一条输入切片，再 all-reduce 拼回原来的 TP-local 结果 [C4]。默认 `false`。

**它是 `layer_sharding` 留下的那个缺口上唯一的用户旋钮。** 从 v0.24.0rc 删掉 [layer_sharding](layer-sharding.md) 到 v0.26 为止，关于「`o_proj` 权重怎么放」用户一个键都没有；main 上补回来的就是这一个，而且比原来管得少——切哪个权重（只有 `o_proj`）、按哪个域切（只有 PCP 组）都写死，用户只决定开不开。

**存在范围。** 只在 main 开发主线上有，2026-09-07 由 PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814) 引入（见下面「版本谱系」）；v0.23 维护分支与 v0.26 分支（2026-09-17 的源码快照）上这个键和 `vllm_ascend/weight_switch/` 整个目录都不存在。那两个分支的 `AscendConfig` 逐键 `.get()`，配了静默忽略 [C16] [C17]；main 是 `extra="forbid"` 的 pydantic 模型，拼错就起不来 [C15]。

[那条请求](../concepts/one-request.md)用不到它：Qwen3-0.6B 单卡、`prefill_context_parallel_size` 是 1，也不是 SFA 稀疏注意力模型，`resolve_sfa_impl` 选的是不带任何 CP 的 `AscendSFAImpl` [C7]。

官方参数表：[latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)（v0.23.0 与 v0.26.0rc1 两版里没有这一行）。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / 默认 | `bool` / `False`，`"true"` 这种字符串会被 lax 强转 [C14] | 和 `combine_quant_mode` 那种 `Literal` 不一样，这里传字符串不会报错 |
| 谁会读它 | 只有 `AscendSFAPCPImpl` 及其子类 `AscendSFAPCPDCPImpl` [C7] | 要同时满足：模型走 SFA、`prefill_context_parallel_size > 1`、`enable_dsa_cp` 为假 |
| 对 DSA-CP 的影响 | **没有** [S12] | DSA-CP 那条路由 `enable_dsa_cp_full_o_proj()` 决定，判据是有没有 KV 池化 / 本实例是不是 producer，与本键无关 [C13] |
| 常驻权重量 | `o_proj` TP-local 宽度的 `1/pcp_size` [C8] | 省的是「每层」的量，层数越多省得越多 |
| 额外缓冲 | 每个 `(linear 方法, 属性, dtype, 形状)` 一份全量 gather buffer，跨层共用 [C9] | 不是每层一份——所以净省约 `(1 − 1/pcp_size) × 每层 × 层数 − 一份全量` [D] |
| prefill / decode 分叉 | `attn_state` 不是 `DecodeOnly` / `SpecDecoding` 才 gather [C5] | decode 走 PCP all-reduce 路径，多一次组内 all-reduce、少一次权重 all-gather |
| 何时必须设 | 服务启动时；读取函数带 `lru_cache(maxsize=1)` [C3] | 启动后再改配置对象也不会重读，只有 `clear_enable_sp()` 会清缓存 |
| 整除约束 | `input_size_per_partition % pcp_size != 0` → `RuntimeError` | TP-local 的 `o_proj` 输入宽度必须能被 PCP 卡数整除，否则加载期就失败 |
| 量化方法约束 | linear method 必须是 `WeightSwitchMixin` 且 `supports_weight_switch` 为真，否则 `RuntimeError` [C10] | 不支持权重切换的量化实现上开它 = 起不来，不是静默降级 |
| 改的是物理形状 | 参数张量在 `load_weights` 之前就被 resize 成嵌套局部片 | 权重加载器直接读 checkpoint 的那一段，TP-local 的完整张量从没在显存里出现过 |

## 为什么存在

PCP 把 prefill 的 token 沿序列维切到多张卡上，但**权重是复制的**：PCP 组里每张卡都拿着一份一模一样的 TP-local `o_proj`。对 DeepSeek-V3.2 这类模型，`o_proj` 是整个 attention 里最大的那块矩阵，PCP 开到 2、4 就意味着这块权重在组里多存了 2、4 份——纯粹的冗余。

这个键把冗余换成通信。切法是沿 **input 维**（row-parallel 的那一维）：`WeightSwitchConfig.from_group(get_pcp_group(), shard_axis="input")` [C4]。接下来两件事是它区别于「运行时切一刀」的关键：

1. **加载期就切。** `prepare_layer_for_parallel_weight_load` 在 `model.load_weights` 之前把参数张量 resize 成 `原宽度 / pcp_size`，并换掉 `weight_loader`——加载器按 `WeightLoadPartition.from_nested_groups(TP 组, PCP 组)` 算出的位置，直接从 checkpoint 里取那一段连续切片 [C8]。完整的 TP-local 张量一次都没被分配过，所以省的是**峰值**而不只是稳态。
2. **前向时按阶段换视图。** prefill 那一趟 `_all_gather_o_proj_full_weight()` 把全量拼出来，在 `_use_full_o_proj_weights()` 的上下文里做投影，出了上下文再切回本地片 [C5]。decode 则完全不拼：每个 PCP rank 拿自己那一段 `attn_output` 做投影，得到部分和，再在 PCP 组里 all-reduce——结果与原来的 TP-local 投影逐元素相等 [C6]。

之所以能这么分，是因为 decode 的 token 在 PCP 各 rank 上是**复制**的：切输入、各算一段、再求和，正好就是矩阵乘法按 K 维分块。prefill 不行，它的 `attn_output` 本身就是按序列切开的，凑不出完整的 K 维，只能把权重拼回来。

gather buffer 挂在类变量 `o_proj_full_pools` 上，按 `(linear 方法类名, pool key, 属性名, device, dtype, dim, 形状)` 做键复用 [C9]，所以全模型所有层共用同一块全量缓冲，而不是每层一份。

## 开了的代价

**decode 多一次 all-reduce，prefill 多一次 all-gather。** 两笔通信都在 PCP 组内。decode 侧那次 all-reduce 的量是 hidden 维的输出张量，跟 token 数成正比；prefill 侧那次 all-gather 的量是权重本身，跟 token 数无关。所以 batch 小、prefill 频繁的形态最吃亏：权重 gather 的固定成本摊不下去 [D]。

**加载期的两条硬约束都是 `RuntimeError`，不是降级。** `o_proj` 的 TP-local 输入宽度不能被 PCP 卡数整除、或者用的量化方法没实现 `WeightSwitchMixin` 接口（`supports_weight_switch` 为假），都直接抛错 [C8] [C10]。重复安装也拦——同一层被装过两次 loader 会报 `Loader-time weight sharding has already been installed`。这类错发生在加载权重的阶段，好处是快，坏处是换一个量化格式就可能突然起不来。

**它管不到 DSA-CP，别拿它当通用的 `o_proj` 开关。** 官方表明写着这一条 [S12]，代码侧也对得上：DSA-CP 走 `AscendSFADSACPImpl`，那一支看的是 `enable_dsa_cp_full_o_proj()`——「没配 KV 池化，或本实例是 prefill producer（含 `kv_both`）」就用 gather 出来的全量权重，判据里没有本键 [C13]。这个判定函数三个版本换过三个名字（v0.23 `enable_dsa_cp_with_layer_shard` → v0.26 `enable_dsa_cp_with_o_proj_tp` → main `enable_dsa_cp_full_o_proj`），沿革见 [layer_sharding](layer-sharding.md) [!]。

**配了但没开 PCP 等于没配。** `resolve_sfa_impl` 是按 `enable_dsa_cp` / DCP replicated indexer / `prefill_context_parallel_size > 1` 三个独立开关选实现类的；PCP 没开、或者 `enable_dsa_cp` 为真时，选中的类根本不含读这个键的那行代码。没有 warning，服务照常起来 [!]。

**`lru_cache` 让它成为真正的启动期常量。** 读取函数只缓存一个结果，官方也明说「必须在服务启动时设定」[S12]。测试和 RL 这类会重建配置的场景要记得走 `clear_enable_sp()`，否则拿到的是上一次的值 [C11]。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| a71b766ce6fc0a9669a412e15a5cf53f7f827093 | 有（3 个文件） |
| 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f | 有（3 个文件） |

- **引入**：2026-09-07 · 78cd10dec8f1307634506b736d8c27000500a62d · PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814) —— [Feature] Enable pcp + o_proj weight split/gather (#14814)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/quantization/tp_weight_switch.py` +0 / −296（文本行变化）
  - `vllm_ascend/attention/context_parallel/sfa_cp.py` +122 / −58（文本行变化）
  - `vllm_ascend/attention/context_parallel/dsa_cp.py` +43 / −42（文本行变化）
  - `vllm_ascend/quantization/methods/w8a8/w8a8_mxfp8.py` +15 / −15（文本行变化）
  - `vllm_ascend/quantization/methods/base.py` +18 / −14（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_pcp_o_proj_weight_sharding"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:479` [C18] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
