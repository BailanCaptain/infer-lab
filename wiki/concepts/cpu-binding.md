---
id: cpu-binding
title: "CPU 绑核：每个 Worker 钉死一段核，而且是 warmup 之后才钉"
type: feature
summary: 把每张卡对应的 Worker 进程和它的 acl / release 线程钉到一段固定的 CPU 核上，ARM 昇腾服务器上默认就开着；核段按 NPU 拓扑亲和或全局逻辑 NPU id 切，切完进程之间互不重叠。
aliases: [CPU 绑核, CPU Binding, cpu_binding, enable_cpu_binding, bind_cpus, CpuAlloc, global_slice, topo_affinity, 核绑定, NPU 亲和性绑核]
chapters: ["16"]
order: 120
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L775-L783
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L160-L164
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L801-L806
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L34-L44
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L22-L31
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L15-L17
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L183-L190
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L104-L132
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L149-L181
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L192-L204
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L466-L503
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L505-L517
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L556-L593
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L606-L623
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L683-L694
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L643-L653
  - vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L702-L709
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L824-L828
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L850-L860
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1221-L1232
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1234-L1248
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/cpu_binding.md#L15-L27
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/cpu_binding.md#L45-L81
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/cpu_binding.md#L167-L207
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/cpu_binding.md#L212-L233
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/cpu_binding.md#L256-L274
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/cpu_binding.md#L3-L7
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/cpu_binding.md#L11-L26
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/cpu_binding.md#L85-L91
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L79-L83
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/cpu_binding.html
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/cpu_binding.html
  - vllm-ascend@2ed6cbba:vllm_ascend/cpu_binding.py#L798-L803
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L827-L834
  - vllm-ascend@b255ab59:vllm_ascend/cpu_binding.py#L517-L527
  - vllm-ascend@b255ab59:vllm_ascend/device/hardware_profile.py#L166-L194
  - vllm-ascend@b255ab59:vllm_ascend/cpu_binding.py#L697-L705
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L454-L458
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 绑核是第六步 compile_or_warm_up_model 里最后一个动作，不在第一步那串构造函数动作里
  - to: ascend-config-system
    kind: builds-on
    note: enable_cpu_binding 是 additional_config 顶层的布尔键，不属于任何子配置类，默认 True
  - to: engine-processes
    kind: builds-on
    note: 被钉住的就是一张卡一个的那个 Worker 进程，进程怎么起来的在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求什么都没配，绑核默认开着，走 A2 的 topo_affinity 这条路
  - to: acl-graph
    kind: alternative-to
    note: 两者从两头削同一笔 host 下发开销——图模式减少下发次数，绑核稳住做下发的那条线程，开了图也仍然要绑
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

绑核做的事只有一件：**把这张卡对应的 Worker 进程，连同它的 `acl_thread` 和 `release_thread`，钉在一段固定的 CPU 核上**，再把这个进程已经分配的内存页搬到这段核所在的 NUMA 节点。它不碰模型也不碰算子，官方文档明说不改执行逻辑、不改数值输出——省的是 host 侧的抖动，不是算力。

这个特性三个在册版本上都有：`vllm_ascend/cpu_binding.py` 从 v0.23 [C3] 到 main [C35] 是同一套实现，配套的 feature guide 与设计文档也都是三份。开关 `enable_cpu_binding` 默认 `True`，官方文档写的是从 v0.18.0rc1 起在 ARM 昇腾服务器上默认开启 [S27]。三个版本之间只有三处真差异，都在下面那张表里。

```wiki-diagram
file: cpu-binding
```

## 那条请求走到这里

[那条请求](one-request.md)一个 `--additional-config` 都没配，`enable_cpu_binding` 拿的是默认值 `True` [C2]——**绑核对它是开着的**。但绑不绑得上，先卡在一个跟模型毫无关系的判断上：`bind_cpus` 第一句就是 `is_arm_cpu()`，`x86_64` 直接打一条 info 日志返回 [C4]。而 `one-request.md` 只钉了「单张 Atlas A2（910B）」，没钉 host 的 CPU 架构，所以这一节只有条件答案 [I]。

按 ARM 主机往下算：A2 在策略表里是 `topo_affinity`，具体核号取决于 `npu-smi info -t topo` 的真实输出，页面上编不出来。拿设计文档里那台 A2 的数代一遍就是这个形状 [A]——NPU0 的亲和核 144-167、容器 cpuset 144-191，最终池子是 144-167 共 24 个核 [S25]，再按角色切 [C14]：

```
pool[0], pool[1] = 144, 145   → sq / cq 两个中断
pool[2:-2]       = 146-165    → 这个 Worker 进程和它的全部子线程，共 20 个核
pool[-2]         = 166        → acl_thread
pool[-1]         = 167        → release_thread
```

注意池子只有 cpuset 的一半：**单卡服务并不等于「整个 cpuset 都归我」**。哪怕这个进程只看得见 NPU0，只要 NPU2 的亲和范围和它的 cpuset 有交集，NPU2 也会被算进候选一起平分，平分完才把看不见的那张从池子里删掉 [C13]。

## NPU 在算的时候，host 并没有闲着

每一步 forward 的算子，都是 host 上这个 Worker 进程一个一个下发给 NPU 的。**所以这个进程被内核调度器挪到哪个核上、它的内存落在哪个 NUMA 上，会直接进到每一步的时延里。**

设计文档列的三条理由都属于 host，一条都不属于模型：跨 NUMA 访存、线程被抢占带来的上下文切换、多个 worker 抢同一批核造成的尾时延抖动。这也解释了为什么它只在 ARM 多路服务器上跑——x86 上这条路径压根不进。

这一页和 [ACLGraph](acl-graph.md) 是从两头夹同一笔开销：图模式减少下发的**次数**，绑核稳住做下发的**那条线程**。开了图模式不等于不用绑核，回放本身仍然由 host 触发 [D]。

## 两种分核规则，分界线是卡之间怎么连的

策略由设备类型查表定，源码里就四行 [C5]：A2、310P、A5 用 `topo_affinity`，**A3 用 `global_slice`**，表里没有的设备默认 `topo_affinity`。

A3 单独一档的理由设计文档写得很直白：A3 用 HCCS 卡间互联，每张 NPU 到各个 NUMA 节点的距离几乎相同，拓扑亲和给不出有用的信号 [S23]。既然没有亲和可信，就干脆按**全局**逻辑 NPU id 把可用核等分。代设计文档那台 640 核、16 卡的 A3 [S24]，算式是这样 [D]：

```
allowed_cpus = 0..639          # /proc/self/status 里的 Cpus_allowed_list
total_npus   = 16              # npu-smi info -m 报的 total_logic_npus
base  = 640 // 16 = 40         extra = 640 % 16 = 0
逻辑 NPU i 的核段 = allowed_cpus[40i : 40i+40]      # i < extra 的多拿 1 个
→ Worker 0: 0-39    Worker 1: 40-79    …    Worker 15: 600-639
```

再按角色切这 40 个：`pool[0] pool[1]` = 0、1 给两个中断；`pool[2:-2]` = 2-37 共 36 个给进程本身，`taskset -acp` 连子线程一起钉；`pool[-2]` = 38 给 `acl_thread`；`pool[-1]` = 39 给 `release_thread`。

关键在于**这个算式里没有一项跟「本进程看得见哪几张卡」有关** [C12]：两个各跑一张卡的独立服务，只要 cpuset 相同、可见的 NPU id 不同，算出来的核段就一定不重叠。`topo_affinity` 用上一节那招（把看不见的同亲和 NPU 也算进候选）达到同样的效果。

最少要几个核也就此定下：`MIN_CPUS_PER_NPU = 5`，注释写明是 2 个 IRQ + 至少 1 个 main + 1 个 acl + 1 个 release [C6]；`base` 小于 5 直接抛 `Insufficient CPUs for binding` [C11]。

## 它是启动时序的最后一个动作，不在构造函数里

调用点全仓只有一处，在 `NPUWorker.compile_or_warm_up_model()` 的尾巴上，紧跟 ATB warmup 之后、`set_random_seed` 之前 [C1]。也就是说它落在 [NPUWorker 启动时序](npu-worker-lifecycle.md) 的**第六步末尾**，而不是第一步那串构造函数动作里——源码注释写明了理由：先 warmup，让热的那批内存已经在这个进程里落好，再去跑 `taskset` 和 `migratepages`。

开关是 `additional_config` 顶层的一个布尔键，不属于任何子配置类（配置怎么进来见 [AscendConfig 配置系统](ascend-config-system.md)）：

```bash
# 默认就是 true，这里只演示怎么关
vllm serve Qwen/Qwen3-0.6B --additional-config '{"enable_cpu_binding": false}'
```

上游 GPU 侧那三个 NUMA 开关在昇腾上被平台层改写掉：`--numa-bind` 被翻译成 `{"enable_cpu_binding": true}` [C20]，`--numa-bind-nodes` 与 `--numa-bind-cpus` 直接置空并各打一条 info 日志 [C21]。**昇腾不接受手工指定核段**，核段只能由上面那两条规则算出来。

## 绑不上不会让服务起不来

途中任何一处抛出的 `RuntimeError`，都被调用点的 `except Exception` 接住，写成一条 `Bind cpus failed in rank%s ... Skip binding cpu.` 的 warning。**绑核失败的表现不是启动失败，是日志里多一行、而后续性能对不上预期。** 哪些情形抛错、哪些静默跳过，分得很清楚：

| 情形 | 代码怎么做 | 日志里是什么 |
|---|---|---|
| 非 ARM | 整条跳过 | `CPU binding skipped: non-ARM CPU detected.` |
| 找不到在跑的卡，或被 `ASCEND_RT_VISIBLE_DEVICES` 滤空 | `raise RuntimeError` | `Can not get running npu info.` |
| 选了 `topo_affinity` 却没解析出拓扑亲和 | **不报错，退回 `global_slice`** | 一条 warning |
| 亲和核与 cpuset 完全不相交 | `raise RuntimeError` | `... conflict with NUMA affinity.` |
| 核不够分 | `raise RuntimeError` | `Insufficient CPUs for binding` |
| 没装 `numactl`（没有 `migratepages`） | 只跳内存迁移这一步 | 一条 info，前面的绑核照做 [C16] |
| `/proc/irq` 不可写 | 只跳中断绑定 | v0.23 / v0.26 上什么都不打 [C17] |

容器里要留意两个数的来源不一样：池子的原料是 `/proc/self/status` 的 `Cpus_allowed_list`，**容器 cpuset 是被尊重的** [C7]；但 `total_npus` 来自 `npu-smi info -m` 的整机视图，不随 cpuset 一起缩。于是同机多实例会撞上这么一格：16 卡机上给容器 40 个核、只跑 1 张卡，`global_slice` 算的是 `40 // 16 = 2 < 5`，直接报核不够 [D]。

## 三个版本之间的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 绑哪张卡的核 | `bind_cpus(rank_id)`，拿 rank 当「在跑的卡」排序表的下标 | `bind_cpus(rank_id, npu_id)`，卡号由 `device_id_to_physical_device_id(local_rank)` 给 [C33] | 同 v0.26 | [!] v0.23 那张表是从整机 `npu-smi info` 的进程表算出来的，同机还有别的进程占着别的卡时下标可能对不上；v0.26 起改成问平台要物理卡号 |
| `/proc/irq` 不可写 | 直接 `return`，日志里什么都没有 | 同 v0.23 | 多一条 `warning_once`，提示 Docker 加 `--privileged=true` [C37] | [!] 前两个版本上「IRQ 没绑成」是完全静默的，只能靠日志里没有那条 `NPU%s(PCI ...)` 反推 |
| 设备类型怎么分派 | `DEVICE_BINDING_MODE` 字典加 `NO_IRQ_BINDING_DEVICE_TYPES` 集合 | 同 v0.23 | 查 `HardwareProfile` 的 `cpu_binding_mode` 与两个 capability | [!] 纯重构：四种设备各自的策略、角色切分、最少核数一字未变，别因为符号名变了以为行为变了 |

## 常见误解

- **「绑核会改模型的行为。」**——不会。它只动 CPU 亲和、内存页所在的 NUMA 和中断的 `smp_affinity`，官方文档第一段就声明不改执行逻辑和数值输出。
- **「用 `--numa-bind-cpus` 指定绑到哪些核。」**——这个参数在昇腾上被平台层置空、只留一条 info 日志；核段只能由 `topo_affinity` 或 `global_slice` 算出来，没有手工指定的入口。
- **「不装 `numactl` 就绑不了核。」**——`migratepages` 缺了只跳内存迁移这一步，`taskset` 那几步照做；代价是页可能留在远端 NUMA 上，时延和吞吐反而可能更差。
- **「绑核只在多卡场景才有意义。」**——单卡也绑，而且单卡恰恰最容易出意外：同一台机上另一个单卡服务如果亲和范围和你重叠，你这个进程的池子会被对半切掉——「非运行卡也算进候选」那条规则正是为此存在的。
