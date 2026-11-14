---
id: large-scale-ep
title: Large-scale EP：请求分派、专家通信与 PD 分离怎样配合
type: feature
summary: >-
  大规模专家并行除了分配专家，还要组织请求入口、执行组和跨设备通信。本文依据固定源码摘录解释这些分工，以及 PD 分离和跳过 DP
  同步各自需要的条件；示例配置尚不能直接用于 GLM 双机。
aliases:
  - Large-Scale EP
  - 大规模专家并行
  - 大规模 EP
  - wide-EP
  - Distributed DP Server
  - 分布式 DP server
  - 外置 DP 负载均衡
  - external DP LB
  - data_parallel_external_lb
  - data-parallel-rank
  - large_scale_ep
  - VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED
  - load_balance_proxy_server_example
  - external_online_dp
chapters:
  - '14'
  - '18'
order: 80
sources:
  - >-
    raw:sha256-6397caeac11db38a85868db7a99eb6ff2e45b739f4d8f35c9115fd7402e20c73.md#L1-L959
verified: []
evidence: I
relations:
  - to: expert-parallel
    kind: builds-on
    note: 先理解输入如何发给专家、专家结果如何返回，再理解跨执行组的组织方式
  - to: data-parallel
    kind: builds-on
    note: 请求入口的负载均衡需要区分不同 DP 执行组及其请求状态
  - to: pd-disaggregation
    kind: builds-on
    note: 本文的 KV consumer 与分离部署条件需要结合 prefill、decode 之间的历史状态交接理解
contradicts: []
updated: '2026-10-29'
origin: gap
rawSources:
  - >-
    raw/sha256-6397caeac11db38a85868db7a99eb6ff2e45b739f4d8f35c9115fd7402e20c73.md
---

Large-scale EP 是把专家并行扩展到较大设备范围的部署场景：除了把专家放到不同设备，还需要安排请求交给哪个执行组，以及这些设备怎样协同计算。

本文依据归档材料中的文档与源码摘录说明这些机制。材料包含固定提交上的实现片段，但没有设备运行记录，也不足以完成三个在册分支的逐项验证。下文的工程行为限定于所注明的摘录，不把文档中的性能目标当作实测结果。

## 请求分派与专家并行分别在做什么？

MoE 用多个专家组织模型中的前馈计算。专家是对输入向量执行变换的模块；router 是为每个 token 选择专家的小网络。EP（expert parallel）把专家分配到多个设备，计算时把输入送到持有相应专家的设备，再把结果送回并组合。基础过程见 [Expert parallel](../concepts/expert-parallel.md)。

DP（data parallel）在这里涉及另一层分工：把不同请求分给不同执行组，各组维护相应请求的执行进度与历史状态。请求分派发生在服务组织层，专家分发发生在模型执行过程中，二者处理的对象不同。

因此，一个请求已经选定 DP 执行组，并不意味着它后续只在这个组的本地设备上计算；专家的实际分布还要看 EP 布局。反过来，扩大 EP 范围也没有自动回答“新请求交给哪个入口”这个问题。[I]

材料中的 Ascend 文档将 distributed DP server 用于大规模 EP 下的 PD 分离。它表达的是一种部署组织方式和性能目标，没有给出足以量化收益的测试结果。

## 为什么还要区分外置分派与 Hybrid LB？

外置负载均衡让上游服务承担请求分派。材料中 vLLM 的 external DP LB 配置注释把这种模式限定于在线服务，并用于 MoE 部署；显式指定 DP rank 时，会隐式启用该模式。

rank 是分布式成员的编号，编号必须结合所属通信组或执行组理解。在这里，指定 DP rank 是明确当前服务对应哪个 DP 成员，不是为每个请求选择专家。

Hybrid load balancing 则保留节点内的分派：每台机器运行自己的 API server，只向同机的 DP engine 排队；上游负载均衡器把用户请求分给各机器的服务端点。API server 接收服务请求，engine 执行引擎工作，两者的职责可结合[引擎进程](../concepts/engine-processes.md)理解。

这两种方式改变的是分派职责放在哪里：

| 方式 | 上游负责什么 | 节点内负责什么 |
| --- | --- | --- |
| External DP LB | 承担外部请求分派 | 按指定的 DP 成员组织服务 |
| Hybrid LB | 选择节点端点 | API server 在同机 DP engines 之间排队 |

摘录没有完整展开 internal LB 的实现，也没有提供各方案在相同负载下的对比结果，因而不能据此推荐一种方式普遍优于另一种。

## 一个小例子怎样看清代理的选择依据？

材料给出一个 Ascend 示例代理的优先级函数：prefill 端使用 active_tokens 加上 active_kv_cache 的 0.3 倍；decode 端只使用 active_tokens。这里的两个名字是代理记录的状态字段，摘录没有完整给出它们的统计口径和更新时机。

设两个正常、未被标记为 tainted 的后端具有以下状态。数字仅用于演示函数计算，不对应真实请求长度或显存占用。[A]

| 后端 | active_tokens | active_kv_cache |
| --- | --- | --- |
| A | 10 | 20 |
| B | 14 | 0 |

prefill 端计算 A 的分数时，先取 20 乘以 0.3，得到 6，再加上 10，得到 16；B 得到 14。decode 端不加入缓存项，A、B 分别得到 10 和 14。[D]

这个例子显示，同一组状态在两个角色下会得到不同的分数顺序。仅凭这一段函数还不能确定最终请求去向：仍需核对调用方如何比较分数、何时刷新状态，以及如何处理 tainted 后端。

tainted 是代理维护的一种特殊标记；函数遇到带此标记的条目时，直接返回专用优先级。材料没有给出足以解释其完整生命周期的代码。该函数也只属于所示代理，不能据此把所有 DP 负载均衡都称为 KV 感知策略。

## PD 分离增加了哪一层协作？

prefill 处理提示词中尚未计算的位置并建立历史状态；decode 在已有历史上继续生成输出。PD 分离把这两类工作放到不同执行组，通过历史状态传输衔接，详见 [PD 分离](../concepts/pd-disaggregation.md)。

它改变的是执行阶段的部署位置，EP 改变的是专家的设备分布。材料中的文档把二者组合使用，但这种组合本身不足以证明 PD 分离是所有 EP 部署的必要条件。[I]

材料给出的网络前提是：物理机器处于可连通的同一局域网，且所有 NPU 互联。NPU 是软件可见的计算设备。文档区分了两代硬件的链路安排：

| 文档中的硬件代际 | 节点内互联 | 节点间互联 |
| --- | --- | --- |
| Atlas A2 | HCCS | RDMA |
| Atlas A3 | HCCS | HCCS |

HCCS 是这里采用的设备互联方式；RDMA 是允许网络直接访问已注册内存的数据传输机制。链路连通只是部署前提，不能替代对带宽、并发通信及端到端时延的验证。

材料还包含一个 prefill、decode 分别配置的示例表。原文明确要求按实际场景调整，未把它称为优化后的通用配置；因此不能把该表直接当作其他模型或请求分布的推荐值。

## EP 规模变大，为什么仍可能不选 MC2？

MC2 是把矩阵计算与通信协同执行的一类昇腾实现。它关系到专家计算如何与数据交换配合，并不等于“使用 EP”这个配置本身。

材料中的 Atlas A2 选择函数先计算每设备专家数，再检查三个条件：每设备专家数不超过 24，EP 通信组至少有 16 个成员，本次 token 数不超过 MC2 容量。三个条件同时成立才返回 MC2，否则返回 ALLGATHER。

All-Gather 是收集各成员分片、使每个成员获得完整集合的通信操作；这里的 ALLGATHER 是源码中的通信路径枚举。具体怎样组织专家计算，还需要继续读取对应实现。

例如，只满足“EP 通信组足够大”，但本次 token 数超过容量，仍会走回退路径。增加设备数不能单独保证选中 MC2；专家分布和当前执行规模也参与选择。

## 跳过 DP 同步，究竟跳过了什么？

All-Reduce 是对通信组成员的对应元素执行归约，并让每个成员取得结果的操作。这里讨论的是源码中控制“是否跳过跨 DP 组 All-Reduce”的判断，不是删除所有设备间通信。

材料展示了一个与执行模式相关的变化：

- 不跳过时，代码注释说明各 rank 的 token 数保持一致，使用 global_bs 为 0 的统一模式，并传入 mc2_mask。
- 跳过时，各 rank 的 token 数可以不同，使用真实 global_bs，并且不传 mc2_mask。

global_bs 是这里传递执行规模信息的字段；mc2_mask 是对应调用使用的掩码参数。仅从摘录不能进一步确定它们的完整形状和编码方式。

这说明跳过同步会改变后续通信调用的输入约定。不能只移除一个同步操作，却继续沿用原来的规模信息与掩码。

对 MoE 路径，摘录给出的判断顺序是：先排除分层通信，再要求当前 rank 是 KV consumer，随后检查 decode 与 prefill 所需的通信方式。KV consumer 是接收历史状态的一侧。只有 decode 必须使用 MC2，且“prefill 也必须使用 MC2”或“启用重计算调度”至少满足一个，最终条件才成立。

## 这些结论怎样接到 GLM 双机主线？

本站贯穿模型是 GLM-5.3-Flash，固定部署见[我们的双机部署](../concepts/glm-5-3-flash-two-node.md)。理解本页时，可以沿[多请求执行](../concepts/concurrent-requests.md)继续追问：请求在哪个执行组排队，当前批次如何形成，专家通信路径又如何选择。

本次材料没有给出足以把这些判断逐项代入 GLM 固定部署的完整配置与调用上下文。它包含的 DeepSeek、Atlas A3 示例也不能通过替换模型名变成 GLM 算例。

因此，这里尚不能确定 GLM 双机是否采用所示外置代理、具体批次必选哪条通信路径，以及是否满足跳过 DP 同步的全部条件。需要补充固定部署入口、实际配置和调用参数后，才能把本页规则接到具体请求上。

## 哪些结论需要分开理解？

**外部负载均衡与 external DP mode 的支持范围不同。** 材料中的非 MoE 限制针对 vLLM 的 external DP mode；错误提示给出的替代方案，就是启动不带 DP 参数的独立 vLLM 实例，再由外部进行负载均衡。

**选择 MC2 与获得性能收益不同。** 选择函数证明代码进入哪条路径，性能还受实际形状、网络和运行负载影响。材料没有提供对应收益的实测数值。

**跳过 DP 同步与关闭专家通信不同。** 前者改变特定跨 DP 归约和后续调用约定，不能据此推断 dispatch、combine 或其他通信也被省去。

**文档推荐版本与支持边界不同。** “推荐在 v0.9.1 正式版使用”是材料保留的推荐文字，不能单独用来判断功能首次引入、最后支持或其他分支是否可用。

## 对照源码

### 怎么开

材料中的 distributed DP server 文档要求在所有节点执行所示 Python 文件，但本次摘录不足以还原完整启动命令、环境和参数，不能据此拼接一份可直接运行的部署指南。

vLLM 控制侧摘录说明，显式提供 `--data-parallel-rank` 会隐式启用 external DP LB。其配置注释限定于在线服务和 MoE 部署。Hybrid LB 的入口职责则不同，不能把两者当作同一开关的别名。

分层通信的判断函数还接受以下任一条件：

- 环境变量 HCCL_INTRA_ROCE_ENABLE 的值为字符串 0，同时 HCCL_INTRA_PCIE_ENABLE 的值为字符串 1。
- Ascend 配置中的 enable_mc2_hierarchy_comm 开启。

这个判断直接影响后续是否允许跳过跨 DP 同步。

### 会报什么错

材料中 vLLM main 开发主线的固定摘录，在 DP size 大于 1、启用 external LB 且模型不是 MoE 时抛出：

> Non-MoE models do not support external data parallel mode. For external load balancing, launch independent vLLM instances without --data-parallel-* arguments.

同一快照的另一段校验明确要求故障容错使用 external LB：

> Fault tolerance requires external load balancer mode (--data-parallel-external-lb or --data-parallel-rank). Internal LB mode is not supported.

第二条说明该快照对故障容错模式的入口要求，不代表仅开启 external LB 就已满足容错的全部条件。

### 开销和什么时候别开

外置分派增加了一个需要维护后端状态的服务层。材料中的示例代理会读取执行量与缓存相关字段；要判断这些指标能否改善实际分派，需要连同状态更新和请求选择逻辑一起验证。[I]

PD 分离需要不同执行阶段交接历史状态。当前材料不足以给出网络成本和计算收益的定量比较，也不能提供通用的拆分门槛。

跳过跨 DP 同步应遵循完整谓词。MoE 路径中，仅启用重计算调度、仅处于 decode 阶段，或者仅使用较大的 EP 组，都不足以单独满足条件。

材料中的 FAQ 建议在性能测试前使用请求预热，因为部分 NPU 算子需要多轮预热才能达到最佳性能。摘录没有固定预热次数，也没有给出收益幅度。

### 版本差异

本次没有登记任何已完成逐项核对的分支，frontmatter 的 verified 保持为空。

| 版本或快照 | 本次材料支持的说明 |
| --- | --- |
| v0.23 维护分支 | 未取得足以独立核对本页全部行为的分支证据；不能把 GLM 执行侧快照等同于该分支 |
| v0.26 分支 | 材料提及其配套 vLLM 快照使用 assert 表达相关 rank、local-size 约束；缺少完整片段与快照日期，不能补全行为对照 |
| main 开发主线 | 固定 vLLM 摘录包含非 MoE external DP mode 和故障容错入口校验；不代表当前浮动 main 的行为 |
| GLM 教学所用固定执行侧快照 | 提供了 A2 通信选择、跳过跨 DP 同步及相关调用约定的片段；尚未证明具体 GLM 请求满足其条件 |

材料提及的 vLLM 与 vllm-ascend 提交不能仅因同时出现在摘录中，就被认定为已经验证的兼容组合。[!]

### 源码位置

以下位置均指本页唯一归档材料中的原文行号。它们帮助定位摘录，不代表本次重新打开并核对了上游仓库。

| 材料行号 | 核对内容 |
| --- | --- |
| 7–13 | prefill、decode 示例配置及按场景调整的说明 |
| 17–22 | Ascend 示例代理的优先级计算 |
| 105–110 | external DP LB 的配置注释与适用范围 |
| 215–218 | A2 的 MC2／ALLGATHER 选择条件 |
| 252 | 大规模 EP 下 PD 分离与 distributed DP server 的文档声明 |
| 294 | Hybrid LB 的职责划分 |
| 343–350 | 网络前提与所有节点运行服务的要求 |
| 704–716 | 分层通信、dense 分支与 MoE KV consumer 前置条件 |
| 745–749 | global_bs 与 mc2_mask 的模式差异 |
| 755–768 | 故障容错入口与非 MoE external DP mode 校验 |
| 827–830 | 分层通信启用条件 |
| 903 | 性能测试前预热建议 |
| 957–959 | 跳过跨 DP 同步的最终布尔条件 |

待核：补齐三个在册分支的固定源码、快照日期及完整调用上下文；核对 MC2 与 FUSED_MC2 的判定范围、token 数的统计口径、代理状态的更新和选择逻辑；再将实际配置代入 GLM 双机主线。当前材料没有提供部署运行与性能验证结果。
