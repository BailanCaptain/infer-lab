---
id: replica-search-beam-size-6556d1650a62
title: replica_search_beam_size
type: param
origin: seed
evidence: C
summary: >-
  STAIR 副本数搜索的束宽：每段展开后保留的最多候选状态数、最终生成的目标副本数上限，以及真正进入带约束 LPT 摆放的候选上限；默认 64，合法范围 1–128。注意设为 1 时唯一位置会被强制保留的“份数不变”占满，等于关闭副本数调整。v0.30.0 与 main 已接入 MRv2。
aliases:
  - 副本搜索束宽
  - STAIR replica search beam size
relations:
  - to: replica-search-num-stages-e4b10925ff97
    kind: builds-on
    note: 副本数搜索的完整走法（分组、逐组选择、从现状挪向目标）写在那一页，本页只讲「每次留几个」
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；搜索规模的推导、钉点上写了为什么起不来，都在父参数页
  - to: ascend-config-system
    kind: builds-on
    note: 该参数嵌套在 AscendConfig 的 EPLB 子配置中；钉住版本不认识此键时启动失败，依赖 EPLB 子配置拒绝未知键的校验机制。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么束宽在三处起作用
  事实表: 它管什么束宽在三处起作用
  为什么存在: 为什么用粗分数截断并强制保留份数不变
  开了的代价: 调大调小的代价写-1-陷阱与放到-glm-双机
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L226
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L212-L213'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L258-L259'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L304-L321'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L374-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L413-L431'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L933-L949'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L214
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L224
  - >-
    raw:sha256-1d6fe088dcd10aa7626a3a782ceb0191cf38e491409a789f990536dce044c9f3.md#L1-L115
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L261'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L514-L528'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L620-L638'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L226
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L227
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L224
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L224-L258'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L474-L533'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L587-L641'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1157-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L231-L265'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1d6fe088dcd10aa7626a3a782ceb0191cf38e491409a789f990536dce044c9f3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f9720e44c7545e407e6d4299d83ed92cfd0a1302a950457cf6ae48bb064a50ae.md
---
## 它管什么，束宽在三处起作用？

`replica_search_beam_size` 是 [stair_config](stair-config-cca9e594a052.md) 下的整数参数，控制 STAIR 副本数束搜索（beam search）**每步最多留下多少个候选状态**。束搜索每展开一步都会产生大量备选，只按粗分数保留排名靠前的若干个继续往下走，其余当场淘汰。在 STAIR 中，它同时卡住三处上限：

1. **每个搜索阶段展开后**保留的唯一部分状态数；
2. **所有阶段结束后**产出的目标副本份数候选数；
3. **从现状朝目标增量挪动后**、真正送入带约束 LPT 摆放的最终候选数。

第三处最直接地决定规划成本：带约束的 LPT 摆放会对每个最终候选各跑一次（逐份更新同卡协方差、必要时执行有界回溯），因此束宽就是“单层每轮最多跑几次带约束摆放”。默认 `64`，合法范围 `1–128`。副本数搜索的完整走法统一写在 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md#副本数搜索完整走法与手算例子)，本页聚焦束宽截断本身。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际消费该参数；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动报错（见 [stair_config](stair-config-cca9e594a052.md)）。

| 维度 | 行为与约束 | 工程含义 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["replica_search_beam_size"]`，`int`，默认 `64` | 每层每轮至多进入 64 次带约束 LPT 摆放 |
| 合法取值 | 整数 `1–128`；越界报 `stair_config.replica_search_beam_size must be between 1 and 128`，布尔值报 `STAIR numeric fields must not be booleans` | `0` 不合法，不能靠写 `0` 关闭搜索 |
| 排序粗分数 | 按 `max(专家风险 ÷ 副本份数)` 升序保留，越小越好；同分按份数向量的字典序破平局 | 这是摆放前的粗分数，真实峰均比要等摆放完成后才计算 |
| “份数不变”保留位 | 最终进入摆放前截断至 `beam_size` 后，若“保持当前副本份数”不在列表中，强制用它替换掉最后一个候选 | 束宽为 `n` 时，真正改变了副本份数的候选至多 `n - 1` 个 |
| 设为 `1` 的效果 | 唯一候选位被“份数不变”强制占去，不再尝试任何新副本份数（但物理摆放仍可能换位置） | 表面上是最省算力，实际上等于关闭了副本数调整 |
| 与阶段数、半径的关系 | 单段展开上限 `= 束宽 × (2 × 半径 + 1)`；默认值下的总展开上限见 [stair_config](stair-config-cca9e594a052.md#代价通信器回退陷阱与放到-glm-双机) | 束宽同时放大搜索展开与最终摆放两端的开销 |

## 为什么用粗分数截断，并强制保留“份数不变”？

副本数搜索每推进一个阶段，每个现有状态都会按 [replica_search_radius](replica-search-radius-cd3118b5aae5.md) 尝试多个预算值；如果不加截断，状态数会在几段之后呈指数爆炸。束宽是最直接的闸门：每段只过滤保留能补齐的唯一状态并按粗分数截断，使搜索规模随阶段数近似线性增长而非指数增长。

截断依据的是粗分数（单份副本扛的最大风险），而不是摆完后的真实预测峰均比，因为给每个中间状态都跑一遍带约束 LPT 摆放的开销过高。留出较宽的束宽，目的是让“粗分数略差、但受槽位、协方差与搬运限额约束后摆出来反而更均衡”的份数方案有机会进入最终摆放对比。

同时，STAIR 在最后一次截断后强制保证“保持当前副本份数不变”留在候选池中：这样规划器每轮至少会把“只调整专家位置、不改副本份数”的方案纳入对比，避免因为粗分数排序把不改份数的可行方案提前淘汰。

## 调大调小的代价、写 1 陷阱与放到 GLM 双机

以下方向分析基于源码搜索与去重逻辑，尚缺相同负载下不同束宽的设备耗时与均衡度实测对照。

- **调大（往 `128` 靠）**：CPU 计算量在搜索与摆放两头同时上升——每段展开的状态上限随束宽线性增长，最终送入带约束 LPT 摆放的候选上限也随束宽线性增长，且每次摆放还可能消耗多达 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 次替代可行分支回溯（默认值下总展开 `1,394` 次的推导见 [stair_config](stair-config-cca9e594a052.md#代价通信器回退陷阱与放到-glm-双机)）。不过束宽给出的是上限而非固定运行次数：每段只保留能补齐的状态并按份数去重，最终候选同样过滤去重，摆放失败的候选也会跳过，因此增大束宽不保证一定产出更多可用方案，也不能按束宽倍数直接换算耗时。
- **调小（往 `2` 靠）**：搜索越贴近纯贪心，粗分数略逊但在实际卡位约束下更优的方案越容易被提前淘汰。
- **写 `1` 的陷阱**：看上去像“只留最好的一个候选”，但最后一次截断后唯一的位置会被强制保留的“份数不变”顶替掉，导致 STAIR 永远不再调整每个专家的副本份数（只允许在现有份数下重新摆放位置）。想要最小搜索开销又保留副本份数调整，至少应设为 `2`。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：当前部署固定镜像 `db701c1f` 没有 `stair_config`，写入即启动失败（报错见 [stair_config](stair-config-cca9e594a052.md)）。若迁移到已接入 STAIR 的 `v0.30.0`/`main` 并沿用当前零冗余摆法（每卡 18 个专家、无副本位，见 [EP 页](../concepts/expert-parallel.md#16-张卡怎样分专家)），副本数搜索只产出“每专家 1 份”这唯一候选（它本身就是“份数不变”），每层每轮只跑 1 次摆放，束宽写多少效果都相同。

## 对照源码

下表对照 `stair_config.replica_search_beam_size` 在四个固定版本快照上的束宽校验、三处截断与“份数不变”兜底：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（无 `stair_config`） | 无 | `StairConfig.replica_search_beam_size: int = 64`，合法 `1..128` [C19][C20] | 同左 [C26] | 写 `0` 或布尔值均在建配置时抛 `ValueError` |
| 三处截断与接入 | — | — | MRv2 controller 接入，阶段展开、目标汇总、增量最终候选三处均按 `beam_size` 截断 [C21][C22][C23][C24] | 同左（`stair.py` 零 diff） | 阶段与最终候选均过滤去重，失败摆放跳过 |
| “份数不变”兜底 | — | — | 截断后若 `current` 不在 `selected` 内，覆写 `selected[-1] = current` [C22] | 同左 | 设为 `1` 时副本数调整实质关闭，至少设 `2` [!] |

- **源码与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L474-L533`（阶段展开去重与截断，[C21]）、`#L587-L641`（目标截断与增量候选强制保留当前份数，[C22]）及 `#L1157-L1189`（候选循环与跳过失败摆放，[C23]）。写 `1` 锁死副本数、指数增长截断与 GLM 零冗余退化为单候选均为静态推导 [D]；带约束摆放相对副本数搜索更重及束宽与耗时无固定倍数关系为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S25]）与 `main`（`#L233-L252`，[S27]）均列出默认 `64` 与范围 `1–128`。
- **待核**：本工作区无 NPU 实机环境，尚无副本数搜索与带约束 LPT 摆放两端的真实耗时占比，以及不同束宽下的均衡度实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_beam_size` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_beam_size"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `64` |
| 定义 | `vllm_ascend/ascend_config.py:224` [C19] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 1 <= self.replica_search_beam_size <= 128:
    raise ValueError('stair_config.replica_search_beam_size must be between 1 and 128')
````
