---
id: short-request-first
legacyAnchors:
  放到-glm-双机钉住的代码里没有它: 复杂异构实战对照：GLM 双机场景推演与版本边界
title: 短请求优先：等待顺序与长请求公平性
type: feature
summary: >-
  等待的新请求按提示词长短分进短、长两条车道，每步用剩余预算接纳新请求时先取短的；被抢占或算过一部分的请求排在最前，长请求达到等待门槛可提升候选优先级，但不保证时限。它只改从哪条队里拿下一个，不改预算和切分；本部署钉住的代码里没有它，v0.26
  起才有。
aliases:
  - ShortRequestFirst
  - 短请求优先
  - short_request_first_config
  - long_max_wait_ms
  - ShortRequestFirstAsyncScheduler
chapters:
  - '12'
order: 30
sources:
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L148-L183
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L329-L367
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L237-L255
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L939-L965'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L680'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L370-L384
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L198-L235
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L37-L108
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L127-L135
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L931-L936
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L665-L680'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1962-L1978'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1212-L1233'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L896-L905'
  - 'vllm@0fc695fc:vllm/v1/core/sched/request_queue.py#L13-L17'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L954-L983'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1341-L1360'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L91-L103'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L1-L30
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L41-L70
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L71-L107
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/short_request_first.md#L103-L107
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1003-L1026'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L700-L716'
  - >-
    raw:sha256-cd6d5be072a4baf52bfbdc4376dee148bcc45394d401fb1a45e4e6823f58196f.md#L1-L653
  - >-
    vllm-ascend@7d825229:vllm_ascend/core/short_request_first_scheduler.py#L148-L183
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1048-L1075'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1377-L1383'
  - 'vllm-ascend@7d825229:vllm_ascend/core/scheduler_profiling_chunk.py#L94-L106'
  - >-
    vllm-ascend@7d825229:vllm_ascend/core/scheduler_profiling_chunk.py#L1257-L1269
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L175-L186'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L202-L205'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L232-L240'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/short_request_first_scheduler.py#L148-L183'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1049-L1085'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1557-L1575'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/scheduler_profiling_chunk.py#L94-L106'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/short_request_first_scheduler.py#L329-L380'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1234-L1259'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1758-L1771'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 每步先续 running、余量再接 waiting；短请求优先只改后半段从哪条队里拿
  - to: chunked-prefill
    kind: builds-on
    note: 选中之后这一步给它算多少由分块决定；例子里 B 只算 4 个就靠它
  - to: concurrent-requests
    kind: builds-on
    note: 场景 M 和 20,000 token 提示词分三步的整批账在那一页；本页只加一条短请求看它排到哪一步
  - to: async-scheduling
    kind: builds-on
    note: 开异步调度时换成 ShortRequestFirstAsyncScheduler 这条安装路径
  - to: balance-scheduling
    kind: builds-on
    note: 同步路径上装队列的是均衡调度补丁换进来的 BalanceScheduler，与均衡开关无关
  - to: batch-job-aware-scheduler
    kind: alternative-to
    note: 另一种改等待顺序的策略，两者不能同开
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-cd6d5be072a4baf52bfbdc4376dee148bcc45394d401fb1a45e4e6823f58196f.md
  - >-
    raw/sha256-f65363a7b05ee61f3c551df2849c212485f2ca4291fc72275ba38a4c7ffbbe23.md
---

## 短请求排在长请求后面，只能干等吗？

先认识两个词。**调度器**在每一步开头决定：这一步给哪些请求各算几个位置。它手里有一份 **token 预算**，也就是一步最多算多少个位置。调度器先给已经在算的请求（running）续上，剩下的预算再分给已经到达、还没开算的请求（waiting），见[调度器](vllm-scheduler.md)。一条新请求第一次被排上时，要先把整段提示词算一遍，这叫 prefill；提示词越长，占的预算越多。

**short request first（短请求优先）是 `vllm-ascend` 从 `v0.26` 起提供的一种等待队列。** 还没开算的新请求按提示词 token 数分进「短」「长」两条车道，调度器用剩余预算接纳新请求时先从短车道拿，短车道空了才轮到长车道。被抢占过（KV 块不够时从 running 踢回等待队列）或已算过一部分的请求另排一条恢复车道，永远最先被拿。它只改「下一个接纳谁」；每一步的预算、提示词怎样切段、KV 块怎样分，都照原样。

用示意数感受一下。假设每一步最多算 16 个位置，这时没有在算的请求；等待队列里按到达先后排着 A、B、C、D。A、B 是长提示词，各 8 个 token；C、D 是短提示词，各 2 个。「短」的门槛设成 2 个 token。

```wiki-diagram
file: short-request-first
```

- **先到先服务。** 按到达先后取，A、B 正好把第 1 步的 16 个位置占满。C、D 加起来只要 4 个位置，也得等到第 2 步。
- **短请求优先。** 先把 C、D 分进短车道，A、B 分进长车道。第 1 步先取短车道，C、D 用掉 4 个位置；再取长车道，A 用掉 8 个，还剩 4 个给 B，B 这一步只算前 4 个 token。
- **第 2 步。** 第 1 步算完提示词的请求，第 2 步起逐个生成回答，每条每步只占 1 个位置（图里的灰格）。短请求优先这边，B 在第 2 步算完剩下的 4 个 token。
- **结果。** C、D 的第一个输出 token 从第 2 步提前到第 1 步，A 不受影响，B 的提示词晚一步算完。两种取法第 1 步都用满 16 个位置；第 2 步先到先服务用 1+1+2+2=6 个，短请求优先用 1+1+1+4=7 个。预算上限相同，实际工作量会因哪些请求已转入 decode 而不同。

B 能只算一半、下一步接着算，靠的是 [chunked prefill（分块预填充）](chunked-prefill.md)：提示词装不下这一步的余量时，先算能装下的那一段。短请求优先决定先选谁，分块决定选中以后这一步给它算多少，两件事各管各的。

## 为什么需要它：长提示词挡在前面，短请求白等

先到先服务的等待队列只有一个出口，谁在队头谁先拿预算。一条长提示词排在前面，会把一步甚至几步的余量吃掉；排在它后面的短请求只差几个位置，也只能陪着等。这种「队头一个大的，把后面一串小的全堵住」的现象叫**队头阻塞**（head-of-line blocking）。

在线服务里，短问题往往占大多数，用户最直接感受到的是 **TTFT**（time to first token：从请求到达到拿到第一个输出 token 的时间）。官方文档给这个特性的定位就是：提示词长短差别很大、少数长请求会拖慢大量短请求、而短请求的 TTFT 比严格的先来后到更重要的场景。

把上面四条请求拿到第一个输出 token 的步数加起来（示意）：

$$\bar{S}_{\text{FCFS}} = \frac{1 + 1 + 2 + 2}{4} = 1.5\text{ 步}, \qquad \bar{S}_{\text{SRF}} = \frac{1 + 2 + 1 + 1}{4} = 1.25\text{ 步}$$

| 调度策略（A、B 各 8 token；C、D 各 2 token 示意） | 各条首次出字步数（A, B, C, D） | 合计步数 | 每条平均步数 | 变化说明 |
| --- | --- | --- | --- | --- |
| **先到先服务（FCFS）** | $1,\; 1,\; 2,\; 2$ | **6 步** | **1.5 步** | C、D 被长请求挡到第 2 步 |
| **短请求优先（SRF）** | $1,\; 2,\; 1,\; 1$ | **5 步** | **1.25 步** | C、D 各早 1 步，B 晚 1 步 |

平均值下降，是因为短的排到前面以后，被一条长提示词挡住的请求变少了：B 多等的 1 步，换来了 C、D 各少等 1 步。排队论里「先做短的，平均等待最短」说的是同一件事。

代价也在这张账里：**它不多造一个位置，只是把等待从短请求挪给长请求。** 具体有四处。

- **没有启用等待提升时，持续到来的短请求可能使长请求一直等待。** 恢复车道取空后，默认先取短车道，余量才轮到长车道。设置正的等待门槛可以让等够的长队头排到短请求前面，但改变的只是候选顺序；预算和缓存块不够时仍排不上，所以不是端到端等待上限。长请求被提升得越频繁，短请求的收益也越小。看过队头但还没取走时，会沿用已记住的候选，后文再解释这一步。
- **提示词短不等于活少。** 请求到达时只知道提示词有多长，不知道回答会生成多长。一条很短的问题可能生成一篇长回答，之后每一步都要占位置。所以它改善的是「提示词排队」这一段，和预先知道整件活多长的「最短作业优先」不是一回事。
- **余量够用时它什么也不改。** 把例子里每步预算换成 20，A、B、C、D 一步全装得下，按什么顺序拿结果都一样。只有等着的请求一步排不完时（预算、请求数上限或空闲 KV 块不够），先排谁才有意义。
- **看平均会看漏。** 评估要把长、短请求分开，各看等待时间的分布、TTFT、最长等了多久、抢占了几次。只看平均 TTFT，会看不见长请求的尾部等待。

## 怎么排：三条车道，按固定次序取

**先判断请求是否属于恢复类；不属于恢复类的请求，再按提示词的 token 数分进短车道或长车道。** 因此，提示词很长但已有计算进度的恢复类请求，也会进入恢复车道。普通新请求中，提示词长度不超过门槛（配置项 `threshold`，默认 256）的进短车道，超过的进长车道。它不看回答会有多长（还没生成，不知道），也不看谁更重要。每条车道内部仍是一条普通的先到先服务队列：同一条车道里，先到的先取。例子里门槛是 2，所以 C、D 进短车道，A、B 进长车道，A 仍排在 B 前面。

先用一张总览图把「解开队头阻塞」「四级挑选顺序」与「三条工程护栏」合在一起看，再拆每条规则的细节：

```wiki-diagram
file: short-request-first-fig-hol-unblock
```

**第三条是恢复车道，永远最先取。** 三种请求进这里：被抢占过的、已经算过一部分的、已经输出过 token 的。抢占是指 KV 块不够时，调度器把 running 里的一条请求踢回等待队列，腾出它占的块；被踢回来的请求重新进队时会重新分车道，因为状态是「被抢占」，落进恢复车道。单设这条车道，是因为这些请求已经花过算力，有的已经给用户吐过字；要是按提示词长短重新排，一条被抢占的长请求会落进长车道，每来一批短请求就被压下去一次，抢占和短请求优先叠在一起，反复折腾同一条请求。反过来，恢复车道里只要有请求，新来的请求不论长短都得排在它们后面。

所以默认的取法是：**恢复 → 短 → 长**。

**长车道可以设一个提升候选优先级的等待门槛。** 配置项 `long_max_wait_ms`，单位毫秒。长车道的队头从进长车道起等够了这么久，而且短车道里正有人，它就排到短车道前面，次序变成：恢复 → 等够了的长 → 短 → 长。只看长车道的队头，后面的长请求照旧排队；短车道空着时本来就轮到长车道，不算插队。等够了只是让队头有资格插队，被选中后照样要过预算和 KV 块这两关，所以它不保证长请求在多少毫秒内拿到第一个 token。默认值 0 表示不启用，也就是严格短优先。

$$t_{\text{wait}} = t_{\text{sched}} - t_{\text{enqueue}}, \qquad \text{触发老化插队} \iff t_{\text{wait}} \ge \text{long\_max\_wait\_ms}$$

| 调度检查时刻（示意：`long_max_wait_ms = 2,000 ms`，A 于 `1,000 ms` 进长车道） | 已等待时长 $t_{\text{sched}} - t_{\text{enqueue}}$ | 与门槛比较及判定 |
| --- | --- | --- |
| 第一次看（`2,400 ms`） | $2{,}400 - 1{,}000 = \mathbf{1{,}400\text{ ms}}$ | $< 2{,}000\text{ ms}$，不够，照常先取短车道 |
| 700 ms 后再看（`3,100 ms`） | $3{,}100 - 1{,}000 = \mathbf{2{,}100\text{ ms}}$ | $\ge 2{,}000\text{ ms}$，够了，短车道有人也先取 A |

插队太频繁，就说明按 token 数划短请求的长度门槛，或按毫秒计的等待门槛没配好：连续 3 次让等够了的长请求插到正在等的短请求前面，日志里打一次警告，提示这个特性正在退化成「长请求优先」，建议调大长度门槛或者关掉。**它只是提醒，不会自己改配置。** 取走一条短请求，或者长请求出队时短车道本来就空，连续计数清零。另外，队列有进出时最多每 5 秒打一行统计日志：三条车道各有多少条、各取走了多少、老化插队了几次。

最后一个细节保证「看的和拿的是同一条」。调度器接纳一条等待请求要分两下：先看一眼队头，决定能不能排；排得下，再真正取走。这两下之间，「等够了没有」可能正好翻过去，选出来的车道就变了。所以短请求优先在看的时候记住是哪条车道，取的时候从同一条车道拿。

整个过程放回调度器的一步里是这样的：

```wiki-diagram
file: short-request-first-flow
```

图最上面和最下面都是上游调度器原本的流程：先续 running，再在预算和请求数上限之内接纳等待的请求；截预算、借 KV 块、借不到就停，一样都没改。短请求优先实现了上游等待队列规定的几个动作（入队、看队头、取走、插回队头），把原来那一条先到先服务的队列整个换掉，所以调度循环不用改一行。

## 细节：它管不到什么，长度门槛和等待门槛怎么定

**它只排等待的请求，管不到已经在算的。** 调度器每一步先续 running，再看等待队列。一条长提示词只要被接纳过一次（哪怕只算了一段），之后每一步它都在 running 里，先于所有等待的请求拿预算，短请求优先对它没有发言权；正在逐个生成回答的请求也一样不受影响。要限制一条请求一步最多拿多少，得靠 chunked prefill 的单条上限（默认不设），见[切点、单条上限和关掉分块](chunked-prefill.md#细节切点单条上限和关掉分块)。

**关掉分块时，余量装不下的长请求整条排不进。** 例子里如果关掉 chunked prefill，第 1 步取完 C、D、A 还剩 4 个位置，B 要 8 个装不下；调度器不会切开它，而是这一步直接停止接纳新请求，B 等到下一步。

**还有两道闸门排在三条车道之外。** 一是被挂起的请求：等别的机器把 KV cache 传过来的、等输出格式规则（structured output 的语法）准备好的，另排在一条挂起队列里；调度器每次先看这条队，再看三条车道。二是 running 的条数上限：running 已满时，恢复车道里的请求也进不来。

**混合模型按块对齐切分时，长请求更容易卡住。** 有线性注意力层的混合模型，在按块对齐的缓存模式下，提示词每一段的终点要向下取整到块大小的整数倍；取整后得 0 的请求，这一步排不进，调度器也就不再往下看等待队列。按这条规则推断，短请求优先让短请求先占掉一部分余量，长请求会更常碰上取整得 0（具体切点边界见 [chunked prefill](chunked-prefill.md)）。

**门槛怎么定。** 门槛太低，大多数请求落进长车道；太高，大多数落进短车道，两种情况分车道都失去意义。官方文档的建议是把门槛放在「短请求主簇」和「长请求长尾」之间的空档上，不取全体长度的中点，也不贴着最长的那些请求；还没有细致的流量模型时，先取提示词长度的 70～85 百分位起步，再照真实的长度直方图调。

**等待门槛怎么定。** 官方文档把它定位成公平性闸门，不是提吞吐的旋钮，并建议先调门槛。做法是：先用 0（严格短优先）跑一段，量长请求等待时间的尾部，记作「正常尾部」（取 90 或 95 百分位）；再定服务能容忍长请求额外排多久，记作「容忍上限」；等待门槛取在两者之间。更看重短请求 TTFT 就靠近容忍上限，更看重长请求公平就靠近正常尾部。不要拿短请求的平均 TTFT 去定它。如果老化插队反复发生，先调大门槛。

## 复杂异构实战对照：GLM 双机场景推演与版本边界

前半段规则适用于 `v0.26` 及 `v0.30.0` 标准主基线模型（如 `Qwen3-8B` / `Qwen3-30B-A3B`，按 `threshold` 直接拆分短/长车道）。下面单独对照历史 **[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)**（例外 B，钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`）：**这份镜像代码里没有短请求优先，不是关着，而是根本没有这个特性（该双机也未开启按块对齐切分）。** 本部署的等待队列就是上游 FCFS 队列：平台补丁换进来的调度器在均衡开关关着时直接走上游逻辑（见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)）。短请求优先从 `v0.26` 分支才出现，而那个分支没有 GLM 模型代码；`v0.30.0` 与 `main` 两样都有，但尚无两者同开的实跑记录。因此本节只按调度规则推演「换上它后排队步数怎么变」，不含毫秒实测。

**它能动的，只有每个 DP 组每一步的余量。** 本部署分两个 DP 组，各有一个调度器、每步 8,192 个位置预算、最多 32 条 running。每条正在生成的请求一步占 4 个位置（1 个已定 token + 3 个 MTP 草稿）。已有 running 全在 decode 时，先按每条 4 个扣，余量才给等待队列；仍在 prefill 的 running 按实际未算量扣（见[已有请求都在 decode 时的余量](vllm-scheduler.md#多条请求时已有请求都在-decode余量怎样给新提示词)）。短请求优先只决定这份余量先给谁，不跨 DP 组搬移请求。

**按默认门槛 256 分车道。** [R1](one-request.md)（提示词 4 token）进短车道；[场景 M](concurrent-requests.md#示例场景-m-与变体-m)（DP0 有 12 条 decode，新到 1 条 6,000 token 请求）的新请求进长车道。场景 M 一步只来这一条新请求，没有竞争对手，因此换上短请求优先每一步位置都不变。

要让顺序起作用，得有长、短请求同时在等。借用场景 M 的一个变体：DP0 仍是 12 条 decode（占 $12 \times 4 = 48$ 个位置），新请求换成 20,000 token 提示词（三步账见[提示词超过剩余预算时，分几步算](concurrent-requests.md#提示词超过剩余预算时分几步算)）。现在让一条 4 token 短请求紧跟着到达，两条在第 1 步前同时进等待队列（每步预算 8,192，按调度规则推演）：

```wiki-diagram
file: short-request-first-fig-glm-3step
```

$$T_{\text{SRF},1} = 48 + 4 + \min(20{,}000,\; 8{,}192 - 52) = 8{,}192, \qquad T_{\text{SRF},3} = 52 + 3{,}720 = 3{,}772$$

| 步数 | 先到先服务（FCFS）占位组成 | 短请求优先（SRF）占位组成 |
| --- | --- | --- |
| **第 1 步** | $48 + 8{,}144 = \mathbf{8{,}192}$（长提示词占满余量） | $48 + 4 + 8{,}140 = \mathbf{8{,}192}$（**短请求本步末首字出字**） |
| **第 2 步** | $48 + 8{,}144 = \mathbf{8{,}192}$（长提示词已在 running 先拿） | $52 + 8{,}140 = \mathbf{8{,}192}$（13 条 decode 占 52，长提示词再算 8,140） |
| **第 3 步** | $48 + 3{,}712 + 4 = \mathbf{3{,}764}$（**短请求第 3 步末才首字出字**） | $52 + 3{,}720 = \mathbf{3{,}772}$（长提示词照样第 3 步算完） |

短请求提前了两步，长提示词一步没晚：它每步只让出 4 个位置，最后一段 3,720 个仍在第 3 步装得下；12 条正在生成的请求两种情况下都每步照常前进。这两步全是在第 1 步赢来的。先到先服务时短请求多等了第 2 步，原因正是上一节说的那一条：长提示词一旦进了 running，之后每一步都先于等待队列拿预算。

步数不等于毫秒。短请求优先下，短请求的第 1 步是一个 8,192 个位置的大混合步，它和长提示词的第一段在同一步里算、同一时刻拿结果，所以它的 TTFT 仍然是这一整步的时长，而不是只算 4 个位置那么快。

真要在这套部署上用，还要注意三件事：

- **抢占在这里很贵。** 本部署没开 prefix caching，被抢占的请求要从头重算（见[调度器](vllm-scheduler.md#多条请求时已有请求都在-decode余量怎样给新提示词)）。恢复车道让它排在新来的短请求前面，不会被反复压下去；但抢占本身的代价不变。
- **GLM 能不能和它一起跑没有核过。** GLM 的线性注意力层要跨段延续状态、每步带 MTP 草稿；开发主线上两者同开有没有额外限制，要看同一版本的实现和测试。
- **它会走异步调度那条安装路径。** 本部署没写异步调度的开关，按启动时的自动判定是开着的，见[异步调度 · 落到 GLM 双机](async-scheduling.md#落到-glm-双机r1-每一步的占位账)。换上短请求优先时，平台层会把调度器换成它专门的异步子类，构造完再装三车道队列。也因为开着异步调度，它不能和 profiling chunk 同开：v0.26 一律不行，main 只放开了同步调度。

## 常见误解

- **「它是一个新的调度器」**——它换的只是等待队列这一个对象。调度循环、预算、切段、借块的规则一行没改；同步调度时装它的仍是原来那个调度器，异步调度时的专用子类也只是在构造完以后把队列换掉。
- **「开了它，长请求就不会被饿着」**——默认关闭等待提升，就是严格短优先，短请求不断时长请求可以一直等。设置正的等待门槛后，达到门槛的长车道队头可以优先于短车道被选择，但恢复车道仍然优先，也不保证请求立即取得计算资源；这个门槛不是端到端等待上限。插得太频繁也只打一次警告。
- **「短请求优先 = 短请求能插到正在生成的请求前面」**——它只重排还在等的请求。每一步先续 running，正在生成回答、正在分段算提示词的请求都不受影响。
- **「它就是最短作业优先」**——它只看提示词长度，看不到回答会生成多长。提示词短的请求，整件活不一定短。
- **「门槛取提示词长度的中位数最稳」**——官方文档明确不取全体长度的中点，也不贴着最长的请求，而是找短请求主簇和长尾之间的空档；70～85 百分位只是没有流量模型时的起点。
- **「被抢占的长请求会被分回长车道」**——被抢占的请求重新进队时状态是「被抢占」，落进恢复车道，排在所有新请求前面。
- **「本部署把它关着」**——本部署钉住的代码里没有这个特性，要用得换到 v0.26 分支或开发主线，而 v0.26 分支还没有 GLM 的模型代码。

## 对照源码

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；GLM 双机绑定部署另钉 `db701c1f` + `0fc695fc`。

### 怎么开

- **一段配置。** 官方示例把它写在 `additional_config.scheduler_config.short_request_first_config` 下 [S20]：`--additional-config '{"scheduler_config": {"short_request_first_config": {"enabled": true, "threshold": 256, "long_max_wait_ms": 2000}}}'`。直接写在 `additional_config` 顶层也认，但会打一条弃用警告。
- **三个键与默认值**：`enabled` 默认 `False`，不写就不启用；`threshold` 默认 `256`，按 `num_prompt_tokens <= threshold` 分进短车道；`long_max_wait_ms` 默认 `0.0`，`_long_head_wait_ms` 第一句遇到 `<= 0` 就返回空，永不老化 [C4][C1]。
- **只换 `scheduler.waiting` 这一个对象。** 上游在 `Scheduler.__init__` 里用 `create_request_queue(self.policy)` 造等待队列，扫等待队列的循环通过队列接口取请求 [C11]。`ShortRequestFirstRequestQueue` 直接实现上游 `RequestQueue` 的契约，里面是三条用同一个工厂造出来的普通队列；`install_short_request_first_waiting_queue` 把它装到 `scheduler.waiting` 上，恢复车道的判据 `is_recovery_request` 是 `status == PREEMPTED`、`num_computed_tokens > 0`、`num_output_tokens > 0` 三者之一 [C2]。
- **两条安装路径，看开没开异步调度（本部署按自动判定开着，见[异步调度](async-scheduling.md)）。** 异步：平台层把 `scheduler_cls` 指到 `ShortRequestFirstAsyncScheduler`，它是上游 `AsyncScheduler` 的子类，`__init__` 末尾换队列 [C6]。同步：`scheduler_cls` 不用写；`patch_balance_schedule.py` 在导入时把上游 `Scheduler` 整个换成 `BalanceScheduler`，它的 `__init__` 读到 `enabled` 就装队列，与 `enable_balance_scheduling` 开没开无关（见[均衡调度](balance-scheduling.md)）。
- **启动日志**：装好时打 `ShortRequestFirst waiting queue installed: threshold=..., long_max_wait_ms=...`；运行中队列有进出时最多每 5 秒一行 `ShortRequestFirst stats: ...`，含三条车道的长度、插回与取走计数、老化插队次数 [C8]。

### 会报什么错

- `enabled` 为真时平台层逐条校验，不满足直接 `ValueError`、服务起不来：`scheduler_config.policy` 必须是 `fcfs`；不能和 `batch_job_sched_config` 同开（见 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)）；`v0.26.0rc` 不能和 `profiling_chunk_config` 同开；不能跑在 PD 分离的 D 节点上（`kv_role='kv_consumer'`）[C5]。
- **子配置多写一个键直接报错，不是静默走默认**；`threshold < 0` 或 `long_max_wait_ms < 0` 也是 `ValueError`（`v0.30.0` 起由 Pydantic `extra="forbid"` 与 `model_validator` 校验）[C37]。
- 安装时 `scheduler.waiting` 里已经有请求就 `RuntimeError`（必须在接纳第一条请求之前装）；策略不是 FCFS 就 `ValueError`。
- 退化提醒 `ShortRequestFirst scheduling is repeatedly promoting long requests ahead of waiting short requests ...` 用 `warning_once` 打，`AGED_LONG_WARNING_STREAK = 3`，只提醒不改参数 [C7]。

### 开销和什么时候别开

- **官方建议别开的情形**：负载里请求长度大体均匀，或者严格的先来后到比短请求时延更重要 [S20]。
- **默认 `long_max_wait_ms = 0` 下长请求会饿着。** 短请求持续不断时要给一个正数；官方给的定法是先在严格短优先下量长请求等待的 P90/P95，再和服务能容忍的额外排队时间取中间 [S21]。
- **管不到 running。** 上游每步先扫 running，再进等待循环；等待循环一开头还要过「这一步没抢占过、引擎没暂停、running 没满」三关。
- **挂起队列排在三条车道之上。** 被挂起的状态包括等语法、等远端 KV、等流式输入；FCFS 下 `_select_waiting_queue_for_scheduling` 返回 `self.skipped_waiting or self.waiting`，挂起队列先看 [C12]。
- **抢占退回走插回队头。** `_preempt_request` 把状态置为 `PREEMPTED`、已算数清零，再调 `self.waiting.prepend_request(request)` [C13]；三车道队列的插回会重新分类，落进恢复车道。「不这样会反复压同一条请求」是推导 [D]。
- **按块对齐切分得 0 就停。** 混合模型在对齐模式下，`_mamba_block_aligned_split` 返回 0 时等待循环直接 `break`；短请求先占余量会让长请求更常碰上。GLM 双机不走对齐模式，见 [chunked prefill](chunked-prefill.md)。
- **GLM 双机上那张步数账是推导** [D]：数取自场景 M 的 20,000 token 变体，只加了一条 4 token 的短请求；没有实测。

### 版本差异

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 特性与三车道队列 | 无此特性（固定 GLM `db701c1f` 同样无入口） | 新增 `short_request_first_scheduler.py`（三车道队列 + 老化 + 钉住候选 + `ShortRequestFirstAsyncScheduler`） | 同核心队列实现（`short_request_first_scheduler.py#L148-L183`），延续先判恢复车道再按 `threshold` 分短/长车道 | 延续同三车道队列与 `ShortRequestFirstAsyncScheduler`（`short_request_first_scheduler.py#L329-L380`） |
| 配置类与互斥校验 | — | 手写 `ShortRequestFirstConfig` 校验，默认 `False` / `256` / `0.0`；平台拒非 FCFS、`batch_job_sched_config`、`profiling_chunk_config` 与 `kv_consumer` | 改为 Pydantic dataclass（`ascend_config.py#L1557-L1575`），`extra="forbid"` 与范围校验，默认值不变；平台互斥规则见 `platform.py#L1049-L1085` | 延续 Pydantic 配置与顶层弃用回退（`ascend_config.py#L1758-L1771`）；平台校验见 `platform.py#L1234-L1259` |
| 与 `profiling_chunk` 同开 | — | 直接 `ValueError` | 允许同开：同步路径由 `ProfilingChunkScheduler.__init__` 安装队列（`scheduler_profiling_chunk.py#L94-L106`）；异步路径仅允许 MRV2（`VLLM_USE_V2_MODEL_RUNNER=1`），MRV1 报 `ValueError`（`platform.py#L1079-L1085`） | `scheduler_profiling_chunk.py` 与 `profiling_chunk_config` 已从 `SchedulerExtensionConfig` 移除，无该组合分支 |
| 上游等待队列与文档 | 仅 `fcfs` / `priority`；无 GLM 模型代码（GLM 在 `db701c1f`） | 官方文档与代码兼容说明一致 [S22] | 上游 `scheduler.py#L202-L205` 延续 `waiting` + `skipped_waiting`；文档对 `profiling-chunk` 兼容说明滞后于代码，以代码为准 [S23][!] | 上游 `scheduler.py#L232-L240` 拆分出 `kv_holding_waiting` / `async_kv_waiting`；Ascend 队列安装仅替换 `self.waiting` |

均衡调度开关在各版本怎么读（环境变量回退何时删除），见[均衡调度](balance-scheduling.md)。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 三条车道、分类、老化、钉住车道、退化警告、统计日志、安装函数、异步子类 | `vllm_ascend/core/short_request_first_scheduler.py`（`2ed6cbba`、`c09d3e20#L148-L183`、`8d6180e2#L329-L380`） |
| 三个配置键与校验，写在顶层时的弃用回退 | `vllm_ascend/ascend_config.py`（`c09d3e20#L1557-L1575`、`8d6180e2#L1758-L1771`） |
| 启用时的互斥校验、异步路径换 `scheduler_cls` | `vllm_ascend/platform.py`（`2ed6cbba#L652-L680`、`c09d3e20#L1049-L1085`、`8d6180e2#L1234-L1259`）[C36][C40] |
| 同步路径与 `v0.30.0` `profiling_chunk` 安装点 | `vllm_ascend/patch/platform/patch_balance_schedule.py`；`vllm_ascend/core/scheduler_profiling_chunk.py`（`c09d3e20#L94-L106`） |
| 被换掉的等待队列、扫等待队列的循环、挂起队列、抢占退回 | 上游 `vllm/v1/core/sched/scheduler.py`（`568afb3a`、`ced6857a#L202-L205`、`ba15685a#L232-L240`）、`request_queue.py` |
| 官方特性文档 | `docs/source/user_guide/feature_guide/short_request_first.md`：用途与配置、长度门槛与等待门槛怎么定、调度次序、退化警告与兼容性 |

**待核。**

1. `v0.30.0` / `main` 上 GLM（`models/glm5next/`）与短请求优先同开是否有额外限制：缺同版本的测试或实跑记录。
2. 短请求优先对长、短请求 TTFT 与等待分布的影响：本部署和官方文档都没有实测数。

固定 `2ed6cbba` 与 `v0.30.0` / `main` 均先判断恢复车道（被抢占、已有计算进度或已有输出任一成立即进入），其余请求才按提示词长度是否不大于门槛划短车道；看队头会记住候选并在取走时沿用，候选顺序不能替代预算与 KV 分配检查，也不提供无饥饿或时限保证（来源 1–3、7、35、39）；来源 21 的调参范围也不能当作吞吐或等待时间保证。
