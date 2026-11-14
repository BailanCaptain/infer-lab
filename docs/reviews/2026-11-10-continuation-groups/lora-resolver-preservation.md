# LoRA resolver 增量保留清单

作者先完整读原 271 行页面并保存 lora-resolver-coverage/lora-before.md，SHA256 为 3cae2c05b734a7c70474f23e5d2a98d064e4b0660327f960f02a1d874ac3c8b1。范围只增加按请求名自动查找的前端链及本页配图，不重写低秩数学或设备实现。

- 保留 W/A/B、缩放、rank 与 adapter 定义；1024 单层比例、4 维输入手算、7/12 参数示例及原机制图不变。
- 保留槽号、四行映射、名额/最大秩预付、调度跳过、主机缓存 LRU 与加载峰值说明；resolver 的前端登记复用另讲，不替代设备缓存机制。
- 保留旧 GLM 未启用 LoRA、EP16/W8A8 限制、单层 0.78% 与语言权重子账边界、缺模型声明与现场实测的待核。
- 保留 Ascend 普通线性/MoE/logits 路径、单槽快路、310P/rank 退路、图捕获和 921ccc52 融合门槛，原三版表与 rc2 单列条件不删。
- 保留启动注册/手动运行时装卸示例、全部误解与来源索引。新增 resolver H2、参数与四版表、源码区入口/错误/开销说明及一张独立流程图。
- 旧 48 项来源是新来源列表的原样前缀；追加 38 项为 49–86，没有重计旧项。verified 保持原值，本批局部四版核验不冒充整页验收。

作者逐段比较及机械 diff 均没有旧正文删除行。具体前后 hash、差异与统计见 .tmp/continuation-groups-2026-11-10/lora-resolver-coverage/author-preservation.json、author-lora.diff。最终验收由根代理独立审查，不使用本清单代替独审。
