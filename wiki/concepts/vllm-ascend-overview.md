---
id: vllm-ascend-overview
title: vllm-ascend 如何接入 vLLM
type: concept
summary: >-
  vllm-ascend 是让 vLLM 跑在昇腾 NPU 上的单独插件包：沿用 vLLM 的请求与引擎框架，提供 NPU 执行实现，也会调整部分调度行为。本页是地图：五个扩展点（平台、patch、模型、算子、配置）各一句，再沿 GLM 双机主线 A0–A4
  看每站接管了什么，最后给各版本差异与源码入口。
aliases:
  - vLLM-Ascend
  - vLLM Ascend
  - vllm_ascend
  - 昇腾适配层
  - 昇腾插件
  - NPU 插件
  - 硬件插件
  - out-of-tree 插件
  - Ascend 接入
  - 职责与状态归属
  - 分工
  - 边界
  - vLLM 与 vllm-ascend
  - 状态归属
  - 关键代码在哪
  - 归属边界
chapters:
  - '10'
order: 20
sources:
  - 'vllm-ascend@db701c1f:setup.py#L543-L550'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L35'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L75'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L14-L19'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L28-L82'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L105-L113'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L96-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L203'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L832'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L869-L871'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L96'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L520'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L677'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L287-L310'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L1-L25'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L79'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L23
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L92'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L236-L290'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472'
  - 'vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L241'
  - 'vllm@0fc695fc:vllm/v1/outputs.py#L234-L267'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L850-L870'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1278'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L907'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1138-L1232'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548
  - 'vllm-ascend@2c59ff10:setup.py#L506-L551'
  - 'vllm-ascend@2ed6cbba:setup.py#L543-L551'
  - 'vllm-ascend@baa023ad:setup.py#L506-L517'
  - 'vllm-ascend@2c59ff10:docs/source/index.md#L24-L26'
  - 'https://docs.vllm.ai/projects/ascend/en/latest/index.html'
  - >-
    raw:sha256-7309d8d8afbceef48c4722eaa0dfaa463eb2e91502daea9f8c398efbebe0ed7e.md#L1-L1169
  - 'vllm-ascend@7d825229:setup.py#L506-L517'
  - 'vllm-ascend@7d825229:vllm_ascend/models/__init__.py#L62-L88'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1906-L1928'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L212-L281'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L149-L167'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/main.py#L34-L39'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57'
  - 'vllm-ascend@db701c1f:Dockerfile.a2#L88-L99'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/__init__.py#L77-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L78-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L14-L101'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L329-L387'
  - 'vllm-ascend@c09d3e20:setup.py#L506-L517'
  - 'vllm-ascend@c09d3e20:vllm_ascend/__init__.py#L52-L110'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L278-L355'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42'
  - 'vllm-ascend@8d6180e2:setup.py#L506-L517'
  - 'vllm-ascend@8d6180e2:vllm_ascend/__init__.py#L52-L118'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L372-L465'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L65'
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 先认识引擎、执行器、Worker 与 Runner，再定位 Ascend 的接入位置
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: A0–A4 各站的部署前提（2×A2×8、TP8 / DP2 / EP16、W8A8）在那一页统一推导
  - to: attention-backend-family
    kind: builds-on
    note: 总览中 GLM 两类注意力层各自指定昇腾后端的执行分工，建立在后端按层绑定、不同机制使用不同后端的组织方式上。
  - to: hardware-devices
    kind: builds-on
    note: 插件总览对 NPU 平台与本部署每卡 Worker 的分工说明，以硬件页区分处理器、软件可见设备和设备执行进程为基础。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-07ac167778fb354bab1262ce0c43ab7108f83f2ebe56ed167d006f77e072ff62.md
  - >-
    raw/sha256-7309d8d8afbceef48c4722eaa0dfaa463eb2e91502daea9f8c398efbebe0ed7e.md
---

## 装上 vllm-ascend 以后，vLLM 里哪些部分换成了昇腾的？

vllm-ascend 是让 vLLM 跑在昇腾 NPU（华为的 AI 加速芯片）上的一个单独安装的包：请求接入和引擎循环沿用 vLLM 的框架，Worker、模型、算子和通信则通过平台与扩展机制选择适用的实现。它还会调整部分调度配置与资源管理行为，因此两边的分工需要沿实际调用链看。本知识库也叫它「昇腾适配层」。

**平台**（platform）是 vLLM 回答一切硬件问题的对象；**Worker** 是守着一张卡、真正执行模型的进程。请求到来前，插件先通过平台钩子、补丁与算子注册把昇腾实现接进主干。请求到来后，每一步顺次走过 Scheduler（定本步请求与 KV 块）、Executor（把计划发给每卡 `NPUWorker`）、`NPUModelRunner`（把计划变成 NPU 张量），最终由模型和昇腾算子算完交回引擎（完整边界见下节架构图）。

## 为什么做成插件，不直接改一份 vLLM？代价在哪

fork 是从上游代码派生一份独立维护的版本，后续需要处理与上游的同步。vllm-ascend 采用插件方式：vLLM 在关键位置留好接口，硬件厂商另写一个包接进去；官方文档把它定位为社区维护的硬件插件，两个包各自发版。

它**装包时登记**一张 entry point 清单（写进 Python 安装信息的「我能提供什么」），vLLM 在相应初始化入口**读取并调用**：找到昇腾平台后，通过平台接口询问硬件相关的实现。加载结果与防重标志保存在进程内；新解释器启动的子进程要走自己的加载入口。上游留的接口见 [vLLM 的平台接口](vllm-platform-interface.md)。

代价有三笔：

- **没留接口的地方只能打 patch**，即在进程内把上游的函数或类改指向昇腾的实现。旧 GLM 基线有 59 个 `patch_*.py` 文件，`v0.30.0` 主基线为 65 个（`platform` 32 + `worker` 19 + `worker/patch_v2` 14），`main` 退役 MRV1 后收敛至 59 个（`platform` 29 + `worker` 30）。因此读上游代码看到的未必是实际运行的那一份。
- **多进程重复初始化**：补丁的防重标志保存在当前 Python 进程内存中，一个进程打过补丁无法替另一个进程记录状态。按命令行默认 `spawn` 假设，前端、EngineCore 和每个 Worker 都要在各自解释器里读清单、打 patch。特别是 EngineCore 子进程不会跑测试框架的初始化钩子，必须借通用插件入口再补一次全局 patch。
- **和上游版本绑得紧**：上游改动函数名或签名时，patch 必须同步调整。旧 GLM 基线的平台补丁里有两项、Worker 补丁里有一项直接挂在「不是 vLLM 0.23.0」的版本判断下，V2 相关补丁还有独立门控。

## 两边各管什么：五个扩展点

**vLLM 提供请求与引擎框架**（接请求、分词、调度、下发计划、收回结果），**vllm-ascend 提供 NPU 执行与配套适配**，从五个入口切入（配置与 patch 也能反过来影响调度）。在 `v0.30.0` 主基线中，vllm-ascend 引入 `HardwareProfile` 四家族抽象（`A2` / `A3` / `_310P` / `A5`）统一硬件能力查询，并保留 MRV1 与 `worker/v2/`（MRV2）并存；到 `main` 则彻底移除 MRV1 并退役 `patch_v2/` 子目录：

```wiki-diagram
file: vllm-ascend-overview-fig-two-repo-map
```

先沿一条标准 **`Qwen3-8B`（`v0.30.0` 主基线）** 请求，看懂这五个扩展点各自接管什么：

- **平台（`NPUPlatform`）**：启动时读取 `HardwareProfile` 校验卡型、把默认 `block_size` 对齐为 `128`，并回答 Worker（`NPUWorker` / `NPUWorker310`）、注意力后端与通信类（`NPUCommunicator`）各用哪个。见[插件发现与模型注册](platform-plugin-registration.md)与 [NPUPlatform](npu-platform.md)。
- **patch**：在上游未留接口处替换函数或类，分平台侧和 Worker 侧两类（如默认模型运行器开关、特定调度/缓存对齐）。见 [Patch 机制](ascend-patch-system.md)。
- **模型**：像 `Qwen3-8B`（`Qwen3ForCausalLM`）直接复用上游内置模型类；而上游未内置或需昇腾定制的架构（`v0.30.0` 共 29 项，含 GLM、DeepSeek、Kimi 与 `Qwen3_5*` 覆写），则由插件在 `ModelRegistry` 指向昇腾实现。见[模型入口](platform-plugin-registration.md#模型入口从架构名找到昇腾的-glm-实现)。
- **算子**：提供注意力（标准 GQA 走 `AscendAttentionBackend` / FIA）、MoE、量化矩阵乘和卡间通信的 NPU 实现。总入口见[算子与 kernel](ops-and-kernels.md)，注意力后端见[注意力后端](attention-backend-family.md)，卡间通信见 [CANN 与 HCCL](cann-hccl.md)，量化见 [W8A8 量化](quantization.md)。
- **配置**：把命令行、`--additional-config` JSON 与环境变量三路开关汇成各进程的 `AscendConfig`。见 [Ascend 配置](ascend-config-system.md)。

状态也按这条线分：请求进度和 KV cache 块分配归上游，本步的请求映射、注意力元数据和各卡的缓存张量归执行侧。请求没被调度，查队列、token 预算和块分配；读错了历史，查位置、[block table](block-table.md) 和状态索引。

## 一条请求走到这里：A0–A4 每站换了什么

看清标准 `Qwen3-8B` 路径后，下面把五个扩展点映射到本站 `09 旗舰异构模型全案` 的历史双机部署（`2×A2×8`，`TP8 / DP2 / EP16`，`W8A8`，模型 `GLM-5.3-Flash`，固定 `vllm@0fc695fc + vllm-ascend@db701c1f`，见[部署前提](glm-5-3-flash-two-node.md#部署前提)），沿[一条请求](one-request.md)逐站核对：

- **A0 启动**：按核心功能角色计 20 个进程，其中 16 个 Worker 各守一张卡（不含启动器与运行时辅助进程）。默认 spawn 下，其中 19 个角色分别完成通用插件登记；平台选中 `NPUWorker` 并补上 W8A8 量化选项，分配 KV cache 后，非 eager 路径进入预热与图捕获。见[引擎进程](engine-processes.md)。
- **A1 入口**：HTTP、聊天模板、分词、选 DP 组都是上游代码；昇腾事先打好 global patch，让 `vLLM 0.23.0` 认得 GLM 配置。
- **A2 调度**：Scheduler 归上游，但块长与分组由昇腾 patch 替换的函数算出：逻辑块 `640` 个位置，四类状态对齐成两档页、编成 `5` 个缓存组。见 [KV cache 规格](kv-cache-spec.md)。
- **A3 准备输入**：计划在这里越过平台边界。`NPUModelRunner` 把调度输出转成 NPU 张量，为 5 个缓存组各维护一张 block table，并把 full 组的 `640` 块号展开成 5 个 `128` kernel 块号。见 [Block Table](block-table.md)。
- **A4 逐层前向**：45 层由昇腾包里的 GLM 模型组织，注意力分 34 层 [KDA](linear-attention.md)（借 custom op 选中昇腾实现）和 11 层[稀疏 MLA](sparse-attention.md)（直绑专用后端）。其中 42 层前馈为 [MoE](moe.md)，路由专家按 [EP16](expert-parallel.md) 摊到 16 张卡。

## 常见误解

- **「它是 vLLM 的 fork」**——不是。仓库里没有 vLLM 的代码副本，两个包各自安装。
- **「插件就不碰上游代码」**——只对一半。没接口的地方在运行时换掉上游函数，GLM 基线有 59 个 patch 文件。
- **「入口清单交的就是平台对象」**——交的只是一行类路径。vLLM 挑定硬件后才导入，免得提前拉起昇腾底层库。
- **「昇腾的行为不在继承类里，就在 patch 里」**——对 GLM 不成立：模型代码整份在昇腾包里，专用算子在昇腾的算子目录里。
- **「调度归上游，和昇腾无关」**——KV cache 的块长和分组由昇腾 patch 决定。
- **「哪个版本都能跑本页 GLM-5.3-Flash」**——固定 v0.23 维护版和 v0.26 rc 的模型目录里没有本页这份 GLM5Next 实现；不能据此推断所有 GLM 系列模型都不支持，见[版本差异](#版本差异)。

## 对照源码

### 怎么开

安装包后，vLLM 还需通过插件入口发现它，并按允许加载的名单筛选。排查插件没有生效时，要同时检查安装元数据与加载筛选；包能够导入，并不足以说明插件已经加载。GLM 基线声明两组 entry point、共 5 个入口名 [来源 1](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/setup.py#L543-L550)：平台组 `vllm.platform_plugins` 只有 `ascend = vllm_ascend:register`，只返回字符串 `"vllm_ascend.platform.NPUPlatform"`，由 vLLM 自己导入；通用组 `vllm.general_plugins` 有四个，登记 KV 连接器与权重传输引擎、[netloader](netloader-guide.md) 与 rfork 加载器、服务级 profiling 配置、模型实现 [来源 3](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/__init__.py#L38-L75)。平台组在每个进程第一次访问当前平台时加载 [来源 4](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/plugins/__init__.py#L14-L19)、[来源 5](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/plugins/__init__.py#L28-L82)。

四个通用入口里三个先调 `_ensure_global_patch()`，模型入口不调：vLLM 在 EngineCore 子进程里加载通用插件，端到端测试的 conftest 钩子到不了那里，global patch 只能借这些入口打上 [来源 2](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/__init__.py#L18-L35)。

NPUPlatform 继承上游 Platform [来源 6](https://github.com/vllm-project/vllm/blob/0fc695fc/vllm/platforms/interface.py#L105-L113)。v0.23 维护分支上它标成 OOT（out-of-tree），设备名 npu，可见设备环境变量 `ASCEND_RT_VISIBLE_DEVICES`，dispatch key 是 PrivateUse1，简单编译后端写成 eager、注释写明关闭 torch.compile [来源 7](https://github.com/vllm-project/vllm-ascend/blob/2c59ff10/vllm_ascend/platform.py#L96-L146)，图模式另走一套，见[图模式层](graph-mode-layer.md)。GLM 命令里的 `--quantization ascend` 由平台在解析参数前补进去，patch 统一入口也在这里调 [来源 8](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L184-L203)。官方双机不在附带 JSON 里传任何键，见 [Ascend 配置](ascend-config-system.md)。

其余接口：继承 WorkerBase 的 NPUWorker 在 Worker 类为 auto 时选中，310P、xlite 另有分支 [来源 9](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L650-L662)；继承 GPUModelRunner 的 NPUModelRunner 由 NPUWorker 创建，另有 v2 runner 分支 [来源 13](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/worker.py#L505-L520)；平台选择注意力后端时先看符合条件的 FA3 特例，普通路径按三个标志查表，310P 另有映射 [来源 10](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L805-L832)。GLM 的 KDA 构造与 custom op 登记见来源 28、49，稀疏 MLA 的显式后端绑定见来源 50。NPUCommunicator 由平台返回 [来源 11](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L869-L871)。模型入口把 GLM 的文本、多模态、MTP 架构名登记到昇腾实现 [来源 16](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/models/__init__.py#L1-L25)。

### 会报什么错

| 现象 | 原因 | 去哪查 |
|---|---|---|
| `Only one platform plugin can be activated` | 装了两个会激活的平台插件 | [插件发现](platform-plugin-registration.md#会报什么错) |
| 加载插件失败的日志，之后没选中 NPU | 导入出错被跳过 | 同上 |
| EngineCore 或 Worker 启动抛错，栈里有 patch | patch 出错打断所在进程 | [Patch 机制](ascend-patch-system.md#会报什么错) |
| 配置组合被拒 | 平台的配置校验 | [NPUPlatform](npu-platform.md#会报什么错) |
| 量化方法 ascend 无效 | 先查平台准备钩子是否成功给解析器加入该选项，不能只凭现象认定平台未激活 | 查平台注册与参数解析 |
| GLM 配置类型或架构名找不到 | 先查目标版本是否有对应实现，以及配置补丁、模型入口是否成功执行 | [版本差异](#版本差异) |

### 开销和什么时候别开

启动开销包括扫描安装元数据、导入插件与初始化实现。按本页核心角色和默认 spawn 假设，通用插件登记计 19 次；这不是平台解析、所有模块导入或底层运行库初始化次数的统一计数，见[登记次数的口径](platform-plugin-registration.md#这张清单在本部署被读了-19-遍)。CLI 仅在环境未预设启动方式时写入 spawn（来源 42、43），其他启动方式须重新核对。每步开销看各站选中的实现。若同一环境还要使用别的硬件，应在启动前用 `VLLM_PLUGINS` 排除 ascend 或卸载插件：这个固定平台注册入口不查设备，唯一激活的外部插件会优先于内置候选（来源 3、41）。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10`，GLM 双机绑定算例专用镜像 `db701c1f` 同属此分支期并自带单文件 GLM5Next 实现）、`v0.26.0rc`（`vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20`）与 `main`（`vllm-ascend@8d6180e2`）。**`v0.30.0` 引入 `HardwareProfile` 四家族（`A2` / `A3` / `_310P` / `A5`）统一封装硬件能力与默认 Worker 类，并保留 MRV1 与 `worker/v2` 并存（未设 `VLLM_USE_V2_MODEL_RUNNER` 时默认 MRV1）；`main` 则正式移除 MRV1（`model_runner_v1.py`），将全部执行路径收束至 `worker/v2/`（MRV2），并将 `patch/worker/patch_v2/` 合并回 `patch/worker/`。**

下表按四版本正式钉点核对（`patch_*.py` 计数按 `patch/platform` + `patch/worker` + `patch/worker/patch_v2` 三个目录的直接文件统计，不等于单次启动全部执行数量）：

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 硬件抽象 `HardwareProfile` | 按设备判断分支散落在平台与算子处 | 同 `v0.23.0` | `device/hardware_profile.py#L278-L355` 收敛为 `A2` / `A3` / `_310P`（`NPUWorker310`）/ `A5` 四家族档案与 `HardwareCapability` 能力集 | `device/hardware_profile.py#L372-L465` 延续四家族档案，新增 `WeightFormat` 枚举统一权重排布策略 |
| Model Runner 演进（MRV1 → MRV2） | 默认 MRV1，显式开关切 MRV2 | 同左 | MRV1 与 `worker/v2/` 并存；`patch_use_v2_model_runner.py#L18-L42` 未设环境变量仍默认 `False`（MRV1） | **移除 MRV1**；`mrv2_utils.py#L29-L65` 固定返回 `True`（显式 `=0` 报错），全量走 `worker/v2/` |
| `patch_*.py` 文件分布 | 59（GLM 镜像 `db701c1f` 同为 59） | 64 | **65**（`platform` 32 + `worker` 19 + `worker/patch_v2` 14） | **59**（`platform` 29 + `worker` 30，`patch_v2/` 已退役并合入 `patch/worker/`） |
| `setup.py` entry points | 2 组 5 个 [C31]（GLM `db701c1f` 同 [C1]） | 2 组 5 个 [C32] | 3 组 6 个（新增 `ms_service_metric.providers` -> `observability:get_metric_provider`，`#L506-L517`） | 3 组 6 个（指标入口迁至 `observability.ms_metrics:get_metric_provider`，`register_connector` 新增 `ec_transfer` 注册，`__init__.py#L52-L118`） |
| GLM-5.3-Flash 模型代码 | 维护分支无（专用镜像 `db701c1f` 在 `models/glm5_next.py` 等 3 文件） | 无 | 目录化至 `models/glm5next/`（模型、MTP、KDA、稀疏索引器分文件，含 GLM5 DSpark 登记） | 延续 `models/glm5next/` 目录化结构 |

`v0.23.0` 维护版与 `v0.26.0rc` 的补丁目录中有 GLM 工具调用或推理用量的适配，并不等同于包含本页 GLM5Next 模型实现。GLM 基线的 A2 Dockerfile 明确在构建时应用 Transformers 补丁（来源 47）；根目录的 `vllm_patch` 文件是否进入所用镜像，还需要对应构建记录，不能当成已执行的运行时 patch。其他目录见[目录地图](vllm-ascend-repo-map.md)，官方定位见 [S34][S35]。

### 源码位置

均为 GLM 基线 db701c1f，另注的除外：

- 入口：setup.py 第 543–550 行，`vllm_ascend/__init__.py` 第 18–75 行；上游加载在 `vllm/plugins/__init__.py`。
- platform.py：初始化第 184–203 行，选 Worker、注意力后端、通信类在第 650、805、869 行起；类属性取 v0.23 维护分支第 96–146 行。
- patch 入口 utils.py 第 563 行；GLM 的 KV 分组在 patch_kv_cache_utils.py 第 517–548 行。
- NPUWorker 在 worker.py 第 89 行，NPUModelRunner 在 model_runner_v1.py 第 287 行，GLM 模型在 glm5_next.py。
- v0.23 维护分支的 AscendAttentionBackend 在 attention_v1.py 第 78 行，NPUCommunicator 在 npu_communicator.py 第 23 行。

安装元数据提供插件发现入口，VLLM_PLUGINS 还可过滤清单，导入和入口调用也必须成功。发现条目不能代替实际启动成功或设备可用性的验证；上述条件属于所列固定上游实现。[C5]

补丁防重标志属于进程内状态，EngineCore 子进程还要经过自己的通用插件入口。不同进程和不同补丁的调用路径须分别判断，不能用父进程加载成功证明每个子进程都已完成补丁初始化。[C2][C3]

平台影响调度的实际例子见来源 45：重算调度在 prefill 角色被关闭，在 decode 角色才创建相应配置。来源 46、48 给出两处平台补丁和一处 Worker 补丁的直接版本判断，以及另行门控的 V2 补丁。图捕获入口的非 eager 条件见来源 44。多组块表与物理块拆成 kernel 块的规则见来源 51、52；640 与 128 及五组的部署数值仍以链接的 KV 规格页为唯一推导。
