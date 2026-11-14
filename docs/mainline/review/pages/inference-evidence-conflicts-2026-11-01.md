# 证据不完整或互相矛盾时，多轮排查能否继续

2026-11-01。本轮按用户要求保留旧 C3 中断待核，不继续追查。新编三条三轮案例，通过真实站内问答逐步提交现象、补充记录和验收数据，检查回答是否会调整判断，以及能否区分“结束错误分支”“整个问题通过验收”和“缺证据，暂不能决定”。

三条完整链的九个阶段均满足本批必要判据，另有一次保留的首轮回答；共十次 HTTP 问答完整返回。一次第二轮材料准备失败未发出 HTTP，原记录另存。没有发现需要补教学内容或修改回答规则的缺口，本轮没有改产品代码、教学页、图、提示词或评分规则。

## 题目怎样准备，怎样进入产品

独立设计者对照旧批题目和已有原页，先冻结[题目](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/cases.json)、[私有判据](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/private/criteria.md)和[设计说明](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/private/design.md)，再调用产品。[冻结记录](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/private/freeze.json)早于首个请求，复核哈希未变。

每条链独立会话，只向 `http://127.0.0.1:5173/api/wiki/chat` 发送当轮 message 和后续 sessionId，不给指定页面、评分依据或未来日志。第三轮不重述第一轮门槛，用来检查回答能否继承目标。题中日志、设备时刻与复测数值全部是合成前提，实际执行的是知识库问答，不是设备实验。

## 三条链分别作出了什么决定

| 案例 | 新证据怎样改变判断 | 末轮验收与停止位置 |
| --- | --- | --- |
| E1：监控说首段等 1.23 秒，网页却是 0.35 秒 | 先核事件边界和时钟；尚未校时时，不把跨机相减的 0.95 秒当网络耗时。补到服务时钟慢 0.900 秒后，解释出发出至服务收到约 0.020 秒、服务内 0.280 秒、写出至客户端收到约 0.050 秒 | 三轮成功率 99.7%／99.8%／99.7%，按时看到正文比例 97.4%／97.0%／97.2%，质量与资源也通过。可以结束这次误报及无依据的代理调参；明确这是修正测量，不是服务提速。[末轮原答](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/runs/E1-rerun-loaded/turn-3/answer.md) |
| E2：函数 0.20 秒返回，被摘要写成设备算完 | 同批设备事件仍持续到 1.05 秒，结果 1.06 秒才就绪；回答撤回“后面 0.90 秒都在返回”的归因，不因摘要是自动生成就优先相信它，也不把设备区间全称为纯计算 | 成功率、质量和资源通过，但正文达标率 91.2%／91.9%／91.6% 均低于 95%。只结束报告边界争议，保留性能问题，下一步缩到同一慢批的执行空隙与依赖。[末轮原答](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/runs/E2-loaded/turn-3/answer.md) |
| E3：先怀疑量化，后来质量报告又互相冲突 | 共同前缀处的原始候选分数相同，处理后排序改变，转查生成规则，限定为该样本首次分歧。末轮面对“99/100 正确”和“四道关键字段错误”，不按新旧、自动或人工身份选一个相信 | 保留已能关联到 T9 的成功率、延迟和资源通过；质量暂不能判。先补完整响应、运行对应和逐题评分，找不到则按原固定题集重测质量。同批确认至少三题错误即不通过；完整可追溯地确认至少 98/100 正确才通过。配置没变就不强求重跑已有性能记录。[末轮原答](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/runs/E3-loaded/turn-3/answer.md) |

逐答语义审查见[独立答卷复核](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/private/answer-review.md)。自动审阅十答均为 covered；语义复核另看取证是否具体、如何解释冲突、何时停，以及是否保留原质量、延迟、成功率与资源要求，不以自动状态代替阅读判断。

## 已有知识具体帮在哪里

本批可追到原页的帮助是：

- **先检查记录能否比较。** [贯穿样例](../../../../wiki/concepts/inference-performance-walkthrough.md)与[性能分析](../../../../wiki/concepts/inference-performance-analysis.md)已有请求／批次关联、跨机校时、调用返回与结果就绪的区别；E1、E2 用它们撤回错误时间归因，并选择下一段记录。
- **定位第一次变化，不猜整段答案。** [输出异常排查](../../../../wiki/concepts/inference-correctness-troubleshooting.md)与[采样](../../../../wiki/concepts/sampling.md)已有共同前缀、原始分数与处理后分数对照；E3 据此把局部调查从量化转到选择前的规则，没有声称全模型数值相同。
- **有些指标通过，不替代剩下的指标。** [推理测量](../../../../wiki/concepts/inference-benchmarking.md)与[量化验收](../../../../wiki/concepts/quantization-evaluation.md)已有固定题集、评分标准、可追溯记录和全部请求分母；回答分别保留 E2 已通过的质量／资源、E3 已通过的服务指标，只继续追未通过或不能确认的部分。

这些内容已经足够支持本批的下一步动作，因此不再建一篇“证据冲突排查”，也不重复添加通用采集清单。本批没有同步无库组，能说明回答正确使用了既有材料，不能据此计算知识库相对模型自身能力的因果增益。回答步骤可执行的文字审查也不等于真人已经读懂。

## 准备失败与传输结果分别计数

原 E1-loaded 第一轮完成后，第二轮在离线重建取证材料、调用 `readKnowledgeSnapshot` 时收到共享工作锁被占用错误。[准备失败记录](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/runs/E1-loaded/turn-2/preparation-failure.json)明确为 `httpSent: false`，没有第二轮 SSE，也没有模型回答。它不算传输中断，不能从问答失败率中隐去后又声称所有试跑步骤成功。

原链与首答完整保留。停止额外健康快照探针、等 E2/E3 结束后，以 E1-rerun-loaded 新会话单独跑完相同三轮；没有改题、改门槛或覆盖原答，也没有删除共享锁或重启服务。顺序重跑完成只证明这次执行成功，没有留下失败时的锁持有者记录，不能唯一认定谁占锁或宣称锁竞争已经根治。后续同类试跑优先按链串行，减少取证工具同时读快照。

健康探针共 56 次，52 次返回 200，四次前端探针达到自设的 6 秒超时；探针包含知识快照读取，且提前停止、未覆盖 E1 重跑全程。这些探针与十次模型请求分开统计，不写成“服务全程无错误”。[范围与探针核对](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/scope-check.json)保留全部四条错误。

## 本轮验证与边界

- `pnpm exec tsx tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/verify.ts`：十次 HTTP 尝试全部收到完整回答和 done，无传输错误；35 条审阅引文逐字存在，十次完整存答、六次追问的实际审阅输入继承此前回答，冻结哈希不变。三条完整链各自同一会话，十答同知识版本、无 reset。见[调用清单](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/call-inventory.json)与[证据校验](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/evidence-integrity.json)。
- before-materials 是产品 helper 重建，并非截获提示词；本批每轮重建版本／命中匹配，实际 captured-answer 页面与答文、实际 quality-input 和引用另行核对。请求模型为 Codex provider 的 gpt-6.1-sol，配置名不单独证明服务端实际模型身份。
- 本轮只更新试跑材料、报告和计划状态；八个相关产品文件的前后哈希一致。运行器自检通过，报告本地链接另校验；没有改教学页或 UI，未重跑全站构建，也不借上轮构建结果冒充本轮代码验证。

报告与两份计划的数字、原尝试／重跑区别及结论边界另经[独立交付复核](../../../../tools/wiki-runtime/inference-evidence-conflicts-2026-11-01/private/report-review.md)，未发现必须修正的 P1/P2。

旧 C3 按用户指示继续待核，本轮不拿十次完整回答关闭它。真人试读、真实设备实验和正式十二题有库／无库对照仍按[原验收方案](../../../superpowers/plans/2026-10-31-inference-user-field-acceptance.md)等待实际证据；当前没有需要用户决定的页面归属或实现选项。
