# 人工核读的优先缺口

本文件是首轮优先项记录；续审的全量分类、同名消歧和版本纠正见 [续审结果](review-results.md)。

以下判断对照已发布页面实际正文与固定上游定义。表中“缺”描述的是知识库参数说明的缺失，不表示引擎不支持。逐版本定义和静态默认值见同目录 inventory.json；表中源码只用于证明字段存在，调用支持范围仍须在补写时追踪消费路径。

## 已有机制但没有完整参数说明

| 参数 | 已有正文证据 | 需要补齐 |
|---|---|---|
| presence_penalty | sampling.md 241–243 行，说明只看输出是否出现，还给了 1.5 的算例 | 精确参数名、数值默认值、合法范围、负值意义、JSON/Python 请求示例、逐版本行为 |
| frequency_penalty | sampling.md 241 行，说明按输出次数扣分 | 默认值、范围、负值意义、与 presence 的同组数值对照、请求示例和版本边界 |
| repetition_penalty | sampling.md 241 行，说明 prompt/output 范围及正负 logits 乘除 | 中性值与小于 1 的含义、合法范围、配置来源与请求覆盖关系、使用示例和逐版本限制 |
| allowed_token_ids | sampling.md 238 行，用中文说明允许编号清单，未写出参数名 | 名称、类型、空清单/非法编号行为、请求入口与示例、和结构化输出的关系 |
| bad_words | sampling.md 238 行，用中文说明屏蔽词串；源码文件名出现不算参数说明 | 名称、字符串如何分词、词串与单 token 的区别、示例、边界与版本 |
| repetition_detection | request-teardown.md 141、286 行，说明重复检测可判停 | 配置结构、各子字段、默认关闭条件、阈值和窗口例子、与三种 penalty 的区别、版本支持 |
| prompt_logprobs | prefill.md 247 行、prefix-caching.md 91 行、vllm-ascend-for-rl.md 143、206 行 | 返回数量与特殊值、返回结构、接口限制和完整示例、缓存相互作用按版本汇总 |
| logit_bias | sampling.md 240 行，说明给指定编号加分 | 合法范围和处理规则、token ID 映射、请求示例、与 penalty/过滤顺序的完整对照 |

以上是具体缺口，不是“这几页都没用”。temperature、top-k、top-p、停止条件等已经有较多教学内容，后续应保留机制讲解并补参数参考入口。

## 优先核实并补写的无名称条目

以下条目在第一次人工检索中没有找到对应名称的发布正文说明；最终静态命中以明细表为准。存在机制的纯中文描述仍可能需要进一步排查，故不把它们直接认证为“完全没有任何相关知识”。

| 参数 | 需要形成的参考说明 |
|---|---|
| spaces_between_special_tokens | 特殊 token 之间是否加空格、默认值、与 skip_special_tokens 的关系和适用输出路径 |
| logprob_token_ids | 指定返回哪些 token 的 logprob、与 logprobs 的关系、接口支持和例子 |
| flat_logprobs | 返回结构改变、消费端兼容性、暴露入口和适用版本 |
| thinking_token_budget | 思考预算的意义、支持的模型/处理路径、与最大输出长度的关系 |
| routed_experts_prompt_start | 路由数据的 prompt 起点、依赖开关和多轮使用方式 |
| skip_reading_prefix_cache | 请求级跳过读取的含义、缺省推导与 prompt_logprobs 的关系；知识页已有“跳过缓存读取”的机制，参数入口仍缺 |

这份清单按源码身份区分请求、引擎和接口层。同名字段不能直接照抄另一层默认值；例如 SamplingParams 的 max_tokens 默认表达式不能直接当作 Chat 请求的最终输出预算。

另外两项虽然出现在静态“未检出名称”表里，但不应当作普通使用者漏项：`SamplingParams.skip_clone` 的源码明确标为内部标记；`output_text_buffer_length` 上方明确说不是输入，由初始化过程设定。原始表保留它们以便检查提取边界，本轮不建议补成用户调参教程。

## 已有专页不应误列为完全未收录

例如 enable_matmul_allreduce 的专页实际解释了默认值、TP 前提、环境变量优先级、GLM 部署未开启，以及 v0.26/main 删除后的不同处理。后续盘点应按页面实际内容核对各项，而不是仅因它不在一个总表里便要求重写。

## Ascend 配置与环境变量的明确名称缺口

对发布 concept/feature/param 正文再用精确名称逐项搜索，下面九个 Ascend 配置名没有命中。**续审纠正：原报告把类型字段只在 main 声明误写成参数仅在 main 存在，漏掉了旧版字典读取。** `ascend_log_path`、`dump_config_path`、`mega_moe_max_tokens`、`multistream_dsv4_dsa_overlap` 四个快照都有；`draft_window_size`、`mc2_comm_alg` 在 v0.26rc 和 main 有；其余三个仅在固定 main 检出。完整定义、读取点与行号见 `review-ledger.json`，不能按“Ascend 配置”这一种扫描类别推断版本存在范围。

| 配置路径 | main 定义位置 | 待补内容 |
|---|---|---|
| additional_config.ascend_log_path | ascend_config.py:484 | 路径用途、默认表达式、创建与权限要求 |
| additional_config.draft_window_size | ascend_config.py:469 | 草拟窗口含义、None 的行为、与投机配置的关系 |
| additional_config.dump_config_path | ascend_config.py:487 | msprobe 配置文件路径、与 dump_config 的互斥关系及校验；不是泛指导出引擎配置 |
| additional_config.mc2_comm_alg | ascend_config.py:488 | 可选算法、空字符串意义及硬件限制 |
| additional_config.mega_moe_max_tokens | ascend_config.py:483 | token 上限作用位置、默认 65536 的条件及内存代价 |
| additional_config.mlapo_keep_prefill_weights | ascend_config.py:498 | 权重保留目的、默认 False、内存与执行路径影响 |
| additional_config.multistream_dsv4_dsa_overlap | ascend_config.py:459 | 模型限制、默认 True 与实际生效条件 |
| additional_config.ascend_fusion_config.fusion_ops_gmmswigluquant | ascend_config.py:172 | 子配置路径、融合对象、量化及硬件前提 |
| additional_config.dynamic_spec_config.method_params | ascend_config.py:1128 | 各 method 的合法子键与默认值；开放字典不能写成固定单一标量 |

定义出处：[Ascend main 配置源码](https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/vllm_ascend/ascend_config.py)。以上定义存在和默认表达式已核；功能解释列是补写任务，不是本次已经完成的行为认证。

环境注册表中也有未检出正文名称的条目：

- 四个 Ascend 快照都有：ASCEND_HOME_PATH、CMAKE_BUILD_TYPE、CXX_COMPILER、C_COMPILER、HCCL_SO_PATH、SOC_VERSION、VERBOSE、VLLM_ASCEND_ENABLE_BATCH_MEMCPY。
- 仅 v0.26rc 快照有：VLLM_ASCEND_MLA_FIA_SPLIT。
- 仅 main 快照有：VLLM_ASCEND_KVPOOL_RANGE_DEBUG、VLLM_ASCEND_ROPE_UB_SIZE_KB。

其中编译器、构建类型与芯片编译目标应归入构建参数，不与在线请求调参混排。KVPool 已有相关概念/配置页面，环境入口的精确名称缺失不等于整个功能没收录。各项的定义默认表达式与源码位置在 inventory.json 中 kind 为“环境变量注册”的记录里。

## 核读来源

- [Sampling](../../../wiki/concepts/sampling.md)，尤其罚分、配置来源及怎么开部分。
- [请求收尾](../../../wiki/concepts/request-teardown.md)，重复检测判停与请求入口。
- [Prefill](../../../wiki/concepts/prefill.md)、[Prefix caching](../../../wiki/concepts/prefix-caching.md)、[RL](../../../wiki/concepts/vllm-ascend-for-rl.md)，提示词概率记录的散落说明。
- [Ascend 配置系统](../../../wiki/concepts/ascend-config-system.md)，嵌套路径、覆盖优先级和版本解析方式。
- [enable_matmul_allreduce](../../../wiki/params/enable-matmul-allreduce.md)，已有参数参考的具体例子。
- [固定 vLLM v0.23 SamplingParams](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/sampling_params.py#L201)，与其他两个 vLLM 快照的逐字段定义保存在 inventory.json。
