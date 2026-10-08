# ai-core 审查记录

## P5 写作记录（GPT-6 Astra，10-02）

本记录是写手自查与交接，不替代独立审查。任务按共用说明 v2 执行：不起服务、不截图，不触碰 5193 / 8790，不提交 Git。

### 修改与原因

- 重写 [ai-core 正文](../../../../wiki/concepts/ai-core.md#ai-core-怎样把矩阵乘变成设备上的计算)，按是什么、为什么、示意演算、架构差别、GLM 双机、误解、源码组织。旧页缺少主线站点和版本核对，现已链接 A4 第 4 站及已有唯一出处。
- 首图 [ai-core.yaml](../../../../wiki/diagrams/ai-core.yaml) 从 1000px 改为 860px：输入经 L1、L0A/B 进入 Cube，结果经 L0C、Fixpipe 写入 GM，再交给 AIV 的 UB 与 Vector；保留 Fixpipe 回 L1 的另一去向。图不推定产品核数或容量。
- 新增 [ai-core-execution.yaml](../../../../wiki/diagrams/ai-core-execution.yaml)，860px：A4 专家输入先判断是否已量化，再按源码选自定义融合、适配层融合或分开调用，汇合到 gmm2。代码图位于源码区，条件在邻近文字逐项解释。
- 原始来源和关系保留；补充流水优化官方资料、固定提交量化/专家入口与三个版本的线性层来源。所有证据角标集中至源码位置。

### 数字与核心概念证据

- GLM 软件流程取自 `docs/mainline/02-forward.md` §3.4（233–237 行）及 §6.6（699–711 行）。4096 → 2048 → 4096 是 §6.6 的专家输入、SwiGLU 后、输出宽度；本页只引用结论，完整形状和专家数链接 one-request，不重复推导。
- 原有 4 个 FP32 数、16 B 装入和 16 B 写回教学例保留；补 32 B 合计，明确为示意逻辑量。新增 [1,2] 乘两行权重 [1,−1] / [2,−2] 得 [5,−5]，ReLU 后 [5,0]，用于解释计算位置和数据交接，不是部署输入或硬件指令块大小。
- [CANN 8.0.RC2 基本架构](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html) 本轮联网读取并下载、查看原分离架构图（临时存于 `tmp/p5/ai-core-official.png`）。核实 Cube/Vector/Scalar 层级、AIC/AIV 各自 Scalar、经 GM 交接、矩阵结果 GM/L1 两种去向及 UB 的位置。
- [昇腾官方流水优化](https://www.hiascend.com/developer/techArticles/20240819-1) §02–03 本轮联网核对：队列协调 CopyIn/Compute/CopyOut，double buffer 的复用、空间和收益限制。未将官方示例性能作为 GLM 实测。
- `vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h:96–155`：逐行三段调用，局部张量、入队出队与流水屏障。
- `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py:61–125,353–365`：整数权重、尺度、动态量化、量化矩阵乘和加载后的转置/NZ 转换。
- `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py:42–43,78–85,115,130–222`：融合条件、输入约定、量化尺度复用、MC2 下 gmm1 分支和 gmm2。直接从钉住提交读取，不把工作树或 main 当作固定实现。
- 版本核对：`git diff 2c59ff10 db701c1f -- vllm_ascend/quantization/methods/w8a8_dynamic.py vllm_ascend/ops/fused_moe/moe_mlp.py` 无差异；维护分支 models 树没有 GLM 文件。v0.26 `2ed6cbba` 线性层 74–124 行仍有缺省 0 的 `_chunk_size` 分支；main `baa023ad` 路径迁到 `methods/w8a8/w8a8_dynamic.py`，93–123 行已无该拆分。没有把 AI Core 当成可开关的软件特性。

### 旧版清单核销

动笔前用 `git show p4-checkpoint:wiki/concepts/ai-core.md` 读旧正文，列入 `tmp/p5/ai-core-facts.md`。基线与开始时工作区一致。10/10 保留，无删除、无跨页搬迁：

| 编号 | 旧信息 | 新版位置（wiki/concepts/ai-core.md） |
|---|---|---|
| 01 | AI Core 层级，乘加与搬运均需要 | 32–42、61–77、99 行 |
| 02 | Cube/Vector/Scalar/MTE 分工，一层可能经过不同单元 | 36、93–95 行及两图 |
| 03 | 向量 GM/UB 往返路径 | 83 行与首图 |
| 04 | 矩阵完整路径，Fixpipe 可回 GM 或 L1 | 83 行与首图 |
| 05 | GM 定义，片上空间有限，分块处理 | 38、46 行 |
| 06 | 三段 kernel 及 FLOPs 不能独立预测耗时 | 59、77、145 行 |
| 07 | 4 个 FP32、读 16 B、写 16 B 与测量边界 | 50–59 行 |
| 08 | 耦合/分离、各自 Scalar、存储同步、核数比例边界 | 36、79–85 行与首图 |
| 09 | CANN 8.0.RC2，后续产品核数/面积/缓冲容量不能外推 | 81、123 行 |
| 10 | Unified Buffer/Unified Bus 区别，来源与导航 | 38、85 行及 frontmatter |

### 验证与统计

每次保存页面后运行 `pnpm.cmd wiki:lint`；使用 `.cmd` 是因为 PowerShell 禁止加载 pnpm.ps1，不修改执行策略。中间出现的本页关系枚举、双向关系及缺失 SVG 已即时修正。所有命令日志保存在 `tmp/p5/ai-core-*.log`。

| 检查 | 本轮最终结果 |
|---|---|
| `pnpm.cmd wiki:lint` | 本页 0 报错；全库退出 1，仅 npugraph-ex 指向不存在的 output-processor。其他页未修改 |
| `pnpm.cmd check:content` | 退出 0，registry 133 页；工具报告尚无章节，Term 引用检查跳过 |
| `pnpm.cmd wiki:diagrams --check` | 退出 0，280 张图与 spec 一致；本页两图无越界、重叠或 SVG 不一致 |
| `pnpm.cmd wiki:audit` | 本页 7 条源码均行号有效，2 条官方 URL 为 URL 类型；本页 0 报错。全库最后退出 1：api-server-entry 的 base.py 1018–1059 超过 1056 行，streaming-output 的 detokenizer.py 309–345 超过 344 行。均非本页，未修改 |
| 本页单独写作检查 | 直接调用现有 `checkStandard`，不改标准名单；8 类写作规则全部通过、无 skip |
| 本页单独图检查 | 两份 YAML 均通过 figure schema 和 `figureProblems`，两份 SVG 均与 `renderDiagram` 逐字一致 |
| `git diff --check`（仅本页和原图） | 无空白错误；Git 有原 YAML 行尾规范化提示 |

字数口径：排除 frontmatter、围栏块和 Markdown 链接目标，汉字按字、英文按单词计，包含标题。**全文（含源码区）554 → 3598；教学正文（源码区之前）554 → 2131**。工具 wiki:audit 的另一口径是 Markdown body 字符串长度，**1036 → 6753**，包含链接目标、围栏和标记，不能混用。

首图在文件 40 行，位于第一 H2；图前部署数字 0、calc 0。两图均 860px。教学正文行内代码 0/千字，calc 共 2 个、各在独立的实质小节，约 0.94/千字，无表/calc 相邻；正文角标 0。全文行内代码 24 处，约 6.67/千字；证据角标 9 处，C 类 7/9 = 77.8%。工具免责识别 1/67 句，约 1.49%。图检查有不阻塞的短语长度提示，及源码区代码图中 scale_bias 的代码名提示；不属于布局或一致性错误。

### 待核、取舍与交接

- 自查无 P1 疑点。定义及图中的数据路径已按官方文字与原图核对；源码分支已按固定提交核对。独立审查与浏览器逐屏验收留给审查员，未把本次自查冒充独立审查。
- 底稿 §6.6 简表未展开 `moe_mlp.py:156–165` 自定义融合分支；它在源码中受融合、动态专家负载均衡、自定义算子可用性等条件约束。本页已补作条件分支，不宣称固定部署实际启用，未改底稿。
- 底稿 §3.4 保留的稠密 MLP 实际 apply 子分支及融合组织待核继续保留。专家路径运行时命中情况、AIC/AIV 数量、流水重叠、事务量及吞吐时延均缺目标镜像 trace / 硬件实测，未虚构收益。
- 官方架构与流水资料联网可访问；audit 的 raw 快照缺口未补写，不能把行号有效当成自动验证了摘录语义。没有把所有 GitHub 外链逐一在线打开，本轮源码采用本地钉住 commit 的 blob 核对。
- 跳过服务、浏览器操作和截图（用户共用说明 v2 明确要求），跳过硬件实测（无目标设备）；未运行代码类型检查、应用构建或产品测试，本次只改文档与图。通信/TP/EP 参考图库不适用于本页核心机制，改用并实际查看 CANN 原始架构图。
- 未修改其他写手页面、scripts、src、tests、标准名单或计划；未提交。无需用户决定的新问题。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查，10-02。只审不改页面，未改任何文件（本节除外）。

### 结论

- **分数 8.5 / 10**。学习顺序通过；`pnpm wiki:audit` 本页通过；**P1 0 条、P2 2 条、P3 5 条**。
- 初学者一句话（只读前两屏写出）：AI Core 是 NPU 里真正做计算的那类核心，Cube 管矩阵乘、Vector 管逐项和归约、Scalar 管控制，数据得先从 GM 搬到片上缓冲才能算，所以代价不只是乘法次数，还有搬运、片上空间和阶段之间的等待。

### 已核对、判为无误的项

- **学习顺序**：32 行是什么（定义 + 乘加/激活的例子 + 图）→ 44 行为什么要有计算单元与片上缓冲 + 代价 → 61 行怎么算（手算）→ 79 行耦合/分离变体 → 87 行 GLM 双机 → 97 行常见误解 → 105 行对照源码。通用理解节全部在 GLM 节之前，符合基础标准第 13 条；第一节末尾没有堆链接（第 14 条）。
- **手算正确**：67–73 行 x=[1,2]、W 两行 [1,−1] / [2,−2]，得 [5,−5]，ReLU 后 [5,0]，逐项复算无误。52–57 行 4×4 B 读 + 4×4 B 写 = 32 B 亦无误。
- **数字对账（02 §3.4 / §6.6）**：93 行的隐藏宽度 4096、gmm1 后 SwiGLU 变 2048、gmm2 回 4096，与 `docs/mainline/02-forward.md:706-708` 的形状表逐项一致；每卡 18 个专家只给链接不重算，符合单一出处。全页无吞吐/时延实测数，与队列「无硬件吞吐实测值」一致。
- **源码核对（钉住提交 db701c1f）**：
  - `tools/repos/vllm-ascend` `w8a8_dynamic.py:82` `npu_dynamic_quant` → `:95/:103/:115` `npu_quant_matmul`，支持 109 行的稠密入口描述；`:89` `getattr(layer, "_chunk_size", 0)` 缺省 0，支持 127 行 v0.23 列的说法。
  - `moe_mlp.py:42-43` `_custom_gmm_swiglu_enabled = fusion and dynamic_eplb and enable_custom_op()`，与 140 行「融合已启用 + 动态专家负载均衡已启用 + 自定义算子可用」一致；`:115` `use_gmm_swiglu_quant_fusion = use_mxfp_quant or (fusion and not dynamic_eplb)`，与「启用融合且未启用动态专家负载均衡走 DeviceOperator」一致。
  - 对照源码五个 H3 齐全且顺序正确（107 / 111 / 115 / 121 / 132）；版本差异表同时出现 v0.23(2c59ff10)、GLM orphan commit db701c1f（128 行明确标注为独立 orphan commit，并点明配套 vLLM 0fc695fc）、v0.26(2ed6cbba)、main(baa023ad)，符合本批版本口径。
- **未启用 / 变体**：耦合架构（81 行）、double buffer（77 行）、动态专家负载均衡与两条融合分支（140 行）都写成条件/变体，并明说需运行配置与 trace 核实，没有把 GLM 主线数字当成这些特性的效果，也没有虚构部署实测数。本批验收点「scheduler 预算 6、上限 2」在本页不适用（全页无 scheduler 内容）。
- **丢信息**：`git diff p4-checkpoint -- wiki/concepts/ai-core.md` 的删除行逐条追踪，旧版两条典型路径表（旧 37–40）落到新版 83 行散文，旧 25/27/42/44/48/50 行内容分别落到新版 34/36/38、46、50–59、77、81–85 行；aliases 从 9 项扩到 11 项，无删除。写手清单 `tmp/p5/ai-core-facts.md` 存在，抽查第 01、02、03、04、05、07、09、10 共 8 条，勾选属实。
- **链接与锚点**：`pnpm wiki:lint` 本页 0 报错（全库 1 处失败是 npugraph-ex 指向不存在的 output-processor，非本页）；全库 grep `ai-core.md#` 无外部入链指向本页标题，改标题不破坏跨页锚点。
- **写作规则**：正文（31–104 行）无证据角标、无表格、无行内代码；两个 calc 分属不同小节，无表/calc 相邻。
- **图**：首图 `wiki/diagrams/ai-core.yaml` 与官方分离架构图（`tmp/p5/ai-core-official.png`，已看图核对）结构一致：GM 在左，AIC 侧 L1 → L0A/B → Cube → L0C → Fixpipe，AIV 侧 UB ↔ Vector，两侧经 GM 交接；caption 声明框数不代表核数或容量，与官方图上的「1 : N」不冲突。

### P1

无。

### P2

1. **第一屏缩写密度过高**（`wiki/concepts/ai-core.md:36,38`）。读者刚看完一句定义，36、38 两行一次性抛出 Cube / Vector / Scalar / MTE / AIC / AIV / GM / L1 / L0A / L0B / L0C / UB / Fixpipe 共 13 个名词，而「为什么需要片上缓冲」要到 46 行才讲。对「只懂矩阵乘」的读者，这是先背缩写再建直觉，顺序反了。**改法**：38 行只留 GM 与「片上缓冲」两层，把 L1 / L0A/B / L0C / UB 各自干什么挪到第 3 节（61–65 行）随数据流经过时逐个点名，图在 40 行照旧。
2. **图文不对应：正文点名 MTE，图里没有 MTE**（正文 `:36`；图 `wiki/diagrams/ai-core.yaml:20-29,36`）。36 行把 MTE 当作命名部件介绍，官方图在 GM→L1、GM→UB 的箭头上标了 MTE1/2/3，而我们的首图只在 36 行注里写「搬运单元负责传数据」，读者按正文去图上找 MTE 找不到。**改法**：二选一——在 yaml 的 GM→L1（21 行）与 GM→UB / UB→GM（27、29 行）箭头旁加 MTE 文字标注；或正文 36 行不单独点 MTE 名，统一叫搬运单元。

### P3

3. 52–57 行的 32 B calc 放在「为什么」节里，把演算提前到了直觉之前半步。可下沉到第 3 节与矩阵演算并列，或降为行内一句。
4. 旧版「图按官方分离架构画两条典型路径，省略部分控制与搬运细节」的省略声明在新版没有对应句。新图确实省了官方图里的 BT Buffer、FP Buffer 和 MTE1/2/3，建议在 caption 或 38 行补一句「图省略了部分搬运与控制部件」。
5. 「不能直接换算成耗时 / 需要实测证据」在 48、59、103 行重复三次，留 59 与 103 两处即可。
6. 140 行描述自定义融合条件时省略了 `moe_mlp.py:156` 的 `and not use_mxfp_quant`，以及 `:115` 里 `use_mxfp_quant or ...` 的另一半。本页只讲 W8A8 普通分支可以接受，但可加半句「MXFP 量化另走一支」避免读者按本页条件去读源码时对不上。
7. 旧版「不推断 A3 或后续产品的核数、面积、缓冲容量」在新版 85 行收窄为「属于具体产品规格」，建议把「不外推到具体产品型号」这层意思写回去。

### 跳过的内容与原因

- **浏览器逐屏验收未做**：用户预览 `http://localhost:5193` 未在运行（`curl` 返回 000），按派发要求不起停服务；改用 Playwright 直接截 SVG 也失败（chromium 启动超时）。本页的视觉判断改为读 `ai-core.yaml` 规格 + 对照官方原图完成，**首屏实际渲染效果尚未验证**。
- 按派发纪律，对照源码一节只用 grep 核 H3 齐全/顺序/版本号，未通读其正文（只读了 132–140 行以判断第二张图的位置是否合适——结论：`ai-core-execution` 是源码分支流程图，放在「源码位置」合适）。
- frontmatter 的 sources 区未读（由 audit 校验）；未读 HANDBOOK、docs/plans/、TERMS.md 全文。

## P5 修订记录（GPT-6 Astra）

2026-10-02。按末尾 P5 审查逐条核对：原 P1 为 0；7 条意见中修订 6 条（P2 两条、P3 四条），第 5 条依据实际正文判为不成立，保留原文。未重做旧版信息清单。修改范围为本页、两张图的 YAML/SVG 和本记录；不提交。

### 逐条处理

| 审查编号 | 处理 | 修订位置与证据 |
|---|---|---|
| 1 · P2 · 首屏缩写密集 | 已修 | `wiki/concepts/ai-core.md:38` 只解释 GM 与片上缓冲两层；L1、L0A/B、L0C、UB 和 Fixpipe 移到第 56 行，按输入准备、矩阵操作数、累加结果、输出交接的顺序解释。首图仍在第 40 行。 |
| 2 · P2 · MTE 图文不对应 | 已修 | 采用审查建议的第二种方案：第 36 行统一称“搬运单元”，与首图第 36 行的文字相同，去掉正文孤立的 MTE 缩写，保留搬运职责和数据箭头。 |
| 3 · P3 · 搬运账提前 | 已修 | 原第 50–59 行的完整 4 个 FP32 数、读 16 B、写 16 B、合计 32 B 及测量边界移到第 68–81 行。第三节先讲矩阵结果交接，再讲向量搬运与流水配合；两段各有机制解释、一个 calc，没有合并丢数字，也没有在同一承载小节堆两个 calc。 |
| 4 · P3 · 图省略声明丢失 | 已修 | `wiki/diagrams/ai-core.yaml:3` 补回省略部分缓冲、搬运与控制部件的图注，保留框数不代表核数或容量。对应 SVG 已重新生成。 |
| 5 · P3 · 三次重复免责声明 | 不改，意见不成立 | 本轮改前快照 `tmp/p5/ai-core-before-revision.md:48` 与修订后第 48 行完全相同：描述权重复用、数据未就绪时等待，以及搬运、片上空间、同步成本，并区分片上搬运与卡间通信；没有“不能换算耗时”或“需要实测”的表述。实际两处分别是原第 59 行（现第 79 行：逻辑字节量不能预测实际耗时）和原第 103 行（现第 107 行：融合或 double buffer 收益需实测），恰好是审查建议保留的两处。删除第 48 行会损失代价与层次说明，因此保留。 |
| 6 · P3 · MXFP 条件未展开 | 已修 | 第 146 行说明 MXFP 的作用，补齐 `use_mxfp_quant` 为真时排除自定义融合、选中 DeviceOperator 融合的分支。已用 `git -C tools/repos/vllm-ascend show db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py` 核对第 115、156、165–178 行；原 W8A8 条件保留。`ai-core-execution.yaml:3` 图注明确仅画普通 W8A8 路径，SVG 同步更新。 |
| 7 · P3 · 具体产品外推边界 | 已修 | 第 89 行补明不能由首图外推 A3 或后续产品的核数、缓冲容量和芯片面积；原源码区第 127 行已有同一边界，继续保留。 |

### 概念、数字与信息保留

- 本轮联网核对 [CANN 8.0.RC2「基本架构」](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html) 的分离架构说明及典型路径，并实际查看已有官方原图 `tmp/p5/ai-core-official.png`。图中确有本页省略的缓冲和搬运部件；搬运名称简化不改变硬件分工。
- GLM 数字未改：复核 `docs/mainline/02-forward.md` §3.4（233–237 行）与 §6.6（699–711 行），保留 W8A8 软件入口、4096 → SwiGLU 后 2048 → 4096 的宽度及主线链接。矩阵示意仍为 [5, −5] → [5, 0]，搬运示意仍为 16 B + 16 B = 32 B；没有新增部署或性能数字。
- 以本轮改前快照对比正文 diff：缓冲职责和 32 B 算例是迁移而非删除；GM/L1 两种矩阵输出路径、UB/Unified Bus 区分、double buffer 条件、版本表、来源和原待核项均保留。旧版清单按用户要求不重做。

### 验证结果

| 检查 | 本轮结果 |
|---|---|
| `pnpm.cmd wiki:lint` | 每次保存页面后运行；最终退出 0，本页 0 报错；全库只有 5 处非阻塞提示，均非本页。 |
| `pnpm.cmd wiki:diagrams --check` | 退出 0，281 张图与 spec 一致；本页两图 0 报错。 |
| `pnpm.cmd wiki:audit` | 退出 0，审计 138 页、3436 条来源；无无效 commit、缺文件或行号越界。本页 7 条源码行号有效、2 条 URL 类型来源，无报错。工具不验证 URL 可访问性、raw 摘录及结论语义。 |
| `pnpm.cmd check:content` | 退出 0，registry 133 页；工具报告尚无章节，Term 引用检查跳过。 |
| 本页独立写作与图检查 | `pnpm.cmd exec tsx tmp/p5/check-ai-core-revision.ts`：`checkStandard` 的 problems、skip 均为空；两图 `figureProblems` 均为空，SVG 与 `renderDiagram` 逐字一致。未改标准名单。 |
| 范围与空白检查 | 对本轮快照查看正文 diff；`git diff --check -- wiki/concepts/ai-core.md wiki/diagrams/ai-core.yaml wiki/diagrams/ai-core.svg` 无空白错误。仅有 YAML 行尾规范化提示。 |

日志在 `tmp/p5/ai-core-revision-{lint,diagrams,audit,content}.log`，单页统计在 `tmp/p5/ai-core-revision-selfcheck.json`。教学正文按排除 frontmatter、围栏块和链接目标后“汉字 + 拉丁单词”的口径，**2131 → 2227**；含源码区全文 **3598 → 3769**。audit 的 Markdown body 字符串口径（含链接、围栏等）为 **6753 → 7095**，不与教学字数混用。

首图仍在文件第 40 行，图前部署数字 0、calc 0；两图宽度均 860px。教学正文行内代码与证据角标均 0；calc 共 2 个，分属两个实质小节，约 0.90/千字，无表/calc 相邻。全文行内代码 27 处，约 7.16/千字；证据角标 9 处，C 类 7/9 = 77.8%；工具识别免责句 1/68，约 1.47%。

### 取舍与待核

自查无 P1 疑点；第 5 条不改的证据见对应行。沿用用户共用说明 v2：不起服务、不截图、不碰 5193/8790，浏览器实际阅读仍待审查环节；本次只核对官方原图和图规格，不声称通过浏览器验收。目标镜像的分支命中、核数、流水重叠和硬件性能仍缺 trace/实测，原待核项保留。无新增需用户决定的问题。

## 去重记录（GPT-6 Astra）

日期：2026-10-02。按 `op-to-ai-core-review.md` 的 P5 审查 P2-1 及后续修订记录，完整执行链归 `op-to-ai-core`。以本轮开始时的工作区页面为基线，先逐条对照两页，再将 `ai-core.md` 原第 95–99 行的三段压成现第 95 行一句话：说明量化执行链是什么、它如何串起本页的矩阵计算、向量计算与搬运，并链接目标页已有的「归一化之后，矩阵和向量执行段怎样接上」锚点。

### 删除的重复讲解及已有出处

| 从原三段删去的讲解 | 删前确认已存在的 op-to-ai-core 位置 |
|---|---|
| W8A8 的权重、激活按 8 位整数计算；输入动态量化，矩阵乘结合输入与权重尺度恢复输出精度 | [GLM 实际从哪里调用 RMSNorm](../../../../wiki/concepts/op-to-ai-core.md#glm-实际从哪里调用-rmsnorm)第 122 行，以及[归一化之后，矩阵和向量执行段怎样接上](../../../../wiki/concepts/op-to-ai-core.md#归一化之后矩阵和向量执行段怎样接上)第 136 行。 |
| MoE 选择专家、先派发到持有卡、按专家分组执行 grouped matmul | 同上执行段小节第 138 行，含专家网络与 grouped matmul 的定义。 |
| 4096 → gate/up 两路 → SwiGLU 后 2048 → 第二次矩阵乘恢复 4096，以及主线完整形状链接 | 同上执行段小节第 140 行；其形状和专家分布仍链接主线 MoE 节。 |
| 本卡行数由派发决定，不等于原请求 token 数；已有量化输入和尺度直接复用，否则动态量化；结果随后收回、组合，跨卡等待回主线 | 同上执行段小节第 140、142 行；第 142 行已有主线 MoE 通信链接。 |
| 矩阵乘、激活及再量化可融合或分开调用；专家工作不能等同于只用 Cube | 同上执行段小节第 138–140 行，以及[设备侧：搬入、归约、缩放、写回](../../../../wiki/concepts/op-to-ai-core.md#设备侧搬入归约缩放写回)第 114 行、[常见误解](../../../../wiki/concepts/op-to-ai-core.md#常见误解)第 158 行，解释矩阵与向量执行段分工。 |
| 融合改变组织方式，仍可能保存中间结果、占用空间并等待；分块和单元交接取决于实现 | [为什么要分块和融合，代价在哪？](../../../../wiki/concepts/op-to-ai-core.md#为什么要分块和融合代价在哪)第 61–65 行、[融合分支改变的是执行组织](../../../../wiki/concepts/op-to-ai-core.md#融合分支改变的是执行组织)第 71 行、[怎样判断优化是否成立](../../../../wiki/concepts/op-to-ai-core.md#怎样判断优化是否成立)第 118 行。 |

### 保留的独有信息

- 目标执行段没有完整展开稠密 MLP 的定义及“矩阵乘、激活、后续投影”顺序，因此合入新的引导句保留；从稠密 MLP 到按需选择专家的过渡也保留。
- 本页硬件组织与层级、Cube/Vector/Scalar 分工、AIC/AIV 各自控制、GM/L1/L0/UB/Fixpipe 路径、矩阵结果回 GM 或 L1、UB 与 Unified Bus 区别均未改。
- ReLU 手算、32 B 逻辑搬运算例、片上复用与同步代价、CopyIn/Compute/CopyOut、队列和 double buffer 条件均未改。
- A4 挂靠与部署链接、常见误解、源码区的入口和报错、加载后 NZ 格式转换、三版差异及固定 GLM 提交边界均未改。
- 专家 MC2 的详细融合条件、动态负载均衡、自定义算子与 DeviceOperator 分支、MXFP 排除及选入条件，是本页源码区的独有细节，全部保留；两张图、来源、aliases、relations 和全部待核事项均未改。

### 验证、字数与限制

- `pnpm.cmd wiki:lint`：保存正文后立即运行，退出 0，本页 0 报错，新跨页锚点通过；全库 5 条非阻塞提示均在其他页。
- `pnpm.cmd wiki:diagrams --check`：退出 0，283 张图与 spec 一致，本页 0 报错；全库 41 条非阻塞提示，其中本页两图共有 3 条既有文字风格提示。本轮不改图。
- `pnpm.cmd wiki:audit`：退出 0，138 页、3440 条来源，本地引用错误 0，名单内 90 页全部达标；本页 0 报错。此通过范围不含外链访问、raw 摘录内容或结论语义。
- `pnpm.cmd check:content`：退出 0，registry 133 页通过；工具报告尚无章节，Term 引用检查跳过。
- 复用 `pnpm.cmd exec tsx tmp/p5/check-ai-core-revision.ts`：本页写作标准 `problems=[]`、`skip=[]`，两张图均 `problems=[]`、`svgMatches=true`。其内置旧版统计指向上次修订前快照，不作为本轮删前字数。
- 本轮快照为 `tmp/p5/ai-core-before-dedup.md`。单独比较快照与当前页：全文 **3769 → 3371 字**；口径为去 frontmatter、围栏块及链接地址后的“汉字 + 拉丁单词”，含源码区。教学正文现为 1829 字，行内代码和证据角标均为 0，calc 仍为 2 个；全文行内代码仍为 27 处，约 8.01/千字。
- `git diff --no-index -- tmp/p5/ai-core-before-dedup.md wiki/concepts/ai-core.md` 仅有原第 95–99 行这一处替换；退出 1 表示存在预期差异。未修改 `op-to-ai-core.md`、图或其他正文；仅按任务另行追加本审查记录，无 git 提交。
- 本轮未新增或改算数字、未改变核心概念与来源，未重审上游源码；旧版信息清单按用户要求跳过。按共用说明 v2 不起服务、不截图，浏览器验收与目标设备实测仍未执行，原待核项保留。自查无新增 P1 疑点；需用户决定的问题：无。
