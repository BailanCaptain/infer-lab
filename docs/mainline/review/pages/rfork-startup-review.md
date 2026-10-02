# rfork-startup 审查记录

## P5 写作记录（2026-10-02，第 24 批深改）

### 改了什么

- 字数（standard.ts 口径，对照源码之前的正文）：改前 2,509 → 改后 4,856；行内代码 0，正文角标 0，calc 0，免责句 0 / 109。对照源码区角标 23 处（C 18、D 2、S 1、I 1、! 1，C 占 78%）。
- 结构按讲法重排：是什么（一句话 + 十步直觉图）→ 为什么晚申请、代价 → 十步表 + 三种情况走法 → 两处提前离开 → 回退清理（新增代码流程图）→ 普通加载重来 → 三类「没有可用 seed」→ GLM 双机 → 常见误解 → 对照源码五个 H3。
- 删掉假设耗时（旧版「20 秒 + 10 秒 + 15 秒」），改用真实可查的量：示例 Planner 默认 1 个借用名额、租约有效期 60 秒，加四条耗时日志 + 分段耗时日志作为现场量法；估算缺口写进页末待核。
- 直觉图 rfork-startup.yaml 重画：十步纵排，左侧竖条分「不占租约 / 占着租约 / 读完之后」三段；② EPLB、⑤ 草稿全共享两处提前离开；⑦ 没借到、⑧ 读失败虚线进清理框，清干净后普通加载、汇回 ⑩；清不干净挂「报错终止」标签。
- 新增代码流程图 rfork-startup-fallback.yaml：会话是否建成 → 停服务/还租约/注销（两轮）→ 快照恢复 → 服务停了且内存注销了？否则报错 → 回收缓存 → 普通加载（失败抛错）→ 会话在则发布 seed。
- 保留唯一入链锚点：rfork-lifecycle 链到「借不到或读失败：先拆干净，再从磁盘重来」，该标题原样保留。
- frontmatter：summary 重写（155 字）、updated 改 2026-10-02、relations 加 npu-worker-lifecycle；sources 由 12 条增到 22 条（调整 4 条行号范围，新增设计说明、示例 Planner 两段、session 构造与 start_seed_service、fused_moe 登记、三个社区版本加载器、transfer_backend 构造）。

### 数字出处

- 32 个会话、TP 编号 0 在第 0/8 号卡：01 §A0.8「在我们部署下的具体数字」（tp_rank = r mod 8）+ 源码 `_is_rfork_summary_rank`；32 份钥匙/租约只链接 rfork-identity，不重算。
- 每卡读多少、批数：只链接 rfork.md「放到 GLM 双机」，不重算。
- 第一次冷启动必然回退、多付建模型 + 后处理：01 §A0.8「适用条件」第三条。
- 教程命令不开 EPLB：01 §A0.8「怎么走的」第 2 步（enable-eplb 出现 0 次）。
- 草稿词嵌入/输出头在传输时刻不共用：01 §A0.8 第 9 步；KV 块变少的推断只链接总览。
- 示例 Planner 1 个名额、60 秒：rfork@3284850b:examples/rfork/rfork_planner.py#L39-L74、#L192-L212。

### 核心概念对照

- 十步顺序、提前离开、回退路径：rfork@3284850b rfork_loader.py L521-L710 逐行读过（会话建在 try 内；草稿全共享直接 return eval、不发布；acquire 前 processed layout + synchronize；未命中抛 _RForkSeedUnavailable；回退：prepare_for_fallback ≤2 轮 → 快照恢复 → 清理不合格抛 RuntimeError → gc/empty_cache → get_model → 会话在且 can_schedule_seed 才发布）。
- 「没有可用 seed」日志只在 tp_rank 0 为 info（L73-L77、L647），旧版「按 rank 打」不准确，已改。
- 会话自拒四种：session.py L64-L91（旧版漏了「旧租约仍未还掉」这一种，已补）；planner 客户端 404 只 debug、其他错误 warning：planner_client.py L69-L109。
- 会话构造即建 Planner 客户端与 TransferEngine（session.py L38-L57，transfer_backend.py L189-L217）：缺配置 / 缺 yr.datasystem 都落进回退且 session 为 None，回退后不发布。
- 第 10 步重新登记：session.py L296-L347（非 TRANSFERRED 或非 processed layout 时重登记）。
- 昇腾 MoE 登记表无条件登记：rfork@3284850b vllm_ascend/ops/fused_moe/fused_moe.py L508-L511，旧版「也可能留着层」改为确定说法。
- 晚申请动机与代价：rfork@3284850b docs/.../rfork_lease_lifecycle.md L28-L52 方案表。
- 版本差异：vllm-ascend@2c59ff10 / 2ed6cbba / baa023ad 的 rfork_loader.py 均为「先 is_seed_available 再 initialize_model」；v0.23 绕过含 layer_sharding；main 回退调 _reset_process_global_model_state 但注销失败只告警、不拒绝（baa023ad L409-L422）。旧版「社区没有这条加载路径」改为逐版说明。
- 参考图库（refs/）只覆盖通信原语与 TP/DP/EP，本页借用了「把状态写在步骤上」「把限制讲成具体日志」两条讲法。

### 旧版信息清单勾选（清单在 scratchpad\p5\rfork-startup-facts.md）

- F1–F7、F9–F30：全部在新版保留；F5 十步表补了会话状态，F12 MoE 登记表一行按源码改为确定说法，F17 补重新登记与延期，F21 由两类细化为三类（404 / 出错 / 会话自拒）并补第四种自拒原因，F25 报错表由 4 条扩到 9 条，F29 版本差异改为逐版说明。
- F8（假设耗时 20+10+15 秒）：按本批验收要求删除，改为真实默认值 + 耗时日志量法，估算缺口进页末待核 2。
- 底稿新增 N1–N7：N1、N3、N5、N6 写进正文；N2、N4 链接总览与身份页；N7 写进页末待核 1、2。

### 疑点 / 待核

- 本页 GLM 段全部是「工作版加载器 + db701c1f GLM 模型」的组合推演，「32 个会话首次全部 404、默认日志 4 行」需在合并后代码上实跑核对（页末待核 3）。
- 生产 Planner 的名额与有效期未知（页末待核 1）。
- 自查无 P1 疑点。验证：pnpm wiki:lint 本页 0 报错；pnpm wiki:diagrams --check 287 张一致；pnpm wiki:audit 退出码 0、本页 22 条来源行号有效；写作标准自测（仿 scripts/wiki/standard.ts）8 项全过。5193 预览用 Playwright 只读打开，10 个 H2 与两张图、三张表均正常渲染，无控制台错误。

## P5 审查（09-29）

审查员：独立审查（Opus 5.5），2026-10-02，第 24 批。只审未改页面。

### 结论

- 分数：7.5 / 10。
- 学习顺序：通过。问题式 H2 + 一句话定义 + 十步直觉图 → 为什么晚申请、代价 → 十步表与三种情况 → 两处提前离开 → 回退清理 → 普通加载重来 → 三类「没有可用 seed」→ GLM 双机 → 常见误解 → 对照源码。基础节没有 GLM 数字，GLM 段之后只有误解和对照源码。本页讲顺序、没有需要演算的公式，calc 为 0 合理。
- 初学者测试（只读前两屏）：RFork 启动是 B 的每个 Worker 先在本卡搭好空模型、转好布局，再向 Planner 借租约、按地址读 A 的权重；借不到或读失败就先清理干净再从存储普通加载；代价是没命中时搭模型和布局处理要做两遍。能说清。
- audit：`pnpm wiki:audit` 退出码 0，本页 22 条来源全 ✓。本页不在 standard-pages.json 名单里，audit 不打印写作标准行；用 scripts/wiki/standard.ts 的 checkStandard 单独自测（scratchpad 脚本）：4856 字，行内代码 0.0/千字、角标 0、对照源码、calc 0.00/千字、相邻块 0、图先行、免责 0.0%、图宽，8 项全 ✓。`pnpm wiki:lint` 通过（本页 0 报错，含跨页锚点）。
- 对照源码五个 H3 齐全、顺序正确；版本差异含 v0.23 / v0.26 / main。
- 旧版信息清单存在（13898c74…\scratchpad\p5\rfork-startup-facts.md，F1–F30 + N1–N7）。抽 8 条核新版：F6（L103）、F11（L126）、F14（L141）、F16（L149）、F18（L115）、F23（L179–183）、N1（L72）、N3（L173）均在；F8 假设耗时已删（grep 无 20/10/15 秒）。F21「按 rank 打」改为「只在 TP 编号 0 为 info」，是按源码更正（rfork_loader.py L73-L77、L647），不算丢信息。
- 浏览器：Playwright 1440 宽只读打开 5193，10 个 H2、两张图、6 张表正常渲染，控制台 0 错误。截图：本会话 scratchpad\rfork-startup-review-first.png、rfork-startup-review-diagram1.png、rfork-startup-review-diagram2.png。没有新增分镜动图。

### 逐步对照源码（rfork@3284850b）

- 第 2 步：`_is_dynamic_eplb_enabled`（rfork_loader.py L373-L383）三条件，命中在建会话前 `get_model`（L540-L561），失败 `logger.exception` 后 `raise`。正确；两条日志原文逐字一致。
- 第 3 步：会话建在 try 内（L563-L565）；`RForkSession.__init__` 缺 planner_url / model_url / strategy 抛 ValueError（session.py L37-L42），`RForkTransferBackend()` 构造里导入 yr.datasystem，失败抛 ImportError（transfer_backend.py L189-L215）。这时 session 为 None、model_init_started 为 False，跳过清理直接普通加载，事后不发布（L657-L658、L698-L708）。页面 L143 与回退图正确。
- 第 4–7 步：快照 → initialize_model → `can_reuse_shared_weights`（session.py L93-L101 + transfer_backend.py L271-L278：有共享且无独有、无非 NPU 张量）→ processed layout 后处理 + `torch.npu.synchronize()` → `acquire_seed`，False 时抛 `_RForkSeedUnavailable`（L569-L620）。顺序正确。
- 第 8 步：先置 CLEANUP_REQUIRED，登记、要清单、读数据全成功才 TRANSFERRED，之后才 `_ensure_lease_release_retry_locked`（session.py L109-L148）。L103 正确。
- 第 10 步：非 TRANSFERRED 或非 processed layout 时重新登记；有未还租约返回 DEFERRED（session.py L302-L347）。L103、L151 正确。
- 回退：先 `prepare_for_fallback` 最多 2 轮（L657-L662），再无条件按 model_init_started 恢复快照（L664-L665），再检查 `can_schedule_seed`，不合格抛 RuntimeError（L667-L671），通过后 gc + 多次 empty_cache（L673-L680）、`get_model`，失败 exception + raise（L682-L696），会话在才发布（L698-L708）。L126–L151 的先后与分支都对；「传输出错后清理失败也会中止启动」已写在 L141，主图有「清不干净：报错终止」。
- 「没有可用 seed」三类：planner_client.py L77-L78（404 只 debug）、L80-L108（其余 warning，原文 `RFork planner seed acquisition failed: %s`）；session.py L66-L76（四种自拒，只有状态不对打 error）；L84-L89（借到打 info，带 global_rank）。L155–L163 正确。
- 示例 Planner 1 个名额、60 秒：examples/rfork/rfork_planner.py L39、L73-L74。正确。
- 报错表 9 行日志原文与源码逐字一致（L94-L108、L544-L560、L647-L655、L668-L671、L695；planner_client.py L108；session.py L75）。
- 版本差异：2c59ff10 与 db701c1f 的 rfork 目录 `git diff --stat` 为空（逐字节相同属实）；v0.23 有 layer_sharding 绕过、先 `is_seed_available()` 再 `initialize_model`、无 synchronize、无快照恢复；v0.26 去掉 layer_sharding；main 有 synchronize 与 `_reset_process_global_model_state`。均属实。
- GLM 段：32 个会话、TP 编号 0 在 0/8 号卡、默认日志 4 行、第 2 步不触发、第一次冷启动必然回退，与 01 §A0.8 一致，并在段首和页末待核 3 标为推演。

### P1（1 条）

1. **第 6 / 9 步的触发条件写成「量化 / 非量化」，与源码分支不符。** 位置：十步表 L97（「量化模型先对空参数做布局后处理」）、L100（「非量化模型到这一步才做后处理」），以及 L82「量化模型还已经转过布局」、L110「第 4、6 步白做一遍」、L147「量化模型的布局后处理」，对照源码「开销」节「量化模型还已转过布局」。源码：`_requires_processed_layout_transfer`（rfork_loader.py L503-L519）有三个条件，任一成立就走 processed layout：`quantization` 非空，或 `weight_nz_mode == 2`，或硬件策略 `FORCE_NZ`。第 6 步（L592-L608）和第 9 步（L631-L633）按这个布尔分支，不按是否量化。影响：weight_nz_mode=2 的 BF16 模型也会在第 6 步做后处理，第 9 步不再做；页面写法会让读者判断错，还和[张量布局](rfork-layout.md) L85「三个条件任一成立」直接矛盾。改法：第 6 步写「走处理后布局的模型（量化、weight_nz_mode=2 或硬件强制 NZ，三条件见张量布局）」，第 9 步写「走 checkpoint 布局的模型」；L82、L110、L147 和开销节同步改成这个口径（L110 可写「第 4 步，以及走处理后布局时的第 6 步」）。

### P2（2 条）

1. **回退的触发范围写成「③–⑧ 抛错」，漏了第 9 步。** 位置：报错表 `RFork transfer failed: …` 一行「第 3–8 步抛错，或第 8 步返回失败」；rfork-startup-fallback.yaml 顶框「⑦ 没借到，或 ③–⑧ 抛错」；主图图注「或 ③–⑧ 任何一步抛错」。源码：try 从 L563 一直包到 L644，checkpoint 布局的 `process_weights_after_loading`（L631-L633）和 `model.eval()`（L636）抛错同样落进 L652-L655 的 warning 并回退；第 10 步的异常由 `_start_rfork_seed_service` 自己接住（L92-L99），不回退。改法：三处统一改成「③–⑨ 抛错」（或「第 3–9 步抛错，第 10 步发布出错不回退」）。
2. **「租约」先用后讲。** 位置：第一屏加粗定义 L64 和直觉图都用了「申请租约」，到 L80 才解释「租约是 Planner 发给 B 的一次借用凭据」。同一句里 seed、Worker、Planner 都有括注，唯独租约没有。改法：L64 第一次出现时补一个括注，例如「租约（Planner 发的一次借用凭据，有名额和有效期）」。

### P3（建议）

1. 主图里 ④⑥ 用了虚线浅色框，图注没说是什么意思（应该是「没命中时白做的两步」）；图注补半句，或者去掉这个样式。
2. L171 草稿第 5 步不提前离开的原因：MTP 草稿自己那一层的权重本来就不在主模型的显存里，词嵌入和输出头只是另外两份。照底稿写不算错，但「所以」只归到词表张量，会让读者以为换掉词表就能整份复用。可以改成「草稿自己那一层本来就独有，加上……」。
3. 正文讲了「延期」，报错表可以补 warning `RFork seed promotion is deferred until the source seed lease is released; the transferred model remains available for inference.`（session.py L339-L343），以及 `RFork seed memory registration raised; …`（L327-L330）。
4. L155「一律报同一个原因」：`_RForkSeedUnavailable("planner returned no compatible seed")` 只是内部异常，不进日志。建议改成「内部一律当成没借到」，避免读者去日志里找这句。
5. L126 的回退三件事和[传输与内存](rfork-transfer.md) §「任何一步失败：先撤销，再回退」讲的是同一层；建议在这里加一个链接，指向内存登记那一层的细节。
6. 会话已 FINALIZED 时，`prepare_for_fallback` 直接返回三个 False（session.py L277-L279），结果是拒绝回退。情况少见，可以在对照源码一句带过。

### 跳过

- frontmatter 来源清单（sources 区）没读，由 audit 校验。
- 对照源码的「怎么开」节正文没读。「会报什么错」「版本差异」「源码位置」「开销」节只读到核对日志原文和版本说法所需的部分。
- 参考图库 refs\ 没看：本页不涉及通信原语、TP/DP/EP。
- 读取没有被拦过。

## P5 修订记录（2026-10-02，写手）

### P1：第 6 / 9 步的触发条件（已改）

- 核实：rfork@3284850b `rfork_loader.py` L503-L519 `_requires_processed_layout_transfer` 三条件任一为真：`quantization` 非空、`weight_nz_mode == 2`、硬件 `weight_layout_policy` 为 `FORCE_NZ`；第 6 步 L592-L608、第 9 步 L631-L633 都按这个布尔走。审查意见成立。
- 本页改法（口径跟 rfork-layout「先看 B 要不要转布局」一致，用「转好布局再搬 / 按原形状搬」两个名字）：
  - 第一次出现（「为什么」节代价段）就写全三条件；十步表第 6 步改「要转布局的模型」、第 9 步改「不转布局的模型」；表后新增一段：⑥⑨ 二选一、三条件、链接 [张量布局](rfork-layout.md#先看-b-要不要转布局)，并点明不量化但 NZ 模式 2 / 强制 NZ 也会在第 6 步做后处理。
  - 「第二层」段「量化后处理」→「布局后处理」；表后段第 10 步重新登记改用两条路的名字；三种情况表「第 4、6 步白做」→「第 4 步（要转布局时还有第 6 步）」；回退重来段「量化模型的布局后处理」→「布局后处理」（普通加载对所有模型都做）；GLM 段改为「W8A8 开了量化，三个条件的第一条就成立」；开销节改为「`_requires_processed_layout_transfer` 为真时」。
  - 对照源码「怎么开」新增一段：三条件原文 + 行号 + 两个 context manager 名字（[C2]）。版本差异新增：社区三版（2c59ff10 L219-L220、2ed6cbba L214-L215、baa023ad L330-L331）都只看 `quantization`，没有 NZ / 硬件两条；三条来源行号范围相应前扩。
  - 主图 ⑥ 框改「要转布局时：后处理，等 NPU 同步完」、⑨ 框改「不转布局时才后处理；进推理模式」，图注补三条件。
- 别页同样的简化（grep `量化模型 / 非量化` 于 rfork 章全部页）：
  - rfork（已达标）：L91、L93、L104、L290、L291、L341、L355 七处「量化模型…后处理」改为「要转布局的模型」（L91 首现写全三条件并链到张量布局）；L330 版本表行名「非量化模型的顺序」改为「不转布局时的顺序（社区版只按是否量化判断）」——社区三版确实只按量化判断，所以该行社区三列不动。L179「v0.23、v0.26 上的量化模型」讲的是社区版，口径正确，不改。
  - rfork-transfer（已达标）：L102 改为「要转布局的模型（三条件）」并链到张量布局对应节。L154「大致是不量化、也不强制昇腾 NZ 格式的模型」已含 NZ 两条，不改。
  - rfork-lifecycle（已达标）：L119「量化模型 / 非量化模型」改为「走转好布局再搬（三条件）/ 走按原形状搬」。
  - rfork-troubleshooting（在写）：grep 无同类说法（L76、L114、L125 讲的是指纹与类型，不是布局分支），无需报行号。rfork-identity、rfork-config、rfork-maintenance、rfork-official-guide 也无。

### P2（已改）

1. 回退触发范围：核实 try 从 L563 包到 L644，第 9 步后处理（L631-L633）与 `model.eval()`（L636）抛错落进 L652-L655；第 10 步异常被 `_start_rfork_seed_service`（L92-L99）接住。报错表、主图图注、回退图顶框统一改为「③–⑨」，报错表注明「第 10 步发布出错不回退」。
2. 租约先用后讲：第一屏加粗定义里首次出现处补括注「Planner 发的一次借用凭据，有名额和有效期」。

### P3（已改）

1. 主图图注补「④ ⑥ 画成虚线浅框，因为这时搭的还是空模型，没借到就白做」。
2. GLM 段第 5 步：改为先说草稿自己那一层 MTP 权重本来就独有，再说新建的词嵌入和输出头这两份也要传。
3. 报错表补三行：`RFork seed memory registration raised; …`（session.py L327-L330）、`RFork seed promotion is deferred …`（L341-L344）、`RFork cannot prepare a finalized session for fallback.`（L277-L279）。
4. 「一律报同一个原因」→「加载器内部一律当成同一种『没借到』处理」。
5. 回退三件事后加链接 [传输与内存](rfork-transfer.md#任何一步失败先撤销再回退)。
6. FINALIZED：并入报错表第三条新增行（清理三项都算失败，于是拒绝回退）。

### 验证

- `pnpm wiki:lint` 退出码 0（改完时）；`pnpm wiki:diagrams --check` 288 张一致；`pnpm wiki:audit` 退出码 0，名单 97 页全达标（含本次改过的 rfork、rfork-transfer、rfork-lifecycle）。
- 本页写作标准自测（scripts/wiki/standard.ts 口径）：5,094 字，行内代码 0、正文角标 0、对照源码、calc 0、相邻块 0、图先行、免责 0 / 0%、图宽，8 项全 ✓。对照源码区角标 23 处，C 18（78%）。
- 浏览器：改后再开 5193，页面整站报「知识库页面不合法」——原因是别的写手正在写的新页 concepts/request-teardown.md（未跟踪文件）frontmatter 第 78 行 YAML 解析失败、另缺 request-teardown-intuition.svg，不是本页。本次改动只动文字和两张图，图已用 Playwright 直接渲染 SVG 看过；整页浏览器复看等那一页修好后再做。

## P5 复审（10-02）

复审员：独立复审（Opus 5.5），只审未改页面。对照 rfork@3284850b（本仓 rfork/source）与 tools/repos/vllm-ascend 三个社区 commit。

### 结论

- 分数：9.0 / 10（上轮 7.5）。
- 上轮 P1：**已修好**。独立核源码：`_requires_processed_layout_transfer`（rfork_loader.py L503-L519）三条件为 `quantization` 非空 / `weight_nz_mode == 2`（非 bool）/ 硬件 `weight_layout_policy` 名为 `FORCE_NZ`，任一成立返回 True；第 6 步 `if processed_layout_transfer:`（L593-L608，含 `_rfork_pre_transfer_weight_processing` 与 `torch.npu.synchronize()`），第 9 步 `if not processed_layout_transfer:`（L631-L633，`_rfork_skip_unquantized_moe_post_load_processing`），`model.eval()`（L636）两条路都做。页面 L82（首现写全三条件）、十步表 L97/L100、表后 L103（二选一 + 链 rfork-layout + 点明 BF16 也可能走第 6 步）、L105、L112、L149、L174、对照源码 L195 均与源码一致，与 [张量布局](../../../../wiki/concepts/rfork-layout.md) L85-L88、L203 口径一致。
- 版本差异新增说法「社区三版只看 quantization」：`git show` 2c59ff10 L219-L220、2ed6cbba L214-L215、baa023ad L330-L331 三处函数体都只有 `return getattr(model_config, "quantization", None) is not None`，属实；与 rfork-layout L227-L228 一致。
- 上轮 P2：两条都已修。①「③–⑨」在报错表 L208、主图图注、回退图顶框三处统一；核源码 try 覆盖 L563-L644，第 8 步返回 False 在 L623-L624 转成 `RuntimeError`，第 10 步异常由 `_start_rfork_seed_service`（L91-L99）自己接住，「第 10 步发布出错不回退」属实。② L64 租约首现已有括注。
- 上轮 P3 六条均已处理；新增三行报错表核对：`registration raised`（session.py L327-L330，exception 后按 FAILED）、`promotion is deferred`（L341-L344，warning）、`cannot prepare a finalized session`（L277-L279，返回三个 False → can_schedule_seed 为 False → 加载器抛 RuntimeError）均属实。
- 三页连带改动：**正确，上下文未改坏**。rfork.md L91（首现写全三条件并链 rfork-layout）、L93、L104、L290-L291、L330（版本表行名改为「不转布局时的顺序（社区版只按是否量化判断）」，社区三列内容不受影响）、L341、L355；L179「v0.23、v0.26 上的量化模型」讲社区版，保留正确。rfork-transfer.md L102 已写三条件并链张量布局；rfork-lifecycle.md L119 两条路名字 + 三条件，与 session.py L321-L334（非 TRANSFERRED 或非 processed 时重新登记，失败 `_reset_transfer_locked` 后 FAILED）一致。
- 「出错 / 回退 / 报错」抽查 12 条全对：最多两轮（`FALLBACK_CLEANUP_MAX_ATTEMPTS = 2`，L59）；只看服务停与内存注销（types.py L47-L49）；清理不合格抛 RuntimeError（L667-L671）；`model_init_started` 在 `initialize_model` 之前置 True、构造半途抛错也清（L569-L570、L673-L681）；会话没建起来跳过清理且不发布（L657-L658、L698-L708）；回退普通加载失败 exception + raise（L694-L696）；回退后重新登记再发布（session.py L321）；租约未还时延期（L336-L345）；会话自拒四种只有状态不对打 error（session.py L66-L76，旧租约是先尝试同步归还、还不掉才拒）；Planner 404 只 debug、其余 warning（planner_client.py L77-L108）；借到租约 info 带 global_rank（session.py L84-L89）；「没有可用 seed」只在 summary rank 打 info（L647-L651）。新改动没有把推断写成定论。
- audit：`pnpm wiki:audit` 退出码 0（request-teardown 未报错），名单 97 页全达标；rfork（5848 字）、rfork-transfer（6439 字）、rfork-lifecycle（6508 字）写作标准 8 项全 ✓。本页不在名单，用 scratchpad\std-check.ts（checkStandard 口径）自测：5094 字，8 项全 ✓，无 problem。`pnpm wiki:lint` 通过，5 处待留意均与 rfork 无关。
- 浏览器：Playwright 1440 宽只读打开 5193 本页，整站已不再报「知识库页面不合法」，两张图渲染正常、控制台 0 错误，「③–⑨」「第 3–9 步」均在页面上。截图：本会话 scratchpad\rfork-startup-review2-first.png、-diagram1.png、-diagram2.png。

### 新 P1（0 条）

### 新 P2（0 条）

### P3（建议，不阻塞）

1. rfork-transfer.md L154 仍写「大致是不量化、也不强制昇腾 NZ 格式的模型」，是近似说法；可改成「三个条件都不成立的模型」并链到张量布局同一节，和 L102 统一。
2. 会话已 FINALIZED 时，加载器的两轮清理会各调一次 `prepare_for_fallback`，这行 error 实际会打两次；报错表 L214 可补半句，免得排错时以为是两次独立事件。

### 跳过

- frontmatter 来源清单（sources 区）没读，由 audit 校验。
- 对照源码「怎么开」除 L195 外、「开销」「源码位置」正文没读；L216、L218 只读到前 330 字。
- 参考图库 refs\ 没看：本页不涉及通信原语、TP/DP/EP。
- 读取没有被拦过。
