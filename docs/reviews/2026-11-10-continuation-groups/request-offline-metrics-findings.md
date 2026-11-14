# 离线指标快照：对 metrics 主解释的补充

主位置建议：inference-performance-analysis 已有的 Prometheus/统计小节和源码“怎么开”。本记录不直接改教学页，不在请求链页重建指标定义。

实际使用前提应明确区分：普通在线 CLI 的 disable_log_stats 默认 false，而四个固定版本的 Python LLM 构造器在调用方省略时写入 True。要用普通离线 get_metrics，应在原有 LLM 构造参数中显式传 disable_log_stats=False；调用时不能把开关作为 get_metrics 参数。否则 LLMEngine 抛出 AssertionError("Stat logging disabled")。

返回值是带标签的指标对象列表，直接读取当前 Python 进程的 Prometheus REGISTRY，只选 vllm: 指标。它不是远程抓取 /metrics，不自动等在途请求结束，不清零计数，也不自动计算增量／速率。需要完整一轮结果时，先让这轮生成／等待完成，再取快照；对累计量的差分、窗口和标签含义复用主解释。进程中同名指标的不同标签保留，不是仅针对当前 llm 对象自动筛选的专属视图。

对象分 Counter、Gauge、Histogram，以及按投机接受位置排列的特殊 Vector；不能一律读 value。Histogram 有 sum、count、buckets，桶是累计上界计数，不把所有桶相加当总数；可回到主解释已有直方图演算。public getter 注释写 MetricSnapshot，但实际注解和实现均为 list[Metric]，教学以实际返回为准。

四版 default/getter/reader 完全一致。不同在统计消费者：旧两版仅在本步有请求输出时 record；rc2/main 在有 scheduler_stats、但没有请求输出的步也 record，iteration_stats=None，且这一步不触发周期文字打印。这不把 getter变成事件流，也不保证每次调用间一定有新数据。

`request-offline-metrics-evidence.json` 共 28 个精确候选范围（四版各 7），含全文件／摘录 SHA 与逐项主张。reader.py 基线全文已实际读完，四版源字节相同；同文件可能已在根助手 metrics 账读过，故当前统一保持新全文计数 0，交总账按 SHA 去重。其余是实际选段和完整差异读取，不声称所有 engine/LLM 文件全文。无设备生成或在线采集实测。
