# 两量化页引文增量独立复核

审查者 `/root/review_first_pages`，2026-11-03。仅验收本轮精确差异及相邻结论，不把作者已做的 34 项全引文审核计为自己的完整重核。

结论：本次增量接受。`quantization-methods-citation-remediation.diff` 和 `quantization-evaluation-citation-remediation.diff` 均完整阅读；当前方法页 100–223、评估页 100–217 及两页来源区已读。未发现需阻断的 P1/P2。所有已有算例和质量/性能未实测边界保留。

- 原生 FP8：实际读取 `vllm-ascend@7d825229` 的 `fp8_config.py` 26–111，确认 ignored 分支在 block/dynamic 校验前返回普通方法；读取 `fp8_block.py` 1–146、170–239，确认 model dtype、950 初始化、分组条件及 `kv_b_proj` 名称谓词、attention 吸收早返。两页已按建议将来源扩到 124–239，覆盖具名谓词。仅线性层分支，不扩大到全部 MoE 或设备性能保证。
- C8 与输入准备：实际读取同 pin `modelslim_config.py` 801–835、`w8a8_dynamic.py` 91–134、`ascend_config.py` 909–933，确认显式 cache dtype 开关和 recipe 的区别、2D 输入提前量化能力、主 cache 与 indexer 配置分别判断。
- PPL：实际打开 Hugging Face 官方 perplexity 页并阅读正文 116–199（本轮 web 展示行），其自回归条件、BERT 限制及分词/窗口/滑窗说明支持修订。没有声称 PPL 代替任务质量验收。
- QLoRA：打开固定 `2305.14314v1` HTML，实际阅读标题、摘要、§1、§2（网页 84–144），确认冻结量化基座与可训练低秩适配器；不把 URL 固定化算成整篇论文重读。作者的五篇全文阅读另有自己的记录。
- 已取得 GLM 两份精度描述：复用本审查者 E009 对固定 9e55cbc8/3121f187 文件的全字段分类核验及 E010 共同账复核；MLA 四组投影的精度差异成立。精度描述不能还原校准数据/工具配方，修订保留此界限。
- 客户端：audio 526–561 和 chat 402–434 复用本人本轮 performance 增量的实读记录；pooling 的 `ced6857a:endpoint_request_func.py` 606–639 本次实际阅读。计时依据非空 choices 与响应体读取，未将客户端变化当量化收益。

没有改教学文件。没有 UI、图片视觉检查或 NPU 测量；四份未修改 YAML 未在本次增量复读，作者此前阅读不算我的视觉验收。最终哈希和复核范围见同名 JSON。
