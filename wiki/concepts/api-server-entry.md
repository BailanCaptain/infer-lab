---
id: api-server-entry
title: API server 入口：一个 HTTP 请求怎样变成引擎里的请求
type: concept
summary: >-
  vLLM 前端进程从收到 HTTP 请求到交给某个 EngineCore 之间做的事：检查、套聊天模板、分词、定输出上限和采样参数、包成
  EngineCoreRequest、先在本进程登记反分词器和输出槽，再选 DP 组经 ZMQ 发出。讲清每一步在哪里拒绝请求、流式与非流式的差别、CPU
  开销，以及 GLM 双机上 node0 一个前端接全部请求。
aliases:
  - API server 入口
  - prompt_embeds
  - enable_prompt_embeds
  - enable-prompt-embeds
  - 预计算嵌入输入
  - 多模态预处理
  - mm_processor_cache_gb
  - mm_processor_cache_type
  - multi_modal_uuids
  - enable_mm_embeds
  - image_embeds
  - media_io_kwargs
  - VLLM_MAX_EMBED_DECODE_BYTES
  - API server
  - 请求入口
  - 入口站
  - OpenAI 兼容接口
  - /v1/chat/completions
  - OpenAIServingChat
  - process_inputs
  - add_request
  - 套模板与分词入口
  - X-Request-Id
  - max_tokens
  - max tokens
  - max_completion_tokens
  - max completion tokens
  - 最大输出 token 数
  - 输出长度上限
  - max_model_len
  - max-model-len
  - 最大模型长度
  - 上下文总长度上限
  - model
  - 模型路径
  - served_model_name
  - served-model-name
  - '--served-model-name'
  - 对外模型名
  - frontend.host
  - 监听地址
  - '--host'
  - port
  - '--port'
  - config
  - '--config'
  - YAML 启动配置
  - chat_template_content_format
  - chat-template-content-format
  - '--chat-template-content-format'
  - trust_request_chat_template
  - trust-request-chat-template
  - '--trust-request-chat-template'
  - VLLM_HTTP_TIMEOUT_KEEP_ALIVE
  - HTTP 空闲连接保活
  - messages
  - prompt
  - enable_log_requests
  - '--enable-log-requests'
  - max_log_len
  - '--max-log-len'
  - uvicorn_log_level
  - '--uvicorn-log-level'
chapters:
  - '10'
order: 85
sources:
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L40-L75'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L192-L392'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L497-L937'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L938-L964'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L211-L238'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L387-L412'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L183-L266'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L452-L471'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L521-L568'
  - 'vllm@0fc695fc:vllm/renderers/base.py#L84-L155'
  - 'vllm@0fc695fc:vllm/renderers/base.py#L338-L360'
  - 'vllm@0fc695fc:vllm/renderers/base.py#L1018-L1056'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L876-L878'
  - 'vllm@0fc695fc:vllm/utils/async_utils.py#L24-L50'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L186-L194'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L415-L435'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L290-L296'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L503-L520'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L634-L639'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L60-L100'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L155-L170'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L25-L60'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L534-L540'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L206'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L414'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L524-L600'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L690'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L223-L385'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L387-L484'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L45-L92'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L512-L541'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L600-L612'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1360'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L341-L377'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L819-L841'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1518-L1543'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1801-L1823'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/error_response.py#L16-L50'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L99-L148'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/server_utils.py#L327-L445'
  - 'vllm@0fc695fc:vllm/entrypoints/launcher.py#L168-L178'
  - 'vllm@0fc695fc:vllm/v1/engine/parallel_sampling.py#L52-L94'
  - 'vllm@0fc695fc:vllm/utils/async_utils.py#L90-L110'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L262-L292'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L416-L430'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L354-L391'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L147-L185'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L291-L305'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L199-L218'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/__init__.py#L200-L260'
  - 'vllm@568afb3a:vllm/renderers/base.py#L87-L100'
  - 'vllm@568afb3a:vllm/renderers/online_renderer.py#L95-L120'
  - 'vllm@98dff2a8:vllm/renderers/base.py#L92-L107'
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/README.md
  - >-
    raw:sha256-bfcb53253d20e108bc1d7bfd9f03e6a2fc81b9583c5a2c716b03a18030b6b3bf.md#L1-L2727
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/entrypoints/openai/chat_completion/serving.py#L206-L217
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/entrypoints/openai/chat_completion/serving.py#L294-L325
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L195-L205'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L151-L157'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L77-L83'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L279-L346'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L339-L344'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L509-L512'
  - 'vllm@568afb3a:vllm/entrypoints/serve/utils/api_utils.py#L170-L206'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L205-L215'
  - 'vllm@84030bbe:vllm/entrypoints/serve/utils/api_utils.py#L169-L205'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L222-L232'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L56-L85'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L56-L81'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L251-L265'
  - 'vllm@0fc695fc:vllm/config/model.py#L190-L202'
  - 'vllm@0fc695fc:vllm/config/model.py#L2112-L2249'
  - 'vllm@0fc695fc:vllm/config/model.py#L760-L796'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L27-L88'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L342-L366'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1850-L1910'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2013-L2057'
  - 'vllm@568afb3a:vllm/config/model.py#L2152-L2289'
  - 'vllm@84030bbe:vllm/config/model.py#L2393-L2537'
  - 'vllm@568afb3a:vllm/v1/core/kv_cache_utils.py#L1930-L1990'
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_utils.py#L2415-L2475'
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_utils.py#L2607-L2640'
  - 'vllm@568afb3a:vllm/utils/argparse_utils.py#L29-L90'
  - 'vllm@84030bbe:vllm/utils/argparse_utils.py#L29-L90'
  - 'vllm@0fc695fc:vllm/config/model.py#L1722-L1746'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L75-L103'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L225-L242'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L341-L395'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L245-L307'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L443-L590'
  - 'vllm@0fc695fc:vllm/config/model.py#L110-L161'
  - 'vllm@0fc695fc:vllm/config/model.py#L263-L275'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L45-L105'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/models/serving.py#L30-L70'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L513-L591'
  - 'vllm@568afb3a:vllm/entrypoints/openai/cli_args.py#L75-L250'
  - 'vllm@568afb3a:vllm/utils/argparse_utils.py#L450-L590'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/cli_args.py#L75-L260'
  - 'vllm@84030bbe:vllm/utils/argparse_utils.py#L450-L611'
  - 'vllm@568afb3a:vllm/config/model.py#L110-L290'
  - 'vllm@84030bbe:vllm/config/model.py#L125-L310'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L536-L555'
  - 'vllm@84030bbe:vllm/renderers/hf.py#L626-L659'
  - 'vllm@0fc695fc:vllm/envs.py#L1029-L1030'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L582-L641'
  - 'https://uvicorn.dev/settings/#timeouts'
  - 'vllm@568afb3a:vllm/envs.py#L1085-L1086'
  - 'vllm@84030bbe:vllm/envs.py#L1141-L1142'
  - 'vllm@568afb3a:vllm/entrypoints/openai/api_server.py#L680-L735'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/api_server/entry.py#L144-L155'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/render/entry.py#L46-L58'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L185-L205'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L44-L60'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L445-L462'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/request_logger.py#L17-L100'
  - 'vllm@568afb3a:vllm/entrypoints/serve/utils/request_logger.py#L17-L100'
  - 'vllm@84030bbe:vllm/entrypoints/serve/utils/request_logger.py#L17-L100'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2570-L2600'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L334-L350'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L195-L210'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L200-L230'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L44-L65'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L44-L65'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/cli_args.py#L268-L278'
  - 'vllm@ced6857a:vllm/v1/engine/admission_control.py#L13-L52'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L297-L343'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L213-L239'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L46-L67'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/api_utils.py#L169-L205'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L170-L178'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L310-L319'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/serving.py#L79-L87'
  - 'vllm@ced6857a:vllm/config/model.py#L125-L310'
  - 'vllm@ced6857a:vllm/config/model.py#L920-L960'
  - 'vllm@ced6857a:vllm/config/model.py#L2393-L2544'
  - 'vllm@ced6857a:vllm/utils/argparse_utils.py#L29-L92'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2511-L2572'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2703-L2742'
  - 'vllm@ced6857a:vllm/utils/argparse_utils.py#L462-L611'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L75-L157'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L256-L280'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L626-L658'
  - 'vllm@ced6857a:vllm/renderers/online_renderer.py#L579-L598'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/request_logger.py#L17-L104'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2996-L3022'
  - 'vllm@ced6857a:vllm/envs.py#L1117-L1119'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L144-L155'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/render/entry.py#L46-L58'
  - 'vllm@ced6857a:vllm/config/model.py#L375-L384'
  - 'vllm@ced6857a:vllm/renderers/base.py#L109-L127'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L262-L279'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L507-L527'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/app_state.py#L49-L61'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L369-L386'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L617-L635'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L354-L378'
  - 'vllm@ced6857a:vllm/config/model.py#L2007-L2031'
  - 'vllm@ced6857a:vllm/renderers/online_renderer.py#L197-L233'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L418-L423'
  - 'vllm@ced6857a:vllm/renderers/params.py#L327-L352'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L19-L45'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L19-L44'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_tool_choice_none_content.py#L1-L87'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/__init__.py#L19-L42'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_recompute_chat.py#L1-L32'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/recompute_proxy.py#L139-L154'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L19-L39'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/__init__.py#L19-L54'
  - 'vllm@0fc695fc:docs/features/prompt_embeds.md#L1-L79'
  - 'vllm@0fc695fc:vllm/renderers/embed_utils.py#L1-L83'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L1150-L1192'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L324-L354'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L473-L488'
  - 'vllm@0fc695fc:docs/features/multimodal_inputs.md#L443-L544'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L963-L1023'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3566-L3571'
  - 'vllm@84030bbe:vllm/renderers/base.py#L108-L127'
  - 'vllm@84030bbe:vllm/v1/engine/input_processor.py#L261-L279'
  - 'vllm@84030bbe:vllm/v1/engine/async_llm.py#L499-L512'
  - 'vllm@568afb3a:vllm/renderers/hf.py#L1234-L1275'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L1327-L1368'
  - 'vllm@84030bbe:vllm/renderers/hf.py#L1327-L1368'
  - 'vllm@568afb3a:vllm/renderers/embed_utils.py#L1-L82'
  - 'vllm@ced6857a:vllm/renderers/embed_utils.py#L1-L80'
  - 'vllm@84030bbe:vllm/renderers/embed_utils.py#L1-L80'
  - 'vllm@568afb3a:vllm/utils/sparse_utils.py#L1-L27'
  - 'vllm@ced6857a:vllm/utils/sparse_utils.py#L1-L73'
  - 'vllm@84030bbe:vllm/utils/sparse_utils.py#L1-L73'
  - 'vllm@ced6857a:vllm/envs.py#L1018-L1024'
  - 'vllm@84030bbe:vllm/envs.py#L1031-L1037'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L300-L322'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L80-L91'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/error_response.py#L42-L64'
  - "vllm@0fc695fc:vllm/config/multimodal.py#L97-L143"
  - "vllm@0fc695fc:vllm/multimodal/processing/processor.py#L1214-L1334"
  - "vllm@0fc695fc:vllm/multimodal/processing/processor.py#L1343-L1511"
  - "vllm@0fc695fc:vllm/multimodal/processing/processor.py#L1528-L1710"
  - "vllm@0fc695fc:vllm/transformers_utils/processor.py#L569-L605"
  - "vllm@0fc695fc:vllm/renderers/base.py#L621-L724"
  - "vllm@0fc695fc:vllm/multimodal/processing/inputs.py#L1-L71"
  - "vllm@0fc695fc:vllm/multimodal/registry.py#L268-L354"
  - "vllm@568afb3a:vllm/multimodal/processing/processor.py#L1214-L1334"
  - "vllm@568afb3a:vllm/multimodal/registry.py#L268-L354"
  - "vllm@ced6857a:vllm/multimodal/processing/processor.py#L1167-L1307"
  - "vllm@ced6857a:vllm/multimodal/processing/inputs.py#L1-L107"
  - "vllm@ced6857a:vllm/multimodal/registry.py#L283-L369"
  - "vllm@ced6857a:vllm/renderers/base.py#L818-L850"
  - "vllm@84030bbe:vllm/renderers/base.py#L818-L848"
  - "vllm@0fc695fc:docs/design/mm_processing.md#L1-L63"
  - "vllm@0fc695fc:docs/features/multimodal_inputs.md#L1-L1194"
  - "vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L374-L408"
  - "vllm@0fc695fc:vllm/model_executor/models/utils.py#L471-L506"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L3433-L3460"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L3041-L3086"
  - "vllm@568afb3a:vllm/config/multimodal.py#L97-L143"
  - "vllm@ced6857a:vllm/config/multimodal.py#L110-L163"
  - "vllm@84030bbe:vllm/config/multimodal.py#L119-L176"
  - "vllm@568afb3a:vllm/renderers/base.py#L699-L724"
  - "vllm@0fc695fc:vllm/engine/arg_utils.py#L1212-L1233"
  - "vllm@0fc695fc:vllm/envs.py#L909-L920"
  - "vllm@568afb3a:vllm/envs.py#L930-L941"
  - "vllm@ced6857a:vllm/envs.py#L947-L958"
  - "vllm@84030bbe:vllm/envs.py#L960-L971"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen2_vl.py#L1202-L1277"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L2706-L2786"
  - "vllm@0fc695fc:vllm/multimodal/audio.py#L45-L161"
  - "vllm@0fc695fc:vllm/multimodal/audio.py#L294-L404"
  - "vllm@0fc695fc:vllm/multimodal/parse.py#L560-L597"
  - "vllm@0fc695fc:vllm/multimodal/video.py#L223-L326"
  - "vllm@0fc695fc:vllm/multimodal/media/connector.py#L371-L384"
  - "vllm@0fc695fc:vllm/multimodal/media/connector.py#L401-L424"
  - "vllm@0fc695fc:vllm/multimodal/media/connector.py#L451-L475"
  - "vllm@568afb3a:vllm/multimodal/audio.py#L325-L440"
  - "vllm@568afb3a:vllm/multimodal/parse.py#L567-L604"
  - "vllm@568afb3a:vllm/multimodal/video.py#L314-L417"
  - "vllm@ced6857a:vllm/multimodal/audio.py#L395-L517"
  - "vllm@ced6857a:vllm/multimodal/parse.py#L673-L715"
  - "vllm@ced6857a:vllm/multimodal/video_decoders/opencv.py#L125-L228"
  - "vllm@84030bbe:vllm/multimodal/parse.py#L671-L713"
  - "vllm@0fc695fc:vllm/connections.py#L108-L194"
  - "vllm@0fc695fc:vllm/connections.py#L278-L305"
  - "vllm@0fc695fc:vllm/entrypoints/speech_to_text/base/serving.py#L190-L274"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen2_vl.py#L774-L840"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L2040-L2113"
  - "vllm@0fc695fc:vllm/model_executor/models/minicpmv.py#L454-L486"
  - "vllm@0fc695fc:vllm/model_executor/models/minicpmv.py#L584-L650"
  - "vllm@0fc695fc:vllm/model_executor/models/qwen2_audio.py#L163-L176"
  - "vllm@0fc695fc:vllm/model_executor/models/whisper.py#L656-L678"
  - "vllm@0fc695fc:vllm/multimodal/video.py#L531-L592"
  - "vllm@568afb3a:vllm/multimodal/video.py#L989-L1100"
  - "vllm@ced6857a:vllm/multimodal/video.py#L240-L310"
  - "vllm@84030bbe:vllm/multimodal/video.py#L232-L298"
  - "vllm@ced6857a:vllm/multimodal/video_decoders/__init__.py#L78-L107"
  - "vllm@ced6857a:vllm/multimodal/video_decoders/opencv.py#L282-L316"
  - "vllm@0fc695fc:vllm/multimodal/media/video.py#L42-L72"
  - "vllm@0fc695fc:vllm/multimodal/media/connector.py#L128-L235"
  - "vllm@0fc695fc:vllm/multimodal/media/connector.py#L286-L369"
  - "vllm@0fc695fc:vllm/envs.py#L920-L932"
  - "vllm@568afb3a:vllm/multimodal/media/connector.py#L190-L297"
  - "vllm@568afb3a:vllm/multimodal/media/connector.py#L348-L443"
  - "vllm@568afb3a:vllm/envs.py#L941-L953"
  - "vllm@ced6857a:vllm/multimodal/media/connector.py#L204-L311"
  - "vllm@ced6857a:vllm/multimodal/media/connector.py#L366-L465"
  - "vllm@ced6857a:vllm/envs.py#L958-L970"
  - "vllm@84030bbe:vllm/multimodal/media/connector.py#L204-L311"
  - "vllm@84030bbe:vllm/multimodal/media/connector.py#L366-L465"
  - "vllm@84030bbe:vllm/envs.py#L971-L983"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L218-L232"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L228-L242"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L245-L259"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L245-L259"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L473-L501"
  - "vllm@0fc695fc:vllm/renderers/params.py#L28-L40"
  - "vllm@0fc695fc:vllm/renderers/params.py#L90-L118"
  - "vllm@0fc695fc:vllm/renderers/hf.py#L641-L669"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L529-L558"
  - "vllm@568afb3a:vllm/renderers/params.py#L28-L40"
  - "vllm@568afb3a:vllm/renderers/params.py#L93-L122"
  - "vllm@568afb3a:vllm/renderers/hf.py#L633-L661"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L580-L615"
  - "vllm@ced6857a:vllm/renderers/params.py#L40-L52"
  - "vllm@ced6857a:vllm/renderers/params.py#L111-L142"
  - "vllm@ced6857a:vllm/renderers/hf.py#L709-L737"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L580-L615"
  - "vllm@84030bbe:vllm/renderers/params.py#L40-L52"
  - "vllm@84030bbe:vllm/renderers/params.py#L111-L142"
  - "vllm@84030bbe:vllm/renderers/hf.py#L709-L737"
  - "vllm@0fc695fc:vllm/entrypoints/cli/launch.py#L112-L144"
  - "vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L420-L481"
  - "vllm@568afb3a:vllm/entrypoints/cli/launch.py#L112-L144"
  - "vllm@568afb3a:vllm/entrypoints/openai/api_server.py#L481-L570"
  - "vllm@ced6857a:vllm/entrypoints/launchers/render/entry.py#L66-L98"
  - "vllm@ced6857a:vllm/entrypoints/launchers/render/app_state.py#L22-L108"
  - "vllm@84030bbe:vllm/entrypoints/launchers/render/entry.py#L66-L98"
  - "vllm@84030bbe:vllm/entrypoints/launchers/render/app_state.py#L22-L108"
  - "vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L201-L226"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/factories.py#L61-L78"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/factories.py#L65-L94"
  - "vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L179-L191"
  - "vllm@84030bbe:vllm/entrypoints/scale_out/factories.py#L66-L102"
  - "vllm@84030bbe:vllm/envs.py#L358-L364"
  - "vllm@84030bbe:vllm/envs.py#L1883-L1885"
  - "vllm@0fc695fc:vllm/entrypoints/serve/render/api_router.py#L24-L75"
  - "vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L118-L181"
  - "vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L268-L322"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/render/serving.py#L64-L150"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/render/serving.py#L152-L209"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/render/serving.py#L78-L164"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/render/serving.py#L181-L238"
  - "vllm@84030bbe:vllm/entrypoints/scale_out/render/serving.py#L78-L164"
  - "vllm@84030bbe:vllm/entrypoints/scale_out/render/serving.py#L181-L238"
  - "vllm@0fc695fc:vllm/entrypoints/serve/disagg/serving.py#L100-L238"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/derender/api_router.py#L26-L73"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/token_in_token_out/protocol.py#L258-L332"
  - "vllm@568afb3a:vllm/entrypoints/scale_out/derender/serving.py#L121-L238"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/derender/api_router.py#L31-L126"
  - "vllm@ced6857a:vllm/renderers/online_derenderer.py#L271-L324"
  - "vllm@84030bbe:vllm/entrypoints/scale_out/derender/api_router.py#L31-L126"
  - "vllm@84030bbe:vllm/renderers/online_derenderer.py#L271-L324"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/token_in_token_out/protocol.py#L402-L476"
  - "vllm@ced6857a:vllm/entrypoints/scale_out/token_in_token_out/protocol.py#L548-L621"
  - "vllm@0fc695fc:vllm/tool_parsers/abstract_tool_parser.py#L211-L366"
  - "vllm@0fc695fc:vllm/utils/import_utils.py#L85-L101"
  - "vllm@568afb3a:vllm/tool_parsers/abstract_tool_parser.py#L223-L378"
  - "vllm@568afb3a:vllm/utils/import_utils.py#L85-L101"
  - "vllm@ced6857a:vllm/tool_parsers/abstract_tool_parser.py#L222-L370"
  - "vllm@ced6857a:vllm/utils/import_utils.py#L106-L122"
  - "vllm@84030bbe:vllm/tool_parsers/abstract_tool_parser.py#L222-L370"
  - "vllm@84030bbe:vllm/utils/import_utils.py#L106-L122"
  - "vllm@ced6857a:vllm/utils/import_utils.py#L85-L103"
  - "vllm@84030bbe:vllm/utils/import_utils.py#L85-L103"
  - "vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L108-L122"
  - "vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L499-L534"
  - "vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L668-L677"
  - "vllm@568afb3a:vllm/entrypoints/openai/api_server.py#L594-L628"
  - "vllm@568afb3a:vllm/entrypoints/openai/api_server.py#L762-L771"
  - "vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L179-L188"
  - "vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L236-L269"
  - "vllm@84030bbe:vllm/entrypoints/launchers/api_server/entry.py#L179-L188"
  - "vllm@84030bbe:vllm/entrypoints/launchers/launcher.py#L236-L269"
  - "vllm@0fc695fc:docs/features/tool_calling.md#L1-L570"
  - "vllm@0fc695fc:examples/tool_chat_template_deepseekr1.jinja#L1-L92"
  - "vllm@0fc695fc:examples/tool_chat_template_deepseekv3.jinja#L1-L96"
  - "vllm@0fc695fc:examples/tool_chat_template_deepseekv31.jinja#L1-L91"
  - "vllm@0fc695fc:examples/tool_chat_template_functiongemma.jinja#L1-L54"
  - "vllm@0fc695fc:examples/tool_chat_template_llama3.1_json.jinja#L1-L120"
  - "vllm@0fc695fc:examples/tool_chat_template_llama3.2_json.jinja#L1-L133"
  - "vllm@0fc695fc:examples/tool_chat_template_llama3.2_pythonic.jinja#L1-L98"
  - "vllm@0fc695fc:examples/tool_chat_template_llama4_pythonic.jinja#L1-L111"
  - "vllm@0fc695fc:examples/tool_chat_template_mistral.jinja#L1-L86"
  - "vllm@0fc695fc:examples/tool_chat_template_mistral_parallel.jinja#L1-L93"
  - vllm@0fc695fc:vllm/entrypoints/serve/sagemaker/api_router.py#L31-L99
  - vllm@0fc695fc:vllm/entrypoints/generate/factories.py#L16-L42
  - vllm@0fc695fc:vllm/entrypoints/pooling/factories.py#L104-L134
  - vllm@0fc695fc:vllm/entrypoints/pooling/factories.py#L137-L211
  - vllm@0fc695fc:vllm/entrypoints/pooling/factories.py#L214-L265
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/factories.py#L21-L37
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/serving.py#L154-L248
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/serving.py#L285-L316
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/serving.py#L331-L371
  - vllm@0fc695fc:vllm/entrypoints/anthropic/serving.py#L124-L137
  - vllm@0fc695fc:vllm/entrypoints/anthropic/serving.py#L474-L498
  - vllm@0fc695fc:vllm/entrypoints/anthropic/protocol.py#L117-L159
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/base/serving.py#L91-L131
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/base/serving.py#L191-L271
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/base/serving.py#L378-L424
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/realtime/connection.py#L44-L54
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/realtime/connection.py#L95-L160
  - vllm@0fc695fc:vllm/envs.py#L952-L954
  - vllm@0fc695fc:vllm/envs.py#L1752-L1754
  - vllm@568afb3a:vllm/entrypoints/serve/sagemaker/api_router.py#L30-L98
  - vllm@568afb3a:vllm/entrypoints/generate/factories.py#L16-L42
  - vllm@568afb3a:vllm/entrypoints/pooling/factories.py#L104-L134
  - vllm@568afb3a:vllm/entrypoints/pooling/factories.py#L137-L211
  - vllm@568afb3a:vllm/entrypoints/pooling/factories.py#L214-L265
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/factories.py#L21-L37
  - vllm@568afb3a:vllm/entrypoints/openai/responses/serving.py#L151-L243
  - vllm@568afb3a:vllm/entrypoints/openai/responses/serving.py#L295-L326
  - vllm@568afb3a:vllm/entrypoints/openai/responses/serving.py#L341-L381
  - vllm@568afb3a:vllm/entrypoints/anthropic/serving.py#L194-L218
  - vllm@568afb3a:vllm/entrypoints/anthropic/serving.py#L587-L614
  - vllm@568afb3a:vllm/entrypoints/anthropic/protocol.py#L118-L166
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/base/serving.py#L94-L151
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/base/serving.py#L256-L309
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/base/serving.py#L416-L462
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/realtime/connection.py#L45-L55
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/realtime/connection.py#L96-L161
  - vllm@568afb3a:vllm/envs.py#L973-L975
  - vllm@568afb3a:vllm/envs.py#L1745-L1747
  - vllm@ced6857a:vllm/entrypoints/serve/sagemaker/api_router.py#L30-L98
  - vllm@ced6857a:vllm/entrypoints/generate/factories.py#L16-L42
  - vllm@ced6857a:vllm/entrypoints/pooling/factories.py#L110-L140
  - vllm@ced6857a:vllm/entrypoints/pooling/factories.py#L143-L217
  - vllm@ced6857a:vllm/entrypoints/pooling/factories.py#L220-L271
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/factories.py#L21-L37
  - vllm@ced6857a:vllm/entrypoints/openai/responses/serving.py#L96-L188
  - vllm@ced6857a:vllm/entrypoints/openai/responses/serving.py#L240-L271
  - vllm@ced6857a:vllm/entrypoints/openai/responses/serving.py#L313-L349
  - vllm@ced6857a:vllm/entrypoints/anthropic/serving.py#L193-L217
  - vllm@ced6857a:vllm/entrypoints/anthropic/serving.py#L591-L618
  - vllm@ced6857a:vllm/entrypoints/anthropic/protocol.py#L121-L191
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L97-L154
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L261-L314
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L421-L479
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/realtime/connection.py#L45-L55
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/realtime/connection.py#L96-L161
  - vllm@ced6857a:vllm/envs.py#L997-L999
  - vllm@ced6857a:vllm/envs.py#L1842-L1844
  - vllm@84030bbe:vllm/entrypoints/serve/sagemaker/api_router.py#L30-L98
  - vllm@84030bbe:vllm/entrypoints/generate/factories.py#L16-L42
  - vllm@84030bbe:vllm/entrypoints/pooling/factories.py#L110-L140
  - vllm@84030bbe:vllm/entrypoints/pooling/factories.py#L143-L217
  - vllm@84030bbe:vllm/entrypoints/pooling/factories.py#L220-L271
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/factories.py#L21-L37
  - vllm@84030bbe:vllm/entrypoints/openai/responses/serving.py#L96-L188
  - vllm@84030bbe:vllm/entrypoints/openai/responses/serving.py#L240-L271
  - vllm@84030bbe:vllm/entrypoints/openai/responses/serving.py#L313-L349
  - vllm@84030bbe:vllm/entrypoints/anthropic/serving.py#L193-L217
  - vllm@84030bbe:vllm/entrypoints/anthropic/serving.py#L591-L618
  - vllm@84030bbe:vllm/entrypoints/anthropic/protocol.py#L121-L191
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/base/serving.py#L97-L154
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/base/serving.py#L261-L314
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/base/serving.py#L421-L479
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/realtime/connection.py#L45-L55
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/realtime/connection.py#L96-L161
  - vllm@84030bbe:vllm/envs.py#L1010-L1012
  - vllm@84030bbe:vllm/envs.py#L1871-L1873
  - vllm@0fc695fc:docs/serving/online_serving/README.md#L1-L212
  - vllm@0fc695fc:docs/serving/online_serving/openai_compatible_server.md#L1-L193
  - vllm@0fc695fc:docs/serving/online_serving/speech_to_text.md#L1-L189
  - vllm@0fc695fc:examples/ray_serving/ray_serve_deepseek.py#L1-L55
  - vllm@0fc695fc:examples/tool_calling/openai_responses_client_with_tools.py#L1-L82
  - vllm@0fc695fc:examples/basic/online_serving/openai_completion_client.py#L1-L53
  - vllm@0fc695fc:examples/basic/online_serving/openai_chat_completion_client.py#L1-L64
  - vllm@0fc695fc:examples/speech_to_text/openai/openai_transcription_client.py#L1-L197
  - vllm@0fc695fc:examples/speech_to_text/openai/openai_translation_client.py#L1-L81
  - vllm@0fc695fc:examples/speech_to_text/realtime/openai_realtime_client.py#L1-L150
  - vllm@0fc695fc:examples/speech_to_text/realtime/openai_realtime_microphone_client.py#L1-L183
  - vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L72-L200
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L238-L423
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/protocol.py#L136-L286
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/protocol.py#L601-L670
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/protocol.py#L436-L446
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/transcription/protocol.py#L55-L184
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/translation/protocol.py#L53-L142
  - vllm@0fc695fc:vllm/entrypoints/anthropic/protocol.py#L34-L223
  - vllm@0fc695fc:vllm/entrypoints/anthropic/serving.py#L474-L550
  - vllm@0fc695fc:vllm/entrypoints/pooling/pooling/protocol.py#L26-L118
  - vllm@0fc695fc:vllm/entrypoints/pooling/embed/protocol.py#L31-L85
  - vllm@0fc695fc:vllm/entrypoints/pooling/classify/protocol.py#L25-L69
  - vllm@0fc695fc:vllm/entrypoints/pooling/scoring/protocol.py#L84-L187
  - vllm@0fc695fc:vllm/entrypoints/pooling/base/protocol.py#L155-L173
  - vllm@0fc695fc:vllm/entrypoints/pooling/base/serving.py#L40-L180
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/api_router.py#L1-L128
  - vllm@0fc695fc:vllm/entrypoints/anthropic/api_router.py#L1-L136
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/transcription/api_router.py#L1-L60
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/translation/api_router.py#L1-L60
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/transcription/serving.py#L1-L99
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/translation/serving.py#L1-L99
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/realtime/api_router.py#L1-L39
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/realtime/protocol.py#L1-L68
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/realtime/connection.py#L1-L288
  - vllm@0fc695fc:vllm/entrypoints/speech_to_text/base/serving.py#L378-L628
  - vllm@568afb3a:examples/ray_serving/ray_serve_deepseek.py#L1-L55
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/base/utils.py#L1-L64
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/base/serving.py#L163-L203
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/transcription/api_router.py#L42-L61
  - vllm@568afb3a:vllm/entrypoints/speech_to_text/translation/api_router.py#L42-L61
  - vllm@568afb3a:vllm/entrypoints/openai/responses/protocol.py#L136-L175
  - vllm@568afb3a:vllm/envs.py#L980-L982
  - vllm@ced6857a:examples/ray_serving/ray_serve_deepseek.py#L1-L55
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/base/utils.py#L1-L64
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L166-L208
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/transcription/api_router.py#L42-L61
  - vllm@ced6857a:vllm/entrypoints/speech_to_text/translation/api_router.py#L42-L61
  - vllm@ced6857a:vllm/entrypoints/openai/responses/protocol.py#L137-L176
  - vllm@ced6857a:vllm/envs.py#L1004-L1006
  - vllm@ced6857a:vllm/envs.py#L1012-L1014
  - vllm@84030bbe:examples/ray_serving/ray_serve_deepseek.py#L1-L55
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/base/utils.py#L1-L64
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/base/serving.py#L166-L208
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/transcription/api_router.py#L42-L61
  - vllm@84030bbe:vllm/entrypoints/speech_to_text/translation/api_router.py#L42-L61
  - vllm@84030bbe:vllm/entrypoints/openai/responses/protocol.py#L137-L176
  - vllm@84030bbe:vllm/envs.py#L1017-L1019
  - vllm@84030bbe:vllm/envs.py#L1025-L1027
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/protocol.py#L438-L446
  - vllm@568afb3a:vllm/entrypoints/openai/responses/protocol.py#L459-L467
  - vllm@ced6857a:vllm/entrypoints/openai/responses/protocol.py#L481-L491
  - vllm@84030bbe:vllm/entrypoints/openai/responses/protocol.py#L481-L491
  - vllm@0fc695fc:vllm/entrypoints/openai/responses/serving.py#L593-L617
  - vllm@568afb3a:vllm/entrypoints/openai/responses/serving.py#L608-L631
  - vllm@ced6857a:vllm/entrypoints/openai/responses/serving.py#L273-L298
  - vllm@84030bbe:vllm/entrypoints/openai/responses/serving.py#L273-L298
  - 'vllm@ced6857a:vllm/config/vllm.py#L450-L462'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L120-L185'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L105-L202'
  - 'vllm@ba15685a:vllm/config/vllm.py#L475-L490'
  - 'vllm@ba15685a:vllm/entrypoints/launchers/launcher.py#L151-L165'
  - 'vllm@ba15685a:vllm/entrypoints/launchers/launcher.py#L251-L310'
  - 'vllm@ba15685a:vllm/entrypoints/launchers/api_server/entry.py#L105-L202'
  - 'vllm@ba15685a:vllm/renderers/online_renderer.py#L161-L210'
  - 'vllm@ba15685a:vllm/v1/engine/admission_control.py#L13-L52'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: pooling-and-non-ar
    kind: builds-on
    note: Generate、Pooling 与 Encoder-Decoder 三条执行主线及池化头与 ASR 路径
  - to: cluster-serving
    kind: builds-on
    note: 多实例代理、前缀感知路由、/health 探针与 --shutdown-timeout 优雅停机护栏
  - to: engine-processes
    kind: builds-on
    note: API server 是哪个进程、和 EngineCore 与 worker 怎样分工、各自跨步留着什么
  - to: token
    kind: builds-on
    note: 聊天模板与字节级 BPE 分词本身怎么做，GLM 模板加了哪些特殊标记
  - to: request-call-chain
    kind: builds-on
    note: 入口之后六站各从哪个函数进，进程之间走哪几条通道
  - to: dp-request-routing
    kind: builds-on
    note: 入口最后一步派给哪一组的打分规则，计数从哪来、为什么会过时
  - to: embedding
    kind: builds-on
    note: 入口把文本转换为 token 编号，是因为模型的嵌入入口需要按编号查表取得向量。
  - to: vllm-ascend-overview
    kind: builds-on
    note: 入口页对昇腾插件未改动请求入口的具体说明，建立在总览所述上游负责接请求、分词，昇腾负责 NPU 执行的职责边界上。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: direct
---

## 一个 HTTP 请求进了 API server，出来的是什么？

**API server 入口指 vLLM 前端进程从收到一个 HTTP 请求、到把它交给某个引擎排队之间的这一段：把 JSON 整理成引擎请求，并在自己的进程里留好回程的接收点。** 下面先沿纯文本生成路径看一串 token 编号、采样参数和请求 ID 怎样准备好；预计算向量与图像输入还带有张量等数据，后文单独说明。

这里有两个进程。API server 是接 HTTP 请求的进程，对外提供和 OpenAI 一样格式的接口，执行 vllm serve 时起的就是它；EngineCore 是负责排队、调度并驱动模型计算的引擎进程（见 [EngineCore](vllm-engine-core.md)）。两者不在同一个进程里，请求要从前者交到后者手里。

前端先做模板和分词，能在调度前拒掉无效输入，也让引擎专注于模型执行；代价是这些处理占 CPU，每条在途请求的回程记录还占主机内存。前端太忙时，请求即使尚未进模型，也已经在等待。

举个具体的例子。客户端发来这样一段 JSON：消息列表里只有一条，角色是用户，内容是「你好」，并且要求边生成边返回（流式）。这条纯文本请求送进引擎前，要准备好三样东西：

- 一串 token 编号，例如示意的 7、31、1052、9；
- 一组采样参数：最多生成多少个 token、按什么规则从候选里挑、遇到什么就停；
- 一个请求 ID，用来在之后的每一步里认出这条请求。

前端自己还要记住一件事：引擎之后每一步交回来的编号，要还原成文字，推回这一个 HTTP 连接。下图把这一路画出来，左列是同一条请求在前端里一步步变成的样子：

```wiki-diagram
file: api-server-entry
```

① 到 ⑤ 都在改写请求本身：先检查，再按模型训练时约定的对话格式拼成一段带角色标记的文本（这一步叫套聊天模板），再切成编号，定好长度上限和采样参数，最后包成引擎请求。⑥ 不改请求，而是在前端留一个回程的接收点。⑦ 才第一次跨过进程边界：开了 DP（data parallel，数据并行）的部署有好几个执行组，每组一个 EngineCore，各排各的队，前端要先挑一组再发过去。后面几节按这个顺序展开。

## 为什么要在前端先做完这些，代价在哪？

**本页的纯文本路径先把文字变成编号，再交给引擎调度；这些 CPU 上的字符串处理放在前端，让引擎进程专注于排程和驱动 NPU。** 这条路径进模型后先拿编号查[嵌入表](embedding.md)；接口也有直接携带预先算好的嵌入向量的路径，所以不能把所有引擎输入都说成只有编号，边界见 [V1 分工](vllm-v1-shape.md#vllm-怎样把一条请求变成一步一步的计算)。套模板、分词、把输出编号还原成文字（反分词）都不需要 NPU，交给单独的前端进程，和引擎各干各的，见[引擎进程](engine-processes.md#每个进程里存着什么)。

**坏请求在门口拒掉，不占引擎的资源。** 一条请求一旦进了引擎的等待队列（waiting），就会占调度名额，开算后还要占 [KV cache](kv-cache.md)（保存每个 token 历史结果的显存）的块。模型名写错、提示词超长、采样参数不合法，这些在入口都查得出来，直接回 400 或 404，引擎根本不知道它来过。

**回程要先有落脚的地方。** 引擎每走一步，把这一步所有请求的结果打成一包交回前端；前端按请求 ID 把它们分拣到各自的连接。所以入口的顺序是先登记、后发送：前端分拣时遇到不认识的 ID 会直接丢掉，先登记才能保证引擎最早交回的那一批也有处可落。

代价都在主机这边：

- **CPU 时间。** 套模板和分词默认挤在一个工作线程上，所有请求排队用它；提示词越长，分词越久。这段时间算在首 token 时延里，也就是从发出请求到收到第一个输出 token 的时间。
- **主机内存。** 每条请求在前端留一份记录（反分词进度和输出槽），请求结束才删。
- **前端进程个数有限。** 只起一个 API server 时（后面的 GLM 主线就是这样设的），所有连接、模板、分词、反分词都在这一个进程里；并发很高时，它的 CPU 可能先于 NPU 成为瓶颈。

入口和相邻几个环节容易混，分工如下：

| 环节 | 在哪个进程 | 管什么 | 不管什么 |
|---|---|---|---|
| 入口（本页） | API server | 文字变编号；把请求里的采样设置定成参数并校验 | 不选 token，不排队 |
| [采样](sampling.md) | worker（NPU 上） | 照这组参数从每个词的分数里选出 token | 不再改参数 |
| [DP 请求路由](dp-request-routing.md) | API server | 入口最后一步：派给哪一个 DP 组 | 不看请求内容 |
| 返回 | API server | 把编号还原成文字，推回连接 | 不碰模型计算 |

## 怎么做：从 JSON 到一串编号（① 到 ④）

**在本页未启用 LoRA 的固定配方中，前四步只在前端改写请求：先查能不能收，再把消息拼成文本、切成编号，最后按长度上限定下最多能生成多少个 token。任何一步不过关，都直接回一个带错误信息的 JSON，请求不会到引擎。**

**① 检查。** 网页框架先按接口约定检查 JSON 的字段和类型，格式不对回 400。接着看请求里写的模型名：在本页未启用 LoRA 的固定配方中，服务开启模型名校验，请求可省略名称或使用基座的对外名字，其他名字回 404。启用 LoRA 的服务还接受已登记的适配器名；允许动态更新时，未知名字可进入 [适配器查找与加载](lora.md#请求只写适配器名服务怎样找到权重)，不能一律按名字不匹配拒绝。还有两类选项要服务端事先打开才收：请求自己带一份聊天模板，要启动时声明信任请求里的模板；让模型自己决定要不要调用工具（tool_choice 设为 auto），要启动时打开自动工具选择并指定工具调用的解析器。这些都没打开时，请求被拒。最后，引擎如果已经停止，前端直接报错，不再往下做。

**② 套聊天模板。** 聊天接口收到的是一串消息，每条带角色（系统、用户、助手）和内容。模型训练时见到的对话都是按固定格式拼成的一整段文本，角色之间用特殊标记隔开，最后还有一个「轮到助手回答」的标记。前端用模型自带的模板（一段 Jinja 模板，随分词器文件一起发布）把消息拼成这样一段文本。模板长什么样、为什么要这样拼，见 [token 页的聊天模板一节](token.md#聊天消息先套模板再分词)。

**③ 分词。** 拼好的文本交给分词器，切成一串 token 编号；分词器怎样切，见 [token](token.md#字节级-bpe-怎样一步步切出-token)。这里有两个入口特有的细节：

- **不再补一遍特殊标记。** 模板已经把起始标记和角色标记写进文本了，聊天接口默认不让分词器再加自己的起始标记，否则开头会多出一份，长度和模型看到的格式都变了。
- **在线程池里做。** 前端靠一个事件循环同时照看所有连接，套模板和分词这类耗 CPU 的活要是直接在循环里做，别的连接都得等。所以这两步交给一个专门的线程池，默认只有 1 个线程；v0.23 还会把 2 ms 内到达的分词请求攒成一批（最多 32 条）一起切。

**④ 定输出上限和采样参数。** 模型一次能处理的序列有个总长度上限（max model len），输入和输出共用它。聊天请求写了最多生成多少个 token（max_tokens，也可写 max_completion_tokens，后者非空时优先），输入就只能占剩下的部分；两项都没写且没有生成配置限制时，前端把总上限减去输入长度当作输出上限。模型默认与服务端硬上限的区别在页末参数参考说明。先用一组示意数走一遍，设总长度上限是 100：

参数准备和提交还要区分普通采样与 [beam search](sampling.md#beam-search为什么同时保留几条没写完的候选)：前者选择下一 token，后者保留多条候选序列继续搜索。聊天入口分别构造两类参数，再分派到相应生成路径；下方长度预算示意不展开 beam search。

生成模型还提供独立的[生成式评分入口](sampling.md#生成式评分用下一个-token-的概率比较候选)：为每个候选构造输入，只读取下一位置的标签分数。它使用自己的请求字段与拼接规则，不能把下方 Chat 的自动模板和超长拒绝规则直接套过去。


设总长度上限 $L_{\max} = 100$，按上述减法做长度预算核验（示意数）：

$$L_{\text{in,allow}} = L_{\max} - L_{\text{out}} = 100 - 30 = 70, \qquad L_{\text{out,default}} = 100 - 12 = 88$$

| 请求场景（示意：$L_{\max} = 100$） | 长度核算 | 入口处理结果 |
| --- | --- | --- |
| 请求输出 $30$，实际提示词 $75$ 个编号 | 允许输入 $100 - 30 = 70$，超出 $75 - 70 = 5$ | 分词保留到第 71 个即判超长，回 400（「输入至少 71 个」） |
| 不写输出数，实际提示词 $12$ 个编号 | 输出上限 $100 - 12 =$ **88** | 合法放行，按 88 补齐输出预算 |

注意这里的「提示词」是套完模板以后的整串编号，模板加进来的标记也算在内。默认分词路径只保留到允许的输入数再多 1 个，避免为注定被拒的长文本继续编码；多出的这 1 个足以判定超长，所以错误信息只能写「至少多少个」。truncate_prompt_tokens 非 None 且显式选择 truncation_side 时，会关闭这层 tokenizer 截短，先保留完整编号和位置，再按指定方向处理；不能把示意里的“只切到 71”推广到全部截断设置。提示词本身超过总长度，或者恰好顶满、没有输出位置，也受入口长度检查，截断规则见 [token 参数参考](token.md#怎么开)。

采样参数也在这一步定下，打包成一个采样参数对象（SamplingParams）：请求里写了的用请求的，没写的先取模型目录里生成配置（generation_config.json）给的默认值，再退到 vLLM 的中性默认值；取值不合法（例如 temperature 为负）直接拒绝。来源和取值规则见 [采样参数从哪来](sampling.md#采样参数从哪来)。入口只定参数、不选 token，真正按参数选 token 是第 5 站 worker 上的事。

同一步还定下回程怎么交付：流式请求要「增量」，每次只交新生成的那一段；非流式请求「只要最终结果」，生成完才交一次。

## 怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）

**后三步交给前端进程里的 AsyncLLM（vLLM 面向服务端的异步引擎接口）：它把编号和参数包成一个 EngineCoreRequest（引擎之间传递请求用的数据结构），先在本进程登记这条请求的回程接收点，再挑一个 DP 组，通过 ZMQ（进程之间收发消息的库）发过去。**

**⑤ 包成引擎请求。** 打包前还要再查一遍：采样参数和要用的任务是否支持、请求头里指定的组号是否在范围内、提示词是不是空的、长度是不是已经顶满上限（一个输出位置都不剩）、编号有没有超出词表（见 [编号要落在词表之内](token.md#编号要落在-154880-行之内)）。都通过后，补齐采样参数：没写输出上限的按上一节的减法补上，模型生成配置里列的结束编号并进「遇到就停」的编号列表（见 [停止判断和长度上限](sampling.md#停止判断和长度上限)）。打出来的请求对象里，和后面几站直接相关的是这几项：

| 字段 | 里面是什么 | 后面谁用 |
|---|---|---|
| 提示词编号 | 第 ③ 步切出的整串编号 | 调度器数长度；worker 拿去查嵌入表 |
| 采样参数 | 第 ④ 步定下并补齐的参数 | 第 5 站选 token；每步判断停不停 |
| 请求 ID | 对外的 ID 后面再加 8 位随机字符 | 回程按它分拣 |
| 到达时间 | 前端收到这条请求的时刻 | 按优先级排队时排先后；统计时延 |
| 指定组号 | 请求头里写的 DP 组号，没写就是空 | 第 ⑦ 步选组 |

对外的 ID 是「chatcmpl-」加上一段基础 ID：优先取请求头 X-Request-Id，没有这个头时取请求里的 request_id 字段，两者都没提供时才随机生成。返回给客户端的也是这个对外 ID。内部再加 8 位随机后缀，是为了两个客户端碰巧用了同一个 ID 时，引擎里也不会撞在一起。请求要一次生成 n 个回答（n 大于 1）时，这里拆成 n 条子请求，各有各的内部 ID，分别发给引擎，但共用同一个输出槽。

**⑥ 登记回程接收点。** 前端有一个 OutputProcessor 对象，管所有在途请求的回程。登记就是在它那里按请求 ID 存一份记录，里面有三样东西：一个反分词器，按增量把编号还原成文字（为什么要按增量，见 [生成的编号怎样变回文字](token.md#生成的编号怎样变回文字)）；一个整理对数概率（logprobs，每个 token 被选中的概率取对数）的处理器，请求要了才有活干；以及一个输出槽，处理好的结果放进去，等这条 HTTP 连接来取。

输出槽只有一个位置，不是排成一列的队伍：前端的一个后台任务从引擎收结果、反分词后往里放，流式请求的上一段还没被取走时，新的一段就和它并成一段（槽里的「你」还没被取走、又来了「好」，连接取到的就是「你好」）。什么时候会并、对客户端看到的分段有什么影响，见 [前端跟不上时：几步的文字并成一段](streaming-output.md#前端跟不上时几步的文字并成一段)。

登记一定在发送之前。后台任务分拣时遇到不认识的请求 ID 会直接丢掉，先登记才能保证引擎最早交回的那一批也有处可落。反过来，客户端中途断开连接时，前端会给引擎发一条中止消息，引擎把这条请求从队列里删掉、释放它占的块，前端的记录也随之删掉。前端怎样察觉客户端走了、已经在算的那一步结果怎样处理，见[请求收尾](request-teardown.md#前端先发现停止字符串和客户端断开)。

**⑦ 选 DP 组并发送。** 发送前，前端在请求上盖两个印：当前这一轮的 wave 号（各组同步开工、停工用的轮次编号）和本前端的编号。然后选组：请求头指定了组号就直接用，没指定就按各组的忙闲打分取最闲的一组，规则和计数从哪来见 [DP 请求路由](dp-request-routing.md#一条新请求进来派给哪一个-dp-组)。选定后经 ZMQ 发到那一组 EngineCore 的输入口。如果此刻所有组都停着（没有请求时各组会一起停下），前端还要另给 DP 协调器发一条消息，把各组叫醒。

**到了引擎那边。** EngineCore 进程里有一个专管收消息的输入线程。它解出请求后，当场把它建成调度器用的 Request 对象，这一步和引擎正在做的这一圈计算同时进行；建好后放进一个进程内的输入队列。引擎这一圈做完，下一圈开头先把输入队列里的新请求取出来，交给调度器放进 waiting 队列，等着被调度。所以请求进了引擎并不等于马上开算，引擎一圈怎么转见 [EngineCore 一圈按什么顺序走](vllm-engine-core.md#一圈按什么顺序走一条示意请求转两圈)。到这里，这条请求有了两份记录：前端的输出槽和反分词器，引擎里的 Request。

## 流式和非流式：200 什么时候发出，错误从哪里回来？

**两种请求走同一条路，差别在 HTTP 状态码什么时候定下来：非流式等整条请求生成完才回响应，中途任何错误都还能改成错误响应；流式在请求交给 AsyncLLM 之前就已经回了 200，从那以后的错误只能写进流里。**

关键在于第 ④ 步之后，前端只是建好了一个「生成器」：它描述了怎样把请求交给 AsyncLLM、怎样一段段取回结果，但还没开始执行，真正执行要等有人来逐段取。

- **非流式**：前端当场逐段去取，取到最后一段才拼成完整的回答，一次性回一个 JSON。⑤ 里任何一项校验不过，抛出的错误被统一的错误处理接住，按错误类型回 400 等状态码。
- **流式**：前端把生成器原样交给网页框架，框架先回 200 和流式响应头，再一段段往外推。推的格式叫 SSE（server-sent events，服务器沿着一条一直开着的 HTTP 连接，一行行推送以「data:」开头的消息）。这时 ⑤ 才开始执行，校验不过也改不了已经发出的 200，只能推一条内容是错误信息的「data:」消息，再推结束标记。

所以客户端收到 200，只说明前四步过了，不说明请求已经进了引擎。下图是整条路的先后和出错出口：

```wiki-diagram
file: api-server-entry-flow
```

各项检查落在哪一步、出错时客户端看到什么：

| 查什么 | 在哪一步 | 客户端看到 |
|---|---|---|
| JSON 字段和类型 | 收到请求时 | 400 |
| 模型名不是服务对外的名字 | ① | 404 |
| 请求自带模板但服务没声明信任；要自动选工具但没开工具解析 | ① | 400 |
| 消息不合模板的要求，模板渲染时报错 | ② | 400 |
| 提示词加输出数超过总长度上限；采样参数取值不合法 | ③ ④ | 400 |
| 编号超出词表、组号越界、提示词为空 | ⑤ | 非流式 400；流式先 200，流里一条错误消息 |
| 提示词顶满上限、一个输出位置都不剩 | 通常在 ③ ④ 就拦下；⑤ 只是兜底 | 400 |
| 引擎已停止 | ① 或 ⑤ | 500（流式已发 200 时写进流里），前端随后退出 |

前四步的错误不管流式与否都是一个普通的错误 JSON；只有 ⑤ 之后的错误，流式和非流式看到的不一样。

## 几种变体：不套模板的接口、一次要多个回答、开多个前端

**入口这条路有三种常见的走法变化：老式补全接口不套聊天模板，一次要 n 个回答会拆成 n 条子请求，前端开成多个进程可以分摊 CPU。后面的打包、登记、选组、发送都不变。**

**老式补全接口（/v1/completions）。** 它收的不是消息列表，而是一段现成的提示词文本，也可以直接给一串编号。所以没有第 ② 步：文本直接分词，而且默认让分词器补上自己的起始标记，因为没有模板替它写。请求不写输出上限时，这个接口默认最多生成 16 个 token；聊天接口没有这个 16 的默认值。这些预算仍受剩余上下文和服务端硬上限约束。补全接口不认聊天接口的新字段 max_completion_tokens：请求里多出的字段只在 DEBUG 级日志里记一条「被忽略」的消息，普通 INFO 级别看不到。输出预算照样从默认的 16 算起，GLM 教程里的验证请求就是这种情况（见 GLM 一节）。直接给编号时连第 ③ 步也跳过，入口能拦住错误编号的只剩第 ⑤ 步的词表上界检查。

**一次要 n 个回答。** 第 ⑤ 步拆成 n 条子请求，每条只要 1 个回答；请求给了随机种子时，各条的种子错开，免得 n 个回答一模一样。子请求各自经过第 ⑦ 步选组、发送，可能落到不同的 DP 组；回程都放进同一个输出槽，由前端按序号拼回一个响应里的 n 个答案。

**开多个前端。** 启动参数 api-server-count 大于 1 时，会起多个 API server 进程（开了 DP 而没写这个参数时，由本前端统一给各组派活的部署方式，即 internal LB，默认就按 DP 组数起），共用同一个监听端口，新连接由操作系统分给其中一个。每个前端各有自己的分词线程和自己的在途请求记录，套模板、分词、反分词的 CPU 开销被分摊开；但每个前端各自给 DP 组打分：协调器推来的各组计数是全局的，两次推送之间各前端却只知道自己刚派出了什么，所以本地记账要按前端个数来补，见 [DP 请求路由](dp-request-routing.md)。

对于一次前向输出向量、类别或分割结果的 pooling 模型，还可以用[输入输出插件](platform-plugin-registration.md#输入输出插件为什么能把一张图拆成多个请求)接收应用自定义数据。一份输入可以展开成多个模型子请求，收齐后再合并为一份结果；因此这里也不能用 HTTP 请求数直接代替模型计算的任务数。

如果输入由 Python 脚本分批准备，希望最后统一取回结果，可以继续读[离线请求队列](request-call-chain.md#离线脚本能先提交几组请求再一起取结果吗)。提交先返回请求编号；默认后台引擎收到输入即可开始计算，等待接口再收齐结果。在生产集群滚动发布或缩容时，前端入口的优雅停机钩子会接管退出信号并按 `--shutdown-timeout`（默认 0）决定等待在途请求的窗口，先停引擎再停 HTTP server，详见 [集群部署与优雅停机](cluster-serving.md#滚动发布与缩容别被默认---shutdown-timeout-0-直接掐断请求)。

## Responses、Messages 和 pooling，为什么不能只换接口地址？

**接口协议规定调用方怎样描述输入、服务怎样交回结果；模型任务决定服务能算什么。** 同一套 vLLM 可以提供多种协议，但每个服务只挂载或初始化它所支持的任务。上面的七步以 Chat 文本生成为例；向量、分类结果和语音转写各有入口准备与输出整理，不能把所有返回值都当成一串聊天文字。

| 想得到什么 | 交给接口什么 | 服务交回什么 |
|---|---|---|
| Chat 回答 / Completions 续写 | 前者是带角色的消息；后者是已准备的提示词或编号 | 回答或续写文字，以及相应 choice、用量；流式交增量 |
| Responses 回答或工具调用 | input 文本或输入项列表，可带工具定义 | output 项列表，项可为消息或工具调用；不能按 Chat 的 choices 字段读取 |
| Anthropic Messages 格式的回答 | messages、模型名、正数 max_tokens；system 可单独提供 | content 内容块及停止原因；工具调用以 tool_use 块表达 |
| Embeddings / classification | 文本、编号或接口允许的消息输入 | 向量，或类别标签与各类别概率；需要相应 pooling 任务 |
| Score / rerank | 两侧待比较的输入，或一条 query 与候选 documents | 分数，或带原候选序号的排序结果 |
| 通用 pooling | 支持的输入与 pooling 任务；插件可定义自己的数据 | 由任务或插件决定结果结构，包括向量、矩阵等 |

pooling 在这里指把模型的输出表示整理成应用需要的结果，例如一句话的向量。它通过 encode 路径取结果，不会为了得到一个向量再逐 token 生成一段答案，三条执行主线（Generate / Pooling / Encoder-Decoder）及池化头细节见 [Pooling 与非自回归路径](pooling-and-non-ar.md)。自定义输入怎样展开、合并，沿用前面的[输入输出插件](platform-plugin-registration.md#输入输出插件为什么能把一张图拆成多个请求)解释。

Responses 的“继续上一轮”还涉及**会话记录**：服务保存上次输入与输出，下一次可用上次响应 ID 找回它们。它与 [prefix caching](prefix-caching.md) 不同：前者保存可重建对话的记录，后者复用模型算过的历史状态；有响应 ID 不代表 KV 一定命中。示意地说，第一次问“甲方案是什么”得到响应甲，第二次问“它的代价呢”并引用响应甲，服务必须能找到响应甲的记录，才能准备第二轮输入。

固定实现默认关闭 Responses 保存。普通请求即使带了默认值为 true 的 store，也会被改成不保存；要按响应 ID 继续对话，须先在服务端开启保存并让相关请求确实保存。记录放在该服务对象的主机内存字典里，不是各 API 进程共享的持久数据库；重启、换到没有该记录的进程或引用未知 ID，都不能凭 ID 恢复对话。开启保存后，这些实现没有自动移除已存响应和消息的机制，长期会话会继续占用内存。调用方也可以像官方工具示例一样，把历史输入、模型产生的工具调用及工具结果一起放回下一次 input，由自己保存会话。

Anthropic Messages 的固定入口则先把消息、系统说明和工具定义转换成 Chat 请求，交给聊天处理，再把结果转回 Messages 格式。协议转换本身不会替模型增加工具能力；模板、工具解析器和模型仍须配套，详见[工具选择](structured-output.md#工具调用能解析出来就说明参数符合-schema-吗)。兼容接口应按当前模型、请求字段和服务版本理解，不能由客户端库接受某字段推断服务一定实现了它。

## 上传录音、聊天音频和实时转写，分别走哪条路？

**上传录音是“先收一份文件，再整理成模型输入”；实时转写是“连接保持着，音频分段到达，文字分段返回”。** Chat 中的音频则是聊天消息的一种内容，仍要遵守模型的消息模板与多模态处理规则。传入原始音频时，三条路径都要处理音频并执行模型计算；传输格式、开始计算的时机与结束信号各有约定。

上传接口用 multipart 表单携带 file 文件对象；它不是 JSON 中的文件名，也不是给 Chat 填一个音频 URL。transcriptions 做语音转写；translations 按模型支持的目标语言翻译，不能只因存在目标语言字段就认定支持任意语言。服务读取文件、检查大小、解码并按模型采样率整理，再构造模型输入；允许切分长音频的模型才会进入[音频切分分支](#视频和音频在前端还要处理什么)。即使选择流式返回文字，这个文件上传入口也先读取上传文件，不会因此变成实时音频输入。

基线文件上限默认 25 MiB，约束的是上传文件的字节数。压缩文件较小，不表示解码后的波形和设备计算同样小：还要看时长、采样率、声道与模型展开的位置。较新版的提前读取检查和解码限制见页末版本表。json 与 text 是普通返回格式；verbose_json 需要模型支持片段时间戳，且不能与流式返回合用；beam search 也不能与该接口的流式返回合用。字段枚举里出现某格式，不代表后续运行分支就接受它。

实时入口使用 WebSocket：客户端和服务可以在同一条连接上持续互发事件。固定协议要求 PCM16、16 kHz、单声道，再把字节编码为 base64 文本。PCM16 表示每个采样点用 16 位、即 2 字节表示；它不是把 MP3 文件直接做一次 base64。示意取一秒、单个连续缓冲区：

$$B_{\text{PCM,1s}} = 16{,}000\text{ Hz} \times 1\text{ 声道} \times 2\text{ B} = 32{,}000\text{ B}$$

| 1 秒实时音频（示意，单连续缓冲） | 参数与算式 | 数据量 |
| --- | --- | --- |
| 原始 PCM16 字节数 | $16{,}000 \times 1 \times 2\text{ B}$ | **32,000 B** |
| base64 编码后文本 | $\lceil 32{,}000 \div 3 \rceil \times 4$ | **42,668 字符**（另计 JSON 与分块补齐） |

base64 还会把这份数据扩展成 42,668 个字符，之外另有 JSON 与连接开销；分成多块时各块的补齐也要计入。服务还要暂存队列里的音频并生成文字，所以“分段发送”不等于没有主机内存开销，也不是模型输出每个 token 都对应一个网络包。

一次文件实时转写的顺序是：收到 session.created 后，**先发送 session.update 指定并验证模型**；再发送普通 commit 启动生成，逐段 append 音频，最后发送 final=true 的 commit 表示音频结束。服务返回 transcription.delta 增量与 transcription.done 完整结果。这里 final=true 只向音频队列放入结束标志，不负责启动生成；模型验证之前的 commit 会被拒绝。普通 commit 与 final commit 的职责要分开，不能从“commit”这个名字猜时序。

选择模型时也要区分任务：具备聊天音频能力、文件转写能力或 realtime 能力中的一个，不会自动获得另外两个。GLM 双机主线仍是已有的文本请求，不把语音示例的模型、资源或延迟套到 GLM 上。

## Ray Serve 和 SageMaker 包在外面，会改变模型怎样并行吗？

**服务包装层负责接入口和部署组织，模型内部的 TP、PP、DP 仍由引擎配置决定。** SageMaker 是云端模型托管服务；vLLM 的适配入口接收 /invocations 请求，按当前可用处理器及请求结构选择 Chat、Completions 或相应 pooling 处理器，再交给原处理链。它不是把所有接口自动变成同一个请求格式：Responses、Messages 和 multipart 语音上传不在这份固定 /invocations 分发表中。/ping 则接到健康检查。

Ray Serve 是在 Ray 集群上组织服务部署的组件。它可以在引擎之外管理服务副本，而 [Ray 执行器](engine-processes.md)解决的是一个引擎怎样组织分布式 worker；两个层次不能互换。外层增加一个部署副本与内层增加一段 PP，不是同一件事：前者涉及另一份服务部署，后者改变一次模型执行的分段。

官方 DeepSeek Ray Serve 示例把外层副本的最小值和最大值都设为 1；引擎内部设 TP8、PP2，并指定 H100。它演示了“一个外层副本仍可在内部跨卡、跨节点计算”，不能从 autoscaling_config 这个配置名得出该示例会自动扩成多个副本。副本内部设备数按[PP 与 TP 的组合](pipeline-parallel.md#怎么开)核算；这是该 GPU 示例的配置关系，不是本站 Ascend 双机部署命令。外层框架还需要自己的进程、路由和部署资源，API 请求到达后仍须经过本页解释的模型输入准备。

## 模板和分词能否拆成一个独立的 CPU 服务？

**可以。独立 renderer 把“准备模型输入”做成 HTTP 服务，调用方先拿到编号、采样参数和必要的媒体数据，再交给另一个生成服务。** renderer 在这里指整理输入的组件：加载模型配置、分词器与聊天模板，在 CPU 上准备请求；这个独立入口不创建推理引擎，也不加载一套用于前向计算的模型权重。

普通服务把这些步骤包在一次 Chat 调用里。拆开以后，调用方承担串接职责，可以分别部署或扩充 CPU 预处理服务与设备生成服务。代价是多了网络往返、序列化和在途状态；独立预处理服务也要保有分词器、模板及媒体处理需要的主机资源。增加分词线程数只扩大一个服务内部的线程池，不会自动部署这些独立服务。

```wiki-diagram
file: api-renderer-services
```

以一条纯文本聊天请求为例，先把消息送给 render 接口，取回示意编号 7、31、1052、9 以及生成参数。此时只准备好了输入，还没有生成答案。调用方把这份生成请求交给 token-in/token-out 接口，后者才驱动引擎计算并交回输出编号。支持 derender 的版本还能接受这些输出编号，将它们还原为文字，并按原始请求解析成回答、思考或工具调用字段。derender 是输出整理，不是再跑一次模型。

调用方应保留原始请求及输入计数。比如输入是上述 4 个编号，生成了 2 个编号，后处理时要同时交回输入计数 4：

$$N_{\text{total}} = N_{\text{prompt}} + N_{\text{output}} = 4 + 2 = 6\text{ 个 token}$$

| 用量分项（示意） | 来源 | 数量 |
| --- | --- | --- |
| 输入计数 $N_{\text{prompt}}$ | 调用方随原请求交回（缺失时旧协议记为 0） | **4** |
| 输出计数 $N_{\text{output}}$ | 本次生成服务返回的编号数 | **2** |
| 总用量 $N_{\text{total}}$ | $4 + 2$ | **6 个 token** |

只交生成结果时，旧后处理协议把缺失的输入计数当作 0。工具与思考解析还需要原始请求中的工具定义和选择方式，不能仅凭输出文字恢复全部上下文。

多模态输入还要带上 render 返回的媒体特征、占位范围等完整数据。这里的特征可能仍是设备编码器的输入，不表示图片已经在 CPU 上完成模型编码。Chat render 会跳过依赖该服务缓存命中的媒体传递方式，返回可供下游继续处理的数据；调用方若只转发文字编号，下游就缺少媒体内容。

较新版本另支持逐片段 derender：调用方每收到一段生成编号，就向同一个后处理地址提交一次，并将上次返回的反分词状态带到下一次。**每次后处理调用返回一份 JSON，状态由调用方传递；它自身不是一条自动持续推送的 SSE 连接。** `v0.30.0` 与 `main` 的这条 Chat 分支遇到已配置的思考或工具解析器会拒绝，单次片段也至多包含一个 choice。需要这些解析时走完整结果后处理；完整结果与逐片段路径的能力不能互推。具体入口及四版差异见页末。

## 已经算好的向量怎样进门，谁负责套模板？

**输入也可以是预先算好的嵌入向量：调用方已经把部分文字变成向量，服务把它们和仍需查表的编号一起交给模型。** 它省去对应位置的嵌入查表，不省掉后续模型前向、历史状态或输出采样；向量的含义和宽度必须与正在服务的模型匹配，不能拿另一个模型的句子向量直接替代。编号与向量的关系见[embedding](embedding.md)。

例如一条用户消息的内容已经变成三个位置的向量。Chat 接口仍要围上 user 角色和轮到 assistant 的标记；如果调用方提前把这些角色标记也编进向量，服务再套一次模板，就会重复。Completions 没有这一步，调用方需要准备它希望模型实际看到的完整输入。两种入口应这样区分：

| 入口 | 交给服务什么 | 模板和多条输入怎样处理 |
|---|---|---|
| Chat 的消息内容块 | `{"type":"prompt_embeds","data":"…"}`，data 是序列化张量的 base64 字符串 | 向量只代表该内容块，不含外围角色标记；服务套模板、展开占位位置，将向量与其余文本编号按顺序拼好 |
| Completions 顶层 prompt_embeds | 一个 base64 字符串，或多个这样的字符串 | 每个张量是一条已准备好的完整输入；服务不套聊天模板。与 prompt 同时提供时，按先嵌入输入、再普通 prompt 的顺序组成一批独立请求，不把二者接成一句话 |
| 图像、视频、音频的预计算嵌入 | 对应模态的嵌入字段及模型要求的布局信息 | 走多模态处理契约，使用 enable_mm_embeds；与文本 prompt_embeds 的开关、字段和布局不同 |

文本嵌入入口由启动参数 `--enable-prompt-embeds` 打开，对应 enable_prompt_embeds，默认 false。张量按“位置数 × 模型 hidden_size”准备，经 Torch 序列化后再做 base64 编码；固定入口会检查张量、维数和向量宽度，浮点 dtype 不同则转换到模型 dtype。HTTP 解码在主机上进行，张量传输、解码和暂存仍有成本，输入位置也照样计入上下文预算。这个入口面向能正确构造模型输入的调用方，不是给普通文本请求换一个字段名。

Chat 的最小内容形状可以写成下面这样；`embedding_base64` 是调用方已经为当前模型生成并序列化的张量，不是占位字符串原样发送，也不是从服务取出的 KV cache。文本块和向量块可在同一 content 列表里按需要排列。

```python
message = {
    "role": "user",
    "content": [{"type": "prompt_embeds", "data": embedding_base64}],
}
```

Completions 的嵌入输入不能同时要求 echo 或 prompt_logprobs；开关没开、张量维度或宽度不匹配也会被入口拒绝。较新版本对 encoder-decoder 模型还有启动限制，见版本差异。固定 Ascend runner 能接收嵌入张量并按本步位置送给模型，但这些代码入口不等于 GLM 双机已经完成该输入形式的兼容性与数值验证；本页的 R1 继续采用普通文本编号。

## 一张图片进来，怎样和文字一起交给模型？

**多模态预处理把图像、视频或音频整理成模型可读的张量，并标明它们对应输入序列的哪些位置。** 它发生在前面的入口准备阶段；之后，媒体编码器才把这些张量变成特征向量，交给语言模型（媒体进入模型后的 ViT 编码、M-RoPE 旋转角与 `EncoderCacheManager` 机制见 [多模态推理架构](multimodal-inference.md)）。CPU 解码、缩放和整理需要时间与主机内存，编码器计算与输出又需要设备资源；媒体展开的位置还会增加语言模型的输入长度。

下面以“把媒体特征放进文字序列”的生成模型为例。不同模型的媒体编码器、位置表示和输入字段各有约定；encoder-decoder 的交叉注意力结构还须按模型实现区分。

```wiki-diagram
file: api-multimodal-input
```

### 媒体为什么要在序列里留位置？

占位位置告诉执行器：“这里将放某张图的特征，不是普通文字查表得到的向量。”模板中的一枚图片标记可能展开成很多位置，数量取决于图像分辨率、裁剪与模型处理方式，不能按一张图等于一个输入 token 计算。

做一个示意：文字分成 T₀、T₁ 两个位置，图片 A 需要两个特征位置，B 需要三个。按消息顺序展开后是 [T₀, A₀, A₁, T₁, B₀, B₁, B₂]，共 2+2+3=7 个位置。A 从位置 1 开始、长度 2，B 从位置 4 开始、长度 3。编码后，将 A 的两行向量填到 1、2，把 B 的三行填到 4、5、6；文字位置 0、3 保留文本嵌入。这里只示意位置对应，实际模型还可能带额外分隔符和位置坐标。

CPU 预处理器会检测模型自己的 processor 是否已经展开过标记；已经完成就读取对应范围，否则按模型给出的更新规则补上，再检查媒体数量、更新条目和占位范围是否一致。调用方提前给了文本编号时，也仍要处理媒体和这层对应关系。某些模型的处理器要求文字与媒体一同输入，框架会为媒体处理准备匹配的临时文字；是否走这条路径取决于模型与版本，不能把它当成所有请求都会再套一次真实聊天模板。

### 三种缓存各自省掉哪一步？

| 缓存 | 保存什么 | 命中后省掉什么 |
|---|---|---|
| 多模态 processor cache | CPU 媒体预处理的输出及其占位更新信息 | 相同媒体的重复预处理；媒体特征仍需由编码器计算或从另一层缓存取得 |
| encoder cache（EC） | 媒体编码器已经算出的特征向量 | 对应媒体的重复编码；语言模型仍继续处理输入 |
| KV cache / prefix caching | 语言模型各层对此前位置计算出的历史 | 满足前缀和模型条件时，省相应语言层前缀计算 |

仍用 A、B：若 CPU 缓存只有 A，预处理器只新处理 B，再把缓存 A 与新 B 按原顺序合回 [A,B]，并重建本次消息里的占位位置。不能把新处理结果 B 排在前面，否则图片与文字会错配。直通的预计算特征另走自己的处理分支，不能从“CPU 媒体缓存命中”推断这类输入的行为。

EC 的本机共享、跨实例交接及资源边界见[编码器分离与缓存](pd-disaggregation.md#带图像的请求再把编码器分出去epd)，外部 EC 存储见[UCM 编码结果复用](ucm.md#多模态还有一份编码结果可以复用)。这三类缓存分别占用空间，清掉一种不会自动清掉另两种。

在这三步计算之前，还能把 HTTP 下载的**原始媒体字节**缓存在本地目录。它以完整 URL 生成键；命中后省去再次下载，仍需解码媒体，再进入预处理、编码和语言模型。这个目录与上面的三类缓存分别管理，媒体 UUID 也不是它的键。

例如同一图片地址连续被请求，第二次可以从磁盘读取图片文件。若服务器把该地址的内容换了，有效的旧缓存条目命中时仍会给出旧字节，因此内容更新时应换用新地址。缓存命中会刷新文件时间；默认 24 小时从最近写入或访问计算，读取或后续写入时才检查过期，没有后台定时清理。写入后先清过期文件，再按最近访问顺序淘汰旧项；刚写入的文件受保护，若它本身大于配置容量，保留这一文件就已超出目标。所以这个容量是淘汰目标，不能拿来保证磁盘占用的硬上限。

### 给媒体一个固定编号，就能不再上传吗？

UUID 在这里是调用方给某份媒体内容的稳定身份，不要求它是一串特定格式的随机数。默认可以按媒体内容计算缓存身份；主动提供身份时，调用方必须保证同一身份对应同一内容及兼容的处理方式。换了图片还沿用旧身份，会有复用错内容的风险。

以上面的图片 A 为例，第一次提交实际内容和身份，之后才可以在预期命中的请求中只带身份、把图片留空。**省略内容依赖实际缓存命中，也依赖该版本的模态解析器接受空项**：条目可能被淘汰、落在另一 API 进程或尚未建立；缺内容又未命中会报错。多张图片的身份列表须与数据顺序和数量对应，某项没有自定义身份时可以让该项按内容生成。旧版音频解析器不能照搬这个省略写法，版本表另列。主机预处理缓存和前缀缓存都关闭时，显式身份的处理在 `v0.30.0` 与早期快照不同；保留身份本身也不会创建一份不存在的缓存。

### 已有媒体向量，还需要哪些布局信息？

预计算媒体嵌入绕过对应的编码计算，但仍须符合当前模型的输入契约。最后一维常与语言模型宽度对应，前面的维度、附加坐标和特征层数由模型决定。Qwen2-VL 的图像网格描述时间、高度和宽度，用来计算位置；MiniCPM 的图片尺寸参与切片解释；Qwen3-VL 的输入还需要其 deepstack 特征——供语言模型中间层继续使用的额外视觉表示。开启这条路径时，输入包含基础与额外两部分，不能只拿一份普通图片矩阵替代。

在线 Chat 要按**每张媒体一个内容项**提供向量，让模板保留各自位置；离线入口可以按模型约定使用批张量、列表或带布局字段的字典。把两张图的所有向量拼成一个内容项，可能让占位数量和真实特征对不上。文本 prompt_embeds 的入口不能替代这些媒体字段；具体字段与配置集中在下方源码区。

### 视频和音频在前端还要处理什么？

视频还需要时间信息。客户端提前抽出图片帧时，要一起保留帧率、原帧编号和总时长等元数据；三张相邻帧和三张相隔十秒的帧，虽然张数相同，描述的是不同时间跨度。模型会按自己的视频处理方式消费这些信息，不能只把抽帧数量当成完整视频输入。OpenCV 路径可选坏帧恢复：在读取失败后尝试用下一目标帧之前的可读帧替代；这是换用另一帧，可能改变观察到的内容，也不保证补齐全部坏帧。固定实现只顺扫到最后一个目标帧，最后目标失败不会再向视频结尾寻找。

音频要同时给采样值和正确的采样率，解析器按模型目标做重采样；要求单声道的模型还会整理声道，默认将多个声道求平均。这是声道形状的转换，不是把音量统一成某个响度。分段转写则是另一层：长音频可以在接近每段上限的低能量位置切开，尽量避开说话中间。例如上限30秒、末尾1秒用于搜索时，先在第29–30秒内找安静切点，下一段从该切点接着读；“搜索窗口有重叠”不代表最终输出片段重复保留一秒。

这类音频切分由转写入口的模型配置决定，或由离线调用方显式使用切分工具。它不是所有带音频的 Chat 请求都会做的通用步骤，也不等同于语言模型的 chunked prefill。先整理为模型要求的单声道，再切分；旧版切分器的边界保护与新版本不同，见下方版本表。

## 换成 DeepSeek Recipe，入口负责到哪里

DeepSeek Recipe 把 Messages、Chat Completions、Responses 等接口格式先转换为统一对话，再渲染为 DeepSeek 的提示词，并配合调用者提供的分词器得到编号。返回时，它把推理后端的输出解析为对应协议事件。**模型推理、工具执行和 HTTP 传输仍由调用方提供**。解析出“调用某个工具”的描述，不等于已经执行了工具。

这给排查提供了几条清楚的边界：同一请求得到不同结果，先比转换后的对话、[模板及输入编号](token.md#deepseek-recipe控制标记与用户文字怎样分开)，再比真正发给后端的采样与输出限制。收到事件却没有到达客户端，则接着查[流式返回](streaming-output.md#deepseek-recipe编号流与文本流的边界不同)及传输。收到工具调用后没有后续动作，要查调用方是否执行并回填了工具结果。

输入长度也要在编码后核算；图片展开后的额外 token 占用需要计入，再决定剩余输出空间。接口接收了 schema，只说明转换阶段接受这个要求，是否在采样中限制非法输出，要另查[结构化输出的后端约束](structured-output.md#协议接受了-schema是否就已经约束采样)。

## 工具模板、解析器和插件，分别接在哪一侧？

工具调用要把两端接起来：**输入端的模板告诉模型有哪些工具、怎样写调用；输出端的解析器把模型写出的内容拆成函数名和参数。** 例如同一个查天气函数，某种格式写成 JSON 对象，另一种写成方括号包住的函数调用。模型按后一种格式写，解析器却只认前一种，接口就不能按预期还原调用；换一个解析器也不会自动改好模型输入。

| 请求走到哪里 | 这一层负责什么 | 使用时要配合什么 |
|---|---|---|
| 入口套模板 | 把工具定义、历史调用和工具结果放入模型熟悉的位置 | 模型的专用模板及其消息格式 |
| 模型生成内容 | 根据提示生成普通回答或工具调用 | 训练时的调用格式；需要参数硬约束时另看[工具调用与文法](structured-output.md#工具调用能解析出来就说明参数符合-schema-吗) |
| 前端解析输出 | 把生成内容整理为接口中的调用列表 | 能识别该模型输出格式的解析器 |
| 应用处理结果 | 检查函数名与参数，执行工具，把结果接回对应调用 | 保留调用编号，下一轮带上调用及结果 |

插件是把**额外的解析器实现载入前端**的一种方式。载入文件后，还要把解析器注册成一个名字，再用这个名字选择它。它不会替换聊天模板，也不会因为文件成功载入就自动获得严格参数约束。内置解析器已经匹配模型时，直接选择内置名字即可。

官方提供的模板也有各自的边界。固定示例中，Llama 3.1/3.2 的 JSON 模板要求一条历史 assistant 消息恰好包含一次工具调用；相应的 Pythonic 模板则按列表写调用。Mistral 的两份模板要求调用编号和回填编号至少有 9 个字符，再取末 9 个写入提示。DeepSeek V3 的模板在函数名外写函数类型及 JSON 代码围栏，V3.1 的模板改用另一套连接方式；不能只看名字相近就替换。把多调用历史交给只接受单调用的模板，可能在模型计算之前就失败。

因此先按模型版本核对工具格式，再决定是否覆盖模型自带模板。模板要能同时处理工具定义、assistant 的历史调用和 tool 的结果；只在系统提示里列出函数名还不够。可以用同一条查天气请求走完一次“生成调用—应用执行—回填结果”，再检查多调用和流式返回是否符合所选格式。下面的 GLM 主线沿用它自己的模型模板与解析器组合。

## 放到 GLM 双机：node0 上一个前端接下全部请求

**主线把 GLM-5.3-Flash 部署在两台昇腾服务器上，每台 8 张 NPU 卡，两台各是一个 DP 组（部署条件见 [部署前提](glm-5-3-flash-two-node.md#部署前提)）。入口只在 node0 上：一个 API server 接下两台机器的全部请求，上面七步都在 node0 的 CPU 上做；vllm-ascend 没有改这一段。** 本页对应主线的 [第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

**谁在接请求。** node0 的启动命令把前端个数设成 1，于是执行 vllm serve 的那个进程自己就是 API server，监听 8000 端口；node1 以无前端（headless）方式启动，只起本机那一组的 EngineCore，见 [双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)。教程没有改套模板和分词用的线程数，所以两组所有请求的套模板和分词，都排在 node0 这个进程的 1 个工作线程上；反分词也在这个进程里做。

**请求怎么写。** 启动命令给模型起的对外名字是 glm，请求里的模型名要么写 glm，要么不写，写成模型目录名会被第 ① 步以 404 拒掉。启动命令没有另给聊天模板，聊天接口用的是模型目录自带的那一份：一条消息套完会多出 6 个特殊标记和一行系统说明，详见 [token 页的 GLM 一节](token.md#r1-在入口拿到了什么)。教程里验证服务的示例请求走的是老式补全接口，所以不套聊天模板；它写的是 max_completion_tokens 为 50，但补全接口没有这个字段，按上一节的规则被忽略，实际最多只生成 16 个 token。想要 50 个，补全接口要写 max_tokens，或者改走聊天接口。请求不写采样参数时，用的是模型生成配置里的默认值，见 [请求不写采样参数时用的是什么](sampling.md#请求不写采样参数时用的是什么)。

**长度上限。** 启动命令把总长度上限设为 133120。主线的示例请求 R1 约定套完模板、分词后是 4 个编号（演示设定，见 [示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），输出上限沿用主线 [第 7 站](one-request.md#第-7-站-返回与收尾) 的设定，max_tokens 为 200。按第 ③ ④ 步的规则：

$$L_{\text{in,allow}} = 133{,}120 - 200 = 132{,}920, \qquad L_{\text{out}} = \min(133{,}120 - 4,\; 200) = 200$$

| R1 入口长度核验（$L_{\max} = 133{,}120$） | 算式 | 结果与说明 |
| --- | --- | --- |
| 允许的最大输入（取 `max_tokens=200`） | $133{,}120 - 200$ | **132,920 个**（R1 提示词 4 个在允许范围内） |
| R1 有效输出上限 | $\min(133{,}120 - 4,\; 200)$ | **200 个** |
| 若聊天请求两项输出上限都不写 | $133{,}120 - 4$ | **133,116 个**（本部署按剩余上下文补齐） |

**工具调用要配解析器与模板。** 主线的启动命令没有指定工具调用解析器，也没有指定把思考过程单独拆出来的推理解析器。所以把 tool_choice 设为 auto 的请求，会在第 ① 步被拒。对本页普通 HF tokenizer 路径，required 或指定函数名同样要求 tool-call parser；它们不要求打开自动工具选择。auto 则还要 enable-auto-tool-choice，不能用“只有 auto 需要解析器”来理解。教程的常见问题给的是工具解析器 glm47、推理解析器 glm45，再打开自动工具选择；还写明这个模型不支持关闭思考的开关（enable_thinking）。旧 glm47 的解析与参数约束要分开，具体边界和 strict 的版本条件见[工具调用与文法](structured-output.md#工具调用能解析出来就说明参数符合-schema-吗)；解析出的调用要由应用校验参数、执行并回填工具结果。

tool_choice=none 表示本次不选择工具，但默认仍把 tools 定义交给模板；只有服务配置 exclude_tools_when_tool_choice_none 时才排除。因此切到 none 不保证提示词变短，实际输入还要看模板怎样使用工具定义。

**R1 怎样离开入口。** 前端登记好 R1 的反分词器和输出槽后选组：R1 到达时两组都空着，得分相同，落到 DP0，也就是同在 node0 上的那个 EngineCore，打分过程见 [DP 请求路由的 GLM 一节](dp-request-routing.md#放到-glm-双机node0-上一个前端给两台机器派活)。两组引擎分在两台机器上，所以前端和引擎之间的 ZMQ 用的是 node0 上的 TCP 端口，见 [进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。到这一步，node1 的引擎还不知道 R1 存在。

**vllm-ascend 没有碰入口。** 在钉住的版本里，vllm-ascend 对聊天接口打的补丁只改输出那一侧：修正 GLM 流式返回工具调用时最后几段的拆法，属于 [流式输出](streaming-output.md) 的范围。套模板、分词、建请求、登记和选组，走的都是 vLLM 原样的代码。

## 常见误解

- **「API server 把请求交给引擎，就没它的事了。」** 它在发送之前就登记了反分词器和输出槽，此后每一步的结果都回到这里还原成文字，请求结束才删记录。在途请求越多，前端占的 CPU 和内存越多，见 [每个进程里存着什么](engine-processes.md#每个进程里存着什么)。
- **「流式请求收到 200，说明引擎已经接下了它。」** 200 在请求交给 AsyncLLM 之前就发出了；编号越界、组号越界这类错误之后才查，只能作为流里的一条错误消息出现。
- **「采样在入口做。」** 入口只把 temperature、top-p 这些设置定成参数并校验；按参数选出 token 是第 5 站 worker 上的事，见 [采样](sampling.md)。
- **「提示词长度按用户打的字数算。」** 按套完模板、分词后的整串编号算，模板加进来的特殊标记和系统说明都算；长度上限检查用的也是这个数。
- **「聊天接口里让分词器再补一遍特殊标记更保险。」** 模板已经写好了起始标记，再补一遍开头就重复了，长度和模型看到的格式都会变；只有不套模板的补全接口才默认补。
- **「请求一进引擎就开算。」** 引擎的输入线程先把它建好放进输入队列，等这一圈计算做完、下一圈开头才进 waiting，什么时候算由调度器决定，见 [vLLM scheduler](vllm-scheduler.md)。
- **「请求头里的 X-Request-Id 就是引擎里的请求 ID。」** 返回给客户端的是「chatcmpl-」加上它，内部再加 8 位随机字符；n 大于 1 时，各子请求还在前面加候选序号。因此内部 ID 包含对外 ID，但不总以它开头；查日志时按包含关系关联，并保留候选序号。

## 对照源码

### 怎么开

**按任务选择接口。** Responses 用 `/v1/responses`，input 必填；max_output_tokens 默认 None，仍受模型长度与生成预算约束。store 字段默认 true，background 和 stream 默认 false；服务环境 `VLLM_ENABLE_RESPONSES_API_STORE` 默认 0，设为 1 启用保存。需要后台响应时，request.store 与服务保存开关都必须开启；后台模式不会自动开启持久存储。previous_response_id 引用已保存的响应，不能与 previous_input_messages 同时指定。Messages 用 `/v1/messages`，需提供 model、messages 和正数 max_tokens，stream 默认 false。

Embedding 使用 `/v1/embeddings`；分类、打分、重排和通用 pooling 分别有 `/classify`、`/score`、`/rerank`、`/pooling`。这些入口受模型支持任务和所选 pooling 任务限制；只改 URL 不会给生成模型补上 embedding 或分类头。输入为两条文本时，embedding 得到两项向量结果；rerank 则把 query 与候选 documents 比较，结果保留候选 index，不能把返回顺序当成输入序号。

**语音上传与实时事件。** 文件转写用 `/v1/audio/transcriptions`，翻译用 `/v1/audio/translations`，均传 multipart file；response_format 默认 json、stream 默认 false、use_beam_search 默认 false、n 默认 1、temperature 默认 0.0。这里 n 在 beam 模式表示束数，不能直接套 Chat 的 n 个独立回答解释。基线虽接受 text 选项，非流式路由仍把带 text 字段的结果包装成 JSON，不能仅凭参数名假定返回纯文本 Content-Type。verbose_json 还受模型时间戳能力与非流式条件限制。上传文件上限由 `VLLM_MAX_AUDIO_CLIP_FILESIZE_MB` 控制，默认 25，消费者按 MiB 换算。

实时入口为 `/v1/realtime`。以下是事件顺序片段，model_name 要换成该实时服务的对外模型名，audio_base64 是已经转换为 PCM16 / 16 kHz / 单声道的某一段音频，不是字面占位字符串：

```python
{"type": "session.update", "model": model_name}
{"type": "input_audio_buffer.commit"}
{"type": "input_audio_buffer.append", "audio": audio_base64}  # 可重复多段
{"type": "input_audio_buffer.commit", "final": True}
```

客户端须先接收 session.created，再依次发送这些事件并读取服务返回。官方文件示例与麦克风示例给出两种输入组织方式；生产客户端的连接管理和设备支持要按自己的运行环境核对。实时连接中的音频队列及其长度检查与 multipart 文件读取是两条实现路径，不用上传文件的 25 MiB 公式推断整条实时会话的容量。

**独立 CPU renderer** 使用 `vllm launch render MODEL`，MODEL 应与生成服务匹配，模板、tokenizer、对外模型名及生成约定也要一致。Chat 预处理地址是 POST /v1/chat/completions/render，Completion 是 POST /v1/completions/render；前者返回一份生成请求，后者按各 prompt 返回列表。调用方再把每份结果提交到生成服务的 POST /inference/v1/generate，而不是把 render 地址当作会自动转发的代理。这里只列接口连接方式，设备端仍按其平台和模型的完整命令启动。

v0.26 起，完整结果后处理可调用 POST /v1/chat/completions/derender 或 /v1/completions/derender。Chat 传 generate_response、原 chat_request 和 prompt_tokens；Completion 传单个原 completion_request，generate_responses 与 prompt_tokens 则是按各 prompt 对齐、长度相同的列表。rc2/main 的逐片段请求在同一地址设置 stream=true，传 generate_chunk 及上一轮 stream_state，响应包含 chunk 与更新后的 stream_state。第一轮状态可省略；不能另猜一个 /derender/stream 路径。

普通 serve 是否暴露这些拆分接口还有版本开关：rc2 使用默认 false 的 `--enable-scale-out`；固定 main 改用环境变量 `VLLM_ENABLE_SCALE_OUT_ENDPOINTS=1`。main 的未设置或空字符串表示未显式选择，0 表示禁用，1 表示启用，其他值拒绝。专用 render/tokens-only 入口要求这些接口；main 显式设为 0 会冲突报错。完整版本对照见下表。

**媒体入口与CPU预处理缓存**使用下面这组配置；它们与文本 prompt_embeds 分开。HTTP Chat 的图片内容项可写成 `{"type":"image_url","image_url":{"url":"https://example.com/a.jpg"},"uuid":"image-a-v1"}`。这里的地址和身份只是结构示意，实际请求要换成可取得且内容稳定的媒体；文字与媒体的顺序由 content 列表和模型模板保留。离线使用 prompt 或 prompt_token_ids、multi_modal_data，并可按模态提供 multi_modal_uuids。

| 配置入口 | 固定基线默认 | 消费位置与使用条件 |
|---|---|---|
| --enable-mm-embeds / enable_mm_embeds | false | 允许媒体预计算特征；图片用 image_embeds，模型所需网格/尺寸等一起提供。它不打开文本 prompt_embeds |
| --media-io-kwargs / media_io_kwargs | 空字典 | 按模态给加载器传选项，例如视频帧数、图片透明背景颜色；不能代替模型的 processor 选项 |
| --mm-processor-kwargs / mm_processor_kwargs | None | 传给模型的媒体 processor；可用字段由该模型定义，例如裁剪设置 |
| --mm-processor-cache-gb / mm_processor_cache_gb | 4，单位 GiB | CPU 预处理缓存的容量设置；0 关闭，不能据此关闭 encoder cache 或 KV cache |
| --mm-processor-cache-type / mm_processor_cache_type | lru | lru 使用镜像缓存；shm 使用共享内存 FIFO。实际是否建立进程间缓存还要看下方拓扑条件 |
| --mm-shm-cache-max-object-size-mb / mm_shm_cache_max_object_size_mb | 128，单位 MiB | 仅 shm 有效，限制单个缓存对象；不是整池容量，也不决定图像分辨率 |

固定实现只有在 **API 进程数为 1，且 DP=1 或采用 external LB** 时才选择进程间 lru/shm 缓存。lru 的接收缓存位于 EngineCore，shm 的接收端位于 worker；其他拓扑退到 processor_only，只缓存 CPU 预处理。容量设置还须按实际创建的缓存实例核算，不能不看这个分支就将每个 DP 组再加一份。缓存预算也不是服务启动时一定已占满的主机内存。

普通图片的每项在线向量形状通常是“该图片特征位置数 × 模型宽度”；Qwen2-VL 还需 image_grid_thw（在线单项为3个数），MiniCPM-V-2_6 还需 image_sizes（在线单项为宽、高两个数），其余特征布局按模型约定。完整在线/离线示例和模板入口见页末固定多模态指南；本页不把这些模型的示例字段套成 GLM 通用输入。

媒体获取和解码使用独立设置：

| 设置 | 默认或示例 | 控制哪一步 |
|---|---|---|
| VLLM_IMAGE_FETCH_TIMEOUT / VLLM_VIDEO_FETCH_TIMEOUT / VLLM_AUDIO_FETCH_TIMEOUT | 分别5 / 30 / 10秒 | HTTP媒体下载的初始尝试超时；固定基线的重试会增长单次超时并等待，因此不是整个请求的总时限，也不包括模型推理 |
| media_io_kwargs 的 video.frame_recovery | 默认false；需要时设true | OpenCV解码路径的向前找可读帧；仍要检查最终取到的帧及索引，不能保证修复视频 |
| 视频帧序列的附加信息 | fps、frames_indices、total_num_frames、duration；需要时还有do_sample_frames | 客户端已抽帧时保留原时间关系；SDK用extra_body；HTTP顶层是media_io_kwargs，帧信息放在它的video字典内 |
| 离线 split_audio 参数示例 | max_clip_duration_s=30、overlap_duration_s=1、min_energy_window_size=1600，采样率16000 Hz | 30秒上限对应480000个样本；在末尾16000样本内用1600样本的小窗口找低能量点。这是一组示意值，实际取值按转写模型约束 |

需要复用 HTTP 下载时，在启动进程前设置下面三个环境变量。数据内联的 data URL 和本地 file URL 不走这条下载缓存；目录创建或可写性检查遇到 OSError 时，会告警并关闭这项缓存。容量或有效期的非法数字会在环境值转换时报错，不属于这个关闭分支。缓存读写也会增加本地磁盘 I/O，远程内容经常变化或很少重复时，应先判断节省的下载是否值得。

| 环境变量 | 默认 | 含义 |
|---|---|---|
| VLLM_MEDIA_CACHE | 空字符串，关闭 | 原始媒体字节的缓存目录；例如 /var/cache/vllm-media，需按部署提供可写空间 |
| VLLM_MEDIA_CACHE_MAX_SIZE_MB | 整数 5120 | 实际乘以 1024²，即 5120 MiB（5 GiB）；写入后触发淘汰，不是严格的磁盘配额 |
| VLLM_MEDIA_CACHE_TTL_HOURS | 浮点数 24 | 以最近访问时间计算的有效期，单位小时；命中会刷新，0 不表示永久保存 |

媒体类型、下载地址和模板支持必须一起确认。Chat 图片、视频分别使用 image_url、video_url；音频可用 audio_url 或带base64数据与格式的 input_audio。本地媒体路径须由服务端 allowed_local_media_path 允许。远程下载域名与重定向设置按服务的访问范围配置，相关域名限制和加载格式见固定指南。加长下载超时不会解决模板不匹配、错误向量形状或模型本身不支持该模态。

**HTTP 连接复用的空闲等待。** 一次响应结束后，客户端可以在同一连接上发下一次请求，省去重建连接；VLLM_HTTP_TIMEOUT_KEEP_ALIVE 决定服务端为这种空闲连接等多久。它是环境变量，按整数字符串解析，单位秒，默认 5；serve 入口把它传给 Uvicorn 的 timeout_keep_alive。GLM 教程未显式设置，环境也未预设时采用 5 秒。

需要给下一次请求留 30 秒空闲窗口时，在启动 API server 前设置 `export VLLM_HTTP_TIMEOUT_KEEP_ALIVE=30`。例如前一响应结束后空闲 8 秒才发下一请求，默认窗口已过，客户端应重连；30 秒窗口则允许保留连接。这是示意，不是生成耗时测量。正在生成的响应、首 token 等待、SSE 两段输出的间隔都不是这里所说的“响应结束后的空闲”；它也不会生成流式心跳或覆盖代理/客户端自己的超时。响应期间的注释保活由[流式输出的 SSE 设置](streaming-output.md#怎么开)说明；EngineCore 与 HCCL 等待见[调用链](request-call-chain.md#怎么开)。

该变量不是 Chat 请求字段，也不是单条请求的总执行时限；在请求 JSON 中加入同名键不会改变服务端连接设置。vLLM getter 只做 int 转换，不提供 None 或“无限”等特殊字符串语义，也没有单独的非负范围校验；调整时使用明确的非负秒数，0 不应解释为无限保活。

入口没有单独的总开关，普通 vllm serve 会启动前端；headless 分工见下方。先把“从哪加载、向外叫什么、监听哪里”分开：

| 作用 | 启动入口与定义默认 | 实际含义 |
|---|---|---|
| 加载模型 | serve 后的位置参数；内部 model 字符串，默认 Qwen/Qwen3-0.6B | Hugging Face 仓库 ID 或本地模型目录，决定读哪份配置和权重。正式部署显式给路径，不依赖这个通用默认 |
| 对外命名 | --served-model-name；served_model_name 默认 None | 可给一个或多个字符串；省略时用模型名称/路径。多个名字是同一基座模型的别名，不会加载多份模型 |
| 监听地址 | --host；host 默认 None | 普通 TCP 路径把 None 转成空地址，绑定所有 IPv4 接口；教程显式写 0.0.0.0。0.0.0.0 是有效绑定地址，不是字段默认，也不是客户端应填写的远端地址 |
| 监听端口 | --port；port 为整数，默认 8000 | 前端 HTTP 端口；固定监听通常选 1–65535，0 交由系统分配临时端口，不表示关闭。不是 DP、HCCL 或 ZMQ 的内部通信端口 |
| 配置文件 | --config；config 默认 None | 一个 .yaml/.yml 文件路径，将文件键转换为启动选项；只属于服务 CLI，不是模型 config.json，也不是请求字段 |

例如，示意模型放在 /models/example，命令片段写 `vllm serve /models/example --served-model-name demo demo-v1`，请求的 model 可以用 demo 或 demo-v1；基座模型响应使用第一个名字 demo，指标的 model_name 也取第一个。省略该选项时才用 /models/example 作为对外名字。模型名校验允许请求省略 model；其余名字还要按前文的 LoRA 条件判断，无法找到可用模型时拒绝。给已有部署改别名，只改变接口名称；配置、执行实现、权重与分词器来源的选择见 [模型解析与加载](npu-worker-lifecycle.md#装权重之前怎样知道要构造哪一种模型)，分词器模式见 [token 页](token.md#怎么开)。GLM 教程只设 glm，所以上文按 glm 检查。

YAML 的顶层键写 CLI 的长选项名，去掉两个横线，复合名字保留连字符。下面是**入口配置示意**，不是 GLM 双机的完整部署文件；并行、量化等参数仍按[完整命令](glm-5-3-flash-two-node.md#部署前提)填写。

```yaml
model: /models/example
served-model-name: [demo, demo-v1]
host: 0.0.0.0
port: 8000
chat-template-content-format: auto
trust-request-chat-template: false
```

用 `vllm serve --config server.yaml --port 8001` 启动时，端口是 8001：同一选项按**命令行覆盖 YAML，YAML 覆盖定义默认**。另写位置模型会覆盖文件的 model；兼容的 --model 写法会先被转成位置参数并告警，优先使用位置写法。只带配置文件而未在命令或文件中提供模型，会报缺模型，不能用 ModelConfig 的默认名称解释这条 CLI 分支。只传一个配置文件；字典值转为 JSON，列表展开为多个参数。基线与 v0.26 会略过 false 和空列表，null 则转成字符串 None，均不能笼统理解为“清空先前配置”；main 的 false 行为见版本表。

聊天还有两个服务端设置。`--chat-template-content-format` 对应 chat_template_content_format，默认 auto，合法值为 auto、string、openai。它控制**交给模板的消息 content 形状**：string 把文本内容整理成字符串，openai 保留形如 [{"type":"text","text":"你好"}] 的内容块列表；不是返回 JSON 的格式开关。auto 解析选中的模板来判断，无法识别时回到 string；基线与 v0.26 的显式值直接使用，不再做自动检测。模板按块遍历就配 openai，按字符串拼接就配 string；选错可能渲染报错或改变 prompt。模板本身的选择和加载见 [token 页](token.md#怎么开)。

`--trust-request-chat-template` 对应 trust_request_chat_template，默认 false；开启只表示允许请求改模板，不会替请求编写模板。关闭时，请求 chat_template 不是 null（包括空字符串），或者 chat_template_kwargs 内的 chat_template 值不是 null，都会被入口拒绝，而不是悄悄忽略。普通模板变量（例如 enable_thinking）不因这个守卫而全部禁止，是否生效仍由模型模板决定。开启后，请求的非空 chat_template 可覆盖服务模板；空字符串会回落到服务模板。服务运营方需要固定 prompt 格式时保持关闭；不要把它与允许执行模型仓库代码的 trust_remote_code 混为一项。

**思考强度怎样进入模板。** reasoning_effort 是 Chat 请求顶层字段，默认 None，接受 none、minimal、low、medium、high、xhigh、max；其中 max 是 DeepSeek V4 的特定值，枚举被接受不代表每个模型支持全部档位，也不对应框架统一规定的 token 配额。四版构造模板参数时，只要显式给了该字段，且本次 chat_template_kwargs 没有 enable_thinking 键，就自动补入 enable_thinking：none 对应 false，其他合法值对应 true。本次请求显式提供 enable_thinking 时保留该值；顶层 reasoning_effort 则覆盖 kwargs 里同名的强度值。最后用请求有效字段覆盖服务的模板默认值。

例如服务默认 enable_thinking=false，本次只给 reasoning_effort=high，自动补入的 true 会覆盖这个服务默认；若请求还显式给 chat_template_kwargs.enable_thinking=false，模板最终收到 false 与 high。两者如何解释由模型模板决定，框架不会替模型保证这是一组有意义的组合。模板参数还会按实际声明和分词器接受的参数过滤，模型不认识的开关不会因此产生新能力。固定 GLM 的关闭思考限制见[结构化输出的模型条件](structured-output.md#思考阶段官方命令从第一个输出-token-起就约束)；仅隐藏返回与控制生成的区别见[流式输出](streaming-output.md#隐藏思考少思考和不思考是同一个开关吗)。

其余已讲机制的相关设置如下，GLM 主线取值见括号：

- `--api-server-count`：前端进程个数；不写时按部署方式取默认，DP 由本前端统一派活（internal LB）时取 DP 组数，external LB 等取 1；等于 1 时由 vllm serve 进程自己当前端，`--headless` 的机器不起前端（node0 为 1，node1 headless）。
- `--max-model-len`：总长度上限，入口按它查长度、补输出上限（133120）。
- `--chat-template`：指定服务模板（未设），加载契约见 [token 页](token.md#怎么开)；本部署也未打开请求模板信任。
- `--enable-auto-tool-choice`、`--tool-call-parser`、`--reasoning-parser`：工具调用与推理解析（未设；教程常见问题给的是 glm47、glm45）。

自定义工具解析器另用 `--tool-parser-plugin`（配置 tool_parser_plugin），默认空字符串；tool_call_parser 默认 None，enable_auto_tool_choice 默认 false。插件导入和选用是两步：插件模块执行注册，把一个 ToolParser 子类绑定到名字；服务用 `--tool-call-parser` 选择这个名字。对已经实现好的 MyToolParser，可以在模块中调用 `ToolParserManager.register_module(name="my_parser", module=MyToolParser)` 完成显式注册。只定义类、只传文件路径、或者把类名误当成另一个注册名，都不能替代这一步。

例如，以下只展示服务参数之间的对应关系；模型路径、插件文件和匹配模板必须已经准备好，插件还须实现整段输出与流式增量的解析方法：

```bash
vllm serve /models/my-model \
  --tool-parser-plugin /srv/parsers/my_parser.py \
  --tool-call-parser my_parser \
  --enable-auto-tool-choice \
  --chat-template /srv/templates/my-model-tools.jinja
```

模型自带模板已经支持该工具格式时，可省去最后一项；模板加载细节仍见 [token 页](token.md#怎么开)。注册管理器也支持延迟加载：登记的是模块路径和类名，真正取解析器时才导入并检查类型。四个固定版本中的 register_module 装饰器走这条延迟路径；register_lazy_module 的 module_path 必须是实际可导入的模块，不能把官方示例中的占位模块路径原样搬到任意外部文件。

启动准备阶段和 API worker 初始化阶段都会检查插件参数；四版均只在该字符串非空且长度大于 3 时尝试导入。插件及其依赖因此要能在实际运行前端的环境中找到。导入会执行模块代码，注册成功也只增加解析能力；工具参数是否进入文法约束仍按[严格工具调用的条件](structured-output.md#怎么开)判断。插件语法或依赖错误、注册名不匹配、模板格式不匹配，分别发生在不同位置，不应都归因于模型权重。
- `--renderer-num-workers`：套模板和分词的线程数，默认 1（未设）。
- `--generation-config`：采样默认值从哪来，见 [采样](sampling.md)（未设，取模型目录的生成配置）。
- 请求头：`X-Request-Id` 指定对外请求 ID；`X-data-parallel-rank` 指定 DP 组号，不是整数时当作没写。
- 环境变量：`VLLM_SKIP_MODEL_NAME_VALIDATION` 跳过模型名检查；`VLLM_DISABLE_REQUEST_ID_RANDOMIZATION` 不加随机后缀（已标记将移除）；`VLLM_KEEP_ALIVE_ON_ENGINE_DEATH` 引擎停止后前端不退出。

**总长度是启动配置，输出预算是请求配置。** `--max-model-len` 对应 EngineArgs / ModelConfig 的 `max_model_len`，离线 LLM 也通过同名关键字传给引擎；它限定一条序列的输入与输出总和。HTTP 请求的 max_tokens 不能把它调大，也不能把 max_model_len 放进请求 JSON 来修改服务容量。启动配置的推导与请求预算分两步：先定服务可以接多长，再按本页已有的减法为每条请求分配输出空间。

| 启动取值 | 解析与有效值 | 容量不足时 |
|---|---|---|
| 省略；Python 传 None | 定义默认 None，从模型配置推导；结合相关分词器限制、滑窗设置、位置编码缩放和平台限制，最终必须是正整数 | 检查能否装下一条最大长度请求，放不下则启动失败；不会因为省略就自动缩短 |
| 正整数，如 133120 | 显式服务上限；仍检查模型声明的长度范围 | 同样做 KV 容量检查 |
| CLI 的 auto 或 -1；Python 的 -1 | 先取模型推导上限，再在引擎取得各 worker 的 KV 预算后，找所有 worker 都能容纳的最大长度；只会维持或缩小该上限 | 一条请求也放不下则失败，不会扩充设备内存 |

模型没有可用于推导的长度字段时，普通缺省路径警告并回退到 2048；草稿模型另可继承目标模型长度。auto 依赖能先推导出合法上限：若模型完全没有长度信息，-1 可能在这一阶段被原样返回，随后正整数校验失败，并不是所有模型都能自动探出长度。显式值超过推导值时，还会检查模型另行声明的 model_max_length；两者都不允许才报错。环境变量 VLLM_ALLOW_LONG_MAX_MODEL_LEN 可以绕过这项越界保护，但不会扩展模型训练过的上下文能力或增加 KV 容量。

CLI 支持带单位的长度：1k 是 1000，1K 是 1024，25.6k 是 25600；二进制后缀不接受小数，因此 1.5K 非法。Python 直接传整数，不把字符串 auto、133K 当作 CLI 解析。GLM 教程两端使用以下**启动参数片段**，应保留[完整双机命令](glm-5-3-flash-two-node.md#部署前提)的模型、并行和地址参数；它不是单机启动命令，也不是通用默认：

```bash
--max-model-len 133120
```

在已有离线模型构造参数中，对应写法是 `LLM(model=model_path, max_model_len=133120, **other_engine_args)`；other_engine_args 代表已有且不重复包含 max_model_len 的设备、并行与加载配置。这里没有启动第二份模型。GLM 的 KDA 块长也会参考这个长度，见[块规格参数](kv-cache-spec.md#怎么开)；改总长度后要重新核对缓存规划，不能只看 HTTP 长度校验通过了没有。auto 的容量搜索不保证并发能力，容量与并发的区别见[显存预算](kv-cache-memory-profiling.md#切成块各卡取最小块数不等于并发数)。

**输出预算是逐请求字段。** 下表针对普通文本采样；计数单位是新生成的 token，不是汉字、字节或前端最后显示的文字数。提示词不计入这个数，但与输出共用上下文空间。达到上限以 length 收尾；提前遇到结束条件仍会更早停，见[请求收尾](request-teardown.md#停止文字停止编号和忽略-eos-怎样配合)。

| 入口 / 字段 | 省略与 null | 合法值和优先级 |
|---|---|---|
| Chat 顶层 `max_completion_tokens` | 默认 None；null 表示本字段未指定 | 正整数；非 None 时优先于 max_tokens，包括非法的 0 也不会退回另一项 |
| Chat 顶层 `max_tokens` | 默认 None；两项都未指定时读取生成默认，没有则使用剩余上下文 | 正整数；旧字段仍支持，但已标记 deprecated |
| Completions 顶层 `max_tokens` | 省略为 16；显式 null 则改走生成默认或剩余上下文 | 正整数；这个接口没有 max_completion_tokens 字段 |
| Python `SamplingParams(max_tokens=...)` | 直接构造省略为 16；显式 None 由引擎补成剩余上下文 | 正整数或 None；没有 max_completion_tokens，也不自动读取 HTTP 服务默认 |

**默认值可以被请求替换，硬上限只能取小。** HTTP 入口先选择请求值；没有请求值才取服务生成默认中的 max_tokens。再与「总长度上限减实际输入长度」、服务端覆盖上限、平台上限取最小的非空值。这里的服务端覆盖上限有两种来源：generation_config 为 auto/vllm 时，取 override_generation_config 中显式设置的 max_new_tokens；指定其他生成配置目录时，取该配置合并覆盖值后的最大新 token 数。因此 auto 从模型文件读到的 max_new_tokens 是缺省预算，可以被显式请求替换；启动时显式 override 或指定目录提供的上限才是这一流程中的硬约束。分词阶段的超长校验仍先执行，不能依靠后面的取小把任何超长请求都变合法。

例如向已有 glm 服务的 `/v1/chat/completions` 发送以下 JSON（Content-Type 为 application/json）。两项都写时，本例按 64 做输出预算，不把 16 与 64 相加；实际输入也必须能与 64 一起放进上下文。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用一句话解释 KV cache。"}],
  "max_tokens": 16,
  "max_completion_tokens": 64
}
```

改用 Completions 时，用 prompt 替换 messages，删除 max_completion_tokens，并把 max_tokens 改为 64。离线写法是 `SamplingParams(max_tokens=64)`，传给已有 llm 的 generate；要继承离线模型默认，先取 llm.get_default_sampling_params()，规则见[采样参数入口](sampling.md#怎么开)。

**0 的特例只在 Completions 的 echo 回显模式。** echo=true 且 max_tokens=0 时，返回原提示词、不返回新生成文字；内部把采样上限改为 1，不能据此认为没有生成计算。普通 Chat、Completions 非 echo 模式和直接构造 SamplingParams 都不能用 0 关闭生成；负数也非法。输出上限还必须不小于[最少输出数](sampling.md#最少输出数怎样挡住提前结束)，到限是否保留停止标记由[停止条件](request-teardown.md#怎么开)另行决定。

**messages 与 prompt 选择输入协议。** 上面的 Chat 示例使用必填的 messages 消息列表；它没有缺省值，不接受 null。每条消息保留 role 与 content：普通问答用 user 文本，system 用于系统说明，assistant 表示已有回复，tool 及 tool_call_id 用于相应工具调用结果；角色和内容形状须同时满足接口与配套模板。空列表在这个字段定义上没有 min_length=1，不能把“字段类型通过”当作有效对话。不要把一段渲染好的 prompt 当成 messages 字符串，也不要把不同用户的独立对话混成同一列表。

纯文本 content 可以直接是字符串；图文消息用内容块，例如把示例中那条 user 消息的 content 替换成下面的数组（图片 URL 为占位，实际使用可访问的合法图片）。图片经媒体处理再与文本一起进入模型；GLM 教程允许一张图片、关闭视频，数量限制见 [token 输入参考](token.md#怎么开)。

```json
[
  {"type":"text","text":"描述这张图。"},
  {"type":"image_url","image_url":{"url":"https://example.com/image.png"}}
]
```

Completions 使用 prompt，定义默认 None。它可为单个字符串、单个非负 token ID 列表、字符串列表或 token ID 列表的列表；后两种代表多条独立输入，逐条生成，不会自动把它们拼成对话。例如 `"prompt":["问题甲","问题乙"]` 是两条输入，`"prompt":[10,11]` 是一条编号输入，`"prompt":[[10,11],[12,13]]` 是两条编号输入；这些编号只是形状示意，实际必须符合所用词表。普通文本生成没有 prompt_embeds 时，省略 prompt、null 和空字符串都会触发非空校验；空数组不是可用于生成的有效输入，不能用来请求“无条件开始”。prompt_embeds 是另一个需服务支持的输入路径，不把它当成普通字符串的替代默认。直接给编号时跳过文本编码，但仍有词表与长度校验，细节见 [token 页](token.md#会报什么错)。

**记录请求与 HTTP 日志。** `--enable-log-requests` 对应 enable_log_requests，默认 false；开启后创建 RequestLogger，并启用引擎的请求相关日志。INFO 记录请求 ID、采样参数等有限信息；输入文本和 token ID 详情要 DEBUG 才输出。`--max-log-len` 对应 max_log_len，默认 None，表示这些内容不截短；非负整数 N 只取字符串前 N 个字符、编号列表前 N 项。比如 N=32 不是 32 字节，也不是 32 个模型 token 的统一预算；0 会把相应内容切为空，仍可能记录请求 ID、参数等。实现没有负值下界检查，负数沿用 Python 切片，不能当作禁用或无限。它不改变实际送给模型的 prompt，也不限制整条日志长度。生成内容另由默认 false 的 --enable-log-outputs 控制，该开关还要求 --enable-log-requests；两者启用后输出内容按 INFO 记录，并受同一 max_log_len 截短。开启输入日志不会自动开启输出正文。

`--uvicorn-log-level` 对应 uvicorn_log_level，默认 info，选项为 critical、error、warning、info、debug、trace；控制 HTTP 服务器日志级别。vLLM 内部日志级别和周期统计见[性能分析的日志参考](inference-performance-analysis.md#怎么开)，两套级别不能互相替代。调试片段如 `--enable-log-requests --max-log-len 128 --uvicorn-log-level warning` 可减少 HTTP 噪声并限制请求内容；若要看输入详情，还须在启动前设置 VLLM_LOGGING_LEVEL=DEBUG。双机只有 node0 前端接 HTTP，node1 headless 的 Worker 日志仍要单独收集。

### 会报什么错

Responses 在服务保存开关关闭时请求 background 会失败；仅普通 store=true 请求则会被改成不保存。引用不存在的 previous_response_id 会返回未找到响应；应核对是否实际保存及是否命中同一记录所在的服务进程。实时 commit 在模型尚未验证时返回 `model_not_validated`；只发送 final=true 不能代替前面的普通 commit。上传音频超过上限报 `Maximum file size exceeded`；不支持的格式、verbose_json 与流式并用、beam search 与流式并用，是不同的拒绝分支，应分别处理。

Chat render 的四版实现都会拒绝 beam search；不能把普通 Chat 的 beam 分支当作独立 render 也具备的能力。逐片段 Chat derender 若服务配置了 reasoning/tool parser，或一个片段带多个 choice，也会拒绝；这与普通服务自己的 SSE 返回能力是不同入口。接口不存在时先核对服务启动方式和下表开关，再查路径，不通过修改模型名绕过。

多模态错误先区分取得媒体、模板/占位对应和特征布局三层。`Cache miss for … but data is not provided.` 表示只交了身份却没有命中可用预处理条目，应补交原媒体；身份列表与数据列表长度不同、某项数据和身份都空也会拒绝。占位更新数量与媒体数量不同，要核对模型模板和每项内容的排列；编码向量行数与占位位置数不同，则核对特征布局、网格/切片等附加字段及是否误把多张图当成一个内容项。后者可能在执行阶段才失败，HTTP 接口收下张量不代表形状契约已经满足。

messages 省略/null、角色或内容不符合 schema，会在请求解析阶段失败；模板不支持某角色或图文形状时，还可能在渲染阶段拒绝。Completions 缺有效 prompt / prompt_embeds 会报 `Either prompt or prompt_embeds must be provided and non-empty.`。请求日志开关已开但级别高于 INFO 时会告警没有请求信息；INFO 看不到输入详情是级别设计，不表示请求没有进入引擎。uvicorn_log_level 不在上述枚举时启动解析失败。

保活变量为空串、带小数或其他非整数文本时会在环境值解析时报 ValueError。连接空闲超过窗口后关闭是 HTTP 连接管理行为，不是 Worker RPC 执行超时；若 SSE 中途断开，继续查客户端、代理和服务端日志，不靠调这个变量认定根因。

- 配置路径打不开、不是 .yaml/.yml、YAML 语法错误，或含未注册的顶层选项：启动解析失败；文件应是键值映射，不能用空文件或列表代替。`No model specified!` 对应带配置文件却没有位置模型/文件 model 的分支；同一命令不能叠放多个 --config。
- port 不是整数会在 CLI 解析失败；非法地址、越界端口或端口被占用会在实际绑定阶段失败。它们发生在接请求之前，应查 host/port 与系统监听状态，不修改请求的 model 来处理。
- content format 超出 auto/string/openai 会在选项解析时拒绝；合法但与模板预期不符时，检查模板实际接收到的是字符串还是内容块。
- 启动 max_model_len 为 0，或解析后仍为非正整数：`max_model_len must be a positive integer`；小于 -1 在字段校验阶段就被拒。超过模型允许长度时为 `User-specified max_model_len ... is greater than the derived max_model_len`。这些发生在服务开始接 HTTP 请求之前。
- auto 无法容纳一条请求时：`Cannot auto-fit max_model_len: not enough GPU memory available`；固定长度放不下时转到[KV 容量错误](kv-cache-memory-profiling.md#会报什么错)。
- ``The model `xxx` does not exist.``：模型名和对外名字不一致，404。

聊天入口先检查模型名；检查失败就返回错误，不继续整理消息或分词。模型检查通过后，若引擎客户端已记录错误，则抛出保存的异常，也不会继续准备生成输入。

- `Chat template is passed with request, but --trust-request-chat-template is not set. Refused request with untrusted chat template.`：请求自带模板。
- `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`：要自动选工具但服务没开。
- `invalid tool call parser`：开启自动工具选择时，启动校验没有找到所选注册名。若用了插件，先检查导入日志、文件或模块路径、依赖以及注册名；文件导入失败可能先被记录为日志，再在名称校验或后续查找时暴露，不能仅凭没有导入异常就认定成功。
- `This model only supports single tool-calls at once!`：固定 Llama JSON 示例模板收到的历史 tool_calls 长度不为 1；它是模板约束，不是所有模型的通用限制。Mistral 示例中的 `Tool call IDs should be alphanumeric strings with length >= 9!` 对应实际的“存在且长度至少 9”检查，随后截取末 9 字符；该处代码没有逐字符校验是否只含字母和数字。
- `This model's maximum context length is … tokens. However, you requested … output tokens and your prompt contains at least … input tokens …`：分词时发现输入加输出超过上限。
- `Input length (…) exceeds model's maximum context length (…).`：推算输出上限时发现输入本身就超了。
- `max_tokens must be at least 1, got 0.`：没写输出数、输入正好顶满上限时，聊天接口在定采样参数这一步报。
- `The decoder prompt (length …) plus the number of requested output tokens (at least 1) is longer than the maximum model length of …`：输入正好顶满上限的兜底检查。
- `The decoder prompt cannot be empty`、`Token id … is out of vocabulary`、`data_parallel_rank … is out of range [0, …).`：打包前的再校验，流式请求里以流中的错误消息出现。
- 引擎停止时报 EngineDeadError，前端回 500 后退出。

### 开销和什么时候别开

DEBUG 输入详情会增加格式化与日志 I/O，还可能保存用户原文；max_log_len 仅截短指定内容，不是脱敏或总日志配额。复现时短期开启、控制保留范围，压测结果须说明日志级别。uvicorn 的访问日志与请求正文日志是不同来源；单纯减少访问日志不等于关闭内容记录。

保活时间增大可减少相邻请求反复建连，但让更多空闲 socket 保留更久；缩短则更快回收连接，也可能增加重连开销。它不改变 NPU 批大小、KV 容量或模型算力。只有实际需要复用连接时才调，生成很慢本身不是增大它的依据。

加载路径决定启动时要取哪些文件，别名和 YAML 主要改变配置与接口映射，不会另造一套权重；扩开放监听地址也不会提高模型算力。请求模板信任则让每次请求可以改变 prompt 的组织方式，模板变化可能改变 token 数与 CPU 渲染工作。需要统一格式和可复现输入时，用服务端模板配合默认关闭的信任开关。

入口不能关，能调的是它占多少 CPU。症状是 NPU 不忙、首 token 时延却随并发上涨，而前端进程的 CPU 打满：可以加 `--renderer-num-workers` 让套模板和分词多几个线程，或者加 `--api-server-count` 多起几个前端；后者会改变 DP 打分里的前端个数。不要为了「ID 好查」打开 `VLLM_DISABLE_REQUEST_ID_RANDOMIZATION`：两个客户端用了同一个 ID 时，引擎里会撞在一起出错。不要在聊天接口里把 `add_special_tokens` 打开，理由见常见误解。

输出上限本身只增加长度判断，不会保证生成那么多；但较大的预算允许请求运行更多 decode 步、长期占着 KV 块。较小预算能限定最坏生成长度，也会在句子或推理中途截断。按任务需要给预算，长度与耗时不是同一单位；本页没有 token 数到毫秒的实测换算。

总长度还参与启动时的容量准入和缓存元数据规划。把它调小可以降低允许的最长请求需求，却不会让一个已固定的 KV 字节预算自动变小；按位置增长的历史和每请求固定的 KDA 状态也不会同比缩放。auto 会多做一次基于规格的容量搜索，不是逐个长度跑模型压测。GLM 本页继续使用教程的显式 133120，未把 auto 当成双机实测配方。

### 版本差异

按知识库四版本正式钉点核对上游入口与昇腾适配：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`）、`v0.26.0rc`（`vllm@568afb3a` / `vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm@ced6857a` / `vllm-ascend@c09d3e20`）与 `main`（`vllm@ba15685a` / `vllm-ascend@8d6180e2`；部分早期细分协议核对仍保留历史 `84030bbe` 源码行对照，并在下表注明 `ba15685a` 核验结果）。

先看 **OpenAI API 入口、预处理器与优雅停机钩子** 的四版核心演进：

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
| --- | --- | --- | --- | --- |
| OpenAI API 服务启动与入口组织 | `entrypoints/openai/api_server.py` 与 `entrypoints/launcher.py` | 延续 `api_server.py`；新增 `scale_out` render/derender 路由 | 启动器迁入 `entrypoints/launchers/api_server/entry.py` 与 `launchers/launcher.py`，CLI 选项在 `launchers/cli_args.py` | 延续 `launchers/api_server/entry.py` 与 `launchers/launcher.py`；原 `launchers/cli_args.py` 已进一步拆分重构 |
| 预处理器与多进程准入控制 | `serve/render/serving.py`，2 ms 微批（最多 32 条）共用 1 线程；单进程在途计数 | 迁至 `renderers/online_renderer.py`，逐条交线程池（默认 1 线程） | 延续 `OnlineRenderer`（多模态预处理另用 1 线程）；新增 `admission_control.py` 共享槽位汇总多 API 进程在途数 | 延续 `OnlineRenderer`（890 行）与 `SharedAdmissionStats` 共享准入计数 |
| 优雅停机钩子（`--shutdown-timeout`） | `entrypoints/launcher.py` 协调 HTTP 停机与引擎死亡退出 | 同 `v0.23.0` | `vllm.py#L456` 定义 `shutdown_timeout=0`；`launchers/launcher.py#L124-L182` 事件循环接管停机信号，先按超时停 `engine_client` 再关 FastAPI/Uvicorn，防被 Uvicorn 默认处理器竞态覆盖 | `vllm.py#L482` 延续 `shutdown_timeout=0`；`launchers/launcher.py#L151-L165`、`#L251-L310` 细化 `Server.shutdown()` 与 `handle_shutdown()` 协调流程，详见 [集群部署与优雅停机](cluster-serving.md#滚动发布与缩容别被默认---shutdown-timeout-0-直接掐断请求) |
| 昇腾入口补丁边界 | 仅动输出分段与空 `tool_calls`；不改入口分词与选组 | 另包装 `render_chat` 承接重算恢复 token 列表 | `vllm-ascend@c09d3e20` 延续上游入口，仅针对特定推理/模板边界打轻量补丁 | `vllm-ascend@8d6180e2` 继续完全复用上游 OpenAI API 入口与预处理器 |

以下保留各细分协议、工具插件、独立 renderer、多模态与长度/日志参数的逐项核对矩阵（`v0.30.0` 列对应 `ced6857a`，`main` 历史细分行仍附 `84030bbe` 源码对照）：

| 接口与包装层契约 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`） | `main`（`84030bbe` / `ba15685a`） |
|---|---|---|---|---|
| Responses 保存 | 接口已有；store=true，但服务保存默认 0；开启后保存在进程内字典 | 相同 | 相同 | 相同 |
| Messages 的基本处理链 | 消息转换为 Chat，生成后转回 Messages；stream=false | 相同 | 基本处理链相同，转换入口更名 | 同 rc2 |
| pooling 入口准入 | 按支持任务与所选 pooling 任务初始化处理器 | 相同 | 相同 | 相同 |
| 语音上传大小 | 默认 25 MiB；先完整读文件，再在预处理检查 | 路由先限量读取；预处理仍复查 | 路由限量读取；不再在预处理重复文件大小检查 | 同 rc2 |
| 音频解码资源 | 本节基线转写路径未传后两项解码上限 | 专用预处理线程池；传入时长上限，默认 600 秒 | 另传解码容量上限，默认 268435456 B（256 MiB） | 同 rc2 |
| 语音结果格式 | json/text；verbose_json 需模型支持且非流式 | 相同 | 另有 diarized_json，需模型支持说话人区分，且非流式 | 同 rc2 |
| 实时转写事件 | 需先验证模型；普通 commit 启动，final commit 结束输入 | 相同 | 相同 | 相同 |
| SageMaker 分发表 | Chat / Completions 与相应 pooling；按可用处理器和 schema 分派 | 相同 | 相同 | 相同 |
| Ray Serve DeepSeek 示例 | 外层副本上下界均 1，内层 TP8 / PP2，H100 示例 | 相同 | 相同 | 相同 |

表中“相同”只针对列出的契约，不代表全部协议字段、模型清单或外部服务框架都相同。解码上限是交给音频加载器的限制，不是允许每个请求固定分配该容量；文件大小、解码结果与设备上的模型状态分别占资源。这里核的是固定上游控制流，GLM 的 Ascend 支持与部署命令仍按主线条件。

| 工具插件入口 | v0.23（0fc695fc） | v0.26（568afb3a） | rc2（ced6857a） | 固定 main（84030bbe） |
|---|---|---|---|---|
| 参数默认 | 插件为空、解析器 None、自动选择 false | 相同 | 相同 | 相同 |
| 插件字符串怎样解析 | 按文件路径导入，以文件名去扩展名作为模块名 | 相同 | 先按可导入的模块名加载；遇 ModuleNotFoundError 再尝试文件路径 | 同 rc2 |
| 注册与取用 | 显式类注册或模块/类名延迟注册；按所选名字查找 | 相同 | 相同 | 相同 |
| 文件导入失败 | 捕获异常并写日志；后续注册名可能不存在 | 相同 | 文件回退失败写日志；模块导入中的其他异常可直接传播 | 同 rc2 |

这些是前端插件入口的能力，不表示同名模型在各版使用相同模板，也不表示第三方插件跨版兼容。工具参数 strict 的四版差异集中在[结构化输出](structured-output.md#版本差异)，此处不以插件加载成功推断约束能力。

| 拆分前后处理入口 | v0.23（0fc695fc） | v0.26（568afb3a） | rc2（ced6857a） | 固定 main（84030bbe） |
|---|---|---|---|---|
| 独立 CPU render | launch render；无推理引擎 | 相同；另初始化输出后处理组件 | 启动实现迁到 launchers，职责相同 | 同 rc2 |
| 普通 serve 的拆分接口 | 生成任务挂载 render 和 token-in/out；没有所述 derender 路由 | 直接注册 render/derender；生成任务再注册 token 接口 | 默认不注册，enable_scale_out=true 才开；专用入口仍注册 | 普通入口默认关闭，改由环境三态开关控制；专用入口显式禁用会报错 |
| 完整结果 derender | 该固定树没有此路由 | 已有，接完整输出编号 | 已有；model 可省略取服务名 | 同 rc2 |
| 逐片段 derender | 无 | 无此分支 | 同一地址以 stream=true 区分，调用方携带状态；Chat 有解析器与单片段 choice 限制 | 同 rc2 |

这些是固定上游接口的源码能力。GLM 双机教程仍使用普通 API server，不能把新增独立服务或后处理能力当成其原命令已经启用。

多模态输入机制按上游0fc695fc、568afb3a、rc2配套ced6857a及main比较点84030bbe分别核对。以下是处理框架的差异，不替代所选模型在Ascend上的支持条件；GLM主线算例仍走纯文本。

| 多模态核对项 | v0.23 / GLM基线 | v0.26 | rc2 | 固定main比较点 |
|---|---|---|---|---|
| 媒体嵌入与缓存默认 | enable_mm_embeds=false；4 GiB、lru、shm单对象128 MiB | 相同 | 相同 | 相同 |
| 处理器收到的文本 | 可收文字或编号；分开处理媒体时，模型覆盖调用才使用匹配的临时文字 | 同基线 | 接收编号；默认不向媒体processor传文字，模型可显式提供临时文字 | 同rc2 |
| 缺失媒体与缓存合并 | 只处理未命中项，再按原顺序合回；缺内容又未命中报错 | 相同 | 相同 | 相同 |
| 进程间缓存拓扑 | 单API，且DP=1或external LB才启用；否则processor_only | 相同 | 相同 | 相同 |
| 内容身份的处理参数 | 模型、媒体/显式身份与processor kwargs参与；无额外参数时可直接用显式身份 | 同基线 | 另纳入media_io_kwargs，按对应模态隔离参数；统一模态保留全部因素 | 同rc2 |
| processor cache与APC同时关闭时 | 用本请求身份覆盖用户UUID | 同基线 | 保留显式UUID，仅为缺失项生成本请求身份，供EC跨实例识别 | 此固定快照仍覆盖用户UUID；不能从rc2外推 |
| 音频单项为空、拟用UUID命中 | 音频解析器不接受该空项，不能照搬图片省略示例 | 同基线 | 解析器允许None继续，仍须满足缓存命中等条件 | 同rc2；双缓存关闭的身份差异仍按上一行 |
| HTTP初始媒体超时 | 图片5秒、视频30秒、音频10秒 | 相同 | 相同 | 相同 |
| HTTP原始字节下载缓存 | 默认关闭；目录启用后，默认5120 MiB淘汰目标、24小时滑动有效期；命中仍解码 | 相同 | 相同 | 相同 |
| OpenCV坏帧恢复 | 默认关；开启后在有界顺扫中尝试替代 | 同机制，日志级别有调整 | 代码迁到video_decoders/opencv.py，保留这层边界 | 同rc2 |
| 长音频切点未前进 | 旧切分器没有显式前进保护，不能承诺任意参数下可靠推进 | 加入退回本段硬边界的保护 | 保留保护，并显式拒绝多维音频输入 | 同rc2 |

原始媒体的内容哈希、用户给的稳定身份、EC的存储身份各有用途。使用新版本跨实例EC时，应核对两端相同的处理与身份规则；旧配方中没有的保留行为不能靠给请求加UUID获得。

**v0.30.0rc2 配套的 vLLM 0.30 改变了多 API 进程的准入计数。** 每个前端进程写自己的共享槽位，检查时汇总各进程的在途请求；max_num_queued_reqs 因而可以约束 waiting+running 的近似全局总量，n>1 的请求占 n 个名额。检查和新增之间仍可能竞争，所以这不是严格原子的全局上限；没有共享计数时退回本进程的 unfinished 数。HTTP 503 准入拒绝与 EngineCore 的 max_num_seqs 批容量仍是两个层次，不能用后者解释所有入口拒绝。

| 入口参数 | v0.23（0fc695fc） | v0.26 rc（568afb3a） | rc2（ced6857a） | main（84030bbe） |
|---|---|---|---|---|
| messages | Chat 必填列表；不接受 null，字段未设非空长度约束 | 相同 | 相同 | 相同 |
| reasoning_effort 与模板合并 | 默认 None；枚举及自动 enable_thinking、请求覆盖规则见上文 | 相同 | 相同；构造对象另带新字段，不改变所列优先级 | 同 rc2 |
| prompt | Completion 默认 None；四种字符串/编号与批量形状；缺有效输入拒绝 | 相同 | 相同 | 相同 |
| enable_log_requests | false；INFO 摘要、DEBUG 输入详情 | 相同 | 相同 | 相同 |
| max_log_len | None；字符/编号各按切片截短；不校验非负下界 | 相同 | 相同 | 相同 |
| uvicorn_log_level | info；六种级别 | 相同 | 相同，字段迁到 launchers/cli_args.py | 同 rc2 |
| enable_prompt_embeds | 默认 false；Chat 内容嵌入与 Completion 完整嵌入输入 | 相同 | 同样入口；另明确拒绝 encoder-decoder 模型 | 同样入口；不由字段存在推断模型兼容 |
| 嵌入张量稠密化检查 | 直接稠密化，再验维度、宽度和浮点类型 | 稀疏不变量检查改用进程内锁 | 稠密化前新增单张量字节检查 | 同 rc2 |

rc2/main 的 `VLLM_MAX_EMBED_DECODE_BYTES` 默认 2147483648 字节，即 2 GiB。消费者在上限大于 0 时，用输入张量的元素个数乘原 dtype 的每元素字节数检查，再转为稠密张量；0 关闭此预算检查。它不是 HTTP 请求体总上限、转换到模型 dtype 后的占用上限，也不是所有并发请求的合计预算。旧 GLM 基线没有这一层保护，仍需调用方控制输入规模；形状正确也不证明向量适合当前模型。

HTTP 保活变量在四版均为 int、默认 5 秒，普通 API 与 render 入口都传给 HTTP 服务。rc2/main 的传递位置迁到 launchers/api_server/entry.py 与 launchers/render/entry.py；语义仍是响应结束后的空闲等待。Ascend 复用该前端入口，本 GLM 教程未给覆盖值。

Recipe 段落以独立仓库 `935817c6` 为准，不继承下表的 vLLM 支持范围。模型名映射、模板版本和输出约束都要使用同一套转换结果；不能把接入协议库当成替换了推理引擎。

| 请求准备与提交 | v0.23 | v0.26 | rc2 | 固定 main |
|---|---|---|---|---|
| 上游版本 | 0fc695fc；GLM 镜像 db701c1f 用同一版 | 568afb3a | ced6857a | 84030bbe |
| 模板与分词入口 | `entrypoints/serve/render/serving.py` | `renderers/online_renderer.py` | 同 v0.26 | 同 v0.26 |
| 分词怎样排队 | 2 ms 微批，最多 32 条；共用 1 个线程 | 每条单独交给线程池，默认 1 线程 | 同 v0.26；多模态预处理另用 1 个线程 | 同 rc2 |
| 请求 ID | 加 8 位随机后缀 | 相同 | 相同 | 相同 |
| 回程登记 | 先登记输出槽再发送；单槽合并 | 相同 | 相同，另更新准入计数 | 相同 |
| 缺省输出上限 | 剩余上下文、生成默认与硬上限取小 | 相同 | 相同 | 相同 |
| 选组打分 | 见 [DP 请求路由](dp-request-routing.md#版本差异) | 同左 | 同左 | 同左 |

Ascend 的普通 GLM 文本入口与恢复分支要分开。旧 `2c59ff10` / `db701c1f` 所列聊天补丁处理输出分段与空 tool_calls；`2ed6cbba` 除 GLM 用量和 Kimi 解析外，还包装 render_chat：仅当请求携带私有恢复 token 列表、渲染结果为预期元组且只有一条引擎输入时，才替换其中的输入编号，见[重算调度](recompute-scheduler.md)。因此不能把 v0.26 所有 renderer 补丁概括成“只给 Kimi 用”。rc2 的 GLM5.3 补丁又处理特定模板与关闭思考参数的解析边界，见[流式版本表](streaming-output.md#版本差异)；固定 main 所列平台导入入口没有这些旧包装。这些版本结论限定于所核导入链，不排除额外安装的插件。

输出参数同样使用上表四个固定钉点。来源中保留的 98dff2a8 只作旧 renderer 的历史对照；当前 main 行以 84030bbe 的实际入口、线程与请求登记为准。

| 输出参数核对项 | v0.23 | v0.26 | rc2 | 固定 main 84030bbe |
|---|---|---|---|---|
| Chat 两字段默认 None、非空 max_completion_tokens 优先 | 有 | 相同 | 相同 | 相同 |
| Completions 只有 max_tokens；省略 16、null 走缺省推算 | 有 | 相同 | 相同 | 相同 |
| SamplingParams 默认 16、显式 None 补剩余空间；普通生成至少 1 | 有 | 相同 | 相同 | 相同 |
| 请求值优先于生成默认，再与硬上限取小 | 有 | 相同 | 相同 | 相同 |

总长度参数沿用这组四版钉点（v0.26 为已登记的 rc 分支快照）：max_model_len 定义默认均为 None，最终正整数校验、CLI 的 auto/-1 与十进制/二进制后缀、按模型长度推导并由 KV 容量收缩的入口均存在；133120 都不是字段默认。rc2/main 的搜索与准入先扣一个保留的 null block，前两版没有这处扣减，容量临界点可能得到不同结果，详见[预算版本差异](kv-cache-memory-profiling.md#版本差异)。rc2 对 yarn、deepseek_yarn、deepseek_llama_scaling 按模型最大长度已缩放处理，不再重复乘 factor；固定 main 的 yarn 分支仍从 original_max_position_embeddings 再乘 factor。参数同名不保证模型推导上限相同。GLM 使用固定 Ascend 专用实现，KDA 布局另见[规格页的版本差异](kv-cache-spec.md#版本差异)。

常用入口四版的 model 默认均为 Qwen/Qwen3-0.6B，served_model_name 为 None，host 为 None，port 为 8000，config 为 None；模板内容格式均默认 auto、支持三个值，请求模板信任均默认 false、保留前述拒绝守卫。这里的默认属于通用入口，GLM 命令的显式路径、glm 和 0.0.0.0 优先。

内容格式的显式值四版都优先；基线与 v0.26 直接返回该值，rc2/main 仍检测模板，若检测结果与显式值不同会告警，最终继续采用显式值。不能把新版告警当成固定镜像已有诊断。

配置的覆盖顺序四版相同；false 的转换有差异：v0.23/v0.26 略过它，rc2/main 在已注册对应负开关时转为 --no-选项，未注册负开关仍略过。因此 YAML 的某项 false 在旧版不一定能关闭默认开启的行为；本例信任开关原本就默认 false，不受此差异影响。四版空列表都略过、null 都先变成字符串 None，再由具体参数解析。rc2/main 的前端选项迁到 entrypoints/launchers/cli_args.py；模板守卫从基线 serve/render/serving.py 迁到新版 renderers/online_renderer.py。Ascend 继续复用这些通用入口，不能由硬件插件版本推断 YAML 转换规则。

### 源码位置

- 协议与会话：来源 428–429 是固定在线接口指南；439–443 是 Completions、Chat 与 Responses 的生成 includes。Responses 的字段、返回、路由、保存消费者和后台校验分别见 441–443、454、358–360、487；另外三版在 377–379、396–398、415–417、469、476、484、488–490，保存默认见 370、389、408、427。历史记录如何交回输入整理见 491–494；客户端自己携带工具历史的完整示例见 432。Messages 的请求、转换与输出见 361–363、446–447、455，四版消费者对照见 380–382、399–401、418–420。pooling 的准入与 encode 路径见 354–356、448–453；三版准入对照见 373–375、392–394、411–413。
- 语音：来源 430 是固定语音指南，444–445 覆盖其中四个生成 includes；上传路由与任务承接见 456–459，大小、格式和生成分支见 364–366、369、463。较新版限量读取与解码传参见 383–385、402–404、421–423、465–486；默认文件上限另见 388、407、426。Realtime 的事件定义、完整连接消费者与路由见 460–462；四版模型验证和 commit 分支见 367–368、386–387、405–406、424–425。文件与麦克风示例见 435–438。音频 32,000 B 与 base64 42,668 字符由所述 PCM 格式推导，不是吞吐实测。
- 服务包装：SageMaker 分发表由 352–356 的路由、生成工厂与 pooling 工厂共同限定；另外三版见 371–375、390–394、409–413。Ray Serve 示例完整配置见 431、464、471、479；副本上下界、TP/PP 与设备类型直接取该示例。外部 Ray/SageMaker 框架的生产运维不由这份 vLLM 适配源码证明。MiniCPM 宽、高顺序沿用 245–246 的实际字段消费者。

工具插件管理器、文件导入与新版模块回退见来源 322–331；四版默认值与两处启动消费者见 332–340，以及已有来源 96、98、140。官方工具调用母文见 341；DeepSeek、FunctionGemma、Llama 和 Mistral 的固定模板见 342–351。模板中的报错与格式只描述这些固定文件，不外推成整个模型家族的保证。

独立 renderer 的启动和无引擎初始化见来源 288–295；四版路由注册与开关消费者见 296–302。render 返回值、Chat 的 beam 拒绝与媒体数据、Completion 列表见 303–311，真正进入生成服务的消费者见 312。v0.26 完整结果后处理见 313–315，rc2/main 的同地址逐片段分支与解析器限制见 316–319，原请求、计数与状态协议见 320–321。

思考字段的四版默认与枚举见来源 268–271；请求字段组装、空值合并、请求覆盖服务默认以及模板变量过滤，基线见 272–275，v0.26 见 276–279，rc2 见 280–283，固定 main 见 284–287。这组消费者解释的是模板输入，不代替输出过滤或模型能力判断。

原始媒体下载缓存的初始化、URL 身份、滑动有效期、写入淘汰及命中后的解码链见来源 256–257；三个环境变量的默认值见 258。v0.26、rc2、main 对应实现与默认值依次见 259–261、262–264、265–267，下载缓存与 processor/EC/KV cache 分别管理。

多模态的官方完整说明见209–210；其中临时文字的适用条件以195、198、202、204的实际分支为准。缓存未命中、合并及占位更新见195–197，身份与四版差异见199–200、205、207–208、218。进程间缓存是否建立及接收位置见201、203、206；配置默认与CLI见194、215–217、219。编码器输出进入缓存、按占位填入语言输入的执行链见211–214，Ascend消费边界继续使用既有175–176。七位置示例只是手工演示，不对应某个模型的实测特征数。

媒体取得与预处理的证据：220–223 核对四版 HTTP 初次尝试的超时默认，230–232、240–241 核对获取入口及重试；226、247–248 区分默认声道平均与模型要求的采样率、声道。音频切片、静音搜索及真正调用条件见227、233、236、242；仅凭音频 UUID 复用的四版差异见228、234、237、239。视频帧恢复、默认开关、元数据与解码器分派见229、235、238、249–255。模型自带的嵌入布局及辅助字段见224–225、243–246，不能由张量维数相同推断模型之间可互换。

rc2 的入口字段与输出预算见来源 127–132，模型长度、CLI 解析与 KV 容量准入见 133–138；YAML、模板、监听和日志字段及消费者见 139–145。HTTP 空闲保活见 146–148，renderer 线程、请求编号及发送前登记见 149–152；153–160 继续核日志构造、长度参数传递、pooling 特殊长度来源、工具模板条件与显式截断例外。Ascend 各版平台导入、空工具列表序列化及恢复输入条件见 161–168。

嵌入输入的两种模板职责见来源 169，基线解码检查、Chat 拼接、Completion 限制与顺序见 170–173；多模态嵌入的独立入口见 174，固定 Ascend 的输入消费见 175–176。三版拼接、稀疏检查和稠密化预算见 180–190。新增四版表还分别核对请求字段、日志消费者、模型长度推导与容量扣减，不能用一个同名参数代替整条路径。基线分词上限的显式截断例外、auto 返回值和模板错误分支分别补见 191–193。

- 来源 112–114 核对基线输入字段与非空校验，120–123 对照两版输入字段；115–117 是三版 RequestLogger 的级别和切片消费者；118、119 是基线请求日志默认与实际构造。HTTP 日志字段沿用既有前端 CLI 来源，124 补充 main 迁移后的六种级别与默认。输入截断与模板变量的唯一参考在 token 页。

保活证据：来源 104 是固定环境 getter，105 是普通 API/render 两处传参，106 是 Uvicorn 对 keep-alive 空闲等待的官方定义；107–111 对照另外两版默认及两个入口的迁移。默认与传参按固定 vLLM 源码核对，未把在线 Uvicorn 文档版本当作现场 wheel 版本。

Recipe 的调用方职责、协议转换、输出预算与约束选择，见来源第 54 条的固定 README。本文没有运行该库与推理后端的完整接入测试。

| 做什么 | 位置（vllm@0fc695fc） |
|---|---|
| 路由与三种返回（错误、整段 JSON、SSE 流） | `vllm/entrypoints/openai/chat_completion/api_router.py#L40-L75` |
| 查模型名、引擎状态，定输出上限与采样参数，建生成器 | `vllm/entrypoints/openai/chat_completion/serving.py#L192-L392` |
| 流式出错写进流里；非流式取结果 | `chat_completion/serving.py#L497-L937`、`#L938-L964` |
| 模型名检查；X-Request-Id 与组号请求头 | `vllm/entrypoints/openai/engine/serving.py#L211-L238`、`#L387-L412` |
| 工具选项与模板来源检查，套模板、分词 | `vllm/entrypoints/serve/render/serving.py#L183-L266`、`#L452-L471`、`#L521-L568` |
| 线程池与微批分词；聊天默认不补特殊标记 | `vllm/renderers/base.py#L84-L155`、`#L338-L360`、`vllm/utils/async_utils.py#L24-L50`、`chat_completion/protocol.py#L290-L296` |
| 长度检查与默认分词上限 +1；显式截断另分支 | `vllm/renderers/params.py#L186-L194`、`#L300-L322`、`#L415-L435` |
| 输出上限推算 | `vllm/entrypoints/serve/utils/api_utils.py#L170-L206` |
| 再校验、补参数、建 EngineCoreRequest、加随机后缀 | `vllm/v1/engine/input_processor.py#L223-L385`、`#L387-L484` |
| 拆 n 条子请求、先登记后发送 | `vllm/v1/engine/async_llm.py#L280-L414`、`vllm/v1/engine/parallel_sampling.py#L52-L94` |
| 生成器、断开即中止；后台分拣任务 | `async_llm.py#L524-L600`、`#L637-L690` |
| 输出槽与登记；不认识的 ID 丢掉 | `vllm/v1/engine/output_processor.py#L45-L92`、`#L512-L541`、`#L600-L612` |
| 选组后发送，必要时叫醒协调器 | `vllm/v1/engine/core_client.py#L1344-L1360` |
| 引擎输入线程建 Request；进 waiting | `vllm/v1/engine/core.py#L1518-L1543`、`#L819-L841`、`#L341-L377`、`vllm/v1/core/sched/scheduler.py#L1801-L1823` |
| 错误类型到状态码；引擎停止后退出 | `vllm/entrypoints/serve/utils/error_response.py#L16-L50`、`serve/utils/server_utils.py#L327-L445`、`vllm/entrypoints/launcher.py#L168-L178` |
| GLM 启动命令与常见问题 | `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L262-L292`、`#L416-L430` |

实测边界：本页没有前端 CPU 耗时的实测数，「前端先于 NPU 成为瓶颈」的并发点要用 GLM 双机压测才能定；GLM 模板的系统说明行有几个 token，仍需按 [token 页](token.md#r1-在入口拿到了什么) 的模型与模板取得实际分词结果。

- 来源 56、57：vllm@0fc695fc，vllm/entrypoints/openai/chat_completion/serving.py，L206–L217、L294–L325。
- 输出参数证据：58 是基线 Chat 字段，18–19 是字段选择与实际传递；20–21 是 Completions 默认与上限推算；24、59–60 是生成默认、覆盖上限与取小规则；61–63 是 echo 零输出的内部一枚采样及返回裁切；28、70 是离线 None 补齐与对象默认。64–69 对照新版入口和预算函数，普通生成合法范围见 23。
- 总长度参数证据：71–73 是字段默认、模型长度推导与最终正整数检查；74–75 是 CLI 数字/auto 解析；76–77 是逐 worker 容量搜索及其在块数覆盖之后、容量检查之前的位置；78–79 是 v0.26 与固定 main 的长度推导对照；80–84 对照新版容量搜索、main 保留块与单位解析；85 限定 tokenizer_config 参与长度推导的入口为 pooling 且使用绝对位置编码，普通 GLM 生成不经此入口。133120 的教程来源沿用 44。
- 常用入口证据：86–88 是模板、监听和 config 选项定义；89–90 是公开 parse_args 的 --model 兼容改写、配置合并与值转换；91–93 是模型字段、对外别名和位置模型赋值；94 是模型名匹配；95 是内容格式自动判断及显式值直接返回。96–101 核对新版字段、配置转换与默认模型名称；模板守卫复用来源 8，基座响应首名复用来源 2，指标首名依据来源 92 的字段契约。
- 来源 102 对应普通 TCP 路径的实际绑定，103 对应 main 的内容格式检测与显式值告警。
- `v0.30.0`（`ced6857a`）与 `main`（`ba15685a`）的 `shutdown_timeout`、优雅停机钩子、`OnlineRenderer` 与共享准入计数见文首 `sources` 末尾 9 条（`vllm/config/vllm.py`、`vllm/entrypoints/launchers/launcher.py`、`vllm/entrypoints/launchers/api_server/entry.py`、`vllm/renderers/online_renderer.py`、`vllm/v1/engine/admission_control.py`）。
