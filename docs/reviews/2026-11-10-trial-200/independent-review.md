# 200 项引文核验后的独立审查

日期：2026-11-10。审查者：本轮新建的独立审查子任务 `trial200_review`。本报告基于实际文件与固定源码重新判断，未把写手的 judgments 或历史审查报告作为结论。

**最终结论：本轮独审发现 2 项 P1、2 项 P2、1 项 P3，主线程修订后均已实际复读关闭。当前审查范围内没有未关闭问题；浏览器视觉验收与项目检查仍以主线程记录为准。**

## 范围与方法

- 已读项目 `AGENTS.md`、`docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`。
- 已逐页读 `npu-model-runner`、`npu-worker-lifecycle`、`prepare-inputs-flow`、`vllm-v1-shape`、`vllm-engine-core`、`engine-processes` 的实际正文、源码区与来源字段。
- 比较对象为 `.tmp/trial-200-2026-11-10/before/<id>.md` 与上述六页的 `git diff --no-index`，不是整个工作区的 Git diff。按 `changes.json` 的 50 项核对了 45 项页面替换和 5 项图文替换，并继续复核独审期间的修订。
- 已读这六页使用的 13 个图的 YAML，包括文字、网格、箭头、分支和 pins；另读了本轮改动五图的生成 SVG 文字：`worker-lifecycle`、`worker-lifecycle-flow`、`prepare-inputs-code-flow`、`engine-processes`、`vllm-v1-shape-loop`。这不是浏览器视觉验收。
- 用 `git -C tools/repos/<repo> show <commit>:<path>` 实读下列固定源码。重点追本轮修改的顺序、分支、平台选择和统计范围，没有重新宣称独立逐项核验全部 200 个 manifest 项。
- 4 个 raw 是既有摘录归档的一致性核验材料；本独审没有把它们记为本轮新读的完整上游文档。外链没有在本独审中联网复验。
- 只写本报告，没有修改产品正文、图或源码。纯文档审查未启用 Ponytail。

## 发现、修订与复核

### R1 — P1：同步分支的 CPU/设备重叠仍在正文中解释错误

位置：`wiki/concepts/vllm-engine-core.md:224`，与同页 `:301` 的本轮修正矛盾。

旧正文把调度、准备结构化输出表、更新都算成设备空闲，又把卡计算期间概括为 EngineCore 干等。初学者会因此把“本轮准备表与前向重叠”和“下一轮调度与本轮计算重叠”混成一件事，并高估异步调度能消掉的空档。

直接证据：`vllm@0fc695fc:vllm/v1/engine/core.py:454–463` 先在 455 行 `execute_model(..., non_block=True)`，456 行准备 grammar bitmask，461 行才等 future。同步路径本来就允许准备表与当前前向重叠。

修法：正文说明已有的本轮重叠，再说明下一圈调度仍要等本轮结果更新。

**状态：已关闭。** 已实际复读主线程修订后的 224 行；它与 301 行及上述源码一致。原有 `engine-core-flow.yaml:12` 也写明“趁 Worker 在算，准备结构化输出的表”，没有发现图的时序反转。

### R2 — P1：本轮增加的首现缩写先用后讲

位置：`wiki/concepts/npu-worker-lifecycle.md:135` 的 TP/PP，`wiki/concepts/engine-processes.md:233` 的 PCP。级别依据写作标准“前置概念先用后讲按 P1 处理”，不是把缩写本身视为源码错误。

加入适用条件是必要的，但首图之后直接写“同构 TP 组”“PP 各阶段”“PCP=1”，会让首次阅读者为理解缓存配置为何不同、谁回传结果而倒查后文。

修法：在原地解释 TP 是多卡合算同一批、各持部分权重，PP 是按层分阶段，PCP 是把 prefill 的提示词计算分给多卡；同时保留本部署未启用相应分支的条件。

**状态：已关闭。** 已实际复读 135、233 行的新解释。原有统一块数与 per-worker 配置事实也保留：`vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py:1956–1979,2059–2090` 分别生成各 Worker 配置，再统一最小块数、按比例缩张量。

### R3 — P2：回传卡条件补到了正文，没有同步进图注

位置：`wiki/diagrams/engine-processes.yaml:3`、`wiki/diagrams/vllm-v1-shape-loop.yaml:3,12`。

初稿的图注仍把“仅 TP0 / 仅 0 号 Worker 回传”写成通用规则，缺 PCP、PP 和 KV connector 条件。读图者会把固定部署的单一输出卡规则推广到其他拓扑。

直接证据：`vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py:495–509` 的输出 rank 为 `world_size − TP × PCP`，即最后 PP 阶段的 PCP0/TP0；`:361–365` 在配置 KV aggregator 时收所有 Worker 的响应。

**状态：已关闭。** 已读修改后的两个 YAML 图注及生成 SVG 的 title/aria-label：图明确限定为本部署正常生成路径，未开 PP/PCP、无 KV connector；主体箭头和“仅 0 号”的图内文字在该条件下成立。实际渲染清晰度仍由主线程浏览器验收。

### R4 — P2：把最终 token 结果的一份误当成每步只有一次 RPC 响应

位置：`wiki/concepts/vllm-v1-shape.md:282,338`。

旧写法“每一步两次广播、一次回话”少算前向返回空值的响应，也没有覆盖同步投机的取回草稿调用。它与本轮对 Executor 调用种类的修订不一致，影响读者对通信次数和固定开销的理解。

直接证据：`vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py:307–328` 为前向、采样各发一次 RPC；`:374–396` 每次调用都取响应；`:982–995` 对返回 None 的调用也提交输出。`vllm/v1/engine/core.py:474–482` 在同步、投机、本轮执行模型三条件同时满足时还取回草稿。

**状态：已关闭。** 已实际复读 282 行及 338 行。正文区分“指定 Worker 响应每次调用”和“最终 token 结果只收一份”，保留同步投机的额外调用条件；待核尾注也改为各次调用的广播与响应，没有把一次最终结果误算为一次响应。

### R5 — P3：新增来源后，旧缺口和局部角标需要同步

位置：`wiki/concepts/npu-worker-lifecycle.md:384`；`wiki/concepts/npu-model-runner.md:352`。

worker 旧缺口仍写 main 包装层“只核到类名”，但本轮来源 26、54、55 已把包装层拥有实际 attention 子层、上游遍历与 predicate 连接起来。runner 的来源 50 已增加构造器，但构造器取消回退的句子原先只挂来源 37（init_device 选类）。

直接证据：`vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py:301–322`；`vllm@84030bbe:vllm/model_executor/model_loader/utils.py:147–155`；`vllm/model_executor/layers/attention/__init__.py:26–30`；`vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py:160–175`。

**状态：已关闭。** 已实际复读 worker 的新缺口文本：明确已核包装层归属、遍历、筛选，保留尚未展开的后端布局；runner 的对应句已标明“来源 37、50”，分别支撑选类和构造器分支。

## 初学者入口复述

以下是实际阅读开篇和动机段后的文本复述；不冒充在浏览器中完成了前两屏视觉验收。

| 页 | 能复述的“是什么” | 能复述的“代价在哪” |
|---|---|---|
| npu-model-runner | 卡上的常驻执行对象把请求计划翻成行，前向后保存分数，第二次调用才采样并按请求返回 | 每步准备与记账开销；两次调用之间状态只能占一格，须按顺序交接 |
| npu-worker-lifecycle | 一张卡的执行角色依次准备设备、模型、缓存和图，后一步依赖前一步 | 读权重、试跑、逐尺寸预热和录图让启动变慢；配置变化须重新量预算 |
| prepare-inputs-flow | 把不同请求的新 token 拼在一起，并配上所属请求、位置、槽位、边界、长度和选行 | 每步准备挡在前向之前；多张表必须对齐，补齐行必须排除在真实请求外 |
| vllm-v1-shape | 前端管文本，EngineCore 管计划与进度，Worker 管设备计算，Executor 传递调用 | 跨角色打包、状态同步，以及调用与响应成本 |
| vllm-engine-core | 同一引擎的请求共用收消息、调度、执行、更新的循环，每圈的批成员可变 | 进程消息和多处请求状态；同步/异步有不同等待位置，不能把全部 CPU 工作当成设备空闲 |
| engine-processes | API server、EngineCore、Worker 是三类职责，客户端与执行器决定它们是否独占进程 | 消息编码、多处状态和逐进程补丁/配置初始化 |

R2 修订后，本轮新增条件没有再留下上述首现缩写的理解障碍。A/C 的示意编号、R1 前两步的状态和 GLM 部署的区别仍保留；没有把示意数改成设备测量。

## 50 项替换的信息保留检查

编号为 `changes.json` 从 1 开始的顺序。本表记录语义去向，不以数字字符串集合代替信息保留核对。

| 编号 | 核查结果 |
|---|---|
| 1 | 保留 45/34 层、3 个候选、接受数与下一步状态的因果，只按源码重排整理→草拟→更新接受数 |
| 2–3 | logits 来源扩大到平台选择；v0.26 回退位置从 init_device 改成构造器，没有删除选类条件 |
| 4–7 | 保留启动两处重点协调、缓存预算和权重复用，消除“只有两处等待”“运行期权重永不变”“各卡配置恒同”三个绝对断言 |
| 8–10 | 主模型与草稿都在 profiler 内；补编译端点只受非 eager 门槛控制；prefetch 是后台并发预读。没有丢掉预算、预热或映射读取机制 |
| 11–13 | 保留 rc2 的 DSpark、sleep 池与清零元数据，并补完整共同门槛；后处理从类名猜测改成子模块 predicate；加载来源扩大范围 |
| 14–17 | 零 token 不进常规准备的结论保留，补 DP/KV 协作分支；4-token dummy 限定为 R1 前两步；dummy 来源改为实际主体 |
| 18–24 | 保留计划轻、状态跨步缓存与两次调用；补请求标识/采样参数、异步候选占位、同步取草稿、uni 共进程和流式追加的边界 |
| 25–26 | 默认 executor 完整规则和并发批次公式迁到既有专页并给链接；本部署仍保留 mp、V1、PP1、异步、队列 2 的结论 |
| 27–29 | 不再把有调试日志差别的实现叫逐字相同；GLM 模型代码整行只是移回版本表，没有删除模型目录、类名或版本信息 |
| 30–33 | 共享循环限定到同一个 EngineCore；post_step 三条件完整；同步等待修正由 R1 继续传播到正文；补 CachedRequestData 来源 |
| 34–37 | 回传卡补 PCP 条件；候选编号与异步占位区分，R1 的 4 token、15 块及下一圈链接保留 |
| 38–41 | 区分输入内容每步更新与缓冲跨步复用；请求由调度预算决定是否上场。没有把中间激活当成永久不变的状态 |
| 42–45 | 普通 Ascend 的简化说明链接完整分支；Ray 条件、离线显式强制 multiprocessing、CUDA/TPU 优先级均保留 |
| 46–47 | 图仍保留各卡报预算→EngineCore 统一块数→各卡建池的先后，只修各卡对应配置 |
| 48–49 | 图仍有零 token 提前出口，补必要协作；未误接到常规输入准备 |
| 50 | 图保留显式与自动两条预算路径，并纠正为两者都试跑、只有显式路径跳过扣减 |

本轮另加的 runner 来源 48–50、worker 来源 54–55 各有对应的新增证据，不构成删除旧机制。原有设备实测缺口仍留在页末。

## 直接核对的关键固定源码

除了各发现列出的文件，本轮独审还实际读取：

- `vllm-ascend@db701c1f:model_runner_v1.py:2014–2067,2455–2582,3340–3410,3717–3795`：零 token、结果整理/草拟/接受数、dummy 输入、草稿加载计量。
- `vllm-ascend@db701c1f:worker.py:693–721`：图模式与 eager 的两个不同门槛。
- `vllm-ascend@7d825229:worker.py:1178–1221`：DSpark KV 归属、sleep 池、MRV1/MRV2 清零条件。
- `vllm@0fc695fc:weight_utils.py:875–890,970–1027`：后台启动预读线程，前台随后继续 safe_open。
- `vllm@0fc695fc:parallel.py:845–890`：默认 executor 按 if/elif 顺序选择；`llm_engine.py:140–176`：环境变量与显式强制多进程。
- `vllm@0fc695fc:config/vllm.py:495–507`：V2 异步为 PP+1，V1 异步 PP1 为 2；`async_scheduler.py:19–36`：异步候选占位。
- `vllm@0fc695fc:logits_processor.py:45–87`、`platforms/interface.py:858–862`、`vllm-ascend@db701c1f:platform.py:128–140`，并在该固定平台文件检索 `use_all_gather` 无重写：本部署的 All-Gather 依据成立。
- `vllm-ascend@2c59ff10:patch_process_weights_after_loading.py`：DSAAttention 是在上游 Attention/MLA/MM 类型之外额外识别，非只认该类。

## 验收边界

本独审检查的是本轮事实修正、信息保留、开篇理解与图文语义，未扩展为全站审查。没有运行 NPU，也没有生成吞吐、显存或日志实测结论。未把本轮检查推广为所有版本或所有部署均成立。

浏览器实际打开、前两屏、链接操作、截图视觉检查及项目构建/内容检查由主线程完成并记录；本报告不把主线程执行的命令写成本审查者亲自运行。最终交付须与主线程的实际验收记录一起读。
