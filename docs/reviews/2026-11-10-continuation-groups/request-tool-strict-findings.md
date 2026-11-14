# 工具调用承接：GLM 例外与严格参数

范围是 99 母页第 84 项中与本站 GLM 主线直接关联的约束生成、模型解析器和工具 strict。母文已完整阅读；本次实际重读 quickstart 之后的模式/strict/插件章节，并沿固定四版消费者追到请求调整。没有修改教学页和总账，没有运行模型或外部 XGrammar builder。

## P2：旧 GLM 的 required/named 不是通用 JSON 约束路径

当前 structured-output.md L331 附近总述“工具选择设为 required 或指定某个函数时，把工具参数 schema 转成结构化输出约束”。本页随后让读者按 GLM 教程 FAQ 配工具解析器，这会使读者把通用规则套到旧 glm47。

固定旧上游的 glm47 继承 glm4 解析器。glm4.adjust_request 在 required/named 时明确提前返回，跳过父类设置 JSON schema，以免模型的 XML 工具格式被强制成 JSON。glm47 没有新增 get_structural_tag，继承基类 None；把严格工具环境变量改成 1 也不能凭空补出这个专属 builder。旧 Ascend GLM 补丁仅规整零参工具调用的文本区域，并没有改变请求约束生成。

建议在结构化输出主位置限制通用 parser 的表述，并说明本页旧 glm47 的例外；API 页工具部署段回链这个边界即可，不另重复定义机制。工具调用仍可被解析出来并由应用执行，但不能据 required/named 或解析成功承诺参数 schema 已被强制满足。

## 需要新增的参数连接

本站目前只解释 response_format.json_schema.strict，没有解释 tools[].function.strict。两个 strict 所在容器和消费者不同。母文“strict 无作用、auto 不约束”不能直接复制成四版通用规则。

| 固定上游 | 工具 strict 的有关路径 |
|---|---|
| 0fc695fc，GLM 旧基线 | FunctionDefinition 未显式声明 strict，协议允许额外字段；全局 VLLM_ENFORCE_STRICT_TOOL_CALLING 默认 0。通用支持者可派生结构标签，但旧 glm47 的 required/named 绕过通用 JSON，且没有自己的结构标签 builder |
| 568afb3a | strict 显式 bool/None，默认 None；环境开关默认 True。glm47 改为 parser-engine adapter，声明 glm_4_7 结构标签模型 |
| ced6857a | 同样字段与默认；先派生模型结构标签再调用工具 parser，已有结构标签不被通用 JSON 覆盖 |
| 84030bbe | 本组相关路径与 rc2 一致；这是独立固定比较点，不声称精确配套 Ascend main |

后三版仍有多个条件：解析器必须声明结构标签模型；严格工具环境开关为真；工具非空、选择不是 none。auto 还要求至少一个工具 strict=True，否则 registry 返回 None；required/named 不经过这个 auto gate。随后才委托对应模型的 builder，不能扩大成“所有 parser / 所有参数 schema 都支持”或“至少一个 true 使每个工具的参数都强制约束”。本组只静态确认 vLLM 的交接与条件，外部 builder 的精确约束能力和设备精度另按实际安装版本核验。

环境开关的解析也有差异：旧版 int 转 bool，默认字符串 0；后三版把字符串转小写，只认 true 或 1，默认 True。不要把全局开关、每个函数的 strict、enable-auto-tool-choice 三者当成同一个开关；最后一个仍控制是否接受自动工具选择请求。

33 个精确范围见 `request-tool-strict-evidence.json`。`selected-methods.json` 保存实际 AST 哈希对比，复用仅限相同的函数范围。未用“只搜索字段”代替实际阅读消费者。

## 尚未关闭第 84 项的范围

本轮没有把整页所有模型 parser 或外部模型模板算成已验收。仍需处理显式 --tool-parser-plugin 的文件导入与注册边界，以及母文链接的模型模板/技术指南的适用范围；已读母文不等于这些目标全文已读。当前工作先给出直接影响本站 GLM 主线的可修订结论，不创建整套工具应用或执行用户工具。
