# 99 入口关闭提案独立复核

审查者：`child_sources_review`，提案作者：`root`。日期：2026-11-11。

结论：提案中的 **39 项可按声明的教学范围转为 `covered_scoped`**。原 42 项待承接中，94、96、98 三项仍需其正在进行的独立审查；本记录不提前关闭它们。没有发现阻止这 39 项范围关闭的 P1/P2。审查者未改总账或教学正文。

这里验收的是“已发现的教学缺口是否经必要原文、实际消费者、整改及独审得到承接”。它不表示递归外链全部读完，也不是重新逐条语义核验全站所有历史引文，更不是设备兼容、性能或训练结果认证。

## 对照方法和逐行结论

完整读取关闭提案；结构化提取原 99 入口的路径、状态、缺口和后续范围，对 39 项逐一匹配。原总账 2 万行中的大量重复目标页标题没有重新逐行阅读，也不需要据此新增资料阅读计数。对应独审报告已实际读取，涉及本人此前完成的独审直接复用其准确范围；本人写作的 LoRA 和离线三页采用其他审查者报告，不作作者自审替代。

机器记录 `final-coverage-reconciliation-independent.json` 包含每项的官方路径、原状态、建议状态、具体已承接问题、独审依据和保留边界。它把提案重复使用的组级概述拆成逐行说明；不能把一组 118、115、108 等来源数误当成每个母页都新增同样数量。

| 入口 | 接受依据与限定 |
| --- | --- |
| 12、15、25、88 | CustomOp 和 MoE 的实际注册、布局、容量/有效行、量化/通信、路由权重与归约契约。88 另依 NIXL prompt 消费者独审，冗余专家资源账回主解释。GPU/ROCm 支持矩阵不移植到 Ascend。 |
| 14、16、30、31 | PyTorch 编译/缓存材料、fusion 参数优先级、历史 PagedAttention 文本冲突与图示、Setuptools 入口点。历史 CUDA 内核和背景视频不伪称当前设备实现或全部阅读。 |
| 22 | 指标 57 与离线指标消费者共同补齐；此前四张缺失原图已取得，本审查又实际逐张查看。旧仪表盘和 tracing 示例不证明新版本字段或 NPU profiling。 |
| 46 | 28 项新增消费者与先前 resolver 验收互补；默认多模态冲突、HTTP 名字匹配、mixed 格式声明、tower 行数和服务 lineage 各有证据。44 个 CPU 案例及首屏成本修复由另一审查者验收。 |
| 50 | MiniCPM 公共文字和四版 12 个尺寸/processor 消费者足够支撑本站现有说明。受限 raw 没有取得；公共图区补读是单独记录，不从局部消费者验收推导全部模型资料已读。 |
| 54–56、58–67、69–70 | 量化工具/格式/算法/执行实现、选定导出到加载契约，以及 online、GGUF、AutoAWQ 等版本边界。quant39 历史接受页与后来的 ModelSlim6 独立增量分开；全部高级配方和后端运行不在范围内。 |
| 73–82 | 十个方法入口按 proposer、训练产物、抽取、缓存、匹配及统计承接；115 项独审和必要论文图文有明确范围。没有把配置名等同 Ascend 支持，没有声称所有论文参考文献读完。 |
| 83、84 | 语法编译、matcher/掩码、后端和工具解析/模板契约。108 项是 78 条结构化与 30 条 API 增量，10 模板独审不冒领作者 18 模板，也不当成所有模型 parser 运行。 |
| 93 | beam 38 新增及 1 旧来源复用、queue47、offline74 各有独审；metrics/RPC/cache 回唯一主解释。权重更新、RayData 保留本站 RL 范围；非全部离线接口现场运行。 |

详细原始依据包括 `moe-contract-independent-review.md`、`children-four-independent-review.md`、`metrics-tail-independent-review.md`、`request-offline-three-independent-review.md`、`lora-tail-independent-review.md`、`quant-tail-independent-review.md`、`installation-modelslim-independent-review.md`、`spec-methods-independent-review.md`、`structured-tool-independent-review.md`、`ep-prompt-independent-review.md`、`offline-queue-independent-review.md`、`beam-review.md` 和已有回链验收。机器记录保存实际 17 个补充/审查文件 SHA，不把仅引用清单当成重新读取全部源码。

## 图像及统计边界

本次实际打开四张 metrics 原图：Grafana 六面板显示历史延迟、吞吐、调度与缓存利用；Jaeger 搜索显示三条 trace，详情显示 client/server span，另图显示 ASGI receive/send。它们不能直接给出查询表达式、当前版本或设备 kernel 时间。四张原始文件 SHA 与 `metrics-image-followup.json` 均一致。

MiniCPM 图区另见 `minicpm-public-images-review.md/json`：12 张静态图实际阅读，4 个 GIF 各首/中/末 3 帧共 12 帧实际看过；连续动画尚未播放。受限固定 raw、全部递归模型链接仍未认证。这不影响现有宽高解释的局部验收，但必须保留在外部资料边界中。

fusion 六条历史状态规范化记录与当前文件 SHA 一致，原准确 `read_status` 保留；没有把 issue 正文升级成所有隐藏评论全文。此次新增官方全文计数为 **0**。

## 可复现证据与冻结

实际执行：

```text
python -X utf8 .tmp/continuation-groups-2026-11-10/reconcile-independent.py
```

独立检查结果：原 99 项；原待项 42；提案 39 项无重复；39 与待保留的 94/96/98 恰好组成原 42；17 个证据文件存在；四张原图 SHA 匹配；fusion 规范化最终 SHA 匹配。

- 提案 SHA：`c1b7bbe6cc2d280e9a84cd28873e41336674f2d29e20c57c641fb3954b98a546`。
- 原总账 SHA：`7e0307ad83fe57b39ed620174ad15880df0dac7fe37e98b06e55b046b1b22835`，与提案的前置指纹完全相同。
- 仅模拟应用后：`covered_scoped` 86；生成引用消费者限定 3；设备比较限定 2；上游矩阵限定 1；外部应用安装排除 4；仍待独审 3。合计 99。未把其他限定/排除项升级为全部承接。

根代理后续应用总账并完成统一工程验收；本报告不提前宣布全站完成。此轮没有教学修改，未重复运行工程检查或设备程序。没有需要用户决定的新问题。
