---
id: graph-mode-layer
title: 图模式层
type: feature
summary: 昇腾不走上游的 torch.compile 默认路径，而是用自己的编译后端加 ACLGraphWrapper；捕获在启动最后一步发生。
aliases: [ACL Graph, ACLGraphWrapper, AscendCompiler, 图模式, graph mode, piecewise, xlite]
chapters: ["16"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L134
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L176-L182
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L892-L897
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L55-L64
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L65-L85
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L706-L732
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L680-L690
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L1-L14
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ACL_Graph.html
  - vllm-ascend@2c59ff10:vllm_ascend/xlite/xlite_worker.py#L16-L30
  - vllm-ascend@2c59ff10:vllm_ascend/xlite/xlite_model_runner.py#L19-L36
verified: ["releases/v0.23.0"]
evidence: "S"
relations:
  - to: npu-model-runner
    kind: builds-on
    note: 捕获与回放包的就是 runner 的执行体，_dummy_run 是跑假批的那一步
  - to: one-request
    kind: builds-on
    note: 那条请求的 199 步 decode 形状一样，回放的是同一张图——图模式的收益几乎全在这里
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

`NPUPlatform` 里 `simple_compile_backend` 被写成 `"eager"`，紧跟的注释就是 `# Disable torch.compile()` [C1]。这不代表昇腾没有图模式——它换成了自己的两个接入点 [D]：`get_compile_backend` 给编译后端，`get_static_graph_wrapper_cls` 给静态图包装器。

```wiki-diagram
file: graph-mode
```

## 那条请求走到这里

那条请求的 200 步在图模式眼里只有两类：

- **第 1 步**，批里有 37 个 token。这个形状多半不在捕获列表里，要么被 padding 到某个捕获过的尺寸，要么就按 eager 跑。
- **第 2 到第 200 步**，每步 1 个 token，**199 步的批形状一模一样**。于是 `batch_descriptor` 也一模一样，查到同一个 key，回放同一张图 [C5]。

这解释了图模式的收益结构：**它几乎全部来自 decode** [D]。prefill 的形状千变万化，捕获不划算；decode 的形状高度重复，捕获一次能用上千次。那条请求 199 次回放同一张图，省掉的是 199 次把算子逐个下发的开销。

也解释了为什么启动慢：那 199 次回放的前提，是启动期把每个可能的尺寸都真跑一遍录下来。

## 官方文档把边界划得很清楚

ACL Graph 的设计文档开门见山：ACL Graph 是 vLLM 静态图执行在昇腾上的实现；上游 vLLM 与 PyTorch 的文档已经描述了通用图模型（`CUDAGraphMode`、运行时分派、batch descriptor、分桶与 padding、full graph 与 piecewise graph 的定义），这份文档只讲昇腾特有的部分——**平台接入点、ACL 图捕获引入的额外约束、以及回放期间保证注意力参数正确的机制** [S8]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ACL_Graph.html)）。

同一段还写明了实现边界：vLLM 提供通用分派路径，`vllm-ascend` 提供平台包装器、捕获尺寸裁剪、以及 ACL 图回放所需的注意力更新逻辑 [S8]。读这一层之前先接受这个分工，否则会在昇腾仓库里找通用图概念而找不到 [A]。

## 两个接入点

`get_compile_backend()` 返回 `"vllm_ascend.compilation.compiler_interface.AscendCompiler"`，docstring 说明了动因：以前默认用 EagerAdaptor，为了做图融合才定义了自己的后端编译器 [C2]。

`get_static_graph_wrapper_cls()` 返回 `"vllm_ascend.compilation.acl_graph.ACLGraphWrapper"`，docstring 写的是「piecewise 图用的 piecewise backend 类」[C3]。

## 包装器自己把工作流程写在 docstring 里

`ACLGraphWrapper` 的类注释给了四步 [C5]：

1. 初始化时给这个包装器指定一个运行模式（`FULL` 或 `PIECEWISE`）；
2. 运行时从 forward context 拿到 `runtime_mode` 与 `batch_descriptor`（作为 key），**并且无条件信任它们**；
3. 如果 `runtime_mode` 是 `NONE`，或者与本包装器的模式不匹配，就直接调用被包裹的 runnable；
4. 匹配时才做捕获（key 不存在就新建缓存项）或回放（key 已存在）。

第 2 步那句「blindly trust them」是这一层最需要记住的一条：**分派决策不在包装器里**，它只按上游给的 key 查缓存。所以「为什么这一步没走图」要去查 forward context 怎么定的模式，不是查这个类 [D]。

配套的 `ACLGraphEntry` 是缓存项的结构 [C4]。

## 捕获发生在启动的最后一步

`compile_or_warm_up_model` 里的逻辑 [C6]：先从 `compilation_config` 取 `compile_sizes` 与 `cudagraph_capture_sizes`；`cudagraph_mode` 不是 `NONE` 时，把已在捕获列表里的尺寸从 warmup 列表中剔除，避免重复；再按 compile range 补齐区间端点，保证每个区间至少有一个尺寸被编译或 warmup。

这段里有两处 `if not self.model_config.enforce_eager`：**为真时，上面那段尺寸裁剪和函数末尾那句 `capture_model()` 都跳过**；但 `compile_sizes` 里的尺寸照样逐个 `_dummy_run` 一遍，那个循环在 `if` 外面 [C6]。这是排查图模式问题最快的一刀：开 `enforce_eager` 如果问题消失，范围就锁在这一层 [A]。

## `xlite/` 是另一条路

`xlite/` 有 5 个文件 1227 行，分量在 `xlite.py`（747 行）和 `utils.py`（395 行）；`xlite_worker.py` 与 `xlite_model_runner.py` 各只有几十行，是 `NPUWorker` 和 `NPUModelRunner` 的薄子类，不是另起一套 [C10][C11]。开关是 `additional_config` 里的 `xlite_graph_config`，对应 `XliteGraphConfig` 类 [C7]。第一遍读可以跳过，但要知道它存在，否则看到两套 runner 会困惑。

## 常见误解

- **「`simple_compile_backend = "eager"` 说明昇腾只能 eager 跑」**——它只说明不走上游 `torch.compile` 那条默认路径；昇腾的图模式在另外两个方法里 [C1][C2][C3]。
- **「`ACLGraphWrapper` 决定要不要用图」**——它不决定，它无条件信任 forward context 给的 mode 与 key [C5]。
- **「捕获是第一次请求时懒加载的」**——是启动期 `compile_or_warm_up_model` 就按尺寸捕获好的 [C6]；这也是启动慢的一个主要来源。
