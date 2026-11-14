---
id: kv-pool
title: KV Pool：把算过的开头存进外部池，别的实例也能取回
type: feature
summary: >-
  KV Pool（外部 KV 池）让推理实例经 KV connector 把算完的整段 KV 存进主机内存、SSD
  或别的节点拼成的共享存储；开头相同的请求先看本地 prefix caching
  命中几段，池只补多出来的整段。讲一次查询怎样取整相减、查到后的搬运与写回、记录的名字，以及和抢占换出的区别；GLM 双机没有开它。
aliases:
  - KV Pool
  - KV 池
  - 外部 KV 池
  - KV Cache Pool
  - AscendStore
  - AscendStoreConnector
  - 外部前缀缓存
  - get_num_new_matched_tokens
  - cache_transfer_granularity
  - lookup_rpc_port
  - global_segment_size
  - kv_load_failure_policy
  - MooncakeStoreConnector
  - standalone-store
  - Mooncake SSD offload
chapters:
  - '11'
sources:
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L491-L591
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L86-L160
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L417-L429
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L26-L77
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L126-L143
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L76-L123
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L253
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1146-L1161
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L293-L339
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L174-L194
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L219-L237
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L722-L790
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L838-L874
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1432-L1450
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L734-L745
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L830-L839
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L26-L41
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L205-L226
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L358-L392
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L609-L620'
  - 'vllm@0fc695fc:vllm/config/kv_transfer.py#L70-L73'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2286-L2293'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L98-L113'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1479-L1500'
  - 'vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_pool.md#L21-L50'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_pool.md#L108-L120
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_pool.md#L297-L307
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L5-L15
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L31-L52
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L66-L76
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L114-L124
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L116-L126
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2595-L2639
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L248-L255
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L55-L75
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L13-L35
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L298-L312
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L18-L30
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L654-L657
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L359-L387
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L234-L242
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L245-L257
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L814-L822
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L36-L71
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L40-L75
  - >-
    raw:sha256-98b1383ba0728e87316d031faa4c821f4a81e9f49389c01c2be4d33419bdfd59.md#L1-L1211
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L220-L235
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L831-L859
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:docs/source/user_guide/feature_guide/kv_pool.md#L21-L47
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L71-L75
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L117-L200
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L334-L365
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L118-L127
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L118-L127
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L55-L63
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L137-L216
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L892-L900'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L89-L164'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L20-L21'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L288-L298'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2912-L2954'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_mamba_config.py#L155-L176'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L377-L398'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1776-L1794'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1385-L1399'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1385-L1399'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1722-L1739'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2487-L2528'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2775-L2819'
  - "vllm@0fc695fc:docs/features/mooncake_store_connector_usage.md#L37-L66"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L73-L150"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L985-L1007"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L98-L152"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L152-L208"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L139-L209"
  - "vllm@0fc695fc:docs/features/mooncake_store_connector_usage.md#L140-L174"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L985-L1053"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1023-L1095"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1537-L1637"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1517-L1670"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L192-L250"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L708-L855"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/scheduler.py#L57-L117"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/scheduler.py#L151-L170"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1224-L1298"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1341-L1367"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L1999-L2047"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L2110-L2160"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/connector.py#L99-L126"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/connector.py#L129-L190"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/scheduler.py#L118-L173"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L61-L92"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L184-L214"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L228-L309"
  - "vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L90-L119"
  - "vllm@568afb3a:vllm/v1/core/kv_cache_utils.py#L91-L120"
  - "vllm@84030bbe:vllm/v1/core/kv_cache_utils.py#L85-L161"
  - "vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L97-L173"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/data.py#L58-L67"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/data.py#L119-L149"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L977-L983"
  - "vllm@0fc695fc:requirements/kv_connectors.txt#L1-L6"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/docs/source/deployment/ssd/ssd-offload.md#L1-L61"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/mooncake-integration/store/store_py.cpp#L2465-L2594"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/mooncake-integration/store/store_py.cpp#L2465-L2500"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/mooncake-store/src/real_client.cpp#L1585-L1645"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/mooncake-store/src/master.cpp#L234-L245"
  - "https://github.com/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/mooncake-store/src/master.cpp#L938-L948"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
  - releases/v0.30.0rc2
evidence: C
relations:
  - to: prefix-caching
    kind: builds-on
    note: 本地 prefix caching 的命中数是池查询的起点，池只补多出来的整段
  - to: block-table
    kind: builds-on
    note: 从池里搬回的段仍要占本地块、由 block table 指向
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 要搬的位置按已算过处理，照常从块池借块
  - to: recompute-cpu-offload
    kind: alternative-to
    note: 换出保存的是某条被抢占请求的状态，只有它恢复时取回；池按内容指纹存前缀段，谁的开头对上谁能取
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样把 KV 放到显存之外，存放位置、共享范围和回填时机不同
contradicts: []
updated: '2026-11-10'
origin: direct
---

## KV Pool 是什么？

**KV Pool（外部 KV 池）是放在显存之外、多台推理实例都能访问的一块存储：实例把算完的整段 KV 存进去，之后开头相同的请求——哪怕落在另一台实例上——把这些段搬回自己的显存，就不用再算一遍。**

先认两个前置词。[KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的历史（普通 attention 是 k、v，混合模型还有线性 attention 的状态），后面每一步都要回头读它。[prefix caching](prefix-caching.md) 在同一个实例的显存里复用相同开头的 KV cache：开头一样的请求直接指向已经算好的块。KV Pool 把这种复用搬到显存之外：池可以由主机内存、SSD 或别的节点的内存拼成。具体放在哪、能不能跨机器、重启后还在不在，取决于选用的存储后端和部署方式，不由「KV Pool」这个名字决定。

实例和池之间隔着一个 **KV connector**：vLLM 留给外部存储的插口。调度时它回答「池里还能多提供几个位置」，执行时它把数据搬进搬出。Ascend 上的实现叫 AscendStore，本页主线以它为准；后文另列上游 MooncakeStoreConnector，配置与默认值分别说明。

省下重复计算的代价，是池的存储容量、查询与搬运时间；取回的状态仍要占本地显存，读写端还必须使用兼容的模型和缓存布局。

```wiki-diagram
file: kv-pool-intuition
```

图里有两台实例。请求 A 先到实例 1，开头三段都自己算，算完经 connector 写进池，池按每段的内容指纹登记。请求 B 落在实例 2，开头与 A 相同，可本地显存里一段也没有；connector 去池里问，得知前三段都在，于是把它们搬回实例 2 的显存，B 只算自己不同的尾巴。池里存的是模型算出来的状态，不是文字；搬回来以后，它和本地算出来的 KV 没有区别，同样要占本地显存的块、由 [block table](block-table.md)（每条请求「第几块在显存哪一格」的对照表）指过去。

池按**整段**存取。一段是固定个数的连续位置，段有多长由各缓存组（共用一张块号清单的一批层）的块大小决定；池里的记录则按块登记，一块一条。只有一种缓存的模型里，一段就是一块，本页前半部分的例子都是这种情况；两者不一样时怎么办，下文「一次查询怎样算」细讲。

## 为什么需要：prefix caching 只认本机显存

**prefix caching 只能复用本实例显存里还留着的块；KV Pool 让算过的开头在一个更大、多台实例共用的地方多留一阵，命中率才上得去。**

两种情况会让 prefix caching 落空。

- **被挤掉。** 显存里的块有限，没人用的块排在空闲队列里，新请求一来就会被拿去重写（会计规则见 [prefix caching 的预算](prefix-caching.md#池子的预算怎么分满了怎么办)）。KV cache 页的示意模型里，一条 4,096 token 的请求就要占 512 MiB（推导见[存一份要多少](kv-cache.md#存一份要多少从一个位置一层往上乘)），同一时刻能留在显存里的开头并不多。
- **落在别处。** 部署里有多台实例时，同一份文档的上一次提问多半落在另一台上；它的块在那台实例的显存里，这台看不见。

池把这两种情况都接住：容量按主机内存或 SSD 算，比显存大得多；各实例按同一套规则给每段起名字，谁存进去的，别的实例都能按名字找到。Ascend 的设计文档给的理由也是这一条：只用片上内存时命中率有上限，把多级存储拼成一个池、让前缀对所有节点可见，命中率才能提高。

**省的仍然是 prefill 的计算。** 从池里搬回来的位置不再进前向；decode 每步只算新 token，池帮不上。

**代价有四条。**

- **搬运要时间。** 默认要等数据搬进显存，这一步的前向才开始算，搬运时间算进这一步。池比显存慢，搬得越多、池离得越远，等得越久；取回划不划算，要拿搬运时间和重算时间比，这笔账没有现成的实测数。
- **写回要时间和容量。** prompt 部分每写满一段就往池里存一份（decode 阶段生成的部分默认不存）。存在后台进行，但动手前要先确认这一步的前向已经把数据写进显存；池的容量由每张卡各贡献一块内存凑成。
- **只认写满的整段。** 开头凑不满一段的请求，连查询都不会发。
- **名字和内容要一致。** 池按名字找数据：模型目录名或拼键格式变了，旧名字就对不上；同名目录换权重、或改并行切分而键仍相同时，命中的旧内容未必兼容。权重版本变化本身不会自动隔离旧数据，各实例算指纹用的种子也必须一致。细节见[池里一条记录叫什么名字](#池里一条记录叫什么名字)。

## 一次查询怎样算：池只补本地缺的整段

**调度器先数本地 prefix caching 命中了几个位置，再问池「从头起你能连续提供到第几个位置」，两数相减才是要从池里搬的量；在问之前，请求长度先向下取整到整段。**

一条请求排队等着开始算时——新来的，或者被[抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)以后退回队列、算过的进度清零的——调度器做三件事：

1. 把 prompt 的长度向下取整到整段；不足一段，不查。
2. 把本地已经命中的位置数一起发过去，池回一个数：从第 0 个位置起，连续命中到第几个位置。
3. 两数相减，得到要搬的位置数；剩下的照常自己算。

设请求 A 的 prompt 有 24 个位置，一段 4 个位置；本地命中前 8 个，池里有前 20 个（都是示意数）：

```calc
title: 请求 A 的一次查询（示意：一段 4 个位置）
可查长度 = floor(24 ÷ 4) × 4 = 24 个位置
本地 prefix caching 命中 = 8 个位置（前 2 段）
池命中 = 20 个位置（前 5 段）
要从池里搬 = 20 − 8 = 12 个位置（第 8–19 个）
还要自己算 = 24 − 20 = 4 个位置（第 20–23 个）
```

```wiki-diagram
file: kv-pool
```

前 8 个位置直接用本地显存里的块；第 8–19 个从池里搬回；第 20–23 个池里没有，照常进前向。下面几条边界情况都从这三步推出来。

- **零头被取整挡在外面。** 设一段 16 个位置：长度 10 的 prompt 取整后是 0，不查；长度 35 的取整到 32，只问前两段，最后 3 个位置不管池里有没有都自己算。写入也只存整段，最后不满一段的尾巴不进池。
- **段有多长是算出来的。** 模型的缓存分成一个或几个缓存组，各组的块大小可以不同。段长取所有组块大小的最小公倍数（带压缩的组，即几个位置压成一条存的，按「块大小 × 压缩比」算），保证每一段的边界对每个组都落在完整的块上；池里的记录仍按各组自己的块一块一条登记，段长只决定查询和写入的长度取整到哪里。混合模型里各组块大小常常差得很远，段长就会很大（GLM 一节会看到 133,120 这样的数），所以段长是模型和部署配置的结果，不是固定值。
- **全中也要留一个位置。** 池如果命中了请求当前的全部位置，就少报一个：最后一个位置必须真算一次，才能得到下一个 token 的输出。例如尚未生成的新请求恰好 20 个位置、池命中 20、本地命中 8，调度上报的外部命中是 19 − 8 = 11 个位置。恢复的请求若已经生成过 token，仅命中全部 prompt 并不等于命中整个请求；源码比较的是包含生成部分的当前总长度。
- **池不比本地多，就不搬。** 池命中数不超过本地命中数时，要搬的是 0，这一次就当池没命中。
- **本地命中是 0 也照样查。** 起点从 0 开始，池命中多少就搬多少。所以 KV Pool 并不要求本地 prefix caching 真的命中过；它要求的是各缓存组都能在段边界上接着算，混合模型在这一点上另有条件，见 GLM 一节。
- **位置数不等于字节数。** 12 个位置是逻辑上的量；真正搬的是各组、各层对应块的有效数据。普通注意力按位置追加 K/V 时，可以用每位置字节数乘段长；KDA 这类递推状态则在边界保留一份定长状态，不能照此乘。总量须逐组相加，还要区分调度上报的位置数、按整块读取的长度和物理页填充，见 [KV 规格](kv-cache-spec.md)。

## 查到以后：分配、搬运、使用、写回

**「池里有」只是一个计划：本地要先借到块，数据要真的搬进这些块，模型才能读；这一步算完，新写满的段再存回池里。**

这条链横跨[主线第 2 站的调度与分配](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)和[模型执行](npu-model-runner.md)：调度侧决定复用哪段，worker 侧才实际读写状态。下图沿固定镜像的非逐层同步路径，展示池有额外命中且本地分配成功时的过程。

```wiki-diagram
file: kv-pool-flow
```

1. **查询。** 默认的非逐层模式下，调度器不自己查池。每个 DP 组（一套独立跑请求的实例，见 [data parallel](data-parallel.md)）里第一个 worker 进程起一个后台线程专门代查；调度器经本机的进程间通信把「这条请求各段的指纹 + 本地命中数」发过去，后台线程拼出每段的名字，整批问存储后端「在不在」，回一个数。
2. **分配。** 调度器把要搬的位置当作「已经算过」处理，照常给请求借本地块（借块规则见 [KV 块分配](vllm-kv-block-allocation.md)），并记下哪几段要从池里取。
3. **搬运。** 执行侧把本地目标块的显存地址交给存储后端。启动时每张卡已登记 KV cache 的显存区间，存取接口接收一串「地址 + 长度」；某一层某一块的地址 = 这一层缓存的起始地址 + 块号 × 每块跨度。接口传地址不代表整个后端都没有中转缓冲，SSD、主机内存等路径仍有自己的搬运过程。设计文档说，不把存储挂在 [LMCache](lmcache.md)（另一套接在 KV connector 上的外部缓存）后面经它中转，是为了使用贴合昇腾硬件的传输方式。默认同步路径要等加载返回，这一步的前向才能继续。
4. **使用。** 搬完的位置和本地算出来的没有区别，block table 指向它们，attention 照常读。
5. **写回。** 这一步的前向把新位置写进显存以后，要存的段交给后台发送线程。默认只存 prompt 部分，包括 chunked prefill（把长 prompt 分几步算）每一步新写满的段；decode 阶段新写满的段要另开开关才存。线程动手前先等一个 NPU 事件，确认前向真的写完了，再往池里写；这一步结束前，还要等发送队列排空（main 上改成了下一步开头再等，见版本差异）。

**搬失败怎么办。** 固定 GLM 镜像的同步加载路径只在单个缓存组时，把失败块标成无效并报给调度器；这时 vLLM 默认让请求报错结束，显式改成重算才走重算策略。多个缓存组加载失败时，该路径只记录错误并跳过无效块回退，不能保证会按默认策略结束。混合注意力模型还被平台禁止使用重算失败策略。所以命中只是计划，不保证数据一定到得了。

**逐层模式。** 另一种做法是按层搬：正常路径在每层前向前等待这一层加载，算完一层就存一层，让搬运和计算重叠。这时查询改由调度器直接问存储后端，并且从第 0 块问起；即使本地已经命中，只要池里有，也会强制按层加载一遍，因为某一层的数据不一定在显存里。**固定旧镜像只等 10 秒，超时记日志后就返回，不能保证数据已到齐**；后续版本改为循环等待并检查后台错误，具体见版本表。层之间怎样重叠、缓冲区怎样复用及旧版超时风险，见[逐层缓存传输](kv-cache-layerwise-offload.md)。

固定镜像的 KV Pool 文档把逐层存取限定在 prefill 节点，并要求 memcache 后端；这是该镜像的限制。后续 main 增加的 Mooncake 逐层路径须按其自身条件判断。


**PD 分离时，池默认只服务 P。** [PD 分离](pd-disaggregation.md)把 prefill 和 decode 交给两组实例（P 和 D），P 算完的历史由点对点的连接器直接交给 D。池只在 P 这一侧起作用：D 默认既不从池里读、也不往池里写，要 D 参与得显式打开对应开关（官方文档说 MLA 模型支持让 D 把 KV 存进池、留给 P 取用）。

## 池里一条记录叫什么名字

**一条记录对应一个缓存组里的一块，名字 = 模型名 + 这张卡在各并行维度里的编号 + 缓存组 + 状态种类 + 这一块的内容指纹。前面几项区分数据属于哪一组、哪一份，但并没有完整验证权重与布局的身份；部署者仍须保证读写端兼容。**

**内容指纹**沿用 prefix caching 的块指纹：由这一块的 token 和前一块的指纹一起算出来，所以同一段文字接在不同的开头后面，指纹不同，只有从第 0 个位置起相同的前缀才可能匹配。第一块的「前一块」由种子生成。固定 GLM 的上游基线及 v0.26 在没有显式设置种子时，各进程取随机值，不能靠默认值保证跨实例命中；它们连接同一个池时须显式使用一致种子。rc2/main 的 SHA-256 系列已使用确定的缺省种子，另一类 xxhash 算法仍默认随机，详见[版本差异](#版本差异)。

种子一致只是指纹对齐的一项条件。算法、序列化方式、token 前缀和缓存隔离标识也要一致；模型与缓存布局的兼容性仍由下面这些规则检查，不能把一个相同种子当成完整的数据身份。

名字里的其余几项带来这些后果：

- **模型只认目录名，TP 只认编号：两处都可能出现「名字对上、内容不对」。** 名字里的「模型名」只取模型路径的最后一级目录名，不是完整路径，也不含权重版本；块指纹里同样没有模型信息。所以目录名变了，旧名字就对不上；目录名没变而权重换了（新 checkpoint 放进同名目录，或者两个不同路径的模型末级目录同名），仍可能取回另一份权重算出的 KV。键匹配本身不会识别这种错误，不能等报错才换池或清空。并行编号也是这样：每张卡在名字里记的是「我存的是第几份」。KV 头比卡少时，几张卡存同一个头，编号取头号（只有一个 KV 头时全取 0，见本节最后一条）；KV 头不少于卡数，或者状态本来就按卡切开（比如线性 attention 的状态），编号取卡号。名字里不记「一共切成几份」。于是 [tensor parallel](tensor-parallel.md)（TP，把一层的矩阵切到几张卡上合算）从 8 改成 4 时：按头号起名且仍对应同一 KV 头的缓存，在权重、布局等其他身份也一致时才可以复用；按卡号起名的，卡 0–3 的名字仍可能撞上旧记录，可每张卡切到的头已经变了（比如原来一卡 1 个头、现在一卡 2 个），内容和大小就不兼容。所以改了切分方式，要按目标版本验证读写格式，否则换池或清空。v0.26 和后续版本另有让 P/D 两端 TP 不同也能对上的拆分做法，见页末版本差异。
- **升级时要同时检查名字和内容格式。** 本页三个旧钉点拼名字的格式不同，旧记录会变得不可见，但并不等于后端已删除它们。还有一种更危险的情况：名字和总字节数都没变，块内排列却变了，此时按新布局解释旧记录就会读错状态。升级必须按目标版本核对读写布局；后文的版本差异列出MLA池格式迁移要求。
- **同一段的不同状态分开存。** 混合模型里，同一段位置既有 attention 的历史，又有线性 attention 的状态，含义完全不同；「缓存组 + 状态种类」把它们分成不同的记录，放在同一个后端里也不会互换。
- **一条记录覆盖这张卡上这一组的所有层。** 非逐层模式下，层号不进名字：存一段时，把这一段在每一层的那一块地址都列进同一条记录，取的时候一起取。
- **各卡内容相同的缓存只存一份。** 只有一个 KV 头的缓存（比如 [MLA](mla.md) 的潜向量）没法按头切，TP 的每张卡存的都是同一份；这时各卡名字里的编号都取 0，一块只有一条记录。在本页 CP=1 的非逐层示例里，候选块轮流分给各卡——8 张卡时第 1 块归卡 0、第 2 块归卡 1……第 9 块又轮回卡 0，再过滤池中已经存在的块。因此实际写入数不保证每卡恰好八分之一。按头切开的状态每张卡都不一样，就用各自的卡号起名，各存各的。

## 和抢占换出、CPU 备份有什么不同

**三者都把 KV 放到显存之外，区别在存的对象、粒度和取回的条件：KV Pool 存的是「按内容识别的前缀块」，谁的开头对上谁就能取；抢占换出存的是「某一条被暂停的请求的状态」，只有这条请求恢复时才取回。**

抢占是块不够时调度器的退路：把一条在跑的请求暂停，收回它的全部块，让给别的请求（见[KV块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)）。请求重新调度时先查可复用缓存，缺失的部分才重算；事先把状态换出到主机内存的路线见[抢占卸载](recompute-cpu-offload.md)。另一条相邻的路是[CPU前缀备份](kv-cache-cpu-offload.md)：把可保存的前缀状态备份到本机主机内存，之后按需回填。三者对照：

| | KV Pool | 抢占换出 | CPU 前缀备份（普通整段路径） |
|---|---|---|---|
| 存什么 | 写满的前缀块，按内容指纹登记 | 被抢占那条请求已经算出的状态 | 完整的前缀段 |
| 存在哪、谁能用 | 共享存储；接同一个池，且完整键、模型、缓存布局与缓存身份满足复用兼容条件的实例 | 本机主机内存；只有这条请求 | 本机主机内存；本实例 |
| 什么时候存 | prompt 每写满一段就存；decode 部分默认不存 | 抢占发生时 | 持续保存完整段 |
| 什么时候取回 | 任何请求的开头指纹对上、本地又没有 | 这条请求被重新调度 | 本实例上的请求前缀命中备份 |

CPU备份在rc2/main还可按严格条件保存部分尾状态，包含状态组、段长、哈希及交接条件，见[页和段](kv-cache-cpu-offload.md#按多大的单位存页和段)；上表的整段示例不覆盖这条新路径。

表里最容易混的是 KV Pool 和换出，关键在「恢复条件」。被抢占的请求退回队列后，算过的进度清零，下一次调度会像新请求一样去池里查；可查询只按 prompt 的长度取整，它已经生成出来的那部分 token 不在查询范围内，何况 decode 阶段写满的段默认也不进池。所以池最多补回它 prompt 里的整段，生成部分仍要重算；换出存的是这条请求当时的全部状态，恢复不需要任何「开头相同」的条件。

同样按内容识别前缀、经 KV connector 接外部存储的，还有 [LMCache](lmcache.md) 和 [UCM](ucm.md)；它们的存储段怎样和设备页对应、PD 数据流怎样走，各见那两页。

共享存储命中的是已保存的数据，未必覆盖模型继续运行所需的全部状态。[SWA 回放案例](swa-bounded-replay.md)说明长历史命中而窗口缺失时还要做什么；是否能由某个 connector 保存这些状态，则仍要核对它自己的格式与能力。

## 上游 MooncakeStore：池跟着推理进程，还是独立持有？

上游 vLLM 也有一个连接 Mooncake Store 的 **`MooncakeStoreConnector`**。它和前文 AscendStore 都通过共享池复用缓存，但不是同一个连接器；昇腾注册名 `MooncakeConnectorStoreV1` 指向的是 AscendStore，不能因名字相近就替换成上游配置。名称与参数的对应见 [Mooncake 连接器](mooncake-connector.md#kv-池里也用-mooncake按名字存取不和某个对端配对)。

上游 Store 的 `mode` 先决定**谁贡献主机内存、谁持有池数据**。master 管对象元数据与协调，不因启动了一个 master 就自动获得一块够用的缓存池。

| 上游 Store 模式 | 池内存由谁贡献 | vLLM 的 `global_segment_size` | vLLM 的私有操作缓冲 |
| --- | --- | --- | --- |
| `embedded`，默认 | 各 vLLM worker/rank 在自己进程中贡献 | 每 rank 配一份正容量 | 每 rank 仍需正的 `local_buffer_size` |
| `standalone-store` | 外部 `mooncake_client` 存储进程 | 必须为 0；vLLM 是请求数据的一方 | 仍需 `local_buffer_size`，不能随池贡献一起清零 |

用 4 个 rank 举例，每个 rank 配 8 GiB 池和 1 GiB 私有缓冲，先把两笔容量分开相加；换成独立池后，池容量的账转移到外部存储进程。

```calc
title: 4 个 rank 的主机容量怎么加（示意配置，非进程内存实测）
embedded：每 rank 贡献 8 GiB 池 + 1 GiB 私有缓冲
池容量 = 4 × 8 = 32 GiB
vLLM 私有缓冲 = 4 × 1 = 4 GiB
这两项合计 = 36 GiB，另计元数据、传输与其他运行开销
standalone-store：vLLM 贡献 0，私有缓冲仍为 4 GiB
外部存储进程的池、SSD 暂存区和其他缓冲另算；0 不表示整机不占主机内存
```

独立持有的好处是推理进程退出时，不必连带释放由外部存储进程持有的那段内存；代价是多维护一套存储服务、容量与网络。它仍是会淘汰数据的缓存，存储进程是否存活、对象是否被淘汰以及后端的恢复协议，都决定旧数据能否取回；“独立”本身不承诺持久保存。

### 开了 SSD，为何仍会碰到主机缓冲不够？

SSD 把容量扩到磁盘，读取时仍要经过存储端的暂存区。它与 vLLM rank 的私有 `local_buffer_size` 是两笔资源。上游指南的独立池 SSD 路径要求三处配合：

| 配置所在位置 | 要打开或准备什么 | 它承担的工作 |
| --- | --- | --- |
| Mooncake master | `--enable_offload=true` | 协调卸载与磁盘副本 |
| 外部 owner client，即持有存储的进程 | 卸载开关与 `MOONCAKE_OFFLOAD_FILE_STORAGE_PATH` 等存储配置 | 实际持有主机池、读写 SSD 并管理暂存区 |
| vLLM 的 Mooncake JSON | `"enable_offload": true` | 按存储端暂存预算，把大批读取分成若干批 |

在本页核对的四个上游版本中，vLLM 的这个开关选择 **1,280 MiB 的暂存预算值**，供读取分批使用；它没有在 `store.setup(...)` 中传入 SSD 启用参数，不能单独让 master 或外部 owner 开始落盘。实际磁盘路径、暂存区分配和后端能力仍由所安装的 Mooncake 版本及存储进程负责。

分批不是把每个对象任意切碎。固定 `0fc695fc` 先按每个 key 对应数据的对齐与额外空间估算暂存用量，再按可用比例装成批；**如果一个 key 本身已经超过完整暂存预算，本轮加载会被拒绝并登记失败块**。调大推理端私有缓冲不能自动解决存储端这一限制。部署应同时看池容量、私有缓冲、owner 暂存和设备 KV，不能只把 SSD 容量写进资源表。

Mooncake 自己的新 SDK 文档还使用“嵌入 Real Client”和“独立 Real Client + DummyClient”这组名称。它们描述 SDK 客户端如何运行，不能与上表 `mode` 一一换名：固定上游 vLLM 的 `standalone-store` 仍调用普通 `setup`，只是池贡献为 0；SDK 的 DummyClient 则有单独的 `setup_dummy`。Mooncake `4da33e5b` 快照用于解释这层区别，不代表旧 vLLM 部署锁定安装了该提交。

昇腾也有自己的 SSD 调用方式：rc2 的 AscendStore 后端检查已安装 SDK 是否接受 `enable_ssd_offload`，将 SSD 参数交给贡献池内存的 worker，并按全局 rank 建子目录；调度器客户端不贡献池内存，也不注册 SSD。根目录必须是绝对路径，协议按该后端要求使用 `ascend`。这条 NPU 路径不能从上游 `enable_offload` 的预算分支反推，后续部署条件另见下方配置表。

## 放到 GLM 双机：这套部署没有开 KV Pool

**[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的启动参数里没有 KV 传输配置，prefix caching 也关着（GLM 是混合模型，vLLM 默认判它不支持，见 [prefix caching 在 GLM 双机上开着吗](prefix-caching.md#glm-双机上它开着吗)），所以 KV Pool 没开。本节照镜像源码推演「假如打开」会怎样：没有实跑，也没有吞吐、时延、命中率的实测数；出现的字节数都是部署页的块字节，不是 KV Pool 的效果。**

### 只加 KV Pool、不开 prefix caching：短于最长长度的 prompt 不会查询

GLM 在每张卡上有 5 个缓存组：full 组（稀疏 MLA 的潜向量和 indexer 缓存，块长 640；indexer 是稀疏 MLA 里给历史位置打分、挑出要细读哪些位置的小模块，见 [sparse attention](sparse-attention.md)）、尾状态组（块长 4）和 3 个 KDA 组，分组见 [KV cache 规格](kv-cache-spec.md#对齐成两档页编成五个组)。KDA 是 GLM 用的线性 attention，每层只存一份固定大小的递推状态（见 [linear attention](linear-attention.md)）。打开 AscendStore 时，镜像会把 KDA 的缓存模式从「不留档」自动改成按块对齐（align）；可 KDA 组的块长只有在 prefix caching 也开着时才落到 640，否则仍盖住整条最长长度 133,120。把各组块长代进上面的段长规则：

```calc
title: GLM 上的段长（照镜像源码推演，不是部署状态）
只加 KV Pool 的段长 = lcm(640, 4, 133,120) = 133,120 个位置
再开 prefix caching 的段长 = lcm(640, 4, 640) = 640 个位置
R1 的可查长度 = floor(4 ÷ 640) × 640 = 0
```

按这条推演，只加 KV Pool 时段长等于最长长度 133,120：任何短于它的 prompt 取整后都是 0，查询在第一步就被挡掉，写入也凑不满一段，池形同虚设。要让池起作用，必须再显式打开 prefix caching，段长才落到 640。即便如此，[R1](one-request.md#示例请求-r1-与官方双机部署)（教学设定，prompt 为 4 个 token 的示例请求）凑不满一段，照样不查；只有 prompt 不短于 640 个 token 的请求才会发出查询，而且开头相同的部分要达到 640 个 token 以上，才取得回整段。这和 prefix caching 在 GLM 上「共享开头不足 640 就没用」同源：KDA 只在 640 的边界上留状态，从两个边界之间接不上。

另外两处配合：接上 KV connector 以后，GLM 补丁把识别前缀用的指纹粒度改成各组块长的最大公约数（4 个位置），这只决定指纹切多细，不改段长；AscendStore 声明支持混合缓存管理器，vLLM 不会因为接了它就关掉混合缓存管理，而 GLM 离不开后者。

### 8 张卡存什么：潜向量存一份，KDA 状态各存各的

```wiki-diagram
file: kv-pool-glm-cards
```

一个 DP 组的 8 张卡按 TP8 合切每一层，套用[上文的起名规则](#池里一条记录叫什么名字)：full 组里的 MLA 潜向量和 indexer 缓存 8 卡相同，编号都取 0，一块只存一份。按部署页的块字节，一块（640 个 token）在 full 组里的数据每卡是 8,355,840 B（推导见[占住一个块号要用多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)），池里存一份，而不是 8 份。KDA 的 64 个头按卡切开、每卡 8 个头，状态各不相同，每个 KDA 组每块存 8 条，编号取卡号。尾状态组的编号同样取 0。

两台机器各是一个 DP 组，而名字里没有 DP 编号。在这个部署中，机器 1 上开头相同的请求要复用机器 0 存进去的块，还须满足完整键、模型、缓存布局与缓存身份的兼容条件；接同一个池本身不足以保证复用。这正是 prefix caching 做不到的跨实例复用。

**抢占时能省多少。** 这套部署块不够时会抢占，被抢占的请求全部重算（场景见 [KV 块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)）。假如同时开了 prefix caching 和 KV Pool，按[上文的恢复条件](#和抢占换出cpu-备份有什么不同)，它最多补回 prompt 里整 640 的段；能省多少取决于 prompt 和生成部分各占多长，没有实测数。

## 常见误解

- **「开了 KV Pool，就用不着 prefix caching。」** 池接在本地命中之后，只补多出来的段；本地命中为 0 时也照样查，所以它不要求本地真的命中过。但按 GLM 固定镜像推演，不开 prefix caching 时 KDA 组的块长盖住整条最长长度，段长变成 133,120；短于这个长度的 prompt 不会发出查询。
- **「池里查到了，就一定用得上。」** 查到只是计划：本地要借到块，数据要真的搬到。固定同步路径对单组上报失败后才进入默认报错或显式重算策略；多组仅记错误并跳过该回退，混合模型也不支持重算失败策略。
- **「池命中 12 个位置，就搬 12 个位置那么多字节。」** 位置数是逻辑量；真正搬的是这几块在每一层、每一种缓存里的数据，字节数由缓存布局决定；各卡相同的缓存池里只存一份，见[起名规则](#池里一条记录叫什么名字)。
- **「KV Pool 就是把被抢占的请求换出去。」** 池按内容指纹存前缀块，谁的开头对上谁能取；换出存的是某条请求当时的状态，只有它恢复时取回，区别见[对照表](#和抢占换出cpu-备份有什么不同)。
- **「接到同一个池，所有实例就能互相复用。」** 模型目录名、拼键格式或指纹种子不同，会影响旧数据命中；同名目录换权重、换布局，反而可能命中不兼容的旧数据。不能把升级等同于自动失效，见[起名规则](#池里一条记录叫什么名字)。
- **「查询端口要挑一个没被占用的网络端口。」** 配置里的查询端口号只是拼进本机进程间通信路径的一段编号（路径里还带 DP 编号），不是 TCP 端口；只要同一台机器上的几个实例彼此不重复即可。
- **「混合模型用不了 KV Pool。」** 三个对照版本都会在接上 AscendStore 时把线性 attention 的状态改成按块对齐存放，让状态也能跟着块存取；但某个混合模型能不能端到端跑通，要单独实跑确认；GLM 还没有实跑，缺什么集中列在页末。

## 对照源码

### 怎么开

KV Pool 经 vLLM 的 `--kv-transfer-config` 打开，连接器名写 `AscendStoreConnector`。官方部署指南里一份同一实例既读又写池的最小配置：

```bash
export PYTHONHASHSEED=0   # 固定旧基线：同池读写节点显式使用一致种子
vllm serve <模型路径> ... --kv-transfer-config '{
  "kv_connector": "AscendStoreConnector", "kv_role": "kv_both",
  "kv_connector_extra_config": {"backend": "mooncake", "lookup_rpc_port": "0"}
}'
```

- `AscendStoreConnector` 挂在 vLLM V1 的 KV connector 接口上，同时实现 `SupportsHMA`。调度侧角色构造 `KVPoolScheduler`，执行侧构造 `KVPoolWorker`；只有 `parallel_config.rank == 0` 且没开逐层的 worker 起 `LookupKeyServer`（ZMQ REP 后台线程）。`KVPoolScheduler` 构造时也会用 `create_scheduler_client` 建一个后端客户端，逐层模式的查询（`_get_store_lookup_hit_tokens`）走它，不经过上面的 IPC。
- `backend`：`mooncake`（默认）、`memcache`、`yuanrong`，按名字从注册表加载。
- `lookup_rpc_port`：拼进 `ipc://$VLLM_RPC_BASE_PATH/lookup_rpc_port_<n>_dp_rank<r>`；旧名 `mooncake_rpc_port` 仍认，但会告警。
- `global_segment_size`：每张卡注册给池的内存，要按 1GB 对齐；环境变量 `MOONCAKE_GLOBAL_SEGMENT_SIZE` 优先于它。
- 角色开关：`kv_role == "kv_consumer"` 且没开 `consumer_is_to_load` 时，`get_num_new_matched_tokens` 第一行就返回 0；`consumer_is_to_put` 管 D 写不写池；`load_async` 管异步加载。三者默认都是 false。
- `discard_partial_chunks` 默认 true：查询与写入的长度向下取整到 `cache_transfer_granularity`。粒度 = lcm(各组块大小 × PCP × DCP，本 rank 各组的块大小 × cache family 压缩比)。
- `VLLM_PREFIX_CACHE_RETENTION_INTERVAL`（vLLM 环境变量，默认不设）：设了以后，非逐层模式下 prompt 短于两倍间隔的请求不查。
- `kv_load_failure_policy`：`kv-transfer-config` 顶层字段，`fail`（默认）或 `recompute`；套在 `MultiConnector` 里时写在顶层。
- 混合模型：`patch_mamba_config` 里 `_using_kv_store` 判断连接器是不是 `AscendStoreConnector`（或 `MultiConnector` 里套着它）。是、且没关混合缓存管理器、投机方法不是 `extract_hidden_states` 时，`mamba_cache_mode` 从 `none` 改成 `align`；开了 prefix caching 且为 `align` 时 `mamba_block_size = block_size`，否则等于 `max_model_len`。
- `save_decode_cache`：decode 阶段新写满的段是否也存进池，默认 false；prompt 部分（含 chunked prefill 的各步）总是存。
- 分组起名：每组一条 `KeyMetadata`，模型名取 `model_config.model.rstrip("/").split("/")[-1]`（路径最后一级目录名）；`group_uses_align_state` 为真的组（`MambaSpec` 且 align）用 `tp_rank`，其余组用 `head_or_tp_rank`。一般情况下 KV 头数 < TP 时 `put_step = tp_size // num_kv_head`、`head_or_tp_rank = tp_rank // put_step` 是头号，否则 `put_step = 1`、`head_or_tp_rank = tp_rank` 是卡号；名字里没有 TP 大小。MLA 下 `num_kv_head = 1`，于是 `put_step = tp_size`、`head_or_tp_rank = 0`；非逐层写入时这些组按 `candidate_index % put_step == tp_rank % put_step` 分摊。
- GLM：要让池有用，还得加 `--enable-prefix-caching`。GLM 补丁在 prefix caching 或 connector 打开时返回 `hash_block_size`（没显式给就取各组块长的 gcd）。

**后续快照 921ccc52 的部署边界。** [完整官方部署指南](https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md)按后端给出环境、存储服务和推理服务三部分，下面列出容易遗漏的连接条件；固定 GLM 的旧镜像仍按上文配置。

| 操作 | 必须同时确认的条件 |
|---|---|
| D 写回生成阶段缓存 | save_decode_cache 写完整块，不释放仍在运行的请求的设备 KV；首次写入先补缺失的祖先前缀，后续从成功偏移继续，失败范围在下一个完整块重试。该路径为非逐层；P 使用 PP 时还须声明分层分区 |
| 启用 SSD | worker 在 ssd_offload_path 下按 global rank 建目录，scheduler 不使用 SSD；独立服务的 global rank 可重叠，须使用不同根目录。A3 fabric 的 SSD 预分配缓冲按 1 GiB 对齐，chunked prefill 不会缩小这笔预分配，应按每 rank 预算 |
| 同机多服务 | lookup_rpc_port 只区分本地 IPC，单服务内会加 DP 索引；独立服务仍需不同值。它不能解决 Mooncake V1 握手或 V2 控制 TCP 端口区间重叠，DP 索引不同也不保证这些区间不冲突 |
| Memcache 独立部署 | 这是存储进程与推理进程分离，不是 P/D 分离；先启动贡献 DRAM 的独立池，推理进程的贡献设为 0。force_new_disk=true 会每次清盘，须使用可清理的专用缓存设备；该版本不提供故障恢复保证，不能由关闭清盘推断旧缓存可安全恢复 |
| Yuanrong 逐层与远端 H2D | 两处 use_layerwise 配置须一致；HCCS 客户端还需设置 DS_RH2D_LINK_TYPE，只开 enable_remote_h2d 不足以建立正确通路 |

多后端开关不能取消模型限制：该快照的加载失败回退 recompute 仍不支持混合注意力模型，不能当成 GLM 缓存恢复的保证。

**上游 MooncakeStore 的入口另外配置。** `--kv-transfer-config` 里选择 `MooncakeStoreConnector`，例如单实例读写池用 `kv_role="kv_both"`；`MOONCAKE_CONFIG_PATH` 指向该连接器读取的 JSON。下面只展示独立池的资源字段，不是一份完整网络部署文件：

```json
{
  "mode": "standalone-store",
  "global_segment_size": 0,
  "local_buffer_size": 1073741824,
  "enable_offload": true
}
```

还须在同一 JSON 中按实际环境填写 master、metadata、协议和设备配置，并启动相应存储端。上游的 `MOONCAKE_PREFERRED_SEGMENT` 指定 owner 的 `host:port`，不是 AscendStore JSON 中的布尔 `preferred_segment`。四个固定上游版本均由各自的配置类读取 JSON；不能用新 SDK 通用配置教程代替这层入口。

上游 `load_async` 默认 true，实际传输路径断言它为 true；旧版在 `get_finished` 检查，新版在 `start_load_kv` 检查，不能把 false 当成已支持的同步部署选项。它也不同于前文 AscendStore 默认 false 的加载设置。角色表描述用途，仍需看消费者：固定 `0fc695fc` 的写回会检查角色，但加载查询并没有“producer 就提前返回”的分支，不能简化成生产者绝不读池。

### 会报什么错

- `ValueError: Unsupported KV pool backend: <name>`：`backend` 写错，启动即报，不会静默退回默认值。
- `AssertionError: mamba_cache_mode only support 'align' when kv_transfer enabled now!`：混合模型上手动把 `mamba_cache_mode` 设成 align 以外的值。
- `ValueError: Invalid hash_block_size=...`：GLM 上显式给的 hash block size 除不尽某个缓存组的块长。
- 固定旧基线没设 `PYTHONHASHSEED`：初始化的根指纹使用随机字节，独立实例无法稳定复用；使用 CBOR 哈希函数时还会打印不可复现的警告。这不是启动错误。rc2/main 只对缺省随机的 xxhash 系列发出对应警告，SHA-256 系列的默认值已确定，不能把旧版报错判断照搬过去；也不能由没有警告推断模型与缓存身份兼容。
- 搬运失败：固定镜像的同步加载分支只为单缓存组请求登记无效块，经 `get_block_ids_with_load_errors` 上报；采用默认 `fail` 策略时，请求以错误结束。多缓存组若出现失败块，会记录错误并跳过无效块回退；文档也明确表示，混合注意力模型尚不支持加载失败后重算。
- 旧逐层路径打印 `Layerwise ... load wait timed out`：v0.23 和固定 GLM 镜像中是等 10 秒未完成后继续返回，不能据此认为该层已加载成功；v0.26 起的 `load not done, keep waiting` 路径会继续等并检查后台异常，两种日志对应的控制流不同。
- main 上：`qos_priority` 必须是 0–4 的整数，否则启动时 `ValueError`；mooncake 逐层路径在 PP、PCP、DCP 任一 > 1 时 `ValueError`（只支持纯 TP），遇到带递推 Mamba 状态的混合模型也 `ValueError`（GLM 的 KDA 属于这一类），P/D 两端 TP 不一致同样 `ValueError`；非逐层时，混合缓存布局遇到两端 TP 不一致抛 `NotImplementedError`（strided I/O 只假设一个稠密的 KV 组）。

### 开销和什么时候别开

- **短前缀没有查询。** 前缀凑不满一段就不查；GLM 上段长是 640（同时开 prefix caching）或 133,120（不开）。
- **读默认同步。** `load_async` 不开时，`start_load_kv` 里直接 `m_store.get(...)`，耗时算进这一步前向。
- **写在后台、有栅栏。** `wait_for_save` 录一个 `torch.npu.Event`，把请求放进发送线程；线程 `put` 之前先 `current_event.synchronize()`。v0.23、db701c1f、v0.26 在本步末尾 `request_queue.join()` 等队列排空；main 挪到下一步开头（见版本差异）。
- **查询本身。** 非逐层模式下，实际发出查询时有一次本机 IPC 往返，再由后台线程批量查询存储后端；不足一段等提前返回的请求不走这笔往返，逐层模式走调度侧客户端。
- **容量。** `global_segment_size` 是每卡贡献一份的配置，1GB 是文档示例值，不能保证任意模型都够用。按池中保留的不同记录逐项累加有效字节：普通 K/V 可按位置乘长度，压缩缓存按压缩后条目计算，递推状态按留档块数乘每份状态大小；TP 共享同一键的记录只计一次。再给后端元数据、读写缓冲和淘汰过程留空间。并发数也不等于不同前缀数，同一前缀可共享；SSD 缓冲则按 rank 另算，不能混进这个乘法。
- **混合模型的连带成本。** 接上 AscendStore 会强制 align，线性 attention 的状态从一份变成按块留档；GLM 上还得同时开 prefix caching，那一侧的代价见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。
- **什么时候别开。** 请求之间很少共享长前缀；只有一个实例且显存留得住热点前缀，本地 prefix caching 已经够用；池的带宽和时延让搬运比重算还慢。

### 版本差异

块指纹的根种子由上游 vLLM 决定，先与存储后端版本分开核对：

| 种子条件 | v0.23 / 固定 GLM（0fc695fc） | v0.26（568afb3a） | rc2（ced6857a） | 固定 main（84030bbe） |
|---|---|---|---|---|
| 显式设置 PYTHONHASHSEED | 用配置值生成根指纹 | 相同 | 相同，优先于默认策略 | 同 rc2 |
| 未设置，sha256 / sha256_cbor | 使用随机根指纹 | 相同 | 以固定字符串 vllm-none-hash 为种子计算 | 同 rc2 |
| 未设置，xxhash / xxhash_cbor | 使用随机根指纹 | 相同 | 仍为每进程随机种子 | 同 rc2 |
| 缺省警告 | CBOR 系列提醒不能跨进程复现 | 相同 | 随机的 xxhash 系列提醒需共享种子或改用 sha256 | 同 rc2 |

新版的确定默认值解决了这一项跨进程对齐条件，未替代模型、权重、布局与 cache_salt 的检查。混合新旧版本、混合算法或显式覆盖了种子的服务仍需确认实际根指纹相同；不能由“都没设置环境变量”推断兼容。

上游 Store 把请求的 `block_hashes` 转成十六进制，再与模型名、rank 和组号拼成存储键。这里要追的是“根指纹 → 块指纹 → 存储键”这条链；Python 对进程内 `PoolKey` 对象做字典散列，是另一件事。

| 上游 Store 条件 | v0.23（0fc695fc） | v0.26（568afb3a） | main 比较点（84030bbe） | rc2 配套（ced6857a） |
| --- | --- | --- | --- | --- |
| `mode` 与容量 | embedded 贡献池；standalone-store 贡献为 0，私有缓冲为正 | 相同 | 相同 | 相同 |
| vLLM `enable_offload` | 选择 1,280 MiB 读取分批预算；不单独启动存储端 SSD | 相同 | 相同 | 相同 |
| 异步加载检查位置 | `get_finished` 断言 true | 同左 | `start_load_kv` 断言 true；仅贡献容量的分支提前返回 | 同 main 比较点 |
| 主要读写接口 | I/O 在 `get_finished` 提交 | 同类路径 | 加载与保存分别由 `start_load_kv`、`wait_for_save` 提交 | 同 main 比较点 |

模型与并行校验另有变化：旧上游 Store 对多个缓存组与 PCP×DCP>1 的组合直接拒绝；rc2 的实际读写模式要求至少一个可做前缀缓存的组，拒绝其中的 CrossAttention 和非 align 的 Mamba，并限制多组与 PCP>1 的组合。仅贡献容量、不查不写的模式另有分支。共享池这一架构不能证明任意混合模型、DCP 或 P/D 配方都兼容，固定 GLM 仍按 AscendStore 的条件推演。这里的上游 main 同样只是固定比较点，不代替 Ascend 镜像的安装清单。

**v0.30.0rc2 的 Mooncake 逐层池已超出旧 main 的“仅纯 TP、不支持递推状态”。** block-key 数据通路支持 TP/PP；PP 专用命名空间包含层分区、TP、模型配置、缓存配置和投机配置的摘要，PP=1 时不加这个前缀。PP 必须让每个阶段拥有各缓存组的层，不支持只有 draft 层的组，仍拒绝 CP 和 P/D TP 不一致。AscendStore 还把 Mamba 状态复制延后到每层加载完成之后，防止读到半加载状态。配置摘要不是权重文件校验，不能由它取消前面的兼容性要求。

**后续官方快照 `921ccc52`：MLA 池对象升级必须隔离旧格式。** 一个逻辑块包含多个物理页、页间有空隙时，新格式只传每个物理页内的有效分量，不复制填充。旧连续区间格式与修正后的分段格式不兼容；后续完整块快路径又从“按分量排列”改成“按物理页排列”。即使记录总字节数相同，也不能混读。所有读写端须一起升级，并清除受影响池对象或启用新的缓存命名空间；请求用 cache_salt 隔离时，共享前缀的请求须一致。只重启 vLLM 不会清除持久池对象。新 bulk 对象也不能交给逐层读取或分量布局不同的实例。这是该后续快照的升级要求，不改写上面的 rc2 与固定 GLM 算例。

**同一后续快照中，租户隔离和 SSD 预取要分别配置。** Mooncake master 没有启用严格多租户模式时，客户端 tenant_id 被忽略，对象仍落在 default 命名空间；开启后，各实例使用的租户都须在配额策略注册。tenant_id 是命名空间与配额身份，不是身份认证，模型、权重和 KV 布局不同仍需分池或分命名空间。SSD offload 负责落盘，enable_ssd_prefetch 才负责在查询存在性时把 SSD 对象预取回 DRAM；后者要求启用 offload 且 Mooncake 提供 ExistOptions，缺少接口时会警告并关闭预取。未显式设置时，冷却与去重时间沿用 Mooncake 的 5 秒和 30 秒。配置预取字段后，Store 使用配置字典形式的 setup，另建 TransferEngine；不能再假定它与 PD 通路共享全局引擎。完整配置见本页 sources 中固定的后续官方部署指南。

下表对照 v0.23 维护分支（`2c59ff10`）、v0.26 分支（`2ed6cbba`）、main（`baa023ad`）和 rc2（`7d825229`）。含 GLM 代码的镜像提交 `db701c1f` 在表中前四项上与 v0.23 维护分支相同。上游 GLM 基线按 `0fc695fc`（v0.23.0）读。

| 项 | v0.23 维护分支 | v0.26 分支 | main | v0.30.0rc2 |
|---|---|---|---|---|
| 普通 PoolKey 名字开头 | `@pcp<n>@dcp<n>@…` | `@pcp:<n>@dcp:<n>@…` | 去掉 pcp，只剩 `@dcp:<n>@…` | 同 main；逐层 PP 另有上文的命名空间 |
| 逐层保存的角色门槛 | consumer 一律不写 | 看 `consumer_is_to_put` | 同 v0.26，抽成 `is_kv_save_role()` | 同 main；通过门槛不等于所有模型/后端组合均获部署支持 |
| Mooncake 逐层 | 没有这条路，逐层 GVA 路径只认 memcache | 同 v0.23 | 新增按块逐层路径：只支持纯 TP，不支持递推状态 | 支持 TP/PP，按上文检查各组；不再统一拒绝递推状态，仍拒绝 CP 与 P/D TP 不一致 |
| 非逐层写回等在哪一步 | 本步 `wait_for_save` 末尾等发送队列排空 | 同 v0.23 | 登记 save batch 后返回，下一步 `handle_preemptions` 等上一整批 | 按即将复用块的已结束/被抢占请求 ID，等待这些请求的待写块；不再每步等整批 |
| 逐层加载等待 | 等 10 秒，超时仅记日志并返回；db701c1f 相同 | 循环等待，每次超时检查后台异常 | 循环等待，完成后再次检查后台与 hybrid 错误，异常清理并重抛 | 同 main 的等待与错误检查原则 |
| 混合模型自动改 align | 有，须满足混合管理器与连接器条件 | 同 v0.23 | 同 v0.23 | 同条件，保留 extract_hidden_states 例外 |
| 文件名 | `config_data.py`、`backend/backend.py` | 同 v0.23 | `metadata.py`、`backend/base.py` | 同 main |
| P/D 两端 TP 不同 | 没有后续子键路径 | 用 `prefill_tp_size` / `decode_tp_size` 声明对端，按头拆子键；MLA 与混合布局除外，KV 头数须不少于较大 TP 且被其整除 | 同 v0.26 | 同样的子键启用条件；逐层路径仍拒绝 TP 不一致 |

名字格式变化会让旧键不再命中，但不会删除后端对象；文件重构也会使旧 import 路径失效。普通注意力满足条件时的跨 TP 取用，不适用于 GLM 的 MLA 加混合布局。写回等待点的移动会改变 profiling 的归属，不能用旧版本的步末耗时直接比较新版本；rc2 也没有取消块复用前必须完成相关写回的约束。

旧指南的逐层参数表要求 memcache；main 的新指南已增加 Mooncake。表中的代码分支与官方验证范围须同时满足，不能只看保存角色返回 true 就推断 D 逐层部署受支持。


### 源码位置

| 看什么 | 文件（db701c1f，另注明的除外） |
|---|---|
| 查询入口：角色、取整、相减、全中留一、强制逐层 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py`，`get_num_new_matched_tokens` L491–L591 |
| 段长、各组块大小、后端选择 | 同文件 L86–L160、L417–L429；写入取整 `_get_last_chunk_tokens_num` L654–L657 |
| 查询 IPC 路径、`LookupKeyServer` | 同文件 L1146–L1161；`ascend_store_connector.py` L293–L339 |
| 角色分派、逐层接口、写回门槛 | `ascend_store_connector.py` L76–L123、L229–L253 |
| 名字格式、cache family | `config_data.py` L26–L77、L126–L143（main 为 `metadata.py` L116–L126） |
| 地址 = 起始地址 + 块号 × 跨度 | `config_data.py` `prepare_value` L359–L387 |
| 卡号取法、每组 `KeyMetadata` | `pool_worker.py` L174–L194、L219–L237 |
| 登记显存、同步读、失败块 | `pool_worker.py` L722–L790、L838–L866 |
| 写回栅栏、写入分摊 | `pool_worker.py` `wait_for_save` L1432–L1450；`kv_transfer.py` L734–L745、L830–L839 |
| 混合模型自动 align、KDA 块长 | `vllm_ascend/patch/platform/patch_mamba_config.py` L26–L41、L205–L226 |
| GLM 指纹粒度 | `vllm_ascend/patch/platform/patch_kv_cache_utils.py` L358–L392 |
| 上游：何时查 connector、失败策略、单组假设、指纹种子、HMA 自动关闭 | vLLM `v1/core/sched/scheduler.py` L609–L620、L2286–L2293；`config/kv_transfer.py` L70–L73；`v1/core/kv_cache_utils.py` L98–L113；`config/vllm.py` L1479–L1500 |

**来源与结论对应：**

- 查询先取整、本地命中与池命中相减、池不多于本地就不搬、全中少报一个、逐层强制加载，对照第 1 项来源。[C1] 角色开关与默认值、段长的构成、后端注册与校验，对照第 2、3、38 项来源。[C2] 写入同样只存整段，对照第 39 项来源。
- 等着开始的请求（新来或被抢占后清零）才去问 connector，对照第 20 项来源。[C20] 请求 A 的 24 / 8 / 20 个位置、一段 4 个位置、长度 10 与 35 配一段 16 个位置，都是教学设定。[A]
- 名字由模型名、各并行编号、组号、状态种类、cache family 和块指纹拼成，不含 TP 大小；模型名取模型路径最后一级目录名，见第 11 项来源（main 同样写法）；编号按 KV 头数取头号或卡号，对照第 4、5、10 项来源。[C4] decode 部分默认不写回，对照第 43 项来源；v0.26 与 main 的跨 TP 子名字，对照第 44、45 项来源。 一条记录列出本组每一层的地址、地址按块号乘跨度，对照第 40 项来源。[C40] 旧上游基线显式设置 PYTHONHASHSEED 时用它生成根指纹、未设置时随机初始化，对照第 23 项来源；官方指南要求各节点一致，对照第 25 项来源。[C23] 新版按算法选择缺省种子的规则见上方版本表及新增来源。
- 每个 DP 组第 0 号 worker 起后台线程代查、IPC 路径带 DP 编号、回 4 字节整数，对照第 6、8、9 项来源。[C9] 登记显存、同步读、失败块上报，对照第 12、13 项来源。[C13] 写回前等 NPU 事件、本步末等队列排空，对照第 14、16 项来源。[C14]
- 失败默认报错结束、可改重算，对照第 21 项来源；官方文档写明混合注意力模型不支持重算，对照第 25 项来源。[C21]
- PD 分离时池默认只服务 P、D 的两个开关、MLA 模型可让 D 写池，对照第 25、27 项来源；每卡贡献的内存量与 1GB 对齐，对照第 26 项来源；设计文档的动机、「只取多出来的块」和不走 LMCache 中转的理由，对照第 28、29 项来源。[C29]
- 只有一个 KV 头时卡号取 0、按块轮流分摊写入，按头切开的组用各自卡号，对照第 10、11、15 项来源。
- 接 AscendStore 自动改 align、KDA 块长取决于 prefix caching，对照第 17、18 项来源。[C18] GLM 的指纹粒度，对照第 19 项来源。[C19] AscendStore 实现 SupportsHMA、vLLM 不会因此关掉混合缓存管理，对照第 6、24 项来源。[C24]
- GLM 上段长 133,120 / 640 与 R1 可查长度为 0，是把源码规则代入部署页的块长推出来的。[D] 部署没开 KV connector 和 prefix caching，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)；每卡 8,355,840 B 引自[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)；KDA 每卡 8 个头引自主线底稿的 KDA 一节。[D]
- 被抢占请求查池最多补回 prompt 的整段，是由查询只取 prompt 长度推出的。[I] 版本表各项对照第 30–37、41、42 项来源。
- vLLM 处理无效块的函数只按一个缓存组取块号，对照第 22 项来源；Ascend 固定同步路径对多组跳过失败块上报见第 13、48 项，平台禁止混合模型的 recompute 策略见第 58 项。
- rc2 的普通键与 TP 子键、保存角色、按释放请求等待和 align 条件见第 59–64 项；PP 命名空间与组校验见扩展后的第 51 项。v0.26 仍在本步等待的完整实现见第 65 项。
- 逐层加载的等待和超时差异见第 66–70 项；等待函数返回与成功加载不能在旧版画等号。
- 上游 MooncakeStore 两种 mode、每 rank 资源与普通 setup 调用见 71–76；4 rank × 8 GiB / 1 GiB 是教学设定，不是实测。三处 SSD 配置与 vLLM 的预算分支见 77–81，按 key 分批和单 key 超预算失败见 82–83。异步检查的实际执行位置与角色查询见 84–89，旧版与 rc2 模型/并行校验见 90–92；这些不是前文 AscendStore 的默认行为。
- Ascend rc2 的 SDK 参数检查、NPU/协议条件、贡献内存与每 rank SSD 目录见 93–95；根种子的四版变化见 96–99，上游 Store 从块指纹拼键见 100–102。Mooncake 依赖只限定最低版本见 103；后续 SDK 的 Real Client / DummyClient、文件存储与 master 启用条件见 104–109，不将该快照当成旧 vLLM 的安装锁定。

**实测边界：**

- 在 GLM 双机上实际打开 prefix caching + AscendStore 的启动日志与一次命中的请求日志，确认段长 640、KDA 为 align、池里名字与编号取法如本页推演；以及只加 KV Pool、不开 prefix caching 时段长为 133,120、短于该长度的 prompt 不发出查询。
- GLM 的加载失败后重算已被平台禁止，不再列作可选方案。固定同步分支对多组只记错、不上报失败块，默认 fail 也不能据此保证终止请求；具体失败后的输出与资源回收仍缺设备故障注入记录。
- GLM 上 KDA 组每块实际存进池多少字节、被抢占或新请求取回时要取几块状态；full 组的 MLA 与 indexer 缓存被登记成几段地址、一条记录多少字节。
- 吞吐、TTFT、命中率、池带宽：没有任何 GLM 或 A2 上的实测数；搬运比重算快多少无从判断。
- main 上 GLM 模型代码搬到 models/glm5next/ 以后，patch_mamba_config 与 GLM 指纹粒度补丁的行为是否不变，没有在 main 镜像上实跑。

