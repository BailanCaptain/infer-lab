# 最终工程记录独立复核

审查者：/root/spec_final_review。这里独立复核 root 的工程日志、冻结身份、路由结果、维护标记扫描和既有来源替换的证据链；不宣称重新逐条核完 8,729 项语义，也不把自动检查当作教学视觉验收。随后由 root 指派本审查者担任 10 页呈现整改作者，**该整改须由 root 另作独立验收**。

## 冻结记录与实际日志

独立重新计算了记录中的 872 个文件 SHA；在呈现整改前，它们全部与 before/after 一致，漂移 0。五个日志重新算 SHA 均与 report.json 对上，五命令退出码均 0。实际阅读每份日志的成功结论与限制，并核对告警，而非只看 report 中的 stable 字段。

- check:content：164 登记页、11 主章节完整无重复。
- wiki:lint：退出 0，但当时存在下述 10 个标记提示，不能称无告警。
- wiki:audit：164 页、8,729 来源出现项；本地行号有效 8,209，URL 未联网验证 520，无效提交/缺文件/越界/未知仓库均 0，raw 引用待核对 4,986。104 名单页标准通过；名单外 60 页只统计。日志明确不覆盖 URL 内容、raw 摘录语义及结论支持性。
- wiki:diagrams --check：352 图与 spec 一致；仍有 91 启发式非阻塞提示，分类如下。
- build：tsc -b 与 Vite 构建完成，`built in 8.42s`。有将来 Vite native 配置加载的扩展名兼容提示及插件耗时提示；本记录不改构建配置或屏蔽提示。

164 路由报告的 ID 集合与当前 registry 完全相等、没有重复，正文字符数均大于 0；记录中的 pageerror、横向溢出、指定历史标记命中均 0。逐页 SHA 与报告前后冻结一致。浏览器脚本使用正文可见烟测，不是 164 页整篇语义或逐图视觉审查。维护扫描 164 个身份与文件 SHA 同样吻合；模式仅覆盖“旧说法（历史记录”“废弃依据（来源”“来源是否支持结论仍须人审”“旧文的来源编号”“待人审”，不能据零命中推出一切措辞已被理解。

暂停的 chunked-prefill-v2 仅随路由/标记烟测出现，暂停标志保留，未修改、未将它纳入本轮教学验收。其冻结 SHA 为 8e20b58576422a8d4296ace1d49e677e1f770db0d393b941e174f79213b64bf2。API 最终独审冻结 d2748364a30c5081ef308e56b3971f1df267c913e9414057a901c76e1a811f29 已包含在五项检查冻结中。

## 10 项标记提示的实际处置

按与 lint 相同的标记规则排除围栏后独立计数。ascend-patch-system、moe、npu-model-runner、platform-plugin-registration、quantization、reading-vllm-ascend、vllm-ascend-overview 共 7 页的全部标记都在“对照源码”以后，教学区角标为 0；另外 enable-force-eplb、enable-pcp-o-proj-weight-sharding 与 Block Table 问答来源页的 24、19、29 个标记确实在正文/事实表。不能统称为源码区域提示，也不能因为后 3 页未被 104 名单强制就称无问题。

标准全页密度条款仍适用本轮人工验收。发现后已报告 root，并转入独立的作者呈现整改；不是删除来源或调低规则。修前数值、每一标记行号与分区保存在本报告 JSON；修后证据另见 evidence-presentation-author.md。**原五项冻结现在是修前历史证据，不能替代 10 页修后的全站复验。**

## 91 个图提示的分类

全部 91 条原始提示、47 个完整图注及被点名的完整注释文字已读。53 条是代码名、26 条是长注释、12 条是文字段数。逐条 ID/图资产 SHA/原始提示/分类保留在 JSON，没有删除或更改任何图来压低计数。

代码名用于调用流程、版本/后端分支、仓库或模型部件定位，例如 op-to-ai-core 与 ops-dispatch-flow 的实际入口，request-call-chain-functions 的两次调用、fine-grained-tp 的 lm_head、RL 更新流程的方法名。移除这些名字会切断定位。条件注释包括量化图只画 Linear/MoE、图回放退出条件、SWA 截断对照、并行张量形状以及端到端观测边界，不能按长度直接删。段数提示里 A/B 时间轴有 25 个刻度/输出标签；critical-path 包含两组计算通信标签；GLM 组图标 8 对 rank；这些属于绘图对象和读法，并非 25 段解释文字。

据提示和实际文字未新增确认的图 P1/P2；这不是对 47 图重新完成全套视觉验收。图的既有独审与当前读者路径证据分别见 ops-review.md、moe-contract-independent-review.md、request-processes-review.md、execution-review.md、replay-review.md、metrics-tail-author-review.md 及 final-learner-paths-review.md；各自只按其中声明的图与范围使用。root 当前 6 条学习路径的 25 张实际截图也不替代未展示的完整长图。此次工程复核没有重播其他会话 3D。

## 12 条精确旧引用扩范围

12/12 当前编号引用匹配，原提交与路径未改，新范围都包住旧范围，new_count 均 0。已逐条实际读取 prior judgment、迁移记录和闭环描述；可取得的 12 个摘录/完整源码缓存校验全部与既有记录 SHA 匹配。此处重核的是身份与旧独审链，不重新领取语义阅读或新全文信用。

- engine-processes 88/108 与 request-call-chain 26/40：旧独审项 current_ref 指向 request-processes-range-adjustments；该记录给出扩展原文、hash、主张和支持判断。
- vllm-v1-shape 40/41：属于此前已关闭补证，并不在旧 148 项独审 JSON 内。真实链是 request-processes-review.md 第 14 行明确复核 6 个范围扩展 → range-adjustments 中两条逐项证据；不能说在 148 JSON 找到了它们。
- op-to-ai-core 17、ops-and-kernels 26：ops-judgments 的 repaired_reference 与 related_prior_recheck → ops-review 第 25 行缺少门控条件的 P2 关闭记录 → ops-acceptance。
- sampling 94/115：逐项 final_acceptance/current_statement_supported → preservation 的同编号 source_migrations。
- vllm-scheduler 6/34：scheduling-manual-judgments 的最终独审状态及 identity_migration → process-scheduling-checkpoint 的 judgments 清单。

以上独审链与完整旧/新 ref 均保存在本报告 JSON 的 source_replacement_chains。没有动总账、暂停页、3D 或来源白名单。下一步仅需 root 对 10 页呈现独审并在其最终 SHA 上完成统一工程复验；无需用户另作决定。
