# prefetch-ratio 审查记录

## P5 写作记录（Opus 5.5，10-02，第 29 批小修）

本记录是写手自查与交接，不替代独立审查。按派发说明执行：小修、保留参数页 4 段式结构、沿用现有图、不起服务、不截图、不开子代理。

### 旧版信息清单与勾选

现版与 `p4-checkpoint` 的 diff 为空（`git diff --stat p4-checkpoint -- wiki/params/prefetch-ratio.md` 无输出），所以旧版就是改前的现版。清单存于本轮 scratchpad（`prefetch-ratio-facts.md`），12 条结论逐条核对结果：

1. 嵌套 dict、五个权重、v0.23.0 默认值 —— 保留（「一句话」首段未动）。
2. 标定场景（Qwen3-235B-A22B-W8A8 @ 144、Qwen3-32B-W8A8 @ 72）与「改它要先抓 profiling」—— 保留；该句末尾重复第 5 次引用的 `[S14]` 删掉，同一结论在事实表最后一行仍带 `[S14]`。
3. 存在范围（只到 v0.23 维护分支；v0.26 静默忽略、main `extra="forbid"`）—— 保留。
4. 事实表 10 行 —— 一行未动。
5. 顶层整体替换、不逐键合并 —— 保留（事实表）。
6. 为什么按权重种类分开给比例 —— 保留，只在 MTE / L2 处补了 MTE 的中文解释和 op-to-ai-core 链接。
7. attn 按层类名路由、`moe.gate_up` 打到 `w13_weight` —— 保留。
8. 0.8 无推导、是标定经验值；> 22.5 MiB 时 0.8 与 1.0 同值 —— 保留（该段首个 `[I]` 删去，段末 `[I]`/`[A]`/`[D]` 仍在，结论未变）。
9. 代价三面（调大抢 MTE/L2、调小拿不满、超 18 MiB 白给）—— 保留。
10. 三个踩空写法 —— 保留。
11. 去向（PR #11949、过期启动命令、vllm_omni）—— 保留。
12. 版本谱系、参数定义两节自动生成 —— 未动。

删除的唯一一段是改前「一句话」末尾那个挂在 **Qwen3-0.6B** 上的算例：它说那两块权重「单卡才 12 MiB 与 6 MiB」，而这两个数其实是 **GLM 稠密 MLP 每卡每层**的数（底稿 02 §3.3：`gate_up` 12.0 MiB、`down` 6.0 MiB），挂错了模型；结论本身（这两块在 18 MiB 以内、比例线性起作用）没丢，改写后挪进「开了的代价」的 GLM 条目里。

### 这次改了什么

1. **「一句话」末段改成 GLM 双机口径（挂靠 A4）**：这套部署上特性是关着的——官方两机命令没传 `additional_config`，`WeightPrefetchConfig.enabled` 默认 `False`（新增来源 `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L701`，`[C26]`；v0.23 维护分支 2c59ff10 同一处行为相同，已在原来源第 2 条内）。同时拆掉一个容易混的同名词：教程命令里的 `--safetensors-load-strategy prefetch` 是加载时从磁盘预读 safetensors，与本页的 HBM→L2 预取无关（新增来源 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L276-L340`，`[S27]`；该文件内无 `additional_config`，已 grep 全文确认）。
2. **「开了的代价」开头加「配置值 vs 测得效果」的界线**（本批验收要点）：明确本页只有配置值与字节推导，上游只给定性说法，钉住提交上我们没有实测数；GLM 主线的时延/吞吐是预取**关着**那套部署的数字，不能当本开关的收益。
3. **「开了的代价」末尾（去向之前）加 GLM 双机推演四条**，数字取自底稿：
   - `mlp.*` 不进分支（GLM 是 MoE 模型）；顺带给出它们本该管的两块：02 §3.3 的 12.0 MiB / 6.0 MiB `[D]`。
   - `moe.gate_up` 是唯一落得上的一项且已饱和：02 §6.6 的 `w13_weight` 形状 `[18, 4096, 4096]` int8 = 288 MiB/卡/层（02 §1.3 里整层路由专家 432.0 MiB 的大头）；`0.8 × 288 MiB = 230.4 MiB` 远超 18 MiB 上限，所以 0.8 与 1.0 在这套部署上无差别 `[D]`。
   - `attn.qkv` / `attn.o` 挂在 W8A8 **静态**量化的 `apply` 上，而底稿按上游 config 推断稠密侧是 W8A8 **dynamic**（02 §3.4，标 `[I]`）；**待核：缺模型目录下的 `quant_model_description.json`**，无法确认 attention 各投影最终命中哪个 `LinearMethod`。
   - KDA 的投影按同一份推断是 BF16，不量化的线性层本就不在挂钩范围。
4. **补依赖链接**：`[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)`、`[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)`（改前两个链接都没有）。
5. **来源**：sources 末尾追加 2 条（上面的 C26、S27），其余 25 条未动；图 `prefetch-ratio.yaml` 未动。

### 数字出处

- 稠密 MLP 每卡每层 12.0 / 6.0 / 18.0 MiB：`docs/mainline/02-forward.md` §3.3。
- `w13_weight` `[18, 4096, 4096]` int8 与 W8A8 MoE 算子链：同文件 §6.6；路由专家每卡每层 432.0 MiB、18 个局部专家：§1.3、§6.3。
- attention / KDA 精度划分（`[I]`，按上游 `config.json` 的 `modules_to_not_convert` 推断）：同文件 §0.4、§3.4。
- `--safetensors-load-strategy prefetch` 的语义：`docs/mainline/01-deploy-entry-schedule.md` A0.7 段（教程两机命令）。
- 本页未新增 calc，未改事实表行数。

### 核实方式

- `enabled` 默认值：读 2c59ff10 与 db701c1f 两个提交的 `ascend_config.py` 中 `WeightPrefetchConfig.__init__`（`get("enabled", False)`）；v0.26 = 2ed6cbba、main = baa023ad 上该类与 `ops/weight_prefetch.py` 都不存在，与原文「v0.24.0rc 起删除」一致。
- GLM 教程：`git -C tools/repos/vllm-ascend show 0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`，全文 grep `additional_config|prefetch|ascend_config` 只命中三处 `--safetensors-load-strategy prefetch`（#L212、#L282、#L332），没有 `weight_prefetch_config`。

### 验证

- `pnpm wiki:lint`：通过；本页 0 报错、0 待留意（改动中途曾把内联标记推到 36 处触发 `mark-flood`，已删 3 处重复的 `[S14]`、1 处重复 `[I]` 降到 30 以内）。
- `pnpm wiki:diagrams --check`：通过，290 张图与 spec 一致，本页图未改。
- `pnpm wiki:audit`：通过；本页「正文 9309 字 / 6 节 / 来源 27 条」，无效 commit 0、文件不存在 0、行号越界 0（新增两条来源的行号均有效）。
- 正文字数（含自动生成节，去空白字符）：11,721 → 14,070。

### 自查疑点

- 没有 P1 疑点。
- P3：`attn.*` 在 GLM 上是否生效取决于缺失的 `quant_model_description.json`，页面已按「待核」写明，未写成定论。
- 本轮被安全分类器拦过一次（跨四个提交批量 grep 源码那一步），改用窄范围单提交核实，结论未受影响。

## P5 审查（10-02）

审查员独立核对，只审不改页面。按参数页小修口径：四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 两节自动生成保持不变，未按深入页骨架扣分。

**结论：7.5 / 10。P1 1 条，P2 2 条，P3 3 条。audit 本页通过（evidence=C，正文 9309 字 / 6 节，来源 27 条；全库无效 commit / 文件不存在 / 行号越界均为 0）；`pnpm wiki:lint` 通过，本页无待留意。**

**GLM 双机段对照源码——属实。**
- `enabled` 默认 False：vllm-ascend@db701c1f `vllm_ascend/ascend_config.py:700`、@2c59ff10 同文件 `:719`，均为 `weight_prefetch_config.get("enabled", False)`；db701c1f `:701` 整体取 `prefetch_ratio`（不逐键合并）与事实表一致。
- 教程未配：@0576b647 `docs/source/tutorials/models/GLM5.3-Flash.md` 全文无 `additional_config`，带 prefetch 字样的只有 `--safetensors-load-strategy prefetch`（L212 / L282 / L332）；其语义（守护线程把 safetensors 读进 OS 页缓存）与 01 L292–L293 一致，页面把它和 HBM→L2 预取分开讲是对的。
- `moe.gate_up` 在 GLM 上「落得上」：GLM 的 MoE 是 `FusedMoE`（db701c1f `glm5_next.py:1502`），W8A8 dynamic 的 MoE `apply` 在 `w8a8_dynamic.py:270` 调 `select_experts`，后者在 `ops/fused_moe/experts_selector.py:71–74` 发 `maybe_prefetch_moe_weight_preprocess(..., "gate_up")`。`w8a8_dynamic.py` 里没有任何 weight_prefetch 调用，所以 `attn.*` 只挂在静态 W8A8 上的说法也成立。

**数字对照底稿。** 12.0 / 6.0 MiB = 02 §3.3（L226–L227）；432.0 MiB = 02 §1.3 表；288.0 MiB 与 `[18, 2×2048, 4096]` 在 02 §6.3 L624（不是写手记录说的 §6.6，§6.6 L706 只有转置后的形状 `[18, 4096, 4096]`）；KDA 投影 BF16 = 02 §0.4 表首行。`0.8 × 288 = 230.4 MiB`、`230.4 / 18 ≈ 12.8` 倍、`18 / 0.8 = 22.5 MiB`、Qwen3-235B 单专家 w13 `2 × 1536 × 4096 = 12 MiB`、2 个专家即 24 MiB > 22.5 MiB 均手算无误。数值全部相符，问题在出处（见 P1）。

**两处待核标注。** `quant_model_description.json` 缺失：页面 L126 以加粗「待核」写明、未下定论，与 02 §0.4「这份文件本机没有、精度划分标 [I]」一致，合规。「配置值 vs 测得效果」界线：L108 写清了只有配置值与字节推导、上游只给定性说法、GLM 主线时延吞吐是预取关着的数字，合规；全页没有虚构收益数字。

**旧版信息清单。** 清单存在（本会话 scratchpad `prefetch-ratio-facts.md`，12 条）。抽 6 条到新版：1（嵌套 dict 与默认值，L67）✓；3（存在范围、v0.26 静默、main forbid，L71）✓；5（顶层整体替换，L80）✓；8（0.8 无推导 [I]、>22.5 MiB 同值 [D]，L102–L104）✓；10（三个踩空写法，L116–L120）✓；11（去向、PR #11949、vllm_omni，L128–L130）✓。

**链接。** `glm-5-3-flash-two-node.md#部署前提`（D L49）、`op-to-ai-core.md` 都能解析；全库入链只有 wiki/index.md 与 weight-prefetch-config.md，均不带锚点，未受影响。

**浏览器实测。** Playwright 1440 宽打开 http://localhost:5193/#/wiki/prefetch-ratio：首屏一句话四段与事实表表头正常，GLM 段三条列表与两处站内链接正常显示。截图：本会话 scratchpad `prefetch-ratio-review-first.png`、`-diagram.png`、`-glm.png`。

### P1
1. **「开了的代价 · 放到 GLM 双机上会怎样」（L124–L125）GLM 数字没有链接单一出处，按本页自推导标 [D]。** 12.0 / 6.0 MiB、18 个局部专家、整层 432 MiB 都没有链接；288 MiB 是本页按形状 `[18, 4096, 4096]` int8 现场重算出来的。站内这些数已有出处：每卡每层稠密 MLP 18 MiB 在 tensor-parallel「稠密 MLP 与共享专家：每卡各留一段通道」（12 / 6 的拆分在该页「开销和什么时候别开」L494–L495），每卡 18 个专家与 432.0 MiB 在 glm-5-3-flash-two-node「每张卡上放了什么」（D L160、L170）。数值都对，但违反「数字只在单一出处推导，其他页只做链接」。改法：12.0 / 6.0 MiB 与 432 MiB、18 个专家改为引用并链接上述两节，去掉 [D]；288 MiB 站内没有现成出处，二选一——要么不引入新数，改写成「w13 是这 432 MiB 里 gate 加 up 的那部分，远超 22.5 MiB」，让 0.8 × w13 的结论直接落在链接来的 432 MiB 上；要么先把 288 / 144 MiB 拆分补进 D 的权重表注（出处 02 §6.3 L624），本页再链接过去。

### P2
1. **删除 Qwen3-0.6B 那段的理由不成立，丢了一个真实模型上「比例线性起作用」的例子。** 写手记录说那两块「单卡 12 MiB 与 6 MiB」挂错了模型、其实是 GLM 的数。核实：weight-prefetch-config L109–L116 的 Qwen3-0.6B 算例（H = 1024、intermediate 3072、bf16、TP1）给出 gate_up `[6144, 1024] × 2 B = 12 MiB`、down `[1024, 3072] × 2 B = 6 MiB`，旧段落数字是对的，只是与 GLM 的 12 / 6 MiB 恰好相同。删掉后本页只剩 GLM「本来会线性起作用、可惜不走这条路」的反例，读者看不到这个旋钮真正有用的场景（稠密 bf16 小模型，只有 `mlp.*` 被读，attn 两项因不是静态 W8A8 白写，moe 组不装载）。改法：在「超过 18 MiB 的部分白给」段末补一句，链接回 weight-prefetch-config 的 Qwen3-0.6B 算例，说明那里正是 `mlp.*` 线性生效的情形；写手记录里「挂错了模型」一句同步更正。
2. **版本标注：GLM 推演写成「假设在 v0.23 上手动开起来」（L73 末句、L122）。** 按版本口径，v0.23 列是维护分支 2c59ff10，没有 GLM 代码，GLM 在那里跑不起来；能跑 GLM、又带这个特性的是 orphan commit db701c1f（本页 L73 也已区分两者）。改法：两处改成「在含 GLM 代码的 db701c1f 上手动开起来」，或「v0.23 一系、含 GLM 代码的那个提交」。

### P3
1. L126「主线底稿按上游配置推断稠密侧走的是 W8A8 dynamic」：02 §3.4 的 [I] 只覆盖稠密 MLP，attention（MLA 的 q_a / q_b / kv_a / o_proj）走哪个 `LinearMethod` 底稿没有推断。页面已标待核，不算错；建议把「稠密侧」改成「稠密 MLP」，并说明 attention 投影的方法同样取决于缺失的那份文件。
2. L125 没提 `moe.gate_up` 自己的门槛（该次 forward token 数 ≥ 96，事实表 L86）：GLM 小 batch decode 时这一项本身也不触发。建议补半句。
3. frontmatter `updated` 仍是 2026-09-22（L57），本轮改了正文；写手记录「数字出处」把 288 MiB 记在 02 §6.6，实际在 §6.3 L624。

### 环境与跳过
- sources 区、「版本谱系」「参数定义（自动生成）」两节未读（按纪律）；未读 HANDBOOK 与 docs/plans/。
- 源码核对每次只在一个提交上窄范围 grep（db701c1f、2c59ff10、0576b647 各自分开），未被拦。

## P5 修订记录（Opus 5.5，10-02，复审前）

按上面审查逐条处理。

### P1（已修）
GLM 段不再在本页算任何数，改成结论 + 链接：
- 稠密 MLP 那条：删掉 `12.0 MiB 与 6.0 MiB [D]`，改为链接 [tensor-parallel「稠密 MLP 与共享专家：每卡各留一段通道」](../../../../wiki/concepts/tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)（每卡每层 18 MiB）与同页[「开销和什么时候别开」](../../../../wiki/concepts/tensor-parallel.md#开销和什么时候别开)（gate_up / down 的拆分），本页只留「两块都在 18 MiB 上限以内」这个结论。
- `moe.gate_up` 那条：删掉 `[18, 4096, 4096]`、288 MiB 和 `0.8 × 288 MiB = 230.4 MiB` 这一串重算，改为链接 [glm-5-3-flash-two-node「每张卡上放了什么」](../../../../wiki/concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)的「路由专家每卡每层 432 MiB」，再说明 `w13` 是这 432 MiB 里 gate 与 up 的那部分、只算这部分也比 18 MiB 的上限大一个数量级以上，乘 0.8 后仍远在上限之外。结论不变，本页不再出现新数字，也不再带 `[D]`。
- 采用审查给的「二选一」里的第一条（不引入新数），没有去改 D 的权重表注——那是别人的页，本轮范围只有本页。

### P2（已修）
1. Qwen3-0.6B 例子：审查说得对，**我上一轮记录里「挂错了模型」这句判断是错的**。weight-prefetch-config 的 Qwen3-0.6B 算例（H = 1024、intermediate 3072、bf16、TP1）本身就得出 gate_up 12 MiB、down 6 MiB，与 GLM 稠密 MLP 的 12 / 6 MiB 只是数值巧合。本轮在「超过 18 MiB 的部分白给」段末补了一句，链接回 [weight_prefetch_config 页「开了的代价」](../../../../wiki/params/weight-prefetch-config.md#开了的代价)的那个算例，并写明那里才是 `mlp.*` 线性生效的完整场景（稠密 bf16 小模型、TP1，只有 `mlp` 两项被读到）。上一轮记录的那句判断以本节为准。
2. 版本标注：两处「假设在 v0.23 上手动开起来」（「一句话」末句、GLM 段首句）都改成「在含 GLM 代码的那个提交上手动开起来」，不再把 GLM 推演挂在没有 GLM 代码的 v0.23 维护分支上。

### P3（已修）
1. 「稠密侧」改成「稠密 MLP」，并写明 attention 那几个投影归哪个 `LinearMethod` 底稿并没有推断，待核那句一并扩成「attention 各投影（以及稠密 MLP）都要靠这份文件才能定」。
2. `moe.gate_up` 自己的门槛（该次 forward token 数 ≥ 96）补成半句，指向事实表，并点明小 batch decode 时这一项本身不触发。
3. frontmatter `updated` 从 2026-09-22 改成 2026-10-02。另更正上一轮记录的出处笔误：`w13` 形状的出处是底稿 02 §6.3（不是 §6.6）——不过本轮已把这个数字整段删掉，页面上不再引用它。

### 验证（本轮）
- `pnpm wiki:lint`：退出码 0，通过；本页 0 报错、0 待留意（删掉 2 处 `[D]` 后内联标记进一步下降）。
- `pnpm wiki:diagrams --check`：退出码 0，290 张图与 spec 一致；本页图未改。
- `pnpm wiki:audit`：退出码 0；本页「正文 9736 字 / 6 节 / 来源 27 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 正文字数（含自动生成节，去空白字符）：14,070 → 14,915。
- 本轮新增链接 4 条（tensor-parallel 两节、D 的「每张卡上放了什么」、weight-prefetch-config 的「开了的代价」），锚点均按站内现有入链写法核对过。

## P5 复审（10-02）

独立复审员，只审不改页面。对象：上一节「P5 审查（10-02）」的 P1 / P2 / P3 与其后「P5 修订记录」。

**结论：8.5 / 10。原 P1 已修好；原 P2 两条、P3 三条均已落实。新 P1 0 条，新 P2 1 条，新 P3 2 条。`pnpm wiki:lint` 退出码 0（全库 4 处待留意，都不在本页）；`pnpm wiki:audit` 退出码 0（本页 evidence=C、正文 9736 字 / 6 节、来源 27 条；全库无效 commit 0、文件不存在 0、行号越界 0；参数页不在达标名单内）。**

### 原 P1 逐项核对（GLM 段数字无出处、288 MiB 本页重算）
- **重算链已删**：`[18, 4096, 4096]`、288 MiB、`0.8 × 288 = 230.4 MiB` 在页面上都已找不到；GLM 段 L124–L126 不再出现任何算式。全页 `[D]` 剩 4 处，都在 L82 / L84 / L104 / L114，属于 Qwen 场景或通用口径，GLM 段一处也没有。
- **12 / 6 MiB → 链接**：L124 只留「两块都在 18 MiB 上限以内」的结论，「每卡每层合计 18 MiB」链到 tensor-parallel「稠密 MLP 与共享专家：每卡各留一段通道」（标题在该页 L372，L374 正文与 L378 表里写着每层 18 MiB）；「拆开是 gate_up 与 down 两块」链到同页「开销和什么时候别开」（标题 L477，L495 / L497 / L498 给出 12 MiB、6 MiB、合计 18 MiB）。两处都是这些数的推导出处。
- **432 MiB、18 个专家 → 链接**：L125 链到 glm-5-3-flash-two-node「每张卡上放了什么」（标题 L158；L160 写 288 ÷ 16 = 每卡 18 个，L170 表里路由专家 432.0 MiB）。出处属实。
- **锚点**：四条新链接的标题都存在（tensor-parallel L372、L477；D L158；weight-prefetch-config L109「开了的代价」）；lint 的跨页锚点硬校验通过。浏览器实测（Playwright 1440 宽，`http://localhost:5193/#/wiki/prefetch-ratio`）：四条链接都渲染成 `#/wiki/<页>#<锚点>`，GLM 段排版正常。截图：本会话 scratchpad 下的 `prefetch-ratio-rereview-glm.png`。
- **判定：修好了。** 同一类的残留还有两处，见新 P2。

### 原 P2 / P3 核对
- P2-1 Qwen3-0.6B：L114 段末补了一句并链到 weight-prefetch-config「开了的代价」的算例，说明那里是 `mlp.*` 线性生效的场景 ✓。写手在修订记录里认了上一轮「挂错了模型」是判断错误 ✓。
- P2-2 版本标注：L73 末句、L122 都改成「含 GLM 代码的那个提交」✓。
- P3-1：L126 已改成「稠密 MLP」，并说明 attention 投影归哪个方法底稿没有推断。对照 02 L235：底稿的 `[I]` 只写了稠密 MLP 走 `AscendW8A8DynamicLinearMethod`；全文 grep `LinearMethod`，除 L50 外只有这一处。02 §0.4 L66–L67 只说 MLA 三个大投影是 int8，没说走 static 还是 dynamic。页面这句话属实 ✓。
- P3-2：L125 补了 token 数 ≥ 96 的门槛 ✓。
- P3-3：frontmatter L57 `updated: "2026-10-02"` ✓。

### 抽查 4 个数字（vllm-ascend@2c59ff10，均对）
1. 默认值 dict（L67 / L80）：`vllm_ascend/ascend_config.py:709–716` 逐项一致；`:720` 用 `.get("prefetch_ratio", …)` 整体替换，和「不做逐键合并」一致 ✓。
2. `moe.gate_up` 门槛 ≥ 96（L86 / L125）：`vllm_ascend/ops/weight_prefetch.py:14` 定义 `MOE_PREFETCH_TOKEN_THRESHOLD = 96`，`:90` 判断条件是 `>=` ✓。
3. `mlp.*` 门槛 `num_tokens < 500`（L87）：同文件 `:146` ✓。
4. 18 MiB 上限（L84 / L114）：同文件 `:15` 定义 `MAX_PREFETCH_WEIGHT_SIZE = 18 * 1024 * 1024`，`mlp` 两项在 `:172–173`、`:182–183` 截断；`attn` / `moe`「由后端截」见 `docs/source/user_guide/feature_guide/weight_prefetch.md:32`（L2 大小限制，后端只预取 18 MB）✓。

### 新 P1
无。

### 新 P2
1. **GLM 段还有两个结构数字没链出处，和原 P1 同类。** 位置：L124「前 3 层的稠密 MLP」，L126「34 层 KDA 的投影……是 BF16」。数值都对：D「每张卡上放了什么」L160 写了前 3 层稠密 MLP；L167 表里是「KDA 层（主要是 BF16）× 34 层」；底稿 02 §0.4 L56 写各 34 层、BF16。问题有两点：L124 句里的两条链接指向 tensor-parallel，而那两节没提「前 3 层」；L126 整句没有任何链接。改法：在「前 3 层」和「34 层 KDA……BF16」两处加链接，指向 [glm-5-3-flash-two-node「每张卡上放了什么」](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)，不引入新数。

### 新 P3
1. **L125「只算这一部分也比 18 MiB 的单次上限大一个数量级以上」靠的是页面上已删掉的 288 MiB。** 读者从链接过去的 432 MiB 推不出「gate + up 占多少」，「一个数量级以上」（≥ 180 MiB）没法当场核对。结论本身对：288 / 18 ≈ 16 倍；乘 0.8 后约 12.8 倍。改法二选一：改成「远超」；或补半句「gate、up、down 三块等大，w13 占三分之二」，这是结构事实，不算新数。
2. **L125「写 0.8 还是 1.0 没有任何区别」是本页的推导结论，修订时把 `[D]` 一并删了。** 原 P1 要求去掉的 `[D]` 是给链接来的数用的，推出来的结论仍应标 `[D]`。L104 同类结论（Qwen 场景）就标着 `[D]`。改法：句末恢复 `[D]`；也可以写成「预取字节数相同（都被截到 18 MiB）」，让读者知道「没区别」指什么。

### 新改动有没有把推断写成定论
除新 P3-2（结论去了 `[D]`）外没有。L108「只有配置值和推导值、没有实测」的界线还在。L126 的「待核」仍然加粗，没有写成定论。全页没有新出现的收益数字。

### 环境与跳过
- 未读：sources 区；「版本谱系」「参数定义（自动生成）」两节；HANDBOOK；docs/plans/。
- 源码核对只在 2c59ff10 一个提交上先 grep 行号再读，没有被拦。有两次超过了每次 ≤ 20 行的要求：`weight_prefetch.py:160–185` 读了 26 行；`linear_op.py` 与 `activation.py` 在同一条命令里两段合计 36 行。
- 浏览器截图脚本临时放在 wiki 仓库 `tmp/`，用完已删。

### 复审 P2 / P3 修订（10-02）
「前 3 层的稠密 MLP」与「那 34 层 KDA 的投影」两处补链到 [glm-5-3-flash-two-node「每张卡上放了什么」](../../../../wiki/concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)（锚点已存在，站内多页在用），未引入新数；顺手修两条新 P3：「大一个数量级以上」改成「gate、up、down 三块等大，`w13` 占 432 MiB 的三分之二，远超 18 MiB」，「没有任何区别」改写成「预取字节数相同（都被截到 18 MiB）」并恢复 `[D]`。`pnpm wiki:lint`、`pnpm wiki:audit` 退出码均为 0，本页 0 待留意（正文 9890 字 / 来源 27 条）。

## P5 修订记录 2（Opus 5.5，10-02）：对齐 weight-prefetch-config 的触发路径结论

依据 `weight-prefetch-config-review.md` 的「P5 修订记录 3（GPT-6 Astra）」8 条触发路径结论与其中的文件 + 行号；按派发要求**没有**去读 `weight_prefetch.py` 88–105 一带，凡那 8 条结论没覆盖的都写成待核。处理的是同文件「P5 第三次复审」的 P1-6。

### 事实表（行数仍是 10 行，只改单元格）
1. `mlp.*` 生效条件：删掉「`down` 另需开序列并行」这个与源码相反的说法，改成「`gate_up` 还要经过自定义的行并行 `apply` 才有入口 [C29]（`ops/linear_op.py` 153–158），`down` 走带钩子的 SwiGLU 就行、不要求序列并行 [C28]（`ops/activation.py` 37–55）」，并补上「相关优化开关都默认关着的单卡 dense 连 `gate_up` 这一路调用都没有」。
2. `moe.gate_up` 生效条件：补齐「要有模型实例、上下文里的层索引为正、能取到 `w13_weight`」[C30]（`ascend_forward_context.py` 149–157），并写明 ≥ 96 不是充分条件。
3. `attn.*` 生效条件：改成「静态 W8A8 的 `apply` 里、输入还不是 int8、类名精确等于 `AscendQKVParallelLinear` / `AscendRowParallelLinear`」[C32]（`quantization/methods/w8a8_static.py` 74–122），并点出 `o` 没有 token 门槛、类名条件可能覆盖到 MLP 的 `down`。
4. 单次预取上限：原来写「`attn`/`moe` 由后端截」是定论，改成「Python 侧不截，后端是否另有上限**待核**」，「改比例看不出差别」这句限定到 `mlp` 两项。

### 正文
5. 「为什么存在」里 0.8 与 1.0 等价那段降级为条件结论：先说明 Python 侧只夹 `mlp`、`moe` 的后端上限待核，再写「**如果**后端也按 18 MiB 截，才会被截成同一个值」，并删掉据此做的字节重算（原来的 `H = 4096 / moe_intermediate = 1536` 示例连 `[A]` 一起去掉）。
6. 「开了的代价」里「超过 18 MiB 的部分白给」加了主语：只对 `mlp` 成立，`attn` / `moe` 待核。
7. GLM 段 `moe.gate_up` 那条按新结论重写：不再说「唯一落得上、饱和了的旋钮」，改成**一次都不会发**——主干 MoE 分支取回的权重是空的、清状态直接返回 [C31]（`models/glm5_next.py` 2282–2286），MTP 那条独立 context 没传模型实例、在更早的检查处就返回；比例写多少都一样，原因是这条路没走，不是被截到上限。
8. GLM 段 `attn` 那条重写：`attn.qkv` 一定不发（GLM 没有 `AscendQKVParallelLinear` 类型的层，与量化清单齐不齐无关）；`attn.o` 是这套部署上唯一可能真发出去的一项，但仍要落在静态 W8A8 的 `apply` 且输入非 int8，**待核**缺的仍是 `quant_model_description.json`。
9. 新增一段界定范围：MLA / SFA 那两条路径只看 `enabled`，融合 QKV 整块、`o_proj` 按自己的固定上限取较小值，都不读这五个比例，细节链到机制页的事实表（结论 7、8）。

### 来源与验证
- sources 末尾追加 5 条（均为 db701c1f）：`ops/activation.py#L37-L55`、`ops/linear_op.py#L153-L158`、`ascend_forward_context.py#L149-L157`、`models/glm5_next.py#L2282-L2286`、`quantization/methods/w8a8_static.py#L74-L122`，对应正文的 [C28]–[C32]；共 32 条。
- 机制细节一律链接 [weight_prefetch_config 页](../../../../wiki/params/weight-prefetch-config.md#开了的代价)与其[事实表](../../../../wiki/params/weight-prefetch-config.md#事实表)，本页不重抄触发流程。
- `pnpm wiki:lint` 退出码 0，本页 0 报错、0 待留意（为腾出标记额度，删掉了 3 处随结论一起失效的 `[D]`、1 处 `[A]` 和事实表里重复的 `[S14]`）。
- `pnpm wiki:audit` 退出码 0；本页「正文 10543 字 / 6 节 / 来源 32 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 正文字数（含自动生成节，去空白字符）：14,915 → 16,634。
- 未读 `weight_prefetch.py`（含 88–105 一带），未改其他页。

## P5 复审 2（10-02）

独立复审员（P1 复审），只审不改页面。对象：「P5 修订记录 2」按 weight-prefetch-config「P5 修订记录 3（GPT-6 Astra）」8 条触发路径结论改过的现文。

**结论：7 / 10。正文主体已对齐记录 3：事实表 L90–L93、范围段 L108、GLM 段 L132–L134。「一次都不发」在记录 3 第 3、4 行和源码里有依据。但页面还残留两处旧口径：主图与 L100，L122 的 Qwen 指引句。新 P1 2 条、新 P2 1 条、新 P3 1 条。C28–C32 行号 5/5 对上，其中 C30、C31 只能支撑前提。`pnpm wiki:lint` 退出码 0，全库 4 处待留意，都不在本页。`pnpm wiki:audit` 退出码 0：本页 evidence=C，正文 10543 字 / 6 节，来源 32 条全部 ✓；全库无效 commit、文件不存在、行号越界都是 0。**

### 1. 触发 / 门槛说法逐条对照记录 3
- 第 1 行 mlp gate_up：L93 写了要经自定义行并行 `apply` [C29]，也写了默认开关全关的单卡 dense 没有这路调用 ✓。L122 有残留，见 P1-2。
- 第 2 行 mlp down：L93 写的是带钩子的 SwiGLU、不要求 SP [C28] ✓。
- 第 3 行主干 MoE：L92 写明 ≥ 96 不是充分条件，还要有实例、层索引为正、取得到 `w13_weight` ✓。L133 写主干取回为空、清状态返回、一次都不发 ✓。
  - 依据：记录 3 第 3 行「取权重为空，清 active 返回，所有宽度均不发」。
  - 本轮在 db701c1f 上单行 grep：`weight_prefetch.py:115` 在索引为空或 ≤ 0、或实例为空时返回 None；`:131` 取 `w13_weight`。
  - 机制页 L176 口径相同。
- 第 4 行 MTP：L133 写独立 context 没传模型实例、在更早的检查处返回 ✓。这句没有角标，链到机制页。
- 第 5 行 attn.qkv：L134 写一定不发、与量化清单无关 ✓。
- 第 6 行 attn.o：L91 写无 token 门槛、可能覆盖 MLP down ✓；L134 写唯一可能发出、待核 `quant_model_description.json` ✓。
- 第 7 行 MLA/SFA 融合 QKV：L108 写只看 enabled、请求整块、不读比例 ✓。
- 第 8 行 o_proj：L108 写取较小值、不读比例 ✓。但「只看 enabled」漏了「量化方法不是静态 W8A8」这个条件，见 P3-1。
- 上限：L90、L112、L122 已把 attn/moe 的后端上限写成待核，0.8 与 1.0 等价也降成了条件结论 ✓。图和 L100 没跟着改，见 P1-1。
- 旧口径 grep（饱和 / 唯一 / 序列并行 / 后端 / 截 / 两项 / 读到）：正文只剩 L100、L122 两处有问题。「版本谱系」「参数定义」两节没有命中。

### 2. 来源行号抽核（vllm-ascend@db701c1f，最窄读法）
1. C28 `ops/activation.py` 37–55：`AscendSiluAndMul` 和带 Clamp 的变体在 `forward_oot` 里调 MLP_DOWN 的 preprocess / postprocess，没有 SP 判据 ✓。
2. C29 `ops/linear_op.py` 153–158：`CustomRowParallelOp`（类定义在 L140）的 `apply` 调 MLP_GATE_UP 的 preprocess ✓。
3. C30 `ascend_forward_context.py` 149–157：`layer_idx` 先置 None；模型有层索引属性时设成 `model.start_layer`，并写入 `model_instance`。行号对 ✓。但这几行只说明索引和实例从哪来，「索引为正、取得到 `w13_weight`」的判断在 `weight_prefetch.py` 115、131。
4. C31 `models/glm5_next.py` 2282–2286：`make_layers` 返回 `start_layer` / `end_layer` / `layers`。行号对 ✓。但 L133 把它挂在「取回来是空的、清掉状态直接返回」句末，所引的行里没有这个行为。
5. C32 `quantization/methods/w8a8_static.py` 74–122：`apply` 里 L81 先判 `x.dtype != torch.int8`，L85 调 attn preprocess，L119 调 postprocess ✓。类名精确匹配另由 [C4] 支撑：`weight_prefetch.py` 46–69，L55–56 按 `__name__` 映射 ✓。

结论：5 条行号都对上。3 条能完整支撑所挂的说法；C30、C31 只能支撑前提，见 P2-1。

### 3. 数字
- 本页没有新算式。L132 的前 3 层、每卡每层 18 MiB、gate_up / down 两块，L133 的 18 个专家、432 MiB，L134 的 34 层 KDA / BF16，都只链到 D 或 tensor-parallel 的出处 ✓。
- L112 的 22.5 MiB 即 18 ÷ 0.8，标了 [D]，放在条件句里 ✓。
- 96、500、18 MiB 是源码常量，单行 grep 确认在 `weight_prefetch.py` 的 :14、:15、:90 ✓。
- 与机制页对照：机制页 L120、L273 写 18 MiB 只截 MLP 正字节路径、MoE/attn 后端上限待核，L176 写 MoE 任何宽度都不发，和本页 L90、L133 一致 ✓。机制页 L149、L161 的 Qwen 记录与本页 L122 冲突，见 P1-2。

### 新 P1
1. **P1-1　主图和「为什么存在」第二段仍把后端截断、0.8 与 1.0 等价写成定论（P1-6 第 4 项没改完）。**
   - 位置：`wiki/diagrams/prefetch-ratio.yaml`。第 3 行 caption 写「再被 18 MiB 夹一次」。第 13 行 region note 写「差别只在谁来夹上限」。第 50–51 行的盒子是「② 夹到 18 MiB / mlp 自己夹，其余靠后端夹」。第 79 行标注是「权重一超过 22.5 MiB，0.8 和 1.0 在这里被夹成同一个数」。页面 L100 也写「再被 18 MiB 夹一次」。
   - 影响：这是本页主图，读者最先看到的是所有比例都被夹到 18 MiB、0.8 等于 1.0。这和本页 L90、L112、L122 以及机制页 L120、L273 的「待核」直接矛盾，问答检索图注时也会拿到旧答案。
   - 同图还有两处：第 35–37 行把 `mlp.gate_up / down` 都挂在 `AscendSiluAndMul` 上，但 gate_up 的入口是 `CustomRowParallelOp.apply`（C29）；moe 盒子只写了 token ≥ 96。
   - 改法：
     - caption 改为「再看是否被截：mlp 在 Python 侧截到 18 MiB，attn / moe 的后端上限待核」，② 盒子的 sub 和 L100 跟着改。
     - 第 79 行标注改成条件句，或换成只对 mlp 成立的例子。
     - mlp 盒子拆成 gate_up→`CustomRowParallelOp`、down→`AscendSiluAndMul`；moe 盒子补「且取得到 `w13_weight`」。
     - 改完跑 `pnpm wiki:diagrams --check`。
2. **P1-2　L122 的 Qwen3-0.6B 指引句残留「旧 Qwen 两项都会读」，这正是记录 3「数字、跨页口径」点名的历史结论。**
   - 位置：L122 末句「五个比例里只有 mlp 那两项会被读到……比例调多少就搬多少」。
   - 问题：本页 L93 已写明默认开关全关的单卡 dense 连 gate_up 的调用都没有，这句和 L93 自相矛盾。它也和链接目标相反：机制页 L149、L161 写的是只开本参数时只请求 down 的整块 6 MiB，gate_up 默认没有入口。同句前半「稠密模型的 gate_up_proj……只是个饱和了的旋钮」也缺了「走得到自定义行并行入口时」这个前提。
   - 改法：末句改为「只开本参数时，五个比例里只有 `mlp.down` 会被读到（6 MiB，未到上限，比例调多少就搬多少），`gate_up` 默认没有入口」；前半句补上前提。

### 新 P2
1. **C30、C31 挂在撑不起的结论上，「一次都不发」的决定性源码没有引。**
   - 位置：L92 [C30]、L133 [C31]。
   - 问题：所引的行只说明两件事：层索引初值是 start_layer、实例写进了上下文；GLM 的 start_layer 由 make_layers 给出。真正决定「取不到、直接返回」的是 `weight_prefetch.py` 115、131，以及 98–101、186；后两处由第三次复审核过，本轮没有复核。页面也缺因果那半句：单流水线 start_layer = 0，MoE 路径不推进索引，所以索引不为正。
   - 改法：sources 按记录 3 的行号补 `vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L112-L131`，不必读 88–105。L92、L133 改挂新角标；C30、C31 只留给「索引从 start_layer 起」那半句。L133 补一句因果。

### 新 P3
1. L108「MLA / SFA 那两条路径走到调用点后只看 `enabled`」对 o_proj 不完整。记录 3 第 8 行写明 o_proj 还要量化方法不是静态 W8A8 才发，是静态的就直接跳过。改法：o_proj 那半句补上这个条件。

### 环境与跳过
- 页面正文用 awk 去掉 frontmatter 后分段读，读了 L71–L113 和 L114–L139 两段，每段不超过 60 行。sources 区只 grep 了 C4、C28–C32 对应的单行，用来确认编号。「版本谱系」「参数定义（自动生成）」两节没读正文，只 grep 了关键词。
- 源码只在 db701c1f 上按行号窗口 grep 关键词。`weight_prefetch.py` 只做了单行 grep（L10、14、15、55、56、90、115、131），**没有整段读 88–105**；L186 的递增本轮没有命中，沿用第三次复审的核对。
- 没读 HANDBOOK、docs/plans/ 和 csrc；没开子代理，没起服务，也没截图。本轮只审口径和引用，图的问题按 yaml 文本判定。
- 没有被拦。

## P5 修订记录 3（Opus 5.5，10-02）：补齐图与残留口径

对应「P5 复审 2」的 P1-1、P1-2、P2-1、P3-1。

### P1-1 主图与 L100（图 `wiki/diagrams/prefetch-ratio.yaml` 重排）
- caption 改为「先乘成字节数；之后 mlp 在 Python 侧截到 18 MiB，attn / moe 的后端上限待核」；第二个 region 的 note 改成「差别在于截不截、由谁来截」。
- ② 盒子从「夹到 18 MiB / mlp 自己夹，其余靠后端夹」改成「② 看要不要截 / mlp 截到 18 MiB；其余待核」。
- 括号标注从「权重一超过 22.5 MiB，0.8 和 1.0 被夹成同一个数」改成「mlp 这一侧超过 18 MiB 就被截平，0.8 与 1.0 可能等价；attn / moe 要等后端上限核实」。
- 入口那一排由 3 个盒子拆成 2×2 四个：`attn.qkv / attn.o`（静态 W8A8 的 apply、按类名精确匹配）、`moe.gate_up`（token ≥ 96，还要取得到 `w13_weight`）、`mlp.gate_up`（入口在行并行 `apply`，`fn: CustomRowParallelOp`）、`mlp.down`（带钩子的 SwiGLU）。盒子宽度从 190 改到 390 才放得下文案（190 宽时生成器报「只放得下 122px」）；画布高度 716 → 786，宽度仍是 900，箭头与下方元素整体下移 70。
- pins 增加 `vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L153-L158 → CustomRowParallelOp`。
- 正文 L100 同步：「再被 18 MiB 夹一次」改成「再看这一组要不要截——mlp 截到 18 MiB，attn / moe 交给后端，后端有没有同一档上限**待核**」。

### P1-2 Qwen 指引句（正文 L123）
末句改成「只开本参数、其余相关开关默认关着时，实际被读到的只有 `mlp.down`（整块 6 MiB，没顶到上限，比例调多少就搬多少），`gate_up` 默认连入口都没有」，与机制页一致；前半句补上「走得到行并行 `apply` 这个入口时」这个前提。

### P2-1 角标改挂（正文 L92、L134）
- sources 追加第 33 条 `vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L112-L131`（按记录 3 给的行号写入，**没有**读 88–105 一带），正文引为 [C33]。
- 事实表 moe 行的「要有模型实例、层索引为正、取得到 `w13_weight`」改挂 [C33]，[C30] 退回只撑「索引初值来自 `start_layer`、实例由上下文写入」这半句。
- GLM 段补上因果并改挂：取权重那步在索引为空、≤ 0 或实例为空时返回空，取到空就清状态不发 [C33]；GLM 只有一级流水线、索引初值 `start_layer` = 0 [C31]，MoE 这条路不推进索引，所以索引始终不为正。MTP 那条按机制页结论写，并明说本页没有另引源码。

### P3-1
范围段补上 `o_proj` 的条件：包装它的量化方法不是静态 W8A8 才发，是静态的直接跳过。

### 旧口径全页清查
`grep -n '夹一次|夹上限|由后端夹|后端截|序列并行|饱和|两项会被读到|唯一落得上|18 MiB 夹'` 跑过正文与 yaml：命中三处都是改后的新表述（`down` **不要求**序列并行、`mlp` 超过 18 MiB 的部分白给、`moe.gate_up` 看着像唯一落得上**实际一次都不会发**），没有第三处残留；yaml 内 18 MiB / 后端 / SiluAndMul / 96 四个关键词也逐条看过，均为新口径。

### 验证
- `pnpm wiki:diagrams`：重算后写入 `diagrams/prefetch-ratio.svg`；`pnpm wiki:diagrams --check` 退出码 0，290 张图与 spec 一致。
- `pnpm wiki:lint` 退出码 0，本页 0 报错、0 待留意（新增 [C33] 后标记到 33 处，删掉 1 处重复 [C32]、1 处重复 [C30] 和 1 处可用行文替代的 [I]）。
- `pnpm wiki:audit` 退出码 0；本页「正文 10884 字 / 6 节 / 来源 33 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 浏览器：`http://localhost:5193/#/wiki/prefetch-ratio`（服务本来就在跑，没有另起）1440 宽看过首屏与图，四个入口盒子、三步算式、括号标注都在框内，文字没有溢出。

## P5 复审 3（10-02）

独立复审员（第三次复审），只审不改页面。对象是「P5 修订记录 3」改完后的现文、`wiki/diagrams/prefetch-ratio.yaml` 和 `wiki/diagrams/prefetch-ratio.svg`，对照基准是 weight-prefetch-config-review.md「P5 修订记录 3（GPT-6 Astra）」里的 8 条触发路径结论。

**结论：9 / 10。复审 2 的 P1×2、P2×1、P3×1 都已修好。旧口径 grep 正文、yaml、svg 都无残留。抽核 4 条出处，行号 4/4 对上。新 P1 0 条，新 P2 0 条，新 P3 2 条。`pnpm wiki:lint`、`pnpm wiki:diagrams --check`、`pnpm wiki:audit` 退出码都是 0。浏览器里主图渲染正常。**

### 1. 复审 2 各条的修复情况
- **P1-1 主图与 L101 ✓**
  - yaml 第 3 行 caption 已改成「mlp 在 Python 侧截到 18 MiB，attn / moe 的后端上限待核」。第 13 行 note 改成「差别在于截不截、由谁来截」。② 盒子改成「看要不要截 / mlp 截到 18 MiB；其余待核」。第 85 行括号标注改成条件句：「mlp 这一侧……0.8 与 1.0 可能等价；attn / moe 要等后端上限核实」。
  - 入口拆成 2×2 四个盒子。mlp.gate_up 对应 `CustomRowParallelOp`，mlp.down 对应 `AscendSiluAndMul`。moe 盒子补上了「还要取得到 w13_weight」。pins 补了 linear_op 153–158。这些与记录 3 第 1、2、3、5、6 行一致。
  - 正文 L101 改成「再看这一组要不要截……后端有没有同一档上限待核」，与 L91、L113 口径一致。
  - svg 文本 grep 结果：「夹」0 处，新表述都在。
- **P1-2 Qwen 指引句（现 L123）✓**
  - 末句改成：只开本参数时，实际被读到的只有 `mlp.down`（整块 6 MiB，没到上限），`gate_up` 默认没有入口。
  - 前半句补上了「走得到行并行 `apply` 这个入口时」。
  - 与机制页 weight-prefetch-config.md L161 一致（本轮单行 grep 确认），与本页 L94「单卡 dense 连 gate_up 这一路调用都没有」也不再冲突。
- **P2-1 角标改挂 ✓（还有一处颗粒度问题，见 P3-1）**
  - L93 的「要有模型实例、层索引为正、能取到 `w13_weight`」改挂 [C33]，[C30] 只留给「索引初值来自 start_layer、实例由上下文写入」这半句。
  - L134 补上了因果链：取权重时返回空 → 不发；PP1 下 start_layer = 0；MoE 路径不推进索引。MTP 那条注明本页没有另引源码。
- **P3-1 o_proj 条件（L109）✓**：补上了「包装它的量化方法不是静态 W8A8 才发，是静态的直接跳过」，与记录 3 第 8 行一致。

### 2. 抽核 4 条出处（最窄读法：只 grep 窗口内带关键词的单行）
1. **C33** `vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L112-L131` ✓。
   - L112 是 `_get_moe_gate_up_prefetch_weight`；L115–116 在索引为空、≤ 0 或实例为空时返回 None；L128–129 在 experts 为空时返回 None；L131 取 `w13_weight`。能支撑 L93 的门槛和 L134 的「取权重返回空」。
   - 「取到空就清掉状态」不在这个范围内：调用点是 L98，置 False 在 L100。本轮只做了单行 grep，没读 88–105 整段。见 P3-1。
2. **C30** `ascend_forward_context.py#L149-L157` ✓。L151 先置 None，L152–153 有层索引属性时设为 `start_layer`，L157 写入 `model_instance`。现在只挂在这半句上，撑得住。
3. **C31** `models/glm5_next.py#L2282-L2286` ✓。这几行是 `self.start_layer, self.end_layer, self.layers = make_layers(...)`。
   - 它能说明 GLM 的 start_layer 来自 make_layers，但 PP1 时等于 0 这一点不在所引的行内。vllm@0fc695fc 的 `model_executor/models/utils.py` L652 由 `get_pp_indices` 给出 start_layer，本页没有引。见 P3-1。
4. **C6** `vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186` ✓。L172–173 截 gate_up，L182–183 截 down，常量在 L15，值为 18 × 1024 × 1024。
   - 全文件 grep `MAX_PREFETCH_WEIGHT_SIZE` 只有 L15、172、173、182、183 这几处，说明 Python 侧确实只截 mlp 两项，L91 / L101 / L113 的说法成立。
   - 顺带确认：L186 是全文件唯一一处 `layer_idx + 1`，位于 mlp down 的 preprocess 里，与「MoE 路径不推进索引」一致。

### 3. 旧口径全页 grep（自查）
- 正文与 yaml grep 的关键词：夹一次、夹上限、谁来夹、由后端夹、后端截、后端统一、统一截、饱和、唯一生效、唯一落得上、两项会被读、两项都会读、被夹成、夹成同一、截成同一、序列并行、18 MiB 夹、只有 moe、0.8 和 1.0、0.8 与 1.0、SiluAndMul。
- 命中 4 处，都是新口径：
  - L94「**不要求**序列并行」。
  - L113「**如果**后端也按 18 MiB 截……截成同一个值」，是条件句。
  - L123「走得到行并行 `apply` 入口时……饱和了的旋钮」，有前提。
  - L134「看着像唯一落得上，实际一次都不会发」。
- yaml 命中 `AscendSiluAndMul`（只挂在 mlp.down）和第 85 行条件句。
- 「版本谱系」「参数定义（自动生成）」两节和 frontmatter summary 用 18 MiB / 后端 / 夹 / 截 / 唯一 / 生效 / Qwen3-0.6B grep 均 0 命中。svg 中「夹」0 处。

### 4. 工具与浏览器
- `pnpm wiki:lint` 退出码 0。全库 4 处待留意（mark-flood），都不在本页。
- `pnpm wiki:diagrams --check` 退出码 0，290 张图与 spec 一致。警告里没有 prefetch-ratio。
- `pnpm wiki:audit` 退出码 0。本页 evidence=C，正文 10884 字 / 6 节，来源 33 条全部 ✓。全库无效 commit、文件不存在、行号越界都是 0。
- Playwright 只读访问 http://localhost:5193/#/wiki/prefetch-ratio（1440 宽，服务本来就在跑，没起停）：主图 svg 900×786，31 个 text 元素，横向溢出 0，页面无 console / pageerror。四个入口盒子、①②③ 三步、括号标注和底部两条注都在框内。截图在本会话 scratchpad：`prefetch-ratio-review3-diagram.png`、`prefetch-ratio-review3-top.png`。

### 新 P1
无。

### 新 P2
无。

### 新 P3
1. **L134 的因果链有两环出处颗粒度不够（P2-1 的余项）。**
   - 「取到空就清掉状态、这一次不发 [C33]」：清状态在 `weight_prefetch.py` L98–100，不在 C33 的 L112–131 内。
   - 「只有一级流水线、start_layer = 0 [C31]」：C31 只说明 start_layer 来自 make_layers，「= 0」要由 vllm 的 `get_pp_indices` 支撑。
   - 「MoE 这条路不会把索引往上推」没有角标。
   - 结论本身由记录 3 和本轮 grep 支撑，不算错。
   - 改法：C33 的范围扩到 `#L98-L131`；「不推进」挂 [C6]（L186 是唯一的 +1，在 mlp down 里）；「= 0」补 `vllm@0fc695fc:vllm/distributed/utils.py#L109-L154`，或把 [C31] 的句子收窄成「初值取 make_layers 给出的 start_layer」。
2. **主图入口区只有下排两个 mlp 盒子有箭头连到算式区**（yaml arrows 第 3、4 条从 y=316 出发）。上排 attn / moe 没有连线，乍看会以为只有 mlp 走这条算式，和 note「三组共用这条算式」不一致。改法：箭头改从入口 region 底边（y=344）出发，或在两区之间加一条横跨的汇合线。

### 环境与跳过
- 页面正文用 awk 去掉 frontmatter 后分两段读：L71–L114、L115–L140，每段 ≤ 60 行。sources 区只 awk 打印了 C4–C7、C30–C33 对应的单行，用来确认编号（编号 = 列表序号减去 aliases 2 条和 chapters 1 条）。「版本谱系」「参数定义」两节只 grep 关键词，没读正文。
- 源码只按行号窗口 grep 单行关键词：db701c1f 的 weight_prefetch.py 112–131、ascend_forward_context.py 149–157、glm5_next.py 2280–2287；2c59ff10 的 weight_prefetch.py 158–186；vllm@0fc695fc 的 models/utils.py 632–663。**没有整段读 weight_prefetch.py 88–105**，全文件关键词 grep 碰到的 L89–100 只看了单行。
- 没读 HANDBOOK、docs/plans/、csrc。没开子代理，没起停服务，也没有被拦。
- 小笔误（不计分）：修订记录 3「验证」里写的「diagrams/prefetch-ratio.svg」，实际路径是 `wiki/diagrams/prefetch-ratio.svg`。

### P5 修订记录 4（Opus 5.5，10-02）：复审 3 的两条 P3
P3-1 因果链出处收紧：C33 范围按复审指的扩到 `weight_prefetch.py#L98-L131`（仍未读 88–105 一带），「只有 `mlp.down` 那一处把索引加一、MoE 这条路不推进它」改挂 [C6]（`weight_prefetch.py#L158-L186`），「PP = 1 时 start_layer = 0」新增来源第 34 条 `vllm@0fc695fc:vllm/distributed/utils.py#L109-L154` 并引为 [C34]，[C31] 收窄成「初值取 `make_layers` 给出的 `start_layer`」。P3-2 主图箭头：删掉只从下排两个 mlp 盒子出发的两条竖箭头，改成从入口区中缝汇成一条进算式区，四个入口一视同仁。为腾额度删了两处与事实表重复的角标（`为什么存在` 的 [C4]、事实表标定场景行的 [S14]）。`pnpm wiki:lint` / `wiki:diagrams --check` / `pnpm wiki:audit` 退出码均 0，本页 0 待留意（正文 10951 字 / 来源 34 条）；5193 上复看主图，箭头与四个盒子显示正常。
