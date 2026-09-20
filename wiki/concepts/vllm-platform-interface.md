---
id: vllm-platform-interface
title: Platform：上游留给硬件的那张问卷
type: concept
summary: 上游把「凡是跟硬件有关的事」收成一个 Platform 类，78 个口子，`vllm/` 包里 873 处在问它。昇腾插件要做的就是把这张问卷答上。
aliases: [Platform, current_platform, 平台抽象, platform_plugins, 硬件插件接口, OOT]
chapters: ["10"]
order: 70
sources:
  - vllm@0fc695fc:vllm/platforms/interface.py#L105-L140
  - vllm@0fc695fc:vllm/platforms/interface.py#L428-L441
  - vllm@0fc695fc:vllm/platforms/interface.py#L458-L462
  - vllm@0fc695fc:vllm/platforms/interface.py#L259-L266
  - vllm@0fc695fc:vllm/platforms/__init__.py#L203-L232
  - vllm@0fc695fc:vllm/platforms/__init__.py#L233-L252
  - vllm@0fc695fc:vllm/config/vllm.py#L1330-L1338
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L640-L650
evidence: "C"
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 这些口子分散在那三个进程的启动路径上，哪一层在哪个进程写在那一页
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

上游把所有「答案取决于硬件」的问题收进一个类：`Platform`。它有 **78 个 `def`**，上游 `vllm/` 包里 `current_platform.` 出现 **873 处** [D]。所谓「vLLM 支持一种新硬件」，具体就是有人把这张问卷答完了。

```wiki-diagram
file: platform-hooks
```

## 问卷上是哪几类题

看 `Platform` 的类体开头就够了 [C1]：

**一类是填空题**，直接写成类属性：设备叫什么名字、`dispatch_key` 填哪个 PyTorch key、控制可见设备的环境变量叫什么、`simple_compile_backend` 用哪个、分布式通信后端是什么 [C1]。这些昇腾只需要各写一行。

**一类是判断题**：`is_cuda()`、`is_cpu()`、`is_out_of_tree()`……上游拿它们在各处分流 [D]。

**一类是真正要写实现的**，只有几个，但每个都很重：

| 什么时候被问到 | 问什么 |
|---|---|
| `pre_register_and_update` | 命令行还没解析完，进程早期要不要先做点什么 [C2] |
| `check_and_update_config` | 配置组装完了，你要改哪些、拦哪些 [C3] |
| `get_attn_backend_cls` | 注意力用哪个后端（返回的是类路径字符串，不是类）[C4] |

## 那条请求走到这里

[那条请求](one-request.md)还没发出来，这张问卷就已经答完了——**它全部发生在启动阶段**。但答案会一路影响到这条请求的每一步：

- `block_size` 在 `check_and_update_config` 里被填成 128，于是它的 37 个 token 占 1 块而不是别的数 [D]；
- `get_attn_backend_cls` 返回的那个类，决定了它第 92 步写 KV 时调的是哪个算子；
- 连它这一步能拿多少 token 名额，都间接取决于 `get_device_total_memory()` 的返回值 [C8]。

**最后这条最容易被忽略**：`max_num_batched_tokens` 的默认值是查一张表得来的，而查表的键是平台报上来的显存和设备名 [C8]。硬件插件因此不只是「接上算子」，它还在影响调度器的默认行为。

## 只被调用一次，却能改整份配置

`check_and_update_config` 在上游全仓**只有一处调用**：`VllmConfig` 在 `__post_init__` 的末尾调它，此时所有子配置都已就位 [C7]。

这个位置的选择是有意的——**它是最后一个能整体改写配置的时刻**。之后 `_set_compile_ranges()` 会按改完的配置重算编译区间，再往后配置就要被各处读走了 [D]。

昇腾在这个方法里干的事很多：顶 `block_size`、换 worker 类、拦掉不支持的组合。代价是这一处的实现会长得很难读——那是插件模式的结构性结果，不是谁写得差。具体内容见 [NPUPlatform](npu-platform.md)。

## 插件是怎么被选中的

启动时 `resolve_current_platform_cls_qualname()` 把内置平台（CUDA / ROCm / CPU / TPU / XPU）和 entry point 注册进来的插件放在一起，逐个调一遍，谁返回了非 None 就算「激活」[C5]。

然后是这一段的关键：**先看有没有 out-of-tree 插件被激活，有就直接用它；内置平台只在没有 OOT 插件时才轮得上** [C6]。两个 OOT 插件同时激活会直接抛错——一次只能有一个。

所以在一台既插了昇腾卡又插了 N 卡的机器上，只要 `vllm_ascend` 装着并且能激活，vLLM 就会走昇腾这条路。**这不是 bug，是明写在分支顺序里的优先级。**

## 常见误解

- **「Platform 是个空接口，实际逻辑都在硬件插件里」**——它不空。78 个 `def` 里大部分有可用的默认实现，插件只覆盖要改的那些 [C1]。
- **「插件只在启动时起作用」**——启动时答题，但答案影响运行时的每一步；`current_platform.` 的 873 处调用散布在 `vllm/` 包的 311 个文件里 [D]。
- **「`get_attn_backend_cls` 返回一个类」**——返回的是类路径字符串，由上游自己 import [C4]。这一层间接是插件能跨进程工作的前提 [A]。
- **「检测到 CUDA 就一定走 CUDA」**——不一定。OOT 插件的分支排在内置平台前面 [C6]。
