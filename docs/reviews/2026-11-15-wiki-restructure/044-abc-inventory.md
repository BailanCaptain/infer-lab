# 044 存量 163 篇正式页 A/B/C 分级盘点与分批改进台账（只读预盘点）

- **关联任务**：`0001794686458927-000044-ba930962`（首批验收后推进存量知识库 A/B/C 分级与分批改进，当前保持 `todo` 预备态）
- **前置任务**：`0001794686458844-000042-d05c4c4b`（四类首批样板真实管线闭环验收，当前隔离根目录 `042-pipeline-tiAFG4` / `batchId = 4c552fdf-de07-4069-a5f8-33c15586903a` 已完成 `--collect-only` 预备）
- **数据基线**：`HEAD = f44c953f99e416b2dc174c3b2ad31a729b91d30f` + 只读指标快照 `%TEMP%/infra-wiki-review-20261115/044-current-inventory.json`（`checkedAt = 2026-11-15T07:59:28.362Z`）
- **硬性纪律**：本台账系 `044` 只读预盘点产物；在 `042` 首批样板闭环完成前，**不提前改写正式 `wiki/` 页面，不将 `044` 置为 `done`**；全部 **19 篇含 `wiki-scene` 围栏页面（23 处场景锚点）的 3D 场景与围栏语义严格冻结不变**。

---

## 一、 全量 163 篇正式页结构统计与分级汇总

### 1.1 按页面体裁（`type`）与预分级（`A / B / C`）交叉统计

> **方法边界 ①（预分级 ≠ 已完成验收；`C0` 仅表示 `Batch 0` 首批样板编号，不导出全盘重构）**：本台账的 `A / B / C` 是用于规划改造强度与批次顺序的**只读预分级**，**绝不代表全库 163 页已完成事实或教学验收**——每一批次在实施时仍须逐页经过真实写管线、旧事实三出口去向核验、砚砚（`038` 一手事实核验）与烁烁（`039` 教学与 2D 检视）及 `Review` 整组审阅。特别地，表中将包 3 首批 4 篇样板统一记为 **`C0` 仅表示 `Batch 0` 首批样板批次编号，不能据此导出 4 篇全部推倒重构**：其中 `#87` `quantization.md` **必须原样保留已认可的前 342 行成熟主干、冻结 `L228` `wiki-scene` 与 `[0.523, -0.31, 1.27]` 算例**，仅局部升级 KaTeX 公式、恢复 `### 怎么开` 反引号并整合尾部版本对照。

| 页面体裁 (`type`) | 总页数 | **C 档（`C0`:4 / `C1`:7 / `C2`:3）** | **B 档（`B1`:8 / `B2`:2 / `B3`:16）** | **A 档（保护叙事主干）** | 含冻结 `wiki-scene` 页数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `concept`（概念页） | **63** | **9** (`C0`:1, `C1`:7, `C2`:1) | **12** (`B1`:4, `B2`:0, `B3`:8) | **42** | 10 篇（12 处围栏） |
| `feature`（特性页） | **60** | **4** (`C0`:2［含 `quantization` 保主干样板］, `C1`:0, `C2`:2) | **14** (`B1`:4, `B2`:2, `B3`:8) | **42** | 9 篇（11 处围栏） |
| `param`（参数页） | **33** | **1** (`C0`:1) | **0** | **32** | 0 篇 |
| `source`（来源档案页） | **6** | **0** | **0** | **6** | 0 篇 |
| `pr`（PR 档案页） | **1** | **0** | **0** | **1** | 0 篇 |
| **合计** | **163** | **14 (8.6%)** | **26 (16.0%)** | **123 (75.5%)** | **19 篇（23 处围栏）** |

### 1.2 双层施治原则与方法边界 ②：严分「可证明机械定位/生成区同步」与「需经管线+三出口复核+`Review` 的语义整合」

`044-current-inventory.json` 中的机械指标（`plainSourceMentionPages = 149`、`boldVersionPatchPages = 146`、`hashSuffixIds = 24`、`promptResiduePages = 1`）是**待检视坐标而非自动判死刑重写令**。按 `@砚砚` `000278` 审阅边界，严格区分**脚本可做的确定性工作**与**必须走整合管线 + 旧事实三出口复核 + `Review` 的语义修改**：

1. **第一层：脚本辅助定位、生成区同步与可证明纯机械替换（脚本不得自行裁量版本/默认值/适用条件语义）**
   - **参数页受保护生成区同步与展示解耦（33 篇 `param`，含 24 篇 `-<12hex>`）**：经修复 Python `__init__` 签名扫描后的官方确定性同步入口（`publishParamSync` / `wiki:lineage:apply` / `wiki:build-param-pages`）刷新 `## 版本谱系` 与 `## 参数定义（自动生成）`，并以 `<parent>.<leaf>` 优化展示（保留内部稳定 `id`）；
   - **AST 定位与候选补丁提议（146 篇版本补丁段、149 篇纯文本 `来源 N`）**：脚本仅负责精确定位行号、对 `sources` 列表序号唯一对应的纯文本 `来源 N` 生成可证明机械替换提议，**严禁由脚本自动裁量版本差异、默认值变更或适用条件去留**。
2. **第二层：涉及段落合并、版本对照表归并或条件迁移的改动，必须经真实整合管线、旧事实三出口去向复核与 `Review`（严禁把正文必要前提仅藏进折叠区）**
   - 凡涉及将 `**v0.30.0rc2 ...**` 粗体补丁段并入版本对照结构、移除参数页 `## 一句话` 首句 `**v0.30.0rc2 对照：**` 劫持或将首屏分支后移，均属于**语义与结构整合**：必须经真实写管线提案、逐条核验旧页原子事实与版本/硬件条件的**三出口去向**（保留在正文/表格/核验区、`supersede.claims` 有证更正、或同批子页承接），并经 `Review` 审阅发布；**教学正文得出结论时必须就地用自然语言说清示意设定、静态推导前提或版本/硬件适用边界，严禁借折叠 `## 对照源码` 核验区把正文必需的适用条件抽走藏匿**。
   - **A 档（123 篇，75.5%——保护叙事主干，不开推土机）**：主线递进自然、算例自洽（如 `embedding.md`、`kv-cache.md` 等 84 篇概念/特性页、32 篇常规参数页、7 篇来源/PR 档案页）。**严禁推倒重写教学主干**，仅在保护既有文风与算例的前提下完成尾部版本对照整合、恢复被剥反引号与纯文本 `来源 N` 修复。
   - **B 档（26 篇，16.0%——保留核心主干 + 局部减法/拆旁支/去重）**：
     - **`B1`（8 篇巨无霸拆旁支）**：`sampling.md`（1557 行）、`api-server-entry.md`（1359 行）等前段主干扎实的巨无霸，保留核心主干，将十余条高阶旁支拆出或归入文末适用边界区；
     - **`B2`（2 篇同题去重）**：`acl-graph.md`（422 行）与 `graph-mode-layer.md`（464 行）明确职责边界，消除双机 7 张图与捕获/回放重复展开；
     - **`B3`（16 篇首屏减负与过渡补齐）**：`token.md`、`attention-qkv.md`（补齐冻结 3D 场景前文过渡）、`mlp-residual-norm.md`、`device-memory.md`、`async-scheduling.md` 等，将首屏过度堆叠的异常分支移入正文适用边界小节（保留正文必要前提）。
   - **C 档（14 篇，8.6%——含 `C0` 首批 4 篇样板编号 + `C1`/`C2` 单页隔离重构/解绑重写）**：
     - **`C0`（4 篇，仅表示包 3 / `042` `Batch 0` 首批样板编号，不导出全盘重构）**：`chunked-prefill.md`（调度样板）、`quantization.md`（**算子样板：严格保留前 342 行已认可成熟主干，仅局部接入 KaTeX、恢复反引号与整合尾部版本对照**）、`enable-super-kernel-ce990e186bfa.md`（参数样板）、`inference-troubleshooting.md`（排障样板）；
     - **`C1`（7 篇存量 + 1 篇新增鸟瞰页，包 5 首批 `Batch 5.1`）**：围绕 **2A 开篇路线** 解绑前四页认知悬崖、修复跨 86 页悬空“上一页”与 `prefill:221` 悬空跨页粘贴、迁移 `gap-a5164fe10fa9184412f8`；
     - **`C2`（3 篇，包 5 第二批 `Batch 5.2`）**：闭合 `glm-5-3-flash-two-node.md` 通用 `(X, Y, z)` 容量账与延迟屋顶，重整 `structured-output.md`（811 行反引号清零重灾页）与 `request-call-chain.md`（中段异物嫁接与充数算式）。

---

## 二、 分批推进路线图与 `Batch 5.1`（包 5 首批改进范围）

### 2.1 分批总览（`Batch 0` + `Batch 5.1`–`Batch 5.5`）

| 批次代号 | 包含档位与页数 | 核心目标与交付范围 | 前置依赖与准入条件 |
| --- | --- | --- | --- |
| **`Batch 0`（包 3 / `042`）** | `C0`（4 篇，批次编号；其中 `quantization` 保护前 342 行主干） | 跑通 `chunked-prefill`、`quantization`（严格保留前 342 行成熟主干）、`enable-super-kernel-ce990e186bfa`、`inference-troubleshooting` 真实 `Drop`/`Review` 发布、静态阅读与问答回流闭环 | 等待 `@烁烁` 完成 `000255` 128K `pageFormat` 修复后，在已就绪的 `042-pipeline-tiAFG4`（`batchId = 4c552fdf-de07-4069-a5f8-33c15586903a`）继续 `startDrop` |
| **`Batch 5.1`（包 5 首批）** | `C1`（7 篇存量 + 1 篇新增 `request-overview`）+ `B2`（2 篇）+ `B3` 入门主线（3 篇）= **12 篇存量 + 1 篇新页** | **2A 开篇主线解绑与目录对齐**：新增纯白话算术全景鸟瞰页 `request-overview`；解绑 `learning-guide`、`one-request`（保留原 `id`/`#一条请求要走过七站`/`R1` 锚点）、`concurrent-requests`、`glm-5-3-flash`、`layers-and-hidden`；修复 `prefill:221` 悬空引用；完成 `token`/`attention-qkv`/`mlp-residual-norm` 首屏减负与冻结 3D 过渡；合并去重 `acl-graph`/`graph-mode-layer`；迁移 `gap-a5164fe10fa9184412f8`（依赖包 4 `legacyIds`） | `Batch 0`（`042`）闭环通过后无停工门立即启动；其中 `gap-a5164fe10fa9184412f8` 改名重定向上线前需包 4 `legacyIds` 就绪 |
| **`Batch 5.2`（包 5 第二批）** | `C2`（3 篇）+ `B1` 巨无霸前 4 篇（`sampling`、`api-server-entry`、`expert-parallel`、`speculative-decoding`）= **7 篇** | 闭合 `glm-5-3-flash-two-node` 通用 `(X, Y, z)` 容量账与延迟屋顶；重整 `structured-output`（811 行）与 `request-call-chain`（641 行）；拆分 `sampling`（1557 行）与 `api-server-entry`（1359 行）等前四篇巨无霸高阶旁支 | `Batch 5.1` 经三猫双检视与 `Review` 整组批准发布 |
| **`Batch 5.3`（包 5 第三批）** | `B1` 后 4 篇（`tensor-parallel`、`engine-processes`、`streaming-output`、`pd-disaggregation`）+ `B3` 其余 13 篇 = **17 篇** | 完成其余 4 篇 640+ 行大页旁支收拢，以及 13 篇中腰部概念/特性页的首屏免责归仓与异物剥离（如 `device-memory`、`async-scheduling` 等） | `Batch 5.2` 整组批准发布 |
| **`Batch 5.4`（包 5 第四批）** | `A-Param`（32 篇）+ `A-Source/PR`（7 篇）= **39 篇** | 全量参数页 `<parent>.<leaf>` 展示解耦、`__init__` 谱系同步、移除首句 `**v0.30.0rc2 对照：**` 劫持与纯文本 `来源 N` 还原；修复 `toc.ts:225` `rfork-official-guide.md` 归位 | 包 2/包 5 确定性参数同步脚本与 AST 工具就绪 |
| **`Batch 5.5`（包 5 第五批）** | `A-Concept/Feature`（84 篇） | 在严格保护 84 篇 A 档概念/特性页既有叙事主干与 9 篇冻结 `wiki-scene` 的前提下，批量完成尾部版本补丁段归并、纯文本 `来源 N` 还原、被剥反引号恢复与折叠 `## 对照源码` 核验区收口 | AST 确定性归并脚本经 `@砚砚` 审阅通过 |

### 2.2 `Batch 5.1`（包 5 首批）精确范围与执行契约

1. **首批目标**：优先打通读者进站前 10 页的「2A 从浅入深、零跳步」阅读主线，并消解最显眼的同题重复（`acl-graph` vs `graph-mode-layer`）。
2. **首批 12 篇存量页 + 1 篇新增页清单**：
   - **新增全景鸟瞰页（1 篇）**：`wiki/concepts/request-overview.md`（第 1 章导读后首篇，纯白话算术走完一次请求全景，零未定义公式）；
   - **C1 开篇解绑与悬空修复（7 篇）**：`learning-guide.md`、`one-request.md`（保留 `id`、`#一条请求要走过七站`、`R1` 锚点及 `L267` 冻结 `wiki-scene`）、`concurrent-requests.md`、`glm-5-3-flash.md`（保留 `L147/153/213` 3 处冻结 `wiki-scene`）、`layers-and-hidden.md`、`prefill.md`（修 `L221` 六词分布悬空引用）、`gap-a5164fe10fa9184412f8.md`（迁为语义 ID 并挂 `legacyIds`）；
   - **B3 第一章基础积木首屏减负（3 篇）**：`token.md`（首屏字节回退/MTP/多模态移入边界区）、`attention-qkv.md`（`L269` 双层 CP 分支后移 + 补齐 `L203` 冻结双卡 3D 场景前文过渡）、`mlp-residual-norm.md`（剥离 `L191-L207` 提前塞入的 QK Norm/RoPE，保留 `L271` 冻结 `wiki-scene`）；
   - **B2 同题去重（2 篇）**：`acl-graph.md` 与 `graph-mode-layer.md` 边界对齐去重。
3. **不变红线**：所有含 `wiki-scene` 页面的 3D 围栏与场景完全冻结；每篇均须生成旧事实三出口去向回执，经砚砚（`038` 事实与一手来源）+ 烁烁（`039` 桌面端通俗递进与 2D 图解）双检视通过后由砚砚依 `000248` 整组批准发布。

---

## 三、 存量 163 篇正式页逐页 A/B/C 分级与批次台账

> 字段说明：`指标 (plain/bold/scene)` 依次表示 `plainSourceMentionLines` 行数、`boldVersionPatchLines` 行数、`sceneFenceLines` 冻结场景围栏数（含行号）。

| # | 页面路径 (`path`) | 类型 | 行数 | `sources` | 指标 (`plain/bold/scene`) | 分级 | 批次 | 分级判据与改进动作 |
| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 1 | `wiki/concepts/acl-graph.md` | `feature` | 422 | 126 | `17 / 1 / 0` | **B2** | `Batch 5.1` | 与 `graph-mode-layer.md` 在图捕获/回放及双机 7 张图上重叠（§2.4/§2.9）；明确聚焦底层 ACL Graph 捕获/分桶机制并去重 |
| 2 | `wiki/concepts/ai-core.md` | `concept` | 204 | 12 | `0 / 1 / 1(L103)` | **A** | `Batch 5.5` | 硬件计算/搬运主线清晰；**冻结 `L103` `wiki-scene`**，仅归并 `L168` 版本补丁段并折叠核验区 |
| 3 | `wiki/concepts/ai-qos.md` | `feature` | 294 | 18 | `0 / 2 / 0` | **A** | `Batch 5.5` | 主干清晰；仅归并 `L263/265` 版本补丁段并折叠核验区 |
| 4 | `wiki/concepts/api-server-entry.md` | `concept` | 1359 | 494 | `13 / 1 / 0` | **B1** | `Batch 5.2` | 全库第 2 大巨无霸（§2.4/§2.9）；保留 HTTP→Engine 主干，拆出/归仓实时转写、Ray Serve、SageMaker、多模态等十余条旁支 |
| 5 | `wiki/concepts/ascend-950-architecture.md` | `concept` | 238 | 1 | `0 / 0 / 0` | **A** | `Batch 5.5` | 950 架构主线自洽；保护现有叙事主干与 4 张 2D 图 |
| 6 | `wiki/concepts/ascend-950-execution-interconnect.md` | `concept` | 220 | 2 | `2 / 0 / 0` | **A** | `Batch 5.5` | 双卡互联主线清晰；保护主干，还原 `L211/217` 纯文本来源引用 |
| 7 | `wiki/concepts/ascend-config-system.md` | `feature` | 344 | 55 | `10 / 1 / 0` | **A** | `Batch 5.5` | 三级配置生效主干清晰；归并 `L282` 版本补丁，还原 10 处纯文本 `来源 N` |
| 8 | `wiki/concepts/ascend-patch-system.md` | `feature` | 411 | 92 | `4 / 4 / 0` | **A** | `Batch 5.5` | Patch 机制主干完整；归并 `L361-379` 4 处版本补丁，还原 4 处纯文本 `来源 N` |
| 9 | `wiki/concepts/async-scheduling.md` | `feature` | 492 | 107 | `4 / 1 / 0` | **B3** | `Batch 5.3` | 保留异步排步主干；将 `L301-328` 目标硬件禁用机制大段展开移入边界区（§2.4） |
| 10 | `wiki/concepts/attention-backend-family.md` | `concept` | 316 | 62 | `2 / 2 / 0` | **A** | `Batch 5.5` | 后端族谱主干清晰；归并 `L267/273` 补丁，还原 `L275/310` 纯文本来源 |
| 11 | `wiki/concepts/attention-cost.md` | `concept` | 289 | 28 | `1 / 1 / 0` | **A** | `Batch 5.5` | 容量/计算/访存算账清晰；归并 `L260` 补丁，还原 `L288` 纯文本来源 |
| 12 | `wiki/concepts/attention-qkv.md` | `concept` | 455 | 27 | `7 / 1 / 1(L203)` | **B3** | `Batch 5.1` | **冻结 `L203` `wiki-scene`**；在单卡算例与 `L203` 8 位置双卡 3D 场景间补齐过渡，将 `L269` 双层 CP 裁剪分支移入边界区（§2.3/§2.4/§2.9） |
| 13 | `wiki/concepts/balance-scheduling.md` | `feature` | 301 | 38 | `2 / 1 / 0` | **A** | `Batch 5.5` | 主干清晰；归并 `L254` 版本补丁，还原 `L298/300` 纯文本来源 |
| 14 | `wiki/concepts/batch-invariance.md` | `feature` | 308 | 38 | `4 / 1 / 0` | **A** | `Batch 5.5` | 批不变性算例自洽；归并 `L282` 补丁，还原 4 处纯文本来源 |
| 15 | `wiki/concepts/batch-job-aware-scheduler.md` | `feature` | 338 | 43 | `3 / 1 / 0` | **A** | `Batch 5.5` | 主干清晰；归并 `L308` 补丁，还原 3 处纯文本来源 |
| 16 | `wiki/concepts/block-table.md` | `concept` | 378 | 46 | `4 / 1 / 1(L133)` | **A** | `Batch 5.5` | 块映射主干清晰，在 `toc.ts` 中前移至 `kv-cache-spec` 之前（§2.1）；**冻结 `L133` `wiki-scene`**，归并补丁与纯文本来源 |
| 17 | `wiki/concepts/cann-hccl.md` | `concept` | 441 | 74 | `8 / 1 / 0` | **A** | `Batch 5.5` | CANN/HCCL 层次清晰；归并 `L393` 补丁，还原 8 处纯文本来源 |
| 18 | `wiki/concepts/chunked-prefill.md` | `feature` | 351 | 51 | `11 / 1 / 1(L194)` | **C0** | `Batch 0` | 包 3 首批调度样板（`01-chunked-prefill.md` 已通过预检）；**冻结 `L194` `wiki-scene`** 与 `A/B+C(14→6,6,2)` 算例，消除 `L212` 提示词残留与劈断算式 |
| 19 | `wiki/concepts/collective-communication.md` | `concept` | 459 | 33 | `6 / 1 / 1(L152)` | **A** | `Batch 5.5` | 集合通信主干与 11 张 2D 图清晰；**冻结 `L152` `wiki-scene`**，归并 `L417` 补丁并还原 6 处纯文本来源 |
| 20 | `wiki/concepts/concurrent-requests.md` | `concept` | 593 | 75 | `6 / 1 / 0` | **C1** | `Batch 5.1` | 2A 开篇解绑页（§2.1/§2.3）；后移至基础积木之后，剥离首屏序列化/内核回退旁支，还原反引号与纯文本来源 |
| 21 | `wiki/concepts/context-parallel.md` | `feature` | 474 | 52 | `3 / 1 / 3(L163,239,323)` | **B3** | `Batch 5.3` | **冻结 `L163/239/323` 3 处 `wiki-scene`**；将首屏 CP 变体免责移入边界区，归并 `L416` 补丁 |
| 22 | `wiki/concepts/cpu-binding.md` | `feature` | 323 | 41 | `2 / 1 / 0` | **A** | `Batch 5.5` | NUMA 绑核主干清晰；归并 `L265` 补丁，还原 `L314/322` 纯文本来源 |
| 23 | `wiki/concepts/data-parallel.md` | `feature` | 426 | 56 | `7 / 2 / 1(L288)` | **A** | `Batch 5.5` | DP 陪跑主干清晰；**冻结 `L288` `wiki-scene`**，归并 `L365/378` 补丁，还原 7 处纯文本来源 |
| 24 | `wiki/concepts/deepseek-serving-case.md` | `concept` | 218 | 8 | `0 / 0 / 0` | **A** | `Batch 5.5` | 生产实践案例主线自洽；保护现有叙事主干 |
| 25 | `wiki/concepts/deepseek-v4-1-flash.md` | `concept` | 278 | 9 | `0 / 0 / 0` | **A** | `Batch 5.5` | 模型案例主线自洽；保护现有叙事主干 |
| 26 | `wiki/concepts/device-memory.md` | `concept` | 291 | 45 | `5 / 1 / 0` | **B3** | `Batch 5.3` | 保留主机内存与显存核心主干；剥离 `L137-162` 宿主机 cgroup 与退出码 `137` 异物嫁接段（§2.4） |
| 27 | `wiki/concepts/dp-request-routing.md` | `concept` | 336 | 30 | `4 / 3 / 0` | **A** | `Batch 5.5` | DP 路由算例清晰；归并 `L225/230/291` 补丁，还原 4 处纯文本来源 |
| 28 | `wiki/concepts/dspark.md` | `feature` | 235 | 16 | `0 / 0 / 0` | **A** | `Batch 5.5` | DSpark 投机筛选主线自洽；保护现有叙事主干 |
| 29 | `wiki/concepts/dynamic-chunked-pp.md` | `feature` | 366 | 47 | `3 / 1 / 0` | **A** | `Batch 5.5` | 动态切块流水线主干清晰；归并 `L329` 补丁，还原 3 处纯文本来源 |
| 30 | `wiki/concepts/dyntra-lb.md` | `feature` | 374 | 50 | `4 / 1 / 0` | **A** | `Batch 5.5` | DyntraLB 换人均衡主干清晰；归并 `L328` 补丁，还原 4 处纯文本来源 |
| 31 | `wiki/concepts/embedding.md` | `concept` | 321 | 36 | `7 / 1 / 0` | **A** | `Batch 5.5` | 主方案点名存量 A 档标杆（§2.9 得分 7.6–7.8）；严禁重写主干，仅归并 `L291` 补丁与 7 处纯文本来源 |
| 32 | `wiki/concepts/engine-processes.md` | `concept` | 677 | 142 | `12 / 2 / 0` | **B1** | `Batch 5.3` | 677 行大页；保留 API server/EngineCore/Worker 三进程核心主干，收拢次要守护进程/IPC 异常旁支 |
| 33 | `wiki/concepts/eplb.md` | `feature` | 493 | 76 | `13 / 1 / 0` | **B3** | `Batch 5.3` | 保留专家热度均衡核心算例；收拢次要采样窗口边角分支并还原 13 处纯文本来源 |
| 34 | `wiki/concepts/expert-parallel.md` | `feature` | 759 | 90 | `10 / 1 / 1(L357)` | **B1** | `Batch 5.2` | 全库第 4 大页（759 行）；**冻结 `L357` `wiki-scene`**，保留 16 卡分专家/发收 token 主干，收拢次要通信回退旁支 |
| 35 | `wiki/concepts/fine-grained-tp.md` | `feature` | 396 | 38 | `4 / 1 / 0` | **A** | `Batch 5.5` | 细粒度 TP 分片主干清晰；归并 `L347` 补丁，还原 4 处纯文本来源 |
| 36 | `wiki/concepts/gap-a5164fe10fa9184412f8.md` | `concept` | 276 | 43 | `7 / 1 / 0` | **C1** | `Batch 5.1` | 裸机器哈希 ID 占并行章首篇（§2.1/§2.6/§6.5）；待包 4 `legacyIds` 就绪后迁为语义 ID（如 `hccl-buffer`）并调至 `cann-hccl` 后 |
| 37 | `wiki/concepts/glm-5-3-flash-two-node.md` | `feature` | 480 | 41 | `5 / 1 / 0` | **C2** | `Batch 5.2` | 立项四问核心承载页（§1.2/§6.5）；闭合通用 `(X, Y, z)` 容量账、PD 分离算账与 Q4 理论延迟屋顶，补核 `待核` 项 |
| 38 | `wiki/concepts/glm-5-3-flash.md` | `concept` | 494 | 39 | `4 / 1 / 3(L147,153,213)` | **C1** | `Batch 5.1` | 2A 开篇解绑页（§2.1）；**冻结 `L147/153/213` 3 处 `wiki-scene`**，后移至基础积木之后，消除未讲词元/注意力前堆入 7 套高阶机制的跳步 |
| 39 | `wiki/concepts/gqa.md` | `concept` | 372 | 31 | `0 / 2 / 0` | **A** | `Batch 5.5` | GQA 省显存算账主线清晰；保护主干，归并 `L335/337` 版本补丁段 |
| 40 | `wiki/concepts/graph-mode-layer.md` | `feature` | 464 | 93 | `19 / 2 / 0` | **B2** | `Batch 5.1` | 与 `acl-graph.md` 高度重叠（§2.4/§2.9）；明确聚焦 vLLM 编译层分段回放编排，去重双机 7 张图重复叙述 |
| 41 | `wiki/concepts/hardware-devices.md` | `concept` | 245 | 26 | `0 / 1 / 0` | **A** | `Batch 5.5` | NPU/板卡/服务器/机柜硬件入门清晰；仅归并 `L209` 版本补丁 |
| 42 | `wiki/concepts/inference-benchmarking.md` | `concept` | 305 | 26 | `3 / 1 / 0` | **A** | `Batch 5.5` | 推理测量指标主干清晰；归并 `L278` 补丁，还原 3 处纯文本来源 |
| 43 | `wiki/concepts/inference-capacity-and-reliability.md` | `concept` | 217 | 9 | `2 / 0 / 0` | **A** | `Batch 5.5` | 容量与故障恢复主干自洽；保护主干，还原 `L212/213` 纯文本来源 |
| 44 | `wiki/concepts/inference-correctness-troubleshooting.md` | `concept` | 339 | 26 | `6 / 1 / 0` | **A** | `Batch 5.5` | 输出异常排查主干清晰；归并 `L310` 补丁，还原 6 处纯文本来源 |
| 45 | `wiki/concepts/inference-performance-analysis.md` | `concept` | 534 | 99 | `9 / 1 / 0` | **B3** | `Batch 5.3` | 保留“设备在算还是在等”核心主干；收拢次要采集工具分支，归并 `L494` 补丁与 9 处纯文本来源 |
| 46 | `wiki/concepts/inference-performance-troubleshooting.md` | `concept` | 245 | 11 | `2 / 1 / 0` | **A** | `Batch 5.5` | 性能排障选型主干简明；归并 `L226` 补丁，还原 `L242/244` 纯文本来源 |
| 47 | `wiki/concepts/inference-performance-walkthrough.md` | `concept` | 401 | 14 | `1 / 1 / 0` | **A** | `Batch 5.5` | 回答停顿排障走查主线清晰；归并 `L378` 补丁与纯文本来源 |
| 48 | `wiki/concepts/inference-troubleshooting.md` | `concept` | 236 | 12 | `0 / 1 / 0` | **C0** | `Batch 0` | 包 3 首批排障样板（`04-inference-troubleshooting.md` 已通过预检）；升级十类故障为“现象→首取证据→分支去向”结构 |
| 49 | `wiki/concepts/kv-cache-cpu-offload.md` | `feature` | 396 | 53 | `11 / 1 / 1(L205)` | **A** | `Batch 5.5` | CPU offload 主干清晰；**冻结 `L205` `wiki-scene`**，归并 `L350` 补丁，还原 11 处纯文本来源 |
| 50 | `wiki/concepts/kv-cache-layerwise-offload.md` | `feature` | 459 | 76 | `6 / 1 / 0` | **A** | `Batch 5.5` | 按层边算边搬主干清晰；归并 `L411` 补丁，还原 6 处纯文本来源 |
| 51 | `wiki/concepts/kv-cache-memory-profiling.md` | `concept` | 384 | 68 | `6 / 1 / 0` | **A** | `Batch 5.5` | 启动显存扣算主干清晰；归并 `L327` 补丁，还原 6 处纯文本来源 |
| 52 | `wiki/concepts/kv-cache-quantization.md` | `feature` | 373 | 48 | `3 / 1 / 0` | **A** | `Batch 5.5` | INT8 C8 KV 量化算例自洽；归并 `L322` 补丁，还原 3 处纯文本来源 |
| 53 | `wiki/concepts/kv-cache-sparse-offload.md` | `feature` | 392 | 48 | `4 / 1 / 0` | **A** | `Batch 5.5` | 稀疏 offload 主干清晰；归并 `L344` 补丁，还原 4 处纯文本来源 |
| 54 | `wiki/concepts/kv-cache-spec.md` | `concept` | 591 | 107 | `9 / 1 / 0` | **B3** | `Batch 5.3` | 在 `toc.ts` 中调至基础 `block-table` 之后（§2.1）；保留页/缓存组换算主干，收拢异构混合层分支 |
| 55 | `wiki/concepts/kv-cache.md` | `concept` | 445 | 58 | `1 / 2 / 0` | **A** | `Batch 5.5` | 主方案点名存量 A 档标杆（§2.9 得分 7.6–7.8）；严禁重写主干，仅归并 `L404/406` 补丁与 `L433` 来源 |
| 56 | `wiki/concepts/kv-pool.md` | `feature` | 598 | 109 | `0 / 1 / 0` | **B3** | `Batch 5.3` | 598 行大页；保留外部池共享前缀主干，收拢次要后端连接器分支，归并 `L531` 补丁 |
| 57 | `wiki/concepts/kvpp.md` | `feature` | 458 | 45 | `6 / 1 / 0` | **A** | `Batch 5.5` | 按层常驻与广播主干清晰；归并 `L407` 补丁，还原 6 处纯文本来源 |
| 58 | `wiki/concepts/large-scale-ep.md` | `feature` | 433 | 55 | `6 / 1 / 0` | **A** | `Batch 5.5` | 大规模 EP 跨机通信主干清晰；归并 `L379` 补丁，还原 6 处纯文本来源 |
| 59 | `wiki/concepts/layers-and-hidden.md` | `concept` | 405 | 32 | `2 / 1 / 0` | **C1** | `Batch 5.1` | 主方案点名 C 档解绑页（§2.1/§2.9 得分 4.2）；调至 `mlp-residual-norm` 之后，解绑标题直绑 GLM 45 层与 60% 篇幅提前灌输四流 `mHC` 的跳步 |
| 60 | `wiki/concepts/learning-guide.md` | `concept` | 173 | 3 | `0 / 1 / 0` | **C1** | `Batch 5.1` | 主方案点名 C 档重写页（§2.1/§2.9 得分 3.5）；与 `toc.ts` 2A 路线严格对齐，消除第二屏 55 行高阶外部专题表提前堆叠 |
| 61 | `wiki/concepts/linear-attention.md` | `concept` | 368 | 32 | `3 / 2 / 0` | **A** | `Batch 5.5` | KDA 固定状态递推主干清晰；归并 `L321/325` 补丁，还原 3 处纯文本来源 |
| 62 | `wiki/concepts/lm-head.md` | `concept` | 347 | 47 | `8 / 1 / 0` | **A** | `Batch 5.5` | `lm_head` 投影算例清晰；归并 `L309` 补丁，还原 8 处纯文本来源 |
| 63 | `wiki/concepts/lmcache.md` | `feature` | 267 | 24 | `1 / 1 / 0` | **A** | `Batch 5.5` | LMCache 外置缓存主干简明；归并 `L240` 补丁，还原 `L246` 纯文本来源 |
| 64 | `wiki/concepts/lora.md` | `feature` | 445 | 114 | `8 / 1 / 0` | **A** | `Batch 5.5` | LoRA 低秩更新与多适配器主干清晰；归并 `L405` 补丁，还原 8 处纯文本来源 |
| 65 | `wiki/concepts/low-precision-formats.md` | `concept` | 351 | 32 | `1 / 1 / 0` | **A** | `Batch 5.5` | BF16/INT8/FP8/FP4 位宽对比清晰，在 `toc.ts` 中前移至 `quantization` 之前（§2.1）；归并 `L321` 补丁 |
| 66 | `wiki/concepts/matmul-and-weights.md` | `concept` | 469 | 37 | `7 / 1 / 1(L154)` | **A** | `Batch 5.5` | 矩阵乘与权重主干清晰；**冻结 `L154` `wiki-scene`**，归并 `L426` 补丁，还原 7 处纯文本来源 |
| 67 | `wiki/concepts/mla.md` | `concept` | 450 | 39 | `8 / 1 / 0` | **A** | `Batch 5.5` | MLA 潜向量压缩主干清晰，在 `toc.ts` 中排在 `sparse-attention` 之前（§2.1）；归并 `L386` 补丁与 8 处来源 |
| 68 | `wiki/concepts/mlp-residual-norm.md` | `concept` | 447 | 37 | `5 / 2 / 1(L271)` | **B3** | `Batch 5.1` | 在 `toc.ts` 中前移至 `layers-and-hidden` 之前（§2.1）；**冻结 `L271` `wiki-scene`**，剥离 `L191-207` 提前塞入的 QK Norm 与 RoPE（§2.4） |
| 69 | `wiki/concepts/moe.md` | `concept` | 542 | 121 | `9 / 1 / 0` | **B3** | `Batch 5.3` | 保留 Top-K 专家路由主干；将首屏路由异常分支移入边界区，归并 `L493` 补丁与 9 处纯文本来源 |
| 70 | `wiki/concepts/mooncake-connector.md` | `feature` | 628 | 147 | `6 / 1 / 0` | **B3** | `Batch 5.3` | 628 行大页；保留对块号与按层搬运主干，收拢重复边角异常分支，归并 `L568` 补丁 |
| 71 | `wiki/concepts/netloader-guide.md` | `feature` | 304 | 21 | `3 / 1 / 0` | **A** | `Batch 5.5` | Netloader 权重接力主干清晰；归并 `L255` 补丁，还原 3 处纯文本来源 |
| 72 | `wiki/concepts/npu-model-runner.md` | `concept` | 417 | 62 | `10 / 1 / 0` | **A** | `Batch 5.5` | `NPUModelRunner` 单步执行主干清晰；归并 `L363` 补丁，还原 10 处纯文本来源 |
| 73 | `wiki/concepts/npu-platform.md` | `feature` | 316 | 56 | `6 / 2 / 0` | **A** | `Batch 5.5` | `NPUPlatform` 校验与选择主干清晰；归并 `L269/273` 补丁，还原 6 处纯文本来源 |
| 74 | `wiki/concepts/npu-worker-lifecycle.md` | `feature` | 523 | 117 | `8 / 2 / 0` | **B3** | `Batch 5.3` | 保留单卡启动顺序主干；收拢次要初始化分支，归并 `L450/462` 补丁与 8 处纯文本来源 |
| 75 | `wiki/concepts/npugraph-ex.md` | `feature` | 488 | 91 | `12 / 1 / 0` | **B3** | `Batch 5.3` | 保留编译图算子融合与分档复用主干；对齐与 `acl-graph`/`graph-mode-layer` 边界，还原 12 处纯文本来源 |
| 76 | `wiki/concepts/one-request.md` | `concept` | 717 | 60 | `3 / 1 / 1(L267)` | **C1** | `Batch 5.1` | 主方案点名 C 档解绑页（§2.1/§2.9 得分 4.0/§6.5）；**完整保留 `id`、`#一条请求要走过七站`、`R1` 锚点及 `L267` 冻结 `wiki-scene`**，配合新增 `request-overview` 消除 `L174` 跨 86 页悬空“上一页” |
| 77 | `wiki/concepts/op-to-ai-core.md` | `concept` | 287 | 29 | `11 / 1 / 0` | **A** | `Batch 5.5` | 算子到 AI Core 分工融合主干清晰；归并 `L252` 补丁，还原 11 处纯文本来源 |
| 78 | `wiki/concepts/ops-and-kernels.md` | `feature` | 423 | 96 | `6 / 2 / 0` | **A** | `Batch 5.5` | 数学语义到 kernel 实现主干清晰；归并 `L362/364` 补丁，还原 6 处纯文本来源 |
| 79 | `wiki/concepts/pd-disaggregation.md` | `feature` | 644 | 120 | `2 / 1 / 1(L309)` | **B1** | `Batch 5.3` | 全库第 10 大页（644 行）；**冻结 `L309` `wiki-scene`**，保留 P/D 历史交接主干，将 `L343-416` 目标硬件禁用机制移入边界区（§2.4） |
| 80 | `wiki/concepts/pipeline-parallel.md` | `feature` | 373 | 14 | `1 / 1 / 1(L130)` | **A** | `Batch 5.5` | PP 层分段与气泡主干清晰；**冻结 `L130` `wiki-scene`**，归并 `L331` 补丁与 `L372` 来源 |
| 81 | `wiki/concepts/platform-plugin-registration.md` | `feature` | 444 | 109 | `29 / 1 / 0` | **A** | `Batch 5.5` | 插件发现与模型注册主干清晰；归并 `L397` 补丁，重点还原尾部 29 处纯文本 `来源 N` |
| 82 | `wiki/concepts/prefill.md` | `concept` | 494 | 53 | `5 / 1 / 0` | **C1** | `Batch 5.1` | 主方案点名 C 档重构页（§2.4/§2.9 得分 4.5）；修复 `L221` 跨页悬空引用“六词分布…约 0.233”，恢复反引号并归并 `L428` 补丁 |
| 83 | `wiki/concepts/prefix-caching.md` | `feature` | 289 | 58 | `7 / 2 / 0` | **A** | `Batch 5.5` | 前缀哈希复用主干清晰；归并 `L250/252` 补丁，还原 7 处纯文本来源 |
| 84 | `wiki/concepts/prepare-inputs-flow.md` | `concept` | 374 | 46 | `2 / 1 / 0` | **A** | `Batch 5.5` | 输入拼表主干清晰；归并 `L332` 补丁，还原 `L348/350` 纯文本来源 |
| 85 | `wiki/concepts/quantization-evaluation.md` | `concept` | 218 | 19 | `1 / 1 / 0` | **A** | `Batch 5.5` | 量化三维验收主干简明；归并 `L198` 补丁，还原 `L217` 纯文本来源 |
| 86 | `wiki/concepts/quantization-methods.md` | `concept` | 383 | 60 | `6 / 1 / 0` | **A** | `Batch 5.5` | PTQ/QAT/AWQ/GPTQ 选型主干清晰；归并 `L347` 补丁，还原 6 处纯文本来源 |
| 87 | `wiki/concepts/quantization.md` | `feature` | 456 | 55 | `4 / 1 / 1(L228)` | **C0** | `Batch 0` | 包 3 首批算子/公式样板（`C0` 仅作 `Batch 0` 编号，`02-quantization.md` 已通过预检）；**原样保护前 342 行成熟主干与 `L228` 冻结 `wiki-scene`（绝不推倒重构）**，仅局部接入 KaTeX、恢复 `### 怎么开` 反引号并整合尾部版本对照 |
| 88 | `wiki/concepts/reading-vllm-ascend.md` | `concept` | 266 | 37 | `10 / 1 / 0` | **A** | `Batch 5.5` | 源码阅读路线主干清晰；归并 `L227` 补丁，还原 10 处纯文本来源 |
| 89 | `wiki/concepts/recompute-cpu-offload.md` | `feature` | 430 | 47 | `6 / 1 / 0` | **A** | `Batch 5.5` | 抢占主机暂存主干清晰；归并 `L380` 补丁，还原 6 处纯文本来源 |
| 90 | `wiki/concepts/recompute-scheduler.md` | `feature` | 336 | 59 | `7 / 1 / 0` | **A** | `Batch 5.5` | 退回 P 节点重算主干清晰；归并 `L292` 补丁，还原 7 处纯文本来源 |
| 91 | `wiki/concepts/request-call-chain.md` | `concept` | 641 | 166 | `8 / 1 / 0` | **C2** | `Batch 5.2` | 主方案点名异物嫁接重灾页（§2.4）；剥离 `L364-395` 中段插入的离线 `LLM` 队列批提交与 `collective_rpc` 旁支及 `3+2=5` 充数 `calc` |
| 92 | `wiki/concepts/request-teardown.md` | `concept` | 606 | 114 | `3 / 1 / 0` | **B3** | `Batch 5.3` | 606 行大页；保留请求正常收尾归还主干，收拢异常中止旁支，归并 `L531` 补丁 |
| 93 | `wiki/concepts/rfork-config.md` | `feature` | 440 | 21 | `3 / 0 / 0` | **A** | `Batch 5.5` | RFork 配置与启动示例清晰；保护主干，还原 3 处纯文本来源 |
| 94 | `wiki/concepts/rfork-identity.md` | `feature` | 389 | 37 | `0 / 3 / 0` | **A** | `Batch 5.5` | RFork 身份匹配主干清晰；仅归并 `L312/313/315` 版本补丁 |
| 95 | `wiki/concepts/rfork-layout.md` | `feature` | 270 | 13 | `1 / 2 / 0` | **A** | `Batch 5.5` | RFork 张量布局主干简明；归并 `L240/243` 补丁，还原 `L269` 纯文本来源 |
| 96 | `wiki/concepts/rfork-lifecycle.md` | `feature` | 425 | 25 | `1 / 1 / 0` | **A** | `Batch 5.5` | RFork 生命周期四步清晰；归并 `L400` 补丁，还原 `L424` 纯文本来源 |
| 97 | `wiki/concepts/rfork-maintenance.md` | `feature` | 229 | 7 | `4 / 0 / 0` | **A** | `Batch 5.5` | RFork 维护准则简明；保护主干，还原 4 处纯文本来源 |
| 98 | `wiki/concepts/rfork-startup.md` | `feature` | 276 | 25 | `4 / 3 / 0` | **A** | `Batch 5.5` | RFork 启动与清理重建主干清晰；归并 `L246-250` 补丁，还原 4 处纯文本来源 |
| 99 | `wiki/concepts/rfork-transfer.md` | `feature` | 402 | 26 | `3 / 1 / 0` | **A** | `Batch 5.5` | RFork 传输流程清晰；归并 `L362` 补丁，还原 3 处纯文本来源 |
| 100 | `wiki/concepts/rfork-troubleshooting.md` | `feature` | 435 | 30 | `2 / 0 / 0` | **A** | `Batch 5.5` | RFork 排错主干清晰；保护主干，还原 `L432/434` 纯文本来源 |
| 101 | `wiki/concepts/rfork.md` | `feature` | 419 | 41 | `1 / 2 / 0` | **A** | `Batch 5.5` | RFork 总览主干清晰；归并 `L205/326` 补丁，还原 `L418` 纯文本来源 |
| 102 | `wiki/concepts/rope.md` | `concept` | 420 | 37 | `2 / 1 / 0` | **A** | `Batch 5.5` | RoPE 旋转位置编码推导与 `rope.yaml` 图解优秀；归并 `L382` 补丁与 2 处来源 |
| 103 | `wiki/concepts/sampling.md` | `concept` | 1557 | 342 | `17 / 2 / 0` | **B1** | `Batch 5.2` | 全库第 1 大巨无霸（1557 行，§2.4/§2.9 得分 6.2–6.8）；保留基础采样主干，将 Beam search/生成式评分/logprobs/思考预算等高阶旁支拆出或归仓 |
| 104 | `wiki/concepts/sequence-parallel.md` | `feature` | 392 | 48 | `7 / 1 / 1(L146)` | **A** | `Batch 5.5` | SP 激活分片主干清晰；**冻结 `L146` `wiki-scene`**，归并 `L350` 补丁，还原 7 处纯文本来源 |
| 105 | `wiki/concepts/short-request-first.md` | `feature` | 291 | 32 | `3 / 2 / 0` | **A** | `Batch 5.5` | 短请求优先与公平性主干清晰；归并 `L100/258` 补丁，还原 3 处纯文本来源 |
| 106 | `wiki/concepts/sleep-mode.md` | `feature` | 280 | 38 | `5 / 1 / 0` | **A** | `Batch 5.5` | Sleep Mode 让出显存主干清晰；归并 `L243` 补丁，还原 5 处纯文本来源 |
| 107 | `wiki/concepts/sparse-attention.md` | `concept` | 434 | 62 | `8 / 1 / 0` | **A** | `Batch 5.5` | 稀疏注意力挑位置主干清晰，在 `toc.ts` 中调至前置 `mla` 之后（§2.1）；归并 `L362` 补丁与 8 处来源 |
| 108 | `wiki/concepts/speculative-decoding.md` | `feature` | 738 | 182 | `12 / 1 / 0` | **B1** | `Batch 5.2` | 全库第 5 大页（738 行）；保留“先猜再一次验完”核心主干，收拢次要投机变体分支，归并 `L665` 补丁 |
| 109 | `wiki/concepts/streaming-output.md` | `concept` | 660 | 124 | `8 / 1 / 0` | **B1** | `Batch 5.3` | 全库第 9 大页（660 行）；保留增量解码流式推送主干，收拢次要协议边角分支，归并 `L574` 补丁 |
| 110 | `wiki/concepts/structured-output.md` | `feature` | 811 | 171 | `7 / 1 / 0` | **C2** | `Batch 5.2` | 主方案点名 C 档重灾页（811 行，§2.4/§2.9 得分 3.5–3.8）；恢复被剥反引号，重整文法掩码主干并归置后端旁支 |
| 111 | `wiki/concepts/swa-bounded-replay.md` | `feature` | 191 | 11 | `1 / 0 / 0` | **A** | `Batch 5.5` | SWA 窗口有界重算主干精炼；保护主干，还原 `L190` 纯文本来源 |
| 112 | `wiki/concepts/tensor-layout.md` | `concept` | 287 | 31 | `6 / 1 / 1(L131)` | **A** | `Batch 5.5` | ND 与 NZ 内存排布主干清晰；**冻结 `L131` `wiki-scene`**，归并 `L265` 补丁与 6 处来源 |
| 113 | `wiki/concepts/tensor-parallel.md` | `feature` | 712 | 50 | `5 / 2 / 1(L292)` | **B1** | `Batch 5.3` | 全库第 7 大页（712 行）；**冻结 `L292` `wiki-scene`**，保留单机 8 卡列/行切分核心主干，收拢次要模块切分旁支 |
| 114 | `wiki/concepts/token.md` | `concept` | 459 | 64 | `11 / 1 / 0` | **B3** | `Batch 5.1` | 主方案点名 B 档首屏减负页（§2.3/§2.9 得分 5.0–5.5）；将 `L155-257` 首屏字节回退/MTP/多模态占位符/结构化掩码移入边界区 |
| 115 | `wiki/concepts/ucm.md` | `feature` | 594 | 98 | `0 / 1 / 0` | **B3** | `Batch 5.3` | 594 行大页；保留三层外部前缀缓存主干，收拢次要存储介质分支，归并 `L534` 补丁 |
| 116 | `wiki/concepts/vllm-ascend-for-rl.md` | `feature` | 360 | 57 | `4 / 1 / 0` | **A** | `Batch 5.5` | RL 推理后换权重主干清晰；归并 `L329` 补丁，还原 4 处纯文本来源 |
| 117 | `wiki/concepts/vllm-ascend-overview.md` | `concept` | 231 | 52 | `7 / 1 / 0` | **A** | `Batch 5.5` | `vllm-ascend` 接入总览简明；归并 `L201` 补丁，还原 7 处纯文本来源 |
| 118 | `wiki/concepts/vllm-ascend-repo-map.md` | `concept` | 200 | 22 | `10 / 1 / 0` | **A** | `Batch 5.5` | 源码目录地图清晰；归并 `L160` 补丁，还原 10 处纯文本来源 |
| 119 | `wiki/concepts/vllm-engine-core.md` | `concept` | 352 | 40 | `1 / 3 / 0` | **A** | `Batch 5.5` | `EngineCore` 主循环清晰；归并 `L310/312/313` 补丁，还原 `L351` 纯文本来源 |
| 120 | `wiki/concepts/vllm-kv-block-allocation.md` | `concept` | 419 | 59 | `7 / 1 / 0` | **A** | `Batch 5.5` | KV 块借出/共享/归还主干清晰；归并 `L365` 补丁，还原 7 处纯文本来源 |
| 121 | `wiki/concepts/vllm-platform-interface.md` | `concept` | 289 | 46 | `12 / 2 / 0` | **A** | `Batch 5.5` | `Platform` 接口契约清晰；归并 `L244/275` 补丁，还原 12 处纯文本来源 |
| 122 | `wiki/concepts/vllm-scheduler.md` | `concept` | 462 | 105 | `14 / 1 / 0` | **A** | `Batch 5.5` | `Scheduler` 排步主干清晰；归并 `L388` 补丁，还原 14 处纯文本来源 |
| 123 | `wiki/concepts/vllm-v1-shape.md` | `concept` | 365 | 50 | `4 / 1 / 0` | **A** | `Batch 5.5` | vLLM V1 组件循环主干清晰；归并 `L305` 补丁，还原 4 处纯文本来源 |
| 124 | `wiki/params/absolute-balance-threshold-71578a0c428d.md` | `param` | 185 | 25 | `2 / 2 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L89/99` 首句劫持，还原 2 处来源 |
| 125 | `wiki/params/block-table-no-commit-optimize-8328d0d2d00d.md` | `param` | 137 | 16 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L61` 首句劫持，还原 `L112` 来源 |
| 126 | `wiki/params/c8-enable-reshape-optim-8bd7e5f82c6c.md` | `param` | 232 | 46 | `3 / 2 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L123/127` 首句劫持，还原 3 处来源 |
| 127 | `wiki/params/combine-quant-mode-2a3f7cd47997.md` | `param` | 237 | 39 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L144` 首句劫持，还原 `L236` 来源 |
| 128 | `wiki/params/cross-node-transfer-limit-06ee92260b7a.md` | `param` | 164 | 25 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L77` 首句劫持，还原 `L152` 来源 |
| 129 | `wiki/params/enable-async-exponential.md` | `param` | 188 | 24 | `1 / 6 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L76-82/141-143` 版本补丁段与首句劫持，还原 `L82` 纯文本来源 |
| 130 | `wiki/params/enable-force-eplb-b7ec3661121f.md` | `param` | 259 | 41 | `9 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L142` 首句劫持，还原 9 处来源 |
| 131 | `wiki/params/enable-matmul-allreduce.md` | `param` | 234 | 32 | `4 / 4 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L86/92/140/179` 补丁与首句劫持，还原 4 处纯文本来源 |
| 132 | `wiki/params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md` | `param` | 199 | 35 | `2 / 2 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L127/131` 首句劫持，还原 2 处来源 |
| 133 | `wiki/params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md` | `param` | 258 | 44 | `10 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L147` 首句劫持，还原 10 处来源 |
| 134 | `wiki/params/enable-sleep-mode-extra-cleanup.md` | `param` | 247 | 52 | `4 / 4 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L113/172-175` 补丁与首句劫持，还原 4 处纯文本来源 |
| 135 | `wiki/params/enable-super-kernel-ce990e186bfa.md` | `param` | 225 | 37 | `1 / 1 / 0` | **C0** | `Batch 0` | 包 3 首批参数样板（`03-enable-super-kernel-ce990e186bfa.md` 已通过预检）；刷新 `__init__` 谱系消除 `v0.26` 前后矛盾，移除 `L110` 首句劫持与重复 validator |
| 136 | `wiki/params/fuse-allreduce-rms.md` | `param` | 209 | 33 | `0 / 5 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L84/92/123/129/147` 补丁与首句劫持 |
| 137 | `wiki/params/fused-op-type-fc0f5fcd7be0.md` | `param` | 210 | 36 | `4 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L103` 首句劫持，还原 4 处来源 |
| 138 | `wiki/params/kvpp-config-0445bd352140.md` | `param` | 218 | 38 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L131` 首句劫持，还原 `L188` 来源 |
| 139 | `wiki/params/layer-sharding.md` | `param` | 234 | 49 | `3 / 1 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L102` 首句劫持，还原 3 处纯文本来源 |
| 140 | `wiki/params/load-risk-quantile-d89a080ba048.md` | `param` | 197 | 27 | `4 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L94` 首句劫持，还原 4 处来源 |
| 141 | `wiki/params/load-window-bins-cc21068b082d.md` | `param` | 184 | 23 | `5 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L82` 首句劫持，还原 5 处来源 |
| 142 | `wiki/params/multistream-overlap-gate.md` | `param` | 221 | 37 | `4 / 3 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L88/94/154` 补丁与首句劫持，还原 4 处纯文本来源 |
| 143 | `wiki/params/placement-search-backtrack-limit-82b03cef98b0.md` | `param` | 165 | 22 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L81` 首句劫持，还原 `L164` 来源 |
| 144 | `wiki/params/prefetch-ratio.md` | `param` | 224 | 43 | `3 / 1 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L97` 首句劫持，还原 3 处纯文本来源 |
| 145 | `wiki/params/profiling-chunk-config.md` | `param` | 275 | 57 | `1 / 3 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L129/145/249` 补丁与首句劫持，还原 `L253` 纯文本来源 |
| 146 | `wiki/params/rank-transfer-limit-99529b37d91d.md` | `param` | 174 | 22 | `3 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L83` 首句劫持，还原 3 处来源 |
| 147 | `wiki/params/relative-balance-threshold-bcbc40e7dc87.md` | `param` | 163 | 20 | `2 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L79` 首句劫持，还原 2 处来源 |
| 148 | `wiki/params/replica-search-beam-size-6556d1650a62.md` | `param` | 156 | 18 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L74` 首句劫持，还原 `L155` 来源 |
| 149 | `wiki/params/replica-search-num-stages-e4b10925ff97.md` | `param` | 180 | 19 | `2 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L76` 首句劫持，还原 2 处来源 |
| 150 | `wiki/params/replica-search-radius-cd3118b5aae5.md` | `param` | 159 | 17 | `1 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L76` 首句劫持，还原 `L158` 来源 |
| 151 | `wiki/params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md` | `param` | 259 | 51 | `4 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L158` 首句劫持，还原 4 处来源 |
| 152 | `wiki/params/size-40a1c2ca47b8.md` | `param` | 179 | 25 | `3 / 1 / 0` | **A** | `Batch 5.4` | 消除裸标题 `size`（§2.6），以 `<parent>.<leaf>`（如 `npu_compilation_config.size`）展示并保留稳定 `id`，移除 `L84` 劫持 |
| 153 | `wiki/params/stair-config-cca9e594a052.md` | `param` | 185 | 30 | `2 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L90` 首句劫持，还原 2 处来源 |
| 154 | `wiki/params/use-fused-overlap-75a180fff6ab.md` | `param` | 288 | 57 | `4 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L181` 首句劫持，还原 4 处来源 |
| 155 | `wiki/params/use-layerwise-b475778cd352.md` | `param` | 240 | 42 | `6 / 1 / 0` | **A** | `Batch 5.4` | `<parent>.<leaf>` 展示解耦（保留 `id`），`__init__` 谱系同步，移除 `L118` 首句劫持，还原 6 处来源 |
| 156 | `wiki/params/weight-prefetch-config.md` | `param` | 298 | 73 | `18 / 2 / 0` | **A** | `Batch 5.4` | `__init__` 谱系同步，移除 `L131/135` 补丁与首句劫持，还原 18 处纯文本来源 |
| 157 | `wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md` | `source` | 175 | 26 | `9 / 0 / 0` | **A** | `Batch 5.4` | 问答沉淀档案页；保护档案内容，待包 4 `legacyIds` 就绪后可挂语义别名，还原 9 处纯文本来源 |
| 158 | `wiki/sources/ascend-config-version-source.md` | `source` | 169 | 35 | `10 / 0 / 0` | **A** | `Batch 5.4` | 四版本来源摘要档案页；保护原摘录主干，还原 10 处纯文本来源 |
| 159 | `wiki/sources/glm-5-3-flash-baseline.md` | `source` | 204 | 30 | `3 / 0 / 0` | **A** | `Batch 5.4` | 官方双机配置基线档案页；保护原基线主干，还原 3 处纯文本来源 |
| 160 | `wiki/sources/glm-mlp-version-source.md` | `source` | 106 | 14 | `2 / 0 / 0` | **A** | `Batch 5.4` | 稠密 MLP 固定版本源码摘录；保护原摘录主干，还原 `L104/105` 纯文本来源 |
| 161 | `wiki/sources/pr-11953.md` | `pr` | 127 | 12 | `2 / 0 / 0` | **A** | `Batch 5.4` | PR 档案页；保护原 PR 事实记录，还原 `L81/119` 纯文本来源 |
| 162 | `wiki/sources/rfork-official-guide.md` | `source` | 204 | 24 | `2 / 0 / 0` | **A** | `Batch 5.4` | 修复 `toc.ts:225` 先判 `rfork-` 前缀早于 `p.type === "source"` 导致的目录错位（§2.6/§6.5），还原 `L157/203` 来源 |
| 163 | `wiki/sources/v030rc2-baseline.md` | `source` | 83 | 16 | `1 / 0 / 0` | **A** | `Batch 5.4` | `v0.30.0rc2` 版本基线档案页；保护原基线说明，还原 `L82` 纯文本来源 |

---

## 四、 19 篇含 `wiki-scene` 围栏页面冻结保护核对清单（共 23 处围栏）

按大当家 `0001794686279157-000033-028dfa06` 与主方案 §1.1 / §6.6 硬性约束，以下 **19 篇正式页（23 处 `wiki-scene` 围栏）** 在所有批次（`Batch 0` 及 `Batch 5.1`–`Batch 5.5`）中**严格保持 `wiki-scene` 围栏标识、场景文件与强绑定教学算例冻结不变**：

1. `#2` `wiki/concepts/ai-core.md`（`L103`，`A` 档）
2. `#12` `wiki/concepts/attention-qkv.md`（`L203`，`B3` 档——仅在单卡算例与 `L203` 双卡场景间补文字/2D 过渡，不动围栏）
3. `#16` `wiki/concepts/block-table.md`（`L133`，`A` 档）
4. `#18` `wiki/concepts/chunked-prefill.md`（`L194`，`C` 档 / `Batch 0` 调度样板——保留 `inference-mechanism:7` 与 `A/B+C(14→6,6,2)` 算例）
5. `#19` `wiki/concepts/collective-communication.md`（`L152`，`A` 档）
6. `#21` `wiki/concepts/context-parallel.md`（`L163, L239, L323` 共 3 处，`B3` 档）
7. `#23` `wiki/concepts/data-parallel.md`（`L288`，`A` 档）
8. `#34` `wiki/concepts/expert-parallel.md`（`L357`，`B1` 档）
9. `#38` `wiki/concepts/glm-5-3-flash.md`（`L147, L153, L213` 共 3 处，`C1` 档）
10. `#49` `wiki/concepts/kv-cache-cpu-offload.md`（`L205`，`A` 档）
11. `#66` `wiki/concepts/matmul-and-weights.md`（`L154`，`A` 档）
12. `#68` `wiki/concepts/mlp-residual-norm.md`（`L271`，`B3` 档）
13. `#76` `wiki/concepts/one-request.md`（`L267`，`C1` 档）
14. `#79` `wiki/concepts/pd-disaggregation.md`（`L309`，`B1` 档）
15. `#80` `wiki/concepts/pipeline-parallel.md`（`L130`，`A` 档）
16. `#87` `wiki/concepts/quantization.md`（`L228`，`A` 档 / `Batch 0` 主干保护样板——保留前 342 行成熟主干、`inference-mechanism:5` 与 `[0.523, -0.31, 1.27]` 算例）
17. `#104` `wiki/concepts/sequence-parallel.md`（`L146`，`A` 档）
18. `#112` `wiki/concepts/tensor-layout.md`（`L131`，`A` 档）
19. `#113` `wiki/concepts/tensor-parallel.md`（`L292`，`B1` 档）
