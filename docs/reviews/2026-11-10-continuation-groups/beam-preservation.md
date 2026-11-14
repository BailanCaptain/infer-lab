# Beam search 增量保留清单

改前为 .tmp/continuation-groups-2026-11-10/beam-coverage/sampling-before.md；完整差异及前后指纹见同目录 review-sampling.diff、review-identity.json。

- 六词采样主线、temperature/top-k/top-p、各类罚分、随机种子、logprob、思考预算、自定义处理器、评分、GLM MTP 和 Ascend 限制保留。
- 新增 Beam H2 与两个 H3、一张机制图、两个不同小节的 calc、入口/错误/四版表/来源索引，未替换旧主图或其他图。
- 唯一移写的旧段保留普通 sampler 同 blob 结论；rc2 skip_special_tokens 的默认和消费者移入完整四版比较，并明确固定 main 未保留该字段。不是删除已核实信息。
- 来源 305–342 追加 38 项，rc2 参数复用旧 178，旧引文计数不增加。图、算例是源码规则的示意，未冒充硬件测试。
- 冻结只含 sampling 与新图 YAML/SVG；后续 API 回链或其他增量另验收。
