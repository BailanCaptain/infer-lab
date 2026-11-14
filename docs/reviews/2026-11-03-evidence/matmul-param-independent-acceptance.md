# enable_matmul_allreduce 增量独立复核

完整读 `matmul-param-remediation.diff` 正文和 YAML 差异；实际复读 2c59ff10 linear_op.py 105–180、400–460、700–739，allreduce_rmsnorm_fusion_pass.py 28–70、115–159，test_external_launcher.py 209–229，release_notes.md 1735–1779，additional_config.md 90–98；db701c1f w8a8_dynamic.py 100–145；baa023ad 与 2ed6cbba 的 GraphFusionPassManager.configure。一个首次读取范围请求到165超过文件159行，随后按实际文件完整读115–159，没有把失败读取计入证据。

512 的常量与 compile_range.start 门槛属于图 pass；行并行包装层只传输入、转置权重、通信信息和偏置，既无该切块参数，也不检查 eager/prefill。修订将流水四块明确降为假设，并保留 TP、reduce_results 与更早派发分支，符合实际代码。门禁的 Ascend910B 条件仅证明这一用例的范围。旧发布说明标题确为 v0.10.0rc1。

GLM 的 int8 权重后处理先转置，此包装层再转置且不带量化参数，能支持文中的形状冲突推导；两份量化描述的 MLA 差异已在容量批次独立解析。新文不再保证前面的设备调用一定成功，也不把48处语言主干调用位置当视觉塔/MTP全模型计数。没有执行 NPU 算子或性能测试。

本次增量未发现 P1/P2。现文仍有一处 P3：命令后称“唯一一个开启此特性的门禁用例”，较表格的“所引门禁用例”更强。实际 git grep 固定 tests 树还见配置测试和三个 nightly 配置映射；这并不能证明有另一条硬件门禁，也不能单靠所引用例证明唯一，建议同样限定为“所引旧版门禁用例”。另外，派发说明中的“多半就是踩到了这里”属于未给现场证据的频率判断，可改成排查条件。未将此增量审查代替 root 的32条全来源账本；未进行浏览器视觉验收。

补记：已实际复读当前85–95、145–160行及更新后的相关差异。“所引旧版门禁”、逐层命中分支和具体 GLM W8A8 限制均已改正，上述两项 P3 关闭；不存在结论也限定了固定版本并保留 Omni 顶层键过滤例外。未发现这次小增量新增 P1/P2。
