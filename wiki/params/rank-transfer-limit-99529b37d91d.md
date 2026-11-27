---
id: rank-transfer-limit-99529b37d91d
title: rank_transfer_limit
type: param
origin: seed
evidence: C
summary: >-
  STAIR 单层一轮规划里每张卡换入专家与充当搬运来源的次数上限（两方向分别计数），同时截断一轮副本数调整步数。v0.30.0 与 main 声明默认 -1（不限），合法值为 -1 或正整数；未显式指定通信器而自动回退 torch_gloo 时，未显式填写的限额会自动收紧为 1。
aliases:
  - stair_config.rank_transfer_limit
  - 每卡专家搬运上限
  - 单卡专家搬运上限
  - STAIR rank transfer limit
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；STAIR 怎么走一轮规划、为什么钉点上写了起不来，都在父参数页
  - to: eplb
    kind: builds-on
    note: 「搬一个专家」在 EPLB 里意味着什么、要付什么代价，在 EPLB 页
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
  一句话: 它管什么声明默认与-gloo-回退收紧的区别
  为什么存在: 为什么按卡双向限额并截断副本调整步数
  开了的代价: 调大调紧与协同约束边界
  调大调紧的代价与放到-glm-双机: 每张卡只换一个专家时一轮能搬多少
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L222
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L203-L204'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L250-L251'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L924-L932'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L410-L432'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L780-L786'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L541-L604'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L985'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L983'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L222
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L210
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L220
  - >-
    raw:sha256-61d4d98059ac20efe4d1bac0093607adb902428a7f2bdcb15fe521c00ed6eeac.md#L1-L203
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L858-L874'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L251'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1149-L1175
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1503-L1524
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L222
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L220
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L220-L250'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L600-L641'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L739-L842'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1055-L1114'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1154-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_eplb.py#L152-L240'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L465'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L227-L257'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L261'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-61d4d98059ac20efe4d1bac0093607adb902428a7f2bdcb15fe521c00ed6eeac.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
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
    raw/sha256-e8d4009d557761ee24c30bfe4fdf046610f9145817df6b3e11aecbfe9d227608.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 它管什么，声明默认与 Gloo 回退收紧的区别？

**`rank_transfer_limit` 限制每张卡每层一轮最多换进几份专家权重、以及作为来源往外发出几份专家权重（两个方向分别计数，原地保留的专家计 `0` 次）。**

它是 [stair_config](stair-config-cca9e594a052.md) 下的整数限流参数（服务于 [Model Runner V2](../concepts/model-runner-v2.md) 的动态 [EPLB](../concepts/eplb.md)）。同时，它还前置截断单轮副本份数的增量调整步数：在 `v0.30.0` 与 `main` 中，从当前副本份数朝目标逐份增减的步数上限为 $\min(\text{总槽位数} - \text{逻辑专家数},\ \text{卡数} \times \text{rank\_transfer\_limit})$；取 `-1` 时仅受总额外副本槽位数（$\text{总槽位数} - \text{逻辑专家数}$）封顶（早期快照 `4d1412d1` 曾用总槽位数作 `-1` 时的上界）。

**版本与有效值必须同时核对「声明默认」与「实际通信器」**：

| 场景 / 版本 | `rank_transfer_limit` 声明或有效值 | 说明 |
| --- | --- | --- |
| `v0.23.0` / `v0.26.0rc`（及历史旧镜像） | 无此键 | 写入直接启动报错（见 [stair_config](stair-config-cca9e594a052.md)） |
| 早期快照 `4d1412d1` | 声明默认 `1` | 引入初期默认每卡限 1 |
| `v0.30.0` / `main`（显式指定 `communicator`，或 HIXL 共识成功） | 声明默认 `-1`（不限） | HIXL 为昇腾跨卡高速传输引擎；显式指定 `communicator` 会跳过自动探查与收紧路径 |
| `v0.30.0` / `main`（未指定 `communicator` 且回退 `torch_gloo`） | **未显式填写项自动收紧为 `1`** | 全组 HIXL 探查任一 rank 不可用或绑定类型不一致时回退 PyTorch `torch_gloo` 通信后端；用户显式写出的值（如 `-1` 或正整数）原样保留 |

## 事实表

调整 `rank_transfer_limit` 前，先核对合法取值（注意 `0` 非法）以及它在摆放与副本步数两处的双重约束：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]`（`int = -1`） | `v0.30.0`/`main` 声明默认不封顶；自动回退 `torch_gloo` 时未显式配置项会自动收紧为 `1` |
| 合法取值 | `-1` 或正整数 `≥ 1`（拒绝布尔值，越界抛 `ValueError`） | **`0` 非法**（与允许 `0` 禁跨机的 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 不同）；想限制最小搬运只能填 `1` |
| 约束① 摆放与来源 | 单层一轮规划里每张卡换入次数 ≤ 本值，且作为搬运来源发出次数 ≤ 本值 | 换入与发出两方向独立计数；留在原卡的专家计 `0` 次、不占额度 |
| 约束② 副本挪动步数 | 有限正值时截断为 `min(额外副本槽位数, 卡数 × 本值)`；`-1` 时仅受额外副本槽位数限制 | 16 卡、额外槽位充足且有效限额为 `1` 时，单层一轮最多调整 16 步副本份数 |
| 触碰上限的结果 | 限额内摆不出合法方案的候选被放弃，全层无更优可行候选时本轮保持原样 | 属于正常规划流控，不会抛错中断推理 |
| 大数值边界 | 正整数不小于每卡槽位数时，换入一侧等效于 `-1` | 单卡单轮换入数量天然不可能超过该卡总槽位数 |

## 为什么按卡双向限额，并截断副本调整步数？

EPLB 每轮「数、算、搬」的最后一步是在卡间拷贝专家权重（流程见 [EPLB 一轮循环](../concepts/eplb.md#一轮循环怎么走数算搬)）。STAIR 把单卡搬运量直接编进规划约束：摆放某份副本时，目标卡必须同时满足三条件——仍有空槽、目标摆放中尚未放入同一专家，且该卡原已持有该专家或换入次数未达 `rank_transfer_limit`。随后匹配权重来源时，同样要求每张来源卡发出次数不超过 `rank_transfer_limit`。即便接收额度未满，也不能向已满卡继续摆放或同卡放同一专家的两份副本。

按**单卡**双向封顶而非只限全局总数，是因为权重拷贝的显存读写和通信压力直接落在发出卡与接收卡上：同样总量的搬运，集中砸在一两张卡上对单卡推理延迟的扰动远大于分散到全部卡上。

第二处作用则是前置裁剪：单轮每卡换入数受限时，副本份数一次改得离现状太远往往无法在限额内摆出，因此在增量候选生成阶段便按 `卡数 × 本值` 封顶挪动步数。需要注意，一次副本数调整步并不直接等同于一次最终权重搬运——具体由哪张卡拷贝哪份权重，仍要等候选完成 LPT 摆放与来源匹配后才能确定。

```wiki-diagram
file: param-stair-transfer-limits
```

拿两组小数字核对这两处作用（**示意**，按 `stair.py` 规则计算）：

- **作用① 双向独立计数（4 卡、每卡 3 槽，`rank_transfer_limit = 1`）**：设 `R0` 原持 `[E0, E1, E2]`，新摆法改为 `[E0, E1, E5]`，同时 `R2` 从 `R0` 拷走 `E2`。对 `R0` 而言：`E0, E1` 原地保留计 `0` 次，新换入 `E5` 占换入额度 `1 <= 1`，对外发出 `E2` 占发出额度 `1 <= 1`，两方向独立记账合法。若 `R3` 同轮还想从 `R0` 拷走 `E1`，`R0` 发出涨到 `2 > 1` 即被拒，须改选其他源卡或回溯。
- **作用② 截断副本挪动步数（8 卡、每卡 4 槽共 32 槽、20 个逻辑专家，额外副本槽 $32 - 20 = 12$）**：有效限额为 `1` 时，挪动步数截断为 $\min(12,\ 8 \times 1) = 8$ 步；调高至 `2` 时，$\min(12,\ 8 \times 2) = 12$ 步，仅受 `12` 个额外副本槽封顶。

## 调大调紧与协同约束边界

以下分析基于源码控制流与参数约束，尚缺相同负载下不同取值的设备实测对照。

- **调大（或写 `-1`）**：单轮允许替换的专家增多，可在更少轮次内逼近目标摆法，同时单轮跨卡拷贝的带宽占用与等待时间上升（详见 [EPLB 代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）。
- **有效限额为 `1` 时**：每卡每层一轮至多换入和发出各 `1` 份，跨度较大的重排需分多轮完成。限额内摆不出合法方案且回溯耗尽的候选会被丢弃，全层无更优可行候选时返回 `None` 保持原状（注意 `v0.30.0`/`main` 的有效值需同时核对显式配置与是否自动回退 `torch_gloo`）。
- **与跨机限额、回溯预算及副本搜索的协同**：
  - **跨机限额双约束**：[cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 按节点计跨机收发，本键按卡计换入发出，候选必须**同时满足两套账本**。
  - **回溯终止三条件**：限额越紧越容易在摆放中途撞墙；[placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 扣的是接受替代可行分支的次数——预算刚好归零时仍可走完当前路径，只有「来源可行 + 该步已有可行分支 + 预算已满」同时成立才放弃该候选。
  - **副本调整步数截断**：目标副本数搜索本身由另三个键控制，但本键截断从现状朝目标挪动的步数（搜索成本见 [stair_config](stair-config-cca9e594a052.md#搜索开销通信器回退收紧与零冗余边界)）。

## 每张卡只换一个专家时一轮能搬多少

以 `16` 张卡（`EP16`）、每卡每层 `18` 个物理槽位且采用零冗余配置（`288` 个逻辑专家填满 $16 \times 18$ 槽位，见 [EP 专家切分](../concepts/expert-parallel.md#16-张卡怎样分专家)）为例，在已接入 MRv2 STAIR 的版本上：

- **有效限额为 `1` 时的搬运上界**：当显式设置 `rank_transfer_limit: 1` 或因回退 `torch_gloo` 自动收紧为 `1` 时（声明默认 `-1` 本身不提供此上界），每张卡每层一轮最多换掉 `18` 个专家里的 `1` 个、对外也最多发出 `1` 个，全网单层一轮**最多发生 `16` 次专家搬运**。
- **零冗余与槽位饱和边界**：零冗余下额外副本槽位为 `0`，因此本键截断副本调整步数的第二处作用不触发；而单卡换入数量天然不可能超过每卡槽位数，将本键设为 `18` 及以上在换入侧即与 `-1` 等效。

## 对照源码

下表对照 `stair_config.rank_transfer_limit` 在四个固定版本快照上的声明默认、Gloo 回退收紧与副本挪动步数上限：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认 | 无（无 `stair_config`） | 无 | `StairConfig.rank_transfer_limit: int = -1`，合法 `-1` 或 `≥ 1` [C23][C24] | 同左 [C31] | 写 `0` 或布尔值启动即抛 `ValueError` |
| Gloo 自动回退收紧 | — | — | 未显式指定 `communicator` 且 HIXL 共识失败回退 `torch_gloo` 时，仅将未显式填写的限额收紧为 `1` [C29] | 同左 | 显式值与显式 `communicator` 均跳过收紧 [!] |
| 副本调整步数上限 | — | — | `min(总槽位数 - 逻辑专家数, 卡数 × rank_transfer_limit)`（`-1` 时取额外副本槽位数）[C25][C28] | 同左（`stair.py` 零 diff） | 较旧 `4d1412d1` 以总槽位数作 `-1` 上界更为精确 |
| 摆放与回溯边界 | — | — | `_migration_sources` 同时校验每卡与跨节点双向额度；`lpt_placement` 预算耗尽仅放弃当前候选 [C26][C27][C28] | 同左 | 全层无可行或更优候选返回 `None`，不报错 |

- **算法与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L600-L641`（`incremental_replica_candidates`，[C25]）、`#L739-L842`（双向额度匹配，[C26]）、`#L1055-L1114`（回溯耗尽三条件，[C27]）与 `#L1154-L1189`（`max_replica_changes` 与候选循环，[C28]）。16 卡显式设 `1` 最多调 16 步、本值 `≥ 18` 等效 `-1` 与 GLM 零冗余推演均为静态推导 [D]，按卡封顶减少单卡扰动的解释为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L465`，[S30]）与 `main`（`#L233-L261`，[S32]）均记录默认 `-1`、范围 `-1` 或正整数及配置示例。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `rank_transfer_limit` 取值下的实际搬运耗时与收敛轮数对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.rank_transfer_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `-1` |
| 定义 | `vllm_ascend/ascend_config.py:220` [C23] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.rank_transfer_limit != -1 and self.rank_transfer_limit < 1:
    raise ValueError('stair_config.rank_transfer_limit must be -1 or positive')
````
