# load_window_bins 审查记录

## 写作记录（10-04）

写手：Opus 5.5。本记录是写手自查与交接，不替代独立审查。分工与版本核实同 [absolute-balance-threshold 的写作记录](absolute-balance-threshold-71578a0c428d-review.md#写作记录10-04)：本页是本写手 6 页里的第 5 页；STAIR 只在 `4d1412d1`，不在任何钉住版本。

**核过的事实与出处（均为 `4d1412d1`，除非另注）。**

- 默认 `64`：`ascend_config.py:218`；注释（压缩上游 EPLB 负载窗口、段均值与权重代表全部样本）：`:194-196`；范围 2–256 与报错原文：`:242-243`；布尔值报错 `:233-237`。
- 压缩：`num_bins = min(steps, max_bins)`、`boundaries = arange(num_bins+1) * steps // num_bins`、段均值 + 段步数：`policy/stair.py:85-98`；`plan_rebalance` 第一步调用：`:1003`。
- 均衡度与 p95（按步数加权的 nearest-rank）：`:157-168`；均值/方差/协方差按段加权、分母 N−1：`:113-122`。
- 上游窗口默认 1000 步：`vllm@0fc695fc:vllm/config/parallel.py:59-60`。
- 钉住版本报错：`db701c1f:ascend_config.py:837`；`baa023ad` `config_utils.py:43` `extra="forbid"`。

**[D] / [I]**：1000 步压 64 段每段 15 或 16 步（用 numpy 按源码同式算过）；窗口短于段数时不起作用；加权均值不变；方差只剩段间部分（全方差分解）；2 段时 p95 为较差一半；计算量与段数成正比为 [D]。平滑噪声、按时间切段保留协同起伏、64 段估 288×288 协方差偏噪为 [I]。无实测数。页面写明「接入后窗口实际多长取决于那时的上游配置」，没有把 1000 步写成 STAIR 的既定事实。

**lint**：保存后 `pnpm wiki:lint` 通过。

**跳过的内容**：无。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式，不套深入页骨架。

**分数：9 / 10。** P1 0 条，P2 1 条，P3 0 条。

**结构与格式。** 一句话 / 参数定义（自动生成）/ 事实表 / 为什么存在 / 开了的代价 / 版本谱系齐全；「骨架 / 待补」计数 0；frontmatter 合法。`git diff` 删除行只有骨架占位与旧 summary / updated。`pnpm wiki:audit` 退出码 0、本页无报错（来源 12 条）；`pnpm wiki:lint` 退出码 0。

**版本口径专项：通过。** `load_window_bins` 在 `bbb5672a`（#17511）已出现，引入 PR 写对；钉住四版都不含 `bbb5672a`。第 46 行写清钉住四版都没有、按 `4d1412d1` 描述、无运行时调用方；第 42 行用 vLLM v0.23.0 的 1000 步举例时，明说 STAIR 尚未接入、以后窗口多长看那时的上游配置，没有把 1000 步写成 STAIR 的既定事实 ✓。措辞瑕疵见 P2-1。

**逐条对源码。**
- `4d1412d1:ascend_config.py:218` 默认 64 ✓；注释 `:194-196` ✓；范围 2–256 报错原文 `stair_config.load_window_bins must be between 2 and 256`（`:242-243`）✓；布尔报错 ✓。
- 压缩：`stair.py:86-99` `num_bins = min(steps, max_bins)`、`boundaries = arange(num_bins+1) * steps // num_bins`、段均值 + 段步数 ✓；`plan_rebalance` 第一步调用 `:1003` ✓。窗口短于段数时每步一段 ✓；按步数加权的均值不变 ✓。
- p95：`:163-167` 按步数累加的 nearest-rank ✓；2 段时 `ceil(0.95N)` 必落在第二段 = 较差一半 ✓。均值 / 方差 / 协方差按段加权、分母 N−1：`:113-122` ✓。
- 上游窗口 1000 步：`vllm@0fc695fc:vllm/config/parallel.py:59-60` `window_size = 1000` ✓。1000 步压 64 段：自己按源码同式算，各段为 15 或 16 步 ✓。
- PR #17511 说明原文是 loss-aware chronological compression with exact bin weights，页面概括「按时间顺序压缩，每段权重精确」✓；PR 也写了 pure CPU，与「CPU 上的搜索」一致。
- 「调小均衡度偏高」：段内平均后每段 max / avg 不高于逐步值，成立，标 [D] ✓；「方差通常变小」用了「通常」✓；协方差偏噪标 [I] ✓。

**数字与效果。** 无虚构效果数字；GLM 只用 288 个路由专家与 64 段对比推「协方差偏噪」，标 [I]，没有当成实测 ✓。

**P2**
1. 第 46 行「存在范围」+ 版本谱系表：与 absolute_balance_threshold 同一问题——「只有 main 快照 `4d1412d1` 上有」与谱系表「main：有」（指最新 main）并读易误解。改法同该页：写「09-26 `bbb5672a` 起的 main 才有；钉住四版都没有；本页按 `4d1412d1` 描述」，并注明谱系表的 main 不是钉住的 `baa023ad`。

**跳过**：sources 区；对照源码节（本页无此节）；未截图（本批只抽 2 页截图）。

## 修订记录（10-04，写手）

- **P2-1 已改**：「存在范围」统一为「钉住四版都没有；2026-09-26 随 `bbb5672a`（PR #17511）进 main，此后一直保留（10-02 的 `4ebb3090` 默认值仍 64）；本页按 `4d1412d1` 描述」，注明谱系表的「main：有」指最新 main；补「次日 `a32719ef` 才接进 MRv2」；「STAIR 是……」后加父页 stair_config 链接。
- 复跑：`pnpm wiki:lint`、`pnpm wiki:audit` 退出码均 0。
