# `mlp-residual-norm.md` 候选稿三出口事实去向账本（`11-mlp-residual-norm.mapping.md`）

## 1. 基线与候选文件对齐

- **当前正式文件**：[wiki/concepts/mlp-residual-norm.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/mlp-residual-norm.md)（共 446 行）
- **候选文件**：[11-mlp-residual-norm.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/batch-5-1-candidates/11-mlp-residual-norm.md)（共 441 行）
- **Frontmatter 元数据**：100% 保持原值（`id: mlp-residual-norm`、`origin: gap`、**37 条 `sources`**、`verified: []`、`evidence: C`、5 条 `relations`、3 条 `rawSources`）。
- **跨页锚点保护**：原页全部 **24 个 H2/H3 标题**（6 个 H2 + 18 个 H3）100% 保留（`headersRemoved: []`），确保被 `layers-and-hidden.md`、`attention-qkv.md`、`moe.md`、`tensor-parallel.md`、`matmul-and-weights.md` 等引用的锚点零断链。
- **冻结 3D 场景与 2D 图 / `calc` 块保护**：原页冻结 3D 场景 `model-compute:2`（`L271-L273`）及其绑定的 `4 → 6 → 4` 独立示意算例说明（`L267-L269`）与前文 `2 → 4 → 2` 手算 `calc`（`L244-L265`）100% 逐字原样保留；全部 4 处 `wiki-diagram`（`mlp-residual-layer`、`mlp-swiglu-calc`、`gated-ffn`、`mlp-residual-norm-flow`）与 3 个 `calc` 块 100% 保留。

## 2. 段落级三出口映射表（保留 / 迁移目标 / 证伪删除）

| 原文位置（`wiki/concepts/mlp-residual-norm.md`） | 事实 / 数值 / 条件内容 | 出口类型 | 候选稿位置（`11-mlp-residual-norm.md`）或去向说明 |
|---|---|---|---|
| `L1-L113` | Frontmatter（`id: mlp-residual-norm`、`title`、`summary`、`aliases`、`chapters: ['03']`、`order: 70`、**37 条 `sources`**、`verified: []`、`evidence: C`、5 条 `relations`、3 条 `rawSources`） | **保留（原位）** | `L1-L113`：100% 原样保留。 |
| `L115-L190` | `## 一个子层怎样更新 hidden，又不丢掉原来的输入？`（`mlp-residual-layer`）、`## 为什么要这条旁路和归一化，代价在哪？` 下的 `### 残差连接保留一条输入路径`、`### RMSNorm 怎样调整向量尺度`（`x = [3, 4]` `RMSNorm` vs `LayerNorm` `calc`）与 `### 归一化为什么放在支路入口`（`post-norm` vs `pre-norm`、RAdam 反例、GPT-2 vs GLM 最终归一化） | **保留（原位）** | `L115-L190`：100% 原样保留。 |
| `L191-L207` | `### Q/K Norm：先按头归一化，再加入位置`（`Qwen3 / Transformers v4.51.3` 逐头 RMSNorm、共享 `2dₕ` 增益参数、与子层入口 `pre-norm` 对照表，以及 GLM 双机处理低秩向量的边界说明） | **保留（开头点明变体定位与 `000406` P3 范围限定）** | `L191-L207`：在 `L193` 开头直接以 `Qwen3 / Transformers v4.51.3` 在注意力支路内部加入的逐头 RMSNorm 为例（与每个子层入口都做的 `pre-norm` 对照），并在 `L193` 与 `L207` 明确写出“GLM 的稀疏 MLA 支路（11 层稀疏 MLA）”走注意力内部低秩向量 RMSNorm，避免泛化成 GLM 全部 34 层 KDA 也用低秩 RMSNorm；同时 100% 保留 `L193-L207` 全部事实。 |
| `L209-L273` | `### MLP 为什么值得占一半子层`、`## 前馈网络怎样变换一个位置的特征`（`### 普通两投影 MLP`、`### 门控 MLP：SwiGLU`、`mlp-swiglu-calc`、`2 → 4 → 2` 手算 `calc`）及冻结 3D 场景 `model-compute:2`（`4 → 6 → 4` 算例 `L267-L273`） | **保留（原位，冻结 3D 零改动）** | `L209-L273`：100% 逐字原样保留。 |
| `L275-L399` | `### 限幅：gate 只限上界，up 两边都限`（`swiglu_limit = 10` `calc`、`gated-ffn`）、`### 中间宽度 F`（`12288` vs `2048`）、`## 到 GLM 双机：R1 的一个 token 怎样走过这三件东西？`（`mlp-residual-norm-flow`、mHC 四条流、前 3 层稠密 MLP `32,768 B` All-Reduce、后 42 层 MoE `288 + 1`）、`## 哪几层和一般走法不一样？`（第 0/44 层、MTP 块外 3 次 RMSNorm、稀疏 MLA 内部 `1536/512` 低秩 RMSNorm）、`## 常见误解` 10 条及 `## 对照源码` 前三小节 | **保留（原位）** | `L275-L399`：100% 原样保留。 |
| `L400-L416` | `### 版本差异`（原 `L402` 粗体 `v0.30.0rc2` 补丁段 + 原 `L404-L415` 三版本表与说明） | **保留（并入四版本表并区分核验范围）** | `L400-L413`：将已核对的 `v0.30.0rc2：7d825229`（`model.py#L90-L138`、`#L324-L349`、`#L499-L514` 与 `shared_experts.py#L437-L453`）并入四版本对照表第 4 列，未对 `rc2` 单独重核的 `utils.py` 注册键行显式标明核验范围，第 5 列 `main：baa023ad` 显式写出对应行为，并在表下完整保留 SP `reduce_results=False`、共享专家多流重叠预量化与 mHC 入口 RMSNorm 合并说明。 |
| `L417-L446` | `### 源码位置`（阅读顺序、激活与归一化实现、版本表来源分组、来源与结论对应、固定分派与验证边界、28 处行内角标 `22 C + 6 S` 及原页末 `L446` 的 `来源 36` 说明） | **保留（收拢页末孤立句）** | `L415-L441`：在 `L421` 补入 `v0.30.0rc2` 对应来源 `30–33`，并将原页末孤立的 `L446`（`来源 36 的 535–613 行...`）收拢进 `固定分派与验证边界` 第 2 条（`L440`），使未验证运行边界自然收尾；全部 28 处行内角标（`<= 30`，`C` 占比 `22/28 = 78.6% <= 80%`）100% 保留。 |

## 3. 证伪删除项

- **无（0 项删除）**：本候选稿未删除任何源码事实、公式、表格或适用前提。
