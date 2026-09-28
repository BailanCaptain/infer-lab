# engine-processes：P5 写作与独立审查记录

## P5 写作记录（2026-09-28，第 04 批，Opus 写手接 GPT 半成品）

### 接手状态

GPT 写到一半额度用完：页面只剩 6 个 H2、约 1,235 字教学正文，缺「对照源码」，正文有 7 个证据角标、免责句占 14%，并写着「不能推导进程总数」，与本批要求相反。本轮保留其中站得住的内容（角色≠进程、共享内存、执行器不只看卡数、状态归属表、Runner 持久状态、调试记录项、fork/spawn 差异），按标准六步重排并补齐。

### 改了什么

- 标题改为「引擎有哪几个进程：API server、EngineCore 与 Worker」；旧标题与旧别名留作 aliases（去掉与 vllm-v1-shape 重复的「执行器」）。
- 首屏：问题式 H2 + 一句话定义 + 重画的直觉图 `engine-processes.yaml`（三类进程边界；请求消息每条一次、清单每步广播、结果只由 Worker 0 回、Worker 间虚线卡间通信；左下单卡时 Worker 是 EngineCore 内对象）。
- 第二屏：拆进程换来什么、代价三样（打包且只发差量、状态分存、补丁/配置逐进程到位），用 R1 第一步清单「4 个 token + 15 个块号」作真实数（回链 one-request，不重算）；四行表区分角色/进程/rank/节点。
- GLM 段：双机进程账（含进程标题）、node1 为何 headless、协调器职责、每 EngineCore 8 个 Worker、全局 rank 编号；讲清「20」的统计口径。
- 新增「每个进程里存着什么」「执行器决定 Worker 是不是独立进程」（含 calc）「补丁和配置为什么要每个进程各做一遍」（含第二张流程图 `engine-processes-startup.yaml`，两处分支：fork/spawn、uni/mp）「进程怎么摆，直接决定要打哪些补丁」（EPLB）「排查时先认是哪个进程」「常见误解」「对照源码」五个 H3。
- 调用链不重复：一条请求穿过进程的路径、四条通道、报错字符串全部链接 request-call-chain。
- relations：删去指向 request-call-chain 的 builds-on（对方已指回本页，lint 报 relation-duplicate），加 glm-5-3-flash-two-node、platform-plugin-registration、vllm-engine-core、eplb。

### 数字取自哪里

- 20 个进程、node0 11 个 / node1 9 个、16 个占卡：底稿 01 §A0.1（依据 §A0「怎么走的」第 1–4 步）。
- world_size = 8、全局 rank = DP 组号 × 8 + 本机卡号、fork 8 个 WorkerProc：底稿 01 §A0 第 4、5 步。
- 请求入口、API server 先登记输出再发往引擎、按 waiting×4+running 选组：底稿 01 §A1；R1 第一步清单 {R1: 4}、15 块：§A2.4（块数推导回链 one-request 第 2 站）。
- 「20」的口径（本页新写）：§A0.1 数的是按角色拉起的进程。核对 `vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L138-L148` 与 `#L173-L253`：node0 单 API server 就在 vllm serve 进程里；node1 的 `run_headless` 拉起引擎后留在本进程 `monitor_engine_liveness()`，这个启动进程不在 §A0.1 表里。故按进程列表数 vLLM 自己的进程是 21 个；辅助进程与 EPLB 等特性进程也不在账内。**建议底稿 §A0.1 加一句口径脚注**（本轮按范围未改底稿）。

### 核心概念对照了什么

- `vllm@0fc695fc`：`v1/engine/core_client.py`（AsyncLLM 必须多进程、DPLBAsyncMPClient、InprocClient）、`v1/engine/core.py`（EngineCore.__init__ 加载通用插件、收发线程、run_engine_core 进程标题）、`v1/executor/multiproc_executor.py`（广播队列、每卡一个 WorkerProc、daemon=True、只读 output_rank、Worker 进程标题）、`v1/executor/uniproc_executor.py`、`config/parallel.py`（mp/uni/ray 默认规则，按 world_size_across_dp 判）、`utils/system_utils.py` + `envs.py`（默认 fork、强制 spawn 条件）、`plugins/__init__.py`、`engine/arg_utils.py`、`v1/worker/worker_base.py`、`v1/core/sched/output.py`（「请求资料缓存在每个 worker 进程、只发差量」原注释）、`config/scheduler.py`、`v1/engine/coordinator.py`、`config/vllm.py`、`v1/engine/llm_engine.py`。
- `vllm-ascend@db701c1f`：`__init__.py`（_ensure_global_patch 与 docstring）、`platform.py`（pre_register_and_update、check_and_update_config → init_ascend_config）、`worker/worker.py`、`utils.py`（adapt_patch 只是 import）、`ascend_config.py`（_ASCEND_CONFIG、未初始化报错、EPLB 环境变量断言）、`patch/platform/__init__.py`、`patch/__init__.py`、`patch_multiproc_executor.py`、`patch_balance_schedule.py`、`model_runner_v1.py`（EPLB 两个子进程、_update_states）、`eplb/core/eplb_worker.py`、官方 `patch.md` 设计文档；官方 GLM 教程 `0576b647`（未设 VLLM_WORKER_MULTIPROC_METHOD、未开 EPLB）。
- 版本：vllm-ascend `2ed6cbba`、`baa023ad` 三入口与 EPLB/调度器替换行号逐一 grep；上游 `vllm@568afb3a`（v0.26.0）核对执行器规则、fork 默认、单 API server、headless、output_rank、进程标题。main 配套上游未检出，列入待核。

### 对旧版的修正（有源码证据）

1. 旧版「Main 打过的补丁不会被子进程继承」只在 spawn 成立；默认启动方法是 fork（`envs.py:892-894`），fork 子进程出生时带着父进程已换好的名字。改为按启动方法分情况讲。
2. 旧版「一颗 NPU 就用 uni」改为「整个服务（含所有 DP 组）只有 1 张卡」（`parallel.py:845-890` 先按 world_size_across_dp > 1 定 mp）。
3. 旧版「请求在 Main 里只待一下」「在 Worker 里算完就丢」改为：API server 登记到请求结束；Worker 缓存请求资料与持久批次，直到结束名单通知释放（`output.py:181-212`）。
4. 旧版「EngineCore 那条路存在是因为只靠 Main 那一次换不掉调度器」限定为 spawn 情形；fork 时那一步是空操作。

### 旧版信息清单勾选

清单与逐条勾选见 scratchpad `p5/engine-processes-facts.md`：F1–F36、G1–G8 全部有去向。删除 1 条（F5 旧 Qwen 单卡例子，固定部署已换成 GLM 双机）；挪走 1 条（F33 分词/process_inputs 调用细节 → request-call-chain）；修正 5 条（F12、F14、F15、F17、F21，另 F3/F10 加准条件）；其余原样或扩写保留。

### 验证

- 写作标准（本页不在名单内，用 `scripts/wiki/standard.ts` 的 `checkStandard` 手动对本页强制）：教学正文 5,316 字（改前 p4-checkpoint 1,971 字，GPT 半成品 1,235 字），行内代码 0/千字，对照源码之上角标 0，calc 1 个（0.19/千字），无相邻块，图先行，免责句 0%，图宽 ≤900：PASS。全页角标 25 处，C 级 16 处（64%）。
- `pnpm wiki:lint`：通过（本页 0 条；全库另有 22 处待留意，属其他页）。
- `pnpm wiki:diagrams --check`：168 张图与 spec 一致，本页两图无提示。
- `pnpm wiki:audit`：本页 49 条来源中 48 条本地行号有效，1 条教程 URL 未联网验证；全库通过。
- 未截图、未起服务，浏览器验收留给审查环节。

### 待核（同页末）

官方镜像是否另设 VLLM_WORKER_MULTIPROC_METHOD；实机进程列表里的辅助进程个数；spawn 时 EngineCore 进程里 Ascend 配置缓存由哪一步建立；main 配套上游 vLLM 未检出。

## P5 审查（09-28）

审查员：Opus 5.5 独立审查，只审不改页面；未启动子代理。对象为工作区里的 `wiki/concepts/engine-processes.md`（361 行，未提交），旧版为 `p4-checkpoint`（=HEAD `14591fd4`）。

### 读了什么、跳过了什么

- 读：frontmatter 第 59–83 行（relations 等），正文第 85–266 行，分 4 段读，每段不超过 80 行。
- 跳过：frontmatter 来源清单第 9–58 行，由 audit 校验；「## 对照源码」第 267–361 行的正文只用 grep 核对；两个 wiki-diagram 代码块只看了 yaml 里的文字标签。没有读取被拦。
- 「对照源码」grep 结果：五个 H3 齐全，顺序正确（269 怎么开 / 306 会报什么错 / 321 开销和什么时候别开 / 327 版本差异 / 342 源码位置）。「版本差异」第 329 行的表头同时列出 v0.23、v0.26rc、main。

### 1. 初学者测试

只读前两屏后，我的一句话是：vLLM 把一个推理服务拆成三类进程。API server 负责收请求、分词和反分词，EngineCore 每一步做调度，Worker 每卡一个、负责跑模型。三类进程的内存互不共享，只靠消息交接。这样拆的好处有两条：CPU 上的杂活不会挡住调度；每张卡对应通信域里的一个成员。代价有三条：交接必须打包成差量消息；同一条请求的状态分三处存；补丁和配置要在每个进程里各做一遍。**结论：通过。**

### 2. 核心概念（对照 vllm@0fc695fc、vllm-ascend v0.23）

| 页面说法（行） | 判定 | 证据 |
|---|---|---|
| 请求消息每条请求只发一次（97） | 对 | `core_client.py:871-874`、`:1344-1351`：`add_request` 只发一次 `EngineCoreRequestType.ADD` |
| 每一步把清单广播给所有 Worker，写一次、各读一次（98、176） | 对 | `multiproc_executor.py:151-157` 建 `rpc_broadcast_mq`；`:374` 只 enqueue 一次；`:971-994` 每个 WorkerProc 各自 dequeue |
| 结果只由 Worker 0 回传（99） | 在官方部署下对，但缺条件 | `:307-317` 用 `unique_reply_rank=self.output_rank`；`:495-509` 算出 `output_rank = world_size − tp×pcp`，GLM 下为 8−8=0，底稿 03:189 也是这么推的。**例外有两种**：开了 KV connector 时 `kv_output_aggregator` 非空，`:361-365` 把 output_rank 置为 None，所有 Worker 都回传再汇总（`core.py:159-160`）；PP>1 时回传的是最后一段 PP 的 TP0，不是 0 号 |
| 单卡时 Worker 就在 EngineCore 进程里（103、175、195） | 对 | `parallel.py:845-890`：`world_size_across_dp > 1` 用 mp，`world_size == 1` 用 uni；`uniproc_executor.py:48-68` 在本进程里 `WorkerWrapperBase` → init_device → load_model；执行器在 `EngineCore.__init__` 里创建（`core.py:122`） |
| DP2×TP1 也用 mp，因为看的是整个服务的卡数（180） | 对 | `parallel.py:501-504` `world_size_across_dp = world_size × dp` |
| EngineCore 另开两个收发线程（107） | 对 | `core.py:944`、`:956` |
| 首次调度发整份 prompt，之后只发差量，结束名单通知删除（111、113） | 对 | `sched/output.py:31-44` NewRequestData、`:112-126` CachedRequestData（非 PP 时 new_token_ids 为空）、`:212` finished_req_ids |
| 离线接口关掉多进程后只有 1 个进程；异步引擎必须多进程（196） | 对 | `core_client.py` 的 `make_client`：asyncio 模式且非多进程时 `NotImplementedError` |
| 默认 fork；强制 spawn 的条件（206-209） | 对 | `envs.py:892-893`；`system_utils.py:126-154`；vllm-ascend v0.23 全仓 grep 不到 `VLLM_WORKER_MULTIPROC_METHOD`/`spawn`，没有另行强制；教程 `0576b647` 没有设这个变量 |
| 进程标题、要装 setproctitle、单 API server 不改标题（130-139） | 对 | `system_utils.py:184-198`；`multiproc_executor.py:1015-1030`；`core.py:1125-1135`；`coordinator.py:152`；`serve.py:146-148` 在本进程里 `run_server` |
| node1 headless 的启动进程不退出，留下来监视引擎（149） | 对 | `serve.py:235-253` `monitor_engine_liveness()` |
| 协调器只在 rank 0 起；MoE 时做 wave 协调（143） | 对 | `v1/engine/utils.py:1087-1095` |
| 四个插件入口里有三个会先确认全局补丁已打；docstring 里写明的理由（221） | 对 | vllm-ascend v0.23 `__init__.py:21-35`、`:44-75`；`setup.py:545-550` |
| API server 先加载插件，再调用平台钩子打全局补丁（217） | 对 | `arg_utils.py:2585`、`:2597`；`platform.py:184-188` |
| Worker 在构造函数一开始打补丁，然后登记算子、建配置（219） | 对 | `worker/worker.py:107-120` |
| balance 补丁无条件换掉调度器类；入口函数只在开启时才走昇腾循环（223） | 对 | `patch_balance_schedule.py:688-692`；`db701c1f` 的第 717-718 行 |
| EPLB 起两个子进程、daemon 补丁、由环境变量打开、配置断言（235-242） | 对 | `eplb_worker.py:347`、`:407`；`patch/platform/__init__.py:47`；`patch_multiproc_executor.py:199`；`ascend_config.py:887-889` |

**结论：核心概念没有讲错**，旧版里的 4 处错误都已改对（见写作记录「对旧版的修正」，我逐条复核成立）。问题只在两处：一处表述过满，一处缺条件，见 P2-1 和 P2-2。

### 3. 数字

- 20 个进程（node0 11 个、node1 9 个、占卡 16 个）与底稿 01 §A0.1 第 88-97 行一致。16 次 Worker 补丁、一组 8 张卡、全局 16 张卡的推导也都对得上。
- **「20」的统计口径（写手自报的疑点）**：底稿 §A0.1 只写了「合计 20 个进程，其中 16 个占卡」，没有写口径。§A0 第 61-62 行只说 node1「不建前端、不建协调器，只起 1 个 CoreEngineProcManager」，没有提启动进程会留下。§A1 第 547-601 行 grep 不到进程数和口径。页面第 147 行写「这个数出自主线底稿的进程账，数的是 vLLM 按角色拉起来的进程」，这等于把一个底稿没写的口径归到了底稿名下。「21 个」是页面新写的数字，出处在本页对照源码第 283 行 [C3]，我按源码核过，数字成立。但按单一出处原则，这个数应当先进底稿，所以记为 P2-4。**建议在底稿 §A0.1 第 97 行后补一句**（本轮没有改底稿）：

  > 口径：按角色计，API server、DP 协调器、EngineCore、Worker 各算一个。node0 的 API server 就是执行 `vllm serve` 的那个进程（`--api-server-count 1`，`vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L146-L148`）。node1 执行 `vllm serve --headless` 的启动进程在拉起引擎后停在 `engine_manager.monitor_engine_liveness()`（`#L235-L253`），既不退出，也不承担任何角色，所以不计入。按进程列表数，vLLM 自己的进程是 node0 11 个、node1 10 个，合计 21 个。Python 标准库按需另起的辅助进程，以及 EPLB 等特性另起的进程，也都不计。`[C]`

- 顺带确认：教程第 291 行 node0 带 `--api-server-count 1`，还带 `--data-parallel-start-rank 0`，在 `serve.py:105-109` 下也会得到 1。`arg_utils.py:1888` 因为 start_rank=0 为假，不会推断成 hybrid LB，所以仍由 node0 的 API server 在两组之间分配。页面第 141 行成立。
- R1 第一步「4 个 token + 15 个块号」与底稿 §A2.4 第 669-670 行一致，但表述有问题，见 P2-3。

### 4. 有没有丢信息（按旧版 H2 逐条对照）

| 旧版 H2 | 新版去向 |
|---|---|
| 先数一数：跑起来有几个进程（Qwen 两颗 NPU、4 个进程） | 示例换成 GLM 双机的 20 个进程；「超过一颗卡就每卡一个进程，只有一颗时住进 EngineCore」这条规则保留在执行器一节和「单卡 vllm serve：2 个进程」里。换例子是有意为之，不算丢。**丢了一点**：旧版 Main 的「决定用哪个硬件平台、把后面几个进程拉起来」，新版进程表里的 API server 那一行没写（见 P3-4） |
| 每个进程里住着什么 | 扩写成「每个进程里存着什么」加代价一节；「清单几乎全是整数，为跨进程设计」保留在第 111 行 |
| 只有一颗 NPU 时少一个进程 | 保留并扩写（Ray、DP 合计、手动指定） |
| 那条请求在四个进程里各是什么样 | 保留，并改掉了旧版的两处错误（「在 Main 里只待一下」「在 Worker 里算完就丢」）；Qwen 专有的线性注意力状态随换例子一起删掉 |
| 为什么补丁要分三条路送 | 保留，并按 fork/spawn 改对；三个入口和「打过没有」的标记都在 |
| 进程怎么摆，直接决定要打哪些补丁 | 保留并扩写（两个子进程、由环境变量打开、配置断言） |
| 排查时先认进程 | 保留并扩写（日志前缀和代码归属分开看） |
| 常见误解（4 条） | 4 条都在，其中 2 条改准了条件，另外新增 4 条 |

旧版的 aliases 全部保留。relations 里的 `one-request` 被删了，而 one-request 也没有反向指回本页，见 P3-3。

### 5. 单一出处（request-call-chain）

一条请求逐站经过哪些函数的七站链没有在本页重讲：第 157 行、第 254 行都链到 request-call-chain 对应的节，结论通过。重叠的有两处，都属于进程模型的事实，可以接受，但应当加回链：第 107 行「两个收发线程」与 request-call-chain 第 125 行重叠；第 99 行「只读 Worker 0」与第 127 行重叠。第 95-101 行的五条消息讲的是「发什么、多久一次」，是直觉图的说明，没有和四条通道重复讲通道本身。

### 6. 链接、锚点、audit、写作标准

- 页内和指向本页的链接共 30 条，我用 `src/content/wiki/anchors.ts` 的 slugger 逐条解析，全部能解析。全库指向本页带锚点的链接只有 `platform-plugin-registration.md:143` 一条，目标 `#补丁和配置为什么要每个进程各做一遍` 存在。
- `pnpm wiki:audit`：exit 0，全库通过。本页 49 条来源里，唯一的提示是教程 URL「raw 未定位同版本完整引用」，这只是提示，不是失败。本页不在 `standard-pages.json` 名单里，所以我用 `measureStandard`/`standardProblems` 对本页单独跑了一遍：5,322 字，行内代码 0，角标 0，calc 1 个（0.19/千字），没有表格与 calc 相邻，图在前，免责词 0。问题数 **0**。
- 浏览器：用 Playwright 打开 `localhost:5193/#/wiki/engine-processes`，H1 正确，两张图都渲染成 900px 宽，控制台 0 个错误。截图时发现直觉图上的竖向箭头穿过了区域标题，见 P2-6。

### 7. 打分：7/10

**P1：无。**

**P2**
1. **第 95 行「图里的箭头就是三类进程之间的全部交流」说过头了。** 双机 DP2 时，两个 EngineCore 之间每 32 步还有一次 gloo 对齐（`core.py:1823`、`:1928-1930`），协调器和 API server、EngineCore 之间也有 ZMQ 消息。改法：把「全部交流」改成「每一步都在走的几路消息」，再补一句「多个 DP 组时还有 EngineCore 之间的对齐和协调器的消息，见 [进程之间的四条通道](request-call-chain.md#进程之间的四条通道)」。
2. **第 99 行（以及图注）说「结果只由 Worker 0 回传」，没带条件。** 改法：写明「没有配 KV connector、也没开 PP 时」；把「Worker 0」写成「本组 TP 编号为 0 的 Worker（node1 那组就是全局 8 号）」；再补半句：开了 KV connector（例如 PD 分离）时，所有 Worker 都回传，由执行器汇总。
3. **第 111 行的 R1 例子和前一句矛盾。** 前一句说首次调度时整份 prompt 随清单一起发，而 R1 第一步正好是首次调度，清单里除了「算 4 个 token」和 15 个块号，还带着 4 个 prompt token id 和采样参数（`output.py:31-44`）。改法：把「只有」改掉，写成「R1 是第一次被调度，所以清单里带着它的 4 个 token id 和采样参数，外加『算 4 个 token』和新分到的 15 个块号；第二步起只剩『算 1 个 token』和新块号、候选 token」。底稿 §A2.4 第 670 行也建议补一句，说明 R1 走的是 `scheduled_new_reqs`。
4. **「20 个」的口径与「21 个」只在页面里有，底稿没有。** 第 147 行把「按角色计」说成底稿的口径。改法：在底稿 §A0.1 补上面那句建议的口径（等用户点头后由写手或主会话来改）；页面第 147 行改成「底稿进程账按角色计」，这样出处才对得上。
5. **术语问题。** vLLM 组件名只写了中文：「调度器」出现 7 次，「执行器」17 次，「DP 协调器」7 次，全页没出现一次 scheduler、executor、DPCoordinator 这些英文原名。TERMS.md:58 的规范名是 `scheduler`，request-call-chain 用的也是 scheduler。另外，「执行器」第 98 行就用了，第 173 行才给定义，属于先用后讲。改法：首次出现写「scheduler（调度器）」「executor（执行器）」，之后统一用英文；第 98 行给 executor 补一句定义，或者直接链到第 171 行那一节。
6. **直觉图上，三条竖向箭头穿过了「Worker 0 进程（卡 0）」「Worker 1 进程（卡 1）」两个区域标题**：线压在「0」「卡」上，截图 `ep-top.png` 可以复现。这是第一屏的图，影响清晰度。改法：在 `wiki/diagrams/engine-processes.yaml` 里把区域标题往左移，或者把箭头的 x 坐标挪开，让它们避开标题文字。

**P3**
1. 有几个术语先用后讲，也没加链接：第 98 行的「KV / 块」没链 kv-cache；第 132 行的「DP 组」在第 145 行才解释；第 143-145 行的 TP8、MoE 没链 tensor-parallel、moe；第 107 行的「通信域」没有解释。
2. 第 98 行的「清单」是本页自取的名字。建议首次出现时注明它对应 vLLM 的 SchedulerOutput（写纯文本，不算行内代码）；再补半句「每步其实发两次调用（execute_model 与 sample_tokens），见 [一步之内](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)」。
3. relations 删掉了 `one-request`，而对方也没有反向关系。本页第 111 行依赖 one-request 的 R1 和第 2 站，建议把这条关系加回来。
4. 进程表里 API server 那一行，没有写它在启动时负责「选平台、拉起协调器和 EngineCore」。旧版的「Main 选平台、拉起其余进程」这条信息只剩在补丁表和启动流程图里。建议在表格的「做什么」一栏补上半句。
5. 第 107 行「两个收发线程」、第 99 行「只读 Worker 0」和 request-call-chain 第 125、127 行重叠。保留可以，但要在这两处加回链，免得以后两边改漂移。

### 8. 仍待定

- 底稿 §A0.1 的口径脚注、§A2.4 的首次调度说明，是否要补、由谁来补，需要用户决定。
- 写作记录里的「待核」四项（官方镜像是否另设启动方法、实机辅助进程数、spawn 时 EngineCore 里的 Ascend 配置、main 配套上游）本轮没有查。

## P5 修订记录（09-28，按「P5 审查（09-28）」小修）

写手：Opus 5.5，只改本页、本页直觉图、底稿 01 §A0.1 与其修订记录；未启动子代理，未提交。

### 六条 P2

1. **「全部交流」**：改成「一组卡每一步都在走的几路消息」；图下新增一段写图上没画的几路：DP coordinator 与 API server、各 EngineCore 的消息，MoE 时两个 EngineCore 每 32 步的对齐、不同 DP 组 Worker 每步的对齐，链到 request-call-chain「进程之间的四条通道」。核对：`vllm@0fc695fc:vllm/v1/engine/core.py:1153-1164`（只有 MoE 的 DP 才用 DPEngineCoreProc，非 MoE 的 DP 组互相独立）、`:1930-1931`（每 32 步）；`vllm/config/vllm.py:561-580`（needs_dp_coordinator：DP>1 时为真，只有非 MoE 且外部负载均衡时例外）。据此同时改正了对照源码里「needs_dp_coordinator 在 DP>1 且模型是 MoE 时为真」这句（原句漏了非 MoE 内部负载均衡的情形）。
2. **「只由 Worker 0 回传」**：正文、图注、版本差异、源码位置四处都补上「没配 KV connector、PP 为 1」；写成「本组 TP 编号为 0 的 Worker（node1 那组就是全局 8 号）」；补两种例外（KV connector 时全部回传由 executor 汇总；PP>1 时是最后一段 PP 的 TP0）。核对：`multiproc_executor.py:361-365`、`:495-509`。
3. **R1 的「只有」**：改为「第一步正是它第一次被调度，所以清单里带着 4 个 prompt token id 和采样参数，外加『算 4 个 token』和 15 个块号」；补「第二步起只剩算几个 token（带 3 个候选时是 4 个）、有没有新块号、候选 token」，链到 one-request 第二圈（该节 decode 1 算 4 个 token）。
4. **「20 个」口径**：页面改为「主线底稿的进程账按角色计：API server、DP coordinator、EngineCore、Worker 各算一个，node0 的 API server 就是执行 vllm serve 的那个进程」，下面三条不计入的说明保留。底稿 01 §A0.1 第 97 行（「合计 20 个进程」）后原样补上审查拟好的口径句；底稿末尾追加「追加修订（2026-09-28）」一行。`git diff` 确认底稿只有这两处新增（+8 行），其他位置未动。口径句里的行号已按 `vllm@0fc695fc:vllm/entrypoints/cli/serve.py` 第 146-148、235-253 行重新核过。
5. **术语**：scheduler、executor、DP coordinator 首次出现写「英文（中文）」，之后统一用英文（正文、calc、对照源码的说明文字、summary 一并改）；executor 在第一次出现处（清单那一条）就给了定义并链到后文一节；该节 H2 改为「executor 决定 Worker 是不是独立进程」，页内两处链接同步改锚点（全库没有别处链这个锚点，已 grep 确认）。「清单」首次出现处注明 vLLM 里叫 SchedulerOutput。aliases 未动（旧中文别名保留作检索）。
6. **直觉图箭头压标题**：`wiki/diagrams/engine-processes.yaml` 把 Worker 框标题缩短为「Worker 0 进程」「Worker 1 进程」（按 textWidth 估 436–537、676–777px），卡号挪进框内条目（「卡 0 的模型分片」等）；下行箭头移到 x=600、840，回传箭头移到 x=560，「本步结果」右对齐到 552，「同一份清单」居中 720。三条竖箭头与两个标题的水平间距都 ≥23px。画布仍为 900×560。图中组件名同步改成 scheduler、executor；图注补上回传条件和「多 DP 组的消息没画」。

### P3

- P3-1：「KV / 块」链 kv-cache 并补一句块号的解释；DP 组在第一屏就解释（原先第 132 行先用、第 145 行才讲）；TP 在首次出现处解释并链 tensor-parallel，第 145 行的 TP8 也链上；MoE 链 moe；「通信域」补了定义。
- P3-2：清单注明 SchedulerOutput（纯文本），补「每步两次调用」并链 request-call-chain「一步之内」。
- P3-3：relations 加回 `one-request`（builds-on）。one-request 那边的反向关系不在本次范围，没改。
- P3-4：进程表 API server 一行补上「启动时选定硬件平台，拉起 DP coordinator 和本机的 EngineCore」。
- P3-5：「两个收发线程」「只读 TP 0 号」两处都加了到 request-call-chain「进程之间的四条通道」的回链。
- 顺带：新写的 DP 定义避开了「整套模型复制几份」的说法（GLM 开 EP16 时专家摊在 16 张卡上，不是完整副本，见底稿 01 修订记录里 request-call-chain P1-1 那一条）。

### 验证

- `pnpm wiki:diagrams`：写入 engine-processes.svg；本图无告警。`pnpm wiki:diagrams --check`：exit 0，168 张图与 spec 一致。SVG 里标题在 x=436/676、y=348，竖线在 x=560/600/840，viewBox 900×560。
- `pnpm wiki:lint`：通过，22 处待留意都在其他页（mark-flood），本页无。
- `pnpm wiki:audit`：exit 0，全库通过。
- 本页单独跑 `checkStandard`：5,873 字（改前 5,322），行内代码 0，角标 0，calc 0.17/千字，相邻块 0，图先行，问题数 0。
- 页内 34 条相对链接用 `src/content/wiki/anchors.ts` 的 slugger 逐条解析：0 条失效。
- 未截图、未起服务：按写手分工，浏览器验收留给审查环节（重点看直觉图标题与箭头是否还相交）。

### 仍待定

- 底稿 §A2.4 第 670 行「R1 走 scheduled_new_reqs」的说明本轮没补（本轮只允许动 §A0.1 与修订记录），是否补由用户决定。
- 写作记录里的四项「待核」仍未查。
