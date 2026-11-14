# 融合母文的技术子链复核

状态：与本站现有 Ascend 教学分界相关的直接技术链已核。本轮没有必要新增 GPU/HIP 教学章节，也没有修改融合正文。是否合并关闭目录第 16 项由 root 根据下列明确范围处理；不宣称所有递归代码、讨论或设备试验完成。

## 读了哪些材料

`vllm@0fc695fc:docs/design/fusions.md` 全文 397 行再次阅读，已有母文信用不重复增加。先盘其规则、配置、代码、基准、问题及 AITER 链接，再核本站 `npugraph-ex.md` 的上游规则与 NPU 分界。

本轮实际读到：

- 6 个完整源码文件：上游 pass manager 226 行、FlashInfer AllReduce 适配器 336 行、融合基准 1149 行；AITER PR 2442 最终 head 的 HIP kernel 243 行、Python 包装 164 行、基准/精度脚本 134 行。
- 25 个明确源码范围：配置生产、平台归一化、11 类母文规则的注册与适用门槛、AITER 调用与注册、MLA 临时输出/后量化，以及 AITER 声明和构建绑定。它们不是 25 个完整文件。
- 5 个问题的完整描述正文：36066、34458、35426、27893、34391。AITER PR 2442 的描述正文及页面实际加载的 5 个附加正文/评论块也已读；没有把隐藏 review 线程、全部中间 patch 或所有后续 PR 算入。
- 实际查看 4 张技术图：27893 的基准表片段、34391 的 TPOT/TTFT 两图、2442 的完整可见测试结果表。27893 的原图自身就是裁切片段，不冒充完整原始基准导出；头像不计图表。

固定源码、原始正文、SHA、范围与图片清单见 `fusion-child-reading.json`，原件位于 `.tmp/continuation-groups-2026-11-10/fusion-child/`。AITER 固定 pin 为 PR head `19ac0050645074c2f4fc5399b59defbfa2155ca0`，不是任意当前 main。上游代码使用母文同一 `0fc695fc`，未拿当前网页状态替换历史源码。

## 官方概括不能直接复制的地方

| 项目 | 官方母文或外部材料 | 固定实现与处理结论 |
|---|---|---|
| RoPE + KV 默认级别 | 小节称 O1 自动开启，总表称 O2 | `config/vllm.py` 的 O1 为 False，O2 才按条件启用；总表与小节不一致 |
| Sequence Parallel 分段编译 | 小节允许静态尺寸可被 TP 整除的 piecewise | `sequence_parallelism.py` 602–605 硬断言需要 Inductor partition 或空 splitting_ops；AsyncTP 970–973 同样要求整图 |
| ROCm AllReduce + RMSNorm | 支持矩阵写不可用 | 默认生产者、pass manager 与 `RocmAiterAllReduceFusionPass` 已有条件注册/执行链；不能据旧矩阵断言没有实现，也不能由注册推出具体硬件实测成功 |
| 双 RMSNorm “一次 kernel” | PR 的小批量融合机制 | PR 2442 的公开包装在 M≥16384 时回退为两次独立 RMSNorm；固定 vLLM 还优先检查后续私有符号，老包装的阈值不能泛化到所有依赖版本 |
| 融合基准的报告字段 | CLI 暴露 warmup/trials，报告描述最快基线 | 当前脚本未把这两个 CLI 值传给计时函数；基线查找还使用旧键，不能凭报告标签认定实际计时配置与最快基线 |

最后一项不是仅凭代码猜测：已抽取固定脚本的纯报告函数，以合成时延 1、3、2 ms 实际运行。最快非融合基线是 1 ms，但函数选了 3 ms 的 native-compiled 项，把融合项显示为 1.50x；相对真正最快项应为 0.50x。AST 同时核出 `args.warmup/trials` 仅在 Markdown 元数据处读取，9 个计时调用均未传入。证据为 `benchmark-pure-check.json`。没有导入 torch 或执行 GPU 基准，也没有修改外部仓库。

问题 34458、35426 是历史 FlashInfer TP/DP/PP 故障报告。页面已关闭不等于本站四版都修好；这里只用它们理解原告警来历，并回到固定消费者的 group、workspace、平台及默认门控判断，未新增无版本限定的“仍然不支持”教学结论。

## 对本站的结论

现页已经把 `additional_config.ascend_compilation_config` 与上游 `compilation_config.pass_config` 分开，明确上游 CUDA/ROCm 表不构成 NPU 支持矩阵。上述外部缺陷没有被复制到本站，不需要把这些维护性差异插入教学正文。

现页“图节点数不等于内核下发数，也不直接给出固定加速比”的解释得到实际子链支持：MLA 的上游输出量化消费者先分配普通精度临时张量，最后再量化；PR 2442 的大批量路径则回到两个 RMSNorm。参数开启、候选登记、实际匹配、最终设备执行仍须分层判断。

注册范围核查覆盖 AllReduce、Attention/MLA 输出量化、RoPE+KV、QK Norm+RoPE、SP/AsyncTP、RMSNorm+Quant、SiLU+Quant、RMSNorm+Padding 与 MLA Dual RMSNorm。不同规则各有 dtype、符号、实际层类型、后端 capability、编译区间或 AITER 条件，不能把某条规则的 `num_tokens` 门槛移给另一条规则，更不能移给本地 Ascend 管理器。

本轮融合部分新增教学引文 0、修改教学文件 0、修改图 0；没有需要新做的页面视觉差量。缓存表那一格的修订属于独立的 `pytorch-compile-child-review.md`，不能把其作者浏览器结果挪作本轮设备验证。

## 明确保留的边界

母文所链接的全部 CUDA/HIP kernel 内部、整个 Attention backend 目录以及问题中所有递归链接没有宣称读完。本轮完整读的 GPU/ROCm 基准没有实际运行，文中 GPU 收益不转成 NPU 收益。AITER 后续 PR 2958、issue 3207 仅沿固定 vLLM 的兼容分支看到了真实消费者，尚未把完整讨论计入阅读。

本站原有的外部 `npugraph_ex` 替换对象的具体下游消费者、实际 NPU 数值与性能仍保留精确未核范围。第 16 项可以按“当前教学相关技术承接已核”合并，而不能改成“所有外链及全部源码都完成”。无需要用户决定的事项。
