# absolute_balance_threshold 审查记录

## 写作记录（10-04）

写手：Opus 5.5。本记录是写手自查与交接，不替代独立审查。

**分工。** `wiki/params/` 里标「骨架，待补」的 12 页按页面 id 字母序排序，前 6 页归本写手：`absolute-balance-threshold-71578a0c428d`、`cross-node-transfer-limit-06ee92260b7a`、`fused-op-type-fc0f5fcd7be0`、`load-risk-quantile-d89a080ba048`、`load-window-bins-cc21068b082d`、`placement-search-backtrack-limit-82b03cef98b0`；后 6 页（`rank-transfer-limit`、`relative-balance-threshold`、`replica-search-beam-size`、`replica-search-num-stages`、`replica-search-radius`、`stair-config`）归另一位写手。

**版本核实。** STAIR 由 `bbb5672a`（PR #17511，2026-09-26）引入；`git merge-base --is-ancestor bbb5672a <c>` 对 `2c59ff10`、`db701c1f`、`2ed6cbba`、`baa023ad` 全部为否，对 `4d1412d1` 为是。所以本页主叙述版本是骨架自动区已用的 `4d1412d1`，钉住的四个版本都写「不存在」。

**核过的事实与出处（均为 `4d1412d1`，除非另注）。**

- 默认 `0.90`：`ascend_config.py:221`；范围 `0 < v ≤ 1` 与报错原文：`ascend_config.py:246-249`；布尔值报错：`:233-237`。
- 判据（`current_balance <= absolute_balance_threshold`，与相对门「或」；全零窗口返回 None；无锚点直接返回）：`policy/stair.py:209-223`。
- 均衡度定义（每段 max/avg，按样本数加权平均，取倒数）：`stair.py:157-168` 与 `ascend_config.py:190-191` 注释。
- 候选比当前差就丢、选中等于当前不出计划：`stair.py:951-955`、`:982-983`。
- 无运行时调用方：`git grep -il stair 4d1412d1` 只命中 `ascend_config.py`、`policy/stair.py`、`tests/ut/test_ascend_config.py`、`tests/ut/distributed/eplb/policy/test_stair.py`；PR #17511 说明原话 “does not select or execute STAIR by itself”。
- 钉住版本写入时的报错：`Config has no attribute 'stair_config'`，`db701c1f:ascend_config.py:837`、`2c59ff10:…:856`、`2ed6cbba:…:898`；`baa023ad` 为 `extra="forbid"`（`:179-180` 注释），报错文本来自 pydantic，页面未逐字引用。
- 之后接入：`a32719ef`（PR #17514，2026-09-27）`policy/factory.py:14-15`；同提交 EPLB 指南 `:84-86`「STAIR defaults do not require tuning」。

**标成 [D] 的推导**：0.90 ↔ 峰均比约 1.11；写 1 时绝对门恒开；相对门在「落定即偏差」时的盲区（0.85 × 0.95 为假设示例）；窗口压缩把轮换尖峰平均掉、均衡度偏高。无实测数，页面明确写了。

**lint**：首次保存触发 `facts-overflow`（事实表 12 行），合并为 10 行后 `pnpm wiki:lint` 通过。

**留给审查的疑点（未写进页面）**：`a32719ef` 的两份文档说法不一致——`additional_config.md:132` 说 MRv2 在 `additional_config.eplb_config` 里接受 `stair_config`，EPLB 指南则说 MRv2 的 EPLB 字段「must not be placed in `--additional-config`」，且指南里 `#advanced-stair-tuning` 锚点不存在。不在钉住版本内，页面只写到「接入提交存在」为止。

**跳过的内容**：无。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式（一句话 / 为什么存在 / 开了的代价 / 版本谱系，另有自动定义区与事实表），不套深入页骨架。

**分数：9 / 10。** P1 0 条，P2 2 条，P3 2 条。

**结构与格式。** 四段式齐全，另有「参数定义（自动生成）」「事实表」；正文 grep「骨架 / 待补」计数 0；frontmatter 的 id / title / type / summary / origin / evidence / updated 均合法（`updated: '2026-10-04'`）。`git diff` 删除行只有骨架占位句和旧 summary / updated，无信息丢失。旧版是骨架，无旧版信息清单可对，不适用。`pnpm wiki:audit` 退出码 0，本页无报错（来源 14 条）；`pnpm wiki:lint` 退出码 0（跨页锚点硬校验通过，4 处待留意均不在本页）。

**版本口径专项：通过。** 自己跑 `git merge-base --is-ancestor bbb5672a <c>`：`2c59ff10` / `db701c1f` / `2ed6cbba` / `baa023ad` 全为否，`4d1412d1` 为是；`baa023ad` 是 09-21、`4d1412d1` 是 09-26。页面在一句话节明确写「钉住的四个版本都没有、按 `4d1412d1` 描述、该快照上无运行时调用方」，事实表首行与 GLM 小节重复说清，读者不会以为钉住版本就有。措辞上的小毛病见 P2-1。

**逐条对源码（均为 `4d1412d1`，除非另注）。**
- 默认 0.90：`ascend_config.py:221` ✓。范围 `0 < v ≤ 1` 且须有限，报错原文 `stair_config.absolute_balance_threshold must be between zero and one`（f-string 展开，`:246-249`）✓；布尔报错 `STAIR numeric fields must not be booleans`（`:233-237`）✓。
- 判据：`stair.py:216-222` 当前均衡度 `≤` 阈值与相对门取「或」✓；全零窗口返回 None（`:209-210`）✓；无锚点（None / NaN）直接返回当前不均衡度、两道门都不看（`:211-212`）✓；`:201` 注释写明 last committed 是「保存的预测」，页面「上次落定时预测的均衡度」✓。
- 均衡度定义：`stair.py:153-168` 每样本 max ÷ 各卡均值，按 counts 加权平均得 mean_ratio，均衡度 = 1 / mean_ratio ✓；0.90 ↔ 1.11 ✓。
- 候选比当前差（mean 或 p95 任一更差）就丢：`:951-955` ✓；选中与当前一致返回 None：`:982-983` ✓。
- 无调用方：`git grep -il stair 4d1412d1` 只命中 4 个文件（配置、stair.py、两份单测）✓。单测下边界 `0.000001`：`tests/ut/test_ascend_config.py:251` ✓。
- 钉住版本报错 `Config has no attribute 'stair_config'`：`db701c1f:837`、`2c59ff10:856`、`2ed6cbba:898` ✓；`baa023ad:179-180` 注释说明改为 `extra="forbid"` ✓，页面未伪造 pydantic 报错原文 ✓。
- 之后接入：`a32719ef`（09-27）`policy/factory.py:14-15` ✓。
- [D] 推导手算：0.85 × 0.95 = 0.8075 ≈ 0.81 ✓（标了假设）；写 1 时恒开（mean_ratio ≥ 1 ⇒ 均衡度 ≤ 1）✓；分段平均使每段 max/avg 不高于逐样本、均衡度偏高 ✓（标 [D]，未写成定论）。

**数字与效果。** 无虚构效果数字；页面明说无实测、上游无对照。GLM 只用到部署前提（16 卡、TP8/DP2/EP16）并链到 D 页单一出处，没有把 GLM 主线数字当成本参数效果 ✓。

**浏览器实测。** Playwright 1440 宽打开 `http://localhost:5193/#/wiki/absolute-balance-threshold-71578a0c428d`，第一屏与表格屏正常渲染，H2 依次为一句话 / 参数定义 / 事实表 / 为什么存在 / 开了的代价 / 版本谱系；截图存审查员 scratchpad `absolute-balance-threshold-71578a0c428d-review-1.png`、`-review-2.png`。

**P2**
1. 一句话节「存在范围」+ 版本谱系表。问题：正文写「只有 main 快照 `4d1412d1` 上有它」，而自动生成的谱系表最后一行是「main：有」。谱系表的 main 指最新 origin/main，不是钉住的 `baa023ad`；两处并读容易以为「钉住的 main 有」或「4d1412d1 之后的 main 又没了」。改法：存在范围改成「09-26 `bbb5672a` 起的 main 才有；钉住四版都没有；本页按 `4d1412d1` 描述」，并加半句「下方谱系表里的 main 指最新 main，不是钉住的 `baa023ad`」。（同一问题在本写手另 4 个 STAIR 页也有，各页分别记。）
2. 来源 S10（frontmatter 第 29 行）引 `a32719ef:…/expert_parallelism_load_balancer.md#L84-L86`，但「The STAIR defaults do not require tuning」在第 87 行，引用区间不含被引句。audit 只验行号不越界，查不出这类错位。改法：改为 `#L84-L87`。

**P3**
1. 第 44 行首句就用「STAIR」，第 48 行才解释它是什么；可把第 48 行那句提到首句之后，或首句里给 STAIR 加半句同位语。
2. 本页没有链到父页 [stair_config](stair-config-cca9e594a052.md)；STAIR 整体介绍若以父页为单一出处，可在第 48 行加链接。

**写手留的疑点**（`a32719ef` 两份文档对 MRv2 是否走 `--additional-config` 说法不一）：不在钉住版本内，页面只写到「接入提交存在」为止，处理得当，未核其余细节。

**跳过**：sources 区；对照源码节（本页无此节）。

## 修订记录（10-04，写手）

- **P2-1 已改**：「存在范围」改为「钉住四版都没有；2026-09-26 随 `bbb5672a`（PR #17511）进 main，此后一直保留（10-02 的 `4ebb3090` 默认值仍 0.90）；本页按 `4d1412d1` 描述」，并注明谱系表的「main：有」指最新 main、不是钉住的 `baa023ad`；末尾补「次日 `a32719ef` 才接进 MRv2」。事实表「在哪些版本里」一行同步改成同一说法。核实：`git grep` 确认 `4ebb3090:ascend_config.py:221` 仍为 `absolute_balance_threshold: float = 0.90`。
- **P2-2 已改**：S10 改为 `expert_parallelism_load_balancer.md#L84-L87`。
- **P3-1 已改**：首句给 STAIR 加同位语（含 MRv2 简称定义），原第 48 行开头的重复定义删去。
- **P3-2 已改**：首句加父页 [stair_config](../../../../wiki/params/stair-config-cca9e594a052.md) 链接作 STAIR 总介绍。
- **过程记录**：核「最新 main 是否仍有」时在 `tools/repos/vllm-ascend` 跑过一次 `git fetch`，`origin/main` 被快进到 `9c1c455d`（10-04）；已用 `git update-ref` 复原为 `4ebb3090`，其他远端引用 reflog 无变化。`9c1c455d` 上 `StairConfig` 与 `fused_op_type` 也都还在。
- 复跑：`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check` 退出码均 0。
