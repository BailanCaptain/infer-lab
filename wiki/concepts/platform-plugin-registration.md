---
id: platform-plugin-registration
title: 插件注册机制
type: feature
summary: 装包时声明两组 entry point，vLLM 启动时扫出来：一个给平台类，四个给连接器、加载器、profiling 与模型注册。
aliases: [entry point, entry_points, vllm.platform_plugins, vllm.general_plugins, 插件注册]
chapters: ["10"]
order: 50
sources:
  - vllm-ascend@2c59ff10:setup.py#L543-L551
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L19-L35
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L38-L42
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L44-L77
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@b255ab59:setup.py#L518-L529
  - https://docs.vllm.ai/projects/ascend/en/latest/index.html
verified: ["main", "releases/v0.23.0"]
evidence: "C"
relations:
  - to: engine-processes
    kind: builds-on
    note: 四个 general plugin 为什么每个都要先补一次 patch，理由只在进程边界那一页说得清
  - to: one-request
    kind: builds-on
    note: 这五个口在那条请求发出之前就已经用完了，是它能被昇腾接住的前提
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

`setup.py` 里的 `entry_points` 是昇腾接进 vLLM 的唯一入口。v0.23 维护分支上声明了两组、共五个 [C1]；vLLM 启动时用 Python 的 entry point 机制扫出这五个函数并逐个调用，此外不需要任何注册代码。

```wiki-diagram
file: plugin-registration
```

## 那条请求走到这里

还早得很——这一步发生在**进程刚起来、命令行还没解析完**的时候。

但有一个细节会一路影响到那条请求：`register()` 返回的是字符串，所以 `torch_npu` 直到 vLLM 确定要用昇腾之后才被 import。如果这里返回的是类，那么**任何一个扫过插件的进程都会被迫初始化 torch_npu 一次**——而 `torch_npu` 只允许全局初始化一次。这条约束在 [NPUPlatform](npu-platform.md) 里还会再撞一次，撞的地方是显存查询。

## 第一组只有一个，而且只返回字符串

`vllm.platform_plugins` 下只有 `ascend = vllm_ascend:register`。`register()` 的函数体只有一行 `return "vllm_ascend.platform.NPUPlatform"` [C3]。

返回字符串而不是类，是这条链路上最容易被忽略的设计 [D]。导入 `NPUPlatform` 会连带把 `torch_npu` 拉进当前进程，而 vLLM 在扫插件的时候还没决定要用哪块硬件——它可能同时看到几个平台插件。给字符串，vLLM 就能先比较、再在确定要用昇腾之后才导入。

## 第二组四个，做的是四件互不相干的事

`vllm.general_plugins` 下的四个函数各自注册一类东西 [C4]：

| 注册函数 | 注册了什么 |
|---|---|
| `register_connector` | KV 传输连接器与权重传输引擎 |
| `register_model_loader` | 两个模型加载器：netloader 与 rfork |
| `register_service_profiling` | 服务级 profiling 的配置生成 |
| `register_model` | 昇腾自己的模型实现 |

四个里有三个的第一句都是 `_ensure_global_patch()`，只有 `register_model` 不是 [C4]。这不是疏漏 [D]：前三者会碰到调度器与引擎侧的对象，而那些对象所在的进程走不到平台层打 patch 的那条路；`register_model` 只往模型注册表里加条目，不依赖被改过的上游行为 [D]。

`_ensure_global_patch()` 自己带一个 `_GLOBAL_PATCH_APPLIED` 布尔量做幂等，所以三个函数各调一次也只真正打一遍 [C2]。它的 docstring 直接写明了理由：vLLM 在 engine-core 子进程里加载 general plugin，而 E2E 测试的 conftest hook 在那个进程里不会跑，所以影响调度器与引擎代码的全局 patch 必须也从这些 plugin 入口再打一次 [C2]。

## 两个分支的入口清单

| 项 | v0.23 维护分支 | main 开发主线 |
|---|---|---|
| `vllm.platform_plugins` | `ascend`（1 个）[C1] | 同 [C6] |
| `vllm.general_plugins` | 4 个 [C1] | 同 [C6] |
| 第三组 | 没有 [C1] | `ms_service_metric.providers` → `vllm_ascend.observability:get_metric_provider` [C6] |

## 常见误解

- **「注册要在代码里显式调用」**——不需要。`entry_points` 是安装期元数据，装完包就在；`pip uninstall vllm-ascend` 之后 vLLM 就完全看不到昇腾，不需要改任何配置 [D]。
- **「五个入口有先后依赖」**——平台那一个和 general 那四个之间没有约定顺序，所以其中那三个才各自做幂等的 `_ensure_global_patch()` [C2]。假设「平台已经初始化好了」来写 general plugin 会在 engine-core 进程里出错 [I]。
- **「`register_model` 也该补 patch，漏了」**——它确实不补，而且合理：见上。
