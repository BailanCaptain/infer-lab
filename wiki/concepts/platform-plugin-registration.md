---
id: platform-plugin-registration
title: 插件发现与模型注册
type: feature
summary: 装上昇腾的包，vLLM 自己就会用昇腾：包里带着一张「我能接哪几个口」的入口点清单，vLLM 每起一个进程都按组名读一遍——一个口认平台，四个口登记连接器、模型加载器、性能采集和模型实现。
aliases: [entry point, entry_points, vllm.platform_plugins, vllm.general_plugins, 插件注册, VLLM_PLUGINS, 平台插件, 通用插件, platform plugin, general plugin]
chapters: ["10"]
order: 50
sources:
  - vllm-ascend@db701c1f:setup.py#L543-L551
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L35
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L41
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L44-L75
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L25
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L39-L39
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L278-L279
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L33-L34
  - vllm@0fc695fc:vllm/plugins/__init__.py#L12-L25
  - vllm@0fc695fc:vllm/plugins/__init__.py#L28-L66
  - vllm@0fc695fc:vllm/plugins/__init__.py#L69-L82
  - vllm@0fc695fc:vllm/platforms/__init__.py#L212-L252
  - vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L744-L747
  - vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L245-L247
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2578-L2585
  - vllm@0fc695fc:vllm/model_executor/models/registry.py#L1406-L1411
  - vllm-ascend@2c59ff10:setup.py#L543-L551
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L72-L75
  - vllm-ascend@2ed6cbba:setup.py#L543-L551
  - vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L72-L85
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/hunyuan_vl_processor_compat.py#L8-L8
  - vllm-ascend@baa023ad:setup.py#L506-L517
  - vllm-ascend@baa023ad:vllm_ascend/__init__.py#L106-L109
  - https://docs.vllm.ai/projects/ascend/en/latest/index.html
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - {to: glm-5-3-flash, kind: builds-on, note: 注册表里那个架构名对应的模型长什么样}
  - {to: npu-worker-lifecycle, kind: builds-on, note: 注册完成之后，worker 才真正建设备、建模型、装权重}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 装上一个包，vLLM 怎么就会用昇腾了

**插件注册是指：vLLM 启动时去读「这台机器上装了哪些包、这些包登记了哪些扩展入口」，再把登记的函数逐个调用一遍；昇腾就靠这些入口，把设备平台和模型实现换成自己的那一套。**

Python 包在安装时除了把代码拷到磁盘上，还会写下一份安装元数据（记录包名、版本、依赖的那份说明书），里面可以带一张 **entry point（入口点）**清单，格式是「组名 → 若干条『名字 = 某个函数』」。组名是约定好的暗号：vLLM 事先公布了几个组名，意思是「凡是登记在这个组名下的函数，我启动时都会去调」。任何一个包只要在这些组名下登记，就算把自己挂进了 vLLM——vLLM 不需要认识这个包，只需要按组名去问「谁登记了」。

```wiki-diagram
file: plugin-registration
```

图从左往右看。清单在**装包那一刻**就写好了，启动时 vLLM 按组名把它读出来，读到的入口分两条分支往下走：

- **登记平台**这条分支只有一个入口。它回答「这台机器该用哪套硬件的做法」，交回来的是一个**名字**——一行写着「去哪个模块找哪个类」的文字，指向昇腾的[平台实现](npu-platform.md)。vLLM 拿到名字后才去导入它。
- **登记模型**这条分支上的入口是**当场执行的函数**。昇腾在这条分支上放了四个，其中一个往模型注册表里加「模型架构名 → 昇腾实现类」的映射，另外三个分别登记 KV 与权重的搬运方式、两种权重加载器、服务级性能采集的配置。

两条分支落在不同的地方：上面一条决定的是**当前平台这一个对象**，下面一条改的是**几张注册表的内容**；它们之间没有约定先后。清单跟着包走，也跟着包消失：装上 vllm-ascend，下一次启动 vLLM 就会扫到它；卸载掉，vLLM 从此看不见昇腾，不需要改任何配置。

## 为什么要绕安装元数据这一圈，代价是什么

vLLM 是给多种硬件写的通用框架，它的代码里没有「如果是昇腾就这样」的分支，官方双机的启动命令里也没有「昇腾」「NPU」这样的字眼。把硬件适配放进安装元数据，好处是双方都不用写死对方：昇腾不改 vLLM 一行代码，vLLM 也不必为每一家硬件准备一个导入分支。

代价有三条，都是排查启动问题时真正会撞上的：

**一、粒度只有「装没装」。** 昇腾的平台入口无条件交出类路径，不先检查这台机器上有没有 NPU；而上游的规则是外部插件优先于内置的硬件判断。所以同一个 Python 环境里只要装了 vllm-ascend，vLLM 就会认定这是一台昇腾机器。想用别的硬件，得卸掉它或者用白名单把它排除在外。

**二、发现到了，不等于注册成功。** 导入某个入口失败时，vLLM 只记一条日志并跳过这个入口，启动继续往下走。于是「包装上了」和「实现真的换了」是两件事，要分别确认。

**三、每个进程都得重来一遍。** 注册结果是进程内状态：模块变量、注册表都只活在本进程里。本部署的 16 个占卡进程，每一个都要把这张清单重新读一遍，才能拿到昇腾的模型实现。

还要把三个容易混成一件事的动作分开：

| 动作 | 什么时候发生 | 结果是什么 |
|---|---|---|
| 发现 | 每个进程起来时读安装元数据 | 拿到「入口名 → 函数」，还没有任何效果 |
| 执行注册 | 立刻调用这些函数 | 交回平台的类路径；几张注册表里多出条目 |
| 实际加载 | worker 建好通信域之后 | 模型对象真正建出来，权重进到卡上，见[显存](device-memory.md#放到-glm-双机先装权重再接住一个-token) |

### 发现、过滤、激活

**发现**用的是 Python 标准库按组名查询入口点的接口：给一个组名，返回这一组下所有「名字 = 函数」的条目。这一步只读安装元数据，不导入任何代码。

**过滤**由 `VLLM_PLUGINS` 这个环境变量控制。它是白名单，按**入口名**过滤——填的是 `ascend`、`ascend_model` 这样的入口名字，不是 Python 包名。不设置就全部加载；设置了却漏掉某个名字，那个入口就等于不存在。过滤之后才逐个导入，导入失败只写一条带堆栈的日志并跳过这个入口，其余入口照旧。

**激活**在插件这一层只有一个很窄的含义：函数被调用了，而且返回值不是空。平台组的入口要交回一个类路径，交回空值就算没激活；昇腾那个函数的函数体只有一行「返回昇腾平台的类路径」，所以它一定算激活。至于多个候选同时激活时按什么规则挑、挑出来的结果存在哪里，属于另一页：见[平台接口](vllm-platform-interface.md#当前平台是怎么选出来的)。通用组不看返回值，调用即生效，同一组里登记的多个入口都会被调，互不排斥。

注册这一层全部成功，也不说明设备已经可用。驱动、运行库、设备可见性和 HCCL 初始化是后面几步的事，见 [Worker 启动](npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)。
## 放到 GLM 双机：请求到来前，五个入口做了什么

**官方双机部署起 20 个进程，其中 16 个占卡；通用组这四个入口在前端、两个 EngineCore 和 16 个 worker 里各执行一遍，平台组那一个则是本进程第一次要用当前平台时才解析。** 部署布局与进程账见[部署前提](glm-5-3-flash-two-node.md#启动时发生了什么)。

```wiki-diagram
file: plugin-registration-flow
```

图上半部是通用组：三种进程各有一个调用点，都指向同一件事——读一遍通用组的清单，再把读到的函数逐个执行；执行时又分成两支，三个入口先把昇腾的全局补丁补上，模型入口直接往注册表加条目。下半部是平台组，它不挂在进程启动的固定位置上，而是本进程第一次要用当前平台时才去读、才去解析。

这五个入口都在**请求到来之前**就用完了：平台早已定成昇腾，模型实现早已换成昇腾的版本，补丁也在每个进程里打好。[一条请求](one-request.md)路上每一个「昇腾特有」的行为，源头都能追到这五个入口之一。

### 五个入口分别登记了什么

| 入口名（所在组） | 调用之后发生什么 | 谁会用到 |
|---|---|---|
| `ascend`（平台组） | 交回昇腾平台类的名字 | 平台选择那一步，选中后实例化 |
| `ascend_kv_connector`（通用组） | 登记 KV 连接器与权重传输引擎 | 按传输配置挑实现 |
| `ascend_model_loader`（通用组） | 登记两种昇腾自带的权重加载器 | 指定加载方式时创建加载器 |
| `ascend_service_profiling`（通用组） | 生成服务级性能采集的配置 | 采集功能初始化时 |
| `ascend_model`（通用组） | 往模型注册表加「架构名 → 实现类」 | 按模型配置里的架构名查实现 |

平台组只能有一家胜出，通用组是「谁登记了都调」。GLM 双机真正用到的是其中两条：平台那一个和模型那一个；连接器与加载器要等开了对应功能才走到，采集只是把配置准备好。

### 平台入口只交一个名字，不交类

平台这个口交给 vLLM 的不是平台对象，而是一行「去哪个模块找哪个类」的文字。绕这一下有实际原因：真把昇腾的平台类导入进来，会连带把 `torch_npu`（PyTorch 的昇腾扩展，昇腾算子和设备管理都从它进来）一起拉进这个进程——平台模块顶部就导入了昇腾的工具模块，而那个模块在模块级 `import torch_npu`。而 vLLM 问平台的时候还没决定用哪块硬件，它要把五个内置候选和所有外部插件都问一遍才挑。如果每个口都直接交出平台对象，光是「问一圈」就会把各家的底层库全部加载一遍。

交名字就没有这个问题：先收一圈名字，挑定昇腾，再按名字去导入。这和[平台实现](npu-platform.md)那一页的约束是同一根线——昇腾的底层运行库只允许初始化一次，什么时候碰它要格外小心。

### 模型入口：从架构名找到昇腾的 GLM 实现

模型目录里的配置带着**架构名**，模型注册表把架构名映射到一个 Python 实现。本部署官方权重的架构名是 `Glm5NextForConditionalGeneration`，昇腾把它登记到自己的 `AscendGlm5NextForConditionalGeneration`；纯文本那一支的 `Glm5NextForCausalLM`、MTP 草稿层用的 `Glm5NextMTPModel` 等也各有一条。同一个函数还为 DeepSeek-V4 等模型登记条目，与 GLM 无关。

这一步只建映射：没有建出模型的任何一层，也没有读一个字节的权重。真正按配置查注册表、创建模块、装载权重是 worker 建好通信域之后的事，每卡最终约 **20.58 GiB**，见[显存](device-memory.md#放到-glm-双机先装权重再接住一个-token)。所以要把三件事分开记：**配置识别模型，注册表定位实现，加载器提供权重。** 配置类型的注册与兼容处理另见[补丁与实现替换](ascend-patch-system.md#昇腾怎样把-vllm-里的函数换成自己的)。

### 这张清单在本部署被读了 19 遍

登记结果不跨进程继承，所以那三个调用点在本部署一共执行 19 次。这里的 19 和上面的 20 个进程不矛盾，两个数口径不同：20 数的是常驻进程，19 数的是读清单的次数，差的那一个是 DP 协调器——它只在前端和各个 EngineCore 之间转发排队长度这类负载统计，不建模型也不碰设备，那三个调用点上没有它。

```calc
title: 通用组登记在本部署执行几次
前端进程（解析启动参数时） = 1 次
EngineCore 进程 = 2 个 × 1 次 = 2 次
worker 进程 = 16 个 × 1 次 = 16 次
合计 = 1 + 2 + 16 = 19 次
> 同一进程内有「读过了」的记号，重复调用只生效一次
```

平台组的时机不一样：它不在这三个调用点上，而是本进程第一次要用当前平台时才解析一次，结果留在本进程里，之后都拿同一个对象。

### 三个通用入口先补一次全局补丁

四个通用入口里有三个（连接器、加载器、采集）的第一件事，是把昇腾的全局补丁再打一遍，只有模型那个不打。原因是 EngineCore 这类子进程走不到前端那条打补丁的路，而调度器恰好就在 EngineCore 里；昇腾要改调度器和引擎的行为，只能借这几个入口在子进程里再打一次。补丁带着「打过了」的记号，三个入口各调一次也只真打一遍。模型入口只往注册表加条目，不依赖被改过的调度器和引擎，所以不打。补丁为什么要分几条路送，见[引擎有哪几个进程](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。

这也说明五个入口之间**没有统一的全局执行顺序**：正因为不能假定平台已经把一切准备好，那三个入口才各自带着记号去补一次。

## 出问题时，先看卡在哪一层

| 现象 | 先查这一层 |
|---|---|
| 包装上了，平台仍然没选中 | 是不是同一个 Python 环境、安装元数据里有没有这张清单、白名单有没有漏掉入口名、导入日志有没有失败记录 |
| 报「只能激活一个平台插件」 | 这个环境里还装了哪个外部平台插件，两家的入口都交回了类路径 |
| 平台对了，模型架构认不出来 | 模型配置里的架构名、模型入口有没有执行成功、这个版本的注册表里有没有这条映射 |
| 架构认出来了，权重加载失败 | 加载器、权重格式与实现是否匹配，这属于加载阶段，不是注册阶段 |

## 常见误解

- **「要在代码里显式注册昇腾」**——不需要。清单是装包时写下的，装上就生效，卸掉就消失。
- **「发现到入口就等于注册成功」**——不等于。导入失败只记一条日志并跳过，启动继续；平台函数调用时抛的异常也会被吞掉。
- **「五个入口有固定先后」**——平台那一个和通用那四个之间没有约定顺序。所以那三个入口各自带着「打过了」的记号去补补丁，而不是假设平台已经准备好一切。按「平台已经初始化好了」来写通用插件，在 EngineCore 进程里很容易出错。
- **「模型那个入口也该补补丁，是漏了」**——它确实不补，而且合理：它只往注册表加条目，不依赖被改过的调度器和引擎。
- **「机器上没有 NPU，vLLM 会自动退回别的硬件」**——装了 vllm-ascend 就不会。昇腾的平台入口不做设备检查，而外部插件优先，想用别的硬件得先卸掉它，或者用白名单把它排除。
- **「注册表里有 GLM，就说明模型能跑起来」**——注册表只是一张「架构名 → 实现类」的映射。设备、通信域、权重都在后面几步，见 [Worker 启动](npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)。

## 对照源码

### 怎么开

装包即开，不需要任何参数。清单写在 `setup.py` 的 `entry_points` 里，两组共五个入口 [C1]：

- `vllm.platform_plugins`：`ascend = vllm_ascend:register`
- `vllm.general_plugins`：`ascend_kv_connector = vllm_ascend:register_connector`、`ascend_model_loader = vllm_ascend:register_model_loader`、`ascend_service_profiling = vllm_ascend:register_service_profiling`、`ascend_model = vllm_ascend:register_model`

上游侧三件事 [C2]：组名常量是 `DEFAULT_PLUGINS_GROUP = "vllm.general_plugins"`（注释写明在所有进程加载——process0、engine core 与 worker）和 `PLATFORM_PLUGINS_GROUP = "vllm.platform_plugins"`；`load_plugins_by_group(group)` 用 `importlib.metadata.entry_points(group=...)` 取清单，逐个 `plugin.load()`，返回「名字 → 函数」；`load_general_plugins()` 用模块级 `plugins_loaded` 做进程内去重，再对每个函数直接 `func()`。三个调用点分别在 `EngineArgs.__post_init__`、`EngineCore.__init__` 和 `WorkerWrapperBase` 里，逐条位置见下面的源码位置表。

上游另有两处调用，「19 次」没有数它们（行号并入下面源码位置表的「前端调用点」一行）：`AsyncEngineArgs.add_cli_args` 在搭命令行参数时也调一次，但那还是前端同一个进程，被 `plugins_loaded` 去重；模型信息探测在缓存未命中时会另起一个短命子进程，那个进程启动后也要读一遍清单。所以 19 次的口径是「那 20 个常驻进程各读几遍」，短命子进程不计。

平台侧 [C3]：`resolve_current_platform_cls_qualname()` 把内置的 tpu / cuda / rocm / xpu / cpu 与外部插件的函数都调一遍，返回值不是 `None` 就记为激活；外部插件只要有一个激活就优先于内置候选。`current_platform` 是懒加载的模块属性，第一次访问才解析，之后复用同一个对象。

昇腾侧 [C5]：`register()` 的函数体只有一行 `return "vllm_ascend.platform.NPUPlatform"`，无条件返回，所以装上就算激活。四个通用函数分别调 `kv_transfer.register_connector()` 与 `weight_transfer.register_engine()`、`register_netloader()` 与 `register_rforkloader()`、`generate_service_profiling_config()`、`.models.register_model()`；前三个的第一句是 `_ensure_global_patch()`，它用 `_GLOBAL_PATCH_APPLIED` 做幂等、内部调 `adapt_patch(is_global_patch=True)`，docstring 写明理由是 engine-core 子进程里也要打上影响调度器与引擎的补丁。

只想加载一部分插件：`VLLM_PLUGINS` 是按入口名过滤的白名单（填 `ascend`、`ascend_model` 这样的名字），不设则全部加载。

「交名字不交类」的理由是推出来的：平台模块顶部导入昇腾的工具模块，而工具模块在模块级导入运行库 [C9]，源码里没有一句话直接说明这个设计意图 [D]。

### 会报什么错

- **`RuntimeError: Only one platform plugin can be activated, but got: [...]`**：同一环境里有两个会激活的外部平台插件。昇腾无条件激活，和别家平台插件装在一起就撞。
- **`Failed to load plugin <name>`**：`plugin.load()`（即导入 `vllm_ascend`）抛异常时只记一条 exception 日志、跳过这个插件，不中断启动。平台函数调用时抛的异常被 `except Exception: pass` 吞掉，表现成「这家没激活」。
- **通用入口函数自己抛异常**：`load_general_plugins()` 对 `func()` 不包 `try`，异常直接打断所在进程的启动。报错出现在 EngineCore 或 worker 进程时，先看是不是那三个补丁入口之一。
- **设了 `VLLM_PLUGINS` 但没包含 `ascend`**：平台入口不被加载，vLLM 回落到内置判断，都不激活时落到 `UnspecifiedPlatform`。
- **架构名不在注册表里**：模型入口没执行成功，或这个版本没有登记该架构名。

以上五条的依据是上游的加载与平台选择代码，以及昇腾的入口函数 [C2][C3][C5]。第一条里「昇腾一定会激活」是推出来的：无条件返回类路径，加上上游「返回值非空即激活、外部插件优先」两条规则 [D]。

### 开销和什么时候别开

开销只在启动阶段，而且很小：每个进程一次安装元数据扫描加一次导入。真正的代价是导入 `vllm_ascend` 会连带加载昇腾的底层运行库 [C9]，而本部署里这件事发生 19 次，由 20 个进程的构成与那三个调用点相乘得出 [D]，不是一次。

昇腾机器上正常服务时，五个入口都该在。想缩小范围只有白名单一条路，而它的作用面是整个进程环境、子进程继承，不能只对某一个进程关。用白名单去掉那三个补丁入口，代价是调度器与引擎的全局补丁在子进程里不再生效，属于调试上游行为时才做的事，不要带进生产。两个外部平台插件不要装进同一个环境——不是「优先级不对」，而是直接抛错停止启动。

### 版本差异

固定快照：v0.23 维护分支 = Ascend `2c59ff10`（配套 `vllm@0fc695fc`）；v0.26 = Ascend `2ed6cbba`；main = Ascend `baa023ad`。本页 GLM 算例用的专用镜像是 Ascend `db701c1f`，它的入口声明与 v0.23 维护分支逐字相同 [C1][C11]。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `vllm.platform_plugins` | `ascend`，1 个 | 同 v0.23 | 同 v0.23 | 平台入口三边一样，认这一个名字就够 |
| `vllm.general_plugins` | 4 个 | 4 个，名字与顺序都没变 | 同 v0.23 | 这四个入口名可以当稳定契约用 |
| 第三组入口 | 没有 | 没有 | 多一组 `ms_service_metric.providers` → `vllm_ascend.observability:get_metric_provider` | 只有 main 会被指标框架扫到；照 main 的接入说明搬到发布分支上会找不到这个组 [C12] |
| `register_model` 的函数体 | 只调 `.models.register_model()` | 先注册 kimi-k3 的 config，再装一个 HunyuanVL processor 兼容补丁，然后才注册模型 | 同 v0.23 | v0.26 上这个入口已经不只是「往注册表加条目」：那个补丁模块顶部 `from transformers import HunYuanVLProcessor`，所以模型入口一执行就把 `transformers` 的这个 processor 类导进本进程 [C13] |

上游加载与选择这两个文件本页按 `vllm@0fc695fc` 逐行核过；v0.26 与 main 各自配套的上游快照没有逐行比对。

### 源码位置

| 结论 | 来源 |
|---|---|
| [C1] 五个入口的声明 | `vllm-ascend@db701c1f:setup.py#L543-L551` |
| [C2] 组名常量、按组取清单、通用组执行与去重 | `vllm@0fc695fc:vllm/plugins/__init__.py#L12-L25`、`#L28-L66`、`#L69-L82` |
| [C3] 平台候选探测、外部优先、冲突报错 | `vllm@0fc695fc:vllm/platforms/__init__.py#L212-L252` |
| [C4] 当前平台的懒加载与缓存 | `vllm@0fc695fc:vllm/platforms/__init__.py#L262-L281` |
| [C5] 昇腾五个入口函数、补丁幂等、模型登记 | `vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L35`、`#L38-L41`、`#L44-L75`；`vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L4-L25` |
| [C6] 前端调用点，以及不计入 19 次的另外两处：命令行参数、模型信息探测子进程 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L744-L747`、`#L2578-L2585`；`vllm@0fc695fc:vllm/model_executor/models/registry.py#L1406-L1411` |
| [C7] EngineCore 调用点 | `vllm@0fc695fc:vllm/v1/engine/core.py#L106-L109` |
| [C8] worker 调用点 | `vllm@0fc695fc:vllm/v1/worker/worker_base.py#L245-L247` |
| [C9] 导入平台类会连带拉起运行库 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L39-L39` → `vllm-ascend@db701c1f:vllm_ascend/utils.py#L33-L34` |
| [C10] 运行库只允许初始化一次、平台类定义 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L278-L279`、`#L128-L146` |
| [C11] v0.23 的入口声明与模型入口函数体 | `vllm-ascend@2c59ff10:setup.py#L543-L551`；`vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L72-L75` |
| [C12] main 的第三组入口与模型入口 | `vllm-ascend@baa023ad:setup.py#L506-L517`；`vllm-ascend@baa023ad:vllm_ascend/__init__.py#L106-L109` |
| [C13] v0.26 的入口声明、模型入口函数体与它导入的 processor 兼容补丁 | `vllm-ascend@2ed6cbba:setup.py#L543-L551`；`vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L72-L85`；`vllm-ascend@2ed6cbba:vllm_ascend/patch/hunyuan_vl_processor_compat.py#L8-L8` |
| [S1] 官方文档首页 | <https://docs.vllm.ai/projects/ascend/en/latest/index.html>（未联网验证） |

**待核。** 一是镜像里实际安装的上游产物：本页上游证据读的是 `vllm@0fc695fc` 的 Git 对象，镜像内安装后的文件没有单独核对。二是启动日志：`Platform plugin ascend is activated`、`Available plugins for group ...` 这两类行没有采集过实际输出，本页的次数与顺序都来自静态读码。三是 v0.26 与 main 配套上游快照里这两个文件的逐行差异。
