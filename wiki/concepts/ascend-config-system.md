---
id: ascend-config-system
title: "Ascend 配置：三个地方能写，哪个值真的生效"
type: feature
summary: 昇腾开关有三个入口——命令行通用参数、启动命令附带的那段 JSON、环境变量。本页讲它们怎样汇进每个进程各自的 AscendConfig，谁覆盖谁，构造与平台两道检查会怎样改写，以及官方 GLM 双机为什么一个 JSON 键都没传。
aliases: [AscendConfig, additional_config, additional-config, init_ascend_config, get_ascend_config, envs.py, AscendConfig 配置系统]
chapters: ["10"]
order: 100
sources:
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1488-L1490
  - vllm@0fc695fc:vllm/config/vllm.py#L355-L363
  - vllm@0fc695fc:vllm/config/vllm.py#L476-L486
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2223-L2230
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L94
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L160
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L256
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L560
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L745
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L30-L113
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L112-L124
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L200
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L676-L695
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L332
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L744-L782
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L120
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040
  - vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L430-L456
  - vllm-ascend@baa023ad:vllm_ascend/envs.py#L38-L90
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1536-L1605
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L876
verified: []
evidence: "C"
relations:
  - {to: engine-processes, kind: builds-on, note: 配置缓存是进程里的一个变量，进程边界决定它属于谁}
  - {to: ascend-patch-system, kind: builds-on, note: patch 换的是名字指向谁，发生得比配置更早}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: 官方双机命令写了哪些通用参数、每项取值管哪一步}
  - {to: npu-worker-lifecycle, kind: builds-on, note: Worker 初始化时建立本进程的配置状态}
contradicts: []
updated: "2026-09-28"
origin: seed
---

昇腾的开关不止一个入口：有的是 vLLM 自己的命令行参数，有的要写进启动命令附带的一段 JSON，还有一些只认环境变量。**AscendConfig 是 vllm-ascend 在每个进程里建的那个配置对象：它把这段 JSON 按键拆成几组子配置，执行时各处读到的昇腾开关，取值都来自它。** 这件事发生在服务启动的时候，对应主线的[启动那一站](glm-5-3-flash-two-node.md#启动时发生了什么)；一次定下来，之后每条请求都按它执行。

## 同一个开关，为什么有三个地方可以写

启动命令说的是这次服务要怎么跑：哪个模型、并行多大、每步多少 token、用什么方式执行。解析完，这些话分三路落地。

- **命令行通用参数**是上游 vLLM 声明的字段，解析后各自进总配置的模型、并行、调度几个部分。参数名写错，命令直接起不来。
- **启动命令附带的那段 JSON**（`--additional-config`）是上游留给具体平台的一个口子：上游把它声明成「给平台用的不透明字典」，自己不解释里面的键，只在算编译缓存 key 时把它整段算进去。键的含义由平台定义；绝大多数键归 vllm-ascend，但这个容器并不整个归它，上游自己也会往里写键，例如给 GDN prefill 选后端的那个。
- **环境变量**是 vllm-ascend 另外维护的一张表，钉住版本上 21 个名字。它们不进配置对象，用到的地方直接读，而且每次访问都重新读一遍当前进程的环境。

```wiki-diagram
file: config-inputs
```

图从左往右看：三路输入各有落点——通用参数进总配置自己的字段，JSON 里的键交给 AscendConfig 拆成几组子配置，环境变量分成两股，一部分名字作为兼容输入喂进同一个对象，其余由用到它的代码直接读。前两路都要再过平台这一关：不合法的组合在这里报错，有些值在这里被改写，执行时读到的才是最终值。只有「消费者直接读环境」这一股绕过了平台，这也是排查时最容易漏掉的一条路。

## 为什么不合成一路，代价是什么

为什么昇腾的开关不都做成正式参数？因为那要改上游的解析器。用一个容器装着，插件就能在不动上游的前提下加开关，代价是**上游不替它做任何检查**：键名拼错、层级放错，在钉住的两个发布分支上多半不报错，安静地走默认值。只有个别子配置自己查了一遍不认识的键，EPLB 那一组就会直接报错，详见[会报什么错](#会报什么错)。

为什么还留着环境变量？因为有的开关在配置建出来之前就要用。全局 patch 在解析参数时就要导入，比配置被读出来还早，所以它只能看环境变量，动态 EPLB 就是这样的例子（见[进程怎么摆决定要打哪些补丁](engine-processes.md#进程怎么摆直接决定要打哪些补丁)）。另一类环境变量与服务运行无关，是编译自定义算子时用的构建期变量。

| 入口 | 谁解释里面的名字 | 名字写错会怎样 |
| --- | --- | --- |
| 命令行通用参数 | 上游 vLLM 的解析器 | 参数不存在，命令直接失败 |
| JSON 容器里的键 | vllm-ascend；少数键归上游 | 钉住的两个分支静默忽略，走默认值 |
| 环境变量 | 用到它的代码，或作为兼容输入喂进配置 | 不在表里就没人读，同样没有提示 |

三个入口并存还有两笔隐性代价。第一，那段 JSON 整段进编译缓存 key，改任何一个键都会让上一次的编译结果失效，下次启动要重新编译。第二，同一件事有两处能写，就必须有优先级规则，而这套规则本身是过渡性的：源码在用到环境变量回退时会打日志，明说下一个版本就要删掉那个环境变量。

## JSON 进来以后被拆成什么

建配置时，代码从字典里按键取出子字典，各自交给一个子配置类。构造函数开头一次取出七组，rejection sampler 那一组在后面单独取，钉住版本上一共八组。每组先写它在 JSON 里的键名，再说它管什么：

- `xlite_graph_config`：Xlite 图模式。Xlite 是 openEuler 提供的一套图执行库，开启后平台把 Worker 换成 Xlite 专用的那一个。
- `ascend_compilation_config`：图编译阶段的昇腾选项，多数是某个融合 pass 开不开（例如把 norm 和紧跟的量化融成一个算子）。
- `ascend_fusion_config`：要不要换用某个融合算子，钉住版本上只有一项，管 MoE 里 GMM、SwiGLU 和量化三步合一的那个算子。
- `finegrained_tp_config`：fine-grained TP（细粒度 TP），给个别模块单独设一个 TP 规模，而不是全模型用同一个——注意力的输出投影、词嵌入、LM head（输出端把隐状态映射回词表的那一层）等五个模块各有一个字段，见[细粒度 TP](fine-grained-tp.md)。
- `eplb_config`：EPLB（专家负载均衡），统计每个专家的负载，再调整专家放在哪张卡上，见 [EPLB](eplb.md)。
- `weight_prefetch_config`：权重预取，算到某一部分之前先把它的权重提前取过来，注意力、MoE、MLP 各有预取比例。
- `profiling_chunk_config`：profiling 分块。启动时量一遍 prefill 耗时、拟合出一条曲线，运行时按它决定 prefill 每次切多大块。
- `rejection_sampler_config`：rejection sampler 的选项。rejection sampler 是投机解码里核对草拟 token、决定接受其中哪几个的那一步，见[投机解码](speculative-decoding.md)。

剩下的开关是顶层的单个字段，直接从字典里取。

**层级决定谁能读到。** 子配置只从属于自己那一层的字典里取键，所以把一个属于子配置的键写在顶层，没人会读它；顶层键和子配置里的同名键也不自动等价。一个键该放哪一层，只能看源码里它是从哪个字典取的，看不出层级就不要照别的版本的写法抄。

拆出来的结果存在一个模块级变量里，属于建它的那个进程。别的进程要用，得在自己的进程里再建一份。这套进程边界、它在 fork 与 spawn 下的差别、以及由此得出的排查原则，在[补丁和配置为什么要每个进程各做一遍](engine-processes.md#补丁和配置为什么要每个进程各做一遍)讲清了，本页不重复。[Patch](ascend-patch-system.md) 换的是某个名字指向谁，发生得比配置更早，两件事不要混。

## 三路撞在一起时，谁说话

大多数字段只看 JSON：写了就用你写的，没写就用代码里的默认值。

钉住版本上有九个字段例外：它们既认 JSON 里的键，也认一个环境变量。规则只看**键在不在字典里**——在，就用键的值，所以显式写 false 也能盖掉环境里的开启值；不在，才用环境读到的值，包括环境没设时读取器给出的那个默认值。

| JSON 里写了什么 | 环境读到什么 | 这个字段的解析结果 |
| --- | --- | --- |
| true | false | true |
| false | true | false |
| 没写这个键 | true | true |
| 没写这个键 | 环境没设，读取器给默认值 | 用那个默认值 |

这九对的名字不能靠猜：NZ 权重格式那个字段在 JSON 里叫 `weight_nz_mode`，对应的环境变量却叫 `VLLM_ASCEND_ENABLE_NZ`；监控守护进程那个字段对应的环境变量连昇腾前缀都没有。完整清单在[怎么开](#怎么开)。所以「全大写的去环境变量表里找、小写下划线的去配置里找」只能当线索，不能当判断规则。

剩下的环境变量没有对应的键，只由用到它的代码直接读。这里还有一个时机差别：配置对象里的那份值，在建对象的那一刻就定住；直接读环境的代码每次访问都重新读。所以服务跑起来之后改环境变量，前者不会变，后者会变。

## 解析完还会被改写：生效值不是你写的值

解析只是拿到字段值。字段值要变成执行时真正用的值，还要过两道。

**第一道在建配置的时候。** 组合不合法当场报错，有些值会按别处的预算被裁剪：profiling 分块要求 pipeline parallel 大于 1（把一层层的计算分给多台机器接力的那种并行），只开分块不开它直接报错；分块和均衡调度不能同时开，同时开也报错；分块的最小块如果大于每步 token 预算，会被裁到预算值并打一条日志；fine-grained TP 里只要注意力输出投影（`oproj_tensor_parallel_size`）或词嵌入（`embedding_tensor_parallel_size`）的规模大于 0，就要求同时打开重算调度，否则报错——这两处要跨 DP 做集合通信，每个 DP rank 的 token 数必须一样，只有重算调度能把它们拉齐。LM head 那个字段（`lmhead_tensor_parallel_size`）不在这条约束里。

**第二道在平台准备阶段。** 平台先跑四个校验，再建配置，建完还会按角色改写：在 PD 分离（prefill 和 decode 拆成两组实例）的 producer 一侧，重算调度开关会被忽略并重置为关，只打一条警告；既不是 producer 也不是 consumer 却开了它，直接报错。校验族完整清单见 [NPU 平台](npu-platform.md#校验与改写怎样影响执行)。

```wiki-diagram
file: config-flow
```

图从上往下是启动时的先后。要点在中间那一步：平台和每个 Worker 进程调的是同一个建配置函数，函数先问缓存能不能复用——已经有一份、绑定的还是同一个总配置对象、没在 JSON 里写刷新标记、而且已有那份通过了完整性检查，四条都成立才复用，否则重新逐键解析一遍。新建的那份如果没通过完整性检查，代码只打警告、不更新缓存，但仍然把它返回给调用方。

取的一侧只有一个动作：从缓存里拿。**没建过就来取，会直接报错说配置还没初始化**——这条报错说的是时机不对，不是 JSON 内容写错了。JSON 内容写错的典型表现恰恰是一点报错都没有。

## 落到 GLM 双机：一个 JSON 键都没传

官方双机教程的两条启动命令里**没有那段 JSON**：昇腾这边一个键都没配。所以八组子配置全部拿默认值坐在那儿，顶层字段也都是默认值；那九个字段既然没写键，取的就是环境读到的值，而在教程命令没有另设这些环境变量的情况下，它们也落在读取器给的默认值上。基线的这组结论以「固定命令 + 默认环境」为前提，镜像里若额外注入过环境变量，就要按实际环境重核。

主线正是按这些默认分支读代码的，几个后面会用到的：

- 采样归约那个顶层开关（`enable_reduce_sample`）是关的，所以 logits 归约走通用路径；
- fine-grained TP 里 LM head 的规模是 0，也就是 LM head 不单独设 TP 规模，跟着整体的 TP 走；
- FlashComm1 是关的。FlashComm1 是 vllm-ascend 对[序列并行](sequence-parallel.md)的实现，让 TP 之后的激活按 token 分到各 rank；它没开，判断序列并行是否启用的那个函数就返回假；
- rejection sampler 的分块验证与熵验证两个开关都是关的。

这四条的证据集中在[来源基线](../sources/glm-5-3-flash-baseline.md)，那里也写明它们是「固定命令 + 默认环境」下的基线，用户另加开关就不适用。

教程真正写在命令里的是通用参数，每一项管一件事（取值、作用和推导见[部署前提](glm-5-3-flash-two-node.md#部署前提)与[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)，完整命令见教程本身）：

- 显存预算比例 0.85：决定能切出多少 KV 块；
- 每步 token 预算 8192：限制一步的计算量，长提示词按它分段；
- 每步请求数上限 32：限制批处理宽度，也决定了最大的图尺寸；
- 单请求长度上限 133120 token：同时决定块表最大长度和 KDA 状态组的块长；
- MTP（Multi-Token Prediction，模型自带的多 token 预测层，这里拿来草拟候选，见[投机解码](speculative-decoding.md)）每轮草拟 3 个 token：决定 decode 一步每请求送几行；
- 主模型图模式只录纯 decode 步，捕获尺寸七档。

于是有一条对后面各页都有效的结论：**本部署里凡是说「某个昇腾特性没开」，依据是命令里没有那段 JSON、也没设对应环境变量，不是代码里没有这个特性。** 各特性页讲自己的开关时，默认值都要回到这里对齐。

## 排查时怎样从症状回到某一路

- **配了却没有效果。** 先确认这个键在你用的版本里真的存在、层级放对了；再看日志里这个字段是从 JSON 取的还是从环境回退来的；最后看消费者那一侧的条件分支——解析出 true 只表示配置选择，能不能执行还要看平台检查和消费者条件。
- **报「配置还没初始化」。** 这是时机问题：取配置的代码跑在建配置之前，或者跑在一个还没建过配置的进程里。先认清自己在哪个进程，再看这个进程有没有建配置的入口。
- **启动时直接拒绝某个组合。** 按报错定位到是哪一道检查，再去看它要求的前提；不要靠删掉检查来判断这个组合可用。
- **改了环境变量却没变。** 如果这个名字属于那九对之一，它的值在建配置时就定住了，服务跑起来之后改它不会生效；重启才会。

## 常见误解

- **「这段 JSON 是上游 vLLM 的功能，文档该在上游」**——上游只提供容器、原样保存、把它算进编译缓存 key，键的含义几乎全由 vllm-ascend 定义。查键要看昇腾的源码。
- **「环境变量和 JSON 是两条互不相通的路」**——钉住版本上有九个名字两边都认。把「全大写去环境变量表找、小写下划线去配置找」当成判断规则，就会漏掉这九个，也会误以为显式写 false 没有意义。
- **「取不到配置是因为 JSON 写错了」**——那条报错说的是时机。JSON 写错在这两个发布分支上不报错。
- **「同一个进程里配置只解析一次」**——通常是，但 JSON 里带刷新标记时会重建，绑定的总配置对象换了也会重建。
- **「拼错键名总会报错」和「拼错键名从不报错」都不对**——钉住的两个发布分支上，顶层和多数子配置安静走默认，EPLB 那一组会报错；main 换成 pydantic 之后一律报错。结论要连版本和所在层级一起说。

## 对照源码

### 怎么开

**JSON 这条路。** 启动命令加 `--additional-config '{...}'`（上游注册的参数），上游原样存进 `VllmConfig.additional_config`；解释它的是 `AscendConfig.__init__`，主体是一串固定形状的两行——从字典里 `.get()` 一个键拿到子字典，再交给对应的子配置类。钉住版本上这样构造出来的子配置类有八个：`XliteGraphConfig`、`AscendCompilationConfig`、`AscendFusionConfig`、`FinegrainedTPConfig`、`EplbConfig`、`WeightPrefetchConfig`、`ProfilingChunkConfig`、`RejectionSamplerConfig`。顶层字段直接 `.get()`，例如 `recompute_scheduler_enable`、`enable_shared_expert_dp`、`enable_reduce_sample`。所以「某个键叫什么、在哪一层」的答案都在 `ascend_config.py` 一个文件里，搜键名就能看出它属于哪个子配置。

**九对兼容映射的完整清单**（键在字典里就用键，否则用环境值）：

| JSON 里的键 | 对应的环境变量 |
| --- | --- |
| `enable_balance_scheduling` | `VLLM_ASCEND_BALANCE_SCHEDULING` |
| `enable_flashcomm1` | `VLLM_ASCEND_ENABLE_FLASHCOMM1` |
| `enable_matmul_allreduce` | `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` |
| `enable_fused_mc2` | `VLLM_ASCEND_ENABLE_FUSED_MC2` |
| `enable_mlapo` | `VLLM_ASCEND_ENABLE_MLAPO` |
| `enable_flashcomm2_parallel_size` | `VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE` |
| `msmonitor_use_daemon` | `MSMONITOR_USE_DAEMON` |
| `enable_transpose_kv_cache_by_block` | `VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` |
| `weight_nz_mode` | `VLLM_ASCEND_ENABLE_NZ` |

判断逻辑在 `_get_config_value`：`config_key in additional_config` 为真就返回字典里的值，否则返回传进来的环境值；走回退时按 `env_key in os.environ` 决定要不要打那条「下个版本将删除该环境变量」的提示。

**环境变量这条路。** `vllm_ascend/envs.py` 里一张 `env_variables` 表，钉住版本 21 条，其中 9 条带 `VLLM_ASCEND_` 前缀，其余是构建期变量（编译并发度、编译类型、是否编自定义算子、芯片型号、CANN 安装路径等）和通用项。模块的 `__getattr__` 是懒读：每次访问 `envs_ascend.X` 都会重新调一遍那个 lambda，读当前的 `os.environ`。

**昇腾还会往解析器里补选项。** 平台钩子 `pre_register_and_update` 在解析参数阶段把 `ascend` 加进 `--quantization` 的候选，所以 `--quantization ascend` 不是上游自带的取值。

**建与取。** `init_ascend_config(vllm_config)` 建（复用条件见正文），`get_ascend_config()` 取，`clear_ascend_config()` 清缓存时会连带清掉派生的序列并行判断缓存。调用点：`NPUPlatform.check_and_update_config` 里在四个校验之后；`NPUWorker.__init__` 里在登记昇腾算子之后、`super().__init__()` 之前；另外 profiling 分块的调度器和两个 mooncake connector 也各有一处。

### 会报什么错

- `RuntimeError: Ascend config is not initialized. Please call init_ascend_config first.` —— 取配置时缓存为空或未通过完整性检查。它说明取的时机不对，不是 JSON 内容错。
- `ValueError`：profiling 分块要求 pipeline parallel 大于 1；以及分块与 `enable_balance_scheduling` 不能同时开。两条都在建配置时抛出。
- `AssertionError`：`finegrained_tp_config` 里 `oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 时，要求 `recompute_scheduler_enable=true`；`lmhead_tensor_parallel_size` 不受这条约束。
- `ValueError`（平台阶段）：开了重算调度但角色既不是 PD 的 producer 也不是 consumer。在 producer 上则只警告并把它重置为关。
- `ValueError`（平台阶段，只在 v0.23）：层切分配置那个校验会拦掉不合法组合。它是「同一个键在一个版本上会被拦、在另一个版本上压根不存在」的例子——`layer_sharding` 在 v0.26 与 main 的配置代码里已经没有了。
- `ValueError: Config has no attribute '<键名>'`：`eplb_config` 这一组是自己遍历用户字典的，遇到它不认识的键当场抛错。所以「未识别的键一律静默忽略」不成立，要按子配置类分别看。
- **不报错的两种情况：** 顶层和多数子配置里未识别的键（顶层全程 `.get()`，接 `**` 的 `AscendCompilationConfig` 与 `AscendFusionConfig` 带 `**kwargs` 兜底，其余几个子配置也是逐键 `.get()`）；新建实例没通过完整性检查时只打警告、不更新缓存。

### 开销和什么时候别开

配置本身的开销可以忽略：一次解析，每个进程一个对象。真正要权衡的是用法。

- 那段 JSON 整段进编译缓存 key，改任何一个键都会让上一次的编译结果失效，下次启动重新编译。
- 靠环境变量打开的开关不进配置对象，平台校验看不到它，也不会出现在配置相关的日志里；排查时要单独看一眼环境。
- 九对兼容映射按源码日志的说法下一个版本就要删，不要写进长期运维脚本；v0.26 上调度相关的顶层键也已经打 deprecated 警告。
- 官方双机配方一个键都没传。要加键就是偏离这套已验证组合，一次只改一项，并且记下改的是哪一层。

### 版本差异

按知识库固定快照核对：v0.23 维护分支为 Ascend 2c59ff10，v0.26 为 Ascend 2ed6cbba，main 为 Ascend baa023ad。**本部署跑的是专用镜像 Ascend db701c1f，它与 v0.23 维护快照同属 0.23 系但是两个不同提交：GLM 的模型代码与配置 patch 只在镜像里，维护快照上只有两个工具调用 patch。下表 v0.23 列的键构成与条目数核自镜像 db701c1f，在 2c59ff10 上是否逐项相同未核。**

| 项 | v0.23 | v0.26 | main | 意味着什么 |
| --- | --- | --- | --- | --- |
| 解析方式 | 逐键 `.get()` + 手写校验 | 一样是逐键 `.get()` | 迁到 pydantic dataclass（`extra="forbid"`） | 照 main 的严格校验去两个发布分支上找会扑空 |
| 未识别的键 | 顶层与多数子配置静默忽略，`eplb_config` 那一组报错 | 同左 | 一律直接报错，拼错立即失败 | 同一个拼错，一边多半安静走默认、一边起不来 |
| 调度相关键的层级 | 只有顶层 | 推荐嵌在 `scheduler_config` 下；顶层仍认但打 deprecated 警告，两处都写以嵌套为准 | 仍有 `scheduler_config` 这一层 | 按 v0.23 把这些键写在顶层，在 v0.26 上会看到弃用警告 |
| 子配置构成 | 八组，含权重预取与 profiling 分块 | 权重预取已删，profiling 分块挪进 `scheduler_config`，新增批作业调度与短请求优先 | 随 pydantic 化重排，用时另核 | 按 v0.23 配权重预取，在 v0.26 上不报错也不生效 |
| 环境变量回退 | 九对兼容映射 | 顶层 6 个字段加 `scheduler_config` 里的均衡调度 | 已无这条回退（`_get_config_value` 不再存在） | main 上环境变量不再能替代 JSON 键 |
| `env_variables` 条目 | 21 条，9 条带昇腾前缀 | 20 条，8 条带前缀 | 14 条，3 条带前缀 | 环境变量这条路在收窄，开关正逐步归到 JSON 里 |
| 建配置前的平台校验 | 四个，含层切分配置校验 | 两个，层切分那个键已删 | 三个：一个类方法（索引器与 pipeline parallel）加两个模块级函数（投机 + DCP、并行），见 [NPU 平台的版本差异](npu-platform.md#版本差异) | 「配了会被拦」还是「压根不存在」，取决于版本 |
| 进程内缓存 | 模块变量 + 刷新标记 + 绑定同一个总配置 | 同左 | 仍是模块变量，另用一个变量记住绑定的总配置 | 三个版本都是每进程一份，不是跨进程单例 |

### 源码位置

| 想核对什么 | 固定源码位置 |
| --- | --- |
| `--additional-config` 的注册 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L1488-L1490` |
| 上游把它当不透明字典、只算进 hash | `vllm@0fc695fc:vllm/config/vllm.py#L355-L363`；`vllm@0fc695fc:vllm/config/vllm.py#L476-L486` |
| 上游自己往容器里写键 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L2223-L2230` |
| 逐键拆出七组子配置、前两对兼容映射、分块的两条校验 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L94` |
| 顶层字段与 fine-grained TP 的那条断言 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L160` |
| 其余七对兼容映射与顶层开关 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L256` |
| 优先级判断与迁移提示 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346` |
| `finegrained_tp_config` 的五个字段（默认都是 0） | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L560` |
| 权重预取与 profiling 分块子配置 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L745` |
| `rejection_sampler_config` 子配置（两个开关默认关） | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L744-L782` |
| 采样归约开关默认关、`rejection_sampler_config` 的取出 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L332` |
| 建、取、清与完整性检查 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925` |
| 环境变量表与懒读 | `vllm-ascend@db701c1f:vllm_ascend/envs.py#L30-L113`；`vllm-ascend@db701c1f:vllm_ascend/envs.py#L112-L124` |
| 平台补 `--quantization` 候选 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L200` |
| 四个校验与建配置的先后 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480` |
| 按 PD 角色改写重算调度 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L676-L695` |
| Worker 里建本进程那一份 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126` |
| v0.26 的顶层构造与嵌套层 | `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L120`；`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040` |
| v0.26 的环境变量表 | `vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107` |
| main 的 pydantic 化与拼错即失败 | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L430-L456` |
| main 的环境变量表与缓存 | `vllm-ascend@baa023ad:vllm_ascend/envs.py#L38-L90`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1536-L1605` |
| EPLB 子配置自己拒绝未识别的键 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L876` |
| 三版平台校验数量对照 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480`；`vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426`；`vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495` |

**正文证据归档。** 容器由上游声明为不透明字典、整段进编译缓存 key、上游自己也往里写键：[C2][C3][C4][C5]。逐键拆分、层级不等价、构造期那几条检查与顶层字段：[C6][C7][C8]；EPLB 子配置对未识别键报错：[C30]。键优先于环境值的判断与迁移提示：[C9]。环境变量表与每次访问重读：[C14]。平台补选项、四校验在建配置之前、建完按角色改写：[C15][C16][C17]。建、取、清三件事与复用的四个条件：[C12]；Worker 侧的调用点：[C18]。GLM 双机命令没有那段 JSON：[S1]；四条默认分支：[C10][C19][C20]，基线结论汇总在[来源基线](../sources/glm-5-3-flash-baseline.md)。v0.26 的嵌套层与 main 的 pydantic 化：[C22][C24]；三版建配置前的校验数量：[C28][C29]。

子配置八组、兼容映射九对、环境变量表 21 条里 9 条带昇腾前缀，都是照上述源码数出来的计数 [D]。这里两个「9」不是同一批名字：兼容映射的九对里有一对的环境名不带昇腾前缀，而带前缀的那 9 条里也有一条没参与映射 [D]。三版条目数 21 / 20 / 14 同理 [D]。「本部署的昇腾开关全部是默认值」由教程命令与解析代码合起来得出 [D]；「main 上环境变量不再能替代 JSON 键」的依据是那个回退函数在 main 上已不存在 [D]，属于按缺失推断，不是某一行代码 [I]。

**待核。**

- 没有镜像内的实际启动日志，因此「哪些字段来自 JSON、哪些来自环境回退」在真实部署里的日志样貌未核；本页的日志描述来自钉住源码的字符串。
- 官方教程为文档提交，不等于镜像里运行的代码；教程未传 JSON 这一点已核，但镜像是否额外注入环境变量待安装产物核对。
- main 分支 pydantic 化之后子配置的完整构成与默认值未逐项核，版本差异表该行只写了迁移事实。
