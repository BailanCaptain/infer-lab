---
id: ascend-flash-attention
title: FlashAttention 与昇腾注意力算子族：片上 Tiling、Online Softmax 与 FA / FIA / PA / FA3 选路
type: concept
origin: direct
summary: >-
  从 Qwen3-8B 32K 注意力访存账出发，拆解片上分块（Tiling）与在线 Softmax 动态重标定怎样做到零近似且免把 N×N 分数表写回设备显存，再厘清 v0.30.0 昇腾算子族（FIA、PA、早期 PFA/IFA 与训推一致 FA3）的选路条件及 PIECEWISE 图模式边界。
aliases:
  - FlashAttention
  - Flash Attention
  - Flash Attention 3
  - FA3
  - Online Softmax
  - 在线 Softmax
  - FIA
  - npu_fused_infer_attention_score
  - FusedInferAttentionScore
  - PromptFlashAttention
  - IncreFlashAttention
  - _npu_paged_attention
  - npu_prompt_flash_attention
  - npu_incre_flash_attention
  - AscendFABackend
  - AscendAttentionBackend
  - 片上 Tiling
  - 注意力算子族
  - LSE
  - logsumexp
  - PA
  - PFA
  - IFA
  - npu_attention_update
  - ScatterPaKvCache
  - Slice
  - aclnnContiguous_SliceAiCore_Slice
chapters:
  - '04'
order: 65
sources:
  - 'https://arxiv.org/abs/2205.14135'
  - 'https://arxiv.org/abs/2407.08608'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/flash_attention.md#L1-L76'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/flash_attention.md#L139-L160'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/graph_mode.md#L33-L46'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L247-L289'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L854-L864'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1327-L1345'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1484-L1509'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L664-L821'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L832-L1019'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1102-L1146'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1248-L1270'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/utils.py#L284-L303'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/utils.py#L715-L735'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L11-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L61-L144'
  - 'vllm-ascend@c09d3e20:vllm_ascend/_310p/attention/attention_v1.py#L120-L324'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/utils.py#L23-L76'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/rel_pos_attention.py#L27-L45'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L869'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L816-L870'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L324-L374'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/fa3_v1.py#L15-L145'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L294-L703
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L751
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L109-L118'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L571-L586'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5054-L5076'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5884-L5931'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L212-L224'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/utils.py#L304-L317'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/attn_utils.py#L856-L888'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 先明确 Q/K/V 打分、缩放与 Softmax 加权汇合的数学定义，再看怎样不改结果地重排片上执行顺序
  - to: paged-attention
    kind: builds-on
    note: 理解分页 KV 缓存与块表寻址后，才能看清 FIA、PA 与 FA3 怎样直接消费非连续物理页
  - to: ai-core
    kind: builds-on
    note: 分清设备侧 HBM（GM）与片上高速缓冲（L1/L0 与 UB）及 Cube/Vector 分工，才能理解片上分块为何省带宽
contradicts: []
updated: '2026-11-23'
---

**FlashAttention 是一类不改变标准注意力数学结果的片上分块融合算法：它把 $Q, K, V$ 切成小块装进芯片片上高速缓冲（SRAM，昇腾向量侧称 UB），分块计算注意力而不再把整张 $N \times N$ 分数表写回设备显存。每读入一块新的 $K/V$，算法就用在线 Softmax（Online Softmax）顺手更新当前见过的最大分数与分母累加和，并按新最大值重标定旧块累加值，读完最后一块即可得到精确输出。**

沿[请求全景](request-overview.md)进入逐层前向时，每一层算完 $Q, K, V$ 投影和位置编码，紧接着就要做[注意力计算](attention-qkv.md)：$\text{Softmax}(QK^\top / \sqrt{d})\,V$。公式只有短短一行，但如果照着字面顺序拆成三个独立算子、逐步把中间结果写回设备显存执行，长上下文请求连第一层都跑不过去。

## 朴素注意力为什么会把显存与 HBM 带宽同时撑爆？

按教科书的三步写法，设备要先算完整张打分表 $S = QK^\top / \sqrt{d}$ 写回设备内存 **HBM**（高带宽显存，昇腾文档中也称全局内存 GM，见 [AI Core](ai-core.md)）。第二步把 $S$ 重新读出来按行做 Softmax 得到权重表 $P$ 再写回 HBM，第三步再把 $P$ 读出来乘 $V$ 写出最终输出 $O$。

拿本站标准标尺 **`Qwen3-8B`** 算一笔实账就能看清灾难出在哪里。`Qwen3-8B` 每层有 `32` 个查询头（`num_attention_heads = 32`）、`8` 个键值头（`num_key_value_heads = 8`），头维度 $d = 128$，采用 `BF16`（每元素 `2 B`）。当单条长上下文来到 $N = 32768$（`32K` token）时，输入 $Q$ 本身只有 $32768 \times 32 \times 128 \times 2\text{ B} = 256\text{ MiB}$，本层 $K$ 或 $V$ 更是只有 `64 MiB`。可一旦把 `[32, 32768, 32768]` 的打分矩阵 $S$ 实体化写进 HBM，仅**单层**一张 `BF16` 分数表的体积就高达：

$$32 \times 32768 \times 32768 \times 2\text{ B} = 32 \times 1024\text{ Mi} \times 2\text{ B} = 64\text{ GiB}$$

如果为了防止指数累加溢出而把 $S$ 存成 `FP32`（`4 B`），单层分数表更会直接翻倍到 **`128 GiB`**！下图把朴素三步实现与 FlashAttention 片上分块流式归约放在同一组 `Qwen3-8B` 数字下对比：

```wiki-diagram
file: ascend-fa-hbm-vs-tiling
```

对照上图，两者在单层 `32K` Prefill 下的显存占用与 HBM 往返流量差距一目了然（下表仅统计注意力核自身的输入输出与中间矩阵，不含线性投影权重）：

| 对比维度（`Qwen3-8B` 单层，$N=32768$，`BF16`） | 朴素三步实现（将 $S$ 与 $P$ 写回设备显存） | FlashAttention 片上分块实现 |
|---|---|---|
| 输入 / 输出本体（$Q, O$ 各 `256 MiB`；$K, V$ 各 `64 MiB`） | 合计约 `640 MiB`（随 $N$ 线性增长，$O(N)$） | 合计约 `640 MiB`（随 $N$ 线性增长，$O(N)$） |
| 单层 HBM 中间矩阵峰值（`[32, 32768, 32768]`） | **`64 GiB`**（若 `FP32` 达 `128 GiB`，是 $Q$ 的 `256` 倍！） | **`0 B` 写回设备显存**（仅片上缓冲暂存 KB～MB 级小分块） |
| 单层中间表 HBM 往返流量（写 $S$ + 读 $S$ + 写 $P$ + 读 $P$） | 额外吞吐约 **`256 GiB`** HBM 流量 | **`0 B`**（$S_{ij}, P_{ij}$ 全程生灭于片上缓冲） |
| 瓶颈性质 | 算力大量空转等待 HBM 读写，且单张 `64 GiB` 卡首层即爆显存 | 摘除 $O(N^2)$ 显存墙与往返带宽墙，回归计算主导 |

关键洞察在于：**注意力的算术乘加次数虽然是 $O(N^2 d)$，但真正把推理卡死的往往不是芯片乘加器算不过来，而是把 $N \times N$ 中间结果反复搬进搬出 HBM。** 只要能让局部打分 $S_{ij}$ 和权重 $P_{ij}$ 在片上缓冲区里当场算完、当场乘进 $V_j$ 并丢弃，就能彻底砍掉这 `256 GiB` 的冤枉路。

## 片上分块（Tiling）与 Online Softmax：不看全行怎样精确算对归一化？

想在片上把“打分 → Softmax → 乘 $V$”一气呵成，立刻会撞上一道硬墙：[AI Core](ai-core.md) 的片上高速缓冲（矩阵侧 `L1 / L0` 与向量侧 **UB**，即 Unified Buffer）容量只有几百 KB 到 MB 级，装不下整行 $32768$ 个键。而数值稳定的标准 Softmax 偏偏要求**先看完整行所有分数**，找出整行最大值 $m = \max_j s_j$ 并算出整行指数总和 $\sum_j e^{s_j - m}$，才能确定每个位置的权重。

FlashAttention 破局的核心，就是把**空间上的片上分块（Tiling）**与**代数上的在线重标定（Online Softmax）**咬合在一起。下图以立体拆解剖面展示一块查询分片 $Q_{\text{tile}}$ 如何在片上缓冲区内迎接流式滑过的 $K/V$ 分块，全程不把任何 $N \times N$ 分数表写回设备显存：

```wiki-diagram
file: ascend-fa-plate-cutaway
```

### Online Softmax 的三变量重标定公式

之所以不必等整行分数到齐就能边流式读块边累加，靠的是指数函数的一条基本恒等式：$e^{s - m_{\text{old}}} \cdot e^{m_{\text{old}} - m_{\text{new}}} = e^{s - m_{\text{new}}}$。对每个查询位置，片上缓冲只需维护三个随块更新的局部统计量——当前见过的最大分数 $m$、以 $m$ 为标尺的未归一化分母累加和 $l$，以及同样以 $m$ 为标尺的未归一化输出分子向量 $\tilde{O}$。

每当流式搬入一块新的 $K/V$ 分块（局部最大分数为 $m_{\text{tile}}$），就用新的更大标尺 $m_{\text{new}}$ 把旧统计量同步乘上重标定因子 $e^{m_{\text{old}} - m_{\text{new}}}$，再把新块的贡献加进来：

$$m_{\text{new}} = \max(m_{\text{old}}, m_{\text{tile}}), \qquad l_{\text{new}} = l_{\text{old}} e^{m_{\text{old}} - m_{\text{new}}} + \sum_j e^{s_j - m_{\text{new}}}, \qquad \tilde{O}_{\text{new}} = \tilde{O}_{\text{old}} e^{m_{\text{old}} - m_{\text{new}}} + \sum_j e^{s_j - m_{\text{new}}} V_j$$

等最后一个 $K/V$ 分块流过片上缓冲区后，$m$ 就是整行真正的全局最大值，$l$ 就是整行精确的归一化分母；此时只需在写回前做**唯一一次除法** $O = \tilde{O} / l$，就能把最终输出块写回右侧 HBM。

### 四数两分块手算对账：`[1, 2] + [4, 1]` 怎样在半途修正标尺？

用一组最小示意数把上面三条式子亲手走一遍，就能彻底看透重标定在做什么。设某查询位置对 4 个键的注意力分数依次为 `s = [1, 2, 4, 1]`，对应的一维值标量为 `V = [10, 20, 30, 40]`，片上缓冲每次只能装 `2` 个位置（切成第 1 块 `[1, 2]` 与第 2 块 `[4, 1]`）：

```wiki-diagram
file: ascend-fa-online-softmax-flow
```

对照上图三个阶段，把两块递推过程与“看齐全行一次算完”的标准 Softmax 逐项列在一张表里核对（小数保留四位）：

| 演进步骤（示意算例） | 当前标尺 $m$ | 重标定因子 $e^{m_{\text{old}} - m_{\text{new}}}$ | 分母累加和 $l$ | 未归一化分子 $\tilde{O}$ | 折算输出与物理含义 |
|---|---|---|---|---|---|
| **第 1 块到达**：`s=[1, 2]`，`V=[10, 20]` | $m_1 = \max(1, 2) = 2$ | 首块初始化（无旧账） | $e^{1-2} + e^{2-2} = e^{-1} + 1 \approx 1.3679$ | $10 e^{-1} + 20 \cdot 1 \approx 23.6788$ | 暂以 $m_1=2$ 记账；若序列到此结束，输出为 $23.6788 / 1.3679 \approx 17.3106$ |
| **第 2 块到达**：`s=[4, 1]`，`V=[30, 40]` | $m_2 = \max(2, 4) = 4$ | $e^{2 - 4} = e^{-2} \approx 0.1353$ | $l_1 e^{-2} + (e^{4-4} + e^{1-4}) = (e^{-3}+e^{-2}) + (1+e^{-3}) \approx 1.2349$ | $\tilde{O}_1 e^{-2} + (30 \cdot 1 + 40 e^{-3}) = (10e^{-3}+20e^{-2}) + (30+40e^{-3}) \approx 35.1961$ | 旧账乘 $e^{-2}$ 精准缩回新标尺 $m_2=4$ 下，不重读第 1 块原始数据 |
| **流式收尾归一**：单次除 $l_2$ | $m_2 = 4$ | — | $l_2 \approx 1.2349$ | $\tilde{O}_2 \approx 35.1961$ | $O = \tilde{O}_2 / l_2 \approx \mathbf{28.5009}$ |
| **全量 Softmax 对照**：一次读齐 `[1, 2, 4, 1]` | 全局最大 $m = 4$ | 全行减 $4$ 得 `[-3, -2, 0, -3]` | $e^{-3} + e^{-2} + 1 + e^{-3} \approx 1.2349$ | $10e^{-3} + 20e^{-2} + 30 + 40e^{-3} \approx 35.1961$ | 权重 `[0.0403, 0.1096, 0.8098, 0.0403]`，加权和 $\mathbf{28.5009}$（**代数严格相等**） |

这里顺便埋下一条贯穿分布式章节的伏笔：**在单张 NPU 上让 $K/V$ 分块沿时间流过片上缓冲，叫 FlashAttention。把同一条超长序列的 $K/V$ 分块拆到多张 NPU 卡上各算局部输出与对数指数和（`LSE`，Log-Sum-Exp，即 $\text{LSE} = m + \ln l$），再跨卡按同一公式重标定合并，就是[上下文并行（PCP / DCP）](context-parallel.md)。** 在 `vllm-ascend` 中，`merge_prefill_chunks` 调用 `torch_npu.npu_attention_update` 合并多段 `(out_list, lse_list)`，底层执行的正是同一套代数重标定。

## 昇腾注意力算子族与 v0.30.0 选路：FIA / PA / 早期拆算子与 FA3 各管哪一段？

读昇腾推理文档与源码时，初学者常被一串带 `flash_attention` 或 `paged_attention` 的算子名绕晕。落到 `vllm-ascend v0.30.0` 主干（后端抽象分工见[注意力后端](attention-backend-family.md)），密集 MHA / GQA 的选路其实很清晰：`NPUPlatform.get_attn_backend_cls` 先分出训推一致分支 `FA3` 与默认推理主干 `AscendAttentionBackend`，后者再在 `forward_impl` 内按批状态在 **`FIA`** 与 **`PA`** 之间二选一：

```wiki-diagram
file: ascend-fa-operator-routing
```

顺着上图的分流节点，把昇腾注意力算子族中五类常见入口的定位、输入形态与 `v0.30.0` 真实命中条件放在一起对照：

| 算子族成员与 `torch_npu` 入口 | 在 `v0.30.0` 中的真实角色 | KV 读取形态与支持阶段 | 命中条件与硬件范围 |
|---|---|---|---|
| **统一推理主力 `FIA`**（`npu_fused_infer_attention_score` / `_v2`） | `A2 / A3 / 950DT` 默认后端 `AscendAttentionBackend` 的**全阶段默认主力** | `input_layout="TND"`（`Token-NumHeads-HeadDim`，将变长序列首尾拼接的紧凑排布）；无缓存时直读稠密 `K/V`，其余状态凭 `block_table` 直读分页 [KV cache](kv-cache.md)（见[块表](block-table.md)） | 统包 `PrefillNoCache`、`PrefillCacheHit`、`ChunkedPrefill`、`SpecDecoding` 与默认 `DecodeOnly`；带可学习 `sinks` 时切 `_v2`；支持 `full_graph_fia` 全图捕获 |
| **分页解码算子 `PA`**（`torch_npu._npu_paged_attention`） | 仅针对特定纯 Decode 形状或大头模型的条件分流路径 | 从分页 `key_cache` / `value_cache` 按 `block_table` 与 `context_lens` 收集历史 | 标准后端须同时满足 `DecodeOnly`、无 `sliding_window`、无投机解码、`A2/A3`（**`950DT` 不开启 `PAGED_ATTENTION`**），且 `head_size == 512`（如 `Gemma4`）或 `FULL_DECODE_ONLY` 下批长显式列入 `pa_shape_list`（默认 `[]`） |
| **训推一致后端 `FA3`**（`flash_attn_npu_v3.flash_attn_with_kvcache`） | 面向强化学习（如 `veRL`）对齐训练侧归约顺序的 `AscendFABackend`（`beta`） | 接收分页缓存（固定块大小 `128`）与 `page_table`；混合批拆成 Decode 与 Prefill 两段分别调用再拼接 | 仅 **Atlas A2 / A3**，须未开 `PCP`、装好 `flash_attn_npu` 包，且显式开启 `rl_config.enabled` 与 `enable_training_consistency`；**图模式仅支持 `PIECEWISE`（或 eager）** |
| **`310P` 兼容算子组**（`_npu_flash_attention(_v3)` + `_npu_paged_attention(_splitfuse)`） | `Atlas 300I DUO (310P)` 专用 `AscendAttentionBackend310` 执行栈 | Prefill 走 `_npu_flash_attention(_v3)`，Decode 走 `_npu_paged_attention`，分块混合批走 `_splitfuse(_v2)` | 硬件档案属于 `COMPATIBILITY` 族（`310P`，仅 `FP16` / `W8A8-310P`）时自动接管 |
| **早期拆算子 `PFA / IFA`**（`npu_prompt_flash_attention` / `npu_incre_flash_attention`） | 早年未统一分页前的“Prefill 一套、单步 Decode 一套”旧接口 | 仅吃连续稠密张量（如 `BNSD`，即 `Batch-NumHeads-SeqLen-HeadDim` 四维定长排布），不带分页 `block_table` | `npu_incre_flash_attention` 在 `v0.30.0` 主仓已**零生产调用**；`npu_prompt_flash_attention` 仅残留于多模态视觉相对位置编码器（`rel_pos_attention.py`）；另大头 `head_size == 512` 的 Prefill 回退走 `npu_fusion_attention` |

这里最值得纠正一个过时印象：**不要再把昇腾推理记成“Prefill 调 `PromptFlashAttention`、Decode 调 `IncreFlashAttention` 或一律调 `_npu_paged_attention`”。** 在 `v0.30.0` 的 `A2 / A3 / 950DT` 默认配置下（`pa_shape_list` 默认为空列表 `[]`），从首轮 Prefill、Chunked Prefill 到每步常规 Decode，主力路径全部由 `FIA` 一套算子跑通。即便在 `950DT` 混合批或开启批不变（`VLLM_BATCH_INVARIANT`）时，`AscendAttentionBackendImpl` 也只把混合批拆成两次独立的 `FIA` 调用，而不会退回旧拆算子。

### 关键耦合红线：为什么开启 FA3 必须配 PIECEWISE 图模式？

先把名字对齐：开源论文里的 FlashAttention-3 主打 NVIDIA Hopper 架构的异步流水与 `FP8` 低比特吞吐；昇腾 `vllm-ascend v0.30.0` 文档所说的 **`FA3`**（处于 `beta` 阶段）则是另一回事。它面向强化学习场景（详见 [vLLM-Ascend for RL](vllm-ascend-for-rl.md)），让推理侧注意力与训练框架（如 `veRL`）使用的 FlashAttention 保持一致，避免默认 `FIA` 与训练侧浮点累加顺序不同引发策略训练偏差。官方亦明确提示，开启 `FA3` 后相比默认 `FIA` 可能出现性能回落。

```wiki-diagram
file: ascend-fa-fig-piecewise-vs-fullgraph
```

在 `v0.30.0` 中启用 `FA3`，有三条刚性约束必须同时对齐：

1. **配置入口看 `rl_config`，不看 `--attention-backend`**：`NPUPlatform` 在配置检查阶段会把手工传入的 `attention_config.backend` 重置为 `None`。触发 `_validate_fa3_backend` 的唯一条件是未开启 `PCP`，且 `--additional-config` 同时设置 `rl_config.enabled: true` 与 `rl_config.enable_training_consistency: true`。
2. **模型与精度边界严格**：仅支持 `Atlas A2 / A3` 上的密集 MHA / GQA（`FP16` / `BF16`，固定块大小 `128`，已在 `Qwen3-8B` 与 `Qwen3-30B-A3B` 验证）。MLA / SFA（稀疏闪电注意力）、滑动窗口（`sliding_window`）、ALiBi（线性位置偏置）、Softcapping（分数软截断）与 `FP8` 注意力均不支持。其中 MLA/SFA 与滑窗直接抛 `ValueError`，核内不支持 RoPE 则自动回退到核外 PyTorch 原生 RoPE。
3. **图模式只支持 `PIECEWISE`（或关闭图捕获），严禁全图模式**：`flash_attn_with_kvcache` 的分块参数在 **Host CPU 侧**计算，前向还会对序列长度做 `.npu()` 搬运并在宿主侧求最大值。由于未接入全图捕获任务注册（`register_task`），它**无法录进 [ACL Graph](acl-graph.md) 整图回放**。只有显式指定 `--compilation-config '{"cudagraph_mode": "PIECEWISE"}'`，编译层才会把注意力列入切点（`splitting_ops`）留在图外调用，把前后线性层与归一化录进子图加速。

> **边界与例外（`FA3` 不会自动降级全图模式）**：`AscendFABackend` 复用了声明 `AttentionCGSupport.ALWAYS` 的通用元数据构建器，框架不会自动降级。若配成 `FULL_DECODE_ONLY`（且未开 `enforce_eager`），`AscendFAImpl.__init__` 当场抛出 `ValueError`；保留含全图路径的模式也会在运行期因 Host 侧分块而捕获失败。

## 实测劣化剖析：页交错 KV 布局为何在 FIA 内部触发整池连续化？

前面讲清了片上分块怎样免把 $N \times N$ 分数表写回设备显存。但在 `Ascend 910B3`（`CANN 9.1.0` + `vllm-ascend v0.30.0`，详见 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)）真机采集里，普通 GQA 模型在 Eager Decode 下却暴露出一笔远超注意力计算本身的隐性 HBM 搬运税。根源正是 **KV 池按页交错排布的非连续视图** 与 **`FIA` 算子内部前置连续化** 撞在了一起：

```wiki-diagram
file: afa-fig-kv-interleaved-contiguous-tax
```

顺着上图从分配器到设备 kernel 逐环对账，可以看到完整因果链：

1. **分配端：页交错步长 `(H, 2H)` 让 `K / V` 独立视图跨页非连续。** `AscendAttentionBackend.get_kv_cache_shape` 声明的逻辑形状是 `[2, num_blocks, block_size, kv_heads, head_dim]`。普通 GQA 层在 `NPUModelRunner` 中分配单块共享显存，再用 `torch.as_strided` 将前两维步长设为 `(H, 2H)`（单页跨度 $H = \text{block\_size} \times \text{kv\_heads} \times \text{head\_dim}$），物理上每一页 $K$ 紧跟同页 $V$。单独取出 `kv_cache[0]`（$K$）或 `kv_cache[1]`（$V$）后，每跳下一页都要跨过对侧的 $H$ 个元素，跨页不连续。线上 `Qwen3-8B` DEBUG 日志直接印证：`shape=(2, 2064, 128, 8, 128)`、`stride=(131072, 262144, 1024, 128, 1)`、`k_contiguous=False`、`v_contiguous=False`。
2. **执行端：Decode 阶段 `FIA` 内部按整池形状触发 2× 大 `Slice`。** 写入端先用 `ScatterPaKvCache` 按 `slot_mapping` 写入新 token；读取端 `DecodeOnly` 通过 `_get_kv_cache_view` 将整池视图压成 `[num_blocks, block_size, kv_heads * head_dim]`，连同 `block_table` 交给 `FIA`。虽然 Python 封装只在 `block_table is None` 时显式调用 `.contiguous()`，但两份 Eager Profiler 轨迹（关联 `connection_id` 与 Host `Node@launch`）坐实：**有块表的 Decode 在 `aclnnInnerFusedInferAttentionScore` 内部调用了 `aclnnContiguous`（设备核 `aclnnContiguous_SliceAiCore_Slice`）**。设备执行顺序为 `ScatterPaKvCache → 大 Slice → 大 Slice → FusedInferAttentionScore`。块表只限制了后续注意力要读的有效历史，前置连续化仍无视命中块数、按整池形状把全部物理块复制一遍（`aiv_mte2_ratio` 达 `0.985 ~ 0.993`、`aiv_vec_ratio` 为 `0`，纯 HBM 搬运）；首个无块表 Prefill 步则未触发。

两份 Eager 三步轨迹（1 步 Prefill + 2 步单 token Decode）将这笔搬运税精确钉死在设备级恒等式上：

| 910B3 Eager 实测对照（3 步采样） | `Qwen3-8B`（36 层，`u=0.75`，`1,678` 块） | 2 层裁剪 MoE（`u=0.60`，dummy 权重，`66,139` 块） |
|---|---|---|
| 整池大 `Slice` 触发次数与单次耗时 | `144 / 144` 次（每 Decode 步 `36×2 = 72` 次），`593.60 ~ 691.48 µs` | `8 / 8` 次（每 Decode 步 `2×2 = 4` 次），**`13.45 ~ 13.67 ms`** |
| 每 Decode 步大 `Slice` 合计耗时与最低读写量 | **`46.16 ms / 步`**（`46.1552 / 46.1554 ms`），最低读写 **`58.992 GiB`**（`1.372 TB/s`） | **`54.23 / 54.28 ms / 步`**，最低读写 **`64.589 GiB`**（`1.278 TB/s`） |
| `FIA` 真实计算核（3 步合计） vs 整池 `Slice` 归属 | `108` 次 `FIA` 核仅 **`2.356 ms`**（占父算子 `94.666 ms` 的 `2.5%`）；大 `Slice` 占 `97.5%` | `6` 次 `FIA` 核仅 **`0.145 ms`**（父算子 `108.648 ms` 中大 `Slice` 占 `108.503 ms`） |
| 整池大 `Slice` 占 `op_statistic` 全部设备算子时间（全部 `Slice` 含小 `Slice`） | **`62.220%`**（`92,310.60 / 148,361.38 µs`；全部 290 次 `Slice` 含 146 次小 `Slice` 占 `62.463%`） | **`95.990%`**（`108,502.88 / 113,035.98 µs`；全部 18 次 `Slice` 占 `96.012%`；单视图 `8.074 GiB` 为 `8B` `0.410 GiB` 的 `19.71×`） |

2 层裁剪 MoE 之所以单次 `Slice` 高达 `13.67 ms`、大 `Slice` 占到设备算子总时间的 `95.990%`（全部 `Slice` 含小 `Slice` 为 `96.012%`），是因为空闲显存全部分给仅 2 层后每层物理池暴涨至 `66,139` 块。这直接证明**整池连续化的搬运字节数与已分配总物理块数呈线性正比**（因此该 96% 级占比不能误当作 48 层真权重 MoE 的路由开销）。

这一机制与线上观测相互印证，同时也必须严格区分**已实测事实**与**待验证条件假设**：

- **固定 `TP=1` 提升并发时的批内摊销现象与条件解释：** 线上 `Qwen3-8B` `TP=1`（`u=0.85`，运行期实测 KV 使用率仅 `0.8%`）从 `c=1` 提到 `c=16` 时，单请求 `TPOT` 仅从 `78.54 ms` 微增至 `80.77 ms`（**`+2.23 ms / +2.84%`**），整批吞吐却从 `12.73` 跃升至 **`195.28 tok/s`（`15.3×`）**。批内各并发请求会共享权重读取及步级固定开销。**若**线上 `FULL` 图确实重放了与 Eager 相同的整池 KV 连续化（待线上设备时间线验证的条件假设），该整池复制同样按步按层执行一次并在批内摊销，与上述近乎平坦的 `TPOT` 平台期吻合。
- **线上 `FULL` 图的强条件假设边界：** 线上服务日志确认单请求 Decode 实际运行的是 `FULL` 图（`npu_fused_infer_attention_score.out` 在 `graph_task_group` 内捕获并重放），排除了“每层注意力因分段图退回 Host”的旧猜测。**若**图内重放同等整池连续化且保持 Eager 有效带宽（`1.372 TB/s`），按线上 `2,064` 块（`36.28 GiB`）条件外推每步约 **`56.77 ms`**（相当于实测 `78.54 ms` TPOT 的 `72.3%`）。固定 `u=0.85` 扩 `TP=1→8` 时，权重腾出的显存回填 KV 池，使每卡本地池从 `36.28` 涨至 `49.27 GiB`、条件外推复制耗时从 `56.77` 增至 `77.09 ms`，与负 TP 扩展趋势吻合（详见 [Tensor Parallel 负扩展剖析](tensor-parallel.md#ascend-910b3-实测qwen3-8b-从-tp1-扩到-tp8-为何出现负扩展)）。必须强调：因当前采集包缺少同配置 `FULL` 回放的设备 kernel 时间线，线上 `FULL` 是否触发整池拷贝、批内整池拷贝是否实际发生以及 `56.77 → 77.09 ms` 的时延份额均属于**待线上设备时间线验证的条件假设**，不能写成已测得的线上定论。
- **版本边界与连续布局对照：** 固定 `main`（`8d6180e2`）对普通非 PA 注意力层依然保留单块共享显存与页步长 `as_strided` 视图，不能推定升级到该提交即可自动消除拷贝税。源码中虽有连续 K/V 分配分支（`requires_contiguous_pa_kv_cache`），但对 128 维头的普通层须同时满足 `A2/A3` 硬件、无投机解码、`FULL_DECODE_ONLY` 与匹配批长的 `pa_shape_list`（默认为空），单改图模式不会自动切到连续 `PA` 布局。

## 常见误解

- **「`FIA` 传入了 `block_table`，就只会搬运当前请求实际命中的少量历史块？」**：在普通 GQA 页交错非连续布局的 Eager Decode 实测中并非如此。`block_table` 只限定了注意力算子读取的有效历史，但 `aclnnInnerFusedInferAttentionScore` 在进入核心计算前会先按整池非连续视图执行 `aclnnContiguous_SliceAiCore_Slice`，把整卡已分配的物理 KV 池全部搬运一遍；拷贝字节数随总物理块数线性增长，而非仅随当前序列长度增长。
- **「FlashAttention 靠丢弃低权重位置省显存，是一种稀疏近似？」**：错。Online Softmax 的递推式与看齐全行再做 Softmax 在实数代数上逐项严格相等，没有任何稀疏裁剪或低秩近似；有限精度下的微小差别仅来自浮点加法的先后结合顺序。
- **「昇腾 `FA3` 就是照搬 Hopper GPU 的异步 `FP8` FlashAttention-3，开了比默认更快？」**：错。昇腾 `v0.30.0` 的 `FA3`（`beta`）不支持 `FP8` 注意力，核心用途是在 RL 训练框架（如 `veRL`）中对齐训练与推理的注意力实现；日常纯推理服务继续用默认 `FIA` 即可，强开 `FA3` 反而可能降低吞吐并失去全图捕获。
- **「在 `v0.30.0` 传 `--attention-backend FLASH_ATTN` 就能切到 `FA3`？」**：错。`v0.30.0` 的 `NPUPlatform` 会把手工指定的 `attention_config.backend` 重置为 `None`，必须通过 `--additional-config` 打开 `rl_config.enabled` 与 `rl_config.enable_training_consistency`，并显式搭配 `PIECEWISE` 图模式。
- **「Prefill 走 FlashAttention，Decode 一定全部走 `_npu_paged_attention`？」**：错。`v0.30.0` 中 `pa_shape_list` 默认为空列表 `[]`；除 `head_size == 512` 大头回退、显式配置 `pa_shape_list` 的 `A2/A3` `FULL_DECODE_ONLY` 档位以及 `310P` 兼容后端外，常规 Decode 与 `950DT` 全程都由带 `block_table` 的统一算子 `FIA` 承担。
- **「Online Softmax 只是单卡算子内部的小技巧，和分布式并行无关？」**：错。跨卡上下文并行（PCP / DCP）把长序列历史分在多张卡上各算局部输出，再用 `npu_attention_update` 归约全局结果，靠的正是完全同一套 $(m, l)$ / `LSE` 重标定代数。

## 对照源码

### 怎么开

- **标准推理路径（默认开启 `FIA`，无需额外注意力参数）**：在 `Atlas A2 / A3 / 950DT` 上直接启动 `Qwen3-8B` 或 `Qwen3-30B-A3B` 时，`NPUPlatform.get_attn_backend_cls` 默认返回 `AscendAttentionBackend`，底层自动调用 `npu_fused_infer_attention_score`（可配合 `FULL_DECODE_ONLY` 等图模式捕获全图）。若在 `A2 / A3` 的 `FULL_DECODE_ONLY` 模式下希望对指定解码批大小改走 `_npu_paged_attention`，可通过 `--additional-config '{"pa_shape_list": [1, 2, 4, 8]}'` 按需指定。
- **RL 训推一致路径（显式开启 `FA3` + 必配 `PIECEWISE` 图模式）**：在 `Atlas A2 / A3` 上安装好外部 `flash_attn_npu` wheel 包后，按如下命令启动 [S3]：

```bash
vllm serve Qwen/Qwen3-8B \
  --additional-config '{"rl_config": {"enabled": true, "enable_training_consistency": true}}' \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

若同时需要批不变性（batch invariance），可在同一 `rl_config` 字典内追加 `"enable_batch_invariant": true`，无需手工导出 `VLLM_BATCH_INVARIANT` 环境变量。

### 会报什么错

| 拦截位置 | 触发条件 | 实际抛出的异常或日志行为 |
|---|---|---|
| `_validate_fa3_backend` | 未同时开启 `rl_config.enabled` 与 `rl_config.enable_training_consistency` | 不报错，打印日志提示不启用 `FA3`，回退插件默认注意力后端 |
| `_validate_fa3_backend` | 开启训推一致但模型属于 MLA 或稀疏注意力（`key != (False, False)`） | `ValueError: FA3 backend does not support MLA and SFA.` |
| `_validate_fa3_backend` | 未安装 `flash_attn_npu_v3` 或包内缺少 `flash_attn_with_kvcache` | 分别抛出对应的 `ValueError` 提示安装或核查 `flash_attn_npu_v3` |
| `AscendFAImpl.__init__` | 模型配置含滑动窗口（`sliding_window is not None`） | `ValueError: AscendFAImpl does not support sliding window attention...` |
| `AscendFAImpl.__init__` | 未开 `enforce_eager` 且 `cudagraph_mode == FULL_DECODE_ONLY` | `ValueError: AscendFAImpl does not support ACL graph capture with FULL_DECODE_ONLY mode...` |
| `NPUPlatform` 配置检查 | 用户手工传入 `--attention-backend`（如 `FLASH_ATTN`） | 打印日志说明由昇腾注册插件接管，并将 `att_config.backend` 重置为 `None` |
| `AscendAttentionBackendImpl.__init__` | 未量化 GQA 模型传入 `--kv-cache-dtype int8`（无配方 `enable_c8_quant` 且非 MXFP） | 抛出 `ValueError: The current GQA-related models adopt static quantization...`（910B3 真机标本已复现，见 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)） |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 默认密集后端与 `FIA / PA` 分流 | `AscendAttentionBackend`；`PA` 排除 `A5` 且看 `FULL_DECODE_ONLY` + `pa_shape_list`，其余走 `FIA` | 与 `v0.23.0` 一致 | 改由 `HardwareProfile` 判断 `PAGED_ATTENTION` 能力（`A2/A3` 支持，`950DT` 不开启）；新增 `950DT` 混合批与批不变拆两段 `FIA` | 延续 `FIA` 主力与 `PA` 条件分流；分设仅限 `950DT (A5)` 特定投机草稿层的 `fa_v1` 分支，以及仅限 `A2 / A3`（`FLASH_ATTN_NPU_3`）的 `MiniMax` 投机路径 `flash_attention_v3` 分支 |
| 普通 GQA KV 物理布局与连续性 | 早期独立或连续块分配 | 过渡期布局演进 | 对非 PA 普通 GQA 层默认分配单块共享显存，经 `torch.as_strided` 设为 `(H, 2H)` 页交错步长（`k/v_contiguous=False`）；仅命中 `requires_contiguous_pa_kv_cache` 时走连续布局 | `worker/v2/attn_utils.py`（`_reshape_combined_attention_kv_cache`）延续单块共享显存与页步长 `as_strided` 视图，不能仅靠升至该提交推定拷贝税消失 |
| `FA3` 启用开关 | 须显式传 `FLASH_ATTN` 且开启批不变（`VLLM_BATCH_INVARIANT=1`） | 与 `v0.23.0` 一致 | 与批不变解耦，改为 `not use_pcp` 且 `rl_config.enabled` 与 `enable_training_consistency` 同为 `true`；手工 `backend` 被重置为 `None` | 启用门禁与 `v0.30.0` 一致；`AscendFABackend` 新增 `supports_batch_invariance() -> True` |
| `FA3` 混合批 Decode 因果开关与图限制 | Decode 段固定传 `causal=False`；因 Host 侧 tiling 须配 `PIECEWISE`（或 eager） | 与 `v0.23.0` 一致 | Decode 段仍固定传 `causal=False`；`FULL_DECODE_ONLY` 抛 `ValueError`，官方指南强制配 `PIECEWISE` | Decode 段改为 `num_decode_tokens > num_decodes` 动态决定因果掩码，并修正混合批 `block_tables` 与 `query_start_loc` 切片偏移 |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法原论文与官方特性指南**：FlashAttention 片上分块与 Online Softmax 复杂度推导见 Dao 等原论文 [S1]；Hopper GPU 上的 FlashAttention-3 设计对照见 Shah 等论文 [S2]；昇腾 `FA3` 训推一致定位、特性支持表与 `PIECEWISE` 启动示例见 `flash_attention.md` 前半部分 [S3]，不支持滑窗 / ALiBi / Softcapping / `FP8`、Host 侧 tiling 无法做 ACL 图捕获、核外原生 RoPE 回退与已验证 Qwen3 模型清单见同文档限制节 [S4]；`ACLGraph`、`FULL_DECODE_ONLY` 与 `PIECEWISE` 编译运行差异见 `graph_mode.md` [S5]。单层 `Qwen3-8B` 在 $N=32768$ 下 `64 GiB` 分数表与四数两分块重标定数值由张量形状及 Softmax 定义直接算出 [D]。
- **平台后端选择与 `FA3` 校验门禁**：`NPUPlatform.get_attn_backend_cls` 对 `FA3`、标准 `backend_map`、`310P` 兼容表与 `PCP` 表的路由见 `platform.py:247-289` [C6]；重置手工 `att_config.backend = None` 见 `platform.py:854-864` [C7]；`PIECEWISE` 模式下配置 `splitting_ops` 将注意力切出捕获子图见 `platform.py:1327-1345` [C8]；`_validate_fa3_backend` 检查 `rl_config` 双开关、拦截 MLA/SFA 及校验 `flash_attn_npu_v3.flash_attn_with_kvcache` 见 `platform.py:1484-1509` [C9]。
- **`FIA`、`PA` 与跨块重标定实现**：`full_graph_fia`、`_v2` 与 `full_graph_pa` 的全图捕获任务注册见 `attention_v1.py:664-821` [C10]；`_get_fia_params` 与 `forward_fused_infer_attention` 按运行态组装 `TND` + `block_table`、带 `sinks` 切 `_v2` 及混合批两段切分见 `attention_v1.py:832-1019` [C11]；`forward_paged_attention` 调用 `torch_npu._npu_paged_attention` 与编码器调用 `npu_fusion_attention` 见 `attention_v1.py:1102-1146` [C12]；`forward_impl` 在 `PA` 与 `FIA` 间的分流见 `attention_v1.py:1248-1270` [C13]；`using_paged_attention` 的硬件能力、`head_size == 512`、`FULL_DECODE_ONLY` 与 `pa_shape_list` 判据见 `attention/utils.py:284-303` [C14]；`merge_prefill_chunks` 调用 `torch_npu.npu_attention_update` 归约多块 `(out, lse)` 见 `attention/utils.py:715-735` [C15]。
- **`FA3` 适配层、兼容硬件与四版本演进**：`AscendFABackend` 块大小 `[128]` 及 `AscendFAImpl.__init__` 拒绝滑窗和 `FULL_DECODE_ONLY` 见 `fa3_v1.py:11-60` [C16]；混合批拆两段调用 `_flash_attn_with_kvcache` 见 `fa3_v1.py:61-144` [C17]；`310P` 兼容后端调用 `_npu_flash_attention(_v3)` 与 `_npu_paged_attention(_splitfuse)` 见 `_310p/attention/attention_v1.py:120-324` [C18]；`head_size == 512` 大头 Prefill 收集分页缓存回退 `npu_fusion_attention` 见 `device/utils.py:23-76` [C19]；多模态编码器残留 `npu_prompt_flash_attention` 调用见 `rel_pos_attention.py:27-45` [C20]；`v0.23.0` 与 `v0.26.0rc` 旧版 `FA3` 依赖 `FLASH_ATTN` + `use_batch_invariant` 见两分支 `platform.py` [C21][C22]；`main` 新增草稿/MiniMax 分支及修正 `FA3` 多 token Decode 因果条件与切片见 `8d6180e2` 对应文件 [C23][C24]。
- **910B3 非连续页交错 KV 实测与源码锚点**：线上 `shape=(2, 2064, 128, 8, 128)` / `stride=(131072, 262144, ...)`、`k/v_contiguous=False`、线上 `FULL` 日志，以及 `Qwen3-8B`（`144` 次整池大 `Slice` = `46.16 ms/步`，占总算子 `62.220%`，全部 `Slice` 占 `62.463%` vs `FIA` 核 `2.356 ms`）与 2 层裁剪 MoE（`8` 次大 `Slice` 单次 `13.67 ms`，占总算子 `95.990%`，全部 `Slice` 占 `96.012%`）原始摘录见 `sources` 第 25 项 [M25]；`Qwen3-8B` `TP=1` `c=1→c=16` `TPOT` `78.54→80.77 ms` 与吞吐 `12.73→195.28 tok/s` 线上 `INFO` 实测见第 26 项 [M26]；对应源码锚点为 `attention_v1.py:109-118`（`get_kv_cache_shape`，第 27 项）、`attention_v1.py:571-586`（GQA 静态 C8 校验，第 28 项）、`model_runner_v1.py:5054-5076` 与 `:5884-5931`（`strided_attention_cache_layers` 与 `torch.as_strided` `(H, 2H)` 视图，第 29–30 项）、`device_op.py:212-224`（仅 `block_table is None` 显式 `.contiguous()`，第 31 项）、`attention/utils.py:304-317`（`requires_contiguous_pa_kv_cache`，第 32 项）与 `main` `v2/attn_utils.py:856-888`（`_reshape_combined_attention_kv_cache`，第 33 项），完整实测档案见 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)。线上 `FULL` 图是否重放整池复制、批内整池拷贝摊销及按 Eager 速率外推的 `56.77 ms` 均属待线上设备时间线验证的条件假设 [I]。
