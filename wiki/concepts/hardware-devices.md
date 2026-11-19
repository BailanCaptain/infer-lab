---
id: hardware-devices
title: 昇腾四族硬件体系：NPU、板卡、服务器与超节点
type: concept
origin: gap
summary: >-
  分清昇腾 NPU 裸片、加速板卡、服务器与超节点机柜四级物理结构及运行时逻辑 Device 边界，掌握 v0.30.0
  四族硬件能力档案（A2/A3/310P/A5）、主机内存与设备显存分账以及机内 HCCS/UB 与跨机 RoCE 带宽差距。
aliases:
  - NPU
  - 昇腾芯片
  - device
  - 卡
  - 单卡
  - 加速卡
  - 机器
  - 节点
  - 服务器
  - 单机
  - Atlas A2
  - Atlas A3
  - 超节点
  - SuperPoD
  - Atlas 900 A3 SuperPoD
  - 内存池化
  - MemFabric
  - MemCache
chapters:
  - '04'
order: 100
sources:
  - 'https://www.hiascend.com/developer/techArticles/20240914-1'
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - 'https://www.hiascend.com/developer/techArticles/20251203-5'
  - >-
    https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2
  - 'https://e.huawei.com/cn/products/computing/ascend/atlas-800t-a2'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/supported_hardware.inc.md#L1-L6'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-a3.inc.md#L26-L55'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L18'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/support_matrix/supported_models.md#L40-L69'
  - >-
    raw:sha256-9a71c5e275ab2ca3591da54fcaba5bb8a352680d097760b4adf5f7e8a6d65d13.md#L1-L366
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware.py#L16-L76'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_config.py#L23-L77'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L42-L249'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L284-L401'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L89-L99'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L171-L173'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/cpu_binding.py#L736-L744'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L145-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L391-L525'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L578-L610'
  - 'vllm@ced6857a:vllm/distributed/parallel_state.py#L1772-L2240'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L824-L872'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L281'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L786-L834'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L280'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L272-L509'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L260-L273'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L395-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1535-L1875'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: roofline-and-metrics
    kind: builds-on
    note: 承接算力屋顶与显存带宽斜坡，将抽象的 π_peak 与 β_HBM 落到昇腾四族芯片、板卡与互联链路上
  - to: hf-model-anatomy
    kind: builds-on
    note: 复用 Qwen3-8B 与 Qwen3-30B-A3B 的总参数、激活参数与精度口径，核算各族硬件的选卡边界
contradicts: []
updated: '2026-11-18'
rawSources:
  - >-
    raw/sha256-4ad0a826ee278a8aae4b53a6b9dd14ca60685672bead700eda86212d11dd24a5.md
  - >-
    raw/sha256-9a71c5e275ab2ca3591da54fcaba5bb8a352680d097760b4adf5f7e8a6d65d13.md
---

**NPU（神经网络处理器）是执行并行张量运算的计算裸片；加速板卡承载裸片、片旁显存与供电电路，服务器把主机 CPU、主机内存与多块加速模组收进同一机箱，机柜与超节点再把多台服务器和交换网络组织成集群。** 推理框架在代码里真正操作的并不是“物理板卡”，而是操作系统与昇腾运行时暴露出来的逻辑 **Device（可见设备）**——只有先认清这四级物理层级与软件 `Device` 的对应关系，[容器挂载与起服务清单](ascend-env-and-serve.md)里的 `/dev/davinci*` 映射、[Roofline 模型](roofline-and-metrics.md)里的带宽瓶颈以及多卡并行的通信代价才算得清账。

## 一张“卡”、一颗裸片与一台服务器有什么区别？

推理服务把输入文字切成离散整数编号 **token**，查表转成向量，再排成按行列组织的**矩阵**交给 NPU 计算。在硬件现场，“卡”“芯片”“设备”“节点”四个词经常被混着叫，但它们在物理装配和软件寻址上分属不同层级：

```wiki-diagram
file: hardware-plate-cutaway
```

顺着上面的立体拆解剖面，可以把**物理空间装配**与**软件绑定路径**上的三个关键边界一一对上（芯片内部的计算核分工继续看 [AI Core](ai-core.md)）：

1. **物理板卡不一定只含 1 个逻辑 `Device`**：在 **Atlas A2** 单芯板卡上，1 张物理卡搭载 1 颗计算裸片（Die）与配套显存，对应 1 个 `/dev/davinciX` 逻辑设备；而在 **Atlas A3** 双裸片（dual-Die）板卡上，1 张物理卡封装了 **2 颗片间高速互联的计算裸片**，系统会暴露出成对的 2 个逻辑设备（如 `/dev/davinci0` 与 `/dev/davinci1`），单台 8 物理模组服务器在软件眼里就是 **16 个逻辑 NPU（`davinci0..15`）**。
2. **程序按 `ASCEND_RT_VISIBLE_DEVICES` 认领逻辑编号**：宿主机可能有 8 个或 16 个 `/dev/davinci*`，但进程通过环境变量 `ASCEND_RT_VISIBLE_DEVICES=2,3` 过滤后，只会看见重映射为本地 `0, 1` 的两个逻辑 `Device`，并在选定设备后才分配显存、提交算子。
3. **机内总线与跨机网络差出一个数量级**：单台服务器内各 NPU 模组通过 **HCCS** 或 **Unified Bus（UB）** 高速直连，主机 CPU 则经 **PCIe** 向设备传输控制与输入数据；一旦跨出单台服务器进入机柜交换层，普通集群就必须改走速率低得多的 **RoCE**（以太网承载远程直接内存访问）网络接口。

## v0.30.0 四族昇腾硬件：从 SoC 识别到 HardwareProfile

在 `vllm-ascend@c09d3e20`（`v0.30.0`）主基线中，业务代码不再到处散落按芯片名字硬编码的 `if` 分支，而是由 `vllm_ascend/device/` 包统一收敛为**四大家族语义能力档案（`HardwareProfile`）**。它的识别与路由分两步闭环：

- **编译期与运行期双校验锁卡**：构建阶段通过 `SOC_VERSION`（写入 `_build_info`）映射出编译期 `AscendDeviceType`（`A2`、`A3`、`_310P`、`A5`）；Worker 启动时调用 `check_ascend_device_type()`，读取 `torch_npu.npu.get_soc_version()` 返回的运行期整数码（`220..225` 为 `A2`、`250..256` 为 `A3`、`200..205` 为 `_310P`、`260` 为 `A5`），一旦预编译包与现场硅片家族不符立即抛出 `RuntimeError`（标准 `pip install vllm-ascend` 默认 wheel 仅面向 `A2`）。
- **语义契约驱动执行路径**：`get_current_hardware_profile()` 为当前家族绑定不可变的 `HardwareProfile`——用 `*Family`、`*Mode`、`*Policy` 选择注意力/量化后端、绑核与 MoE 通信策略，再用 `profile.supports(HardwareCapability.X)` 查询细粒度算子与图编译契约：

```wiki-diagram
file: hardware-fig-four-families
```

把全站标尺模型 **`Qwen3-8B`**（稠密 GQA，`8.19B` 总参数）与 **`Qwen3-30B-A3B`**（稀疏 MoE，`30.53B` 总参数、每词激活 `3.35B` 参数，详见[模型目录与配置拆解](hf-model-anatomy.md)）放到四族硬件上选卡时，静态权重显存下界按**总参数量**（MoE 未选中专家同样常驻显存）与每参数字节数 $b_{\text{elem}}$ 折算为二进制 `GiB`（$1\text{ GiB} = 2^{30}\text{ B}$）：

$$W_{\text{GiB}} = \frac{N_{\text{params}} \times b_{\text{elem}}}{2^{30}}, \qquad W_{\text{Qwen3-8B, BF16}} \approx 15.26\text{ GiB}, \qquad W_{\text{Qwen3-30B-A3B, BF16}} \approx 56.87\text{ GiB}$$

结合 `v0.30.0` 官方支持矩阵与快速开始食谱，两个模型在四族硬件上的精度约束与推荐部署形态对照如下：

| 硬件家族（`AscendDeviceType`） | 代表产品型号 | `Qwen3-8B`（`8.19B` 稠密）部署形态 | `Qwen3-30B-A3B`（`30.53B` MoE）部署形态 | 关键硬件与软件契约边界 |
| --- | --- | --- | --- | --- |
| **Atlas A2**（`A2`） | `Atlas 800T/I A2`、`900 A2 PoD`、`300T A2`（典型 `64 GB/卡`） | 单卡 `TP1` 直接跑 `BF16`（权重约 `15.26 GiB`）或 `W8A8` | `BF16` 权重达 `56.87 GiB`，单卡扣预算后装不下足够 KV，推荐 `2~4` 卡（如 `TP2` 每卡约 `28.44 GiB`）或 `W8A8` | 标准 `NPUWorker`；原生分块 `FP8` 权重加载时回退反量化为 `BF16` |
| **Atlas A3**（`A3`） | `Atlas 800T/I A3`、`900/9000 A3 SuperPoD`（每逻辑核 `64 GB`） | 单逻辑设备即可放下，但容器挂载须成对挂 `davinci0,1` | 官方推荐 `1~2` 张物理卡（1 张双裸片物理卡即提供 `2` 个 `64 GB` 逻辑设备跑 `TP2`） | `DUAL_CHIP_CARD` 按 `card_id = npu // 2`、`chip_id = npu % 2` 寻址；支持 `CANN_MEGAMOE` |
| **Atlas 300I DUO**（`_310P`） | `Atlas 300I DUO`、`Atlas 200I Pro` | **不支持 `BF16`**；单芯 `TP1` 跑专用 `Qwen3-8B-W8A8SC`（或小模型 `FP16`）并显式传 `--dtype float16` | **不支持 `BF16`**；采用 `Qwen3-30B-A3B-w8a8-QuaRot-310` 量化权重跑 `TP2` 并显式传 `--dtype float16`（上限 `16k` 上下文） | 走 `NPUWorker310` 与 `FORCE_NZ`；无 `NPUGRAPH_EX`（自动禁用 `npugraph_ex`、`static/super_kernel`），禁装 `triton` |
| **昇腾 950PR / 950DT**（`A5`） | `950DT`、`950PR`（`96 / 112 / 128 / 144 GB` 档位） | 单设备轻松跑 `BF16` 或原生 `FP8 / MXFP8` | `96 GB / 144 GB` 大显存档可单卡容纳，或启用硬件原生 `MXFP8` 压缩至约一半字节 | `FP8_OPTIMIZED` 适配族；支持 L0C→UB **CV 融合**、原生 `FP8/MXFP8/MXFP4` 与 **Unified Bus** 高速互联（见[昇腾 950 架构](ascend-950-architecture.md)） |

## 主机内存和设备显存分别记什么账？

**CPU 上的进程数、主机内存（Host DRAM）容量与 NPU 的设备显存（HBM）预算是三本彼此独立的账。** 每个负责模型计算的 **Worker** 进程绑定一个逻辑 `Device`，此外主机上还运行着 API 前端、协调器、引擎核心以及容器监控父进程。主机内存保存原始文本、分词结果、请求调度队列以及从磁盘读取 `.safetensors` 时的加载中转缓冲；设备侧的 **HBM**（高带宽显存）则保存本卡分到的模型权重、**KV cache**（供后续 token 复用的历史键值状态，混合注意力模型还包含各自的线性或稀疏状态）、前向临时激活张量、集合通信缓冲与图捕获内存池。两本内存账的完整拆解见[设备内存](device-memory.md)。

这里有两条极易踩坑的硬件记账铁律：

1. **主机内存与邻卡显存不能自动拼成一个免费地址池**：主机 DRAM 再大，输入张量也必须经过 PCIe 拷入目标设备显存才能参与本次计算；启动阶段引擎先绑定设备并加载本卡权重，跑一次 `profile_run()` 实测非缓存峰值，再把 `gpu_memory_utilization` 预算内的剩余本卡显存切给状态块池（完整 7 级冷启动账见 [Worker 生命周期](npu-worker-lifecycle.md)与 [KV Cache 显存划定](kv-cache-memory-profiling.md)）。
2. **严格区分标称十进制 `GB`、教学二进制 `GiB` 与运行时可见总量**：硬件白皮书与产品页标的 `64 GB` 采用十进制（$64 \times 10^9\text{ B} \approx 59.60\text{ GiB}$），而部分教学预算算例会显式设定为 `64 GiB` 整（现场实测与教学设定必须分开记录）。更关键的是，操作系统与昇腾驱动会扣留一部分片上系统预留内存，运行时在完成设备初始化后调用 CANN `aclrtGetMemInfo` 或 `torch.npu.mem_get_info(device_id)` 查到的总量**已经扣除系统预留**，不能拿宣传册标称值硬减权重来猜剩余空间。

## 为什么多几张卡还会多出等待：机内 HCCS/UB 与跨机 RoCE

**把模型切给更多设备能分摊单卡显存和算力压力，但也会让部分中间结果必须跨过物理链路同步后才能继续下一步。** 在昇腾集群里，软件分工与底层硬件通过四层关系逐级落位：

| 层级 | 它回答什么问题 | 上下层怎样衔接 |
| --- | --- | --- |
| 裸片、板卡、服务器、机柜 | 硅片、显存与网口物理装在哪里 | 硬件包含关系；双裸片或直出网口形态按具体产品手册核对 |
| 逻辑 `Device` | 进程在哪分配显存、向谁提交算子 | 运行时枚举后经 `ASCEND_RT_VISIBLE_DEVICES` 过滤重编号 |
| `rank` 与通信组 | 哪些分布式工作进程按约定协同 | 本地设备号加节点偏移组成全局 `rank`，由 **HCCL** 建组 |
| `TP`、`EP`、`DP`、`PP` | 模型矩阵、专家与请求怎样切分 | **TP** 切同层矩阵、**EP** 分散完整专家，结果靠物理链路收发 |

理解多卡等待，核心是分清三类硬件互联与一层通信软件（集合通信原语与通信库分层详见[集合通信原语](collective-communication.md)与 [CANN 与 HCCL](cann-hccl.md)）：

- **HCCS 与 Unified Bus（UB）**：昇腾处理器之间的机内（及超节点内）高速直连协议（注意区分互联协议 **Unified Bus** 与 [AI Core](ai-core.md) 核内向量缓冲 **Unified Buffer**，二者常同缩写为 `UB`）。**TP（张量并行）**在每一层的注意力输出投影与前馈降维投影后都要做逐元素求和的 **All-Reduce**，通信极其频繁，因此优先锁在单机 `HCCS / UB` 高速域内。
- **RoCE**：在以太网上承载远程直接内存访问（RDMA）的跨机协议。在 Atlas 800T A2 等机型上，RoCE 网络接口可以由 **NPU 直接引出**，并非一律经过独立 PCIe 网卡。
- **HCCL**：昇腾集合通信软件库，负责编排哪些 `rank` 一起交换张量，底层自动调用机内 `HCCS / UB` 或跨机 `RoCE` 通道。

### 官方带宽规格能说明什么？

**官方规格峰值只刻画硬件链路的理论上限，真实推理通信耗时还受消息字节数、集合算法、网络拥塞与同步屏障共同决定。** 为给机内与跨机链路提供可核查的量级参照，下面引用 **华为《Atlas 800T A2 训练服务器 技术白皮书》（第 16 版）**与官方产品页规格（注：该白皮书明确对应 **800T A2 训练服务器**，用作同代系可追溯参照，不能直接等同于其他子型号或推理现场实测值）：

| 互联对象 | 官方标称理论峰值 | 统计口径与换算说明 | 推理部署切分启示 |
| --- | --- | --- | --- |
| **机内 HCCS** | **392 GB/s** | 每路 AI 处理器的 **7 条 HCCS 链路聚合值**，8 路处理器组成两两直连的 Full Mesh（白皮书表 5-2 未标明单向/双向口径，不可当成任意两卡间单条链路速率） | 承接每层反复同步的 `TP All-Reduce` 或高带宽机内 `EP` |
| **跨机 RoCE 端口** | **200 Gbit/s / 端口**（整机提供 **8 个 200GE QSFP 口**） | 单网络接口线速（小写 `b` 为 bit，大写 `B` 为 Byte）；NPU 可直出网口，未扣除以太网与 RDMA 协议头开销 | 带宽比机内聚合低一个数量级，适合放 `DP`、`PP` 或跨机 `EP` 激活派发，忌跨机切细粒度 `TP` |

把单个 `200 Gbit/s` RoCE 端口的位速率按十进制换算为字节速率（示意换算，不代表应用层有效吞吐）：

$$\text{Rate}_{\text{RoCE, port}} = \frac{200\text{ Gbit/s}}{8\text{ bit/B}} = 25\text{ GB/s}$$

即便不扣协议损耗，单口 `25 GB/s` 与机内多链聚合 `392 GB/s` 的悬殊差距也直接解释了跨机并行的分工逻辑——以 `09 旗舰异构模型全案` 的历史归档算例（例外 B：`vllm@0fc695fc + vllm-ascend@db701c1f`，双机 `2 × Atlas 800 A2` 共 16 卡、`TP8 / DP2 / EP16`）为例：每台机器本地看见设备 `0..7`（全局 `rank` 分别为 `0..7` 与 `8..15`；启动期 A0 核心功能角色示意共 `20` 个，含 16 个每卡 Worker 与前端/协调/引擎角色，详见[双机部署启动与权重子账](glm-5-3-flash-two-node.md#启动时发生了什么)），所列语言权重子账约 `20.58 GiB/卡`（视觉塔、MTP 与量化辅助张量另计）。在关闭序列并行 `SP`、共享专家按 `TP` 切分的前提下，主干 45 层（前 3 层稠密前馈 + 后 42 层 MoE）每层 2 次加词嵌入后 1 次、整趟共 **91 次 `All-Reduce`** 全部留在各自机器内部走 `HCCS`（详见 [TP 通信账](tensor-parallel.md#从一层走到整次前向r1-的通信账)与 [EP](expert-parallel.md)）；只有进入 42 个 MoE 层寻找落在另一台机器上的路由专家时，才经 `RoCE` 跨机发送本次 token 的激活向量并收回计算结果，专家权重始终常驻持有卡——因此机器 1 即使当前没有收到本地客户端请求，也会协助处理机器 0 上[示例请求 R1 的跨机专家计算](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。而在 `v0.30.0` 新版食谱中，同一模型放到单台 16 逻辑设备的 **Atlas A3** 或 8 卡 `96 GB` 的 **950DT**（`MXFP8`）上时，单节点即可装下全部专家，从而省去跨机 RoCE 跳数。

## 超节点与内存池化会改变这些边界吗？

**超节点（SuperPoD）通过更大规模的高速互联把多框计算资源织成紧耦合池，但软件仍须显式管理张量分片、状态归属与远端访问开销。** 像 `Atlas 900 A3 SuperPoD` 与 `Atlas 9000 A3 SuperPoD` 这类超节点，物理拓扑和带宽远强于普通双机 RoCE；但在记录线上环境时，不能只写一句笼统的“Atlas A2 / A3”，必须写清完整产品型号、软件可见 `Device` 数与每设备实测可用显存。

在官方 Atlas A3 内存池化实践中，软件栈在高速互联之上分出两层新边界：**MemFabric** 提供跨节点、跨介质（HBM 与主机 DRAM）的统一编址与内存访问语义；**MemCache** 则在 `MemFabric` 之上封装按键存取（`Put / Get`）的对象缓存接口，用来承载跨实例可复用的历史 KV 状态池（它解决的是按键存取缓存对象，与 `HCCL` 按通信组执行集合张量运算分属两层）。即便有了统一编址，当机器 A 想复用保存在机器 B 上的历史状态时，依然要走完四步物理代价：**① 查找键值身份与物理位置 → ② 校验前缀与块布局能否复用 → ③ 跨链路读取或传输数据 → ④ 恢复成机器 A 当前算子可消费的显存块布局**。哪些前缀可复用见 [prefix caching](prefix-caching.md)，外部缓存池如何接入引擎见 [KV Pool](kv-pool.md)；昇腾 950 的 `PR / DT` 规格与任务互联细节则分别见[昇腾 950 架构](ascend-950-architecture.md)与[950 调度与互联](ascend-950-execution-interconnect.md)。

## 常见误解

把昇腾四族硬件、显存账本与互联规格放在一起核对，最容易踩中的五类直觉误区总结如下：

```wiki-diagram
file: hardware-fig-myths
```

结合上图，现场排障时尤其要守住两条纪律：**第一，“卡”是口语简称，`Device` 才是软件分配显存和提交算子的最小边界**——在 Atlas A3 双裸片服务器上，单张物理卡对应两个逻辑 `Device`，漏挂配对节点会破坏拓扑；**第二，不要拿单向/聚合带宽峰值或两台 DP 机器的总内存去推算单请求表现**——多链路聚合、单端口线速和应用有效吞吐分属三层，且在开启跨机 `EP` 的部署中，两台 DP 机器合起来才持有一份完整的路由专家集合。

## 对照源码

### 怎么开

启动前按目标卡型选择对应镜像并配置设备可见性与网络接口（单机挂载细节见[容器与起服务清单](ascend-env-and-serve.md)，双机网络示例见[双机部署怎么开](glm-5-3-flash-two-node.md#怎么开)）：

- **设备选择与拓扑约束**：`ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5,6,7` 限定当前进程可见设备并将其按顺序重映射为本地 `0..N-1`；Atlas A3 容器至少成对挂载 `/dev/davinci0` 与 `/dev/davinci1`；Atlas 300I DUO（`310P`）即使加载 `310P` 专用量化权重（如 `W8A8SC` / `QuaRot-310`）也须显式传 `--dtype float16`，并配合 `FULL_DECODE_ONLY`、关闭 `enable_npugraph_ex`。跨机通信按现场网卡填写 `HCCL_IF_IP` 与 `HCCL_SOCKET_IFNAME`。
- **运行时与框架初始化链**：CANN 层通过 `aclrtGetDeviceCount()` 枚举可见设备数，选定 `Device` 后用 `aclrtGetMemInfo` 查询已扣除系统预留的设备内存。在 `vllm-ascend` 中，`NPUPlatform` 声明 `device_type = "npu"`、可见变量与 `get_device_name()`（平台契约详见 [NPUPlatform](npu-platform.md)）；随后 `NPUWorker.init_device()` 调用 `_init_device()` 完成 DP 本地偏移、`torch.npu.set_device()` 绑定、空闲显存快照校验与 HCCL 分布式建组，再创建 `ModelRunner`（完整冷启动时序见 [Worker 生命周期](npu-worker-lifecycle.md)）：

```wiki-diagram
file: hardware-device-startup
```

### 会报什么错

- **`Current device type: ... does not match the installed version's device type`（`RuntimeError`）**：`NPUWorker.__init__` 调用 `check_ascend_device_type()` 发现运行期 `get_soc_version()` 与当前安装包编译期家族不一致（如拿默认 `A2` wheel 在 `A3 / 310P / 950` 上运行），须切换对应硬件后缀镜像或按 `SOC_VERSION` 重装。
- **`DP adjusted local rank ... is out of bounds for ... devices`**：DP 本地偏移后的 `local_rank` 超出当前 `torch.npu.device_count()`，先核对容器挂载的 `/dev/davinci*`、`ASCEND_RT_VISIBLE_DEVICES` 与本机 DP/TP 乘积。
- **`Free memory on device ... is less than desired GPU memory utilization`**：`_init_device()` 中 `MemorySnapshot` 检测到启动空闲显存低于 `total_memory * gpu_memory_utilization`。注意即使显式指定 `kv_cache_memory_bytes` 跳过自动内存测量计算，源码仍会调用 `profile_run()` 触发模型编译，且不会绕过更早执行的 `_init_device()` 启动空闲显存检查。
- **跨机分布式初始化卡住**：能枚举本机设备只证明本地运行时就绪；卡在建组时须逐端核对两端 `HCCL_IF_IP`、`HCCL_SOCKET_IFNAME`、防火墙端口、全局 `rank` 与总 `world_size`。

### 开销和什么时候别开

多卡并行能分摊静态权重与激活开销，但每扩一档都会增加集合同步、通信缓冲和跨机传输成本；高频逐层同步的 `TP` 应留在机内 `HCCS / UB` 域，跨机网络优先承载 `DP`、`PP` 或专家容量受限时的 `EP`。`MemFabric / MemCache` 仅在确有跨节点历史状态复用需求、软硬件配套齐备且缓存命中收益足以覆盖远端传输与布局恢复开销时引入。

### 版本差异

硬件物理规格不随框架分支改变，跨版本演进集中在**硬件家族抽象方式**与**平台总显存查询守卫**两处（历史 GLM 双机算例固定在 `db701c1f`，不套用新分支实现）：

| 核对维度 | `v0.23.0` (`2c59ff10`) | `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 平台身份与可见变量 | `device_type = "npu"`，`ASCEND_RT_VISIBLE_DEVICES` | 同左 | 同左 | 同左 |
| 四族识别与能力分流 | `utils.py` 内置 `AscendDeviceType` 与 `assert` 校验（`A3` 运行码 `250..255`），业务侧散落判断 [C25] | 同 `v0.23.0`（位于 `utils.py:786–834`）[C27] | 拆出 `vllm_ascend/device/` 三模块：`hardware.py`（`A3` 扩至 `250..256`）[C13]、`device_config.py`（改抛 `RuntimeError`）[C14] 与不可变 `HardwareProfile` 语义契约 [C15][C16] | 沿用三模块 `HardwareProfile` 架构并继续扩充新算子与缓存能力契约 [C29] |
| `get_device_total_memory(0)` | 默认参数 `device_id=0`（非卡数），直接抛 `NotImplementedError` 防过早初始化 | 同左 | 未初始化 `torch.npu` 时仍抛异常；已初始化后调 `mem_get_info(device_id)` 返回总量 [C19] | 同 `v0.30.0`（位于 `platform.py:260–273`） |

### 源码位置

**来源索引（编号对应 frontmatter `sources`）**

- 主机、NPU 与 CANN 软件栈分工：昇腾官方 CANN 架构说明 [S1]；设备枚举 `aclrtGetDeviceCount` 与 HCCL 参与者文档 [S2]；选卡后 `aclrtGetMemInfo` 查询及系统预留边界 [S3]。
- Atlas A3 内存池化 `MemFabric / MemCache` 分层实践：昇腾官方技术文章 [S4]。
- **HCCS 与 RoCE 官方峰值出处**：华为《Atlas 800T A2 训练服务器 技术白皮书》第 16 版（2026-05-12）§5.1 表 5-1/5-2（印刷页 36–37、PDF 第 45–46 页：每处理器 `64 GB`、7 条 HCCS 最大理论带宽 `392 GB/s`、200GE RoCE）[S5]；Atlas 800T A2 产品页网络规格（整机 8 个 200GE QSFP 口）[S6]；`Qwen3` 静态权重 `GiB` 与 `25 GB/s` 端口字节速率由参数量及十进制位宽公式推导 [D]。
- `v0.30.0` 四大家族支持列表 [S8]、Atlas A3 双裸片成对挂载 `/dev/davinci0,1` 要求 [S9]、`310P` 必传 `--dtype float16` 与禁 `enable_npugraph_ex` 快速开始 [S10] 及 `Qwen3-Dense / Qwen3-30B-A3B` 支持矩阵 [S11]。
- `v0.30.0` 核心源码：`NPUPlatform` 声明与 `get_device_name` [C17][C18]；`DUAL_CHIP_CARD` 按 `npu // 2` 寻址 [C20]；无 `NPUGRAPH_EX` 自动降级 `enable_npugraph_ex / static / super_kernel` [C21]；Worker 选卡、显存快照与 `kv_cache_memory_bytes` 下仍跑 `profile_run()` [C22][C23]；上游分布式与 TP/DP 建组 [C24]。
- 例外 B 历史双机归档对照：钉住双机教程 [S7]、历史镜像 Worker 选卡与量测及上游 TP/DP/EP 建组（`sources` 第 31、33 项）与 SP 共享专家 DP 条件 [C32]（`v0.23.0` / `v0.26.0rc` / `main` 总显存接口另见 `sources` 第 26、28、30 项，原始摘录留存 `rawSources`）。

**待核**

- 现场 Atlas 800 A2 机器的完整子型号、固件版本、运行时 `mem_get_info` 实测总量及系统预留差额（白皮书对应 800T A2 训练服务器，不能替代现场推理机型实测）。
- 白皮书表 5-2 未注明 `392 GB/s` 的单向/双向统计口径，且本库尚缺同口径机内 HCCS 与跨机 RoCE `All-Reduce` / `All-to-All` 实测有效带宽与时延曲线。
- 例外 B 历史教程概览曾写“`2 Atlas 800 A2 (64GB × 16)`”而双机操作节写每机暴露 `0..7` 共 8 卡，本库按操作节固定 `2×8`，原文差异留存[来源基线](../sources/glm-5-3-flash-baseline.md)。
- `MemFabric / MemCache` 官方文章测试基于其特定节点规模与块大小，本站未做超节点池化实测，接入前须按目标软件版本与硬件配套独立验收。
