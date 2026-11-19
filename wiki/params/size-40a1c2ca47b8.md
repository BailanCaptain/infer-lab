---
id: size-40a1c2ca47b8
legacyAnchors:
  一句话: size 是什么，由谁算出、为什么不能手写？
  事实表: 对照源码
  为什么存在: 建组、分层归属和显存放大上限怎么算？
  开了的代价: 调 TP/PCP 时的通信与余数代价，以及 GLM 双机边界
title: size
type: param
summary: >-
  KVPPConfig 唯一字段：KVPP 将单个 PP stage 上的层缓存划分给多少张卡，int 类型、默认 1（关闭），开启 enable_kvpp
  后按 TP × PCP 自动推导且对象冻结，用户不能直接写入。v0.23.0 与 v0.26.0rc 无此字段，v0.30.0 与 main 保留并由
  PCP × TP 组内 rank 判定层归属。
aliases:
  - kvpp_config.size
  - additional_config.kvpp_config.size
  - KVPP 组大小
  - kvpp_size
chapters:
  - '11'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
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
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L68
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L64-L109'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/kv_cache_placement.py#L19-L46'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/kv_cache_placement.py#L155-L190'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/parallel_state.py#L108-L122'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1133-L1160'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/kvpp_cache.py#L30-L55'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1659-L1662'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L68-L115'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1232-L1260'
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
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
  - >-
    raw/sha256-f9b9b353227a58b5d20062f77dd08e5592070d6aedc9397982b327f2b2b79d2b.md
---
## size 是什么，由谁算出、为什么不能手写？

本页说明的是 **`kvpp_config.size`**（`ascend_config.py` 中 `KVPPConfig` 类的唯一字段，与其他类的同名 `size` 无关）。用一句话建立直觉：多卡跑 MLA 模型时，同组卡原本各存一份相同的历史 KV cache；开启 [KVPP](../concepts/kvpp.md) 后，各层历史 KV 会被平分到组内多张卡上各自常驻，**`kvpp_config.size` 就是单个 PP stage 上参与平分层缓存的卡数**。它是整数类型、默认 `1`（表示每卡存全层、KVPP 关闭），只有 `size > 1` 时才进入 KVPP 建组、校验和分配路径；所在类 `KVPPConfig` 声明为 `frozen=True`，运行时不可修改。

用户**不能也不需要手写 `size`**：启动时只需通过 `additional_config` 里的 `enable_kvpp` 开关启用 KVPP（推荐使用 JSON 布尔值 `true` / `false`，避免布尔解析歧义），`KVPPConfig.from_vllm_config()` 会在 `enable_kvpp` 为真时自动按 `tensor_parallel_size × prefill_context_parallel_size`（即 `TP × PCP`）派生 `size`。如果直接往 `additional_config` 塞 `{"kvpp_config": {"size": 4}}`，工厂函数在构造配置时会把它剔除，无法覆盖真实拓扑（入口规则见 [`kvpp_config`](kvpp-config-0445bd352140.md)）。它划分的是单个 DP 副本、单个 PP stage 内的 `TP × PCP` 复制域，表示的不是 DP 数，也不是 PP stage 数。

**版本存在范围**：`v0.23.0` 与 `v0.26.0rc`（以及 `v0.27.1rc` 和 GLM 固定镜像 `db701c1f`）均没有 `KVPPConfig` 与 KVPP 实现，传入 `enable_kvpp` 会被静默忽略；`v0.28.0rc` / `v0.29.0rc`、`v0.30.0` 及 `main` 均保留了 `KVPPConfig.size` 与 `TP × PCP` 派生规则，但 `v0.30.0` 与 `main` 修正了 `PCP > 1` 时的 owner 编号算法，并将执行模式限制从早期 `main`（`baa023ad`）的仅 `enforce-eager` 放宽为 `enforce-eager` 或 `PIECEWISE`（仍要求 `DCP = 1`、模型为非 hybrid MLA，完整连接器与 MTP 约束见 [KVPP 配置页](kvpp-config-0445bd352140.md)）。

## 建组、分层归属和显存放大上限怎么算？

`size` 的核心作用只有一句除法：`map_kvpp_layers_to_owners()` 先将本 PP stage 上参与分配的层按层索引和缓存名称排序、排除 MTP 草拟层（同一层索引下的多个缓存名称归属同一个 owner，因此参与均分的是**层索引数**而非缓存名称总数），再用 `base, remainder = divmod(len(layer_indices), kvpp_size)` 将层索引连续切成 `size` 段，第 `owner_rank` 段拿到 `base + int(owner_rank < remainder)` 层——前 `remainder` 个 rank 各多拿一层。MTP 缓存不参与划分，每张卡各留一份。

围绕这句分层除法，另外三处运行时逻辑也会检查 `size > 1`：

- **建通信组**：`parallel_state.py` 仅在 `size > 1` 时创建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`（用于守住复制域边界、防止绕过工厂篡改 `size`）。
- **触发专属校验**：`platform.py` 在 `size > 1` 时调用 `kvpp_config.validate(vllm_config)`；当 `TP = 1` 且 `PCP = 1` 时，即使 `enable_kvpp` 为真，派生出的 `size` 仍为 `1`，KVPP 建组、专属校验和分配路径都不会启用（但不关闭服务其他参数检查）。
- **切换缓存分配路径与计算 owner 编号**：`worker.py` 在 `size > 1` 时构建 `KVPPPhysicalCachePlan`，执行侧经 `allocate_kvpp_cache()` 分配常驻层与暂存缓冲。注意 `owner_rank` 的演进：早期 `main`（`baa023ad`）按 `TP rank % size` 建计划，在 `PCP > 1` 时会撞号；`v0.30.0` 与 `main` 改为在 worker 规划阶段计算 `kvpp_rank = pcp_rank × TP + tp_rank`，在 `allocate_kvpp_cache()` 分配阶段直接取 `get_kvpp_group().rank_in_group`——例如 `TP = 2, PCP = 2`（`size = 4`）时，两个 PCP 组的 TP0 分别是 `owner 0` 与 `owner 2`，不再错误地分到同一段。

拿一个 **10 层非混合 MLA 模型、无 MTP、`TP = 2, PCP = 2`** 的小例子把分层除法和 `owner_rank` 算一遍（**示意**）：派生 $\text{size} = 2 \times 2 = 4$，`divmod(10, 4) = (2, 2)`，即前 2 个 rank 各拿 $2 + 1 = 3$ 层、后 2 个 rank 各拿 2 层：

| `(pcp_rank, tp_rank)` | `kvpp_rank = pcp × 2 + tp` | 本卡常驻层索引 | 常驻层数 | 含 2 层 scratch 的物理层数 |
| --- | --- | --- | --- | --- |
| `(0, 0)` | `0` | `L0, L1, L2` | `3` | `5` |
| `(0, 1)` | `1` | `L3, L4, L5` | `3` | `5` |
| `(1, 0)` | `2` | `L6, L7` | `2` | `4` |
| `(1, 1)` | `3` | `L8, L9` | `2` | `4` |

全组可分配的逻辑块数受最重卡（`rank 0` 与 `rank 1`，各占 5 层）限制，因此该示意例子的块数容量放大比为 $10 / (3 + 2) = 2\times$，而不是按卡数直觉以为的 $4\times$。

**一般规律下，`size` 是除法的分母，不等于显存容量放大倍数。** 每卡每个物理块的字节数为「本卡常驻层 bundle 字节 + `KVPP_SCRATCH_BUFFER_COUNT × 最大单层字节`」，其中 `KVPP_SCRATCH_BUFFER_COUNT` 是写死的常数 `2`（一个给当前层计算、一个给下一层预取）。在**各参与分配层每块均占 `b` 字节、无 MTP 等额外常驻缓存、可用显存预算相同且忽略块数向下取整**的简化算例下，设总层数为 $L$，拿层最多的卡持有 $\lceil L / \text{size} \rceil$ 层：

| 模式 | 每卡每块物理字节（简化算例） | 相对不开 KVPP 的块数容量比 |
| --- | --- | --- |
| 不开 KVPP（`size = 1`） | $L \cdot b$ | $1\times$ |
| 开启 KVPP（`size > 1`） | $(\lceil L / \text{size} \rceil + 2) \cdot b$ | $\dfrac{L}{\lceil L / \text{size} \rceil + 2}$ |

当 $\text{size} \ge L$ 时 $\lceil L / \text{size} \rceil = 1$，该简化算例下的放大倍数封顶在 $L / 3$：例如 60 层模型，`TP` 从 8 增到 16（`PCP = 1`），倍数仅从 $60 / (8 + 2) = 6$ 升到 $60 / (4 + 2) = 10$，卡数再多也跨不过 20——**这道天花板来自写死的 2 块 scratch buffer，而非卡数不够**。若层布局不等大或开启 MTP 保留额外常驻缓存，实际收益比例会更小，必须重新按实际规格计算。

## 调 TP/PCP 时的通信与余数代价，以及 GLM 双机边界

- **调大或调小 TP 会同时联动常驻布局与广播载荷**：在 `PCP = 1`、层数可整除且各层等大的例子里，从 TP8 降到 TP4 会让每卡常驻层数从 $L/8$ 增至 $L/4$；在相同可用 KV 字节预算下，可容纳的逻辑块数随之减少。反过来增大 TP 虽能减少每卡常驻层数，但 KVPP 广播发送的是整层已分配的逻辑块缓冲区（按已分配 `num_blocks` 构造）——只有固定逻辑块数、层布局与执行路径时，每次广播载荷才不会因 owner 增多而摊薄；若把省出的显存用于增加块数，整层广播字节也会跟着上升，广播次数还取决于实际执行层与是否需要历史，不能只凭 `size` 推断延迟不变。
- **层数除不尽时，全局容量由拿得最多的卡决定**：`divmod` 让前 `remainder` 个 rank 多拿一层，而各卡分别调用 `get_num_blocks` 按本卡物理字节计算块数，最终全局块数取各卡最小值——等于让多拿一层的卡拉低全组容量。层数恰好是 `size` 整数倍时没有这笔余数损失（每层规格如何映射成缓存页见[KV cache 规格](../concepts/kv-cache-spec.md#一层要存的状态怎样变成缓存池里的一页)）。
- **`size == 1` 时跳过 KVPP 专属校验，但不等于跳过全部检查**：当 `TP = 1, PCP = 1` 时派生 `size = 1`，跳过 `KVPPConfig.validate()` 的专属校验，但仍会检查 `enable_kvpp` 的布尔合法性及服务其他参数；逐条报错与运行组合见[会报什么错](../concepts/kvpp.md#会报什么错)，确认是否真实启用应核对派生 `size` 与 `kvpp` 通信组。
- **放到 GLM 双机部署（历史例外 B 算例）**：固定镜像 `db701c1f` 没有 `KVPPConfig`，写入 `enable_kvpp` 会被静默忽略（不能把它说成 `size` 恒为 1）。即便换到支持 KVPP 的 `v0.30.0` / `main`（TP8、PCP1 推导 `size = 8`），`KVPPConfig.validate()` 仍硬性要求非 hybrid MLA（`not model_config.use_mla or model_config.is_hybrid` 报错），而 GLM-5.3-Flash 为 MLA + KDA 混合注意力架构，无法直接启用（详见[GLM 双机能开 KVPP 吗](../concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)）。

## 对照源码

下表对照 `KVPPConfig.size` 在四个固定版本快照中的派生规则、建组断言与层归属计算：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| `KVPPConfig.size` | 不存在 [D] | 不存在 [D] | 存在，frozen `int = 1`，启用时派生 `TP × PCP` [C27] | 同 `v0.30.0` [C34] |
| 建组断言与专属校验 | — | — | `size > 1` 建 `kvpp` 组并断言 `size == PCP × TP` [C30]；平台层调 `validate()` [C33] | 同 `v0.30.0` |
| 层归属与 `owner_rank` | — | — | `divmod(层索引数, size)` 连续切段、排除 MTP [C29]；worker 按 `PCP rank × TP + TP rank` 建计划 [C31]，分配时取 `get_kvpp_group().rank_in_group` [C32] | 同 `v0.30.0` [C35] |
| 执行模式与模型门槛 | — | — | 放宽为 eager 或 `PIECEWISE`；仍要求 `DCP = 1`、非 hybrid MLA [C27] | 同 `v0.30.0` [C34] |

- **每块物理字节与简化放大倍数**：`KVPP_SCRATCH_BUFFER_COUNT = 2`，`bytes_per_block = persistent_bytes + 2 * scratch_bytes`（`c09d3e20:kv_cache_placement.py#L19-L46`）[C28]；等大层且无 MTP 时的容量比 $L / (\lceil L / \text{size} \rceil + 2)$ 与上限 $L / 3$ 为静态推导 [D]，全局块数由最小卡容量决定为结合 `get_num_blocks` 语义推断 [I]。
- **早期 `main`（`baa023ad`）与历史演进**：早期实现要求 `enforce-eager`（官方特性文档见来源 9、10 [S9]）且 worker 按 `TP rank % size` 计算 owner，在 `PCP > 1` 时会与新版的 `PCP rank × TP + TP rank` 产生分歧 [!]；`v0.28.0rc` / `v0.29.0rc` 曾包含早期配置，而 `v0.23.0` / `v0.26.0rc` / `db701c1f` 均无 KVPP。整层广播按已分配 `num_blocks` 构造缓冲区见来源 22–24 [S24]。
- **待核**：本仓库尚缺具体模型开启 KVPP 后的实机每卡容量与端到端时延对照数据。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `KVPPConfig.size` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 字段身份（不代表用户输入入口） | `KVPPConfig.size` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:68` [C26] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
