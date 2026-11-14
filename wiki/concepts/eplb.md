---
id: eplb
title: EPLB：按实测热度调整专家放在哪张卡
type: feature
summary: >-
  EPLB 在推理中统计每个专家接到的 token–expert
  配对数，按峰均比重排专家位置、必要时加副本，再逐层搬权重并换表；本部署未启用，只给开启条件与估算。
aliases:
  - EPLB
  - Expert Parallelism Load Balancer
  - 专家负载均衡
  - dynamic_eplb
  - log2phy
  - 冗余专家
chapters:
  - '14'
order: 30
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L513-L539'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_utils.py#L46-L107'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_utils.py#L110-L136'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/eplb_updator.py#L79-L153'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L337-L410'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_device_transfer_loader.py#L46-L95
  - >-
    vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_device_transfer_loader.py#L97-L138
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L72-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L816-L875'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L303-L335'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L28-L57'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_comm_method.py#L131-L171'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L225-L258'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L84-L102'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L529-L553'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3706-L3715'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/v2/model_runner.py#L72-L73'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/eplb/core/eplb_utils.py#L46-L60'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L562-L570'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/eplb.py#L40-L70'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1490-L1520'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/policy/policy_factory.py#L12-L30'
  - >-
    vllm-ascend@db701c1f:tests/e2e/pull_request/two_card/test_qwen3_moe_eplb.py#L35-L77
  - 'vllm@0fc695fc:vllm/config/parallel.py#L154-L178'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L470-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3652-L3657'
  - 'vllm-ascend@db701c1f:tests/ut/eplb/core/a2/test_eplb_utils.py#L1-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L47-L48'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_multiproc_executor.py#L195-L200
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L249-L256'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L306-L310'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L859-L863'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L836-L882'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L878-L924'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L175-L218'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/2c59ff1047573f40a471cf7535f01a8877344415/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/tutorials/models/GLM5.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/developer_guide/Design_Documents/model_runner_v1_eplb.md#L30-L201
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/2c59ff1047573f40a471cf7535f01a8877344415/docs/source/developer_guide/Design_Documents/eplb_swift_balancer.md#L30-L199
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/tutorials/models/DeepSeek-V4-Flash-Vision.md#L117
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/tutorials/models/Qwen3-30B-A3B.md#L510
  - >-
    raw:sha256-50605bb0935329a6f7c348fec3abbff9cfe2474ff101c9fc6feedd9472181606.md#L1-L974
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L234-L234
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L521-L530
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/eplb/eplb_updator.py#L129-L143
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L564-L570
  - >-
    raw:sha256-6d32ac588ea31ea0d0bf307625f3b59b6e82165ec9522186e73ebdd95e064754.md#L1-L1019
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L20-L28'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L37-L83'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L278-L334'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L283-L314'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L124-L239'
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L24-L57
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L24-L57
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/policy/policy_random.py#L1-L26'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L71-L100'
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L60-L85'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3679-L3788'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L39-L179'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2105-L2157'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L291-L374'
  - 'vllm@0fc695fc:vllm/v1/spec_decode/llm_base_proposer.py#L1157-L1200'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L351-L461'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L80-L254'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L436-L499'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L101-L252'
  - 'vllm-ascend@baa023ad:vllm_ascend/eplb/core/eplb_utils.py#L46-L95'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L867-L874'
  - 'vllm-ascend@db701c1f:tests/ut/eplb/core/a2/expert_map.json#L1-L17'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/v2/model_runner.py#L63-L73'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/v2/model_runner.py#L65-L69'
verified: []
evidence: C
relations:
  - to: expert-parallel
    kind: builds-on
    note: 理解专家权重如何分配到设备
  - to: moe
    kind: builds-on
    note: 理解逻辑路由和专家函数
  - to: collective-communication
    kind: builds-on
    note: 理解专家激活和权重搬运的不同通信
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-50605bb0935329a6f7c348fec3abbff9cfe2474ff101c9fc6feedd9472181606.md
  - >-
    raw/sha256-6d32ac588ea31ea0d0bf307625f3b59b6e82165ec9522186e73ebdd95e064754.md
  - >-
    raw/sha256-e83c99f8b0083db6c77e1a24fa70927978b8ba3034e800af1bed1ab0e234ceb0.md
---

## EPLB 是什么？

**EPLB（Expert Parallelism Load Balancer，专家并行负载均衡）在推理跑着的时候数一数每个专家实际接了多少活，按这个热度重新安排专家放在哪张卡上，必要时给最热的专家多放一份副本，让各张卡的活差不多一样多。**

先用两句话交代前提。[MoE](moe.md) 层里有很多个专家，router 给每个 token 只挑其中几个来算；[专家并行（EP）](expert-parallel.md)把这些专家分放到不同的卡上，每层先把 token 发到它选中的专家所在的卡（dispatch），算完再送回原来的卡（combine）。需要这些结果的后续计算必须等依赖完成，因此参与路径中较慢的计算或通信会拖长这一层。

EP 按编号把专家平均分给各卡，每张卡放的专家一样多；可每张卡接到多少活，要看 router 这段时间偏爱谁。EPLB 做的是一个不停转的循环：

```wiki-diagram
file: eplb-cycle
```

图里是两张卡、四个专家的小例子，数是编的；等待的解释采用各卡处理速度相近、专家计算耗时随配对数增长的理想条件。把「一个 token 交给一个专家」算作一个 token–expert 配对（下文简称「一对」），「接了多少活」就数配对的个数。

1. **数。** 窗口 1 里，卡 0 上的 E0、E1 各接 8 对，合计 16；卡 1 上的 E2、E3 各接 2 对，合计 4。卡 1 很快算完，只能等卡 0。
2. **算。** 后台按这张热度表排一种新摆法：E1 和 E2 对调，计划两边各 10 对。
3. **搬。** 按新摆法把专家的权重在卡之间传过去。一层一层地搬，传完才把权重写进位置，同时换掉记录「专家在哪」的表。
4. **再数。** 搬完继续数下一个窗口。流量变了，E0 涨到 12 对，卡 0 又比卡 1 忙，于是开始下一轮。

固定镜像只在动态 EPLB 与本轮热度收集状态同时开启时读取专家负载，并断言相关输出非空；某层启用动态调整还要求存在逻辑到物理专家映射。


EPLB 改的只是「专家放在哪张卡」，不改 router 给每个 token 挑哪几个专家，也不改专家的权重内容，所以每个 token 仍由同样的专家、按同样的组合权重算出结果。

## 为什么需要 EPLB？

**因为专家负载不均会拉长需要等待的计算与通信路径，而谁接到更多活由这段时间的流量决定，启动时排不准。**

在各卡处理配对的速度相近、专家计算主导耗时的理想情形下，接活最多的卡通常更晚交回结果，其他参与者在依赖它时要等待，过程见 [EP 的负载不均一节](expert-parallel.md#负载不均最慢的卡决定这一层多久)。一个 token 要依次走过各层 MoE，这类等待会沿依赖路径累积；实际瓶颈还取决于算子、通信与重叠执行。

有的模型在训练时就想办法压平负载，一类做法是加辅助损失，另一类是让 router 带一个校正偏置，让各专家被选中的次数在统计上大致均匀，见 [MoE 的负载一节](moe.md#一批-token-怎样落到专家上负载为什么会不均)。但这些手段在训练结束后就定型了，真实流量照样会偏：比如一段时间里用户问的多是编程题，某几个专家就会特别忙；换成闲聊，热门的又是另一批。

所以热度只能边跑边量。EPLB 把「量热度、改摆法」放到运行时反复做，摆法就能跟着流量走；要付的显存、搬运和时效代价见[代价一节](#代价多占的显存搬运和等待)。

还有一种不在运行时改的做法：把一份摆法写进文件，启动时直接加载，之后不再统计、不再搬动。它只是换了一个固定的起点，开法见[对照源码](#怎么开)。

## 怎么算？数配对、比峰均、换位置

**EPLB 衡量不均用的是峰均比：最忙那张卡的配对数 ÷ 各卡平均的配对数。等于 1 就是完全均匀，越大越不均。**

先说数的是什么。每一层 MoE 各数各的：每一步算完这一层，就把每个专家这一步接到的配对数加到这一层的计数上，数够一个窗口再拿去用。它只数配对个数，不测时间、不测算力，「热门」在这里就是「接的配对多」。一个 token 选了几个专家，就贡献几对。

配对数更均匀，能否让整个请求更快，还取决于两个条件：这个窗口统计出的负载能否代表接下来的流量，以及减少的等待能否抵过统计、规划和搬运的开销。因此，峰均比下降可以说明配对数量的分布更均匀，实际时延和吞吐是否改善仍需运行验证。

规划器（在后台算新摆法的程序）拿到各层的计数后，可以按负载选择新摆法，不只「两两对调」这一种。用于负载优化的策略以改善分布为目标；编号 0 的 `RandomLoadBalance` 在这个固定版本里只是固定交换两张卡末尾位置的测试策略，不根据热度优化。规划后日志会记录新旧摆法的估计峰均比；有副本时，它先把同一逻辑专家的总热度在副本间均分，再计算各卡负载，因而连 `current` 也不能直接当作实测逐卡峰均比。

拿图里的两个窗口算一遍，看换位置能做到哪一步：

```calc
title: 两个窗口的峰均比（数为示意）
窗口 1 各卡平均 = (16 + 4) ÷ 2 = 10
对调前峰均比 = 16 ÷ 10 = 1.6
对调 E1、E2 后每卡 = 8 + 2 = 10
对调后峰均比 = 10 ÷ 10 = 1.0
窗口 2 卡 0 = E0 的 12 + E2 的 2 = 14
窗口 2 峰均比 = 14 ÷ 10 = 1.4
只换位置的下限 = E0 的 12 + 最冷专家的 2 = 14
> 每卡只有 2 个位置，E0 总得和另一个专家同卡；E0 放在哪张卡，哪张卡至少 14
```

窗口 1 的毛病出在「两个热门专家挤在同一张卡」，换个位置就好了。窗口 2 不同：E0 一个专家就有 12 对，已经超过平均的 10，它放在哪张卡，哪张卡就超载，怎么换位置都压不下去。这时要用第二种办法：给它多放一份。

## 最热的专家怎么办？多放一份副本

**冗余专家（redundant experts）就是把同一个专家的权重在另一张卡上再放一份。它不是新专家：router 仍然只在原来那几个专家里挑，挑中之后，再按固定规则决定用哪一份。**

副本的位置要在启动时留好，运行中不能加。每张卡的位置数 =（专家数 + 冗余数）÷ 卡数，必须除得尽：例子里 4 个专家、2 张卡，冗余数只能取 0、2、4……；配 1 个，就是 5 个位置分给 2 张卡，启动时直接报错。配 2 个时，每张卡 3 个位置。

规划器排摆法时，假定一个专家的配对平均分给它的几份副本。于是它给 E0 在两张卡上各放一份，剩下的一个副本位给次热的 E1：

```wiki-diagram
file: eplb
```

实际运行时，副本不是按「当下谁闲」来分活的。每张卡发出的 token 要用哪一份副本，是由卡号（真实部署里还掺进专家编号）按固定规则算出来的；示意里两张卡各有一份时，这条规则正好让每张卡都用自己手边那份。所以 E0 的 12 对怎么分，取决于这些 token 原本在哪张卡上：

```calc
title: 两个副本位怎样分摊（数为示意）
每卡位置数 = (4 个专家 + 2 个副本) ÷ 2 张卡 = 3
规划时 E0 每份 = 12 ÷ 2 = 6
规划时 E1 每份 = 4 ÷ 2 = 2
规划估计每卡 = 6 + 2 + 2 = 10
实际卡 0 = E0 的 8 + E1 的 2 + E2 的 2 = 12
实际卡 1 = E0 的 4 + E1 的 2 + E3 的 2 = 8
实际峰均比 = 12 ÷ 10 = 1.2
> 设 E0 的 12 对里 8 对来自卡 0 上的 token、4 对来自卡 1，E1 的 4 对两边各 2 对
```

1.2 比只换位置的 1.4 好，但没到估计的 1.0。下一轮会重新收集专家热度；不过日志会把 E0 的 12 对重新按两份均分，所以这个例子的 `current` 仍可显示 1.0，不能据此认定实际两卡各接 10 对。副本多了，也要多占显存，见[代价一节](#代价多占的显存搬运和等待)。

## 专家换了位置，token 怎么找到它？

**router 说的是逻辑专家的编号（E0 到 E3），卡上存的是一个个物理位置。每张卡、每层 MoE 各有两张表，把前者翻译成后者。**

物理位置按卡连续编号：卡 0 的 3 个位置是物理 0、1、2，卡 1 的是物理 3、4、5，也就是「物理号 = 本卡第几格 + 卡号 × 每卡格数」。接着上一节的摆法，卡 0 放 E0、E1、E2，卡 1 放 E0、E1、E3。

- **第一张表**回答「这个专家在不在我这儿、在第几格」，不在就记「不在」。本卡算专家时靠它找到权重。
- **第二张表**回答「这个专家有几份时，从我这张卡发出的 token 用哪一份」，直接给出物理号。dispatch 靠它决定把 token 发往哪张卡。

| 逻辑专家 | 卡 0 · 第一张表 | 卡 0 · 第二张表 | 卡 1 · 第一张表 | 卡 1 · 第二张表 |
| --- | --- | --- | --- | --- |
| E0 | 第 0 格 | 物理 0 | 第 0 格 | 物理 3 |
| E1 | 第 1 格 | 物理 1 | 第 1 格 | 物理 4 |
| E2 | 第 2 格 | 物理 2 | 不在 | 物理 2 |
| E3 | 不在 | 物理 5 | 第 2 格 | 物理 5 |

走一遍：卡 1 上一个 token 选中了 E2，查卡 1 的第二张表得物理 2；2 ÷ 3 向下取整是 0，所以它在卡 0 的第 2 格，dispatch 把这个 token 发给卡 0。同一张卡上另一个 token 选中 E0，查表得物理 3，就在卡 1 本卡第 0 格，不用出卡。

搬权重的最后一步就是把这两张表换成新的。表和权重必须一起换：表已经指向新位置、那里放的却还是旧专家的权重，token 就会被错的专家算。

## 一轮循环怎么走：数、算、搬

**EPLB 用一个步数计数器把一轮切成三段：先数若干步，再留若干步给后台规划，最后每步搬一层 MoE；走完计数清零，重新开始。**

1. **数。** 默认收集段占 600 个计数位置。每步每层只在热度收集状态为真时累加本卡各专家的配对数。可以只选 prefill、只选 decode，或者都选（默认都选）。只选一类时，计数器处在 0–598 的不匹配前向不推进；到 599 后，下一次结束回调即使不匹配，也会汇总现有计数并推进到 600。这次汇总用一次 [All-Gather](collective-communication.md#all-gather)，让每张卡把自己那份发给所有卡，再交给后台。因此默认全收集时有 600 次采集，筛选时不能保证收集段一定采到 600 次。

   这里的 prefill 与 decode 是采集范围的名称。GLM 专用快照的第一版模型执行器按补齐后的 token 数筛选：大于阈值时归入 prefill 采集范围，小于等于阈值时归入 decode 采集范围，选择全部时直接开启收集。这个判断没有逐请求核对实际处于哪个阶段，因此采集范围的名称不能直接代表其中每个请求的真实阶段。
2. **算。** 默认留 50 步。规划在一个单独的 CPU 进程里跑，推理照常进行。这 50 步走完时，主进程一次取回所有层的新摆法；后台如果还没算完，主进程就停在这里等。
3. **搬。** 每步处理一层的迁移清单，有几层 MoE 就占几步；没有需要迁移的专家时清单可为空。每步开始时，各卡按清单发起异步的发送和接收，收到的权重先放进接收区；异步提交提供了与本步前向计算重叠的机会，实际重叠程度取决于执行时序和资源竞争。步末等传输完成，换掉这一层的两张表，再把接收区里的权重复制进要替换的位置。这几件事都在下一步开始之前做完，下一步的 token 就按新摆法走。

搬权重用的是一个单独的通信组。它的成员和 MoE 做 dispatch、combine 的那个组相同，但不是同一个组，所以搬运的发送、接收不会排进 dispatch、combine 的组里；走的物理链路还是同一批。

以一个有 4 层 MoE 的示意模型、默认参数为例，计数器从第 0 步开始：

```calc
title: 一轮有多少步（示意模型 4 层 MoE，默认参数）
数 = 第 0 到 599 步 = 600 步
算 = 第 600 到 649 步 = 50 步
搬 = 第 650 到 653 步，每步一层 = 4 步
一轮 = 600 + 50 + 4 = 654 步
> 第 599 步末把全表交给后台；第 649 步开始时取回新摆法；走满 654 步后计数和热度表都清零
```

搬完之后并不马上开下一次规划，要重新经过收集段。所以一次调整依据的，总是它之前那个窗口的流量。

## 代价：多占的显存、搬运和等待

**EPLB 不是白来的：副本和接收区常驻显存，搬权重要占链路、步末还要等，规划按旧窗口排，热点变得太快就追不上。**

**显存两项。** 第一项是副本：每张卡每层多出「冗余数 ÷ 卡数」个位置，每一层 MoE 都有。第二项是接收区：以首个已登记 MoE 层的本卡位置数分配空位；量化类型与 fused MC2 开关组合相同、对应张量形状也一致的层共用一套，不搬的时候也一直占着。实现会断言同一组合的形状一致。只换位置、不配副本时，副本这一项是 0，接收区照样要留。

```calc
title: 示意模型的额外显存（每个专家 10 MiB、4 层 MoE，数为示意）
每卡每层多出的位置 = 2 个副本 ÷ 2 张卡 = 1
副本 = 4 层 × 1 个 × 10 MiB = 40 MiB
接收区 = 每层本卡 3 个位置 × 10 MiB = 30 MiB
每卡合计 = 40 + 30 = 70 MiB
```

**搬运。** 每换一个专家，就要把迁移清单中的权重张量（量化模型还包括缩放系数 scale）传过去。发起是异步的，但这一步结束时必须确认传完；若此时仍未完成，就会增加等待。异步提交本身不保证实际重叠或节省多少时间。搬运和 dispatch、combine 走同一批物理链路，传输还会竞争带宽。

**规划。** 规划在 CPU 子进程里算，不占 NPU 的算力；但取结果那一步如果后台还没算完，主进程要等。

**时效。** 新摆法依据上一窗口的统计。默认周期包含 600 个收集计数、50 个规划计数以及逐层更新计数；收集段前 599 次计数推进要求符合热度收集条件，最后一个计数位置按上一节的规则结束。因此，不能把这些计数直接当作任意前向的固定次数，更不能直接换算为墙钟时间。流量热点变化过快时，旧窗口可能已不代表当前负载。

**有时候不划算。** 如果等待主要来自专家计算，均衡的机会在于缩短最重负载形成的路径。如果每张卡只接到很少几行，权重读取、算子启动或通信就更容易占较大比重；在这些开销主导时，减少几行未必显著缩短执行，上面的统计与迁移开销却照付。仅凭行数不能判定实际带宽瓶颈，见[矩阵乘和权重](matmul-and-weights.md#同一片权重为什么能处理多行输入)。官方文档列了几种不建议开的场景，见[对照源码](#开销和什么时候别开)。

## 放到 GLM 双机：本部署没开 EPLB

**本部署只开了 EP，没有开 EPLB，也没有冗余专家：16 张卡上的专家摆法从启动起就固定不变。下面分三步看：现在怎么摆、负载能说到哪一步、如果要开得满足什么条件。**

### 现在的摆法：每卡 18 个专家，固定不动

本部署是两台 A2、每台 8 张卡，TP8 与 DP2 合起来组成 EP16，采用 W8A8 的专家权重（前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。它按官方双机教程的参数启动，并假定外部环境和额外配置没有另行开启 EPLB：教程命令打开了专家并行，但没有设置 EPLB 环境变量或配置，因此这里按默认的「关闭、零冗余」分析。逐项核对见 [EP 页的这一节](expert-parallel.md#这套部署有没有开-eplb)。

所以 288 个路由专家按编号连续切成 16 份，每张卡固定放 18 个（分法见 [EP 页的 16 张卡怎样分专家](expert-parallel.md#16-张卡怎样分专家)）。主干 42 层 MoE 和 MTP 那一层都这样摆，运行中不数热度、不搬专家，第一张表按连续编号生成，第二张表不存在。

### 负载有多不均：只有理想均分，没有实测

在多请求的场景 M 里，按两组补齐后的 12,096 行、每行选 8 个专家计算，逻辑配对预算为 96,768 对，含补位行；理想均分时每个专家 336 行、每卡 6,048 行。纯 decode 的对应预算是 608 对，每卡理想 38 行。热度统计取调度算子交回的专家计数，是否包含补位行依实际分支，见下文的路径说明；不能把补齐后预算直接当作 EPLB 实测热度。这些数的来历见[多请求同时在跑的 MoE 一站](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)和 [EP 页的每卡账](expert-parallel.md#场景-m-的每卡账权重均分工作量看路由)，这里不重算。

真实流量下最忙的卡比平均多出多少，目前没有逐层、逐专家的路由记录，所以本页不给 GLM 的峰均比，也没有「开了 EPLB 快多少」的数字。作为理想算例，如果各卡每对的计算成本相同、耗时与配对数成正比，拿到平均 2 倍配对的卡，其专家计算时间也是平均值的 2 倍；这种等待可以沿 42 层的依赖路径累积。实际设备的算子效率、权重复用、通信与重叠会改变这个比例，不能由配对数直接推出整层或请求时延。

### 如果打开：要满足的条件和估算

下面是「假如给这套部署打开 EPLB」时，从代码和文档里推出来的条件与估算，都不是实测。

还要先区分实际使用的执行路径。GLM 专用快照的第二版模型执行器会在旧动态功能开启时拒绝启动，不能直接沿用第一版的开启方式。权重能否搬运则取决于两项条件：权重用什么数值格式存储，以及专家计算与卡间通信采用哪条配合执行的路径。适配器用两者的组合查找要搬的权重张量，只有格式和路径都被支持才可继续；具体拒绝的格式与配置键见页末源码说明。

**冗余数只能是 16 的倍数。** 位置数要满足（288 + 冗余数）能被 16 整除；288 = 16 × 18 本来就除得尽，所以冗余数只能取 0、16、32……。取 16 时一层共 304 个位置，每卡 19 个。另外，main 的官方文档写明 A2 不支持冗余专家，v0.23 的文档没有这一条；按 main 的说法，这套 A2 部署只能靠换位置均衡，不能靠副本。

**要搬的是什么。** 本部署是 W8A8、没开 fused MC2，这个组合在搬运支持的格式里：每换一个专家，搬它的两块 int8 权重：gate 与 up 投影合并成的一块、down 投影一块，外加两块各自的 scale。每个专家的 int8 权重是 24 MiB（见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），scale 另计。

**多占的显存。** 按部署页的口径，主干 42 层加 MTP 层共 43 层放路由专家。在这里的旧 V1、PP=1、单模型正常加载路径上，草稿模型沿用 Ascend 配置，MTP 构造的 MoE 也调用 FusedMoE 自动登记；主模型和草稿模型都加载后，warmup 才建立 EPLB 适配器。因此按 43 层估算；还要求这些层使用相同的量化/融合格式组合与张量形状，才能共用下面一份接收区：

```calc
title: 假如取 16 个副本位，每卡多占的显存（估算，未实测）
每卡每层多出的位置 = 16 个副本 ÷ 16 张卡 = 1
副本 = 43 层 × 1 个 × 24 MiB = 1,032 MiB
接收区 = 每层本卡 19 个位置 × 24 MiB = 456 MiB
每卡合计 = 1,032 + 456 = 1,488 MiB ≈ 1.45 GiB
不配副本、只换位置 = 18 个位置 × 24 MiB = 432 MiB
> 都只算 int8 权重，不含 scale；这部分要从 KV cache 的预算里让出来
```

KV cache 的预算怎么来，见[剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

**一轮多少步。** 源码给出的计数结构是收集间隔 + 规划间隔 + 登记的 MoE 层数；在上面的 43 层条件下，默认是 600 + 50 + 43 = 693。收集段前 599 个计数要求热度收集状态为真，末次按前述规则结束，后两阶段按执行回调推进；所以 693 是计数和，不是任意 693 次前向必定完成一轮，也不是测得的时间。

**怎样区分 prefill 步和 decode 步。** 只数其中一类时，门槛是「每步最多请求数 × 每个请求一步的 token 数」。本部署每组一步最多 32 个请求，带 MTP 时 decode 每个请求一步 4 个 token，门槛是 32 × 4 = 128：一步补齐后的 token 数超过 128 算 prefill 步，否则算 decode 步。

**搬运要跨机。** EPLB 的通信组和 MoE 的 MC2 组是同一批 16 张卡，热门专家在两台机器之间对调时，权重要走机间网络。

**官方文档的「不建议开」对照。**

| 文档条件 | 本部署 | 结论 |
| --- | --- | --- |
| P 节点：输入短于 1024 token 时不建议 | 不分 P、D 节点，prefill 和 decode 在同一批卡上混跑 | 这条针对 PD 分离部署的 P 节点，本部署没有直接对应 |
| D 节点：每 die 负载低于 128 token 时不建议 | 纯 decode 每卡理想 38 行；场景 M 每卡 6,048 行 | 按这条的门槛参照，纯 decode 时段每卡行数远低于 128 |
| D 节点：每 die 专家数，v0.23 / v0.26 rc 文档写「≤ 8 不建议」，main 写「> 8 不建议」 | A2 的一张卡是一个 die，每卡 18 个专家 | 两版文档说法相反；按旧版不在不建议之列，按 main 在 |

**补位行与陪跑批次怎样影响统计。** 旧 V1 的非 profiling 陪跑会调用同一套 EPLB 结束回调，计数是否推进仍服从前面的条件。在本页 SP 关闭的 AllGather 路径中，补齐后的 hidden states 与路由分数进入路由初始化，`active_num` 按输入行数乘 top-k 设置，没有传入真实 token 的掩码；普通 MC2 路径则在 `global_bs=0` 时传入 `mc2_mask`，其有效区按真实 token 数构造。两条路径不能混成同一种“实测配对数”；空闲来源组也不等于目的专家没有其他组发来的工作。实际每层采到多少，要结合选中的算子路径与逐卡计数。

**仍需部署验证的组合。** 官方双机教程没有展示 EPLB 与本模型 W8A8、MTP 联用的结果；仓库里 EPLB 的正确性用例用的是 Qwen3-30B-A3B-W8A8。静态加载链说明 MTP 会登记，不能替代 GLM 双机的正确性与性能验证。

这个 Qwen 用例只使用一条固定提示词，每次请求返回一个候选（n=1），比较关闭和开启 EPLB 后的生成文本。它限定了测试覆盖的输入范围；测试文件中的相等断言不等于本次已运行通过，也不能证明 GLM 双机的正确性或性能。

## 常见误解

- **「开了 EPLB，模型输出会变。」** router 的选择不变，专家的权重内容不变，只换专家放在哪张卡，所以每个 token 还是由同样的专家、按同样的组合权重算；仓库的正确性用例比较开关前后的贪心生成，要求文本逐字相同。但这不等于任何情况下都逐位相同：批次组成、走哪条通信路径、浮点加法的顺序都可能带来极小的差异。真正会改路由的是 main 上另一个压测用的开关（[强制均衡](../params/enable-force-eplb-b7ec3661121f.md)），它把 router 的选择换成按顺序轮流分配，不能和 EPLB 同时开。
- **「开了 EP 就有 EPLB。」** EP 决定专家分到多张卡；EPLB 是在 EP 之上另开的功能，要单独打开。本部署只开了 EP。
- **「冗余专家就是多了几个专家。」** 副本和原件的权重一模一样，router 能挑的还是原来那些专家（GLM 是 288 个），多的只是物理位置。
- **「副本会自动把活分给当下更闲的那份。」** 用哪一份由卡号（和专家编号）按固定规则算出来，不看实时负载；规划时按平分估算，实际分摊要看 token 从哪张卡发出。
- **「重排时整个模型要停下来。」** 每步处理一层迁移，发送和接收异步提交，有与本步计算重叠的机会；步末仍要等这一层传完，取回规划结果时也可能阻塞。实际等待须结合执行时序判断。
- **「把摆法存成文件、下次直接加载，就是轻量版 EPLB。」** 加载的只是一个固定的起始摆法，之后不再统计也不再搬；官方文档还写着这条静态路径计划移除。
- **「训练时的校正偏置已经均衡了，推理用不着。」** 偏置只保证统计上大致均匀，而且推理时固定不变；某一段流量照样会偏向少数专家。

## 对照源码

本页讲的是本部署用的 model runner v1 那条路（配 vLLM 0.23.0 时 v2 开关会退回 v1）。钉住版本：vLLM v0.23.0 = 0fc695fc；vllm-ascend 的 v0.23 维护分支 = 2c59ff10，含 GLM 代码的快照 = db701c1f，v0.26 rc = 2ed6cbba，main = baa023ad。未注明版本的行为取自 db701c1f；其中专家算子这部分，配 vLLM 0.23.0 时走的是 v0.23 接口的适配文件，实际装的是哪套接口以[来源基线](../sources/glm-5-3-flash-baseline.md)为准。

### 怎么开

model runner v1 上要同时满足两件事：环境变量 `DYNAMIC_EPLB=true`（只想记录摆法时用 `EXPERT_MAP_RECORD=true`），以及昇腾 additional-config 里的 `eplb_config.dynamic_eplb` 为真。只写配置、不设环境变量，配置校验会直接拦下。[C9] runner 只看昇腾这份配置来决定建不建统计、规划和搬运这一套。[C15] 上游 vLLM 的 `--enable-eplb` 默认关闭，在这条路上不是开关。[C24]

环境变量还管另一件事：vLLM 默认把 worker 进程建成守护进程，守护进程不能再开子进程，而 EPLB 的规划要另起一个进程；所以只有这两个环境变量之一为真时，昇腾才导入那条把 worker 改成非守护进程的 patch。来龙去脉见[三个进程与 patch 注入点](engine-processes.md)和 [Patch 机制](ascend-patch-system.md)。

假如要在本部署上试开（官方双机教程没有这样开过 [S36]，下面只是按配置项推出的写法，两台机器都要加）：

```bash
export DYNAMIC_EPLB=true
vllm serve <教程里的模型与参数> \
    --enable-expert-parallel \
    --additional-config '{"eplb_config": {"dynamic_eplb": true}}'
```

| 配置键（`eplb_config` 下） | 默认值 | 管什么 |
| --- | --- | --- |
| `dynamic_eplb` | `false` | 总开关；打开还要配环境变量 |
| `num_redundant_experts` | `0` | 副本位数；只在打开动态调整时按它留位置（给了映射文件则按文件里的位置数反推），（逻辑专家数 + 它）要能被 EP 规模整除 |
| `expert_heat_collection_interval` | `600` | 数多少步 |
| `algorithm_execution_interval` | `50` | 留多少步给后台规划 |
| `eplb_policy_type` | `2` | 规划算法：0 RandomLoadBalance、1 DefaultEplb、2 SwiftBalanceEplb、3 FlashLB |
| `eplb_heat_collection_stage` | `all` | 只在 prefill 步、只在 decode 步，还是都数 |
| `expert_map_path` | 无 | 从 json 加载起始摆法；单独给它时摆法固定，不统计、不搬；和动态调整一起开时从这份摆法起步 |
| `expert_map_record_path` | 无 | 记录模式：每轮结束导出摆法，跳过步末的换表与权重写回；给了它会把 `dynamic_eplb` 置为真。这个跳过条件不包住前向前的传输提交，不能把它当作零搬运模式 |

算法编号见 [C22]，记录模式的跳过与导出见 [C4]。四个固定版本中表内旧 V1 字段的默认值相同。同仓库 main 上 GLM-5 的教程把两段间隔调短到 50 和 5，这是该教程的部署参数，不能当作本模型的最优值或验证结果；通用指南还建议规划间隔至少 50，复用时须核对对应负载。[S39]

**开没开，看日志。** 启动时会打出 `Dynamic EPLB is ...` 和 `The number of redundant experts is ...` 两行（来源 9）；规划后还有 `Expert hotness imbalance`，给出新旧摆法下各层估计峰均比的平均值和最大值（来源 10、61）。存在副本时，新旧两项都采用副本均分假设；验证真实分摊仍需原始逐卡计数。

**GLM 代码里的上游配置。** GLM 的 MoE 层也会读取上游 vLLM 的 `enable_eplb` 和冗余数，一并传给 FusedMoE [C21]；但昇腾的 FusedMoE 随后按昇腾 `eplb_config` 重新计算全局和本卡的位置数。 上游这边在没开 `--enable-eplb` 时要求冗余数必须是 0，否则报错。[C25]

### 会报什么错

- `The environment variable DYNAMIC_EPLB or EXPERT_MAP_RECORD of the EPLB must be set to true.`：配置里开了 `dynamic_eplb`，环境变量没设。
- `EPLB must used in expert parallelism.`：EP 规模为 1（单卡或没开 EP）却开了 EPLB。
- `(n_expert + n_redundant) % ep_size must be 0`：冗余数配错。示意例子 4 个专家、2 张卡配 1 个会报这条；GLM 配任何不是 16 倍数的值都会报。[C2]

这里的整除要求针对自动生成专家布局的路径；读取已有映射文件走另一条分支，不能直接套用这项检查。上述示意中，若改为增加 2 个冗余位置，总共 6 个位置可以均分到 2 张卡，每张卡得到 3 个位置。通过整除检查只说明位置数满足这一项要求，还没有决定复制哪些专家，也不能据此判断搬运后是否更快。
- `EPLB not support W4A8MXFP` 一类，以及 `EPLB not support ... with fused MC2 ...`：搬运按「量化格式、是否开 fused MC2」查每个专家要搬哪几块张量，W4A8MXFP 被明确拒绝，表里没有的组合直接报错。[C11]
- `eplb_policy_type must in [0, 1, 2, 3]`、`eplb_heat_collection_stage must be one of [...]`、`The expert_map is not json.`、`The expert_map is not exist.`、`The expert_map_record_path is not json.`：配置校验。
- `dynamic_eplb is not supported by Ascend NPU model runner v2.`：v0.23、v0.26 rc 和 GLM 快照上，用 model runner v2 又开了 `dynamic_eplb`（来源 17、75–76）。
- `num_redundant_experts is set to ... but EPLB is not enabled.`：上游 vLLM 的冗余数不为 0，却没开上游 EPLB。
- main 上的 `enable_force_eplb cannot be mixed with dynamic_eplb.`：强制均衡是压测开关，会把路由换成轮流分配，和动态 EPLB 同时开且模型是 MoE 时报错。[C19]

### 开销和什么时候别开

- **常驻显存。** 副本位每层都有；所有接收区的位置数取首个已登记 MoE 层的本卡位置数，再按「量化类型、fused MC2 开关」分别建立张量缓冲，同组合层还须通过张量形状一致的断言才共用。[C8] 本部署假如取 16 个副本位的估算见正文，都没有实测。[D]
- **搬运与等待。** 每步开始时发起异步的发送和接收，这一步结束时等全部完成，先换两张表，再把接收区的权重复制进位置。[C7] 规划结果在规划段最后一步用阻塞的方式取回，后台没算完时主进程会停住。[C5]
- **官方的不建议场景。** 输入短于 1024 token 的 P 节点；每卡负载低于 128 token 的 D 节点；每 die 专家数这一条两版文档相反，见下面的版本差异。文档还提醒：每 die 8 个专家左右时收益可能和开销相当，要先拿真实负载测过、确认有收益再开；运行环境上要求各 NPU 显存与算力一致、网络带宽建议不低于 10 Gbps、容器里挂上共享内存 shm。[S37] 文档按「每 die」计：main 的 DeepSeek-V4-Flash-Vision 教程写明每台 A2 有 8 个 NPU die（davinci0 到 davinci7），即一张卡一个 die；A3 则是每个 NPU 两个 die，见同仓 Qwen3-30B-A3B 教程。
- **验证范围。** v0.23 文档写明性能只在 DeepSeek-V3.1/R1 上验证过；仓库的正确性用例用 Qwen3-30B-A3B-W8A8、两卡 TP2 加 EP、2 个副本位、间隔 100 和 20 步，比较开关前后 400 个 token 的贪心生成是否逐字相同。[C23] GLM-5.3-Flash 没有对应用例。
- **静态映射。** 三个版本的文档都写着静态摆法计划在 v0.25.1 移除，但加载映射文件的代码在四个钉住版本里都还在。[S38]

### 版本差异

MRV2 的硬件与格式边界已经明确：A2 不支持冗余专家；BF16/FP16、W8A8/Dynamic、W4A8 路径启用，W4A4 MXFP 与 W8A8 MXFP 限 950PR/950DT，W4A16、W4A16 MXFP、W4A8 MXFP 被拒绝。指南列出有模型级 NPU 回归的是 W8A8，其他 enabled 格式仍需目标模型验证。自动 HIXL 必须全组每个 rank 都有可用且类别一致的 binding，不能仅检查某一个 rank。

rc2 的平台补丁把上游 EPLB policy 默认从 default 改为 stair；MRV2 指南给出的默认还包括 window_size=1000、step_interval=3000、use_async=true、冗余专家数 0。自动 HIXL 选择要求全 EPLB 组的 binding 一致，否则全组回退 Gloo；回退时只把用户未显式设置的 STAIR 两个搬运限额收紧为 1。指南开头残留的 default policy 概述不能盖过实际补丁；启用 EPLB 与最终策略选择仍是两件事。

**v0.30.0rc2 的 MRV2 已接入 AscendEPLBController 和 STAIR。** 它继承上游控制器，按 parallel_config.enable_eplb 创建状态，结合上游 eplb_config.policy 与 Ascend stair 配置选策略。负载收集可按 all/prefill/decode 过滤，只要批里含 prefill 就归到 prefill；草稿模型没开 EPLB，也不会因目标模型开了而自动注册。旧 V1 dynamic_eplb 与 V2 的 enable-eplb 是两套入口，本文旧 600/50 配置不能当成所有 V2 默认；具体模型和副本硬件范围仍需核对相应版本指南。

| 项 | v0.23 维护分支 2c59ff10 与 GLM 快照 db701c1f | v0.26 rc 2ed6cbba | main baa023ad | 意味着什么 |
| --- | --- | --- | --- | --- |
| 有副本、没给映射文件且不混放共享专家时的起始摆法 | 先按编号连续切，再从最后一张卡往前逐张追加「下一个专家」作副本 | 按 vLLM 加载权重时的物理顺序排：全部逻辑专家之后接副本 0、1、2……，再按卡切段 [C18] | 同 v0.26 rc（来源 72） | 同一份配置冷启动时的摆法不同；给了相同映射文件才一致 |
| model runner v2 上的 EPLB | 开 `dynamic_eplb` 直接报错 | 同左 | 走上游 vLLM 的控制：`--enable-eplb` 加 `--eplb-config`，不能混用 v1 的环境变量和旧字段 [C20] | 两条路的开关名和配置位置都不同 |
| 强制均衡压测开关 | 没有 | 没有 | 有，和动态 EPLB 互斥 | 压测开关会改路由，均衡开关不改 |
| 文档：A2 能否配副本 | 没提 | 没提 | 写明 A2 不支持冗余专家 | 按 main，本部署只能换位置 |
| 文档：每 die 专家数 | ≤ 8 不建议 | ≤ 8 不建议 | > 8 不建议 | 前后相反，GLM 每卡 18 个落在哪边取决于看哪版 |
| 四项默认值（600、50、0、2） | 相同 | 相同 | 相同 | 调参口径一致 |

main 列中的 v2 接口读取上游 `parallel_config.enable_eplb`（来源 20），与旧动态字段是不同的控制入口。`baa023ad` 的互斥检查仅在 `enable_force_eplb` 与 `eplb_config.dynamic_eplb` 同时为真、`model_config` 存在且 `model_config.is_moe` 为真时抛错（来源 19）。表中对照的是固定提交的行为，不据此推断首次支持、修复或移除版本；实际部署命令还须满足相应执行器与硬件条件。

用 GLM 取 16 个副本位算一下起始摆法的差别 [D]：v0.23 式里，卡 k 放原来连续的 18 个专家，再加下一张卡的第一个专家（卡 15 加专家 0）；v0.26 rc 式把 304 个位置按「0 到 287，再接 0 到 15」的顺序每 19 个切一段，卡 0 放 0 到 18，卡 15 放 285 到 287 和 0 到 15。

**接入新模型时看哪些实际入口。** 设计文档提供了模块划分和校验示例，不宜把示例函数名当作现成 API：固定实现中，工具函数在 `eplb/core/eplb_utils.py`，MoE 层由 FusedMoE 构造时调用 `VllmEplbAdaptor.register_layer` 自动登记，校验则在 `EplbConfig`。设计文档的 `check_iterations`、`check_expert_map_path` 明确是示例。实际四版校验对两段间隔和冗余数都只拒绝负数，0 可以通过这一检查；这不证明间隔 0 能正常运行，也不宜把示例中的「大于 0」当作实际拒绝条件。来源 31–35、40–41、62 分别给出实际入口与设计说明。

### 源码位置

| 看什么 | 在哪 |
| --- | --- |
| 配置键、默认值、环境变量校验、启动日志 | `vllm_ascend/ascend_config.py`，`EplbConfig` |
| 起始摆法、第一张表 `expert_map`、整除检查 | `vllm_ascend/eplb/core/eplb_utils.py`，`generate_global_placement`、`init_eplb_config` |
| 第二张表 `log2phy` 与挑副本的规则 | 同上，`generate_log2phy_map` |
| 路由编号翻成物理号 | `vllm_ascend/ops/fused_moe/moe_comm_method.py`，用第二张表替换专家编号 |
| 每步累加配对数 | `vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py`，`moe_load` |
| 三段计数器 | `vllm_ascend/eplb/eplb_updator.py`，`EplbUpdator` |
| 后台规划进程、峰均比日志 | `vllm_ascend/eplb/core/eplb_worker.py`，`EplbProcess`、`_compute_imbalance` |
| 发送、接收与换表 | `vllm_ascend/eplb/core/eplb_device_transfer_loader.py`，`D2DExpertWeightLoader` |
| 接收区与各量化格式要搬的张量 | `vllm_ascend/eplb/adaptor/vllm_adaptor.py`，`VllmEplbAdaptor`、`EPLB_EXPERT_WEIGHT_NAMES` |
| 单独的通信组 | `vllm_ascend/distributed/parallel_state.py`，名为 `dynamic_eplb` 的组，成员同 MC2 组 |
| runner 里的接线、prefill/decode 门槛 | `vllm_ascend/worker/model_runner_v1.py` |

**两张表和进程间通道的源码名。** 第一张表叫 `expert_map`：下标是逻辑专家号，值是本卡第几格，不在本卡记 -1。第二张表叫 `log2phy`：下标是逻辑专家号，值是这张卡发出的 token 该去的物理号。后台规划进程和主进程之间是两条队列加一个共享字典：主进程往 `planner_q` 放一个信号唤醒后台；后台把全部层的结果放进 `block_update_q`（容量 1），主进程在规划段最后一步一次取回；共享字典里放汇总后的计数表 `moe_load` 和各层摆法 `expert_maps`。

**数配对的细节。** 算子交回的「每个专家收到几个 token」有两种形式：直接给个数，或给累加到每个专家为止的总数；后一种先相邻相减还原成个数，再加进这一层的计数。计数是每层一份、长度为本卡位置数的整数数组，只在当前步属于要数的那一类时才加。FlashLB（算法 3）例外：它要的是每一步的明细而不是总和，计数改成「数的步数 × 本卡位置数」的环形数组，每步写一行。

两张表的期望值可以拿仓库单元测试里那份 8 个专家、2 张卡、每卡 5 个位置的映射对一遍：卡 0 放 7、2、0、3、5，卡 1 放 6、1、4、7、2，物理位置 10 个，所以副本是专家 7 和 2 各一份。站在卡 1 上（测试不传 TP 大小，按卡号除以副本数取余挑副本），第一张表是 [-1, 1, 4, -1, 2, -1, 0, 3]，第二张表是 [2, 6, 9, 3, 7, 4, 5, 8]：专家 7 有物理 0 和 8 两份，卡 1 取 8；专家 0 只有一份，两张卡都指向物理 2。真实部署传入 TP 大小 8，挑副本改用「(卡在 TP 组里的序号 + 第几个 TP 组 + 专家编号) 除以副本数取余」，不一定挑到本卡那份。[C27]

**正文证据索引。** 数配对见 [C1]，路由编号翻成物理号见 [C12]，其余机制的出处见上面各条与源码位置表。GLM 的专家数、每卡 18 个与每个专家 24 MiB 取自部署页，场景 M 与纯 decode 的配对数取自 02 底稿 §8.6；冗余可取值、显存估算、一轮步数与 128 的门槛都是按上述代码条件推出的。[D]

**待核：缺以下材料。**

- 本部署的真实路由记录（逐层、逐专家、逐卡的配对数）：用来给出 GLM 的峰均比，判断 EPLB 值不值得开。
- 实际加载日志与逐层热度：确认部署符合上述旧 V1、PP=1、43 层的静态加载条件，并核对选中 AllGather/MC2 路径后的真实统计；不能只拿补齐后的逻辑预算代替。
- EPLB 与 W8A8、MTP 在 GLM-5.3-Flash 上的正确性与性能实测，以及 A2 上配副本的实际行为（main 文档说不支持，代码里没有对应的拦截）。

配对数量改善能否变成执行收益，取决于下一轮负载与迁移、同步的净开销；固定源码不提供 GLM-5.3-Flash 双机部署的实测加速幅度。

固定 db701c1f 的第一版执行器先初始化热度采集类型与阈值乘积，再按补齐后的 token 数分类；筛选依据是补齐后的数量，不是原始请求数。初始化与分类分别见来源 15、16，其他 runner 的路径需单独判断。

同一 GLM 快照的第二版执行器在 dynamic_eplb 为真时拒绝启动（来源 17）；权重适配层明确拒绝 W4A8MXFP，并按量化类型与是否启用 fused MC2 检查其他组合是否在支持表中（来源 8）。fused MC2 指专家计算与卡间通信的融合路径；权重名称表见来源 11，拒绝条件见来源 8。配置检查通过后，固定部署的 EPLB 正确性与性能仍需实测。

未加载已有映射时，db701c1f 才调用自动生成布局的路径并执行整除检查（来源 2）。正文中 6 个位置均分到 2 张卡满足这项算术条件；专家复制策略是否改善实际执行，还取决于负载与搬运开销。

- 来源 45、46：vllm-ascend@db701c1f，vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py，L234–L234、L521–L530。
- 来源 47：vllm-ascend@db701c1f，vllm_ascend/eplb/eplb_updator.py，L129–L143。
- 来源 48：vllm-ascend@baa023ad，vllm_ascend/ascend_config.py，L564–L570。

来源 23 的两卡 Qwen3 MoE 测试使用相同提示词 `What is deeplearning?` 和 `n=1`，比较首个候选的文本。它覆盖的是该测试设定，不能替代 GLM 双机的精度与性能验证。

补充证据对应：来源 60 为编号 0 的测试策略；61 为新旧日志共用估计函数的调用；62–67 与 21、31 串起主/草稿模型加载、MTP MoE 构造、自动登记及 warmup 时序；68–71 与 1、12 串起补齐输入、真实 token 掩码、dispatch 和热度计数。旧默认值见 9、33–35；main 非混放布局见 72；rc2 默认策略补丁的实际执行入口见 73；两张表的测试输入见 74；旧版 V2 拒绝分支见 75–76。上述静态链不提供 NPU 执行时间或 GLM 双机的正确性实测结果。
