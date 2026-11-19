---
id: quantization-evaluation
title: 量化验收：怎样判断省了内存、保住质量、真正提速
type: concept
origin: direct
summary: >-
  把量化验收拆成产物一致性、中间数值、任务质量、实际内存和服务性能；用误差与耗时小例子解释为什么文件变小不等于推理变快，并给出固定 GLM
  双机可复核的对照流程。
aliases:
  - 量化验收
  - 量化评估
  - 量化精度
  - 量化掉点
  - 量化变慢
  - 量化误差
  - MSE
  - SQNR
  - PPL
  - perplexity
  - 饱和率
  - 量化性能
  - INT8累加
  - 量化溢出
chapters:
  - '11'
  - '19'
order: 7
sources:
  - 'https://pytorch.org/blog/quantization-in-practice/'
  - 'https://huggingface.co/docs/transformers/perplexity'
  - 'https://arxiv.org/html/2306.00978v4'
  - 'https://arxiv.org/abs/2402.02750v2'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/performance_and_debug/performance_benchmark.md#L1-L5
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/performance_and_debug/performance_benchmark.html
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L3
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/evaluation/using_ais_bench.html
  - 'vllm@0fc695fc:vllm/benchmarks/serve.py#L456-L496'
  - 'vllm@0fc695fc:vllm/benchmarks/serve.py#L578-L587'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125
  - >-
    raw:sha256-662cf20ffb80fc91bfc738fac93c22919f63c26026792c4143b6a685086b54e1.md#L1-L124
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/benchmarks/serve.py#L458-L496
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L124-L239
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L91-L134
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L909-L933'
  - 'vllm@ced6857a:vllm/benchmarks/lib/endpoint_request_func.py#L402-L434'
  - 'vllm@ced6857a:vllm/benchmarks/lib/endpoint_request_func.py#L606-L639'
  - 'vllm@ced6857a:vllm/benchmarks/lib/endpoint_request_func.py#L526-L561'
  - 'vllm@ced6857a:vllm/benchmarks/serve.py#L568-L600'
  - 'vllm@ba15685a:vllm/benchmarks/serve.py#L602-L635'
  - 'vllm@ba15685a:vllm/benchmarks/lib/endpoint_request_func.py#L416-L445'
  - 'vllm-ascend@2c59ff10:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L3'
  - 'vllm-ascend@2ed6cbba:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L3'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L20'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_evalscope.md#L1-L20'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L260'
  - 'vllm-ascend@8d6180e2:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L20'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L128'
relations:
  - to: quantization-methods
    kind: builds-on
    note: 确定量化对象、方法与校准之后，用同一标准比较候选产物
  - to: aisbench-and-evalscope
    kind: builds-on
    note: 量化质量评测与服务性能压测的 AISBench / EvalScope 实操命令、预热剔除与双端口径对齐见该实战页
  - to: tensor-layout
    kind: builds-on
    note: 先分清精度误差与数据排布错误，再统计实际存储和转换成本
  - to: inference-correctness-troubleshooting
    kind: builds-on
    note: 核对输入与采样，沿首次分歧判断是否真是量化问题
  - to: inference-performance-walkthrough
    kind: builds-on
    note: 用设备与请求时间线区分转换、计算、通信和排队
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
contradicts: []
updated: '2026-11-19'
---

## 量化模型能回答问题，就算成功了吗？

**量化验收是在相同条件下，确认模型仍完成目标任务，并测出实际容量和速度的变化。** 能加载、能生成一句话，只说明跑通了这次输入；模型产物是否正确、误差是否可接受、服务是否获益，是后面要分别回答的问题。

```wiki-diagram
file: quantization-evaluation-intuition
```

先解释图中的四项：产物是权重和配套量化元数据；数值是还原值、层输出及最终评分；任务质量是对实际问题的正确率或其他指标；系统收益是设备内存、延迟和吞吐。比较时保持模型来源、分词器和输入处理一致，再只改变待评估的量化方案。

## 为什么要先查产物和中间数值？

**编码读错与正常舍入造成的偏差，处理办法完全不同。** scale 是把低位编码还原为近似值的缩放系数；zero-point 是整数编码中的零点。若把 scale 用成倒数，或转置后没有同步调整系数对应的轴，即使程序没有报错，结果也可能大幅偏离。

先抽取同一个逻辑位置的原始值、低位编码、系数、零点和还原值，确认公式、分组方向、打包顺序及 [ND/NZ 布局](tensor-layout.md)。布局转换应该保持有效数值，正常量化则允许预期的舍入或截断误差。这个检查通过后，再沿[首次分歧](inference-correctness-troubleshooting.md)看层输出、attention 和最终词表评分。

反量化（dequantization）是按照编码规则恢复近似值，不是找回原始值；已经丢掉的小数无法由升回 BF16 自动恢复。本站动态 W8A8 把这项计算融合在矩阵乘里：运行记录中没有独立的反量化算子，仍要完成尺度恢复。

## 一个张量的误差怎样算，能说明什么？

原张量取 $x = (1, 2, 4)$，量化再还原得到 $\hat{x} = (1.1, 1.8, 4)$，均为示意数据。**MSE** 是 Mean Squared Error，即误差平方的平均；相对 L2 误差则用误差向量的长度除以原向量长度：

$$\text{MSE} = \frac{1}{n}\sum_{i=1}^{n}(\hat{x}_i - x_i)^2, \qquad \text{Rel-L2} = \frac{\lVert \hat{x} - x \rVert_2}{\lVert x \rVert_2}$$

| 误差口径（示意：$x = (1, 2, 4),\; \hat{x} = (1.1, 1.8, 4)$） | 算式 | 结果 |
| --- | --- | --- |
| 逐项误差 $\hat{x} - x$ | $(1.1 - 1,\; 1.8 - 2,\; 4 - 4)$ | $(0.1,\; -0.2,\; 0)$ |
| **MSE** | $(0.1^2 + (-0.2)^2 + 0^2) \div 3$ | **$\approx 0.016667$** |
| **相对 L2 误差** | $\sqrt{0.1^2 + (-0.2)^2} \div \sqrt{1^2 + 2^2 + 4^2}$ | **$\approx 4.88\%$** |

这两项衡量的是这三个数的变化，不能直接解释成“模型正确率下降 4.88%”。MSE 会受数值量级影响；相对误差在原向量接近零时不稳定，应约定分母处理方式。还可以记录最大误差、余弦相似度以及分层、分通道的分布，防止少数异常被平均值掩盖。

**SQNR** 是 Signal-to-Quantization-Noise Ratio，信号与量化噪声能量之比；常以 10 log₁₀(Σx²/Σ(x−x̂)²) 的分贝值表达，误差全零时按无穷大或工具约定处理。**饱和率**应明确统计“缩放后超出可表示范围、实际发生截断”的比例；仅计数落在最大/最小编码上的元素，会把本来恰好可表示的值也算进去。

累加精度要另外查。INT8 操作数不代表 INT8 累加，FP8 操作数也没有规定输出必须是 FP8。更宽的累加类型减少溢出与舍入风险，但精确边界依累加长度、数值范围、算子实现决定。本站 W8A8 点积示例和系数恢复顺序见[四步计算](quantization.md#放进一次矩阵乘w8a8-的四步)。

## 怎样确认回答质量还能接受？

**在与校准样本分开的数据上，对比高精度基线和候选方案。** 校准用于选择量化参数，验收用于检验其泛化到目标任务后的效果；两者混用容易只证明方案适合已见样本。

对自回归语言模型，可以测 **PPL（Perplexity，困惑度）**：给定真实前文，检查模型给真实下一个 token 分配的概率；它是平均负对数似然取指数。这一定义不能直接套到 BERT 一类的掩码语言模型。比较 PPL 时需固定分词器、语料、上下文窗口及滑窗策略。它能反映语言建模变化，但不能替代数学题正确率、代码执行结果、检索问答或工具调用成功率。

按实际负载分别测中文、英文、代码、数学、长上下文及需要的多模态任务，并保留各子集结果。短文本的平均分稳定，不保证长历史中的 KV cache 误差同样可接受；缓存量化要覆盖写入、读取、前缀复用和长生成。KIVI 对 key 与 value 的不同统计特性给出了专门设计，说明缓存的两个对象也不必采用同一分组策略。

比较生成结果时固定输入模板、采样和停止条件，并统计重复运行的波动。确定性配置可以帮助定位实现差异，但正常量化已经改变数值，不要求所有生成 token 必须与浮点基线逐字相同。验收阈值应由任务需求定义，并在看结果之前约定；一个通用的“允许掉 1 分”不能覆盖所有业务。

## 文件小了，显存为什么没有按比例下降？

**模型文件、加载后的权重、推理峰值和缓存池是四笔不同的账。** 若加载器把文件中的打包权重展开成较宽类型，驻留大小就要按展开后的类型算；NZ 尺寸未对齐时要补齐。若转换期间旧副本和新副本同时存在，还要计算临时峰值。系数、零点、派生参数、未量化层、激活、图执行工作区和通信缓冲也都占空间。

记录至少包括：checkpoint 大小、加载完成后的权重驻留、启动转换峰值、代表性负载下的运行峰值，以及最终 KV cache 容量。尤其要区分“为缓存池预留的空间”和“当前请求实际占用的缓存块”。服务把省出的权重空间用于扩大缓存池时，应报告可用块数的增加；即使总显存没有下降，也能量化这项容量收益。并发能提高多少还受计算与延迟目标约束。

已有权重与缓存的字节推导分别由 [W8A8 页](quantization.md#省下什么付出什么)和 [KV cache 量化页](kv-cache-quantization.md#页和整卡为什么不一定跟着减半)维护；实际部署重新做[显存探测](kv-cache-memory-profiling.md)。

## 权重字节减半，推理会快一倍吗？

**只能缩短被优化的那部分工作，新增转换也要计时。** 假设一次前向原来耗时 100 ms，其中读权重 60 ms，其余工作 40 ms；量化后读权重降为 30 ms，但新增量化与反量化共 10 ms。这是各阶段不重叠的教学模型：

$$S = \frac{T_{\text{orig}}}{T_{\text{new}}} = \frac{100}{80} = 1.25, \qquad \Delta T = \frac{100 - 80}{100} = 20\%$$

| 耗时对比项（示意、无重叠） | 算式 | 结果 |
| --- | --- | --- |
| 原总时间 | $60\text{ ms} + 40\text{ ms}$ | **100 ms** |
| 新总时间（含 10 ms 量化/反量化） | $30\text{ ms} + 10\text{ ms} + 40\text{ ms}$ | **80 ms** |
| 加速比 / 总时间下降 | $100 \div 80$；$(100 - 80) \div 100$ | **1.25×** / **下降 20%** |

真实执行还会重叠搬运与计算，需要用时间线确认关键路径。小批 decode、较大批 prefill、长上下文 attention 的瓶颈不同：weight-only 重点检查权重流量，W8A8 还要检查是否实际选中低精度矩阵计算，KV 量化重点检查历史状态容量与读取。三类收益要分别测。

服务侧记录首 token 延迟 **TTFT**、后续输出 token 平均时间 **TPOT**、相邻 token 间隔 **ITL** 的分布，以及端到端延迟、成功率和吞吐。TPOT 对一条输出多于一个 token 的请求，是“总延迟减 TTFT”再除以后续 token 数；平均值不能揭示某次长停顿。流式消息可能一次带多个 token，不能直接把网络消息间隔当 ITL。

输出不超过一个 token 时，没有后续 token 可供 TPOT 求平均。该 benchmark 将这类请求排除在普通 TPOT 样本之外，却在 goodput 判断中把 TPOT 记作 0。这个 0 是统计约定，不是测得了后续 token 的生成时间。

负载固定输入输出长度分布、请求速率或并发、缓存命中条件、并行配置与预热方式。分别报告冷启动和稳态结果，再检查 P95/P99 等尾部延迟。**goodput** 只统计满足既定服务延迟目标的请求吞吐；吞吐上升却大量请求超时，不能按同一目标判为获益。

goodput 可同时配置 TTFT、TPOT 和端到端延迟目标；一个请求满足所有已配置目标才计入达标数，测量值等于阈值也算达标。比较结果时，应一并记录选择了哪些指标以及各自阈值。

把前面的质量精度、显存四笔账与吞吐/Goodput 收拢成三道顺序验收闸门，以及未过闸时的排查流向：

```wiki-diagram
file: quantization-evaluation-fig-three-gate
```
## 放到 GLM 双机，一次对照实验怎样进行？

先保留[固定部署](glm-5-3-flash-two-node.md#部署前提)的模型来源、TP/DP/EP 配置和输入模板。基线与候选必须能在可比的硬件和资源条件下运行；若浮点版本需要更多卡，应明确区分“固定硬件比较”和“固定模型质量目标下的资源比较”。

对照上节三道验收闸门，按下面五步顺序执行：

1. 保存 checkpoint、量化描述、工具配方、源码提交与 CANN 版本；逐层确认权重、激活和缓存的实际类型。
2. 在加载后抽查转置、NZ 和系数对应关系，排除布局及打包错误。
3. 到[第 4 站逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)对照中间输出，再用独立样本评估目标任务。
4. 记录显存各笔账；质量达标后，测代表性 prefill、decode、长上下文和并发场景。
5. 质量失败则定位敏感层、校准覆盖或格式问题；性能失败则定位转换、算子、通信和排队，再改变一个因素复测。实际落地 AISBench 与 EvalScope 压测/评测命令、预热剔除和双端指标口径对齐，见[AISBench 与 EvalScope 实战](aisbench-and-evalscope.md)。

本站固定 GLM W8A8 的内存推导不等于以上实验已完成；它也未开启 KV cache 量化。未来测试 C8 或四位权重属于新候选，需要重新确认模型、算子和版本支持。

## 常见误解

- **MSE 很小，任务就一定不掉点？** 层和通道的敏感性不同，任务质量要单独评估。
- **改回浮点 dtype 就能还原原模型？** 只能更宽地表示近似值，原始信息需要原始权重。
- **启动没报错，就证明量化描述正确？** 还应核对实际载荷、系数和运行分支。
- **GPU 上论文加速多少，A2 就能加速多少？** 算子、硬件与负载不同，需本部署实测。
- **缓存量化与权重量化可以共用一份精度结论？** 生命周期和误差传播路径不同，必须分别验证。

## 对照源码

### 怎么开

官方提供 [AISBench 评测入口](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/evaluation/using_ais_bench.html)和[性能测试入口](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/performance_and_debug/performance_benchmark.html)。在昇腾上落地数据集精度基线与并发/到达率压测时，可直接按[AISBench 与 EvalScope 实战](aisbench-and-evalscope.md)准备预热剔除、前缀缓存防污染、思维链剥离与双端 TTFT/TPOT/ITL 口径对齐；先确定数据、基线、指标与资源口径，再按当前安装版本的命令运行，本页没有能够替代测试的通用“量化通过”开关。

### 会报什么错

加载错误按量化配置和算子接口定位；NaN、异常范围先看首个失真的中间张量；仅任务分数回归时检查校准分布、敏感层及生成配置。性能异常先分开加载转换和稳态前向，不将两段耗时混成一个数。

### 开销和什么时候别开

评测会占用模型加载和推理资源，中间张量捕获还会影响时间与内存；用于数值排查的捕获运行和最终性能运行分开。候选未达到事先约定的质量目标时，不以省内存掩盖这一结果。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；固定 GLM 双机另钉 `db701c1f` + `0fc695fc`。无论哪个版本，A/B 报告都应写清 checkpoint 量化描述、驻留 dtype/布局、runner、cache dtype 与 indexer dtype，不能只写“FP8”或“W8A8”。

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 昇腾评测与压测工具入口 | 官方文档提供 AISBench（`using_ais_bench.md`）与性能压测指南 | 延续 AISBench 评测与压测文档 | 同步覆盖 AISBench（`using_ais_bench.md#L1-L20`）与 EvalScope（`using_evalscope.md#L1-L20`），工具分工与口径对齐见[AISBench 与 EvalScope 实战](aisbench-and-evalscope.md) | 延续 AISBench 与 EvalScope 双工具评测入口 |
| 驻留格式与执行路径对照 | 动态 W8A8 线性层在 `w8a8_dynamic.py` 走融合量化矩阵乘 | 延续同原则；各量化组合仍需按本机实测验收 | 原生 block-wise FP8 按硬件分流（A5 转 MXFP8，A2/A3 反量化为 `model_dtype` 走 `unquantized_gemm`，`fp8_block.py#L178-L260`）；W8A8 支持提前准备量化输入；主 KV 与 indexer 精度分离 | 原生 block-wise FP8 在非 FP8 硬件改为显式 `NotImplementedError`（`fp8_block.py#L114-L128`），避免把反量化 BF16 误当成 FP8 验收基线 |
| 上游 `vllm bench serve` 统计口径 | `serve.py#L456-L496`、`#L578-L587` 排除单 token 请求于普通 TPOT 样本，goodput 下记为 `0` | 延续同统计公式 | `serve.py#L568-L600` 延续 TPOT/goodput 规则；`endpoint_request_func.py` 调整 chat/audio 尾 `usage` 与 pooling 计时边界（见[压测版本对照](inference-benchmarking.md#版本差异)） | `serve.py#L602-L635` 与 `endpoint_request_func.py#L416-L445` 延续该计时与统计口径 |

客户端计时边界调整可能改变统计数字，不能当成量化提速或精度通过的证据；本页不提供未经运行的 NPU 质量、容量或性能测量成绩。

### 源码位置

- 数值比较与敏感性分析的参考入口见 PyTorch 实践说明 [S1]；PPL 定义及 tokenization、上下文窗口的影响见 Hugging Face 文档 [S2]。
- weight-only 的访存动机和运行时反量化见 AWQ §4 [S3]；key/value 分组差异的研究实例见 KIVI [S4]，不据此宣称本站已实现 KIVI。
- 固定性能与 AISBench / EvalScope 文档见来源 5–8 与 23–28（含 `c09d3e20` `using_ais_bench.md`、`using_evalscope.md`）[S5][S7]；TPOT 和 goodput 的四版统计见来源 9–10、13、20–22（`0fc695fc` / `ced6857a` / `ba15685a` `serve.py` 与 `endpoint_request_func.py`）[C9][C20][C21]；动态量化与原生 FP8 分流见来源 11、14–16、27、29（`c09d3e20:fp8_block.py#L178-L260`、`8d6180e2:fp8_block.py#L114-L128`）[C11][C27][C29]。
- 两个数值算例均是假设数据 [A]，误差、容量分账和耗时关系是推导 [D]。验收流程是基于上述资料的工程归纳 [D]，没有填写未经运行的设备性能或质量成绩。
