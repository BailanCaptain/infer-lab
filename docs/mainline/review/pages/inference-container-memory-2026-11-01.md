# 容器内存、OOM 与多轮排查复核

2026-11-01。本轮承接[上一批多轮排查](inference-multiturn-2026-11-01.md)留下的外部依据缺口：容器为什么会在整机仍有空闲时退出，退出码与 OOM 计数能证明什么，以及恢复后怎样判断可以结束。

六份官方文档已核读，必要解释补进现有内存页，排障入口只负责引路。四条新三轮案例经真实站内接口逐步提交；三条在修订后完整回归，第四条作为留出题首次运行。最终十二轮的阶段判断经逐答复核达到本批要求：两条在约定范围内收束，一条因延迟不达标继续，一条修好 OOM 后因质量下降继续。没有新增教学页或图，也没有把这次文字分析当成真人学习或实机恢复证明。

## 已核清的依据与页面归属

| 依据 | 支持的判断 | 仍需现场确认 |
|---|---|---|
| [Linux 6.12 cgroup v2](https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html) | 控制组可嵌套，子组还受上层预算约束；high 导致回收节流，本身不调用 OOM killer；max 在无法回收满足申请时可能触发组内 OOM | 实际内核、控制组版本、路径、各级预算及故障窗口 |
| 同一 Linux 文档的事件与统计说明 | oom_kill 统计本组成员被任一种 OOM killer 终止；local 说明计数范围，不能证明限制起因就在本组 | 同一次运行的计数增量、匹配内核记录；memory_localevents 对层级汇总的影响 |
| [Docker 资源约束](https://docs.docker.com/engine/containers/resource_constraints/) | 容器额度与整机物理容量不同；没碰子容器限额不能排除整机压力 | 当时的整机与同机任务占用，不能用重启后的低占用代替 |
| [Docker 退出信号](https://docs.docker.com/reference/cli/docker/container/ls/#filter-by-exit-signal)、[Docker kill](https://docs.docker.com/reference/cli/docker/container/kill/) | 137 不能单独证明 OOM；docker kill 默认向容器主进程发 SIGKILL，--signal 可以覆盖 | 实际命令、对象和时刻，不能看见 kill 字样就判误杀 |
| [Kubernetes 资源管理](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)、[内存练习](https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/) | request 与 limit 用途不同；终止记录可关联容器 ID、退出码、原因和时刻 | 不假定不同版本都把 limit 映射为 high；OOMKilled 标签不独自决定故障层 |

唯一机制出处仍是[主机内存与显存](../../../../wiki/concepts/device-memory.md)。新增段落先解释“容器分到的预算”和“上层共享预算”，再给三个初步动作：对齐运行身份、查谁终止了进程、确认限制在哪层。详细字段表放在后面的“会报什么错”，每项都解释用途和不能单独证明的结论。20 GiB 情境明确标为教学示意，原有设备搬运、双份占用、版本内容与两张图保留。

[推理排障入口](../../../../wiki/concepts/inference-troubleshooting.md)只增加分流：进程退出先查终止证据，主机／容器压力与设备显存不足分开。测量口径、恢复验收、质量排查继续引用原有页面。来源分级复用现有匹配逻辑，只登记六份文档对应的固定文件或窄路径；没有开放整个站点，也没有把允许引用等同于所有结论已验证。完整事实与边界见[核对记录](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/source-verification.md)和[独立内容审查](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/content-review.md)。

## 新案例怎样测试

问题和私有判据先冻结，再通过前端代理 `POST http://127.0.0.1:5173/api/wiki/chat` 提交。请求正文只有当轮问题与后续轮的 sessionId，不附指定页面、未来日志或评分答案。每条链依次给出现象、定位证据、复验数据；C4 另行冻结并保留未调用，最终修订后首次运行，未提前用于调规则。全部日志均为教学合成数据，不伪装成真实事故。

| 案例 | 第二轮新证据要求的转向 | 第三轮应作的决定与实际结果 |
|---|---|---|
| C1：夜间清理后退出 137 | 审计命中实际 docker kill，转查清理脚本，不缩 KV；一次手动回答仅证明可用 | 原负载复验成功率 99.8%，首段达标率 96.4%／96.0%／96.8%，质量与资源通过；回答认可这组条件内收束，保留原事故损失。[最终答卷](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/runs/C1-final-loaded/turn-3/answer.md) |
| C2：没 OOM 但变慢 | high 回收等待与时间线吻合，做单变量对照；不把回收改善当成整个服务达标 | 首段达标率 92.0%／92.8%／92.4% 低于 95%；回答拒绝通过，保留其他已过指标，只追剩余等待。[最终答卷](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/runs/C2-final-loaded/turn-3/answer.md) |
| C3：子组出现 oom_kill | 匹配内核记录明确 global OOM，转查整机与同机任务，不提高受害容器限额 | 原推理与离线任务一起复验，成功率 99.5%、首段 97.1%／96.6%／97.3%、质量与资源均过；整机最低 9 GiB 高于约定 8 GiB，回答在现有负载范围内收束。[最终答卷](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/runs/C3-final-loaded/turn-3/answer.md) |
| C4 留出：邻居启动后 OOMKilled | 内核记录明确上层共享 40 GiB 预算触发，转查上层及后代占用；不把本组 local 计数当本组超限 | 内存隔离后无新 OOM，成功率、延迟、资源通过，但事实题 46/50 不满足 50/50；回答拒绝整体验收，下一步先比模板展开后的实际输入编号，再按结果分流。[最终答卷](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/runs/C4-holdout-loaded/turn-3/answer.md) |

原题、评分点和冻结时间见[前三题冻结记录](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/freeze.json)、[留出题冻结记录](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/freeze-holdout.json)。每轮完整请求、SSE、回答、知识版本、实际审阅输入与会话前后状态保存在相应 runs 目录。请求的模型为 Codex provider 的 gpt-6.1-sol，不能据配置名称独立证明底层服务身份；未见联网事件也不等于独立证明完全离线。

## 测试发现的问题怎样处理

**首答还是过密，问题在回答选择。** 原页已经把字段表后置，但 C1、C3 初答仍展开尚未选中分支的全部字段和未来验收表，C2 重试也出现同样问题。自动 covered 没发现这项阅读负担，逐答审查将其记为 P2。修订共用查询规则：先给足以分流的一至三项动作和结果判读，保留用户已给目标；进入实验或采用修改时再逐项展开验收。第一次修订仍不充分，保留 staged 答卷，再修改并回归；没有通过增加一页“简版教程”解决。

来源表增加后，既有系统提示长度测试失败。处理方法是把重复的来源边界集中表达，保留版本、硬件、路径、论坛和未核实材料的限制，没有放宽 6500 字符阈值。独立审查指出两处精度损失，随后恢复“搜索没有依据也要说明缺口”和“程序提供的原始编号链接”。原负载已声明沿用时，也不再要求重复确认相同数值。

**自动审阅混淆了初步取证和上线验收。** C2-final 首答只说三项证据足以决定走哪个分支，却因未提前列完所有上线指标被判 answer-error。独立复核确认这是阶段误判；原 verdict 保留，没有改写成通过。只在现有审阅规则增加阶段判断，其他引用和错误校验保持原状。

随后用捕获的 C2 首轮原回答、原材料重放，仅替换新增规则段及唯一观察标识，返回 covered；再用 C2 第三轮材料构造“明知 92.4% 低于 95% 仍宣布通过”的错误回答，返回 answer-error。两次属于审阅器控制实验，不计入站内回答数量，也不是两个新的未见案例。冻结输入、实际模型输入与结果见[审阅回归](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/reviewer-regression/freeze.json)。

另一项有效反馈来自 C1 staged 第二轮：审阅为 undetermined，具体缺的是 docker kill 默认信号依据。核读官方文档后补进同一内存页，再完整回归 C1。这是事实依据的补充，与上述评分误判分开处理。

## 证据与限制

本批一共 **31 次站内请求尝试，29 次完整，2 次传输中断**。失败分别为 C2-loaded 首轮响应中断和 C3-staged 第三轮连接失败，原因未查明；重试另存目录，不覆盖失败，也不声称传输问题已修复。早期五次追问遇到知识更新重置，不能当作同版本完整历史验证。

最后的 C1/C2/C3 各三轮和 C4 三轮，共十二轮均完整；每条链内部同一会话、同一知识版本、无重置，历史长度 1→2→3。C4 使用最终审阅规则，前三条 final 链在这段审阅规则修改前完成，两组版本不混称同一版本。自动结果合计 **11 covered、1 answer-error**，后者即上述保留的阶段误判；人工逐答结论与自动状态分别记录，见[独立答卷审查](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/private/answer-review.md)。

[完整调用清单](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/call-inventory.json)和[证据一致性校验](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/evidence-integrity.json)核对冻结材料、请求、回答／SSE 哈希、实际审阅引文及历史。108 条引文在其当次材料中存在，29 次完整回答确实保存，14 次同版本追问的审阅输入含上轮实际回答。这些检查证明记录可信，不代替内容正确性判断。

本轮验证结果：

- 179 项相关测试通过，覆盖来源分级、手册、检索问答和回答审阅；没有删除断言或降低阈值。
- `pnpm check:content` 确认 167 页、11 主题正文完整无重复；`pnpm wiki:audit` 的 104/104 名单页写作标准与本地引用检查通过，275 条 URL 和 1723 条 raw 摘录仍属全库待核范围，不能由脚本通过推断已联网核实。本轮六份外部来源另行核读。
- `pnpm wiki:lint` 通过，保留 8 项既有非阻塞提醒；来源配置和测试的定向 Biome 检查通过。`pnpm build`（含 TypeScript 构建检查）通过。保存日志分别为 [测试](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/tests-final.log)、[内容](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/content-final.log)、[引用审计](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/audit-final.log)、[Wiki Lint](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/wiki-lint-final.log)和[构建](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/build-final.log)。
- 项目 Biome 默认范围不含 server。审阅文件另取逐字副本，以同一组 lint 规则检查，通过且未自动改写，见[定向记录](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/reviewer-lint-file.log)。此前 stdin 检查返回工具级“contents aren't fixed”，即使输入与输出相同仍退出 1，因此不把该尝试算通过。
- 已用本机 Chromium 实读两个修改页、原图、新增三步和字段表，点击页内锚点与跨页链接，核对最终 34 条来源中的新 Docker 链接。390px 宽度下字段表可横向滚动 104px，页面本身无水平溢出；记录与截图见[浏览器验收](../../../../tools/wiki-runtime/inference-container-memory-2026-11-01/browser/browser-check.json)。内嵌浏览器当时导航失败，因此不冒称使用其完成阅读。

知识库的具体帮助可以追到输入正文和答案：用 137、local 计数的边界阻止错误调参；用三级预算区分改变排查方向；用原有质量、延迟和资源规则决定继续还是收束；用既有输入编号排查顺序承接新的质量问题。没有同步无库组，因此不计算因果增益；也不能据 agent 答对推断初学者已经学会。真人试读、目标设备验证和正式十二题有库／无库对照仍按[原验收方案](../../../superpowers/plans/2026-10-31-inference-user-field-acceptance.md)执行。

当前授权范围内无需用户再决定内容归属；外部机制依据已补齐到原页。真实环境的版本、预算、日志与测量值仍需现场提供，不能从这些合成案例推出现场根因。

后续追查另见[传输中断与新多轮报告](inference-transport-followup-2026-11-01.md)：C2 的配置依赖重启／代理截断有新增日志和复现证据；C3 的确切触发原因仍待核。本页保留当时两次失败与当时结论，不将后续九轮完整调用回填成旧尝试通过。
