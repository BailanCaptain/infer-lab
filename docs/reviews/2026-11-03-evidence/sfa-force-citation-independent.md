# SFA 布局与 force-EPLB 增量独立复核

root，2026-11-03。两份精确 remediation diff 已完整读取，独立复核下列改动与原始证据，接受本次语义增量。不将增量复核当作独立重读全部 90 项来源。

SFA 布局：实际读 baa 的恢复 1145–1157、准备 1264–1305、prefill 分路 1366–1412、PCP+DCP 子类 1467–1488、dim helper 1159–1172、DSA 方法 375–399 及继承 1553–1554；读 Triton 准备 95–193、通信 helper 17–26、配置工厂 1689–1709，以及 rc2 恢复和配置过滤范围。PyTorch 2.15 contiguous API 正文也已联网读取：已有所需布局时返回原张量。T=2 的 24 元素复制与 T=1 已连续的反例、PCP=DCP 时不发该次 query gather、fast path 与异常回退的边界均成立。PR #15970 的作者正文明确测试为 AISBench/GSM8K，但无开关对照表；未采纳机器人总结作为实现证据。

force-EPLB：实际读 baa 配置 562–570、建表 108–142、缓存 22–56、预建 59–86、取表 90–104、runner 4193–4195、routed_experts 594–633、逻辑专家数推导 265–276，以及 rc2 runner 4274–4279 / 路由 679–691。独立按公式核对 8 专家、EP4、每 rank 一个 token、top-k3 的四表及 [4,4,4,0] 合计，证实单表均匀不能推广到跨 rank 合计均匀。互斥、预热阶段报错、缓存键条件与覆盖共享专家列的说明都有对应分支。PR #15499 作者正文完整读取；静态检查与未执行 NPU/ACLGraph 验证已区分。

本次无图改动、浏览器或 NPU 实测，数学推算也不等于真实流量记录。页面 SHA256：

- sfa-dcp-force-tmajor-restore：`8ccf645d950da5ff6b425152b0e352ff785bc714897ab564e3ffe27dd6c096b1`
- enable-force-eplb：`d86479a45f417e83fd149b4ee083e8e303574b6d4b823257379579d8f0190f6c`
