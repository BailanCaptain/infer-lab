# 执行链分组验收

本组关闭48个冻结旧来源出现项，修订新增44个来源出现项另记。6页为npu-model-runner、npu-worker-lifecycle、prepare-inputs-flow、vllm-engine-core、vllm-ascend-for-rl和size-40a1c2ca47b8；最后一页内容未改。独审逐项结论、信息保留与28个文件最终指纹分别见execution-judgments.json、execution-additions-judgments.json、execution-preservation-checklist.md和execution-final-acceptance.json。

主要成果是补齐MRV2的状态行与每步输入分离、pinned快照和增量写入，并限定为上游设计与Ascend适配分别核实；补齐四版本加载/执行/训练协作条件；修正温度0与小正数、seed的一致性前提，以及普通推理权重复用与训练换权的区别。输入流程图明确续跑追加块号、抢占恢复替换块号。2项P1、9项P2和1项P3全部关闭，既有演算与链接保留。

最终五项命令均退出0，记录在execution-verification.json。根代理实际打开6页、点击9条路径，页面错误与横向溢出均为0；另查看两张改图、Worker方法表和MRV2段。独立审查者完整差量、首两屏、版本表及图文验收见execution-review.md。源码和文档核验不代表NPU部署、吞吐或训练联调实测。

冻结活动旧队列归零见remaining-after-execution.json。官方目录覆盖、新发现的教学缺口、外部原图表及全站学习路径尚在推进；本记录不宣布全站完成。
