# vLLM 与 vLLM Ascend 参数收录盘点

**当前进度（2026-11-01，GLM 必补收尾）：G1–G4 共 30/30 项已补齐，必补剩余 0 项；两个配方消费待核变量已核清。** 本轮 G2 3 + G3 9 + G4 9 共 21 项进入现有五页，独立审查发现全部修订复审关闭，CLI/UI 检索各 21/21，标准审计 104/104。累计完成 144 个历史原项，另有 6 个配方外部变量单列。全项目生产构建仍受本轮未修改的 3D 文件 TS6133 阻塞，不能称所有检查全绿。详见 [收尾交付与验证](g234-remaining-backfill-validation.md)、[完成覆盖层](g234-remaining-validation.json)。下文是各阶段历史记录，旧“剩余 21”或“下一批”不再代表当前待办；597 个可选候选未自动进入补写范围。

**当前进度（2026-11-01，G1）：通信与超时 9/9 项完成，两个配方待核变量已核清，当前必补剩 21 项。** 9 项合入现有四页；VLLM_RPC_TIMEOUT 是固定版本未注册的旧配置，TP_SOCKET_IFNAME 属当前主路径未启用的 TensorPipe。独立审查发现已全部修订复审关闭，CLI/UI 检索各 11/11，标准审计 104/104。下一批 G2 加载与显存 3 项，随后 G3 输入边界 9、G4 基础日志 9。详见 [交付与验证](g1-communication-backfill-validation.md)、[独立审查](g1-independent-review.md)、[完成覆盖层](g1-communication-validation.json)。历史口径为 123 个原项，另完成 6 个配方外部变量；以下筛选/规划段落保留各阶段历史数量，不作为当前余量。

**当前补写范围（2026-11-01）：以 [GLM 双机部署清单](glm-scope-plan.md) 为准。** 历史剩余 1,592 个原项重新筛为：24 个当前必补、597 个可选候选、971 个当前不用补；另从实际配方补出 6 个通信环境项，合计 **30 个必补配置项（16 个缺参数说明、14 个没讲全）**，分 4 批落到现有 8 页。`VLLM_RPC_TIMEOUT`、`TP_SOCKET_IFNAME` 另列 2 项消费待核，不计为有效参数缺口。可选数不是确认漏项数，其中 45 个须先核消费链。已有内容复用，不按全参数百科继续排期；本任务未写正文，历史完成数仍为 120。共享工作区同期 19 个发布文件发生变化，目标 8 页未变，保留性检查未冒充全库通过。[逐项台账](glm-scope-ledger.json)、[验证](glm-scope-validation.json)。下文 1,592/1,582 是历史全量盘点口径，旧诊断 O01 的默认优先顺序已被本次计划替代。

**诊断与观测规划（2026-11-01）：[83 项分批计划与整体余量](diagnostics-observability-plan.md)。** 83 个原项拆为 15 个交付包；本轮核实 3 对兼容入口，按 80 个规范配置身份安排，仍保留 83 项验收义务。先补 O01 的 4 个 Ascend 入口，合写 3 条参考说明。全部历史范围剩余 **1,592 个原项（C 969 + D 623）**；扣掉此前 7 对和本轮 3 对有证据的重复后，为 1,582 个规划身份，不能当成确认漏收的公开参数数。另有 786 条基线外定义记录单列，不能混加。本轮只更新规划，wiki 发布内容未改，完成数仍为 120。逐项见 [JSON](diagnostics-ledger.json) / [CSV](diagnostics-ledger.csv)，验证见 [diagnostics-plan-validation.json](diagnostics-plan-validation.json)。

**最新进度（2026-11-01）：C 首批结构化输出 20/20 个原项完成，合写为 17 条参考说明。** 已补入 structured-output 页并完成独立审查、修订与检索验证：作者 CLI/UI 各 26/26、独立 CLI 20/20；独立源码/保留性 123/123，全库标准审计 104/104。A/B 原 100 项加本批累计 120 个原台账单元。历史 C 989 项中余 969 项后续安排；不是 969 个确认漏收的公开参数。见[结构化输出交付验证](structured-output-backfill-validation.md)、[独立审查](structured-output-independent-review.md)。下一场景按既定顺序为诊断与观测；下文 A/B 与 C 规划段落保留历史口径。

**补写进度：A 批 11/11，B1–B10 共 89/89，累计 100 个优先补写单元。** 2026-11-01 补写 B10 常用入口 13/13，归入 API 入口、Token、量化、Worker 启动四页；保留原有 12 图、10 个算例与待核范围。143 条独立受控源码检查通过，作者 CLI/UI 各 24 项检索通过，独立 CLI 15 项通过；最终 27 张表适配正文，全库强制审计 104/104。最新见[常用入口交付验证](common-entry-backfill-validation.md)、[独立审查](common-entry-independent-review.md)。这表示 A/B 优先范围收尾，不表示全量知识库无缺口；C 989、D 623 单元仍按场景后续安排。以下“未改正文”描述各自历史阶段，历史缺口台账未回写为新统计。

前批记录：[融合与布局](fusion-layout-backfill-validation.md)、[概率记录](logprobs-backfill-validation.md)、[返回与流式输出](streaming-backfill-validation.md)、[双机启动](launch-backfill-validation.md)、[MTP](mtp-backfill-validation.md)、[主模型图](main-graph-backfill-validation.md)、[调度](scheduler-backfill-validation.md)、[容量与 KV](capacity-kv-backfill-validation.md)、[默认与采样](defaults-sampling-backfill-validation.md)、[长度与停止条件](length-stop-backfill-validation.md)、[token 控制](token-controls-backfill-validation.md)、[penalty](penalty-backfill-validation.md)。

**C 批历史计划：[按场景去重、优先级与下一批范围](c-scenario-plan.md)。** 989 个历史 C 项分入 22 个场景，核实 7 组入口身份合并后为 982 个规范化规划单元；不是公开参数数或确认缺口数。规划首批为结构化输出 20 个原项，合写成 17 条参考说明，落在 structured-output 页；规划时 6 项缺参数说明、14 项参考信息不全，现已交付。逐项去向见 [CSV](c-scenario-ledger.csv) / [JSON](c-scenario-ledger.json)，规划验证见 [c-scenario-validation.json](c-scenario-validation.json)。这两份台账保留历史状态，完成记录见页首最新进度。

**A/B 历史计划：[GLM 双机基线的去重、优先级与页面分工](deployment-backfill-plan.md)。** 固定 vLLM `0fc695fc` / Ascend `db701c1f`；历史完整映射见 [deployment-backlog.md](deployment-backlog.md)。该计划的首批 11 项已经交付，不能再把旧“下一步”当作当前进度。

**续审入口：[参数收录续审结果](review-results.md)。** 本轮为既有 4,640 条记录和 18 条动态 CLI 线索给出分类、理由与证据；逐项看 [未收录参数说明](review-missing.md)、[没讲全](review-incomplete.md)、[参考要素基本齐备](review-covered.md)、[范围排除](review-excluded.md)。[全量台账](review-ledger.json)保留入口、版本定义、正文证据、判定依据与重复指向。知识库正文未改。

**重要纠正：** 旧版字典读取与 main 类型字段必须合看。原优先清单中“九个 Ascend 名称都只在 main 有”的判断已撤回并修正，详见续审结果的版本矩阵。不要从某一种提取类别推断参数在旧版不存在。

以下说明和 `inventory.json`、`unmentioned.md`、`mentioned.md`、`dedicated.md`、`ambiguous.md` 是首轮静态盘点记录，保留用于追溯；其中“待核”是当时的状态，最新收录判定以续审结果为准。全量静态记录不等于去重后的公开参数全集。

本次对照项目使用的固定源码快照与知识库已发布正文，列出参数定义、版本存在情况和内容缺口。结论是：请求参数、启动配置和环境变量的参考说明尚未形成完整覆盖；已有机制教学不能替代逐参数的使用说明。

## 先看哪些文件

- [统计与验证](statistics.md)：七份快照、各类别定义身份数及本轮实际检查结果；这些数字不是公开参数总数或漏项率。
- [人工核读的优先缺口](reviewed-gaps.md)：已经区分“没有参数说明”和“有机制但没讲全”的具体条目，以及需要补什么。
- [未检出名称](unmentioned.md)：完整静态对账中没有正文名称命中的条目。它是待补候选，不能直接理解为全部没有讲过机制。
- [已有提及](mentioned.md)：正文能命中，但还需要逐项判断默认值、范围、入口示例、相互作用和版本边界是否讲全。
- [已有专页](dedicated.md)：标题或别名能映射到参数页；存在页面不等于内容已验收。
- [同名含义待核](ambiguous.md)：短名称容易误命中，不能用关键词命中代替参数身份核对。
- [逐版本原始明细](inventory.json)：各定义的完整 commit、文件、行号、静态默认表达式、上游字段说明、正文命中片段、发布页内容哈希和动态命令行线索。
- [复现脚本](audit.py)：只读 Git 固定提交和知识页，不导入或执行上游代码，不修改正式知识页。

## 版本基线

| 场景 | vLLM | vLLM Ascend |
|---|---|---|
| GLM 固定部署 | `0fc695fc`，与下面 v0.23 共用一次定义提取 | `db701c1f` |
| v0.23 维护版本 | `0fc695fc` | `2c59ff10` |
| v0.26 配套版本 | `568afb3a` | `2ed6cbba`，分支名为 releases/v0.26.0rc |
| 知识库固定 main 快照 | `84030bbe3d74d99bad477a3d2e37a973ccd8865c` | `baa023ad` |

依据为仓库 `wiki/seeds/vllm-ascend.yaml`、`wiki/seeds/vllm-ascend-code.yaml`、GLM 教学页来源，以及 Ascend `baa023ad` 内的 `.github/vllm-main-verified.commit`。这里的 main 是固定快照，不代表今天最新 main。RFork 是独立工作版，不混入这两个社区项目的参数表。

## 盘点口径

扫描七个提交各自包目录下的全部 Python 文件，提取以下本地静态定义：

1. SamplingParams、BeamSearchParams、PoolingParams 及同文件的辅助参数结构。
2. vLLM Config、EngineArgs、服务 FrontendArgs 字段及离线 LLM 构造参数；这些入口可能对应同一个选项，保留入口区别，不相加宣称“不同参数数”。
3. entrypoints 中 Request 类字段，以及协议内的嵌套结构候选。输出结构不作为请求参数。
4. 字面量命令行长选项，基准测试工具单列；非字面量或位置参数调用保留在 dynamicCli 待核。
5. 两项目环境变量注册表，以及包内直接读取的环境变量。读取点不是新的环境变量，不能按读取点数统计不同参数。
6. Ascend 配置复用现有 AST 扫描器，同时保留不确定的配置键、开放字典键和其他配置结构候选。

同名不同文件、配置路径、接口结构保留不同身份。表中的“存在”只表示该提交静态定义存在，不证明每个硬件、模型和接口都支持该功能。默认值是定义处的表达式，可能受模型 generation_config、工厂函数、平台和请求值覆盖，不能直接作为实际运行值。

正文对账覆盖 registry 中 concept、feature、param 类型的发布页；不把草稿、raw 材料、审查记录和源码来源列表当作已向读者解释。允许下划线、连字符和空格名称互相匹配，例如 presence_penalty 与 presence penalty；来源 URL 和源码定位串在匹配前去除。命中只提供证据线索，不自动认证完整性。

## 什么才算讲全

每个公开参数至少应能定位到：作用与生效阶段、调用入口和嵌套路径、默认值及覆盖优先级、合法范围和特殊值、一个可用示例、相互作用与限制、各固定版本的存在及行为差异。可通过教学页加参考表共同满足，不要求每项单开一页。

`reviewed-gaps.md` 是人工核读结论；其余四张表是穷举静态定义后得到的检索分类，不冒充逐项语义验收。完全没有名称命中也可能已经用中文讲过机制，人工核读已发现的这类情况在优先清单中明确纠正。

## 尚不能宣称全量验收的边界

- 外部 SDK 的继承字段、运行时插件、任意 extra_args/extra_config 扩展、动态生成选项与非 Python 原生库的环境开关不能靠这份 AST 清单封闭枚举。CANN/HCCL 全部参数不属于本次两个仓库本地定义的全集。
- 其他配置结构候选中可能有内部状态、仅 GPU 使用的选项或未暴露给调用者的字段，不能直接归为 Ascend 部署漏项。
- 对所有已命中条目逐页验证讲解完整性尚未完成，因此本报告不给“全库漏项率”，也不将未核条目自动归为“讲全”或“没讲全”。

## 验证与取舍

脚本内含参数字段、ClassVar/私有字段排除、环境读取、CLI 选项和名称边界的断言；逐版本检查 SamplingParams.presence_penalty 提取存在，检查七份快照与分类数量守恒。版本及正文来源随结果保存，可复现核对。

本次只新增盘点材料，不改线上检索、参数同步器和知识页，因此无需前端验收。报告适合决定补写范围，不能作为参数在真实 NPU 部署上已运行通过的证明。下一步应先补人工核读清单中的请求参数，再逐项审核公开启动参数及环境变量；所有定义候选和未核完整性条目继续保持显式待核。
