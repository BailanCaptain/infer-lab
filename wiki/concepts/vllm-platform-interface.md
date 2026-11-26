---
id: vllm-platform-interface
title: Platform：硬件适配的接口契约
type: concept
legacyAnchors:
  放到-glm-双机请求到来前平台先做什么: 复杂异构实战对照：GLM 双机启动时的平台问答
summary: >-
  Platform 约定上游怎样询问设备属性、校验配置和选择执行实现；沿服务启动全流程分清平台、Worker 与模型的职责，并以 Qwen3-8B
  标准单机与 GLM 双机对照说明主机内存、设备显存和 token 预算的边界。
aliases:
  - Platform
  - current_platform
  - 平台抽象
  - platform_plugins
  - 硬件插件接口
  - OOT
  - 平台契约
  - UnspecifiedPlatform
chapters:
  - '10'
order: 70
sources:
  - 'https://docs.vllm.ai/en/v0.23.0/design/plugin_system/'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L105-L164'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L259-L266'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L428-L468'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1335-L1353'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L618-L652'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2492-L2553'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L204'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L282'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L678'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L67-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L223-L233'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L282'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L659-L671'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L127-L281'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L621-L633'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L238'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L513'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1232-L1252'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L255-L268'
  - 'vllm@568afb3a:vllm/platforms/interface.py#L546-L586'
  - 'vllm@84030bbe:vllm/platforms/interface.py#L546-L586'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2444-L2479'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2693-L2738'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L203-L252'
  - 'vllm@0fc695fc:vllm/platforms/cuda.py#L162-L170'
  - 'vllm@0fc695fc:vllm/platforms/cuda.py#L228-L236'
  - 'vllm@0fc695fc:vllm/platforms/cuda.py#L445-L452'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L866-L873'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - 'vllm@84030bbe:vllm/platforms/__init__.py#L231-L258'
  - >-
    raw:sha256-40eab395fbb374101ebfaf76ed8f1ca73256d795704965948146abde69fc2992.md#L1-L1384
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L85-L99'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L232-L244'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1346-L1368'
  - 'vllm@ced6857a:vllm/platforms/__init__.py#L233-L286'
  - 'vllm@ced6857a:vllm/platforms/interface.py#L134-L1337'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L41'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L1055-L1057'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L232-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1365-L1375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L260-L273'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L683'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1570-L1580'
  - 'vllm@ba15685a:vllm/platforms/__init__.py#L240-L315'
  - 'vllm@ba15685a:vllm/platforms/interface.py#L137-L1511'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L2985-L3030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 先看请求调度与设备执行如何分工，再定位平台接口
  - to: vllm-ascend-overview
    kind: builds-on
    note: 先从插件总览看清五个扩展点的分工，再深入平台层的方法契约与仲裁规则
  - to: platform-plugin-registration
    kind: builds-on
    note: 继续追踪当前平台如何从已安装插件中被发现和选中
  - to: hardware-devices
    kind: builds-on
    note: 分清软件设备、板卡和服务器，理解平台报告的设备身份
  - to: device-memory
    kind: builds-on
    note: 分清主机内存与设备显存的账目边界，理解设备总内存查询与运行时显存画像的分工
contradicts: []
updated: '2026-11-26'
origin: gap
rawSources:
  - >-
    raw/sha256-394d434148e7b68b9d5d740e20e781d862faf90bbdfc3128480e86c400ec7ce1.md
  - >-
    raw/sha256-40eab395fbb374101ebfaf76ed8f1ca73256d795704965948146abde69fc2992.md
---

## 换一种设备，vLLM 怎样知道该用哪套实现？

**Platform 是上游与硬件适配代码之间的接口契约：约定怎样询问设备属性、检查配置、选择实现，由当前平台回答。** 设备指执行计算的 GPU、NPU 等；保存计算数据的内存分主机 CPU 使用的内存和设备显存。token 是分词后的基本单位，用编号表示；编号转成向量后参与矩阵（按行列排列的数）计算。平台负责选实现，模型与算子负责算。

```wiki-diagram
file: platform-hooks
```

图左边是提问的一侧，右边两列是同一组问题的两份答案。换一台机器只换选中的那一列，上游提问和调用的代码一行不动。浅框圈住的是同一组方法——契约由基类定义，不是调用路上要经过的一站，运行时上游直接调用选中平台的方法。答案里的“实现类路径”只是告诉上游去哪里创建执行组件。昇腾的实现叫 [NPUPlatform](npu-platform.md)，NPU 是昇腾的 AI 计算设备。

## 为什么需要这层接口，代价在哪里？

同一套推理服务引擎要能接不同设备，设备名称、支持的数值精度、执行组件和注意力实现却会变化。把这些选择集中到平台，上游（vLLM 本体代码）就只写提问，不写某种设备的答案；插件（按设备提供实现的安装包）也有明确的适配入口。

**看成一张填空题更直接。** 上游只管提出固定问题，不同平台各填一列答案：

- **设备类型叫什么**：自带的 CUDA 平台答 `cuda`，昇腾平台答 `npu`。
- **限制可见设备的环境变量是哪个**：前者是 `CUDA_VISIBLE_DEVICES`，后者是 `ASCEND_RT_VISIBLE_DEVICES`。
- **自动选哪个 Worker 类**：前者给上游的 GPU Worker，后者给 `NPUWorker`。
- **设备间通信用哪个通信器类**：前者给 `CudaCommunicator`，后者给 `NPUCommunicator`。

换一种设备只换这一列答案，提问的上游代码一行不动。

通信后端名可以由平台字段提供：基类留了 `dist_backend`，CUDA 平台填 `nccl`。固定昇腾实现没有填写这个字段，`hccl` 这个名字由 `NPUWorker` 建通信组时给出，平台则交出通信器类。要判断某个设备相关行为归谁，先看它是平台的属性、平台返回的类路径，还是 Worker 自己写的参数。

**代价主要是兼容和时序约束。** 平台方法按各自职责改写配置、注册类型，或因组合不受支持而报错。上游改了接口签名、调用顺序或返回值要求，插件就要同步适配。返回组件路径本身不增加一次卡间通信；真正的通信和等待发生在后续 Worker 建组及模型计算中，应沿[调用链](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)核对。

| 组件 | 在这条路径上负责什么 |
|---|---|
| Platform | 报告设备属性，校验配置，给出设备实现的选择 |
| Worker | 管设备执行环境，建通信组、加载权重、量显存 |
| Runner | 组织本轮输入张量和跨轮状态，驱动模型执行 |
| 模型与算子 | 用权重完成矩阵乘、注意力等计算 |

注意力是从历史信息中提取当前所需内容的计算；**后端**是这类计算在某种设备上的具体实现。选择后端和运行后端是两个阶段：返回类路径时，尚未执行这一层的矩阵运算。

## 当前平台是怎么选出来的？

**固定上游先逐个调用五个内置候选（`tpu / cuda / rocm / xpu / cpu`）与已加载的外部平台入口，按优先级仲裁出一个，创建对象后缓存在当前进程。** 这里的「激活候选」仅指入口返回非 `None` 的类路径：昇腾入口不探测硬件、直接交回 `NPUPlatform` 类路径，因此选中它并不证明 NPU 已初始化或可用。选中后上游还会再次调用其入口取类路径。

```wiki-diagram
file: vllm-platform-interface-fig-contract
```

仲裁遵循四条固定规则（`v0.30.0` 与 `main` 额外为显式 CPU 目标开了直通例外，不再被外置插件无条件压过）：

1. **恰好 1 个外部插件激活**：直接胜出，压过所有内置候选（昇腾镜像走此分支）。
2. **无外部插件，恰好 1 个内置候选激活**：选中该内置候选。
3. **同级 $\ge 2$ 个候选激活**：抛 `RuntimeError` 停机（已有唯一外部插件时，内置候选冲突不再触发报错）。
4. **0 个候选激活**：返回 `UnspecifiedPlatform`（此处不报错，但设备类型为空，后续需要具体设备实现的调用会失败）。

整个解析是**懒加载**：首次访问 `current_platform` 才运行仲裁并缓存进模块级变量。因为外部插件自己必须先 `import Platform` 才能继承基类，不能在模块导入瞬间就锁死平台。随版本演进，`Platform` 基类方法已从 `v0.23.0` 的 78 个扩至 `v0.30.0` 的 84 个、`main` 的 92 个，`vllm/` 核心包内的 `current_platform.` 引用扩至 1,902 行（636 个文件）。

入口点发现与 `VLLM_PLUGINS` 白名单过滤归安装与注册层，见[插件注册](platform-plugin-registration.md#发现过滤激活)；本页只管候选选出后的仲裁与缓存。

## 主机内存、设备显存和 token 预算怎样分账？

**容量查询、运行时量显存和调度预算回答的是三个问题。** 平台的设备总内存接口约定返回设备容量的字节数；Worker 运行假输入后估计可用于历史状态的显存；调度预算则限制这一轮处理多少 token。KV cache 是留下供后续生成复用的历史计算状态，占的是设备显存。

| 账目 | 记录的内容 | 不能混入的量 |
|---|---|---|
| 主机内存 | 请求记录、编号列表、进程间共享队列等 CPU 侧对象 | 不能加到某张卡的可用显存里 |
| 设备显存 | 本卡权重、运行中间张量、通信缓冲和 KV cache 等 | 不能用主机空闲内存替代 |
| token 预算 | 本轮允许处理的输入位置数 | 不能当作缓存块大小或内存字节数 |

**默认预算路径的启动顺序是：加载权重 → 用假输入测量占用 → 分配 KV cache → 按执行模式预热或捕获图。** 执行图是预先记录、以后可以回放的设备计算步骤；强制 eager 时会跳过捕获入口。由于激活峰值在捕获图之前记录，不能把后来捕获图的占用说成已包含在这次测得的峰值里。主机到设备的数据搬运见[设备内存](device-memory.md)。

**边界与例外（设备总内存查询）**：
- **旧版固定昇腾实现**：设备总内存接口一律报不支持，不分早晚。代码注释的理由是，实现它会顺带过早初始化设备运行库，而该库只允许初始化一次。
- **上游回退行为**：上游捕获异常后写入的容量占位值只供默认档位选择，不表示卡没有显存。查询失败后如何选回退档、后续受哪些参数收窄，见 [NPUPlatform 页](npu-platform.md#默认预算为何不能只看一个数字)。
- **`v0.30.0` 与 `main` 守卫式查询**：改为设备未初始化前仍抛不支持异常，初始化后才读 `torch.npu.mem_get_info`（见[版本差异](#版本差异)），不能倒套到固定旧镜像。真正的 KV 容量仍在 Worker 环境就绪、权重加载后，按占用测量与缓存规格确定。

拿 `v0.30.0` 单机启动标准稠密模型 **`Qwen3-8B`**（36 层 GQA，BF16）串一遍常规平台问答：`current_platform` 懒加载选中唯一外部候选 `NPUPlatform`（`device_type = "npu"`），再由 `pre_register_and_update` 打上全局补丁并注册昇腾量化项。随后 `check_and_update_config` 校验并行与图配置，按 `HardwareProfile.default_worker_cls` 选定 `NPUWorker`；模型建层时 36 层全部通过 `get_attn_backend_cls` 落到统一的 `AscendAttentionBackend`，无需任何模型私有的层绑定。

## 复杂异构实战对照：GLM 双机启动时的平台问答

**平台在服务接请求前的启动阶段确定设备适配，后续组件才把它落实成可接收请求的服务。** 本节挂靠服务接请求以前的[部署启动](glm-5-3-flash-two-node.md#启动时发生了什么)。[官方双机部署](glm-5-3-flash-two-node.md#部署前提)用两台 A2、每台 8 卡；卡如何分组、每卡放什么以及完整显存与块数账仍见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，这里沿启动时序核对平台问答。

### 先确定平台，再准备配置

**上游先取得当前平台，再通过它准备类型注册、汇集并校验配置。** 当前平台是按需解析并保存在当前进程里的对象；它不是独立进程，也不是每来一个 token 就重新选一次硬件。

图中 `VllmConfig` 是汇集模型、并行、缓存等选项的配置对象，`NPUWorker` 是管理昇腾设备执行环境的 Worker 实现。图展开平台交接这一段；完整进程创建和函数链见[调用链页](request-call-chain.md#七站逐站从哪个函数进往下调谁)。

```wiki-diagram
file: platform-startup-contract
```

1. **取得当前平台。** 昇腾入口成功加载并返回类路径，按[前面的选择规则](#当前平台是怎么选出来的)成为唯一激活的外部候选，选中结果供本进程后续调用点使用；设备是否可用由后续初始化与执行检验。入口点怎么被发现见[插件注册](platform-plugin-registration.md#发现过滤激活)。
2. **做配置前的准备。** 昇腾平台应用全局补丁、准备量化类型，并在带命令行解析器的路径中补入昇腾量化选项。官方双机启动命令写的 `--quantization ascend` 正是这里补进选项表的，否则解析阶段就会认不出这个取值。这个名称选择昇腾量化实现，不表示模型内所有张量都变成 8 位；各矩阵的精度见[量化页](quantization.md)。注册让后续配置能识别这些名称，能否执行还要看权重格式与设备实现。
3. **校验并改写汇总配置。** 上游在配置构造后段调用平台；平台读取跨配置条件，可以拒绝不兼容组合，也可以就地调整对象。自动选择 Worker 时，本部署的常规 A2 路径选择 `NPUWorker`；其他设备或执行模式可走不同分支。
4. **让选中的组件继续启动。** Worker 初始化设备、建立 HCCL 通信组，再加载模型。HCCL 是昇腾设备间收发数据和共同计算结果的通信库。模型建层时按需要获取注意力后端；GLM 的一些层还会直接指定自己的后端。

### 本部署里 NPUPlatform 具体回答了哪几件事

**把上面的提问换成这套双机部署的实际答案，平台的职责范围就清楚了。**

| 上游问的 | 本部署得到的答案 |
|---|---|
| 平台身份与设备类型 | OOT（out-of-tree，仓库外独立维护的插件平台），设备类型 `npu`；算子分派键 `PrivateUse1`，PyTorch 按它把算子交给昇腾后端 |
| 限制可见设备的环境变量 | `ASCEND_RT_VISIBLE_DEVICES`，每机 8 卡由它划定 |
| 允许的量化取值 | 含昇腾量化名，对应启动命令的 `--quantization ascend` |
| 自动选哪个 Worker 类 | 常规 A2 路径选 `NPUWorker`，310P 与 xlite 走别的分支 |
| 设备通信器类 | `NPUCommunicator`；`hccl` 这个后端名由 `NPUWorker` 给出 |
| 设备总内存有多少 | 固定实现一律报不支持，后果见[分账一节](#主机内存设备显存和-token-预算怎样分账) |
| 注意力后端用哪个 | 按 MLA（多头潜在注意力）、稀疏等条件返回昇腾实现的类路径 |

平台的身份字段不能直接给出完整部署结果：卡怎么分组、每步的 token 预算、KV cache 占多少，需要合看启动参数、平台配置调整与后续消费者。[官方命令](../sources/glm-5-3-flash-baseline.md)显式写了每步 8192 token 的预算：上游照样查询、照样在失败后选出回退档，但只有用户未填写时才用默认档补值，本部署保留显式值。

### 校验通过后，配置仍可能继续变化

**平台校验是一个阶段，最终值要追到消费者。** 固定上游在平台校验之后还会重算编译范围；多进程 Worker 初始化并加载模型后，又有依据注意力后端更新块大小的调用点。该调用是否改值取决于平台实现，不能把它当成必然发生的第二次改写。

配置构造还包含一项条件性检查：平台校验之后，如果启用了第二代 Model Runner（在执行侧准备输入并组织模型计算的组件），会先执行它的专门验证，再重新计算编译范围。因此，平台校验通过并不代表这项后续验证也已通过；其他 Runner 不因此自动进入这条第二代实现的验证分支。

对一个启动参数，应区分“用户输入”“汇总配置中的值”“Worker 最终使用值”。平台的设备属性是读取结果，昇腾的准备钩子执行类型注册，配置钩子可以原地修改对象，后端选择则返回实现类路径；把这些接口都理解成只读查询，会漏掉启动中真正改变行为的位置。

### 从平台选择走到一个 token 的计算

**token 真正到来时，已经选好的 Worker 和 Runner 接住调度计划。** 文字先在主机上变成编号序列，Runner 把本轮编号、位置和状态索引组织成输入张量，模型再把编号映射为向量，送进各层矩阵计算。具体输入和计算形状沿[一条请求](one-request.md)往下读。

平台有通用注意力选择接口，但模型也能直接绑定专用后端。固定 GLM 实现中，索引器配套的注意力类直接指定自己的后端，KDA（用固定状态概括历史的注意力）也提供专用后端入口。要确认某层最终跑谁，应同时看调用点、平台返回值与模型绑定，细节见[注意力后端](attention-backend-family.md)。

## 常见误解

- **“Platform 就是设备驱动，会替模型算矩阵。”** 它提供软件适配契约；Worker、Runner、模型和算子沿选定路径完成执行。
- **“总内存查询失败，说明 NPU 不可用。”** 固定实现对这次查询一律报不支持，上游有默认档位回退；后续初始化和实际分配才检验设备是否可用。
- **“配置校验结束，参数就冻结了。”** 后端相关调整可以发生得更晚，要核对消费位置及此前的所有写入。
- **“接口存在，所有设备和配置组合就都支持。”** 接口提供共同调用形式，具体实现决定支持范围；基类方法也可能为空实现或报告不支持。
- **“选中一个通用注意力后端，就知道 GLM 每层的实现。”** 还需检查模型的专用绑定，尤其是索引器配套注意力和 KDA。

## 对照源码

### 怎么开

Platform 是框架基础设施，没有独立的性能开关。安装与上游版本匹配的硬件插件后，由插件选择得到 `current_platform`。Ascend 使用 `PlatformEnum.OOT` 表示仓库外平台，设备类型为 `npu`；普通 A2 路径在 `worker_cls="auto"` 时选中 `vllm_ascend.worker.worker.NPUWorker`。

| 契约或调用点 | 固定参考中的含义 | 来源序号 |
|---|---|---|
| `pre_register_and_update(parser)` | 配置构造或参数解析前准备；Ascend 执行补丁和量化注册 | 5、11 |
| `check_and_update_config(config)` | 就地校验、调整配置；上游调用后还会重算编译范围 | 5、7、13、14 |
| `get_attn_backend_cls(...)` | 接收后端选择条件，返回实现类路径 | 4、15 |
| `get_device_total_memory()` | 约定设备总容量，Ascend 固定实现主动抛错 | 9、12 |
| `update_block_size_for_backend(config)` | Worker 加载模型后的后端相关调整入口 | 8 |
| `resolve_current_platform_cls_qualname()` | 探测五个内置候选与外部插件，按外部优先挑一个 | 31 |
| `get_device_communicator_cls()` | 返回设备通信器类；Ascend 给 `NPUCommunicator` | 34、35 |

### 会报什么错

固定镜像的 `get_device_total_memory()` 无条件抛 `NotImplementedError`；上游默认预算路径会捕获它。若在其他调用点直接调用且没有回退，异常仍会向外传播。main 在设备未初始化时附带原因：`NPU total memory is unavailable before torch_npu initialization`。

平台选择自己也会报错。两个外部平台插件同时激活时，会抛 `RuntimeError: Only one platform plugin can be activated, but got: [...]`，启动直接停下；只有在没有外部平台候选时，多个内置候选才进入冲突判断。若只有一个外部平台候选，即使同时存在内置候选，也选择这个外部平台。一个都没激活时，选择函数返回 `UnspecifiedPlatform`，后续要求具体设备实现的调用可能失败。多候选冲突应检查激活了哪些入口；无候选则要依次检查安装声明、白名单过滤、入口导入和探测异常，不能只凭这个结果断定漏装。选中后的入口再次调用、类导入或实例构造也可能失败，这些不属于第一轮探测中被忽略的异常。

配置校验也可能抛 `ValueError`。例如固定 Ascend 的 `enable_balance_scheduling` 只接受未配置 KV 传输或混合角色，显式分离的生产者／消费者角色会被拒绝；定位见来源 14 的角色检查。查错时先判定是属性查询、配置组合、类导入还是设备执行阶段，勿把所有失败都归为硬件故障。

### 开销和什么时候别开

没有可单独关闭的“平台层开销”。应核对注册时机、配置改写和所选组件的运行成本。当前平台成功解析并缓存后，同一进程的后续访问不再重跑；若解析或构造失败、缓存仍为空，就不能据此保证它只尝试一次。代价是解析发生在首次访问时，平台入口必须在那之前可被发现。设备查询失败后上游怎么选调度预算的回退档，在 [NPUPlatform 页](npu-platform.md#默认预算为何不能只看一个数字)推导，本页不重复；本部署的每步 token 预算是启动命令显式给的，回退档不参与。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同属此分支期）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 与 `main` 均保留 `PlatformEnum.OOT` / `npu` 身份与 `HardwareProfile.default_worker_cls` 选类逻辑；上游 `Platform` 抽象接口在 `v0.30.0` 扩至 84 个方法，在 `main` 进一步扩至 92 个方法、`current_platform.` 引用达 1,902 行 / 636 个文件。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 平台身份与核心契约 | OOT / `npu`；准备与配置钩子 | 相同契约 | 相同契约；配置校验拆分至辅助函数（`platform.py#L478-L525`） | 相同契约；入口先调 `apply_v2_model_runner_config_patch()` 与 `sync_v2_extra_kwargs`（`platform.py#L606-L683`） |
| 自动 Worker 选择 | 按设备和 Xlite 分支；常规 A2 用 `NPUWorker` | 同左 | 取 `HardwareProfile.default_worker_cls`（`#L1365-L1375`）；Xlite 受能力与开关双门控 | 延续 `HardwareProfile.default_worker_cls`（`#L1570-L1580`） |
| 设备总内存查询 | 无条件抛 `NotImplementedError` | 无条件抛 `NotImplementedError` | 未初始化抛 `NotImplementedError`，初始化后读 `torch.npu.mem_get_info`（`#L232-L245`） | 延续守卫式查询（`#L260-L273`） |
| 查询失败后的默认预算 | 走回退档（API 服务起点 2048），推导见 [NPUPlatform 页](npu-platform.md#默认预算为何不能只看一个数字) | 相同 | 上游新增 ≥160 GiB 大档（16384），但查询失败仍落回 `else` 小档（API 服务起点 2048） | 延续三档结构（另增 GB10 判断），未初始化查询失败仍回落 `else` 小档（`arg_utils.py#L2985-L3030`） |
| 当前平台选择规则 | 逐个探测，单 OOT 优先；同类冲突报错，无候选落 `UnspecifiedPlatform` | 相同 | 新增显式 CPU 目标直通与探测异常 debug 日志（`platforms/__init__.py#L233-L286`） | 延续显式 CPU 目标直通与探测日志（`platforms/__init__.py#L240-L315`） |
| `Platform` 类体方法数 | 78 | 82 | **84**（`interface.py#L134-L1337`） | **92**（`interface.py#L137-L1511`） |
| `vllm/` 下 `current_platform.` 引用规模 | 873 行、311 个文件 | 1,069 行、362 个文件 | **1,498 行、496 个文件** | **1,902 行、636 个文件** |
| 独立平台开关 | 无；当前平台随运行环境懒解析 | 相同 | 相同 | 相同 |

方法数与引用数为静态源码计数：方法数统计 `class Platform:` 到 `class UnspecifiedPlatform` 之间四空格缩进 `def` 数量；引用数按 `git grep 'current_platform\.' -- 'vllm/*.py'` 统计行数与文件数 [D]。接口持续扩张而非冻结，“相同契约”只说明本页核对的核心方法未变，不代表 84 / 92 个方法全部逐一冻结。

四版都保留通用后端选择入口（`main` 的 `get_attn_backend_cls` 进一步校核 `supports_kv_cache_dtype`）；完整后端能力表见[注意力后端页](attention-backend-family.md)。固定 GLM 镜像 `db701c1f` 的内存无条件拒答与 A2 Worker 选择与 `v0.23.0` 一致，不能把 `v0.30.0` / `main` 的守卫式查询倒套回固定镜像。

### 源码位置

下列来源序号对应页头 sources；多文件共同支持的结论按职责归组，便于追到调用方和实现方。

- **插件与契约边界**：官方 Plugin System 的平台插件指南说明平台继承、设备属性、Worker 类选择与后端路径返回；同页还说明多进程加载和插件兼容约束。来源 1。[S1]
- **双机落点**：官方 GLM 教程规定两台 A2 的启动方式与显式参数；本页仅引用部署结论，容量推导回链部署页。来源 2。[S2]
- **属性、返回值和副作用**：来源 3–5 是 Platform 定义，来源 6 是当前进程的惰性解析；来源 7–8 给出配置与 Worker 的实际调用点。[C5]
- **默认预算与回退**：来源 9–10 给出查询异常回退及后续预算调整；固定 Ascend 的主动拒绝见来源 12。[C9]
- **Ascend 准备与选择**：来源 11、13–15 对照准备钩子、配置检查、Worker 分支与注意力映射。[C14]
- **显存账与专用绑定**：来源 16 覆盖 profile、显式 KV 字节预算分支及图捕获前的峰值口径；来源 17–18 是 GLM 索引器注意力、KDA 专用后端入口。[C16]
- **三版本对照**：来源 19–22 核对发布分支，23–26 核对 main 的查询守卫、配置拆分和 A2 默认 Worker；27–28 核对上游契约，29–30 核对默认预算回退。[C23]
- **当前平台的选择规则**：来源 31 是内置候选表与选择函数，含两处冲突报错和 `UnspecifiedPlatform` 兜底；懒加载与缓存在来源 6；main 的显式 CPU 目标直通与探测失败日志见来源 37。[C31]

来源 6 的惰性解析注释说明：外部平台要先导入基类再定义自己的平台，因此模块导入时不能立即定下当前平台。“树外”只描述适配代码位于上游仓库之外，不表示绕过接口；通用插件与平台插件也不能依赖固定的初始化先后顺序。
- **同一组问题的两份答案**：来源 32–34 是上游 CUDA 平台的设备身份、自动 Worker 与通信器类，来源 11、14、35 是昇腾侧的对应回答；hccl 后端名由 NPUWorker 给出，见来源 36。[C35]
- **候选与设备就绪的区别**：来源 44 的 Ascend 入口只返回类路径；来源 46 的未指定平台仍继承基类。来源 45 给出强制 eager 跳过图捕获的实际条件。

**待核**：本页未取得固定镜像内部上游安装产物的对应关系与 NPU 实测日志，因此没有平台钩子耗时或主机／设备实际峰值；版本组合的证据边界保留在来源基线。这里核实的是固定提交的代码路径。

固定上游在平台检查后，仅 use_v2_model_runner 为真时调用 V2 Runner 校验，随后设置编译范围。调用顺序本身不说明固定部署选择了 V2 Runner，也不证明其他版本采用同样流程。[C7]

固定上游 0fc695fc 的平台解析先判断外部候选：多个外部候选冲突，单个外部候选优先；没有外部候选才检查内置候选冲突。没有任何候选时采用 UnspecifiedPlatform。平台入口被选中仍不等于设备初始化成功。[C31]

通用插件与平台插件的初始化不能依赖固定先后顺序；树外适配应在各自入口满足自己的初始化条件。完整加载链与进程边界见[插件注册](platform-plugin-registration.md)。
