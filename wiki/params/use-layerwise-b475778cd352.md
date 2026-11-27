---
id: use-layerwise-b475778cd352
title: use_layerwise
type: param
summary: >-
  AscendStoreConnector 的逐层 KV 存取开关，位于 --kv-transfer-config 的
  kv_connector_extra_config，默认 false；开启后按层搬运 KV，并在含整图配置下改用 PIECEWISE。
origin: seed
aliases:
  - 逐层 KV 存取开关
  - kv_connector_extra_config.use_layerwise
  - layerwise 总开关
  - YuanrongConfig.use_layerwise
  - AscendStoreConnector use_layerwise
legacyAnchors:
  一句话: 它配在哪里，四处同名键怎么区分？
  为什么存在: 开启后牵动的三类分叉与后端协议
  开了的代价: 图模式改写与拓扑约束
  图模式改写拓扑与混合缓存约束及-glm-双机说明: 混合注意力模型逐层搬运哪几类缓存
chapters:
  - '11'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: kv-cache-layerwise-offload
    kind: builds-on
    note: 这个键就是那一页讲的「按层搬」的总开关，机制、收益和 buffer 复用在那一页，本页只讲键本身
  - to: kv-pool
    kind: builds-on
    note: >-
      它是 AscendStoreConnector 的 kv_connector_extra_config 里的一个键，连接器怎么挂上 vLLM KV
      Connector 接口在那一页
  - to: acl-graph
    kind: builds-on
    note: 开启逐层 KV 存取后，vLLM 启动校验会强制将含整图的 cudagraph_mode 改写为 PIECEWISE
  - to: mooncake-connector
    kind: builds-on
    note: Mooncake 逐层数据面采用 block_key 协议合并同块各层存储，且仅支持纯 TP 拓扑
contradicts: []
sources:
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L104-L115
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L95-L102
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L56
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L52-L68
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L26-L115
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/memcache_backend.py#L80-L93
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L672-L693
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L69
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L33'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L1215'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/context_parallel.md#L113
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L83-L92
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L570-L591
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L75-L78
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L229-L236
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L92-L101
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L69
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L191-L199
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L26
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L78-L89
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1244-L1276'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L596-L623'
  - >-
    raw:sha256-441664d27d5f3034774f1bb5c29ddb42b87c829349dc5e8c5ba85c6a74670d91.md#L1-L332
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L606-L627
  - >-
    raw:sha256-7b68ea8fb443cb28419a824d276dc34b8e7ccafcb58d5c6afa1205692a51cce6.md#L1-L357
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L669-L680
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L567-L578
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L603-L614
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L97-L145
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L52-L73
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L625-L762
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L68-L85
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L75-L92
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L255-L305
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L71-L75
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L128-L141
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L332-L366
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L289-L309
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L19-L59
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L100-L155
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L52-L73
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L64-L81
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L118-L195
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise/pool_scheduler.py#L31-L55
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20-L39
rawSources:
  - >-
    raw/sha256-23467f7f139db9a53e6ecbaf45be36cc9a098e0b3c74958d818cfcef293e03bb.md
  - >-
    raw/sha256-441664d27d5f3034774f1bb5c29ddb42b87c829349dc5e8c5ba85c6a74670d91.md
  - >-
    raw/sha256-49388e84579cdc8f10f93fd1d7974542a23ed9026c66310523568e431b6540ec.md
  - >-
    raw/sha256-669514da04972a318ae33b644177e18d6c100c687828799c60d6aaf0457cc877.md
  - >-
    raw/sha256-84a06911f48172d7de4f5cff23cad81af64f94ce321d0683ff92f4a67769b16b.md
  - >-
    raw/sha256-d3d9a827c7c10514c64a59996d439dd3073b7e210488d124f267f418725693c2.md
---
## 它配在哪里，四处同名键怎么区分？

`use_layerwise` 是 [Layerwise KV offload](../concepts/kv-cache-layerwise-offload.md) 的总开关：开启后，KV cache 在显存和外部存储之间由整趟前向存取降为**按层加载、等待与存出**。以提前预取一层示意：计算第 `L` 层时可以搬入第 `L+1` 层的历史并存出已完成层的缓存，具体能重叠多少取决于后端、预取距离与搬运速度（完整机制与收益见概念页，本页聚焦配置键本身）。

**它不在 `additional_config` 里**。全仓各版本的 `vllm_ascend/` 都不从 `additional_config` 读取该键；公共主入口位于 `--kv-transfer-config`（见 [KV Pool](../concepts/kv-pool.md)）内的 `kv_connector_extra_config`：

```bash
--kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_producer",
  "kv_connector_extra_config":{"backend":"memcache","use_layerwise":true}}'
```

仓内和外围生态共有**四处同名键**，归属与默认值各不相同，且各版本没有自动校验去核对它们是否一致：

| 同名位置 | 归属与默认值 | 说明与版本范围 |
| --- | --- | --- |
| `AscendStoreConnector` 的 `kv_connector_extra_config["use_layerwise"]` | 公共主入口，`bool = false`（`.get()` 取原值） | `v0.23`、`v0.26`、`v0.30.0`、`main` 与 GLM `db701c1f` 均一致；无 pydantic 强转，JSON 写字符串 `"false"` 会按真值处理 |
| P2P 连接器 `kv_p2p/sfa_pd_rd2h` 的 `kv_connector_extra_config["use_layerwise"]` | 独立 P2P 连接器，默认 **`true`** | 自 `v0.26.0rc` 起出现 |
| Yuanrong JSON 配置文件（`YR_CONFIG_PATH`）中的 `YuanrongConfig.use_layerwise` | Yuanrong 后端自用配置，默认 `false` | 自 `main`/`v0.30.0` 起出现，**文末自动生成区钉的是这一处**；官方要求与第 1 处保持一致，错配会改变调度器客户端初始化（查 key 异常可记错并按未命中返回） |
| UCM YAML 配置文件（`UCM_CONFIG_FILE`）顶层 `use_layerwise` | 外部 `ucm` 包直接读取（不走 `kv_connector_extra_config`） | 部署示例里集中式配 `false`、P2P 与混部配 `true`，详见 [UCM](../concepts/ucm.md)；本仓包装层只转发不读取 |

连接器、SFA P2P 与 Yuanrong 这三处入口均不经 `AscendConfig` 的未知键校验，拼错键名会使该入口静默回落默认值（后续是否报错取决于执行路径）；UCM 配置文件由外部包解析，不能套用这里的结论。

## 事实表

启用 `AscendStoreConnector` 逐层 KV 传输前，先核对配置位置、字符串布尔陷阱、图模式覆写与并行拓扑限制：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 公共配置入口与默认 | `--kv-transfer-config` 内的 `kv_connector_extra_config["use_layerwise"]`（默认 `false`） | **不在 `additional_config` 里**；用 `.get()` 取原值无强转，JSON 写字符串 `"false"` 会被判为真！ |
| Yuanrong 同名同步要求 | `YR_CONFIG_PATH` JSON 内的 `YuanrongConfig.use_layerwise`（文末自动生成区钉点） | 使用 Yuanrong 后端时须与 `kv_connector_extra_config` 中的值保持一致，代码不会自动互检 |
| 图模式强制改写 | 开启后将含整图的 `cudagraph_mode`（如 `FULL_DECODE_ONLY`）自动覆写为 `PIECEWISE` | 逐层异步等待/存出无法录进整图；若同时传了 `--enforce-eager` 则最终落为 `NONE` |
| 并行拓扑与角色限制 | Mooncake `block_key` 仅支持纯 TP（`PP/PCP/DCP > 1` 报错）；KV 池 + PCP 仅支持 `false` | `main` 还禁止 `kv_consumer` 在仅存 decode 缓存且未开 `consumer_is_to_put` 时启用逐层模式 |
| 后端数据面门槛（`main`） | 构造期强制校验 `backend_class.layerwise_data_plane in ("block_key", "gva")` | `main` 上未登记这两种逐层数据面的后端开启 `use_layerwise: true` 会直接抛 `ValueError` |

## 开启后牵动的三类分叉与后端协议

```wiki-diagram
file: param-use-layerwise
```

关闭 `use_layerwise` 时，连接器不在每层计算前后分别等待和提交单层 KV（后台仍按配置启用发送线程或可选异步接收线程，并非完全单线程串行）。开启后，调度与后端出现三类核心分叉：

1. **外部命中查询起点与强制加载**：非逐层模式从 `num_computed_tokens // block_size` 开始查外部命中，逐层模式直接从块 0 起步。且逐层模式下即使本轮无需新增块分配，只要存在外部池命中就仍须触发池数据加载——`v0.23.0` 检查外部命中 token 数 `> 0`，`v0.26.0rc` 之后改为检查 `store_skip_tokens > 0`，升级排查需核对对应字段。
2. **调度侧整批异步加载标志置为 `False`**：调度器返回 `need_to_allocate, self.load_async and not self.use_layerwise`；`main` 拆出的 `LayerwiseKVPoolScheduler` 直接固定 `self.load_async = False`。这只表示调度器不走整趟前向级的异步加载分支，既不修改配置里的 `load_async` 原值，也不代表底层后端停用后台传输线程。
3. **后端逐层协议与数据面演化**：传统按层键把层号写进键名；[Mooncake](../concepts/mooncake-connector.md) 的 `block_key` 数据面则将同一块内各层放在同一远端对象的不同字节区间内逐层写入。这样远端对象数从 `块数 × 层数 × 存储 rank 数` 降到 `块数 × 存储 rank 数`，KV 总有效载荷不变（外部池宿主机锁页缓冲与内存注册要求见[主机内存与大页](../concepts/host-memory-and-hugepages.md)）。各版本的数据面分流如下：

| 版本 | 逐层数据面判定与后端路由 | 注意事项 |
| --- | --- | --- |
| `v0.23` / `v0.26` | Memcache 特殊布局由 `use_layerwise and backend == "memcache"`（`use_gva_layerwise`）控制 | 通用参数表在部分版本仍只列 Memcache，不能据此排除 Mooncake 或反向排除 Memcache |
| `v0.30.0` | 改为由协议注册表区分：Mooncake 为 `"block_key"`、Memcache 为 `"gva"`（保留自身 opt-in 条件）；Yuanrong 未登记两种协议，仍可能进入通用按层 key 线程路径 | 以对应版本实现代码与专门指南为准 |
| `main`（`8d6180e2`） | `AscendStoreConnector` 将逐层逻辑拆入独立 `LayerwiseKVPoolScheduler` 与 `LayerwiseKVPoolWorker`，构造期**硬性要求 `backend_class.layerwise_data_plane in ("block_key", "gva")`** | 未实现这两种数据面的后端开启逐层会直接抛 `ValueError` |

## 图模式改写与拓扑约束

- **整图模式会被自动改写成 `PIECEWISE`（四个版本一致）**：`AscendStoreConnector.requires_piecewise_for_cudagraph` 直接返回 `use_layerwise`。vLLM 启动检测到连接器开启逐层存取且图模式（见 [ACL Graph](../concepts/acl-graph.md)）含整图时，会输出告警并将 `cudagraph_mode` 覆写为 `PIECEWISE`：
  > KV connector %s requires PIECEWISE CUDA graph mode due to layerwise async operations that cannot be captured in CUDA graphs. Overriding cudagraph_mode from %s to PIECEWISE.
  若同时传入了 `--enforce-eager`，后续配置收敛仍会把图模式最终置为 `NONE` 并将最大捕获宽度归零，排查时应核对最终生效值。
- **并行拓扑、CP 与 `kv_consumer` 限制**：
  - `v0.30.0` 在连接器构造期调用 `validate_layerwise_topology` 校验后端协议。Mooncake `block_key` 路径因键名不含流水线或上下文并行坐标，只要 `PP`、`PCP`、`DCP` 任一大于 `1` 就抛 `ValueError("Mooncake block-key layerwise currently supports TP-only topology; ...")`，同时拒绝 P/D 两端 TP 不一致。
  - 官方 [PCP](../concepts/context-parallel.md) 指南明确要求 KV 池化配合 PCP 时仅支持 `use_layerwise=false`；旧 `v0.23` 指南也记录 CP attention 未接入逐层等待与存出。
  - `main`（`8d6180e2`）新增 `kv_consumer` 角色校验：当 `kv_role == "kv_consumer"` 且开启 `save_decode_cache`、未开启 `consumer_is_to_put` 时，设 `use_layerwise=true` 会直接抛 `ValueError`（逐层路径未实现纯 decode 侧存回，须改为 `false`）。

## 混合注意力模型逐层搬运哪几类缓存

混合架构同时包含按位置增长的注意力历史与固定形状的递推状态（两类状态的组织差异见[线性注意力](../concepts/linear-attention.md)），开启逐层存取时须按版本核对多缓存组规则：`v0.23` / `v0.26` 调度器检查 Mamba 的 `align` 模式；`v0.26` 内存复用拒绝已共享或 packed 描述符；早期 `baa023ad` 的 Mooncake 曾拒绝带递推状态的混合模型，而 `v0.30.0` 与 `main` 均通过 `requires_mamba_state_copy_after_layer_load = self.use_layerwise` 在逐层加载完成后复制混合递推状态。

早先单卡 Qwen3-0.6B 与[历史 GLM 双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)启动命令均未传 `--kv-transfer-config`，连接器不构造，四处同名键都不会被读取。因此在[并发请求页](../concepts/concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)里因 KV 块不足被抢占的约 67,000 位置请求排回执行时，走的是整段 prefill 重算而非外部池按层取回。

若在 GLM-5.3-Flash 上接入 `AscendStoreConnector` 并开启 `use_layerwise`，模型主干有 **`11` 层稀疏 MLA 加 `1` 层 MTP**（共 `12` 层按位置增长的历史 KV），另有 **`34` 层 KDA** 定长递推状态（每层载荷核算与两处限制见[异构混合层逐层载荷](../concepts/kv-cache-layerwise-offload.md#异构混合层逐层载荷12-层稀疏-mla-与-34-层-kda-状态口径)）。此时把 `FULL_DECODE_ONLY` 硬改写为 `PIECEWISE`（将 MLA 切到图外并关闭 [npugraph_ex](../concepts/npugraph-ex.md)）**只是其中一道边界**；还必须检查 **34 层 KDA 是否经过逐层等待（wait）与存出（save）入口**——在固定镜像 `db701c1f` 中，旧 KDA 实现未调用这两个钩子，会导致按存出次数递增的层号与 MLA 实际层号错位（新版本不配共享槽时的端到端启动与 decode 时延仍待实机核验）。

## 对照源码

下表汇总 `use_layerwise` 在四个基线版本的入口、后端协议与图模式规则对照，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 主入口与默认 | `kv_connector_extra_config["use_layerwise"] = False` [C13] | 同左 [C17] | 同左 [C44] | 同左 [C47] | 不在 `additional_config` 里；`.get()` 取原值，字符串 `"false"` 判为真 [D] |
| 后端逐层路由与校验 | `use_gva_layerwise`（Memcache） | 同左 | 协议注册表（`block_key`/`gva`）+ `validate_layerwise_topology` [C45] | 拆出 `LayerwiseKVPoolScheduler`/`Worker`，硬校验 `layerwise_data_plane in ("block_key","gva")` 并拒绝 `kv_consumer` 仅存 decode 缓存 [C46][C48] | 需按版本核对所选后端是否支持逐层数据面 [!] |
| 强制加载与图模式 | 查外部命中 token > 0；要求 `PIECEWISE` | 改查 `store_skip_tokens > 0`；要求 `PIECEWISE` | 同 `v0.26`，新增逐层后复制 hybrid Mamba 状态 [C44] | 同 `v0.30.0`，逐层调度器直接置 `load_async=False` [C48] | 含整图的模式会被 vLLM 启动覆盖为 `PIECEWISE` [C23] |
| 同名 `YuanrongConfig` | 无 | 无 | `yuanrong_backend.py:20` 默认 `False` [C43] | 同 `v0.30.0` [C49] | 文末自动生成区钉的是这一处，须与主入口保持一致 [S11] |

- **主入口、图模式覆写与异步标志**：`AscendStoreConnector` 各版入口见 `2c59ff10`（来源 13）、`db701c1f`（来源 22）、`2ed6cbba`（来源 17）、`c09d3e20`（来源 44–45）与 `8d6180e2`（来源 46–48）；`vllm@0fc695fc:vllm/config/vllm.py#L1244-L1276` 与 `db701c1f:platform.py#L596-L623`（来源 23–24）说明 `PIECEWISE` 覆写与关闭 `npugraph_ex`；调度侧 `load_async and not use_layerwise` 与块 0 起点、强制加载判据见 `pool_scheduler.py`（来源 8、14、26、28–30、41）[D]。
- **后端协议、混合缓存与同名键**：`backend/__init__.py`、`mooncake_layerwise.py`、`memcache_backend.py`、`yuanrong_backend.py`、`pool_worker.py`、`layerwise_cache_layout.py` 与 `sfa_pd_rd2h/connector.py` 见来源 1–7、9、18、20–21、31–40、49；官方文档（`kv_pool.md`、`context_parallel.md`、`layerwise_kv_pool.md`、`mooncake_layerwise_adaptation_and_optimization.md`）见来源 10–12、15–16、19、42 [S10][S12][S15][S19]。
- **待核**：GLM 双机在接上 `AscendStoreConnector` 并开启 `use_layerwise` 后被切为 `PIECEWISE` 时的实际启动结果与 decode 时延开销，本仓库无实机测试数据。

## 版本谱系

范围限定为 `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py` 中的 `YuanrongConfig.use_layerwise` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 字段身份（不代表用户输入入口） | `YuanrongConfig.use_layerwise` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py:20` [C43] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
