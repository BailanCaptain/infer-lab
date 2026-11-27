---
id: reading-vllm-ascend
title: 怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现
type: concept
legacyAnchors:
  放到-glm-双机沿-r1-读一遍先碰到什么: 怎样沿跨机请求定位两个仓库的实际执行代码
summary: >-
  vllm-ascend 是装在 vLLM 上的昇腾平台插件，靠入口点、patch、custom op
  等扩展点接进请求路径，所以一条请求跑的是两个仓库拼起来的代码。先沿七站读通主线，再按数据、配置、实现三条路线带着问题追；遇到异常或版本变化时先划清证据边界，区分源码推断和运行证据。
aliases:
  - 源码阅读方法
  - 怎么读源码
  - 定位方法
  - 查代码
  - 版本对照
  - 读源码
  - 从报错找代码
  - 按符号对照
  - 三条追查路线
  - 问题驱动读源码
  - vllm-ascend 源码阅读
chapters:
  - '20'
order: 20
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L76-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L335-L346'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2427'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L234-L258'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L836-L868'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L951-L962'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1270-L1277'
  - 'vllm-ascend@db701c1f:setup.py#L543-L551'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1556-L1562'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L604-L624'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L267-L267'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2053'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1616-L1685'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L75'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L92'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L96'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L287-L310'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L75-L75'
  - >-
    raw:sha256-a319a8e811d379832d7afc360f3115c6143c7cb0961012943e875d4c5e0da129.md#L1-L622
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L752-L820'
  - 'vllm-ascend@7d825229:vllm_ascend/models/__init__.py#L78-L88'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/layernorm.py#L83-L103'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L679'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L354-L365'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L370-L381'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L736-L818'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L707-L780'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L841-L926'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1793-L1933'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L84-L89'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L109-L114'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L218-L401'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L272-L519'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L44'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L7'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L1-L89'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L135-L180'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L144-L190'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L746-L760'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L844-L855'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L267-L290'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L295-L320'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L866-L952'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L893-L979'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-ascend-overview
    kind: builds-on
    note: 先知道插件从哪几处接进 vLLM，才能判断读到的文件会不会被执行
  - to: request-call-chain
    kind: builds-on
    note: 先沿请求调用链认清七站的进程、通道与函数入口，再按本页三条路线带着问题下钻源码
  - to: vllm-ascend-repo-map
    kind: builds-on
    note: 用职责地图确定起始文件
  - to: ascend-patch-system
    kind: builds-on
    note: 理解直接绑定和注册分派如何改变实现
  - to: ascend-config-system
    kind: builds-on
    note: 源码阅读方法中的配置追踪路线，以配置系统的输入合并、校验改写和最终消费条件为基础。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-a319a8e811d379832d7afc360f3115c6143c7cb0961012943e875d4c5e0da129.md
  - >-
    raw/sha256-e0f950d1ccf5d480b9a409090ad90dbf226c8fc6eb3a14c60b462a609e4dfe4e.md
---

## 读 vllm-ascend 的源码之前：它是什么，怎样接进 vLLM

`vllm-ascend` 是 vLLM 的昇腾平台插件。它是一个单独安装的 Python 包，借 vLLM 的启动框架和扩展点，把「这一步在昇腾 NPU 上怎么算」接到自己的实现。请求接入、引擎循环和调度沿用 vLLM 框架；插件也会调整调度配置或替换部分实现，因此不能只凭文件属于哪个仓库判断最终行为。

先以 `v0.30.0` 标准主基线下的 **Qwen3-8B** 请求为例，看一条常规推理请求怎样跨越 `vllm`（`ced6857a`）与 `vllm-ascend`（`c09d3e20`）两个仓库：

```wiki-diagram
file: ascend-vs-upstream-qwen3
```

图中横线以上是上游 `vllm` 负责的部分：HTTP 分词入队、单组 `128-tok` 块池调度，以及由 Executor（把本步计划分发给各卡的对象）发出前向与采样两次调用。像 `Qwen3ForCausalLM` 这类标准模型，模型骨架也直接复用上游 `vllm`。横线以下是 `vllm-ascend` 接管的执行层：`NPUPlatform` 定默认块长并选后端，`NPUWorker` 守单卡管显存与通信域，`NPUModelRunner` 拼输入、建块表并回放图，再经昇腾注意力与 CustomOp 算子后端算完这一步，最后把采样 token 交回引擎。实线表示在线推理调用链，虚线表示启动期注册、复用与算子绑定。

它靠什么接进去？包的安装信息里登记了几条 entry point（入口点：包对外声明的「组名 → 入口名 → 要调用的函数」）。vLLM 的前端、引擎和 worker 进程启动时，都会按组名扫描一遍这些登记（完整激活链见[插件发现与模型注册](platform-plugin-registration.md#发现过滤激活)）。平台组只有一条，交出昇腾平台类 `NPUPlatform` 的路径，由 vLLM 导入；此后遇到「用哪个 worker、哪个注意力后端、哪种通信」这类硬件问题，都由它作答。

通用组的几条入口分别登记连接器、模型加载器、性能采集和模型实现，加载时还会打上一批 patch（进程内把上游函数或类换成昇腾版）。再算上 custom op（允许硬件插件整体替换的算子层），`vllm-ascend` 进入请求路径共有六处：平台、worker、注意力后端、custom op、patch 与模型注册（逐站落点见[一条请求的代码路径](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)）。

对读代码而言，一条请求跑的永远是两个仓库拼起来的代码：HTTP 前端、引擎循环和调度器在 `vllm`，worker、model runner、注意力和昇腾算子在 `vllm-ascend`。标准模型骨架可留在 `vllm`（如 `Qwen3`），也可由插件自注册（如后文的 GLM）。两边互相穿插：上游函数可能被 patch 换掉，插件类又继承上游类、未重写的方法仍跑上游代码。因此读 `vllm-ascend` 不能只盯一个仓库，也不能仅凭文件归属判断它是否会执行。

## 为什么先抓一条请求的主线，而不是按目录读

仓库目录按职责分：平台、worker、注意力、算子、patch、模型各占一块，对应关系见[源码目录地图](vllm-ascend-repo-map.md)。目录不按执行先后排。从目录树往下读，看到的是一大片文件，不知道哪些会在你的请求里跑、谁先谁后，很容易在永远不会被调用的分支里读上半天。

一条请求真正经过的文件并不多。它走七站：入口、调度、准备输入、逐层前向、采样与草拟、结果更新、返回与收尾。两头四站主要在 `vllm` 的前端与调度器文件里，中间三站集中在 `vllm-ascend` 的 model runner、模型文件、注意力与算子目录（每一站的进程与入口函数见[一条请求的代码路径](request-call-chain.md#七站逐站从哪个函数进往下调谁)）。

主线读通以后，再看任何特性都有落点：一个开关、一个算子、一个 patch，都可以问「它在第几站生效、改了哪份输入或输出」。代价是主线只覆盖当前部署实际走到的分支；[PD 分离](pd-disaggregation.md)（prefill 和 decode 交给两组机器分别跑）、别的模型、没打开的开关都在主线之外，要到各自的特性页，按下面同样的路线补读。

## 带着问题读：先把问题写成输入和输出

「模型怎么推理」范围太大，读不出结论。把它拆成能验证的小问题：调度器交给 model runner 的到底是什么；拼好的四行输入为什么只采样两行；`RMSNorm`（均方根层归一化）最终调到哪个实现；某个配置值什么时候被覆盖。每个问题都落在一个[架构组件](vllm-v1-shape.md)上，对应一段数据变化。

先读本库相应的概念页，把数学或系统机制弄懂，再沿钉住版本的源码核实实现。读源码要回答四件事：输入是什么、输出是什么、保存了什么状态、在什么条件下生效；函数名列表只是导航。按问题类型可以分三条追查路线：

- **路线一（数据流）**：问数据怎样变，沿请求张量与状态往前追；
- **路线二（配置流）**：问开关为什么这样生效，沿配置找到真正消费它的代码；
- **路线三（实现流）**：问到底执行哪份实现，从模型调用追到登记与分派。

三条路线最终都落到同一种记录：固定版本、生效条件、源码范围和结果。把三条路线合成一条从插件入口到设备核函数的五步走读链，并对照 `v0.30.0` / `main` 新增的 `HardwareProfile` 与 V2 Runner 切换入口，可以按下面这张路标逐步下钻：

```wiki-diagram
file: reading-vllm-ascend-fig-5step-trail
```

## 路线一：沿请求数据往前追

以[输入准备页](prepare-inputs-flow.md#ac-第三轮如何拼接)里 A、C 两条请求拼成一批的那一步为例。先记下调度器给每条请求安排了几个位置，再读 model runner 怎样据此造出 token 张量、位置数组和采样行，核对四行输入为何只采样两行。接着沿前向调用进入模型层，确认它读哪些张量、返回哪些张量。

读的时候在笔记里留一张小表，每跨过一道边界填一行：

| 边界 | 输入 | 输出或副作用 | 在谁手里 |
|---|---|---|---|
| 调度结果 → 输入准备 | 请求进度、本步安排数量、块信息 | 本轮张量与元数据 | model runner |
| 输入准备 → 模型前向 | token 或 embedding、位置、历史状态 | 隐藏表示与更新后的状态 | 模型及注意力后端 |
| 隐藏表示 → 采样 | 选中的行、词表投影、采样配置 | 输出 token 或相关结果 | 执行侧 |

每道边界只往里展开一层，就能把新读到的代码放回整体架构。看到 NPU 算子调用时，再按问题决定要不要进设备实现；不必为了解释一次采样，通读整个算子目录。

沿数据追踪时，还要记录张量所在的设备和数据类型。例如，生成结果必须符合指定语法时，采样前要用一张“哪些 token 可以选”的掩码修改词表分数。固定执行侧的这段路径只在有语法处理信息时执行：先记住分数原来的数据类型，再移到 CPU 并转成单精度浮点数，应用掩码后移回目标设备，最后恢复原来的数据类型。只记“分数经过了掩码处理”，就会漏掉设备迁移与类型转换。

## 路线二：沿配置找到真正消费它的代码

以 FlashComm1（昇腾对[序列并行](sequence-parallel.md)的通信实现，键名 `enable_flashcomm1`）为例，读配置最忌只看输入字典，不区分**原始输入、派生值与最终消费者**。第一步在钉住提交里搜 `enable_flashcomm1`，找到 `AscendConfig` 读取它的入口与环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`。第二步核对合并与派生逻辑：在 `v0.30.0` 正式版与 `main` 中，`derive_and_validate` 会将 JSON 里的布尔值与合法环境变量值做**逻辑或**（`v0.30.0` 开启 `enable_dsa_cp` 时还会自动打开它）。也就是说，哪怕 `--additional-config` 显式写了 `"enable_flashcomm1": false`，只要环境变量设为 `1` 或 `true`，这一步算出的派生开启意图仍为真。（只有在 `v0.23.0` 与历史 GLM 旧镜像的 `_get_config_value` 里，才按“JSON 有键就用 JSON、缺键才退回环境变量”覆盖。）

拿到派生开启意图后，还不算真正生效。紧接着同一段代码会检查并行与模型条件：既不满足 MoE 序列并行、也不属于支持稠密序列并行的模型族（如 `TP > 1` 且 `PP == 1` 的稠密 `Qwen3.5`）时，会打印告警并关回；关闭时还会顺手改写 `all2all_backend`。第三步继续往下搜运行时消费者（如 `enable_sp` 及各层前向），核对别的平台校验是否会继续改写配置——例如重算调度开关在 PD 分离的 prefill 节点会被改回关闭并告警，非 decode 节点直接报错。所以完整追查链永远是「原始输入 → 合并派生 → 校验或改写 → 消费条件 → 执行分支」，三路来源与改写链见[配置系统](ascend-config-system.md#解析完还会被改写生效值不是你写的值)。

读一个函数时，还要看它的调用者。字段被读取，不等于它最终改变了张量或执行路径：有的消费者遇到某个条件就直接退出。

## 路线三：从模型里的调用追到最终实现

先看标准模型的类替换：像 `Qwen3` 的解码层在构造 `input_layernorm` 时，代码里写的是上游 `RMSNorm` 类。追进 `CustomOp` 注册表（`REGISTERED_ASCEND_OPS`）与构造分派就能看到，插件在启动期已将 `RMSNorm` 映射到昇腾的 `AscendRMSNorm`，前向最终落到 NPU 归一化算子（逐级下钻见[从算子到设备](op-to-ai-core.md)）。

再看异构或自注册模型的直接绑定：除了 `CustomOp` 映射，模型注册、派生类、层内私有绑定和运行时 patch 都能换掉最终实现。例如后文历史 GLM 解码层虽同样走 `CustomOp` 替换 `RMSNorm`，但它的稀疏 MLA 层直接在算子内部写死配套注意力后端，不查平台通用映射表。下一站由调用写法决定，不要机械套用「先查 patch 目录，没找到就读上游」；况且 patch 文件本身也按芯片型号或 vLLM 版本条件导入，找到文件后仍须核对导入条件是否成立（见 [Patch 机制](ascend-patch-system.md#排查时怎样确认跑的是哪一份代码)）。

## 遇到异常：先划清证据的边界

一条 traceback 属于哪一站、日志前缀怎样认进程，按[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)去认。认完站以后，读的时候最容易越界的是下面几处。

Python 的 traceback 从外层调用一路列到异常发生的位置。先找到最初的那个异常和它的上下文，判断它属于输入处理、调度、模型执行、通信还是设备运行时。多个进程的日志会交错在一起；之后出现的进程退出、通信中断，常常只是连带结果。

离异常最近的那一帧如果在 vllm-ascend 里，它是调查的入口，但单凭它不能证明根因就在这个文件；反过来，栈里一帧 vllm-ascend 都没有，也不能证明昇腾的配置、状态或设备任务与问题无关。NPU 上的任务是异步提交的，错误在哪里被看到，取决于哪里做了同步。固定图的回放路径里就有这样的同步点：满足特定分支条件的整图回放，会先等当前流上已提交的任务完成，再执行回放；采用 EAGLE（特征级投机解码草稿方法）来先草拟候选的路径，以及由模型执行对象另行安排更新与回放顺序的路径，会跳过这里的等待。精确条件见页末源码说明。此前异步提交的任务若发生错误，可能在这个同步点才被报告；跳过此处等待也不能推出整条路径没有其他同步点。所以报错的位置不一定是出错的位置。

记录实际版本、完整的首个异常、触发条件和最后成功的阶段，再设计能缩小范围的复现。没有设备、只读代码，能解释断言和调用条件，但不能把一个候选原因升级成已复现的根因。

## 对照版本时，比的是行为，不是行号

```wiki-diagram
file: ref-diff
```

图里的两个提交是示意，不对应某次具体发布。做法是：先固定两个完整的提交，在两边找到负责同一件事的文件和符号（类名、函数名），再比较输入、分支条件、状态更新和调用点。只比行号或文件长度，判断不了行为是否一致。

读某个提交里的一份文件快照，用 git show 加「提交:路径」；比较同一路径在两个提交之间的改动，用 git diff。文件被挪过位置时，要按符号去新提交里搜。发布说明或 PR 能解释为什么改，但目标提交里是否真的包含这个修复，仍要到那个提交里核。GLM 代码和配置入口在几个版本之间的实际变化，见页末[版本差异](#版本差异)。

读完写结论时，写成「在某个提交、某种设备和配置条件下，某个输入走进这个分支，产生这些结果」，并附上支持它的源码范围。来源里的限制、没装机验证、没实际跑过，也写在结论旁边，不把一条静态读出来的路径写成部署上的结果。

## 怎样沿跨机请求定位两个仓库的实际执行代码

与前面标准 `Qwen3-8B` 直接复用上游模型骨架不同，跨机专家并行下的异构模型往往连模型类也由 `vllm-ascend` 自注册实现。下面以历史 GLM-5.3-Flash 双机算例（例外 B）对照跨仓库七站分工：

```wiki-diagram
file: ascend-vs-upstream
```

[R1](one-request.md#示例请求-r1-与官方双机部署) 是为了手算设的示例请求，提示词 4 个 token；它从入口走到返回，每一站的入口文件和函数已在[一条请求的代码路径](request-call-chain.md#源码位置)按阅读顺序列好。沿上面三条路线定位跨机请求的代码时，会依次遇到五个核查点：

- **先定版本与目录。** 历史双机算例的控制流钉在 `vllm` `v0.23.0`（`0fc695fc`），执行侧钉在专用镜像 `db701c1f`（单文件 `models/glm5_next.py`；社区 `v0.23.0` 维护版与 `v0.26.0rc` 不含该文件，见[部署前提](glm-5-3-flash-two-node.md#部署前提)与[来源基线](../sources/glm-5-3-flash-baseline.md)）。`v0.30.0` 正式版将模型拆入 `models/glm5next/` 目录，并统一通过 `HardwareProfile` 查询芯片能力。到 `main` 分支，仓库进一步删除了 `model_runner_v1.py`，执行入口全量收口至 `worker/v2/`。
- **路线一（跨卡数据流）。** R1 被分到 DP0 后，第 3 站由 node0 的 8 个 Worker 各拼一份一模一样的输入。因为 TP8 下它们处理同一批 4 个 token、只是各持一部分权重；逐卡拼接细节见[有多种缓存组时，一步输入怎样配齐](prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)。
- **路线二（输入→派生→消费者）。** 核查序列并行等特性是否生效，不能只看启动命令有没有传 `enable_flashcomm1`，而要顺着「原始输入 → 派生与联动改写（如共享专家 DP 条件刷新 `enable_sp`）→ 下游消费者分支」逐级核实（历史双机配方的具体参数取值与 SP 假设见[双机关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)，覆盖链见[昇腾配置体系](ascend-config-system.md#解析完还会被改写生效值不是你写的值)）。
- **路线三（层内绑定分流）。** 解码层落在 `vllm-ascend` 模型文件内，`RMSNorm` 经 `CustomOp` 注册表换成昇腾实现；但稀疏 MLA 层由层内直接绑定配套后端，不查平台通用映射表（见[六个口子](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)第 3 条）。
- **异常与跨机陪跑。** node1（DP1）即便没接到 R1，每步也要跑空批次陪着进出跨机 MoE 集合通信。集合通信要求组内全员到齐，任一卡阻塞都会拖到其他卡触发建链或执行双超时，因此先报错的卡未必是根因（日志认站见[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)，HCCL 建链与执行双超时机制见[昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md#hccl-关键运行期调优aiv-直驱-roce链路-qos-与双超时机制)）。

## 常见误解

- **「vllm-ascend 是一份改过的 vLLM，读它一个仓库就够了」**——它是装在 vLLM 上的插件，服务通过 vLLM 的框架启动；引擎循环、调度器、HTTP 前端以 vLLM 为基础，部分行为会被配置、patch 或派生类调整。
- **「从目录树开头往下读最系统」**——目录按职责分，不按执行顺序；先沿一条请求读通主线，再按职责补读。
- **「代码里读到了这个字段，开关就生效了」**——还要看合并、平台改写和消费者的条件；有的消费者遇到某个条件就直接退出。

  校验也可能直接拒绝启动。例如，[Balance Scheduling（均衡调度）](balance-scheduling.md)让多个执行组共同决定是否接纳新请求；它不搬请求。固定执行侧开启这个功能时，如果存在 KV 传输配置（描述历史状态怎样在执行组之间传递），而传输角色不是同时承担生产与消费，配置检查就抛出异常。因此，“读到了开启值”连配置有效都不能保证。
- **「patch 目录里搜不到，就一定是上游的行为」**——模型注册、派生类、后端绑定和 custom op 都能换掉实现；patch 文件本身也有导入条件。
- **「栈里离异常最近的 vllm-ascend 帧就是根因」**——它只是入口；异步执行让错误在同步点才被看到，多进程下它还常常只是连带结果。
- **「两个版本同一个文件、行号差不多，行为就一样」**——要按职责和符号对齐后，比输入、分支和状态更新；GLM 的模型文件在 main 上连位置和类名都变了。

## 对照源码

### 怎么开

安装 vllm-ascend 会登记可供 vLLM 发现的入口；入口还须被允许加载、导入并调用成功，才能在对应进程生效。[C12] `VLLM_PLUGINS` 可以过滤入口，设备是否可用还要另查运行环境，见[插件注册](platform-plugin-registration.md)。读代码要「打开」的是钉住的那几份提交：控制流读 vLLM 的 `0fc695fc`（v0.23.0），执行侧读 vllm-ascend 的 `db701c1f`。工作树检出的往往不是这份提交，所以一律按提交号读，命令见[源码位置](#源码位置)。

### 会报什么错

下面是照三条路线读时，和读法直接相关的日志与报错；请求在运行时各站的报错串见[一条请求的代码路径](request-call-chain.md#会报什么错)。

| 看到的 | 说明什么 | 对应 |
|---|---|---|
| `FlashComm1 is enabled, but the current config does not support sequence parallelism ... Disabling.` | `v0.30.0` / `main` 中 JSON 或环境变量给出了开启意图，但当前并行或模型族不满足序列并行条件，被自动关回 | 路线二的派生与消费条件 |
| `AscendConfig.enable_flashcomm1 is set from additional_config with value ...` | 历史 `v0.23.0` / `db701c1f` 的 `_get_config_value` 路径：值来自 JSON 键 | [版本差异](#版本差异) |
| `AscendConfig.enable_flashcomm1 falls back to environment variable VLLM_ASCEND_ENABLE_FLASHCOMM1 ...` | 历史 `v0.23.0` / `db701c1f` 路径：没写 JSON 键时回退取环境变量 | 同上 |
| `recompute_scheduler_enable is ignored on PD-disaggregated P nodes ...` | 平台把 prefill 节点上的重算调度开关改回关闭 | 路线二的平台改写 |
| `recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...` | 不是 decode 节点却打开了重算调度，启动即失败 | 同上 |
| main 上的 `FlashComm is deprecated; remove enable_flashcomm1 ...` | 这个键在 main 已弃用 | [版本差异](#版本差异) |
| `fatal: path 'vllm_ascend/models/glm5_next.py' does not exist in 'baa023ad'` | 拿基线的路径去读别的提交；GLM 文件在 main 上挪进了 glm5next 目录 | 同上 |

### 开销和什么时候别开

沿主线读，时间主要花在对齐版本和追分派上，换来的是只读实际会执行的分支。以下情况不能只靠主线：

- 要看的开关在本页教学假设下没开，例如 FlashComm1、重算调度器，主线不会展开那条分支，要从该特性页的「怎么开」读起，再核实际部署的覆盖条件。
- 要看 PD 分离或别的模型，七站的入口仍然可用，但每一站选中的实现要沿路线二、三重新确认。
- 要下根因结论，只读代码不够，还要实际运行的日志或能复现的步骤。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；**本文 GLM-5.3-Flash 走读算例沿用例外 B 专用镜像钉点 `db701c1f`（配套 `vllm@0fc695fc`），与四版社区分支分别核对。**

**升级到 `v0.30.0` 与 `main` 后，读源码最先变化的是走读入口与硬件判断。** 硬件分支从旧版散落的卡型硬编码收口到 `vllm_ascend/device/hardware_profile.py` 的 `HardwareProfile` 与 `get_current_hardware_profile()`；FlashComm1 在 `v0.30.0` 与 `main` 中已移出旧合并函数，由 `derive_and_validate` 对 JSON 开关与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 取“或”（`v0.30.0` 还含 DSA-CP 自动开启），并预先从原始字典剔除以通过 `extra="forbid"` 校验；模型运行器在 `v0.30.0` 仍默认 V1（`VLLM_USE_V2_MODEL_RUNNER=1` 切到 `worker/v2/model_runner.py`），而到 `main`（`8d6180e2`）已删除 `worker/model_runner_v1.py`，`patch_use_v2_model_runner.py` 通过 `mrv2_utils.apply_v2_model_runner_config_patch()` 固定启用 `worker/v2/`，显式传 `VLLM_USE_V2_MODEL_RUNNER=0` 会直接抛错。历史 GLM 基线的完整接入对比（entry point、patch 文件数等）见 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md#版本差异)。

| 走读核验项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| Model Runner 走读入口 | `worker/model_runner_v1.py`（V1 为唯一主路径） | `worker/model_runner_v1.py` 为默认，并存早期 `worker/v2/` | `worker/model_runner_v1.py` 为默认；`patch_use_v2_model_runner.py#L18-L44` 按 `VLLM_USE_V2_MODEL_RUNNER` 切 `worker/v2/model_runner.py#L135` | 移除 `model_runner_v1.py`，全量收口至 `worker/v2/model_runner.py#L144`；`patch_use_v2_model_runner.py#L1-L7` + `mrv2_utils.py` 锁定 V2，设 `=0` 直接报错 |
| 硬件能力与分支判断 | 按芯片型号直接判断（无 `HardwareProfile`） | 沿用芯片型号分支 | 引入 `device/hardware_profile.py#L218-L401`（`HardwareProfile` 能力位与模式表统一分派） | 延续并扩展 `device/hardware_profile.py#L272-L519` |
| GLM-5.3-Flash 模型代码落点 | 维护分支无此模型（绑定算例在镜像 `db701c1f` 的 `models/glm5_next.py` `AscendGlm5NextDecoderLayer` [C16]） | 维护分支无此模型 | 迁入 `models/glm5next/model.py#L267`（类 `Glm5NextDecoderLayer`） | 延续 `models/glm5next/model.py#L295`（类 `Glm5NextDecoderLayer`） |
| FlashComm1 字段合并（路线二） | `AscendConfig._get_config_value`：JSON 键存在即优先，显式 `false` 覆盖环境 | 与 `v0.23.0` 相同 | `ascend_config.py#L746-L760` 在 `derive_and_validate` 中与环境取“或”（DSA-CP 自动开启），构造前剔除键（`#L1861`） | `ascend_config.py#L844-L855` 延续“或”逻辑与构造前剔除（`#L1984`），并衔接 `use_sequence_parallel_moe` 校验 |
| 标准 RMSNorm 登记（路线三） | `REGISTERED_ASCEND_OPS` 映射 `RMSNorm -> AscendRMSNorm` | 与 `v0.23.0` 相同 | `utils.py#L866-L952` 延续主表映射，并按硬件能力覆盖 310P 等兼容实现 | `utils.py#L893-L979` 延续同类主表登记与覆盖机制 |

上表只比较走读主线涉及的入口、配置合并与标准算子登记，不表示所有配置或算子在各版都相同。`v0.23.0` 与 `v0.26.0rc` 的合并与登记入口见来源 30–34、36–37；历史 `baa023ad` 过渡期曾经历 `enable_flashcomm1` 弃用告警与迁移（来源 13–17），现已由 `v0.30.0` 与 `main` 的 `derive_and_validate` 路径取代。模型目录的完整版本差异统一见[目录地图](vllm-ascend-repo-map.md#版本差异)。

### 源码位置

均为 GLM 基线 `db701c1f`，另注的除外。三条路线和七站编号是阅读上的划分，源码里没有叫这个名字的东西 [A]；A、C 两条请求是输入准备页为手算设的示意 [A]。

- 插件入口：`setup.py` 的 entry point 两组 [来源 12](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/setup.py#L543-L551)。
- 路线一：`vllm_ascend/worker/model_runner_v1.py` 的 `_prepare_inputs` 中造位置、token 与采样行的几段 [来源 9](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/model_runner_v1.py#L836-L868)、[来源 10](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/model_runner_v1.py#L951-L962)、[来源 11](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/model_runner_v1.py#L1270-L1277)；`execute_model` 收尾到 `sample_tokens` 一段 [来源 6](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/model_runner_v1.py#L2287-L2427)。
- 路线二：`vllm_ascend/ascend_config.py` 里读 `enable_flashcomm1` 与环境变量兼容映射 [来源 1](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/ascend_config.py#L76-L89)、合并函数 `_get_config_value` [来源 2](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/ascend_config.py#L335-L346)；`vllm_ascend/platform.py` 里平台对重算调度开关的检查与改写 [来源 3](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/platform.py#L668-L700)。环境读取器默认 0 [来源 22](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/envs.py#L75-L75)，只支持推导输入字段默认关闭；最终 `enable_sp` 的初始化、缓存刷新和共享专家 DP 覆盖见来源 29，实际调用条件须另核。
- 路线三：`vllm_ascend/models/glm5_next.py` 解码层对输入调用 `input_layernorm` [来源 5](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/models/glm5_next.py#L2212-L2235)；`vllm_ascend/utils.py` 的 `REGISTERED_ASCEND_OPS` 登记表 [来源 4](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/utils.py#L735-L768)；`vllm_ascend/patch/platform/__init__.py` 按设备型号与 vLLM 版本条件导入 [来源 8](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/__init__.py#L17-L57)。

- 异常一节：`vllm_ascend/compilation/acl_graph.py` 里 `ACLGraphWrapper.__call__` 回放前的同步 [来源 7](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/compilation/acl_graph.py#L234-L258)。

以下命令在 vllm-ascend 仓库里运行。已检出目标版本的工作树可以直接用 rg 搜文本；工作树不是目标版本时，改用固定提交查询，避免混进另一分支的结果：

```sh
git grep -n enable_flashcomm1 c09d3e20 -- vllm_ascend
git show c09d3e20:vllm_ascend/device/hardware_profile.py
git diff c09d3e20 8d6180e2 -- vllm_ascend/patch/platform/patch_use_v2_model_runner.py
```

- `v0.30.0` 与 `main` 新增走读入口：`HardwareProfile` 见 `vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L218-L401` 与 `vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L272-L519`；V2 Runner 入口与强制切换见 `vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L44`、`vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L135-L180`、`vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L7`、`vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L1-L89` 及 `vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L144-L190`；两版 FlashComm1 与 `REGISTERED_ASCEND_OPS` 核验见来源 45–50。

阅读固定 db701c1f 实现时，以下条件决定同一个名字是否真的触发所述行为：

- **数据往返。** 仅 `grammar_output` 非空时移到 CPU 转 float、施加掩码，再以 FP32 移回设备后恢复原 dtype；这不是所有采样路径都会发生的往返，见来源 6（在 `main` 全量切至 V2 Runner 后已默认由 NPU Triton kernel 原地处理，见[结构化输出](structured-output.md#版本差异)）。
- **配置优先级与有效性。** 按键是否存在选择值，因此显式 false 仍覆盖环境读取值。Balance 开启且传输角色不是 kv_both 时会拒绝；重算开启而角色是 kv_producer 时则警告并关闭重算。字段合并后还要经过这些有效性判断，不能把它当成 `v0.30.0` / `main` 的迁移规则，见来源 1–3。
- **回放等待。** 所列等待分支要求 FULL 图、不是 EAGLE 草稿模型路径、且未启用 enpu 三者同时成立；enpu 的更新与回放顺序由 model runner 安排。不能由此认定其他路径没有同步，也不能据一处等待直接判定异常根因，见来源 7。
- **登记条件的范围。** 来源 4 中的版本条件只控制追加的 FusedMoE 与 KimiGatedDeltaNetAttention，不控制已包含 RMSNorm 的主体登记表；后续还可能按硬件选择兼容实现。登记也不等于实际选中并调用。

以上为静态读源核验范围；没有采集设备迁移耗时、部署日志或设备运行结果，具体调用链仍须核对同一版本的调用位置和分派条件，阅读方法本身不构成运行证明。[I]
