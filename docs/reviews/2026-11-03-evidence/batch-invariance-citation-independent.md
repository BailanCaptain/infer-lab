# Batch invariance：独立增量复核

root，2026-11-03。已实际读完整 `batch-invariance-citation-remediation.diff` 三个文件和 findings；从固定 git 对象重读来源 1、2、5、8、23、26、28–36、38 的完整范围。作者最后将“AscendC 那条更快”改为内部 matmul 使用对应注册入口，避免把源码注释中的性能意图说成通用性能保证。

接受本次增量：GPU split-K 注释只限所在矩阵乘分支；Ascend 依赖库、初始化、扩展导入与缓存顺序、指定 attention 入口和硬件分支都保留条件；linear 非空矩阵 K 块为 256、float32 为 128，不能套用另一核的 64 或 allow_tf32 设置。源码补装顺序、默认块大小、旧融合功能移除与 rc2 reduce_sum 接口说明和实际代码一致。

测试范围已独立确认：needle 是短提示词，总请求列表默认 72–144，5 轮为可覆盖默认值；文本对照只比较 text。另一测试提取生成 token 的 logprob、token ID，并用 torch.equal 比较提取数值，未比较完整 logits。教学数字与模型默认条件的推导没有再被称为本站硬件跑出的结果。

本次只独立接受精确修改及对应代码依据。没有执行 NPU kernel、整模型一致性、部署或浏览器视觉验收；没有把作者的全部 38 项来源阅读冒称为本审查者再次全文读完。
