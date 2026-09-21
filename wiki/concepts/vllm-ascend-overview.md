---
id: vllm-ascend-overview
title: vLLM-Ascend 是什么
type: concept
summary: 一个装在 vLLM 旁边的硬件插件：自己是独立的 Python 包，靠 entry point 把昇腾实现挂进 vLLM 的各层，不改上游一行代码。
aliases: [vllm-ascend, vLLM Ascend, 昇腾插件, out-of-tree 插件]
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
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: who-owns-what
    kind: builds-on
    note: 读这一页之前要先知道两边各管什么，否则会把接缝当成主体
  - to: platform-plugin-registration
    kind: builds-on
    note: 「是插件不是 fork」这个定位唯一的依据就是那两组 entry point，机制写在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求碰到的每一个昇腾对象，都是顺着这五个入口之一进来的
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

vLLM-Ascend 是一个独立安装的 Python 包 `vllm_ascend`，它不 fork vLLM，而是通过 Python 的 entry point 在 vLLM 启动时把自己挂上去，然后由 vLLM 主动来问它「这块硬件叫什么」「注意力算子用哪个」「通信器是哪个类」。官方文档把它称为社区维护的硬件插件，遵循 vLLM 的 hardware-pluggable 原则，让昇腾 NPU 的接入与 vLLM 解耦 [S11]。

## 挂上去的一共是几个口

装包时 `setup.py` 声明两组 entry point，v0.23 维护分支上一共五个 [C1]。`vllm.platform_plugins` 只有一个 `ascend`，指向 `register()`；这个函数不返回类，只返回字符串 `"vllm_ascend.platform.NPUPlatform"`，由 vLLM 自己去导入 [C3]。剩下四个在 `vllm.general_plugins` 里，分别注册 KV 连接器与权重传输引擎、两个模型加载器、服务级 profiling 配置、以及模型实现 [C4]。

四个 general plugin 里有三个的第一件事是调 `_ensure_global_patch()`——因为 vLLM 是在 engine-core 子进程里加载 general plugin 的，而那个进程走不到平台层打 patch 的那条路 [C2]。这条绕法本身就说明了插件模式的代价：见 [三个进程与 patch 注入点](engine-processes.md)。

## 它替换了什么，没替换什么

插件能改的东西，等于上游留了口子的那些层。一眼看全的话是这张对照：

```wiki-diagram
file: ascend-vs-upstream
```

## 那条请求走到这里

[那条请求](one-request.md)还没发出来的时候，这五个口就已经用完了。

它们只在**装包时写进元数据、启动时被扫一遍**，之后再也不执行。但那条请求跑的 200 步里，凡是碰到的昇腾对象——平台类、worker、runner、注意力后端——都是顺着这五个口进来的。**没有第六条路**：要么是某个上游基类的子类，要么是 patch 目录里换掉的对象。

这条判断在读这个仓库时天天要用。看到一段昇腾行为，先问它是子类还是 patch，不必从头翻。

`NPUPlatform` 继承上游的 `Platform`，把 `_enum` 标成 `PlatformEnum.OOT`（out-of-tree）、设备名与类型定成 `npu`、可见设备的环境变量定成 `ASCEND_RT_VISIBLE_DEVICES`、PyTorch 的 dispatch key 定成 `PrivateUse1` [C5]。

值得先记住的一条：同一份 `NPUPlatform` 里 `simple_compile_backend` 被写成 `"eager"`，源码里紧跟着的注释就是 `# Disable torch.compile()` [C5]。也就是说昇腾侧的图模式不是走上游那条 `torch.compile` 默认路径，而是另一套；那条另一套在 [图模式层](graph-mode-layer.md)。

上游留不出口子的地方，插件就只能改上游对象本身——那就是 `vllm_ascend/patch/` 存在的全部理由，见 [Patch 机制](ascend-patch-system.md)。所以读这个仓库时有个基本判断：**一段昇腾行为，要么在某个上游基类的子类里，要么在 patch 目录里，不会凭空出现。**

## 三个分支的入口数不一样

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| entry point 组数 | 2 组 / 5 个 [C1] | 2 组 / 5 个 [C14] | 3 组 / 6 个 [C12] | 多出来的那组只有 main 有：`ms_service_metric.providers` → `vllm_ascend.observability:get_metric_provider` |
| `NPUPlatform` 所在行 | `platform.py` 第 128 行 [C5] | 第 127 行 [C15] | 第 82 行 [D] | 同一个类，三边行号各不相同；引用必须带 commit，不能只写行号 |
| `patch/` 下的 `patch_*.py` | 59 个 | 64 个 [D] | 60 个 [D] | 三边的补丁文件数都不一样，照文件名清点 patch 目录的笔记换分支就对不上 |

这张表只列入口层面的差异。分支之间的目录层面差异在 [vllm_ascend 目录地图](vllm-ascend-repo-map.md)。

## 常见误解

- **「它是 vLLM 的一个 fork」**——不是。仓库里没有 `vllm/` 目录，装完之后 `vllm` 和 `vllm_ascend` 是两个独立包；耦合点只有 entry point 和 patch 两处。
- **「插件模式意味着不碰上游代码」**——只对了一半。上游留了口子的地方（Platform、Worker、Runner、AttentionBackend、Communicator）确实是继承；留不出口子的地方是运行时替换上游的类与函数，即 patch。光 `patch/` 一个目录下就有五六十个补丁文件，各分支的数目见上表。
- **「`register()` 返回的是 `NPUPlatform` 类」**——它返回的是那个类的**路径字符串**，导入动作在 vLLM 一侧。这不是风格问题：字符串让 vLLM 能在真正需要时才导入，避免在还没确认硬件的进程里就把 `torch_npu` 拉进来。
