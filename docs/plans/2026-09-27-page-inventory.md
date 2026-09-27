# LLM-wiki 全库盘点与逐页处置表（2026-09-27）

仓库 `C:\Users\-\Desktop\infra-view-new-llm-wiki`。盘点范围是全部内容页：`wiki/concepts/`（104 页）、`wiki/params/`（24 页）、`wiki/sources/`（5 页），另有 `wiki/_drafts/` 里 1 份草稿。元数据由脚本抽取（frontmatter、各级标题、行数、汉字数、图数、git 状态、入链数），正文未逐页通读；「站」「初步处置」「理由」三列是人判。

重构方向：知识库改成按「一条请求走过推理系统的路线」组织，每页挂到路线上的某一站（A0–A7 主干、B1–B5 多请求分支）。

## 1. 重写必须遵守的约束

### 1.1 frontmatter（`src/content/wiki/schema.ts`、`scripts/wiki/pages.ts`）

1. 必填：`id`、`title`、`type`、`summary`、`sources`、`evidence`、`updated`；`id` 是 kebab-case，且必须与文件名一致（`id-file`）。
2. `type` ∈ `concept|feature|param|source|pr`；`origin` ∈ `seed|drop|chat|pr|gap`，默认 `seed`。
3. `summary` 非空且不超过 200 字（一句话）。
4. `chapters` 每项是两位数字串，必须落在 `src/content/wiki/chapters.ts` 的 `00`–`21` 内（`unknown-chapter`）；`order` 取 1–999，默认 500。
5. `sources` 至少一条，每条只能是 `repo@commit:path#L起-L止`、`http(s)://…` 或 `raw:sha256-<64位>.md#L行` 三种形式之一。
6. `evidence` ∈ `S C D A I M !`；`verified` 只能写 seeds 登记过的版本（`main`、`releases/v0.23.0`、`releases/v0.26.0rc`，或 `repo:ref`）。
7. `relations` 每条要有 `to` / `kind`（`builds-on|variant-of|conflicts-with|alternative-to`）/ `note`；不得自指、不得指向不存在的页、同一条有向边不得两侧各写一次（反向边由 `wiki:build` 派生）。
8. `updated` 必须是 `YYYY-MM-DD`。
9. 页面只能放在 `wiki/concepts/`、`wiki/params/`、`wiki/sources/`（`PAGE_DIRS`），文件名即 id。

### 1.2 正文（`scripts/wiki/lint.ts`）

10. `concept` / `feature` 不再强制固定小节（2026-09-19、09-25 两次放开，连「一句话」都不强制）；`param` 仍必须有「一句话 / 事实表 / 为什么存在 / 开了的代价」四节。
11. 正文不得写 `## 接着看`（由 relations 生成，理由写进边的 `note`）。
12. 教学页至少要有一条出边或入边；既没有 `chapters` 又没人链接会判 `orphan`。
13. `## 事实表` 不超过 10 行，且不得带「来源」列。
14. 内联证据标记：`S/C/M` 等带编号档必须写成 `[C3]` 指向 `sources` 第 3 条，编号不得越界；`D/I/A/!` 不带编号；一页不超过 30 处，单一等级占比超过 80%（且总数 ≥10）会告警。
15. 不得残留 `{{ }}` 占位符；不得有整行裸 HTML 标签。
16. 站内链接必须指向存在的文件（`broken-link`）；站外链接由 `pnpm wiki:urls` 查死链。
17. 证据与来源要一致：只有 raw 本地材料不能标 `C`；白名单外来源撑不起 `S`/`C`；官方文档占多数必须标 `S`，标 `S` 必须有官方或论文来源。
18. 跨页重复：非模板标题 + 首段与另一页重复、且两页互不引用 → `cross-page-overlap`。按路线重组时最容易踩这条——同一件事在主线页和深入页各讲一遍必须互相引用。
19. `wiki/log.md` 的 H2 只能是 `## [YYYY-MM-DD] ingest|build|review | …`。

### 1.3 图（`scripts/wiki/diagrams.ts`、`figure.ts`、`diagram-audit.ts`）

20. 正文里图的唯一载体是 ```wiki-diagram 围栏 + 一行 `file: <id>.yaml`；mermaid 渲染器已于 2026-09-20 删除。
21. 每张图要有 `wiki/diagrams/<id>.yaml` 和由 `pnpm wiki:diagrams` 生成的同名 `.svg`，两者必须一致（`--check` 已进 `pnpm check`）。
22. 新图只用 `figure` 版式（`scene` 是存量）；只许语义色 `token / weight / kv / comm / control / danger / ink`；画到框外或两件东西压在一起是硬失败。
23. spec 里的 `symbols` 必须在 `source` 指向的那个钉住 commit 的 blob 里真实存在，且该 `source` 必须同时出现在本页 `sources` 里。
24. 图上文字不超过 8 段、不放整句、不放代码名（告警，不阻塞）。

### 1.4 目录与页面结构（`src/content/wiki/toc.ts`、`toc.test.ts`、`tests/wiki.spec.ts`）

25. 每页必须在 `toc.ts` 的 `CURATED` 里显式编排，全库每页恰好出现一次，且不得落进「新增教学页（待编排）」——`toc.test.ts` 拿真实 `registry.json` 断言这一条。
26. 现有十一个 part（`guide/models/inference/architecture/hardware/distributed/performance/serving/rfork/params/references`）的 id 与中文标题是固定集合。改成按路线分组时，`toc.ts`、`toc.test.ts` 的全部用例、`tests/wiki.spec.ts` 里逐个大类的断言必须一起改。
27. 改版页的两层结构（e2e 钉死）：必须有 `## 对照源码`；它以上不得出现证据角标；它以下的 H3 只能取「怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置」；正文不得再有 `## 一句话`。
28. 被代码钉住的页面 id：`block-table`、`expert-parallel`、`paged-attention`、`prefix-caching`、`kv-pool`、`layer-sharding`、`rfork`、`kv-cache`（`tests/*.spec.ts`）、`collective-communication`（`src/content/wiki/WikiDiagram.tsx` 内嵌演示）、以及 `src/sim/model/forwardLayer.ts` 中 `Step.terms` 引用的术语 id（`pnpm wiki:lint --terms`）。这些页改名或删除必须同步改代码和测试。
29. 派生物 `wiki/index.md` 与 `src/content/wiki/registry.json` 由 `pnpm wiki:build` 生成，不手改；`wiki/TERMS.md` 是全库统一叫法的真相源，新词先进表再用，「对应页面」列写的 id 必须存在。
30. 验收命令：`pnpm check` = `typecheck` + `lint` + `test` + `check:deps` + `check:content` + `wiki:diagrams --check` + `wiki:lint`；前端另跑 `pnpm test:e2e`。

## 2. 逐页处置表

「行/汉字」= 文件总行数 / 正文汉字数；「图」= 正文引用的 `wiki-diagram` 张数。处置取值：主线页重写 / 深入页重写 / 合并到 X / 删除 / 保留小修 / RFork 待定。

### 2.1 教学页（`wiki/concepts/`，RFork 除外）

| 路径 | 标题 | 当前 toc 分组 | 行/汉字 | 图 | git | 一句话主题 | 站 | 初步处置 | 理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wiki/concepts/learning-guide.md | 阅读指南：从模型计算走到推理服务 | 开始学习 › 阅读路线 | 63/1157 | 0 | 未跟踪 | 以 GLM-5.3-Flash 串联模型、单请求、并发和框架架构，再进入硬件、双机部署与专题… | 全线 | 主线页重写 | 改写成路线总览 |
| wiki/concepts/one-request.md | 单请求全过程：从提示词到首个 token，再到回答结束 | 开始学习 › 模型与请求概览 | 162/2825 | 2 | 已改未提交 | 用 GLM-5.3-Flash 的普通自回归文本路径，跟踪请求输入、调度、NPU 前向、采样… | 全线 | 主线页重写 | 全线主干，按站重排 |
| wiki/concepts/ai-qos.md | AI QoS：共享链路上的流量优先级 | 昇腾硬件与软件栈 › 软件栈与互连 | 65/704 | 1 | 已改未提交 | 先解释链路竞争与虚拟通道，再按固定版本区分端点标签、交换机映射和恢复范围；不把网络 QoS … | A0 | 合并到 cann-hccl | 同为互连链路，入链仅1 |
| wiki/concepts/ascend-config-system.md | Ascend 配置：输入、优先级与实际生效值 | vLLM 与 Ascend 架构 › 启动与平台适配 | 83/1034 | 1 | 已改未提交 | 区分通用参数、additional_config 与环境变量，使用两个兼容映射说明优先级，并… | A0 | 深入页重写 | 启动时配置怎样生效 |
| wiki/concepts/ascend-patch-system.md | 运行时适配：补丁、模型注册与算子替换 | vLLM 与 Ascend 架构 › 启动与平台适配 | 74/1008 | 1 | 已改未提交 | 先解释进程内名称绑定，再区分平台补丁、Worker 补丁、模型注册与 CustomOp 替换… | A0 | 深入页重写 | 启动时替换了哪段代码 |
| wiki/concepts/cann-hccl.md | CANN 与 HCCL：计算、通信和物理链路 | 昇腾硬件与软件栈 › 软件栈与互连 | 57/628 | 1 | 已改未提交 | 从两个 rank 的张量交换区分通信语义、框架接口、通信库和物理链路，再定位 Ascend … | A0 | 深入页重写 | 通信库与物理链路 |
| wiki/concepts/collective-communication.md | 通信基础：rank 之间怎样交换和归约张量 | 分布式推理与部署 › 通信基础 | 88/1355 | 1 | 未跟踪 | 集合通信定义一组参与者的输入如何变成各自的输出。用同一组小张量区分拼接、求和、分发和定向交换… | A0 | 深入页重写 | 建组与通信语义基础 |
| wiki/concepts/cpu-binding.md | CPU 绑核：线程亲和性与 NUMA 局部性 | 性能与工程优化 › 图执行与主机资源 | 88/940 | 1 | 已改未提交 | 模型在 NPU 执行，Host 仍负责调度和下发；本页解释怎样限制 Worker 的 CPU… | A0 | 深入页重写 | 主机侧资源绑定 |
| wiki/concepts/device-memory.md | 主机内存与显存：数据现在放在哪 | 昇腾硬件与软件栈 › 设备、内存与计算单元 | 55/634 | 1 | 已改未提交 | CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够… | A0 | 深入页重写 | 显存与主机内存分账 |
| wiki/concepts/engine-processes.md | 进程与执行器：前端、EngineCore 和 Worker 如何协作 | vLLM 与 Ascend 架构 › 组件、职责与进程 | 74/1182 | 1 | 已改未提交 | 组件职责决定保存什么状态，执行器与并行配置决定它们放在哪些进程。区分逻辑角色、进程地址空间、… | A0 | 深入页重写 | 角色怎样落到进程 |
| wiki/concepts/epd-disaggregation.md | 编码器分离：多模态 embedding 与语言推理协作 | 分布式推理与部署 › 服务分离与状态传输 | 76/1056 | 1 | 已改未提交 | 先区分视觉编码结果和语言模型历史状态，再解释 E+PD、E+P+D、外部编码缓存，以及执行职… | A0 | 合并到 pd-disaggregation | 同类分离形态，入链0 |
| wiki/concepts/gap-a5164fe10fa9184412f8.md | HCCL 缓冲区：通信组预算与配置优先级 | 分布式推理与部署 › 通信与配置 | 78/836 | 1 | 已改未提交 | 区分通信张量和运行缓冲，沿建组流程解释默认组、DP、EPLB 与 MC2 的配置差异，并将缓… | A0 | 深入页重写 | 建组缓冲预算；须改名 |
| wiki/concepts/glm-5-3-flash-two-node.md | GLM 双机案例：从请求入口到 TP、DP 与 EP 通信组 | 分布式推理与部署 › 贯穿案例 | 210/1818 | 2 | 未跟踪 | 用官方双机命令串联服务入口、每机 TP8、全局 DP2 与跨机 EP，区分命令参数、源码推导… | A0 | 主线页重写 | 部署全景贯穿案例 |
| wiki/concepts/hardware-devices.md | NPU、板卡、服务器与机柜 | 昇腾硬件与软件栈 › 设备、内存与计算单元 | 56/694 | 1 | 已改未提交 | 从芯片、板卡到服务器和机柜，区分物理层级、网络连接与软件可见设备，再对照 GLM 官方双机实… | A0 | 深入页重写 | 机器与设备清点 |
| wiki/concepts/kv-cache-memory-profiling.md | 显存容量：从运行开销算出缓存预算 | 性能与工程优化 › 容量规划 | 74/1065 | 1 | 已改未提交 | 区分权重、激活、运行时与持久缓存，解释启动 profiling 如何估计缓存预算，以及预算为… | A0 | 深入页重写 | 启动时定 KV 预算 |
| wiki/concepts/npu-platform.md | NPUPlatform：配置校验与设备实现选择 | vLLM 与 Ascend 架构 › 启动与平台适配 | 72/846 | 1 | 已改未提交 | 将 Platform 契约对应到 Ascend 的启动准备、配置调整、Worker 选择和后… | A0 | 深入页重写 | 平台实现落位 |
| wiki/concepts/npu-worker-lifecycle.md | NPUWorker 启动：设备、权重与状态池 | vLLM 与 Ascend 架构 › 启动与平台适配 | 88/1234 | 1 | 已改未提交 | 追踪 Worker 从进程内适配到设备通信、权重、缓存预算和预热的依赖，区分显式内存预算与自… | A0 | 主线页重写 | 启动主线 |
| wiki/concepts/pd-disaggregation.md | PD 分离：计算阶段与历史状态的交接 | 分布式推理与部署 › 服务分离与状态传输 | 91/1298 | 2 | 已改未提交 | 从 prefill 和 decode 的不同工作形态解释分离部署，跟踪目的块分配、状态边界、… | A0 | 深入页重写 | 部署形态之一 |
| wiki/concepts/platform-plugin-registration.md | 插件发现与模型注册 | vLLM 与 Ascend 架构 › 启动与平台适配 | 82/1051 | 1 | 已改未提交 | 从 Python 安装元数据解释平台插件与通用插件，追踪 GLM 模型实现如何进入注册表，并… | A0 | 深入页重写 | 插件怎样被发现 |
| wiki/concepts/superpod.md | 超节点与内存池化：资源位置和访问语义 | 昇腾硬件与软件栈 › 软件栈与互连 | 49/659 | 1 | 已改未提交 | 从本地内存与远端访问出发，区分高速互联、统一编址和对象缓存，说明内存池化如何服务推理状态复用… | A0 | 合并到 hardware-devices | 同讲互连拓扑，入链0 |
| wiki/concepts/vllm-ascend-overview.md | vllm-ascend 如何接入 vLLM | vLLM 与 Ascend 架构 › 组件、职责与进程 | 74/939 | 1 | 已改未提交 | 从平台注册、配置处理、Worker、模型注册和执行后端理解 Ascend 的接入位置；沿 G… | A0 | 深入页重写 | 上下游职责总览 |
| wiki/concepts/vllm-platform-interface.md | Platform：硬件适配的接口契约 | vLLM 与 Ascend 架构 › 启动与平台适配 | 72/926 | 1 | 已改未提交 | 解释上游如何把设备属性、配置校验与实现选择交给平台接口，以及这些接口与 Worker、Run… | A0 | 深入页重写 | 上游平台接口 |
| wiki/concepts/vllm-v1-shape.md | vLLM 与 Ascend 架构：组件、进程和数据如何协作 | vLLM 与 Ascend 架构 › 组件、职责与进程 | 109/1912 | 1 | 已改未提交 | 从 GLM 单请求与并发批次出发，说明 API、EngineCore、Scheduler、E… | A0 | 主线页重写 | 系统全貌主线 |
| wiki/concepts/who-owns-what.md | 职责与状态归属：调度、执行和缓存如何协作 | vLLM 与 Ascend 架构 › 组件、职责与进程 | 72/1021 | 1 | 已改未提交 | 以 GLM 一轮推理为例，区分请求进度、资源分配记录、执行侧批次、模型权重和注意力状态，并据… | A0 | 合并到 vllm-ascend-overview | 职责边界重叠，入链2 |
| wiki/concepts/request-call-chain.md | 请求调用链：从调度计划到模型输出 | vLLM 与 Ascend 架构 › 组件、职责与进程 | 78/1217 | 1 | 已改未提交 | 沿同一个 GLM 请求追踪输入处理、EngineCore、Executor、Worker 和… | A1 | 主线页重写 | 入口调用链主线 |
| wiki/concepts/token.md | Token 与分词：从文本到模型输入 | 模型结构与计算 › 输入表示与张量计算 | 67/1226 | 1 | 已改未提交 | 分词器将文本转换为 token 编号序列。理解词表、对话模板和序列位置，才能准确解释输入长度… | A1 | 主线页重写 | 分词与 token 主线 |
| wiki/concepts/block-table.md | 块表：从序列位置找到缓存槽位 | 推理机制与状态 › 缓存布局与复用 | 64/750 | 1 | 已改未提交 | 块表把请求的逻辑块映射到物理块；分页寻址先求逻辑块和块内偏移，再定位物理槽位。混合模型的缓存… | A2 | 深入页重写 | 分配后的槽位寻址 |
| wiki/concepts/chunked-prefill.md | 分块 Prefill：在轮次之间分配长输入 | 推理机制与状态 › 分块执行与投机解码 | 61/902 | 1 | 已改未提交 | 分块 Prefill 将长输入分多轮推进，并跨轮保存状态；它让调度器有机会混合处理生成请求与… | A2 | 深入页重写 | 长输入按轮切开 |
| wiki/concepts/dynamic-chunked-pp.md | 动态分块流水线：按预测耗时选择 prefill 块 | 分布式推理与部署 › 并行策略进阶 | 81/1274 | 1 | 已改未提交 | 从密集注意力的历史依赖解释固定长度分块的耗时差异，再看耗时预测、时间预算与 PP 流水重叠，… | A2 | 深入页重写 | 按耗时定块大小 |
| wiki/concepts/kv-cache-spec.md | 缓存规格：把模型状态转成页与缓存组 | 推理机制与状态 › 生成阶段与状态 | 74/925 | 1 | 已改未提交 | 缓存规格声明状态形状、精度与页大小，供容量规划、分组和设备张量创建使用。GLM 的主潜向量、… | A2 | 深入页重写 | 缓存组规格决定分配 |
| wiki/concepts/paged-attention.md | 分页注意力：布局、共享与按块访问 | 推理机制与状态 › 缓存布局与复用 | 56/685 | 1 | 已改未提交 | 分页布局将请求历史分散存放在固定大小的块中，由块表保持逻辑顺序；它为动态分配和前缀共享提供基… | A2 | 合并到 block-table | 同讲分页寻址，入链1 |
| wiki/concepts/prefix-caching.md | 前缀缓存：复用已计算输入的条件与边界 | 推理机制与状态 › 缓存布局与复用 | 64/976 | 1 | 已改未提交 | 相同前缀只有在身份匹配、状态驻留且各缓存组可共同恢复时才能复用。APC 是否启用和有效块大小… | A2 | 深入页重写 | 调度前先查命中 |
| wiki/concepts/vllm-engine-core.md | EngineCore：调度、执行与结果更新如何形成迭代 | vLLM 与 Ascend 架构 › 引擎调度与资源管理 | 74/1077 | 1 | 已改未提交 | EngineCore 持续接收请求和控制消息，安排批次执行并提交结果。一次引擎迭代不等于每个… | A2 | 深入页重写 | 调度循环宿主 |
| wiki/concepts/vllm-kv-block-allocation.md | 缓存块分配：资源池、引用与请求生命周期 | vLLM 与 Ascend 架构 › 引擎调度与资源管理 | 70/1147 | 1 | 已改未提交 | 缓存管理器为请求安排物理块，块池维护空闲状态与引用计数。分配、共享、释放和前缀保留是不同动作… | A2 | 深入页重写 | 块分配与释放 |
| wiki/concepts/vllm-scheduler.md | Scheduler：按计算进度、预算与缓存安排批次 | vLLM 与 Ascend 架构 › 引擎调度与资源管理 | 72/1055 | 1 | 已改未提交 | 调度器把每个请求待处理的位置数与本轮预算、运行上限和缓存可用性结合起来，形成执行计划。统一进… | A2 | 主线页重写 | 调度第一步主线 |
| wiki/concepts/npu-model-runner.md | NPUModelRunner：组织批次、模型前向与采样交接 | vLLM 与 Ascend 架构 › 模型执行与后端 | 79/1153 | 1 | 已改未提交 | NPUModelRunner 将调度计划转成设备输入，管理本轮模型执行及跨调用中间结果，再将… | A3 | 主线页重写 | 准备输入的执行者 |
| wiki/concepts/prepare-inputs-flow.md | 输入准备：从请求计划到位置、边界和缓存槽位 | vLLM 与 Ascend 架构 › 模型执行与后端 | 73/959 | 1 | 已改未提交 | Runner 将多个请求本轮安排的 token 拼接为计算输入，同时保留请求边界、序列位置及… | A3 | 主线页重写 | 准备输入主线 |
| wiki/concepts/ai-core.md | AI Core：计算单元与数据搬运 | 昇腾硬件与软件栈 › 设备、内存与计算单元 | 51/491 | 1 | 已改未提交 | 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路… | A4 | 深入页重写 | 算子落到计算单元 |
| wiki/concepts/attention-backend-family.md | 注意力后端：模型机制、状态布局与设备实现的连接 | vLLM 与 Ascend 架构 › 模型执行与后端 | 75/999 | 1 | 已改未提交 | 模型层定义注意力机制，后端实现把该机制与缓存布局、批次元数据和设备算子连接起来。以 GLM … | A4 | 深入页重写 | 注意力落到哪个后端 |
| wiki/concepts/attention-cost.md | 注意力代价：容量、计算与访存 | 模型结构与计算 › 注意力与位置编码 | 77/1179 | 1 | 已改未提交 | 注意力结构改变保存的历史、查询范围和运算形状；逻辑容量可以由维度推导，实际分配、HBM 流量… | A4 | 深入页重写 | 各注意力变体的代价 |
| wiki/concepts/attention-qkv.md | 注意力与 Q/K/V：从位置间评分到信息汇合 | 模型结构与计算 › 注意力与位置编码 | 108/1477 | 3 | 已改未提交 | 点积注意力用 Q 与 K 计算位置间分数，经掩码与 softmax 得到权重，再汇合 V；多… | A4 | 主线页重写 | 稠密注意力主线 |
| wiki/concepts/context-parallel.md | 上下文并行（CP）：位置分工与注意力结果合并 | 分布式推理与部署 › 并行维度 | 101/1146 | 3 | 已改未提交 | 从密集因果注意力的跨位置依赖解释 PCP 与 DCP，推导局部 softmax 输出的合并，… | A4 | 深入页重写 | 长序列按位置切 |
| wiki/concepts/embedding.md | 嵌入：token 编号如何变成输入向量 | 模型结构与计算 › 输入表示与张量计算 | 81/963 | 1 | 已改未提交 | 嵌入按 token 编号从训练好的权重表中选取向量。GLM 文本嵌入的逻辑形状为 [1548… | A4 | 主线页重写 | 前向第一步：嵌入 |
| wiki/concepts/expert-parallel.md | 专家并行（EP）：专家放置、token 派发与结果组合 | 分布式推理与部署 › 并行维度 | 91/1083 | 4 | 已改未提交 | 从单设备 MoE 路由扩展到分布式专家，跟踪 token 与权重的归属，说明 dispatc… | A4 | 深入页重写 | MoE 层怎样跨卡算 |
| wiki/concepts/fine-grained-tp.md | 细粒度 TP：为特定模块选择分片组 | 分布式推理与部署 › 并行策略进阶 | 104/1179 | 1 | 已改未提交 | 从 DP 中重复保存的非专家权重出发，解释沿 DP 维度组成模块通信组，以及 embeddi… | A4 | 深入页重写 | 按模块选分片组 |
| wiki/concepts/flash-attention-3.md | FlashAttention：分块注意力与昇腾 FA3 接入 | 性能与工程优化 › 数值一致性与后端 | 91/1092 | 1 | 已改未提交 | 从密集注意力的中间张量解释分块计算，再区分 FlashAttention 算法与固定版本的昇… | A4 | 合并到 attention-backend-family | 后端实现细节，入链0 |
| wiki/concepts/glm-5-3-flash.md | 认识 GLM-5.3-Flash：从输入 token 到下一个 token | 开始学习 › 模型与请求概览 | 138/2556 | 4 | 未跟踪 | 沿 GLM-5.3-Flash 的文本路径，理解嵌入、45 层混合注意力、MoE、输出分数与… | A4 | 主线页重写 | 被执行的模型本体 |
| wiki/concepts/gqa.md | GQA：查询头如何共享 K/V，改变哪些开销 | 模型结构与计算 › 注意力与位置编码 | 105/1249 | 1 | 已改未提交 | GQA 让一组查询头共享 K/V，减少 K/V 投影宽度和缓存容量；查询头仍分别评分与汇合，… | A4 | 深入页重写 | KV 头共享 |
| wiki/concepts/kvpp.md | KVPP：按层共享缓存与提前广播 | 分布式推理与部署 › 并行策略进阶 | 88/1105 | 2 | 已改未提交 | 从 TP 中重复保存的历史状态出发，解释层 owner、暂存区和提前广播；以固定实验实现为边… | A4 | 深入页重写 | KV 沿流水切分 |
| wiki/concepts/layers-and-hidden.md | 层与隐藏表示：GLM 的 45 层如何连接 | 模型结构与计算 › Decoder 层与专家结构 | 81/1102 | 1 | 已改未提交 | 模型层逐步更新本轮输入的隐藏表示。GLM 文本主干包含 45 层，注意力与前馈类型按层号配置… | A4 | 主线页重写 | 稠密层主线 |
| wiki/concepts/linear-attention.md | KDA：通过递推状态处理序列 | 模型结构与计算 › 注意力与位置编码 | 128/1914 | 2 | 已改未提交 | GLM-5.3-Flash 的 KDA 层用按通道衰减、误差更新和查询读出维护矩阵状态，另保… | A4 | 主线页重写 | 线性注意力主线 |
| wiki/concepts/matmul-and-weights.md | 矩阵乘与权重：从输入向量到输出表示 | 模型结构与计算 › 输入表示与张量计算 | 88/1244 | 2 | 已改未提交 | 矩阵乘用同一组权重变换本轮各 token 的表示。本页从行与列的乘加展开 GLM 的前馈投影… | A4 | 深入页重写 | 层里算的是矩阵乘 |
| wiki/concepts/mla.md | MLA：压缩历史表示与稀疏检索 | 模型结构与计算 › 注意力与位置编码 | 86/1366 | 1 | 已改未提交 | MLA 用共享潜向量表示每个位置的 K/V；GLM-5.3-Flash 的稀疏层在此基础上增… | A4 | 深入页重写 | 稀疏注意力的压缩变体 |
| wiki/concepts/mlp-residual-norm.md | 前馈、残差与 RMSNorm：模型子层如何更新表示 | 模型结构与计算 › Decoder 层与专家结构 | 106/1352 | 2 | 已改未提交 | 门控前馈网络沿两条投影分支变换特征，残差连接保留输入路径，RMSNorm 按向量均方根调整尺… | A4 | 深入页重写 | 层内前馈与残差 |
| wiki/concepts/moe.md | MoE：专家选择、并行计算与结果聚合 | 模型结构与计算 › Decoder 层与专家结构 | 100/1411 | 2 | 已改未提交 | MoE 让每个 token 选择部分前馈专家参与计算。以 GLM 的 288 选 8 和共享… | A4 | 主线页重写 | MoE 主线 |
| wiki/concepts/op-to-ai-core.md | 从 RMSNorm 到设备 kernel：分派、融合与分块 | vLLM 与 Ascend 架构 › 模型执行与后端 | 91/1117 | 1 | 已改未提交 | 沿 GLM 的 RMSNorm 追踪实际设备接口，再用可选的残差融合分支解释 Host ti… | A4 | 深入页重写 | 算子到硬件单元 |
| wiki/concepts/ops-and-kernels.md | 算子与 kernel：从数学语义到设备实现 | vLLM 与 Ascend 架构 › 模型执行与后端 | 67/940 | 1 | 已改未提交 | 区分模型运算、框架算子与设备核函数，解释 CustomOp 分派、torch_npu 与自定… | A4 | 深入页重写 | 层调用哪些算子 |
| wiki/concepts/pipeline-parallel.md | 流水线并行（PP）：层分段、状态交接与气泡 | 分布式推理与部署 › 并行维度 | 76/981 | 2 | 已改未提交 | 将连续模型层分到多个阶段，说明阶段之间的张量与通信、单请求生成依赖，以及多个批次怎样提高流水… | A4 | 深入页重写 | 层沿流水切分 |
| wiki/concepts/quantization.md | 权重与激活量化：表示范围、存储和计算 | 模型结构与计算 › 数值表示与量化 | 81/1123 | 1 | 已改未提交 | 从浮点数映射到整数的算例出发，区分离线权重转换、运行时激活量化以及真实的容量和精度代价。 | A4 | 深入页重写 | 权重数值表示 |
| wiki/concepts/rope.md | RoPE：旋转如何把相对位置引入注意力 | 模型结构与计算 › 注意力与位置编码 | 88/1142 | 1 | 已改未提交 | RoPE 对 Q/K 的成对分量施加与位置相关的旋转，使点积包含相对位置关系；是否使用、旋转… | A4 | 深入页重写 | 位置编码；无入链待补 |
| wiki/concepts/sequence-parallel.md | 序列并行（SP）：让局部激活按 token 分片 | 分布式推理与部署 › 并行维度 | 72/868 | 1 | 已改未提交 | 从 TP 归约后的重复激活出发，解释 Reduce-Scatter、逐 token 计算与 … | A4 | 深入页重写 | 归一化段按序列切 |
| wiki/concepts/sparse-attention.md | 密集与稀疏注意力：从完整历史到候选位置 | 模型结构与计算 › 注意力与位置编码 | 71/1008 | 1 | 未跟踪 | 密集因果注意力访问全部可见历史，稀疏注意力在其中进一步限制位置集合；二者仍可使用评分、sof… | A4 | 主线页重写 | 稀疏注意力主线 |
| wiki/concepts/tensor-parallel.md | 张量并行（TP）：矩阵分片与结果合并 | 分布式推理与部署 › 并行维度 | 92/997 | 1 | 已改未提交 | 从矩阵乘的列分片和行分片推导 All-Gather 与 All-Reduce，再对应 GLM… | A4 | 深入页重写 | 层内按张量切 |
| wiki/concepts/speculative-decoding.md | 投机解码：提出候选、验证与提交状态 | 推理机制与状态 › 分块执行与投机解码 | 67/988 | 1 | 已改未提交 | 投机解码先提出多个候选，再由目标模型验证并提交可接受的前缀；收益取决于接受率和额外开销，GL… | A5 | 主线页重写 | MTP 草拟主线 |
| wiki/concepts/structured-output.md | 结构化输出：文法状态怎样约束 token 采样 | 服务能力 › 适配器与输出约束 | 99/1125 | 1 | 已改未提交 | 以允许 token 集合解释格式约束，再连接文法编译、投机采样、推理阶段与昇腾 mask 执… | A5 | 深入页重写 | 采样阶段的约束 |
| wiki/concepts/graph-mode-layer.md | 图执行：编译、捕获与回放分别做什么 | vLLM 与 Ascend 架构 › 模型执行与后端 | 78/1173 | 1 | 已改未提交 | 从逐算子下发说明图执行的动机，区分计算图改写与设备任务捕获，解释运行时分派、动态输入和 GL… | A6 | 主线页重写 | decode 步的图模式 |
| wiki/concepts/kv-cache.md | 推理缓存：跨轮保存哪些历史状态 | 推理机制与状态 › 生成阶段与状态 | 67/885 | 1 | 已改未提交 | 推理缓存保存后续计算所需的历史状态。GLM-5.3-Flash 同时维护 MLA 潜向量、索… | A6 | 主线页重写 | decode 步读写历史 |
| wiki/concepts/prefill.md | Prefill 与 Decode：输入如何变成连续输出 | 推理机制与状态 › 生成阶段与状态 | 61/795 | 1 | 已改未提交 | Prefill 处理已知输入并产生首个输出 token，普通 Decode 逐步输入上一次生… | A6 | 主线页重写 | prefill 与 decode 两种步 |
| wiki/concepts/balance-scheduling.md | 均衡调度：DP 执行组的统一准入条件 | 分布式推理与部署 › 多副本与专家负载 | 60/807 | 1 | 已改未提交 | 用各rank的运行请求数决定是否继续接纳等待请求，解释统一准入与请求迁移、实际计算负载之间的… | B1 | 深入页重写 | DP 组统一准入 |
| wiki/concepts/data-parallel.md | 数据并行（DP）：请求分配与副本协作 | 分布式推理与部署 › 并行维度 | 80/1028 | 2 | 已改未提交 | 先理解请求分给多个执行副本，再区分普通副本、跨副本专家并行与元数据协调；不把 DP 规模等同… | B1 | 主线页重写 | 请求分到哪个副本 |
| wiki/concepts/dyntra-lb.md | DynTra：按历史块数调整 D 端执行集合 | 分布式推理与部署 › 多副本与专家负载 | 86/1193 | 1 | 已改未提交 | 用块数而非请求数估计DP执行负载，说明本地暂停与准入计划、阈值和启发式代价，并保留开发快照的… | B1 | 深入页重写 | 按块数调 D 端集合 |
| wiki/concepts/async-scheduling.md | 异步调度：让主机准备与设备计算重叠 | 推理机制与状态 › 调度与执行重叠 | 76/1215 | 1 | 已改未提交 | 跟踪计划、占位记账和结果确认，解释异步调度如何缩短设备等待，以及取消、缓存和自定义调度器需要… | B2 | 深入页重写 | 批与批之间的重叠 |
| wiki/concepts/batch-invariance.md | 批不变性：相同输入为何会随同批请求改变结果 | 性能与工程优化 › 数值一致性与后端 | 92/976 | 1 | 已改未提交 | 从浮点归约顺序解释批间数值差异，再说明固定版本的算子替换、覆盖范围与验证层次。 | B2 | 深入页重写 | 同批请求影响数值 |
| wiki/concepts/batch-job-aware-scheduler.md | 批作业感知调度：为运行请求保留增长空间 | 推理机制与状态 › 调度与执行重叠 | 92/1314 | 1 | 已改未提交 | 从缓存增长与抢占成本出发，解释预留预算、作业分组和输出长度估计如何共同影响等待请求的准入。 | B2 | 深入页重写 | 为运行请求留预算 |
| wiki/concepts/concurrent-requests.md | 多请求并发：批次如何组成，状态如何隔离 | 开始学习 › 模型与请求概览 | 161/2508 | 2 | 未跟踪 | 沿用 GLM-5.3-Flash，通过 A、B、C 三个请求的四轮执行，理解连续批处理、输入… | B2 | 主线页重写 | 连续批处理主线 |
| wiki/concepts/short-request-first.md | 短请求优先：等待顺序与长请求公平性 | 推理机制与状态 › 调度与执行重叠 | 80/937 | 1 | 已改未提交 | 用同一组长短输入比较准入顺序，解释恢复请求、短输入、老化长输入的优先关系，以及它与分块预填充… | B2 | 深入页重写 | 批内排序策略 |
| wiki/concepts/kv-cache-cpu-offload.md | CPU 前缀备份：保存完整缓存段并按需回填 | 推理机制与状态 › 状态精度与分层存储 | 80/1246 | 1 | 已改未提交 | 从设备缓存淘汰后的前缀复用问题出发，解释完整段的备份、外部命中、回填和传输完成，以及主机容量… | B3 | 深入页重写 | 换出到主机内存 |
| wiki/concepts/kv-cache-layerwise-offload.md | 逐层缓存传输：计算重叠与缓冲区复用 | 分布式推理与部署 › 服务分离与状态传输 | 80/1087 | 1 | 已改未提交 | 按模型层安排缓存读写，解释等待如何与计算重叠，以及缓存规格、完成事件和共享槽位怎样限制显存复… | B3 | 深入页重写 | 按层传输状态 |
| wiki/concepts/kv-cache-quantization.md | 缓存量化：写入、读取与容量边界 | 推理机制与状态 › 状态精度与分层存储 | 76/1042 | 1 | 已改未提交 | 解释缓存写入时的整数化、读取时的尺度恢复，并区分有效数据减半、物理页容量和混合注意力状态。 | B3 | 深入页重写 | 压精度换块数 |
| wiki/concepts/kv-cache-sparse-offload.md | 稀疏缓存卸载：按选中位置加载历史数据 | 推理机制与状态 › 状态精度与分层存储 | 86/1257 | 1 | 已改未提交 | 从稀疏注意力的访问集合出发，解释主机全量历史、设备索引状态、热缓存和缺失行加载，计算容量与搬… | B3 | 深入页重写 | 稀疏换出策略 |
| wiki/concepts/kv-pool.md | 外部 KV 池：前缀匹配、加载和完成状态 | 推理机制与状态 › 外部缓存与连接器 | 78/1231 | 1 | 已改未提交 | 解释外部缓存怎样补充本地前缀命中，如何识别数据归属，以及命中计划到实际可读之间需要哪些步骤。 | B3 | 深入页重写 | 外部缓存池 |
| wiki/concepts/lmcache.md | LMCache：外部缓存如何接入推理引擎 | 推理机制与状态 › 外部缓存与连接器 | 71/1058 | 1 | 已改未提交 | 以两次共享前缀的请求解释外部缓存读写，区分设备页与存储段，以及 Ascend 包装、上游接口… | B3 | 深入页重写 | 外部连接器实现 |
| wiki/concepts/mooncake-connector.md | Mooncake 连接器：状态生命周期与数据传输 | 分布式推理与部署 › 服务分离与状态传输 | 90/1028 | 2 | 已改未提交 | 把调度侧的块归属、元数据与完成通知，对应到执行侧的地址注册、分组搬运和逐层重叠；区分固定版本… | B3 | 深入页重写 | KV 传输连接器 |
| wiki/concepts/recompute-cpu-offload.md | 抢占卸载：保存请求状态并恢复计算 | 推理机制与状态 › 状态精度与分层存储 | 77/1255 | 1 | 已改未提交 | 解释请求被抢占时哪些状态需要保存、传输完成如何决定释放与恢复，以及主机容量不足时的退路。 | B3 | 深入页重写 | 抢占后换出还是重算 |
| wiki/concepts/recompute-scheduler.md | 重计算调度：D 端容量不足时如何恢复请求 | 分布式推理与部署 › 多副本与专家负载 | 71/1019 | 1 | 已改未提交 | 沿分配失败、状态保存或重建、代理续接解释D端恢复路径，区分普通抢占、保存缓存以及重新进入pr… | B3 | 主线页重写 | 抢占与重算主线 |
| wiki/concepts/ucm.md | UCM：前缀存储与两种 PD 数据流 | 推理机制与状态 › 外部缓存与连接器 | 70/1044 | 1 | 已改未提交 | 区分共享前缀缓存、集中式存储转交和Mooncake直接传输，解释调度计划、数据到达及持久化的… | B3 | 深入页重写 | 统一缓存管理 |
| wiki/concepts/acl-graph.md | ACL Graph：捕获、批形状与重复执行 | 性能与工程优化 › 图执行与主机资源 | 94/1301 | 1 | 已改未提交 | 从 Host 下发开销出发，解释稳定缓冲、批描述符、补齐与三种执行路径，以及捕获和回放各自的… | B4 | 主线页重写 | 图捕获与批形状补齐 |
| wiki/concepts/npugraph-ex.md | 编译图融合：改变算子边界与中间数据流 | 性能与工程优化 › 图执行与主机资源 | 89/1049 | 1 | 已改未提交 | 解释编译器怎样识别计算片段、替换融合实现，以及 npugraph_ex、本地匹配器、静态 k… | B4 | 深入页重写 | 图分档与补齐实现 |
| wiki/concepts/eplb.md | EPLB：专家负载统计与物理放置调整 | 分布式推理与部署 › 多副本与专家负载 | 84/1207 | 2 | 已改未提交 | 区分逻辑专家和设备槽位，通过局部负载算例解释专家迁移、冗余副本、映射切换以及统计和传输的成本… | B5 | 主线页重写 | 专家负载统计与迁移 |
| wiki/concepts/large-scale-ep.md | 大规模 EP：请求路由、专家域与跨机通信 | 分布式推理与部署 › 并行策略进阶 | 76/1078 | 1 | 已改未提交 | 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端… | B5 | 深入页重写 | 大规模专家部署 |
| wiki/concepts/lora.md | LoRA：低秩更新与多适配器推理 | 服务能力 › 适配器与输出约束 | 96/981 | 1 | 已改未提交 | 从线性层的低秩更新解释 LoRA，再连接适配器槽位、批处理与昇腾执行路径。 | 无 | 保留小修 | GLM 主线不走适配器 |
| wiki/concepts/reading-vllm-ascend.md | 源码阅读方法：从架构问题追到实现证据 | vLLM 与 Ascend 架构 › 源码阅读 | 94/1305 | 2 | 已改未提交 | 以请求数据、配置和实际实现为入口，记录输入输出与条件；遇到异常或版本变化时逐步缩小范围，区分… | 无 | 保留小修 | 读码方法，附录 |
| wiki/concepts/vllm-ascend-repo-map.md | 源码目录地图：把文件放回推理架构 | vLLM 与 Ascend 架构 › 源码阅读 | 83/1037 | 1 | 已改未提交 | 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上… | 无 | 保留小修 | 仓库地图，附录 |

### 2.2 RFork 工作版页（同事仓库工作版，一律「RFork 待定」，不给处置建议）

| 路径 | 标题 | 当前 toc 分组 | 行/汉字 | 图 | git | 一句话主题 | 站 | 初步处置 | 理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wiki/concepts/rfork.md | RFork：工作版机制与排错总览 | RFork 工作版 › 工作版机制与维护 | 205/3731 | 1 | 已改未提交 | 新实例可从兼容的已有 Worker 读取权重，复用其已加载的数据。以独立 RFork 工作版… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-config.md | RFork 配置：四类端口、各项超时与可复制的启动示例 | RFork 工作版 › 工作版机制与维护 | 307/4121 | 0 | 已改未提交 | 想让第二个实例从已有实例借权重，要在启动命令里写哪些设置、写在哪。这页按用途讲工作版 RFo… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-identity.md | RFork 身份匹配：同模型、同布局，还要同一份分片 | RFork 工作版 › 工作版机制与维护 | 194/2736 | 1 | 已改未提交 | B 想借 A 的权重，两边必须各自算出一模一样的 seed key：先把模型版本、数值类型、… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-layout.md | RFork 张量布局：先对齐算子要的形状，再决定搬什么 | RFork 工作版 › 工作版机制与维护 | 163/2475 | 1 | 已提交 | 新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-lifecycle.md | RFork 生命周期：模型可用、租约归还、成为 seed 是三件事 | RFork 工作版 › 工作版机制与维护 | 217/3833 | 1 | 已提交 | 新实例读完权重之后，还要把借来的名额还给 Planner，再决定要不要自己当来源。这页讲这几… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-maintenance.md | RFork 版本维护：保留原补丁，钉住真正运行的完整代码 | RFork 工作版 › 工作版机制与维护 | 182/2935 | 0 | 已提交 | 同事又发来一份 RFork 补丁时，怎么弄清现在跑的是哪版代码。这页讲：工作版为什么和社区版… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-memory.md | RFork 内存：地址、底层存储与 main/draft 共享 | RFork 工作版 › 工作版机制与维护 | 157/2677 | 1 | 已提交 | 把权重地址登记给传输引擎时，要分清“权重自己占的那一段”和“它所在的整块内存”，还要把权重背… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/sources/rfork-official-guide.md | RFork 官网核读：原图、全部章节与工作版差异 | RFork 工作版 › 工作版机制与维护 | 156/2266 | 0 | 已改未提交 | 按用户指定的英文 latest RFork Guide 核读全文与架构图，对照独立工作版，区… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-startup.md | RFork 启动：准备模型以后才借 seed，失败后先清理再重建 | RFork 工作版 › 工作版机制与维护 | 203/3212 | 1 | 已改未提交 | 新实例用 RFork 启动时，先把自己的模型搭好、布局转好，再去借一份来源读权重；借不到或读… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-terms.md | RFork 术语：把模型、内存和调度的名词分开 | RFork 工作版 › 工作版机制与维护 | 167/2836 | 0 | 已改未提交 | 读 RFork 时碰到的名词，常常一个词在模型、内存、调度三层各有意思。这页按层列成表：每个… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-transfer.md | RFork 传输：先验整张清单，再按地址读字节 | RFork 工作版 › 工作版机制与维护 | 205/2843 | 1 | 已改未提交 | 新实例找到可借权重的来源后，先向它要一份“去哪读、读哪些”的说明，把两边每一块权重的名字、个… | 无 | RFork 待定 | 同事仓库工作版 |
| wiki/concepts/rfork-troubleshooting.md | RFork 排错：从第一条异常还原版本、阶段与资源状态 | RFork 工作版 › 工作版机制与维护 | 241/3881 | 0 | 已提交 | RFork 出错时从哪查起：先确认是哪一版代码，再找日志里最早的那条具体异常，最后看模型、租… | 无 | RFork 待定 | 同事仓库工作版 |

### 2.3 参数页（`wiki/params/`）

参数页的骨架由 `pnpm wiki:build-param-pages` 生成、四节是硬规则，重构不改它们的格式；这里的「站」只表示它挂在路线的哪一段，方便将来从主线页链过去。

| 路径 | 标题 | 当前 toc 分组 | 行/汉字 | 图 | git | 一句话主题 | 站 | 初步处置 | 理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wiki/params/ascend-warmup-config-67c96ed9ab5c.md | ascend_warmup_config | 参数参考 › 配置与版本 | 79/273 | 0 | 未跟踪 | ascend_warmup_config 的静态定义，正文待补。 | A0 | 删除 | 骨架页，正文待补 |
| wiki/params/block-table-no-commit-optimize-8328d0d2d00d.md | block_table_no_commit_optimize | 参数参考 › 配置与版本 | 110/708 | 0 | 已改未提交 | MRv1 块表优化的回退开关：默认 0 用「只提交脏行区间」的 OptimizedBlock… | A2 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/c8-enable-reshape-optim-8bd7e5f82c6c.md | c8_enable_reshape_optim | 参数参考 › 配置与版本 | 161/1508 | 0 | 已改未提交 | 让 LightningIndexer 的 C8 缓存写入改走 StoreKVBlock 算子… | B3 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/combine-quant-mode-2a3f7cd47997.md | combine_quant_mode | 参数参考 › 配置与版本 | 168/1590 | 0 | 已改未提交 | MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-async-exponential.md | enable_async_exponential | 参数参考 › 配置与版本 | 174/1881 | 1 | 已改未提交 | 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward… | A5 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-early-kernel-warmup-4f9673f636f5.md | enable_early_kernel_warmup | 参数参考 › 配置与版本 | 79/273 | 0 | 未跟踪 | enable_early_kernel_warmup 的静态定义，正文待补。 | A0 | 删除 | 骨架页，正文待补 |
| wiki/params/enable-early-nz-warmup-b9e63a0caadc.md | enable_early_nz_warmup | 参数参考 › 配置与版本 | 79/273 | 0 | 未跟踪 | enable_early_nz_warmup 的静态定义，正文待补。 | A0 | 删除 | 骨架页，正文待补 |
| wiki/params/enable-force-eplb-b7ec3661121f.md | enable_force_eplb | 参数参考 › 配置与版本 | 175/1457 | 0 | 已改未提交 | 把 MoE 路由算出来的 topk_ids 整个丢掉，换成一张按 ep_size / ep_… | B5 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-matmul-allreduce.md | enable_matmul_allreduce | 参数参考 › 配置与版本 | 195/2327 | 1 | 已改未提交 | 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md | enable_pcp_embedding_lmhead_weight_sharding | 参数参考 › 配置与版本 | 141/731 | 0 | 已改未提交 | PCP>1 时把 embedding 与 LM Head 的权重按 TP×PCP 网格再切一… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md | enable_pcp_o_proj_weight_sharding | 参数参考 › 配置与版本 | 171/1549 | 0 | 已改未提交 | 开了 SFA-PCP 之后，让 o_proj 权重在加载期就按 PCP 组再切一刀、常驻只留… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-sleep-mode-extra-cleanup.md | enable_sleep_mode_extra_cleanup | 参数参考 › 配置与版本 | 187/1619 | 1 | 已改未提交 | sleep 时额外销毁 HCCL 通信域、清空 ACL 图工作区，把分配器池子之外的那两块显… | A0 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/enable-super-kernel-ce990e186bfa.md | enable_super_kernel | 参数参考 › 配置与版本 | 224/1529 | 0 | 已提交 | ascend_compilation_config 里的第三级加码开关：把整网框进一个 su… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/fuse-allreduce-rms.md | fuse_allreduce_rms | 参数参考 › 配置与版本 | 185/2104 | 1 | 已改未提交 | 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/kvpp-config-0445bd352140.md | kvpp_config | 参数参考 › 配置与版本 | 160/1262 | 0 | 已改未提交 | AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/layer-sharding.md | layer_sharding | 参数参考 › 配置与版本 | 188/2262 | 1 | 已改未提交 | 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/multistream-overlap-gate.md | multistream_overlap_gate | 参数参考 › 配置与版本 | 178/2175 | 1 | 已改未提交 | v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_ex… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/prefetch-ratio.md | prefetch_ratio | 参数参考 › 配置与版本 | 175/1861 | 1 | 已改未提交 | weight_prefetch_config 下的嵌套 dict，按 attn/moe/ml… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/profiling-chunk-config.md | 动态切块配置（profiling_chunk_config） | 参数参考 › 配置与版本 | 257/2418 | 1 | 已改未提交 | 上游叫 CPP 的动态切块：启动时量出 prefill 延迟曲线，运行时反解每步该切多少 t… | A0 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md | sfa_dcp_force_tmajor_restore | 参数参考 › 配置与版本 | 174/1396 | 0 | 已改未提交 | DCP 解码路径上 query all-gather 之后，把布局还原从零拷贝的 strid… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/size-40a1c2ca47b8.md | size | 参数参考 › 配置与版本 | 145/1300 | 0 | 已提交 | KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关… | A2 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/use-fused-overlap-75a180fff6ab.md | use_fused_overlap | 参数参考 › 配置与版本 | 165/1416 | 0 | 已改未提交 | Sparse KV Offload 在 decode 上的第二条路径开关，挂在 sparse… | A4 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/use-layerwise-b475778cd352.md | use_layerwise | 参数参考 › 配置与版本 | 186/1786 | 0 | 已改未提交 | KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在… | B3 | 保留小修 | 参数参考，格式由脚本定 |
| wiki/params/weight-prefetch-config.md | weight_prefetch_config | 参数参考 › 配置与版本 | 184/2015 | 0 | 已改未提交 | v0.23.0 的 additional_config 开关，把 linear 层权重提前搬… | A4 | 保留小修 | 参数参考，格式由脚本定 |

### 2.4 来源与记录页（`wiki/sources/`）

| 路径 | 标题 | 当前 toc 分组 | 行/汉字 | 图 | git | 一句话主题 | 站 | 初步处置 | 理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md | 问答记录：Block Table 里的块什么时候分配、什么时候回收 | 来源与更新记录 › 问答记录 | 81/704 | 0 | 已改未提交 | 一次问答的归档。结论是分配与回收都不在块表里发生，而在上游 EngineCore 进程的 K… | 无 | 保留小修 | 问答归档，不进主线 |
| wiki/sources/glm-5-3-flash-baseline.md | GLM-5.3-Flash：模型配置与官方双机来源基线 | 来源与更新记录 › 来源与版本依据 | 127/1972 | 1 | 未跟踪 | 固定贯穿模型的配置、官方双机教程、量化权重提交和镜像摘要，已定位 arm64 镜像的 Asc… | 无 | 保留小修 | 全库共用来源基线 |
| wiki/sources/pr-11953.md | [Refactor] remove layer sharding | 来源与更新记录 › PR 记录 | 102/1456 | 0 | 已提交 | 上游 PR | 无 | 保留小修 | PR 归档，不进主线 |
| wiki/sources/qwen-request-legacy.md | 历史算例：Qwen3.6-35B-A3B 双 NPU 请求 | 来源与更新记录 › 来源与版本依据 | 249/3667 | 3 | 未跟踪 | 保存改版前的 Qwen3.6-35B-A3B 双 NPU 算例，供尚未迁移的旧专题追溯。模型… | 无 | 合并到 one-request | 旧模型 trace，素材可用 |

### 2.5 草稿（不在站点目录内）

| 路径 | 标题 | 当前 toc 分组 | 行/汉字 | 图 | git | 一句话主题 | 站 | 初步处置 | 理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wiki/_drafts/profiling-chunk-config.md | profiling_chunk_config | （草稿，不进站） | 129/1300 | 0 | 已提交 | 基于 profiling 的动态 chunk 大小配置，默认关闭。在 main 开发主线上，… | 无 | 删除 | 同名正式页已发布 |

## 3. 汇总

### 3.1 处置分布

| 处置 | 页数 |
| --- | --- |
| 深入页重写 | 58 |
| 保留小修 | 27 |
| 主线页重写 | 26 |
| RFork 待定 | 12 |
| 合并到 X | 7 |
| 删除 | 3 |
| 合计 | 133 |

合并的去向：

- `ai-qos` → `cann-hccl`（同为互连链路，入链仅1）
- `epd-disaggregation` → `pd-disaggregation`（同类分离形态，入链0）
- `flash-attention-3` → `attention-backend-family`（后端实现细节，入链0）
- `paged-attention` → `block-table`（同讲分页寻址，入链1）
- `superpod` → `hardware-devices`（同讲互连拓扑，入链0）
- `who-owns-what` → `vllm-ascend-overview`（职责边界重叠，入链2）
- `qwen-request-legacy` → `one-request`（旧模型 trace，素材可用）

### 3.2 各站覆盖

| 站 | 名称 | 页数 | 主线页 | 深入页 | 其他（参数 / 合并 / 删除） |
| --- | --- | --- | --- | --- | --- |
| A0 | 部署全景与启动 | 27 | `glm-5-3-flash-two-node`、`npu-worker-lifecycle`、`vllm-v1-shape` | 15 | 9 |
| A1 | 入口（HTTP / API server / 分词 / 选 DP 组） | 2 | `request-call-chain`、`token` | 0 | 0 |
| A2 | 调度第一步 | 11 | `vllm-scheduler` | 7 | 3 |
| A3 | 准备输入 | 2 | `npu-model-runner`、`prepare-inputs-flow` | 0 | 0 |
| A4 | 逐层前向（嵌入、稠密层、线性注意力、稀疏注意力、MoE、lm_head） | 39 | `attention-qkv`、`embedding`、`glm-5-3-flash`、`layers-and-hidden`、`linear-attention`、`moe`、`sparse-attention` | 18 | 14 |
| A5 | 采样与 MTP 草拟 | 3 | `speculative-decoding` | 1 | 1 |
| A6 | decode 步与图模式 | 3 | `graph-mode-layer`、`kv-cache`、`prefill` | 0 | 0 |
| A7 | 返回与收尾 | 0 | — | 0 | 0 |
| B1 | 多个 DP 组怎样分请求 | 3 | `data-parallel` | 2 | 0 |
| B2 | 连续批处理 | 5 | `concurrent-requests` | 4 | 0 |
| B3 | KV 块不够时的抢占 | 12 | `recompute-scheduler` | 9 | 2 |
| B4 | 图尺寸补齐 | 2 | `acl-graph` | 1 | 0 |
| B5 | 多请求下 MoE 的负载 | 3 | `eplb` | 1 | 1 |
| 全线 | 跨站主干 | 2 | `learning-guide`、`one-request` | 0 | 0 |
| 无 | 挂不上路线 | 19 | — | — | 19 |

### 3.3 没有页、或页明显不够的站

- **A7 返回与收尾：0 页，必须新建。** 现在只有 `one-request` 结尾几句带过；「增量结果怎样流式发回、请求结束后 KV 块与请求状态怎样回收」没有任何一页讲。
- **A5 采样：缺「采样」本身。** `speculative-decoding`（MTP 草拟）和 `structured-output`（约束）都在，但「logits → 温度 / top-p / top-k → 定下这个 token」没有专页，只在 `glm-5-3-flash` 里带过一句。
- **A1 入口：缺 HTTP 入口与选 DP 组。** 现有 `token`（分词）和 `request-call-chain`（调用链）两页；「请求怎样进 API server、怎样被分到某个 DP 组」现在散在 `data-parallel` 里，要么新建要么从 B1 拆一段过来。
- **A3 准备输入：只有 2 页，偏薄。** `prepare-inputs-flow` + `npu-model-runner`；注意力元数据这一块现在挂在 `attention-backend-family`（A4），按路线讲要往 A3 挪一段。
- **A4 是超载站：** 39 页（其中教学页 26 页），占全部教学页约三成。按站内小节（嵌入 / 稠密层 / 线性注意力 / 稀疏注意力 / MoE / lm_head / 并行切分 / 算子落地）再分层，否则一站读不完。另外 lm_head 与词表输出没有独立页，只在 `glm-5-3-flash` 和 `fine-grained-tp` 里出现。

### 3.4 挂不上任何一站的页

| 页 | 为什么挂不上 | 处置 |
| --- | --- | --- |
| wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md | 问答归档，不进主线 | 保留小修 |
| wiki/sources/glm-5-3-flash-baseline.md | 全库共用来源基线 | 保留小修 |
| wiki/concepts/lora.md | GLM 主线不走适配器 | 保留小修 |
| wiki/sources/pr-11953.md | PR 归档，不进主线 | 保留小修 |
| wiki/sources/qwen-request-legacy.md | 旧模型 trace，素材可用 | 合并到 one-request |
| wiki/concepts/reading-vllm-ascend.md | 读码方法，附录 | 保留小修 |
| wiki/concepts/rfork.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-config.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-identity.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-layout.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-lifecycle.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-maintenance.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-memory.md | 同事仓库工作版 | RFork 待定 |
| wiki/sources/rfork-official-guide.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-startup.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-terms.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-transfer.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/rfork-troubleshooting.md | 同事仓库工作版 | RFork 待定 |
| wiki/concepts/vllm-ascend-repo-map.md | 仓库地图，附录 | 保留小修 |

其中 RFork 的 12 页（11 页 `concepts/` + 1 页 `sources/rfork-official-guide.md`）是用户同事仓库的工作版，按约定一律「RFork 待定」，不计入路线覆盖，也不给处置建议。

### 3.5 占位页、疑似占位与断链

**真占位（骨架页，正文没写）**：

- `wiki/params/ascend-warmup-config-67c96ed9ab5c.md`（79 行 / 273 汉字，未跟踪）：summary 写「正文待补」，三节正文都是「骨架，待补：…」。
- `wiki/params/enable-early-kernel-warmup-4f9673f636f5.md`（79 行 / 273 汉字，未跟踪）：summary 写「正文待补」，三节正文都是「骨架，待补：…」。
- `wiki/params/enable-early-nz-warmup-b9e63a0caadc.md`（79 行 / 273 汉字，未跟踪）：summary 写「正文待补」，三节正文都是「骨架，待补：…」。
- `wiki/_drafts/profiling-chunk-config.md`：草稿残留，正式页 `wiki/params/profiling-chunk-config.md` 已发布。

**疑似占位词（脚本按「占位 / 未完成 / 待补 / TODO」匹配，23 页命中）**：抽查后基本是正文正常用词（如「占位记账」「未完成的请求」），不是占位内容，重写时顺手确认即可：

`async-scheduling`、`attention-cost`、`balance-scheduling`、`chunked-prefill`、`concurrent-requests`、`kv-cache-cpu-offload`、`kv-cache-spec`、`kv-cache`、`lmcache`、`mla`、`npu-model-runner`、`ops-and-kernels`、`pd-disaggregation`、`pipeline-parallel`、`prefill`、`prepare-inputs-flow`、`recompute-scheduler`、`rfork-layout`、`ucm`、`vllm-engine-core`、`vllm-scheduler`、`glm-5-3-flash-baseline`、`rfork-official-guide`。

**断链与图**：

- 站内 Markdown 链接：0 条断链（全库逐条核过）。
- `relations` 指向不存在的页：0 条。
- 正文引用但缺 spec 或缺 SVG 的图：0 张。
- 图 spec 共 133 张，其中 1 张没有任何页引用：`wiki/diagrams/patch-inventory.yaml`。
- `wiki/TERMS.md`「对应页面」列指向的页：0 处缺失。
- 站外 URL 本次没有联网验证，需要另跑 `pnpm wiki:urls`。

### 3.6 其他影响重构排期的数

- 无任何入链的教学页 12 页（因为有 `chapters`，lint 不报 orphan，但读者从别的页走不过去）：`batch-invariance`、`batch-job-aware-scheduler`、`cpu-binding`、`epd-disaggregation`、`flash-attention-3`、`gap-a5164fe10fa9184412f8`、`large-scale-ep`、`lora`、`rope`、`short-request-first`、`structured-output`、`superpod`。
- 已按「讲解 + 对照源码」两层结构写的非 RFork 页只有 5 页：`device-memory`、`glm-5-3-flash`、`hardware-devices`、`vllm-v1-shape`、`qwen-request-legacy`；其余教学页还是旧写法，重写时要统一（RFork 的 8 页也已是两层结构）。
- 仍保留 `## 一句话` 小节的页：27 页 = 24 页参数页（四节仍是硬规则）+ 3 页来源/PR/问答归档（`answer-fbdf…`、`pr-11953`、`rfork-official-guide`）。教学页已全部去掉这一节，也没有一页还是 2026-09-11 前的旧四节格式。
- git 状态：已提交 8 页、已改未提交 114 页、未跟踪 11 页。动手重构前要先定这批未提交改动怎么处理。

---

盘点脚本是一次性的，放在本次会话 scratchpad，未进仓库：`inventory-extract.mts`（抽元数据）、`mapping.json`（人判的站与处置）、`render.mjs`（渲染本表）。
