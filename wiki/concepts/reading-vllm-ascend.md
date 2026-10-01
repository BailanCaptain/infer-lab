---
id: reading-vllm-ascend
title: 怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现
type: concept
summary: vllm-ascend 是装在 vLLM 上的昇腾平台插件，靠入口点、patch、custom op 等扩展点接进请求路径，所以一条请求跑的是两个仓库拼起来的代码。先沿七站读通主线，再按数据、配置、实现三条路线带着问题追；遇到异常或版本变化时先划清证据边界，区分源码推断和运行证据。
aliases: [源码阅读方法, 怎么读源码, 定位方法, 查代码, 版本对照, 读源码, 从报错找代码, 按符号对照]
chapters: ["20"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L76-L89
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L335-L346
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L700
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2427
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L234-L258
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L836-L868
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L951-L962
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1270-L1277
  - vllm-ascend@db701c1f:setup.py#L543-L551
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1556-L1562
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L604-L624
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L267-L267
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2053
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1616-L1629
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L75
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L92
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L96
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L287-L310
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L75-L75
verified: []
evidence: "C"
relations:
  - {to: vllm-ascend-overview, kind: builds-on, note: 先知道插件从哪几处接进 vLLM，才能判断读到的文件会不会被执行}
  - {to: vllm-ascend-repo-map, kind: builds-on, note: 用职责地图确定起始文件}
  - {to: ascend-patch-system, kind: builds-on, note: 理解直接绑定和注册分派如何改变实现}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 读 vllm-ascend 的源码之前：它是什么，怎样接进 vLLM

vllm-ascend 是 vLLM 的昇腾平台插件：一个单独安装的 Python 包，自己不起进程，而是借 vLLM 预留的扩展点，把「这一步在昇腾 NPU 上怎么算」换成自己的实现；「这一步算哪些请求、各算几个 token」仍由 vLLM 决定。

```wiki-diagram
file: ascend-vs-upstream
```

图中横线以上是 vLLM 自己的部分：接请求、排本步计划，再由 Executor（引擎里负责把计划发给各张卡的对象）发下去。横线以下是 vllm-ascend 提供的实现：worker 是守着一张卡执行模型的进程，每张卡一个；model runner 是 worker 里拼输入、跑前向的对象；它们调用 GLM 模型在 NPU 上把计划算完，再把结果交回引擎。实线是每一步都走的调用，虚线是启动时发生的登记、选择和替换。

它靠什么接进去？包的安装信息里登记了几条 entry point（入口点：包对外声明的「组名 → 入口名 → 要调用的函数」，别的程序按组名就能找到它）。vLLM 的前端、引擎和 worker 进程启动时，都按组名扫一遍这些登记（从装包到被发现、激活的过程见[插件发现与模型注册](platform-plugin-registration.md#发现过滤激活)）。平台组只有一条，交出昇腾平台类 NPUPlatform 的名字，由 vLLM 自己导入；此后 vLLM 遇到「用哪个 worker、哪个注意力后端、哪种通信」这类和硬件有关的问题，都去问它。

通用组的几条分别登记连接器、模型加载器、性能采集和模型实现，加载时还会打上一批 patch，也就是在进程里把上游的某些函数或类换成昇腾版。再算上 custom op（vLLM 允许硬件插件整体替换的那类层），vllm-ascend 进入请求路径的地方一共六处：平台、worker、注意力后端、custom op、patch、模型注册；每一处接在哪一站，见[一条请求的代码路径](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)。

对读代码来说，这意味着一条请求跑的是两个仓库拼起来的代码：HTTP 前端、引擎循环和调度器在 vLLM 仓库，worker、model runner、GLM 模型、注意力和算子在 vllm-ascend。两边还互相穿插：vLLM 文件里有些函数已被 patch 换掉，vllm-ascend 的类又继承 vLLM 的类，没重写的方法跑的仍是上游代码。所以读 vllm-ascend 从来不是只读一个仓库，也不能凭「文件在哪个仓库」判断它会不会执行。

## 为什么先抓一条请求的主线，而不是按目录读

仓库目录按职责分：平台、worker、注意力、算子、patch、模型各占一块，对应关系见[源码目录地图](vllm-ascend-repo-map.md)。目录不按执行先后排。从目录树往下读，看到的是一大片文件，不知道哪些会在你的请求里跑、谁先谁后，很容易在永远不会被调用的分支里读上半天。

一条请求真正经过的文件并不多。它走七站：入口、调度、准备输入、逐层前向、采样与草拟、结果更新、返回与收尾。两头四站主要在 vLLM 的前端和调度器文件里，中间三站集中在 vllm-ascend 的 model runner 文件、GLM 模型文件和注意力、算子目录。每一站在哪个进程、从哪个函数进、往下调谁，统一看[一条请求的代码路径](request-call-chain.md#七站逐站从哪个函数进往下调谁)。

主线读通以后，再看任何特性都有落点：一个开关、一个算子、一个 patch，都可以问「它在第几站生效、改了哪份输入或输出」。代价是主线只覆盖当前部署实际走到的分支；[PD 分离](pd-disaggregation.md)（prefill 和 decode 交给两组机器分别跑）、别的模型、没打开的开关都在主线之外，要到各自的特性页，按下面同样的路线补读。

## 带着问题读：先把问题写成输入和输出

「模型怎么推理」范围太大，读不出结论。把它拆成能验证的小问题：调度器交给 model runner 的到底是什么；拼好的四行输入为什么只采样两行；GLM 的 RMSNorm 最终调到哪个实现；某个配置值什么时候被覆盖。每个问题都落在一个[架构组件](vllm-v1-shape.md)上，对应一段数据变化。

先读本库相应的概念页，把数学或系统机制弄懂，再沿钉住版本的源码核实实现。读源码要回答四件事：输入是什么、输出是什么、保存了什么状态、在什么条件下生效；函数名列表只是导航。

```wiki-diagram
file: locate-routes
```

图里三列就是三条路线，按问题的类型选：问数据怎样变，沿请求数据往前追；问开关为什么这样生效，沿配置找到消费它的代码；问到底执行哪份实现，从模型里的调用追到登记和分派。三条路线最后落到同一种记录：固定版本、生效条件、源码范围和结果。

## 路线一：沿请求数据往前追

以[输入准备页](prepare-inputs-flow.md#ac-第三轮如何拼接)里 A、C 两条请求拼成一批的那一步为例：先记下调度器给每条请求安排了几个位置，再读 model runner 怎样据此造出 token 张量、位置数组和要采样的行，核对四行输入为什么只采样两行；然后沿前向调用进到模型层，确认它读哪些张量、返回哪些张量。

读的时候在笔记里留一张小表，每跨过一道边界填一行：

| 边界 | 输入 | 输出或副作用 | 在谁手里 |
|---|---|---|---|
| 调度结果 → 输入准备 | 请求进度、本步安排数量、块信息 | 本轮张量与元数据 | model runner |
| 输入准备 → 模型前向 | token 或 embedding、位置、历史状态 | 隐藏表示与更新后的状态 | 模型及注意力后端 |
| 隐藏表示 → 采样 | 选中的行、词表投影、采样配置 | 输出 token 或相关结果 | 执行侧 |

每道边界只往里展开一层，就能把新读到的代码放回整体架构。看到 NPU 算子调用时，再按问题决定要不要进设备实现；不必为了解释一次采样，通读整个算子目录。

## 路线二：沿配置找到真正消费它的代码

以 FlashComm1 的开关为例。FlashComm1 是 vllm-ascend 对[序列并行](sequence-parallel.md)的实现，开关键名是 `enable_flashcomm1`。第一步在钉住版本里搜这个键名，找到昇腾配置对象读取它的位置，以及旧环境变量的兼容映射。第二步读合并规则：启动参数的 JSON 里显式写了这个键就用它；没写就用环境变量读到的值，环境变量也没设时是读取器给的默认值。到这里，只弄清了字段的值怎样产生。

第三步搜这个字段的消费者，看它是否还受模型、设备、并行规模或运行模式限制。平台启动时还会继续检查、改写别的配置，例如重算调度器的开关：在 PD 分离的 prefill 节点上会被改回关闭并打警告；只有 decode 节点允许打开，没开 PD 分离或其他角色打开它会直接报错。所以完整路线是「输入 → 合并 → 校验或改写 → 消费条件 → 执行分支」，三路来源怎样合并、解析后又怎样被改写，见[配置系统](ascend-config-system.md#解析完还会被改写生效值不是你写的值)。

读一个函数时，还要看它的调用者。字段被读取，不等于它最终改变了张量或执行路径：有的消费者遇到某个条件就直接退出。

## 路线三：从模型里的调用追到最终实现

以 GLM 的归一化为例：模型的解码层里，对这一层的输入调用 input_layernorm。下一步看这个对象在哪里构造、构造的是哪个类，再查 custom op 的登记和方法分派：昇腾把上游的 RMSNorm 映射到自己的实现类。从这一行一直追到设备上的算子，完整过程见[从算子到设备](op-to-ai-core.md#glm-实际从哪里调用-rmsnorm)。

决定最终实现的，除了上面的 custom op 登记，还有模型注册、派生类、后端的直接绑定和运行时 patch。下一站由调用的写法决定，不要固定成「先查 patch 目录，没找到就读上游」。patch 目录本身按条件导入，例如按设备型号、按 vLLM 版本挑文件；找到 patch 文件以后，还要确认导入条件在你的环境里成立，确认方法见[Patch 机制](ascend-patch-system.md#排查时怎样确认跑的是哪一份代码)。

## 遇到异常：先划清证据的边界

一条 traceback 属于哪一站、日志前缀怎样认进程，按[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)去认。认完站以后，读的时候最容易越界的是下面几处。

Python 的 traceback 从外层调用一路列到异常发生的位置。先找到最初的那个异常和它的上下文，判断它属于输入处理、调度、模型执行、通信还是设备运行时。多个进程的日志会交错在一起；之后出现的进程退出、通信中断，常常只是连带结果。

离异常最近的那一帧如果在 vllm-ascend 里，它是调查的入口，但单凭它不能证明根因就在这个文件；反过来，栈里一帧 vllm-ascend 都没有，也不能证明昇腾的配置、状态或设备任务与问题无关。NPU 上的任务是异步提交的，错误在哪里被看到，取决于哪里做了同步。固定图的回放路径里就有这样的同步点：整图模式下，回放前先等当前流上已提交的任务全部做完，之前提交的任务出的错，要到这里才被报出来。所以报错的位置不一定是出错的位置。

记录实际版本、完整的首个异常、触发条件和最后成功的阶段，再设计能缩小范围的复现。没有设备、只读代码，能解释断言和调用条件，但不能把一个候选原因升级成已复现的根因。

## 对照版本时，比的是行为，不是行号

```wiki-diagram
file: ref-diff
```

图里的两个提交是示意，不对应某次具体发布。做法是：先固定两个完整的提交，在两边找到负责同一件事的文件和符号（类名、函数名），再比较输入、分支条件、状态更新和调用点。只比行号或文件长度，判断不了行为是否一致。

读某个提交里的一份文件快照，用 git show 加「提交:路径」；比较同一路径在两个提交之间的改动，用 git diff。文件被挪过位置时，要按符号去新提交里搜。发布说明或 PR 能解释为什么改，但目标提交里是否真的包含这个修复，仍要到那个提交里核。GLM 代码和配置入口在几个版本之间的实际变化，见页末[版本差异](#版本差异)。

读完写结论时，写成「在某个提交、某种设备和配置条件下，某个输入走进这个分支，产生这些结果」，并附上支持它的源码范围。来源里的限制、没装机验证、没实际跑过，也写在结论旁边，不把一条静态读出来的路径写成部署上的结果。

## 放到 GLM 双机：沿 R1 读一遍，先碰到什么

[R1](one-request.md#示例请求-r1-与官方双机部署) 是为了手算设的示例请求，提示词 4 个 token；它从入口走到返回，每一站的入口文件和函数在[一条请求的代码路径](request-call-chain.md#源码位置)已经按阅读顺序列好。在官方双机部署上照上面三条路线读，会先碰到下面几件事。

- **先定版本。** 控制流按 vLLM v0.23.0 读，执行侧按 GLM 专用镜像对应的那个固定提交读，这个提交不在社区的 v0.23、v0.26、main 任何一条线上。vllm-ascend 的 v0.23 维护分支和 v0.26 里都没有 GLM 模型代码，main 又把它拆成了一个目录，拿错版本就找不到文件。部署条件见[部署前提](glm-5-3-flash-two-node.md#部署前提)，基线提交见[来源基线](../sources/glm-5-3-flash-baseline.md)。
- **路线一。** R1 被分到 DP0，第 3 站由 node0 的 8 个 worker 各拼一份一模一样的输入，因为 TP8 下它们算的是同一批 token，只是各持一部分权重；逐卡走读见[输入准备在双机上](prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)。
- **路线二。** 官方启动命令没传昇腾的 JSON 配置，也没设对应的环境变量，所以 FlashComm1 取默认值，是关的，判断序列并行是否启用的函数返回假。读到任何开关，都先回到[这份默认基线](ascend-config-system.md#落到-glm-双机一个-json-键都没传)对齐。
- **路线三。** GLM 的解码层在 vllm-ascend 自己的模型文件里，RMSNorm 经 custom op 登记换成昇腾实现。GLM 的稀疏 MLA 却不查平台那张「按注意力类型选后端」的表，由层自己给出后端；照「先查平台表」的习惯读，读到的就不是 GLM 实际用的后端，见[六个口子](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)第 3 条。
- **异常。** node1 没接到 R1，也要陪着跑 MoE 通信；集合通信要组内成员到齐才结束，一张卡卡住会让别的卡一起超时，所以报错的那张卡不一定是根因。认日志前缀、判断超时的方法见[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)。

## 常见误解

- **「vllm-ascend 是一份改过的 vLLM，读它一个仓库就够了」**——它是装在 vLLM 上的插件，不单独起进程；引擎循环、调度器、HTTP 前端都是 vLLM 的代码，只是其中一部分被 patch 换过。
- **「从目录树开头往下读最系统」**——目录按职责分，不按执行顺序；先沿一条请求读通主线，再按职责补读。
- **「代码里读到了这个字段，开关就生效了」**——还要看合并、平台改写和消费者的条件；有的消费者遇到某个条件就直接退出。
- **「patch 目录里搜不到，就一定是上游的行为」**——模型注册、派生类、后端绑定和 custom op 都能换掉实现；patch 文件本身也有导入条件。
- **「栈里离异常最近的 vllm-ascend 帧就是根因」**——它只是入口；异步执行让错误在同步点才被看到，多进程下它还常常只是连带结果。
- **「两个版本同一个文件、行号差不多，行为就一样」**——要按职责和符号对齐后，比输入、分支和状态更新；GLM 的模型文件在 main 上连位置和类名都变了。

## 对照源码

### 怎么开

vllm-ascend 装上即生效，没有开关：装包时登记的入口点让 vLLM 的前端、引擎和 worker 进程在启动时找到它 [C12]。读代码要「打开」的是钉住的那几份提交：控制流读 vLLM 的 `0fc695fc`（v0.23.0），执行侧读 vllm-ascend 的 `db701c1f`。工作树检出的往往不是这份提交，所以一律按提交号读，命令见[源码位置](#源码位置)。

### 会报什么错

下面是照三条路线读时，和读法直接相关的日志与报错；请求在运行时各站的报错串见[一条请求的代码路径](request-call-chain.md#会报什么错)。

| 看到的 | 说明什么 | 对应 |
|---|---|---|
| `AscendConfig.enable_flashcomm1 is set from additional_config with value ...` | 值来自 JSON 键 | 路线二的合并规则 |
| `AscendConfig.enable_flashcomm1 falls back to environment variable VLLM_ASCEND_ENABLE_FLASHCOMM1 ...` | 没写 JSON 键、设了环境变量，值取环境变量 | 同上 |
| `recompute_scheduler_enable is ignored on PD-disaggregated P nodes ...` | 平台把 prefill 节点上的重算调度开关改回关闭 | 路线二的平台改写 |
| `recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...` | 不是 decode 节点却打开了重算调度，启动即失败 | 同上 |
| main 上的 `FlashComm is deprecated; remove enable_flashcomm1 ...` | 这个键在 main 已弃用 | [版本差异](#版本差异) |
| `fatal: path 'vllm_ascend/models/glm5_next.py' does not exist in 'baa023ad'` | 拿基线的路径去读别的提交；GLM 文件在 main 上挪进了 glm5next 目录 | 同上 |

### 开销和什么时候别开

沿主线读，时间主要花在对齐版本和追分派上，换来的是只读实际会执行的分支。以下情况不能只靠主线：

- 要看的开关在本部署没开，例如 FlashComm1、重算调度器，主线根本走不到那条分支，要从该特性页的「怎么开」读起。
- 要看 PD 分离或别的模型，七站的入口仍然可用，但每一站选中的实现要沿路线二、三重新确认。
- 要下根因结论，只读代码不够，还要实际运行的日志或能复现的步骤。

### 版本差异

GLM 基线的完整版本表（entry point、patch 文件数等）见[vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md#版本差异)。和上面三条路线直接相关的是下面三项：

| 项 | v0.23 维护 `2c59ff10` | GLM 基线 `db701c1f` | v0.26 `2ed6cbba` | main `baa023ad` |
|---|---|---|---|---|
| GLM 模型代码（路线一、三的落点） | 无 | `models/glm5_next.py` 等三个文件，解码层类 `AscendGlm5NextDecoderLayer` [C16] | 无 | 目录 `models/glm5next/`，解码层类 `Glm5NextDecoderLayer` 在 `model.py` [C15] |
| 配置合并（路线二） | 与基线相同 | `AscendConfig._get_config_value`：JSON 键优先，否则取环境读取值 | 与基线相同 | 没有这个函数；`enable_flashcomm1` 已标弃用，写了会打警告 [C13]，进严格校验前被从 JSON 里剔除 [C17]；派生校验阶段仍另读这个键和环境变量，判断 FlashComm 是否生效 [C14] |
| 算子登记（路线三） | 与基线相同 | `REGISTERED_ASCEND_OPS` 把 `RMSNorm` 映射到 `AscendRMSNorm` | 与基线相同 | 与基线相同 |

「与基线相同」是逐提交搜函数名、键名和登记表核对的 [D]；「无」是列 models 目录核对的 [D]。所以同一条路线在 main 上仍然成立，只是按名字搜到的第一站变了：这个开关的读取点从配置对象的构造挪到了派生校验里，GLM 的类名也去掉了 Ascend 前缀 [D]。

### 源码位置

均为 GLM 基线 `db701c1f`，另注的除外。三条路线和七站编号是阅读上的划分，源码里没有叫这个名字的东西 [A]；A、C 两条请求是输入准备页为手算设的示意 [A]。

- 插件入口：`setup.py` 的 entry point 两组 [C12]。
- 路线一：`vllm_ascend/worker/model_runner_v1.py` 的 `_prepare_inputs` 中造位置、token 与采样行的几段 [C9][C10][C11]；`execute_model` 收尾到 `sample_tokens` 一段 [C6]。
- 路线二：`vllm_ascend/ascend_config.py` 里读 `enable_flashcomm1` 与环境变量兼容映射 [C1]、合并函数 `_get_config_value` [C2]；`vllm_ascend/platform.py` 里平台对重算调度开关的检查与改写 [C3]。环境读取器给这个开关的默认值是 0，即关闭 [C22]；本部署 FlashComm1 关闭，是「命令没传 JSON、没设环境变量」加上合并规则和这个默认值推出来的 [D]。
- 路线三：`vllm_ascend/models/glm5_next.py` 解码层对输入调用 `input_layernorm` [C5]；`vllm_ascend/utils.py` 的 `REGISTERED_ASCEND_OPS` 登记表 [C4]；`vllm_ascend/patch/platform/__init__.py` 按设备型号与 vLLM 版本条件导入 [C8]。
- 异常一节：`vllm_ascend/compilation/acl_graph.py` 里 `ACLGraphWrapper.__call__` 回放前的同步 [C7]。

以下命令在 vllm-ascend 仓库里运行。已检出目标版本的工作树可以直接用 rg 搜文本；工作树不是目标版本时，改用固定提交查询，避免混进另一分支的结果：

```sh
git grep -n enable_flashcomm1 db701c1f -- vllm_ascend
git show db701c1f:vllm_ascend/ascend_config.py
git diff db701c1f baa023ad -- vllm_ascend/ascend_config.py
```
