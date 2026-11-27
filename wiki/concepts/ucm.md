---
id: ucm
title: UCM：把算过的前缀分三层存到显存之外
type: feature
legacyAnchors:
  放到-glm-双机这套部署没有开-ucm: 混合模型接入边界五组状态kda-按块留档与新-hla-路径
  复杂异构实战对照glm-双机为何未启用与接入边界: 混合模型接入边界五组状态kda-按块留档与新-hla-路径
summary: >-
  UCM（Unified Cache Manager）是经 KV connector 接入 vLLM 的三层前缀缓存系统：将算好的前缀 KV 从显存逐级延伸至本机内存快取与共享持久存储，支持跨实例与跨重启复用；讲清它与 AscendStore KV Pool、LMCache 的分工，集中式与 P2P 两种 PD 站位，以及混合模型的 SupportsHMA 与 KDA 对齐边界。
aliases:
  - UCM
  - Unified Cache Manager
  - 统一缓存管理
  - UCM 缓存
  - UCM 三层缓存
  - UCMConnector
  - UCMConnectorV1
  - UCM_CONFIG_FILE
  - UcmPipelineStore
  - PipelineStore
  - Cache|Posix
  - DramPool
  - 集中式 KV 存储
  - 集中式 PD
  - 存算分离
  - UCMECConnector
chapters:
  - '11'
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L59'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L100-L159
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L194-L218
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L3-L64
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L79-L117
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L118-L170
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L202-L330
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L363-L416
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L459-L700
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L755-L885
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L454-L487'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L604-L640'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L783-L812'
  - 'vllm@0fc695fc:vllm/v1/worker/kv_connector_model_runner_mixin.py#L78-L101'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L285-L290'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L542-L561'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1479-L1500'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L24-L41
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L205-L226
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1716-L1723'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L2028-L2031'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L850'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py#L1-L5
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L85-L89'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L37-L69
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L5-L8
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L19-L20
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1506-L1507
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L122-L151
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L86-L113'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L36-L70
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L94-L100
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L91-L100
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/request-lifecycle.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L1642-L1832'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L2114-L2471'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L2472-L2745'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L2804-L2883'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L3029-L3198'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/request_hasher.py#L1-L167'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L116-L136'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/cache_config.py#L1-L80'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L1850-L2008'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/store/cache/capabilities.py#L1-L24'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/store/cache/v2/global_config.h#L45-L175'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/pipeline.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/observability/verify-cache.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/support-matrix/index.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/quick_start/index.md#L237-L421'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/build_from_source.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L1614-L1880'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L2154-L2200'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L2692-L2763'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_connector.py#L3542-L3745'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/device.py#L275-L298'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/utils.py#L39-L108'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/benchmark/pd-disaggregation.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/observability/health-metrics.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/reference/config-parameters.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L2597-L2690'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L3040-L3298'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/patch/v0300/mamba_layer_hooks_patch.py#L1-L329'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/capabilities/pd-disaggregation/centralized.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/observability/metrics.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/hla_connector.py#L496-L621'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/ds3fs.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/mooncake.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/drampool.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/compress.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/features/ec-connector.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/design-docs/ucm-ec-connector.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_ec_connector.py#L1-L333'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/ucm/integration/vllm/ucm_ec_connector.py#L335-L866'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/examples/ucm_ec_config.yaml'
  - 'vllm@568afb3a:vllm/distributed/ec_transfer/ec_connector/cpu/common.py#L38-L61'
  - 'vllm@ced6857a:vllm/distributed/ec_transfer/ec_connector/cpu/common.py#L69-L92'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/diagnostics/trace-mode.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/index.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/precheck.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/posix-aio.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/metrics-view.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/nic-monitor.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/dev-sandbox.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/benchmark/aisbench.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/observability/metrics-reference.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/toolkit/ucm_toolkit/tools/metrics_view/terminal_view_metrics/config.py#L15-L68'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/toolkit/ucm_toolkit/tools/metrics_view/configs/metrics_lite.json'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/toolkit/ucm_toolkit/tools/metrics_view/configs/vllm.json'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/frameworks/kubernetes/deploy.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/capabilities/pd-disaggregation/large-scale-ep.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/charts/unified-cache-chart/models/ascend/values-qwen3-0p6b-2p2-2d2.yaml'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/charts/unified-cache-chart/values.yaml'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/kv-cache-calculator.md'
  - 'https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/assets/calculator.js#L963-L1396'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L37-L70'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L22-L55'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L133-L137'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L290-L297'
  - 'vllm@ba15685a:vllm/distributed/ec_transfer/ec_connector/cpu/common.py#L71-L95'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-pool
    kind: builds-on
    note: 同样经连接器查询和搬运，具体加载、保存与回收时序由各自实现决定
  - to: prefix-caching
    kind: builds-on
    note: 本地命中数是问 UCM 的起点；GLM 上还决定 KDA 状态能不能按块留档
  - to: pd-disaggregation
    kind: builds-on
    note: 集中式 PD 把共享存储当成 P 到 D 的交接点
  - to: mooncake-connector
    kind: builds-on
    note: P2P 模式由 Mooncake 承担 P 到 D 的传输
  - to: kv-pool
    kind: alternative-to
    note: 同经 KV connector 复用外部前缀：AscendStore KV Pool 在 vllm-ascend 仓内直接管理显存区间与键名；UCM 通过薄转发外壳对接独立三层持久存储与多后端，并支持集中式 PD 交接
  - to: lmcache
    kind: alternative-to
    note: 另一套经 KV connector 接入的外部前缀缓存，Ascend 侧只装插件、复用上游连接器
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 只存到本机主机内存、只给本实例用，没有共享存储这一层
contradicts: []
updated: '2026-11-26'
origin: direct
---

## UCM 是什么？

单靠计算卡显存里的内置 [前缀缓存（prefix caching）](prefix-caching.md)，算好的长提示词既跨不出单个实例，引擎一重启也会清零；纯内存池虽然能跨实例共享，容量仍受集群 DRAM 上限约束。**UCM（Unified Cache Manager，统一缓存管理器）是通过 vLLM `KV connector` 接口接入的三层外部缓存系统。它把算好的前缀 [KV cache](kv-cache.md) 从显存延伸到本机内存快取，再异步写入共享文件或分布式存储（如 NFS、3FS），让挂载同一后端的兼容实例及重启后的新进程都能取回历史前缀、跳过重复 Prefill。**

它与 [AscendStore KV Pool](kv-pool.md#kv-pool-是什么)、[LMCache](lmcache.md) 插在同一个 vLLM `KV connector` 接口上：调度阶段回答“在本地显存命中之外，外部还能接着补多少个位置”，执行阶段通过 `UCMConnector` 把外部数据搬进引擎刚分好的显存块，并将新算出的完整块异步写出。模型前向与显存块分配依然完全归 vLLM 掌管，UCM 专注管理显存之外的多级缓存编排、持久化与淘汰——当然，跨介质读取耗时、主机内存与存储写带宽都得算进成本账，只有“取回时间 < 重算时间”的长前缀场景才真正划算。

```wiki-diagram
file: ucm-intuition
```

图里有两个实例、三层存储。请求 A 先到实例 1，开头三段自己算完，经 UCMConnector 交给 UCM：先存进这台机器的内存（第 2 层），再落到共享存储（第 3 层）。请求 B 落在实例 2，开头和 A 相同，可实例 2 的显存里一段也没有；它开始算之前先经连接器问一句，UCM 在共享存储里找到了这三段，就经实例 2 的内存搬回显存，B 只算自己不同的尾巴。搬回来的数据和本地算出来的没有区别，照样占实例 2 的显存块、由 [block table](block-table.md)（每条请求「第几块在显存哪一格」的对照表）指过去。

引擎进程重启后，原进程的显存缓存消失。主机快取的寿命取决于共享内存和后端进程，可能仍在；跨重启持久复用则要检查文件后端确实保存成功。新进程还得用兼容的缓存身份找到这些数据，下文会讲身份如何形成。

## 为什么需要：显存里的前缀留不久，也不跨实例

**prefix caching 只能复用本实例显存里还留着的块；UCM 把算过的前缀存到一个更大、多个实例共用、后端能持久保存时重启后也还在的地方，命中的机会才多起来。省下来的是 prefill 的计算，decode 每一步照样要算。**

prefix caching 落空有三种情况：

- **被挤掉。** 显存里的块先给正在算的请求用；没人用的旧前缀排在空闲队列里，新请求一来就会被拿去重写（会计规则见 [prefix caching 的预算](prefix-caching.md#池子的预算怎么分满了怎么办)）。
- **落在别处。** 部署里有几个实例，或者几个 [data parallel](data-parallel.md) 组（各自独立跑请求、各有一份 KV cache 的执行组）时，同一份文档的上一次提问落在哪一组由路由决定；落在另一组时，它的块在那一组的显存里，这一组看不见。
- **引擎重启。** 原进程的显存缓存随它结束；外部主机快取和文件存储各有自己的生命周期。

UCM 对着这三点：容量按存储算、不按卡算；存储由各实例共同挂载，按官方部署文档，谁存进去的别人都能查到；后端能持久保存时，重启以后还在。后两条都以外部包能认出「同一段前缀」为前提。

**官方部署文档给过一组对比数。** 测试模型为 W4A8 量化的 MoE 模型（GLM-5.1），采用 PD 分离：P 侧用 4 台 A2（4 DP × TP8），D 侧用 4 台 A2（8 DP × TP4）。测试先发 128 条请求把前 80% 输入写入缓存，再并发发送 128 条完整输入、每条生成 1,000 个 token，对比首 token 时延（TTFT）与平均每输出 token 时延（TPOT）：

| 输入长度 | 全部重算的 TTFT | 只开显存 prefix caching 的 TTFT | 开 UCM 的 TTFT | TPOT（三种做法） |
|---|---|---|---|---|
| 32K | 140,730 ms | 108,879 ms | 51,861 ms | 64–66 ms |
| 64K | 181,864 ms | 144,444 ms | 69,718 ms | 64–66 ms |
| 128K | 268,016 ms | 267,680 ms | 105,083 ms | 65–66 ms |

这份指南的启动示例将 `max-model-len` 设为 17,000，而测试输入为 32,000、64,000 和 128,000，并另生成 1,000 个 token。原文没有交代测试时怎样调整启动配置，因此表中数值作为官方报告保留，所列启动命令不能直接视为复现这张表的完整配方。

这张表能读出两件事。第一，主要改善的是 TTFT，TPOT 三种做法接近：复用前缀省掉对应的 prefill，后续 decode 仍须逐步计算，搬运等额外开销则可能影响时延。第二，只开显存 prefix caching 帮得不多，128K 时几乎无改善：在多 DP 组下，请求未必落回当初存前缀的那一组，实际命中率低于预设 80%。UCM 把前缀放进共享存储，兼容且可读的组都能复用。这是官方在那套 8 机部署上报的数，本站未复现，也不能直接照搬到其他部署。

**代价有四条。**

- **取回要时间。** 从存储经内存搬回显存，比直接读显存慢；搬得越多、存储越远，等得越久。取回划不划算，要拿搬运时间和重算时间比；上表是前缀长、预先存好的情形。
- **存下去要带宽和容量。** 算过的前缀要一路往下写，占主机内存和存储的写带宽。官方示例把主机预算参数设为 64，具体分配范围要看 UCM 的缓存实现，不能直接当成整台机器只用 64 GB。
- **存储要真共享，内容要对得上。** 想跨机器复用，第 3 层必须是各台机器真的都能读到的同一份存储；换了模型、权重或切分方式，旧数据就不能再用，见下文[三层怎样放](#三层怎样放显存本机内存共享存储)。
- **多一个外部依赖。** 查找规则、淘汰策略、写入时机、重启后怎样找回，全在外部 UCM 软件包里。UCM 要单独安装、单独固定版本。

## 一条请求怎样经过 UCM：先问后搬，边算边存

**UCM 在主线的[调度](vllm-scheduler.md)与[模型执行](npu-model-runner.md)两站配合：先查哪些前缀可复用，再把它们搬到已分配的设备块里，最后跟踪新缓存的保存与块回收。** 调度器和各 worker 各有自己的连接器对象，通过引擎传递的元数据协作。下面先走普通前缀缓存路径；混合模型的多组状态另有处理。

```wiki-diagram
file: ucm-flow
```

排队时，在调度器里：

1. **只问还没开始算的请求。** 一条请求在等着开始时——新来的，或者被[抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)退回队列、已算位置清零的——调度器先查本地 prefix caching 命中了几个位置，再把这个数交给连接器，问外面还能多供几个。已经在跑的请求不再问。
2. **区分接口允许什么、UCM 实际选什么。** vLLM 接口允许暂不回答，本步先跳过；也允许同步加载或请求级异步加载。后者让请求先等在远端加载队列里，加载结束后再调度计算。本文固定的外部 UCM 普通路径默认用同步调度，底层 I/O 仍可异步提交；普通整块实现可以显式开启请求级异步加载，逐层和混合实现不能据此一起开启。
3. **借块、生成搬运计划。** 调度器把「本地命中 + UCM 能供的」用于分配与计算预算（规则见 [KV 块分配](vllm-kv-block-allocation.md)），调用分配后通知，再生成发送给 worker 的元数据。普通同步 UCM 的通知方法不做事，设备块号与外部键的映射在读取调度输出时建立；请求级异步分支才在通知中记录单独的加载计划。

设一条请求的 prompt 有 1,000 个位置，缓存按每段 32 个位置存，本地命中前 256 个，UCM 连续存着前 800 个（都是示意数）：

$$T_{\text{compute}} = 1{,}000 - \bigl(256 + (800 - 256)\bigr) = 1{,}000 - 800 = 200\text{ 个位置}$$

| 阶段（示意：prompt 1,000 位置，每段 32 位置） | 算式 | 位置数 | 位置区间 |
|---|---|---|---|
| UCM 在本地之后再补供 | $800 - 256$ | **544 个** | 第 256–799 位 |
| 合并视为已算 | $256 + 544$ | **800 个** | 第 0–799 位 |
| 这一步引擎仍须自算 | $1{,}000 - 800$ | **200 个** | 第 800–999 位 |

UCM 回的是「本地命中之后还能多供几个」，不是它一共存了多少：第 0–255 个位置用本地显存里的块，第 256–799 个从 UCM 搬，第 800–999 个自己算。普通路径按完整块生成身份，只把本地之后连续可用的外部块计入；查找返回“最后命中的块下标”，还要加 1 才是块数。全中也会给引擎留下重算尾部：本固定外部实现中，普通整块至少留 1 个位置，普通逐层无投机时至少留 2 个，有投机时留草稿数加 2 个，以保留需要执行的计算和调用点。混合状态还需按各组共同边界取整。

执行时，在每张卡的 worker 里：

4. **按选定路径加载。** 普通同步整块路径在前向入口提交这一批加载，并在这里等完；按层等待方法为空。普通逐层路径先取第一层，在本层使用前等到齐，再发起下一层加载，让下一层搬运有机会和本层计算重叠（见[逐层缓存传输](kv-cache-layerwise-offload.md)）。请求级异步分支则把加载任务保留到后续轮询，完成或失败都要反馈调度器。
5. **记录计算完成，再提交保存。** 逐层路径算完一层就提交；整块路径在前向收尾提交。设备事件表示“此前计算已经产生可读数据”，让搬运等待这道依赖；关闭事件优化时，会先同步设备再提交。
6. **前向收尾不等于全部写完。** 名为“等待保存”的方法在这些 UCM 路径里会提交或轮询任务，仍有任务在途时也能返回。它的名字和包装层注释不足以证明每次前向都有全局保存屏障。
7. **结束和抢占处保护源块。** 请求结束时，只要记录了异步保存，连接器就要求暂缓还块；worker 等相关保存任务结束，再反馈可释放的请求。抢占时也先等待该请求的在途保存，避免旧数据还在读就被覆写。任务失败也要结束资源占用，因此“可以还块”与“成功持久保存”须分别检查。

**命中只是一个计划。** 第 1–3 步定下的是「这些位置不用算」；数据要真的搬进块里，模型才能读。「计划搬」「真的到」「块能被覆盖」是三个不同的时刻，外部实现在任何一步出错，都不能把计划当成数据已经可读。

## 三层怎样放：显存、本机内存、共享存储

**官方推荐的配置把三层串成两段搬运：显存与本机内存之间一段，本机内存与存储之间一段。第 3 层只写一个存储路径：单机时可以是本地 SSD；要跨机器复用，或者让 P、D 经它交接，就必须是各台机器真能读到的同一份共享存储。**

| 层 | 在哪 | 管什么 |
|---|---|---|
| 第 1 层 | 卡上的显存 | 正在算的请求读写，最快，也最小 |
| 第 2 层 | 这台机器的内存 | 常用前缀的快取，比回存储读快 |
| 第 3 层 | 本地 SSD，或多台机器共同挂载的存储（NFS、3FS 等） | 持久保存，容量跟着存储走，不跟着卡走 |

- **两段搬运。** 官方推荐的存储方式叫 PipelineStore，配置里写成「Cache|Posix」：前一段（Cache）管显存与主机内存之间，后一段（Posix）管主机内存与文件存储之间。加载时，已有主机快取可以直接供数据；否则先从文件读入主机缓冲，再搬到设备。
- **同名目录不等于共享存储。** 两台机器各自配了同一个目录名，看见的未必是同一份文件；只有两边都挂上同一个网络文件系统，或者 3FS 这类分布式存储，一台写进去的另一台才读得到。只把路径字符串配成一样，还没有做到存算分离。
- **重启后能不能找回。** 前提是后端本身能持久保存，并且重启前已经写完；只在内存里的、没写完的、存储本身不可访问的，结果各不相同。vllm-ascend 这一层适配证明不了后端的持久性、淘汰策略和故障恢复。
- **内容要对得上。** 存下去的是模型算出来的状态，不是文字。当前固定 UCM 把模型目录末级名称、TP、数据类型、rank、投机设置、部分缓存量化开关、DCP 和布局实现摘要纳入缓存身份；再将前一块身份、本块 token 与多模态、LoRA 等附加信息串起来。相同文字片段换了前文，身份也不同。模型目录名没有校验权重内容，换权重、tokenizer 或不兼容布局时仍要换存储命名空间，不能仅凭同名目录复用（对照 [KV Pool 的起名规则](kv-pool.md#池里一条记录叫什么名字)）。

### 主机预算要按哪个范围算

先辨认安装包里的缓存核心，再算总账。固定外部 UCM 的新核心按节点预算拆给本地 DP 和实际 Store；较新的旧核心还会在私有缓冲时再除以本地 worker 数。纯外部负载均衡只向单个服务暴露一个 DP，程序看不到同机其他 DP，此时配置值属于每个独立 DP 实例，部署者要自己分预算。日志中的“配置预算、本地 DP 数、Store 数、私有 rank 数、每 Store 预算”能核对实际分法。

例如一台机器给缓存留 64 GiB，普通路径有两个本地 DP、每个只有一个共享 Store，新分配逻辑会给每个 Store 32 GiB。若改成两个互不知情的外部负载均衡服务，却各填 64，就会规划合计 128 GiB；要维持原总预算，应各填 32。这里参数虽以 GB 命名，固定核心实际按 2³⁰ 字节换算；模型权重、引擎其他内存和缓存管理开销另外计。

旧的未版本化缓存库仍走旧预算路径，共享与私有缓冲的默认也不同；官网配置页的 128/256/32 GiB 说明不能覆盖新核心的拆分逻辑。共享路径要检查实际共享域和主机空间，旧共享实现还受容器可见的共享内存容量限制；官方容器使用主机 IPC 命名空间。文件容量预算则不预分配磁盘，多个实例共用目录时还要协调清理归属，避免各自按不一致预算淘汰同一批数据。

### 换后端时，哪些前提跟着变

上面的三层是文件存储配置，不是所有 UCM 部署的固定结构。先把上文的 64 GiB 主机预算拆分陷阱，与四种主流后端的介质栈和硬前置条件放在同一张图里对照：

```wiki-diagram
file: ucm-fig-budget-and-backends
```

选择后端时，先确定数据要留在哪里、是否要跨机器共享，以及哪些服务必须先启动：

| 后端 | 数据与服务 | 先确认什么 |
|---|---|---|
| 3FS 原生客户端 | 主机缓存接 3FS 客户端 I/O | 已有可读写的 3FS 服务、客户端和匹配的 native 库；普通本地目录不能替代客户端路径 |
| Mooncake | 共享内存服务，可再接文件持久层 | 已启动且各实例可达的 master、匹配客户端；当前 UCM native 实现依赖 Ascend，换传输名称不能变成 CUDA 实现 |
| DramPool | 独立服务把主机 DRAM 提供给多个推理实例 | 当前指南要求 A3 或更新设备、CANN 9.1.0 或更新、HIXL 与 RDMA；服务容量单位为 GiB，支持的块大小单位为字节 |
| 压缩文件存储 | 先把主机 KV 有损编码，再写文件 | 当前只接受实际 BF16 数据；存储压缩不会缩小引擎已分配的显存，必须同时验回读与模型质量 |

Mooncake 内存服务活着时可能跨引擎重启保留对象，服务故障后的持久性则取决于文件后备层及写入是否完成。DramPool 也不能套用“写入文件即持久保存”的解释。3FS 要检查真实客户端读写，单看健康状态不足；压缩回放要真正经过文件解码路径，同进程的未压缩主机命中不能证明压缩正确。配置与核验入口放在页末，按所选后端使用，不能把一份 YAML 的预算、清理和健康选项搬给另一种。

UCM 的外部包还提供别的能力，官方文档列了稀疏 attention 的几种免训练方法、四种 PD 分离模式和 RoPE 外推；vllm-ascend 的部署文档只讲前缀缓存和其中两种 PD 模式，本页围绕这两件展开。

## 和 KV Pool、LMCache 有什么不同

**三者对 vLLM 来说都是 KV connector，复用查询、加载、保存和回收的接口；哪些方法实际做事、在哪一步等待，由具体实现决定。** 比较时要同时看存储后端和运行模式。

| | KV Pool（AscendStore） | LMCache | UCM |
|---|---|---|---|
| 逻辑写在哪 | vllm-ascend 仓里：查询、起名、搬运都看得见 | 外部 LMCache 包；vllm-ascend 仓里只有一个几行的文件，装上昇腾插件后直接用上游 vLLM 的连接器 | 外部 UCM 包；vllm-ascend 仓里是一层只转发的外壳 |
| 数据存在哪 | 取决于后端；Mooncake 池与 Memcache 的主机存储前提不同，见 [KV Pool](kv-pool.md) | 由 LMCache 的配置决定，见 [LMCache](lmcache.md) | 本页 Cache/Posix 路径经过主机内存和文件存储；另有其他后端组合 |
| PD 分离时 | 默认只服务 P，D 要显式打开才读写池 | 见 [LMCache](lmcache.md) | 可以当 P→D 的交接点（集中式），也可以只在 P 上管前缀（P2P） |

**同一个接口，三种「厚度」。** KV Pool 的每一步在本仓都有源码，查询怎样取整、池里的记录怎样起名，都能逐行核对（见 [KV Pool](kv-pool.md#一次查询怎样算池只补本地缺的整段)）。UCM 在本仓只剩一个外壳：启动时创建外部包里的引擎，此后调度侧、执行侧的每个问题都原样转过去，外壳自己不留状态。LMCache 更薄，本仓连外壳都没有写，只导入插件、复用上游。所以同样问「这一段前缀怎么算命中」，KV Pool 能在本仓答完，UCM 和 LMCache 要去外部包里找。

**官方文档自己的定位。** UCM 的部署文档说：KV Pool 靠把各节点的内存拼起来扩大前缀缓存的容量，容量仍受内存大小限制，也不持久；UCM 把计算和存储拆开，每个节点用本机内存做快取，共享存储做持久层。这是 UCM 文档对两者的对比；KV Pool 能接哪些后端、数据存到哪里，以 KV Pool 页为准。

另一条相邻的路是 [KV cache CPU offload](kv-cache-cpu-offload.md)：保存在本机主机内存、服务本实例；完整前缀复用与被抢占请求的尾块恢复要按具体版本区分。它没有本页文件共享与持久化这一层。

## PD 分离时，UCM 站在哪

**[PD 分离](pd-disaggregation.md)把一条请求的 prefill 和 decode 交给两组实例（P 和 D），中间要把算好的状态交过去。UCM 有两种站法：集中式里，共享存储就是交接点，P 存、D 取；P2P 里，这一次的交接由 Mooncake 直传，UCM 只在 P 上管可复用的前缀。读部署图时要分清两件事：谁保存可复用的前缀，谁把这一次请求的状态从 P 送到 D。**

下图展示两种拓扑下具体的节点数据流向：

```wiki-diagram
file: ucm
```

**边界与例外：`v0.30.0` / `main` 的仓内外壳与多模态入口。**

- **薄转发外壳与混合缓存**：在 `v0.30.0` 与 `main` 中，昇腾仓内仅保留 `UCMConnectorV1` 薄转发外壳并声明 `SupportsHMA`，避免关闭混合缓存管理器。但接 UCM 不会像 `AscendStore` 那样自动把 KDA 改为 `align`。
- **`main` 增量入口**：`main` 新增 `UCMConnector` 与 `UCMConnectorV1` 双注册名，并补齐 `get_loaded_kv_cache_group_ids` 转发。多模态编码器缓存则走独立的 `--ec-transfer-config`。

| 部署方式 | 这一次 P→D 的状态怎么走 | UCM 挂在哪 |
|---|---|---|
| 集中式 | P 存进共享存储，D 从共享存储取 | P、D 都挂 UCM，两端用同一份 UCM 配置 |
| P2P | Mooncake 从 P 直接传给 D | 只挂在 P 上管前缀复用：P 用多连接器组合同时挂 Mooncake 和 UCM；D 只挂 Mooncake |

**集中式为什么行得通。** P 先计算并提交保存，代理随后把原 prompt 发给 D；D 按兼容的身份查询同一份存储，读取已可见的前缀。官方示例代理只保证请求先后，没有查询存储持久化回执：P 的 HTTP 响应返回时，写入还可能在途。D 查不到的部分仍要计算，尾部不足整块或为执行保留的部分也会重算。因此，要验证的是 P 保存完成、D 实际命中并成功加载；设备事件同步开关不承担跨服务器提交协议。

**P2P 里 UCM 管什么。** 搬这一次请求状态的是 Mooncake（机制见 [Mooncake 连接器](mooncake-connector.md)）；UCM 管的是「P 下次遇到同样的开头时少算一段」。P 可以先从 UCM 取回共享前缀、少算一段，再把这条请求需要的全部状态经 Mooncake 交给 D。官方那个 MoE 大规模 EP 例子（上文对比数的出处）用的就是这种站法：P 上同时挂 Mooncake 和 UCM，D 只挂 Mooncake。

设这一次 P→D 要交的状态是 64 MiB（示意数），不计压缩、共享命中和元数据，两种模式单次交接经过的数据总量对比如下：

| 交接模式（示意：状态 64 MiB） | 数据流动路径 | 搬运趟数 | 总搬运量 |
|---|---|---|---|
| **集中式** | $64\text{ MiB}$ 写进共享存储 + $64\text{ MiB}$ 从共享存储读出 | 2 趟 | **128 MiB** |
| **P2P** | $64\text{ MiB}$ 从 P 直传到 D | 1 趟 | **64 MiB** |

集中式要走两趟，P2P 一趟，但推不出集中式的时延就翻倍：命中复用、写读重叠、存储布局和链路拓扑都会改变实际开销。官方文档对两者的定位是：集中式架构简单、实例彼此完全解耦、不带状态；P2P 时延更低，适合 P、D 节点同构的场景。

**按层开关，示例之间并不一样。** P2P 的 P 节点、单机混部、大规模 EP 的 P 节点三份示例打开逐层传输；集中式关闭，而且 P、D 共用配置。它们是部署选择；当前固定外部包的普通默认是逐层开启，最终实现还受模型布局和并行配置影响。这个开关与 KV Pool 自己的逐层开关分属不同配置入口，见页末[怎么开](#怎么开)。

查到前缀以后，还应确认模型需要的每类状态是否都可用。[SWA 回放案例](swa-bounded-replay.md)给出“分页历史在、窗口不在”的不同情况；这类模型恢复逻辑不能仅凭外部存储命中率判断，也不意味着 UCM 已实现同一恢复策略。

### 放进 Kubernetes 后，实例和 Pod 怎样数

Kubernetes 把容器安排到节点上运行；Pod 是一起调度的一组容器。UCM 官方另提供 Helm Chart，也就是一套生成部署配置的模板。它先区分独立服务组、组里的 P/D 逻辑实例，以及每个实例额外带的 worker Pod，再由引擎参数决定各进程怎样并行。

例如官方 Qwen3-0.6B 的多节点 2P2D 模板，在一个服务组里有两个 P 实例、两个 D 实例，每个实例由一个入口 Pod 加一个 worker Pod 组成。因而这里的「2P2D」并不是四个 Pod：

$$N_{\text{Pod}} = 2 \times (1 + 1)_{\text{P}} + 2 \times (1 + 1)_{\text{D}} = 4 + 4 = 8\text{ 个引擎 Pod}$$

| 角色（官方 2P2D 模板，单个服务组） | 计算式（逻辑实例 × 每实例 Pod 数） | 引擎 Pod 数 |
|---|---|---|
| P 侧引擎 Pod | $2 \times (1\text{ 入口} + 1\text{ worker})$ | **4** |
| D 侧引擎 Pod | $2 \times (1\text{ 入口} + 1\text{ worker})$ | **4** |
| **引擎 Pod 总数** | $4 + 4$ | **8** |

该模板每个引擎 Pod 申请一个 NPU 资源，合计申请八个 NPU 资源；路由器、Mooncake master 等控制组件另计。每个逻辑实例又配置 DP2、每 Pod 本地 DP1、TP1、PP1。因此，Chart 的两个 P 逻辑实例不能当成只有两个 DP rank；worker 的存在也不能单独证明开了 PP。节点数还受主机端口占用和反亲和调度约束，不由文件名里的「2」直接决定。

**谁接 HTTP 请求还受服务模式控制。** 该模板使用混合负载均衡，让入口和 worker 都提供 HTTP，由路由器选择；普通模式则只有入口接 HTTP，worker 以 headless 运行。Chart 会生成相应启动参数。UCM 在 P 侧复用前缀，P→D 仍由传输连接器交接；增加 D 实例不会自动增加 UCM 读取方。

## 多模态还有一份编码结果可以复用

图像、视频进入语言模型前，先经过 encoder：它把媒体变成一行行数值表示，交给后面的语言模型使用。多轮问同一张图时，这一步的结果可以复用。vLLM 本身有进程内的本地 encoder cache（单实例保留与淘汰规则见[多模态编码器缓存](multimodal-encoder-cache.md#encodercachemanager-如何独立于文本-prefix-caching-复用特征)）；新 UCM 的 **EC connector** 再把编码结果接到外部存储，扩展其保存空间。它保存的是编码后的矩阵，前面 KV connector 保存的是各层 attention 的历史，两者分别接入、分别计容量。

**一项媒体必须整份取回。** 假设一张图编码成 5 行、每行 2 个数，每块放 2 行。前两块各放两行，第三块只有最后一行，补一行零。查询必须三块都在才把这张图视为命中；缺一块就重新编码整项媒体，不能把“命中了两块”算成省掉三分之二的编码。

```wiki-diagram
file: ucm-encoder-chunks
```

读取端先分配能放三整块的矩阵，等加载完成后，把前 5 行交给模型。这个较短的视图仍引用原分配，补零行的空间也仍被占着。以每个数 2 B 的 BF16 为例（示意：5 行 × 2 列、每块 2 行）：

$$B_{\text{pad}} = (3 \times 2 - 5) \times 2 \times 2\text{ B} = 24\text{ B} - 20\text{ B} = 4\text{ B}$$

| 口径（示意：5 行 × 2 列，每块 2 行，BF16 每数 2 B） | 算式 | 字节数 |
|---|---|---|
| 有效编码数据 | $5 \times 2 \times 2\text{ B}$ | **20 B** |
| 三整块分块分配 | $3 \times 2 \times 2 \times 2\text{ B}$ | **24 B** |
| 末块补零开销 | $24\text{ B} - 20\text{ B}$ | **4 B** |

这是逻辑张量的字节账，文件层的最小对齐还要另算。块太小会增加查找和任务数，块太大则增加尾块浪费；是否值得存，还取决于重复媒体的比例以及读取与重新编码谁更快。

**查到与拿到是两步。** 调度侧确认完整命中后，执行侧提交加载，逐项等其完整加载成功后发布该项编码结果；本次加载函数会排空已提交任务再返回，任一加载失败则向引擎抛错，没有自动退回重新编码。保存先异步提交：每个 DP 组中，入口 PP 阶段的 TP 0、prefill 上下文并行 rank 0 负责写；其他参与加载的 TP rank 仍加载完整编码结果。保存任务持有源张量和完成依赖，直到任务结束才释放；每步收尾和关闭时都会等在途保存结束，因此异步提交并不省去收尾等待。

**相同媒体还不够，还要能认作同一份数据。** 键同时包含模型与配置、编码宽度和类型、分块方式以及媒体身份。存储默认按本次引擎启动生成身份，再按 DP rank 隔离；因此默认配置下，重启或换 DP 组不会自动共享旧结果。显式设置共同存储身份才改变这一范围，模型和布局的兼容检查仍保留。EC 的部署和本地缓存重置步骤见页末[怎么开](#怎么开)。

## 怎样验证普通 KV 真的从外部取回了数据

先固定权重、tokenizer、块长、并行设置和 UCM 版本，在独立测试目录里用跨越多个完整块的相同 prompt。第一轮检查成功保存；保留外部数据，重启引擎后再发相同请求，联合检查外部命中数、加载完成和错误、输出正确性。重启可排除原引擎显存命中，但主机共享快取可能还在；若要测文件存储，还需观察文件层读操作。

外部命中计数只证明查询找到了数据；任务提交或计时只证明运行过该路径。若换到另一实例验证共享，再确认它读的是同一份后端对象。P/D 组合则分别验证“P 的前缀复用”和“本次 P→D 交接”，冷请求没有前缀命中时，也应能完成正确交接。具体指标与排查入口见下面源码区。

## 混合模型接入边界：五组状态、KDA 按块留档与新 HLA 路径

[历史 GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)官方启动参数未配置 KV 传输，且作为混合模型默认关闭 prefix caching（见[五组缓存页面](prefix-caching.md#glm-双机上它开着吗)），未启用 UCM。下面一张图将前文的 K8s 2P2D 八 Pod 拓扑，与本节五组混合模型接入 UCM 的三档能力对照放在同一视图里：

```wiki-diagram
file: ucm-fig-k8s-and-glm-hla
```

本节其余推演均照钉住源码展开：无实跑，无吞吐、时延或命中率实测；上文官方那组对比数出自另一个模型与 8 机部署，不能当成这里的效果。

### 接在哪两处：新请求，和被抢占退回的请求

按上文第 1 步，调度器只在请求还没开始算时问 UCM。在这套部署里，这包括两种请求。

- **新请求。** 两台机器各是一个 DP 组，各有自己的 KV cache 池（见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。即使打开 prefix caching，机器 0 上算过的开头，机器 1 也用不上；两台都挂上同一份共享存储时，按官方部署文档，UCM 能让它们互相取用。这和官方那组数里「显存 prefix caching 在多个 DP 组下命中不到」是同一个原因。
- **被抢占退回的请求。** 块不够时，调度器抢占一条在跑的请求：它的块全部还回去，已算位置清零，退回等待队列的队首。按主线的算例，被抢占的那条约有 67,000 个位置要从头重算，约 9 步（推导见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)与 [KV 块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)）。它重新排队时已算位置是 0，调度器会去问 UCM；UCM 里存着多少，就能少算多少。能省多少，取决于 UCM 存下了多长一段、KDA 状态能不能接上（下一小节）；接口说明只要求连接器报 prompt 里的可用前缀，UCM 实际会不会把已生成的部分也补回来，在外部包里。这笔账没有数。

### 只加 UCM、不开 prefix caching：KDA 状态没有中间存档

GLM 每一层要保留的历史不止一种（见[混合模型到底要保留哪几类状态](kv-cache.md#混合模型到底要保留哪几类状态)）：稀疏 MLA 的潜向量和 indexer 缓存随位置增长，[KDA](linear-attention.md)（GLM 用的线性 attention）每层只存一份固定大小的递推状态。前缀要能「从第 N 个位置接着算」，KDA 那一侧就必须在第 N 个位置留过一份状态。

钉住的镜像里有一段补丁，会在接上 KV connector 时把 KDA 的缓存方式从「不留中间档」自动改成「按块留档」（`align`），但它只认 `AscendStore` 这一个名字，接 UCM 时不会改写。

照这段源码推演：只加 UCM、不开 prefix caching 时，KDA 仍不留中间档，块长盖住整条最长长度 133,120，中间位置没有 KDA 存档也就接不上前缀。要让中间位置接得上，必须显式打开 prefix caching：vLLM 这时走按块留档，KDA 块长落到 640，只在对齐到 640 的调度步终点留状态（与 [KV Pool 在 GLM 上的推演](kv-pool.md#只加-kv-pool不开-prefix-caching短于最长长度的-prompt-不会查询)同源）。即便如此，共享开头不足 640 个位置时，KDA 在那里没有存档，照样接不上。

### 8 张卡上要存些什么

本节只算 attention 缓存：每个 DP 执行组由 TP8 协作，专家的 EP16 分布另见[部署页分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。按[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)的块字节，full 组（稀疏 MLA 的潜向量加 indexer 缓存）一块 640 个位置在每卡是 8,355,840 B，折合每个位置 13,056 B；这份数据 8 张卡完全相同，不按卡切。KDA 状态按头切开，每卡不同；每请求每卡约 85 MiB 是分配页容量，包含页补齐和投机预留，原始状态容量约 18.2 MiB，具体有效数据与搬运布局还要逐项核对（见 [attention 的开销](attention-cost.md)）。这些量不能直接当成 UCM 每次传输的字节数。

接口这一层是接得上的：UCM 外壳声明支持混合缓存管理，vLLM 不会因为接了它就把混合缓存管理关掉，而 GLM 离不开后者；GLM 的稀疏 MLA 层在 attention 实现里留有「等本层到齐」「交出去存」两个调用点。存得对不对——KDA 状态和 5 个缓存组能不能被外部包正确存取——没有验证，缺的东西集中列在页末待核。

### 新 UCM 的混合路径补了什么

当前固定外部实现已有“full attention 加按块留档递推状态”的专门路径。它分别管理各组键与块号，先确认连续 attention 历史，再寻找能接续的状态边界；共同块长取各组块长的最小公倍数。MLA 的相同缓存使用共享键，由 TP rank 分担保存；KDA 按 rank 区分，加载时每卡拿自己的状态。因而“外部包是否做去重”在这版已有源码答案，旧部署是否兼容这版仍须单独验证。

混合路径的等待也与前面普通路径不同：整块实现会在前向收尾等待保存任务；逐层实现通常先预取两个层位置，并把最后提交放到其他分片之后，收尾会补未触发的层、提交并等待。它通过额外补丁给 KDA 和 GLM 的 indexer/MLA 外层补上读前等待、算后保存。GLM 这种依赖模块调用点的路径要求关闭模型编译，且配置不能是全部 FULL；不满足时连接器退回整块方式。允许的 decode 整图配置也会让加载提前全部完成，避免图内缺少逐层等待。只打开逐层开关，无法保证仍有搬运与逐层计算的重叠。

官方新支持表列了 GLM-5.3-Flash 的开发分支支持；另有 UCM 0.8.0、vllm-ascend v0.26.0rc2、GLM-5.3-w8a8c8 的八机 P/D 报告，采用 65,536 输入、512 输出和 90%预填。这与本站旧双机 Flash 案例是不同组合。报告中 200 请求时 TTFT 从约 219.7 秒降到 125.6 秒，TPOT 从 41.2 ms 升到 42.5 ms；收益与代价应一起看，不能用它给旧基线填写实测结果。

## 常见误解

- **「UCM 一开，P 和 D 就经存储传状态。」** 只有集中式走这条路；P2P 里传输是 Mooncake 的事，UCM 只在 P 上管前缀。
- **「连接器注册成功、服务起来了，就证明后端能持久保存。」** 注册只证明入口接上了；读写、跨机器可见、重启后能不能复用，都要在实际后端上验证。
- **「第二次请求变快了，功劳全归 UCM。」** 还要分清是从外部存储命中的，还是本机显存 prefix caching 命中的；前缀、路由、并发不控制住，两类收益分不开。官方那组数就是分三档对比的。
- **「UCM 也能让 decode 变快。」** 它省的是 prefill 的计算；官方那组数里三种做法的 TPOT 几乎一样。
- **「两台机器配了同一个目录，就是共享存储。」** 要各台机器读到同一份后端对象；本地目录分离会让 D 查不到 P 的数据，路径不可用或加载失败则要另查错误，不能都当普通未命中。
- **「UCM 和 KV Pool 是一回事。」** 接口相同，实现不同：KV Pool 的逻辑在 vllm-ascend 仓里、每一步都能核对；UCM 的逻辑在外部包里。
- **「GLM 接上 UCM，就能复用 GLM 的前缀。」** 这套部署没开；只加 UCM 时 KDA 状态不按块留档，至少还要显式开 prefix caching，外部包对 KDA 状态的支持也没验证。

## 对照源码

### 怎么开

旧 Ascend 部署指南要求另装 UCM，前提写 vLLM 与 vllm-ascend 的 main 分支及 Atlas 800 A2。当前外部指南提供按引擎版本、CANN、A2/A3、系统、架构选择的发布镜像或带后端 extra 的 Wheel；不能只装一个不匹配的纯 Python 包。源码安装应在目标引擎环境选择 `PLATFORM=ascend` 或 `ascend-a3`，使用所需编译工具链。安装入口见 [UCM Quickstart](https://ucm.readthedocs.io/en/latest/user-guide/quick_start/#vllm-ascend)。

下列旧配置经 Ascend 已注册外壳接入；新外部指南还明确设置 `ENABLE_UCM_PATCH=1`，并用 `kv_connector_module_path: "ucm.integration.vllm.ucm_connector"` 直接选择外部分发器。入口、运行时补丁、外部包版本三者应成套选用。混合逐层还依赖对应引擎版本的 KDA/indexer 调用点补丁，不能只凭导入成功验收。

**第一步：写 UCM 配置文件。** 四份官方示例（集中式、P2P 的 P 侧、单机混部、大规模 EP 的 P 侧）都是这个结构，只有最后一个键的取值不同：

```yaml
ucm_connectors:
  - ucm_connector_name: "UcmPipelineStore"
    ucm_connector_config:
      store_pipeline: "Cache|Posix"
      storage_backends: "/mnt/test1"
      cache_buffer_capacity_gb: 64
enable_event_sync: true
use_layerwise: false   # 集中式；其余三份为 true
```

- `store_pipeline: "Cache|Posix"`：Cache Store（Device ↔ Host）串上 Posix Store（Host ↔ 存储后端），文档称 PipelineStore 是推荐的 UCM 连接器。
- `storage_backends`：后端路径。混部示例允许本地 SSD 或 NFS；集中式跨节点 PD 和大规模 EP 例子要求所有节点都能访问同一个共享后端（NFS 挂载或 3FS）。
- `cache_buffer_capacity_gb: 64`：主机缓存预算示例。外部包按其缓存核心和并行范围拆分；纯外部 DP 服务需手动按同机实例数分配。参数值 64 在本固定实现中表示 64 GiB，详见上文[主机预算](#主机预算要按哪个范围算)。
- 最后两个键属于 YAML 根配置。外部 `Config` 经 `UCM_CONFIG_FILE` 读取文件；文件缺失或 YAML 错误会记录错误并得到空配置，后续初始化再因没有 Store 配置失败。文件必须在每个实际读取它的进程或容器中可见。
- `use_layerwise`：P2P 的 P 侧、混部、大规模 EP 的 P 侧为 `true`，集中式为 `false`，集中式 P、D 两端的 `vllm serve` 用同一个 `UCM_CONFIG_FILE` 指向它。它和 AscendStore 从 `kv_connector_extra_config` 里读的同名 `use_layerwise`（默认 `false`）不是一个开关，两者不互通，也不互相覆盖。
- `enable_event_sync`：四份示例都为 `true`，当前外部实现默认也为 `true`。在当前设备流记录计算完成事件，交给保存任务作为读源数据的依赖；关闭时先做设备同步，事件创建失败也回退同步。它不保证所有写入已经完成，更不是 P/D 跨机提交协议。

当前普通整块路径还可在 YAML 根层设置 `use_request_async_load: true`，默认 `false`。它才会启用请求级异步等待；逐层、CP、混合子类不支持此选项，不能用“底层异步 I/O”推断调度器会挂起请求。`use_lite` 只存查元数据，用来估计命中率，没有真实 KV 加载收益。

**换后端时从对应配置开始。** [3FS 指南](https://ucm.readthedocs.io/en/latest/developer-guide/cache-configuration/ds3fs/)使用 `Cache|Ds3fs`，先核 `libds3fsstore.so` 及其 3FS 依赖；仅装 UCM 而构建时跳过可选库还不能用。[Mooncake 指南](https://ucm.readthedocs.io/en/latest/developer-guide/cache-configuration/mooncake/)使用 `Mooncake` 或 `Mooncake|Posix`，它的 segment、共享缓冲与本地缓冲是不同预算，适配层预检容量也不能当作 Mooncake 的共享缓冲容量。[DramPool 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/cache-configuration/drampool.md)使用 `Dram`，控制端口与 HIXL 端口会按物理设备号、scheduler/worker 角色偏移，多实例要预留不重叠范围；资源快照还要让采集进程实际可读，健康端口不是独立 `/metrics` 端口。

[压缩指南](https://ucm.readthedocs.io/en/latest/developer-guide/cache-configuration/compress/)使用 `Cache|Compress|Posix`：当前 `data_type: 0` 只解释 BF16 字节，不做类型转换；`compress_ratio: 16` 编码为原分片一半，32 为透传。半分片必须非零且按 4096 B 对齐，否则存储大小向下取整；使用独立目录，分别检查文件大小、真正解码后的输出质量和 CPU 开销，不能把“任务完成”当作所有分片解码成功。

**第二步：服务侧挂连接器。** `--kv-transfer-config` 选 `UCMConnector`、`kv_role` 设 `"kv_both"`，在 `kv_connector_extra_config` 里用 `UCM_CONFIG_FILE` 指向上面的文件。集中式 PD 的 P、D 两端都这样配，示例为 QwQ-32B、`--tensor-parallel-size 4`、2P2D：

```bash
--kv-transfer-config '{
  "kv_connector": "UCMConnector",
  "kv_role": "kv_both",
  "kv_connector_extra_config": {"UCM_CONFIG_FILE": "/path/to/ucm_config_example.yaml"}
}'
```

**P2P 的配法不同。** P 侧用 `MultiConnector` 把 `MooncakeConnectorV1`（`kv_producer`）和 `UCMConnector`（`kv_both`）组合起来，外层 `kv_role` 为 `kv_producer`；D 侧只配 `MooncakeConnectorV1`（`kv_consumer`），不挂 UCM。示例为 2P2D、两端各 TP4；大规模 EP 例子（GLM-5.1-w4a8，P 为 4 台 DP4×TP8，D 为 4 台 DP8×TP4）也是这个组合。

**跨节点旧示例固定了 `PYTHONHASHSEED`。** 集中式取 123456，P2P 与大规模 EP 取 0，同一示例的 P、D 一致；单机混部未设。旧 vLLM 基线的本地块指纹以它初始化种子，未设则随机；`v0.30.0` 与 `main` 已按哈希算法区分确定默认与随机种子，见 [KV Pool 的版本差异](kv-pool.md#版本差异)。当前外部 UCM 的 `RequestHasher` 另用稳定的 UCM 种子和哈希链，不能把 vLLM 的随机种子规则直接套到这些外部键。旧部署中保留示例的共同种子，同时核对实际外部包的身份算法。

配置入口、配置文件在每台机器上是否可见、`ucm` 包是否装好，是三件都要检查的事。

**Kubernetes 部署沿独立的 [Helm 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/frameworks/kubernetes/deploy.md)配置。** 集群先具备kthena控制器及其资源定义，PD还要有kthena-router；Chart不替你安装它们、设备插件或驱动。Ascend需显式选择匹配镜像，在每个有关节点让模型卷可读、缓存卷可读写，默认主机网络、主机IPC与8000端口也要符合节点条件。模板从缓存挂载路径生成UCM配置；模型参数放在各role的 `vllmArgs`，不要重复填写Chart托管的HTTP、headless、DP地址/rank或KV传输参数。

先运行 `helm lint` 和 `helm template` 查看镜像、挂载、资源与参数，再在集群验证模型就绪、冷请求交接和外部缓存复用。PD客户端应访问已有的kthena-router网关；该Chart的引擎Service同时选择P和D，用于监控，不是PD客户端入口。`unifiedcacheConfig.enabled: false` 会去掉UCM连接器及其托管缓存挂载，仍保留PD传输；镜像环境变量 `ENABLE_UCM_PATCH` 是另一个设置。Chart允许Mooncake传输与UCM组合，当前拒绝NIXL与UCM同时开启，这不是所有vLLM连接器的普遍限制。

**多模态 EC 使用另一组入口。** 在支持 EC 调度接口的引擎中，`--ec-transfer-config` 选择 `UCMECConnector`，模块为 `ucm.integration.vllm.ucm_ec_connector`，读写双方角色为 `ec_both`。其 `ec_connector_extra_config.UCM_CONFIG_FILE` 指向独立文件；顶层是单个 `ucm_ec_connector`，不是 KV 的 `ucm_connectors` 列表。最小结构可从[固定 EC 示例](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/examples/ucm_ec_config.yaml)展开：Store 配置下选择 `Cache|Posix`、独立可写目录与主机预算，`encoder_cache_config.chunk_size` 指定每块行数，必须是正整数。官方示例取 128 行、32 GiB 主机预算，这两个数不是所有模型的推荐容量。

EC 强制共享主机缓冲。当前代码先按缓存核心执行上文的[预算拆分](#主机预算要按哪个范围算)，只有未设置预算的旧核心后备路径才取 128 GiB；不能把使用指南中的 128 当成所有版本的默认值。`encoder_cache_config.store_unique_id` 控制共享存储域；默认由 worker 与 scheduler 握手生成，并附 DP 编号。修改它前还要核对模型、媒体预处理和布局。KV 与 EC 同时启用时保留两份配置、分开的冷存储目录，并把两边主机预算相加。

**验证 EC 要清掉三个本地缓存。** 按[EC 使用指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/developer-guide/features/ec-connector.md)在测试实例启动前设置 `VLLM_SERVER_DEV_MODE=1` 和 `UCM_LOG_LEVEL=debug`。第一轮发送相同媒体并确认保存完成，等所有请求结束，再依次调用 `reset_prefix_cache`、`reset_mm_cache`、`reset_encoder_cache`；前者还必须检查返回 JSON 的 `success` 为真，HTTP 200 不足以证明重置成功。第二轮保留同一引擎及 UCM 数据，确认命中、实际 `EC load item` 路径、加载没有错误以及输出正确，再比较首 token 时延。只清媒体预处理缓存不会清 encoder 输出；默认存储身份下也不能靠重启替代这三次重置。文件数不变和保存提交日志都不能单独证明外部复用成功。

### 会报什么错

EC 初始化会拒绝多模态 pruning：这类裁剪会改变编码输出及位置通道，固定矩阵布局无法直接复用。作为写入方时，当前实现只接受 `UcmPipelineStore` 且首层为 `Cache`、`Mooncake` 或 `YuanRong`；KV 侧能选的 `Dram` 不能据此用于 EC 写入。EC 加载失败会向引擎抛错；保存提交或等待中的错误被记录，后续仍排空其他任务，但读取源张量、检查布局和构造键时的错误会直接抛出，不能概括成“所有写入错误都不影响服务”。

- **没装 `ucm` 包。** 外壳模块开头就 `from ucm.integration.vllm.ucm_connector import UCMConnector`。vLLM 的连接器工厂注册时只记模块路径，创建连接器时才导入；没装时，在引擎启动、创建连接器那一步抛 `ModuleNotFoundError: No module named 'ucm'`。
- **没有 KV 传输配置却构造了它。** 构造函数第一句 `assert vllm_config.kv_transfer_config is not None`。
- **同名目录不共享。** 查询可能只是未命中；路径不可访问、空间不足或已命中后加载失败则有独立错误。当前普通路径会记录加载失败块，并把结果反馈引擎，按实际加载失败策略处理。
- **配置或依赖错误。** 先检查 `UCM config file not found`、YAML 解析日志、实际创建的 Store 和路径；再检查 native 扩展及动态库、主机预算、挂载权限与空间。成功 `import ucm` 只证明 Python 入口可导入。
- **组合不支持。** 当前外部分发器拒绝 PP 配普通整块模式；混合多组且选择 `kv_load_failure_policy='recompute'` 也会明确拒绝，应沿该版本支持的失败策略配置，不能把所有加载失败统一写成自动重算。
- **不会出现的两条。** 接 UCM 时 vLLM 不会打出「关闭混合缓存管理」的警告，因为外壳实现了 `SupportsHMA`；多连接器组合要求每个子连接器都支持，P2P 那套里的 `MooncakeConnector` 和多连接器外壳在镜像里也都实现了。AscendStore 那条「KV 传输时 mamba 缓存只支持 align」的断言也不会触发，因为那段补丁只认 AscendStore。

### 开销和什么时候别开

- **外壳本身几乎不花钱。** 每个接口多一次 Python 转发；真正的开销在外部包：查找、搬运、写回。
- **读的时机。** 默认普通同步路径在本次前向消费前等待；普通整块的请求级异步选项启用后，请求先挂起（`WAITING_FOR_REMOTE_KVS`）。两者与 Store 内部异步任务分别看。
- **写回。** 普通逐层提交与整块收尾提交都跟踪在途保存，结束和抢占时保护源块；HLA 混合路径另有收尾等待。保存时间应按所选实现测量。
- **容量。** 第 2 层按实际缓存核心和共享范围计总账；第 3 层按真实存储布局、去重和保留策略估算。GLM 的 85 MiB 是分配页容量，不能直接乘请求数当外部传输量。
- **测收益时把两类命中分开。** vLLM 给连接器单独记一份前缀命中统计（查询的位置数、命中的位置数、这条请求是否被抢占过），和本地 prefix caching 的统计分开；再控制住前缀、路由和并发，外部命中和本机命中的收益才分得开。
- **什么时候别开。** 请求之间很少共享长前缀；只有一个实例、显存留得住热点前缀，本地 prefix caching 已经够用；存储的带宽和时延让搬回来比重算还慢；模型是 GLM 这类混合结构，而外部包对它的支持还没验证。

实际验证可看 `ucm:ucm_hit_tokens_total` 的同一进程运行期增量，再查完成的加载、错误和输出。`cache_posix_load_success_shards_total` 不能单独证明发生了文件读取，主机快取也可能满足它；Posix 任务计数也可能包含失败。需要测文件路径时，将文件层活动一起观察。指标通过 vLLM 的 `/metrics` 导出，先发请求触发采集；空闲时旧数值不代表后端状态刚更新。

存储健康探测与缓存验证分开。健康熔断会让新查询表现为未命中、新加载/保存返回不健康错误，已提交任务仍走完成接口；它不会替引擎重试推理。Posix 的小文件读写探测成功也不能证明某条请求的 KV 可复用。按 [UCM 排障入口](https://ucm.readthedocs.io/en/latest/reference/troubleshooting/)继续区分初始化、未命中、加载失败和存储健康。

**先估计可复用多少，再测真实代价。** [Trace 模式](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/diagnostics/trace-mode.md)的 `use_lite: true` 只记录请求和块元数据，用模拟 Store 估算不同缓存容量的命中率；它没有真实 KV 读写，不能给出外部搬运带宽或实际加速。离线分析还需要日志中的 `UCMTraceMeta`，其中记录并行拓扑和哈希块长；请求日志里的输出长度取生成上限，不应当成实际生成长度。

**慢在哪一段，用对应工具量。** [UCM Toolkit](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/index.md)是独立工具包，可单装 `ucm-toolkit` 或使用 `uc-manager[toolkit]`；后者只添加工具，不会替你选好设备后端。Linux 观测、原生 I/O 和设备搬运各有依赖，先确认对应工具可用，再在测试目录测量。

| 想回答的问题 | 官方工具入口 | 怎样解释结果 |
|---|---|---|
| 主机环境是否有明显不足 | [precheck 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/precheck.md)：`ucm-toolkit run precheck` | 共享内存默认512 GiB和读写8 GB/s是预检告警阈值，不是所有模型的硬性最低要求；缺少原生带宽模块可能跳过测量，须看具体状态 |
| 文件存储能搬多快 | [posix-aio 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/posix-aio.md)：`ucm-toolkit run posix-aio` | 测 Store I/O；模型自动推导只覆盖所列GQA/MLA/DSA，拒绝混合/Mamba与DeepSeek V4，不能用它自动推算GLM混合状态 |
| 主机到设备的哪条路径慢 | [dev-sandbox 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/dev-sandbox.md)：`ucm-toolkit run dev-sandbox` | 先编译对应后端，再选独立copy/trans/aio用例；单段搬运带宽不等于整条请求TTFT，CPU模拟后端也不代表NPU结果 |
| 服务期命中与读写怎样变化 | [metrics-view 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/metrics-view.md)：`ucm-toolkit run metrics-view` | 快照中的Counter是累计计数，Gauge是当前容量或状态；带宽窗口需连续采集，保留实例、worker和缓存层口径 |
| 网络链路是否繁忙 | [nic-monitor 指南](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/toolkit/user/nic-monitor.md)：`ucm-toolkit run nic-monitor` | 读物理网卡计数，包含这张网卡上的其他流量；与UCM服务指标对照后才能判断是否由缓存读写引起 |

指标配置也要与工具版本相配。上述固定版的四份内置预设没有声明 `tp_size`，传入指南所写的 `--config-param tp_size=8` 会报 `Config parameter not found: tp_size`；只有所选配置明确声明参数时才能覆盖它。计算分层命中率时核对实际公式的分子、分母与TP聚合范围，不直接套用旧指南的参数要求。

读[完整指标参考](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/user-guide/observability/metrics-reference.md)时还要注意单位和计数时点：名称含 `bandwidth_gbps` 的指标实际是GB/s，单任务带宽分布不能当成系统总吞吐；KV客户端的时长用秒，普通UCM时长多用毫秒。保存提交字节与最终成功写入不同，同一数据经过连接器、主机缓存和文件层还会分别计数，不能相加成唯一数据量。文件层当前字节计数也包含错误或中止路径的名义任务大小，应同时看错误和实际文件I/O。

最终仍回到真实请求。官方 [AISBench 方法](https://github.com/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/docs/docs-site/docs/en/benchmark/aisbench.md)先用前缀数据填充，再用“同前缀加新后缀”的请求测试，分开记录本地与外部命中以及TTFT、TPOT、吞吐和失败请求数。构造参数中的命中比例是预填前缀占输入的比例，实际命中还要从服务指标验证；精度测试则另外固定数据集、提示方式和采样条件，不能由性能用例正常返回替代。

[官方容量计算器](https://ucm.readthedocs.io/en/latest/toolkit/kv-cache-calculator/)按浏览器中的模型公式估算，不启动模型；反算token容量时，应填已经扣除权重、运行时开销和预留空间的KV预算。其固定版本的GLM混合路径按已哈希完整块估算，最大长度另假定两份滚动递推状态，没有让用户指定本站GLM部署的三个草稿token。它的保存量明细还把向下取整的结果标成了向上取整：4096个位置、640块长显示6块，实为向下取整。因此应回到实际引擎的块布局、状态留档和保存选择核容量与字节数；本站GLM预算继续以[固定部署算例](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)为准。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 镜像 `db701c1f` 同此结构）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 在本仓的 UCM 外壳沿用子包结构与 `SupportsHMA` + 保留钩子委托逻辑；`main` 新增类名别名注册（防 `MultiConnector` 指标重建报错）以及 `get_loaded_kv_cache_group_ids` 钩子转发。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 注册名与别名 | `UCMConnector`（GLM `db701c1f` 同） | `UCMConnector` | `UCMConnector`（`kv_transfer/__init__.py#L91-L95`） | `_register_with_class_name_alias` 同时注册配置名 `UCMConnector` 与类名别名 `UCMConnectorV1`（`#L22-L55`、`#L133-L137`），避免 `MultiConnector` 按类名重建指标时报 `ValueError` |
| 外壳模块路径 | `kv_pool.ucm_connector`（单文件） | `kv_pool.ucm_connector`（单文件） | `kv_pool.ucm_connector.connector`（子包导出 `UCMConnectorV1`） | `kv_pool.ucm_connector.connector`（子包导出 `UCMConnectorV1`） |
| 外壳能力与保留钩子 | 实现 `SupportsHMA`，保留接口优先委托外部分发器，否则回落内部 connector | 同左 | 同左（`connector.py#L37-L70`） | 延续左列，新增 `get_loaded_kv_cache_group_ids` 委托（`connector.py#L290-L297`），对接上游 `skip_zeroing_group_ids` |
| KDA 自动改 `align` | `patch_mamba_config` 只认 `AscendStoreConnector` | 同左 | 仍只认 `AscendStoreConnector`（接 UCM 不自动改 `align`） | 同左 |
| 上游 EC 编码宽度依赖 | `0fc695fc` 无 `ec_connector.cpu.common` | `568afb3a` 提供 `_get_encoder_cache_hidden_dim` | `ced6857a` 提供 `_get_encoder_cache_hidden_dim` | `ba15685a` 移除该私有辅助函数，改为 `model_config.get_inputs_embeds_size()`（`common.py#L71-L95`），固定外部 UCM `4b9acbc8` 的 EC 导入须同步适配 |

四个提交的部署文档前提都写 vLLM 与 vllm-ascend 的 main 分支，UCM 本身按外部指南另装。上面的核对只覆盖本仓的入口、外壳和部署说明，不证明任意 UCM 版本都能配任一发布分支；确定组合时要同时固定外部 UCM 版本、存储后端和 vLLM / vllm-ascend 版本。

本页外部实现固定为 UCM `4b9acbc8`，独立于上述 Ascend 钉点。`v0.30.0` 与 `main` 的 Ascend 指南修复了 UCM 安装、支持表、PipelineStore 的链接，旧指南正文与示例基本不变。外部默认值必须看实际安装库：Cache 核心版本 1 或至少 2 的路径以默认 160 GiB 总预算进入分配，旧未版本化库的共享路径仍补 128 GiB；当前官网配置表还列旧 native 256/私有 32 GiB，不能当作所有安装包的统一默认。

EC 属于此外部固定版本的新入口，不经过上表的 Ascend KV 外壳。它无条件导入上游 `ec_connector.cpu.common._get_encoder_cache_hidden_dim`：`v0.23.0` 基线 `0fc695fc` 没有该模块；`v0.26.0rc` 配套 `568afb3a` 与 `v0.30.0` 配套 `ced6857a` 具备该解析函数；`main` 配套 `ba15685a` 已改由 `model_config.get_inputs_embeds_size()` 获取编码宽度。整套 EC 调度、重置接口与 NPU 行为仍须在所选组合验证。GLM 双机的原启动参数也没有启用 EC。

### 源码位置

| 看什么 | 在哪（db701c1f，另注明的除外） |
|---|---|
| 连接器注册 | `vllm_ascend/distributed/kv_transfer/__init__.py` L57–L59（main 为 L85–L89） |
| 外壳：导入外部包、构造、保留接口委托 | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py` L5–L8、L37–L69 |
| 外壳：执行侧四个接口 | 同文件 L100–L159 |
| 外壳：调度侧问答 | 同文件 L194–L218 |
| 外壳（main） | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py` |
| 部署文档 | `docs/source/user_guide/feature_guide/ucm_deployment.md`：定位与三层 L3–L64；PD 两种方式与集中式 L79–L170；P2P L202–L330；混部 L363–L416；大规模 EP L459–L700；对比数 L755–L885 |
| 上游：接口语义 | vLLM `distributed/kv_transfer/kv_connector/v1/base.py` L454–L487（问答）、L285–L290（抢占）、L542–L561（结束时暂缓还块） |
| 上游：何时问、异步挂起、命中统计 | vLLM `v1/core/sched/scheduler.py` L604–L640、L783–L812 |
| 上游：发起加载与等保存 | vLLM `v1/worker/kv_connector_model_runner_mixin.py` L78–L101 |
| 上游：混合缓存管理自动关闭 | vLLM `config/vllm.py` L1479–L1500 |
| KDA 自动 align 只认 AscendStore | `vllm_ascend/patch/platform/patch_mamba_config.py` L24–L41、L205–L226 |
| GLM 稀疏 MLA 的逐层调用点 | `vllm_ascend/attention/sfa_v1.py` L1716–L1723、L2028–L2031；`vllm_ascend/attention/indexer_kpool_mla_v1.py` L800–L850 |
| LMCache 的接入 | `vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py` |

**来源与结论对应：**

- `UCMConnector` 注册到外壳模块，对照第 1 项来源 [C1]，main 的新路径对照第 27 项来源 [C27]。外壳在模块开头导入外部包，构造时创建外部引擎、只留这一个成员，保留接口按外部分发器是否显式实现来选分发器或内层连接器，对照第 30、2 项来源 [C30][C2]；执行侧与调度侧的方法原样转发，对照第 3、4 项来源 [C3][C4]。
- UCM 的定位、三层结构、外部包的其他能力、对 KV Pool 的比较，对照第 5 项来源 [S5]；两种 PD 方式、集中式配置、PipelineStore 为推荐、共享后端要求、集中式两端同配，对照第 6、7 项来源 [S6]；P2P 的多连接器组合与 D 只挂 Mooncake，对照第 8 项来源 [S8]；混部示例的按层开关与本地 SSD，对照第 9 项来源 [S9]；大规模 EP 例子的部署、模型与 P 侧的连接器组合，对照第 10 项来源 [S10]；三档对比数与多 DP 组下显存命中偏低的解释，对照第 11 项来源 [S11]。集中式 P、D 两份启动脚本都设 `PYTHONHASHSEED` 且同值，对照第 33 项来源；P2P 与大规模 EP 的四处同类设置、混部示例未设，是对部署文档检索的结果。旧 vLLM 基线的前缀块指纹没设种子时每个进程各自随机，对照第 34 项来源；新版条件回链到 KV Pool。
- 连接器可以答「还没定」、要说明同步或异步、只报可用前缀，是第 12 项接口契约 [C12]。只有已算位置为 0 的请求才去问、答不上来就本步跳过，对照第 13 项 [C13]；借块后回告、异步加载先挂起、连接器单独的命中统计，对照第 14 项 [C14]。前向加载和收尾接口调用见第 15 项 [C15]，接口的抢占通知与结束暂缓还块见第 16、17 项 [C16][C17]。这些接口声明不替代外部 UCM 的实际分支。
- 连接器不支持混合缓存管理时 vLLM 才自动关掉它，对照第 18 项来源 [C18]；多连接器外壳与 Mooncake 连接器都实现了该接口，对照第 31、32 项来源。自动改 align 只认 AscendStore、不开 prefix caching 时 KDA 块长取最长长度，对照第 19、20 项来源 [C20]。GLM 稀疏 MLA 的实现继承自带逐层调用点的父类，对照第 21–23 项来源 [C21][C23]。LMCache 在本仓只导入插件、复用上游连接器，对照第 24 项来源 [C24]。
- 外壳在 v0.23、v0.26、main 与 db701c1f 逐字相同，对照第 25、26、28 项来源 [C25][C28]；部署文档的逐字比对与 `UCM_CONFIG_FILE` 零命中是对四个提交直接比对和检索的结果。GLM 双机的启动参数里没有 KV 传输配置，对照第 29 项来源 [S29]。
- 1,000 / 256 / 800 个位置、32位置一段和64 MiB 是教学设定 [A]。「再供544个位置」、两趟/一趟与64GiB预算拆分是带条件的演算 [D]。旧GLM仅加UCM时不留KDA中间档、抢占后能省多少属于钉住规则下的推演 [I]；块字节、85MiB页容量及约18.2MiB原始容量、67000位置沿对应主解释页。
- 外部UCM固定版本：第38项给生命周期说明；39–43给普通模式、请求级异步、加载/保存/回收实际分支；44–45给身份算法；46–49给预算分配、核心检测与GiB单位。50、63的官方配置说明保留旧默认，正文以实际核心分支区分，不能把文档数字套给所有构建。
- 第51、62、68项分别给重启回放、存储健康和指标采集。52–54给支持表、安装命令和源码构建；55–58、64–66、69给混合布局、TP分工、引擎约束和保存等待；59给设备事件、60给配置读取。61是另一个GLM-5.3八机官方测试，67说明集中式代理与存储完成的区别。该测试的精度图只有各两轮结果，不能据此证明统计等价或替代本站Flash基线验收。
- 第70–73项分别为固定外部 UCM 的 3FS、Mooncake、DramPool 和压缩指南全文；上面的依赖、预算、端口、单位、质量与验证条件来自这些具体后端，不能套回旧 Ascend 示例。DramPool 的另一模型性能表也不作为本站 GLM 双机实测。
- 第74、75项为 EC 使用指南与完整设计，78为配置示例；76给矩阵布局、分块键、存储身份与预算，77给调度过滤、完整加载后发布、写入方选择及在途保存生命周期。5行×2列、每块2行是独立教学设定，20/24/4 B 按 BF16 每数2 B 推导；图中的补齐与取视图对应这份实现。EC 指南中的128 GiB旧默认按76与46–49的实际分支解释。
- 第79、80项给 `v0.26.0rc` 与 `v0.30.0` 配套上游的编码宽度解析；v0.23 缺少该模块来自固定 `0fc695fc` 的目录检查，结合76的无条件导入判定不兼容。此解析还考虑视觉深层特征拼接，不能一律拿语言模型宽度估算 EC。
- 第81项说明Trace与模拟分析范围；82–87分别为Toolkit安装、环境预检、文件I/O、指标窗口、网卡监测与独立搬运工具。88给受控前缀数据与性能/精度分开验证的方法。表中是工具选择入口，完整参数须沿各指南展开；本页没有设备带宽或推理实测。
- 第89项给指标类型、层级、单位、提交/完成口径及文件层计数限制；90给配置参数必须已声明的检查，91、92给内置配置示例。对四份固定预设逐一调用同一解析函数均拒绝 `tp_size`，故不照搬85中的旧参数要求。
- 第93、94项分别给Helm部署与扩容口径；95是所讲的Ascend Qwen3-0.6B多节点2P2D模板，96给共享默认配置。八个引擎Pod的计算直接按模板中两种role各2实例、每实例1额外worker推导，NPU资源申请与DP2/TP1/PP1也来自该模板，不是GLM双机配置或集群实测。
- 第97项说明容量计算器的用途与预算前提；98给GLM等线性混合模型的推导、块取整、保存量及最大token公式。工具中的“保存量”不能直接替换本页按实际张量与存储路径区分的分配容量和传输量；固定GLM参数的两项计算已在浏览器操作，结果不作为设备实测。

**待核：**

- 旧GLM部署未固定外部UCM包版本；需要确定实际安装包、缓存核心、运行时补丁和引擎组合。新版身份、整块与尾部规则、事件、预算和保存时序已有上述固定源码，不能倒推旧包完全相同。
- 新HLA源码已提供分组、MLA共享键、KDA按rank和调用点补丁；仍缺旧GLM双机5组实际张量布局、补丁命中、一次正确加载/保存与失败路径的设备验证。
- 被抢占的请求重新排队时，UCM 能补回 prompt 还是也能补回已生成的部分；在 GLM 双机上能少算多少步。
- 在 GLM 双机上实际打开 prefix caching + UCM 的启动日志与一次命中的请求日志；吞吐、TTFT、命中率、存储带宽都没有 GLM 或这套 A2 双机上的实测数。
