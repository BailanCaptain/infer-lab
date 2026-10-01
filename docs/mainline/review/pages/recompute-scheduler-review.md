# recompute-scheduler 页审查记录

## P5 写作记录（2026-09-29，深改，第 12 批）

**改了什么。** 全页重写，按新讲法排序：问题式开篇 + 一句话定义 + 三种处置办法 + 直觉图 → 为什么 D 不自己重算、退回 P 的四项代价 → 一次「退回 P」怎样走完（4+2 token 示意、流式生成上限 calc）→ 本调度器在上游之上新增的职责（岔路口、本步禁新、投机形状补齐、远端 KV 夹值、只有 D 能开 + 细粒度 TP 硬依赖）→ GLM 双机（主线不启用；主线抢占代价链接 C；1P1D 假设下的变化与待核）→ 常见误解 5 条 → 对照源码五个 H3。改前（p4-checkpoint 版）正文约 1,537 个非空白字符，改后约 11,100 个（audit 口径 12,542 字 / 7 节 / 来源 29 条）。标题改为「RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算」；入链只有页级链接（recompute-cpu-offload、vllm-scheduler、index），没有锚点入链，改标题不影响。

**直觉图。** `wiki/diagrams/recompute-scheduler.yaml` 重画（900×600，原为 JSON 写法的抽象流程）：三个框分别是 D 节点、代理、P 节点。D 内 ①续块失败 → ②从 running 取一条 → ③问连接器能否存走 → 分成「能：存到主机内存、排回队首稍后搬回」「不能：还回全部块、结束并标 recomputed」；淡色一格标出通用做法「在 D 本机从头重算」（本调度器不走）。「不能」一支用红色箭头进代理：④认出标记、已生成的接到原问题后、上限扣掉已生成的 → ⑤重新挑 P/D → P 框 ⑥整段 prefill → ⑦KV 交给选中的 D 接着 decode。静态图，未用 exchanges 分镜（按协调方 09-29 临时规定）。

**本批验收要点。** 只讲新增职责：上游的续块循环、抢占四件事、本步禁新、异步加载时本步不排计算、收满退 1 格，都只一句话 + 链接（vllm-scheduler、vllm-kv-block-allocation、pd-disaggregation），不重讲；本页只写本调度器改动的部分（岔路口、把 recomputed 也算进本步禁新、占位草稿/pad_spec_decode、min 夹值与补占位）。场景 M / 满载抢占的整批推导不重算，GLM 一节只引用 concurrent-requests 的结论（约 67,000 位置、120–121 块、956–964 MiB、约 9 步）并链接。

**数字取自哪。** GLM 主线抢占代价：docs/mainline/01-deploy-entry-schedule.md §B3（经 concurrent-requests.md「KV 块」一节链接，不重算）。1P1D 时 D 每卡块数不到主线一半：pd-disaggregation.md「把这两台机器拆成一 P 一 D」（只引用结论，未写具体块数，避免与 3,855/3,908 两个口径混用）。主线不传 --additional-config、细粒度 TP 默认 0：wiki/sources/glm-5-3-flash-baseline.md 与 01 §B1 待核 4、02 的 embedding 默认值。4+2 token、上限 10 是示意数。1P1D 的抢占触发点、P 重算步数、重交接字节：底稿没有，页内写「待核」。

**核了哪些源码（钉点）。**
- 岔路口：vllm-ascend@db701c1f `core/recompute_scheduler.py` L280-L345（条件 kv_transfer_config 在且非 producer；running.pop()；钩子返回真 → PreemptedRequestData + 上游 _preempt_request；否则 free + RecomputeReqInfo）；与 2c59ff10 同文件只差 update_from_output 里 num_in_flight_tokens 三行，与本页无关。
- 本步禁新 L438；结束帧 L869-L880（STOP、空 token、stop_reason="recomputed"，另打一条 warning）；占位草稿 L98-L134；远端 KV 夹值 L138-L169；配置与 dataclass L55-L93。
- 上游对照：vllm@0fc695fc `v1/core/sched/scheduler.py` L974-L995（_preempt_request）、L2154-L2186（收满减 1 是上游原有）。
- 平台三道门：db701c1f `platform.py` L680-L700（P 上 warning 就地关、不写回 additional_config）；L702-L716 SLO/profiling 分支改写 scheduler_cls；L892-L900 混合模型禁 kv_load_failure_policy=recompute。2c59ff10 L689-L725、2ed6cbba L682-L723、baa023ad L1014-L1044 都有写回。
- 硬依赖：db701c1f `ascend_config.py` L142-L161（oproj/embedding TP > 0 必须开，注释理由为跨 DP HCCL 要求 num_tokens 一致）。
- 代理：db701c1f `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py` L970-L1056（origin_prompt 取 prompt 或 messages[0].content；流式 completion_tokens 按帧 +1；max_tokens = 原上限 − completion_tokens + retry_count；while retry 无上限）；baa023ad L1165-L1180 仍是字符串拼接；2ed6cbba 改用 `vllm_ascend/patch/recompute_proxy.py` L33-L105 按 token 编号续接并核对历史。
- 版本差异：2ed6cbba L128-L146（_finish_recomputed_request → FINISHED_ABORTED）、L295-L345（钩子无 try）、L576-L612（pad_spec_decode）、L101-L127（只夹值不补占位）；baa023ad L85-L166（类注释、try/except、_preempt_or_recompute）、L352-L370（按上游策略挑受害者）、L1024-L1036（4 个类）、platform L1254-L1280 与 L1471（DyntraLB 组合）；main 没有 _update_waiting_for_remote_kv 改写。
- 文档：db701c1f `docs/source/user_guide/configuration/additional_config.md` L81（写 P 上启动失败，与代码不一致）；`tutorials/features/long_sequence_context_parallel_multi_node.md` L312（D 上 KV 不够送回 P 重算）；2ed6cbba 同名文档 L144-L149（嵌套键优先、顶层弃用）。

**旧版信息清单勾选。** 旧版 A = c60c4fa（重写前最后一版，Qwen3.6 设定）42 条 + 旧版 B = p4-checkpoint 12 条，清单与逐条去向存 scratchpad `p5/recompute-scheduler-facts.md`。保留 49 条（全部按四个钉点重核）；修正 3 条——F6 日志其实是 info + warning 两条、F39「嵌套写法静默忽略」改为「读不到、开关仍 false」、F35 按 GLM 快照改为 SLO/profiling 两分支；删除 3 条——F4 Qwen3.6 旧模型算例（换成示意数 + 链接 GLM 结论）、F5 的 32K/几百 MiB 数（无底稿，改为定性）、G1（无信息量）；挪走 1 条——G6 异步加载时本步不排计算是上游行为，按验收要点只链接。新增 5 条：v0.26 代理按 token 编号续接；GLM 快照 P 上关掉后不写回；远端 KV 改写的三版差异；混合模型禁 kv_load_failure_policy=recompute；流式 +retry_count 的来由。

**参照。** 看过参考图库 scratchpad/refs/（amd-* 为 vLLM MoE 并行指南、xzclass-* 为集合通信课程截图；INDEX.md、HOW-THEY-TEACH.md 尚未建好），没有调度/抢占/PD 退回相关的图，无可借之处。

**留下的待核。**
1. 1P1D 拆分下 D 的块池大小、抢占触发长度、P 重算步数与重交接字节（底稿无这套部署形状）。
2. GLM 快照 P 上就地关掉后不写回 additional_config，worker 进程重建 AscendConfig 时读到 true 的实际影响未核。
3. v0.23 只读顶层键时，嵌套写法是否有未知键告警未核。

**验证。** pnpm wiki:lint：本页 0 报错、0 留意（全库失败 2 处在 npu-model-runner-code-flow 图与 kv-cache 锚点，非本页）；证据标记 30 处（C 23、D 3、I 2、! 2），未触发 mark-flood。pnpm wiki:diagrams --check：本页图通过（全库失败 4 处在 batch-invariance 等别页）。pnpm wiki:audit：本页 29 条来源行号全部有效（全库失败 1 处在 batch-job-aware-scheduler 缺图）。写作标准脚本（standard.ts checkStandard）本页 PASS：行内代码 0/千字、角标 0、对照源码五节、calc 0.26/千字、图先行、免责 0.8%、图宽 ≤900。未截图、未起服务。

## P5 审查（09-29）

审查员：独立审查（Opus 5.5），只审不改页面。页面现版 = 工作区未提交版本（updated 2026-09-29）。

**分数：7.5 / 10。** P1 0 条，P2 2 条，P3 8 条。

**初学者测试（只读前两屏）。** 能说清：D 节点块不够、要挤掉一条正在生成的请求时，这个调度器不在 D 上重算；KV 能存到主机内存就存走、稍后搬回，存不走就结束它，由代理把「原问题 + 已生成」重发给一对 P/D，在 P 上重算。代价是 P 整段重算、再交接一次、输出停顿，而且退回次数没有上限。

**学习顺序：通过。** 顺序是：是什么（场景 + 三种办法 + 直觉图）→ 为什么 / 代价 → 怎么走（4+2 token 示意，calc 为 10−3+1=8，手算无误）→ 新增职责 → GLM 双机 → 常见误解 → 对照源码。基础节没有用 GLM 数字；第一节末尾没有成排堆链接；没有 meta 文本；没有分镜。

**audit / lint。** `pnpm wiki:audit` 本页 29 条来源全部 ✓，全库 ok；`pnpm wiki:lint` 全库 ok，本页 0 条提醒（跨页锚点硬校验通过）。对照源码五个 H3 齐全，顺序正确；版本差异一节出现了 v0.23、v0.26、main，以及 db701c1f / 2c59ff10 / 2ed6cbba / baa023ad。

**截图（Playwright，1440 宽，用户预览 5193）。** scratchpad `recompute-scheduler-review-first.png`、`-diagram.png`、`-calc.png`。图清楚，文字不挤；第一屏只露出图的框标题（见 P3-7）。控制台 4 条 502 来自问答后端没起，与本页无关。

### 核心机制对照（逐条，钉点）
- ✓ 通用抢占四件事：vllm@0fc695fc `v1/core/sched/scheduler.py` L974-L995（free，改成 PREEMPTED，num_computed_tokens=0，prepend 回 waiting）。上游这一步抢占过就不接纳 waiting：L563。
- ✓ D 分支的条件：kv_transfer_config 在、且不是 producer；`running.pop()`；hook 返回真 → PreemptedRequestData + `_preempt_request`；否则 free + RecomputeReqInfo(req_id, output_token_ids, client_index)。见 vllm-ascend@db701c1f `core/recompute_scheduler.py` L295-L347。
- ✓ 本步禁新把 recomputed_reqs 也算进来：L438。结束帧是 STOP、空 token、stop_reason="recomputed"，另打一条 warning：L869-L880。
- ✓ 占位草稿（add_request L126-L128）、远端 KV 收完后的 min 夹值与补占位（L154-L167）；v0.26 只留夹值（2ed6cbba L110-L124），main 没有这处改写。main 的 `_preempt_or_recompute` 用 try/except，并先按上游策略挑受害者（baa023ad L103-L140、L330-L366）。
- ✓ 平台三道门、选同步 / 异步类：db701c1f `platform.py` L680-L700、recompute_scheduler.py L55-L72。细粒度 TP 硬依赖及注释给的理由：`ascend_config.py` L142-L161。混合模型禁用 kv_load_failure_policy=recompute：`platform.py` L892-L900。
- ✓ 代理的四处细节：只接最初的问题；按文字拼接；接在 messages[0]；不限重试次数，max_retries 只管网络重试。帧计数与 `原上限 − completion_tokens + retry_count`：`load_balance_proxy_server_example.py` L970-L1056。main 仍是字符串拼接（L1168-L1176）；v0.26 用 `patch/recompute_proxy.py` 按 token 编号续接，并核对历史（L56-L103）。
- ✓ 本部署是否启用：`ascend_config.py` L142 默认 False；教程没有传 `--additional-config`（sources/glm-5-3-flash-baseline.md L132）；没配 kv_transfer_config 时打开会 ValueError。「主线不启用、真打开起不来」成立。细粒度 TP 两项默认 0（ascend_config.py L511、L513）。
- ✓ GLM 数字（约 67,000 位置、120–121 块、956–964 MiB、约 9 步、prefix caching 关、34 层 KDA）与 concurrent-requests L241-L258 一致，只做链接、没有重算。「1P1D 下 D 块数不到一半」与 pd-disaggregation L244 一致。没有把主线数字当成本特性的效果，也没有虚构部署数。

### 丢信息核对
facts 清单的勾选属实。F1–F3、F7–F42、G2–G5、G7–G12 都能在现版找到（关键词 grep：max_retries、SLO、profiling、DyntraLB、嵌套、client_index、kv_both、try、warning 都在）。G6 挪到 pd-disaggregation「状态交接」第 3、6 步，确实在那边。G8 的「长度条件」丢了（见 P3-4）。

### P2
1. **§4「只改了四处」不准，开关的影响也没列全**（L117、L119-L134）。
   - 同一份 schedule() 里还有第五处功能改动：D 端遇到含 Mamba 类层的混合模型时，改用 `find_longest_cache_hit_per_group(block_hashes, num_tokens-1)` 按组算本地前缀命中，免得 full attention 组的命中被取 min 压成 0、重复传块。钉点：db701c1f `recompute_scheduler.py` L484-L500、`patch/__init__.py` L424-L440；v0.23、v0.26 同样有，main 没有。
   - 开关在调度器之外还改了两处 worker 行为：
     - 收完 KV 后那个 N−1 位置的 MTP 步按 decode 归类，不算 prefill：`utils.py` L1175-L1181、`attention/utils.py` L381-L384、`worker/pcp_utils.py` L307-L309。
     - MoE 的 KV consumer 在 decode 必须走 MC2 时，跳过跨 DP 的 all-reduce，global_bs 取最大值：`utils.py` L1257-L1302、`model_runner_v1.py` L708、`token_dispatcher.py` L133。
   - 改法：把「只改了四处」改成「和被让出请求相关的主要改动有四处」；补一小段「开关还牵动的其他行为」，写上面三条，各一句加钉点。GLM 一节再补一句：主线 prefix caching 关着，混合模型这条前缀命中路径的命中是 0。
2. **§2「为什么 D 不自己重算」的理由有一处和一手资料不符，还漏了一个限制**（L77）。
   - 页上说「源码只写了结果」，其实引入 offload 的 PR #10742 已经写明理由（commit 6329838c9，在 2c59ff10、2ed6cbba、baa023ad 的历史里；db701c1f 是 orphan，内容相同）：D 的 max_num_batched_tokens 通常设成 max_num_seqs×(1+num_spec_tokens)，在 D 上做重算 prefill 很可能 OOM，性能也受很大影响。
   - 页上「一次插进上万个位置，这一步会变得很大」和同段「每步能放多少 token 按 decode 配」自相矛盾：步长被预算卡住了，prefill 会被切成很多步，或者排不上。
   - 同一 PR 还指出：按文字重组 prompt 时，tool calling / function call 用不了，会有精度问题。§3「拼的是文字」和常见误解都没写。
   - 改法：按 PR 描述重写 L77 的理由，去掉「只是推出来的」那句；在 L111 的影响清单里加上 tool calling / function call。

### P3
1. 页内重复。平台三道门和细粒度 TP 硬依赖在 L134、L154、L172-L173、L184-L188、L196 重述了五处；§2 L75 又完整重讲了一遍上游抢占四件事（vllm-scheduler L99 已经讲过）。建议正文 §4 各留一句，完整清单只放「会报什么错」；L75 改成一句话加链接到 vllm-scheduler。§1（L57）和 §4（L119）对 running / waiting 的括注也重复了。
2. calc 注释说「每帧记 1 个 token」。chat 流式的首帧是 role 帧，GLM 在 D 上用 MTP 时一帧可能带多个 token，这两种情况下帧数都不等于 token 数，新上限会偏小或偏大。建议在 L105 注明「示例假设每帧 1 个 token」，并加一句这两种情况。
3. §4 第 1 步（L123）只写了 v0.23 / GLM 快照写死取队尾。v0.26 也是写死的（2ed6cbba L299），应写成「v0.23、v0.26 与 GLM 快照」。
4. 占位草稿有长度条件：max_model_len ≥ num_tokens + num_spec_tokens（db701c1f L127），旧版 G8 写过，现版 L130 漏了。
5. L132「塞了占位草稿以后这个数会超过实际长度」是写手推的因果，源码没有注释。夹值是随 offload PR 一起加的，offload manager.py L186 也对恢复长度取了 min。建议改成中性写法：「收回的位置数可能超过请求实际长度，源码直接取 min」。
6. 术语。「连接器 / 代理」是 KV connector / proxy 的中文译名，按 09-27 英文原名规则应用 connector / proxy。L53 的一句话定义里，这两个词先用、下一段才讲。全站混用（pd-disaggregation 用了 32 处「连接器」），建议在 TERMS 统一后一起改。
7. 1440×900 的第一屏，图只露出框标题（见 first.png）。可以把「先补几个词」压一压，让图上移。
8. 图注写「只改『被让出的那条怎么处置』」，和 §4 的「四处」说法对不上，措辞要统一。

### 注水与重复结论
对照源码之上约 5.9k 字，对照源码约 5.5k 字（其中「怎么开」2.1k 字，含命令块）。§1–§5 基本不注水：场景 M 的推导都链接到 concurrent-requests；上游续块循环、收满退 1 格、异步收 KV，分别链接到 vllm-scheduler、vllm-kv-block-allocation、pd-disaggregation；和 kv-cache、chunked-prefill 没有重叠。重复集中在平台门与硬依赖（P3-1）。

### 跳过
- 「## 对照源码」（L158-L225）的正文只用 grep 核了结构、版本号和关键词，没有通读，所以其中的注水程度只按字数判断。
- frontmatter 的 sources 区和 L162-L169 的命令块跳过。
- 参考图库 scratchpad\refs\ 没有再看：写手已说明没有调度 / 抢占相关的图，本页也不涉及通信原语或 TP/DP/EP。

## P5 修订记录（09-29）

按「P5 审查（09-29）」修。P2 两条都核实成立，都改了；P3 八条改了七条，第 6 条部分处理（见下）。

**P2-1 「只改四处」不准（成立，已改）。** 核对了 db701c1f `recompute_scheduler.py` L484–L500（D 端、有 Mamba 类层、块管理器是 HybridKVCacheCoordinator 时，改用 `find_longest_cache_hit_per_group` 按组算本地命中）和 `patch/__init__.py` L424–L440 的改动理由。grep 结果：2c59ff10、2ed6cbba 有这段，baa023ad 没有。worker 端两处也核了：`utils.py` L1175–L1181，用在 `attention/utils.py` L381–L384 和 `pcp_utils.py` L304–L310；`utils.py` L1255–L1302，用在 `token_dispatcher.py` L129–L133 和 `model_runner_v1.py` L708–L710。这两处在四个钉点上都有。页面改动：§4 开头改成「和被让出请求直接相关的改动有四处」，并说明另有前缀命中和 worker 端两处；新加「混合模型的前缀命中按组算」「开关还牵动 worker 端两处行为」两段；版本差异表加一行；源码位置表加三行；来源加 C30–C39。GLM 一节补了三条：主线 prefix caching 关着，而且 vllm@0fc695fc `kv_cache_coordinator.py` L702 和昇腾 `patch_kv_cache_coordinator.py` L491 在关着时都返回不带前缀缓存的块管理器，这条分支进不去；1P1D 时「按 decode 归类」对 GLM（MTP）生效；1P1D 时是 EP8，用不上 MC2，跳过 all-reduce 那条不触发（依据 pd-disaggregation 的结论）。

**P2-2 §2 理由与 PR 原文不符、漏了 tool calling（成立，已改）。** PR 原文从本地仓库的 commit 6329838c9 提交说明里读取（`git log -1 --format=%b`），`merge-base --is-ancestor` 确认它在 v0.23、v0.26、main 的历史里。页面改动：§2 的加粗结论和理由改成 PR 给的说法：D 的每步上限按「条数 ×（1 + 草稿数）」设，在 D 上重做 prefill 很可能 OOM，性能也大受影响。原来「只是推出来的」「一步会变得很大」两句删掉。另加一个示意 calc：16 条 × 4 = 64，其余 15 条先占 60，余 4，6,400 个位置要 1,600 步，说明上限被卡住以后 prefill 只能切成很多小步，关掉 chunked prefill 时根本排不上。这样也消掉了原文的自相矛盾。§3「拼的是文字」和常见误解都补了 tool calling / function call 用不了、会带来精度问题。对照源码「怎么开」补了 PR 号、commit 和理由，标 [C40]；来源加 PR URL。

**P3。**
1. 重复（已改）。§2 的抢占四件事压成一句，加链接到 Scheduler。§4 的平台门和硬依赖压成一句，指向「会报什么错」。「怎么开」里的三道门只留换类这一条，硬依赖整条移到「会报什么错」，[C9] 跟着移过去。§4 里 running / waiting 的重复括注删掉了。
2. calc 帧数（已改）。注释写明「示例假设每帧正好 1 个 token」，并补上两种例外：chat 流式首帧只带 role；开投机解码时一帧可带多个 token。两种情况下新上限分别偏小、偏大。
3. v0.26 也写死取队尾（已改）。改成「v0.23、v0.26 和 GLM 快照」。
4. 占位草稿的长度条件（已补）。写成「请求长度加草稿数不超过模型允许的最大长度」。
5. 夹值的因果（已改）。改成中性写法：「收回的位置数有可能超过实际长度，直接取较小的那个」。版本表里「夹值也不需要了」同样改成中性写法。
6. connector / proxy 术语（部分处理）。§1 的一句话定义里先加了「负责搬 KV 的」「负责转发的」两个短注，下一段写成「连接器（KV connector）」「代理（proxy）」，给出英文原名。全页没有改成英文：pd-disaggregation 等页通用「连接器 / 代理」，TERMS.md 也还没有这两个词条。等 TERMS 统一后再一起改，避免本页和依赖页叫法不一致。
7. 第一屏图位置（已改）。「先补几个词」和场景两段压短，图提到三种去向列表之前，列表里注明每种去向对应图上哪一格。
8. 图注措辞（已改）。yaml caption 改为「本调度器改动的核心是『被让出的那条怎么处置』」，和 §4 的说法对上。

**验证。** pnpm wiki:lint 本页 0 条。pnpm wiki:diagrams --check 本页 0 条，重新生成了 svg。pnpm wiki:audit 全库 ok，本页 40 条来源：39 条行号有效，1 条是 URL。写作标准脚本 PASS：行内代码 0/千字，calc 0.51/千字，免责 1.6%，图先行。证据标记 30 处（C 23），没有触发 mark-flood。
