# P5 写作记录（GPT-6 Astra，10-04）

对象：[ai-qos](../../../../wiki/concepts/ai-qos.md)。本轮是新页写作与写手自查，不充当独立审查结论。未启动服务，未访问 5193/8790，未截图；浏览器实际阅读与独立审查按共同要求交审查员。

## 范围与结构

- 先读共同要求、docs/wiki-writing-standard.md、TP/EP 样板前 150 行、wiki/AGENTS-GUIDE.md、HANDBOOK、calc 格式和静态分格图样板；本任务为文档写作，没有启用 Ponytail 或代码协作表达技能。
- 新页 id 使用官方 Ai_QoS 的 kebab-case `ai-qos`。写前以 PowerShell 文件通配查询 `wiki/concepts/*qos*`、`wiki/concepts/ai-qos*`，没有独立页面；`wiki/diagrams/ai-qos.yaml/.svg` 已存在，因此保留旧图，新建 `ai-qos-intuition` 与 `ai-qos-flow`，各含手写 YAML 与生成 SVG。
- 页面第 39 行问题式 H2、一句话定义，第 45 行第一张图围栏；第 51 行动机与代价，第 67 行等长时隙演算，第 84 行 GLM 双机场景，第 94 行常见误解，第 103 行起为对照源码，五个 H3 顺序完全按标准。
- 第一张图解释关键通信与状态预取分 VL 后仍共用出口；第二张图在源码区，分 apply/unset 两支，包含无效状态文件退出、端点操作、人工交换机操作，以及 A0→A4 主线位置。两图宽度均为 860 px，静态，无动画。
- 只新增本页、两套图和本记录。未修改其他写手页面、旧图、目录、src/、scripts/wiki/standard-pages.json、docs/plans/；未提交 git。并发期间看到的其他文件改动均未处理。
- 页面标记 `origin: direct`：依据当前 HANDBOOK 的直接撰写条目，不编造 raw 快照或 rawSources。

## 官方文档与源码核对

以下路径均位于本地 `tools/repos/vllm-ascend` 的指定 commit，通过 `git show <commit>:<path>` 带行号阅读；不是把当前工作树或线上 main 当作固定镜像。

| 版本及文件 | 核对行号 | 支撑结论 |
|---|---|---|
| db701c1f，docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md | 5–21、25–82 | 争用动机、VL 隔离、strict priority、构建、五键、AIV 不生效、A3 产品与最低软件条件 |
| db701c1f，tools/ai_qos.py | 10–53、131–175 | 状态文件位置、损坏状态提示、设备选择与退出分支 |
| 同上 | 178–267 | 首次基线捕获、缺项设备补采、重用基线的前提 |
| 同上 | 270–319 | unset 校验、按快照恢复、打印 undo 后删除状态文件、部分失败继续 |
| 同上 | 322–474 | 五类映射、共享 SDMA 源标签取 min、初始 VL 区分、端点写入、模式实际语义、最新命令覆盖保存 |
| db701c1f，tools/ai_qos/CMakeLists.txt | 1–61，尤其 44–54 | Python/pybind11/DSMI 依赖，两个逐字构建错误 |
| db701c1f，tools/ai_qos/ai_qos.cpp | 23–118，尤其 50–54 | 扩展读写与失败返回；Python 忽略写入返回码时不能只验退出码 |
| 2c59ff10、2ed6cbba，tools/ai_qos.py | 322–474，另对整文件 blob | v0.23 与 v0.26 和 GLM 固定快照的工具完全一致 |
| 2c59ff10、2ed6cbba，官方 Ai_QoS_introduction_en.md | 25–82 | 两版官方五键入口、默认值、硬件和驱动约束相同；少量英文措辞变化不写成行为变化 |
| baa023ad，tools/ai_qos.py | 322–473，尤其 326–330、369–395、433–473 | 三键、三等级、固定类别标签与 VL、cacheable/noncacheable 双映射、默认 SDMA low |
| baa023ad，官方 Ai_QoS_introduction_en.md | 25–86 | 模块入口、三键以及 AIV 限制仍存在 |
| 0576b647，docs/source/tutorials/models/GLM5.3-Flash.md | 116–148、237–342 | A2 容器及双机启动脚本；未调用 AI QoS，特权容器/AIV 通信选项不等于已配置 QoS |

补充核查：`git rev-parse 2c59ff10:tools/ai_qos.py 2ed6cbba:tools/ai_qos.py db701c1f:tools/ai_qos.py` 返回三次相同 blob `8c5d52b2ca0470c02edd6065bb21941befbd1e60`。`git grep -n -i 'ai.qos' db701c1f -- vllm_ascend docs/source/tutorials/models/GLM5.3-Flash.md` 无匹配（grep 退出 1 表示未命中），支持未见运行时自动调用；不据此宣称已读取现场机器的历史配置。

联网检查：GitHub raw 的钉住 main URL 返回 Cache miss，未声称该链接已验证可读。网页工具取得[官方 v0.27.1rc1 指南](https://docs.vllm.ai/projects/ascend/en/v0.27.1rc1/user_guide/feature_guide/Ai_QoS_introduction_en.html)正文，与三键入口、AIV 限制相符；页面只把它列作官方阅读入口，版本证据仍用本地钉住文件。未用搜索结果的抓取日期替换源码快照日期。

## 站内信息清单与后续回链

搜索词覆盖 `AI QoS / Ai_QoS / ai_qos / Virtual Lane / MASTER_ID_SDMA / aiqos_table / qos remap / 严格优先级 / 虚拟通道 VL`；范围 `wiki/concepts`，排除新页。命中集中在下面两页。行号为本轮阅读时实际行号，主会话处理前应重查并发改动。

| 现有位置 | 已有信息 | 本页接续及建议（本轮不改别页） |
|---|---|---|
| cann-hccl.md:5 | summary 提及 AI QoS | 可保留摘要定位，正文转入本页 |
| cann-hccl.md:7–8 | AI QoS、AI QoS Feature、ai_qos、流量 QoS、虚拟通道 VL、Virtual Lane、严格优先级调度、tools/ai_qos.py 等别名 | 建议主会话将属于本特性的别名迁到本页并从旧页移除。不能同时保留，lint 会报 dup-alias。本页暂用独有别名，标题与 id 仍直接含 AI QoS |
| cann-hccl.md:17–22、26–28、31–33 | 指南与工具 sources | 教学内容迁为短结论加链接后，可随需要去除不再承载结论的来源；保留普通 HCCL 的来源 |
| cann-hccl.md:116–122 | 争用、VL、严格优先级、UB/SP 歧义、A3 范围 | 建议保留该 H2 锚点与一段总览，链接本页首节及 GLM 场景，不破坏既有锚点 |
| cann-hccl.md:130 | 提高优先级不是增加带宽，脚本未代配交换机 | 可留一句误解，附本页对应说明 |
| cann-hccl.md:144–154 | 构建、最低版本、五类通道、默认值、AIV 限制 | 改为本页“怎么开”的链接，参数表在本页单点维护 |
| cann-hccl.md:156 | 默认 SDMA 源标签 2、目标 VL 2/3 与优先级 3/1 | 结论回链本页，min 算式与映射推导只在本页维护 |
| cann-hccl.md:158、164 | 首次快照、进程生命周期、unset 和失败 | 建议链接本页恢复与报错段；本页补清采集失败、缺项补采、只存最新命令、未核写入返回码及过早删除快照的边界 |
| cann-hccl.md:172 | 争用时使用、低优先级代价、A2 不套用、无争用不推收益 | 留一句范围提示并链接本页“开销和什么时候别开” |
| cann-hccl.md:181–188、193 | 三版五键→三键、等级、映射、恢复、固定快照相同 | AI QoS 版本表集中到本页；普通 HCCL 初始化版本项仍留原页 |
| cann-hccl.md:191 | main 的 KV 传输 qos_priority 与本特性不同 | 保留 KV 传输本身的专有事实，给 AI QoS 加本页链接；新页只作简短区分并链 PD 分离，不复制其环境变量与默认值推导 |
| cann-hccl.md:201–204 | AI QoS 来源索引 | 随上面教学正文归属调整，不机械搬迁其他 HCCL 证据 |
| ai-core.md:89 | Unified Buffer 与 Unified Bus 区分，链接旧 CANN/HCCL 小节 | 可将流量 QoS 解释的链接改指本页首节，片上缓冲正文保留 |

新页覆盖勾选：机制与两种代价 ✓；五类流量与模式语义 ✓；旧 SDMA 默认映射 ✓；A3/AIV/驱动限制 ✓；构建与设备范围 ✓；端点/交换机执行分离 ✓；恢复及失败边界 ✓；三版默认、参数和映射差异 ✓；GLM 不启用及迁到受支持环境的条件 ✓；与请求调度和 KV 传输参数区分 ✓。未删除或覆盖现有页面信息。

## 验证与统计

- 实际命令用 Windows 的 `pnpm.cmd`，因为 PowerShell 的 pnpm.ps1 受本机执行策略限制；没有更改执行策略。
- `pnpm.cmd wiki:lint`：最终退出 **0**，本页 0 错误；全站另有 4 个既有 C 级证据比例提醒，涉及其他页。本页别名冲突已通过只调整新页解决。期间其他页面短暂重复 origin 键的错误已由并发工作消失，本轮未代改。
- `pnpm.cmd wiki:diagrams --check`：最终退出 **0**，**298 张图与 spec 一致**。本页两图无溢出或碰撞错误；源码流程图的函数名有非阻塞提示，它们位于“对照源码”且具备 pins，符合实现图约定。SVG 只针对本页两个 id 调用仓库 renderDiagram 生成，没有全库重写。
- `pnpm.cmd wiki:audit`：最终退出 **0**，本轮快照审计 **143 页、3759 条来源**，无效 commit、缺文件、越界行号、未知仓库均 **0**；本页 15 条本地来源范围通过，1 条官方 URL 由上面的联网阅读补核。全站 100 个强制名单页达标。
- 本页不在 scripts/wiki/standard-pages.json 中，另在内存临时以 `pages: ['ai-qos'], skip: {}` 调用既有 auditStandard，**problems=[]**，没有改名单文件。
- `pnpm.cmd check:content`：退出 **0**，输出 registry 139 页；这是已有索引校验，不宣称已更新索引或目录。本轮按范围要求不运行会写 src/ 的 wiki:build。
- 字数沿标准工具口径：汉字数 + 拉丁单词数，去围栏与链接目标。教学正文 **1879 字**；含“对照源码”的全文 **4834 字**。audit 的 **10195** 是原始 Markdown 正文字符数，不能混称教学字数。summary **80 字符**。
- 教学正文：行内代码 **0**、证据角标 **0**；1 个 calc，**0.532/千字**；条件/免责词命中 **1/54 句＝1.85%**，保留真实适用条件。第一图前无部署数字、无 calc；每节最多 1 个 calc，表/calc 无堆叠。全页共 2 个 calc、18 个证据标记，其中 C 10、S 6、A/D 各 1；C 即使仅按 C/S 计也为 **62.5%**。
- 页面和源码按实际内容逐项自查，未发现本页未处理的 P1/P2；这不代替独立审查或设备实测。

## toc 建议、取舍与待核

- toc 建议：在 **Ascend 硬件与软件栈 → 软件栈与互连** 中紧接 `cann-hccl`，只出现一次；分布式通信和 KV 换出页通过关系/链接引入。未修改 src/content/wiki/toc.ts。
- 取舍：旧页面和原有 1000 px 宽的 ai-qos 旧图均未改，新页引用两张新的 860 px 图；跨页去重、别名迁移和旧图清理由主会话另行安排。
- 待核：受支持 A3 设备与交换机读回、争用 trace、整体与低优先级时延/吞吐、固定 A2 主线的历史 QoS 状态；页面末尾明确列出，未虚构收益。
- 待审查员完成：浏览器实际阅读首两屏、图与表、链接操作及独立语义审查。写手未执行这些步骤，按共同要求不启动服务或截图。
- 需用户决定的 Open Questions：无；回链、别名及 toc 属主会话既定编排工作。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。对象：`wiki/concepts/ai-qos.md`（新页，未入名单）。

**分数：8 / 10。P1 0 条，P2 5 条，P3 2 条。学习顺序通过；按名单口径自测写作标准全 ✓。**

### 初学者测试（只读前两屏）

我的一句话：同一条共享链路上，计算正在等的卡间通信和后台的 KV 搬运会互相挤；AI QoS 把它们分进不同的 Virtual Lane，让交换机在拥塞时先服务高优先级那条队列，代价是被降级的那类流量要多等，而且它只改服务次序，不增加带宽。——前两屏能讲出来，通过。

### 骨架与学习顺序

- 问题式 H2 ×5 + 对照源码；一句话定义在第 41 行；直觉图围栏第 45 行（第一屏实测可见）；为什么/代价 51–65；示意演算 67–82（4 个等长时隙，4−1=3、4−3=1，手算无误，并自己声明时隙是教学假设、未证明可抢占）；GLM 双机 84–92；误解 94–101；对照源码五个 H3 顺序正确（105/172/197/205/223）。
- 通用理解节都排在 GLM 之前，GLM 之后只有误解与源码；教学正文无部署数字、无 GLM 数字误用。学习顺序**通过**。
- GLM 未启用的论证：官方双机脚本未调用（我复核 `git grep -i 'ai_qos|ai qos' db701c1f -- vllm_ascend docs/.../GLM5.3-Flash.md` 无命中），且指南只声明 Atlas 800T A3 / Atlas 900 A3 SuperPoD，而主线是 A2 ——两条理由都成立，没有写成「因此没必要」之类的推断定论；第 92 行讲「迁到受支持 A3 会怎样」时也点明 AIV 通道设置当前不生效，没有许诺收益。

### 核心概念与数字逐条核对（全部 ✓）

| 页面说法 | 核对 |
| --- | --- |
| VL 隔离 + strict priority，高优先级空了低优先级才走（41、49） | db701c1f 指南 15–21 行 ✓ |
| 固定版本 5 类流量及其举例（53、页末表） | 指南 55 行参数表的 Typical traffic types 逐条对应 ✓ |
| 默认 high/high/high/low/high；PCIEDMA_H2D 只有 high/low | `tools/ai_qos.py:453–457` argparse 默认值与 choices 完全一致 ✓ |
| 表项四元组是「源 QoS 标签、重映射后 QoS、目标 VL、严格优先级」；默认 SDMA_D2D (6,5,2,3)、SDMA_H2D (2,0,3,1) | `ai_qos.py:322–331` aiqos_table + `359–364` attributes 顺序 ✓ |
| 共享 SDMA 端点标签取 min，min(6,2)=2 | `ai_qos.py:366–367` ✓ |
| mode 被保存但不切换计算分支 | `ai_qos.py:320–324、359–367`（两种模式同一张表）✓ |
| 设备枚举：取 `ASCEND_RT_VISIBLE_DEVICES`，否则 `torch.npu.device_count()` | `ai_qos.py:131–175` ✓ |
| unset 打印 undo 之后才删除状态文件 | `ai_qos.py:310–319` unlink 在 `_print_config_block` 之后 ✓（「删除发生在操作者执行交换机恢复之前」属实，是个有价值的边界） |
| 状态文件解析失败的整段提示逐字 | `ai_qos.py:31–36` 常量拼接后逐字一致 ✓ |
| 报错表 8 条原文 + 行号 | `git grep -F` 于 db701c1f 全部命中；144–146、407–413、284–292、301–309、CMakeLists 44–48/50–54、ai_qos.cpp:50–54 行号均落在所标区间 ✓（CMake 两条是源码里跨行拼接，页面合成一行并保持原词，可接受） |
| 三版工具同一 blob；main 改三键 | `git rev-parse` 三个提交的 `tools/ai_qos.py` 均 8c5d52b2…，main 为 b066b01f… ✓ |
| main：AIV→标签 4/VL 2、PCIEDMA→5/VL 3、SDMA→6/VL 4，等级只改 1/2/3；默认 high/low/high；PCIEDMA 新增 middle | baa023ad `ai_qos.py:324–328、446–449` ✓ |
| main cacheable/noncacheable 是缓存属性命名，不是「有无 KV cache」 | baa023ad 源码命名核对 ✓ |

版本口径：v0.23=2c59ff10（标为维护分支）、db701c1f 单列为 orphan、v0.26=2ed6cbba、main=baa023ad，表头与正文一致，正确。页面没有拿 GLM 主线吞吐/时延当本特性效果，待核项（争用 trace、时延/吞吐实测、A3 设备读回）写在页末。

### 信息清单与分工

- 新页无旧版。写手列的站内清单我复核了关键两处：`cann-hccl.md:116–122、130`（AI QoS 小节与一条误解）确实存在且内容与新页重叠；`ai-core.md:89` 的链接指向 cann-hccl 的 AI QoS 锚点。清单属实，没有发现漏项。
- 抽 6 条勾选到页面确认：5 类流量与模式语义（53、145）、旧 SDMA 默认映射（149–155）、A3/AIV/驱动限制（92、107 附近）、端点与交换机分离（99、160）、恢复与失败边界（170、187）、三版差异（205–221）——均在页上。
- frontmatter：`origin: direct`、无 rawSources（grep 计数 0）✓。chapters 07/09 与内容相符。

### P2

1. **教学正文缺「怎么做」这一段**。正文只演了排队次序（时隙 calc），而「流量怎么被分类 → 端点打什么标签 → 交换机按标签映射到哪条 VL、哪个优先级」这条链条整段在「对照源码」里（145–160）。初学者读完前五节仍说不出配置到底改了什么。改法：在时隙演算之后补一小段，用 2 类流量的示意标签走一遍「打标签 → 映射 VL → 定优先级」，页末表仍留完整参数，不重复。
2. **第一屏直觉图只有方框和箭头，看不到数据怎么排队**。正文 calc 的例子是「队里已有 3 份状态 + 1 份关键通信」，图上没有这 4 份数据，读者看不到「谁先出口」。改法：在低/高优先级 VL 两格里画出数据块（3 块与 1 块），出口处按服务次序标 1、2、3、4，和 calc 用同一个例子。
3. **别名归属还在旧页**。`cann-hccl.md:6` 仍持有 AI QoS、AI QoS Feature、ai_qos、Virtual Lane、严格优先级调度、MASTER_ID_SDMA、aiqos_table、tools/ai_qos.py；站内搜「AI QoS」落到 cann-hccl，新页只能用变体别名（dup-alias 限制）。写手按规矩没改别页。待主会话迁移，迁移后重跑 lint。
4. **跨页重复讲**。cann-hccl 116–122（VL、SP、UB/SP 歧义、A3 范围）与 130（优先级不等于带宽、脚本未代配交换机）和新页 41–49、99 基本同义。按「讲过的应一句话 + 链接」，旧页该节应收缩为一句话 + 链接本页。
5. **入链为 0、toc 未登记**。全库没有页面链到 `ai-qos`；`ai-core.md:89` 仍指 cann-hccl 的 AI QoS 锚点；`src/content/wiki/toc.ts` 无本页。新页目前只能靠直接 URL 到达。写手给的 toc 位置（软件栈与互连，紧接 cann-hccl）合理，待主会话落地。

### P3

1. 第 53 行一次把 AIV / SDMA / PCIe DMA 与 D2D / H2D 五类缩写全抛出来，对初学者偏密。可只先立「计算急需的通信」与「后台搬运」两类，五类细表页末已有。
2. 第 65 行才解释 token，位置偏晚且与本节主题关系不大；该句真正要说的是「网络按通道和标签区分，不认请求、不认用户」，可把 token 定义去掉或前移。

### 验证记录

- `pnpm wiki:audit`：退出码 0；本页 16 条来源，15 条本地 ✓，1 条官方 URL（·）；全站无效 commit / 缺文件 / 越界 / 未知仓库均 0。
- 名单口径自测（只读脚本，内存里加入名单，未改 standard-pages.json）：`1879 字 · ✓行内代码 0.0/千字 · ✓角标 0 · ✓对照源码 · ✓calc 0.53/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 1.9% · ✓图宽`，problems 0。
- `pnpm wiki:lint`：退出码 0，本页无报错（跨页锚点硬校验通过）。
- 浏览器（Playwright，1440 宽，只读访问 5193，未起停服务）：第一屏标题 + 定义 + 直觉图可见，pageerror 0；两图宽 860 px，未见文字被连线压住；截图 `scratchpad/ai-qos-review-first.png`、`ai-qos-review-ai-qos-intuition.png`、`ai-qos-review-zoom1.png`（会话 1237c9d2 的 scratchpad）。
- 跳过 / 未完成：一次读「怎么开」第 105–140 行的输出被安全分类器拦下（内容此前已读到，未再重读）；按纪律跳过 sources 区、命令围栏与「源码位置」正文（只用 grep 核标题与行号）。

## 修订记录（10-04）

本轮修复 P2 4 条、P3 2 条，共 6 条；P2-5（入链与 toc）按用户明确分工留给主会话，不修改。没有判为不成立的审查意见。netloader 页及其检查完成后才开始本页。

| 审查项 | 修订结果与证据 |
| --- | --- |
| P2-1 缺少怎么做 | 在时隙算例之后新增「数据怎样进入对应的队列？」（`ai-qos.md:84–92`），沿两类 SDMA 流量讲端点标签 → 用标签和初始 VL 匹配 → 目标 VL → 服务优先级。采用钉住版本真实默认映射，不另造设备收益：共享标签 2，初始 VL 0/1，目标 VL 2/3，优先级 3/1。核读 db701c1f `tools/ai_qos.py:322–331、359–400`；完整四元组、min 推导及五键参数仍在源码区。 |
| P2-2 首图没有排队数据 | `ai-qos-intuition.yaml` 改为高优先级队列 1 块关键通信、低优先级队列 3 块状态甲/乙/丙，出口按 1 通信、2 状态甲、3 状态乙、4 状态丙排列；图注和 calc 共用同一等长时隙假设。两股流量的连线绕过队列标签，分区标题缩短以避开跨区竖线；保持 860×590、静态、无真实时延数字。 |
| P2-3 别名仍属旧页 | 从 `cann-hccl.md` aliases 迁移 12 项到 `ai-qos.md:6`，包括 AI QoS、AI QoS Feature、ai_qos、Virtual Lane、严格优先级调度、MASTER_ID_SDMA、aiqos_table、tools/ai_qos.py 等。保留全部原别名，没有让检索词消失。 |
| P2-4 跨页重复 | 按本轮用户限定「cann-hccl 只改别名」在新页侧去重：首图后将 VL/SP 原理、带宽区别、UB/SP 歧义和支持范围压成一句并链接旧页 AI QoS 小节；删除误解列表中重复的交换机执行说明和 UB/SP 辨义，在怎么做段用一句链接旧页配置说明。源码区仍保留可操作配置及失败边界。审查建议的「改旧页正文」不直接执行，原因是本轮明确范围限制，而非否认重复问题。 |
| P2-5 入链与 toc | 不修改；用户指定主会话统一做。建议入口见下文。 |
| P3-1 缩写密集 | 动机段先只讲「计算急需的通信」「后台状态搬运」，保留官方 5 类这一真实分类数并链接源码区；AIV、DMA、D2D、H2D、算子下发解释集中到五键参数表前。 |
| P3-2 token 定义打断主题 | 移除相邻机制表后的 token 教学，改成网络按通道和标签分类、不识别请求或用户；token 解释移到 GLM 段首次实际使用处。 |

信息保留复核：排队算例、关键/低优先级两侧代价、五类默认等级、AIV 不生效、auto/manual 同表、共享标签 min 推导、完整构建与执行入口、设备范围、首次快照与缺项补采、unset 先删快照及反复配置边界、八条报错、三版映射差异、A2 未启用和设备待核均保留。被压缩的 VL/带宽、术语辨义与交换机分工有明确原页链接，未改 cann-hccl 正文或 sources。

验证证据：

- `pnpm.cmd wiki:lint`：迁移别名及修订后退出 0，无重复别名或跨页锚点错误；另有 4 条既有非阻塞提示。
- `pnpm.cmd wiki:diagrams --check`：退出 0，299 张图与 spec 一致；日志 `tmp/ai-qos-revision-diagrams.log`。仅生成本页改过的 SVG。
- `pnpm.cmd wiki:audit`：退出 0，142 页、3827 条来源，无效 commit、缺文件、越界行号、未知仓库均 0；日志 `tmp/ai-qos-revision-audit.log`。包含 cann-hccl 的 29 条来源及名单写作标准检查。
- 对比修订前备份 `tmp/cann-hccl-before-ai-qos-alias-move.md`：去除 aliases 字段并统一换行后逐字符相等；12 个移出的别名全部存在于新页。断言输出 `cann-hccl: only aliases changed; 12 aliases moved`，退出 0，未覆盖其原有未提交改动。
- 直接调用 `checkStandard`：ai-qos 和 cann-hccl 均 `problems=[]`。本页教学正文 2058 字、行内代码 0、角标 0、1 个 calc（0.486/千字）、免责词命中 1/58（1.72%）；无相邻块、无超宽图。cann-hccl 教学正文 2778 字，标准检查通过。
- 首图围栏仍在本页第 45 行，图前数字算例/calc 均 0；两图均宽 860 px，源码区五个 H3 顺序保留。标准字数口径为去围栏及链接目标后的汉字数加英文单词数。

入链建议（交主会话，不在本轮改）：

1. `cann-hccl.md:114–120` 的 AI QoS 小节保留现有锚点，后续把概述压成一句并链接本页；届时可将本页基础概念的归属统一，避免形成来回解释。
2. `ai-core.md:89` 中解释 Unified Bus QoS 的链接可指向本页首节，片上 Unified Buffer 的讲解仍留原页。
3. toc 放在「Ascend 硬件与软件栈 → 软件栈与互连」，紧接 cann-hccl，登记一次。其他可选入链可来自逐层 KV 换出页的争用说明，由主会话核定。

按共同要求未起服务、未访问 5193/8790、未截图；本轮复核 spec/SVG 坐标，浏览器视觉复验交审查员，不把自动检查说成设备或视觉验收。外链未重新联网验证；A3 实机读回、争用 trace、性能及 A2 历史 QoS 状态仍在页末待核。需用户决定的问题：无。
