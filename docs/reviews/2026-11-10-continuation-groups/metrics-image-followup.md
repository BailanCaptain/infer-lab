# 监控示例四张原图补核

root 在本轮通过公开 Imgur 页面点击图片放大，取得官方示例链接的原始 PNG 响应；此前 HTTP 429 与网页壳的失败记录保留为历史。本轮不是把缩略图或相邻资料视为原图。

四张原图均实际显示阅读，下载身份、尺寸与 SHA 见 `metrics-image-followup.json`，对应 `.tmp/continuation-groups-2026-11-10/metrics-original-images/`。响应字节保留原样；临时文件后缀为 webp，但原始 PNG 的签名、URL 与 SHA 均已记录。

- R2vH9VW：Grafana 六个面板分别展示端到端延迟、token 吞吐、每输出 token 延迟、调度状态、首 token 延迟与缓存占用。图例含分位数/平均值、prompt/generation、running/swapped/waiting、GPU/CPU。它是旧示例截图，不能当作当前版本所有指标名称与消费者的定义，更不能代替本站实测。
- GYHhFjo：Jaeger 搜索结果显示三个 trace，每条含 client-service 与 vllm-server 两个 span；可以按服务及时间筛选，再打开一条请求。
- OPf6CBL：打开的 client span 包住 llm_request；362.1 ms 与 358.31 ms 的边界不同，服务 span 另列 E2E、排队、首 token、输入参数和用量。截图中的旧 best_of/num_sequences 等属性不外推为新版必有字段。
- hywvoOJ：自动插桩另显示 HTTP receive/send 等较短 span，完整 trace 有 16 个 span；该层与 llm_request 不是相同观测边界，HTTP 子 span 也不等同为模型每一步执行。

现行性能页已把聚合指标、单请求追踪、HTTP 自动插桩及设备 profiling 区分，固定实现与版本差异由此前 metrics57 引文支持。本轮补图未发现需要改正文的新问题，没有运行 Grafana、Jaeger、OTLP 或 NPU。

本次关闭的是四张监控原图的阅读缺口；DeepSeek 生产文章的三处缺图继续单列，不能因此宣布全部外部图表已取得。全文阅读全局计数增量为 0。
