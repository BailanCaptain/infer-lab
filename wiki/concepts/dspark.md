---
id: dspark
title: "DFlash 到 DSpark：从块扩散并行起草到马尔可夫修正与动态验证预算"
type: feature
origin: direct
legacyAnchors:
  猜得更多为什么不一定都值得验证: 主模型批改机制与保底修正词：为什么不是猜得越多越值得验
  草稿为什么既能并行又要做一点串行修正: 从 DFlash 到 DSpark：块扩散并行起草怎样补上局部连贯性
  两条请求怎样分三个验证名额: 置信度累乘与动态验证预算：怎样把名额留给高存活前缀
  选得更多为什么实际吞吐可能更低: 算清整轮耗时盈亏账：为什么全验反而拉低每秒有效产出
  放回-glm-双机能借用什么: 放回固定 GLM 双机与常规 MTP 能借用什么
summary: DFlash 靠块扩散一次前向并行吐出整块 K 个候选词，但词间缺乏自回归依赖导致尾部接受率陡降；DSpark 在块并行主干上叠轻量马尔可夫头恢复局部连贯性，并用置信度驱动动态验证预算砍掉低收益尾部批改。
aliases: [DSpark, DFlash, dflash, 块扩散草稿, DFlash2, Confidence Scheduled Verification, 置信度调度, 变长验证, 可变验证长度, MTP varlen, confidence head]
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L949-L959'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1294-L1318'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/dspark.py#L143-L179'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/dspark.py#L151-L185'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/spec_decode/dspark/speculator.py#L60-L95'
  - 'vllm-ascend@2c59ff10:vllm_ascend/spec_decode/dflash_proposer.py#L15-L38'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/v2/spec_decode/dspark/speculator.py#L35-L57'
  - 'vllm-ascend@c09d3e20:vllm_ascend/spec_decode/__init__.py#L50-L70'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/spec_decode/__init__.py#L46-L63'
  - 'vllm-ascend@c09d3e20:vllm_ascend/spec_decode/utils.py#L278-L342'
  - 'vllm-ascend@c09d3e20:vllm_ascend/spec_decode/utils.py#L500-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/qwen3_dflash2.py#L156-L221'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/speculative_decoding.md#L710-L767'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/spec_decode/__init__.py#L62-L85'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/spec_decode/lilicorr/speculator.py#L16-L48'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_dflash.py#L582-L653'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_dspark.py#L164-L230'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/spec_decode/adaptive_verification.py#L252-L348'
  - 'vllm@ced6857a:vllm/config/speculative.py#L1447-L1525'
  - 'vllm@ba15685a:vllm/model_executor/models/lilicorr.py#L336-L417'
relations:
  - { to: speculative-decoding, kind: builds-on, note: 接受、拒绝和补出下一个 token 的基本规则由原页解释 }
  - { to: speculative-decoding, kind: variant-of, note: 把固定长度 K 的投机验证扩展为按草稿置信度与步耗时动态分配逐请求验证长度 }
  - { to: async-scheduling, kind: builds-on, note: 调度与设备执行重叠会改变置信信息何时可用 }
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: '2026-11-27'
---

**DSpark 从块扩散草稿（DFlash）演进而来：保留一次前向并行起草整块 $K$ 个位置的吞吐优势，在顶端叠上极轻量的马尔可夫串行偏置头恢复相邻词连贯性，再用置信头驱动动态验证预算控制器，砍掉低置信度尾部的无效批改。**

## 从 DFlash 到 DSpark：块扩散并行起草怎样补上局部连贯性

在常规自回归[投机解码](speculative-decoding.md)（如 EAGLE、MTP）中，草稿模型想向前猜 $K$ 个词，自己也得一步接一步跑 $K$ 次串行前向；$K$ 设大后，草稿本身的延迟就会吃掉收益。

**第一阶段：`DFlash`（块扩散草稿 `DFlashDraftModel` / `AscendDflashProposer`）一步并行吐出整块候选。** `DFlash` 先把目标主模型多层辅助隐藏态融合并投影成草稿各层的上下文 K/V，再拼出一个长度为 $1 + K$ 的查询块（第 0 格放已确定的锚点词 $x_0$，后 $K$ 格放掩码词 mask token；典型层打开块内非因果注意力，混排 SWA 的权重按逐层 `is_causal` 配置执行），**只跑一次草稿前向**就同时算出全部 $K$ 个位置的隐藏态 $h_1 \dots h_K$ 与基础分数 $z_1 \dots z_K$。草稿速度极快，但软肋同样明显：第 $i$ 个位置采样时看不到块内第 $i-1$ 个位置刚采出了哪个具体词，缺乏词间自回归约束，容易出现局部搭配脱节——越往后的位置条件接受率陡降，却照样把整块 $K$ 个词塞进昂贵的主模型白耗算力（同族 `DFlash2` 改用 `CandidateSelector` 低秩边分数逐步条件选点，`LiLiCorr` 则对展平的 `[位置, 候选]` 格做注意力重评分）。

**第二阶段：`DSpark`（`AscendDSparkProposer` / `AscendDSparkSpeculator`）用极轻量串行头修补连贯性并输出置信度。** `DSpark` 让沉重的块草稿主干依然只跑一次并行前向产出 $h_i$ 与基础 logits $z_i$，把串行依赖严格收束到顶端的低秩马尔可夫头 `DSparkMarkovHead`：

$$e_i = E[x_{i-1}], \qquad \ell_i = z_i + W e_i, \qquad x_i = \operatorname{sample}(\ell_i)$$

其中 $x_0$ 为锚点词，$E, W$ 为两组低秩马尔可夫权重，采样出的 $x_i$ 映射回目标词表后再喂给下一格 $i+1$（开启 `dspark_draft_topk` 时，先对基础 logits $z_i$ 筛出 top-$k$ 候选，只给这批入围词算马尔可夫偏置）。用一组教学示意数就能看清局部修正的作用——设上一格采出「猫」，当前格基础分数里「跑」略高于「坐」，叠上前驱条件偏置后名次翻转：

| 候选词（教学示意） | 块并行主干基础分 $z_i$ | 马尔可夫偏置 $W e_i$ | 修正后总分 $\ell_i$ |
| --- | --- | --- | --- |
| 「坐」 | $3.0$ | $+0.4$ | $3.0 + 0.4 = \mathbf{3.4}$（胜出） |
| 「跑」 | $3.2$ | $+0.1$ | $3.2 + 0.1 = \mathbf{3.3}$ |

与此同时，`DSpark` 挂接轻量置信头 `ConfidenceHead` 输出每一格被主模型接受的预测概率 $p_i = \sigma(C(h_i, e_i))$（部分权重仅输入 $h_i$）。三者分工截然不同：**马尔可夫头负责把草稿猜准，置信头负责预估每一格值不值得送审，主模型验证才拥有最终采信权**：

```wiki-diagram
file: dspark-intuition
```

## 主模型批改机制与保底修正词：为什么不是猜得越多越值得验

拿到草稿后，主模型把「本轮已确定但尚未送入主模型的末尾锚点词（基础位置）」连同本轮挑出的 $m$ 个候选词拼成一段，一次前向并行批改。主模型在每一格输出的分布，预测的都是**紧挨它的下一格**，因此必须从左到右逐格连续比对（具体拒绝采样判据见[投机解码](speculative-decoding.md)）。

假设请求 A、B 各猜了 3 个候选，但预算控制器决定本轮只验 A 的前 2 个、B 的第 1 个（连同各自的基础位置共 `3 + 2 = 5` 行输入，编号均为教学示意）：
- **遇到分歧就地止损，产出保底修正词**：A 的第 1 个候选 `23` 通过，第 2 个候选 `7` 被拒——后续未验或已验草稿一律作废（它们建立在错误前缀之上，不能跳着捡回），但主模型在批改第 2 格时已经算出了目标分布 $p_{\text{target}}$，无须多跑一轮即可当场产出保底修正词 `9`（贪心解码直接取 $\arg\max p_{\text{target}}$；随机拒绝采样则从归一化残差分布 $\operatorname{norm}(\max(p_{\text{target}} - q_{\text{draft}}, 0))$ 补抽，严格保持与纯主模型相同的无偏目标分布）；同理 B 的第 1 个候选 `8` 被拒后，当场产出保底修正词 `40`。本轮 A 新交付 `(23, 9)`、B 新交付 `(40)`，合计 3 个有效 token。
- **全部通过则顺带收获 bonus token**：若送审的 $m$ 个候选全部通过，主模型还能直接从最后一行的原始目标分布 $p_{\text{target}}$ 多采出 1 个额外新词（bonus token）。因此在未触发结束符或长度截断时，一轮批改稳定产出「连续接受草稿数 $+ 1$」个有效 token。对照请求主线，草拟发生在上一轮末尾[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)，下一轮从[第 3 站准备输入](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)送入主模型批改。

## 置信度累乘与动态验证预算：怎样把名额留给高存活前缀

沿用每条请求起草 3 个候选的例子，设置信头给出请求 A 的逐位条件接受概率为 $(0.9,\; 0.8,\; 0.5)$，请求 B 为 $(0.6,\; 0.4,\; 0.2)$。因为前一个候选一旦被拒后面整串作废，第 $k$ 个候选真正存活下来的概率等于前 $k$ 项连乘：

$$P_{\text{survive}}(k) = \prod_{j=1}^{k} p_j$$

| 请求（教学示意，3 个候选） | 逐位条件接受概率 $(p_1, p_2, p_3)$ | 连续前缀存活概率算式 | 存活概率 $s_{b,i}$ |
| --- | --- | --- | --- |
| 请求 A | $(0.9,\; 0.8,\; 0.5)$ | $(0.9,\; 0.9 \times 0.8,\; 0.9 \times 0.8 \times 0.5)$ | **$(0.9,\; 0.72,\; 0.36)$** |
| 请求 B | $(0.6,\; 0.4,\; 0.2)$ | $(0.6,\; 0.6 \times 0.4,\; 0.6 \times 0.4 \times 0.2)$ | **$(0.6,\; 0.24,\; 0.048)$** |

若本轮全批次只给 3 个草稿验证名额，按 $s_{b,i}$ 从高到低取前三名就是 A1（$0.9$）、A2（$0.72$）、B1（$0.6$）——由于累乘概率随位置单调不增，挑出的名额天然在每条请求内部连成合法的连续前缀，连同两条请求各自的 1 个基础位置共送入 5 行。

在昇腾 `v0.30.0` 的 **MRV1 周期预算控制器（`DynamicSpecScheduler`）** 中，这一机制被落成可调闭环：
- **初始请求预算与周期升降**：每条请求起步按 `initial_verify_budget_per_req`（源码默认 `5`）分配验证名额；每跑满 `budget_update_interval`（默认 `16` 步），控制器统计全批次存活概率 $s_{b,i} \ge \tau$（`budget_threshold` 默认 `0.3`）的候选个数，除以批大小 $B$ 向上取整 $\lceil \#\{s_{b,i} \ge \tau\} / B \rceil$（若结果为偶数且小于 $K$ 则加 1，再钳制到 `[min_verify_tokens, K]`，默认保底 `1`），自适应拉高或砍低每请求平均预算；
- **保底加全局择优截断**：每步分配时，各请求先拿 `min_verify_tokens` 保底格，剩余全批预算在所有候选的 $s_{b,i}$ 上做 `torch.topk`，最后在 `take_draft_token_ids()` 中按分配长度截掉低置信度草稿尾部（`DSpark` 读置信头概率；无置信头的 `DFlash` 则用 $\max(\operatorname{softmax}(\text{logits}))$ 作代理）。

## 算清整轮耗时盈亏账：为什么全验反而拉低每秒有效产出

光看概率还不够，验证变长会把主模型推入更慢的计算分档。继续上面的例子：在无提前停止时，两条请求每轮各有 1 个保底修正词或 bonus token（共 2 个确定产出），叠加上各候选的存活概率就是单轮期望产出（可理解为重复 100 轮平均每轮留下的有效词数）。设**教学耗时假设**为少验（5 行）整轮 `10 ms`、全验（8 行）整轮 `20 ms`（含草稿、主模型、采样与同步开销）：

| 预算方案 | 主模型输入行数 | 单轮期望有效产出 | 整轮耗时 | 每秒期望产出率 |
| --- | --- | --- | --- | --- |
| 少验（A 验 2、B 验 1） | 2 基础 + 3 候选 = 5 | $2 + 0.9 + 0.72 + 0.6 = 4.22$ | $10\text{ ms}$ | $4.22 \div 0.010 = \mathbf{422\text{ token/s}}$ |
| 全验（A 验 3、B 验 3） | 2 基础 + 6 候选 = 8 | $2 + 0.9 + 0.72 + 0.36 + 0.6 + 0.24 + 0.048 = 4.868$ | $20\text{ ms}$ | $4.868 \div 0.020 = \mathbf{243.4\text{ token/s}}$ |

$$\text{Rate} = \frac{E[\text{tokens}]}{t_{\text{step}}}, \qquad t_{\text{break-even}} = \frac{4.868}{422}\times 1000\text{ ms} \approx \mathbf{11.54\text{ ms}}$$

```wiki-diagram
file: dspark-fig-confidence-gating
```

全验虽然每轮多攒出 `0.648` 个期望词，但只要整轮耗时超过盈亏平衡线 `11.54 ms`，每秒有效吞吐反而倒退。这正是昇腾 **MRV2 自适应验证管理器（`AdaptiveVerificationManager`）** 取代固定阈值的原因：设本轮可采样请求数为 $R$、全部调度请求数为 $B$（纯 decode 时 $B = R$；混入未完结 prefill 分块时 $B \ge R$，草稿开销表按整批请求数 $B$ 索引）、非草稿基础位置总数为 $N$、全批候选存活概率从高到低排为 $u_{(i)}$，CPU 结合草稿耗时 $T_{\text{draft}}(B)$ 与主模型验证耗时曲线 $T_{\text{verify}}(N + m)$ 直接搜索吞吐率最高的全批预算 $m^*$（候选含 $m = 0$，即全批草稿都不值得验时直接退回纯单步解码）：

$$m^* = \arg\max_{m} \frac{R + \sum_{i=1}^{m} u_{(i)}}{T_{\text{draft}}(B) + T_{\text{verify}}(N + m)}$$

注意单轮实际产出仍是整数（如首节交付 3 个词），须累积多轮再核对预测与实收是否校准：若置信头持续虚高会多验废稿，若耗时曲线低估当前负载则会低估验证代价；大并发下还应同时监控短请求尾延迟与[达标吞吐](inference-benchmarking.md)。现场排障可将同一请求 ID 与步号的**调度记录**（候选数、分配长度）、**设备记录**（实际图尺寸、草稿与验证耗时）和**采样记录**（接受前缀、保底修正词、停止原因）三表对齐。

## CPU 已经排下一步，新的置信度还没回来怎么办

[异步调度](async-scheduling.md)让 CPU 提前编排下一轮输入时，NPU/GPU 还在跑上一轮前向，最新置信度尚未落盘。

```wiki-diagram
file: dspark-flow
```

引擎用**双缓冲跨轮解耦「定总预算」与「分逐请求长度」**：在昇腾 MRV2 `AdaptiveVerificationManager` 中，CPU 先读双缓冲里较旧一轮的置信度算出全批预算 $m^*$，设备端拿到最新一轮置信度后再用编译后的 `cumprod` + `topk`（配套新主线改为 Triton 累乘与二分阈值）实时切分各请求验证长度。DeepInfer 参考实现同样由 CPU 用 $N-2$ 轮历史定总预算、设备核用最新置信度排序修正并按请求重排表对齐行号回写。该时序严禁拿靠后候选的结果倒推篡改前序候选是否送验，否则会破坏主模型拒绝采样的分布无偏性。

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

工程上常把三种完全不同的机制都笼统称作「动态投机长度」，调参前必须先按决策依据与执行器分清：

| 路径 | 决策依据 | 同一批次内各请求长度 | 适用执行器与关键前提 |
| --- | --- | --- | --- |
| **Ascend MRV1 `DynamicSpecScheduler`** | 周期统计 $s_{b,i} \ge \tau$ 更新预算 + 批内 `topk` | 可逐请求不同 | `v0.30.0` MRV1（`main` 已随 MRV1 退场）；`DSpark` 读置信头（限 Qwen 系草稿），`DFlash` 用最大概率代理 |
| **Ascend MRV2 `AdaptiveVerificationManager`** | 双缓冲置信度 + 耗时曲线最大化期望产出率 | 可逐请求不同（含 0） | MRV2 `enable_adaptive_verification=true`；需带置信头的 `DSpark` 与全图解码能力，与 [PP](pipeline-parallel.md)、[PCP/DCP](context-parallel.md)、LM-head TP、[LoRA](lora.md) 互斥 |
| **DeepInfer `MTPVarlen` 对照** | $N-2$ 轮总预算 + 设备端最新置信度重排 | 可逐请求不同 | DeepInfer CUDA TileLang 参考实现 |
| **按批大小分段选 $K$** | 当前并发请求数落在哪一配置区间（如 `1–64` 验 3、`65–128` 验 1） | **整批统一共用同一个 $K$** | `num_speculative_tokens_per_batch_size`；官方指南排除 `DSpark` 与 `MTP + DCP + DSD` |

## 对话变长后，还可以只限制草稿读的历史

动态验证预算决定「向前验几个」，**草稿 KV 滑动窗口（`draft_window_size`）**决定「起草时往回看多远」，二者是正交的两根轴。例如上下文已达 10,000 个 token、本轮仍起草 5 个候选，将草稿窗口设为 2,048 后，草稿层只回看最近一段历史（起点向下对齐缓存块边界，最多多读一个块减 1 格），主模型批改时依然读取完整 10,000 个位置。短上下文训练的草稿借此回到熟悉区间，而写入槽位仍按完整序列对齐以免后续错位（`v0.30.0` 仅限 MRV1 的 `eagle3 / dflash / dspark`，MTP 因复用主干层强制忽略，`main` 已移除旧入口）。

## 放回固定 GLM 双机与常规 MTP 能借用什么

前文的「期望有效产出 ÷ 整轮耗时」盈亏平衡算式同样适用于常规自回归 MTP（如例外 B [GLM-5.3-Flash 双机](glm-5-3-flash-two-node.md)的固定 3 步 MTP 投机）：当高并发批次把主模型推入更宽的图尺寸分档或跨机通信瓶颈时，同样可以用三表分段耗时核对每轮多验的候选是否抵得过额外步长。但必须分清实现边界：**固定 GLM MTP 仅挂 1 个 MTP 层（层号 `45`）并连续串行调用 3 次（`[45, 45, 45]`）起草，不具备 `DSpark` 的块扩散马尔可夫偏置头、`ConfidenceHead` 置信头，也不包含昇腾 `dynamic_spec_config`、`enable_adaptive_verification` 或 DeepInfer 的 `MTPVarlen` 开关**，排查时切勿把 `DSpark` 专属配置套到固定 GLM MTP 上。

## 常见误解

- **「草稿置信度高就可以跳过主模型直接发给用户。」** 置信头只负责分配验证名额，每个交付给用户的词都必须经过主模型验证、保底修正采样或末尾 bonus 采样。
- **「DFlash 一次并行吐完 $K$ 个词，所以把 $K$ 调得越大越快。」** 块内缺乏词间自回归依赖会让靠后位置存活率骤降，主模型多验废稿跨入更慢计算档位反而拉低每秒有效吞吐。
- **「平均接受率变高就等于线上变快。」** 砍掉难猜的尾部候选会缩小接受率分母；验收必须看同一到达负载下的每秒实际完成输出词数与请求尾延迟。
- **「只要固定随机种子，变长投机就能逐 token 复现。」** 除随机种子外，批次拼装、跨轮置信度时序与浮点归约路径都会改变候选截断边界。

## 对照源码

### 怎么开

昇腾在 `speculative_config` 基础之上提供两代置信度变长验证与草稿滑窗配置（源码默认值与官方指南示例值须分开核对）：[S29]

| 机制 | 启用入口与源码默认值 | 支持范围与互斥边界 |
| --- | --- | --- |
| **草稿方法分派** | `speculative_config.method="dflash"`（自动按权重识别 `DFlash` / `DFlash2` / `main` `LiLiCorr`）或 `"dspark"`；`dspark_draft_topk=None`（缺省读权重），`enable_confidence_head=False` | 正式版解析 `DFlash` / `DSpark` 时自动将 `parallel_drafting` 置真；显式开启置信头时检查权重是否包含置信头参数 [C35] |
| **MRV1 动态预算（`v0.30.0`）** | `additional_config.dynamic_spec_config`：**源码默认** `initial_verify_budget_per_req=5`、`budget_update_interval=16`、`budget_threshold=0.3`、`min_verify_tokens=1`（指南 `50` 与 `0.7` 为文档示例） | `method` 须匹配 `dspark`（限 Qwen 置信头草稿）或 `dflash`（用最大概率代理）；`main` 已随 MRV1 退场移除 [C18][C26] |
| **MRV2 自适应验证** | `speculative_config.enable_adaptive_verification=true`（默认 `False`） | 要求带置信头的 `DSpark` 且目标模型具备 full decode graph；与 PP、PCP、DCP、LM-head TP、LoRA 互斥 [C34] |
| **按批大小选 $K$ / 草稿滑窗** | `num_speculative_tokens_per_batch_size`（如 `[[1,64,3],[65,128,1]]`）；MRV1 草稿滑窗 `additional_config.draft_window_size`（默认 `None`） | 按批选 $K$ 排除 `DSpark` 与 `MTP+DCP+DSD`；滑窗 `v0.30.0` 仅限 MRV1 `eagle3/dflash/dspark`（MTP 忽略，`main` 已移除）[S9][S10] |

DeepInfer 参考引擎的对照开关为 `DEEPINFER_ENABLE_MTP_VARLEN=1` 与 `DEEPINFER_USE_NEXTN_DECODE`（环境默认 `5`）；NVIDIA 逐 token 确定性对照还要求 `DEEPINFER_BATCH_INVARIANT=1`、关闭变长验证并固定 `seq_seed`，不能直接推及昇腾。[S7][C8]

### 会报什么错

- **动态预算与自适应验证冲突**：MRV1 报 `Unsupported dynamic speculative method: …`、`DFlash requires logits.`、`DSpark requires num_reqs.`；MRV2 报 `Adaptive verification is not currently compatible with LoRA / pipeline parallelism`、`Adaptive verification requires full CUDA graphs`，昇腾另报 `lmhead TP does not support enable_adaptive_verification`。
- **`DFlash2` / `LiLiCorr` 与 Runner 校验**：`v0.30.0` MRV2 下 `DFlash2` 开图模式报 `dflash2 does not currently support graph mode; please enable enforce_eager.`（`main` 已支持 draft full ACLGraph）；`main` 的 `LiLiCorr` 要求 $K \le 16$ 二次幂且禁用细粒度词表切分（报 `LiLiCorr does not support … vocabulary sharding on Ascend`）；Ascend A5 上命中 `DSV41_PACKED_CACHE` 的 DeepSeek V4.1 强制要求 MRV2（`main` 显式设 `VLLM_USE_V2_MODEL_RUNNER=0` 直接报 `Model Runner V1 has been removed from vllm-ascend`）。[C17][C31]

### 开销和什么时候别开

草稿接受率偏低、生成长度极短、马尔可夫/置信头开销偏大或验证行数跨入更慢的图分档时，动态投机可能不赚反亏；验收必须基于目标硬件实测吞吐曲线与线上有效输出率，公开基准百分比不能直接当作业务默认收益。

### 版本差异

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| **`DFlash` 家族** | MRV1 已有 `AscendDflashProposer`（上游注册 `DFlashDraftModel`）；无 `DFlash2` / `LiLiCorr` | `DFlash` 具备 MRV1 + MRV2 双入口；无 `DFlash2` / `LiLiCorr` | `DFlash` 与 `DFlash2` 均具两代 Runner（`method="dflash"` 自动识别 `DFlash2DraftModel`，MRV2 限 eager）；无 `LiLiCorr` | MRV2 对 `method="dflash"` 依次匹配 `LiLiCorr`、`DFlash2`、`DFlash`；`DFlash2` 新增 draft full ACLGraph |
| **`DSpark` 草稿与 Runner** | 分派表无 `dspark` | MRV1 `AscendDSparkProposer` + MRV2 `AscendDSparkSpeculator` | 两代 Runner 共存，含 `Qwen3DSparkModel`、`DeepseekV41DSparkModel`（A5 `DSV41_PACKED_CACHE` 强制 MRV2） | 移除 MRV1，统一由 MRV2 `AscendDSparkSpeculator` 承接 |
| **置信度动态验证预算** | 无 | 两类置信度动态预算入口均未合入 | MRV1 提供 `DynamicSpecScheduler`（默认初始预算 `5`、间隔 `16`、阈值 `0.3`）；MRV2 提供 `enable_adaptive_verification` | 随 MRV1 退场移除 `DynamicSpecConfig`，统一收敛至 MRV2 `AdaptiveVerificationManager` |
| **草稿 KV 滑动窗口** | 无 | MRV1 从 `additional_config` 直读 `draft_window_size` | MRV1 支持 `eagle3/dflash/dspark`（MTP 强制忽略），MRV2 未接入 | 随 MRV1 退场移除旧入口 |

### 源码位置

- **上游草稿与自适应预算**：`DFlash` 块非因果草稿见 `vllm@ced6857a:vllm/model_executor/models/qwen3_dflash.py#L582-L653`，[C32] `DSparkMarkovHead` 与 `ConfidenceHead` 见 `models/qwen3_dspark.py#L164-L230`，[C33] MRV2 `AdaptiveVerificationManager` 吞吐目标式见 `spec_decode/adaptive_verification.py#L252-L348`；`main` 新增 `LiLiCorr` 见 `vllm@ba15685a:vllm/model_executor/models/lilicorr.py#L336-L417`。
- **昇腾四版本分派与控制器**：早期 `DFlash` 与 `DSpark` 入口见来源 22–23；`v0.30.0` 双 Runner 分派、`DFlash2` 选点核与 MRV1 `DynamicSpecScheduler` 预算截断见来源 24–28；[C27] `DeepseekV41DSparkModel` 与 `main` MRV2 `AscendDSparkSpeculator` 见来源 19–21；草稿滑窗读块表裁剪与完整写槽位见来源 14、16。
- **论文与 DeepInfer 对照**：半自回归草稿与置信调度见 DSpark 论文 [S1] 与 V4.1 报告 [S2]；DeepInfer 草稿头、`MTPVarlen::schedule`、TileLang 累乘排序核 `compute_seqlens_q_by_confidence_rates_tl`（仅存于 DeepInfer CUDA 仓）、worker 异步回写及离线全接受口径基准分别见来源 3–6 与 15。[C4][C5] 本页分数、概率与 `10 ms / 20 ms` 耗时属教学假设，[A] `422 / 243.4 token/s` 与 `11.54 ms` 为公式推导，[D] 未做实机采样分布与吞吐压测。[I]
