---
id: inference-performance-analysis
title: 性能分析：设备到底在算，还是在等
type: concept
origin: direct
summary: 接着 D/N 的分块实验，解释少算一些输入为什么能缩短一步、为什么切得更小也会有成本；通过矩阵流量与关键路径推演，区分算得慢、数据搬得慢和等其他卡。
aliases:
  - 性能模型
  - 计算瓶颈
  - 访存瓶颈
  - 带宽瓶颈
  - 关键路径
  - 设备空闲
  - 主机空隙
  - 通信重叠
  - 算力利用率低
  - VLLM_LOGGING_LEVEL
  - VLLM_CONFIGURE_LOGGING
  - VLLM_LOGGING_CONFIG_PATH
  - disable_log_stats
  - '--disable-log-stats'
  - VLLM_LOG_STATS_INTERVAL
  - aggregate_engine_logging
  - '--aggregate-engine-logging'
  - Prometheus
  - Grafana
  - OTLP
  - OpenTelemetry
  - KV cache residency metrics
  - kv_cache_metrics
  - LLM.get_metrics
  - 离线指标快照
chapters:
  - '19'
order: 3
sources:
  - >-
    https://amcr.lbl.gov/departments/computer-science-department/ppan/roofline-performance-model/
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996'
  - >-
    https://docs.vllm.ai/projects/ascend/en/main/developer_guide/performance_and_debug/service_profiling_guide.html
  - >-
    raw:sha256-8fbd62f4df5b3f95ec4c4edef230f7e4721c11aa3d0e2efbf6765fb1d1883647.md#L1-L219
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L538-L546
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L574-L577
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/model_runner_v1.py#L2914-L2940
  - 'vllm@0fc695fc:vllm/envs.py#L787-L812'
  - 'vllm@568afb3a:vllm/envs.py#L808-L833'
  - 'vllm@84030bbe:vllm/envs.py#L838-L863'
  - 'vllm@0fc695fc:vllm/logger.py#L156-L201'
  - 'vllm@568afb3a:vllm/logger.py#L156-L201'
  - 'vllm@84030bbe:vllm/logger.py#L156-L201'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L525-L531'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L534-L540'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L554-L560'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L120-L166'
  - 'vllm@568afb3a:vllm/v1/engine/async_llm.py#L120-L166'
  - 'vllm@84030bbe:vllm/v1/engine/async_llm.py#L130-L181'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L293-L365'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L1269-L1360'
  - 'vllm@568afb3a:vllm/v1/metrics/loggers.py#L1311-L1402'
  - 'vllm@84030bbe:vllm/v1/metrics/loggers.py#L1324-L1415'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/server_utils.py#L453-L479'
  - 'vllm@568afb3a:vllm/entrypoints/serve/utils/server_utils.py#L538-L571'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/utils/server_utils.py#L68-L101'
  - 'vllm@ced6857a:vllm/envs.py#L828-L850'
  - 'vllm@ced6857a:vllm/logger.py#L175-L218'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L566-L567'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L131-L141'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L1228-L1243'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1223-L1251'
  - 'vllm-ascend@7d825229:vllm_ascend/profiler/torch_npu_profiler.py#L29-L77'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/developer_guide/performance_and_debug/service_profiling_guide.md
  - 'vllm@0fc695fc:vllm/entrypoints/serve/profile/api_router.py#L16-L46'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L215-L253'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L412-L618'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L620-L753'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L754-L1006'
  - 'vllm@0fc695fc:vllm/v1/metrics/loggers.py#L1058-L1217'
  - 'vllm@568afb3a:vllm/v1/metrics/loggers.py#L1100-L1259'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L1017-L1179'
  - 'vllm@84030bbe:vllm/v1/metrics/loggers.py#L1110-L1272'
  - 'vllm@0fc695fc:vllm/config/observability.py#L36-L55'
  - 'vllm@568afb3a:vllm/config/observability.py#L36-L55'
  - 'vllm@ced6857a:vllm/config/observability.py#L36-L67'
  - 'vllm@84030bbe:vllm/config/observability.py#L36-L67'
  - 'vllm@0fc695fc:vllm/config/observability.py#L113-L152'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_metrics.py#L16-L96'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L400'
  - 'vllm@568afb3a:vllm/v1/core/block_pool.py#L647-L700'
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L664-L747'
  - 'vllm@84030bbe:vllm/v1/core/block_pool.py#L658-L711'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L402-L441'
  - 'vllm@568afb3a:vllm/v1/core/block_pool.py#L702-L740'
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L749-L800'
  - 'vllm@84030bbe:vllm/v1/core/block_pool.py#L713-L758'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L505-L517'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L83-L91'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L232-L244'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2013-L2098'
  - 'vllm@0fc695fc:vllm/v1/metrics/stats.py#L19-L144'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L181-L248'
  - 'vllm@0fc695fc:vllm/v1/engine/__init__.py#L42-L64'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/instrumentator/metrics.py#L1-L45'
  - 'vllm@0fc695fc:vllm/v1/metrics/prometheus.py#L1-L82'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L246-L280'
  - 'vllm@0fc695fc:vllm/tracing/otel.py#L58-L141'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L712-L772'
  - 'vllm@568afb3a:vllm/v1/engine/output_processor.py#L727-L787'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L782-L842'
  - 'vllm@84030bbe:vllm/v1/engine/output_processor.py#L770-L830'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L110-L154'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1310-L1340'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L688'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/examples/observability/prometheus_grafana/README.md'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/examples/observability/prometheus_grafana/prometheus.yaml'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/examples/observability/prometheus_grafana/grafana.json'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/examples/observability/opentelemetry/README.md'
  - 'https://github.com/prometheus/prometheus/blob/997549d4479dbc52382c83679dd998cd1c8eff27/docs/querying/functions.md'
  - 'https://github.com/prometheus/client_python/blob/e2f2bf9dcb49b8e8c0bc7fc089ff550edd9d286d/docs/content/multiprocess/_index.md'
  - 'https://github.com/prometheus/docs/blob/cc0672badce86173b9afaa95a59904576bcd6d6a/docs/practices/histograms.md'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L235-L236'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L847-L857'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L112-L120'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L152-L177'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L287-L325'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L369-L371'
  - 'vllm@0fc695fc:vllm/v1/metrics/reader.py#L1-L257'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L224-L225'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L836-L846'
  - 'vllm@568afb3a:vllm/v1/engine/llm_engine.py#L296-L334'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L228-L229'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L843-L853'
  - 'vllm@ced6857a:vllm/v1/engine/llm_engine.py#L304-L342'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L228-L229'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L843-L853'
  - 'vllm@84030bbe:vllm/v1/engine/llm_engine.py#L304-L342'
  - 'vllm@ba15685a:vllm/envs.py#L900-L924'
  - 'vllm@ba15685a:vllm/logger.py#L207-L240'
  - 'vllm@ba15685a:vllm/v1/engine/async_llm.py#L258-L300'
  - 'vllm@ba15685a:vllm/v1/metrics/loggers.py#L473-L520'
  - 'vllm@ba15685a:vllm/config/observability.py#L20-L72'
  - 'vllm@ba15685a:vllm/entrypoints/llm.py#L897-L915'
  - 'vllm@ba15685a:vllm/v1/engine/llm_engine.py#L319-L360'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1230-L1260'
  - 'vllm-ascend@c09d3e20:vllm_ascend/profiler/torch_npu_profiler.py#L29-L74'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1317-L1350'
  - 'vllm-ascend@8d6180e2:vllm_ascend/profiler/torch_npu_profiler.py#L29-L74'
relations:
  - to: roofline-and-metrics
    kind: builds-on
    note: 算力墙、带宽墙、算术强度脊点与性能三角的系统推导见该基础页
  - to: inference-benchmarking
    kind: builds-on
    note: 先保证被比较的延迟、负载和输出口径一致
  - to: attention-cost
    kind: builds-on
    note: 不同 attention 结构读取哪些历史，由原页计算
  - to: device-memory
    kind: builds-on
    note: 分清数据放在哪里、占多少空间和沿什么路径读取
  - to: collective-communication
    kind: builds-on
    note: 核对多卡交换的具体操作和依赖
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: 2026-11-19T00:00:00.000Z
---

**性能分析要找的是：下一步为什么还不能开始，以及哪一段工作真正决定了完成时间。** 计算更快、搬运更快和请求更快，之间要靠执行依赖联系起来。

增加时间与计数记录能帮助定位等待，也会消耗主机处理、存储和传输资源；先用汇总指标缩小范围，再为目标请求短时采集细节。

在[贯穿样例](inference-performance-walkthrough.md#同一组请求比较两种设置)里，正在生成的请求 D 遇到了带长输入的新请求 N。N 分块后，D 所在的一步从 190 ms 缩短到 70 ms。这组记录证明该步变短了，却还没解释时间省在哪里；整组请求是否受益，要接着用[测量页](inference-benchmarking.md)的方法判断。本页先学习怎样拆成本，再把判断放回那份记录。

## 一段计算快了，为什么回答时间没有变

假设下一步要把本卡的结果与另一张卡送来的结果相加。本卡已经算完，另一份数据却还没到，这次加法就不能开始。此时再把本卡计算加快，也不会让用户更早收到答案：决定完成时间的，是那份仍在路上的数据。

先看图中的小例子，所有数值都是教学示意。本卡把输入 [1, 2] 乘以权重，得到 [5, 2]；另一张卡要送来 [3, 1]。下一步按位置相加，才能得到 [8, 3]。**权重**是训练后保留的一组数，本次输入变了，这组数仍可复用。计算前要把输入和权重读到计算单元；需要其他卡的结果时，还要等传输完成。

```wiki-diagram
file: inference-analysis-intuition
```

图里有两条准备路径：本卡做乘法，另一张卡传数据。只要各自的输入已经准备好，这两件事就可以同时推进；最后的相加必须等两份结果都齐备。沿这些依赖走到最终结果、决定最早完成时间的路径，叫**关键路径**。缩短另一条路径仍可能释放设备资源，让其他工作使用；是否提高整体吞吐，要另做同负载测量。我们先拆开计算和读取的成本，后面再用时间线找出该先缩短哪条路径。

## 先估一笔账：算得动，还是喂不饱

为什么减少输入能让一步变短，却又可能降低整机效率？沿用图里的权重：第一列是 [1, 2]，第二列是 [0, 1]。输入 [1, 2] 分别与两列相乘相加，就得到图中的 [5, 2]。现在多放一行输入 [3, 4]，仍乘这四个权重，得到 [11, 4]。新增输入要再做乘加，但不需要另一套权重。

这就有了两笔不同的账：处理两行输入，运算量大约是处理一行的两倍；如果同一次执行能复用已经读入的权重，权重读取量却不必翻倍。反过来，把两行拆成两次执行，每次工作更少，但可能各读一次权重。是否真的发生重复读取，取决于缓存和算子实现，不能只按批量推定。

把同一个过程放大，才能估计设备上的成本。**token（词元）**是分词后用整数编号表示的文本单位。令输入矩阵有 T 行，每行代表本次送进乘法的一个 token 位置；现在将每行扩为 4096 个数，权重相应扩为 4096×4096，输出仍有 T 行、每行 4096 个数。行数变多对应“多处理一些输入”，权重大小在这次比较中保持不变。矩阵的基本计算只在[矩阵乘法](matmul-and-weights.md)展开。

以下是**教学示意**：权重采用每个数 2 字节的 BF16 浮点格式。按一次乘法加一次加法记 2 次浮点运算，计算量约为 2×T×4096×4096。先只计权重从设备内存读取一次的字节，不计输入、输出、其他中间结果和缓存复用变化。这是简化的权重流量模型。

**算术强度**表示每搬运一字节，完成多少次浮点运算，单位是 FLOP/B。这里的“搬运”指定为设备内存到计算单元这一层；换成主机到设备或卡间通信，要另列账，不能混用带宽。仅计权重读取一次时，单次矩阵乘的算术强度随输入行数 $T$ 线性放大：

$$I_{\text{weight}}(T) = \frac{2 \times T \times 4096 \times 4096}{4096 \times 4096 \times 2\text{ B}} = T\text{ FLOP/B}$$

| 输入规模（BF16，权重 `4096×4096` 示意） | 权重读取量 | 乘加运算量 | 仅权重流量算术强度 |
| --- | --- | --- | --- |
| $T = 1$ 行 | $4096 \times 4096 \times 2\text{ B} = 33{,}554{,}432\text{ B}$ | $2 \times 1 \times 4096^2 = 33{,}554{,}432\text{ FLOP}$ | **1 FLOP/B** |
| $T = 2048$ 行 | $33{,}554{,}432\text{ B}$（32 MiB，同份权重复用） | $2 \times 2048 \times 4096^2 = 68{,}719{,}476{,}736\text{ FLOP}$ | **2048 FLOP/B** |

权重读入后能供更多行使用，才有上面的摊薄效果。若输入和输出也按 BF16、每个数 2 字节，2048 行时两者各占 16 MiB（1 MiB 为 2²⁰ 字节），已经不能忽略；再计输入读一次、输出写一次，总流量约 64 MiB，强度就降到约 1024 FLOP/B。缓存、分块和实际实现还会改变流量。**算子**是设备执行的一项运算；比较真实算子时，应使用同一存储层的实测字节数，或明确的流量估算。

## Roofline 给的是哪一种上限

**Roofline** 把算力和内存带宽放在一起，估计这段工作最高能跑多快；关于算力墙、带宽墙、算术强度拐点（脊点）与性能三角的系统推导，可直接回看[Roofline 模型与性能三角](roofline-and-metrics.md)。计算吞吐的上界取两者较小值：设备算力，以及内存带宽乘以算术强度。等价地，执行时间至少要容纳计算量除以算力、数据量除以带宽这两个时间中的较大值。

仍用上述简化模型，再假设设备在该精度下能提供 100 TFLOP/s 算力、1 TB/s 内存带宽；1 TFLOP/s 为每秒 10¹² 次浮点运算，1 TB/s 为每秒 10¹² 字节。这组能力是教学假设，**不是 A2 或昇腾 950 的规格**。算力与带宽的比值为 100 FLOP/B：低于它时，简化模型的带宽约束更紧；高于它时，计算约束更紧。

| 输入规模 | 计算所需时间下界 | 只读一次权重所需时间下界 | 简化模型里更紧的约束 |
| --- | --- | --- | --- |
| 1 行 | 约 0.000336 ms | 约 0.0336 ms | 权重读取 |
| 2048 行 | 约 0.687 ms | 约 0.0336 ms | 计算 |

读第一行时，可以把两项理解为两道必须过的关：乘加最快约 0.000336 ms，单是把权重搬过来就至少约 0.0336 ms。即使乘法再快，也得等读取，所以这组假设下先值得研究减少读取或增加复用。第二行则相反：计算下界已经达到约 0.687 ms，比权重读取下界长得多，继续提高带宽未必能明显缩短它。

这些下界来自上一节的运算量、字节数分别除以假设的每秒能力，再换成毫秒。真实执行还包含设备调度、算子启动和布局转换，不能把表中数值当作耗时预测；若命中更近的缓存、改变了设备内存读取量，也要先重算流量再比较。

因此，“decode 通常更容易受访存影响”只能作为提出假设的起点。**decode** 是利用历史继续生成；历史变长会改变读取成本，批量、量化和专家分配又会改变每次乘法的工作量。实际读哪些历史，回到 [attention 成本](attention-cost.md)；不要把整个模型都归为一种固定瓶颈。

## 时间线怎样告诉你，应该先优化哪一段

现在把单个算子放回执行过程。**主机**是运行 Python 调度和准备输入的 CPU 一侧；**设备**是执行模型计算的 NPU 一侧。主机把任务提交出去，并不意味着设备已经开始它：设备前面还排着其他任务，或仍在等输入依赖。


主机侧的一次引擎调用返回，也不一定表示批次结果已就绪。在批次队列路径中，没有延迟采样、批次已入队但队列尚未满，且本轮执行了模型或调度器仍有请求时，调用可以提前返回。测量时应分开记录调用返回、批次结果就绪和请求完成这三个时刻。

以下仍是教学示意。一次矩阵计算在 0–6 ms 执行；独立通信任务在 3–8 ms 执行，它传输的是之前已经准备好的数据，不依赖这次矩阵乘法的最终输出。下一段计算要同时等这两项完成，所以最早在 8 ms 开始。

```wiki-diagram
file: inference-analysis-critical-path
```

计算耗时 6 ms、通信耗时 5 ms，直接相加成 11 ms 会重复计算重叠区间。若矩阵乘法缩短到 4 ms，通信仍到 8 ms 才结束，下一段仍在 8 ms 开始。相反，如果通信必须等矩阵乘法结束才能启动，就要沿串行依赖重新计算。这就是为什么需要看时间线和依赖，而不是只把算子耗时排序。

实际查一条慢请求时，先用请求编号找到它所在的计算步骤，再把这一步的输入准备、设备执行、通信和结果处理接起来。**rank** 是分布式进程的编号；同一步涉及多个 rank，要比较同一次通信的设备侧到达与完成，以及各自前面的依赖。

如果一张卡晚到，其他卡的通信区间会包含等待它的时间。先查晚到卡此前的计算和负载；只有在参与者已具备条件后，交换阶段仍异常长，才继续核对通信体量、拓扑和链路。不同机器的绝对时间要先校时，时钟误差大于待测差异时，只比较本机时长和可确认的先后关系。

## 把一个瓶颈判断写成可检验的假设

现在回到 D/N。A 的混合步花了 190 ms，B 的每个混合步花了 70 ms。结合[样例的客户端记录](inference-performance-walkthrough.md#同一组请求比较两种设置)，可以判断 D 的输出停顿缩短了，代价是 N 的首字更晚。还不能仅凭混合步变短，就断言“计算量是唯一瓶颈”；要继续用下面的证据区分。

假设 A 同一步的设备执行记录（trace）又提供了这些**示意时刻**：rank 0 的本地工作在 450 ms 完成，rank 1 在 600 ms 才具备交换条件，双方交换到 620 ms 结束。rank 0 上看到的长通信区间包含了等 rank 1 的时间。先到的卡即使更早算完，也无法独自交付这一步结果。

| 对同一慢步补到的证据 | 应先分析哪一项 | 为什么 |
| --- | --- | --- |
| 各卡都持续计算到接近结束，矩阵的有效输入很多 | 计算量、实际算力与算子实现 | 减少工作可能直接缩短决定完成时间的计算 |
| 本地工作已结束，某个参与者很晚才就绪 | 迟到者的输入量、专家分配和前置依赖 | 当前卡显示在“通信”，时间却可能耗在等人 |
| 设备步已结束，客户端仍迟迟没收到 | 结果处理与发送 | 再优化这一步，未必能消除主要等待 |

这也解释了分块为什么不能无限缩小：较短的步让 D 更早交回结果，但单次权重复用变少、调度次数变多，N 要跨更多步骤才能完成输入处理。Roofline 帮你估计局部效率，关键路径帮你判断是否影响请求，[测量页](inference-benchmarking.md#吞吐提高了多少要先说清数了什么)再用达标吞吐判断整体是否值得。三者必须接起来。

把上面的 Roofline 算术强度与时间线依赖合到一起，就能先将任意慢步落入四个瓶颈象限（Host / Compute / HBM / Comm），再挑出首取证据与可证伪实验：

```wiki-diagram
file: inference-performance-analysis-fig-four-quadrants
```

一份有用的判断应当能说明：看到什么，预计改变什么后哪一段会变，结果不符合时转去哪条路。

| 看到的记录 | 下一次只检验什么 | 怎样解释结果 |
| --- | --- | --- |
| 设备任务之间有空隙，主机仍在准备输入 | 固定设备路径，比较输入准备耗时及任务就绪时间 | 空隙随主机准备缩短而消失，支持供给不足；任务已就绪却仍空闲，则继续查依赖与同步 |
| 小批矩阵读取量大，运算量少 | 在可接受延迟内增加复用同一权重的工作量 | 单位输出成本下降且带宽记录相符，支持摊薄读取；同步增加的排队和缓存压力仍要计入 |
| 多卡通信区间长，一张卡明显迟到 | 保持交换规模，控制该卡之前的负载 | 迟到与等待同步减少，支持负载或依赖问题；不能仅据通信区间名称归因网络 |

采集工具能告诉你某一段在何时执行，却不自动说明它属于哪条请求。缺 request、step、rank 的关联时，先补映射；具体采集字段与位置在[贯穿样例](inference-performance-walkthrough.md#现场怎样拿到这些记录)。证据齐后再沿[性能排障](inference-performance-troubleshooting.md)选择动作。

沿学习路径往下，接着读 [DeepSeek 生产实践](deepseek-serving-case.md)：如果把长输入处理与持续生成放到不同实例，还能减少多少相互等待，又会增加哪些状态交接？本页的依赖和耗时分析仍然适用，只是要追踪的数据开始跨实例移动。

## 先读监控面板，再选择一条慢请求

**Prometheus** 定期从服务的 HTTP 接口取走数值，保存成随时间变化的记录；**Grafana** 把这些记录画成面板。它们适合发现“哪一段时间开始积压、哪个执行组更紧张”，再据此选择要追踪的请求。服务发布的是统计结果，不是一条请求逐步运行的录像；内部 TTFT、排队和生成阶段的起止，统一见[服务内部计时](inference-benchmarking.md#服务里的同名指标和客户端在量同一段吗)。

这条记录链从请求主线开始：EngineCore 把调度事件、缓存统计和输出批次时间送给前端；前端处理输出时更新请求统计，再由统计 logger 更新计数与桶。HTTP 指标端点展示这些当前值，Prometheus 按自己的周期抓取。因而“每十秒打印一次日志”“每五秒抓取一次指标”和“每次输出更新统计”是三个不同的节奏，缩短抓取间隔也不会增加单个输出内部的计时精度。

### 同样是一条曲线，数值的含义不同

先认三种类型。**Gauge** 保存最近的状态，例如当前等待请求数；**Counter** 累计发生过的数量，例如已生成 token 数；**Histogram** 把多次观测放入不同范围的桶，同时保存观测次数和数值总和，例如请求排队时长。

Counter 从 100 增至 140，要再知道经历了多久才能换成每秒产量；它在进程重启后会重置。Histogram 的“时长总和”也不是平均时长。示意两条请求分别排队 0.1 秒、0.3 秒，总和是 0.4 秒、次数是 2，所以平均每条 0.2 秒。若这两条在一个 10 秒窗口内结束，只看时长总和的增长率会得到每秒累计 0.04 个“请求等待秒”，不能把 0.04 秒当作请求均值。

分位数还需要桶。假设截至 0.1 秒的桶有 6 条，截至 0.5 秒的桶有 10 条，后者已经包含前 6 条，不能相加成 16 条。要估计整体 P95，先合并同一边界的桶，再计算分位数；直接平均两个引擎各自的 P95 没有这种含义。桶内怎样分布没有被保留，插值结果也不同于拿全部原始请求排序得到的精确分位数。

看面板时还要保留**标签**，也就是用于区分同名记录的字段。vLLM 的基础引擎指标带模型名和 engine 编号，后者区分被管理的 EngineCore。先按引擎看等待、输出和 KV 占用，再看总量，才不会把一个组的拥塞平均掉。单个引擎编号也不等于 TP 或 EP 的每张物理卡编号。

### 离线脚本怎样取得同一类统计？

**离线指标快照，是 Python 脚本读取当前进程里已经登记的统计值。** 已有 LLM 对象的 get_metrics 返回带名称和标签的指标对象列表；无需启动 HTTP 服务或抓取 /metrics。统计仍由引擎输出处理更新，读取快照本身不会推进生成、等待在途请求结束或清零计数。要比较完整一轮，先让 generate 返回，或让[离线队列的等待调用](request-call-chain.md#离线脚本能先提交几组请求再一起取结果吗)结束，再取数。

沿用上面的计数示意：同一组标签的 Counter 在前后快照里是 100、140，这轮增加了 40；还要记录两次取数的时间，才能算速率。它不是“这次调用生成了 140 个”。快照来自进程共用的指标登记处，同名的不同模型、引擎标签会分别保留，调用方要选择对应标签，不能认为列表自动只属于当前这个 LLM 对象。

前三种对象仍按前面的 Gauge、Counter、Histogram 读；投机解码另有按候选位置排列的 Vector。Histogram 提供 sum、count 和累计上界桶，Vector 提供 values，不能对所有对象统一读取 value。读数要扫描并组织现有指标，统计本身也有记录成本；参数入口见[怎么开](#怎么开)。

### 缓存命中、占用与保留时间分别回答什么

三组缓存指标口径不同，排查前先拆清各回答什么问题：

- **KV 占用比例（`kv_cache_usage_perc`）**：表示当前不在空闲队列里的块占可用池容量的比例，1 表示 100%（容量扣除保留作空占位的 null 块）。已经释放引用、仍留着可命中历史的块可以在空闲队列里，因此它既不是所有历史数据的物理存储比例，也不是整卡显存使用比例。
- **Prefix caching 命中率**：回答查询的历史位置里多少能复用。默认 Prometheus 的本地查询、命中计数单位是 token，抢占重算的查询另存、不加入这对普通累计计数；外部 KV connector 与多模态预处理缓存各有计数，后者以媒体项目为单位，不能合进 token 命中率。另外，周期文字日志的命中率用最近一批批请求统计组成的窗口按查询 token 数加权，并在超过目标请求数时丢弃旧批（最新整批仍保留），它既不是固定最近 1000 个块，也不等于监控系统任选五分钟的累计值之差——两条曲线不同时，先核窗口、单位和是否为本地缓存，再查实现。
- **块的保留时间（`--kv-cache-metrics`，默认关闭）**：占用高不说明保留的历史很快会再次使用。需要进一步研究时，可按默认 1% 分配抽样记录块从分配到淘汰的生命周期。固定实现的“访问”在块池 touch 路径记录（例如把命中的块用于请求），不是每次 attention 读取设备内存。

用启用 prefix caching 的普通块池举例：一个被抽中的块在 $t_0 = 0\text{ s}$ 分配，在 $t_1 = 2\text{ s}$ 与 $t_2 = 5\text{ s}$ 被 touch，于 $t_{\text{evict}} = 9\text{ s}$ 淘汰。请求释放引用、把块放回可复用队列时，历史仍能保留；真正淘汰时才发布这笔事件：

| 被抽中块的生命周期指标（示意） | 算式 | 数值结果 |
| --- | --- | --- |
| 保留时间（Lifetime） | $t_{\text{evict}} - t_0 = 9 - 0$ | **9 秒** |
| 淘汰前空闲时间（Idle） | $t_{\text{evict}} - t_2 = 9 - 5$ | **4 秒** |
| 两次已记录访问的间隔（Interval） | $t_2 - t_1 = 5 - 2$ | **3 秒** |

没有被淘汰的块尚未成为保留时间样本，所以面板暂时没有新观测，不能解释为所有块的保留时间都是零。每个样本只保存最近 4 次访问，最多报告其中 3 个间隔；重置缓存会清空未发布的状态。采样与淘汰时点决定了这个分布的适用范围，不能拿它代替整卡内存带宽测量。块何时可复用见[块的释放与回收](vllm-kv-block-allocation.md)。

### 从整体分布追到一条请求

**OpenTelemetry trace** 用有起止时间的 span 记录一次操作，并通过上下文把相关操作连起来；**OTLP** 是把这些记录发给采集服务的协议。它与定期拉取累计指标是两条链。固定生成路径在请求结束时生成 llm_request span，附上请求编号、输入输出数量和前述阶段时间，因而可以把“这一段时间的排队变长”追到具体请求。

这些属性来自请求事件统计，仍不是逐个 NPU kernel 的计时。若要判断设备算、搬、等的先后，继续使用前面的 profiler 与 request、step、rank 关联。调用方传播 trace 上下文，才能将客户端、入口与引擎 span 连起来；只有服务端开启上报，不会自动补齐所有客户端和代理事件。

官方示例提供 Prometheus/Grafana 与 OpenTelemetry 两套入口。前者需要核对抓取地址、端口、模型与引擎标签，后者需要配套依赖、协议和采集器。具体参数与可直接核对的查询放在[怎么开](#怎么开)；采集成本要与正式基准分开记录。

## 放到 GLM 双机，模型的简化边界在哪里

[固定部署](glm-5-3-flash-two-node.md#部署前提)采用 W8A8，即部分权重与激活用 8 位整数表示；**激活**是本次计算产生的中间数值。上面的 BF16 矩阵只能用来学习估算方法，不能直接代入该部署的吞吐。不同矩阵的实际精度、缩放数据和转换开销，需要沿[量化](quantization.md)核对。

GLM 使用 **MoE**，每个位置选择少数专家网络处理。整个批次有多少 token，不等于每个专家矩阵收到多少行输入；专家之间分配不均，能同时造成局部小矩阵和迟到。请求分给哪个执行组，与 token 被送到哪个专家，是两个不同的负载问题，分别见 [DP 路由](dp-request-routing.md)和[专家负载均衡](eplb.md)。

**graph mode** 通过预先捕获、重放支持的执行流程减少组织任务的工作；实际输入还会补齐到支持的尺寸。**MTP** 会猜测并验证多个候选 token。分析时分别记录有效工作、补齐后执行尺寸、候选与接受数量；两组协作、图与通信方案切换的具体数字仍以[多请求页](concurrent-requests.md)为唯一推导。


单次只处理一个位置，也可能仍处于 prefill，例如 PD 交接时的单 token 提示词块。应结合提示词计算进度判断阶段，再比较各阶段的执行尺寸。

## 常见误解

- **“利用率很高，说明已经接近最优。”** 利用率只能说明某种忙碌程度；等待数据、冗余补齐和有效计算要分开看。
- **“显存没满就不是内存问题。”** 容量回答放不放得下，带宽回答搬得够不够快。
- **“通信区间长就该换网络。”** 先排除参与者迟到和依赖未满足，再查交换本身。
- **“某个算子快了一倍，服务也能快一倍。”** 需要确认它占关键路径多少，以及新瓶颈是否已经出现。

## 对照源码

### 怎么开

**先选采集对象。** 2026-11-02 官方指南提供两条入口：Ascend PyTorch Profiler 记录 CPU/NPU 算子及设备任务，MS Service Profiler 记录服务函数、请求和批次事件。前者适合确认设备执行与主机下发，后者适合补调度关联；它们都不会自动证明某个慢算子属于目标请求。

使用支持该 ProfilerConfig 的版本时，将下面片段合入已有启动命令。目录由服务进程写入，stack=false 减少额外堆栈采集：

```bash
--profiler-config '{"profiler":"torch","torch_profiler_dir":"/data/profile","torch_profiler_with_stack":false}'
```

服务稳定后，依次开始采集、发送目标负载、停止采集；地址与端口换成实际实例。停止后检查各 rank 的产物，不能只看到 HTTP 成功就认为 trace 完整：

```bash
curl -X POST http://127.0.0.1:8000/start_profile
# 在这一窗口发送需要分析的请求。
curl -X POST http://127.0.0.1:8000/stop_profile
```

未配置非空 profiler 字段时，这两个端点不注册，404 应先检查服务启动配置。生成的 ascend_pt 目录需要分析，可调用 torch_npu.profiler.profiler.analyse，将实际目录作为参数；随后在 ASCEND_PROFILER_OUTPUT 下查看 trace_view.json、kernel_details.csv、operator_details.csv 和 step_trace_time.csv。用 trace 看依赖与重叠，再用汇总表找占比，不能把多个并行流的耗时直接相加当请求延迟。

**PD 要分别采 P、D。** 官方普通 PD load-balance proxy 不转发 start/stop_profile，应在 P、D 各自启动时配置不同目录，直接请求各实例 HTTP 端口。EPD layerwise 示例代理支持广播这两个命令，须核对实际使用的是哪种代理。将两端 rank、请求与时钟对齐后才能分析传输等待。

需要服务函数事件时，按配套版本安装或升级 msserviceprofiler，启动前设置 SERVICE_PROF_CONFIG_PATH；自定义符号文件用 PROFILING_SYMBOLS_PATH。运行中把配置 enable 从 0 改为 1 开始采集，修改符号表则须重启服务。采集后执行 `msserviceprofiler parse --input-path=/path/to/run --output-path=/path/to/output`，检查 request.csv、batch.csv、kvcache.csv 与 chrome_tracing.json。缺域、符号版本不匹配或窗口太短会造成缺记录，不能把缺记录解释成没执行。

上述操作来自 921ccc52 指南；旧环境变量 VLLM_TORCH_PROFILER_DIR 已被该指南标为弃用。运行前先核所用版本的 CLI 与采集器，不能把最新工具包直接当成旧 GLM 镜像依赖。采集结束后关闭工具，再测正式收益。

**先用日志区分忙、排队与缓存占用，再决定是否采集执行轨迹。** vLLM 内部日志、HTTP 访问日志、逐请求内容、引擎周期统计是不同入口；请求内容和 Uvicorn 设置见 [API 日志参考](api-server-entry.md#怎么开)。下面六项控制内部 logger 与统计路径，都是启动配置，不是请求 JSON 字段。

| 入口 | 默认 | 生效范围 |
|---|---|---|
| 环境 VLLM_LOGGING_LEVEL | INFO，读取后转大写 | 设置默认 vLLM logger 和 handler 级别；常用 DEBUG、INFO、WARNING、ERROR、CRITICAL。不是 CANN/HCCL 的统一日志级别 |
| 环境 VLLM_CONFIGURE_LOGGING | 1，按 int 后转 bool | 0 表示 vLLM 不自行安装日志配置，由宿主应用负责；不是“禁止所有日志” |
| 环境 VLLM_LOGGING_CONFIG_PATH | 未设置 / None | JSON 文件路径，内容为 Python logging.dictConfig 接受的字典；存在时替换默认配置，不是仅追加几个字段 |
| CLI --disable-log-stats；Python disable_log_stats | 普通在线 false；离线 LLM 省略时设为 true | 是否关闭默认引擎统计路径；true 的影响不只是不打印几行文字，见下文 |
| 环境 VLLM_LOG_STATS_INTERVAL | 10.0 秒 | API 周期任务等待多久后调用统计日志；按 float 解析，大于 0 才采用，非正数回退 10 秒 |
| CLI --aggregate-engine-logging；Python aggregate_engine_logging | false | false 按所管理的 EngineCore 分开打印；true 使用合并统计日志，减少 DP 多引擎输出行数 |

例如维持默认统计但每 30 秒打印一次，可在启动前设置 `export VLLM_LOG_STATS_INTERVAL=30`；短期排障再设 `export VLLM_LOGGING_LEVEL=DEBUG`。这些 export 要进入实际服务进程的环境。使用自定义 JSON 时，文件里的 logger/handler 级别决定最后配置，不能期待 VLLM_LOGGING_LEVEL 覆盖 JSON。自行配置宿主 logging 时设置 VLLM_CONFIGURE_LOGGING=0，并取消 VLLM_LOGGING_CONFIG_PATH；两者不能同时要求“不要配置”与“读配置文件”。

**统计关闭与仅隐藏 INFO 不同。** 普通在线 AsyncLLM 在 disable_log_stats=true 且没有自定义统计插件时不建立 StatLoggerManager，也就不建立其中默认 Prometheus 引擎统计收集器；/metrics 路由仍可能存在并返回其他指标，不代表引擎吞吐、排队与缓存指标还在更新。若有自定义统计插件，插件会让统计路径保持启用，但默认文字 logger 仍关闭。只想减少文字噪声且保留默认引擎指标时，应调整 logger 级别或周期，不能用 disable_log_stats 当作纯显示开关；提高级别又会隐藏其他 INFO，按取证需要选择。

**离线读取须在创建 LLM 时启用统计。** 在原有模型、并行等构造参数中加入 `disable_log_stats=False`；它不是 get_metrics 的参数。以下沿用这样创建的 llm，并假设本轮生成或等待已经完成：

```python
snapshot = llm.get_metrics()
for metric in snapshot:
    print(metric)  # 保留对象类型、名称、标签及对应读数。
```

这份列表是当前值；两次快照的差分和时间窗口由调用方保存。它直接读取当前 Python 进程的 Prometheus REGISTRY，不替代在线多前端的 /metrics 聚合，也不从别的服务进程远程取数。

本部署 node0 一个 API server 管理 DP2。默认可按两个引擎分别看运行与等待请求数、吞吐和 KV 占用；打开 aggregate_engine_logging 后，请求数相加，KV 使用比例取两个引擎的算术平均，吞吐按合并窗口的 token 数统计。示意两组运行请求分别 3、1，KV 使用率 80%、20%，合并显示运行数 4、KV 50%；这个平均数会掩盖第一组更紧张的情况。合并不改变路由，不把各引擎的 Prometheus 标签也合成一组。API server 数大于 1 时，为避免不完整统计，默认文字统计另有禁用分支；当前配方显式为 1，不触发该分支。

VLLM_LOG_STATS_INTERVAL 控制报告节奏，不是 Prometheus 抓取间隔，也不是每一步采样器的执行间隔。窗口平均可能掩盖短尖峰，空闲时日志级别也可能变化；没有看到新行时，先核统计开关、有效 logger 级别、进程状态与负载，再沿下面的链路定位。

**核对实际指标，再写查询。** 普通在线服务的 `/metrics` 发布 Prometheus 文本。先向实际 API 地址请求，查看 HELP、TYPE、标签与数值；地址示意如下：

```bash
curl http://127.0.0.1:8000/metrics
```

官方 Prometheus 示例设 scrape_interval=5s，这是示例抓取周期，不是 vLLM 的统计打印默认值。容器里的 host.docker.internal:8000 也须按服务所在网络替换。Grafana 导入 JSON 以后仍要核对查询：固定示例的 Queue Time 只对 queue 的 sum 求增长率，Prefill/Decode 面板也有同类口径；它们不能直接读成请求平均时长。

| 常用指标名（省略 vllm: 前缀） | 类型与单位 | 读数边界 |
|---|---|---|
| num_requests_running / num_requests_waiting | Gauge，请求数 | waiting 包含普通等待与暂缓等待；waiting_by_reason 可分 capacity/deferred |
| kv_cache_usage_perc | Gauge，0–1 比例 | 设备 KV 块池占用；按 engine 看，不是整卡显存 |
| prompt_tokens_total / generation_tokens_total | Counter，token | prompt 含缓存命中部分；按 prompt_tokens_by_source_total 的来源分计算、本地缓存与外部传入 |
| prefix_cache_queries_total / prefix_cache_hits_total | Counter，token | 本地普通查询与命中；先分别求窗口增长，再相除 |
| request_success_total | Counter，引擎请求结束数 | 带 finished_reason；枚举包括 stop、length、abort、error、repetition，不能把全部标签之和当业务成功率 |
| time_to_first_token_seconds / inter_token_latency_seconds | Histogram，秒 | 前者首个引擎输出批次，后者后续输出事件间隔，见计时页 |
| request_queue_time_seconds / request_prefill_time_seconds / request_decode_time_seconds / request_inference_time_seconds | Histogram，秒 | 请求结束时观测，按首次调度与首末输出事件分段 |
| request_time_per_output_token_seconds | Histogram，秒 | 每条请求一个平均值；短输出记 0，样本权重不同于输出事件间隔 |
| iteration_tokens_total | Histogram，token | 名字虽有 total，仍是每次统计输出的分布；计 computed prompt 与生成 token，不计图补齐尺寸 |

请求进入引擎之前就被拒绝的 HTTP 错误，不会凭空变成引擎完成样本；HTTP 请求数、引擎请求数、客户端成功数分别保留。MTP 的候选提议、接受与最终输出也分账，指标解释回到[投机解码](speculative-decoding.md)，不能把候选数作为交付吞吐。

下面使用 **PromQL**，即 Prometheus 查询表达式。示例约定抓取 job 名为 vllm，并保留 instance、model_name、engine，按实例和引擎诊断；现场替换 job 筛选。rate 先计算各计数序列的每秒增长并处理重置，再汇总；5m 是查询窗口，不是抓取间隔。

```promql
# 每秒生成 token；不同引擎分开看。
sum by (instance, model_name, engine) (
  rate(vllm:generation_tokens_total{job="vllm"}[5m])
)

# 已结束请求的平均首次排队秒数：时间总和增长率 / 样本数增长率。
sum by (instance, model_name, engine) (
  rate(vllm:request_queue_time_seconds_sum{job="vllm"}[5m])
) / sum by (instance, model_name, engine) (
  rate(vllm:request_queue_time_seconds_count{job="vllm"}[5m])
)

# 各引擎内部 TTFT 的 P95；le 是累积桶的上界，必须保留。
histogram_quantile(0.95, sum by (instance, model_name, engine, le) (
  rate(vllm:time_to_first_token_seconds_bucket{job="vllm"}[5m])
))
```

没有新观测时，平均值的分母为零，分位数也会得到 NaN；保留“无样本”状态，不填成零延迟。要看跨实例总分布，可在桶聚合时去掉 instance/engine，但先确认没有重复抓取同一组多进程聚合数据，并保证桶边界相同。总分布与每个引擎的诊断图同时保留。

API server 数大于 1 时，固定启动器使用 Prometheus 多进程目录，/metrics 的收集器读取该目录聚合；这与 TP/EP 有多少卡是两回事。未指定目录时启动器创建临时目录；自己指定 PROMETHEUS_MULTIPROC_DIR 时要在下一次服务启动前准备干净目录，不能混入上一轮进程的计数。多个前端暴露同一聚合内容时，抓取设计需避免再把副本相加。

**块保留时间和请求 trace 都是额外采集。** 将下列 KV 选项合入已有启动命令，仍须保留统计路径。0.01 表示按分配抽样 1%，不是每隔 100 次 attention 才读取一次：

```bash
--kv-cache-metrics --kv-cache-metrics-sample 0.01
```

OpenTelemetry 先确认镜像已具备 API、SDK、OTLP exporter 和 AI 语义约定这几项基础依赖。固定官方示例说明它们随 vLLM 提供，无须重复安装；仅在镜像缺失时按配套版本补齐，再启动采集器。官方示例以 gRPC 4317 或 HTTP 4318 接收；下面是 HTTP/protobuf 的启动环境与选项片段，端点换成实际采集器：

```bash
export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/protobuf
# 合入已有 vllm serve 命令：
--otlp-traces-endpoint http://127.0.0.1:4318/v1/traces
```

保持默认 log stats 启用：固定请求 span 读取其时间状态，普通无插件环境不要同时设置 disable_log_stats=true。协议未设置时固定实现选 grpc，支持的另一个值是 http/protobuf。collect_detailed_traces 默认未设；它的 model/worker/all 选择是另一组详细采集配置，本节核对的基础请求 span 不据此保证 NPU 的逐算子覆盖。要追设备执行仍使用本页开头的 Ascend profiler 入口。

按问题选短窗口采集主机函数与设备执行轨迹，再沿[请求调用链](request-call-chain.md)补上请求和批次关联。只有默认日志时，按[贯穿样例的最小取证步骤](inference-performance-walkthrough.md#怎么开)选择边界字段与采集入口；具体 profiler 配置使用现场版本对应的指南，保持窗口足以覆盖目标事件。

### 会报什么错

离线 LLM 未启用统计时调用 get_metrics，会触发 `AssertionError: Stat logging disabled`。应在创建对象时显式保留统计；仅调用 getter 或调高日志级别不会补建统计管理器。

VLLM_CONFIGURE_LOGGING=0 同时设置配置文件路径会抛 RuntimeError；路径不存在、JSON 语法错、顶层不是字典或 dictConfig 的对象/级别非法，都会在配置日志时失败。环境布尔值使用 0/1，不用 true/false 字符串；日志间隔非数字会在 float 转换失败，0 和负数会回退默认，并不表示停用。间隔使用有限正秒数，不依赖 NaN/Infinity 等特殊浮点值。若开启统计却看不到周期行，先检查默认文字 logger 是否因有效级别高于 INFO 或多前端条件而未创建。

性能差可以没有异常。若 trace 缺失某些 rank 或事件，先核对采集范围、工具支持和进程是否存活，不能把空白区域直接解释为设备停工。

KV 抽样率须满足大于 0 且不超过 1；填 0 会校验失败，停用应关闭整个 kv_cache_metrics。OTLP 依赖缺失、协议值不是 grpc/http/protobuf，或只设 collect_detailed_traces 而未给 endpoint，分别有明确校验错误。普通无插件路径关闭 stats 后再开启请求 trace，会缺少请求和批次统计状态，在完成输出的 tracing 断言处失败；检查两者的实际生效组合。

### 开销和什么时候别开

DEBUG、大量请求正文及过短统计周期会增加主机格式化、汇总与输出成本；日志阻塞还可能干扰所测时延。GLM 双机排查 DP 倾斜时优先保留分引擎统计；合并适合总览，不适合证明两个 DP 执行组一样忙。日志能提供排查线索，逐层设备耗时仍需执行轨迹与同口径实测。

指标按每组标签和每个桶保存序列，额外维度会增加存储与抓取量；请求编号适合留在 trace 中，不要为每个请求新造一组长期指标标签。提高 KV 抽样比例会增加块状态与事件记录，详细 trace 还会增加上报和同步成本，先限定窗口再评估开销。

数值转储用于追计算结果差异，profiler 用于追时间与依赖；两者都会改变运行开销。定位实验结束后关闭采集，回到[同口径基准](inference-benchmarking.md)验收。Roofline 也不能代替真实测量：精度、流量层级与带宽口径不一致时，估算本身就不成立。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；**本文 GLM 双机执行图与批次队列对照沿用例外 B 专用镜像钉点 `db701c1f`（配套 `vllm@0fc695fc`），与四版社区分支分别核对。**

| 监控与性能采集项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 基础标签与统计口径 | `model_name`/`engine`；Gauge / Counter / Histogram | 相同 | 相同；新增每请求抢占次数分布 | 与 `v0.30.0` 相同（`loggers.py#L473-L520`） |
| KV 保留采样与发布 | 默认 `false`、采样 0.01、范围 `(0, 1]`；分配抽样、touch 更新、淘汰发事件（近 4 次访问） | 相同；块池哈希管理变化 | 同一采样契约；块池增跨池释放与复用通知 | 同一采样契约（`observability.py#L20-L72`），不套用旧跨池细节 |
| OTLP 请求 span 与详细 trace | `endpoint=None`、协议默认 `grpc`；指定 detailed 无 endpoint 报错 | 相同 | 相同 | 相同 |
| 离线 `LLM.get_metrics` 与每步更新 | 省略 `disable_log_stats` 默认 `true`；有 `scheduler_stats` 且产出请求输出时更新 | 相同 | 仅有 `scheduler_stats`、无请求输出的步也记录（不触发周期文字打印） | 同 `v0.30.0`（`llm.py#L897`、`llm_engine.py#L319`） |
| 六项在线日志/统计默认 | `INFO` / `CONFIGURE=1` / `CONFIG_PATH=None` / `disable_log_stats=false` / `INTERVAL=10s` / `aggregate=false` | 相同 | 相同；非正间隔回退 10s，JSON 与 `configure=0` 冲突检查保留 | 相同（`envs.py#L900-L924`、`logger.py#L207`、`async_llm.py#L258`）；周期任务在 `launchers/utils` |
| Ascend Worker Profiler 入口 | 依赖外部指南，GLM 镜像走旧 `model_runner_v1` 路径 | 延续旧入口，按现场版本核对 | `worker.py#L1230-L1260` + `TorchNPUProfilerWrapper`（`torch_npu_profiler.py#L29-L74`）惰性创建，须 `profiler=torch` 且互斥 `msmonitor_use_daemon` | `worker.py#L1317-L1350` 延续 `TorchNPUProfilerWrapper`，模型执行全量迁入 `worker/v2/` |

Roofline 与关键路径分析方法在四版保持不变（基础原理回链[Roofline 模型与性能三角](roofline-and-metrics.md)），但函数定位须按实际 runner 版本核对，正式吞吐/时延验收须关闭 `stack`/`memory` 采集后重测；多前端（API server > 1）仍禁用默认文字统计汇总以避免不完整统计被误当全局量，离线关闭默认 stats 也不阻止在线自定义 logger。

### 源码位置

- 离线快照与四版对照：来源 84–99 核对 `v0.23.0`、`v0.26.0rc`、`v0.30.0`（`ced6857a`）与早期快照的构造默认、`get_metrics`、统计更新与读取器；`main`（`ba15685a`）最新入口见 `vllm@ba15685a:vllm/entrypoints/llm.py#L897-L915` 与 `vllm@ba15685a:vllm/v1/engine/llm_engine.py#L319-L360`。前后 100→140 是累计量差分示意，不是设备采集结果。
- 基础指标、KV 保留采样与 OTLP：来源 38–83 覆盖四版指标定义、发布消费者、块池采样与 Prometheus/Grafana/OTLP 规则；`main`（`ba15685a`）对应见 `vllm@ba15685a:vllm/v1/metrics/loggers.py#L473-L520` 与 `vllm@ba15685a:vllm/config/observability.py#L20-L72`。9/4/3 秒是本页示意事件的推导。
- 在线六项日志参数与 Ascend Profiler：来源 9–37 覆盖 `v0.23.0` / `v0.26.0rc` / `v0.30.0`（`ced6857a`）；`v0.30.0` 主基线与 `main` 的 Ascend Profiler 入口见 `vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1230-L1260`、`vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1317-L1350` 与两版 `vllm_ascend/profiler/torch_npu_profiler.py#L29-L74`，`main` 日志/统计见 `vllm@ba15685a:vllm/envs.py#L900-L924`、`vllm@ba15685a:vllm/logger.py#L207-L240` 与 `vllm@ba15685a:vllm/v1/engine/async_llm.py#L258-L300`。
- Roofline 理论、引擎批次队列与采集指南：参见 [Berkeley Lab 原作者团队说明](https://amcr.lbl.gov/departments/computer-science-department/ppan/roofline-performance-model/) [S1]、`EngineCore`（`vllm@0fc695fc:vllm/v1/engine/core.py#L538-L546`、`#L574-L577`）[C2]、GLM runner（`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2914-L2940`）[C3] 与[官方服务 Profiling 指南](https://docs.vllm.ai/projects/ascend/en/main/developer_guide/performance_and_debug/service_profiling_guide.html) [S4]。
- 矩阵尺寸、设备能力和重叠时间均为教学假设 [A]，相应流量与时间为推导 [D]；现场假设的组织方法为本站编排 [I]。当前没有目标设备计数器与 A/B 实测。
