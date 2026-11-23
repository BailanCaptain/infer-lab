---
id: request-call-chain
title: 一条请求的代码路径：七站各在哪个进程、经过哪些函数
type: concept
summary: >-
  沿用单请求那一页的七站，在官方双机部署上标出每一站在哪个进程里执行（API server、每个 DP 组的 EngineCore、每张卡的
  worker）、经过哪些类和函数、进程之间走 ZMQ、共享内存队列还是 HCCL，哪些代码属于 vLLM、哪些属于
  vllm-ascend；再讲怎样凭日志前缀和 traceback 判断请求停在哪一站，以及读源码从哪几个入口开始。
aliases:
  - 调用链
  - call chain
  - 请求路径
  - 请求调用链
  - 一次请求的调用链
  - 请求调用链：从调度计划到模型输出
  - execute_model 链路
  - 代码路径
  - 按 traceback 认站
  - 请求停在哪一站
  - VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS
  - VLLM_RPC_TIMEOUT
  - HCCL_CONNECT_TIMEOUT
  - HCCL_EXEC_TIMEOUT
  - LLM.enqueue
  - LLM.enqueue_chat
  - wait_for_completion
  - LLM.collective_rpc
  - LLM.apply_model
  - ZMQ 通道
  - RPC 超时
chapters:
  - 09
order: 10
sources:
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L219-L356'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1426'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L515-L559'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L1000-L1045'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1118-L1164'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1273'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L497-L507'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L957-L1002'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L967'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L400'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L969-L1031'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L666'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1917-L2370'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2582'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2803-L2839'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L259'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2123'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L135-L184'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L169-L260'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L420-L557'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1650'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L675'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L21-L41'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L660'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L823'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - 'vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L10-L24'
  - 'vllm@0fc695fc:vllm/utils/system_utils.py#L201-L253'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L386-L400'
  - 'vllm@0fc695fc:vllm/logging_utils/dump_input.py#L56-L81'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1193-L1198'
  - 'vllm@0fc695fc:vllm/v1/engine/exceptions.py#L9-L18'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L270-L295'
  - 'vllm@0fc695fc:vllm/envs.py#L1647-L1648'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L636-L648'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/__init__.py#L82-L91'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L168-L173'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L643-L692'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L7-L60
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L461-L531
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L12-L67'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L106-L136'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L227-L236'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L82'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L527'
  - >-
    raw:sha256-8c7c025d5824f3b45a76b291c2cfc08bd855e9ee845cae77e5e2aa329e66c270.md#L1-L4556
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/async_llm.py#L408-L412
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/model_runner_v1.py#L2027-L2057
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L1264-L1272'
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_CONNECT_TIMEOUT.md
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_EXEC_TIMEOUT.md
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L232-L312'
  - 'vllm@0fc695fc:vllm/envs.py#L2082-L2088'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1708-L1718'
  - 'vllm@568afb3a:vllm/envs.py#L1675-L1676'
  - 'vllm@84030bbe:vllm/envs.py#L1791-L1792'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1274-L1282'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L1056-L1087'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L863-L871'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L710-L714'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/api_router.py#L21-L24'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L600-L617'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/__init__.py#L41-L69'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L839-L853'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L18-L48'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L589-L628'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L589-L628'
  - 'vllm@ced6857a:vllm/envs.py#L1762-L1764'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L941-L948'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L643-L648'
  - 'vllm@0fc695fc:vllm/config/model.py#L1623-L1632'
  - 'vllm@0fc695fc:vllm/config/model.py#L1749-L1765'
  - 'vllm@0fc695fc:vllm/config/model.py#L1848-L1857'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2410'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L120-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L53-L54'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L42-L60'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L689-L741'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L576-L606'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/__init__.py#L81-L94'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/__init__.py#L41-L69'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L18-L44'
  - "vllm@0fc695fc:docs/serving/offline_inference.md#L1-L114"
  - "vllm@0fc695fc:vllm/entrypoints/llm.py#L487-L569"
  - "vllm@0fc695fc:vllm/entrypoints/llm.py#L710-L785"
  - "vllm@0fc695fc:vllm/entrypoints/offline_utils.py#L523-L626"
  - "vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L152-L177"
  - "vllm@0fc695fc:vllm/v1/engine/core_client.py#L82-L104"
  - "vllm@0fc695fc:vllm/v1/engine/core_client.py#L288-L298"
  - "vllm@0fc695fc:vllm/v1/engine/core_client.py#L834-L874"
  - "vllm@0fc695fc:vllm/envs.py#L1248-L1250"
  - "vllm@0fc695fc:vllm/entrypoints/llm.py#L807-L845"
  - "vllm@0fc695fc:vllm/v1/engine/core.py#L727-L779"
  - "vllm@0fc695fc:vllm/v1/engine/core.py#L1621-L1668"
  - "vllm@568afb3a:vllm/entrypoints/llm.py#L476-L558"
  - "vllm@568afb3a:vllm/entrypoints/llm.py#L699-L774"
  - "vllm@568afb3a:vllm/entrypoints/offline_utils.py#L523-L626"
  - "vllm@568afb3a:vllm/v1/engine/llm_engine.py#L161-L186"
  - "vllm@568afb3a:vllm/v1/engine/core_client.py#L83-L105"
  - "vllm@568afb3a:vllm/v1/engine/core_client.py#L289-L299"
  - "vllm@568afb3a:vllm/v1/engine/core_client.py#L849-L889"
  - "vllm@568afb3a:vllm/v1/engine/core.py#L1358-L1416"
  - "vllm@568afb3a:vllm/envs.py#L1327-L1329"
  - "vllm@568afb3a:vllm/v1/engine/core.py#L860-L914"
  - "vllm@568afb3a:vllm/v1/engine/core.py#L1764-L1811"
  - "vllm@ced6857a:vllm/entrypoints/llm.py#L483-L565"
  - "vllm@ced6857a:vllm/entrypoints/llm.py#L706-L781"
  - "vllm@ced6857a:vllm/entrypoints/offline_utils.py#L531-L634"
  - "vllm@ced6857a:vllm/v1/engine/llm_engine.py#L166-L191"
  - "vllm@ced6857a:vllm/v1/engine/core_client.py#L91-L129"
  - "vllm@ced6857a:vllm/v1/engine/core_client.py#L361-L371"
  - "vllm@ced6857a:vllm/v1/engine/core_client.py#L944-L979"
  - "vllm@ced6857a:vllm/v1/engine/core.py#L1403-L1477"
  - "vllm@ced6857a:vllm/envs.py#L1382-L1384"
  - "vllm@ced6857a:vllm/v1/engine/core.py#L879-L933"
  - "vllm@ced6857a:vllm/v1/engine/core.py#L1918-L1963"
  - "vllm@ced6857a:vllm/v1/engine/core.py#L834-L839"
  - "vllm@84030bbe:vllm/entrypoints/llm.py#L483-L565"
  - "vllm@84030bbe:vllm/entrypoints/llm.py#L706-L781"
  - "vllm@84030bbe:vllm/entrypoints/offline_utils.py#L531-L634"
  - "vllm@84030bbe:vllm/v1/engine/llm_engine.py#L166-L191"
  - "vllm@84030bbe:vllm/v1/engine/core_client.py#L91-L129"
  - "vllm@84030bbe:vllm/v1/engine/core_client.py#L361-L371"
  - "vllm@84030bbe:vllm/v1/engine/core_client.py#L944-L979"
  - "vllm@84030bbe:vllm/v1/engine/core.py#L1403-L1477"
  - "vllm@84030bbe:vllm/envs.py#L1411-L1413"
  - "vllm@84030bbe:vllm/v1/engine/core.py#L879-L933"
  - "vllm@84030bbe:vllm/v1/engine/core.py#L1918-L1963"
  - "vllm@84030bbe:vllm/v1/engine/core.py#L834-L839"
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L571-L614'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L560-L603'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L567-L610'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L567-L610'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L410-L420'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L810-L817'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L920-L927'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L355-L362'
  - 'vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L79-L104'
  - 'vllm@568afb3a:vllm/v1/executor/uniproc_executor.py#L79-L106'
  - 'vllm@ced6857a:vllm/v1/executor/uniproc_executor.py#L90-L117'
  - 'vllm@84030bbe:vllm/v1/executor/uniproc_executor.py#L90-L117'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L340-L404'
  - 'vllm@568afb3a:vllm/v1/executor/multiproc_executor.py#L343-L405'
  - 'vllm@ced6857a:vllm/v1/executor/multiproc_executor.py#L375-L448'
  - 'vllm@84030bbe:vllm/v1/executor/multiproc_executor.py#L375-L448'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L125-L130'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L327-L328'
  - 'vllm@0fc695fc:vllm/v1/serial_utils.py#L486-L510'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L605-L619'
  - 'vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L46-L69'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L791-L792'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L742-L746'
  - 'vllm@568afb3a:vllm/v1/executor/multiproc_executor.py#L986-L1011'
  - 'vllm@ced6857a:vllm/v1/executor/multiproc_executor.py#L1035-L1059'
  - 'vllm@84030bbe:vllm/v1/executor/multiproc_executor.py#L1035-L1059'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L498-L518'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L942-L950'
  - 'vllm-ascend@c09d3e20:vllm_ascend/spec_decode/__init__.py#L41-L69'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L622'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1106-L1114'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L618'
  - 'vllm@ba15685a:vllm/envs.py#L1952-L1954'
  - 'vllm@ba15685a:vllm/v1/engine/core.py#L709-L760'
  - 'vllm@ba15685a:vllm/entrypoints/llm.py#L490-L618'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南给出五页主线的顺序，本页把七站对回代码
  - to: request-overview
    kind: builds-on
    note: 先建立单条请求从入口到输出的全景框架，再沿本页把七站落到具体进程、通道与函数
  - to: vllm-v1-shape
    kind: builds-on
    note: 先理解前端、EngineCore、Worker 三类角色的两道边界，再展开每道边界的具体 RPC 与函数调用链
  - to: engine-processes
    kind: builds-on
    note: 进程是怎样被拉起来的、每种进程里还有哪些对象，在那一页展开；本页只用到「谁在哪个进程里」
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 第 3 到第 5 站跑在每张卡的 NPUWorker 内，先看清 Worker 启动如何备好权重、通信域与 KV 池
  - to: async-scheduling
    kind: builds-on
    note: 官方部署默认开着异步调度，EngineCore 因此走带批次队列的那条循环；占位 token 的记账规则在那一页
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: direct
---

[调用链](#七站分在三种进程里)是一串函数的调用关系：A 调 B，B 再调 C。[一条请求](one-request.md)回答了 4 个提示词 token 在每一站算了多少数、传了多少字节、借了几块 [KV block](kv-cache.md)（保存历史状态的显存块）。本页则跟着同一条请求落到代码：每一站跑在哪个进程里、跨进程走哪条通道交接，以及服务报错或卡住时该打开哪份日志与源码。

Python 报错时打印的 traceback（调用栈回溯）只列出出错进程那一刻的函数链；跨进程交接的请求则需要把几份进程日志连起来读。提交侧会先在本地的 `OutputProcessor` 注册请求，再异步发给独立的 `EngineCore`，因此排查「请求到底停在哪一站」时，务必把本地注册与跨进程提交拆成两步核对。

## 七站分在三种进程里

**进程**是操作系统里一份独立运行的程序，有自己的一块内存。两个进程不能直接读对方的变量，交换数据必须经过网络或共享内存通道。因此「一站交给下一站」分两种情况：同进程内是普通函数调用，跨进程则要编码、传输再解码。

**先记一套标准单机心智模型（`1 前端 + 1 EngineCore + N 个 Worker`）：** 无论跑单卡 `Qwen3-8B` 还是四卡 `TP4`，vLLM V1 永远只有三类干活的进程。API server 管第 1 站收请求与第 7 站流式返回；EngineCore 管第 2 站调度与第 6 站结果更新；每张卡的 Worker 管第 3–5 站输入准备、前向与采样。

把这套三角色骨架放进本站历史双机部署（`2×A2×8`，`TP8 / DP2 / EP16`，见[部署前提](glm-5-3-flash-two-node.md#部署前提)），便展开为启动后的 **20 个核心角色进程**。一条请求仍只经过同样的三种角色：

- **API server**：node0 上唯一接收 HTTP 请求的前端进程。第 1 站和第 7 站在这里。
- **EngineCore**：每个 DP 执行组一个引擎进程，分别记作 `EngineCore_DP0`、`EngineCore_DP1`（日志也用这两个前缀）。内部持有 **scheduler**，管第 2 站和第 6 站。
- **worker**：每张卡一个，共 16 个，负责把调度结果变成 NPU 上的计算。每个 EngineCore 管本机 8 个 worker，管第 3、4、5 站（[TP](tensor-parallel.md) 与 [EP](expert-parallel.md) 分组见部署页）。

第四种角色是双机 DP 特有的 **DP 协调器**（在 node0 上），它不经手请求本身，只汇总两个 DP 组的负载条数，并在两组之间传递「开始干活」「可以停了」的信号。

前端怎样拿这些条数给新请求选组，见 [DP 请求路由](dp-request-routing.md)。

| 站 | 在哪个进程 | 从哪个函数进 | 代码属于 |
|---|---|---|---|
| 1 入口 | API server | `OpenAIServingChat.create_chat_completion` | vLLM |
| 2 调度 | EngineCore_DP0 | `Scheduler.schedule` | vLLM，五处被 vllm-ascend 换过 |
| 3 准备输入 | node0 的 8 个 worker | `NPUWorker.execute_model` | vllm-ascend |
| 4 逐层前向 | node0 的 8 个 worker | `NPUModelRunner._model_forward` | vllm-ascend |
| 5 采样与草拟 | node0 的 8 个 worker | `NPUModelRunner.sample_tokens` | vllm-ascend |
| 6 结果更新 | EngineCore_DP0 | `Scheduler.update_from_output` | vLLM |
| 7 返回与收尾 | API server | `OutputProcessor.process_outputs` | vLLM |

```wiki-diagram
file: request-call-chain
```

R1 被分到了 DP0，所以它的第 2 到第 6 站都在 node0 上。node1 的 EngineCore_DP1 和 8 个 worker 不经手 R1，但它们每一步都要跟着跑：MoE 层的专家分散在 16 张卡上，node0 的卡算 MoE 时要和 node1 的卡交换 token，node1 没有请求也得陪着执行一次空批次。这条陪跑走的是哪几个函数，放在「同一条请求，第 1 步和第 2 步走的分支不同」一节里讲。

## 进程之间的四条通道

图上的连线分四种。前两种按先后顺序把请求和结果从一个进程送到下一个进程；后两种是几个进程同时参与的集合通信，按固定的节奏发生，R1 的每一步都会用到其中一部分。

**ZMQ：API server 和每个 EngineCore 之间。** ZMQ（ZeroMQ，轻量级进程间消息传输库）支持本机 IPC（同机进程间通信）与跨机 TCP。API server 开一发一收两个口子，两个 EngineCore 通过 node0 的 TCP 端口连入，消息用 msgpack（紧凑二进制序列化格式）打包。EngineCore 另有两个后台**线程**专管收发：收线程把解码后的请求放进进程内队列，发线程从另一队列取出结果回传；主线程只跑不停转圈的**忙循环**——取新请求、跑一步、放结果。

**共享内存队列：EngineCore 和本机 8 个 worker 之间。** 共享内存是同机进程都能读写的内存，传数据不经过网络。EngineCore 里的 `MultiprocExecutor` 管理本机 8 个 worker：把「要执行的函数名和参数」写进广播队列一次，8 个 worker 各自读到同一条消息。回程每个 worker 各有一条响应队列；本页生成内部调用指定第 0 号 worker（TP 组内编号 0）回复，执行器只读它的那一条（公开 Python RPC 默认收各 Worker 结果）。

**HCCL：worker 和 worker 之间，搬张量。** HCCL（昇腾集合通信库）负责卡与卡之间的数据交换。机内 8 张卡在每层的张量并行里合并结果，16 张卡在 MoE 层里互相派发 token。这些通信各发生几次、每次多少字节，见[一条请求](one-request.md)第 4 站的「一次前向的通信账」。

**gloo：进程之间对几个小数字。** gloo 是 PyTorch 自带的 CPU 集合通信后端，适合传很小的数据。它用在两处：两个 EngineCore 每 32 步交换一次「我这边还有没有请求」，两边都空了才一起停下；两台机器对应 worker 每步开算前对齐「这一步算多宽、用不用图」（开启 `dp_allreduce_on_npu` 时后者改走 HCCL，默认关闭）。

所以 R1 走完一个新 token 的通道顺序可以按往返记：去程走 ZMQ（API → `EngineCore_DP0`）→ 共享内存（`EngineCore_DP0` → 8 个 worker）；卡内执行穿插 gloo 对齐与 HCCL 通信；回程经共享内存（第 0 号 worker → `EngineCore_DP0`）→ ZMQ（`EngineCore_DP0` → API）。

## 一步之内：EngineCore 给 worker 发两次调用

让另一个进程执行某个函数、再把返回值送回来，叫**远程过程调用**（RPC）。生成循环每转一圈（一步），EngineCore 都要对本机 8 个 worker 发两次 RPC：

1. `execute_model`：把调度结果 `SchedulerOutput`（哪些请求、各算几个 token、新分哪些块）送过去，worker 做第 3 站和第 4 站，算到需要出 token 那几行的词表分数（logits）。logits 暂存在 worker 的 `ExecuteModelState` 中，这次调用返回空值。
2. `sample_tokens`：worker 取出 logits 做第 5 站，采样选出新 token，再让 MTP（多 token 预测，投机解码草稿头）猜候选。这次调用返回 `ModelRunnerOutput`，装入每个请求本步新得的 token 编号。

拆成两次以后，EngineCore 可以趁 worker 做前向的时候算一张结构化输出要用的表（结构化输出限定模型只能生成合法 JSON 这类格式，这张表写明下一个 token 允许是哪些），随第二次调用一起送过去，见[结构化输出](structured-output.md)。

需要注意，进入 `execute_model` 只证明 worker 收到了调用，不代表本请求一定跑了前向或设备完全空闲。若本请求未被排入 token，先看同批是否还有其他请求在算；若整批无 token，则要区分「直接返回空输出」与「走 KV connector 协作路径」，部分外部启动器配 DP 时甚至会先跑一次 dummy run（具体触发条件见页末源码）。因此，「本请求没有前向」和「设备没有任何工作」是两个独立结论。

```wiki-diagram
file: request-call-chain-step
```

**异步调度让两步叠在一起。** 本部署未显式设置异步调度开关，所用的 MTP 投机解码方法与执行器都支持异步调度，因此按自动判定打开：上一步的结果还没回来，就先把下一步排好发出去，见[异步调度](async-scheduling.md)。EngineCore 的忙循环因此走带批次队列的分支：

图中 future 是「结果以后才会到」的占位对象。普通文本请求发出两次 RPC 后将 future 入队；队列未满且仍能推进时，沿左侧回环优先安排下一批。队列已满或没有后续请求可调度时，沿向下分支等待最老一批，再做第 6 站。结构化输出依赖前批 token 时，第二次 RPC 会延后到前批更新之后。

在这种重叠执行中，worker 尚未完成第 N 步时，EngineCore 就能先发出第 N+1 步的清单。读 traceback 时，应按批次或执行步骤编号，将第 6 站的结果更新与它所属的旧清单配对，再看新清单；仅按日志相邻位置拼接，会把两步混成一步。实际是否启用异步调度，以启动日志为准，日志格式见页末。

异步调度还换用 AsyncScheduler：调度主体继续复用父类，候选占位和结果更新则有自己的记账方法。因此，要按栈中的具体方法判断第 2、6 站做到了哪一步，不能只凭类名认站。页末[源码位置](#源码位置)列出已核的方法及继承关系的验证办法；本部署运行时的继承链仍缺实际打印记录。

## vllm-ascend 从六个口子接进 vLLM

vLLM 是主程序，vllm-ascend 是装在它上面的插件，不单独起自己的进程。它的代码之所以出现在请求路径上，是因为 vLLM 在六个地方留了口子，或者被它从外面改了：

1. **平台插件回答硬件问题。** vLLM 启动时发现插件，拿到 NPUPlatform，此后用它决定昇腾上怎么执行，见[平台注册](platform-plugin-registration.md)。
2. **worker 类接管执行。** 平台选择 NPUWorker，它创建 NPUModelRunner；后者继承上游 GPUModelRunner，重写请求路径上的主要方法。
3. **注意力后端选择实现。** 通用路径按 attention 类型向平台查表选后端；GLM 稀疏 MLA 不查这张表，由层自身返回 `AscendIndexerKPoolMLABackend`。只有它的实现类继承自 SFA（`sfa_v1.py` 里的稀疏注意力实现），详见[后端家族](attention-backend-family.md)与[稀疏注意力](sparse-attention.md)。
4. **custom op 替换整层。** 标为 custom op 的层允许硬件插件换实现；worker 初始化时把 MoE 与 KDA 换成昇腾版本。KDA 用固定大小状态保存历史，见[线性注意力](linear-attention.md)。
5. **patch 改变已有入口的指向。** 每个进程加载 general plugin（通用插件）时，把部分上游函数或类换成昇腾实现；EngineCore 也会加载，所以第 2 站也受影响，见[Patch 机制](ascend-patch-system.md)。
6. **模型注册选择 GLM 实现。** 将权重配置里的架构名映射到昇腾的模型类。具体注册名、路径和版本条件集中在页末。

所以「这一站属于哪个仓库」不能只看站号：第 2 站的主体是 vLLM 的调度器，却跑着 vllm-ascend 打进去的补丁；第 4 站的 GLM 模型文件在 vllm-ascend 里，它的层又继承 vLLM 的基类。按报错定位时，看的是出错那一帧的文件路径。

## 七站逐站：从哪个函数进，往下调谁

图把七站的主要调用串起来：竖向箭头表示先后顺序，横向箭头表示跨进程交接。各站的细分方法保留在页末「源码位置」表；形状、数字和字节数见[一条请求](one-request.md)。

```wiki-diagram
file: request-call-chain-functions
```

**① 入口为⑦返回留下接收点。** AsyncLLM 把输入包成引擎请求，并登记**反分词器**（detokenizer，把 token 编号还原成文字的组件）和输出队列；后续结果按请求 ID 回到这里。选 DP 组的规则见[数据并行](data-parallel.md)；包成引擎请求之前，前端怎样检查、套模板、分词和定采样参数，见[API server 入口](api-server-entry.md)。

**②的入口是等待队列，出口是本步清单。** [EngineCore](vllm-engine-core.md) 从输入队列取出请求，预处理后交给 scheduler 等候；下一圈调度决定本步工作并申请块号。running、waiting 与抢占的判断见[多条请求的调度图](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。

这里的 patch 涉及缓存分组、分配协调、KDA 状态管理，也涉及可选的负载平衡调度。本部署的 `mamba_cache_mode=none`，因此只在 align 模式调用的 `_mamba_block_aligned_split` 不执行；BalanceScheduler 的负载平衡开关也关着，直接转给原来的实现，五处补丁并非都在当前调用路径上生效。读 traceback 时，沿补丁函数继续向下找到实际执行的方法，就能判断卡在「排本步工作」还是「分配缓存」；五处替换清单与继承关系的验证方法见页末[源码位置](#源码位置)。

**③ 是清单变成张量的边界。** 调度清单经广播队列交给每张卡的 [worker](npu-worker-lifecycle.md)。[model runner](npu-model-runner.md) 先同步**持久批次**（`input_batch`，跨步保存请求、块号和进度的表），本步有 token 才准备输入与注意力元数据。位置与槽位的逐行算法见[准备输入](prepare-inputs-flow.md)，图模式的判断见下一张分支图。

**④ 把结果暂存在 worker，⑤再消费它。** 前向上下文保存本步宽度和 MoE 通信方式，供模型各层读取。主干的 attention 按层型进入 KDA 或稀疏 MLA，随后前馈进入稠密 MLP 或 MoE；MoE 经 prepare / finalize 派发和收回 token。前向结束后，词表分数留在 ExecuteModelState，等第二次 RPC 取用；MoE 的版本文件差异见页末。

**⑤交回确定的 token，并为下一步留下候选。** 采样器执行普通采样或验证候选，整理实际产出后，草稿器再生成下一步候选。GLM 草拟固定走 eager（逐算子即时执行，不录制静态图），具体迭代见[一条请求](one-request.md)第 5 站。ModelRunnerOutput 经第 0 号 worker 的响应队列交回 EngineCore；异步调度还要等待 NPU 结果拷回 CPU。

**⑥的向上箭头延续生成，向下箭头持续返回。** 结果更新按拒绝数修正进度，再追加 token、检查停止条件。结束时归还块号，完成的请求 ID 随下一份清单通知 worker 清理。每步结果都经 ZMQ 发回前端。

**⑦沿请求 ID 找回①留下的队列。** 后台输出任务反分词并检查停止字符串；HTTP 侧从收集器取出文字，以 SSE（HTTP 上分段推送的格式）返回。两处停止判断怎样衔接，见[一条请求的返回与收尾](one-request.md#第-7-站-返回与收尾)；增量反分词和 SSE 片段怎样拼出来，见[流式输出](streaming-output.md)。

## 同一条请求，第 1 步和第 2 步走的分支不同

上面是每一步都要走的主干。R1 的第 1 步（prefill，把提示词一次算完）和第 2 步（decode，在已有历史上继续往后生成，这是第一个 decode 步）走的是同一串函数，但在几个岔口上拐向不同的分支。要看的数字都在[一条请求](one-request.md)的第 2 到第 6 站和「第二圈」一节，这里只标岔口：

```wiki-diagram
file: request-call-chain-branches
```

沿左右两列看，三个判断各管一件事：队列决定从哪里调度，输入进度与形状决定主模型能否回放图，候选元数据决定用哪个采样器。`AscendRejectionSampler` 逐位接受或修正候选；两列汇合后都继续草拟。图模式完整条件和两组宽度的计算统一见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

第 2 步的 3 个候选从哪来？异步调度开着时，候选 token 留在 worker 进程里，下一步直接取用，不经 EngineCore 转手；只有异步调度关掉时，EngineCore 才在每步末尾把它们取回来交给调度器。

**node1 每一步在做什么。** R1 在 DP0 上，node1 的调度器一直是空的。`DPEngineCoreProc.run_busy_loop` 发现本圈无可跑请求、但另一组仍在忙时，便走空批次陪跑路径：`execute_dummy_batch` → `MultiprocExecutor.execute_dummy_batch` → `NPUWorker.execute_dummy_batch` → `NPUModelRunner._dummy_run`。空批次经 `_sync_metadata_across_dp` 与 node0 对齐宽度和图模式，再完整跑 45 层并陪跑草稿层，凑齐 node0 MoE 通信所需的 16 张卡。排查时在 node1 worker 栈里看到 `_dummy_run` 属于正常陪跑，不代表 node1 收到了请求。

## 离线脚本能先提交几组请求，再一起取结果吗？

**可以。离线队列把“提交输入”和“等生成结束”分成两次调用。** 离线是由 Python 脚本直接调用已有的 LLM 对象，省去 HTTP 前端；模板、分词、调度、模型计算和结果整理仍然要做。提交时先取得每条请求的编号，脚本可以接着提交另一组，再一起等结果。这种分工适合分批准备输入，但提交阶段仍花前处理时间，所有在途请求和最终输出也仍占内存。

默认情况下，引擎在独立的后台进程中运行：**第一组发过去以后就可以开始算，不必等脚本调用等待方法。** 若改成进程内引擎，则由调用方在等待循环里逐步推进计算；模式的选择见[进程布局](engine-processes.md#executor-决定-worker-是不是独立进程)。两种入口最终都交给前面的调度、Worker 和结果更新环节，但收结果的一端变成脚本。

```wiki-diagram
file: request-offline-queue
```

用一个普通生成示意：已有引擎尚未提交过请求，每个输入只要一个答案。先交题目 A、B、C，取得编号 0、1、2；再交 D、E，取得编号 3、4。

$$\text{提交请求总数} = 3 + 2 = 5\text{ 条}, \qquad \text{完整返回结果} = 5 \times 1 = 5\text{ 份}$$

| 阶段（分两次提交，最后一起收齐·示意） | 对应题目与请求编号 | 计数 |
| --- | --- | --- |
| 第一次 `enqueue` | A、B、C（编号 `0, 1, 2`） | 3 条请求 |
| 第二次 `enqueue` | D、E（编号 `3, 4`） | 2 条请求 |
| 一次 `wait_for_completion` 统一收齐 | 按编号 `0, 1, 2, 3, 4` 排序返回 | **5 份完整结果** |

假设实际完成顺序是 2、0、4、1、3，等待结束返回的列表仍按编号 0、1、2、3、4 排列，方便与 A 到 E 对回去。**等待的是当前引擎里全部未完成的请求，不能只传第一组的编号、要求单独等这三条。** 编号方便识别结果，本接口没有按编号选择等待子集的参数。

“提交一组”也不表示整组同时入队：实现会逐条准备和加入。若后面一条失败，会取消这次调用已经加入的请求，再抛出异常；前面几条在默认后台模式下已来得及做的计算不会因此倒流。若确实需要全部先入队再开算，可以在一个原本清醒、尚无已有工作的引擎上先暂停调度，提交两组后恢复，再等待；具体 level 0 调用及其对已有请求的处理见页末。这里讲的是离线提交方式，前面 GLM 双机的 HTTP 配方仍沿用原七站路径。

### 脚本能直接检查各个 Worker 吗？

**公开 RPC 让脚本把一个小操作交给当前执行器管理的各个 Worker，再收回结果列表。** 例如检查每个 Worker 装入了什么模型类，可以分别在各进程读取类名，只传回短字符串；不用创建一条生成请求，也不经过 HTTP 模板和采样流程。跨进程仍要编码、传输和等待，因此它更适合控制信息，回传整份权重或大张量会增加拷贝、传输及对象保留成本。

两个入口的区别在于函数收到谁：collective_rpc 接收 Worker 方法名，或以 Worker 侧对象为首参的函数；apply_model 则把各 Worker 已加载的模型对象交给函数。前者可能收到一个转发属性的包装对象，不能直接当成模型。后者看到的是本 Worker 的模型；使用 TP/PP 时，分片不会因为调用这个接口就拼回完整模型。

用两个 Worker 的**示意**说明返回范围：两边回调分别返回字符串 A、B，脚本拿到两项结果列表；这是两次回调的返回值，不是两枚生成 token。这里的“各 Worker”限定当前执行器管理的组，不自动扩展为部署中所有 DP 组。公开调用没有指定生成路径的单一回复 rank，因此也不能照搬前文“只收第 0 号回复”的规则。

指定超时也要先看执行器。MP 共享一个截止时间等待响应；等待超时会报错，但不会撤销远端已经完成的动作。四版 UniProc 的同步公共分支直接运行方法，没有按 timeout 计时中断。实际调用片段与版本差异见[怎么开](#怎么开)和[版本差异](#版本差异)。

## 出问题时，判断它停在哪一站

服务出问题时，最有效的排障节奏是**先定进程、再定站点、最后追根因**：先凭日志前缀确认停在 API server、`EngineCore` 还是某张卡的 `Worker`，再结合最内层 traceback 帧缩到七站里的具体函数。下面这张地标图把「异常如何跨进程回传」「四个进程泳道的日志前缀」「三层超时作用域」以及 `v0.30.0`（默认 MRV1）与 `main`（唯一 MRV2）在第 3–5 站的文件入口收在同一画布上：

```wiki-diagram
file: request-call-chain-fig-log-landmarks
```

先沿异常回传方向找回真正先报错的原始进程日志（不要停在前端转报的 `EngineDeadError`），再对照进程与站点的对应关系缩小范围。日志前缀格式为 `(名字 pid=进程号)`；worker 名字依次带 DP、TP、EP 编号，例如 node1 本机编号 3 的卡是 `Worker_DP1_TP3_EP11`。进程把范围缩到几站，最内层 traceback 再把范围缩到具体函数。

**第二步看报错链。** Python 打印的调用链从外往里排，最内层的栈帧指出异常在哪里被发现或抛出。先用它定位站点，再结合原始日志找原因；跨进程转报和异步设备错误还要追到更早的执行记录。按最里层那一帧的文件路径判断：

| 最里层在哪 | 是哪一站 | 先看什么 |
|---|---|---|
| `vllm/entrypoints/` | 1 或 7 | 请求参数、聊天模板、分词 |
| `vllm/v1/core/sched/scheduler.py` 的 `schedule`、`vllm/v1/core/kv_cache_manager.py`、`block_pool.py`、`async_scheduler.py` 的 `_update_after_schedule`，或 `vllm_ascend/patch/platform/` 下的文件 | 2 | 预算、块够不够；patch 目录下的帧仍是第 2 站，只是那一段被换过 |
| `scheduler.py` 的 `update_from_output`，或 `async_scheduler.py` 的 `_update_request_with_output` | 6 | 追加、回退、停止条件 |
| `vllm_ascend/worker/model_runner_v1.py` 的 `_update_states`、`_prepare_inputs` | 3 | 请求和批次的对应关系、块号、位置越界 |
| `vllm_ascend/attention/`、`vllm_ascend/ops/`、`torch_npu` 或 aclnn 的调用 | 4 | 形状、数据类型、算子支持范围 |
| `vllm_ascend/sample/`、`vllm_ascend/spec_decode/` | 5 | 采样参数、候选的接受与回退 |
| `vllm/v1/engine/output_processor.py`、`detokenizer.py` | 7 | 停止条件、特殊 token |

反过来不成立：栈里出现 `vllm/` 的文件不代表问题在上游，因为 vllm-ascend 的类继承上游的类，也可能把上游的函数换掉了。

**用原始日志补齐图上的线索。** worker 异常要看它自己的日志；EngineCore 异常前会 dump 本步输入与调度清单；进程直接退出则查看监视线程日志及退出原因。可搜索的完整报错串见页末[会报什么错](#会报什么错)。

**卡住不动怎么判断。** 本页 GLM 配方给两次 RPC 各设 3000 秒等待预算；超时只说明 worker 没在限时内回话。先查同一步各卡最后完成了什么：若仍在计算，继续查前向耗时；若部分卡已进入集合通信，另一些还未到达，就沿未到达的卡往前查。通信要组内成员到齐才结束：机内是 8 张，MoE 是全部 16 张。一张卡故障会让其余卡一起等，因此要将 16 个 worker 的日志按时间对齐，并核对两机时钟；缺少某张卡的记录时先补齐，不能把最后报超时的卡当根因。上游定义默认、Ascend 改写与通信库等待的区别见页末。

**图模式下怎样定位算子。** 先看 plog（CANN 的运行日志）；若要用同步调试，让每个算子提交后立刻等待完成，就须先关闭 ACL Graph（昇腾静态计算图录制与回放模式），此时第 4 站改走 eager。开关和日志目录见页末。

## 常见误解

- **「一次 HTTP 请求对应一次模型执行」**——一条请求要走几十上百步，每步都是一次完整的执行；反过来，一步里的一次执行同时服务着这一步排进来的所有请求。
- **「worker 那一站在跑模型」**——`NPUWorker.execute_model` 本身只做几件杂事就转交给 `NPUModelRunner`。这套部署没开流水线并行，它连卡间收发中间结果都不用做。
- **「第 3 站开始就全是 vllm-ascend 的代码」**——`NPUModelRunner` 继承 vLLM 的 `GPUModelRunner`，没被重写的方法仍然执行上游的代码；反过来第 2 站虽然是上游的调度器，跑的却是被 patch 换过的类。
- **「前端报出来的那一句就是根因」**——跨进程的错会被重新抛出一次，前端和 EngineCore 看到的往往是转达，根因在更靠里那个进程的日志里。
- **「node1 没接到请求就是空闲的」**——它每一步都在陪跑一次完整的前向，MoE 的通信要 16 张卡凑齐。

## 对照源码

把调用链用于排障时，先对齐同一请求、同一执行步骤和各 rank 的记录；函数已经提交任务，不代表设备已经就绪。按最后成功的交接继续查，具体证据与实验见[推理排障入口](inference-troubleshooting.md)，时间线的判别见[性能分析](inference-performance-analysis.md)。

### 怎么开

部署参数统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。启动命令未显式传 `--async-scheduling`；vLLM 在 MTP 方法与执行器都支持时自动启用，运行状态用 `Asynchronous scheduling is enabled.` / `... disabled.` 日志确认。两次 RPC 与批次队列的代码入口见下文。

**离线队列沿用已经创建好的 llm。** `enqueue` 接收普通生成输入，`enqueue_chat` 接收对话并先套模板；两者都返回请求 ID 列表，限生成模型。未传 sampling_params 时使用模型默认采样参数。下面只示意调用顺序，不重新加载一份模型：

```python
first_ids = llm.enqueue(["题目 A", "题目 B", "题目 C"], use_tqdm=False)
second_ids = llm.enqueue(["题目 D", "题目 E"], use_tqdm=False)
outputs = llm.wait_for_completion(use_tqdm=False)
```

若需要先收齐输入再调度，在上述第一行前调用 `llm.sleep(level=0)`，两次提交后、等待前调用 `llm.wake_up(tags=["scheduling"])`。这个局部例子从清醒且无已有工作的引擎开始；默认 mode="abort" 会终止已有请求。level 0 只停调度并继续收请求，不卸载模型权重，也不主动清除 prefix cache；level 1/2 的内存休眠是另一种操作。仅取消进程间运行时，还要核对 VLLM_ENABLE_V1_MULTIPROCESSING 及显式强制条件，见[进程开关](engine-processes.md#怎么开)。

wait_for_completion 默认接受 RequestOutput 或 PoolingRequestOutput。显式传 output_type 是检查返回类型，不是过滤器；共享循环仅收最终输出，再按数字请求 ID 排序。调用时没有未完成请求，返回空列表。这里的“提交与等待分开”也不同于[异步调度](async-scheduling.md)：后者讨论 EngineCore 怎样把调度与设备执行重叠，不能仅凭用了 enqueue 判断它是否启用。

**公开 RPC 沿用同一个 llm。** 以下只取类名，返回的是列表中的短字符串；第一项检查 Worker 侧对象类型，第二项检查局部模型类型。先完成当前实验的生成工作，便于把检查结果对应到明确状态：

```python
worker_types = llm.collective_rpc(lambda worker: type(worker).__name__)
model_types = llm.apply_model(lambda model: type(model).__name__)
print(worker_types)
print(model_types)
```

collective_rpc 的默认 timeout=None；显式 timeout 以秒计，args 默认空元组，kwargs 默认 None。它们传给当前执行器处理，不能用这里的参数替代生成内部两次 RPC 的环境变量。apply_model 没有公开 timeout 参数。固定 GLM 的 get_model 会去掉 ACLGraphWrapper 外壳再返回局部模型，但不会跨卡汇总参数；上面的类名只能识别入口对象，不能单独证明权重完整、数值正确或设备空闲。

**三个超时分别等什么。** 建链是在通信成员之间建立连接，执行同步是已连上的成员等彼此完成通信，Worker RPC 则是 EngineCore 等 Worker 回应一次方法调用。三者覆盖的阶段不同；HTTP 空闲连接保活另见[API 入口](api-server-entry.md#怎么开)，都不能直接当成一条生成请求的总时限。

| 环境变量 | 输入、定义默认与生效边界 | 固定 GLM 配方 |
|---|---|---|
| VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS | 整数字符串，秒；上游默认 300。固定 Ascend 的配置检查把小于 1836 的模块属性值改为 3000，等于或大于 1836 保留；不是读取 HCCL 配置动态联动 | 显式 3000；execute_model 和 sample_tokens 各调用一次 collective_rpc，各有自己的截止时间 |
| HCCL_CONNECT_TIMEOUT | CANN 9.1.X：整数秒，范围 120–7200，默认 120；通知各节点初始化失败原因另加 20 秒，文档建链等待为设置值加 20 | 显式 1200，对应文档口径 1220 秒；不是每次 decode 都预留这段时间 |
| HCCL_EXEC_TIMEOUT | A2 HOST/HOST_TS：整数秒，0–2147483647，默认 1836，0 表示不设限。AIV：0–1091 秒，默认 1091，可按 10 ms 精度输入；0 或超上限按 1091，最终还按硬件时间间隔量化 | 教程同时给 3600 与 AIV；按对应 AIV 规则不能视作实际 3600 秒。通信域 hcclExecTimeOut 可优先于环境值，核现场时还要看实际模式与通信域配置 |

三个变量都在两端启动服务前设置并由子进程继承。教程原样片段如下；它展示配方输入，表中的覆盖与范围仍决定解释方式。

```bash
export VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS=3000
export HCCL_CONNECT_TIMEOUT=1200
export HCCL_EXEC_TIMEOUT=3600
```

Worker 的截止时间在发起 collective_rpc 时由单调时钟计算，读响应队列时用剩余预算；non_block 返回 future 也沿用这个截止时间，不是在调用 future.result 时重新开始计时。例如示意的 3000 秒预算已用掉 80 秒，之后等待只剩约 2920 秒。它限制这次 Worker 调用，不会把 100 次 decode 合并成一份 3000 秒预算；execute_dummy_batch 等没有传此参数的调用也不能一概套用。

上游 getter 只做 int 转换，没有把 0、负数或 None 字符串定义为“无限”；固定 Ascend 又会改写小于阈值的值，因此不能靠填 0 关闭这项等待。HCCL 两种模式对 0 的含义不同，不能复制 HOST 的关闭方式到 AIV。延长等待只推迟发现停滞，不会让选错的网卡恢复连通。

**VLLM_RPC_TIMEOUT 在这个版本不再是有效调节入口。** 固定教程仍 export 3600000，但所查固定 vLLM 的环境注册表与整个运行包没有该变量的定义或消费者，Ascend 运行包也不消费它；它不是上表 Worker 超时的别名。不能把这串数字换算成本部署实际等待时间。默认环境校验会对未知 VLLM_ 变量告警；启用 fail_on_environ_validation 才会直接拒绝。教程残留与当前有效参数应分开识别，排查 Worker 等待使用上表第一项。

### 会报什么错

离线 enqueue / enqueue_chat 用于非生成模型时，会报只支持 generative models 的 ValueError；用等待方法的 output_type 指定了与实际结果不匹配的类型，会触发类型断言。逐条加入过程中出错时，已加入的本次请求会被取消，原异常继续抛出；调用方应按这次失败处理，不能把这次半组输入当作成功完成。

公开 RPC 的方法名不存在、回调自身失败或结果无法传回，沿执行器异常路径报告。MP 普通公共调用读取各响应队列，不能用“生成只收一个 rank”的现象推断它会忽略其余 Worker 的错误。MP 超时表示等待没有按时结束，远端操作可能已发生；含修改的调用不能把超时当成可无条件重试的依据。UniProc 的同步分支没有同样的超时保障。

- worker 的 `WorkerProc hit an exception.` 是原始异常；EngineCore 会转报 `Worker failed with error '...'`。进程死亡则是 `Worker proc ... died unexpectedly, shutting down executor.` [C40]。
- EngineCore 先以 `Dumping input data for V1 LLM engine` 开头 dump 本步清单（`vllm@0fc695fc:vllm/logging_utils/dump_input.py#L56-L81`），再报 `EngineCore encountered a fatal error.`；前端的 `EngineDeadError` 用于指路。
- RPC 等待由上表的定义默认、平台改写和显式配置共同决定；本 GLM 配方为 3000 秒。超时报 `RPC call to {method} timed out.`，例如 `RPC call to execute_model timed out.` [C12]。
- `ASCEND_LAUNCH_BLOCKING=1` 让每个算子提交后同步等待，与 ACL Graph 互斥；同时打开会在启动时报错并提示看 plog [C42]。plog 默认目录是 `$HOME/ascend/log/debug`；使用同步调试前关闭图模式，第 4 站改走 eager。

待核：生成内部仅收第 0 号回复的路径中，非 0 号 worker 抛异常时，EngineCore 收到超时还是转达的异常，尚缺本基线的实证。

Worker 超时变量为空或不是整数时，int 转换会报 ValueError。旧变量可能触发 `Unknown vLLM environment variable detected`，不代表它已生效。HCCL 建链与执行超时的具体日志随 CANN 路径而异：前者先查地址、路由、端口与对端是否启动；后者先把各 rank 同一步最后完成的操作对齐，再判断是否有某张卡提前失败。不要通过不断增大超时掩盖缺失成员。

### 开销和什么时候别开

异步调度用最多两批的队列重叠调度和执行，EngineCore 最多领先 worker 一步；排错时需将清单与对应批次配对。通信还要求所有成员到齐，一张卡卡住可能让同组其余卡一起超时，报错卡不一定是根因 [D]。同步调试用于定位算子，但关闭图模式后不再代表原来的图回放性能。

超时预算本身不会增加吞吐。调大后，故障请求及其占用的 KV/进程资源可能保留更久，故障反馈也更晚；调小则可能把仍正常运行的长步骤误判失败。需要长等待时先证实正常步骤耗时，并核 HCCL 模式上限；三层等待开始时间不同，不能简单比较数值后认定必然由哪一层先报错。

离线队列等待会积攒所有请求的最终结果，再返回整个列表；一次放入很多长输入、长输出时，应同时规划主机内存与设备缓存。普通 generate / chat 已经能处理一组输入，仅为“一次生成多条”不必拆成提交和等待两步；确实需要分别准备输入、统一收尾时再采用这组接口。

### 版本差异

**核心演进：`v0.30.0`（`c09d3e20`）默认仍走 MRV1（`VLLM_USE_V2_MODEL_RUNNER=1` 可选切 V2），而 `main`（`8d6180e2`）已删除 `model_runner_v1.py` 与旧 `spec_decode/`，通过 `apply_v2_model_runner_config_patch()` 将 [Model Runner V2](model-runner-v2.md) 收口为唯一执行路径。** 读 traceback 认第 3–5 站时，必须先确认当前版本是 MRV1 还是 MRV2：
- **`v0.30.0 (c09d3e20)`**：`NPUWorker.init_device` 默认实例化 `vllm_ascend/worker/model_runner_v1.py` 中的 `NPUModelRunner`（仅当 `use_v2_model_runner` 为真时切换至 `vllm_ascend/worker/v2/model_runner.py`）；MTP proposer 由 `vllm_ascend/spec_decode/__init__.py` 的统一 `get_spec_decode_method` 分派，草稿配置 `model_type == "glm5_next_mtp"` 或 `architectures` 含 `Glm5NextMTPModel` 时才命中白名单 `AscendMultiKVCacheGroupMTPProposer`（不是运行时见多 KV 组就自动选择）；GLM 实现已拆分至 `vllm_ascend/models/glm5next/` 目录。
- **`main (8d6180e2)`**：`NPUPlatform.check_and_update_config` 入口首行即调用 `apply_v2_model_runner_config_patch()` 强制启用 MRV2，`NPUWorker.init_device` 不再有 MRV1 分支（除多模态编码器专用 runner 外统一创建 `vllm_ascend.worker.v2.model_runner.NPUModelRunner`），投机解码栈也收归 `vllm_ascend/worker/v2/spec_decode/`。第 3–5 站的 V2 常驻设备缓冲与调用栈详见 [Model Runner V2](model-runner-v2.md)。
- **离线队列与公共控制流**：下表按四组配套快照（上游 `0fc695fc / 568afb3a / ced6857a / ba15685a` 与 Ascend `2c59ff10 / 2ed6cbba / c09d3e20 / 8d6180e2`）对照；正文七站教学图与 GLM 双机配方仍锚定历史绑定镜像 `db701c1f`（单文件 `models/glm5_next.py` 与 `ops/fused_moe/fused_moe_0_23_0.py`，不与社区发布分支混算）。

| 核对项 | `v0.23.0 (2c59ff10)` / `vllm@0fc695fc` | `v0.26.0rc (2ed6cbba)` / `vllm@568afb3a` | `v0.30.0 (c09d3e20)` / `vllm@ced6857a` | `main (8d6180e2)` / `vllm@ba15685a` |
|---|---|---|---|---|
| 第 3–5 站执行器（MRV1 vs MRV2） | 仅 MRV1（`worker/model_runner_v1.py`） | 仅 MRV1（`worker/model_runner_v1.py`） | **MRV1 默认**，`VLLM_USE_V2_MODEL_RUNNER=1` 可选切 `worker/v2/model_runner.py` | **MRV2 唯一路径**：`model_runner_v1.py` 移除，`platform.py` 强制 V2 补丁，见 [Model Runner V2](model-runner-v2.md) |
| 上游普通文本 `step` | 调度、执行；无直接结果时采样；处理取消后更新 | 保留次序，调度增加 prefill 节流输入 | 同 `v0.26.0rc`；HTTP SSE 辅助移至 `entrypoints/serve/utils` | 同 `v0.30.0`（`core.py#L709-L760`） |
| GLM 模型与 MTP 入口 | 维护分支 `2c59ff10` 无同名模型；专用镜像 `db701c1f` 为单文件 `models/glm5_next.py` + 旧 proposer + `fused_moe_0_23_0.py` | `2ed6cbba` 无同名 GLM 模型链 | `models/glm5next/` 分模块目录；`spec_decode/__init__.py` 按白名单分派 `AscendMultiKVCacheGroupMTPProposer` | `models/glm5next/` 延续；旧 `spec_decode/` 退役，投机栈迁入 `worker/v2/spec_decode/` |
| 离线队列与 `level=0` 暂停 | `enqueue`/`enqueue_chat`/`wait_for_completion`；默认多进程（`VLLM_ENABLE_V1_MULTIPROCESSING=1`）；`level=0` 仅停调度 | `wake_up` 额外检查执行器内存已完全唤醒；UniProc 取出 `AsyncModelRunnerOutput` | 完成暂停时另同步设备；MP 将剩余负 timeout 钳为 0；新增内部 EC 输出聚合 | 延续 `v0.30.0` 离线与公开 RPC 契约（`llm.py#L490-L618`、`envs.py#L1506-L1507`） |
| `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` | 上游默认 300 s；`2c59ff10` 与 `db701c1f` 将 `<1836` 改写为 3000 | 上游默认 300 s；`2ed6cbba` 无平台小值改写 | 上游默认 300 s；`c09d3e20` 平台将 `<1836` 改写为 3000 | 上游默认 300 s；`8d6180e2` 平台延续将 `<1836` 改写为 3000 |
| HCCL 两个超时 | 由安装的 CANN 版本与硬件/展开模式决定（本页 A2 数值限 CANN 9.1.X 文档） | 同左，须独立核运行时 | 同左，须独立核运行时 | 同左，须独立核运行时 |

上表公开 RPC 只核对 UniProc/MP 的默认同步调用，Ray 与自定义执行器按其实现检查；在从未卸载内存的清醒引擎上，先 `level=0` 暂停、后只恢复 `scheduling` 的示例适用于所列四版，若此前做过内存休眠则须先恢复所需内存。后版 prefill 节流条件见[调度器](vllm-scheduler.md)，V1 架构总览见[V1 架构版本表](vllm-v1-shape.md#版本差异)；GLM 双机 DP 协同暂停与实际 AIV 硬件量化等待仍需对应镜像实测。旧 `VLLM_RPC_TIMEOUT` 不适用结论限定固定 GLM 代码，不能将历史单位或其他版本行为移植过来。[!][D]

### 源码位置

超时证据：来源 41 是上游定义默认，12 是两次 RPC 的参数传递、截止时间与队列等待；58 是固定 Ascend 改写，59–60 是 CANN 9.1.X 范围与覆盖规则，61 是配方输入。62–63 对照未知环境变量检查，69 补充严格检查默认关闭；64–68 对照上游三版默认和 Ascend 分支差异。v0.26 rc 的无改写结论还核过整个固定运行包文本，而非仅搜索一个函数。

`v0.30.0` / `main`（及历史候选快照）的入口与分派对应来源 70–76；77–78 补齐超时默认和平台改写。GLM 缓存协调器的静态选择由 79–83 的模型识别与默认、84–86 的缓存标记及分组、87 的 DeepSeek 特判、48 的 Ascend 工厂和 88 的上游工厂共同支撑；不能只凭其中一个函数名推断最终对象。

来源 89–90 对照旧两版的普通 step（包括取消处理），91–93 支持 main 的 GLM 注册、MTP 分派和草稿白名单。发布分支缺少本文同名 GLM 模型的结论，限定于固定 2c59ff10 / 2ed6cbba 的 models 目录树及文本检索，不扩张为所有外部插件都不能支持该模型。

离线队列的官方入口见来源 94；95–97 对应提交、对话模板入口、逐条加入时的异常处理，以及等待全部、仅收最终结果、按编号排序。98–102 与原来源 7 对应默认多进程、立即发送及后台循环和进程内直接 step，103–105 对应暂停与唤醒。106–116、117–128、129–140 依次对照 v0.26 rc、v0.30.0rc2 与固定 main 的相同调用入口和实际消费者；128、140 是新版完成暂停时的设备同步。LLM.enqueue 注释中“不开始处理”的一句话须结合客户端模式阅读，默认后台模式的结论来自实际发送与忙循环，不能只引用这句注释。

公开 RPC：141–144 是四版 Python 签名与用途；145–148 将入口追到当前 EngineCore/执行器，149–152 是四版 UniProc，153–156 是四版 MP 的默认结果收集与截止时间。157–161 区分模型回调、Worker 包装器和方法分派；162–163 接到固定 GLM 的实际 get_model。原来源 13 与新增 164–166 对照 Worker 异常及输出处理边界。这里的两项 A/B 是控制返回示意，没有在 NPU 上执行回调。

**读源码的顺序。** 先确认版本，GLM 的文件名和类名变化见上表；模型文件可能仍写上游类名，运行时对象已被替换，搜索时要追到注册入口。

1. `vllm/v1/engine/core.py`：`EngineCoreProc.run_busy_loop` 和 `EngineCore.step_with_batch_queue`，看一步的骨架。
2. `vllm/v1/core/sched/scheduler.py`：`Scheduler.schedule` 和 `update_from_output`，看第 2、6 站。
3. `vllm/v1/executor/multiproc_executor.py`：`MultiprocExecutor.collective_rpc` 和 `WorkerProc.worker_busy_loop`，看跨进程交接。
4. `vllm_ascend/worker/model_runner_v1.py`：`NPUModelRunner.execute_model` 和 `sample_tokens`，看第 3–5 站，其余方法按调用跳转。
5. `vllm_ascend/models/glm5_next.py`：`AscendGlm5NextDecoderLayer`，看一层怎样分派到 KDA、稀疏 MLA、MoE。

七站的编号沿用[一条请求](one-request.md)，是教学上的分段，源码里没有叫这个名字的东西 [A]。

**一步的骨架**

- 引擎忙循环：`EngineCoreProc.run_busy_loop` → `_process_input_queue` → `_process_engine_step` → `self.step_fn()`。
- `step_fn` 指向 `step` 还是 `step_with_batch_queue`，由批次队列的长度决定：异步调度打开、用 v1 runner、没开流水线并行时 `max_concurrent_batches` 是 2（`vllm@0fc695fc:vllm/config/vllm.py#L497-L507`），于是走后者 [C8]。官方启动命令里没写 `--async-scheduling`，按自动判定它是开着的 [I]，启动日志的 `Asynchronous scheduling is %s.` 那一行可以确认 [C10]。
- 调度器类：异步调度打开时 `get_scheduler_cls` 返回 `AsyncScheduler` [C44]，它除了构造函数 `__init__`（调完父类后只建 `_spec_token_placeholders`、记下 `pp_size`）之外，只重写 `_update_after_schedule` 和 `_update_request_with_output` 两个方法 [C49]。EngineCore 初始化时先 `load_general_plugins()`、再取调度器类（`vllm@0fc695fc:vllm/v1/engine/core.py#L106-L136`），`async_scheduler.py` 在这之后才第一次被导入，所以它的父类应当是已被换名的 `BalanceScheduler` [I]；要实证，可在启动后打印调度器对象的 `__mro__`。
- `step_with_batch_queue` 的普通文本路径见两次 RPC 图；队列已满或没有后续请求可调度时，取最老一批 `future.result()`，再 `update_from_output`。需要前批 token 的结构化输出会延后采样。队列最多装两批，所以 EngineCore 最多领先 worker 一步 [D]。

**进程边界**

| 边界 | 通道与代码 |
|---|---|
| API server ↔ EngineCore | `MPClient` 建一个 ROUTER 口发、一个 PULL 口收；本部署两组引擎跨机器，地址取 node0 的 TCP 端口而不是本机 IPC 路径 [C5] |
| EngineCore → 8 个 worker | `collective_rpc` 把 `(方法名, args, kwargs, output_rank)` 写进 `rpc_broadcast_mq`，`non_block=True` 时返回 future |
| worker → EngineCore | `worker_busy_loop` 取出消息、`getattr(self.worker, method)` 调用，再把结果写回自己的响应队列；本页生成调用指定只读 `output_rank` 那一路，它等于 `world_size − tp × pcp`（pcp 是 prefill 上下文并行的组大小，本部署为 1），算出来是 0 [C14] |
| 每一步的 DP 对齐 | `_sync_metadata_across_dp` 把 `[num_tokens, cudagraph_mode]` 拼成 `2 × dp_size` 的 int32 张量做一次 All-Reduce，默认走 DP 组的 CPU（gloo）组，`dp_allreduce_on_npu` 打开才走 NPU 组 [C28] |
| 两个 EngineCore 之间 | `DPEngineCoreProc.run_busy_loop` 里没活可跑就 `execute_dummy_batch`，每 32 步用 `_has_global_unfinished_reqs` 做一次 All-Reduce [C27] |

`MultiprocExecutor` 在一种情况下会被换成 `AscendMultiprocExecutor`：设了环境变量 `DYNAMIC_EPLB` 或 `EXPERT_MAP_RECORD` 时才导入那个 patch（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L47-L48`），它只重写 `_init_executor`。官方双机部署没设这两个变量，所以本页写的类名在官方配置下成立；开了 EPLB 的部署会在栈里看到另一个类名。

**第 2 站的五处 patch**

| 被换的东西 | 换成什么、什么时候生效 |
|---|---|
| `get_kv_cache_groups` | 按 GLM 的布局把各层分成缓存组，见 `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548` |
| `get_kv_cache_coordinator` | 换成 Ascend 工厂；固定 GLM 配方默认关闭 prefix caching，回上游得到 `KVCacheCoordinatorNoPrefixCache`；显式开启且保留多个缓存组时才走 `AscendHybridKVCacheCoordinator` [C48] |
| `MambaManager` | 换成 `AscendMambaManager`，改的是前缀命中与外部 KV 的分支（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84`） |
| `Scheduler._mamba_block_aligned_split` | 换成对 GLM 按状态存档点对齐切 token 的版本 [C46]；`schedule` 只在 `mamba_cache_mode == "align"` 时调用它（`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263`），官方部署为 `none`，R1 的路径上不执行 |
| `Scheduler` 这个名字与 `EngineCoreProc.run_engine_core` | 指向 `BalanceScheduler` 与补丁版启动函数；`enable_balance_scheduling` 关着时两者都直接转给原来的实现 [C33]，见 [Balance Scheduling](balance-scheduling.md) |

这里的缓存协调器选择由有效配置决定。固定 GLM 同时有不同类型的注意力状态，上游将它识别为 hybrid 模型，生成任务默认关闭 prefix caching，官方配方也未覆盖这一项。它的缓存标记是 glm5_next，不满足工厂中优先的 deepseek_v4 特判；关闭前缀缓存后，即使有多个缓存组，也回到上游的无前缀复用协调器。改成显式开启时再结合组数选择，不能仅凭“混合模型”推断一定使用 AscendHybrid。该结论来自固定源码与配方，实际安装和最终配置仍以启动信息为准。

**七站的函数**

| 站 | 入口 | 往下调 |
|---|---|---|
| 1 | `OpenAIServingChat.create_chat_completion` | `render_chat_request` → `AsyncLLM.add_request`（`process_inputs`，构造 `EngineCoreRequest`）→ `_add_request`（`output_processor.add_request`、`add_request_async`）；选 DP 组见[数据并行](data-parallel.md) |
| 2 | EngineCore 收件经 `preprocess_add_request` 构造 `Request` → `Scheduler.add_request` 入队 → `schedule`（`Scheduler` 上定义；按上述导入顺序推断经 `BalanceScheduler` 转入，待 MRO 验证） | `KVCacheManager.allocate_slots` → 各缓存组管理器 → `BlockPool.get_new_blocks`；收尾 `AsyncScheduler._update_after_schedule`；规则见[调度器](vllm-scheduler.md) |
| 3 | `NPUWorker.execute_model` [C15] | `NPUModelRunner.execute_model` → `_update_states` → `_prepare_inputs` → `_determine_batch_execution_and_padding` → `_build_attention_metadata` |
| 4 | `_model_forward` | `ACLGraphWrapper.__call__` → `AscendGlm5NextDecoderLayer` → `AscendSFAImpl` / `AscendKimiGatedDeltaNetAttention` / `AscendFusedMoE.forward_impl` |
| 5 | `NPUModelRunner.sample_tokens` | `_sample` → `_bookkeeping_sync` → `propose_draft_token_ids` → `_run_merged_draft` |
| 6 | `update_from_output`（`Scheduler` 上定义） | `AsyncScheduler._update_request_with_output` → `_free_request` → `KVCacheManager.free` |
| 7 | `OutputProcessor.process_outputs` | `detokenizer.update` → `RequestOutputCollector` → `chat_completion_stream_generator` |

- 第 3 站整批没有 token 时，`execute_model` 在 `_prepare_inputs` 之前分流：没有 KV 传输组就返回空结果，否则调用 `kv_connector_no_forward`；外部启动器 `external_launcher` 与 DP 同开时，这一分支还先执行 `_dummy_run(1)`，以免组间协调失步（来源 16、57）。本页固定部署不使用外部启动器，它的空闲组陪跑走前述 `execute_dummy_batch` 路径。第 4 站算完 `compute_logits` 把结果存进 `ExecuteModelState` 并返回空值，第 5 站从那里取 [C16]。
- 第 4 站的 `set_ascend_forward_context` 保存宽度和 MoE 通信方式；第 6 站 `_free_request` 后，`finished_req_ids` 随下一份清单通知 worker，`EngineCoreOutputs` 经 ZMQ 回前端。
- `NPUWorker.execute_model` 在这套部署下按 msmonitor 配置计步，已建立 profiler 时也推进剖析步数，然后转交 runner；流水线并行的收发分支因为只有一个 stage 不执行。
- 草拟总走 eager：草稿器初始化时 `_is_glm_model` 为真就把 `use_cuda_graph` 置回 False [C51]；`GLM series models with speculative decoding currently do not support graph mode` 这条警告只在草稿原本要录图（草稿配置没写 `enforce_eager: true`）时才打，官方双机命令写了，所以这套部署不打，见[投机解码的 GLM 双机一节](speculative-decoding.md#落到-glm-双机每步-1--3-个位置mtp-层连跑-3-遍)。

**vllm-ascend 的六个接入点**

| 接入点 | 代码 |
|---|---|
| 平台插件 | 包元数据里的 `vllm.platform_plugins` 入口 `vllm_ascend:register` 返回 `"vllm_ascend.platform.NPUPlatform"`；general plugin 入口里的 `_ensure_global_patch` 调 `adapt_patch(is_global_patch=True)`，注释写明是为了让 EngineCore 子进程里也打上补丁 |
| worker 类 | `NPUPlatform.check_and_update_config` 把 `parallel_config.worker_cls` 设成 `vllm_ascend.worker.worker.NPUWorker` |
| 注意力后端 | `get_attn_backend_cls` 按 `(use_mla, use_sparse, use_compress)` 查表，走通用路径的稀疏 MLA 命中 `(True, True, False)` → `AscendSFABackend`；GLM 的稀疏 MLA 层不经过这张表，后端由层内部的缓存层返回 `AscendIndexerKPoolMLABackend`（`ops/indexer_kpool_mla.py#L78`、`#L136-L137`），该后端直接继承 `AttentionBackend`，和 `AscendSFABackend` 是兄弟类；继承只发生在下一层——实现类 `AscendIndexerKPoolMLAImpl` 继承 `AscendSFAImpl`，元数据类和它的构建器同样各自继承 SFA 的对应类 |
| custom op | `register_ascend_customop` 在 worker 初始化时逐个 `CustomOp.register_oot`；vLLM 是 0.23.0 时将 `FusedMoE` 与 `KimiGatedDeltaNetAttention` 分别替换为 `AscendFusedMoE` 与 `AscendKimiGatedDeltaNetAttention` [C32] |
| patch | 第 2 站的五处见上表 |
| 模型注册 | `Glm5NextForConditionalGeneration` → `AscendGlm5NextForConditionalGeneration`，它内部再按 `Glm5NextForCausalLM` 建文本模型 |

进程名兼日志前缀：EngineCore 进程是 `EngineCore_DP{rank}`，worker 按并行配置拼成 `Worker_DP{}_TP{}_EP{}` [C13]，整体格式是 `(名字 pid=N) `；异常字符串统一见上方「会报什么错」。

- 来源 56：vllm@0fc695fc，vllm/v1/engine/async_llm.py，L408–L412。
- 来源 57：vllm-ascend@db701c1f，vllm_ascend/worker/model_runner_v1.py，L2027–L2057。
- `v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 演进实核：MRV1 默认 vs MRV2 唯一路径见 `vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L498-L518`、`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L622` 与 `vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L618`；两版超时小值改写见 `c09d3e20:platform.py#L942-L950` 与 `8d6180e2:platform.py#L1106-L1114`；`v0.30.0` MTP 统一分派见 `c09d3e20:spec_decode/__init__.py#L41-L69`；上游 `ba15685a` 超时、`step`/`step_with_batch_queue` 与离线入口见 `vllm@ba15685a:vllm/envs.py#L1952-L1954`、`vllm/v1/engine/core.py#L709-L760`、`vllm/entrypoints/llm.py#L490-L618`。
