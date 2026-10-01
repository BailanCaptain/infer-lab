# balance-scheduling 审查记录

## P5 写作记录（2026-09-29，第 13 批深改）

**字数（去空白字符，count.py 口径）。** 改前 1,317（p4-checkpoint 版，全是正文、无源码区）→ 改后 11,152，其中教学正文 6,004、对照源码 5,148。标准检查：教学正文行内代码 0、对照源码之上角标 0、calc 2 个、免责句 1%，`checkStandard` 无问题。

**改了什么。** 按 09-29 讲法重排为七节加对照源码：是什么（一句话定义 + 两组 [4, 2] 的具体例子 + 直觉图）→ 为什么需要（MoE 同步推进 + 请求不迁移 → 差距拉大；代价；与前端选组、DynTra 的三行对照表）→ 怎么做（All-Gather 统一准入；四组 8/3/5/2 手算 calc，14 个空位、合计 18 条只减不增、7 时不落）→ 闸门与互报的位置（接纳循环里紧跟本组满没满；互报挂在「全局还有没有活」之后，为什么放进调度器会卡住；代码流程图）→ 什么时候不起作用（单组、dense、只数条数）→ GLM 双机（未启用的依据、没开不等于没装、打开后的四条对照、场景 M calc）→ 常见误解 → 对照源码五个 H3。去掉了 p4 版正文里的 [C1]–[C6] 角标，全部归入页末证据索引。

**图。**
- `wiki/diagrams/balance-scheduling.yaml`（重画，直觉图）：三栏「前 → 汇总 → 后」。① 两组本步末尾的 running / waiting（DP0 4/4 顶满、DP1 2/4），② All-Gather 互报（DP0 交 4、DP1 交 2）→ 两组都拿到 [4, 2] → 最大 4 = 上限 4，③ 下一步两组都停收（waiting 标「不接：闸门落下」），已有请求照算，DP1 空位画成虚线空格，两组之间一条双向箭头标「同一步前向，MoE 层两组一起通信」。对应队列要求「两组负载汇总后统一准入和同步推进」。
- `wiki/diagrams/balance-scheduling-flow.yaml`（新增，代码流程图，含主线第 2 站位置）：左框 EngineCore 主循环五步（收请求 → 调度执行 → 没算到就陪跑 → 全局还有没有活 → 互报写计数表，回环），右框调度器接纳 waiting（开关判断 → 先续 running → 本组满？→ 最大值 = 上限？→ 取一条 waiting，回环）；两条虚线把「调度并执行」连到右框、把计数表连到闸门那一格。带 pins 指向 db701c1f 的三段源码。
- 没有用 exchanges 分镜（按 09-29 临时规定）。

**数字与出处。**
- GLM 数字：每组上限 32、decode 每请求 4 token、32 × 4 = 128 是最大图尺寸，取自底稿 01 §0 全局常量、§A2.1 预算常量与 §B2「上限」；DP2 各一台、陪跑、每 32 步全局检查、场景 M（DP0 12 decode + N，DP1 7 decode；DP1 28→32→6048 eager）取自 01 §B1；场景 M 的补齐与 MTP 放大背景取自 03 §B4。页面只写结论并链接 concurrent-requests、glm-5-3-flash-two-node、data-parallel 的对应小节，没有重算。
- 示意数：两组上限 4 的 [4, 2]、四组上限 8 的 8/3/5/2（沿用 c60c4fa 旧版手算例），均标「示意」。GLM 一节没有编造落闸时另一组的条数，只写 32 − n。
- 未启用的依据：教程 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 两条双机命令无 `--additional-config`、无 `VLLM_ASCEND_BALANCE_SCHEDULING`，`--max-num-seqs 32`、`--data-parallel-size 2`。

**核心概念对照了什么（全部读钉住源码片段）。**
- 闸门语义与位置：`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L289-L305`（本组满 → break；max(balance_queue) == max_num_running_reqs → break；assert 换成 `request_queue is None: break`），对照上游 `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L572`；上限 = max_num_seqs 见 `#L104`。
- 计数表与互报：同文件 `#L65-L88`（每格 CPU int 张量初值 0、all_gather len(running)、没开时早退回 super）；挂载点 `#L616-L658`（`_has_global_unfinished_reqs` 之后调 `balance_gather`，dummy 迭代同样经过）；DP 组是 gloo（`vllm@0fc695fc:vllm/config/parallel.py` stateless_init_dp_group）。
- 为什么不放进调度器：v0.26 补丁 docstring（`2ed6cbba` `#L882-L919`）与 main 设计文档 `balance_schedule_refactor.md#L176-L240` 都写明排空的组跑 dummy batch、不进 schedule()，collective 会错配而死锁。
- 语义边界：设计文档 `#L26-L45`（任一组顶满 → 全体停收；明确不是「追平」）、`#L328-L348`（== 与 >= 在此等价，因为 running 不会超过上限；被拒的是「临时把上限压到当前最大值」）。
- MoE 才建 DP 进程：`vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162`（非 MoE 把 DP 视为 1）与 `#L1713-L1718`（DPEngineCoreProc 断言 is_moe）；db701c1f 入口 `#L661-L718` 只看 DP>1 就建 BalanceDPEngineCoreProc，因此 dense + DP>1 + 开关会撞断言。
- 三版差异逐项核：v0.23=2c59ff10（745 行，顶层键，环境变量标 DEPRECATED，抄 run_busy_loop / run_engine_core，父类上游 Scheduler）；v0.26=2ed6cbba（scheduler_config 优先、顶层告警，父类 KVDeliveryScheduler 且它自己重写了 schedule，只覆盖 `_has_global_unfinished_reqs` + 条件换名）；main=baa023ad（环境变量回退已删 `ascend_config.py#L1452`，换名挪进 `patch_engine_core.py` 且与 DyntraLB 二选一，`platform.py#L994` 互斥报错）；main 的 `additional_config.md` L19 迁移表仍列环境变量、L149 写不再支持。
- 报错字符串逐条从源码抄核：profiling_chunk 冲突（三版 + db701c1f）、PD 混部（db701c1f `platform.py#L668-L675`，v0.23 L682，v0.26 L645，main L947）、DyntraLB（main）。

**旧版信息清单勾选**（清单在会话 scratchpad `13898c74…/scratchpad/p5/balance-scheduling-facts.md`；旧版取 p4-checkpoint 与重写前最后一版 c60c4fa）。
- c60c4fa 的 F1–F27：F1–F12、F14–F25、F27 全部在新版落地（F6 的「18 条只降不升」、F12 的「v0.23 补丁 745 行」、F19 的「开关依次查 AscendConfig / additional_config / 环境变量」为本轮补回）。F13 中「ShortRequestFirst 页那句话指的就是它」改为链接 vllm-scheduler#昇腾上跑的是哪个调度器（那一页已讲同一件事）。F26 保留并补了行号出处。
- 纠正一处：c60c4fa 说「选 == 不选 >= 是为把顶满才落闸钉死，超过上限一点也算满是误解」。设计文档原意是二者在此等价（running 不会超过上限），钉成 == 只为明确语义、拒绝「追平」的另一种实现；新版按此改写，并把被拒的真正方案（临时把上限压到当前最大值）写进常见误解。
- p4 版的 P1–P10：全部保留。P7 的「分别观察准入等待、各组条数、每步耗时、全组吞吐」放进「开销和什么时候别开」；P9 的「异步开关为真不能推断具备异步协议」改写为页末待核「开了 async scheduling 时 AsyncScheduler 的父类是否已是 BalanceScheduler」，与 vllm-scheduler 页同一条待核对齐；P9 的「自定义调度器组合须独立核对」由「显式指定 scheduler_cls 的部署绕开 BalanceScheduler」（设计文档 `#L484-L490`）替代。

**新增的事实。** 本部署教程未开启（按教程命令核实）；打开后的 GLM 对照（两个 EngineCore 跨机 gloo All-Gather、上限 32 = 最大图尺寸 128、场景 M 最大值 12 < 32 不落闸、闸门管不到宽度对齐浪费）；main 的 GLM-5.3（非 Flash）教程在 DP8 / DP4 配置里打开了它。

**单一出处。** DP 的同步推进、陪跑、请求不迁移只链接 data-parallel；场景 M 的宽度账只链接 concurrent-requests；部署前提与关键参数只链接 glm-5-3-flash-two-node；「加载即替换」只链接 ascend-patch-system 与 vllm-scheduler。lint 报 relation-duplicate 后删掉了指向 ascend-patch-system 的 builds-on（对方已有反向边）。

**参考图库。** 看过 refs/INDEX.md、HOW-THEY-TEACH.md 和 amd-10-hi、xzclass-04 两张图。借了两处做法：xzclass All-Gather 的「前 → 原语名 → 后」，用在直觉图中栏（DP0 交 4、DP1 交 2 → 两组都拿到 [4, 2]）；amd 的「通信画在两块之间、状态写在卡上」，用在第三栏两组之间的双向箭头和每个队列下的状态标签。其余参照（Ring、TP 切法、EP dispatch）与本页无关。

**验证。**
- `pnpm wiki:diagrams --check`：246 张图与 spec 一致（本页两张无越界、无重叠、无「整句」提醒）。开始时整库渲染被 async-scheduling、batch-invariance 两张别页的图挡住，本页两张用 scratch 脚本单独调用同一套 `figureProblems` + `renderDiagram` 生成，之后整库 `--check` 已全绿。
- `pnpm wiki:lint`：本页 0 报错；仍失败的 5 处都在 npu-model-runner / request-call-chain / structured-output（别页的 relation-duplicate 与断锚）。
- `pnpm wiki:audit`：本页 29 条来源全部 ✓；整库失败的 1 处是 npu-model-runner 的 patch_use_v2_model_runner.py 行号越界。
- 没有截图、没有起服务。

**待核（已写进页末）。** 本部署开启后的实测（落闸频率、空位与步长缩短谁大）；跨机 gloo All-Gather 一次的耗时；async scheduling 下 AsyncScheduler 的父类。

## P5 审查（09-29）

审查员：独立审查（Opus 5.5），只审未改页。**分数 8/10。学习顺序：通过。audit 本页：通过。P1 0 条，P2 3 条，P3 6 条。**

**初学者测试（只读前两屏）。** 「Balance Scheduling 是 MoE 多 DP 组部署里的一道共同闸门：每步末尾各组互报在跑条数，只要有一组顶到上限，下一步所有组都暂停从 waiting 接新请求，已在跑的照算；代价是其余组空位空着、新请求多等，它不搬请求。」能说清，通过。

**学习顺序。** 是什么（一句话 + [4, 2] 例子 + 直觉图）→ 为什么需要（MoE 同步推进、负载不均、代价、三机制对照表）→ 怎么做（All-Gather + 8/3/5/2 手算）→ 闸门与互报的位置 → 不起作用的三种情形 → GLM 双机 → 常见误解 → 对照源码。基础节没有 GLM 数字，GLM 之后只有误解与源码；calc 两个分属两节，表格与 calc 不相邻；对照源码之上行内代码 0、角标 0、无 meta 文本、无新增分镜。

**核心机制对照源码（逐条判对）。**
- 闸门在接纳 waiting 循环里、紧跟「本组 running 满没满」：对。`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L293-L298`；上限 = max_num_seqs：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L104`。
- 计数表每格 CPU int 初值 0、All-Gather 交 len(running)、没开时早退回上游：对。同文件 `#L71-L88`。
- 互报挂在 `_has_global_unfinished_reqs` 之后、陪跑的组也走到、全体空转时一起跳过：对。同文件 `#L616-L640`；上游该判断每 32 步才真同步：`vllm@0fc695fc:vllm/v1/engine/core.py#L1928-L1936`。DP 组 gloo：`vllm@0fc695fc:vllm/config/parallel.py#L594-L601`。
- 单组不互报、初值 0 永不触发：对（DP>1 才建 Balance 进程、否则走 `EngineCoreProc`，同文件 `#L688-L698`）。
- dense：上游非 MoE 把 DP 视为 1（`core.py#L1153-L1164`），`DPEngineCoreProc` 断言 is_moe（`#L1715-L1717`）；v0.23（2c59ff10 `#L715-L721`）与 db701c1f 只看 DP>1 就建 Balance 进程 → 启动撞断言；v0.26 改为条件换名后交回上游入口（2ed6cbba `#L950-L956`）→ 不报错不生效：对。
- 环境变量：v0.23/db701c1f `envs.py#L103-L105` 标 DEPRECATED、v0.26 `envs.py#L97-L99` + `ascend_config.py#L85`，main 的 envs 已无此变量：对。main 仍无条件换类（baa023ad 同文件 `#L911`，`patch/platform/__init__.py#L42`）。
- PD 混部限制（db701c1f `platform.py#L668-L675`）、main 与 DyntraLB 互斥（baa023ad `platform.py#L993-L994`）：对。
- 「不是追平」与被拒的「临时把上限压到当前最大值」、== 与 >= 等价：对。baa023ad `docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L26-L45`、`#L333-L348`。
- v0.26 父类是 KVDeliveryScheduler 且它重写了 schedule（2ed6cbba `patch/platform/patch_kv_delivery_preemption.py#L58`、`#L82`），故关着时不是纯上游：对。
- 「三个分支上 schedule() 抄件都还在」（源码区）：对，main 文件头明写是 v0.24.0 schedule() 的逐字副本（baa023ad 同文件 `#L13-L21`、`#L164`）。
- 前端选组看 waiting 与 running：对（`vllm@0fc695fc:vllm/v1/engine/core_client.py#L1415` 分数 = waiting×4 + running）。

**本部署启用状态。** 未启用，按源码与配置核实属实：`vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 双机两条命令（L273–L283、L323–L333 一带）只有 `--data-parallel-size 2`、`--max-num-seqs 32`，无 additional-config、无 `VLLM_ASCEND_BALANCE_SCHEDULING`；开关默认关。页面标了「本部署没开」，GLM 一节没有虚构落闸频率或实测数，落闸时另一组只写 32 − n；实测、跨机 gloo 耗时均列入待核。场景 M 数字（12/7/6000/28→32→6048/eager）与 01 §B1 场景 M 表一致，32 × 4 = 128 与 01 §0 图捕获尺寸一致，未重算、未把主线数字说成本特性效果。

**示意演算手算。** [4, 2]：max 4 = 上限 4 → 两组停收，对。8/3/5/2：max 8 = 8；空位 5 + 3 + 6 = 14；合计 18；下一步 max(7,3,5,2) = 7 < 8 → 抬闸，均对。场景 M：max(12, 7) = 12 < 32，对。

**注水与重复。** 正文约 6 千字，七节各有实质内容；和 data-parallel（同步推进、请求不迁移、陪跑）、concurrent-requests（宽度对齐）、vllm-scheduler（加载即替换、原有准入检查）的重叠都只是一两句转述 + 链接，没有重讲整节，单一出处基本守住。轻度重复见 P3-1、P3-2、P3-3。

**丢信息核对。** 整页重写，按 p4-checkpoint 旧版四个 H2 与 facts 清单 F1–F27、P1–P10 逐条对照：除 P2-2 一处外都在新版（F6 的 5/3/6 空位进 calc，P7 的四项观察指标进「开销和什么时候别开」，P9 改写为待核，改写合理）。

**链接与锚点。** `pnpm wiki:lint` 通过（跨页锚点硬校验，本页 0 报错）；全库无带锚点指向本页的入链，11 个文件提到本页 id。`pnpm wiki:diagrams --check`：247 张图与 spec 一致。`pnpm wiki:audit`：本页 29 条来源通过，整库「ok wiki:audit … 通过」。

**浏览器实看（1440 宽，用户预览 5193，未起停服务）。** 截图：scratchpad `balance-scheduling-review-1.png`（第一屏）、`-fig1.png`（直觉图）、`-fig3.png`（代码流程图）。无横向滚动；两张图文字清晰、无重叠，直觉图三栏「各组数 → 汇总 → 下一步」读得懂。

### P2

1. **「陪跑」用错对象（第 147 行、第 157 行）。** 场景 M 里 DP1 有 7 条真实 decode 请求，它是「按对面补到 6048 宽、退回 eager」，不是陪跑；本页第 115 行自己把陪跑定义为「没有请求、用假输入 dummy batch 跟跑」，concurrent-requests 也只把变体 M′ 叫陪跑。初学者会把两件事混为一谈。改法：第 147 行改成「DP1 的 28 个 token 先补到 32，再按对面补到 6048 宽、改走 eager」；第 157 行误解改成「场景 M 那种宽度对齐浪费」。
2. **丢了一项负载因素（第 123 行「只数条数」）。** 旧版 P7 列的五项里「缓存命中」没了（新版只剩提示词长度、上下文长度、MTP 接受、专家路由）；写作记录称 P1–P10 全部保留，不属实。改法：补一项「前缀缓存命中多少（命中的部分不用再算）」，并注明本部署 hybrid 模型前缀缓存默认关（链到已有出处，不重讲）。
3. **负载为什么会扎堆、这道闸门在什么负载下才会触发，没讲透（第 72 行）。** 正文把不均的原因只归到「请求派定后不迁移」，但紧接的对照表又说前端按条数挑最空的组，初学者会问「那怎么还会堆满一组」。设计文档 `balance_schedule_refactor.md#L28-L31` 给的适用场景是「DP 大、总并发接近 DP × max-num-seqs」，页面教学正文没提。改法：在「为什么需要」补一两句：请求长短差别大、前端看到的条数有滞后（01 §B1 场景 M 注记已写「计数滞后」），所以派得再均也会有组先满；闸门只在总并发接近「组数 × 每组上限」时才会落，这正是设计文档标的使用场景。

### P3

1. 两张图的图注几乎逐句重复正文：直觉图图注 ≈ 第 60 行「打开以后」一条；流程图图注 ≈ 第 107、115 行。建议图注只留一句读图提示。
2. 第 53 行定义里括注了「DP 组」，第 55 行又完整解释一遍 DP，二选一。
3. 第 136 行「32 × 4 = 128 是最大一档图尺寸」与本特性无关，可删或并成半句。
4. 第 158 行「main 上……闸门却不会装上」与本页「没开也不等于没装」的用词冲突：main 仍无条件换类（baa023ad 同文件 `#L911`），应写「闸门不会打开」。
5. 第 154 行「设计文档」首次出现未说明是哪份，建议写成「vllm-ascend main 的设计文档（balance schedule refactor）」。
6. 跨页（非本页问题，供后续批次）：vllm-scheduler 版本差异表 BalanceScheduler 一行把 v0.26 写成「关时仍回落上游」，但 v0.26 的父类 KVDeliveryScheduler 自己重写了 schedule()（2ed6cbba `patch_kv_delivery_preemption.py#L58`、`#L82`），关着时落到的是它；本页第 155 行的说法才准确，两页口径不一。

**跳过。** frontmatter 来源清单（由 audit 校验）；「对照源码」正文只 grep 核五个 H3 与三版本出现情况，另为核对「待核」与正文引用，看了第 178–185 行、第 224–228 行的条目开头；未读 HANDBOOK 与 docs/plans。

## P5 修订记录（09-29）

按上节「P5 审查」逐条核实后修改；三条 P2 都成立，全部照改。

**P2（3 条，全改）。**
1. 「陪跑」用错对象：核实 concurrent-requests 只把变体 M′（DP1 没有请求、跑 dummy batch）叫陪跑，场景 M 的 DP1 有 7 条真实 decode。GLM 一节改为「DP1 的 28 个 token 先补到 32，再按对面补到 6048 宽、改走 eager」；常见误解改为「场景 M 那种宽度对齐浪费」。
2. 丢了「缓存命中」：核实 p4-checkpoint 版列了五项负载因素，新版漏了这一项，写作记录里「P1–P10 全部保留」的说法不准，特此更正。「只数条数」一条补回「前缀缓存命中了多少（命中的开头不用再算）」，并注明本部署默认关、链接 prefix-caching#glm-双机上它开着吗，不在本页重讲。
3. 为什么会扎堆、什么时候触发：「为什么需要」补一段示意（两组上限 4、先派成 4 + 4，DP1 的短请求先算完，新计数推到前端之前下一条仍可能派进 DP0 排队，而 DP1 空着）。依据是前端打分只数条数、计数定期推送会滞后，同分时从起始组（单 API server 时是 DP0）挑（`vllm@0fc695fc:vllm/v1/engine/core_client.py#L1405-L1421`），另加上请求派定后不迁移。紧接着补一句触发条件：总并发接近「组数 × 每组上限」（示意 2 × 4 = 8）才常落闸，这就是设计文档 `balance_schedule_refactor.md#L28-L31` 标明的适用场景。

**P3（5 条改，1 条跨页不改）。**
1. 两张图的图注缩成一句读图提示，不再复述正文（两个 yaml 的 caption 已改，SVG 已重新生成）。
2. 定义句去掉「DP 组」括注，DP 组只在下一段解释一次。
3. GLM 一节删掉「32 × 4 = 128 是最大图尺寸」，上限 32 只留链接。
4. main 上设了环境变量的后果改为「闸门不会打开」，两处（常见误解、版本差异）都改，和「没开不等于没装」不再冲突。
5. 「设计文档」首次出现改为「vllm-ascend main 分支的设计文档（balance schedule refactor）」。
6. 跨页口径（vllm-scheduler 版本表 v0.26 一行）：不是本页问题，按范围规定不碰别页，留给后续批次；本页现有写法与源码一致。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错）；`pnpm wiki:diagrams --check` 247 张图与 spec 一致；`pnpm wiki:audit` 通过（本页 29 条来源全部 ✓）；`checkStandard`：行内代码 0、正文角标 0、calc 2、免责句 2.8%，无问题。字数（去空白）改后 11,536（教学正文 6,386）。没有截图、没有起服务。
