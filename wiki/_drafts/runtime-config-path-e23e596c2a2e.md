---
id: runtime-config-path-e23e596c2a2e
title: runtime_config_path
type: param
summary: 这个字段可填写字符串或 None；本次材料中的七份声明都以 None 为静态默认值，具体用途与生效方式尚待核实。
aliases: []
chapters:
  - '20'
evidence: I
sources:
  - >-
    raw:sha256-29d460e5bb2132ed0168bbc901af3b6a1e5208849a2ad90d2762ccc455159765.md#L1-L27
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L610
  - >-
    vllm-ascend@6e3299ab492ddbadb4c8e3a00b88c982c9a28131:vllm_ascend/ascend_config.py#L608
  - >-
    vllm-ascend@e4d533d33211f0696bcdf65eda47245d52e428c5:vllm_ascend/ascend_config.py#L659
  - >-
    vllm-ascend@e8ae04b5c29f0d69b9dd729cbe838215e451045e:vllm_ascend/ascend_config.py#L674
  - >-
    vllm-ascend@775899991f9614052e4836a62e4cb6541897faee:vllm_ascend/ascend_config.py#L697
  - >-
    vllm-ascend@a38556f69529595e70598d0d6203009f5ac3293e:vllm_ascend/ascend_config.py#L729
  - >-
    vllm-ascend@9b8c54e0d189f34259ab5112f2378ccf558a4e18:vllm_ascend/ascend_config.py#L729
relations: []
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-29d460e5bb2132ed0168bbc901af3b6a1e5208849a2ad90d2762ccc455159765.md
  - >-
    raw/sha256-2d13f8c316437a6c76d3586c7c71adb5b9fd8ee8754b97fa101e88fdb28b6374.md
  - >-
    raw/sha256-703d348dfed5c48687d7ecc8b88872ff05f85ddde437c775ada624d740514e88.md
  - >-
    raw/sha256-81685fcf969928dd82668d18ecb202fda0d397667b8b8130345c5faf03886bde.md
  - >-
    raw/sha256-8b62fbf64500d54cd80faa70070cb10e16f3058f0af1c12e30b99970d02309e0.md
  - >-
    raw/sha256-b909f1f174d8a217b935475955f0945cdb5b6c1d34c00325d86952e2d862804e.md
  - >-
    raw/sha256-c6bf675098d214a8441b7f9371b85caf3e6e8802740cd4c8424c4961d33be950.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-dc561029278178cdc9222d8f07a7cbac8503b71b01ca3817fe405738fd14fd7d.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 没有 runtime_config_path 字段，也不会按这个字段读取热更新文件。下面 main 扫描的路径定义保留其原提交范围；传入此顶层键会被拒收，Omni 特例也仅告警过滤。配置导出的 dump_config_path 用于写出配置，不能代替热更新文件入口。

`runtime_config_path` 在本次材料中声明为可取字符串或 `None` 的字段；材料只包含声明，没有展示它怎样参与运行时配置。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 类型注解 | `str \| None` | 声明允许字符串或空值；是否还有运行时校验，需要读取校验代码才能确定 |
| 静态默认表达式 | `None` | 字段声明本身没有提供字符串值；初始化后是否仍为此值，材料未展示 |
| 摘录间的一致性 | 七份声明完全相同 | 本次摘录没有显示类型或静态默认值的变化，但不足以证明读取与执行行为一致 |

以上事实来自材料第 3、7、11、15、19、23、27 行。材料标注了各声明所在的源码提交与位置，但本页依据的是提供的本地摘录，未直接核对上游文件。

## 为什么存在

从名称看，这个字段可能用于指定运行时配置文件的路径；这是用途推断。[I] 材料没有字段注释、读取代码或调用示例，尚不能确定路径指向什么文件、文件采用什么格式，以及其中的配置影响哪些组件。

要解释它解决的问题，还需要核对谁读取这个字段、何时读取，以及它与其他配置入口的优先级关系。当前七份声明只能支持静态定义的一致性，不能建立发布分支之间的行为对照，也不足以登记已核对版本。

## 开了的代价

填写字符串后的读取开销、生效时机、错误处理和互斥关系，均缺少实现依据。静态默认值为 `None` 只说明声明没有提供路径，不能据此判断运行时配置功能是否关闭，或是否会从其他入口取得路径。

后续需核对路径不存在、文件不可读、内容格式错误时的处理方式，以及文件是在初始化时读取还是运行中重新读取。上述内容是待核问题，不是已经确认的功能或报错行为；本次材料也没有部署或设备运行记录。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.runtime_config_path` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| releases/v0.13.0 | 无 | `f92eadfc` |
| releases/v0.18.0 | 无 | `35b0fdf7` |
| releases/v0.20.2rc | 无 | `792ea0c6` |
| releases/v0.21.0rc | 无 | `b4884b42` |
| releases/v0.22.1rc | 无 | `6fb87d07` |
| releases/v0.23.0 | 无 | `c399628f` |
| releases/v0.24.0rc | 无 | `b19127c7` |
| releases/v0.25.1rc | 无 | `73953fc0` |
| releases/v0.26.0rc | 无 | `b98aab21` |
| releases/v0.27.1rc | 无 | `0ce12444` |
| releases/v0.28.0rc | 无 | `96df6231` |
| releases/v0.29.0rc | 无 | `b3d3bb68` |
| releases/v0.30.0 | 无 | `07fab1a6` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.31.0rc | 有 | `5e40bc72` |
| releases/v0.32.0rc | 有 | `ec59279f` |
| releases/v0.33.0rc | 有 | `c64ace67` |
| main | 有 | `9b8c54e0` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["runtime_config_path"]` |
| 所属类 | `AscendConfig` |
| 类型 | `str \| None` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:729` [C10] |
| 版本 | main · 9b8c54e0d189f34259ab5112f2378ccf558a4e18 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
