# Reasoning 普通 Chat 增量独立审查

结论：50项新增引文与四页教学差量的内容、保留和浏览器验收通过，P1/P2为0。两项P3限定已由作者修正并复看；最终五项工程检查通过，本次日志SHA及检查前后四页hash已独立核对，工程已闭合。

逐项主张、语义判断、版本和证据见reasoning-independent.json。50项均与固定Git原文、当前metadata序号和保存摘录核对；源码hash或行号通过只验证身份，支持结论来自独立实际读过的实现和本次对新段的逐项判断。阅读沿用request-reasoning-coverage-evidence.json的精确范围，未把50引文项计为50篇全文。

这一增量正确区分三处控制：模板输入的effort/enable_thinking、解析后的思考返回、引擎思考预算。默认值、七档枚举与max的模型范围明确；四版模板字典的24种原方法复现支持服务false被自动high→true覆盖及显式请求false优先两个例子。没有把复现字典组装当真实模型生成。

旧普通流式parse_delta缺少include_reasoning过滤，旧完整返回有过滤，Harmony另有判断；后三版普通解析分支同时抑制答案段的logprobs/token_ids。无匹配解析器不能靠false自动识别思考。非beam Chat的false还把reasoning_ended=True传给引擎，结构化文法可从起点生效；四版消费者路径不同，报告没有宣称实现全部相同，也没有把普通Chat范围扩成全部Responses。

实际打开5201四页、各首两屏及首图，查看15张截图；P3后再次运行浏览器并实际复看3处变更。新概念表、字段表、版本表可读，页面和表格没有横向溢出，runtime errors为0，前后hash稳定。实际点击API→streaming、streaming→structured、streaming→sampling均到正确小节。没有新增算式或图；原数值例子继续保留。

首次链接探针把percent-encoded锚当原中文比较而失败，改为解码后再次实际点击成功；这属于临时审查脚本，不是产品路由缺陷。机械摘录hash按该批既有末尾换行契约核对后50/50一致，没有修改来源来制造通过。

当前没有设备实测，未验证NPU/GLM现场输出质量、吞吐或所有解析器组合；未声称全站和全部官方资料完成。冻结范围及后续版本隔离见reasoning-checkpoint.json与reasoning-preservation.md。

工程证据：.tmp/continuation-groups-2026-11-10/lifecycle-current-checks.json；content、lint、audit、diagrams、build均exit0（build 5.95s）。164页/7679来源/344图为当时共享工作区统计，不是本组独占成果；104/104、10条既有非阻塞lint，URL/raw语义仍不在机械检查范围。
