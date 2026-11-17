---
id: request-overview
title: 一次请求全景鸟瞰：从输入文字到逐词生成
type: concept
origin: direct
summary: >-
  不引入多机并行与混合模型术语，用一个 6 词词表、4 维向量的纯算术小例子，从头到尾跟完一条请求「我喜欢 → 猫。」的两轮（Prefill 与 Decode）、四件事与「Host CPU — HBM 显存 — AI Core」三块地盘的配合。
aliases:
  - 一次请求全景鸟瞰
  - 请求鸟瞰
  - 推理全流程鸟瞰
  - request overview
  - 两轮四件事
chapters:
  - '01'
order: 5
sources:
  - 'vllm@ced6857a:docs/models/supported_models.md#L1-L60'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L753-L840'
  - 'vllm@ced6857a:vllm/tokenizers/hf.py#L115-L150'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L440-L545'
  - 'vllm@ced6857a:vllm/v1/engine/detokenizer.py#L96-L135'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L589-L620'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L573'
  - 'vllm@ced6857a:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@ced6857a:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L575'
  - 'vllm@ced6857a:vllm/model_executor/layers/logits_processor.py#L58-L120'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/attention.py#L485-L530'
  - 'vllm@ced6857a:vllm/model_executor/layers/layernorm.py#L37-L105'
  - 'vllm@ced6857a:vllm/model_executor/layers/activation.py#L116-L155'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L244-L304'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1638-L1680'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2633-L2646'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/vocab_parallel_embedding.py#L542-L631'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L425-L436'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L721-L733'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L341'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/vocab_parallel_embedding.py#L503-L592'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1185-L1202'
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130'
  - 'vllm@568afb3a:vllm/v1/core/sched/utils.py#L94-L130'
  - 'vllm@ba15685a:vllm/v1/core/sched/utils.py#L98-L140'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: learning-guide
    kind: builds-on
    note: 承接阅读指南的第一站，在进入各块基础积木前先建立单条请求的完整心智地图
contradicts: []
updated: '2026-11-18'
---

## 一条请求进出模型，总共走哪两轮、四件事

**在普通自回归（causal decoder）大语言模型中，处理一条请求从头到尾只是反复做同一套四步循环：把文字切成编号并查出向量、逐层结合前文加工向量、拿最后一个位置的向量给整张词表打分并选出一个编号、判断继续或停止并把编号还原成可读文字。**

你向推理服务发送一句提示词（prompt），模型并不是一口气把整段回答“变”出来的，而是一次选出一个词（token），再把这个刚选出来的词接在后面，作为下一轮的新输入继续往下选。本库后续章节以 `vllm-ascend` `v0.30.0`（配套上游 `vllm`）为主基线，真实模型通常有十几万个词表条目和数千维向量；为了让你在接触真实模型结构或多卡并行之前先把这条主线彻底看懂，本页与后面的 [embedding](embedding.md)、[lm_head](lm-head.md)、[sampling](sampling.md) 共用同一套缩到最小的**教学人为设定**（1 字/词的切分方式、6 个词的词表和 4 个小数构成的向量，全是为方便手算编出来的示意数，不是真实分词器的切法，也不是训练出来的真实权重）：

- **教学小词表（共 6 个词）**：0 号「我」、1 号「你」、2 号「喜欢」、3 号「猫」、4 号「看」、5 号「。」（5 号「。」在本例中只是普通句号标点词；真实模型词表里还会单独设专门的结束符 `eos_token_id`）。
- **教学向量宽度**：每个词查表后变成一排 4 个小数（隐藏维度宽度为 4），模型只设 1 层。
- **教学请求设置**：用户输入提示词 `"我喜欢"`，采用**贪心采样**（`temperature = 0`，每轮固定选得分最高的那一项），并设置最多生成 2 个词（`max_tokens = 2`）。

在这套设定下，`"我喜欢"` 进来、`"猫。"` 出去，一共走**两轮前向计算**，每轮内部都按顺序做完**四件事**：

```wiki-diagram
file: request-overview-four-steps
```

看上面这张图，最容易踩坑的地方只有一个：**第 1 个输出词「猫」（3 号）是在第 1 轮（Prefill，预填充）结束时，直接由提示词最后一个位置（位置 1「喜欢」）给词表打分选出来的，不需要为了拿到第 1 个输出词再额外跑一轮 Decode！** 第 2 轮（Decode，逐词生成）送进模型的已经是刚生成的「猫」（位置 2），它复用第 1 轮存进 `KV cache` 的历史状态，算出第 2 个输出词「。」（5 号），达到 `max_tokens = 2` 上限后停止。下面我们用加减乘除把这两轮的四件事一步步算出来。

## 第 1 件事：把文字切成编号，再按编号查出向量

**模型内部的矩阵乘法只认一排排浮点数，不认汉字和字母；因此请求进门的第一步，是先由分词器（tokenizer）把提示词切成词表里的整数编号，再按编号去嵌入表（embedding table）里把对应那一行浮点数取出来。**

为什么不能直接拿整数编号 `0`、`2`、`3` 去跟权重相乘？因为编号只是词表目录里的“门牌号”：2 号「喜欢」并不是 1 号「你」的两倍，0 号「我」乘任何数更会直接变成 0。要让模型能够比较词义、组合上下文，必须给每个编号配一排可以独立调整的浮点数——这排数就叫这个词的嵌入向量（详见 [token](token.md) 与 [embedding](embedding.md)）。我们沿用 [embedding](embedding.md) 页那张 6 行、每行 4 个教学设定小数的嵌入表 `E`：

| 词编号 | 词 | 嵌入表 `E` 里的 4 个数（教学人为设定） |
|---|---|---|
| 0 | 我 | `[0.2, -0.1, 0.5, 0.3]` |
| 1 | 你 | `[0.1, 0.4, -0.2, 0.6]` |
| 2 | 喜欢 | `[-0.3, 0.8, 0.1, 0.0]` |
| 3 | 猫 | `[0.7, 0.2, -0.4, 0.9]` |
| 4 | 看 | `[0.5, -0.6, 0.3, -0.1]` |
| 5 | 。 | `[0.0, -0.2, 0.6, 0.4]` |

第 1 轮（Prefill）收到提示词 `"我喜欢"` 时，分词器把它切成两个位置：位置 0 是「我」（编号 `0`），位置 1 是「喜欢」（编号 `2`）。接着模型不做任何乘加运算，只是按行号 `0` 和 `2` 从表 `E` 里直接取出两行，拼成一个 2 行 4 列的初始输入张量：

```calc
title: 第 1 件事：提示词 "我喜欢" 切词编号并查出初始向量（教学设定）
输入文字 "我喜欢" → 位置 0「我」编号 0，位置 1「喜欢」编号 2
位置 0 查 E[0] → x₀ = [ 0.2, -0.1,  0.5,  0.3]
位置 1 查 E[2] → x₁ = [-0.3,  0.8,  0.1,  0.0]
拼成第 1 轮初始输入 X（形状 [2, 4]）=
  [ [ 0.2, -0.1,  0.5,  0.3],
    [-0.3,  0.8,  0.1,  0.0] ]
> 这一步只有查表，零次乘法；输出 2 行对应提示词的 2 个位置，每行 4 个数进第 1 层
```

## 第 2 件事：逐层根据前文加工表示，并把 K、V 留作历史

**查表拿到的初始向量还只是每个词“孤立的词典意思”；接下来它们要依次穿过模型的每一层，在每一层里先通过注意力（Attention）把前文的信息按相关度汇总进来，再通过前馈网络（MLP）和残差连接加工成包含完整上下文的隐藏向量（hidden state）。**

刚查出来的 `x₁` 只代表“喜欢”这两个字本身，还不知道是谁喜欢。模型靠每一层里的两个子步把上下文融合进去（详细算子拆解见 [attention-qkv](attention-qkv.md) 与 [mlp-residual-norm](mlp-residual-norm.md)）：

1. **Attention（看前文，并把 K、V 存进 `KV cache`）**：这一层先拿每个位置的向量算出三排小向量——**查询 `q`**（当前位置想找什么前文）、**键 `k`**（这个位置供别人检索的标签）和**值 `v`**（这个位置实际携带的内容）。因为写文章时后面的词还没出现，每个位置只能看自己和前面的位置（因果掩码）：位置 0「我」只能看位置 0；位置 1「喜欢」既看位置 0「我」，也看位置 1「喜欢」。模型拿位置 1 的 `q₁` 分别跟 `k₀`、`k₁` 逐项相乘再相加（点积）算出相关度分数，把分数换成加起来等于 `1` 的权重，再按权重把 `v₀` 和 `v₁` 加在一起。**最关键的一步是：每一层算出来的 `k₀, k₁` 和 `v₀, v₁` 会当场存进这一层的 `KV cache`（键值缓存）**，留给后面的轮次直接读取（详见 [prefill](prefill.md) 与 [kv-cache](kv-cache.md)）。
2. **归一化、MLP（逐位置自己加工）与残差相加**：汇总进前文信息后，向量先加回原本的输入（残差连接，防止多层传递后把原始信息冲掉），再经过归一化（把一排数的尺度拉回稳定范围）和前馈网络（MLP，对当前位置融合后的特征做一次非线性加工），再加回主干，交给下一层。

假设我们的教学模型只有 1 层，位置 0「我」和位置 1「喜欢」在这一层里算出的 `q₁`、`k₀, k₁`、`v₀, v₁` 及注意力加权和残差更新如下（均为教学设定小数）：

```calc
title: 第 2 件事：位置 1「喜欢」融合前文位置 0「我」并算出最终隐藏向量 h₁（教学设定）
已知本层算出的键与值（同时写入本层 KV cache 保存）：
  位置 0「我」：k₀ = [1.0, 0.0] ，v₀ = [0.6, -0.2, -0.5, 0.8]
  位置 1「喜欢」：k₁ = [1.0, 1.0] ，v₁ = [0.2,  0.4, -0.5, 1.2]
位置 1 的查询 q₁ = [1.0, 0.0]

① 算相关度并转成权重（教学简化：两项打分相同时各分一半权重 0.5 和 0.5）：
  q₁ · k₀ = 1.0×1.0 + 0.0×0.0 = 1.0
  q₁ · k₁ = 1.0×1.0 + 0.0×1.0 = 1.0  → 归一化权重 w₀ = 0.5, w₁ = 0.5

② 按权重汇总前文的值 v₀ 与 v₁：
  attn₁ = 0.5 × v₀ + 0.5 × v₁
        = [0.3, -0.1, -0.25, 0.4] + [0.1, 0.2, -0.25, 0.6]
        = [0.4,  0.1, -0.5,  1.0]

③ 加上残差与本层 MLP 加工量 m₁ = [0.9, -0.4, -0.6, 1.0]，得到位置 1 的最终隐藏向量 h₁：
  h₁ = x₁ + attn₁ + m₁
     = [-0.3, 0.8, 0.1, 0.0] + [0.4, 0.1, -0.5, 1.0] + [0.9, -0.4, -0.6, 1.0]
     = [ 1.0, 0.5, -1.0, 2.0]
> 此时 h₁ 已经同时包含了位置 0「我」和位置 1「喜欢」的信息；k₀, k₁, v₀, v₁ 已存入 KV cache
```

## 第 3 件事：用最后一行给词表打分，选出第一个输出编号

**走完最后一层后，模型只取出最后一个位置的隐藏向量，拿它跟输出头权重 `lm_head` 相乘，给词表里的每一个词打出一个分数（`logits`），再由采样（sampling）从这排分数里选出第 1 个输出词的编号。**

为什么第 1 轮（Prefill）明明算出了位置 0 的 `h₀` 和位置 1 的 `h₁` 两行向量，送进 `lm_head` 打分时却只取最后一行 `h₁`？因为位置 0 的 `h₀` 只看到了「我」，预测的是「我」后面该接什么（而提示词里已经告诉你「我」后面是「喜欢」了）；位置 0 在这一轮的真正使命，是把自己的 `k₀, v₀` 留给位置 1 和后续轮次使用。真正读完了整句 `"我喜欢"`、用来预测下一个词的，只有最后一个位置 `h₁ = [1.0, 0.5, -1.0, 2.0]`（详见 [lm_head](lm-head.md)）。

这也解释了初学者最容易误会的一点：**第 1 个输出词是在 Prefill 这一轮的末尾直接选出来的，根本不需要为了拿到第 1 个输出词再去跑一次 Decode。** 我们沿用 [lm_head](lm-head.md) 页的隐藏向量 `h₁ = [1.0, 0.5, -1.0, 2.0]`（1 行 4 个数）以及「猫」列 `[0.6, 0.2, -0.4, 0.5]`、「我」列 `[0.2, -0.4, 0.6, 0.1]`，并补齐其余 4 列的教学设定权重（合起来是 4 行 6 列的输出头权重矩阵 `W_head`），逐列做点积算出 6 个分数：

```calc
title: 第 3 件事：Prefill 最后一行 h₁ 乘 lm_head 给 6 个词打分并选出第 1 个输出词（教学设定）
最后一行隐藏向量 h₁ = [1.0, 0.5, -1.0, 2.0]（形状 [1, 4]）
与 W_head 的 6 列权重（形状 [4, 6]）分别逐位相乘再相加：
  0 号「我」  列 [ 0.2, -0.4,  0.6,  0.1] → 1.0×0.2  + 0.5×(-0.4) + (-1.0)×0.6  + 2.0×0.1    = -0.4
  1 号「你」  列 [ 0.1,  0.2,  0.3, -0.2] → 1.0×0.1  + 0.5×0.2    + (-1.0)×0.3  + 2.0×(-0.2) = -0.5
  2 号「喜欢」列 [-0.2,  0.4,  0.0,  0.1] → 1.0×(-0.2)+ 0.5×0.4   + (-1.0)×0.0  + 2.0×0.1    =  0.2
  3 号「猫」  列 [ 0.6,  0.2, -0.4,  0.5] → 1.0×0.6  + 0.5×0.2    + (-1.0)×(-0.4)+ 2.0×0.5   =  2.1  ← 最高分！
  4 号「看」  列 [ 0.4,  0.2,  0.1,  0.2] → 1.0×0.4  + 0.5×0.2    + (-1.0)×0.1  + 2.0×0.2    =  0.8
  5 号「。」  列 [ 0.0, -0.2, -0.3,  0.4] → 1.0×0.0  + 0.5×(-0.2) + (-1.0)×(-0.3)+ 2.0×0.4   =  1.0
整排词表分数 logits₁ = [-0.4, -0.5, 0.2, 2.1, 0.8, 1.0]（形状 [1, 6]）
> 本例设 temperature = 0（贪心采样，取最高分），直接选出编号 3（对应「猫」），Prefill 当步交出第 1 个输出词！
```

拿到这 6 个分数后，采样器（sampler）有两种常用选法（详见 [sampling](sampling.md)）：

- **贪心选法（greedy，`temperature = 0`）**：每次直接选分数最高的那一项。上面 3 号「猫」得分 `2.1` 最高，必然当选。本页全程采用贪心选法，让每一步的手算结果唯一确定。
- **按概率抽签（随机采样，`temperature > 0`）**：先把每个分数除以温度 `T`，再通过 `softmax`（对每个分数取指数后除以总和）变成一排加起来等于 `1` 的概率——在上面的分数下，取 `T = 1` 时 3 号「猫」分到约 `52.3%` 的概率，5 号「。」分到约 `17.4%`，4 号「看」约 `14.3%`（详见 [lm_head](lm-head.md#分数之后softmax-与采样怎样挑出一个-token)）；接着还可以用 `top-k` 或 `top-p` 只保留排在前面的候选并按概率抽签。注意在随机采样下，最高分只代表抽中概率最大，不代表必然被抽中。

## 第 4 件事：判断继续或停止、还原文本，下一轮只算新位置

**每选出一个编号，引擎会先把它记入已生成序列并检查是否命中停止条件（决定下一轮还要不要继续调度），同时由输出处理侧的反分词器（detokenizer）把编号还原成人类可读的文字；如果还没停，下一轮（Decode）就只把这 1 个新编号送进模型，直接复用 `KV cache` 接着选下一个词。**

在第 1 轮末尾采样选出 `3 号` 后，引擎的调度器先检查两条核心停止规则：

1. **是否撞上停止符**：刚生成的编号是不是模型规定的结束符（`eos_token_id`）或请求指定的停止词编号（`stop_token_ids`）？本例中 0–5 号都是普通词和标点，未命中停止符。
2. **是否达到长度上限**：已生成的词数是否达到请求设置的 `max_tokens`（本例设为 `2`）或模型最大上下文长度？当前只生成了 `1` 个词（`1 < 2`），未达到。

两条都没命中，说明这条请求还要继续；同时反分词器按词表把 `3 号` 还原成汉字 `"猫"`（真实分词器里，如果一个生僻字或 emoji 被拆成了多个字节级 token，增量反分词器会等凑齐完整字符后再输出文字；另外当某一步因撞上 `eos_token_id` 或 `stop_token_ids` 而停止且 `include_stop_str_in_output` 保持默认的 `False` 时，反分词器会跳过最后一个停止 token 的文字转换，不在结果末尾把停止符打印出来，详见 [token](token.md#生成的编号怎样变回文字)）。

接着请求进入**第 2 轮（Decode 第 1 步）**。请注意这一轮的输入：虽然现在整句话已经变成了 `"我喜欢猫"`（3 个位置），但因为因果掩码规定“前面的位置看不见后面的词”，就算把位置 0「我」和位置 1「喜欢」重新算一遍，它们算出来的 `k₀, k₁` 和 `v₀, v₁` 也跟第 1 轮存进 `KV cache` 里的数分毫不差。所以第 2 轮**只把刚选出的 `3 号「猫」` 作为位置 2（只有 1 行向量）送进模型**，并用与第 3 件事**完全同一张输出头权重 `W_head`** 给 6 个词打分：

```calc
title: 第 4 件事：第 2 轮（Decode）只输入位置 2「猫」，复用 KV cache 并沿用同一张 W_head 选出第 2 个词（教学设定）
① 新位置查向量（只查 1 行，省去位置 0、1 的重复计算）：
  输入位置 2（编号 3「猫」）→ 查 E[3] → x₂ = [0.7, 0.2, -0.4, 0.9]（形状 [1, 4]）

② 读 KV cache 算注意力与 MLP（教学设定）：
  从本层 KV cache 直接读出位置 0、1 的 k₀, k₁ 与 v₀, v₁，算完位置 2 的 k₂, v₂ 后追加进缓存（缓存增至 3 个位置）
  经注意力汇总得 attn₂ = [0.3, -0.2, -0.6, 0.1]，本层 MLP 加工量 m₂ = [-2.0, -1.0, -1.0, 1.0]
  残差相加得位置 2 的最终隐藏向量：
  h₂ = x₂ + attn₂ + m₂
     = [0.7, 0.2, -0.4, 0.9] + [0.3, -0.2, -0.6, 0.1] + [-2.0, -1.0, -1.0, 1.0]
     = [-1.0, -1.0, -2.0, 2.0]

③ 沿用第 3 件事同一张 W_head（6 列不变）与 h₂ = [-1.0, -1.0, -2.0, 2.0] 逐列做点积：
  0 号「我」  列 [ 0.2, -0.4,  0.6,  0.1] → (-1.0)×0.2  + (-1.0)×(-0.4) + (-2.0)×0.6  + 2.0×0.1    = -0.8
  1 号「你」  列 [ 0.1,  0.2,  0.3, -0.2] → (-1.0)×0.1  + (-1.0)×0.2    + (-2.0)×0.3  + 2.0×(-0.2) = -1.3
  2 号「喜欢」列 [-0.2,  0.4,  0.0,  0.1] → (-1.0)×(-0.2)+ (-1.0)×0.4   + (-2.0)×0.0  + 2.0×0.1    =  0.0
  3 号「猫」  列 [ 0.6,  0.2, -0.4,  0.5] → (-1.0)×0.6  + (-1.0)×0.2    + (-2.0)×(-0.4)+ 2.0×0.5   =  1.0
  4 号「看」  列 [ 0.4,  0.2,  0.1,  0.2] → (-1.0)×0.4  + (-1.0)×0.2    + (-2.0)×0.1  + 2.0×0.2    = -0.4
  5 号「。」  列 [ 0.0, -0.2, -0.3,  0.4] → (-1.0)×0.0  + (-1.0)×(-0.2) + (-2.0)×(-0.3)+ 2.0×0.4   =  1.6  ← 最高分！
  整排词表分数 logits₂ = [-0.8, -1.3, 0.0, 1.0, -0.4, 1.6] → 贪心采样选出编号 5（对应「。」）

④ 检查停止条件并还原文字：
  已生成词数 = 2 == max_tokens (2)，命中长度上限停止条件，请求标记完成！
  5 号「。」是普通标点 token（非停止符）→ 反分词还原出文字 "。"，拼上首轮输出完整返回 "猫。"
> 整条请求共走 2 轮前向：第 1 轮算 2 行产出「猫」，第 2 轮靠 KV cache 只算 1 行产出「。」
```

算完上面这笔账，还能顺便看清一个经常在监控指标里遇到的细节（详见 [kv-cache](kv-cache.md#已生成的-token为何还可能没有自己的缓存)）：第 2 个输出词 `5 号「。」` 在第 2 轮末尾刚被采样出来就触发了停止条件，根本不会再有第 3 轮把它作为输入送进模型。因此当 `"我喜欢猫。"`（共 4 个词）生成完毕时，经过前向计算并在 `KV cache` 里留下历史状态的只有位置 0、1、2 **共 3 个位置**，比整段文本的词数少 1 个。

## 这四件事在硬件上怎么分地盘：Host CPU — HBM 显存 — AI Core

**把上面的“两轮四件事”放到一台真实的昇腾服务器上跑起来时，并不是全部挤在同一个芯片里完成的，而是由主机侧的 Host CPU、NPU 卡上的 HBM 显存和 NPU 内部的计算核心 AI Core 三块地盘接力配合。**

如果用一家工厂打比方，Host CPU 是接单调度和打包发货的前台，HBM 显存（参见 [设备显存与主机内存](device-memory.md)）是紧挨着车间的原料与半成品仓库，AI Core（参见 [AI Core](ai-core.md)）则是真正开动机器做矩阵乘法的生产车间：

| 硬件地盘 | 角色比喻 | 承接“两轮四件事”中的哪些工作 | 为什么会成为性能瓶颈（后续章节预告） |
|---|---|---|---|
| **Host CPU** | 前台与调度员 | 第 1 件事的对话模板渲染、分词切号与长度/词表越界校验；每轮开算前决定把哪些位置送进 NPU；第 4 件事的 `check_stop` 停止检查与反分词还原 | 不参与大矩阵乘；当并发请求多或 CPU 切词、拼装输入慢时，会让 NPU 计算核心空等下一批指令 |
| **HBM 显存** | NPU 上的高速仓库 | 常驻存放嵌入表 `E`、各层注意力与 MLP 权重、输出头 `W_head`；第 2 件事按层追加写入 `KV cache`，第 2 轮从中读出历史 `k₀, k₁, v₀, v₁` | 容量直接卡死能同时服务多少条请求；Decode 每轮只算 1 个新位置，却要把整份层权重和历史 KV 从 HBM 搬进车间，极易卡在 HBM 带宽上 |
| **AI Core** | NPU 计算车间 | 执行第 2 件事的注意力点积、Softmax、MLP 矩阵乘与向量归约，以及第 3 件事的 `lm_head` 词表打分和采样选号 | Prefill 一次算整段提示词，乘加单元容易吃满（算力受限）；Decode 每次只算 1 个新位置，算得飞快但常在等 HBM 把权重和 KV 搬进来（带宽受限） |

带着这张三地盘分工图，你就能立刻听懂后面第 3、4 章反复出现的一个核心判断：**Prefill 和 Decode 跑的是同一套权重，但 Prefill 一次算整段输入、重点拼 AI Core 算力，Decode 每轮只算 1 个新位置却要搬整套权重和全部历史 `KV cache`、重点卡在 HBM 显存带宽。**

## 接下来怎么读：按目录分章从单卡积木走到双机实战

**看懂了“两轮与四件事”的算术闭环和三块硬件地盘的分工，你就已经拿到了整座知识库的地图；接下来可以按知识库目录顺序，先看模型目录、再拆单层积木和两轮缓存，最后进入双机真实案例。**

为了避免还没认全基础积木就被多机并行和混合模型术语淹没，建议按下面四步循序阅读：

| 阅读阶段 | 对应章节与页面 | 你在这一步要解决的核心问题 |
|---|---|---|
| 1. 认清昇腾上线路径与模型文件 | 第 1 章 全景入门与新模型上线：[昇腾新模型上线总览](ascend-model-onboarding.md) → [读懂 HF 模型目录](hf-model-anatomy.md) | 一个新模型在昇腾上怎样跑通、哪些型号受支持？下载权重前怎样从 `config.json` 算出总参数、激活参数和 KV 显存？ |
| 2. 拆解单层与首尾基础积木 | 第 2 章 标准模型单层计算与多模态输入：[token](token.md) → [embedding](embedding.md) → [layers-and-hidden](layers-and-hidden.md) → [attention-qkv](attention-qkv.md) → [mlp-residual-norm](mlp-residual-norm.md) → [lm_head](lm-head.md) | 真实分词器怎样切词？一层的 Attention、GQA、MLP 和 `lm_head` 在标准模型上具体怎样算、占多少显存？ |
| 3. 拆解两轮循环、缓存与采样 | 第 3 章 单实例调度、分页 KV 缓存与注意力状态变体：[Prefill 与 Decode](prefill.md) → [kv-cache](kv-cache.md) → [sampling](sampling.md) | 为什么 Prefill 算得快却费算力、Decode 算得少却卡在 HBM 带宽？`KV cache` 怎样分页分配、分数怎样变成概率并抽签？ |
| 4. 进阶双机真实全案 | 第 7 章 GLM 全案：[双机 16 卡部署](glm-5-3-flash-two-node.md) → [一条请求走完七站](one-request.md#一条请求要走过七站) → [多条请求同时跑](concurrent-requests.md) | 当词表放大到十几万、层数增加到几十层并切到 16 张卡上时，同一条历史绑定算例 `R1` 请求在每一站占多少字节、通多少信？ |

当你读完前三步、再翻开第 7 章 GLM 全案的 [一条请求走完七站](one-request.md#一条请求要走过七站) 时，会发现那里的“七站”和“三圈”并不是另一套陌生机制，只是把本页的“两轮与四件事”放进了真实的双机进程、缓存块表和投机解码里（第 1–4 章按 `v0.30.0` 标准主基线讲解，第 7 章 GLM 全案则保持其审定的双机历史绑定算例标尺，互不混套）。

## 常见误解

- **“Prefill 只负责把提示词算完存进缓存，第 1 个输出词要等第 1 步 Decode 才能算出来。”** 错。Prefill 走完最后一层时，提示词最后一个位置的隐藏向量 `h₁` 已经融合了整句提示词的信息；拿它乘 `lm_head` 并采样，当场就能拿到第 1 个输出词（如本例的 `3 号「猫」`）。第 1 步 Decode 送进模型的已经是这第 1 个输出词，用来生成第 2 个输出词。
- **“中文在模型里就是一个汉字对应一个 token，向量里的数就是词编号本身。”** 错。本页“1 字/词、6 词词表、4 个小数”只是为了方便手算人为设定的教学例子；真实分词器按统计词频切分，一个 token 可以是一个词、一个字，也可以是半个生僻字或几个字节，而向量则是训练出来的数千维浮点数（详见 [token](token.md) 与 [embedding](embedding.md)）。
- **“既然每轮都要看完整句前文，第 2 轮就得把『我喜欢猫』3 个词一起重新送进模型。”** 错。因为前面的位置看不见后面的新词，位置 0「我」和位置 1「喜欢」在每一层的 `k` 和 `v` 跟第 1 轮完全一样，早就存进了 `KV cache`。第 2 轮只需送进新词「猫」1 个位置，直接从 `KV cache` 读出前文历史即可。
- **“采样就是挑 `lm_head` 分数最高的那一个词。”** 不一定。走贪心采样（`temperature = 0`），或者开启随机采样但把候选集收窄到 1 项（如 `top_k = 1`）时，才会落到最高分那一词；而在一般随机采样（`temperature > 0` 且保留多个候选）下，模型会把分数转成概率分布后按概率抽签，因此同一句提示词发两次能写出不同的回答（详见 [sampling](sampling.md)）。
- **“请求结束时，文本总共有几个 token，`KV cache` 里就存了几份历史状态。”** 在普通逐词生成里，触发停止条件的最后一个输出词（如本例的 `5 号「。」`）刚被采样出来就结束了，不再进入下一轮前向计算，因此缓存里有历史状态的位置数通常比最终文本总词数少 `1` 个（详见 [kv-cache](kv-cache.md#已生成的-token为何还可能没有自己的缓存)）。

## 对照源码

### 怎么开

本页讲的“切词查向量 → 逐层前向写读 `KV cache` → 取最后一行打分采样 → 停止检查与反分词还原”是 vLLM V1 引擎面向自回归生成模型（decoder-only）[S1]的默认生成主循环，启动在线服务或离线 `LLM.generate` 时自动运行，不需要额外开关。与第 3、4 件事直接相关的常用请求参数只有三个：

- `max_tokens`：控制最多生成多少个输出 token（本页教学例子设为 `2`）。
- `temperature` / `top_k` / `top_p`：控制第 3 件事从词表分数里选 token 编号时走贪心（`temperature = 0`）还是按概率抽签。
- `stop` / `stop_token_ids` / `ignore_eos`：控制第 4 件事遇到哪些词或结束符时停止循环。

### 版本差异

下表对照四套固定源码快照（`v0.23.0`、`v0.26.0rc`、`v0.30.0` 全站默认主基线、`main` 社区最新快照）在两轮四件事主循环上的真实对应与演进：

| 环节 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) | 对使用者意味着什么 |
|---|---|---|---|---|---|
| 1. 模板分词与词表上界校验 | `renderers/hf.py` 的 `safe_apply_chat_template` 将消息转为编号列表，`tokenizers/hf.py` 算 `max_token_id`，`InputProcessor._validate_model_input` 检查非空与越界 | `safe_apply_chat_template` 新增可选参数 `return_assistant_tokens_mask=False` | 保留 `return_assistant_tokens_mask: bool = False`[C2]，`tokenizers/hf.py` 仍以 `max(max_token_id, vocab_size)` 取上界[C3]，`input_processor.py` 在 `#L440-L545` 校验长度与编号上界[C4] | `renderers/hf.py` 已移除 `return_assistant_tokens_mask` 参数；`tokenizers/hf.py` 将上界修正为 `vocab_size - 1`（`vocab_size` 是计数而非最大编号），`input_processor.py` 行号移至 `#L573`/`#L620` | 进入调度器前文本已转为整数编号并完成越界拦截；`main` 修复了 `vocab_size` 差 1 的上界判定 |
| 2. 统一调度与 `KV cache` 复用 | `scheduler.py` 在 `L340-L351` 说明不设独立 Prefill/Decode 阶段切换，统一按 `num_computed_tokens` 追赶总长度 | 同一进度说明位于 `scheduler.py#L425-L436` | 同一进度说明位于 `scheduler.py#L561-L573`，统一按 `num_computed_tokens` 分配每轮新增 token[C7] | 同一进度说明位于 `scheduler.py#L721-L733` | 四版都按已算位置数复用历史 `KV cache`，Decode 每轮只算新增位置 |
| 3. 末位 `logits_indices` 与 `AscendLogitsProcessor` | `AscendLogitsProcessor` 在 `2c59ff10#L285-L341` 分出 `_get_logits` / `_get_logits_lmheadtp` / `_get_logits_normal` | `2ed6cbba#L285-L349` 拆出 `_apply_head` 钩子，默认打分与拼接路径相同 | `model_runner_v1.py#L1638-L1680` 以 `query_start_loc.gpu[1:num_reqs+1] - 1` 选末位行[C15]，`AscendLogitsProcessor._get_logits` 新增 `skip_gather` 与 `VocabParallelMode`（`PCP_X_TP`/`FINE_GRAINED`/`STANDARD`）分路[C17] | 原 `model_runner_v1.py` 已移除，改由 MRV2 `vllm_ascend/worker/v2/model_runner.py#L1185-L1202`（`lmhead-TP` 覆写分支；未启用时直接回落 `super().sample()`）按 `input_batch.logits_indices` 对齐填充后驱动 `compute_logits`[C24]；`vocab_parallel_embedding.py` 同逻辑移至 `#L503-L592` | 普通生成在 Prefill 完结当步直接由最后一行产出第 1 个输出 token；`main` 切到 MRV2 执行器路径 |
| 4. 停止检查与增量反分词 | `utils.py#L94-L130` 的 `check_stop` 检查 `min_tokens`、`eos_token_id`、`stop_token_ids`、`max_model_len`、`max_tokens` 与 `repetition_detection`[C25]；`Detokenizer` 在 `stop_terminated` 且 `include_stop_str_in_output=False` 时跳过末个停止 token 文本 | `utils.py#L94-L130` 延续同一停止检查（含 `min_tokens` 前置与 `repetition_detection`）[C26] 与增量反分词逻辑 | `utils.py#L94-L136` 执行 `check_stop`（四版均含 `repetition_detection`，`v0.30.0` 将 `min_tokens` 顺序移至 `eos_token_id`/`stop_token_ids`/长度上限之后）[C8]；`detokenizer.py#L96-L135` 执行 `BaseIncrementalDetokenizer.update`[C5] | 同 `v0.30.0` 顺序与检查项（四版均含 `repetition_detection`），`utils.py` 移至 `#L98-L140`[C27]、`detokenizer.py` 为 `#L98-L135` | 命中停止符或 `max_tokens` 的最后一个 token 当场停机，不再送入下一轮前向计算 |

### 源码位置

以 `v0.30.0`（`vllm@ced6857a` + `vllm-ascend@c09d3e20`）为基线按“两轮与四件事”顺序定位：

- **第 1 件事（模板分词、输入校验与查嵌入表）**：`vllm/renderers/hf.py` 的 `safe_apply_chat_template`（见上表）与 `vllm/tokenizers/hf.py`、`vllm/v1/engine/input_processor.py` 的 `_validate_prompt_len` / `_validate_model_input` 在进调度器前完成分词与长度/词表边界校验；模型入口调用 `VocabParallelEmbedding.forward`（`vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L575`）按编号查出初始向量[C9]。
- **第 2 件事（逐层 Attention / MLP 与写入读取 `KV cache`）**：`vllm/v1/engine/core.py` 的 `EngineCore.step`（`#L589-L620`）驱动每轮“调度 → 前向 → 采样 → 结果更新”[C6]；`Scheduler.schedule`（见上表）推进 `num_computed_tokens`；每层注意力通过 `vllm/model_executor/layers/attention/attention.py#L485-L530` 写入并读取 `KV cache`[C11]，配合 `layernorm.py`（`RMSNorm`）与 `activation.py`（`SiluAndMul`）完成归一化、MLP 激活与残差更新。
- **第 3 件事（取最后一行打分与采样）**：`vllm_ascend/worker/model_runner_v1.py`（`#L1638-L1680` 与 `#L2633-L2646`）在普通生成路径下用 `logits_indices` 只挑出每个完结提示词的最后一行隐藏向量（`sample_hidden_states = hidden_states[logits_indices]`），经 `ParallelLMHead`、`LogitsProcessor` 与 `AscendLogitsProcessor`（见上表）算出词表分数，再由 `Sampler.sample`（`vllm/v1/sample/sampler.py#L244-L304`）执行贪心或温度概率采样[C14]。
- **第 4 件事（停止条件检查与反分词还原）**：`vllm/v1/core/sched/utils.py` 的 `check_stop`（见上表）依次检查 `eos_token_id`、`stop_token_ids`、`max_model_len`、`max_tokens`、`min_tokens` 与 `repetition_detection`；输出侧 `BaseIncrementalDetokenizer.update`（见上表）将新生成的编号增量还原为文本。

数值出处与核验范围：正文的 6 词小词表 `E`（与 `embedding.md` 完全一致）、1 字/词切分、4 维向量小数、注意力与 MLP 示意数，以及 `lm_head` 的 6 列权重 `W_head`（其中「猫」列 `[0.6, 0.2, -0.4, 0.5]`、「我」列 `[0.2, -0.4, 0.6, 0.1]` 与 `lm-head.md` 完全一致）均为方便手算的教学人为设定[A]，提示词 `"我喜欢"`、`temperature = 0` 与 `max_tokens = 2` 同样为教学请求假设[A]，Host CPU / HBM 显存 / AI Core 的工厂比喻与三地盘概括由前述执行与存储边界归纳得出[I]；首轮隐藏向量 `h₁`、词表分数 `[-0.4, -0.5, 0.2, 2.1, 0.8, 1.0]` 与 `52.3% / 17.4% / 14.3%` 概率由四则运算与 `softmax` 直接推导[D]，第 2 轮分数 `[-0.8, -1.3, 0.0, 1.0, -0.4, 1.6]` 由同一张 `W_head` 与 `h₂ = [-1.0, -1.0, -2.0, 2.0]` 逐列点积复算得出[D]，请求完结时 `KV cache` 存有 `3` 个历史位置（比整段文本 `4` 个词少 `1` 个）由末个输出词当场触发停止不再进入下一轮前向推导得出[D]；`v0.23.0` / `v0.26.0rc` / `v0.30.0` / `main` 四版行号与行为差异均已对照本地钉住 commit 源码仓静态核实，不代表实机 NPU 时延实测[A]。
