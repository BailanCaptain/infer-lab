---
id: sampling
title: Sampling：从词表分数里定下一个 token
type: concept
summary: >-
  模型给词表里每个词打完分，sampling（采样）按请求的设置从中定下一个 token。本页用 6 个词的小例子手算
  temperature、softmax、top-k、top-p 和按概率抽取，对照 greedy，再讲停止条件；最后落到 GLM 双机：8
  张卡各采一遍、只交回一份，MTP 候选怎样验证。
aliases:
  - sampling
  - 采样
  - 采样器
  - logits processor
  - 自定义改分规则
  - logits_processors
  - logits-processors
  - vllm_xargs
  - AdapterLogitsProcessor
  - Sampler
  - temperature
  - 温度
  - top-p
  - nucleus sampling
  - 核采样
  - greedy
  - 贪心
  - 贪心解码
  - SamplingParams
  - thinking_token_budget
  - 思考预算
  - reasoning-config
  - 采样参数
  - 停止条件
  - top_p
  - top_k
  - top-k 采样
  - seed
  - 请求随机种子
  - 全局随机种子
  - generation_config
  - generation-config
  - 生成配置
  - override_generation_config
  - override-generation-config
  - 生成配置覆盖
  - presence penalty
  - 出现惩罚
  - frequency penalty
  - repetition penalty
  - logit_bias
  - logit bias
  - 分数偏置
  - allowed_token_ids
  - allowed token ids
  - 允许的 token 编号
  - token 白名单
  - bad_words
  - bad words
  - 禁词
  - 禁用词串
  - min_tokens
  - min tokens
  - 最少输出 token 数
  - 最少输出数
  - top_logprobs
  - flat_logprobs
  - logprobs-mode
  - '--logprobs-mode'
  - max_logprobs
  - max-logprobs
  - '--max-logprobs'
  - 概率记录
  - 指定 token 概率
chapters:
  - '05'
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json
  - 'https://arxiv.org/abs/1904.09751'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L20-L58'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L228-L302'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L352-L393'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L426-L457'
  - 'vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L100-L115'
  - 'vllm@0fc695fc:vllm/model_executor/layers/utils.py#L51-L89'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L235-L265'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L470-L476'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L511-L533'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L590-L618'
  - 'vllm@0fc695fc:vllm/config/model.py#L159-L164'
  - 'vllm@0fc695fc:vllm/config/model.py#L285-L291'
  - 'vllm@0fc695fc:vllm/config/model.py#L1458-L1510'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L523-L576'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L205'
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L117'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L830'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L20-L43'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L192'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L269-L302'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L256-L263'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L321'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2610'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L449-L470'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L200-L215'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1290-L1299
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L498-L499'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L286-L302'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L262-L271'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L263-L268'
  - 'vllm@568afb3a:vllm/sampling_params.py#L538-L556'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L72-L100'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L2730-L2809'
  - 'vllm@0fc695fc:vllm/config/model.py#L229-L235'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - 'vllm@0fc695fc:vllm/v1/sample/ops/bad_words.py#L1-L30'
  - 'vllm@0fc695fc:vllm/_custom_ops.py#L360-L373'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L280-L330'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L429-L437'
  - 'vllm@0fc695fc:docs/usage/reproducibility.md#L3-L8'
  - 'vllm-ascend@2c59ff10:docs/source/faqs.md#L167-L202'
  - >-
    raw:sha256-99e1bba849ee1c49ae4ae8dc783b9199122b9f6b5a2dc6c664e23c618883a618.md#L1-L1324
  - 'vllm@0fc695fc:vllm/sampling_params.py#L497-L510'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/penalty.py#L60-L123'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L395-L400'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L188-L248'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L617-L625'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L56-L81'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L244-L257'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L317-L325'
  - 'vllm@568afb3a:vllm/sampling_params.py#L224-L236'
  - 'vllm@568afb3a:vllm/sampling_params.py#L520-L537'
  - 'vllm@84030bbe:vllm/sampling_params.py#L240-L252'
  - 'vllm@84030bbe:vllm/sampling_params.py#L553-L570'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L46-L71'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L46-L78'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L290-L391'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/triton/penalty.py#L60-L123'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/triton/penalty.py#L60-L123'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/triton/penalty.py#L64-L127'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L943-L965'
  - >-
    vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L1009-L1040
  - >-
    vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L1080-L1111
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L415-L420'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L473-L482'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/penalties.py#L13-L45'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L620-L624'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L297-L301'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L677-L681'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L324-L328'
  - >-
    vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L1005-L1011
  - >-
    vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L1091-L1097
  - >-
    vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L1169-L1175
  - 'vllm@0fc695fc:vllm/sampling_params.py#L317-L422'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L579-L659'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L700-L840'
  - 'vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L118-L164'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L371-L420'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/bad_words.py#L1-L58'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L249-L264'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L617-L648'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L56-L346'
  - 'vllm@568afb3a:vllm/sampling_params.py#L659-L882'
  - 'vllm@84030bbe:vllm/sampling_params.py#L720-L1050'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L90-L375'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L90-L405'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L100-L144'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L82-L329'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L426-L448'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/tokenize/protocol.py#L24-L163'
  - 'vllm@84030bbe:vllm/envs.py#L1157-L1166'
  - 'vllm@84030bbe:vllm/v1/worker/gpu/sample/bad_words.py#L13-L65'
  - 'vllm@568afb3a:vllm/sampling_params.py#L317-L478'
  - 'vllm@84030bbe:vllm/sampling_params.py#L340-L517'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L449-L455'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L282-L283'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L694-L697'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L300-L301'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L753-L756'
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/sample/ops/topk_topp_sampler.py#L394-L416
  - 'vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/model.py#L229-L235'
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/sample/sampler.py#L286-L302
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/sample/sampler.py#L258-L265
  - 'vllm@0fc695fc:vllm/sampling_params.py#L534-L548'
  - 'vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L167-L295'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L95-L142'
  - 'vllm@568afb3a:vllm/v1/core/sched/utils.py#L94-L130'
  - 'vllm@84030bbe:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@568afb3a:vllm/v1/sample/logits_processor/builtin.py#L167-L295'
  - 'vllm@84030bbe:vllm/v1/sample/logits_processor/builtin.py#L167-L371'
  - 'vllm@84030bbe:vllm/sampling_params.py#L606-L620'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L121-L142'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L178-L198'
  - 'vllm@0fc695fc:vllm/config/model.py#L1425-L1456'
  - 'vllm@0fc695fc:vllm/transformers_utils/config.py#L1141-L1171'
  - 'vllm@568afb3a:vllm/config/model.py#L1469-L1555'
  - 'vllm@84030bbe:vllm/config/model.py#L1693-L1781'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L428-L484'
  - 'vllm@568afb3a:vllm/sampling_params.py#L450-L623'
  - 'vllm@84030bbe:vllm/sampling_params.py#L487-L662'
  - 'vllm@0fc695fc:vllm/utils/torch_utils.py#L405-L412'
  - 'vllm@0fc695fc:vllm/config/model.py#L285-L298'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L784-L798'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L839-L849'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L614-L701'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L671-L761'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1204-L1211'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L385-L397'
  - 'https://numpy.org/doc/stable/reference/random/legacy.html'
  - 'vllm@568afb3a:vllm/sampling_params.py#L236-L251'
  - 'vllm@84030bbe:vllm/sampling_params.py#L252-L269'
  - 'vllm@568afb3a:vllm/config/model.py#L159-L164'
  - 'vllm@84030bbe:vllm/config/model.py#L180-L185'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L214-L251'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L231-L268'
  - 'vllm@568afb3a:vllm/config/model.py#L294-L307'
  - 'vllm@84030bbe:vllm/config/model.py#L330-L343'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L262-L288'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L683-L774'
  - 'vllm@0fc695fc:vllm/config/model.py#L224-L235'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L819-L823'
  - 'vllm@0fc695fc:vllm/logprobs.py#L12-L206'
  - 'vllm@0fc695fc:vllm/v1/engine/logprobs.py#L42-L119'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L72-L225'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L693-L723'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L1367-L1453'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L409-L437'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L605-L689'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L665-L687'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L747-L787'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L335-L375'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L447-L491'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L489-L552'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/serving.py#L652-L737'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L199-L246'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L190-L245'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/rejection_sampler.py#L185-L260'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/rejection_sampler.py#L194-L256'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/rejection_sampler.py#L200-L262'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L191'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L146-L191'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L111-L171'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L112-L172'
  - 'vllm@568afb3a:vllm/sampling_params.py#L745-L815'
  - 'vllm@84030bbe:vllm/sampling_params.py#L827-L905'
  - 'vllm@568afb3a:vllm/v1/sample/rejection_sampler.py#L205-L252'
  - 'vllm@84030bbe:vllm/v1/sample/rejection_sampler.py#L203-L250'
  - 'vllm@568afb3a:vllm/config/model.py#L224-L235'
  - 'vllm@84030bbe:vllm/config/model.py#L254-L265'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L73-L113'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L250-L299'
  - 'vllm@ced6857a:vllm/sampling_params.py#L1301-L1319'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L650-L663'
  - 'vllm-ascend@7d825229:vllm_ascend/sample/sampler.py#L82-L114'
  - 'vllm@ced6857a:vllm/sampling_params.py#L235-L269'
  - 'vllm@ced6857a:vllm/sampling_params.py#L487-L662'
  - 'vllm@ced6857a:vllm/sampling_params.py#L975-L1050'
  - 'vllm@ced6857a:vllm/config/model.py#L180-L185'
  - 'vllm@ced6857a:vllm/config/model.py#L330-L341'
  - 'vllm@ced6857a:vllm/config/model.py#L1693-L1781'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L231-L268'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L672-L762'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L1059-L1175'
  - 'vllm@ced6857a:vllm/sampling_params.py#L549-L570'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L315-L406'
  - 'vllm-ascend@7d825229:vllm_ascend/sample/penalties.py#L1-L45'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/triton/penalty.py#L1-L154'
  - 'vllm@ced6857a:vllm/sampling_params.py#L340-L517'
  - 'vllm@ced6857a:vllm/sampling_params.py#L720-L1050'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L300-L301'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L754-L757'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L90-L406'
  - 'vllm@ced6857a:vllm/envs.py#L1157-L1166'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/bad_words.py#L13-L65'
  - 'vllm@ced6857a:vllm/sampling_params.py#L606-L620'
  - 'vllm@ced6857a:vllm/v1/sample/logits_processor/builtin.py#L167-L371'
  - 'vllm@ced6857a:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@ced6857a:vllm/v1/engine/detokenizer.py#L95-L142'
  - 'vllm@ced6857a:vllm/sampling_params.py#L281-L306'
  - 'vllm@ced6857a:vllm/sampling_params.py#L838-L898'
  - 'vllm@ced6857a:vllm/config/model.py#L254-L265'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L723-L762'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L490-L553'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L652-L737'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L73-L150'
  - 'vllm@ced6857a:vllm/v1/sample/rejection_sampler.py#L201-L269'
  - 'vllm-ascend@7d825229:vllm_ascend/sample/rejection_sampler.py#L190-L252'
  - 'vllm-ascend@7d825229:vllm_ascend/sample/sampler.py#L1-L167'
  - 'vllm@ced6857a:vllm/sampling_params.py#L51-L78'
  - 'vllm@ced6857a:vllm/sampling_params.py#L343-L359'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L258-L259'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L244-L251'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L398-L406'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L102-L117'
  - 'vllm@568afb3a:vllm/v1/engine/input_processor.py#L102-L117'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L115-L123'
  - 'vllm@84030bbe:vllm/v1/engine/input_processor.py#L115-L123'
  - 'vllm@ced6857a:vllm/config/reasoning.py#L1-L125'
  - 'vllm@ced6857a:vllm/v1/sample/thinking_budget_state.py#L1-L582'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_input_batch.py#L835-L855'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_input_batch.py#L901-L959'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L381-L424'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/sampler.py#L35-L104'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/sampler.py#L232-L273'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/thinking_budget.py#L20-L141'
  - 'vllm@ced6857a:vllm/v1/worker/gpu/sample/thinking_budget.py#L361-L428'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/npu_input_batch.py#L51-L60'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/npu_input_batch.py#L51-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/npu_input_batch.py#L51-L60'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/npu_input_batch.py#L61-L78'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L611-L637'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L5993-L6014'
  - 'vllm-ascend@7d825229:vllm_ascend/sample/rejection_sampler.py#L137-L144'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L593-L619'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5671-L5692'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/rejection_sampler.py#L147-L154'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L818-L895'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L392-L442'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L162-L272'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L163-L275'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/npu_input_batch.py#L62-L78'
  - "vllm@0fc695fc:vllm/v1/sample/logits_processor/__init__.py#L36-L155"
  - "vllm@0fc695fc:vllm/v1/sample/logits_processor/__init__.py#L158-L231"
  - "vllm@568afb3a:vllm/v1/sample/logits_processor/__init__.py#L158-L231"
  - "vllm@ced6857a:vllm/v1/sample/logits_processor/__init__.py#L159-L237"
  - "vllm@84030bbe:vllm/v1/sample/logits_processor/__init__.py#L159-L237"
  - "vllm@0fc695fc:vllm/v1/sample/logits_processor/interface.py#L17-L106"
  - "vllm@0fc695fc:vllm/v1/sample/logits_processor/state.py#L119-L165"
  - "vllm@0fc695fc:vllm/v1/sample/logits_processor/__init__.py#L234-L357"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_input_batch.py#L811-L829"
  - "vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L567-L585"
  - "vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L546-L564"
  - "vllm@0fc695fc:vllm/config/vllm.py#L2031-L2044"
  - "vllm@0fc695fc:vllm/config/vllm.py#L2062-L2071"
  - "vllm@568afb3a:vllm/config/vllm.py#L2192-L2205"
  - "vllm@568afb3a:vllm/config/vllm.py#L2216-L2225"
  - "vllm@ced6857a:vllm/config/vllm.py#L2867-L2881"
  - "vllm@ced6857a:vllm/config/vllm.py#L3079-L3088"
  - "vllm@84030bbe:vllm/config/vllm.py#L2661-L2670"
  - "vllm@84030bbe:vllm/config/vllm.py#L2835-L2844"
  - "vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20"
  - "vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20"
  - "vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L52"
  - "vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L26-L60"
  - "vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L258-L336"
  - "vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L550-L565"
  - "vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L231-L308"
  - "vllm@0fc695fc:docs/features/custom_logitsprocs.md#L1-L468"
  - "vllm@0fc695fc:docs/features/custom_arguments.md#L1-L49"
  - "vllm@0fc695fc:docs/design/logits_processors.md#L1-L571"
  - "vllm@0fc695fc:vllm/engine/arg_utils.py#L859-L861"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L613-L616"
  - "vllm@0fc695fc:vllm/entrypoints/generate/generative_scoring/serving.py#L50-L103"
  - "vllm@0fc695fc:vllm/entrypoints/generate/generative_scoring/serving.py#L172-L379"
  - "vllm@0fc695fc:vllm/entrypoints/generate/generative_scoring/serving.py#L381-L437"
  - "vllm@0fc695fc:vllm/entrypoints/generate/generative_scoring/serving.py#L439-L477"
  - "vllm@0fc695fc:vllm/entrypoints/generate/generative_scoring/api_router.py#L25-L64"
  - "vllm@568afb3a:vllm/entrypoints/generate/generative_scoring/serving.py#L50-L103"
  - "vllm@568afb3a:vllm/entrypoints/generate/generative_scoring/serving.py#L174-L381"
  - "vllm@568afb3a:vllm/entrypoints/generate/generative_scoring/serving.py#L383-L439"
  - "vllm@568afb3a:vllm/entrypoints/generate/generative_scoring/serving.py#L441-L479"
  - "vllm@568afb3a:vllm/entrypoints/generate/generative_scoring/api_router.py#L25-L64"
  - "vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L50-L105"
  - "vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L176-L384"
  - "vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L386-L442"
  - "vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L444-L482"
  - "vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/api_router.py#L25-L64"
  - "vllm@84030bbe:vllm/entrypoints/generate/generative_scoring/serving.py#L50-L105"
  - "vllm@84030bbe:vllm/entrypoints/generate/generative_scoring/serving.py#L176-L384"
  - "vllm@84030bbe:vllm/entrypoints/generate/generative_scoring/serving.py#L386-L442"
  - "vllm@84030bbe:vllm/entrypoints/generate/generative_scoring/serving.py#L444-L482"
  - "vllm@84030bbe:vllm/entrypoints/generate/generative_scoring/api_router.py#L25-L64"
  - "vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L202-L207"
  - "vllm@568afb3a:vllm/entrypoints/openai/api_server.py#L242-L247"
  - "vllm@ced6857a:vllm/entrypoints/launchers/api_server/routers.py#L39-L44"
  - "vllm@84030bbe:vllm/entrypoints/launchers/api_server/routers.py#L39-L44"
  - "vllm@0fc695fc:docs/serving/online_serving/generative_scoring.md#L1-L64"
  - "vllm@0fc695fc:docs/models/pooling_models/scoring.md#L1-L32"
  - "vllm@0fc695fc:vllm/sampling_params.py#L1025-L1038"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L531-L547"
  - "vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L223-L242"
  - "vllm@0fc695fc:vllm/entrypoints/generate/beam_search/online.py#L28-L225"
  - "vllm@0fc695fc:vllm/entrypoints/generate/beam_search/utils.py#L137-L153"
  - "vllm@0fc695fc:vllm/entrypoints/generate/beam_search/offline.py#L27-L182"
  - "vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L133-L137"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L318-L382"
  - "vllm@568afb3a:vllm/sampling_params.py#L1114-L1128"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L589-L605"
  - "vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L260-L279"
  - "vllm@568afb3a:vllm/entrypoints/generate/beam_search/online.py#L28-L220"
  - "vllm@568afb3a:vllm/entrypoints/generate/beam_search/utils.py#L137-L153"
  - "vllm@568afb3a:vllm/entrypoints/generate/beam_search/offline.py#L58-L191"
  - "vllm@568afb3a:vllm/entrypoints/generate/beam_search/offline.py#L193-L327"
  - "vllm@568afb3a:vllm/entrypoints/generate/beam_search/offline.py#L399-L455"
  - "vllm@568afb3a:vllm/entrypoints/openai/completion/serving.py#L136-L140"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L342-L396"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L646-L663"
  - "vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L287-L307"
  - "vllm@ced6857a:vllm/entrypoints/generate/beam_search/online.py#L28-L229"
  - "vllm@ced6857a:vllm/entrypoints/generate/beam_search/utils.py#L137-L154"
  - "vllm@ced6857a:vllm/entrypoints/generate/beam_search/offline.py#L58-L195"
  - "vllm@ced6857a:vllm/entrypoints/generate/beam_search/offline.py#L197-L341"
  - "vllm@ced6857a:vllm/entrypoints/generate/beam_search/offline.py#L413-L470"
  - "vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L132-L136"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L346-L404"
  - "vllm@84030bbe:vllm/sampling_params.py#L1301-L1318"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L646-L662"
  - "vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L287-L306"
  - "vllm@84030bbe:vllm/entrypoints/generate/beam_search/online.py#L28-L222"
  - "vllm@84030bbe:vllm/entrypoints/generate/beam_search/utils.py#L137-L153"
  - "vllm@84030bbe:vllm/entrypoints/generate/beam_search/offline.py#L58-L193"
  - "vllm@84030bbe:vllm/entrypoints/generate/beam_search/offline.py#L195-L329"
  - "vllm@84030bbe:vllm/entrypoints/generate/beam_search/offline.py#L401-L458"
  - "vllm@84030bbe:vllm/entrypoints/openai/completion/serving.py#L132-L136"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L346-L404"
  - "vllm@0fc695fc:docs/models/generative_models.md#L63-L80"
  - "vllm-ascend@c09d3e20:vllm_ascend/sample/sampler.py#L45-L115"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/apply_top_k_top_p.py#L8-L38"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/gumbel.py#L27-L260"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/penalties.py#L36-L160"
  - "vllm@ba15685a:vllm/v1/sample/sampler.py#L308-L355"
  - "vllm@ba15685a:vllm/sampling_params.py#L660-L685"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: lm-head
    kind: builds-on
    note: 采样吃的那排分数由 lm_head 算出，按词表切 8 份和 All-Gather 拼回以 lm_head 页为准
  - to: token
    kind: builds-on
    note: 采样选出的是一个 token 编号；编号怎样变回文字、GLM 的三个结束编号见 token 页
  - to: attention-qkv
    kind: builds-on
    note: softmax 和「除以一个数调节尖锐程度」在 attention 页先讲过，本页把它用到词表上
  - to: one-request
    kind: builds-on
    note: 主线第 5 站在这里选出 y₀、第 6、7 站按停止条件收尾，R1 的形状与字节只在那页推导
  - to: speculative-decoding
    kind: builds-on
    note: 有 MTP 候选时，采样换成对候选的验证，接受规则以投机解码页为准
  - to: structured-output
    kind: builds-on
    note: 结构化输出在采样之前把不合法的词压成负无穷，怎样算 bitmask 以那页为准
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: TP8、MTP 3 个候选、133120 的长度上限等部署取值的出处
contradicts: []
updated: 2026-11-19T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-2dc73ea9c9cf4669b7baf21a004c5b7d89ad8ac0f0af17f7f374e8bbe978ef13.md
  - >-
    raw/sha256-99e1bba849ee1c49ae4ae8dc783b9199122b9f6b5a2dc6c664e23c618883a618.md
---

## Sampling 是什么：分数出来了，下一个 token 怎么定？

**Sampling（采样）是生成每个 token 的最后一步：模型给词表里每个词打完分，sampling 按请求的设置把这一排分数变成一个确定的 token 编号。可以每次都取分数最高的那个（greedy，贪心），也可以把分数换成概率，只在排在前面的几个词里按概率抽一个。**

普通自回归生成每次确定一个新 token。提示词先由分词器切成编号（见 [token](token.md)），prefill 处理这些输入并保存历史状态；之后 decode 通常只输入上一枚新 token，配合已保存状态继续计算，不重新计算全部前文。投机解码则可以一轮验证多个位置。新输入查表变成向量（见 [embedding](embedding.md)），再一层层改写。最后一层之后，模型用一次矩阵乘法，把要预测下一 token 的位置向量变成一排分数，词表里每个词一个；做这次乘法的权重叫 lm_head，这排分数叫 logits（每个分数怎么算出来，见 [lm_head](lm-head.md)）。分数越高，模型越认为这个词适合接在后面；但它只是分数，可正可负，加起来也不等于 1，还不是概率，更不是一个词。

举一个缩到最小的例子，沿用 embedding 页那张 6 个词的词表：我、你、喜欢、猫、看、「。」。前面已经写出「我 喜欢」，模型给 6 个词打的分是：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（数是编的；lm_head 页演示乘法时用过另一组分数，这里换成相差 1 的整数，方便手算）。下一个写什么？

```wiki-diagram
file: sampling-intuition
```

图里有两条路。greedy 那一路最简单：谁的分数最高就选谁，这里永远是「猫」。随机那一路多几步：先把分数除以一个叫 temperature 的数，调节分数之间拉开的程度；再用 softmax 换成加起来等于 1 的概率；然后只留下排在前面的几个词（top-k 按个数留，top-p 按累计概率留），把留下的概率重新凑成 1；最后按概率抽签。图里取 T = 1、top-k = 3、top-p = 0.8，走完这几步只剩两个词：「猫」抽中的机会是 73%，「你」是 27%。每一步的数怎么来，后面「怎么算」一节逐个算。

随机选择能给同一个问题保留多种回答的机会，代价是要多处理、筛选整排词表分数，并维护随机数状态；结果复现还受实际分数和取数顺序影响。greedy 省去随机选择，仍需模型算出词表分数。

抽出来的编号就是这一步的输出，也是下一轮的新输入；前文通过保存的历史状态参与计算，模型再给下一个位置打分。普通逐 token 路径这样继续，直到碰上停止条件。所以 sampling 夹在两次前向之间：前向交出一排分数，sampling 交出一个编号，这个编号又成为下一次前向的输入。

## 为什么不总是选分数最高的词？

**greedy 简单：在每一步分数和并列处理相同的条件下，同一个开头会写出同一段话，但也容易绕进重复；反过来，在整张词表上按概率抽，又会时不时抽中排在很后面、接不上文的词。temperature、top-k、top-p 就是在这两头之间调：保留随机，同时把随机限制在靠谱的候选里。**

先看 greedy 的毛病。分数最高只说明「这一步看起来最像」，一步步都取最高，整段话往往平淡；更糟的是，假设模型写出「我喜欢猫。」之后，下一步最高分又是「我」，接着又是「喜欢」「猫」，于是「我喜欢猫。我喜欢猫。……」绕进循环。研究文本生成的论文《The Curious Case of Neural Text Degeneration》（Holtzman 等，2020）专门分析过这种现象：以「每步选最可能的词」为目标的解码，写出来的文字平淡，并且会反复重复。另一个毛病是没有主动引入变化：同一个问题问十遍，在上述分数不变的条件下，greedy 给出同样的回答，无法靠抽签提供不同候选。

反过来，完全按原始概率抽也不行。真实词表有十几万个词，排在后面的每个词单看概率都很小，可是这一长串小概率加起来并不小；这些尾部的词大多接不上文，抽中一次，句子就跑偏，而且后面每一步都得接着这个错词往下写。上面的小例子里，「喜欢」的概率只有 0.4%，抽中就成了「我喜欢喜欢」；词表越大，尾部的总量越可观。

于是有了几个可以按请求调的旋钮：

- **temperature**（温度，记作 T）调整个分布的尖锐程度：T 小于 1，领先的词更领先；T 大于 1，分布变平，后面的词机会变多。T 调到 0 就退化成 greedy。

- **top-k** 按排名缩小候选范围。边界同分时要看实现：所列 PyTorch 掩码路径保留所有不低于第 k 大分数的候选，因此可能留下超过 k 个；其他后端不能直接沿用这个并列规则。
- **top-p** 把词按概率从高往低累加，留下刚好凑够 p 的那一小撮。它就是上面那篇 2020 年论文提出的 nucleus sampling：候选个数随分布变化，模型很确定时只留一两个，拿不准时多留一些。

代价有两点。一是同一个请求发两次，写出来可以不同；要复现，需要控制随机数的起点（随机种子），还要控制实际分数、算法和取数顺序，后面讲。二是多了一些计算：每一步都要对整排分数做除法和 softmax，top-p 还要把整排分数按大小排序，词表越大、一批里的请求越多，排序越费时。

所以 greedy 也有它的用处：对标准答案、做评测时，可以先取消随机选择；请求把 temperature 设成 0 就是它。运行间的数值一致性还需要另外控制，后面的随机种子一节会区分这两件事。

## 怎么算：6 个词从分数走到一个 token

**下面采用上游 PyTorch 排序掩码路径做手算：分数除以 temperature → 按 top-k 留候选 → 在保留集合上算概率并做 top-p → 重新归一后抽一个。** 为看清概率变化，先列完整词表的 softmax。不同执行后端使用的概率范围有差别，后文会单独对照 Ascend；greedy 跳过随机截断与抽取，直接取处理后分数最高的词。

下面一直用上一节的 6 个词和分数：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（示意）。前一步的结果就是后一步的输入。为了先看清 softmax，第 ① 步先取 T = 1，这时除以 T 什么都不变；第 ② 步再看 T 换成别的数会怎样。

### ① softmax：把分数换成概率

**softmax 把一排分数换成一排概率：每个分数先变成 e 的这个数次方（e ≈ 2.718），再各自除以它们的总和。结果都是正数、加起来等于 1，分数高的词分到的概率大。**

softmax 在 attention 里已经出现过，用来把点积换成权重（见 [attention 怎么算](attention-qkv.md#attention-怎么算跟着一个位置走一遍)）；这里算法完全一样，只是作用对象从位置换成了词表里的词。取 $e$ 的次方有两个作用：负分也变成正数，分数之间差 $1$，结果就差 $e \approx 2.7$ 倍，领先的词被明显放大（$T = 1$ 示意，6 个概率四舍五入后和为 $1.001$，误差来自舍入）：

$$Z = e^3 + e^2 + e^1 + e^0 + e^{-1} + e^{-2} = 20.09 + 7.39 + 2.72 + 1 + 0.37 + 0.14 = 31.71$$

| 候选词 | 分数 $z_i$ | $e^{z_i}$ | $T = 1$ 概率（$e^{z_i} \div 31.71$） |
| --- | --- | --- | --- |
| 猫 | $3$ | $20.09$ | $\approx 0.634$ |
| 你 | $2$ | $7.39$ | $\approx 0.233$ |
| 看 | $1$ | $2.72$ | $\approx 0.086$ |
| 「。」 | $0$ | $1.00$ | $\approx 0.032$ |
| 我 | $-1$ | $0.37$ | $\approx 0.012$ |
| 喜欢 | $-2$ | $0.14$ | $\approx 0.004$ |

有一点值得记住：softmax 只看分数之间的差。6 个分数同时加 10，每个 e 次方都乘上同一个 e¹⁰，除以总和时正好约掉，概率一点不变。所以 logits 的绝对大小没有意义，要紧的是谁比谁高多少。

### ② temperature：先除，再 softmax

**每个分数先除以 T，再做 softmax。两个词概率之比是 e 的「分差 ÷ T」次方：T 越小，分差被放得越大，分布越尖；T 越大，分差被压得越小，分布越平。T 只改差距，不改先后。**

把 T 分别取 0.5、1、2，同样 6 个词的概率变成下表（T = 0.5 时分数先变成 6、4、2、0、−2、−4，再做 softmax；其余同理）：

| 词 | 分数 | T = 0.5 | T = 1 | T = 2 |
|---|---|---|---|---|
| 猫 | 3 | 0.865 | 0.634 | 0.414 |
| 你 | 2 | 0.117 | 0.233 | 0.251 |
| 看 | 1 | 0.016 | 0.086 | 0.152 |
| 「。」 | 0 | 0.002 | 0.032 | 0.092 |
| 我 | −1 | 0.0003 | 0.012 | 0.056 |
| 喜欢 | −2 | 0.00004 | 0.004 | 0.034 |

看猫和你这一对：分差是 1，T = 0.5 时概率之比是 e² ≈ 7.4（0.865 ÷ 0.117），T = 1 时是 e ≈ 2.7，T = 2 时只剩 e^0.5 ≈ 1.65。T = 0.5 时猫独占 86.5%，几乎每次都抽到它；T = 2 时，原本只有 0.4% 的「喜欢」涨到 3.4%，尾部的词明显多了机会。这和 attention 里分数先除以 √d 再做 softmax 是同一个道理，只是在那里除数是固定的，这里由请求决定（见[为什么要除以 √d](attention-qkv.md#为什么要除以-d)）。

T 越接近 0，最高分的词越接近独占全部概率，极限就是 greedy。真去除以一个接近 0 的数会让分数大到溢出，所以 vLLM 把 0 到 0.01 之间的 T 直接抬到 0.01，并打一条警告；只有 T 等于 0 按 greedy 处理，不做除法。另外，三列里猫永远第一、喜欢永远最后：T 不改变先后，所以 greedy 的结果和 T 无关，top-k 留下哪几个词也和 T 无关；但 top-p 按累计概率截，留下几个会随 T 变，下一步就能看到。

### ③ top-k 和 top-p：只留排在前面的词

**top-k 按最高分缩小候选范围。top-p 按概率累计留候选：从高到低累加，达到 p 的那一项也保留。被截掉的词分数改成负无穷，softmax 后贡献 0，留下的词重新凑成 1。** 本节手算与所核上游 PyTorch 路径先按 k 截，再在留下的集合里重新算概率、按 p 截；这个先后含义不能不加区分地套到所有后端。

分数并列是一个实现边界：这里核过的 PyTorch 排序掩码路径以第 k 大的分数为门槛，只屏蔽严格低于门槛的候选。只看 top-k 这一步，示意分数 5、4、4、1 在 k 为 2 时会保留 5 和两项 4，共三项；如果还开着 top-p，后面仍要继续筛选。下面的六词例子没有并列，不涉及这个边界；其他设备或后端的并列规则需分别核对。

取 $T = 1$、$\text{top-k} = 3$、$\text{top-p} = 0.8$，接着第 ① 步的数往下算（示意；top-k 保留 3 项后总和 $Z_k = 20.09 + 7.39 + 2.72 = 30.20$，「。」、我、喜欢记 $0$；top-p 截断后总和 $Z_p = 20.09 + 7.39 = 27.48$）：

| 候选词 | top-k 留 3 项重归一概率 | 累计概率（对比 $p = 0.8$） | top-p 截断后最终概率 |
| --- | --- | --- | --- |
| 猫 | $20.09 \div 30.20 \approx 0.665$ | $0.665 < 0.8$（继续） | $20.09 \div 27.48 \approx \mathbf{0.731}$ |
| 你 | $7.39 \div 30.20 \approx 0.245$ | $0.665 + 0.245 = 0.910 \ge 0.8$（留下） | $7.39 \div 27.48 \approx \mathbf{0.269}$ |
| 看 | $2.72 \div 30.20 \approx 0.090$ | 前序已达 $0.8$（截掉） | $0$ |

最后只剩猫和你，概率 0.731 和 0.269，就是直觉图第三列的数。判断「留不留」的规则可以换一种说法：排在一个词前面的那些词，概率加起来还不到 p，这个词就留下。猫前面没有词，加起来是 0；你前面是猫的 0.665，不到 0.8，留下；看前面是 0.910，已经够了，截掉。

温度会改变 top-p 留几个。同样 top-k = 3、top-p = 0.8，把 T 换成 0.5：前 3 名里猫一个就占 0.867，第一个词就够了，只剩猫一个，效果和 greedy 一样。温度调高，分布变平，要凑够 p 就得多留几个词。

还有一个不太常用的 min_p：只留概率不低于「最高概率 × min_p」的词，vLLM 在除以 temperature 之后、top-k 之前做它。例如 T = 1、min_p = 0.1，门槛是 0.634 × 0.1 ≈ 0.063，留下猫、你、看三个，和 top-k = 3 的结果碰巧一样。三个截断都有「关闭」的取值：top-k 取 0（也接受 −1）、top-p 取 1、min_p 取 0，默认都是关的。

**同样的 k、p，这两条实现在下面的例子里会留下不同候选。** 固定 Ascend v0.26、rc2 与 main 的普通排序路径先算一次过滤前的 softmax；top-k 屏蔽以后，top-p 仍按这一次原始概率排序的结果取阈值，没有在 top-k 保留集合上重算。用同一组六词分数，只把 k 改成 2、p 改成 0.7，就能看出差别：

| 排序路径 | 用来判断 top-p 的“猫”概率 | 过 0.7 门槛要保留谁 | 最终抽取分布 |
|---|---:|---|---|
| 上游 PyTorch：top-k 后重新归一 | 0.731 | 猫一项已够 | 猫为 1 |
| 所列 Ascend 普通排序：沿用过滤前概率 | 0.634 | 猫加你，累计约 0.867 | 猫约 0.731，你约 0.269 |

这是按固定代码推演的差异。前面的 k=3、p=0.8 算例两条路径碰巧都保留猫和你，所以原数值仍成立；它不能证明两种算法一般等价。固定旧 GLM 的 A2 路径调用 NPU 融合算子，不能直接用上述某一排序实现代替它的内部规则；所列普通 native 入口在开启 batch invariance 时回到上游实现。迁移参数或复现实验时应记录实际采样后端，并核对联合截断后的候选。

### ④ 按概率抽一个，和 greedy 对照

**把留下的概率首尾相接排在 0 到 1 之间，猫占 [0, 0.731)，你占 [0.731, 1)；取一个 0 到 1 之间均匀分布的随机数 u，落在哪一段就选哪个词。**

u = 0.42 落在猫那段，这一步输出猫；换一次随机数 u = 0.85，落在你那段，输出你。每段的长度就是它的概率，抽很多次，大约 73% 是猫、27% 是你；被截掉的看、「。」、我、喜欢一次也不会出现。

greedy 对照：它不做 ① 到 ④，直接在原始分数里找最大的，3 分的猫，每次都是猫。随机那一路在 T = 0.5、top-p = 0.8 这类设置下也会只剩猫一个，结果和 greedy 一样；但只要留下的词多于一个，同一个开头就可以写出不同的下一句。

批处理时还要区分“这一条请求用 greedy”和“整批都用 greedy”：本页核过的上游采样实现只有在整批全部采用 greedy 时，才直接返回最高分结果、跳过后面的随机处理。若一批里混有随机采样请求，就仍要继续处理随机路径，最后逐条选择相应结果；不能把整批提前返回的条件套到混合批次。

## 分数在进 softmax 之前，还会被哪些设置改动？

**除以 temperature 之前，普通采样先按请求的设置把分数改一遍，顺序是：只允许指定的词 → 屏蔽指定的词串 → 还没写够最少 token 数时屏蔽结束 token → 给指定的词加减分 → 按历史 token 罚分。接通思考预算的版本还会在罚分后按预算推动思考结束串，详见后面的预算示例。这些改动在 greedy 之前做，会改变谁是最高分；min_p、top-k、top-p 则只在随机那一路做。MTP 验证的处理顺序另见后文，三种罚分内部的顺序相同。**

这几项默认都不开，请求里设了才生效：

- **只允许 / 屏蔽**：给定允许编号或禁用词串，删除不合条件的候选；具体怎样匹配，见下面的三个对照。
- **最少 token 数**（min_tokens）：普通文本输出还没到这个数时，把结束 token 和请求指定的停止 token 压成负无穷。rc2/main 与结构化输出组合有恢复停止编号的例外，下面的最少长度一节会解释。
- **加减分**（logit_bias）：请求给某些词编号指定一个数，直接加到它们的分数上。
- **罚分**：按 token 的历史修改分数，既可以抑制重复，也可以反过来鼓励重复；三种方式的统计范围和算法见下面的对照。

另外两项不在这条链里，但作用在同一排分数上：一是[结构化输出](structured-output.md#4-每张卡把-bitmask-作用到-logits)，它在采样之前把不符合格式的词压成负无穷；二是请求要的 logprobs（每个词的对数概率），默认记录采样器收到分数时的分布，在上面这些改动和 temperature 之前。这个“原始”边界不撤销进入采样器之前已经应用的格式掩码，记录口径见下节。

### 想让某个词更容易出现，还是只准从几个词里选？

**加减分是调整偏好，屏蔽是把候选移出去。** 比如分类只准输出几个标签，用允许编号；写作只是希望少提某个词，用分数偏置；不想生成某个特定 token 串，用禁词。三者的输入与作用不同：

| 参数 | 请求交给它什么 | 每一步做什么 |
|---|---|---|
| `logit_bias`（分数偏置） | token 编号到加减分数的映射 | 指定编号的 logit 加上对应数值，不看出现次数 |
| `allowed_token_ids`（允许编号、token 白名单） | 一份非空 token 编号列表 | 列表外的分数设为负无穷；列表内保留原分数 |
| `bad_words`（禁词、禁用词串） | 字符串列表，由服务分词 | 输出历史快要补完禁用 token 串时，只屏蔽它的最后一个 token |

编号必须来自服务正在用的分词器。一个词可能分成好几个 token，同样文字在句首、空格后也可能得到不同编号；不能把文字本身当作编号，或照抄别的模型的编号。下面仍用猫、你、看、「。」、我、喜欢这 6 枚**示意 token**，不把它们当成 GLM 的实际分词。

先只加偏置：猫原来 3 分，给 −2 后是 1 分；你原来 2 分，给 +0.5 后是 2.5 分，其余不变。greedy 从选猫变成选你。随机采样还要经过温度、截断与归一化，所以 +0.5 不是「概率增加 0.5」，−100 也不是硬性禁用。若其余分数都比减分后的结果更低，减了 100 的候选仍是最高分。

再从原始六词分数出发，只允许猫、你。这一步变成猫 $3$、你 $2$，其余四项 $-\infty$。$-\infty$ 在 softmax 后贡献 $0$，只在剩下两项之间分配概率（温度为 $1$、其他处理都关闭，示意）：

| 候选词 | 平移指数权重（$\exp(z_i - 3)$） | 白名单归一化概率 |
| --- | --- | --- |
| 猫 | $\exp(3 - 3) = 1$ | $1 \div (1 + 0.368) \approx \mathbf{0.731}$ |
| 你 | $\exp(2 - 3) \approx 0.368$ | $0.368 \div (1 + 0.368) \approx \mathbf{0.269}$ |
| 其余四项 | $\exp(-\infty) = 0$ | $0 \div (1 + 0.368) = \mathbf{0}$ |

列表只约束每一步可选的编号，不约束顺序。允许「喜欢」「猫」，仍允许连续输出很多个「猫」，不会强制组成「喜欢猫」。要限制完整标签、语法或 JSON 结构，使用[结构化输出](structured-output.md)。一个标签拆成多枚 token 时，把所有编号放进白名单后，各步仍可任取其中一枚；重复编号或颠倒原标签的顺序也都符合白名单规则。

### 禁词为什么只在最后一枚 token 上拦截？

假设禁用「喜欢猫」，并假设它恰好分成喜欢、猫两枚 token。生成到喜欢时，尚未组成禁串，可以保留；**只有本次输出的末尾已经是喜欢时，下一步才把猫的分数从 3 改成负无穷**。末尾是你时，猫仍保留 3 分。若禁用的是单枚 token 猫，就没有需要等待的前缀，每一步都会屏蔽猫。多个词串分别做这个判断，同一步命中的末尾编号都被屏蔽。

匹配只看本次生成的 token 历史，不把提示词接到历史前面。因此提示词以喜欢结束、第一枚输出是猫时，不会因为跨过输入／输出边界组成「喜欢猫」而拦截。它也不会扫描最终显示的字符串做大小写、同义词或任意子串匹配；同样可见文字若由另一串编号组成，可能不命中。禁词不是内容审查器。

服务为每个禁词尝试两种分词：去掉原字符串开头空白后直接编码，以及前面加一个空格再编码，都不添加特殊 token。基线只有在空格版本的首编号不同、且 token 数量相同时，才把第二种也加入禁用列表。这照顾了一部分句首／空格后的差别，并不枚举所有上下文切法。空字符串不能用；只含空白、去掉开头空白后无法产生 token 的词串也应在提交前剔除。

这与停止字符串不同：禁词在选择下一枚 token 前拦住它，停止字符串是在生成后发现命中才收尾。与 penalty 也不同：罚分是按历史降低或提高偏好，禁词是按后缀匹配直接屏蔽。单纯不想重复用词，通常先比较后面三种罚分的效果。

### 多个限制叠起来，还剩下能选的 token 吗？

普通采样先做允许编号和禁词屏蔽，随后加偏置、罚分。被屏蔽的负无穷加上有限偏置仍是负无穷，不能靠正偏置把它救回来；未屏蔽候选则继续按顺序改分，偏置后的正负号还会影响 repetition 的缩放分支。后续 top-k、top-p 可能进一步缩小候选集。

例如只允许猫，同时又把单枚猫设成禁词，所有分数都会成为负无穷；再加结构化输出或最少长度限制，也可能产生同样冲突。不要依赖运行时一定提前报告「交集为空」，应先检查约束能同时满足。若希望靠结束 token 自然结束，白名单也要允许所需结束编号；否则生成可能一直到长度上限。只能输出一枚分类 token 时，显式设输出上限为 1 更容易控制。

### 三种 penalty 分别在数什么？

**罚分改的是当前这一步的 logits，统计单位是 token 编号。它不会判断两句话意思是否重复，也不会修改模型权重。** 同一个汉字或英文词可能被切成不同编号，效果取决于实际分词；一次生成有多条输出时，各条按自己的输出历史计算。

| 参数 | 看哪段历史 | 对当前候选的分数做什么 |
|---|---|---|
| `presence_penalty`（出现惩罚） | 本次已经生成的输出 | 只要出现过，就减一次参数值；出现 1 次和 10 次扣一样多 |
| `frequency_penalty`（频率惩罚） | 本次已经生成的输出 | 减去「参数值 × 已出现次数」；出现越多，改动越大 |
| `repetition_penalty`（重复惩罚） | 提示词与本次已经生成的输出 | 出现过的候选，正分除以系数，负分乘以系数；零分仍为零；重复次数不再叠乘 |

这里的「提示词」是模板处理、分词后实际送进模型的输入。多轮对话里，以前的 assistant 回复若随 messages 一起发来，也属于这次的提示词：前两项不统计它，第三项会统计。第一枚输出 token 还没生成时，前两项没有可罚的输出历史，第三项已经可以对提示词里出现过的编号生效。

presence 和 frequency 取正数时降低已出现 token 的分数，取负数则加分、鼓励再次出现，0 表示不改分。repetition 大于 1 时抑制重复，介于 0 与 1 之间时鼓励重复，1 表示不改分；**不能用 0 关闭 repetition**。三者都能和 greedy 一起用，因为罚分发生在取最高分之前。

### 从只罚一次，到按次数罚，再到三项叠加

拿罚分演一次，看它怎么打破前面「为什么」一节里的循环。假设 greedy 已经输出「猫。我喜欢」，这个位置模型给的分数仍是猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2，请求设了 presence penalty = 1.5。猫、「。」、我、喜欢都在输出里出现过，各扣 1.5，变成 1.5、−1.5、−2.5、−3.5；你和看没出现过，不变。最高分从猫（1.5）换成了你（2），greedy 这一步写出「你」，循环就断了。

继续沿用这 6 个词和原始分数，另设一段能区分三者的历史：提示词是「我 喜欢 看」，已输出「猫 。 猫 我 喜欢」（示意，每个空格分隔一枚 token）。猫在输出里出现 2 次，「。」、我、喜欢各 1 次；看只在提示词里；你两处都没出现。

先单独开 frequency = 0.5：猫从 3 扣去 0.5 × 2，变成 2；我从 −1 扣去 0.5，变成 −1.5。换成单独开 presence = 0.5，猫只扣一次，变成 2.5。换成单独开 repetition = 2，猫变成 3 ÷ 2 = 1.5，我变成 −1 × 2 = −2，看虽然从未输出，也从 1 降到 0.5。你仍是 2，零分的「。」仍是 0。

三项可以同时设置。实际顺序是 **repetition → frequency → presence**：先按正负分缩放，再按输出次数扣分，最后按是否出现过扣分（更系统的保序边界与惩罚/截断深入分析另见[采样进阶](sampling-advanced.md#三类重复惩罚公式差别与小算例)）。以 `repetition_penalty = 2`、`frequency_penalty = 0.5`、`presence_penalty = 0.5` 同时启用为例（示意）：

| 候选词（历史计数） | 三项依次生效算式（先缩放、再扣频率、最后扣出现） | 改分结果 |
| --- | --- | --- |
| 猫（输出 $2$ 次） | $3 \div 2 - 0.5 \times 2 - 0.5$ | **$0$** |
| 我（输出 $1$ 次） | $-1 \times 2 - 0.5 \times 1 - 0.5$ | **$-3$** |
| 喜欢（输出 $1$ 次） | $-2 \times 2 - 0.5 \times 1 - 0.5$ | **$-5$** |
| 「。」（输出 $1$ 次） | $0 \times 2 - 0.5 \times 1 - 0.5$ | **$-1$** |
| 看（仅在提示词里） | $1 \div 2 - 0 - 0$ | **$0.5$** |
| 你（两处都未出现） | $2 - 0 - 0$ | **$2$** |

算完后的整排分数继续进入 greedy 或随机采样；这里 greedy 会选你。不能先扣分再做 repetition：猫若按相反顺序计算，会得到 (3 − 1 − 0.5) ÷ 2 = 0.75，与正确结果 0 不同。换成 frequency = −0.5，猫的次数项就从扣 1 分变成加 1 分；换成 repetition = 0.5，单独作用时猫变成 6、我变成 −0.5，都在鼓励重复。

这些数只是演算，不是 GLM 的推荐设置。抑制过强会同时压低应该复用的姓名、变量名、数字和标点；repetition 还会压低题目里已经给出的词。它们只是调整偏好，不能保证没有重复，也不能代替停止条件。

## 内置规则不够时，怎样接入自己的改分规则？

**自定义 logits processor 是服务启动时装入的一段改分逻辑：它接收本批待采样请求的词表分数，按各请求的设置修改，再把结果交回采样器。** 它不改模型权重，也不是输出文字后再替换词。普通非投机采样中，一条请求对应一行分数；处理器可以只改启用了规则的行，其他行保持原样。

例如仍用前面的六枚示意 token：猫、你、看、「。」、我、喜欢，编号依次设为 0–5。A 请求指定只保留编号 1，C 请求没有启用这个规则。A 的原分数 [3, 2, 1, 0, −1, −2] 变成 [−∞, 2, −∞, −∞, −∞, −∞]，C 的分数不变。A 的 greedy 从猫改选你；这条规则因此**会改变最高分的位置**，不能声明自己对 greedy 没影响。实际编号必须来自对应模型的分词器，示意编号不能直接用于 GLM。

### 为什么改分规则还要记请求状态？

请求在批次里的行号会变。假设某步的四行是 [A, B, C, D]；A、C 完成，E 新来。批次可让 E 替换第 0 行、删除第 2 行，再把 D 从第 3 行移到第 2 行，最后交换前两行，得到 [B, E, D]。如果处理器仍把第 0 行当 A，就会拿 A 的规则改 B 的分数。

所以执行器每步除了调用“改分”，还要通知处理器删除、加入和移动了哪些请求。按接口约定处理删除、加入、移动；移动按给出的顺序执行。加入可以直接替换原行，旧请求的设置必须丢弃；单向移动和两行交换也不能混用。上例中 E 的加入编号仍是交换前的 0，处理完后它才位于 1。行号与请求的关系见[输入准备中的持久批次](prepare-inputs-flow.md#先同步持久批次每步只改变了的那几行)。

“本步没有批次成员变化”也不等于“没有新输出”。接口可把批次更新记为 None，但之前保存的输出 token 列表引用仍会增长。只看配置的规则可以跳过这次状态更新；按已生成长度或历史内容改分的规则，仍须处理新的历史。

### 为什么有些处理器可以跳过，有些不行？

argmax 表示一行里最高分所在的编号。处理器在启动时声明是否始终保留这个编号：若保留，则整批都是 greedy 时可以跳过它；整批中仍有随机请求时，不能因为其中一条是 greedy 就跳过整次批级处理。会改变最高分的规则在 greedy 选词前执行，前面的“只保留你”就属于这一类。错误声明会让同一条规则在全 greedy 批里失效。

普通路径因此分两处调用：会改变最高分的处理器在允许编号、禁词之后，罚分、greedy 和温度之前执行；保证最高分不变的处理器在温度之后、top-k/top-p 之前执行。混合批次中，greedy 行最后采用先前保存的选词结果。注册先后不能把这两组变成一条任意排列的处理链；规则的声明决定它在哪一段参与。

**处理器的代价发生在每一步。** 更新请求状态、遍历词表、生成掩码和额外张量都会占 CPU 或设备时间。批量运算通常比逐请求的 Python 调用更容易摊薄开销；原地改分少留一份张量，但要遵守后续消费者的约定。没有任何请求启用规则时，可以直接返回原分数。仅仅把某条请求的规则关闭，并不保证一次覆盖全批的运算就会消失。

## 返回的概率记录，怎样对应这次选词？

**概率记录是给已生成的每个 token 附上一份分数说明：它在这一位置得到多高的条件概率，另有哪些候选。它不多生成一份回答，也不改变候选筛选数量。** 例如只看模型回答“猫”，无法知道“你”的概率是否与它接近；附上两者的概率才能比较。记录条数越多，需要从设备搬回、解码并保存的数据就越多。

### 对数概率怎样读，为什么不是置信度百分比？

对数概率是概率 $p$ 的自然对数 $\ln(p)$。它通常小于等于 $0$，越接近 $0$ 表示概率越高；取指数 $\exp$ 就能还原概率。沿用前面的六词示意，原始分布中“猫”约 $0.634$、“你”约 $0.233$；截断后抽签时却是 $0.731$、$0.269$。先认清记录的是哪一列，再比较值（示意，概率取前文近似值）：

| 分布口径（同一枚“猫”） | 对数概率记录 $\ln(p)$ | 还原概率 $\exp(\text{logprob})$ |
| --- | --- | --- |
| 原始分布（`raw_logprobs`） | $\ln(0.634) \approx -0.456$ | $\exp(-0.456) \approx 0.634$ |
| 截断后分布（`processed_logprobs`） | $\ln(0.731) \approx -0.313$ | $\exp(-0.313) \approx 0.731$ |

只返回几个词时，这几个词的概率通常加不到 1；不要再归一化后冒充整词表概率。生成序列的累计值是各位置所选 token 的记录相加，在对数概率模式下对应条件概率的连乘；它不是回答事实正确的概率，也不能直接当不同长度回答的公平评分。

### 是记录前几名，还是只盯几个指定编号？

仍假设这一步实际抽到“你”。若要记录前 1 名，普通 Python 返回字典会同时放入原始分布第一名“猫”和已选的“你”；若实际抽到的就是“猫”，两个身份合并为同一个编号。因此“前 k 名”通常最多得到 k+1 个不同编号，而不是再生成 k 个 token。数量设为 0 仍记录已选 token，只有关闭记录才没有这份数据。

指定编号查询则是另一件事：例如只观察“我”和“喜欢”，无论它们排第几都取出对应记录，并保留实际选出的 token。它不强制从这两个词里生成；限制生成集合应使用前文的允许编号。编号必须来自当前模型分词器，词串有多枚 token 时也不能把一枚的概率当作整个词串的概率。当前固定 MTP 路径有额外限制，见 GLM 一节。

### 记录的是处理前还是处理后，怎样装进返回值？

生成记录有两条选择轴：取处理前还是处理后的分数；保留分数本身还是换成对数概率。处理前指采样器入口，处理后在普通随机路径中包括罚分、temperature 与截断。纯 greedy 路径不会做随机路径的温度和截断步骤，记录也不因此变成“所选词概率等于 1”。四种模式的精确名字放在源码区。

在 Python 普通容器里，外层按输出位置排列，每个位置是“token 编号 → 记录”的字典，记录含数值、名次和可解码文字。扁平容器把这些字段改放到几条连续列表，再用每个位置的起止下标定位，减少大量小对象造成的 CPU 垃圾回收开销；它不减少词表计算，也不把多个输出位置合成一个概率。当已选词也在前几名里时，内部数组重复存储该编号，按位置取出的字典才合并重复项。

HTTP 还要把这些内部记录整理成接口自己的结构：Chat 把每个所选 token 与它的候选列表放在一起，Completion 把 token、所选值、候选映射和文字偏移分别排成列表。不能拿 Python 扁平容器的开关要求 HTTP 改成同样的数组格式。提示词已有 token 的记录沿用相同数学含义，但计算位置和返回时机不同，见 [prefill 的提示词概率](prefill.md#提示词已经给定为什么还要算它的概率)。


## 生成式评分：用下一个 token 的概率比较候选

**生成式评分把“这段输入之后，模型多倾向于某个标签”变成一个分数。** 例如给每个候选城市分别构造“该城市是否为法国首都”的输入，再比较模型接下来选择“是”或“否”的倾向。每个候选各走一次生成请求，只取下一位置的标签记录；返回的分数描述模型在这个提示下的选择，不是事实正确率。

设标签 A、B 在完整词表中的概率分别为 $0.1$、$0.3$，其他词合计 $0.6$。默认只在给定标签之间重新归一化，并返回**标签列表第一项**的分数（示意）：

| 计算口径 | 算式 | 结果 |
| --- | --- | --- |
| A 的完整词表概率 | — | $0.1$ |
| 两标签概率总和 | $0.1 + 0.3$ | $0.4$ |
| 默认返回 A 的评分（两标签重归一） | $0.1 \div 0.4$ | **$0.25$** |
| 仅传 A 一个有限值标签时 | $0.1 \div 0.1$ | **$1$** |

因此 0.25 与 0.1 回答不同的问题；只给一个标签时得到 1，也不表示模型确信答案正确。接口为每个候选返回一个分数和输入序号，不返回整张标签概率表，也不会自动按分数重新排序。希望评估一个由多个 token 组成的词串时，不能只取它的第一枚编号冒充整个词串概率。

提示构造同样影响结果。文字查询和候选**分别分词后拼接编号**，中间不会自动补空格、分隔符或聊天模板；“查询+候选”只是顺序说明。调用方应准备符合该模型要求的格式，或直接提供完整设计好的编号。输入超长时实现保留前面的部分，留一个输出位置；若后面的候选或回答提示被截掉，返回分数就已不再回答原来的问题。

这个接口复用生成模型的下一词分布，和 pooling 模型的 /score 分开：后者可用分类头、双编码向量相似度或 token 向量之间的匹配分数。对一组候选逐项生成评分仍会消耗对应提示词的前向计算、调度名额与缓存；只输出一个 token，不代表长提示的成本很低。固定 GLM 配方启用了 MTP，其任意指定标签记录的限制见本页 GLM 一节；不能仅凭服务提供这个路由就认定原配方能完成评分。

## Beam search：为什么同时保留几条没写完的候选？

**Beam search 每一步保留几条较好的候选序列，下一步把它们一起扩展，再从所有扩展结果中筛选。** 每条仍在搜索的序列叫一个 beam，最多保留多少条叫 beam width。它适合想比较连续多步候选的场景；普通随机采样则让每条回答沿自己抽中的分支继续。一次随机采样要多个回答，不会自动变成 beam search。

用宽度 2 做一个示意，先暂不考虑结束编号，以下都是同长度候选。第一步保留 A、B，概率分别为 $0.6$、$0.4$。第二步 A 后面接 C、D 的条件概率为 $0.4$、$0.35$；B 后面接 C、D 的条件概率为 $0.9$、$0.05$。其他延伸的联合概率更低。两步路径的概率要相乘（宽度为 2 时保留 **B→C** 与 **A→C**，下一步继续扩展这两条）：

| 扩展路径（示意） | 两步联合概率算式 | 结果与筛选 |
| --- | --- | --- |
| B → C | $0.4 \times 0.9$ | **$0.36$**（保留） |
| A → C | $0.6 \times 0.4$ | **$0.24$**（保留） |
| A → D | $0.6 \times 0.35$ | $0.21$（剪枝） |
| B → D | $0.4 \times 0.05$ | $0.02$（剪枝） |

第一步暂时落后的 B 可以在第二步领先；也可能有两条入选结果都来自同一个旧 beam，所以这不是“每条候选各留一个词”。真正实现累加对数概率，等价于把路径上各步概率相乘，避免长序列的乘积太小。示意里的局部比较也不能保证找出所有可能句子中的全局最优：被剪掉的路径不会再回来。

```wiki-diagram
file: sampling-beam-search
```

固定实现由前端反复发起单步生成：每个活跃 beam 每轮只要 1 个新 token，并请求宽度两倍的候选概率记录，再处理结束编号和筛选。宽度变大，会增加同时参与的请求、概率记录、CPU 整理及引擎工作；它不只是最终多显示几条答案。已结束候选另存，最终再与留下的活跃候选比较。

### 长度惩罚的分母，为什么还算了提示词？

这里的长度惩罚是**比较不同长度候选时的评分规则**，不是前文改词表分数的 repetition/frequency/presence penalty。固定四版的最终评分用“已生成部分的累计对数概率 ÷ 长度的指定次方”；长度却取候选保存的完整编号列表，包含提示词，末尾若是 EOS 则扣掉这一个结束编号。

另取两个不同长度的示意候选，提示词都是 4 个编号，长度惩罚为 $1$。A 在扣除末尾 EOS 后有 2 个新增编号，累计对数概率 $-2$；B 有 4 个新增编号，累计 $-3$。累计值按实际候选记录取值，其中结束步骤的概率可能已计入（分数越大越靠前，因此 A 排在 B 前面）：

| 候选（固定实现：分母含 4 个提示词编号） | 评分算式 | 最终分数 |
| --- | --- | --- |
| 候选 A（新增 2 个） | $-2 \div (4 + 2)$ | $\approx \mathbf{-0.3333}$（排前） |
| 候选 B（新增 4 个） | $-3 \div (4 + 4)$ | $-0.375$ |

若误把分母写成仅新增长度，就会算出 A=−1、B=−0.75，连排序都会翻转。评分不是概率百分比，也不衡量答案是否正确。rc2 另给分母长度加了至少为 1 的保护，其他三个固定快照没有这一处保护。

### 搜索结果怎样返回，文法约束是否还有效？

HTTP Completion 明确拒绝“beam 加流式”；Chat 可以进入 SSE 封装，但这条 beam 生成器正常情况下到搜索结束才交出结果，因此不能期待随每轮搜索逐 token 展示。在线返回文本只解码新增编号；离线 beam 返回对象中的 text 则由包含提示词的完整编号列表解码，两种结果不要用同一截取假设处理。

v0.26 起，离线 beam 参数另有结构化输出路径：每轮为各候选重建文法状态、重放已生成编号，再筛掉不合法的延伸。允许编号集合过大时，不把整套集合传给引擎，而只过滤已经返回的候选；因此即使存在合法词，也未必出现在这次有限候选中。重建和过滤也有 CPU 开销。普通 HTTP 的 beam 参数转换没有传入这项文法设置，不能因为同一请求 schema 接受了结构化输出字段，就认为 beam 分支执行了约束；通用文法机制见[结构化输出](structured-output.md)。

## 真实实现怎样「按概率抽」？

**本页核对的上游 PyTorch 与 Ascend 抽取路径给每个词各发一个服从指数分布的随机数 q，算「概率 ÷ q」，取最大的那个词。** 这样抽中每个词的机会等于归一化后的概率；抽取本身用逐元素除法与取最大，结果留在加速卡上，不用拷回 CPU。其他可选采样后端须分别核实，不能仅由 vLLM 名称推定算法。

第 ④ 步的区间法要先算累计和，再拿 $u$ 逐段去比；按区间抽的现成函数（`torch.multinomial`）在昇腾上会让 CPU 停下来等 NPU，昇腾的源码注释写明换掉它就是为了避开这次同步（NPU 采样快慢路径剖析另见[采样进阶](sampling-advanced.md#昇腾-npu-采样快慢路径剖析v0300)）。指数噪声的做法只需要一次除法和一次取最大。继续用猫 $0.731$、你 $0.269$，抽两次（$q$ 为示意值，真实每步每个词重新抽）：

| 抽取轮次 | 候选词与示意噪声 $q$ | 算式（$\text{概率} \div q$） | 胜出结果 |
| --- | --- | --- | --- |
| 第 1 次 | 猫（$q = 1.30$） / 你（$q = 0.20$） | 猫 $0.731 \div 1.30 \approx 0.562$；你 $0.269 \div 0.20 \approx \mathbf{1.345}$ | 输出「你」 |
| 第 2 次 | 猫（$q = 0.50$） / 你（$q = 0.90$） | 猫 $0.731 \div 0.50 \approx \mathbf{1.462}$；你 $0.269 \div 0.90 \approx 0.299$ | 输出「猫」 |

为什么这样抽到猫的机会正好是 0.731？「概率 ÷ q」最大，等价于「q ÷ 概率」最小。q 服从平均值为 1 的指数分布，q ÷ 概率就服从平均值为「1 ÷ 概率」的指数分布：概率越大，这个数平均越小，越容易成为最小的那个。几个互相独立的指数分布随机数比大小，第 i 个最小的机会正好等于它的「概率 ÷ 所有概率之和」，这里就是 0.731 ÷ 1 = 0.731。被截掉的词概率是 0，除完还是 0，永远不会是最大的。

同一批里常常既有 greedy 请求，也有随机请求。只要这一批不全是随机请求，vLLM 就先对每一行都算一遍 greedy 的结果；只要不全是 greedy 请求，再对每一行都走一遍随机那一路；最后按每条请求自己的 T 逐行挑：T 小于 0.00001 的行取 greedy 结果，其余取随机结果。

随机数从哪来：随机采样请求自己带了有效 seed，就给这条请求单独建一个随机数发生器，它那一行的 q 由它产生；在相同实现、相同取数顺序下，同样的 seed 得到同样的 q 序列。没有独立种子的请求共用全局发生器，全局发生器的起点是启动时设的种子。

**全局种子与请求种子控制的是两条不同的随机流。** 全局种子在 worker 启动时初始化，随后状态会不断向前走；它不会在每条请求到来时自动倒回起点。例如 A、B 都不带请求种子，A 先消耗一段随机数，B 就从后面的状态继续，改变到达顺序或批次组成会改变各自拿到哪一段。A、B 都显式给同一个请求种子时，各自建立独立发生器；相同分布和相同取数顺序下才会得到相同选择。请求种子为 0 也会建立独立发生器，−1 则按未指定处理。

种子固定的是随机数起点。模型、输入编号、参数、设备实现或批次导致的分数变了，即使随机数相同，结果也可能变化；greedy 则根本不用这条请求随机流来选 token。排查逐字复现需要同时比较实际输入、分数与批次，见 [batch invariance](batch-invariance.md)。

## 采样参数从哪来？

**每条请求带着一组采样参数进来（在 vLLM 里是一个 SamplingParams 对象）。普通 Chat、Completions 的温度和三种截断，先用请求显式给的数值；省略或传 null 时继承服务默认，服务没给才退到中性默认。服务默认又来自生成配置与启动覆盖。参数在[入口](api-server-entry.md#怎么做从-json-到一串编号①-到-④)收到请求时就定下来，采样这一步只负责照着用。**

vLLM 的中性默认值是：temperature 1、top-p 1、top-k 0、min_p 0、各种罚分都不罚，也就是「在整张词表上按原始概率抽」。启动参数里生成配置默认取 auto，意思是去模型目录读 generation_config.json，里面写了 temperature、top-p、top-k、min_p、repetition penalty 或最大新 token 数的，就替换成默认值，启动日志里会打一条警告说明默认值被模型配置改了；想回到中性默认值，启动时把它设成 vllm。这个读取名单没有 presence 和 frequency，两者的请求缺省值直接回到 0；不能把任意采样参数写进生成配置，就认为它会成为服务默认值。

用一组示意配置沿覆盖顺序走一遍，不改变前面的六词分数：

| 走到哪一层 | 温度 | 累计概率截断 | 按个数截断 |
|---|---:|---:|---:|
| 模型生成配置 | 1 | 0.95 | 未写 |
| 启动覆盖温度为 0.8、按个数取 20 | 0.8 | 0.95 | 20 |
| 请求只显式给累计概率 0.8 | 0.8 | 0.8 | 20 |

所以这一条最终是温度 0.8、累计概率 0.8、个数 20；另一条没有覆盖的请求仍用 0.8 / 0.95 / 20。请求若想关闭服务继承来的截断，要显式给关闭值，而不是删掉字段。启动改为中性来源时，模型的采样默认不再参与，但显式启动覆盖仍会参与；同一个覆盖字典下，未写累计概率的请求会用 1，而不是模型的 0.95。模型的 EOS 等特殊编号另有读取链，不因选中性采样默认就全部消失。

Python 直接构造采样对象会立即填入自身默认值，没有上述 HTTP 合并层。离线调用需要模型默认时，让已有 LLM 使用默认参数，或先取得它的默认参数对象，再构造带明确覆盖的新对象；具体写法在页末。请求种子和全局种子都不在这六项采样默认名单里。

几个值得知道的约定：

- temperature 设成 0 时，参数对象自己把 top-p、top-k、min_p 重置成关闭，按 greedy 处理；0 到 0.01 之间的取值被抬到 0.01，仍按随机采样。
- 取值不合法的请求在入口就被拒绝，不会进入采样：temperature 为负、top-p 不在 0 到 1 之间（0 不行，1 可以）、top-k 小于 −1、min_p 不在 0 到 1 之间。
- 最大输出数 max_tokens：Chat 没有固定的 16 默认值，Completions 省略时默认 16；生成默认、显式请求与服务端上限的优先级统一见[入口页的输出预算](api-server-entry.md#怎么开)。
- seed 是每条请求自己的随机种子，见上一节。

## 什么时候停下来？

**每出一个 token，引擎都检查一遍要不要停：在本页固定 GLM 基线中，输出还没到 min_tokens 时跳过判停；到了，就看这个 token 是不是结束 token、是不是请求指定的停止 token，是就正常结束；再看长度，输出数到了 max_tokens，或者提示词加输出到了模型的长度上限，就截断结束。最少长度还会在采样前挡住结束编号，下面用一个例子说明。**

结束 token（EOS，end of sequence）是词表里的特殊 token，模型在训练时学会了「话说完了就输出它」；它和普通词一样参与打分和采样，被抽中就说明模型认为该收尾了。停止 token 是请求额外指定的编号，模型生成配置里列出的其他结束编号也并进这一类。请求设了 ignore_eos，只关闭自动 EOS 判停；手工指定的停止编号、停止文字和长度限制仍有效，具体组合见[请求收尾](request-teardown.md#停止文字停止编号和忽略-eos-怎样配合)。

两类结束在返回给客户端时写法不同：结束 token 和停止 token 记作正常结束（finish reason 为 stop），长度到限记作被截断（finish reason 为 length）。用小例子看长度：提示词「我 喜欢」，max_tokens = 3，输出依次是猫、「。」、我，第 3 个 token 一追加就停，哪怕句子没写完：接口返回的输出部分是「猫。我」（连同提示词读起来是「我喜欢猫。我」），结束原因是 length。

还有两点：

- 停止判断不在加速卡上做，而是在一圈圈推进请求的引擎进程里（CPU 上，见 [EngineCore](vllm-engine-core.md)），在采样结果交回之后逐个 token 检查；一步如果交回好几个 token，中间某个命中停止条件，后面的直接丢掉。判停之后这条请求占的块怎样还、结束原因怎样发回前端，见[请求收尾](request-teardown.md#引擎先判停同一步里先还块再把结束原因发出去)。
- 请求设的停止字符串（stop）要把编号还原成文字才能比对，而一个字符串可以横跨好几个 token，所以放在负责还原文字的前端进程里判断，见主线[第 7 站](one-request.md#第-7-站-返回与收尾)；前端怎样先扣住结尾几个字再比对，见[流式输出的停止字符串一节](streaming-output.md#停止字符串先扣住结尾几个字)。

### 最少输出数怎样挡住提前结束

**最少输出数限制的是“多早允许结束”，不是让模型把答案凑到指定字数。** 采样前，如果已经生成的 token 数还没达到门槛，就把 EOS 和停止编号对应的分数设成负无穷，让它们无法被选中；达到门槛后解除这层屏蔽，再按正常分布选择。它在 greedy 下也生效，因为被屏蔽的编号连最大分的竞争都不能参加。

下例沿用普通文本生成。rc2/main 与结构化输出组合时有一个例外：若最少长度屏蔽使一行完全没有可选项，会恢复屏蔽前仍为有限分数的停止编号，让已经完成的结构可以结束。被恢复的停止编号一旦选中，请求便会早于最少长度收尾；不能把普通文本的屏蔽规则当成任意组合下的硬保证。

先看普通逐 token 生成，沿用上面的「猫」「。」示意，最少设为 2、最多设为 4。假设模型原本一直想结束，这个门槛怎样改变选择：

| 即将选择 | 已有输出数 | EOS / 停止编号能否参与 | 假设这一步实际选出 |
|---|---|---|---|
| 第 1 个 token | 0，小于 2 | 屏蔽 | 猫 |
| 第 2 个 token | 1，小于 2 | 仍屏蔽 | 。 |
| 第 3 个 token | 2，已达门槛 | 解除屏蔽 | EOS，于是结束 |

这里得到两枚普通输出后，最早在第 3 次选择才允许 EOS；并不是“第 2 枚一定要结束”。如果一直没选到结束编号，最多仍只输出 4 枚。若最少和最多都设为 2，两枚普通输出之后就因长度到限结束，没有第 3 次选择 EOS 的位置。

计数看的是输出编号，不含提示词，也不等于最终看见的字符数。前端对停止字符串同样保护最少长度：在门槛以内已经完整出现的停止文字不会触发；跨过门槛才补齐的字符串仍能命中，截掉它之后显示的文字就会更短。精确匹配、截断与停止编号的区别放在[停止条件的配合](request-teardown.md#停止文字停止编号和忽略-eos-怎样配合)。忽略 EOS 也不等于关闭这层最少长度屏蔽；其内部编号集合仍包括模型 EOS。

不要同时把白名单缩成只有 EOS、又要求先生成若干普通 token：白名单之外被挡住，EOS 又被最少长度挡住，交集就空了。禁词或结构化输出也要保留至少一个可选编号。取消、异常仍会中止请求；最少长度不是成功返回指定长度内容的承诺。

## 思考预算怎样让模型转去回答？

这里限制的是生成过程中的思考 token 数；请求的思考强度交给模型模板解释，隐藏思考输出则作用在返回链。三种控制的区别及结构化输出组合，见[流式输出](streaming-output.md#隐藏思考少思考和不思考是同一个开关吗)。

**思考预算限制的是推理段能继续生成多久；达到预算后，采样路径推动模型写出“思考结束”的标记，再继续生成答案。** 它和最大输出数不同：最大输出数用尽会结束整条请求，思考预算用尽通常只是从思考段切换到答案段。推理解析器负责把两段放进 reasoning 和 content，见[流式输出](streaming-output.md#思考段工具调用和断开连接流里还会出现什么)；配置解析器本身也不等于关闭模型思考。

这项能力依赖执行版本。**本页固定 GLM 镜像及 Ascend v0.23 / v0.26 的输入批次没有启用思考预算状态，不能靠添加一个请求字段就取得预算效果。** rc2 与固定 main 已把状态创建、更新和采样消费接起来，仍须配置与模型匹配的推理边界；下列机制按这条已接通的路径解释，不改写旧双机配方。

假设提示词只带了思考开始标记，还没有思考正文；预算是 4 枚，结束标记在这个示意分词器里占 2 枚。若模型没有提前结束思考，普通逐 token 路径用完 4 枚后，会依次推动这 2 枚结束标记，再留给模型生成答案。在这个未提前结束的示意中，总输出上限为 4 时，请求先因长度到限截断，连结束标记都发不全，更谈不上给答案留空间。因此预算、结束标记和答案要一起考虑，总输出数并不等于思考预算。

状态会检查实际编号和边界。如果提示词已经包含一个尚未结束的思考段，其中开始标记后的已有位置也会消耗这段预算；不是每次请求都无条件另给完整额度。模型自然更早结束思考时也不必用满。指定的结束串可以包含过渡文字和结束标记，执行时按对应 token 序列逐枚提高分数，不是直接发送 EOS 或由前端截掉文字。投机路径还要处理候选与额外 token 的位置，不能按“一个模型步消耗一枚”计算。

这会增加每条请求的状态、历史检查和改分工作，也会改变模型生成的推理过程。预算过紧可能损害答案质量，选择预算时需对照答案是否完整、准确。强制结束串在其他筛选与罚分之后改写分数，不应与禁止这些结束编号的白名单或语法条件冲突。不同模型对“关闭思考”的模板变量各有约定，预算为 0 也不等于任何模型的 enable_thinking=false。

## 放到 GLM 双机：采样在哪一步、谁来做？

**GLM 双机是 2 台机器、每台 8 张卡；每台机器是一个 DP 请求组，组内按 TP8 协同计算，MoE 专家则按 EP16 跨两台机器路由，不能把每台机器理解成独立存着整个模型（部署前提见 [GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)）。前向结束后，每台机器的 8 张卡都拿到完整的 154880 个分数，各自执行同一套采样，只有 0 号卡把结果交回引擎。第一步只采 1 行；之后每一步还要验证 3 个候选 token——候选来自 MTP，GLM 自带的一层预测层，每步先猜后面 3 个，下文单独讲。**

下面沿用主线的示例请求 R1：提示词 4 个 token，这是教学设定，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。

### 分数怎样到每张卡上

**词表投影按词表切给 8 张卡，每张卡只算 19360 个词（154880 ÷ 8）的分数，再做一次 All-Gather 拼成完整的一份；采样前 8 张卡手里的分数一模一样。**

All-Gather 是一种集合通信：每张卡交出自己算的那一段，拼成完整的一份发给所有卡，见 [All-Gather](collective-communication.md#all-gather)。每条请求要取几行分数，看这一步有没有候选：R1 第一步是 prefill（一次算完提示词的全部位置，见 [prefill](prefill.md)），没有候选，只取最后一个位置那一行，每张卡上是 `[1, 154880]`；此后每一步送进 1 个确定 token 和 3 个候选，4 个位置都要分数，是 `[4, 154880]`。一台机器满载时 32 条请求都在 decode（提示词算完之后逐个往后生成的阶段），每张卡上就是 `[128, 154880]`，BF16 约 37.8 MiB（128 × 154880 × 2 B）。为什么按词表切、All-Gather 怎么拼，见 [lm_head](lm-head.md)；R1 每一步的字节数只在主线的[最终归一化与词表投影](one-request.md#最终归一化与词表投影)推导，这里不重算。分数进采样前先转成 fp32（每个数 4 字节）；R1 的一个 decode 步里，3 个验证行转出的 fp32 副本约 1.77 MiB（3 × 154880 × 4 B）。

### 8 张卡各采一遍，只交回一份

**每张卡由一个 worker 进程驱动。采样和前向是引擎发给这 8 个 worker 的两次调用：第一次跑前向、算出分数，第二次才采样。各卡用相同的采样实现处理相同分数，并保持同一随机流与取数顺序时，得到同一个结果；8 张卡都留着结果接着做 MTP 草拟，0 号卡另外把结果交回引擎。**

```wiki-diagram
file: sampling-flow
```

相同种子让随机流从同一起点开始，但还要保持后续取数顺序一致。vLLM 在各 worker 启动时设置同一个全局种子，参数说明强调这是 TP 各卡保持选择一致的必要条件；官方教程两台机器都设 `--seed 1024`。请求自己带 seed 时，那一行改用独立发生器，同样需要各卡使用一致的实现和取数顺序。跨次运行的逐字复现还有分数本身是否一致的问题：在线服务的批组成每一步都在变，昇腾跨卡归约默认也不保证逐位一致，不能由种子单独保证复现，详见 [batch invariance](batch-invariance.md)。

谁交回结果由一个公式定：这个 DP 组的卡数，减去「TP 数 × 上下文并行数」；本部署上下文并行数是 1，8 − 8 × 1 = 0，所以是 0 号卡。为什么不让 0 号卡一张卡采样、再把结果广播给另外 7 张？因为紧接着的 MTP 草拟在每张卡上都要用这个 token：各卡自己采一遍，结果当场就在本卡，省掉一次广播。

采样本身按前面讲的顺序走，昇腾换了其中两件实现：

- **top-k 和 top-p**：在 A2 上换成 torch_npu 提供的一个融合算子，一次完成截断。
- **抽取**：用上一节的指数噪声，每个词发一个 q，取「概率 ÷ q」最大的词。

这台部署还有两个默认关着的昇腾开关，都要额外配置才打开：一个让每张卡先在自己那 19360 个词里挑出前几名、只把候选拼到一起，从而少传数据；另一个在前向进行的同时，提前在另一条流上把指数噪声 q 抽好。部署没有给额外配置，两者都不生效。

### 请求不写采样参数时，用的是什么

**GLM 的模型目录里带着生成配置（固定 revision 690b7052 的官方 generation_config.json）：temperature 1.0、top-p 0.95，没写 top-k。教程的启动命令没有改生成配置的来源，所以请求里不写这几项时，按 T = 1、top-p = 0.95、top-k 关闭来采样。**

这组值的意思是「分数不缩放，只截掉累计概率 95% 之外的尾巴」。套到前面 6 个词的小例子上（$T = 1$、$\text{top-p} = 0.95$、top-k 关闭，示意），看它会留下几个：

| 候选词 | 原始概率 | 累计概率（对比 $p = 0.95$） | 截断后重归一概率 |
| --- | --- | --- | --- |
| 猫 | $0.634$ | $0.634 < 0.95$（继续） | **$0.665$** |
| 你 | $0.233$ | $0.634 + 0.233 = 0.867 < 0.95$（继续） | **$0.245$** |
| 看 | $0.086$ | $0.867 + 0.086 = 0.953 \ge 0.95$（留下，后续 3 词截掉） | **$0.090$** |

留下的是猫、你、看，概率和第 ③ 步 top-k = 3 之后一样。在真实的 154880 个词上，每一步留下几个词随分布变：模型很确定的位置可能只剩一两个，拿不准的位置会留下更多。请求显式写了 temperature 或 top-p，就以请求为准；想让 GLM 按 greedy 输出，请求把 temperature 设成 0。

这份固定生成配置也没有设置三种 penalty，教程没有覆盖它们，所以请求省略时，presence 与 frequency 都是 0，repetition 是 1，三项均不罚。请求开启后，固定 Ascend 实现在 Triton 可用时使用自己的罚分算子，按上面的历史范围与顺序修改每行完整词表分数；没有 Triton 时普通采样回退到上游实现。

允许编号、禁词、分数偏置都是逐请求设置，不是 Ascend 启动开关，省略时均不施加这些限制。**这份 GLM 配方开启 MTP，非空的分数偏置映射会在参数校验时被拒绝；即使映射里每个值都是 0，也仍然非空。** 普通非投机服务才可使用前面的偏置例子。允许编号和禁词可走固定 MTP 验证路径：验证每个候选前应用该请求的白名单，禁词则像罚分一样，把该位置之前的候选暂接到输出历史后再匹配；额外 token 的采样使用含全部候选的历史。它们约束目标验证，不能据此要求 MTP 草拟阶段从不提出被禁候选。

### 有 MTP 候选时：采样变成验证

**decode 的每一步，每条请求有 4 行分数：前 3 行用来验证 3 个候选，最后 1 行在候选全部通过时再多出一个 token。验证之前，这 3 行照样经过改分数、temperature、top-k、top-p 这一整套；greedy 请求比较候选是不是最高分，随机请求按目标概率决定接受还是拒绝。**

候选是 MTP 草拟出来的：每一步采样结束后，MTP 接着刚采出的 token 往后猜 3 个，过程见主线[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。它每一遍都直接取最高分的词，不看请求自己的 temperature 和 top-p。

下一步主模型把 1 个确定 token 和 3 个候选一起算完，每个候选位置得到一行完整的目标分数，按请求的设置处理成目标概率，再逐个判断：

- **greedy 请求**：候选和这一行的最高分相同就接受，接着看下一个；第一次不同，就改写成这一行的最高分并停下。
- **随机请求**：按候选在这一行里的目标概率接受。以小例子为例，某个位置的目标概率是猫 0.731、你 0.269，候选是猫：抽一个 0 到 1 之间的随机数 u，u 不超过 0.731 就接受猫；否则拒绝，从去掉猫之后的概率里重新抽一个，这里只剩你。合起来，这个位置输出猫的机会是 0.731、输出你的机会是 0.269，和直接采样完全一样。候选如果是看，它已被 top-p 截掉、目标概率是 0，一定被拒。

一次验证最多通过 3 个候选，全部通过时再用最后 1 行采一个额外的 token，所以每一步交回 1 到 4 个 token。接受规则的一般原理见[投机解码](speculative-decoding.md#greedy-验证与随机采样分开理解)；R1 两圈 decode 各接受几个、计数怎么回退，见主线[第 6 站](one-request.md#第-6-站-结果更新接受几个候选回退几格)。

这里“去掉被拒绝候选后重抽”针对这份 GLM 的确定性草稿路径：实现没有完整草稿概率，把被拒绝编号的目标概率置零后按其余目标概率抽取。有完整草稿分布的通用验证则要按目标概率与草稿概率之差构造恢复分布，不能照搬只去掉一个词的规则。

罚分在验证每个位置时，需要把该位置之前的候选暂时接到已有输出上。例如已有输出为猫、候选依次为猫／你／看，验证第 1 个候选时输出历史只含原来的猫；验证第 2 个时含猫／猫；验证第 3 个时含猫／猫／你。frequency 因而能数到前面候选造成的重复，而不是三行都用同一份旧计数。这里是在计算「前面的候选都成立时」的条件分布，尚未接受的候选不因此变成正式输出；第一次拒绝后，后续候选按验证规则丢弃。固定上游验证路径先罚分，再处理允许编号、禁词与最少长度等限制；不能把普通采样中其他处理器的完整顺序照搬过来。

### 打开概率记录，会多做哪些工作？

本部署默认不请求概率记录；服务允许的前几名数量默认上限是 20，数值口径默认是采样器入口的对数概率。打开生成记录后，要从已经得到的词表分数计算或取出所需值、搬回 CPU 并组装响应；返回全词表则每个输出位置都对应 154880 个词，开销随位置数增长。只取少量记录能减小返回量，但对数归一化仍要看到整排分数。

MTP 返回的是最终保留下来的输出 token 的记录，被拒绝的候选会过滤掉；不要把候选的接受概率与这份目标模型的 token 记录混为一谈。固定实现的指定编号收集没有贯通候选验证与额外 token 的拼接，因此不能在本部署的 MTP 3 路径上承诺按指定编号返回。需要这种查询时，使用未启用投机解码的实例核验；换成 greedy 不能消除这项路径差异。

默认原始对数概率仍是本部署说明的基准。改用处理后模式时，固定实现的额外 token 采样存在模式覆盖未完整传递的边界，不能保证其记录与普通逐 token 路径一致；下方版本区保留这个限制。提示词记录的额外词表投影与缓存影响统一见 [prefill](prefill.md#提示词已经给定为什么还要算它的概率)，不计入本页已有的普通生成形状账。

### 停止判断和长度上限

**0 号卡交回结果后，引擎把这一步接受的 token 逐个追加到请求上，每追加一个就检查一次停止条件；命中了，后面的 token 丢掉。GLM 的结束编号有三个，长度上限是 133120。**

GLM 的生成配置列了 154820、154827、154829 三个结束编号（各是什么，见 [token](token.md#编号要落在-154880-行之内)）。分词器自己的结束 token 是 154820，按结束 token 处理；154827、154829 并进停止 token。三者被抽中都算正常结束。部署把单请求总长度上限设成 133120，chat 请求不写 max_tokens 时，最多能写到 133120 减去提示词长度。R1 在 max_tokens 到限时怎样截断、只返回前几个 token，见主线[第 7 站](one-request.md#第-7-站-返回与收尾)。

接近长度上限时，候选也要收口：MTP 草拟到超出上限的位置，那些候选直接作废；调度器也会把这一步能送进模型的 token 数截到上限以内，于是这一步少于 4 个位置。

## 常见误解

- **「logits 就是每个词的概率。」** logits 是分数，可正可负，加起来也不等于 1；要经过 softmax 才是概率。而且只有分数之间的差有意义，所有分数同时加一个数，概率不变。
- **「temperature 改的是模型算出来的分数。」** 前向算出的分数不受它影响，temperature 只在采样时把分数除一下。它也不改变先后，所以 greedy 的结果和 temperature 无关。
- **「top-p = 0.8 就是留下前 80% 的词。」** p 是累计概率，不是词的个数比例。在 T = 1、top-k = 3 的例子里，0.8 只留下 2 个词，跨过 0.8 的那个词也留下；留几个随分布而变。
- **「top-p 留几个词和 temperature 无关。」** top-k 留下哪几个与 temperature 无关，top-p 不是：同样 top-k = 3、top-p = 0.8，T = 1 留 2 个，T = 0.5 只剩 1 个。
- **「temperature 设成 0，top-k、top-p 还在起作用。」** temperature 等于 0 就按 greedy 处理，参数对象会把 top-k、top-p、min_p 都重置成关闭。反过来，传一个 0 到 0.01 之间的小正数也换不来「更确定的随机」：它会被抬到 0.01，仍按随机抽。
- **「8 张卡各采一遍，会抽出 8 个不同的 token。」** 相同分数、相同采样实现，再配合同一随机流与取数顺序，才能得到一致结果；种子只规定随机流起点。该部署只有 0 号卡把结果交回引擎。
- **「请求固定了 seed，结果就一定可以逐字复现。」** seed 固定的是随机数。分数本身如果随同批请求的组合出现细微的数值差别，抽出的 token 仍会不同；这类一致性见 [batch invariance](batch-invariance.md)。
- **「MTP 草拟只取最高分，所以开了 MTP 的随机请求会变得像 greedy。」** 候选只是提议，每个候选都要按请求自己的目标概率接受或拒绝，拒绝后再从剩下的概率里重抽；输出每个词的机会和直接采样一样。
- **「返回的 logprobs 就是抽签用的概率。」** vLLM 默认用改分数和 temperature 之前的原始分数算 logprobs，和最后抽签用的概率不是同一组数。
- **「结束 token 和停止字符串都在加速卡上判断。」** 结束 token、停止 token 和长度在引擎进程里（CPU 上）判断；停止字符串要先还原成文字，在前端进程里判断。

## 对照源码

同输入得到不同输出时，先保存模板处理后的实际输入编号与最终生效参数，再在相同历史下比较首次分歧。greedy 取消随机选择，但不会自动消除分数的数值差异；完整的分层对照见[输出异常排查](inference-correctness-troubleshooting.md)。

### 怎么开

**Beam search 使用独立参数对象。** 对已有且支持生成的离线 llm，可构造 `BeamSearchParams(beam_width=2, max_tokens=8)` 并调用 llm.beam_search；两个参数都要明确提供。Python 的 temperature 默认 0，length_penalty 默认 1，ignore_eos 默认 false。输出是候选序列列表，应按实际列表长度读取，不假定任何输入都能返回恰好两条成功结果。

HTTP 在已有有效 Chat 或 Completion 请求中设置 use_beam_search=true、n=2、max_tokens=8；这里 **n 决定 beam width**，缺省取 1，而不是在 beam 之外再套一层独立回答数。HTTP 温度从请求值或模型生成默认取得，想用 0 就显式写 temperature=0，不能套用 Python 对象的默认。转换实际传递的是长度、温度、ignore_eos、length_penalty、include_stop_str_in_output 等 beam 字段；普通 top-k、top-p、penalty 和 structured_outputs 不会因同时写在 JSON 中就进入该搜索流程。

**生成式评分使用独立 POST /generative_scoring**，JSON 顶层传 query、items 和 label_token_ids；model 可选，填写时仍须匹配服务名称。query 可为文字或编号列表，items 可为文字列表或编号列表的列表。标签来自当前分词器，至少一项；例如先分别编码“是”“否”，确认各为一枚 token，再将所得编号依次放入列表，不能照抄其他模型的编号。服务须支持生成任务，实际执行链还须能返回所有指定编号的记录。

| 请求字段 | 默认 | 实际行为 |
|---|---|---|
| apply_softmax | true | 只在指定标签之间归一化，最终返回第一个标签的分数；false 对记录值直接取指数 |
| item_first | false | false 拼 query 编号再拼 item；true 交换顺序，不增加模板或分隔符 |
| add_special_tokens | true | 仅文字 query 分词时应用；文字 item 总是不额外补特殊 token，直接编号输入保持原样 |
| priority | 0 | 传给每个子请求；优先级调度另按服务策略，rc2/main 另限制为有符号 64 位整数 |

接口为每项设置 max_tokens=1、n=1，并以标签个数同时填写 logprobs 和 logprob_token_ids，因此标签数量同时受服务 max_logprobs 与指定编号最多 128 项等检查。items 不能为空，标签须在模型词表内。超长拼接保留最前面的 max_model_len−1 个编号；调用前应核对实际输入，避免末尾的问题或候选被截掉。

要把 apply_softmax=false 的结果解释为完整词表概率，服务应使用 raw_logprobs 记录模式；该请求字段本身不会改变模式。若服务选 raw_logits，记录值可能为正，例如 exp(2)≈7.389，已经不是概率。processed_logprobs 则对应处理后的分布；四种记录模式的边界见下方参数表。成功响应按输入顺序给出 data[i].index 与 score，usage 按各项实际输入和输出汇总。

**自定义改分规则分两步配置。** 先在启动时加载处理器，再由每条请求传它认识的参数。V1 的批级类继承 vllm.v1.sample.logits_processor.LogitsProcessor，提供构造、apply、update_state、is_argmax_invariant，并实现 validate_params 检查自己的参数。检查应覆盖类型、编号范围和空候选等业务条件；通过通用 HTTP 字段检查，不代表自定义规则的输入合法。

| 加载方法 | 入口 | 条件 |
|---|---|---|
| 服务或 Python 显式指定类路径 | CLI `--logits-processors your.module:YourProcessor`；EngineArgs / LLM 的 logits_processors 列表 | 模块在执行环境可导入，目标是批级 LogitsProcessor 子类 |
| 安装包声明插件入口 | Python 包的 vllm.logits_processors entry point 组 | 普通支持路径会发现并加载已安装插件；投机等提前返回分支另见版本条件 |
| Python 直接传类对象 | logits_processors=[YourProcessor] | 传类而非随单条请求动态装载一个实例；HTTP 请求不能这样上传处理器 |

上述加载集合在引擎初始化后固定，请求只能控制已经装入的逻辑。在线请求用 `vllm_xargs` 传扩展参数，例如 {"target_token": 1}；兼容 SDK 放入 extra_body.vllm_xargs，服务再交给 SamplingParams.extra_args。离线直接构造 SamplingParams(extra_args={"target_token": 1})。这里假设已安装的处理器明确约定 target_token 的含义；只发送这个名字不会自动获得“只选某个 token”的内置功能。

已有逐请求 callable 需要通过 AdapterLogitsProcessor 包成批级接口：新请求时创建它的处理器，不启用时返回 None；适配器负责随批次移动状态，但默认逐行调用，仍有相应开销。不能把旧逐请求对象直接当成新版批级类。固定 GLM 使用 MTP，不能直接在其命令后追加自定义处理器；兼容边界见下方版本表。

**思考预算的入口。** `thinking_token_budget` 是 Chat、Completions 请求的顶层字段，也是 Python SamplingParams 的同名参数；默认 None，HTTP 省略/null 或显式 −1 表示不设置这项限制，非负整数表示预算，0 有效，布尔值、小数和其他负数拒绝。它不在 generation_config 的六项默认提取名单里，也不放进 Ascend additional_config。

服务需要通过 `--reasoning-parser` 和／或 `--reasoning-config` 建立与模型匹配的开始、结束 token 序列。ReasoningConfig 的 reasoning_start_str 与 reasoning_end_str 是字符串，由服务分词，不要求调用方硬填 token ID；解析器提供可用边界时可据此补齐，显式结束串还可带过渡文字。字段存在、解析器能把输出分段、设备实际执行预算，是三项分别需要满足的条件。

在已经满足这些条件的 rc2/main 服务上，可提交下面的 Chat 请求体示意。model 替换成该服务登记的名字；32 和 256 是展示两层预算的示例值，不是 GLM 旧部署的推荐配置。

```json
{
  "model": "已有推理模型的服务名",
  "messages": [{"role": "user", "content": "简要说明你的解题步骤，再给出答案。"}],
  "thinking_token_budget": 32,
  "max_completion_tokens": 256
}
```

Completions 改用 prompt 与 max_tokens；兼容 SDK 将扩展字段放进 extra_body，实际 HTTP JSON 仍是顶层字段。离线可把 `SamplingParams(thinking_token_budget=32, max_tokens=256)` 交给已正确初始化推理配置的 llm。收到预算与 reasoning_config 不兼容的错误时，应先检查边界是否成功初始化，再按下方版本表核执行路径；不能因为请求成功解析就认定设备已经限制了思考。

采样没有总开关，每个请求都要经过它；行为由请求里的采样参数决定：`temperature`、`top_p`、`top_k`、`min_p`、`seed`，罚分三项，`logit_bias`、`allowed_token_ids`、`bad_words`、`min_tokens`、`max_tokens`、`stop`、`stop_token_ids`、`ignore_eos`。参数的默认值、合法范围和 greedy 的归一化都在 `SamplingParams` 里；0 到 0.01 之间的温度也是在这里被抬到 0.01 的。[C9][C43]

**温度、截断与请求种子的精确入口。** 下表是普通文本生成的 Chat、Completions 和 Python SamplingParams；机制演算沿用前文，不把对象默认等同于 GLM 服务默认。

| 参数 | SamplingParams 默认与范围 | 普通 HTTP 省略 / null | 关闭与特殊值 |
|---|---|---|---|
| `temperature` | 1.0；基线要求非负，应用传有限数；v0.26/main 限定有限且 ≤2 | 先服务默认，再 1.0 | 0 选 greedy；1 不缩放；0<T<0.01 抬到 0.01 |
| `top_p` | 1.0；0<p≤1 | 先服务默认，再 1.0 | 1 关闭这项截断；0 非法 |
| `top_k` | 0；整数，接受 −1、0、正整数 | 先服务默认，再 0 | 0 或 −1 关闭；1 只保留最高分层，边界并列依后端规则 |
| `min_p` | 0.0；0≤值≤1 | 先服务默认，再 0.0 | 0 关闭；1 仅保留达到最高概率的候选；MTP 限制见下文 |
| 请求 `seed` | None；整数或 None，−1 初始化为 None | None，不从模型生成默认或全局种子填一个字段值 | 0 是有效独立种子；null/−1 不建独立流；HTTP 接受 −2⁶³ 到 2⁶³−1 的整数 |

前四项直接构造 SamplingParams 时省略就用表中对象默认，不传 None；from_optional 可为温度、top-p 归一化 None，但本基线的 top-k、min_p 仍应传数值。请求 seed 的 HTTP 有符号 64 位范围不等于 Python 对象做过同一检查：对象没有专门的 seed 范围检查，实际还受设备随机数实现约束，跨入口可使用 0 到 2³¹−1 的普通整数。top-k 大于词表大小时，在已核的上游输入批次路径会按词表大小限制，不能借此增加词表候选。

**当前 GLM MTP 的随机请求把 min_p 保持为 0。** 例如温度 0.8、min_p=0.1 会在引擎入口被拒绝。精确判据是初始化后的 min_p>0.00001，或非空 logit_bias，与 speculative_config 不兼容；非常小的正值即使通过这个检查，也不作为有意义的 MTP 截断用法。温度 0 会先把合法的 top-p/top-k/min_p 重置为 1/0/0，再进入投机兼容检查，所以合法 min_p=0.1 在 greedy 下会被归零；top_p=0、top_k=−2、min_p=1.1 则在归零之前就失败。

下面是向已有 glm 服务的 `/v1/chat/completions` 提交的完整请求体，Content-Type 为 application/json。用前文的覆盖示意时，它显式固定四项采样数值与请求种子；0.8、20 和 2026 是接口示例值。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用一句话描述一只正在休息的猫。"}],
  "max_completion_tokens": 64,
  "temperature": 0.8,
  "top_p": 0.8,
  "top_k": 20,
  "min_p": 0.0,
  "seed": 2026
}
```

Completions 将 messages 换成 prompt 字符串，输出上限用 max_tokens，五项仍在 JSON 顶层。top_k、min_p 是 vLLM 扩展；兼容 SDK 使用 extra_body 传入这两项，发到服务的 JSON 不保留 extra_body 包装。普通非投机服务想试前面的最小相对概率算例，可改 min_p=0.1；固定 GLM MTP 不采用这一步。

**离线保留模型默认，再显式覆盖。** 下例接在已初始化的 llm 后面，先读默认，再新建 SamplingParams，使温度归一化和参数校验重新执行；直接给旧对象属性赋值不会自动重跑这些初始化规则。

```python
from vllm import SamplingParams

defaults = llm.get_default_sampling_params()
params = SamplingParams(
    temperature=0.8,
    top_p=defaults.top_p,
    top_k=defaults.top_k,
    min_p=0.0,
    repetition_penalty=defaults.repetition_penalty,
    max_tokens=64,
    seed=2026,
)
outputs = llm.generate(["用一句话描述一只正在休息的猫。"], params)
print(outputs[0].outputs[0].text)
```

六项可继承默认中，上例复制了 top-p、top-k、repetition，显式覆盖温度、最小相对概率和最大输出数。完全交给模型默认时可省略 llm.generate 的 sampling_params；显式传 SamplingParams() 则采用中性对象默认。离线 prompt 与 Chat 模板处理后的输入不同，比较输出前先对齐输入编号。

**生成默认与全局种子的启动入口。** 以下三项是引擎启动设置，既不是逐请求字段，也不放进 Ascend additional_config。

| 启动 CLI / Python LLM 关键字 | 默认、合法形状 | 怎样生效 |
|---|---|---|
| `--generation-config` / `generation_config` | 字符串 auto；也可 vllm 或存放生成配置的目录/模型仓库标识 | auto 随模型来源读取；vllm 跳过模型的采样默认；其他字符串作为配置来源 |
| `--override-generation-config` / `override_generation_config` | JSON 对象 / Python dict；默认 {} | 对读到的配置按键覆盖；vllm 模式下仍应用该字典 |
| `--seed` / `seed` | 整数，默认 0；固定初始化调用 NumPy，使用 0≤值<2³² | 初始化 Python、NumPy、Torch 和设备的全局随机状态；固定教程两端都是 1024 |

全局 seed 的声明没有独立范围校验，但初始化会调用 np.random.seed；负数或超出该 32 位范围的值可在启动阶段失败。它没有请求 seed 的「−1 归为 None」约定。不要因请求体里写了 seed=2026，就把双机启动命令中的 1024 删掉或改成两端不同值。

读取生成配置时，首先尝试 generation_config.json；未找到而发生 OSError 时，再尝试从模型 config 构造生成配置，两者都未找到才返回空配置。格式损坏等其他异常仍可能传播。模型路径与配置来源的下载、权限、revision 条件也应一致；固定 auto 使用模型 revision，自定义来源不沿用该分支中的模型 revision 参数。

本节前面的三层覆盖示意，对应在原部署命令上设置以下**参数片段**；保留原命令的模型路径、双机并行与 MTP 设置，两端同步修改，不把片段当成完整双机启动命令：

```bash
--generation-config auto --override-generation-config '{"temperature":0.8,"top_k":20}' --seed 1024
```

Python LLM 构造入口对应 generation_config="auto"、override_generation_config={"temperature": 0.8, "top_k": 20}、seed=1024。想用中性底值再覆盖，只将 auto 改成 vllm。请求显式给 top_p=0.8 后得到前表最后一行；省略或 null 则继承服务值。启动覆盖字典若给 top_p:null，先覆盖掉模型的 0.95，再被默认提取名单过滤，普通 HTTP 最终回退到 1：**启动覆盖中的 null 与请求中的 null 含义不同。** 要清楚表达关闭，直接覆盖为 1 更直观。

默认提取仅接受 repetition_penalty、temperature、top_k、top_p、min_p、max_new_tokens 六项，最后一项映射成 max_tokens；seed、presence_penalty、frequency_penalty 不在名单中。把 seed 填到覆盖字典不会设置任何一层随机种子。max_new_tokens 涉及额外的服务硬上限规则，统一见[输出预算](api-server-entry.md#怎么开)，不把温度的覆盖顺序原样套到长度上限。EOS 等特殊编号走另一条读取链，见[停止条件](request-teardown.md#怎么开)。

**三种 penalty 是逐请求字段，不是启动 CLI 开关，也不放进 Ascend 的 additional_config。** 以下范围用于普通文本生成采样，三项都是浮点数；关闭值可单独指定，也可一起指定。[C47]

| 参数 | SamplingParams 默认 / 关闭值 | 数值范围 | 特殊取值 |
|---|---|---|---|
| `presence_penalty` | 0.0 / 0.0 | −2 ≤ 值 ≤ 2，含端点 | 负值鼓励重复 |
| `frequency_penalty` | 0.0 / 0.0 | −2 ≤ 值 ≤ 2，含端点 | 负值鼓励重复，随输出次数累加 |
| `repetition_penalty` | 1.0 / 1.0 | 正数；基线没有数值上限检查 | 0 < 值 < 1 鼓励重复，0 和负数非法；应用应传有限数 |

**入口默认值与参数对象的默认值要分开看。** 对 Chat/Completions，请求显式给数值就使用该值；省略与 null 的处理如下。直接构造 SamplingParams 则使用对象自身的默认值，不会再替你合并模型默认。要继承离线 LLM 的模型默认，可以先调用其 get_default_sampling_params()，再按前面的离线示例构造带显式覆盖的新对象，使初始化规则重新执行。

| 入口 | presence / frequency 省略或 null | repetition 省略或 null |
|---|---|---|
| `POST /v1/chat/completions` | 请求字段默认 0.0；null 在 from_optional 中归为 0.0 | 字段默认 None；先读服务生成配置，没给再取 1.0 |
| `POST /v1/completions` | 同 Chat | 同 Chat |
| Python `SamplingParams(...)` | 省略为 0.0；直接构造时不要传 None | 省略为 1.0；直接构造时不要传 None |
| Python `SamplingParams.from_optional(...)` | None 归为 0.0 | None 归为 1.0；这个方法本身不读取模型文件 |

例如把 repetition 省略，会允许服务的模型默认生效；显式写 1.0 才是覆盖它并关闭该项。presence 与 frequency 不在固定版本的生成配置读取名单里，即使写入 generation_config.json 或 override_generation_config，也不会沿这条默认值路径生效。GLM 固定配置下最终仍是 0 / 0 / 1。

**HTTP JSON 用法。** 固定教程把服务名设为 glm；向主节点的 `/v1/chat/completions` 发送下面的 JSON，Content-Type 为 application/json。这里演示只打开 presence，另外两项显式关闭，参数值用于示范接口，不承诺实际文本会按六词算例输出。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用三句话描述猫，每句换一个观察角度。"}],
  "max_tokens": 128,
  "temperature": 0,
  "presence_penalty": 1.5,
  "frequency_penalty": 0.0,
  "repetition_penalty": 1.0
}
```

换成 `/v1/completions` 时，用 prompt 字符串替换 messages，三种 penalty 仍是 JSON 顶层字段。repetition 是 vLLM 的扩展字段；用只声明标准字段的兼容客户端时，通过客户端的额外请求体机制传入，例如 Python OpenAI SDK 的 extra_body；发到 vLLM 的最终 JSON 仍应与上面一样，不能再包一层名为 extra_body 的对象。

**Python 参数对象用法。** 下面的参数接到已经初始化好的离线 LLM 对象 llm 上；双机初始化配置沿用部署章节，这里只展示逐请求设置。它显式指定三项，故不依赖模型默认值；想单独比较频率罚分，就把 presence 置 0、frequency 改成 0.5；想单独比较重复罚分，就把 presence 置 0、repetition 改成 1.1。

```python
from vllm import SamplingParams

params = SamplingParams(
    temperature=0,
    max_tokens=128,
    presence_penalty=1.5,
    frequency_penalty=0.0,
    repetition_penalty=1.0,
)
outputs = llm.generate(["用三句话描述猫，每句换一个观察角度。"], params)
print(outputs[0].outputs[0].text)
```

比较时保持相同输入和其余设置，每次只改一项；全部关掉的对照是 presence = 0、frequency = 0、repetition = 1。对 Chat 模型，离线原始 prompt 与经过 chat template 的 messages 不同，不能把这两个示例的输出当成同输入的可复现对照。

**偏置、允许编号、禁词的字段与入口。** 它们不从本页固定生成配置的默认值名单中读取，也不需要 additional_config。下表针对固定 v0.23 普通 Chat、Completions 和离线文本生成；具体证据对应页末来源 78–86、92。

| 参数 | 类型、默认和关闭 | 范围与归一化 | 基线入口 |
|---|---|---|---|
| `logit_bias` | 编号 → 浮点偏置；None/null 或空映射关闭 | HTTP JSON 的键是可转成整数的字符串；from_optional 转整数并把数值截到 [−100, 100]，超范围不是直接拒绝。直接构造 SamplingParams 用整数键，不经过这个截断；应用应传有限数 | Chat、Completions、Python 均传递；服务开启 speculative_config 时非空映射被拒绝 |
| `allowed_token_ids` | 整数列表；None/null 关闭 | 空列表非法；有分词器时要求 0 ≤ ID < len(tokenizer)，不是按显示文字去匹配 | Chat、Completions、Python 均传递 |
| `bad_words` | 字符串列表；Chat 省略为 []；Python 省略/None 归一化为 []；[] 关闭 | Chat 字段不接受 null；列表不能含空字符串，分词结果须在分词器有效编号范围内 | Chat 与 Python 支持；基线 Completions 未声明、也未传递此字段，不能靠 extra_body 使它生效 |

logit_bias 的编号另外按模型词表大小校验，要求 0 ≤ ID < model_config.get_vocab_size()；这与基线 allowed_token_ids 的分词器长度边界不是同一个检查。不要仅因为编号小于 GLM 的 154880，就断言白名单一定能通过。服务跳过分词器初始化时，基线白名单的编号边界检查会跳过，bad_words 也不会经过字符串转编号；需要禁词时应保留正常分词器初始化。

**Chat 禁词 JSON。** 向已有 glm 服务的 `/v1/chat/completions` 提交下面请求体，HTTP 头和发送方式沿用前面的 penalty 示例。这里禁止的是字符串分词后得到的序列，不保证排除所有同义表达。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用一句话描述一只正在休息的猫。"}],
  "temperature": 0,
  "max_tokens": 128,
  "bad_words": ["懒惰"]
}
```

**先取真实编号，再限制一枚输出。** 下例把 server 改成主节点地址；若服务有鉴权，在 headers 中补它要求的 Authorization。使用该服务的 `/tokenize` 获取 A、B 的编号，检查它们各自只有一枚 token，再向 Completions 请求一枚原始输出。这样不把 Chat 的推理段、模板或最终 content 显示与「采到一枚 token」混为一谈。

```python
import json
from urllib.request import Request, urlopen

server = "http://主节点地址:8000"
headers = {"Content-Type": "application/json"}

def post(path, body):
    request = Request(server + path, json.dumps(body).encode("utf-8"),
                      headers=headers, method="POST")
    with urlopen(request, timeout=120) as response:
        return json.load(response)

ids = []
for label in ("A", "B"):
    tokens = post("/tokenize", {
        "model": "glm", "prompt": label, "add_special_tokens": False
    })["tokens"]
    if len(tokens) != 1:
        raise ValueError("标签不是单枚 token，请换标签或使用 structured outputs")
    ids.append(tokens[0])

body = {"model": "glm", "prompt": "只选 A 或 B：猫属于动物吗？A 是，B 否。答案：",
        "temperature": 0, "max_tokens": 1, "allowed_token_ids": ids}
print(post("/v1/completions", body))
```

**偏置示例只用于未开启投机解码的服务。** 在该服务上重新执行上面的编号获取，再把 body 的 allowed_token_ids 删除、加入 `body["logit_bias"] = {str(ids[0]): 0.5, str(ids[1]): -2.0}` 后提交；这是加分/减分，不再强制输出属于 A/B。JSON 顶层键的形式因此是编号字符串，不是 "A"、"B"。固定 GLM MTP 服务不能直接执行这一步；把 temperature 设 0 也不会绕过兼容性校验。

离线接口使用同一批参数，直接构造时偏置键必须是整数。下面的 tokenizer 来自已经初始化好的 llm；每个参数对象单独传给 llm.generate，bias_params 仅用于未启用 speculative_config 的 llm。bad_words 不需要调用者手工转编号；引擎会在处理请求时用自己的分词器转换。

```python
from vllm import SamplingParams

tokenizer = llm.get_tokenizer()
label_ids = tokenizer.encode("A", add_special_tokens=False)
if len(label_ids) != 1:
    raise ValueError("这个标签不是单枚 token")
allow_params = SamplingParams(allowed_token_ids=label_ids, max_tokens=1)
bad_params = SamplingParams(bad_words=["懒惰"], max_tokens=128)
bias_params = SamplingParams(logit_bias={label_ids[0]: 0.5}, max_tokens=1)
```

通过兼容 SDK 提交时，allowed_token_ids、bad_words 这类 vLLM 扩展放在客户端的 extra_body，最终线上 JSON 仍须是顶层字段，规则与 repetition 相同。这里的示例覆盖请求形状与分词检查；输出质量需用自己的输入做对照，不能从一个固定偏置数推导推荐配置。

固定教程两台机器均用全局种子 1024、生成配置来源 auto；GLM 的 temperature 1.0、top-p 0.95 由模型配置进入默认合并，三个结束编号走停止配置链。上面的启动覆盖片段是展示用法，不是教程原命令已经设置了这些覆盖。

固定旧部署的昇腾侧有两个额外开关，都放在 `--additional-config` 里、默认关：`enable_reduce_sample`（先在每卡本地取前几名再拼接）和 `enable_async_exponential`（在另一条流上提前抽指数噪声）；后者只在 v0.23 与 GLM 的固定提交里有，前者在 rc2 也已删除，详见下方版本差异。[C24] 候选验证另有两条替代判据（按整块累乘概率判、按目标分布的熵调阈值），同样在额外配置里、默认关，本部署走的是正文讲的标准判据。

**最少输出参数。** `min_tokens` 是非负整数，Chat、Completions 和 SamplingParams 都有，默认 0，显式 0 关闭最少长度要求；HTTP 字段不接受 null。它是请求体顶层字段，不是启动参数或 additional_config，也不从本页的生成配置默认名单读取。有明确 max_tokens 时要求 min_tokens ≤ max_tokens；HTTP 入口按服务上限取小后，还要满足这个关系。离线显式 max_tokens=None 时，构造阶段跳过两者大小检查，调用方应先确认剩余上下文足够，不能用它绕过上下文容量。

向已有 glm 服务的 `/v1/chat/completions` 发送以下 JSON，Content-Type 为 application/json；这只要求先产生至少 16 枚可选输出编号，不保证 16 个汉字或 16 枚可见答案 token。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "简要解释为什么需要 KV cache。"}],
  "max_completion_tokens": 64,
  "min_tokens": 16
}
```

Completions 使用 prompt 和 max_tokens=64，min_tokens 仍为顶层 16；兼容 SDK 通过 extra_body 传扩展字段，最终 JSON 不保留这一包装。离线可将 `SamplingParams(min_tokens=16, max_tokens=64)` 交给已有 llm.generate。它与 ignore_eos、stop、stop_token_ids 的配合见[请求收尾参数表](request-teardown.md#怎么开)。固定 GLM 的 MTP 验证也会调用最少长度屏蔽处理：按已有输出长度和候选位置，屏蔽门槛前对应验证行的停止编号，不是把候选个数直接当成已生成长度。

**MTP 的额外 token 在基线中会更保守。** 三个候选全部接受后额外采的一枚，仍经过普通采样器按本轮开始时的输出列表维护的最少长度掩码；它不会因本轮候选刚好填满门槛就立即解除。例如步前已有 1 枚、最少数为 4，三枚候选均接受后已到 4，但额外的第 5 枚仍屏蔽 EOS；下一轮状态更新后才解除。它仍满足最少长度要求，却会推迟最早 EOS 时点，不能直接套前面的普通逐 token 示例。

**生成概率字段与入口。** 这组参数不进入前面的生成配置默认合并名单。请求参数控制是否记录、记录哪些编号和 Python 容器；服务参数控制数值口径与前几名上限。下面先列固定 v0.23 的真实入口，不把请求字段塞进 additional_config。

| 参数 / 入口 | 类型、默认与关闭 | 数量及作用 |
|---|---|---|
| Python `logprobs` | int 或 None；默认 None，None 关闭 | 0 只记所选 token；正数 k 记前 k 名加所选；−1 请求全词表，仍须服务上限允许 |
| Chat `logprobs` | bool 或 null；默认 false，false/null 关闭 | true 才开启生成记录；数量另由 top_logprobs 决定 |
| Chat `top_logprobs` | int 或 null；默认 0 | true+0 只记所选；正数 k 返回至多 k 个候选；−1 请求全部，须配合 logprobs=true 和服务上限。显式 null 不等于 0，会传成关闭且响应不生成记录 |
| Completion `logprobs` | int 或 null；默认 null | 0 仍记录所选，正数 k 记录前几名；基线拒绝所有负数，包括 −1。没有对应 Chat 的独立 top_logprobs 请求字段 |
| Python `logprob_token_ids` | list[int] 或 None；默认 None；None/空列表单独使用不启动记录 | 最多 128 个，每个满足 0 ≤ ID < 模型词表大小；实际查询这些编号并附所选 token。和 logprobs 同时给时，后者必须等于列表长度 |
| Python `flat_logprobs` | bool；默认 false，false 用普通列表 | true 为生成与提示词记录使用 FlatLogprobs；不自行开启任何记录，三版普通 HTTP 均未暴露该字段 |
| 服务 `--max-logprobs` | int；默认 20；−1 按词表大小作为上限 | 同时限制生成和提示词的前几名请求；0 仍允许“仅实际 token”，不是全局关闭记录。增大上限本身不会替请求开启记录 |
| 服务 `--logprobs-mode` | 枚举；默认 raw_logprobs | raw_logprobs / processed_logprobs / raw_logits / processed_logits；Python LLM 构造字段是 logprobs_mode，数量上限字段是 max_logprobs |

四模式中，前两项返回自然对数概率，后两项返回未归一化分数，可能为正，不能直接取 exp 当概率；raw/processed 的边界见正文，提示词路径另见 prefill。模式作用于整个服务，不是逐请求字段。选 logits 模式后内部字段仍叫 logprob，累计字段也仍做数值相加，不能再把累计值解释成序列对数概率。普通 HTTP 生成记录会把低于 −9999 的值夹到 −9999（包括负无穷），正分数保留；它不是无损导出接口。

上限检查还有一处独立规则：Python 单独给非空指定编号列表时，按最多 128 个检查，不按默认 20 检查；同时显式给 logprobs 时，先受 max_logprobs 限制，再要求数量等于列表长度。不要把这一行为解释为推荐绕过服务预算。普通前几名路径中，所选 token 记录其词表名次；指定列表则沿用枚举填 rank，列表与所选编号重合时字典合并还可能覆盖所选项的 rank，因此指定编号路径不能靠 rank 判断真实词表排名。

**HTTP 请求与响应怎么读。** 对已有 glm 服务的 `/v1/chat/completions` 发下面的顶层 JSON，Content-Type 为 application/json；这里保持默认 raw_logprobs，不改变服务启动配置。stream 设 true 时生成记录跟随各输出片段，整体拼接和结束规则沿用[流式输出页](streaming-output.md)。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用一句话解释采样。"}],
  "max_completion_tokens": 32,
  "logprobs": true,
  "top_logprobs": 2
}
```

Chat 在 choices[i].logprobs.content 中逐 token 返回 token、logprob、bytes、top_logprobs；候选列表每项也含 token、logprob、bytes。bytes 表示 UTF-8 字节，不能把 token 数、汉字数和字节数混为一谈。将请求改成 `/v1/completions` 时，用 prompt 替换 messages、max_tokens 替换输出预算，再用整数 logprobs=2；返回 choices[i].logprobs 下的 tokens、token_logprobs、top_logprobs、text_offset 四组并行列表。text_offset 是响应文本位置，不是 token ID；同样的显示字符串可能让候选映射的键合并。需要保留编号身份时，可用请求扩展 return_tokens_as_token_ids=true，把概率记录中的 token 展示成 token_id:编号，候选映射也用这一形式作为键。

**Python 读取与指定编号示例。** 下例接到已初始化的 llm；开启记录不会替调用方选择 raw/processed 模式。flat_logprobs=True 时，按位置取值仍得到字典，但容器本体不是普通 list。它的 token_ids/logprobs/ranks/decoded_tokens 四个数组用 start_indices 与 end_indices 的半开区间定位，底层重复编号不应被重复计入概率总和。

```python
from vllm import SamplingParams

params = SamplingParams(max_tokens=16, logprobs=2, flat_logprobs=True)
result = llm.generate(["请解释采样："], params)[0].outputs[0]
for token_id, records in zip(result.token_ids, result.logprobs):
    print(token_id, records[token_id].logprob)
```

指定编号只在未开启 MTP 的 llm 上使用：先用 llm.get_tokenizer().encode("A", add_special_tokens=False) 获取并检查单枚编号，再构造 `SamplingParams(max_tokens=1, logprob_token_ids=label_ids)`。省略 logprobs 让数量按列表确定；这份列表不限制输出范围。固定基线普通 HTTP 没有这个字段；rc/main 的 HTTP 扩展与校验见版本表。通过客户端额外请求体机制传扩展字段时，线上 JSON 仍是顶层字段，不能多包一层 extra_body。

### 会报什么错

Beam 的概率记录请求量为 2×beam_width，须满足生成服务实际允许的 logprobs 上限；嵌入向量 prompt 在所核 beam 入口被明确拒绝。Completion 的 stream=true 组合会报流式不支持；独立 Chat render 也拒绝 beam，见[拆分前处理入口](api-server-entry.md#模板和分词能否拆成一个独立的-cpu-服务)。遇到这些分支不能只换成同名 HTTP 路由就认定支持。

自定义处理器还要先检查启动组合。`Custom logits processors are not supported when speculative decoding is enabled.` 表示显式处理器列表与投机配置冲突；`Pooling models do not support custom logits processors.` 表示当前服务不是逐 token 生成模型。V2 校验中的 `custom logits processors` 同时检查显式列表和已安装的插件入口。模块不可导入、类路径拼错、显式目标不是批级子类也会在加载阶段失败；请求里的自定义参数则由处理器自己的 validate_params 检查。不要用“请求字段解析成功”代替“处理器执行过”。

- `temperature must be non-negative`、`top_p must be in (0, 1]`：请求参数不合法，入口直接拒绝，请求不会进调度。[C11]
- `top_k must be 0 (disable), or at least 1`、`min_p must be in [0, 1]`：同上，top-k 传 −1 会被当作关闭而接受。
- `presence_penalty must be in [-2, 2]`、`frequency_penalty must be in [-2, 2]`：例如传 2.1 或 −2.1，构造采样参数时拒绝；两端点 −2、2 均可用。
- `repetition_penalty must be greater than zero`：例如传 0 或 −1；关闭应传 1。v0.26 与固定 main 还会报 `repetition_penalty must be a finite number`，拒绝 NaN 和无穷大；基线只有正数方向的比较检查，不能把其漏检当作非有限值受支持。标准 JSON 也没有 NaN/Infinity 数值。
- `The min_p and logit_bias sampling parameters are not yet supported with speculative decoding.`：初始化后的 min_p>0.00001 或非空 logit_bias 与服务投机配置冲突。MTP 随机请求将 min_p 显式设 0；bias 删除字段、传 null 或 {} 关闭，把映射中的数改成 0 仍不算空。
- logit_bias 的 `out-of-vocab token ids`：编号小于 0 或达到模型词表大小；如 JSON 键是 "猫" 而非编号字符串，则在转整数时就失败。基线直接抛整数转换的 ValueError；v0.26/main 改为收集非法键并抛 VLLMValidationError，消息为 `logit_bias contains key(s) that cannot be converted to integer token IDs`，便于定位具体键。
- `allowed_token_ids is not None and empty!`：传了 []，关闭应省略或传 null。`allowed_token_ids contains out-of-vocab token id!`：基线按分词器长度发现越界；固定 main 改按模型词表大小检查。
- `bad_words cannot contain an empty string`：例如列表含 ""；Chat 的 null 另由请求字段类型校验拒绝。只含空白的词可能在旧版分词后触发索引错误，不应当作合法的关闭方式；固定 main 增加了 `bad_words entries must tokenize to at least one token.` 检查。分词产生越界编号还会报告模型词表范围及具体编号。
- `Too many bad words after tokenization`：固定 main 新增的禁串数量检查，默认最多 128 条，包含保留下来的空格变体；基线与 v0.26 没有这项检查。它不是旧版 GLM 的启动限制。
- `temperature must be in [0, 2]`、`temperature must be a finite number`：vLLM v0.26 新加的检查，v0.23 不报，温度大于 2 的请求在 v0.26 上会被拒绝。[C35]
- `Input length (…) exceeds model's maximum context length (…)`：提示词本身已超过长度上限，推算 max_tokens 时报出。[C17]
- `min_tokens must be greater than or equal to 0`：例如传 −1；`min_tokens must be less than or equal to max_tokens=…`：最少数大于生效的输出上限。JSON null 或非整数类型先按接口字段规则校验；不要用 null 关闭此项。
- 启动日志 `Default vLLM sampling parameters have been overridden by the model's generation_config.json`：这是警告，不是错误，说明缺省采样参数被模型的生成配置替换了；GLM 双机启动时会看到它。
- `temperature … is less than 0.01`：小正温度被抬升的警告，最终仍是随机路径；温度 0 才是 greedy。top_k 的小数值会触发整数类型检查；HTTP seed 超出有符号 64 位范围由请求字段校验拒绝。
- `--override-generation-config` 需要可解析为对象的 JSON；格式错误或给数组不等于空覆盖。配置值即使成功读入，也仍要经过采样参数的范围检查；有效 JSON 中 top_p=0 仍是非法采样值。全局 seed 的负数或过大值可在初始化 NumPy 随机状态时报范围错误。

概率记录常见错误：logprobs 或 prompt_logprobs 小于 −1 被 SamplingParams 拒绝；基线 Completion 的 `logprobs must be a positive value.` 还会拒绝 −1（实际接受 0）；Chat 要正数或 −1 的 top_logprobs 却没开 logprobs，报 `when using top_logprobs, logprobs must be set to true.`。超过服务上限会报 Requested sample/prompt logprobs … greater than max allowed；指定列表超过 128、越界或与显式 logprobs 数量不一致也会拒绝。合法 JSON 值与请求类型检查仍由各接口执行；不要把“0 不是关闭”误诊成服务没读配置。

### 开销和什么时候别开

采样的开销主要在三处：每一步把整排分数转成 fp32；top-p 要把每一行 154880 个分数排序；8 张卡把同一件事各做一遍。满载时每张卡要处理 128 行，这些都随行数线性增长。[D] 本页没有采样耗时的实测数。v0.26 与 main 的源码注释给过一组对比：昇腾的融合 top-k/top-p 算子在 k 很大、或同一批里各请求 k 不同时会慢到 5–28 ms，而排序加掩码稳定在 1 ms 左右，所以这两个版本在默认路径上改回了排序实现。[C33]

需要可复现、可比对的输出（评测、回归测试）时用 greedy：temperature 设 0 是前提，但要逐字一致还得开 [batch invariance](batch-invariance.md) 或昇腾的确定性环境变量（`LCCL_DETERMINISTIC` 等，见 vllm-ascend 的 FAQ）；[S44][S45]需要多样性时再调 temperature 和 top-p，不必三种截断同时用。罚分需要统计提示词/输出的出现标记与输出次数，并改写每行词表分数；固定 Ascend 实现还会把输出编号列表转成设备张量，MTP 则按验证位置扩展历史。中性值的批次可以跳过罚分分支，开销随历史长度、词表和处理行数变化。没有重复问题时不必开；精确复述题目、保留代码变量名或评测原始模型分布时，先使用全关对照。

logit_bias 在批次状态变化时整理指定编号和偏置，再逐步对相应分数加值，成本随受偏置条目数变化。allowed_token_ids 虽可只列几个编号，基线路径仍构造按请求和整个词表展开的布尔掩码，并对完整 logits 做屏蔽；**它不会缩小模型词表或省掉 lm_head 的全词表计算。** bad_words 先为词串分词，普通路径每步逐请求、逐禁串比较输出后缀；MTP 验证还按候选位置展开历史，词串多、串长或候选多都会增加工作。这里没有三项的 NPU 延迟实测。只需调整表达偏好时别用很窄的白名单；要严格保证格式时用结构化输出；不要让禁词与白名单、EOS、最少长度互相冲突。


v0.26 所列快照把非 reduce-sample 路径改为排序实现；reduce-sample 路径在需要 top-k 或 top-p 过滤时仍调用 NPU 算子。固定 GLM 镜像的 A2/A3 分派也保留 NPU 路径，因此不能把这次变化说成所有版本、所有分支都已统一改用排序。

最少长度在门槛前逐步更新指定编号的屏蔽，达到门槛后退出这项处理；额外成本还包括本来可以结束却被要求继续的前向步和 KV 占用。任务允许简短回答时保持 0；提高它不能替代提示词中的内容要求。与白名单、禁词等叠加时先检查是否还留有可采编号。

温度缩放和最小相对概率截断仍处理整行词表，缩小候选不减少前向与词表投影。每条随机请求指定种子，会额外维护独立发生器；所列普通指数噪声路径逐条填充有种子的行，全局无种子行则可批量生成随机数。生成配置在初始化时读取并用于形成默认字典，不是在每个 decode 步重新读文件。需要对照实验时显式记录最终参数与两层种子；没有具体复现目标时，不必把每条请求都设成相同种子。本页没有这些选择的 NPU 耗时实测。

概率记录的代价包括整词表对数归一化、取值/排序、设备到 CPU 传输、文字转换和响应存储。全词表请求会把每步少量记录变成词表规模，长输出或长提示词会明显增加内存占用；服务 −1 不应当作日常开启值。扁平容器减少 Python 小对象数量，不能消除这些设备计算与传输。仅排查某两个标签时可在未开 MTP 的 Python 实例取指定编号；仅要输出文本时保留 None/false。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**正文 GLM 双机绑定算例固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，与四版社区分支分别核对。**（历史 `v0.30.0rc2` / `baa023ad` / `84030bbe` 对照细节亦在下文相应子表保留，不再混入主基线结论。）

**Ascend 采样核心与上游主线演进（四版本总览）：**

| 核对项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| Ascend 采样模块位置 | `vllm_ascend/sample/sampler.py`（MRV1）[C32] | 同 `v0.23.0` | 同时提供 MRV1 `sample/sampler.py#L45-L115`（`AscendSampler` / `AscendTopKTopPSampler`）与 MRV2 `worker/v2/sample/` | 移除旧 MRV1 `vllm_ascend/sample/`，全面收敛至 MRV2 `worker/v2/sample/`（`apply_top_k_top_p.py`、`gumbel.py`、`penalties.py` 等）与 `_310p/worker/v2/sample/` |
| A2 上 top-k / top-p 默认路径 | 融合算子 `npu_top_k_top_p`[C32] | 排序加掩码，按同一次原始 softmax 决定 k/p 截断 | 排序加掩码；开启 `VLLM_BATCH_INVARIANT` 回退上游实现（`sample/sampler.py#L92-L115`） | MRV2 `worker/v2/sample/apply_top_k_top_p.py#L8-L38` 分派 NPU/PyTorch 实现，Gumbel 采样在 `gumbel.py#L27-L260` |
| `enable_async_exponential` / `enable_reduce_sample` | 两者均有，默认关 | 删除 `enable_async_exponential`；保留 `enable_reduce_sample` 默认关 | 两者均已移除 | 延续已移除状态 |
| 上游温度与采样器主路径 | 只要求非负；`Sampler.sample` | 有限且在 `[0, 2]` | 有限且在 `[0, 2]`；`Sampler.sample`（`ced6857a:sampler.py#L244-L299`）含 `thinking_token_budget` | 延续 `[0, 2]` 与 `thinking_token_budget`（`ba15685a:sampler.py#L308-L355`、`sampling_params.py#L660-L685`） |

`v0.30.0` 已删除 `enable_reduce_sample` 及其本地候选缩减/all_gather 分支，旧开关示例不能当作 `v0.30.0` / `main` 可用配置；`main` 进一步移除旧 `vllm_ascend/sample/` 并统一走 Model Runner V2 采样栈（详情另见[采样进阶](sampling-advanced.md#昇腾-npu-采样快慢路径剖析v0300)）。升级会改变采样后端及允许的参数范围，不能只凭相同的 k/p 值推断候选集合相同；前文 `k=2, p=0.7` 的例子说明了概率归一化时点的影响。GLM 固定提交 `db701c1f` 与 `v0.23.0` 维护分支在融合算子和提前抽噪声开关上一致。[C23]

**Beam search 与生成式评分四版对照**（下表 `v0.30.0` 对应配套上游 `ced6857a`，历史过渡快照 `84030bbe` 差异一并注明）：

| Beam search 核对项 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a` / 旧快照 `84030bbe`） |
|---|---|---|---|---|
| HTTP 宽度与返回 | n→beam_width；Completion 拒绝流式，Chat 正常结果最后才交出 | 相同 | 相同 | 相同 |
| 离线文法参数与消费者 | 无所述 structured_outputs 路径 | 新增逐 beam 文法重建和候选过滤 | 保留 | 保留；不扩展为 HTTP beam 支持 |
| 候选数量不足的在线筛选 | 按固定候选数量映射父 beam，没有后续版的不足保护 | 改为记录每个候选的父 beam，并处理候选少于宽度或耗尽 | 保留 | 保留 |
| 显式 `skip_special_tokens` 与评分长度保护 | 无 | 无 | 新增 `skip_special_tokens` 默认 `true`、显式收束 aborted beam 且评分长度至少取 1 | 旧快照 `84030bbe` 不含该项；升级至 `v0.30.0` / `main` 时须核对应分支实现 |

所列差异属于上游 beam 实现；GLM 教程没有启用 beam，设备后端与投机配置的组合仍须核实际能力，不把普通生成成功推成任意搜索配置可用。

| 生成式评分 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a`） |
|---|---|---|---|---|
| 接口与缺省 | `/generative_scoring`；`apply_softmax=true`、`item_first=false`、`add_special_tokens=true` | 相同 | 相同 | 相同 |
| 每项执行与返回 | 分别拼接编号，留 1 输出位置；返回首标签分数 | 相同 | 相同 | 相同 |
| 显式准入检查 | 此服务方法没有按 items 数预检查 | 相同 | 按 items 数调用引擎准入检查 | 同 `v0.30.0` |
| `priority` 字段范围 | int，字段未另加上下界 | 相同 | $-2^{63}$ 至 $2^{63}-1$ | 同 `v0.30.0` |

默认与采样参数另按 vLLM v0.23（0fc695fc）、v0.26 分支（568afb3a，本库 2026-10-30 固定快照）、rc2 配套（ced6857a）和固定 main（84030bbe）逐项核对。下面的四版上游表共用这组钉点；main 行表示该上游快照，不据此声明它与 Ascend main 有精确配套关系。Ascend 使用上游请求参数与配置，不增加同名的 Ascend 专属入口。

**自定义改分规则的接入边界**如下。表中的普通路径指生成模型、Model Runner V1、未开投机；设备端运算还须由处理器自身适配。Ascend 的 V1 批次构造将配置交给上游处理器构建器，采样器也继承上游两处调用，不能只看上游接口存在而漏掉实际消费者。

| 核对项 | v0.23 / GLM 基线 | v0.26 分支 | rc2 | 固定 main |
|---|---|---|---|---|
| 普通 V1 装入与缺省 | 显式列表默认 None；普通路径另发现已安装插件，随后加载显式类 | 相同 | 相同 | 相同 |
| 请求自定义参数 | HTTP vllm_xargs 转 extra_args；离线直接传 extra_args，语义由类的 validate_params 检查 | 相同 | 相同；自定义 ValueError 包装为 VLLMValidationError | 同 rc2 |
| 批次成员与行号变化 | 按 BatchUpdate 更新；None 时仍调用 update_state，输出历史引用继续变化 | 相同 | 相同 | 相同 |
| 两类 apply 的位置 | 改最高分组在罚分前；保留最高分组在温度后，全 greedy 跳过后一组 | 相同 | 相同 | 相同 |
| 显式处理器列表与投机同开 | 非空列表直接拒绝，包含 MTP | 相同 | 相同 | 相同 |
| 只安装插件、投机且显式列表为空 | worker 构建提前返回，仅保留最少长度处理器，不装自定义插件 | 相同 | 相同 | 相同 |
| A2/A3 选择 V2 时 | 校验拒绝显式处理器或已安装插件 | 相同 | 保留该拒绝 | 保留该拒绝；不推断其他硬件路径 |

参数校验与 worker 装入是两条路径。即使投机分支未装插件，请求校验仍可能加载它并执行 validate_params；看到这个回调不证明采样时调用了 apply。GLM 原配方继续使用 MTP，因此前面的六词自定义示例是普通采样教学，不能直接作为原部署追加参数。需要验证自己的实现时，在满足上表条件的独立普通采样配置中，对同一输入分别启用和关闭规则，检查按请求更新、全 greedy 与混合批次、请求退出及行号交换后的实际结果；没有设备运行证据时，只能确认接线和条件。

| 核对项 | v0.23 / GLM 基线 | v0.26 分支 | rc2 | 固定 main |
|---|---|---|---|---|
| temperature / top_p / top_k / min_p / 请求 seed | 都存在，对象默认 1 / 1 / 0 / 0 / None | 相同 | 相同 | 相同 |
| 温度检查 | 非负；没有有限性和上限检查 | 有限且在 [0,2] | 同 v0.26 | 同 v0.26 |
| 小正温度与 greedy | 0<T<0.01 抬至 0.01；0 将三种截断归零或关闭 | 相同 | 相同 | 相同 |
| 三种截断范围 | top-p∈(0,1]；top-k 为整数≥−1；min-p∈[0,1] | 相同 | 相同，更多使用统一校验异常 | 同 rc2 |
| 投机兼容检查 | 初始化后 min_p>0.00001 或非空 bias 拒绝 | 相同 | 相同 | 相同 |
| 请求种子 | HTTP 有符号 int64；None/−1 不建独立流，0 有效 | 相同 | 相同 | 相同 |
| 启动 seed | 存在，默认 0 | 相同 | 相同 | 相同 |
| generation_config / override_generation_config | 都存在；auto / {}；按键覆盖后提取六项默认 | 相同 | 相同 | 相同 |
| BatchChat 的温度 / top-p / min-p 字段默认 | 0.7 / 1.0 / 0.0 | 全部 None | 全部 None | 全部 None |

普通 HTTP 前四项先合并服务默认，seed 直接按请求传递；它不继承全局 seed，也不重置其他请求的随机流。固定教程显式把启动 seed 改为 1024，与请求种子是不同入口。vllm 生成配置模式仍接受覆盖，但不在六项名单里的 seed 不会变成采样默认。top-k 的 0/−1 都关闭；参数先校验再归零，greedy 不能绕过非法值，基线漏检的 NaN/Infinity 也不是受支持配置，标准 JSON 没有这两种值。随机 MTP 示例使用 min_p=0。

BatchChat 的数值默认会在转成单请求时保留，None 会排除，因此旧版批量 Chat 省略参数仍会传数值，不能套普通 Chat 的继承语义。四版都没有仅凭 seed 承诺不同硬件、不同调度或不同版本输出逐字相同。

三种 penalty 沿用这四个上游钉点，Ascend 罚分算子另按前表的四个执行快照核对。下表比较参数语义与源码分支，不代表在本机跑过四版 GLM。

| 核对项 | v0.23 / GLM 基线 | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| 三项是否存在；对象默认值 | 都有；SamplingParams 为 0 / 0 / 1 | 相同 | 相同 | 相同 |
| presence / frequency 范围与历史 | [−2, 2]；只看本次输出 | 相同 | 相同 | 相同 |
| repetition 合法值检查 | 只拒绝 ≤0；缺少有限性检查 | 先检查有限，再要求 >0 | 同 v0.26 | 同 v0.26 |
| Ascend 罚分算子 | 提示词或输出的出现标记控制 repetition；之后扣 frequency、presence | 相同 | 相同 | 相同 |
| 普通 Chat / Completions 的 repetition 缺省 | 字段 None，合并服务默认，再退到 1 | 相同 | 相同 | 相同 |
| 批量 Chat 的 repetition 字段默认 | 1.0 | None | None | None |

关闭值和三项叠加的数学顺序不变；presence/frequency 的负值仍鼓励重复，提示词不计数。repetition 应使用有限正数，升级会拒绝旧检查遗漏的非有限值。普通入口省略与显式传 1 的语义不同。批量 Chat 转成单条 Chat 时，只排除 None，保留数值默认：基线省略 repetition 仍会传 1.0；后三版的 None 被排除后，才由普通入口读取服务默认。显式给数值可消除这里的默认差异，旧三版转换见来源 75–77，rc2 另有补证。

以下三项使用相同上游钉点，不能把 main 的新检查反推成 GLM 基线行为：

| 核对项 | v0.23 | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| 三项存在与 SamplingParams 默认 | 都存在；bias/allowed 为 None，bad_words 的 None 初始化成 [] | 相同 | 相同 | 相同 |
| logit_bias：HTTP/from_optional 截断及投机限制 | 键转整数、截到 [−100, 100]；非空映射与投机解码不兼容 | 相同 | 相同；投机不兼容改用 VLLMValidationError | 同 rc2 |
| logit_bias：无法转整数的键 | int 转换直接抛 ValueError | 收集非法键，以 VLLMValidationError 报告具体键 | 同 v0.26 | 同 v0.26 |
| allowed_token_ids：空列表与编号检查 | [] 拒绝；有 tokenizer 时按 len(tokenizer) 校验；无 tokenizer 则跳过编号边界检查 | 相同 | [] 仍拒绝；改按模型词表大小校验，不依赖 tokenizer | 同 rc2 |
| bad_words：Chat / Completions | Chat 有字段并传递；Completions 没有接入 | 两入口都有并传递 | 两入口都有并传递 | 两入口都有并传递 |
| bad_words：分词变体与匹配 | 去开头空白，尝试无空格/前缀空格；按输出后缀屏蔽最后 token | 相同 | 常规采样路径相同 | 同 rc2 |
| bad_words：空分词结果、数量限制 | 未专门检查空 token 串；没有禁串条数上限校验 | 相同 | 拒绝无空格形式的空 token 串；空格变体为空则跳过；分词后条数默认 ≤128，由 VLLM_MAX_NUM_BAD_WORDS 控制 | 同 rc2 |

rc2 与固定 main 另有 GPU model runner V2 的 BadWordsState 路径，按 VLLM_MAX_BAD_WORDS_TOTAL_TOKENS（默认 1024）限制每请求分词后的总 token 数，超限报 `Too many total bad word tokens`；这是该 GPU 路径的容量检查，不能套到固定 Ascend MTP 路径。固定 GLM 执行侧普通采样继承上游屏蔽处理，MTP 在 Ascend 自己的验证函数中重复请求掩码、展开禁词历史；没有为这三项增加 Ascend 专属参数。上表接口范围是普通单请求接口，批量 Chat 的字段集不能仅由此表推断。

| 最少长度核对项 | v0.23 | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| min_tokens 类型、默认和范围 | 整数，默认 0；非负且不大于非空 max_tokens | 相同 | 相同；参数错误统一用 VLLMValidationError | 同 rc2 |
| 采样前屏蔽 EOS / 停止编号，门槛后解除 | 有；greedy 同样生效 | 相同 | 通常相同；结构化输出全空时恢复原有限停止分数 | 同 rc2 |
| CPU 引擎的 min_tokens 保护位置 | 先检查最少数，再查 EOS、停止编号、长度和重复 | 相同 | EOS、停止编号、长度先检查；最少数只挡后面的重复检测，EOS 的最少长度依靠采样屏蔽 | 同 rc2 |
| 前端字符串只在超过最少数后查新增部分 | 有 | 相同 | 相同 | 相同 |

固定 Ascend GLM 的候选验证调用上游 MinTokensLogitsProcessor；四版上游判停次序的差异不能仅凭 Ascend 使用同一参数名而抹平。rc2/main 的恢复例外允许已完成的结构在最少长度前结束，不能把 min_tokens 当作所有组合下的硬下限。设备实际耗时与生成文本质量仍需部署实测。

概率记录按同一组四个固定上游快照逐项对照，v0.26 指所列 rc 分支，rc2 指 v0.30.0rc2 配套快照。

| 项目 | v0.23 | v0.26 | rc2 | main |
|---|---|---|---|---|
| Python 数量 | None 默认；0/正数/−1；上限 20，服务 −1 放到词表大小 | 相同 | 相同 | 相同 |
| Chat 数量 | bool 默认 false；top_logprobs 默认 0，支持 −1；正数/−1 需 true | 相同 | 相同 | 相同 |
| Completion 数量 | 默认 null；0/正数，拒绝 −1 | 相同 | 协议允许 −1，但当前返回器候选映射仍为空，不能视为完整词表导出可用 | 同 rc2 |
| 指定编号 | Python 有；普通 Chat/Completion 未声明 | HTTP 新增，最多 128；Chat 需 logprobs=true，Completion 需 logprobs 非 null（0 可用）；非空列表优先于前几名数量 | 相同 | 相同 |
| 扁平容器 | Python 默认 false；HTTP 未暴露 | 相同 | 相同 | 相同 |
| 四模式与上限 | 默认 raw_logprobs、20；上限字段未声明下界检查 | 默认相同；新增上限 ≥−1 的检查 | 同 v0.26 | 同 v0.26 |

Ascend 的普通采样器在 GLM db701c1f、社区维护 2c59ff10、v0.26 的 2ed6cbba、rc2 的 7d825229、main 的 baa023ad 均有处理后分数与对数概率分支，不能只凭旧 TODO 注释断言四模式均不支持。本页固定部署关闭 reduce-sample，按普通完整词表分支解释；启用候选缩减后的索引与模式组合不在这个保证范围。

后三版的 HTTP 有非空指定列表时，转换为 SamplingParams 会把 logprobs 置 None，按列表取值，不能套用 Python“显式两项相等”的约束；两种 HTTP 都拒绝指定编号配 beam search，Completion 还拒绝同时 echo=true、max_tokens=0 的无生成组合。

上述五个 Ascend 快照的 MTP 路径都复用上游候选记录拼接，未贯通指定编号列表；上游四版的普通 forward 又未把 logprobs_mode_override 继续传入 sample，处理后模式的额外 token 记录存在边界。这里保留源码限制，不宣称所有模式已在 NPU 实跑通过。提示词在四模式下的不同处理，统一见 [prefill 版本差异](prefill.md#版本差异)。

思考预算要同时检查请求入口与实际执行状态，不能只看字段存在：

| 思考预算核对项 | v0.23 / 旧 GLM | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| Chat / Completion / SamplingParams 字段 | 都有；None 默认，−1 转为 None，非负整数有效 | 相同 | 相同 | 相同 |
| 上游输入检查 | 需启用推理边界配置；拒绝 GPU model runner V2 使用预算 | 相同 | 保留推理配置守卫；GPU V2 已有独立预算状态和采样消费 | 同 rc2 |
| Ascend 输入批次的预算状态 | 固定为 None；请求字段不代表执行生效 | 相同 | 按推理配置建立并随输入批次更新 | 相同 |
| Ascend 普通采样 / MTP 目标验证 | 无有效预算状态可消费 | 相同 | 两条路径均消费预算状态 | 相同 |

rc2/main 的状态会结合提示词、真实输出及本次草稿位置决定何时推进结束串。强制分数改写发生在其他筛选和罚分之后，因此配置开始/结束边界、给答案留足总输出空间、避免约束冲突都仍是必要条件。GPU V2 与 Ascend V1 各有实际接入路径，不能把旧版的 GPU V2 拒绝条件套回新版，也不能把新版预算效果套回旧 GLM 镜像。

### 源码位置

Beam 的基线字段、HTTP 转换、在线循环、评分及离线解码见来源 305–310，Completion 拒绝流式与 Chat 返回分派见 311–312。v0.26 对应链及离线文法重建/候选过滤见 313–322；rc2 参数对象复用来源 178，转换、abort、评分保护及返回见 323–331；固定 main 对照见 332–341，官方离线示例见 342。两个概率和长度示意按所列规则演算；未作为设备性能实测。

生成式评分的四版请求字段、逐项生成、编号拼接、归一化与路由依次见来源 279–283、284–288、289–293、294–298；生成任务的路由注册见 299–302。固定官方指南见 303，与 pooling /score 的区别见 304。logprobs_mode 和 MTP 指定编号的限制复用本页普通采样器与候选记录来源，不因评分路由存在而扩大模型支持范围。

自定义处理器的加载和拒绝条件见来源248–252，批次更新接口、分组与适配器见253–256；实际Ascend接入见257–258、272及既有237、240，采样两处调用复用4、82、177、228。V2检查与Ascend硬件条件见259–271、273。官方完整接入示例、额外参数和设计说明见274–276；实际CLI拼写见277，Chat转交参数见278与85，Completion及其余版本复用86、89–90、130–131、188、198。小例子的六词分数和行号交换是对这些接口的手工演示，不是硬件实测。

四版表的 rc2 补证按主张分组：默认、范围、生成配置与 HTTP 传递见 181–189；罚分及批量 Chat 默认见 189–193；偏置、允许编号、禁词与 GPU V2 容量见 194–200；最少长度、结构化输出恢复及判停顺序见 201–204；概率记录的输入和返回边界见 205–213。Ascend rc2 的普通排序实现见 214，v0.26/main 的完整排序与原概率口径见 245–246。

思考预算字段与输入守卫见 215–223（Chat 的传递另复用 197），推理配置和完整状态机见 224–225，批次刷新与两种上游采样消费者见 226–232；Ascend 的旧空状态、新版创建与 MTP 消费见 233–242，main 的实际创建补见 247。固定 GLM 拒绝后的重抽由 243–244 的封装与核函数共同支持。来源 94 延伸到 tokenize 响应，115 延伸到结构化输出和投机位置处理；编号沿用原来源，不把范围扩展算成新项。

阅读顺序：先看上游 `v1/sample/sampler.py` 类注释，它按顺序列出改分数、greedy、temperature、min_p、top-k/top-p、抽取这几步，`sample()` 里是 greedy 与随机两路的合并；[C4] 再看 `v1/sample/ops/topk_topp_sampler.py` 的截断和指数噪声抽取；[C5] 然后是昇腾的 `sample/sampler.py`，看 A2 上换了哪些实现；[C22] 最后看昇腾 runner 的 `_sample` 怎样在普通采样和候选验证之间分流。[C26] 候选验证在昇腾的 `sample/rejection_sampler.py` 与 `ops/triton/reject_sample.py`，greedy 比较与随机接受分别在两处。[C27][C29] 停止判断在上游 `v1/core/sched/utils.py` 的 `check_stop`。[C18]

三种 penalty 的阅读顺序与本页结论对应如下：

- **默认与校验**：来源 9 是基线字段默认；47 是合法范围；49 是 from_optional 的 None 归一化。来源 55–58 分别给 v0.26、固定 main 的字段与校验，有限性检查的差异在这里。
- **入口与覆盖**：来源 50–54 是普通 Chat/Completions 的字段、默认合并及参数传递，配合来源 16；来源 71–74 是 v0.26 与 main 的 repetition 默认合并分支。来源 15 的 available_params 明确生成配置只收 repetition、不收 presence/frequency。来源 65–67 是三版 BatchChat 字段默认；68–69 是离线 LLM 的默认读取与 generate 缺省分支。JSON 中的 glm 服务名来自来源 42。
- **怎么算与在哪里算**：来源 8 是上游统计与调用顺序；48 是固定 Ascend 算子的完整计算，先以提示词/输出的并集做正负分缩放，再扣次数项、出现项。[C48] 来源 59 是普通采样的中性值跳过及无 Triton 回退，60–61 是 MTP 的参数扩展和逐位置候选历史；62–64 用于核对三个 Ascend 社区快照的同一算法；70 是输出列表转设备张量。罚分数值例子由该算法手算，不是设备实测。

偏置、允许编号、禁词的证据索引：

- **类型与入口**：来源 78 是基线字段和 from_optional 的键转换/偏置截断；84–85 是 Chat 的扩展字段与实际传递；86 是基线 Completions 的字段与转换，缺少 bad_words；89–90 是新版 Completions 的新增字段和传递，100–103 是 v0.26/main Chat 的 bad_words 字段与传递。来源 94 是示例使用的 tokenize 请求/响应；离线入口仍用来源 68–69。
- **校验与分词**：来源 79 对应空字符串、两种前缀分词、有效编号；80 对应 verify、模型/分词器边界和投机互斥；92 证明引擎实际调用 verify 并在有 tokenizer 时转换禁词。来源 87–88 对照新版校验；97–98 对照新版字段与 from_optional；99 是基线 None 转 [] 的初始化。main 的条数/总 token 数环境默认与 GPU V2 检查见 95–96。
- **生效顺序与成本**：来源 81 是指定分数加偏置；82 是普通采样的允许掩码、禁词、偏置与 penalty 调用；83 的 suffix 匹配只读取输出历史，并包含 draft 版本；93 是允许编号构造成整词表掩码。来源 59 的 AscendSampler 继承上游，91 是固定 Ascend 自己的 MTP 验证处理，61 与 82 对应额外 token 的历史拼接。六词偏置与屏蔽例子是按这些操作手算，没有新增设备实测。

最少长度证据：108、116 是基线与 main 的范围检查；109 是即使忽略 EOS 仍保留最少长度屏蔽集合的配置更新；110、114–115 是三版 logits processor 的门槛与候选行处理；111 是前端字符串的最少长度保护；18、112–113 是三版引擎判停顺序。基线接口字段与传递见既有 50–54、86，GLM 候选验证见 91；额外 token 的保守屏蔽由 117–118 的上游与 Ascend bonus 采样入口、82 的普通处理及 110 的状态更新共同确定。两枚普通输出后第 3 次才允许 EOS 的小例子按普通逐 token 采样前的输出计数推演，不是模型实测。

默认与采样的证据索引：

- **字段与初始化**：9、123–125、136–137 给出三版对象默认、小正温度抬升、seed=−1、先校验后 greedy 归零及温度上限差异；78 的 from_optional 显示哪些 None 被归一化；134 是 top-k 按词表大小限制。80、87–88 的投机检查使用初始化后的 min_p 与 0.00001 比较。
- **HTTP 和离线入口**：50、86、140–141 是普通请求字段及 seed 范围，16、85、89–90、130–131 是四项默认合并及 seed 直接传递；65–67、75–77 给 BatchChat 的字段与转换。68–69 是离线默认读取与 generate 缺省分支，显式构造对象不再执行 HTTP 合并。
- **生成配置**：119–120 是模型来源、revision 与找不到文件后的回退；15、121–122 是三版按键覆盖、六项名单、过滤 None 及最大输出数重命名；127、129、142–143 是启动字段和 CLI 接入。启动 vllm 只跳过采样默认，特殊编号读取不能据此省略。
- **两层种子**：13、128、138–139 是启动 seed 声明与 CLI；126 是全局初始化，135 是 NumPy 传统随机接口的 32 位种子约束；31 是固定 Ascend worker 调用。132–133 串起固定 Ascend 状态更新调用父类，再为 RANDOM_SEED 创建设备发生器的路径；6 与 23 是逐请求噪声填充。固定教程的两端 1024 仍以 42 为准，复现边界用 44–45。覆盖表是按这些字典合并分支推演，不是设备输出实验。

数值出处：154880、19360、每步 1 行或 4 行、满载 128 行约 37.8 MiB、验证行 fp32 约 1.77 MiB、133120 的长度上限，都来自主线底稿 03 §A5 与 02 §7.3 的形状推导；[D] temperature 1.0、top-p 0.95 和三个结束编号来自固定 revision 690b7052 的生成配置；[S1] `--seed 1024` 来自官方教程固定提交的两台机器启动命令；[S42] greedy 退化与 top-p 的出处是 nucleus sampling 的原论文。[S2] 前几节的 6 个词、分数、温度、截断参数、随机数 u 和 q 都是为演示编的。

概率记录的证据索引：144–147 给字段、上限、四模式与 CLI；148–150 给普通/扁平容器、累计值、指定编号取值与 rank 组装。151–154 给基线两种 HTTP 的校验和返回结构；155–160 给 rc 的指定列表转换与 main Completion 的 −1 协议/返回器边界。161–165、172–173 给三版上游及四个 Ascend 快照的候选记录拼接；166–169 给 Ascend 普通采样的处理后分支，170–171 对照新版参数校验，174–175 对照模式默认和上限下界。原有来源 4 对应普通采样的 greedy/随机模式分支，105 对应四模式定义。正文 ln/exp 示例沿用六词概率，是数学演示，不是设备实测。

本页没有本部署真实负载下的 MTP 接受率或 Ascend 采样耗时实测；前面的概率与显存数字分别是机制演算和形状计算，不能当作性能测量。

并列示例采用固定上游 0fc695fc 的 PyTorch 排序掩码路径：先屏蔽严格小于第 k 大分数的项，再做 top-p。Ascend 融合后端或其他版本的并列处理须按各自实现确认，不能直接套用这个示例。[C5]

固定上游普通采样在 all_greedy 时提前返回；否则继续 temperature、保持最高分选择不变的处理器及 top-k/top-p，混合批次最后按逐行 temperature 选择 greedy 或随机结果。这个批次分支解释了为何相同参数在代码中可能经过不同步骤，不代替 Ascend 设备上的执行或数值验证。[C4]

- 来源 104：vllm@0fc695fc，vllm/v1/sample/ops/topk_topp_sampler.py，L394–L416。
- 来源 105：vllm@0fc695fc，vllm/config/model.py，L229–L235。
- 来源 106：vllm-ascend@db701c1f，vllm_ascend/sample/sampler.py，L286–L302。
- 来源 107：vllm-ascend@2ed6cbba，vllm_ascend/sample/sampler.py，L258–L265。
