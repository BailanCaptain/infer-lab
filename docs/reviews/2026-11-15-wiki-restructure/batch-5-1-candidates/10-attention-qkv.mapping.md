# `attention-qkv.md` 候选稿三出口事实去向账本（`10-attention-qkv.mapping.md`）

## 1. 基线与候选文件对齐

- **当前正式文件**：[wiki/concepts/attention-qkv.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/attention-qkv.md)（共 454 行）
- **候选文件**：[10-attention-qkv.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/batch-5-1-candidates/10-attention-qkv.md)（共 454 行）
- **Frontmatter 元数据**：100% 保持原值（`id: attention-qkv`、`origin: gap`、**27 条 `sources`**、3 条 `verified`、`evidence: C`、3 条 `relations`、2 条 `rawSources`）。
- **跨页锚点保护**：原页全部 **19 个 H2/H3 标题**（11 个 H2 + 8 个 H3）100% 保留（`headersRemoved: []`），确保被 `one-request.md`、`layers-and-hidden.md`、`kv-cache.md`、`mla.md`、`linear-attention.md`、`tensor-parallel.md` 等引用的锚点零断链。
- **冻结 3D 场景与 2D 图 / `calc` 块保护**：原页冻结 3D 场景 `inference-mechanism:0`（原 `L201-L207`，候选稿 `L203-L209`）及其导引文案与段号跳转链接（`#/model?view=play&segment=31`、`segment=32`）100% 原样保留；全部 7 处 `wiki-diagram` 与 5 个 `calc` 块 100% 保留。

## 2. 段落级三出口映射表（保留 / 迁移目标 / 证伪删除）

| 原文位置（`wiki/concepts/attention-qkv.md`） | 事实 / 数值 / 条件内容 | 出口类型 | 候选稿位置（`10-attention-qkv.md`）或去向说明 |
|---|---|---|---|
| `L1-L102` | Frontmatter（`id: attention-qkv`、`title`、`summary`、`aliases`、`chapters: ['04']`、`order: 60`、**27 条 `sources`**、3 条 `verified`、`evidence: C`、3 条 `relations`、2 条 `rawSources`） | **保留（原位）** | `L1-L102`：100% 原样保留。 |
| `L104-L200` | `## attention 是什么？`、`## 为什么需要 attention，代价在哪？`、`## attention 怎么算？跟着一个位置走一遍`（3 位置 4 维手算 `o₂ = [0.76, 0.33, 1.58, 0.42]`）及 `## 所有位置一起算：写成矩阵`（`softmax(QKᵀ/√d_k)·V`、减行最大值防溢出、相邻概念表） | **保留（原位）** | `L104-L200`：100% 原样保留。 |
| `L201-L207` | 冻结 3D 场景 `inference-mechanism:0` 及其前导八位置四通道 [DCP](context-parallel.md) 算例说明（`L201`）与后承 `#/model?view=play&segment=31` / `32` 链接（`L207`） | **保留（补入过渡 + 原文零改动）** | `L201-L209`：在相邻概念表后补入 2 句过渡（`L201`：历史扩成 8 位置仍按相同步骤计算；在这同一组 8 位置输入上，只将 K/V 分存两卡并正确合并，结果与单卡完整计算一致），并 100% 逐字保留原 `L201-L207`（现 `L203-L209`）。 |
| `L209-L267` | `## Q、K、V 从哪里来，各管什么`、`## 为什么要除以 √d`（方差 `d`、标准差 `√d`、`d=256` 时 `e¹⁶ ≈ 8,886,111` vs `e¹ ≈ 2.72` `calc`）及 `## 因果掩码限定每个位置能访问的历史` 位置 1 遮与不遮 `calc` | **保留（原位）** | `L211-L267`：100% 原样保留。 |
| `L269` | 上下文并行（CP）路径在索引器已限制可见位置且局部 KV 与全局查询坐标重映射后，后续算子关闭二次因果裁剪（`sparse_mode=0`）不等于允许访问未来位置的边界说明 | **保留（延后至本节末尾）** | `L283`：从位置 1 单卡手算 `calc`（`L267`）与 Prefill/Decode 因果掩码说明（`L271`）之间移至 `## 因果掩码限定每个位置能访问的历史` 末尾（`L283`），使单卡算例连续过渡到 `attention-causal` 与 `[T, S]` 维度说明，同时 100% 保留该实现边界。 |
| `L271-L281` | Prefill 整段送入与 Decode 逐步生成的因果掩码（`attention-causal`）、KV cache 只存 K/V 不存 Q、查询数 `T` 与可见历史 `S` 两个维度 | **保留（原位）** | `L269-L281`：紧接 `L267` 连续展开，100% 原样保留。 |
| `L283-L413` | `## 多头：同一个位置同时按几套方式去读`（`h=2` `calc`、矩阵拼合与 GQA）、`## 落到 GLM 双机：两类 attention 各改了哪一步`（`34` 层 KDA + `11` 层稀疏 MLA、`512` 维潜向量、矩阵吸收、`1/√256 = 0.0625`、`2,051` 上限、BF16 共享 KV 约束、KDA `128×128` 状态与 `1/√128 ≈ 0.0884`、三种形式对照表、R1 `32,768 B` All-Reduce）、`## 常见误解` 9 条及 `## 对照源码` 前三小节（含 `sparse_mode=3` 右下对齐因果掩码与报错表） | **保留（原位）** | `L285-L415`：100% 原样保留全部数值、公式、图表与适用条件。 |
| `L415-L428` | `### 版本差异`（原 `L417` 粗体 `v0.30.0rc2` 补丁段 + 原 `L419-L428` 三版本表与说明） | **保留（并入四版本表）** | `L417-L428`：将 `v0.30.0rc2`（`vllm@ced6857a` / `vllm-ascend@7d825229`）并入四版本对照表第 4 列，第 5 列 `main` 显式锚定 `与 v0.23 / v0.26 相同（attention.py#L225-L258）` 及 `models/glm5next/` 对应实现（避免歧义“同上”），并在表下完整保留 KDA 六投影 GEMM 合并、MLA 低秩投影合并、YaRN 修正边界与未做整套运行核验的说明。 |
| `L430-L454` | `### 源码位置`（6 行源码入口表、`**来源与结论对应：**` 10 条及 26 处行内角标、`**待核：**`） | **保留（原位）** | `L430-L454`：100% 原样保留。 |

## 3. 证伪删除项

- **无（0 项删除）**：本候选稿未删除任何源码事实、公式、表格或适用前提。
