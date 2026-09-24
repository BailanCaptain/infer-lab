---
id: enable-super-kernel-ce990e186bfa
title: enable_super_kernel
type: param
summary: >-
  ascend_compilation_config 里的第三级加码开关：把整网框进一个 super kernel scope 再融一次。v0.23
  上没有这个键，v0.26 起有，不写就跟随 enable_static_kernel，开了必须静态内核也开。
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
updated: '2026-09-22'
relations:
  - to: npugraph-ex
    kind: builds-on
    note: 它是 npugraph_ex → static kernel 之上的第三级，融的是什么、为什么要分三级，在那一页
  - to: acl-graph
    kind: builds-on
    note: 第二个生效点在 ACL Graph 捕获期——整网框进一个 scope，录完再对图调一次 super_kernel_optimize
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
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L297-L308'
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
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L612'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L640-L659'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L184-L186
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L210-L213'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L124
rawSources:
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

`ascend_compilation_config` 里的第三级开关：开了之后编译期给 npugraph_ex 多传一个 `super_kernel_optimize=True`，捕获期把整网框进一个叫 `full_model` 的 super kernel scope，录完再对图调一次 `aclgraph.super_kernel_optimize()` [C4]。**它是跟随式的**——不写这个键、但写了 `enable_static_kernel`，它就取后者的值；而开了它就**必须**静态内核也开，否则 `assert` 当场失败 [C3]。融的到底是什么、和 static kernel 差在哪，见 [npugraph_ex](../concepts/npugraph-ex.md)。

**存在范围。** v0.23 维护分支上**没有这个键**：那个分支的 `AscendCompilationConfig.__init__` 形参里只有 `enable_npugraph_ex` / `enable_static_kernel` / 两个 fuse 项 [C17]，全仓 grep 不到 `super_kernel`。v0.26 分支（2026-09-17 源码快照）与 main 上都有。下面「版本谱系」里还有一处容易看漏：v0.26.0rc 有、**v0.27.1rc 反而没有**、v0.28.0rc 与 main 又有——它是先由 PR #15074 单独打进 v0.26 分支，再由 PR #15059 进的 main，v0.27.1rc 从中间那段主线上分出去，正好错过 [D]。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 这个键 | 不存在 | 有 | 有 | v0.23 上照新文档写它，会被 `AscendCompilationConfig.__init__` 的 `**kwargs` 吞掉，不报错也不生效 [!] |
| 类型与默认 | — | `bool` 或 `None`，默认 `None`，为 `None` 时取 `enable_static_kernel` [C14] | 字段 `bool = False`，另有一个 before-validator 在输入里出现 `enable_static_kernel` 时替你补上 | 写法不同、对用户的净效果一样：不写就跟着静态内核走 |
| 硬性依赖 | — | `assert self.enable_static_kernel` | 同 [C3] | super → static → npugraph_ex 三级单向，缺下面一级，上面这级 `assert` 直接崩 |
| 只想开 static | — | 显式写 `"enable_super_kernel": false` | 同 | 官方给了可复制的启动行，这是唯一的关法 [S13] |
| 键名拼错 | 静默忽略 | 静默忽略 | 报错 | v0.26 的 `**kwargs` 什么都收，main 的 `@config` 带 `extra="forbid"` [C9] |
| 值写成字符串 `"false"` | — | 真（无类型转换，非空串即真）[D] | 假（pydantic 宽松转换） | 同一份 JSON 在两个版本上结论相反，v0.26 上还会连带触发 `assert` [!] |
| 硬件不支持时 | — | 判 `is_310p()` | 查 `HardwareCapability.NPUGRAPH_EX`，310P 的能力集合里确实没有这项 [C10] | 两边都只打一条 warning 再置 `False`，不报错——开没开只能看日志 |
| `cudagraph_mode` 为 `NONE` 或需要 piecewise 编译 | — | 被平台层写回 `False` | 同 | 默认的 `FULL_AND_PIECEWISE` 正走这条路，等于这个键默认永远不生效 |
| 进不进编译缓存 hash | — | 进 | 进 [C8] | 改这一个布尔值，整套编译产物缓存作废，要重编一次 |

## 为什么存在

它存在是因为 **super kernel 那一步只能由调用方划范围**。静态内核解决的是「形状定下来，算子编成定形二进制」，落在编译选项里；super kernel 要把一串已经排好的 kernel 融成一个，得先告诉运行时「这一段算一个整体」。vllm-ascend 给的范围是整个模型：捕获 ACL Graph 时用 `super_kernel_scope("full_model", ...)` 把 `self.runnable(*args, **kwargs)` 整个框住 [C20]，这个上下文管理器住在 `vllm_ascend/utils.py`，在 `enabled` 为假时就是个空壳，直接 `yield` 过去 [C5]。

值走的是两条并行的路，两条都只看这一个布尔值：

- **编译期**：`compiler_interface.py` 里，`enable_static_kernel` 为真的分支内部再判一次它，真就往 `options` 里塞 `super_kernel_optimize=True` 和 `{"dcci_after_kernel_end": [".*"]}` [C4]。**注意这层嵌套**——静态内核没开，这段代码根本到不了，这就是那条 `assert` 想守住的东西。
- **捕获期**：录完图之后 `if self.enable_super_kernel: aclgraph.super_kernel_optimize(optimize_options={"dcci_after_kernel_end": [".*"]})` [C6]，用的是同一份选项。

**「不写就跟随」这件事，两个版本用了完全不同的手法。** v0.26 把默认值写成 `None` 当哨兵，进 `__init__` 第一件事就是 `if enable_super_kernel is None: enable_super_kernel = enable_static_kernel` [C14]。main 迁到 pydantic 之后 `None` 不再是合法的 `bool`，于是改用一个 `mode="before"` 的 model validator：看输入里有没有 `enable_super_kernel`，没有而有 `enable_static_kernel` 就把后者的值抄过去 [C2]。官方文档那一栏的「Default」写的是 `Inherits enable_static_kernel` 而不是 `False` [S11]（v0.26 的同一张表写法完全一致 [S15]）——按行为看这个写法是对的，按 main 的字段定义看又不对，两边都别单看一处。

## 开了的代价

**它默认就开不成，因为默认的图模式先把它关掉了。** `cudagraph_mode` 是 `NONE` 或 `requires_piecewise_compilation()` 为真时，平台层把 `enable_npugraph_ex` / `enable_static_kernel` / `enable_super_kernel` 三个键一起写回 `False`，三处分支各写一遍 [C7]。默认的 `FULL_AND_PIECEWISE` 就在第二条分支上。要让这个键有机会生效，得先把图模式换成 `FULL` 或 `FULL_DECODE_ONLY`——这一段在 [ACL Graph](../concepts/acl-graph.md) 那一页。

**开它等于顺带接受静态内核的启动成本。** 因为依赖链是单向的，开 super kernel 必然要开 static kernel，而官方对后者的说法很直白：启动时的图捕获阶段会多出几分钟到几十分钟的编译，跑起来之后不影响请求 [S19]。所以这个键不是一个可以「先试试看」的旋钮——试一次的代价是一次完整的重编。

**关它要显式写 `false`，光不写没用。** 想要静态内核但不要 super kernel，唯一的写法是官方那行：

```bash
vllm serve Qwen/Qwen2-7B-Instruct \
  --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true, "enable_static_kernel":true, "enable_super_kernel":false}}'
```

省掉最后一项，它会跟着 `enable_static_kernel` 变成 `true` [S11]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)）。

**它进编译缓存的 hash 因子，改一次就作废一次。** `AscendCompiler` 算缓存 key 时把 `torch_npu_version` 和这三个开关一起塞进去做 sha256 [C8]。所以「先开着跑一版、再关掉跑一版」对比性能，两次都要付完整编译时间，不存在复用。

**310P 上它会被静默降级。** 硬件档不支持 npugraph_ex 时，三个开关连同 warning 一起置 `False`；v0.26 上这个判据是写死的 `is_310p()` [C14]，main 换成了查 `HardwareCapability.NPUGRAPH_EX` 能力表，而 310P 的能力集合里确实没有这一项。两边都是 warning 不是报错——在 310P 上配了以为开着，只能去日志里找那句 `super kernel requires static kernel ... Disabling it.`。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 有（4 个文件） |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 有（4 个文件） |
| releases/v0.29.0rc | 有（5 个文件） |
| main | 有（5 个文件） |

- **引入**：2025-10-20 · 068ed706c8a4e6d2c35bc215b95d0ff0a76c5692 · PR [#3485](https://github.com/vllm-project/vllm-ascend/pull/3485) —— [feat][torchair] support super kernel feat for quantized dsr1 (#3485)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev
  - `vllm_ascend/torchair/quantization/torchair_w8a8_dynamic.py` +75 / −65（文本行变化）
  - `vllm_ascend/torchair/ops/torchair_fused_moe.py` +23 / −10（文本行变化）
  - `vllm_ascend/ascend_config.py` +19 / −2（文本行变化）
  - `vllm_ascend/ops/linear.py` +2 / −1（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +9 / −1（文本行变化）
- **移除**：2025-12-10 · 835b4c8f1dd6fd485ec2df305c68fae92e24487c · PR [#4814](https://github.com/vllm-project/vllm-ascend/pull/4814) —— Drop torchair (#4814)
  包含该提交的 tag：v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/torchair/ops/torchair_fused_moe.py` +0 / −1436（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +0 / −1339（文本行变化）
  - `vllm_ascend/torchair/torchair_sfa.py` +0 / −1317（文本行变化）
  - `vllm_ascend/torchair/torchair_mla.py` +0 / −1263（文本行变化）
  - `vllm_ascend/torchair/models/torchair_pangu_moe.py` +0 / −1116（文本行变化）
- **引入**：2026-09-04 · 5d857a73428a9921af55bce338bde86aa22573bd · PR [#15074](https://github.com/vllm-project/vllm-ascend/pull/15074) —— [Feature][MRV1][v0.26.0] Add Super Kernel optimization support for Ascend backend (#15074)
  包含该提交的 tag：未找到；分支：origin/releases/v0.26.0rc
  - `vllm_ascend/compilation/acl_graph.py` +30 / −5（文本行变化）
  - `vllm_ascend/ascend_config.py` +14 / −0（文本行变化）
  - `vllm_ascend/compilation/compiler_interface.py` +6 / −0（文本行变化）
  - `vllm_ascend/platform.py` +6 / −0（文本行变化）
- **引入**：2026-09-11 · 7ab47e73d005756963e3c6dd0e491296401b1f19 · PR [#15059](https://github.com/vllm-project/vllm-ascend/pull/15059) —— [Feature][MRV1] Add Super Kernel optimization support for Ascend backend (#15059)
  包含该提交的 tag：未找到；分支：origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/compilation/acl_graph.py` +30 / −5（文本行变化）
  - `vllm_ascend/ascend_config.py` +29 / −3（文本行变化）
  - `vllm_ascend/compilation/compiler_interface.py` +6 / −0（文本行变化）
  - `vllm_ascend/platform.py` +3 / −0（文本行变化）

当前含该标识符的 tag：v0.9.1、v0.9.1rc2、v0.9.1rc3、v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_super_kernel"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:124` [C21] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

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
if 'enable_super_kernel' not in kw and 'enable_static_kernel' in kw:
    kw['enable_super_kernel'] = kw['enable_static_kernel']
````

````python
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
