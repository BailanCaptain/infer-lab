---
id: speculative-decoding
title: Speculative decoding：先猜几个 token，再让主模型一次验完
type: feature
summary: >-
  Speculative decoding（投机解码）先用便宜的办法猜出后面几个
  token，再让主模型一次前向验证：猜对几个就多出几个，第一个猜错处换成主模型自己的答案。讲清接受规则、被拒位置的收场、为什么也可能变慢，以及 GLM
  双机上 MTP 每步猜 3 个的做法与版本差异。
aliases:
  - Speculative Decoding
  - speculative decoding
  - 投机解码
  - 推测解码
  - MTP
  - Multi-Token Prediction
  - 草稿模型
  - 草稿 token
  - draft token
  - 候选 token
  - bonus token
  - num_speculative_tokens
  - num-speculative-tokens
  - speculative_config
  - speculative-config
  - speculative_config.method
  - speculative-config.method
  - spec-method
  - speculative_config.model
  - speculative-config.model
  - spec-model
  - spec-tokens
  - speculative_config.enforce_eager
  - speculative-config.enforce-eager
  - 草稿 enforce_eager
  - 拒绝采样
  - rejection sampling
  - 接受率
  - prompt_lookup_min
  - prompt_lookup_max
  - suffix_decoding_max_tree_depth
  - suffix_decoding_max_cached_requests
  - suffix_decoding_max_spec_factor
  - suffix_decoding_min_token_prob
  - parallel_drafting
  - extract_hidden_states
  - use_heterogeneous_vocab
  - per_request_spec_decode_metrics
  - per-request-spec-decode-metrics
chapters:
  - '17'
order: 30
sources:
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L715-L764'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L835'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L861-L925'
  - 'https://arxiv.org/abs/2211.17192'
  - 'https://arxiv.org/abs/2302.01318'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L518-L535'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L305-L330'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L212-L226'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L550-L554'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L715-L727'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1475-L1518'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L298-L305'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217-L236'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L893-L916'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L94-L183'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L205-L272'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L778-L781'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L594-L598'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L100-L106'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/__init__.py#L34-L53'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/__init__.py#L41-L60'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L17-L35
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L63
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/speculative_decoding.md#L63
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - 'vllm@568afb3a:vllm/config/speculative.py#L178'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L504-L518'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L430-L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1114-L1121'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L36-L98'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L957-L997'
  - 'vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L218-L235'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L34-L96'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L613-L616'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1464-L1472'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1665-L1701'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L525-L588'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L673-L810'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L975-L1034'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L389-L429'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L284-L294'
  - 'vllm@568afb3a:vllm/config/speculative.py#L36-L104'
  - 'vllm@568afb3a:vllm/config/speculative.py#L654-L733'
  - 'vllm@568afb3a:vllm/config/speculative.py#L889-L998'
  - 'vllm@84030bbe:vllm/config/speculative.py#L37-L83'
  - 'vllm@84030bbe:vllm/config/speculative.py#L375-L398'
  - 'vllm@84030bbe:vllm/config/speculative.py#L1080-L1150'
  - 'vllm@84030bbe:vllm/config/speculative.py#L1330-L1468'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1741-L1777'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L1907-L1943'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L154
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json#L242
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L214-L219'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L335-L345'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L200-L219'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L271-L281'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L241-L260'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L322-L332'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/__init__.py#L41-L70'
  - >-
    vllm-ascend@7d825229:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L18-L49
  - 'vllm@ced6857a:vllm/v1/structured_output/__init__.py#L220-L312'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/llm_base_proposer.py#L239-L258'
  - "vllm@0fc695fc:docs/features/speculative_decoding/README.md#L1-L200"
  - "vllm@0fc695fc:docs/features/speculative_decoding/draft_model.md#L1-L84"
  - "vllm@0fc695fc:docs/features/speculative_decoding/eagle.md#L1-L67"
  - "vllm@0fc695fc:docs/features/speculative_decoding/extract_hidden_states.md#L1-L86"
  - "vllm@0fc695fc:docs/features/speculative_decoding/mlp.md#L1-L48"
  - "vllm@0fc695fc:docs/features/speculative_decoding/mtp.md#L1-L76"
  - "vllm@0fc695fc:docs/features/speculative_decoding/n_gram.md#L1-L27"
  - "vllm@0fc695fc:docs/features/speculative_decoding/parallel_draft_model.md#L1-L46"
  - "vllm@0fc695fc:docs/features/speculative_decoding/speculators.md#L1-L32"
  - "vllm@0fc695fc:docs/features/speculative_decoding/suffix.md#L1-L35"
  - "vllm@0fc695fc:vllm/v1/spec_decode/ngram_proposer.py#L1-L285"
  - "vllm@0fc695fc:vllm/config/speculative.py#L588-L641"
  - "vllm-ascend@db701c1f:vllm_ascend/spec_decode/ngram_proposer.py#L1-L102"
  - "vllm@0fc695fc:vllm/v1/spec_decode/suffix_decoding.py#L1-L101"
  - "vllm@0fc695fc:vllm/config/speculative.py#L130-L196"
  - "vllm@0fc695fc:vllm/config/speculative.py#L811-L845"
  - "vllm@568afb3a:vllm/config/speculative.py#L155-L214"
  - "vllm@568afb3a:vllm/config/speculative.py#L734-L771"
  - "vllm@568afb3a:vllm/config/speculative.py#L1052-L1086"
  - "vllm@ced6857a:vllm/config/speculative.py#L370-L540"
  - "vllm@ced6857a:vllm/config/speculative.py#L1088-L1260"
  - "vllm@ced6857a:vllm/config/speculative.py#L1320-L1512"
  - "vllm@ced6857a:vllm/config/speculative.py#L37-L96"
  - "vllm@ced6857a:vllm/engine/arg_utils.py#L1924-L1968"
  - "vllm@ced6857a:vllm/config/speculative.py#L1577-L1611"
  - "vllm@84030bbe:vllm/config/speculative.py#L449-L515"
  - "vllm@84030bbe:vllm/config/speculative.py#L1166-L1200"
  - "vllm@84030bbe:vllm/config/speculative.py#L1537-L1571"
  - "vllm@0fc695fc:vllm/v1/spec_decode/llm_base_proposer.py#L322-L353"
  - "vllm@0fc695fc:vllm/v1/spec_decode/llm_base_proposer.py#L485-L556"
  - "vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L1166-L1208"
  - "vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L1458-L1503"
  - "vllm-ascend@7d825229:vllm_ascend/spec_decode/llm_base_proposer.py#L1620-L1665"
  - "vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L1575-L1620"
  - "vllm-ascend@2c59ff10:vllm_ascend/spec_decode/__init__.py#L34-L55"
  - "vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/__init__.py#L35-L58"
  - "vllm-ascend@baa023ad:vllm_ascend/spec_decode/__init__.py#L41-L70"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L540-L622"
  - "vllm@0fc695fc:vllm/model_executor/models/registry.py#L637-L646"
  - "vllm@0fc695fc:vllm/config/speculative.py#L480-L525"
  - "vllm@0fc695fc:vllm/v1/spec_decode/extract_hidden_states.py#L1-L393"
  - "vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/example_hidden_states_connector.py#L1-L517"
  - "vllm-ascend@db701c1f:vllm_ascend/spec_decode/extract_hidden_states_proposer.py#L1-L198"
  - "vllm@0fc695fc:vllm/transformers_utils/configs/speculators/base.py#L1-L140"
  - "vllm@0fc695fc:vllm/transformers_utils/config.py#L625-L686"
  - "vllm@568afb3a:vllm/transformers_utils/config.py#L632-L685"
  - "vllm@ced6857a:vllm/transformers_utils/config.py#L695-L754"
  - "vllm@84030bbe:vllm/transformers_utils/config.py#L686-L745"
  - "vllm@0fc695fc:vllm/engine/arg_utils.py#L1703-L1750"
  - "vllm@ced6857a:vllm/config/speculative.py#L1814-L1850"
  - "vllm@ced6857a:vllm/v1/spec_decode/draft_model.py#L1-L115"
  - "vllm@ced6857a:vllm/v1/spec_decode/llm_base_proposer.py#L430-L512"
  - "vllm@84030bbe:vllm/config/speculative.py#L1778-L1811"
  - "vllm@84030bbe:vllm/v1/spec_decode/draft_model.py#L19-L61"
  - "vllm-ascend@7d825229:vllm_ascend/spec_decode/draft_proposer.py#L1-L17"
  - "vllm@0fc695fc:vllm/v1/spec_decode/metrics.py#L1-L215"
  - "vllm@ced6857a:vllm/v1/spec_decode/metrics.py#L1-L281"
  - "vllm@ced6857a:vllm/v1/metrics/stats.py#L303-L375"
  - "vllm@ced6857a:vllm/config/observability.py#L48-L58"
  - "vllm@ced6857a:vllm/engine/arg_utils.py#L1538-L1541"
  - "vllm@ced6857a:vllm/engine/arg_utils.py#L2023-L2028"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1950-L2045"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2485-L2495"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2140-L2175"
  - "vllm@ced6857a:vllm/v1/engine/output_processor.py#L680-L703"
  - "vllm@ced6857a:vllm/v1/engine/output_processor.py#L427-L447"
  - "vllm@ced6857a:vllm/entrypoints/generate/base/serving.py#L105-L119"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L812-L872"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L1142-L1185"
  - "vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L447-L486"
  - "vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L610-L650"
  - "vllm@84030bbe:vllm/config/observability.py#L48-L58"
  - "vllm@84030bbe:vllm/v1/metrics/stats.py#L303-L375"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L812-L855"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L1145-L1158"
  - "vllm@84030bbe:vllm/entrypoints/openai/completion/serving.py#L456-L476"
  - "vllm@84030bbe:vllm/entrypoints/openai/completion/serving.py#L617-L634"
  - "vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L608-L660"
  - "vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L337-L772"
  - "vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L818-L895"
  - "vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L967-L1137"
  - "vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L1187-L1424"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L316-L440"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L497-L691"
  - "vllm-ascend@2c59ff10:vllm_ascend/sample/rejection_sampler.py#L1326-L1439"
  - "vllm-ascend@2ed6cbba:vllm_ascend/sample/rejection_sampler.py#L1476-L1589"
  - "vllm-ascend@baa023ad:vllm_ascend/sample/rejection_sampler.py#L1482-L1595"
  - "vllm-ascend@7d825229:vllm_ascend/sample/rejection_sampler.py#L1190-L1282"
  - "vllm-ascend@7d825229:vllm_ascend/sample/rejection_sampler.py#L378-L683"
  - "vllm-ascend@7d825229:vllm_ascend/ops/triton/reject_sample.py#L494-L608"
  - "vllm-ascend@2ed6cbba:vllm_ascend/sample/rejection_sampler.py#L416-L899"
  - "vllm-ascend@baa023ad:vllm_ascend/sample/rejection_sampler.py#L422-L905"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1495-L1540"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2519-L2526"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1101-L1127"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2123-L2154"
  - "vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_mamba_utils.py#L226-L284"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L417-L450"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L580-L671"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L768-L833"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L490-L559"
  - "vllm-ascend@db701c1f:csrc/attention/recurrent_kda/op_kernel/recurrent_kda.h#L232-L365"
  - "vllm-ascend@db701c1f:csrc/attention/recurrent_kda/op_kernel/recurrent_kda.h#L785-L866"
  - "https://github.com/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/arctic_inference/suffix_decoding/cache.py#L1-L357"
  - "https://github.com/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/csrc/suffix_decoding/suffix_tree.cc#L593-L633"
  - "https://github.com/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/csrc/suffix_decoding/suffix_tree.cc#L825-L853"
  - "https://arxiv.org/abs/2401.15077v3"
  - "https://arxiv.org/abs/2404.19124v2"
  - "https://arxiv.org/abs/2411.04975v3"
  - "https://arxiv.org/abs/2504.18583v4"
  - "vllm@ced6857a:vllm/entrypoints/serve/utils/api_utils.py#L289-L301"
  - "vllm@84030bbe:vllm/entrypoints/serve/utils/api_utils.py#L289-L301"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L509-L512"
  - "vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L301-L304"
  - "vllm-ascend@c09d3e20:vllm_ascend/spec_decode/__init__.py#L41-L70"
  - "vllm-ascend@c09d3e20:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L40-L55"
  - "vllm-ascend@c09d3e20:vllm_ascend/worker/v2/spec_decode/__init__.py#L25-L78"
  - "vllm-ascend@c09d3e20:vllm_ascend/attention/sfa_v1.py#L529-L538"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/spec_decode/__init__.py#L29-L112"
  - "vllm-ascend@8d6180e2:vllm_ascend/attention/sfa_v1.py#L555-L565"
  - "vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1045-L1060"
  - "vllm@ced6857a:vllm/config/compilation.py#L1545-L1570"
  - "vllm@ba15685a:vllm/config/speculative.py#L540-L585"
  - "vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L1365-L1380"
  - "vllm@ba15685a:vllm/config/compilation.py#L1688-L1715"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: builds-on
    note: 在普通逐个生成的路径上多出候选与验证两段
  - to: kv-cache
    kind: builds-on
    note: 被拒位置写过的 KV 不擦，靠下一步原地覆盖
  - to: graph-mode-layer
    kind: builds-on
    note: 本站 FULL_DECODE_ONLY 下主模型验证步要整齐才能回放图，固定 K 的录图尺寸按 1 + K 的倍数取
contradicts: []
updated: 2026-11-11T00:00:00.000Z
origin: direct
---

## Speculative decoding 是什么：先猜几个 token，再让主模型一次验完？

模型生成回答，是一个 **token** 一个 token 往外出的（token 是模型读写文字的最小单位，可能是一个词，也可能是半个词，见 [Token](token.md)）。生成回答的这个阶段叫 **decode**：每一步把上一步刚定下的 token 送回模型，算出下一个。第 2 个 token 要等第 1 个定下来才能算，所以一步只能往前走一格。

**speculative decoding**（投机解码）换了个做法：先用一个便宜的办法把后面几个 token **猜**出来，这几个猜测叫**候选**（也叫草稿，draft）；再把「已经确定的 token + 这几个候选」一起交给真正要用的那个大模型（下文叫**主模型**）算一次。主模型在每个位置都会给出它认为的下一个 token，拿这些答案从左往右和候选对：对上的留下；第一个对不上的位置，写下主模型自己的答案；后面的候选全部作废。

这里先按每步取最高分 token 的 greedy 情况讲解。随机采样时改用概率接受和补抽，规则在后面的对应小节展开。

```wiki-diagram
file: speculative-decoding
```

看图里的例子（为了好读，这里一个词算一个 token）。已经确定的最后一个 token 是「猫」，草稿猜后面是「坐 在 床」。主模型一次算 4 个位置，每个位置预测的都是**它后面那一格**：读到「猫」时预测下一格是「坐」，读到「猫 坐」时预测「在」，读到「猫 坐 在」时预测「垫子」。候选在输入里正好晚一格出现，所以第 1 格的预测和第 1 个候选比，第 2 格和第 2 个比，依次错开一格。

前两个对上了。第 3 格主模型说「垫子」，候选猜的是「床」，于是写下「垫子」，停在这里。第 4 格的预测是读着错误的「床」算出来的，作废。这一轮一共写下「坐 在 垫子」3 个 token。接着草稿从「垫子」往后再猜 3 个，下一轮主模型再验，如此循环。

从这个例子里就能看出两点：

- **候选只决定一轮能写下几个，写下什么永远由主模型决定。** 对上的候选本来就是主模型的答案；对不上的那一格，写的也是主模型的答案。
- **每一轮至少写下 1 个 token。** 哪怕第 1 个候选就猜错，第 1 格的预测照样有效，它就是不猜时这一步本来会算出的那个 token。

## 为什么需要它：让一次权重读取服务更多候选位置

主模型每步都要使用**权重**（模型学到的矩阵，见[权重与矩阵乘](matmul-and-weights.md)）。普通 decode 每条请求只送进一个新位置，请求少时，同一份权重服务的输入行很少，读取权重可能成为主要开销。这里说的是本步实际使用的权重；MoE 并不会为每个 token 读取全部专家。实际瓶颈还可能是历史状态读取、通信或主机下发，需要时间轨迹确认。

若内核能在批内复用已读入的权重，乘 4 行就不必重复支付 4 次完整读取成本。speculative decoding 利用这种复用机会，把 1 个已确定的位置和 3 个候选位置一起验证；真实字节数仍受内核分块、缓存及候选选中哪些专家影响。猜得准，一步能写下多个 token，步数减少。下文把每轮猜几个记作 $K$，例子里 $K = 3$。

$$\text{Steps}_{\text{best}} = \left\lceil \frac{200}{1 + K} \right\rceil = \left\lceil \frac{200}{4} \right\rceil = 50\text{ 步}$$

| 情景（200 个 token 回答，示意，$K = 3$） | 每步写下 token 数 | 总步数算式与结果 |
|---|---|---|
| 不开投机解码 | 1 个 | $200 \div 1 = \mathbf{200\text{ 步}}$ |
| 每轮 3 个候选全对 | $3 + 1 = 4$ 个 | $\lceil 200 \div 4 \rceil = \mathbf{50\text{ 步}}$ |
| 每轮第 1 个候选就错 | 1 个（仅主模型自己那 1 个） | $200 \div 1 = \mathbf{200\text{ 步}}$ |

步数不会比不开更多，但这不等于不会更慢，因为每一步都多付了几笔账：

- **草稿本身要算。** 本页 GLM 例子猜 3 个，就把同一 MTP 层接连跑 3 遍，后一遍要等前一遍的结果。并行草稿改变的是这部分等待，主模型验证仍有额外工作。
- **主模型每步多算 3 个位置。** 请求一多，一步里本来就有很多行，算力开始吃紧，多出的行就不再「几乎免费」。
- **猜错的位置白算。** 第一个不符之后的位置，主模型和草稿都白做了。
- **要多留地方。** 候选位置也要写 [KV cache](kv-cache.md)（为每个位置存下、供后面回头读的 key 和 value）和状态，一条请求比不开时多占几格。

这几笔账什么时候赚得回来、什么时候会亏，在[为什么也可能变慢](#为什么也可能变慢)一节算。下面这张小表把它和「多条请求一起算」分开：两者都是让一次读进来的权重多服务几行，只是这些行的来路不同。

| 做法 | 一次读权重服务几行 | 这些行从哪来 |
|---|---|---|
| 普通 decode，1 条请求 | 1 行 | 这条请求最新的 1 个 token |
| 多条请求一起 decode（batching） | 每条请求 1 行 | 不同的请求，各算各的 |
| speculative decoding | 每条请求 1 + K 行 | 同一条请求往后的 K 个猜测 |

## 一轮怎么走：送进 1 + K 个位置，写下 1 到 K + 1 个

把一轮的规则写成步骤：

1. **送进去**：1 个已确定的 token，加上 K 个候选，一共 K + 1 个位置。
2. **主模型一次算完**：每个位置都给出「下一格该是什么」，一共 K + 1 个预测。
3. **错开一格去比**：第 i 格的预测和第 i 个候选比（i 从 1 数到 K）。从左往右，对上就留下候选，接着比下一个；第一次对不上，写下这一格的预测，停止。
4. **全对时多送一个**：K 个候选全部对上，第 K + 1 格的预测也成立，再写下它。这个多出来的 token 叫 **bonus token**。
5. **草稿接着猜**：从这一轮最后写下的 token 往后，草稿再猜 K 个，交给下一轮。

所以一轮写下的 token 数 = 对上的候选数 + 1，最少 1 个，最多 K + 1 个。K = 3 时：

| 对上几个候选 | 这一轮写下 | 用上了哪几格的预测 |
|---|---|---|
| 0 | 1 个（主模型第 1 格的答案） | 第 1 格 |
| 1 | 2 个 | 第 1、2 格 |
| 2 | 3 个（图里的例子） | 第 1、2、3 格 |
| 3 | 4 个（3 个候选 + bonus token） | 全部 4 格 |

为什么第一次对不上就必须停？第 i + 1 格的预测是读着前面所有输入算出来的，其中包括第 i 个候选。第 i 个候选一旦是错的，后面各格读到的历史就和真实的不一样，它们的预测都不能用。图里第 4 格读过错误的「床」，所以作废；反过来，只有全对时，最后一格才是在正确的历史上算出来的，bonus token 才成立。

一轮之内的先后也要记住：**先验证，再猜下一轮的候选。** 草稿要从「这一轮最后写下的 token」往后猜，而这个 token 要等主模型验完才知道；有些草稿（比如后面讲的 MTP）还要用主模型这一轮刚算出的中间结果。所以一个 decode 步的顺序是：主模型前向 → 逐位接受 → 草稿猜下一轮。这一步验的候选，是上一步末尾猜出来的。

## Greedy 验证与随机采样分开理解

上面「对上就留下」的比法，只适用于 **greedy**（每一步都取分数最高的那个词）。主模型按 greedy 生成时，它在每一格的答案是确定的一个 token，候选和它一样就对，不一样就错。

请求开了随机采样（temperature 大于 0，按概率抽词，见[采样](sampling.md)）时，主模型在每一格给出的是一份**概率分布**，「答案」本身要靠抽，没法拿候选去和一个确定的词比。这时用的是 **rejection sampling**（拒绝采样）：按一个概率决定候选留不留，被拒时再从一份调整过的分布里补抽一个。规则设计成这样，是为了让每一格最终输出各个词的概率，**和主模型自己直接抽完全一样**。

记主模型在这一格给某个词 x 的概率为 p(x)，草稿给它的概率为 q(x)：

- **接受**：草稿抽到 x，以 min(1, p(x) ÷ q(x)) 的概率留下它。主模型比草稿更看好 x（p 不小于 q），一定留下；没那么看好，就按比例留。
- **补抽**：被拒时，从 max(0, p − q) 归一化后的分布里抽一个，写在这一格，然后停止。这份分布只保留「主模型比草稿更看好」的那部分词。

用 3 个词的小例子验算一遍。主模型的概率是猫 0.6、你 0.3、看 0.1；草稿的概率是猫 0.8、你 0.1、看 0.1：

$$P_{\text{accept}}(x) = \min\!\left(1,\; \frac{p(x)}{q(x)}\right), \qquad p'(x) = \frac{\max(0,\; p(x) - q(x))}{\sum_y \max(0,\; p(y) - q(y))}$$

| 核算步骤（3 词教学示意） | 算式 | 结果 |
|---|---|---|
| 草稿抽到「猫」时留下的机会 | $\min(1,\; 0.6 \div 0.8)$ | **0.75** |
| 这一格被拒的总机会 | $0.8 \times (1 - 0.75) + 0.1 \times 0 + 0.1 \times 0$ | **0.2** |
| 补抽分布 $\max(0, p - q)$ 归一化 | $(0,\; 0.2,\; 0) \to (0,\; 1,\; 0)$ | 补抽只剩「你」 |
| 最终输出「猫 / 你 / 看」的概率 | $0.8 \times 0.75$；$0.1 \times 1 + 0.2 \times 1$；$0.1 \times 1 + 0.2 \times 0$ | **0.6 / 0.3 / 0.1**（与 $p$ 完全一致） |

三个结果正好是主模型的 0.6、0.3、0.1：草稿猜得偏，影响的只是一轮能留下几个，不改变输出的概率。greedy 是这条规则的特例：主模型的概率全压在最高分的那个词上，候选是它就一定留下，不是它就一定被拒，补抽出来的正是最高分的词。

草稿自己如果也是 greedy（每次只挑它最看好的一个词），它的概率就全压在候选那一个词上，q(x) = 1。规则化简成：以 p(x) 的概率留下候选；被拒时，从去掉候选之后的主模型分布里补抽。GLM 的 MTP 草稿就是这种情况，[采样](sampling.md#有-mtp-候选时采样变成验证)一页用「猫 0.731、你 0.269」演过一遍。

「输出概率不变」是数学上的结论，前提是每一格的 p 和不开时算得一样。实际运行时一步多了几行、批次形状变了，浮点加法的先后次序可能跟着变，最后几位的误差偶尔会让两个分数很接近的词换个先后，所以不能保证在任何设备、任何设置下逐个 token 都和不开时相同，见 [Batch invariance](batch-invariance.md)。

### block verify 和 entropy verify 还能套用这份证明吗？

**不能。** 昇腾的这两个开关默认都关闭。entropy verify 按主模型分布的熵降低随机接受门槛；block verify 在 K 至少为 3 时改用累积概率，找出最后一个通过的位置，再保留它之前的整段候选。后一种规则允许前面单独没通过的位置，因后面累积判定通过而一起留下。两者都不能直接套用上面的逐位拒绝采样证明；这是判法的改变，与浮点误差是两回事。这里说的是普通随机采样分支；未使用合成接受率模式时，全 greedy 请求在普通逐位验证后就返回。

用两个词 A、B 看 block verify 的反例：草稿总猜 A，主模型在每个前缀下都给 A、B 各 0.5，K=3，entropy verify 和合成接受率模式（synthetic mode）均关闭。三个独立随机数取 0.8、0.1、0.9 时：

| 位置 | 累积目标/草稿概率比 | 累积随机数 | 整块判定 |
|---|---|---|---|
| 1 | 0.5 | 0.8 | 不通过 |
| 2 | 0.25 | 0.08 | 通过 |
| 3 | 0.125 | 0.072 | 通过 |

普通验证在第一格就拒绝 A，补抽分布只剩 B。block verify 却保留三个 A，再接 bonus。这个现象也会改变总体概率：仅“第一格通过”和“第一格不通过但第二格累积通过”这两类互斥事件，就让首词 A 的概率至少达到 `0.5 + 0.25 × ln(2) ≈ 0.6733`，已经超过目标的 0.5；第三格还可能再增加接受情况，拒绝后只补 B 也无法抵消它。

这个反例对应固定 GLM 提交及下方四个 Ascend 比较点的实际接受与恢复规则；普通 CPU 回退函数复现了该差异，未据此声称 NPU 性能或实际模型精度结果。本站 GLM 配方没有开启这两个选项，因此前面的普通验证算例仍适用。

## 候选从哪来：文本匹配、小模型，或模型自带的 MTP 层

草稿只负责猜，越便宜、越准越好。常见的有三类：

- **从已有 token 序列里找重复**（vLLM 里叫 ngram、suffix 等）：看最近几个 token 以前怎样接下去，取那个续文作候选。不加载草稿模型，也没有草稿模型自己的 KV；主模型验证这些候选的计算和位置仍然要留。改写、抽取、改代码里的重复通常更容易利用，生成到一半的重复、以往回答里的固定格式也可能派上用场。找不到可接的，这一步就不提候选，退回普通 decode。
- **另配一个小模型**（draft model）：通常让小模型接连猜 K 个候选，另加载草稿权重和它自己的 KV。经过专门训练的并行草稿还可以一次前向猜出 K 个，下面会区分这两条路径。
- **借主模型的中间结果往后猜**（EAGLE、MTP 等）：不从头读文字，而是拿主模型刚算出的隐藏向量（每个位置的一串数，汇总了读到这一格为止的内容，见[层与隐藏向量](layers-and-hidden.md)），再加上刚确定的 token，往后猜。

**MTP**（Multi-Token Prediction，多 token 预测）属于第三类。本站 GLM 在主干之外附带一个预测层，推理时从同一份检查点加载它，命令不用另给草稿模型。这是 GLM 这条路径的安排；官方 Gemma4 MTP 示例使用独立的 assistant 检查点，不能只看见方法名 MTP 就断定权重一定在同一个文件里。

只有 1 个 MTP 层、却要每轮猜 3 个时，就把这一层**接连跑 3 遍**：第 1 遍用主模型的隐藏向量和刚写下的 token 猜出候选 1；第 2 遍把候选 1 当输入、位置加 1、隐藏向量换成第 1 遍的输出，猜出候选 2；第 3 遍同理。「模型只有一个预测层」和「一轮猜三个」并不矛盾，前者说的是结构，后者说的是调用次数。代价是后一遍要等前一遍；vLLM 会为反复复用 MTP 层打一条提醒。层数本身不足以证明训练目标或接受率随位置严格下降；第二、第三个候选是否有收益，要看实际接受率与多跑草稿的耗时。

GLM 的 MTP 层长什么样、两路输入为什么差一个位置，见 [GLM-5.3-Flash 的 MTP 层](glm-5-3-flash.md#mtp主干之外的第-45-层)；R1 第一次草拟时每一行配什么输入，见[一条请求的第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

### ngram 和 Suffix 分别从哪里找候选？

**ngram 在当前请求已有的 token 序列里找。** 这段序列包括提示词和已经生成的部分。比如当前序列是「请 先 检查 配置，再 检查 配置」，末尾的「检查 配置」在前面也出现过，就可以把前一次出现之后的「，再……」提作候选，再交主模型判断；这不是把旧文字直接塞进最终回答。CPU 实现在允许的窗口内优先取较长的匹配，最多返回 K 个，受序列余量和模型长度限制。

**Suffix 多了一份跨请求的 CPU 记录。** 一棵后缀树记当前请求的提示词和已生成内容，另一棵记先前请求的回答；不是把所有旧请求的提示词都放进全局树。它比较匹配后的续文分数，分数来自出现频率，决定要提哪一段以及提多长。两棵树需要主机内存；全局记录满了按进入顺序淘汰，关闭全局记录后仍可用当前请求的树。固定上游这条接线返回的是一条候选序列，不能把论文里的多分支树验证、或 Suffix 与 EAGLE 的混合策略直接当作它已启用的行为。

所以这两种方法节省的是草稿模型的权重和前向开销，仍要支付查找、记录与主模型验证的成本。Suffix 的候选长度可以小于 K，K 是上限；不同重复模式下，候选数和命中率会一起变化。

### 官方的 EAGLE、并行草稿和 MLP 又是什么？

**EAGLE 用主模型的中间表示辅助草拟。** 原始 EAGLE 把主模型的特征与错开一位的已确定 token 一起输入轻量预测器，再用主模型的词表头得到候选。EAGLE3 的检查点与特征接口另有要求，方法名相近不代表权重可以互换。它们解释了“借中间结果”的路线；GLM 自带的 MTP 层仍按前面自己的结构和权重来源理解。

**并行草稿把等待前一个候选的过程换成了占位输入。** 普通自回归草稿先猜 1，再用 1 猜 2；PARD 这样的模型经过专门训练，把未来位置放上 mask token，一次前向输出 K 个候选。上游用 `parallel_drafting` 选择这类执行方式，默认 False，草稿配置还要提供匹配的占位 token。把开关设成 True 不会把任意小模型变成 PARD。Ascend 的草稿基类也有“一次返回 K 个”的分支；具体检查点和注意力组合仍须与该分支的输入要求匹配。本站 GLM 基线没有因此变成并行草稿，仍是同一 MTP 层接连跑三遍。

**MLP speculator 是另一种轻量预测头。** IBM 的方案把主模型上下文与已采样 token 交给多级小网络，一级的结果继续喂给下一级；不能把“多个头”一律理解为彼此独立、同时猜完。官方指南保留了训练报告与检查点入口，但本站所对照的四版 Ascend 工厂没有 `mlp_speculator` 分支；上游基线的 MRV1 分派也没有接它，模型注册项仍被注释。合法方法名和存在一个模型文件，都不足以让这条命令跑通。

选方法时也要算资源：独立小草稿多出权重和自己的 KV，MTP/EAGLE 增加预测层及其缓存，文本查找主要增加主机侧记录和查找。草稿由当前 Worker 建在其设备上，并不因多出一个模型名就自动多分配一整套机器；能否放下仍要把主模型、草稿、KV 和临时空间一起计入。

### 采集隐藏状态和 Speculators 的短命令在做什么？

**`extract_hidden_states` 是训练数据采集入口。** 它指定要记录的层，把每个位置的隐藏状态写入缓存，再交连接器导出。这里的配置虽然挂在投机容器里，目的却是为训练草稿保存中间表示；固定实现要求 K=1，不是让当前回答多猜一个词来提速。官方示例还关闭 chunked prefill，使用 `ExampleHiddenStatesConnector` 把结果写成文件。该示例的设备复制、文件写入和客户端取文件是一条独立的数据链；Ascend 有提取器适配，不等于上游 CUDA 文件导出示例可原样运行在 NPU 上。

这个连接器返回的是文件路径；异步写盘尚未结束时，读取方用配套 `load_hidden_states()` 等待文件锁再读。默认目录 `/tmp`、写线程数 8、同步锁开启；客户端还负责及时清理文件。输出隐藏状态形状为 `[位置数, 提取层数, hidden_size]`，多取层、多保留请求都会增加缓存与文件体积。采集层列表位于草稿配置的 `hf_config.eagle_aux_hidden_state_layer_ids`，不是让请求一次多生成几个词的参数。

**Speculators 是训练和封装草稿的工具与检查点格式。** 官方短命令可以把一个草稿仓库作为启动的 model 输入：入口先识别 Speculators 配置，取其中的 verifier 作为真正主模型和 tokenizer，把原仓库留作草稿，再转换成 vLLM 的投机配置。EAGLE3、并行 EAGLE 等仍要由转换后的具体方法执行；这个仓库名不代表服务只加载了一个小模型。短命令的参数合并在版本间有变化，见后面的四版表。完整训练工具、采集连接器和推理执行器是三个环节，选择已有草稿时先核它对应的主模型和方法。

## 验证完，被拒的位置怎么收场

候选位置是真正进过主模型的。主模型算它们时，已经把这些位置的 KV cache（为每个位置存下的 key 和 value，后面的 token 要回头读，见 [KV cache](kv-cache.md)）写进去了。候选被拒以后，这些格子怎么办？

**按位置存的 KV：不擦，下一步原地覆盖。** 调度器记着每条请求「已经算到第几个位置」。排这一步时，它先按 K + 1 个位置全算完记账；结果回来，有几个候选被拒，就把这个数退回几格。下一步从退回后的位置接着往后写，而一个位置写进哪一格，是按位置号查 [block table](block-table.md)（块表）得出的，所以写的正是上一步被拒的那几格，旧内容直接被盖掉。不存在专门「回收」被拒 KV 的动作。

用图里的例子记一遍账：「猫」在位置 5，此前位置 0–4 已经算完（示意，$K = 3$，位置 8 原存的「床」的 KV 在下一步会被「垫子」的 KV 原地盖掉）：

| 记账阶段 | 位置或算式 | 结果 |
|---|---|---|
| 这一步送进主模型 | 猫、坐、在、床 | 位置 5–8（共 4 个） |
| 排步时先按全算完记账 | $5 + 4$ | **9 个位置** |
| 被拒的候选数 | $3 - 2$ | **1 个**（位置 8 的「床」） |
| 结果回来后退回已算位置 | $9 - 1$ | **8 个位置** |
| 下一步写起的位置 | 垫子 + 3 个新候选 | 位置 8–11（位置 8 原地覆盖） |

**只有验证过的 token 才登记进 prefix caching。** 多条请求开头相同时，KV 可以按块共享（[prefix caching](prefix-caching.md)）。登记可共享的块时只算到已经验证的 token 为止，没验证的候选不会被别的请求读到。

**本页基线给草稿多留 K 格。** MTP 和小草稿模型自己也要为候选位置写 KV，所以固定基线的调度器给每条请求分 KV 位置时，在这一步要算的位置之外再多留 K 个（vLLM 叫 lookahead；该基线的 DFlash 草稿多留 K + 1 个）。只做文本匹配的草稿不跑模型，不用多留草稿模型的位置。这个预留规则不能代替其他版本、草稿方法的容量计算。

**递推状态：没法覆盖回去，就多存几份。** 有一类注意力不按位置存 KV，而是只留一份不断往前推的状态，每读一个 token 就更新一次，例如 [KDA 这类线性注意力](linear-attention.md)。这份状态被错误的候选推过一次就回不去了，没法像 KV 那样退回几格、下一步盖掉。办法是把每推进一个位置后的状态都存下来：一轮 K + 1 个位置，就为每条请求准备 K + 1 份状态的位置，下一步按上一步留下了几个，挑出最后一个有效位置之后的那份接着推。图里的例子留下了「坐 在」，有效输入到位置 7 为止，下一步就从「读完位置 7」的那份状态接着推，「读完位置 8（床）」的那份丢掉。这类层前面常有一个短卷积，要记住最近几个位置的输入，它的缓存也要为候选多留 K 格。

固定 GLM 提交的 KDA 调用链把这个选择写得更具体：Worker 统计验证输出里非占位 token 的个数 a（**包含补抽或 bonus**），KDA 从当前状态索引表的第 `a − 1` 项取初始状态。上例输出「坐、在、垫子」，a=3，取第 2 项，也就是读完输入「猫、坐、在」后的状态；垫子是下一步才输入的 token。若 align 缓存模式先把有效状态搬到了新的保留槽，元数据会同步把 a 重置为 1，再取新索引表第 0 项。因此这是按当前映射找有效状态，不能理解成永远读取某一块固定物理内存。这里的 a 与后文指标中“只数接受草稿”的 A 含义不同。

## 为什么也可能变慢

一轮能写下几个 token，取决于候选有多准。为了估算，假设在前面候选都已接受的条件下，每个位置的接受概率都为 α（接受率），且不提前遇到停止条件；真实的逐位置条件接受率可以不同。一轮猜 K 个，平均每轮写下的 token 数是 (1 − α 的 K + 1 次方) ÷ (1 − α)。α 越接近 1，结果越接近 K + 1；α 为 0 时正好是 1，α = 1 时直接取 K + 1。

但开了以后，每一步本身也更贵：本站 GLM 草稿要接连跑 $K$ 遍，主模型每条请求多算 $K$ 行，还要准备验证用的下标和状态。其他方法会改变草稿这一项的成本；并行草稿也仍有主模型验证开销。把「每步贵了多少」算进去，才是实际的快慢。下面按开了以后每步耗时是不开时的 $1.3$ 倍来演算，这个倍数是编的，实际会随批次大小、模型和设备变：

$$E[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha}, \qquad \text{Speedup} = \frac{E[\text{tokens}]}{c_{\text{step}}}$$

| 接受率 $\alpha$（示意，$K = 3$，$c_{\text{step}} = 1.3$） | 每轮平均写下 token 数 | 折合加速比 |
|---|---|---|
| $\alpha = 0.6$ | $(1 - 0.6^4) \div (1 - 0.6) \approx \mathbf{2.18\text{ 个}}$ | $2.18 \div 1.3 \approx \mathbf{1.68\text{ 倍}}$ |
| $\alpha = 0.2$ | $(1 - 0.2^4) \div (1 - 0.2) \approx \mathbf{1.25\text{ 个}}$ | $1.25 \div 1.3 \approx \mathbf{0.96\text{ 倍}}$（比不开还慢） |

所以「每步至少写下 1 个 token，最差也不会比不开慢」不成立：步数确实不会更多，但每一步更贵，接受率低时总时间反而更长。下面几种情形会让收益缩水：

- **并发高。** 请求一多，一步里本来就有很多行，读权重的成本已经被这些请求分摊；再给每条请求加 K 行，换来的主要是更多计算。收益最大的是请求少、对时延敏感的场景。
- **回答难猜。** 开放式的生成、温度高的随机采样，候选更容易被拒。
- **K 太大。** 后一个候选必须先等前面的都通过，才有机会留下；整段通过的次数随位置向后不会增加，但这不等于“已经通过前面后，下一个位置一定更不准”。多猜的候选若换不来足够的有效推进，额外草稿和验证成本就赚不回来。
- **和录图尺寸叠加。** 一条请求一步占 K + 1 个位置，批次补齐到固定尺寸时，空跑的位置也跟着放大，见下一节和 GLM 多条请求那一节。
- **占的地方更多。** KV 和状态都要为候选多留，同样的显存能同时放下的请求变少。

评估时要同时记下：每轮猜几个、每轮实际留下几个的分布、首 token 时延和之后每个 token 的间隔、吞吐、显存占用、当时的并发数。只看其中一项，容易得出相反的结论。

候选长度也可以随请求变化。[DSpark](dspark.md)接着演示两条请求怎样分配有限的验证位置，再把期望输出除以整轮耗时，判断少验一些是否更快；接受、拒绝与补抽的基本规则仍由本页维护。

### 日志里的“接受率”应该怎样读？

先把三个计数分开：$R$ 是参与统计的验证轮数，$D$ 是提出的候选总数，$A$ 是其中接受的候选总数。这里 $A$ 不含拒绝处补抽或全部接受后的额外 token。普通自回归投机路径的草稿接受率是 $A \div D$；日志的平均接受长度则是 $1 + A \div R$，把每轮的那个额外 token 也算进去：

$$\text{AcceptanceRate} = \frac{A}{D}, \qquad \text{MeanAcceptanceLength} = 1 + \frac{A}{R}$$

| 统计项（两轮验证示意，$K = 3$） | 算式 | 结果 |
|---|---|---|
| 两轮提出的候选总数 $D$ / 接受数 $A$ | $D = 3 + 3$；$A = 0 + 2$ | $D = \mathbf{6\text{ 个}}$；$A = \mathbf{2\text{ 个}}$ |
| 草稿接受率 $A \div D$ | $2 \div 6$ | **约 33.3%** |
| 日志平均接受长度 $1 + A \div R$ | $1 + 2 \div 2$ | **2 个** |
| 第 1、2、3 位置被接受轮数与按两轮归一比例 | $1, 1, 0$ 轮分别除以 $R = 2$ | **50%、50%、0%** |

这个例子里第二位置的 50% 是除以全部两轮；如果只看第一位置已经通过的那一轮，第二位置的条件接受率反而是 100%。因此不能把日志逐位置比例直接代入前面假设“各位置条件概率都为 α”的公式。

**验证统计也不等于客户端最终收到的字数或 token 数。** 调度器先统计验证结果，再处理 EOS、停止条件和输出长度裁截；一轮原本验出了几个，不代表它们都会发给用户。性能比较还要看实际输出、耗时、并发和缓存状态。全局 Prometheus 计数器与请求级返回也有不同开关，具体入口见后面参数说明。

## 和调度、图模式怎样配合

按本页固定 K 的例子，候选提满且预算容得下时，一条 decode 请求每步不再是 1 个位置，而是 1 + K 个。调度、显存预留、图模式都要跟着这个数走。下图是一步在两个进程里的走法，站号对应[一条请求](one-request.md)走过的七站：

```wiki-diagram
file: speculative-decoding-flow
```

**调度：候选占普通名额，放不下先砍候选。** 调度器每步有一个 token 预算（一步最多算多少个位置）。它先定这一步给这条请求几个位置，再倒推放得下几个候选；不够时把候选截短，而不是把整条请求推到下一步。被排进来的候选记在这一步的计划里，请求手上的候选清空，等这一步末尾草稿猜出新的再写回去。

**本部署的图模式：只为整齐的 decode 步建整图。** [图模式](graph-mode-layer.md)把受支持范围内的设备任务事先录好，运行时一次提交。本部署选择的档位只给 decode 录整图，其余批次 eager；其他档位的捕获范围见图模式页。固定宽度投机解码与这条整图路径配合时：

- 每条 decode 请求固定占 1 + K 个位置，所以录图尺寸要是 1 + K 的倍数。配置的尺寸不是倍数时，vLLM 自动向上凑整；凑完一个都不剩（比如最大尺寸比 1 + K 还小），启动时报错。
- 一步能不能回放，要看它是否**整齐**：所有请求的提示词都已算完、每条请求正好 1 + K 个位置、总数不超过录过的最大尺寸；用了数据并行时，另一组也要整齐。混进一条还在算提示词的请求，这一步就整步退回 eager mode（不用图，算子逐个下发），判据见[这一轮回放哪一张图](graph-mode-layer.md#这一轮回放哪一张图五条判据)。
- 草稿层也可以单独录图，但那样要求草稿的批次也补齐到录图尺寸：草稿要录图、图模式又含 FULL（把整步前向录成一整张图的那一档，见[图模式的几档](graph-mode-layer.md#录多少nonepiecewisefull-和两个组合档)）时，关掉草稿批次补齐会在启动时报错。GLM 系列的草稿层固定不录图，见下一节。

**昇腾注意力：一条请求一轮最多 16 个位置。** 昇腾的融合注意力算子在 decode 时一条请求一轮最多处理 16 个 token，所以 1 + K 不能超过 16，即 K 最多 15。超了启动时直接断言失败。

**异步调度会不会被关掉。** [异步调度](async-scheduling.md#怎么开)让调度器不等这一步结果回来，先把下一步排好。基线的自动判定会检查投机方法和草稿批次补齐：MTP 属于可保留异步的 EAGLE 类路径；CPU ngram、小草稿模型或关闭草稿批次补齐会让这一组合自动退回同步。其他限制和显式配置的报错在异步页统一维护，main 对小草稿模型的规则也已不同。异步保留时，调度器先按候选全被接受排下一步，结果回来再改正。

**PagedAttention 那条算子路径不走。** 昇腾普通注意力后端里有一条 PagedAttention 算子路径，开了 speculative decoding 就一律不用它。

## 落到 GLM 双机：每步 1 + 3 个位置，MTP 层连跑 3 遍

官方双机部署是 2 台 Atlas 800 A2、每台 8 张 NPU：每台 8 张卡组成 TP 执行组（TP8），两台各接各的请求（DP2，每台是一个 DP 组），路由专家分到全部 16 张卡（EP16），两台共同持有完整的路由专家；权重是 W8A8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。这套部署开着 MTP，每轮猜 3 个。启动参数里写的方法名是 deepseek_mtp，vLLM 会把它改名成 mtp 并提示旧名已弃用；草稿就是模型自带的第 45 层，不另给草稿模型。完整命令见[部署基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)。3 是官方示例的选择，不是本知识库实测出的最佳值。

**MTP 层是什么样的。** 它在 45 层主干之外，结构和主干里的稀疏 MLA + MoE 层相同，只有单条残差；嵌入表和最后的词表投影（lm_head）与主模型共用同一份。它在每张卡上占多少权重，账在[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

**一个 decode 步。** 用 R1 来看（贯穿全库的示例请求，提示词 4 个 token，见[一条请求](one-request.md)）。R1 每步送进主模型 1 个已确定的 token 和 3 个候选，主模型 45 层都按 4 行算，词表投影出 4 行分数：前 3 行验候选，第 4 行留作 bonus token。验完以后，草稿层接着跑 3 遍（主干 45 层，另把 1 个 MTP 层接连跑 3 遍）：

$$\text{Layers}_{\text{step}} = 45 + 3 \times 1 = 48\text{ 层}, \qquad W_{\text{full}} = 32 \times (1 + 3) = 128\text{ 个位置}$$

| GLM 双机 decode 步统计项 | 算式 | 结果 |
|---|---|---|
| 每步前向层次 | $45 + 3 \times 1$ | **48 层**（主干 45 层 + MTP 连跑 3 遍） |
| R1 每步送进主模型 | $1 + 3$ | **4 个位置** |
| 一个 DP 组满载一步宽度 | $32 \times 4$ | **128 个位置**（正好是最大录图尺寸） |
| 满载一步最少 / 最多交回 | $32 \times 1$ / $32 \times 4$ | 最少 **32 个** / 最多 **128 个** token |

一步交回的这 1 到 4 个 token 还只是词表编号。它们回到前端后，由反分词接上已有的文字，拼成一段新增文字再推给客户端，所以客户端一次看到的可能是几个字，见[流式输出](streaming-output.md)。

R1 前两圈 decode 各接受几个、已算位置怎样从 8 退到 6、位置 6 和 7 怎样被覆盖，在[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)逐格算过：两圈一共写下 2 + 4 = 6 个 token，平均每圈 3 个。那里的「接受 1 个」「全部接受」是为了把账走通设的例子，这套部署真实的接受率还没有测量数据。

**验证怎么判。** greedy 请求逐位比最高分的词。随机采样的请求按前面的规则判：GLM 的草稿每遍都取最高分的词，与请求自己的温度设置无关，昇腾实现里也不保留草稿的概率，所以就是那个特例，主模型给候选的概率不小于一个随机数就留下。验证前，这 3 行分数照样经过惩罚项、温度、top-k、top-p 那一整套处理，见[采样](sampling.md#有-mtp-候选时采样变成验证)。

**草稿层固定 eager。** vllm-ascend 遇到 GLM 系列加 speculative decoding 的组合，会把草稿层强制切回 eager mode；主模型那一侧不受影响，仍按 FULL_DECODE_ONLY（只给整齐的 decode 步录 FULL 图，混合步不录）回放录好的图。这条强制附带一条警告，但只有草稿原本要录图时才打：官方命令已经给草稿写了不录图的选项，草稿本来就是 eager，所以这套部署的启动日志里看不到这条警告。草稿不录图，所以不补到录图尺寸；它的宽度另按两个 DP 组对齐，见下一节。

**每遍草稿的额外开销。** 每遍都要过一次完整的稀疏 MLA 和 MoE，并在 8 卡之间至少多做两次通信：草稿层出来后一次 [All-Reduce](collective-communication.md#all-reduce)，算候选分数时一次 All-Gather 把按词表切开的分数拼回来。稀疏 MLA 的索引器（先为每个位置挑出要读的历史，见[稀疏注意力](sparse-attention.md)）三遍各算一次，不复用第一遍挑出的结果。草稿第一遍的批次和主模型这一步一样宽，被拒的位置也跟着算，只是不从它们那几行取候选；后两遍沿用第一遍的宽度。

**录图尺寸与上限。** 主模型录了 4、8、16、32、64、96、128 七个尺寸，都是 4 的倍数，不用再凑整，分别对应 1 到 32 条请求。1 + 3 = 4，在昇腾注意力 16 个的上限之内。

**KV 和状态多留的那几格。** 存 KV 的层是主干 11 层稀疏 MLA 加 MTP 这一层，一共 12 层，每 token 每卡 13,056 B，账在[剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；每条请求为候选多留 3 个位置。34 层 KDA 分成三组，每组每条请求占 4 块：1 块当前状态 + 3 块候选状态，见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。KDA 前面短卷积的核长是 4，它的缓存本来记 3 个位置，为候选多留 3 格，变成 6 格。

**快到长度上限时。** 草拟时位置超过模型长度上限的候选按作废处理；调度器也会把这一步能排的位置截到不超过上限，所以那一步进模型的位置会少于 4 个，整齐条件不成立，这一步不回放图。

## GLM 双机上多条请求时：补齐和陪跑跟着放大

多条请求一起跑时，MTP 让每条请求一步占 4 个位置，两件和批次有关的事都跟着放大。推导在[多条请求](concurrent-requests.md)一页，这里只给结论。

- **补齐到录图尺寸。** 一步的 token 数要向上补到最近的录图尺寸。同样 12 条 decode 请求，不开时是 12 个 token，补到 16，空跑 4 格；开了 MTP 是 48 个，补到 64，空跑 16 格，绝对浪费放大 4 倍，见[先补到自己这组的图尺寸](concurrent-requests.md#先补到自己这组的图尺寸)。不开 MTP 时 32 条请求只需要 32 这一档，开了才要一路录到 128。
- **两组对齐，草稿陪跑。** 两个 DP 组每步要对齐宽度：主模型补到两组里较大的那个，草稿层三遍也按较大的那组跑。一组混进一条长提示词，两组这一步都用不上图，草稿层也被一起拉宽；没有请求的那一组也要带着草稿层空跑，见[再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)和[空闲组为什么陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

## 常见误解

- **「被拒的候选等于白算。」** 要区分判定候选的输出与候选自身作为输入的计算。主模型用前一输入位置的输出检验候选，并在第一个拒绝处给出替代 token；被拒候选自身及后续候选的前向和 KV 写入，不再用于本轮继续生成。此外还有草稿计算开销。随机采样下讨论的是输出分布一致，不能把补抽结果说成与一次独立采样必定相同。
- **「开了以后输出会变差。」** 按默认判法，每一格输出各个词的概率和主模型直接生成一样，greedy 时逐个 token 相同（不计浮点误差）。昇腾可选的 block verify 和 entropy verify 改变了接受规则，不能套用这份保分布结论；两者默认都关闭，见前面的反例。
- **「每步至少写下 1 个，所以最差也不会比不开慢。」** 步数不会更多，但每步更贵；接受率低或并发高时，总时间可以更长。
- **「一个 MTP 层只能猜一个。」** 可以接连跑多遍，每遍把上一遍的候选当输入；后面各位置的条件接受率要测量，不能仅凭调用次数断定必然下降。
- **「草稿先跑，主模型后跑。」** 一步之内顺序反过来：主模型先验这一步的候选，草稿再用刚算出的结果猜下一步的。
- **「被拒位置的 KV 要专门回收。」** 不用。已算位置退回几格，下一步原地覆盖；递推状态是事先多存几份，按接受数挑。
- **「GLM 的草稿也回放图。」** 不回放。主模型回放 FULL 图，草稿层被强制成 eager。
- **「MTP 是一套独立的实现。」** 在 v0.23、v0.26 和 GLM 固定提交上，mtp 和 eagle 走同一个草稿类；已钉 main 与 rc2 则为 GLM 这种 KV cache 分成多组的 MTP 使用专用子类。

## 对照源码

### 怎么开

**五个参数管的是启动时采用哪一种草拟方式。** 容器叫 speculative_config，其中 method 选方法，model 指定草稿权重来源，num_speculative_tokens 指定候选数 K，enforce_eager 控制草稿是否禁用图。它们不放进每次 Chat/Completion 请求；请求温度和输出上限仍由[采样](sampling.md#怎么开)与[API 入口](api-server-entry.md#怎么开)解释。

| 参数与入口 | 输入类型、缺省 | 生效含义 |
|---|---|---|
| `speculative_config`；CLI `--speculative-config` / `-sc` | JSON 对象；EngineArgs / Python LLM 使用字典，默认 None | 启动时构造成 SpeculativeConfig，注入目标模型与并行配置。普通 GLM 入口不提供它且不提供三个快捷选项时，不创建投机配置；空对象不是关闭 |
| `speculative_config.method`；快捷 `--spec-method` / Python spec_method | 合法方法字符串，默认 None | 缺省先推断；一般模型起点为 draft_model，读草稿配置后还会识别 EAGLE/MTP 等。GLM 显式选 deepseek_mtp，解析后归一为 mtp |
| `speculative_config.model`；快捷 `--spec-model` / Python spec_model | 字符串或 None，默认 None | 草稿模型、预测头或附加权重的名称/路径；不是服务所用主模型的 model。MTP 满足下述条件时复用主模型路径，不加载一套独立主干来充当草稿 |
| `num_speculative_tokens`，在容器内；快捷 `--spec-tokens` / Python spec_tokens | 正整数，输入默认 None | 一轮最多提出的候选数 K，不是输出 token 保证值，也不是 MTP 层数。没有草稿配置可回填时必须显式提供；GLM 配方给 3 |
| `speculative_config.enforce_eager` | bool 或 None，默认 None | True 禁用草稿图；None/False 在基线 Ascend 中都先看 Runner 是否允许图，再接受模型特定限制。与顶层主模型 enforce_eager 是两个字段 |

来源 38–44 对应字段、入口、构造和校验。CLI 也支持点号形式，例如 `-sc.num_speculative_tokens=3`，点号后用原下划线字段名（来源 45）。独立快捷选项与 JSON 对象可以分担不同字段；**同一字段同时从两处提供就报互斥错误，值相同也不例外**。例如 JSON 已含 method，再给 --spec-method mtp 就被拒绝；仅给 --spec-method mtp 和 --spec-tokens 3 则先合成配置。Python LLM 的三个快捷参数经 EngineArgs 走同一合并规则。

GLM 双机按官方命令开 MTP（这里只摘投机那一项，完整命令见[部署基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)）：

```bash
--speculative-config '{"method": "deepseek_mtp", "num_speculative_tokens": 3, "enforce_eager": true}'
```

这份对象没有 model，仍能找到草稿，因为 **method 已归一成 mtp、model 为 None、且 K 已提供**，满足同模型复用分支。基线从目标模型的 model 路径读草稿配置；未给草稿量化时还继承目标量化。GLM 补丁把草稿模型类型改成 glm5_next_mtp，预测层数取 num_nextn_predict_layers=1（来源 56、57）。K=3 表示同一层串行使用三遍，主模型验证宽度变成 1+K；计算、状态与额外通信继续用上文 GLM 算例。

**None、空对象与少填字段的区别。** 在本页普通 GLM 启动路径中，容器为 None 且三个快捷参数都缺省，直接返回无投机配置；Worker 没有草稿器，候选表为空，不进验证路径。传 {} 却会尝试构造配置，随后因缺 K 被拒绝。只传 method=mtp、没给 model 和 K，也不会触发同模型复用；只给 K=3 而没方法/模型，则按 draft_model 起步，因缺草稿模型报错。关闭 MTP 应移除整个配置及三个快捷选项，不用 K=0 代替。

**候选数的默认不能只照字段注释套。** 配置中有从草稿 n_predict 回填 K 的通用分支；但四份固定上游源码在识别到 MTP 模型时，会先比较 K>1 以决定是否提示重复使用预测层，之后才到回填分支。因此显式给 MTP model 却省 K 时，会先遇到 None 与整数比较的 TypeError；不能承诺本站 GLM 自动取 1。GLM 配方显式给 3，避开这一顺序问题。进入后续校验后，如果 K 大于预测层数 n，还要求 K 是 n 的整数倍；n=1 的 GLM 不会因此拒绝任何正整数，但仍受下面的注意力、图和容量约束。

K 的字段类型是 int，None 是内部延后填值的默认，并不表示显式 JSON null 是合法候选数。可省略时由后续分支派生；本站配方直接给正整数，不用 null 或空字符串表示自动。

**方法名合法，不等于当前 Ascend 支持对应模型。** 基线字段接受 ngram、ngram_gpu、medusa、mlp_speculator、draft_model、suffix、custom_class、eagle、eagle3、extract_hidden_states、dflash、mtp。它还接受下列 MTP 旧名并统一改成 mtp：deepseek_mtp、mimo_mtp、mimo_v2_mtp、glm4_moe_mtp、glm4_moe_lite_mtp、glm_ocr_mtp、ernie_mtp、nemotron_h_mtp、exaone_moe_mtp、exaone4_5_mtp、qwen3_next_mtp、qwen3_5_mtp、longcat_flash_mtp、pangu_ultra_moe_mtp、step3p5_mtp、hy_v3_mtp、gemma4_mtp。合法集合与转换按来源 38、42；名称区分大小写。其他方法是否能由昇腾草稿器和模型加载器接住，要分别核实现，不能仅凭通过字段解析判断可用。本站沿用官方 deepseek_mtp 写法；mtp 是归一后的方法名，弃用提示不代表本配方不能启动。

model 的自动识别也有边界：v0.23 基线把“含点、不含斜杠、也不以 HTTP/HTTPS/file URL 开头”的字符串当作自定义 Python 类路径，并覆盖 method；v0.26、rc2 和固定 main 已改为仅在 method 未指定时尝试，且点分的每一段都须是 Python 标识符。普通模型读入配置后，还会按模型名中的 eagle-/eagle3/dflash 或模型类型识别。写本地模型目录时应给清晰路径，不把含点的裸目录名当作不会参与方法推断的普通标签。

**词表兼容也要看实际草稿器。** 基线独立草稿要求与目标模型的词表大小相同。上游 rc2 和固定 main 增加了 `use_heterogeneous_vocab`，默认 False，只允许 `draft_model` 且草稿采用 greedy：执行器建立公共 token 映射，屏蔽不在交集内的草稿 token，再把候选编号映回目标词表。Ascend rc2 的草稿类直接初始化自己的基类并继续检查词表大小，没有调用上游这段映射初始化；不能看到上游有字段就把异词表草稿配方搬到 NPU。本站自带 MTP 路径也不借同词表校验来证明任意模型兼容。

**草稿 eager 看实际执行顺序。** 基线 Ascend 先由 Runner 的图可用性与草稿字段共同决定 use_cuda_graph，再检查“禁用草稿补齐 + FULL 图”的不兼容组合，最后才强制关闭 GLM 草稿图（来源 14、46）。主模型图配置的默认和关闭后果见[主模型图参数](graph-mode-layer.md#怎么开)。

| 主模型/Runner 图是否可用 | 草稿 enforce_eager | GLM 最终草稿行为 |
|---|---|---|
| 可用 | True | 一开始就不使用图，无 GLM 切换警告 |
| 可用 | None 或 False | 先按允许图检查补齐；检查通过后 GLM 强制 eager，并打印切换警告。False 不能绕过保护 |
| 不可用（例如主模型强制 eager 或图为 NONE） | 任意值 | 草稿不使用图，不触发 GLM 从图切回 eager 的警告；False 不能单独恢复图 |

因此“不写草稿 eager 就必有警告”不成立；要同时满足原本可用图且未被更早检查拒绝。官方配方明确写 True，主模型仍保留 FULL_DECODE_ONLY。disable_padded_drafter_batch 默认为 False，改成 True 的异步与图影响见[异步配置](async-scheduling.md#怎么开)，GLM 的最终禁图保护不会替用户绕过更早的补齐检查。

可选验证方式仍在昇腾 additional_config.rejection_sampler_config：enable_block_verify / enable_entropy_verify 默认 False，posterior_threshold 默认 0.95、posterior_alpha 默认 0.4。本站未覆盖这些默认，机制与分布限制仍见前文。

**换草稿方法时，还要看哪些配置？**

下表字段都在 `speculative_config` 内。它们改变候选的来源或上限，不会把 K 变成“每轮保证输出几个”。

| 方法 / 字段 | 固定实现的默认与作用 | 使用时的边界 |
|---|---|---|
| ngram：`prompt_lookup_min`、`prompt_lookup_max` | 输入默认都为 None；两者均省时实际都补成 5，只给一端时另一端取同值 | 必须为正数且 min ≤ max；这是匹配窗口长度，候选个数仍由 K 限制。不能把字段注释里的 min=1 当成最终双缺省行为 |
| suffix：`suffix_decoding_max_tree_depth` | 24，限制树的深度；K 省略时用这个值回填 | 官方示例显式写 K=32，不是源码的缺省值。运行时还受匹配长度、树中可用后续和主模型验证上限限制 |
| suffix：`suffix_decoding_max_cached_requests` | 10000，全局树最多保留的历史响应数，超出按 FIFO 淘汰 | 0 关闭历史响应缓存，当前请求的局部树仍保留；这不是 GPU KV 块数 |
| suffix：`suffix_decoding_max_spec_factor` | 1.0，候选上限同时受“匹配长度 × 系数”限制 | K 只是另一个上限，不保证每次提满 |
| suffix：`suffix_decoding_min_token_prob` | 0.1；沿所选路径累积基于频次的概率，低于门槛就停止延伸 | 是文本树对续写的估计，不是主模型最终接受概率；固定调用走单路径，不直接启用论文中的树形候选验证 |
| 并行草稿：`parallel_drafting` | False；启用后使用训练过的占位输入并一次生成 K 个候选 | 草稿检查点要支持相应接口；不能只给普通自回归草稿加一个 True |

Suffix 的固定上游校验在缺少依赖时提示安装 `arctic-inference==0.1.1`；它不是 `>=0.1.1` 的版本下限校验。本页树缓存和选路径的说明按 0.1.1 发布包及与它逐字节相同的官方固定源文件核对，不表示任意更新版本都保持实现不变。配置可被解析、Ascend 工厂有对应分支、具体模型能在设备上跑通，是需要分别确认的条件。

**怎样拿到某条请求的投机统计？**

上游 rc2 与固定 main 提供 `--per-request-spec-decode-metrics`：默认 `none`，`summary` 返回平均接受长度、草稿接受率及按每轮接受草稿数分组的步数直方图；`detailed` 还保留逐轮接受数、提出数数组。结果放在响应的 `metrics.speculative_decoding`，只对 `n=1` 的单序列请求输出；Completions 还要求只有一个 prompt。流式请求把它放在最终 usage 块，因此需要请求 `stream_options.include_usage=true`，或由服务端强制开启 usage。它独立于 `--disable-log-stats`，但必须实际启用投机解码。

这些统计从调度器的验证结果进入请求状态，再由输出处理器和 API 组装，不能只凭 CLI 字段存在判断已经生效。计数发生在本轮输出按停止条件截断之前，解释方法沿用[接受率口径](#日志里的接受率应该怎样读)，不能拿平均接受长度直接当客户端每个流式块的 token 数。该响应结构在官方配置中标为实验性；v0.23、v0.26 的固定比较点没有这条请求级接口，聚合日志和 Prometheus 指标另算。

### 会报什么错

| 五项配置的输入问题 | 源码结果 | 如何处理 |
|---|---|---|
| 同一 method/model/K 同时出现在快捷选项与 JSON 中 | ValueError，包含 mutually exclusive；来源 41 | 每个字段只从一个入口提供 |
| 空对象，或只给 mtp 方法而没有 model/K | 缺 num_speculative_tokens 的 ValueError；来源 42、44 | 按官方完整对象给方法、K、草稿 eager；关闭则移除容器和快捷选项 |
| 只给 K，没有方法或草稿模型 | ValueError，提示提供了候选数但没有 speculative model；来源 42 | 自带 MTP 显式给方法；独立草稿给正确权重路径 |
| K=0 或负数 | 字段 gt=0 与后验正数检查拒绝；来源 38、44 | 使用正整数；0 不是关闭值 |
| 显式 MTP model、K 缺省 | 先执行 K>1，产生 TypeError，而不是自动补 1；来源 43、49、53 | 显式给 K，本站为 3；这是固定源码顺序，不是硬件故障 |
| K 大于 n_predict 且不能整除 | ValueError，提示 must be divisible；来源 43 | 按预测层数选择 K，并核对执行侧上限 |
| method 不在固定版合法集合，或识别后未被方法分支支持 | 字段枚举校验或 Unsupported speculative method 错误 | 先用本站已核配方；上游集合不等于昇腾支持矩阵 |

- 注意力元数据构建器里 `decode_threshold = 1 + K`，紧接 `assert decode_threshold <= 16`，报错串写明 `npu_fused_infer_attention_score` 的 TND 布局一轮最多 16 个 token。GLM 走的 SFA 后端、MLA 与普通注意力后端都有这一句。
- `ValueError: No valid cudagraph sizes after rounding to multiple of ...`：录图尺寸凑成 1 + K 的倍数后一个都不剩。
- `NotImplementedError: Speculative Decoding with cudagraph mode containing full cudagraphs only supports padded drafter batch`：关了草稿批次补齐、Runner 允许草稿图、草稿 eager 为 None/False、且图模式含 FULL。这一检查排在 GLM 强制 eager 之前，GLM 也会在满足这些条件时被拒绝。
- 警告 `method deepseek_mtp is deprecated and replaced with mtp`：上面说的改名。
- 警告 `Enabling num_speculative_tokens > 1 will run multiple times of forward on same MTP layer, which may result in lower acceptance rate`：K 大于 1 且草稿是 MTP（`step3p5_mtp` 除外），GLM 的 K = 3 会触发。
- 警告 `GLM series models with speculative decoding currently do not support graph mode ...`：GLM 草稿被切回 eager。只在草稿原本要录图且通过前置检查时打印（Runner 允许图、草稿 eager 为 None/False）；官方命令写了 True，所以按这条源码路径不会打印该警告。
- `RuntimeError: Expected num_accepted_tokens for Ascend GDN speculative conv1d path.`：KDA 这类递推层的投机路径缺了「上一步留下几个」。正常运行不会出现，出现说明元数据没传对。
- 上游拒绝采样器要求每条请求的候选数不超过 128（`MAX_SPEC_LEN`）。

### 开销和什么时候别开

- 低并发、看重单条请求时延时收益最大；并发高、只看吞吐时收益缩水，要实测再定。GLM 官方命令开着 MTP，但本知识库没有这套部署的接受率与开关对照数据。
- 本站 GLM 草稿是自回归的：一步末尾串行跑 K 遍（第一遍之后再跑 K − 1 遍），K 越大这段越长。并行草稿另用训练过的占位输入，一次产生 K 个候选。
- 文本匹配不增加草稿模型 KV，主模型的验证位置仍要留，Suffix 的 CPU 树也占内存；匹配不到时不提候选。
- 录图尺寸补齐的空跑按 1 + K 倍放大；两个 DP 组时草稿层也按较大一组的宽度陪跑。
- 开了 speculative decoding 就不走昇腾的 PagedAttention 算子路径。
- 每条请求多占 K 个 KV 位置；递推层多占 K 份状态，卷积缓存多 K 格。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**本文 GLM 双机绑定算例采用例外 B 专用镜像钉点 `vllm-ascend@db701c1f` + `vllm@0fc695fc`**。普通逐位验证流程（`1 + K` 预算扣减、首个不符即停、被拒位置原地覆盖）与注意力 `decode_threshold <= 16` 断言（`sfa_v1.py#L529-L538`、`#L555-L565`）在四版保持一致；显式开启 `block / entropy verify` 时按前文另一套接受边界理解。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 投机分派与 Runner 形态 | MRV1 `get_spec_decode_method`；`mtp` 与 `eagle` 共用 `AscendEagleProposer`（无 `glm5_next`） | 同 MRV1，新增 `dspark` 分支 | **MRV1/MRV2 双轨并存**：MRV1 `spec_decode/__init__.py#L41-L70` 覆盖 `ngram/suffix/medusa/dspark/gemma4/step3p5/multi_kv_cache_group/dflash/dflash2/draft_model/extract_hidden_states`；MRV2 `worker/v2/spec_decode/__init__.py#L25-L78` 统一 `init_speculator`（`AscendMTPSpeculator`、`AscendEagleSpeculator`、`AscendDSparkSpeculator`、`AscendDFlash/2`） | **删除 MRV1，全面收敛至 MRV2 统一 `spec_decode`**（`worker/v2/spec_decode/__init__.py#L29-L112`），补齐 `NgramGPUSpeculator`、`AscendLiLiCorrSpeculator`、`AscendGemma4Speculator`、`AscendMultiModuleMTPSpeculator` 与 `AscendStandaloneARSpeculator` |
| `1 + K` 预算、录图与 GLM 草稿图 | 录图尺寸按 `1 + K` 向上凑整；GLM 草稿强制 eager（`db701c1f` 同样） | 同 `v0.23.0`；上游新增按批大小 `num_speculative_tokens_per_batch_size` | 调度器按 `1 + num_spec_tokens` 核算统一 decode 宽度（`scheduler.py#L1045-L1060`），`adjust_cudagraph_sizes_for_spec_decode`（`compilation.py#L1545-L1570`）联动 ACLGraph；MRV1 GLM 专用子类 `AscendMultiKVCacheGroupMTPProposer` 声明 `_glm_draft_graph_supported = True`（`#L40-L55`）跳过强制 eager，仍受显式 `enforce_eager` 约束 | 延续 `1 + num_spec_tokens` 预算与录图对齐（`scheduler.py#L1365-L1380`、`compilation.py#L1688-L1715`）；`enforce_eager` 在 MRV2 `init_speculator` 内通过拷贝 `compilation_config` 置 `CompilationMode.NONE` 生效 |
| 配置入口、Speculators 与请求级指标 | 容器 `None` 关、`{}` 报错；旧 MTP 名归一；无请求级统计；Speculators 重建配置不合并覆盖项 | 合并后归一键名；自定义类仅未给方法时推断；增 `dspark` 等方法名 | 优先 `model_weights`；Speculators 先转后合并并锁定 `model/method`；新增 `--per-request-spec-decode-metrics`（`none/summary/detailed`）与 `use_heterogeneous_vocab`（Ascend MRV1 未接）；structured output 去 `-1` 占位校验 | 延续 `v0.30.0` 字段与 `use_heterogeneous_vocab` / `num_speculative_tokens_per_batch_size`（`speculative.py#L540-L585`）；MRV2 工厂仍无 `mlp_speculator` 分支 |
| 草稿滑动窗口、动态变长与验证判法 | 无滑动窗口；固定 `K`；`block / entropy verify` 默认关；文档 16/15 口径混用（代码为 16） | 从 `additional_config` 直读窗口（不分方法，MTP 亦受影响）；文档改为 `<= 16` | `AscendConfig` 纳管 `draft_window_size`（MTP 告警忽略）与 `dynamic_spec_config`（`dspark/dflash`）；MRV2 另提供 `enable_adaptive_verification`；`block / entropy verify` 默认关并改为数据类 | MRV1 退场后草稿变长收敛至 MRV2 `enable_adaptive_verification`（与 `AscendDSparkSpeculator` 联动，见 [DSpark](dspark.md#ascend-的变长验证要先分清依据和执行器)）；文档与代码上限均保持 `<= 16` |

键名归一指把配置对象键中的连字符换成下划线。v0.26 起相比基线增加 `dspark`、`minimax_m3_mtp`、`bailing_hybrid_mtp`、`inkling_mtp`；`v0.30.0` 与 `main` 还增加 `dots3_note_mtp`、`qwen4_exp_mtp`、`bailing_hybrid_v3_mtp`、`kimi_k3_mtp`、`hy_v4_mtp`、`glm5_next_mtp` 等合法名称（不等于所有 NPU 模型的可用清单）。固定镜像 `db701c1f` 的 GLM MTP 位于 `glm5_next_mtp.py`，`v0.30.0` 与 `main` 迁移至 `models/glm5next/mtp.py` 并将首位清零与两路归一化、拼接改为融合算子调用；`dflash` 分支按草稿配置分派 DFlash/DFlash2，`dflash2` 不是顶层工厂方法名。并行草稿在各版均有专门分支，但须与具体检查点、图模式和注意力组合匹配。来源 47–63 与新增 `c09d3e20` / `8d6180e2` / `ced6857a` / `ba15685a` 锚点对应上述版本分派与预算校验。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| greedy 与随机接受、补抽分布（上游） | `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py`，`rejection_greedy_sample_kernel`、`rejection_random_sample_kernel`、`sample_recovered_tokens_kernel` |
| 昇腾拒绝采样与两种可选判法 | `vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py`；`vllm_ascend/ops/triton/reject_sample.py` |
| 预算截短候选、被拒回退、lookahead | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`；`vllm/v1/core/kv_cache_manager.py` 的 `allocate_slots` 注释 |
| 方法改名、K > 1 警告 | `vllm@0fc695fc:vllm/config/speculative.py` |
| 录图尺寸凑整与报错 | `vllm@0fc695fc:vllm/config/compilation.py`，`adjust_cudagraph_sizes_for_spec_decode` |
| 注意力 16 个上限 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py`（另有 `mla_v1.py`、`attention_v1.py`） |
| 草稿类分流 | `vllm_ascend/spec_decode/__init__.py`，`get_spec_decode_method` |
| GLM 强制 eager、草稿三遍、DP 对齐 | `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py`，`_is_glm_model`、`_run_merged_draft`、`_propose` |
| GLM 的 MTP 层 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py` |
| 递推层的候选状态 | `vllm_ascend/ops/gdn_attn_builder.py`；`vllm_ascend/ops/kimi_kda_state.py` |
| 整齐 decode 的判据 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` |

一步之内的先后：昇腾先做 Worker 侧的记账（`_bookkeeping_sync`）再草拟，上游 vLLM 是先草拟再记账；两者都在验证之后。GLM 的 config 里 `index_share_for_mtp_iteration` 为 `true`，但 `db701c1f` 里没有对应的复用实现，三遍草拟都重算索引器。

**正文证据归档。** 第一个不符之前逐位比最高分、全对补 bonus [C1]；随机请求按 p ÷ q 与随机数比、草稿概率缺省时取 1 [C2]；补抽用 max(0, p − q)，草稿概率缺省时去掉候选再抽 [C3]；接受加补抽保持主模型分布 [S4][S5]，3 个词的验算、平均每轮写下数与加速比都由此推出 [D]。entropy verify 把随机数乘一个不超过 0.95 的系数 [C19]，两种判法默认关 [C20]；昇腾侧整套验证顺序见来源第 18 条。

预算不够时截短候选 [C6]，结果回来按被拒数退回 [C7]（下一步原地覆盖由退回后的位置号推出），只登记已验证 token、为草稿多留位置 [C8]（各草稿方法多留几格见第 9 条）。方法改名与 K > 1 警告 [C10][C11]；录图尺寸凑整与报错 [C12]；16 个上限 [C13]；整齐判据 [C23]；异步调度自动判定 [C36]；PagedAttention 互斥见第 24 条。

GLM 强制 eager 与补齐检查的先后 [C14]，三遍草拟取最高分 [C15]，草拟补到两组最大宽度 [C16]，MTP 层结构与按步取模选层 [C17]；MTP 层数 [S30]。递推层取 K + 1 份状态 [C21]，卷积缓存多留 K 格 [C22]。MTP 层数用于说明重复调用的结构，不单独证明模型的训练目标或精度收益。

版本表：main 的 GLM 草稿子类 [C27]，文档上限 [S28][S29]，上游按批大小变的配置 [C31]，v0.26 的草稿滑动窗口 [C32]；其余各行依次见来源第 25、26、33、34、35、37 条。

方法与配置：官方方法指南见来源 68–77；ngram 的当前序列匹配与缺省见 78–80，Suffix 的调用、依赖和四版缺省见 81–95，Arctic 树缓存与选路径见 172–174。并行草稿的实际一次返回分支见 96–101；MLP 执行入口边界见 102–106（rc2 工厂复用 64），Gemma4 的检查点例外见 73、107。隐藏状态采集与文件交付见 108–110；Speculators 转换、入口和版本合并规则见 111–116；异词表条件与实际执行器见 117–122。四篇方法论文见 175–178。

统计与状态：日志/聚合指标的定义见 123、124；请求级配置、调度计数、输出状态和 API 消费者见 125–144，最终 usage 的请求与服务端入口见 179–182。block verify 的随机数、完整分派、恢复和接受规则见 145–159；两词反例按这些规则推导。KDA 有效输出计数、状态搬移、元数据传递、实际算子与索引槽选择见 160–171。它们说明固定实现行为，不代替下面的设备测量。

**实际测量边界。**

- 这套部署的真实接受率、每轮留下个数的分布，以及开、关 MTP 的首 token 时延、生成间隔与吞吐对照（需要 benchmark 输出）。
- 开了 MTP 以后每步实际贵了多少：草稿三遍各自的耗时、主模型 4 行与 1 行的耗时差。
- v0.26 上 MTP 被套上草稿滑动窗口后的实际影响：只核到「不分方法」，没有实跑。
