---
id: mooncake-connector
title: Mooncake 连接器：先对好块号，再按层搬历史状态
type: feature
summary: >-
  vLLM 的 KV connector 在昇腾上的 Mooncake 实现：调度器那一半记账（远端能补几个位置、押哪些块），worker
  那一半把块号换成显存地址，用 Mooncake 传输引擎在 P、D 之间直接读写；V1 整批拉，Layerwise 逐层推。官方双机没有开。
aliases:
  - Mooncake 连接器
  - Mooncake Connector
  - KV Connector
  - KV 连接器
  - MooncakeConnector
  - MooncakeLayerwiseConnector
  - MooncakeHybridConnector
  - MooncakeConnectorV2
  - MooncakePullConnector
  - MooncakeD2RHConnectorV1
  - D2RH
  - KVConnectorBase_V1
  - KVConnectorRole
  - kv_transfer_config
  - kv_connector_extra_config
  - Mooncake TransferEngine
  - 逐层推 KV
chapters:
  - '18'
order: 20
sources:
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L124-L130'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L251-L375'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L453-L562'
  - 'vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L115'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L119-L130'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_transfer_state.py#L65-L87'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1888-L1910'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2221-L2250'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L576-L587'
  - 'vllm@0fc695fc:vllm/v1/worker/kv_connector_model_runner_mixin.py#L85-L105'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/attention/kv_transfer_utils.py#L45-L58
  - 'vllm@0fc695fc:vllm/envs.py#L1684-L1686'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L55'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1506-L1590
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1784-L1879
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2332-L2471
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L96-L146
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L774-L962
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2052-L2084
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L166-L242
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3374-L3470
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1150
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L11-L43
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L55-L61
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L428-L445
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L928-L990
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1100-L1124
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L476-L528
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1690-L1840
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1340-L1432
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L802-L815
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1160-L1170
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1522-L1547
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L210-L237'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L125-L150
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L180-L250
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L428-L460'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L55'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L85-L93'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L60'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L228-L261
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L60-L70
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L15-L55
  - >-
    vllm-ascend@db701c1f:docs/source/tutorials/features/pd_disaggregation_mooncake_single_node.md#L172-L186
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L36-L62
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L185-L200
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1194
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1200-L1206
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1334-L1341
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1715-L1724
  - 'vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L577-L587'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2313-L2324'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1194-L1196
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1325-L1328
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1662-L1666
  - >-
    raw:sha256-8ce4d437165176e09d85b4648b3d2c958a56064f74dc11da7304eeff8c0bcb48.md#L1-L2538
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L247-L260
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L17-L20
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L90-L114
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L42-L90
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L115-L154
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L233-L265
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L65-L95
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L14-L14'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L89'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L131-L135'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2007-L2054'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2710-L2767'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1327-L1345'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1662-L1683'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1723-L1732'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L1-L17'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L166-L202'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1190-L1194'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2111-L2118'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/metadata.py#L87-L122'
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L17-L87"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L17-L93"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L17-L129"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L1-L135"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L277-L329"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L516-L582"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py#L96-L150"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3842-L3883"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3916-L3965"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L166-L188"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1298-L1312"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2009-L2041"
  - "vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L136-L228"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1339-L1352"
  - "vllm@0fc695fc:vllm/model_executor/models/utils.py#L753-L784"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L106-L118"
  - "vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768"
  - "vllm-ascend@db701c1f:vllm_ascend/utils.py#L819-L823"
  - "vllm@0fc695fc:vllm/model_executor/custom_op.py#L47-L66"
  - "vllm@0fc695fc:vllm/model_executor/custom_op.py#L332-L350"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2075-L2085"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2189-L2241"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L293-L475"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L477-L659"
  - "vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L43-L61"
  - "vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L228-L231"
  - "vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L428-L476"
  - "vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L231-L329"
  - "vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L664-L698"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2244-L2245"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2274-L2298"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/utils.py#L14-L15"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L251-L273"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L447-L527"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L777-L787"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1920-L1950"
  - "vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L367-L413"
  - "vllm@0fc695fc:vllm/v1/worker/kv_connector_model_runner_mixin.py#L78-L112"
  - "vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2118-L2128"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2259-L2291"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2471-L2496"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L206-L320"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L113-L168"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L233-L284"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L286-L370"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L388-L419"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L594-L674"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L217-L346"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L453-L534"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L635-L798"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L1224-L1274"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L1362-L1442"
  - "vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L3006-L3033"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L123-L140"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L168-L205"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L155-L214"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L589-L606"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L174-L186"
  - "vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2550-L2574"
  - "vllm@ced6857a:vllm/v1/worker/kv_connector_model_runner_mixin.py#L75-L110"
  - "vllm@ced6857a:vllm/v1/worker/gpu/kv_connector.py#L100-L123"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/utils.py#L54-L90"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/utils.py#L159-L178"
  - "vllm@ced6857a:vllm/config/kv_transfer.py#L103-L106"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1902-L1916"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L3166-L3179"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2929-L2960"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2189-L2215"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L672-L707"
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L135'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2235-L2250'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L880-L899'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1020-L1044'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1410-L1436'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L237-L270'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L40-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L730-L746'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L162'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L241-L312'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L945-L968'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1138-L1162'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1666-L1692'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: 先弄清 P、D 为什么要交接、交接停在提示词的哪个位置；本页只讲交接由谁、怎样搬
  - to: kv-cache
    kind: builds-on
    note: 搬的是各层留下的历史状态；GLM 有哪几类、每类多大在那一页
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 目的块照常从块池借；押着的块要等完成通知才还
  - to: kv-pool
    kind: alternative-to
    note: 同一个连接器插口，池按内容指纹存取、不和某个对端配对
  - to: npu-model-runner
    kind: builds-on
    note: 前向开始前把请求交给后台线程，逐层接口挂在注意力前后
  - to: large-scale-ep
    kind: builds-on
    note: 多个 DP rank 共用一个握手端口基址时，每个 rank 的端口怎样排
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-59cd517fa0e9762eac01116769938c0da8cc0eb60e87fc7698f37102c916de46.md
  - >-
    raw/sha256-8ce4d437165176e09d85b4648b3d2c958a56064f74dc11da7304eeff8c0bcb48.md
---

## Mooncake 连接器是什么？

**Mooncake 连接器是 vLLM 的 KV connector 在昇腾上的一种实现。KV connector 是 vLLM 留给「把 KV cache 搬出本实例，或从别处搬进来」的插口；Mooncake 连接器用它在 P、D 两套实例之间交接历史状态：两端先对好「P 的哪一块对应 D 的哪一块」，再把每一层的内容按块从 P 的显存搬进 D 的显存。** 真正搬字节的是 Mooncake 的传输引擎（TransferEngine）：两边都把存 KV cache 的那段显存登记给它以后，一端只要给出「对方的显存地址、本地的显存地址、长度」，它就把这段字节从对面读过来，或写过去。引擎内部怎样搬按 Mooncake 官方文档为准。

这让 D 接着使用 P 的计算结果，代价是传输与握手时间、交接期间两边同时占用缓存，以及失败时的清理和重试。前向前后的通知把这些等待接入调度循环，后文按主线站点展开。

先认四个前置词，细节各有专页：

- **P、D 与交接。** [PD 分离](pd-disaggregation.md)把一条请求的 prefill 交给 P 实例、decode 交给 D 实例，中间要把 P 算出的历史状态交给 D。为什么值得拆、交接停在提示词的哪个位置，都在那一页；本页只讲交接由谁做、怎样搬。
- **历史状态。** 就是 [KV cache](kv-cache.md) 里每一层为已处理位置留下的东西：普通注意力层存每个位置的 K、V，混合模型还有线性注意力层的递推状态。它按层分开存放。
- **块与块号。** KV cache 切成一块块，每块装固定个数的位置；块号是块在本实例块池里的编号，只在本实例里有意义。
- **代理与握手端口。** 代理（proxy）是 PD 部署最前面的转发服务：先后挑出 P 和 D，把块号、地址这些交接信息在两边之间转交（步骤见 [PD 分离页](pd-disaggregation.md#状态交接怎样一步步完成)）。握手端口是卡上为对地址开的一个小端口（V1 里由 P 这边开，Layerwise 里由 D 开）：真正搬数据之前，对端先连它换一份「地址簿」。

```wiki-diagram
file: mooncake-connector
```

图里的数都是示意：一条请求在 P 上占 7 号、12 号两块，模型只有 3 层。连接器做三件事：

1. **对表。** 两端先确定「P 的 7 号对 D 的 3 号，P 的 12 号对 D 的 5 号」。D 的 3、5 号是它为这条请求预先分好、还空着的目的块。
2. **按层搬。** 一个块号在每一层都对应一段显存，所以「搬一块」其实是把这一块在 3 层里的 3 段字节各搬一次：层 0 进层 0，层 1 进层 1。
3. **完成通知。** 最后一层到齐以后，一端通知另一端：D 这才开始用这些状态往下生成；V1 里 P 也要等到这个通知，才把源块还回自己的块池。

对表和按层搬，昇腾上有两种做法：

- **整批拉（V1，本页基线）。** P 先把提示词的全部层都算完，把源块号和自己的握手地址交出去；D 分好目的块后，一次把所有层读回来。连接器名必须显式配置，V1 不是启动默认值。
- **逐层推（Layerwise）。** 顺序倒过来：D 先分好目的块，把块号和自己的握手地址交给 P；P 每算完一层，就把这一层写进 D。

在本页钉住的 Layerwise 实现中，普通缓存按层登记时，同一层只能映射到一个注意力模块——也就是执行注意力计算的软件组件；重复映射会触发断言。用于额外 token 预测的缓存走另一个登记分支，具体名称匹配规则见页末源码位置。模型具有分层结构，并不足以确定它兼容这套逐层推送实现。

## 为什么需要它：两套块池之间没有共同的块号

**P 和 D 是两套各自启动的实例，块池、块号、显存地址都各管各的；要让 D 直接用上 P 算好的状态，必须有人管账、换地址、发通知，这就是连接器的活。** 没有它，D 只拿得到提示词的 token 编号，只能自己把 prefill 再算一遍，P、D 就白拆了。

这三件事都不属于调度器或模型本来的工作：

- **管账。** D 要在数据到来之前就分好目的块，并让这条请求先挂着、不算；P 上的源块在对面读完之前不能还回块池，否则下一条请求会把它改写，D 读到的就是别人的内容。

- **换地址。** 块号 7 只是个编号。要读写字节，得知道 P 上每一层的这份缓存从哪个地址开始、一块占多少字节、相邻两块隔多远，再把块号换算成地址。
- **发通知。** 搬完了、或者搬失败了，两边的调度器都要知道：D 才能把请求放回队列，P 才能放块。

代价也跟着来（PD 分离整体的代价见[那一页](pd-disaggregation.md#为什么要拆拆开要付什么)）：

- **两边都押块。** 交接期间，同一份状态在 P、D 上各占一份块。
- **启动时要登记显存、起后台线程。** 每张卡把存 KV cache 的显存区间登记给传输引擎，再起一个收或发的后台线程；答地址簿的那一边还要开一个握手端口。
- **多出失败方式。** 端口配错、对端挂掉、传输超时都可能阻断交接。V1 读取失败后仍会通知 P 清理；若完成或失败通知无法送达，P 的源块才会继续押到超时回收。

同一个插口也用在 [KV Pool](kv-pool.md)（多台实例共用的外部 KV 存储）上，Mooncake 也给那条路提供存储后端；两条路的区别放在后面「KV 池里也用 Mooncake」一节。

## 连接器插在 vLLM 的哪几处？

**vLLM 把连接器的接口分成两半：调度器进程里的那一半只记账，每张卡的 worker 进程里的那一半才碰显存。启动配置里有 KV 传输这一项时，vLLM 在调度器里造一个连接器，在每个 worker 里各造一个；同一个类，按所在进程只启用其中一半。** 调度器是每一步决定排哪些请求、给谁分块的那部分；worker 是每张卡上真正跑模型的进程。

```wiki-diagram
file: mooncake-connector-hooks
```

图按主线的站点从左往右排，标出一步里连接器被叫到的地方。下表把每一处在两种做法里各做什么列出来：

| 位置 | vLLM 在这里问连接器什么 | V1（整批拉） | Layerwise（逐层推） |
|---|---|---|---|
| ① 第 2 站排队时 | 远端能补几个位置 | D：整段提示词都算远端已有（混合模型少算 1 个），并说明要异步加载 | 同左 |
| ② 分完块以后 | 记下这条请求分到的块 | D：记下要收的目的块 | D：把目的块号和握手地址报给代理，代理再交给 P |
| ③④ 发给 worker、前向开始前 | 打包本步清单，交给后台线程 | D：交给接收线程去读；P：把上一步押下的请求登记进超时表 | D：登记要收的请求；P：按 D 的块号备好写入目标 |
| ⑤ 每层注意力前后 | 等本层数据到位、发出本层 | 空操作 | P：本层算完就放进发送队列 |
| ⑥ 步末 | 哪些请求收完、发完 | 两端各报各的 | 只有 D 报收完 |
| ⑦ 第 7 站请求结束 | 块现在放不放 | P：押住源块，交回源块号和握手地址 | P：不押 |

「异步加载」的意思是：D 的调度器这一步给这条请求排 0 个 token，把它挂进「等远端状态」的等待队列，数据由接收线程在后台读，别的请求照常算。读完以后，⑥ 把它报成收完，⑧ 调度器把它放回可调度的状态，下一次排上时才从 P 停下的位置接着算。

连接器不改模型的计算本身。⑤ 那两处是昇腾的注意力后端（MLA、稀疏注意力等）在每层前后顺手调用的；V1 在这里什么都不做，Layerwise 借这里把刚写进缓存的本层内容交给发送线程。

## 块号怎样变成地址：一次读取的算式

**启动时，每张卡把自己每一层的每份缓存登记给传输引擎，并记下三个数：这份缓存的起始地址、一块占多少字节、相邻两块隔多远。两端第一次打交道时互换这张「地址簿」；之后每搬一块，地址都是「起始地址 + 块号 × 块间距」，长度是一块的字节数。**

- **登记只做一次。** 一个进程只有一个传输引擎对象，登记过就不再登记。登记的意思是「这段显存允许对端按地址访问」，不表示里面已经有算好的内容，更不表示对面已经收到。
- **地址簿随握手交给对端。** 除了每层每份缓存的起始地址、块字节数和块间距，还有各缓存组对应哪些层、传输引擎的端口。V1 里是 D 的接收线程第一次遇到某个 P 时，去 P 的握手端口要来这份地址簿并缓存起来；P 那边的发送线程不发数据，只回答这份元数据、记下谁已经收完。
- **块字节数和块间距可以不等。** 一块的字节数按这份缓存张量自己的形状算，块间距是张量里相邻两块的实际距离。几类状态为了共用同样大小的物理页而补齐时，两者就不相等；搬的只是字节数那么长，补齐的部分不搬。

以「P 起始地址 5,000 KiB、D 起始地址 1,000 KiB、块字节数与块间距均为 64 KiB、2 块 × 3 层 × 1 份缓存」的示意设定为例，地址与段数按下式换算（若两边块号都连着，例如 P 的 7、8 对 D 的 3、4，且块间距正好等于块字节数、无需从多张 P 卡拼凑，则两块可并成一段，段数少一半）：

$$\text{addr}(b) = \text{base} + b \times \text{stride}$$

| 一层里的一次读取（示意数） | 算式 | 结果 |
| --- | --- | --- |
| P 的 7 号块地址 | $5{,}000 + 7 \times 64$ | **5,448 KiB** |
| D 的 3 号块地址 | $1{,}000 + 3 \times 64$ | **1,192 KiB** |
| 这一段的长度（连续 1 块） | $64\text{ KiB} \times 1$ | **64 KiB** |
| 这条请求的段数（2 块 × 3 层 × 1 份缓存） | $2 \times 3 \times 1$ | **6 段** |

**一次交接不是一次网络调用。** 这 6 段「源地址、目的地址、长度」凑成一批，交给传输引擎一次提交：V1 由 D 的接收线程发起批量读，Layerwise 由 P 的发送线程逐层发起批量写。真实模型要按各缓存组分别列出其层、每层缓存份数和连续块段，再把段数相加；K、V 分开存时，每层通常就有两份。不能在已经数遍全部层后再一律乘缓存组数，否则会重复计算。两边 TP 不同，或开了上下文、流水线并行时，还要按实际负责这些状态的 P rank 拆分读取任务。

每个进程能登记的显存区间有上限（256 段）。普通 attention 路径合并底层存储区间，减少重复登记；带递推状态的路径则按配置中的原始分配登记，不能把每个逻辑缓存都算成独立区间。固定 GLM 的静态段数见后面的主线示例；超过上限会在启动时报错。

## 两边 TP 不一样大时，谁来拼 KV 头？

**P、D 可以采用不同的 TP。若 D 的一张卡需要的 KV 头分散在几张 P 卡上，V1 让 D 各读一部分、读完在本地重排；Layerwise 让 P 在发出前先交换、重排，写出 D 要的那一份。** [TP](tensor-parallel.md) 可以按注意力头切分；当 TP 超过 KV 头总数时，KV 头还可能在多张卡上复制，因此要比较每卡实际持有的头，不能只比 TP 数字。以 8 个 KV 头、P 用 TP4、D 用 TP2、单块每层 64 KiB 为示意：

$$r_{\text{head}} = \frac{\min(\text{TP}_P,\; H_{\text{kv}})}{\min(\text{TP}_D,\; H_{\text{kv}})} = \frac{4}{2} = 2$$

| 核算项（示意：8 个 KV 头，P 用 TP4，D 用 TP2） | 算式 | 结果 |
| --- | --- | --- |
| P 每卡 KV 头数 | $8 \div 4$ | **2 个** |
| D 每卡 KV 头数 | $8 \div 2$ | **4 个** |
| D 每卡要读的 P 卡数 | $4 \div 2$ | **2 张** |
| 每张 P 卡读的长度（每块每层） | $64\text{ KiB} \div 2$ | **32 KiB** |

下面这张总览图把非对称 TP 的按头拼装规则，与 `v0.30.0 / main` 下 Mooncake 连接器家族的选型及禁配条件画在一起（包含 `GQA + C8` 为何拒绝普通连接器）：

```wiki-diagram
file: mooncake-connector-fig-reshard-and-selector
```

D 的 0 号卡要头 0–3：头 0–1 在 P 的 0 号卡，头 2–3 在 P 的 1 号卡。V1 让它从两张 P 卡各读半块，放进本地这一块的前半和后半，读完再在本地重排成算子要的布局。其余几种情况：

- **MLA。** 本页的潜向量缓存在 TP 组内复制，不按注意力头切，因此不需要为了拼齐 TP 头而多读几张 P 卡（见 [MLA](mla.md)）。这里只说 TP 这一维；若 P 还按上下文位置或流水线阶段拆分，完整请求仍可能要从多个 P rank 读回对应部分，不能概括为“永远只读一张 P 卡”。
- **Layerwise。** 在这里的按头切分路径中，要拼的份数按两端实际持有的 KV 头计算。若只有 8 个 KV 头，P 用 TP16、D 用 TP8，P 多出的设备持有重复头：两端每卡都是 1 个头，要拼的份数是 1，不能用 16÷8 得到 2。需要拼多份时，P 在写出本层前先交换重排，增加相应的流和中转缓冲；量化也可能需要这套缓冲路径，源码条件见后文。
- **递推状态。** 线性注意力的递推状态按头切到各卡时也能这样拆，但要求 P 的 TP 不小于 D 的 TP，并且能被它整除；Hybrid 连接器遇到这类状态更严，要求两边 TP 相同。
- **启动时的统一检查。** 只要配了 KV 传输、模型又不是 MLA，昇腾在启动时就检查 P 的 TP 是不是 D 的整数倍（`prefill_tp_size % decode_tp_size == 0`），不是就报错；同时 `MooncakeConnectorV1` 要求 D 端 `PP=1`。在 `v0.30.0` 及 `main` 中，若在 GQA 模型上同时启用 `C8` KV cache 量化与普通 `MooncakeConnector`，因为 P 端保留 `bf16` KV cache 而 D 端分配 `int8` KV cache，原始按字节拷贝会把 `bf16` 误读为 `int8`，启动检查直接抛 `ValueError`，要求关闭 `C8` 或改用先量化再发送的 `MooncakeLayerwiseConnector`；此外，一旦开启 PD 分离或 KV 池并同时开启 `DCP > 1`，平台层强制要求 `cp_kv_cache_interleave_size == block_size`，保证按块交错对齐。

## 完成通知：块什么时候放，请求什么时候算？

**V1 里 P 上的请求算完就结束，源块却押到 D 报告收完才放；D 上的请求先占好目的块、挂在等待队列里，收完才回到可调度的状态。Layerwise 里 P 不押块，D 要等 P 发来「最后一层写完」才放行请求。押着的块和挂着的请求都不在运行队列里，块池紧张时调度器抢占不到它们。**

V1 的完成通知这样走：

- **P 结束但不放块。** 代理改生成数、P 按「写到长度上限」交棒的全过程在 [PD 分离页](pd-disaggregation.md#状态交接怎样一步步完成)讲过，本页只看块的下落：请求结束时，连接器告诉调度器「块先别放」，把源块号、本机地址、握手端口交回代理；请求移出运行队列，块留在块池外。
- **P 数着谁收完了。** 发送线程知道每条请求会有哪几张 D 卡来读；每收到一张卡的完成信号记一笔，齐了才把请求报成发完，调度器这时才还块。
- **D 读完就报。** 接收线程读完（或者读失败）都给 P 发完成信号，免得 P 一直押着，同时把请求报成收完；失败的块怎么标、请求怎么结束，见 [PD 分离页](pd-disaggregation.md#抢占失败和超时怎么处理)。
- **两道超时。** D 一直不报时 P 押块 480 秒后强制还块（见 [PD 分离页](pd-disaggregation.md#抢占失败和超时怎么处理)）；本页独有的是另一道单次传输的超时，默认约 33 秒，算法见页末。

旧 Layerwise 的 P 在请求结束时就还块。源码中的逐层发送先进入后台队列，发送线程等待本层计算事件后才执行网络写；最后一层的回调通知 D。前向结束虽然调用名为“等待保存”的接口，该实现却为空，完成查询也始终不返回 P 的发送完成名单。因此这条显式链路没有把“最后一次网络写结束”接成 P 延迟还块的条件；设计文档中“全部层推完再放请求”的意图不能代替这个缺失的衔接。这里是源码时序判断，尚未在设备上复现覆盖竞争。D 仍要收到最后一层的完成通知才会放行，不能只到了一两层就 decode。

后续版本给 **Layerwise 与 AscendStore 的指定组合** 增加了按物理槽等待发送完成的保护，详见[逐层池的共享槽条件](kv-cache-layerwise-offload.md#同一块-p-端缓冲还要给-d-读什么时候才能换层)。它保护下一层复用相同内存，不等于单独 Layerwise 改成了 V1 那样的请求级押块协议。

次序是这套机制的底线：源块在对面读完之前被复用，D 会读到另一条请求的内容；完成信号丢了，块会多押一阵，最长押到超时。超时限定的是一条请求最多押多久，不是说出一次故障，整个块池就要被占满那么久。

**押着的块，抢占碰不到。** 主线里块只有两条回收路：请求结束时还，或者块池不够时从运行队列里挑最后进来的那条抢占、收回它的全部块（见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）。连接器加了第三种状态：P 上已经结束、块还押着的请求，D 上挂在等待队列里、块已分好的请求，都不在运行队列里。示意：P 的块池里有 30 块押着等 D 来读，这时新请求要块，调度器再怎么抢占，也只能从正在跑的请求那里收；那 30 块只能等 D 读完，或者等到超时。

## 整批拉与逐层推：省下的是哪段等待？

**在传输相同状态和布局的前提下，逐层推靠重叠计算与传输减少等待：D 分目的块挪到了 P 开算之前；前面层的传输有机会与 P 计算后续层同时进行。能藏进去多少，取决于传输速度、计算速度和同步开销；D 仍要等全部层到齐才开始生成。**

```wiki-diagram
file: mooncake-layerwise
```

以 3 层模型、每层计算耗时 $1$ 个单位、单层传输耗时 $0.5$ 个单位的理想流水线为例，当传输快于计算时，$L$ 层里可被计算隐藏的是前 $L - 1$ 层的传输：

$$T_{\text{saved}} = (L - 1) \times t_{\text{xfer}} = (3 - 1) \times 0.5 = 1\text{ 个单位}$$

| 传输方式（示意：3 层，每层算 $1$、传 $0.5$ 单位） | 三层到齐时刻算式 | 结果 |
| --- | --- | --- |
| 整批拉（V1） | $3 \times 1 + 3 \times 0.5$ | **4.5 个单位** |
| 逐层推（Layerwise） | $3 \times 1 + 0.5$ | **3.5 个单位**（省下前两层共 **1 个单位**） |

要拿到这 1 个单位，逐层推付出了别的东西：

- **D 必须先分块。** 代理要先挑 D、等 D 分好目的块、再挑 P，P 开算时手里才有写入的目标地址。整批拉则是先找 P，P 算完才轮到 D。
- **P 每层都要等本层真的算完。** 发送线程先等设备上这一层的计算完成事件，再发起写。同样的状态和传输布局仍需搬同样的有效字节；分批、重排和同步会改变链路利用率，不能从示意时间直接推出实际加速比。
- **P 不押块。** 见上一节，最后一层写完与块被复用之间的先后要靠时序保证。

整批拉的好处是简单：P 的前向里没有任何连接器动作，所有传输都在 P 算完之后由 D 一次发起。

## KV 池里也用 Mooncake：按名字存取，不和某个对端配对

**Mooncake 除了点对点的传输引擎，还有一个分布式 KV 存储（Mooncake Store）。昇腾的 KV Pool 连接器 AscendStore 默认用它当后端：实例把算完的整段 KV 按内容指纹起名存进去，别的实例按名字取回；存进去的东西放在哪、怎样找到，是 Store 自己的事，按 Mooncake 官方文档为准。** 池这条路怎么查、查到以后怎么搬回，见 [KV Pool](kv-pool.md)。

两条路共用底层：在 A2 上，存储后端直接复用同一个传输引擎对象，登记的也是同一批 KV 显存。区别在对方是谁：

| | 点对点连接器（V1、Layerwise、Hybrid） | 池连接器（AscendStore + Mooncake 后端） |
|---|---|---|
| 对方 | 一个确定的 P 或 D | 一个存储，存的和取的互不认识 |
| 怎么找到数据 | 对方的块号，经地址簿换成对方显存地址 | 内容指纹，存储自己知道放在哪 |
| 要不要配对 | 要：代理把一对 P、D 的信息互相转交 | 不要：各实例用同一套起名规则 |
| 启动时要有 | 两端的握手端口 | 存储的主控服务地址 |

两个名字相近的「逐层」别混：点对点的 Layerwise 连接器是 P 把每层写进 D；池的逐层存取是实例每层往池里存、从池里取，配的是 AscendStore 连接器加逐层开关，v0.23、v0.26 还要求 memcache 后端，main 才加了 Mooncake 后端的逐层路径。

官方上游文档里还会遇到 `MooncakeStoreConnector`。先认清注册名指向谁，再读它的配置：

| 名称与所属实现 | 连接什么 | 容易混用的条件 |
| --- | --- | --- |
| Ascend `MooncakeConnectorV1`、Layerwise、Hybrid | 指定的 P/D 对端 | 本页的块号、握手与完成通知协议 |
| Ascend `AscendStoreConnector`，别名 `MooncakeConnectorStoreV1` | 共享池；可选 Mooncake 后端 | JSON 的 `preferred_segment` 是布尔量；SSD 字段为 `enable_ssd_offload` |
| 上游 `MooncakeStoreConnector` | Mooncake 共享池 | `embedded` / `standalone-store` 区分池由谁持有；owner 定位使用 `host:port`；`enable_offload` 在 vLLM 端控制读取预算 |

即使用了相同的 `MOONCAKE_CONFIG_PATH` 环境变量，里面的 JSON 也不能互换。池容量按 rank 怎样相加、SSD 为何还需要主机暂存、master 与存储客户端分别做什么，见 [KV Pool 的两种 Store 部署](kv-pool.md#上游-mooncakestore池跟着推理进程还是独立持有)。上游另一套 NIXL 拉取协议则有自己的[租约与跨轮复用](pd-disaggregation.md#d-还在排队p-的块能保留多久nixl-租约)，不能套用本页 Mooncake V1 的 480 秒押块规则。

## 三套点对点连接器，看名字还不够

**昇腾在钉住版本注册了三套基于 Mooncake 的点对点连接器，区别在谁搬、谁先分块、押不押块，以及两边 TP 不同时怎么办。**

| 连接器 | 谁搬 | 谁先分块 | P 押不押源块 | 两边 TP 不同时 |
|---|---|---|---|---|
| V1（本页基线） | D 读 | P 先算完，D 后分 | 押到 D 报收完 | D 各读一部分再重排；有递推状态时 P 的 TP 要是 D 的整数倍 |
| Layerwise | P 写，一层一次 | D 先分，经代理告诉 P | 不押 | P 先交换重排；P 的 TP 要是 D 的整数倍 |
| Hybrid | D 读 | 同 V1 | 押 | 有递推状态时两边 TP 必须相同 |

名字不能当成能力清单：

- **V1 不是只会搬普通 KV。** 它也处理递推状态组，按 P、D 的 TP 比例拆开读；Hybrid 的「两边 TP 相同」只在它自己遇到递推状态时才检查，不能推广到另外两套。Layerwise 同样处理「注意力 + 递推状态」的混合模型，也让 P 少算提示词的最后一个位置。
- **判断角色的方式不同。** V1 和 Hybrid 按角色这一项是不是「生产者」来分：生产者起发送线程，其余都起接收线程，而步末只有写明「消费者」才报收完；所以写成「两边都是」时只起接收线程，也永远报不出收完。Layerwise 用 vLLM 的「是不是生产者」「是不是消费者」两个判断，「两边都是」时两个都成立，收发线程都会起。
- **后续版本新增 V2 家族。** 在 `v0.30.0` 中 `MooncakeConnectorV2` 指向新的拉取实现 `MooncakePullConnector`，而 `MooncakePushConnector` 还是抛出未实现异常的占位；到了当前 `main`，`MooncakePushConnector` 已实现为新的逐层推送入口，且 `MooncakeConnectorV2` 按 `use_layerwise` 自动路由 Pull 或 Push。逐项差异见页末版本表。


上述新 `MooncakePushConnector` 与既有的 `MooncakeLayerwiseConnector` 是不同入口，在 `v0.30.0` 仍为占位类时不能据此推断所有 push 路径都不可用。

## 先落到 D 的主机内存：D2RH 改了哪段等待？

前面的直接交接要求 D 准备好设备块。后续 **D2RH（device-to-remote-host，把设备数据送到对端主机内存）**改为两跳：**P 的 HBM → D 的 DRAM → D 的 HBM**。

- **省下哪段等待：** D 先把完整交接状态接到主机内存，第一跳完成就通知 P 释放源块；等 D 真正分到设备块，再搬入并继续生成。这样 P 的源块释放不必等到 D 的设备块准备好。
- **代价与两跳状态边界：** D 要有足够主机内存，多做一次主机到设备的搬运，并且必须区分“主机已命中”与“设备已可用”——请求只有在第二跳完成后才能计算，主机缓冲也要等所有对应 H2D 读完才能复用。
- **入口与版本范围：** 官方快照 921ccc52 将它命名为 `MooncakeD2RHConnectorV1`，并链接 Atlas 850E 的 UBoE 部署流程；这是一条新路径，不是把旧 V1 改一个模式值，也不代表本页 A2 GLM 基线已经支持或部署了它。

## V2 的“接收完成”，是否代表读成功？

**完成读取尝试与取得可用数据是两件事。** V2 沿用 D 主动拉取的方向，但把握手与请求完成的汇合移到调度侧：P 汇总各阶段、各 TP worker 的层名与地址；D 按同名层、本地缓存规格和实际头分片组织读取并提交网络读。符合交接条件的 P 请求保留源块，D 的各 worker 结束尝试后，由 D 调度侧发一次请求级释放通知，P 才将请求交回通常的还块入口；收不到通知则走到期释放。

- **早期社区主干缺口：** 早期主干只在单缓存组时标记无效块，多缓存组读取失败仅记录告警，随后仍将请求放进“接收完成”集合。**因此混合模型不能仅凭这个完成标志判断状态可用，也不能假定它会自动进入重算**；分组、地址和块数各自正确，不足以弥补失败没有传到调度器的问题。
- **`v0.30.0` 与当前 `main` 的分离上报：** 两版都把“完成”与“失败”分开上报——任一相关读取任务失败或整个后台处理抛出异常，都能记下受影响请求；汇合完各 worker 后，调度器再按失败策略处理（默认让请求报错结束；显式选择且配置允许重算时，清零该失败请求的已算计数并在再次调度前处理原目的块）。无论报错还是重算，D 都要通知 P 结束本次源块占用，因为这次读已经终止——释放通知只说明 P 可以回收资源，不承诺 D 的结果成功（具体版本与配置名见页末）。

## 放到 GLM 双机：这套部署没有开 Mooncake 连接器

**官方双机的启动配置里没有 KV 传输这一项，调度器和 16 个 worker 里一个连接器都不会造。两台机器是两个 DP 执行组，各自既做 prefill 也做 decode，KV cache 只在本机块池里分配和回收。** 部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。下面按[PD 分离页的拆法](pd-disaggregation.md#把这两台机器拆成一-p-一-d)，假设一台做 P、一台做 D、两边都 TP8、用 V1，换算连接器在这套硬件上怎样配对、搬什么；这是读源码得出的换算，没有实测。

没开的痕迹在主线里也看得到：每一步开头两个 DP 组互报 token 数的那次 All-Reduce（见[并发页](concurrent-requests.md#再补到两组的最大值)），对 GLM 这种 MoE 模型只有在 KV 消费者（D）一侧、并且满足 MC2（昇腾把 MoE 的分发、专家计算、汇合融成一个算子的通信方式，见[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)）的条件时才会省掉；这里没有 KV 传输配置，每一步照常做。

### 拆成一 P 一 D：8 对卡各自对表

**两边都是 TP8 时，D 的每张卡只对应 P 的一张卡：TP 相同，KV 头不用拼；MLA 潜向量本来也不按头切。8 对卡各自握手、各开一个传输会话，并行地读。**

P 机的 8 个 worker 各起一个发送线程、各开一个握手端口；D 机的 8 个 worker 各起一个接收线程。握手端口从同一个基址按 rank 往上排，公式见[大规模 EP 的「怎么开」](large-scale-ep.md#怎么开)。每对卡都要读 GLM 的 5 个缓存组：MLA 潜向量和 indexer 缓存（[稀疏注意力](sparse-attention.md)挑位置用的池化 K）所在的 full 组、indexer 尾状态组、3 个 KDA 组；各组传哪些块见 [PD 分离页](pd-disaggregation.md#glm-要一起交接哪些状态)。

### R1 交接一次，full 组要搬多少

**连接器按整块搬：R1 在 P 上只交出 3 个位置，每张 D 卡照样读满一个 640 格的块；潜向量和 indexer 缓存在 TP8 的每张卡上各存一整份，所以 8 张 D 卡读回的是 8 份相同的内容。** R1 是本站贯穿的示例请求，提示词 4 个 token（见[一条请求](one-request.md#示例请求-r1-与官方双机部署)）；GLM 是混合模型，P 少算最后 1 个位置（以下为按源码换算，无实测）：

$$B_{\text{full,total}} = 8 \times 1 \times 8{,}355{,}840\text{ B} = 66{,}846{,}720\text{ B} \approx 63.75\text{ MiB}$$

| R1 交接 full 组换算项（无实测；8 张 D 卡内容相同） | 算式 | 结果 |
| --- | --- | --- |
| P 交出的位置 | $4 - 1$ | **3 个 token** |
| full 组块数（每块 640 位置） | $\lceil 3 \div 640 \rceil$ | **1 块** |
| 每张 D 卡读入 | $1 \times 8{,}355{,}840\text{ B}$ | $8{,}355{,}840\text{ B} \approx$ **7.97 MiB** |
| 8 张 D 卡合计 | $8 \times 8{,}355{,}840\text{ B}$ | $66{,}846{,}720\text{ B} \approx$ **63.75 MiB** |

一块 8,355,840 B 的来历见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。这里假设两边按 640 个位置的逻辑块对上了块大小；钉住版本在 GLM 上报给 D 的块大小取的是各组里最小的 4，D 端可能先断言失败，长提示词还会少传块，见 [PD 分离页](pd-disaggregation.md#钉住版本里长提示词交接时-full-组会少传块)。

KDA 状态不一样：34 层 KDA 按头切到 8 张卡，每张卡读的是自己那 8 个头的状态，没有重复。每条请求虽然在 3 个 KDA 组里各占 4 块（含 MTP 候选槽），但源码对递推状态组每层只搬一块两段：按「请求在组里的块数 − 推测 token 数 − 1」挑出 P 的那一块，搬进 D 为该组分的第一块，而且只搬卷积、递推两段状态本身的字节，不搬补齐——每层 561,152 B（卷积 36,864 B 加递推 524,288 B），不是补齐后的 655,360 B，两个数见 [KV cache 页](kv-cache.md#混合模型到底要保留哪几类状态)。每张 D 卡 34 层合计 19,079,168 B ≈ 18.2 MiB，比它从 full 组读的 7.97 MiB 还多一倍多（按源码换算，无实测，缺 D 端传输日志对数）。

### 押着的块会占 P 的块池多久

**按 V1，交接时 P 实际保留的源块，从请求结束一直押到 D 读完，抢占收不回。** 主线并发页中，一条已生成到约 67,000 个 token 的请求，每卡占 120–121 块、约 956–964 MiB（见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）。这是 decode 步的占用，不能直接当成同长度提示词在 P 上完成 prefill 后保留的块数；结束前还会清理不再需要的滑窗块。

只为看押块比例，假设某次交接完成计算后实际仍保留 120–121 块，并沿用 PD 页算出的 1,577 块预算，那么约占 1/13。该预算只扣所列语言权重，尚未扣视觉塔、MTP 旋转矩阵与量化辅助张量等，不是实机容量。这个比例也不证明 67,000 token 的 prompt 能在此 P 实例中完成：长提示词的准入及 chunk 尾状态会要求更多瞬时块，须另按[长提示词分块条件](vllm-kv-block-allocation.md)核算。交接实际押住的块在 D 迟迟不来读时，才由 480 秒超时机制回收。

GLM 的几类状态解释了连接器为什么要按缓存组分别处理，但源码里有这些分支，不等于 GLM 整套 PD 已经跑通：量化后的缓存布局、KDA 状态、MTP 和图模式，都要在同一套安装版本上一起验证。

**固定 GLM 改用逐层推送还有明确的初始化阻碍。** 同一个主干 MLA 层同时登记主 MLA、压缩 indexer K 和 compressor state 三个缓存名称，运行器将完整字典交给连接器；旧 Layerwise 按物理层号要求只有一个名称，第二个同层名称就不满足断言。MTP 的特殊登记分支不解除主干的限制。KDA 也不能只看导入名：固定镜像把上游 Kimi 类替换为 Ascend 实现，实际计算路径没有调用逐层等待或保存入口。前一项已经阻止这套布局直接进入正常传输，后一项说明不能只改名称断言就认为接好了所有层。

**登记显存段数则可以静态算清。** 按本页 TP8、PP1、一个 MTP 的固定配置，专用布局分出 12 个大槽和 12 个小槽，V1 因含递推状态而按每个非空原始分配登记，共 24 段，低于 256 段上限。槽数来源沿用[部署页的唯一布局说明](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)，不是把所有逻辑缓存名称相加。实际地址的 2 MiB 对齐、区间覆盖和注册成功仍需启动日志；24 段也不解除逐层连接器的名称限制。

这套部署也没有开 KV Pool；[KV Pool 页](kv-pool.md#放到-glm-双机这套部署没有开-kv-pool)推演过，只加 KV Pool、不开 prefix caching 时，段长等于最长长度 133,120；短于该长度的 prompt 向下取整为 0，不会发出查询。

## 常见误解

- **「Mooncake 连接器就是 Mooncake。」** Mooncake 提供传输引擎和分布式存储；块押不押、请求等不等、块号怎样换成地址，都是 vllm-ascend 写的连接器在做。
- **「显存登记了，数据就到了。」** 登记只允许对端按地址访问这段显存；内容要等 P 算完、D 读完（或 P 写完），以完成通知为准。
- **「一次交接就是一次网络调用。」** 按层、按缓存份数、按连续块段拆成很多段；TP 不同时还要按 P 卡分开，每张 P 卡一批。
- **「逐层推能让 D 提前出字。」** D 仍要等最后一层到齐；省下的是 D 分块的时间和前面各层的传输时间。
- **「V1 只会搬普通 KV，要搬线性注意力状态得换 Hybrid。」** V1 也处理递推状态组；Hybrid 的「两边 TP 相同」只在它自己遇到递推状态时才要求。
- **「官方 Mooncake 逐层文档讲的就是 Layerwise 连接器。」** main 上那篇文档配的是 KV Pool 的 AscendStore 连接器加逐层开关；点对点的 Layerwise 连接器只在 PD 设计文档和多机教程里出现。
- **「块池紧张时，押着的块可以被抢占收回。」** 抢占只从运行队列里挑请求；P 上已结束、块押着的请求和 D 上等数据的请求都不在里面。
- **「角色写成『两边都是』最省事。」** V1 和 Hybrid 只认生产者、消费者两种写法，写成「两边都是」只起接收线程、也永远报不出收完；Layerwise 则会把收发线程都起起来。

## 对照源码

### 怎么开

在 P、D 两套实例的启动参数里各加一份 `--kv-transfer-config`。官方单机教程的写法（P 这一侧；D 把 `kv_role` 换成 `kv_consumer`，同机时 `kv_port` 要错开）：

```json
{"kv_connector": "MooncakeConnectorV1",
 "kv_role": "kv_producer",
 "kv_port": "30000",
 "kv_connector_extra_config": {
   "prefill": {"dp_size": 1, "tp_size": 1},
   "decode":  {"dp_size": 1, "tp_size": 1}}}
```

- `kv_connector` 是注册名：`MooncakeConnectorV1`、`MooncakeLayerwiseConnector`、`MooncakeHybridConnector`；同一个注册表里还有池类的 `AscendStoreConnector`（别名 `MooncakeConnectorStoreV1`）和把多个连接器叠在一起用的 `MultiConnector`。
- `kv_role` 取 `kv_producer`、`kv_consumer`、`kv_both` 三者之一；配了连接器却不写角色，vLLM 启动时就报错。
- `kv_port` 是握手端口的基址，默认 14579，每个 rank 在上面往上加；`engine_id` 不写时自动生成一个随机编号。
- `kv_connector_extra_config` 里的 `prefill`、`decode` 两段写的是 P、D 两套实例各自的 TP 与 DP，两边的配置里都要写全；`pp_size` 可省略（默认 1），但 D 的 `pp_size` 必须是 1。
- 不传这项时，调度器里的连接器是空的，worker 也不造连接器；官方 GLM 双机就是这种情况。

后续快照的 D2RH 使用注册名 `MooncakeD2RHConnectorV1`，还要按 [Atlas 850E UBoE 完整部署步骤](https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/tutorials/features/pd_disaggregation_mooncake_multi_node.md)准备主机接收池、设备和网络环境；不能只在上面的旧 V1 配置中换名字就当成完整部署。两跳就绪与缓冲释放条件见前文 D2RH 一节。

### 会报什么错

- 缺 `prefill` 或 `decode` 的 `tp_size`、`dp_size`：worker 初始化时 `AssertionError`；D 的 `pp_size` 不是 1：`decode pp size must be 1`。
- 非 MLA 模型 P 的 TP 不能被 D 的 TP 整除：`Prefill TP size must be divisible by Decode TP size.`。有效正整数配置下，P 的 TP 小于 D 时也先触发这道整除检查；不能把后面的 `pd_tp_ratio == 0` 报错当成必然先出现的日志。
- `v0.30.0` / `main` 下 GQA + C8 KV 量化配普通 `MooncakeConnector`：`ValueError: MooncakeConnector does not support C8 KV cache quantization on GQA models...`（需关闭 C8 或改用先量化再发送的 `MooncakeLayerwiseConnector`）。
- `v0.30.0` / `main` 下 PD 分离或 KV 池同开 `DCP > 1` 且交错块大小不等：`AssertionError: cp_kv_cache_interleave_size(...) and block_size(...) needs to be equal if DCP is enabled in P/D disaggregate and kv pool scenario.`。
- V1 的递推状态组 P 的 TP 小于或不能整除 D 的 TP：`Mamba prefill TP size must be >= decode TP size.` 等断言；Hybrid 遇到递推状态且两边 TP 不同：`Mooncake connector does not support different TP size with Mamba.`
- 登记区间超过 256 段：`RuntimeError`，信息以 `Mooncake register_buffer region count` 开头，提示减少 KV 分配碎片、进一步合并 k/v/dsa/scale 的分配。
- 固定 GLM 配旧 Layerwise：同一主干 MLA 层的多个缓存名称触发 `Mooncake Layerwise Connector does not support multiple attn_module in one layer now` 对应断言；源码错误串中的 attn_module 带反引号。这是初始化条件，不能等到传输超时才排查。
- 没装 Mooncake：`ImportError`，附安装说明链接；引擎初始化失败：`TransferEngine initialization failed with ret_value`；登记失败：`Mooncake memory registration failed.`
- 收发线程 5 分钟没就绪：`Timeout waiting for KV Cache thread to be ready.`；线程起来就退出：`KV Cache sending/receiving thread failed to start.`
- 押块超时：`Force freed expired request`，并写明超时阈值（`VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT`，默认 480 秒）。

### 开销和什么时候别开

- **单次传输超时。** 已显式设置非空 `ASCEND_TRANSFER_TIMEOUT` 时沿用它；否则 worker 用 `floor(4.096 × 2^HCCL_RDMA_TIMEOUT × HCCL_RDMA_RETRY_CNT ÷ 1000) + 3000` 毫秒。默认 20 和 7 代进去得到 33,064 毫秒，约 33 秒。这和 480 秒的押块超时是两回事。
- **启动开销。** 传输引擎按 `P2PHANDSHAKE` 模式、`ascend` 协议初始化，两端直接握手，不需要另起元数据服务；每个进程登记一次 KV 显存，再起一个收或发的后台线程。
- **Layerwise 的额外开销。** 固定实现先用 `min(P_TP, KV头数) ÷ min(D_TP, KV头数)` 得到 `pd_head_ratio`；不能用裸 TP 比替代。该头数比大于 1，或需要对应量化路径时，才建立重排流与缓冲；实际按头交换的分支还看注意力组类型和待传块数。发送线程等设备事件或重排流后再写，源码注释提到事件同步在 CANN 8.5.rc1 之前偶尔会卡住。
- **别开的情形。** 单实例混部（官方 GLM 双机就是）用不上；非 MLA 模型按本页统一校验，P 的 TP 不能被 D 整除时不能开；Hybrid 遇到递推状态且两边 TP 不同时不能开；GLM 在钉住版本上的问题见 [PD 分离页](pd-disaggregation.md#钉住版本里长提示词交接时-full-组会少传块)。
- **Layerwise 的 D 侧不支持 PCP。** 调度器初始化先要求消费者的 PCP 等于 1，否则立即断言失败。调度侧端口基址为 `kv_port + dp_rank × tp`，worker 为 `kv_port + dp_rank × pcp × tp + pcp_rank × tp`；在允许的 D 侧配置 PCP=1、PCP rank=0 下两式相同。不能跳过入口断言，把 D 侧 PCP>1 写成可运行后的端口错配。

### 版本差异

**`v0.30.0 (c09d3e20)` 的 `MooncakeConnectorV2` 仍是 pull 实现，但已解除旧 main 的 `PCP=1` 限制；当前 `main (8d6180e2)` 进一步实现 `MooncakePushConnector`，并让 `MooncakeConnectorV2` 按 `use_layerwise` 自动路由 Pull 或 Push。** 新 worker 与握手 metadata 纳入 PCP rank，端口与设备编号按 DP、PP、PCP、TP 组合计算；调度侧按每组 `block_size` 和相应 DCP 大小裁剪传输范围，环形组单独处理。P/D 两端必须使用一致的协议与真实拓扑，不能沿用旧端口跨度估算。

V2 仍要求单一传输角色；V1、Hybrid、Layerwise 与 V2 的注册入口共存，选了哪个名字就追哪条实现。`v0.30.0` 的 GLM 官方 PD 配方采用 V2，不能据此将旧 V1 的逐组块数问题认定为已在原路径修复。

V2 的失败处理也要按钉点分开：早期社区主干（`baa023ad`）的多组 pull 失败未进入请求失败集合；`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均通过 `get_transfer_results` 上报 `failed_recving`，配套上游 `ced6857a` 默认 `kv_load_failure_policy="fail"`，显式 `"recompute"` 才走重算分支。这里同时核了 runner 与 worker 结果汇合，不能只看字段声明；上述链路没有 NPU 故障注入实测。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 点对点注册连接器 | V1、Layerwise、Hybrid | 另多 `SfaRemoteD2HConnector` | 另多 V2/Pull、`MooncakeD2RHConnectorV1` | 另注册实现版 `MooncakePushConnector`；V2 按 `use_layerwise` 选 Pull/Push |
| V1 核心校验与流程 | 押块、D 读、按角色字符串起线程；D 端 `PP=1`、非 MLA `TP_P % TP_D == 0` | 同一套 | 保留主流程与 D 端 `PP=1` / `TP_P % TP_D == 0`，增远端 prefill 拒绝前安排空接收释放 P 源块；新增 GQA+C8 拒绝普通 Mooncake（需 `MooncakeLayerwiseConnector`）及 DCP `cp_kv_cache_interleave_size == block_size` 强校验 | 延续 v0.30.0 全部校验 |
| V2、Push 与 PCP | 无 V2 | 无 V2 | V2 为 Pull 别名，普通 `MooncakePushConnector` 仍为占位类；worker 地址与 metadata 含 PCP，端口按 DP/PP/PCP/TP 排列，仅接受单一角色 | `MooncakePushConnector` 落地逐层推送（`push_scheduler.py` / `push_worker.py`），延续 PCP 拓扑与单一角色限制 |
| V2 多缓存组拉取失败 | 无 V2 | 无 V2 | `get_transfer_results` 按请求上报 `failed_recving`，汇合后按 `kv_load_failure_policy` 处理（默认 `fail`） | 延续 v0.30.0，Push 路径同样接入 `failed_recving` |
| Hybrid 的握手端口与上下文并行 | 基址 `kv_port + dp_rank × tp × pp`；要求 `PCP × DCP = 1` | 同 v0.23.0 | 要求 `DCP=1`、`PP` 与 `PCP` 不同时大于 1、拒绝 consumer `PCP > 1`；基址乘 PCP 且偏移含 PCP rank | 延续 v0.30.0 |
| 池的逐层存取与注册表 | 要求 memcache 后端 | 同 v0.23.0 | 改为 Mooncake（AscendStore + `use_layerwise`），注册 `OffloadingConnector` / `SimpleCPUOffloadConnector` / `PreemptOffloadConnector` | 延续 Mooncake 逐层池；注册表移除 `SimpleCPUOffloadConnector` |

独立 GLM 提交 `db701c1f` 的点对点/池连接器集合、V1 流程与 Hybrid 约束与 `v0.23.0` 同源；`v0.30.0` 与 `main` 的 V2 还按组裁剪：环形组保留状态页，Mamba 去掉草稿尾，普通组使用自己的逻辑块大小及相应 DCP，SWA 不乘 DCP。完整条件见 [PD 分离的版本差异](pd-disaggregation.md#版本差异)。

- 上游连接器接口（调度侧、worker 侧两组方法，`SupportsHMA` 多组释放）在 v0.26.0（568afb3a）与 v0.23.0（0fc695fc）一致，只多一个非抽象的 `has_pending_push_work`（默认返回否；调度器用它在还有推送没发完时让主循环继续转）。昇腾在 v0.26、main 两版都没有实现它，Layerwise 在 v0.26 上走的是默认值。
- 升到 main 时，V1 的配置照旧能用；换成 V2 要按 main 的文档重写配置，旧的「两边都是」写法在 V2 上初始化即报错（见 PD 分离页的版本表）。

### 源码位置

GLM 同层多缓存名称、完整登记入口和 Layerwise 名称断言见来源 85–92；实际 Kimi 自定义算子注册、对象回调与没有逐层 hook 的计算路径见 93–105。原始大/小槽规划、带递推状态的登记分支与 256 上限见 106–110，配合既有 17、26；24 段按固定配置推得，设备登记尚未执行。

旧 Layerwise 的后台队列、同步网络写、空等待接口、空发送完成集合及上游释放调用见 111–119，配合既有 7、28、30、31。新指定组合的物理槽保护统一引用[逐层池来源](kv-cache-layerwise-offload.md#源码位置)，不把它当请求级延迟释放。

V2 地址登记、按层/阶段匹配、实际网络读和调度侧释放见 120–131；main 多组失败的限制见 127、132–133。rc2 从失败记账、connector、runner 到 worker 汇合与调度器策略见 134–147，默认 fail 与重算分支分开核。该 main 与其上游比较点未验证为实际安装组合；源码链和 CPU 记账复现均不替代 NPU 运行。

| 看什么 | 固定源码位置 |
|---|---|
| 连接器两半的接口 | `vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py`：`KVConnectorRole`、`KVConnectorBase_V1` |
| 调度器在哪里叫它、押块与完成名单 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`：`_free_request`、`_update_from_kv_xfer_finished`、`WAITING_FOR_REMOTE_KVS` 的跳过 |
| worker 在哪里叫它 | `vllm/v1/worker/kv_connector_model_runner_mixin.py`；逐层两处在 `vllm/model_executor/layers/attention/kv_transfer_utils.py`，昇腾后端在 `vllm_ascend/attention/utils.py` |
| 注册表 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py` |
| V1 两半的实现 | `kv_p2p/mooncake_connector.py`：`MooncakeConnectorScheduler`、`MooncakeConnectorWorker` |
| 地址簿、按地址批量读 | 同文件 `MooncakeAgentMetadata`、`_transfer_kv_cache_all_groups` |
| 传输引擎与登记 | `utils/mooncake_transfer_engine.py`：`GlobalTE`；区间上限与超时在 `utils/utils.py` |
| Layerwise | `kv_p2p/mooncake_layerwise_connector.py`：`update_state_after_alloc`（报给代理）、`save_kv_layer`、`KVCacheSendingLayerThread` |
| Hybrid | `kv_p2p/mooncake_hybrid_connector.py` |
| P、D 的 TP 比与 GQA+C8 校验 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L880-L899`（`pd_tp_ratio`/`pd_head_ratio`）、`#L1020-L1044`（`_check_mooncake_c8_kv_cache_quant`）；`main (8d6180e2)` 见 `#L945-L968`、`#L1138-L1162` |
| `v0.30.0` / `main` D 端 `PP=1`、DCP 交错对齐与 V2/Push 路由 | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2235-L2250`、`platform.py#L1410-L1436`、`mooncake/connector.py#L237-L270`、`mooncake/pull_scheduler.py#L730-L746`；`vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L162`、`mooncake/connector.py#L241-L312`、`platform.py#L1666-L1692` |
| 池的 Mooncake 后端 | `kv_pool/ascend_store/backend/mooncake_backend.py` |

**来源索引。** 接口分调度侧、worker 侧两半，一个进程只启用一半 [C1]；调度侧的几个方法与基类默认不押块 [C3]；只有配了 KV 传输才造连接器 [C5]；调度器的押块判断 [C7]；完成名单处理与等待队列跳过分别见来源 8、9；V1 的调度侧记账与交回参数 [C15][C16]；登记、起线程与按角色字符串分线程 [C17]；地址簿字段 [C18]；地址算式与批量读 [C19]；拉取份数与 extra config 断言 [C20]；押块超时 [C21]；传输引擎初始化与只登记一次 [C24]；传输超时公式与区间上限检查 [C25][C26]，上限常量 256 见来源 65；Layerwise 的 D 先报代理、P 不押块、逐层写与最后一层回调 [C27][C28][C29]；Hybrid 的等 TP 断言 [C34]；启动时的 TP 整除检查 [C35]；池后端复用传输引擎 [C36]；main 的 V2 与推送版 [C42]；递推状态组每层只搬一块、两段 [C48]；Hybrid 的握手端口基址与上下文并行断言（钉住版本 PCP × DCP = 1、main 只限 DCP）与 v0.26 上游接口新增的方法，行号在来源第 49–56 条。两种连接器的流程出自设计文档 [S44]，配置写法出自单机教程 [S45]，逐层池文档的后端要求与 main 的改写见 [S46][S47]。示意数与 R1、押块比例的换算 [D]；「押着的块抢占碰不到」由抢占只遍历运行队列、押块请求已移出运行队列推断 [I]。传输引擎和 Mooncake Store 的完整内部实现尚未核完；本页核对昇腾侧调用方式，本轮补核的 Store SDK 初始化、内存预算和 SSD 责任链见 [KV Pool](kv-pool.md#上游-mooncakestore池跟着推理进程还是独立持有)。按地址直接读写、两端握手与按名字定位的总体设计另参照固定的 Mooncake 官方资料。

rc2 表中注册、V1 新释放分支、Hybrid 条件和池指南边界分别见来源 66–74；PCP 地址结构见来源 77，端口与逐组裁剪见来源 60–62。实际 KV 头比的建流条件见来源 75，P 交出块表前的窗口清理见来源 76。

AscendStore 与 `MooncakeConnectorStoreV1` 指向同一类，见注册表来源 78–81；Ascend 后端的布尔 `preferred_segment`、`enable_ssd_offload` 和配置入口见 82–83，上游 Store 的另一套配置类见 84。上游的 owner、预算及 SDK 调用条件集中在 KV Pool 页核对；NIXL 租约集中在 PD 分离页，避免把相似名称当成共同协议。

**待核。**

- 旧 Layerwise 的请求级释放链缺少显式发送完成衔接；设备上的竞争是否发生、重排或量化副本在具体配置中的寿命，需要双机时序与地址记录。新版指定组合的槽等待另见逐层池页，不能替代这项实测。
- 固定 GLM 的逐层名称断言及实际 KDA 缺少 hook 已按源码定位；修复后的整体兼容性尚无设备验证。新版 Kimi K3 的等待/保存入口不能作为旧 GLM 已支持的证据。
- 固定 GLM 的 V1 静态登记为 24 段；实际地址对齐、注册结果和其他布局仍缺启动日志。
- Layerwise 的 D 侧 PCP>1 已由初始化断言拒绝；允许配置下的端口绑定与网络连通性仍缺设备启动日志。
- 待核：上面「会报什么错」列出的报错都没有在双机上触发过，缺实际日志原文。

固定 layerwise 连接器按层索引登记缓存名称，断言同一索引只出现一次；名称含 `mtp` 的项先跳过检查，再登记到最大索引之后（来源 31）。这是名称映射的局部规则，其他模型或预测配置还须满足各自的形状与拓扑条件。

固定逐层推路径的请求结束接口返回 `False, None`，无需通过结束返回值延迟释放 P 的块（来源 28）；传输流同步条件仍需按前文区分。旧 main 新拉取路径的 PCP 限制见来源 43，Hybrid 的 DCP、PP/PCP 限制见来源 55、56，握手端口公式见来源 50、51。上下文并行按输入位置分配计算或历史状态，各连接器的检查不同，不能合并成共同限制或由未拒绝推断支持。

