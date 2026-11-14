# C 批场景去重与下一批补写计划

**诊断场景细分（2026-11-01）：S03 的 83 项已拆成 15 个交付包，见[诊断与观测计划](diagnostics-observability-plan.md)。新核实 3 对兼容入口，保留 83 个原项、按 80 个配置身份安排；以下 989/982 及原 CSV/JSON 仍是上轮规划快照，不回写。此更新不代表诊断正文已补写。**

**执行更新（2026-11-01）：本计划中的结构化输出首批 20 个原项已按 17 条参考说明交付，见[补写验证](structured-output-backfill-validation.md)与[独立审查](structured-output-independent-review.md)。以下保留规划时的数量、缺口状态与下一批措辞，CSV/JSON 仍为历史规划快照。当前下一场景按表序为诊断与观测。**

日期：2026-11-01。**本轮只整理计划，没有修改 wiki 正文、别名、目录、图或检索索引。** A 批 11 项、B 批 89 项的已交付记录保留；本轮不把规划计入补写完成数。

下一批先补**结构化输出的请求与服务配置**：覆盖 20 个原台账项，组织成 17 条参考说明，全部落到 [structured-output](../../../wiki/concepts/structured-output.md)。3 个旧 structural tag 子字段随父结构合写，不另起 3 套机制教学。该范围中，6 项缺参数说明、14 项已有内容但参考信息不全。

## 版本与范围

沿用项目实际采用的知识库基线，而不是按最新 main 编写：vLLM `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`，vLLM-Ascend `db701c1fd31de40ab028628ee2580ae68c7fd3c0`；GLM-5.3-Flash、双机 2×A2×8、TP8/DP2/EP16、W8A8、MTP 3，部署前提的唯一出处为 [GLM 双机页](../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提)。本轮没有读取运行中机器的镜像摘要或安装包，因此不声称核实了现场部署与这些提交完全相同。

后续写作的版本对照仍是社区 Ascend `2c59ff10` / vLLM `0fc695fc`、Ascend `2ed6cbba` / vLLM `568afb3a`、固定 main `baa023ad` / `84030bbe`。这轮优先级和下一批范围按基线定，不把对照版本新增字段混进当前请求示例。逐字段三版行为比较属于补写验收，不因计划列出三个版本就视作完成。

原 C 批 **989 个历史写作单元**全部保留去向，分为 22 个场景。核实并合并 7 组同一配置的不同入口后为 **982 个规范化规划单元**；这些仍不是 982 个公开参数，更不是 982 个确认漏项。台账保留原 W 编号、原状态、定义、提交和记录 ID。D 批 623 项及基线外定义本轮未重排，也未静默移入 C。

完整逐项文件：[可筛选 CSV](c-scenario-ledger.csv)、[含原始定义和合并关系的 JSON](c-scenario-ledger.json)。旧 [deployment-backlog.json](deployment-backlog.json) 不回写，避免破坏历史统计。

## 去重规则与已经处理的重复

只有确认同一个消费字段的入口才合并身份；同名但属于不同请求、后端或配置层的字段不能合并。父容器、子字段、兼容协议变体可以合成一个写作小节，但仍保留各自验收义务。

本轮核对基线 [EngineArgs 构造 OffloadConfig](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/engine/arg_utils.py#L2212-L2224) 的直接赋值后，确认以下 7 对只写一份主解释，分别列 CLI/Python/嵌套配置入口：

| 合并到的规范项 | 原配置字段项 | 字段 |
|---|---|---|
| W1654 | W1082 | offload_backend |
| W1524 | W1286 | cpu_offload_gb |
| W1525 | W1287 | cpu_offload_params |
| W1655 | W1106 | offload_group_size |
| W1656 | W1107 | offload_num_in_group |
| W1657 | W1108 | offload_params |
| W1658 | W1109 | offload_prefetch_step |

这只证明配置身份相同，不证明 Ascend/GLM 执行这些卸载路径，也不把权重卸载混成 KV 卸载。消费端适用性仍在 S15 的补写门槛内。

另有 17 项被标为**已有内容复用线索**，不是 17 项自动完成：

- W1691–W1693 的 `spec_method/spec_model/spec_tokens` 已在 [投机解码页「怎么开」](../../../wiki/concepts/speculative-decoding.md#怎么开) 讲快捷入口、缺省、合并、互斥和 GLM 示例；本轮读表确认，后续引用 B5，不再另写快捷入口小节。
- W0472 请求 chat_template、W0497 请求 model，复用 B10 的模板信任和对外名称解释；仍逐一核请求默认、接口差异，不能把启动字段当作请求字段已经验收。
- W0187 长度放宽、W0229 请求 ID、W0273 引擎死亡行为、W0372 模型名校验已有 API 页说明；新增内容只能补尚缺的范围、覆盖或版本信息。
- W0235–W0239 的 DP 环境入口复用 B6 进程/并行机制。名称在指定主页面未直接命中，环境读取与 CLI 覆盖关系仍待补，不能据机制相同注销任务。
- W0515 return_token_ids 的返回结构仍待补；W0516 return_tokens_as_token_ids 复用 [采样页概率记录](../../../wiki/concepts/sampling.md#怎么开) 的编号展示说明，再补请求/服务入口差异。W0426 V2 runner 复用结构化输出页的设备路径与兼容性边界，不重新展开机制。

其余请求层与服务层的 disable_any_whitespace、disable_additional_properties 保持分项；各连接器的 backend、port、timeout、extra_config 按连接器身份保留。内部 ReasoningConfig、StructuredOutputsConfig 和启动 reasoning_parser 暂只合写场景，不在未核构造和覆盖关系前强行折叠身份。

## 场景顺序、参数范围和页面归属

P0 是紧接着实施的范围；P1 随后按表序推进；P2 是主线可选扩展；P3 需先确定功能分支；P4 是其他接口/硬件/构建或入口筛选。**优先级表示补文档顺序，不是推荐开启，也不是问题严重级别。** 数量按原 W 项计，便于与 989 守恒；S15 的 18 项在身份合并后是 11 项。场景不是一次必须全部交付的大批次，尤其日志 83 项、连接器 219 项应继续按子场景拆写。

| 顺序 / 场景 | 原项数 | 先补哪些参数或入口 | 唯一主说明与补写边界 |
|---|---:|---|---|
| P0 S01 结构化输出首批 | 20 | response_format、structured_outputs 及子字段、structured_outputs_config、backend、空白/附加属性、enable_in_reasoning、XGrammar 缓存 | [structured-output](../../../wiki/concepts/structured-output.md)；精确范围见下一节 |
| P1 S03 诊断与观测 | 83 | 先补 ascend_log_path、dump_config、dump_config_path、msmonitor_use_daemon；再补 VLLM_LOGGING_LEVEL、log_config_file、enable_log_requests、max_log_len、profiler_config 与 ProfilerConfig 子项、超时/统计环境入口 | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md)；API 页只回链请求日志。dump_config_path 按 msprobe 配置理解，不能写成导出引擎配置 |
| P1 S02 工具与思考解析 | 30 | tools、tool_choice、parallel_tool_calls、函数 name/parameters、enable_auto_tool_choice、tool_call_parser、tool_parser_plugin、reasoning_parser、reasoning_config、include_reasoning、reasoning_effort | [structured-output](../../../wiki/concepts/structured-output.md)；工具 schema/解析主说明在此，模板生成细节回链 token。先补常用请求链，再处理插件、tool_server 和实验 parser |
| P1 S04 文本输入 | 34 | messages、prompt、chat_template_kwargs、default_chat_template_kwargs、add_generation_prompt、continue_final_message、add_special_tokens、truncate_prompt_tokens、truncation_side、tokenizer_revision | [token](../../../wiki/concepts/token.md)；复用 B10 模板来源，补请求组合、截断和 tokenize/detokenize 端点差异 |
| P1 S05 HTTP 服务 | 35 | api_key / VLLM_API_KEY、CORS 四项、root_path、uds、TLS 配置、request_id、enable_request_id_headers、h11 限制、shutdown_timeout | [api-server-entry](../../../wiki/concepts/api-server-entry.md)；不把客户端 OPENAI_API_KEY 当服务鉴权开关；已有 host/port/config 不重写 |
| P1 S06 模型来源与加载 | 25 | revision、code_revision、trust_remote_code、hf_config_path、hf_overrides、hf_token、download_dir、ignore_patterns、model_loader_extra_config、safetensors_load_strategy / prefetch 两项 | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md)；沿 B10 load_format 补来源固定、加载器特定参数和覆盖，不重讲权重分片 |
| P2 S07 并行与通信扩展 | 70 | DP 环境入口、data_parallel_backend / external_lb / hybrid_lb、master_addr/port、nnodes/node_rank、pipeline_parallel_size、decode/prefill_context_parallel_size、HCCL 重试/超时 | [engine-processes](../../../wiki/concepts/engine-processes.md)、[cann-hccl](../../../wiki/concepts/cann-hccl.md)；PP/CP 专项落各并行页，不复述 B6 启动基础 |
| P2 S08 Ascend 可选优化 | 49 | enable_fused_mc2、enable_prefill_mc2、enable_mc2_hierarchy_comm、mega_moe_max_tokens、共享专家重叠、finegrained_tp_config、FlashComm、EPLB | [expert-parallel](../../../wiki/concepts/expert-parallel.md)、[fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md)、[sequence-parallel](../../../wiki/concepts/sequence-parallel.md)、[eplb](../../../wiki/concepts/eplb.md)；逐项先核 A2/GLM 消费条件 |
| P2 S09 调度与收尾 | 8 | repetition_detection 三子项、priority、balance/recompute 入口、VLLM_MAX_N_SEQUENCES | [request-teardown](../../../wiki/concepts/request-teardown.md)、[vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md)及专页；复用 A2/B3，保留请求优先级生效条件 |
| P2 S10 采样与返回扩展 | 18 | extra_args/vllm_xargs、thinking_token_budget、logits_processors、return_token_ids、return_tokens_as_token_ids、echo、return_prompt_text、usage 强制返回 | [sampling](../../../wiki/concepts/sampling.md)、[streaming-output](../../../wiki/concepts/streaming-output.md)；不重新讲 penalty、概率记录和流式基础 |
| P2 S11 本地 KV 与量化 | 16 | cache_salt、skip_reading_prefix_cache、prefix_caching_hash_algo、disable_cascade_attn、disable_sliding_window、稀疏 C8、kv_cache_dtype_skip_layers | [prefix-caching](../../../wiki/concepts/prefix-caching.md)、[kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md)、[kv-cache-quantization](../../../wiki/concepts/kv-cache-quantization.md)；复用 B2 的容量和块规格 |
| P2 S12 图编译与算子 | 63 | compilation_config 剩余字段、attention_backend/config、kernel_config、ir_op_priority、optimization_level、V2 runner | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md)、[attention-backend-family](../../../wiki/concepts/attention-backend-family.md)、[ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md)；B4/B9 的主模型图与融合只引用 |
| P2 S13 投机扩展 | 33 | rejection_sampler_config、block/entropy verify、posterior_alpha/threshold、其他 speculative_config 字段 | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md)；先核 Ascend 验证策略，再扩其他方法；3 个已解释快捷项只复用 |
| P2 S01 后续后端专题 | 4 | guided_decoding_backend、LLGUIDANCE_LOG_LEVEL、OUTLINES_CACHE_DIR、VLLM_V1_USE_OUTLINES_CACHE | [structured-output](../../../wiki/concepts/structured-output.md)；先判旧请求入口实际接受/拒绝行为，再补选择了对应后端才用到的诊断/缓存 |
| P3 S14 PD、KV 外部存储 | 219 | KVTransferConfig、KVEventsConfig、ECTransferConfig、kv_transfer_params、Mooncake / LMCache / AscendStore 的 extra_config、KV 卸载层级 | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md)、[mooncake-connector](../../../wiki/concepts/mooncake-connector.md)、[kv-pool](../../../wiki/concepts/kv-pool.md)、[lmcache](../../../wiki/concepts/lmcache.md)；先确定连接器，再写该分支；EC 编码器传输与多模态页互链 |
| P3 S15 权重卸载 | 18 → 11 | cpu_offload_gb/params、offload_backend、prefetch 四项、UVA/prefetch 父配置、固定内存相关环境项 | [device-memory](../../../wiki/concepts/device-memory.md)；先核 NPU 消费端；与 KV CPU 卸载保持对象区别 |
| P3 S16 LoRA | 28 | enable_lora、max_loras/max_lora_rank/max_cpu_loras、lora_modules、装卸请求、runtime 更新环境项 | [lora](../../../wiki/concepts/lora.md)；请求结构与服务配额合场景、不混默认 |
| P3 S17 RL 与休眠 | 5 | enable_sleep_mode、enable_return_routed_experts、routed_experts_prompt_start、weight_transfer_config/backend | [sleep-mode](../../../wiki/concepts/sleep-mode.md)、[vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md)；当前推理配方未开启，先补使用前提 |
| P3 S18 多模态 | 47 | media_io_kwargs、mm_processor_kwargs、limit_mm_per_prompt、媒体缓存/超时、encoder、ec_transfer_config | 拟 `wiki/concepts/multimodal-input.md`，尚未建页；不能强塞到文本 token 页或当成 GLM 当前输入能力 |
| P4 S19 其他接口 | 35 | beam search、pooler/runner/convert、run_batch、语音、旧 demo api_server、客户端密钥 | 拟 `beam-search.md`、`pooling-api.md`、`compatible-api-parameters.md`；与 D 批相同主题合并排期，原 C 身份不删除 |
| P4 S20 其他执行路径 | 65 | CUDA/ROCm/TPU、FLA/GDN/Mamba、专用低精度后端、Rust frontend 等 | 逐项保留到硬件/线性注意力等主页面的候选映射；分类表示先核适用性，不宣称这些字段全部不支持 Ascend |
| P4 S21 构建与进程环境 | 37 | MAX_JOBS、NVCC_THREADS、CMAKE_BUILD_TYPE、编译器、预编译包、XDG/系统路径、测试加载格式 | [vllm-ascend-repo-map](../../../wiki/concepts/vllm-ascend-repo-map.md)；只补部署/构建相关说明，不伪装成每请求推理参数 |
| P4 S22 内部结构与入口筛选 | 47 | VllmConfig 容器、TokenizeParams、SchedulerConfig 派生状态、ParallelConfig 内部字段、refresh 候选等 | 台账给出各机制页；先核公开入口与消费者，再决定参考说明或仅源码索引，不能把这些 47 项全部判成漏收公开参数 |

台账的 target 是每项主说明候选，proposedPage 标明尚未创建的页。跨页事项只在主页面给默认/范围/示例，其余页面链接；环境类中的自动归组明确标为 candidate，进入该场景时先核具体消费者，不能仅靠关键词决定硬件支持性。

## 下一批的 17 条参考说明

均补到 [structured-output「对照源码」](../../../wiki/concepts/structured-output.md#对照源码)，按现有「怎么开 → 会报什么错 → 开销和什么时候别开 → 版本差异 → 源码位置」组织，不新增机械的一参数一页。

| 条目 | 原台账编号 | 现状 | 必须补的内容 |
|---|---|---|---|
| 1. response_format | W0513 | 没讲全 | 完整 Chat/Completion 入口差异；text/json_object/json_schema/structural_tag 的嵌套结构；schema 别名；与 structured_outputs 同传时的转换和校验 |
| 2. structured_outputs | W0528 | 没讲全 | HTTP 扩展、SDK extra_body 与 Python StructuredOutputsParams 的对应；None/空对象；六种约束的互斥；不能把所有辅助选项都当独立约束 |
| 3. structured_outputs.json | W0533 | 没讲全 | dict/JSON 字符串输入、完整 schema 示例、非法 schema/不支持特性的拒绝或回退；与 response_format 复用同一示例 |
| 4. structured_outputs.json_object | W0534 | 没讲全 | None/true/false 在存在性校验与实际消费中的区别；任意 JSON 与指定 schema 的区别 |
| 5. structured_outputs.choice | W0529 | 没讲全 | 列表类型、有限候选示例、空列表/重复项等边界；字符串候选不等于 token ID 白名单 |
| 6. structured_outputs.regex | W0535 | 没讲全 | 完整请求、转义、后端支持边界；编译失败与 auto 回退要按实际分支写 |
| 7. structured_outputs.grammar | W0532 | 没讲全 | 最小可用文法、起始规则、后端接受的语法形式与编译错误；不能笼统承诺各后端支持同一种文法 |
| 8. structured_outputs.structural_tag 与旧响应结构 | W0536、W1033–W1035 | 父项没讲全，3 个子项缺说明 | 同一小节讲请求中的序列化 payload、response_format 的新/旧结构；旧 structures[].begin / end / schema；内部 structural_tag_schema 的外部别名是 schema，不把内部名写成 HTTP 字段 |
| 9. 请求 disable_any_whitespace | W0531 | 没讲全 | bool 默认、后端实际消费、服务级值与请求级值的组合；示例展示格式变化，不重算 bitmask |
| 10. 请求 disable_additional_properties | W0530 | 缺参数说明 | 默认、消费者及后端限制；与 JSON Schema additionalProperties 的关系，不能当通用“禁止模型多说话”开关 |
| 11. 请求 whitespace_pattern | W0537 | 缺参数说明 | 默认 None、模式输入、后端生效分支；与禁空白选项同传时的实际行为及不支持路径 |
| 12. structured_outputs_config | W1697 | 没讲全 | 启动 JSON、Python 入口及默认构造；与请求同名容器的层级区别；完整可运行配置片段 |
| 13. 服务 backend | W1199 | 没讲全 | auto 默认与四种显式后端；配置校验、Ascend 单后端限制；不把 auto 写成每次请求都能任意混用 |
| 14. 服务 disable_any_whitespace | W1201 | 没讲全 | False 默认；显式 xgrammar/guidance 前提；auto 与 true 的启动校验，不能只说“不支持则忽略” |
| 15. 服务 disable_additional_properties | W1200 | 缺参数说明 | False 默认；guidance 前提与启动拒绝条件；服务/请求两层合并规则 |
| 16. 服务 enable_in_reasoning | W1202 | 没讲全 | False 默认，parser 有/无与思考结束状态的组合示例；复用现有思考段机制；parser 自身的完整参考留 S02 |
| 17. VLLM_XGRAMMAR_CACHE_MB | W0435 | 没讲全 | 环境入口、定义默认 512、读取时机、传给后端的单位及有效范围；与 KV cache、其他文法后端缓存区分 |

首批的“缺说明”指当前主页面缺该字段的使用说明，不否认页面已有相关机制；“没讲全”指缺完整的入口、范围、示例、覆盖或版本信息，不能把本表当成对每项八个维度全部重新验收的结论。

本轮重新读了主页面，并下载基线 sampling_params、StructuredOutputsConfig、Chat/engine protocol、EngineArgs、结构化输出管理器、XGrammar 后端和 envs 共 9 份固定文件，保留下载地址与哈希；重点核对了下面直接支撑规划边界的定义与转换，未把下载本身算作完整语义审查：

- [六种约束与互斥校验](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/sampling_params.py#L71-L111)：不能只提供辅助选项；计数检查用 `is not None`，不是布尔真值。
- [服务级后端与开关校验](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/config/structured_outputs.py#L18-L74)：需要补启动时的真实拒绝条件。
- [结构化标签的协议别名和两种响应结构](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/entrypoints/openai/engine/protocol.py#L127-L159)：3 个旧子字段和父结构一起教，仍保留 4 项验收身份。
- [response_format 到结构化参数的转换](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/entrypoints/openai/chat_completion/protocol.py#L581-L610)：须核同传时行为，不能仅并排给两个看似独立的开关。

本轮不改的既有内容：bitmask 小例子、CPU/NPU 控制流、GLM 词表和缓冲数字、MTP 回滚、异步调度整批等待、停止条件截断、单后端限制及三版执行机制。XGrammar 对模型特殊 token 的实际处理、设备开销和 V2 组合兼容性仍按页末待核保留，不因补参数表就宣称消除。

## 补写验收与本轮验证边界

下一轮执行 [wiki 写作标准](../../wiki-writing-standard.md)，先逐条检查已有段落，再补缺失的入口/默认/合法值/用例/相互作用/固定三版差异。父子项合写不减少验收项。完成后按写作标准做独立审查、修订、CLI 与 UI 精确参数检索、页面实际阅读以及内容/链接/审计检查；这些是下一轮要求，本轮没有冒充已经执行。

本轮验证以 [c-scenario-validation.json](c-scenario-validation.json) 为准：989 项去向守恒、原定义和记录保留、7 组合并身份及同场景同页检查、首批 20 项唯一、页目标存在或显式拟建、源文件哈希、报告本地文件链接与本轮前后发布页/图/目录/索引哈希比较。仅报告与规划数据变更，无产品代码/页面渲染变更，因此不跑前端构建或 NPU 推理测试。

首次比较整个 wiki 目录时，发现后台 `_jobs` 和 `_drafts` 在本轮期间变化，因此“整棵目录不变”检查没有通过；原始观察保存在证据目录，没有回滚这些其他任务产生的文件。随后单独核对用户要求保留的 concepts、params、sources、diagrams、index 与 registry，发布内容没有变化。链接检查验证本地文件存在，不冒充浏览器锚点或外链实测。

尚未完成的是其余场景的逐参数当前正文再验收、全部消费者与三版行为细审；它们在 JSON 中保留 not-recertified / 候选状态，不借本轮去重注销。需要用户决定的事项：**无**。下一次补写从上表结构化输出首批开始。
