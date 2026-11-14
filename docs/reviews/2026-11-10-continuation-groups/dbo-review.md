# DBO 增量独立审查

审查者：`/root/groups_recompute_review`。范围为 `async-scheduling.md` 新增的 DBO 内容和来源 80–107；旧 79 项只做保留对照，不重复计数。当前状态为**内容与视觉验收通过，等待本轮统一工程检查**。最终文件 SHA 与五文件快照见 [验收账](dbo-acceptance.json)。

## 定义、反例与实际消费者

DBO 把同一步的输入按 token 拆成两份，让一份的专家通信与另一份已经就绪的计算重叠。它不减少应处理的输入，不等于提前调度下一步，也不把模型按层分段。CPU 线程协作让出执行权；流事件与接收回调仍维护数据依赖。成本是线程协调、切片及元数据、组间补齐以及小矩阵可能降低效率。新增段前两屏可以完整复述这些内容。

独立读取 28 个固定引用，实际核对对应 Git 内容、文件 SHA 和摘录 SHA；同内容范围按哈希留去重关系，逐项结论见 [人工判断](dbo-manual-judgments.json)。另读了真正调用方与辅助函数，记录在 `.tmp/continuation-groups-2026-11-10/dbo/review-readscope.json`。

- `coordinate_batch_across_dp` 给门槛函数传的是未补齐 token 数；`uniform_decode` 由本步查询长度判定。比较是 ≥，并非注释里含糊的 greater。
- 空末微批条件为 `(补齐长度 // 微批数) × (微批数 − 1) ≥ 原始长度`。两微批、共同长度 96 时边界为 48：64/96 可保留两份真实输入；32/96 虽过 32 门槛却触发空第二份，全组取消；16/96 先未过门槛。96 是给定示意前提，不是默认图尺寸。
- 切片按 token 位置而非平均切请求列表。跨请求时，`_make_metadata_with_slice` 调整查询起点和长度，再按请求切块表、按 token 切 slot mapping。公式和表中真实 token 数无遗漏。
- 官方母文“只支持 Full CUDA graphs”的概括不足以描述固定源码。runner 可以构造 NONE 微批 wrapper；正常执行中的 `force_eager` 不否掉 `allow_microbatching`；wrapper 实际选择 `_run_ubatches`。正文限定固定 0fc 的 GPU V1 路径，没有推广为所有新版 runner 或 Ascend 支持。
- 五个 Ascend 比较点都在 `parallel_config` 存在时清 `enable_dbo=False` 和 `ubatch_size=0`，外层没有特定硬件守卫。新版表只比较已核的默认值、门槛、全组决策与平台重置。

## 官方目录与全文账

从固定官方目录反查 DBO 的入口和相关条目：`docs/design/dbo.md` 全文 88 行、四版相同内容只计一份；`docs/design/moe_kernel_features.md` 完整读取，确认 async 后端、量化/激活格式及专家 kernel 配套边界；`expert_parallel_deployment.md` 仅读 186–220 的相邻部署段，不计全文。后者链接回 DBO。前者继续链接 `fused_moe_modular_kernel.md`，本增量没有把这篇或其链接整体标成读完，交由全站官方资料目录继续去重推进。

固定 [官方 DBO 原文](https://github.com/vllm-project/vllm/blob/0fc695fc/docs/design/dbo.md) 本轮联网可读。全局是否已读由主账去重；本次 28 引文项不等于 28 篇官方资料。

## 保留与学习测试

[保留账](dbo-preservation.json) 将 `before.zip` 与当前正文逐段对照：旧 79 来源前缀、15 个标题、4 个 calc、39 个原链接目标全部保留；6 张旧表中 5 张完全不变，概念比较表保留所有原行后追加 DBO 一行；新增两张表。旧正文没有删除或替换行。两幅旧图的 YAML/SVG 四文件逐字节相同。

语义上保留了 13/11 格直觉、200 步比例、输出占位三时刻、设备补值、投机的两项回退、强制清空缓存的在途收尾、结构化采样等待、FULL 同步条件、R1 账表、DP2/TP8/PP1 前提、既有三版/四列历史表以及 rc2 profiling 的独立说明。未把示意格数或静态代码当成设备测量。

首轮实际浏览器发现全页首两屏没有明确代价，按写作标准记 P1。作者已在首图前补在途批次、输出占位与结果回收成本一句；详细说明原样保留。最终重新打开页面并查看首两屏：可以复述“CPU 趁卡算这步排下一步，节省等计划的空档，但多保留在途工作并维护占位及收尾”。P1 已关闭，当前无未解决 P1/P2。

## 实际浏览器验收

使用 5201 服务、1440×1100 桌面视口，实际查看首两屏、DBO 新段、条件与配置、四版表、全部 8 张表，以及两幅 SVG 和四个 calc。旧 Ascend 宽表横向滚动 319 px，实看最右 main 列；不是仅靠 DOM 文本认为可见。DBO 回链实际跳到新 H2，MC2 回链实际到 EP 对应标题，均在可见区。未见页面横向溢出、删除线或页面脚本错误。截图、点击坐标与最终五文件哈希见 `.tmp/continuation-groups-2026-11-10/dbo/review-browser/report.json`。

最新五项工程检查已通过，独审已实际读取本轮日志，详情见验收 JSON；不是复用旧批次回执。未做 GPU/NPU 实机执行、吞吐或时延测量；本次局部验收不代表全站完成。


## 最后措辞与工程收尾

已对照 `review-before-hedge.zip` 的小范围差异；具体反例、历史保留条件和两笔耗时比较均保留。服务的孤立工作流锁恢复后重新打开两页、执行锚点与跨页点击，并实看变化处。最终页面哈希与截图前后稳定，快照和保留账已更新。工程证据采用 `index-dbo-final-content/lint/audit/diagrams.log` 与解除锁后的 `index-dbo-final-build-unlocked.log`：五项成功，Lint 仍报告 10 个既有非阻塞提醒，审计通过只覆盖机械范围。初次构建与浏览器环境失败保留，不记作教学错误，也不隐去重试。
