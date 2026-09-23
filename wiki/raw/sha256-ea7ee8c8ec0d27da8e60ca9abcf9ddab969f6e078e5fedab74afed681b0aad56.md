来源：vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md
选择范围：最多 100 行上下文；全文 344 行，未提供完整文件。
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L46

vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L47
The following table lists additional configuration options available in vLLM Ascend:
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L48

vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L49
| Name                                | Type | Default | Description                                                                                               |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L50
|-------------------------------------|------|---------|-----------------------------------------------------------------------------------------------------------|
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L51
| `xlite_graph_config`                | dict | `{}`    | Configuration options for Xlite graph mode                                                                |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L52
| `finegrained_tp_config`             | dict | `{}`    | Configuration options for module tensor parallelism                                                       |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L53
| `ascend_compilation_config`         | dict | `{}`    | Configuration options for ascend compilation                                                              |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L54
| `eplb_config`                       | dict | `{}`    | Runner-specific EPLB extensions. See [Expert Parallelism Load Balancer](../feature_guide/expert_parallelism_load_balancer.md). |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L55
| `scheduler_config`                  | dict | `{}`    | Configuration options for Ascend scheduler extensions, including balance scheduling, recompute scheduling, DyntraLB, ShortRequestFirst, and dynamic chunked pipeline parallel. |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L56
| `refresh`                           | bool | `false` | Whether to refresh global Ascend configuration content. This is usually used by rlhf or ut/e2e test case. |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L57
| `dump_config`                       | dict | `None`  | Inline msprobe dump configuration. vLLM-Ascend will materialize it to a temporary JSON file and pass that file to the debugger. |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L58
| `dump_config_path`                  | str  | `None`  | Configuration file path for msprobe dump (compatible legacy option).                                      |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L59
| `enable_shared_expert_dp`           | bool | `False` | Replicate shared-expert weights across TP ranks and run the shared expert with data parallelism. This option is independent of upstream MoE sequence parallelism; either feature or both can be enabled. It improves performance but consumes more memory. |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L60
| `multistream_overlap_shared_expert` | bool | `False` | Whether to enable multi-stream shared expert. This option only takes effect on MoE models with shared experts. |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L61
| `enable_cpu_binding`                | bool | `True`  | Enables Ascend-native CPU binding on ARM servers. Set to `False` to disable. See [CPU Binding](../feature_guide/cpu_binding.md). |
vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L62
| `pa_shape_list`                     | list | `[]`    | The custom shape list of page attention ops.                                                              |