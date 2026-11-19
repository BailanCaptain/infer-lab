---
id: pd-disaggregation
title: PD 分离：prefill 与 decode 分给两组实例时怎样交接历史
type: feature
summary: >-
  把一条请求的 prefill 与 decode 交给 P、D 两套实例，中间由连接器交接历史状态。沿 Mooncake V1 看交棒、D
  拉取、完成信号与押块，讲清 GLM 这类混合模型为何让 P 少算最后一个位置；本站双机主线没有开 PD，只作变体对照。
aliases:
  - PD 分离
  - PD Disaggregation
  - Prefill/Decode 分离
  - Prefill-decode Disaggregation
  - disaggregated prefill
  - 分离部署
  - P 节点
  - D 节点
  - P 实例
  - D 实例
  - kv_role
  - kv_producer
  - kv_consumer
  - MooncakeConnectorV1
  - NixlConnector
  - KV 租约
  - 双向 KV 传输
chapters:
  - '18'
order: 10
sources:
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L3-L13
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L27-L55
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L64-L105
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L29-L45
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353'
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L788-L806
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L925-L927
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1666-L1749
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1751-L1849
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L798-L824'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2027-L2057'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L774-L990
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L245-L390
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L705-L756
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L166-L243
  - 'vllm@0fc695fc:vllm/envs.py#L1684-L1686'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2221-L2248'
  - 'vllm@0fc695fc:vllm/config/kv_transfer.py#L66-L73'
  - 'vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L13'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2424-L2492
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L46-L51
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1974-L2083
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1130
  - 'vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L191-L238'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L593-L614'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87'
  - >-
    vllm-ascend@db701c1f:docs/source/tutorials/features/pd_disaggregation_mooncake_multi_node.md#L227-L239
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L1101-L1109'
  - >-
    vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L107
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L48'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/epd_disaggregation.md#L3-L33
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/epd_disaggregation.md#L39-L79
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2018-L2025'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5133-L5134'
  - >-
    vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L45-L57
  - >-
    vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L90-L133
  - >-
    vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L187-L200
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1285-L1296'
  - 'vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L216-L246'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L671-L703'
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L89-L124
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_encoder/disagg_epd_proxy.py#L402-L430
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L210
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2585-L2616
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L96-L102'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L46-L125'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L96-L100'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L169-L176'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L228-L261
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L610-L618
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L84-L140
  - >-
    raw:sha256-6b813b57db4cf5c3d89648d6ef17a8eb9d27a36cfa91b01fff90cfe7733d97ad.md#L1-L2219
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L103-L105
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1895-L1911
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1114-L1119'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L1114-L1119'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L700-L705'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1735-L1742'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2259-L2267'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2403-L2411'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L42-L233'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L135
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L42-L90
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/encoder_cache_cpu_offload.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/configuration/encoder_cache_manager.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L892-L900'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/metadata.py#L88-L122'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L58-L95'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_worker.py#L249-L284'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1788-L1905'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2007-L2069'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2711-L2769'
  - 'vllm-ascend@7d825229:docs/source/user_guide/support_matrix/supported_models.md#L27-L45'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L778-L783'
  - 'vllm@ced6857a:vllm/config/kv_transfer.py#L103-L107'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L27-L50'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L175-L200'
  - "vllm@0fc695fc:docs/design/nixl_kv_cache_lease.md#L17-L43"
  - "vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1815-L1823"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L70-L76"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L175-L217"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L560-L578"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L638-L674"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/worker.py#L219-L223"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/worker.py#L1771-L1865"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/worker.py#L1933-L2025"
  - "vllm@0fc695fc:docs/features/nixl_connector_usage.md#L129-L242"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L149-L158"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L393-L429"
  - "vllm@0fc695fc:examples/disaggregated/disaggregated_serving/disagg_proxy_multiturn.py#L54-L155"
  - "vllm@0fc695fc:examples/disaggregated/disaggregated_serving/disagg_proxy_multiturn.py#L255-L301"
  - "vllm@0fc695fc:examples/disaggregated/disaggregated_serving/disagg_proxy_multiturn.py#L369-L425"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L237-L280"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_worker.py#L28-L30"
  - "vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_worker.py#L105-L131"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/nixl/base_scheduler.py#L471-L497"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L247-L291"
  - "vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_worker.py#L106-L153"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/base_scheduler.py#L470-L506"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L250-L294"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_worker.py#L104-L165"
  - "vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/connector.py#L339-L408"
  - "vllm@0fc695fc:docs/features/nixl_connector_usage.md#L244-L312"
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/nixl/scheduler.py#L356-L432'
  - 'vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L34-L110'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L34-L107'
  - 'vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/nixl/pull_scheduler.py#L34-L107'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2543-L2584'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2919-L2960'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L2927-L2968'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1216-L1236'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L346-L375'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1901-L1947'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L135'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1788-L1905'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L40-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L778-L785'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L162'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L260-L310'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L364-L385'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L943-L949'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: builds-on
    note: P 实例做的就是整段提示词的 prefill；混合步为什么拖慢 decode 也在那页
  - to: kv-cache
    kind: builds-on
    note: 交接的是 GLM 的几类历史状态，各自多大、怎样分组见该页
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 本页对照的部署：两台机器是两个 DP 执行组，拆成一 P 一 D 时的换算也在那页
  - to: block-table
    kind: builds-on
    note: 源块与目的块各属自己的块池，块号怎样对应显存见该页
  - to: chunked-prefill
    kind: alternative-to
    note: 不拆实例，把长提示词切块混进 decode 步，是限制 prefill 干扰的另一条路
  - to: epd-disaggregation
    kind: variant-of
    note: 再把多模态编码器独立成 E 池、与 P/D 协同的完整三池架构与 ECConnector 见该页
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 一条请求的 prefill 和 decode，为什么要交给两组机器？

**PD 分离（Prefill/Decode disaggregation）把一条请求的两个阶段交给两套独立启动的推理实例：P 实例负责 prefill，处理提示词并留下历史状态；D 实例接过状态，继续生成。** P 可以把长提示词分成多个 chunk、用多步完成；D 的普通自回归每步生成一个 token，投机解码则可能一次处理多个候选。两边各有自己的调度器和 KV cache 块池，中间多出一次跨实例的「历史状态交接」。

先把这句话里的词说清：

- **prefill 与 decode。** [Prefill](prefill.md) 是处理提示词的阶段，可以一次处理短提示词，也可以把长提示词分成多次前向，逐步留下历史并在完成后采样首个输出 token。普通 decode 只为最新确定的 token 算一次，读前面留下的历史；开了 [MTP](speculative-decoding.md)（用草稿层先猜后面几个 token）时，这一步还要带上草稿 token 一起验证。
- **历史状态。** 就是 [KV cache](kv-cache.md) 里存的东西：普通注意力层为每个位置存一份 K、V；GLM 里还有一种叫 KDA 的线性注意力层，每条请求只存一份固定大小的「算到这里」的状态。
- **块和块池。** KV cache 不是按请求整段分配的，而是切成一块块、每块装固定个数位置的小段；一个实例能分出的全部块叫它的块池，块在池里的编号叫块号。
- **调度器。** 每一步决定哪些请求各算几个 token，并从块池里给它们分块、收块。
- **实例。** 一套独立启动的 vLLM 服务，有自己的入口、调度器和块池。P、D 是职责名：一个实例可以跨多台机器，一台机器上也可以起多个实例。

```wiki-diagram
file: pd-disaggregation-intuition
```

上半张是混部，数是示意：生成中的请求 A、B 本来每步各算 1 个位置；来了一条 4 个 token 的提示词，同一组机器的下一步就变成 1 + 1 + 4 = 6 个位置，A、B 要等这 6 个位置一起算完，才拿到各自的下一个 token。下半张是 PD 分离：P 把这 4 个 token 算成历史状态交出去，D 用自己的块接住，之后只跑 decode。代价就是中间那根紫色箭头：状态搬过去之前，这条请求在 D 上只能等。

**本站主线没有开 PD 分离，本页讲的是部署变体。** [官方双机部署](glm-5-3-flash-two-node.md#部署前提)的两台机器是两个 DP 执行组。DP 执行组指一套各自接请求、各自调度的执行单元：每台各自接一部分请求，各自既做 prefill 也做 decode。启动配置里没有 KV 传输这一项，也就没有 P、D 之分。放到 GLM 双机会怎样，集中在后面「放到 GLM 双机」一节；那里的数字都是主线混部的事实或配置换算，不是 PD 的实测效果，本页也不给任何 PD 加速比。

## 为什么要拆，拆开要付什么？

**拆的理由是让 decode 步不再被 prefill 打断，并让两个阶段各自挑并行方式和实例数；代价是多一次状态交接、两边的块池各押一段时间，以及更多出错的地方。**

vllm-ascend 的设计文档给了两条动机。一是两边可以分别调整并行策略和实例数：[DP](data-parallel.md) 把请求分给几组各自调度的机器，[TP](tensor-parallel.md) 把同一层的矩阵切给几张卡合算，[EP](expert-parallel.md) 把 MoE 层的专家分到几张卡上；P、D 可以各选各的组合，按首 token 延迟（TTFT）和每个输出 token 的间隔（TPOT）分别调优。二是稳住 TPOT：混部时 prefill 会插进正在 decode 的批里，拖慢这些请求出下一个 token。混部常用 chunked prefill 缓解这一点：把太长的提示词切成几段，每步只拿一段和 decode 请求拼在一起算。分段大小同时影响提示词处理效率和 decode 等待时间，往往难以兼顾。拆开后，P 端仍需调整 chunk 和每步 token 预算，但不再靠这一个分段参数平衡同一步里的 prefill 与 decode 干扰。

两侧分别调优仍受连接器与版本约束。所列 v0.23 文档对非对称 TP 要求 P 侧 TP 数大于 D，且为 D 的整数倍。例如 P8、D4 满足这两项数量条件，反向配置不满足；其他连接器须查看自己的支持范围。


还是用上面的示意数看「拖慢」落在哪里。A、B 两条请求每步只要算 2 个位置；混进 4 个 token 的提示词后，这一步变成 6 个位置，A、B 出下一个 token 的这一步变重了。提示词越长，这一步越重；chunked prefill 能把它限制在一段的大小，但 A、B 每一步仍在和别人的提示词共用一步。PD 分离后，D 上每一步只剩 A、B 这样的 2 个位置，提示词那 4 个位置全在 P 上算。

拆开要付的代价集中在交接上：

- **多一次搬运。** D 要拿到 P 算出的历史状态，这是一次点对点的数据传输，不是多张卡一起参与的集合通信；传输期间同一份状态在 P、D 的显存里各占一份。
- **两边都要押块。** P 上存着这条请求历史的块（源块）要押到 D 报告收完才放；D 在状态到位之前，就要先从自己的块池里分好接收用的块（目的块）。
- **多出失败方式。** 传输会失败、会超时，两边的并行切分和状态布局必须对得上。
- **多一层转发。** 前面要有一个代理，把请求先发给 P、再发给 D，并把 P 交回的信息转给 D。

「prefill 吃算力、decode 吃显存带宽」只说明两个阶段的负载形态不同，不足以决定要不要拆。值不值得拆，要看拆开后减少的干扰，能不能抵过交接、押块和每个实例规模变小的代价。

下表把 PD 分离和几种相邻做法放在一起，看各自解决什么、prefill 和 decode 还在不在同一步里算。

| 做法 | 解决什么 | prefill 和 decode 还在同一步吗 |
| --- | --- | --- |
| 混部 + chunked prefill（本站主线） | 长提示词分几步算，每步不超出预算 | 在，只是每步混进的量受限 |
| 两个 DP 执行组（本站主线） | 两组各接一部分请求 | 在，两组各自混部 |
| PD 分离（本页） | 两个阶段放进不同实例 | 不在，D 上只剩 decode |
| EPD 分离（本页后文） | 再把图像编码拆出去 | 取决于 P、D 是否也拆开 |

## 状态交接怎样一步步完成？

**以设计文档里作示例的 Mooncake V1 连接器为例：代理先让 P 只生成 1 个 token、按「写到长度上限」结束，P 借这个结束时机打包块号和地址并押住块；D 分好自己的块后，由后台线程按地址把 P 的块读过来；读完发一个完成信号，D 接着算，P 放块。** 连接器（connector）是 vLLM 里负责跨实例搬运 KV cache 的插件，启动时在配置里指定。同一个连接器类在调度器进程和 worker 进程里各有一份，前者决定这条请求要搬哪些块，后者真正去搬，细节见 [Mooncake 连接器](mooncake-connector.md)。

P 侧完成回调并非遇到任何结束原因都交接：固定镜像要求请求带有交接参数、启用远端 decode，并因达到生成长度上限而结束，才继续构造交接结果。有待传输块时才延迟释放；其他结束原因不会走这条回调的交接路径。


```wiki-diagram
file: pd-disaggregation
```

1. **代理发给 P。** 代理（proxy）是 PD 部署最前面的转发服务。它把用户请求复制一份发给 P，标明「这条要交给远端做 decode」，并把最多、最少生成的 token 数都改成 1。这是交接用的设定，不是用户只要 1 个 token。
2. **P 做 prefill，按长度上限结束。** P 算完提示词（混合模型会少算最后一个位置，见下一节）、采样出 1 个 token，这条请求因为写到了长度上限而结束。连接器只在这种结束方式下交棒：它挑出装着提示词的那些块（MTP 为草稿多留的块不传），把块号、P 的地址和握手端口打包交还给代理，并告诉 P 的调度器「这些块先别放」。
3. **代理转给 D，D 先分块、不计算这条请求。** D 的调度器看到「状态在远端已经算好」，就用自己的块池为它分好目的块，把请求挂进「等待远端状态」。这一步它为这条请求排 0 个 token，worker 可以继续算其他请求。若整步没有本地 token，通常进入连接器的无前向路径；固定 runner 在 external launcher 与 DP>1 的组合下还会先做一次陪跑，以保持 DP 协调，不能把“本请求等待”理解成整个 worker 必定不跑模型。
4. **D 拉，不是 P 推。** D 的后台线程拿着 P 的块号和地址，一次批量读回各层对应的块。它能直接读对面的显存，是因为两边启动时都把存 KV cache 的那段显存登记给了传输引擎。P 那边负责「发送」的线程其实不发数据，只回答 D 要的元数据，并记下「对面收完了」。
5. **D 通知 P 收完。** 读完之后，D 给 P 发完成信号；读失败也照样发，免得 P 的块一直押着。P 收到后才真正放掉源块；一直等不到信号的情形见后面「抢占、失败和超时」。
6. **D 上的请求回到队列，接着算。** 状态到位后，请求回到等待队列；下一次被排上时，先算完还差的提示词位置、采样首 token，然后进入 decode 循环。

用一个示意的小例子把块号走一遍：一条 4 个 token 的提示词，记作 p₀–p₃；这里假设一块只装 2 个位置，模型是纯注意力模型（混合模型的差别见下一节）。块号 7、12、3、5 都是编的。

| 位置 | 在 P 上存在 | D 分到的目的块 | 第 4 步读的方向 |
| --- | --- | --- | --- |
| p₀、p₁ | P 的第 7 块 | D 的第 3 块 | P#7 → D#3 |
| p₂、p₃ | P 的第 12 块 | D 的第 5 块 | P#12 → D#5 |

第 2 步交还给代理的是 P 的块号 [7, 12] 和 P 的显存地址；第 3 步 D 从自己的块池分到 [3, 5]；第 4 步后台线程按位置把 P#7 的内容读进 D#3、P#12 读进 D#5；第 5 步 P 收到完成信号，才把 7 号和 12 号块放回自己的块池。**块号是各自块池里的编号**，P 的第 7 块和 D 的第 7 块是两块不同的显存，D 不能直接拿 P 的编号当本地编号；块号怎样对应到显存，见[块表](block-table.md)。

**「请求结束」和「块可以回收」是两件事。** P 上的请求在第 2 步就结束了，块却押到第 5 步；D 上的请求在第 3 步就占了块，要到第 6 步才开始算。等的只是这一条请求：两边的主循环照常跑别的请求，调度器不会因此停下。

下面把表中的 P#7 → D#3、P#12 → D#5 放回两组实例的显存里。每块保存两个位置，K、V 各用两个示意通道；按块依次播放便于追踪，不表示真实网络逐包串行传输。最后观察完成信号何时允许 P 释放源块。

```wiki-scene
inference-mechanism:2
```

## 交接点停在哪个位置？

**交接点取决于模型要保存哪类状态：纯注意力模型由 P 算满整段提示词，D 退回 1 格、重算最后一个位置；带递推状态的混合模型由 P 故意少算最后 1 个位置，D 从那里接着算。两种情形都由 D 算出首 token。**

```wiki-diagram
file: pd-state-boundary
```

图里用的是 [R1](one-request.md#示例请求-r1-与官方双机部署)：本站贯穿的示例请求，提示词也是 4 个 token，记作 p₀–p₃。

**纯注意力模型：P 算满，D 退回 1 格。** 这类模型每层只存每个位置的 K、V，任何一格都能单独读写。P 把 4 个位置全算完，交出 4 格 K/V。D 收到后，提示词整段都已命中，但采样需要最后一个位置的输出，K/V 里没有这个输出；vLLM 的调度器遇到「整段命中」，就把已算位置退回 1 格，让 D 重算 p₃。P 当时采出的那个 token 会随交接信息带过去，但 vLLM 和 vllm-ascend 里都没有读它的地方。所以 p₃ 这一格实际算了两次，这条请求的前向次数比混部多一次。

**混合模型：P 少算最后 1 个位置。** KDA 这类层存的是「处理完前面所有位置之后」的一份递推状态，它把历史压成固定大小，没法把最后一个 token 的影响再减掉。如果 P 算满 4 个位置，D 就拿不到「处理完 3 个位置」的状态，也就没法重算 p₃ 的输出。所以连接器发现模型带这类状态时，在 P 上把提示词的最后一个 token 去掉：P 只算 p₀–p₂，交出状态 S₃（下标表示处理过 3 个位置，不是第 3 层）；D 把远端命中记为 3 个位置，自己用 p₃ 在 S₃ 上算出 S₄ 并采样首 token。这样没有哪一格被算两次；P 仍会采样 1 个 token 以便按长度上限结束，这个 token 同样没人用。P 上的截断只做一次：请求在 P 上被抢占、重新排队时，不会再截第二次。

截断还受长度条件约束：只有提示词多于 1 个 token 才删除末位置，D 的远端命中计数也用同一道长度条件。单 token 提示词不走这里的 N−1 截断，不能由四 token 算例推断它已正确恢复递推状态；该边界需要单独的端到端验证。

## 抢占、失败和超时怎么处理？

**默认Mooncake V1不会在抢占后自动重拉同一次P交接的状态。** 请求恢复时要重新找可用缓存；没有本地或外部副本，才在D补算缺失部分。保存状态或由代理重投P是另配的路线。传输失败则默认让请求报错结束，模型与平台允许「重算」策略时才补算未收到的部分；P押块还有超时限制。

抢占是块池不够用时调度器的退路：默认从running队尾选一条，其他策略的顺序见[调度器](vllm-scheduler.md)，归还设备块、清零已算位置、排回等待队列。Mooncake V1在第一次为请求分好目的块后就关掉远端标记；原交接完成后P也已释放源块，不能假定同一份状态还能重拉。重新调度仍会查本地前缀与配置的其他缓存；有可用状态就复用，无可用副本才补算。另配[CPU缓存备份](kv-cache-cpu-offload.md)可从主机恢复；[RecomputeScheduler](recompute-scheduler.md)可在条件满足时选择抢占保存或让代理重投P，各自有版本与模型限制。

这里的 V1 传输失败时，D 把没读成的目的块标成无效，并照样通知 P 放块。vLLM 对这种情况有两种策略：默认是「失败」，这条请求带着错误结束；模型与平台允许改用「重算」时，调度器保留已经成功读到的部分，其余位置在 D 上重新算。本页 GLM 是混合模型，固定镜像在启动校验中拒绝此策略。

换用 V2 要另核失败上报。早期社区主干的多缓存组失败只有告警，仍会报接收完成；v0.30.0 与当前 main 才提供按请求汇合的失败结果，再交给失败策略处理。**完成通知不能单独证明传来的状态可用。** 执行链和版本区别见[Mooncake V2 的失败与释放](mooncake-connector.md#v2-的接收完成是否代表读成功)。

P 这边，交接后押着的块一直占着 P 的块池，直到 D 报告收完；D 始终不报告时，P 在超时（默认 480 秒）后强制释放，并打一条错误日志。这段时间里，P 能接的新请求相应变少。

一次交接也不等于一条消息或一次拷贝。D 的读取按 P 的各个 rank 和各个缓存组拆开，每组再列出各层的地址；P 的计算、源块等待、D 的目的分配和网络读取之间，既会重叠，也会互相等待。没有设备时，先拿一条请求跟一遍：它的状态此刻在 P 上、在网络上还是在 D 上，哪边的块还押着。评估一套 PD 部署，要分别看首 token 延迟、生成间隔、吞吐、每次交接的字节数和源块押住的时间，本站没有这些实测数。

## 带图像的请求：再把编码器分出去（EPD）

**E（Encoder）分离把图像等媒体的编码放到独立的资源上，再把编码结果交给后面的语言模型推理。**（独立 E 池架构、ECMemcacheConnector 与 AscendECMooncakeConnector 等专页细节见 [EPD 分离](epd-disaggregation.md)。）带图像的输入要先由视觉编码器转成语言模型能用的表示。EC（Encoder Cache）保存的就是这类编码结果；KV cache 和 KDA 状态则是语言模型各层计算时才形成的历史。两者的阶段、形状、身份与复用条件都不同，传了图像 embedding 不等于迁移了语言模型的历史。

两种形态要分清。**E+PD** 只把媒体编码分出去，prefill 与 decode 仍在同一个实例；**E+P+D** 在此基础上再分离 P、D，因此还要解决语言模型状态的交接。第一种不依赖 P→D 的 KV 传输，不能因为某个模型的 PD 组合没有实测，就判定所有编码器分离形态都不能用。示例代理先调用 E，再视配置决定是否调用独立的 P，最后进入生成。E、P、D 同样是职责名，不保证每类恰好一台机器或一个进程。

编码结果怎样避免重复计算：Ascend 的 model runner 判断自己是 EC 生产者时，只执行多模态编码就返回，相应的 KV cache 规格为空。上游调度器遇到外部编码缓存命中时，不再扣减本地的编码计算预算。省下的是重复的编码工作；输入长度、目的表示占的显存和语言模型的计算都还在。GLM 的模型构造同时标记了视觉组件与语言模型组件；本站主线走纯文本路径，不需要先经过 E。

「执行了什么」和「加载了什么」要分开：E 不跑语言模型前向，不等于启动时没有分配语言模型权重。示例脚本没有显式打开只跑编码器的模式；上游的这个模式配合模型组件标记，可以跳过语言模型组件的初始化。所以「E 必须再加载一份完整语言模型」不是 EPD 的机制要求，实际占多少显存，取决于模型是否接入相应标记、启动选项、加载器和运行版本。

ECExampleConnector 只是调试用的磁盘实现：它把编码张量存到共享位置，消费者再读到自己的设备上；缓存文件按媒体内容的 hash 组织，不以请求 ID 作唯一键。两台机器上目录同名，不表示内容自动共享；复用同一份结果，还需要共享存储、兼容的编码器与预处理配置，以及正确的缓存身份。其他连接器可以用别的传输与存储方式。

独立的 E 可以按媒体负载扩缩，让文本请求与视觉编码分开规划资源，也为编码结果复用提供了入口；代价是编码排队、结果的存储与传输、消费者加载、故障恢复以及跨服务的身份管理。值不值得分离，要看媒体请求的比例、编码耗时、结果大小和复用率。

### 重复图片也可以只在本机缓存编码结果

编码器缓存不必伴随独立 E 服务。另一个用途是在同一台主机保存已经算过的编码结果：第一次看图片 A，NPU 编码后把结果存入共享主机内存；下一次遇到相同缓存身份的 A，把结果读回 NPU，跳过编码计算，再继续语言模型。示意地说，三次复用同一图片可以由“编码三次”变为“编码一次、恢复两次”，是否省时间取决于编码与传输谁更贵，不能直接等同于三倍提速。

Ascend 的 **ECCPUConnector** 走这条本机路径。它把编码结果放进共享 mmap，即多个进程映射同一个主机内存区域；再将这些页注册为固定主机内存，以支持设备异步传输。TP/PCP 中只由指定的零号 rank 保存重复结果，消费者各自把需要的结果恢复到本地 NPU。共享主机载荷并不意味着所有 NPU 共用同一份设备张量。

这与 EPD 的跨服务交接分别解决不同问题。该连接器只支持单主机共享内存，不支持跨节点或 NIXL/P2P 传输；把同样的共享目录路径写在两台机器上不能把它变成远程编码器服务。其主机容量也须与 [Engram 表](deepseek-v4-1-flash.md#engram-为什么把另一笔内存账放到主机上)及 KV pool 分开核算，三者保存的是不同对象。

**缓存管理器决定留谁、淘汰谁，连接器负责数据怎样保存和恢复。** Score Encoder Cache Manager 用条目得分与老化策略管理 CPU/NPU 两层编码缓存。CPU 容量按 embedding 槽位数配置，连接器的 mmap 则按字节预算，两者不能直接用同一个数字互换；图片分辨率等变化会改变实际槽位和字节需求。

## D 还在排队，P 的块能保留多久：NIXL 租约

前面的 Mooncake V1 用超时兜底释放源块。上游 **NixlConnector 的拉取路径**采用另一种办法：P 先给这条请求的 KV 一段较短的保留时间，D 只要仍需要它，就定期通知 P 延长时间。这段保留时间叫 **租约（lease）**。它解决一个两难：超时太长，D 故障后 P 的缓存迟迟不能回收；超时太短，健康的 D 可能仅因排队就丢失已经算好的状态。

以本页固定上游基线的默认值为例，P 完成 prefill 后先保留 30 秒；D 收到带有完整远端定位信息的请求，**进入 waiting 队列时就开始跟踪续约**，不用等到请求真正获准前向。调度步约每隔 5 秒把需要续约的请求按 P 实例合并，worker 用 NIXL 通知发送心跳。收到心跳后，P 将到期时刻更新为下式（不是每收到一次就在旧到期时刻上累加 20 秒）：

$$t_{\text{expire}}' = \max(t_{\text{expire}},\; t_{\text{hb}} + 20)$$

| 租约参数与示意事件（默认初始租约 $30\text{ s}$） | 推导算式 | 结果（秒） |
| --- | --- | --- |
| 心跳间隔 | $\lfloor 30 \div 6 \rfloor$ | **5 s** |
| 续约窗口 | $\lfloor 30 \times 2 \div 3 \rfloor$ | **20 s** |
| 在 $t=5\text{ s}$ 收到心跳（旧到期 $30\text{ s}$） | $\max(30,\; 5 + 20)$ | **30 s** |
| 在 $t=15\text{ s}$ 收到心跳（旧到期 $30\text{ s}$） | $\max(30,\; 15 + 20)$ | **35 s** |

沿着这个到期时刻看，D 继续等待、读取完成和失联，会走不同的保留或释放分支：

| 发生的事 | P 如何处理源块 | D 的状态 |
| --- | --- | --- |
| D 在排队，但持续发来心跳 | 延长这条请求的租约 | 暂时不能计算，源块仍保留 |
| 所需消费者都通知读取完成 | 释放源块，不再等满租约 | 已取得自己的缓存，继续计算 |
| D 失联，且租约到期 | 执行循环发现到期后回收 | 原远端块不再保证有效 |

心跳发送、处理和到期检查都依赖执行循环。首次连接还可能先做握手，长前向也会推迟处理；因此“5 秒”和“20 秒”描述配置推导出的节奏，不能当成故障后严格的墙钟回收上界。这里也不能套用 Mooncake V1 的 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT=480`：两套连接器的回收协议不同。

### 交接定位信息以后，D 还需要原来的输入吗？

**需要。远端地址和块号告诉 D 去哪里取状态，不会替 D 重建输入 token。** 对上游 NIXL 的普通文本拉取路径，D 仍按自己收到的提示词长度计算可命中的位置数；整段命中以后，调度器会留最后一个位置重新计算，以便产生下一个 token。该位置的输入仍来自 D 自己的 token 序列。因此路由层应保留与 P 计算状态对应的输入，不能把 D 的 prompt 随意改成占位文字。

例如，P 为示意序列 `[a, b, c, d]` 算好了四个位置。D 收到同一序列时，命中数是 4，留出的最后位置是从 0 数起的第 3 位，输入为 d。若 D 改收到 `[a, b]`，它会按 2 个位置记命中，留出第 1 位并输入 b；携带同一组远端块号并不能把这条请求恢复为原来的四 token 输入。这个例子说明输入与缓存的对应关系，不是传输性能测量；混合递推模型还须遵守各自的末位置截断规则。

### 下一轮对话能否读回 D 已经算好的历史

首轮回答生成的那些 token 已经在 D 上形成 KV。下一轮若让 P 从头重算，就浪费了这部分工作。NIXL 的双向传输允许 **P 先从上一轮 D 读回仍有效的历史，再算新输入；随后当前轮 D 再从 P 读取需要的状态**。两次传输方向不同，但都由需要数据的一方发起读取。

| 阶段 | 状态在哪里 | 代理保存什么 |
| --- | --- | --- |
| 首轮 P 完成、D 开始生成 | P 暂留提示词状态，D 拉入后继续生成 | P 返回的交接信息 |
| 首轮 D 结束 | D 暂留本轮已计算的块 | D 返回的引擎、地址、块号等 `kv_transfer_params` |
| 同一对话下一轮到达 | P 按信息从原 D 读回可复用部分，再算新增输入 | 将上一轮定位信息交给 P |
| 下一轮继续生成 | 当前 D 拉取 P 的结果，更新本轮历史 | 保存新的 D 定位信息供后续轮次使用 |

代理存的是**如何找到缓存**，设备上的 KV 仍由 D 持有。固定官方多轮代理以 `conversation_id` 为键，实际使用 450 秒的记录寿命，并在取出时删除这条旧记录；D 自己的块默认保留 480 秒。这个 480 秒是等待用户下一轮输入的固定 TTL，**不由上面的 P 租约心跳续约**。代理记录命中也不能单独证明远端块仍有效。

还必须保证新提示词确实复用了相同位置上的 token 历史。例如 D 生成了 `<think>…</think>`，客户端却在下一轮删掉这一段，后面的 token 位置就变了；换了聊天模板也可能改变前缀。示例代理只按对话 ID 找定位信息，不逐 token 证明前缀一致。路由层必须处理这种不匹配，不能仅凭同一个 `conversation_id` 直接复用。这个字段是示例代理的扩展，进入引擎前会被取走。

**这些是上游 NIXL 的机制与条件，不能直接替换本站 GLM 的 Ascend Mooncake 配方。** 固定使用指南把上述双向能力限定在 CUDA、设备缓存；模型、注意力后端、并行布局和安装的传输后端还须满足相应兼容条件。本页没有 NIXL 在昇腾上的部署实测。

## 放到 GLM 双机：拆开会怎样？

**本站主线是混部，这一节用主线的事实和配置换算，回答四件事：prefill 在这套部署里具体拖慢了什么；GLM 要一起交接哪些状态；钉住版本的连接器在 GLM 上有什么问题；把这两台机器直接拆成一 P 一 D 会怎样。** 这里没有 PD 实测数。

### 混部时，prefill 在这套部署里拖慢了什么

**在这套部署里，prefill 插进来的代价是：这一步不能回放录好的 decode 图；提示词一长，两台机器的 MoE 通信还会从快路径换到慢路径。**

先说两个词。**decode 图（graph mode）** 是启动时把固定大小的一步前向录下来，之后遇到同样大小的纯 decode 步就直接回放，省掉逐个下发算子的开销；不回放、逐个下发算子的执行方式叫 **eager**。**MoE 通信** 是 GLM 的 MoE 层把每个 token 送到持有它所选专家的卡上、算完再收回来的那一步；昇腾上有两种做法，**MC2** 在专家布局及 token 容量满足条件时协同执行计算和通信，短 prefill 也能走它；**AllGather** 先把各卡的 token 拼成完整一份再各取所需。

这套部署启动时只录了 7 个尺寸的 decode 图，最大 128 个 token，正好是 32 条请求 × 每条每步 4 个 token（1 个确认 token 加 3 个 MTP 草稿），见[部署页的启动一节](glm-5-3-flash-two-node.md#启动时发生了什么)。纯 decode 步落在这些尺寸里，就回放录好的图。一旦有提示词混进来，这一批就不再整齐，只能走 eager；混进的提示词一长，本步 token 数超过 128，两台机器的 MoE 通信还会一起从 MC2 换到 AllGather，详见 [prefill 页的混合步](prefill.md#长提示词和多条请求prefill-混进-decode-批以后)。PD 分离想做到的，就是 D 上只剩纯 decode 步。

### GLM 要一起交接哪些状态

**GLM 要交的不只是 K/V：12 层 MLA 的潜向量和 indexer 缓存按位置存，indexer 尾状态只留最近几个位置，34 层 KDA 的递推与卷积状态每条请求一份。它们分在 5 个缓存组里，交接时必须停在同一个位置边界上。** 各类状态有多大，见 [KV cache 页](kv-cache.md#混合模型到底要保留哪几类状态)。

这里的 MLA 是 GLM 的稀疏注意力层，每个位置存一条压缩过的潜向量；indexer 是它用来挑「该看哪些历史位置」的小模块，每 4 个位置压成一条存下来，最近还没凑满 4 个位置的那几条单独存成「尾状态」。连接器按缓存组分别决定传哪些块：

- **按位置存的组**：MLA 潜向量与 indexer 缓存同在一个 full 组，按提示词长度算出要传几块，MTP 多留的块切掉。
- **按窗口滑动的组**：indexer 尾状态所在的组，只传窗口末尾那几块。
- **递推状态组**：3 个 KDA 组的调度元数据保留该请求的块号，不按提示词位置裁剪；worker 实际只选择当前有效状态槽，再按状态张量地址搬运，不把 MTP 候选槽全部传一遍。

只传 MLA 潜向量接不上一条 GLM 请求：indexer 的历史和尾状态、KDA 状态必须和它停在同一个位置，D 才能接着算。因此两边除了模型相同，还要对上权重版本、层与缓存组的对应关系、数据类型与内存布局、两边的并行切分，以及「算到了第几个位置」。两边都叫 GLM、块数一样，并不能说明状态可以互用。

GLM 的 3 个 KDA 组在调度器里都是递推状态组，所以连接器对 GLM 走上一节的截断路径：P 少算最后 1 个位置。对这类状态组，连接器还要求 P 的 TP 不小于 D 的 TP，并且能被 D 的 TP 整除。

### 钉住版本里，长提示词交接时 full 组会少传块

**按钉住版本的源码静态阅读（本站没有实测），GLM 的提示词超过 641 个 token 时，连接器给 full 组算出的块数就开始少于应传的块数：刚过这个长度时只传一半，提示词越长，越接近只传四分之一。** 这是读源码得出的结论，不是 PD 的实测现象；传少以后 D 端是先报错还是静默错位，见本节后文。

原因在压缩比。GLM 把 MLA 主缓存和 indexer 缓存放进同一个 full 组、用同一套块号，一块都代表 640 个位置；indexer 只是在块内把每 4 个位置压成一条存，压缩比 4，MLA 主缓存的压缩比是 1。一块多少个位置见[部署页的逻辑块一节](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。连接器给每个组算「一块代表多少个位置」时，把组里各类缓存的压缩比依次读一遍，最后留下的是 indexer 的 4，于是把一块当成 $640 \times 4 = 2{,}560$ 个位置，再按这个数截取要传的块（以 2,000 个 token 的示意提示词为例）：

$$N_{\text{P}} = 2{,}000 - 1 = 1{,}999\text{ 个位置}$$

| 口径（示意提示词 $2{,}000$ token） | 块数算式 | 结果与后果 |
| --- | --- | --- |
| 实际应传（每块 640 位置） | $\lceil 1{,}999 \div 640 \rceil$ | **4 块** |
| V1 实现算出（误乘压缩比 4，每块 2,560 位置） | $\lceil 1{,}999 \div 2{,}560 \rceil$ | **1 块**（若走到截齐，D 只读回第 1 块，后 3 块目的块未写入） |

D 端在同一个函数里先做一道检查：P 报来的块大小要能被 D 自己的算子块大小整除，然后才把两边的块号截成较短的一边。按钉住版本，P 报来的块大小是各缓存组里最小的那个（GLM 是 4）；这道检查会不会先报 AssertionError，取决于 D 的 worker 进程里块大小被改成了多少，只读源码定不下来，缺的是一次双机实际运行（见页末待核）。如果检查通过，D 就拿自己分到的 4 块和 P 报来的 1 块截齐，截齐这一步不报错；D 的调度器仍按「1,999 个位置已算好」往下走，后面那 3 块里的历史没有写进去，成了一种不报错的错误状态。提示词不超过 641 个 token 时，P 交出的位置不超过 640 个，两种算法都是 1 块，不受影响。

支持矩阵在 main 分支把 GLM-5.3-Flash 的 PD 分离一栏标为支持，但整个模型仍标为实验性支持；PD 设计文档的规格表里也只列了 MLA 和 GQA 两类注意力。结合上面这处实现，GLM 在钉住版本上走 PD 不能当成「能正常交接」。

### 把这两台机器拆成一 P 一 D

**最直接的拆法是一台做 P、一台做 D。那样每个实例只剩 8 张卡，正好退回部署页里「单机 8 卡」那一列：每卡要放 36 个路由专家，MoE 也用不上本配方的 MC2。** 只按部署页所列语言权重子账计算，KV 块数从 3,908 个降到 1,577 个；两者尚未扣视觉塔、旋转矩阵和量化辅助张量等，不是实际容量或 PD 测试结果。

路由专家是 MoE 层里供每个 token 挑选的那批专家，GLM 每层有 288 个。主线的两台机器用 EP16 把它们摊到 16 张卡上，每卡 18 个，两台合起来才是一份完整模型。拆成两个实例以后，P 和 D 各自都要装下完整模型，EP 规模变成 8。[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)已经按同一组假设算过这一列：所列语言权重子账约 38.72 GiB/卡（双机 EP16 时约 20.58 GiB），在该子账下得到 KV 块 1,577 个（双机 3,908 个）。而 A2 上本配方的 MoE 选 MC2 要求 EP 至少 16、每卡专家不超过 24，EP8 两条都不满足，进入 AllGather 路径。

所以在这两台 A2 上做 PD，D 虽然只剩纯 decode 步，却连主线 decode 步用的 MC2 也用不上了，块数也不到原来的一半；P 上的块还要押到 D 读完才放。常见的 PD 部署会给 P、D 各配多台机器，让每一侧仍保持足够大的 EP 规模，那是另一套硬件规划，本站没有对应的数字。

入口也跟着变。主线里，node0 上的 API server 为新请求挑一个 DP 执行组，两组靠一个协调进程同步「还有没有活」（见[部署页](glm-5-3-flash-two-node.md#启动时发生了什么)）。PD 分离下，P 和 D 是两套各自启动的服务，由外面的代理挑一个 P、一个 D，并在两次转发之间传递交接信息。

可用主线算例理解失去状态的代价：约67,000个位置的请求被抢占后，34层KDA状态随块一起失去，在主线无缓存复用的配置下要重算约9步，推导见[并发页的KV块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。改成1P1D后须按D的每步预算、可用缓存和恢复路线重新计算，不能直接沿用9步；原P交接也不会自动再来一次。

想把 PD 交接放回完整服务，可以接着看 [DeepSeek 生产案例](deepseek-serving-case.md)：图片编码、缓存读取、请求分流和交接各自在哪里等待。

## 常见误解

- **「官方双机的两台机器就是一 P 一 D。」** 它们是两个 DP 执行组，各自既做 prefill 也做 decode；启动配置里没有 KV 传输这一项。
- **「支持矩阵写了支持，本站部署就用上了 PD，而且能正常交接。」** 矩阵说的是可以开；官方 GLM 双机教程没有开。按钉住版本的源码，GLM 提示词超过 641 个 token 时 full 组的交接块数还会算少。
- **「P 算完会把 KV 推给 D。」** Mooncake V1 是 D 按地址去读，P 的「发送线程」只回答元数据、记录收完。要 P 主动推，得换成逐层推送的连接器。
- **「P 采出的第一个 token 会交给 D 用。」** 它随交接信息带过去，但没人读，D 自己算出最后一个位置再采样。对 GLM 来说，P 采样时最后一个提示词位置都还没算。
- **「D 上这条请求没排 token，是调度器空转。」** 它在等连接器搬入远端状态；同一个 worker 仍可算其他请求。全步没有本地 token 时可以走连接器无前向路径，特定 DP 启动方式还需要陪跑协调。
- **「P 唯一的那个 token 抽到结束符，交接就会悄悄失效。」** 示例代理同时把最少生成数设成 1，vLLM 在没生成够最少数之前会屏蔽包括结束符在内的所有停止 token，Ascend 的采样路径也经过这一步，所以这一步抽不到结束符。只有自定义代理漏设最少生成数、而那个 token 恰好是结束符时，P 的请求才会以「正常说完」结束：交接信息为空，代理照常转给 D，D 把整段提示词自己算一遍，结果仍然正确，P 白做一次 prefill。
- **「角色写成『两边都当』最省事。」** Mooncake V1 只认「生产者」「消费者」两种写法；写成两边都当，启动不报错，请求却一直等不到「传完了」。main 分支的新连接器在初始化时就拒绝这种配置。
- **「P 算 N 个位置，D 总要再多算 1 个。」** 那是这里的纯注意力路径。GLM 这类混合模型在提示词多于 1 个 token、走截断路径时，由 P 少算最后 1 个位置，没有哪一格算两次；单 token 的状态恢复另需验证。
- **「拆开以后一定更快。」** 本站没有 PD 实测数；在这两台机器上直接拆成一 P 一 D，每个实例还会失去 MC2，块数不到原来的一半。

## 对照源码

### 怎么开

PD 分离靠 vLLM 的 `--kv-transfer-config` 打开：P、D 各起一套服务，前面再放一个代理。连接器没有默认值，`kv_connector` 必须显式写；设计文档用 Mooncake V1 作示例。下表列出连接器配置；完整启动命令还要分别确定两端的模型、并行布局、执行模式和资源预算，不能只改角色与端口：

| 键 | P 实例 | D 实例 | 说明 |
| --- | --- | --- | --- |
| `kv_connector` | `MooncakeConnectorV1` | 同左 | 连接器注册名 |
| `kv_role` | `kv_producer` | `kv_consumer` | 只能二选一，不要写 `kv_both` |
| `kv_port` | 握手端口基址 | 同机时与 P 错开 | 实际端口在基址上按 rank 往上加；同机两个实例必须错开 |
| `kv_connector_extra_config` | `prefill`、`decode` 两段都写 `dp_size`、`tp_size` | 同左 | 描述的是两边各自的并行规模，D 要按 P 的 TP 算一块分几次读 |

固定 V1 还读取两段中的 `pp_size`，省略时为 1；D 的 PP 必须为 1，且同一 worker 不允许 PP 与 PCP 同时大于 1。P 开 PP 后还要对齐阶段与层的分配，具体参数及版本条件见 [PP 的 P/D 配置](pipeline-parallel.md)。这些字段描述传输双方，不能用它们代替实际的并行启动参数。

- 官方 Mooncake 多机教程提醒：昇腾上的传输会在 `[20000, 20000 + 每机卡数 × 1000)` 里随机占端口，每机 8 卡时 `kv_port` 建议不低于 28000，否则启动时偶发 `zmq.error.ZMQError: Address already in use`。
- 代理用 `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`：发给 P 的请求带 `do_remote_decode=True`、`max_tokens=1`、`min_tokens=1`；P 返回的 `kv_transfer_params` 原样放进发给 D 的请求，P 没返回时就不放。
- 官方示例还带着 `--no-enable-prefix-caching`，代码并不要求：D 要读的位置数是「远端算好的位置数 − 本地已算的位置数」，本地命中会被减掉。GLM 这类混合模型本来默认就不开 prefix caching。
- 读取失败怎么处理由上游 `kv_load_failure_policy` 决定：默认 `"fail"`；模型与平台允许时可改成 `"recompute"`。本页固定 GLM 镜像的校验明确拒绝混合模型使用后者，不能把它作为 GLM 的可用退路。
- V1 之外，vllm-ascend 还注册了逐层推送的 `MooncakeLayerwiseConnector`（P 每算完一层就往 D 推一层，逐层传输见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)）和 `MooncakeHybridConnector`。它们和 V1 同属点对点一类：把一条请求的状态送给指定的 D，PD 分离走这一类。另一类是池：`AscendStoreConnector`（另一个注册名是 `MooncakeConnectorStoreV1`）按内容把块存进大家都看得见的外部存储，见 [KV Pool](kv-pool.md)；`RecomputeCPUOffloadConnector` 在请求被抢占时把 KV 存进主机内存，见 [Recompute CPU Offload](recompute-cpu-offload.md)。

**NIXL 使用自己的连接器配置。** P 选择 `NixlConnector` / `kv_producer`，D 选择 `NixlConnector` / `kv_consumer`；下面各键放在 `kv_connector_extra_config`，不是上表 Mooncake 的 `prefill` / `decode` 拓扑描述：

| 键 | 默认值 | 控制什么 |
| --- | --- | --- |
| `kv_lease_duration` | 30 秒 | P 初始租约；心跳间隔和续约窗口分别由它的 `// 6`、`× 2 // 3` 推导 |
| `bidirectional_kv_xfer` | `false` | 两端都开启，才按双向复用配置运行；还需要能传递上一轮 D 定位信息的代理 |
| `decoder_kv_blocks_ttl` | 480 秒 | D 为后续对话保留块的时间，不随 P 的心跳续约 |
| `kv_recompute_threshold` | 64 token | P 本轮还需从 D 读回的 token 少于该值时直接重算；等于 64 不被这道门槛拦下。它不是全部 P→D 传输的门槛 |

官方示例代理入口是 `examples/disaggregated/disaggregated_serving/disagg_proxy_multiturn.py`。没有对话 ID 或取不到旧定位信息时，它按无远端历史转发给 P；完整部署还需要可达的 side-channel 地址、传输网络与相容的两端缓存布局，不能只加双向开关。

本机编码器 CPU 缓存使用另一组 `--ec-transfer-config`，不要放进语言模型的 `--kv-transfer-config`。2026-11-02 官方快照要求 Model Runner V2、Linux 内核高于 5.10，以及支持 `aclrtMemcpyBatchAsync` 和 `aclrtHostRegisterV2(..., ACL_HOST_REG_PINNED)` 的 CANN。配置片段如下，1 GiB 只是主机编码缓存预算示例：

```json
{
  "ec_connector": "ECCPUConnector",
  "ec_role": "ec_both",
  "ec_connector_extra_config": {"ec_cpu_bytes": 1073741824}
}
```

`ec_cpu_bytes` 必须是正整数且足够放至少一个块，`/dev/shm` 也须有足够容量。这里 `ec_both` 是该 EC 连接器的支持角色；不能由它推断上文 Mooncake V1 的 `kv_both` 可用。固定主机内存注册或批量拷贝能力不满足时初始化会明确失败，不会悄悄退回普通内存或逐次拷贝。

Score 管理器通过 `--ec-manager-config` 选择类名 `vllm_ascend.ec_manager.score_ec_manager.ScoreEncoderCacheManager`，不另设 enabled。其 `manager_config` 默认是 `cpu_cache_slots=100000`、`max_clock=15`、`clock_decay_every=64`、`watermark=0.2`、`promote_percentile=0.2`：分别管 CPU 槽位容量、老化上限、每多少请求老化一次、淘汰后希望留出的 NPU 空闲比例及晋升评分阈值。管理策略不自动证明 connector 或模型支持；先核两者配置和容量，再比较重复媒体的命中、编码次数与恢复耗时。

### 会报什么错

- **缺 `prefill` / `decode` 里的 `tp_size` 或 `dp_size`**：worker 初始化逐个断言，启动即 `AssertionError`。
- **P 的 TP 小于 D 的 TP**：`ValueError: prefill_tp_size: ... must be greater than or equal to the decode_tp_size: ...`。设计文档的限制更严：TP 不相等时只支持 P_tp > D_tp 且能整除；P、D 也不能是异构硬件，比如 P 在 A2、D 在 A3。
- **KDA 这类递推状态组的 TP 不匹配**：断言 `Mamba prefill TP size must be >= decode TP size.` 或 `Mamba prefill TP size must be divisible by decode TP size.`。
- **`kv_both` 配 Mooncake V1** [!]：上游把 `kv_both` 同时算作生产者和消费者，但 V1 判断角色用字符串相等，`kv_both` 落进「只起接收线程」那一支，完成上报的两个集合都是空的。启动正常，请求永远等不到「传完了」，排查时只看得到请求卡住。main 的 `MooncakeConnectorV2` 在初始化时就拦下：`ValueError: Mooncake scheduler requires exactly one KV transfer role, got 'kv_both'`。
- **GLM 长提示词少传块**：`_get_group_transfer_info` 对 full 组取到压缩比 4，`tokens_per_block` 成了 2,560。D 端 `_get_kernel_block_ids` 先断言 `remote_block_size % kernel_size == 0`（`#L2602-L2604`），再用 `min(len(kernel_remote), len(kernel_local))` 截齐；截齐这一步没有报错或日志提示，前面那道断言会不会先失败见下方待核。
- **收发线程起不来**：线程已退出报 `RuntimeError: KV Cache sending/receiving thread failed to start.`，5 分钟内没就绪报 `RuntimeError: Timeout waiting for KV Cache thread to be ready.`。
- **读取失败**：日志 `Mooncake transfer failed for request...`，随后按 `kv_load_failure_policy` 处理；默认策略下请求以 `FINISHED_ERROR` 结束。
- **P 押块超时**：日志 `Force freed expired request: ...`，阈值是环境变量 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT`，默认 480 秒。
- 以上都是源码里的检查点，没有在双机上实际触发过。

### 开销和什么时候别开

- **交接本身。** 每次交接搬的是提示词对应的各组状态，传输期间 P、D 各占一份；D 的日志 `KV cache transfer for request ... took ... ms` 记录每次读取的耗时，可以拿来量这一段。
- **重复工作。** 本页纯注意力路径多算最后一个位置一次；混合模型在提示词多于1个token、走截断路径时不重复算位置，但P仍采样一个没人用的token。D上抢占后的工作量取决于恢复路线与缓存命中；无其他保存或退回路线、也无可用缓存时，才在D重算全段。
- **本站这两台机器别直接拆。** 拆成一 P 一 D 后每个实例退回 EP8：每卡 36 个路由专家、KV 块 1,577 个、MoE 走 AllGather，换算见[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。这是配置换算，不是实测。
- **钉住版本上 GLM 别拿长提示词走 PD。** full 组的交接块数会算少，见上一小节。
- **负载本身适合混部时别开。** 提示词短、并发低时，prefill 插进来的代价小，多出来的交接、代理和押块反而占大头。

### 版本差异

上游 NIXL 的读回保护也在演变，下表只比较其拉取路径，和下方 Ascend Mooncake 表分别使用。`84030bbe` 是本站固定的上游 main 比较点，不据此认定它就是每个 Ascend main 镜像安装的上游版本。

| NIXL 条件 | v0.23.0（0fc695fc） | v0.26.0rc 配套（568afb3a） | v0.30.0 配套（ced6857a） | main 比较点（84030bbe） |
| --- | --- | --- | --- | --- |
| D 返回跨轮块的到期时刻 | 未导出该字段 | 导出到期时刻 | 保留 | 保留 |
| P 开始读回前检查寿命 | 没有这道到期保护 | 转换远端时钟后，预留 5 秒；即将到期则拒绝读回 | 保留 | 保留 |
| 调度侧到 worker 的租约时钟 | 直接传到期时刻 | 同类路径 | 用剩余 TTL 换算到 worker 自己的时钟 | 同左 |
| 本表所说的连接器 | NIXL 拉取实现 | 拉取实现 | Pull 别名；不外推到 Push | 拉取实现 |
| D 的输入与交接信息 | 命中数读取 D 的 prompt 长度；交接字典不携带替代 prompt 的 token 序列 | 保留；拉取调度移到 `pull_scheduler.py` | 同 v0.26；新增拓扑字段不改变这一点 | 同 v0.26 |

跨轮到期字段名是 `remote_blocks_expiry_time`；`v0.30.0` 配套上游与历史 main 比较点另传 `scheduler_clock`，据此把剩余 TTL 换算到 worker 自己的时钟。这里的 `NixlConnector` 在基线指拉取实现，在 `v0.30.0` 配套上游是 `NixlPullConnector` 的别名，不把这些结论外推到 Push。

较新的到期保护仍依赖代理传回该字段；缺失时沿原读取路径继续。拒绝临近到期的读回会进入传输失败处理，能否重算由失败策略和模型条件决定，不保证一律自动恢复。**寿命检查也不检查 token 内容**，所以不能替代上面关于聊天模板和推理历史的一致性条件。

`v0.30.0` 与 `main` 已注册 `MooncakeD2RHConnectorV1`；固定官方文档快照 `921ccc52` 进一步说明其两跳关系：先把 P 的设备状态拉进 D 的主机内存，首跳完成后 P 可放块，D 分到设备块后再搬入计算。它改变源块占用与排队关系，也增加主机容量和第二跳搬运，机制及硬件入口见 [Mooncake 的 D2RH](mooncake-connector.md#先落到-d-的主机内存d2rh-改了哪段等待)。不能把“远端状态已经到主机”当成 D 已能开始前向。

**`v0.30.0` 系列的 GLM-5.3-Flash PD 配方已明确区分硬件和 P/D 拓扑。** A3 示例为 P 的 DP2/TP8 与 D 的 DP16/TP1；A2 示例使用两台 P 和两台 D，分别 DP2/TP8 与 DP8/TP2，不同于本站两机混部。该 GLM 教程要求 Model Runner V1，PCP=DCP=1；实验性的 SFA CP 在 TP 组内切 query，不等于打开 PCP 或 DCP。

连接器实现层面，`v0.30.0` 与 `main` 的 V2 不再沿用旧 main 的 PCP=1 强制条件。握手数据带 PP/PCP/DCP/TP 规模，按阶段与 rank 组织层名、组索引、块大小、形状、步长及地址；D 用这些远端信息和本地缓存规格一起决定读取 [C74][C75][C76]。`main (8d6180e2)` 进一步实现了 `MooncakePushConnector` 并让 `MooncakeConnectorV2` 按 `use_layerwise` 自动路由 Pull / Push，同时移除了注册表中的 `SimpleCPUOffloadConnector`。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
| --- | --- | --- | --- | --- |
| V1 主流程 | 按长度上限交棒、D 拉、完成信号放块 | 同 v0.23.0 | 主流程保留；另处理 D 入队前拒绝时释放 P 源块 [C78] | 延续 v0.30.0 |
| 混合模型截断（$N>1$） | P 少算最后 1 个位置 | 相同 | 仍只截一次；状态组另支持 align 模式按提示词位置选最终状态块 [C77] | 延续 v0.30.0 |
| full 组选块 | V1 按最后压缩比算跨度（无 GLM） | 同类 V1 代码（无 GLM） | V1 仍乘最后压缩比；V2 按组逻辑块与 DCP 规则裁剪 | 延续 v0.30.0 |
| `kv_both` 配 V1 / V2 | V1 按字符串选线程（不报错也不工作） | 同 v0.23.0 | V1 仍按字符串选线程；V2 初始化拒绝 `kv_both` [C69][C79] | 延续 V1/V2 校验 |
| 点对点注册入口 | V1、Hybrid、Layerwise | 另有 `SfaRemoteD2HConnector` | 同 v0.26.0rc + V2/Pull + `MooncakeD2RHConnectorV1` | 另增实现版 `MooncakePushConnector`，V2 按 `use_layerwise` 选 Pull/Push |
| 池及 offload 入口 | AscendStore、UCM、LMCache、SimpleCPU、Recompute | 同 v0.23.0 | 去掉 LMCache/Recompute，提供 AscendStore、UCM、Offloading、SimpleCPU、Preempt | 移除注册表中的 `SimpleCPUOffloadConnector`，保留其余入口 |
| GLM 支持矩阵与 `partial_prefills` | 无 GLM 行；文档明列 P 限制且平台重置非 1 值为 1 | 无 GLM 行；文档删限制，平台仍重置非 1 值为 1 | 实验性模型支持且 PD 勾选 [S80]；平台仍按非 1 值重置 [C81] | 延续实验性标注与平台非 1 值重置 |
| 配套上游的加载失败默认策略 | `fail` | `fail` | `fail`；不代表混合模型允许改用重算 [C82] | `fail` |

GLM 绑定镜像 `db701c1f` 是含模型代码的独立提交（不属于上表发布分支），其 V1 主流程、状态组选块、`kv_both` 及点对点/池注册入口与 `v0.23.0` 一致，但已包含 GLM 从而暴露 V1 full 组少传块问题。表中 V2 的选块结论只说明不再额外乘压缩比；本页 $N>1$、PCP=DCP=1 的算例因此修正该处块数，不能据此断言 D 端恢复或整条链路已通过。

- max_num_partial_prefills 那条限制从文档里删掉，并不表示放开了：四份 Ascend 快照的平台层都在发现该属性非 1 时才重置为 1，这和 PD 角色无关。正常 v0.23/v0.26 启动入口更早就拒绝非默认值；固定 main 的上游已删除该字段，平台用缺省 1 读取时不会再写入。入口先后、版本与完整参数参考见 [Scheduler](vllm-scheduler.md#怎么开)。
- LMCache 从 main 的注册表里去掉了：按 v0.23 或 v0.26 配 LMCache 的部署升到 main，会报连接器不存在。
- 上游 vLLM 的相关行为在 v0.23.0（0fc695fc）与 v0.26 分支一致：整段命中时退回 1 格重算，`kv_load_failure_policy` 默认 `"fail"`。

### 源码位置

- 本机编码器缓存的存储、传输、runner/CANN/内核约束见新增官方指南 [S70]；Score 管理器及配置单位见 [S71]。二者固定在 `921ccc52`，不反推旧 GLM 基线已启用，也不扩展为跨节点 EPD 支持。

| 看什么 | 固定源码位置 |
| --- | --- |
| P 何时交棒、打包什么 | vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926，request_finished |
| 按组裁剪、截断、D 侧命中与只拉一次 | 同文件 #L1666-L1849：_get_group_transfer_info、_get_transfer_block_ids、_truncate_request_for_prefill、get_num_new_matched_tokens、update_state_after_alloc |
| full 组里 MLA 与 indexer 交错、共用块号 | vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L210；main 为 vllm_ascend/models/glm5next/cache_config.py#L169-L176 |
| D 端先断言块大小、再按较短一边截齐 | 同连接器文件 #L2585-L2616：_get_kernel_block_ids |
| main 的 V2 按逻辑块算块数 | vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L84-L140；pull_scheduler.py#L610-L618；注册与别名见 `__init__.py#L49-L53`、mooncake/connector.py#L228-L261 |
| D 怎么读 | 同连接器文件 #L774-L990：_transfer_kv_cache_all_groups 与 batch_transfer_sync_read |
| P 的发送线程只答元数据 | 同连接器文件 `#L245-L390`：`KVCacheSendingThread` |
| 失败也发完成信号 | 同连接器文件 `#L705-L756`：`KVCacheRecvingThread._handle_request` |
| 角色判定与完成上报 | 同连接器文件 `#L2424-L2492`：线程创建与 `get_finished` |
| 押块超时 | 同连接器文件 `#L166-L243`：`KVCacheTaskTracker` |
| D 上先占块、等待请求不排 token | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L798-L824`（`WAITING_FOR_REMOTE_KVS`）；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2027-L2057`（陪跑条件与 `kv_connector_no_forward`） |
| 整段命中退回 1 格、失败后保留已读部分 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186` |
| 代理改长度、转交参数 | `vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L788-L806`、`#L925-L927` |
| 屏蔽停止 token | `vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L191-L238`；上游 `Sampler.forward` 先调它（`vllm/v1/sample/sampler.py#L96-L100`） |
| Ascend 采样也经过它 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598`（`_sample` 调 `self.sampler`）；`vllm_ascend/sample/sampler.py#L46-L125`（`AscendSampler` 不重写 `forward`） |
| 连接器注册 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87`；`v0.30.0 (c09d3e20)` 见 `#L21-L135`；`main (8d6180e2)` 见 `#L57-L162` |
| `v0.30.0` / `main` V1 选块、V2 角色校验与 `partial_prefills` | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1788-L1905`、`mooncake/base_scheduler.py#L40-L85`、`platform.py#L778-L785`；`vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L260-L310`、`mooncake/base_scheduler.py#L364-L385`、`platform.py#L943-L949` |
| EPD：只编码就返回、编码缓存、只跑编码器的模式 | `vllm_ascend/worker/model_runner_v1.py#L2018-L2025`、`vllm/distributed/ec_transfer/ec_connector/example_connector.py`、`vllm/model_executor/models/interfaces.py#L216-L246`（三池完整架构见 [EPD 分离](epd-disaggregation.md)） |

同一个连接器类在两个进程里各造一份：调度器进程里是 `MooncakeConnectorScheduler`，worker 进程里是 `MooncakeConnectorWorker`，上游的连接器接口本来就分成调度侧和 worker 侧两组方法。

**来源索引。** PD 分离的两条动机、拉取与逐层推送两种实现流程、规格表与限制清单都出自 vllm-ascend 设计文档 [S1][S2][S3]；GLM-5.3-Flash 的矩阵条目见支持矩阵 [S4]，官方 GLM 双机教程的多机部署一节没有 KV 传输配置 [S5]；`kv_port` 的建议取值见多机教程 [S29]，v0.23 文档里那条已删的限制见 [S31]。

交接流程的来源对应如下：代理改长度见上表；P按长度上限交棒、押块与带走采样token见8，按组裁剪及混合截断见10，D挂起见11、批量读取见13，失败通知见15、480秒押块上限见16，整段命中退1格见18、失败策略默认fail见20，V1角色判断见22、V2拒绝kv_both见23，最少生成数屏蔽停止token见26。GLM full组少传块的组内交错及共用块号见45，连接器采用的压缩比见9，D端截齐见46。EPD的形态与流程见特性文档[S33][S34]，实现细节见上表最后一行。

R1的两种交接点由截断与整段命中规则推出，块号小例子与2,000个token算式都是示意[D]；一P一D的每卡权重、块数与MC2条件取自部署页单机8卡换算[D]。提示词多于1个token且走本页截断路径时，“混合模型不重复算位置”由P截断与D命中N−1两条规则合起来推断[I]。首次分配后远端标记关闭、P源块随后释放，只能说明原交接不会自动重拉；抢占后其他缓存或重投路线仍须按各自条件判断。

交接图中的 indexer 边界由 sources 83–84 确定：只有池末位置获得有效压缩槽位，有效池数取位置数除以压缩比的下整。因此 R1 处理完 3 个位置时只有未满池尾状态，处理完第 4 个位置才形成第一条池 K。

NIXL 租约的设计、D 入队即跟踪、心跳节流和 P 保留条件见来源 85–90；默认续约窗口、完成计数、到期回收及握手后的发送见 91–93。双向配置、阈值与 D 的固定 TTL 见 94–96，代理实际 450 秒、取出即删与转交路径见 97–99；CUDA/device-buffer 及推理历史前缀限制见 110。租约时间算式使用这组默认值，时间点为教学设定。v0.26 的到期字段与 5 秒保护见 100–102，main/rc2 的时钟换算和读回判断见 103–108，rc2 Pull 别名见 109；这套来源不用于证明 Ascend Mooncake 的行为。

NIXL 的输入边界：D 计算命中数见来源 111–114，交接字典见既有来源 90、100、104、107；整段命中留最后位置见来源 18、115–117。基线请求保存提示词、批次填入 token 和按位置取下一次输入见来源 118–120。四 token 示例由这些分支推演；不把 EP 部署指南中“D 的 prompt 被忽略”的示例注释当成此路径的接口保证。

**待核。**

- 待核：钉住版本上 GLM 走 PD 会不会在更早一步就报错。EngineCore 在 KV 初始化后把 `cache_config.block_size` 改成各组块大小的最小值（`vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284`，GLM 取到 4），连接器调度侧的 `block_size` 取自这个字段，会以 `remote_block_size=4` 发给 D；D 端断言 `remote_block_size` 能被 kernel 块大小整除（`mooncake_connector.py#L2602-L2604`）。这条断言会不会先失败，只做了静态阅读，缺实际运行。
- main 的 `MooncakeConnectorV2` 使用 `MooncakePullConnector`，调度侧按截断后的提示词长度和每组自己的逻辑块大小选块，不乘压缩比。在本页 N>1、PCP=DCP=1 的 GLM 算例中，full 组的数量是 ⌈(N−1) ÷ 640⌉，修正了 V1 的这处少传。D 的层匹配、实际网络读、完成汇合和 P 释放链已进一步核到消费者，见[Mooncake V2](mooncake-connector.md#v2-的接收完成是否代表读成功)；同时确认该 main 多组失败的上报缺口。剩余的是对应安装组合的设备恢复、错误处理和端到端验证，不能把局部块数修正当作整条请求已正确。
- KDA 调度元数据含 MTP 候选槽，不代表全部槽都传输：固定 V1 从远端块表的 `len − num_speculative_blocks − 1` 位置选择当前状态，写入本地首槽，再逐层列出状态张量地址。实际字节推导见 [Mooncake 连接器](mooncake-connector.md)；端到端传输量仍缺 D 端日志实测。
- 待核：GLM-5.3-Flash 在 PD 下的端到端实测（首 token 延迟、生成间隔、吞吐、传输耗时），缺官方或本地测量。
- 待核：`MooncakeHybridConnector` 与 V1 在 GLM 上该选哪个，缺官方说明。
- 待核：P、D 各自开 DP、MTP 与图模式时的交接行为，缺双机实测日志。
- 待核：上面「会报什么错」列出的报错都没有在双机上触发过，缺实际日志原文。

