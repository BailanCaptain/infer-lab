# rank-transfer-limit-99529b37d91d 审查记录

## 写作记录（10-04）

**分工。** 「骨架，待补」12 页按 id 字母序，本写手负责第 7–12 页：rank-transfer-limit、relative-balance-threshold、replica-search-beam-size、replica-search-num-stages、replica-search-radius、stair-config；前 6 页归另一位写手。本页是第 7 页，写在 stair-config 之后，版本口径、GLM 镜像报错原文都链回 stair-config，不重写。

**旧版信息清单。** 旧版正文只有骨架标记；自动生成区里的「约束线索」（`rank_transfer_limit != -1 and < 1` 报错）在新事实表里逐字保留了报错原文。没有结论丢失。

**核实结论（扫描提交 4d1412d1）。**

1. 含义：`ascend_config.py#L203-L204` 注释「每张卡在一层一次规划里的发出与换进上限，-1 去掉上限」；默认 1（#L222）；校验 #L250-L251；布尔拒收 #L233-L238。
2. 摆放约束：`stair.py#L780-L786` 只允许副本落在「原来有这个专家」或「换进次数 < 上限」的卡；`#L541-L604` 给换进需求找来源时 `source_usage[src_rank] >= rank_transfer_limit` 即跳过，换进数超过上限直接返回 None。
3. 第二处用途：`plan_layer` 把 `num_ranks * rank_transfer_limit`（-1 时 `current_placement.size`）作为 `incremental_replica_candidates` 的 `max_replica_changes`（#L924-L932），后者每步一收一送挪一份副本（#L410-L432）。
4. 卡住时：`lpt_placement` 返回 None 的候选被 `continue`，没有候选时 `plan_layer` 返回 None（#L947-L985），`plan_rebalance` 对 None 什么都不改（#L1036-L1040）。初稿写成「每个候选都至少要换进 2 个」不准确（约束是在摆放时就避开的，只有摆不出来才丢弃），已改；初稿另一句「没有日志会告诉你」无证据，已删，换成「规划函数只返回无方案、不抛错」。
5. GLM 推演（[D]）：零冗余时 `total_slots == num_experts`，副本数无可挪；每卡 18 位，故 ≥ 18 与 -1 等效。18 链到 expert-parallel 页，未重算。

**sources。** 保留原 [C1]，追加 9 条，共 10 条。角标 19 处，C 级 11 处（58%）。

**验证。** `pnpm wiki:lint` 通过（仅 4 处别页 mark-flood 待留意）。正文 1,460 → 4,375 字（`pnpm wiki:audit` 的 body.length 口径，前后两次 audit 输出）。全站 audit 在 6 页写完后统一跑，结果记在 stair-config 的写作记录末尾。未做浏览器实读。

**疑点与跳过。** 无 P1。没有读 csrc、HANDBOOK、docs/plans。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式。

**结论：8.5/10。P1 0 条，P2 1 条，P3 1 条。**

**结构与 frontmatter。** 四段齐全，自动生成区保留；「骨架|待补」计数 0；frontmatter 合法（type=param、evidence=C、summary 已改写、verified、updated=2026-10-04）。`git diff HEAD` 删掉的只有骨架行和旧 summary/updated，没有丢信息。lint / audit 退出码 0（本页 10 条来源、4,375 字）。入链 5 处（index、stair-config、absolute / cross-node / backtrack 三个兄弟页），出链锚点都能解析。

**版本口径专项：通过。** 「一句话」第三段与事实表第 2 行都写明四个钉点没有这个键、按扫描提交 4d1412d1 写、那一版还没接进运行时，并链回 stair-config，没有重复推导。

**源码核对（4d1412d1，全部属实）。**
- 两个方向都限：换进看 stair.py L786（`current_has_expert | incoming_counts < rank_transfer_limit`），发出看 L507、L589（`source_usage[src_rank] >= rank_transfer_limit`）。
- 校验原文 `stair_config.rank_transfer_limit must be -1 or positive`（ascend_config.py L250–L251）、布尔原文（L237）逐字一致。
- 第二处用途：plan_layer L928，`-1 → current_placement.size`，否则 `num_ranks × 本值`，作为 incremental_replica_candidates 的步数上限；L416–L425 每步把一份副本从 donor 挪到 receiver。
- 摆不出时：lpt_placement L864、L878 返回 None，不抛错；plan_layer 跳过 None 候选。「不抛错、这层原样」属实。
- GLM 推演：零冗余每个专家只有一份，副本数没得挪；16 卡、默认 1 → 每层至多 16 次换进；值 ≥ 18 时换进不受限，且 16×18 = 288 = 总槽位，和 -1 的第二处用途相同。零冗余下每个专家只有一个来源，发出也不会超过 18。所以「18 及以上和 -1 一样」成立，标 [D] 合适。
- 没有虚构效果数字，「开了的代价」开头明说没有实测。16、18 都是从部署前提和 EP 页推出来的上限，没有拿 GLM 主线的性能数字冒充本参数的效果。

**P2。**
1. 「一句话」第一段末句（L39）写的是「0 和 -1 以外的负数都会让启动失败」，最自然的读法是「除 0、-1 之外的负数」，读者会以为 0 合法。源码里 0 也报错（ascend_config.py L250：`!= -1 and < 1`；stair.py L711 也把 0 当非法）。兄弟键 cross_node_transfer_limit 恰好允许 0（表示禁止跨机），读者更容易混淆。改法：写成「只能写 -1 或正整数；写 0 或其他负数，启动时就会报错」。

**P3。**
1. 事实表「第二处用途」那一行（L77）的「一层一轮至多改 16 次副本数」：源码每一步是「一份副本从 donor 挪到 receiver」，同时改两个专家的副本数。改法：写成「至多挪 16 份副本」。

**浏览器。** 本页没有截图（按派活说明，全批只抽截 2 页：stair-config、replica-search-num-stages）。

## 修订记录（10-04，按审查意见）

1. P2：「一句话」改成「只能写 -1 或正整数；校验条件是不等于 -1 且小于 1 就报错，写 0 或其他负数都启动失败 [C3]」，并点明兄弟键 cross_node_transfer_limit 允许 0（`ascend_config.py` L250–L253）。
2. P3：事实表「第二处用途」改成「至多挪 16 份副本（每挪一份，一个专家加 1、另一个减 1）」。

**口径自查（A 组问题）。** 正文与页底「版本谱系」表的「main 有」不再打架：事实表「钉点上是否存在」一行和「一句话」末段都写明谱系表的 main 指钉点 baa023ad 之后的 origin/main，扫描提交也不是钉点。

**验证。** `pnpm wiki:lint` 退出码 0（仅 4 处别页 mark-flood 待留意）；`pnpm wiki:audit` 退出码 0（无效 commit / 文件不存在 / 行号越界均 0）。 本页正文 4,626 字，角标 20 处、C 级 60%。
