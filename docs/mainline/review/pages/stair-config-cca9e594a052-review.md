# stair-config-cca9e594a052 审查记录

## 写作记录（10-04）

**分工。** `wiki/params/` 里标着「骨架，待补」的 12 页按 frontmatter id 字母序排：absolute-balance-threshold、cross-node-transfer-limit、fused-op-type、load-risk-quantile、load-window-bins、placement-search-backtrack-limit（前 6 页，归另一位写手）；rank-transfer-limit、relative-balance-threshold、replica-search-beam-size、replica-search-num-stages、replica-search-radius、stair-config（第 7–12 页，本写手）。本页是父参数，先写它，五个子参数页的版本口径与搜索规模推导都链回这里，不重算。

**旧版信息清单。** 旧版正文只有四处「骨架，待补」和一句「静态事实见上方自动生成区」，没有结论可丢；自动生成的「参数定义」「版本谱系」两节原样保留（版本谱系由 `pnpm wiki:lineage` 生成，手改会被覆盖）。

**核实结论（全部出自源码，未用底稿数字）。**

1. 钉点里都没有：`git ls-tree -r` 在 2c59ff10、db701c1f、2ed6cbba 上 grep `stair` 均为 0；`baa023ad` 的 `EplbConfig`（`ascend_config.py#L175-L197`）字段里没有 `stair_config`；`git merge-base --is-ancestor` 证实引入 `stair_config` 的 bbb5672a（#17511）与加上带约束摆放的 eb31db4d（#17512）都不在 baa023ad 之内，扫描提交 4d1412d1 是 baa023ad 之后 112 个提交。
2. 写了会怎样：v0.23 / GLM 镜像 / v0.26 的 `EplbConfig.__init__` 遇未知键 `raise ValueError(f"Config has no attribute '{key}'")`（2c59ff10#L846-L856、db701c1f#L828-L838、2ed6cbba#L889-L899）；main 钉点是 `@config`，`config_utils.py#L43` 默认 `ConfigDict(extra="forbid")`。
3. 4d1412d1 上无运行时调用者：`git grep -l "plan_rebalance\|plan_layer\|StairEplbPolicy\|stair_config" 4d1412d1` 只命中两个单测、`ascend_config.py` 与 `stair.py` 本身，正文标 [D]。
4. 接入是 PR #17514（`a32719ef`，2026-09-27 合入，已在 8d4409d6 与 4ebb3090 之内），本轮按 origin/main 4ebb3090（2026-10-02）核：`factory.py#L10-L16` 按 `policy == "stair"` 构造；`platform.py#L940-L983` 的 v1 报错原文逐字引用。4ebb3090 上十个默认值与校验与 4d1412d1 相同，`plan_layer` / `gated_layer_imbalance` 里读这些键的写法也相同（grep 对过）；`stair.py` 在两者之间改了约 400 行，但 `git diff -U0 4d1412d1 4ebb3090` 的 hunk 列表显示 4d1412d1 第 210–988 行（门槛、副本搜索、带约束摆放、plan_layer）只有门槛函数多了一个缓存参数，逻辑未变，正文据此写一句 [D]；`plan_rebalance` 与新增的约 300 行未逐行核。
5. 搜索规模推导（唯一出处放在本页「开了的代价」）：`replica_candidates` 从一个状态起步、每状态试 `2×radius+1` 个预算、每阶段留 `beam_size` 个，阶段数 4 时展开 3 次，上限 17 + 289 + 1,088 = 1,394；`incremental_replica_candidates` 截到 `beam_size` 个候选，`plan_layer` 对每个候选跑一次 `lpt_placement`。
6. GLM：镜像上写即报错；零冗余时 `total_slots == num_experts`，每阶段预算上下界都是 0，副本搜索只剩全 1 向量（[D]）。每卡 18 个专家链到 expert-parallel 页，不重算。

**sources。** 原 1 条保留为 [C1]（自动生成区引用它），追加 14 条，共 15 条；其中 4ebb3090 两条不是钉点，正文已写明。角标 29 处，C 级 18 处（62%）。

**验证。** `pnpm wiki:lint`：通过（仅 4 处别页的 mark-flood 待留意）。`pnpm wiki:audit`：退出码 0，本页 15 条来源无无效 commit / 越界。正文 1,391 → 6,718 字（改前按 HEAD 版本算 body.length，改后取最终 `pnpm wiki:audit` 输出）。未做浏览器实读。

**疑点与跳过。** 无 P1。待核写在页内：配套上游 vLLM 是否接受策略名 `"stair"`；上游的设计动机与效果数字。没有读 csrc、HANDBOOK、docs/plans。

**6 页全部写完后的全站三检（10-04）。** `pnpm wiki:lint` 退出码 0（另有 4 处别页 mark-flood 待留意，均不在本写手的 6 页）；`pnpm wiki:diagrams --check` 退出码 0（298 张图与 spec 一致，本批 6 页无图）；`pnpm wiki:audit` 退出码 0（142 页、3,827 条来源，无效 commit / 文件不存在 / 行号越界均为 0）。6 页正文已无「骨架」「待补」字样（grep 计数 0）。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式，不套深入页骨架。

**结论：9/10。P1 0 条，P2 0 条，P3 2 条。**

**结构与 frontmatter。** 一句话 / 事实表 / 为什么存在 / 开了的代价四段齐全，两段自动生成区（参数定义、版本谱系）保留未手改；正文 grep「骨架|待补」计数 0；frontmatter 字段完整（id、type=param、evidence=C、summary、relations、verified、updated=2026-10-04），`pnpm wiki:lint` 退出码 0（4 处 mark-flood 均为别页），`pnpm wiki:audit` 退出码 0（本页 15 条来源、6,718 字，无效 commit / 越界 0）。全库入链 7 处（index + 5 个子参数页 + 自身），锚点 #一句话 / #事实表 / #开了的代价 均存在。

**版本口径专项：通过。** 「一句话」第二段把「四个钉住版本都没有、按扫描提交 4d1412d1 描述」写成加粗段首，事实表专设「页底自动生成区里的 main」一行解释两处「main 有」不是钉点。逐条核实：
- 2c59ff10 / db701c1f / 2ed6cbba / baa023ad 上 `git grep -i stair -- vllm_ascend` 均 0 命中；baa023ad 的 `EplbConfig` 字段（ascend_config.py L176 起）无 `stair_config`。
- 引入提交 bbb5672a = PR #17511（2026-09-26 11:57），eb31db4d = PR #17512（同日 14:36，带约束摆放），与正文一致；`merge-base --is-ancestor bbb5672a baa023ad` 返回 1（不在钉点内），baa023ad 是 4d1412d1 的祖先。
- 接入运行时的 a32719ef = PR #17514（2026-09-27），在 4ebb3090 内、不在 4d1412d1 内，正文「第二天合入」「4ebb3090 不是钉点」写法属实。

**源码逐条核对（全部属实）。**
- 十个默认值：4d1412d1 ascend_config.py L218–L227，与事实表一致。
- 布尔拒绝原文 `STAIR numeric fields must not be booleans`（L237）逐字一致；各键越界校验 L242–L261。
- `@config(config=ConfigDict(frozen=True))`（L186）经 config_utils.py L43–L45 与默认 `extra="forbid"` 合并，「同样拒未知子键 + frozen」属实。
- 钉点报错：db701c1f ascend_config.py L837 `raise ValueError(f"Config has no attribute '{key}'")`，2c59ff10 L856、2ed6cbba L898 同；正文引用原文逐字一致。
- 4d1412d1 上 `git grep -l 'StairEplbPolicy|stair_config|plan_rebalance|plan_layer'` 只命中两个单测、ascend_config.py、stair.py，「只被校验不被使用」属实。
- 4ebb3090 factory.py L14–L15 按 `"stair"` 构造；platform.py L978–L982 的 v1 报错原文与事实表逐字一致；L942 v2 只放行两个键属实。
- `eplb_policy_type` 仍只认 0–3（4d1412d1 L322–L323）。
- 门槛：stair.py L216–L222，平衡度 = 1 ÷ 平均峰均比，相对 / 绝对两个门槛「或」关系；无锚点的层直接参与（L211–L212）。
- 最终选择：plan_layer L951–L954 均值与 p95 都不得变差，平局按跨机迁移数优先（L962–L968），胜者为现状返回 None。
- 风险 = 均值 + z × 标准差（L187）。
- 搜索规模：replica_candidates L361–L375 只展开 `expert_groups[:-1]`，阶段数 4 → 展开 3 次；每状态候选预算 ≤ 2×radius+1（L255–L261）；每阶段留 beam_size（L320）。状态数 1 / 17 / 64，展开 17 / 289 / 1,088，合计 1,394，手算一致。零冗余时 `unallocated_slots = 0`，min/max 预算都为 0，只剩全 1 向量，GLM 段推断成立。
- 4d1412d1 → 4ebb3090：ascend_config 十个默认值与校验 diff 为空；stair.py 第 210–986 行（门槛、副本搜索、带约束摆放、plan_layer）只有 gated_layer_imbalance 多一个缓存参数；装箱逻辑虽抽成 `_load_bin_boundaries`（4ebb3090 L279–L284），算法相同，「各子参数页的行为在 4ebb3090 同样成立」可以接受。

**数字与推断。** 没有虚构效果数字，「开了的代价」开头明说无实测；GLM 段只用「每卡 18 个专家」并链到 EP 页，没把 GLM 主线数字当 STAIR 效果；迟滞的动机标 [I]、GLM 推断标 [D]，没写成定论。

**浏览器实读。** Playwright 1440 宽打开 http://localhost:5193/#/wiki/stair-config-cca9e594a052：页面渲染正常，正文无「骨架 / 待补」，链接与 C/D 角标正常（截图 scratchpad\stair-config-cca9e594a052-review-first.png、-section.png）。

**P3。**
1. 「开了的代价」第三段与 GLM 小节第二条（L103、L112）：把 `rank_transfer_limit` 只写成「每张卡至多换进 1 个新专家」。源码两头都限：换进看 `incoming_counts`（stair.py L786），发出看 `source_usage`（L507、L589）。改法：写成「每张卡每层至多换进 1 个、发出 1 份」，或者只写「每卡搬运上限 1」，细节交给子页。
2. 写作记录第 1 条把 eb31db4d 写成「引入提交」，其实 eb31db4d 是 #17512（带约束摆放），引入 `stair_config` 的是 bbb5672a（#17511）。正文没错，只是记录写错了，改记录即可。
3. （审完子页后补）「为什么存在」四步列表点名了十个子键，但只有三个 `replica_search_*` 和两个搬运上限链到了子页。`relative_balance_threshold`、`absolute_balance_threshold`、`load_window_bins`、`load_risk_quantile`、`placement_search_backtrack_limit` 在正文里没有链接，其中 relative-balance-threshold 页全库只有 index 和 absolute 页两处入链。改法：在四步列表里每个键第一次出现的地方都链到对应子页。

## 修订记录（10-04，按审查意见）

1. P3-1：「开了的代价」搬运上限段与 GLM 小节改成两个方向都写：每卡每层至多换进 1 个、发出 1 份（`stair.py` L507、L589、L786）。
2. P3-2：写作记录第 1 条的「引入提交 eb31db4d」改为 bbb5672a（#17511，引入 `stair_config`）与 eb31db4d（#17512，带约束摆放）。
3. P3-3：「为什么存在」四步列表里十个子键第一次出现处全部链到各自子页。
4. 顺手：「一句话」第二段补一句，参数扫描用过 4d1412d1 与 8d4409d6 两个 main 提交，配置类逐行相同、都不是钉点（radius / num-stages 两页自动区记的是 8d4409d6）。

**口径自查（A 组问题）。** 本页原有事实表「页底自动生成区里的 main」一行，已说明谱系表的 main 指钉点之后的 origin/main；本轮在「一句话」第二段补上两个扫描提交都不是钉点。正文与表一致，无冲突。

**验证。** `pnpm wiki:lint` 退出码 0（仅 4 处别页 mark-flood 待留意）；`pnpm wiki:audit` 退出码 0（无效 commit / 文件不存在 / 行号越界均 0）。 本页正文 7,303 字，角标 29 处、C 级 62%。
