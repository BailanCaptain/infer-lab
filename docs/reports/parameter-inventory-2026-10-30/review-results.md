# vLLM 与 vLLM Ascend 参数收录续审结果

知识库确实缺参数参考，但不能把上一轮的 4,640 条源码命中当成 4,640 个公开参数。续审按定义所属入口、源码角色和当前已发布正文，分别列出未收录、没讲全、参考要素基本齐备、非本轮用户参数、同源重复。知识库正文未改。

最需要先纠正的是上一轮的版本判断：**有些参数在旧版用字典读取，在 main 才改成类型字段，不能据此说参数只在 main 存在。** 下文已合并核对这两种证据。

## 结果与查阅入口

| 判定 | vLLM 定义记录 | Ascend 定义记录 | 合计 | 逐项清单 |
|---|---:|---:|---:|---|
| 未收录该参数入口的说明 | 1,971 | 181 | 2,152 | [未收录](review-missing.md) |
| 已有说明，但参数参考没讲全 | 569 | 259 | 828 | [没讲全及缺项](review-incomplete.md) |
| 本轮参数参考要素基本齐备 | 3 | 42 | 45 | [已有覆盖](review-covered.md) |
| 内部派生、输出结构、模型/量化描述，单列不计缺口 | 867 | 285 | 1,152 | [范围排除及理由](review-excluded.md) |
| 同一源码定义被多种扫描器重复提取，或同名环境变量重复读取 | 346 | 117 | 463 | [全量台账的 duplicateOf](review-ledger.json) |
| 合计 | 3,756 | 884 | 4,640 | 每条原记录有 ID、判定、理由和来源 |

这里统计的是**定义记录，不是去重后的公开参数数，也不是漏项率**。例如 EngineArgs、CacheConfig 和 CLI 可以表达同一选项；不同 API 的同名字段也可能默认值不同。只合并能证实同源的重复记录，不为了凑一个“参数总数”把不同入口抹掉。环境变量、工具参数、传输协议和模型附加配置在台账的 `domain` 中分开。

表中的“存在版本”是**该行定义/读取点**出现的版本，不能把一行没有列旧版理解成整个参数在旧版不存在。类型字段与旧版字典读取的完整证据共同保存在台账；下文九项的版本结论已经跨类别合并。

## 请求参数的明确结论

采样与池化清单的 69 个定义中，34 项已有内容但参考不全，24 项没有对应入口说明，11 项属于内部字段。具体例子如下。

| 归类 | 参数 | 缺什么 / 判定边界 |
|---|---|---|
| 没讲全 | `presence_penalty`、`frequency_penalty`、`repetition_penalty` | [采样页](../../../wiki/concepts/sampling.md)已讲机制和算例；缺逐项默认、合法范围、负值或小于 1 的含义、请求例子和版本说明。不能说罚分机制完全没写。 |
| 没讲全 | `allowed_token_ids`、`bad_words` | 采样页用中文讲过允许编号清单、屏蔽词串；缺可定位的参数键、类型、分词/边界规则和请求写法。 |
| 没讲全 | `logprobs`、`prompt_logprobs`、`logit_bias` | 有概率或分数机制；缺数量/特殊值、接口差异、返回格式或 token ID 映射及完整例子。 |
| 没讲全 | `temperature` | 已讲计算与 v0.23/v0.26 检查；采样页版本表仍明确写 main 上游温度限制未单独核对。 |
| 没讲全 | `max_tokens`、`seed`、`n`、`output_kind` | 已讲输出预算、随机数、多个回答、增量/完整输出；缺不同入口的默认与约束对照。尤其不能把 SamplingParams 的 `max_tokens=16` 当成 Chat 请求缺省输出上限。 |
| 没讲全 | `skip_reading_prefix_cache`、`repetition_detection` | 已有跳过缓存/重复判停机制；缺请求入口及默认推导，重复检测还缺子字段解释。 |
| 未收录参数说明 | `spaces_between_special_tokens`、`logprob_token_ids`、`flat_logprobs`、`thinking_token_budget`、`routed_experts_prompt_start`、`extra_args` | 三个固定 vLLM 快照均提取到定义，但没有对应参数参考。相关大功能存在不等于这些字段已解释。 |
| 未收录参数说明 | `trace_decode_token_ids`、`watermarking` | 本清单仅固定 main 有；不能写成 v0.23 的可用请求参数。 |
| 未收录子字段说明 | `RepetitionDetectionParams.min_pattern_size/max_pattern_size/min_count` | 父功能已有提及，三个阈值字段本身未形成说明。 |
| 未收录子字段说明 | `StructuredOutputsParams.disable_additional_properties/whitespace_pattern` | 结构化输出已有教学，两个子字段参考缺失。 |
| 未收录该入口 | `BeamSearchParams` 的 7 个字段、PoolingParams 的 `dimensions/use_activation/step_tag_id/returned_token_ids` | Sampling/普通生成请求的同名说明不能直接认证 beam search 或池化 API。BeamSearch 的 `structured_outputs` 仅 v0.26/main 提取到。 |
| 不计普通调参缺口 | `SamplingParams.skip_clone/output_text_buffer_length`；PoolingParams 内部字段及 LateInteractionParams | 源码明确的内部标记、初始化派生或接口间中间结构；不应补成普通用户调参教程。 |

请求层的 Chat、Completion、Responses、Anthropic、Cohere、语音、池化与 token 输入接口在逐项表中保留身份。已有 Chat 用法不自动算其他兼容接口已收录；请求里的同名字段也不直接继承 SamplingParams 的类型和默认值。

## Ascend 九个缺口的正确版本范围

这些名称缺少参数参考的结论保留；“全部只在 main 有”的旧结论撤回。以下是定义和读取点的存在性，不是某个模型/硬件上的运行支持认证。

| 路径（均位于 additional_config） | GLM | v0.23 | v0.26rc | 固定 main | 应补内容 |
|---|---|---|---|---|---|
| `ascend_log_path` | 有 | 有 | 有 | 有 | 日志目录、默认路径推导、使用位置 |
| `dump_config_path` | 有 | 有 | 有 | 有 | msprobe 配置文件路径，与 `dump_config` 的关系和校验；不是泛指导出引擎配置 |
| `mega_moe_max_tokens` | 有 | 有 | 有 | 有 | 接收 token 上限、默认 65536、缓冲区/溢出影响 |
| `multistream_dsv4_dsa_overlap` | 有 | 有 | 有 | 有 | 默认 True、模型与执行路径限制 |
| `draft_window_size` | 未检出 | 未检出 | 有 | 有 | 草稿模型窗口、None、读取位置及版本 |
| `mc2_comm_alg` | 未检出 | 未检出 | 有 | 有 | 空字符串默认、合法算法、版本差异和硬件条件 |
| `mlapo_keep_prefill_weights` | 未检出 | 未检出 | 未检出 | 有 | False、保留权重的内存代价与本地 prefill/回退关系 |
| `ascend_fusion_config.fusion_ops_gmmswigluquant` | 未检出 | 未检出 | 未检出 | 有 | 嵌套入口、True、融合对象和前提 |
| `dynamic_spec_config.method_params` | 未检出 | 未检出 | 未检出 | 有 | 按 method 分别说明子键，不能把开放字典当一个标量 |

旧版证据示例：`ascend_log_path` 在 GLM/v0.23 的 `ascend_config.py:100`、v0.26rc 的 `:125`；`mega_moe_max_tokens` 在 `:306/:306/:336`；`draft_window_size` 在 v0.26rc 的 `spec_decode/llm_base_proposer.py:507`；`mc2_comm_alg` 在 v0.26rc 的 `ascend_config.py:306`。完整提交与相应表达式在 [台账](review-ledger.json)；[固定 main 配置源码](https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/vllm_ascend/ascend_config.py)只能证明 main，不能代替旧版读取点。

此外，连接器的 TLS、Yuanrong 后端 JSON、传输批次上限、ScoreEncoderCache 的 manager_config 等入口也有缺口，全部保留在未收录表。环境注册项中，构建参数 `MAX_JOBS` 不能算作调度器 `max_jobs` 已讲过；本轮已改用区分大小写的环境变量匹配。

## 已有页面仍然没讲全的具体问题

| 位置 | 结论 | 需要补齐或修正 |
|---|---|---|
| [combine_quant_mode](../../../wiki/params/combine-quant-mode-2a3f7cd47997.md) | 没讲全 | 白名单含 3，但正文明确没有模式 3 的通信格式、算子与软硬件适用范围。配置接受一个数不等于算子支持该组合。 |
| [c8_enable_reshape_optim](../../../wiki/params/c8-enable-reshape-optim-8bd7e5f82c6c.md) | 有版本口径冲突 | 正文说固定 main 已恢复，自动谱系 main 行写“无”，生成区又是 ac1b7bce；需要清楚区分它与本轮 baa023ad。GLM main 是否保留拦截仍写待核。 |
| [sleep cleanup](../../../wiki/params/enable-sleep-mode-extra-cleanup.md) | 没讲全 | 已说明 main 迁到 rl_config 及 enabled 前提，初始化/平台改写顺序仍有待核；不能把旧顶层开关直接套过去。 |
| [use_layerwise](../../../wiki/params/use-layerwise-b475778cd352.md) | 必须按连接器拆开 | AscendStore/Yuanrong 的路径与 False 已讲较全；SFA RD2H 的 True、v0.26 起存在已讲，但其单独用例/关闭行为仍不足。vLLM LMCache 的同名入口不能用这页的 AscendStore 说明替代。 |
| [fuse_allreduce_rms](../../../wiki/params/fuse-allreduce-rms.md) | Ascend 专页不能覆盖上游同名字段 | Ascend 的嵌套路径、真实默认与版本已讲；vLLM `PassConfig.fuse_allreduce_rms` 是另一个身份，原来的“专页已覆盖”匹配错误。 |
| [采样](../../../wiki/concepts/sampling.md)、[Ascend 配置系统](../../../wiki/concepts/ascend-config-system.md) | 机制已有，逐项参考不完整 | 两页分别保留 main 温度限制、main 子配置构成/默认未逐项核的说明；泛化版本表不能认证所有字段。 |

`enable_async_exponential`、Ascend `enable_matmul_allreduce`、`layer_sharding`、`multistream_overlap_gate`、权重预取/比例、CPP 的默认/阈值/迁移、CPU 绑核等已有较完整参考，列在“参考要素基本齐备”。这个判定不要求编造硬件收益或把页面中的实测待核改成已测。

## 动态 CLI 线索的结论

原始 `dynamicCli` 共 18 条，已按调用角色处理，见 [逐条结果](review-dynamic-cli.md)：

- 6 条 `super().add_argument(*args, **kwargs)`：解析器包装，不声明新参数。
- 3 条 Frontend 循环注册：`get_kwargs(cls)` 取得已有字段，生成下划线转连字符的长选项；与已盘点 Frontend 字段对应，不另算一组未知参数。
- 3 条 `model_tag`：serve 的模型位置参数；已有启动模型示例，但位置参数和配置文件/model 参数之间的完整优先级说明不足。
- 6 条 `EXPERIMENT_DIR`：两种基准结果绘图工具的位置参数，各三个版本；未收录工具用法。

## 审查口径、证据与限制

本轮是**参数参考收录审查**。未收录表示找不到对应入口/语义的可定位参数说明，不表示整项机制完全没提过。没讲全表示已有内容尚不足以作为该入口的完整参考：作用、路径、缺省/覆盖、合法值、例子、限制、固定版本对照应当能连起来；不用每个字段单开一页。

方法是全量静态对账、源码角色过滤、同名消歧，以及对专页、机制中文描述和已发现的关键缺项作内容核读；不是把关键词命中自动认证为讲全。批量项的理由指出缺少的是该入口的完整参数参考，具体定义默认值仍列在 JSON 中，不能据此假装已追完每个参数的运行时消费链。`review-decisions.json` 保存显式内容判定，`review.py` 保存过滤、身份与保守判定规则，便于复核；台账保存实际正文证据。

范围固定为上一轮七份源码快照和 registry 的 161 篇已发布 concept/feature/param 正文，main 不是今天最新分支。排除草稿、raw、来源定位行和“已废弃的说法”尾注，不把检索别名或源码链接当作解释。旧报告之后有 11 页更新，本轮按当前正文重新对账并记录 SHA-256。

外部 SDK 继承字段、第三方插件内部选项、任意开放字典的无限自定义键、CANN/HCCL 全集及非 Python 库不是这 4,640 条既有待核清单的一部分；因此不能称这是所有可能安装组合的参数全集。硬件功能支持与性能不是本次验收内容。

验证见 [验证记录](review-validation.json)：4,640 个 ID 恰好覆盖原表；每项有分类、理由和固定源码来源；重复指向有效；18 条动态 CLI 都有处理结论；报告引用文件存在；161 篇正文审查前后哈希一致。本轮仅修改盘点目录，未改知识库正文、前端或服务代码，无需运行前端构建/浏览器验收。无待用户决定事项。
