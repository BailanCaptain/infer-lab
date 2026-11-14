# Renderer 增量独立审查

34 项新增引文、API 教学差量、一张新图与一个短算例的内容及浏览器验收通过。两项 P2 与一项 P3 已修正并实际复看；当前没有 P1/P2。工程检查待根代理统一运行，本报告不把先前 reasoning 的工程结果套用到本次新文件。

逐项语义判断见 renderer-independent.json。API 来源 288–321 已与固定 Git 原文、原独立证据及当前 metadata 对账。阅读复用 request-renderer-followthrough-reading.json 中实际读过的范围，本轮再次读了完整请求协议范围、完整后处理消费者、Chat 流式守卫和 main 路由工厂；额外读取 rc2 online_derenderer.py 436–484，确认 Completion 流式没有 Chat 的 parser 守卫。34 个引文不是 34 篇新全文，新增全文记账为 0。

已修问题：Completion 原请求为单个对象，只有生成结果与输入计数按 prompt 对齐为列表；错误段的 parser 拒绝明确限定逐片段 Chat derender；4+2=6 用量示例改为带标题的 calc。修复后请求类型、行为范围与图示一致。旧版完整返回与新版逐片段 JSON 状态协议分开；没有虚构 /derender/stream 地址，也没有把生成服务的 SSE 当作后处理自身的持续连接。

四版表正确区分旧基线没有 derender、v0.26 完整后处理、rc2 普通入口的 CLI 开关与 main 环境三态开关。固定 main 仅是独立上游比较点。图中调用方串接三步，模型只在设备生成服务执行；媒体特征仍可能是设备 encoder 的输入，未宣称 CPU 已跑完整模型。

实际打开 5201 API 页并查看首两屏、原首图、新图、全部新增段、版本表、来源索引及算例。9 张截图均实际查看；修复后重新运行浏览器并实际复看改动的 3 张截图。页面和表格横向溢出为 0，页面异常为 0，检查前后 3 文件 hash 稳定。新增正文没有导航链接需要点击，列出的 HTTP 接口是源码核验，未启动模型服务调用。图的箭头没有穿越标题或遮盖文字，完整图和版本表均可读。

机械核对脚本先因历史摘录不带末尾换行、历史 ref 用完整 commit 而断言失败；按原证据契约归一后 34/34 一致，没有修改原文或引文来制造通过。最终指纹与快照见 renderer-checkpoint.json，保留清单见 renderer-preservation.md。

没有 GPU/NPU 现场验证，不宣称 GLM 原部署已启用独立服务、模型组合或性能经过实测，也不宣称全站完成。


工程闭合：loading223-verification.json 的稳定版本上，content/lint/audit/diagrams/build 全部 exit 0。API only three reviewed links plus preceding-scope qualification; see api-loading-links-review.md; original content-review snapshot/hash retained。不重计历史来源或全文。
