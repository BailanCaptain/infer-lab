# enable_async_exponential 增量独立复核

本次完整阅读 `async-param-remediation.diff` 中的正文与图定义差异，并重新对照固定源码：2c59ff10 sampler.py 20–103、146–191，model_runner_v1.py 2278–2322；db701c1f rejection_sampler.py 151–198、model_runner_v1.py 1492–1578、2247–2291。

q 的分配、指数随机数生成和事件记录先提交，随后进入 forward；消费处仍执行事件 synchronize。源码能证明提交顺序，不能保证 q 必定先完成，也不能保证减少一次等待。新图与正文已保留这个区别。reduce-sample 分支另行调用 random_sample，因而预生成 q 未被消费；其时间和峰值显存影响仍需设备测量。

MTP 的 logits_indices 行数为候选数加请求数，bonus_logits_indices 每请求一项；直接执行 probs.div_(q) 的输出不能原地扩行。新文将形状问题明确写成代码推导，并保留没有设备复现的限制。Exp(1) 独立同分布及形状对应条件下的目标分布结论，没有再扩大为固定 seed 逐 token 一致。

未发现本次修订新增 P1/P2。没有重新计算 PR 性能表，也没有复核整页全部历史版本与来源；这些仍由 root 的逐条来源账本负责。图仅做 YAML、固定证据和实际差异审查，没有浏览器视觉验收或 NPU 测试。
