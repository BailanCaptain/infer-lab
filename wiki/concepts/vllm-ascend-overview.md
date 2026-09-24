---
id: vllm-ascend-overview
title: vLLM-Ascend 是什么
type: concept
summary: 让 vLLM 能在昇腾 NPU 上跑的那一层：单独装的一个包，不改 vLLM 一行代码，而是在上游留好的几个口子里换上昇腾自己的版本。
aliases: [vllm-ascend, vLLM Ascend, 昇腾插件, out-of-tree 插件, vllm_ascend, 昇腾适配层, 硬件插件]
chapters: ["10"]
order: 40
sources:
  - vllm-ascend@2c59ff10:setup.py#L506-L551
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L19-L35
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L38-L42
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L44-L77
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L96-L146
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L880-L882
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L89-L92
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L269
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L79
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@2c59ff10:docs/source/index.md#L24-L26
  - vllm-ascend@baa023ad:setup.py#L506-L517
  - https://docs.vllm.ai/projects/ascend/en/latest/index.html
  - vllm-ascend@2ed6cbba:setup.py#L543-L551
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L127-L144
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L659-L669
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L815
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L23
  - vllm@0fc695fc:vllm/plugins/__init__.py#L14-L19
  - vllm@0fc695fc:vllm/plugins/__init__.py#L28-L82
  - vllm@0fc695fc:vllm/platforms/interface.py#L105-L113
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L518-L520
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: who-owns-what
    kind: builds-on
    note: 读这一页之前要先知道两边各管什么，否则会把接缝当成主体
  - to: platform-plugin-registration
    kind: builds-on
    note: 「是插件不是 fork」这个定位唯一的依据就是那两组登记，机制写在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求碰到的每一个昇腾对象，都是顺着这几个入口之一进来的
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

vLLM-Ascend 是让 vLLM 能在昇腾（华为的 AI 芯片和配套软件）NPU 上跑的那一层：它是单独安装的一个包，不改 vLLM 的代码，而是在 vLLM 留好的几个口子里，换上昇腾自己的版本。本知识库里也叫它「昇腾适配层」。

## 先问一个问题：给显卡写的框架，怎么跑到 NPU 上

[那条请求](one-request.md)里，Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上。可 vLLM 这个推理框架最早是给英伟达显卡写的：它怎么知道机器上插的是 NPU？注意力该调哪个算子？两颗 NPU 之间传数据用什么库？

有两条路可走。一条是把 vLLM 整个复制一份，在副本里到处改——这叫 fork，改完就和原版分家了，原版每出一个新功能都得手工搬过来。另一条是 vLLM 自己在关键位置留好「插口」，别的硬件厂商另写一个包插进去，原版一行不动。

vLLM-Ascend 走的是第二条。官方文档把它叫作社区维护的硬件插件：昇腾的接入和 vLLM 本身是分开的两个包，各自发版。

## 两边各管什么

分工可以粗粗记成一句话：**算法归上游，硬件归昇腾**。

上游 vLLM 管的是和硬件无关的那些事：怎么接请求、每一[步](vllm-engine-core.md)挑哪些请求一起算、KV Cache（存下来备查的 K 和 V）怎么切成块来管，还有模型本身怎么搭——比如 Qwen3.6-35B-A3B 的 40 [层](layers-and-hidden.md)里哪层是[注意力](attention-qkv.md)、哪层选[专家](moe.md)，这些都是上游写好的。

昇腾适配层管的是「这件事在 NPU 上具体怎么做」：设备叫什么名字、用哪个注意力算子、卡间通信走昇腾自己的通信库、图模式怎么录。更细的分界见 [两边各管什么](who-owns-what.md)。

## 怎么叠上去：装包时登记，启动时 vLLM 来问

叠上去的方式分两个时间点。

**装包时登记。** 装 vLLM-Ascend 时，包里带着一张「登记表」，写明「我能提供一个硬件平台」「我还有几样附加功能」。这张表写进 Python 的安装信息里，谁都能查到。

**启动时 vLLM 来问。** vLLM 一启动就去查这张表，发现有人登记了硬件平台，就把昇腾的平台对象接过来。之后凡是和硬件有关的问题——设备叫什么、该用哪个 Worker、注意力后端选哪个、跨卡通信用哪个——vLLM 都去问这个平台对象，由它回答「用昇腾的那个」。

所以主动的一方是 vLLM：昇腾这边只是登记好、等着被问。登记表的细节和加载顺序见 [平台插件怎么注册](platform-plugin-registration.md)，上游那一侧留的口子见 [vLLM 的平台接口](vllm-platform-interface.md)。

## 上游留了五个口子，昇腾各交一个

上游在五个位置留了口子：平台、Worker（守着一颗 NPU 干活的进程）、执行一步的主循环、注意力算子、跨卡通信。昇腾在每个口子里交上一个自己的版本——写法是「照着上游那个基础版本，改掉跟硬件有关的部分」，编程里叫继承。

```wiki-diagram
file: ascend-vs-upstream
```

这张图每一行左右两边是同一个位置：左边是上游定下的样子，右边是昇腾填进去的那一块。昇腾的平台对象就是回答前面那些问题的地方，具体长什么样见 [NPU 平台类](npu-platform.md)。

## 留不出口子的地方：启动时换零件

不是每个地方上游都留了口子。遇到没留的，昇腾只能在启动时把上游的某个函数或类直接换成自己的——这一招叫 patch（打补丁）。它们全放在一个专门的补丁目录里，数量有五六十个，见 [Patch 机制](ascend-patch-system.md)。

这带来一个读代码时天天要用的判断：**看到一段昇腾的行为，它要么在某个「照着上游改」的版本里，要么在补丁目录里，没有第三处。** 先问它是哪一种，就不必从头翻。

补丁模式也有代价。vLLM 会开好几个进程，而打补丁那一步只在某些进程里自然发生；另外几个进程得靠登记表里的附加功能「顺手」把补丁再打一遍。这件事的来龙去脉见 [三个进程与 patch 注入点](engine-processes.md)。

## 那条请求走到这里

[那条请求](one-request.md)还没发出来的时候，这些入口就已经用完了。

登记只在装包时写一次，查表只在启动时做一次，之后不再执行。但那条请求跑的 200 步里，凡是碰到的昇腾对象——平台、两颗 NPU 上的 Worker、跑每一步的主循环、注意力算子——都是顺着这些入口进来的：要么是交进某个口子里的版本，要么是补丁换掉的零件。

还有一件事值得先记住：上游默认会把模型交给 PyTorch 自带的编译器去加速，昇腾平台这里把它关掉了。昇腾的图模式走的是另一套，见 [图模式层](graph-mode-layer.md)。

## 常见误解

- **「它是 vLLM 的一个 fork」**——不是。仓库里没有 vLLM 的代码副本，装完之后 vLLM 和 vLLM-Ascend 是两个独立的包；两者的接缝只有「登记表 + 五个口子」和补丁目录两处。
- **「插件就意味着不碰上游代码」**——只对一半。有口子的地方确实是交自己的版本；没口子的地方是在运行时把上游的零件换掉，补丁目录里有五六十个这样的文件。
- **「登记表里交的就是平台对象本身」**——交的只是一个「去哪儿找」的地址，真正把它拿进来的是 vLLM。这样 vLLM 可以等确认了硬件再去拿，不会在还没确认硬件的进程里就先把昇腾的底层库拉起来。

## 对照源码

### 怎么开

装上 `vllm_ascend` 包就生效，不用额外开关。`setup.py` 声明两组 entry point，v0.23 维护分支上一共五个 [C1]：

- `vllm.platform_plugins` 只有一个 `ascend = vllm_ascend:register`。`register()` 不返回类，只返回字符串 `"vllm_ascend.platform.NPUPlatform"`，由 vLLM 自己去导入 [C3]。
- `vllm.general_plugins` 里四个：`register_connector`（KV 连接器与权重传输引擎）、`register_model_loader`（netloader 与 rfork 两个模型加载器）、`register_service_profiling`（服务级 profiling 配置）、`register_model`（模型实现）[C4]。

上游这两个组名定义在 `vllm/plugins/__init__.py` [C19]；按组扫描 entry point 的是 `load_plugins_by_group`，general plugin 由 `load_general_plugins` 逐个调用 [C20]。注释写明平台插件组会在每个进程里、第一次访问 `vllm.platforms.current_platform` 时加载。

四个 general plugin 里有三个第一件事是调 `_ensure_global_patch()`（`register_model` 不调）。源码注释给的原因是：vLLM 在 engine-core 子进程里加载 general plugin，E2E 测试的 conftest 钩子到不了那里，所以影响调度器和引擎的全局 patch 也要借这些插件入口打上 [C2]。

`NPUPlatform` 继承上游 `Platform` [C21]，把 `_enum` 标成 `PlatformEnum.OOT`（out-of-tree）、`device_name` 与 `device_type` 定成 `npu`、可见设备的环境变量定成 `ASCEND_RT_VISIBLE_DEVICES`、PyTorch 的 `dispatch_key` 定成 `PrivateUse1`；同一处 `simple_compile_backend` 写成 `"eager"`，行尾注释 `# Disable torch.compile()` [C5]。

五个口子对应的类（v0.23）：

| 上游基类 | 昇腾实现 | 平台怎么把它交出去 |
|---|---|---|
| `Platform` | `NPUPlatform` | entry point 返回类路径 |
| `WorkerBase` | `NPUWorker` [C7] | `worker_cls == "auto"` 时改写为 `vllm_ascend.worker.worker.NPUWorker`（310P、xlite 另有分支）[C16] |
| `GPUModelRunner` | `NPUModelRunner` [C8] | 由 `NPUWorker` 创建（另有 v2 的 `NPUModelRunnerV2` 分支）[C22] |
| `AttentionBackend` | `AscendAttentionBackend` 等 [C9] | `get_attn_backend_cls` [C17] |
| `DeviceCommunicatorBase` | `NPUCommunicator` [C18] | `get_device_communicator_cls` [C6] |

`vllm_ascend/utils.py` 里的 `adapt_patch` 是 patch 的统一入口 [C10]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| entry point 组数 | 2 组 / 5 个 | 2 组 / 5 个 [C14] | 3 组 / 6 个 [C12] | 多出来的那组只有 main 有：`ms_service_metric.providers` → `vllm_ascend.observability:get_metric_provider` |
| `NPUPlatform` 所在行 | `platform.py` 第 128 行 | 第 127 行 | 第 82 行 [D] | 同一个类，三边行号各不相同；引用必须带 commit，不能只写行号 |
| `patch/` 下的 `patch_*.py` | 59 个 | 64 个 [D] | 60 个 [D] | 三边的补丁文件数都不一样，照文件名清点 patch 目录的笔记换分支就对不上 |

这张表只列入口层面的差异。分支之间的目录层面差异在 [vllm_ascend 目录地图](vllm-ascend-repo-map.md)。官方文档对「硬件插件」的定位见 [S11] [S13]。

### 源码位置

- entry point 声明：`setup.py` 第 543–551 行（v0.23）
- 插件入口函数：`vllm_ascend/__init__.py` 第 19–77 行
- 平台类：`vllm_ascend/platform.py` 第 128–146 行；选 Worker 第 659–669 行；选注意力后端第 815 行；选通信器第 880–882 行
- `NPUWorker`：`vllm_ascend/worker/worker.py` 第 89 行；创建执行器第 518–520 行
- patch 统一入口 `adapt_patch`：`vllm_ascend/utils.py` 第 563 行
- `NPUModelRunner`：`vllm_ascend/worker/model_runner_v1.py` 第 268 行
- `AscendAttentionBackend`：`vllm_ascend/attention/attention_v1.py` 第 78 行
- `NPUCommunicator`：`vllm_ascend/distributed/device_communicators/npu_communicator.py` 第 23 行
- 上游插件加载：`vllm/plugins/__init__.py` 第 14–82 行；上游 `Platform`：`vllm/platforms/interface.py` 第 105 行
