# 推理专题图审与模型策略记录（2026-10-24）

依据：[写作标准](../../../wiki-writing-standard.md)、[知识补全计划 Task 4](../../../superpowers/plans/2026-10-21-inference-knowledge-completion.md#task-4模型与策略对照)。用户要求检查近期文章全部图片，再继续推进。范围是此前八篇推理页、阅读指南的图，以及模型与策略阶段；没有开始 Task 5 的 950 架构页。

**状态：内容与静态图已修订，独立审查已闭环；页面内浏览器验收待补。** 本轮浏览器操作遭 URL 策略拦截，未绕过限制。下面的图片检查指读取本地生成的 PNG，不等同于页面布局、链接操作或窄屏验收。

## 改前清单与信息保留

本轮修改前副本保存在 `tools/wiki-runtime/inference-diagrams-strategies-2026-10-24/baseline/`。此前八篇的完整事实清单沿用[上一批记录](inference-learning-revision-2026-10-24.md#改前信息清单)，本轮逐项检查受图修改影响的事实，不删除原文机制、数字、边界、待核与来源。

| 原有图 | 原来必须保留的信息 | 本轮处理与核对 |
| --- | --- | --- |
| inference-performance-intuition | 新请求与已有输出请求争用执行步 | 改为两列纵排，首图只讲等待关系 |
| inference-performance-evidence | 排队、执行、返回的分流与七站定位 | 缩窄画布，保留全部分支 |
| inference-benchmarking-intuition | 同时判断速度、成功与目标达成 | 调整宽度，含义保留 |
| inference-benchmarking-flow | 固定条件、采集、聚合与验收 | 调整宽度；“冷暖条件”改为预热与缓存条件 |
| inference-analysis-intuition | 计算、读取、通信及重叠 | 调整宽度，三类成本保留 |
| inference-analysis-critical-path | 独立计算与通信重叠，缩短非关键段不改善结束时刻 | 改为同一比例时间轴；计算 0–6、通信 3–8，计算缩到 0–4 后结束仍为 8；依赖前提写明 |
| inference-troubleshooting-boundary | 找最后成功交接，从边界继续查 | 明确“是/否”分支方向，不合并原诊断站点 |
| inference-troubleshooting-experiment | 固定条件、只改变量、检查反证与代价 | 调整宽度，步骤保留 |
| inference-performance-choice | 六类性能问题与各自实验 | 调整宽度及右侧框，六类仍在 |
| inference-correctness-layers | 输入、数值、状态、返回的逐层定位 | 调整宽度，顺序保留 |
| inference-correctness-first-difference | 同一前缀查首次差异 | 调整宽度，比较对象保留 |
| deepseek-serving-request | E/P/D、block KV/3FS、主机 SWA、设备运行状态 | 将保存位置与读写关系分清，补 P 写 block KV 的箭头；图前解释术语 |
| deepseek-serving-code-boundary | 生产组件与离线开源引擎边界 | 实际查看后保留 |
| inference-capacity-intuition | 到达负载、独立实例、故障后服务能力 | 实际查看后保留 |
| inference-recovery-flow | 计划下线与突然故障；迁移/等待、续传/新尝试、确认后释放 | 四个回答框明确条件，移除箭头与文本交叠；全部恢复条件保留 |
| learning-guide-route | 五步主线、相关知识分组、三类按需资料 | 由横排改纵排，原分组全部保留 |

合计 16 张原图，改 14 张、保留 2 张。新增 `inference-performance-ab-timeline` 把正文已经存在的 D/N A/B 数据画在同一时间轴上：A 的输入步 430–620，B 的三块 430–500、510–580、590–660；D 到达间隔改善，N 首字从 650 延至 690。未画出的其他设备小步在图注说明，圆点只表示客户端输出事件。该图没有新增实测数据，也没有把 D 的全部耗时解释为设备计算。

四个协议页改前信息也保留：token 的 BPE、模板和词表边界；入口的校验、请求包装、登记与分流；流式的反分词、停止和协议片段；结构化输出的文法、bitmask、采样与回退。新增的是 Recipe 特有契约，原来的 GLM 推导及三版核对没有被覆盖。14 个机制页仅加回链段落，不重复推导；attention-cost 的旧 S18 角标移至源码区，原句、来源及“未独立核源码”的条件保留。

## 新页职责与固定来源

| 新页 | 唯一维护的知识与演算 | 原有机制如何复用 |
| --- | --- | --- |
| deepseek-v4-1-flash | CED、CSA2、状态来源和配置；四层/100 位置示意工作量；128 个原始位置的分页载荷 113920 B | 主线前向、attention-cost、KV 规格；不复制 GLM 分组与显存账 |
| swa-bounded-replay | 窗口 3、位置 7/8/9 的可见范围；128/134/140；命中后退、encoder/decoder 路径、mask/compact 与完整计算的区别 | KV、prefix caching 和正确性诊断；不另写外部缓存通论 |
| dspark | 半自回归草稿；两条请求分配验证位置；期望输出与整轮成本；异步置信信息的轮次 | 推测解码的接受/拒绝、异步调度、达标吞吐；复用已有 v0.26/main 分支核对 |
| low-precision-formats | 元素、分组 scale、物理布局与累加；E2M1 舍入进入点积；MXFP4 每组 17 B | 量化、KV 量化、AI Core；GLM 的整数 W8A8 不改称 FP8 |

四页各新增机制图与实现/检查流程图，共 8 张；加上 A/B 图，本轮新建 9 张图。新页 `verified: []`，没有把文档审查当作框架或设备支持验证。

关键固定来源：

- DeepInfer：`774ce244b87cc0eb8d4b94ab9f5de2ab22049f01`。读取 README、生产 Q&A、配置加载、cache engine、YoCo、DSpark 草稿、置信调度、Ascend KV 转换及测量脚本。
- V4.1 模型配置：`deepseek-ai/DeepSeek-V4.1-Flash-1017@1bae0e1088993b9b82de08f59de5be5a34e42170`；报告 `arXiv:2609.19969v1`；DSpark 论文 `2607.05147v1`。
- Recipe：`935817c66f5d6e64838f419692545f06787e485f`，读取 README、tokenizer 与 streaming 文档。分别补入 token、api-server-entry、streaming-output、structured-output，不新建重复协议页。
- OCP MX v1.0、NVIDIA Transformer Engine 2.8 格式说明与 NVFP4 官方材料；HiF8 原论文及 CANN 官方类型资料。CANN 原链接直接抓取超时，交叉核对另一个官方页面/搜索结果，不称原链接已完整访问。

下载的固定文件在同一 runtime 目录的 `sources/`；正文 sources 指向原始资料，不指向本记录。来源审计工具本身不证明 URL 联网可用或结论语义正确。

## 独立审查与修订

审查者均与作者分离，实际读取正文、图源、相关原始资料，并查看生成 PNG；没有操作被拦截的浏览器。

| 审查范围 | 问题 | 修订与状态 |
| --- | --- | --- |
| 原有图：review_inference_figures_v3 | P1：SWA 图前未解释；P2：恢复图分支文本交叠；P3：圆点/方点、设置/设备、正文误称图有 D 标签 | 就地定义、四个回答框、统一称呼；复审全部关闭 |
| 模型/回放：review_model_replay_v1 | P1：首屏省算没有讲近似代价；P2：不存在的 sparse-mla 链接、旧 KV 未连到回放、箭头穿字、query/MoE/patch/CP 未解释；P3：Zero SWA Caching 别名缺演变边界 | 首图前说明近似及质量验证，算例和图同步；补依赖与解释，改实际链接；复审全部关闭 |
| DSpark/格式：review_dspark_formats_v1 | P2：把检查步骤画成缓存执行顺序、MX 数值格式说成唯一物理布局、未复用版本信息、缺主线挂靠；P3：虚构耗时称“教学测量” | 改为检查流程并说明实际 KV 依赖；区分表示与打包；补版本回链和主线；称教学耗时假设，复核关闭 |
| DSpark 末轮 | P2：箭头穿置信标签；新增解释把异种曲线一律说成低估成本 | 标签移到线右侧并看 PNG；明确仅在旧曲线低于当前实测时低估，作者按条件自查关闭 |
| Recipe 与入口：review_inference_figures_v3 | P2：把约束选择归入渲染；P3：四页 updated 仍是旧日期 | 改为转换时验证/选择、渲染时写 prompt；复核职责关闭；日期统一本轮 |

新增 DSpark 的实际接受例子另外经独立复核：A 验两个但只接受首个，B 首个即拒绝，在无提前停止条件下实际交付三个编号；它与 4.22 的期望不同，不自动意味着实现出错。图中函数标识的加载/状态分配关系最终改为中文动作，具体函数保留页末源码位置。

## 单页标准与学习路径

运行现有 `checkStandard` 测量 31 页：30 篇概念/特性页无失败、无跳过；阅读指南无失败，沿用仓库既有 source-sections、diagram-first 两项豁免。没有修改全站阈值或增加例外。脚本及完整输出在 runtime 的 `check-standard.ts`、`standard.json`。

字数口径为汉字数加拉丁单词数，教学正文截至源码区，全文含源码区。四个新页正文行内代码和证据角标均为零，首图前没有 calc，没有表/calc 相邻的密集块。

| 新页 | 正文/全文字数 | calc 数 | calc/千字 | 免责句比例 | 首图文件行 |
| --- | --- | --- | --- | --- | --- |
| 模型 | 2554 / 3056 | 2 | 0.78 | 2.78% | 37 |
| 回放 | 2177 / 2836 | 2 | 0.92 | 0% | 39 |
| DSpark | 2575 / 3252 | 3 | 1.17 | 0% | 39 |
| 低精度 | 2321 / 2966 | 2 | 0.86 | 1.75% | 39 |

首图前数字只用于模型名称或四位编码的直觉说明，不提前塞入设备部署账。真实不确定性继续留在近似条件、质量与支持边界；改为明确成立条件，没有为降低免责词计数删除限制。

学习指南把新阶段串成“模型与状态 → 窗口恢复 → 候选验证 → 低精度”。从业者可直接从窗口缺失、接受率高但慢、精度异常三种问题进入；Recipe 段落补齐请求转换、标记边界、流式结束和约束执行的排查位置。

四条 CLI 检索探针分别为“DeepSeek CED 状态布局”“SWA 窗口丢失 回放”“DSpark 接受率高但没有提速”“MXFP4 NVFP4 缩放误差”，对应新页均排第一。只代表这些带机制词的查询能够召回，不代表纯症状问答准确率或实际检索回答链路已验收。

## 工程检查与范围限制

Recipe 引用首次被来源白名单拒绝。本轮仅增加 `github.com/deepseek-ai/deepseek-recipe/blob/` 的生态来源规则，并同步 HANDBOOK；复用原有分类函数，不改变 evidence 含义或允许任意组织页面。新增测试先失败：Recipe 被分到 unlisted，15 项通过、1 项失败；补规则后与相关测试一起通过。伪域名、fork、其他仓库、issue/PR/discussions 仍不能借该规则成为一手来源。

已运行的本轮检查：

- `pnpm wiki:build`：162 页索引生成。
- `pnpm check:content`：11 个主题、162 篇正文完整且无重复。
- `pnpm wiki:diagrams --check`：312 张图与 spec 一致。两张时间线因刻度/事件标签较多保留提示，实际 PNG 无遮挡；其他既有提示未作为本轮已修复事项。
- `pnpm wiki:lint`：通过，14 条非阻塞提示。新增格式页引用的 OCP/NVIDIA 原始资料不在项目白名单，页面保持 I 级，未扩大域名范围来消除提示。
- 定向 Vitest：sources、lint、toc、schema、calc，5 文件 126 项通过。
- `pnpm exec biome check scripts/wiki/sources.ts scripts/wiki/sources.test.ts`：2 文件通过。
- `pnpm build`：TypeScript 与 Vite 生产构建通过，保留既有配置兼容和大 chunk 等提示。
- `pnpm wiki:audit`：162 页、4084 来源，3866 条本地行号有效；无无效 commit、缺文件或越界。218 URL 未由该命令联网验证、3519 raw 引用有待核提示。强制名单 104 页中 103 页通过；仍有此前存在的 `glm-5-3-flash-two-node.md` 正文角标失败，本轮未修改该页。

本轮共查看 25 张生成 PNG，包括原有 16 张、A/B 时间线和新增 8 张图，图片放在 runtime 的 `after/`。未完成的是桌面页面前两屏、calc 排版、跨页点击、目录检索和窄屏交互复验；浏览器 URL 策略拒绝后未换工具或绕过访问。Task 4 最后一项因此保持未勾选。

没有 NPU/GPU 压测、采样分布实验、模型质量评测或 Recipe 端到端运行。新页的 vLLM-Ascend 完整支持矩阵仍按各页注明的边界保留待核；固定 DeepInfer 的实现证据不扩展成其他框架支持承诺。待用户决定的内容取舍：无。下一步先补浏览器验收，再继续原 Task 5。
