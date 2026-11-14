# 99 项官方目录独立覆盖复核

这份记录把“读了官方正文”“追到了真实消费者”“本站已解释并验收”分开。范围沿用已有99项固定vLLM目录，未另造资料池，也不代表全部官方资料或全站已完成。

99份母页正文均有全文阅读证据：本独审实际读73份，26份复用同hash历史全文记录；此次读取/复读与全局新增计数分开，尚未给全局新增全文记账。真正未读的母页为0，仍未闭合的主要是技术子链接、生成include、外部示例/模型指南及具体消费者，不得把它们写成“99篇全部内容已验收”。

本轮已经推进的不是纯引文数量：MM占位/缓存/媒体链62项与自定义处理器31项已验收；NIXL/Store72项、IndexCache38项、DBO28项、ViT82项分别有独立接受记录。媒体下载缓存/K8s13项和生成式评分26项有独审与冻结包（工程状态以media-scoring-checkpoint为准）。reasoning50项教学增量已独审和浏览器通过，工程状态见reasoning-checkpoint；初始57范围是其候选证据。renderer34范围、beam39范围、模型识别/HF43范围仍是交作者的消费者证据，尚不等于教学验收项。

完整参数include已实际读：engine_args生成表1923行；serve表以217段精确相同内容复用+62个差异段实读；envs541–2016定义include与渲染正文核对；renderer生成CLI以278段复用+2个不同段实读。函数实现仅按精确来源范围核，不把参数列表全部读完推成所有消费者都已查完。

目前状态分布：

| 状态 | 条目数 |
|---|---:|
| 选定教学问题已承接 | 40 |
| 生成参考已读，消费者按范围核 | 3 |
| 精确补证已交作者 | 4 |
| 母文已读，技术承接待继续 | 38 |
| 设备专属比较范围 | 2 |
| 主问题已有，子链接范围未全闭合 | 7 |
| 上游矩阵限定范围 | 1 |
| 外部应用配置排除 | 4 |

剩余工作有明确边界：模型识别/配置路径（5、17，证据已交作者），图与编译/IR/算子（12、14–16、25、33、35；11/34/57选定ViT范围已闭），LoRA/IO/指标（19、21、22、46），量化产物与加载（54–67、69、70），草稿方法与训练产物（73–82），部分离线/语音与协议子页（93、98及已有主解释的子链接）。这些条目是“技术工作待闭合”，不是尚未读过的母页数。每项下一步已改为具体consumer或子链接，未用统一“继续阅读”代替问题定位。

范围排除仅有4个外部应用客户端配置：Claude Code、Codex、LangChain、LlamaIndex。其母文已读，相关服务协议仍由本站API页承接；排除的是客户端安装/产品配置教程，不排除引擎参数和部署本身。ROCm MoRI与CUDA P2P NCCL保留设备专属比较范围，未声称Ascend可运行。

以下99行均对应固定原文hash和具体教学位置。完整路径、SHA、正文标题行及实读范围见request-coverage-independent.json；图像实际查看和子资料阅读范围见request-coverage-independent-reading.json及其链接账。当前页面hash只标映射时文件身份，不替代各批已冻结的验收hash。

| # | 官方入口 | 本站承接页 | 当前结论 | 尚需核的明确范围 |
|---:|---|---|---|---|
| 1 | configuration/README.md | api-server-entry、sampling | 选定教学问题已承接 | 保留逐字段规则；两处API子页按独立阅读账继续。 |
| 2 | configuration/conserving_memory.md | kv-cache-memory-profiling、npu-worker-lifecycle | 选定教学问题已承接 | 优化建议与模型/硬件限制不能由显存页存在就全部验收；相关脚本另核。 |
| 3 | configuration/engine_args.md | api-server-entry、engine-processes、ascend-config-system | 生成参考已读，消费者按范围核 | 点号/列表+的通用CLI合成规则仍需对照实际配置解析器与本站说明；不把完整字段表等同全部消费者已核。 |
| 4 | configuration/env_vars.md | engine-processes、inference-performance-analysis | 生成参考已读，消费者按范围核 | 完整env定义不等于2208行env文件全文；其他变量消费者仍按专题核，不重复开这两项缺口。 |
| 5 | configuration/model_resolution.md | platform-plugin-registration、npu-worker-lifecycle | 精确补证已交作者 | request-model-resolution-evidence.json已交作者；待模型注册/权重/token页面教学增量及独审。HF库内部及所有模型卡未全读，不以模型支持矩阵代替Ascend运行证据。 |
| 6 | configuration/optimization.md | vllm-scheduler、chunked-prefill、kv-cache-memory-profiling、npu-model-runner | 选定教学问题已承接 | 仍需按子主题跟技术链接，不将同一母文拆成多份新增全文。 |
| 7 | configuration/serve_args.md | api-server-entry、engine-processes | 生成参考已读，消费者按范围核 | Frontend部分仅有默认而无说明，必须看实际消费者；不以生成help替代字段契约。 |
| 8 | design/arch_overview.md | vllm-v1-shape、engine-processes、request-call-chain | 选定教学问题已承接 | 无本组新增缺口；官方技术链接仍独立计范围。 |
| 9 | design/attention_backends.md | attention-backend-family | 选定教学问题已承接 | 后端选择协议、支持矩阵和动态探测范围；不得因同名后端页判覆盖充分。 |
| 10 | design/cuda_graphs.md | acl-graph、graph-mode-layer | 选定教学问题已承接 | 对照piecewise/full及dispatcher，不将CUDA支持直接移植NPU。 |
| 11 | design/cuda_graphs_multimodal.md | acl-graph、api-server-entry | 选定教学问题已承接 | 当前选定ViT graph/compile_mm_encoder/encoder FP8边界已按82项闭合；其余编译/IR技术子题由性能专题继续，不将图与源码通过当设备实测。 |
| 12 | design/custom_op.md | ops-and-kernels、op-to-ai-core、ascend-patch-system | 母文已读，技术承接待继续 | CustomOp实际注册/平台fallback/编译开关消费者及生成layer include；只补ops/patch当前机制连接，不把伪代码当API。 |
| 13 | design/dbo.md | dynamic-chunked-pp、async-scheduling | 选定教学问题已承接 | 母文已读与本次源码验收分别记账；不把上游DBO当GLM/Ascend可运行开关。 |
| 14 | design/debug_vllm_compile.md | inference-performance-troubleshooting、acl-graph | 母文已读，技术承接待继续 | 先核compilation_config实际字段/环境开关与Ascend耦合，再把eager、compile-backend、graph、IR各级定位回性能排障；tlparse子文未因截图已看而全文完成。 |
| 15 | design/fused_moe_modular_kernel.md | moe、ops-and-kernels | 母文已读，技术承接待继续 | 核实际FusedMoE prepare/finalize、标准/批次激活布局与专家实现选择；把ABI与设备支持分开，旧1cb链接不能当0fc消费者。 |
| 16 | design/fusions.md | ops-and-kernels、op-to-ai-core | 母文已读，技术承接待继续 | 核PassConfig与优化级别实际优先级，RoPE O1/O2官方矛盾、SP/AsyncTP前提；Ascend只承接实际适用算子，不照搬CUDA表。 |
| 17 | design/huggingface_integration.md | platform-plugin-registration、npu-worker-lifecycle、token | 精确补证已交作者 | request-model-resolution-evidence.json已交作者；待模型注册/权重/token页面教学增量及独审。HF库内部及所有模型卡未全读，不以模型支持矩阵代替Ascend运行证据。 |
| 18 | design/hybrid_kv_cache_manager.md | vllm-kv-block-allocation、kv-cache-spec、prefix-caching | 选定教学问题已承接 | 新模型/新组策略按相应版本补证，不重复计此全文。 |
| 19 | design/io_processor_plugins.md | platform-plugin-registration、api-server-entry | 母文已读，技术承接待继续 | 核pooling encode入口实际IO plugin调用顺序、parse_data校验责任与异步输出排序；本站平台插件目录未解释这类任务接口。 |
| 20 | design/logits_processors.md | sampling | 选定教学问题已承接 | 母文外部setuptools及其他插件生态不因本批通过自动全读；无需重复新增同一解释。 |
| 21 | design/lora_resolver_plugins.md | lora、platform-plugin-registration | 精确补证已交作者 | request-lora-resolver-evidence.json handed to author; teaching delta and independent acceptance pending. Model-specific mixedMoE/default-MM-LoRA behavior remains separate scope. |
| 22 | design/metrics.md | inference-performance-analysis、inference-benchmarking | 母文已读，技术承接待继续 | 核stats/metrics事件与Counter/Gauge/Histogram consumers；对齐queue/prefill/decode/recompute时间和APC token单位，纠正官方图的preemption区间歧义；外部OTLP/tlparse文档另列。 |
| 23 | design/mm_processing.md | api-server-entry、token、kv-cache-memory-profiling | 选定教学问题已承接 | Qwen2/Qwen3/MiniCPM及4示例阅读范围独立记账；模型/设备实测仍不宣称通过。 |
| 24 | design/model_runner_v2.md | npu-model-runner、prepare-inputs-flow、vllm-v1-shape | 选定教学问题已承接 | 被用户暂缓的V2专题不扩展重写；仅保留已核接口边界。 |
| 25 | design/moe_kernel_features.md | moe、ops-and-kernels | 母文已读，技术承接待继续 | 核MoE prepare/finalize与quant/dispatch排列、layout和all2all兼容；CUDA/ROCm表只作比较，Ascend另证。 |
| 26 | design/multiprocessing.md | engine-processes | 选定教学问题已承接 | 无新缺口；真实进程/安装环境保留实测边界。 |
| 27 | design/nixl_kv_cache_lease.md | pd-disaggregation | 选定教学问题已承接 | 此项选定机制已承接；不宣称所有NIXL能力矩阵/连接器或外部Mooncake总设计/构建文档全读。Mooncake3篇全文记录与未读总设计见transfer-coverage-reading。 |
| 28 | design/optimization_levels.md | acl-graph、inference-performance-analysis | 选定教学问题已承接 | 级别怎样覆盖子选项、版本默认与Ascend消费关系。 |
| 29 | design/p2p_nccl_connector.md | pd-disaggregation、mooncake-connector | 设备专属比较范围 | CUDA P2P NCCL实现与A800/H20命令不能变成Ascend可运行教程；现有PD控制/数据面作概念比较，不宣称此后端已在NPU验证。 |
| 30 | design/paged_attention.md | kv-cache、block-table、attention-backend-family | 母文已读，技术承接待继续 | 历史CUDA分页attention核函数仅作块寻址/归约示意；PARTITION_SIZE与TP文本错误、224索引错误已记录；若需当前NPU线程实现必须换对应Ascend源，不复制历史图当设备证明。 |
| 31 | design/plugin_system.md | platform-plugin-registration、vllm-platform-interface | 主问题已有，子链接范围未全闭合 | IO/stat logger插件应分别回链对应专题，注册接口稳定不代表实现跨版兼容；母文引用的Bart外部例不自动已读。 |
| 32 | design/prefix_caching.md | prefix-caching、block-table | 选定教学问题已承接 | 外部命中实验与不同模型缓存身份仍按范围核，不重复计旧文。 |
| 33 | design/torch_compile.md | acl-graph、npugraph-ex、graph-mode-layer | 母文已读，技术承接待继续 | 核Dynamo/backend/cache哈希与捕图所有者实际实现，区分旧编译设计与当前dispatcher；母文引用blog/生成include仍待相关选段阅读。 |
| 34 | design/torch_compile_multimodal.md | acl-graph、api-server-entry | 选定教学问题已承接 | 当前选定ViT graph/compile_mm_encoder/encoder FP8边界已按82项闭合；其余编译/IR技术子题由性能专题继续，不将图与源码通过当设备实测。 |
| 35 | design/vllm_ir.md | ops-and-kernels、ascend-patch-system | 母文已读，技术承接待继续 | 核IRop注册、static/dynamic支持与eager/compile选择，以及Ascend是否消费；functionalization/donation/clones示意不得当可执行API。 |
| 36 | features/README.md | vllm-ascend-overview、attention-backend-family | 上游矩阵限定范围 | 各有争议格子需核固定代码/issue；本站按具体版本模型条件讲，不复制整张表。 |
| 37 | features/automatic_prefix_caching.md | prefix-caching | 选定教学问题已承接 | 离线示例文件未因母文读完就自动通过。 |
| 38 | features/batch_invariance.md | batch-invariance | 选定教学问题已承接 | 支持硬件、环境开关及性能基准，与Ascend具体范围比对。 |
| 39 | features/context_extension.md | rope | 选定教学问题已承接 | 链接的offline示例及HF RoPE文档另核；不复制“max length即预分配量”简化成精确显存账。 |
| 40 | features/custom_arguments.md | sampling、api-server-entry | 选定教学问题已承接 | 母文外部setuptools及其他插件生态不因本批通过自动全读；无需重复新增同一解释。 |
| 41 | features/custom_logitsprocs.md | sampling | 选定教学问题已承接 | 母文外部setuptools及其他插件生态不因本批通过自动全读；无需重复新增同一解释。 |
| 42 | features/disagg_encoder.md | pd-disaggregation、ucm | 选定教学问题已承接 | 设计Google文档、ExampleConnector两脚本及测试目录仍另账，不把母文的TTFT优势写成无条件实测。 |
| 43 | features/disagg_prefill.md | pd-disaggregation | 选定教学问题已承接 | 辨别旧connector设计与本站v1实现；脚本/文章链接单列。 |
| 44 | features/index_cache.md | sparse-attention | 选定教学问题已承接 | 不把索引共享写成KV共享或GLM KPool；论文和工程开关的证据身份分开。 |
| 45 | features/interleaved_thinking.md | sampling、streaming-output | 选定教学问题已承接 | reasoning parser模型子页与示例另核。 |
| 46 | features/lora.md | lora | 母文已读，技术承接待继续 | 核默认多模态LoRA仅generate/chat、一prompt一adapter、多模态冲突不应用的实际分支；与runtime adapter加载/替换/内存预算及信任开关分版本对照。 |
| 47 | features/mooncake_connector_usage.md | mooncake-connector | 选定教学问题已承接 | 此项选定机制已承接；不宣称所有NIXL能力矩阵/连接器或外部Mooncake总设计/构建文档全读。Mooncake3篇全文记录与未读总设计见transfer-coverage-reading。 |
| 48 | features/mooncake_store_connector_usage.md | kv-pool、mooncake-connector、ucm | 选定教学问题已承接 | 此项选定机制已承接；不宣称所有NIXL能力矩阵/连接器或外部Mooncake总设计/构建文档全读。Mooncake3篇全文记录与未读总设计见transfer-coverage-reading。 |
| 49 | features/moriio_connector_usage.md | pd-disaggregation | 设备专属比较范围 | ROCm MoRI/RDMA/xGMI依赖不适用于当前Ascend教学部署；保留PD传输控制概念连接，不复制AMD安装命令。 |
| 50 | features/multimodal_inputs.md | api-server-entry、token、kv-cache-memory-profiling、pd-disaggregation | 主问题已有，子链接范围未全闭合 | MiniCPM原始README受限未取得全文hash；模型权重/设备运行、外部guides全部生成API未验收，不因母文已读全包。 |
| 51 | features/nixl_connector_compatibility.md | pd-disaggregation | 选定教学问题已承接 | 此项选定机制已承接；不宣称所有NIXL能力矩阵/连接器或外部Mooncake总设计/构建文档全读。Mooncake3篇全文记录与未读总设计见transfer-coverage-reading。 |
| 52 | features/nixl_connector_usage.md | pd-disaggregation、ucm | 选定教学问题已承接 | 此项选定机制已承接；不宣称所有NIXL能力矩阵/连接器或外部Mooncake总设计/构建文档全读。Mooncake3篇全文记录与未读总设计见transfer-coverage-reading。 |
| 53 | features/prompt_embeds.md | api-server-entry、embedding | 选定教学问题已承接 | 模型专用布局及兼容实测不由HTTPschema通过推定。 |
| 54 | features/quantization/README.md | quantization、quantization-methods、low-precision-formats | 母文已读，技术承接待继续 | 核OOT QuantizationConfig的Linear/MoE选派与当前Ascend方法；现站算法/格式/工具/内核区分已有，缺的是扩展消费者契约。 |
| 55 | features/quantization/auto_awq.md | quantization-methods、quantization-evaluation | 母文已读，技术承接待继续 | 跟读被母文推荐的LLMCompressor AWQ迁移入口并核固定输出/加载；不能推广已废弃AutoAWQ安装步骤。 |
| 56 | features/quantization/bnb.md | quantization-methods、npu-worker-lifecycle | 母文已读，技术承接待继续 | 核BnB预量化自动识别与加载时4bit参数区别；设备支持单列，不把加载器名称出现当Ascend可运行配方。 |
| 57 | features/quantization/fp8_vit_attn.md | quantization、api-server-entry | 选定教学问题已承接 | 当前选定ViT graph/compile_mm_encoder/encoder FP8边界已按82项闭合；其余编译/IR技术子题由性能专题继续，不将图与源码通过当设备实测。 |
| 58 | features/quantization/gguf.md | npu-worker-lifecycle、quantization-methods | 母文已读，技术承接待继续 | 核GGUF loader、单文件/repo:quant、tokenizer与hf-config-path真实优先级；实验性格式与Ascend算子兼容分开。 |
| 59 | features/quantization/gptqmodel.md | quantization-methods、quantization-evaluation | 母文已读，技术承接待继续 | 跟读GPTQModel导出格式与vLLM加载消费者；校准示例样本量和group128为配方，不是GPTQ算法统一规则；Marlin/Machete非NPU支持证据。 |
| 60 | features/quantization/inc.md | quantization-methods | 母文已读，技术承接待继续 | AutoRound产物格式与Intel执行组合只作工具/格式比较；不将Intel的eager限定推广Ascend；是否补工具表依当前页缺口实际核。 |
| 61 | features/quantization/llm_compressor/README.md | quantization-methods、quantization-evaluation | 母文已读，技术承接待继续 | 母页只是量化工具入口；62–65已各读正文，进一步将export→config→load消费者接回方法页，避免再次把工具当量化算法。 |
| 62 | features/quantization/llm_compressor/fp8.md | low-precision-formats、quantization-methods | 母文已读，技术承接待继续 | 区分FP8离线校准导出与旧online per-tensor加载路径；核消费者后才加入工具示例，不照搬速度倍率。 |
| 63 | features/quantization/llm_compressor/int4.md | quantization-methods、quantization-evaluation | 母文已读，技术承接待继续 | 核W4A16 recipe导出、模型chat模板/校准数据与actorder/dampening字段；不得假定GLM固定权重就是该示例制作。 |
| 64 | features/quantization/llm_compressor/int8_w4a8.md | quantization、quantization-methods | 母文已读，技术承接待继续 | W4A8动态activation仍可能需权重GPTQ校准已被现页原则覆盖；Arm KleidiAI安装部署为设备专属比较，若扩正文须核产物格式消费者。 |
| 65 | features/quantization/llm_compressor/int8_w8a8.md | quantization、quantization-evaluation | 母文已读，技术承接待继续 | 核SmoothQuant+GPTQ W8A8产物与加载config，BOS/模板校准影响回质量页；CUDA支持告示不移植Ascend。 |
| 66 | features/quantization/modelopt.md | quantization-methods | 母文已读，技术承接待继续 | 核ModelOpt hf_quant_config读取与格式/硬件对应；NVIDIA产物命名不能当Ascend同名量化兼容；不新增完整NVIDIA部署教程。 |
| 67 | features/quantization/online.md | quantization-methods、npu-worker-lifecycle | 母文已读，技术承接待继续 | 核online quant加载时Linear/MoE转换、per-layer回退/ignore规则、activation override；这是与预量化加载不同的核心部署解释，优先承接worker/quant页。 |
| 68 | features/quantization/quantized_kvcache.md | kv-cache-quantization | 选定教学问题已承接 | FP8尺度来源/粒度/校准与C8分开，不将权重量化或所有状态统称缩半。 |
| 69 | features/quantization/quark.md | quantization-methods | 母文已读，技术承接待继续 | 核Quark导出格式与dequant fallback的边界，AMD设备专属能力与通用混合精度分开；AMP搜索外部工程未全读。 |
| 70 | features/quantization/torchao.md | quantization-methods、npu-worker-lifecycle | 母文已读，技术承接待继续 | 核TorchAO checkpoint保存/loader识别与运行时量化区别；外部nightly CUDA安装不作为固定GLM可运行命令。 |
| 71 | features/reasoning_outputs.md | streaming-output、sampling、api-server-entry | 选定教学问题已承接 | 普通非beam Chat的模板/隐藏/预算与结构化起点已承接；Responses全协议及全部模型parser不由此批自动验收。 |
| 72 | features/sleep_mode.md | sleep-mode | 选定教学问题已承接 | CUDA/ROCm90%+不当NPU承诺；博客与ROCm块分配子范围未作新验证。 |
| 73 | features/speculative_decoding/README.md | speculative-decoding | 母文已读，技术承接待继续 | 将方法目录映射已有draft模型/MTP/ngram/suffix概念与参数；对损失无损性/浮点、当前组合限制查源码，不将历史禁用条件外推。 |
| 74 | features/speculative_decoding/draft_model.md | speculative-decoding | 母文已读，技术承接待继续 | 核独立draft模型config与TP/异步组合、模型输出词表兼容条件；母文示例模型未运行，客户端不变不等于服务配置全兼容。 |
| 75 | features/speculative_decoding/eagle.md | speculative-decoding | 母文已读，技术承接待继续 | 核EAGLE/EAGLE3 proposer与训练产物接口，再跟必要论文/模型卡；当前页仅解释hidden-state类别，非完整训练教程。 |
| 76 | features/speculative_decoding/extract_hidden_states.md | speculative-decoding | 母文已读，技术承接待继续 | hidden-state抽取是草稿训练/离线分析接口；核未归一化末层、共享文件/并发写与chunked-prefill限制，接现有RL/草稿训练范围，不混入普通推理路径。 |
| 77 | features/speculative_decoding/mlp.md | speculative-decoding | 母文已读，技术承接待继续 | 核MLP speculator真实proposer与模型特定失败条件；训练报告未全文读，不以列出method名算部署覆盖。 |
| 78 | features/speculative_decoding/mtp.md | speculative-decoding、sampling | 主问题已有，子链接范围未全闭合 | 母文中的其他模型/示例不能等同本站GLM已实测。 |
| 79 | features/speculative_decoding/n_gram.md | speculative-decoding | 母文已读，技术承接待继续 | 核ngram查找窗/命中选择/草稿长度实际默认，现页仅类别说明；小示例先与CPU proposer结果对照。 |
| 80 | features/speculative_decoding/parallel_draft_model.md | speculative-decoding | 母文已读，技术承接待继续 | 核parallel_drafting/PARD模型前提与Ascend支持；当前GLM逐步草稿不可概括所有方法，不扩新训练产品。 |
| 81 | features/speculative_decoding/speculators.md | speculative-decoding | 母文已读，技术承接待继续 | 两张Speculators SVG已实际看；训练库/标准产物/加载连接仍待必要源码，不把2–3x与same tokens营销句当普适保证。 |
| 82 | features/speculative_decoding/suffix.md | speculative-decoding | 母文已读，技术承接待继续 | 核suffix proposer窗口、历史全局匹配、adaptiveK和ArcticInference依赖；现页只有方法类别，缺真实开关与成本边界。 |
| 83 | features/structured_outputs.md | structured-output、sampling | 主问题已有，子链接范围未全闭合 | 母文中其他后端特性与示例代码仍独立核；当前参数细化不等于整外部库验收。 |
| 84 | features/tool_calling.md | api-server-entry、streaming-output、structured-output | 主问题已有，子链接范围未全闭合 | 各模型parser与示例目录不能凭母文读完全标通过。 |
| 85 | serving/context_parallel_deployment.md | context-parallel | 选定教学问题已承接 | 上游“PCP仍开发中”不覆盖Ascend已实现路径；Ring/MLA论文外链另账。 |
| 86 | serving/data_parallel_deployment.md | data-parallel、engine-processes、dp-request-routing | 选定教学问题已承接 | 官方总述过宽的token共享不照搬；子示例仍独立。 |
| 87 | serving/distributed_troubleshooting.md | inference-troubleshooting、engine-processes | 选定教学问题已承接 | CUDA NCCL诊断不能当HCCL实测；外部运行环境保留边界。 |
| 88 | serving/expert_parallel_deployment.md | expert-parallel、large-scale-ep、eplb | 母文已读，技术承接待继续 | 核大EP指南prompt忽略说法对应consumer、冗余专家全局/每rank冲突；EP/TP/DP资源已有，不复制CUDA/NIXL脚本当Ascend命令。 |
| 89 | serving/integrations/claude_code.md | api-server-entry、prefix-caching | 外部应用配置排除 | Anthropic端点兼容不凭这份指南宣布GLM可用；外部客户端安装及营销式任意模型替换说法不照搬。 |
| 90 | serving/integrations/codex.md | api-server-entry | 外部应用配置排除 | 指南model=my-model与示例未显式served-name不配套，不能当可运行模板；未测试客户端/浮动外部产品。 |
| 91 | serving/integrations/langchain.md | api-server-entry、npu-worker-lifecycle | 外部应用配置排除 | 不照搬其mandatory for HF models注释；不把外部封装依赖表列为本站引擎能力。 |
| 92 | serving/integrations/llamaindex.md | api-server-entry、npu-worker-lifecycle | 外部应用配置排除 | 外部框架整套文档不扩为本站必读范围，若未来新增应用专题再单列。 |
| 93 | serving/offline_inference.md | api-server-entry、engine-processes | 母文已读，技术承接待继续 | 先等beam教学独审；enqueue/wait需核队列生命周期与同步阻塞，cache/metrics回对应主位置，RPC/权重更新/RayData与训练任务按现有RL主位置核，不复制API目录。 |
| 94 | serving/online_serving/README.md | api-server-entry、engine-processes | 主问题已有，子链接范围未全闭合 | 部署包装/代理/运行器的技术链接单列，不认为网络拓扑全部被三个段落覆盖。 |
| 95 | serving/online_serving/generative_scoring.md | api-server-entry、sampling | 选定教学问题已承接 | 此选定评分问题已承接；未来reasoning/beam增量独立验收，pooling完整生态不混算。 |
| 96 | serving/online_serving/openai_compatible_server.md | api-server-entry、streaming-output | 主问题已有，子链接范围未全闭合 | Responses/Anthropic/audio/pooling接口兼容与各协议include仍另列，不由OpenAI兼容一词全包。 |
| 97 | serving/online_serving/renderer.md | api-server-entry、token | 精确补证已交作者 | request-renderer-coverage-evidence.json已交作者；待独立renderer教学及独审，不把母页短入口或普通serve字段表当完成部署验证。 |
| 98 | serving/online_serving/speech_to_text.md | api-server-entry、token | 母文已读，技术承接待继续 | 读取实际转写/翻译/realtime协议生成include和所需客户端例；音频Chat输入不等于ASR路由，专用speech模型接口须与通用API分开。 |
| 99 | serving/parallelism_scaling.md | pipeline-parallel、tensor-parallel、engine-processes | 选定教学问题已承接 | Ray/CUDA网络/NUMA例不视为Ascend现场验收；官方子脚本按必要场景继续。 |

本报告未更改教学页，也没有设备验收。没有把名称相同、网页可打开、机械行号有效、母文全文已读中的任一项单独作为内容通过理由。
