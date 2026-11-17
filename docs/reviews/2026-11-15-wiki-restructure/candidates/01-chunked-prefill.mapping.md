# 01-chunked-prefill 改写映射说明（Old-vs-New Mapping）

- **正式版原文件（保持未改动）**：[chunked-prefill.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/chunked-prefill.md)（`350` 行，`51` 条 `sources`，`SHA256 = 54c0fce9a21c9de8cd99865da3ded8df39d8a1345bb63690d0a4afd33d94ce19`）
- **正式版 2D 图（保持未改动）**：[chunked-prefill-flow.yaml](file:///C:/Users/-/Desktop/infra-view-new/wiki/diagrams/chunked-prefill-flow.yaml)（`41` 行，`SHA256 = 54d5a06b118b1c0dbff67b6abda2a76949964df58a21ac9f9af3118f88c632b6`）
- **前置参考提炼稿（Task 558）**：[01-chunked-prefill.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/rewrite-briefs/01-chunked-prefill.md)（`131` 行，含 `000621`/`000632`/`000653` 校准后的 `L41`、`L108`、`L112`）
- **候选重写稿（Task 042）**：[01-chunked-prefill.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/candidates/01-chunked-prefill.md)（`366` 行，`56` 条 `sources`）
- **候选重画 2D 图（Task 042）**：[chunked-prefill-flow.yaml](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/candidates/chunked-prefill-flow.yaml)（`37` 行，`896×424` 四站交接与段末采样分流图）

## 1. 保留不动的契约与资产

1. **5 个入站 `#anchor` 标题完全保留**：
   - `#怎么切每一步都是同一道减法`（候选稿 `L165`）
   - `#历史状态必须跨段延续`（候选稿 `L229`）
   - `#细节切点单条上限和关掉分块`（候选稿 `L239`）
   - `#放到-glm-双机20000-个-token-的提示词分三步`（候选稿 `L252`）
   - `#怎么开`（候选稿 `L306`）
2. **首图 `chunked-prefill` 与冻结 3D 场景 `inference-mechanism:7` 保持不变**：
   - `chunked-prefill`（候选稿 `L114-L116`）
   - `inference-mechanism:7`（候选稿 `L225-L227`，保留配套工作例 `A/B` 各 1 个位置、`C` `14` 个位置按预算 `8` 切成 `6 + 6 + 2`）
3. **4 处 `calc` 交互块完全保留**：
   - `L128-L133`：`title: C 进来的那一步有多大（示意）`（不切一步算完 `1 + 1 + 14 = 16` 个位置 vs 切开每步最多 `1 + 1 + 6 = 8` 个位置）
   - `L151-L157`：`title: 切成三段，注意力的账怎样变（示意，普通因果注意力）`（不切可见历史范围计一次 `14` 个位置 vs 切开三段可见历史分别计一次 `6 + 12 + 14 = 32` 个位置，打分位置对恒为 `1 + 2 + … + 14 = 105` 对）
   - `L171-L177`：`title: C 的 14 个位置怎样切成 6、6、2（示意）`（第 1/2/3 步分别按 `min(14 − 0, 8 − 2) = 6`、`min(14 − 6, 8 − 2) = 6`、`min(14 − 12, 8 − 2) = 2` 切出 `6、6、2`）
   - `L276-L285`：`title: 20,000 token 提示词每一步借块（DP0，这一条请求）`（双机 `20,000` token 按 `8144 / 8144 / 3712` 三步推进时，full 组三步借块 `13 / 13 / 6` 块，尾状态组三步手里块数 `2,037 / 2,038 / 930` 块，KDA 三组始终 `12` 块）
4. **Frontmatter 契约**：
   - 保留原 `51` 条 `sources`（`L16-L72`）顺序与内容不变；新增 `sources` `52–55`（`L73-L76`）为 `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py` 四段（`#L259-L290`、`#L448-L501`、`#L767-L793`、`#L1121-L1132`），支撑五缓存组借块与归还；新增 `source` `56`（`L77`）为 `vllm-ascend@7d825229:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L190`，支撑 `v0.30.0rc2` batch invariance 限制；保留 `verified: []`、`relations`、`rawSources`。

## 2. 段落级前后对照与改进说明

| 候选稿位置 | 对应原版位置 | 对应提炼稿位置 | 改造要点 |
|---|---|---|---|
| `L106-L122` `## 一条很长的提示词，能不能分几步算完？` + 首图 `chunked-prefill` | `L96-L116` | 改动 1 (`L33-L45`) | 开篇给出单句机制定义；把原 `L105` 抢跑的“普通注意力 vs 线性注意力状态保存布局”移到后文 `L234`「历史状态必须跨段延续」第 2 点，让首屏从单句定义直入 `A/B + C(14 → 6, 6, 2)` 与保留首图 `chunked-prefill`。 |
| `L124-L163` `## 为什么要切：不切的话，一步会被一条长提示词撑大` + `## 代价在哪：首个 token 更晚，旧历史要再读几遍` | `L118-L161` | 改动 3 (`L55-L62`) + 条件簇 1 (`L108`) | 保留单步规模对比（`16` vs `8`）与因果历史范围账（`32` 个可见历史位置、`105` 个因果位置对）；说明中间段（`6 < 14`、`12 < 14`）每步末尾仍会做一次词表投影和采样，但因提示词未读完而将采样结果丢弃（带种子时回拨 RNG offset）；补齐“只有当剩余预算实际构成限制（未被单条上限或 KV 块余量先行卡住）时，调小预算才会缩小每步可排分块、可能让长提示词跨越更多步”的成立条件。 |
| `L165-L227` `## 怎么切：每一步都是同一道减法` + 伪代码 + `chunked-prefill-flow` + 3D `inference-mechanism:7` | `L163-L202` | 改动 2 (`L47-L53`) + 改动 4 (`L64-L81`) | 修复原 `L166-L171` 冒号与 `calc` 劈断；新增两队列简化伪代码（`L179-L208`），明确省略前缀缓存命中、异步输出占位（`num_output_placeholders = 0`）与借块回退的前提，使用真实字段 `req.num_tokens_with_spec`（含草稿候选的应算位置数）与 `req.num_tokens`，并体现“先保存步前位置与本步计划，排完一整步再统一前推 `num_computed_tokens`”的顺序；重画 `chunked-prefill-flow.yaml`（第 3 站完整输入同时送入普通/线性两类前向，前向完成后从顶边汇入第 5 站采样，再按本例第 2 段末 `12 < 14` 丢弃回拨 vs 第 3 段末 `14 == 14` 产出 `y₀` 左右分流）。 |
| `L229-L250` `## 历史状态必须跨段延续` + `## 细节：切点、单条上限和关掉分块` | `L204-L231` | 条件簇 4 (`L111`) | 融合普通注意力逐位置 K/V 与线性注意力固定大小递推状态两套跨段接力机制；保留物理块 `4` 与完整状态公共边界 `self.block_size` 区分、单条上限 `--long-prefill-token-threshold`、关闭分块与模型支持条件。 |
| `L252-L300` `## 放到 GLM 双机：20,000 个 token 的提示词分三步` + `## 常见误解` | `L233-L273` | 改动 4 (`L64-L81`) | 新增双机 `8144 / 8144 / 3712 / 4` 四步推进状态表（`L260-L265`），保留五缓存组借块 `calc`（`13 / 13 / 6` 与 `2,037 / 2,038 / 930`）及 8 条常见误解；`## 对照源码` 之上零机器角标。 |
| `L302-L366` `## 对照源码`（5 个 H3：`### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`、`### 版本差异`、`### 源码位置`） | `L275-L350` | 改动 5 (`L83-L102`) + 条件簇 2/3/5 (`L109-L112`) | 集中收纳全部机器角标与四版本矩阵（含 `v0.30.0rc2`）；写明 `vllm_ascend/utils.py#L1429-L1432` 的 `refresh_block_size` 对普通注意力模型打 `info` 日志并改块大小为 `128`（`L314`）；完整写出 `_build_attn_state` 局部四分支优先级、非 MTP `SpecDecoding -> ChunkedPrefill` 后置改写，以及“最后一段恰剩 `1` 个位置且同批其余请求也各排 `1` 个位置时命中 `DecodeOnly` / `SpecDecoding`”的反例（`L328`）。 |
