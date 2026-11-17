# 候选稿 04 基线与章节改动映射：`inference-troubleshooting`

## 1. 权威基线与候选稿标识（由 `042-candidate-second-review.json` 与实际文件核定）

- **正式页面路径**：`wiki/concepts/inference-troubleshooting.md`
  - **正式页 SHA-256**：`ae2646d352daad0352369ed59aec86269a53863b430c3075f0e9d7d3d78c1954`
  - **正式页规模**：`235` 行，`12` 条 `sources`
- **候选稿路径**：`docs/reviews/2026-11-15-wiki-restructure/candidates/04-inference-troubleshooting.md`
  - **候选稿 SHA-256**：`2d867562d3a875a76ad26bab35872522a2bb70aabd752626350a455805a5438c`
  - **候选稿规模**：`230` 行，`13` 条 `sources`（前 12 条 `sources` 与正式页严格前缀一致；末尾 `L42` 追加第 13 条 `vllm-ascend@7d825229:vllm_ascend/xlite/xlite.py#L592-L593` `[C13]`）
  - **结构不变量核验**：除 `sources` 外全部 Frontmatter 字段相同；2 张 `wiki-diagram`（`inference-troubleshooting-boundary`、`inference-troubleshooting-experiment`）及请求 `R` 教学示例段（正式 `L61-L102` → 候选 `L62-L103`）与正式页 100% 一致（`exampleBodyUnchanged: true`）。

## 2. H2 / H3 标题链与实际改动对照

| 标题链 | 正式页起点 | 候选稿起点 | 处置类型 | 经核实的实际改动说明 |
|---|---|---|---|---|
| 开篇、`## 同样是“没有回答”，为什么要走不同的路`、`## 把“没反应”变成能继续查的一条记录` | `L61`、`L65`、`L77` | `L62`、`L66`、`L78` | `verbatim` | 正式 `L61-L102` 与候选 `L62-L103` 100% 逐字节相同。 |
| `## 按已经确认的阶段继续查`（导览表 + 10 个 H3 分支） | `L103`（H3 为 `L105`–`L177`） | `L104`（导览表 `L106-L121`，H3 为 `L123`–`L174`） | `editorial` | 在候选 `L106-L121` 新增「十类故障 10 秒快速分流索引表」与过渡句；下方 10 个 H3 标题完全保持原名原序，内部段落合并为「适用现象 → 首取最小证据 → 隔离区分实验与下一站」结构化要点，并为退出码 `137`、数值标识 `NaN` 补反引号，不删减原条件、反例与跨页链接。 |
| `## 证据不足时，下一步应该有多具体`、`## 放到 GLM 双机，哪些前提先不要改`、`## 常见误解`、`## 对照源码` 下 `### 怎么开` / `### 会报什么错` / `### 开销和什么时候别开` | `L183`、`L189`、`L195`、`L201`（`L203`、`L209`、`L213`） | `L179`、`L185`、`L191`、`L197`（`L199`、`L205`、`L209`） | `verbatim` | 正式 `L183-L216` 与候选 `L179-L212` 逐字相同。 |
| `### 版本差异` | `L217` | `L213` | `editorial` | 将正式 `L219` 独立粗体段合入候选 `L214-L220` 五行版本对照表的 `社区 v0.30.0rc2 7d825229` 行，并在候选 `L223` 展开 `MRV1`/`MRV2`、`PCP`、`DCP`、`KPool`、`SFA-only DSA-CP`（含 `DSA` 即 `DeepSeek Sparse Attention` `[C13]`）全称与固定源码位置，合并正式 `L228` 收尾句。 |
| `### 源码位置` | `L230` | `L225` | `verbatim` | 正式 `L230-L235` 与候选 `L225-L230` 逐字相同。 |
