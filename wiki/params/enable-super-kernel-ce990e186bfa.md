---
id: enable-super-kernel-ce990e186bfa
title: enable_super_kernel
type: param
summary: >-
  ascend_compilation_config 中的 Super Kernel 优化开关：在编译与图捕获时提交优化选项和 scope。固定 v0.26
  维护快照及 main 中可用，省略时跟随 enable_static_kernel；实际生效还受图模式和硬件限制。
aliases:
  - ascend_compilation_config.enable_super_kernel
  - 超级内核开关
  - super_kernel_optimize
  - super_kernel_scope
chapters:
  - '16'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
relations:
  - to: npugraph-ex
    kind: builds-on
    note: 它是 npugraph_ex → static kernel 之上的第三级，融的是什么、为什么要分三级，在那一页
  - to: acl-graph
    kind: builds-on
    note: >-
      第二个生效点在 ACL Graph 捕获期：wrapper 的 runnable 框入 scope，录完再请求
      super_kernel_optimize
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L115
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L113-L134'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L136-L160'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/compiler_interface.py#L122-L135'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1054-L1064'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L246-L252'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1188-L1229'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/compiler_interface.py#L245-L255'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L43-L48'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L287-L308'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L108-L112
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L271-L276
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L124
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/configuration/additional_config.html
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L614'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L640-L659'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L184-L186
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L210-L213'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L124
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L126
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L588-L596'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L114
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L123
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L124
  - >-
    raw:sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md#L1-L346
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L123-L170'
  - 'vllm-ascend@7d825229:vllm_ascend/compilation/acl_graph.py#L202-L217'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L126
  - 'vllm-ascend@f2f74a16:vllm_ascend/ascend_config.py#L590-L647'
  - 'vllm-ascend@3b318862:vllm_ascend/ascend_config.py#L59-L90'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L545-L605'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/compiler_interface.py#L244-L255'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L66-L111'
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L937-L956'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L127
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md
  - >-
    raw/sha256-4d26972cc76190b84fb0c4bc4fa8e5dc38bccbff799b1073a88ed88e66a1f7a1.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

**v0.30.0rc2 对照：** ascend_compilation_config 中字段静态默认仍为 False；若输入含 enable_static_kernel 而省略本键，before validator 会令本键跟随前者。super kernel 要求 static kernel，static kernel 要求 npugraph_ex；硬件画像不支持 NPUGRAPH_EX 时三者均告警关闭。只抄静态默认值会漏掉这条实际生效链。

`ascend_compilation_config` 里的第三级开关：有效配置开启后，编译期给 npugraph_ex 传入 `super_kernel_optimize=True`，ACL Graph 捕获时用名为 `full_model` 的 scope 包住 wrapper 所执行的 runnable，录完再请求 `aclgraph.super_kernel_optimize()`。scope 给出优化范围，不保证整网最终只剩一个 kernel。**它是跟随式的**——省略这个键而设置 `enable_static_kernel` 时，它跟随后者；硬件降级处理之后，仍开启 super kernel 就必须同时开启 static kernel，否则依赖断言失败 [C3]。kernel 指一个算子在设备上运行的程序；与 static kernel 的区别见 [npugraph_ex](../concepts/npugraph-ex.md)。

**存在范围必须区分维护分支和发布标签。** 固定 v0.23 维护快照与 GLM 镜像没有这个配置及消费入口 [C17][C23]。固定 v0.26 维护快照 `2ed6cbba` 已包含 PR #15074，main 后由 PR #15059 引入；但最初的 `v0.26.0rc1` 标签 `f2f74a16` 尚无该键，`v0.27.1rc1` 标签 `3b318862` 也没有，`v0.28.0.rc1` 中才可见主线这套实现。不能只按“版本号不小于 v0.26”判断支持 [C31][C32]。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 这个键 | 不存在 | 有 | 有 | v0.23 上照新文档写它，会被 `AscendCompilationConfig.__init__` 的 `**kwargs` 吞掉，不报错也不生效 [!] |
| 类型与默认 | — | `bool` 或 `None`，默认 `None`，为 `None` 时取 `enable_static_kernel` [C14] | 字段 `bool = False`，另有一个 before-validator 在输入里出现 `enable_static_kernel` 时替你补上 | 写法不同、对用户的净效果一样：不写就跟着静态内核走 |
| 硬性依赖 | — | `assert self.enable_static_kernel` | 同左 | 硬件降级后仍启用时检查 super → static → npugraph_ex 依赖 |
| 只想开 static | — | 显式写 `"enable_super_kernel": false` | 同 | 使用 JSON 布尔值可避免两个版本对字符串处理不同 [S13] |
| 键名拼错 | 静默忽略 | 静默忽略 | 报错 | v0.26 的 `**kwargs` 什么都收，main 的 `@config` 带 `extra="forbid"` [C9] |
| 值写成字符串 `"false"` | — | 真（无类型转换，非空串即真）[D] | 假（pydantic 宽松转换） | 同一份 JSON 在两个版本上结论相反，v0.26 上还会连带触发 `assert` [!] |
| 硬件不支持时 | — | 判 `is_310p()` | 查 `HardwareCapability.NPUGRAPH_EX`，310P 不具备该能力 [C10] | 对请求开启的项分别告警并关闭；须看最终配置与捕获日志 |
| `cudagraph_mode` 为 `NONE` 或需要 piecewise 编译 | — | 平台层关闭三级开关 | 同 | `FULL_AND_PIECEWISE` 属于被关闭的情形；显式图模式及其他配置会改变最终路径 |
| 进不进编译缓存 hash | — | 进 | 进 | 改变对应缓存键；不等于删除其他键的缓存，也不保证每次切换都完整重编 |

## 为什么存在

先划清它管什么：`fuse_*` 那几条在编译期匹配局部子图并换成融合算子；这个键额外提交 Super Kernel 优化选项和捕获范围，两层各有开关。这里比较的是固定 Ascend manager 的三条局部规则：`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_muls_add`；不代表整套编译器只有三种优化。旧 `fuse_allreduce_rms` 入口在 v0.25.1rc1 起被移除，错误配置在 main 还会被拒收，详见 [fuse_allreduce_rms](fuse-allreduce-rms.md)。各规则的内容与条件见 [npugraph_ex](../concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换)。

在这条实现中，调用方显式标出可一起优化的范围。静态内核按特定形状编译算子；Super Kernel 优化再利用范围内的 kernel 调度机会。捕获 ACL Graph 时，`super_kernel_scope("full_model", ...)` 包住 `self.runnable(*args, **kwargs)`；实际范围由 wrapper 中的 runnable 决定，名字叫 full_model 也不能证明包含了所有服务步骤 [C20][C35]。该上下文管理器在关闭时直接执行内部代码，在开启时调用 scope begin/end [C5]。

这个有效配置分别参与编译和捕获；两处还有各自的前置条件：

- **编译期**：`compiler_interface.py` 里，`enable_static_kernel` 为真的分支内部再判一次它，真就往 `options` 里塞 `super_kernel_optimize=True` 和 `{"dcci_after_kernel_end": [".*"]}` [C4]。**注意这层嵌套**——静态内核没开，这段代码根本到不了，这就是那条 `assert` 想守住的东西；它崩出来的原话两个版本一字不差，是 `Super kernel generation requires static kernel to be enabled.` [C3]。
- **捕获期**：录完图之后 `if self.enable_super_kernel: aclgraph.super_kernel_optimize(optimize_options={"dcci_after_kernel_end": [".*"]})` [C6]，用的是同一份选项。

**「不写就跟随」这件事，两个版本用了完全不同的手法。** v0.26 把默认值写成 `None` 当哨兵，进 `__init__` 第一件事就是 `if enable_super_kernel is None: enable_super_kernel = enable_static_kernel` [C14]。main 迁到 pydantic 之后 `None` 不再是合法的 `bool`，于是改用一个 `mode="before"` 的 model validator：看输入里有没有 `enable_super_kernel`，没有而有 `enable_static_kernel` 就把后者的值抄过去 [C2]。官方文档那一栏的「Default」写的是 `Inherits enable_static_kernel` 而不是 `False` [S11]（v0.26 的同一张表写法完全一致 [S15]）——按行为看这个写法是对的，按 main 的字段定义看又不对，两边都别单看一处。

## 开了的代价

**先确认最终图模式。** `NONE`、需要 piecewise 编译以及不支持的图模式，会进入关闭三级开关的分支；piecewise 分支还会先检查编译模式是否合法，可能在写回前报错 [C7][C33]。`FULL_AND_PIECEWISE` 也要求 piecewise 编译，因此仅把这个键设为 true 不够。应按模型支持选择 `FULL` 或 `FULL_DECODE_ONLY` 并核对最终配置，详见 [ACL Graph](../concepts/acl-graph.md)。

**测量时把 static 和 Super Kernel 的成本分开。** 有效启用 super kernel 要求 static kernel。官方对 static kernel 提示：启动捕获阶段可能因算子数量和模型复杂度多花几分钟到几十分钟，这不是 Super Kernel 单独的成本或任何模型的保证值 [S19]。

来源19（baa023ad graph_mode.md 184–186）的时间范围描述static kernel的启动编译，不能当作Super Kernel额外成本。要测后者，应保持static开启、只切换Super Kernel，分别比较启动时间、实际融合数量和性能；这里尚无这组设备对照。

**保留 static、关闭 Super Kernel 时显式写 JSON `false`。** 在支持该模型图模式的前提下，可采用下例；这里在官方配置示例上补出图模式，避免落入 piecewise 关闭分支：

```bash
vllm serve Qwen/Qwen2-7B-Instruct \
  --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
  --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true, "enable_static_kernel":true, "enable_super_kernel":false}}'
```

省掉最后一项，它会跟着 `enable_static_kernel` 变成 `true` [S11]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)）。线上 v0.26 文档当前也列出该项，但它不能替代发布标签的源码；本页所说“v0.26 有”特指已回补的维护快照。

**它会改变编译缓存键。** `AscendCompiler` 将 `torch_npu_version` 和三级开关纳入 hash [C8][C34]。两个有效配置值对应不同的键，因此不能直接共用同一个条目；如果目标键已有可用缓存，是否命中还由后续缓存逻辑决定。切换开关不等于清空缓存，也不能据此断言两次都付完整编译时间。

**310P 上会告警降级。** v0.26 用 `is_310p()` 判断，main 改查 `HardwareCapability.NPUGRAPH_EX`，310P 的能力集合没有此项。对请求开启的项分别告警，然后将三级开关关闭。v0.26 的 Super Kernel 告警包含 `Ascend 310P`，main 改用 `current hardware profile`；按旧硬件关键词查找可能漏掉这条日志，应同时核对最终配置。

**放到 GLM 双机：固定镜像没有这个键。** `db701c1f` 的构造器会把嵌套的 `enable_super_kernel` 收入未使用的 `**kwargs`，不会因此启用它 [C23]。换到包含开关的版本后，还须核对 GLM 专用实现、量化、runner、配套 CANN/torch_npu、图模式和各算子支持；不能说只剩打开 static 一步。固定教程的 `FULL_DECODE_ONLY` 仅说明其配置形式避开上述 piecewise 分支，不构成升级后的兼容性验证。**待核**：没有 GLM 双机 static+super 的启动耗时、实际融合数量或 TPOT 对照；主线的算子级融合数字不能充当这项优化的收益。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendCompilationConfig.enable_super_kernel` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_super_kernel"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:126` [C30] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if isinstance(data, ArgsKwargs):
    if data.kwargs is None:
        return data
    kw = dict(data.kwargs)
    if 'enable_super_kernel' not in kw and 'enable_static_kernel' in kw:
        kw['enable_super_kernel'] = kw['enable_static_kernel']
    return ArgsKwargs(data.args, kw)
````

````python
if isinstance(data, dict):
    if 'enable_super_kernel' not in data and 'enable_static_kernel' in data:
        data = dict(data)
        data['enable_super_kernel'] = data['enable_static_kernel']
````

````python
if not get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX):
    if self.enable_npugraph_ex:
        logger.warning('npugraph_ex is not supported by the current hardware profile. Disabling it.')
    if self.enable_static_kernel:
        logger.warning('static kernel requires npugraph_ex, which is not supported by the current hardware profile. Disabling it.')
    if self.enable_super_kernel:
        logger.warning('super kernel requires static kernel, which is not supported by the current hardware profile. Disabling it.')
    self.enable_npugraph_ex = False
    self.enable_static_kernel = False
    self.enable_super_kernel = False
````
