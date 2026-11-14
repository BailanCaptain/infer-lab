# 调度与并发：内容与视觉独审通过

审查者 `/root/groups_recompute_review`，日期 2026-11-10。依据 `docs/wiki-writing-standard.md`；纯教学文档审查，未启用代码型技能。本轮不直接修改教学正文。

## 冻结范围

`scheduling-manifest.json` 冻结 Scheduler 61、并发 45，共 106 个旧引文出现项；104 个固定源码区间（累计 4276 行，含重叠）和2个 raw 拼接档案，共45个版本文件。另组已关闭的 RecomputeScheduler16没有重计。新官方全文、后续新增引用、静态图与浏览器操作分别记账。

已完整读两页当前正文和现有参数/版本/来源表，已读全部104个固定区间并按消费者补读；不是只查行号。raw共75段与固定原文匹配（4段仅归档时去掉首空行），只说明档案完整性，见 `scheduling-raw-integrity.json`。

## 本轮发现与修订（已逐项复审关闭）

| 级别 | 位置 | 问题与影响 | 原始证据 / 修法 |
|---|---|---|---|
| P1 | Scheduler 首两屏 | 1440×1100 的第二屏只到动机开头；读者能复述预算/借块，却看不到 running优先、分块或抢占的明确代价 | 初始 top/second 截图；首图前补短段成本，保留后文机制 |
| P2 | 两页版本区 | Scheduler rc2仅短段、主参数仍三版；并发没有四版逐行为比较 | 对照四版固定配置与消费者，不能用“流程相同”冒充执行数值相同 |
| P2 | Scheduler 参数与变体连接 | 已有v26/main来源含prefill_schedule_interval但未解释；batch-job已存在本站深入页却未在新版本变体表连接 | 568配置153–156、840配置185–188；需核EngineCore消费者和CLI后补用法/等待代价；回链已有变体页 |
| P2 | 并发 KDA 来源15、16和源码位置 | 引用旧 AscendGlm5NextLinearAttention 类，实际层构造使用 KimiGatedDeltaNetAttention | db701c1f glm5_next2081、utils763–768、ops/kimi_kda355–475/506–659；改指实际构造、替换版本门与执行函数 |
| P2 | vllm-scheduler-flow | 把两队统一画成阈值→预算→长度、0就跳过，模糊waiting的禁分块检查顺序与0时break | 0fc scheduler403–416、689–733；图中区分两队裁剪/停止分支 |
| P2 | 并发“两组每一步的宽度…都由更忙的那组决定” | 超出场景M的泛化，与前文eager组可保留本地宽度矛盾 | db701c1f runner733–738/2979–2982；限定本算例，MoE内部补齐另说 |
| P2 | v0.26 Balance 版本表 | “混合模型会临时置假”范围过大，实际仅 KV producer 且存在 Mamba 层 | 2ed6cbba patch_balance_schedule123–178；根已收窄，待最终冻结 |
| P2 | 并发主干宽度与算子工作量 | “45层与三遍草拟都按6048跑”会误导为所有算子处理全部填充历史 | db kimi_kda477–504 metadata空返回、缩num_actual_tokens；根已区分调用宽度与实际计算 |
| P2 | 图来源 | 输入图仍引用未构造的旧KDA类；MoE图的TP归约柱缺实际归约消费者pin | 根已收到，需随正文补实际版本路径 |
| P2 | 并发KV算例及跨页尾状态例 | “还1499后1523变25/1501变3”漏说同轮新借1块，读者无法核算 | 0fc single_type_manager260–290/448–501/786–793；净释放1498，已报根协调跨页 |
| P2 | Scheduler 四版变体表的信息保留 | main格变成笼统“按开关选择”，删掉原有short-request结论，且未区分main同步profiling与rc2异步MRV2门 | 实读baa platform954–982/1254–1279、7d1041–1076，补回具体类与组合限制 |
| P2 | 并发KV表的实际呈现 | 多个未转义数字范围~被GFM渲染为删除线，公式变成1516/4748等且跨格出现加粗残片 | 真实截图 `review-browser-final/concurrent-requests-table-5.png`；改用范围连接符后重新实看 |
| P3 | Scheduler 新来源索引 | 62–72误写含CLI；97–102误称覆盖waiting消费者 | 去掉错误CLI归属，waiting改指86/95，与实际引用编号对齐 |

### 补证自身的更正记录

独审初版新增候选17误选 `db701c1f:fused_moe.py550–580`，该类位于非v0.23的else分支。根复核发现后，独审实际读版本门290–298、`fused_moe_0_23_0.py69–101/275–290`、上游MoERunner644–680以及注册消费者159–167/271–277，将17改为真正的v0.23实现。错误初证没有当作最终通过；JSON `corrections`保留原ref与原因。实际链条支持普通AllGather合并后TP归约，MC2等已有归约路径避免重复。

初批新增候选共72项，位于 `.tmp/continuation-groups-2026-11-10/scheduling/review-evidence-additions.json`：71个新source、1个复用扩展后的旧范围。之后追加main/rc2变体3个新source，共74新增；另9个消费者只进readscope，不增加source计数。仅声明明确读过的区间；保留完整父文件用于复现，不把这些文件全部计为全文阅读。最终来源号与迁移身份由独审账绑定，Scheduler现105、并发现75，共180个来源出现项。

## 初始浏览器与复述

已实际打开5201两页并操作内部链接，初始输出在 `.tmp/continuation-groups-2026-11-10/scheduling/review-browser/`。两页截图已实际查看前两屏：Scheduler可复述“每步在位置预算、名额与KV池内挑请求”，但成本未到首两屏，记录P1；并发可复述“批成员逐步加入/退出、状态独立，代价是重拼输入、两组对齐和更大的专家通信”，首两屏通过。静态图和长表仍需逐项完成视觉复审。

## 官方目录反查

已从固定官方目录反查并全文读：0fc `docs/configuration/optimization.md`462行、`docs/serving/data_parallel_deployment.md`133行；Ascend7d825229 `batch_job_aware_scheduler.md`150行、`balance_schedule_refactor.md`562行。文件/指纹见 `.tmp/.../scheduling/official/inventory.json`，新增与复读身份须与全站账去重后计数。

优化指南“先所有decode再prefill”的概括不能覆盖源码的running内部分prefill；本站已有更精确解释保留。Balance设计稿存在历史v0.24语境，不能用其提交文本直接宣称rc2实现完全相同；已定向核该提交配置与关闭/gather消费者。DP文档2张参考图已从固定Git对象提取并实际查看，分别解释内部共享HTTP入口与外部各rank入口；关联资料并未因为母页全文读完就全算覆盖。

2026-11-10 中途再次打开5201时，HTTP200但Scheduler显示“该页暂不可用”，无pageerror；本轮修订浏览器尚未通过，诊断图在 `scheduling/review-browser-diagnose.png`。初始图截图仍可用于核查未改内容；部分截图被固定导航遮住，最终截图须避开遮挡后重看，不能拿初始截图冒充最终版本。

## 最终复审

106个旧项逐项人工账与74个新增source完成内容复审；两处扩range保留身份迁移，两个raw仅归档完整性、两个旧KDA范围仅作背景，均未伪装成新的语义支持。四版参数、生产者/消费者、算例与必要调用方已经分别核查；详见 `scheduling-manual-judgments.json`、`scheduling-independent-additions.json`。

本轮归并记录1项P1、11项P2、1项P3，根修订后均已复审关闭。flow自抢箭头已直接到结束；输入图改为实际KDA来源；MoE图有v0.23归约证据；KV表范围符号恢复正确显示，跨页说明补齐释放/再借的净额。此前“该页暂不可用”已恢复，旧失败保留为历史，不算最终通过证据。

浏览器实做：`node .tmp/continuation-groups-2026-11-10/review-scheduling-browser.mjs .../review-browser-final` 实点45+52条内部链接，均到达正确页及锚点；实际看完10静态图、7个calc、20表和两页首两屏。最终局部脚本 `review-scheduling-close-browser.mjs` 再打开两页和块分配关联段，查看修复后的flow、版本表、KV表，实点新增HTTP准入回链；三个页面无溢出、误删除线或pageerror。截图与JSON在 `scheduling/review-browser-final`、`review-browser-close`。

首两屏复述和信息保留见 `scheduling-preservation.md`。最终23文件快照及页/图指纹见 `scheduling-independent-acceptance.json`。五份官方全文、两幅官方参考图单列 `scheduling-official-coverage.md`；首次阅读数仍须全站去重。

**内容、视觉与工程五项通过。** 根运行的最终content/diagrams/build及lint/audit重跑日志已经独立读取，回执在 `scheduling-engineering-receipt.json`：164页、7183来源、104/104写作标准页、341图；lint实际10条、图检查90条既有非阻塞提示，未写成零提示。没有重冻或改动已验收页面哈希。 仍无NPU执行、吞吐/时延、故障超时或全站阅读完成结论；教学3D文件未改，也没有归属其他会话的3D验收成果。未关闭内容P1/P2：无。
