# 07-speculative-decoding.mapping.md

- **sourcePath**: `wiki/concepts/speculative-decoding.md` (`737` 行)
- **candidatePath**: `docs/reviews/2026-11-15-wiki-restructure/batch-5-2-candidates/07-speculative-decoding.md` (`737` 行)
- **grade**: `B1`（`需要结构重整、删改或重写`）
- **headersRemoved**: `[]`（原稿 12 个 H2 与 10 个 H3 标题字符串，共 22 个标题 100% 逐字保留，无任何删除或改名）
- **sourcesPreserved**: Frontmatter `sources` 182 条（`L53-L242`，含 `L68, L81, L83, L85, L87, L114, L116, L125` 8 处 `>-` 折行）、`verified` 3 条（`L243-L246`）、`relations` 3 条（`L248-L257`）、`rawSources` 0 条，以及文末全部 `29` 处行内角标（`23` 处 `[C...]`、`5` 处 `[S...]`、`1` 处 `[D]`）与 `来源 ...` 标注 100% 保留。
- **diagramsAndCalcPreserved**: 2 处 `wiki-diagram`（`speculative-decoding` `L271`、`speculative-decoding-flow` `L494`）与 6 处 `calc` 块（`L290`、`L348`、`L428`、`L452`、`L476`、`L520`）100% 逐字保留。

## 段落级行号映射与收口说明

| 原稿行号 (`wiki/concepts/speculative-decoding.md`) | 候选稿行号 (`07-speculative-decoding.md`) | 动作与原因 |
|---|---|---|
| `L1-L261` | `L1-L261` | **逐字节保留**：完整保留 frontmatter（`id`、`title`、`summary`、`aliases`、`chapters`、`order`、182 条 `sources`、3 条 `verified`、3 条 `relations` 等）。 |
| `L263-L563` | `L263-L563` | **保留正文主线并恢复代码反引号**：完整保留概念引入、权重复用账、一轮 5 步、Greedy 与拒绝采样证明（含 `### block verify 和 entropy verify 还能套用这份证明吗？`）、候选来源与三节扩展 H3、被拒位置 KV/KDA 递推状态收场、慢化条件与 `### 日志里的“接受率”应该怎样读？`、调度与图模式配合、GLM 双机单请求/多请求落点及 `## 常见误解`，恢复被剥离的参数/类型代码反引号。 |
| `L564-L593` | `L564-L593` | **保留 `### 怎么开` 核心参数表与 GLM 启动示例**：保留 5 项核心参数表、CLI/Python 合并互斥规则、GLM 双机 `--speculative-config` 命令、`None` 与 `{}` 区别及 K 缺省回填规则，恢复参数名反引号。 |
| `L600-L610` | `L594-L605` | **上移收拢 GLM MTP 专属开关**：将 `**草稿 eager 看实际执行顺序。**`、GLM 草稿 `enforce_eager` 行为表及昇腾 `additional_config.rejection_sampler_config` 紧接在 K 的规则之后，使 GLM 双机 MTP 的 5 项参数与验证开关在同一连续段落内讲完，不再被异构草稿方法打断。 |
| `L594-L599` | `L606-L611` | **后置通用方法枚举与异词表边界**：将 `**方法名合法，不等于当前 Ascend 支持对应模型。**`、`model` 类路径识别边界及 `**词表兼容也要看实际草稿器。**`（`use_heterogeneous_vocab`）移至 GLM MTP 参数之后，自然引出下方 `**换草稿方法时，还要看哪些配置？**`。 |
| `L612-L737` | `L612-L737` | **保留其余配置、报错、开销、版本差异与源码位置**：完整保留 `ngram`/`suffix`/`parallel_drafting` 参数表、`--per-request-spec-decode-metrics`、`### 会报什么错`、`### 开销和什么时候别开`、`### 版本差异` 三张对照表及 `### 源码位置` 证据归档，恢复正文被剥离的代码反引号。 |
