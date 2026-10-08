# vllm-scheduler 审查记录

## P5 写作记录（2026-09-29，深改，第 10 批）

### 改了什么

- 正文按「先直觉、后数字」重排为 6 个 H2 + 对照源码：一步算哪些请求（定义 + 直觉图）→ 为什么按 token 设预算又设请求数上限（动机与代价）→ 四关机制（还差几个 → 截断 → 借块 → 记账，配代码流程图）→ GLM 双机上的 R1 → 多条请求（场景 M 结论、切分门槛）→ 昇腾上跑的是哪个调度器 → 常见误解 → 对照源码（五个 H3 顺序固定）。
- 按本批验收要点，删掉「教学预算 6、运行上限 2」的旧例，换成官方配方的 8192 / 32（每个 DP 组），并新增唯一出处在本页的推导：纯 decode 步最多用掉 32 × 4 = 128 个 token，占预算约 1.6%，说明 decode 步先碰到的是请求数上限。
- 场景 M 的 6048、切分门槛 8068、20,000 token 分三步，只给结论并链接 concurrent-requests；R1 的 15 块和三圈账只给结论并链接 one-request，不重算。
- 未启用的调度器变体（BalanceScheduler 闸门、Recompute Scheduler、SchedulerDynamicBatch、ProfilingChunkScheduler）明确写成「本部署没开、无实测数」，不给效果数字。
- 直觉图 `token-budget.yaml` 重画：running 的 A、B 各差 1 个位置，waiting 的 C、D 整段未算；右上是本步 token 预算条（A、B 各 1，C 拿到余量只算前一段，余下斜纹留到下一步，D 排不上），右中是空闲 KV 块格子（够才整套借出），下方是块不够时两条路（running 抢占队尾 / waiting 停止接纳）。不标任何部署数字。
- 新增代码流程图 `vllm-scheduler-flow.yaml`：每步开头重置预算 → ① 应算 − 已算 → ② 单条上限、剩余预算、长度上限三次截断 → ③ 借块（running 借不到抢占队尾并重试；waiting 借不到或关了分块且超余量就停止接纳）→ ④ 记账 → 还有要扫的请求（扫 waiting 还要本步没抢占过、未满员）→ 交出本步结果。
- frontmatter：title、summary 重写；sources 从 6 条扩到 30 条（补 v0.26、main 钉点）；relations 保留 vllm-engine-core、concurrent-requests、kv-cache（one-request 已经 builds-on 本页，按 lint 规则不写反向边）；verified 改为 v0.23 / v0.26rc / main。
- 字数（正文非空白字符）：p4-checkpoint 1,577 → 新版 11,813；重写前最后一版 c60c4fa 为 6,366。

### 数字取自哪一节

| 数字 | 出处 |
|---|---|
| 预算 8192、请求数上限 32、lookahead 3、max_model_len 133120 | 01 §A2.1；部署页「关键参数各管哪一步」 |
| R1 首步 {R1: 4}、7 个位置、15 个块号、草稿为空 | 01 §A2.2、§A2.4（链接 one-request 第 2 站，不重算） |
| decode 每步 1 + 3 = 4、已算数 4 → 8 → 6 回退 | 03 §A6（R1 decode 表）；链接 one-request「第二圈和第三圈」 |
| 纯 decode 32 × 4 = 128、128 是最大图捕获尺寸 | 01 §B2「上限」；03 §B4 捕获尺寸表 |
| 128 ÷ 8192 ≈ 1.6% | 本页新推导（由上两行得出） |
| 场景 M：48、8144、6000、6048、13 条 | 01 §B2「场景 M 的一步」；03 §B4 步骤 B（链接 concurrent-requests） |
| 切分门槛 8192 − 4 × running，31 条时 8068 | 01 §B2（链接 concurrent-requests） |
| 20,000 token 分三步 | 01 §B2「一个会被切开的例子」（只给结论） |
| 块 640、8192 = 12 × 640 + 512 不整除 | 01 §0 / §A2 待核 3 |
| 前缀缓存默认关、mamba_cache_mode = none、不做对齐切分 | 01 §A2.3、§B2 |
| 异步调度按默认条件推断为开 | 03 §A6 第 24 条、待核 2 |
| long_prefill_token_threshold 本部署为 0 | 03 §B4 待核 3；另核源码 config/scheduler.py 默认 0、只在 max_num_partial_prefills > 1 时自动设 |
| 抢占在本部署的代价 | 链接 vllm-kv-block-allocation「池子不够时」、concurrent-requests KV 块一节，不重算 |

### 核心概念对照了哪份源码

- 「没有 prefill / decode 阶段」、两道减法、三次截断、先 running 后 waiting、waiting 准入三条件、借块失败时 running 抢占队尾 / waiting 直接 break、PRIORITY 分支才退预算、`_preempt_request` 的五个动作、`_update_after_schedule` 在整步排完后前移已算数：逐行读 vllm@0fc695fc `vllm/v1/core/sched/scheduler.py` L340–L516、L562–L700、L720–L778、L872–L874、L974–L1013。
- 被抢的是自己时 running 扫描结束：同文件 L497–L508（`if preempted_req == request: break` 后 `if new_blocks is None: break`）。
- 整段放得下才接纳：`kv_cache_manager.py` L354–L368，只在 waiting 侧传 `full_sequence_must_fit`。
- 默认预算表与昇腾落小档：`arg_utils.py` L2305–L2335；Ascend `platform.py` 的 `get_device_total_memory` 在 2c59ff10 / db701c1f / 2ed6cbba 均 `raise NotImplementedError`，baa023ad 在 torch_npu 初始化前仍抛。
- BalanceScheduler：db701c1f `patch_balance_schedule.py` L84–L88 回落、L718 替换；`envs.py` 默认 `"0"`；2ed6cbba L165–L178 回落分支多了临时置假 `has_mamba_layers`、L936 替换；baa023ad 开关挪进 `scheduler_config`，默认 False。
- 变体开关：db701c1f `platform.py` L680–L715（recompute 只允许 kv_consumer，其他抛 ValueError；SLO 默认 -1；profiling_chunk 默认 False）；SchedulerDynamicBatch 在 2ed6cbba、baa023ad 已不在 platform.py；short-request-first 在 db701c1f 不存在、2ed6cbba 和 baa023ad 有。
- 上游 v0.26（568afb3a）与 main（84030bbe）：注释、阈值默认 0、chunked 默认 True、reserve_full_isl True 都在；main 新增 ≥160 GiB 一档默认值。

### 旧版信息清单勾选

清单：`scratchpad\p5\vllm-scheduler-facts.md`（c60c4fa 共 28 条 A1–A28，p4 现版独有 8 条 B1–B8）。

- A1–A3、A8–A12、A14–A21、A23–A26、A28：新版都有（正文或对照源码）。
- A6：初版只保留了「走层、集合通信、下发算子」，漏了「读权重」这一项固定开销，勾「保留」不属实；09-29 修订已补回（见下方修订记录 P2-3）。
- A4、A5、A7、A17：数字换成 GLM 部署（2048 → 8192 显式配置、37/200 → R1 的 4 与每步 4、2048 块碰巧相等 → 640 块与 8192 不整除、37 < 2048 → 6000 < 8144）；旧例的模型不是当前固定部署，旧数字不再适用；「不给参数时是 2048」保留在怎么开。
- A13：保留，并恢复「硬件插件能间接改默认值」的结论和 NPUPlatform、Platform 接口两处链接。
- A22：更新为本部署 `mamba_cache_mode = none`、不切；align 模式的影响链接 prefix-caching。
- A27：保留 v0.26，并补上旧版未核的 main。
- 旧版误解「调度器还交出采样参数」：保留为「新请求附带提示词和采样参数」（核 `output.py` 的 NewRequestData）。
- B1–B3、B5–B7：新版都有；B7 的「下一步看输入准备」恢复为 prepare-inputs-flow 链接。
- B4：保留为调度策略两种（fcfs 抢队尾 / priority 抢最低优先级），外部 KV 传输本部署不开，未展开。
- B8（预算 6、上限 2）：按本批验收要点删除。

### 验证

- `pnpm wiki:lint`：通过；本页 0 报错。其他页的「待留意」（如 recompute-scheduler 的 mark-flood）不是本页。
- `pnpm wiki:diagrams`：写入 token-budget.svg、vllm-scheduler-flow.svg；`--check` 197 张图与 spec 一致；两张图没有「放不下」「一整句」「代码名」提示。
- `pnpm wiki:audit`：通过；本页 30 条来源全部行号有效。
- 临时把本页当名单页跑写作标准（scratchpad 脚本，不改 standard-pages.json）：教学正文 3710 字、行内代码 0.0/千字、对照源码之上角标 0、calc 0.27/千字、相邻块 0、图先行、免责 1.9%、图宽通过，problems 为空。
- 锚点检查：25 个跨页链接，0 个坏锚点。
- 全页角标 28 处，C 级 20 处（71%）。
- 没有截图、没有起服务；浏览器验收留给审查环节。

### 疑点与待核

- 异步调度是否真的开着，缺启动日志（页末待核 1）。
- 8192 与 640 不整除是否有 kernel 路径要求对齐，沿用 01 §A2 待核 3（页末待核 2）。
- 01 §B2 待核 2（调度器变体默认是否启用、balance 开关默认值）本次已按 db701c1f 源码核实为都不开，底稿可据此关闭；本页未改底稿。

## P5 审查（09-29）

审查员：独立审查（只审不改页）。依据：现版正文 L51–L150（分段读）、p4-checkpoint 旧版正文、c60c4fa 抽查、写作记录与 facts 清单、01 §A2.1–A2.4 / §B2、03 §A6 第 24 条、D「关键参数各管哪一步」、C 第 2 站与「分几步算」、R 第 2 站；源码 vllm@0fc695fc、vllm-ascend@db701c1f。

**分数：7 / 10**（P1 1 条、P2 3 条、P3 7 条）

### 1. 初学者测试（只读前两屏）

我的一句话：Scheduler 是 EngineCore 每一步开头跑的一段逻辑，看每条请求「应算 − 已算」还差几个位置，在 token 预算、请求数上限和空闲 KV 块之内先给 running 续上、余量再给 waiting，写成一份计划交给 worker；代价是新请求排得更久、长提示词首 token 变晚、块不够时被抢占的请求要从头重算。——通过。

### 2. 核心概念（对照源码）

- 不分 prefill/decode、每条请求只追 num_tokens_with_spec：对，vllm@0fc695fc `scheduler.py` L342–L351。
- running 的「还差」含占位数、三次截断（单条阈值 → 剩余预算 → max_model_len−1−已算）：对，L402–L415。
- waiting 准入三条件（本步未抢占、未暂停、running 未满）：对，L563–L568。
- 关 chunked prefill 超余量直接 break、不切：对，L691–L697。
- waiting 默认先检查整段能否放下：对，`scheduler_reserve_full_isl` 默认 True（config/scheduler.py L140），kv_cache_manager.py L354–L368。
- 借不到块 FCFS 抢 running 队尾、抢到自己即结束 running 扫描、抢占过就不接 waiting：对，scheduler.py L474–L508。
- 抢占五动作（还块、清零、清候选、PREEMPTED、退回 waiting 队首）：对，`_preempt_request`。
- long_prefill_token_threshold 默认 0，仅 max_num_partial_prefills>1（默认 1）时自动设：对，config/scheduler.py L70、L80、L244–L246。
- BalanceScheduler 全局替换、闸门默认关时回落 super().schedule()：对，db701c1f patch_balance_schedule.py L84–L88、L718；envs.py L105 默认 "0"。
- 变体开关：recompute 在混合部署抛 ValueError、SLO 默认 −1、profiling chunk 默认关：对，db701c1f platform.py L680–L715。
- 例外见 P1：「两条代码路径」误解条表述越界。

### 3. 数字与验收要点

- 「预算 6、上限 2」已从正文和图 spec 中删净（grep 无残留，全库也无）。✔
- 8192 / 32：出处是官方配方启动参数（D L81–L82、L305–L306），01 §A2.1 登记；源码映射 scheduler.py L104–L109（max_num_seqs → max_num_running_reqs；max_num_scheduled_tokens 未设时取 max_num_batched_tokens）。页面写「官方配方显式给的、每个 DP 组各一份」，属实。✔
- 场景 M（48、8144、6000、6048、13）、门槛 8068、20,000 分三步：与 01 §B2 和 C L140–L179 一致，均带链接。✔
- R1 第一步 7 个位置、15 个块号：与 R 第 2 站、01 §A2.2 一致，写的是「第一步」，未写成定值，未重算。✔
- 128 最大捕获尺寸：与 D L81–L82、01 §B2「上限」一致。1.6%（128 ÷ 8192 = 1.5625%）是本页唯一新数。✔
- 45 层、640 位置一块、8192 与 640 不整除：与 01 一致。✔
- 未启用特性（Balance 闸门、Recompute、DynamicBatch、ProfilingChunk）都标「本部署没开、无实测数」，无虚构部署数字；异步调度写成「按默认条件推断、缺启动日志」，口径正确。✔
- 写手疑点：01 §B2 待核 2（变体与 balance 默认不开）我按 db701c1f 抽查属实。

### 4. 丢信息（基线 p4-checkpoint + facts 清单）

整页重写（+180 / −33）。按旧 H2 逐条对照：进度差、最终安排量可小于待处理量、预算不是字数/输出数、遍历顺序不保证 running 不阻塞、抢占释放并重置、分块对齐检查、调大上限不保证吞吐、下一步看输入准备——都在。facts 清单抽查 A6、A13、A18、A19、A25：A13/A18/A19/A25 属实；A6 不完全属实（见 P2-3）。丢失项见 P1、P2-2、P2-3。

### 5. 链接与锚点

本页 25 个带锚点链接用 GitHub 式 slug 脚本逐个解析，0 个坏锚点；全库 21 个文件链到本页，均无锚点，不受标题改动影响。token-budget 图只被本页使用，重画不影响别页。

### 6. audit / lint

`pnpm wiki:audit`：全库通过，本页 30 条来源 0 个 ✗。`pnpm wiki:lint`：通过，本页无待留意项。图用 Playwright 按 file:// 渲染 token-budget.svg、vllm-scheduler-flow.svg 看过（未起服务）。

### 7. 问题清单

**P1**

1. **L142「常见误解」第一条 + 丢了 p4 版的限定。** p4 版在讲统一进度时专门写了「这是调度抽象；注意力后端仍会为 prefill、decode、投机验证选不同路径」，新版删掉了，还把误解条写成一刀切的「不是两条代码路径」。这只在调度器里成立：vllm-ascend@db701c1f `attention/mla_v1.py` L1243 `_forward_prefill`、L1392 `_forward_decode` 是两条路径，本部署也只有纯 decode 步走 FULL_DECODE_ONLY 图。问答按这条回答「prefill 和 decode 是不是两条代码路径」会答错。facts 清单 B 段也漏记了这条。**改法**：误解条改成「在调度器里不是两条路径……；到了 worker 的注意力后端，prefill、decode 和投机验证仍走不同分支，混合步也不走图」，并在 L55 附近恢复一句限定。

**P2**

1. **术语先用后讲、没用英文原名。** L69 先用「MTP 候选」，到 L104 才解释 MTP；L85、L107 的「缓存组」全页没解释（GLM 有 full、KDA×3、indexer-state 几组，是理解「15 个块号」的前提）；「前缀缓存」（L104、L126、L128 共 6 处）、「投机解码」（L96）是 TERMS 里以 prefix caching、speculative decoding 为正名的术语，按规则应用英文原名、首次出现给中文解释。**改法**：MTP 的一句话解释挪到 L69；L85 首次出现「缓存组」时用一句话说明并链 kv-cache-spec；前缀缓存 / 投机解码改为 prefix caching / speculative decoding。
2. **丢了两个专页链接。** p4 版链了 chunked-prefill.md 和 kv-cache-spec.md，新版都没了；L92、L145 在讲 chunked prefill，L85 在讲缓存组，读者没有去处。**改法**：L92 首次出现 chunked prefill 处链 chunked-prefill.md；缓存组处链 kv-cache-spec.md。
3. **L67 固定开销丢了「读权重」，写作记录却把 A6 勾成「保留」。** c60c4fa 把「从显存里读出权重」列为每步躲不掉的固定开销，这是凑批最主要的理由（decode 受显存带宽限制）；新版只剩走层、发起集合通信、下发算子。**改法**：补回读权重一项，并加 MoE 的限定（attention 与共享部分每步读一次；路由专家读多少随本步 token 的路由变化），写作记录 A6 改为如实勾选。

**P3**

1. **单一出处（轻）。** L117–L118 的 calc 重算 32 × 4 = 128，这个数 D L82、01 §B2「上限」、C L334 已给出；L122「扣掉 48 后剩 8144」重复 C L140 的中间步。**改法**：calc 只保留 128 ÷ 8192 这一行，128 引 D；L122 只给 6048 / 13 条结论加链接。
2. **抢占讲了 5 遍**（L61、L77、L94、L128、L146），可把 L61 压成一句、L77 第三点并入 L128。
3. **直觉图 KV 块格子**：A、B 各占一格、C 占四格，加上 L61「每排一条请求，还要…借到 KV 块」，初学者容易读成「一个位置一块 / 每步都要借新块」。**改法**：图注或 L61 补一句「一块装很多个位置，手里的块写满了才借新块」。
4. **流程图**：③ 指向「停止接纳 waiting」的箭头没有标注（应为「waiting 借不到」）；「抢到自己就收尾」悬空，没接到出口；④「整步排完就把已算数前移」画在逐条循环里，与文字不符。
5. **「昇腾上跑的是哪个调度器」没提 AsyncScheduler。** 页面推断异步调度是开的，这时 `get_scheduler_cls` 返回 AsyncScheduler（vllm config/scheduler.py L168–L173），它在全局补丁之后才被懒加载，按导入顺序推断父类是替换后的 BalanceScheduler（我没实跑，未验证）。建议补一句，并标「推断」。
6. **L83** 把 waiting 的「还差」写成「提示词里还没算的部分」；被抢占后退回的请求，还差的是提示词加已生成部分（源码 L684 用 num_tokens，注释专门说明）。L128 有补，建议 L83 也改准。
7. **L71** 表头先用「每个 DP 组」，L100 才解释两台机器是两个 DP 组；可在表前加半句或链 D。

### 8. 跳过的段落

frontmatter 来源区（L2–L48）未读；「## 对照源码」（L151–L218）正文按规定未读，只 grep 核对了五个 H3 的顺序、版本差异里的 v0.23 / v0.26 / main 和钉点（读了 L186–L190 表头说明），另为核 A19 读了 L157 一行；正文里的 calc（L115–L120）读了，wiki-diagram 代码块只看了文件名、图用渲染结果核；HANDBOOK、docs/plans/ 未读。没有读取被拦。

## P5 修订记录（09-29）

按上方「P5 审查（09-29）」修订。审查的 P1、P2 核实后都成立，全部照改；P3 七条改了六条，一条部分采纳。

### P1

1. **「两条代码路径」越界、丢了 p4 版限定。** 核实：db701c1f `vllm_ascend/attention/mla_v1.py` L1243 `_forward_prefill`、L1392 `_forward_decode` 确为两条路；KDA 的 prefill 分段、decode 递推见 linear-attention「Prefill 用 chunked 计算，decode 逐位置推进」；纯 decode 才回放图见 01 §B2「上限」。改法：
   - 首屏第二段末尾加限定句：「不分阶段」只在调度器里成立，worker 侧注意力计算仍按 prefill、decode 分路（KDA 例子 + 链 linear-attention 锚点），混进 prefill 的一步不走 graph mode。
   - 常见误解第一条改为「在调度器里不是……到了 worker 一侧，注意力后端仍为 prefill、decode 和投机验证走不同分支……混进 prefill 的一步整步不走图」。
   - 源码位置表加一行「调度器之外，prefill 和 decode 仍分路的地方」（mla_v1.py 两个函数），sources 加 `vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1243-L1392`。
   - facts 清单补登 B9。

### P2

1. **术语先用后讲、没用英文原名。**
   - MTP 的一句话解释挪到首次出现处（「为什么按 token 设预算」第二段）；R1 第一步那里只留「MTP 的 3 个候选」，并点明预留叫 lookahead。
   - 「缓存组」首次出现（四关第 3 关）加一句解释并链 KV cache 规格（kv-cache-spec）。
   - 前缀缓存全页改为 prefix caching，首次出现（R1 第一步）给中文解释，链接文字同步改。投机解码改为 speculative decoding，首次出现（首屏第二段「候选 token」处）给中文解释。
   - 顺带：异步调度首次出现（第 1 关）改为 async scheduling 并给解释，后文与链接文字统一用英文；图模式首次出现（固定开销段）改为 graph mode 并给解释。对照源码区的「前缀缓存」「异步调度」也改成英文名。
2. **丢了两个专页链接。** 第一次出现 chunked prefill（四关之后第一段）链 chunked-prefill；缓存组处链 kv-cache-spec。
3. **固定开销丢了「读权重」。** 「为什么按 token 设预算」第一段补为：最大的一笔是读权重，每卡约 20.58 GiB（链部署页「每张卡上放了什么」，不重算）；attention、稠密层和共享专家那部分每步完整读一遍，路由专家只读本步有 token 路由到的那些，读多少随路由变化；段末改为「硬件大部分时间在等数据从显存读进来」。写作记录 A6 已改为如实勾选。

### P3

1. **单一出处。** calc 只留「128 ÷ 8192 ≈ 1.6%」一行，128 在前一句注明来源并链部署页「关键参数各管哪一步」；场景 M 删掉「扣掉 48 后剩 8144」这一中间步，只给 6048 / 13 条结论和链接。
2. **抢占讲了 5 遍。** 首屏图解段压成一句（running 一侧抢占别的请求，waiting 一侧等下一步）。第二屏「代价有三处」的第三点保留：写作标准要求第二屏讲清代价，抢占是三处代价之一，不并入后文。此条部分采纳。
3. **KV 块格子易误读。** 首屏图解段补「一块能装很多个位置，请求手里的块写满了才借新块，图里的格子只表示块借给了谁」。
4. **流程图。** ③ 到「停止接纳 waiting」的箭头加标注「waiting 借不到」；「抢到自己」改成一条从「running 借不到块」接到判断框的箭头（判断框副标题写明扫 waiting 要本步没抢占过，因此走「否」到出口）；④ 改为「扣掉本步预算 / 记下这条本步安排几个 token」，「已算数统一前移」挪到出口框；图注同步。
5. **没提 AsyncScheduler。** 核实：vllm@0fc695fc `config/scheduler.py` L168–L176，`scheduler_cls` 为空且 `async_scheduling` 为真时懒导入 `AsyncScheduler`；`async_scheduler.py` L6、L12 从 `scheduler` 模块取 `Scheduler` 作父类；db701c1f 里只有 `recompute_scheduler.py` 导入它（本部署不走）。「昇腾上跑的是哪个调度器」一节补一句，写明按导入顺序推断父类是 BalanceScheduler、没有实跑确认；源码位置表加一行；sources 加两条。
6. **waiting 的「还差」。** 第 1 关改为「现有的全部 token 减去已算：新请求是整段提示词，被抢占退回的还包括已生成部分」；第 3 关的整段检查同步改为「全部 token」（源码按 min(request.num_tokens, max_model_len)）。
7. **DP 组先用后讲。** 表前加半句：两台机器各是一个 DP 组（data parallel 的执行组，各自独立排请求），表里的数每组各一份。

### 验证（修订后）

- `pnpm wiki:lint`：通过，本页 0 报错、无待留意项。
- `pnpm wiki:diagrams`：重新生成 vllm-scheduler-flow.svg，无「放不下」「一整句」「代码名」提示；`--check` 197 张图与 spec 一致。
- `pnpm wiki:audit`：通过；本页 33 条来源行号全部有效，0 个 ✗。
- 按名单页口径跑写作标准：教学正文 4185 字，行内代码 0.0/千字，对照源码之上角标 0，calc 0.24/千字，相邻块 0，图先行，免责 1.7%，图宽通过，problems 为空。
- 锚点：30 个跨页链接，0 个坏锚点。全页角标 28 处，C 级 20 处（71%）。
- 正文非空白字符 11,813 → 13,207。

## P5 复审（09-29）

复审员：独立复审（只审不改页）。范围：首审 P1、P2 逐条到现版正文核实，另核修订新增的句子、链接和源码行；P3 只抽查。依据：现版正文 L54–L150、L209–L215 两行（grep）、summary 行；源码 vllm@0fc695fc、vllm-ascend@db701c1f；底稿 01、02；D、R、linear-attention、kv-cache-spec 的标题与相关行。

**分数：8 / 10**（首审 P1 已修好；新增 P1 0 条、P2 2 条、P3 3 条）

### 1. 首审 P1 核实

**「两条代码路径」越界：已修好。** 首屏第二段末尾（L58）补了限定：「不分阶段」只在调度器里成立，worker 侧的注意力计算仍分 prefill、decode 两路，并举了 KDA 的例子。误解条（L143）改成「在调度器里不是」，后半句讲 worker 侧仍分路，还写明本部署只有纯 decode 步回放图。

- KDA 的例子属实：vllm-ascend@db701c1f `ops/kimi_kda.py` L355 `_run_recurrent`、L390 `_run_prefill`，L506–L546 把投机的 token 和非投机的 token 分开处理；02 L265–L266 记的也是这两条路。
- 「本部署只有纯 decode 步回放图」属实：01 L247 写 `FULL_DECODE_ONLY`，01 L957 写混合步不走图。
- linear-attention 的锚点能对上 linear-attention.md L198 的标题。

残留问题：修订给这条限定配的源码证据指错了对象，见新 P2-1。

### 2. 首审 P2 核实

1. **术语先用后讲、没用英文原名：已修好。** MTP 首次出现在 L72，同一句就解释了；speculative decoding 在 L58 首次出现并带解释；prefix caching 在 L107 首次出现并带解释，正文里「前缀缓存」只剩这处括号解释；缓存组在 L88 有解释，并链到 kv-cache-spec。L88 写的「GLM 分 5 组」和 01 L26 一致。修订新引入的先用后讲见 P2-2。
2. **丢了两个专页链接：已修好。** chunked prefill 首次出现在 L95，链到 chunked-prefill.md；缓存组在 L88，链到 kv-cache-spec.md。两个文件都存在。
3. **固定开销丢了「读权重」：已修好。** L70 补回读权重，并写明路由专家只读本步路由到的那部分。20.58 GiB 与 D L111、L177 一致，没有重算；D L168 确有 3 层稠密 MLP，页面说「稠密层」有依据；锚点「每张卡上放了什么」能对上 D L158；「一次前向的通信账」锚点能对上 R L369。facts 清单 A6 已按实际情况勾选，B9 已补登。

### 3. P3 抽查

- 第 1 条（calc 只留一行、删掉 8144）、第 3 条（L64 补了块的说明）、第 6 条（L86、L95 改成「全部 token」）、第 7 条（L72 表格前补 DP 组的解释）：都落实了。
- 第 5 条（AsyncScheduler）：源码属实。vllm@0fc695fc `config/scheduler.py` L168–L176 懒导入 AsyncScheduler；`async_scheduler.py` L6、L12 从 scheduler 模块取父类；db701c1f `patch_balance_schedule.py` L718 把 `vllm.v1.core.sched.scheduler.Scheduler` 换成 BalanceScheduler；vllm-ascend 里只有 `core/recompute_scheduler.py` L36 导入 AsyncScheduler。页面 L133 标明是推断、没有实跑，口径正确。
- 第 4 条（流程图）：本次没有复核渲染结果。

### 4. 本轮删改有没有丢信息

工作区没有修订前的快照，`git diff` 对比的是 p4 版，覆盖整个 P5 改动（+183 / −33），没法只挑出本轮修订的删改。因此只核了修订涉及的几处：

- 首屏的抢占说明压成一句后，细节仍在 L97 和 L129。
- 删掉的「8144」中间步仍在 C 页，L123 有链接过去。
- calc 里删掉的 32 × 4，L116 链到了 D。
- summary 改写后丢了 p4 版「统一进度不消除计算差别」的限定，归为 P3-2。

结论：修订没有造成信息丢失。

### 5. audit

`pnpm wiki:audit` 退出码 0，全库通过。本页 33 条来源行号都有效，0 个 ✗；新增的 `config/scheduler.py#L168-L176`、`async_scheduler.py#L6-L12`、`mla_v1.py#L1243-L1392` 三条都是 ✓。写作标准：名单 46 页全部达标。

### 6. 新问题清单

**P1**：0 条。

**P2**

1. **L215 源码位置表的「调度器之外，prefill 和 decode 仍分路的地方」，以及 frontmatter 的来源 `mla_v1.py#L1243-L1392`，都指向了 GLM 不走的后端。**
   - GLM 的稀疏 MLA 层用的是 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`：db701c1f `attention/indexer_kpool_mla_v1.py` L25、L557；底稿 02 L364–L367 也这样写。它不是 `mla_v1.py` 里的 AscendMLAImpl。
   - 这条路径不分 prefill 和 decode：`indexer_kpool_mla_v1.py` L557–L1104 里 grep 不到任何按 prefill/decode 分支的代码；`sfa_v1.py` 的 forward（L1650–L2032）只在 prolog_v3（L1703，GLM 已关，见 02 L367）和 DSA-CP 的 o_proj（L1698）两处看 attn_state。也就是说，GLM 12 个 MLA 层对一步里的全部 token 走同一条路，真正分路的只有 34 层 KDA。
   - L143 的「注意力后端仍为 prefill、decode 和投机验证走不同分支」也因此说得太宽。
   - 影响：问答按这一行回答「GLM 的 prefill 和 decode 分别走哪个函数」，会答成 `mla_v1` 的 `_forward_prefill` 和 `_forward_decode`，与 02 不符。这个指向最初来自首审给的改法，修订照搬了过来。
   - **改法**：L215 换成 KDA 的 `ops/kimi_kda.py` 三处（L390 `_run_prefill`、L355 `_run_recurrent`、L506–L546 投机分支），并注明稀疏 MLA 层一次处理整批、不分路；来源里的 `mla_v1.py` 换成 kimi_kda.py 对应行；L143 改成「GLM 的 KDA 层仍为 prefill、decode 和投机验证走不同分支，稀疏 MLA 层则整批一起算」。
2. **L58 新增的限定句里有两个问题。**
   - 术语先用后讲：KDA 在 L127 才解释，graph mode 在 L70 才解释。
   - 「一步里只要混进 prefill，也不走 graph mode」没写条件，只在本部署的 `FULL_DECODE_ONLY` 下成立（01 L247、L957）。上游默认是 `FULL_AND_PIECEWISE`（vllm@0fc695fc `config/vllm.py` L257、L278），混合步可以走 piecewise 图。
   - 影响：初学者在首屏读不懂这两个词；问答会把本部署的行为当成通用规则。
   - **改法**：L58 的 KDA 后加括号，一句话解释（线性注意力，每条请求只存一份固定大小的状态）；graph mode 的解释挪到 L58 首次出现处，L70 只保留英文名；那半句改成「本部署只有纯 decode 步才走 graph mode，混进 prefill 的一步不走」。

**P3**

1. L214 源码位置表的行名仍是「开异步调度时建哪个类」。修订记录说对照源码区已改成英文名，这里没改到，应为 async scheduling。
2. summary 可以补半句「只在调度器里不分；worker 侧仍分路」，给问答的检索摘要留住首审 P1 那条限定。
3. L70 先写「每张卡约 20.58 GiB 权重」，再说路由专家只读一部分。可以补一句路由专家占了其中 86%（D L181），免得读者以为每步要读满 20.58 GiB。

### 7. 跳过的段落

- frontmatter 来源区未读，由 audit 校验。
- 「## 对照源码」正文未读，只 grep 看了 L209–L215 的几行。
- 流程图没有重新渲染核对。
- 没有修订前的快照，diff 无法只取本轮修订的删改（见第 4 节）。
- `pnpm wiki:lint` 没有重跑。
- 没有读取被拦。

## P5 复审后修订（09-29）

两条 P2 核实后都成立，全部照改；P3 三条顺手全改。

### P2

1. **分路的源码证据指错了后端。** 核实：GLM 稀疏 MLA 层走 db701c1f `attention/indexer_kpool_mla_v1.py` L557 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`，再到父类 `sfa_v1.py` 的 forward（L1650–L2032），里面只在 prolog_v3（GLM 已关）和 DSA-CP 的 o_proj 两处看 attn_state，不按 prefill、decode 分支；底稿 02 L363–L367 同。KDA 层才分路：`ops/kimi_kda.py` L506–L546 先把投机 token 与非投机 token 分开，投机部分走 L355 `_run_recurrent`，非投机部分有 prefill 时走 L390 `_run_prefill`；底稿 02 L264–L266 同。改法：
   - 源码位置表「调度器之外，prefill 和 decode 仍分路的地方」一行改为 KDA 的 kimi_kda.py（投机 / 非投机先分开，递推与分段两个函数），并写明稀疏 MLA 层走 `AscendIndexerKPoolMLAImpl` → `AscendSFAImpl.forward`，本部署下一步里全部 token 同一条路。
   - sources 删掉 `mla_v1.py#L1243-L1392`，换成 `kimi_kda.py#L355-L475`、`kimi_kda.py#L506-L600`、`indexer_kpool_mla_v1.py#L557-L557`。
   - 常见误解第一条后半句改为「GLM 的 KDA 层仍为 prefill 和 decode 走不同分支（prefill 分段算，decode 与候选验证逐位置递推），稀疏 MLA 层则对一步里的全部 token 走同一条路」。
2. **首屏限定句先用后讲、没写条件。** 核实：本部署 cudagraph_mode 为 FULL_DECODE_ONLY（01 L247、L957），上游默认不是它（复审给的 vllm@0fc695fc `config/vllm.py` L257、L278）。改法：
   - 首屏第二段的限定句改为「部分层仍按 prefill 和 decode 走不同的路，比如 GLM 的 KDA 层（线性注意力，每条请求只存一份固定大小的状态）……」，KDA 就地解释。
   - 「混进 prefill 也不走 graph mode」改为「本部署还只有纯 decode 步才走 graph mode（图模式：……），混进 prefill 的一步不走」；graph mode 的解释挪到这里首次出现处，「为什么按 token 设预算」第一段只保留英文名。

### P3

1. 源码位置表「开异步调度时建哪个类」改为「开 async scheduling 时建哪个类」。
2. summary 改为「在调度器里不分 prefill 和 decode（worker 侧仍有分路）」，其余字面略压缩，保持 200 字以内（198 字，lint 通过）。
3. 固定开销段补「其中 17.72 GiB（86%）是路由专家」，出处部署页 D L181，只引用不重算。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错。
- `pnpm wiki:diagrams --check`：198 张图与 spec 一致（本轮没改图）。
- `pnpm wiki:audit`：通过；本页 35 条来源行号全部有效，0 个 ✗，新增三条都是 ✓。
- 按名单页口径跑写作标准：教学正文 4241 字，行内代码 0.0/千字，对照源码之上角标 0，calc 0.24/千字，相邻块 0，图先行，免责 1.7%，图宽通过，problems 为空。
- 锚点：30 个跨页链接，0 个坏锚点。全页角标仍为 28 处。
