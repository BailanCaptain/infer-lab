# enable-force-eplb-b7ec3661121f 审查记录

## P5 写作记录（2026-10-02，第 27 批小修）

**改了什么。** 保留参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容，未加图（本页原本无图，「沿用现有图」即不动）；正文 5,333 → 6,384 字（wiki:audit 口径）。
1. 一句话节：「每个专家、每张卡收到的 token 数完全相等」改为「每张卡完全相等，专家之间最多差 1 个」（源码推导见下）。删掉旧算例段（Qwen3-0.6B 无 MoE），换成「放到 GLM 双机：本部署没开，也开不了」两段：本部署两个版本没有这个键、写了静默忽略；假如换 main 跑 GLM，288 ÷ 16 整除、dynamic EPLB 没开 → 不报错、输出不可用（按源码推断 [D]）；唯一说得通的用途是把 EPLB 页那组理想均分数变成可测的均匀负载，耗时实测写成待核，不给收益数字。
2. 事实表（仍为 10 行，lint 上限 10）：「类型 / 默认」行并入「GLM 双机没开」；「换掉的是什么」补 mix_placement 时共享专家列也被换掉；「与 EPLB 摆放的关系」补互斥检查只看 dynamic EPLB、静态表带冗余专家时轮转编号被当物理编号用的问题（按源码推断，未实跑 [D]）；「硬约束」改正：逻辑专家数是模型自己的路由专家数，冗余专家已被减掉，加不加冗余都改变不了这条（旧版说「用冗余专家弄成不能整除」不对），补 GLM 288 ÷ 16 = 18 不触发。
3. 为什么存在：「整除条件成立时每个专家恰好拿到 n×k/E」改为准确条件——连续 ep_size 个槽位每卡各一、连续 E 个槽位每专家各一，故槽位数是 ep_size 倍数时每卡严格相等、专家最多差 1；用事实表已有的 [[6,3],[7,0]] 例子演一遍（每卡 2 个，8 个专家里 4 个为 0）。
4. 标记数控制在 30 以内（mark-flood）：删掉「为什么存在」入口句和「开了的代价」第一段里重复的 [C4]，GLM 段只留 [C21]。
5. frontmatter：summary 改「每张卡」并补「GLM 双机部署用的版本里没有，没开」（约 120 字）；relations 新增 eplb（conflicts-with）；sources 追加第 21 条 db701c1f ascend_config.py#L32-L38、第 22 条 baa023ad moe_utils.py#L265-L276；updated 改为 2026-10-02。

**数字出处。** 288 路由专家选 8、42 层 MoE：docs/mainline/02-forward.md 模型参数表（L29–L30）；EP16、每卡 18 个：D 页部署前提；每卡 6,048 行、纯 decode 每卡 38 行：02 §8.6「专家负载」（页面链接 eplb「负载有多不均」转述，不重算）。288 ÷ 16 = 18 为整除检查本身。轮转表性质（每卡相等、专家差 ≤1；GLM 形状下 4 个 token 一张表只覆盖 32 个专家、每卡 2 个）用 Python 按 force_eplb.py#L130-L141 的公式复算核对，页面只写了通用性质和事实表已有的 8 专家例子。没有本开关的收益实测，未写任何效果数字。

**核对的源码（钉住版本）。**
- 键是否存在：git grep enable_force_eplb / force_eplb 在 2c59ff10、db701c1f、2ed6cbba 的 vllm_ascend 与 docs 下 0 处；baa023ad 有 4 个文件（ascend_config.py、force_eplb.py、routed_experts.py、model_runner_v1.py）。2825e368（PR #15499）是 baa023ad 的祖先；2ed6cbba 提交日期 2026-09-17。
- 默认与互斥：baa023ad ascend_config.py:467（bool = False）、:564–570（四条件 → ValueError，报错原文已在页面逐字给出 [C3]）。
- 老版本读配置：2c59ff10 与 db701c1f ascend_config.py:32–38 逐键 .get()，无顶层未知键检查（2ed6cbba 的 unknown 检查只针对 short_request_first_config 子配置）。
- 入口与顺序：baa023ad routed_experts.py:594–595 先 log2phy，:606–621 mix_placement 追加共享专家列，:623–625 本键在 enable_force_load_balance 的 elif 之前整表替换。
- 逻辑专家数：baa023ad moe_utils.py:265–276（优先 moe_config.num_logical_experts，否则 num_experts − 冗余 − 共享）。
- 建表与整除检查：force_eplb.py:89–105（top_k 取 topk_ids 的列数，含 mix_placement 追加列）、:124–128（整除报错）、:130–141（轮转公式）；预建 model_runner_v1.py:4193–4195（非捕获 + is_moe）。
- GLM 在 main 走这条路：models/glm5next/model.py 用上游 FusedMoEFactory，patch/platform/patch_fused_moe.py 把 routed experts 组合成 AscendRoutedExperts（:54–70），故会经过 _select_experts。

**旧版信息清单勾选**（清单存旧会话 scratchpad p5/enable-force-eplb-b7ec3661121f-facts.md，F1–F23；旧版 = p4-checkpoint，与改前现版 diff 为空）。
- F1：保留，「每个专家完全相等」改为「每卡相等、专家差 ≤1」（源码推导 + 复算）。
- F2、F3、F5–F9、F11–F15、F17–F23：原样保留（F17 去掉重复 [C4]，改为指向事实表；F19 去掉重复 [C4]）。
- F4（Qwen3-0.6B 无 MoE）：删除，旧算例已不是主线；换成 GLM 双机两段。
- F10：数值条件保留；「用冗余专家弄成不能整除」删除并改正——冗余专家不计入逻辑专家数（moe_utils.py:265–276）。
- F16：轮转机制保留；「整除条件成立时每专家恰好 n×k/E」改为准确条件并加 8 专家示意演算。

**P1 疑点。** 无已确认的 P1。旧版两处说法不准已改正（专家完全相等、冗余专家触发整除错误），属 P2 级。两条按源码推断、未实跑：静态表带冗余专家 + 本键时每卡不再均分；mix_placement 时共享专家列被换掉。另见源码细节未写进页面：get_force_eplb_topk 在 forward context 的 moe_comm_method 为 None 时返回 None，调用处直接赋给 topk_ids，何时为 None 未跟，待核。

**三检。** pnpm wiki:lint 本页 0 报错（整站退出码 1 来自他页 enable-pcp-embedding-lmhead-weight-sharding 的 summary 超长，不是本页；中途本页一次 facts-overflow 11 行已合并为 10 行；一次 mark-flood 31 处已降到 30）；pnpm wiki:diagrams --check 290 张一致；pnpm wiki:audit 通过，本页来源 22 条，行号全部有效。

**跳过。** 无。

## P5 审查（10-02）

审查员：独立审查（只审不改页面）。口径：参数页小修，保持四段式，不按深入页骨架扣分。

**结论：8.5 / 10。P1 0 条，P2 2 条，P3 2 条。** wiki:audit 本页通过（来源 22 条、行号全部有效，整站 exit 0）；wiki:lint 整站 exit 0，本页无报错无提示。

**旧版信息清单。** 存在：旧会话 scratchpad `p5/enable-force-eplb-b7ec3661121f-facts.md`（F1–F23）。抽 6 条到新版确认：F3（只在 main / PR #15499 / 老两版逐键 .get() / main extra=forbid）→ 正文「存在范围」段在；F7（每次 MoE 前向、排在 enable_force_load_balance 的 elif 前）→ 事实表「生效范围」在；F9（三条件互斥、非 MoE 不报错）→ 事实表「互斥」在；F12（缓存键）→ 事实表「缓存」在；F13（_dummy_run 预建、capture_sizes 为空退化）→ 事实表「图捕获前预建」在；F22（形状不合法是运行期错误、四条参数化用例）→「开了的代价」末段在。`git diff` 删掉的行逐条对照：旧一句话、旧算例（Qwen3-0.6B，F4，按写手说明删除）、三行事实表、轮转段、入口句、代价段的 [C4] 均有对应新文，无丢信息。

**写手说修正的 2 处旧错（对照 baa023ad 源码核实）。**
1. 「每个专家、每张卡完全相等」→「每卡相等、专家最多差 1」：正确。force_eplb.py:130–141，cursor 连续，`(cursor mod ep_size, ⌊cursor/ep_size⌋ mod experts_per_rank)` 等价于 cursor 对「专家数」取模的混合进制表示，所以任意连续 ep_size 个槽位每卡各一、任意连续「专家数」个槽位每专家各一；槽位数 = q×E + r 时各专家拿 q 或 q+1。页面的条件表述（槽位数是 ep_size 倍数时每卡严格相等；是专家数倍数时每专家才恰好相等）准确。
2. 「用冗余专家弄成不能整除」→ 冗余不计入逻辑专家数：正确。moe_utils.py:265–276 优先取 moe_config.num_logical_experts，否则 num_experts − 冗余 − 共享；routed_experts.py:600 起就是用这个值调 get_force_eplb_topk（:624）。
- 示意演算手算：8 专家、ep_size=2、ep_rank=1、2 token、top-2 → offset = 4×1+1 = 5，cursor 5,6,7,8 → col 1,0,1,0，row 2,3,3,0 → id 6,3,7,0，与页面 `[[6,3],[7,0]]` 及「每卡 2 个、4 个专家为 0」一致。
- 其他新增句核实：mix_placement 共享专家列被一并替换（routed_experts.py:607–618 先追加列，force_eplb.py:97 的 top_k 取 topk_ids 列数，含追加列）属实；互斥检查只看 dynamic EPLB（ascend_config.py:564–570，四个条件：本键、dynamic_eplb、model_config 非空、is_moe）属实；静态表带冗余时轮转编号被当物理编号用、每卡不再均分——推理链成立（log2phy 在 :594–595 先做，替换在 :623–625 之后无再映射），页面已标「按源码推断，未实跑 [D]」，口径合适。
- 老版本静默忽略：2c59ff10 / db701c1f / 2ed6cbba 的 vllm_ascend 与 docs 下 `force_eplb` 0 处；db701c1f ascend_config.py:32–38 逐键 .get()，全文无未知键检查。属实。
- GLM 在 main 走 AscendRoutedExperts：patch/platform/patch_fused_moe.py:54–70 组合类，属实；「服务照常起来、输出不可用」标 [D]，合适。

**数字。** 288 路由专家、42 层 MoE：02-forward.md L29–L30 属实；288 ÷ 16 = 18 为算术；每卡 6,048 行、纯 decode 每卡 38 行：转述 eplb 页 L226 / L263，带链接、未重算，符合单一出处。没有本开关的收益数字，耗时明确写「待核、本页不给任何收益数字」——未虚构，未把 GLM 主线数字当成本开关效果，不触发 P1。

**与 eplb 页的重复。** 只用一个分句交代 EPLB 做什么并链到 eplb 页，理想均分数字链到「负载有多不均」，GLM 未开 EPLB 链到其 GLM 双机一节——符合「一句话 + 链接」。

**链接与锚点。** `glm-5-3-flash-two-node.md#部署前提`、`eplb.md#放到-glm-双机本部署没开-eplb`、`eplb.md#负载有多不均只有理想均分没有实测` 均对应现有标题；入链 eplb.md:270、index.md:112/213 为整页链接，可解析；lint 通过。

**浏览器实测。** Playwright 1440 宽打开 http://localhost:5193/#/wiki/enable-force-eplb-b7ec3661121f，标题区、一句话、事实表正常渲染，链接与角标正常（截图 scratchpad `enable-force-eplb-b7ec3661121f-review-1.png`、`-review-2.png`，审查会话 1237c9d2）。

**问题清单。**
- **P2-1 学习顺序：GLM 双机两段放在「一句话」节里，排在「为什么存在」之前。** 位置：一句话节第 4、5 段（「放到 GLM 双机：本部署没开，也开不了」「它在 GLM 上唯一说得通的用途」）。影响：第一屏后半被 288 ÷ 16、42 层、6,048 / 38 行占据，读者还没读到「为什么要有这个夹具」就先看部署推断，违反共同要求「先讲为什么、代价，之后才落到 GLM 数字」。不记 P1：定义和性质（是什么、是夹具）已先讲。改法：两段整体挪到「开了的代价」末尾（四段式不变），一句话节只留一句「GLM 双机部署用的版本里没有这个键，没开，见下文」。
- **P2-2 部署版本说法不准。** 位置：一句话节「放到 GLM 双机」段首句、事实表第 1 行「本部署的两个 vllm-ascend 版本」。问题：GLM 双机执行侧跑的是 db701c1f（官方镜像那一版，见 glm-5-3-flash-two-node.md「版本差异」），v0.23 维护分支 2c59ff10 没有 GLM 代码，不是「本部署用的」版本。结论（没有这个键、静默忽略）不受影响。改法：改成「本部署跑的是含 GLM 代码的 db701c1f 快照；v0.23 维护分支同样没有这个键」，事实表同步改为「本部署跑的 db701c1f 里没有这个键」。
- P3-1 一句话节「每张卡收到的 token 数由此完全相等」未带条件；GLM 形状下 top-8、EP16，token 数为奇数时槽位数不是 16 的倍数，会有 8 张卡多 1 个。正文「为什么存在」已给准确条件，建议一句话处补「（槽位数是卡数倍数时）」或改「几乎相等」。summary 同理。
- P3-2 「三个条件缺一不可」实际源码是四个条件（另有 model_config 非空），读者层面无影响，可不改。

**跳过。** 无（代码块、sources 区、版本谱系与自动生成节按纪律未读正文）。

## P5 修订记录（10-02）

正文 6,384 → 6,561 字（wiki:audit 口径）。按「P5 审查（10-02）」逐条处理：

**P2-1（清）。** 「放到 GLM 双机」两段整体从「一句话」节挪到「开了的代价」末尾（四段式不变）；一句话节只留一句「本部署跑的 db701c1f 快照里没有这个键，没开，换到 main 会怎样见下文」。事实表第 1 行的「见上文」同步改为「见下文」。第二段补半句「严格相等的条件见『为什么存在』」，不另推每卡表的行数。

**P2-2（清）。** 「本部署用的是 v0.23 维护分支和含 GLM 代码的快照」改为「本部署跑的是含 GLM 代码的 db701c1f 快照……；v0.23 维护分支同样没有这个键（上文『存在范围』）」；事实表第 1 行改为「本部署跑的 db701c1f 里没有这个键，没开」。

**P3。**
1. 清：一句话节改为「几乎完全相等（槽位数是卡数的倍数时严格相等，专家之间最多差 1 个，条件见『为什么存在』）」；summary 同步改为「几乎完全相等」。
2. 清：事实表「互斥」行改为「条件缺一不可（源码里还有一条『模型配置已就位』，共四条）」；「开了的代价」互斥段改为列出四个条件（本键、dynamic EPLB、模型配置已就位、模型是 MoE），依据 baa023ad ascend_config.py:564–570。

**三检。** pnpm wiki:lint 整站退出码 0，本页无报错无提示；pnpm wiki:audit 退出码 0，本页来源 22 条、行号全部有效；图未改（本页无图）；两页修完后统一跑 pnpm wiki:diagrams --check，290 张一致，整站 lint / audit 复跑仍为退出码 0。
