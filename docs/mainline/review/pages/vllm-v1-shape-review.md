# vllm-v1-shape 审查记录

## P5 写作记录（2026-09-28，第 08 批深改）

**改了什么。** 按「先直觉、后数字」重写为八节：vLLM 怎样把一条请求变成一步一步的计算（一句话定义 + 首图）→ 为什么拆成三种角色、代价在哪（相邻页四行分流表）→ EngineCore 的循环每转一圈做什么（代码流程图，标主线七站）→ 两道边界上每一圈交接什么 → 哪些东西启动时建好、哪些每一圈都在变 → vllm-ascend 接在这个形状的哪几处 → 放到 GLM 双机：R1 的一个 token 绕一圈 → 常见误解 → 对照源码（五个 H3 齐全）。教学正文由约 2,900 字增到约 8,300 字（不含空白与围栏，全文含源码区约 13,700 字；wiki:audit 计 15,218 字）；写作标准单页检查：4,700 字、行内代码 0/千字、正文角标 0、calc 0、图先行、免责 2.5%、图宽通过。全页证据角标 29 处：C 22、D 4、A 2、S 1（C 占 75.9%），全部在对照源码区。无 calc：本页的数都是别页推导过的结论，只写结论加链接。

**范围划分（按本批验收要点）。** 本页只讲整体形状：请求 → 调度计划 → 执行 → 结果回流这一循环里各组件的分工。Worker 启动细节只链接 npu-worker-lifecycle（页面 id，不带锚点，该页此刻另有写手在改）；块的借还只链接 vllm-kv-block-allocation；插件层五个扩展点只链接 vllm-ascend-overview；进程账链接 engine-processes；函数链与通道链接 request-call-chain。

**图。**
- `vllm-v1-shape.yaml`（重画，首图）：三个框分别是前端（管文字）、EngineCore（管进度，内含 Scheduler、Executor、按结果更新）、Worker（管张量，每卡一个）；箭头画「请求 → 调度计划 → 计划 → 张量/前向/采样 → 执行结果 → 新 token → 文字」的循环和「下一步」回环；每框底部写各自持有的状态。不写字节、不画 GLM 形状。
- `vllm-v1-shape-loop.yaml`（新建，代码流程图）：EngineCore 主循环一圈，含「有请求要算吗」分支、两次调用、按结果更新、结束还块、异步调度「队列没满先排下一步」虚线回环，圈号对应主线七站。
- 两张图宽 900；只用本页脚本单独渲染这两张 SVG，没有重写其他写手的图。

**数字取自。** 底稿 01 §A0.1（20 个进程、每个 EngineCore 管本机 8 个 Worker）；§A1（R1 4 个 token、两组打分为 0 进 DP0、请求消息字段）；§A2（第一步计划 `{R1: 4}`、15 个块号、12 个给 KDA、无草稿；A2.4 计划内容）；§A3（广播给 8 个 Worker、`int32[4]`、位置 0–3、`[4, 4096]`、每卡 8 KDA 头 / 8 MLA 头 / 18 专家、只有 output rank 回话）；§A7（decode 步最多 4 个 token、流式片段 1–4 个、生成 200 个 token 仍 15 块、结束名单随下一份计划通知 Worker、DP0 运行数减 1）。每卡权重 20.58 GiB 取自 two-node「每张卡上放了什么」。15 块、20 个进程、陪跑都只写结论并链接唯一出处（one-request、engine-processes、data-parallel），未重算。R1 = 4 个 token 按教学设定写，链接 one-request「示例请求 R1」。

**核心概念对照的源码（均按钉住 commit 实读）。**
- 循环本身：`vllm@0fc695fc` core.py L443-L473（`step`：schedule → execute_model(non_block) → get_grammar_bitmask → future.result → 为空则 sample_tokens → update_from_output）、L484-L598（`step_with_batch_queue`：队列未满先排下一批，满了或无可排才等最老一批）、L1223-L1275（忙循环：等输入队列、跑一步、放输出队列）、config/vllm.py L495-L506（异步调度 + V1 runner + PP=1 时队列长度 2）。
- 启动顺序：core.py L95-L222（先建 Executor，再 `_initialize_kv_caches`，最后建 Scheduler），L236-L317（查规格与可用显存 → 切块 → initialize_from_config），abstract.py L118-L126（initialize_from_config 之后紧接 compile_or_warm_up_model）。
- 两道边界：engine/__init__.py L83-L239（EngineCoreRequest / EngineCoreOutput(s)，msgspec 结构）；sched/output.py L31-L241（新请求完整资料、已缓存请求只发差量、注释写明为降低通信成本；finished_req_ids 通知 Worker 释放缓存）；outputs.py L231-L267（注释：ModelRunnerOutput 要序列化送回调度进程，张量代价高、偏好列表）；gpu_model_runner.py L1125-L1236（Worker 侧按 finished_req_ids 删除、按新请求建缓存）。
- Executor：abstract.py L37-L92（uni / mp / ray / external_launcher）、parallel.py L845-L890（未指定且 world_size_across_dp>1 默认 mp，world_size==1 默认 uni）、multiproc_executor.py L307-L400 与 L495-L510、L968-L995（广播一次，只读 output rank 的回话，其余 Worker 不回；超时与失败报错）、uniproc_executor.py L45-L96、worker_base.py L39-L159（固定调用集）。
- 昇腾侧：`vllm-ascend@db701c1f` platform.py L650-L662（worker_cls → NPUWorker）、worker.py L505-L525（init_device 建 NPUModelRunner，V2 仅在 use_v2_model_runner 时）、L599-L667（execute_model / sample_tokens）、model_runner_v1.py L287（继承 GPUModelRunner）、L748-L763（_update_states 先处理昇腾特例再调上游）、L2345-L2371（execute_model 暂存 ExecuteModelState 后返回 None）。
- MLA 出处按任务改指实际推理路径：glm5_next.py L2043-L2051（`AscendGlm5NextMLAAttention.forward` 直接调 `AscendIndexerKPoolMLAAttention`）→ ops/indexer_kpool_mla.py L67-L134（该层持有本层 kv_cache、`get_kv_cache_spec` 报 MLAAttentionSpec）。旧版引用的 glm5_next.py L2212-L2323 是 DecoderLayer 尾与 Model 初始化，不是注意力执行路径，已换掉。
- 版本差异：2c59ff10 / 2ed6cbba / baa023ad 的 worker.py 两次调用与 V2 选择逻辑一致；baa023ad 改由 hardware_profile 给默认 worker_cls（仍是 NPUWorker）、GLM 在 models/glm5next/；2c59ff10、2ed6cbba 无 GLM-5.3-Flash 代码（只有 GLM5/5.1/5.2 的文档与测试）。上游 vLLM 0.26.0（568afb3a）与 0.29.0（98dff2a8，main 分支的 vllm_version_is 目标）的 `step` 顺序与 0.23.0 相同，只多了 `_should_throttle_prefills` 参数。

**旧版信息清单勾选。** 两份旧版逐条列清单：P1–P22（p4-checkpoint）、Q1–Q16（P4 重写前 0f97c8b，Qwen 例子），清单与逐条去向见 scratchpad `p5/vllm-v1-shape-facts.md`。结论：
- 保留（多数展开或换成 GLM 数字）：P1、P3–P11、P13–P19、P21、P22，Q1、Q3–Q7、Q9、Q10、Q12、Q13、Q15、Q16。
- 挪走附链接：P2 / P12 的 A/C 第 3 轮算例 → prepare-inputs-flow「A/C 第三轮如何拼接」（concurrent-requests 已改用场景 M，旧版「沿用并发页」已失效）；P17 的入口细节 → vllm-ascend-overview；Q2 的「进程」定义 → request-call-chain / engine-processes；Q11 的块大小来历 → two-node「为什么一个逻辑块是 640 个 token」；Q14 的 InputProcessor / OutputProcessor / ZMQ → request-call-chain；旧版 output_processor 行号 → one-request 第 7 站。
- 删除并写明理由：P20 前半「双机组构造与跨机通信仍需核对」——已由 two-node 与 data-parallel 按底稿 A0.2 核实，不再列待核；Q11 的 Qwen 块大小 2048——Qwen 例子全库已弃用；旧链接 sources/glm-5-3-flash-baseline.md 按标准改链 two-node「部署前提」；「rank」一词本页不再使用。

**写作中纠正的一处。** 旧版（0f97c8b）写「只有前端手里有分词器」，对照 `vllm@0fc695fc` structured_output/__init__.py L70-L81 发现 EngineCore 的 StructuredOutputManager 也加载分词器（除非 skip_tokenizer_init），只用于编译结构化输出语法。新版改为「文字与编号的互转只在前端做；EngineCore 也加载一份分词器，只拿来编译语法表」。另外初稿写了「本机每个 Worker 都会回话」，核对 multiproc_executor.py L990-L994 后改为「只有 output rank（0 号）Worker 回话」。

**验证。** `pnpm wiki:lint` 退出码 0，本页无报错；`pnpm wiki:diagrams --check` 退出码 0（192 张图一致，本页两张图无布局问题、无劝告）；`pnpm wiki:audit` 退出码 0，本页 36 条来源行号全部有效（一条初稿越界的 patch_use_v2_model_runner.py L1-L21 已改为 L1-L20）；`pnpm check:content` 通过；单页写作标准检查与 21 个锚点链接检查全部通过。未截图、未起服务，浏览器验收留给审查环节。

**待核（已写在页末）。** 跨边界固定开销（两次广播、msgpack、单份回话）占一步多少时间缺实测；v0.26 / main 配套的上游 vLLM 按分支版本判断取标签核对，不是知识库钉住的 commit，镜像里实际安装的上游版本也待核。

**跳过了什么。** 任务提到的「依赖页 K、D」没有找到对应的页面代号说明（相关计划在 docs/plans/，按规定未读），按本批验收要点理解为 KV 块分配（vllm-kv-block-allocation）与 Data parallel（data-parallel），两页都只链接、未重算。

## P5 审查（09-28）

独立审查，只审不改。对象：工作区 `wiki/concepts/vllm-v1-shape.md`（未提交，相对 HEAD +239 / −61 行）与两张图 `vllm-v1-shape.yaml/svg`、`vllm-v1-shape-loop.yaml/svg`。源码按 `vllm@0fc695fc`、`vllm-ascend@db701c1f` 实读（Worker 选择另抽查 2c59ff10 / 2ed6cbba / baa023ad）。底稿：`docs/mainline/01-deploy-entry-schedule.md` §A0.1、§A1、§A2（A2.1、A2.3、A2.4）、§A3、§A7。

**跳过的段落**：frontmatter 来源清单（9–45 行，由 audit 校验）；「## 对照源码」正文（210 行起）只用 grep 核对 H3 结构和版本口径，其中 218、244、249、252、262、283–286 行是在 grep 结果里顺带看到的；底稿 §A2.2（块数，正被另一位修订者改）没有读；没有读 HANDBOOK、docs/plans/；没有截图，因为任务要求不启动服务、不占 5193 / 8790，图只核了 spec 和 `--check`。本轮没有读取被拦。

### 1. 初学者测试（只读前两屏，59–105 行）

能说清。我的一句话：vLLM V1 把推理服务拆成三类角色，绕成「排计划 → 执行 → 交回结果 → 排下一步」的一圈：前端负责文字和 token 编号互转；EngineCore 里的 Scheduler 每一步排计划、按结果更新进度，Executor 只负责传话；Worker 每卡一个，在卡上做前向和采样。代价有两笔：每一步的计划和结果都要打包，跨两道进程边界传递；同一份请求资料在 EngineCore 和 Worker 两边各存一份，还必须保持同步。

直觉图（三类角色 + 循环）出现在数字之前，第二屏讲为什么拆、三笔代价，顺序符合标准。

### 2. 核心概念逐条核对

| 位置 | 论断 | 依据 | 结论 |
|---|---|---|---|
| 61、69–73 | 前端分词和反分词；Scheduler 排计划、按结果更新；Executor 只传话；Worker 在卡上做前向和采样 | core.py L122（建 Executor）、L149（建 Scheduler）、L443-L473（`step`）；`async_llm.py` 与 `output_processor.py` 持有 tokenizer / detokenizer，`sched/scheduler.py`、`core.py` 里没有任何 tokenizer 引用 | 对 |
| 91、135 | 执行结果用列表而不是张量，便于序列化后送回调度进程 | outputs.py L232 注释、L234-L244（`req_ids`、`req_id_to_index`、`sampled_token_ids: list[list[int]]`） | 对 |
| 92、134、207 | 首次调度发完整资料，之后只发差量；靠结束名单通知 Worker 删缓存 | sched/output.py L31-L44（NewRequestData）、L112-L126（CachedRequestData：new_block_ids、num_computed_tokens）、L181-L241（num_scheduled_tokens、total、scheduled_spec_decode_tokens、finished_req_ids） | 对 |
| 108、116–120 | 一步 = schedule → 非阻塞 execute_model → 同时算语法屏蔽表 → 结果为空再调 sample_tokens → update_from_output | core.py L454-L470 | 对 |
| 117 | 第一次调用后 logits 留在 Worker，调用本身返回空 | model_runner_v1.py L2345-L2371（存进 ExecuteModelState 后 `return None`）；worker.py L599-L667 | 对 |
| 118、184 | 只有 0 号 Worker 回传 | multiproc_executor.py L313、L325（`unique_reply_rank=self.output_rank`）、L495-L507（world_size − tp_size，PP=1 时为 0） | 对（严格说是「最后一段流水线里 TP 的 0 号」，见 P3-2） |
| 122 | 异步调度 + PP=1 时队列长度为 2；不开异步调度时等于 PP 段数 | config/vllm.py L497-L507 | 对（与 request-call-chain 重复，见 P2-2） |
| 130 | EngineCore 进程也加载分词器，只用于结构化输出 | 见下文「分词器一条」 | 成立 |
| 139 | Executor 只能发固定几种调用，每一步只用「执行前向」和「采样」两种 | multiproc_executor.py L332（`execute_dummy_batch`）、L337（`take_draft_token_ids`）；core.py L1899（DP 组空闲时每一步调 `execute_dummy_batch`）；worker_base.py L39-L159 的接口远不止页上列的七种 | **不准**，见 P2-3 |
| 141–143 | 多卡默认 mp、单卡默认 uni、也可以选 Ray | multiproc_executor.py L131-L157（广播队列）；写手记录的 parallel.py L845-L890 | 对 |
| 149–154 | 启动顺序：Executor 拉起 Worker（init_device、load_model）→ 查缓存规格和可用显存 → 切块、initialize_from_config、预热 → 最后建 Scheduler | core.py L122、L132（`_initialize_kv_caches`）、L133、L149；L236-L290 里依次调 `get_kv_cache_specs`、`determine_available_memory`、`get_kv_cache_configs`、`initialize_from_config` | 对 |
| 158 | GLM 稀疏 MLA 走昇腾包里的实现，这一层自己持有 KV cache 并报出缓存规格 | glm5_next.py L2018（建 `AscendIndexerKPoolMLAAttention`）、L2043-L2051（forward 直接调它）；ops/indexer_kpool_mla.py L166（建 `IndexerKPoolMLACacheLayer`）、L79（`self.kv_cache`）、L121-L134（`get_kv_cache_spec` 返回 `MLAAttentionSpec`） | 对；MLA 出处已指向 GLM 实际推理路径。严格说持有张量的是它内部的 cache 子层，不影响教学 |
| 166–170 | 平台把 worker_cls 定为 NPUWorker；NPUWorker 建 NPUModelRunner；Runner 继承 GPUModelRunner，`_update_states` 先处理昇腾特例再调上游 | platform.py L650-L660；worker.py L505-L520；model_runner_v1.py L287、L748-L763 | 对 |
| 172 | EngineCore 进程里也跑昇腾代码（调度相关、块怎么切） | patch/platform/ 下的 patch_balance_schedule、patch_glm5_next_mamba_scheduler、patch_kv_cache_coordinator、patch_kv_cache_utils | 对 |
| 180 | 两组都空、打分都是 0 时，R1 进 DP0 | core_client.py L1398-L1426（从 eng_start_index 开始，取第一个最小分） | 对 |
| 249 | main 由硬件档案给默认 worker_cls，Xlite 分支保留 | baa023ad platform.py L1238-L1246；2c59ff10 L669、2ed6cbba L631 仍直接写 NPUWorker | 对 |

**分词器一条（写手的更正）成立。** `vllm@0fc695fc` core.py L133 在 EngineCore 初始化时建 `StructuredOutputManager`。structured_output/__init__.py L71-L81：只要 `skip_tokenizer_init` 为假，就调 `cached_tokenizer_from_config` 加载分词器。这份分词器只交给两处：语法后端（L132-L161，xgrammar / guidance / outlines / lm-format-enforcer）和推理段解析器（L109-L110，用来判断结构化输出从哪里开始约束）。前端的停止字符串匹配在 detokenizer.py L75-L89。有两处细节可以补，见 P3-1：不开结构化输出也会加载；用途不只是「编译语法表」，还包括推理段解析器。

核心概念没有讲错。139 行 Executor 调用集那一条不准，记 P2-3。

### 3. 依赖页核对（K = request-call-chain，D = glm-5-3-flash-two-node，另一依赖是 vllm-ascend-overview）

写手自述（本文件第 36 行）把 K、D 理解成了「KV 块分配」和「Data parallel」。对照结果如下。

- **K（进程、类、函数链）**：91 行的通道、100 行的导航表、122 行的两种循环分支都链到了 request-call-chain，进程账链到 engine-processes。但 106–122 行连同流程图 `vllm-v1-shape-loop`，把 request-call-chain「一步之内：EngineCore 给 worker 发两次调用」（135–152 行，图 `request-call-chain-step`）又讲了一遍：两次调用、logits 暂存、趁前向算屏蔽表、批次队列回环、第 N 步与第 N+1 步重叠，还单独推导了队列长度 2（request-call-chain 290 行、async-scheduling 44 行已有）。属于部分重讲，记 P2-2。
- **D（16 卡分组、每卡权重、显存预算、块）**：87 行的 20.58 GiB 链到 D「每张卡上放了什么」，176 行的分组链到 D「部署前提」，156 行「切出多少块」链到 D「启动时发生了什么」；没有另行推导字节数或块数，数字与 D 一致。但 frontmatter relations（46–51 行）没有列 D，反而列了 vllm-kv-block-allocation，这正是误读代号留下的痕迹，记 P3-5。
- **vllm-ascend-overview**：101、137、172 行都链到了它；164–172 行只讲了三句，没有重讲五个扩展点。合格。
- **误读代号后搬进来的内容**：data-parallel 只在 128、183 行各出现一句并附链接，合格。KV 块分配方面搬进了几句结论：181 行「5 个缓存组一起借，其中 12 个给 KDA」，185 行「之后的 decode 步大多不用再借块」，188 行「生成 200 个 token、总长 204 个位置，也仍然只占这 15 块」。这些属于 vllm-kv-block-allocation 和 one-request 第 2 站的内容，记 P2-1。数字本身按任务不判，见第 5 节。

### 4. 本批验收要点

- 链接分工：Worker 启动细节链 npu-worker-lifecycle（102、156 行）；块分配链 vllm-kv-block-allocation（104、188 行）；插件层链 vllm-ascend-overview（101、137、172 行）。分工清楚。147–156 行的启动四步只讲到角色层，没有展开 Worker 内部。
- MLA 出处：158 行和源码表 274 行指向 glm5_next.py L2043-L2051 → indexer_kpool_mla.py L67-L134，是 GLM 的实际推理路径，已核实。
- 本页是系统概览，没有混入压缩（索引器池化）的机制讲解。

### 5. 数字核对

| 页内数字 | 底稿 / 唯一出处 | 结论 |
|---|---|---|
| 每卡权重 20.58 GiB（87 行） | two-node 111、177 行 | 一致，已链接 |
| 20 个进程；每个 EngineCore 管本机 8 个 Worker（176 行） | 底稿 §A0.1 88–97 行 | 一致 |
| R1 = 4 个 token，教学设定（178、180 行） | §A1 582 行 | 一致 |
| 两组打分都是 0 → 进 DP0（180 行） | §A1 571 行 + core_client.py L1405-L1418 | 一致 |
| 4 个 token 编号、位置 0–3、`[4, 4096]`；每卡 8 个 KDA 头、8 个 MLA 头、18 个专家（182 行） | §A3 733–741 行 | 一致 |
| 一步 1 + 3 = 4 个 token；流式片段带 1–4 个 token（185–186 行） | §A2.1 638 行、§A7 788 行 | 一致 |
| 288 个路由专家（208 行） | two-node 63 行 | 一致 |
| 队列长度 2（122 行） | config/vllm.py L497-L507 | 数值对，但不是唯一出处（P2-2） |

除块数外，没有出处缺失或算错的数字。

**块数（只记位置、不判对错）**：本页出现这组块数的位置如下。
- 87 行「新借 15 个块号」；
- 181 行「新借 15 个块号（5 个缓存组一起借，其中 12 个给 KDA 的递推状态）」「15 个块号怎样按缓存组算出来」；同一行的锚点 `one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号` 也含 15，one-request 标题一改就会断链；
- 185 行「之后的 decode 步大多不用再借块」；
- 188 行「它的 15 个块号一次还回」「即使生成了 200 个 token，总长 204 个位置，也仍然只占这 15 块」；
- 195 行表格「手里 15 个块号」。

供修订者参考（不作判断）：底稿此刻 §A2.4 693 行仍写「新块 15 个」；§A7 789 行已改成结束时「16~17 块」，并注明尾状态组一生借过 52–53 个块号（2026-09-28 由「15 块」改正）。185、188 行正是会跟着变的句子。

### 6. 有没有丢信息

- `git diff HEAD`（只看删除行，跳过来源条目）：旧版六个 H2 的要点在新版都能找到。对应关系：职责分工在 69–73 行；两个接口在 134–135 行；启动建资源、每轮复用在 149–162 行；进程边界不等于仓库边界在 172 行；一个 Worker 不对应一台服务器在 208 行；只做静态分析、缺实测在 285 行；镜像里的上游版本待核在 286 行。A/C 第 3 轮的表挪到了 prepare-inputs-flow「A/C 第三轮如何拼接」（该页 36、47 行有 `[5,0,1,2]`），属实。
- 旧版信息清单共 38 条（P1–P22、Q1–Q16），抽核 15 条：P2、P3、P4、P12、P19、P20、P21、P22、Q2、Q8、Q10、Q11、Q12、Q13、Q16，勾选都属实。只有一处去向写得不准：清单第 87 行说 Q11 的块大小来历链到「two-node / npu-worker-lifecycle」，但 npu-worker-lifecycle 里没有块大小内容。实际位置是 two-node 191 行「为什么一个逻辑块是 640 个 token」（写作记录第 27 行写对了）；`update_block_size_for_backend` 的调用时机在 vllm-platform-interface 185 行、npu-platform 169 行。知识库没有丢信息。
- 旧版「只有前端有分词器」已按源码更正，见第 2 节。

### 7. 链接与锚点

本页去重后 31 个出链，目标文件全部存在。按 `src/content/wiki/anchors.ts` 的 slug 规则逐个核对锚点，全部能对上，包括 `示例场景-m-与变体-m`、`第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个`、`ac-第三轮如何拼接`。全库指向本页的入链共 6 处（layers-and-hidden、learning-guide、reading-vllm-ascend、vllm-ascend-repo-map、index 两处），都不带锚点，不受本页标题改动影响。注意：`wiki:lint` 和 `wiki:audit` 都不校验锚点，以上结果是手工核对的。

### 8. 图

- `pnpm wiki:diagrams --check`：exit 0，192 张图与 spec 一致，本页两张图没有劝告。
- `vllm-v1-shape.yaml` 画布 900×530，`vllm-v1-shape-loop.yaml` 画布 900×700，宽度都不超过 900。两张图上都没有字节数和代码名，内容与正文一致：七站编号、两次调用、异步回环、结束还块。
- 小问题：直觉图里「执行结果」箭头从 Worker 的「采样」直接指到「按结果更新进度」，绕过了 Executor；而正文 71、203 行说 Executor 也负责把结果收回来。见 P3-4。
- 没有截图（任务要求不起服务）。

### 9. 版本口径、meta、术语

- 版本差异（242 行起）：v0.23 = 2c59ff10、v0.26 = 2ed6cbba、main = baa023ad，db701c1f 单独标注「不算进 v0.23 列」；v0.23、v0.26、main 三列都在。对照源码的五个 H3 齐全，顺序正确（212 / 222 / 233 / 242 / 254 行）。
- 「对照源码」之上没有证据角标，也没有 meta 文本（没有写参考来源，没有「这里放慢演示」一类说明）；正文行内代码 0 个，没有 calc。
- 术语先讲后用：DP 首次出现在 128 行，到 176 行才讲「每台机器是一个 DP 组」；TP、EP 首次出现在 176 行，没有解释，到 206 行才给链接；投机解码和草稿层（118 行）、流水线并行（122 行）都没有一句话说明。
- 英文原名：61 行首次出现「调度计划」「执行结果」时没带 SchedulerOutput / ModelRunnerOutput，到 134–135 行才给出；「缓存规格」（KVCacheSpec）、「批次队列」（batch queue）、「忙循环」（busy loop）、「多进程 / 单进程执行器」（MultiprocExecutor / UniProcExecutor）在正文里都没给英文名。见 P3-3。

### 10. 自动检查

- `pnpm wiki:audit`：exit 0。本页 evidence=C，正文 15218 字 / 9 节，来源 36 条，没有针对本页的告警。本页不在 `scripts/wiki/standard-pages.json` 名单里，所以 audit 的写作标准项不检查本页。
- `pnpm wiki:lint`：exit 0，输出中没有本页。
- `pnpm wiki:diagrams --check`：exit 0。

### 11. 打分：8 / 10

**P1**

无。

**P2**

1. **位置**：181、185、188 行。**问题**：搬进了 KV 块分配页的结论：缓存组拆分（5 组，其中 12 块给 KDA）、「decode 步大多不用再借块」、「生成 200 个 token 仍只占这 15 块」。这些都是 vllm-kv-block-allocation 和 one-request 第 2 站的推导结果，是写手把代号 K 误读成「KV 块分配」后在本页复述的。底稿块数一节正在修订（§A7 已改为 16~17 块），这几句会最先漂移。**改法**：181 行只留「新借一批块号（数目与算法见第 2 站）」，删掉括号里的分组拆解；删掉 185 行后半句；188 行删掉「即使生成了 200 个 token……只占这 15 块」，只留「块号一次还回，见 R1 从借块到还块」；87、195 行的「15」改成链接，或等底稿定稿后统一。
2. **位置**：106–122 行和流程图 `vllm-v1-shape-loop`。**问题**：与 request-call-chain「一步之内」（135–152 行，图 `request-call-chain-step`）重复，再讲了一遍两次调用、logits 暂存、屏蔽表并行计算、批次队列回环和第 N / N+1 步重叠，还另行推导了「队列长度 2」（request-call-chain 290 行、async-scheduling 44 行已有）。违反单一出处。**改法**：保留角色层的一圈（② 排计划 → 前向 → 采样 → ⑥ 更新 → ⑦ 送回）；122 行压成两句：「异步调度打开时，EngineCore 不等这一步的结果就先排下一步，相邻两圈叠在一起；细节见『一步之内』和『异步调度』。」删掉队列长度的推导；流程图去掉异步回环那条虚线，或者改为引用 request-call-chain 的图。
3. **位置**：139 行。**问题**：「它能对 Worker 发的调用是 Worker 接口里固定的几种……每一步用的就是后两种」不准。`collective_rpc` 按方法名调用 Worker 上的任意方法：multiproc_executor.py L332 的 `execute_dummy_batch`、L337 的 `take_draft_token_ids` 都不在页上的列表里；本页 152 行自己用到的「查剩余显存」（`determine_available_memory`）也不在列表里。更要紧的是本部署的情况：DP1 空闲时，EngineCore 每一步调的是 `execute_dummy_batch`（core.py L1899），这对应 183 行「DP1 的 8 个 Worker 每一步都跑一个空批次」，却与「每一步用的就是后两种」矛盾。**改法**：改成「常用的调用有：起设备、加载模型、报告缓存规格、查剩余显存、按配置建缓存、预热、执行前向、采样；DP 组没有请求时改发『跑空批次』。有请求的一步只用执行前向和采样两种。」

**P3**

1. 130 行分词器一句：补上「不开结构化输出也会在启动时加载（除非设了 `skip_tokenizer_init`）」；用途写成「编译结构化输出的语法表、判断推理段何时结束」（structured_output/__init__.py L71-L81、L109-L110）。204 行「旁边两个后台线程只管收发消息」可以补一句「结构化输出另有编译语法用的线程池」（同文件 L69、L78）。
2. 118 / 184 行「只有 0 号 Worker 回传」可以补一句「PP=1 时就是 TP 组里的 0 号」（multiproc_executor.py L495-L507）。对照源码 218 行「否则等于 PP 段数」漏了一种情况：V2 Runner 开异步调度时是 PP+1（config/vllm.py L502-L503）。262 行引用的 `vllm.py#L495-L506` 截掉了 L507 的 `return pp_size`，应改为 L497-L507。
3. 术语先讲后用、用英文原名：128 行首次出现 DP 时，补半句「DP 组：一套独立排调度的 EngineCore + Worker，本部署每台机器一个」；176 行给 TP8、EP16 各补半句含义并就地链接；118 行投机解码、122 行流水线并行各补半句说明；61 行首次出现时写成「调度计划（SchedulerOutput）」「执行结果（ModelRunnerOutput）」；152、122、108、141–142 行分别给出 KVCacheSpec、batch queue、busy loop、MultiprocExecutor / UniProcExecutor 的英文原名。
4. 直觉图 `vllm-v1-shape.yaml` 第 26 行：执行结果的箭头从 Worker 直达「按结果更新进度」。建议让它经过 Executor 框，或在箭头旁注明「经 Executor 收回」，与正文 71、203 行一致。
5. frontmatter relations（46–51 行）缺 D 页 glm-5-3-flash-two-node（本页三处数字都链到它），建议补 `{to: glm-5-3-flash-two-node, kind: builds-on}`；vllm-ascend-overview 已经反向 builds-on 本页，不用再加。另外知识库已有 vllm-engine-core 页（它 builds-on 本页），本页讲 EngineCore 循环的一节可以加一个指向它的链接。

**尚未验证**：浏览器实截（按任务不起服务）；块数一组（等底稿 §A2.2、§A7 定稿后再核）。

## P5 修订记录（09-28）

按上方审查自修 P2，并按协调者的五项要求处理。先更正写作记录里的一处误读：队列里的依赖代号 K = request-call-chain、D = glm-5-3-flash-two-node、R = one-request，不是写作记录最后一段理解的「KV 块分配、Data parallel」。

**1. P2-1 搬进来的块分配结论（原 181、185、188 行）。** 181 行删掉「5 个缓存组一起借，其中 12 个给 KDA 的递推状态」，改成一句本页需要的结论：「块号按缓存组借，KDA 的递推状态和注意力历史借法不同；借几块、怎么算，见 R1 从借块到还块」，链到 `vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块`。185 行删掉「之后的 decode 步大多不用再借块」（该页现已改写为「尾状态组边借边还」，本页不再复述）。188 行删掉「即使生成了 200 个 token……仍然只占这 15 块」，只留「块号一次还回 DP0 的池子，还多少块见 R1 从借块到还块」。

**2. P2-2 重讲 request-call-chain 的调用链（原 106–122 行 + 流程图）。** 循环节压成角色层四步（② 排计划 → 两次调用、只由 0 号 Worker 交回 → ⑥ 更新 → ⑦ 送回），后面一段链到 `request-call-chain.md#一步之内enginecore-给-worker-发两次调用` 与 async-scheduling，并按 P3-5 的建议加了指向 vllm-engine-core 的链接。删去的内容逐条 grep 核实在 request-call-chain 里确有：两次调用与 logits 暂存（L141–L142、L187）、趁前向算结构化输出屏蔽表（L144）、草稿层猜候选（L142）、只读 0 号 worker 的回话（L129）、第 N / N+1 步重叠（L154）、批次队列长度（L292）、后台线程收发（L127）。Scheduler「先排运行请求、再看等待请求」在 vllm-scheduler L57，本页步骤 ② 已链接。request-call-chain 没有单独写的「没有请求要算时停在输入队列上等」保留在本页。流程图 `vllm-v1-shape-loop` 删掉了异步回环的虚线和三段说明，改指 DP 陪跑的源码 pin（core.py L1869-L1945）；「停下，等新请求」一框补了副标题「另一组在跑时改跑空批次」。

**3. P2-3 Executor 调用集不准（原 139 行）。** 对照 `vllm@0fc695fc` 改为：Executor 按方法名让每个 Worker 执行某个方法，不限于固定清单；常用的有起设备、加载模型、报告缓存规格、查剩余显存、按配置建缓存、预热、执行前向、采样、取回草稿 token；DP 部署里本组这一步没有请求、另一组还在跑时改发「跑空批次」（dummy batch），链 data-parallel；有请求的一步只用执行前向和采样。对照源码节「源码位置」新增两行：`multiproc_executor.py#L331-L337`（`execute_dummy_batch`、`take_draft_token_ids`）、`core.py#L1886-L1898`（`DPEngineCoreProc.run_busy_loop` 本步未执行且全局仍在运行时调 `execute_dummy_batch`，整段 L1869-L1945）；frontmatter sources 追加 `vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945`（C37），证据索引 Executor 一组加 [C37]。

**4. 块数不再重述。** 87 行改为「R1 算 4 个 token」和新借的一小串块号；181、185、188 行见第 1 项；195 行表格改为「手里一串块号」；页末 [D] 说明里的「4 个 token、15 个块号」「生成 200 个 token 仍占 15 块」同步删去。原 181 行链到 one-request 第 2 站的锚点标题里含「15」，已不再使用，块数一律链 vllm-kv-block-allocation 的 H2 锚点（该锚点不含数字）。`grep "15 个块|15 块|-15-"` 在本页已无结果。

**5. 锚点。** 用 scratchpad `p5/anchor-check.ts`（按 `src/content/wiki/anchors.ts` 的 slug 规则）核对本页 21 个带锚点出链，0 个失效，其中包括第 1 项的 `vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块`（两处）和第 2 项的 `request-call-chain.md#一步之内enginecore-给-worker-发两次调用`。

**旧版信息清单受影响条目的去向**（scratchpad `p5/vllm-v1-shape-facts.md` 末尾已追加）：P9 改为一句结论 + 链 vllm-kv-block-allocation；P13 的循环细节挪到 request-call-chain（行号见第 2 项）与 vllm-scheduler L57；Q10 按源码改正并补空批次；Q11 去向更正为 two-node「为什么一个逻辑块是 640 个 token」（审查指出 npu-worker-lifecycle 没有块大小内容）；其余条目去向不变。

**字数与密度。** 教学正文约 8,300 → 约 8,070 字（不含空白与围栏；全文含源码区约 13,770 字）；单页写作标准检查 4,493 字、行内代码 0、正文角标 0、免责 2.0%、图先行、图宽均通过。证据角标 30 处：C 23、D 4、A 2、S 1（C 占 76.7%）。

**验证。** `pnpm wiki:lint` 退出码 0（本页无输出）；`pnpm wiki:diagrams --check` 退出码 0（192 张图一致，本页两张图无劝告；只用本页脚本重渲染了 `vllm-v1-shape-loop.svg`）；`pnpm wiki:audit` 退出码 0，本页 37 条来源无越界。未截图、未起服务。

**未处理。** 审查的 P3-1 到 P3-5 不在本次自修范围内（只有 P3-5 里「加 vllm-engine-core 链接」顺带做了），留给后续：分词器一句补推理段解析器、「PP=1 时就是 TP 组里的 0 号」、`vllm.py#L495-L506` 改为 L497-L507、术语英文原名与先讲后用、直觉图结果箭头经 Executor、relations 补 glm-5-3-flash-two-node。没碰 vllm-kv-block-allocation、npu-worker-lifecycle、request-call-chain、one-request。
