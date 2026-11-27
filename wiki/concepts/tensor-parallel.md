---
id: tensor-parallel
title: Tensor Parallel：一台机器的 8 张卡怎样合算一层
type: feature
legacyAnchors:
  放到-glm-双机一个-token-走过一层: 双机-16-卡混合层对照tp8-在-kda稀疏-mla-与-moe-中怎样分工
  异构旗舰对照glm-双机-tp8-分工: 双机-16-卡混合层对照tp8-在-kda稀疏-mla-与-moe-中怎样分工
summary: 把同一层的矩阵分给多张卡：先列切，各卡算出完整数值的几列；本地激活后接行切，最后一次求和合齐结果。先用标准 Qwen3-8B TP=2 与 Qwen3-30B-A3B KV 复制拐点讲清通用规律，再对照 GLM 双机 TP8 通信与显存账。
aliases:
  - 张量并行
  - Tensor Parallel
  - TP
  - tensor_parallel_size
  - '--tensor-parallel-size'
  - tensor-parallel-size
  - ColumnParallelLinear
  - RowParallelLinear
  - 列并行
  - 行并行
  - QKVParallelLinear
  - MergedColumnParallelLinear
  - VocabParallelEmbedding
  - 负扩展
chapters:
  - '04'
order: 10
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1749-L1772'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L407-L454'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L575-L589'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1389-L1444'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1537-L1558'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1478'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L323-L341'
  - 'vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L87'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L226
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L31'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1905-L1963'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1277-L1313'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L67-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L663-L670'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L159-L167'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L208-L290'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L448-L469'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L543-L555'
  - 'vllm@0fc695fc:vllm/config/model.py#L1184-L1195'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L110-L117'
  - 'vllm@568afb3a:vllm/config/parallel.py#L118-L125'
  - 'vllm@ced6857a:vllm/config/parallel.py#L120-L130'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L739'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/linear_op.py#L497-L521'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/linear_op.py#L406-L460'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L272-L371'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L168-L195'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L182-L230'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L84-L95'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L252'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L320-L320'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1349-L1352'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L577'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L117-L149'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L625-L641'
  - >-
    raw:sha256-196c004bd490c7f7e4c9c4e9d53b98c099e30b563845639542017f81ec8ad131.md#L1-L1466
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L465-L474'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L970-L976'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L487-L492'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1013-L1015'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L1093-L1098'
  - 'vllm@ba15685a:vllm/config/parallel.py#L146-L155'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L1217-L1222'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/linear_op.py#L156-L261'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/kimi_k3.py#L687-L712'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/linear_op.py#L403-L455'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L300-L335'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/attention.py#L193-L238'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/kimi_k3/kimi_k3.py#L795-L815'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L1045-L1060'
  - 'vllm@ced6857a:vllm/config/model.py#L1530-L1551'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/linear.py#L107-L125'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1437-L1443'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L856-L884'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L294-L703
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L950
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L105-L125'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen2.py#L90-L110'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L1765-L1782'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5884-L5931'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L319'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: column 和 row 分别切矩阵乘的输出维和输入维
  - to: gqa
    kind: builds-on
    note: 查询头与 KV 头分组后，TP 大于 KV 头数时按副本数跨卡复制
  - to: mla
    kind: builds-on
    note: MLA 的共享潜向量解释了为什么未开 DCP 时 KV cache 在 TP 内复制
  - to: linear-attention
    kind: builds-on
    note: KDA 各头的递归状态随头切分，更新规则见该页
  - to: collective-communication
    kind: builds-on
    note: All-Reduce 求和与 All-Gather 拼接决定分片怎样合并
contradicts: []
updated: '2026-11-23'
origin: gap
rawSources:
  - >-
    raw/sha256-196c004bd490c7f7e4c9c4e9d53b98c099e30b563845639542017f81ec8ad131.md
  - >-
    raw/sha256-d152d676c26ebc16ca54680c89192812c8f7b302108fa408d8ae747b866d5309.md
  - >-
    raw/sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md
---

## 一张卡算不动一层时怎么办

**tensor parallel（TP，张量并行）把同一层里的一次大矩阵乘切给几张卡：每张卡只存权重的一片、只算结果的一部分，几张卡同时算，最后通过卡间通信把各自的部分合成完整结果。**

先说它切的是什么。模型每一层的主要计算是矩阵乘 $Y = X \cdot W$：$X$ 的每一行是一个 token（分词后的一小段文本）此刻的向量；$W$ 是训练好、推理时只读的权重表，形状写作 `[输入维, 输出维]`；$Y$ 里的每个数，都是 $X$ 的一行和 $W$ 的一列对应位置相乘、再全部相加得到的。一个输出数怎样一步步算出来，见[矩阵乘和权重](matmul-and-weights.md#输出里的一个数是怎么算出来的)的演算。全页的图和正文都用这种写法：**按列切就是沿输出维切，按行切就是沿输入维切**；源码里权重按转置存放，放在“对照源码”说明。

一次矩阵乘本来就能拆成很多份小活。输出的一行有几个数，就有几道互不相干的算式；每道算式又是一串乘积相加。所以把 $W$ 分给两张卡，有两种自然的分工：

- **按输出分**：卡 0 负责输出的前一半数，卡 1 负责后一半。每张卡只要 $W$ 里对应的那几列，算出来的数各自都是最终值，只是每张卡只有一半，最后**拼起来**。这叫按列切。
- **按加数分**：每道算式的那串乘积，卡 0 做前一半，卡 1 做后一半，各自先加出一个小计。每张卡只要 $W$ 的一半行，但手里的每个数都只是小计，最后要把两张卡的小计**加起来**。这叫按行切。

两种分工都让每张卡只存一半权重、只做一半乘法，区别在算完以后是拼还是加。模型里这两种切法成对使用：先按列切，再按行切，中间的激活函数（夹在两次矩阵乘之间、对每个数单独做的一次变换，后面细讲）留在本卡算，一对矩阵只在末尾通信一次。下面先用具体的数把两种切法各算一遍，再看为什么要这样配对。

**为什么要切？一是放不下，二是希望分摊计算和读权重的工作。** 在权重常驻设备显存的示意中，一张卡的显存是 32 GB，模型权重一共 48 GB，一张卡装不下；若所画权重都可均分，切给两张卡，每张只存 24 GB，还能腾出地方放计算的中间结果和历史缓存。对选中的稠密矩阵，在相同输入工作量、权重各读取一次的理想预算下，每卡负责的权重字节和矩阵乘工作量都减半；一次只算几行时，这提供了分摊权重读取的机会（见[矩阵乘和权重](matmul-and-weights.md#同一片权重为什么能处理多行输入)）。实际 HBM 读取量还取决于缓存命中、分块复用和重复读取，整层耗时还包含通信与等待；容量减半不能直接推出读写时间减半或请求一定更快。

**切开的只是能切的部分。** 只有被切开的矩阵才缩到每卡 $1/N$（$N$ 是一起切的卡数）；有些小矩阵或共享潜向量每张卡仍各留一整份，这叫 replicated（复制），不会因为 TP 变小。所以多卡 TP 不等于每张卡的显存用量严格除以 $N$。

**代价是通信和等待。** 每张卡手里只有结果的一部分，算到需要完整结果的地方，就得停下来和其他卡交换数据，等齐了再往下算。这笔代价有多大，见[切开以后要付的代价](#切开以后要付的代价)。

## 两种切法各算一遍：拼起来，还是加起来？

用一个最小的例子（数为示意，算式是真的）。输入 $x$ 只有 1 行 2 个数：$x = [1, 2]$。权重 $W_1$ 有 2 行 4 列，第 1 行是 $[1, 3, -1, 2]$，第 2 行是 $[2, -1, 2, -2]$。一张卡自己算时，输出的 4 个数各是 $x$ 和 $W_1$ 一列的点积：第 1 个数 $1\times 1 + 2\times 2 = 5$，第 2 个数 $1\times 3 + 2\times(-1) = 1$，第 3 个数 $1\times(-1) + 2\times 2 = 3$，第 4 个数 $1\times 2 + 2\times(-2) = -2$，所以 $x \cdot W_1 = [5, 1, 3, -2]$。下面把同一个乘法交给两张卡，各用一种切法：

```wiki-diagram
file: tensor-parallel-two-splits
```

**按列切：每张卡算出几个完整的数。** 卡 0 拿 $W_1$ 的第 1、2 列，卡 1 拿第 3、4 列，两张卡都拿到完整的 $x$。卡 0 算出 $[5, 1]$，卡 1 算出 $[3, -2]$，和单卡算的一模一样：一列的点积要用的两个输入数和两个权重，都在同一张卡上。每张卡缺的只是形状，4 个数里只有 2 个。**数值完整，形状不全。** 如果下一步要在一张卡上用整行，就把两段按卡号拼起来，这个通信操作叫 [All-Gather](collective-communication.md#all-gather)：每张卡把自己那段发给其他卡，大家都收齐整份，中间不做加法。

**按行切：每张卡算出一份部分和。** 卡 0 拿 $W_1$ 的第 1 行，卡 1 拿第 2 行。权重的行和输入的数一一配对，所以卡 0 只用 $x$ 的第 1 个数 1，卡 1 只用第 2 个数 2：卡 0 算出 $1 \times [1, 3, -1, 2] = [1, 3, -1, 2]$，卡 1 算出 $2 \times [2, -1, 2, -2] = [4, -2, 4, -4]$。每张卡都有 4 个数，形状和最终结果一样，但每个数只有那道算式的一半：第 1 个数本应是 $1\times 1 + 2\times 2$，卡 0 只有 $1\times 1 = 1$，卡 1 只有 $2\times 2 = 4$。只加了一部分项的结果叫**部分和**。**形状完整，数值只是部分和。** 两张卡把对应位置相加才得到真值；让每张卡都拿到这个和的通信操作叫 [All-Reduce](collective-communication.md#all-reduce)，它每一步怎样收发数据，见集合通信那一页的演示。用分块矩阵写成一行代数恒等式就是：

$$x W_1 = \bigl[\,x W_{1,(:,0:2)},\; x W_{1,(:,2:4)}\,\bigr]_{\text{All-Gather}} = x_1 W_{1,(0,:)} + x_2 W_{1,(1,:)}\;\text{（All-Reduce 求和）}$$

| 切法（同一个 $x \cdot W_1$，数为示意） | 卡 0 本卡计算 | 卡 1 本卡计算 | 跨卡合并方式与还原结果 |
| --- | --- | --- | --- |
| **按列切**（沿输出维切） | 第 1、2 列：$[1\times 1 + 2\times 2,\; 1\times 3 + 2\times(-1)] = [5, 1]$ | 第 3、4 列：$[1\times(-1) + 2\times 2,\; 1\times 2 + 2\times(-2)] = [3, -2]$ | **All-Gather 拼接**：$[5, 1]$ 接 $[3, -2] = [5, 1, 3, -2]$（每段本身就是真值） |
| **按行切**（沿输入维切） | 第 1 行配 $x$ 的 $1$：$1 \times [1, 3, -1, 2] = [1, 3, -1, 2]$ | 第 2 行配 $x$ 的 $2$：$2 \times [2, -1, 2, -2] = [4, -2, 4, -4]$ | **All-Reduce 相加**：$[1+4,\; 3-2,\; -1+4,\; 2-4] = [5, 1, 3, -2]$（少加一张卡就错） |

**一张卡手里的结果能不能直接往下用，就看这两条。** 按列切的数每个都对，只是不全，后面的计算只要用得上这几个数，就能直接接着算，不必等别人。按行切的数形状齐全，却每个都还差别的卡那一份，不能直接用，也不能拿本卡的数乘卡数来凑：卡 0 的第 1 个数是 1，乘 2 得 2，真值却是 5。

**如果输出还带偏置，偏置也只能计入一次。** 偏置是矩阵乘之后额外加在输出上的一条向量。两张卡的部分和记作 $P_0$、$P_1$，正确输出是 $P_0 + P_1 + b$；若两张卡各自在部分和里加上完整偏置 $b$，再做求和，就会得到 $P_0 + P_1 + 2b$，多加了一份偏置。

按列切叫 **column parallel**，按行切叫 **row parallel**。前者分的是输出通道，后者分的是输入通道；通道就是向量里的一段维度，比如上面 4 个输出数里的第 1、2 个。真实模型里 $X$ 不止 1 行，而是这一步的一批 token；TP 切的是权重，不是 token 行，所以每张卡都要处理全部行，每一行只算自己那片权重负责的部分。

## 为什么总是先列切、再行切？

一层里最大的一块计算是 MLP（这里指前馈网络）：它对每个 token 的向量各算各的，先用 $W_1$ 把宽度撑大，过一个激活函数，再用 $W_2$ 缩回原来的宽度，写成 $Y = \varphi(X \cdot W_1) \cdot W_2$（结构见 [MLP、残差和归一化](mlp-residual-norm.md)）。激活函数 $\varphi$ 对每个数单独做一次非线性变换；示意里用最简单的 ReLU（负数变 `0`，正数不变）。现代主流模型常用的 SwiGLU 以 SiLU 为基础，只依赖同一通道的本地数值，同样非线性，下面的配对结论完全一致。

接着上一节的例子，再给一张 $W_2$（4 行 2 列，数为示意）：第 1 行 $[1, 0]$，第 2 行 $[2, 1]$，第 3 行 $[1, 1]$，第 4 行 $[1, 2]$。一张卡自己算：激活后 $\varphi([5, 1, 3, -2]) = [5, 1, 3, 0]$，再乘 $W_2$，得 $5\times[1, 0] + 1\times[2, 1] + 3\times[1, 1] + 0\times[1, 2] = [10, 4]$。换成两张卡，$W_1$ 按列切、$W_2$ 按行切：

```wiki-diagram
file: tensor-parallel-pair-calc
```

**① $W_1$ 按列切，不用通信。** 两张卡都拿完整的 $x$，卡 0 算出 $[5, 1]$，卡 1 算出 $[3, -2]$，都是真值。

**② 激活在本卡算，不用通信。** $\varphi$ 逐个数单独算，只需要这个数本身。卡 0 的 $[5, 1]$ 不变；卡 1 的 $[3, -2]$ 变成 $[3, 0]$。

**③ $W_2$ 按行切，正好接住本卡手上那几个数，也不用通信。** 卡 0 手里是激活结果的第 1、2 个数，就拿 $W_2$ 的第 1、2 行：$5\times[1, 0] + 1\times[2, 1] = [7, 1]$。卡 1 手里是第 3、4 个数，就拿第 3、4 行：$3\times[1, 1] + 0\times[1, 2] = [3, 3]$。两份都是形状完整的部分和。

**④ 末尾一次 All-Reduce。** $[7, 1] + [3, 3] = [10, 4]$，和单卡结果一样，两张卡都拿到它。把 $N$ 张卡的成对切分合写成一行公式就是：

$$Y = \varphi(X W_1) W_2 = \sum_{r=0}^{N-1} \varphi\!\bigl(X W_{1,r}^{\text{col}}\bigr) W_{2,r}^{\text{row}}$$

| 走读路径（数为示意） | ① 列切输出 | ② 本卡激活 $\varphi$（ReLU） | ③ 行切部分和（乘 $W_2$ 对应行） | ④ 末尾 All-Reduce 相加 |
| --- | --- | --- | --- | --- |
| **单卡对照** | $[5, 1, 3, -2]$ | $[5, 1, 3, 0]$ | $5[1,0] + 1[2,1] + 3[1,1] + 0[1,2]$ | **$[10, 4]$** |
| **卡 0**（前两通道） | $[5, 1]$ | $\varphi([5, 1]) = [5, 1]$ | $5\times[1, 0] + 1\times[2, 1] = [7, 1]$ | 与卡 1 相加：$[7, 1] + [3, 3] =$ **$[10, 4]$** |
| **卡 1**（后两通道） | $[3, -2]$ | $\varphi([3, -2]) = [3, 0]$ | $3\times[1, 1] + 0\times[1, 2] = [3, 3]$ | 同上（整对矩阵只在末尾通信一次） |

**列切的输出正好是行切需要的输入，所以中间一次通信都不用。** $W_1$ 按列切之后，如果下一步要的是整行，就得先 All-Gather 拼齐；这里省掉这次拼接，靠的正是紧接着的 $W_2$ 按行切：它只要本卡那几个数。激活函数逐个数计算，本卡就能做完，也不打断这条链。推广开说，只要夹在两个矩阵中间的计算能在各自的通道内完成，这种配对就成立。**一对矩阵只在末尾通信一次。**

**反过来先按行切，就要多通信一次。** 线性函数满足 $f(a + b) = f(a) + f(b)$，先加后算和先算后加结果一样；激活函数没有这个性质。若 $W_1$ 按行切，每张卡拿到的是部分和：卡 0 是 $[1, 3, -1, 2]$，卡 1 是 $[4, -2, 4, -4]$。看第 4 个数：真值是 $2 + (-4) = -2$，$\varphi(-2) = 0$；若两张卡各自先激活再相加，得 $\varphi(2) + \varphi(-4) = 2 + 0 = 2$，错了。换成 SiLU 也一样：$\text{SiLU}(2) + \text{SiLU}(-4) \approx 1.69$，而 $\text{SiLU}(-2) \approx -0.24$。所以必须先做一次 All-Reduce 把数值合齐再激活，这一对矩阵就多了一次激活前的通信。先按列切拿到数值完整的几列，激活就能在本地做，再接行切，一对矩阵只在末尾通信一次。

卡多了也一样。下图把同一对矩阵画成 $N$ 张卡：每张卡拿同一份 $X$，拿第一个矩阵的一条竖条（几列）和第二个矩阵对应的一条横条（几行），中间的激活在本卡做，末尾一次 All-Reduce，每张卡都得到完整的 $Y$。

```wiki-diagram
file: tensor-parallel-intuition
```

## attention 和词表也照这两种切法

### attention：每张卡拿几个完整的头

attention（注意力）让每个位置按相关程度，从前文各个位置取信息，怎么算见 [attention](attention-qkv.md)。它的输入先乘三个投影矩阵，得到 q（query，用来查询）、k（key，供查询匹配）和 v（value，要取走的内容）。多头（multi-head）attention 把这些向量按维度分成若干组，每组叫一个头（head）；每个头各做一遍 attention，彼此不交换数据。最后把各头的结果并排接起来，乘一个输出投影矩阵，回到原来的宽度。

这和 MLP 是同一个套路，只是中间那段本地计算从激活函数换成了每个头自己的 attention：

- **q、k、v 投影按列切，按头分**：每张卡拿走整数个头对应的那几列，算出的是这几个头完整的 q、k、v。
- **每个头的 attention 在本卡算完**：一个头只用自己的 q、k、v，用不到别的卡上的头，所以不用通信。
- **输出投影按行切**：每张卡只拿自己那几个头对应的几行，算出一份形状完整的部分和，最后一次 All-Reduce，和 MLP 例子里的第 ③④ 步完全同理。

示意：hidden（层与层之间传递的向量）宽 `8`，`4` 个头、每头 `2` 维，交给 `2` 张卡。q 投影是 `[8, 8]`：卡 0 拿第 `1–4` 列（头 1、头 2），卡 1 拿第 `5–8` 列（头 3、头 4），k、v 投影同样切。每张卡用完整的 `8` 维输入算出自己 `2` 个头，在本卡做完 attention，得到 `2 × 2 = 4` 个数；输出投影也是 `[8, 8]`，卡 0 拿第 `1–4` 行，卡 1 拿第 `5–8` 行，各乘出 `8` 个数的部分和，最后做一次 All-Reduce。

**查询头数必须能被卡数整除**：`4` 个头分 `2` 张卡正好，分 `3` 张卡就分不匀，vLLM 启动时会直接报错（见[会报什么错](#会报什么错)）。

> **边界与例外（GQA 的 KV 头复制拐点）**：若模型采用 [GQA](gqa.md#张量并行时kv-头不够分就要复制)（多个查询头共读一组 K、V），当 `TP <= n_kv` 时 KV 头按卡等分。一旦 `TP > n_kv` 且能整除，每张卡保底驻留 `1` 个 KV 头，按 `num_kv_head_replicas = TP // n_kv` 跨卡复制同一份 KV；此后单卡 KV cache 便不再随 TP 继续缩小。

### 词表：查表后相加，打分后拼接

模型的入口和出口也各有一张大表。入口的 embedding（嵌入）表每行是一个词的向量，形状是 `[词表大小, hidden]`，按 token 编号查出一行，就是这个 token 的初始向量。出口的 `lm_head` 把最后的 hidden 向量乘成每个词的打分，形状是 `[hidden, 词表大小]`；这些打分叫 logits，采样从里面挑出下一个 token。词表常有十几万个词，这两张表都很大，TP 把它们都沿词表那一维切，每张卡负责一段连续的词编号。

示意：词表 8 个词，hidden 宽 2，两张卡；卡 0 管词 0–3，卡 1 管词 4–7。

- **入口：查表后相加。** token 编号 5 只在卡 1 的那段表里。卡 1 查出编号 5 那一行，比如 $[3, -1]$；卡 0 没有这一行，就交出 $[0, 0]$。一次 All-Reduce：$[0, 0] + [3, -1] = [3, -1]$，两张卡都拿到这个 token 的完整向量。查表相当于拿一个只在编号 5 的位置是 1、其余都是 0 的向量去乘整张表；沿词表切，切的正是这次乘法的输入维，也就是按行切，所以合并用加。
- **出口：打分后拼接。** 每张卡用同一个完整的 hidden 向量，只给自己那 4 个词打分，这 4 个分数已经是真值，相当于按列切。两张卡的分数按词编号拼起来，才是 8 个词的完整打分表，用 All-Gather（或只收到一张卡上的 Gather）完成。

## 切开以后要付的代价

**TP 省下每张卡的显存和计算，付出的是算到合并位置时，各卡都要停下来通信、等结果齐了再继续。** 这笔代价分三样看：次数、每次搬多少、等多久。

**次数：每对矩阵一次，普通稠密层一层两次。** 普通稠密模型的一层有两对这样的计算：attention 一对，MLP 一对。**每对末尾一次，所以完整一层两次 All-Reduce**，整次主干前向的归约次数就是层数的两倍。到了 MoE 层，路由专家另有派发与收回通信，后文异构对照节单独展开。

**每次搬多少：这批 token 的 hidden 向量，与权重多大无关。** 一次 All-Reduce 相加的是这对矩阵的输出：本步每个 token 一行、每行 hidden 宽。每张卡交给这次操作的数据量只取决于本步激活形状（BF16 是 16 位浮点格式，每个数占 2 B）：

$$\text{Payload}_{\text{All-Reduce}} = T \times H \times \text{bytes} \qquad \text{（权重矩阵多大不进这笔账）}$$

| 统计项（示意模型：40 层，hidden 宽 $H = 1024$，BF16 每数 2 B） | 计算式 | 结果 |
| --- | --- | --- |
| 每层 All-Reduce 次数 | attention 1 次 + MLP 1 次 | **2 次** |
| 40 层一次前向的次数 | $40 \times 2$ | **80 次** |
| 4 个 token 时每次逻辑载荷 | $4 \times 1024 \times 2\text{ B}$ | $8{,}192\text{ B} =$ **8 KiB** |
| 4000 个 token 时每次逻辑载荷 | $4000 \times 1024 \times 2\text{ B}$ | $8{,}192{,}000\text{ B} \approx$ **7.81 MiB** |

这里算的是每张卡交给操作的逻辑载荷；通信库实际怎么传，例如 ring 算法里 $N$ 张卡时每张卡要发出约 $2(N-1)/N$ 倍的载荷，见[集合通信的通信量](collective-communication.md#通信量里的-n-和-m-到底数什么)。两头各有代价：一次只算几个 token 时每次只搬几 KiB，但每次都要全组到齐才能往下走，几十上百次的固定开销累积起来；一次处理很长的提示词时，每次要搬几 MiB，字节本身就要花时间。

**等多久：每次合并都是一个集合点。** All-Reduce 要等组里每张卡都算完自己那份才能加，最慢的那张卡决定大家什么时候继续；每层两次，一次前向就要停几十上百次。所以 TP 组一般放在卡间互连最快的一台机器之内，跨机器的网络更慢，TP 跨机会让每一层的等待都变长。**卡越多，每张卡分到的计算越少，每层参与合并的卡却越多**，哪个档位最快要实测（多档容量比较见后文[三档比较](#固定卡数比较-tp4tp8tp16只缩小可切部分)）。

TP 分的是**同一次矩阵计算**；[DP（data parallel）](data-parallel.md) 分的是**不同请求或批次**；[EP（expert parallel）](expert-parallel.md) 分的是**完整专家**——专家是小前馈网络，输入要送到持有被选专家的卡。三者能同时使用：先把请求交给某个执行组，组内用 TP 合算矩阵，需要专家时再按 EP 找到相应的卡。

## 落到标准部署：Qwen3-8B 的 TP=2 与 Qwen3-30B-A3B 的 KV 复制拐点

先把前面的通用规律落到 `v0.30.0` 标准稠密标尺 **`Qwen3-8B`**（`36` 层、`H = 4096`、`32` 个 Q 头、`8` 个 KV 头、`head_dim = 128`、SwiGLU `I = 12288`、`BF16`）的 **`TP=2`** 两卡部署上。每一层完全对称，固定触发 **`2` 次** `All-Reduce`：

```wiki-diagram
file: tensor-parallel-forward-qwen3
```

| 子层（`Qwen3-8B`，`TP=2` 每卡视图） | 列切与本地计算 | 行切与通信边界 |
| --- | --- | --- |
| **GQA 自注意力块** | `QKVParallelLinear` 按头列切：每卡 **`16` Q 头 + `4` KV 头**（本地 `q_norm`/`k_norm` + RoPE + FlashAttn） | `RowParallelLinear` `o_proj` 输出 `[T, 4096]` 部分和 → **第 1 次 `All-Reduce`** |
| **SwiGLU 稠密前馈块** | `MergedColumnParallelLinear` 合并列切 `gate_up`：每卡输出 **`12,288` 维**（`6,144` gate + `6,144` up），本地 `SiluAndMul` 得 `[T, 6144]` | `RowParallelLinear` `down_proj` 输出 `[T, 4096]` 部分和 → **第 2 次 `All-Reduce`** |
| **整座 `36` 层主干合计** | 每卡权重分片各半（`BF16` 静态权重由 `~15.26 GiB` 分摊至每卡 `~7.63 GiB`） | 固定 **`2 × 36 = 72` 次** `All-Reduce`（层外词表入口与 `lm_head` 出口另计） |

**KV 头触底复制拐点：`Qwen3-30B-A3B` 从 `TP=4` 扩到 `TP=8`。** `Qwen3-30B-A3B` 有 `32` 个 Q 头，但只有 **`n_kv = 4`** 个 KV 头（`head_dim = 128`）。
- 在 **`TP=4`** 时，每张卡分到 `8` 个 Q 头和 **`1` 个 KV 头**（`4 ÷ 4 = 1`，零复制），每卡每块（`128` token）BF16 KV cache 为 `3 MiB`。
- 扩到 **`TP=8`** 时，`TP > n_kv`（`8 > 4`）：Q 头继续减半为每卡 `4` 个，但每张卡必须保底驻留 **`1` 个完整 KV 头**（每 `2` 张卡复制同一份 KV 头，`num_kv_head_replicas = 8 ÷ 4 = 2`）。单卡 KV cache 仍停在 `3 MiB/块`，不再随 TP 翻倍继续减半（完整推导见 [GQA 的 KV 头复制一节](gqa.md#张量并行时kv-头不够分就要复制)）。

```wiki-tool
tool: formula-ruler
mode: tp-shard-comm
model: qwen3-8b
title: 随文活体算例标尺 · TP 权重分片与归约通信载荷
summary: 调节 TP 并行度、权重精度与卡型，实时查看单卡分片权重 GiB、列切→行切每层 All-Reduce 次数与单步激活通信字节数。
```

### Ascend 910B3 实测：Qwen3-8B 从 TP=1 扩到 TP=8 为何出现负扩展？

纸面推演容易让人误以为“只要还留在单机 HCCS 内、也没触到 KV 复制拐点，加卡做 TP 就会越跑越快”。但在单卡与八卡 `Ascend 910B3`（`vllm-ascend v0.30.0`、`CANN 9.1.0`，完整真机数据与采集边界见 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)）上，固定 `u = 0.85`、`max_model_len = 32768` 将 `Qwen3-8B` 从 `TP=1` 一路扩到 `TP=8` 时，虽然总 KV 容量放大了 **`10.9×`**（`264k → 2.87M tokens`），服务态的 **`c=16` 吞吐与 `c=1` `TPOT` 却双双单调劣化**：

```wiki-diagram
file: tp-fig-910b3-negative-scaling
```

下表给出 `INFO` 干净态下的四档实测对账（每卡可见显存 `60.96 GiB`，`u=0.85` 预算 `51.81 GiB`；末列带 `*` 为基于 Eager 实测搬运率 `1.372 TB/s` 的条件外推，非 `FULL` 图已抓 kernel 实测）：

| `Qwen3-8B` 档位（`u=0.85`） | 权重 / 卡 | 每卡可用 KV | 总 KV 容量 (`tokens`) | 图显存 (`INFO` 耗时) | `c=1` TPOT (`ms`) | `c=16` TPOT (`ms`) | `c=16` 总吞吐 (`tok/s`) | 条件推断整池复制 (`ms`)* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **`TP=1`** | `15.29 GiB` | `36.29 GiB`（池 `36.28 GiB`） | `264,192` | `2.59 GiB` (`22s`) | **`78.54`** | `80.77` | **`195.28`** | `56.77*` |
| **`TP=2`** | `7.66 GiB` | `43.52 GiB` | `633,728` | `2.92 GiB` (`32s`) | **`87.12`** | `89.94` | `171.13` | `68.09*` |
| **`TP=4`** | `3.84 GiB` | `47.36 GiB` | `1,379,200` | `3.10 GiB` (`35s`) | **`90.57`** | `92.34` | `167.30` | `74.09*` |
| **`TP=8`** | `1.94 GiB` | `49.27 GiB` | `2,869,888` | `3.21 GiB` (`36s`) | **`94.42`** | `95.73` | **`160.38`** | `77.09*` |

对照独立微基准与源码路径，目前有两项核心**候选机制**与上述单调劣化吻合（线上服务态的通信重叠度、整池复制是否重放以及各项时延精确分摊，均仍待同配置线上设备时间线实测闭环）：

1. **多卡 TP 同步与通信开销（独立 `TP=4` 微基准已测得未重叠归约税，线上重叠与占比待实测）。** 在独立 `TP=4` HCCL 微基准中（`M=2048, K=4096→1024, N=4096`，`BF16` 输出 `[2048, 4096] = 16 MiB`），单个 `MatMulV3` 相比单卡仅从 `256.61 µs` 降至 `70.57 µs`（省约 **`186 µs`**），紧随其后的 `hcom_allReduce_` 耗时 **`522.66 ~ 525.10 µs`**，通信重叠在该微基准中测得为 **`0.0 µs`**（确认走机内 `HCCS`，聚合带宽 `17.71 ~ 17.74 GB/s`，通信矩阵 `0→1/2/3` 边样本 `17.63 ~ 17.93 GB/s`，单次 transit `25.17 MB`，详细微基准拆解见[集合通信页](collective-communication.md#ascend-910b3-真机标尺tp4-hccs-all-reduce-微基准与理论峰值落差)）。回到 `Qwen3-8B` 36 层主干源码，启用多卡 TP 时每批固定存在 **`36 × 2 = 72` 个**行并行归约位置（每层 `o_proj` 与 `down_proj` 各 1 处）。需要严守两项口径：第一，`0.0 µs` 重叠仅在独立 `16 MiB` 微基准中测得，线上服务态的通信重叠与实际归约占比尚待设备轨迹核实；第二，单 token Decode（`c=1`）单次归约载荷仅 `8 KiB`（`c=16` 为 `128 KiB`），既不能把 `16 MiB` 微基准的 `525.1 µs` 直接乘 `72` 算进单 token 账本，也不能给批内每个请求各算一遍 `72` 次。
2. **固定 `u=0.85` 下每卡本地 KV 池反增与整池连续化嫌疑（强条件假设）。** 单卡权重从 `15.29 GiB` 压到 `1.94 GiB` 后，自动显存预算把释放的空间全数回填进 KV 池：尽管每卡本地 KV 头从 `8` 减到 `1`，每卡物理块数却从 `2,064` 激增至 `22,421`，实测令**每卡本地 K+V 池容量反从 `36.28 GiB` 涨至 `49.27 GiB`**（`+35.8%`，同时图显存也随单层视图扩大从 `2.59` 涨至 `3.21 GiB`，见[显存预算页](kv-cache-memory-profiling.md#ascend-910b3-真机启动对账6096-gib-实测基数图显存逆向增长与-u090-捕获期-oom)）。普通 GQA 层默认采用页交错非连续布局（见[FlashAttention 页](ascend-flash-attention.md#实测劣化剖析页交错-kv-布局为何在-fia-内部触发整池连续化)）；线上日志确认单请求 Decode 走 `FULL` 图（`npu_fused_infer_attention_score.out`）。**若** `FULL` 图内重放同等整池连续化且保持 Eager 实测搬运率（`1.372 TB/s`），条件外推复制耗时将从 **`56.77 ms` 爬升至 `77.09 ms`**，与实测 `TPOT` 曲线的爬升斜率吻合。但必须明确：**线上 `FULL` 图是否发生整池复制、以及它在 `78.54 → 94.42 ms` 中占多大份额，目前均属待线上设备时间线验证的条件假设，而非已抓 `FULL` kernel 实测。**

阅读跨机实测时还需严守两条边界：第一，**单卡与八卡的 `TTFT` 口径不同，不可当成单变量 A/B**——单卡 `TP=1` 跑 `/v1/chat/completions`（`24 ~ 40` prompt tokens，取中位数，`c=1` `73.24 ms`），八卡 `TP=2/4/8` 跑 `/v1/completions`（平均 `262` prompt tokens，取均值，`c=1` `125.84 / 124.14 / 139.07 ms`，且八卡内部也不单调）；跨机对比应锚定稳态 128 步 `TPOT` 与 `c=16` 吞吐，八卡内部 `TP=2 → 4 → 8` 则严格同脚本同输入。第二，**TP 正收益边界取决于“节省的计算与权重访问时间 > 新增未重叠通信、同步与布局税”**：本次在 `c ≤ 16` 均未测出正收益交叉点，但“单卡装得下”本身不能推出所有超高并发或大上下文（必须靠 `2.87M` token 池避免抢占重算）负载也必然劣化。

## 双机 16 卡混合层对照：TP8 在 KDA、稀疏 MLA 与 MoE 中怎样分工

标准同构 GQA 模型每层结构相同；到了混合架构的 **GLM-5.3-Flash 双机算例**（固定快照 `vllm@0fc695fc + vllm-ascend@db701c1f`，`2×A2×8`、`TP8 / DP2 / EP16`、`W8A8` 8 位整数权重与激活量化，完整分组与前提见[双机部署页](glm-5-3-flash-two-node.md#部署前提)），单台机器 8 张卡组成一个 TP8 组，各子层的切分规则就出现了分化。

前面两张卡的小例子，在这里换成 8 张卡和真实宽度。**TP8 把每层稠密 MLP 的大矩阵分到 8 张卡，每卡保存其中的八分之一，并承担对应的矩阵乘工作量，权重主体为 18 MiB。** 这里的比例描述分片容量与逻辑工作量，实际 HBM 读取字节仍受算子实现和缓存复用影响。TP 管的是 attention 头投影、稠密 MLP、共享专家和词表；约 **290.25 GiB 的路由专家权重则交给 EP 分配**。分工与完整容量账见[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)，本页后面保留算式。

这发生在[一条请求的第 4 站：逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。请求已被调度，8 个 worker（每卡一个执行进程）已拿到同一批 token（分词后的整数编号）。跟着其中一个 token 看，它先查表得到 hidden，也就是在层与层之间传递的隐藏向量，再依次经过 attention 和 MLP。

**R1 是主线[一条请求](one-request.md)里跟踪的示例请求，提示词有 4 个 token。** 下面沿它看本卡的形状。hidden 宽 4096，$T$ 表示本次前向的新 token 行数；R1 的 prefill（第一次处理提示词）有 4 行，decode（接着历史往前算）验证 1 个已确定 token 和 3 个候选，也有 4 行。候选由 MTP（模型自带的草稿层，先猜后面的 token）提供。因此图和形状写的是整批 `[4,4096]`，其中每一行都沿同样的路径走。

### 先过 attention：各算自己的头，再合回 hidden

**attention 末尾一次 All-Reduce，每卡恢复完整 hidden。** attention 的头是一组能独立计算的通道。GLM 的两种 attention 各有 64 个头，TP8 后每卡负责 8 个。输入投影先生成本卡的头，本卡计算完，输出投影再把这些头对 hidden 的贡献变成部分和，交给这次归约。

前 3 层的 attention 都是 KDA：用每头的一份固定状态概括历史。R1 在每卡的头输出是 `[4,1024]`，输出投影给出 `[4,4096]` 部分和。遇到稀疏 MLA 层时，它从压缩的历史中挑位置读取，本卡 attention 结果为 `[4,8,512]`，再用每头的 V 展开矩阵把 512 维映射为 256 维，8 个头拼成 `[4,2048]`，再投影为 `[4,4096]` 部分和；这里同样只做一次 TP All-Reduce。两种层的特殊切法见后面的[特殊层一节](#glm-里几种特殊层的切法差别)。

GLM 用 **mHC 四路残差连接**传递层间信息：子层前把 4 条隐藏流合成 1 条，子层后把结果写回 4 条。入口混合、归一化、出口混合都在本卡完成，所以 TP 归约搬的是子层的 `[T,4096]`，没有再乘四路残差的 4。

### 再过稠密 MLP：本地升维和门控，降维后再合齐

**稠密 MLP 在本地完成升维和门控，降维后才做一次 All-Reduce。** 前 3 层的 MLP 中间宽度是 12288，每卡只算其中 1536 个通道。它先做 gate 和 up 两个投影，两者都把 4096 维输入变成 12288 维：gate 控制各通道通过多少，up 提供被控制的数值。每张卡同时拿 gate 的一段和 up 的同一段。

随后做 **SwiGLU**：gate 先过 SiLU 非线性函数，再与 up 逐项相乘；GLM 这版还会限制数值幅度。这些操作只用本地对应通道。降维投影接住本卡的 1536 维结果，算出的每个数只加了这 1536 项；把全部 12288 项加齐，才得到完整答案。

若行并行降维还带输出偏置，完整偏置只能计入一次：八卡各自在部分和中加入同一份完整偏置，再做求和，会把偏置累计八次。这是行并行求和的数学约束，不表示本部署启用了偏置。

下图中 rank 表示通信组成员的编号，$r$ 是本组的卡编号。

```wiki-diagram
file: tensor-parallel
```

这张图把前面两张卡的 ①–④ 放大到 **R1 的稠密 MLP**：column 输出直接进入 row 输入，中间省掉一次 All-Gather（把不同分片收集并拼接给所有成员）。只有降维后求和。权重仍按 `[输入维, 输出维]` 画，列切为竖条，行切为横条，与前面 $N$ 张卡的配对图一致。

**MLP 降维后，每卡都是 `[T,4096]`；八份相加才得到完整数值。** 本节只推演计算如何接起来，权重字节集中在显存一节（下式 $\odot$ 表示对应元素相乘，GLM 的幅度限制省略在符号里，通信位置不变）：

$$U_r = \text{SiLU}(\text{gate}_r) \odot \text{up}_r, \qquad Y = \sum_{r=0}^{7} U_r W_{\text{down},r} = P_0 + P_1 + P_2 + P_3 + P_4 + P_5 + P_6 + P_7$$

| 步骤 | 本卡运算与张量形状（$r = 0\text{–}7$） | 通信状态 |
| --- | --- | --- |
| ① 本卡升维（列切） | $X[T,4096] \times \text{gate\_up}_r[4096,3072] = [T,3072]$ | 无通信（产出完整 `1536 + 1536` 维） |
| ② 本卡门控（SwiGLU） | $\text{SiLU}(\text{gate}_r[T,1536]) \odot \text{up}_r[T,1536] = U_r[T,1536]$ | 无通信（逐通道本地计算） |
| ③ 本卡降维（行切） | $U_r[T,1536] \times \text{down}_r[1536,4096] = P_r[T,4096]$ | 无通信（得到 `[T,4096]` 部分和） |
| ④ 末尾归约合齐 | $P_0 + P_1 + P_2 + P_3 + P_4 + P_5 + P_6 + P_7 = Y[T,4096]$ | **1 次 TP8 All-Reduce** |

下图用 4 张卡示意同一次 down 投影（本部署每台机器是 8 张）：先沿输入通道把 X 的列和 W 的同号行切开落卡，各卡算出形状完整、数值不全的部分和，再用一次 All-Reduce 合齐，每卡都拿到完整结果。切分是布局说明，推理期间权重不随请求搬动。

```wiki-scene
parallel-mechanism:5
```

### 到 MoE 层：共享专家仍合一次，路由专家另走派发

**MoE 层的共享专家仍只合齐一次，路由专家另走 EP 派发和收回。** 后 42 层的 MLP 是 **MoE（Mixture of Experts）**：每个 token 选 8 个路由专家，同时经过一个所有 token 都用的共享专家。共享专家仍是一对 column / row 投影，中间宽度换成 2048，每卡算 256 个通道，最后也要合齐部分和。

路由专家按完整专家分配，每卡每层持有 18 个，内部矩阵不再按 TP8 切。token 被送到专家所在的卡，算完再返回。这是 EP16 的 dispatch（派发）和 combine（收回并组合），会跨机器；载荷推导见 [EP 页](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

R1 走 **MC2**，即昇腾把专家计算与通信协同执行的一类实现；大批输入走 **AllGather 路径**，先收集输入再算本地专家。下表的[场景 M](concurrent-requests.md)是混合批次：DP0 有 12 条 decode 和 1 条 6000 token 新请求，DP1 有 7 条 decode，后文单列其通信账。共享专家的降维都先给出部分和，**两条路互斥，归约位置互补，每个 MoE 层的前馈部分都只计一次 TP All-Reduce**：

| 路径 | 共享专家计算后 | MoE 外层收尾 | 每层前馈部分的 TP All-Reduce |
| --- | --- | --- | --- |
| MC2（R1） | 先归约共享结果，再与路由结果相加 | 直接返回，不通信 | 1 次 |
| AllGather 路径（大批输入，如场景 M） | 暂不归约，先与路由结果相加 | 对相加后的结果真正归约 | 1 次 |

至此，一个 token 走完了一层：先在 attention 末尾合齐，再在 MLP 或共享专家这段合齐。下面的流程图按真实调用先后画出分支；稠密与 MoE 二选一，MoE 的两栏再二选一。图中的 finalize 是恢复 token 行布局的收尾，router logits 是专家选择分数，Reduce-Scatter 是对应位置求和后按 token 分段交回各组。函数名和路径枚举的逐项对应放在“对照源码”。

```wiki-diagram
file: tensor-parallel-forward
```

### 从一层走到整次前向：R1 的通信账

**R1 一次主模型前向有 134 次 TP 集合操作，TP 逻辑载荷在 prefill 约 3.21 MiB、decode 约 3.32 MiB。** 主线[一次前向通信账](one-request.md#一次前向的通信账)的 **218 次**还包含 EP；这里拆出 TP。范围是 embedding（按 token 编号查隐藏向量）、45 层及 `lm_head`（把隐藏向量变成词表分数的输出投影），不含后续 MTP 草拟、调度元数据同步和采样通信。

两个步骤 $T$ 都是 4，因此 hidden 归约大小相同；区别在词表投影行数 $n$。每个候选词的分数叫 logits；prefill 只取提示词末尾 1 行，带 3 个草稿的 decode 取 4 个验证位置。一次集合操作由组内全体成员共同参与，不把它乘 8 当成额外 8 次。BF16 每数 2 B，FP32 每数 4 B，int8 每数 1 B；下表的 hidden 和 logits 按 BF16 计。

| 位置 | 次数 | R1 prefill | R1 decode：1 个确定 token + 3 个草稿 |
| --- | --- | --- | --- |
| embedding 后 All-Reduce | 1 | `[4,4096]`，32,768 B | 相同 |
| KDA 输出投影后 All-Reduce | 34 | 每次 32,768 B | 相同 |
| MLA 输出投影后 All-Reduce | 11 | 每次 32,768 B | 相同 |
| 稠密 MLP 降维后 All-Reduce | 3 | 每次 32,768 B | 相同 |
| 共享专家 All-Reduce | 42 | 每次 32,768 B | 相同 |
| MoE finalize 的 TP All-Gather | 42 | 每卡 `[1,4096]`，8,192 B | 相同 |
| `lm_head` 的 TP All-Gather | 1 | 本地 `[1,19360]`，38,720 B；拼后 309,760 B | 本地 `[4,19360]`，154,880 B；拼后 1,239,040 B |

**finalize 是恢复 token 行布局的收尾。** MC2 为避免组内重复派发，进入路由专家前把 4 行补齐成 8 行，每卡处理 1 行，后 4 张卡分到补齐行。返回后 All-Gather 拼成 `[8,4096]`，去掉补齐行，恢复 `[4,4096]`。共享专家直接处理完整的 4 行，路由专家权重仍按 EP 分布。

All-Reduce 的载荷指每卡输入张量大小，All-Gather 指每卡提供的本地分片，完整输出另列。**R1 共 91 次 All-Reduce；加上 42 次 finalize 和 1 次词表拼接，得到 134 次 TP 操作**（合计沿用各操作的输入/本地分片口径，便于复核；物理链路收发字节须按昇腾集合通信库 HCCL 算法另算）：

$$\text{TP}_{\text{ops}} = (1 + 34 + 11 + 3 + 42)_{\text{All-Reduce}} + 42_{\text{finalize AG}} + 1_{\text{logits AG}} = 91 + 42 + 1 = 134\text{ 次}$$

| R1 的 TP8 通信核算项（prefill 4 行，decode $1+3=4$ 行） | 算式 | 每卡逻辑载荷 / 完整输出 |
| --- | --- | --- |
| 单次 hidden 归约载荷 | $4 \times 4096 \times 2\text{ B}$ | $32{,}768\text{ B} =$ **32 KiB** |
| 91 次 All-Reduce 载荷合计 | $91 \times 32{,}768\text{ B}$ | $2{,}981{,}888\text{ B} \approx$ **2.84 MiB** |
| 42 次 finalize 本地分片合计（每卡 $\lceil 4 \div 8 \rceil = 1$ 行） | $42 \times 1 \times 4096 \times 2\text{ B}$ | **344,064 B** |
| prefill `lm_head` 分片与完整 logits | 本地 $1 \times 19360 \times 2\text{ B}$；完整 $\times 8$ | 本地 **38,720 B**；完整 **309,760 B** |
| decode `lm_head` 分片与完整 logits | 本地 $4 \times 19360 \times 2\text{ B}$；完整 $\times 8$ | 本地 **154,880 B**；完整 **1,239,040 B** |
| **prefill / decode TP 逻辑载荷合计** | $2{,}981{,}888 + 344{,}064 + (38{,}720 \text{ 或 } 154{,}880)$ | prefill $3{,}364{,}672\text{ B} \approx$ **3.21 MiB**；decode $3{,}480{,}832\text{ B} \approx$ **3.32 MiB** |

剩下 **84 次**是 42 个 MoE 层各一次 EP dispatch、一次 EP combine，和 134 次合起来就是主线的 218 次。32 KiB 是一次归约的每卡逻辑输入，HCCL（昇腾集合通信库）还会按算法让数据经历多轮传递或归约，链路实测的缺口集中列在页末。

## GLM 里几种特殊层的切法差别

### KDA：状态跟着头一起切

**KDA（Kimi Delta Attention）的头和递归状态一起切，低秩门的第一段仍复制。** 本模型 34 层 KDA，每头 128 维；每卡保存、更新自己的 8 份状态矩阵，无须交换状态，通信留在最后的输出投影。

输入生成 q（query，用来查询）、k（key，供查询匹配）和 v（value，要保存和读取的内容）。它们按头分片；门控先把输入压窄、再展开，这种用较窄中间表示连接两个投影的做法叫低秩投影。第一段每卡保留整份、各算一遍，叫 replicated；第二段才分头。因此 TP8 并不会让每个矩阵都缩小八倍。

R1 的 prefill 用分块计算建立状态，decode 接着更新，并按接受的候选数选择后续状态。两者最后都从本地 `[4,1024]` 投影到 `[4,4096]` 再归约；状态算法改变，TP 切分不变。更新规则见 [KDA](linear-attention.md)，投影明细放在“对照源码”，状态字节见后面的显存账。

### 稀疏 MLA：头投影切开，压缩历史逐卡复制

**11 层稀疏 MLA 切头投影，每卡却都保存完整的 512 维历史潜向量。** [MLA（Multi-head Latent Attention）](mla.md)把各头共用的历史压成低维表示，需要计算时再映射到各头；“稀疏”表示索引器先挑历史位置，attention 只读挑中的部分，机制见[模型页](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

本卡 8 个头都要使用完整的 512 维历史。因此模型先在每卡算出同一潜向量并写入本地 KV cache（保存历史中间结果的显存），后面的 q、kv 展开矩阵才按头切。64 个 Q 头分八份只影响头投影；要沿序列长度分摊历史缓存，需要另看 [context parallel](context-parallel.md)（如 decode context parallel，`DCP`）的适配，单改 TP 不会切开这里的 512 维 cache。下图把「成对切分省中间通信」与两类 KV 状态不再随 TP 缩小的边界（[GQA](gqa.md#张量并行时kv-头不够分就要复制) 头数触底复制与 MLA 共享潜向量逐卡复制）放在一起对比：

```wiki-diagram
file: tp-fig-kv-replication
```

### 词表：入口求和，出口拼接

**embedding 与 `lm_head` 都沿词表轴切，hidden 的 4096 维保持完整；合并方式不同。** 每卡负责连续的一段词编号，机制和前面 8 个词的[示意](#词表查表后相加打分后拼接)相同，这里换成真实宽度。

入口时，R1 的每个 token 编号都发给 8 张卡；只有拥有该编号的卡查到非零向量，其余卡把这一行置零。对 `[4,4096]` 做 All-Reduce 后，每卡都有 R1 的 4 条完整隐藏向量。切开的是权重表，输入行在每卡相同。

出口时，每卡根据同一隐藏向量算自己的 19360 个词的 logits。它们属于不同词，所以用 All-Gather 沿词表维拼成 154880 个分数，再交给采样。本部署走完整 logits 汇总，MTP 复用主模型的 `lm_head` 权重；选行到采样见[一条请求第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

### 共享专家：切法仍是列接行，归约由外层安排

**共享专家的特殊点是“何时归约”，并非改了 TP8 的分片规模。** 它和稠密 MLP 一样先列切、再行切；降维暂时留下部分和，由 MoE 实现选择在共享分支内部还是与路由结果相加后归约。

上面的两行路径表说明了为何每层只计一次。配置属性怎样传到投影、为什么这套部署的共享专家仍按 TP8 切，都在“对照源码”；共享与路由专家的整体关系见 [MoE](moe.md)。

## 场景 M：整批输入变大后，通信账怎样变

### 混合步：DP0 的 TP 载荷约 4.20 GiB

场景 M 是 DP0 的 12 条 decode 加 1 条 6000 token 新请求，DP1 有 7 条 decode。主线已算出 **DP0 本步 6048 行，DP1 有效输入 28 行**；capture size（图尺寸，预先捕获、可供回放的执行 token 宽度）、两组对齐及陪跑见[并发页](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

跟着 DP0 看一个稠密 MLP：各卡拿 `[6048,4096]`，算出 `[6048,3072]`，门控后留 `[6048,1536]`，降维给出 `[6048,4096]` 部分和。权重仍是 12 MiB 加 6 MiB，改变的是同一份权重一次乘了多少行。

MoE 通信由两组 token 数的最大值决定；6048 超过此配置的 **128** 门槛，两台一起走 AllGather 路径。先用 DP All-Gather 收集 hidden 和 router logits（专家选择分数），各卡算本地专家，再用 DP Reduce-Scatter（对应求和后按 token 分段交回各组）还原本组的路由结果。随后与共享专家部分和相加，做一次 TP All-Reduce。

**原先 42 次 TP finalize All-Gather 消失，整次前向留下 92 次 TP 操作；DP0 每卡逻辑载荷约 4.20 GiB。**

这 92 次以外，每个 MoE 层有 3 次 DP 集合操作，**整个主模型的逻辑集合操作仍是 218 次**，组别和数据量变了。跨机 MoE 字节数见[并发页](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)，本页 4.20 GiB 只数 DP0 每卡的 TP 载荷。

### 去掉新请求：回到纯 decode 的补齐宽度

去掉 6000 token 新请求时，两组纯 decode 最终都按 **64 行**执行，仍走 MC2；补齐过程见并发页同节。通信公式应代入实际进入算子的行数，**此时单次 hidden 归约为 512 KiB，每卡 finalize 分片为 64 KiB**：

| 场景 M 输入与路径 | 核算分项 | 算式与每卡结果 |
| --- | --- | --- |
| **混合步**（DP0 有 6048 行，走 AllGather 路径） | 单次 hidden 归约 | $6048 \times 4096 \times 2\text{ B} = 49{,}545{,}216\text{ B} =$ **47.25 MiB** |
| **混合步**（12 条 decode 各验 4 行 + 新请求末尾 1 行） | `lm_head` 本地分片（$12 \times 4 + 1 = 49$ 行） | $49 \times 19360 \times 2\text{ B} =$ **1,897,280 B** |
| **混合步**（91 次 All-Reduce + 1 次 logits All-Gather） | 92 次 TP 集合操作载荷合计 | $91 \times 49{,}545{,}216 + 1{,}897{,}280 = 4{,}510{,}511{,}936\text{ B} \approx$ **4.20 GiB** |
| **去掉新请求**（两组按 64 行执行，回到 MC2） | 单次 hidden 归约 | $64 \times 4096 \times 2\text{ B} = 524{,}288\text{ B} =$ **512 KiB** |
| **去掉新请求**（MC2 路径恢复 finalize） | 单次 finalize 本地分片 | $(64 \div 8) \times 4096 \times 2\text{ B} = 65{,}536\text{ B} =$ **64 KiB** |

## GLM 双机上 TP 能省多少显存

### 先区分：哪些权重归 TP，哪些已经由 EP 分走

仅路由专家的 int8 权重，连同 MTP，就约 **290.25 GiB**，超过教程标称的单卡 **64GB**；TP 和 EP 分工后，所列主要语言权重的每卡子账约 **20.58 GiB**，还需另计视觉塔、MTP 旋转矩阵和量化辅助张量等。统计范围及单机/双机比较见[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

**这笔容量下界说明需要多卡；路由专家由 EP 分配，TP 继续分摊稠密 MLP、头投影、共享专家和词表。**

### 稠密 MLP 与共享专家：每卡各留一段通道

**TP8 下，每卡每层稠密 MLP 的大矩阵为 18 MiB，一个共享专家的权重主体为 3 MiB。** 两者切法相同，区别在中间宽度；量化缩放系数另占少量显存。把它们与其他部件放在一起看，便能分清哪些随 TP 变小、哪些仍逐卡完整保留。

| 部件 | TP8 每卡用量 | 读这笔账时要注意什么 |
| --- | --- | --- |
| 稠密 MLP / 共享专家 | 每层 18 MiB / 3 MiB，int8 权重主体 | 只持有本卡那段通道；三张大矩阵都分片 |
| embedding / `lm_head` | 每张表 151.25 MiB，BF16 | 各保留一份词表分片；词表无需额外补齐 |
| KDA 状态 | 34 层一份有效状态约 18.2 MiB/请求；物理占用 85 MiB | 状态按头切，实际还要补页及保留投机位置 |
| MLA 主 KV / 索引 K | 主 KV 每 token 每层 1024 B；带 MTP 的 12 层合计 13,056 B/token | 潜向量与索引器逐卡复制，不能再除以 TP8 |

KDA 有效状态和物理占用的差额来自两步：先把每层的 **561,152 B 补到 655,360 B**，以匹配 MLA 物理页；再为 3 个投机位置多留 3 页，每层共 4 页。MLA 索引器则每 4 个位置压成一条索引 K。页大小、总数与分配规则见[部署页缓存预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

上表给出容量结论；全部权重算式保留在“对照源码”的“开销和什么时候别开”，状态、cache 和头维度放在“源码位置”合并核对。下面直接比较改变 TP 后整卡会怎样，避免把特殊层的切法再讲一遍。

### 固定卡数比较 TP4、TP8、TP16：只缩小可切部分

**头数允许三者，物理布局和容量账才构成取舍。** KDA 与 MLA 都有 64 个头，三档每卡分别是 16、8、4 个；稠密中间维、共享专家中间维及词表也都可整除。固定 16 卡与 EP16 时，路由专家（`18,576 MiB ≈ 18.14 GiB`）与逐卡复制项（`727.5 MiB ≈ 0.71 GiB`）纹丝不动，只有 TP 可切分权重随 TP 缩放：

```wiki-diagram
file: tp-fig-memory-scale-16card
```

**TP8 把逐层同步留在机内。** 机内走 HCCS（昇腾卡间高速互连），跨机走 RoCE（以太网上的远程直接内存访问网络），HCCL 使用这些链路组织通信。TP8 正好占满一台机器，R1 的 91 次 hidden 归约与其余 TP 汇总留在本机；TP16 必须跨两台，让每层等待路径包含跨机网络，收益要能覆盖增加的同步成本。

按部署页 `3121f187` 量化配方拆开三档容量账（固定 16 卡、保持 EP16，改变 TP 同步改变 DP 组数）：
- **固定底座（两项共 `19,303.5 MiB ≈ 18.85 GiB`）**：EP16 路由专家为 $43 \times 432\text{ MiB} = 18{,}576\text{ MiB}$；逐卡复制项为 $193.5 + 135 + 267 + 68 + 64 = 727.5\text{ MiB}$（依次为 router、mHC、MLA 低秩与索引器、KDA 低秩门、MTP 输入投影；不含视觉塔、旋转矩阵、量化辅助张量和运行时 FP32 副本，忽略 KiB 级小项）。
- **TP 可切分部分（TP8 下 `1,774.5 MiB ≈ 1.73 GiB`）**：由 TP8 总子账 $21{,}078 - 18{,}576 - 727.5$ 得来。由此三档语言模块子账分别约 **22.32、20.58、19.72 GiB**：

$$M_{\text{lang}}(\text{TP}) = 18{,}576\text{ MiB} + 727.5\text{ MiB} + 1{,}774.5\text{ MiB} \times \frac{8}{\text{TP}}$$

| 档位（固定 16 卡与 EP16） | 每卡 `[头数, 稠密通道, 共享通道, 词表行]`（由 `[64, 12288, 2048, 154880] ÷ TP`） | 所列语言权重每卡子账算式 | 折合 GiB |
| --- | --- | --- | --- |
| **TP4 / DP4 / EP16** | `[16, 3072, 512, 38720]` | $18{,}576 + 727.5 + 1{,}774.5 \times (8 \div 4) = 22{,}852.5\text{ MiB}$ | **22.32 GiB** |
| **TP8 / DP2 / EP16** | `[8, 1536, 256, 19360]` | $18{,}576 + 727.5 + 1{,}774.5 = 21{,}078\text{ MiB}$ | **20.58 GiB** |
| **TP16 / DP1 / EP16** | `[4, 768, 128, 9680]` | $18{,}576 + 727.5 + 1{,}774.5 \times (8 \div 16) = 20{,}190.75\text{ MiB}$ | **19.72 GiB** |

### 加载权重之外：每卡还会创建同样大的运行时副本

**索引器 FP32 副本约 54 MiB/卡，第一次前向时创建，不计入 KV 预算。** 索引器把 K 投影和压池门控各转一份 FP32 常驻副本；量 KV 预算的 profile run 跳过索引器，副本要到录图或真实请求时才出现。此外，昇腾在加载后处理权重（`process_weights_after_loading`）时还会把满足条件的线性层和专家权重转换为 `FRACTAL_NZ` 排布（`maybe_trans_nz`），转换期间会产生瞬时缓冲峰值。创建位置在页末来源，预算时序见[部署页](glm-5-3-flash-two-node.md#启动时发生了什么)。

**给上述子账加上这份副本，TP4、TP8、TP16 分别约 22.37、20.64、19.77 GiB。** 所列语言权重原有分类和数额不变，其中可切部分仍是 1,774.5 MiB，54 MiB 是每卡另加的运行时分配（只合计所列语言权重与这份运行时副本；视觉塔、旋转矩阵、量化辅助张量、KV、KDA 状态、激活及图内存仍另计）：

$$M_{\text{indexer,FP32}} = 12 \times (160 \times 4096 + 128 \times 4096) \times 4\text{ B} = 56{,}623{,}104\text{ B} = 54\text{ MiB}$$

| 档位 | 所列语言权重子账 | 加 54 MiB 索引器运行时 FP32 副本 | 折合 GiB |
| --- | --- | --- | --- |
| **TP4 / DP4 / EP16** | $22{,}852.5\text{ MiB}$ | $22{,}852.5 + 54 = 22{,}906.5\text{ MiB}$ | **22.37 GiB** |
| **TP8 / DP2 / EP16** | $21{,}078\text{ MiB}$ | $21{,}078 + 54 = 21{,}132\text{ MiB}$ | **20.64 GiB** |
| **TP16 / DP1 / EP16** | $20{,}190.75\text{ MiB}$ | $20{,}190.75 + 54 = 20{,}244.75\text{ MiB}$ | **19.77 GiB** |

在所列语言模块中，两套口径都得到：TP4 比 TP8 多约 1.73 GiB，TP16 比 TP8 少约 0.87 GiB。由此能看出，TP16 对这部分权重的节省有限，因为占大头的路由专家已由 EP16 分完，MLA cache 仍逐卡复制。完整节省量还需计入视觉模块等表外项。TP4 会增加每卡 attention/MLP 工作量与有效 KDA 状态，还要改每台机器的执行组布局。

**TP4 仍是容量评估的候选，官方 TP8 是本页部署基线；各负载下的最快配置须由实测确定。** 如果只改 TP4、仍留 DP2，则只用 8 张卡且 EP 变为 8，专家权重也会增加；如果 TP16 仍配 DP2，则需要 32 张卡。比较时应先固定硬件总量与 EP 规模，再判断 TP 的收益。

## 常见误解

核对 TP 的切分方向、通信载荷与显存峰值时，先对照下面的排障速查板厘清五组高频误区：

```wiki-diagram
file: tp-fig-myths
```

- **“TP 是把不同的层分给不同的卡。”** 那是 [pipeline parallel](pipeline-parallel.md)（流水线并行）的分法。TP 组共同参与各层的计算，可切分的矩阵各存一片、按算子需要合并结果；GLM 的 45 层在每张卡上都有，但每层既可能有分片，也可能有复制分量，不能说整层所有权重都只存八分之一。
- **“TP8 会把所有权重和 cache 都除以 8。”** 稠密 MLP 和大部分头投影会切；KDA 低秩门、MLA 低秩输入与索引器仍复制。KDA 有效状态按头切，MLA KV 在未开启 `DCP` 时每卡保存完整的 512 维潜向量；[GQA](gqa.md) 模型一旦 `TP` 超过总 KV 头数，单卡 KV 头也触底在 1 个并跨卡复制。
- **“静态权重除以 TP 就是最终显存峰值。”** 加载分片权重只是底座：昇腾在 `process_weights_after_loading` 阶段会把线性层和专家权重转为 `FRACTAL_NZ` 排布，首次前向还会创建常驻缓冲（如 GLM 索引器的 54 MiB FP32 副本），都需留出余量。
- **“row parallel 的输出宽度完整，就能进入下一层。”** 完整的是形状；数值只累加了本卡的输入贡献，需要求和，所以不能用本卡结果乘 8 代替求和。
- **“column parallel 后必须 All-Gather。”** MLP 门控和 attention 头计算能消费本地分片，直到 row 投影后才归约；`lm_head` 的分片需要拼成完整词表来采样。
- **“W8A8 下 TP 通信每数只占 1 B。”** 这里的 hidden 归约与 logits 汇总按 BF16 算，每数 2 B。专家 dispatch 的量化数据有另一套账；存储精度与通信精度分别确认。
- **“218 次都是 TP。”** R1 中 TP 是 134 次，其余属于 EP；场景 M 中 TP 是 92 次，其余属于 DP。MoE 路径改变，通信组别也改变。
- **“TP 的通信量跟模型大小成正比。”** 一次 hidden All-Reduce 搬的是本步 token 的隐藏向量，载荷由行数、hidden 宽度与精度决定，整步还要乘归约次数。同一模型、同一份约 20.58 GiB/卡的语言权重子账，R1 一次只归约 32 KiB，场景 M 却是 47.25 MiB；通信字节应按本步激活形状和集合操作计算，参数总量描述的是权重规模。
- **“细粒度 TP 就是给某一层单独加大普通 TP。”** 它沿 DP 维建组；固定镜像的 OProj（attention 输出投影）模块要求普通 TP=1，所有细粒度模块都要求 MoE 模型。模块各有限制，具体条件见 [fine-grained TP](fine-grained-tp.md)。
- **“TP 越大越快，开图就没有通信了。”** 更多卡分摊部分计算，也增加通信参与者，跨 RoCE 节点更会放大逐层阻塞等待；即使全在机内 HCCS 上，910B3 上 `Qwen3-8B`（`u=0.85`、`c ≤ 16`）从 `TP=1` 扩到 `TP=8` 时，实测 `c=16` 吞吐反而单调跌落 `17.9%`（`195.28 → 160.38 tok/s`，候选原因涉及多卡同步开销与固定 `u` 下逆增的每卡本地 KV 池布局嫌疑，线上各分项时延贡献仍待设备轨迹实测拆分）。graph mode（图模式）预先录下满足条件的设备算子序列再回放，节省逐次下发开销，仍照常执行归约；小批次还有卡只处理补齐行。

沿请求继续看[采样与 MTP](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)；跨机部分读 [expert parallel](expert-parallel.md)；卡住时按[调用链](request-call-chain.md)定位执行进程和通信入口。

## 对照源码

### 怎么开

官方 TP 参数是 **`--tensor-parallel-size 8`**，配合 `--data-parallel-size 2`、`--data-parallel-size-local 1`、`--enable-expert-parallel` 和 `--quantization ascend`。两端地址、rank 及环境变量按[官方教程](https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md)配置，这些开关共同决定布局。

标准 TP 默认值是 1，即本层不分片到多卡。本文通信账还使用以下默认条件：FlashComm1（会改变激活布局的通信优化）关闭、`enable_reduce_sample=False`、共享专家独立 stream（设备独立执行队列）重叠关闭。打开 [sequence parallel](sequence-parallel.md) 这类按 token 位置分布激活的优化后，要按新路径重新计数。

**标准 TP 参数怎样传。** CLI 使用 `--tensor-parallel-size` 或短名 `-tp`；`EngineArgs`、离线 `LLM` 的同名参数是 `tensor_parallel_size`。类型为整数，`ParallelConfig` 定义默认 1、下界 1，0 和负数不是“自动选卡”。四版字段定义见来源 22–24、48，CLI 入口见来源 43、44、46、47、49。它选择每个 TP 组的规模，不决定本机可见哪几张设备，也不表示整个服务只用这么多卡；可见设备及执行器见[启动参数参考](engine-processes.md#怎么开)，总 DP 组数见 [DP 参数参考](data-parallel.md#怎么开)。

本站两端均给 TP8、DP2、本地 DP1 并开 EP。每组按 TP8 合作的具体形状沿用本页算例，不再另列一份矩阵账。改 TP 时要同时满足模型 attention 头数、KDA/MLA 各自头数、列切输出维与行切输入维的整除要求；还要有足够的可见设备和兼容的量化布局。若另开 decode context parallel（将 decode 的上下文分摊给组内卡），TP 必须能被其规模整除（来源 45）。因此“字段能接受正整数”不等于该模型能按任何正整数启动；TP1 只关闭标准 TP 分片，不同时关闭 DP 或 EP。

Ascend 用 `REGISTERED_ASCEND_OPS` 替换 Linear 类，替换过程见[算子层](ops-and-kernels.md)。`AscendRowParallelLinear` 先通过 `get_parallel_op` 选择通信实现；有专门实现就调用它，没有就落回上游 forward 的归约。[C28]

**细粒度 TP 切的是 DP 维**：固定 PP、TP 坐标，把不同 DP 成员编成模块组。它使用独立的模块组和开关，模块规模通过 DP 维分组确定，普通 TP 坐标保持固定。[C39]

**普通 TP > 1 时，启用 OProj 细粒度 TP 会在配置检查时直接报错**：本文固定镜像要求该模块配普通 TP=1。其他模块是否可用由各自配置条件决定。非 MoE 模型启用任何细粒度模块也会在加载配置时被拒绝。条件和各模块差异见 [fine-grained TP](fine-grained-tp.md)。[C38]

**分片默认值与词表出口。** `MergedColumnParallelLinear` 把 gate 和 up 合成一次矩阵乘，每卡拿两者的同一段；`RowParallelLinear` 接本卡中间结果。默认 `gather_output=False`、`input_is_parallel=True`、`reduce_results=True`，GLM 这些投影没有 bias（额外加到输出上的偏置）。列切输出直接交给行切输入，因而省去中间 gather。[D] 词表出口在 `enable_reduce_sample=False` 时，由 `AscendLogitsProcessor._get_logits_normal` 调 `_gather_logits`，完整 logits 归每张 TP 卡所有。[C9]

**为什么共享专家取 `disable_tp=False`。** 本页按 `worker_cls="auto"`、编译配置未开启 `enable_sp` 的执行条件推导；固定镜像的平台适配据此把 `all2all_backend` 设为 `"flashinfer_all2allv"`。[C40] 上游 `use_sequence_parallel_moe` 属性要求 backend 属于指定集合，并同时满足开启 EP、TP>1、DP>1；`"flashinfer_all2allv"` 在该集合之外，因此属性值为 False。这里的 backend 字段用于推导配置属性，实际 Ascend MoE 通信仍走正文的 MC2 或 `ALLGATHER` 路径。[C41]

模型把该属性赋给 `self.is_sequence_parallel`，再传给共享专家 MLP；MLP 的 `gate_up_proj` 和 `down_proj` 都设置 `disable_tp=is_sequence_parallel`，所以两处均为 False，使用现有 TP8 组分别切输出维和输入维。`reduce_results=False` 则单独控制 down 输出何时归约，分片规模仍是 TP8。[C7]

`shared_experts` 构造时传 `reduce_results=False`，由包住它的 MoE 实现安排归约。MC2 在 `_forward_shared_experts` 内对共享结果归约；外层 `maybe_all_reduce_tensor_model_parallel` 直接返回。`ALLGATHER` 共享分支先不归约，外层才对相加结果归约，两处条件互补（来源 16、17）。[C16]

### 会报什么错

| 条件 | 报错或检查点 | 本模型与通用判断 |
| --- | --- | --- |
| 总 attention 头数不能被 TP 整除 | `ValueError: Total number of attention heads (...) must be divisible by tensor parallel size (...).` | 上游 `ModelConfig.verify_with_parallel_config` 检查；64 头允许 TP4/8/16 |
| TP 为 0 或负数 | `ParallelConfig` 的 `ge=1` 字段约束拒绝 | 默认 1；不能用 0 表示自动 |
| TP 不能被 decode context parallel 规模整除 | parallel 配置检查报不能整除 | 本站该规模为 1；改动时与 TP 一起核对 |
| KDA / MLA 头数或投影维不能被 TP 整除 | `assert self.num_heads % self.tp_size == 0`、`assert num_heads % tp_size == 0` 及 `divide` 整除断言 | 头数合法后，还要满足列切输出维、行切输入维与量化对齐约束 |
| 开启昇腾 sequence parallel 但 `tp_size <= 1`（或 MoE 未开 EP） | `AssertionError: Sequence parallelism is only supported when tp_size > 1.` / `requires enable_expert_parallel=True` | `NPUPlatform.check_and_update_config` 拦截；SP 必须建立在 `TP > 1` 之上 |

以上是源码检查点，未在 NPU 上故意触发。通信组成员、形状或执行次序不一致，还可能表现为集合通信等待；待核：缺这套硬件对应的 HCCL 错误日志与超时复现。[C21][C59]

镜像 `db701c1f` 的行并行初始化还有一项偏置约束：`reduce_results=False`、`bias=True` 且 `skip_bias_add=False` 时会抛出 `ValueError`，见来源 28 的 `ops/linear.py` 第 345–346 行。本节 GLM 稠密 MLP 的 gate/up 和 down 投影都设置 `bias=False`（来源 7），因此不触发这一组合条件。

### 开销和什么时候别开

TP 降低可切权重与本卡矩阵乘工作量，成本是逐层集合通信、同步及 replicated 部分的重复计算。R1 单次 hidden 载荷只有 32 KiB，反复启动与等待值得优先测；场景 M 达到 47.25 MiB，链路带宽与通信重叠更值得测。瓶颈比例待 profile（记录算子耗时和等待）确认。

本模型单卡放不下，TP 应与 EP 一起规划；扩大 TP 时先核对是否跨机、能省多少权重、哪些 cache 仍复制。上文三档比较只含所列语言模块。两份固定量化描述已区分 MLA 四组投影的 INT8 / FLOAT 配方；20.58 / 20.81 GiB 是对应子账，不是完整占用区间，视觉塔、旋转矩阵等见[部署页](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。64GB 的单位、完整量化辅助张量与设备格式开销仍以驱动和加载日志核定。

**权重分项核对：路由专家由 EP 分，稠密 MLP、共享专家与词表由 TP 分。** 以下把同一张容量账的分项集中在一张核对表与公式中，形状明确按源码存储的 `[输出维, 输入维]` 列出；$r$ 是组内 rank。矩阵切法的数学方向仍以开篇为准，存储转置见“源码位置”：

$$M_{\text{routed}} = 288 \times (42 + 1) \times 3 \times 4096 \times 2048 \times 1\text{ B} = 311{,}653{,}564{,}416\text{ B} \approx 290.25\text{ GiB}$$

| 部件 | 源码存储形状 `[输出维, 输入维]` 与分片区间 | 字节算式与每卡主体大小 |
| --- | --- | --- |
| **路由专家**（EP16 分配完整专家） | 42 个主干 MoE 层 + 1 个 MTP 层，每专家 2 张升维 + 1 张降维（未计注意力等其余权重） | 全量 $311{,}653{,}564{,}416\text{ B} \approx$ **290.25 GiB**（由 16 卡分担） |
| **稠密 MLP**（TP8，每卡中间通道 $12288 \div 8 = 1536$） | `gate_up`：`[2 × 1536, 4096] = [3072, 4096]`；`down`：`[4096, 1536]` | `gate_up`：$3072 \times 4096 \times 1\text{ B} = 12{,}582{,}912\text{ B} = 12\text{ MiB}$；`down`：$4096 \times 1536 \times 1\text{ B} = 6{,}291{,}456\text{ B} = 6\text{ MiB}$；每层合计 **18 MiB**（int8 主体，缩放系数另占少量显存） |
| **共享专家**（TP8，每卡中间通道 $2048 \div 8 = 256$） | `gate_up`：`[2 × 256, 4096] = [512, 4096]`；`down`：`[4096, 256]` | $(512 \times 4096 + 4096 \times 256) \times 1\text{ B} = 3{,}145{,}728\text{ B} =$ **3 MiB** |
| **词表**（embedding 与 `lm_head` 各一份，$154880 \bmod 64 = 0$ 无需补齐） | 每卡词数 $154880 \div 8 = 19360$，区间 $[19360r,\; 19360(r+1))$，本地 `[19360, 4096]` | 单表 $19360 \times 4096 \times 2\text{ B} = 158{,}597{,}120\text{ B} =$ **151.25 MiB**（BF16） |

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**本文双机绑定算例采用历史专用镜像钉点 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，与四版社区分支分别核对。**

表中的 DSV4 是 DeepSeek-V4 专用输出投影路径，SP 指 sequence parallel，DSA-CP 是稀疏 attention 的上下文分片路径，matmul-allreduce 是矩阵乘与归约融合，FlashComm1 / FlashComm2 是通信优化路径：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 标准 TP 参数与默认合并 | `int`、默认 1、`ge=1`；CLI 长名与 `-tp`；column 默认不 gather，row 默认归约 | 相同 | 相同（`parallel.py#L120-L130`、`arg_utils.py#L1093-L1098`） | 相同（`parallel.py#L146-L155`、`arg_utils.py#L1217-L1222`） |
| Ascend `linear_op` 分派与共享专家解耦 | `_get_row_parallel_op` 依次检查 DSV4、DSA-CP、MLP、`o_proj`、matmul-allreduce、FlashComm2、SP | 检查 DSV4、MLP、`o_proj`、SP；多模态编码器可跳过 SP | row 侧查 DSV4 `wo_b`、非 MoE `down_proj`、`o_proj`；column 侧查 DSA-CP `q_b_proj/kv_b_proj`、DSV4 `wo_a`、非 MoE `gate_up_proj`；共享专家复制与 SP 解耦，仅 `shared_expert_dp_enabled()` 返回 `TP=1` | row 侧同 `v0.30.0`；`get_parallel_op` 在 column 侧优先识别 `qrep_active -> DCPGroupColumnParallelOp`；共享专家仍仅随 `shared_expert_dp_enabled()` 复制 |
| Kimi 模型特定 `o_proj` MM+ReduceScatter 融合 | 无独立 `KimiOProjMMReduceScatterOp` | 无该模型直装路径 | Kimi 直接在 `o_proj` 安装 `KimiOProjMMReduceScatterOp`（要求 SP、AI CPU 融合能力、无 LoRA、非 NZ mode 2、BF16 无 bias 及受支持 TP，仅纯 prefill 批融合，其余返回相同 SP token shard） | 延续 `KimiOProjMMReduceScatterOp`（模型拆至 `models/kimi_k3/kimi_k3.py`，并跳过 PCP `KDARowParallelLinear`） |
| SP 与 TP 协同规则 | 平台检查 SP 依赖 `tp_size > 1` | 延续 `tp_size > 1` 约束 | `PassConfig.enable_sp` 配 `PP>1` 自动补 `+rms_norm`；昇腾 SP 强校验 `tp_size > 1` 且 MoE 须开 EP | 上游移除 `PassConfig.enable_sp`；昇腾 `FlashComm1` + `use_sequence_parallel_moe` 启用时通过 `logger.warning_once` 告警并将 `quantized_all_reduce_config.enable` 置 `False` [C60] |
| GLM 专用实现演进 | 维护分支未含 `glm5_next.py`（绑定算例在镜像 `db701c1f`） | 维护分支未含该专用实现 | 社区仓 `models/glm5next/` 将 KDA 输入合并为 `in_proj_qkvbfg_a`（`f_a/g_a` 仍复制），MLA 低秩输入改用 `DeepSeekV2FusedQkvAProjLinear` 且 `kv_b_proj` 显式不量化 | 延续 `models/glm5next/`，KDA 输入投影扩展支持细粒度 `qkv_iproj_tensor_parallel_size`（`KDAInputProjectionTP`） |

比较的是 `_get_row_parallel_op` 与 `get_parallel_op` 这组有序入口：第一项命中就返回；分支从该入口移出仅表示分派位置调整（参见来源 25–27、50–52）。[D] 社区 `v0.30.0` 与 `main` 对 `glm5next` 的投影合并保持了头切分与 row 输出归约关系，但主文的独立投影调用顺序与量化子账仍应按绑定镜像 `db701c1f` 阅读；待核：`v0.30.0` / `main` 在相同 W8A8 配置下的整次通信 trace 与显存峰值。[C30]

### 源码位置

**读源码存储形状时先核对转置。** 本页始终用 $Y = X \cdot W$，$W$ 为 `[输入维, 输出维]`；column 沿输出列切，row 沿输入行切。PyTorch/vLLM 保存的 weight 为 `[输出维, 输入维]`，是这里 $W$ 的转置：`ColumnParallelLinear` 切存储的第 0 维，`RowParallelLinear` 切存储的第 1 维，计算时使用 weight 的转置。下表明确列的是源码存储形状，图与教学算式仍用数学方向；乘法与转置见[矩阵乘和权重](matmul-and-weights.md)。

**TP 组与编号。** rank 表示通信组成员的编号。node0 的全局 rank 是 0–7，node1 是 8–15；每个组内 rank 都是 0–7，下面的 $r$ 指组内 rank。`initialize_model_parallel` 决定组的形成规则，物理落在一台机器由这套启动布局保证。[C2]

**KDA 的投影与短卷积。** 低秩门的第一段复制、第二段按头切；q/k/v 本地短卷积只混合近邻 token，之后仍是本卡的 8 个头。[C11]

| 部件 | 每卡权重形状 | 切分与作用 |
| --- | --- | --- |
| q / k / v | 各 `[1024,4096]` | column，各产生本卡 8 个头 |
| `f_a_proj` / `g_a_proj` | 各 `[128,4096]` | replicated，生成门控的低维表示 |
| `f_b_proj` / `g_b_proj` | 各 `[1024,128]` | column，展开成本卡各头的门控 |
| `b_proj` | `[8,4096]` | column，每头一个更新强度 |
| q / k / v 短卷积 | 各 `[1024,1,4]` | 按通道切；1 是卷积权重的单通道轴 |
| `o_proj` | `[4096,1024]` | row，接各头结果，输出部分和后归约 |

卷积状态可记作 `[3072,6]`，两轴顺序由运行布局选择，大小由 Ascend 的 `kimi_kda_state_shape` 决定。[C12]

**稀疏 MLA 的投影与索引器。** 索引器是给历史位置打分的小网络；它与低秩输入各卡复制，头展开和输出投影按 TP 切分。[C13]

| 投影 | 全局权重形状 | TP8 每卡形状 | 为什么这样放 |
| --- | --- | --- | --- |
| `fused_qkv_a_proj` | `[2048,4096]` | `[2048,4096]` | `disable_tp=True`；1536 维 Q 低秩表示和 512 维 KV 在每卡完整使用 |
| `q_b_proj` | `[16384,1536]` | `[2048,1536]` | column，输出本卡 8 个 Q 头 |
| `kv_b_proj` | `[32768,512]` | `[4096,512]` | column，为本卡 8 个头保留 K/V 展开权重 |
| `o_proj` | `[4096,16384]` | `[4096,2048]` | row，8 个头输出降回 hidden 后归约 |
| 索引器 `wq_b` | `[4096,1536]` | `[4096,1536]` | replicated，每卡都算完整 32 个索引头 |
| 索引器 `wk_weights_proj` | `[160,4096]` | `[160,4096]` | replicated，产生索引 K 和头权重 |
| 索引器压池门控 | `[128,4096]` | `[128,4096]` | replicated，合并相邻位置的信息 |

加载后，`kv_b_proj` 的本卡权重拆成 K 吸收矩阵 `[8,256,512]` 和 V 展开矩阵 `[8,512,256]`。吸收是把历史展开并入当前 query 一侧的矩阵乘，使 attention 直接在潜空间计算。KV 配置把 `num_kv_heads` 设为 1、`head_size` 设为 512，主 cache 精度固定为 BF16；8 张卡各存这一个共享潜向量头（通用 `ModelConfig.get_num_kv_heads` 在 `use_mla=True` 时同样返回 `1`，在 GQA `tp_size > total_num_kv_heads` 时由 `QKVParallelLinear` 按 `num_kv_head_replicas` 复制，见来源 56、57）。[C15]

**KDA 每卡投影宽 1024；MLA 每卡 Q 展开宽 2048、KV 展开宽 4096，低秩融合输入保持完整。** 以下保留逐项维度、状态与缓存算式核对（权重形状按源码存储方向列出）：[D]

| 核对模块 | 本卡形状与区间参数 | 逐项算式与字节结果 |
| --- | --- | --- |
| **KDA 投影维度** | 每卡头数 $64 \div 8 = 8$，区间 $[8r,\; 8(r+1))$，每卡宽 $8 \times 128 = 1024$ | `q/k/v` 各自权重 `[1024, 4096]`，`o_proj` 权重 `[4096, 1024]`；R1 的 `q/k/v` 为 `[4, 1024] = [4, 8, 128]` |
| **MLA 与索引器维度** | 低秩融合输出 $1536 + 512 = 2048$；索引 Q 宽 $32 \times 128 = 4096$，索引 K 与头权重 $128 + 32 = 160$ | 每卡 Q 展开 $64 \times 256 \div 8 = 2048$，每卡 KV 展开 $64 \times (256 + 256) \div 8 = 4096$，每卡 `o_proj` 输入 $64 \times 256 \div 8 = 2048$ |
| **KDA 单层状态** | 递归状态 `[8, 128, 128]`；卷积通道 $3 \times 64 \times 128 \div 8 = 3072$，卷积长度 $4 - 1 + 3 = 6$（核长 4 留前 3 位置 + 3 投机位置） | 递归状态 $8 \times 128 \times 128 \times 4\text{ B} = 524{,}288\text{ B} = 512\text{ KiB}$；卷积状态 $3072 \times 6 \times 2\text{ B} = 36{,}864\text{ B} = 36\text{ KiB}$；单层有效合计 **561,152 B** |
| **KDA 34 层总计** | 单层补页到 $655{,}360\text{ B}$，含 3 个投机位置共 $1 + 3 = 4$ 页 | 34 层有效状态 $34 \times 561{,}152\text{ B} = 19{,}079{,}168\text{ B} \approx$ **18.2 MiB**；单层物理 $(1+3)\times 655{,}360\text{ B} = 2{,}621{,}440\text{ B} = 2.5\text{ MiB}$，34 层物理 $34 \times 2{,}621{,}440\text{ B} = 89{,}128{,}960\text{ B} =$ **85 MiB** |
| **MLA cache** | 各卡保留完整 512 维潜向量，每 4 个位置压成 1 条 128 维索引 K | 主 KV 每 token 每层每卡 $1 \times 512 \times 2\text{ B} =$ **1024 B**（TP8 全组 $8 \times 1024\text{ B} =$ **8192 B**）；索引 K 摊销 $128 \times 2\text{ B} \div 4 =$ **64 B** |

**来源索引。** 图中的执行顺序对应 `AscendGlm5NextDecoderLayer.forward`；下表可直接跳到各部件的固定源码。

| 想核对什么 | 固定源码位置 |
| --- | --- |
| TP 建组 | `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1749-L1772` |
| column 分片、GQA 副本与按需 gather | `vllm@0fc695fc:vllm/model_executor/layers/linear.py#L407-L454`；`vllm@0fc695fc:vllm/model_executor/layers/linear.py#L575-L589`；`vllm@ced6857a:vllm/model_executor/layers/linear.py#L1045-L1060`；`vllm@ced6857a:vllm/config/model.py#L1530-L1551` |
| row 分片与归约 | `vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1389-L1444`；`vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1537-L1558` |
| Ascend 类替换、row 实现与 `FRACTAL_NZ` 权重转换 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768`；`vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L272-L371`；`vllm-ascend@c09d3e20:vllm_ascend/ops/linear.py#L107-L125` |
| GLM 稠密与共享专家 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1478` |
| 共享专家的 `disable_tp=False` 配置推导 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653`；`vllm@0fc695fc:vllm/config/parallel.py#L625-L641`；模型传递链见上一行 |
| embedding 与 logits | `vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248`；`vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L323-L341`；`vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L87` |
| KDA 投影、前向与状态 | `vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L226`；`vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291`；`vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L31` |
| MLA、索引器投影与运行时 FP32 副本 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1905-L1963`；`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1277-L1313`；`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1349-L1352` |
| MLA cache 与输出归约 | `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L67-L134`；`vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028` |
| 细粒度 TP 的 DP 维建组与模块限制 | `vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L117-L149`；`vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L577` |
| MC2 切行、finalize 与 ALLGATHER 路径分工 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L208-L290`；`#L448-L469`；`#L543-L555`；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L663-L670`；`vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L159-L167` |
| 四版默认 TP 与 CLI 入口 | `vllm@0fc695fc:vllm/config/parallel.py#L110-L117`；`vllm@568afb3a:vllm/config/parallel.py#L118-L125`；`vllm@ced6857a:vllm/config/parallel.py#L120-L130`；`vllm@ba15685a:vllm/config/parallel.py#L146-L155` |
| 四版 `linear_op` 分派与 Kimi 融合入口 | `vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L739`；`vllm-ascend@2ed6cbba:vllm_ascend/ops/linear_op.py#L497-L521`；`vllm-ascend@c09d3e20:vllm_ascend/ops/linear_op.py#L406-L460`（Kimi 见 `#L156-L261` 及 `models/kimi_k3.py#L687-L712`）；`vllm-ascend@8d6180e2:vllm_ascend/ops/linear_op.py#L403-L455`（Kimi 见 `models/kimi_k3/kimi_k3.py#L795-L815`） |
| `v0.30.0` 与 `main` 的 `glm5next` 投影 | `vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L168-L195`；`vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L182-L230`；`vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L300-L335`；`vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/attention.py#L193-L238` |
| `Qwen3-8B` 72 归约点、非连续 KV 视图与 `FULL` 图回放 | `vllm@ced6857a:vllm/model_executor/models/qwen3.py#L105-L125`（`o_proj`）；`vllm@ced6857a:vllm/model_executor/models/qwen2.py#L90-L110`（`down_proj`）；`vllm@ced6857a:vllm/model_executor/layers/linear.py#L1765-L1782`；`vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5884-L5931`；`vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L319` |

**来源对应。** 部署布局见官方教程；稠密 MLP、本地 SwiGLU 与幅度限制见模型实现；embedding 的非本卡词表行置零见词表算子。[S1][C8]

前两节的 $x=[1,2]$、40 层与 4 个 KV 头数字为教学示意设定。[A] R1 的 MC2 补齐、切行、finalize 拼回输入布局见 `prepare_finalize.py`（来源 18）；矩阵、状态、词表、R1 与场景 M 的字节和次数，均由所列形状与精度推导，表内统计集合操作的逻辑输入，不是 HCCL 链路实测。[D]

`Qwen3-8B` 在 `Ascend 910B3` 上的非连续页交错日志、线上 `FULL` 日志、Eager 整池拷贝实测及 `TP=1→2→4→8` 显存/延迟/吞吐、`TP=4` HCCS 独立微基准摘录见 `sources` 第 61–62 项（归档总览见 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)）[M61][M62]；其中按 Eager `1.372 TB/s` 外推线上 `FULL` 图 `56.77 → 77.09 ms` 整池复制耗时，以及线上服务态通信重叠度与各项时延份额，均属待线上设备时间线验证的条件假设 [I]。

TP4/8/16 权重比较是固定 16 卡、EP16 和现有量化口径的静态估算；“TP16 节省有限、TP4 仍可评估”是在这些条件下的容量推断。[I] 索引器的运行时 FP32 副本创建位置见来源 37，`FRACTAL_NZ` 权重格式转换见来源 58；profile run 与 KV 预算时序见[部署页](glm-5-3-flash-two-node.md#启动时发生了什么)。[C37]

KDA 的有效状态、补页及投机状态副本采用不同统计口径；MLA 的 cache 按各卡完整潜向量计数，不能随 Q 头数再除以 TP8；偏置只计入一次同样由行并行部分和相加算式推出，不证明固定部署的线性层启用了偏置。[D]

**待核与实测边界（从正文集中到此）。**

- `Qwen3-8B`（`v0.30.0` / 910B3）线上 `FULL` 图 replay 期间的设备级 kernel 时间线（用于闭合 `56.77 → 77.09 ms` 整池连续化强推断），以及 `c > 16` 高并发下 TP 的正收益交叉点，仍待后续实测。
- GLM 双机历史固定镜像（`db701c1f`）缺本机 HCCL 算法选择、链路计数与耗时测量，用于把逻辑载荷换算为机内链路实际流量、耗时及整个集群的网络总量。
- GLM 双机缺这两台机器的 HCCS / RoCE 端口速率、单向/双向口径、拓扑聚合带宽及同口径 All-Reduce 测量，因此带宽倍数与 TP16 减速百分比待核。
- GLM 双机缺三档 TP 同负载的每 token 延迟、吞吐、激活峰值与 KV 分配日志。TP 改变后 KDA 页对齐可能变化，缓存容量与块数应按新配置重算；每卡工作量缩小多少与实际快多少要用同批次 NPU 实测区分。
- DP1 在场景 M 混合步里进入每个非 MoE 子层的实际宽度仍需 runner trace（逐步记录输入尺寸的运行轨迹）核定；本文精确总账只针对 DP0。
