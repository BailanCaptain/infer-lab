# request-teardown 审查记录

## P5 写作记录（2026-10-02，第 26 批，新页）

**改了什么。** 新建 `wiki/concepts/request-teardown.md`（新页无旧版，改前 0 字；改后写作标准口径正文 6,349 字，audit 口径含源码区 15,481 字，9 个 H2）与两张图 `request-teardown-intuition.yaml/svg`、`request-teardown-flow.yaml/svg`。挂靠主线 A7（第 7 站）与 B3，chapters 记 09、order 80（排在 streaming-output 的 70 之后）。没有改动任何别的页。

**结构（按 basics-standard 学习顺序）。** 是什么（直觉图 + 请求 A 的示意：前端记录与输出槽、引擎登记与 running 位置与块 9/2/5 引用、worker 批次表一行）→ 为什么与代价（D 要 6 块的示意、断开不通知白算 180 个 token；代价三处；收尾 / 抢占 / 清空前缀缓存 / MTP 回退四行对照表）→ 怎么做（流程图 + 四个 H3：引擎先判停、前端先发现、中止晚到重复到、出错）→ 还块（唯一 calc：块 5、2 计数 1→0 排队尾，块 9 2→1 留给 B，空闲 4+2=6；倒着还的理由；还块 ≠ 抹登记；清空前缀缓存的前提与开发模式接口；connector 推后还块）→ worker 与 DP 的最后两步 → 抢占不是收尾 → 异步调度下多排一步 → GLM 双机 → 常见误解 7 条 → 对照源码五个 H3。基础节只用示意数，GLM 数字只出现在 GLM 一节之后。

**直觉图。** 三个横框（前端 / 引擎 / worker）× 左右两列（A 停下之前 / 之后），徽标 ①②③ 标先后：引擎同一步移出队列、倒着还块、删登记（块 5、块 2 计数→0 排回队尾，块 9 计数 2→1 留给 B，空闲队列 3、4、6、7 → 3、4、6、7、5、2）；前端删记录、输出槽交出最后一份后关；worker 下一份清单到了才删 A 行。说明写明停止字符串与断开时 ① ② 对调。流程图：⑦ API server（停止字符串 / 断开 / 收到结束原因三入口 → 删记录放最后一份 → 引擎没停才发中止）→ ⑥ EngineCore（判停或出错；收到中止 → ID 还在且没结束？→ 释放；有 connector 时推后）→ 发回结果、下一份清单 → ③ worker 删缓存状态和批次行。两图 900 / 880 宽，`wiki:diagrams` 无报错、无提示。

**数字出处。** 只链接、不重算：R1 收尾 16–17 块与各组构成、max_tokens=200 最后一圈只发 3 个：01 §A7「具体数字」与 one-request 第 7 站；尾状态组插队头：vllm-kv-block-allocation「结束：16–17 块一次还清」；prefix caching 关：01 §A2.3 与 prefix-caching；抢占一次还 120 块左右、约 67,000 位置重算：01 §B3 与 concurrent-requests「KV 块」一节；三个结束 token：sampling「停止判断和长度上限」；无 KV connector：01 §B1（没有 kv_transfer_config）与部署页参数表。R1「多排一步」由 vllm@0fc695fc scheduler.py L383-L395 的长度预判条件推出：最后一圈前 197 个输出，候选全拒也只到 198，不满足预判，下一步照排（[D]）。

**核心概念对照（vllm@0fc695fc，逐条读源码）。** scheduler.py：`finish_requests` L1825-L1886（不认识或已结束的 ID 跳过、移出 running/waiting、置状态再 `_free_request`）；`_free_request` / `_free_blocks` L1888-L1910（ID 进 finished_req_ids 与按前端分的集合、connector 可推后、还块后才 `del self.requests`）；`update_from_output` L1393-L1407（已结束请求的在途结果跳过）、L1440-L1477（判停、语法拒绝记 FINISHED_ERROR）、L1518-L1580（判停当场 `_free_request`，再构造带 finish_reason 的输出，最后移出队列）、L1619-L1635（finished_requests 附在输出里）；`_preempt_request` L974-L995；`reset_prefix_cache` L1943-L1962；`check_stop` utils.py L94-L130；状态到结束原因 request.py L330-L360。engine/core.py：中止进两个队列 L1535-L1540、前向后先处理 L465-L467 与 L600-L608、batch queue 先排后处理 L484-L503、internal DP LB 时附结束集合 L911-L936。前端：async_llm.py `generate` 异常分支 L588-L636、`abort` L709-L721、停止字符串中止 L672-L690；output_processor.py `abort_requests` L450-L510（删状态、补 ABORT 输出、连子请求）、收尾段与 `_finish_request` L666-L708；api_utils.py `with_cancellation` L37-L90；core_client.py 路由表 L1440-L1446、按表发中止 L1505-L1525。worker：gpu_model_runner.py L1135-L1150（结束：删缓存状态 + 删批次行）、L1166-L1180（没排上：只移出批次）；昇腾 db701c1f model_runner_v1.py L748-L763 转交上游。还块：kv_cache_manager.py L438-L446、single_type L363-L378（倒序）与 L751-L765（滑动窗口没登记的 prepend）、block_pool.py L419-L442（计数减到 0 且非 null 才回队）、L462-L481（全部空闲才能清，warning 原文）；dev 路由 api_server.py L197-L200。日志原文逐字取自源码（行号见页面「会报什么错」），`--enable-log-requests` 默认 False（arg_utils.py L2576-L2594）。

**版本核对。** vLLM v0.26 `568afb3a`、main `84030bbe`：`_free_request` 另返回 ec_xfer_params；新增 `defer_block_free`，只在 KV consumer connector 且 max_concurrent_batches>1 时打开（v0.26 L128-L154、L2207-L2262，main L2569-L2601 同）；中止双队列、断开检测、生成函数取消即中止、日志原文三版一致（逐个 grep）。vllm-ascend：2c59ff10 只有可选均衡调度改写 reset_prefix_cache（默认关，patch_balance_schedule.py L34-L46）；db701c1f 无收尾改写；2ed6cbba 在 patch/platform 无条件导入 `patch_kv_delivery_preemption`，`_sched_mod.Scheduler = KVDeliveryScheduler`（L1246），改写 `_preempt_request` / `update_from_output` / `reset_prefix_cache`，不改 `finish_requests` / `_free_request`；批任务感知调度器要显式开（platform.py L716-L724）；baa023ad 无 KVDeliveryScheduler，DyntraLB 默认 enabled=False（ascend_config.py L1363-L1366）；四版 `_update_states` 都转交上游删行，main 转交前另处理 PP 采样结果与块拷贝。

**信息清单勾选**（scratchpad\p5\request-teardown-facts.md，A10 + B12 + C15 条）。
- A1–A6（streaming-output 代价第 4 条、收尾第 2 段、断开条目、`Request %s aborted.`；api-server-entry ⑤–⑦ 末段与主机内存条）：都在本页「为什么」「前端先发现」「会报什么错」与第一节，原出处页未改动。
- A7（one-request 第 7 站）：结束 token / 停止 token / stop string 定义在「怎么收尾」；客户端取消要通知引擎在误解 1；16–17 块、8 个 worker、DP0 运行数减 1 在 GLM 一节；两边都空才停只链接第 7 站末尾。
- A8–A9（vllm-kv-block-allocation）：各组倒序与队头队尾、数据不擦、还块不等于删登记，在「还块」与 GLM 一节，细节链接原节。
- A10（async-scheduling 待核「取消路径下在途结果」）：本页「前端先发现」末段与「异步调度下」一节按源码作答（abort 在 update_from_output 之前处理，已结束请求的在途结果跳过）。
- B1–B2、B4–B6、B8–B12：均在对应节；B7 三个结束 token 链接 sampling，max_tokens 缺省值留在 streaming-output / sampling（与收尾无关）。
- B3（一个 chunk 带 1–4 个 token）：属流式分段，不属收尾，留在 streaming-output，本页不重复。
- B9 里「waiting 侧借不到不抢占、直接 break」属借块规则，留在 vllm-kv-block-allocation「池子不够时」，本页链接该节。
- C1–C15：全部写入正文或对照源码区。无删除项、无改错项。

**自查疑点。** 无 P1 疑点。需审查留意：① R1「多排一步」与 worker「再晚一份清单」是按源码推出（[D]），未实测；② 「官方部署无 KV connector、无请求日志开关」按部署页参数表与 01 §B1 判断（[I]），教程完整命令未逐字核；③ v0.26 昇腾 `KVDeliveryScheduler` 改写后的抢占与在途结果处理没有逐行读，已写进待核；④ 「释放后的块被在途那一步继续写入」的先后保证，只找到 v0.26 注释作旁证，v0.23 的依据未找到，已写进待核，正文未下结论。

**验证。** `pnpm wiki:lint`：退出码 0，本页 0 报错（写作中途曾两次让本页不合法：relations note 里的 `[DONE]` 破坏 YAML flow、alias `free_blocks` 与 vllm-kv-block-allocation 重复，均当场修复；中途另见 params/enable-async-exponential.md 的 mark-unnumbered 报错，非本页，后续已消失）。`pnpm wiki:diagrams --check`：290 张一致，本页两图无报错、无提示（渲染只写本页两张 svg，没跑全量写盘）。`pnpm wiki:audit`：退出码 0，本页 45 条来源全部本地定位。写作标准实测（scripts/wiki/standard.ts 的 checkStandard 对本页单独跑）：6,349 字、行内代码 0/千字、对照源码之上角标 0、对照源码 H3 顺序正确、calc 0.16/千字、相邻块 0、图先行、免责 0.0%、图宽合格。角标 28 处全在对照源码区，C 22 处占 78.6%，D 4、I 2。`pnpm check:content` 通过。Playwright 只读截图 5193 上本页首屏、两张图、calc 和对照表，渲染正常。

**导航目录建议（未改 src/）。** 放进 `src/content/wiki/toc.ts` 的「推理过程」→「Sampling 与返回」小节，排在 streaming-output 之后：`pages: ["sampling", "streaming-output", "request-teardown"]`。

**建议加入链的已有页（页 + 节，一句话 + 链接）。**
- one-request「第 7 站 返回与收尾」：客户端取消那句、或归还块号段末，加「三处各删什么、中止怎样走，见 request-teardown」。
- streaming-output「思考段、工具调用和断开连接」末条（客户端断开）与「收尾：长度到限，再归还块号」第 2 段（停止字符串顺序反过来）。
- api-server-entry「怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）」末段断开那句。
- vllm-kv-block-allocation「结束：16–17 块一次还清」与「池子不够时」（抢占不是收尾）。
- async-scheduling 对照源码待核「普通抢占与取消路径下在途结果」一条：取消路径可改指本页「异步调度下」一节。
- vllm-scheduler「调度器怎样排一步」或常见误解：结束与抢占的区别链到本页「抢占不是收尾」。

**跳过了什么。** 无读取被拦。没读 HANDBOOK、docs/plans/。参考图库只含通信原语与 TP/DP/EP，本页不涉及，未借用。没有改其他页（加链只作建议）。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（2026-10-02，第 26 批，新页）。只审未改页面。

**结论：8.5 / 10。学习顺序通过；audit 本页通过（不在 standard-pages 名单，单独跑 checkStandard：6,370 字、行内代码 0、角标 0、calc 1 个 0.16/千字、相邻块 0、免责 0%，problems 为空，写作标准全 ✓）；P1 0 条，P2 2 条，P3 5 条。**

**初学者测试（只读前两屏）。** 一条请求停下后，前端删记录和输出槽、引擎移出队列并把块引用减 1、worker 删批次行；不还块后面的请求排不进，断开不告诉引擎会白算，收尾本身只是几笔 CPU 记账。能说清，通过。

**学习顺序。** 是什么（三进程直觉图 + 请求 A 示意）→ 为什么 / 代价（D 等 6 块、断开白算 180 个）→ 怎么做（四条路 + 流程图）→ 还块（唯一 calc）→ worker/DP、抢占对照、异步细节 → GLM 双机 → 误解 → 对照源码。GLM 数字只出现在 GLM 一节；基础节全用示意数。通过。

**信息清单。** `13898c74…\scratchpad\p5\request-teardown-facts.md` 存在（A10 + B12 + C15）。抽 8 条到正文：A1 断开白算（L118、L123）✓；A2 停止字符串顺序反过来（L164）✓；A4 `Request %s aborted.` 只在开请求日志时打（L291）✓；A7 16–17 块 / 8 个 worker / DP0 减 1（L247–L259）✓；A8 倒序、数据不擦（L110、L198、L251）✓；B10 120 块左右、约 67,000 位置（L263，与 concurrent-requests L249–L250、01 L1030–L1031 一致）✓；C3 中止双队列、在途结果跳过（L168、L172）✓；C14 引擎已死不发中止（L175）✓。原出处页（streaming-output L119/L211/L251/L286、api-server-entry L167、one-request L533–L535）都只是一两句的提法，不算两处重讲；但它们目前都没有指向本页的链接（见文末入链）。

**核心机制对照源码（vllm@0fc695fc，逐条读过）。**
- 判停条件与顺序：min_tokens → eos → stop_token_ids → max_model_len / max_tokens → repetition，`utils.py` L94–L130，与 L141 一致 ✓。
- 判停同一步先释放再发结果：`scheduler.py` L1518–L1580（`_handle_stopped_request` → `_free_request` → 构造带 finish_reason 的输出）✓。
- `finish_requests` 不认识或已结束跳过、先移出队列再置状态释放：L1840–L1886 ✓；`_free_request` 进 finished_req_ids / 按前端分的集合、connector 可推后、`_free_blocks` 还块后 `del self.requests`：L1888–L1910 ✓。
- 中止进两个队列：`core.py` L1535–L1539（注释写明为了不漏请求、调度器中止幂等）；`step` L465–L467 与 `step_with_batch_queue` L569 都在 `update_from_output` 前清中止队列 ✓；已结束请求的在途结果跳过 `scheduler.py` L1398–L1407 ✓。
- 前端：停止字符串命中 → `_finish_request`，引擎没结束才进 reqs_to_abort（`output_processor.py` L667–L681），按批发中止（`async_llm.py` L686–L689）✓；`abort_requests` 只对还有状态的 ID 补 ABORT 输出、连子请求（L450–L510）✓；DP 客户端按 reqs_in_flight 路由、查不到不发、引擎已死直接返回（`core_client.py` L1508–L1523）✓；finished_requests 随输出发回（`scheduler.py` L1623–L1635）✓。
- 断开检测：`api_utils.py` L52–L90 非流式两任务先完成者取消另一个、流式交给响应对象 ✓。
- 抢占：`_preempt_request` L974–L995（还块、PREEMPTED、清零、清候选、计数 +1、waiting 队首）✓；本步有抢占不排 waiting（L563）✓。
- worker：结束删 `self.requests` + `remove_request`（`gpu_model_runner.py` L1135–L1150），没排上只移出批次（L1166–L1180）✓；昇腾 db701c1f `model_runner_v1.py` L748–L763 转交上游 ✓。
- 还块：`single_type_kv_cache_manager.py` L363–L378 倒序 append；SlidingWindowManager L751–L765 未登记块 prepend 到队头；MambaManager L1197–L1201 走父类 ✓；`block_pool.py` L419–L442 计数到 0 且非 null 才回队 ✓。
- 清空前缀缓存：`block_pool.py` L462–L481（已用块 ≠ 1 即 warning 返回 False）、`scheduler.py` L1943–L1956 `reset_running_requests` 先抢占全部、HTTP 路由只在 `VLLM_SERVER_DEV_MODE` 下注册（`api_server.py` L196–L199；路由在 `serve/dev/cache/api_router.py` L20）✓。
- KV 加载失败默认 fail：`config/kv_transfer.py` L70 默认 `"fail"`；`scheduler.py` L1581–L1593 同一步 `finish_requests(…, FINISHED_ERROR)` 并发回 error 输出 ✓。
- 「多排一步」的长度预判：`scheduler.py` L381–L395 条件 `num_computed_tokens + 2 − placeholders ≥ prompt + max_tokens`。按 R1 代入：排 k+1 时已算 4 + 196 + 4 = 204、占位 4，204 + 2 − 4 = 202 < 204，照排；与 L255 的推导一致。本部署开异步调度与 async-scheduling L200 单一出处一致。
- `has_requests` = 未完成或已结束清单不空（`interface.py` L171–L188）✓。

**日志原文逐字核对（全部一致）。** `Request %s aborted.`（`async_llm.py` L595）、`Request %s failed (engine dead).`（L601）、`Request %s failed due to %s.`（L631）、`Aborted request(s) %s.`（L721）、`Unexpected: grammar rejected tokens %s for request %s. Terminating request.`（`scheduler.py` L1469–L1473，两段拼接）、`Request %s failed with an internal error during generation`（`serving.py` L195–L197）、`Failed to reset prefix cache because some blocks (%d) are not freed yet`（`block_pool.py` L473–L477，两段拼接）；`--enable-log-requests` 默认 False（`arg_utils.py` L2576）。

**数字。** 16–17 块及各组构成、max_tokens 200 / 197 / 只发 3 个：与 one-request L533–L535、vllm-kv-block-allocation L171–L173 一致，只链接未重算。120 块左右 / 约 67,000：与 concurrent-requests L249–L250、vllm-kv-block-allocation L214 一致。示意演算 calc：块 5、2 计数 1−1=0，块 9 2−1=1，空闲 4+2=6，队列 3、4、6、7、5、2，手算正确。无未出处数字。

**链接与锚点。** `pnpm wiki:lint` 退出 0、本页无报错（跨页锚点硬校验通过）。全库指向本页的链接 0 条，toc 未收录（写手已说明只作建议，见文末）。

### P2
1. **L216–L227、L263：「抢占不是收尾」重讲了已达标页的抢占步骤。** 挑队尾、先来先服务、清零、清候选、计数 +1、退回 waiting 队首、「本步有抢占就不排新请求」和 GLM 段的三条贵的原因，vllm-kv-block-allocation「池子不够时」（L202–L214）与 concurrent-requests L243–L258 已讲。改法：本节只留与收尾的区别（登记留着、不进已结束清单、worker 只移出批次、前端不知道）和示意重算 150 个位置，选谁、何时不排新请求、为什么贵各一句话 + 链接；L263 缩成一句话 + 链接。
2. **「登记」一词两义，初学者会混。** 引擎里的请求登记（L105「为 A 存了一条登记」、L155 / L251「删登记」、表头 L128「引擎里的登记」、直觉图「A 的登记 已删」）和块的前缀指纹登记（L183、L200「还块不等于抹登记」、L253「没有登记可抹」、L132「抹掉所有块的登记」）用同一个词，只靠「删 / 抹」区分；GLM 一节 L251 说「删登记」、紧接着 L253 说「没有登记可抹」，读起来自相矛盾。改法：请求那一侧统一叫「请求记录」（或「请求表项」），块那一侧统一叫「指纹登记 / 前缀登记」，图里同步改。

### P3
1. 流程图 ⑦：三条入口都汇到「删记录」再箭头指向「引擎还没停：发中止消息」，引擎先判停那条路看上去也会发中止；可在该框前加一个「引擎已停？」分支，或让右侧入口绕过该框。
2. L293–L294：`failed (engine dead)` 与 `failed due to` 两条同样只在打开请求日志时打印（`async_llm.py` L600、L622 的 `if self.log_requests`），页面只给前两条写了这句。
3. L144、L179：语法拒绝 token 在源码里是「Unexpected」异常情形（正常由屏蔽表挡住），正文按常规结束路线讲，宜补半句。
4. L174：「等待中的请求还没借过块」——用 KV connector 时 WAITING_FOR_REMOTE_KVS 的请求手里有块（`finish_requests` L1876–L1884 会推后还块）；GLM 无 connector 不受影响，可加「不用 connector 时」限定。
5. 写手记录的正文字数 6,349 与实测 6,370 略有出入（可能是最后一轮小改后未重测），不影响结论。

### 写手自报疑点核实
- ① 「多排一步」「再晚一份清单」：按 L381–L395 条件和 batch queue 先排后处理（`core.py` L484–L503）代入核过，成立；属源码推导，标 [D] 合适。
- ② 无 KV connector、无请求日志开关：部署页与 01 均未出现 `kv_transfer_config` / `enable-log-requests`（01 L848 明写无 kv_transfer_config）；正文措辞是「部署页整理的启动参数里没有这一项」，未越界。
- ③ ④ 已写进待核，正文未下结论，确认未越界。

### 导航目录与入链建议（供主会话统一加）
- toc：放「推理过程 → Sampling 与返回」，`["sampling", "streaming-output", "request-teardown"]`，与 chapters 09、order 80 一致，合理。
- 写手列的六处入链都合理：one-request 第 7 站、streaming-output L211 与 L251、api-server-entry L167、vllm-kv-block-allocation「结束」与「池子不够时」、async-scheduling 待核 L333（取消路径可改指本页「异步调度下」）、vllm-scheduler。另建议补两处：concurrent-requests L403（「哪条请求这一步结束了，它的块号就还给池子」）和 sampling「什么时候停下来」末尾（停下以后各处怎么清，见本页）。本页上线前至少要有 toc 或一条入链，否则读者走不到。

**截图。** Playwright 只读访问 5193（1440 宽，无页面报错）：`580bfd6e…\scratchpad\request-teardown-review-first.png`（第一屏）、`-fig1.png`（直觉图）、`-fig2.png`（流程图）、`-calc.png`。渲染正常，图字清楚。

**跳过了什么。** 无读取被拦。按规定没读 frontmatter 来源区、对照源码区正文（只 grep 了 H3 顺序与版本字样，读了「会报什么错」以核日志原文）、HANDBOOK、docs/plans/；v0.26 / main 与 vllm-ascend 各版的版本差异未逐行复核（只核 v0.23 钉住版本）。

## P5 修订记录（2026-10-02，第 26 批）

**P2-1 抢占一节重讲：成立，已改。** 「抢占不是收尾」删掉挑队尾、先来先服务、再请一条、清候选、计数 +1、退回队首、本步有抢占不排新请求，以及「开 prefix caching 能少算」，改成一句话链接 [vllm-kv-block-allocation「池子不够时宁可抢占」](../../../../wiki/concepts/vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)（锚点已存在，lint 通过）；只留与收尾的区别：相同的只有还块，不同在三处（请求表项留着、不进已结束清单 / worker 只移出批次、前端不知道），加示意重算 150 个位置。GLM 一节「抢占在这套部署里很贵」整段缩成一句话 + 链接 concurrent-requests「KV 块」一节，120 块 / 67,000 位置不再出现；证据归档里对应的 [D] 改为只说 16–17 块。

**P2-2「登记」两义：成立，已改。** 请求一侧统一叫「请求表项」，第一节首次出现时讲清（引擎有一张请求表，A 占一项，记着算到哪、手里有哪些块）；块一侧统一叫「指纹登记」，在第二节对照表后的段落首次讲清（写满的块记着内容指纹，开头相同的请求靠它复用），「还块」一节再点明两者区别（请求表项属于请求、结束就删；指纹登记属于块、跟着块走）。全页 35 处替换，包括对照表表头、步骤列表、GLM 一节（「删请求表项」与「没有指纹登记可抹」不再冲突）、误解、怎么开、版本表与证据归档；直觉图两个框改成「A 的请求表项」、说明改「删请求表项」，流程图释放框与副标题同步。正文现在「登记」只出现在「指纹登记」和链接文字（目标页标题）里。

**P3 全部修。**
1. 流程图：「引擎还没停」框缩到 600 宽，删记录框引出「是」进该框、再发中止；另引一条箭头到「否：引擎已释放，到此为止」，说明里写明引擎先判停那条路走「否」。重渲染只写本页两张 svg。
2. `failed (engine dead)`、`failed due to` 两条补「只在打开请求日志时打印」（async_llm.py L600、L622 的 log_requests 判断）。
3. 「出错」两处补：正常情况下屏蔽表已挡住不合法 token，这是兜底的异常分支；真发生时打以 Unexpected 开头的 error 日志。
4. 「等待中的请求也能中止」补限定：不用 KV connector 时还没借过块；用 connector 时正在等远端 KV 的请求手里已有块，传输没完成就推后还块（finish_requests L1876–L1884）。
5. 字数：重测为准，见下。

**验证。** 每次保存后跑 `pnpm wiki:lint`，全程退出码 0。最终：`pnpm wiki:lint` 0、`pnpm wiki:diagrams --check` 0（290 张一致，本页两图无报错、无提示）、`pnpm wiki:audit` 0（全站 0 处失败，本页 45 条来源全部定位）。按名单口径单独跑 checkStandard：6,404 字 · 行内代码 0/千字 · 对照源码之上角标 0 · 对照源码 H3 顺序正确 · calc 0.16/千字 · 相邻块 0 · 图先行 · 免责 0.0% · 图宽，全 ✓。角标 28（C 22 / D 4 / I 2，C 占 78.6%）。Playwright 只读截了 5193 上的流程图，「是 / 否」两支和新用词渲染正常。

**未改与说明。** 导航目录和入链按审查建议留给主会话统一加，未改 src/ 和其他页。
