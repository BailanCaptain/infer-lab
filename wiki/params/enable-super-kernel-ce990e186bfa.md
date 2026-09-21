---
id: enable-super-kernel-ce990e186bfa
title: enable_super_kernel
type: param
summary: enable_super_kernel 的静态定义，正文待补。
origin: seed
verified: ["main"]
evidence: C
updated: '2026-09-19'
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/ascend_config.py#L115
rawSources:
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

骨架，待补：enable_super_kernel 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_super_kernel"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:115` [C1] |
| 版本 | main · b255ab59662d8c665e5534e926f913b1c1179b1c |

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

## 事实表

静态事实见上方自动生成区；行为与版本差异待核对。

## 为什么存在

骨架，待补：为什么存在。

## 开了的代价

骨架，待补：开了的代价与互斥关系。

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
| main | 有（4 个文件） |

- **引入**：2025-10-20 · 068ed706c8a4e6d2c35bc215b95d0ff0a76c5692 · PR [#3485](https://github.com/vllm-project/vllm-ascend/pull/3485) —— [feat][torchair] support super kernel feat for quantized dsr1 (#3485)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev
  - `vllm_ascend/torchair/quantization/torchair_w8a8_dynamic.py` +75 / −65（文本行变化）
  - `vllm_ascend/torchair/ops/torchair_fused_moe.py` +23 / −10（文本行变化）
  - `vllm_ascend/ascend_config.py` +19 / −2（文本行变化）
  - `vllm_ascend/ops/linear.py` +2 / −1（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +9 / −1（文本行变化）
- **移除**：2025-12-10 · 835b4c8f1dd6fd485ec2df305c68fae92e24487c · PR [#4814](https://github.com/vllm-project/vllm-ascend/pull/4814) —— Drop torchair (#4814)
  包含该提交的 tag：v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
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
  包含该提交的 tag：未找到；分支：origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/compilation/acl_graph.py` +30 / −5（文本行变化）
  - `vllm_ascend/ascend_config.py` +29 / −3（文本行变化）
  - `vllm_ascend/compilation/compiler_interface.py` +6 / −0（文本行变化）
  - `vllm_ascend/platform.py` +3 / −0（文本行变化）

当前含该标识符的 tag：v0.9.1、v0.9.1rc2、v0.9.1rc3、v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3
