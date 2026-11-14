# 动态命令行线索逐条结论

| ID | 版本 | 定义 | 结论 | 理由 |
|---|---|---|---|---|
| D01 | v0.23 | [vllm/benchmarks/sweep/plot.py:535](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/benchmarks/sweep/plot.py#L535) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D02 | v0.23 | [vllm/benchmarks/sweep/plot_pareto.py:346](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/benchmarks/sweep/plot_pareto.py#L346) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D03 | v0.23 | [vllm/entrypoints/openai/cli_args.py:347](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/entrypoints/openai/cli_args.py#L347) | 没讲全 | 模型位置参数；已有模型启动示例，缺与 config/model 选项优先级的专门说明。 |
| D04 | v0.23 | [vllm/entrypoints/openai/cli_args.py:217](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/entrypoints/openai/cli_args.py#L217) | 对应已盘点字段 | get_kwargs(cls) 获取 Frontend 字段，以 key 下划线转连字符生成长选项；额外短标记是别名。 |
| D05 | v0.23 | [vllm/utils/argparse_utils.py:151](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/utils/argparse_utils.py#L151) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
| D06 | v0.23 | [vllm/utils/argparse_utils.py:159](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/utils/argparse_utils.py#L159) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
| D07 | v0.26 | [vllm/benchmarks/sweep/plot.py:538](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/benchmarks/sweep/plot.py#L538) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D08 | v0.26 | [vllm/benchmarks/sweep/plot_pareto.py:347](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/benchmarks/sweep/plot_pareto.py#L347) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D09 | v0.26 | [vllm/entrypoints/openai/cli_args.py:346](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/entrypoints/openai/cli_args.py#L346) | 没讲全 | 模型位置参数；已有模型启动示例，缺与 config/model 选项优先级的专门说明。 |
| D10 | v0.26 | [vllm/entrypoints/openai/cli_args.py:216](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/entrypoints/openai/cli_args.py#L216) | 对应已盘点字段 | get_kwargs(cls) 获取 Frontend 字段，以 key 下划线转连字符生成长选项；额外短标记是别名。 |
| D11 | v0.26 | [vllm/utils/argparse_utils.py:151](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/utils/argparse_utils.py#L151) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
| D12 | v0.26 | [vllm/utils/argparse_utils.py:159](https://github.com/vllm-project/vllm/blob/568afb3a13806beb53bb2e6bd518269357b237c0/vllm/utils/argparse_utils.py#L159) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
| D13 | main | [vllm/benchmarks/sweep/plot.py:538](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/benchmarks/sweep/plot.py#L538) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D14 | main | [vllm/benchmarks/sweep/plot_pareto.py:347](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/benchmarks/sweep/plot_pareto.py#L347) | 未收录工具说明 | 基准结果绘图工具的输入目录位置参数，与推理请求参数分开。 |
| D15 | main | [vllm/entrypoints/launchers/cli_args.py:390](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/entrypoints/launchers/cli_args.py#L390) | 没讲全 | 模型位置参数；已有模型启动示例，缺与 config/model 选项优先级的专门说明。 |
| D16 | main | [vllm/entrypoints/launchers/cli_args.py:242](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/entrypoints/launchers/cli_args.py#L242) | 对应已盘点字段 | get_kwargs(cls) 获取 Frontend 字段，以 key 下划线转连字符生成长选项；额外短标记是别名。 |
| D17 | main | [vllm/utils/argparse_utils.py:167](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/utils/argparse_utils.py#L167) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
| D18 | main | [vllm/utils/argparse_utils.py:175](https://github.com/vllm-project/vllm/blob/84030bbe3d74d99bad477a3d2e37a973ccd8865c/vllm/utils/argparse_utils.py#L175) | 不计新增参数 | 解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。 |
