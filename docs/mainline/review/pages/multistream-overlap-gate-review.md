# multistream-overlap-gate 审查记录

## P5 写作记录（2026-10-02，第 28 批小修）

**旧版信息清单（小修，短版）。** `git show p4-checkpoint:wiki/params/multistream-overlap-gate.md` 与改前现版正文逐行相同（`git diff p4-checkpoint` 为空）。清单存在 scratchpad `p5/multistream-overlap-gate-facts.md`，逐条勾选如下：

1. 定义（v0.23.0 bool、默认 False、共享专家前向 + `select_experts` 搬到 `gate_stream`、上游名 FlashComm3）—— 保留，加了两个 MoE 页链接。
2. 三条前提（共享专家 / W8A8-dynamic 或 MXFP8 / FlashComm1）缺一要么白开要么断言失败 —— 保留。
3. 「本页旧算例 Qwen3-0.6B 单卡用不上」—— 删除：本页没有算例，指代悬空。改成自洽的「稠密模型、单卡无专家并行无处可用」，并补一句 GLM 主线占两条、缺 FlashComm1、官方没开。
4. 存在范围（v0.24.0rc 起删除；v0.26 静默忽略；main extra=forbid 起不来；vllm_omni 例外）—— 保留。
5. 事实表 10 行 —— 9 行原样保留；「本页旧算例上」一行换成「GLM 双机这条线」，行数仍是 10（FACTS_BUDGET=10）。
6. 为什么存在：准备期串行、NPU 等通信、两件不依赖的活挪副流；只在 enable_sp 时走 `_prepare_with_ep_group` —— 结论保留；量化 + EP 组 All-Gather 的推导改成一句话 + 链接（collective-communication#all-gather、sequence-parallel「vllm-ascend 里的 SP 是怎样接进去的」、expert-parallel#mc2-还是-allgather），原「TP AG + DP AG 合成一次 EP All-Gather」由 SP 页那节承担。补一句：SP 没开时走按 DP 组收集的分支，`quant_stream` 逻辑不在里面（db701c1f `prepare_finalize.py` L370–373、L394–410 核过）。
7. FlashCommon3Context 四字段单例 —— 保留未动。
8. join 点与收益上限 min(...) —— 保留未动。
9. 两条副流类级单例 —— 保留未动。
10. `fc3_quant_x` 组 + 纯 Python 实现 [I] —— 保留未动。
11. 消费端只在 w8a8_dynamic / w8a8_mxfp8 —— 保留未动。
12. 两套实现都带门控、info 日志可确认生效 —— 保留未动。
13. 收益：无数字；decode 小批窗口最宽 [D] —— 保留，补前提：得真走 AllGather；A2 上小批走 MC2，准备期只补齐切片、不发通信，没有可藏的等待（与 sequence-parallel 页「假如打开」一段的 MoE 入口说法一致）。
14. 代价 1：无共享专家时首次前向断言失败 —— 结论保留，定位修正：配 vLLM v0.23.0 时 `fused_moe.py` L290–291 换成 legacy 的 `fused_moe_0_23_0.py`，无共享专家时 runner 直接调层的 `forward_impl`（L116），断在门控分支 L441 的裸 `assert fc3_context is not None`；原文写的 `no_shared_forward_impl` 是新实现那条路（vLLM 非 0.23.0 时才加载），改为两处都写明。2c59ff10 与 db701c1f 两处行号一致。
15. 代价 2 / 3 —— 保留；2 去掉与上节重复的 `[D]`；3 补一句多卡下路由结果可能与隐藏态行数对不上、指向末段。
16. 代价 4：MoE LoRA v1 硬互斥 —— 保留，补断言消息原文逐字（`vllm_ascend/lora/fused_moe.py` L82–87，2c59ff10 与 db701c1f 用 diff 核过逐字相同）。
17. 代价 5：310P 三字段置 False —— 保留未动。
18. 代价 6：2 stream + 1 HCCL 组 —— 保留未动。
19. 代价 7：与 `multistream_overlap_shared_expert` 两个开关 —— 保留未动。
20. 代价 8 / 迁移段 —— 保留；补 vllm_omni 那条 warning 原文逐字（baa023ad `ascend_config.py` L1666–1669，即已有的 [C22] 范围内）；main 上不装 vllm_omni 时的拒绝报错文字由 pydantic 生成，vllm-ascend 源码里没有原文，写成「待核：缺 main 上带这个键启动的实际日志」。
21. 版本谱系、参数定义（自动生成）—— 未动。

**本轮新增：GLM 双机一段（「开了的代价」末尾，沿用参数页 4 段式，未加 H2）。**

- 主线没开：db701c1f 上键在、默认 False（`ascend_config.py` L140），官方部署没传，MoE 走直路，共享专家在路由专家之后串行 —— 取自 02 §6.7，站内链 moe 页「共享专家：按 TP8 切，走融合算子」。
- 三条前提占两条：有 1 个共享专家（02 §6.7，`glm5_next.py` L1502–1503 把 `shared_experts` 传进 `FusedMoE`）、路由专家走 W8A8 动态量化（02 §6.6 的 `w8a8_dynamic`）；FlashComm1 没开（sequence-parallel 页 GLM 一节；01 L893 记为默认关 `[A]`）。
- 硬开后的推演（R1 一步 4 token、走 MC2，形状链 one-request「MoE 通信：走 MC2 还是 AllGather」，不重算）：副流算共享专家 + 它那次 TP8 All-Reduce + 4 行路由（db701c1f `fused_moe_0_23_0.py` L438–475，新来源 [C25]）；主线 MC2 准备把 4 行补到 8 行、TP8 每卡留 1 行（`prepare_finalize.py` L269–290，新来源 [C26]），不发通信；汇合（L493–494）后 `w8a8_dynamic` 直接取副流 4 行路由结果（L262–267）去配本卡 1 行隐藏态。门控分支只对 `AllGatherCommImpl` 补收路由结果（L472–474），且那个补收函数在 FlashComm1 关时原样返回（`register_custom_ops.py` L57–58）。由此推「行数对不上」，标 `[I]`。
- 明确写出待核：派发算子报形状错还是静默算错，缺真机上带这个键跑一次的日志；不给收益数字、不借用 GLM 主线数字当它的效果。

**sources 变化。** 追加第 25、26 条（db701c1f 的 `fused_moe_0_23_0.py#L438-L494`、`prepare_finalize.py#L268-L291`）。正文证据标记 28 → 30（上限 30）：新增 [C25]、[C26]、[I] 各 1，删去代价 2 的重复 [D]。`updated` 改为 2026-10-02。summary 未动。

**核心概念对照。** 全部对照 vllm-ascend 源码：db701c1f（GLM 线）的 `fused_moe.py` 版本切换、`fused_moe_0_23_0.py` 门控分支与 runner、`prepare_finalize.py` 三个 prepare、`w8a8_dynamic.py` 消费端、`flash_common3_context.py` 单例、`register_custom_ops.py` 补收函数、`utils.py` 的 `enable_sp`、`lora/fused_moe.py` 断言；2c59ff10 的同名文件核了版本切换与断言行号；baa023ad 的 `ascend_config.py` 核了 extra=forbid 与 vllm_omni warning。

**验证。** 每次保存后跑 `pnpm wiki:lint`，均通过（本页 0 报错 0 警告）；`pnpm wiki:diagrams --check` 290 张图一致（本页图与 yaml 未改）；`pnpm wiki:audit` 本页通过，来源 26 条，行号全部有效。正文 9595 → 12271 字（audit 口径）。

**跳过。** 参考图库（refs/）未看：本页是参数页小修，不是通信原语或 TP/DP/EP 页，沿用现有图；frontmatter 的 sources 区只看了首尾 7 行格式，未通读。

**疑点。** 无 P1。P2（已修）：旧版「decode 小批窗口最宽」漏了「得走 AllGather」这个前提，A2 小批走 MC2 时根本没有窗口。P3：GLM 硬开后「行数对不上」是源码推断，未经真机验证，已在正文标 `[I]` 与待核；事实表、代价 5–7 等未改动的旧结论本轮未逐条重核。

## P5 审查（10-02）

审查员：独立审查（只审不改页面）。本页是参数页小修，按参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）判，不按深入页骨架扣分。

**分数：8.5 / 10。** P1 0 条，P2 2 条，P3 6 条。`pnpm wiki:audit` 本页通过（来源 26 条，行号全部有效）；`pnpm wiki:lint` 通过，本页 0 报错 0 警告。

### 旧版信息清单与任务文件

- 清单存在：旧会话 scratchpad `p5/multistream-overlap-gate-facts.md`（21 条，10-02 13:56）。`git diff p4-checkpoint` 只删了 12 行，均为被改写的段落，逐段对照无信息丢失；「TP AG + DP AG 合成一次 EP All-Gather」改为链到 sequence-parallel「vllm-ascend 里的 SP 是怎样接进去的」，该节 L184 讲了在 EP 组里收集、先量化再收，可以接住。
- 抽查 6 条，均在新版找到：第 1 条定义（L61）、第 4 条存在范围（L65）、第 7 条 context 单例（L88）、第 12 条两套实现与 info 日志（L102）、第 14 条无共享专家断言（L108，定位已改正）、第 19 条与 `multistream_overlap_shared_expert` 的关系（L120）。第 3 条悬空的「旧算例」已删并换成自洽说法（L63），第 5 条事实表仍是 10 行（L71–L80）。
- 任务文件要求逐项：挂靠 A4（02 逐层前向）——GLM 段取自 02 §6.6–6.7，核对一致（1 个共享专家、42 层 MoE、`w8a8_dynamic`、门控默认 False 走直路，02 L713–L722）；直觉图沿用现有图 ✓；依赖 moe、E 均有链接（L61、L84、L126）✓；验收要点「只解释自身开关，通信与形状推导链回概念页」✓——All-Gather、SP 接法、MC2/AllGather 选择、R1 补齐切片都只一句话加链接（L84、L104、L128），没有重推。

### 门控条件逐条核（钉住版本源码）

| 条件 | 页面位置 | 源码 | 结论 |
|---|---|---|---|
| 开关建流、打日志 | L102、L130 | 2c59ff10 / db701c1f `fused_moe_0_23_0.py` L203–L207；`prepare_finalize.py` L57–L59 | 对；日志原文带前缀，见 P3-4 |
| `multistream_overlap_gate` 直接取开关值，只有 `shared_…` 与 `has_shared_experts` 做与 | L79、L108 | `fused_moe_0_23_0.py` L194、L203；`fused_moe.py` L376、L380 | 对 |
| 无共享专家：runner 调 `forward_impl`，门控分支裸断言 | L108 | `fused_moe_0_23_0.py` L116–L117、L438–L441；`fused_moe.py` L585、L602；context 只在 `shared_forward_impl` L675–L676 写入 | 对 |
| 配 vLLM 0.23.0 时加载 legacy | L108 | `fused_moe.py` L290–L291 | 对 |
| 只有 `w8a8_dynamic` / `w8a8_mxfp8` 读 context | L78、L100 | 全仓 `get_flash_common3_context()` 调用点只在两套 fused_moe 和这两个量化方法（2c59ff10 git grep） | 对 |
| 开关打开时 `_prepare_with_ep_group` 不再收 `router_logits` | L100 | `prepare_finalize.py` L393–L400 | 对 |
| 走 `_prepare_with_ep_group` 的条件 | L86、L112 | `prepare_finalize.py` L370：`enable_sp() or enable_sp_by_pass()` | L112 对，L86 漏一半，见 P2-1 |
| 副流补收路由结果 | L133、L135 | `fused_moe_0_23_0.py` L473–L475；`register_custom_ops.py` L57（`flash_comm_v1_enabled or (enable_sp_by_pass() and is_ep_comm)`） | 方向对，L135 同样漏 by-pass，见 P2-1 |
| MoE LoRA v1 互斥，断言原文 | L114 | `lora/fused_moe.py` L82–L87，2c59ff10 与 db701c1f md5 相同 | 逐字一致 |
| 310P 三字段置 False | L116 | 2c59ff10 `_310p/fused_moe/fused_moe.py` L182–L184 | 对 |
| main `extra="forbid"`、vllm_omni warning 原文 | L124 | baa023ad `ascend_config.py` L455；L1664–L1671（`unknown_keys` 已 `sorted`） | warning 逐字一致；pydantic 报错写「待核」，诚实 |
| v0.26 静默忽略 | L65、L124 | 2ed6cbba `ascend_config.py` L56 起是普通类逐键 `.get()`，顶层无未知键校验（只有 `short_request_first_config` 子表校验） | 对 |
| 删除时间与 release notes | L122 | 移除提交 77baade9 首个 tag 为 v0.24.0rc1；baa023ad `release_notes.md` L241（v0.23.0 Ready to Deprecate）、L60（v0.26.0rc1 Deprecation and Breaking Changes） | 引文逐字一致 |

### GLM 双机一段（L126–L135）

- 推演按源码写，可复核：副流先算共享专家，MC2 路径下在副流做 TP All-Reduce（`fused_moe_0_23_0.py` L449–L453 的条件含 MC2）；路由在完整 4 行上算（无 SP 时各 TP 卡隐藏态是整份）；主线 MC2 prepare 因 `replace_allreduce=_EXTRA_CTX.flash_comm_v1_enabled`（L479–L482，FlashComm1 关即 False）而补齐 + 按 TP 切片（`prepare_finalize.py` L273–L290），不发通信；汇合在 L493–L494；`w8a8_dynamic` L262–L268 直接取 context 的 topk。4 行对 1 行的结论标了 `[I]`，后果（报形状错还是静默算错）明确写「待核」，**没有写成定论**。
- 「大于 128 token 翻 AllGather、SP 关时按 DP 组收集」与 02 §6.8（L725–L727）一致；R1「两边各 4 token、补到 8 行、每卡 1 行」与 one-request L338 及 02 L751 一致，只链接不重算。
- 没有收益数字，也没有把 GLM 主线数字当成这个开关的效果（42 层、4 token、8 行都只用来描述假设推演的形状）。✓

### 学习顺序与初学者测试

- 参数页四段式顺序成立：先说开关做什么、何时成立，再讲为什么（准备期在等通信、两件活不依赖它），再讲代价，GLM 放在「开了的代价」末尾，之后只有自动生成段。没有一上来就演算或堆 GLM 数字。通过。
- 初学者一句话：「这是 v0.23 上已废弃的开关：MoE 层等量化和收集通信时，把共享专家和路由挪到另一条执行队列上同时算，藏掉这段等待；但要有共享专家、W8A8/MXFP8、FlashComm1 三条都满足，缺共享专家会直接断言失败，升级前必须从启动命令里删掉。」能说出来，但「流 / 副流 / join」要靠猜，见 P2-2。

### 截图（Playwright，1440 宽，用户预览 5193，只读）

scratchpad（1237c9d2 会话）`multistream-overlap-gate-review-1.png`（第一屏）、`-2.png`（主图）、`-3.png`（GLM 段）。排版正常，没有新增分镜，没有 meta 文本。

### 问题清单

**P1：无。**

**P2-1　门控条件漏 `enable_sp_by_pass`，同页前后不一致。** L86 写「`prepare` 只有在 `enable_sp()` 为真时才走 `_prepare_with_ep_group`」，源码 db701c1f / 2c59ff10 `prepare_finalize.py` L370 是 `enable_sp() or enable_sp_by_pass()`（后者 = 非 eager 且 `compilation_config.pass_config.enable_sp`，`ascend_config.py` L291–L295）；L112 写对了。L135「副流给路由结果的那次补收只在 FlashComm1 开着时才真的收」同理：`register_custom_ops.py` L57 是 `flash_comm_v1_enabled or (enable_sp_by_pass() and is_ep_comm)`，这里调用传了 `is_ep_comm=True`，走编译 pass 版 SP 时也会收。影响：用编译 pass 开 SP、没开 `enable_flashcomm1` 的读者会误判这个开关不生效。GLM 段结论不受影响（两者都关）。改法：L86 改成与 L112 同一写法；L135 改成「只在 FlashComm1 或编译 pass 版 SP 开着时」。

**P2-2　核心术语「流 / 副流 / join」先用后讲。** 页名就是 multistream，但 L61 起直接用「副流 `gate_stream`」，L94 用「join 点」，全页没有一句话说明 NPU stream 是什么（全库也没有可链的解释）。初学者读不出「两条流为什么能同时跑、join 为什么是硬约束」。改法：L61 首次出现处加一句，例如「NPU 上的 stream 是一条按顺序执行的任务队列，不同 stream 上的任务可以同时在设备上跑；join 指一条流等另一条流做完再继续」。FlashComm1 在 L63 首次出现时也可顺手括注一句或链到 sequence-parallel。

**P3-1　L112「别的情况下……可能行数对不上」说宽了。** SP 开着、走 MC2 时，隐藏态已按 SP 切成本卡的行，MC2 prepare 因 `replace_allreduce=True` 不再补齐切片，副流路由也在本卡行上算，两边行数一致。会对不上的是 SP 没开的情形（MC2 下隐藏态被 TP 切片、AllGather 下隐藏态按 DP 组收齐，路由结果都没跟着变）。建议改成「SP 没开时」。

**P3-2　L88「字段是 4 个」不准。** 2c59ff10 / db701c1f `flash_common3_context.py` L8–L14 的 dataclass 有 6 个字段（另有 `gate`、`row_idx`）；setter 只写这 4 个。建议写成「实际用来传结果的是这 4 个字段」。（旧内容，本轮未动。）

**P3-3　新 / legacy 两套的口径没统一。** L96 说 `gate_stream` 挂在 `AscendMoERunner` 上，这只对新实现（`fused_moe.py` L298–L300、L382）成立；配 vLLM 0.23.0 实际加载的 legacy 挂在 `AscendFusedMoE` 上（`fused_moe_0_23_0.py` L144、L205）。L108 已写明实际加载 legacy，L96 / L102 宜跟着改。

**P3-4　日志原文少前缀，且只有 legacy 会打。** 源码原文是 `[fused_moe/layer] Multistream overlap gate is enabled.`（`fused_moe_0_23_0.py` L207，`logger.info_once`）；新实现 `fused_moe.py` 里没有这条日志（2c59ff10 / db701c1f git grep 只命中 legacy）。L102 / L124 / L130 引的是子串，按它 grep 能找到，但不是全文；L102「两套实现……开启时会打一条」容易读成两套都打。建议引全文并注明由 legacy 打出（v0.23.0 配 vLLM 0.23.0 时正好是它）。

**P3-5　「一句话」里放了 GLM 细节。** L63 末尾「有 1 个共享专家、路由专家走 W8A8 动态量化……」属于 GLM 部署事实，按讲法第 12 条宜留在末段 GLM 一节，这里只留「GLM 主线没开，见末段」。参数页、影响小。

**P3-6　沿用的主图下半「关掉（默认）时」说明不全。** 图注写「prepare() 里照样 all-gather 两份：hidden_states 和 router_logits」，这只在 AllGather 路径成立；GLM 默认的 MC2 路径只补齐切片、不收集（正文 L104 / L132 已说）。图按任务沿用，记待图样式重做时一并改。

### 同批口径冲突（use-fused-overlap）

`wiki/params/use-fused-overlap-75a180fff6ab.md` 全文 grep 不到 `multistream_overlap_gate` / FlashComm3 / `gate_stream` / 共享专家，**未发现口径冲突**。另：`wiki/concepts/moe.md` L295 与 `expert-parallel.md` L490 对本开关的说法（默认 False、本部署没开）与本页一致；moe.md 那句没有链到本页，可在改 moe 时顺手加（不扣本页）。

### 其他说明

- audit 日志里本页那一块中间夹了 3 行 rfork.md 来源，但本页 frontmatter grep 不到 `rfork`、来源计数仍为 26，判断为审计输出交错，不是本页问题。
- 正文证据标记我数到 29 处（写手记 30），都在 lint 上限 30 以内；行内代码约 108 处 / 1.57 万字符，没有超过每千字 13 处。

### 跳过

frontmatter 的 sources 区（只 grep 了 `rfork` 与条目计数）；版本谱系、参数定义两段自动生成内容只扫了标题与表头；事实表第 5–7 条与代价 6、7 中「死代码」「显存增加 [I]」等未改动旧结论没有逐条重核源码；参考图库 refs/ 未看（参数页小修，不涉通信原语讲法）。

## P5 修订记录（10-02，按「P5 审查（10-02）」）

**P2-1 门控条件补全并全页统一 —— 成立，已修。** 钉住源码：走 `_prepare_with_ep_group` 的条件是 `enable_sp() or enable_sp_by_pass()`（db701c1f `prepare_finalize.py` L370；2c59ff10 同句在 L358，审查写的 L370 只对 db701c1f）；`enable_sp_by_pass` = 非强制 eager 且 `compilation_config.pass_config.enable_sp`（两个提交 `ascend_config.py` L291–L295 相同）；补收路由结果的函数条件是 `flash_comm_v1_enabled or (enable_sp_by_pass() and is_ep_comm)`（db701c1f `register_custom_ops.py` L57，2c59ff10 L46）。改动：一句话第 2 段、「为什么存在」第 1–2 段、代价 3 标题与正文、GLM 段首段与末段、事实表 GLM 行，统一写成「序列并行（FlashComm1 或图编译 pass 版 SP）」；「为什么存在」第 2 段把条件写全，并用一句话讲清两个函数各看什么。GLM 结论不变：两者都关（sequence-parallel 页 GLM 一节）。

**P2-2 流 / 副流 / join 先用后讲 —— 成立，已修。** 一句话第 1 段首次出现「副流」处补两句：stream 是 NPU 上按顺序执行的任务队列，同一条流里一件接一件、不同流可以同时跑，默认那条是主流、另开的是副流；join（汇合）= 一条流停下来等另一条做完再往下走，汇合后才能用对方的结果。全库没有可链的达标解释（grep TERMS 与 concepts 只有 tensor-parallel 的一处括注），所以就地讲。「为什么存在」里的「join 点」改为「汇合（join）点」。FlashComm1 首次出现处链到 sequence-parallel「vllm-ascend 里的 SP 是怎样接进去的」。

**P3 一并修：**

- P3-1：代价 3 改为「SP 没开时」才可能对不上，并分开写：FlashComm1 开着时两边对得上；只开图编译 pass 版 SP 时 AllGather 路径会补收，MC2 路径是否补齐切片只看 `flash_comm_v1_enabled`（db701c1f `ascend_forward_context.py` L127 只由 `enable_sp` 决定），这一组合写成「待核：缺这时 MC2 准备期拿到的隐藏态行数」，不下结论。
- P3-2：context 改为「实际用来传结果的是这 4 个字段，类里另有 `gate`、`row_idx`」；`flash_common3_context.py` L8–L14 核过，2c59ff10 与 db701c1f md5 相同。
- P3-3：类级单例一句改为「legacy 里挂在 `AscendFusedMoE`，新实现里挂在 `AscendMoERunner`」。
- P3-4：日志引全文 `[fused_moe/layer] Multistream overlap gate is enabled.`，注明只由 legacy 打（`fused_moe_0_23_0.py` L207，`info_once`；两个提交 git grep 只命中这一处），三处引用（为什么存在末段、迁移段、GLM 段）都改了。
- P3-5：一句话第 2 段删掉 GLM 部署细节，只留「GLM 主线没开这个键，见末段」；细节仍在 GLM 段。
- P3-6：图下半「关掉（默认）时」说明改为「SP 开着、走 AllGather 时，prepare() 照样 all-gather 两份」，跑 `pnpm wiki:diagrams` 只更新了本页 1 张 svg。这行字比原来长约 130px，按 12.5px 字号估算右端约 840px，仍在 880px 区域边界内，未截图（浏览器验收归审查）。

**验证（全站退出码）。** `pnpm wiki:lint` exit 0（本页 0 报错 0 警告；新增的待留意是 params/profiling-chunk-config，与本页无关）；`pnpm wiki:diagrams --check` exit 0（290 张一致）；`pnpm wiki:audit` exit 0（本页来源 26 条，行号全部有效）。正文 12271 → 13134 字，证据标记仍为 30（本轮未加新标记）。

**纪律说明。** 修订中途有一次连发了 3 个 Edit（为什么存在第 3–5 段），之后恢复严格串行。
