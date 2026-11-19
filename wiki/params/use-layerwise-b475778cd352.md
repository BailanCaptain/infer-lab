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
legacyAnchors:
  一句话: 它配在哪里，四处同名键怎么区分？
  事实表: 它配在哪里，四处同名键怎么区分？
  为什么存在: 开启后牵动的三类分叉与后端协议
  开了的代价: 图模式改写、拓扑与混合缓存约束及 GLM 双机说明
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

**它不在 `additional_config` 里**：全仓各版本的 `vllm_ascend/` 均不从 `additional_config` 读取该键，绝大多数场景的公共入口在 `--kv-transfer-config` 的 `kv_connector_extra_config` 内：

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

## 开启后牵动的三类分叉与后端协议

关闭 `use_layerwise` 时，连接器不在每层计算前后分别等待和提交单层 KV（但仍可能使用发送线程或可选异步接收线程，不能简单视为完全串行）。开启后，调度与后端出现三类核心分叉：

1. **外部命中查询起点与强制加载**：非逐层模式从 `num_computed_tokens // block_size` 开始查外部命中，逐层模式直接从块 0 起步。且逐层模式下即使本轮无需新增分配也可能仍须加载池中数据——`v0.23.0` 检查外部命中 token 数 `> 0`，`v0.26.0rc` 之后改为检查 `store_skip_tokens > 0`，升级排查时需核对对应字段。
2. **调度侧异步加载标志变为 `False`**：调度器返回 `need_to_allocate, self.load_async and not self.use_layerwise`（在 `main` 拆分出的 `LayerwiseKVPoolScheduler` 中更是直接置 `self.load_async = False`）。这表示调度侧不走整批异步加载标志（不会修改 `load_async` 配置值，也不能仅凭该标志判断底层后端是否使用后台线程）。
3. **后端逐层协议与数据面演化**：传统 per-layer key 把层号写进 key；Mooncake 的 `block_key` 路径把各层放在同一 block/rank 对象的不同字节范围内逐层写入，使远端对象数从 `块数 × 层数 × 存储 rank 数` 降到 `块数 × 存储 rank 数`（不减少 KV 总有效载荷）。在 `v0.23` 与 `v0.26` 中，Memcache 特殊布局由 `use_layerwise and backend == "memcache"`（`use_gva_layerwise`）控制；`v0.30.0` 改为由协议注册表区分（Mooncake 为 `"block_key"`、Memcache 为 `"gva"` 并保留自身 opt-in 条件、Yuanrong 未登记两种协议，但仍可能进入通用按层 key 线程路径）；**到 `main`（`8d6180e2`），`AscendStoreConnector` 已将逐层逻辑拆入独立的 `LayerwiseKVPoolScheduler` 与 `LayerwiseKVPoolWorker`，并在调度器构造时硬性要求 `backend_class.layerwise_data_plane in ("block_key", "gva")`**（未实现这两种数据面的后端开启逐层会直接抛 `ValueError`）。注意通用参数表在部分版本仍只列 Memcache，不能据此排除 Mooncake 或反过来排除 Memcache，应以对应版本的实现代码和专门指南为准。

## 图模式改写、拓扑与混合缓存约束及 GLM 双机说明

- **会强制把整图模式改写成 `PIECEWISE`（四个版本一致）**：`AscendStoreConnector.requires_piecewise_for_cudagraph` 直接返回 `use_layerwise`。vLLM 启动检查到接了 KV 连接器且图模式含整图时，因为逐层异步等待与存出无法录进整图，会打一条 warning 并把 `cudagraph_mode` 覆写成 `PIECEWISE`：
  > KV connector %s requires PIECEWISE CUDA graph mode due to layerwise async operations that cannot be captured in CUDA graphs. Overriding cudagraph_mode from %s to PIECEWISE.
  不过这不是最终图模式的全部判断：同一配置函数随后若检测到 `enforce_eager` 为真，会把图模式置为 `NONE` 并把最大捕获宽度归零，因此须核对最终配置，不能把连接器的 `PIECEWISE` 要求等同于一定启用图。
- **拓扑、CP 与 `kv_consumer` 约束**：
  - 在 `v0.30.0` 中，连接器构造时调用 `validate_layerwise_topology` 交由后端协议校验——Mooncake block-key 路径检查 `PP`、`PCP`、`DCP`，任一大于 1 即抛 `ValueError("Mooncake block-key layerwise currently supports TP-only topology; ...")`（因 block key 不含这几个维度的坐标，多机多维并行会撞 key），且拒绝 P/D TP 不一致。
  - 官方 PCP 指南明确要求 KV 池化 + PCP 只支持 `use_layerwise=false`；旧 `v0.23` 指南亦记录 CP attention 未集成 wait/save。
  - 在 `main`（`8d6180e2`）中，`AscendStoreConnector` 新增了对 `kv_consumer` 的显式限制：当 `kv_role == "kv_consumer"` 且开启 `save_decode_cache`、未开启 `consumer_is_to_put` 时，若开启 `use_layerwise` 会直接抛 `ValueError`（提示 decode-only saving 未在逐层传输路径实现，须设 `use_layerwise=False`）。
- **混合 KV cache 与 Mamba 状态边界**：不能把多 KV 组一概判为支持或拒绝，需按版本与后端分别核对——`v0.23`/`v0.26` 调度器对 Mamba 检查 align 模式；`v0.26` 内存复用在存在复用关系时检查 `AttentionSpec` 并拒绝已共享或 packed 描述符；早期 `baa023ad` Mooncake 拒绝带 recurrent Mamba 状态的 hybrid 组合；`v0.30.0` 与 `main` 均通过 `requires_mamba_state_copy_after_layer_load = self.use_layerwise` 要求在逐层加载完成后复制 hybrid Mamba 状态。
- **旧算例与放到 GLM 双机（`db701c1f` 固定基线）**：早先单卡 Qwen3-0.6B 与[GLM 双机官方部署](../concepts/glm-5-3-flash-two-node.md#部署前提)的启动命令均未传 `--kv-transfer-config`，连接器不构造、四处同名键一处都不会被读到。因此在[多条请求页](../concepts/concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)里因 KV 块不足被抢占的约 67,000 位置请求排回来时是整段 prefill 重算而非外部池按层取回。若接上 AscendStore 并开启 `use_layerwise`：GLM 只有 12 层 MLA 存位置历史、34 层 KDA 存固定状态（每层搬运量及快照卡点见 [Layerwise KV offload GLM 一节](../concepts/kv-cache-layerwise-offload.md#放到-glm-双机主线没开开了一层要搬多少)），且原本的 `FULL_DECODE_ONLY` 会被改写成 `PIECEWISE`，昇腾平台在 `PIECEWISE` 分支会把 MLA 等 attention 切到图外并关掉 [npugraph_ex](../concepts/npugraph-ex.md)，decode 步不再是整图（GLM 在 `PIECEWISE` 下能否正常启动及 decode 慢多少均待实机核验；主线时延均为关闭态数字）。

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
