# 工具插件与模板：第 84 项的关联入口承接

作者：`queue_final_review`。这是事实核对与教学补充的范围记录，不是全库、全部模型或设备运行的完成声明。未修改总账，未增加官方全文总数。

## 固定消费者

固定上游 `0fc695fc / 568afb3a / ced6857a / 84030bbe` 的管理器、导入 helper、CLI 默认和两处启动消费者已读。精确范围与独立取回的 SHA 在 `.tmp/continuation-groups-2026-11-10/structured-author/plugin/{consumer-ranges,extra-helper,startup-consumers,source-bindings}.json`。相同范围以内容 SHA 绑定复用；差异处读完整非空 diff，不用同名函数假定相同。

旧两版把 plugin 字符串当文件；rc2/main 先尝试模块导入，ModuleNotFoundError 时再尝试文件。文件导入执行模块，注册后再按名字选择解析器。显式 module=Class 与装饰器的延迟注册分开解释；错误日志、注册名校验、模板错误各归对应层。实际文法构造依然由 structured-output 唯一讲解，插件不提供自动保证。

教学主位置：`api-server-entry.md` 的“工具模板、解析器和插件，分别接在哪一侧？”，并补齐怎么开、错误、四版表、源码位置。structured-output 回链该位置；API 回链工具 strict 的唯一解释。没有新增空白骨架页。

## 母文与模板文件

固定 `0fc695fc:docs/features/tool_calling.md` 570 行已完整阅读；第 1–494、495–507、508–570 行的读取覆盖完整。第一次控制台遇特殊字符编码错误后，495 起使用 UTF-8 重新读取。模板不是只查标题或存在性：18 个显式模板共 1887 行均逐行阅读，完整文件 SHA 与行数见 `plugin/template-inventory.json`。

| 固定模板 | 实际读到的格式与限制 | 本站承接 |
|---|---|---|
| Apertus，384 行 | system/developer 与 assistant 区分；工具定义、调用、结果各有标记；校验消息与 block 类型 | 支持“须覆盖完整工具生命周期”，不推荐给 GLM |
| DeepSeek R1，92 行；V3，96 行 | 写 function 类型、名称、JSON 围栏及调用/结果边界；R1 另移除历史思考 | API 对照 V3/V3.1 的格式不可互换 |
| DeepSeek V3.1，91 行 | 不沿用上述函数类型及围栏组合；thinking 和生成起始标记也不同 | 不以模型名称相似推断模板可替换 |
| FunctionGemma，54 行 | 工具定义在 system/developer 分支；调用用 start/end_function_call 与 escape | 作为专用模板证据；未声称该固定示例等于最新官方训练格式 |
| Granite，40 行；Granite 20B FC，130 行 | 前者 available_tools/tool_call JSON 列表；后者 function_call_library 与函数描述宏 | 同一品牌不同模板格式，不能拿它们作为 GLM 部署命令 |
| InternLM2，60 行 | plugin/action 标记与 environment 工具结果；角色校验 | 完整生命周期需要输入模板和输出 parser 配套 |
| Llama 3.1 JSON，120 行；3.2 JSON，133 行 | 历史 tool_calls 必须恰好 1；3.2 另处理图片内容块 | API 正文和错误段明确单调用限制是这两份固定文件的条件 |
| Llama 3.2 Pythonic，98 行；Llama 4 Pythonic，111 行 | 按列表迭代多个调用；不同消息标记与参数字符串渲染 | 不把 JSON 模板的单调用拒绝扩成整个 Llama 家族 |
| MiniMax M1，91 行 | tool_calls XML 包围的逐个 JSON 对象；tools/results 的特定角色格式 | 不套用到其他 MiniMax 或 GLM 版本 |
| Mistral，86 行；Mistral parallel，93 行 | ID 存在且至少 9 字符、截末 9；parallel 另加提示指导，不能由提示推断硬保证 | API 正文及错误段解释长度检查，明确代码未逐字符检查 alphanumeric |
| ToolACE，65 行 | Pythonic 列表与 ipython 工具结果；固定 assistant 生成头 | 配套格式边界，不等同任意 parser |
| xLAM Llama，77 行；xLAM Qwen，66 行 | 都用 JSON 调用数组，外层角色标记不同 | 模型继承关系不能代替模板核对 |

## 母文指向的外部入口

以下均实际打开或沿明确技术入口继续读取。只记录实际范围，不把阅读片段、元数据或访问失败记为全文完成；不沿主页无限递归，也不把包首页当整库审查。

| 外部入口 | 本轮实际范围与判断 |
|---|---|
| [OpenAI strict mode](https://platform.openai.com/docs/guides/function-calling?api-mode=chat#strict-mode) | 实际可跳转到 developers 文档；只作协议背景入口，不以 OpenAI 行为证明 vLLM 实现，未记全文 |
| [vLLM issue 15526](https://github.com/vllm-project/vllm/issues/15526) 与 [16313](https://github.com/vllm-project/vllm/issues/16313) | 读问题描述和状态；一个是旧 strict 字段问题，一个是工具与结构化输出组合请求。历史问题及开闭状态都不能代替四版消费者，未记全文讨论串 |
| [Transformers chat templates](https://huggingface.co/docs/transformers/main/en/chat_templating#why-do-some-models-have-multiple-templates) | 旧锚点对应段已不在当前 main。实际读普通模板、控制 token 和生成起点，另查 writing 页面；不保留旧锚点作为定义证据，模型文件与本站 token 页承接实际模板选择 |
| [Hermes tokenizer_config](https://huggingface.co/NousResearch/Hermes-2-Pro-Llama-3-8B/blob/main/tokenizer_config.json) | 实际读完整 chat_template 字段的 default/tool_use 两个模板，未逐行阅读所有 added token 元数据；证明可有专用工具模板，不外推其可用于 GLM |
| [mistral-common](https://github.com/mistralai/mistral-common) | 打开并读用途/预处理职责；这是独立 tokenizer/规范化库入口，不是对整个库的全文核验。本站具体编号规则以固定 vLLM 模板实际代码为准 |
| [Llama 3.1 格式](https://llama.meta.com/docs/model-cards-and-prompt-formats/llama3_1/#json-based-tool-calling) 与 [Llama 4 格式](https://www.llama.com/docs/model-cards-and-prompt-formats/llama4/) | 两个网页重定向到 developer.meta 后工具不可访问，未记已读；本次格式结论使用已完整读取的固定 vLLM 示例模板，不伪称与当前 Meta 网页逐句等价 |
| [Llama 3.2 prompt format](https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/text_prompt_format.md#zero-shot-function-calling) | 实读 zero-shot 与 user-message 两节：1B/3B instruct 的 Pythonic 多调用格式，支持区分具体模型格式；未把 Code Interpreter 等未读部分记为全文 |
| [Granite 论文](https://arxiv.org/abs/2407.00121) | 实读摘要与研究范围；训练任务和评测背景不证明 vLLM/Ascend 命令、解析器或 strict 支持，未记论文全文 |
| [Qwen Function Calling](https://qwen.readthedocs.io/en/latest/framework/function_call.html#vllm) | 实读功能定义和完整 vLLM 小节及局限：Qwen3 自带 Hermes 工具模板、解析后由应用执行/回填、可能有不合格式输出。教程命令是它的模型示例，不移植其 reasoning parser 到 GLM，未记整页 Qwen-Agent 部分全文 |
| [Command A Reasoning](https://huggingface.co/CohereLabs/command-a-reasoning-08-2025) 与 [cohere-melody](https://pypi.org/project/cohere-melody/) | 实读模型工具用法/回填、包的模板与解析用途；模型文件另有访问条件，未申请访问。模型支持与外部依赖是单独条件，未声称该库全文/Ascend 部署已核 |
| [FunctionGemma](https://ai.google.dev/gemma/docs/functiongemma) → [格式与实践](https://ai.google.dev/gemma/docs/functiongemma/formatting-and-best-practices) | 实读模型定位，以及控制 token、string escape 和单轮/并行训练、多步/多轮限制；不能把母文示例的模板或成功导入 parser 变成任意任务准确性保证，未记后续所有训练指南全文 |

结论限定：第 84 项对本站入口页造成的插件加载、注册、模板配套与错误边界缺口已补齐；与 strict 相关的机制 P2 由同组 structured-output 修复。母文所有外部项目、讨论、论文全文和模型运行没有被冒充为本次完成范围。独立审查仍须核本组最终文件与证据。
