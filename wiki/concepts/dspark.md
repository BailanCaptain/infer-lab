---
id: dspark
title: "DSpark：先猜几个，再决定值得验证几个"
type: feature
origin: direct
summary: 用两条请求的候选概率算出怎样分配验证预算，再加入实际每轮耗时判断收益；解释半自回归草稿、置信度累乘、CPU/设备异步分工，以及接受率高却不更快时的排查方法。
aliases: [DSpark, Confidence Scheduled Verification, 置信度调度, 变长验证, 可变验证长度, DFlash, MTP varlen, confidence head]
chapters: ["19"]
order: 3
sources:
  - https://arxiv.org/html/2607.05147v1
  - https://arxiv.org/html/2609.19969v1
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/models/mtp/dflash.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/csrc/engine/mtp_varlen.hpp
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/layers/tilelang_ops/cuda/schedule_mtp_varlen.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/examples/benchmark.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/README.md
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/environ.py
  - https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/speculative_decoding.md
  - https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/developer_guide/Design_Documents/speculative_kv_sliding_window.md
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1112-L1136'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1298-L1322'
  - 'vllm-ascend@921ccc52:vllm_ascend/ascend_config.py#L579-L593'
  - 'vllm-ascend@921ccc52:vllm_ascend/worker/v1/spec_decode/llm_base_proposer.py#L416-L453'
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/worker/worker.py#L191-L258
  - 'vllm-ascend@921ccc52:vllm_ascend/worker/v1/spec_decode/utils.py#L26-L112'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L959'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1295-L1319'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/dspark.py#L143-L175'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/dspark.py#L151-L180'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/spec_decode/dspark/speculator.py#L60-L90'
relations:
  - { to: speculative-decoding, kind: builds-on, note: 接受、拒绝和补出下一个 token 的基本规则由原页解释 }
  - { to: async-scheduling, kind: builds-on, note: 调度与设备执行重叠会改变置信信息何时可用 }
  - { to: deepseek-v4-1-flash, kind: builds-on, note: 模型页维护草稿层数与配置的唯一出处 }
  - { to: inference-benchmarking, kind: builds-on, note: 用实际交付和服务目标验证候选调度是否有收益 }
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: '2026-11-19'
---

**DSpark 用便宜的草稿计算猜出后续 token，再根据“这些猜测被接受的机会”和“验证要花多久”，决定每条请求这轮验证多长。** 目标是让主模型的每份计算换来更多实际输出；草稿猜得多，不代表全部验证最划算。

## 猜得更多，为什么不一定都值得验证

普通生成要一个位置接一个位置推进。**Speculative decoding** 先提出几个候选，再让主模型一次检查一段：从左到右接受，遇到拒绝就停止沿用后续草稿，并按采样规则生成替代结果。具体接受算法见[推测解码](speculative-decoding.md)。候选是待验证的猜测，还不能发给用户。

先走完一轮。假设两条请求 A、B 都在生成，末尾各有一个已经确定、还没送进本轮主模型的 token。草稿给 A 猜了三个后续编号，给 B 也猜了三个；这轮决定只验证 A 的前两个、B 的第一个。主模型的输入因此是“A 的已确定末尾加两个猜测”和“B 的已确定末尾加一个猜测”，合计五个位置。

```wiki-diagram
file: dspark-intuition
```

图中 A 猜的第一个编号 23 被接受，第二个编号 7 被拒绝，主模型按接受规则给出替代编号 9；B 猜的第一个编号 8 就被拒绝，得到替代编号 40。这轮新交付的是 A 的 (23,9) 和 B 的 (40)，共三个编号。A、B 原来已经确定的末尾编号不是这轮新增输出。编号均为教学示意，不对应特定 tokenizer。

如果所验草稿全部通过，主模型还可以从最后一行的结果再给出一个新编号。于是，在没有提前结束或长度截断的情况下，一轮输出是“接受的草稿数加一”。最后这个一，在发生拒绝时是替代输出，全部接受时是额外输出；两种情况都不等于把输入末尾重复发给用户。具体概率接受规则仍以[推测解码](speculative-decoding.md)为准。

这也解释了为什么验证必须从第一个候选开始连续进行。后一个猜测建立在前面的猜测成立之上，不能跳过被拒绝的位置，把后面碰巧猜对的编号接回来。

DSpark 要解决的是：主模型这轮应给 A、B 各分多少验证工作？容易猜的请求，后面几个可能仍值得验证；第一个就常被拒绝的请求，多验后面的收益很低。**Confidence head** 是预测候选接受概率的一小段计算，用来分配预算。它提供预测，最终是否接受仍由主模型决定。

对照请求主线，[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)在本轮末尾提出下一轮的草稿；下一圈从[第 3 站准备输入](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)开始，把候选送入主模型计算和验证。这个先后关系可复用，具体草稿结构则依模型而异。

## 两条请求，怎样分三个验证名额

沿用每条请求三个候选的例子，给出一组教学概率。请求 A 的条件接受概率为 0.9、0.8、0.5；B 为 0.6、0.4、0.2。“条件”指前面的候选已经接受后，这一个能否接着被接受。

要估计第 $k$ 个候选最终留下来的概率，需要把前面各项一起乘进去（第一个被拒绝时，后面再好也不能沿用这一串草稿）：

$$P_{\text{survive}}(k) = \prod_{j=1}^{k} p_j$$

| 请求（教学示意，3 个候选） | 逐位条件接受概率 $(p_1, p_2, p_3)$ | 连续前缀存活概率算式 | 存活概率结果 |
| --- | --- | --- | --- |
| 请求 A | $(0.9,\; 0.8,\; 0.5)$ | $(0.9,\; 0.9 \times 0.8,\; 0.9 \times 0.8 \times 0.5)$ | **$(0.9,\; 0.72,\; 0.36)$** |
| 请求 B | $(0.6,\; 0.4,\; 0.2)$ | $(0.6,\; 0.6 \times 0.4,\; 0.6 \times 0.4 \times 0.2)$ | **$(0.6,\; 0.24,\; 0.048)$** |

若本轮只多给三个草稿验证位置，最高的三项是 A1 的 0.9、A2 的 0.72、B1 的 0.6。因此 A 验两个、B 验一个，正好得到首节的方案。每条请求那个已确定、仍要送主模型的末尾 token，称为本轮的**基础位置**。两条请求各占一个基础位置，再加三个候选，共五行输入。

这三项恰好各自形成连续前缀，是因为累乘后的概率不会沿位置增大。真正实现还需稳定的并列排序和请求重排映射；不能随意把多请求候选打散，丢掉“属于哪条请求、排第几个”的关系。

## 选得更多，为什么实际吞吐可能更低

继续上一组概率，假设本轮没有提前停止或长度截断，每条请求会有一个替代或额外输出，再加连续接受的草稿，就得到期望输出数。怎样理解小数形式的期望？设想相同概率条件重复 100 轮：两个请求每轮各有一个替代或额外输出，共 200 个；A 的第一、第二个草稿预计分别留下 90、72 个，B 的第一个预计留下 60 个。合计预计 422 个，平均每轮 4.22 个；某一轮仍只会输出整数个。

现在比较两个预算，给定以下**教学耗时假设**：少验时整轮 10 ms，全验时整轮 20 ms，时间包括草稿、主模型、采样及无法隐藏的准备开销。

| 预算 | 主模型位置数 | 期望最终输出 | 整轮耗时 |
| --- | --- | --- | --- |
| A 验 2、B 验 1 | 2 个基础 + 3 个候选 = 5 | 2 + 0.9 + 0.72 + 0.6 = 4.22 | 10 ms |
| 两边各验 3 | 2 个基础 + 6 个候选 = 8 | 2 + 0.9 + 0.72 + 0.36 + 0.6 + 0.24 + 0.048 = 4.868 | 20 ms |

全验每轮预计多产出一些，但多出的概率较低，时间却明显增长。换成相同时间口径（每秒实际可能留下多少输出，示意），才能看出哪个方案更值得：

$$\text{Rate} = \frac{E[\text{tokens}]}{t_{\text{step}}}, \qquad t_{\text{break-even}} = \frac{E[\text{tokens}_{\text{full}}]}{\text{Rate}_{\text{partial}}}$$

| 比较项（教学耗时假设） | 算式 | 结果 |
| --- | --- | --- |
| 少验的期望输出率 | $4.22 \div 0.010\text{ s}$ | **422 token/s** |
| 全验的期望输出率 | $4.868 \div 0.020\text{ s}$ | **243.4 token/s** |
| 全验与少验持平的整轮耗时 | $4.868 \div 422 \times 1000\text{ ms}$ | **约 11.54 ms** |

```wiki-diagram
file: dspark-fig-confidence-gating
```

上图把连续存活概率的 Top-3 预算门控、少验与全验的耗时盈亏平衡，以及后文将展开的半自回归三组件与昇腾四类变长/窗口路径对照放在同一视野下。在这组概率与停止条件不变时，全验必须比约 11.54 ms 更短，期望输出率才高于少验。因此，全验若也只需 10 ms，就更划算；若需要 12 ms，虽然比表中的 20 ms 快了许多，仍不及少验方案。读者可以用同样的方法，把自己测到的输出量和整轮耗时放在一起比较。

DSpark 因而需要实际硬件的吞吐曲线，不能只按固定概率阈值决定长度。代码的预算估计使用前向曲线并补入运行时反馈、采样耗时；最终验收仍须测完整服务的实际输出与延迟。

这里按两条请求的期望总输出选预算，还没有给每位用户的等待提供保证。大负载下，应同时检查短请求是否被拖慢，以及[达标吞吐](inference-benchmarking.md)是否真的上升。

期望值也不是某一轮的承诺。首节同一个方案实际只交付三个编号，与表中的 4.22 不同并不足以说明预测或实现出错；要积累多轮，再比较预测与实际接受情况。

现场可以把一轮记录拆成三份：调度记录写请求标识、候选数和验证长度；设备记录写实际执行尺寸、草稿与验证耗时；结果记录写接受前缀长度、替代输出及停止原因。用同一请求标识和步号把它们接起来，就能知道“少验了”究竟是调度决定，还是末尾停止截断；也能发现逻辑位置减少了、实际仍按原图尺寸执行的情况。

如果置信预测持续偏高，预算会高估后面几个候选的价值；如果旧曲线给出的耗时低于当前实际耗时，预算就会低估验证的代价。两类误差要分别检查：前者对照预测与接受记录，后者对照预测耗时与设备时间。修正后仍按同一到达负载重新验收，既看实际交付，也看每条请求的等待。

## 草稿为什么既能并行，又要做一点串行修正

现在再看这些猜测怎样产生。DSpark 先并行算出多个候选位置的基础分数，再用一个很小的 **Markov head**，根据前一个候选的编号修正下一个位置的分数。多个位置共同完成较重的草稿主干计算，最后只串行做一段较小的修正，这就是这里的半自回归。源码仍沿用 DFlash 的模块命名，不能只按文件名判断它没有 DSpark 的这些部分。

用一个**教学分数**理解修正。假设上一候选是「猫」，下一位置基础分数为「坐」$3.0$、「跑」$3.2$，局部修正分别加 $0.4$ 和 $0.1$（这里只演示分数变化，不代表真实模型权重或词元切分）：

$$s_{\text{final}}(w) = s_{\text{base}}(w) + \Delta_{\text{Markov}}(w \mid w_{\text{prev}})$$

| 候选词（教学示意） | 基础分数 | 局部修正 | 修正后分数 |
| --- | --- | --- | --- |
| 「坐」 | $3.0$ | $+0.4$ | $3.0 + 0.4 = \mathbf{3.4}$ |
| 「跑」 | $3.2$ | $+0.1$ | $3.2 + 0.1 = \mathbf{3.3}$ |

若本例按最高分选草稿，结果从“跑”变为“坐”。Markov head 改变猜测内容；Confidence head 预测猜测能留下来的机会；主模型验证才决定实际输出。这三件事要分开。草稿主干、短串行修正、置信预测与额外状态都有成本，必须算进前节的整轮耗时。

## CPU 已经排下一步，新的置信度还没回来怎么办

**异步调度**让 CPU 准备下一批时，设备仍在执行当前批。它节省设备等主机的空档，却带来一个信息时序问题：当最新置信预测还在设备上时，CPU 要用什么信息排下一步？

```wiki-diagram
file: dspark-flow
```

DeepInfer 的分工是：CPU 先根据已有信息决定总预算，设备拿到更新的置信值后，再计算连续接受概率、排序并修正各请求的验证长度。请求重排信息让它知道新一批的请求对应上一批哪一行。结果异步回写供主机使用；这条修正路径要求存在可对应的上一批请求，变长开关也已启用，不是所有批次都执行修正。

这套时序需要谨慎保持：不能利用更后面的候选信息，反过来随意决定前面的候选是否得到验证。否则“主模型最终验证”这一句本身，并不足以证明采样分布被保留。源码为预算与逐请求长度使用不同轮次的信息；排查时必须同时记录步号、请求映射和置信信息的轮次，不能只看一张最终长度表。

## 接受率高却没有更快，现场先查什么

先区分三个数：**提出多少**、**实际验证多少**、**最终接受多少**。同一轮多验低概率候选，会改变接受率分母；只看平均接受率，很容易把“不验证难猜的位置”误当成草稿模型变聪明。

首节可以整理成两条诊断记录：A 提出 3、选择验证 2、接受 1、交付 2；B 提出 3、选择验证 1、接受 0、交付 1。它们共享本轮步号，另附实际执行尺寸和设备耗时。这是从调度、执行、采样三处汇总的示意记录，不是框架保证直接打印的一行日志。若逻辑共 5 行却仍按 8 行执行，应先看补齐与图尺寸；若实际已降到 5 行但草稿和同步增时，则应查新增开销。两种情况都可能表现为“验证更少，却没更快”。

| 看到的现象 | 应补的记录 | 可以区分的原因 |
| --- | --- | --- |
| 接受较多但每轮更慢 | 草稿、主模型、采样、整理和同步的分段耗时 | 多出的有效输出是否抵得过新开销 |
| 验证数下降，设备时间不变 | 实际执行尺寸、图尺寸与有效位置数 | 是否仍补齐到同一执行尺寸，或等待在别处 |
| 某次重排后长度异常 | 请求 ID、行映射、总预算、置信轮次 | 旧信息、错误映射与正常负载变化 |
| 离线很快，线上输出率低 | 实际接受数、结束/拒绝记录、输入长度分布 | 离线口径是否假设所有候选都接受 |

做对照时固定模型、输入、到达负载、缓存和采样设置，比较固定长度与变长验证；再按实际完成的输出编号计数。若出现正确性差异，先固定相同前缀查首次分歧；需要质量或分布一致的目标，要明确评测方式，不能把单次随机输出不同直接判成错误。

## Ascend 的变长验证，要先分清依据和执行器

前面的具体调度公式和异步分工来自 DeepInfer。Ascend 也有置信度驱动的逐请求验证，但配置和接线分成两条路径：V1 的探索性实现根据草稿置信度调整验证预算，V2 的 adaptive verification 同样让不同请求保留不同候选长度。它们不能仅因目标相同就视为完全相同的算法或开关。

另一种“动态 K”只看当前批里有多少请求。例如配置 1–64 条请求时统一猜 3 个，65–128 条时统一猜 1 个，就能随并发降低验证负荷；它没有比较请求 A 与 B 的置信度，也不会给同一批内两条请求分别分配 3 个和 1 个。选择时先看改变依据，再看 runner 和草稿模型是否支持。

| 路径 | 改变依据 | 每条请求的验证长度 |
| --- | --- | --- |
| 本页 DeepInfer 示例 | 置信度与实测耗时预算 | 在预算内逐请求分配 |
| Ascend V1 confidence / V2 adaptive | 所支持草稿提供的置信度，具体策略各自实现 | 可逐请求不同 |
| 按批大小选择 K | 当前并发落在哪个配置区间 | 同一批共用 K |

Ascend V1 的 DSpark 路径要求置信头，文档当前只支持 Qwen 系列草稿；DFlash 则用草稿分布的最大概率作为置信代理，不额外使用置信头。V2 的 adaptive verification 要求带置信头的 DSpark，并有额外并行、图与 LoRA 限制。方法名相同不代表这些条件自动满足，开关与边界集中在页末。

## 对话变长后，还可以只限制草稿读的历史

候选长度决定“向前猜几个”，**草稿 KV 滑动窗口**决定“猜的时候往回读多少”。二者是不同的轴。例如已经有 10,000 个历史位置，这轮仍打算猜 5 个；把草稿窗口设为 2,048，目标是让草稿只读最近一段历史，主模型验证仍使用它应读取的完整上下文。实现把窗口起点向缓存块边界下取整，因此实际读取长度可比目标多至多一个块减 1 个位置；这里没有把模型最大上下文改成 2,048，也没有把这轮候选数变成 2,048。

短上下文训练的草稿在长对话上可能猜得变差，窗口能让它回到熟悉的输入范围；但已经能利用长历史的草稿反而会损失信息。尤其草稿原生就按某个窗口训练时，不应随意把运行窗口缩得更小。判断依据仍是前面那笔账：实际接受多少、草稿与验证分别耗时多少、最终每秒交付多少 token。

Ascend 的这条实现限制草稿 attention 的读取范围，缓存写入位置仍按完整请求布局处理，避免后续追加时槽位失配；不能把读取窗口大小直接当成全部已分配缓存大小。适配器同时更新设备与主机侧长度，并裁剪用于读取的块表，保留完整写槽位。它也不等于本文 DeepInfer 的置信度预算调度：一个改变可见历史，一个分配验证工作，支持和开关须各自核对。

## 放回 GLM 双机，能借用什么

固定 GLM 配置的 MTP 也遵循“草拟、验证、接受与回退”的通用过程，细节见[推测解码](speculative-decoding.md)。可以借用本页的每轮成本与实际接受量分析；不能把 DSpark 的草稿结构、置信头或 DeepInfer 开关视为 GLM 已经具备的功能。

## 常见误解

- **“置信度高就直接返回。”** 置信度分配验证工作，主模型决定接受。
- **“候选长度越长越快。”** 要看连续存活概率和增加后的整轮耗时。
- **“接受率变高就说明输出更多。”** 必须同时报告提出、验证、接受和完成数量。
- **“固定种子就覆盖所有执行差异。”** 随机数之外，还要核对批次、数值路径和可变调度的支持条件。

## 对照源码

### 怎么开

README 给出的变长验证开关为 `DEEPINFER_ENABLE_MTP_VARLEN=1`，最大候选长度由 `DEEPINFER_USE_NEXTN_DECODE` 控制，本快照环境定义默认 5。检查 checkpoint 是否带兼容的草稿头；不要只给没有此结构的模型增加环境变量。

确定性对照的官方组合还要求 NVIDIA 平台的 `DEEPINFER_BATCH_INVARIANT=1`、关闭变长验证并固定 `seq_seed`。它是该快照的支持边界，不能直接承诺 Ascend 同样逐 token 一致。

Ascend 的两种置信路径按 2026-11-02 官方指南区分。它们都要求已有匹配的 `speculative_config`（方法、草稿路径和最大候选长度）；下面是附加部分，不是完整服务命令：[S9]

| 路径 | 启用位置 | 支持边界 |
| --- | --- | --- |
| MRV1 confidence | `additional_config.dynamic_spec_config`，例如 `{"method":"dspark","method_params":{"initial_verify_budget_per_req":5,"budget_update_interval":50,"budget_threshold":0.7}}` | method 与 speculative_config 一致；DSpark 限 Qwen 置信头草稿，DFlash 用无头概率代理；探索性实现 |
| MRV2 adaptive | `speculative_config.enable_adaptive_verification=true`，默认关 | 需要 DSpark 置信头；不能与 PP、PCP、DCP、LM head TP、LoRA 组合；目标模型不支持完全 eager 或纯 PIECEWISE，官方示例使用 FULL_DECODE_ONLY |
| 按批大小 K | `speculative_config.num_speculative_tokens_per_batch_size`，如 `[[1,64,3],[65,128,1]]` | 官方当前路径不支持 DSpark，也不支持 MTP+DCP+DSD 组合；不应当作上面两种置信开关 |

这些示例预算值不等于推荐值，低延迟负载、API/代理瓶颈或本来已很高的接受率都需要单独对照。V1 和 V2 不能混用对方配置；草稿窗口的 runner 限制又是另一项。

Ascend 的草稿窗口入口为 `--additional-config '{"draft_window_size":2048}'`，须与相应的 `--speculative-config` 一起使用；2048 是示例，先核草稿训练长度。2026-11-02 文档限定 **Model Runner V1** 的 EAGLE3、DFlash、DSpark；V2 尚未接入该窗口。MTP 会强制忽略该窗口，因为它复用目标模型自身的层。省略该字段或设为 `null` 可关闭；不能套用 V2 中其他投机能力的支持说明。[S9][S10][C13][C14]

### 会报什么错

草稿模块会校验层数及头类型；`Only DFlash speculative heads are supported` 或层数不匹配，应核对 checkpoint 和运行实现。调度计数断言则需要检查同一请求的 schedule/process 配对，连同异步模式与前后步号一起保存。

### 开销和什么时候别开

低接受概率、很短的输出、草稿开销大或验证跨入更昂贵的图尺寸，都可能抵消收益。需要当前配置的曲线与实际输出验收；公开文章的提升百分比不构成其他设备和业务的默认收益。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；DeepInfer `774ce244` 作为论文原版变长验证与异步分工对照，Ascend 草稿窗口文档边界另核 `921ccc52`。[S9][S10]

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| DSpark 草稿模型与入口 | 无 DSpark 同等实现（GLM 按 MTP 走） | 新增 `dspark` 草稿分支；上游新增按批大小设 `K` 配置，Ascend 未引用 | 注册 `DeepseekV41DSparkModel`（`models/deepseek_v41/dspark.py#L143-L175`）、`Qwen3DSparkModel`、`Glm5DSparkForCausalLM` 等；**MRV1/MRV2 双轨并存** | 延续 `DeepseekV41DSparkModel`（`#L151-L180`）并扩展 `MiniMax` / `Kimi K3` DSpark；**删除 MRV1，统一由 MRV2 `AscendDSparkSpeculator`（`worker/v2/spec_decode/dspark/speculator.py#L60-L90`）承接** |
| Ascend A5 与 Runner 约束 | 仅 MRV1 | 仅 MRV1 | `platform.py#L952-L959` 强校验：**`DeepseekV41ForCausalLM` 与 `DeepseekV41DSparkModel` 在支持 `DSV41_PACKED_CACHE` 的 Ascend A5 上强制要求 MRV2（`VLLM_USE_V2_MODEL_RUNNER=1`）**，否则启动报错 | 全仓仅保留 MRV2（显式设 `VLLM_USE_V2_MODEL_RUNNER=0` 即报错）；`AscendDSparkSpeculator` 支持 DCP 与 LM-head TP 补齐，但 `lmhead TP` 仍拒绝 `enable_adaptive_verification` |
| 置信度动态变长配置 | 无 | 无 `dynamic_spec_config` | `ascend_config.py#L1295-L1319` 定义 MRV1 `DynamicSpecConfig`（`method` 默认 `None`，支持 `dspark/dflash`）；MRV2 另提供 `speculative_config.enable_adaptive_verification` | 随 MRV1 退场移除 `DynamicSpecConfig`，变长验证收敛至 MRV2 `enable_adaptive_verification` |
| 草稿 KV 滑动窗口 | 无 | 从 `additional_config` 直读，不分方法 | MRV1 支持 `draft_window_size`（`eagle3/dflash/dspark`，MTP 强制忽略），MRV2 未接入 | 随 MRV1 退场移除旧 `draft_window_size` 入口 |

DeepInfer `774ce244` 为本页变长验证与异步分工对照（最大草稿默认 5，变长验证需显式开启）；上游按批大小配置及旧草稿分派见[推测解码的版本核对](speculative-decoding.md#版本差异)。上述 `v0.30.0` 与 `main` 的配置与模型类均已按固定 commit 核对 [C11][C12]；各实现独立，不能把 DeepInfer 的耗时预算公式或收益直接移植为 Ascend 的保证。

### 源码位置

- `v0.30.0` A5 强制 MRV2 校验在 `vllm-ascend@c09d3e20:vllm_ascend/platform.py#L952-L959`，`DynamicSpecConfig` 在 `ascend_config.py#L1295-L1319`，`DeepseekV41DSparkModel` 在 `models/deepseek_v41/dspark.py#L143-L175`；`main` 收敛后的 `DeepseekV41DSparkModel` 与 MRV2 `AscendDSparkSpeculator` 分别在 `vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/dspark.py#L151-L180` 与 `worker/v2/spec_decode/dspark/speculator.py#L60-L90`。
- Ascend 草稿窗口的配置、MRV1/MRV2 与 MTP 边界见官方投机指南 [S9]；读取窗口与完整写槽位的设计见 [S10]。10,000/2,048/5 是区分三个长度的教学示意，不是性能测试。
- 半自回归草稿与置信调度见 DSpark 论文 [S1]、V4.1 报告 §2.4.3 [S2]；草稿结构和 `ConfidenceHead` 见实现 [C3]。
- CPU 预算、历史置信轮次、前向/采样运行时估计在 `MTPVarlen::schedule` [C4]。代码说明预算使用 $N-2$ 轮信息，逐请求分配使用更新信息；异步路径在设备修正。
- 设备端累乘、全局排名、稳定并列排序和请求映射在 `compute_seqlens_q_by_confidence_rates_tl` [C5]。
- 上一批请求映射、变长开关及异步回写消费者见 DeepInfer worker [C15]；Ascend 草稿窗口的读块表裁剪、主机/设备长度与完整写槽位见适配器 [C16]。
- `examples/benchmark.py` 的 decode 报告按“每步每请求 `1+nextn` 全接受”换算输出率；稳态窗口剔除 flush 区间。它不能替代在线实际接受量 [C6]。
- 开关及 NVIDIA 确定性条件见 README [S7]、环境定义 [C8]；本页分数、概率、耗时是教学假设 [A]，422/243.4 为推导 [D]，未做设备性能或采样分布实测。
