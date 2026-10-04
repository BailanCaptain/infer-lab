# relative-balance-threshold-bcbc40e7dc87 审查记录

## 写作记录（10-04）

**分工。** 「骨架，待补」12 页按 id 字母序，本写手负责第 7–12 页（rank-transfer-limit、relative-balance-threshold、replica-search-beam-size、replica-search-num-stages、replica-search-radius、stair-config），前 6 页（含 absolute-balance-threshold）归另一位写手。本页只链接 absolute_balance_threshold，不推导它的换算数字。

**旧版信息清单。** 旧版正文只有骨架标记，没有结论可丢；自动生成区原样保留（其中「源码未提供字段注释」与实际不符：`ascend_config.py#L199-L200` 有 Attributes 注释，属扫描器口径，本轮不改自动区）。

**核实结论（扫描提交 4d1412d1）。**

1. 含义：注释「当前平衡度 ÷ 上次提交的平衡度 ≤ 本值即重排」（#L199-L200）；平衡度 = 平均峰均比的倒数（#L190-L191）；默认 0.95（#L220）；校验 `0 < v <= 1` 且有限，报错是 f-string `stair_config.{name} must be between zero and one`（#L246-L249）。
2. 门槛逻辑 `gated_layer_imbalance`（`stair.py#L198-L224`）：全 0 窗口返回 None；锚点 None/NaN 直接返回当前不均度；否则相对或绝对任一触发即放行。
3. 锚点：`plan_rebalance` 逐层调门槛（#L1029-L1041），返回每层预测峰均比；4d1412d1 上无调用方写回；4ebb3090 的 `patch_eplb.py#L493-L498` 在层搬完、刷新路由表后，且预测值有限时才写回。
4. 预测按「负载 ÷ 副本数」估（`placement_imbalance`，#L150-L168），故用 [I] 写「预测偏乐观时下一轮可能马上放行」，没写幅度。
5. 换算 1 ÷ 0.95 ≈ 1.053、例子 1.20 → 约 1.263 是本页自有的算术，标 [D]。

**自查修订。** 初稿「有的层最好 1.3、有的层 1.05」是编的示意数，「差好几个百分点」无出处，均已删；补了 [C5]、[C8] 两处角标，使 sources 每条都被正文引用。「迟滞是必有行为」那句的角标原指 [C2]（本键注释），改指 [C7]（`#L190-L191` 的类注释）。

**sources。** 保留原 [C1]，追加 8 条，共 9 条（含 4ebb3090 一条，非钉点，正文写明）。角标 20 处，C 级 13 处（65%）。

**验证。** `pnpm wiki:lint` 通过（仅 4 处别页 mark-flood 待留意）。正文 1,387 → 4,131 字（`pnpm wiki:audit` 的 body.length 口径，前后两次 audit 输出）。未做浏览器实读。

**疑点与跳过。** 无 P1。没有读 csrc、HANDBOOK、docs/plans。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式。

**结论：8.5/10。P1 0 条，P2 1 条，P3 0 条。**

**结构与 frontmatter。** 四段齐全，自动生成区保留；「骨架|待补」计数 0；frontmatter 合法。`git diff HEAD` 删掉的只有骨架行，没有丢信息。lint / audit 退出码 0（本页 9 条来源、4,131 字）。入链只有 index 和 absolute-balance-threshold 两处（stair-config 正文没链到本页，已记在 stair-config 审查的 P3-3）。

**版本口径专项：通过。** 「一句话」第三段与事实表第 2 行写明四个钉点没有、按 4d1412d1 写、那一版没接进运行时；锚点写回明确标成「4ebb3090 上」，并写明它不是钉点（链回 stair-config）。

**源码核对（全部属实）。**
- 平衡度 = 1 ÷ 平均峰均比：ascend_config.py L190–L191 类注释；stair.py L216–L217。
- 触发条件 `current/committed ≤ 本值 or current ≤ 绝对阈值`：stair.py L218–L222。
- 锚点为 None/NaN 时直接放行（L211–L212），整个窗口全 0 时跳过（L209–L210）。
- 校验原文 f-string `stair_config.{name} must be between zero and one`，条件 `isfinite and 0 < v ≤ 1`（ascend_config.py L246–L249），与事实表一致。
- 预测按「负载 ÷ 副本数」平均分摊：placement_imbalance L155–L158。
- 锚点写回：4ebb3090 patch_eplb.py L493–L498，在 `refresh_model_routing_tables` 之后、预测值有限时才写回，属实。
- 手算：1 ÷ 0.95 = 1.0526，「≈ 1.053 倍」正确；1.20 ÷ 0.95 = 1.2632，「约 1.263」正确；取 1.0 时「不比预测好就放行」与 `≤` 一致。
- 没有虚构效果数字；GLM 段明说没有逐层实测，所以说不出放行频率，没拿 GLM 主线数字冒充。

**P2。**
1. 「开了的代价」「和绝对门槛的关系」一段（L92）的前提写错了变量：「如果某层上次**预测**的平衡度本身就低于绝对下限，那么不论本键写多少，这一层每轮都会被绝对门槛放行」。绝对门槛比的是**当前**平衡度（stair.py L220：`current_balance <= absolute_balance_threshold`），跟锚点无关。上次预测低于下限，不保证每轮当前值都低于下限。这条推断标了 [D]，但推理本身不成立，和事实表第 70 行「或当前平衡度 ≤ 绝对阈值」也对不上。改法：写成「如果某层的当前平衡度一直低于绝对下限（调到最好也到不了 0.90 以上），它每轮都会被绝对门槛放行，本键对它形同虚设」。

**备注（不计分）。** 写作记录说自动生成区「源码未提供字段注释」与实际不符（ascend_config.py L199–L200 有注释），这是扫描器的问题，不属于本页正文。建议另开工具任务修，不在本页改。

**浏览器。** 本页没有截图（全批只抽截 2 页）。

## 修订记录（10-04，按审查意见）

1. P2：「和绝对门槛的关系」改用正确变量：绝对门槛比的是当前平衡度、与锚点无关（`stair.py` L220）；改成「当前平衡度一直低于绝对下限的层每轮被放行，本键形同虚设 [D]；已有锚点且当前在下限之上的层只能靠本键放行」。
2. 0 是否合法：事实表「合法取值」的意义列与「调低」段改成「0 不合法，写 0 启动报错（下限是开区间）」，原来的「写 0 关不掉它」有歧义。

**口径自查（A 组问题）。** 正文与页底「版本谱系」表的「main 有」不再打架：事实表「钉点上是否存在」一行和「一句话」末段都写明谱系表的 main 指钉点 baa023ad 之后的 origin/main，扫描提交也不是钉点。

**验证。** `pnpm wiki:lint` 退出码 0（仅 4 处别页 mark-flood 待留意）；`pnpm wiki:audit` 退出码 0（无效 commit / 文件不存在 / 行号越界均 0）。 本页正文 4,319 字，角标 21 处、C 级 66%。
