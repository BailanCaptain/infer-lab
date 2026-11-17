---
id: use-layerwise-b475778cd352
title: use_layerwise
type: param
summary: >-
  KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是
  --kv-transfer-config 的 kv_connector_extra_config；v0.23、v0.26、固定 main 与 rc2
  都有，默认 false。GLM 双机没开；连接器在含整图的配置下要求改用 PIECEWISE。
origin: seed
aliases:
  - 逐层 KV 存取开关
  - kv_connector_extra_config.use_layerwise
  - layerwise 总开关
chapters:
  - '11'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
## 一句话

**v0.30.0rc2 对照。** 公共入口仍是 kv_transfer_config.kv_connector_extra_config.use_layerwise，默认 false；AscendStoreConnector 据此要求 PIECEWISE 图。rc2 按 backend 解析逐层协议与数据传输实现，并由所选协议校验拓扑，不能把一个后端的限制套给全部后端。对 hybrid Mamba 状态，它还要求在逐层加载完成之后复制状态。静态扫描发现的同名配置字段不替代这个连接器入口。

**`use_layerwise` 是 [Layerwise KV offload](../concepts/kv-cache-layerwise-offload.md) 的总开关。** 打开后，KV cache 在显存和外部存储之间按层加载、等待和存出。以提前预取一层的示意为例：算第 L 层时，可以搬入第 L+1 层的历史，并存出已完成层的缓存；能重叠多少取决于后端、预取距离和搬运速度。为什么能按层拆、能省多少等待、每层什么时候要等，都在那一页；本页只讲这个键本身——配在哪、默认是什么、开了会牵动什么。

**配置路径：这个键不在 `additional_config` 里**——三个版本的 `vllm_ascend/` 里都没有任何一处从 `additional_config` 读这个名字。绝大多数人要配的那一处，入口是 `--kv-transfer-config` 里的 `kv_connector_extra_config`：

```bash
--kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_producer",
  "kv_connector_extra_config":{"backend":"memcache","use_layerwise":true}}'
```

**同名的地方有四处，别配串了。** 四处都叫 `use_layerwise`，但归属和默认值不同：

1. `AscendStoreConnector` 的 `kv_connector_extra_config`，默认 `false`——绝大多数人要配的就是这一处 [C2]；
2. P2P 连接器 `kv_p2p/sfa_pd_rd2h` 的 `kv_connector_extra_config`，默认 **`true`**（v0.26 起才有这个连接器）[C9]；
3. Yuanrong 后端自己的 JSON 配置文件（路径由环境变量 `YR_CONFIG_PATH` 给），默认 `false` [C1]——**文末自动生成区钉的是这一处**，所以那里的标识写成 `YuanrongConfig["use_layerwise"]`，指的是那份 JSON 的字段而不是 `additional_config`；官方要求它必须与第 1 处取值一致 [S11]；
4. UCM 自己那份 yaml 配置文件（路径由环境变量 `UCM_CONFIG_FILE` 给）的顶层键，由外部 `ucm` 包读取，不走 `kv_connector_extra_config`——部署示例里集中式配 `false`、P2P 与混部配 `true`，出处与读法见 [UCM](../concepts/ucm.md)。

**存在范围。** 第 1 处三个版本都有、默认值和读法一字未变 [C13]，GLM 用的那份快照（db701c1f）也是同样的 `.get(..., False)` [C22]；第 2、3 处分别是 v0.26 与 main 才出现的；第 4 处由外部 `ucm` 包定义，本仓库三个版本的 UCM 包装层都只转发、不读取它。三个版本上都没有校验去比对这几处是否一致。

本页早先的旧算例（Qwen3-0.6B 单卡，不是 GLM 双机）用不到它：那条启动命令里没有 `--kv-transfer-config`，连接器根本不会被构造。

**放到 GLM 双机：没开。** [官方双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)的启动命令里同样没有 `--kv-transfer-config`，四处同名键一处都不会被读到。所以[多条请求页](../concepts/concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)里那条因 KV 块不够被抢占、约 67,000 个位置的请求，排回来时是整段 prefill 重算，不是从外部池按层取回。要是接上 KV 池再开它：这个模型只有 12 层 MLA 按位置存历史、34 层 KDA 存固定大小的状态，一层要搬多少、钉住的快照上还卡在哪两处，见 [Layerwise KV offload 的 GLM 一节](../concepts/kv-cache-layerwise-offload.md#放到-glm-双机主线没开开了一层要搬多少)；开了以后图模式会被改掉，见下面「开了的代价」。分层传输在这套部署上没有实测数，GLM 主线的时延都是它关着时的数字。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置路径 | `kv_connector_extra_config["use_layerwise"]` | 同左 | 同左 | 这是第 1 处、绝大多数人要配的那一处；文末生成区钉的是第 3 处 Yuanrong JSON，别把两者混成一个键 [!] |
| 类型 / 默认 | `bool` / `false`，`.get()` 取原值 | 同左 | 同左 | 没有 pydantic 强转，JSON 里写 `"false"`（带引号）是真值 [D] |
| 后端特殊布局的判据 | `use_layerwise and backend == "memcache"`，叫 `use_gva_layerwise` | 同左 | 改由协议注册表区分：Mooncake 是 `block_key`，Memcache 是 `gva` [C4] | main 同时保留两条逐层实现；变量改名不代表 Memcache 被 Mooncake 替换 |
| 额外校验 | 无 | 无 | mooncake + layerwise 时 PP / PCP / DCP 任一 > 1 直接 `ValueError` | main 上多一道启动期闸门，只允许纯 TP 拓扑 |
| 对 `load_async` 的影响 | 返回的异步加载标志为 `self.load_async and not self.use_layerwise`，按层模式下为 false [C14] | 同左 | 同左 | 改变的是返回标志，不是配置值；也不能仅凭此标志判断底层搬运是否使用后台线程 |
| 对图模式的影响 | 连接器声明 `requires_piecewise_for_cudagraph` 返回本键的值 | 同左 | 同左 [C3] | 接上连接器、图模式又含整图时，vLLM 启动就把它改成 PIECEWISE，只打一条 warning [C23] |
| 官方文档口径 | 指南将支持范围列为 `memcache` [S15] | 旧限制须结合维护快照实现核对 | 参数表仍写只支持 Memcache [S10]，同一版却有 Mooncake 逐层指南 | 固定 main 的参数表未覆盖全部实现，不能据此排除 Mooncake，也不能反过来排除 Memcache |
| 与 CP 的关系 | 文档明写未集成 | 同左 | KV 池化 + PCP 只支持 `use_layerwise=false` [S12] | 开了 CP 就别想同时开它 |
| 混合 KV cache | 旧指南称不支持；固定代码另对 Mamba 的 align 模式作检查 | 内存复用还有缓存类型和描述符条件 | Mooncake 分支拒绝带 recurrent Mamba 状态的 hybrid 组合 | 不能把所有多 KV 组一概判为拒绝或可用，按缓存类型、后端和版本核对 |
| Yuanrong 那一处的作用 | — | — | 为真时调度器侧也初始化仅元数据的客户端 [C6] | 错配会改变初始化路径；查 key 的异常可记录 error 并按未命中返回，不能承诺没有报错 |

## 为什么存在


逐层模式下，即使本轮无需新增分配，也可能仍需加载池中数据。v0.23 维护快照以外部命中 token 数大于零触发这条强制加载路径；所列 v0.26 和 main 快照改为检查 store_skip_tokens 大于零。两者检查的是不同记录，升级排查时应对照对应版本。

不开这个键时，连接器不在每层计算前后分别等待和提交该层 KV。它仍可用发送线程和可选的异步接收线程，不能说搬运必然完全串行，也不能只凭输入更长就保证等待更久。逐层模式新增的是每层的就绪事件与预取时机，让后续层数据有机会和当前层计算重叠。

开了之后代码分叉的地方很多，但可以归成三类：

1. **查询起点变了。** 调度侧算「从第几个块开始查外部命中」时，非逐层模式从 `num_computed_tokens // block_size` 起步，逐层模式直接从 0 起步。
2. **返回的异步加载标志变为假。** `return need_to_allocate, self.load_async and not self.use_layerwise`——逐层模式下返回的第二项为假。这表示调度侧给出的标志，不能据此断言底层搬运不使用后台线程。
3. **后端要能分别定位每层的数据，但不要求每层都占一个远端对象。** 传统 per-layer key 路径把层号写进 key；main 的 Mooncake block-key 路径则把各层放在同一 block/rank 对象的不同字节范围，逐层写入该范围。远端对象数因此从块数×层数×存储 rank 数降到块数×存储 rank 数，KV 的总有效载荷没有因此减少。Memcache 的特殊布局在 v0.23/v0.26 由 `use_gva_layerwise` 选择；main 改由协议注册表查询：Mooncake 声明 `"block_key"`，Memcache 声明 `"gva"` 并保留自己的 opt-in 条件，Yuanrong 没有登记这两种协议。

main 上还多了一层保护，只是这一版已经不再由一个 mooncake 专用函数把关：连接器构造时调通用的 `validate_layerwise_topology`，它把 `parallel_config` 转交给后端协议自己的 `validate_topology`。mooncake 那一份检查 PP / PCP / DCP，任一大于 1 就抛 `ValueError("Mooncake block-key layerwise currently supports TP-only topology; ...")` [C5]。原因写在函数文档里——当前的 block key 里没有这几个维度的坐标，多机多维并行会让不同 rank 算出同一个 key。

## 开了的代价

**按层模式下，调度侧返回的异步加载标志为假。** 返回表达式是 `self.load_async and not self.use_layerwise` [C8]，没有给 `load_async` 配置重新赋值。性能分析还需核对实际后端的存取与等待路径，不能仅凭这个标志把所有底层搬运都判定为同步执行。

**它会改图模式，三个版本都会。** `AscendStoreConnector.requires_piecewise_for_cudagraph` 直接返回这个键，v0.23 维护分支、GLM 快照、v0.26、main 上都有这个方法。vLLM 启动时只要发现接了 KV 连接器、图模式里含整图，就去问它；它返回真，图模式就被改成 PIECEWISE，整个过程只留一条 warning [C23]：

> KV connector %s requires PIECEWISE CUDA graph mode due to layerwise async operations that cannot be captured in CUDA graphs. Overriding cudagraph_mode from %s to PIECEWISE.

（出处：vLLM v0.23.0 的 `vllm/config/vllm.py` 第 1258–1269 行。）原因写在这句话里：逐层的等待与存出是异步操作，录不进整图，整图捕获那条路就用不了了。

这还不是最终图模式的全部判断：同一配置函数随后检查 enforce_eager，若开启则将图模式置为 NONE，并将最大捕获宽度置为 0。应核对最终配置，不能把连接器提出 PIECEWISE 要求当作一定启用图的证明。

放到 GLM 双机：这套部署配的是 `FULL_DECODE_ONLY`，纯 decode 步整步录成一张图（见 [ACL Graph 的 GLM 一节](../concepts/acl-graph.md#放到-glm-双机只给整齐的-decode-步录-7-张图)）。按代码，接上 AscendStore 再开逐层，图模式会被改成 PIECEWISE；昇腾平台随后在 PIECEWISE 分支里把 MLA 等 attention 算子切到图外、分段录图，并关掉 [npugraph_ex](../concepts/npugraph-ex.md) [C24]。decode 步不再是一整张图，图模式省下的 Host 下发时间要重新算。GLM 在 PIECEWISE 下能不能起来、decode 慢多少，待核：缺这套部署在 PIECEWISE 模式下的实跑记录。

**后端名称决定具体传输路径，参数表的旧限制不能代替执行代码。** 旧指南将逐层支持范围列为 Memcache；固定 main 的 Memcache 继续使用 gva 协议，同时增加 Mooncake 的 block-key 协议和专门指南 [S19]，但通用参数表仍只写 Memcache [S10]。Yuanrong 没有登记这两个协议，却仍可能进入通用按层 key 的线程路径，不能把“未登记协议”直接解释成开关被忽略；具体后端是否支持目标模型仍须核对相应实现和部署范围。

**并行和缓存类型要分别核对。** 固定 main 的 Mooncake 逐层拓扑检查拒绝 PP、PCP、DCP 任一大于 1；官方 PCP 指南要求池化时关闭逐层。旧 v0.23 指南还记录 CP attention 未集成 wait/save，以及混合缓存不支持 [S16]，但这些文字不能替代维护快照的具体分支：v0.23/v0.26 调度器针对 Mamba 检查 align 模式；v0.26 的内存复用在存在复用关系时检查 AttentionSpec，并拒绝已共享或 packed 的描述符。main Mooncake 另拒绝带 recurrent Mamba 状态的 hybrid 组合和 P/D TP 不一致。这些检查既不证明所有混合模型均不可用，也不构成目标部署已经验证的承诺。

**同名配置要按所属文件分别核对。** Yuanrong JSON 与连接器 extra config 的值应保持一致，所引解析路径没有自动比对；错配会改变调度器客户端初始化，查询异常还可能被记录并转换成未命中。连接器、SFA P2P 和 Yuanrong 的这些读取入口不经过 AscendConfig 的未知键校验，拼错的键会使该入口取默认值；后续服务是否报错仍取决于实际执行路径。UCM 文件则由外部包处理，不能套用这里的解析结论。

返回标志与配置赋值是两回事：v0.23、v0.26和旧main的对应返回表达式相同，分别见来源14的pool_scheduler.py 570–591、来源26的606–627、来源8的672–693。该返回值说明调度是否要求异步处理，实际线程、通信和性能仍须按具体后端检查。

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

## 对照源码

- 来源 28：vllm-ascend@baa023ad，vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py，L669–L680。
- 来源 29：vllm-ascend@2c59ff10，vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py，L567–L578。
- 来源 30：vllm-ascend@2ed6cbba，vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py，L603–L614。
- 来源 34：逐层与非逐层的线程构造分支；来源 35–38：混合缓存的实际条件；来源 39：Yuanrong 查询异常处理；来源 40：rc2 在逐层加载后复制 Mamba 状态；来源 41：逐层查找从块 0 开始。
- 来源 42：Mooncake 把每层数据写入同一 block/rank 对象的不同字节范围，减少对象数而不减少 KV 有效载荷。
