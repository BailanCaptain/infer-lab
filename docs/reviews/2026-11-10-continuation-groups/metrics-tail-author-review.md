# Metrics 技术承接作者交审

本组补齐官方目录第 22 项在本站的教学连接：客户端体验、服务内事件统计、指标发布和请求追踪分别量什么。两页采用单一出处，阶段时间的定义与推导只在 inference-benchmarking，查询与采集入口只在 inference-performance-analysis。作者内容与实际视觉自查、root 独立审查、统一 131 批次工程检查均已通过；接受仅绑定下述 57 新引文及冻结版本。

## 实际修订与数量

| 页面 | 改前引用 | 本次新增 | 改后引用 |
|---|---:|---:|---:|
| inference-benchmarking | 15 | 11 | 26 |
| inference-performance-analysis | 37 | 46 | 83 |
| 合计 | 52 | 57 | 109 |

57 是新增引文出现项，均已写入 frontmatter，不是 57 篇全文。另有 24 个用于四版对应的文件/范围身份，不加入 57；相同字节只做 SHA 对应，不冒充新的全文阅读。

benchmark 新增服务内部计时节和 inference-metrics-events 图：同一请求在 0/20/100/120/180/200 ms 入队、调度、输出、抢占、恢复、末次输出；首次 1 个、最后 3 个 token。演算说明首次排队 20 ms、prefill 80 ms、decode 100 ms、inference 180 ms、事件间隔 100 ms 与请求平均 33.33 ms 不矛盾。保留首次调度、抢占等待归属、墙上/单调时钟、前端解码前统计和客户端收到文字的区别。

analysis 新增服务事件→前端统计→logger→HTTP→抓取的链条，Gauge/Counter/Histogram、标签和窗口、缓存查询单位、采样保留时间、OTLP 基础 span、查询与实际启动入口。Grafana 固定配置的 Queue Time 仅取 sum 增长率，正文说明其单位并给出 sum/count 的平均查询。KV 普通块池的示意为 0 秒分配、2/5 秒 touch、9 秒淘汰，保留/空闲/重用间隔为 9/4/3 秒；明确抽样、最近 4 次访问、未淘汰未观测与 reset 边界。

两页首图前补采集成本。四版默认和消费者分开核对；旧客户端计时、A/B、goodput、失败、DeepInfer、Roofline、关键路径、六项日志与 profiler 说明全部保留。

## 证据与保留

- `metrics-tail-evidence-candidates.json` 与 `metrics-tail-additions.json`：57 项 source index、固定引用、主张、摘录与 SHA。`metrics-tail-author-judgments.json` 是作者逐项判断，独审字段仍 pending root。
- `metrics-tail-preservation.json`：改前两页的全部正文行按原顺序保留，旧 52 sources 顺序不变，旧 calc 原文保留；旧 4 张图的 8 个 YAML/SVG 字节不变。语义保留清单单独列明。
- `.tmp/continuation-groups-2026-11-10/metrics-tail/before.zip` 与 `author-final.zip`：分别 10/12 个文件，配套 manifest 与作者 diff。
- `metrics-tail-reading.json`：母文 702 行和 3 张图重读；usage 的 4 份生成表按固定 hook 展开读取。生成表不等于源文件全文。两套示例 README、compose/prometheus 配置、dummy client 和 Grafana 完整 JSON 已读。
- Prometheus 固定原始资料：histograms 543 行全文、client_python multiprocess 154 行全文；functions 只读 histogram_quantile 323–458 和 rate 818–847。其余函数和递归背景链接未计全文。误由文件名后缀额外下载的 native_histograms 规格 2642 行明确未读、不计。

root 已核原文并登记的窄白名单仅三个固定路径，详见 analysis sources 81–83：prometheus/prometheus 的 docs/querying/functions.md、prometheus/client_python 的 docs/content/multiprocess/_index.md、prometheus/docs 的 docs/practices/histograms.md。作者未改审计规则。

## 实际浏览器自查

5201 的最终报告位于 `.tmp/continuation-groups-2026-11-10/metrics-tail/author-browser/report.json`。稳定哈希、无 pageerror、两页无整页横向溢出。作者实际查看两页前两屏、11 个图/算式、12 张表、监控新节、PromQL；新图首版箭头碰标题，已改路由和短标题后再实际查看。三处新回链实际点击后目标标题约在 y=108：benchmark→监控节、analysis→内部计时、benchmark→合并输出。首次脚本选中了同名旧整页链接，该次不作为锚点验收，已按实际 href 重跑成功。

首两屏复述：测量是先固定起止与样本，吞吐增加会让每条请求等待更长；记录越细也增加采集成本。分析是沿依赖找决定下一步的最后一条准备路径，减少不在关键路径上的计算未必缩短回答；先汇总缩小范围再付出详细采集开销。新增两节也能沿同一请求复述，未把指标名当定义。

## 保留的实际边界

Grafana/Jaeger 示例的 4 个 imgur 图请求返回 HTTP 429，尚未看图；不因 README、JSON 与消费者已读就把这些图记为验收。指标源静态核对不等于已运行 Prometheus/OTLP，更不是 NPU 性能实测。

基础 OTLP span 依赖请求与批次统计。普通无插件路径同时关闭 stats 而设置 endpoint，会在完成输出 tracing 访问缺失状态，固定消费者有断言；正文要求保留 stats。该结论是静态路径证据，不伪称已启动 NPU 复现。详细 trace 的 NPU 逐算子支持尚未由本组证明，继续使用已有 Ascend profiler 教学入口。

无须用户决定的问题。独审见 `metrics-tail-independent-review.md`；统一工程证据见 `io-metrics-prompt131-verification.json`，content/lint/audit/diagrams/build 均退出 0。两页与新图 4 个冻结 SHA 已再次对当前文件核对一致；不覆盖后续离线指标入口及 4 张未取得的图，本组不代表全站完工。

独审 P2 已修：OTLP 基础依赖先确认是否随镜像具备，仅缺失时按配套版本补齐，固定 source 80 不变。最终浏览器重跑稳定、错误与整页溢出均为 0，已实看 otel-prerequisite-fixed.png；root 最终五项工程均通过。
