---
id: vllm-platform-interface
title: Platform：上游留给硬件的那张问卷
type: concept
summary: 上游把所有「答案取决于硬件」的问题收成一张问卷，起了个名字叫 Platform，将近八十道题，答案被上游代码在近千个地方引用。所谓 vLLM 支持一种新硬件，就是有人把这张问卷答完了；昇腾插件的本体就是一份答卷。
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
  - vllm@0fc695fc:vllm/config/vllm.py#L1330-L1342
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L640-L650
  - vllm@568afb3a:vllm/platforms/interface.py#L134-L169
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L462
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L659-L671
verified: ["releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 这些口子分散在那三个进程的启动路径上，哪一层在哪个进程写在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 装上插件，vLLM 怎么就认识昇腾了

上游 vLLM 是围着 N 卡写起来的，代码里没有一行昇腾。装上昇腾插件之后，上游一行代码都没改，启动时它怎么就知道这台机器该用 NPU？

答案是：上游根本不自己判断。启动时它把内置的几家平台（CUDA、ROCm、CPU、TPU、XPU）和装在环境里的外部插件排成一排，挨个问一句「你能在这台机器上干活吗」，谁答了「能」，谁就当选。规则里还有一条明确的优先级：**外部插件答了能，就用外部插件，内置平台靠边**。所以在一台既插昇腾卡又插 N 卡的机器上，只要昇腾插件装着并且能激活，vLLM 走的就是昇腾这条路——这不是 bug，是写死的顺序。两个外部插件同时说「能」则直接报错：一次只能有一个当家。

当选之后要干的活是什么？上游把所有「答案取决于硬件」的问题收进一个类，名字就叫 Platform。可以把它看成一张问卷：将近八十道题，上游代码在近千个地方引用这些答案。所谓「vLLM 支持一种新硬件」，具体就是有人把这张问卷答完了——昇腾插件的本体，就是一份答卷。

## 问卷上是哪几类题

**一类是填空题**，一行一个答案：你的设备叫什么名字、拿哪个环境变量控制可见设备、分布式通信用哪家。昇腾各写一行就完。

**一类是判断题**：「你是 CUDA 吗」「你是 CPU 吗」「你是外部插件吗」——上游拿这些答案在各处分流。

**真正要写实现的大题**只有几道，但每道都重。启动过程走到不同的地方，上游会停下来问一句，一共五个时刻：

| # | 什么时候被问 | 问什么 |
|---|---|---|
| 1 | 进程刚起步，命令行还没解析 | 要不要先做点准备 |
| 2 | 配置组装完的最后一步 | 这份配置你要改哪些、拦哪些 |
| 3 | 挑注意力实现的时候 | 你家用哪个注意力后端 |
| 4 | 定调度默认值的时候 | 你的显存有多大 |
| 5 | Worker 进程起来之后 | 把你的卡设好 |

```wiki-diagram
file: platform-hooks
```

## 只被问一次、却能改整份配置的那道题

第 2 题最特殊。整个上游只有一处会问它：所有子配置都组装就位之后、配置被各处读走之前。这个位置是有意挑的——**它是最后一个还能整体改写配置的时刻**，紧接着编译区间就按改完的配置重算，再往后配置就定稿了。

昇腾在这道题里干的事也最多：把块大小顶成自己要的值、把干活的 Worker 换成自己的、拦掉不支持的参数组合。代价是这一处的实现长得很难读——那是插件模式的结构性结果，不是谁写得差。这份答卷本身怎么写的，见[昇腾的答卷](npu-platform.md)那页。

## 答案一路影响到那条请求

[那条请求](one-request.md)还没发出来，问卷就已经答完了——五个时刻全在启动阶段。但答案会影响它后面的每一步：

- 块大小是平台侧定的。通用模型就在「最后一改」那道题里被顶成 128；我们这个混合模型跳过通用路径，按昇腾自己的对齐规则算成 2048——所以那 237 个 token 一个块就装下了，来龙去脉在[那条请求](one-request.md)那页。
- 挑中的[注意力](attention-qkv.md)实现，决定这条请求每一步写 KV 时跑的是谁家的算子。
- 连它每一步能拿到多少 token 名额，都间接取决于平台报上来的显存大小：默认名额是拿显存和设备名查表得来的，报得够大就换大一档。

最后这条最容易被忽略：硬件插件不只是「接上算子」，它连调度器的默认行为都在影响。

## 这张问卷还在变长

从 v0.23 配套的上游到 v0.26 配套的上游，问卷多了四道题，引用答案的地方多了两成多（准确数字在下半的版本差异表里）。这说明平台抽象还在往上游各处渗透，不是一个已经收敛的接口。

插件跟着上游升版本时，要重新过一遍：自己答过的题里有没有题面变了的，基类新给的默认答案里有没有该覆盖的。好消息是填空题那几行两个版本逐字没动，昇腾的那几行属性不用碰，要盯的是新加的方法。

## 常见误解

- **「Platform 是个空壳接口，实际逻辑都在硬件插件里」**——它不空。那近八十道题大部分带着能用的默认答案，插件只覆盖要改的那些。
- **「插件只在启动时起作用」**——启动时答题，但答案影响运行时的每一步：上游三百多个文件里都在引用这些答案。
- **「问注意力后端时，插件交回一个现成的实现」**——交回的只是一个名字，上游拿着名字自己去找实现。正因为传的是名字而不是实物，答案才能带到别的进程再兑现。
- **「机器上检测到 CUDA 就一定走 CUDA」**——不一定，外部插件的分支排在内置平台前面。

## 对照源码

这一节给要去核对源码、排查问题的人。上半每个说法的依据都在这里。

### 怎么开

- 没有开关。装上昇腾插件，它注册的 entry point 就会被 `resolve_current_platform_cls_qualname()` 收进候选名单，和内置平台放在一起逐个调一遍，返回非 None 即算激活 [C5]。注册机制那条线在[插件注册](platform-plugin-registration.md)。
- 分支顺序写死：先看有没有 OOT（out-of-tree，树外）插件激活，有就直接用；内置平台只在没有 OOT 插件时才轮得上 [C6]。

### 会报什么错

- 两个 OOT 插件同时激活：`RuntimeError: Only one platform plugin can be activated, but got: [...]` [C6]。
- 两个内置平台同时激活报同一个错，走的是同一段的下一个分支 [C6]。
- 一个平台都没激活不报错，落到 `UnspecifiedPlatform` 继续跑 [C6]。

### 版本差异

| 项 | vLLM v0.23.0 | vLLM v0.26.0 | 意味着什么 |
|---|---|---|---|
| `Platform` 类体里直接定义的 `def` | 78 个 | 82 个 [D] | 半年多出四道题。插件跟着上游升版本时，要重新过一遍自己覆盖了哪些、基类默认实现又换了哪些 |
| `vllm/` 包里带 `current_platform.` 的行 | 873 行、311 个文件 | 1069 行、362 个文件 [D] | 涨了两成多。平台抽象还在往上游各处渗透 |

变长的全是方法：类体顶部那几道填空题（`dispatch_key`、`device_control_env_var`、`simple_compile_backend`、`dist_backend`）两个版本逐字一样 [C10]。

### 源码位置

- `Platform` 类体开头、填空题类属性：上游 `vllm/platforms/interface.py#L105-L140` [C1]；v0.26 配套上游的同一段在 `#L134-L169` [C10]。
- 时刻 1 `pre_register_and_update`（命令行解析前的准备钩子）：`interface.py#L428-L441` [C2]。
- 时刻 2 `check_and_update_config` 的题面：`interface.py#L458-L462` [C3]。它的唯一调用点在 `VllmConfig.__post_init__` 末尾（L1335），紧接着 L1342 的 `_set_compile_ranges()` 按改完的配置重算编译区间：`vllm/config/vllm.py#L1330-L1342` [C7]。
- 时刻 3 `get_attn_backend_cls`：`interface.py#L259-L266` [C4]。签名写明返回 `str`——是类路径字符串，不是类。
- 时刻 4 token 预算查表：`vllm/engine/arg_utils.py#L2300-L2335` [C8]。拿 `get_device_total_memory()` 和设备名当键，显存 ≥ 70 GiB 且设备名不含 a100 时换大一档默认值。
- 时刻 5 之后 Worker 进程里还在问：Worker 起来后又调平台钩子按注意力后端核块大小：`vllm/v1/executor/multiproc_executor.py#L640-L650` [C9]。
- 平台探测与激活的循环：`vllm/platforms/__init__.py#L203-L232` [C5]；OOT 优先、双激活抛错、无激活兜底，都在紧随其后的分支里：`#L233-L252` [C6]。
- 昇腾的答卷入口 `NPUPlatform.check_and_update_config`：`vllm_ascend/platform.py#L450` 起，一路写到 L797（下一个方法定义在 L798）[C11]。
- 「换 Worker 类、顶块大小」就在其中：`#L659-L671`——`worker_cls` 为 auto 时换成昇腾的 Worker，随后调 `refresh_block_size`；混合模型在这一步直接返回、块大小按页对齐另算，那条线在[那条请求](one-request.md)的对照源码 [C12]。
