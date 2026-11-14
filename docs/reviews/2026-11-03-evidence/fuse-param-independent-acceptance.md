# fuse_allreduce_rms 增量独立复核

本次完整阅读 `fuse-param-remediation.diff` 的正文与图定义差异，并实际读取以下固定原文：2c59ff10 的 fusion pass 28–131、134–159，sequence_parallelism.py 55–110，manager 36–79，ascend_config.py 491–521、607–659；原生 tiling.cpp 303–381、AIV kernel 188–267、431–568；db701c1f glm5_next.py 2129–2241；vllm@84030bbe pass_manager.py 143–164；baa023ad platform.py 1162–1178。此前本轮也已实际读取 main 和 v0.26 的 manager 及未知键处理。

SP 的所引替换确实在分片 norm 后立即 All-Gather，融合方与 SP 竞争重叠节点，不能据此推出全模型 SP 消失。manager 顺序与按 compile_range 调用的条件支持当前限定。512 是 pass 阈值；原生循环的行数取 swizzl_count×m0，八卡 tiling 通过 M/K/N 条件选 m0，支持修订后不再将所有内核分块固定为512的说明。AIV 负责相应 token 行，读多 rank 部分和、加残差、norm 后 gather，当前机制描述与实际循环一致。

GLM 主干的 hc_pre、独立 RMSNorm、hc_post 与 MTP 分支在源中明确区分。新文将零命中推断限定语言主干，保留没有编译图和设备结果的限制；不再把 hc_post 说成承担所有归一化，也未混用另一个 MC2 的阈值。配置错误位置与 v0.26 kwargs 吞键的区别符合两种消费者。

未发现本次差异新增 P1/P2。Qwen 固定 config 与全部历史引用本次未重复独立阅读，由 root 的33项来源账本负责；“56处”现在明确是条件候选数，未声称命中。没有进行浏览器视觉验收、NPU 执行或性能测量，图只核实际 YAML 差异与源码语义。
