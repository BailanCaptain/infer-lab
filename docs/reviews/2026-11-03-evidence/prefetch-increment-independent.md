# 预取参数增量独立复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_publication_fix`。本报告验收 prefetch-ratio、weight-prefetch-config 及相关图的本次增量，不代表独立重核两页全部 116 项来源。

已完整读取最初 27,016 字符差异、当前相关上下文、图 YAML 全文及 SVG 本次文字差异；随后逐项复读作者修订的比例/取整/零值、18 MiB、0.8 算例、GLM 支路与首句。最终差异为 `prefetch-citation-remediation.diff`。布局、默认值、6/12/18 MiB 和 22.5 MiB 条件算例保留。

实际回核范围：db701c1f weight_prefetch.py 1–238 全文，ascend_forward_context.py 1–160，utils.py 1301–1315，ModelSlim 配置 364–461、632–736，动态 W8A8 48–125、静态 W8A8 56–130，glm5_next_multimodal.py 664–706，SFA 1648–1782、1961–2011，indexer_kpool_mla_v1.py 521–597，MTP proposer 1118–1135；rc2 配置 1844–1912，main 配置 1613–1685 复用本审查人刚完成的 Dyntra 核验。2c59ff10 weight_prefetch.md 全文已读；该版 weight_prefetch.py 与 db 文件完整差异为空后复用已读代码。两份固定量化描述复用本审查人此前实际结构化分类、完整差分与逐模式核验：9e55 的 FLOAT/DYNAMIC 权重分别为 942/37,290，3121 为 894/37,338；两者均没有静态 W8A8 模式，不能把静态 attention 钩子当实际必经路径。

核心修订获支持：配置开启还须满足模块、上下文及实际调用条件；SFA 的独立预取调用与静态线性层钩子分开；None/0 层索引和 MTP 更早退出不能混为同一种判断；零字节在公共包装中可回填整块，但前提是组仍启用且调用实际发生；只有 MLP 的正字节请求受 Python 18 MiB 截断，不能把未知后端限制写成全路径保证。Omni 顶层未知键过滤与真正启用功能也已区分。

独立审查发现的残留由写手手改后复读关闭：比例并非与实际搬运量必然线性；全零不是关闭一组的唯一办法；0.8 与 1.0 的尺寸等价必须满足假设，不能推出实际性能相同；官方指定 Qwen3 场景没有证明默认比例最优；窗口实际时长需测量；source 73 结束行从 707 修为实际文件末行 706；首句最终改成请求比例及取整/分组/路径规则。没有未闭 P1/P2。

最终哈希：prefetch-ratio 为 `b24fcd9b232ff560c6d162e2688b57528a298d1243332b20b02c14988fab79a3`；weight-prefetch-config 为 `6b93cf279a5a5b6d1be792b0eb8764051d52b16239b2d6405c8655fbb271201e`，YAML 为 `da397aafb5445527e2d31668afd05c70106681f401daecf337b4a284e3fecbe3`，SVG 为 `a94f74bdc04504ab8983c9447f39c6f3909ce815f0f0470da962d3ddd360069c`。未做 UI、视觉、NPU、缓存命中或性能验证。作者报告的全图静态检查不被写成我的视觉验收。
