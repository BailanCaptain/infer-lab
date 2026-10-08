# recompute-cpu-offload 页审查记录

## P5 写作记录（2026-09-29，深改，第 15 批）

**改了什么。** 全页重写（正文约 1,900 字 → 约 15,100 字，按页面 body 长度计），按新讲法排序：问题式开篇 + 一句话定义 + 五个前置词各一句话加链接（抢占、PD 分离、连接器、RecomputeScheduler、KV cache CPU offload）+ 直觉图 → 为什么需要、四项代价 → 一次换出换回的六步（示意 A：9 个位置、一块 4 个位置、3 块、2 卡 TP）→ 存哪些块与主机预算（calc：不写预算时 8 GiB ÷ 8 卡 = 1 GiB、2,048 块，32,768 位置的请求 8,192 块装不下）→ 搬运与重算之间的成本（保留原锚点，recompute-scheduler 有入链；calc：256 / 4,096 / 32,768 个位置三档，存+取 vs 重算）→ 与 KV cache CPU offload、KV Pool 的对照表（对象、粒度、何时存、谁能用、恢复条件、搬运方式）+ 被抢占请求之间共用主机块的三个条件 → GLM 双机（主线不启用；calc 对照默认预算约 128 个块号 vs 主线被抢占那条 120–121 个块号）→ 常见误解 6 条 → 对照源码五个 H3。frontmatter：标题、summary（169 字）、aliases、sources（26 条，全部重核行号）、verified 三个钉点、relations 加 kv-cache-cpu-offload / kv-pool 两条 alternative-to、updated。

**直觉图。** `wiki/diagrams/recompute-cpu-offload.yaml` 重画（900×500，原为一条抽象时间线）：左框「抢占那一刻」显存 A A A + 空、主机全空、「问连接器：存得走吗？」；上排「能存：先拷到主机，再让块」（显存 C C C，主机 A A A）→「A 排回来：搬回，接着算」（主机 A 淡色、三支箭头搬回到新块号，显存 C A A A）；下排「存不下：块直接还掉」（显存 C C C，主机空）→「A 排回来：从头重算」（三格「算」）。同一次抢占、两条恢复路径，块在显存与主机之间怎么走一眼可见。用 sharp 转 PNG 自查过排版（行标签、箭头、标题不重叠）。

**本批验收要点。**
- 缓存池与换出区分对象、粒度和恢复条件：见「和 KV cache CPU offload、KV Pool 有什么不同？」对照表 + 「最容易混的是恢复条件」一段（被抢占请求只靠池/备份时生成部分查不到）。
- 吞吐和时延缺证据处明列待核：GLM 一节「停多久」「混合状态能不能存对」两条待核；成本一节的时间全部标示意，有效带宽写明要实测；1P1D 块池与抢占触发长度写明「还没有算过」。

**数字取自哪。**
- GLM 主线抢占代价（32 条 × 约 67,000 位置、被抢占那条每卡 120–121 块 ≈ 956–964 MiB、本机重算约 9 步、KDA 状态随块丢）：docs/mainline/01-deploy-entry-schedule.md §B3「在我们部署下的具体数字」，页面只链接 concurrent-requests.md 的 KV 块一节，不重算。
- 一个块号每卡 8,355,840 B ≈ 7.969 MiB、KDA 每组 4 块（1 状态 + 3 草稿）：02-forward.md §1.4 与部署页「占住一个块号」「为什么短请求也占 15 个块」，链接不重算。
- 默认预算 1 GiB/卡 ÷ 7.969 MiB ≈ 128 个块号：按源码公式 `num_gpu_blocks × 预算 // 显存 KV 总字节`（= 预算 ÷ 每块字节）与 world_size = TP8 推出，页面标「对照，不是效果」。
- 基础节全部示意数：每位置 128 KiB、16 GiB/s、16,384 位置/s 沿用 kv-cache-cpu-offload（其又沿用 kv-cache 示意模型），一块 4 个位置沿用旧版 ceil(9/4)=3 例。
- 01 §B3 待核 2（vllm-ascend 是否有「抢占改为换出」路径、默认是否启用）本页已回答：有，只在 PD 分离 D 节点配 RecomputeScheduler 时可用，默认不启用，GLM 主线不启用。

**核了哪些源码（钉点）。**
- 岔路口与日志：vllm-ascend@db701c1f `core/recompute_scheduler.py` L297-L345（钩子返回真打 info「offload enabled」，假打 info「falls back without offload」）；本步跳过 None：同文件 L439-L476、L520。
- 连接器：db701c1f `recompute_cpu_offload_connector.py` L40（默认 8 GiB）、L54-L70（per_rank 优先、不一致打 warning；enable_offload_prefix_caching 默认 False，非 bool 报 ValueError）、L83-L96。
- manager：L63-L118（构造参数默认 True 但连接器显式传入；DCP/PCP 断言；_expected_worker_count = world_size）；L133-L156（主机块数公式）；L158-L172（滑窗补 0 对齐）；L179-L200（None/命中数；命中时第二项是 True，走异步状态，见文末修订记录）；L202-L220（回填准备失败 RuntimeError）；L222-L234（已存过直接返回 True）；L236-L368（已算 0 返回 False、全有或全无、共用需块写满 + 开关 + 显存块有哈希、_pending_hash_blocks 同步共用）；L517-L553（累加到 world_size 才 ready、登记共用块）；L578-L589（未 ready 时结束，等存完再回收）。
- worker：L96-L116（按块数开 pin_memory CPU 张量）；L134-L151（handle_preemptions 同步存，注释写明同一步复用块号）；L153-L175（start_load_kv 同步取、wait_for_layer_load）；L200-L284（torch.npu.synchronize、逐块逐张量 copy_ non_blocking、TODO、sync 时 event.synchronize）。
- 调用点：db701c1f `worker/model_runner_v1.py` L1984-L1989（在 _update_states 前）。
- MultiConnector：db701c1f `distributed/kv_transfer/ascend_multi_connector.py` L65-L77（逐个转问子连接器，任一为真即真）；`__init__.py` L23-L26（注册替换）、L84-L86（注册名）。
- 上游：vllm@0fc695fc `config/parallel.py` L776-L780（world_size = PP × TP × PCP，不含 DP）；`v1/core/kv_cache_manager.py` L422、L553-L562（只有 enable_caching 时显存块才算哈希）。
- 版本：2c59ff10 与 db701c1f 的 manager / worker / connector 逐字相同（diff 无输出）；2ed6cbba 的 worker / connector 与 db701c1f 相同，manager 只在 Mamba 组处理（L266-L280，只存最后 1+num_spec_tokens 块）和删掉 _maybe_evict_cached_block 循环上不同；baa023ad 改名 preempt_offload（9eb752ab #16510，是 main 祖先、不在两个发布分支）、`preempt_offload_connector.py` L45-L63（offload_host_memory_ratio 默认 1）、`manager.py` L282-L295、`core/recompute_scheduler.py` L105-L130（try/except 退回 P）、`worker/v2/model_runner.py` L325 与 v1 L2238 都调 handle_preemptions、`kv_transfer/__init__.py` L118-L123（只注册 PreemptOffload 名）；worker 仍 synchronize + 逐块 copy_ + TODO。
- GLM 模型代码只在 db701c1f（models/glm5_next*.py）与 baa023ad（models/glm5next/），2c59ff10、2ed6cbba 没有。
- 官方文档：db701c1f `docs/source/user_guide/feature_guide/recompute_cpu_offload.md` L40-L61（参数；「按 DP 数平分、DP2TP8 写 16 GiB 得每卡约 8 GiB」与代码不一致，代码是 ÷8 = 2 GiB，页面标 [!]）、L226-L274（流程、滑窗与 MTP、限制：只求正确、Qwen3.5 异步未完全支持、共用实验性默认关）、L276-L307（问答：日志三条、与 KV Cache CPU Offload 不同）。

**旧版信息清单勾选。** 清单存 scratchpad `p5/recompute-cpu-offload-facts.md`（p4-checkpoint 版 17 条 F + P4 重写前 0f97c8b 版 13 条 G + 本轮新增 7 条 N）。
- F1–F7、F13、F14、F17 全部在新版（开篇、代价、六步、成本一节）。
- F8、F9：保留 ceil(9/4)=3 与「整块拷、不使空格变已算」；字节改成本页统一示意模型（一块 512 KiB，3 块 1.5 MiB，存取各一趟），旧版「每页 2 MiB」与 128 KiB/位置 × 4 位置不自洽，弃用。
- F10：按组存 + 递推状态不能按位置数，细化成 v0.26/main 与 v0.23/GLM 快照的差别，GLM 快照是否存对标待核。
- F11：「构造默认 true」是误导（连接器读配置默认 False、官方默认关），新版改为实际默认关，并在「怎么开」说明构造默认值与实际默认值的关系。
- F12：A、B 共用 6 → 4 块保留，补全三个条件（开关、显存侧 prefix caching、块写满）。
- F15、F16：GLM 一节与版本差异表。
- G1、G3–G13：全部在新版（怎么开 / 会报什么错 / 开销 / 版本差异 / 源码位置、常见误解）。
- G2（Qwen3.6-35B-A3B 32K 算例）删去：本站主线已换成 GLM 双机，这个模型形状不再是底稿，数字无从对照；「长请求更划算」的结论改由成本一节三档示意数和 GLM 对照 calc 承担。
- N1–N7 均写入。

**参照。** 看了参考图库 scratchpad/refs/ 的 INDEX.md（只有通信原语与 TP/DP/EP 两份，没有抢占或换出的资料）；借了 xzclass 那种「前 → 后」分格画每一站手里有什么的画法，用我们的格子图元画成两条路径的四格。

**留下的待核。**
1. 主机与 NPU 之间的有效带宽、逐块 copy_ 的实际吞吐：决定 D 每次停多久、持平点落在哪。
2. GLM 快照（= v0.23 代码）对 KDA 三组按「已算位置 ÷ 块大小」截取块表，存下的是否是完整当前状态；main 上 GLM + PreemptOffload 能否走通。
3. 1P1D 拆分下 D 的块池大小与抢占触发长度（与 recompute-scheduler 待核 1 同源）。
4. GLM 主线是否开异步调度、与本连接器同开是否有官方所说 Qwen3.5 那类问题，未核。

**验证。** pnpm wiki:lint 通过，本页 0 报错；证据标记 30 处（上限 30）。pnpm wiki:diagrams --check：257 张与 spec 一致。pnpm wiki:audit 通过，本页 26 条来源行号全部有效。另用 standard.ts 的 auditStandard 把本页临时加进名单单独跑（不改 standard-pages.json）：行内代码 0/千字、角标 0、对照源码五节、calc 0.62/千字、相邻块 0、图先行、免责 2.3%、图宽，全部达标。

**附带说明。** 第一次跑 pnpm wiki:diagrams（写盘）时，顺带按别的写手未跟踪的 `context-parallel-intuition.yaml` 生成了同名 svg；内容由那份 yaml 决定，未改动 yaml，也未再碰该文件。

## P5 审查（09-29）

审查员：独立审查（Opus 5.5，未开子代理）。只审不改页面。

**分数：6.5 / 10**（P1 2 条、P2 1 条、P3 3 条）。

**初学者测试（只读前两屏）。** D 节点上被抢占的请求，先把已算好的 KV 块拷到主机内存，排回来再搬回显存接着算，省掉一次重算；代价是主机内存预先占着、两趟同步搬运让 D 整步停住，主机存不下整条时照样退回重算。——能说清。

**学习顺序：通过。** 是什么（一句话 + 五个前置词 + A 的例子 + 直觉图）→ 为什么需要 / 代价 → 六步怎么做 → 存哪些块、成本、对照 → GLM 双机 → 常见误解 → 对照源码；基础节只用示意数，GLM 数字只在 GLM 一节。

**机械项。**
- `pnpm wiki:audit`：本页 26 条来源全部有效，本页通过；整体失败 1 处是 concepts/lmcache.md 的 diagram-identifier，与本页无关。
- `pnpm wiki:lint`：本页 0 报错；整体失败同上 1 处（lmcache）。
- `pnpm wiki:diagrams --check`：257 张与 spec 一致；recompute-cpu-offload 与 context-parallel-intuition 均无告警。context-parallel-intuition.yaml / .svg 仍是未跟踪文件，mtime 11:43:50 / 11:43:55，svg 与 yaml 一致，没被改坏。
- 对照源码五个 H3 齐全、顺序对；版本差异含 v0.23 / v0.26 / main，并单列 GLM 快照 db701c1f。对照源码之上：行内代码 0、角标 0；每节 calc ≤1；表格与 calc 不相邻；无分镜、无 meta 文本。
- 入链：全库只有 recompute-scheduler.md L106 指向本页 `#搬运与重算之间的成本`，标题保留，能解析。
- 浏览器（Playwright 1440 宽，用户的 5193 预览）：第一屏 scratchpad\recompute-cpu-offload-review-1.png，直觉图 scratchpad\recompute-cpu-offload-review-fig1.png；页面正常渲染，控制台 502 来自问答后端未连，与本页无关。

**核心机制对照（vllm-ascend db701c1f，另核 2c59ff10 / 2ed6cbba / baa023ad）。**
- 默认 8 GiB、per_rank 优先且不一致打 warning、共用开关默认 False 且非布尔报 ValueError：connector L39-L70 ✓。
- world_size = PP × TP × PCP，不含 DP：vllm@0fc695fc config/parallel.py L776-L781 ✓；官方文档 L40-L61 写「按 Decode DP 数」，与代码不一致，页面常见误解处理正确。
- 主机块数 = 显存块数 × 预算 ÷ 显存 KV 总字节（= 每卡预算 ÷ 每块字节）：manager L133-L156 ✓。
- 已算 0 不存、需要块数 > 空闲块数则 warning 后整条不存：manager L243、L296-L306 ✓。
- 存在 `_update_states` 之前同步做、`torch.npu.synchronize` + 逐块逐张量 copy_ + TODO、两方向 sync=True：worker L134-L175、L200-L284 ✓。
- 抢占岔路口、两条 info 日志、存得走则 `_preempt_request` 排回队首：recompute_scheduler L297-L345 ✓。
- 未集齐返回 None、调度器本步跳过：manager L179-L186、recompute_scheduler L518-L523 ✓。
- 2c59ff10 与 db701c1f 连接器目录 diff 为空；2ed6cbba 只有 manager 不同，Mamba 组只存最后 1 + num_spec_tokens 块（2ed6cbba manager L270-L278）✓；main 不写预算时 offload_host_memory_ratio 默认 1（baa023ad connector L45-L63）✓。
- **取回的时机讲错了**，见 P1-1。

**数字手算。**
- 成本 calc（L141-L150）：256 位置 → 32 MiB，2 × 32 MiB ÷ 16 GiB/s = 3.906 ms，256 ÷ 16,384 = 15.625 ms；4,096 → 512 MiB，1 GiB ÷ 16 GiB/s = 62.5 ms，对 250 ms；32,768 → 4 GiB，8 GiB ÷ 16 = 500 ms，对 2,000 ms；两趟的持平带宽 2 × 128 KiB × 16,384/s = 4 GiB/s。全部正确，量级合理（128 KiB/位置 = 8 KV 头 × 128 维 × 2 × 2 B × 32 层；16 GiB/s 有效 H2D、每秒 prefill 16,384 位置都属常见量级），标了示意，与 kv-cache-cpu-offload L77-L85 的示意数同源。三档比例恒为 1:4，页面按固定开销（短）、D 停顿与主机容量（长）区分长度，结论方向合理。
- GLM 对照 calc（L197-L204）：8,355,840 B = 7.969 MiB；1,024 ÷ 7.969 = 128.5 → 128 块号；120–121 × 7.969 = 956–964 MiB；与 concurrent-requests L243-L258、01 §B3 一致；标「对照，不是效果」，1P1D 块池写明未算，没有虚构部署实测数 ✓。
- 预算 calc（L112-L120）：算术对，但口径错，见 P1-2。

**旧版信息对照。** p4-checkpoint 六个 H2 的内容都在新版（F1–F17 勾选属实）；F11「构造默认 true」改为实际默认关，核源码属实；G2 Qwen 算例删去理由成立。**但写手信息清单 N6「get_num_new_matched_tokens 第二个返回值 False」与源码不符**，见 P1-1。

### P1

**P1-1 取回不是「排上那一步就接着算」，A 要多挂一步。**
- 位置：L98（「A 这一步就从第 10 个位置接着算」）、L100（「取回不是后台进行的……不用先挂起一步」）、L136（「排上那一步就能接着算」）、L260（「返回 `(命中数, False)`……不走异步加载」）。
- 问题：manager 命中时返回 `(hit_length, True)`（db701c1f manager L200；2c59ff10 L200；2ed6cbba L216；baa023ad L232），第二项是 load_kv_async = True。RecomputeScheduler 据此给 A 分块后把它置为 WAITING_FOR_REMOTE_KVS、本步新 token 数为 0、跳过（recompute_scheduler L552-L556、L658-L672）；worker 在这一步前向前同步把块搬回（start_load_kv sync=True），再由 get_finished 报 finished_recving（worker L285-L300）；下一步 `_update_waiting_for_remote_kv`（L138-L170）才把 A 放回等待队列并调度。也就是：排上那一步只搬不算（且整步被同步拷贝卡住），下一步起 A 才从第 10 个位置接着算。和 KV cache CPU offload 的差别在于搬运是否同步，而不是「要不要挂起一步」。
- 改法：第 6 步拆成「排上这一步：分 3 块、前向前同步搬回，A 本步不算、同一步其他请求等拷贝」+「下一步：A 从第 10 个位置接着算」；L100 改成两者都挂起一步，区别是这里同步搬、整步停；L136 相应改；L260 改成返回 `(命中数, True)`，走的是 WAITING_FOR_REMOTE_KVS 那条异步状态，但 worker 的拷贝本身同步；同步修正写作记录与 facts 的 N6。

**P1-2 预算 calc 用「÷ 8 张卡」配「每卡每位置 128 KiB」，口径不自洽，结论「32,768 位置装不下」不成立。**
- 位置：L110-L120 的 calc、L156「一条就要 8,192 块……2,048 块根本装不下，只能退回 P」。
- 问题：128 KiB/位置是 kv-cache 页示意模型（8 个 KV 头、32 层）的**整模型**字节。实例有 8 张卡时（TP/PP/PCP 任一种切法），每卡只存这份的一部分（如 TP8 每卡 1 个 KV 头 = 16 KiB/位置）；而成本一节和 kv-cache-cpu-offload 用的都是单卡口径。无论按单卡（8 GiB ÷ 1 = 8 GiB → 16,384 块 → 65,536 位置）还是按 TP8（1 GiB ÷ 64 KiB = 16,384 块 → 65,536 位置），默认 8 GiB 都存得下一条 32,768 位置的请求（整实例 4 GiB）。只有 KV 在每张卡上各存一整份（如 GLM 的 MLA 在 TP 下复制，GLM calc 正是这样算的）时，原 calc 才成立，但示意模型不是这种。
- 改法：统一成单卡口径（world_size = 1，每卡 8 GiB → 16,384 块 → 65,536 位置；32,768 位置 8,192 块装得下，同时被抢占两条就满），或保留 8 卡但把每卡每位置字节改成 128 KiB ÷ 8；并改 L156 的长请求结论（例如「装得下一两条，同时被抢占几条就装不下」）。可顺带一句「每卡存的是这张卡自己那份，MLA 在 TP 下是整份复制」，为 GLM 一节做铺垫。

### P2

**P2-1 直觉图下排「从头重算」画成在同一个 D 的池子里本机重算。**
- 位置：wiki/diagrams/recompute-cpu-offload.yaml 下排两格（截图 fig1 下半）。
- 问题：本连接器只在开了 RecomputeScheduler 的 D 上起作用，这时存不下的一路是结束 A、交给 P 重算（L66 正文自己也这么说），不是在 D 的池子里「9 个位置从头再算一遍」。图与正文、与 recompute-scheduler 页的主结论相反，初学者先看图会记错。另外 ③ 两格里 C 从 3 块变成 1 块，没有交代（C 结束让出两块？），会让人以为池子凭空变大。
- 改法：下排 ③ 改成「A 结束，退回 P 重算整段」（D 这一侧只画块已还掉，P 侧画「算」）；或在格注写明「开了 RecomputeScheduler 的 D：交给 P 重算」。③ 里的 C 给一句格注（如「C 已结束，还了 2 块」），或把池子画成 6 格。

### P3

- P3-1 重复：「两趟同步、整步停住、同一步请求都等」出现在 L72、L81、L100、L132、L136、L156、L175、L218 共 8 处，建议成本一节的粗体句和 L136 各删半句。
- P3-2 术语先用后讲：L110 首次出现 PP、PCP 无解释或链接；L182 首次出现 prefix caching 无链接（建议链 prefix-caching.md）；L154「代理重投」可链 recompute-scheduler 对应节。
- P3-3 成本三档比例恒为 1:4，建议在「按长度读这组数」前加一句「线性估算下比例不随长度变，长短的差别来自固定开销和 D 停顿、主机容量」，免得读者以为比例在变。

**跳过的内容。** frontmatter sources 区（由 audit 校验）；「对照源码」正文只 grep 核对了 H3 与版本词，L241、L260 两行因核 P1 单独读过；代码块未读。

## P5 修订记录（09-29）

按「P5 审查（09-29）」逐条处理：P1 2 条、P2 1 条、P3 3 条全部改了，没有驳回的。

**P1-1 取回要晚一步才接着算：审查属实，已改。**
- 核实（db701c1f）：manager L200 命中时 `return hit_length, True`；recompute_scheduler L552-L556 `load_kv_async` 时本步新 token 数为 0，L658-L672 分块后置 `WAITING_FOR_REMOTE_KVS` 放进本步跳过队列；worker L153-L165 在本步前向前 `sync=True` 拷回，L286-L305 `get_finished` 报 `finished_recving`；下一步 L452-L462 遍历跳过队列时经 `_update_waiting_for_remote_kv`（L138-L170：已算取 min，等于总长则减 1，MTP 被抢占过的补占位草稿）放回再排。我原先把第二个返回值读成 False，是读错。
- 改动：开篇上排说明改成「排上那一步先搬回，下一步才接着算」；六步拆成七步（第 6 步「分块、搬回，A 这一步不算」，同一步其他请求等这笔拷贝；第 7 步「下一步接着算」，含收满退 1 格的规则并链到 RecomputeScheduler）；与 KV cache CPU offload 的对照改成「两边都挂起，区别在同步还是后台搬」；成本一节「这条请求自己恢复得快：排上那一步搬回，下一步就接着算」；对照表「搬运」行补「请求挂起一步」；对照源码「同步取」改成返回 `(命中数, True)`、走 `WAITING_FOR_REMOTE_KVS`，状态异步、拷贝同步；summary 与首段同步改。sources 追加 recompute_scheduler L548-L672、L138-L170 与 worker L286-L305 三条，源码位置表加一行。直觉图右上格改为「池子空出来：A 排上、搬回」+「排上那一步：分 3 个空块、搬回 / 下一步才从第 10 个位置接着算」。页面没有时间格子图。facts 清单 N6 与写作记录里那句同步改正。

**P1-2 预算 calc 口径不一致：审查属实，已改。**
- 手算：128 KiB/位置是 kv-cache 示意模型单卡跑整模型的量（8 KV 头 × 128 维 × K、V 2 份 × 2 B × 32 层 = 131,072 B）；原 calc 用「8 GiB ÷ 8 张卡」却没把每卡字节同步缩到 1/8。
- 改动：统一成单卡口径——每卡预算 8 GiB ÷ 1 = 8 GiB；每块 4 × 128 KiB = 512 KiB；主机块数 8 GiB ÷ 512 KiB = 16,384 块；能存 16,384 × 4 = 65,536 个位置；32,768 个位置的请求要 8,192 块；同时存得下 16,384 ÷ 8,192 = 2 条，第三条同时被抢占的整条不存。旁注写明 TP8 时每卡 1 GiB、每块 4 × 16 KiB = 64 KiB，1 GiB ÷ 64 KiB = 16,384 块，结论相同。calc 前加一段「算预算要注意口径：每张卡只存自己那份；TP 按 KV 头切时每卡字节和每卡预算一起缩小；MLA 这类 TP 下每卡整份复制的不缩小」，给 GLM 一节（每卡 8,355,840 B/块号、1 GiB/卡，口径本来就一致）做铺垫。成本一节「长」那条改成「单卡不写预算时 16,384 块，同时只存得下两条，第三条只能退回 P」。

**P2-1 直觉图下排画成本机重算、右上 C 凭空变少：已改。**
- 下排改成「② 存不下：还块，A 结束」（格注「3 块还给池子，A 交给 P」）→「③ P 节点：整段重算」（一行「P」三格「算」，格注「P 重算这 9 个位置，再交给 D」）。
- 右上不再画 C：标题写「池子空出来」，显存格为「空、A、A、A」，块号与原来不同。左栏删去「第 3 块只用了 1 格」一句（正文有），图上文字仍为 8 段。
- 开篇「下面：重算」一条改为先讲交给 P、注明「图里画的就是这条」，再讲不拆 P/D 时本机重算。caption 同步改。sharp 转 PNG 自查过排版。

**P3。**
- P3-1 重复：成本一节粗体句删去「两趟都同步」半句，改「每趟都停住 D 上的一步」；「换出换回」那条删去「同一步的所有请求都跟着等」；「长」那条删去同义半句。
- P3-2 术语：PP、PCP 首现处写明是三种并行份数相乘并链 tensor-parallel / pipeline-parallel / context-parallel；prefix caching 首现链 prefix-caching；「代理重投」链 recompute-scheduler 的「一次『退回 P』怎样走完」；新出现的 MLA 链 mla。
- P3-3：「按长度读这组数」前加一句「线性估算下两边比例始终 1 比 4，长短差别来自固定开销、D 停顿时长和主机容量」。

**验证。**
- pnpm wiki:lint：通过，本页 0 报错（证据标记 30 处，删去「确认生效」一处 [C16] 以容纳新增的 [C5]）。
- pnpm wiki:diagrams --check：本次整体失败 3 处，全在别的写手正在改的 mooncake-connector-hooks.yaml（框里放不下、压字），与本页无关；本页的图用 renderDiagram 单独比对，svg 与 spec 一致，figureProblems / figureAdvisories 均为空。
- pnpm wiki:audit：通过，本页 29 条来源行号全部有效。
- 写作标准（auditStandard 临时把本页加进名单单跑）：行内代码 0、角标 0、对照源码五节、calc 0.57/千字、相邻块 0、图先行、免责 2.2%、图宽，全部达标。

## P5 复审（09-29）

复审员：独立复审（Opus 5.5，未开子代理）。只审不改页面；范围限于上一轮 P1/P2 与本轮删改，不重审整页。

**分数：8.5 / 10**（上一轮 6.5）。两条 P1、一条 P2 均已改对；新增 P1 0 条、P2 0 条、P3 3 条。

**P1-1 取回时序：已修好。**
- 源码核实（行号均为 db701c1f，另核 2c59ff10 / 2ed6cbba / baa023ad）：manager `get_num_new_matched_tokens` 命中返回 `(hit_length, True)`（L200；其他三版 L200 / L216 / L232）；未集齐返回 `(None, False)`（L183-L184），调度器 L520-L526 放进本步跳过队列 ✓。调度器 L552-L555 `load_kv_async` 时本步新 token 数为 0；L619-L649 分块并调 `update_state_after_alloc`；L658-L662 置 `WAITING_FOR_REMOTE_KVS` 进跳过队列（其他两个发布分支同一结构，main 在 L590 / L698）。worker `start_load_kv` L153-L165 `sync=True`，`get_finished` L286-L304 报 `finished_recving`；manager `update_connector_output` L517-L520 收到后释放主机块。下一步 L452 走上游 `_try_promote_blocked_waiting_request`（vllm@0fc695fc scheduler.py L2188-L2203）：调 `_update_waiting_for_remote_kv`（ascend L138-L170，取 min、等于总长减 1、MTP 补占位草稿），被抢占过的置 PREEMPTED 并在同一轮调度里继续排——即「排上那一步只搬不算，下一步接着算」。
- MultiConnector 路径：`AscendMultiConnector.get_num_new_matched_tokens`（L43-L63）让持有抢占状态的子连接器优先，原样透传 `load_async=True`；上游 MultiConnector（vllm@0fc695fc L381-L400）同样透传 ✓。
- 页面各处现在一致：开篇上排说明、第 6/7 步、与 KV cache CPU offload 的对照段、成本一节「换出换回」条、对照表「搬运」行、「开销」一节同步取条、源码位置表新增行、summary。直觉图（本页只有这一张，不是时间格子图；sharp 转 PNG 看过：scratchpad\rco-rereview-fig.png）右上格文字为「排上那一步：分 3 个空块、搬回 / 下一步才从第 10 个位置接着算」，与源码一致。与 kv-cache-cpu-offload「搬运在后台进行」一节、recompute-scheduler L145/L152 不矛盾。

**P1-2 预算口径：已修好。** 逐项手算：8 GiB ÷ 1 = 8 GiB；4 × 128 KiB = 512 KiB；8 GiB ÷ 512 KiB = 16,384 块；× 4 = 65,536 位置；32,768 ÷ 4 = 8,192 块；16,384 ÷ 8,192 = 2 条 ✓。旁注 TP8：128 KiB ÷ 8 KV 头 = 16 KiB/位置（kv-cache 页 L149-L150 示意模型是 8 个 KV 头 × 128 维 × 2 × 2 B × 32 层）、每块 64 KiB、1 GiB ÷ 64 KiB = 16,384 块 ✓。calc 前一段把「每卡只存自己那份、TP 按头切时两边一起缩、MLA 复制时不缩」讲清；实现公式（`num_gpu_blocks × 预算 // 本卡显存 KV 总字节`）本身就是本卡口径，页面口径与之一致。成本一节「长」条改为「单卡 16,384 块、同时存两条、第三条退回 P」，与 calc 前后自洽；成本 calc 与持平带宽 4 GiB/s 同为单卡口径；GLM 对照 calc（1 GiB/卡、8,355,840 B/块号、≈128 块号 ≥ 120–121）口径本来一致，且有上面一段铺垫。

**P2-1 直觉图：已改对。** 下排为「② 存不下：还块，A 结束」→「③ P 节点：整段重算」，与开篇下排说明、recompute-scheduler 主结论一致；右上格不再画 C，显存为「空、A、A、A」，不再有块数凭空变化。开篇下排说明补了「不拆 P/D 时本机重算」。

**P3 修订：** 三条都落实（成本一节去重、PP/PCP/prefix caching/代理重投/MLA 首现有链接、1 比 4 的说明句已加）。

**旧版信息清单与删改。**
- 清单文件存在，但不在派发说明写的本会话 scratchpad，而在写手会话目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p5\recompute-cpu-offload-facts.md`（56 行，F1–F17、G1–G13、N1–N7；N6 已按上轮 P1-1 改正）。
- 抽 6 条到新版核对，全部在：F6（同一步块号可能再分给别人、worker 先拷完）第 3 步；F12（不共用 6 块、共用 4 块）共用一段；G9（Docker `--shm-size=1024g`）怎么开；G12（v0.23 摘掉没写进去的前缀缓存块）版本差异表；N4（AscendMultiConnector 转问）怎么开；G8（Qwen3.5 + 异步调度限制）会报什么错。
- 本轮删改：页面与图均未提交，工作区里也没有修订前的 P5 版快照，无法单独 diff 出「本轮」；按修订记录逐项对照删去的内容：图左栏「第 3 块只用了 1 格」正文开篇例子和「要存几块」段仍在；P3-1 删去的半句（同一步其他请求都等）在代价第二条和常见误解第四条仍在；「确认生效」一行删去了 [C16] 标记，三条日志在 db701c1f 均为 `logger.info`（recompute_scheduler L318-L319、manager L356-L357、L464-L465），结论本身没丢，只是少了一个证据标记。未发现丢信息。

**机械项。**
- `pnpm wiki:audit`：exit 0，「审计 133 页，来源 3113 条……写作标准名单 71 页达标 71 页」；本页 29 条来源，28 条行号有效、1 条 PR URL 未联网（与其他页同规则），本页通过。
- `pnpm wiki:lint`（顺带跑）：整体失败 2 处，都是别的写手在改的 lm-head-intuition.yaml、sampling-intuition.yaml 缺 svg；本页 0 报错，新增跨页锚点（recompute-scheduler「本调度器在上游之上改了哪几处」「一次退回 P 怎样走完」）能解析。
- 未起服务，未在浏览器里开页；图的核对用 sharp 渲染 svg。

### P3（新增，可不改）
- P3-1 异步调度时的「下一步」：`finished_recving` 要在上一步的 `update_from_output` 里登记，开了异步调度（batch queue）时下一步的调度先于这次登记，A 实际要再晚一步才接着算。页面「下一步」在同步调度下成立；若想严谨，第 7 步可补半句「开了异步调度还会再晚一步」。
- P3-2 「存哪些块」一节的「A 的 3 块是 1.5 MiB」紧跟在上一节「2 张卡做 TP」的例子后面，按整个实例算是对的，但初学者可能当成每卡；可写成「整个实例」或「单卡时」。
- P3-3 写手清单「勾选结果」仍写「六步」，页面已是七步（清单是 scratch 文件，不影响页面）。
