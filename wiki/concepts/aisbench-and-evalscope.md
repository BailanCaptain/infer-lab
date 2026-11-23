---
id: aisbench-and-evalscope
title: AISBench 与 EvalScope 实战：压测模式、指标口径对齐与精度基线评测
type: concept
origin: direct
summary: >-
  系统拆解在昇腾 vLLM Ascend 上使用 AISBench 与 EvalScope 开展性能压测和数据集精度评测的完整规范，厘清固定并发与到达率模式差异、冷启动预热与前缀缓存污染剔除、客户端与服务端 Prometheus /metrics 的 TTFT/TPOT/ITL 口径对齐，以及推理模型思维链剥离与长度截断避坑要点。
aliases:
  - AISBench
  - EvalScope
  - ais_bench
  - evalscope eval
  - evalscope perf
  - evalscope[perf]
  - 并发模式与到达率模式
  - TTFT TPOT ITL 口径对齐
  - 数据集精度基线
  - Coordinated Omission
  - 协调遗漏
chapters:
  - '19'
order: 4
sources:
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L245'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_evalscope.md#L1-L120'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/performance_benchmark.md#L70-L230'
  - 'vllm@ced6857a:vllm/benchmarks/serve.py#L403-L466'
  - 'vllm@ced6857a:vllm/benchmarks/serve.py#L568-L640'
  - 'vllm@ced6857a:vllm/v1/metrics/stats.py#L438-L475'
  - 'vllm@ced6857a:vllm/v1/metrics/stats.py#L540-L580'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L811-L839'
  - 'vllm@ced6857a:vllm/v1/metrics/loggers.py#L1133-L1175'
  - 'vllm-ascend@2c59ff10:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L50'
  - 'vllm-ascend@2ed6cbba:docs/source/developer_guide/evaluation/using_evalscope.md#L1-L50'
  - 'vllm-ascend@8d6180e2:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L50'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: inference-benchmarking
    kind: builds-on
    note: 先掌握吞吐与时延基准测试的一般实验设计原则，再在本页落地 AISBench 与 EvalScope 工具选型
  - to: inference-capacity-and-reliability
    kind: builds-on
    note: 结合该页的 Prometheus /metrics 指标字典与容量边界，把单次压测数字换算成线上并发容量
  - to: prefix-caching
    kind: builds-on
    note: 压测重复 prompt 时自动前缀缓存会虚高吞吐，理解块级前缀复用机制有助于避免测试污染
  - to: core-cli-params
    kind: builds-on
    note: 评测长思维链数据集时需按本页与该页联动调整 --max-model-len 与批预算，避免答案截断
contradicts: []
updated: '2026-11-24'
---

把模型部署到昇腾 NPU 并跑通一条 `curl` 对话后，团队紧接着要答两道上线必考题：**「这组配置能扛多大并发、时延是否达标？」**和**「换了量化格式或升级 `v0.30.0` 后，答题准确率有没有掉点？」**。在昇腾生态里，除了 vLLM 自带的 `vllm bench serve`，最常用的两套工具是 **AISBench**（昇腾官方基准评测套件，覆盖服务压测与学术数据集精度评测）和 **EvalScope**（ModelScope 一体化评测压测工具，单条命令即可驱动 OpenAI 兼容接口做 `eval` 精度评测与 `perf` 性能压测）。

然而实际项目里，两份测同一台机器的报告经常打架：客户端测出的首字时延（**TTFT**，Time to First Token，从发包到收到第一个输出词的等待）比服务端 `/metrics` 高出一截；固定并发下 P99 漂亮得反常，线上刚上量就雪崩；同一份 `Qwen3` 权重换个工具跑 `GSM8K` 分数直接腰斩。本页围绕**工具选型、负载模式、预热剔除、双端指标口径对齐与精度基线防错**五件事，给出可复现的实操准则。

## AISBench、EvalScope 与 `vllm bench serve` 怎么分工？

三套工具都通过标准 HTTP OpenAI 兼容接口（`/v1/completions` 或 `/v1/chat/completions`）驱动正在运行的 `vllm serve` 实例，区别在于配置范式与生态侧重：

| 工具 | 核心定位 | 典型命令入口 | 优势与适用场景 |
|---|---|---|---|
| **AISBench** | 昇腾官方主推的精度 + 性能一体化评测套件 | `ais_bench --models vllm_api_general_chat --datasets ... --mode all` | 内置昇腾常用评测集配置（C-Eval、MMLU、GPQA、MATH-500、LiveCodeBench、AIME 2024、GSM8K）、支持推理模型思维链剥离后处理器（`extract_non_reasoning_content`）及详细逐题落盘（`--dump-eval-details`） |
| **EvalScope** | 轻量上手的在线精度评测（`eval`）与并发压测（`perf`） | `evalscope eval --eval-type server ...` / `evalscope perf --parallel ... --stream` | `pip install evalscope[perf]` 即装即用，命令行直接指定 `--datasets gsm8k --limit 10` 或 `--dataset openqa --parallel 5 --number 20`，适合快速回归与开发期摸底 |
| **`vllm bench serve`** | vLLM 上游内置服务压测脚本 | `vllm bench serve --backend openai-chat --request-rate ...` | 与引擎源码同仓演进，精准控制泊松/伽马到达率（`--request-rate` + `--burstiness`）、随机/多模态/前缀重复合成负载及 **SLO**（服务等级目标）达标有效吞吐 **Goodput** 统计（口径见 [推理测量](inference-benchmarking.md)） |

## 并发模式 vs 到达率模式：为什么测完吞吐还要测到达率？

压测负载主要分两类发生器，二者回答的问题完全不同：

1. **固定并发模式（Closed-loop，闭环压测）**：例如 AISBench 的 `batch_size`（配 `request_rate = 0`）、EvalScope 的 `--parallel N` 或 `vllm bench serve --max-concurrency N`。客户端始终维持恰好 `N` 条在途请求——完成一条再补发一条。它适合**摸清系统饱和吞吐上限**（输出 token/s 随并发从 `1 → 4 → 16 → 64 → 128` 爬升的拐点）。但闭环压测存在经典的**协调遗漏（Coordinated Omission）**：一旦某一步因长 Prefill 或抢占变慢，压测器自己会“停下来等旧请求回来再发新请求”，无意中替服务端削峰，导致报告里的 P99 时延远低于真实线上突发流量。
2. **到达率模式（Open-loop，开环压测）**：例如 `vllm bench serve --request-rate R --burstiness B` 或在 AISBench 配置非零 `request_rate`。客户端按既定速率每秒发出 `R` 条请求，不因服务端变慢而减速。当 `burstiness = 1.0` 时请求间隔服从标准泊松过程（指数分布），`0 < burstiness < 1` 模拟更剧烈的流量尖刺，`burstiness > 1` 趋向均匀发送。它用于**测算在给定业务 SLO（例如 TTFT 首字时延 ≤ 2 s、TPOT 单输出词平均耗时 ≤ 50 ms）下的安全承载 QPS（每秒请求到达数）与 Goodput（达标请求吞吐）上限**。

## 客户端指标 vs 服务端 `/metrics`：如何把 TTFT、TPOT 与 ITL 对齐？

无论是 AISBench、EvalScope 还是 `vllm bench serve`，客户端打出的时延都覆盖了从“发包”到“收到 **SSE**（Server-Sent Events，服务端逐段推送的流式事件）流”的整条外部路径；而服务端 Prometheus `/metrics` 监控拉取接口（详见 [容量与可靠性指标](inference-capacity-and-reliability.md)）只统计引擎内部事件时间戳。在核对双端报告前，先明确三个核心时延指标的含义：**TTFT** 是首字等待、**TPOT**（Time Per Output Token）是首字之后每个输出词的平均耗时、**ITL**（Inter-Token Latency）是相邻两个输出词之间的实际间隔。两套口径的覆盖区间如下图所示：

```wiki-diagram
file: aisbench-fig-metrics-alignment
```

把两个视角的精确公式写在同一张表里，偏差来源一目了然：

| 指标 | 客户端口径（以 `vllm bench serve` 为例） | 服务端 Prometheus `/metrics` 口径 | 常见偏差原因 |
|---|---|---|---|
| **TTFT**（首字时延） | 收到首个非空 SSE chunk 时刻减去 HTTP 请求发出时刻 | `vllm:time_to_first_token_seconds`：API 前端统计 `iteration_timestamp - arrival_time`（从 API 前端收到请求时间戳到首输出批统计时间戳，已覆盖入队、Prefill 与引擎回传前端） | 客户端多出客户端序列化、TCP/TLS、反代转发与首个 SSE 包回传；若漏加 `--stream`（非流式），客户端只能把整段 E2E（端到端耗时）记作 TTFT |
| **TPOT**（单输出词均值） | 对输出词数 $N_{\text{out}} > 1$ 的请求：$\text{TPOT} = \frac{\text{E2E} - \text{TTFT}}{N_{\text{out}} - 1}$ | `vllm:request_time_per_output_token_seconds`：按完成请求记录 $\frac{\text{decode\_time}}{N_{\text{gen}} - 1} = \frac{\text{last\_token\_ts} - \text{first\_token\_ts}}{N_{\text{gen}} - 1}$（止于末次引擎出词事件，不含 SSE 回传） | 若客户端流式接口把多个 token 打包进同一个 SSE chunk，或按本地分词器对文本重算 $N_{\text{out}}$，会与引擎内部 `num_generation_tokens` 产生 1~数个 token 的分母偏移 |
| **ITL**（相邻词间隔） | 流式返回相邻两个非空 SSE chunk 到达时刻的差值列表 | `vllm:inter_token_latency_seconds`：引擎每次迭代产生新 token 之间的实际间隔 | 网络抖动或代理缓冲（如 Nginx 未关闭 `proxy_buffering`）会把连续多个 token 攒在一起吐给客户端，造成客户端出现“先长停顿后 0 ms 连发”的假毛刺 |

**预热与污染剔除铁律**：无论用哪套工具测性能，正式采样前都须先打一轮小批量预热请求并丢弃其数据。即便启动阶段完成了图捕获与常规预热（见 [NPUWorker 启动](npu-worker-lifecycle.md)），首次真实请求仍可能触发 **ATB**（Ascend Transformer Boost，昇腾 Transformer 加速库）矩阵乘缓存写入、首轮动态形状分支或网络长连接建连。同时，若服务端开启了自动前缀缓存（[Prefix Caching](prefix-caching.md)），压测须使用多样化输入或显式加随机前缀，避免重复 prompt 命中 99% KV 复用虚高 TTFT 与吞吐。跨拓扑做横向对比时，还须保持接口类型、输入长度分布与汇总统计量一致——例如 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md) 就明确区分了单卡 `/v1/chat/completions`（`24 ~ 40` prompt tokens，中位数）与八卡 `/v1/completions`（`262` prompt tokens，均值）的口径边界：两者可对照稳态 `TPOT`，但 `TTFT` 受输入长度影响不可混作单变量 A/B。

## 数据集精度基线与四类高频掉点陷阱

用 AISBench 或 EvalScope 跑精度基线（对比 BF16 原版 vs 量化版，或 `v0.26` vs `v0.30.0`）时，绝大多数“掉点 10~30 分”并不是算子出错，而是下面四个评测配置陷阱：

```wiki-diagram
file: aisbench-fig-accuracy-pitfalls
```

1. **上下文截断导致思维链未写完**：官方 AISBench 指南明确提示，评测服务端的 `--max-model-len` 建议大于 **`35000`**，且客户端配置的 `max_out_len`（通常 `32768`）加上输入长度必须小于 `--max-model-len`。对于 `MATH-500`、`AIME 2024`、`GPQA` 等长 CoT（思维链）推理题，一旦 `max_out_len` 给成 `1024` 或 `2048`，模型还在推导就被强行截断，永远提取不到最终答案框。
2. **未剥离推理标签导致正则判错**：像 `Qwen3` 思考模式或 `DeepSeek` 推理模型会先输出 `<think>...</think>` 再给答案。AISBench 模板里专门配置了 `pred_postprocessor=dict(type=extract_non_reasoning_content)`，如果省略该后处理器，答题正则可能误抓思维链中间试错数字导致误判。
3. **采样超参未固定导致跨次波动**：跑基线对照时若保持默认高温与随机 `seed=None`，在 `AIME 2024`（仅 30 题）这类小样本集上单次波动就能达到 ±5~10 个百分点。做工程回归（如验证量化或升级）应优先锁定 `temperature=0`（贪婪解码）或固定多组 `seed` 取平均；仅在对齐模型官方论文公开榜单时再恢复模型推荐采样参数（如 `temperature=0.6, top_p=0.95`）。
4. **网络镜像变量混用**：`VLLM_USE_MODELSCOPE=True` 只控制 vLLM 加载模型与分词器，**不会**把 HuggingFace 数据集下载自动转向镜像；通过 `huggingface_hub` / `datasets` 拉取评测集时需设置 `HF_ENDPOINT`，而 `wget` 静态链接则需手动替换源地址。

## 常见误解

- **误解一：“用 `evalscope perf --parallel 16` 测出 P99 TTFT 只有 400 ms，说明线上每秒来 16 个请求也一定稳在 400 ms 内。”**
  错。`--parallel 16` 是固定并发闭环压测（而非 16 req/s 的到达率），客户端会等旧请求返回才发新请求，掩盖了排队放大效应；上线容量评审必须补充固定到达率（open-loop）压测曲线。
- **误解二：“客户端算出的 TTFT 比服务端 `/metrics` 高 30 ms，说明 vLLM 统计漏记了排队时间。”**
  错。服务端 `vllm:time_to_first_token_seconds` 从 API 前端收到请求时间戳计到首输出批统计时间戳，已经覆盖排队、Prefill 与引擎回传前端；多出的 30 ms 通常来自客户端到 API Server 之间的网络 RTT、反向代理与首个 SSE 包回传。
- **误解三：“`evalscope eval --datasets gsm8k --limit 10` 跑出 0.8 就能直接签发量化上线。”**
  `--limit 10` 只是 1~2 分钟的冒烟连通性验证，样本量太小不具备统计意义；正式上线基线应跑全量 `GSM8K` / `C-Eval` / `MMLU` / `MATH-500` 等覆盖对应业务能力的数据集，出现显著掉点后再进入 [msprobe 逐层精度对齐](msprobe-accuracy-debug.md) 定位根因。

## 对照源码

### 怎么开与标准评测命令

```bash
# 1. 启动被测 vLLM Ascend 服务（评测长思维链数据集时 --max-model-len 建议 > 35000）
vllm serve /path/to/Qwen3-8B \
    --served-model-name qwen3-8b \
    --host 0.0.0.0 --port 8000 \
    --max-model-len 40960

# 2. AISBench 全量精度评测（带详细逐题日志落盘，并在配置中启用 extract_non_reasoning_content）
ais_bench --models vllm_api_general_chat \
    --datasets gsm8k_gen_0_shot_cot_chat_prompt.py \
    --mode all --dump-eval-details --merge-ds

# 3. EvalScope 快速精度冒烟与流式并发压测
evalscope eval --model qwen3-8b --api-url http://localhost:8000/v1 --api-key EMPTY --eval-type server --datasets gsm8k --limit 10
evalscope perf --url "http://localhost:8000/v1/chat/completions" --parallel 16 --number 200 --model qwen3-8b --api openai --dataset openqa --stream

# 4. 同步抓取服务端 Prometheus 指标做双端 TTFT / TPOT / ITL 核对
curl -s http://localhost:8000/metrics | grep -E "time_to_first_token|inter_token_latency|time_per_output_token"
```

- **核验 AISBench 与 EvalScope 官方流程**：`using_ais_bench.md` 规定了服务端 `--max-model-len > 35000` 建议、`VLLMCustomAPIChat` 模板（含 `request_rate`、`batch_size`、`max_out_len` 与 `extract_non_reasoning_content` 后处理）以及 7 类标准数据集（C-Eval、MMLU、GPQA、MATH-500、LiveCodeBench、AIME 2024、GSM8K）的执行命令[S1]；`using_evalscope.md` 给出 `evalscope eval --eval-type server` 与 `evalscope perf --parallel --stream` 标准用法[S2]；`performance_benchmark.md` 明确指出 `VLLM_USE_MODELSCOPE=True` 不重定向数据集下载，并展示在线/离线/多模态压测口径[S3]。
- **核验客户端与服务端时延公式**：`vllm/benchmarks/serve.py` 按 `request_rate` 与 `burstiness`（`1.0` 为泊松，`<1` 更突发，`>1` 更均匀）生成开环到达间隔[C4]，在 `calculate_metrics()` 中对 `output_len > 1` 以 `(latency - ttft) / (output_len - 1)` 计算 TPOT，并在缺少 `output_tokens` 时用本地 tokenizer 回算（注释明确提示可能轻微虚增）[C5]；服务端 `stats.py` 将端到端过程拆分为 `queued_time`、`prefill_time` 与 `decode_time`，以 `decode_time / (num_generation_tokens - 1)` 计算 `mean_time_per_output_token`[C6][C7]，由 `loggers.py` 发布为 `vllm:time_to_first_token_seconds`、`vllm:inter_token_latency_seconds` 与 `vllm:request_time_per_output_token_seconds` 直方图[C8][C9]。具体业务在某台昇腾集群上的 QPS 拐点与精度基线分数高度依赖卡型、权重与输入分布，须以目标集群实测为准[I]。

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| AISBench 官方指南 | 已纳入 `docs/source/developer_guide/evaluation/using_ais_bench.md`[S10] | 延续并扩充多数据集与长上下文配置 | 完整覆盖 7 类数据集、`extract_non_reasoning_content` 与 `max-model-len > 35000` 提示[S1] | 延续相同接口规范并同步最新镜像标签[S12] |
| EvalScope 官方指南 | 已纳入 `using_evalscope.md` | 覆盖 `evalscope eval` 与 `evalscope[perf]` 压测[S11] | 延续 OpenAI 兼容服务端 `eval` / `perf --stream` 流程[S2] | 延续相同接口规范 |
| 上游 `/metrics` 与 `vllm bench serve` | 沿用 V1 指标体系 | 统一至 `vllm bench serve` CLI 子命令 | 提供 `time_to_first_token_seconds`、`inter_token_latency_seconds` 与 `request_time_per_output_token_seconds` 三项标准直方图[C8] | 延续标准 Prometheus 直方图与 Goodput 统计 |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–12 项（官方文档项为 `S1`–`S3`、`S10`–`S12`，源码项为 `C4`–`C9`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_ais_bench.md#L1-L245` — AISBench 在线服务配置、数据集列表、`max-model-len > 35000` 提示与推理后处理配置。
- 来源 2（S2）：`vllm-ascend@c09d3e20:docs/source/developer_guide/evaluation/using_evalscope.md#L1-L120` — EvalScope 在线精度评测（`evalscope eval`）与流式并发压测（`evalscope perf`）指南。
- 来源 3（S3）：`vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/performance_benchmark.md#L70-L230` — 数据集清单、`HF_ENDPOINT` 与 `VLLM_USE_MODELSCOPE` 区分，以及 `vllm bench serve/throughput` 示例。
- 来源 4（C4）：`vllm@ced6857a:vllm/benchmarks/serve.py#L403-L466` — `request_rate` 与 `burstiness` 开环到达率发生器实现。
- 来源 5（C5）：`vllm@ced6857a:vllm/benchmarks/serve.py#L568-L640` — 客户端 `calculate_metrics()` 对 TTFT、TPOT、ITL 与 Goodput 的精确统计公式。
- 来源 6（C6）：`vllm@ced6857a:vllm/v1/metrics/stats.py#L438-L475` — 引擎迭代级 `time_to_first_tokens_iter` 记录点。
- 来源 7（C7）：`vllm@ced6857a:vllm/v1/metrics/stats.py#L540-L580` — 完成请求 `queued_time`、`prefill_time`、`decode_time` 与 `mean_time_per_output_token` 拆段计算。
- 来源 8（C8）：`vllm@ced6857a:vllm/v1/metrics/loggers.py#L811-L839` — Prometheus 三个核心时延直方图注册定义。
- 来源 9（C9）：`vllm@ced6857a:vllm/v1/metrics/loggers.py#L1133-L1175` — 迭代与请求结束时向 Prometheus 直方图写入观测值。
- 来源 10–12（S10–S12）：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）与 `main`（`8d6180e2`）下 AISBench / EvalScope 官方评测指南演进对照。
