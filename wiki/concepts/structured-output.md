---
id: structured-output
title: 结构化输出：文法怎样在采样前屏蔽不合法的 token
type: feature
legacyAnchors:
  放到-glm-双机一个带-json-schema-的请求走一步: 投机验证怎样推进、回滚并应用文法
  复杂异构实战对照glm-双机下-json-schema-的五步走法与边界: 投机验证怎样推进、回滚并应用文法
summary: >-
  结构化输出在打分和采样之间加一道关卡：文法状态算出下一步允许的 token，其余候选的 logits 改成 −∞ 再采样。先看这个过程，再沿 GLM 双机看
  bitmask 在哪个进程、哪一步算出，怎样作用到 logits，以及它和 MTP 草稿、思考阶段的配合。
aliases:
  - 结构化输出
  - Structured Output
  - Guided Decoding
  - 引导解码
  - 受限解码
  - 约束解码
  - 文法掩码
  - guided_json
  - structured_outputs
  - StructuredOutputManager
  - grammar bitmask
  - 文法位图
  - apply_grammar_bitmask
  - xgrammar
  - FSM
  - PDA
  - 有限状态机
  - 下推自动机
  - EBNF
  - Lark
  - guidance
  - Outlines
  - LM-Format-Enforcer
  - JSON schema
  - response_format
  - structured_outputs.json
  - structured_outputs.json_object
  - structured_outputs.choice
  - structured_outputs.regex
  - structured_outputs.grammar
  - structured_outputs.structural_tag
  - structured_outputs.disable_any_whitespace
  - structured_outputs.disable_additional_properties
  - structured_outputs.whitespace_pattern
  - structured_outputs_config
  - structured-outputs-config
  - structured_outputs_config.backend
  - structured_outputs_config.disable_any_whitespace
  - structured_outputs_config.disable_additional_properties
  - structured_outputs_config.enable_in_reasoning
  - disable_any_whitespace
  - disable_additional_properties
  - whitespace_pattern
  - enable_in_reasoning
  - VLLM_XGRAMMAR_CACHE_MB
  - structural_tag
  - LegacyStructuralTag
  - LegacyStructuralTag.begin
  - LegacyStructuralTag.end
  - LegacyStructuralTag.structural_tag_schema
  - structural_tag_schema
  - structures.begin
  - structures.end
  - structures.schema
  - 结构化输出参数
  - tools.function.strict
  - tools[].function.strict
  - VLLM_ENFORCE_STRICT_TOOL_CALLING
  - 严格工具调用
chapters:
  - '17'
order: 60
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L39-L78'
  - 'vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L115-L184'
  - 'vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L186-L300'
  - 'vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L302-L370'
  - 'vllm@0fc695fc:vllm/v1/structured_output/request.py#L42-L98'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L36-L125'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L148-L195'
  - 'vllm@0fc695fc:vllm/v1/structured_output/utils.py#L44-L135'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L505-L596'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L35'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L957-L1001'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1305-L1327'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1462-L1475'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1745-L1795'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2205-L2210'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L842-L972'
  - 'vllm@0fc695fc:vllm/config/structured_outputs.py#L12-L41'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L579-L612'
  - 'vllm@0fc695fc:vllm/tool_parsers/abstract_tool_parser.py#L115-L150'
  - 'vllm@0fc695fc:vllm/reasoning/__init__.py#L55-L58'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L319-L327'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2427'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L19-L68'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L44-L52
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L76-L134
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2449-L2455'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2351-L2357'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_structured_output.py#L114-L286
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2753-L2759'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_structured_output.py#L134-L160
  - >-
    vllm-ascend@baa023ad:vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py#L27-L86
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/docs/source/user_guide/feature_guide/structured_output.md
  - 'vllm@0fc695fc:vllm/envs.py#L1529-L1529'
  - 'vllm@568afb3a:vllm/v1/structured_output/__init__.py#L60-L236'
  - 'vllm@84030bbe:vllm/v1/structured_output/__init__.py#L60-L243'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L38
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L681'
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/README.md
  - >-
    raw:sha256-d98e44a84b74619e7528dfa877d43e7035f721e1de41819a42cfc108da4c238d.md#L1-L2061
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/structured_output/__init__.py#L302-L318
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/structured_outputs.py#L41-L42
  - 'vllm@0fc695fc:vllm/sampling_params.py#L71-L111'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L117-L231'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L106-L118'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L281-L311'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L264-L356'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_guidance.py#L35-L45'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_guidance.py#L87-L121'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_guidance.py#L219-L293'
  - 'vllm@0fc695fc:vllm/v1/structured_output/request.py#L74-L98'
  - 'vllm@0fc695fc:vllm/config/structured_outputs.py#L58-L74'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L607-L611'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1490-L1493'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2171-L2178'
  - 'vllm@0fc695fc:vllm/v1/structured_output/backend_outlines.py#L68-L85'
  - >-
    vllm@0fc695fc:vllm/v1/structured_output/backend_lm_format_enforcer.py#L100-L135
  - 'vllm@568afb3a:vllm/sampling_params.py#L72-L113'
  - 'vllm@84030bbe:vllm/sampling_params.py#L88-L133'
  - 'vllm@568afb3a:vllm/sampling_params.py#L906-L1065'
  - 'vllm@84030bbe:vllm/sampling_params.py#L1074-L1251'
  - 'vllm@568afb3a:vllm/config/structured_outputs.py#L12-L74'
  - 'vllm@84030bbe:vllm/config/structured_outputs.py#L12-L74'
  - 'vllm@568afb3a:vllm/entrypoints/openai/engine/protocol.py#L117-L213'
  - 'vllm@84030bbe:vllm/entrypoints/generate/base/protocol.py#L91-L170'
  - 'vllm@568afb3a:vllm/v1/structured_output/request.py#L86-L107'
  - 'vllm@84030bbe:vllm/v1/structured_output/request.py#L82-L103'
  - 'vllm@568afb3a:vllm/v1/structured_output/backend_xgrammar.py#L36-L121'
  - 'vllm@84030bbe:vllm/v1/structured_output/backend_xgrammar.py#L37-L125'
  - 'vllm@568afb3a:vllm/v1/structured_output/backend_guidance.py#L36-L121'
  - 'vllm@84030bbe:vllm/v1/structured_output/backend_guidance.py#L37-L123'
  - 'vllm@568afb3a:vllm/v1/structured_output/backend_guidance.py#L224-L298'
  - 'vllm@84030bbe:vllm/v1/structured_output/backend_guidance.py#L228-L302'
  - 'vllm@568afb3a:vllm/envs.py#L1534-L1534'
  - 'vllm@84030bbe:vllm/envs.py#L1650-L1650'
  - 'vllm@0fc695fc:requirements/common.txt#L28-L28'
  - >-
    https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/structural_tag.py#L27-L39
  - >-
    https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/structural_tag.py#L154-L185
  - >-
    https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/structural_tag.py#L493-L502
  - 'vllm@568afb3a:vllm/v1/structured_output/backend_outlines.py#L72-L88'
  - 'vllm@84030bbe:vllm/v1/structured_output/backend_outlines.py#L76-L92'
  - >-
    vllm@568afb3a:vllm/v1/structured_output/backend_lm_format_enforcer.py#L104-L139
  - >-
    vllm@84030bbe:vllm/v1/structured_output/backend_lm_format_enforcer.py#L108-L143
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L267-L286'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L328-L331'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L256-L275'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L260-L279'
  - >-
    https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/compiler.py#L144-L171
  - 'vllm@ced6857a:vllm/v1/structured_output/__init__.py#L220-L312'
  - 'vllm@ced6857a:vllm/v1/structured_output/__init__.py#L382-L427'
  - 'vllm@ced6857a:vllm/sampling_params.py#L88-L158'
  - 'vllm@ced6857a:vllm/sampling_params.py#L1074-L1251'
  - 'vllm@ced6857a:vllm/config/structured_outputs.py#L12-L74'
  - 'vllm@ced6857a:vllm/entrypoints/generate/base/protocol.py#L91-L166'
  - 'vllm@ced6857a:vllm/entrypoints/generate/base/protocol.py#L169-L238'
  - 'vllm@84030bbe:vllm/entrypoints/generate/base/protocol.py#L169-L238'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L665-L670'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L766-L795'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L870-L910'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L427-L492'
  - 'vllm@ced6857a:vllm/v1/structured_output/request.py#L76-L97'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_xgrammar.py#L37-L137'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_xgrammar.py#L329-L428'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_guidance.py#L37-L139'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_guidance.py#L228-L296'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_outlines.py#L74-L101'
  - 'vllm@ced6857a:vllm/v1/structured_output/backend_lm_format_enforcer.py#L102-L146'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L260-L279'
  - 'vllm@ced6857a:vllm/envs.py#L1619-L1621'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L659-L663'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L1734-L1736'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2585-L2592'
  - 'vllm@ced6857a:vllm/v1/structured_output/__init__.py#L39-L218'
  - 'vllm@ced6857a:vllm/v1/structured_output/__init__.py#L314-L374'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2803-L2810'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L31'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_structured_output.py#L20-L163'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py#L27-L127'
  - 'vllm@0fc695fc:examples/features/structured_outputs/README.md#L1-L58'
  - 'vllm@0fc695fc:examples/features/structured_outputs/structured_outputs_offline.py#L1-L113'
  - 'vllm@0fc695fc:examples/features/structured_outputs/structured_outputs_client.py#L1-L268'
  - 'vllm@0fc695fc:examples/features/structured_outputs/pyproject.toml#L1-L8'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/tokenizer_info.py#L220-L274'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info.cc#L264-L303'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info_impl.h#L73-L105'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc#L446-L464'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc#L609-L681'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc#L809-L961'
  - 'https://github.com/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc#L1035-L1090'
  - 'vllm@568afb3a:vllm/v1/structured_output/backend_xgrammar.py#L119-L127'
  - 'vllm@84030bbe:vllm/v1/structured_output/backend_xgrammar.py#L79-L130'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L590-L618'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer.json'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json'
  - 'vllm@0fc695fc:vllm/tool_parsers/__init__.py#L53-L60'
  - 'vllm@0fc695fc:vllm/tool_parsers/glm47_moe_tool_parser.py#L1-L40'
  - 'vllm@0fc695fc:vllm/tool_parsers/glm4_moe_tool_parser.py#L149-L178'
  - 'vllm@0fc695fc:vllm/tool_parsers/abstract_tool_parser.py#L110-L173'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L578-L605'
  - 'vllm@0fc695fc:vllm/envs.py#L1804-L1806'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L28-L57'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L241-L253'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm47_tool_call_parser.py#L1-L47'
  - 'vllm@568afb3a:vllm/tool_parsers/__init__.py#L53-L60'
  - 'vllm@568afb3a:vllm/tool_parsers/glm47_moe_tool_parser.py#L1-L11'
  - 'vllm@568afb3a:vllm/envs.py#L1664-L1666'
  - 'vllm@568afb3a:vllm/entrypoints/openai/engine/protocol.py#L289-L303'
  - 'vllm@568afb3a:vllm/tool_parsers/abstract_tool_parser.py#L168-L185'
  - 'vllm@568afb3a:vllm/parser/abstract_parser.py#L511-L558'
  - 'vllm@568afb3a:vllm/tool_parsers/structural_tag_registry.py#L87-L136'
  - 'vllm@ced6857a:vllm/tool_parsers/__init__.py#L61-L68'
  - 'vllm@ced6857a:vllm/tool_parsers/glm47_moe_tool_parser.py#L1-L11'
  - 'vllm@ced6857a:vllm/envs.py#L1751-L1753'
  - 'vllm@ced6857a:vllm/entrypoints/generate/base/protocol.py#L246-L261'
  - 'vllm@ced6857a:vllm/tool_parsers/abstract_tool_parser.py#L167-L184'
  - 'vllm@ced6857a:vllm/parser/abstract_parser.py#L553-L600'
  - 'vllm@ced6857a:vllm/tool_parsers/structural_tag_registry.py#L97-L154'
  - 'vllm@84030bbe:vllm/tool_parsers/__init__.py#L61-L68'
  - 'vllm@84030bbe:vllm/tool_parsers/glm47_moe_tool_parser.py#L1-L11'
  - 'vllm@84030bbe:vllm/envs.py#L1780-L1782'
  - 'vllm@84030bbe:vllm/entrypoints/generate/base/protocol.py#L246-L261'
  - 'vllm@84030bbe:vllm/tool_parsers/abstract_tool_parser.py#L167-L184'
  - 'vllm@84030bbe:vllm/parser/abstract_parser.py#L549-L596'
  - 'vllm@84030bbe:vllm/tool_parsers/structural_tag_registry.py#L96-L153'
  - 'vllm@ced6857a:vllm/parser/engine/adapters.py#L193-L198'
  - 'vllm@ced6857a:vllm/renderers/online_renderer.py#L716-L746'
  - 'vllm@ced6857a:vllm/tool_parsers/abstract_tool_parser.py#L118-L149'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2803-L2810'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L1090-L1100'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/triton/v2/apply_grammar_bitmask.py#L28-L133'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_structured_output.py#L20-L163'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L44'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1205-L1218'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/triton/apply_grammar_bitmask.py#L28-L129'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_structured_output.py#L160-L202'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L7'
  - 'vllm@ba15685a:vllm/config/structured_outputs.py#L20-L75'
  - 'vllm@ba15685a:vllm/v1/structured_output/__init__.py#L51-L120'
  - 'vllm@ba15685a:vllm/v1/structured_output/__init__.py#L387-L445'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: 主线第 5 站讲 logits 怎样变成一个 token；本页讲带格式约束的请求在这一站前多出的一道屏蔽
  - to: token
    kind: builds-on
    note: 文法要按分词器的 token 判断合法性；154880 行词表与分词器编号的关系在那一页
  - to: speculative-decoding
    kind: builds-on
    note: MTP 草稿位置各要一行 bitmask，违反文法的草稿在验证前就被截掉
  - to: npu-model-runner
    kind: builds-on
    note: 前向和采样分成两次调用，bitmask 在第二次调用时作用到 logits
  - to: async-scheduling
    kind: builds-on
    note: 本部署异步调度开着，受约束请求上一步的 token 未确认时，本步整批采样要推迟
  - to: lm-head
    kind: builds-on
    note: 结构化输出以输出头算出的词表分数为基础，在采样前修改不合法候选的 logits。
contradicts: []
updated: '2026-11-24'
origin: direct
---

## 结构化输出怎样让模型只写出合法格式？

模型每生成一个 token，先给词表里每个候选打一个分，这组分数叫 **logits**；**采样**再按分数挑出一个 token，可以直接取最高分，也可以按概率抽，过程见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

**结构化输出（structured output）在打分和采样之间加一道关卡：按请求要求的格式，算出下一步哪些 token 还能让输出保持合法，把其余候选的 logits 改成 −∞，再交给采样。** 在**本行确实施加了文法约束（非未约束的思考段或终态全 1 行）且当前状态至少存在一个合法候选**的前提下，被改成 −∞ 的候选按概率算是 0，取最高分也轮不到它，因此不会被选中。

先用抽奖机建立直觉——**无遮挡盲抽甩出碎渣卡死齿轮箱 vs 在转盘前立起精密齿孔掩码挡板，只放行严丝合缝的合法拼图块**：

```wiki-diagram
file: structured-output-plate-grammar-gate
```

请求要求的格式可以是 JSON schema（规定 JSON 里有哪些字段、每个字段是什么类型）、正则表达式、几个固定选项，或者一段形式语法（grammar，如 **EBNF** 扩展巴科斯范式）。vLLM 先把它们都编译成**文法**：一台记着“已经写到哪里”的自动机。其中正则和固定选项等无嵌套格式只需要 **FSM（Finite State Machine，有限状态机）**，仅凭有限个状态就能判断下一字符是否合法；而 JSON 对象/数组或上下文无关文法允许任意深度的括号嵌套，需要 **PDA（Pushdown Automaton，下推自动机）** 在状态机上多挂一个“栈”来记住当前嵌套到第几层。vLLM 默认首选后端 **XGrammar** 正是把 JSON Schema / EBNF 编译为高效 PDA，并结合词表索引加速每步掩码生成。当前状态下允许的候选集合写成一行位图，叫 **bitmask**：词表里每个 token 编号占一位，1 表示允许，0 表示禁止。

这些约束需要额外工作：先在 CPU 上编译文法，生成时每步计算允许集合并施加掩码；没有及时做完时，采样就得等。

```wiki-diagram
file: structured-output
```

图里是一个只有 8 个 token 的教学词表，编号 0 到 7，模型给出的 logits 是 1、4、2、6、0、3、5、−1。请求要求输出形如 {"ok": 值} 的 JSON，值只能是布尔或 null；已经写出 {"ok":，此时只有 ␣false（编号 1）、␣null（编号 4）、␣true（编号 6）能接下去，␣ 表示开头带一个空格。屏蔽后的 logits 是 −∞、4、−∞、−∞、0、−∞、5、−∞。按取最高分采样，选中的是允许集合里分数最高的编号 6；模型原本最看好的编号 3「Sure」（6 分）已经被排除。这是单步、没有投机草稿的缩小例子。

**模型仍然负责打分，文法只决定哪些候选有资格被选。** 选出的 token 交回文法，状态推进到 {"ok": true，下一步允许的集合也跟着变，比如轮到收尾的右花括号。所以连续多步用的是一个不断前进的约束状态，而不是一张固定不变的表。

实际存储时，每 32 个编号的位打包成一个 32 位整数，最低位对应编号最小的 token。上面的例子如果单独打包，允许编号 1、4、6 就是 2¹ + 2⁴ + 2⁶ = 82，从高位到低位写成 01010010。全部位都是 1 的整数（按有符号数就是 −1）表示这一行不设限。

## 为什么需要它，代价在哪？

**只在提示词里要求"请输出 JSON"，模型照样会不时多写一句客套话、漏一个引号，或者把数字写成字符串；事后校验失败，只能整段重新生成。** 结构化输出让每一步只有合法候选参与采样，只要请求正常写到结尾，受约束的那段输出就符合编译出的文法。这是按机制推出的结论；固定部署上的实际格式正确率没有实测，其他模型或其他 runner 的结果也不能直接当成这套部署的保证。

它有两条边界。第一，格式约束不检查内容真假：符合 schema 的日期、金额或结论，照样会有错的。第二，请求被取消、触到输出长度上限或命中停止条件时，输出会停在格式写完之前，拿到的仍是不完整的 JSON，见下文[收尾](#收尾文法结束编号与引擎停止条件要对齐)。

难点在于 token 不等于字符。大模型分词器通常有十余万个普通条目，多数是字节级 **BPE**（Byte Pair Encoding，按高频字节片段合并的分词算法）拼出的多字符片段，详见 [token](token.md#编号要落在-154880-行之内)。一个 token 里可以同时有引号、冒号和半个单词，所以文法不能只问"下一个 JSON 字符是否合法"，要检查每个候选的整段字节能否接在当前状态之后。为此，后端要先结合分词器把文法预处理一遍，这一步叫**编译**；之后每一步，还要为整张词表填一行 bitmask。

代价分成五处。编译每个请求只做一次，其余四处每个调度步都有一份，与模型层数无关：

- **编译文法**：每个带约束的请求先把 schema 编成文法。编译在引擎进程（负责调度的那个进程）CPU 上的线程池里异步进行，编好之前请求留在等待队列，不参与调度；同一个 schema 再来时可以命中编译缓存。
- **每步填 bitmask**：引擎进程把本步前向派发给各卡后不等结果，趁 NPU 算前向，在 CPU 上为每个受约束的请求填一行。填得比前向慢，采样就得等它。
- **把 bitmask 作用到 logits**：bitmask 随采样调用发到每张卡。上游 GPU 实现在显卡上原地改写 logits；昇腾侧在 `v0.30.0` 主基线默认的 V1 [model runner](npu-model-runner.md)（每张卡上组织前向和采样的那部分代码）会把整张 logits 拷回 CPU 改完再拷回 NPU（显式设 `VLLM_USE_V2_MODEL_RUNNER=1` 可切到 V2 NPU 原地 Triton 核），而 `main` 已全量默认走 V2 NPU 原地快路径，下文细讲。
- **与投机解码配合**：[投机解码](speculative-decoding.md)先快速猜出后面几个 token（叫**草稿**），再让主模型一次验证、接受猜对的那一段（如 **MTP** 多 token 预测层）。每个草稿位置要各占一行 bitmask；草稿本身不受文法约束，不合法的草稿在验证前就被截掉，失去被接受的机会。
- **异步调度下整批采样要等上一步**：**异步调度**是上一步的结果还没处理完，就先把下一步排好发出去。开启异步调度后，批里只要有受约束的请求在 decode，整批采样都要等上一步结果处理完、bitmask 填好才发出，不能再和上一步结果的处理同时进行，见下文[异步调度](#异步调度本部署开着整批采样要等上一步)。

这几处在固定部署下各慢多少，目前没有实测数，缺口列在页末。结构化输出容易和相邻的几个机制混在一起，区别在于它们作用的位置：

| 机制 | 作用在哪里 | 改变的是什么 |
| --- | --- | --- |
| 采样参数（温度、top-k、top-p） | 采样时 | 在有资格的候选里怎样挑 |
| 结构化输出 | 采样之前 | 哪些候选有资格被挑 |
| 停止条件（结束编号、停止字符串） | 采样之后 | 什么时候结束，不限制中间写什么 |
| reasoning parser、tool-call parser | 生成好的文本上 | 把思考段、工具调用拆出来；reasoning parser 还决定结构化约束从哪一步开始 |

## 协议接受了 schema，是否就已经约束采样

还没有。以 DeepSeek Recipe 为例：请求转换会验证 JSON Schema，并选出交给推理后端的输出约束；渲染时再把 schema 写进提示词。**是否真正用约束解码来限制下一 token，由接入方的后端决定。** 要求写在提示词里、请求转换成功，与每一步都屏蔽非法 token，是三个不同的状态。

例如要求“年龄字段必须是整数”，结果却输出了字符串。先确认实际选出的约束是什么，再查后端是否接收、编译并在采样时应用它；不要仅凭接口返回成功就判定文法引擎坏了。请求同时带工具且允许调用时，Recipe 选择的是工具调用块约束，否则才从响应格式选择 JSON、schema 或正则约束。对照实验应固定这些选项，避免比较的本就不是同一种输出要求。

## 工具调用能解析出来，就说明参数符合 schema 吗？

**不一定。工具解析器把生成文本拆成函数名和参数，结构化输出则在生成过程中限制下一步能写什么。** 例如工具 check 接收布尔参数 ok，解析器能读出函数名 check 和参数 {"ok":"yes"}，仍不表示字符串 "yes" 满足布尔类型。应用还要校验参数，实际执行工具并回填结果；vLLM 输出一次调用描述，不会替应用执行函数。

走通用工具请求调整路径时，required（至少调用一个工具）或指定函数名，可以把工具 schema 转成 JSON 约束。采用专用标签格式的模型，需要匹配该模型的约束，不能将整段工具文本强制成通用 JSON。例如工具外层有开始、结束标签，只有参数部分应符合 schema；这时结构标签约束负责在不同片段间切换格式。

请求里的“严格”也有不同位置：response_format.json_schema.strict 属于回答格式，tools[].function.strict 属于某个工具的参数要求；后者还要经过服务端开关、解析器和模型格式的支持路径。旧 GLM 解析器的例外在下文说明，四版开关默认及具体写法集中在页末。判断约束是否生效，要看生成前究竟派生了哪份文法，不能仅看返回里是否出现 tool_calls。

模板负责准备模型输入，解析器负责拆出模型输出，自定义插件负责载入额外解析器；三者怎样配套，见[工具模板、解析器和插件](api-server-entry.md#工具模板解析器和插件分别接在哪一侧)。插件加载成功也不能代替上述文法条件。

## 投机验证怎样推进、回滚并应用文法

下面借例外 B 的 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)与示例请求 R1（4 个 prompt token，单请求入口与模型词表背景见[一条请求「第 1 站」](one-request.md#第-1-站-入口从-http-到-node0-的引擎)与 [GLM-5.3-Flash 模型页](glm-5-3-flash.md)），看带 **MTP** 多候选草拟的请求加上 JSON schema 后怎样走完一步。整条协作拆成四段责任：**① 请求选择**——无需服务端额外启动参数，只有携带 JSON schema 等约束的请求才进入文法路径，同批无约束请求照常从全词表采样；**② EngineCore 编译与填表**——前端定下后端后，目标 `EngineCore` 在后台编译自动机，并在每步前向派发后按候选草稿推进、回滚填写 bitmask；**③ Worker 屏蔽**——每张卡的 Worker 在主线[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)拿到 logits 后、采样前改写受约束行；**④ 异步等待**——开启异步调度时，只要批内含上一步 token 尚未确认的受约束请求，整批采样都会一并推迟等待（见[下文](#异步调度本部署开着整批采样要等上一步)）。

### 1. 入口：API server 校验请求、定下后端

请求把 response_format 设成 json_schema，或者在扩展字段里给出正则、固定选项、语法，API server 就把它转成结构化输出参数，并校验能不能编译。

真正编译文法、填 bitmask 的库叫**后端**。vLLM 支持四个：xgrammar、guidance（基于 llguidance 库）、outlines、lm-format-enforcer。服务默认用 auto：先按 xgrammar 校验，schema 里有 xgrammar 不支持的特性时退到 guidance，少数情况退到 outlines；lm-format-enforcer 只在显式指定时使用。四个后端产出同一种打包格式的 bitmask，作用到 logits 时用的是同一个函数。

**一个引擎只建一个后端对象，由第一个带约束的请求定下。** 昇腾补丁记住这个后端，之后哪个请求解析出另一个后端，就在校验时直接报错。同一个后端可以同时服务许多不同的 schema，"多个 schema"不等于"多个后端"；但在 auto 下，一个用了 xgrammar 不支持特性的 schema 会解析成 guidance，于是被拒。要避免，就在启动时显式指定后端。

请求随后被送进 node0 或 node1 的某一个 EngineCore。两台机器的 EngineCore 各有一个 **StructuredOutputManager**（结构化输出管理器，负责编译文法、保存每个请求的文法状态、每步填 bitmask），R1 的文法状态只存在处理它的那台机器上。

### 2. EngineCore：编译文法，编好才调度

EngineCore 收到请求就开始建文法。编译交给一个线程池异步完成，线程数取 CPU 核数的一半；请求先处在"等文法"的状态，不会被调度。调度器每轮检查一次编译好了没有，这次检查最多等 100 微秒：它是单次等待的上限，不是编译总时间，也不是每轮都会花掉的时间。编好之后请求转为普通等待，才轮得到 prefill。xgrammar 自己的编译器最多再开 8 个线程，并缓存编译结果（默认上限 512 MiB），同一个 schema 再来时不必重编。

有一种启动方式叫 external_launcher，每个 TP rank（[张量并行](tensor-parallel.md)组里一张卡对应的那个进程）各带一个调度器。异步编译会让各 rank 在不同时刻把请求放行，调度就对不齐了，所以这种方式下改为同步编译。官方双机命令用的是一个 EngineCore 带 8 个 worker 的多进程方式，不受影响。

bitmask 的宽度按模型配置里的词表大小建，也就是 logits 的列数 154880，而不是分词器实际会产出的 154856 个编号（含 154820 个普通条目）。154880 恰好是 32 的整数倍，所以每一行正好装满，与 logits 逐列对应，不需要截断或补位（在 EngineCore 进程的宿主机 CPU 内存里首次遇到带约束请求时分配，主机侧缓冲与内存管理见[主机内存与大页](host-memory-and-hugepages.md)）：

$$\text{Buffer}_{\text{bitmask}} = \underbrace{32 \times (1 + 3)}_{128\text{ 行}} \times \underbrace{\frac{154880}{32} \times 4\text{ B}}_{19{,}360\text{ B/行}} = 2{,}478{,}080\text{ B} \approx 2.36\text{ MiB}$$

| GLM bitmask 缓冲核算项（EngineCore CPU 内存） | 算式 | 数值结果 |
| --- | --- | --- |
| 一行的 32 位整数个数 | $154880 \div 32$ | **4,840 个 `int32`** |
| 一行字节数 | $4840 \times 4\text{ B}$ | **19,360 B** |
| 满载缓冲行数（32 请求 × 含 3 草稿位） | $32 \times (1 + 3)$ | **128 行** |
| 整块 bitmask 缓冲大小 | $128 \times 19{,}360\text{ B}$ | $2{,}478{,}080\text{ B} \approx$ **2.36 MiB** |

每个执行组一步最多 32 个请求、每步 3 个草稿，都是官方命令里的设定，见[关键参数](glm-5-3-flash-two-node.md#关键参数各管哪一步)。多出来的 24 个编号 154856–154879 分词器从不产出（见 [token](token.md#编号要落在-154880-行之内)）。按固定 GLM 文件走 XGrammar v0.2.0 的 Hugging Face fast 分词器入口时，词表先补到 154880 项，这 24 项是空字符串；库把它们归入特殊编号，正常文法掩码将它们屏蔽。这是该固定库的源码结论；思考段或文法终态若由 vLLM 直接填全 1，就没有应用这份掩码，不能把屏蔽范围扩成服务的全部阶段。

### 3. 每一步：趁前向时在 CPU 上填 bitmask

**bitmask 在 EngineCore 进程里、由 CPU 算出，时机是本步前向已经派发、还没取回结果的时候。** EngineCore 每步先把前向派发给本机 8 个 worker，不等结果，接着挑出本步要填 bitmask 的请求：用了结构化输出、并且这一步会产出 token 的请求。chunked prefill（长 prompt 分几步算）的中间块不产出 token，不填。

上游为大批量准备了并行填表，要过两道门槛。第一道在启动时：请求上限 max-num-seqs 大于 128，才建填表用的线程池（和上面编译用的线程池是两个）；本部署是 32，这个线程池根本不建。第二道在每一步：受约束的请求多于 128 个、并且没开投机解码，才把填表分给线程池；本部署开了 MTP，即使建了线程池也不走并行。所以所有请求都在 EngineCore 的主线程里逐个串行填。

开了 MTP 后，R1 这样的 decode 请求每步带 1 个已确定的位置和 3 个草稿位置，要填 4 行。第 1 行按当前状态填；然后临时接受第 1 个草稿，填第 2 行；依次接受第 2、3 个草稿，填第 3、4 行；填完把这 3 步临时推进全部回滚，等真实采样结果出来再正式推进。每个位置面对的前缀不同，不能共用一行。这次回滚撤销的是临时接受的草稿，最多 3 步，不撤销此前已确认的输出；这不等于库内部最多只能保存 3 步历史。

有几种行直接填全 1，即不设限：文法已经走到终态的请求；还在思考阶段、不该受约束的请求，见下一节；以及 −1 占位草稿之后的行。异步调度下，不合法的草稿被截掉后会留下 −1 占位（见下一节），填到首次出现 −1 的那一行时仍按当前状态填表，随后停止推进，后续各行均填全 1（例如草稿截为 `[d₁, −1, −1]` 时，行 0 按 `S₀`、行 1 按 `S₁`，行 2 与行 3 均填全 1）。填好的 bitmask 只含受约束请求的行，按调度顺序排好，转成 numpy 数组，随采样调用一起发出。

```wiki-diagram
file: structured-output-fig-mtp-bitmask-grid
```

### 4. 每张卡：把 bitmask 作用到 logits

采样调用发给这台机器的全部 8 个 worker，只有 0 号卡回报结果。前向结束时，每张卡都已经通过 TP 组内的 [All-Gather](collective-communication.md#all-gather)（每张卡交出自己算的那一段，拼成完整的一份发给所有卡）拿到完整的 logits；R1 的一个 decode 步是 4 行 × 154880 列。worker 先按请求 ID 把 bitmask 重新排成本卡 logits 的行序（见上图第 ③ 部分），不受约束的请求那几行填全 1。请求进入、退出、重排，都不会让约束对错行。

**在昇腾默认的 MRV1（`model_runner_v1.py`）路径下，这一步在历史固定镜像 `db701c1f` 与正式版 `v0.30.0`（`c09d3e20`）中均走 CPU 往返：把整张 logits 拷到宿主机 CPU、转成 fp32，调 xgrammar 的 CPU 函数把禁止位改成 −∞，再拷回 NPU 转回原精度**（跨总线 D2H/H2D 同步与主机缓冲边界见[主机内存与大页](host-memory-and-hugepages.md)与[昇腾运行时与调优](ascend-runtime-and-tuning.md)）。源码注释写的是“GPU 版用 `torch.compile` 优化这一步、昇腾暂不支持”，但同期上游 GPU 路径直接调 xgrammar 原地改写核而未用 `torch.compile`，因此该注释理由仍待证，实际历史成因归入页末待核。搬运对象是当次调用的整张 logits，而非仅受约束请求的那几行：满载 32 条请求里哪怕只有 R1 带 schema，也要搬全部 128 行，且本机 8 张卡各搬一遍。

R1 一个 decode 步的 logits 是 4 行、约 1.18 MiB（推导见[主线第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)）。满载时按同样口径核算：NPU → CPU 为 BF16，CPU → NPU 时仍为 FP32、传回后再转回原精度。两方向合计约 113.4 MiB/卡/步（不含其他搬运，实际链路流量、耗时和 CPU 改写耗时未实测）：

$$V_{\text{roundtrip}} = \underbrace{128 \times 154880 \times 2\text{ B}}_{\approx 37.8\text{ MiB (BF16)}} + \underbrace{128 \times 154880 \times 4\text{ B}}_{\approx 75.6\text{ MiB (FP32)}} \approx 113.4\text{ MiB/卡/步}$$

| 昇腾 V1 每张卡为 bitmask 搬运的满载 logits（128 行 × 154880 列） | 算式 | 单步数据量 |
| --- | --- | --- |
| NPU → CPU（满载 decode，BF16） | $128 \times 154880 \times 2\text{ B}$ | $39{,}649{,}280\text{ B} \approx$ **37.8 MiB** |
| CPU → NPU（CPU 上转 FP32 改写后回传） | $128 \times 154880 \times 4\text{ B}$ | $79{,}298{,}560\text{ B} \approx$ **75.6 MiB** |
| 单步双向张量搬运合计（每张卡） | $37.8 + 75.6\text{ MiB}$ | 约 **113.4 MiB/卡/步** |

V2 model runner 带一个在 NPU 上直接改 logits 的 Triton kernel，把打包的位展开后写入 −∞。固定版本的补丁默认不选 V2，要显式设环境变量才会切换；打开它只改变选用哪个 runner，不能说明 GLM、MTP 和图模式的组合都兼容。下图按真实 1 : 2 数据量比例对照昇腾 V1 整张往返与 V2 / `main` NPU 原地快路径：

```wiki-diagram
file: structured-output-fig-bitmask-pipeline
```

### 5. 采样之后：推进文法，截断下一轮草稿

屏蔽后的 logits 进入正常的采样和草稿验证，规则见[采样](sampling.md)，过程见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)和[投机解码](speculative-decoding.md)。0 号卡把本步接受的 token 交回 EngineCore，调度器把它们喂给文法，状态正式前进一步。按理这些 token 都在允许集合里；万一文法拒绝，日志报错并终止这个请求。

MTP 随后草拟 3 个新 token。草拟直接取最高分，不看 bitmask，所以草稿不一定合法。调度器让文法检查草稿，只保留最长的合法前缀。同步路径可以在下一轮排程前截短非法草稿；本部署的异步路径已经派发本步前向，过滤后仍按原长度补 −1，让非法草稿不能被接受，并不会因此省掉已经派发的主模型前向。对 MTP 接受率影响多大，没有实测。

## 思考阶段、异步调度与收尾有什么不同？

### 思考阶段：官方命令从第一个输出 token 起就约束

GLM 的聊天模板在 prompt 末尾放一个 `<think>` 标记，模型先写思考过程，再写答案，见 [token](token.md)；官方教程的 FAQ 写明 GLM-5.3-Flash 不支持用 enable_thinking 关掉思考。结构化输出约不约束思考段，由三件事决定：服务有没有配 **reasoning parser**（按思考标记把输出切成思考段和答案段的解析器）、enable_in_reasoning 开关、这个请求的思考是否已经结束。实现里"这一步填不填 bitmask"和"这一步推不推进文法"是分开判断的。

**官方双机命令没有配 reasoning parser。** 这时 StructuredOutputManager 没有办法判断思考在哪里结束，于是从第一个输出 token 起就填 bitmask、推进文法：思考段也被要求符合 JSON schema。针对最终答案设的格式，就这样连思考过程一起约束了，模型实际上写不出自由的思考段；这对输出质量有什么影响，没有实测。

教程 FAQ 为函数调用给出的配置里有 reasoning parser glm45，它在 vLLM 里对应一个默认按思考模式解析的 DeepSeek-V3 风格解析器。配上以后，思考没结束时 bitmask 填全 1、文法不动；看到思考结束标记的那一步，文法仍先不推进，下一步才开始，免得把结束标记当成答案的第一个 token 喂给文法。开了投机解码、约束又是 structural tag（按阶段切换格式的约束）时例外，当步就推进，因为紧接着的草稿要马上用文法检查。如果把 enable_in_reasoning 设为 true，思考段也全程受约束。

**固定旧 GLM 的工具调用有一处例外。** 教程 FAQ 指定的 glm47 解析器继承 glm4 的请求调整：required 或指定函数时，跳过通用 JSON schema 派生，让模型按模板写 XML 风格工具文本，再从中提取调用。它也没有自己的结构标签构造入口；仅打开严格工具调用的环境开关不能补上这条能力。Ascend 对旧 glm47 的补丁只处理零参数调用的文本区域。因而在本页基线上，工具调用能被解析，不等于参数已经受 schema 强制约束；官方双机命令原本也没有配工具解析器，要用时按教程 FAQ 另加。

另一个入口条件是普通非 beam Chat 的 include_reasoning=false：四版都会把 reasoning_ended=True 传给引擎，等于告诉文法管理器现在就可以约束答案。因此配上 reasoning parser 后，也不能假定一定等到真实的思考结束标记才约束；这个请求设置会改变判断的起点。字段的流式过滤和逐 token 元数据差异统一见[流式输出](streaming-output.md#隐藏思考少思考和不思考是同一个开关吗)。

| 配置组合 | 思考段是否填 bitmask | 何时开始推进文法 |
| --- | --- | --- |
| 未配 reasoning parser（官方双机命令） | 从第 1 个输出 token 起就约束 | 从第 1 个输出 token 起推进，模型写不出自由思考段 |
| 配 `glm45` 且 `enable_in_reasoning=false` | 思考未结束时填全 1（不设限） | 看到思考结束标记的下一步才推进（开投机解码配 structural tag 时当步推进） |
| 配 `glm45` 且 `enable_in_reasoning=true` | 思考段全程受约束 | 全程推进 |
| 配 `glm45` 且请求设 `include_reasoning=false` | 直接视作 `reasoning_ended=True` | 无需等到思考结束标记，提前开始约束答案 |

### 异步调度：本部署开着，整批采样要等上一步

**异步调度**让主机提前准备下一步，不等上一步的结果全部处理完，见[异步调度](async-scheduling.md)。**本部署的异步调度是开着的：** 官方命令没写这个开关，vLLM 按自动判定打开，因为 MTP 属于支持异步调度的草拟方法、多进程执行器也支持，判定过程见[请求调用链](request-call-chain.md)，主线底稿 03 第 24 条是同一结论。

打开以后，受约束的请求在 decode 阶段每一步被调度时，上一步的 token 都还没确认，调度器先用占位记着。bitmask 依赖这个 token，因此 EngineCore 照常派发本步前向，但把填表和采样推迟。它会先等上一步输出回来并处理完，取回上一步 MTP 草拟的 token，用文法截掉非法草稿并以 −1 占位，再填 bitmask、发起采样。

**推迟的是整批的采样调用，不只是受约束的那几行。** 调度器在排本步时，只要批里有一个受约束的请求带着上一步的占位，就给整批打上"要等"的标记；EngineCore 按这个标记决定整批采样是立刻发还是推迟。所以同批不受约束的请求，采样也要跟着等。

这个依赖只挡住了和采样相关的重叠：本步前向仍然提前派发，填 bitmask 时 NPU 照常在算本步前向；失去的是本步采样与上一步结果处理之间的重叠，不能概括成整条异步流水线失效。

```wiki-diagram
file: structured-output-fig-async-sampling
```

### 收尾：文法结束编号与引擎停止条件要对齐

**文法识别的结束编号与引擎收到就停止的编号，必须一起核对。** 对已被文法识别为结束标记的编号，格式还没写到可以结束的位置，bitmask 就不放行，模型给它的分再高也选不到；写到可以结束的位置才允许它参与采样。被选中后，引擎再按自己的停止条件收尾。文法到达终态以后，vLLM 将这一行填全 1，不再设限。

bitmask 只决定模型选哪个 token，管不到请求在哪里被叫停。下面几种停止都不经过文法，会在格式写完之前生效，拿到的是不完整的格式：

- 请求被取消；
- 输出触到 max_tokens 或模型的上下文长度上限；
- 请求设了停止字符串：API server 把 token 还原成文字时一发现它就截断，再通知 EngineCore 中止请求；停止字符串哪怕出现在 JSON 某个字段的值里，也会在那里断开；
- 请求开了重复检测，检测到重复也会停。

GLM 的三个结束编号 154820、154827、154829 分别是什么，见 [token](token.md#编号要落在-154880-行之内)。固定旧 vLLM 没有将请求停止集合交给 XGrammar matcher（记录当前文法状态的匹配器）。在所核 XGrammar v0.2.0 的 Hugging Face fast 入口中，缺省只读分词器的 eos_token_id；按固定 GLM 文件得到的是 154820，而模型生成配置还列着 154827、154829。后两个编号对应的文本非空，不会仅因 Hugging Face 将其标为 special 就被这个库归入始终屏蔽的特殊编号，它们仍可能作为普通文本接受文法检查。

另用一个允许任意字符串的 schema 作示意：已经写到 {"note":"，尚未闭合字符串。154827 的文本 `<|user|>` 可以接在字符串里面，文法因此可能允许该候选；但默认不忽略 EOS 时，引擎把 154827 也放在停止集合里，达到最少输出数后若采样选中它，请求就在 JSON 写完前结束。154829 的 `<|observation|>` 同理。这里说明源码可达的提前停止条件，没有测量模型实际选中这些编号的概率。

rc2 与固定 main 会把请求的全部停止编号交给编译入口，并由 XGrammar 后端在非空时覆盖 matcher 的停止集合；旧基线和 v0.26 没有这次传递。实际部署仍须确认安装的库、分词器入口和停止集合，不能把新版传参套回旧镜像。取消、长度上限与停止字符串等外部收尾条件仍可能截断输出。

## 常见误解

- **"结构化输出是整个服务的开关。"** 它按请求开启。服务侧只决定用哪个后端、配不配 reasoning parser；请求不带约束，就完全不走这条路径。
- **"符合 schema 就说明内容对了。"** 它只保证格式。日期、金额、结论照样会错；请求被取消、触到长度上限或命中停止字符串时，连格式都写不完。
- **"bitmask 是在 NPU 上算的。"** 文法状态和 bitmask 都在 EngineCore 进程的 CPU 上；worker 只负责把它作用到 logits。在昇腾 V1 上，连"作用"这一步也是在 CPU 上做的。
- **"只有一个请求带 schema，昇腾只搬一行 logits。"** V1 搬的是这次调用的整张 logits，行数随批里的请求数和草稿位增长，8 张卡各搬一遍。
- **"100 微秒就是编译时间。"** 那是调度器每轮检查编译是否完成时的单次等待上限；编译本身在线程池里另外进行，耗时取决于 schema。
- **"不同 schema 要用不同后端，auto 能自动混用。"** 同一个后端可以服务任意多个 schema；反过来，一个引擎只能有一个后端，昇腾补丁会拒绝解析出另一个后端的请求。
- **“思考过程不受约束。”** 取决于配置。官方双机命令没有 reasoning parser，从第一个输出 token 起就受约束；配置 glm45 后，默认不约束推理区，等思考结束才开始约束。若显式打开 enable_in_reasoning，结构化输出管理器会在推理阶段也填充约束掩码，因此仅配置 glm45 不能确定约束开始的阶段。
- **"MTP 的 3 个草稿共用一行 bitmask。"** 每个草稿位置的前缀不同，各填一行；StructuredOutputManager 临时接受草稿、逐位置填完再回滚。
- **"异步调度遇到结构化输出就整体失效。"** 上一步 token 未确认时，本步的填表和整批采样要推迟，本部署 decode 阶段每一步都是这样；前向仍然提前派发。
- **"只有带 schema 的请求会变慢。"** 异步调度下推迟的是整批采样，同批不带约束的请求也要跟着等。
- **"打开 V2 就能在 NPU 上改 logits，而且 GLM 一定能用。"** V2 需要显式开启，开关只决定选哪个 runner；GLM、MTP 与图模式的组合是否兼容没有验证。

## 对照源码

### 怎么开

**请求选择要约束什么，启动配置选择怎样编译它。** 两个容器的名字只差结尾，但位置不同：`structured_outputs` 随请求传，`structured_outputs_config` 随服务启动传。通用请求协议在 `v0.23.0` 至 `v0.30.0` / `main` 一脉相承：在 `v0.30.0` 主基线部署 `Qwen/Qwen3-8B` 时，若希望模型先自由输出 `<think>...</think>` 思考段、仅对最终回答施加 JSON Schema 约束，启动时显式固定单一后端并配上对应解析器即可（配置形式示意，未在设备上执行）：

```bash
vllm serve Qwen/Qwen3-8B \
  --reasoning-parser qwen3 \
  --structured-outputs-config '{"backend": "xgrammar"}'
```

**对照例外 B 的 GLM 双机部署写一份完整请求**（以下按固定 `vllm@0fc695fc` / `vllm-ascend@db701c1f` 核对；`Qwen3-8B` 请求体除 `"model"` 字段外写法完全相同）。假设已有按[双机部署前提](glm-5-3-flash-two-node.md#部署前提)启动的服务，固定教程的对外名称是 `glm`；若自行改过，实际请求的 `model` 以 `/v1/models` 返回的名称为准。希望只约束最终答案、让 GLM 先自由思考时，可给原有两端引擎配置一致地增加下面两项；它们是追加片段，不替代双机完整启动命令：

```bash
--reasoning-parser glm45 --structured-outputs-config '{"backend":"xgrammar"}'
```

然后发送以下 Chat 请求。示例要求答案是带一个布尔字段 ok 的 JSON 对象，沿用开篇的小例子；这是用法示例，未作为该双机上的输出实测。

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "glm",
    "messages": [{"role": "user", "content": "检查 2+2 是否等于 4，用 ok 布尔字段回答。"}],
    "max_completion_tokens": 4096,
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "check_result",
        "schema": {
          "type": "object",
          "properties": {"ok": {"type": "boolean"}},
          "required": ["ok"],
          "additionalProperties": false
        }
      }
    }
  }'
```

输出的目标形状是 {"ok":true}，不是保证一定得到 true；schema 只约束布尔类型。预算仍包括思考与回答，触及长度或停止条件可留下半截结果，见上文收尾。配置 parser 后思考段与答案段的约束起点也沿用上文，不再重复机制。

**先区分两种请求入口。**

| 请求入口 | 类型、缺省与作用 | 怎样传 |
|---|---|---|
| response_format | Chat 与 Completion 均默认 None。type 可为 text、json_object、json_schema、structural_tag | Chat 直接放 HTTP JSON 顶层；本基线 Completion 也支持，使用 prompt 替换 messages、max_tokens 替换 max_completion_tokens |
| structured_outputs | 默认 None；HTTP 为对象，Python 为 StructuredOutputsParams | HTTP 顶层放扩展字段；兼容 SDK 通常放 extra_body={"structured_outputs": …}；离线传给 SamplingParams，不传给 LLM 的模型构造位置 |

response_format 的 json_schema 外层需要 name 字符串；description 和 strict 默认 None；schema 是外部键名，协议内部叫 json_schema。类型为 json_schema 时必须提供 json_schema 对象，实际使用应给其中的 schema 对象。vLLM 转成采样约束时取的是 schema；strict 不是服务启停开关，也不替代 schema 的类型、required 或 additionalProperties。type=json_object 不限定字段；type=text 本身不增加格式约束。

两种入口最终汇到同一个约束。**同传时不是简单的“整个 response_format 优先”**：json_schema 转成 json、json_object 转成 json_object、structural_tag 转成 structural_tag，再替换 structured_outputs 中的对应字段。若原来也是 json，同名字段被替换；若原来是 regex，替换后就有 json 和 regex 两种约束，互斥校验报错。type=text 保留已有 structured_outputs，不会关闭它。实践中一次只选一种入口，便于核对。

六种约束字段默认都是 None；其中恰好一个非 None 才能创建有效的 StructuredOutputsParams。空容器 {} 和只写辅助选项都不成立。关闭格式约束应省略这两个请求入口或令它们为 null，并确认没有工具选择派生的约束；不要用空列表、空字符串或 json_object=false 代替关闭。tool_choice 为 required 或指定函数时仍可能由工具解析器生成 schema，见上文[入口处理](#1-入口api-server-校验请求定下后端)。

| structured_outputs 子字段 | 类型与合法用法 | 边界 |
|---|---|---|
| json | schema 对象或包含 schema 的 JSON 字符串；默认 None | 不是希望模型复述的 JSON 实例。字符串必须能解析为 schema，后端还要验证其支持的关键字 |
| json_object | bool 或 None；开启用 true | false 仍算“非 None 的一个约束”，但后续按真值选 JSON_OBJECT，找不到有效类型会报错；它不是关闭写法 |
| choice | 字符串列表或 None；如 ["yes","no"] | [] 被显式拒绝；重复项没有独立的加权语义。候选是完整字符串，不是 allowed_token_ids 的 token 编号 |
| regex | 正则字符串或 None；如 `(yes\|no)` | 使用后端支持的正则语法。JSON 中反斜杠需再转义，例如数字类写成 `"\\d+"`；编译失败不等于模型没听懂提示词 |
| grammar | 文法字符串或 None；空白字符串被拒绝 | xgrammar 接受 EBNF；检测到 Lark 形式时先转 EBNF。guidance 使用自己的文法支持；outlines、lm-format-enforcer 拒绝 grammar |
| structural_tag | 包含标签约束对象的 JSON 字符串或 None | HTTP response_format 可以直接传对象，扩展字段这里需要序列化字符串；新 format 与旧 structures/triggers 的后端路径不同，见下面示例 |

沿用上面的 model、messages 和输出预算，移除 response_format，然后分别增加下面任意一个顶层成员即可试不同约束；表中的片段是替换项，不是同时加入：

| 目标 | HTTP JSON 成员示例 |
|---|---|
| 同一个 ok schema | `"structured_outputs":{"json":{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"],"additionalProperties":false}}` |
| 任意 JSON 对象 | `"structured_outputs":{"json_object":true}` |
| 两个完整字符串之一 | `"structured_outputs":{"choice":["yes","no"]}` |
| 正则约束 | `"structured_outputs":{"regex":"(yes\|no)"}` |
| xgrammar 的最小 EBNF | `"structured_outputs":{"grammar":"root ::= \"yes\" \| \"no\""}` |

离线 Python 采用同一个约束对象。下面接续已经按模型和设备配置构造的 llm，只演示本次请求如何传；llm.generate 的输入是已经渲染好的 prompt，不替代聊天模板处理：

```python
from vllm import SamplingParams
from vllm.sampling_params import StructuredOutputsParams

params = SamplingParams(
    max_tokens=4096,
    structured_outputs=StructuredOutputsParams(choice=["yes", "no"]),
)
outputs = llm.generate([rendered_prompt], params)
```

**标签约束与旧字段合写。** structural tag 允许在指定标签内切换到 schema，而不是要求所有外层文字都是 JSON。本基线同时接受旧 structures/triggers 和新 format 协议；先用旧结构看清 begin、end 与 schema 的位置。将完整 Chat 请求里的 response_format 替换为：

```json
{
  "type": "structural_tag",
  "structures": [{
    "begin": "<answer>",
    "schema": {
      "type": "object",
      "properties": {"ok": {"type": "boolean"}},
      "required": ["ok"],
      "additionalProperties": false
    },
    "end": "</answer>"
  }],
  "triggers": ["<answer>"]
}
```

structures[].begin 与 end 都是必填字符串；schema 在 Python 协议内部叫 structural_tag_schema，默认 None，外部 JSON 用 schema。要约束标签内 JSON，就显式给 schema，不把缺省 None 当作可用的 JSON schema。triggers 是触发字符串列表；上例以 `<answer>` 触发同名标签，标签内目标形状为 {"ok":true}。guidance 的旧路径要求每个 begin 都以前述某个 trigger 开头，且标签列表非空；xgrammar 会把旧项转换成 StructuralTagItem。旧格式是兼容入口，不把 begin/end 拆成独立请求顶层字段。

用扩展入口表达同一结构时，先把整个对象序列化：Python 写 StructuredOutputsParams(structural_tag=json.dumps(tag_format))；HTTP 则在 structured_outputs.structural_tag 放这段序列化字符串。不是把 structures 列表直接赋给 structural_tag，也不是把字典当作这个字符串字段。

新结构的 format 交给 XGrammar 解析。下面是同一标签例子的另一种 response_format 写法，按 XGrammar v0.2.0 的固定类型定义核对；它是基线依赖范围内的格式示例，不表示已经在镜像内编译或推理实测：

```json
{
  "type": "structural_tag",
  "format": {
    "type": "tag",
    "begin": "<answer>",
    "content": {
      "type": "json_schema",
      "json_schema": {
        "type": "object",
        "properties": {"ok": {"type": "boolean"}},
        "required": ["ok"],
        "additionalProperties": false
      }
    },
    "end": "</answer>"
  }
}
```

基线 xgrammar 对没有 structures 的对象走完整 payload 解析；guidance 的实现仍读取 structures/triggers，不能因前端协议接受 format 就推断它也能消费新结构。outlines 与 lm-format-enforcer 没有 structural tag 编译分支；选择本例时显式用 xgrammar，别依赖自动回退替你修正后端差异。

**三个请求辅助字段：有定义，不等于会改变文法。**

| 请求子字段 | 定义默认 | 这套 V1 链路中的实际作用 |
|---|---|---|
| structured_outputs.disable_any_whitespace | bool，False | 随对象保留，但没有传到文法编译器；不能靠请求 true 压紧 JSON |
| structured_outputs.disable_additional_properties | bool，False | 随对象保留，但不触发 guidance 的 schema 改写；不能覆盖服务配置 |
| structured_outputs.whitespace_pattern | str 或 None，默认 None | 没有传入后端；例如 `"[ \\t]*"` 不会据此改变可用空白。与前两个字段同传也没有组合效果 |

原因可沿数据流直接核对：基线 get_structured_output_key 只返回约束类型和约束内容，compile_grammar 接收这两个值；xgrammar/guidance 从服务配置读取自己的格式选项。rc2/main 编译入口另加可选停止编号，仍不传这三个请求辅助字段。比如请求带 json 和 disable_any_whitespace=true、服务仍为 False，请求不能据此限制格式空白；服务为 True 时，请求 False 也不能恢复任意格式空白。若要逐请求禁止额外属性，应在该请求的 schema 中显式写 additionalProperties=false；下面的服务开关则改变 guidance 的缺省补值。

**服务配置的五项与编译缓存。**

| 启动入口 / 字段 | 类型与默认 | 生效条件 |
|---|---|---|
| --structured-outputs-config / Python structured_outputs_config | 配置对象；缺省创建 StructuredOutputsConfig；CLI/LLM 的 {} 使用默认字段 | 不会让所有普通请求自动受约束；CLI 用 JSON 对象，Python LLM 可传字典或配置对象；直接 EngineArgs 应传配置对象，不能类推 LLM 的字典转换 |
| structured_outputs_config.backend | 字符串，默认 auto | 合法值为 auto、xgrammar、guidance、outlines、lm-format-enforcer；后端决定支持哪些约束，不按请求指定 _backend |
| `structured_outputs_config.disable_any_whitespace` | bool，默认 False | true 只允许显式 xgrammar 或 guidance；auto、outlines、lm-format-enforcer 配 true 启动校验就拒绝 |
| `structured_outputs_config.disable_additional_properties` | bool，默认 False | true 只允许显式 guidance；包括 auto 在内的其他后端都在启动校验拒绝 |
| `structured_outputs_config.enable_in_reasoning` | bool，默认 False | 控制有 reasoning parser 时是否仍约束思考段；没有 parser 的官方命令从首个输出 token 就约束，不因 False 自动识别思考边界 |
| VLLM_XGRAMMAR_CACHE_MB | 整数环境值，默认 512 | 创建 XGrammar 编译器时读取，乘 1024×1024 传作 cache_limit_bytes，即默认 512 MiB；是 CPU 文法编译缓存，不是 KV cache 或每个请求的额度 |

这个开关限制的是 JSON 的自由格式空白，不删除字符串值中有意义的空格，也不保证删除标点之间的全部空格。xgrammar 的 JSON/JSON_OBJECT 编译路径传 any_whitespace 的反值，没有传 separators；在固定 XGrammar v0.2.0 中，禁用任意空白后默认分隔符仍可包含逗号、冒号后的一个空格。guidance 对应 whitespace_flexible。regex、choice、grammar 里的格式由自身约束决定，不靠这个 JSON 选项重写。

guidance 的附加属性开关也不是简单覆盖所有 schema。它递归访问对象；只在存在 properties 或 patternProperties、而没有 additionalProperties 键的节点补 false。已经显式写 true、false 或子 schema 的键都保留。例如 properties 里只有 ok、未写 additionalProperties 时，服务开关可补 false；请求若明确写 additionalProperties=true，它不会被这个开关强制改成 false。这项处理用于 JSON schema 和旧标签内的 schema，普通 json_object 分支不调用这段改写。patternProperties 能否被后端接受还要过格式支持校验，不能因改写函数识别这个键就推断支持。

若服务选择 guidance，要同时启用两项格式选项，可以给原启动命令增加：

```bash
--reasoning-parser glm45 --structured-outputs-config '{"backend":"guidance","disable_any_whitespace":true,"disable_additional_properties":true,"enable_in_reasoning":false}'
```

上例请求仍须带 schema。Python 构造入口可用 structured_outputs_config={"backend":"guidance","disable_any_whitespace":True,"disable_additional_properties":True}；请求的 SamplingParams 不承接这个服务字典。单独的 --reasoning-parser glm45 非空时还会写入服务配置里的 reasoning_parser；完整 parser 参数参考不在此重复。

| parser 与 enable_in_reasoning | 约束何时作用 |
|---|---|
| 未配置 parser；False 或 True | 无法识别思考结束，从第一个输出 token 就约束 |
| glm45；False | 思考未结束时不约束，识别结束后约束答案；MTP structural tag 的边界特例见上文 |
| glm45；True | 思考段也填约束掩码，不能再期待自由思考文本 |

需要扩大 XGrammar 编译缓存时，在实际承载 EngineCore 的进程启动前设置环境，例如 Linux shell 用 `export VLLM_XGRAMMAR_CACHE_MB=1024`，再执行原双机启动命令，两端保持相同配置。环境值不是 HTTP JSON 字段，已创建的 compiler 不会随 shell 修改而重新设置上限。vLLM 这里只做 int 转换，非整数字符串报错，没有对 0/负数定义“关闭/无限”语义或额外范围校验；这些边界由镜像实际安装的 XGrammar 决定。vLLM 的依赖范围并非单一库版本，因此这里采用正整数示例，不承诺 0 可以关闭缓存。

auto 的后端选择、昇腾的单后端拒绝和计算开销沿用上文。切到 Ascend V2 runner 的环境入口仍为 VLLM_USE_V2_MODEL_RUNNER=1；它不改变请求参数的名字，也不构成 GLM/MTP/图模式组合可用的保证。

**工具 strict 有自己的入口与条件。** HTTP Chat 中写在 tools 数组各项的 function.strict；v0.26、rc2 和固定 main 显式声明为 bool 或 None，默认 None。旧基线没有声明这个字段，虽允许保留额外字段，也不能据此推断旧 glm47 会生成严格文法。不要与 response_format.json_schema.strict 混用位置。

后三版的模型结构标签路径要同时满足：解析器声明了支持的模型格式，服务的 VLLM_ENFORCE_STRICT_TOOL_CALLING 为真，有工具，tool_choice 不是 none。auto 另要求至少一个工具 strict=True；required 或指定函数不经过这个 auto 条件。通过这些条件后才调用对应模型的结构标签构造器，它决定外层标记、工具选择和各参数的约束；不能由“一个工具为 true”推断所有工具参数都同样受限。普通解析成功仍不替代应用的参数校验。

例如，沿用已有 Chat 请求的 model、messages 和输出预算，移除回答用的 response_format，再增加以下两个成员。这是**支持上述模型格式路径的新版本**的工具配置片段，不是固定旧 GLM 镜像的已验证调用：

```json
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "check",
      "parameters": {
        "type": "object",
        "properties": {"ok": {"type": "boolean"}},
        "required": ["ok"],
        "additionalProperties": false
      },
      "strict": true
    }
  }],
  "tool_choice": "auto"
}
```

auto 仍要求服务启用 enable-auto-tool-choice，并配匹配的 tool-call-parser，详见 [API 工具入口](api-server-entry.md#放到-glm-双机node0-上一个前端接下全部请求)。这两个 CLI 选项决定是否接收及怎样解析请求，严格工具环境开关决定是否尝试派生模型文法，每个 function.strict 再描述本工具的要求，三者不能互相替代。

全局环境开关在旧基线默认 0，按 int 再转 bool；后三版默认 True，字符串转小写后仅 true 或 1 为真，其余为假。需要显式开启时，在服务启动前设 `VLLM_ENFORCE_STRICT_TOOL_CALLING=1`。旧 glm47 没有结构标签构造入口，改为 1 仍不补出该能力；后三版 glm47 声明 glm_4_7 格式，但外部构造器支持的 schema 和部署兼容性须按实际库版本确认。

若进一步运行官方结构化输出示例，HTTP 脚本是 structured_outputs_client.py，读取 --constraint、--stream 和 --reasoning；最后一项只控制打印已有思考字段，不控制模型是否思考。structured_outputs_offline.py 则创建 LLM，顺序调用 generate，未解析这些命令行选项。固定目录的打包入口 structured-outputs 指向未提供的 structured_outputs 模块，应按实际脚本入口使用，不能直接把 README 的 uvx 片段视为已验证命令。本文的 curl 与已有 llm 片段无需再启动第二份离线模型。

### 会报什么错

| 报错 | 在哪里 | 原因 |
| --- | --- | --- |
| `V1 structured outputs only supports one backend per engine. The engine is already using '...', but this request resolved to '...'` | 昇腾补丁：请求校验与 `grammar_init` | auto 下不同 schema 解析到不同后端；显式设 `backend` 即可避免 |
| `Request-level structured output backend selection is not supported.` | 上游 `SamplingParams` 校验 | 请求里自带 `_backend` 且与服务配置不同 |
| `Structured outputs requires a tokenizer so it can't be used with 'skip_tokenizer_init'` | 同上 | 服务以不加载分词器的方式启动 |
| `Failed to transform regex into a grammar: ...` | xgrammar 校验 | 显式指定 xgrammar 时，正则无法转成文法；auto 下这个错误被接住，改用 guidance |
| `Unsupported structured output backend: ...` | `grammar_init` | 后端名不在四个之内 |
| `Unexpected: grammar rejected tokens ... Terminating request.` | 调度器更新输出时 | 采样结果没被文法接受，请求被终止 |

入口和编译阶段还应分开看：下面这些错误可能在产生第一个 token 以前发生；HTTP 包装的错误类型和文本前缀可不同，表中保留源码的关键片段。

| 关键报错 / 现象 | 固定基线里的原因 | 调整方法 |
|---|---|---|
| You must use one kind / You can only use one kind of structured outputs constraint | 六种约束全为 None，或超过一种非 None | 关闭时省略容器；启用时只给一种。检查 response_format 转换是否又加了第二种 |
| Choice … cannot be an empty list | choice=[] | 至少给一个有效候选字符串 |
| structured_outputs.grammar cannot be an empty string | grammar 为空串或全空白 | 给完整文法；xgrammar EBNF 的示例从 root 开始 |
| No valid structured output parameter found | 基线 json_object=false 被计作约束，却没有可选的有效类型 | 用 true；关闭时移除约束。v0.26、rc2、main 在更早位置明确拒绝 false |
| disable_any_whitespace is only supported … / disable_additional_properties is only supported … | 服务开关为 true，但 backend 不满足限制，包括 auto | 前者显式选 xgrammar/guidance；后者显式选 guidance |
| Invalid structural tag specification / Invalid response_format structural_tag specification | payload JSON、嵌套 format、旧 structures/schema/triggers 无法解析 | 核对对象与字符串入口、schema 别名和所选后端，不只检查 type 字段 |
| 请求辅助开关改了却不生效 | 请求的两个 disable_* 与 whitespace_pattern 没进入编译调用 | 格式开关放服务配置；逐请求的字段限制写在 schema 中 |
| LM Format Enforcer backend does not support speculative tokens | 编译器看到正的草稿数；本部署 MTP=3 | 不把该后端直接套到当前 MTP 配方；换后端前核对对应能力 |

rc2/main 还在前置校验拒绝空 JSON schema 字符串、json_object=false、含 NUL 字符的正则，以及扩散语言模型的结构化输出请求。HTTP Chat/Completion 的 response_format 与 structured_outputs 两个入口都会先校验结构标签 payload，把无效标签识别为请求问题；不能把这些新版拒绝阶段当成旧基线已有行为。工具请求接受了 strict 但没产生约束时，应依次核对解析器模型格式、环境开关、选择方式和本工具字段，不靠重复传 strict 改变后端能力。

“服务接受了后端名”也不等于该后端支持所有约束。固定基线的编译分支如下；上层校验有时比这里宽松，因此不以请求解析成功作为支持证明。

| 后端 | JSON schema | json_object | choice / regex | grammar / structural tag |
|---|---|---|---|---|
| xgrammar | 有，受关键字支持限制 | 有 | 有；choice 转文法 | 有；Lark 先转 EBNF，标签可走新/旧路径 |
| guidance | 有，受关键字支持限制 | 有 | 有 | 有；标签消费旧 structures/triggers |
| outlines | 有 | 没有 JSON_OBJECT 编译分支 | 有 | 两者都没有编译分支 |
| lm-format-enforcer | 有 | 有 | 有 | 两者都没有编译分支；另外不支持正草稿数 |

### 开销和什么时候别开

开销分五处：CPU 编译文法（首次出现的 schema 最明显，缓存命中后很小）；EngineCore 主线程每步串行填 bitmask，本部署在开了 MTP 时每个请求填 4 行；昇腾 V1 每张卡整张 logits 往返 CPU；MTP 草稿被文法截短后，一步多推进的 token 变少；异步调度下整批采样要等上一步结果处理完才发出，同批不带约束的请求一起等。这几项在固定部署上各花多少时间都没有实测数，只能定性判断：受约束的请求越多、schema 越复杂，EngineCore 填表越可能比前向慢，采样就要等；批越大，V1 的 logits 往返越重。

不需要机器解析的输出，不要开；只是希望"大致像 JSON"，用提示词加事后校验更便宜。要约束最终答案又希望模型先思考，需要配 reasoning parser，否则思考段也会被约束。auto 下 schema 特性不统一的服务，先显式固定后端，免得被昇腾的单后端检查拒掉。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；**本文 GLM-5.3-Flash 双机算例沿用例外 B 专用镜像钉点 `db701c1f`（配套 `vllm@0fc695fc`），与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 的两处关键跃迁：上游统一约束起点并传递完整停止集合，昇腾 `main` 全量切入 V2 NPU 原地 Triton 快路径。** `v0.30.0` 配套 `vllm@ced6857a` 在 `StructuredOutputManager` 中统一计算从哪个草稿 token 起施加 grammar（先去 `-1` padding、保留推理前缀、遇拒绝不再越界推进并最终 rollback），且将 `all_stop_token_ids` 传入 `xgrammar` 编译入口覆盖 matcher 停止集合；昇腾侧 `v0.30.0` 仍默认 V1 CPU 往返慢路径（`VLLM_USE_V2_MODEL_RUNNER=1` 才开 V2 Triton kernel），到 `main`（`8d6180e2`）已删除 `model_runner_v1.py` 并通过 `patch_use_v2_model_runner.py` 固定启用 V2，使 `vllm_ascend/ops/triton/apply_grammar_bitmask.py` 成为默认在 NPU 上原地施加 bitmask 的快路径，同时在 `patch_structured_output.py#L160-L202` 新增 `_patch_xgrammar_disable_any_whitespace()` 强制 `separators=None` 以规避 `xgrammar 0.2.7/0.2.8` 在 `disable_any_whitespace=True` 下的逗号循环截断问题。Recipe 段落仅核对独立库 `935817c6` 的 `OutputConstraint` 选择与调用方职责。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 昇腾 bitmask 施加路径（慢路径 vs 快路径） | 默认 V1：整张 logits NPU→CPU(BF16)→FP32 改写→CPU→NPU(FP32)；V2 Triton kernel 在 `worker/v2/structured_outputs.py`，默认不选 | 同 `v0.23.0` | 默认仍为 V1 CPU 往返（`model_runner_v1.py#L2803-L2810`）；V2 Triton 快路径迁至 `ops/triton/v2/apply_grammar_bitmask.py#L28-L133`（由 `VLLM_USE_V2_MODEL_RUNNER` 控制，默认关） | 移除 V1，全量锁定 V2（`patch_use_v2_model_runner.py#L1-L7`），默认走 NPU 原地 Triton 快路径（`ops/triton/apply_grammar_bitmask.py#L28-L129`、`worker/v2/model_runner.py#L1205-L1218`） |
| 昇腾平台补丁（单后端 / 兼容性） | 单后端拒绝补丁（与 `db701c1f` 同文件） | 单后端补丁 + 替换 `grammar_bitmask`/`should_advance` 适配思考边界 | 单后端补丁 + 修正 `outlines` 终态接受结束编号（`patch_structured_output.py#L20-L163`） | 延续单后端与 `outlines` 修正；新增 `_patch_xgrammar_disable_any_whitespace()` 强制 `separators=None`（`#L160-L202`） |
| `xgrammar` / `guidance` 控制流与停止集合 | 并行填表门槛 128 且要求无草稿；不传请求停止集合给 `xgrammar` matcher | 相同；正则增编译超时保护；前置拒绝 `json_object=false` 与空白 JSON 串 | 统一约束起点计算（取代旧 `should_fill_bitmask`/`should_advance`）；传 `all_stop_token_ids` 覆盖 matcher 停止集合；前置拒绝含 NUL 正则与无效标签 payload | 延续 `v0.30.0` 契约与四后端配置（`vllm/config/structured_outputs.py#L20-L75`、`vllm/v1/structured_output/__init__.py#L51-L120`、`#L387-L445`） |
| `response_format` / `structured_outputs` 协议与辅助开关 | Chat/Completion 均默认 `None`；6 类约束恰选 1 种；请求侧 `disable_any_whitespace`/`disable_additional_properties`/`whitespace_pattern` 未进入编译，须在服务配置设置；`VLLM_XGRAMMAR_CACHE_MB=512` | 公共转换抽到 `engine/protocol`；服务限制与请求辅助字段行为不变 | 协议迁至 `generate/base/protocol`；互斥报错用 `VLLMValidationError`；服务开关 `disable_any_whitespace`（仅 `xgrammar`/`guidance`）与 `disable_additional_properties`（仅 `guidance`）限制不变 | 同 `v0.30.0` |
| 工具 `function.strict` 与 `glm47` | 未显式声明 `strict`；`VLLM_ENFORCE_STRICT_TOOL_CALLING` 默认 `0`；旧 `glm47` 继承 `glm4`、无结构标签入口 | 显式 `strict: bool \| None`；环境开关默认 `True`；`glm47` 改用 adapter 声明 `glm_4_7` 结构标签，`auto` 需至少一个 `strict=True` | 同 `v0.26.0rc`；既有结构标签不被通用 JSON 覆盖 | 同 `v0.30.0` |

XGrammar 新 `format`、词表补位（154856–154879 共 24 项空槽）与结束集合分别按 `v0.2.0` 固定提交 `5433fdbe` 的实际消费者解释；基线依赖为 `>=0.2.0,<1.0.0`，升级 XGrammar 后仍需验证实际 schema。四版均保留四后端能力边界及 `lm-format-enforcer` 不支持正草稿数的限制。

### 源码位置

- `v0.30.0` 与 `main` 昇腾快慢路径及补丁：`vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2803-L2810`（V1 CPU 往返）、`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L1090-L1100` 与 `ops/triton/v2/apply_grammar_bitmask.py#L28-L133`（V2 NPU Triton）、`vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1205-L1218` 与 `ops/triton/apply_grammar_bitmask.py#L28-L129`（`main` 默认 V2 NPU Triton）、两版 `patch_structured_output.py` 与 `patch_use_v2_model_runner.py`；上游 `main` 见 `vllm@ba15685a:vllm/config/structured_outputs.py#L20-L75` 与 `vllm/v1/structured_output/__init__.py#L51-L120`、`#L387-L445`。
- Recipe 的 schema 验证、提示词渲染、工具约束优先选择与后端决定是否强制，见固定 README（来源第 42 条）。

按"谁定后端 → 谁编译 → 谁填表 → 谁施加 → 谁推进"读，能把本页流程对回实现。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 请求参数转换与后端选择 | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L579-L612`；`vllm@0fc695fc:vllm/sampling_params.py#L842-L972` |
| 单后端检查（昇腾补丁） | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L44-L134` |
| 管理器：线程池、编译、填表、思考边界 | `vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L39-L370` |
| 编译等待与约束类型 | `vllm@0fc695fc:vllm/v1/structured_output/request.py#L42-L98`；`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2205-L2210` |
| xgrammar 后端：词表大小、编译器、回滚 | `vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py#L36-L195` |
| 每步派发前向、填表、发起采样；异步推迟 | `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463`；`vllm@0fc695fc:vllm/v1/engine/core.py#L505-L596` |
| 整批"要等"标记；本部署异步调度的自动判定 | `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L35`（L27 对整批用或运算汇总）；`vllm@0fc695fc:vllm/config/vllm.py#L957-L1001`（MTP、未开 disable_padded_drafter_batch、多进程执行器 → 打开；启动日志 `Asynchronous scheduling is enabled.` 可直接确认） |
| 调度器挑行、推进文法、截断草稿 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1305-L1327`；`#L1462-L1475`；`#L1745-L1795` |
| 采样调用发给所有 worker | `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L319-L327` |
| worker 侧重排与施加 | `vllm@0fc695fc:vllm/v1/structured_output/utils.py#L44-L135`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2427` |
| V2 kernel 与 runner 选择 | `vllm-ascend@db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L19-L68`；`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20` |
| 收尾：停止检查、停止字符串中止 | `vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130`；`vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L681` |

**检索名称。** 管理器是 `StructuredOutputManager`，调度器入口是 `get_grammar_bitmask`，返回的 `GrammarOutput` 带请求 ID 列表和 `grammar_bitmask` 数组；worker 侧是 `sample_tokens` 里的 `apply_grammar_bitmask`，底层调用 xgrammar 的 `apply_token_bitmask_inplace`。编译等待的请求状态是 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR`；草稿截断用 `validate_tokens`，临时推进的回滚用 `rollback`。

**正文证据索引。** 官方命令、FAQ 的 glm45 配置与不能关思考见 [S1]；vllm-ascend 请求用法见 [S35]；教学词表的分数和 token 是示意 [A]。auto 与请求级后端校验见 [C18]，四个后端与单后端对象见 [C3]，昇腾检查见 [C27] 和来源 28；响应转换、工具派生约束、服务默认依次在来源 20、21、19。线程池、门槛与 external_launcher 见 [C2]；100 微秒见 [C6]，等待状态在来源 17。词表、编译线程、回滚见 [C7]，缓存默认在来源 36。每步派发见 [C10]，挑行规则在来源 14；分配、填表、临时推进与回滚见 [C4]。思考边界见 [C5]，glm45 映射在来源 22。采样发给全部 worker 见 [C23]，重排见 [C9]，V1 CPU 往返见 [C24]，V2 默认与 kernel 在来源 26、25。文法拒绝、草稿截断、异步推迟分别在来源 15、16、11；终态填全 1 在来源 4，不传结束编号在来源 7，停止检查和停止字符串在来源 40、41。原版本表对应来源 29–34、37–39，修订后的 enable_in_reasoning 解释另见来源 44–45。

**新增参数参考的来源。** 六类约束、互斥、前置校验见来源 46、18；HTTP 结构和别名见来源 47–49，完整 Chat 转换复用来源 20。请求辅助字段未进入编译可沿来源 54 → 7 / 52–53 / 59–60 核对；服务限制在来源 55，启动配置入口与 parser 回填在来源 56–58。guidance 的递归补值在来源 51，XGrammar 文法/正则/标签校验在来源 50。三版字段、默认与错误差异按来源 61–68；后端读取与消费按来源 69–76、83–86；缓存环境定义按来源 36、77–78；依赖范围在来源 79，新 format 的内容、标签与顶层结构在来源 80–82。Python LLM 字典转换与缺省配置在来源 87–90。此处引用源码证明配置与控制流，不冒充设备运行结果。

rc2 字段、默认、互斥与模型拒绝见来源 94–96；公共响应转换与 HTTP 标签前置校验见 97–103，99 同时核对固定 main 的标签校验。约束 key 与四个后端的实际编译消费者见 104–110，Python/CLI 配置、环境值和 parser 回填见 111–115。管理器的停止集合传递与填表见 116–117，推理起点复用 92–93。Ascend rc2 的 V1 往返、V2 选择、单后端与 outlines 修正、NPU kernel 见 118–121。官方示例的 README、离线调用、HTTP 参数解析和打包入口分别见 122–125；阅读示例不代表已经运行其中的模型。

XGrammar 的词表补位与缺省 EOS 读取见 126，空字符串与非空词的分类见 127–128；matcher 的停止覆盖、普通文本接受、填表和特殊编号屏蔽分别见 129–132。旧 vLLM 的调用复用来源 7，v0.26 见 133；rc2 的传递见 116/105，main 见 38/134。GLM 三个停止编号的加入见 135，调度器停止检查复用 40，模型原始文件在 136–138。129 中 max_rollback_tokens 已标为不使用的兼容参数，因此正文只把 3 作为本步临时草稿的回滚数，不将它当作该库的历史容量保证。

旧 glm47 的注册、继承、请求绕行、通用派生及真实调用见 139–143；旧严格环境默认、额外字段和 FunctionDefinition 见 144–146，Ascend 零参文本补丁见 147。v0.26、rc2、main 的工具注册、适配器、字段、环境与模型结构标签条件依次见 148–154、155–161、162–168；适配器交接、renderer 实际调用与已有标签保护见 169–171。这里只证明 vLLM 到模型格式构造器的条件与传递，不把所有外部模型模板都视为已验证。

正文算式的推导口径：

- bitmask 一行 4840 个整数、19,360 B，整块 128 行约 2.36 MiB，由词表 154880、请求上限 32、草稿数 3 按"每 32 个编号一个整数"推得。[D]
- logits 往返的 1.18 MiB 与 37.8 MiB 取自主线底稿 03 §A5 的 bf16 logits 大小，fp32 副本按每数 4 B 翻倍。[D]

**待核：**

- 缺固定部署上的实测：编译耗时、每步填 bitmask 耗时是否超过前向、V1 logits 往返耗时、结构化请求对 MTP 接受率的影响、实际格式正确率，本页只做定性描述。
- 缺部署镜像的库版本与原生运行结果：本页已按固定 XGrammar v0.2.0 和 GLM 文件说明 24 个空槽、缺省 EOS 与引擎停止集合的静态关系；仍需在实际安装环境打印 tokenizer 类型、`xgr.TokenizerInfo.from_huggingface(tok, vocab_size=154880)` 的 stop_token_ids/special_token_ids，并测试字符串未闭合时的候选掩码与停止结果。不能把静态条件当成实际选中概率或镜像版本确认。
- 缺官方命令下带 JSON schema 的实际输出：没有 reasoning parser 时思考段被约束，对答案质量的影响。
- 昇腾 V1 把 logits 搬到 CPU 施加 bitmask 的实际原因：源码注释说是上游用 torch.compile、昇腾不支持，但固定上游的 `apply_grammar_bitmask` 已不含 torch.compile（`vllm@0fc695fc:vllm/v1/structured_output/utils.py#L109-L135`）；需要确认 xgrammar 的 `apply_token_bitmask_inplace` 能否直接处理 NPU 张量。

- 来源 44：vllm@0fc695fc，vllm/v1/structured_output/__init__.py，L302–L318。
- 来源 45：vllm@0fc695fc，vllm/config/structured_outputs.py，L41–L42。
