# GLM 双机基线参数补写顺序与页面分工

执行状态（2026-11-01）：A1、A2 首批 **11/11**，B1 默认与采样 **8/8**，B2 容量与 KV **9/9**，B3 调度 **10/10**，B4 主模型图 **5/5**，B5 MTP **5/5**，B6 双机启动 **16/16**，B7 返回与流式输出 **11/11**，B8 概率记录 **7/7**，B9 Ascend 融合与布局 **5/5**，B10 常用入口 **13/13** 已补写，独立内容审查及检索证据见[最新交付记录](common-entry-backfill-validation.md)与[独立审查](common-entry-independent-review.md)。累计 **100 个单元**，A **11/11**、B **89/89**；A/B 优先范围收尾，C 989 与 D 623 单元仍按下文场景分类后续安排。前批记录见[融合与布局](fusion-layout-backfill-validation.md)、[概率记录](logprobs-backfill-validation.md)、[返回与流式输出](streaming-backfill-validation.md)、[双机启动](launch-backfill-validation.md)、[MTP](mtp-backfill-validation.md)、[主模型图](main-graph-backfill-validation.md)、[调度](scheduler-backfill-validation.md)、[容量与 KV](capacity-kv-backfill-validation.md)、[默认与采样](defaults-sampling-backfill-validation.md)、[长度与停止条件](length-stop-backfill-validation.md)。下文保留计划编制时的范围、统计与“未改正文”记录，不将历史缺口数字改写成当前覆盖率。

先补 **11 个直接影响生成结果、输出长度和停止条件的单元**，落到现有的采样、API 入口、请求收尾三页；再补固定部署的容量、调度、图模式、MTP、双机启动和返回格式。可选插件、其他接口、其他硬件路径与升级差异后置。本计划只整理任务，不修改知识库正文，也不创建拟新增知识页。

## 采用哪一份版本

| 对象 | 本计划基线 | 用途 |
|---|---|---|
| vLLM | `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`，v0.23.0 | 请求、启动入口、配置与控制流 |
| vLLM Ascend | `db701c1fd31de40ab028628ee2580ae68c7fd3c0` | GLM 专用执行侧；不拿社区 v0.23 的 `2c59ff10` 替代 |
| 部署配方 | GLM-5.3-Flash，2×A2×8，TP8/DP2/EP16，W8A8，PP1 | 判断什么实际属于主线、什么只是可选场景 |
| 教程 | `0576b6471c7a35707920a665352391d33c77451c` | 两端启动命令与环境配方 |

依据为[部署前提](../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提)与[来源基线](../../../wiki/sources/glm-5-3-flash-baseline.md)。来源基线明确：这些是知识库已固定的教程和参考源码，尚未证明最终镜像安装内容与两个提交完全一致。本计划据此排序，不另行宣称已核实线上安装版本。

v0.26rc/main 只保留在版本差异工作中。RFork 独立工作版不并入社区参数；现有社区快照中涉及 RFork loader 的入口仍保留来源身份。

## 去重结果与口径

上轮“未收录/没讲全”共 2,980 条非重复记录；加上它们在台账中的重复定义/读取记录，本轮处理 3,430 条记录。全部保留去向：

| 处理 | 数量 | 含义 |
|---|---:|---|
| 能提取到本基线定义的缺口记录 | 2,644 | 只取 vLLM v0.23 与 Ascend GLM 的定义证据 |
| 合并后补写单元 | 1,712 | 将上述记录合并为共享说明，减少 932 条重复任务 |
| A：先补 | 11 | 对应 40 条原记录，集中到 3 页 |
| B：固定部署常用参数 | 89 | A 完成后按下表顺序推进 |
| C：按功能/运维场景补 | 989 | 包含可选配置、连接器、环境变量等；不是立即要写 989 个独立页面 |
| D：其他路径、工具与升级项 | 623 | 当前 GLM 主线不优先；有些还需先核实际消费者 |
| 原表未提取到本基线定义的记录 | 786 | 单列归档；不把“这条定义在新版”说成“同名参数只在新版存在” |

**1,712 是补写单元数，不是对外参数总数。** 同一单元可以包含多个 API 的差异行，容器本身与其子字段也不是独立运行开关。工具、接口协议和环境变量没有混成一个“调参数量”。完整映射见[去重台账](deployment-backlog.md)，每个单元都有唯一内容主页面、原记录 ID；[JSON](deployment-backlog.json)保留固定提交、定义位置、默认表达式和入口差异。[非基线定义](deployment-deferred.md)单独列出。

去重遵循以下规则：

1. 同一启动选项在 CLI、EngineArgs、对应配置类、离线 LLM 构造参数中的表达，合成一个补写单元；各入口的默认值和覆盖顺序分行写。例如 `--gpu-memory-utilization` 不再按四个入口安排四次写作。
2. SamplingParams、Chat、Completion 中同义采样字段共用机制与参考主体，保留各 API 的类型、缺省与扩展字段写法。`logprobs` 的 bool/计数差异不能抹平。
3. `max_tokens` 与 Chat 的 `max_completion_tokens` 放在一个输出预算单元中，明确它们不是所有接口都通用的别名，并说明同时传入时的优先级。
4. 请求级 `seed` 与全局 `--seed` 分开；主模型 `enforce_eager` 与 `speculative_config.enforce_eager` 分开；Ascend 融合开关与 vLLM PassConfig 同名字段分开。
5. 已证实为同一 Ascend 配置的 JSON/环境变量兼容入口合写，保留两条入口的解析与优先级。不同连接器的 `use_layerwise`、不同结构中的 `enabled/backend/mode` 不按名字强行合并。
6. 只因 main 改成类型字段而出现的新记录不生成第二份同义说明；不同后端或尚未证实等价的字段暂不合并。内部派生、输出结构、已基本齐备项沿用上一轮分类，不追加补写任务。

## A 批先补这 11 个单元

实际执行顺序为：**三种 penalty → logit_bias/允许与屏蔽列表 → 输出预算 → 停止条件**。先解决用户已经问到、会直接改变结果的问题。

| 顺序 | 参数/单元 | 原有内容 | 内容主页面与补写位置 | 本次必须补齐 |
|---|---|---|---|---|
| 1 | `presence_penalty` | 有机制与 1.5 算例 | [sampling](../../../wiki/concepts/sampling.md)，罚分段及“对照源码 / 怎么开” | 精确键名、中性值、范围、负值含义；沿用现有算例增加正/零/负对照；Chat/Completion/Python 入口差异 |
| 2 | `frequency_penalty` | 有按出现次数罚分 | 同上 | 默认与范围、重复次数如何影响扣分、负值含义；与 presence 用同一组 token 作对照 |
| 3 | `repetition_penalty` | 有正负 logits 乘除机制 | 同上 | 中性值、合法范围、小于 1 的含义、prompt/output 作用范围、配置来源与请求覆盖 |
| 4 | `logit_bias` | 有加减分机制 | 同上 | token ID 到值的映射、各入口范围/处理差异、请求例子与作用顺序 |
| 5 | `allowed_token_ids` | 中文讲过允许编号清单 | 同上 | 参数名、类型、None/空列表/非法 ID 的处理、扩展字段写法，与结构化输出的区别 |
| 6 | `bad_words` | 中文讲过屏蔽词串 | 同上 | 参数名、字符串分词、多个 token 的匹配、边界与例子；不能写成字符串后处理 |
| 7 | `max_tokens` / `max_completion_tokens` | 有入口预算推导 | [api-server-entry](../../../wiki/concepts/api-server-entry.md)，“定输出上限”及“怎么开” | 分清 SamplingParams 默认、API 缺省推导、生成配置上限与请求覆盖；补同时传入的优先级、输入过长和非法值示例 |
| 8 | `min_tokens` | 有屏蔽结束编号机制 | [sampling](../../../wiki/concepts/sampling.md)，最少 token 段及“怎么开” | 默认、上下界校验、与 max_tokens/EOS/手动停止编号的关系；请求收尾页只回链 |
| 9 | `stop` | 有字符串判停与扣字 | [request-teardown](../../../wiki/concepts/request-teardown.md)，“前端先发现”及“怎么开” | str/list/null 与空串校验、停止发生位置、请求例子；保留字符串判停与引擎判停的区别 |
| 10 | `stop_token_ids` | 有编号判停 | 同上，“正常结束”及“怎么开” | 默认、编号列表校验、EOS 与手动编号的关系；与 stop 字符串的配对例子 |
| 11 | `ignore_eos` | 已有简述 | 同上 | 默认、忽略 EOS 的实际范围；同时有手动 stop_token_ids、min_tokens 和输出上限时如何结束 |

这批只设三个内容主页面。流式页对停止串保留的已有说明保留；API 入口页对采样只链接主说明；部署页不复制整张参数表。索引/别名同步计划覆盖精确参数名、下划线/连字符及已有英文空格词形，避免内容补了却仍找不到。检索验收应检查真实查询结果，不预先把用户搜不到归因于检索代码缺陷。

## B 批补固定部署常用参数

按 B1 到 B10 的顺序补。每组下列名称即本轮基线的任务范围，完整入口见逐项台账。

| 组 | 单元数 | 参数范围 | 内容主页面 | 补到什么程度 |
|---|---:|---|---|---|
| B1 默认与采样 | 8 | 请求 `temperature/top_p/top_k/min_p/seed`；全局 `seed/generation_config/override_generation_config` | [sampling](../../../wiki/concepts/sampling.md) | 已有中性默认与计算，不重写；补“模型配置 → 启动覆盖 → 请求”实例、两层 seed 的区别、精确查询入口。当前版本不为 main 的温度差异阻塞补写。 |
| B2 容量与 KV | 9 | `max_model_len`、`gpu_memory_utilization`、`kv_cache_memory_bytes`、`num_gpu_blocks_override`；`block_size/kv_cache_dtype/mamba_block_size/mamba_cache_mode/disable_hybrid_kv_cache_manager` | 长度归 [API 入口](../../../wiki/concepts/api-server-entry.md)；显存归 [KV 预算](../../../wiki/concepts/kv-cache-memory-profiling.md)；块/布局归 [KV 规格](../../../wiki/concepts/kv-cache-spec.md) | 区分示例值、定义默认和 GLM 改写后的有效值；0.85、640、133120 不能写成所有模型默认。 |
| B3 调度 | 10 | `max_num_batched_tokens/max_num_seqs/max_num_partial_prefills/max_long_partial_prefills/long_prefill_token_threshold/async_scheduling/enable_chunked_prefill/scheduling_policy/scheduler_cls/scheduler_reserve_full_isl` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 默认推导、范围、互斥与联合示例；chunked prefill 和并发页保留机制并回链参考。 |
| B4 主模型图 | 5 | `compilation_config`、`cudagraph_mode/cudagraph_capture_sizes/max_cudagraph_capture_size`、主模型 `enforce_eager` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 固定 FULL_DECODE_ONLY 配方、自动尺寸与显式尺寸、eager 影响；复用 ACL Graph 的既有捕获机制。 |
| B5 MTP | 5 | `speculative_config` 及 `method/model/num_speculative_tokens/enforce_eager` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 用当前 deepseek_mtp、3 个草稿走一份完整配置；草稿 eager 单独说明，不能沿用主模型开关结论。 |
| B6 双机启动 | 16 | TP/DP/EP 与地址/rank/local size、`distributed_executor_backend/headless/api_server_count`；可见设备、HOST_IP/PORT、V1 多进程、worker 启动方式 | [engine-processes](../../../wiki/concepts/engine-processes.md)；TP/DP/EP 分别归对应并行页 | 两端命令差异、缺省与组合约束；部署页保留配方，不复制参数定义。环境变量是这些已列项的来源，不等于补齐整个 HCCL 参数全集。 |
| B7 返回与流式 | 11 | `stream/stream_options` 及 `include_usage/continuous_usage_stats`、`n/output_kind/detokenize/skip_special_tokens/spaces_between_special_tokens/include_stop_str_in_output`；服务级 `stream_interval` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 请求与响应成对示例，SDK/Python/HTTP 入口区分；本版本只安排服务级 stream_interval，不提供 main 请求级写法。 |
| B8 概率记录 | 7 | `logprobs/prompt_logprobs/top_logprobs/logprob_token_ids/flat_logprobs/max_logprobs/logprobs_mode` | 通常归 [sampling](../../../wiki/concepts/sampling.md)；prompt_logprobs 主说明归 [prefill](../../../wiki/concepts/prefill.md) | 数量与特殊值、各 API 类型差异、返回结构；prefix caching 页只解释缓存相互作用并回链。 |
| B9 Ascend 融合与布局 | 5 | `ascend_compilation_config`、其下 `fuse_norm_quant/fuse_qknorm_rope/fuse_muls_add`；`weight_nz_mode` 与兼容环境入口 | 融合归 [npugraph-ex](../../../wiki/concepts/npugraph-ex.md)；布局归 [tensor-layout](../../../wiki/concepts/tensor-layout.md) | 默认、解析优先级、前提与实际命中区别；不把“配置开启”写成“算子一定执行”。 |
| B10 常用入口 | 13 | `host/port/config/chat_template/chat_template_content_format/trust_request_chat_template`；`model/served_model_name/tokenizer/tokenizer_mode/dtype/quantization/load_format` | [API 入口](../../../wiki/concepts/api-server-entry.md)、[token](../../../wiki/concepts/token.md)、[quantization](../../../wiki/concepts/quantization.md)、[worker 启动](../../../wiki/concepts/npu-worker-lifecycle.md)各自认领 | 模型/对外名称、模板来源与信任条件、分词/加载/量化入口；主页面逐项映射见台账。 |

已有 `enable_npugraph_ex` 与 `enable_static_kernel` 的基线默认和依赖说明位于 npugraph-ex 页“怎么开”。旧式构造未必被首轮字段扫描完整捕获，因此不因台账只出现新版定义便说它们在 GLM 不存在，也不重复新增两份漏项任务；B9 编写时引用已有说明。

## C 批按场景补，D 批暂不挤入主线

2026-11-01 续排：A/B 已交付后的 C 批具体顺序、跨旧组去重与下一批 20 项，改看 [C 批场景计划](c-scenario-plan.md)及[逐项台账](c-scenario-ledger.csv)。下表保留首次规划时的主题划分，不覆盖新的场景归属。

| 范围 | 具体例子 | 页面归属与顺序 |
|---|---|---|
| C：结构化输出 | `structured_outputs` 子字段、`response_format/tool_choice`、禁空白/附加属性、语法/正则 | [structured-output](../../../wiki/concepts/structured-output.md)；先写完整请求结构、互斥和例子。 |
| C：Ascend 诊断 | `ascend_log_path/dump_config/dump_config_path/msmonitor_use_daemon` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md)；配置系统页只链接路径与优先级。dump_config_path 是 msprobe 配置路径，不是“导出引擎配置”。 |
| C：可选通信/优化 | `enable_fused_mc2/enable_prefill_mc2/enable_mc2_hierarchy_comm/mega_moe_max_tokens/enable_shared_expert_dp/multistream_overlap_shared_expert` | [expert-parallel](../../../wiki/concepts/expert-parallel.md)；先核 GLM/A2 消费分支，写默认与限制，不能仅凭源码存在建议开启。 |
| C：可选并行/缓存 | `enable_flashcomm1/enable_flashcomm2_parallel_size`、finegrained TP、`enable_dsa_cp/enable_kv_nz/enable_sparse_li_c8/enable_sparse_sfa_c8/enable_transpose_kv_cache_by_block` | 分别归 SP、细粒度 TP、CP、张量布局、KV 量化、KV 规格页；同义环境入口合写。 |
| C：可选调度/验证 | balance/recompute、rejection sampler、`repetition_detection` 及三个子阈值、`enable_reduce_sample` | balance/recompute 页、投机解码、请求收尾、采样页；父字段与子字段作为同一小节交付，不写四遍机制。 |
| C：外部 KV/PD | KVTransferConfig、连接器 extra_config、TLS、Yuanrong/Mooncake 存储、传输协议 | PD 分离、Mooncake、KV Pool、LMCache 各自归属；当前基线不是 PD 分离，按所选连接器再补。 |
| C：LoRA、RL、sleep | LoRA 配额与布局、权重更新/休眠、路由数据 | LoRA、RL、Sleep Mode 页；当前官方推理配方未开启这些功能。 |
| C：其他服务/环境/加载 | CORS/TLS、日志、其他环境变量、构建入口、加载器与其他配置 | API 入口、性能分析、Ascend 配置系统、worker 启动；具体目标逐项列在台账。先核用户入口，内部派生或框架接管的字段不应变成新调参教程。 |
| D：其他接口 | beam search、pooling、Responses/Cohere/Anthropic/语音等 | 暂拟 `wiki/concepts/beam-search.md`、`pooling-api.md`、`compatible-api-parameters.md`；没有创建。Pooling API 不塞进“按编号查词向量”的 embedding 教学页。 |
| D：其他硬件/模型与工具 | FlashInfer/ROCm/CUDA、模型特定路径、基准/绘图 CLI | 硬件接口或测量专题；基于模块职责后置，不据名称判定硬件一定不支持。消费者未确认前不写成 GLM 可用开关。 |
| D：纯升级缺口 | c8_enable_reshape_optim 的 main 谱系冲突、sleep cleanup 的 main 初始化次序 | 保留在原参数专页的升级任务中；当前 GLM 参考已经讲过的部分不重写。 |

### 上轮九个 Ascend 缺口如何落位

| 参数 | 当前计划 |
|---|---|
| `ascend_log_path`、`dump_config_path` | 基线有，C 批诊断页 |
| `mega_moe_max_tokens` | 基线有，C 批 EP 页，先核 A2/GLM 消费条件 |
| `multistream_dsv4_dsa_overlap` | 基线源码有，但命名/职责指向其他模型路径，D 批；不能因“存在”就列为 GLM 常用开关 |
| `draft_window_size`、`mc2_comm_alg` | 本轮证据只在 v0.26rc/main，不安排本基线补写 |
| `mlapo_keep_prefill_weights`、`fusion_ops_gmmswigluquant`、`dynamic_spec_config.method_params` | 本轮仅固定 main，留升级任务 |

这里再次区分：v0.23/GLM 不存在某条“类型字段记录”，与参数真的不存在是两回事。上表的版本范围采用前轮已经跨字典读取/字段声明合并的九项结论，其余非基线记录不自动据此推出参数新增版本。

## 每批补写的验收标准

每个单元应能回答：作用与阶段、在哪个入口/嵌套路径传、定义默认与模型/启动/请求覆盖、合法值和特殊值、完整用例、相互作用与限制、基线和对照版本区别。已有内容通过链接复用，不能把“待核默认”占位当成完成；也不为了凑齐参考而编造设备效果。

首批尤其要保留这些区别：

- Penalty 的机制演算与实际 JSON/Python 写法是两份证据；算例不是实测输出。
- 同一参数的 Chat/Completion/SamplingParams 默认分行写；扩展字段怎么传以该版本入口为准。
- 当前基线讲清楚后，再以同一单元补 v0.23 维护版、v0.26rc、固定 main 差异；未核版本显式保留未核，不把新版本能力倒灌进基线示例。
- 每个参数只有一个内容主页面。其他页面链接它；部署页保留实际配方值，避免出现多份默认值表。
- 查询 `presence_penalty`、`frequency_penalty`、`repetition_penalty` 等精确名称应能定位主页面，且页面能回答范围、默认和用法。检索检查与内容检查分别验收。

本轮验证见 [deployment-plan-validation.json](deployment-plan-validation.json)：输入记录去向守恒、去重单元唯一、入口差异保留、页面目标存在/明确拟新增、首批 11 个单元覆盖 40 条原记录，以及知识页前后哈希一致。没有修改知识页或产品代码，因此没有运行前端构建或硬件推理测试。需要用户决定的事项：无；后续补写按 A1 → A2 → B1…B10 推进。
