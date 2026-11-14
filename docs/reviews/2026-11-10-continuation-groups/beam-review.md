# Beam search 增量独立审查

38 项新增引文、复用旧来源 178、一张图和两个算例的内容及浏览器验收通过，未发现 P1/P2。工程检查待根代理统一运行；冻结范围为 sampling 本批差量，不重新声明全页全部旧引文已验收。

逐项判断见 beam-independent.json。39 个实际证据范围与固定 Git 原文、前期独立取证及当前 metadata 身份一致；其中 38 新增、1 复用，不能写成新增 39。读源范围沿用 request-beam-followthrough-reading.json，本轮再读四版评分函数、rc2 在线候选/abort/解码和 v0.26 离线文法过滤/掩码门槛。下载文件数量不作全文阅读数量，新增全文计数为 0。

宽度 2 的四条延伸数值与保留次序正确，图明确其他路径省略且概率更低。长度示例沿用已实际执行的四版原评分函数复现：-2/6 高于 -3/8；末 EOS 扣除和 prompt 计入均由实际消费者支持。rc2 的最小 1 保护独立说明，未套到固定 main。图中选中/淘汰路径清楚，两个 calc 的结果与正文对应。

入口区分 Python 独立参数对象和 HTTP n→beam_width、温度默认合并，未把普通 top-k/p/penalty 或结构化字段误认为自动生效。Completion 拒绝流式与 Chat 可进入 SSE 包装的差别、正常 beam 只在结束交出结果、离线 text 含 prompt 与在线只解码新增编号均有证据。v0.26 起的文法路径限离线；允许集合过大时仅筛有限候选，未承诺完整合法搜索或全局最优。

实际打开 5201 sampling，查看首两屏与原首图、本次 10 张截图中的全部新增段、图、两个 calc、新版本表、来源索引。表格/页面横向溢出为 0，runtime errors 为 0，浏览器前后 3 文件 hash 稳定。实际点击“拆分前处理入口”到 API 对应 renderer 小节、“结构化输出”到目标页。没有运行模型服务或 GPU/NPU 推理，GLM 原教程未启用 beam 的边界保留。

唯一替换旧段是 rc2 skip_special_tokens 末注：原有效字段/默认/HTTP 消费语义迁入完整四版表，旧普通 sampler 同 blob 结论保留，补上 main 不具备 rc2 特定行为的限定。详见 beam-preservation.md。最终指纹与快照见 beam-checkpoint.json；全站完成不在本报告范围。


工程闭合：loading223-verification.json 的稳定版本上，content/lint/audit/diagrams/build 全部 exit 0。Exact content-review hashes match engineering checks。不重计历史来源或全文。
