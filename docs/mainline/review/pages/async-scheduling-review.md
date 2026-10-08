# async-scheduling 审查记录

## P5 写作记录（2026-09-29，第 12 批深改）

**改了什么。** 页面从 p4-checkpoint 的 5 个平铺小节（约 1,271 字，全页 Han+Latin 口径）重写为 8 个正文 H2 + 常见误解 + 对照源码五个 H3（全页约 7,330 字，其中对照源码之上的教学正文 4,773 字；行内代码 0/千字，calc 4 个 0.84/千字，正文角标 0，免责句 0）。标题改为「Async scheduling：趁卡在算，先把下一步排好」，术语按英文原名 async scheduling，首现解释。正文 H2 依次是：是什么（直觉图）→ 为什么需要与代价 → 输出占位怎么记（示意数演算 + 三时刻表）→ Worker 在卡上补值（代码流程图）→ 投机解码下先按全接受排再改正（示意 calc）→ 在途结果收尾 → 换调度器要备异步版 → GLM 双机 R1 占位账。旧页的 `[A][C][D]` 正文角标全部移到页末「正文证据归档」，共 27 处，C 占 19（70%）。

**两张图。**
- `async-scheduling.yaml`（直觉图，重画）：同一条请求连走 3 步的成对时间轴，上同步、下异步，同一骨架只改 CPU 行；CPU 一段 1 格、NPU 一步 3 格；同步 13 格、NPU 在步间两次「空等」（斜线格），异步 11 格；右上角写 NPU 忙几格，底部一行注「排 2 时第 1 步的 token 未回：先记 1 个占位」引出下一节。
- `async-scheduling-flow.yaml`（新增，代码流程图，兼站点位置）：左 EngineCore 进程 ①–⑥（排、记账、提交、队列满否、等最老一批、销账、发回前端），右 Worker 进程 ⑦⑧（卡上补值、投机解码按全接受再改正、前向采样、采样值留卡上 / 拷贝流拷回），标第 2/3/4–5/6/7 站；pins 指向上游 async_scheduler / scheduler / core / gpu_model_runner 与 db701c1f 的 model_runner_v1、acl_graph。
- 两图都用本地 Playwright 把 SVG 渲成 PNG 自看过（scratchpad `p5/as-*.png`），无溢出、无压字；未起服务、未截站点页面。按 09-29 临时规定，本页**没有**新加 exchanges 分镜动图，演示过程用静态图 + 示意 calc。

**数字出处。**
- GLM 部署判定为开（MTP 在名单、padded drafter 未关、MultiprocExecutor 支持）：03 §A6 第 24 条；启动日志待核同 03 §A6 待核 2。
- 每步 4 个位置（1 + 3 候选）、R1 前三步接受假设（第 2 步接受 1、第 3 步全接受）、位置 6–9 与 6、7 被覆盖：03 §A6「R1 连着走两步 decode」表；01 §B2「场景 M 的一步」只作链接，整批推导统一引 concurrent-requests（C），本页不重算。
- R1 在异步下的调度器账（输出占位 1→5→4→8→4、已算 4→8→12→10→14）是本页按 `async_scheduler.py#L19-L67`、`scheduler.py#L376-L407/#L519-L535/#L1414-L1432` 逐步推出的 [D]；推导结果「已算 − 输出占位」= 4、6、10，与 03 §A6 按同步记的逻辑值一致，可作自检。
- FULL_DECODE_ONLY 回放前同步照常执行：03 §A6 待核 5（已定案）。
- 无异步加速实测数：页内明确写「格数只说明原理，不能当成本部署的加速比」，缺口进待核。

**核心概念对照。** 全部对照钉住版本源码逐条核：
- 上游 `vllm@0fc695fc`：`config/vllm.py#L497-L507`（并发批数）、`#L931-L1002`（显式硬失败 / 自动判定 / 日志，含自动分支不放行 draft_model）、`#L1017-L1027`（cascade attention）；`config/scheduler.py#L146-L188`（get_scheduler_cls）；`engine/core.py#L474-L482`（异步时不取回候选）、`#L484-L598`（批次队列、结构化输出推迟采样）；`async_scheduler.py#L19-L67`；`scheduler.py#L376-L407`（减法 + max_tokens 跳过）、`#L519-L535`（候选占位排进计划）、`#L1005-L1013`（已算当场前推、is_prefill_chunk）、`#L1414-L1432`（被拒各减）、`#L1953-L1971`（强制清空转丢弃计数）；`gpu_model_runner.py#L631-L633`、`#L1700-L1826`、`#L1462-L1482`（乐观接受数改正）。
- vllm-ascend `db701c1f`：`model_runner_v1.py#L2684-L2710`（写 −1、prev_sampled_token_ids）、`#L2569-L2582`（AsyncGPUModelRunnerOutput + 拷贝流）、`#L1608-L1628`（有效数单独拷回）、`#L1580-L1598` 与 `#L1233-L1245`（乐观 seq_lens 改正）、`#L1886-L1896`（候选拷回条件）、`#L2526-L2533`（PP 直发）；`acl_graph.py#L244-L258`；`platform.py#L702-L714`；`recompute_scheduler.py#L56-L69`。
- 版本：`vllm@568afb3a`（v0.26：占位按 num_sampled_tokens_per_step、max_in_flight_tokens、新 warning、DBO/dspark）、`vllm@84030bbe`（main 同 v0.26，max_concurrent_batches 不变）；vllm-ascend `2c59ff10` / `2ed6cbba` / `baa023ad` 的调度器类与 Worker 侧符号逐个 grep 过（SchedulerDynamicBatch v0.26 起移除；SRF/BJA 只在 v0.26 起有；DyntraLB 只在 main；`_pp_broadcast_prev_sampled_token_ids` 在 v0.26/main 消失）。
- 文档：`baa023ad` 的 dynamic_chunked_pipeline_parallel 教程 #L131 显式 `--no-async-scheduling`；feature_matrix #L16 的 Async Scheduling 行与列都没有不兼容标记；supported_features #L20 叫 Async output。

**旧版信息清单勾选**（清单在 scratchpad `p5/async-scheduling-facts.md`，旧版 A = 重写前 c60c4fa，旧版 B = p4-checkpoint）：
- 保留：A1–A14、A16–A28、B1–B12 全部在新版能找到（位置见清单）。
- 更正：A8c 候选拷回条件补上「采样要看已生成 token」；A10「没备的就是坑」改为「失去重叠」，依据是 v0.26 上游 warning 的原意（性能下降、异步失效），投机解码下的后果另列待核；A8e 图回放前同步补注「不看异步开关，但为异步而加」。
- 删除：A15 Qwen3.6 官方教程 FAQ（主线已换成 GLM，Qwen 例子整体退役；其通用结论「吞吐与时延开关各测」保留在误解和「什么时候别开」）；A14 的 UniProcExecutor 单卡细节（本部署 16 卡不走该执行器）。旧 Qwen 的 37 + 1 − 37 算例换成示意 8 + 1 − 8 与 GLM 的 R1 真实路径账。
- 新增：长度上限处不多排一步；投机解码下 Worker 先按全接受算长度、再用拷回的有效数改正；结构化输出推迟采样；R1 异步账与同步逻辑值差在途一步的 4；v0.26 起 max_in_flight_tokens；各版本调度器 Async 版的增删。

**参考图库。** 读过 refs/INDEX.md、HOW-THEY-TEACH.md 并看了 amd-04（朴素 PP：把「谁在干活、谁空闲」直接写在图上，再给利用率数字）。借了两点：直觉图用同一骨架成对对照（只动 CPU 那一行），并把「NPU 忙 9 / 13 格、9 / 11 格」直接写在时间轴上、正文 calc 再给 75% 与 99.7%。其余参考（集合通信、TP/EP 版式）与本页无关。

**验证。** `pnpm wiki:lint` 通过（本页 0 条）；`pnpm wiki:diagrams --check` 通过（246 张一致，本页两图无溢出 / 压字 / 待留意）；`pnpm wiki:audit` 通过（本页 36 条来源行号全部有效）；写作标准脚本本页 no standard problems。lint 另有 13 条他页「待留意」（如 vllm-ascend-repo-map 的 mark-flood），diagrams 有他页 advisory，均非本页，未动。

**疑点 / 待核（已写进页末）。** 启动日志确认开关与队列长度；开关异步的吞吐时延对照与每步 CPU 耗时、FULL 图回放前同步的耗时；普通抢占与取消路径的在途结果处理；只继承 Scheduler 的调度器在异步 + 投机解码下候选能否排进计划；v0.26/main 的 PP 直发新实现。

## P5 审查（09-29）

独立审查员，只审不改。**分数 8.5 / 10。P1 0 条，P2 2 条，P3 3 条。** 学习顺序通过；`pnpm wiki:audit` 本页通过（36 条来源行号有效）；`pnpm wiki:lint` 通过（本页 0 条）；`pnpm wiki:diagrams --check` 247 张一致。

**初学者测试（只读前两屏）。** Async scheduling：NPU 还在算第 k 步时，CPU 就把第 k+1 步排好、提交下去，省掉步与步之间 NPU 的空等；提前的只是计划，计算仍一步接一步。代价是多压一批在途、调度器要先给没回来的 token 记占位再销账，有些情况（结构化输出、图回放）还得等上一步。——能说清，通过。

**学习顺序。** 是什么（问题式 H2 + 一句话定义 + 成对时间轴直觉图）→ 为什么需要与代价（示意格数，无 GLM 数字）→ 怎么做（占位减法，示意数 8 的 calc + 三时刻表）→ Worker 补值 / 投机解码 / 在途收尾 / 换调度器 → GLM 双机 → 常见误解 → 对照源码。GLM 数字只出现在 GLM 节；第一节末尾没有堆链接；无分镜动图；无 meta 文本；对照源码之上 0 角标、0 行内代码；每节 ≤1 个 calc，表格与 calc 不相邻。

**截图。** 本地 Playwright 宽 1440 打开 `http://localhost:5193/#/wiki/async-scheduling`（未起停服务）：第一屏 `scratchpad/async-scheduling-review-first.png`（标题、定义、直觉图上半，布局正常）；流程图 `scratchpad/async-scheduling-review-flow.png`（无压字、无溢出，连线可读）。scratchpad = 580bfd6e 会话目录。

### 核心机制对照（全部对上）

- 开关与默认：`vllm@0fc695fc:vllm/config/scheduler.py#L146` 默认 `None`；`vllm/config/vllm.py#L933-L1002` 显式 True 走三条硬失败，None 走自动判定（pooling / 投机方法不在 Eagle+NgramGPU 名单 / `disable_padded_drafter_batch` / 执行器不支持，任一命中即关），末尾 info 日志。页 200 行四条件与之一致；`mtp` 在 `MTPModelTypes`（`speculative.py#L48`）⊂ `EagleModelTypes`（#L56-L58）。本部署开启依据与底稿 03 §A6 第 24 条（03 行 417-424）一致，且如实写「缺启动日志」。
- 批次队列 2 批：`vllm.py#L497-L507`（V1 且 PP=1 → 2）；`core.py#L192-L198`、`#L484-L598`（队列没满直接返回、满了 pop 最老一批；结构化输出推迟采样）。页 99、155、183 行正确。
- 占位与减法：`async_scheduler.py#L19-L67`（prefill 分块跳过、`+= 1 + cur_num_spec_tokens`、候选换 −1 串、回来按收到数减、`cache_blocks(computed − placeholders)`、强制抢占丢弃计数）；`scheduler.py#L376-L407`（减法与长度上限跳过）、`#L519-L535`、`#L997-L1015`、`#L1414-L1432`（被拒数对已算与占位各减一次）、`#L1953-L1971`。页 114–138、163、182 行全对。
- 自定义调度器：`scheduler.py` 的 `get_scheduler_cls`（#L168-L189）只在 `scheduler_cls` 为空时看异步；v0.26（`vllm@568afb3a:vllm/config/scheduler.py#L190-L197`）warning 原文确有「subclassed Scheduler … degraded performance」。页 188 行对。
- 昇腾 Worker 侧（`vllm-ascend@db701c1f`）：`model_runner_v1.py#L2686-L2712` 主机侧写 `[-1]`、`prev_sampled_token_ids` 留卡上；`#L2569-L2582` 异步输出对象 + 拷贝流 + 完成事件，同步路径直接返回（#L2536-L2545）；`#L1886-L1896` 候选只在结构化输出或 `output_token_ids` 非空时拷回；`#L1606-L1628`、`#L1233-L1245`、`#L1580-L1598` 乐观长度 + 有效数改正；`#L2528-L2533` PP 最后一段直发；`acl_graph.py#L244-L258` FULL 模式回放前 `synchronize`（ENPU / EAGLE 草稿合图跳过）；`platform.py#L702-L714` 两个只有同步版的调度器无条件改写 `scheduler_cls`。文档：`baa023ad` `dynamic_chunked_pipeline_parallel.md#L131` 显式 `--no-async-scheduling`；`supported_features.md#L20` 叫 Async output；`feature_matrix.md#L16` Async Scheduling 行无不兼容标记。

### 数字逐格手算

- 直觉图（`async-scheduling.yaml`）：同步 CPU 排1 0–1、收1排2 4–5、收2排3 8–9、收3 12–13，NPU 1–4 / 5–8 / 9–12，两段空等，共 13 格，NPU 忙 9；异步 排1 0–1、排2 1–2、收1排3 4–5、收2 7–8、收3 10–11，NPU 1–10 连续，共 11 格。每两步之间省 1 格，3 步省 2 格。与批次队列逻辑（排2 后队列满，等第 1 步；收1 后排3）吻合。
- calc 1：1+9+2+1=13；1+9+1=11；600÷801=0.749≈75%；600÷602=0.9967≈99.7%。CPU 4 格 > NPU 3 格时每步节拍 4、NPU 等 1（同步等 4），「比同步等得少」对。
- 示意占位：8−8=0；8+1−8=1；三时刻表 (8,1,8)→排后 (8,2,9)→回来 (9,1,9)，差 1；登记缓存 9−1=8。全对。
- 投机示意：加 1+2=3；被拒 2−1=1；收到 1+1=2；合计 3。对。
- R1 占位账（每步 1+3=4）：排1 4−0=4，占位 0→1，已算 0→4；排2 4+3+1−4=4，占位 1→5，已算 4→8；y₀ 回来 已知 5、占位 4；排3 5+3+4−8=4，占位 4→8，已算 8→12；第 2 步回来 拒 3−1=2：已算 12−2=10，占位 8−2−2=4，已知 5+2=7；排4 7+3+4−10=4，占位→8，已算→14；第 3 步全接受 已知 7+4=11，占位 4。逐行按 `_update_after_schedule` 条件与 `#L1414-L1432` 推过，全对。「已算 − 占位」4、6、10 与 03 表（行 437-462）和 one-request「三步的账」（行 497-498）一致；Worker 改正 3−1=2 格、实算位置 6–9、覆盖 6、7 与 03 一致。
- 场景 M：12 条 decode 每步各 +4、N 一步 6000（min(6000, 8144)）不分块、排完 +1，与 concurrent-requests 行 139-144 一致；整批推导只链接 C，没有重算。

### 与已改页口径

- vllm-engine-core：批次队列、R1 第 2 圈「1 个占位 + 3 个候选占位 = 4 个位置」（engine-core 行 187）一致；本页 99 行一句话 + 链接，没重讲。
- vllm-scheduler：减法一句话 + 链接（114 行）；「AsyncScheduler 按导入顺序继承 BalanceScheduler、闸门默认关」与 scheduler 行 135、216 同一口径。
- prefix-caching：本部署默认关（prefix-caching 行 79）与 228 行一致。

### 丢信息核对

整页重写，按写手清单（旧会话 scratchpad `p5/async-scheduling-facts.md`）抽查勾选：A7、A8a–e、A10、A19（262 行）、A20（264、301 行）、A21（240 行）、A25（289–291 行）、A26、A27（241、305 行）、B8（182 行 + 332 行待核）均在；A14 UniProc 单卡细节、A15 Qwen FAQ 删除理由成立。p4-checkpoint 74 行「评估时同时看吞吐、首 token 时延、生成间隔」的中性表述被改成带倾向的新说法，见 P2-1。

### 问题清单

**P1：0 条。**

**P2-1　常见误解最后一条加了无出处、且与本页直觉图相冲突的判断。** 位置：页面 242 行「省下的是步与步之间卡的空等，主要体现在吞吐上」。问题：「主要体现在吞吐上」在旧版和底稿里都没有出处（旧版 p4-checkpoint 74 行是中性说法；删掉的 Qwen FAQ 也不能作 GLM 页的依据）；本页直觉图演的正是同一条请求 13 → 11 格变快，上游 `vllm/config/scheduler.py#L146-L149` 注释也写「better latency and throughput」。读者会得到矛盾的印象。改法：删掉「主要体现在吞吐上」，改成「省下的是步与步之间卡的空等，上游注释说时延和吞吐都可能受益；具体到首 token 时延和生成间隔，要开、关各测一次」。

**P2-2　第二屏「代价」列表术语先用后讲。** 位置：页面 100–101 行。问题：投机解码（首讲在 146 行，此处无链接）、结构化输出（183 行才讲）、图模式回放（184 行才讲）、强制清空缓存（182 行才讲）都在初学者测试区首次出现、没有解释。改法：100 行「带[投机解码](speculative-decoding.md)（先草拟几个候选、下一步一次验证）时」；101 行每项加半句括注，或改成「下面三种情况会让重叠少一点：…（各一句话）」。

**P3-1　Worker、KV 块首现无解释。** 位置：79 行「借哪些 KV 块」、80 行「发给各个 Worker 进程」。改法：Worker 加括注「每张卡上一个、真正驱动 NPU 的进程」；KV 块链 [KV cache](kv-cache.md)。

**P3-2　流程图 Worker 列编号顺序。** 位置：`async-scheduling-flow.yaml`。⑦⑧ 排在 ⑥ 之后，但时间上 ⑦ 紧跟 ③（「提交」箭头）；caption 已说明，读图时仍容易按编号先走完左列。可在 ⑦ 旁加「接 ③」或改编号为 ③′。

**P3-3　图回放同步的先后。** 位置：184 行「先等…做完，再改参数、重放」。代码是 `synchronize` → `replay` 入队 → `_update_full_graph_params_if_needed`（`model_runner_v1.py#L2831-L2834`，非 ENPU 分支），图里的内核等参数更新事件。按「逻辑上先等、参数就位后内核才跑」讲可以接受；如要严谨可改为「先等上一步做完，再重放、更新这一步的参数」。

### 跳过与限制

- frontmatter 来源清单未读（由 audit 校验）；「对照源码」只 grep 了五个 H3 的顺序（怎么开 246 / 会报什么错 255 / 开销 268 / 版本差异 281 / 源码位置 307，齐全有序）和 v0.23、v0.26、main 均出现，另为核事实 grep 到 249、251、258–265、277–279、289–305 行的片段，未通读。
- 未跑 `git diff` 看删除行（整页重写），改用 p4-checkpoint grep + 写手清单核对。
- 参考图库未看（本页不涉通信原语与 TP/DP/EP，写手已读 INDEX 与 amd-04）。
- 164 行「到用的时候一般已经拷完，不会多等」出自代码注释（`#L1584-L1596`），不是实测，未单独核时序。

## P5 修订记录（09-29）

按「P5 审查（09-29）」逐条核实后全部接受，P2 修 2 条、P3 修 3 条：

- **P2-1 已改。** 核实 `vllm@0fc695fc:vllm/config/scheduler.py#L146-L149`：开关说明写的是异步能「避免 GPU 利用率出现空档，带来更好的时延和吞吐」，旧稿「主要体现在吞吐上」确无出处。常见误解末条改为：省下的是步间空等；上游说明写时延和吞吐都能受益，直觉图也是同一条请求 13 → 11 格；本部署具体省多少要开关各测、没有这组数。正文证据归档 [C1] 一句补上这条说明（角标总数不变）。
- **P2-2 已改。** 第二屏「代价」列表：投机解码首现加链接和一句解释；「有些活还是得等上一步」改为三种情况各半句解释（结构化输出、强制清空前缀缓存、图模式回放），再链到收尾一节。
- **P3-1 已改。** 五件杂活里 KV 块链到 KV cache 并加括注；Worker 首现加括注「每张卡一个、真正驱动 NPU 干活的进程」。
- **P3-2 已改。** 流程图 ⑦ 改为「⑦ 接 ③ · 第 3 站 · 准备第 k+1 步输入」，本地渲染 PNG 自看无压字。
- **P3-3 已改。** 核实 `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2826-L2836` 非 ENPU 分支是先 `run_model()`（包装里先同步、再重放）后 `_update_full_graph_params_if_needed`。收尾一节改为「先等卡上当前的工作全部做完，再发起重放、更新这一步的参数；图里的计算等参数更新好了才开始跑」。

**检查。** `pnpm wiki:lint` 通过（本页 0 条）；`pnpm wiki:diagrams --check` 247 张一致（本页两图无报错）；`pnpm wiki:audit` 通过；写作标准脚本本页 no standard problems（正文 4,951 字，行内代码 0，calc 0.81/千字，免责句 0）。
- 补记：修订后第一次跑 lint 出现过 1 处失败，失败项不在本页（输出里没有 async-scheduling），紧接着重跑已通过，判断是并行写手的页面改到一半；最终一次 lint、diagrams、audit 本页都是 0 报错。
