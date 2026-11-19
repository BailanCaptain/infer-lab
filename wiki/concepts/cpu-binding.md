---
id: cpu-binding
title: CPU 绑核：线程亲和性与 NUMA 局部性
type: feature
summary: >-
  模型在 NPU 上算，主机侧的 Worker 仍要准备张量、下发算子；绑核从这颗卡的亲和节点出发，通常再补上编号下一个 NUMA
  节点里允许的核组成一个池，共用一个池的卡按卡序平分，线程钉在分到的核上，已分配的内存页迁到其中编号最小的核所在的节点。本页讲它怎么挑核、默认开关、GLM
  双机上 8 个 Worker 各绑在哪里，以及拿不到拓扑或核数不够时会怎样。
aliases:
  - CPU 绑核
  - CPU Binding
  - cpu_binding
  - enable_cpu_binding
  - bind_cpus
  - CpuAlloc
  - global_slice
  - topo_affinity
  - 核绑定
  - NPU 亲和性绑核
chapters:
  - '16'
order: 120
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L760-L773'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L14-L33'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L34-L46'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L149-L182'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L183-L204'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L249-L258'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L259-L298'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L518-L555'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L556-L593'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L595-L623'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L643-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L702-L790'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L792-L806'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L160-L164'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L1206-L1222'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/cpu_binding.md#L1-L26
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/cpu_binding.md#L66-L95
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/cpu_binding.md#L212-L231
  - 'vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L25-L31'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L160-L164'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/cpu_binding.py#L795-L802'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L172-L176'
  - 'vllm-ascend@baa023ad:vllm_ascend/cpu_binding.py#L515-L520'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L256-L264'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L926-L938'
  - >-
    raw:sha256-50b8c0905108e9ea033cbf7d6b2f1f82849f87c45f2fc7fc4bdc10599bd3a63e.md#L1-L645
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/worker.py#L760-L770
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/cpu_binding.md
  - 'vllm-ascend@7d825229:vllm_ascend/cpu_binding.py#L21-L36'
  - 'vllm-ascend@7d825229:vllm_ascend/cpu_binding.py#L784-L802'
  - 'vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L284-L304'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L940-L954'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L299-L443'
  - 'vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L444-L518'
  - 'vllm-ascend@2c59ff10:vllm_ascend/cpu_binding.py#L538-L547'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/cpu_binding.py#L539-L548'
  - 'vllm-ascend@baa023ad:vllm_ascend/cpu_binding.py#L535-L544'
  - 'vllm-ascend@7d825229:vllm_ascend/cpu_binding.py#L535-L544'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L256-L334'
  - 'vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L338-L361'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L452-L463'
  - 'vllm-ascend@c09d3e20:vllm_ascend/cpu_binding.py#L515-L550'
  - 'vllm-ascend@c09d3e20:vllm_ascend/cpu_binding.py#L784-L802'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L280-L340'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L960-L974'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L563-L568'
  - 'vllm-ascend@8d6180e2:vllm_ascend/cpu_binding.py#L515-L550'
  - 'vllm-ascend@8d6180e2:vllm_ascend/cpu_binding.py#L784-L802'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L380-L450'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1089-L1104'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L653-L658'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: engine-processes
    kind: builds-on
    note: 先知道 Worker 是哪个进程、主机侧负责什么，再看它被钉在哪
  - to: hardware-devices
    kind: builds-on
    note: 分清 CPU、NPU、主机内存与服务器，硬件规格归那一页
  - to: device-memory
    kind: builds-on
    note: 绑核管的是主机内存的位置，和设备显存是两本账
  - to: acl-graph
    kind: alternative-to
    note: 另一条减少主机侧下发开销的路；两者管同一段主机时间，可以同时开
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-50b8c0905108e9ea033cbf7d6b2f1f82849f87c45f2fc7fc4bdc10599bd3a63e.md
  - >-
    raw/sha256-c0fbe217bc1aaa80b021fd6619fcd2b5257c3d572b2f36f0421b84c75a487919.md
---

## 绑核把 Worker 钉在哪些核上？

**CPU 绑核就是在 Worker 启动的收尾处，把它的线程限制在少数几个逻辑 CPU 上运行，并把这个进程已经分配的内存页迁到这批 CPU 中指定的那一块内存上。** 模型计算在 NPU 上，但每一步都要主机侧先把张量和元数据准备好、再把算子提交给设备，绑核管的就是这一侧的运行位置。

先说清五个词：

- **逻辑 CPU**：操作系统能单独派活的一个执行单元，从 0 开始编号；一台服务器上通常有几十到上百个。
- **CPU affinity（CPU 亲和性）**：一个线程被允许在哪些逻辑 CPU 上运行，是一个集合。绑核改的就是这个集合，它不会把这些核变成本进程独占。
- **NUMA（non-uniform memory access，非一致内存访问）**：多路服务器上 CPU 被分成几组，每组直连一块内存。一组 CPU 加上它直连的内存叫一个 **NUMA 节点**；访问本节点的内存是本地访问，访问别的节点要多绕一段路，时延更长、带宽更低。
- **cpuset**：容器或作业调度器划给这个进程的 CPU 范围。亲和性只能在 cpuset 之内挑核，挑不出范围。
- **ACL 线程与 release 线程**：ACL（Ascend Computing Language）是昇腾的设备接口层，运行时会自己起两条后台线程，线程名分别是 `acl_thread` 和 `release_thread`，一条负责设备接口调用、一条负责资源释放。绑核把它们各单独放一个核上。

```wiki-diagram
file: cpu-binding
```

图里 NPU 决定了从哪个节点起手：拓扑信息告诉绑核这颗卡挂在节点 0 附近，于是先取「节点 0 的亲和核 ∩ 本进程 cpuset」。但池一般不止这些——**只要取到的核全都落在同一个 NUMA 节点里，实现就会把编号下一个节点里允许的核也补进池**（到最后一个节点就绕回节点 0），所以池通常横跨两个节点。只有当取到的核本来就分布在两个或更多节点上时，池才保持原样不扩。

池凑好以后，角色是**按池里的位置**分的，不看这个核属于哪个节点：最前两个核留给这颗 NPU 的中断，最后两个核给 ACL 线程和 release 线程，中间剩下的归主线程。所以图里 ACL 线程和 release 线程落在了节点 1 上，而进程已有的页迁到的是**池里编号最小的那个核**所在的节点，也就是节点 0。这两者不在一侧，说明绑核减少的是跨节点访存，不是消掉它。节点 1 里没进池的核也没有被禁用，只是这个 Worker 不往那边派活。

这件事发生在启动的最后：权重加载完、显存量完、[decode 图也捕获完](glm-5-3-flash-two-node.md#启动时发生了什么)之后，服务开始收请求之前。绑核不改模型计算，也不改输出数值；它影响的只有时延和吞吐，不会影响答案。


固定镜像在预热后才执行绑核，让热分配先在 worker 中形成，再进行页迁移与 CPU 亲和性设置。这个顺序说明迁移针对已有分配；它本身不保证后续所有新分配都落在同一 NUMA 节点。

## 为什么要限制运行范围，代价是什么？

不绑的时候，操作系统可以随时把线程挪到任何允许的核上，多个进程也在抢同一批核。官方文档给这个特性写的三条动机，分别对应三种损耗：

1. **跨 NUMA 访存**。线程跑到别的节点上，或者页留在别的节点上，主机侧每次读写元数据都要多走一段路。
2. **被抢占后搬家**。线程被调度器挪走再挪回来，缓存要重新热起来，主机负载高时更明显。
3. **多个 Worker 互相踩**。一台机器上多个 Worker 各自要下发算子，如果它们共用同一批核和同一块内存，尾时延会更抖。

为什么这点开销值得单独做一个特性？因为 decode 阶段每一步设备上的计算很短，主机侧下发的节奏一旦被打断，等待就直接落在这一步的时延里，而且每生成一个 token 都要重来一遍。同一个方向上还有[图回放](acl-graph.md)，把一批算子的下发省成一次回放；两者管的是同一段主机时间，可以同时开。

代价有四项，都要在开之前想清楚：

- **可用范围变窄。** 亲和集合小了，Worker 自己的线程数又不止绑核认出来的这几条；范围过小时，一堆线程挤在几个核上，反而拖慢下发。
- **迁页只搬已经分配的页。** 它是一次性动作，不是「以后新分配的页都落在本节点」的持久策略；迁页工具装不上就只跳过这一步，亲和性照旧生效。
- **绑中断要有权限，还会动整机。** 把这颗 NPU 的中断绑到指定核上，需要能写中断亲和性；实现还会把正在跑的 irqbalance（Linux 上把中断轮流分到各个核的后台服务）停掉，这条影响的是整台机器，不只本进程。
- **失败不拦启动。** Worker 捕获绑核过程里的异常后只记一条警告就继续跑，所以「服务起来了」不等于「全部绑好了」。失败前已生效的线程亲和性不会自动回滚，要分别检查线程、页和中断的结果。

**这套部署目前没有开绑核和关绑核的对照实测，所以本页不给任何加速比例。** 缺的证据列在页末。

## 放到 GLM 双机：8 个 Worker 各绑在哪里

**固定部署是[两台 Atlas 800 A2、每台 8 卡](glm-5-3-flash-two-node.md#部署前提)，每台机器上有 8 个 Worker 进程，各自绑到从本机一颗 NPU 的亲和节点起手凑出来的那个池上；池可能横跨两个节点，共用同一个池的卡按卡序把池切开，各拿一段。** 两台的核心功能进程示意账合计 20 个，其中 16 个是 Worker；这不含启动器和运行时辅助进程。组成见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)，分工见[引擎进程](engine-processes.md#双机部署里一共有哪些进程)。

每台机器的启动命令都把本机可见设备设成 0 到 7，所以两台机器的 Worker 都用本机编号 0–7 认卡。Worker 在通信组里的编号（rank）是 0–15，但绑核认卡用的是**本机编号**，node1 的 8 个 Worker 也从 0 数起。

| 一个 Worker 绑在哪，由五件事决定 | 这套部署里是什么 |
| --- | --- |
| 本机 Worker 编号 | 0–7，两台机器各数一遍 |
| 绑到哪颗卡 | 本机可见的第 0–7 颗 NPU，按编号对上 |
| 亲和的是哪个 NUMA 节点 | 硬件拓扑给出：这颗卡挂在哪个节点附近 |
| 池里的核从哪里来 | 该节点的亲和核与本进程 cpuset 的交集；若这些核都在一个节点里，再补上编号下一个节点里允许的核 |
| 池要不要再切 | 几颗卡拿到同一个池时按卡序平分；只有一颗卡用这个池就整段归它 |

A2 走的是**按拓扑亲和挑核**这条路：先问硬件「这颗卡挂在哪些核附近」，再在自己被允许的范围内取。另一条路是按全局逻辑设备编号平均切分（下一节讲），A3 才默认走它。

同一台机器上，拓扑把几颗卡指到同一段亲和核时，这几颗卡凑出来的是同一个池，于是**把扩展后的这个池按卡序平分**：排在前面的卡拿池的前段，排在后面的卡拿后段，最后一张把余数一并拿走。池横跨两个节点、又正好由两颗卡共用时，这就意味着**后面那张卡整段核、连迁页的目标节点都落在下一个节点上**，并不在它自己的亲和节点里；共用的卡更多时，中间那几张会跨在两个节点的边界上。实现在分池时会把本进程看不见、但亲和核与本进程 cpuset 有重叠的卡也算进同一组，以免两个进程各自从头切、切出重叠的核；但它只保证同一组内不重叠，跨组是否重叠取决于现场拓扑，这一点本部署还没核。

一个 Worker 从启动走到绑完，一共七步：

```wiki-diagram
file: cpu-binding-flow
```

1. **看开关。** 绑核开关默认是开的；关掉就整件事都不做。
2. **看架构。** 只有 ARM 架构才继续；x86 主机记一条日志就跳过，架构名认不出来也按关处理。
3. **读自己的 cpuset。** 从进程状态文件里读出允许使用的逻辑 CPU 列表。这是上限：容器只给了整机的一部分，就只能在这一部分里挑，按整机核数除以卡数去推每个 Worker 的份额是不可靠的。
4. **建「核 → NUMA 节点」的对照表。** 用 lscpu 列出每个逻辑 CPU 属于哪个节点，后面迁页要用。
5. **建这颗卡的 CPU 池。** 拓扑给出的亲和核与 cpuset 求交。**交集里的核如果全在同一个节点里，就把编号下一个节点里允许的核也补进来**（到最后一个节点就绕回节点 0；那个节点里没有允许的核时池就不变），所以池通常横跨两个节点；交集本来就跨了两个以上节点时，池保持原样。最后，几颗卡拿到同一个池时按卡序平分这个池。
6. **给池里的核分角色。** 排好序的池里，前两个核留给这颗 NPU 的中断，最后两个核分给 ACL 线程和 release 线程，中间剩下的都归主线程。角色只看在池里的位置，不看核属于哪个节点。
7. **动手绑。** 先用 taskset 把主线程连同它的子线程一起限制到主线程那批核上，再把认出来的 ACL、release 线程各挪到自己的核；然后迁页；最后写中断亲和性。

第 5、6 两步走一遍是什么样，上游设计文档里给了一个 A2 的实例：两颗卡的亲和核是同一段 `144-167`，两个进程各只看见其中一颗，cpuset 都是 `144-191`（这是上游文档为说明算法给的拓扑，不是本部署实测核号；本部署的亲和核与 cpuset 尚未拿到）。因为交集 24 核全在同一个节点里，实现先补上编号下一个节点里允许的 `168-191` 凑成 48 核，再按 NPU0、NPU2 两卡平分（按卡序 NPU0 得 `144-167`，NPU2 得 `168-191`，后一张卡整段核落在下一个节点上）：

$$N_{\text{per-NPU}} = \frac{24 + 24}{2} = 24\text{ 核}, \qquad N_{\text{main}} = 24 - 2_{\text{IRQ}} - 1_{\text{ACL}} - 1_{\text{release}} = 20\text{ 核}$$

| 分配阶段 / 角色（上游 A2 算法示意） | 计算口径 | 核数与核号区间 |
| --- | --- | --- |
| 亲和核 `144-167` $\cap$ cpuset | 全部落在同一 NUMA 节点，触发跨节点补池 | **24 核** |
| 扩展后的共享池 | $24 + 24$（补下一节点 `168-191`） | **48 核**（`144-191`） |
| 两卡按序平分（NPU0、NPU2 共用） | $48 \div 2$ | 每卡 **24 核**（NPU0 `144-167`；NPU2 `168-191`） |
| 中断预留（IRQ） | 池最前 2 核 | **2 核** |
| ACL 线程 / release 线程 | 池倒数第 2 核 / 最后 1 核 | 各 **1 核** |
| 主线程池（`assign_main`） | $24 - 2 - 1 - 1$ | **20 核** |

迁页的目标节点不是「NPU 挂的那个节点」这么直接：实现取的是这颗卡的池里**编号最小的那个核**所在的节点，把进程已有的页都迁过去。池横跨两个节点时，这一句决定了页落在哪一侧：上面那个实例里，NPU0 的页迁到 144 所在的节点，NPU2 的页迁到 168 所在的节点，也就是它拿到的那半段所在的节点，而不是它自己亲和的那个节点。所以「各卡的核互不重叠」和「访存都在本地」是两件事，不能互相推出。

**现场这两台机器有几个 NUMA 节点、每节点多少个逻辑 CPU、每颗卡的亲和核是哪一段，知识库里没有实测值。** 硬件规格与设备映射统一归[硬件与设备](hardware-devices.md#主机内存和设备显存分别记什么账)，那一页也列着现场机型与设备映射的缺口。拿到现场列核、列拓扑的命令输出和绑核日志，就能把上面那张结构表和那个实例换成本部署的真实核号；缺什么证据列在页末。

## 拿不到拓扑、核太少、换了产品会怎样

**A2 拿不到拓扑亲和信息**时，实现退回到另一条路：按全局逻辑设备编号把允许的核平均切开，每颗卡拿一段。为什么要用全局逻辑设备编号而不是本进程看到的那几颗？因为几个进程各自只看到设备的一个子集，如果都从自己的第 0 颗开始数，就会从同一段核开始分。各进程使用同一份允许 CPU 列表、同一个设备总数和不同全局设备编号时，这种切法才得到互不重叠的分段；不同 cpuset 或设备识别结果不能靠全局编号自动消除重叠。代价是这条路不看硬件亲和，局部性还取决于核编号与 NUMA 布局。A3 默认走的就是这条路。

**核不够分**时直接报错：留 2 个给中断、主线程至少 1 个、ACL 与 release 各 1 个，一颗卡至少要 5 个核。cpuset 给得太小就凑不齐，这个错会被 Worker 接住变成一条警告，服务照样起来，只是没绑上。

**cpuset 不均衡**时收益会打折。官方文档建议把 cpuset 尽量均匀地分布在各 NUMA 节点上；歪在一侧时，有的卡挑不到自己节点的核。

**换了产品，路径也不同。** 310P 和 A2 一样按拓扑亲和挑核；A3 默认按全局逻辑设备编号切；A5 是另一套：按 CPU cluster 分配、不预留中断核，还要把主机上的轮询线程绑到固定节点，在容器里得让容器能看见主机的进程才找得到那些线程。所以上面那张角色分配表只对 A2 这类产品成立，不要套到所有型号。

固定执行侧的 A5 角色分配路径还把整个 CPU 池分给主角色，为 ACL 与 release 角色留下空列表。这表示没有为后两类角色单独分配 CPU 列表，不能据此认定这些运行时线程不存在。

## 换到 Ascend 950，为什么不能沿用每卡五个核？

前面的五核角色拆分属于固定 A2/A3 路径。950PR/950DT（A5）使用另一条路径：从 NPU 的亲和 NUMA 节点给每个 worker 选择**一个完整 CPU cluster**。固定镜像与四个社区钉点都已有这条分支，2026-11-02 官方说明也明确了该部署要求。cluster 是一组 CPU 逻辑处理器；每核单线程时一组 8 个逻辑 CPU，每核双线程时一组 16 个。比如两名 worker 各需一组，单线程的示意需求就是 2×8=16 个可用逻辑 CPU，不能用 2×5=10 估算，也不能只看 cpuset 总量而忽略组是否完整、是否在亲和节点上。

这条路径另外寻找主机的 UVB 轮询线程，把它们绑定到 cpuset 允许的 NUMA0 CPU 上，并排除 CPU0；它不为 ACL/release 线程单独切核，也不做 IRQ 绑定，已有内存页仍可迁移。因而日志没有单独的 ACL/release 核列表，并不等于这些线程消失。

容器能看见设备，不代表能看见主机线程。Docker 的主机 PID 命名空间用于发现这些线程；共享主机 IPC 则用于进程间内存共享，两者用途不同。前者关系到这里的轮询线程绑核，后者在 [Engram 本地共享](deepseek-v4-1-flash.md#engram-为什么把另一笔内存账放到主机上)中使用。

## 常见误解

- **「绑核=这些核归 Worker 独占。」** 亲和性只限制自己能去哪，不阻止别的进程被调度到同一批核上。要独占得靠 cpuset 或整机规划。
- **「开了绑核就一定更快。」** 它减少的是跨节点访存和线程搬家，收益取决于主机负载、cpuset 形状和迁页有没有成功；范围过小还会把一堆线程挤到几个核上。本部署没有实测对照。
- **「服务起来了，就说明绑上了。」** 绑核失败只记一条警告。要确认得看绑核日志里那颗卡的池和角色分配，再查线程亲和性与页的节点分布。
- **「迁了页，以后新分配的内存也在本节点。」** 迁页只搬当时已有的页，不是持久的内存策略。
- **「A2 也是按全局逻辑设备编号切核。」** A2 默认按拓扑亲和挑核；按全局逻辑设备编号切是 A3 的默认路径，也是 A2 拿不到拓扑时的退路。
- **「绑核把这个 Worker 的线程和页都放在了它自己卡的亲和节点上。」** 只有池没被扩、或者它拿到的正好是前半段时才成立。池扩到下一个节点之后，池最后两个核上的 ACL 与 release 线程就在另一侧；共用一个池的两颗卡里，后一颗卡整段核和迁页目标都在下一个节点上。
- **「绑核是给 NPU 绑的。」** 绑的是主机侧线程和内存页；设备上的执行顺序、算子和输出数值都不受影响。

## 对照源码

### 怎么开

默认就是开的：配置项 `enable_cpu_binding` 不写时取真，要关掉才需要在 `additional_config` 里显式写 `{"enable_cpu_binding": false}`。官方文档也写明，自 v0.18.0rc1 起 ARM 昇腾服务器默认启用，一般不用手配。

只有 ARM 架构真的会绑：入口先判断机器架构，`x86_64`、`amd64` 这类直接返回并记 `CPU binding skipped: non-ARM CPU detected.`；架构名认不出来时也关掉绑核并告警。

上游 vLLM 的 `--numa-bind` 在昇腾上不支持其 GPU 到 NUMA 的检测路径，平台层会关闭这个上游开关，并在尚未显式设置时补上 `enable_cpu_binding=true`；已显式配置的 false 会保留。转换提示本身不证明最终开关为真。`--numa-bind-nodes`、`--numa-bind-cpus` 被忽略。

主机侧要有这些工具：`taskset`（util-linux）、`migratepages`（numactl）、`ps`（procps）、`lscpu`、`npu-smi`。官方镜像自 v0.18.0rc1 起已包含 numactl；自建镜像缺了只丢迁页这一步。

950PR/950DT 的上述新路径需要在创建 Docker 容器时加入 `--pid=host`，否则可能找不到主机 `uvb_poll_window_thread`。从 `lscpu` 的 `Thread(s) per core`、`npu-smi info -t topo` 和当前 cpuset 核对完整 cluster，再查看 `Ascend 950 NPU0: worker=[...]` 以及 UVB 的 `tids`、`cpus` 日志。PID 可见后仍须有设置线程亲和性的权限；修改已启动终端的变量不能替代重建容器。[S28]

### 会报什么错

| 现象 | 文本 | 说明 |
| --- | --- | --- |
| 绑核过程抛出异常 | `Bind cpus failed in rank%s: %s Skip binding cpu.` | Worker 捕获异常后记警告继续启动；已经生效的设置不会回滚，主动跳过某一步则可能只记该步骤自己的日志 |
| 读不到允许列表 | `Can not found specific 'Cpus_allowed_list' in the '/proc/self/status' file.` | 进程状态文件里没有这一行 |
| 拿不到在跑的卡 | `Can not get running npu info.` | 设备查询的进程区里没有可用设备，或与可见设备变量的交集为空 |
| 亲和核与 cpuset 没有交集 | `CPUs available in 'Cpus_allowed_list' conflict with NUMA affinity.` | cpuset 与硬件亲和列表完全错开 |
| 核数不够 | `The number of CPUs is insufficient. Each NPU requires at least 5 CPUs.` | 预留中断 2 + 主线程 1 + ACL 1 + release 1 |
| 读不到 NUMA 布局 | `lscpu command output error, no NUMA node available. Please check!` | 列举每个核属于哪个节点时没拿到节点信息 |
| 拿不到拓扑（不是错误） | `NPU topo affinity not found. action: fallback to global-slice CPU binding.` | 退回按全局逻辑设备编号切 |
| 没有迁页工具（不是错误） | `The 'migratepages' command is not available, skipping memory binding.` | 只跳过迁页 |
| 停了中断均衡服务 | `The irqbalance service is running and has been stopped.` | 为了让中断绑定生效，影响整台机器 |

### 开销和什么时候别开

绑核本身的开销集中在启动：几次外部命令（查设备拓扑、列核与节点、列线程）、一次迁页，以及写中断亲和性。运行期没有额外的周期性动作。

以下情形收益有限或应当关掉：x86 主机上开了也不生效；cpuset 很小、或与别的服务共用同一批核时，池可能凑不齐或过窄；只做功能验证、不看时延时没有必要纠结它；要在同一台机器上跑多个互不相关的服务时，先规划 cpuset，再谈绑核。

**待核：本部署没有开关绑核的对照实测**，也没有现场的线程亲和性、NUMA 页分布采样，所以本页不给收益或损失的数字。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；**本文 GLM-5.3-Flash 双机算例沿用例外 B 专用镜像钉点 `db701c1f`，与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 均保留按 `HardwareProfile` 选择绑定模式，并为内存迁移增加了 `migrate_memory` 开关。** A2/310P/A5 在 `HardwareProfile.cpu_binding_mode` 中设为 `TOPO_AFFINITY`，A3 设为 `GLOBAL_SLICE`；普通角色拆分保留有 IRQ 时 5 核、无 IRQ 时 3 核常量，但 A5（Ascend 950）提前进入完整 8/16 逻辑 CPU cluster 分支（取不到拓扑时跳过 worker 绑核，不回退 `global_slice`），不用五核门槛决定可用性。`bind_cpus(rank_id, npu_id, *, migrate_memory=True)` 新增 `migrate_memory` 参数（默认 `True`）；Worker 在 warmup/capture 后传入物理设备号，但启用 Engram CPU offload 时传 `migrate_memory=False`，跳过页迁移以避免搬动已固定的 `HOST_UVA` 内存，而线程与适用产品的 IRQ 绑定仍按原流程执行。

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 默认开关与配置位置 | `enable_cpu_binding` 默认 `True`（`ascend_config.py#L160-L164`） | 同 `v0.23.0`（`ascend_config.py#L172-L176`） | 配置类字段默认 `True`（`ascend_config.py#L565`） | 同 `v0.30.0`（`ascend_config.py#L655`） |
| 绑定模式表（A2/A3/A5） | 常量表 `DEVICE_BINDING_MODE`：A2 `topo_affinity`、A3 `global_slice` | 同 `v0.23.0` | 迁入 `HardwareProfile.cpu_binding_mode`（`hardware_profile.py#L280-L340`、`cpu_binding.py#L519`） | 同 `v0.30.0`（`hardware_profile.py#L380-L450`、`cpu_binding.py#L519`） |
| 绑核入口签名与页迁移控制 | `bind_cpus(rank_id)`，按 rank 查“在跑的卡”列表；无 `migrate_memory` 参数 | 增加 `npu_id` 由 Worker 直接传入；无 `migrate_memory` 开关 | `bind_cpus(rank_id, npu_id, *, migrate_memory=True)`（`cpu_binding.py#L784-L802`）；Worker 对 Engram `cpu_offload` 传 `False`（`worker.py#L962-L970`） | 同 `v0.30.0`（`cpu_binding.py#L784-L802`、`worker.py#L1091-L1099`） |
| 核数门槛与 A5/非 ARM 行为 | A2/A3 至少 5 核；A5 完整 8/16 cluster；非 ARM 记日志跳过 | 同 `v0.23.0` | 同 `v0.23.0`；A5 提前进入 cluster 分支且无拓扑时跳过（不回退 `global_slice`）[S28] | 同 `v0.30.0` |

固定执行侧 `db701c1f` 与 `v0.23.0`（`2c59ff10`）在本页涉及的行为上一致：均按本机 rank 从“在跑的卡”列表取卡号。升级到 `v0.26.0rc` / `v0.30.0` / `main` 后，由 Worker 直接传入物理设备号并支持按 `migrate_memory` 控制页迁移。

### 源码位置

950 的完整 cluster、主机 PID、UVB、无单独 ACL/release/IRQ 绑定和不同 fallback，依据固定 `921ccc52` 官方 CPU Binding 文档 [S28]；没有本站 950 机器实测。旧 A2 示例与四版本源码按下表核对。

按「谁决定要不要绑 → 谁挑核 → 谁分角色 → 谁动线程和页 → 谁绑中断」读，能把本页机制对回实现。

**检索名称。** 绑核实现在 `vllm_ascend/cpu_binding.py`：入口函数 `bind_cpus`，架构判断 `is_arm_cpu`，主类 `CpuAlloc` 的 `run_all` 串起全流程。挑核的两条路是 `_build_topo_affinity_cpu_pool`（按拓扑亲和，A2 默认）与 `build_global_slice_cpu_pool`（按全局逻辑设备编号切，A3 默认）；模式来源在旧版为 `DEVICE_BINDING_MODE`，在 `v0.30.0` 与 `main` 为 `HardwareProfile.cpu_binding_mode`。`extend_numa` 在池里的核都属于同一个节点时把编号下一个节点里允许的核补进池，`average_distribute` 在几颗卡共用一个池时平分，`_allocate_default_roles` 做角色切分，`bind_threads` 与 `bind_memory` 分别绑线程和迁页，`bind_npu_irq` 写中断亲和性。A5 的独立路径是 `build_ascend_950_cpu_pools` 与 `bind_uvb_poll_window_threads`。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 绑核在启动的哪一步被调用、异常怎么处理 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L760-L773`；`v0.30.0` 见 `c09d3e20:worker.py#L960-L974`；`main` 见 `8d6180e2:worker.py#L1089-L1104` |
| 四版开关默认值 | `2c59ff10:ascend_config.py#L160-L164`、`2ed6cbba:ascend_config.py#L172-L176`、`c09d3e20:ascend_config.py#L563-L568`、`8d6180e2:ascend_config.py#L653-L658` |
| 上游 numa 绑定参数的转换与忽略 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L1206-L1222` |
| 入口、架构判断、`migrate_memory` 与全流程 | `db701c1f:cpu_binding.py#L792-L806`、`#L34-L46`；`c09d3e20` 与 `8d6180e2` 见 `cpu_binding.py#L784-L802` |
| 模式表、`HardwareProfile`、最少核数与状态文件 | `db701c1f:cpu_binding.py#L14-L33`、`#L518-L555`；`c09d3e20:hardware_profile.py#L280-L340`、`8d6180e2:hardware_profile.py#L380-L450`、`cpu_binding.py#L515-L550` |
| 读 cpuset、拓扑亲和、在跑卡与建池分角色 | `db701c1f:cpu_binding.py#L149-L204`、`#L259-L298`、`#L556-L623` |
| 绑线程、迁页目标节点与中断亲和性 | `db701c1f:cpu_binding.py#L249-L258`、`#L643-L790` |
| 完整 cluster 分支、UVB 线程与全局分段公式 | `db701c1f:cpu_binding.py#L299-L518`；四版提前分支见来源 35–38 |
| 官方文档的默认启用、收益与依赖工具 | `db701c1f:docs/source/user_guide/feature_guide/cpu_binding.md#L1-L26`、`#L66-L95` |

**待核汇总。** 一是现场 NUMA 拓扑与每卡亲和核（缺列核与拓扑的命令输出）；二是绑核的实际收益（缺开关对照的两组 trace）；三是现场是否具备写中断亲和性的权限，以及停掉中断均衡服务对整机的影响。这三项补齐前，本页只讲机制与条件。

950 的角色配置将 CPU 池赋给 `assign_main`，并把 `assign_acl`、`assign_rel` 初始化为空列表；空角色列表不表示运行时对应线程不存在。固定实现见 `cpu_binding.py` 的 595–604 行。[C10]
