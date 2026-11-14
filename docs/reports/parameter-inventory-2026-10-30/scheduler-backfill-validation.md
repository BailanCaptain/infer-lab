# B3 调度参数补写验证

2026-10-31，B3 的 **10/10 单元**已补写并完成独立审查和检索验证。累计 A 批 11、B1 8、B2 9、B3 10，共 38 个单元；B 批 27/89，下一批 B4 主模型图 5 个单元。基线仍为 vLLM 0fc695fc / GLM Ascend db701c1f；对照在册 v0.26 rc 568afb3a 与固定 main 84030bbe。固定源码不证明现场镜像安装内容，本轮没有 NPU 实机启动或推理。

## 单元与页面分工

| 单元 | 参数 | 补齐内容 |
|---|---|---|
| W1512 | async_scheduling | None/True/False、CLI 正反开关、自定义类优先级、draft_model 自动判定版本差异；详细机制复用异步页 |
| W1555 | enable_chunked_prefill | 输入自动值与配置兜底、模型支持条件、关分块长度校验、与正阈值的执行顺序 |
| W1608 | long_prefill_token_threshold | 0、负值、上界及三版差异；running/waiting 均截断、关闭分块仍分段的示例 |
| W1622 | max_long_partial_prefills | 默认与字段约束、标准入口拒绝非默认、main 删除 |
| W1626 | max_num_batched_tokens | 字段兜底、入口默认、硬件表、throughput、长度/多模态下限与乘积封顶、显式值优先 |
| W1627 | max_num_partial_prefills | 默认与字段约束、不可用的并发调优入口、4% 构造分支与真实启动路径区别 |
| W1628 | max_num_seqs | 每 DP 上限、自动 min、与预算联合校验、不是 waiting 队列总长 |
| W1682 | scheduler_cls | None 自动选类、Python 类对象/字符串、CLI 路径、异步子类及 Ascend 覆盖关系 |
| W1683 | scheduler_reserve_full_isl | 完整输入准入检查、非预分配、开关默认及新版 watermark 条件 |
| W1684 | scheduling_policy | fcfs/priority、数值越小越优先、同值按到达时间、受抢占者与等待准入边界 |

主参考为 [Scheduler](../../../wiki/concepts/vllm-scheduler.md#怎么开)。[异步](../../../wiki/concepts/async-scheduling.md#怎么开)保留完整判定和执行机制，增回链与版本行；[分块](../../../wiki/concepts/chunked-prefill.md#怎么开)保留算例和历史尾注，补联动条件；[PD](../../../wiki/concepts/pd-disaggregation.md#版本差异)纠正平台重置的条件与调用先后。Balance Scheduling / Short Request First 仅同步 Scheduler 新锚点及 running 场景条件。

async_scheduling 的别名保留在异步机制页：其连字符形式正是已有页 ID，强行移交会产生重复别名。其余九项的两种词形都归 Scheduler；没有修改检索算法。

## 独立审查与修订

新的 scheduler_independent_review 审查者核读固定源码、实际全文、本轮 before/diff、两张图，并独立查看 34 张浏览器截图。正式结果见[独立审查](scheduler-independent-review.md)，无未关闭的 P1/P2。本轮修订包含：

- running 可含未完成 prefill，不能一概按 GLM decode 的 4 个位置扣；保留 128、8068 与场景 M 算例，补齐成立条件。
- 队尾抢占仅属于默认 fcfs；图注和误解条目同步 priority 的选择条件，保持图布局。
- waiting 先按正阈值截断，再判断关闭分块时是否超过预算；示例输入 100、预算 100、阈值 20、关闭分块仍排 20。同步相关旧句。
- 两个 partial-prefill 参数有字段不等于可启用：前两版入口拒绝非 1，main 删除；Ascend 平台只在属性非 1 时重置，不能绕过更早的上游拒绝。
- 含源码区全文的行内代码密度超标处只去掉重复底色，保留事实、标识和来源；dunder 名保留代码格式以免 Markdown 隐藏下划线。

独立执行 58 项真实配置函数/分支检查，脚本采用 AST 提取原函数体与明确桩对象，不导入 Torch/NPU；覆盖默认派生、联合校验、partial 拒绝、阈值版本边界以及三版关分块组合。全部通过，不将这些静态执行称为设备实测。

## 实际验证

| 验证 | 结果 |
|---|---|
| pnpm -s wiki:build | 167 页索引生成成功 |
| pnpm -s check:content | 11 个主题、167 篇完整且无目录重复 |
| pnpm -s wiki:lint | 通过，8 项既有范围外提醒 |
| pnpm -s wiki:audit | 104/104 强制名单页通过；4688 条来源，无无效 commit、缺文件、越界或未知仓库 |
| pnpm -s wiki:diagrams / --check | 331 张图一致，修改两张调度图的说明和一个副标题，布局未改 |
| pnpm -s build | tsc -b 与 Vite 生产构建通过；保留既有构建警告 |
| CLI 检索 | 10 参数 × 下划线/连字符，共 20/20 首项精确命中预期页 |
| 浏览器检索 | 10/10 唯一匹配，逐项点击到预期页 |
| 浏览器阅读与链接 | 主页面前两屏、两图、参数表、默认顺序、阈值反例、版本表及 calc 可读；异步/分块/PD 修改落点与参考回链可达；align 校验回链落到 KV 规格报错节 |

首次 lint 暴露 async 别名冲突；章节改名后也检出了三条旧锚点，均修正。首次来源审计发现新增区间终点超过文件长度，已按原文件修到 L308。分块页新增“可能”使免责比触线，改为已复现的具体成立条件，保留原有实测缺口。最终检查通过，没有降低阈值。

本地开发预览一度无响应；普通 Python 静态服务在这台 Windows 上将 .js 返回为 text/plain，预览空白。最终以明确 JavaScript MIME 的本地生产预览完成验收。构建刷新期间一次旧资源请求失败，刷新后实际重走链接成功；未改产品代码处理这些工具环境问题。

审计另列 264 条 URL 未联网验证、1399 条 raw 引用待核；这些是全库检查能力边界，不代表本轮新增结论已由自动程序认证。浏览器检索验证覆盖检索和页面到达，没有运行生成式问答评测。PD 既有宽版本/源码表仍可横向滚动，本轮新增重置说明正常显示。

## 保留与密度

改前清单和快照在 tools/wiki-runtime/scheduler-20261031/preservation.md。逐项保留主循环四关、权重与层数、GLM 8192/32/MTP3、R1 引用、场景 M 与容量边界、KDA none/align、BalanceScheduler 接线及原有待核。已有推导继续引用唯一出处，没有复制 GLM 块池预算或重新推导跨 DP 补齐。

独立密度统计见同目录 independent-metrics.json：按去 frontmatter/代码围栏/机器尾注后的汉字计数，四页教学区行内代码和证据角标均为 0；含源码区全文行内代码均低于 13/千汉字。全页角标分别为 24、27、30、29，C 占比均低于 80%。首图前无 calc，两张调度图宽均 880；分块机器历史尾注与改前逐字一致。各 calc 保持既有小节分工。

证据目录还保存 independent-checks.py/json、六页本轮 diff、构建与校验日志、retrieval.json、ui-retrieval.json 和浏览器截图。前序批次未提交修改与并行工作按 before 快照区分，没有回滚或计入本轮。

## 剩余事项

需用户决定的事项：无。固定部署的真实 async 开启日志、实际调度器继承链、预算与 kernel 对齐及性能对照仍按原页待核保留。本批完成的是参数说明与文档验收，不宣称部署支持所有组合。
