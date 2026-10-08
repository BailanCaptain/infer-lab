# dp-request-routing 审查记录

## P5 写作记录（09-29）

**任务。** P5 第 17 批，新建 `wiki/concepts/dp-request-routing.md`（type: concept，章 13，order 35，挂在 data-parallel 之后）。队列要求：挂靠 01 §A1、§B1；直觉图画「显式指定」与「按负载打分」两条选组路径；依赖 K（request-call-chain）、C（concurrent-requests）、data-parallel、balance-scheduling。

**字数（wc.py 口径，去 frontmatter）。** 改前 0（新建）→ 改后全文 7,243，其中教学正文 5,715。标准检查（scripts/wiki/standard.ts 的 checkStandard，本页未进名单，手动跑）：正文 4,921 词，行内代码 1 处（0.20 / 千字），calc 4 个，免责句 2.6%，无表格与 calc 相邻，直觉图先于第一个 calc，问题 0 条。证据角标全部在「对照源码」内，共 29 处（C 22、D 5、A 2，C 占 76%）。

**结构。** 是什么（两条路 + 直觉图）→ 为什么要挑、挑偏的四种代价（排队、KV 池、MoE 每步对齐、前缀缓存；calc：共享 2,048 token 开头的两条请求同组 / 分组各算多少）→ 怎么挑（四步：请求头 → 逐组算分、严格小于才换 → 本地记账 → 登记归属并发送；calc：两次推送之间 A–D 四条逐条挑组，A 带组号 0）→ 计数表从哪来、为什么会过时（代码流程图；calc：推送到达后第五条请求 E 的分数）→ 不走默认打分的几种情况（late interaction、多前端、internal / hybrid / external 三种方式小表、派出后的补救）→ GLM 双机（calc：场景 M 里 N 落 DP0 / DP1 时这一步与下一步的宽度）→ 常见误解 7 条 → 对照源码五个 H3。全页用同一套示意数贯穿：DP0 (0, 6)、DP1 (0, 3) → A–D → E。

**图（都没用 exchanges 分镜）。**
- `wiki/diagrams/dp-request-routing.yaml`（直觉图）：左边请求 A（请求头组号 0）、请求 B（没写）；上路 A 直达 DP0，旁注「不打分，也不改计数表」；下路 B → 计数表 DP0 (0, 6) · DP1 (0, 3) → 分数框 → DP1，旁注「3 < 6，本地记它排队 1 条」；右边两组框里用格子画 running 实心格和 waiting 淡格（A、B 各进一组）。参考了 AMD 博客 DP 图（amd-03，Router 在上、请求分到各列）的「请求从一个入口分到各组」构图，用我们的格子和两条路改画。
- `wiki/diagrams/dp-request-routing-flow.yaml`（代码流程图）：前端（选组、计数表）、两组 EngineCore（输入队列 → scheduler）、DP 协调器；实线是请求路，虚线是计数路，①–④ 与正文四步一一对应。
- 用 Playwright 把两张 SVG 渲成 PNG 自查过：无压字、无出框。

**数字出处。**
- waiting × 4 + running、本地 +client_count、100 ms、场景 M 的 12 对 7、R1 平分落 DP0：01 §A1（第 4 步与「具体数字」）、§B1「路由打分」。场景 M 的打分只链接 concurrent-requests 第 1 站，没有重算。
- 场景 M 的 6048、7 × 4 → 32、13 × 4 = 52 → 64：01 §B1 表与 §A3 第 746 行；图尺寸 4/8/16/32/64/96/128：01 §0。
- 新推的数（标 [D]）：N 落 DP1 时这一步 6028（= 7 × 4 + 6000，DP0 的 48 → 64 后被拉到对端宽度，图模式取 min 为 NONE）；N 落 DP1 时下一步 max(48 → 64, 32 → 32) = 64。规则全部按 01 §B1 的四条对齐规则套。
- 前缀缓存示意（块 16、开头 2,048、问题 100）和 A–E 的计数全是示意数。

**核心概念对照的源码。**
- 选组：`vllm@0fc695fc:vllm/v1/engine/core_client.py#L1365-L1426`。核实了三件底稿没写的事：①显式组号与 late interaction 两条路都跳过本地 +client_count（+ 写在打分分支里）；②扫描从 eng_start_index 起、`score < min_score` 严格小于才换，单前端平分恒取 DP0；③eng_start_index = 组数 × client_index // client_count。
- late interaction：`vllm/v1/pool/late_interaction.py#L15-L36`，同 query key 按 crc32 取模固定到同一组；唯一的「看缓存选组」规则，只对池化模型。
- 计数链路：引擎 `core.py#L1856-L1888`（每步前后、有变化才报）、`#L913-L919`（external 不报）、`#L1233-L1262`（一步中间到达的请求停在输入队列）；协调器 `coordinator.py#L254-L278`（有变化满 100 ms 推、没变化 5 s 推、可能推 last_step_counts）；前端 `core_client.py#L1314-L1357`（整张覆盖 lb_engines；发送与 FIRST_REQ）。
- waiting 口径：`scheduler.py#L1797-L1799` 返回的是 (running, waiting + skipped_waiting)，经 SchedulerStats 字段顺序映射后与客户端的 (waiting, running) 一致。**给底稿 01 的一条 P3**：§A1 写「len(waiting), len(running)」，漏了 skipped_waiting，且顺序与函数返回值相反（不影响结论）。
- 部署方式：`config/parallel.py#L138-L150`、`engine/arg_utils.py#L1818-L1899`、`entrypoints/cli/serve.py#L71-L121`（含 multi-port external 变体、各方式默认 api_server_count、互斥报错）；elastic EP 互斥 `config/parallel.py#L794-L799`。
- 请求头：`entrypoints/openai/engine/serving.py#L397-L410`（非整数返回 None）；越界 `v1/engine/input_processor.py#L259-L267`（local_engines_only 时上限是本机组数）。chat、completion、batch chat、disagg serving 都读这个头。
- 版本：vllm-ascend 各钉点 Dockerfile 的 VLLM_TAG：2c59ff10 → v0.23.0，2ed6cbba → v0.26.0（568afb3a），baa023ad → v0.29.0（98dff2a8）。v0.26 与 v0.23 打分逐字相同，只多了打分后起点轮转；v0.29 改为 max(client_count × inflight, waiting + running) + waiting × 6 × max(0, kv_usage − 0.5)，inflight 对显式组号也计。vLLM main（6b858751，2026-09-21）这段与 v0.29.0 相同。vllm-ascend 四个钉点（db701c1f、2c59ff10、2ed6cbba、baa023ad）grep 选组相关符号，均无改动。
- GLM：node1 headless → internal（arg_utils 的 hybrid 推断要求非 headless）；`--api-server-count 1` 取自 01 §A0.1 进程账（标 [A]，本页没直接读教程命令）；prefix caching 默认关取自 prefix-caching 页与两机部署页。

**信息清单勾选（清单在 scratchpad `p5/dp-request-routing-facts.md`，共 24 条）。** 新建页没有旧版，清单取自 01 §A1 / §B1、依赖页和本轮源码核实。
- F1 入口链路：本页只讲选组一步；套模板、分词、构造 EngineCoreRequest 链接到 request-call-chain 与 one-request（进程分布、第 1 站）。
- F2–F4、F6、F8、F14、F15：「怎么挑」四步与 calc。
- F5、F12：GLM 一节（场景 M 只给结论并链接 concurrent-requests 第 1 站；R1 链接 one-request 第 1 站）。
- F7、F18、F19、F20：「计数表从哪来」四步与 calc。
- F9、F16、F17：「不走默认打分的几种情况」。
- F10、F11、F13：第一、二节（链接 data-parallel、concurrent-requests、balance-scheduling）。
- F21、F22：版本差异；F23：GLM 一节；F24：会报什么错。
- 全部 24 条在新页里有落点，无删除项。

**在依赖页加的一行链接（只加一行，其他不动）。**
- data-parallel.md「请求怎样派进某一组？」末尾（第 158 行）。
- balance-scheduling.md「为什么需要它」里讲前端只数条数那段之后（第 76 行）。
- vllm-engine-core.md「落到 GLM 双机」R1 结束那条之后（第 191 行），链到本页「计数表从哪来，为什么会过时？」。
- request-call-chain.md「七站分在三种进程里」DP 协调器那段之后（第 107 行）。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错；过程中一度与 large-scale-ep 的 alias「data_parallel_external_lb」重复，已从本页去掉）；`pnpm wiki:diagrams --check` 268 张一致，本页两张无建议项；`pnpm wiki:audit` 通过，本页 22 条来源行号全部有效。他页报错：lint 过程中出现过 `diagrams/lm-head-split.yaml` 的 spec 不合法（别的写手在改），未处理。

**待核 / 疑点。**
- 计数滞后的实际量级（一步时长、推送真实间隔）没有实测日志；正文写「一步的时长再加 100 ms 量级」，按源码时序推出，标 [D]。
- 「推送可能早于 A–D 进 waiting」依据协调器的 last_step_counts 与 5 s 重推逻辑推出，未实跑验证。
- vllm-ascend main 实际部署可能不配 v0.29.0；缺部署侧钉点。
- 多前端下 late interaction、在途计数的交互没展开。

**跳过。** 知乎参考打不开（refs 里记为 403），只看了本地图库的 amd-03 与 HOW-THEY-TEACH §3；没读教程命令块。

## P5 审查（09-29）

审查员：Opus 5.5，独立审查，只审不改页面（节标题按派发写 09-29，实际审于 10-02）。

**结论。** 8.5 / 10。P1 0 条，P2 1 条，P3 8 条。学习顺序通过。`pnpm wiki:audit` 本页通过（22 条来源行号全部有效；全库唯一失败是 lora.md 的 code-density，与本页无关）；`pnpm wiki:lint` 通过。本页不在 standard-pages.json 名单，手动跑 checkStandard 全项通过：4921 字，行内代码 0.2/千字，角标 0，calc 0.81/千字，相邻块 0，图先行，免责 2.6%，图宽合格。

**写作记录与信息清单。** 新建页，没有旧版。写手的「P5 写作记录（09-29）」在本文件第 3 行起，内容完整：结构、图、数字出处、源码核实、24 条清单的落点、四处入链、验证、疑点。清单文件 p5/dp-request-routing-facts.md 存在。抽查 F2、F4、F11、F15、F18、F21：F11 里「步长由忙的那组决定」那一半没写进页面（见 P2-1），其余都在。

**初学者测试。** 只读前两屏，能说清：开了 DP 以后，前端给每条新请求挑一组；请求头写了组号就直接去，没写就按 waiting × 4 + running 挑分数最小的组，挑定以后不换组。挑偏的代价是：请求排队；一组的 KV 池先用满；MoE 每一步都被最宽的那组拉宽；开头相同的请求在两组各算一遍。通过。

**学习顺序。** 是什么（两条路、A/B 例子、直觉图）→ 为什么要挑、四种代价（前缀缓存 calc 用示意数）→ 怎么挑（四步、A–D 手算）→ 计数表从哪来（流程图、E 的 calc）→ 变体（late interaction、多前端、三种部署方式）→ GLM 双机 → 常见误解 → 对照源码。GLM 数字只出现在 GLM 一节；第一节只有一个 6 对 3 的轻量例子，不算一上来就开算。通过。

**示意演算逐个手算。**
- 前缀缓存 calc：2,048 ÷ 16 = 128 块；同组时 2,148 − 128 × 16 = 100；分到两组时要算 2,148。对。
- A–D calc：B 看到 6 对 3，去 DP1，DP1 的 waiting 记为 1。C 看到 6 对 1 × 4 + 3 = 7，去 DP0，DP0 的 waiting 记为 1。D 看到 1 × 4 + 6 = 10 对 7，去 DP1，DP1 的 waiting 记为 2。反事实（A 也记账）：C 看到 10 对 7，会去 DP1。全对；起点为 0、严格小于才换，与源码一致。
- E calc：DP0 (2, 6) → 14，DP1 (2, 1) → 9，去 DP1。「A–D 还没开始算」这个前提正文写明了。对。
- GLM calc：12 × 4 + 6000 = 6048；7 × 4 = 28 → 32。N 在 DP1 时：6000 + 28 = 6028，DP0 的 48 → 64。下一步两种情形：52 → 64 配 28 → 32，或 48 → 64 配 32 → 32，都取 64；这一步相差 20 行。这些与 01 §B1 的表、§0 的图尺寸、concurrent-requests「再补到两组的最大值」的规则一致：能用图的组补到最大值，eager 组保留真实宽度，MoE 内部另行补齐。6028 和 N 在 DP1 时下一步的 64 是写手新推的 [D] 数，按同一规则复算无误。

**核心概念对照源码（vLLM 0fc695fc = v0.23.0，均亲自读过）。**
- 选组：core_client.py L1365–1426。请求带显式组号、或命中 late interaction 时，跳过打分，也跳过本地加 client_count。score = waiting × 4 + running。从 eng_start_index 起逐组扫，严格小于才换。eng_start_index = 组数 × client_index // client_count。reqs_in_flight 记下每条请求的归属。页面第 92–97 行、第 154 行全部对得上。
- 请求头：openai/engine/serving.py L397–410，值不是整数时返回 None；input_processor.py L259–267，越界时抛 ValueError（local_engines_only 时上限是本机组数）。对。
- 前端收推送：core_client.py L1314–1340 整张替换 lb_engines，并按 engine_ranks_managed 切片（hybrid 方式只取本机几组）；add_request_async 在 engines_running 为假时发 FIRST_REQ。对。
- 协调器：coordinator.py L254–278，有变化时按 100 ms 推，没变化时 5000 ms 推一次，可能先推 last_step_counts；L385 在新一步的数到来时，给上一步的条数拍快照。页面第 129 行、第 146 行对。
- 引擎：core.py L1856–1888，每一圈在 _process_input_queue 之后、算完这一步之后各报一次，数有变化才报；L913–919，external 方式不报。scheduler.py L1797–1799，waiting 的条数包含 skipped_waiting。对。
- late interaction：pool/late_interaction.py L15–36，用 crc32(query_key) % 组数 选组。对（缓存放在哪里，见 P3-4）。
- 部署方式：arg_utils.py L1818–1899，推断为 hybrid 要求起始组号为真值且不是 headless；external 方式遇到非 MoE 模型直接报错。serve.py L71–121，包含 multi-port 变体和各方式下 api_server_count 的默认值（internal 默认等于 dp_size）。对。
- 版本：vllm-ascend Dockerfile 里的 VLLM_TAG：2c59ff10 L42 是 v0.23.0，2ed6cbba L54 是 v0.26.0，baa023ad L46 是 v0.29.0；568afb3a、98dff2a8 分别是 v0.26.0、v0.29.0 的 tag。v0.26 的 L1413–1442 只多了一处：每打一次分，起点往后挪一组。v0.29 的 L1472–1543 改成 max(client_count × inflight, waiting + running) + waiting × 6 × max(0, kv − 0.5)，engine_inflight 对显式组号的请求也计数。页面误解第 4、5 条对。
- vllm-ascend 四个钉点（db701c1f、2c59ff10、2ed6cbba、baa023ad）里 git grep get_core_engine_for_request、DPLBAsyncMPClient、lb_engines、get_request_counts、_maybe_publish_request_counts：都没有覆盖。「vllm-ascend 没改选组」对。
- GLM：教程 GLM5.2.md 在四个钉点的双机命令里都写了 --api-server-count 1（baa023ad 另有一处其他部署示例写 16，不是双机那套）。node0 的起始组号是 0，是假值，不会被推断成 hybrid，所以是 internal。Balance Scheduling 没开、prefix caching 默认关，与 balance-scheduling、prefix-caching 两页一致。

**数字对底稿。** 12 对 7 → DP1、R1 平分落到 DP0、本地 +1、≥100 ms：对照 01 §A1 第 583–590 行，对。6048、28 → 32、两组的步长和宽度由忙的那组决定：对照 01 §B1 第 853–868 行，对。32 条 / 8192：对照 D 页「关键参数各管哪一步」，对。图尺寸 4…128：对照 01 §0，对。

**分工与链接。** ×4 的来由、MoE 为什么陪跑、引擎一圈的顺序、Balance Scheduling，都只写一句话再加链接，没有重讲。四处新入链都在：data-parallel 第 158 行、balance-scheduling 第 76 行、vllm-engine-core 第 191 行（带锚点）、request-call-chain 第 107 行；vllm-engine-core 和 request-call-chain 的 git diff 只有这一行（data-parallel、balance-scheduling 有别的写手的改动，本页只加了那一行）。wiki:lint 通过（含跨页锚点硬校验），本页出链的锚点全部能解析。

**对照源码。** 按纪律只 grep：五个 H3 齐全，顺序正确（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置）；「版本差异」里 v0.23、v0.26、main 都有，另外标了 db701c1f 和 v0.29。对照源码之上没有证据角标，行内代码只有 1 处。

**图。** 5193 没起（curl 返回 000）。按派发要求「不起停服务」，没有截整页，改用 Playwright 把两张 SVG 直接渲成 PNG 看（scratchpad 下 dp-request-routing-review-dp-request-routing.png、dp-request-routing-review-dp-request-routing-flow.png）。直觉图两条路清楚，没有压字、出框；流程图的 ①–④ 与正文四步对应。没有分镜动图。参考图看了 refs/amd-03（Router 在上方，把请求分到各列）：本页只借了构图，没有照抄。

### P1

无。

### P2

1. **挑偏的代价漏了「步长由更重的那组决定」，GLM 一节的结论说过头。**
   - 位置：第 75 行（代价第 3 条）、第 170 行加粗句、第 191 行「派偏的代价不在宽度上，而在额度上」那句、误解第 7 条（第 201 行）。
   - 问题：01 §B1 第 867 行和信息清单 F11 都写了「两组的步长和宽度都由忙的那组决定」；balance-scheduling 第 68 行写的是最重的那组定下这一步的时长；DyntraLB 的出发点也是各组每一步要读的历史不一样多。本页只讲了宽度对齐。宽度相同时，各组注意力要读的历史（条数 × 上下文长度）仍然不同，在 MoE 通信点上快的组要等慢的组。以场景 M 为例：N 进 DP0，之后每步是 13 条（含一段 6000 的上下文）对 7 条；N 进 DP1，是 12 对 8，最重那组更轻。所以「派偏的代价只在额度上」不成立。误解第 7 条只拿宽度来反驳也不完整：两组加起来的计算量确实不变，变的是哪组更重、这一步走多久。
   - 改法：
     - 代价第 3 条补一句：宽度一样，各组注意力要读的历史也不一样，这一步走多久由更重的那组决定；并链到 balance-scheduling「为什么需要它」。
     - GLM 第 191 行改成：宽度不变，但 N 所在那组之后每一步都要多读一段 6000 的历史，两组都按它的速度走；此外还占那组的额度。
     - 误解第 7 条改成：两组加起来要算的量不变、宽度也一样，变的是哪组更重、这一步走多久。

### P3

1. 第 48 行定义说默认前端有「两条路」，第 152 行又说 late interaction 也是默认前端里的一条规则。建议定义里写成「生成文字的请求有两条路」，或在第一节末加半句「池化模型另有一条按键固定组的路，见后面」。
2. 直觉图的计数表写的是 DP0 (0, 6)，没标明括号里先 waiting、后 running，正文要到第 139 行才标。建议图里写成「waiting 0，running 6」，或加一行小注。
3. 流程图里「算完这一步才收进 waiting」这行字悬在 DP0、DP1 两框之间，看不出指的是哪条箭头；① 只标在 DP1 的虚线上。建议把这行字贴到「输入队列 → scheduler」的箭头旁；① 两条虚线都标，或标在两条线汇合处。
4. 第 152 行说 late interaction 的查询缓存放在「引擎进程自己的内存里」，源码注释写的是 worker 进程本地内存。建议改成「那一组的 worker 进程内存里」。
5. 第 161 行 hybrid 的触发条件写的是「写了起始组号」，源码要求起始组号不是 0（0 是假值）；本机只有 1 组时还会自动改成 external 并打 warning。建议补上「非 0」，并在表下加半句说明。
6. 术语先用后讲：MoE 在第 50 行第一次出现，既没解释也没链接；decode、prefill、MTP、图尺寸在 GLM 一节（第 178–180 行）第一次出现，也没解释。建议各补一句白话，或链到 moe 页、concurrent-requests 的对应节。
7. 第 63 行先讲了请求为什么不换组，再链到 data-parallel 讲同一件事的那段，链接没有增加信息。可以删掉，或改链 concurrent-requests 的 KV 池一节。
8. aliases 缺 TERMS「router」一行里指定的「前端路由」；类名写的是 DPAsyncMPClient，实际打分的是 DPLBAsyncMPClient。建议补上「前端路由」「DPLBAsyncMPClient」。另外，concurrent-requests 和 one-request 的「第 1 站」是读者最常进来的入口，目前都没链到本页，可以各加一行（不是本批验收要求）。

**跳过。**
- 对照源码各 H3 的正文：按纪律只 grep。
- frontmatter 的 sources 区。
- 代码块、命令块。
- 整页截图：5193 没起，不起服务，只渲了两张 SVG。
- HANDBOOK 没读；TERMS 只 grep 了 coordinator / router 相关几行。
- 知乎参考没看，写手也记为 403。

## P5 修订记录（10-02）

按「P5 审查（09-29）」修，P2 1 条、P3 7 条照改，P3 1 条部分改（依据见下）。

**P2-1（已修）。** 三处：
- 代价第 3 条补「宽度之外还有时长」：宽度对齐了，各组要读的历史（条数 × 各自上下文长度）不同，最重的组定下这一步走多久，快的组在通信点上等它，链 balance-scheduling「为什么需要它」。
- GLM 一节：开头加粗句改成「派偏改变的是哪组更重——每一步走多久由它决定——以及排队和 KV 池的压力堆在哪组」；calc 后那段改成时长（13 对 7 vs 12 对 8）与额度两头，删掉「代价不在宽度上，而在额度上」的说法。
- 误解第 7 条改成：加起来的量不变、宽度一样，变的是哪组更重、这一步走多久。

**P3 逐条。**
1. 已修：开头加粗句改成「对生成文字的请求，vLLM 默认的前端有两条路」。
2. 已修：直觉图 caption 末尾加「计数表括号里的两个数，先 waiting 后 running」。
3. 已修：流程图的「算完这一步才收进 waiting」移进 DP0 框内（输入队列 → scheduler 箭头下方）；两条引擎虚线各加一个 ①。重渲 PNG 核过无压字。
4. 已修：late interaction 缓存改为「那一组 worker 进程的本地内存里」。
5. 已修：表里 hybrid 触发条件补「非 0 的起始组号」，表后补「本机只有 1 组时自动改 external 并打 warning」半句（链会报什么错）；「怎么开」的 hybrid 条同步补「非 0」。
6. 已修：MoE 首现加链接和一句白话（第一节）；decode / prefill 在 GLM 一节首现处加括注；MTP 补「multi-token prediction，模型自带的草稿层」；图尺寸改写成「启动时只按 4…128 几档宽度录了计算图，补到第一个不小于它的一档」。
7. 已修：删掉第一节末指向 data-parallel「请求怎样派进某一组」的括号链接（「为什么要挑」一节仍保留对该节的 ×4 链接，不损失入口）。
8. 部分改：aliases 补「前端路由」（TERMS router 行指定的叫法，查过无 dup）。**「DPLBAsyncMPClient」没加**：它已是 data-parallel.md 的 alias，lint 的 dup-alias 会报错；按范围纪律不动别的页的 frontmatter，是否把这个 alias 从 data-parallel 挪过来，留给主会话定。concurrent-requests / one-request 第 1 站的入链，审查自己标了「不是本批验收要求」，两页也不在本批授权改动名单里，未加。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错）；`pnpm wiki:diagrams --check` 271 张一致、本页两张无建议项；`pnpm wiki:audit` 通过（本页 22 条来源行号有效）。改后全文 7,563 字，其中教学正文 6,032（wc.py 口径）。

- **收尾清扫（2026-10-02）P3-8 alias 归属已改。** 按「单一出处 + 别页链接」：data-parallel.md 正文不讲 DPLBAsyncMPClient，只在 L158 链到本页讲选组；本页 L207 是讲它的唯一出处。故把 `DPLBAsyncMPClient` 从 data-parallel.md 的 aliases 移除、加进本页 aliases（紧跟 DPAsyncMPClient）。复跑 `pnpm wiki:lint` 退出 0（无 dup-alias），`pnpm wiki:audit` 退出 0、两页写作标准全 ✓。
