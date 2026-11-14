# 历史风险复核后的七页修订

作者 root。本批由 251 个旧 partial / unavailable / unsupported 出现项的语义复核触发，修订 7 页并补充 21 个精确源码范围；不是将旧判断自动改为支持。原记录及原始主张保留，当前处置由两个独立审查者分别覆盖 127 与 124 项。

| 页面 | 实质修订 | 新来源 |
|---|---|---:|
| chunked-prefill | 补齐 DP 节拍的引擎与 Scheduler 双层条件、容量标记更新和 waiting 例外；区分同步/投机/异步对无效采样的处理；执行标签不再代替完整消费路径；默认分块按模型能力推导，连接 Prefill 版本表。 | 12 |
| prefill | 四版默认值区分配置类静态兜底与启动时模型能力推导；默认长提示阈值另列。 | 3 |
| request-teardown | 区分普通容量抢占、可靠 KV 交付、遗留丢弃状态和强制 reset；补齐旧输出检查、排空后恢复和投机计数条件。 | 6 |
| rfork-identity / rfork-startup / rfork-troubleshooting | 区分租约入口检查与后续 URL 构造；大于 65535 的端口在后一步失败，不能概括为未取得租约；明确本地自检与 HTTP 检查的来源分工。 | 0 |
| stair-config | 补回负载窗口全零先跳过的前提，再判断无历史锚点和阈值。 | 0 |

作者实际读取这些新增精确范围及必要调用者，独审分别核读 12 和 9 条。未将片段读说成整文件全文，也没有运行 NPU 或这些部署命令。量化来源 55 的原始 CANN 文档另从原公开地址取得，463 行全文由作者与独审分别读完；详见 `quant55-original-followup.json`，该原有来源未新增计数。

修前文件保存在 `.tmp/continuation-groups-2026-11-10/historical-risk-fixes/`，SHA 与逐页差异、来源前缀保留和图/计算/场景块相等性见 `historical-risk-followup-preservation.json`。原来源顺序及字符串全部保留，新增项单列在 `historical-risk-followup-additions.json`。修订针对必要事实条件，没有替换旧图或删掉原有演算。

作者实际浏览器打开七页受影响段落、表格及版本说明，共 12 张首轮截图，随后为 chunked-prefill 最终版本表和条件补 2 张，14 张均实际查看。两轮均无 pageerror、无整页横溢出，文件前后 SHA 稳定；实际点击 Prefill 版本对照落到对应章节。独审分别实际查看 4 张 chunked 图和 10 张其他六页图；不把作者的浏览器操作描述为独审亲自操作。

独审正文与逐项处置见 `chunked-risk-followup-independent-review.md`、`final-historical-risk-child-review.md`，最终 251 项总表保留旧判定并叠加本轮实质处置。整个站点的工程检查在教学内容冻结后另跑，不沿用修前通过记录。没有需要用户决定的问题。
