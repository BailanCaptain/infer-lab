---
id: cluster-serving
title: 昇腾多实例集群部署与路由：DP 外部拉起、前缀感知分发与优雅摘流
type: concept
origin: direct
summary: >-
  面向昇腾多机多卡生产在线服务，系统对比 DP 外部协同拉起与独立多实例代理两种集群架构，拆解基于 /load、动态长度分桶与 ZMQ KVEventsConfig 的 KV 感知路由，并给出覆盖长冷启动图捕获期的 /health 探针设计与 --shutdown-timeout 优雅摘流规范。
aliases:
  - 集群部署
  - 多实例路由
  - DP 外部拉起
  - 外部负载均衡
  - 前缀感知路由
  - KVEventsConfig
  - 优雅摘流
  - graceful drain
  - shutdown-timeout
  - startupProbe
  - readinessProbe
  - livenessProbe
  - enable_server_load_tracking
  - dynamic_bucket_load_balancer
chapters:
  - '13'
  - '19'
order: 25
sources:
  - 'vllm-ascend@c09d3e20:examples/external_online_dp/README.md#L1-L41'
  - 'vllm-ascend@c09d3e20:examples/external_online_dp/launch_online_dp.py#L8-L55'
  - 'vllm-ascend@c09d3e20:examples/external_online_dp/run_dp_template.sh#L1-L32'
  - 'vllm-ascend@c09d3e20:examples/dynamic_bucket_load_balancer/README.md#L1-L45'
  - 'vllm@ced6857a:vllm/entrypoints/cli/serve.py#L67-L100'
  - 'vllm@ced6857a:vllm/entrypoints/cli/serve.py#L179-L240'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/dp_supervisor.py#L220-L240'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L180-L202'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L124-L185'
  - 'vllm@ced6857a:vllm/config/vllm.py#L455-L460'
  - 'vllm@ced6857a:vllm/entrypoints/serve/instrumentator/health.py#L22-L33'
  - 'vllm@ced6857a:vllm/entrypoints/serve/instrumentator/basic.py#L30-L51'
  - 'vllm@ced6857a:vllm/entrypoints/serve/dev/rlhf/api_router.py#L29-L65'
  - 'vllm@ced6857a:vllm/config/kv_events.py#L10-L52'
  - 'vllm-ascend@2c59ff10:examples/external_online_dp/README.md#L1-L41'
  - 'vllm-ascend@2ed6cbba:examples/dynamic_bucket_load_balancer/README.md#L1-L40'
  - 'vllm-ascend@8d6180e2:examples/external_online_dp/README.md#L1-L41'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L164-L201'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L212-L277'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: data-parallel
    kind: builds-on
    note: 先理解 DP 组内通信与 MoE 跨 DP 共享 EP 的基本机制，再在本页决策采用外部 DP 还是独立副本
  - to: dp-request-routing
    kind: builds-on
    note: 单个多 DP 引擎内部的请求分配策略见该页，本页面向跨进程/跨节点集群级代理与健康探测
  - to: prefix-caching
    kind: builds-on
    note: 结合块级自动前缀缓存机制，理解为什么集群路由需要前缀亲和与 KVEventsConfig 事件同步
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 了解昇腾权重转 NZ 与 ACL Graph 录图耗时来源，才能合理设置 K8s startupProbe 宽限窗口
  - to: pd-disaggregation
    kind: builds-on
    note: 超大规模集群进一步把 Prefill 与 Decode 拆池路由时，接续阅读该页与 Mooncake 连接器
  - to: inference-capacity-and-reliability
    kind: builds-on
    note: 结合该页的 SLA 与监控指标字典，建立集群级扩缩容与告警联动
contradicts: []
updated: '2026-11-24'
---

当单台昇腾服务器的 8 张或 16 张 NPU 已经跑满，或者线上需要多副本高可用与无损滚动发布时，工程重心会从“调优单条 `vllm serve` 命令”转向**多实例集群编排**。很多团队在把单机服务搬上 Kubernetes 或多机网关时，常踩三类典型生产事故：

- **选错 DP 协同模式**：不分 Dense 与 MoE 盲目把所有副本耦进同一个 **DP**（Data Parallel，数据并行）组，导致单卡故障拖垮整组；
- **盲目轮询打散缓存**：用普通随机/轮询负载均衡分散系统提示词，让前缀缓存命中率骤降；
- **探针与摘流未适配**：未覆盖昇腾数分钟的**冷启动（cold start，服务从进程拉起到权重加载、格式转换与静态图捕获完成并开始对外接单的全过程）**，探针反复误杀 Pod；又忽视默认 `abort` 退出行为，发版做**优雅摘流（draining，先停止接入新请求、等待在途长请求自然吐完后再退出进程）**时直接掐断了在途响应。

本页围绕多实例集群的四大工程支柱——**外部 DP 协同 vs 独立多实例代理、KV 与前缀感知路由、长冷启动探针、优雅摘流**——给出与 `vLLM Ascend v0.30.0`（配套 `vLLM v0.30.0`）源码逐一对齐的生产蓝图。

```wiki-diagram
file: cluster-fig-routing-and-probes
```

## 模式选型：DP 外部拉起 vs 独立多实例代理

把多张卡或多台机器上的服务组织起来，有两条架构路线，选择依据只有一个：**副本之间是否需要共享跨卡 MoE 专家并行（EP）通信域**。

| 对比维度 | 模式 A：外部 DP 协同（External DP Launcher / LB） | 模式 B：独立多实例代理（Multi-Instance Proxy） |
|---|---|---|
| 典型适用模型 | **大规模 MoE + EP**（如多机 `EP16/EP32` 需要跨 DP 秩切分专家，见 [数据并行](data-parallel.md)） | **Dense 模型**（如 `Qwen3-8B`）或单机内即可装满专家的 MoE 副本 |
| 启动与进程拓扑 | 每张/每组卡通过 `--data-parallel-size`、`--data-parallel-rank`、`--data-parallel-address`、`--data-parallel-rpc-port` 协同拉起（参考 `examples/external_online_dp/`）；从节点可用 `--headless` 只跑引擎不启 API，或配合 `--data-parallel-external-lb` / `DPSupervisor` 暴露独立端口 | 每个副本运行完全独立的 `vllm serve` 进程，彼此**没有 HCCL 跨实例通信域**，前端挂统一网关（Nginx / Envoy / 推理路由代理） |
| 故障爆炸半径与扩缩容 | 任意一个 DP 秩异常可能阻断全局 EP/DP 同步步调，通常需按整个 DP 组重建或整体扩缩 | **彻底故障隔离**：单实例崩溃立刻从网关摘除，按单副本粒度秒级/分钟级弹性扩缩 |
| 流量分发重点 | 必须由外部 LB 均衡各 DP 秩负载，避免空秩陪跑浪费（参见 [DP 请求路由](dp-request-routing.md)） | 网关可自由实现**前缀亲和、KV 水位感知与长短请求分桶隔离** |

## KV 缓存与前缀感知路由：别让轮询毁掉前缀命中率

对比两个直观例子就能看清普通轮询（Round-Robin）的命中边界：**例一（全局热共享系统前缀）**——若全站请求共用同一段固定系统提示词且已在全部 `N` 个副本上预热驻留，普通轮询打到任一副本都能命中这段公共前缀；**例二（各自独立的多轮会话前缀）**——用户 A 第 1 轮落在副本 1、第 2 轮被轮询散射到副本 2 时，副本 2 没有第 1 轮的历史块（多模态对话中重复图片的[多模态特征缓存](multimodal-encoder-cache.md)同样会在新副本冷未命中，且媒体缓存命中率须与文本前缀缓存独立观测），单副本上的[自动前缀缓存（Prefix Caching）](prefix-caching.md)会话有效命中率近似退化为 $1/N$，引发大量重复 Prefill 并推高 **TTFT**（首字时延）。生产级 LLM 路由器通常联合利用三种来自引擎的信号：

1. **实时负载探测（`GET /load`）**：vLLM API Server 内置 `/load` 端点，返回 `{"server_load": ...}`。**注意配套开关 `--enable-server-load-tracking`（`enable_server_load_tracking`）默认是 `False`，不显式开启时 `server_load` 恒为 `0`**；开启后它会统计接入负载计数的推理接口（`/v1/chat/completions`、`/v1/completions`、`/v1/responses` 等）上当前所有在途请求数，直到流式输出完整结束才归还（涵盖排队与吐字全阶段）。网关在前缀命中打平或冷请求到来时，优先挑选 `server_load` 最低的副本。
2. **基于 `KVEventsConfig` 的精确块事件广播**：前缀哈希路由最怕“路由器以为某副本还留着 KV 块，其实早被 **LRU**（最近最少使用淘汰策略）驱逐了”。vLLM 在 `enable_kv_cache_events=True` 时，默认通过 **ZMQ**（轻量跨进程消息总线 ZeroMQ）发布块事件（端点 `tcp://*:5557`，支持 `replay_endpoint` 与 `buffer_steps=10_000` 断线重放）。引擎将内部 KV 块的写入与驱逐事件实时推送给集群路由器或全局 KV 索引器，实现**真正感知实时 KV 驻留位置的路由**。
3. **动态长度分桶路由（`dynamic_bucket_load_balancer`）**：在 `vllm-ascend` 的 `examples/dynamic_bucket_load_balancer/` 示例中，代理把后端池拆成短请求组与长请求组。短组配较小的 `max-model-len` 保低时延，长组配大容量 KV 池隔离长 Prefill 阻塞。请求先按长度映射标准桶，再按邻居桶负载差与长度亲和因子动态重定向，在异构长度混合流量下兼顾吞吐与尾时延。

## 长冷启动录图期的 `/health` 探针护栏

昇腾大模型的冷启动往往比传统 Web 服务长得多。启动需依次完成权重加载、权重转 **`FRACTAL_NZ`**（昇腾芯片偏好的分形权重内存排布）、算子初始化与 HCCL 建链（底层编译缓存与建链超时配置见[昇腾运行时与调优](ascend-runtime-and-tuning.md)）、`profile_run()` 测显存与多档 **ACL Graph** / `npugraph_ex` 静态图捕获（拆解见 [NPUWorker 启动](npu-worker-lifecycle.md)），整段过程可能耗时 **2~10 分钟**（参考 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)：单卡 `Qwen3-8B` 完整冷启动约 `95.83 s`，八卡 `Qwen3-30B-A3B` 仅 `ACLGraph` 录图即占 `83 s`）。

对照 `vLLM` 启动源码 `api_server/entry.py` 与 `launcher.py`，必须把**端口绑定、开始监听处理 HTTP、健康就绪**三个时点分开：第一，进程启动之初先调 **`setup_server()` 提前绑定（`sock.bind`）服务套接字**以防端口竞争，但此时 Uvicorn 尚未启动；第二，随后进入 `run_server_worker()` 跑完漫长的 `build_async_engine_client()`（权重加载与图捕获），完成后才调用 **`build_and_serve()` 启动 HTTP 服务**开始接收并响应探针请求；第三，进入 HTTP 服务后，单实例 `GET /health` 调 `await client.check_health()`，**引擎健康就绪返回 `200`**，一旦引擎核心崩溃抛 `EngineDeadError` 则返回 `503`（多端口外部 DP 模式下，`DPSupervisor` 先启动聚合探针 HTTP 端口，在下属 DP Server 全部就绪前对 `/health`、`/ready` 与 `/readyz` 均返回 **`503 Service Unavailable`**）。

因此，在 Kubernetes 或容器编排中必须遵守三条探针铁律：

- **必须独立配置长窗口 `startupProbe`（启动探针）**：将 `failureThreshold × periodSeconds` 设为大于最坏冷启动加录图耗时（例如 `periodSeconds: 10, failureThreshold: 60`，给足 10 分钟）。在 `startupProbe` 通过前，Kubernetes 会完全抑制存活与就绪检查，避免把仍在录图的实例当死进程反复重启。
- **`readinessProbe`（就绪探针）指向 `/health`**：一旦返回非 `200` 立刻把 Pod 从 Service / 网关后端摘除，停止导流。
- **`livenessProbe`（存活探针）留出合理容错超时**：防止极端长 Prefill 造成事件循环短暂抖动时被误杀重启，触发新一轮漫长冷启动。

## 滚动发布与缩容：别被默认 `--shutdown-timeout 0` 直接掐断请求

线上发版或缩容最隐蔽的坑藏在 `vLLM` 的默认退出策略里。查看 `VllmConfig.shutdown_timeout`（命令行 `--shutdown-timeout`）：**它的源码默认值是 `0`**。`launcher.py` 的 `handle_shutdown()` 收到 `SIGINT` 或 `SIGTERM` 后，按 `mode = "abort" if timeout == 0 else "drain"` 分支。**不显式传 `--shutdown-timeout` 时，发版下发 `SIGTERM` 会立即走 `abort` 模式，强行中断所有正在吐字的流式长请求。**

下面这张全生命周期时间线把长冷启动探针与四步优雅摘流（Graceful Drain）一次对齐：

```wiki-diagram
file: cluster-fig-probe-and-drain-timeline
```

规范的四步优雅摘流时序应当这样编排：

1. **配置足够长的引擎排空窗口**：启动 `vllm serve` 时显式设置 `--shutdown-timeout <T>`（如 `120` 秒，需大于业务 P99 请求生成时长），使进程进入 `drain` 模式。
2. **先摘流量、再停引擎（`preStop` 钩子）**：在 K8s Pod 的 `lifecycle.preStop` 中先通知网关并等待 **Endpoints**（Kubernetes 后端转发列表）摘除传播（例如 `sleep 10`~`15` 秒），确保不再有新请求进入。随后容器收到 `SIGTERM`，执行 `engine_client.shutdown(timeout=T)` 等待在途请求自然吐完。
3. **对齐编排层宽限期**：确保 K8s 的 `terminationGracePeriodSeconds` 严格大于 `preStop` 耗时 + `--shutdown-timeout` + 进程收尾余量，否则 kubelet 会在排空完成前直接发 `SIGKILL` 强杀。
4. **在线热维护/权重更新场景**：若不是下线进程而是原地停流换权重（例如 [强化学习 RL 权重同步](vllm-ascend-for-rl.md) 或热更新），可利用开发/控制面端点 `POST /pause?mode=wait` 等待在途请求排空后再执行变更（与 `mode="abort"` 立即中止、`mode="keep"` 冻结队列区分）。

## 常见误解

- **误解一：“Dense 模型 8 卡机器想跑 8 个单卡副本，开 `--data-parallel-size 8` 比起 8 个独立 `vllm serve` 更好。”**
  未必。对于不需要跨卡共享 MoE 专家的 Dense 模型，8 个独立 `vllm serve` 实例配合前缀感知代理可实现单卡故障完全隔离与按卡独立弹性扩缩；而内部耦合的 DP 组会放大单卡故障的影响面。
- **误解二：“K8s 里只配一个 `livenessProbe: /health` 加大 `initialDelaySeconds` 就够了。”**
  不够安全。固定 `initialDelaySeconds` 设短了会在首次编译缓存或长录图时陷入 CrashLoopBackOff 死循环，设太长又会拖慢正常启动后的异常发现。标准做法是用 `startupProbe` 承接可变冷启动时长，通过后再交棒给 `readinessProbe` 与 `livenessProbe`。
- **误解三：“给 `vllm serve` 发 `SIGTERM` 本来就会等正在生成的请求说完再退出。”**
  错。`vLLM` 源码中 `--shutdown-timeout` 默认就是 `0`，收到 `SIGTERM` 默认直接进入 `abort` 模式中断所有在途请求；必须显式配置大于 0 的 `--shutdown-timeout` 才会进入 `drain` 优雅排空模式。

## 对照源码

### 怎么开与集群编排示例

```bash
# 1. 模式 A（外部 DP 协同）：两台 8 卡机器组 DP4 TP4（参考 examples/external_online_dp）
# 节点 0（拉起 DP rank 0, 1）
python launch_online_dp.py --dp-size 4 --tp-size 4 --dp-size-local 2 --dp-rank-start 0 --dp-address 10.0.0.1 --dp-rpc-port 12342
# 节点 1（拉起 DP rank 2, 3）
python launch_online_dp.py --dp-size 4 --tp-size 4 --dp-size-local 2 --dp-rank-start 2 --dp-address 10.0.0.1 --dp-rpc-port 12342

# 2. 模式 B（独立副本）：开启 ZMQ KV 事件广播 + 优雅排空超时（120 秒）
vllm serve /path/to/Qwen3-8B \
    --host 0.0.0.0 --port 8000 \
    --enable-prefix-caching \
    --kv-events-config '{"enable_kv_cache_events":true,"publisher":"zmq","endpoint":"tcp://*:5557"}' \
    --shutdown-timeout 120
```

- **核验外部 DP 与动态分桶示例**：`examples/external_online_dp` 通过 `launch_online_dp.py` 并发调用 `run_dp_template.sh`，为每个 DP 秩分配独立端口与 `ASCEND_RT_VISIBLE_DEVICES`，并设置 `--data-parallel-size` / `--data-parallel-rank` / `--data-parallel-address` / `--data-parallel-rpc-port`[S1][C2][C3]；上游 `cli/serve.py` 同时支持 `--headless` 无 API 从节点与 `--data-parallel-external-lb` / `--data-parallel-hybrid-lb`[C5][C6]；多实例代理可参考 `examples/dynamic_bucket_load_balancer` 按长度将后端池分为短/长序列组并动态重定向[S4]。
- **核验路由信号、探针与优雅摘流**：`KVEventsConfig` 在 `enable_kv_cache_events=True` 时默认通过 ZMQ（`tcp://*:5557`、`buffer_steps=10_000`）发布块事件[C14]；`GET /load` 返回实时 `server_load`[C12]。启动期 `api_server/entry.py` 先调用 `launcher.py::setup_server()` 绑定套接字（`sock.bind`），随后完成 `build_async_engine_client()` 引擎初始化，最后才进入 `build_and_serve()` 启动 HTTP 服务响应请求[C8][C18][C19]；`DPSupervisor` 在全部子 DP 就绪前对 `/health` 与 `/ready` 返回 `503`[C7]，就绪后 `/health` 经 `client.check_health()` 返回 `200`（`EngineDeadError` 返回 `503`）[C11]。退出期 `VllmConfig.shutdown_timeout` 默认为 `0`[C10]，`launcher.py::handle_shutdown()` 在 `SIGINT`/`SIGTERM` 时按 `timeout == 0` 选 `abort`、否则选 `drain`[C9]；原地热维护可通过 `POST /pause?mode=wait` 等待在途请求完成[C13]。具体集群冷启动秒数与 `preStop` 传播延迟受网络拓扑、存储吞吐及网关实现影响，须结合目标环境实测校准[I]。

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 外部 DP 拉起与动态分桶代理示例 | 已提供 `external_online_dp` 与 `dynamic_bucket_load_balancer`[S15] | 延续并完善动态分桶与混合代理示例[S16] | 延续上述模板并与 `vLLM v0.30.0` `DPSupervisor` / `--headless` 对齐[S1][C7] | 延续外部 DP 与多实例代理范式[S17] |
| 健康探针与优雅摘流接口 | 依赖 `/health` 与早期 uvicorn 关闭流 | 延续 `/health`、`/load` 与 `/pause` 接口 | `DPSupervisor` 提供聚合 `/health` + `/ready`，`--shutdown-timeout` 明确区分 `abort (0)` 与 `drain (>0)`[C9][C10] | 延续 `shutdown_timeout` 排空与 `KVEventsConfig` ZMQ 事件广播 |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–19 项（示例文档项为 `S1`、`S4`、`S15`–`S17`，源码项为 `C2`–`C3`、`C5`–`C14`、`C18`–`C19`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:examples/external_online_dp/README.md#L1-L41` — 单机与双机外部 DP 拉起参数与运行示例。
- 来源 2（C2）：`vllm-ascend@c09d3e20:examples/external_online_dp/launch_online_dp.py#L8-L55` — 按本地 DP 秩并发拉起 `run_dp_template.sh` 的启动器脚本。
- 来源 3（C3）：`vllm-ascend@c09d3e20:examples/external_online_dp/run_dp_template.sh#L1-L32` — 单 DP 秩 HCCL 网络环境变量与 `vllm serve` 参数模板。
- 来源 4（S4）：`vllm-ascend@c09d3e20:examples/dynamic_bucket_load_balancer/README.md#L1-L45` — 短/长请求分桶分组与基于负载差和长度亲和的动态重定向代理说明。
- 来源 5（C5）：`vllm@ced6857a:vllm/entrypoints/cli/serve.py#L67-L100` — `--headless`、`--data-parallel-external-lb` 与 `--data-parallel-hybrid-lb` 模式判别。
- 来源 6（C6）：`vllm@ced6857a:vllm/entrypoints/cli/serve.py#L179-L240` — `run_headless()` 无 API 从节点引擎启动逻辑。
- 来源 7（C7）：`vllm@ced6857a:vllm/entrypoints/launchers/dp_supervisor.py#L220-L240` — `DPSupervisor` 聚合 `/health`、`/ready`、`/readyz`（未全就绪返 `503`）。
- 来源 8（C8）：`vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L180-L202` — `run_server_worker()` 先完成 `build_async_engine_client()` 再进入 `build_and_serve()` 启动 HTTP 服务的顺序。
- 来源 9（C9）：`vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L124-L185` — `SIGINT`/`SIGTERM` 信号处理及 `timeout == 0`（`abort`）与 `> 0`（`drain`）分支。
- 来源 10（C10）：`vllm@ced6857a:vllm/config/vllm.py#L455-L460` — `VllmConfig.shutdown_timeout` 默认值 `0`。
- 来源 11（C11）：`vllm@ced6857a:vllm/entrypoints/serve/instrumentator/health.py#L22-L33` — `GET /health` 调用 `client.check_health()`，捕获 `EngineDeadError` 返回 `503`。
- 来源 12（C12）：`vllm@ced6857a:vllm/entrypoints/serve/instrumentator/basic.py#L30-L51` — `GET /load` 返回实时 `server_load` 指标。
- 来源 13（C13）：`vllm@ced6857a:vllm/entrypoints/serve/dev/rlhf/api_router.py#L29-L65` — `POST /pause` 支持 `abort` / `wait` / `keep` 三种暂停模式。
- 来源 14（C14）：`vllm@ced6857a:vllm/config/kv_events.py#L10-L52` — `KVEventsConfig` ZMQ 块事件发布端点、水位与重放配置。
- 来源 15–17（S15–S17）：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）与 `main`（`8d6180e2`）中外部 DP 与动态分桶代理示例的版本延续性对照。
- 来源 18–19（C18–C19）：`vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L164-L201` 与 `launcher.py#L212-L277` — `setup_server()` 在引擎初始化前先行创建并 `bind` 套接字的完整实现。
