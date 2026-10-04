# replica-search-num-stages-e4b10925ff97 审查记录

## 写作记录（10-04）

**分工。** 「骨架，待补」12 页按 id 字母序，本写手负责第 7–12 页（rank-transfer-limit、relative-balance-threshold、replica-search-beam-size、replica-search-num-stages、replica-search-radius、stair-config），前 6 页归另一位写手。三个 `replica_search_*` 共用一套搜索机制，按单一出处原则把完整走法放在本页「为什么存在」，radius / beam-size 两页只写各自旋钮并链回；搜索规模的数字推导放在 stair-config「开了的代价」，本页只给结论 + 链接。

**旧版信息清单。** 旧版正文只有骨架标记；自动生成区的约束线索（1–8）在事实表里保留了报错原文。没有结论丢失。

**核实结论。**

1. 自动生成区记的扫描提交是 8d4409d6（2026-09-27，#16848），不是 4d1412d1；`git diff --stat 4d1412d1 8d4409d6 -- vllm_ascend/ascend_config.py` 为空，所以 `StairConfig` 字段与校验逐行相同，正文行为仍按 4d1412d1 的 `stair.py` 写；而 `stair.py` 第 210–988 行到 4ebb3090 都未改逻辑（见 stair-config 的记录）。
2. 注释（`ascend_config.py#L208-L209`）、默认 4（#L224）、校验 1–8（#L254-L255）、布尔拒收（#L233-L238）。
3. 分组：`stage_count = min(num_stages, num_experts)`，`np.array_split` 切组；只对 `expert_groups[:-1]` 做展开，最后一组贪心补齐，最终按 `candidate_score` 截到 `beam_size`（`stair.py#L355-L388`）。
4. 贪心：`_allocate_extra_replicas` 每次给 `risk / count` 最大者加 1，`count < num_ranks` 才可再加（#L227-L252）。
5. 展开：中心 = 贪心给本组的个数，预算按距中心由近到远枚举、限在 `[min_budget, max_budget]`，评分是补齐后的 `max(risk / count)`，去重后留 `beam_size`（#L264-L321）。
6. 从现状挪向目标、步数上限 `num_ranks * rank_transfer_limit`、保留现状候选（#L390-L432、#L924-L947）。
7. 「贪心不知道槽位整除、协方差、搬运上限，所以留备选」是对设计意图的推断，标 [I]；「写 1 时只剩贪心目标」「零冗余时每段只有 0 一种取值」是按代码推的，标 [D]。

**sources。** 保留原 [C1]（8d4409d6），追加 8 条，共 9 条，全部被正文引用。角标 21 处，C 级 13 处（62%）。

**验证。** `pnpm wiki:lint` 通过（仅 4 处别页 mark-flood 待留意）。正文 1,533 → 4,923 字（`pnpm wiki:audit` 的 body.length 口径，前后两次 audit 输出）。未做浏览器实读。

**疑点与跳过。** 无 P1。「FlashTree-style」是源码注释里的说法，没有找到出处，正文未使用这个名字。没有读 csrc、HANDBOOK、docs/plans。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式。

**结论：9/10。P1 0 条，P2 0 条，P3 2 条。**

**结构与 frontmatter。** 四段齐全，自动生成区保留；「骨架|待补」计数 0；frontmatter 合法。`git diff HEAD` 删掉的只有骨架行，没有丢信息。lint / audit 退出码 0（本页 9 条来源、4,923 字）。入链 4 处（index、stair-config、radius、beam-size），兄弟页用的 `#为什么存在` 锚点存在。副本数搜索的完整走法只在本页写，搜索规模的数字只链回 stair-config，单一出处做到了。

**版本口径专项：通过。** 「一句话」第三段写明四个钉点没有、按 4d1412d1 写。事实表最后一行解释了自动区记的是 8d4409d6。已核：8d4409d6 是 2026-09-27 的 #16848，不在 baa023ad 内（`merge-base --is-ancestor` 返回 1）；`git diff --stat 4d1412d1 8d4409d6 -- vllm_ascend/ascend_config.py` 为空；8d4409d6 L224 默认值是 4。

**源码核对（4d1412d1，全部属实）。**
- 贪心 `_allocate_extra_replicas`（stair.py L227–L252）：每次把副本位给「风险 ÷ 已有份数」最大的专家，`count < num_ranks` 才能再加，与正文一致。
- 分组：L361–L362 `min(num_stages, num_experts)` 加 `np.array_split`，组尽量等分、前面的组多 1 个。只展开 `expert_groups[:-1]`（L365），最后一组贪心补齐（L377–L382），按 candidate_score 截到 beam_size（L384–L388）。
- 逐组选择：中心是贪心给本组的个数（L284–L286），预算由近到远枚举并限在 `[min_budget, max_budget]` 内（L255–L261、L289–L291）。每个取值先在本组内贪心分，再把后面各组补齐（L292–L303），评分是 `max(risk / completion)`（L313–L316），去重后留 beam_size 个（L320）。正文第 3 步逐条吻合。
- 第 5 步（L414–L432）：每步一个专家加 1 份、另一个减 1 份，步数上限是 `num_ranks × rank_transfer_limit`（L928）；排序后截到 beam_size，并强制保留现状（L429–L431）。
- 校验原文（ascend_config.py L254–L255）与布尔原文逐字一致。
- 写 1 时：`expert_groups[:-1]` 为空，只有贪心目标，「半径不起作用」推断成立。
- 零冗余：`total_slots − num_experts = 0`，每组预算上下界都是 0，「段数写多少都一样」成立。
- 代价段「1 → 2 段增加最少」：展开次数 17 → 289 → 1,088 递增，正确；只给结论加链接，1,394 不在本页重算。
- 没有虚构效果数字，GLM 段只做 [D] 推断，没有拿 GLM 主线数字。

**浏览器实读。** Playwright 1440 宽打开 http://localhost:5193/#/wiki/replica-search-num-stages-e4b10925ff97：事实表和「为什么存在」的六步列表渲染正常，C/D/I 角标、子页链接正常，没有「骨架 / 待补」（截图 scratchpad\replica-search-num-stages-e4b10925ff97-review-first.png、-section.png）。

**P3。**
1. 事实表「页底自动生成区的提交」那一行（L78）只说 8d4409d6 与 4d1412d1 逐行相同，没点明它也不是钉点（在 baa023ad 之后）。自动区写的是「main · 8d4409d6」，读者可能把它当成钉住的 main。改法：补半句「8d4409d6 同样不是钉点」，和 stair-config 事实表的写法对齐。
2. 「副本数搜索怎么走」六步是三个 `replica_search_*` 页唯一的完整说明，但没有一组示意数，初学者读第 3 步（中心、两边各试、补齐后打分）偏抽象。建议加一个很小的手算例子，比如 6 个专家、4 卡、2 个额外副本位、分 2 段、半径 1，走一遍第 1–4 步。参数页不强制，所以记 P3。

## 修订记录（10-04，按审查意见）

1. P3-1：事实表自动区那一行补「8d4409d6 与 4d1412d1 都在钉点 baa023ad 之后，都不是钉点」；表头由「扫描提交 4d1412d1」改为「main 提交 4d1412d1」，因为本页自动区的扫描提交是 8d4409d6。
2. P3-2：六步之后加一个手算例子（6 个专家、4 卡、2 个额外副本位、2 段、半径 1），标明数为示意；按 `_allocate_extra_replicas` 与预算区间逐步手算，两个目标分数 5 与 8。
3. 与 radius 页 P2 同类：summary 与「一句话」的「写 1 就是纯贪心」改成「目标只剩贪心那一个，从现状挪向它途中的中间步仍是候选」（`stair.py` L414–L432）。

**口径自查（A 组问题）。** 正文与页底「版本谱系」表的「main 有」不再打架：事实表「钉点上是否存在」一行和「一句话」末段都写明谱系表的 main 指钉点 baa023ad 之后的 origin/main，扫描提交也不是钉点。

**验证。** `pnpm wiki:lint` 退出码 0（仅 4 处别页 mark-flood 待留意）；`pnpm wiki:audit` 退出码 0（无效 commit / 文件不存在 / 行号越界均 0）。 本页正文 5,686 字，角标 22 处、C 级 59%。
