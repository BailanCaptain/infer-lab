# 请求链与进程组独立审查

审查者：`groups_ucm_review`。本组只审查教学事实、信息保留与页面表现，没有修改教学页、图或产品代码；未启用代码协作技能。

**本组验收关闭：148 个冻结旧余项、62 个本组新增补证均有独立逐项判断；内容、保留清单和最终链接复测通过，无未关闭P1/P2。** 不能把这一组解释为全站完成。

## 范围与证据

冻结来源为 `continuation-500/reconciliation-after.json` 中本组三页的 `baseline_remaining`：request-call-chain 70、engine-processes 62、vllm-v1-shape 16，共 148。已有前 500 与随后 225 闭合项均不重计；作者后补来源另记，不塞进 148。

- `request-processes-manifest.json`：修订前的 148 身份、来源范围与 21 文件 SHA；原文与九图保存在 `.tmp/continuation-groups-2026-11-10/request-processes/before.zip`。
- `request-processes-independent.json`：148 项分别写了主张、版本/条件范围、语义证据和人工判定。没有以行号有效或旧报告通过代替支持判断。
- `request-processes-new-independent.json`：62 个新增项分别写了当前编号、固定原文、主张、语义证据与人工结论，engine32、request21、shape9。当前三页全部来源分别为141、93、50；没有把总量284说成本轮新核284。
- `request-processes-range-adjustments.json`：6处既有范围扩展逐项复核；4项在旧148中，另2项属于已有补证，只记扩范围复审、不重计闭合数量。
- `request-processes-reading.json`：实际阅读范围、固定 hash、全文与片段、复读与首次信用分开。独审复读不自动加到 root 的首次官方全文累计。
- `request-processes-preservation.md`：部署数值、进程账、状态、通道、图与缺实测边界的保留清单。
- `request-processes-supplement-evidence.json`、`request-processes-rc2-table-evidence.json`、`request-processes-old-pending-evidence.json`：作者可选补证及每条主张；这些是证据候选，不是自动新增教学来源数。

三页完整正文、源码区、九图的文字/分支/图注，以及前批 200 的报告、独审和两页最终 diff 已读。之前核过的部分仅作为保留背景，本轮 148 仍各自判断。

两个旧 raw 共 103 段与固定 Git 内容比对；只有两段少了首个空行，代码语义相同。已读范围复用本轮读过的固定源码，额外未覆盖的 1,196+282=1,478 行又实际读完。未把 2 个 raw 计作 2 篇新增官方全文，也未把比对一致自动当作语义审查。

## 发现及作者修订要求

| 编号 | 级别 | 修订前位置与问题 | 影响、依据与修法 | 复审状态 |
|---|---|---|---|---|
| R1 | P1 | shape 前两屏只有角色、分工与轻计划，代价段在后续屏幕 | 写作标准初学者测试要求前两屏能复述代价。补一句跨进程打包、队列/状态同步成本并回链 engine，保留后面的完整三笔代价 | 已实际浏览器复审关闭；1440×1100 首屏见 `review-browser/review-shape-p1-after.png` |
| R2 | P2 | shape 四版表仍将 98dff2a8 的 0.29 历史点放在 main 配套行，页末又说版本不是固定 commit | 98 是历史对照；840 是本轮固定上游比较点，不能声称与 baa Ascend main 精确配套。补 ced/7d rc2，区分各侧固定身份与实际镜像安装边界 | 关闭；四版表及历史说明实际文本/浏览器复核，rc2配套上游身份已写清 |
| R3 | P2 | engine 详细解释 DP headless，但未在本页连接跨机模型组 follower 的 headless | 0fc serve173–253 与 ced179–263 都有两分支：node_rank_within_dp>0 建 MultiprocExecutor，否则建本地 DP EngineCore。链接 PP/DP，明确 GLM TP8/DP2 不是 nnodes2 的同一模型组 | 关闭；新增两行拓扑表及紧随其后的GLM范围实际阅读 |
| R4 | P2 | rc2 参数/patch/timeout 表缺少逐行对照，已有 rc2 总述不能替代表内覆盖 | 实读 rc2 新范围，并逐段比较 12 个既有840上游片段，完整读九文件差异。rc2 有 <1836→3000；start_rank显式0、RPC端口上下界、CANN设备映射、EngineCore新入口等分别记录 | 关闭；21行补证落实到逐项表。patch表长路径移表后，最终列完整可见，路径与赋值未删除 |
| R5 | P2 | request rc2 “命中多 KV 组时”略去了选择依据；engine 共享准入只讲槽位 | proposer predicate 看草稿模型类型/架构白名单；准入消费者使用共享请求计数，token阈值不能同称共享。补条件并回链 api-server-entry 已有解释 | 关闭；main/rc2白名单分别读取，main不照搬rc2内部图能力。准入文字区分近似全局请求数和本地token |
| R6 | P3 | engine#88 到125行；request#26 到660行、#40 到290行，未含被描述的最终调用 | 邻接源码实际读到 get_physical_device_id return126、queue.put663、callback291；扩大到126/675/295，固定提交/路径身份不变 | 关闭；6处总扩范围另账，其中本条3项保持旧148身份；另3项补证扩范围不重复计新来源 |
| R7 | P2 | 两处旧“待核”已可用静态链回答 | 默认GLM APC关闭→原工厂 NoPrefixCache；spawn正常完成握手上下文收尾时post_init→平台→配置。两者均保留有效参数/真实安装未实测边界，不推定运行MRO | 关闭；默认与显式APC分开，初始化明确晚于核心构造；main剩余范围收窄至未选用路径/组合与真实安装 |

曾核查 batch queue 中 `is_ec_consumer` 条件是否导致普通 GLM 不能执行；扩大阅读 core200–203 确认无 EC 配置时为真，疑点已排除，没有列为产品缺陷或要求错误修订。

## 官方目录反查

实际全文阅读固定0fc的 arch_overview、multiprocessing、model_runner_v2、optimization、parallelism_scaling、data_parallel_deployment、distributed_troubleshooting 七篇。前六类中的六篇还比较 0fc/568/ced/840 共24版本；10种不同正文的差异均实际读，optimization另占一个独立全文。不同提交内容相同者复用，不重复算新篇。

实际看过架构五图、MRV2五图及DP两图。架构旧图的 2+N 概述不能覆盖本站更精确的 uni、DP、PP 条件；multiprocessing 的 2024 历史方案不能代替当前固定代码。官方 CUDA/NCCL/GPUDirect/NUMA 自动探测条目不能直接当 Ascend 实机说明。

反查形成 R3、R4、R5，并确认官方新DP说明的 admission limits 总述比消费者源码宽：请求数近似跨API共享，当前 token 检查仍在本AsyncLLM。没有将这些文档的通用或旧表述无条件复制进教学页。

外部资料方面，固定 GLM 官方教程全文与 CANN9.1.X 五篇相关变量全文实际读完；PyTorch2.10 distributed 只读网卡选择节及邻接内容，不声称读完一万多行整页。固定 PyTorch/Ascend-PyTorch/Gloo C++只读所需范围；TP_SOCKET_IFNAME常量另定位并读到。负面主张的固定运行包检索命令、返回码和输出保存在 `review-negative-searches.json`，不外推到未检查的二进制。

## 浏览器证据

地址 `http://127.0.0.1:5201/#/wiki/<id>`。脚本和证据位于 `.tmp/continuation-groups-2026-11-10/request-processes/review-browser/`。

- 三页前两屏逐一实际查看；九图、26表、engine唯一calc逐一实际查看，图状态均ok，页面运行错误0。首屏发现R1；未发现文字遮挡、箭头错接或表格断裂。
- 88个唯一站内目标（含锚点）在51个路由实际加载并检查目标ID，失效0；每页另实际点击一条页面链接，目标标题/URL均符合预期。`review-links.json`保留结果。
- 元素截图个别顶部被固定导航覆盖，但相应标题已在首屏及整页滚动中读到；不把截图裁切误报成产品图缺内容。最终受改动范围会重新截图检查。

最终页面证据在 `review-browser-final/`：三页共九图、28表、一个calc，脚本运行错误0。九图全部字节不变，复用已实际查看的原图结论；实际复看新增/修改的headless表、shape四版表、request普通step/timeout/协调器表、engine参数/patch表。patch最后一列最初过宽，经作者将长代码路径移表后，再截图实际查看确认完整可读。不是仅以截图生成成功作视觉通过。

最终链接回归共91个唯一目标（51个路由），最初90个通过；`vllm-scheduler` 在站点显示“该页暂不可用”。独立脚本从shape实际点击同样复现，页面无JS错误，文件和registry条目均存在。作者定位到调度器页新relation使用schema不支持的related，修为builds-on；独审随后再次从shape点击，目标标题正确、wiki-body出现、运行错误0，并实际查看恢复截图。此P2已关闭，正确回链未被删除。`review-links.json`和`link-failure-1.png`保留最初失败，`review-scheduler-link.json/png`记录修后实际点击，最终91目标通过。

## 固定交付与边界

三页完整差异已逐段读，保留清单逐项确认；9对图与改前字节相同。21文件最终内容快照为 `.tmp/continuation-groups-2026-11-10/request-processes/reviewed-after.zip`，SHA与文件逐项指纹见 `request-processes-checkpoint.json`。来源扩范围不改变旧项身份；既有500/225关闭项重计为0，独审新增全文信用仍为0，交根账本按原文hash去重。

`verified` 登记四版的依据是正文已经明确限定、逐项核过的控制流、参数/patch、Worker/Runner与命名比较；不表示不含同名模型的旧发布分支已运行GLM七站，不表示840与Ascend main已证明精确配套。旧专用配方的数值、45层/三候选、20进程角色账及实机边界均保留。

主线程报告并提供 content/lint/audit/diagrams/build 五项exit0日志；独审实际读取日志尾部确认164页、341图及内容/行号检查通过，lint仍有既有非阻塞提示。它们不替代本报告语义判断；独审没有冒称亲自执行这五项。最终metadata/表格排版后的主线程增量检查另由其记账。

未运行 NPU、未启动真实分布式模型、未测硬件性能或真实进程数量。暂缓V2、其他线程3D页面与表外全部MRV2/PP组合未纳入本次验收；无要求用户决定的事项。

2026-11-11 终审计数更正：上述六条的原始逐项记录未变；按 ledger_kind 重算为旧148内4条、已有补证2条，修正原汇总的3+3。148与62的闭合数量均不变，未新增任何核验信用。更正前文件与 SHA 见 request-processes-count-correction.json。
