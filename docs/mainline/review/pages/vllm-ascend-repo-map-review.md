# 源码目录地图：写作与审查记录

## P5 写作记录（GPT-6 Astra，10-02）

### 修改与范围

- 按第 17 批的小修任务及队列拍板保留 model_loader、spec_decode 两个目录标签，在原图就地说明加载方式与草稿生成；sample 另行说明采样和验证。见页面第 66–67 行、图 YAML 第 24–25 行。
- 沿用原有五个主体小节和 900×560 职责图，不增加新图或数值推导。首节改为读者问题，解释 EngineCore、Executor、Worker、Runner，并挂靠 request-call-chain「七站逐站」现有锚点。
- 保留全部目录索引、GLM 阅读路径和运行时/启动边界；补足 token、块表、mHC、CustomOp 等术语的就地解释。
- 将原有 11 处来源角标移至末尾「对照源码」，保持编号对应；新增两条直接支持草稿生成和采样验证分工的来源。末节补全五个 H3 和版本定位表。
- 只写本页 Markdown、它的 YAML/SVG、本记录及 tmp/p5 下的清单和验证日志；未修改其他写手文件、共享配置、脚本或索引，未提交 git。

### 字数与写作自查

- 最终回复字数口径：去 frontmatter 的 Markdown 全文，换行统一为 LF，保留 Markdown 标记、链接和源码区；**2285 → 4181 字符**。原工作树使用 CRLF，原始 audit 曾打印 2337，最后打印 4206；这些差值包含换行表示，故交付采用统一 LF 口径。
- 写作检查器的教学正文计数：旧版 1133，新版 1254（新版不含「对照源码」）；教学区原始 Markdown 为 2366 字符。
- 首图围栏在页面第 39 行；图前部署数字 0、calc 0。图表达引擎→Worker/Runner→模型→后端与算子的主线，以及配置、通信、图执行的支持关系。
- 新版教学正文：行内代码 0/千字，证据角标 0，calc 0，相邻表/calc 问题 0，免责句检测 0%；源码区 H3 顺序正确，图宽 900。
- 全文来源角标 13 处，均在源码区。原有 C 级证据占比提醒仍在（100%）；本页是源码目录附录，未为凑比例虚增官方资料或把源码结论改标为推导。此项属于**仍未满足的风格比例要求**，不是已全标准达标的声明；交独立审查确认。写作检查器本轮未将此提醒视为阻塞错误。
- 自查未发现 P1 核心概念或信息丢失疑点。本记录不是独立审查结论；浏览器验收和独立审查由任务指定的后续审查员进行。

### 数字、版本与源码依据

本页无新增部署数字、形状或通信计算。按任务核对了底稿 01 §A0（启动与加载）、§A1（入口）、§A2（调度）、§A3（准备输入），02 §1（层型与模型前向），03 §A5（采样和草拟）；只取职责关系，不重算或复制主线账单。

实际读取的固定源码依据如下；路径除特别注明外均相对 vllm_ascend/，提交为 db701c1f：

| 结论 | 本轮读取依据 |
|---|---|
| 插件/加载器登记、平台配置 | __init__.py 38–77；platform.py 450–475 |
| 引擎调度、提交执行、处理结果 | **vllm@0fc695fc** 的 vllm/v1/engine/core.py 443–482 |
| Worker 入口、Runner 前向与采样交接 | worker/worker.py 599–622；worker/model_runner_v1.py 2287–2314、2373–2407 |
| 混合层选择，mHC/注意力/前馈连接 | models/glm5_next.py 2075–2105、2212–2235 |
| 通信初始化、按条件登记 CustomOp | worker/worker.py 975–988；utils.py 735–768 |
| ops 绑定后端，attention 定义后端类 | ops/indexer_kpool_mla.py 78–84；attention/indexer_kpool_mla_v1.py 521–545 |
| 草稿生成类与采样验证分支 | spec_decode/draft_proposer.py 1–16；worker/model_runner_v1.py 2585–2607 |

使用 `git -C tools/repos/vllm-ascend ls-tree --name-only <commit>:vllm_ascend/models` 核对：v0.23 维护分支 2c59ff10、v0.26 的 2ed6cbba 均无本页 GLM 模型实现；main baa023ad 为 glm5next 目录；专用提交 db701c1f 为 glm5_next.py。这与 Ascend 总览的版本表相符，不能把专用提交当成 v0.23 维护分支。源码外链仅抽查了 [vLLM core.py 的固定提交](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/v1/engine/core.py)，可访问；未逐个联网核验 Ascend 链接。

### 旧版信息清单勾选

动笔前以 `git show p4-checkpoint:wiki/concepts/vllm-ascend-repo-map.md` 建立 [25 项清单](../../../../tmp/p5/vllm-ascend-repo-map-facts.md)，并确认该页当时与工作树无 diff。逐项结果：

| 清单项 | 处理结果与新版位置 |
|---|---|
| 01 | 保留：首节的职责定位、目录大小边界和框架总览链接 |
| 02 | 保留：原图及图后启动/通信/图执行不是串行站点的说明 |
| 03、04 | 保留：「上游保留哪些职责」全部职责和 Ascend core 边界 |
| 05 | 保留：目录表前的相对路径和 csrc 根目录约定 |
| 06、07、08、09 | 保留：注册配置、worker、模型配置、attention/ops 四行 |
| 10、11、12 | 保留：distributed、compilation/xlite、patch 三行 |
| 13、14 | 保留并澄清：model_loader/quantization 与 spec_decode/sample 分工；图中同步说明 |
| 15、16、17 | 保留：两种卸载目录、设备相关目录、根 csrc 及 torch.ops |
| 18 | 保留：目录表后的跨目录、互斥实现边界 |
| 19、20 | 保留：「沿 GLM 执行路径」的 Worker/Runner、输入页、模型混合层和后端构造路径 |
| 21、22 | 保留：通信组、CustomOp 条件及独立启动路径 |
| 23、24 | 保留：迁入本页「对照源码→版本差异」，仍链接固定基线和阅读方法 |
| 25 | 保留：原 11 条 sources、两条图 pins、aliases、两条 relations；另增 sources 12、13 |

合计 25/25 保留；跨页迁移 0，删除 0。没有接管 DP 路由或 lm_head 两个其他页面。

### 实际验证

PowerShell 默认禁止执行 pnpm.ps1，改用现成的 pnpm.cmd；没有更改执行策略。每次页面保存后均运行 wiki:lint，日志保存于 tmp/p5/vllm-ascend-repo-map-lint-step*.log 及 lint-final.log。

| 检查 | 本轮结果 |
|---|---|
| `pnpm.cmd wiki:lint` | 本页 0 错误；最新全站退出 1，因为 concepts/npugraph-ex.md 链接不存在的 output-processor.md。本页另有上述 mark-flood 提醒 |
| `pnpm.cmd check:content` | 退出 0；registry 133 页通过；输出提示尚无章节，Term 引用检查跳过 |
| `pnpm.cmd wiki:diagrams --check` | 本页 0 错误；全站退出 1，op-to-ai-core-intuition.yaml 与 op-to-ai-core.yaml 的 frames[0] 溢出画布 |
| `pnpm.cmd wiki:audit` | 最后退出 0；本页 13/13 来源 commit、文件与行号有效；全站 136 页，3307 条来源，本地引用检查通过 |
| 本页单独调用现有检查函数 | parsePage、figureProblems、auditDiagram 均 0 问题；13 条来源 auditPage 全部 ok；checkStandard 0 问题；渲染结果与本页 SVG 完全一致 |
| `git diff --check`（本页及图） | 通过；仅提示工作树 CRLF 后续 Git 归一化，不是空白错误 |

全站日志在 tmp/p5/vllm-ascend-repo-map-{lint,content,diagrams,audit}-final.log；单页证据在 tmp/p5/vllm-ascend-repo-map-scoped-check.json。其他写手在并行修改，因此不同阶段的全站错误不同；未改动其页面。SVG 通过仓库现有 loadDiagrams/renderDiagram 渲染器只生成本页文件，没有批量覆盖别人的产物。本页不在写作强制名单中，所以另行显式调用 checkStandard；未修改名单。

### 待核与跳过

- 遵照共用说明：未启动任何服务，未占用 5193/8790，未截图或执行浏览器验收；留给独立审查员。
- 这是源码导航小修，没有扩写通信原语、TP/DP/EP 机制图；未打开通信教学参考图库。
- 未进行 NPU 硬件运行、镜像内安装产物对照、全量 e2e、应用类型检查或构建；本次未改应用代码。页面保留实际安装包版本待核项。
- 未修改其他页面的检查错误；未进行 Git 提交。没有需要用户中途决定的问题。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。时间 10-02。基线 `git show p4-checkpoint:wiki/concepts/vllm-ascend-repo-map.md`，旧版信息清单 tmp/p5/vllm-ascend-repo-map-facts.md（存在，25 条）。

**分数：8 / 10。学习顺序通过；audit 本页通过；P1 0 条，P2 2 条，P3 5 条。**

### 初学者测试（只读前两屏）

一句话：这页是 vllm-ascend 源码的「职责地图」——把启动、调度、模型计算、状态管理、通信这几件事对应到具体目录，想查哪一步就先打开哪个目录；代价是目录名不等于完整调用链，真要追还得跨 vLLM 与 Ascend 两个仓库按构造和调用关系走。第一节给了定义、一个具体例子（调度怎样变成模型输入 → worker 里的 Runner）、直觉图和代价说明，初学者读完能说清用途和边界。学习顺序为「是什么 → 两仓库怎么分工 → 目录索引怎么用 → 沿 GLM 走一遍 → 对照源码」，没有一上来就演算或堆 GLM 部署数字（本页按队列无新增数字，实测正文无部署数）。

### 核心概念核对（均对照钉住提交，逐条有行号）

- NPUWorker 在 `vllm_ascend/worker/worker.py:89`，NPUModelRunner 在 `worker/model_runner_v1.py:287`（db701c1f）——页面「Worker 接收什么、Runner 准备输入并驱动模型」成立。
- 上游 `vllm/v1/{engine,core,executor}` 均存在，`EngineCore` 在 vllm@0fc695fc `vllm/v1/engine/core.py:95`——「上游组织调度、提交执行、更新结果」成立。
- Ascend `core/` 下是 RecomputeScheduler（`core/recompute_scheduler.py:95`，继承上游 Scheduler）、调度/KV 规格适配等——页面「是部分调度与资源机制适配，既不等于整个 EngineCore，也不是没有运行时逻辑」判断正确，这一条写得很准。
- mHC：`models/glm5_next.py:2074` 起 `mhc`、`mhc_num_residual_streams`、`_expand_mhc_residual_streams`（:148）——「管理并混合多路残差」成立。
- ops 绑后端、attention 定义后端类：`ops/indexer_kpool_mla.py:78` 绑定 `AscendIndexerKPoolMLABackend`，该类定义在 `attention/indexer_kpool_mla_v1.py:521`——与页面及源码位置表所引 521–545 完全吻合。
- CustomOp：`utils.py` 中 `REGISTERED_ASCEND_OPS` 登记表（735 起）与 `CustomOp.register_oot`（:820）、310p 覆盖与 `vllm_version_is("0.23.0")` 条件（:806–818）——「登记 + 启用条件」成立（引用范围见 P3-2）。
- `patch/` 由 platform.py:186 与 worker/worker.py:108 的 `adapt_patch` 导入——表中「平台与 Worker 导入路径」成立。
- 目录表所列 12 行目录在 db701c1f 的 `vllm_ascend/` 下全部存在（含 _310p、device、device_allocator、kv_offload、simple_kv_offload、spec_decode、sample、model_loader、quantization、compilation、xlite、patch）及仓库根 `csrc/`；页面已声明不是完整清单，故未列 eplb/lora/model_executor/profiler 不算错。
- 版本口径：`git ls-tree` 核对 2c59ff10（v0.23 维护分支）、2ed6cbba（v0.26）均无 GLM 模型文件，baa023ad（main）为 `models/glm5next` 目录，db701c1f 为 `models/glm5_next.py`——与写作记录和总览版本表一致，没有把专用提交当成维护分支。

核心概念无错，P1 0 条。

### 丢信息检查

- `git diff` 本页：+70 / −23 行；frontmatter 的 sources 区只有新增（`@@ -20,0 +21,2 @@`），无删除，sources 11 → 13，frontmatter 键集合与旧版完全一致。
- 旧版 5 个 H2 中，「目录是职责的入口」改为问题式标题，「先确认正在读哪份代码」并入新增的「对照源码 / 版本差异」。抽查旧版信息清单 6 条以上：05 路径相对 `vllm_ascend/`、csrc 相对仓库根（在）；12 patch（在）；13 model_loader/quantization（在）；14 spec_decode/sample（在）；15 kv_offload/simple_kv_offload（在）；16 _310p/device/device_allocator（在）；17 根 csrc（在）；18「不是完整目录清单、职责跨目录」（在，正文 72 行）；23/24 的安装包/工作树/社区分支不自动等价、版本会迁移文件、行号只定位快照、以职责与符号追踪——关键词「安装/工作树/社区/行号/快照/迁移/符号/调用关系」在新版全部命中。清单勾选属实。
- 链接集合对照：旧版链接 0 条丢失，新增 4 条（request-call-chain 两个锚点、glm-5-3-flash、vllm-ascend-overview#版本差异），逐一验证目标文件存在、锚点标题存在（request-call-chain.md:173、:211；vllm-ascend-overview.md:142）。全库入链（learning-guide、reading-vllm-ascend、vllm-ascend-overview、index）均为无锚点页面链接，改标题未造成断链。

### 工具结果（本轮实际运行）

- `pnpm wiki:audit`：全站退出 1，但 2 处越界都在别人的页（concepts/api-server-entry.md、concepts/streaming-output.md）。**本页条目无 ✗，13/13 来源 commit、文件、行号有效**，角标 13 处全部位于「源码位置」表（对照源码之上零角标）。本页不在 scripts/wiki/standard-pages.json 强制名单内，审计只统计不报错。
- `pnpm wiki:lint`：全站 1 处阻塞错误在 concepts/npugraph-ex.md（非本页）；本页只有非阻塞的 mark-flood 提醒。
- `pnpm check:content`：退出 0。
- `pnpm wiki:diagrams --check`：281 张图与 spec 一致；本页图有 4 条非阻塞提醒（见 P3-3）。
- 图的浏览器验收：5193 未启动且本轮不允许起停服务，改用仓库已装的 Playwright/Chromium 以 1440 宽离线渲染本页 SVG 截图，存 scratchpad\vllm-ascend-repo-map-review-figure.png。未做整页阅读视图截图（见「跳过」）。

### P2（本轮应处理）

1. **图上两条新标签渲染时连成一行**。wiki/diagrams/vllm-ascend-repo-map.yaml:24–25 用 4 个空格分隔两个条目，但生成的 SVG（wiki/diagrams/vllm-ascend-repo-map.svg:35–36）没有 `xml:space="preserve"`，浏览器把连续空格塌缩成一个。截图里读到的是「model_loader/：选择权重加载方式 quantization/：解释精度与布局」，两件事黏成一句，拍板要的「就地解释」效果打了折扣。改法：用本图已有的分隔风格「·」（同图中「attention/ · ops/」），或拆成两条 text 分行排，不要靠多个空格。
2. **「索引压缩注意力」是全站孤例叫法**。正文第 78 行用这个中文名指 GLM 的稀疏注意力，而站内已定名并解释过的是 DSA（DeepSeek Sparse Attention）与 lightning indexer（见 wiki/concepts/sparse-attention.md:47）。既违反「有固定英文名的术语用英文原名」，也破坏单一真相源，且本页用了没解释。改法：改为 DSA（lightning indexer）并链接 sparse-attention.md，描述保持「ops/ 里包装注意力层并绑定后端，后端类在 attention/」不变。

### P3（可留到后续）

1. lint 的 mark-flood 提醒（本页 100% 标记为 [C]）仍在，非阻塞；写作记录已自述，属源码附录页的证据等级现状。
2. 「源码位置」表把「按条件登记 CustomOp」定位到 utils.py 735–768，该段只是 `REGISTERED_ASCEND_OPS` 登记表；310p 覆盖、`vllm_version_is("0.23.0")` 条件与 `CustomOp.register_oot` 在 806–820。建议把范围延到 820，或拆成「登记表 / 条件与注册」两行。
3. `wiki:diagrams --check` 对本页新增 4 条非阻塞提醒（texts[0]、texts[1]「是一整句」；代码名 model_loader、spec_decode）。代码名已由第 17 批拍板允许，但写作记录只写「本页 0 错误」，未如实列出这些提醒。
4. 全页没有独立的「常见误解」节，误解散在各节末尾（目录大小不代表重要性、不是完整目录清单、不能把目录名当完整调用链、启动与运行时要分开）。本页不在写作强制名单内可接受，后续若收编进名单需单列一节。
5. 「为什么需要这张地图」只在第一节最后一句（缩小阅读范围 / 代价）带过，没有独立的第二屏。对导航附录页可接受，若扩写可单独成段。

### 跳过与未验证

- 本轮有一次输出被安全分类器拦下（发生在读完正文 32–61 行之后的那条消息），之后改为不整段打印正文的核对方式继续；正文 32–83 行最终全部读到，「对照源码」正文按纪律只用 grep 核对（五个 H3 齐全且顺序正确；版本差异含 v0.23、v0.26、main 及 2c59ff10 / db701c1f / 2ed6cbba / baa023ad / 0fc695fc），其正文未逐句读。
- frontmatter 的 sources 区按纪律跳过，只统计条数与键集合，未逐条读来源内容；URL 未联网核验。
- 未起 5193/8790 服务，未做整页阅读视图截图；只离线渲染并检查了本页的图。
- 未开任何子代理，未修改页面、图、脚本。

## P5 修订记录（GPT-6 Astra）

2026-10-02。按末尾 P5 审查的 7 条逐项处理：修订 6 条；P3-1 保留真实证据等级并记录理由。P1 原审查为 0 条，本轮自查未发现新增 P1。仅修改本页、对应 YAML/SVG 与本记录；验证日志及修订前快照放在 tmp/p5/。未重做旧版信息清单，未修改其他页面、共享脚本或强制检查名单，未提交 Git。

### 逐条对应

| 审查项 | 处理与证据 |
|---|---|
| P2-1 图中文字依赖连续空格分隔 | 已修。wiki/diagrams/vllm-ascend-repo-map.yaml:24–28 将两个长文本拆成五个独立 text，以两列、三行坐标排布；每个目录都有紧邻的用途说明。SVG 使用现有渲染器仅重生成本图，不再依赖空格保留。figureProblems 返回空，SVG 与 spec 完全一致。 |
| P2-2 非标准术语「索引压缩注意力」 | 已修。wiki/concepts/vllm-ascend-repo-map.md:84 改为 DSA 与 lightning indexer，并就地说明先挑历史再做注意力计算，链接 sparse-attention.md「候选位置从哪里来」承接 GLM 的具体差异；保留 ops 包装并绑定后端、attention 定义后端类的职责关系。依据站内 sparse-attention.md:47、131，以及 db701c1f 的 ops/indexer_kpool_mla.py:78–84。 |
| P3-1 C 级角标占比 100% | 不改等级与来源。提醒事实成立，但不据此认定源码证据标错：本页 13 条来源全部是钉住提交的代码位置，13 个 C 角标均在末尾源码位置表，教学正文角标为 0。wiki/AGENTS-GUIDE.md「怎么读一页」将 C 定义为源码证据；写作标准同时禁止为凑比例虚增来源。改标为 S、删掉结论与来源的对应关系，或补无关材料只会损害可核查性。因此明确保留 1 条非阻塞 mark-flood 提醒，未声称符合 C 占比 <80% 的要求。 |
| P3-2 CustomOp 来源未覆盖条件与注册 | 已修。frontmatter 第 7 条来源与源码位置表同步扩展为 utils.py:735–820，角标仍为 C7。实际读取 db701c1f 源码确认：783 行进入 310P 分支，799–812 行覆盖登记表，814–817 行按 vLLM 版本覆盖 FusedMoE，819–820 行遍历登记表并调用 CustomOp.register_oot。audit 确认新范围有效。 |
| P3-3 未披露图的非阻塞提醒 | 已修。拆分标签后，「整句」提醒 2 条已消除；剩余代码名提醒恰为 model_loader、spec_decode 共 2 条。docs/plans/2026-09-28-p5-batches.md「拍板结果」第 2 条明确允许这两个目录标签并要求就地解释，故保留标签和说明，在此完整披露提醒。没有修改或屏蔽检查规则。 |
| P3-4 缺独立常见误解节 | 已修。页面第 90 行新增「常见误解」，集中解释目录大小与重要程度、索引与完整目录清单、目录与调用链、启动注册与运行时计算四个区别；原先散落的对应句迁入此节，互斥实现与跨目录边界仍保留。 |
| P3-5 动机与代价只有一句 | 已修。页面第 45 行新增「为什么需要这张地图，阅读的代价在哪？」，沿开篇输入准备的例子说明从 worker/ 选入口为何能缩小范围，以及后续仍需跨文件、跨仓库追调用的代价；保留原主线挂靠与框架总览链接。 |

### 依据、信息保留与写作自查

- 本轮没有新增部署数字、性能数字或数值推导，因此没有新增底稿取数；目录入口和版本口径沿用原页。DSA 术语先查本仓库定义，再对照钉住提交的后端绑定代码；CustomOp 补引直接核对本地 Git 对象的完整条件与注册段。
- 与本轮开始时快照比较，原链接丢失 0 条，来源仍为 13 条，仅 C7 延长行号范围；没有删除目录行、版本表、启动入口或安装包版本待核项。新增稀疏注意力链接已通过锚点校验。
- 字数以检查器口径区分：去 frontmatter、含源码区的 body.length 为 4206 → 4752（包含 Markdown 标记、空白与换行）；教学正文按汉字加拉丁单词、去围栏计数为 1254 → 1575。首图围栏在第 39 行，图前部署数字 0、calc 0；全页 calc 0；教学正文行内代码 0、证据角标 0、免责词命中 0/36 句。图宽保持 900px；源码区仍为最后一个 H2，五个 H3 顺序保持不变。
- 本页未进入强制写作名单，另行直接调用现有 checkStandard：0 问题；该结果不覆盖 C 角标占比限制，后者见 P3-1。没有通过删除边界条件降低统计值；互斥实现和表外目录改为明确的适用条件表述。

### 本轮实际验证

每次保存页面后均运行 wiki:lint。最后一次页面改动后，以下检查实际运行并全部退出 0：

| 命令 | 结果 |
|---|---|
| `pnpm.cmd wiki:lint` | 本页 0 报错，全站通过；本页保留 1 条 mark-flood 非阻塞提醒。 |
| `pnpm.cmd wiki:diagrams --check` | 本页 0 报错；全站 281 张图与 spec 一致。本图保留上述 2 条已获准的代码名提醒，无整句提醒。 |
| `pnpm.cmd wiki:audit` | 本页 0 报错，13/13 来源的 commit、文件与行号有效；全站本地引用及名单页写作标准通过。raw 摘录匹配与语义不属于该命令的通过范围。 |
| `pnpm.cmd check:content` | 退出 0，registry 133 页通过；工具注明尚无章节，Term 引用检查跳过。 |
| 现有单页检查函数 | parsePage、figureProblems、checkStandard 均为 0 问题；SVG 与 renderDiagram 输出完全一致；修订前链接集合全部保留。 |
| `git diff --check -- wiki/concepts/vllm-ascend-repo-map.md wiki/diagrams/vllm-ascend-repo-map.yaml wiki/diagrams/vllm-ascend-repo-map.svg` | 退出 0，仅有工作树换行归一化提示。 |

日志为 tmp/p5/vllm-ascend-repo-map-revision-{wiki-lint,wiki-diagrams,wiki-audit,check-content}.log；单页统计与结果为 tmp/p5/vllm-ascend-repo-map-revision-scoped-check.json。

### 限制与待核

- 按本轮共用说明，不起服务、不截图、不占 5193/8790；本轮未做浏览器阅读验收，图的实际观感留待审查员复验。程序检查验证了坐标布局、边界与 SVG/spec 一致性。
- 尝试联网打开钉住提交的 utils.py 与 ops/indexer_kpool_mla.py，工具均返回 Cache miss；未据此声称外链可访问。上述源码核对使用本地 Git 对象，不依赖联网结果。
- 运行环境安装包是否与代码快照一致仍待部署证据，未进行 NPU 实测；旧版信息清单按用户要求不重做。P3-1 的比例提醒与 P3-3 获准的代码名提醒明确保留，其余审查项已修订。需用户决定的问题：无。
