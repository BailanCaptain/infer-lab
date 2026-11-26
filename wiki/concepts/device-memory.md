---
id: device-memory
title: 主机内存与显存：数据现在放在哪
type: concept
legacyAnchors:
  启动时主机读文件每卡留下自己的权重: 放到 GLM 双机：先装权重，再接住一个 token
  请求到来权重复用激活和历史各有去处: 放到 GLM 双机：先装权重，再接住一个 token
  启动预算显存里还要容纳权重之外的东西: 放到 GLM 双机：先装权重，再接住一个 token
summary: CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。
aliases:
  - 显存
  - 设备内存
  - HBM
  - 主机内存
  - host memory
  - CPU 内存
  - Host
  - 容器内存限制
  - cgroup v2
  - memory.high
  - memory.max
  - OOMKilled
  - 退出码 137
  - PYTORCH_NPU_ALLOC_CONF
  - expandable_segments
  - NPU 内存分配器
  - GM
  - Global Memory
  - H2D
  - UVA
  - Unified Virtual Addressing
  - 为什么显存会满
  - 显存为什么不够
chapters:
  - '07'
  - 09
order: 110
sources:
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/runtimeapi/aclcppdevg_03_1804.html
  - 'https://www.hiascend.com/developer/techArticles/20251203-5'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/base_loader.py#L43-L82'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L1021-L1027'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L530-L565'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L152
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L469-L480'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L282'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L282'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L281'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237'
  - 'vllm@0fc695fc:vllm/config/cache.py#L67-L80'
  - 'vllm@568afb3a:vllm/config/cache.py#L68-L81'
  - 'vllm@84030bbe:vllm/config/cache.py#L112-L125'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L469-L480'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L453-L464'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L447-L458'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L496-L525'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L733'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L779'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L551-L880'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3796-L3796'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3849-L3849'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4380-L4380'
  - 'https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html'
  - 'https://docs.docker.com/engine/containers/resource_constraints/'
  - >-
    https://docs.docker.com/reference/cli/docker/container/ls/#filter-by-exit-signal
  - >-
    https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
  - >-
    https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
  - 'https://docs.docker.com/reference/cli/docker/container/kill/'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L762-L780'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L772-L790'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L773-L791'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1318-L1354'
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.h
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.cpp
  - >-
    https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUCachingAllocator.cpp
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L274-L287'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1436-L1472'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L377-L395'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L232-L244'
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L105'
  - 'vllm@ced6857a:vllm/config/cache.py#L228-L236'
  - 'vllm@ba15685a:vllm/config/cache.py#L216-L237'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1445-L1464'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L464-L474'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L558-L598'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4476-L4476'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_v2/patch_uva.py#L29-L55'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L377-L386'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L259-L265'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1743-L1752'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L555-L565'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L684-L707'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/worker/patch_uva.py#L32-L58'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L3-L258
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L1077
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L599-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L762-L778'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L905-L950'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L882-L902'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先明确设备边界，才能回答某段内存归哪个设备使用
  - to: matmul-and-weights
    kind: builds-on
    note: 权重矩阵作为推理期最大静态常驻项，决定了单卡显存预算的起点
  - to: kv-cache
    kind: builds-on
    note: 物理 KV 缓存池占满权重与激活峰值之外的剩余显存预算
  - to: kv-cache-cpu-offload
    kind: builds-on
    note: 本页的卸载边界对照主机与设备间的实际换出与恢复路径
contradicts: []
updated: '2026-11-26'
origin: direct
---

## 权重在主机里，为什么还要搬进显存？

**主机内存供 CPU 使用；显存（在昇腾硬件文档中也称 GM，即 Global Memory 全局内存）是计算设备本地的内存，本页的设备是负责模型计算的 NPU。** 权重是训练好的数值，常排成按行、列组织的[矩阵](matmul-and-weights.md)。

```wiki-diagram
file: device-memory-plate-cutaway
```

默认的本地计算路径要求 NPU 从本卡设备内存读取输入和权重，不能把普通 CPU 张量的主机地址直接交给算子使用。设备上的 HBM（高带宽内存）读取带宽远高于主机到设备链路；计算会反复读取所需权重，因此默认部署让权重常驻设备，只在加载时搬入，避免每轮计算都经过较慢的链路。支持主机注册、映射的路径另见下文：能远端访问，也仍要支付链路代价。

本页对应 [NPUWorker 启动生命周期](npu-worker-lifecycle.md)的加载与显存探测环节。默认加载路径先把权重文件读入主机内存，再把本卡要用的分片复制进设备显存。

```wiki-diagram
file: device-memory
```

图中两侧 `5×3` 网格都表示已经选出的本卡权重分片 `W`（不是左侧完整矩阵缩成右侧分片，所以两边格数相同）。左边是主机源数据，右边是加载期经一次 H2D 复制后的设备常驻副本；复制不会自动释放主机源数据，两边同时保留时各记一笔占用。同时右侧本卡 HBM 还必须独立装下试跑激活峰值、`non_torch` 缓冲、物理 KV 块池与录图余量，而左侧可选的主机锁页 UVA 区虽能经链路远端访问，物理上仍占主机内存、不计入右侧 HBM 容量。

## 为什么要分开记账，搬运的代价在哪里？

**NPU 执行默认的本地计算路径，需要本卡显存里已有输入和权重。** 以单张 `64 GiB` 昇腾 NPU 运行标准稠密模型 **`Qwen3-8B`**（`BF16` 精度，`8.19B` 参数）为例，常驻权重约占 **`15.25 GiB`**；除了权重，设备显存还要装下前向激活峰值、HCCL（昇腾集合通信库）通信缓冲、物理 KV cache 池以及图捕获开销。主机内存能装下磁盘上的 `.safetensors` 权重文件，只解决了读取与暂存这一侧的问题。

主机到设备的复制叫 **H2D**。加载器取出本卡权重分片后触发 H2D，依赖它的计算必须等数据就绪。常驻权重在启动阶段按张量分批搬入；进入稳态推理后，每层处理 token 时常驻权重的 H2D 次数为 **`0`**，全部直接读取本地 HBM。若另行启用卸载，把暂时不用的数据留在主机，用到时就要付出恢复传输或远端读取的代价，触发条件见 [KV cache CPU 卸载](kv-cache-cpu-offload.md)。

| 要区分的量 | 回答什么问题 |
|---|---|
| 主机内存／本卡显存 | 字节实际存在哪一侧，向谁申请空间？ |
| 容量／带宽 | 能放多少字节／每秒能搬多少字节？ |
| 权重／激活 | 训练后保留的参数／本次计算产生的中间结果？ |
| HBM／显存 | 内存技术名字／设备本地内存的用途叫法？ |

HBM 是高带宽内存技术，容量和带宽仍要看具体硬件；部分昇腾设备使用 DDR，运行时查询 HBM 时会按支持情况转查 DDR。设备内存不足是容量问题；装得下却算得慢，还要测取数、计算和通信各花了多久，不能仅凭「用了 HBM」判断瓶颈。

下面这张全景图把主机侧、设备侧以及单卡 `64 GiB` 运行 `Qwen3-8B` 的启动显存预算拆分摆在一起，方便对照下文的主机限额与双机异构算例：

```wiki-diagram
file: device-memory-fig-host-vs-hbm
```

## 落到标准部署：单张 64 GiB NPU 跑 Qwen3-8B 怎样记双账？

沿一条标准启动与推理链路，主机内存与本卡显存各自记自己的账：

| 主机账：每台服务器（Host DRAM） | 设备账：逐张 NPU 分别看（NPU HBM） |
|---|---|
| 磁盘 `.safetensors` 文件页缓存、加载中的 CPU 张量 | 本卡权重分片（如 `Qwen3-8B` BF16 约 `15.25 GiB`）与布局重排 |
| token 编号、请求队列、调度状态及块号表 | 执行用输入、激活峰值、算子临时工作区 |
| 启用卸载或 UVA（统一虚拟编址，见下文）时锁页留在主机的数据 | 已分配的物理 KV 缓存池、HCCL 缓冲与 `ACLGraph` 录图资源 |

在 `v0.30.0` 主基线上，单张 `64 GiB` NPU 运行 **`Qwen3-8B`**（默认 `--gpu-memory-utilization 0.92`，实例预算 `58.88 GiB`，预算外 `1 − u` 余量 `5.12 GiB`）按四步落位：

1. **主机读盘 → 一次 H2D 常驻权重**：加载器先将磁盘 `.safetensors` 读入主机页缓存与临时 CPU 张量，再逐张量 H2D 搬入 NPU HBM，落定 **`~15.25 GiB`** 常驻权重（推理期权重 H2D 为 `0`）。
2. **启动试跑（`profile_run`）扣峰值激活与非 Torch 增量**：用最大单步批量跑一次假输入，量出激活峰值与已具象化 HCCL 缓冲在内的非 Torch 增量（PyTorch 分配器之外的底层显存增量，示意共 **`~2.74 GiB`**）。
3. **剩余预算切成物理 KV 缓存池**：扣完权重与试跑两项后，余下约 **`40.88 GiB`** 全拨给 KV 池。`Qwen3-8B` 在默认 `block_size = 128` 下每块占 **`18 MiB`**，共切出 `2,325` 块；扣除 `1` 个 `null_block`（框架预留的空哨兵块）后剩 **`2,324` 个可用块**，标准 GQA 零索引器额外副本。
4. **切完 KV 才录 `ACLGraph`**：图捕获显存与运行期延迟缓冲由预算外 `5.12 GiB` 余量支付；请求结束归还块只回收到池内复用，设备已保留显存不会立即下降。

完整的七级冷启动显存台阶、HCCL 通信域去重规则与四卡 MoE 预算推导，统一见 [KV cache 显存预算](kv-cache-memory-profiling.md)与 [NPU Worker 生命周期](npu-worker-lifecycle.md)。

### Ascend 910B3 真机显存对账：60.96 GiB 可见基数、`non_torch` 跳变与 DEBUG 热路径税

把上面的标称 `64 GiB` 示意算例落到 `Ascend 910B3` 真机（`v0.30.0`，完整档案见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）时，有三项实测口径直接决定预算对账与线上延迟测量是否准确：

| 模型与并行拓扑（`INFO` 干净态） | OS 可见总显存 / 启动空闲 | `u`（请求预算） | 权重 / 卡 | 激活峰值 | `non_torch` | 可用 KV / 卡 | 图显存 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `Qwen3-8B` · `TP=1` | `60.96` / `60.57 GiB` | `0.85`（`51.81 GiB`） | `15.29 GiB` | `0.20 GiB` | **`0.03 GiB`** | `36.29 GiB` | `2.59 GiB` |
| `Qwen3-8B` · `TP=2` | `60.96` / `60.58 GiB` | `0.85`（`51.81 GiB`） | `7.66 GiB` | `0.20 GiB` | **`0.43 GiB`** | `43.52 GiB` | `2.92 GiB` |
| `Qwen3-8B` · `TP=4` | `60.96` / `60.58 GiB` | `0.85`（`51.81 GiB`） | `3.84 GiB` | `0.18 GiB` | **`0.43 GiB`** | `47.36 GiB` | `3.10 GiB` |
| `Qwen3-8B` · `TP=8` | `60.96` / `60.58 GiB` | `0.85`（`51.81 GiB`） | `1.94 GiB` | `0.17 GiB` | **`0.44 GiB`** | `49.27 GiB` | `3.21 GiB` |
| `Qwen3-30B-A3B` · `TP=4+EP=4` | `60.96` / `60.58 GiB` | `0.88`（`53.64 GiB`） | `14.27 GiB` | `0.19 GiB` | **`0.45 GiB`** | `38.73 GiB` | `2.30 GiB` |
| `Qwen3-30B-A3B` · `DP=2+TP=4+EP=8` | `60.96` / `60.58 GiB` | `0.88`（`53.64 GiB`） | `7.52 GiB` | `0.36 GiB` | **`0.55 GiB`** | `45.21 GiB` | `2.64 GiB` |

1. **`60.96 GiB` OS 可见基数 vs 标称 `64.00 GiB`**：`npu-smi` 标称单卡 `65,536 MB`（`64.00 GiB`）、空载板级占用 `3,426 ~ 3,453 MB`，而 `acl.rt.get_mem_info` 暴露给操作系统的总显存固定为 **`60.96 GiB`**。自动预算 `requested_memory = total_memory × u` 乘的是 **`60.96 GiB`**（`u = 0.85` 即 `51.81 GiB`），相差的 **`3.04 GiB`** 已在底层预留中扣在 `total_memory` 之外，手工核算时绝不能再从 `60.96 GiB` 里二次扣减（驱动、固件与页表在 `3.04 GiB` 内的细分占比无运行时单独读数）。
2. **`non_torch` 从 `TP=1` 的 `0.03 GiB` 跳变到 `TP≥2` 的 `0.43 ~ 0.55 GiB`，且不可二次扣减**：启动快照 `init_snapshot` 拍在分布式通信建组之前。单卡 `TP=1` 无跨卡集合通信，实测 `non_torch` 仅 **`0.03 GiB`**；扩至 `TP≥2` 或叠加 `EP/DP` 后，已在 `profile_run()` 试跑窗口内具象化的通信域资源与运行时缓冲全部落入 `non_torch_increase`（稠密 `TP=2/4/8` 为 **`0.43 ~ 0.44 GiB`**，`TP=4+EP=4` 为 **`0.45 GiB`**，`DP=2+TP=4+EP=8` 为 **`0.55 GiB`**）。这部分已在自动 KV 预算中扣过，容量规划时不应重复扣减；同时 `non_torch` 代表试跑窗口内全部非 PyTorch 显存净增量，不能全部贴上单一 HCCL 标签。
3. **`VLLM_LOGGING_LEVEL=DEBUG` 热路径分配器读数税**：`NPUWorker.execute_model()` 每步都会调用 `log_memory_stats()`。在默认 `INFO` 下该函数立即返回；一旦开启 `VLLM_LOGGING_LEVEL=DEBUG`，每步都会读取缓存分配器计数器 `torch.npu.memory_reserved()` 与 `torch.npu.memory_allocated()` 并格式化输出（并非每步调用设备级 `mem_get_info` 同步；`Qwen3-8B` `TP=1/2/4/8` 压测中分别打印 `979 / 830 / 1,660 / 3,312` 行），配合 `ACLGraph` 的输入地址检查，在 `Qwen3-8B` `TP=8` `c=1` 单样本对照下将首 token 延迟 `TTFT` 从 `139.07 ms` 推高至 **`193.98 ms`（`+54.91 ms` / `+39.48%`）**。

## 主机还有空闲，为什么容器里的进程先被终止？

**主机有多少内存，与一个容器获准用多少内存，要分开看。** Linux 可以用 **cgroup（控制组）**把一组进程放在一起记账和限额。容器运行时利用这套机制约束主机内存；它没有替 NPU 增加显存。

用一个**教学示意**建立直觉：一台机器整机还有空闲，但某容器只获准使用 20 GiB 主机内存。加载权重时，这一组进程的占用逼近上限，继续申请的空间需要通过内核回收腾出来；腾不出时，就会遇到 **OOM（内存不足）**，内核可终止组内进程释放空间，具体处理还取决于申请类型。

排查容器主机内存时，要分清三层概念，避免把“变慢”和“被杀”混为一谈：

- **嵌套预算，不只看本容器：** 控制组可以嵌套，多个容器可以共用上层控制组的总预算。即使本容器未碰到自己的上限，上层预算用尽或整机内存耗尽时，组内进程仍会受内存压力影响；被终止的进程不一定就是造成压力的来源，因此必须分别核对**本容器、上层控制组与整机**。
- **`memory.high`（变慢）≠ `memory.max`（强杀）：** 这里的“回收”是内核尝试腾出可再利用的主机内存，也解释了为什么**服务没死，却突然变慢**。Linux cgroup v2 的 `memory.high` 是加强回收并节流推进的边界，超过它本身不会触发 OOM killer（内核因内存不足终止进程的机制）；`memory.max` 才是硬上限，触及后又无法降低占用时才可能走到 OOM 处理。两者不能混成“超过就立刻退出”的一条线。
- **Kubernetes 里的 `request` 与 `limit`：** `request` 主要供调度器安排节点，`limit` 约束运行时用量；现场仍须核对实际生效的控制组设置，不要仅凭配置里写了 `limit` 就假定 `memory.high` 一定设成同一个值。下文涉及的字段均以 Linux cgroup v2 为范围，其他版本先核对对应接口。

## 进程突然退出，先查哪三件事？

遇到进程突然退出或显存分配失败，先保存故障现场记录再重启复测——新进程占用很低，不能说明旧进程退出前也很低。先看下面的双侧排障分流图，区分问题落在主机 cgroup 还是设备 HBM：

```wiki-diagram
file: device-memory-fig-oom-triage
```

主机侧按以下三步收口，避免把误杀、节流与跨层压力混为一谈：

1. **认准同一次运行：** 留下容器 ID、进程 PID、退出时刻和最后一条成功日志，把平台终止原因、退出码与该次运行一一对应，避免把重启前后的记录混在一起。
2. **查清是谁终止了它：** Docker 显示退出码 **137** 时，先查同期操作审计、容器事件和内核日志——主动发送 `SIGKILL`（强制终止信号）同样返回 137，单凭退出码不能断言内存不足；平台标记 `OOMKilled` 时，再核对同一 PID 和时刻的内核 OOM 记录以确定故障范围。
3. **确认为 OOM 后，定位哪一层没余量：** 本容器超限就核对组内进程、文件缓存等占用及加载峰值；上层控制组超限或整机不足，就查共享该层预算的同机任务；若是设备分配报错，则回到逐卡显存账。先找对层，再决定减小哪种占用或调整哪一层预算。

**两个高频误读与恢复验收边界：**

- **`memory.events.local` 的 `oom_kill` 增加，不等于本组超限：** 它只说明本组有进程被 OOM killer 终止，仍要用匹配的内核记录区分本组限额、上层限额与整机压力；计数必须比较故障窗口前后，同一运行里的旧计数不能直接算作本次事件（字段细节见下文[会报什么错](#会报什么错)）。
- **服务未死但 `high` 事件增加、回收等待变长：** 若设备单次执行耗时基本不变，先验证主机内存压力是否拖慢供给；确认上层与整机有余量后，可在隔离环境保持负载不变、仅调整这一边界做对照。回收等待下降只解释其中一段耗时，端到端延迟仍按[推理测量](inference-benchmarking.md)验收。
- **恢复不以“重启成功”结束：** 沿[容量与恢复案例](inference-capacity-and-reliability.md)恢复原负载（含同机共享预算任务），检查成功率、答案质量、用户可见延迟与各层资源余量；全部达标才收束，若只消除 OOM 但延迟仍不达标，则继续追剩余等待。

## 异构旗舰对照：GLM 双机语言权重子账与预算余量

下面转入例外 B 历史绑定算例——**GLM-5.3-Flash 官方双机**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，完整前提见[官方双机前提](glm-5-3-flash-two-node.md#部署前提)）。与单卡稠密 `Qwen3-8B` 相比，这里增加了跨机专家切分、W8A8 量化后处理布局、MLA 复制缓存，以及晚于预算测量才创建的索引器运行时副本。

### 放到 GLM 双机：先装权重，再接住一个 token

**主机上的文件缓存与每卡的常驻参数是两本账。** 两台 Atlas 800 A2 各有 8 张 NPU：TP8 把同一矩阵切给机内 8 卡，EP16 把不同专家网络分给两机 16 卡，DP2 则把请求分给两个执行组。每台都只持有部分专家，两台合起来才有完整模型。

默认加载器先按本卡形状在 NPU 上分配参数，再逐个读取权重文件里的 CPU 张量。负责该参数的加载函数选出本卡分片，复制到已经分配的设备参数里，随后按算子要求转置或转换存储布局。主机里的文件页缓存、CPU 张量与设备里的处理后布局，不能按文件大小一比一替代。

每卡约 **20.58 GiB** 的语言权重子账包含主干和 **MTP**（模型自带、用于猜后续 token 的草稿层）的主要语言层权重；MTP 输出头复用主模型，不重复计。这个数对应固定量化配方 `3121f187`；旧配方 `9e55cbc8` 将四组 MLA 投影保留浮点，同一子账约 **20.81 GiB**。两者均不含 MTP 旋转矩阵缓冲、视觉塔权重与量化辅助张量（scale/offset 等），20.81 不是完整占用的上界；版本明细见[权重账及其精度条件](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)，实机占用以日志为准。

**请求到来时，权重复用，激活和历史各有去处。** 以 [R1](one-request.md#示例请求-r1-与官方双机部署)（prompt 含 4 个 token）为例：CPU 先记下 token 编号与调度状态，准备输入时把编号和位置送往设备；NPU 查表转成向量并与常驻权重计算，中间激活随本轮复用。缓存则按结构分流：主干加 MTP 有 **12 层**稀疏 MLA cache，TP 各卡保留完整副本；KDA 的固定状态按各卡负责的头划分，不能把「权重分成八份」套成「所有缓存也除以八」。具体每块字节见[缓存预算的唯一推导](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，R1 块号账沿用[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。

**双机预算余量与晚于测量的索引器副本。** 双机页的[两种块数](glm-5-3-flash-two-node.md#两种块数各在什么时候用)均假设每卡 **64 GiB**、激活峰值加非 PyTorch 占用 **3.4 GiB**，并采用教程的 **`0.85`** 预算比例（预留 **9.6 GiB** 预算外余量）。按 `21 GiB` 假设权重计，余下 **30.00 GiB、3,855 块**；仅代入所列语言权重子账计，余下约 **30.42 GiB、3,908 块**（尚未扣 MTP 旋转矩阵缓冲、视觉塔权重与量化辅助张量等表外项）。固定实现先切 KV 再录图，且索引器在首次实际执行时才建 **54 MiB/卡** FP32 副本，两者均从预算外余量支付。注意 `64 GB`（十进制）与 `64 GiB`（二进制）口径不同，实机总字节以运行时上报为准。

```wiki-diagram
file: device-memory-fig-glm-twin-accounts
```

想把这些内存账对应到昇腾 950，继续看[片上缓冲与搬运路径](ascend-950-architecture.md)和[远端访问与互联](ascend-950-execution-interconnect.md)。新硬件规格集中在前一页；本页继续解释本地分配、远端访问与复制的区别。

## 常见误解：能访问，就等于已经在本卡了吗？

**可访问地址与物理存放位置是两件事。** 在硬件和运行时支持时，可以把主机内存注册、映射成设备可访问地址；设备沿该地址读取的是主机数据，注册动作本身没有把全部内容复制成本卡显存。普通复制则要先申请设备空间，复制完成后才得到本地副本。

例如在 `v0.30.0` 与 `main` 的 V2 runner 路径中，启用 **UVA（Unified Virtual Addressing，统一虚拟编址）** 须同时满足两个条件。一是 `PYTORCH_NPU_ALLOC_CONF` 包含 `pinned_mem_register:True`，二是 `triton-ascend` 版本不在受指针校验缺陷影响的 `3.2.1` / `3.2.2` 列表中。即便 UVA 可用，锁页主机内存仍物理驻留在主机侧，不计入 HBM 容量（宿主机侧 HugeTLB 静态大页、THP 透明大页、`memlock` 配额与跨流显存分配器调优分别见 [宿主机内存底座与静态大页](host-memory-and-hugepages.md) 与 [昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）。

在支持 MemFabric 的超节点部署中，这类软件可把分散在多机的内存组织成可访问的池；它改变了寻址和访问方式，各处存储介质与传输路径仍然存在。预算要分清本地分配、远端访问和实际复制；支持范围受产品及软件版本限制。

- **“CPU 还有内存，NPU 就不该分配失败。”** 设备分配检查的是所选卡的空间；卸载需要对应实现和数据恢复流程。
- **“权重装得下，服务就一定能启动。”** 试跑、缓存池、通信资源及录图都还会申请空间，加载后处理也可能出现临时副本。
- **“把多卡容量加起来，就是任意一张卡可用的池。”** 本卡分配仍受本卡约束；并行切片决定哪些数据放哪张卡，映射也不消除远端访问代价。

## 对照源码

现场比较内存时，把加载后、试跑后、建池后、录图后与请求结束后的采样时点分开，并同时记录活动请求与空闲块。设备已用内存没有下降时，先按本页的池与引用区别判断，再沿[内存与容量排障](inference-troubleshooting.md#内存与容量先分清在哪个时点装不下)验证增长是否来自仍在使用的资源。

### 怎么开

**设备分配器的配置。** `PYTORCH_NPU_ALLOC_CONF` 是启动进程前设置的环境字符串，由 torch_npu 的缓存分配器读取；各项写成 key:value，用逗号分隔。固定 GLM 教程在两端都写 `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`。expandable_segments 让一段虚拟地址按需要增加物理页，减少批次尺寸略微变化时留下的零碎空间；它不增加 HBM 容量，也不代替上面的权重、激活与 KV 预算。

要分清三层默认：配套 torch_npu 2.10.0.post2 的构造默认是 false；Ascend 平台在有 model_config 且未启用 sleep mode 时，变量未设置便注入 expandable_segments:True；教程再显式固定为这个值。已有字符串含 expandable_segments 时保留原值，所以显式 False 不会被平台改回 True。已有其他项且不含 max_split_size_mb、garbage_collection_threshold 时，平台追加 expandable_segments:True；含这两个冲突键则不追加。不要把“变量已设置”误当成“平台绝不追加”。这些操作必须发生在分配器读取配置之前；修改正在运行服务的外部 shell 环境不会重配其内存池。

主机／设备的区分是默认执行路径的基础，无需开关。固定部署用 `--gpu-memory-utilization 0.85` 控制自动预算，名字里的 gpu 在此仍用于 NPU；它按总设备内存取比例，启动时另检查空闲量。若显式指定 `kv_cache_memory_bytes`，固定 Worker 仍试跑以准备模型，但返回指定字节数，跳过自动预算公式。卸载不是这个比例参数自动提供的功能。

下图把本页放回 A0：Worker 是管理一张卡的执行进程；图捕获是把计算序列记录下来，供之后回放。代码名只标在需要定位的步骤。

```wiki-diagram
file: device-memory-startup
```

先完成设备初始化，才能查询本卡容量、建立快照；空闲检查不通过则停止启动。通过后建立通信环境与执行器、加载权重并测量，再从自动或显式预算分支汇合到缓存分配。图捕获受执行模式控制；完整进程调用链见[请求调用链](request-call-chain.md)，本图聚焦内存发生在哪一步。

### 会报什么错

分配器配置使用大小写敏感的 True / False；例如 expandable_segments:true 不是这里接受的拼写。未知键会报 `Unrecognized CachingAllocator option`。显式启用 expandable_segments，并同时设置非默认的 max_split_size_mb 或 garbage_collection_threshold，会被配套分配器拒绝；平台“不追加”的保护不会修复用户已经写出的冲突组合。地址预留能力检查失败还可能报运行时错误或回退告警，先查匹配的 torch_npu、CANN 与驱动，不把它归为 KV 块不够。

`Free memory on device ... is less than desired GPU memory utilization` 表示启动快照的空闲量低于请求份额：核对当前设备号、同卡其他进程及配置比例。`Error in memory profiling` 的对应断言则检查试跑前后空闲量关系；同时有其他进程释放显存会扰乱测量。两者检查的都是设备账。

若应用没有来得及报错就退出，按上面的三步先查终止记录。确认要追主机内存后，再从平台找到故障进程所属的实际 cgroup 路径，连同上层一起读下面的文件。容器里可见的路径可能经过隔离，路径不明时由宿主机侧确认；不要拿另一容器或重建后的组代替。

核对操作审计时，`docker kill` 默认向容器主进程发送 SIGKILL；使用 `--signal` 可以改发其他信号。因此，记录要包含实际命令、目标容器和执行时刻，不能仅凭脚本里出现了 kill 这个词就确认误杀。

| cgroup v2 记录 | 用来回答什么 | 不能单独证明什么 |
|---|---|---|
| `memory.current`、`memory.peak` | 本组及后代当前占用、所记录期间的峰值；保留采样时间和峰值统计起点 | 退出后的小值不能还原退出前的峰值 |
| `memory.high`、`memory.max` | 回收节流边界与硬上限；同时读上层配置 | 本组没有设上限，不代表上层和整机无限 |
| `memory.events` / `memory.events.local` 的 `high`、`max`、`oom`、`oom_kill` 增量 | 分别看回收节流、触及硬边界、接近分配失败、进程被 OOM 终止 | `high` 增加不等于 OOM；`oom_kill` 增加不等于本组超限 |
| `memory.stat` | 区分匿名内存、文件缓存、内核等占用，决定往哪里追 | 不能把模型文件大小或几个进程占用简单相加，当成本组完整账单 |

`memory.events` 默认包含后代事件；`memory.events.local` 排除后代事件，**local 表示计数归属，不表示 OOM 起因一定在本组**。若挂载使用 `memory_localevents`，前者的统计范围也会改变，采集时要记录配置。上述计数和占用帮助缩小范围，最终仍与同一窗口的内核记录、操作事件对齐；缺日志时保留“原因未定”，不要靠单个数补出根因。

### 开销和什么时候别开

可扩展段需要管理虚拟地址与物理页映射，首次分配可能更慢；收益取决于实际分配形状和碎片情况。先保留 GLM 教程取值，再比较同一负载下的峰值与时延。若切到 sleep 场景，按 [sleep mode 的分配器约束](sleep-mode.md#怎么开)处理，不能直接沿用这条 export；当前双机部署没有启用 sleep。

将数据常驻设备减少后续传输，但占用设备容量；卸载释放常驻空间，用到数据时要支付传输与同步成本。评估时分别测主机峰值、每卡峰值和传输时间。加载日志 `Loading model weights took ... GB` 在固定实现里用字节数除以 2³⁰，数值实际按 GiB 表示；不能拿日志标签的 GB 与十进制硬件规格直接相减。线上压测与稳态服务应保持默认 `INFO` 日志级别：开启 `VLLM_LOGGING_LEVEL=DEBUG` 会让 `worker.py` 在每步 `execute_model()` 中读取 `memory_reserved()` / `memory_allocated()` 并写日志（`c09d3e20#L762-L778`、`8d6180e2#L882-L902`）[C64]，造成额外的热路径 Host 开销。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；GLM 双机绑定算例另钉 `db701c1f` + `0fc695fc`。容器主机内存部分依据 Linux 6.12 cgroup v2 及 Docker / Kubernetes 官方文档，与下表框架版本核对范围相互独立；主机注册和 MemFabric 支持范围由 CANN、驱动与硬件决定。

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `CacheConfig.gpu_memory_utilization` | 默认 `0.92`（GLM 教程显式覆盖为 `0.85`）；启动按总容量算额并校验空闲量 | 默认 `0.92`；规则相同 | 默认 `0.92`（`cache.py#L103-L105`）；启动快照校验见 `worker.py#L464-L474` | 字段改为 `float \| None = None`（默认可扩展 KV 缓存下解析为 `1.0`，否则 `0.92`），新增 `device_memory_utilization` 别名（`cache.py#L216-L237`） |
| 平台 `get_device_total_memory()` | 抛 `NotImplementedError`（防过早初始化 NPU） | 同左 | 守卫式查询：未初始化 `torch.npu` 时抛 `NotImplementedError`，已初始化后调 `torch.npu.mem_get_info`（`platform.py#L231-L244`） | 延续守卫式查询（`platform.py#L259-L265`） |
| `PYTORCH_NPU_ALLOC_CONF` 注入与 RL 清理 | 有 `model_config` 且未开 sleep 时条件注入/追加 `expandable_segments:True`（避开冲突键） | 同左 | 抽为 `_set_pytorch_npu_alloc_env`（`platform.py#L1445-L1464`）；`rl_config.enabled` 时在 `ascend_config.py#L377-L386` 主动移除 `expandable_segments`；单独 `enable_sleep_mode` 只阻止注入不删已有项 | 规则延续（`platform.py#L1743-L1752`） |
| 显式 `kv_cache_memory_bytes` 预算分支 | 先试跑，再直接采用指定字节数 | 先试跑，再经 sparse KV offload 约束调整 | 先试跑并跳过自动公式，再依次经 KV offload 与 `_apply_kvpp_memory_budget` 调整（`worker.py#L558-L598`） | 同上，额外先经 `_scale_kv_cache_memory_for_multi_group` 多组修正（`worker.py#L684-L707`） |
| UVA 主机锁页内存映射 | 无 Ascend V2 UVA 补丁 | 无该补丁 | `patch/worker/patch_v2/patch_uva.py#L29-L55`：`is_uva_available()` 校验 `pinned_mem_register:True` 与 `triton-ascend` 不在 `3.2.1`/`3.2.2` | 迁至 `patch/worker/patch_uva.py#L32-L58`，判据一致 |
| 两条内存报错、权重日志单位与录图顺序 | 均有；权重日志按 $2^{30}$ 报 GiB；分配 KV 后条件录图 | 同左 | 同左（`model_runner_v1.py#L4476` 报 GiB） | Worker 校验与录图顺序延续；主 runner 迁移至 V2 路径 |

`PYTORCH_NPU_ALLOC_CONF` 由 `torch_npu` 消费而非 vLLM 注册项，本文底层默认与冲突检查固定在 `torch_npu 8751b36d`（`2.10.0.post2`）。[平台契约](vllm-platform-interface.md)约定引擎查询设备能力的时机；固定部署 `db701c1f` 与 `v0.23.0` 一样禁止提前查询总显存，Worker 初始化后再按运行时快照核算。

### 源码位置

- `aclrtGetMemInfo` 返回设备空闲与总字节（不支持 HBM 时转查 DDR）[S1]；`aclrtHostRegister` 映射主机地址给设备访问（非权重复制）[S2]；MemFabric 跨机内存映射实践见 [S3]。
- Linux cgroup v2 接口与层级计数规则、Docker 资源约束/退出码 137/`docker kill` 信号以及 Kubernetes request/limit 与终止取证见 [S29][S30][S31][S32][S33][S34]。
- `BaseModelLoader.load_model`、权重切片与 W8A8 后处理布局支撑首图主机→设备复制方向 [C4][C5][C7]；`NPUModelRunner.load_model` 与 Worker 空闲检查、试跑、非 Torch 净增量扣减（`non_torch_increase`）、显式预算、录图后 `150 MiB` 建议值及 `DEBUG` 热路径分配器读数见 `vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L464-L474`、`#L558-L635`、`#L762-L778`、`#L905-L950` 及 `vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L555-L565`、`#L684-L707`、`#L882-L902` [C8][C10][C51][C52][C63][C65]。
- `Ascend 910B3` 真机 `60.96 GiB` OS 可见总显存基数（与标称 `64.00 GiB` 相差 `3.04 GiB` 底层预留）、`TP=1` 至 `TP=8` / MoE 的 `non_torch` 跳变（`0.03 → 0.43 ~ 0.55 GiB`）及 `DEBUG` 热路径 `TTFT` 对照见来源 61–62 [M61][M62]。
- `CacheConfig.gpu_memory_utilization` 与 `kv_cache_memory_bytes` 四版入口见来源 16–18 及 46–48（`ced6857a` / `ba15685a`）[C46][C48]；平台总显存查询与 `PYTORCH_NPU_ALLOC_CONF` 条件注入及 RL 清理见来源 12–15、35–38、49–50、55–57 [C49][C50]；UVA 判定见 `vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_v2/patch_uva.py#L29-L55` 与 `vllm-ascend@8d6180e2:vllm_ascend/patch/worker/patch_uva.py#L32-L58` [C54][C60]；`torch_npu` 分配器解析与互斥检查固定在来源 39–41。
- 数字引用[双机部署](glm-5-3-flash-two-node.md)的权重与 KV 账：20.58／20.81 GiB 是两个固定量化版本的主要语言权重子账；64 GiB、3.4 GiB 和 21 GiB 权重预算是教学假设，3,855／3,908 是假设下的块数，不是启动实测。[D][A]

**待核：** `Ascend 910B3`（`v0.30.0`）单卡与八卡的 OS 可见容量、`non_torch` 与录图对账已由实测快照固化，其中 `3.04 GiB` 底层预留在驱动、固件与页表间的子项占比无独立运行时计数器。对历史 GLM 双机绑定算例，两份固定量化描述已取得（版本差异见部署页），其运行时总字节、主机峰值、每卡加载与试跑峰值、图捕获峰值及 H2D 耗时仍需该部署现场日志与测量，静态字节账不能直接换算时延；双机部署的确切机型及配套 HBM、主机到设备链路带宽尚未确认，具体规格应与[硬件页](hardware-devices.md#官方带宽规格能说明什么)的型号对应，Atlas 800T A2 白皮书中的数字不能直接套到未确认机型。两份官方接口文档分别适用 CANN 9.0.0-beta.1 和 9.1.0，不构成一个已经验证的软件组合；MemFabric 现行支持仍需按部署版本核对。
