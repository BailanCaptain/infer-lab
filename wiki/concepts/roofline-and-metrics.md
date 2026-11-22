---
id: roofline-and-metrics
title: Roofline 模型与性能三角：算力墙 vs 带宽墙与算术强度拐点
type: concept
origin: direct
summary: >-
  连接第三章的请求调度与第四章的昇腾硬件：先拆清首字时延 TTFT、流式间隔 ITL、每词均值 TPOT 与系统吞吐组成的性能三角，再用算术强度与 Roofline 折线解释为什么单请求 Decode 卡在 HBM 带宽斜坡、Prefill 撞上 Cube 算力屋顶，以及批处理与 W8A8 量化如何移动工作点。
aliases:
  - Roofline
  - Roofline 模型
  - 计算强度
  - 算术强度
  - arithmetic intensity
  - 算力墙
  - 带宽墙
  - 性能三角
  - 脊点
  - ridge point
  - 算术强度拐点
chapters:
  - '04'
sources:
  - 'https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/Archive/EECS-2008-134.pdf'
  - >-
    https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf
  - 'vllm@ced6857a:docs/benchmarking/cli.md#L123-L161'
  - 'vllm@ced6857a:docs/design/metrics.md#L48-L81'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/performance_benchmark.md#L113-L203'
  - 'vllm@ced6857a:vllm/v1/metrics/stats.py#L217-L258'
  - 'vllm@ced6857a:vllm/v1/metrics/stats.py#L455-L585'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L139-L161'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L675-L718'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L811-L865'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L1110-L1180'
  - 'vllm@ced6857a:vllm/v1/metrics/buckets.py#L14-L115'
  - 'vllm@ced6857a:vllm/v1/metrics/perf.py#L92-L148'
  - 'vllm@ced6857a:vllm/v1/metrics/perf.py#L1740-L1835'
  - 'vllm@ced6857a:vllm/config/vllm.py#L446-L452'
  - 'vllm@ced6857a:vllm/config/vllm.py#L2325-L2344'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2936-L2952'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L65-L135'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L167-L213'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L60-L95'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L232-L244'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L754-L845'
  - 'vllm@568afb3a:vllm/v1/metrics/loggers.py#L796-L886'
  - 'vllm@ba15685a:vllm/v1/metrics/loggers.py#L831-L965'
  - 'vllm@ba15685a:vllm/v1/metrics/buckets.py#L195-L240'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: builds-on
    note: Prefill 一次并行算完提示词、Decode 每步只进一个新词，两阶段行数差异直接决定了它们在 Roofline 上的落点
  - to: kv-cache
    kind: builds-on
    note: KV cache 免去了历史位置重复乘加，但在长上下文 Decode 中也会变成无法跨请求摊薄的显存带宽大户
  - to: matmul-and-weights
    kind: builds-on
    note: 沿线性投影矩阵乘法的行列形状统计乘加次数与读写字节数
  - to: hf-model-anatomy
    kind: builds-on
    note: 复用 Qwen3-8B 与 Qwen3-30B-A3B 的总参数、激活参数与每 token KV 静态账单
contradicts: []
updated: '2026-11-18'
---

**判断一套推理部署究竟“卡在算得慢”还是“卡在搬得慢”，不能只看 NPU 忙碌百分比，而要先分清首字时延、吐字间隔与系统吞吐三项指标，再用每搬运一字节能做多少次乘加运算（算术强度）放到硬件的 Roofline 屋顶下定位瓶颈。**

在第三章走完 [Prefill 与 Decode](prefill.md)、[KV Cache](kv-cache.md) 与 [Chunked Prefill](chunked-prefill.md) 后，我们已经看到：处理提示词和逐词生成执行的是同一套权重，脾气却截然相反。迈入昇腾硬件与量化章节之前，本页先立起衡量推理快慢的标尺与物理上限模型，回答三个核心工程问题：

- 压测报告里的 `TTFT`、`TPOT`、`ITL` 与 `tokens/s` 各在量哪一段？
- 为什么单请求 Decode 连芯片 1% 的算力都发挥不出来？
- 拼批（Batching）和 `W8A8` 量化又是怎样把工作点往屋顶上推的？

## 推理性能三角：TTFT、TPOT / ITL 与系统吞吐为什么互相拉扯

线上推理服务同时面对两类诉求：坐在屏幕前的用户关心“等多久出第一个字、后面吐字卡不卡”，平台方则关心“一张昇腾卡一秒总共能产出多少个词”。在 `vllm-ascend@c09d3e20`（配套 `vllm@ced6857a`）主基线中，引擎与压测工具围绕一条请求的生命周期定义了四项时延指标与两类系统吞吐：

```wiki-diagram
file: roofline-triangle-and-timeline
```

顺着上图上半部分的请求生命线，可以把服务端统计（`vllm/v1/metrics/stats.py`）与压测客户端（`vllm bench serve`）的口径逐项对齐。注意客户端包含网络收发与 HTTP 流式拆包耗时，而服务端从引擎前端收到请求开始计时（跨工具对比见[性能测量基准](inference-benchmarking.md)）：

| 指标名称 | 统计起点与终点 | 公式或采样粒度 | 线上体感与工程含义 |
| --- | --- | --- | --- |
| **TTFT**（Time To First Token，首字时延） | 请求到达（`arrival_time`）→ 第 1 个输出词生成完毕 | 单请求记 1 次：$\text{TTFT} = t_{\text{first}} - t_{\text{arrival}}$ | 用户敲下回车后的“冷场等待”，等于**队列排队时间 + Prefill 前向耗时**（第 1 个输出词由 Prefill 末位直接选出） |
| **ITL**（Inter-Token Latency，流式包间隔） | 相邻两次流式输出（streamed output）就绪时刻之差 | 每次 Decode 流式产出记 1 次：$\text{ITL}_i = t_i - t_{i-1}$ | 阅读时的“逐次停顿感”；若有长提示词插队抢占，对应那一步的 `ITL` 会出现尖刺 |
| **TPOT**（Time Per Output Token，每输出词均摊耗时） | 第 1 个输出词 → 最后 1 个输出词（即整段 Decode 耗时）按剩余词数均摊 | 单请求结束时记 1 次：$\text{TPOT} = \frac{T_{\text{e2e}} - \text{TTFT}}{N_{\text{out}} - 1}$（$N_{\text{out}} > 1$） | 衡量整条请求在生成阶段的平均单字速度；分母减 `1` 是因为首词耗时已计入 `TTFT` |
| **E2E Latency**（端到端总延迟） | 请求到达 → 最后一个输出词完成返回 | $T_{\text{e2e}} = \text{TTFT} + (N_{\text{out}} - 1) \times \text{TPOT}$ | 整条请求从进门到收尾的总挂钟时间 |
| **Token Throughput**（系统吞吐，`tokens/s`） | 观测时间窗 $\Delta t$ 内全实例处理的输入词或生成词总数除以 $\Delta t$ | 输入吞吐 `prompt tok/s` 与生成吞吐 `output tok/s` | 单机/整群的产能效率；注意引擎日志里的输入吞吐只统计本地实际计算的 `computed` 词数（扣除前缀缓存命中），而 Prometheus `vllm:prompt_tokens` 累加含命中的总词数 `total` |

这里最容易混淆的一对概念是 **`ITL` 与 `TPOT`**。在普通自回归解码（每次流式返回恰好吐出 1 个词）时，同一条请求的平均 `ITL` 与 `TPOT` 基本重合；但开启投机解码（如 MTP 一次验证通过多个草稿词）后，单次流式输出会打包返回多个词，两者就会拉开差距。

套用上游文档的基准算例算一遍：设首词耗时 `TTFT = 100 ms`，随后经历两次各 `40 ms` 的引擎步（端到端共 `180 ms`），第一步吐 `1` 个词、第二步一次吐 `3` 个词，共生成 $N_{\text{out}} = 5$ 个词：

- **`ITL`** 只记录两次返回之间的等待间隔，均值为 **`40 ms`**；
- **`TPOT`** 把首词之后的 `80 ms` 摊薄到后续 `4` 个词上，算出 **`(180 - 100) / (5 - 1) = 20 ms/token`**。

> **看板对账边界（单输出词请求）**：对于只生成 1 个词（$N_{\text{out}} \le 1$）的请求，服务端直方图 `vllm:request_time_per_output_token_seconds` 会记一笔 `0.0`，而客户端 `vllm bench serve` 会将其剔除出 `TPOT` 统计。双端看板对账前，必须先统一过滤口径。

把 **TTFT（首字响应）**、**TPOT / ITL（吐字流畅度）** 与 **Throughput（系统总吞吐）** 摆在一起，就构成了上图下半部分的**推理性能三角**——串联三角三个顶点的核心旋钮是单步并发批大小 $B$（以及单步 token 预算 `max-num-batched-tokens`）：

$$\text{Throughput}_{\text{gen}}(B) \approx \frac{B}{T_{\text{step}}(B)}$$

- **当并发批大小 $B$ 很小时**：把 $B$ 从 `1` 调大到 `8` 或 `16`，同一份模型权重从显存读入一次就能同时服务 $B$ 条请求。单步耗时 $T_{\text{step}}(B)$ 只微弱上涨（对应小幅牺牲 `TPOT`），分子 $B$ 却翻了十几倍，系统生成吞吐近乎线性飙升。
- **当并发批大小 $B$ 跨过硬件拐点继续堆高时**：计算单元已被填满，$T_{\text{step}}(B)$ 开始随 $B$ 同步拉长，吞吐曲线触顶拉平。此时再塞入更多并发请求或超大 Prefill 分块，不仅换不来额外吞吐，还会拉爆 `TTFT` 与 `TPOT`。
- **`--performance-mode` 的两端预设**：`interactivity` 在 `1..32` 小批量区间加密录制细粒度计算图，优先压低单步延迟；`throughput` 默认将 `max_num_batched_tokens` 与 `max_num_seqs` 双双翻倍，优先喂饱高并发吞吐。

## 算术强度与 Roofline 屋顶：一条折线分清带宽墙与算力墙

为什么小批量时增加 $B$ 几乎不增加单步耗时，大批量时却会撞墙？答案藏在昇腾 NPU 两项物理能力的比值里：计算核心（矩阵乘由 [AI Core](ai-core.md) 内的 **Cube** 单元承担）每秒最多做 $\pi_{\text{peak}}$ 次乘加运算，而高带宽显存（**HBM**，芯片外全局存储）每秒最多向片上搬运 $\beta_{\text{HBM}}$ 字节数据。

定义一段计算的**算术强度**（Arithmetic Intensity，亦称计算强度）$I$ 为总浮点运算次数与显存读写字节数之比。**Roofline 模型**据此给出目标硬件上的理论最高有效算力 $P_{\max}(I)$ 与**脊点**（Ridge Point，即算术强度拐点）$I_{\text{ridge}}$：

$$I = \frac{\text{FLOPs}}{\text{Bytes}}, \qquad P_{\max}(I) = \min\!\bigl(\pi_{\text{peak}},\; I \times \beta_{\text{HBM}}\bigr), \qquad I_{\text{ridge}} = \frac{\pi_{\text{peak}}}{\beta_{\text{HBM}}}$$

- **左侧斜坡（$I < I_{\text{ridge}}$，带宽墙 / Memory-Bound）**：每搬来 1 字节数据能做的运算太少，$I \times \beta_{\text{HBM}} < \pi_{\text{peak}}$。Cube 刚算完手头这批数就得停下来等搬运引擎从 HBM 取下一批权重，耗时下界由 $\text{Bytes} / \beta_{\text{HBM}}$ 决定，单纯堆高算力峰值不会缩短耗时。
- **右侧平顶（$I > I_{\text{ridge}}$，算力墙 / Compute-Bound）**：每搬来 1 字节数据能在片上反复参与大量乘加，$I \times \beta_{\text{HBM}} > \pi_{\text{peak}}$。显存搬运能够被计算时间掩盖，耗时下界转为 $\text{FLOPs} / \pi_{\text{peak}}$，继续加宽显存带宽收益有限。

用全站标准标尺模型 `Qwen3-8B`（[目录与配置拆解](hf-model-anatomy.md)）里最典型的一块线性投影 `q_proj` 算一笔明账：输入激活 $X$ 形状为 $[M, K]$，权重 $W$ 为 $[K, N]$，输出 $Y = XW$ 为 $[M, N]$。其中 $M$ 是本步一起计算的词元行数，$K = 4096$，$N = 32 \times 128 = 4096$。

按一次乘加记 `2` 次浮点运算，总运算量为 $\text{FLOPs} = 2MNK$。在理想缓存复用假设下（从 HBM 读一次 $X$、读一次 $W$、写回一次 $Y$，BF16 每元素 `2` 字节），总显存流量为 $\text{Bytes}_{\text{BF16}} = 2(MK + KN + MN)$，算术强度化简为：

$$I_{\text{BF16}}(M) = \frac{2MNK}{2(MK + KN + MN)} = \frac{1}{\frac{1}{M} + \frac{1}{N} + \frac{1}{K}}$$

当隐藏维度 $K, N = 4096$ 远大于小批量行数 $M$ 时，$\frac{1}{K}$ 与 $\frac{1}{N}$ 都只有 $\frac{1}{4096}$，分母完全由 $\frac{1}{M}$ 主导。因此，**小批量线性层的算术强度近似就等于本步打包处理的词元行数 $M$**。把单请求 Decode、小批 Decode、`W8A8` 量化与 Prefill 四种场景并排对比如下：

```wiki-diagram
file: roofline-matmul-intensity
```

将 $K = N = 4096$ 代入精确公式：权重矩阵共 $4096 \times 4096 = 16,777,216$ 个参数，BF16 下重 `32.00 MiB`。`W8A8` 动态量化把权重与输入激活压至每元素 `1` 字节、输出仍按 `2` 字节 BF16 计（忽略千分位级缩放系数字节），四档典型工况对账如下：

| 推理工况与精度 | 矩阵乘形状 $[M, K] \times [K, N]$ | 乘加运算量 $\text{FLOPs}$ | 理想 HBM 总流量 $\text{Bytes}$ | 算术强度 $I$ | 在常见硬件上的瓶颈归属 |
| --- | --- | --- | --- | --- | --- |
| **单请求 Decode（BF16）** | $[1, 4096] \times [4096, 4096]$ | `33.55 MFLOPs` | `32.02 MiB`（权重占 `99.95%`） | **`1.00 FLOP/B`** | 深度受限于 **HBM 带宽斜坡** |
| **单请求 Decode（W8A8）** | $[1, 4096] \times [4096, 4096]$ | `33.55 MOPs` | `16.01 MiB`（权重压半至 `16 MiB`） | **`2.00 OP/B`** | 仍处带宽斜坡，但权重搬运减半、强度**右移翻倍** |
| **小批 Decode（BF16，$M=16$）** | $[16, 4096] \times [4096, 4096]$ | `536.87 MFLOPs` | `32.25 MiB`（16 行共享 1 次权重） | **`15.88 FLOP/B`** | 沿带宽斜坡向上爬升，吞吐随 $M$ 近线性放大 |
| **Prefill / 大批（BF16，$M=512$）** | $[512, 4096] \times [4096, 4096]$ | `17.18 GFLOPs` | `40.00 MiB`（权重 `32M` + 激活读写 `8M`） | **`409.60 FLOP/B`** | 越过脊点，登上 **Cube 算力平顶** |

把这四个工况点画到对数坐标的 Roofline 屋顶图上，就能一眼看清各自的物理天花板。图中主折线采用 $\pi_{\text{peak}} = 320\text{ TFLOP/s}$、$\beta_{\text{HBM}} = 1.6\text{ TB/s}$、脊点 $I_{\text{ridge}} = 200\text{ FLOP/B}$ 的**教学示意标尺**；Atlas A2 / 910B 不同子型号实机标称值须按具体机型手册核对，不能混用单一数字：

```wiki-diagram
file: roofline-ceiling-and-shift
```

对照上图中的四个落点与官方硬件规格，可以得出三条直接指导调优的硬结论：

1. **为什么单请求 Decode 极度“饥饿”，而 Prefill 天然吃满算力**：当 $M = 1$（BF16）时，$I \approx 1.00\text{ FLOP/B}$，远低于 `120–270 FLOP/B` 量级的硬件脊点。在 `1.6 TB/s` 示意带宽下最高只能跑出 `1.6 TFLOP/s` 有效算力，不足 `320 TFLOP/s` 屋顶的 **`0.5%`**。反过来，一条 `512` 词提示词做 Prefill 时，搬一次 `32 MiB` 权重一口气算完 `512` 行，强度跃升至 `409.6 FLOP/B`，稳稳停在水平算力屋顶上。
2. **`W8A8` 量化的双重增益与卡型陷阱**：对小批量 Decode 启用昇腾 ModelSlim `W8A8` 量化（[量化选路](quantization.md)），先把权重字节从 `2 B` 砍到 `1 B`，让相同行数 $M$ 下的算术强度**右移约 2 倍**，省掉一半 HBM 搬运时间。同时低比特 INT8 / FP8 Cube 指令还将屋顶抬高约一倍（图中紫色虚线屋顶），兼顾大批 Prefill 上限。但要注意硬件前提：原生分块 FP8 权重只在昇腾 `950` 上转为 `1 B` 的 `MXFP8`（[低精度格式](low-precision-formats.md)），在 `Atlas A2 / A3` 上加载后会被反量化回 `2 B` 的 BF16，此时没有右移省带宽效果。
3. **高带宽新硬件如何左移脊点拯救 Decode**：查核已公开的[昇腾 950 架构白皮书](ascend-950-architecture.md#pr-与-dt-的规格怎样读才不串成一款产品)（以高配档仅 Cube BF16 峰值对照，不可跨档混配），`950PR`（`432 TFLOPS` ÷ `1.6 TB/s`）的矩阵乘脊点为 **`270 FLOP/B`**。面向推理强化的 `950DT`（`486 TFLOPS` ÷ `4.0 TB/s`）依靠 `4 TB/s` 超高内存带宽把脊点**左移至 `121.5 FLOP/B`**——只需一百多行有效批规模就能喂饱 Cube 屋顶，小批量 Decode 斜坡也整体抬高了 `2.5` 倍。

## 从单算子放到整座模型：长上下文 KV Cache、稀疏 MoE 与立项初筛

真实模型的一步前向不仅有线性层矩阵乘，还包含逐位置读取历史上下文的注意力计算、跨卡通信以及稀疏专家分发（详细硬件映射见 [硬件体系](hardware-devices.md) 与 [性能分析](inference-performance-analysis.md)）。把单算子结论外推到整座 `Qwen3-8B`（稠密 GQA）与 `Qwen3-30B-A3B`（稀疏 MoE）时，必须额外算清两道边界：

- **边界一：拼批能摊薄线性层权重，却摊薄不了非共享的长上下文 KV cache**。`Qwen3-8B` 全模型 BF16 权重占 `15.26 GiB`，每个 token 的全层 BF16 KV cache 占 `144.0 KiB`（推导见 [HF 模型目录解剖](hf-model-anatomy.md#逐个读懂-configjson用-qwen3-8b-与-qwen3-30b-a3b-算清架构与显存)）。短上下文并发 $B = 16$ 时，16 条请求共享一份 `15.26 GiB` 权重。若各自带着互不重合的 `32,768` 词历史，单步 Decode 光读 KV cache 就要搬运 $16 \times 32,768 \times 144\text{ KiB} = \mathbf{72.0\text{ GiB}}$，接近模型权重的 **5 倍**。更关键的是，独立 KV 只服务所属那 1 条请求：在 `4:1` GQA 下，每读一对 BF16 K/V 元素（`4 B`）仅供 4 个查询头各做一次乘加，注意力强度锁死在 $I_{\text{attn}} \approx \frac{4 \times (2 + 2)\text{ FLOP}}{(2 + 2)\text{ B}} = \mathbf{4\text{ FLOP/B}}$ 左右，不随 $B$ 增长。长文 Decode 想破带宽墙，只能靠 KV cache `C8` 量化、前缀缓存复用或 MLA 潜向量压缩。
- **边界二：稀疏 MoE 的单步有效行数被专家路由稀释**。`Qwen3-30B-A3B` 总参数 `30.53B`（BF16 常驻 `56.87 GiB`），单 token 仅激活 `128` 个路由专家中的 `8` 个（激活参数 `3.35B`）。单请求 $B = 1$ 时只读 8 个选中专家；并发升到 $B = 32$ 后，`32 × 8 = 256` 次抽样几乎点亮全部 128 个专家，整批被迫搬运近 `56.87 GiB` 权重。但摊到每个专家头上的有效行数平均只有 $M_{\text{eff}} = \frac{32 \times 8}{128} = \mathbf{2}$ 行（局部算术强度仅约 `2 FLOP/B`）。因此大型 MoE 线上常采用 [PD 分离](pd-disaggregation.md)，在 Decode 侧用大 `DP + EP` 汇聚数百路并发，把单专家有效行数推回高强度区间。

结合权重静态显存、运行时预留（完整 7 级扣减见 [KV 显存划定](kv-cache-memory-profiling.md)）与上述算术强度规律，可在下方初筛台切换预设模型与昇腾拓扑对照容量与瓶颈落点：

```wiki-tool
tool: deploy-calculator
mode: minimal
title: 算术强度与立项容量初筛台
summary: 选择 Qwen3 预设与昇腾卡型，直观查看 Prefill / Decode 在 Roofline 上的落点与显存边界
```

## 常见误解

下面把容量初筛与线上压测中最容易踩坑的五组直觉与 `v0.30.0` 源码及物理规律逐一对照：

```wiki-diagram
file: roofline-five-myths
```

- **“监控显示 NPU 忙碌度 90%，说明算力已经跑满。”** 算子执行期间计算核心停在片上等待 HBM 送数，同样会被计入设备任务忙碌时长。要分辨是真正在做乘加还是卡在搬运，应开启 `--enable-mfu-metrics` 对照每秒有效算力（`TF/s/device`）与估算带宽（`GB/s/device`）。
- **“只要显存够，无脑调大并发 Batch 总能继续提吞吐。”** 线性层越过脊点 $I_{\text{ridge}}$ 后已撞上算力屋顶，且非共享长上下文 KV cache 的注意力读取强度恒定在低位（`4:1` GQA 约 `4 FLOP/B`），盲目堆批只会让 `TTFT` 和 `TPOT` 急剧恶化。
- **“MoE 模型单词只激活 3.35B 参数，跑 32 并发就像稠密 3B 模型一样轻。”** 专家路由会把批次词元打散到全部 `128` 个专家上，平均每专家仅分到约 `2` 行，整批却几乎要把 `56.87 GiB` 权重通读一遍。
- **“面板里的 ITL 和 TPOT 是一回事，随便挑一个设告警就行。”** 投机解码单步返回多个词时，`ITL` 量的是两次流式包间隔，而 `TPOT` 按总生成词数摊薄；且只生成 1 个词的请求在服务端 `vllm:request_time_per_output_token_seconds` 会记 `0.0`，与客户端排除口径不同。
- **“引擎日志打印的 Prompt 吞吐应该和 `/metrics` 里的提示词计数速率相等。”** 周期日志只统计本地实际计算的 `computed` 提示词（扣除前缀缓存命中与外部 KV 传入），而 Prometheus 的 `vllm:prompt_tokens` 累加包含缓存在内的全部提示词 `total`。

## 对照源码

### 怎么开

启动 `Qwen3-8B` 在线服务时，可通过 `--enable-mfu-metrics` 打开每设备有效算力与显存带宽估算，并按业务侧重通过 `--performance-mode` 选择低延迟交互或高吞吐模式：

```bash
# 1. 启动服务并开启 MFU 算力/带宽指标估算（默认 balanced，可选 interactivity / throughput）
export VLLM_USE_MODELSCOPE=True
vllm serve Qwen/Qwen3-8B \
  --enable-mfu-metrics \
  --performance-mode balanced

# 2. 用内置基准套件发起在线压测，同时获取客户端 TTFT / TPOT / ITL 与吞吐
vllm bench serve \
  --backend vllm \
  --model Qwen/Qwen3-8B \
  --endpoint /v1/completions \
  --dataset-name random \
  --input-len 512 \
  --output-len 128 \
  --num-prompts 32

# 3. 抓取服务端 Prometheus 核心延迟直方图与估算算力/带宽计数器
curl -s http://127.0.0.1:8000/metrics | grep -E \
  'vllm:(time_to_first_token_seconds|inter_token_latency_seconds|request_time_per_output_token_seconds|e2e_request_latency_seconds|estimated_flops_per_gpu_total|estimated_read_bytes_per_gpu_total)_(count|sum)'
```

### 版本差异

下表对照四套固定仓库基准版本在 V1 Prometheus 延迟指标、直方图分桶、MFU 流量统计与性能模式上的核验结果（注：旧 V0 引擎曾使用 `vllm:time_per_output_token_seconds` 命名逐次输出间隔，V1 引擎在以下四版中已统一拆分为按流式步记录的 `vllm:inter_token_latency_seconds` 与按完结请求记录的 `vllm:request_time_per_output_token_seconds`）：

| 核验机制与指标项 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） | 监控与调参影响 |
| --- | --- | --- | --- | --- | --- |
| **TTFT / ITL / 单请求 TPOT 指标名** | `vllm:time_to_first_token_seconds`、`vllm:inter_token_latency_seconds`、`vllm:request_time_per_output_token_seconds` | 同左（`loggers.py#L796-L886`） | 同左（`loggers.py#L811-L849`），单请求 TPOT 取 `decode_time / (num_generation_tokens - 1)` | 同左（`loggers.py#L930-L965`） | Grafana 面板查逐包波动用 `inter_token_latency_seconds`，查单请求均值用 `request_time_per_output_token_seconds` |
| **直方图分桶（Buckets）管理** | 在 `PrometheusStatLogger.__init__` 内硬编码内联数组 | 同左，内联数组管理 | 抽离至独立单真源 `vllm/v1/metrics/buckets.py` 按桶族统一管理 | `histogram_buckets(..., overrides=custom_buckets)` 新增自定义分桶覆写支持，并新增 `vllm:prompt_tokens_cached_by_source` | `main` 可按业务 SLO 自定义 P99 分桶边界而无需改源码 |
| **MFU 算力与显存带宽估算** | 支持 `--enable-mfu-metrics` 输出 `TF/s/device`、`GB/s/device` 与三项 `estimated_*_per_gpu_total` 计数器 | 同左，`perf.py` 扩充模型解析覆盖面 | `perf.py#L1740-L1835` 稳定输出日志与 Prometheus 估算计数器 | 延续相同接口与 PromQL 速率查询方式 | 可直接由估算计数器比值观测线上实时算术强度区间 |
| **`--performance-mode` 与昇腾默认批预算** | 支持 `balanced` / `interactivity` / `throughput`；昇腾未初始化查询显存抛 `NotImplementedError` | 同左 | `interactivity` 加密录制 `1..32` 图尺寸，`throughput` 将 `max_num_batched_tokens` 与 `max_num_seqs` 翻倍；昇腾 `vllm serve` 默认回落 `2048` 批预算 | 延续三档模式并在更多调度与编译分支联动 `interactivity` | 压测高吞吐前须留意昇腾默认 `2048` 批预算与 `throughput` 翻倍行为 |
| **昇腾官方基准测试指南** | `performance_benchmark.md` 提供基础在线与离线示例 | 同左 | 升级 `Qwen/Qwen3-8B` 在线 `vllm bench serve` 与离线 `vllm bench throughput` 完整示例与输出模板 | 与 `v0.30.0` 保持一致 | 可直接复用官方 `Qwen3-8B` 命令做上线基线复核 |

### 源码位置

- Roofline 模型与昇腾硬件规格依据：Williams 等人的 UC Berkeley Roofline 原始技术报告定义算术强度与带宽/算力双屋顶上界 [S1]；昇腾 `950PR`（`432 TFLOPS` / `1.6 TB/s`）与 `950DT`（`486 TFLOPS` / `4 TB/s`）的仅 Cube BF16 峰值及内存带宽取自官方架构白皮书 [S2]。
- 客户端与服务端延迟/吞吐指标定义：`vllm bench serve` 对 `TTFT`、`ITL`、`TPOT` 的公式定义及投机解码多词打包算例（`40 ms` vs `20 ms/token`）[S3]；`vllm:request_time_per_output_token_seconds` 对单输出词请求记录 `0` 及与客户端统计差异说明 [S4]；昇腾 `v0.30.0` 基于 `Qwen/Qwen3-8B` 的在线与离线基准测试流程 [S5]。
- V1 引擎统计与 Prometheus 导出实现：`RequestStateStats` 与 `FinishedRequestStats` 字段定义 [C6]；`IterationStats` 计算首字时延、流式间隔 `inter_token_latencies_iter`、扣除首词的 `mean_time_per_output_token` 与 `e2e_latency` [C7]；`LoggingStatLogger._track_iteration_stats` 仅用本地实算 `computed` 统计日志输入吞吐 [C8]，而 `PrometheusStatLogger` 注册并累加全量计数器与延迟直方图 [C9][C10][C11]。
- 分桶、MFU 估算、性能模式与跨版本演进：`v0.30.0` 集中式分桶表 `buckets.py` [C12]，`PerfStats` 与 `PerfMetricsProm` 估算每卡 FLOPs 与读写字节 [C13][C14]，`--performance-mode` 控制小批量细粒度图捕获与吞吐翻倍预算 [C15][C16][C17]，昇腾 `get_device_total_memory` 初始化前守卫导致在线默认批预算回落 [C21]；`v0.23.0`、`v0.26.0` 内联分桶与 `main` 自定义分桶覆写对照 [C22][C23][C24][C25]。
- 模型结构参数与算术强度推导边界：`Qwen3-8B` 线性层（`4096 × 4096`）[C18]、`Qwen3-30B-A3B` 稀疏专家块（`128` 选 `8`）[C19] 与昇腾 `W8A8` 动态量化 1 字节权重存储 [C20]；线性层算术强度 $I(M)$、GQA 注意力约 `4 FLOP/B`、长上下文 `72.0 GiB` KV 读取量与 MoE 每专家有效行数均由张量形状严格推导 [D]；理想单次 HBM 读写（不含片上 L2 缓存命中率波动与缩放向量零头）以及主图 `320 TFLOP/s ÷ 1.6 TB/s = 200 FLOP/B` 标尺均为教学静态假设 [A]；非共享 KV cache 无法随并发数 $B$ 摊薄与跨档规格不可混配属于由访存独立性得出的工程判断 [I]。
