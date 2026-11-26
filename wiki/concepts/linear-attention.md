---
id: linear-attention
title: 线性注意力与门控增量法则：用定长矩阵状态替代逐词 KV 历史
type: concept
legacyAnchors:
  kda-是什么历史怎样装进一个固定大小的状态: 为什么 Softmax 锁死了历史，核映射结合律怎样把历史压进定长状态？
  为什么去掉-softmax-就能从平方降到线性: 为什么 Softmax 锁死了历史，核映射结合律怎样把历史压进定长状态？
  只做累加会写坏状态delta-规则遗忘门按通道衰减: 四代递推规则演化：从纯累加串味到 Gated DeltaNet 与 KDA
summary: >-
  线性注意力去掉逐位置 Softmax，靠核映射与矩阵乘法结合律把历史压进定长状态矩阵，并在 Prefill 走分块并行、Decode 走逐词递推。本页用同一套二维算例推演纯累加、DeltaNet 误差擦写、Qwen3-Next 的 Gated DeltaNet 到 KDA，并核对双状态规格与 GLM 块号账。
aliases:
  - 线性注意力
  - Linear Attention
  - KDA
  - Kimi Delta Attention
  - GDN
  - Gated DeltaNet
  - 门控增量法则
  - AscendGatedDeltaNet
  - DeltaNet
  - 递推状态
  - recurrent state
  - 矩阵状态
  - chunked 计算
  - Chunkwise 并行
chapters:
  - '04'
order: 35
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'https://arxiv.org/html/2510.26692v1'
  - 'https://arxiv.org/abs/2006.16236'
  - 'https://arxiv.org/abs/2102.11174'
  - 'https://arxiv.org/html/2406.06484v3'
  - 'https://arxiv.org/html/2412.06464v3'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L231
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L169-L242'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L343-L388'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L474'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L477-L494'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L528-L560'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L586-L659'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2489-L2509'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py#L119-L125'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L191-L228
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L627-L636'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3344'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/triton/kda/kda.py#L1287-L1331'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L725-L734'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda_state.py#L28-L49'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L103-L160'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L348-L395'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/ops/kda.py#L1-L60'
  - >-
    raw:sha256-f1eb696b50d5560664ed320075d8c1a7bbd054b35e5f158fbd2b78fc2047b335.md#L1-L1026
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/kda.py#L108-L187'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L107-L190'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L211-L310'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda_input_projection_tp.py#L18-L62'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/recoverssm_config.py#L13-L44'
  - 'vllm@ced6857a:vllm/model_executor/layers/lightning_attn.py#L653-L675'
  - 'vllm@ced6857a:vllm/third_party/flash_linear_attention/ops/fused_recurrent.py#L122-L149'
  - 'vllm@ced6857a:vllm/third_party/flash_linear_attention/ops/chunk.py#L23-L84'
  - 'vllm@ced6857a:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L127-L150'
  - 'vllm@ced6857a:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L2007-L2045'
  - 'vllm@ced6857a:vllm/transformers_utils/configs/qwen3_next.py#L198-L218'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_next.py#L485-L502'
  - 'vllm@ced6857a:vllm/model_executor/layers/mamba/mamba_utils.py#L98-L149'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L993-L1063'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/gdn.py#L331-L446'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/gdn.py#L333-L450'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/gdn.py#L706-L875'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/gdn.py#L729-L782'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/kda.py#L9-L99'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_mamba_config.py#L145-L176'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 那页讲标准 attention 的 q/k/v 与逐位置 softmax；本页去掉逐位置 softmax，用定长递推状态替代
  - to: kv-cache
    kind: builds-on
    note: 线性注意力不按位置增长 KV cache，而是为每条请求维护固定大小的状态矩阵与短卷积缓存
  - to: gqa
    kind: alternative-to
    note: GQA 仍保留逐位置 K/V 历史仅减少 KV 头数；线性注意力把历史压缩成 O(1) 定长状态
  - to: mla
    kind: alternative-to
    note: MLA 压缩每位置潜向量但仍随长度线性增长；线性注意力状态大小恒定，常与 MLA 交替混排
  - to: sparse-attention
    kind: alternative-to
    note: 内容稀疏注意力保留全历史按 top-k 召回；线性注意力通过衰减与 delta 纠错原地更新定长状态
  - to: swa-bounded-replay
    kind: alternative-to
    note: 滑动窗口保留最近 W 格精确历史；线性注意力把任意长度的历史持续压缩进定长矩阵状态
contradicts: []
updated: '2026-11-27'
origin: gap
rawSources:
  - >-
    raw/sha256-6a6dff10afedce0b969fbfd878381c2a124f841ffc5b71a163eb02405f1ae2fc.md
  - >-
    raw/sha256-f1eb696b50d5560664ed320075d8c1a7bbd054b35e5f158fbd2b78fc2047b335.md
---

## 为什么 Softmax 锁死了历史，核映射结合律怎样把历史压进定长状态？

**Linear Attention（线性注意力）去掉逐位置的 Softmax 指数耦合，改用可分离特征映射并利用矩阵乘法结合律，把任意长度的历史压缩进一个固定形状的状态矩阵 $S_t \in \mathbb{R}^{d_k \times d_v}$**：每来一个新 token，先用它的键值改写状态 $S_t$，再用当前查询从 $S_t$ 一次读出本层输出，从此单步生成不再随上下文变长而重扫整段 [KV cache](kv-cache.md)。

在[标准 attention](attention-qkv.md) 中，第 $t$ 个位置的隐藏向量投影出行向量 $Q_t, K_t \in \mathbb{R}^{1 \times d_k}$ 与 $V_t \in \mathbb{R}^{1 \times d_v}$。输出之所以昂贵，根源在于逐元素非线性函数 $\exp(Q_t K_i^\top / \sqrt{d_k})$ 把当前查询 $Q_t$ 和每一个历史键 $K_i$ 锁在了同一个括号里：必须先把 $Q_t$ 与全部 $t$ 个历史键逐一算出分数并凑齐归一化分母，才能去乘 $V_{1:t}$。这迫使计算顺序锁死为 $(Q K^\top) V$——整段长度为 $n$ 的提示词需要 $O(n^2)$ 次打分，生成阶段每走一步也要从显存重读全部 $t$ 个历史位置的 K、V（单步访存 $O(t)$）。

Katharopoulos 等人提出的核特征映射拆开了这把锁：把不可拆分的 $\exp(Q_t K_i^\top)$ 替换为对 $Q_t$、$K_i$ 各自独立作用的特征映射内积 $\phi(Q_t)\phi(K_i)^\top$。一旦去掉跨位置套在外层的 Softmax，矩阵乘法结合律允许直接交换括号顺序：

$$\sum_{i=1}^{t} \big(\phi(Q_t)\phi(K_i)^\top\big) V_i = \phi(Q_t) \left(\sum_{i=1}^{t} \phi(K_i)^\top V_i\right) = \phi(Q_t) S_t, \quad S_t = S_{t-1} + \phi(K_t)^\top V_t$$

早期核线性注意力还会同步累加键特征向量 $z_t = z_{t-1} + \phi(K_t)^\top$ 作分母 $\phi(Q_t) z_t$；现代工业模型（如 `Qwen3-Next` 的 Gated DeltaNet 与 `Kimi Linear` / `GLM-5.3-Flash` 的 KDA）省去显式分母，改在 $Q_t, K_t$ 过短卷积后直接做 L2 归一化，并在读出端接 RMSNorm 稳定尺度。

用一个 $d_k = 2, d_v = 2$ 的极简算例（示意数）就能看清括号重排如何消掉逐词历史：设位置 1 的 $\phi(K_1) = (1, 0),\; V_1 = (2, 1)$，位置 2 的 $\phi(K_2) = (0, 1),\; V_2 = (0, 3)$，当前查询 $\phi(Q_2) = (1, 0.5)$：

- **按位置扫描 $(\phi(Q_2)\phi(K_{1:2})^\top) V_{1:2}$**：先逐个打分得 $(1,\; 0.5)$，再加权求和 $1 \cdot (2, 1) + 0.5 \cdot (0, 3) = (2,\; 2.5)$，必须把两份历史都留在显存里；
- **合成矩阵状态 $\phi(Q_2) S_2$**：先把外积叠进 $2 \times 2$ 状态 $S_2 = \begin{bmatrix}1\\0\end{bmatrix}\begin{bmatrix}2 & 1\end{bmatrix} + \begin{bmatrix}0\\1\end{bmatrix}\begin{bmatrix}0 & 3\end{bmatrix} = \begin{bmatrix}2 & 1\\0 & 3\end{bmatrix}$，再用查询一次乘出 $\begin{bmatrix}1 & 0.5\end{bmatrix}\begin{bmatrix}2 & 1\\0 & 3\end{bmatrix} = (2,\; 2.5)$。结果完全一致，但哪怕后续写到 13 万个 token，保留下来的依然只是这一个 $d_k \times d_v$ 矩阵。

```wiki-diagram
file: linear-attention-intuition
```

名字里的「线性」指序列长度 $n$ 的时间复杂度从 $O(n^2)$ 降为 $O(n)$（单步生成访存从 $O(t)$ 降为 $O(1)$），既不代表层内没有非线性激活与门控，也不代表输出数值与 Softmax 注意力等价。省下带宽的同时也付出了信息论代价：

| 对比维度 | 标准 Softmax 注意力 $(Q K^\top) V$ | 线性注意力定长状态 $\phi(Q_t) S_t$ |
|---|---|---|
| 生成一步读多少历史 | 全部 $t$ 个可见位置的 K、V（随长度线性膨胀） | 仅读本请求固定形状的状态矩阵 $S_{t-1}$ |
| 处理 $n$ 个 token 的总计算量 | $O(n^2 d)$ | $O(n d_k d_v)$（宽度固定时随 $n$ 线性增长） |
| 能否精确抄回任意旧 token | 能，每个位置的 K、V 独立原样保存 | 受限，多位置外积混入同一固定秩矩阵 |
| 容量天花板受什么制约 | 物理显存池能装下多少 KV 块 | 单头矩阵 $d_k \times d_v$ 的通道容量与遗忘策略 |

## 四代递推规则演化：从纯累加串味到 Gated DeltaNet 与 KDA

把历史压成定长矩阵 $S_t \in \mathbb{R}^{d_k \times d_v}$ 后（下文统一采用与配图一致的 `[d_k, d_v]` 数学布局，$q_t, k_t \in \mathbb{R}^{d_k}$、$v_t \in \mathbb{R}^{d_v}$ 记为列向量），真正的难点在于**有限格子怎么写才不会串味饱和**。沿着同一套二维算例（初始 $S_0 = 0$，先后对同一个键 $k = (1, 0)^\top$ 写入旧值 $v_1 = (2, 0)^\top$ 与新值 $v_2 = (5, 0)^\top$），四代递推规则的因果演进一目了然：

1. **纯累加式与固定斜率衰减（易饱和串味）**：最朴素的核线性注意力直接累加外积 $S_t = \lambda S_{t-1} + k_t v_t^\top$（普通加法取 $\lambda = 1$；Lightning Attention 按头固定斜率取 $\lambda = e^{-\text{slope}_h}$）。在算例中取 $\lambda = 1$，位置 1 写完首行为 $(2, 0)$，位置 2 想把同一个键改写成 $(5, 0)$，结果却叠成 $(2, 0) + (5, 0) = (7, 0)$——旧关联擦不掉，相近键反复写入会互相串味并撑爆数值范围。
2. **DeltaNet（按预测误差擦写修正）**：Schlag 等人与 Yang 等人把注意力视作快速权重（fast weights）存储器，写入前先用当前键探出旧状态「以为的值」$\hat{v}_t = S_{t-1}^\top k_t$，再只把预测误差 $e_t = v_t - \hat{v}_t$ 按强度 $\beta_t \in (0, 1]$ 写进去：$S_t = S_{t-1} + \beta_t k_t e_t^\top$。回到算例取 $\beta_t = 1$：位置 2 先读出 $\hat{v}_2 = (2, 0)^\top$，算出差值 $e_2 = (5, 0)^\top - (2, 0)^\top = (3, 0)^\top$，更新后首行恰好变成 $(2, 0) + (3, 0) = (5, 0)$，精准覆写旧值且不污染正交的第 2 行通道。
3. **Gated DeltaNet（`Qwen3-Next` 主力：每头标量遗忘门 + 误差擦写）**：DeltaNet 只能覆写当前命中的键 $k_t$；一旦上下文切换话题，不再访问的旧键仍占满状态容量。Gated DeltaNet 在误差修正前先给整头旧状态乘一个随输入变化的标量衰减门 $\alpha_{t,h} = e^{g_{t,h}} \in (0, 1)$：
   $$\bar{S}_t = \alpha_{t,h} S_{t-1}, \quad e_t = v_t - \bar{S}_t^\top k_t, \quad S_t = \bar{S}_t + \beta_t k_t e_t^\top, \quad o_t = S_t^\top (q_t \cdot \text{scale})$$
   在 `Qwen3-Next` 中，默认每 4 层排 3 层 `QwenGatedDeltaNetAttention`（昇腾对应 `AscendGatedDeltaNetAttention`）配 1 层全注意力（默认 `key_heads=16, value_heads=32, head_dim=128`、短卷积宽 `4`，$g = -e^{A_{\log}}\operatorname{softplus}(a + dt_{\text{bias}})$，$\beta = \sigma(b)$）。若算例第 2 行存着旧话题 $(0, 4)$、本步取 $\alpha_{t,h} = 0.5, \beta_t = 1$，衰减门先把背景旧话题减半腾出容量，误差项再把当前键首行精准写到 $(5, 0)$。
4. **KDA（Kimi Linear / GLM 进阶：按 key 通道独立的对角衰减）**：标量门迫使同一头的 128 个键通道同速遗忘。**KDA（Kimi Delta Attention）** 将标量 $\alpha_{t,h}$ 细化为对角矩阵 $D_t = \operatorname{diag}(\alpha_{t,h,:})$，令 $\bar{S}_t = D_t S_{t-1}$，允许同一头内部分通道取 $\alpha_{t,0} \approx 1$ 留住长程锚点、另一批通道取较小 $\alpha_{t,1}$ 快速清掉局部语法（`Kimi Linear` 同样采用 3 层 KDA 配 1 层全注意力的混合比例）。

```wiki-diagram
file: kda-evolution
```

| 递推代际 | 单步状态更新（`[d_k, d_v]` 数学布局） | 解决的核心痛点 | 典型模型与算子入口 |
|---|---|---|---|
| 纯累加 / Lightning | $S_t = \lambda S_{t-1} + k_t v_t^\top$ | 消除 $O(t)$ KV 增长，但同键覆写易串味 | TransNormerLLM / `lightning_attn` |
| DeltaNet | $S_t = S_{t-1} + \beta_t k_t (v_t - S_{t-1}^\top k_t)^\top$ | 按预测误差精准擦写当前键关联 | DeltaNet（快速权重） |
| Gated DeltaNet（GDN） | $\bar{S}_t = \alpha_{t,h} S_{t-1},\; S_t = \bar{S}_t + \beta_t k_t (v_t - \bar{S}_t^\top k_t)^\top$ | 每头标量门主动清空过期背景，配合误差覆写 | `Qwen3-Next`（`chunk` / `fused_recurrent_gated_delta_rule`） |
| KDA | $\bar{S}_t = \operatorname{diag}(\alpha_{t,h,:}) S_{t-1},\; S_t = \bar{S}_t + \beta_t k_t (v_t - \bar{S}_t^\top k_t)^\top$ | 同一头内不同 key 通道按各自半衰期独立遗忘 | `Kimi Linear`、`GLM-5.3-Flash`（`chunk_kda` / `recurrent_kda`） |

压缩长上下文还有另外两条正交路线：[MLA](mla.md) 压缩每个位置的 KV 潜向量，[稀疏注意力](sparse-attention.md)只挑 top-k 历史块精算。现代长文本模型常以「3 层线性注意力（GDN 或 KDA）+ 1 层全注意力/稀疏 MLA」混排，兼顾常数级状态开销与精确大海捞针召回。

## KDA 一步完整的更新和读出

Gated DeltaNet 与 KDA 共享完全相同的五步递推骨架，唯一区别在于第一步衰减因子 $D$ 取标量门 $\alpha_{t,h} I$（GDN）还是对角矩阵 $\operatorname{diag}(\alpha_{t,h,:})$（KDA）。沿用 `S ∈ ℝ^{d_k × d_v}` 数学布局与列向量 $q, k, v$（省略批次、头下标与缩放），单步计算依次为：

$$\bar{S} = D S_{t-1}, \quad \hat{v} = \bar{S}^\top k, \quad e = v - \hat{v}, \quad S_t = \bar{S} + \beta k e^\top, \quad o = S_t^\top q$$

把 $e = v - \bar{S}^\top k$ 代入第四步即可合并成论文常见的快速权重形式 $S_t = (I - \beta k k^\top) D S_{t-1} + \beta k v^\top$，两者在数学上完全等价。上游 FLA 与昇腾内核实现多按 value-first 存储布局 `[H_v/TP, d_v, d_k]` 排布状态矩阵（即上式的转置 $S_{\text{mem}} = S^\top$），对应递推写为 $\bar{S}_{\text{mem}} = S_{\text{mem},t-1} D$、$r_t = \beta(v - \bar{S}_{\text{mem}} k)$、$S_{\text{mem},t} = \bar{S}_{\text{mem}} + r_t k^\top$、$o = S_{\text{mem},t} q$。

```wiki-diagram
file: linear-attention-state
```

真实一层先从隐藏向量投影出 `q`、`k`、`v` 以及写入强度 $\beta$ 和衰减门，对 `q`、`k`、`v` 过核宽为 `4` 的因果短卷积（`conv1d`）捕获局部相邻词特征，再对 `q`、`k` 做 L2 归一化，保证收缩算子 $(I - \beta k k^\top)$ 不会放大状态范数；读出结果经输出门、RMSNorm 与行并行投影回到隐藏维度。在二维上走一遍五步（示意数：取 $S_{t-1} = I$、$D = \operatorname{diag}(0.5, 1)$、$k = q = (1, 0)^\top$、$v = (3, 2)^\top$、$\beta = 0.5$）：

| 步骤 | 算式 | 结果 |
|---|---|---|
| 1. 衰减 $\bar{S}$ | $D S_{t-1} = \operatorname{diag}(0.5, 1) \cdot I$ | $\begin{bmatrix}0.5 & 0 \\ 0 & 1\end{bmatrix}$ |
| 2. 预测 $\hat{v}$ | $\bar{S}^\top k$ | $(0.5,\; 0)^\top$ |
| 3. 误差 $e$ | $v - \hat{v} = (3, 2)^\top - (0.5, 0)^\top$ | $(2.5,\; 2)^\top$ |
| 4. 更新 $S_t$ | $\bar{S} + 0.5\, k e^\top$ | $\begin{bmatrix}1.75 & 1 \\ 0 & 1\end{bmatrix}$ |
| 5. 读出 $o$ | $S_t^\top q$ | $(1.75,\; 1)^\top$ |

每步改写的只是当前请求独享的状态槽，模型投影权重保持不变；状态一旦被原地覆写或随抢占回收，就无法像逐词 KV 那样局部回退，只能从头或最近检查点重算。想在三维空间里观察张量流向，可打开[模型探索：KDA 状态更新与读出](#/model?view=play&segment=14)。

## Prefill 用 chunked 计算，decode 逐位置推进

**同一套门控增量递推在引擎里拆成两条硬件路径：Prefill 走分块并行（Chunkwise）吃满 [AI Core](ai-core.md) 的 Cube 矩阵核，Decode 走逐词递推（Recurrent）压低 HBM 访存带宽。**

```wiki-diagram
file: linear-attention-flow
```

如果把 4,096 个提示词按 $t = 1 \dots 4096$ 串行递推，4,096 次微小的矩阵乘向量会让 Cube 单元长期饥饿。**Chunkwise 并行**（如 `ChunkGatedDeltaRule`、昇腾 `fla_npu` / `npu_chunk_gated_delta_rule` 与段长 $C=64$ 的 `chunk_kda_fwd`）把输入序列切成固定长度的小段：段内先做门值累加、段内键交互矩阵与下三角求解，一次性用高密度矩阵乘算出整段 64 个位置的输出与段末状态增量；段与段之间再把前一段算出的状态传给下一段作初值。它只利用结合律重排计算顺序，与逐词递推在数学上等价（仅差浮点累加顺序），[分块预填充](chunked-prefill.md#历史状态必须跨段延续)跨轮续算时同样直接读取上一轮留下的状态。

**Decode 逐词递推**（每步仅推进 1 个位置，或[投机解码](speculative-decoding.md)验证 $1 + K$ 个位置，对应 `fused_recurrent_gated_delta_rule` / `recurrent_gated_delta_rule` 与 `recurrent_kda`）则完全不必拼段内大矩阵：算子把本请求的状态从 HBM 读入片上缓存，融合完成归一化、门控衰减、误差写入与查询读出后再写回，单步访存恒为 $O(d_k d_v)$。同一批次混有 Prefill 与 Decode 请求时，实现先按请求阶段拆行分流，算完再按原行序拼回输出。

在 vLLM V1 缓存管理中，线性注意力统一抽象为 `MambaSpec` 双状态页：**短卷积缓存**保存最近 $w - 1 + K$ 个输入向量（GDN 每卡宽 $(2 H_k d_k + H_v d_v)/\text{TP}$，KDA 每卡宽 $(H d + 2 H_k d_k)/\text{TP}$），**递推状态**保存矩阵历史（GDN 为 `[H_v/TP, d_v, d_k]`，KDA 为 `[H/TP, d, d]`）。每条请求预留的状态页上界随 `mamba_cache_mode` 变化：默认 `none` 占 $1 + N_s$ 页（$N_s$ 为投机草稿块数），开启前缀对齐 `align` 占 $2 + N_s + N_{\text{ckpt}}$ 页，`all` 占 $\lceil L_{\max}/B \rceil + N_s$ 页（详见 [KV cache spec](kv-cache-spec.md)）。

## 放到 GLM 双机：34 层 KDA 的状态有多大

前半程讲完了通用线性注意力、`Qwen3-Next` 的 Gated DeltaNet 与 KDA 的统一机制。要看清「定长状态怎样与按位置增长的稀疏 KV 共用同一个物理块池」，下面切入例外 B 历史绑定算例——[官方双机部署](glm-5-3-flash-two-node.md#部署前提)（两台 Atlas 800 A2、每台 8 卡、机内 TP8，最长上下文 `133,120` token，默认关闭 prefix caching）下的 `GLM-5.3-Flash`。**其 45 层主干由 34 层 KDA 与 11 层稀疏 MLA 按「3 层 KDA + 1 层 MLA」混排；KDA 层不按位置存 K、V，每条请求在一层里只维护固定形状的双状态**（层号见[模型总览](glm-5-3-flash.md#45-层怎样排)，对应[主线第 4 站](one-request.md#34-层-kda)与 [attention 页三种形式对照](attention-qkv.md#三种形式对照)）。

**64 个头按 TP 切给 8 张卡，每卡 8 个头。** `q`、`k`、`v` 三个投影各把 4096 维变成 $64 \times 128 = 8192$ 维（切完每卡 1024 列）；输出投影按行切，每卡输出 4096 维部分和后做一次 [All-Reduce](collective-communication.md#all-reduce)。状态跟着头走，每卡只维护本地 8 个头，状态不跨卡交换，全层只有这一次集合通信（切法见 [tensor parallel 的 KDA 一节](tensor-parallel.md#kda状态跟着头一起切)）。

### 矩阵状态之外还有短卷积历史

一条请求在一个 KDA 层里要跨步保留的是两份东西，不是一份：

- **递推状态**：本卡 8 个头各一个 128 × 128 的矩阵，按 FP32 存，每卡 512 KiB；整层 64 个头合起来是 4 MiB。这就是前面讲的那个状态。
- **卷积状态**：短卷积要回看的最近几个位置的 q、k、v，按模型精度 BF16 存，长度是核长 4 减 1 再加 3 个草稿位置，共 6 格（草稿位置来自[投机解码](speculative-decoding.md)：每轮先起草 3 个 token，再和当前位置一起验证，所以要为它们多留格子）；每卡 36 KiB，整层 288 KiB。

两份加起来，每层每卡 561,152 B，34 层约 18.2 MiB；逐项的分片字节账在 [tensor parallel 的 KDA 状态一节](tensor-parallel.md#kda状态跟着头一起切)，本页不重算。

**为一条请求保留投机状态并补齐页面后，KDA 对应的页容量是 85 MiB，不是 18.2 MiB。** 中间有两步放大，来自状态份数和分配对齐，不能当成每步实际写入量：

1. **一份状态被补齐到和一个 MLA 页一样大。** GLM 是混合架构（hybrid）模型，KDA 的固定状态和 MLA 的按位置历史要共用同一批物理槽，页大小取两者的较大值 655,360 B，放进 561,152 B 的状态后，页里约 14.4% 是填充。655,360 和逻辑块 640 个 token 的由来见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。

   这里取较大值的是单页容量，不是把 KDA 各层与 MLA 各层的总缓存取较大值；物理槽位采用相同容量，也不表示两类层共享同一份历史内容。
2. **投机解码再要 3 页。** 一轮验证会算出 3 个候选位置各自的状态，每个候选存一页；下一步按实际接受了几个，从对应那页接着算。于是每层每请求是 1 + 3 = 4 页，每页 655,360 B。

34 层各 4 页，合起来就是 85 MiB，逐项算式见 [tensor parallel 的源码位置一节](tensor-parallel.md#源码位置)；按并发上限 32 条算，每卡对应约 2.66 GiB 页容量。这两个数包含页内填充；内核是否写到这些填充位置、每步读写几份状态须另查执行。按块池的块号记账还要更多，见下一节。

这 85 MiB 与请求多长无关：4 个 token 的请求和 13 万 token 的请求付一样多。MLA 那一侧相反，每个 token 每张卡要 13,056 B，越长越多（见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）。所以 KDA 层的状态不增长，并不等于这个模型的缓存不增长：每 4 层里那 1 层稀疏 MLA 仍然按位置保留可回看的历史。因此短请求里 KDA 状态反而是大头，长请求里它的比重越来越小；两类状态的分类和折算见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。

### 状态怎么占到块号上

**34 层 KDA 在块池里分成 3 个缓存组，每组每请求 4 块，合计固定占 12 个块号。** 分组按层号步长 3 拆成 `12 / 11 / 11` 层三组，每组 4 块对应 1 页当前状态加 3 页草稿状态（见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)与[短请求为何占 15 块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)）。

**12 个块号折成显存约 `95.6 MiB`，比上节 `85.0 MiB` 多出 `10.6 MiB`，因为口径不同。** `85.0 MiB` 只计 34 层已补齐页面；块池按整块号记账，每块号每卡含 12 个 `655,360 B` 主槽与 12 个 `40,960 B` 索引小槽（共 `7.969 MiB`，见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)），且同一时刻整块归单一缓存组独占。KDA 拿到块号后，11 层的两组各空 1 个主槽，12 个索引小槽也用不上：

一条请求的 KDA 状态在两种记账口径下相差约 $10.6\text{ MiB}$，拆解如下：

| 记账项 | 算式 | 字节数 | MiB |
|---|---|---|---|
| KDA 对应页容量（含页内填充） | $34\text{ 层} \times 4\text{ 页} \times 655{,}360\text{ B}$ | $89{,}128{,}960\text{ B}$ | $85.0\text{ MiB}$ |
| 按块号记账（12 个块号） | $12 \times 8{,}355{,}840\text{ B}$ | $100{,}270{,}080\text{ B}$ | $\approx 95.6\text{ MiB}$ |
| 差额合计 | $100{,}270{,}080 - 89{,}128{,}960$ | $11{,}141{,}120\text{ B}$ | $\approx 10.6\text{ MiB}$ |
| ↳ 差额 1：11 层两组空出的主槽 | $2\text{ 组} \times 4\text{ 块} \times 655{,}360\text{ B}$ | $5{,}242{,}880\text{ B}$ | $5.0\text{ MiB}$ |
| ↳ 差额 2：KDA 用不上的索引器小槽 | $12\text{ 块} \times 12 \times 40{,}960\text{ B}$ | $5{,}898{,}240\text{ B}$ | $\approx 5.6\text{ MiB}$ |

```wiki-diagram
file: linear-attention-fig-kda-delta-budget
```

上图把 KDA 的五步固定状态更新与这三笔显存账放在一起对照：查单份有效净载荷看 561,152 B/层（34 层合计 18.2 MiB）；算含投机份数和页内填充的页面容量看 85.0 MiB；估算块池还能容纳多少条并发请求，则必须按 12 个块号、约 95.6 MiB 记账。部署页短请求的「15 块约 119.5 MiB」同样采用块号口径；三者衡量的都是静态容量，都不直接给出每步访存流量。

**这里的「块大小」和逻辑块不是一个数。** KDA 组的块大小被设成最大请求长度 133,120，意思是「一条请求的状态一页装得下，和它多长无关」；KV 池和 MLA 用的逻辑块是 640 个 token，稀疏注意力算子按 128 个 token 一块读取；调度器的对齐单位是各组块大小的最小公倍数，也等于 133,120。`block_size` 在这套部署里一共有五种含义，对照表和换算见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。此外，该算例缓存里递推状态按 `[头, d_v, d_k]` 存储而分段算子要求 `[头, d_k, d_v]`，算子边界会转置一次再转回——因 $d_k = d_v = 128$，排查时不能只看形状数字，须核对各轴语义。

## 多条请求和空闲组：状态按槽位号各归各的

**一步里多条请求的行拼成同一个张量做矩阵乘，读写状态时各归各的。** 每条请求在每个缓存组有自己的槽位号，KDA 按槽位号取自己那份状态；这一步新来的请求先把状态清零再开始。批次怎么拼见[多请求的第 3 站](concurrent-requests.md#第-3-站-准备输入13-条请求拼成一个-6048-行的张量)。

**空闲的 DP 组也要陪跑，KDA 的外层计算仍会执行。** 两台机器是两个独立调度的执行组，前向却必须同步，所以本地没有请求的那一步也要拿填充行走一次前向。34 层 KDA 的输入投影、输出归一化与门控、输出投影仍会执行；短卷积和递推是否执行，则取决于有没有 attention 元数据（告诉算子每行属于哪条请求、状态在哪个槽位的那张表）。陪跑用的是补出来的行，不属于任何真实请求。

本部署给纯 decode 步录了图，也就是启动时把一整步的算子顺序录下来，之后整张回放，省掉逐个下发算子的开销，见 [ACL Graph](acl-graph.md)。陪跑步回放 decode 图时建元数据；这一步只能 eager 执行时（不走图、算子逐个下发，比如对端正在跑含 prefill 的混合步）就不建，启动时量显存的那次试跑也不建。没有元数据时，KDA 在进入短卷积前就返回，同时跳过短卷积和递推状态更新，外层计算继续执行。陪跑的代价见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

**抢占会把状态一起收走。** KDA 那 12 个块号被回收后，34 层的状态没有别处能恢复，只能把整条提示词重扫一遍重建，代价见[多请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

## 常见误解

- **「线性注意力只是把 Softmax 换了个等价快算写法，输出一样。」** 能用结合律交换括号顺序的前提是去掉逐位置非线性 Softmax，相似度度量已经改变，输出并不等价；有限秩矩阵状态也装不下无限多的逐词细节。
- **「Prefill 走 Chunkwise 分块并行，算出来和 Decode 逐词递推不是一个模型。」** 段内矩阵乘与段间串行传状态只是结合律重排，数学上与逐步递推完全等价，仅差浮点累加顺序。
- **「类名里带 `GatedDeltaNet` 就一定跑标量门 GDN，没有 KV cache 就不进块池。」** 昇腾 KDA 层继承并复用了 GDN/Mamba 后端接口名（如 `Glm5NextLinearAttention` 继承 `GatedDeltaNetAttention`），实际算子仍按模型分派（`Qwen3-Next` 跑标量门 GDN，Kimi/GLM 跑对角门 KDA）；两者的双状态均通过 `MambaSpec` 纳入统一块池管理，详见[后端家族](attention-backend-family.md#放到-glm-双机一个-token-走过-45-层要问-45-次)与 [KV cache spec](kv-cache-spec.md)。
- **「状态大小固定，所以线性注意力层几乎不占显存；递推状态和短卷积状态是一回事。」** 它们是形状、精度、用途各异的两份缓存；在 GLM 双机算例中，叠加投机 4 份副本与大页对齐后，每条请求每卡占 `85.0 MiB` 页容量（`12` 个块号约 `95.6 MiB`），短请求里反而是显存大头。

## 对照源码

### 怎么开

**线性注意力由模型配置里的层类型名单直接决定，不是外挂 CLI 开关。**
- **`Qwen3-Next`（Gated DeltaNet 主线）**：`Qwen3NextDecoderLayer` 按层类型 `linear_attention` / `full_attention` 分支构造 `QwenGatedDeltaNetAttention`（未显式指定层表时默认每 4 层排 1 层全注意力，其余为线性层；默认 `conv_kernel=4, head_dim=128, key_heads=16, value_heads=32`）。[C42][C43] 昇腾侧由 `AscendGatedDeltaNetAttention` 接管：`v0.30.0` Prefill 优先走 `fla_npu` 融合路径，其次探测 `torch_npu.npu_chunk_gated_delta_rule`，回退走 Triton chunk；Decode 调 `recurrent_gated_delta_rule`。[C48]
- **`GLM-5.3-Flash` / `Kimi Linear`（KDA 分支）**：按层名单构造 KDA 层（64 头、每头 128 维、短卷积核长 4、门下界 `-5.0`）。[S1][C9] 例外 B 镜像在 vLLM 0.23.0 下通过替换表切到昇腾实现（Prefill 走 `kda_gate_cumsum` + `chunk_kda_fwd`，Decode 走 `recurrent_kda`）；`v0.30.0` 直接由 `Glm5NextLinearAttention` 调 `fla_npu.ops.ascendc`。[C8][C14][C50]
- **双状态规格与缓存模式**：GDN 递推状态 dtype 默认随短卷积 dtype，KDA 递推状态默认 `FP32`；[C44][C20] `mamba_cache_mode` 默认 `none`（每请求 $1 + N_s$ 页），昇腾补丁在 `enable_prefix_caching && mamba_cache_mode == "align"` 时取注意力 `block_size`，否则取 `max_model_len`；GLM 专用布局还将 KDA 与 MLA 主页补齐到较大单页容量。[C45][C51][C21]

### 会报什么错

| 情况 | 检查或报错 |
|---|---|
| 头数不能被 TP 整除 | 构造时断言 `num_heads % tp_size == 0`（如 KDA 64 头要求 TP 为 64 的约数） |
| Kimi KDA 卷积缓存布局或 PCP 冲突 | 布局不符报 `Ascend Kimi KDA requires the convolution cache layout [num_cache_lines, state_len, qkv_dim].`；`v0.26.0rc` Prefill 遇 PCP 报 `Kimi KDA prefill does not yet support PCP.` |
| 缺少 KDA Prefill 算子或元数据不一致 | 逐个检查 `kda_gate_cumsum`、`chunk_kda_fwd` 注册状态；行数不符报 `Kimi KDA prefill metadata is inconsistent: …` |
| `v0.30.0` / `main` GLM KDA 构造与 RecoverSSM 校验 | 强校验 `BF16` 激活、`head_dim=128`、草稿数 $\le 7$、卷积宽 2–4（开投机须为 4）、`linear_lower_bound ∈ [-5, 0)`；`main` 开启 RecoverSSM 还要求开启投机解码、禁 stochastic rounding、`PP=DCP=1` |

以上均为源码静态检查点，未在设备上故意触发（分别见来源 7、12、14、33、36）。[C7][C12]

### 开销和什么时候别开

线性注意力属于模型骨干结构，不能关闭。它省去随上下文线性膨胀的逐词 KV 读写，换来四项固有边界：① 每条请求预留定长状态页（GLM 双机算例每卡 `85.0 MiB` 页容量、`12` 个块号），短请求也照付；② Chunkwise 段内并行但段间（如段长 `64`）仍串行传状态；③ 投机解码须为 $K$ 个草稿步额外预留状态页（除非启用 `main` 的 RecoverSSM 置零投机块）；④ 有限秩状态无法无损记忆任意细节，因此 `Qwen3-Next`、`Kimi Linear` 与 `GLM-5.3-Flash` 均保留每 4 层 1 层精确注意力层。算子级实测耗时与算术强度本页未做设备采集。

### 版本差异

**GDN（`Qwen3-Next` 主线）与 KDA（`Kimi Linear` / `GLM-5.3-Flash`）在四代昇腾快照上各自演进：**
- **GDN 算子演进**：`v0.23.0` 与 `v0.26.0rc` Prefill 调昇腾 Triton `chunk_gated_delta_rule`、Decode 调 `_C_ascend.npu_recurrent_gated_delta_rule`（`v0.26.0rc` 配套上游 FLA 迁至 `vllm/third_party/flash_linear_attention/ops/`）；`v0.30.0` Prefill 按硬件能力与 PCP 条件优先选 `fla_npu` 融合路径，其次探测 `torch_npu.npu_chunk_gated_delta_rule`，回退 Triton chunk，Decode 调 `recurrent_gated_delta_rule`；`main` 进一步在自适应投机验证（adaptive GDN）中接入二维 state-index 表与独立行步长（310P 不支持该自适应路径）。
- **KDA 层演进**：与例外 B 旧镜像 `db701c1f` 分立投影相比，`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）由 `Glm5NextLinearAttention` 将 `q, k, v, b, f_a, g_a` 合并为单次 `in_proj_qkvbfg_a`，状态形状交上游 `MambaStateShapeCalculator.kda_state_shape(..., num_spec)`；`main` 新增 `PCPGlm5NextMergedColumnParallelLinear`、细粒度 `KDAInputProjectionTP` 与 `use_glm_recoverssm`（开启后上游将投机额外状态块置零）。[C33]

| 项目 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| **GDN（`Qwen3-Next`）** | `AscendGatedDeltaNetAttention`：Triton `chunk_gated_delta_rule` + `_C_ascend.npu_recurrent_gated_delta_rule` | 保持 chunk/原生 recurrent 分派；上游 FLA 迁入 `third_party/flash_linear_attention` | Prefill 优先 `fla_npu`，次选 `torch_npu.npu_chunk_gated_delta_rule`，回退 Triton；Decode 调 `recurrent_gated_delta_rule` | 新增 adaptive GDN 验证二维 state-index 表与变长上界 $1+K$（310P 不支持） |
| **KDA（Kimi / GLM）** | 仅有 Triton `chunk_kda` / `fused_recurrent_kda`（GLM 双机算例固定于专用镜像 `db701c1f`） | 新增 `AscendKimiGatedDeltaNetAttention` 与 `kimi_kda_state_shape`，AscendC `chunk_kda_fwd` / `recurrent_kda` | `Glm5NextLinearAttention` 合并 `in_proj_qkvbfg_a`，经 `ops/kda.py` 调 `fla_npu.ops.ascendc`（段长 64） | 新增 PCP 头切分、细粒度 `KDAInputProjectionTP` 与 `RecoverSSM` 验证分支 |
| **卷积投机位与构造校验** | 维护快照无 KDA 包装类（镜像手动加 `num_spec`） | `kimi_kda_state_shape` 计入 $w-1+K$，运行期校验元数据 | 交上游 `kda_state_shape(..., num_spec)`；GLM 构造期强校验 `BF16`、`head_dim=128`、草稿数 $\le 7$ | 同 `v0.30.0`，另增 `validate_glm_recoverssm` 拓扑校验并显式传 `mamba_ssm_cache_dtype` |

四版能否在双机上整套跑通例外 B 部署未做实机验证；各分支与镜像对应见[来源基线](../sources/glm-5-3-flash-baseline.md)。表中证据位置：GDN 四版见来源 46–49，KDA 四版见来源 25–27、33–36 与 50。

### 源码位置

**检索名称。** 源码里线性注意力统一挂在 `gdn` 与 `mamba` 目录下：搜 `qwen_gdn_linear_attn`、`ops/gdn.py`、`kimi_kda`、`mamba_utils` 比搜 `linear_attention` 精准；递推状态叫 `recurrent_state`，短卷积缓存叫 `conv_state`，投机接受数叫 `num_accepted_tokens`。

| 要核对什么 | 固定源码位置 |
|---|---|
| 加法/固定斜率衰减、GDN 与 KDA 统一递推核 | `vllm@ced6857a:vllm/model_executor/layers/lightning_attn.py#L653-L675`、`vllm/third_party/flash_linear_attention/ops/fused_recurrent.py#L122-L149`、`chunk.py#L23-L84` |
| `Qwen3-Next` 层选型与 `QwenGatedDeltaNetAttention` 门控 | `vllm@ced6857a:vllm/transformers_utils/configs/qwen3_next.py#L198-L218`、`models/qwen3_next.py#L485-L502`、`layers/mamba/gdn/qwen_gdn_linear_attn.py#L127-L150`、`#L2007-L2045` |
| 昇腾 `AscendGatedDeltaNetAttention` 与 `MambaSpec` 页数 | `vllm-ascend@c09d3e20:vllm_ascend/ops/gdn.py#L706-L875`、`vllm@ced6857a:vllm/model_executor/layers/mamba/mamba_utils.py#L98-L149`、`vllm/v1/kv_cache_interface.py#L993-L1063` |
| 例外 B GLM 双机 KDA 层选型、替换表、投影、短卷积与双路径 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105`、`utils.py#L763-L768`、`ops/kimi_kda.py#L244-L474`、`#L528-L659` |
| 例外 B 状态形状、大页补齐、投机页数与空批元数据门控 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32`、`patch_mamba_config.py#L44-L56`、`#L191-L228`、`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L627-L636`、`model_runner_v1.py#L3332-L3344` |

无 attention 元数据时在短卷积前早退见来源 15，外层投影继续执行见来源 11。[C38] 机制论文出处：核线性注意力结合律来自 Katharopoulos 等人，[S3] delta 误差写入与块并行来自 Schlag 等人[S4]与 Yang 等人，[S5] 标量遗忘门来自 Gated DeltaNet，[S6] 按 key 通道对角衰减 $\operatorname{diag}(\alpha)$、段长 64 与 3:1 混排比例来自 Kimi Linear。[S2] 二维算例按公式手算仅用于核对递推；[A] GLM 双机 `18.2 MiB / 85.0 MiB / 2.66 GiB / 95.6 MiB` 由 `tensor-parallel` 与部署页单块 `7.969 MiB × 12` 算得；[D] 单页对齐不代表两类层共享历史或等价于密集注意力，属源码结构推论而非实机压测。[I]

**待核。** 算子级实测耗时与算术强度、AscendC 内部按 `num_accepted_tokens` 回退短卷积的确切实现、GLM 前 3 层与后 31 层 KDA 是否存在隐藏差异，以及旧镜像最终运行时精确包组合，尚缺设备实测证据。
