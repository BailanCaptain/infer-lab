---
id: host-memory-and-hugepages
title: 宿主机内存底座与静态大页：从 HugeTLB 锁页、THP 抖动到分配器调优
type: concept
origin: direct
summary: >-
  讲透百 GiB 级 KV 池与 RDMA 为何受困于 4 KiB 页表，对比 HugeTLB 静态大页（2M/1G）与 THP，厘清 TCMalloc/jemalloc（含 A3/950DT 禁配边界）、/dev/shm、memlock 与宿主机内核四件套。
aliases:
  - 静态大页
  - 大页内存
  - 透明大页
  - HugePages
  - HugePage
  - HugeTLB
  - Static HugePages
  - THP
  - MADV_HUGEPAGE
  - vm.nr_hugepages
  - nr_hugepages
  - Hugepages-Usage
  - HugePages_Total
  - Hugepagesize
  - jemalloc
  - TCMalloc
  - ptmalloc
  - libjemalloc
  - libtcmalloc
  - LD_PRELOAD
  - 主机内存分配器
  - 内存分配器
  - shm-size
  - '--shm-size'
  - /dev/shm
  - memlock
  - ulimit memlock
  - vm.swappiness
  - swappiness
  - scaling_governor
  - kernel.numa_balancing
  - numa_balancing
  - sched_migration_cost_ns
chapters:
  - '07'
  - '11'
order: 115
sources:
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.2.md#L3487-L3503'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L540-L572'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L1439-L1496'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/Qwen3.8-Flash-Next.md#L1987-L2008'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation.md#L49-L71'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L10-L27'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L68-L88'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L145-L224'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/DeepSeek-V4.1-Flash.md#L1344-L1353'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Kimi-K3.md#L800-L855'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/Kimi-K3.md#L810-L818'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.2.md#L149-L173'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/Qwen3.5-397B-A17B.md#L187-L198'
  - 'vllm-ascend@2c59ff10:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L71-L106'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_pool.md#L1-L35'
  - 'vllm-ascend@2ed6cbba:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L68-L102'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L314-L330'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L541-L572'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L16-L41'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/npu.py#L32-L38'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/npu.py#L284-L335'
  - 'vllm-ascend@8d6180e2:recipes/overlays/deepseek-ai/DeepSeek-V4-Flash.yaml#L35-L49'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram_rdma.md#L5-L27'
  - 'https://docs.docker.com/engine/containers/resource_constraints/'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
relations:
  - to: device-memory
    kind: builds-on
    note: 先分清主机 DRAM 与设备 HBM 两本独立内存账，再深入主机侧的页表粒度、锁页注册与分配器
  - to: kv-pool
    kind: builds-on
    note: 外置 KV 缓存池（Ascend Store / MemCache / Mooncake）是宿主机百 GiB 静态大页与锁页注册的直接消费者
  - to: cpu-binding
    kind: builds-on
    note: 理解 NUMA 节点局部性与线程绑核后，才能配置按 NUMA 节点预留大页与关闭自动 NUMA 均衡
  - to: ascend-env-and-serve
    kind: builds-on
    note: 承接单机容器 --shm-size 基础挂载，进一步区分 /dev/shm、memlock 与宿主机 vm.nr_hugepages 三道阈值
contradicts: []
updated: '2026-11-27'
---

**静态大页（Static HugePages，Linux 内核机制名为 HugeTLB）是指在服务启动前，由操作系统预先从物理内存中划出一批连续的 `2 MiB` 或 `1 GiB` 大尺寸内存页组成专用池，且常驻内存永不换出到磁盘交换区（Swap）。** 在纯单卡小模型推理中，主机内存（DRAM）只负责暂存权重文件与 Python 对象，默认 `4 KiB` 小页足以应付；但一旦请求走到[外置 KV 缓存池](kv-pool.md)、[PD 分离跨机 KV 传输](mooncake-connector.md)、[本机 DRAM 卸载](kv-cache-cpu-offload.md)或 [Engram 主机条件记忆表](engram-conditional-memory.md)，主机侧要维护数十乃至数百 GiB 的高速张量池并交给网卡或 NPU 直接读写，宿主机内存底座的页粒度、锁页额度与分配器就成了决定吞吐和尾时延的关键地基。

```wiki-diagram
file: host-hugepages-vs-thp
```

## 为什么 `4 KiB` 标准页在大内存池与 RDMA 传输下会拖垮性能？

现代操作系统把虚拟地址翻译成物理内存地址时，默认以 **`4 KiB`（`4,096 B`）** 为最小管理页。CPU 内部有一块极快但容量很小的地址翻译缓存，叫做 **TLB（Translation Lookaside Buffer，快表）**；支持 **RDMA / RoCE**（绕过内核协议栈直接跨机读写内存的网络技术，见 [CANN 与 HCCL](cann-hccl.md)）的智能网卡与 NPU 的 **SMMU / IOMMU**（设备侧地址转换单元）内部，同样维护着有限的页地址映射表（如网卡 MTT 缓存）。

拿一段 **`1 GiB`（$1,073,741,824\text{ B}$）** 的主机 KV 缓冲段做一笔精确的页表账：

$$N_{4\text{KiB}} = \frac{1\text{ GiB}}{4\text{ KiB}} = 262,144\text{ 页}, \qquad N_{2\text{MiB}} = \frac{1\text{ GiB}}{2\text{ MiB}} = 512\text{ 页}, \qquad N_{1\text{GiB}} = \frac{1\text{ GiB}}{1\text{ GiB}} = 1\text{ 页}$$

如果把外置缓存池放大到生产常见的 **`390 GiB`**，继续使用 `4 KiB` 小页会同时撞上三道墙：

1. **CPU TLB 与网卡地址缓存双重击穿**：`390 GiB` 需要超过 **`1 亿`个页表项（PTE）**。当多线程随机检索不同请求的 KV 块或词表行时，TLB 频繁未命中（TLB Miss），CPU 被迫反复遍历四级内存页表（Page Walk）；同时 RDMA 网卡与 NPU DMA 引擎在跨页搬运散碎物理页时，硬件地址表缓存也会频繁换入换出，拉低有效带宽。
2. **首次触页的缺页中断风暴与锁页耗时**：普通虚拟内存采用按需分配（Demand Paging），首次写入 `1 GiB` 缓冲要触发 `262,144` 次内核缺页中断（Page Fault）；后续向驱动或 RDMA 网卡做**锁页注册（Pin / Register Memory，固定物理页禁止内核移动或换出）**时，内核必须逐页锁定并建立散列物理地址表，初始化耗时会呈数量级膨胀。
3. **后台回收与磁盘交换（Swap）抖动**：普通匿名页受内核内存回收线程（`kswapd`）扫描，一旦物理内存吃紧被换出到磁盘，下一次推理命中就会触发毫秒至秒级的磁盘 I/O 卡顿。

## 静态大页（HugeTLB）怎样工作？`2 MiB`、`1 GiB` 与观测口径

静态大页通过内核专属的 **HugeTLB** 子系统彻底绕开上述三道墙：**提前预留连续物理页、页表项锐减 `512` 至 `262,144` 倍、且天生物理锁死永不进入 Swap**。在昇腾推理生产食谱中，静态大页有三种典型配法，分别对应不同的池化组件与硬件前提：

| 生产场景与组件 | 宿主机配置动作（需宿主机 root 权限） | 页粒度与容量算例 | 适用前提与故障征兆 |
|---|---|---|---|
| **GLM5.2 外置 MemCache 池** | P/D 每台宿主机启动 MemCache 前执行 `sysctl -w vm.nr_hugepages=200000` 并读回核验 | 默认 `Hugepagesize = 2048 kB`（`2 MiB`）时，$200,000 \times 2\text{ MiB} = 390.625\text{ GiB}$ | `vm.nr_hugepages` 操作的是内核默认大页尺寸；若物理内存已被碎片占满，实际分到的页数会小于目标值，须读回确认等于 `200000` |
| **Yuanrong（远戎）Remote H2D** | `dscli` 开启 `--enable_huge_tlb true`，检查各 [NUMA 节点](cpu-binding.md) 的 `2 MiB` 空闲大页 | 按 `/sys/devices/system/node/node*/hugepages/hugepages-2048kB/` 逐节点核对 `nr_hugepages` 与 `free_hugepages` | RoCE 直传需链路可达；走片间高速互联 HCCS 时客户端须显式设 `DS_RH2D_LINK_TYPE=HCCS` |
| **950PR / 950DT 池化清理 vs `1 GiB` 预留** | 常规 Ascend Store 配方先将 NUMA `node0..3` 的 `1048576kB` 与 `2048kB` `nr_hugepages` 清零；仅当 MemCache DRAM 初始化卡住且内核报 `alloc_contig_range ... PFNs busy` 时改测预留 `1 GiB` 页 | 例如 `node0..7` 每节点预留 `32` 个 `1 GiB` 页：$8 \times 32 \times 1\text{ GiB} = 256\text{ GiB}$ | **严禁无脑照抄单一配方**：不需要 HugeTLB 的引擎若被残留静态大页占走数百 GiB，反而会挤爆普通主机内存；而需要连续物理大块却因内存碎片报 `PFNs busy` 时，启动早期按 NUMA 预留 `1 GiB` 大页才能根治 |

### Mooncake / Ascend Store 的锁页内存注册三要素

在 [Mooncake 连接器](mooncake-connector.md) 与 [Ascend Store 缓存池](kv-pool.md) 中，`MooncakeBackend.register_buffer()` 会按传输引擎配置走三条不同分支：默认复用全局引擎 `global_te.register_buffer()` 时，底层调用 `TransferEngine.register_memory(ptr, size)` 完成硬件可直读的锁页注册，返回非零会直接抛出 `RuntimeError: Mooncake memory registration failed.`；启用独立引擎走 `store.register_buffer()` 时，返回非零仅打印错误日志而不抛异常；而开启 `ASCEND_ENABLE_USE_FABRIC_MEM`（仅限 Atlas 800I/T A3 统一内存寻址直传）且未开独立引擎时，此处跳过显式注册。代码默认 `protocol="ascend"`、`global_segment_size = 1 GiB`、`local_buffer_size = 1 GiB`（环境变量 `MOONCAKE_GLOBAL_SEGMENT_SIZE` 优先，部署配置表要求显式配置 `global_segment_size` 并按 **`1 GiB` 对齐**；而 Worker 注册阶段会先合并共用底层 storage 的区间，混合缓存路径还会经 `_align_kv_ptrs` 将区间起点向下按 **`2 MiB` 对齐**并重算覆盖长度后再传入后端）。排查此类池化故障时，必须同时紧盯异常与错误日志，并把三件事分开核验：**池容量参数 `global_segment_size` 是否按 `1 GiB` 对齐、合并/对齐后的缓存区间锁页注册（`register_memory` + `memlock`）是否返回成功、以及外部池守护进程底层支撑页究竟来自宿主机 HugeTLB 静态池还是普通页**。

### 为什么不能只看 `npu-smi info` 的 `Hugepages-Usage`？

很多运维人员执行 `npu-smi info` 时会看到表头里的 `Hugepages-Usage(page)` 列（不同芯片与驱动版本的列项会有差异），误以为它就是宿主机静态大页池容量。实际上，**`npu-smi info` 展示的是设备/驱动视角的大页占用读数**；核验宿主机 Linux 静态大页池的总量、空闲页数与默认页大小，必须以宿主机的 `/proc/meminfo` 和 NUMA `sysfs` 为准：

```bash
# 1. 查看宿主机全局默认大页大小（Hugepagesize）与总页数/空闲页数/预留页数
grep -i huge /proc/meminfo

# 2. 按 NUMA 节点查看 2 MiB（2048kB）与 1 GiB（1048576kB）静态大页实时余量
cat /sys/devices/system/node/node*/hugepages/hugepages-2048kB/free_hugepages
cat /sys/devices/system/node/node*/hugepages/hugepages-1048576kB/free_hugepages
```

## 静态大页（HugeTLB）vs 透明大页（THP）：本质取舍在哪？

既然大页能大幅降低 TLB Miss，为什么不把所有内存都换成静态大页？因为 **HugeTLB 是“硬预留专用池”**——只要 `vm.nr_hugepages` 划走了 `390 GiB`，哪怕推理服务此刻一页没用，这 `390 GiB` 也无法借给 Python 进程、页面缓存或普通 `malloc` 使用；且应用程序必须通过 `mmap(MAP_HUGETLB)` 或 `hugetlbfs` 显式申请才能用上它。

**透明大页（Transparent HugePages，简称 THP）**走的是另一条路：应用代码无需改用特殊分配接口，内核在后台自动尝试把普通虚拟内存区间合并成 `2 MiB` 大页；物理连续空间不足时又可平滑退回 `4 KiB` 小页。但全局开启 `THP=always` 也有代价：当主机内存运行日久产生碎片时，内核做同步拼页整理（Direct Compaction）或后台 `khugepaged` 扫描搬迁页块，会在毫无征兆的时刻卡住业务线程，造成推理请求尾时延（TPOT / TTFT P99）尖刺。

`vllm-ascend` 在 [DeepSeek-V4.1-Flash 的 Engram 主机共享表](engram-conditional-memory.md) 中给出了精准折中范式：同机多 Worker 通过 POSIX 共享内存建立 `SharedUvaBuffer` 后，代码专门对该段大表映射调用 `_madvise_hugepage()` 执行 **`madvise(MADV_HUGEPAGE)`**（向内核提示仅对该共享内存段优先启用 shmem THP 2 MiB 大页；若宿主策略不支持也仅打一条 warning 而不中断启动），紧接着调用 **`aclrtHostRegisterV2`** 将其锁页固定并通过 `aclrtHostGetDevicePointer` 映射进 NPU 的 **UVA（统一虚拟编址）** 地址空间（私有表 `HostUvaBuffer` 则直接走 `aclrtMallocHost`；`main` 分支跨机共享 Engram 进一步结合 HIXL 走已注册且 pinned 的主机暂存缓冲）。

| 对比维度 | 静态大页（Static HugePages / HugeTLB） | 透明大页（THP / `MADV_HUGEPAGE`） |
|---|---|---|
| **物理内存分配时机** | 启动前由宿主机管理员显式预留，物理连续，未用部分普通进程不可借用 | 运行期由内核按需分配或后台合并，碎片严重时自动回退 `4 KiB` 页 |
| **Swap 与碎片整理抖动** | **永不进入 Swap，无后台拼页扫描**，时延确定性最高 | 可能被拆分换出；同步拼页与后台合并可能引入毫秒级毛刺 |
| **接入方式与昇腾典型场景** | 需组件显式支持（如 MemCache、`dscli --enable_huge_tlb true`） | 无需改分配器，按需对热点大表调 `madvise(MADV_HUGEPAGE)` + `aclrtHostRegisterV2`（如 Engram） |

## 多线程主机内存分配器：`ptmalloc` 锁争用 vs `TCMalloc` / `jemalloc` 与禁配红线

搞定了底层物理页，往上一层就是 Python 解释器、PyTorch C++ 运行时与分词/调度线程每秒成千上万次调用的用户态 `malloc / free`。GNU C 库（`glibc`）默认自带的 **`ptmalloc`** 为兼容通用进程设计：多线程高频申请与释放不同尺寸的张量元数据、异步队列对象时，容易在全局或分区堆（Arena）互斥锁上发生争用，且小对象夹杂在长生命周期对象之间会阻止堆顶收缩，造成主机虚拟内存与驻留集（RSS）随压测时长持续虚胖。

为此，昇腾性能调优体系利用 Linux 动态链接器的 **`LD_PRELOAD`** 机制，在不重新编译 Python 和 `vllm` 的前提下，将用户态分配器替换为带**线程本地缓存（Thread-Local Cache）**的高并发分配器：

1. **`TCMalloc`（Thread-Caching Malloc，通用调优指南主推）**：为每个线程维护独立的小对象自由链表，绝大部分小块分配无需加锁；中大对象经中央空闲表按页跨度（Span）聚合管理，兼顾低时延与大对象吞吐。安装 `libgoogle-perftools4` 后，先用 `dpkg -L libgoogle-perftools4` 核对实际 SONAME 路径（Debian/Ubuntu `aarch64` 运行库通常安装为 `libtcmalloc.so.4`，无后缀 `.so` 符号链接仅在安装 `-dev` 包后存在；若路径写空会被动态加载器忽略），再通过 `export LD_PRELOAD="${LD_PRELOAD:+$LD_PRELOAD:}/usr/lib/aarch64-linux-gnu/libtcmalloc.so.4"` 注入，并用 `ldd "$(which python)"` 确认已挂载生效。
2. **`jemalloc`（按模型食谱条件启用，严守硬件禁配红线！）**：按精细尺寸分级（Size Classes）与独立线程缓存降低碎片，在 `DeepSeek-V4.1-Flash`（及 `main` 分支 `DeepSeek-V4-Flash` 配方）检测到 `/usr/lib/aarch64-linux-gnu/libjemalloc.so.2` 存在时被前置注入。**但 `jemalloc` 绝非全机型通吃**：在 **`Kimi-K3`** 部署指南中，`v0.30.0` 明确**禁止在 Atlas 800I A3 上预加载 `jemalloc`**，多份 `950DT` 启动脚本亦显式执行 `unset LD_PRELOAD`；`main` 分支文档进一步写明 **`950DT` 与 `Atlas A3` 均不支持在该场景预加载 `jemalloc`**（在 `aarch64` 64 KiB 页内核或特定 CANN 驱动内存钩子组合下易触发异常或退化）。遇到此类机型与模型食谱时，务必遵守食谱约束或改用默认环境/`TCMalloc`。

## 容器 `--shm-size`（`/dev/shm`）、`memlock` 与宿主机内核稳态四件套

线上排障最常见的另一类“主机内存报错”，是把容器共享内存、锁页配额与内核调度参数混成一团。先用一张表把容器内外的两道配额彻底分清：

| 容器参数 | 控制哪块资源 | 设小了会出什么现象 | 典型生产推荐值 |
|---|---|---|---|
| **`--shm-size`** | 容器内 `/dev/shm`（基于内存的 `tmpfs` POSIX 共享内存文件系统）容量上限 | Docker 默认仅 **`64 MiB`**！多进程 Worker 广播元数据、共享预处理缓存或挂载 Engram 表时直接触发 `Bus error`、`No space left on device` 或共享内存创建失败 | 单卡最小 `1g`；常规多卡 TP/EP 设 `16g`；`Qwen3.5-397B` 长上下文配方设 `64g`；`GLM5.2` 超大池配方设 `500g` |
| **`--ulimit memlock=-1:-1`** | 容器进程允许锁定在物理 RAM 中（禁止换出）的字节上限 | 调用昇腾锁页分配或 RDMA 注册时额度耗尽，典型报错 **`aclrtMallocHostWithCfg error 207001`** 或 `Mooncake memory registration failed.` | 大规模 KV 卸载、跨机 RDMA 或长上下文部署建议在容器层放开 `memlock`（如 `-1:-1` 无限制） |

最后，在宿主机操作系统层（**必须在裸机或 Kubernetes 宿主机以 `root` 执行，容器内无权修改内核全局调度与电源状态**），官方调优指南给出了消除 CPU 抖动与跨节点访存毛刺的**宿主机内核稳态四件套**：

```bash
# 1. 锁定 CPU 频率调节器为 performance，禁止节能降频（ondemand/powersave）带来的唤醒延迟
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# 2. 将交换倾向压到最低（0 或 1），防止大模型常驻内存页被换入磁盘引发秒级卡顿
sysctl -w vm.swappiness=0

# 3. 关闭内核自动 NUMA 平衡扫描（已启用 vLLM-Ascend 显式 CPU 绑核与 NUMA 亲和时必关，防后台页迁移打断算子下发）
sysctl -w kernel.numa_balancing=0

# 4. 检查并按内核版本调整调度器跨核迁移成本阈值（先读当前值再改！）
# 昇腾 Linux 5.10 / openEuler 调优指南示例为 sysctl -w kernel.sched_migration_cost_ns=50000；
# 注意上游 Linux 6.6+ 默认已为 500000 ns 且控制入口迁至 /sys/kernel/debug/sched/migration_cost_ns，切勿把 500000 盲目改小为 50000！
sysctl kernel.sched_migration_cost_ns 2>/dev/null || cat /sys/kernel/debug/sched/migration_cost_ns
```

## 常见误解

- **「配了 `sysctl -w vm.nr_hugepages=200000`，普通 `vllm serve` 的 Python 权重加载和 `/dev/shm` 就会自动变快」**：错。`vm.nr_hugepages` 预留的是内核专用 HugeTLB 静态池，只有显式启用 HugeTLB 的组件（如 MemCache、`dscli --enable_huge_tlb true`）才会从中取页；如果当前部署根本没开这些池化组件，白白锁死近 `390 GiB` 静态大页反而会让普通进程因可用 RAM 枯竭而被 `OOMKilled`。
- **「`npu-smi info` 里看到 `Hugepages-Usage` 是 0，说明宿主机 `vm.nr_hugepages` 没配成功」**：错。`npu-smi info` 显示的是设备与驱动视角的大页计数（且表列随卡型和驱动变化），宿主机 Linux HugeTLB 池是否分配到位必须查 `/proc/meminfo` 的 `HugePages_Total / HugePages_Free` 与各 NUMA 节点的 `sysfs` 文件。
- **「加大了 `--shm-size=64g` 就等于放开了锁页内存，不会再报 `aclrtMallocHostWithCfg 207001`」**：错。`--shm-size` 只管 `/dev/shm` 文件系统大小，而 `aclrtMallocHost*` 受限于进程 `RLIMIT_MEMLOCK`（即 Docker `--ulimit memlock`）与物理可用内存，二者是完全独立的内核检查项。
- **「`jemalloc` 在所有昇腾机器上无脑加进 `LD_PRELOAD` 都能提速」**：错。`Kimi-K3` 官方食谱已明确在 `Atlas A3` 与 `950DT` 上禁用 `jemalloc` 预加载（甚至显式 `unset LD_PRELOAD`），跨代际迁移启动脚本时必须逐项核对目标卡型的分配器兼容性。

## 对照源码

### 怎么开

- **按需预留或清理宿主机 HugeTLB 静态大页**：`GLM5.2` MemCache 食谱在 P/D 宿主机执行 `sysctl -w vm.nr_hugepages=200000` 并读回校验[S1]；远戎（Yuanrong）Remote H2D 通过 `dscli ... --enable_huge_tlb true` 启用并核对 `/proc/meminfo` 与各 NUMA 节点 `2048kB` 大页余量[S3]；`950PR/950DT` 标准 Ascend Store 调优默认先清空 `node0..3` 残留的 `1048576kB` 与 `2048kB` 大页[S2]，仅在 MemCache DRAM 初始化停滞且内核日志报 `alloc_contig_range ... PFNs busy` 时按节点预留 `1 GiB` 大页（如 8 节点各 32 页共 256 GiB）[S4]。设备侧视图见 `npu-smi info` 的 `Hugepages-Usage(page)` 列说明[S5]。
- **容器 `/dev/shm`、锁页额度与用户态分配器**：基础调优容器示例传 `--shm-size=1g`[S6]，长上下文 `Qwen3.5-397B` 传 `64g` 并要求放开 `memlock` 防 `207001`[S13]，`GLM5.2` 大池容器传 `500g`[S12]（Docker 资源约束语义见官方文档[S24]）。通用调优文档推荐安装 `libgoogle-perftools4` 配置 `TCMalloc` 并用 `ldd "$(which python)"` 校验[S7]；`DeepSeek-V4.1-Flash`（及 `main` 分支 `DeepSeek-V4-Flash` overlay）按条件前置 `libjemalloc.so.2`[S9][C22]，而 `Kimi-K3` 在 `Atlas 800I A3` 与 `950DT` 上明确禁配 `jemalloc` 并执行 `unset LD_PRELOAD`[S10][S11][!]。
- **宿主机内核稳态四件套与锁页注册入口**：宿主机 `root` 执行 `scaling_governor=performance`、`vm.swappiness=0`、`kernel.numa_balancing=0`，并按内核版本核查调整 `sched_migration_cost_ns`（旧内核 `sysctl` 指南示例 `50000`，Linux 6.6+ 默认 `500000` 且位于 `debug/sched/migration_cost_ns`）[S8]。代码侧由 `MooncakeBackend.register_buffer()`（`global_te` 分支抛异常、独立 `store` 分支记错误日志、纯 `use_fabric_mem` 分支跳过此处显式注册）与 `MooncakeStoreConfig`（默认 `1 GiB` 段对齐）调用 `TransferEngine.register_memory()`[C17][C18][C19]，Engram 共享表在 `SharedUvaBuffer` 中依次调用 `_madvise_hugepage(MADV_HUGEPAGE)`、`aclrtHostRegisterV2` 与 `aclrtHostGetDevicePointer`[C20][C21]。

### 会报什么错

| 故障位置 | 触发条件 | 典型报错或退化现象 | 核验入口 |
|---|---|---|---|
| 容器主机锁页分配 | 容器 `--ulimit memlock` 过小或宿主机可锁物理页耗尽 | `aclrtMallocHostWithCfg error 207001` | 来源 13 |
| Mooncake 内存注册 | 段未按要求对齐、锁页额度不足或网卡/驱动注册失败 | `global_te` 路径抛 `RuntimeError: Mooncake memory registration failed.`；独立 `store` 路径打印非零返回码错误日志 | 来源 17、19 |
| MemCache 大块初始化 | 系统运行后内存高度碎片化，无法拼出连续物理大块 | 初始化长时间停滞，内核 `dmesg` 刷 `alloc_contig_range ... PFNs busy` | 来源 4 |
| Engram THP 提示与锁页 | 宿主机 shmem THP 策略不支持 `MADV_HUGEPAGE`；或 `aclrtHostRegisterV2` 返回非零 | 前者仅记 warning `madvise(MADV_HUGEPAGE) failed` 继续运行；后者直接抛 `RuntimeError: aclrtHostRegisterV2 failed` | 来源 20、21 |
| `A3 / 950DT` 误挂分配器 | 在 `Kimi-K3` 等食谱禁配环境强行 `LD_PRELOAD=libjemalloc.so.2` | 违背官方食谱硬约束，引发启动异常或运行期内存退化 | 来源 10、11 |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 外置池指南路径与大页配方 | 指南名为 `kv_pool.md`[S15]；`MooncakeBackend` 默认 `1 GiB` 段大小 | 仍为 `kv_pool.md`；保留 `global_te.register_buffer` | 指南迁至 `kv_cache_pool_ascend_store.md`（旧路径移除），补齐 `950PR/950DT` 清零残留大页、远戎 `--enable_huge_tlb` 与 `GLM5.2` `nr_hugepages=200000` | 同左，并在 `Qwen3.8-Flash-Next` 新增 `PFNs busy` 下预留 `1 GiB` 大页排障方案 |
| 通用调优文档分配器建议 | `optimization_and_tuning.md` 同时列出 `1.1 jemalloc` 与 `1.2 Tcmalloc`[S14] | 同 `v0.23.0` 同时保留 `jemalloc` 与 `TCMalloc` 两节[S16] | 通用调优页仅保留 `TCMalloc`；`jemalloc` 收敛至 `DeepSeek-V4.1-Flash` 等特定食谱，`Kimi-K3` 明确禁止 A3 预加载 `jemalloc` | 进一步在 `Kimi-K3` 明确 `950DT` 与 `A3` 均不支持 `jemalloc`，`DeepSeek-V4-Flash` overlay 保留按需注入 |
| Engram `MADV_HUGEPAGE` 与跨机锁页 | 无 `deepseek_v41/engram` 模块 | 无 `deepseek_v41/engram` 模块 | 新增 `SharedUvaBuffer` 在 POSIX 共享内存上调 `MADV_HUGEPAGE` + `aclrtHostRegisterV2` | 同左，并新增跨机共享 Engram（`shared_engram_rdma.md`）结合 HIXL 走 pinned staging 缓冲[S23] |
| 宿主机内核稳态四件套 | 已收录 `performance`、`swappiness=0`、`numa_balancing=0` 与 `sched_migration_cost_ns=50000` | 同 `v0.23.0` | 同左，章节行号随分配器精简前移至 `L145-L224` | 同 `v0.30.0`（位于 `L149-L228`） |

### 源码位置

- **池化大页、容器配额与内核调优文档（来源 1–16、23–24）**：`GLM5.2` 的 `vm.nr_hugepages=200000` 与 `--shm-size=500g` 见来源 1、12；`Ascend Store` 大页清零与远戎 `--enable_huge_tlb` 见来源 2、3；`1 GiB` 大页排障见来源 4；`npu-smi` 表列见来源 5；容器挂载、`TCMalloc` 与内核四件套见来源 6–8（早期含 `jemalloc` 的双分配器版本见来源 14、16，早期 `kv_pool.md` 见来源 15）；`DeepSeek` 与 `Kimi-K3` 的 `jemalloc` 启用/禁配边界见来源 9–11；`memlock` `207001` 见来源 13；跨机 Engram RDMA 见来源 23；Docker 容器内存与 `shm` 限制见来源 24。
- **锁页注册、THP 提示与食谱代码锚点（来源 17–22）**：`MooncakeBackend.register_buffer`、`MooncakeStoreConfig`（`1 GiB` 默认段大小）及 `GlobalTE.register_buffer -> TransferEngine.register_memory` 见来源 17–19；Engram `_madvise_hugepage` 与 `SharedUvaBuffer` 的 `aclrtHostRegisterV2` 见来源 20–21；`DeepSeek-V4-Flash` 配方见来源 22。文中 `1 GiB` 页表项倍数与 `390.625 GiB / 256 GiB` 容量由页大小直接推算[D]；Mooncake 二进制内部选页细节因外部库不在本仓源码树内，须结合现场进程 `/proc/<pid>/smaps` 核验[I]。
