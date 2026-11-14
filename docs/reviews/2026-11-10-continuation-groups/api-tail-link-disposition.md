# API 尾项关联入口的范围处置

本表是目录 94/96/98 的作者范围说明，不是“读完互联网上全部链接”。固定母文三份全文、直接生成 includes 和本任务必需客户端已读；没有把链接命中、下载或文件 SHA 当成阅读。所有数字不新增到全站全文总计。

| 母文关联入口 | 本轮实际承接 | 判断及边界 |
|---|---|---|
| 在线 README：SageMaker /invocations | 四版适配路由、生成工厂、pooling 工厂的实际分发表 | 完整解释本适配入口怎样选处理器；未展开外部 model_hosting_container_standards 的会话中间件内部或云运维 |
| 在线 README：Ray Serve LLM / DeepSeek 示例 | 四版示例完整文件；外层副本范围与 engine_kwargs 区分 | 示例身份精确相同；Ray 官网的完整集群、扩缩容与生产运维不属于本组验证，不标作已读 |
| OpenAI-compatible：Completions / Chat / Responses | 六个生成 includes 全读，三种请求/结果边界及 Responses 实际保存/历史消费者；三份直接客户端示例全读 | 旧 Chat 七步继续保留；并非把 SDK 或 OpenAI 云产品的所有字段与服务能力标成 vLLM 支持 |
| README：Anthropic Messages | 固定协议、路由、转换及响应消费者；四版基本链对照 | 正文解释内容块与转换；不声称所有 Anthropic 功能或外部客户端组合已验证 |
| README：embedding/classification/score/rerank/pooling | 任务准入工厂、协议数据结构和 encode 消费者实际读；已有 IO 插件页回链 | 关闭“接口输入输出及任务准入”解释缺口。池化模型全清单、每种 pooler 算法、reward/token task、Cohere 全协议属于其他专门主题，不在此宣称全覆盖；旁路浏览 pooling README/classify 也不计为完整图文审查 |
| speech_to_text：四个生成 includes | 转写、翻译协议各两段完整读，并追到实际文件读取、格式守卫、任务消费者 | 不把类型注释列出的 srt/vtt 当成运行支持；verbose_json 与新版 diarized_json 按模型和流式守卫限定 |
| speech_to_text：转写/翻译客户端 | 两个文件全文读 | 解释 multipart 与返回；不照搬示例额外字段就声称该字段被消费者采用，也未运行模型 |
| speech_to_text：Realtime 文件/麦克风链接 | 两个固定示例全文读、连接/协议/路由全文读，四版初始化与事件消费者核对 | 纠正 optional 模型验证注释；普通/final commit 的原函数复现已归档；未展开 Gradio 或 websockets 全库 |
| speech_to_text：旧 main 单体 protocol.py 链接 | 依固定树追到拆分的 transcription/translation/realtime protocol | 页末使用有效固定 commit、文件和行号，不继续沿旧单体行号猜测 |
| 三母文互链、renderer、多模态、sampling、serve 配置、安装/Docker、sleep、weight transfer | 按本站已存在且分别验收的页面/组承接，教学页只在实际需要处回链 | 本组不复做既有 renderer/多模态/工具/采样整页审查；这些链接不重新算本组全文阅读 |
| 支持模型表、模型使用专题、generative scoring、examples 总目录 | 用当前任务消费者限定接口准入，保留其他专题各自范围 | 没有递归展开每个模型或整个 examples 树；不存在“全部子源已读”的结论 |
| OpenAI、Cohere、Jina、Meta、Ray 外部协议/模型说明与 SDK | 识别为协议参照或外部生态；不作为新增 vLLM 功能证据 | 不扩张为外部全生态阅读，不把它们标作已验收官方全文；没有本组新增外链白名单需求 |

因此本组可供验收的是三个母文在“服务接口/包装与语音输入输出”范围内的真实缺口及必要 includes/消费者。完整模型生态或外部框架运维如另立范围，应独立建账，不能把这里的范围关闭挪作它们已完成的证明。
