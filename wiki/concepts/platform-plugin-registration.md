---
id: platform-plugin-registration
title: 插件注册机制
type: feature
summary: 装上昇腾的包，vLLM 自己就会用昇腾：包里带着一张「我能接哪几个口」的清单，vLLM 每起一个进程都去读一遍——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型。
aliases: [entry point, entry_points, vllm.platform_plugins, vllm.general_plugins, 插件注册, VLLM_PLUGINS, 平台插件, 通用插件, platform plugin, general plugin]
chapters: ["10"]
order: 50
sources:
  - vllm-ascend@2c59ff10:setup.py#L543-L551
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L19-L35
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L38-L42
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L44-L77
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@baa023ad:setup.py#L506-L517
  - https://docs.vllm.ai/projects/ascend/en/latest/index.html
  - vllm-ascend@2ed6cbba:setup.py#L543-L551
  - vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L72-L85
  - vllm@0fc695fc:vllm/plugins/__init__.py#L12-L22
  - vllm@0fc695fc:vllm/plugins/__init__.py#L28-L66
  - vllm@0fc695fc:vllm/plugins/__init__.py#L69-L82
  - vllm@0fc695fc:vllm/platforms/__init__.py#L212-L252
  - vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L744-L747
  - vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L245-L247
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L39-L39
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L34-L34
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L278-L279
  - vllm-ascend@baa023ad:vllm_ascend/__init__.py#L106-L109
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: engine-processes
    kind: builds-on
    note: 四个通用入口为什么每个进程都要读一遍、为什么其中三个要先补一次补丁，理由在进程那一页
  - to: one-request
    kind: builds-on
    note: 这五个口在那条请求发出之前就已经用完了，是它能被昇腾接住的前提
contradicts: []
updated: "2026-09-25"
origin: seed
---

昇腾接进 vLLM，靠的是装包时写进包里的一张清单：两组、共五个「口」。vLLM 每起一个进程，就按组名去翻这张清单，把登记在上面的函数挨个调一遍。昇腾不用改 vLLM 一行代码，vLLM 也不用在哪里写死「昇腾」两个字。

```wiki-diagram
file: plugin-registration
```

## 先提个问题

我们这一章的例子：一台机器、两颗 NPU，跑 Qwen3.6-35B-A3B，两颗 NPU 各扛一半（TP=2）。你做的事只有两件：先装好 vLLM 和 vLLM-Ascend 两个包，再敲一条启动命令，指定模型、指定用两颗 NPU。

命令里从头到尾没有「昇腾」「NPU 平台」这样的字眼。vLLM 本身也是给多种硬件写的通用框架，它的代码里并没有「如果是昇腾就这样」的分支。那它是怎么知道这台机器要用昇腾、并把昇腾那套调度补丁、模型实现、KV 传输方式都挂上去的？

答案不在启动命令里，而在**装包那一刻**。

## 包里夹着一张清单

Python 的包在安装时，除了把代码拷到磁盘上，还会顺带写下一份说明书，里面可以有一种叫**入口点（entry point）**的清单。格式很简单：

> 组名 → 若干条「名字 = 某个函数」

组名是约定好的暗号。vLLM 事先公布了几个组名，意思是「凡是在这个组名下登记过的函数，我启动时都会去调」。任何一个包只要在这些组名下登记，就算把自己挂进了 vLLM——vLLM 不需要认识这个包，只需要按组名去问「谁登记了」。

这张清单是**装包时**写下的，跟有没有运行代码无关：

- 装上 vLLM-Ascend，清单就在；下一次启动 vLLM，它就会被扫到。
- 卸载 vLLM-Ascend，清单随包一起消失；vLLM 从此看不见昇腾，不需要改任何配置。

## 两组口：一个认平台，四个做登记

vLLM-Ascend 在两个组名下一共登记了五个函数。

**第一组「平台」，只有一个口**。它回答的问题是：这台机器该用哪套硬件的做法？昇腾交出去的答案是它的 [NPU 平台](npu-platform.md)——那是一整套「在昇腾上怎么分配显存、怎么选注意力算法、支持哪些量化格式」的规定。

**第二组「通用」，有四个口**，各登记一类互不相干的东西：

| 这个口 | 登记了什么 |
|---|---|
| 连接器 | 把 KV Cache 或权重在机器之间搬运的几种办法 |
| 模型加载器 | 两种昇腾自带的权重加载方式，可以替换默认的从磁盘读权重 |
| 性能采集 | 服务级性能采集的配置 |
| 模型 | 昇腾自己的模型实现——也就是把[每一层](layers-and-hidden.md)怎么算写成昇腾代码的那部分 |

平台口只能有一家胜出；通用口则是「谁登记了都调」，互不排斥。

## 平台口只交一个名字

平台这个口有个很容易被忽略的设计：它交给 vLLM 的**不是平台本身，而是平台的名字**——一行写着「去哪个模块找哪个类」的文字。

为什么绕这一下？因为真把昇腾平台的代码加载进来，会连带把昇腾的底层运行库（PyTorch 的昇腾扩展）一起拉进这个进程。而 vLLM 在问平台口的时候，还没决定要用哪块硬件：它会把自带的几种平台判断和所有外来插件都问一遍，比完了才挑一个。如果每个口都直接交出平台本身，那光是「问一圈」这个动作，就会把各家的底层库全部加载一遍。

交名字就没有这个问题：vLLM 先收一圈名字，挑定了昇腾，再按名字去加载。这件事和 [NPU 平台](npu-platform.md)那一页讲的约束是同一根线——昇腾的底层运行库只允许初始化一次，所以什么时候碰它要格外小心。

还有一个直接后果：昇腾这个口**无条件**交出名字，不先检查机器上有没有 NPU。而 vLLM 的规矩是外来插件优先于自带的硬件判断。所以只要装了 vLLM-Ascend，vLLM 就会认定这是一台昇腾机器。

## 四个进程，各读一遍

在两颗 NPU 上跑起来，机器上有四个[进程](engine-processes.md)：接请求的 Main、每一步排队的 EngineCore、每颗 NPU 一个的 Worker（这里是两个）。

进程之间不共享内存，每个进程都是一份从头启动的新程序。所以在别的进程里做过的登记，这个进程一概不知道——**四个进程各自都要把清单读一遍**：

- 平台口：每个进程第一次要用「当前是什么平台」时去问，问一次就记住。
- 通用口：Main 在解析启动参数时读、EngineCore 起来时读、每个 Worker 起来时读。同一个进程里有个「读过了」的记号，只读一次；换一个进程就重新读。

这也解释了通用口里的一个细节：四个函数里有三个（连接器、模型加载器、性能采集），**第一件事是把昇腾的全局补丁再打一遍**，只有「模型」那个不打。原因是 EngineCore 这类子进程走不到 Main 里打补丁的那条路，而它恰恰是调度器所在的地方；昇腾要改调度器和引擎的行为，就只能借这几个口在子进程里再打一次。补丁带着「打过了」的记号，三个口各调一次也只真打一遍。「模型」那个口只往模型登记表里加条目，不依赖被改过的调度器和引擎，所以不打。补丁为什么要分几条路送，详见[引擎有哪几个进程](engine-processes.md)。

## 那条请求走到这里

还早得很——这一步发生在**进程刚起来、启动参数还没解析完**的时候。

等那条[请求](one-request.md)真正进来时，这五个口早就用完了：平台早已定成昇腾，模型实现早已换成昇腾的版本，补丁也早在每个进程里打好。请求一路上碰到的每个「昇腾特有」的行为，源头都能追到这五个口之一。

## 常见误解

- **「要在代码里显式注册昇腾」**——不需要。清单是装包时写下的，装上就生效，卸掉就消失。
- **「五个口有固定先后」**——平台那一个和通用那四个之间没有约定顺序。所以那三个口各自带着「打过了」的记号去打补丁，而不是假设平台已经把一切准备好。假设「平台已经初始化好了」来写通用插件，在 EngineCore 进程里很可能出错。
- **「模型那个口也该补补丁，是漏了」**——它确实不补，而且合理，理由见上。
- **「机器上没有 NPU，vLLM 会自动退回别的硬件」**——装了 vLLM-Ascend 就不会。昇腾的平台口不做检查，而外来插件优先，想用别的硬件得先卸掉它，或者用环境变量把它排除在外。

## 对照源码

### 怎么开

装包即开，不需要任何参数。`setup.py` 的 `entry_points` 在 v0.23 与 v0.26 两个发布分支上都声明了两组、共五个入口 [C1][C8]：

- `vllm.platform_plugins`：`ascend = vllm_ascend:register`
- `vllm.general_plugins`：`ascend_kv_connector = vllm_ascend:register_connector`、`ascend_model_loader = vllm_ascend:register_model_loader`、`ascend_service_profiling = vllm_ascend:register_service_profiling`、`ascend_model = vllm_ascend:register_model`

vLLM 这一侧：

- 组名常量与各组在哪些进程加载：`DEFAULT_PLUGINS_GROUP = "vllm.general_plugins"`，注释写明「loaded in all processes (process0, engine core process and worker processes)」；`PLATFORM_PLUGINS_GROUP = "vllm.platform_plugins"`，在首次访问 `current_platform` 且尚未初始化时加载 [C10]。
- `load_plugins_by_group(group)` 用 `importlib.metadata.entry_points(group=group)` 取出清单，逐个 `plugin.load()`，得到 `{名字: 函数}` [C11]。
- `load_general_plugins()` 用模块级 `plugins_loaded` 做进程内去重，然后对每个函数直接 `func()` [C12]。调用点：Main 里 `EngineArgs.__post_init__` [C15]、`EngineCore.__init__` [C16]、`WorkerWrapperBase.init_worker` [C17]。
- 平台：`resolve_current_platform_cls_qualname()` 先把内置的 tpu/cuda/rocm/xpu/cpu 与外来插件的函数都调一遍，返回值不是 `None` 就记为激活；**外来插件（OOT）只要有一个激活就优先于内置**，再调一次拿到类路径字符串 [C13]。模块级 `__getattr__("current_platform")` 懒加载：第一次访问才解析，然后 `resolve_obj_by_qualname(...)()` 实例化 [C14]。

昇腾这一侧：

- `register()` 函数体只有一行 `return "vllm_ascend.platform.NPUPlatform"` [C3]，无条件返回，所以装了就激活 [D]（由 与 的「非 None 即激活、OOT 优先」推出）。
- 交字符串而不是类的理由 [D]：`vllm_ascend/platform.py` 第 39 行 `from vllm_ascend.utils import (...)` [C18]，而 `vllm_ascend/utils.py` 第 34 行是模块级 `import torch_npu` [C19]，导入 `NPUPlatform` 就会把 `torch_npu` 拉进进程。同文件的注释写明 `torch_npu` 只允许全局初始化一次、重复初始化会报错 [C20]。平台类本身见 [C5]。
- 四个 general plugin 做的事 [C4]：`register_connector` 调 `kv_transfer.register_connector()` 与 `weight_transfer.register_engine()`；`register_model_loader` 调 `register_netloader()` 与 `register_rforkloader()`；`register_service_profiling` 调 `generate_service_profiling_config()`；`register_model` 调 `.models.register_model()`。
- 前三个的第一句是 `_ensure_global_patch()`，`register_model` 没有。`_ensure_global_patch()` 用 `_GLOBAL_PATCH_APPLIED` 做幂等，内部 `adapt_patch(is_global_patch=True)`；docstring 写明理由：vLLM 在 engine-core 子进程里加载 general plugin，E2E 测试的 conftest hook 在那个进程里不跑，所以影响调度器与引擎代码的全局 patch 必须也从这些 plugin 入口再打一次 [C2]。`register_model` 不补是因为它只做模型侧注册 [D]。

想只加载部分插件：vLLM 的 `VLLM_PLUGINS` 环境变量是按入口名（如 `ascend`、`ascend_model`）过滤的白名单，不设则全部加载。

### 会报什么错

- **`RuntimeError: Only one platform plugin can be activated, but got: [...]`**：同时装了两个会激活的外来平台插件时抛。昇腾的 `register()` 无条件激活，和别家平台插件装在同一环境里就会撞上 [D]。
- **`Failed to load plugin <name>`**：`plugin.load()`（即导入 `vllm_ascend`）抛异常时只记一条 exception 日志、跳过这个插件，不中断启动。平台函数调用时的异常也被 `except Exception: pass` 吞掉。症状是「装了昇腾却没被选中」，要回头翻日志找这一行 [D]。
- **general plugin 函数本身抛异常**：`load_general_plugins()` 对 `func()` 不包 `try`，异常会直接打断所在进程的启动。若报错出在 EngineCore 或 Worker 进程里，先看是不是这三个入口里的 `_ensure_global_patch()` [D]。
- 设了 `VLLM_PLUGINS` 却没包含 `ascend`：平台口不会被加载，vLLM 回落到内置平台判断或 `UnspecifiedPlatform`。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `vllm.platform_plugins` | `ascend`（1 个） | 同 v0.23 | 同 | 平台入口三边一样，认这一个名字就够 |
| `vllm.general_plugins` | 4 个 | 4 个，名字和顺序都没变 | 同 | 这四个入口名可以当成稳定契约来用 |
| 第三组 | 没有 | 没有 | `ms_service_metric.providers` → `vllm_ascend.observability:get_metric_provider` | 只有 main 会被指标框架扫到；照 main 写的接入文档搬到两个发布分支上会找不到这个 provider |
| `register_model` 的函数体 | 只调 `.models.register_model()` | 还要先注册 kimi-k3 的 config，再装一个 HunyuanVL processor 兼容补丁 | 同 v0.23 | v0.26 上这个入口已经不只是「往注册表加条目」，它会连带 import `transformers` 的 processor 类 |

上游 vLLM 一侧：v0.26.0 配套上游的组名常量在 `vllm/plugins/__init__.py:18/:23`，`load_general_plugins` 在 `:77`，「Only one platform plugin」报错在 `vllm/platforms/__init__.py:232/:240`，机制与 v0.23 配套上游一致。main 配套的上游没有检出，main 侧上游行为未核。

### 源码位置

- 入口声明：v0.23 `setup.py:543-551`；v0.26rc `setup.py:543-551`；main `setup.py:506-517`
- 五个入口函数：`vllm_ascend/__init__.py:38-42`（`register`）、`:44-77`（四个 general）；v0.26rc 的 `register_model` 在 `:72-85`；main 的 `register_model` 在 `:106-109`
- 全局补丁幂等：`vllm_ascend/__init__.py:19-35`；main 在 `:52-69`
- 平台类：`vllm_ascend/platform.py:128-146`；`torch_npu` 被连带导入：`platform.py:39` → `utils.py:34`；只许初始化一次的注释：`platform.py:278-279`
- 上游插件加载：`vllm/plugins/__init__.py:12-22`（组名）、`:28-66`（按组取清单）、`:69-82`（general 执行）
- 上游平台选择：`vllm/platforms/__init__.py:212-252`、`:262-281`（懒加载 `current_platform`）
- 上游三处调用 `load_general_plugins()`：`vllm/engine/arg_utils.py:744-747`、`vllm/v1/engine/core.py:106-109`、`vllm/v1/worker/worker_base.py:245-247`
- 官方文档首页 [S7]
