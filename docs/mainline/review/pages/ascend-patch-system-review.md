# ascend-patch-system 审查记录

## P5 写作记录（2026-09-28，第 04 批深改）

**改了什么。** 页面从「运行时适配：补丁、模型注册与算子替换」重写为「Patch 机制：昇腾怎样在运行时换掉 vLLM 的函数和类」，按先直觉后数字排成八节：patch 是什么（名字表 + 直觉图）→ 为什么非打不可、代价四条 → 两类 patch 各在什么时候、哪个进程里生效（代码流程图）→ 同一进程为什么只打一遍（幂等三层）→ 落到 GLM 双机（逐项列出导入与真正执行的 patch）→ 排查三步 → 常见误解 → 对照源码（五个 H3 固定顺序）。改前正文约 1,508 字，改后全文约 9,081 字、教学正文（对照源码之前）6,402 字。

**图。** 新增直觉图 `wiki/diagrams/patch-binding.yaml`：上方时间线「进程启动 → ① 平台注册时打 global patch → ② Worker 启动时打 worker patch → 请求到来」，下方两个框各画一个名字被改指向（调度器 Scheduler → BalanceScheduler；通信组 GroupCoordinator → GroupCoordinatorPatch），并注明各自换哪一类名字、在哪些进程里打。`patch-timing.yaml` 改为代码流程图：上下两条泳道（global / worker），入口 → 分流函数 → 「本进程导入过吗」分支 → 入口文件按条件导入 → patch 文件赋值；底部标出目录之外的零散入口，并注明之后用到它们的主线站。两图均过 `figureProblems` 与讲解图建议项（无代码名、文字段 ≤8）。

**数字与出处。** 逻辑块 640、KDA 组块 133120、调度器块 133120（lcm）取自底稿 [01 §0 全局常量](../../01-deploy-entry-schedule.md) 与 §A0.4，页面只写结论并链接 `glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token`，不重算；进程账（API server、2 个 EngineCore、16 个 Worker）取自 §A0「怎么走的」与 §A0.1；权重后处理被换成昇腾版本取自 §A0.7 第 8 步。patch 文件数（本部署与 v0.23 均为 28/24/7，v0.26 31/24/9，main 28/19/13）来自四个提交的 `git ls-tree`；本部署导入数（platform 23、worker 19、patch_v2 1）按部署条件逐行过两个入口文件数出，页面标 [D]。

**核实了哪些核心概念（对照 `vllm-ascend@db701c1f` 与 `vllm@0fc695fc` 源码片段）。**

- monkey patch 的含义与边界：替换只改模块字典里的那个名字；`vllm/v1/engine/core.py#L45-L52` 用 from-import 复制了 `resolve_kv_cache_block_sizes`，所以 `patch_kv_cache_utils.py#L811-L830` 末尾专门再改 EngineCore 模块那一份；`patch_process_weights_after_loading.py#L63-L64` 同时改 utils 与 base_loader 两处。
- 为什么要打 patch：扩展点只有平台插件、CustomOp 登记（`utils.py#L763-L768`，`CustomOp.register_oot`）、模型注册（`models/__init__.py#L4-L24`）；块大小校验、MLA 白名单、调度器类都没有扩展点。
- 两类 patch 的时机与进程：`adapt_patch` 四行分流（`utils.py#L563-L567`）；平台钩子第一行打 global patch（`platform.py#L184-L189`），vLLM 在参数解析时先 `load_general_plugins()` 再调钩子（`arg_utils.py#L2580-L2598`）；EngineCore（`core.py#L106-L109`）与 Worker 包装器（`worker_base.py#L230-L253`）各加载一次通用插件；`NPUWorker.__init__` 第一步 `adapt_patch()`，之后才登记 CustomOp、`init_ascend_config`、`super().__init__()`（`worker.py#L107-L130`）。
- 幂等：纠正了任务描述里「靠 `_ensure_global_patch` 保证」的说法——它只挡住三个通用入口在同一进程里的重复调用；平台钩子直接调 `adapt_patch`、不经过该标记，同一进程不重打靠的是 Python 导入缓存；最外层还有 vLLM `load_general_plugins` 的 `plugins_loaded` 标记（`plugins/__init__.py#L69-L82`）。三层都是进程内变量。
- 本部署逐项：global patch 九项（与 request-call-chain「第 2 站五处」一致：`_mamba_block_aligned_split` 只在 align 模式调用、本部署 none 不执行；BalanceScheduler 开关关着第一行交回上游，`patch_balance_schedule.py#L84-L88`、`#L661-L718`）；worker patch 五项，其中新发现两条：`patch_qwen3_next_mtp` 实际换的是通用的 `bind_kv_cache`，GLM 建 KV 张量时经过它（`model_runner_v1.py#L3936-L3952`，上游 NPU 抛 `NotImplementedError` 见 `vllm/v1/worker/utils.py#L494-L512`）；`patch_rejection_sampler` 虽然导入，但 `AscendRejectionSampler.forward` 调自己模块的函数，不经过被换的名字。API server 侧三项（chat 响应序列化、流式生成器、结构化输出校验）每条 chat 请求都经过但只在特定内容时改结果。
- 三版差异：`ls-tree` 对照 `2c59ff10`、`2ed6cbba`、`baa023ad`；入口机制三版一致；导入条件 v0.26 去掉版本判断、main 改用硬件能力表；调度器 v0.26 为 KVDeliveryScheduler → BalanceScheduler 两层（`2ed6cbba` `patch_balance_schedule.py#L165-L178`），main 把引擎入口替换挪到 `patch_engine_core`。

**不丢信息勾选。** 旧版取 p4-checkpoint（与改前工作区相同，73 行，A1–A21），另把 P4 重写前的 `0f97c8b`（177 行，B1–B22）中仍有效的机制事实一并列入。逐条清单与勾选结果见会话 scratchpad `p5/ascend-patch-system-facts.md`：A1–A21 全部落地（A13 的 CustomOp 细节移到源码位置表，A20 的「不代替实机」落到待核）；B1–B18、B20–B21 落地；B19 按 db701c1f 改写（本部署 BalanceScheduler 只看 balance 开关，旧版的 disable-preemption 条件属 v0.23 维护分支）；B22（Qwen3.6 贯穿例子）随 GLM 重建删除，由 GLM 的 640/133120 与 glm5_next_* patch 替代。

**单一出处。** 插件发现、过滤、激活只链接 `platform-plugin-registration.md#发现过滤激活`，三个通用入口补 global patch 链 `#三个通用入口先补一次全局补丁`；每类进程的入口、fork/spawn 继承、EPLB 换执行器只链接 `engine-processes.md` 两个小节；第 2 站五处与 traceback 认站链 `request-call-chain.md`；块大小推导链双机部署页。

**验证。** `pnpm wiki:lint`：本页无报错（全库剩 kv-cache / linear-attention 互指两条，非本页）；`pnpm check:content` 通过；`pnpm wiki:diagrams --check`：174 张图与 spec 一致（中途一次整库生成被他人未提交的 `linear-attention-flow.yaml` 挡住，本页两图改用同一渲染函数单独生成，之后整库检查通过）；`pnpm wiki:audit`：本页 61 条来源全部定位成功、无越界；本页未在写作标准名单内，另用同一 `checkStandard` 单独跑：教学正文 6,402 字，行内代码 0.2/千字，对照源码之上角标 0，calc 0，相邻块 0，图先行，免责 2.9%，图宽合格。未截图、未起服务（按 Opus 写手约定，浏览器验收由审查环节负责）。

**仍待核。** 见页末两条：KV 协调器在 GLM 布局下走哪一支、异步调度器类的父类（与 request-call-chain 同一待核）；torch.accelerator、MLA prefill 后端、npugraph_ex 三个 patch 是否在 GLM 路径上被调用，缺运行时证据。

## P5 审查（09-28）

独立审查员，只审不改页面。按 review-template 串行读取，未启动子代理。

**1. 初学者测试（只读第 85–124 行）。** 通过。我的一句话：patch 是 vllm-ascend 在每个进程启动后，把上游 vLLM 模块里某个名字改指向昇腾的实现，用来改上游没留扩展点的地方；代价是只对当前进程有效、已复制走的引用不跟着变、和上游版本咬死、调用栈里看不到「替换」这一步。

**2. 核心概念（对照 `vllm-ascend@db701c1f`、`vllm@0fc695fc`）。** 全部正确，没有讲错的地方。

- monkey patch（第 87–89 行）：正确。`utils.py#L563-L567` 的 `adapt_patch` 就是按参数 `from vllm_ascend.patch import platform/worker`；各 patch 文件末尾是模块属性赋值，例如 `patch_balance_schedule.py#L717-L718`、`worker/patch_distributed.py#L268`。from-import 这条边界（第 120 行）也核过：`vllm/v1/engine/core.py#L51` 把 `resolve_kv_cache_block_sizes` 复制成了本模块的名字，`patch_kv_cache_utils.py#L829-L831` 专门再改这一份；`patch_process_weights_after_loading.py#L63-L64` 两处都改了。
- 为什么要打 patch（第 104–124 行）：正确。三种正式扩展点、改指向和塞条目两种动作都对得上：`patch_speculative_config.py#L148` 先检查 `glm5_next_mtp` 在不在，再追加。
- 时机与进程（第 126–148 行）：正确。平台钩子的第一行就是 `adapt_patch(is_global_patch=True)`（`platform.py#L184-L188`），它由 `arg_utils.py#L2597`（在 `#L2585` 的 `load_general_plugins()` 之后）和 `#L1712` 调用。通用插件分别在 `core.py#L109`、`worker_base.py#L247` 以及 arg_utils 里加载。`vllm_ascend/__init__.py#L44-L75` 里三个入口（`#L45`、`#L55`、`#L65`）调 `_ensure_global_patch`，`register_model`（`#L72`）不调，这和 platform-plugin-registration 第 146、183 行「三个补、模型入口不补」一致。Worker 入口 `worker.py#L108-L110` 排在 CustomOp 登记、`init_ascend_config`、`super().__init__()` 之前。进程账（API server、2 个 EngineCore、16 个 Worker，node1 的 headless 启动进程也跑钩子）和底稿 01 §A0.1（第 88–99 行）一致。
- 幂等（第 150–162 行，写手的疑点）：**写手判断正确**。`_ensure_global_patch` 的 `_GLOBAL_PATCH_APPLIED`（`__init__.py#L18-L35`）只挡住三个通用入口；平台钩子 `platform.py#L188` 直接调 `adapt_patch`，不经过这个标记，同一进程不重打靠的是 `sys.modules` 导入缓存。最外层还有 vLLM 的 `plugins_loaded`（`plugins/__init__.py#L69-L77`）。页面写的三层，顺序和作用都对。先到的是通用入口，后到的平台钩子只是空走一趟（arg_utils 里 `#L2585` 在 `#L2597` 之前），这一点也对。另外两处自带保险也核过：`patch_pp_mtp.py#L32`、`#L76-L78` 的 `_PATCHED`，以及 worker `patch_distributed.py#L80` 的 `_hccl_registry_clearing_wrapped`。
- BalanceScheduler 属于「替换发生了，但开关关着时行为和原版一样」。替换无条件发生：`patch_balance_schedule.py#L718` 执行 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler`，上游 `config/scheduler.py#L168-L175` 在调用时才 `from ... import Scheduler`，所以同步调度拿到的就是 BalanceScheduler。开关关着时：`__init__` 不建 balance_queue（`#L71-L76`），`balance_gather` 直接返回（`#L78-L80`），`schedule` 第一行 `return super().schedule()`（`#L84-L88`），`run_engine_core` 转给 `_ORIGINAL_RUN_ENGINE_CORE`（`#L661-L665`）。开关默认值来自 `VLLM_ASCEND_BALANCE_SCHEDULING`，缺省为 `"0"`（`ascend_config.py#L78-L83`、`patch_balance_schedule.py#L47`）。本部署没有其他地方改 `scheduler_cls`：`platform.py#L680-L716` 里的重算调度器、动态批和 profiling 分块都没开。本页第 184、186、222 行和 request-call-chain 第 181、314 行的说法一致。异步调度时父类是谁，两页都记为待核，也一致。
- 本部署实际生效的清单：和 request-call-chain 第 306–314 行「第 2 站五处」逐项对上（KV 分组、KV 协调器、MambaManager、对齐切分、Scheduler 与引擎入口）。「其中两处不改变行为」（第 186 行）与调用链第 181 行一致。

**3. 数字。** 按入口文件的条件逐行数：platform 28 个文件导入 23 个，未导入的 5 个名称与原因都对；worker 24 个导入 19 个，另有 1 个 npugraph_ex 看安装情况，未导入的 4 个也对；patch_v2 共 7 个，只导入 `patch_use_v2_model_runner` 1 个，它的内容就是再导入一次 platform 的同名文件。依据是 `patch/platform/__init__.py`、`patch/worker/__init__.py` 去掉注释后的全部导入行。worker 的 24 个不含辅助模块 `_hccl_pg_registry.py`，口径没错。640、133120，以及 133120 = lcm(640, 4, 133120)，与底稿 01 第 24、44、173、667 行一致，页面只链接不重算，符合单一出处。

**4. 版本差异（ls-tree 抽查两处）。**
- 本部署与 v0.23 比：platform 本部署多出 `patch_glm5_next_config`、`patch_glm5_next_mamba_scheduler`，少了 `patch_async_swa_kv_lifetime`、`patch_shm_broadcast`；worker 和 patch_v2 两组的文件名完全相同。与第 275 行一致。
- v0.23 → main：worker 删 8 个（deepseek_mtp、draft_quarot、gqa_c8、minimax_m2_linear_attn、npugraph_ex_triton、process_weights_after_loading、qwen3_next_mtp、weight_utils），增 3 个（bind_kv_cache、kv_cache_dtype、step3p5）；patch_v2 增 6 个。main 的 patch_* 计数是 28/19/13。与第 268、277 行一致。
- 额外核了 v0.23 → v0.26：platform 删 7 增 10，worker 删 gqa_c8、weight_utils，增 moe_runner、step3p5；patch_v2 增 dflash、eagle。与第 276 行一致。但见 P3-7。

**5. 丢信息。** 整页已重写。`git diff` 删除了 35 行，旧 H2 共 5 个，逐个都能在新版找到落点；旧标题保留为 alias。旧清单抽查 6 条：A11（kv_lora_rank 判定 MLA，第 115 行）✓；A13（CustomOp 登记的 0.23.0 条件与键名，第 293 行）✓；A20（只对 db701c1f 成立，第 279 行）✓；B15（三个入口调、模型入口不调，第 134、155 行）✓；B7 部分丢失（见 P3-4）；**B19 丢失且造成 v0.23 格失准（见 P1-1）**。

**6. 链接与锚点。** 本页出链 16 个，目标文件都存在。按 `src/content/wiki/anchors.ts` 的 `headingSlug` 规则逐个核对锚点，都能解析。**入链有 1 条断链**，见 P2-1。另外，派生文件 `wiki/index.md` 第 52、152 行还是旧标题和旧摘要，要重跑 `pnpm wiki:build`，属于批次动作。

**7. 工具。** `pnpm wiki:audit` 退出码 0：本页 61 条来源全部定位，无越界、无无效 commit；本页不在写作标准名单内。`pnpm wiki:lint` 退出码 0，没有本页条目。手工核写作标准：第 84–229 行行内代码只有 1 处，远低于每千字 13 处；角标 0，calc 0，图在第一屏。

**8. 打分：8 / 10。** 核心概念、数字、本部署清单全部正确，也和相邻页一致；扣分都在边角。

P1
- **P1-1** 位置：对照源码 › 版本差异表第 271 行「调度器类被换成」一行的 v0.23 列。问题：该格写「同本部署」，但 v0.23 维护分支（`2c59ff10`）的 `schedule` 直通条件是 `not self._balance_enabled and not self._disable_preemption`（`patch_balance_schedule.py#L108`）。`_disable_preemption` 在 vLLM 0.23.0 且 `kv_role == "kv_producer"`，也就是 PD 分离的 P 节点上为真（`#L49-L53`），这时即使均衡开关关着也不回上游，而是走禁抢占分支。本部署 `db701c1f` 已经没有这段逻辑，在 patch 目录里 grep 不到 `disable_preemption` 和 `kv_producer`。旧清单 B19 记过这件事，写手按「不适用本部署」删掉了，但表里保留了 v0.23 列，结果成了丢信息加一格失准。改法：把 v0.23 格改成「BalanceScheduler，父类是上游 Scheduler；直通条件多一个：PD 分离的 P 节点（kv_producer）上即使均衡关着也不回上游，改走禁抢占分支」。

P2
- **P2-1** 位置：`wiki/concepts/platform-plugin-registration.md:127` 的 `[补丁与实现替换](ascend-patch-system.md#先理解运行时名称绑定)`。问题：旧 H2 已改名，锚点失效，点进去停在页首。改法：锚点改为 `#昇腾怎样把-vllm-里的函数换成自己的`（按 headingSlug 规则算出）。
- **P2-2** 位置：第 97 行和直觉图 `patch-binding.yaml`（第 12 行 sub、第 3 行 caption）。问题：第一屏用 BalanceScheduler 作 global patch 的招牌例子，只说「Scheduler 被改指向 BalanceScheduler」，没说本部署开关关着、它原样转回上游。初学者只读前两屏，会以为本部署的调度行为被改了，要到第 184、186 行才讲清。改法：第 97 行例子后加半句，例如「（本部署的均衡开关关着，BalanceScheduler 的 schedule 第一行就交回上游：名字换了，行为没变，见下文）」。图的 sub 可改成「BalanceScheduler（本部署直通）」，或在 caption 里补一句。

P3
- **P3-1** 第 97、98、106 行术语先用后讲：EngineCore 在第 97 行首次出现、没有解释，all_to_all（第 98 行）、MLA（第 106 行）也一样。首次出现时各加一个括注。
- **P3-2** 第 162 行说 fork 时「通用入口在那里直接返回」，不准确：子进程继承了 vLLM 的 `plugins_loaded = True`，是 `load_general_plugins` 直接返回，通用入口根本没被调用。改成「vLLM 的插件加载函数在那里直接返回」。
- **P3-3** 第 138 行说「构造函数的第一步就是调 adapt_patch」：实际第一句是 `COMPILE_CUSTOM_KERNELS` 的告警检查（`worker.py#L101-L105`）。改成「第一件实质工作」，旧清单 B5 就是这个措辞。
- **P3-4** 第 206 行把 torch.accelerator 的四个函数叫作「显存查询函数」，其中 `empty_cache` 是释放，不是查询（`patch_torch_accelerator.py`）；旧清单 B7 列出的四个函数名也没保留。改成「显存查询与释放函数（empty_cache、memory_stats、memory_reserved、reset_peak_memory_stats）」，也可以放进源码位置。
- **P3-5** 第 186 行「细节见 Balance Scheduling」：`balance-scheduling.md`（59 行）里没有「开关关着时第一行交回上游」，也没说本部署关着。改措辞，或在那一页做 P5 时补上。
- **P3-6** 第 128 行「也没有登记表」和第 124 行「登记四项」字面冲突，改成「没有运行时的登记表」。
- **P3-7** 版本差异：v0.26 的 platform 数 31 只数了 patch_* 文件，同目录另有 5 个 `kimi_k3_*` 辅助模块，没有说明口径。第 276 行「DeepSeek-V2 权重加载」实际是 `patch_weight_utils`，而 `patch_deepseek_v2` 在 v0.26 仍然存在，容易误读。建议括注文件名，并加一句计数口径。

**审查中跳过的内容。** frontmatter 的 sources 区（第 9–70 行）没读。「## 对照源码」只用 grep 核了五个 H3（顺序正确）和 v0.23/v0.26/main 三个版本名。为完成指定的版本抽查，用 grep/sed 读了版本差异表第 265–273 行（截断显示）、第 271 行整行，以及第 275–279、293、304–306 行，其余正文没读。两张图只抽取了 patch-binding 的文字标签。没有任何读取被拦。没做浏览器验收：模板没列这一项，写作记录说由审查环节负责，是否补做由主会话决定。

## P5 修订记录（09-28）

按上面「P5 审查（09-28）」逐条修订，未启动子代理。

- **P1-1 已改。** 先核源码：`git -C tools/repos/vllm-ascend show 2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py`，`#L49-L53` 的 `_disable_preemption_on_prefill_node` 在 vLLM 0.23.0 且 `kv_role == "kv_producer"` 时为真；`#L108` 的直通条件是 `not self._balance_enabled and not self._disable_preemption`；`#L230-L231` 在分配块失败时 `break`，不走下面的抢占。本部署 `db701c1f` 的同一文件 grep `disable_preemption|kv_producer` 计数为 0。改动：版本差异表「调度器类被换成」行的 v0.23 格改为审查给的写法；「本部署 vs v0.23」一条补一句同名 patch_balance_schedule 内容不同、P 节点上开关关着也不交回上游；「落到 GLM 双机」节第 186 行附近加括注指向版本差异。
- **P2-1 已改。** `platform-plugin-registration.md:127` 的锚点改为 `#昇腾怎样把-vllm-里的函数换成自己的`，该页只动了这一个链接。
- **P2-2 已改。** 首屏 ① 条 BalanceScheduler 例子后补一句「本部署开关关着，schedule 第一行就交回上游：名字换了，行为没变」，链接到「落到 GLM 双机」节；`patch-binding.yaml` 的 caption 末尾补同一句，重跑 `pnpm wiki:diagrams` 更新了 svg。
- **P3-1** EngineCore、all_to_all（链接 collective-communication#all-to-all）、MLA（链接 mla.md）首次出现处各加括注。
- **P3-2** fork 一句改为「vLLM 的插件加载函数在那里直接返回，通用入口根本不会被调用」（核 `vllm@0fc695fc:vllm/plugins/__init__.py#L69-L77`）。
- **P3-3** 第 138 行改为「第一件实质工作……（在它前面只有一条编译告警检查）」（核 `worker.py#L101-L110`）；同样的说法在第 98 行、第 142 行和版本表第 267 行一并改成「第一件实质工作 / 构造函数开头」。
- **P3-4** 第 206 行写出四个函数并分清释放、查询、重置（核 `patch_torch_accelerator.py#L4-L16`）；第 296、307 行的名称同步改为「显存函数」。
- **P3-5** 「细节见 Balance Scheduling」改为「开关打开后它怎样调度，见 Balance Scheduling」，不再暗示那一页讲了直通；balance-scheduling.md 本身未动。
- **P3-6** 改为「也没有运行时的登记表」。
- **P3-7** 版本差异补计数口径：只数 `patch_` 文件，v0.26 platform 另有 5 个 `kimi_k3_*` 辅助模块，worker 各版本另有 `_hccl_pg_registry.py`（四个钉点逐一 ls-tree 核过）；v0.26 worker 删除项括注文件名 `patch_gqa_c8`、`patch_weight_utils`（后者是借 DeepSeek-V2 模块的 KV scale 名称改写函数，核 `2c59ff10:.../worker/patch_weight_utils.py#L69-L73`），并注明 `patch_deepseek_v2` 在 v0.26 仍在。

**验证。** `pnpm wiki:diagrams` 更新 1 张（patch-binding.svg）；`pnpm wiki:diagrams --check` 退出码 0，175 张一致；`pnpm wiki:lint` 退出码 0，无本页条目（platform-plugin-registration 的 mark-flood 提示是原有的，与本次改的链接无关）；`pnpm wiki:audit` 退出码 0，本页 61 条来源全部定位。新增与改动的 5 个链接锚点按 `headingSlug` 规则脚本核对，全部能解析。未做浏览器验收，未重跑 `pnpm wiki:build`（index.md 旧标题属批次动作）。

## P5 复审（09-28）

快速复审，只核上一轮 P1、P2 的修订是否落实。读文件严格串行、未启动子代理，每次读源码不超过 20 行；没有读取被拦。

**评分：9.5 / 10。**（上轮 8）

### P1-1：落实

- 源码：`git -C tools/repos/vllm-ascend show 2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py`。L49–L53 的 `_disable_preemption_on_prefill_node` 在 vLLM 0.23.0 且 `kv_role == "kv_producer"` 时为真；L108 的直通条件是 `not self._balance_enabled and not self._disable_preemption`；L230–L231 在块分配失败时 `break`，不去抢占别的请求。本部署 `db701c1f` 的同名文件里，grep `disable_preemption|kv_producer` 计数为 0，schedule 在 L84–L87 只判断 `not self._balance_enabled` 就交回上游。
- 版本表 L271，v0.23 列（表头 L264 核过，第三列就是 `2c59ff10`）：落实。原文是「直通条件多一个：PD 分离的 P 节点（`kv_producer`）上即使均衡开关关着也不回上游，改走禁抢占分支」。
- 正文：落实。L275「本部署 vs v0.23」写明「P 节点上即使开关关着也不交回上游……块不够时停下而不是抢占别的请求」，和 L108、L230–L231 一致。「落到 GLM 双机」一节 L186 加了括注「v0.23 维护分支的这一行多一个条件，见[版本差异](#版本差异)」，锚点能解析（L261 是唯一一个「版本差异」标题）。

### P2：落实

- **P2-1**：`platform-plugin-registration.md` L127 的链接已改成 `ascend-patch-system.md#昇腾怎样把-vllm-里的函数换成自己的`。按 `src/content/wiki/anchors.ts` L8–L14 的 `headingSlug` 规则，本页 L85 的「昇腾怎样把 vLLM 里的函数换成自己的？」算出来正是这个锚点，而且全页只有这一个同名标题，能解析。全库指向本页、带锚点的链接只有这一条。
- **P2-2**：首屏 L97 的 BalanceScheduler 例子后面补了「本部署的均衡调度开关关着，BalanceScheduler 的 schedule 第一行就交回上游：名字换了，行为没变」，链接 `#落到-glm-双机哪些-patch-真的起作用` 能解析到 L164。`patch-binding.yaml` L3 的 caption 末尾也补了「本部署开关关着，名字换了，调度仍交回上游」，SVG 已含这句话，`pnpm wiki:diagrams --check` 对这张图没有提醒。

### 新发现

- 没有新的 P1、P2，也没有新的 P3。

### 验证

- `pnpm wiki:audit`：退出码 0，通过。本页 61 条来源、正文 20017 字 / 8 节；来源里只有 URL 未联网验证的提示，全库都一样。全库没有无效 commit、没有不存在的文件、没有行号越界。
- 本轮未核：浏览器实测。
