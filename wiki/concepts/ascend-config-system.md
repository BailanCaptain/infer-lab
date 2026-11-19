---
id: ascend-config-system
title: Ascend 配置：三个地方能写，哪个值真的生效
type: feature
summary: >-
  昇腾开关有三个入口——命令行通用参数、启动命令附带的那段 JSON、环境变量。本页讲它们怎样汇进每个进程各自的
  AscendConfig，谁覆盖谁，构造与平台两道检查会怎样改写，以及官方 GLM 双机为什么一个 JSON 键都没传。
aliases:
  - AscendConfig
  - additional_config
  - additional-config
  - init_ascend_config
  - get_ascend_config
  - envs.py
  - AscendConfig 配置系统
chapters:
  - '10'
order: 100
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1488-L1490'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L355-L363'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L476-L486'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2223-L2230'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L94'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L160'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L256'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L560'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L745'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L30-L113'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L112-L124'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L200'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L676-L695'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L107-L126'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L332'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L744-L782'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L360'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L430-L608'
  - 'vllm-ascend@baa023ad:vllm_ascend/envs.py#L38-L90'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1536-L1700'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L876'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L317-L346'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L609-L628'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - >-
    raw:sha256-e33d10f727ae241a4c63517340397bd46f2b5da6eed35c991c5eb541a6ca79a9.md#L1-L1264
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L565-L677'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1793-L1944'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L752-L806'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L679'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L283-L314'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L204-L239'
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L956-L966'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L268-L276'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L82-L143
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L1024-L1084'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L80-L89'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1624-L1635'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1176-L1187'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L579-L682'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L17-L57'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L867-L874'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L659'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1402-L1440'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L562-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L745-L756'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1795-L1951'
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L652-L737'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L845-L865'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1909-L2078'
  - 'vllm-ascend@8d6180e2:vllm_ascend/envs.py#L51-L95'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L685'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: engine-processes
    kind: builds-on
    note: 配置缓存是进程里的一个变量，进程边界决定它属于谁
  - to: ascend-patch-system
    kind: builds-on
    note: patch 换的是名字指向谁，发生得比配置更早
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 官方双机命令写了哪些通用参数、每项取值管哪一步
  - to: npu-worker-lifecycle
    kind: builds-on
    note: Worker 初始化时建立本进程的配置状态
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-1d32b572cfa7effcf6bc2b6876b3b8d672a41e7c59caf52ef95d8903f1aa02f7.md
  - >-
    raw/sha256-e33d10f727ae241a4c63517340397bd46f2b5da6eed35c991c5eb541a6ca79a9.md
---

昇腾的开关不止一个入口：有的是 vLLM 自己的命令行参数，有的要写进启动命令附带的一段 JSON，还有一些只认环境变量。**AscendConfig 是 vllm-ascend 的进程内配置对象：它把这段 JSON 按键拆成几组子配置，供 Worker、调度器和算子等使用。** 另一些选项直接来自上游总配置或环境变量。对象通常在[服务启动](glm-5-3-flash-two-node.md#启动时发生了什么)时建立并缓存；实际执行还要看后续派生、改写和消费者的条件判断。

## 同一个开关，为什么有三个地方可以写

启动命令说的是这次服务要怎么跑：哪个模型、并行多大、每步多少 token、用什么方式执行。解析完，这些话分三路落地。

- **命令行通用参数**是上游 vLLM 声明的字段，解析后各自进总配置的模型、并行、调度几个部分。参数名写错，命令直接起不来。
- **启动命令附带的那段 JSON**（`--additional-config`）是上游留给具体平台的一个口子：上游把它声明成「给平台用的不透明字典」，自己不解释里面的键，只在算编译缓存 key 时把它整段算进去。键的含义由平台定义；绝大多数键归 vllm-ascend，但这个容器并不整个归它，上游自己也会往里写键，例如给 GDN prefill 选后端的那个。
- **环境变量**有专门的读取表，固定旧 GLM 版本上列出 21 个名字；还有代码直接调用 `os.getenv` 读取表外的名字。一部分值作为兼容输入进入 AscendConfig，其余由消费者直接读取。读取表的属性访问会重新读当前进程的环境，下文会区分它与已经缓存的配置值。

```wiki-diagram
file: config-inputs
```

图从左往右看：三路输入各有落点——通用参数进总配置自己的字段，JSON 里的键交给 AscendConfig 拆成几组子配置，环境变量分成两股，一部分名字作为兼容输入喂进同一个对象，其余由用到它的代码直接读。配置构造与平台准备都会检查或改写部分值，消费者还可以有自己的限制。直接读环境的路径不一定经过 AscendConfig；排查时也要找到它的消费者，不能据此认定它完全没有校验。

## 为什么不合成一路，代价是什么

为什么昇腾的开关不都做成正式参数？因为那要改上游的解析器。用一个容器装着，插件就能在不动上游的前提下加开关，代价是**平台键的含义和组合限制要由平台自己检查**，而 JSON 语法、容器类型和可计算 hash 等仍须满足上游要求。键名拼错、层级放错，在固定旧 GLM、v0.23 和 v0.26 rc 的逐键读取路径上多半不报错，安静地走默认值；EPLB 等自己检查未知键的子配置则会报错，详见[会报什么错](#会报什么错)。

为什么还留着环境变量？因为有的开关在配置建出来之前就要用。全局 patch 在解析参数时就要导入，比配置被读出来还早，所以它只能看环境变量，动态 EPLB 就是这样的例子（见[进程怎么摆决定要打哪些补丁](engine-processes.md#进程怎么摆直接决定要打哪些补丁)）。另一类环境变量与服务运行无关，是编译自定义算子时用的构建期变量。

| 入口 | 谁解释里面的名字 | 名字写错会怎样 |
| --- | --- | --- |
| 命令行通用参数 | 上游 vLLM 的解析器 | 参数不存在，命令直接失败 |
| JSON 容器里的键 | vllm-ascend；少数键归上游 | 旧版（v0.23 / v0.26 rc）顶层和多数子配置忽略未知键，EPLB 等例外会报错；v0.30.0 与 main 迁至 `extra="forbid"` 严格拒收（安装 `vllm_omni` 时未知顶层键先告警后过滤） |
| 环境变量 | 用到它的代码，或作为兼容输入喂进配置 | 名字拼错通常没有统一提示；表外也可能有直接读取，必须查消费者 |

三个入口并存还有两笔隐性代价。第一，上游把非空 JSON 的完整内容纳入配置 hash；更改内容会影响缓存标识。默认编译缓存目录由配置、环境、代码和编译器等 hash 共同生成，所以不能只改一个“看起来不影响模型”的键就保证命中旧缓存；这也不等于删除已有缓存，是否编译还取决于编译模式、缓存开关和目标缓存是否已有产物。第二，同一件事有两处能写，就必须有优先级规则。旧版在使用已设置的环境变量回退时打印“下个版本移除”的迁移提示；到了 `v0.30.0`，`AscendConfig` 已完成字段收口，`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON` 等旧兼容环境变量均已从 `envs.py` 退役并统一收归 `additional_config` 对应字段，仅保留 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 的环境变量兜底读取；实际迁移行为仍要以目标版本代码为准。

## JSON 进来以后被拆成什么

建配置时，代码从字典里按键取出子字典，各自交给一个子配置类。构造函数开头一次取出七组，rejection sampler 那一组在后面单独取，钉住版本上一共八组。每组先写它在 JSON 里的键名，再说它管什么：

- `xlite_graph_config`：Xlite 图模式，使用另一条图执行路径。固定旧 GLM 平台在 Worker 类仍为 `auto`、且不走 310P 分支时，才按这个开关选 Xlite 专用 Worker。
- `ascend_compilation_config`：图编译阶段的昇腾选项，多数是某个融合 pass 开不开（例如把 norm 和紧跟的量化融成一个算子）。
- `ascend_fusion_config`：要不要换用某个融合算子，钉住版本上只有一项，管 MoE 里 GMM、SwiGLU 和量化三步合一的那个算子。
- `finegrained_tp_config`：fine-grained TP（细粒度 TP），给个别模块单独设一个 TP 规模，而不是全模型用同一个——注意力的输出投影、词嵌入、LM head（输出端把隐状态映射回词表的那一层）等五个模块各有一个字段，见[细粒度 TP](fine-grained-tp.md)。
- `eplb_config`：EPLB（专家负载均衡），统计每个专家的负载，再调整专家放在哪张卡上，见 [EPLB](eplb.md)。
- `weight_prefetch_config`：权重预取，算到某一部分之前先把它的权重提前取过来，注意力、MoE、MLP 各有预取比例。
- `profiling_chunk_config`：profiling 分块。启动时量一遍 prefill 耗时、拟合出一条曲线，运行时按它决定 prefill 每次切多大块。
- `rejection_sampler_config`：rejection sampler 的选项。rejection sampler 是投机解码里核对草拟 token、决定接受其中哪几个的那一步，见[投机解码](speculative-decoding.md)。

剩下的开关是顶层的单个字段，直接从字典里取。

**层级决定谁能读到。** 子配置只从属于自己那一层的字典里取键，所以把一个属于子配置的键写在顶层，没人会读它；顶层键和子配置里的同名键也不自动等价。一个键该放哪一层，只能看源码里它是从哪个字典取的，看不出层级就不要照别的版本的写法抄。

拆出来的结果存在一个模块级变量里，属于当前进程。spawn 出来的新解释器要初始化自己的缓存；fork 可以继承当时的进程内状态，但后续修改不自动跨进程同步。这套边界与排查原则见[补丁和配置为什么要每个进程各做一遍](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。[Patch](ascend-patch-system.md) 换的是某个名字指向谁，全局 patch 可以早于配置构造，两件事不要混。

## 三路撞在一起时，谁说话

大多数用户输入字段先从 JSON 取值，缺省时用声明的默认值；这一步之后还会有校验、派生和条件改写。

固定旧 GLM 版本上有九个字段例外：它们既认 JSON 里的键，也认一个环境变量。**在环境读取成功的前提下，选择规则看键在不在字典里**——在，就用键的值，所以显式写 false 也能盖掉环境里的开启值；不在，才用环境读到的值，包括环境没设时读取器给出的默认值。调用者会先求出环境值，再把它传给选择函数；如果整数转换遇到非法环境字符串，即使 JSON 已写该键，也可能在选择前报错。

| JSON 里写了什么 | 环境读到什么 | 这个字段的解析结果 |
| --- | --- | --- |
| true | false | true |
| false | true | false |
| 没写这个键 | true | true |
| 没写这个键 | 环境没设，读取器给默认值 | 用那个默认值 |

这九对的名字不能靠猜：NZ 权重格式那个字段在 JSON 里叫 `weight_nz_mode`，对应的环境变量却叫 `VLLM_ASCEND_ENABLE_NZ`；监控守护进程那个字段对应的环境变量连昇腾前缀都没有。完整清单在[怎么开](#怎么开)。所以「全大写的去环境变量表里找、小写下划线的去配置里找」只能当线索，不能当判断规则。

剩下的环境变量没有对应的键，只由用到它的代码直接读。这里还有一个时机差别：配置对象里的那份值，在建对象的那一刻就定住；环境读取器每次访问时读的是当前进程的 os.environ。只有同一运行进程的环境映射确实被修改，后续未缓存的读取才可能看到新值；启动终端里重新 export 不会修改已经运行的服务及其他 Worker 的环境。部署配置应在重启后核对，不能把懒读当作服务热更新。

## 解析完还会被改写：生效值不是你写的值

解析只是拿到字段值。字段值要变成执行时真正用的值，还要过两道。

**第一道在建配置的时候。** 组合不合法当场报错，有些值会按别处的预算被裁剪：启用 profiling 分块要求 pipeline parallel 大于 1，即把层分到多个阶段接力，阶段可以在同机或跨机；它与均衡调度不能同时开；启用后最小块若大于每步 token 预算，会被裁到预算值并打一条日志。即使没有启用分块，所传 `min_chunk`、`smooth_factor`、`max_fit_chunk` 仍要通过子配置的范围检查。fine-grained TP 里只要注意力输出投影（`oproj_tensor_parallel_size`）或词嵌入（`embedding_tensor_parallel_size`）的规模大于 0，固定旧 GLM 实现就要求 `recompute_scheduler_enable=true`，以满足这条路径的 token 对齐和通信前提；这不是对所有版本、所有对齐机制的通用断言。LM head 那个字段（`lmhead_tensor_parallel_size`）不在这条约束里。

**第二道在平台准备阶段。** 平台先跑前置校验，再建配置，建完还会按角色改写：在 PD 分离（prefill 和 decode 拆成两组实例）的 producer 一侧，重算调度开关会被忽略并重置为关，只打一条警告；既不是 producer 也不是 consumer 却开了它，直接报错。校验族完整清单见 [NPU 平台](npu-platform.md#校验与改写怎样影响执行)。下图保留固定旧 GLM 的逐键解析；`v0.30.0` 与 `main` 下的 `extra="forbid"` 严格校验、环境变量退役与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 兜底规则见[版本差异](#版本差异)。

```wiki-diagram
file: config-flow
```

图从上往下是固定旧 GLM 的调用先后。平台和 Worker 构造函数调的是同一个建配置函数，先问缓存能不能复用——已经有一份、绑定的还是同一个总配置对象、`refresh` 值为假、已有对象带着检查所要求的两个子配置属性，四条都成立才复用。这项完整性守卫只检查 `ascend_compilation_config` 与 `eplb_config` 是否存在，不能代替所有业务校验。新建对象若没通过该守卫，只打警告、不更新旧缓存，但仍返回给调用方。修改同一个总配置对象里的字典而不触发重建，也不会自动重新解析这些字段。

取的一侧从缓存拿对象并检查那两个必要属性。**缓存为空或缺少必要属性，会报配置还没初始化**；先核对本进程的初始化顺序。JSON 内容错误另由语法、类型或具体配置检查处理，旧版未知键静默忽略只是其中一种情况。

## 落到 GLM 双机：一个 JSON 键都没传

官方双机教程的两条启动命令里**没有 `--additional-config`**，因此没有通过这个 CLI 容器覆盖昇腾键。构造从字段默认值、环境回退和通用配置开始，随后仍会按模型、硬件与 PD 角色派生或改写，不能因此说所有最终字段都是固定默认值。下面的具体判断以「固定命令 + 默认环境」为前提；镜像注入的环境和安装产物中的改写要另行核对。

主线正是按这些默认分支读代码的，几个后面会用到的：

- 采样归约那个顶层开关（`enable_reduce_sample`）是关的，所以 logits 归约走通用路径；
- fine-grained TP 里 LM head 的规模是 0，也就是 LM head 不单独设 TP 规模，跟着整体的 TP 走；
- FlashComm1 的显式配置默认关。它是[序列并行](sequence-parallel.md)的一条启用入口，让激活按 token 分到 TP rank；实际 `enable_sp` 还可被共享专家条件改为真，因此“SP 关闭”的教学基线另要求该覆盖条件未启用；
- rejection sampler 的分块验证与熵验证两个开关都是关的。

这四条的共同条件集中在[来源基线](../sources/glm-5-3-flash-baseline.md)，其中 SP 关闭是附加共享专家条件后的教学假设；实际调用值与安装环境决定部署是否满足它。

教程真正写在命令里的是通用参数，每一项管一件事（取值、作用和推导见[部署前提](glm-5-3-flash-two-node.md#部署前提)与[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)，完整命令见教程本身）：

- 显存预算比例 0.85：决定能切出多少 KV 块；
- 每步 token 预算 8192：限制一步的计算量，长提示词按它分段；
- 每步请求数上限 32：限制批处理请求数；结合每请求送入的行数、图配置和后续裁剪，参与确定捕获尺寸；
- 单请求长度上限 133120 token：同时决定块表最大长度和 KDA 状态组的块长；
- MTP（Multi-Token Prediction，模型自带的多 token 预测层，这里拿来草拟候选，见[投机解码](speculative-decoding.md)）每轮草拟 3 个 token：决定 decode 一步每请求送几行；
- 主模型图模式只录纯 decode 步，捕获尺寸七档。

于是有一条对后面各页都有效的核对规则：**说某个昇腾特性没开，要把命令、默认值、环境回退、派生与消费者条件连起来看。** 没传 JSON 只是没有从这个入口覆盖；各特性页应回到共同基线核对自己的成立条件。

## 排查时怎样从症状回到某一路

- **配了却没有效果。** 先确认这个键在你用的版本里真的存在、层级放对了；再看日志里这个字段是从 JSON 取的还是从环境回退来的；最后看消费者那一侧的条件分支——解析出 true 只表示配置选择，能不能执行还要看平台检查和消费者条件。

  v0.26 rc 的调度配置要把调用链一起看：选择函数的回退日志打印的是调用者传入的备用值，这一层不再读取或转换环境变量的值。以均衡调度为例，环境值已在创建调度子配置前读取并转换；因此要核对调用者怎样准备这个值，不能把打印日志的位置当成读取环境的位置。具体键名、层级优先顺序与转换见页末来源。
- **报「配置还没初始化」。** 取配置时，缓存为空或缓存对象缺少守卫检查的任一必要属性，完整性检查就会报这个错误。先认清自己在哪个进程，再查该进程是否经过初始化、初始化是否成功，以及留下的对象是否满足守卫。
- **启动时直接拒绝某个组合。** 按报错定位到是哪一道检查，再去看它要求的前提；不要靠删掉检查来判断这个组合可用。
- **改了环境变量却没变。** 如果这个名字属于那九对之一，仅改环境不会自动更新已经缓存的字段；需经过受支持的配置重建或服务重启路径，并核对消费者有没有另外缓存旧值。重新导出启动终端的环境，也不会修改已经运行的服务进程环境。

## 常见误解

- **「这段 JSON 是上游 vLLM 的功能，文档该在上游」**——上游提供容器并将内容纳入配置 hash，平台定义自己的键；上游也会写入少数键。查某个键要找到实际读取它的代码。
- **「环境变量和 JSON 是两条互不相通的路」**——钉住版本上有九个名字两边都认。把「全大写去环境变量表找、小写下划线去配置找」当成判断规则，就会漏掉这九个，也会误以为显式写 false 没有意义。
- **「取不到配置是因为 JSON 写错了」**——缓存为空或缺少守卫检查的属性，会触发未初始化错误；JSON 错误则可能在解析、类型转换或具体子配置校验时另行报错，也可能因旧版忽略未知键而没有提示。
- **「同一个进程里配置只解析一次」**——可复用时不会重建；旧版 `refresh` 为真、绑定对象变了或缓存不完整时会重建，不能把“写了这个键”与“值为真”等同。
- **「拼错键名总会报错」和「拼错键名从不报错」都不对**——钉住的两个发布分支上，顶层和多数子配置安静走默认，EPLB 那一组会报错；main 通常由 pydantic 严格校验报错；若能发现 vLLM-Omni，未知顶层键会先警告并过滤，不能概括为一律报错。结论要连版本和所在层级一起说。

## 对照源码

遇到“开关写了却没效果”或升级回归，按进程保留最终配置、安装文件路径和实际执行路径，再与启动命令比较。配置值已开启、功能实际触发、目标指标改善是三次不同的核对；对照方法见[版本与配置回归](inference-troubleshooting.md#版本与配置回归同一命令不等于同一路径)。

### 怎么开

**JSON 这条路。** 启动命令加 `--additional-config '{...}'`（上游注册的参数），解析后的容器进入 `VllmConfig.additional_config`，期间上游也可以补键。固定旧 GLM 由 `AscendConfig.__init__` 从字典里 `.get()` 子字典，再交给对应的子配置类。这样构造出来的类有八个：`XliteGraphConfig`、`AscendCompilationConfig`、`AscendFusionConfig`、`FinegrainedTPConfig`、`EplbConfig`、`WeightPrefetchConfig`、`ProfilingChunkConfig`、`RejectionSamplerConfig`。顶层字段也逐键取，例如 `recompute_scheduler_enable`、`enable_shared_expert_dp`、`enable_reduce_sample`。本页这些字段的层级在 `ascend_config.py` 中定义；其他键仍要追实际消费者，不能仅凭没有在这个文件里找到就判它无效。

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

判断逻辑在 `_get_config_value`：`config_key in additional_config` 为真就返回字典里的值，否则返回传进来的环境值；走回退时按 `env_key in os.environ` 决定要不要打那条「下个版本将删除该环境变量」的提示。环境值是在调用前求出的，优先级规则不会跳过这个求值过程。

**环境变量这条路。** `vllm_ascend/envs.py` 的 `env_variables` 表在固定旧 GLM 上有 21 条，其中 9 条带 `VLLM_ASCEND_` 前缀，其余包括构建期变量（编译并发度、编译类型、是否编自定义算子、芯片型号、CANN 安装路径等）和通用项。模块的 `__getattr__` 是懒读：每次访问 `envs_ascend.X` 都会重新调一遍 lambda，读当前的 `os.environ`。这不是完整环境变量清单，例如全局 patch 直接读取 `DYNAMIC_EPLB` 和 `EXPERT_MAP_RECORD`，不经过这张表。

**昇腾还会往解析器里补选项。** 平台钩子 `pre_register_and_update` 在解析参数阶段把 `ascend` 加进 `--quantization` 的候选，所以 `--quantization ascend` 不是上游自带的取值。

**建与取。** `init_ascend_config(vllm_config)` 建（复用条件见正文），`get_ascend_config()` 取，`clear_ascend_config()` 清缓存时会连带清掉派生的序列并行判断缓存。调用点：`NPUPlatform.check_and_update_config` 里在四个校验之后；`NPUWorker.__init__` 里在登记昇腾算子之后、`super().__init__()` 之前；另外 profiling 分块的调度器和两个 mooncake connector 也各有一处。

### 会报什么错

- `RuntimeError: Ascend config is not initialized. Please call init_ascend_config first.` —— 取配置时缓存为空或未通过完整性检查。它说明取的时机不对，不是 JSON 内容错。
- `ValueError`：profiling 分块要求 pipeline parallel 大于 1；以及分块与 `enable_balance_scheduling` 不能同时开。两条都在建配置时抛出。
- `AssertionError`：`finegrained_tp_config` 里 `oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 时，要求 `recompute_scheduler_enable=true`；`lmhead_tensor_parallel_size` 不受这条约束。
- `ValueError`（平台阶段）：开了重算调度但角色既不是 PD 的 producer 也不是 consumer。在 producer 上则只警告并把它重置为关。
- `ValueError`（本页固定旧 GLM 与 v0.23 的平台阶段）：层切分配置校验会拦掉不合法组合。`layer_sharding` 在本页 v0.26 rc 与 main 的配置路径中已删除，不能把旧键未报错当作仍生效。
- `ValueError: Config has no attribute '<键名>'`：`eplb_config` 这一组是自己遍历用户字典的，遇到它不认识的键当场抛错。所以「未识别的键一律静默忽略」不成立，要按子配置类分别看。
- **不报错的两种情况：** 顶层和多数子配置里未识别的键（顶层全程 `.get()`，接 `**` 的 `AscendCompilationConfig` 与 `AscendFusionConfig` 带 `**kwargs` 兜底，其余几个子配置也是逐键 `.get()`）；新建实例没通过完整性检查时只打警告、不更新缓存。

### 开销和什么时候别开

配置解析主要发生在初始化或重建时；源码没有给出其实际耗时，不能从“有缓存”直接推出开销可忽略。部署时还要权衡下面几项。

- 非空 JSON 的完整内容进入配置 hash，改变内容会影响默认编译缓存的选择；已有产物不会因此被统一删除，是否重新编译还取决于实际编译与缓存路径。
- 仅由执行代码直接消费、未并入配置对象的环境开关，平台配置检查未必能看见；上面的九对兼容映射会并入 AscendConfig。排查时同时核对环境、映射规则和最终生效值。
- 九对兼容映射带迁移提示，长期运维脚本应记录所依赖的版本和入口；v0.26 rc 上调度相关的顶层键也已打 deprecated 警告。不要把提示中的“下个版本”当成所有后续版本行为相同的证据。
- 官方双机配方没有传 JSON 键。新增覆盖时先确认该层级和版本支持，再一次只改一项，记录最终值并验证目标指标；本页的静态推导不替代部署实测。

### 版本差异

**`v0.30.0`（`c09d3e20`）已完成 `AscendConfig` 字段收口与严格校验，并在 `main`（`8d6180e2`）进一步扩展 `runtime_config` 与 `quantized_all_reduce_config`：**
- **`extra="forbid"` 严格解析与 Omni 兼容例外**：`v0.30.0` 与 `main` 统一采用 Pydantic dataclass（`ConfigDict(extra="forbid")`），构造期即拒绝未知键与非法类型；内部派生键与调度兼容旧键由 `init_ascend_config` 工厂提前消费或剔除；只有可发现 `vllm_omni` 时，未知顶层键才告警后从 `AscendConfig` 输入过滤（不代表未知子配置一并放行）。构造期类型/范围检查之后，再顺序执行 `derive_and_validate`、RL `apply` 与细粒度 TP / Xlite 等前置校验，最后才发布进程内单例；失败不覆盖旧缓存，但派生过程可能已经修改传入的总配置，不是整个初始化事务回滚。
- **退役环境变量与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 兜底**：`v0.30.0` 与 `main` 的 `envs.py` 均已移除 `VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON`、`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`、`VLLM_ASCEND_BALANCE_SCHEDULING`、`VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE`、`VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` 等旧兼容变量，对应开关收归 `additional_config` 的 `weight_nz_mode`、`enable_mlapo`、`enable_fused_mc2`、`msmonitor_use_daemon` 等字段。`AscendConfig.derive_and_validate` 仍保留对 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 的直读兜底（去除空白并转小写后仅 `1` / `true` 为真），且与 JSON `enable_flashcomm1` 做逻辑或（`or`），因此 JSON 写 `false` 不会盖掉环境里的开启值，且后续还与 DSA-CP / SP MoE / 稠密 SP 判定联动。
- **历史 `v0.30.0rc2` / 旧字段归档说明**：`v0.30.0` 与 `main` 均已从输入 schema 移除 `enable_reduce_sample`（旧固定 `baa023ad` 曾短暂保留声明），MRV2 的 `enable_batch_sharded_sampling` 属于上游 `parallel_config` 入口且与非零细粒度 LMHead TP 互斥；`ascend_warmup_config` 两项默认仍为 `false`；STAIR 默认策略及 HIXL/Gloo 回退见 [EPLB 版本差异](eplb.md#版本差异)。正文配置流程图与 GLM 双机算例按固定旧镜像 `db701c1f`（与 `2c59ff10` 相比，后者在采样归约上增加了实验性警告以及与细粒度 LM head TP / PD producer 互斥拒绝，环境变量表与四个前置平台校验相同）绘制，不能把逐键静默忽略套到 `v0.30.0` / `main`。

| 核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
| --- | --- | --- | --- | --- |
| 解析与未知键策略 | 逐键 `.get()` + 手写校验；顶层与多数子配置静默忽略，`eplb_config` 报错 | 同 `v0.23.0` | Pydantic dataclass（`ConfigDict(extra="forbid")`）严格拒收；检测到 `vllm_omni` 时未知顶层键先告警后过滤 | 延续 `extra="forbid"` 与 `vllm_omni` 顶层过滤例外 |
| 调度相关键层级 | 仅顶层键 | 推荐嵌在 `scheduler_config`；顶层仍认但打 deprecated 警告，两处都写以嵌套为准 | 工厂提前剥离 4 个顶层旧调度键并交给 `scheduler_config` 构造 | 同 `v0.30.0` |
| 子配置构成 | 8 组（含权重预取与独立 profiling 分块） | 删除权重预取；profiling 分块迁入 `scheduler_config`，新增批作业调度与短请求优先 | 12 组：含 `ascend_compilation` / `fusion` / `warmup`、`eplb`、`rejection_sampler`、`rl`、`xlite_graph`、`finegrained_tp`、`scheduler`、`dynamic_spec`、`sparse_kv_offload`、`kvpp` | 13 组：移除 `dynamic_spec_config`，新增 `runtime_config`（含热更新引导）与 `quantized_all_reduce_config` |
| 环境变量兼容映射 | 9 对兼容映射，`_get_config_value` 按 JSON 键优先 | 顶层 6 字段 + `scheduler_config` 均衡调度 | 退役 `VLLM_ASCEND_ENABLE_NZ/MLAPO/FUSED_MC2/MSMONITOR_USE_DAEMON` 等；仅 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 在 `derive_and_validate` 保留逻辑或兜底 | 延续退役收口与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 逻辑或兜底（并新增 Qwen3.5 稠密 SP 联动） |
| `envs.py` `env_variables` 条目 | 21 条（9 条带 `VLLM_ASCEND_` 前缀） | 20 条（8 条带前缀） | 14 条（3 条带前缀：`ENABLE_BATCH_MEMCPY`、`KVPOOL_RANGE_DEBUG`、`ROPE_UB_SIZE_KB`） | 12 条（1 条带前缀：`VLLM_ASCEND_ENABLE_BATCH_MEMCPY`） |
| 建配置前平台校验 | 4 个前置校验（含已删除的 `layer_sharding`） | 2 个前置校验（已删 `layer_sharding`） | 7 个前置校验（runner、indexer-PP、routing replay、PCP/DCP、draft DCP、parallel、engram）+ 量化/FP8 能力检查与 `_fix_incompatible_config` | 同类前置校验链，且入口首行调用 `apply_v2_model_runner_config_patch()` 固定 MRV2 |
| 进程内缓存 | 模块变量 `_ASCEND_CONFIG` + `_INIT_VLLM_CONFIG` + `refresh` 标记 | 同 `v0.23.0` | 校验完整后原子发布 `_ASCEND_CONFIG` 并 `clear_enable_sp()`；失败保留旧单例 | 同 `v0.30.0`（额外校验 `quantized_all_reduce` 与 `xlite_graph` 前置条件） |

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
| v0.26 rc 的顶层构造与嵌套层 | `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L360`；`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040` |
| v0.26 rc 的环境变量表 | `vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107` |
| `v0.30.0 (c09d3e20)` 严格校验、12 组子配置、FlashComm1 兜底与工厂发布 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L562-L635`、`#L745-L756`、`#L1795-L1951` |
| `v0.30.0 (c09d3e20)` 环境变量收口（14 条）与平台前置校验 | `vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L90`；`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525` |
| `main (8d6180e2)` 13 组子配置（含 `runtime_config` / `quantized_all_reduce`）、FlashComm1 兜底与工厂发布 | `vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L652-L737`、`#L845-L865`、`#L1909-L2078` |
| `main (8d6180e2)` 环境变量表（12 条）与平台 MRV2 入口前置校验 | `vllm-ascend@8d6180e2:vllm_ascend/envs.py#L51-L95`；`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L685` |
| 历史 `baa023ad` main 存档与 Omni 过滤参考 | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L295-L310`、`#L430-L608`、`#L1536-L1700`、`#L1660-L1671` |
| 配置 hash 怎样参与默认编译缓存目录 | 来源 46，`vllm/compilation/backends.py` 1024–1084 行；缓存开关与编译模式另有门控 |
| SP 可以覆盖 FlashComm1 关闭值的实际消费者 | 来源 47，`vllm_ascend/utils.py` 905–931 行 |
| 分块调度器、普通与混合 Mooncake 的初始化调用点 | 来源 48–50，分别覆盖调用和紧随的配置读取 |
| 旧版两个编译/融合子配置接受额外键，Xlite 逐键读取 | 来源 51，`ascend_config.py` 579–682 行 |
| 读取表之外的环境入口 | 来源 52，全局 patch 直接读取 EPLB 两个环境变量 |
| rc2 EPLB 扩展的安装调用 | 来源 53；策略扩展、回退条件与官方说明见来源 39–42、45 |
| Xlite Worker 的自动选择条件 | 来源 54，`platform.py` 650–659 行；显式 Worker 和 310P 分支不由这个开关替换 |
| 历史 main 的 profiling 分块仍归 scheduler 子配置 | 来源 55，`ascend_config.py` 1402–1440 行；不把顶层组数当成全部嵌套配置数 |

**关键路径对应来源。** 上游容器被声明为不透明字典 [C3]；参数注册、完整内容进入配置 hash、上游内部写键分别见来源 2、4、5，缓存消费者见来源 46。构造配置时逐键拆分并建立子配置 [C6]；层级不等价、顶层字段及构造期检查需合看来源 6–8，EPLB 子配置拒绝未知键见来源 30，优先级判断与迁移提示见来源 9，环境变量表与每次访问重读见来源 14。平台前置校验与按 PD 角色改写见来源 15–17，建/取/清缓存与 Worker 侧调用点见来源 12、18。GLM 双机命令没有那段 JSON [S1]；相关默认值见来源 10、19、20，SP 条件须合看来源 47 与[来源基线](../sources/glm-5-3-flash-baseline.md)。四版演进对照：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）分别见来源 21–23、28、56–65 [C56][C61]。

子配置八组（旧 GLM）到 12 组（`v0.30.0`）与 13 组（`main`）、兼容映射九对、环境变量表 21 / 20 / 14 / 12 条（带 `VLLM_ASCEND_` 前缀 9 / 8 / 3 / 1 条），均按对应提交源码实点 [D]。旧版两个「9」不是同一批名字：兼容映射的九对里有一对的环境名不带昇腾前缀，而带前缀的那 9 条里也有一条没参与映射 [D]。教程未传 JSON 只支持“未从该 CLI 入口覆盖”，最终生效值还需合看派生与消费者 [I]。`v0.30.0` 与 `main` 虽已移除通用回退函数及四个旧环境变量，但 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 仍保留逻辑或直读兜底（来源 57、62）[C57]。

本页的日志说明来自固定源码，尚无目标镜像启动日志证明实际采用了哪条分支。官方教程与公开代码也不能代替安装产物：部署时应保存各进程的最终配置、环境来源与代码版本，核对镜像是否另有注入或改写。

v0.26 rc 固定快照 2ed6cbba 的调度子配置先取 scheduler_config 内的同名键；顶层也写了时警告它被忽略。只有顶层写了时仍采用并警告迁移；两层均未写才返回调用者给出的 default。均衡调度的 default 来自 VLLM_ASCEND_BALANCE_SCHEDULING 的整数布尔转换，重算开关传 False，三组子配置传空字典。因此，“回退到 default”不等于所有字段都回退到同一种来源；其他开关和版本应分别判断。取值链见来源 21–23。
