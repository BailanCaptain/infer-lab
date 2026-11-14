# 当前引文出现项与历史验收链对齐

本记录只核对身份与验收链出处，不把同一 ref、同一提交或已有一条记录视为本轮语义通过。执行脚本为 `.tmp/continuation-groups-2026-11-10/final-source-reconciliation.py`，逐项结果在同目录持久记录 `final-source-reconciliation.json`。

最终执行结果：164 个注册页面、8,750 个 sources 出现项。其中用户暂停的 `chunked-prefill-v2` 43 项单列排除；其余 163 页按当前页面、来源编号和完整来源身份对齐。5,021 项定位到旧逐项判断，3,187 项定位到本次各批判断或明确独审伴随记录，499 项定位到 continuation-500 原逐项判断。身份缺口为 0。这里的三类数量是互斥的映射优先级，不能相加成“本轮重新读了 8,707 项”。最后 21 项历史风险补证单独记录，不并入此前 696 项组的数量。

5,021 个旧项的原始 ledger、JSON pointer、原编号、ref、verdict、claim/evidence 和旧页 hash 均保留；实际解引用 18 份原 ledger，核对编号、规范化 ref 与 verdict 一致。499 项另定位到 continuation-500/judgments.json 的原 pointer、review、acceptance 和 scope。提交简写只在本地 Git 能解析为同一个提交时规范化；Mooncake 本地库缺失的 1 个简写保持原样，没有猜测等价。614 个候选记录缺显式页面身份，作为未分配候选留档；它们不是当前出现项缺口，也未按跨页 ref 猜测分配。

32 项编号迁移仅做对齐，不新增计数。旧基线中 12 个范围变化已连接 root 逐条核过的 `final-source-replacements.json`，当前同编号 ref、修订证据与独审报告存在检查通过；12 项均是扩展来源范围，没有未解释的基线 ref 消失。

原 500 批全部 500 项都仍有当前对应；其中 499 项落在该批映射优先级。另一项是 `mooncake-connector` 来源 26：原 `continuation-500/judgments.json` 的 `/items/140` 与后续 `transfer-lifecycle-manual-judgments.json` 的 `/items/87` 同时覆盖 `db701c1f:utils.py#L428-L445`，因此优先归入本次判断链的 3,187 项，不是缺失或换 ref。两条原始路径都保留在当前出现项记录。

旧判断按出现项互斥分组为：247 项部分支持、3 项原文不可得、1 项不支持通例、215 项存档/上下文、4,555 项其他原判断。原 verdict 的详细分布仍完整保留，多个历史判断不会被压成一个“通过”。其中 251 项的当前语义处置已由两位审查者分别完成 127/124 项，记录于 `final-historical-risk-0-128.json` 与 `final-historical-risk-129-250.json`。本映射精确关联其原编号、ref、处置理由、JSON pointer 与最终页面 SHA；251 项无重叠、无缺失，最终页面哈希差异 0。问题是否关闭依据这些实际人工处置，不由映射算法猜测。

这 251 项中，本轮另发现的 10 个风险出现项已在 7 页修订并独审关闭；其他记录分别保留组合支持、限定范围、旧修订确认、补读或外部边界。原来三项不可得中，量化精确原文已取得并实际阅读，其余两项仍保留外部原站/图像边界；并未把 251 项统一改成 fully supported。新补 21 条引文附精确独审 ledger/pointer，不增旧项阅读数或本轮全文计数。页面验收链的 Markdown 精确行、JSON pointer 和输入 hash 仍只用于定位，不扩大报告原本的验收范围。

API 新增 143 项已有本轮独审，见 `api-tail-independent-review.md` 与逐项 judgments；本映射没有重复计算其阅读量。所有记录不增加官方资料全文阅读计数，也不表示受限外部材料已经取得。
