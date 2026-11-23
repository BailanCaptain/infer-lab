---
id: platform-plugin-registration
title: 插件发现与模型注册
type: feature
legacyAnchors:
  放到-glm-双机请求到来前五个入口做了什么: 复杂异构实战对照：GLM 双机启动前的五个入口与 19 次登记
summary: >-
  昇腾包通过入口点清单接入 vLLM；入口须被允许加载并成功执行，设备可用性另行检查。vLLM
  在相应进程的初始化入口按组名加载——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型实现；次数取决于启动方式与进程内防重状态。
aliases:
  - entry point
  - entry_points
  - vllm.platform_plugins
  - vllm.general_plugins
  - 插件注册
  - VLLM_PLUGINS
  - 平台插件
  - 通用插件
  - platform plugin
  - general plugin
  - IO Processor plugin
  - vllm.io_processor_plugins
  - vllm.stat_logger_plugins
chapters:
  - '10'
order: 50
sources:
  - 'vllm-ascend@db701c1f:setup.py#L543-L551'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L35'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L41'
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L44-L75'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L25'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L39-L39'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L274-L281'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L33-L34'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L12-L25'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L28-L66'
  - 'vllm@0fc695fc:vllm/plugins/__init__.py#L69-L82'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L212-L252'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L744-L747'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L245-L247'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2578-L2585'
  - 'vllm@0fc695fc:vllm/model_executor/models/registry.py#L1406-L1411'
  - 'vllm-ascend@2c59ff10:setup.py#L543-L551'
  - 'vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L72-L75'
  - 'vllm-ascend@2ed6cbba:setup.py#L543-L551'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L72-L85'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/hunyuan_vl_processor_compat.py#L8-L8'
  - 'vllm-ascend@baa023ad:setup.py#L506-L517'
  - 'vllm-ascend@baa023ad:vllm_ascend/__init__.py#L106-L109'
  - 'https://docs.vllm.ai/projects/ascend/en/latest/index.html'
  - >-
    raw:sha256-740cd35fdf80517d86d351d6e08c577af0401bdeef6fcfd2063f979428492dce.md#L1-L392
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/plugins/__init__.py#L69-L82
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/platforms/__init__.py#L229-L238
  - 'vllm-ascend@7d825229:setup.py#L506-L517'
  - 'vllm-ascend@7d825229:vllm_ascend/__init__.py#L52-L109'
  - 'vllm@ced6857a:vllm/plugins/__init__.py#L36-L90'
  - 'vllm@ced6857a:vllm/platforms/__init__.py#L233-L286'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L149-L167'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/main.py#L34-L39'
  - 'vllm@0fc695fc:vllm/model_executor/models/registry.py#L884-L931'
  - 'vllm@0fc695fc:vllm/model_executor/models/registry.py#L1377-L1422'
  - 'vllm@0fc695fc:vllm/model_executor/models/registry.py#L973-L1017'
  - 'vllm@568afb3a:vllm/plugins/__init__.py#L36-L90'
  - 'vllm@568afb3a:vllm/platforms/__init__.py#L211-L280'
  - 'vllm@84030bbe:vllm/plugins/__init__.py#L36-L90'
  - 'vllm@84030bbe:vllm/platforms/__init__.py#L233-L315'
  - 'vllm@0fc695fc:vllm/platforms/__init__.py#L202-L209'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - "vllm@0fc695fc:docs/design/io_processor_plugins.md#L1-L94"
  - "vllm@0fc695fc:docs/design/plugin_system.md#L1-L158"
  - "vllm@0fc695fc:vllm/plugins/io_processors/__init__.py#L15-L88"
  - "vllm@0fc695fc:vllm/plugins/io_processors/interface.py#L17-L124"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/pooling/io_processor.py#L27-L158"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/base/serving.py#L62-L201"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/factories.py#L38-L101"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/pooling/serving.py#L54-L101"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/offline.py#L51-L136"
  - "vllm@568afb3a:vllm/plugins/io_processors/__init__.py#L15-L88"
  - "vllm@568afb3a:vllm/plugins/io_processors/interface.py#L17-L124"
  - "vllm@568afb3a:vllm/entrypoints/pooling/pooling/io_processor.py#L27-L181"
  - "vllm@568afb3a:vllm/entrypoints/pooling/base/serving.py#L63-L202"
  - "vllm@568afb3a:vllm/entrypoints/pooling/factories.py#L38-L101"
  - "vllm@568afb3a:vllm/entrypoints/pooling/pooling/serving.py#L54-L101"
  - "vllm@568afb3a:vllm/entrypoints/pooling/offline.py#L62-L134"
  - "vllm@568afb3a:vllm/entrypoints/pooling/offline.py#L395-L475"
  - "vllm@ced6857a:vllm/plugins/io_processors/__init__.py#L15-L88"
  - "vllm@ced6857a:vllm/plugins/io_processors/interface.py#L17-L80"
  - "vllm@ced6857a:vllm/entrypoints/pooling/pooling/io_processor.py#L27-L206"
  - "vllm@ced6857a:vllm/entrypoints/pooling/base/serving.py#L64-L207"
  - "vllm@ced6857a:vllm/entrypoints/pooling/factories.py#L38-L107"
  - "vllm@ced6857a:vllm/entrypoints/pooling/pooling/serving.py#L54-L109"
  - "vllm@ced6857a:vllm/entrypoints/pooling/offline.py#L62-L134"
  - "vllm@ced6857a:vllm/entrypoints/pooling/offline.py#L395-L478"
  - "vllm@84030bbe:vllm/plugins/io_processors/__init__.py#L15-L88"
  - "vllm@84030bbe:vllm/plugins/io_processors/interface.py#L17-L80"
  - "vllm@84030bbe:vllm/entrypoints/pooling/pooling/io_processor.py#L27-L206"
  - "vllm@84030bbe:vllm/entrypoints/pooling/base/serving.py#L64-L207"
  - "vllm@84030bbe:vllm/entrypoints/pooling/factories.py#L38-L107"
  - "vllm@84030bbe:vllm/entrypoints/pooling/pooling/serving.py#L54-L109"
  - "vllm@84030bbe:vllm/entrypoints/pooling/offline.py#L62-L134"
  - "vllm@84030bbe:vllm/entrypoints/pooling/offline.py#L395-L478"
  - "vllm@0fc695fc:vllm/config/model.py#L321-L322"
  - "vllm@0fc695fc:vllm/engine/arg_utils.py#L862-L864"
  - "vllm@0fc695fc:vllm/engine/arg_utils.py#L1624-L1626"
  - "vllm@568afb3a:vllm/config/model.py#L335-L336"
  - "vllm@568afb3a:vllm/engine/arg_utils.py#L887-L889"
  - "vllm@568afb3a:vllm/engine/arg_utils.py#L1700-L1702"
  - "vllm@ced6857a:vllm/config/model.py#L373-L374"
  - "vllm@ced6857a:vllm/engine/arg_utils.py#L965-L967"
  - "vllm@ced6857a:vllm/engine/arg_utils.py#L1887-L1889"
  - "vllm@84030bbe:vllm/config/model.py#L373-L374"
  - "vllm@84030bbe:vllm/engine/arg_utils.py#L956-L958"
  - "vllm@84030bbe:vllm/engine/arg_utils.py#L1869-L1871"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/pooling/protocol.py#L63-L97"
  - "vllm@0fc695fc:vllm/entrypoints/pooling/pooling/api_router.py#L20-L39"
  - "vllm@0fc695fc:examples/pooling/plugin/prithvi_geospatial_mae_online.py#L1-L54"
  - "vllm@0fc695fc:examples/pooling/plugin/prithvi_geospatial_mae_io_processor.py#L1-L60"
  - "vllm@0fc695fc:vllm/v1/metrics/loggers.py#L44-L88"
  - "vllm@0fc695fc:vllm/v1/engine/async_llm.py#L120-L132"
  - "vllm@568afb3a:vllm/v1/metrics/loggers.py#L44-L88"
  - "vllm@568afb3a:vllm/v1/engine/async_llm.py#L120-L132"
  - "vllm@ced6857a:vllm/v1/metrics/loggers.py#L45-L89"
  - "vllm@ced6857a:vllm/v1/engine/async_llm.py#L131-L143"
  - "vllm@84030bbe:vllm/v1/metrics/loggers.py#L44-L88"
  - "vllm@84030bbe:vllm/v1/engine/async_llm.py#L130-L142"
  - "https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/pyproject.toml#L78-L83"
  - "https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/__init__.py#L1-L7"
  - "https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/segmentation_io_processor.py#L286-L431"
  - "https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/segmentation_io_processor.py#L433-L501"
  - "https://github.com/vllm-project/bart-plugin/blob/77673541bd7ebdb67a83fa72fd8f72c6aafea17c/README.md#L1-L250"
  - "https://github.com/vllm-project/bart-plugin/blob/77673541bd7ebdb67a83fa72fd8f72c6aafea17c/pyproject.toml#L27-L48"
  - "https://github.com/vllm-project/bart-plugin/blob/77673541bd7ebdb67a83fa72fd8f72c6aafea17c/vllm_bart_plugin/__init__.py#L21-L57"
  - 'vllm-ascend@c09d3e20:setup.py#L506-L517'
  - 'vllm-ascend@c09d3e20:vllm_ascend/__init__.py#L52-L110'
  - 'vllm-ascend@8d6180e2:setup.py#L506-L517'
  - 'vllm-ascend@8d6180e2:vllm_ascend/__init__.py#L52-L118'
  - 'vllm@ba15685a:vllm/plugins/__init__.py#L36-L90'
  - 'vllm@ba15685a:vllm/platforms/__init__.py#L240-L315'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: glm-5-3-flash
    kind: builds-on
    note: 注册表里那个架构名对应的模型长什么样
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 注册完成之后，worker 才真正建设备、建模型、装权重
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-740cd35fdf80517d86d351d6e08c577af0401bdeef6fcfd2063f979428492dce.md
  - >-
    raw/sha256-f39ebfc3d1aefe358deb844d5672f2ee3c1d5c8279350a3987036ae93b39f9c0.md
---

## 装上一个包，vLLM 怎么就会用昇腾了

**插件注册是指：vLLM 从当前 Python 环境的安装信息发现扩展入口，筛选并加载入口函数，再调用它们选择平台、登记模型等实现。** 昇腾靠这些入口接入；发现条目、加载函数与执行成功是不同的步骤。

Python 包在安装时会写下一份安装元数据（记录包名、版本、依赖的那份说明书），里面可以带一张 **entry point（入口点）**清单。本节的平台和通用入口写成「组名 → 若干条『名字 = 某个函数』」。组名是约定好的暗号：vLLM 按它寻找候选入口，再按允许加载的名单筛选。包在这些组名下登记后，就提供了可被发现的扩展入口，vLLM 无需在调用处写死这个包的名字。

```wiki-diagram
file: plugin-registration
```

图从左往右看。清单在**装包那一刻**就写好了，启动时 vLLM 按组名把它读出来，读到的入口分两条分支往下走：

- **登记平台**这条分支只有一个入口。它回答「这台机器该用哪套硬件的做法」，交回来的是一个**名字**——一行写着「去哪个模块找哪个类」的文字，指向昇腾的[平台实现](npu-platform.md)。vLLM 拿到名字后才去导入它。
- **登记模型**这条分支上的入口是**当场执行的函数**。昇腾在这条分支上放了四个，其中一个往模型注册表里加「模型架构名 → 昇腾实现类」的映射，另外三个分别登记 KV 与权重的搬运方式、两种权重加载器、服务级性能采集的配置。

两条分支落在不同的地方：上面一条决定的是**当前平台这一个对象**，下面一条改的是**几张注册表的内容**；它们之间没有约定先后。清单跟着包的安装元数据走：在同一 Python 环境中安装后，下次启动才有发现入口的条件；卸载后，新进程不再从该安装获取入口。是否实际加载还受白名单与导入结果影响，已有进程中的注册状态也不会因卸载自动撤销。

## 为什么要绕安装元数据这一圈，代价是什么

vLLM 是给多种硬件写的通用框架。把扩展入口放进安装元数据，调用方就能按统一组名发现插件，无需为每个外部包手写导入分支。官方命令通过 vLLM 启动服务，也会用到 ascend 量化选项；插件接入并不意味着完全不改上游运行行为，昇腾还会通过 patch 替换部分函数。

代价有三条，都是排查启动问题时真正会撞上的：

**一、入口不做硬件探测。** 昇腾平台入口被允许加载、导入并调用成功后，无条件交出类路径，不先检查有没有 NPU；上游又优先选择唯一激活的外部插件。因此选中昇腾平台不证明设备可用。想在同一环境使用别的硬件，应在启动前卸载该插件或用白名单排除其入口。

**二、发现到了，不等于注册成功——导入容错与执行中断是两回事。** 导入入口对象（`plugin.load()`）失败时，vLLM 会捕获异常、记一条日志并跳过这个入口，启动继续往下走；但一旦加载成功、进入通用入口函数的执行循环，循环本身**不捕获函数抛出的异常**，出错会直接抛给调用方中止初始化。更关键的是，通用插件的防重标志 `plugins_loaded` 在加载并执行入口**之前**就已设为真：若中途某个入口抛错，后续入口不保证执行，且同进程再次调用初始化函数也会直接返回，既不代表全部成功、也不提供自动重试。因此「包装上了」与「所有入口都执行成功」必须分开核对。

**三、新解释器要走自己的入口。** 注册表与防重标志都是进程内状态。按命令行默认 `spawn` 的假设，16 个占卡进程各自起新解释器、各自加载清单；`fork` 等其他启动方式的继承条件须另核，不能凭父进程成功就推定全部子进程成功。

还要把四个容易混成一件事的动作分开：

| 动作 | 什么时候发生 | 结果是什么 |
|---|---|---|
| 发现 | 到相应初始化入口查询安装元数据 | 拿到入口名与目标路径等描述，尚未加载该入口对象 |
| 加载入口 | 通过筛选后导入目标模块、取出函数 | 得到可调用对象；模块导入本身可能有副作用 |
| 执行注册 | 调用已加载的入口函数 | 成功时交回平台类路径、更新注册表或配置；失败须单独处理 |
| 加载模型 | worker 建好通信域之后 | 模型模块真正建出来，权重进到卡上，见[主机内存与显存](device-memory.md) |

### 发现、过滤、激活

把发现、过滤、激活三步连同异常边界放在一张图里对照，就能一眼分清「在哪一步停下会怎样」。图中还同步标出了 `v0.30.0` / `main` 新增的第三组服务指标入口（`ms_service_metric.providers`，共 3 组 6 入口）与显式 CPU 目标直通规则：

```wiki-diagram
file: platform-plugin-registration-fig-discovery
```

**发现**用的是 Python 标准库 `importlib.metadata.entry_points` 按组名查询入口点：给一个组名，返回这一组下所有「名字 = 函数」的条目。这一步只读安装元数据，不导入任何代码。

**过滤**由环境变量 `VLLM_PLUGINS` 控制。它是按**入口名**精确匹配的白名单——填的是 `ascend`、`ascend_model` 这样的入口名字，不是 Python 包名（写成 `VLLM_PLUGINS=all` 反而会把所有真实入口滤掉）。不设置就全部放行；设置了却漏掉某个入口名，那个入口就等于不存在。过滤通过后才逐个 `plugin.load()`，导入失败只记带堆栈的日志并跳过，其余入口照常处理。

**平台候选的激活**在这里定义很窄：入口通过筛选、导入成功且探测调用返回非 `None` 的类路径。固定昇腾入口无条件返回 `NPUPlatform` 类路径，因此会记为激活候选；多候选仲裁与缓存见[平台接口](vllm-platform-interface.md#当前平台是怎么选出来的)（`v0.30.0` 与 `main` 额外为显式 CPU 目标开了直通例外，不再被外置插件无条件压过）。通用组则不挑赢家，而是逐个执行已加载的函数；某个函数抛错会直接中断循环，且由于防重标志已提前置真，必须核对执行结果而非仅看“调用过加载函数”。

注册这一层全部成功，也不证明设备已经可用。驱动、运行库、设备可见性和 HCCL 初始化都是后面几步的事，见 [Worker 启动](npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)。

## 输入输出插件为什么能把一张图拆成多个请求？

**IO Processor 插件把应用的数据变成模型能接收的输入，再把模型结果整理成应用需要的输出。** 这里接的是 pooling 模型：一次前向得到向量、类别或分割结果等，不逐 token 生成聊天回答。例如，应用提交一张地理影像，插件把它切成小图送进分割模型，最后将每块的分类结果拼回完整图。它扩展的是请求前后处理，模型本身仍须支持这些输入和输出。

这是与 [API server](api-server-entry.md) 相邻的一条入口：应用把数据放进插件定义的字段，前处理可以展开成多个模型子请求；引擎算完后，后处理再合并成应用结果。切图、读取文件、拼图都花主机时间和内存，模型也必须完成每块的计算。一次 HTTP 请求不等于一次模型子请求，不能按 HTTP 条数估算实际工作量。

```wiki-diagram
file: plugin-io-processing
```

图中用一张 512×512 像素的方图做示意，每块 256×256，按 A、B、C、D 的位置切开。假设模型结果按 C、A、D、B 的顺序到达，在线服务先按输入编号放回对应位置，收齐后才交给插件拼图；不能照到达先后把右下角拼到左上角。

$$N_{\text{tiles}} = \left(\frac{512}{256}\right) \times \left(\frac{512}{256}\right) = 2 \times 2 = 4\text{ 个模型子输入}$$

| 切片核算项（示意：512×512 方图，256×256 切片） | 算式 | 结果 |
|---|---|---|
| 每边切片数 | $512 \div 256$ | **2 块** |
| 模型子输入总数 | $2 \times 2$ | **4 个**（结果按原位合并为一张完整结果图） |

官方 TerraTorch 示例采用的正是地理影像切片与拼回流程，还会补齐边缘、在拼回后裁掉补齐区域。具体切片尺寸由其配置决定，图中的尺寸只帮助理解数量。在线返回的是插件自己的结果数据；离线入口则把合并结果放在一个输出对象里。这个过程与聊天模型识别图片的媒体处理、[独立 renderer](api-server-entry.md#模板和分词能否拆成一个独立的-cpu-服务) 分工不同：后两者面向生成请求的模板、媒体表示与编号转换。

### 四种入口交给 vLLM 的东西不同

同样写在安装元数据中，入口的返回值和消费位置仍由组名决定：

| 入口组 | 交出什么 | 接入哪里 |
|---|---|---|
| 平台 | 函数返回平台类路径，或表示不激活 | 选择当前硬件平台 |
| 通用 | 可被调用的注册函数 | 模型、搬运方式等注册表或初始化逻辑 |
| IO Processor | 函数返回输入输出处理类的路径 | pooling 请求的前处理与后处理 |
| Stat logger | 直接提供统计记录器类 | 读取引擎统计，记录或输出指标 |

统计插件不会替换模型计算；它消费引擎已经产生的统计。它与默认文字日志是否开启也不是一回事，见[性能分析中的统计开关](inference-performance-analysis.md#怎么开)。[LoRA resolver](lora.md#请求只写适配器名服务怎样找到权重) 则先经通用入口登记查找器，之后在请求选到未知适配器名时参与查找，不能把它当成第五种 IO 处理步骤。

## 复杂异构实战对照：GLM 双机启动前的五个入口与 19 次登记

以上是标准单卡或多卡部署（如 `Qwen3-8B` / `Qwen3-30B-A3B` 在 `v0.30.0` 上由 3 组 6 入口接入）的通用注册机制。下面转入历史 **GLM-5.3-Flash 官方双机**（20 个核心角色进程，其中 16 个占卡，详见[部署前提](glm-5-3-flash-two-node.md#启动时发生了什么)）。在默认 `spawn`、入口均被允许且正常执行的假设下，通用组在前端、两个 EngineCore 和 16 个 worker 中分别登记；平台组则在当前平台缓存为空且首次被访问时解析（不含启动器和运行时辅助进程）。

```wiki-diagram
file: plugin-registration-flow
```

图上半部是通用组：三种进程各有一个调用点，都指向同一件事——读一遍通用组的清单，再把读到的函数逐个执行；执行时又分成两支，三个入口先把昇腾的全局补丁补上，模型入口直接往注册表加条目。下半部是平台组，它不挂在进程启动的固定位置上，而是本进程第一次要用当前平台时才去读、才去解析。

本例正常启动完成后，这些入口已在相应进程中完成平台选择、模型登记与相关补丁准备。之后沿[一条请求](one-request.md)看执行行为，还要继续核对 Worker 初始化、配置消费和算子分派；入口登记是这条链的起点。

### 五个入口分别登记了什么

| 入口名（所在组） | 调用之后发生什么 | 谁会用到 |
|---|---|---|
| `ascend`（平台组） | 交回昇腾平台类的名字 | 平台选择那一步，选中后实例化 |
| `ascend_kv_connector`（通用组） | 登记 KV 连接器与权重传输引擎 | 按传输配置挑实现 |
| `ascend_model_loader`（通用组） | 登记两种昇腾自带的权重加载器：[Netloader](netloader-guide.md) 与 RFork | 指定加载方式时创建加载器 |
| `ascend_service_profiling`（通用组） | 生成服务级性能采集的配置 | 采集功能初始化时 |
| `ascend_model`（通用组） | 往模型注册表加「架构名 → 实现类」 | 按模型配置里的架构名查实现 |

平台组最终选择一家，通用组逐个调用通过筛选且成功加载的入口。GLM 双机的逐请求执行直接使用平台和模型实现；另外三个通用入口仍会执行登记、配置和全局补丁准备，只是其中登记的传输或加载实现，要等选中对应功能才会真正运行。

### 平台入口只交一个名字，不交类

直接导入 `NPUPlatform` 会连带执行模块级 `import torch_npu`。探测阶段 vLLM 还没决定用哪块硬件，必须把 5 个内置候选和全部外部插件问一遍；平台入口只交回类路径字符串，就能把导入推迟到选定之后。注意**导入 `torch_npu` 不等于初始化设备运行时**：提前查设备总内存可能过早触发运行时初始化，因此旧版该接口主动拒答（见[平台实现](npu-platform.md)）。

### 模型入口：从架构名找到昇腾的 GLM 实现

本部署官方权重的架构名是 `Glm5NextForConditionalGeneration`，昇腾将其映射至 `AscendGlm5NextForConditionalGeneration`（同时登记纯文本 `Glm5NextForCausalLM`、草稿层 `Glm5NextMTPModel` 及 DeepSeek-V4 等其他模型）。这一步既不实例化网络层，也不读任何权重——真正建层装权重在 Worker 建好通信域之后（[权重子账](glm-5-3-flash-two-node.md#每张卡上放了什么)列出主要语言权重每卡约 **20.58 GiB**，视觉塔、MTP 旋转矩阵与量化辅助张量另计）。务必分开三件事：**配置识别模型，注册表定位实现，加载器提供权重**（配置兼容补丁见[补丁机制](ascend-patch-system.md#昇腾怎样把-vllm-里的函数换成自己的)）。

### 这张清单在本部署被读了 19 遍

在「CLI 未预设启动方式按 `spawn`、入口均允许加载且正常执行」前提下，核心角色共执行 19 次通用插件登记（20 个核心角色进程不含启动器与辅助进程，多出的 1 个是 DP 协调器——它只转发负载统计、不建模型，不在登记路径上）：

$$N_{\text{reg}} = 1_{\text{前端}} + 2_{\text{EngineCore}} + 16_{\text{Worker}} = 19\text{ 次}$$

| 核心角色进程（按默认 `spawn` 与入口正常执行计） | 调用点与次数 | 小计 |
|---|---|---|
| 前端进程（解析启动参数时） | $1 \times 1$ | **1 次** |
| EngineCore 进程（各 DP 组初始化） | $2 \times 1$ | **2 次** |
| Worker 进程（每卡独立解释器） | $16 \times 1$ | **16 次** |
| **合计**（进程内守卫防重，不提供失败自动重试） | $1 + 2 + 16$ | **19 次** |

平台组的触发时机不同：不在上述三个固定调用点上，而是在本进程首次访问 `current_platform` 且缓存为空时懒解析并缓存（若解析或构造失败、缓存仍为空，后续访问会重试）。仅导入模块本身不会触发平台实例化。

### 三个通用入口先补一次全局补丁

四个通用入口中，连接器、加载器与性能采集三个入口首行都会先调 `_ensure_global_patch()`，仅 `ascend_model` 不调。原因是 `spawn` 出的 EngineCore 子进程不经过前端 CLI 准备钩子，而调度器恰好跑在 EngineCore 里；靠通用入口带防重标记补齐，既能让三入口只真正打一次补丁，又无需假设「平台钩子一定先跑完」（跨进程传播见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)）。这也证明五个入口之间**没有统一的全局执行顺序**。

## 出问题时，先看卡在哪一层

| 现象 | 先查这一层 |
|---|---|
| 包装上了，平台仍然没选中 | 是不是同一个 Python 环境、安装元数据里有没有这张清单、白名单有没有漏掉入口名、导入日志有没有失败记录 |
| 报「只能激活一个平台插件」 | 这个环境里还装了哪个外部平台插件，两家的入口都交回了类路径 |
| 平台对了，模型架构认不出来 | 模型配置里的架构名、模型入口有没有执行成功、这个版本的注册表里有没有这条映射 |
| 架构认出来了，权重加载失败 | 加载器、权重格式与实现是否匹配，这属于加载阶段，不是注册阶段 |

## 常见误解

- **「要在代码里显式注册昇腾」**——一般不需要。安装元数据提供发现入口，但还须通过白名单、导入与调用；变更安装后要重新启动相应进程。
- **「发现到入口就等于注册成功」**——不等于。导入失败只记一条日志并跳过，启动继续；逐个探测平台候选时，调用异常会被捕获，使该候选不计为激活。选定平台后还会再次调用它的入口，这次调用不在前面的异常捕获范围内，失败会交给调用方处理。

- **「五个入口有固定先后」**——平台那一个和通用那四个之间没有约定顺序。所以那三个入口各自带着「打过了」的记号去补补丁，而不是假设平台已经准备好一切。按「平台已经初始化好了」来写通用插件，在 EngineCore 进程里很容易出错。
- **「模型那个入口也该补补丁，是漏了」**——它确实不补，而且合理：它只往注册表加条目，不依赖被改过的调度器和引擎。
- **「机器上没有 NPU，vLLM 会自动退回别的硬件」**——昇腾入口成功激活后不会因此自动回退。入口不做设备检查，唯一外部插件又优先；想用别的硬件，要在启动前卸掉它或用白名单排除。
- **「注册表里有 GLM，就说明模型能跑起来」**——注册表只是一张「架构名 → 实现类」的映射。设备、通信域、权重都在后面几步，见 [Worker 启动](npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)。

## 对照源码

固定上游的加载器会捕获导入失败，但通用入口执行循环不捕获函数自身的异常；current_platform 则在首次访问且缓存为空时解析并实例化。固定 GLM 的平台注册函数只返回类路径。因此要区分导入、执行入口、选择平台与设备初始化四个阶段，某一阶段成功不能代替后续阶段验证。对应入口见下方源码表中的来源 3、11、12、14。

### 怎么开

默认通过安装元数据发现入口，不需要单独的“启用昇腾”参数；`VLLM_PLUGINS` 仍可过滤它。清单写在 `setup.py` 的 `entry_points` 里，两组共五个入口 [C1]：

- `vllm.platform_plugins`：`ascend = vllm_ascend:register`
- `vllm.general_plugins`：`ascend_kv_connector = vllm_ascend:register_connector`、`ascend_model_loader = vllm_ascend:register_model_loader`、`ascend_service_profiling = vllm_ascend:register_service_profiling`、`ascend_model = vllm_ascend:register_model`

上游侧三件事：来源 10 的组名常量是 `DEFAULT_PLUGINS_GROUP = "vllm.general_plugins"`（注释写明在所有进程加载——process0、engine core 与 worker）和 `PLATFORM_PLUGINS_GROUP = "vllm.platform_plugins"`；`load_plugins_by_group(group)` 用 `importlib.metadata.entry_points(group=...)` 取清单，逐个 `plugin.load()`，返回「名字 → 函数」[C11]；来源 12 的 `load_general_plugins()` 用模块级 `plugins_loaded` 做进程内去重，再对每个函数直接 `func()`。三个调用点分别在 `EngineArgs.__post_init__`、`EngineCore.__init__` 和 `WorkerWrapperBase` 里，逐条位置见下面的源码位置表。


上游另有两处调用，没有额外计入这里的 19 次：`AsyncEngineArgs.add_cli_args` 在搭命令行参数时也调一次，但仍在前端同一进程，被守卫去重；懒注册模型的信息探测在无法使用缓存时会另起短命子进程，那里也加载通用插件（来源 37、38）。因此，19 只覆盖上面的核心功能角色，不是整个启动期间所有进程或所有扫描动作的总数。

平台侧 [C13]：`resolve_current_platform_cls_qualname()` 把内置的 tpu / cuda / rocm / xpu / cpu 与外部插件的函数都调一遍，返回值不是 `None` 就记为激活；外部插件只要有一个激活就优先于内置候选。来源 14 的 `current_platform` 是懒加载的模块属性，缓存为空时访问才解析，成功后复用同一个对象。

昇腾侧：来源 3 的 `register()` 函数体只有一行 `return "vllm_ascend.platform.NPUPlatform"`，成功调用后无条件返回类路径。四个通用函数分别调 `kv_transfer.register_connector()` 与 `weight_transfer.register_engine()`、`register_netloader()` 与 `register_rforkloader()`、`generate_service_profiling_config()`、`.models.register_model()` [C4]；前三个的第一句是 `_ensure_global_patch()`，来源 2 中它用 `_GLOBAL_PATCH_APPLIED` 做幂等、内部调 `adapt_patch(is_global_patch=True)`，docstring 写明理由是 engine-core 子进程里也要打上影响调度器与引擎的补丁。

安装声明、实际发现、加载成功与调用成功是不同状态。来源 3 所示函数体没有硬件探测或可用性判断，因此返回平台实现名称也不证明驱动、软件栈和设备已经准备好。

只想加载一部分插件：`VLLM_PLUGINS` 是按入口名过滤的白名单（填 `ascend`、`ascend_model` 这样的名字），不设则全部加载。

**自定义输入输出先选择模型和插件，再选择入口。** --io-processor-plugin 对应 io_processor_plugin，四版定义默认都是 None。非空显式名称优先；没有显式名称时，加载器再查模型 HF 配置中的同名字段。名称是 vllm.io_processor_plugins 组里的入口名，入口函数返回处理类路径，vLLM 再用当前配置与 renderer 创建该类的对象。插件包须已装在服务环境中，且名称通过既有 VLLM_PLUGINS 筛选；新增一个名称时保留 Ascend 等原有必要入口。

在线通过 **POST /pooling** 提交 model 与 data；data 里面放什么由插件校验，响应的 data 也由插件后处理定义。它不是 /v1/chat/completions，也不是一套统一的图像 JSON 格式。离线对已配置好同一插件的 LLM 对象调用 `llm.encode({"data": plugin_input}, pooling_task="plugin")`；这里的 plugin_input 表示已按插件格式准备的数据。普通向量或分类请求仍走对应 pooling 任务，模型的 task=plugin 本身也不保证使用了 IO 插件。

要看一套具体格式，可对照固定上游的 TerraTorch 在线与离线示例（来源 93、94）：其中选择 terratorch_segmentation，提交 GeoTIFF 的 URL 或其支持的其他数据形式，返回分割图。该插件需要匹配的地理模型配置与依赖；GLM 双机配方沿用普通生成入口，未配置这个插件。

**统计插件的入口值直接是类。** vllm.stat_logger_plugins 要求该类继承 StatLoggerBase；四版 AsyncLLM 都把发现的类加入自定义统计记录器列表。有自定义记录器时，即使关闭默认统计日志，也仍保持这条统计路径；默认日志与指标的完整关系见[性能分析](inference-performance-analysis.md#怎么开)。模型实现和统计结构的版本兼容仍由插件负责。

「交名字不交类」的理由是推出来的：平台模块顶部导入昇腾的工具模块，而工具模块在模块级导入运行库 [C9]，源码里没有一句话直接说明这个设计意图 [D]。

### 会报什么错

- **`RuntimeError: Only one platform plugin can be activated, but got: [...]`**：至少两个外部平台候选都被判为激活。昇腾入口通过筛选、导入并成功调用后返回非空类路径，但仅仅同时安装两个插件还不足以触发冲突。
- **`Failed to load plugin <name>`**：`plugin.load()`（即导入 `vllm_ascend`）抛异常时只记一条 exception 日志、跳过这个插件，不中断启动。平台候选的逐个探测调用处使用 `except Exception: pass`，异常表现成「这家没激活」；选定后第 237 或 245 行再次调用入口时不在这段捕获内，异常会向调用方传播。
- **通用入口函数自己抛异常**：`load_general_plugins()` 对 `func()` 不包 `try`，异常直接打断所在进程的启动。报错出现在 EngineCore 或 worker 进程时，先看是不是那三个补丁入口之一。
- **设了 `VLLM_PLUGINS` 但没包含 `ascend`**：平台入口不被加载，vLLM 回落到内置判断，都不激活时落到 `UnspecifiedPlatform`。
- **架构名不在注册表里**：模型入口没执行成功，或这个版本没有登记该架构名。

以上条件来自上游加载、平台选择与昇腾入口函数，见源码表中的来源 3、11–13；通用入口的执行异常还要与导入异常分开处理。

IO 插件还要分别检查“没有可加载入口”和“指定名称不在可加载名单”。加载器会对入口函数调用失败记告警，但所需插件不可用时仍报 ValueError；最终处理类导入或构造失败也会向上传播。HTTP data 必须通过插件自己的校验；子输入没有全部产出结果时，服务报 Failed to generate results for all prompts，不会把缺片结果当完整结果交给后处理。统计入口若不是规定的子类，则报 TypeError。

### 开销和什么时候别开

开销主要在初始化阶段，包括扫描元数据、导入入口模块和执行登记。来源 9 说明导入平台所依赖的工具模块会导入 torch_npu，不能据此断言仅导入顶层 vllm_ascend 就初始化了设备。19 次是上述核心角色的通用登记示意账，不是所有导入或设备初始化的次数；实际耗时需要启动记录。

用白名单缩小加载范围时，要核对每个进程实际使用的环境与调用路径。排除那三个通用入口，会失去它们负责的登记和补丁初始化路径；是否还有其他入口已应用同一补丁，必须继续查，不能仅凭排除名单就断言所有全局补丁都未生效。至少两个外置平台同时被判定为激活时，平台选择才会因冲突报错；同时安装两个外部插件本身不足以判定冲突。

IO 插件的代价还发生在每次请求：展开的输入越多，引擎需要计算和保存的结果就越多，收齐后才能合并返回。官方接口列有异步帮助方法，但本页核对的四版在线 wrapper 都调用同步的 parse_data、pre_process 和 post_process。v0.23/v0.26 把整个同步前处理交给线程池；v0.30.0/main 的异步前处理先同步调用插件生成输入，再等待并发渲染。因此插件里耗时的文件读取或 CPU 操作要结合实际调用位置评估，不能仅凭方法名带 async 就认为不会阻塞连接处理。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 的入口声明与 `v0.23.0` 逐字相同）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**四版 `vllm-ascend` 的入口点清单均声明在 `setup.py` 的 `entry_points` 字段（尚未迁入 `pyproject.toml`）；`v0.30.0` 与 `main` 均保持三组六个入口，`main` 将第三组指标入口迁至 `observability.ms_metrics`，并在 `_ensure_global_patch()` 与 `register_connector()` 中分别加入 MRV2 配置强制补丁与 EC 连接器注册。**

下表先对照上游 IO Processor 与 Stat Logger 接口在四版中的演进：

| IO／统计核对项 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a`） |
|---|---|---|---|---|
| IO 名称默认与选择 | `None`；非空显式名称优先，否则读模型配置 | 相同 | 相同 | 相同 |
| 在线插件方法与结果顺序 | 同步方法；按输入编号收齐再后处理 | 相同 | 相同 | 相同 |
| 在线前处理执行位置 | 同步前处理在线程池 | 同 `v0.23.0` | 插件工厂同步执行，再等待异步渲染 | 同 `v0.30.0` |
| 旧 `parse_request`／参数验证兼容入口 | 仍有兼容转接 | 相同 | 移除这两个旧转接；输出包装兼容仍在 | 同 `v0.30.0` |
| 离线切片提交 | 渲染并加入请求，再运行引擎 | 改为分批加入，以 `max_num_seqs×2` 为核心请求数目标 | 沿用，并显式拒绝零个输入 | 同 `v0.30.0` |
| 统计入口类型与关闭默认日志 | 要求 `StatLoggerBase` 子类；自定义记录器可保持统计启用 | 相同 | 相同 | 相同 |

注册接口有兼容承诺，插件内部实现仍须匹配所用 vLLM。官方外链的 BART 插件就是独立版本的例子：本次固定外部快照要求 vLLM ≥0.24，并接入新 model runner 的配置。它的 README 将 `VLLM_PLUGINS=all` 写成全部加载，但四版上游实际只匹配入口名字；正确的“不过滤”方式是未设置该变量。

再对照 Ascend 侧 `setup.py` `entry_points` 与插件加载链在四版正式钉点上的演进：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `setup.py` 入口点清单（未迁至 `pyproject.toml`） | 2 组 5 个（`#L543-L551`，GLM `db701c1f` 同） | 2 组 5 个（`#L543-L551`） | 3 组 6 个（`#L506-L517`）：新增 `ms_service_metric.providers` -> `vllm_ascend.observability:get_metric_provider` | 3 组 6 个（`#L506-L517`）：指标入口迁至 `vllm_ascend.observability.ms_metrics:get_metric_provider` |
| `vllm.platform_plugins` | `ascend = vllm_ascend:register`，返回 `NPUPlatform` 路径 | 同 `v0.23.0` | 同 `v0.23.0` | 同 `v0.23.0` |
| `vllm.general_plugins`（4 项） | 三个入口调 `_ensure_global_patch()`；`register_model` 只登记模型 | `register_model` 先注册 Kimi-K3 与 HunyuanVL processor 兼容补丁再登记模型 [C23] | `register_model` 回归仅登记模型（`__init__.py#L52-L110`）；`register_connector` 注册 KV + 权重传输 | `_ensure_global_patch()` 先调 `apply_v2_model_runner_config_patch()` 再打全局 patch；`register_connector` 新增 `ec_transfer.register_connector()`（`__init__.py#L52-L118`） |
| 上游插件加载与平台选择 | `importlib.metadata` + `VLLM_PLUGINS` + 一次性守卫；单 OOT 优先 | 相同 | 新增显式 CPU target 直通与探测异常 debug 日志（`platforms/__init__.py#L233-L286`） | 延续 `v0.30.0`（`plugins/__init__.py#L36-L90`、`platforms/__init__.py#L240-L315`） |

`v0.26.0rc` 的模型入口额外导入 `HunYuanVLProcessor`（来源 24），`v0.30.0` 与 `main` 恢复轻量化登记；`v0.30.0` 起的上游平台选择对显式 CPU target 开了直通例外，因此“外部平台优先”不再无条件覆盖 CPU 目标。安装声明本身仍不能替代实际子进程加载成功的证据。

### 源码位置

新增 IO／统计证据：来源 46–47 是官方 IO 与插件母文；48–54、55–62、63–70、71–78 依次对应四版的选择器、接口、在线/离线 wrapper 与消费者。79–90 对照四版字段默认、CLI 与 ModelConfig 传入；91–94 给出 HTTP 协议、路由和两个官方示例。95–102 是四版统计入口类型校验与 AsyncLLM 消费；103–106 是固定 TerraTorch 的安装声明、类路径、切片和拼回，107–109 是固定 BART 的说明、安装声明与注册函数。第三方代码说明具体例子怎样接入，不作为 Ascend 或 GLM 运行验证。

以下是固定提交的入口位置。官方文档首页用于继续导航，具体版本条件以对应提交与模型教程为准。

| 结论 | 来源 |
|---|---|
| 来源 1 五个入口的声明 | `vllm-ascend@db701c1f:setup.py#L543-L551` |
| 来源 11 按组取清单；组名常量见来源 10，通用组执行与去重见来源 12 | `vllm@0fc695fc:vllm/plugins/__init__.py#L28-L66`；另见 `#L12-L25`、`#L69-L82` |
| 来源 13 平台候选探测、外部优先、冲突报错 | `vllm@0fc695fc:vllm/platforms/__init__.py#L212-L252` |
| 来源 14 当前平台的懒加载与缓存 | `vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281` |
| 来源 4 四个通用入口函数；补丁幂等、平台入口、模型登记分别见来源 2、3、5 | `vllm-ascend@db701c1f:vllm_ascend/__init__.py#L44-L75`；另见 `#L18-L35`、`#L38-L41` 及 `vllm_ascend/models/__init__.py#L4-L25` |
| 来源 15 前端调用点；不计入 19 次的命令行参数、模型信息探测子进程分别见来源 18、19 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L744-L747`、`#L2578-L2585`；`vllm@0fc695fc:vllm/model_executor/models/registry.py#L1406-L1411` |
| 来源 16 EngineCore 调用点 | `vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109` |
| 来源 17 worker 调用点 | `vllm@0fc695fc:vllm/v1/worker/worker_base.py#L245-L247` |
| 来源 9 导入平台类会连带拉起运行库 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L39-L39` → `vllm-ascend@db701c1f:vllm_ascend/utils.py#L33-L34` |
| 来源 8 内存查询接口的提前初始化警告与未实现分支；平台类定义见来源 7 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L274-L281`、`#L128-L146` |
| 来源 20 v0.23 的入口声明；模型入口函数体见来源 21 | `vllm-ascend@2c59ff10:setup.py#L543-L551`；`vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L72-L75` |
| 来源 25 main 的第三组入口；模型入口见来源 26 | `vllm-ascend@baa023ad:setup.py#L506-L517`；`vllm-ascend@baa023ad:vllm_ascend/__init__.py#L106-L109` |
| 来源 22 v0.26 的入口声明；模型入口函数体、它导入的 processor 兼容补丁分别见来源 23、24 | `vllm-ascend@2ed6cbba:setup.py#L543-L551`；`vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L72-L85`；`vllm-ascend@2ed6cbba:vllm_ascend/patch/hunyuan_vl_processor_compat.py#L8-L8` |
| [S27] 官方文档首页 | <https://docs.vllm.ai/projects/ascend/en/latest/index.html>（浮动导航入口） |

**运行证据边界。** 本页依据固定 Git 对象；尚无镜像内安装文件的比对或实际启动日志，不能用这里的静态流程与计数证明现场已完成加载。判断现场状态仍要看所用进程的版本、环境、平台激活和入口执行结果。

- 来源 29：vllm@0fc695fc，vllm/plugins/__init__.py，L69–L82。
- 来源 30：vllm@0fc695fc，vllm/platforms/__init__.py，L229–L238。
- 来源 35、36：CLI 对 spawn 的条件性默认与调用入口；来源 37、38：懒模型信息探测的缓存判断、子进程启动及子进程加载插件；来源 39：字符串登记只构造懒注册记录，不实例化模型或加载权重。来源 40–43 是 v0.26 rc/main 对应的加载、选择与缓存实现，来源 44 列出旧基线的五个内置平台候选，来源 45 是模型配置中的架构名。
