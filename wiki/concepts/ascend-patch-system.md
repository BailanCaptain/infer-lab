---
id: ascend-patch-system
title: 运行时适配：补丁、模型注册与算子替换
type: feature
summary: 先解释进程内名称绑定，再区分平台补丁、Worker 补丁、模型注册与 CustomOp 替换；以 GLM 的配置识别和 KDA 实现为例。
aliases: [patch, adapt_patch, monkey patch, patch/platform, patch/worker, 补丁机制, 猴子补丁, 运行时替换, 全局补丁, Worker 补丁, is_global_patch]
chapters: ["10"]
order: 90
sources:
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L19-L77
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L204
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57
  - vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L18-L53
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L24
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L17-L56
verified: []
evidence: "C"
relations:
  - {to: platform-plugin-registration, kind: builds-on, note: 注册接口提供正式扩展点}
  - {to: npu-platform, kind: builds-on, note: 平台准备阶段加载全局适配}
  - {to: linear-attention, kind: builds-on, note: KDA 的数学机制与设备实现分开理解}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 先理解运行时名称绑定

Python 模块中的名字可以指向函数或类。若启动时把 `module.operation` 重新赋为另一个函数，后续通过这个模块属性调用时便会执行新实现，这类运行时替换通常称为 monkey patch。它改变的是进程内绑定，未必改动磁盘上的上游源文件。

替换也有边界：其他代码若此前已经保存原函数引用，修改模块属性不一定改变那个引用。因此替换时机、导入路径与最终调用对象都重要。不同进程的 Python 状态分别初始化，不能只检查前端进程就推断 Worker 的绑定。

```wiki-diagram
file: patch-timing
```

## 平台与 Worker 各自需要哪些准备

Ascend 的 `adapt_patch(is_global_patch=...)` 按参数导入 `patch/platform` 或 `patch/worker`。[C1] 导入模块时执行注册与替换语句，由导入条件决定实际生效的内容。

平台准备钩子会加载全局适配；通用插件的部分入口也通过带幂等标记的 `_ensure_global_patch()` 覆盖 EngineCore 等初始化路径。[C2][C3] Worker 构造再加载 Worker 侧适配，然后注册算子与初始化 Ascend 配置。[C4]

这两个目录是组织和加载边界，不意味着整个程序只可能在两个固定时间点改变实现。目录入口还按设备、上游版本和可选依赖选择模块。[C5][C6] 判断某个补丁是否启用，要从调用入口一路核到条件分支，文件存在本身并不足够。

## GLM 的三种适配不能混称为补丁

GLM 专用代码使用多种扩展机制，各自解决不同问题。

| 机制 | 本例中的动作 | 得到什么 |
|---|---|---|
| 配置类型与转换器登记 | 平台补丁模块注册 `glm5_next` 等配置类型，并加入架构转换器 | 配置解析器可以识别模型，并确定 MLA 相关属性 |
| 模型注册 | 将 `Glm5NextForCausalLM` 等架构名称映射到 Ascend 模型类 | 加载路径能够定位专用模型实现 |
| CustomOp 替换登记 | 将 `KimiGatedDeltaNetAttention` 键映射到 `AscendKimiGatedDeltaNetAttention` | KDA 算子选择设备实现 |

配置补丁中的转换器通过 `kv_lora_rank` 判断 MLA 属性，并写入转换器登记表。[C7] 模型注册在通用模型插件路径完成。[C8] KDA 的 CustomOp 登记有明确的上游 `0.23.0` 条件；登记键保留 GatedDeltaNet 接口名称，数学机制仍应沿 GLM 层的实际计算核对。[C9] 模型注册、配置转换与算子登记分别参与实现选择；模型层型与计算连接见[模型介绍](glm-5-3-flash.md)。

## 如何确认正在执行哪一份代码

查到一个上游函数后，先看调用方从哪里取得它：直接模块访问、提前导入的名称、注册表返回值、派生类方法，还是 CustomOp 分派。再检查 Ascend 对该入口的注册与替换条件。

启动时的赋值动作通常不会出现在每次推理的调用栈中；被替换的函数真正执行时，调用栈仍可显示其实际文件与函数来源。排查应结合 traceback、最终绑定对象及初始化日志，而不是假定栈里只能看到上游名字。

同样，搜不到某个函数名也不能证明行为完全来自上游：派生类、模型注册、后端选择和算子分派都可能改变执行路径。[阅读仓库](reading-vllm-ascend.md)将这些入口接回请求架构。

## 为什么需要版本边界

运行时替换依赖上游接口、导入时机与对象结构。上游重构后，旧替换可能不再适用；一种设备或版本的导入条件也不能外推到另一种组合。Ascend 的补丁规范要求记录原因、修改方式、上游关联和移除计划。[C10]

本页使用[固定 GLM 专用代码](../sources/glm-5-3-flash-baseline.md)，不是对所有 Ascend 分支的补丁清单统计。阅读新版本时应重新确认入口、条件、目标和实际消费者；源码中的适配路径只能提供部署验证的依据，不能代替实机结果。
