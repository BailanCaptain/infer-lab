---
id: cpu-binding
title: "CPU 绑核：给每个 Worker 划一段专用的 CPU 核"
type: feature
summary: 昇腾 ARM 服务器上默认开着的一项主机侧优化：把每颗 NPU 对应的 Worker 进程和它的两条后台线程钉在一段固定的 CPU 核上，再把它的内存搬到这段核旁边，省掉被调度器挪来挪去带来的抖动；不改模型怎么算，也不改算出来的结果。
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
  - vllm-ascend@baa023ad:vllm_ascend/cpu_binding.py#L517-L527
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L258-L286
  - vllm-ascend@baa023ad:vllm_ascend/cpu_binding.py#L697-L705
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455-L459
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
    note: 被钉住的就是一颗 NPU 一个的那个 Worker 进程，进程怎么起来的在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求没配绑核，默认开着；它跑在 A3 的两颗 NPU 上，走 global_slice，两个 Worker 各拿一段核
  - to: acl-graph
    kind: alternative-to
    note: 两者从两头削同一笔主机侧下发开销——图模式减少下发次数，绑核稳住做下发的那个进程，开了图模式也仍然要绑
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 两颗 NPU 在算，主机那边的两个进程住在哪

[那条请求](one-request.md)跑在一张 Atlas A3 卡的两颗 NPU 上。模型在 NPU 上算，但每一步要算的每个算子，都是主机上的一个进程一个一个下发过去的——一颗 NPU 配一个这样的进程，叫 [Worker](npu-worker-lifecycle.md)，所以这次主机上有两个 Worker。

那么问题来了：**这两个 Worker 跑在主机的哪些 CPU 核上？** 如果不管，Linux 会按自己的判断把它们在几百个核之间挪来挪去，还可能让它们和别的进程挤在同一批核上。NPU 在等下一个算子，下发它的进程却刚被挪了位置、或者正排队等核——这段时间就白白加进了每一步的时延里。

CPU 绑核的回答很直接：**给每个 Worker 划一段专用的核，把它连同它的子线程钉在上面，再把它已经用到的内存搬到这段核旁边。** 它不碰模型、不碰算子，官方文档明说不改执行逻辑、不改数值结果——省的是主机那边的抖动，不是 NPU 的算力。

这个功能在 ARM 架构的昇腾服务器上默认就开着，这次提问什么都没配，也在用它。

## 为什么进程在哪个核上会影响速度

大的服务器有好几路 CPU，内存也分成几块，每块挨着一组核，这样一组「核 + 挨着它的内存」叫一个 NUMA 节点。核去读挨着自己的那块内存快，去读别的节点的内存就慢一截。

官方设计文档给绑核列了三条理由，全都属于主机这一侧，没有一条和模型有关：

- **跨节点访存**：进程被挪到离它内存远的核上，每次读写都要绕远路；
- **被抢占**：别的线程把核抢走，Worker 得停下来等，来回切换也有开销；
- **尾时延抖动**：好几个 Worker 抢同一批核，大多数步很快，偶尔几步特别慢。

所以它只在 ARM 多路服务器上跑，x86 主机上这一步整个跳过。

它和[图模式](acl-graph.md)是从两头处理同一笔开销：图模式把一整趟计算提前捕获下来，之后回放，**减少下发的次数**；绑核则**稳住做下发的那个进程**。开了图模式也仍然要绑核，因为每次回放还是由主机上的这个进程触发的。

## 这次的两颗 NPU 各拿哪一段

先看一台 A3 整机：8 张卡、每张卡两颗 NPU，一共 16 颗。A3 的卡之间用高速互联连在一起，每颗 NPU 到各个 NUMA 节点的距离几乎一样，「这颗 NPU 挨着哪组核」这种信号根本不存在。于是 A3 用的是最朴素的分法：**按 NPU 的全局编号，把可用的核平均分成 16 份。**

那条请求没有规定主机有多少核，这里借官方设计文档里那台 640 核的 A3 来代一遍：

- 640 ÷ 16 = 40，正好整除，每颗 NPU 分到 40 个核；
- 这次用的是 0 号和 1 号 NPU，所以 0 号的 Worker 拿核 0–39，1 号的 Worker 拿核 40–79；
- 其余 14 段留给这台机器上的其他 NPU，不管那上面有没有别的服务在跑。

```wiki-diagram
file: cpu-binding
```

拿到的 40 个核再按用途切开：

| 用途 | 0 号 NPU 的 Worker | 1 号 NPU 的 Worker |
|---|---|---|
| 这颗 NPU 的两个中断（提交队列、完成队列各一个） | 核 0、1 | 核 40、41 |
| Worker 进程本身和它的全部子线程 | 核 2–37，共 36 个 | 核 42–77，共 36 个 |
| 第一条专职后台线程 | 核 38 | 核 78 |
| 第二条专职后台线程 | 核 39 | 核 79 |

这个分法有一个很关键的性质：**算式里只有「整机一共几颗 NPU」和「我是第几颗」，没有「我这个进程能看见哪几颗」。** 所以哪怕是同一台机器上两个互不知情的服务，只要它们看到的可用核一样、用的 NPU 编号不同，算出来的核段就一定不重叠。

每颗 NPU 至少要分到 5 个核：2 个给中断、至少 1 个给进程本身、两条后台线程各 1 个。分不到 5 个就不绑了。

## 别的机型：跟着「哪颗 NPU 挨着哪组核」走

A2、Atlas 300 推理卡和 Ascend 950 不是这样分的。它们的 NPU 会报告自己挨着哪一段核，绑核就用这个信号：只在挨着这颗 NPU 的那段核里分。报不出来这个信号时，退回上面 A3 那种平均分。

这里有一个容易出事的地方，官方设计文档专门举了例子：一台 A2 上，0 号和 2 号 NPU 都挨着核 144–167；有两个互不相干的单卡服务，一个只用 0 号、一个只用 2 号，容器给它们的可用核都是 144–191。如果每个服务只看自己那颗卡，两边都会去抢 144–167。实际的做法是：**把看不见但挨着同一段核的 NPU 也算进来一起分**，分完再只留自己那份。结果 0 号那边拿 144–167，2 号那边拿 168–191，互不重叠。

也就是说：**单卡服务并不等于「整个可用核都归我」。**

Ascend 950 还有两处不同：它不绑中断，核也不按上面那种 2 + 36 + 1 + 1 切，而是每个 Worker 拿一整组核。

## 什么时候绑：启动的最后一步

绑核发生在 Worker 启动时序的[最后一步](npu-worker-lifecycle.md)末尾：模型加载好、预热跑完之后，才去绑。先预热是故意的——让常用的那批内存先在这个进程里分配好，这时再把内存搬到目标节点，搬的才是真正要用的东西。

绑的时候依次做四件事：

1. 把 Worker 进程连同它的全部子线程钉到分给它的那 36 个核上；
2. 找出那两条专职后台线程，各钉到一个单独的核上；
3. 把这个进程已经分配的内存搬到这段核所在的 NUMA 节点；
4. 把这颗 NPU 的两个中断指到预留的那两个核上。

绑到哪段核只能由上面这两种规则算出来，没有「我自己指定用哪些核」的入口；上游 vLLM 那几个手工指定 NUMA 节点和核的启动参数，在昇腾上会被改写或忽略。

## 绑不上也不会让服务起不来

绑核途中任何一步出错，都会被接住、写成一条警告，服务照常启动，只是少了这层优化。**所以绑核失败的样子不是启动失败，而是日志里多一行、性能对不上预期。** 排查性能问题时，值得先去日志里确认它到底绑上了没有。

几种常见情况：主机是 x86，整个跳过；机器上没装搬内存的工具，只跳过搬内存这一步，前面照绑；没有权限改中断设置，只跳过中断那一步；核不够分，整个放弃。

## 常见误解

- **「绑核会改模型的行为。」**——不会。它只动进程在哪些核上跑、内存在哪个节点、中断发给哪个核，官方文档第一段就声明不改执行逻辑和数值结果。
- **「可以自己指定绑到哪些核。」**——不行。上游那个手工指定核的参数在昇腾上被清空、只留一条日志；核段只能由上面两种规则算出来。
- **「没装搬内存的工具就绑不了核。」**——钉核那几步照做，只跳过搬内存。代价是内存可能留在远处的节点上，时延和吞吐反而可能比完整绑核更差。
- **「绑核只在多卡时才有意义。」**——单卡也绑，而且单卡服务恰恰最容易出意外：同一台机器上另一个单卡服务如果挨着同一段核，你的那一段会被对半分走——「看不见的 NPU 也算进来」那条规则正是为此存在的。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

开关是 `additional_config` 顶层的布尔键 `enable_cpu_binding`，不属于任何子配置类，默认 `True` [C2]（配置怎么进来见 [AscendConfig 配置系统](ascend-config-system.md)）：

```bash
# 默认就是 true，这里只演示怎么关
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --additional-config '{"enable_cpu_binding": false}'
```

- **调用点全仓只有一处**：`NPUWorker.compile_or_warm_up_model()` 尾巴上，紧跟 ATB warmup 之后、`set_random_seed` 之前；源码注释写明「warmup 之后再绑，让热内存先在这个进程里落好，再跑 `migratepages` / `taskset`」[C1]。
- **入口先判架构**：`bind_cpus` 第一句是 `is_arm_cpu()`，`x86_64` / `amd64` / `i386` / `i686` 直接打一条 info 日志返回；未知架构打 warning 后同样不绑 [C4]。
- **策略查表**：`DEVICE_BINDING_MODE` 里 A2、310P、A5 是 `topo_affinity`，**A3 是 `global_slice`**，表里没有的设备默认 `topo_affinity` [C5]。A3 单独一档的理由：HCCS 卡间互联让每张 NPU 到各 NUMA 节点距离几乎相同，拓扑亲和给不出有用信号 [S23]。
- **池子的原料**：`/proc/self/status` 的 `Cpus_allowed_list`，容器 cpuset 被尊重 [C7]；总卡数来自 `npu-smi info -m` 的 `total_logic_npus`，拿不到时依次退到拓扑亲和条目数、在跑的卡数 [C11]。
- **`global_slice` 算式** [C12]，拿设计文档那台 640 核、16 颗逻辑 NPU 的 A3 代入 [S24]；上半「这次用 0 号和 1 号」是把那条请求的 TP=2 放到这台机器上的假设 [A]：

```
allowed_cpus = 0..639          # /proc/self/status 里的 Cpus_allowed_list
total_npus   = 16              # npu-smi info -m 报的 total_logic_npus
base  = 640 // 16 = 40         extra = 640 % 16 = 0
逻辑 NPU i 的核段 = allowed_cpus[40i : 40i+40]      # i < extra 的多拿 1 个
→ NPU 0: 0-39    NPU 1: 40-79    …    NPU 15: 600-639
```

- **角色切分** [C14]：`pool[0]`、`pool[1]` 给 SQ / CQ 两个中断；`pool[2:-2]` 给进程本身，`taskset -acp` 连子线程一起钉；`pool[-2]` 给 `acl_thread`，`pool[-1]` 给 `release_thread`。NPU 1 的切法设计文档表里就有：IRQ 40-41、main 42-77、acl 78、release 79 [S24]。上半说的「两条专职后台线程」就是 `acl_thread` 和 `release_thread`，按 `ps -Te` 的线程名找出 tid 再 `taskset -cp` [C15]。
- **最少核数**：`MIN_CPUS_PER_NPU = 5`，注释写明 2 个 IRQ + 至少 1 个 main + 1 个 acl + 1 个 release；不绑中断的设备（A5）用 `MIN_CPUS_PER_NPU_WITHOUT_IRQ = 3` [C6]。
- **`topo_affinity` 的「非运行卡也算候选」**：A2 例子里 NPU0 与 NPU2 亲和范围都是 144-167、cpuset 144-191，把看不见的同亲和 NPU 一起平分，平分完才删掉看不见的那张，最终两个进程分别得到 144-167 与 168-191 [S25][C13]。
- **内存迁移**：以池子第一个核所在的 NUMA 为目标，`migratepages <pid> <全部节点> <目标节点>` [C16]。
- **上游 NUMA 开关被平台层改写**：`--numa-bind` 被翻译成 `{"enable_cpu_binding": true}` [C20]；`--numa-bind-nodes` 与 `--numa-bind-cpus` 直接置空并各打一条 info 日志 [C21]。

### 会报什么错

途中抛出的任何异常，都被调用点的 `except Exception` 接住，写成 `Bind cpus failed in rank%s ... Skip binding cpu.` 一条 warning，服务照常起来。哪些抛错、哪些静默跳过：

| 情形 | 代码怎么做 | 日志里是什么 |
|---|---|---|
| 非 ARM | 整条跳过 | `CPU binding skipped: non-ARM CPU detected.` [C3] |
| 找不到在跑的卡，或被 `ASCEND_RT_VISIBLE_DEVICES` 滤空 | `raise RuntimeError` | `Can not get running npu info.` [C9] |
| 选了 `topo_affinity` 却没解析出拓扑亲和 | **不报错，退回 `global_slice`** | 一条 warning |
| 亲和核与 cpuset 完全不相交 | `raise RuntimeError` | `... conflict with NUMA affinity.` |
| 核不够分 | `raise RuntimeError` | `Insufficient CPUs for binding` |
| 没装 `numactl`（没有 `migratepages`） | 只跳内存迁移这一步 | 一条 info，前面的绑核照做 |
| `/proc/irq` 不可写 | 只跳中断绑定 | v0.23 / v0.26 上什么都不打 [C17] |

- **容器里最容易撞的一格**：池子原料是 cpuset，但 `total_npus` 来自 `npu-smi info -m` 的整机视图，不随 cpuset 缩。16 颗 NPU 的机器上给容器 40 个核、只跑 1 颗，`global_slice` 算的是 `40 // 16 = 2 < 5`，直接报核不够 [D]。报错信息里会给出 `Need at least {total_npus * min_cpus_per_npu} CPUs in cpuset`，这个例子是 80。

### 开销和什么时候别开

- 绑核本身只在启动时跑一次，跑完不占推理时的开销。
- **前提缺了会比完整绑核更差**：没有 `migratepages` 时，核已经钉住、内存页却可能留在远端 NUMA，时延和吞吐可能倒退 [S26]。
- **`global_slice` 只在 cpuset 与 NUMA 对齐时保证节点本地**：CPU 编号或 cpuset 跨了 NUMA 边界时，切出来的段可能横跨两个节点 [S26]。
- **同机多实例、每个容器核很少**：会直接撞上上面那条核不够的报错；这时要么给容器更多核，要么关掉它，免得每次启动多一条 warning、还误以为绑上了。

### 版本差异

开关从 v0.18.0rc1 起在 ARM 昇腾服务器上默认开启 [S27]。`vllm_ascend/cpu_binding.py` 从 v0.23 到 main [C35] 是同一套实现，三个版本之间只有三处真差异：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 绑哪张卡的核 | `bind_cpus(rank_id)`，拿 rank 当「在跑的卡」排序表的下标 | `bind_cpus(rank_id, npu_id)`，卡号由 `device_id_to_physical_device_id(local_rank)` 给 | 同 v0.26 | [!] v0.23 那张表是从整机 `npu-smi info` 的进程表算出来的，同机还有别的进程占着别的卡时下标可能对不上；v0.26 起改成问平台要物理卡号 |
| `/proc/irq` 不可写 | 直接 `return`，日志里什么都没有 | 同 v0.23 | 多一条 `warning_once`，提示 Docker 加 `--privileged=true` | [!] 前两个版本上「IRQ 没绑成」是完全静默的，只能靠日志里没有那条 `NPU%s(PCI ...)` 反推 |
| 设备类型怎么分派 | `DEVICE_BINDING_MODE` 字典加 `NO_IRQ_BINDING_DEVICE_TYPES` 集合 | 同 v0.23 | 查 `HardwareProfile` 的 `cpu_binding_mode` 与两个 capability | [!] 纯重构：四种设备各自的策略、角色切分、最少核数一字未变，别因为符号名变了以为行为变了 |

### 源码位置

- `vllm_ascend/cpu_binding.py`：`bind_cpus` 入口、`is_arm_cpu`、`DeviceInfo`（解析 `npu-smi` 三条命令与 `Cpus_allowed_list`）、`CpuAlloc`（`global_slice` / `topo_affinity` 建池、`_allocate_default_roles` 切角色、`_bind_default_threads` / `bind_memory` / `bind_npu_irq` 执行）。
- `vllm_ascend/worker/worker.py`：`compile_or_warm_up_model()` 尾部唯一调用点。
- `vllm_ascend/ascend_config.py`：`enable_cpu_binding` 默认值。
- `vllm_ascend/platform.py`：上游 `--numa-bind*` 三个开关的改写。
- main 上设备分派挪到 `vllm_ascend/device/hardware_profile.py`。
- 官方文档：设计文档 `docs/source/developer_guide/Design_Documents/cpu_binding.md`，用户指南 `docs/source/user_guide/feature_guide/cpu_binding.md`。
