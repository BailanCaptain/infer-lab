---
id: size-40a1c2ca47b8
title: size
type: param
summary: >-
  KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP ×
  PCP，用户不能直接写。固定 main 与 rc2 都有；rc2 保留派生规则，运行组合的变化见 KVPP 页。
aliases:
  - kvpp_config.size
  - additional_config.kvpp_config.size
  - KVPP 组大小
  - kvpp_size
chapters:
  - '11'
origin: seed
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
relations:
  - to: kvpp-config-0445bd352140
    kind: builds-on
    note: size 是 kvpp_config 里唯一的字段，这个数由谁算出来、为什么用户写不进去，在那一页
  - to: kvpp
    kind: builds-on
    note: 它是 KVPP 分层广播的除数，层归属、广播时机与实测收益都在那一页
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L64
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L52-L77'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L76-L89'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L128-L159'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1103'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L19-L44'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1500-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4772-L4774'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L97-L104'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1629-L1634'
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L66
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L67
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L68
  - >-
    raw:sha256-15a9b303e86b0392bb0297e5c23f48c54bc6295e56e8f6d26c7ee99021a94e77.md#L1-L160
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/core/kv_cache_placement.py#L135-L159
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L62-L99'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1834-L1912'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L66
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1144-L1152'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/kvpp_cache.py#L30-L35'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kvpp.py#L8-L35'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L46-L58'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L193-L197'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L71
rawSources:
  - >-
    raw/sha256-15a9b303e86b0392bb0297e5c23f48c54bc6295e56e8f6d26c7ee99021a94e77.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
  - >-
    raw/sha256-f9b9b353227a58b5d20062f77dd08e5592070d6aedc9397982b327f2b2b79d2b.md
---
## 一句话

**v0.30.0rc2 对照。** rc2保留KVPPConfig.size，整数默认1，启用后由TP×PCP推导；配置对象冻结，直接传kvpp_config仍会被工厂剔除，不能手调size。它在TP×PCP复制域内划分层缓存，要求DCP=1、模型为非hybrid MLA，表示的不是DP数或PP阶段数。下文分别说明旧main与rc2的owner计算。

这个 `size` 是 `KVPPConfig` 里**唯一的字段**，表示 [KVPP](../concepts/kvpp.md) 将**一个 PP stage 上的层分给几张卡**。`int`、默认 `1`，只有大于 1 才进入 KVPP 执行路径。开了 KVPP 之后它等于 `tensor_parallel_size × prefill_context_parallel_size` [C2]，你没法单独指定；能不能往 `additional_config` 里写、写了会怎样，见 [`kvpp_config`](kvpp-config-0445bd352140.md)。

**存在范围。** 固定 main 与 rc2 有 KVPPConfig；此前核对的 v0.28.0rc、v0.29.0rc 分支也含同一段旧配置，而 v0.23.0 至 v0.27.1rc 没有。v0.23、v0.26 固定快照在代码和文档中检索 KVPP 均无结果，GLM 部署 `db701c1f` 同样没有 [D]。这一页讲 size 在运行时被谁除、除完影响什么；rc2 变化见开头。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型与默认 | `int = 1`，所在类是 frozen 的 [C2] | 默认值本身就是「关」；对象冻结，运行时也改不了这个数 |
| 开了之后取什么值 | `TP × PCP` [C2] | 由实际 TP、PCP 拓扑推导，不是直接填一个 size；PCP=1时 TP8 才对应 size8 |
| 层怎么分 | `divmod(本 stage 的层数, size)`，前 `remainder` 个 rank 各多拿一层 [C4] | 层数不是 `size` 的整数倍时各卡不等量，显存预算按拿得最多的那张算 |
| 每块物理字节 | `自己那几层的 bundle + 2 × 最大的那一层` [C6] | 常数项 `2` 是写死的 `KVPP_SCRATCH_BUFFER_COUNT`，不随 `size` 变 |
| 简化容量比 | 等大层、无额外常驻缓存且相同可用预算时，为 `L / (ceil(L/size) + 2)` [D] | 这组算例的上限为 `L / 3`，不是所有模型的通用收益 |
| 建组断言 | `assert size == global_pcp_size * global_tp_size` [C3] | 复制域永远是 PCP × TP，不跨 DP 副本、不跨 PP stage |
| 本卡在组里的编号 | 旧 main 用 TP rank `% size`；rc2 建计划用 `PCP rank×TP + TP rank`，运行时取 KVPP 组内 rank | PCP=1时等于 TP 编号；PCP>1不能仅按 TP 编号找 owner |
| MTP 的 cache | 不参与划分，每张卡各留一份 [C4] | 开 MTP 时省下的比例比 `size` 暗示的小 |
| `size == 1` 时 | KVPP 建组、专属校验、换分配路径不发生 | TP1、PCP1 时开关为 true 也不启用 KVPP；服务其他检查仍会执行 |
| 覆盖版本 | 固定 main 与 rc2 有；此前 v0.28.0rc / v0.29.0rc 分支也包含 | v0.23 / v0.26 固定快照没有此字段与 KVPP |

## 为什么存在

需要一个数的地方只有一处：`map_kvpp_layers_to_owners` 里那句 `base, remainder = divmod(len(layer_indices), kvpp_size)` [C4]。层按层号排好序之后**连续**切成 `size` 段，第 `owner_rank` 段的长度是 `base + int(owner_rank < remainder)`——前 `remainder` 个 rank 各多拿一层。这就是 `size` 的全部工作。

分配先按层索引、缓存名称排序，再按不同层索引的数量分组；同一层索引下的多个缓存名称归给同一个 owner。因此，参与均分的是层索引数，不是缓存名称总数。MTP 缓存会先被排除在这项分组之外。


围着这句除法，另外三处各自读一次：

- **建组**：`parallel_state.py` 只在 `size > 1` 时建名为 `kvpp` 的通信组，并顺手断言它等于 `global_pcp_size * global_tp_size` [C3]。等式两边都是同一个乘法，所以这条断言实际是在拦「有人绕过工厂改了这个数」。
- **进校验**：`platform.py` 在启动期 `size > 1` 才调 `validate()`。
- **换分配路径**：旧 main 的 model runner 见 size>1 改走 allocate_kvpp_cache，并关闭 hybrid_with_attn_and_mamba；worker 用 TP rank%size 建计划。rc2 worker 改用 PCP rank×TP+TP rank，执行侧直接取 KVPP 组内 rank。以 TP2、PCP2 为例，两个 PCP 组的 TP0 分别是 owner0和owner2，不能都按TP0分到同一段。

**这个数决定的是除法的分母，不是省下的倍数。** 每卡每块的物理字节是 `persistent + KVPP_SCRATCH_BUFFER_COUNT × scratch`，其中 `scratch` 取最大的那一层、常数是写死的 `2`（一个给当前层、一个给下一层的预取）[C6]。设层数 `L`、每层字节 `b`，拿得最多的那张卡是 `ceil(L/size)` 层：

下面的比较假设参与分配的各层每块都占相同的 b 字节，没有 MTP 等额外常驻缓存，并采用相同的可用字节预算、忽略块数向下取整。因此，表中的容量比及 L/3 上限只适用于这组简化条件；层布局大小不同或保留 MTP 缓存时，需要重新计算，不能把它们作为所有模型的通用收益。

```
不开 KVPP：每卡每块 = L × b
开了之后：每卡每块 = (ceil(L / size) + 2) × b
放大倍数 = L / (ceil(L / size) + 2)
```

`size` 大到 ≥ `L` 时 `ceil` 就是 1，倍数封顶在 `L / 3` [D]。层数 60 的模型，TP 从 8 加到 16，倍数从 `60/(8+2)=6` 只涨到 `60/(4+2)=10`，再往上无论多少卡都过不了 20——**这条上限来自那个写死的 2，不是来自卡数不够。**

## 开了的代价

**size 不是用户独立设定的旋钮。** 通过 enable_kvpp 启用，再由 TP×PCP 推导。旧 main 指南要求 enforce-eager；rc2 放宽为 eager 或 PIECEWISE，完整模型、MTP和连接器条件见[KVPP 配置页](kvpp-config-0445bd352140.md)。往 additional_config 塞 `{"kvpp_config":{"size":4}}` 会被工厂剔除，不能覆盖实际拓扑。

**`size` 跟着 TP 走，调 TP 会同时改变常驻布局和通信预算。** 在 PCP=1、层数可整除且各层等大的例子里，从 TP8 改到 TP4，每卡常驻层数从 L/8 增至 L/4；若可用 KV 字节预算相同，可容纳的块数会减少。反过来增大 TP 可以少存常驻层，但广播仍发送整层已分配的逻辑块。只有固定逻辑块数、层布局及执行路径时，每次广播的有效载荷才不会因为 owner 增多而分薄；若用节余显存增加块数，整层广播字节也会增加。广播次数还取决于实际执行的层与是否需要历史，不能只从 size 推出延迟不变。

**层数除不尽时，亏的是拿得最多的那张卡。** `divmod` 给的是「前 `remainder` 个 rank 多一层」[C4]，而块数由 `get_num_blocks` 按本卡实际字节算 [C6]——各卡算出的块数会不一样，最终全局块数取的是最小的那个，等于让多拿一层的卡决定全局容量 [I]。每层先报什么规格、规格怎么变成缓存池里的一页，在[KV cache 规格](../concepts/kv-cache-spec.md#一层要存的状态怎样变成缓存池里的一页)那页讲过。层数刚好是 `size` 整数倍时没有这笔损失。

**`size == 1` 不会启用 KVPP。** TP=1、PCP=1 时它为 1，固定 main 的 `validate()` 中七条专属校验被跳过 [C7]；但这不保证服务能启动，也不关闭其他参数检查。开关能否通过 Pydantic 布尔转换，在推导 size 时单独检查；配置推荐使用 JSON 的 true / false。逐条报错见概念页的[会报什么错](../concepts/kvpp.md#会报什么错)；确认实际启用情况应核对派生大小和 KVPP 通信组。

**本站旧 GLM 镜像没有这个字段，不能把它说成 size 恒为1。** db701c1f 没有 KVPP，enable_kvpp 写进去会被忽略。换到支持版本后，TP8、PCP1 才会推导 size=8；旧 main 还会先受 eager 条件限制，rc2 虽可用 PIECEWISE，却仍要求非 hybrid MLA，不能把 GLM 的混合注意力直接搬进来。具体障碍见[GLM 一节](../concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)。上面的倍数是算例容量比；尚缺该模型实际启用后的每卡容量与时延对照。

字段身份是 ascend_config.py 中的 KVPPConfig.size；与其他类同名的 size 无关。版本范围以这一定义及其运行时使用者为准。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `KVPPConfig.size` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 字段身份（不代表用户输入入口） | `KVPPConfig.size` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:66` [C19] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

旧main baa023ad按本PP stage的层索引分配，MTP不进入层归属映射；无归属或本卡归属的缓存计入常驻部分，暂存取参与分配的最大层每块字节再乘2（来源4、6，kv_cache_placement.py 19–44、128–159）。正文容量比只用于每层等大、无额外常驻缓存、相同可用预算且忽略向下取整的算例；实际布局或MTP状态变化时要重新计算。

- 来源 16：vllm-ascend@baa023ad，vllm_ascend/core/kv_cache_placement.py，L135–L159。
- 来源 22–24：广播使用整层 buffer，而该 buffer 按已分配 num_blocks 构造；增加容量可能增加广播量。
