# 离线缓存重置：主解释连接与条件

当前 request-teardown 已完整说明“还块不等于清前缀缓存”、占用块阻止清除，以及 HTTP 开发路由入口；UCM 已说明 prefix/mm/encoder 三种重置分别针对哪些缓存。缺口主要是把官方离线母页的 Python 方法接到这些现有主解释，而非另造一个缓存教程。

建议在 request-teardown 的源码“怎么开”补短段：已有 llm 可调用 reset_prefix_cache，默认两个参数 reset_running_requests=False、reset_connector=False，返回 bool，调用方须检查。它是 Python 入口，不要求为此打开 VLLM_SERVER_DEV_MODE；这个开关只控制 HTTP 开发路由。

默认重置时仍有块引用，会返回 False；除了永远占用的 null 块，所有块都空闲才可清前缀索引。可选 reset_running_requests=True 将运行请求抢占回等待并在恢复后重算，**不等同于取消请求**；若还有远端 KV 等特殊持块原因，强制抢占后仍无法清除会抛 RuntimeError。reset_connector=True 才另外调用 connector.reset_cache，没有 connector 时视为成功空操作；具体外部后端实现是否真正清掉所有层须按它自己的契约，不能写“一次就清空所有介质”。前缀 reset 清的是 hash 索引，不把已分配显存逐字节抹零或退还整个 KV allocation。

已有 llm 的 reset_mm_cache 清 renderer 预处理缓存及引擎／Worker 接收缓存与相应处理状态，不等于清 KV prefix 或 encoder 输出。在途请求期间该路径只告警 sender/receiver 可能不同步，不替调用方提供“先等所有请求完成”的屏障；应先完成当前工作再做验证性重置。rc2/main 加入等待后台 MM warmup，并不等于任意并发请求都被隔离。三种缓存用途回链 API 多模态主解释和 UCM 测试流程，避免复制推导。

四版公开签名、默认和上述基本契约一致，内部差异必须保留：v0.26 起 block pool 另清反向 hash 索引；rc2 KVCacheManager 经 coordinator 重置各类型 manager 的独立池，主 main 又返回直接 reset block_pool；rc2 还通知 reuse watchers，main 没有这一分支。rc2 抢占时的 stale-output 记账改由 _preempt_request 参数完成。这里不能说 rc2 与 main 重置的全部内部作用范围相同。所有已核 MRV1/MRV2 encoder reset 与 MM reset 仍是不同函数。

`request-offline-cache-evidence.json` 包含 74 个精确候选范围（四版 72 个选定方法，加 rc2 coordinator/preempt 两个必要实际消费者）。baseline 所列方法逐行实际阅读，8 份非空选段差异完整读，其他相同函数按摘录 SHA 复用。未声称 44 个下载文件全文已读，不新增全文计数；没有调用实际 NPU、GPU、外部缓存后端，也未修改教学页。
