# C 批诊断与观测：分批计划与整体余量

日期：2026-11-01。**本轮只更新计划、逐项去向与统计，没有补写或修改 wiki 正文、图、别名、目录、检索索引或产品代码。** 本次规划不增加完成数。

结论：S03 的 **83 个原项拆为 15 个交付包**，其中 14 个按诊断场景排期，1 个是两项误归组的归位包。核实 3 对同一消费值的兼容入口后，为 **80 个规范配置身份**，仍保留全部 83 个 W 编号和验收义务。先补 O01 的 4 个 Ascend 入口，合写为 3 条参考说明，再补 O02 的 8 个基础日志项。这里的合写条数与配置身份数不是同一个统计口径。

逐项机器台账见 [JSON](diagnostics-ledger.json) / [CSV](diagnostics-ledger.csv)，分批定义见 [diagnostics-batches.json](diagnostics-batches.json)，验证见 [diagnostics-plan-validation.json](diagnostics-plan-validation.json)。原 c-scenario-ledger 和 deployment-backlog 不回写，保持历史状态。

## 整体还剩多少

| 历史补写范围 | 原项总数 | 已交付 | 尚未交付 |
|---|---:|---:|---:|
| A：用户优先问题 | 11 | 11 | 0 |
| B：常用部署与推理入口 | 89 | 89 | 0 |
| C：按场景展开 | 989 | 20 | 969 |
| D：其他路径、接口、工具与升级 | 623 | 0 | 623 |
| 合计 | **1,712** | **120** | **1,592** |

C 已完成的 20 项是结构化输出首批，见[交付验证](structured-output-backfill-validation.md)。诊断与观测的 83 项已包含在 C 的 969 中，不能另加；本轮排计划也不能从余量里扣掉。若以后本场景全部交付，历史口径才会变为累计 203、C 余 886、C+D 余 1,509，本轮尚未达到这个状态。

**1,592 是未交付的历史工作身份，不是 1,592 个确认漏收的公开参数。** C 已核实的 7 对卸载入口身份合并，加本轮 3 对，合计减少 10 个重复身份。仅扣这些有证据的合并，C 还剩 959 个规范规划身份；加尚未进一步去重的 D 623，为 1,582。为便于追踪，主进度仍采用 1,592 的历史 W 编号口径，不把合并入口计作“已经补完”。

D 的 623 项分别是其他硬件/模型 181、其他接口/扩展 226、基准/辅助工具 214、仅升级差异 2；需要按使用路径继续筛选。另有 **786 条基线外定义记录**在 outOfBaseline 中单列，单位是定义记录，既不是 786 个待写页面，也不能直接加到 1,592；其中是否是新参数、旧入口的另一种定义、或已覆盖别名，仍需升级场景审核。本报告不是全世界 vLLM 参数总数的闭合统计。

## 固定版本与这轮核对深度

沿用项目知识库部署基线 vLLM `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665` / Ascend `db701c1fd31de40ab028628ee2580ae68c7fd3c0`，GLM-5.3-Flash、2×A2×8、TP8/DP2/EP16、W8A8、MTP 3。部署前提只引用 [GLM 双机页](../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提)，未读取运行中机器的安装包或镜像摘要。

后续逐项写作要对照 v0.23 的 `0fc695fc` / `2c59ff10`，v0.26 的 `568afb3a` / `2ed6cbba`，固定 main 的 `84030bbe` / `baa023ad`。本轮读了全部 83 项的基线定义记录，下载其涉及的固定文件，并对日志、首批 Ascend 配置、NPU profiler、合并入口与错分项作定向核读；对照版本重点复核首批四项及合并规则。不宣称 83 项的三版全部消费链已经审完。

历史 S03 状态是 75 项“未收录参数说明”、8 项“没讲全”。当前发布正文精确名称检出 9 项线索，其中包含 RFork 排错页里的日志级别用法；机制说明和滚动文档指引不能直接算固定基线参数参考已完成。逐项台账保留旧状态和本轮命中页，明确标为尚待补写验收。

## 去重与归属纠正

只合并已证实流向同一消费值的入口；不同默认、不同配置层、不同后端仍分开。

| 原项 | 归并到 | 证据与保留的差异 |
|---|---|---|
| W0107 DO_NOT_TRACK | W0234 VLLM_DO_NOT_TRACK | 三版 envs 的同一读取表达式；先取非空 VLLM_DO_NOT_TRACK，再取 DO_NOT_TRACK，最后与字符串 1 比较。保留同时设置、空串与字符串 0 的优先关系，不写成两个值做布尔 OR |
| W0177 TRACEPARENT | W0448 traceparent | 三版 _get_smart_context 的同一 carrier 字段；小写环境键优先，大写作不存在时的默认。活动 span 已有效时不再从环境提取 |
| W0178 TRACESTATE | W0449 tracestate | 同一传播上下文，保留大小写回退和空值边界 |

固定证据：[环境兼容入口](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/envs.py#L774-L786)、[OTel 环境提取](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/tracing/otel.py#L216-L237)。补写是分别说明可用入口后合讲消费值，不删除搜索名。

以下不做身份合并：

- dump_config 与 dump_config_path 是内联字典和文件路径，互斥并有不同类型校验；可合写一条参考，但保留两个原项。
- VLLM_LOGGING_CONFIG_PATH 与 log_config_file：后者的定义默认引用前者，不证明后续 logger/uvicorn 消费完全相同；按两层入口分别验收。同样，NO_COLOR 与 VLLM_LOGGING_COLOR 是两个控制项，不能因为共同影响颜色就删除一项。
- profiler_config 与 ProfilerConfig 子字段：父容器的入口/构造和子字段的消费都必须说明；本台账已经合并了同一启动字段的 CLI/EngineArgs/Config 入口，不重复计一次。
- msmonitor_use_daemon 与 MSMONITOR_USE_DAEMON 已在原 W0067 内合并；本轮不再重复扣数。只有通用配置优先级教学，仍需补具体开关与 profiler 互斥。

归属纠正但不注销原项：W0161 PYTORCH_NPU_ALLOC_CONF 回到 device-memory，与 sleep-mode 既有解释互链；W0375 VLLM_SPARSE_INDEXER_MAX_LOGITS_MB 回到 sparse-attention，其固定消费点是在 profiling run 中模拟稀疏 indexer logits 峰值分配，并不是日志体积上限。相关 [消费点](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/model_executor/layers/sparse_attn_indexer.py#L105-L126)不等于已经证明 Ascend GLM 会走这一路。两项继续保留 S03 来源身份，避免挪页后被重复统计。

## 可交付小批与顺序

P0 紧接着补，P1 随后，P2 按具体排障需求，P3 在选择对应工具/执行路径后补；这里的优先级不是建议开启开关。每批最多 11 个原项，逐批完成参考、版本核对、独立审查和检索验证。O15 是归位包，随对应内存/稀疏专题推进，不因为编号靠后就误当成最后才有价值。

| 顺序 | 原项数 / 身份数 | 参数范围 | 唯一主说明页面与边界 |
|---|---:|---|---|
| P0 O01 Ascend 本地诊断 | 4 / 4 | ascend_log_path、dump_config、dump_config_path、msmonitor_use_daemon（含兼容环境入口） | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；4 项合写 3 条，细表见下节 |
| P0 O02 基础日志 | 8 / 8 | VLLM_CONFIGURE_LOGGING、VLLM_LOGGING_CONFIG_PATH、VLLM_LOGGING_LEVEL、VLLM_LOGGING_STREAM、VLLM_LOGGING_PREFIX、VLLM_LOGGING_COLOR、NO_COLOR、VLLM_DISABLE_LOG_LOGO | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；配置文件、默认流/级别、颜色覆盖及初始化时机；复用 RFork 的现象说明，不复制 RFork 专用 rank 规则 |
| P1 O03 HTTP/请求日志 | 9 / 9 | enable_log_requests、max_log_len、enable_log_outputs、enable_log_deltas、log_error_stack、VLLM_DEBUG_LOG_API_SERVER_RESPONSE、log_config_file、uvicorn_log_level、disable_access_log_for_endpoints | [API 入口](../../../wiki/concepts/api-server-entry.md#对照源码)；分请求内容、响应调试、访问日志和错误栈，核输出日志对请求日志的依赖；性能页只回链 |
| P1 O04 运行统计与指标 | 11 / 11 | disable_log_stats、aggregate_engine_logging、VLLM_LOG_STATS_INTERVAL、VLLM_LOG_BATCHSIZE_INTERVAL、enable_logging_iteration_details、enable_mfu_metrics、VLLM_DEBUG_MFU_METRICS、kv_cache_metrics、kv_cache_metrics_sample、show_hidden_metrics_for_version、PROMETHEUS_MULTIPROC_DIR | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；区分日志周期、指标聚合、样本率、隐藏指标版本和多进程目录；测量指标定义复用 benchmarking |
| P1 O05 NPU profiler 入口/内容 | 9 / 9 | profiler_config；ProfilerConfig.profiler、torch_profiler_dir、ignore_frontend、torch_profiler_record_shapes、torch_profiler_use_gzip、torch_profiler_with_flops、torch_profiler_with_memory、torch_profiler_with_stack | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；补固定基线 NPU 真正消费字段，walkthrough 只保留已有最小取证流程并回链 |
| P1 O06 profiler 窗口 | 5 / 5 | ProfilerConfig.delay_iterations、max_iterations、wait_iterations、warmup_iterations、active_iterations | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；先讲继承 WorkerProfiler 的延迟/上限，再区别 NPU 与上游 Torch 的 schedule 消费，不重复 O05 的完整启动例 |
| P1 O07 超时与卡住 | 5 / 5 | VLLM_ENGINE_ITERATION_TIMEOUT_S、VLLM_ENGINE_READY_TIMEOUT_S、VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS、VLLM_RINGBUFFER_WARNING_INTERVAL、VLLM_HTTP_TIMEOUT_KEEP_ALIVE | 前四项 [请求调用链](../../../wiki/concepts/request-call-chain.md#对照源码)，keep-alive 落 [API 入口](../../../wiki/concepts/api-server-entry.md#对照源码)；先判 V1 是否消费，启动等待/执行超时/告警周期/连接空闲分开 |
| P2 O08 OTel 追踪 | 7 / 5 | otlp_traces_endpoint、collect_detailed_traces、OTEL_EXPORTER_OTLP_TRACES_ENDPOINT、TRACEPARENT/traceparent、TRACESTATE/tracestate | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；兼容键合写，端点覆盖、活动 span、进程传播、依赖和开销分别验收 |
| P2 O09 同步与内部诊断 | 8 / 8 | ASCEND_LAUNCH_BLOCKING、VLLM_COMPUTE_NANS_IN_LOGITS、VLLM_DEBUG_DUMP_PATH、VLLM_PATTERN_MATCH_DEBUG、VLLM_DEBUG_WORKSPACE、VLLM_GC_DEBUG、VLLM_TRACE_FUNCTION、VLLM_LOG_MODEL_INSPECTION | 同步项落 [ACL graph](../../../wiki/concepts/acl-graph.md#对照源码)，NaN 落 [采样](../../../wiki/concepts/sampling.md#对照源码)，编译 dump/pattern 落 [图模式](../../../wiki/concepts/graph-mode-layer.md#对照源码)，模型检查落 [Worker 启动](../../../wiki/concepts/npu-worker-lifecycle.md#对照源码)，其余落性能分析；每项先核实际消费者，不按 DEBUG 字面推广 |
| P2 O10 使用统计/遥测 | 5 / 4 | DO_NOT_TRACK/VLLM_DO_NOT_TRACK、VLLM_NO_USAGE_STATS、VLLM_USAGE_SOURCE、VLLM_USAGE_STATS_SERVER | [API 入口](../../../wiki/concepts/api-server-entry.md#对照源码)；与服务 /metrics 和响应 token usage 区别；别名优先与禁用条件只定义一份 |
| P2 O11 EPLB 观测 | 2 / 2 | EPLBConfig.log_balancedness、log_balancedness_interval | [EPLB](../../../wiki/concepts/eplb.md#对照源码)；先核上游统计与 Ascend 自有 eplb_config 的路径，复用现有峰均比/负载演算，不据同名功能宣称通用 |
| P3 O12 自定义标记/NVTX | 4 / 4 | VLLM_CUSTOM_SCOPES_FOR_PROFILING、VLLM_NVTX_SCOPES_FOR_PROFILING、VLLM_USE_LAYERNAME、enable_layerwise_nvtx_tracing | [性能分析](../../../wiki/concepts/inference-performance-analysis.md#对照源码)；核 CPU/NPU/CUDA 各标记路径，不能因为有 NVTX 定义就推荐当前 NPU 开启 |
| P3 O13 Ray 专用观测 | 3 / 3 | RAY_CGRAPH_get_timeout、RAY_USAGE_STATS_ENABLED、ray_workers_use_nsight | [引擎进程](../../../wiki/concepts/engine-processes.md#对照源码)；当前配方不是 Ray 执行器，作为可选路径参考；Nsight 与 NPU profiler 不混用 |
| P3 O14 基准导出 | 1 / 1 | SAVE_TO_PYTORCH_BENCHMARK_FORMAT | [基准测量](../../../wiki/concepts/inference-benchmarking.md#对照源码)；只补导出入口/格式/调用工具，复用现有性能口径 |
| P2 O15 两项归位 | 2 / 2 | PYTORCH_NPU_ALLOC_CONF、VLLM_SPARSE_INDEXER_MAX_LOGITS_MB | 分别 [设备内存](../../../wiki/concepts/device-memory.md#对照源码)、[稀疏 attention](../../../wiki/concepts/sparse-attention.md#对照源码)；保留休眠冲突已有结论，补平台改写/消费路径，不写成日志开关 |

## 下一批先交付什么

**O01：4 个原项，3 条参考说明，全部补到性能分析页的「对照源码」。** 不新增一参数一页，也不重写 Roofline、关键路径和取证教学。

| 参考说明 | 原项 | 已有内容复用 | 必须补齐与验收 |
|---|---|---|---|
| ascend_log_path | W0033 | 性能页的日志/trace 用途与请求关联；通用配置入口回链 ascend-config-system | additional_config 路径；默认用户目录推导；实际文件 handler 消费、输出文件/进程/rank、初始化时机、路径和写入失败行为；不能混成 plog 目录 |
| dump_config / dump_config_path | W0036、W0037 | 数值转储与时间 profiler 的区别已在性能页讲过 | 内联字典与文件路径二选一、None、类型校验、内联落盘路径、msprobe/PrecisionDebugger 消费与依赖、完整互斥/可用示例；不是把引擎配置导出到文件。字典的任意 msprobe 子键不冒充本仓库参数全集 |
| msmonitor_use_daemon / MSMONITOR_USE_DAEMON | W0067 | ascend-config-system 已有环境兼容映射和优先级；调用链已写 worker 计步 | bool/环境值解析、配置优先、开启后的实际初始化和计步位置、缺依赖行为、与 torch NPU profiler 的互斥、三版兼容入口变化 |

固定依据：[首批配置读取](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/vllm_ascend/ascend_config.py#L96-L103)、[dump 双入口校验](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/vllm_ascend/ascend_config.py#L384-L410)、[日志目录消费](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/vllm_ascend/logger.py#L156-L177)、[NPU profiler 互斥与字段消费](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/vllm_ascend/profiler/torch_npu_profiler.py#L38-L75)。v0.23/v0.26 是旧读取形态，固定 main 将配置改为类型字段/工厂前处理；不能因为没有 dump_config 类型字段就推断它消失。

O05/O06 的重点风险已确认：GLM NPU 包装器直接传 memory，将上游 with_stack 接到 NPU with_modules，NPU with_stack 固定 False；这里没有照搬上游 Torch 包装器的 record_shapes/use_gzip/with_flops 与 wait/warmup/active schedule。延迟与上限由继承的 WorkerProfiler 管理。正式补写须分清 worker 与前端、类型校验与消费，不能把声明存在直接写成 NPU 已生效。这轮只据此拆包，不提前发布完整支持矩阵。

## 已有内容如何避免重复

- inference-performance-analysis 的关键路径、算术强度、GLM 负载与 profiler 开销原样复用；所有新参数集中其参考区，不在开篇堆参数。
- inference-performance-walkthrough 已有 request/step/rank 关联、start_profile/stop_profile 取证顺序和滚动指南边界。O05 把固定版参数参考放到性能分析页后，走读页只需必要回链/版本指引，不复制全套配置表。
- 请求调用链的 execute timeout、ACL graph 的同步调试互斥、休眠的分配器冲突、Ascend 配置兼容映射，以及 EPLB 的负载演算均有现成出处；新批只补缺少的入口/默认/范围/版本消费，未核处不能借复用宣称完成。
- RFork 页的 DEBUG 日志示例可作为已有用法线索，但其 rank 日志策略属于 RFork，不复制成社区 vLLM 默认行为。
- 测量页保留指标定义与同负载比较；O04 的监控开关与 O14 导出格式不另算同一套吞吐或延迟公式。

## 验收与本轮证据边界

后续每批按 wiki-writing-standard：原字段逐项检查、固定三版差异、完整有效用例、错误/相互作用、开销、精确别名与唯一主页面；写完独立审查，修复问题，再做 CLI/UI 检索及真实页面阅读。分组/合写不减少原项验收义务；真实设备与库集成待核不得靠静态检查关闭。

本轮只验证规划：12 项检查全部通过，83 项恰好分配一次、3 对合并同批同页、定义/记录完整保留、所有目标页存在、总量守恒、112 处报告本地文件链接存在。45 份固定源码下载的哈希与原项定义行范围通过检查；三份上游的兼容读取表达式均已复核。831 个发布页/图/目录/索引文件前后哈希一致。证据在 `tools/wiki-runtime/diagnostics-plan-20261101/`，摘要见 diagnostics-plan-validation.json。首次 ID 守恒检查误将字典而非键列表传给 Counter，原观察已保留，修正校验表达式后核对实际 ID 多重集合通过；没有为通过而删原项。未运行前端构建、UI 操作或 NPU 测试；没有页面/代码改动，不把历史测试结果当成本轮执行。

需用户决定的问题：无。下一次补写从 O01 开始；整体未交付仍按 1,592 个历史原项报告。
