# `glm-5-3-flash.md` → `05-glm-5-3-flash.md` 旧事实三出口映射账本

- **原文件**：[wiki/concepts/glm-5-3-flash.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/glm-5-3-flash.md)（共 493 行）
- **候选文件**：[05-glm-5-3-flash.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/batch-5-1-candidates/05-glm-5-3-flash.md)（共 498 行）
- **标题与锚点保护**：原页全部 **19 个 H2/H3 标题**（14 个 H2 + 5 个 H3，含 `#mtp主干之外的第-45-层`、`#全模型形状总表`、`#参数量3133-亿里-97-是路由专家`、`#权重精度文件里怎么存加载后变成什么`、`#对照源码`、`#开销和什么时候别开` 等）100% 原序保留（`headersRemoved: []`）。
- **冻结 3D 场景与绑定算例零改动**：3 处 `wiki-scene`（`## 一层有两段计算，四条 residual 流贯穿两段` 中的 `model-compute:0`、`model-compute:3` 及其绑定的 4 通道 `[2,4,4,8]` → `[0.4,0.8,0.8,1.6]`、`[2,−2,4,−4]` 算例；`## KDA：把全部历史压进一个固定大小的矩阵` 末尾的 `model-compute:1` 及其绑定导引）100% 逐字原样保留。
- **2D 图与 `calc` 零改动**：全部 6 张 `wiki-diagram`（`glm-flash-overview`、`glm-flash-layer`、`glm-flash-indexer-flow`、`glm-flash-attention`、`glm-flash-moe`、`glm-flash-mtp-flow`）与 2 个 `calc` 算式块 100% 保留。

## 逐段三出口映射表

| 原行号 | 原内容摘要 | 出口分类 | 候选稿对应位置与说明 |
| --- | --- | --- | --- |
| `L1-L104` | frontmatter（`id: glm-5-3-flash`、`origin: gap`、39 条 `sources`、4 条 `relations`、`verified: []`、`evidence: C`、2 条 `rawSources`） | **保留主文** | `L1-L104`：100% 原序保留 |
| `L106-L113` | `## 先认识引擎要执行的模型`：张量/token 总括、KDA/稀疏 MLA/稠密 MLP/MoE 简介、部署前提与第 4 站链接 | **保留主文（补入 1 句 2A 基础积木总装衔接）** | `L106-L113`：保留全部原文句子，在首段末尾补入 1 句承接第 2 组基础积木（词向量、RMSNorm、四路残差 mHC、MoE、`lm_head`、MLA、稀疏注意力、线性注意力 KDA）的总装说明，零新增无条件数值 |
| `L114-L156` | `## 模型怎样产生下一个 token`（四步 + `glm-flash-overview`）与 `## 一层有两段计算，四条 residual 流贯穿两段`（`glm-flash-layer` + 冻结 3D `model-compute:0` 与 `model-compute:3` 及绑定 4 通道算例） | **保留主文** | `L114-L156`：100% 逐字原样保留 |
| `L157-L264` | `## 45 层怎样排`、`## KDA：把全部历史压进一个固定大小的矩阵`（含冻结 3D `model-compute:1`）、`## 稀疏 MLA：先把历史压短，再挑着读`（含可见完整池数限定、`glm-flash-indexer-flow`、`calc` `2048 + 3 = 2051`） | **保留主文** | `L157-L264`：100% 逐字原样保留 |
| `L265-L392` | `## 两类 attention 各自留下什么历史`、`## MoE：288 个专家里每次挑 8 个`、`## MTP：主干之外的第 45 层`（含 PP=1/无 `compress_ratios` 及 `min(num_actual_tokens, positions.shape[0])` vs FULL 图边界）、`## 全模型形状总表`、`## 参数量：3133 亿里 97% 是路由专家`、`## 权重精度`、`## 接下来把模型放进推理引擎` | **保留主文** | `L265-L392`：100% 逐字原样保留 |
| `L393-L430` | `## 对照源码` → `### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`（HF FP8 vs W8A8 `9e55cbc8`/`3121f187` 对照表及 11 行加载精度表） | **移入版本差异与对照源码** | `L393-L430`：100% 逐字原样保留 |
| `L431-L463` | `### 版本差异`（首段粗体 `v0.30.0rc2` 补丁段 + 3 段未分条说明 + 8 条基线/论文说明 + 参数量口径反推 `calc` + 待核与 `2c59ff10`/`2ed6cbba`/`baa023ad` 核实说明） | **移入版本差异与对照源码** | `L431-L468`：消除首段粗体补丁式写法，整理为四版本对照表（`v0.23`/`db701c1f`、`v0.26 rc`、`v0.30.0rc2`、`main`）+ 结构化分项，100% 保留全部版本条件、18B 反推 `calc` 与待核项 |
| `L464-L493` | `### 源码位置`（`690b7052`、池分数公式、MTP `is_rot_used=true` 与 `SharedHead.forward`、18 行源码表及补充核对） | **移入版本差异与对照源码** | `L469-L498`：100% 逐字原样保留（全文 29 处行内角标：`19 C + 6 S + 2 D + 2 I = 29 <= 30`，`C` 占比 `65.5% <= 80%`） |
