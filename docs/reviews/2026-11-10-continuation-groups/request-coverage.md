# 请求主题的官方覆盖：当前去向与仍需处理的主题

本记录从官方材料反查学习问题，与引文批次分开。`request-official-reading.json` 最初列出固定上游四个相关目录的99份Markdown；后续独审已给99份母文建立全文证据（73本次读、26同哈希历史复用），见 `request-coverage-independent.json`。这仍不是全部技术承接目标通过的声明，包含文件、图示、技术外链和适用性另列。根执行者原先选出的11份母文及六处内嵌协议片段，见 `request-embedded-reading.json`；其他独审阅读另有记录，不重复记为根阅读或全局新增篇数。

| 官方材料与学习问题 | 本轮落实或已有主位置 | 当前覆盖状态 |
|---|---|---|
| serve_args、online_serving README、OpenAI兼容服务：请求进入哪里、参数怎样落到引擎 | API入口的字段、长度预算、模板、日志、发送前登记及四版表；流式页的返回路径 | 本轮修订与所列引文已验收；这些母页的全部技术链接仍需逐项归属 |
| renderer：模板/分词与生成怎样分工 | API入口四版renderer路径与向量输入模板职责 | 当前讲解已补；独立renderer部署组合需随官方覆盖继续判断适用范围 |
| prompt_embeds：调用方算好向量后怎么传 | API入口新节区分Chat内容向量、Completion完整输入、多模态嵌入；补形状、类型、稠密化预算和旧版边界 | 已补并独审；未宣称设备兼容性/端到端测试通过 |
| reasoning_outputs、interleaved thinking：解析思考与限制思考是否一回事 | 流式页解释字段解析；sampling解释预算、结束串、提示词历史及真实执行链 | 本轮预算与返回修订已验收；rc2的include_reasoning、reasoning_effort模板合并等关联差异继续核去向 |
| tool_calling：auto/required/named/none怎样进入和结束 | API入口补parser守卫、tools保留/排除；流式页补named收尾分支，应用执行工具的职责保留 | 本轮发现已修；各模型解析器说明及相关示例仍按范围检查，不由母文全文推成全部子链接通过 |
| structured_outputs：约束与最少长度叠加 | 现有结构化输出页；sampling补rc2/main恢复停止编号例外并回链 | 本轮采样组合条件已补；结构化输出的官方主题覆盖仍需与既有组记录对齐 |
| custom_arguments、custom_logitsprocs、logits_processors设计：怎样接入自定义改分规则 | sampling新增批级处理、装入入口、vllm_xargs→extra_args、批次移除/增加/移动及开销说明 | 所列教学缺口已独审、浏览器及五项检查验收，31新增来源见sampling-custom-acceptance.json；投机、MRV2与插件条件均列四版边界，技术子链接仍随目录跟进 |
| multimodal_inputs：媒体输入、预计算模态特征、UUID缓存与加载参数 | API入口新增占位例子、三类缓存、UUID、嵌入布局、超时/恢复和音视频处理，并连到PD/EC及UCM | 所列教学缺口已独审、浏览器及五项检查验收，62新增来源见request-mm-checkpoint.json；四个承接示例另有全文记录，模型指南与技术子目标继续，不由母文推定全部兼容 |
| generative_models：不同生成接口与模型支持范围 | 入口页保留非生成接口边界；具体模型、beam/scoring等主题需归到相应页或注明适用范围 | 继续对照现有覆盖，不能用一张模型列表推成所有模型兼容性已验证 |

本阶段已经实际关闭的来源记录为API/stream旧186、新97，sampling旧180、新67。它们证明当前修订与所列主张经过核验，不代表上表所有官方主题与关联材料都已完成。后续按原计划先处理已发现P1/P2和活动旧队列，同时完成这些覆盖增量、其他目录归属、外部缺图与跨页学习任务。

采样论文《The Curious Case of Neural Text Degeneration》现已阅读全文及全部13图；HTML缺的五图由同版本PDF实际渲染查看补齐。论文只计一份，详见独审阅读记录。六篇既有论文的SVG/表格/算法框等外部尾项后来已逐项完成本次声明范围的视觉阅读，见external-tail-review.md；DeepSeek生产文章的三处原图仍独立追踪。
