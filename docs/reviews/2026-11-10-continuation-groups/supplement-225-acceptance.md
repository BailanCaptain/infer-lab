# 既有补证与散落余项收尾

本次关闭 225 个来源出现项：前批修订新增的 221 项，以及 4 个散落旧余项。它们分布在 12 页，不是新读 225 篇文档，也不重复计入冻结的 500 项。逐项主张判断、独立审查与原始范围分别保存在 tail、cache、spec、transfer 四组记录；汇总索引为 `supplement-225-judgments.json`。

实际整改包括：EP 的 DP 参数回退条件补齐为 DP=1 且本地数量非零；prefix caching 明确官方示例仅运行两次开启缓存的请求，关闭对照需另起服务并保持输入相同；Mooncake 跨页摘要补上短 prompt 向下取整为零的长度条件。原来的图、数值演算和版本解释保留。KV Pool 的两个相同摘录来自不同提交，已将账本的“同版本重复”改成各版本分别支持、阅读内容复用，不改变正文结论。

四组均已有实际页面/来源独审与浏览器验收，详见 `supplement-tail-review.md`、`supplement-cache-review.md`、`supplement-spec-review.md`、`supplement-transfer-review.md`。共享工作区其他会话加入的 3D 导航不归本次修改；对应边界保留在各组报告中。当前可复核快照包含 86 个页面与图文件，哈希见 `supplement-225-checkpoint.json`。

最终五项命令通过：`pnpm check:content`、`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check`、`pnpm build`。lint 有 9 条既有非阻塞提示；审计只证明本地行号和名单页写作标准。请求组在编写期间曾使审计失败，失败与修订后通过的日志均保存在 `supplement-225-verification.json`，没有覆盖历史结果。

对齐使用页面 ID、来源编号和完整引用三元组。活动旧队列最初 1145 项，前六组关闭 252 项，本次关闭 225 项，剩 668 项；集合无重复，逐页余项见 `remaining-after-supplement225.json`。后续新增补证另记，官方全文覆盖、外部缺图和学习路径仍继续，不能据此宣布全站完成。未做 NPU 实测；无需要用户重新决定的问题。
