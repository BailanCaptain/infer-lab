---
id: vllm-ascend-overview
title: "vllm-ascend 如何接入 vLLM"
type: concept
summary: vllm-ascend 是让 vLLM 跑在昇腾 NPU 上的单独插件包：上游决定每一步算什么，计划越过平台边界后，怎么在 NPU 上算由它决定。本页是地图：五个扩展点（平台、patch、模型、算子、配置）各一句，再沿 GLM 双机主线 A0–A4 看每站接管了什么，最后给三版差异与源码入口。
aliases: [vLLM-Ascend, vLLM Ascend, vllm_ascend, 昇腾适配层, 昇腾插件, NPU 插件, 硬件插件, out-of-tree 插件, Ascend 接入,
  职责与状态归属, 分工, 边界, vLLM 与 vllm-ascend, 状态归属, 关键代码在哪, 归属边界]
chapters: ["10"]
order: 20
sources:
  - vllm-ascend@db701c1f:setup.py#L543-L550
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L35
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L75
  - vllm@0fc695fc:vllm/plugins/__init__.py#L14-L19
  - vllm@0fc695fc:vllm/plugins/__init__.py#L28-L82
  - vllm@0fc695fc:vllm/platforms/interface.py#L105-L113
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L96-L146
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L203
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L832
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L869-L871
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L96
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L520
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L677
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L287-L310
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L1-L25
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L79
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L23
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L92
  - vllm@0fc695fc:vllm/v1/engine/core.py#L236-L290
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L241
  - vllm@0fc695fc:vllm/v1/outputs.py#L234-L267
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L850-L870
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1278
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L907
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1705-L1878
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1138-L1232
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548
  - vllm-ascend@2c59ff10:setup.py#L506-L551
  - vllm-ascend@2ed6cbba:setup.py#L543-L551
  - vllm-ascend@baa023ad:setup.py#L506-L517
  - vllm-ascend@2c59ff10:docs/source/index.md#L24-L26
  - https://docs.vllm.ai/projects/ascend/en/latest/index.html
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 先认识引擎、执行器、Worker 与 Runner，再定位 Ascend 的接入位置
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: A0–A4 各站的部署前提（2×A2×8、TP8 / DP2 / EP16、W8A8）在那一页统一推导
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: C
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 装上 vllm-ascend 以后，vLLM 里哪些部分换成了昇腾的？

vllm-ascend 是让 vLLM 跑在昇腾 NPU（华为的 AI 加速芯片）上的一个单独安装的包：上游 vLLM 照旧接请求、排调度，决定「这一步算什么」；计划越过平台边界以后，用哪个 Worker、哪份模型代码、哪些算子和通信库，都换成它的实现。本知识库也叫它「昇腾适配层」。

**平台**（platform）是 vLLM 回答一切硬件问题的对象；**Worker** 是守着一张卡、真正执行模型的进程。

```wiki-diagram
file: ascend-vs-upstream
```

实线每一步都走：Scheduler 定下本步算哪些请求、用哪些 KV cache 块，Executor 把计划发给每张卡的 NPUWorker，NPUModelRunner 把它变成 NPU 上的张量，GLM 模型和昇腾算子算完再交回引擎。虚线在请求到来前就完成，其中 patch 伸过边界，换掉上游的部分函数。

## 为什么做成插件，不直接改一份 vLLM？代价在哪

把 vLLM 复制一份到处改叫 fork，改完就和原版分家，原版的新功能都得手工搬。vllm-ascend 走另一条：vLLM 在关键位置留好接口，硬件厂商另写一个包接进去；官方文档把它定位为社区维护的硬件插件，两个包各自发版。

它**装包时登记**一张 entry point 清单（写进 Python 安装信息的「我能提供什么」），vLLM **启动时来问**：每起一个进程就读清单，找到昇腾平台后，硬件问题都去问它。上游留的接口见 [vLLM 的平台接口](vllm-platform-interface.md)。

代价有三笔：

- **没留接口的地方只能打 patch**，即在进程里把上游的函数或类改指向昇腾的实现。GLM 基线有 59 个 patch 文件，读上游代码看到的不一定是实际运行的那一份。
- **每个进程各做一遍**：登记结果不跨进程继承，前端、引擎和每个 Worker 都要自己读清单、打 patch。
- **和上游版本绑得紧**：上游一改函数名或参数，patch 就得跟着改；GLM 基线里有三个 patch 只在 vLLM 不是 0.23.0 时才导入。

## 两边各管什么：五个扩展点

**上游管「这一步算什么」**：接请求、分词、调度、把计划发给 Worker、收回结果推进请求。**昇腾管「在 NPU 上怎么算」**，从五个位置接进来：

- **平台**：NPUPlatform 启动时校验并改写配置，回答 Worker、注意力后端、通信类各用哪个。见[插件发现与模型注册](platform-plugin-registration.md)与 [NPUPlatform](npu-platform.md)。
- **patch**：上游没留接口处替换函数或类，分平台侧和 Worker 侧两类。见 [Patch 机制](ascend-patch-system.md)。
- **模型**：在模型注册表里把 GLM 的架构名指向昇腾包里的实现。见[模型入口](platform-plugin-registration.md#模型入口从架构名找到昇腾的-glm-实现)。
- **算子**：注意力、MoE、量化矩阵乘和卡间通信在 NPU 上的实现。总入口见[算子与 kernel](ops-and-kernels.md)，注意力挑哪个后端见[注意力后端](attention-backend-family.md)，卡间通信见 [CANN 与 HCCL](cann-hccl.md)，量化见 [W8A8 量化](quantization.md)。
- **配置**：命令行、附带的 JSON、环境变量三路开关汇成每个进程的 Ascend 配置。见 [Ascend 配置](ascend-config-system.md)。

状态也按这条线分：请求进度和 KV cache 块分配归上游，本步的请求映射、注意力元数据和各卡的缓存张量归执行侧。请求没被调度，查队列、token 预算和块分配；读错了历史，查位置、[block table](block-table.md) 和状态索引。

## 一条请求走到这里：A0–A4 每站换了什么

主线部署是官方教程的双机配置：2 台 Atlas 800 A2、每台 8 张卡（2×A2×8），TP8 / DP2 / EP16，W8A8，模型 GLM-5.3-Flash，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。沿[一条请求](one-request.md)逐站看：

- **A0 启动**：20 个进程里 16 个 Worker 各守一张卡；入口清单在 19 个进程里各读一遍并打好 patch；平台选中 NPUWorker，补上 W8A8 用的昇腾量化选项；切完 KV cache 块，NPUWorker 把几档 decode 批量录成图。见[引擎进程](engine-processes.md)。
- **A1 入口**：HTTP、聊天模板、分词、选 DP 组都是上游代码；昇腾只是事先打好 global patch，其中一个让 vLLM 0.23.0 认得 GLM 配置。
- **A2 调度**：Scheduler 是上游的，但块长和分组由启动时被昇腾 patch 换掉的函数算出：逻辑块 640 个位置，四类状态对齐成两档页、编成 5 个缓存组。见 [KV cache 规格](kv-cache-spec.md)。
- **A3 准备输入**：计划在这里越过平台边界。NPUModelRunner 把调度输出变成 NPU 上的张量，为 5 个缓存组各维护一张 block table，full 组的 640 块号再展开成 5 个 128 的 kernel 块号。见 [Block Table](block-table.md)。
- **A4 逐层前向**：45 层都跑在昇腾包里的 GLM 模型代码上，[Attention](attention-qkv.md) 分 34 层 [KDA](linear-attention.md) 和 11 层[稀疏注意力](sparse-attention.md)、各自指定昇腾后端，45 层里有 42 层的前馈是 [MoE](moe.md)，按 [EP16](expert-parallel.md) 摊到 16 张卡。

## 常见误解

- **「它是 vLLM 的 fork」**——不是。仓库里没有 vLLM 的代码副本，两个包各自安装。
- **「插件就不碰上游代码」**——只对一半。没接口的地方在运行时换掉上游函数，GLM 基线有 59 个 patch 文件。
- **「入口清单交的就是平台对象」**——交的只是一行类路径。vLLM 挑定硬件后才导入，免得提前拉起昇腾底层库。
- **「昇腾的行为不在继承类里，就在 patch 里」**——对 GLM 不成立：模型代码整份在昇腾包里，专用算子在昇腾的算子目录里。
- **「调度归上游，和昇腾无关」**——KV cache 的块长和分组由昇腾 patch 决定。
- **「哪个版本都能跑 GLM」**——v0.23 维护分支和 v0.26 都没有 GLM 模型代码，见[版本差异](#版本差异)。

## 对照源码

### 怎么开

装上包就生效，没有开关。GLM 基线声明两组 entry point、共 5 个入口名 [C1]：平台组 `vllm.platform_plugins` 只有 `ascend = vllm_ascend:register`，只返回字符串 `"vllm_ascend.platform.NPUPlatform"`，由 vLLM 自己导入；通用组 `vllm.general_plugins` 有四个，登记 KV 连接器与权重传输引擎、netloader 与 rfork 加载器、服务级 profiling 配置、模型实现 [C3]。平台组在每个进程第一次访问当前平台时加载 [C4][C5]。

四个通用入口里三个先调 `_ensure_global_patch()`，模型入口不调：vLLM 在 EngineCore 子进程里加载通用插件，端到端测试的 conftest 钩子到不了那里，global patch 只能借这些入口打上 [C2]。

NPUPlatform 继承上游 Platform [C6]。v0.23 维护分支上它标成 OOT（out-of-tree），设备名 npu，可见设备环境变量 `ASCEND_RT_VISIBLE_DEVICES`，dispatch key 是 PrivateUse1，简单编译后端写成 eager、注释写明关闭 torch.compile [C7]，图模式另走一套，见[图模式层](graph-mode-layer.md)。GLM 命令里的 `--quantization ascend` 由平台在解析参数前补进去，patch 统一入口也在这里调 [C8]。官方双机不在附带 JSON 里传任何键，见 [Ascend 配置](ascend-config-system.md)。

其余接口：继承 WorkerBase 的 NPUWorker 在 Worker 类为 auto 时选中，310P、xlite 另有分支 [C9]；继承 GPUModelRunner 的 NPUModelRunner 由 NPUWorker 创建，另有 v2 runner 分支 [C13]；AscendAttentionBackend 等由平台按三个标志查表，GLM 两类注意力层自带后端 [C10]；NPUCommunicator 由平台返回 [C11]。模型入口把 GLM 的文本、多模态、MTP 架构名登记到昇腾实现 [C16]。

### 会报什么错

| 现象 | 原因 | 去哪查 |
|---|---|---|
| `Only one platform plugin can be activated` | 装了两个会激活的平台插件 | [插件发现](platform-plugin-registration.md#会报什么错) |
| 加载插件失败的日志，之后没选中 NPU | 导入出错被跳过 | 同上 |
| EngineCore 或 Worker 启动抛错，栈里有 patch | patch 出错打断所在进程 | [Patch 机制](ascend-patch-system.md#会报什么错) |
| 配置组合被拒 | 平台的配置校验 | [NPUPlatform](npu-platform.md#会报什么错) |
| 量化方法 ascend 无效 | 平台没激活，这个选项是它补的 [D] | 查平台注册 |
| GLM 配置类型或架构名找不到 | 分支里没有 GLM 代码 | [版本差异](#版本差异) |

### 开销和什么时候别开

开销在启动：每个进程扫一次安装元数据、导入一次包并加载昇腾底层运行库，GLM 双机共 19 次，DP 协调器不读清单 [D]。每步开销看各站选中的实现。更大的代价在读代码：先确认跑的是哪一份。同一环境要跑别的硬件时别装：它的平台入口不查设备、外部插件又优先，要么卸掉，要么用 `VLLM_PLUGINS` 白名单排除 ascend。

### 版本差异

GLM 基线是 glm-5.3-flash-0902-1 分支上的固定提交，配 vLLM 0.23.0，见[来源基线](../sources/glm-5-3-flash-baseline.md)。目录与文件数逐提交列目录核对 [D]：

| 项 | GLM 基线 db701c1f | v0.23 维护 2c59ff10 | v0.26 2ed6cbba | main baa023ad |
|---|---|---|---|---|
| GLM 模型代码 | models 下 glm5_next 等三个文件 | 无 | 无 | 移到 models/glm5next/，模型、MTP、KDA、稀疏索引器等分文件 |
| GLM 配置 patch 与专用算子 | 有 | 无 | 无 | 有 |
| patch 文件数 | 59 | 59 | 64 | 60 |
| entry point | 2 组 5 个 [C1] | 2 组 5 个 [C31] | 2 组 5 个 [C32] | 3 组 6 个 [C33] |

main 多出的一组是 `ms_service_metric.providers`。v0.23 维护分支与 v0.26 里带 GLM 字样的只有工具调用、推理用量的 patch。GLM 基线根目录另有 vllm_patch 目录和 Transformers 补丁，后者确认在构建时应用，前者未核。其他目录见[目录地图](vllm-ascend-repo-map.md)，官方定位见 [S34][S35]。

### 源码位置

均为 GLM 基线 db701c1f，另注的除外：

- 入口：setup.py 第 543–550 行，`vllm_ascend/__init__.py` 第 18–75 行；上游加载在 `vllm/plugins/__init__.py`。
- platform.py：初始化第 184–203 行，选 Worker、注意力后端、通信类在第 650、805、869 行起；类属性取 v0.23 维护分支第 96–146 行。
- patch 入口 utils.py 第 563 行；GLM 的 KV 分组在 patch_kv_cache_utils.py 第 517–548 行。
- NPUWorker 在 worker.py 第 89 行，NPUModelRunner 在 model_runner_v1.py 第 287 行，GLM 模型在 glm5_next.py。
- v0.23 维护分支的 AscendAttentionBackend 在 attention_v1.py 第 78 行，NPUCommunicator 在 npu_communicator.py 第 23 行。
