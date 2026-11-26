---
id: replica-search-num-stages-e4b10925ff97
title: replica_search_num_stages
type: param
origin: seed
evidence: C
summary: >-
  STAIR 分阶段副本数搜索把按风险降序排列的专家切成的阶段组数：前面各组逐段探索额外副本预算，最后一组贪心补齐；默认 4，合法范围 1–8，实际组数取配置值与专家数的较小者，设为 1 时目标退化为纯贪心。v0.30.0 与 main 已接入 MRv2。
aliases:
  - stair_config.replica_search_num_stages
  - 副本搜索阶段数
  - STAIR 副本搜索阶段数
  - STAIR replica search stages
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；STAIR 一轮规划的四步、搜索规模的推导、钉点上写了为什么起不来，都在父参数页
  - to: eplb
    kind: builds-on
    note: 冗余副本是什么、为什么热门专家要多放一份，在 EPLB 页
  - to: ascend-config-system
    kind: builds-on
    note: 该参数通过 AscendConfig 的嵌套子配置输入，正确层级及对应版本是否识别该键是配置生效的前提。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么专家怎么分组搜索
  为什么存在: 副本数搜索完整走法与手算例子
  开了的代价: 段数增减的代价与放到-glm-双机
sources:
  - >-
    vllm-ascend@8d4409d6256d8a6729140ddcc0d1889e3f96cdd6:vllm_ascend/ascend_config.py#L224
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L208-L209'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L254-L255'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L227-L252'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L264-L321'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L355-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L390-L432'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L924-L947'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L212
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L221
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L222
  - >-
    raw:sha256-bf9ac72e1f9b1d351d9fcc8cb8e4593a532825870ac37d990d5ae3720160a440.md#L1-L234
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L360-L362
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L255'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L567-L594'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L224
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L225
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L222
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L222-L254'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L437-L533'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L534-L641'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1154-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L229-L261'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-7436bca2da55bc360fe67512927c3c9d50eab079a7e874139be1e5a94bbc55ce.md
  - >-
    raw/sha256-89407265de5b7c0826e8ae0a890841ce901f8058bdc7891b86d06dece485e079.md
  - >-
    raw/sha256-bf9ac72e1f9b1d351d9fcc8cb8e4593a532825870ac37d990d5ae3720160a440.md
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
---
## 它管什么，专家怎么分组搜索？

`replica_search_num_stages` 是 [stair_config](stair-config-cca9e594a052.md) 下的整数参数，控制 STAIR 规划中「每个专家该放几份副本」这一 FlashTree 风格分阶段搜索的**阶段（分组）数量**。注意它分组的对象是按风险降序排列的专家，而不是把模型层或流水线切段。

专家先按风险降序排列（风险相同时按专家编号升序破平局，保证确定性顺序），再切成 $\min(\text{replica\_search\_num\_stages},\ \text{专家数})$ 个尽量等大的组（除不尽时前面的组多 1 个）。前面每一组各做一次预算分支选择，最后一组直接用贪心规则补齐剩余额外副本位。

默认 `4`（前 3 组各展开选择一次，第 4 组贪心补齐），合法范围 `1–8`。常规场景保持默认 `4` 即可，若未配置冗余专家（`num_redundant_experts = 0`）则本参数不会产生任何候选差异；设为 `1` 时直接进入最后一组，跳过前置分段展开，搜索目标只剩纯贪心那一个（从现状朝该目标增量挪动途中的中间步仍保留为候选）。冗余副本的动机与作用见 [EPLB 副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)；整个副本数搜索的完整走法统一以本页下一节为唯一完整说明，[replica_search_radius](replica-search-radius-cd3118b5aae5.md) 与 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 均回链此处。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际读取该键；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动报错（见 [stair_config](stair-config-cca9e594a052.md)）。

## 事实表

调整 `replica_search_num_stages` 前，先核对阶段切分、零冗余前提以及与半径、束宽的三键分工：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["replica_search_num_stages"]`（`int = 4`） | 前 3 组逐段展开预算，第 4 组直接贪心补齐 |
| 合法取值 | 整数 `1–8`（拒绝布尔值，越界抛 `ValueError`） | 配置值大于专家数时自动按 `min(本值, 专家数)` 截断，不报错也不建空组 |
| 槽位前提 | 要求 `专家数 ≤ 总位置数 ≤ 专家数 × 设备数` 且 `总位置数 % 设备数 == 0` | 零冗余（`总位置数 == 专家数`）时无额外副本位可分，段数写多少都只产出每专家 1 份 |
| 设为 `1` 的效果 | 跳过前置分支展开，只产出纯贪心这一个目标 | [replica_search_radius](replica-search-radius-cd3118b5aae5.md) 不再起作用，束宽仅剩截断增量候选的作用 |
| 与另两键的分工 | 本键定“做几次阶段选择”，半径定“每次试几个预算取值”，束宽定“每次留几个往下走” | 三者共同决定每层每轮 CPU 副本数搜索的展开规模 |

## 副本数搜索完整走法与手算例子

STAIR 先定「每个专家放几份副本」，再定「每份副本摆到哪张卡」。前一步最快的办法是**贪心**：每专家先占 1 份，再把额外副本位逐个发给 `风险 ÷ 已有份数` 最大的专家（单专家份数不超过卡数）。但贪心粗分数看不见卡位容量限制、同卡专家协方差以及搬运上限，只拿纯贪心单一目标去摆，一旦遇到卡位与搬运约束就会错失「份数微调后摆出来更均衡」的方案。

```wiki-diagram
file: param-stair-replica-search-tree
```

因此 STAIR 通过 `replica_candidates` 与 `incremental_replica_candidates` 在贪心附近系统探索备选，六步走法如下：

1. **起点**：每个专家先占 `1` 份，剩余 `总位置数 - 专家数` 为待分配的额外副本位。
2. **风险分组**：按风险降序、同分按专家编号升序排好专家，切成 `min(replica_search_num_stages, 专家数)` 组。
3. **逐组展开**：对前面每一组，先用贪心把全部待分位置分一遍得到该组中心预算，再向左右各试至多 [replica_search_radius](replica-search-radius-cd3118b5aae5.md) 个合法预算。每个预算先在本组内贪心分配，再临时用贪心补齐后续各组以按「补齐后每份副本扛的最大风险」打分；筛选按已确定的部分份数去重并截断到 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 个状态（去重后不足束宽时按实际数量全部保留）。传给下一阶段的仅是已固定的部分份数与剩余位置数，临时补齐结果不会被提前固化。
4. **收尾**：最后一组用贪心补齐，去重排序后得到至多「束宽」个目标副本份数。
5. **从现状增量挪动**：从当前份数朝每个目标一步一步挪（每步一个专家加 1 份、另一个减 1 份，步数受 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 约束），途中每一步均记入候选池；按粗分数排序截断至束宽，并强制保证「份数不变」留在候选中。
6. **交付带约束摆放**：每个候选各跑一次带约束 LPT 摆放，计算真实预测峰均比并按父页把关规则选优。

**手算示意（教学假设，非实测）**：6 个专家、4 张卡、每卡 2 槽（共 8 槽、2 个额外副本位）；风险 `E0=10, E1=8, E2=4, E3=3, E4=2, E5=1`；设 `2` 段、半径 `1`、束宽默认：
- **分组**：前组 `E0–E2`，后组 `E3–E5`。
- **前组展开**：贪心先把 2 个额外位分给 `E0`（`10÷1`→2 份每份 `5`）和 `E1`（`8÷1`→2 份每份 `4`），中心预算为 `2`。半径 `1` 本应试 `1, 2, 3`，因总额外位仅 `2`，`3` 被合法区间裁掉。取 `2` 时 `E0, E1` 各 2 份，补齐后最大单份风险 `5`；取 `1` 时前组只给 `E0` 加 1 份，余 1 个由后组贪心给 `E3`，补齐后最大单份风险为 `E1` 的 `8÷1=8`。
- **收尾目标**：产出两个目标——`[2,2,1,1,1,1]`（粗分 `5`，纯贪心）与 `[2,1,1,2,1,1]`（粗分 `8`）。后者粗分较差仍被保留，以便在第 6 步真实摆放时应对卡位、协方差与搬运限额。段数越多，前置高风险组与后续组之间的预算组合越细；段数为 `1` 时跳过第 3 步，仅剩纯贪心目标。

## 段数增减的代价与放到 GLM 双机

以下方向分析基于源码展开次数上限推导，尚缺相同负载下不同阶段数的设备实测对照。

- **段数越多，CPU 上展开越多**：每多一段就多一轮第 3 步的预算展开，每轮最多展开 `束宽 × (2 × 半径 + 1)` 个状态，每次展开执行两遍贪心分配。默认值（阶段 4、半径 8、束宽 64）下三次展开上限合计 `1,394` 次（详细推导统一在 [stair_config](stair-config-cca9e594a052.md#代价通信器回退陷阱与放到-glm-双机)）。因为第一段只从 1 个初始状态起步，阶段数从 `1` 增到 `2` 时增量最小，从第 `3` 段起每段输入状态数才会触及默认束宽 `64` 的上限。
- **段数越少，备选越窄**：设为 `1` 时搜索目标只剩纯贪心那一个（及从现状挪向它途中的中间步），若纯贪心份数在真实摆放约束下效果欠佳，规划器没有其他目标份数可试。
- **段数大于专家数**：自动按 `min(replica_search_num_stages, 专家数)` 截断，既不报错，也不建空组或多算。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：当前部署固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动失败（报错见 [stair_config](stair-config-cca9e594a052.md)）。若迁移到已接入 STAIR 的 `v0.30.0`/`main` 且仍保持当前零冗余（每卡 18 个专家、无副本位，见 [EP 页](../concepts/expert-parallel.md#16-张卡怎样分专家)），待分额外副本位为 `0`，每段只有「本组拿 0 个」唯一选择，搜出的唯一结果就是「每专家 1 份」，阶段数写多少都一样。要让副本数搜索真正发挥作用，须先配置冗余副本位，并满足 `(逻辑专家数 + 冗余数)` 能被 EP 大小整除（规则见 [EPLB 副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)）。

## 对照源码

下表对照 `stair_config.replica_search_num_stages` 在四个固定版本快照上的阶段数校验、专家分组与增量候选调用：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（无 `stair_config`） | 无 | `StairConfig.replica_search_num_stages: int = 4`，合法 `1..8` [C20][C21] | 同左 [C27] | 越界或布尔值均在建配置时抛 `ValueError` |
| 分组与展开接入 | — | — | MRv2 controller 接入，`replica_candidates` 按 `min(num_stages, num_experts)` 分组展开，最后一组贪心补齐 [C22][C23][C25] | 同左（`stair.py` 零 diff） | 阶段展开仅固定本组及此前份数，临时补齐不提前固化 [!] |
| 槽位与增量调用 | — | — | 校验总位置上下界及可整除性，`plan_layer` 经 `incremental_replica_candidates` 生成候选 [C23][C24] | 同左 | 零冗余时额外槽位为 `0`，段数配置不起作用 [D] |

- **算法与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L437-L641`（`_allocate_extra_replicas`、`_expand_replica_search_stage`、`replica_candidates` 与 `incremental_replica_candidates`，[C22][C23]）和 `#L1154-L1189`（`plan_layer`，[C24]）。设 `1` 退化为纯贪心、第一段增量最小、6 专家手算示意与 GLM 零冗余退化均为源码推导 [D]；贪心粗分数可能错过摆放更优方案为算法动机推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S26]）与 `main`（`#L233-L252`，[S28]）均记录默认 `4` 与范围 `1–8`。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `replica_search_num_stages` 下的规划耗时与峰均比改善实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_num_stages` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_num_stages"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `4` |
| 定义 | `vllm_ascend/ascend_config.py:222` [C20] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 1 <= self.replica_search_num_stages <= 8:
    raise ValueError('stair_config.replica_search_num_stages must be between 1 and 8')
````
