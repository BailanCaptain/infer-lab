# replica-search-beam-size-6556d1650a62 审查记录

## 写作记录（10-04）

**分工。** 「骨架，待补」12 页按 id 字母序，本写手负责第 7–12 页（rank-transfer-limit、relative-balance-threshold、replica-search-beam-size、replica-search-num-stages、replica-search-radius、stair-config），前 6 页归另一位写手。副本数搜索的完整走法只写在 replica-search-num-stages「为什么存在」，搜索规模推导只写在 stair-config「开了的代价」，本页只讲「每次留几个」并链回。

**旧版信息清单。** 旧版正文只有骨架标记；自动生成区的约束线索（1–128）在事实表里保留报错原文。没有结论丢失。

**核实结论（扫描提交 4d1412d1）。**

1. 注释「每段之后留下的不重复份数候选上限」（`ascend_config.py#L212-L213`）；默认 64（#L226）；校验 1–128（#L258-L259）；布尔拒收（#L233-L238）。
2. 束宽卡三处：每段 `ranked_expansions[:beam_size]`（`stair.py#L304-L321`）；最终目标 `sorted(...)[:beam_size]`（#L374-L388）；`incremental_replica_candidates` 的 `ordered[:beam_size]`，且现状不在其中时 `selected[-1] = current`（#L413-L431）。
3. `plan_layer` 对每个候选调用一次 `lpt_placement`（#L933-L949），故束宽 = 每层每轮摆放次数上限。
4. 新发现（[D]，正文标 [!]）：束宽为 1 时 `selected = [best]`，若 best 不是现状就被替换成现状，于是唯一候选永远是「份数不变」，副本数不会被调整。按第 2 条三行代码直接推出，没有跑单测验证。
5. 零冗余时候选只有全 1 向量，即现状，故 GLM 推演为「每层每轮只摆 1 次」（[D]）。

**sources。** 保留原 [C1]，追加 7 条，共 8 条，全部被正文引用。角标 21 处，C 级 12 处（57%）。

**验证。** `pnpm wiki:lint` 通过（仅 4 处别页 mark-flood 待留意）。正文 1,534 → 4,137 字（`pnpm wiki:audit` 的 body.length 口径，前后两次 audit 输出）。未做浏览器实读。

**疑点与跳过。** 无 P1。第 4 条「束宽 1 = 关掉副本数调整」是代码推导，若要升级为定论，可补一条单测：`incremental_replica_candidates(..., beam_size=1)` 在目标与现状不同时返回现状。没有读 csrc、HANDBOOK、docs/plans。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式。

**结论：8.5/10。P1 0 条，P2 1 条，P3 0 条。**

**结构与 frontmatter。** 四段齐全，自动生成区保留（记的是 4d1412d1，与正文口径一致）；「骨架|待补」计数 0；frontmatter 合法。`git diff HEAD` 删掉的只有骨架行。lint / audit 退出码 0（本页 8 条来源、4,137 字）。入链 5 处（index、stair-config、num-stages、cross-node、backtrack）。完整走法与规模数字都链回单一出处。

**版本口径专项：通过。** 「一句话」第三段与事实表第 2 行写明四个钉点没有、按 4d1412d1 写、那一版没接运行时。

**源码核对（4d1412d1，全部属实）。**
- 三处截断：每段 `ranked_expansions[:beam_size]`（stair.py L320）；最终目标 `[:beam_size]`（L384–L388）；从现状挪向目标后 `ordered[:beam_size]`（L428）。
- 保留位：`if not any(... current) : selected[-1] = current`（L429–L431）。由此推出「束宽 n → 改了份数的候选至多 n − 1 个」。
- 写 1 的陷阱：`selected = ordered[:1]`，只要第一名不是现状，就被现状替换，所以唯一候选永远是「份数不变」。按这三行代码推断成立，标 [D]，正文用 [!] 提醒，处理得当。
- plan_layer 对每个候选调一次 lpt_placement（L933–L947），「束宽 = 每层每轮摆放次数上限」属实。
- 校验原文 `stair_config.replica_search_beam_size must be between 1 and 128`（ascend_config.py L258–L259）逐字一致。
- 零冗余时候选只有全 1 向量，也就是现状，「每层每轮只摆 1 次」推断成立。
- 没有虚构效果数字，也没有拿 GLM 主线数字。

**P2。**
1. 「一句话」第二段（L39）「带约束的摆放是**整轮规划里最重的一步**」，加上「为什么存在」第二段（L83）「这一步才是**真正决定 CPU 花多少时间的地方** [C7]」：这是没测过的性能定论，却挂着 C 级角标。C7 只证明了「每个候选各跑一次摆放」，证明不了摆放比副本数搜索更重（默认值下搜索也有至多 1,394 次展开、每次两遍贪心分配）。本页开头自己也说没有实测，这两句和它矛盾，属于把推断写成定论。改法：改成「摆放对每个候选各跑一次，还带协方差更新和回退；按代码结构看，它很可能是最重的一步 [I]」，第 83 行同步降级，或者删掉「真正决定」这几个字。

**浏览器。** 本页没有截图（全批只抽截 2 页）。

## 修订记录（10-04，按审查意见）

1. P2：「整轮规划里最重的一步」「真正决定 CPU 花多少时间的地方」两处定论降级：只保留有源码支撑的「每个候选各跑一次摆放 [C7]」，「很可能比副本数搜索更重」标 [I] 并写明待核（没有耗时实测）。
2. 0 是否合法：事实表意义列改成「写 0 启动即报错（下限是 1）」。

**口径自查（A 组问题）。** 正文与页底「版本谱系」表的「main 有」不再打架：事实表「钉点上是否存在」一行和「一句话」末段都写明谱系表的 main 指钉点 baa023ad 之后的 origin/main，扫描提交也不是钉点。

**验证。** `pnpm wiki:lint` 退出码 0（仅 4 处别页 mark-flood 待留意）；`pnpm wiki:audit` 退出码 0（无效 commit / 文件不存在 / 行号越界均 0）。 本页正文 4,319 字，角标 23 处、C 级 52%。
