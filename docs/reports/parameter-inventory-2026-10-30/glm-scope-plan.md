# GLM 双机部署剩余参数补写清单

**最终执行进度（2026-11-01）：G1 9 + G2 3 + G3 9 + G4 9 = 30/30 项补齐，当前必补剩余 0；两个消费待核变量已核清。** 本轮 21 项已完成独立审查、修订与 CLI/UI 检索。详见 [收尾交付](g234-remaining-backfill-validation.md)、[完成覆盖层](g234-remaining-validation.json)。全项目构建被无关 3D 文件的 TS6133 阻塞，单列为验证限制。下面的 G1 进度、30 项筛选与待核描述保留历史时点，不作为当前余量。

**执行进度（2026-11-01）：G1 的 9 项已完成并验收，另 2 个消费待核变量已核清，当前剩 G2 3 + G3 9 + G4 9 = 21 项。** 详见 [交付记录](g1-communication-backfill-validation.md)及[完成覆盖层](g1-communication-validation.json)。以下 30 项、2 项待核及“只写报告”的描述是筛选时的基线，旧台账不回写抹去历史。

按当前知识库固定部署范围，**确认必补 30 个配置项：16 项缺参数说明，14 项已有内容但没讲全。另有 2 项配方变量须先核实消费者。** 必补项分为 4 批，补进现有 8 个页面，不新建重复参数页。

这里的“必补”是文档交付优先级：让读者能复现这份启动配方、正确组织普通 Chat/Completion 输入，并读懂基本运行日志。不是要求把这些参数全部改成非默认值，也不是宣称整个 vLLM 参数百科只剩 30 项。可选扩展不自动进入待办。

本任务只写盘点报告和逐项台账，没有写知识库正文、索引、注册表或图。以前完成的 120 个原台账单元保持完成，不重复计入本次。共享工作区同期变化的保留检查见文末，不能概括为全库哈希未变。

## 使用哪份部署作为筛选依据

沿用 [wiki 写作标准](../../wiki-writing-standard.md) 的固定前提：GLM-5.3-Flash，双机 A2，TP8/DP2/EP16，W8A8；vLLM `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`，vLLM-Ascend `db701c1fd31de40ab028628ee2580ae68c7fd3c0`。[官方教程固定快照](https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md#L215-L312) 是命令依据，不用今天的 main 替代。

主模型录 decode 图，MTP 草稿 eager；node0 起前端、node1 headless。配方没有开启 PD、LoRA、RL、Ray 执行或权重卸载。它设置了 `image=1, video=0`，因此不能把图像入口全部排除。工具调用解析器出现在教程 FAQ，属于另行开启的功能。

这是仓库认可的部署基线，本次没有登录用户两台机器核对镜像 digest、依赖版本或额外环境注入。若现场改过命令，应按差量调整本清单；不需要重启全量参数普查。

## 旧的 1592 项去了哪里

| 处置 | 历史原项数 | 对本次工作的含义 |
| --- | ---: | --- |
| 当前必补 | 24 | 已核当前页面差量，进入下面 G1–G4 |
| 可选候选 | 597 | 功能或调优需求触发后再选；不是 597 个确认漏项 |
| 当前不用补 | 971 | 未选独立分支、其他平台/API/工具、内部字段、已有说明或重复身份 |
| 合计 | 1592 | 每个历史 ID 恰有一个去向 |

此外，从实际启动命令补出旧台账未列入的 **6 个必补通信环境项**，所以必补合计为 **24 + 6 = 30**。另有 `VLLM_RPC_TIMEOUT`、`TP_SOCKET_IFNAME` 2 项待核，不计入确认缺口。外部运行时变量不再被两个 Python 仓库的提取范围漏掉，也不把整个 CANN/HCCL 参数全集加入任务。

597 个可选候选中，102 个来自在线压测工具和数据集选项，45 个保留明确的消费链待核标记，其余 450 个是同部署扩展和调优候选。选择可选包后仍须对照已有正文取差量；**不能把候选数作为“还要补 597 个”的工作量**。

971 个当前不用补中包括已证实的 10 个重复入口，以及 6 个本轮确认可直接复用的入口。重复身份只按证据合并，不把两个同名但不同层级的字段强行合并。旧的 786 条基线外定义记录继续单列，不加入这些数。

逐项去向、原定义、合并目标和理由见 [JSON 台账](glm-scope-ledger.json) / [CSV 台账](glm-scope-ledger.csv)；人工作出的必补差量见 [决策表](glm-scope-decisions.json)。历史原项不是公开参数总数，Scope 分类也不等于对所有可选参数的完整性认证。

## 必补顺序与落页

| 顺序 | 数量 | 参数或环境项 | 补到现有页面 |
| --- | ---: | --- | --- |
| G1 P0 通信与超时 | 9 | HCCL_OP_EXPANSION_MODE；GLOO_SOCKET_IFNAME；HCCL_SOCKET_IFNAME；HCCL_IF_IP；HCCL_CONNECT_TIMEOUT；HCCL_EXEC_TIMEOUT；HCCL_BUFFSIZE；VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS；VLLM_HTTP_TIMEOUT_KEEP_ALIVE | [进程与启动](../../../wiki/concepts/engine-processes.md)、[请求调用链](../../../wiki/concepts/request-call-chain.md)、[HCCL 缓冲](../../../wiki/concepts/gap-a5164fe10fa9184412f8.md)、[API 入口](../../../wiki/concepts/api-server-entry.md) |
| G2 P0 加载与显存 | 3 | PYTORCH_NPU_ALLOC_CONF；safetensors_load_strategy；trust_remote_code | [设备内存](../../../wiki/concepts/device-memory.md)、[Worker 生命周期](../../../wiki/concepts/npu-worker-lifecycle.md) |
| G3 P0 输入边界 | 9 | limit_mm_per_prompt；messages；prompt；add_generation_prompt；add_special_tokens；continue_final_message；chat_template_kwargs；truncate_prompt_tokens；truncation_side | [API 入口](../../../wiki/concepts/api-server-entry.md)、[Token](../../../wiki/concepts/token.md) |
| G4 P1 基础日志 | 9 | VLLM_LOGGING_LEVEL；VLLM_CONFIGURE_LOGGING；VLLM_LOGGING_CONFIG_PATH；disable_log_stats；VLLM_LOG_STATS_INTERVAL；aggregate_engine_logging；enable_log_requests；max_log_len；uvicorn_log_level | [性能分析](../../../wiki/concepts/inference-performance-analysis.md)、[API 入口](../../../wiki/concepts/api-server-entry.md) |

这里按配置身份计数，不按新增段落或页面计数。同一条参考说明可以合讲关联参数，但保留每个参数的默认、入口与边界验收。例如网卡与地址合讲，模板生成与续写合讲，输入截断与保留方向合讲。

### G1 先补实际启动链

W0126、W0253、W0267 加 R001、R003–R007，共 9 项。网络选择的 4 项落在进程页；HCCL 连接/执行等待及 Worker RPC 的 3 项落在调用链；HTTP 保活落在入口页；HCCL_BUFFSIZE 只在现有缓冲页补缺失参考信息。

已有缓冲页讲过单位、MC2 窗口和内存代价，不重写这些机制；部署页已有网卡/IP 一致性提示，补写后从那里引用唯一说明。已有调用链说过上游 RPC 定义默认 300 秒，仍缺 GLM 配方 3000 秒及 Ascend 平台覆盖条件。这项应先修齐参考边界，不能把上游定义默认直接当成 NPU 最终值。

另审 R008 `VLLM_RPC_TIMEOUT`：教程设了 3600000，当前定义台账及本轮查阅的源码没有定位消费者。只证明“配方写了”，不证明生效、无效或单位。先检查匹配镜像/依赖；有消费者才补有效入口，没有则以有证据的兼容/旧变量提示收尾。不把它当作 Worker RPC 超时的已证实别名。

R002 `TP_SOCKET_IFNAME` 也先核：PyTorch 的 [TensorPipe agent 源码线索](https://github.com/pytorch/pytorch/issues/130621) 指向这个名字，但不能证明当前 vLLM mp/Gloo/HCCL 路径启用了 TensorPipe。它从初筛的必补项转入待核，不因为教程有一行 export 就认定该模型路径消费它。

### G2 补加载选择与分配器边界

W0161、W1679、W1702，共 3 项。现有 Worker 页已讲 safetensors 读盘流程与 prefetch 机制，只补加载策略默认、候选值、自动选择条件、主机内存代价和调用示例。与 `load_format` 及 HBM 到 L2 权重预取的区别继续引用已有说明。

分配器说明补当前启动配方及平台注入规则，sleep 冲突引用已有页面。`trust_remote_code` 补模型加载入口和默认；请求模板信任的说明保留在 API 页，不复制成另一份。

### G3 补实际输入契约

W1603、W0493、W0503、W0466、W0467、W0474、W0473、W0546、W0547，共 9 项。复用现有 Chat/Completion 样例，补消息/提示词支持的形状、模板标记及截断边界。图像只补当前单图入口和限制，不扩写音视频、独立视觉编码器或所有处理器选项。

`add_special_tokens` 已有重复标记的解释，补两个接口的默认差异。`chat_template_kwargs` 已有信任守卫，补变量入口及覆盖关系；GLM thinking 的使用约束保留。截断只讲输入裁剪，输出 token 上限仍引用已有长度说明。

### G4 让基础日志能支撑双机排障

W0278、W0202、W0277、W1547、W0283、W1507、W1564、W1444、W1461，共 9 项。先区分 vLLM logger、HTTP 日志、请求内容日志、吞吐统计；补 DP2 分引擎与汇总的读法。

现有 RFork 页的日志级别和请求收尾页的请求日志说明都保留；新说明负责普通 GLM 服务的完整入口和相互作用。Profiler、OTel、NVTX、内部张量转储不混入这批基础日志。

## 可选内容按什么条件再补

下面是优先的可选包，不是已批准的新增工作量。每包选择后先检查目标页，已有内容继续引用；其余 597 个候选的名字与去向在台账中保留。

| 条件与顺序 | 优先检查的入口 | 目标页面与交付边界 |
| --- | --- | --- |
| O1 实际要做 NPU 性能采样 | profiler_config、profiler、torch_profiler_dir、ignore_frontend、delay_iterations、max_iterations、torch_profiler_with_memory、torch_profiler_with_stack | 性能分析页；沿用现有采样机制，核 NPU 包装器实际传参，不照搬 CUDA profiler 表 |
| O2 要接入 Ascend 专用诊断 | ascend_log_path、dump_config、dump_config_path、msmonitor_use_daemon | 性能分析页；前两批旧 O01 的优先级撤回，按工具需求再开 |
| O3 要开放工具调用和思考控制 | enable_auto_tool_choice、tool_call_parser、reasoning_parser、tools、tool_choice、parallel_tool_calls、reasoning_effort | API 入口及结构化输出页；复用教程 FAQ 和当前模型约束，不重复 structured_outputs 已完成的 20 项 |
| O4 要接网关或做在线压测 | api_key、allowed_origins、SSL/代理相关入口；选定 bench serve 的请求率、并发、长度与数据集子集 | API 入口及压测页；先确定实际接入/压测命令，不能按整套 102 个工具选项排期 |
| O5 有明确性能或资源问题 | Ascend 可选融合、细粒度 TP、图编译扩展、缓存/预读细项、多模态处理器 | 回到对应已有机制页；先证实该 GLM 路径确实消费，再补差量 |

45 个保留待核项不藏在“不适用”里，包括共享 PassConfig、部分 cudagraph 字段、Triton 以及 Mamba/KDA 相关字段。尤其不能因为名字带 CUDA 就断定 Ascend 不读，也不能因为 GLM 有线性 attention 就断定上游 Mamba 的每个参数都生效。历史超时变量 W0251/W0252 同样先核当前 V1 消费链，不直接列必补。

## 当前不用补的边界

- PD/连接器、权重卸载、LoRA、RL/休眠及其他 API/离线服务分支：固定配方没有选用；以后切换部署时再恢复对应范围。
- CUDA/ROCm/CPU/XPU 专用设置、其他模型路径、Tensorizer 等其他加载器：当前平台、模型或加载方案不选用；有共享消费可能的条目已转入待核候选。
- 构建/CI/测试工具、其他基准/绘图工具：不属于复现该镜像服务的参数说明。
- 内部配置对象、派生状态和容器字段：不按成员数各写一条用户参数说明，需要时在公开入口解释。
- `spec_method`、`spec_model`、`spec_tokens`、`additional_config`、请求 `chat_template`、请求 `model`：本次所需说明已可在现有页面复用。
- 已证实的 10 对重复：旧的 7 对 offload 入口，以及 DO_NOT_TRACK、TRACEPARENT、TRACESTATE 的 3 对兼容身份；保留映射，不另加补写单元。

“不用补”只对本次固定部署范围成立，不代表功能不存在或整个知识库永远无需解释。

## 验证与后续交付要求

本轮按原 ID 对账 1592 项，检查分类守恒、重复映射、必补身份唯一性、落页存在性、来源定位和页面保留。结果见 [验证记录](glm-scope-validation.json)。没有借此增加已完成数，也没有声称新正文已经独立审查或完成检索验收。

831 个发布文件的前后哈希检查发现 19 个在共享工作区发生变化，因此“全库未变”检查未通过；本任务没有写这些文件或回滚它们。30 项必补涉及的 8 个目标页及复用位置均保持不变。变动页中的相关命中只涉及一般 prompt 用语和另一特性的 HCCL_BUFFSIZE 用例，不构成这 30 项的新完整参考说明。分类与数量检查通过，保留性结果按实际记录，不改写为全项通过。

后续每批仍遵守 [wiki 写作标准](../../wiki-writing-standard.md)：保留已有教学、算例与图，只补差量；默认值分清定义、平台改写、命令显式值和请求覆盖；匹配固定基线，版本差异按标准核对。补完再做独立审查和 CLI/站内检索验证。HCCL/CANN 外部变量须核匹配运行时的文档，不把教程取值写成默认或合法全集。

当前需用户决定的事项：无。开放核验项：R002、R008 的实际消费路径，以及选补前需核的 45 个候选；真实 NPU 行为未实测。
