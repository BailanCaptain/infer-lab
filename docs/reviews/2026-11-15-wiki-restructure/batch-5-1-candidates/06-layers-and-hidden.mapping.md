# `layers-and-hidden.md` → `06-layers-and-hidden.md` 旧事实三出口映射账本

- **原文件**：[wiki/concepts/layers-and-hidden.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/layers-and-hidden.md)（共 404 行）
- **候选文件**：[06-layers-and-hidden.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/batch-5-1-candidates/06-layers-and-hidden.md)（共 404 行）
- **标题与锚点保护**：原页全部 **19 个 H2/H3 标题**（9 个 H2 + 10 个 H3，含必保跨页锚点 `#一层接过什么交出什么glm-为什么在层间传四条`、`#为什么要四条流sinkhorn-又管什么代价在哪`、`#r1-的-hidden-一路走下来`、`#mhc-在-glm-上多花了什么`、`#本轮-hidden历史状态和权重各管什么`、`#版本差异`）100% 原序保留（`headersRemoved: []`）。
- **算例与 2D 图零丢失**：全部 6 个 `calc` 算式块（两次加回、起点加一路改变量、四条新流第 1 维汇合、连乘 90 次、Sinkhorn 第 1 轮、mHC 在 GLM 一次前向多做的事）与 5 张 `wiki-diagram`（`layers-what.yaml`、`layers-one-layer.yaml`、`layers-and-hidden-intuition.yaml`、`layers-sinkhorn.yaml`、`layers-stack.yaml`）100% 保留。

## 逐段三出口映射表

| 原行号 | 原内容摘要 | 出口分类 | 候选稿对应位置与说明 |
| --- | --- | --- | --- |
| `L1-L92` | frontmatter（`id: layers-and-hidden`、`origin: gap`、32 条 `sources`、4 条 `relations`、`verified: []`、`evidence: C`、2 条 `rawSources`） | **保留主文** | `L1-L92`：100% 原序保留 |
| `L94-L122` | `## hidden 是什么，一层又在做什么？` 与 `## 为什么要叠很多层，又为什么是「加回」？`（含 `layers-what.yaml`） | **保留主文** | `L94-L122`：100% 逐字原样保留 |
| `L123-L130` | `## 一层怎么算？跟着一条 hidden 走一遍`：RMSNorm 说明与 `x = [2, 1, 2, 0]` 导引 | **保留主文** | `L123-L129`：100% 原样保留，且 `L129` 直接紧接 `L131` 的 `layers-one-layer.yaml` 与四步手算 |
| `L131` | 在 `x = [2, 1, 2, 0]` 导引与 `layers-one-layer.yaml` 之间插入 `这里演示普通残差路径。GLM-5.3-Flash 还使用 mHC……` 分支说明 | **保留主文（收束至本节手算末尾过渡）** | `L154`：完整移至本节 `[T, 4]` 矩阵说明之后、下一节之前，100% 保留普通残差 vs mHC/MTP 的执行侧条件，消除对手算导引与图块的打断 |
| `L133-L155` | `layers-one-layer.yaml`、步骤 ①–④、两次加回 `calc` 与 `[T, 4]` 批量说明 | **保留主文** | `L131-L153`：100% 逐字原样保留 |
| `L156-L353` | `## 很多层叠起来`、`## 一层接过什么、交出什么？GLM 为什么在层间传四条？`、`## 为什么要四条流，Sinkhorn 又管什么，代价在哪？`、`## 放到 GLM 双机：hidden 怎样穿过 45 层？`（含 5 个 H3 小节）、`## 常见误解` | **保留主文** | `L156-L355`：100% 逐字原样保留全部 5 个 `calc`、表格、图块与普通 TP/SP 关闭等条件，并在 `layers-sinkhorn.yaml` 与其后 `calc` 块之间补一句承上过渡语（`L232`） |
| `L354-L372` | `## 对照源码` → `### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开` | **移入版本差异与对照源码** | `L356-L374`：100% 逐字原样保留 |
| `L373-L388` | `### 版本差异`（首段粗体 `v0.30.0rc2` 补丁段 + 三版本表 `v0.23`/`v0.26`/`main` + 说明） | **移入版本差异与对照源码** | `L375-L388`：消除首段粗体补丁式写法，将 `v0.30.0rc2：7d825229` 直接并入对照表（扩为四版本列），100% 保留 90 次/1,800 轮非 kernel 数、延迟 `hc_post_pre`、SP 本地分片与 PP 携带延迟 `post`/`comb` 状态的全部条件 |
| `L389-L404` | `### 源码位置`（阅读顺序、参考实现、数值出处、3 条实现边界、MTP 缓冲与 SP 覆盖说明） | **移入版本差异与对照源码** | `L389-L404`：100% 保留全部源码说明，仅去重末行 `L404` 已在前文引过的 `[C5][C6][C7]` 重复角标（全文 25 处角标：`19 C + 4 S + 2 D = 25 <= 30`，`C` 占比 `76% <= 80%`） |
