# B10 常用入口补写验证

2026-11-01，B10 **13/13 已补写并验收通过**。13 个单元补入原有四页，按固定版本补齐入口、默认、优先级、错误与使用边界。独立审查无未关闭 P1/P2，最终浏览器复核见[独立报告](common-entry-independent-review.md)。本轮只改 wiki 与验证记录，没有修改产品代码或实际部署配置。

## 单元与唯一归属

| 单元 | 参数 | 主页面与补齐范围 |
|---|---|---|
| W1411 | chat_template | token：文件/文本、缺省来源与 HF fallback、请求覆盖回链、文件错误 |
| W1412 | chat_template_content_format | api-server-entry：auto/string/openai、消息形状、显式值与 main 检测差异 |
| W1413 | config | api-server-entry：YAML 文件、命令行覆盖、位置模型、false/null/空列表及错误分支 |
| W1440 | host | api-server-entry：None 定义默认、TCP 实际绑定、GLM 显式地址与客户端地址区别 |
| W1446 | port | api-server-entry：8000、整数与端口范围、0 的语义、绑定错误 |
| W1459 | trust_request_chat_template | api-server-entry：默认 false、空字符串/null、kwargs 内模板与普通变量、信任边界 |
| W1553 | dtype | quantization：auto、别名、Python 类型、平台偏好、模型与量化限制 |
| W1605 | load_format | npu-worker-lifecycle：auto 实际文件选择、注册列表、版本移除/新增、加载策略区别 |
| W1643 | model | api-server-entry：目录/仓库、通用默认、位置参数与配置覆盖、模型名校验 |
| W1670 | quantization | quantization：None 与自动识别、上游校验和 Ascend 后续探测、平台/模型条件 |
| W1686 | served_model_name | api-server-entry：单名/多别名、缺省模型路径、返回与指标首名 |
| W1699 | tokenizer | token：None 后跟随模型、独立路径、编号与权重配套 |
| W1700 | tokenizer_mode | token：auto/hf/slow、真实注册模式、三版差异与依赖限制 |

固定控制流 vLLM 0fc695fc、GLM Ascend db701c1f；另核社区 Ascend 2c59ff10、rc 568afb3a/2ed6cbba、main 84030bbe/baa023ad。教程和模型配置仍分别钉住 0576b647、690b7052。API 页原有 renderer 历史表的 main 98dff2a8 保留并明确区分，不冒充本批使用的 84030bbe。RFork、Recipe 继续保留独立来源身份。

## 独立审查与修订

新独立审查者 common_entry_independent_review 读取四页全文、真实 before/after、12 张图及官方固定源码，独立执行 **143 条实际源码 AST 分支检查**。外部模型、硬件与文件环境为受控 fixture；这不是完整 vLLM 服务或 NPU 测试。其 15 项 CLI 检索全部首位命中；并在独立后台浏览器实际阅读四页、操作跨页锚点及站内搜索。

主要修订：

- YAML false 在旧版被略过，main 仅对已注册负开关转换；不能笼统写三版相同。公开解析器先改写兼容 --model，再合并文件，不能从私有 helper 直接推断公开 CLI。
- 模板信任守卫看 is not None：空串也受保护，kwargs 模板值为 null 则不拒；普通模板变量不是整体禁止。
- main 显式内容格式仍执行检测并可告警，最终保持显式值；基线/rc 直接返回显式值。
- dtype auto 按实际平台支持顺序与架构约束选择，不照抄“FP32 必转 FP16”的简化帮助。
- 量化方法冲突先可能被上游拒绝；Ascend 的后续 warning 不能覆盖此前错误。改 FLOAT 标签不能恢复真实浮点权重。
- 修正初稿中 quantization_config 被误说成 main 新增、模板来源索引错误及两处引用末行越界。
- 保留硬件页已有 Host 别名；启动地址使用 frontend.host、--host、监听地址，消除歧义和 lint 冲突。
- 浏览器发现三张旧版本表超宽，缩短首列或将长路径移到表前正文；文件匹配模式的星号转义，避免被 Markdown 当成强调而丢失。

## 本轮实际验证

| 验证 | 结果 |
|---|---|
| wiki:build | 167 页索引生成 |
| check:content（最终） | 167 页正文、11 个主题完整且无重复 |
| wiki:lint（最终） | 通过；8 条其他页既有非阻塞提醒 |
| wiki:diagrams --check | 331 张图与 spec 一致；本轮 12 张图未修改 |
| wiki:audit（最终） | 强制名单 104/104；4962 条来源、4697 条行号有效；无无效 commit、缺文件、越界 |
| tsc -b | 退出码 0，无诊断输出 |
| vite build（最终独立预览） | 退出码 0，42.87 s |
| 独立源码分支 | 143/143 |
| 作者 CLI 检索 | 24/24 首位 exact 命中，覆盖 13 单元及中英文别名 |
| 作者站内 UI 检索 | 24/24 找到并点击进入对应主页面；host 用完整 --host 验证 |
| 独立 CLI 检索 | 15/15 首位命中 |
| 浏览器布局 | 四页共 27 张表均不超过 961 px 正文宽度；最终三张版本表均 961 px |
| git diff --check | 本轮四页及进度报告无空白错误；新报告另检查本地 Markdown 链接与行尾 |

审计未联网验证 265 条 URL，1671 条 raw 摘录仍列全库待核；本轮参数结论另据官方固定源码下载与独立核读。第一次 lint 因新 host 与旧 Host 别名冲突失败，修订后最终通过；初稿引用越界已在最终审计前修正。构建有现有工具链提醒，未阻止产物生成。检索验证证明页面可达，不是生成式问答正确率评测。

浏览器使用 http://127.0.0.1:5202 的最终静态产物。作者 23 张截图覆盖四页首屏/第二屏、新入口表、YAML、BPE 与量化演算、修订后的版本表和文件匹配模式；独立审查者另行操作其自己的标签。API↔Token、量化↔Worker 两组回链均由作者或独立审查者实际点击验证，分工详见独立报告。截图 17/18/20 是最终版本表，19 是修正后的通配符；此前截图属于过程证据。

## 保留性与写作标准

证据目录：tools/wiki-runtime/common-entry-20261101/，含写前清单、四页 before、12 图快照、官方来源与哈希、独立源码 fixture、命令日志、24 项检索、布局数据和截图。原有 10 个 calc 与 12 张图保留；API 七步/长度算例、Token BPE/词表/模板示例、量化分层与专家账、Worker 六步/读盘与显存假设、所有误解和待核均保留。Worker 机器审计尾注逐字未改。

| 页面 | 旧→新来源数 | 教学区行内代码/千汉 | 全文行内代码/千汉 | 全文角标 / C 类 |
|---|---|---|---|---|
| api-server-entry | 85→103 | 0 | 7.33 | 0 / 0 |
| token | 26→36 | 1.68 | 4.16 | 26 / 16 |
| quantization | 24→36 | 1.17 | 2.97 | 29 / 23 |
| npu-worker-lifecycle | 29→38 | 0 | 20.12 | 30 / 22 |

口径：排除 frontmatter、围栏和机器尾注，按 U+4E00–U+9FFF 汉字计数。教学区指对照源码之前，四页证据角标均为 0，首图前均无 calc。Worker 全文包含密集的既有源码调用表，全文仍超过 13/千汉；教学正文为 0，不将二者混称。项目审计另用汉字加拉丁单词口径，最终强制规则通过。旧 sources 前缀与 aliases 全部保留；五个源码区 H3 顺序不变。

## 边界与后续

尚无生产镜像安装信息、真实 NPU 执行、GLM 量化描述文件与 tokenizer 实际编码结果；加载耗时、峰值显存、量化质量和双机性能保持待核。未把静态源码或受控分支冒充现场实测。

B10 验收后，A 批 11/11、B 批 89/89，累计 **100 个优先补写单元**。这只是 A/B 范围完成；历史全量计划中的 C 989 与 D 623 单元仍属后续场景工作，不宣称整个参数知识库全部补齐。历史缺口台账保留原统计。待用户决定事项：无。
