# batch-job-aware-scheduler 审查记录

## P5 写作记录（2026-09-29，第 12 批深改，Opus 写手）

**改了什么。** 现版（= p4-checkpoint，教学正文 1387 字，6 节，正文带 [C1]… 角标、无对照源码五段）重写为八节：一大批请求排着队这一步该放几条（定义 + 直觉图）→ 为什么要先留（抢占代价、预留代价、为什么按作业分组 / LPT）→ 预留怎么算（三问 + 公式 + 示意 calc + 规则）→ 先接谁（作业标签、桶、输出长度估计 + EWMA calc、长短作业）→ 一次准入怎么走（流程图 + 五步 + 接着演的表 + 边界）→ GLM 双机（本部署没有它；场景 M 里多问什么；本部署块账与它的假设差在哪）→ 常见误解（10 条）→ 对照源码（五个 H3 + 待核）。改后教学正文 5182 字（按 standard.ts 口径）。标题改为英文原名开头：「Batch-Job-Aware Scheduler：先给正在生成的请求留块，再按作业接新请求」，旧中文名留作 alias。按验收要点，页面只讲在上游调度器之上**新增**的职责（waiting 一段的预留与挑选），上游 running 续排、token 预算与请求数上限只链接 vllm-scheduler；场景 M 的整批账（48 + 6000、块数 1,523 等）只引用 concurrent-requests 与 chunked-prefill 的结论并链接，不重算。

**图。**
- `wiki/diagrams/batch-job-aware-scheduler.yaml`（重画，直觉图）：① running 里 A、B 两条请求各一块（4 格，深色已写、淡色本步写），标出 A 下一步要 1 块、B 不用；② waiting 两条新请求 X（10 个位置，3 块）、Y（8 个位置，2 块）；③ 同样 6 块空闲的**成对对照**：上行「预留」= 3 块「空（留）」+ X 占 3 块，下括号给 P = min(1 + 2, 8) = 3 与余额 12 个位置，右侧结局「A 借到 1 块、Y 下一轮」；下行「不预留」= X X X Y Y 空，右侧结局「Y 被抢占（A 借走最后 1 块）」。即「正在生成的请求先留预算、新请求使用余额」。
- `wiki/diagrams/batch-job-aware-scheduler-flow.yaml`（新增，代码流程图兼站点位置）：第 2 站调度先排 running → waiting 循环问「有能接的吗」→ ① 准入预算（为 0 → 答没有）→ ② 冷启动（找到 → 直达 ⑤）→ ③ 作业分长短排先后（旁路：请求自然结束更新估计）→ ④ 排第一的作业里 best fit → ⑤ 交回上游截断借块、预留器增量加需求 → 回到循环。
- 没有用 exchanges 分镜动图（按临时规定，演示用静态图 + 示意数）。

**数字与出处。**
- 基础五节全部示意数（B = 4、F = 6、m = 2、M = 8；EWMA 20 → 40 → 22；两个作业的桶），不含 GLM 数字。
- GLM 节：8192 / 32 / decode 每步 1 + 3 = 4 取自底稿 01 §B2「做了什么」「上限」；场景 M 第 2 步（12 条 decode + N 6000）只写结论并链接 concurrent-requests 第 2 站；N 第一步 1,523 块（尾状态组 1,501、full 组 10）链接 concurrent-requests 的 KV 块节；20,000 token 第一段尾状态组 2,037 块链接 chunked-prefill 的 GLM 节（其出处为 01 §B2「一个会被切开的例子」）；640 / 调度器块 133,120 / 5 个缓存组取自 01 §0 全局常量与「block_size 的五种含义」（页面链接 kv-cache-spec）；3,855 块（算例）与 7.969 MiB 链接部署页。
- 本页推导 [D]：640 ÷ 4 = 160 步才跨一块；按 640 折算 6000 个位置约 10 块 vs 实际 1,523 块；8 × 7.969 MiB ≈ 64 MiB；B = 133,120 时 R 恒 0、预算 (F − 2) × 133,120 恒大于 4096（条件句，main 实际取值列待核）。
- 示意表（第 5 节）逐行手算：F 6 → 4 → 3，P 恒 3，预算 12 → 4 → 0；新请求的下一步需求按 `_compute_one` 逻辑复核为 0。

**核心概念对照了什么。**
- 调度器本体 `vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py`：`RunningBlockReserver`（L191-L292，缓存增量 Case 1/2/3、`_finalize_reserve`、`_compute_one` 四步）、`RequestBucket.peek_best_fit_request`（L315-L333）、`BatchJobAwareRequestQueue`（L372-L620：add/prepend/remove、冷启动计数与桶空清零、peek 抛 IndexError、`_admission_budget`、`_find_admittable`、`_collect_job_decode_info` 的 `> 32`、`_sort_jobs` 两类/一类分支、`__bool__`）、`JobNameParser`（L57-L74，`search`）、`JobDecodeEstimator`（L96-L173，128 / α 0.1 / 10 样本冻结 / 统计表从不删）、`BatchJobAwareScheduler`（L622-L662，每步清缓存、只对 FINISHED_STOPPED 记样本）、异步类 L664 起。main `baa023ad` 同文件 `git diff` 为空。
- 配置与平台：`ascend_config.py` L757-L802（默认值、校验、「0 = unlimited」注释）、L998-L1026（顶层旧键 deprecated、嵌套优先）；`platform.py` L652-L680（与短请求优先互斥）、L709-L725（profiling chunk 先设后被覆盖、同步/异步类）；main `platform.py` L1261-L1280、`ascend_config.py` L1300-L1330、`config_utils.py` L35-L48（extra="forbid"）。
- 上游（v0.26 配对 vLLM `568afb3a`）：waiting 循环条件 L669-L676、`_is_blocked_waiting_status` 与 FCFS 先取 `skipped_waiting` L1963-L1986、`num_lookahead_tokens` L240-L263（MTP 属 `use_eagle`）。
- 调度器块大小：`db701c1f` `patch_kv_cache_utils.py` L357-L378（lcm）；v0.26 L42-L60（多组且 dcp = 1 交回上游）；main L98-L117（先过滤私有组再算）。
- 官方文档 `feature_guide/batch_job_aware_scheduler.md`（L3-L5 不防饿死、L7-L19 三策略含 LPT、L52-L75 只支持离线批处理与请求 ID 写法、L77-L89 参数表）；e2e 测试 `test_batch_job_aware_scheduler_e2e.py`（Qwen3-0.6B、greedy、max_tokens 4 的逐 token 相等断言）。
- 版本：`2c59ff10` 与 `db701c1f` `ls-tree` 无 batch_job 文件；v0.26 无 GLM-5.3-Flash 教程/代码，main 有。

**不丢信息勾选。** 清单见会话 scratchpad `p5/batch-job-aware-scheduler-facts.md`：p4-checkpoint 现版 F1–F24、改前源码新核 N1–N11、p4 改写前最后一版 `c60c4fa`（Qwen 教学版）B1–B27。全部落位（位置写在清单每条后面）。未保留的：① c60c4fa 的 Qwen3.6-35B-A3B 单请求算例（2048 位置一块、每块约 20 MiB、常压 40 MiB）随教学模型换成 GLM 而删，机制「余量总在」保留在第 3 节；② c60c4fa「离线批处理里 skipped_waiting 基本是空的 [I]」为无证据推断，未保留；③ c60c4fa「不改结果」改写为带条件的 e2e 事实（小模型、贪心、4 token），因为那组测试不构成一般保证（p4 版也已写「不给逐 token 相同保证」）。

**自查统计。** 首图在第一节、图前无 calc 与 GLM 数字；calc 3 个（第 3、4、6 节各 1），表与 calc 不相邻；对照源码之上 0 角标，全页角标 30（C 22、S 3、D 2、! 3）；教学正文行内代码 0.2/千字；免责 1.8%；两图宽 880。

**验证。** `pnpm wiki:diagrams`（两图生成，本页无 advisory）；`pnpm wiki:diagrams --check` 一致；`pnpm wiki:lint` 通过（13 处待留意均非本页）；`pnpm wiki:audit` 通过，本页 30 条来源行号全部有效；另用 `scripts/wiki/standard.ts` 的 `checkStandard` 对本页单独跑写作标准，全部 ✓。未截图、未起服务（浏览器验收归审查）。

**参考图库。** 看过 refs/INDEX.md 与 HOW-THEY-TEACH.md：资料讲的是通信原语与 TP/DP/EP，没有调度器或 KV 预留的讲法；借了「成对对照图」（同一骨架只改一行）与「把状态写在块上」两条做法，用在直觉图的「预留 / 不预留」两行，其余无可借之处。

**疑点 / 待核。** ① main 上 GLM-5.3-Flash 的 `Scheduler.block_size` 实际取值（钉住版本为 133,120；main 的 GLM 路径先过滤私有缓存组再算），决定本调度器在这套模型上准入预算是否有意义；② 在 GLM 双机上打开后抢占次数、吞吐、等待时间的变化，无实测；③ 最大作业数超限抛 RuntimeError 后引擎是否整体退出，未实跑确认，页面只写「抛异常」。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，未改页面）。**分数 8/10**；学习顺序通过；`pnpm wiki:audit` 本页通过（30 条来源行号有效，写作标准全 ✓）；`pnpm wiki:lint` 通过。P1 0 条，P2 2 条，P3 6 条。

**初学者测试（只读前两屏）。** Batch-Job-Aware Scheduler 接新请求前，先把 running 下一步要借的块（再加 2 块余量）从空闲块里扣掉，只拿余额接新请求，免得下一步抢占刚接进来的请求；代价是接得慢、只防下一步、不防饿死。能说清。

**学习顺序。** 是什么（定义 + 示意直觉图）→ 为什么（抢占代价、三处代价、为什么按作业分组）→ 怎么算（三问 + 公式 + calc）→ 先接谁 → 一次准入流程 + 接着演的表 + 边界 → GLM 双机 → 常见误解 → 对照源码。基础五节只用示意数，GLM 数字只在 GLM 节，通过。无新增分镜动图。

**skipped_waiting 推断（本页重点）：删得对。** 写手删掉的是 c60c4fa 的「离线批处理里这条队列基本是空的 [I]」。钉住版本源码不支持这条，而且对一类常见离线负载是反的：vLLM `568afb3a` 里，带 structured output 的请求在构造时就被设成 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR`（`vllm/v1/request.py` L113-L114），`add_request` 经 `_enqueue_waiting_request` 把这种状态直接放进 `skipped_waiting`（`scheduler.py` L2137、L1970-L1974）；FCFS 下 `_select_waiting_queue_for_scheduling` 先取 `skipped_waiting`（L1976-L1978），语法编译好后在循环里原地升为 WAITING 并从这条队列直接排（L682-L692、L2586-L2610），不会进 `BatchJobAwareRequestQueue`；只有被抢占时才经 L1233 回到 waiting。KV connector 的异步加载、LoRA 超额、多模态编码未就绪、流式输入也会进这条队列（L692、L707、L777、L802、L983）。vllm-ascend `2ed6cbba` 的 `BatchJobAwareScheduler` 没有覆盖入队和选队列的方法（L622-L662），平台 patch（`patch_kv_delivery_preemption` / `patch_balance_schedule`）也没覆盖；main（vLLM `84030bbe` `scheduler.py` L2316-L2324、`request.py` L115）同。结论：删掉不丢信息；但源码能支持一条比旧推断更重要的事实，见 P2-1。

**核心概念逐条核对（vllm-ascend `2ed6cbba`，main `baa023ad` 同文件 `git diff` 为空）。** 预留公式与 `_compute_one` 四步（L238-L287）、Case 1/2/3 增量缓存与每步清缓存（L218-L236、L643-L653）、准入预算（L512-L517）、冷启动 3 条与桶空清零（L483-L495、L437-L457）、best fit 用整段 `num_prompt_tokens`（L315-L333）、长短阈值 `> 32` 与排序两分支（L554-L609）、`__bool__` 走 `_find_admittable`（L618-L619）、`prepend = add`（L430-L435）、作业名正则 `search`、默认作业 `__default__`（L57-L72）、估计器 128 / α 0.1 / 首样本直接当估计 / 10 样本冻结 / `max_jobs` 两处语义不一（L96-L173、L499-L506）、只对 `FINISHED_STOPPED` 记样本（L655-L660）、默认值（`ascend_config.py` L757-L778）、与短请求优先互斥（`platform.py` L652-L666）：全部正确。lookahead 只在 EAGLE/MTP/draft model 等方法下等于猜测数（vLLM `568afb3a` `scheduler.py` L240-L263），页面写法不冲突。官方文档 L3-L5、L54 与页面口径一致；e2e 在 `one_card` 目录、Qwen3-0.6B、`generate_greedy`、max_tokens 4，属实。v0.23 `2c59ff10` 与 GLM 镜像 `db701c1f` `ls-tree` 无此文件，v0.26 有文件无 GLM-5.3-Flash，main 两者都有：「本部署没有它」属实。

**示意演算手算。** 第 3 节 calc：A 3→4 满块，下一步 ceil(1/4)=1；B 2→3 空 1 格→0；R=1、P=min(3,8)=3、预算 (6−3)×4=12，不预留 24 ✓。直觉图：X 10 位置 3 块、接入后 F=3、X 下一步 0 块、预算归零，Y 等；不预留时 X+Y 借 5 块、A 借最后 1 块、Y 首个 decode 借不到、从 running 队尾抢占的正是 Y ✓。EWMA 0.1×40+0.9×20=22 ✓。第 5 节表：12→5 位置（2 块，下一步 0）→ F 4、预算 4 → 3 位置（1 块）→ F 3、预算 0 ✓。B=2048 时「> 4096」= 至少 3 块 ✓。

**GLM 数字。** 8192/32/1+3、8144、6000、1,523（尾状态 1,501、full 10）与 concurrent-requests L140-L141、L247 一致；2,037 与 chunked-prefill L179 一致，2,037/3,855≈53%「一半多」✓；3,855 块、7.969 MiB 与部署页 L211、L227 一致，8×7.969≈64 MiB ✓；640÷4=160 步 ✓；6000 按 640 折算 10 块 vs 1,523「两个数量级」✓；133,120 与 01 L43-L44、kv-cache-spec L208-L209 一致。未把 GLM 主线数字当成本特性效果，明写「没有实测数」✓。

**丢信息核对。** `git diff p4-checkpoint` 删除行逐条对照 F1–F24，均在新版找到落点；c60c4fa 的 B1–B27 抽查（B9、B13、B16、B22、B26、阈值 docstring 与代码不一致）均在（docstring 那条在源码区 L240）。写手未保留的三条（Qwen 算例、skipped_waiting 推断、「不改结果」改为带条件）理由成立。

**链接与锚点。** 正文 16 处链接的锚点由 `wiki:lint` 跨页锚点硬校验通过；全库入链（async-scheduling、cann-hccl、short-request-first、index）都不带锚点，改标题不受影响。

**浏览器实测。** Playwright 1440×900 打开 `http://localhost:5193/#/wiki/batch-job-aware-scheduler`：新标题、两张图（宽 1034）、表格正常渲染；控制台只有 4 条 502（问答后端未起，与本页无关）。截图：scratchpad `batch-job-aware-scheduler-review-1.png`（第一屏）、`-fig1.png`（直觉图）、`-fig2.png`（流程图）、`-table.png`（第 5 节表）。

### P2

1. **第 5 节「还有几处边界」第 1 条（L165）+ 常见误解第 2 条（L195）：跳过队列讲得不完整，漏了「structured output 请求整条绕过」。** 页面说这条队列放的是「这一步因为别的原因没排上的请求」，并把「在等结构化输出的语法」当成暂时的例子，读者会以为语法好了就回到作业桶。实际上带 structured output 的请求从到达起就进 `skipped_waiting`，FCFS 下还先于作业队列被取，语法就绪后直接从那里排上，不经过预留、冷启动、作业排序和 best fit（证据见上文 skipped_waiting 一段）。离线批处理里用 JSON schema 做抽取、分类很常见，这时本调度器的新增逻辑基本不起作用（只有被抢占退回的请求会进作业桶）。**改法：** 把 L165 改成「带 structured output 的请求一到达就进跳过队列，语法就绪后从那里直接排，整条绕过预留和作业排序；等远端 KV、LoRA 超额等是这一步临时进去的」；L195 同步补一句；流程图的「waiting 循环」框旁可加一条「先取跳过队列」旁路（可选）。
2. **第 4 节 L126：「离线批处理通常都给每条请求设了生成长度上限，这时所有作业都可能一直被当成长作业」因果不对。** 设了上限不等于被截断：只有 `FINISHED_LENGTH_CAPPED` 的请求不记样本（L655-L660），自然结束的照记。估计值停在 128 的条件是「这个作业的请求全被上限截断」；部分被截断时，样本只来自比上限短的那些，估计反而偏小（推导）。比如 `SamplingParams` 的 `max_tokens` 默认是 16（vLLM `568afb3a` `sampling_params.py` L262），不设上限直接跑时，长输出全被截断，只有 16 个 token 以内结束的请求会进估计。（旧版 c60c4fa L137 就有这条跳跃，p4 版写的是「长期由长度上限截断」，条件是对的，这次改写把条件改坏了。）**改法：** 改成「一个作业的请求要是全被长度上限截断，估计值就一直停在 128，作业一直算长作业；只截断一部分时，估计只从较短的那些里学，会偏小」，前一句 L126 已有，删掉「离线批处理通常都给……」这一句，或换成这个条件句。

### P3

1. **直觉图第 ③ 行括号（L60 所引 yaml）**：「预留 = min(1 + 2, 8) = 3 块」在第一屏就用了上限 8，而上限在第 3 节才讲。第一屏图可只写「1 + 2 块余量 = 3 块」，公式留给第 3 节。另外图注和 L58 正文几乎逐句相同，可删一处。
2. **术语口径**：同一个 `skipped_waiting`，本页叫「跳过队列」，short-request-first（L130、L204）叫「挂起队列」。按单一真相源统一叫法，最好在 vllm-scheduler 定义一次，两页链过去。
3. **缺 short-request-first 链接**：源码区三处提「短请求优先」（L230、L243、L251）都没链接；short-request-first 有 `alternative-to` 指向本页，本页 relations 没有回指。首次出现处加链接，relations 补一条。
4. **index.md L56、L188 仍是旧标题**「批作业感知调度：为运行请求保留增长空间」；下次 build/checkpoint 时刷新。
5. **第 2 节 L78「余额紧时反过来先接输出短的作业，它们生成几步就结束，块很快还回池子」**：官方文档和模块 docstring 只写了「余量紧先短」，没写理由；这是合理推断，建议写成「设计意图大概是……」，或者只写规则不写理由。
6. **源码疑点（静态阅读，未实跑）**：队列缓存的 `_peeked` 只在 `pop_request` 清空（L463-L478），`remove_request` 和每步开头都不清。上游 peek 之后因借不到块 `break`（vLLM `scheduler.py` L893-L905、L949-L956）时，下一步 `peek_request` 直接返回这条旧的，跳过冷启动、作业排序和 best fit 的重新挑选；这条如果在两步之间被 abort 移出桶，仍可能被 pop 出来。可在「会报什么错 / 开销」里记一条待实跑确认，不影响正文。

### 跳过

对照源码五个 H3 的正文（L209-L272）按规定只 grep：五个 H3 顺序正确；版本差异里有 v0.23、v0.26、main；启用 JSON 与官方文档 L61 一致。frontmatter sources 区不读（由 audit 校验）。参考图库（refs）没看：本页不涉及通信原语和 TP/DP/EP，写手已记录看过。写手留下的三条待核（main 上 GLM 的 `Scheduler.block_size` 实际取值、双机实测、RuntimeError 后引擎是否退出）本轮没有解决：只确认了 main `patch_kv_cache_utils.py` L96-L117 先过滤私有缓存组再取 lcm，GLM 各组是否 prefix-cacheable 没往下追。

## P5 修订记录（09-29）

**P2（2 条，全改）。**
1. 挂起队列绕过：先按钉住源码复核，审查属实。vLLM `568afb3a`：`request.py` L113-L114 带 structured output 的请求构造时即 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR`；`scheduler.py` L2134-L2139 `add_request` → `_enqueue_waiting_request`（L1970-L1974）把挂起状态放进 `skipped_waiting`；L1976-L1978 FCFS 先取它；L676-L694 循环里 `_try_promote_blocked_waiting_request`（L2586-L2610）就地改回 WAITING 并从这条队列排；L1228-L1234 抢占才 `self.waiting.prepend_request`。vllm-ascend `2ed6cbba` 的 `BatchJobAwareScheduler` 与 `vllm_ascend/` 下无 `_enqueue_waiting_request` 覆盖（`git grep` 只见四处调用 `_select_waiting_queue_for_scheduling`，均为同一上游写法）；main vLLM `84030bbe` `request.py` L115、`scheduler.py` L2324 同。改动：第 5 节「只换了 waiting 这一条队列」重写为「一到达就进挂起队列、语法就绪后从那里排、整条绕过预留/冷启动/作业排序/best fit，只有被抢占才回作业桶；远端 KV、LoRA 超额是临时进去的；JSON schema 抽取类负载上新增逻辑基本不起作用」；误解「开了它就不会再抢占」同步补「包括所有带结构化输出的请求」；对照源码「开销」新增「挂起队列 `skipped_waiting`」一条（[C31] request.py、[C19] 入队与选队列、[C18] 就地升级，来源 18 行号扩到 L669-L694，新增来源 31–34：request.py L109-L114、scheduler.py L2134-L2139、L2586-L2610、L1228-L1234）。流程图旁路（可选项）未加，文字已讲清。
2. 第 4 节「离线批处理通常都给每条请求设了生成长度上限，这时所有作业都可能一直被当成长作业」因果错误：认同（只有 `FINISHED_LENGTH_CAPPED` 不记样本）。改为「全被截断时停在 128、一直算长作业；只截断一部分时，估计只从比上限短、自然结束的那些里学，会偏小」。

**P3（6 条，改 4 条，2 条不在本页范围）。**
1. 直觉图括号改为「留 = 下一步 1 块 + 余量 2 块 = 3 块」，不再在第一屏用上限 8；图注缩成两行对照的结论，不再与正文逐句重复。
2. 术语：本页「跳过队列」统一改称「挂起队列」（与 short-request-first 一致），源码区首次写明 `skipped_waiting`。在 vllm-scheduler 定义一次并让两页链过去，涉及他页，未改，交主会话。
3. 源码区首次提「短请求优先」处加链接 short-request-first；relations 补 `{to: short-request-first, kind: alternative-to}`，lint 未报重复。
4. index.md 旧标题：派生文件（`pnpm wiki:build` 生成），不在本页范围，未改。
5. 「余额紧先接短输出」的理由改写为「官方只写了规则、没写理由；从效果看……」。
6. `_peeked` 只在 `pop_request` 清空：静态复核属实（`batch_job_aware_scheduler.py` L417、L463-L478；上游借不到块 `break` 于 `scheduler.py` L893-L905、L949-L956），写进对照源码「待核」第 3 条，注明缺实跑确认。

**标记口径。** 为容纳 [C31]，删去 [C23] 与「队列怎样让上游停下」一条里重复的 [C18]；全页角标仍 30（C 23、S 3、D 2、! 3），对照源码之上 0。

**验证。** `pnpm wiki:lint` 通过（13 处待留意均非本页）；`pnpm wiki:diagrams --check` 一致；`pnpm wiki:audit` 通过，本页 34 条来源全部 ✓；`checkStandard` 单页全 ✓（教学正文 5315 字，免责 1.2%）。
