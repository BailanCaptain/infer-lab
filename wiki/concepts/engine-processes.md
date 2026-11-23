---
id: engine-processes
title: 引擎有哪几个进程：API server、EngineCore 与 Worker
type: concept
legacyAnchors:
  双机部署里一共有哪些进程: 复杂异构实战对照：GLM 双机 20 个进程账
summary: >-
  vLLM 用三类角色协作——API server 收发请求、EngineCore 每步调度、Worker
  执行设备上的模型；客户端模式与 executor（执行器）决定角色如何分布到进程，请求状态、补丁和 Ascend 配置缓存均按进程隔离管理。
aliases:
  - EngineCore
  - Main 进程
  - Worker 进程
  - 进程边界
  - V1 引擎进程
  - 引擎的三类角色
  - patch 注入点
  - uni 执行器
  - 多进程执行器
  - API server 进程
  - 前端进程
  - 进程账
  - 20 个进程
  - DP 协调器
  - headless
  - 进程与执行器
  - 进程与执行器：前端、EngineCore 和 Worker 如何协作
  - 引擎有哪几个进程
  - distributed_executor_backend
  - distributed-executor-backend
  - api_server_count
  - api-server-count
  - data_parallel_address
  - data-parallel-address
  - data_parallel_rank
  - data-parallel-rank
  - data_parallel_rpc_port
  - data-parallel-rpc-port
  - data_parallel_start_rank
  - data-parallel-start-rank
  - ASCEND_RT_VISIBLE_DEVICES
  - VLLM_HOST_IP
  - VLLM_PORT
  - VLLM_ENABLE_V1_MULTIPROCESSING
  - VLLM_WORKER_MULTIPROC_METHOD
  - GLOO_SOCKET_IFNAME
  - HCCL_SOCKET_IFNAME
  - HCCL_IF_IP
  - HCCL_OP_EXPANSION_MODE
  - TP_SOCKET_IFNAME
chapters:
  - '10'
order: 80
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L138-L148'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L173-L253'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L1084-L1100'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L121-L170'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L70-L131'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L100-L109'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L860-L965'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1118-L1137'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L132-L192'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L686-L696'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L997-L1031'
  - 'vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L63'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L776-L780'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L845-L890'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L501-L504'
  - 'vllm@0fc695fc:vllm/utils/system_utils.py#L126-L198'
  - 'vllm@0fc695fc:vllm/envs.py#L892-L894'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L69-L80'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2578-L2598'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L238-L247'
  - 'vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L212'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1168'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L340-L412'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L168-L188'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L80-L157'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L188'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L866-L925'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L47-L50'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L57-L66'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_multiproc_executor.py#L161-L200
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L530-L544'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L1-L40
  - 'vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L403-L410'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L18-L69'
  - 'vllm-ascend@baa023ad:vllm_ascend/__init__.py#L52-L103'
  - 'vllm@568afb3a:vllm/config/parallel.py#L883-L928'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L140-L176'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L561-L580'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L87'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L108-L130'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L127-L149'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L745
  - >-
    raw:sha256-0b04f1f659a97723f3e5a81f307519311a661816e67b32672229cb8d523f468b.md#L1-L1810
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core_client.py#L81-L104
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/executor/uniproc_executor.py#L46-L62
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/executor/multiproc_executor.py#L1-L1062
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L472-L476'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1817-L1956'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L125-L134'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L353-L367'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L61-L148'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L173-L191'
  - 'vllm@0fc695fc:vllm/utils/network_utils.py#L33-L72'
  - 'vllm@0fc695fc:vllm/utils/network_utils.py#L152-L222'
  - 'vllm@0fc695fc:vllm/envs.py#L488-L514'
  - 'vllm@0fc695fc:vllm/envs.py#L663-L671'
  - 'vllm@0fc695fc:vllm/envs.py#L1248-L1250'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L149-L167'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/main.py#L34-L39'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L130-L136'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L234-L247'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L937-L956'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1964-L2102'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2145-L2318'
  - 'vllm@568afb3a:vllm/entrypoints/cli/serve.py#L61-L150'
  - 'vllm@84030bbe:vllm/entrypoints/cli/serve.py#L62-L153'
  - 'vllm@568afb3a:vllm/entrypoints/serve/utils/api_utils.py#L149-L167'
  - 'vllm@84030bbe:vllm/entrypoints/serve/utils/api_utils.py#L149-L166'
  - 'vllm@568afb3a:vllm/envs.py#L479-L505'
  - 'vllm@568afb3a:vllm/envs.py#L687-L692'
  - 'vllm@568afb3a:vllm/envs.py#L913-L915'
  - 'vllm@568afb3a:vllm/envs.py#L1327-L1329'
  - 'vllm@84030bbe:vllm/envs.py#L520-L546'
  - 'vllm@84030bbe:vllm/envs.py#L718-L723'
  - 'vllm@84030bbe:vllm/envs.py#L943-L945'
  - 'vllm@84030bbe:vllm/envs.py#L1411-L1413'
  - 'vllm@84030bbe:vllm/config/parallel.py#L136-L145'
  - 'vllm@84030bbe:vllm/config/parallel.py#L950-L995'
  - 'vllm@568afb3a:vllm/platforms/interface.py#L285-L312'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L116-L126'
  - 'vllm@84030bbe:vllm/utils/network_utils.py#L166-L211'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/cli_args.py#L396-L410'
  - 'vllm@568afb3a:vllm/utils/network_utils.py#L152-L187'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L841-L843'
  - 'vllm@568afb3a:vllm/config/parallel.py#L879-L881'
  - 'vllm@84030bbe:vllm/config/parallel.py#L946-L948'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L417-L425'
  - >-
    https://docs.pytorch.org/docs/2.10/distributed.html#choosing-the-network-interface-to-use
  - >-
    https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/c10d/ProcessGroupGloo.cpp#L493-L567
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_SOCKET_IFNAME.md
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_IF_IP.md
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_OP_EXPANSION_MODE.md
  - 'vllm-ascend@db701c1f:requirements.txt#L16-L17'
  - 'vllm-ascend@db701c1f:Dockerfile.a2#L16-L20'
  - >-
    https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/rpc/tensorpipe_agent.cpp#L163-L185
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/distributed/rpc/tensorpipe_agent.cpp#L155-L180
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/distributed/rpc/backend_registry.py#L216-L298
  - >-
    https://github.com/pytorch/gloo/blob/54cbae0d3a67fa890b4c3d9ee162b7860315e341/gloo/transport/tcp/device.cc#L30-L84
  - 'vllm@ced6857a:vllm/v1/engine/admission_control.py#L13-L52'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L148-L162'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_engine_core.py#L45-L56'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L297-L349'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L760-L777'
  - 'vllm@ced6857a:vllm/entrypoints/cli/serve.py#L179-L263'
  - 'vllm@ced6857a:vllm/config/parallel.py#L962-L1011'
  - 'vllm@ced6857a:vllm/entrypoints/cli/serve.py#L63-L154'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L403-L417'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2163-L2336'
  - 'vllm@ced6857a:vllm/config/parallel.py#L136-L145'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L90-L95'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L123-L134'
  - 'vllm@ced6857a:vllm/envs.py#L507-L533'
  - 'vllm@ced6857a:vllm/utils/network_utils.py#L34-L73'
  - 'vllm@ced6857a:vllm/utils/network_utils.py#L166-L211'
  - 'vllm@ced6857a:vllm/envs.py#L1382-L1384'
  - 'vllm@ced6857a:vllm/config/parallel.py#L962-L964'
  - 'vllm@ced6857a:vllm/envs.py#L930-L932'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/api_utils.py#L149-L166'
  - 'vllm@ced6857a:vllm/utils/system_utils.py#L125-L181'
  - 'vllm-ascend@7d825229:vllm_ascend/__init__.py#L52-L111'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L307-L320'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L514-L527'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L140-L157'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L38-L44'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L966-L1009'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_balance_schedule.py#L892-L899'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_engine_core.py#L31-L72'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L900-L978'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1005-L1038'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1325-L1340'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L465-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L894-L910'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L33-L46'
  - "vllm@0fc695fc:docs/configuration/env_vars.md#L1-L12"
  - 'vllm-ascend@c09d3e20:vllm_ascend/__init__.py#L55-L103'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L309-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L515-L525'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L140-L157'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/__init__.py#L41-L46'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_balance_schedule.py#L892-L899'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engine_core.py#L31-L72'
  - 'vllm-ascend@8d6180e2:vllm_ascend/__init__.py#L55-L110'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L394-L398'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L675-L682'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L169-L190'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/__init__.py#L41-L47'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_balance_schedule.py#L922-L928'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_engine_core.py#L31-L68'
  - 'vllm@ba15685a:vllm/v1/engine/admission_control.py#L13-L25'
  - 'vllm@ba15685a:vllm/config/parallel.py#L165-L175'
  - 'vllm@ba15685a:vllm/entrypoints/cli/serve.py#L54-L190'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 20 个进程是那套双机部署启动时拉起来的；启动的先后七步和 16 卡分组在那一页
  - to: ascend-patch-system
    kind: builds-on
    note: 本页只讲补丁归哪个进程、从哪个入口进；补丁怎样替换名字、有哪几类，在那一页
  - to: platform-plugin-registration
    kind: builds-on
    note: 三类进程都会加载通用插件；插件怎样被发现、平台怎样被选中，在那一页
  - to: vllm-engine-core
    kind: builds-on
    note: EngineCore 进程里的忙循环一步做哪些事，在那一页展开
  - to: vllm-v1-shape
    kind: builds-on
    note: 组件分工与进程布局是两个视角：那一页按组件讲，本页按进程讲
  - to: eplb
    kind: builds-on
    note: 动态 EPLB 会让每个 Worker 再带两个子进程，这正是需要改 Worker 启动方式的原因；EPLB 本身在那一页
  - to: one-request
    kind: builds-on
    note: 本页用示例请求 R1 说明清单只发差量；R1 每一站的数字和块号怎么来，在那一页
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-0b04f1f659a97723f3e5a81f307519311a661816e67b32672229cb8d523f468b.md
  - >-
    raw/sha256-3071e0e23a87ae7750dd02a7250c396941869f41b29049f513d3ffda38aa97cb.md
---

## 一个推理服务为什么是好几个进程

**vLLM 把推理服务分成三类职责：API server 接住用户请求、负责分词与流式吐字；EngineCore 每一步排出调度计划并记账；Worker 驻守设备、真正执行模型前向与采样。**

这三类职责最终落到几个操作系统进程里，由两个开关分别控制：

- **客户端模式**决定 API server 前端是否与 EngineCore 分成独立进程。
- **executor（执行器）**决定 Worker 是否独立成进程。

因此不能把「三类角色」直接等同于「三类独立进程」。例如单进程执行器会让 Worker 住在 EngineCore 进程内，但单凭这一点也推不出 API server 与 EngineCore 在同一个进程里。以常见的单机 `Qwen3-8B` 部署为例：单卡 `vllm serve` 是 2 个进程（1 个 API server + 1 个内置 Worker 的 EngineCore）；单机 TP4 则是 6 个进程（1 个 API server + 1 个 EngineCore + 4 个独立 Worker）。

**进程**是操作系统里一份独立运行的程序，拥有彼此隔离的内存空间。一个进程里的变量、对象和被替换过的函数绑定，另一个进程都看不到；进程间交换数据必须走显式通道，例如 ZMQ 网络/IPC 消息，或划出一块多进程共同读写的共享内存队列。

```wiki-diagram
file: engine-processes
```

用户的 HTTP 请求从 API server 进来，结果也从它回去。图里的箭头是一组卡每一步都在走的几路消息：

- **请求消息，每条请求发一次。** API server 把文字切成 token id，连同采样参数打包，发给 EngineCore。这条请求之后每一步怎么算，都不再由 API server 决定。
- **清单，每一步发一次。** EngineCore 里的 scheduler（调度器）定下这一步算哪些请求、各算几个 token、新产生的 K/V 写进 [KV cache](kv-cache.md) 的哪些块号。executor（执行器）把这份清单（`SchedulerOutput`）交给所有 Worker，再收回结果，详见[后文](#executor-决定-worker-是不是独立进程)。每个 Worker 收到同一份清单，各算自己那张卡上的一份；严格来说，executor 每步对 Worker 发两次调用，一次算到词表分数，一次采样出新 token，见[一步之内](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。
- **本步结果，默认只由一个 Worker 回传。** 同一组卡最后得到的新 token 相同。常规单组部署未配 KV connector 且未开流水线并行（PP）与 prefill 上下文并行（PCP=1）时，executor 只读本组 TP（[张量并行](tensor-parallel.md)）编号为 0 的那个 Worker 的回信，不重复收 N 份。回程通道见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。
- **新 token，每一步发一次。** EngineCore 记完账，把新 token 发回 API server，由它还原成文字，一段一段推给用户。
- **卡间通信（虚线）。** Worker 在计算中途互相交换张量，例如把各卡的部分结果加起来，见[集合通信](collective-communication.md)。这条路只连着 Worker，不经过 EngineCore。

**边界与例外**：

- **结果回传的两种例外**：配置了 KV connector（如 [PD 分离](pd-disaggregation.md)用来跨实例搬运 KV cache）时，每个 Worker 都回传并由 executor 汇总；开启 [PP](pipeline-parallel.md)（流水线并行）时，回传的是最后一段流水线里 TP 与 PCP 编号均为 0 的 Worker。
- **数据并行（DP）与 MoE 的协调消息**：开启 [DP](data-parallel.md)（把卡分成多个各自调度的执行组）时，在线服务通常多出一个 DP coordinator 进程，与 API server 和各 EngineCore 互通忙闲计数。模型为 MoE 时，各 DP 组还需步调一致：coordinator 通知各组一起开工，EngineCore 间每 32 步核对一次「还有没有请求」以决定共同停步，不同 DP 组的 Worker 每步开算前也要对齐宽度。详见[下文](#双机部署里一共有哪些进程)与[四条通道](request-call-chain.md#进程之间的四条通道)。
- **单进程执行器（图左下角）**：使用 `uni` 执行器时，Worker 不另起进程，而是由执行器在 EngineCore 进程内直接创建并调用方法。是否独立成进程由 [executor 的种类](#executor-决定-worker-是不是独立进程)决定，不能只按卡数猜测。

## 拆成几个进程，换来什么、付出什么

拆开进程换来两样收益：

1. **CPU 上的杂活不挡住调度。** 接 HTTP 连接、套聊天模板、分词与反分词都是 CPU 上的 Python 工作，放在 API server 里做，EngineCore 的循环就能专心调度和下发。EngineCore 里还另开两个线程专门收发消息，让编解码与模型计算并行，见[四条通道](request-call-chain.md#进程之间的四条通道)。
2. **每张卡一个进程，直接对应通信域成员。** 通信域是一起做集合通信的一组成员（如同一组 TP 的多个 Worker），成员编号叫 rank。每个 Worker 绑定一张卡，独立持有本卡权重与 KV cache，多卡同时计算并互相交换张量。

代价有三样：

- **交接必须打包成消息，因此清单只发差量。** 跨进程无法直接传递 Python 对象，只能编码发送整数清单。请求第一次被调度时，整份 prompt 和采样参数随清单发给 Worker，由 Worker 缓存在本进程内；之后每一步只发增量——本步算几个 token、新借到哪些块号、以及候选位置（同步时传实际编号，异步时可传占位、实际候选留在 Worker）。
- **同一条请求的状态分三处存放。** EngineCore 记账本，Worker 存资料缓存，API server 存输出队列。请求结束时，EngineCore 必须在下一份清单里带上结束名单，Worker 才会删掉本进程缓存。
- **补丁和配置要逐进程到位。** Ascend 补丁只替换当前进程里的符号指向，配置缓存也是每个进程各存一份，详见[补丁一节](#补丁和配置为什么要每个进程各做一遍)。

读这一页要分清四个词（先以单机 TP4 标准部署如 `Qwen3-8B` 对照，双机多 DP 账目见后文）：

| 词 | 指什么 | 单机 TP4 标准部署 |
|---|---|---|
| 角色 | 做什么事：收发请求、调度、执行模型 | 3 类 |
| 进程 | 操作系统里一份独立的程序，内存各归各 | 6 个（1 前端 + 1 EngineCore + 4 Worker） |
| rank | 通信域里的成员编号，一个 Worker 一个 | 4 个 |
| 节点 | 一台机器 | 1 台 |

## 每个进程里存着什么

**一条请求的状态分存在三类进程里，各存各的一份，每份都跨步留着，直到请求结束。** 一条请求怎样依次穿过这些进程、每一站进哪个函数，见[七站分在三种进程里](request-call-chain.md#七站分在三种进程里)；进程之间的消息各走哪条通道，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。这里只看每个进程里留下了什么。

| 进程 | 跨步一直留着的 | 每步更新的内容或产生的结果 |
|---|---|---|
| API server | 分词器；每条请求的反分词进度和输出队列 | 刚到的请求；这一步要推给用户的那段文字 |
| EngineCore | 等待队列与运行队列；每条请求算到了哪、占了哪些块号 | 这一步的清单；对本步结果的处理 |
| Worker | 本卡的权重分片和 KV cache；请求资料、持久批次及输入缓冲 | 本步填入的输入内容、注意力元数据、中间激活和输出 |

**API server 不是把请求交出去就没事了。** 请求交给 EngineCore 之前，API server 先在自己进程里登记这条请求：给它建一个反分词器和一个输出队列。此后每一步的新 token 都回到这里，反分词成文字再推给用户。请求结束前，这份登记一直在。为什么要先登记再发出，见[API server 入口的第 ⑤ 到 ⑦ 步](api-server-entry.md#怎么做包成引擎请求先登记回程再发出⑤-到-⑦)。

**EngineCore 存的是账本，不是数据。** scheduler 里的请求记录从进来到结束一直在，调度器按预算决定它本步是否上场；它占了 KV cache 的哪几个块，也记在这里。块里真正的 K、V 数值不在 EngineCore，而在各张卡的显存里，归各个 Worker。

**Worker 也记着每条请求。** 因为清单只发差量，Worker 必须自己记住每条请求的 token、已经算到的位置和块表，下一步才能接着拼出输入。这份资料缓存加上跨步复用的「持久批次」，是 Worker 里除权重和 KV cache 外跨步留存的主要状态。输入缓冲也会跨步复用：每步重新填入本轮内容并产出中间激活与结果，不能把内容更新误解成底层缓冲已销毁。

## executor 决定 Worker 是不是独立进程

**executor（执行器）是 EngineCore 进程里负责「把清单交给 Worker、收回结果」的中间层，它的种类直接决定 Worker 落在哪里。** 下图把跨进程 ZMQ 通道、`mp` 与 `uni` 执行器分流，以及下一节要讲的 `fork` / `spawn` 启动隔离机制收在一张总图里，方便先建立全局空间感（在 `v0.30.0` 与 `main` 中，多 API 前端还引入了按 64 字节槽位对齐的 `SharedAdmissionStats` 汇总全局在途请求数，而三类进程的 ZMQ IPC 边界保持不变）：

```wiki-diagram
file: engine-processes-fig-ipc-spawn
```

不手动指定执行器时，普通 Ascend 部署可先按以下四条规则判断；TPU SPMD、CUDA 多节点与卡数检查等完整分支见[怎么开](#怎么开)：

- **整个服务只有 1 张卡：单进程 executor（uni）。** Worker 就在 EngineCore 进程里当场创建，由它初始化设备、加载模型。清单用函数调用递过去，不跨进程。
- **多于 1 张卡：多进程 executor（mp）。** 按本机的卡数，每张卡起一个 Worker 子进程，再建一条共享内存广播队列：每一步清单写进去一次，各 Worker 各读一次。
- **在 Ray 里运行：Ray executor。** 已安装 Ray 并显式提供或处在 Ray 资源组里，或者指定用 Ray 做 DP 后端时，普通 Ascend 路径默认改用 Ray。Ray 是一个分布式计算框架。
- **手动指定了 executor：** 按指定的来，上面几条都不适用。

这里的「整个服务的卡数」要把所有 DP 组算在一起，不是一个 EngineCore 管几张卡。按上述默认选择规则，DP2 × TP1 这种每组只有一张卡的部署，也还是给每个 EngineCore 起一个 Worker 子进程；只有整个服务就一张卡，才默认用单进程 executor。显式指定执行器时，则按所选执行器判断。

官方双机部署落在第二条：

$$\text{world\_size} = \text{PP } 1 \times \text{TP } 8 \times \text{PCP } 1 = 8, \qquad \text{world\_size\_across\_dp} = 8 \times \text{DP } 2 = 16$$

| 维度（双机 GLM 部署） | 计算式 | 结果与执行器选择 |
|---|---|---|
| 一组内的卡数（`world_size`） | $\text{PP } 1 \times \text{TP } 8 \times \text{PCP } 1$ | **8 张卡**（本机起 8 个 Worker 进程） |
| 整个服务的卡数（`world_size_across_dp`） | $8 \times \text{DP } 2$ | **16 张卡**（$> 1$ 且未指定执行器，默认选多进程执行器 `mp`） |

PP 是流水线并行，PCP 是 prefill 阶段的上下文并行，这套部署都没开，取 1。

反过来，进程最少的几种情形是：

- **单卡 vllm serve：2 个进程。** API server 一个；EngineCore 一个，Worker 住在它里面。
- **离线调用：可以只有 1 个进程。** 用 vLLM 的离线接口在脚本里直接生成时，EngineCore 默认也放在单独的进程里；在常规离线调用中，关掉 V1 多进程环境开关、且调用方没有显式强制 enable_multiprocessing=True 时，EngineCore 直接在调用者进程里运行；再使用单进程 executor 时，可以只剩 1 个进程。API server 用的异步引擎不支持这种关法，一定是独立的 EngineCore 进程。

## 补丁和配置为什么要每个进程各做一遍

**Ascend 的补丁，就是在某个 Python 进程里把上游的某个名字改指向昇腾的实现；Ascend 的配置缓存，是某个 Python 进程里的一个模块变量。两样东西都只属于做了这件事的那个进程。**

vllm-ascend 不改 vLLM 的源码，而是在程序运行起来以后，把上游某些函数、类换成自己的版本，这叫 **patch**（补丁）。「换」改的是当前进程里这个名字指向谁，其他进程里的同一个名字不受影响。替换怎样生效、有哪几类，见 [Patch 机制](ascend-patch-system.md)。

Ascend 的配置也一样。vllm-ascend 把自己的一组开关（从启动参数的附加配置里读出来）整理成一个配置对象，缓存在模块级的变量里，之后各处代码都来这里取。这个缓存同样是进程里的一个变量：API server 在建总配置时建一份，每个 Worker 在初始化时按传进来的总配置再建一份。某个进程里改了它，别的进程看不到；某个进程里没建就去取，会直接报错。

**子进程出生时带不带父进程的状态，取决于启动方法。** vLLM 拉起 EngineCore 和 Worker 共用环境变量 `VLLM_WORKER_MULTIPROC_METHOD`：底层库读取该变量时默认 `fork`，而 `vllm serve` 命令行入口在环境未预设时会先填入 `spawn`，两层默认不能混为一谈：

- **`fork`**：子进程在出生瞬间拷贝父进程的内存快照，父进程里已换好的函数绑定和已建好的 `AscendConfig` 会原样带过去；但出生后父子内存立刻分道扬镳，互不可见。
- **`spawn`**：子进程启动一个全新的 Python 解释器并从头导入模块，父进程里打过的补丁一个都不在。遇到当前进程已初始化设备运行时、运行在 Ray 里或开启 NUMA 绑定等强制条件时，vLLM 也会自动覆写为 `spawn`。

官方 GLM 教程没有显式设置该变量：若镜像或启动环境也没有预设，`vllm serve` 的命令行初始化会走 `spawn`；若环境已有值则先保留，随后仍须通过强制 `spawn` 条件检查。因此实际运行方式要核对镜像环境，不能仅因教程未写变量就推定是 `fork`。

**所以 vllm-ascend 在每类进程里都留了一个入口，不管用哪种启动方法，每个进程最后都打齐了补丁：**

| 进程 | 在哪一刻打 | 打什么 |
|---|---|---|
| API server（node1 上是启动进程） | 解析命令行参数时：先加载通用插件，再调用平台准备钩子 | 全局补丁 |
| EngineCore | 初始化时，vLLM 在这个进程里再加载一次通用插件 | 全局补丁，本进程已经打过就跳过 |
| Worker | 昇腾 Worker 的构造函数一开始 | Worker 补丁；随后登记昇腾算子、建本进程的 Ascend 配置 |

中间那一行最不直观。vllm-ascend 注册了四个通用插件入口，其中三个的第一件事都是「确认本进程已经打过全局补丁」，没打过就打，打过就跳过；「打过没有」的标记本身也是进程里的一个变量。它的代码注释写明了理由：vLLM 会在 EngineCore 子进程里加载通用插件，而测试框架在主进程里打补丁的那些钩子不会在那个进程里运行，所以影响 scheduler 和引擎代码的全局补丁必须借这些入口再打一次。用 fork 时，这一步什么都不用做，补丁和标记在出生时已经带过来；用 spawn 时，EngineCore 里的补丁只能靠这一步打上。

**EngineCore 里被换掉的，是调度相关的代码。** 全局补丁里均衡调度的那个补丁同时换掉了两样东西：把上游 scheduler 类换成 BalanceScheduler，把 EngineCore 进程的入口函数换成昇腾的版本；入口函数只在打开均衡调度时才走昇腾的循环，否则转回上游原版。官方 GLM 部署没有打开均衡调度，见 [Balance Scheduling](balance-scheduling.md)。最后实例化哪个 scheduler 类，还取决于异步调度开没开，见[异步调度](async-scheduling.md)。所以「EngineCore 里跑的全是上游原样的代码」这个说法不成立。

**Worker 补丁跟着 Worker 走，不挑进程。** 使用 uni 时，Worker 在执行器所在进程里创建，补丁也打在该进程；使用 mp 时，每个 Worker 子进程各打一遍，官方双机部署一共打 16 遍。

```wiki-diagram
file: engine-processes-startup
```

图从上往下看：启动进程先打全局补丁、建 Ascend 配置；拉起 EngineCore 时按启动方法分两路，汇合到 EngineCore 自己的入口再确认一遍；然后按执行器分两路，两路都会走到 Worker 的构造函数，在那里打 Worker 补丁、建本进程的配置。由此得出排查的原则：**补丁或配置「没生效」，要到出问题的那个进程里去查，看 API server 的状态说明不了 Worker。**

## 进程怎么摆，直接决定要打哪些补丁

进程模型不只是背景知识，它直接决定昇腾要改哪里。以动态 [EPLB](eplb.md)（按专家热度在线重排专家分布）为例：开启后，每个 Worker 都要再派生两个子进程——一个管共享字典的管理进程，一个计算新摆法的进程。

上游创建 Worker 时默认设为 `daemon=True`（父进程退出时自动终止的守护子进程），而 Python 禁止 daemon 进程再派生子进程。因此 `vllm-ascend` 用补丁改写多进程执行器的 Worker 创建代码，把 Worker 改为非 daemon（EPLB 自己派生出的子进程仍保留 `daemon=True`）。这条补丁的两项硬约束都由进程模型决定：

| 补丁特征 | 为什么必须这样设计 | 触发条件与误配后果 |
|---|---|---|
| **放在全局补丁，而非 Worker 补丁** | 创建 Worker 的逻辑跑在 `EngineCore` 进程里、早于任何 Worker 出生；等 Worker 补丁运行时子进程早已按上游方式起好（官方补丁设计文档也以运行进程划目录） | 归属 `patch/platform` |
| **靠环境变量触发，而非配置文件** | 全局补丁在参数解析期导入，早于 `AscendConfig` 构建 | 须设 `DYNAMIC_EPLB`（转小写为 `"true"` 或 `"1"`）或 `EXPERT_MAP_RECORD`（精确小写 `"true"`）；只配 JSON 不设变量会直接报错 |

`v0.30.0` 与 `main` 将 EngineCore 入口包装收束到 `patch_engine_core.py`，进入引擎前就先调 `init_ascend_config` 建立本进程配置缓存；动态 EPLB 对 Worker 创建路径的补丁条件保持不变。官方 GLM 双机部署未开 EPLB，Worker 沿用上游默认启动方式。

## 复杂异构实战对照：GLM 双机 20 个进程账

**按核心角色计，官方 GLM-5.3-Flash 双机部署（例外 B 绑定算例，2×A2×8、TP8/DP2/EP16）跑起来共 20 个进程：node0 上 11 个，node1 上 9 个，占卡的只有 16 个 Worker。** 部署参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)，拉起顺序见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。

| 机器 | 进程 | 个数 | 做什么 | 进程名 |
|---|---|---|---|---|
| node0 | API server | 1 | 选定硬件平台、拉起 DP coordinator 与本机 EngineCore；接 HTTP、分词与路由到对应 DP 组 | 执行 `vllm serve` 的启动进程 |
| node0 | DP coordinator | 1 | 汇总两个 DP 组忙闲计数；协调两组 MoE 一起开工、一起停下 | `VLLM::DPCoordinator` |
| node0 | EngineCore（DP 组 0） | 1 | 调度 DP 组 0 的请求，管理本组 KV 块号 | `VLLM::EngineCore_DP0` |
| node0 | Worker（卡 0–7） | 8 | 各守一张卡，执行模型前向与采样 | `VLLM::Worker_DP0_TP0_EP0` 等 |
| node1 | EngineCore（DP 组 1） | 1 | 调度 DP 组 1 的请求，管理本组 KV 块号 | `VLLM::EngineCore_DP1` |
| node1 | Worker（卡 8–15） | 8 | 各守一张卡，执行模型前向与采样 | `VLLM::Worker_DP1_TP0_EP8` 等 |

进程标题需安装 `setproctitle` 才会改写；API server 不改标题，列表里直接显示启动命令。四点口径边界：

- **node1 为何没有前端与 coordinator**：node1 带 `--headless` 启动，只拉起本机 EngineCore 并向 node0 握手报到；全部请求经 node0 前端按忙闲派发（见[数据并行](data-parallel.md)）。
- **DP coordinator 为何独立成进程**：它不碰请求正文，只定时汇总两组忙闲数推给前端；对 [MoE](moe.md) 模型，它还协调两组同步开工与停步。
- **每个 EngineCore 为何带 8 个 Worker**：每组内为 [TP8](tensor-parallel.md)，全局 Worker 编号为「DP 组号 × 8 + 本机卡号」（node1 卡 0 即全局 8 号，16 卡分组见[双机部署页](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。
- **「20 个」的统计范围**：仅计 1 前端 + 1 coordinator + 2 EngineCore + 16 Worker。node1 留驻监视存活的 `vllm serve` 守护启动进程（按系统列表两机共 21 个 vLLM 进程）、Python/编译辅助进程与 EPLB 子进程均不计入角色账。

## 排查时先认是哪个进程

看到报错先认出它落在哪个进程，就能缩掉大半排查面：

| 调用栈特征 | 所在进程 | 代码归属与排查方向 |
|---|---|---|
| 参数校验报错（如并行组合不合法） | API server 或 node1 启动进程 | 查 [NPU 平台](npu-platform.md) 前置校验组 |
| `Scheduler`、KV 块管理、清单构造 | EngineCore 进程 | 主体是上游代码，昇腾仅经全局补丁介入 |
| 模型前向、注意力、昇腾算子 | Worker（`mp` 独立子进程；`uni` 在执行器同进程） | 大多是 `vllm-ascend` 代码，不可只凭卡数猜进程归属 |

日志前缀与进程名告诉你代码**在哪里跑**，堆栈文件路径告诉你代码**是谁写的**；把 PID、全局 rank、卡号和 executor 类型合起来对照，就能串起三类进程日志。按日志前缀认站见[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)，报错原文见下半[会报什么错](#会报什么错)。

## 常见误解

- **「补丁在 API server 里打一次，就全局生效了」**：用 fork 时，只有子进程出生那一刻已经打好的补丁会被带过去；用 spawn 时什么都不带。子进程出生以后，父进程再改什么都传不过去。vllm-ascend 正因为这样才在每类进程里各留一个入口。
- **「Worker 一定是单独的进程」**：整个服务只有一张卡、又没有手动指定 executor 时，它是 EngineCore 进程里的一个对象。
- **「一个 EngineCore 只管一张卡，就会用单进程 executor」**：默认选择看的是整个服务的卡数；没有显式指定执行器时，DP2 × TP1 仍然每组起一个 Worker 进程。
- **「进程列表里数出来不是 20 个，部署就错了」**：20 是按角色计的；node1 的启动进程、各种辅助进程和特性另起的进程都不在账内。
- **「API server 把请求交出去就没它的事了」**：每一步的新 token 都回到它这里反分词、推给用户，请求结束前它一直登记着这条请求。
- **「Worker 每一步收到的都是完整的请求，算完就全丢」**：只有第一次调度发整份，之后只发差量；Worker 自己缓存着每条请求的资料，直到清单里的结束名单通知它删除。
- **「EngineCore 里跑的全是上游代码」**：调度的主体是上游的，但 scheduler 类和 EngineCore 进程的入口函数都被全局补丁换过，见上文。
- **「这几个进程是昇腾引入的」**：这是 vLLM 自己的进程模型，昇腾只是必须适配它；除了 EPLB 这类特性，vllm-ascend 不另起进程。

## 对照源码

### 怎么开

**先分清要连的是哪一层。** 用户请求进 HTTP 前端；前端通过 DP 地址与 RPC 端口找到远端 EngineCore；Worker 另有设备与内部通信配置。HTTP 的 host/port、DP 主地址/握手端口、VLLM_HOST_IP/VLLM_PORT 不是同一对设置。DP 总数和本地数的定义在 [DP 参数参考](data-parallel.md#怎么开)，TP 和 EP 的约束分别在 [TP](tensor-parallel.md#怎么开)、[EP](expert-parallel.md#怎么开)，这里讲进程与启动连接。

**headless 只决定不提供 HTTP 接口，后面仍有两种不同的启动路径。** 先看卡是合成同一个 DP 执行组，还是分属多个 DP 组，再决定怎样编号和会合：

| 要连接的布局 | 远端启动什么 | 配置与学习入口 |
|---|---|---|
| 一个 DP 执行组跨多节点做 PP/TP | 组内非首节点直接创建多进程 Executor 和本地 Worker；不为该节点另建一个 DP EngineCore | nnodes、node-rank 与 master 地址端口组织这一组；各节点启动匹配命令，见[两机 PP 示例](pipeline-parallel.md#怎么开) |
| 多个 DP 组分在不同节点 | 远端创建自己的 EngineCore，由它管理本组 Worker，并向提供前端的节点握手 | 全局/本地 DP 数、start-rank 与 DP 地址/RPC 端口，见下面的固定 GLM 组合及[DP 解释](data-parallel.md) |

本站 GLM 是后一种：PP1、每组 TP8、DP2，EP16 让两组在专家层协作。它不是把单个 TP8/PP2 执行组分到两台；不能只因命令有 headless 或两台机器，就把两种布局的节点编号与 DP 编号互换。固定入口按组内节点编号选择上述路径，前面的 20 个角色进程账只对应本站 GLM 配方。

| DP 启动参数 | CLI 短名 / Python 同名入口 | 输入缺省与实际处理 |
|---|---|---|
| data_parallel_address | --data-parallel-address / -dpa；EngineArgs、LLM | str 或 None，默认 None。显式地址优先；普通 mp 未给时取 master_addr，否则回退 127.0.0.1；Ray 分支取 get_ip。远端必须能访问主节点地址，回环地址不能代表另一台机器 |
| data_parallel_rpc_port | --data-parallel-rpc-port / -dpp；EngineArgs、LLM | int 或 None，输入默认 None，配置缺省 29550；有远端引擎时用于握手，纯本地可用 IPC。本站两端显式 12321；不是由 VLLM_PORT 替代 |
| data_parallel_rank | --data-parallel-rank / -dpn；EngineArgs、LLM | int 或 None，输入默认 None，派生后配置 rank 默认 0 且 ≥0、应小于 DP 总数。显式给值会选择外部负载均衡模式；不应拿来替换本站的 start_rank |
| data_parallel_start_rank | --data-parallel-start-rank / -dpr；EngineArgs、LLM | int 或 None，输入默认 None。本机连续多个 DP 组从哪个全局编号起步；本站两端为 0/1。基线在 local 已给且非零 start_rank、非 headless 时推断 hybrid；local=1 又切为外部模式 |

这些字段的输入默认与派生见来源 55–57。显式 rank 分支要求 local 为 1 或 None；hybrid 表示“本机前端在本机多个组内分配请求”，需要本地组数。本站 node1 的 headless 分支避免把 start_rank=1 推成这种前端模式。注意 CLI 在决定前端数时，检查的是 start_rank 是否为 None，0 也算已给；基线 EngineArgs 的上述推断却检查是否非零。这两步不同，升级差异见下表。

**HTTP 前端是否存在，由 serve 入口决定。** headless 与 api_server_count 是 CLI 前端项，不是 EngineArgs / 离线 LLM 的同名配置字段（来源 58–60）。

| 参数 | 类型与输入默认 | 行为及联合条件 |
|---|---|---|
| --headless | store_true，默认 False；省略表示不主动选 headless | True 时把 API 数设成 0；若同时显式给正 api_server_count，立即拒绝。本站 node1 使用，node0 不用 |
| --api-server-count / -asc | int，默认 None | 不是固定默认 1。普通内部 LB 取全局 DP 数；外部 LB、多端口模式、旧版 Rust 前端取 1；hybrid 取 local 或 1。显式 1 使用当前启动进程；大于 1 建多个前端进程；小于 1 走 headless 路径 |

负的 API 数在本固定入口也落入“小于 1”，并没有单独的非负字段校验；使用清楚的 headless 或 0 表达无前端。Rust 前端将大于 1 的显式值改为 1，弹性 EP 也会把多前端上限压到 1；这些是条件覆盖，不能将 api_server_count 当成无条件兑现的进程数。headless 还要求 local>0，拒绝 hybrid。前端数量改变时，前面“20 个”的官方配置账不能直接沿用。

**把本站两端组合起来看。** 以下只摘启动拓扑；模型、量化、MTP、图、显存和网络环境仍完整采用[部署页命令](glm-5-3-flash-two-node.md#怎么开)。两端可见设备都列本机 0–7，共同使用 TP8、DP2、local1、EP；node0_ip 为两机都能访问的 node0 地址。

```bash
# 两端共同的拓扑部分
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
# vllm serve <模型路径> ... 两端都带：
# --tensor-parallel-size 8 --data-parallel-size 2
# --data-parallel-size-local 1 --enable-expert-parallel

# node0 的差异项
# --data-parallel-start-rank 0 --data-parallel-address "$node0_ip"
# --data-parallel-rpc-port 12321 --api-server-count 1
# node1 的差异项
# --data-parallel-start-rank 1 --data-parallel-address "$node0_ip"
# --data-parallel-rpc-port 12321 --headless
```

node1 的本机可见设备仍写 0–7；8–15 是全局 Worker 编号，不能填成 node1 的本机卡号。两端的 DP 主地址与 RPC 端口相同，起始 DP 编号不同；VLLM_HOST_IP 若显式设置，则各填本机通信地址。上述参数组合只解释源码与教程，不替代真实双机连通性和镜像检查。

| 环境变量 | 缺省、格式与实际作用 | 特殊值与相互作用 |
|---|---|---|
| ASCEND_RT_VISIBLE_DEVICES | Ascend 选用的设备控制变量，逗号分隔的本机设备列表；教程明确给 0–7，不是框架默认八卡 | 基线的编号映射按列表顺序取元素并转 int；逻辑 0 对应列表首项。未设/空串时该映射辅助函数直接返回原编号，不能据此推断 CANN 的空串可见性或隐藏全部卡；设备实际是否可见仍由运行时决定 |
| VLLM_HOST_IP | str，库读取缺省空串；非空时 get_ip 直接采用，否则先探测 IPv4、再 IPv6，失败告警并回退 0.0.0.0 | 使用本机内部通信地址，不是 HTTP --host 或 DP 主地址的别名。旧 HOST_IP 在未设本变量时被警告并忽略，不能靠它代填 |
| VLLM_PORT | 未设为 None；设置时按十进制整数解析，作为内部动态端口选择的起点 | 未设走系统分配空闲端口；设定后端口占用则向上找，分配多端口时逐个推进。它不保证只使用一个端口，也不设置 HTTP --port 或固定 DP RPC 端口；空串/非整数拒绝，URI 值另提示服务发现变量冲突 |
| VLLM_ENABLE_V1_MULTIPROCESSING | bool(int(环境字符串))，默认字符串 1；通常用 1 开、0 关 | 不是解析 true/false 的布尔字典：文字 true/false 会整数转换失败，其他非零整数为真。主要决定离线 EngineCore 客户端是否跨进程，不决定 mp 执行器是否另起 Worker；异步在线客户端不支持关闭后改用进程内模式 |
| VLLM_WORKER_MULTIPROC_METHOD | 合法字符串 fork / spawn；库 getter 默认 fork，CLI 未预设时填 spawn | 显式值先保留；Ray actor、NUMA 绑定、已初始化 CUDA/XPU、WSL 等强制条件仍可改成 spawn。库脚本用 spawn 时要把启动调用放在主入口保护内，避免子解释器再次启动引擎 |

环境解析与通信辅助函数见来源 61–69；启动方法库默认另见来源 19。这里没有把空字符串当成统一的“自动”语法：每个变量都有自己的读取规则。内部端口还需落在操作系统允许绑定的范围且可用；VLLM_PORT 本身的解析器只有整数检查，main 对 DP RPC 字段增加的范围约束不能倒灌到这个环境变量。

**Kubernetes 的服务发现变量可能与内部端口重名。** 若先创建名为 vllm 的 Service，再在同一命名空间创建启用服务环境变量注入的 Pod，容器可能得到形如 `VLLM_PORT=tcp://10.0.0.20:8000` 的值。vLLM 读取这个变量时要求整数，因而在端口解析阶段就报错；修改 HTTP 的 --port 不会消除环境中的 URI。排查时查看容器实际继承的 VLLM_PORT 及其来源，避免使用会生成同名变量的 Service 名称，并按需要显式设置内部端口的整数起点。修改部署后重新创建相应进程，再核对环境；服务发现地址、HTTP 监听端口与内部通信端口仍是三件事。

**双机通信先选对本机接口，再选算子执行方式。** Gloo 是 CPU 侧集合通信后端，vLLM 建设备组时还会建一个 Gloo CPU 组；HCCL 是设备集合通信库。它们各自选网卡，设置了其中一个不会自动替另一个选好。下表 HCCL 规则按 CANN 9.1.X 的 A2 条目解释；固定 A2 Dockerfile 使用 9.1.0，实际安装版本需与镜像核对。

| 环境变量 | 格式、缺省和作用 | 本部署与覆盖关系 |
|---|---|---|
| GLOO_SOCKET_IFNAME | 本机接口名称字符串，精确匹配；逗号可列多接口。未给时按 hostname 找本地地址，失败告警并回退 loopback，不保证选到跨机接口 | 两端各填 local_ip 所在接口；多接口会轮转使用，各进程须给相同数量。PyTorch 2.10 源码只在字符串长度大于 1 时走显式列表，空串/单字符走默认分支 |
| HCCL_SOCKET_IFNAME | 本机 Host 网卡的匹配列表，用于初始化时联系 root；eth 是前缀，=eth0 是精确名，^eth 排除前缀，^=eth0 排除精确名；逗号多项取首个匹配，不按 Gloo 的规则轮转 | 未设优先按名称排序选非 docker/lo 接口，再回退 docker、lo；教程给 nic_name。精确选择可写 export HCCL_SOCKET_IFNAME="=eth0" |
| HCCL_IF_IP | 单个本机 Host IPv4/IPv6 地址，直接指定初始化使用的地址；不是设备侧 NPU IP，无固定默认地址 | 优先于 HCCL_SOCKET_IFNAME；教程各填自己的 local_ip，不能两端都填 node0_ip。未设时才由接口选择路径决定 |
| HCCL_OP_EXPANSION_MODE | A2 的算子展开模式字符串：HOST（默认）、HOST_TS、AI_CPU、AIV；不支持的值回默认。AIV 把通信算子展开与执行放到 Vector Core | 教程显式 AIV；通信域 HcclCommConfig.hcclOpExpansionMode 可优先覆盖环境值。它不选择网卡，也不替代 EP 开关 |

例如 node0 的本机接口是 eth0、node1 是 enp1s0，两边可分别填写自己的名字；关键是对应地址能互通，不是字符串必须相同。启动前两端都继承这些 export，拓扑与完整命令仍以[部署页](glm-5-3-flash-two-node.md#怎么开)为唯一出处。改当前 shell 的环境不会重新配置已经创建的通信组，需要重启服务后核对日志。

AIV 只支持文档列出的对称组网推理路径，不支持多个 AIV 通信域并行执行；算子、数据类型和图模式也各有限制。不能由一个全局 AIV 值推断每条 EP/MC2 通信都使用相同路径。尤其执行等待上限随模式变化，见[通信与 Worker 超时](request-call-chain.md#怎么开)；缓冲大小见[HCCL buffer](hccl-buffer.md#怎么开)。

其他枚举也不是同义词：HOST 与 HOST_TS 都在 Host CPU 展开，前者自动选调度器，后者明确交给设备 task scheduler；AI_CPU 则在设备 AI CPU 展开，A2 下只覆盖 AllGather、AlltoAll、AlltoAllV、AlltoAllVC，Ascend IR/aclgraph 同卡并发图不超过 6。A2 的 AIV 也有双机场景边界：AlltoAllV/AlltoAllVC 仅单机，图模式的 AlltoAll/AllGather/ReduceScatter 也仅单机，不能把普通 HCCL 算子支持表直接套给 MC2 自有算子。若另设 HCCL_DETERMINISTIC=true 或 strict，确定性要求优先，某些情况下 AIV 不生效；排障时须确认实际路径而非只看 export。

**教程中的 TP_SOCKET_IFNAME 要单独识别。** 这里的 TP 指 TensorPipe，即 PyTorch 的另一套跨进程 RPC 后端，不是张量并行 TP8。固定 torch 2.10.0 与 torch_npu 2.10.0.post2 都在 TensorPipe agent 中读取它；torch_npu 导入时注册后端不等于创建 agent。所查固定 vLLM/Ascend 运行包没有启动该 RPC 后端，当前 mp/Gloo/HCCL 主路径不消费这个配置。保留教程原文供对照即可，不能用它替代 GLOO_SOCKET_IFNAME；另外引入 TensorPipe 的扩展需另核其初始化路径。

**executor** 由 `--distributed-executor-backend`（配置项 `distributed_executor_backend`）指定，取值 `mp`、`uni`、`ray`、`external_launcher`，或一个自定义 executor 类的路径。不指定时：

- `world_size = pipeline_parallel_size × tensor_parallel_size × prefill_context_parallel_size`；`world_size_across_dp = world_size × data_parallel_size`。
- `world_size_across_dp > 1` 时先以 `mp` 为候选，随后按顺序择一：TPU 开 SPMD 选 `uni`；CUDA 且 `nnodes > 1` 保留 `mp`；其余 CUDA 配置若本机卡数少于 `world_size` 则报错；之后才检查 DP 后端为 Ray，或已安装 Ray 且显式提供/当前处在 placement group，此时选 `ray`。最后，若仍未指定且 `world_size == 1`，定为 `uni` [C16]。
- `UniProcExecutor._init_executor()` 在当前进程里 `WorkerWrapperBase(rpc_rank=0)` → `init_worker` → `init_device`，随后加载模型 [C14]。`MultiprocExecutor._init_executor()` 建 `rpc_broadcast_mq`，再按 `local_rank in range(local_world_size)` 逐个 `WorkerProc.make_worker_process(..., input_shm_handle=scheduler_output_handle)` [C10]；上游子进程是 `daemon=True`，名字 `VllmWorker-{rank}`。
- 官方双机：TP8、DP2，`world_size = 8`、`world_size_across_dp = 16`，未指定 executor，所以两台都用 `mp` [D]。

该字段输入默认 None；EngineArgs 和离线 LLM 使用同名参数。自定义入口可传类或完整类路径，但解析后必须是 Executor 子类（来源 47）。external_launcher 表示进程由外部启动器组织，还会把 V1 多进程环境项改为 0（来源 92–94），不能把它当作 mp 的另一个名字。显式 uni 只在当前执行器里创建一个 Worker，不能用它替代本站 TP8 所需的八个 Worker；默认选择 uni 的条件，也不能反过来证明所有显式 uni 组合只允许整个服务一张卡。

**启动方法的两层默认。** 库读取变量时默认 fork [C19]；CLI 调用 cli_env_setup，在环境未定义时写 spawn（来源 66、67）。get_mp_context 先检查强制条件；已是 spawn 时直接返回，不因此额外告警。只有需要覆盖非 spawn 值时，才改写并记录原因 [C18]。官方 GLM 教程两端均未设置该变量 [S1]，因此环境也未预设时，走 CLI 的 spawn 默认。

**两台机器各起什么**：

- node0 `--api-server-count 1`：`ServeSubcommand.cmd` 直接在本进程里 `uvloop.run(run_server(args))`，注释写的是 "Single API server (this process)" [C2]。`run_server` 经 `launch_core_engines` 建 `CoreEngineProcManager`，后者用 `context.Process(target=EngineCoreProc.run_engine_core, name="EngineCore_DP{i}")` 拉起引擎进程。
- node1 `--headless`：`run_headless` 建 `CoreEngineProcManager` 拉起本机引擎后，在本进程里 `monitor_engine_liveness()`，直到关停 [C3]。这就是不在进程账里的那个启动进程。
- DP coordinator：`needs_dp_coordinator and not offline_mode and dp_rank == 0` 时才建，MoE 模型打开 wave coordination [C4]；`needs_dp_coordinator` 在 DP > 1 时为真，只有非 MoE 模型又用外部负载均衡（`data_parallel_external_lb`）时例外，见 `vllm/config/vllm.py:561-580`。coordinator 是 `context.Process(target=DPCoordinatorProc.run_coordinator)`，进程标题 `DPCoordinator`。

**API server 与 EngineCore 之间的客户端**：`EngineCoreClient.make_client` 不支持「asyncio 但不开多进程」，所以 `AsyncLLM` 一定用独立的 EngineCore 进程；DP > 1 且用内部负载均衡时是 `DPLBAsyncMPClient`。离线 `LLMEngine` 由 `VLLM_ENABLE_V1_MULTIPROCESSING` 决定，关掉时用 `InprocClient`，EngineCore 在调用者进程里。`AsyncLLM.add_request` 先在本进程 `output_processor.add_request(...)` 登记，再 `engine_core.add_request_async(request)` 发往另一个进程，源码注释分别写着 "(this process)" 与 "(separate process)"。

**三条补丁入口**：

| 进程 | 入口 |
|---|---|
| API server / 启动进程 | `AsyncEngineArgs.add_cli_args` 先 `load_general_plugins()`，再 `current_platform.pre_register_and_update(parser)`；昇腾的 `NPUPlatform.pre_register_and_update` 里 `adapt_patch(is_global_patch=True)` |
| EngineCore | `EngineCore.__init__` 开头 `load_general_plugins()`，注释 "plugins need to be loaded at the engine/scheduler level too"；`register_connector` / `register_model_loader` / `register_service_profiling` 第一行 `_ensure_global_patch()`，`register_model` 不调 [C28] |
| Worker | `WorkerWrapperBase.init_worker` 里 `load_general_plugins()`；`NPUWorker.__init__` 开头 `adapt_patch()`，随后 `register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)` [C31] |

- `adapt_patch` 只做一件事：`import vllm_ascend.patch.platform`（全局）或 `import vllm_ascend.patch.worker`（Worker）。同一个解释器里模块只执行一次，所以 fork 出来的子进程再导入是空操作，spawn 出来的新解释器导入时才真正执行替换 [D]。
- `load_general_plugins()` 用进程内的 `plugins_loaded` 去重，docstring 提醒插件会在不同进程里被加载多次；`_GLOBAL_PATCH_APPLIED` 同理。`_ensure_global_patch()` 的 docstring 写明了 EngineCore 这条路的理由：vLLM 在 engine-core 子进程里加载 general plugin，E2E 测试的 conftest hook 在那里不跑。
- 官方补丁设计文档把 `patch/platform` 定为「vLLM 主进程」的补丁，`patch/worker` 定为「Worker 进程」的补丁，写补丁的第二步就是「决定该打在哪个进程」[C40]。

**Ascend 配置缓存**：模块变量 `_ASCEND_CONFIG`；`init_ascend_config` 在 `NPUPlatform.check_and_update_config` 里调用（由 `VllmConfig.__post_init__` 触发，发生在建总配置的进程里），也在 `NPUWorker.__init__` 里调用；同一个 `vllm_config` 对象、没有 `refresh` 时复用缓存 [C33]。

固定 GLM 的 EngineCore 还有一次进程内初始化：正常退出启动握手的上下文后，重新执行配置的 post_init，经平台检查建立或刷新本进程的 Ascend 配置。它发生在 EngineCore、Scheduler 和收发线程构造之后，不能说这些对象构造前已经完成，更不是 spawn 继承了父进程缓存。旧 Balance 入口在更早读取不到缓存时，会回退读取 additional_config 与环境；rc2 的初始化位置则提前到 EngineCore 入口包装函数中，见下面的版本表。

**EngineCore 里换掉的调度代码**：`patch/platform/__init__.py` 无条件导入 `patch_balance_schedule` [C34]；它在模块末尾 `EngineCoreProc.run_engine_core = run_engine_core`、`vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler`，新入口在 `_balance_scheduling_enabled` 为假时调回原版 [C37]。`get_scheduler_cls` 在调用时刻才 `from vllm.v1.core.sched.scheduler import Scheduler`，未开异步调度时拿到的是替换后的类；开了异步调度返回 `AsyncScheduler`。

**EPLB 的 Worker 启动补丁**：`patch_multiproc_executor` 只在 `DYNAMIC_EPLB` 为 `true`/`1` 或 `EXPERT_MAP_RECORD` 为 `true` 时导入；`AscendWorkerProc.make_worker_process` 用 `daemon=False`；补丁清单写明原因是 EPLB 要再起进程，而 `daemon=True` 不允许。动态 EPLB 时，`NPUModelRunner.__init__` 里先 `Manager()`，再 `EplbProcess._launch_process()`。

### 会报什么错

**网卡和模式先看配置是否落到正确层。** Gloo 显式接口不存在时会在创建 TCP device 时找不到地址；hostname 回退到 loopback 的警告也不能当作双机已连通。HCCL 若同时设地址与接口，先核优先的 HCCL_IF_IP 是否是本机地址；选错接口、路由不通或对端未启动可能最终表现为建链等待超时，具体等待设置见[调用链](request-call-chain.md#会报什么错)。A2 不支持的展开模式会回默认，不能只因没有参数错误就认定 AIV 已启用。

| 输入或组合 | 检查结果与处理 |
|---|---|
| headless 同时给正 API 数 | serve 立即报告 cannot be used with --headless；node1 移除前端数量，node0 不用 headless |
| headless 的 local≤0，或 hybrid 同开 | headless 入口拒绝；本机要有引擎，且不承担混合负载均衡前端 |
| data_parallel_rank 非 None，又给 local>1 | EngineArgs 的组合检查拒绝；显式 rank 对应单本地组的外部模式，不是本机连续组的起始编号 |
| 派生 rank 超出 [0,DP) | ParallelConfig 报编号越界；核对总组数和两端起始编号，不用全局 Worker 编号代替 DP 编号 |
| 同时启用多个 LB 模式 | serve 报 Cannot use more than one data parallel load balancing mode；显式 rank/start_rank 也参与模式判断 |
| V1 多进程写成 true/false | int 转换失败；使用 1/0。在线异步客户端不能靠 0 改成进程内引擎 |
| VLLM_PORT 不是整数或是 URI | 分别提示 must be a valid integer 或 appears to be a URI；后者应检查是否被服务发现环境变量覆盖 |
| Worker 启动方法不在 fork/spawn 中 | 环境选项校验拒绝；显式 fork 仍可能因运行条件被覆盖为 spawn |
| 自定义 executor 路径解析不到类，或不是 Executor 子类 | 类加载或类型检查失败；使用可导入的完整类路径，不将任意字符串当后端名 |

RPC 地址相同不代表通信已畅通；端口不可绑定、两端地址不可达、重复 rank 或设备列表不能满足本地 Worker 数，仍可能在建进程、握手或设备初始化阶段失败。上述检查来自固定版本的配置和控制流；设备侧实际报错还需对应环境的运行日志。

按栈里的名字认进程 [A]：

- 参数校验阶段（`NPUPlatform` 的 `_validate_*` 系列，并行组合不合法等）：API server，或 node1 的启动进程。
- 栈里有 `Scheduler`、`BalanceScheduler`、`AsyncScheduler`、`KVCacheManager`，或正在构造 `SchedulerOutput`：EngineCore 进程，昇腾只经全局补丁介入。
- 栈里有 `NPUWorker`、`NPUModelRunner`、attention 后端、`torch_npu` 调用：Worker 执行路径；使用多进程执行器时，Worker 在独立子进程中运行；使用单进程执行器时，直接在当前进程内调用 Worker 方法。判断进程归属需要确认执行器，不能仅凭卡数判断，也不能据此确定 API server 与 EngineCore 是否在同一进程。

与进程归属直接相关的几条：

- `Ascend config is not initialized. Please call init_ascend_config first.`：在一个还没建 Ascend 配置缓存的进程里取配置。
- `The environment variable DYNAMIC_EPLB or EXPERT_MAP_RECORD of the EPLB must be set to true.`：配置里开了动态 EPLB，却没设环境变量，Worker 启动补丁没有导入。
- ``We must use the `spawn` multiprocessing start method. Overriding VLLM_WORKER_MULTIPROC_METHOD to 'spawn'.``：这是警告，不是错误，说明本次子进程改用 spawn 启动，补丁要靠各进程自己的入口打上。
- Worker 进程抛异常、意外退出、RPC 超时的报错字符串，见[请求代码路径页的「会报什么错」](request-call-chain.md#会报什么错)。

### 开销和什么时候别开

网卡变量主要改变连接走向，不会增加模型算力；Gloo 多接口会改变分派，HCCL 的多项匹配只在选接口。AIV 会使用 Vector Core，可能与计算争用资源；更换展开模式后要重新核算子支持和超时含义，再用同一负载测性能，不能把配方的 AIV 解释为所有网络与模型的最优值。

- spawn 起的子进程要从头导入 vLLM、vllm-ascend 和 torch_npu，启动比 fork 慢；fork 快，但要求父进程在 fork 之前没有初始化设备运行时，vLLM 检测到 CUDA 已初始化就改用 spawn，正是为此[D]。选择应遵循所用入口的默认和运行时约束，不应只为缩短启动时间把 CLI 的 spawn 改回 fork。
- 单进程 executor 省掉 Worker 子进程和共享内存队列，但每个执行器只创建一个 Worker。显式 uni 与 DP 多组的组合要分别看各组如何启动，不能把“默认只有全局单卡才选 uni”写成绝对支持限制；本站 TP8 也不能靠换 uni 省掉必须协作的七张卡 [D]。
- 动态 EPLB 让每个 Worker 多两个子进程，Worker 也改成非 daemon。Python 在父进程退出时会直接结束 daemon 子进程，对非 daemon 子进程则是等它退出，所以关服务更依赖 executor 自己的关闭流程 [D]。官方 GLM 双机没有开 [S1]。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同此分支期）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 与 `main` 配套上游均保留多前端共享准入统计（`SharedAdmissionStats`），API Server / EngineCore / Worker 三进程 ZMQ IPC 边界与角色职责没有合并。** 多 API 进程各写一个间隔 64 字节的槽位、读时汇总在途请求数；请求数上限据此做近似全局检查，token 阈值仍读取当前 `AsyncLLM` 计数（详见[API 准入解释](api-server-entry.md#版本差异)）。Ascend 的 EngineCore 子进程继续通过平台补丁重新初始化 `AscendConfig`；通信库环境变量的有效性仍取决于实际 Gloo/HCCL 等依赖版本。

下表对照十二个启动参数与环境入口在四个正式钉点上的演进（`v0.30.0` 与 `main` 分别以 `ced6857a` / `c09d3e20` 和 `ba15685a` / `8d6180e2` 为准）：

| 参数或规则 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `distributed_executor_backend` | `None` 后派生；`mp`/`uni`/`ray`/`external_launcher`/自定义 Executor 子类 | 默认选择规则同构 | 所列默认选路同构 | 所列默认选路同构 |
| `headless` / `api_server_count` | `False` / `None`；普通 Python 前端按 LB 派生，`headless` 拒正数并取 0 | 相同 | 同样派生；定义迁至 `launchers/cli_args.py`，Rust 前端须显式开关 `VLLM_USE_RUST_FRONTEND` | 与 `v0.30.0` 相同（`serve.py#L54-L190`） |
| `data_parallel_address` | 输入 `None`；`mp` 取 `master_addr` 或 `127.0.0.1`，Ray 取 `get_ip` | 相同 | 相同 | 相同 |
| `data_parallel_rpc_port` | 输入 `None`→`29550`；`int` 无额外上下界 | 相同 | 默认 `29550`，增加 `1–65535` 字段约束 | 同 `v0.30.0`（`parallel.py#L165-L175`） |
| `data_parallel_rank` | 输入 `None`；显式值选外部 LB，本地数限 `1`/`None` | 相同 | 核心语义相同；多项组合 `assert` 改为 `ValueError` | 同 `v0.30.0` |
| `data_parallel_start_rank` | `local` 已给、非零且非 `headless` 才推断 hybrid；回填用 `or` | 相同 | 改为 `is not None`，显式 `0` 也参与 hybrid 推断且回填保留 `0`；多节点计入 PCP | 同 `v0.30.0` |
| `ASCEND_RT_VISIBLE_DEVICES` | 平台选作设备控制变量；辅助映射按列表位置取编号 | 上游映射增加已分配物理设备列表优先 | Ascend 用 CANN 算子将可见编号转物理编号 | 同 `v0.30.0` |
| `VLLM_HOST_IP` | 空串后探测；非空显式值优先，旧 `HOST_IP` 忽略 | 相同 | 相同 | 相同 |
| `VLLM_PORT` | `None`/整数起点；多动态端口向上找，显式起点列表未避开 DP 保留区 | 相同 | 单端口、多端口统一跳过 DP 保留区；`tcp://` URI 报错提示服务发现冲突 | 同 `v0.30.0` |
| `VLLM_ENABLE_V1_MULTIPROCESSING` | 默认 `1`，经 `bool(int)`；离线客户端开关，`external_launcher` 写 `0` | 相同 | 相同 | 相同 |
| `VLLM_WORKER_MULTIPROC_METHOD` | 库默认 `fork`；CLI 未设时写 `spawn`，强制条件可覆盖 | 相同 | 相同 | 相同 |
| 多 API 进程准入统计 | 各进程独立计数 | 相同 | `SharedAdmissionStats` 跨前端共享请求槽位（64B 对齐） | 延续 `SharedAdmissionStats`（`admission_control.py#L13-L25`） |

再按四版本正式钉点对照 Ascend 侧各进程补丁与配置初始化入口行号（本页 GLM 算例正文读专用镜像 `db701c1f`，除 scheduler 类替换在 `:718` 外其余与 `v0.23.0` `2c59ff10` 相同）：

| Ascend 进程入口（行号） | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 全局 patch 定义 / 三处调用（`__init__.py`） | 21 / 45、55、65 | 同左 | 55 / 79、89、99 | 55 / 81、97、107 |
| 平台打全局 patch（`platform.py`） | 188 | 187 | 311 | 396 |
| 平台初始化 Ascend 配置（`platform.py`） | 475 | 431 | 520 | 678 |
| Worker 打 patch / 初始化配置（`worker.py`） | 110 / 120 | 119 / 129 | 144 / 154 | 173 / 187 |
| EPLB 启动补丁导入（`patch/platform/__init__.py`） | 47–48 | 45–46，条件相同 | 42–43，导入条件相同；MRV2 另拒旧环境开关 | 41–42，条件相同（全量 MRV2 下仍拒旧环境开关） |
| scheduler 类替换（`patch_balance_schedule.py`） | 745（直接赋 `Scheduler`） | 936（`_sched_mod.Scheduler`） | 897（`_sched_mod.Scheduler`） | 926（`_sched_mod.Scheduler`） |
| EngineCore 入口包装（`patch_engine_core.py`） | 位于 `patch_balance_schedule` | 同左 | `#L31-L72`：先 `init_ascend_config`，按需挂 `profiling_chunk`、DyntraLB 或 Balance | `#L31-L68`：移除 `_apply_profiling_patches`，保留 `init_ascend_config` 与 DyntraLB/Balance 分派 |

三类进程在四版中始终分别保留补丁入口；`v0.30.0` 将 EngineCore 入口包装收束到 `patch_engine_core.py`，先初始化 `AscendConfig` 再按配置接入 `profiling_chunk`、DyntraLB 或 Balance，`main` 进一步移除 `_apply_profiling_patches`。上游四版在 EngineCore 初始化加载通用插件、单 API server 复用启动进程、`headless` 守护引擎、无 KV connector 且 `PP=1` 时只收 TP0 结果等 ZMQ IPC 与进程边界上保持一致 [C44]。

### 源码位置

Kubernetes Service 命名与环境冲突的官方说明见来源 142；四版 VLLM_PORT 的 URI 拒绝分支分别复用来源 63、77、120、81。这里只核服务变量注入与 vLLM 内部端口解析，不将它当成整套 Kubernetes 部署验收。

通信参数的来源 95–97 连接 vLLM 的 Gloo 建组入口、PyTorch 2.10 文档与实际 getter；106 核接口精确匹配。98–100 是 CANN 9.1.X 三个环境变量的官方说明，101–102 锚定固定依赖与 A2 构建版本。103–105 对照 TensorPipe 两套消费者与后端注册/实例化的区别；固定两运行包的完整文本检索未发现 TensorPipe 初始化，不能把这种有范围的负向结论扩张到用户另装的插件。

`v0.30.0`（及历史 `v0.30.0rc2` 快照）补证：107–111 连接共享准入计数的建立、检查和请求结束扣减；112–117 支持两种 headless 分支及 CLI、DP 参数派生；118–127 对照设备与环境入口；128–135 对照各进程补丁、MRV2 的 EPLB 校验和 EngineCore 提前初始化。固定 GLM 的配置缓存顺序见 136–140，旧 Balance 的早期回退见 141。

- 两台机器各起什么：vllm/entrypoints/cli/serve.py:138-148（单 API server 就是本进程）、:173-253（headless）；vllm/v1/engine/utils.py:121-170（CoreEngineProcManager）、:1084-1100（是否建 DP coordinator）；vllm/v1/engine/coordinator.py:80-157。
- 进程标题：EngineCore 在 vllm/v1/engine/core.py:1118-1137，Worker 在 vllm/v1/executor/multiproc_executor.py:997-1031（依次拼上 _DP、_PP、_PCP、_TP、_DCP、_EP），标题前缀 VLLM 与 setproctitle 的使用在 vllm/utils/system_utils.py:184-198。
- EngineCore 的收发线程：vllm/v1/engine/core.py:860-965，注释说明开线程是为了让序列化和前向计算重叠；API server 与 EngineCore 之间的通道细节见[请求代码路径页](request-call-chain.md#进程之间的四条通道)。
- executor：默认值 vllm/config/parallel.py:776-780、:845-890；vllm/v1/executor/uniproc_executor.py:45-63；vllm/v1/executor/multiproc_executor.py:132-192（广播队列与起 Worker）、:495-509（只读 TP 0 号的结果；PP > 1 时是最后一段 PP 的 TP 0 号）、:361-365（配了 KV connector 时不再只读一个，所有 Worker 回传后汇总）、:686-696（daemon=True）。
- 清单只发差量：vllm/v1/core/sched/output.py:181-212，注释写明请求资料缓存在每个 Worker 进程里、之后只发差量，结束名单用来通知 Worker 释放缓存 [C23]。Worker 侧的 _update_states 在 vllm/v1/worker/gpu_model_runner.py:1125-1168；昇腾版 vllm_ascend/worker/model_runner_v1.py:748-763 在异步调度下先做一次回退检查，再交给上游。
- 补丁入口：vllm_ascend/\_\_init\_\_.py:18-69、vllm_ascend/platform.py:184-188、vllm_ascend/worker/worker.py:89-120、vllm_ascend/utils.py:563-567；上游侧 vllm/engine/arg_utils.py:2578-2598、vllm/v1/engine/core.py:100-109、vllm/v1/worker/worker_base.py:238-247、vllm/plugins/\_\_init\_\_.py:69-80。
- 配置缓存：vllm_ascend/ascend_config.py:866-925、vllm_ascend/platform.py:450-475。
- scheduler 与引擎入口被换：vllm_ascend/patch/platform/\_\_init\_\_.py:50、patch_balance_schedule.py:661-718；vllm/config/scheduler.py:168-188。
- EPLB：vllm_ascend/patch/platform/\_\_init\_\_.py:47-48、patch/\_\_init\_\_.py:57-66、patch/platform/patch_multiproc_executor.py:161-200、worker/model_runner_v1.py:530-544、eplb/core/eplb_worker.py:403-410。
- 官方补丁设计文档：docs/source/developer_guide/Design_Documents/patch.md。

- 进程与开关边界：EPLB 的 `_launch_process` 设置 `daemon=True` 后调用 `proc.start()`，不受只改变 Worker 创建路径的结论覆盖。[C41] `DYNAMIC_EPLB` 转小写后须为 `"true"` / `"1"`，`EXPERT_MAP_RECORD` 须精确为 `"true"`，才能按对应条件触发补丁导入。[C34]
- 进程账与启动步骤的数字取自主线底稿 01 §A0 第 1–4 步与 §A0.1，请求入口取自 §A1 [A]。

实际部署还需记录：

1. 官方镜像的环境里是否另设了 `VLLM_WORKER_MULTIPROC_METHOD`。教程命令没有设，镜像环境没有查。
2. 本部署在进程列表里实际还有哪些辅助进程、各几个，缺实机的进程列表。
3. 实际镜像是否走本文钉住的启动与初始化路径，需安装提交和启动日志；固定源码中握手收尾建立配置缓存的调用顺序已在上文列明。
4. 固定 main 已核本文列出的参数、进程入口与 Worker 分派；表外 Ray / external_launcher 的内部执行、弹性 EP 进程生命周期和全部 MRV2/PP 组合未做完整链路验证。真实安装配套与现场进程数仍需分别记录。

- 来源 52：vllm@0fc695fc，vllm/v1/engine/core_client.py，L81–L104。
- 来源 53：vllm@0fc695fc，vllm/v1/executor/uniproc_executor.py，L46–L62。
- 来源 54：vllm@0fc695fc，vllm/v1/executor/multiproc_executor.py，L1–L1062。
