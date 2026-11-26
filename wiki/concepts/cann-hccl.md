---
id: cann-hccl
title: CANN 与 HCCL：计算、通信和物理链路
type: concept
legacyAnchors:
  放到-glm-双机先建组再沿一个-token-看交接: 异构旗舰对照：GLM 双机跨节点通信域与调用统计
summary: >-
  CANN 提供昇腾计算软件能力，HCCL 负责组内集合通信；先沿单机 Qwen3-8B TP=2 的 All-Reduce
  走通框架请求、通信库与物理链路四层，再对照 GLM 双机跨节点通信域、218 次调用边界与 AI QoS 适用范围。
aliases:
  - CANN
  - 昇腾软件栈
  - HCCL
  - 集合通信库
  - Huawei Collective Communication Library
  - HCCS
  - RoCE
  - RDMA
  - HIXL LocalCommRes
  - LocalCommRes
  - hccn_tool
  - NNAL
  - ATB
  - TorchNPU
  - Triton Ascend
  - Gloo
  - torch_gloo
  - 通信域
  - ACL
  - AscendCL
  - Ascend Computing Language
chapters:
  - '07'
  - 09
  - 08
order: 130
sources:
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/index/index.html
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - >-
    vllm@0fc695fc:vllm/distributed/device_communicators/base_device_communicator.py#L180-L207
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/device_communicators/npu_communicator.py#L40-L68
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L5-L21
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L326-L338'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L359-L422'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L452-L474'
  - 'vllm-ascend@db701c1f:tools/ai_qos.py#L270-L311'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L989-L1002'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1088-L1101'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1210-L1223'
  - 'vllm-ascend@2c59ff10:tools/ai_qos.py#L270-L474'
  - 'vllm-ascend@2ed6cbba:tools/ai_qos.py#L270-L474'
  - 'vllm-ascend@baa023ad:tools/ai_qos.py#L270-L468'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1749-L1875'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L683-L707'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L82
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L25-L86
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L13-L35
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2186-L2192
  - >-
    vllm-ascend@baa023ad:docs/source/tutorials/features/pd_disaggregation_mooncake_multi_node.md#L219-L275
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L132-L181
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/memcache_backend.py#L150-L168
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L112-L119'
  - >-
    raw:sha256-50cc686229cc3c850b453bae6e3349228421cccf972150b556c818ffa9bffb98.md#L1-L1543
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ops/fused_moe/token_dispatcher.py#L113-L119
  - >-
    raw:sha256-721180441cece4ca6a89d5c53af39ad20682f9ec026bd42083855265adb374c3.md#L1-L1553
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L68
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L416-L464'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1264-L1279'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1733-L1772'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1918-L1941'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Ai_QoS_introduction_en.md#L75-L82
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1273-L1287'
  - 'vllm-ascend@7d825229:tools/ai_qos.py#L436-L449'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2196-L2196
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1239-L1239
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1734-L1734
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L63-L71
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L242
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302
  - >-
    https://www.hiascend.com/doc_center/source/en/canncommercial/850/commlib/hcclug/hcclug_000077.html
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/parallel_state.py#L62-L106'
  - 'vllm@ced6857a:vllm/distributed/parallel_state.py#L1954-L1974'
  - >-
    vllm-ascend@921ccc52:docs/source/getting_started/installation.md#L171-L292
  - 'vllm-ascend@2c59ff10:docs/source/installation.md#L501-L624'
  - 'vllm-ascend@2ed6cbba:docs/source/installation.md#L514-L615'
  - >-
    vllm-ascend@7d825229:docs/source/getting_started/installation.md#L158-L263
  - >-
    vllm-ascend@baa023ad:docs/source/getting_started/installation.md#L158-L263
  - >-
    vllm-ascend@921ccc52:docs/source/tutorials/models/GLM5.3-Flash.md#L427-L432
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation.md#L15-L165'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/prebuilt_image.inc.md#L1-L132'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/existing_cann_environment.inc.md#L1-L54'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/install_vllm_ascend.inc.md#L1-L205'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/base_environment.inc.md#L1-L50'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/cann_image/atlas-a3.inc.md#L1-L77'
  - 'vllm-ascend@921ccc52:docs/source/getting_started/installation/cann_image/atlas-950dt.inc.md#L1-L71'
  - 'vllm-ascend@2c59ff10:docs/source/installation.md#L1-L263'
  - 'vllm-ascend@2ed6cbba:docs/source/installation.md#L1-L300'
  - 'vllm-ascend@7d825229:docs/source/getting_started/installation.md#L15-L156'
  - 'vllm-ascend@baa023ad:docs/source/getting_started/installation.md#L15-L156'
  - 'vllm-ascend@7d825229:mkdocs.yml#L162-L187'
  - 'vllm-ascend@baa023ad:mkdocs.yml#L162-L187'
  - 'vllm-ascend@921ccc52:mkdocs.yml#L167-L193'
  - 'vllm-ascend@7d825229:docs/source/community/versioning_policy.md#L22-L92'
  - 'https://gitcode.com/cann/hixl/wiki/A5%20LocalCommRes%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md'
  - 'https://gitcode.com/cann/hixl/blob/dcf0027ffb4408446bb3ae5b810e44f20f19cc3c/scripts/tools/hixl_tool/readme.md#L1-L275'
  - 'https://gitcode.com/cann/hixl/blob/dcf0027ffb4408446bb3ae5b810e44f20f19cc3c/docs/zh/api/cpp/HIXL-interface.md#L487-L665'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1283-L1305'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1405-L1427'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/parallel_state.py#L63-L115'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/parallel_state.py#L63-L145'
  - 'vllm-ascend@c09d3e20:tools/ai_qos.py#L453-L473'
  - 'vllm-ascend@8d6180e2:tools/ai_qos.py#L453-L473'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L179-L185'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先认识参与计算的设备与机内 HCCS、跨机 RoCE 物理链路规格
  - to: device-memory
    kind: builds-on
    note: 通信输入张量与 HCCL 缓冲同驻设备显存，须分清张量载荷与通信库预留
  - to: ai-qos
    kind: builds-on
    note: 共享 UB 链路出口发生集合通信与 KV 搬运争用时，需借助虚拟通道与优先级调度
  - to: collective-communication
    kind: builds-on
    note: 先掌握 rank、通信组与 All-Reduce 等集合通信语义，再对照 CANN/HCCL 软件栈与链路实现
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-50cc686229cc3c850b453bae6e3349228421cccf972150b556c818ffa9bffb98.md
  - >-
    raw/sha256-721180441cece4ca6a89d5c53af39ad20682f9ec026bd42083855265adb374c3.md
  - >-
    raw/sha256-724a9fbb17afbd7ebde2c43aafdddc98e431fc1daa60c8b47825de3987f99fe8.md
---

## 一张卡上的通信请求，怎样到达另一张卡？

**CANN 是连接框架与昇腾设备的计算软件体系；HCCL 是其中负责组织多卡数据交换的通信库，物理链路承载实际传输。** CANN 提供算子（矩阵乘等具体运算）、运行时（通过 **ACL**，即 **AscendCL / Ascend Computing Language** 底层运行时接口安排设备执行、显存与流资源）和图执行等能力。vLLM 组织推理，vllm-ascend 把计算与通信接到昇腾的软件接口上。

下图只画两张卡，各自以一个 [rank](collective-communication.md#两张卡交换以后各自手里多了什么) 参加一次 [All-Reduce](collective-communication.md#all-reduce)(SUM)：做完后两张卡都拿到对应位置之和。

```wiki-diagram
file: cann-hccl
```

沿实线箭头向下看：框架交出张量、参与的组和求和要求，CANN 里的 HCCL 安排收发与归约，设备通过链路交换数据；虚线箭头表示结果就绪后交回各自的后续计算。两侧都要参加同一操作。图中软件框代表各端的职责，省略中间适配层和传输轮次；卡图标表示逻辑设备。HCCL 既支持同组共同参与的[集合通信](collective-communication.md#两张卡交换以后各自手里多了什么)，也支持指定两端之间的点对点收发，适用于单机和多机。

## 为什么本地算完，还要等通信？

**把计算分到多卡，也把一次计算需要的输入和结果分散了。** 例如矩阵按输入维切分（`RowParallelLinear`）后，每张卡只算出形状完整、数值不全的部分和，后面的归一化与残差相加必须等各卡贡献合齐。

用单机两卡的 **`Qwen3-8B`（`TP=2`，`BF16`）** 端到端走一遍一次 `All-Reduce` 的完整链路：

1. **框架层给出部分和与通信组**：本层 `RowParallelLinear`（注意力的 `o_proj` 或 MLP 的 `down_proj`）在每卡算出 `[T, 4096]` BF16 部分和，交给 `vllm` 的 TP 通信组（`device_group`）与 `torch.distributed`。
2. **HCCL 组织集合归约**：Worker 启动时已指定 `hccl` 后端；HCCL 接管这次 `All-Reduce(SUM)`，安排两张卡分片收发并逐元素相加。
3. **机内物理链路搬运字节**：同一台服务器内的两张卡通过机内高速互联（如 HCCS 或 Unified Bus）交换数据，归约完成后把完整 `[T, 4096]` 交回各自的后续算子。

在 `Qwen3-8B` 这类标准稠密模型里，每层有 `2` 处 `RowParallelLinear`——attention 输出投影后一次、SwiGLU MLP 降维后一次。整座 `36` 层主干一次前向固定触发 **`2 × 36 = 72` 次** `All-Reduce`（层外词表入口与 `lm_head` 出口另计）。计算只在需要远端结果的依赖处等待，并非每次调用都让无关进程做全局屏障；一次通信要付出发起、传输、归约及等待时间，还需要设备缓冲（见 [HCCL 缓冲](hccl-buffer.md)）。

先分清相邻的四层职责，才能判断该检查哪里：

| 层次 | 决定什么 | 单机 `Qwen3-8B TP=2` 对应项 |
|---|---|---|
| 并行计算 | 谁保存、计算哪一片 | [TP](tensor-parallel.md) 分矩阵（MoE 还可叠加 [EP](expert-parallel.md) 与 [DP](data-parallel.md)） |
| 通信操作 | 结束后每个参与者拿到什么 | `All-Reduce(SUM)` 合齐部分和（出口用 [All-Gather](collective-communication.md#all-gather) 拼词表） |
| 框架接口与通信库 | 怎样提交并组织这次操作 | `RowParallelLinear` → `vllm` 通信组 / `torch.distributed` → HCCL |
| 物理链路 | 字节沿什么连接搬运 | 机内 HCCS / Unified Bus（跨机部署另走 RoCE，主机侧走 PCIe） |

HCCS 是昇腾设备互联，RoCE 是基于以太网的远程内存访问通信，PCIe 连接主机与设备等部件，Unified Bus 是统一互联总线。具体可用路径取决于产品、拓扑与软件配套。All-Gather、All-to-All 等操作的输入输出与传输量统一见[通信基础](collective-communication.md)，网线或总线的名称无法决定应该拼接还是求和。在 `Ascend 910B3`（`CANN 9.1.0`）的独立 `TP=4` HCCS `All-Reduce` 微基准中，单次 `16 MiB` 归约实测聚合有效带宽为 `17.71 ~ 17.74 GB/s`、耗时约 `524 µs`（远低于 `392 GB/s` 标称端口峰值），完整链路数据见[通信基础 910B3 真机标尺](collective-communication.md#ascend-910b3-真机标尺tp4-hccs-all-reduce-微基准与理论峰值落差)与 [Ascend 910B3 实测基线](../sources/ascend-910b3-measured-baseline.md)。

放大到双机 16 卡部署时，机内高速总线与跨机网络构成两级物理通路——下图用双节点立体剖面直标机内 `HCCS`、跨机 `RoCE` 网口与中央交换机，并与逻辑上的 TP、DP、EP 通信域一一对应：

```wiki-diagram
file: cann-hccl-plate-two-node
```

对照源码追调用链时，须把“建组”与“选链路”分开看。在普通路径中，Worker 先选 `hccl` 后端，模型并行初始化沿用该后端创建各设备通信组，再把选定组交给设备通信器；普通 All-to-All 使用的就是它接收的 `device_group`。这条调用链只证明通信组归属，不能反推每次通信经过哪条物理链路；CPU 的 `gloo` 控制组与 MC2 等专用入口仍须分开核对。

## 数据精度和本地计算，怎样影响通信？

**计算决定要交接的张量，张量的数据类型决定每个元素占多少字节。** BF16 用 16 位表示浮点数，每元素 `2 B`；INT8 用 8 位整数，每元素 `1 B`。在单机 `Qwen3-8B` `TP=2`（`BF16`，`H = 4096`）上，每次 `All-Reduce` 交出 `[T, 4096]` BF16 部分和：decode 单个 token（`T = 1`）的逻辑载荷是 `4,096 × 2 B = 8 KiB`，`512` token prefill 则是 `4 MiB`。

开启 **W8A8** 量化（可量化层的权重与激活用 8 位整数计算，再用缩放参数恢复为 BF16）后，**并不意味着层间 hidden 一律按 INT8 传输**——通信字节数取决于实际交给通信算子的张量类型：

| 通信阶段 | 实际交给通信的张量类型 | 单元素／单副本逻辑载荷 |
|---|---|---|
| 标准 `BF16` TP 归约（如 `Qwen3-8B` `TP=2`） | BF16 部分和 | 每元素 **`2 B`**（`H=4096` 单 token `8 KiB`） |
| `W8A8` 量化模型 TP 归约（如 GLM `TP=8`） | 恢复后的 BF16 部分和 | 每元素 **`2 B`**（并未因 W8A8 减半） |
| `W8A8` **MoE** 派发 dispatch | 先量化再发：INT8 隐藏向量 + 每 token 一个 FP32 缩放系数 | `H × 1 B + 4 B`（`H=4096` 时 `4,100 B/副本`） |
| `W8A8` MoE 收回 combine | BF16 专家结果 | 每元素 **`2 B`** |

每类通信的字节账统一见[一次前向的通信账](one-request.md#一次前向的通信账)；量化细节见[量化](quantization.md)，矩阵如何产生部分和见[矩阵乘与权重](matmul-and-weights.md)。

除了数据类型，All-Reduce 还必须约定归约操作（SUM 求和，也可按接口选择乘积、最大值或最小值）。各参与者的类型、元素数、操作与调用次序必须按接口匹配；涉及拼接或不等长交换时，发送分片与接收分片的约定也要对应，通信库知道这些约定才能组织正确的结果。

## 装了 CANN，为什么还不能直接运行模型？

**驱动让系统使用设备，CANN 提供设备侧计算能力，框架和推理引擎再把模型接到这些能力上。** 容器主要封装用户空间的软件；宿主机仍要有与硬件匹配的驱动和固件，并把所用设备、驱动库和管理工具提供给容器。

从下往上检查：CANN Toolkit 提供运行和开发接口，Ops 是针对硬件的算子包；NNAL 是神经网络加速库，提供 ATB（Ascend Transformer Boost，昇腾大模型算子加速库）等张量运算加速能力。再往上，PyTorch 处理张量，TorchNPU 将这些操作接入昇腾，vLLM 与 Ascend 插件组织推理。Triton Ascend 则把使用 Triton 编写的算子接到 NPU。各层要按目标版本配成一套，安装成功的某个包只能证明其中一环。

选择安装路径时，先看起点已经包含什么：

| 起点 | 已经提供什么 | 还要完成什么 |
|---|---|---|
| 完整 vLLM Ascend 推理镜像 | 配套 CANN、框架、推理引擎与插件 | 核宿主机配套、映射所用设备，再运行模型验证 |
| CANN 镜像或已有 CANN 环境 | Toolkit、硬件对应的 Ops、NNAL；已有环境须逐项确认 | 安装配套框架、引擎、插件和该硬件需要的算子包 |
| 基础 Linux 环境 | 操作系统和自行准备的 Python 环境 | 先装 CANN 各组件，再完成上一行的软件安装 |

例如，能在 CANN 容器里查询到设备，却因缺少 NNAL 的动态库而加载失败，应继续检查库是否安装、环境脚本是否加载；重填模型并行参数解决不了这一层的问题。同理，其他 Python 包重装了同名 Triton 文件后，包清单里仍有 Triton Ascend，也可能已经不能执行它的实现。具体检查和版本条件见[怎么开](#怎么开)。

设备映射也随硬件改变：官方 A3 示例映射两个设备节点以对应两个裸片（DIE）；950DT 示例还映射该产品需要的额外设备节点。这里的节点是容器可访问的设备接口，物理板卡与逻辑设备数量仍按[硬件页](hardware-devices.md)计算。完整推理镜像、CANN 镜像和普通 Linux 镜像不能仅凭名称互换。

## 启动多机前，先检查哪一层网络？

**先确认设备之间能到达，再检查推理进程能否按约定一起工作。** 主机 IP 供服务入口、进程协调等使用；NPU 还有自己的设备网络地址。能登录另一台主机，说明登录所用路径可达；能访问 API，说明该服务端口可达。设备间搬运模型张量所需的链路要单独检查。

以两台机器各选一个 NPU 为示意：先在两边查询设备地址，再从机器 0 的 NPU 0 探测机器 1 的目标 NPU，最后交换方向。探测命令中的“本地设备号”和“远端 NPU 地址”共同确定被检查的路径。只测一对设备，就只得到这一对的结果；实际部署应覆盖所用设备对及两个方向。

按下面的顺序读结果，能避免把不同层的问题混在一起：

| 检查对象 | 得到什么证据 | 结果异常时先查什么 |
|---|---|---|
| 本机设备、光模块和端口 | 设备可见，链路为 UP，设备网络健康检查成功 | 驱动、设备状态、物理连接及交换机端口 |
| 设备网络地址与路由设置 | 两边 NPU 的地址、网关、对端端口等与集群规划一致 | 设备地址、接线和网络配置是否对应 |
| 所用 NPU 对之间的双向探测 | 收发包数相同、无丢包 | 失败方向的源设备、目标设备地址及链路 |
| 推理进程的连接与共同执行 | 各角色端口可达，组员到齐并完成匹配的通信调用 | 监听地址、网卡、端口、rank、张量与调用次序 |

前三步给出基础连通性证据；最后一步还要用实际版本的分布式推理或通信测试验证。连接成功以后仍可能因某个 rank 没进入同一次操作而等待，取证方法见[分布式通信排障](inference-troubleshooting.md#分布式通信区分交换慢和有人没到)。P/D 分离还要核对各角色的 API、进程协调及 KV 传输端口，代理端口可达只是其中一项。具体查询命令与硬件范围见页末[怎么开](#怎么开)。

P/D 方案采用 **HIXL**（Huawei Xfer Library，昇腾面向内存直连与高速数据面搬运的传输库）时，由它为跨卡/跨机内存数据建立传输连接。它的 **LocalCommRes** 描述本进程可用的通信端点，包括端点在主机还是设备、协议类型、地址及直连对端。以 UB 场景的设备到设备传输为示意，双方需要对应的设备端点；改走主机内存传输时，还须具备主机端点。注意两点边界：文件能解析只说明格式可读，端点与实际链路匹配且连通才是下一步；它与「哪些 rank 合算模型」的并行分组表解决不同问题，具体配置方式受硬件与通信库版本限制。

## 异构旗舰对照：GLM 双机跨节点通信域与调用统计

上面走完的是单机 `Qwen3-8B TP=2`（每层 2 次、全模型 `72` 次机内 `All-Reduce`）的干净路径。下面转入例外 B 历史绑定算例——**GLM-5.3-Flash 官方双机**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，两台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16，W8A8，分组推导见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。它同时跨越机内 HCCS 与机间 RoCE 两类物理网络，单次主干前向包含 **`218` 个通信调用边界**。一次调用可包含多轮底层传输，调用次数与网络包数是不同的量，次数汇总见[一条请求](one-request.md#一次前向的通信账)。

**HCCL 在 A0 启动阶段接入，在 A4 逐层计算中反复使用。** 本节对应[部署主线的「启动时发生了什么」](glm-5-3-flash-two-node.md#启动时发生了什么)：先初始化设备通信，再建立模型并行组，之后才能加载、预热并执行模型。下图把前文的四层软件栈与 GLM 双机 16 卡的三大通信域及通信精度合在一张总览里：

```wiki-diagram
file: cann-hccl-fig-stack-and-domains
```

### 启动时，同一张卡加入不同的组

**一个 rank 可以属于多个通信组；每次调用要选对组。** 下文的编号都是全局 rank：机器 0 上是 0–7，机器 1 上是 8–15。组员的位置决定是否需要跨机；具体链路还取决于产品拓扑、通信算法和配置。按本部署的拓扑示意，HCCS 表示机内互联，RoCE 表示跨机网络：

- **TP 组** {0…7} 与 {8…15}：每组 8 个 rank 都在同一台机器里，用来合算矩阵；这个成员表说明无需跨机，不单独证明每次操作采用哪条机内链路。
- **DP 设备通信组** {0,8}、{1,9} 直到 {7,15}：把两台机器上同号的卡配对，每组两端分处两台机器，需要跨机传输，本例用 RoCE 表示这段网络。
- **EP 组** {0…15}：两台合起来才持有完整的路由专家集合，所以这个组覆盖全部 16 个 rank，用来把输入送到专家所在的卡、再收回结果；下文的 MC2 也在这个组里执行。发往另一台机器的部分经 RoCE；同一台机器内的部分走 HCCS 还是网卡，取决于 HCCL 在 A2 上的机内设置与 MC2 的通信算法。GLM 教程的启动脚本没有设置相关变量，本部署的实际路径仍待核。

HCCS 与 RoCE 的带宽规格在[硬件设备](hardware-devices.md#官方带宽规格能说明什么)统一列出，本页不重复。

请求执行只分两份：DP2 的两个成员各起一个 EngineCore（引擎进程），各管本机 8 张卡。数据交接却有八个跨机配对的 DP 设备通信组，两者不要混为一谈。引擎之间另有 **gloo** 提供的 CPU 通信组，用两个 int32 元素同步“还有没有工作”和“是否请求暂停”；这是控制状态，与 HCCL 承载的设备张量分开。各卡还可通过组内 CPU 通道同步元数据，详见部署页。

### 执行时，输入、部分和与专家结果依次交接

**跟着一个 token 看，每过一个交接点，框架都先确定本次张量和参与者。** token 是分词得到的基本单位，进入模型时用词表编号表示；它的隐藏向量经过每层计算。TP8 中，attention 的输出投影把本卡贡献交给机内 All-Reduce；稠密 MLP 的降维后再合齐一次。

本部署这些 TP 归约的逻辑张量是 [T,4096] BF16：T 是本轮新计算的 token 行数，每行是一个 token 的 4096 维子层输出。**R1 是[请求主线](one-request.md#示例请求-r1-与官方双机部署)中提示词长 4 个 token 的示例请求**；它首次处理提示词时，每次这类 TP 归约的逻辑载荷为 **32 KiB/卡**。字节推导仍在[主线通信账](one-request.md#一次前向的通信账)，这个数不含底层转发、协议与重传。GLM 把隐藏向量复制成 4 条并行残差流（mHC），但 TP 归约只对子层输出 [T,4096] 做一次，不按 4 条流重复计算。

后续 MoE 层用专家网络计算前馈结果。R1 的小批输入走 **MC2**，即昇腾的一类计算与通信协同实现：在 EP16 中派发给被选专家，计算后收回，再在 TP8 中收齐本组行布局；共享专家是每个 token 都会经过的前馈分支，还需合齐其 TP 部分和。每个 MoE 层的前馈段有四个通信边界，attention 的一次归约另计。大批输入改用名为“AllGather”的 MoE 通信方式（名称沿用源码，不是单指一次 All-Gather 操作），这四个边界换为两次 DP 收集、一次 DP [Reduce-Scatter](collective-communication.md#reduce-scatter) 和一次 TP 归约，原因见[大批输入为什么改用 Reduce-Scatter](collective-communication.md#大批输入为什么改用-reduce-scatter)。选择条件与全部形状见[通信基础的 GLM 段](collective-communication.md#放到-glm-双机一个-token-会在哪里通信)。

## AI QoS 怎样处理共享链路上的争用？

**AI QoS 让支持的交换网络按流量类别安排服务先后，解决的是出口拥塞时谁先走。** 例如计算正等集合通信结果，而 KV cache（保存历史计算状态的缓存）正在主机与设备间搬运；两类流量同时到达同一出口、超过出口处理能力时，就会排队。

在支持的 Unified Bus 拓扑中，**Virtual Lane（VL，虚拟通道）**把流量分到不同逻辑通道，再按优先级调度。高优先级先服务，可减少关键通信的排队；当高优先级流量占住出口时，低优先级就要继续等待。总链路带宽仍由硬件决定，请求什么时候进入模型仍由推理调度器决定（例如 [ShortRequestFirst](short-request-first.md)、[Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)），VL 不读取提示词、生成进度或 token 预算。

下图把前文的多机 4 层网络预检与两套最容易混淆的 QoS（整机交换机 `tools/ai_qos.py` 与引擎内 KV 传输 `qos_priority`）并排对照：

```wiki-diagram
file: cann-hccl-fig-qos-and-netcheck
```

使用前务必分清三个易混缩写与硬件边界：

- **硬件范围仅限 A3 拓扑：** 下文的硬件与软件条件限定的是 AI QoS 流量调度能力，不是所有 HCCL 通信的最低运行要求。固定文档把 AI QoS 限定在 Atlas 800T A3 / Atlas 900 A3 SuperPoD；本页 A2 双机主线没有启用它的证据，具体配套和配置方法集中列在“对照源码”，避免把 A3 的可选能力套到 A2 部署。
- **同名缩写辨析：** 本节的 **UB** 是 Unified Bus（[AI Core](ai-core.md) 中的 UB 则是片上 Unified Buffer）；这里的 **SP** 表示 strict priority（严格优先级，与[序列并行](sequence-parallel.md)缩写相同、含义不同）。流量怎样分类并映射到虚拟通道、分开排队后一次等待怎样变化，见[AI QoS](ai-qos.md)。
- **延伸到昇腾 950：** 继续阅读[昇腾 950 的任务执行与互联](ascend-950-execution-interconnect.md)，可以沿同一次两卡求和，区分设备任务调度、通信卸载和互联各负责哪一段。集合通信的操作定义仍在原页，950 的软件接入情况也与本页固定 A2 部署分开记录。

## 常见误解

- **“网络连通，一次集合通信就能完成。”** 网络只解决到达问题，程序还必须使用正确的组，并使形状、类型、收发约定和调用顺序匹配。
- **“HCCL 与 HCCS 是同一个东西。”** HCCL 是通信库，HCCS 是互联方式；库还可支持其他链路。
- **“所有通信都经过同一个普通接口。”** 普通张量通信和 MC2 等专用实现有不同入口，应沿本次算子的实际调用核对。
- **“W8A8 让所有通信字节都减半。”** 本部署的 TP 归约仍传 BF16；只有 MoE dispatch 这一段因量化改传 int8 加缩放系数，combine 仍是 BF16。通信量取决于每次交给通信操作的实际张量类型。
- **“优先级调高就能增加带宽，运行脚本就配置完交换机。”** 优先级改变服务次序；脚本写入端点后打印交换机命令，交换机仍需单独执行与验收。

## 对照源码

### 怎么开

**先确定完整配套，再选一种安装路径。** 发布版本按官方兼容矩阵的同一行选择 vLLM、插件、CANN、PyTorch / TorchNPU 和 Triton Ascend；main 开发环境还要使用该插件快照记录的 `.github/vllm-main-verified.commit`，不能用任意同名标签代替。`latest` 文档、发布包和本站固定源码是三个需要分别核对的对象。

已有 CANN 环境可先检查 NNAL。下面沿用官方默认安装路径；自定义安装时替换为实际路径，在将运行推理的同一 shell 和 Python 环境中执行：

```bash
ls /usr/local/Ascend/nnal/atb/set_env.sh
find /usr/local/Ascend/nnal/atb -name 'libatb.so'
source /usr/local/Ascend/ascend-toolkit/set_env.sh
source /usr/local/Ascend/nnal/atb/set_env.sh
python -m pip check
```

前两项确认文件存在，加载环境脚本使进程能找到相关库；最后一项检查 Python 包依赖。之后仍须按对应版本的 Quick Start 执行实际推理，才能验证模型加载与算子执行。手动安装 Ops 时按硬件选包，官方基础环境示例中的 `910b-ops` 只适用于 A2。

安装方式也有硬件范围。较后官方安装快照的普通 pip 路径使用 A2 构建；其他硬件选择对应完整镜像、WheelNext 变体或源码构建。A3 源码构建还需要初始化子模块。Triton Ascend 3.2.0 及以前要求先卸载社区 Triton；3.2.1 起先安装作为依赖的社区包，再由 Ascend 实现覆盖共享安装路径。后续重装社区包仍可能覆盖这些文件，遇到此情况按目标版本要求卸载两者再重装 Triton Ascend。

较后文档为 A2 / A3 / 950DT 额外要求安装 FLA NPU，即提供卷积和 gated delta-rule 算子的设备包；选择与硬件相应的 a2、a3、a5 包，并核 glibc 2.34+ 和提供 GLIBCXX_3.4.29 的运行库。该步骤没有随插件自动完成。Atlas 300I DUO / 200I Pro 在这份指南中不需要 FLA NPU，也不支持安装 Triton 或 Triton Ascend。各教学钉点与较后文档的区别见[版本差异](#版本差异)。

普通 HCCL 通信由 Ascend Worker 的分布式初始化接入，固定执行快照在 `_init_worker_distributed_environment` 中传入 `hccl` 后端，然后调用 `ensure_model_parallel_initialized` 和 `init_ascend_model_parallel`。按[部署命令](glm-5-3-flash-two-node.md#怎么开)设置并行规模即可进入这条路径；CANN 的安装、驱动、固件、PyTorch / torch_npu 与框架版本仍须分别记录并核配套。

```wiki-diagram
file: cann-hccl-flow
```

图将 A0 的建组与 A4 的使用分开。普通 All-Reduce/All-Gather 由上游设备通信器把张量和 `device_group` 交给 `torch.distributed`。Ascend 的普通 All-to-All 先按发送维切片，再交换，最后按接收维拼接；两组 split sizes 同时提供时走指定长度分支，否则按组大小切分。MC2 等专用入口另见[通信基础](collective-communication.md#mc2)。

**设备网络预检。** `hccn_tool` 是随驱动安装的 NPU 集群网络管理工具；找不到命令时先核驱动安装与可执行文件路径。以下是官方安装指南的 A2 示例，在每台节点的 Linux shell 执行。`0..7` 是该示例的本机设备编号；容器须能访问实际使用的设备和驱动工具，编号范围按现场可见设备核对。

```bash
# 分别查询链路、设备网络健康和 NPU IP
for i in {0..7}; do hccn_tool -i "$i" -link -g; done
for i in {0..7}; do hccn_tool -i "$i" -net_health -g; done
for i in {0..7}; do hccn_tool -i "$i" -ip -g; done

# 查询对端交换机端口、探测 IP、网关和设备网络配置
for i in {0..7}; do hccn_tool -i "$i" -lldp -g; done
for i in {0..7}; do hccn_tool -i "$i" -netdetect -g; done
for i in {0..7}; do hccn_tool -i "$i" -gateway -g; done
cat /etc/hccn.conf

# 在源节点执行：0 换为本地设备号，x.x.x.x 换为另一节点查询到的 NPU IP
hccn_tool -i 0 -ping -g address x.x.x.x
```

链路查询应有 `link status: UP`，健康查询应有 `net health status: Success`；LLDP、探测地址、网关和配置查询则要逐项与集群规划核对。跨节点探测应收到回复，汇总中发送与接收包数相同、丢包为零，再覆盖部署使用的其余设备对和反向路径。官方 A3 示例遍历 0–15，950DT 示例遍历 0–7；这是设备号范围，不是物理板卡数量，计数关系见[硬件设备](hardware-devices.md)。

固定 Ascend 安装指南在 950DT 预检中列出 `/lib/route.conf`、`/etc/hccl_rootinfo.json` 与 `/etc/hixlep`，并要求选择 D2D 场景。实际准备时还要按其链接的 [HiXLEP 配置指南](https://gitcode.com/cann/hixl/wiki/A5%20LocalCommRes%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)选择 **CANN 版本**：9.1.0 章节使用这些输入，9.2.0 自动生成流程已不依赖旧 route.conf。A2 主线使用自己的网络配套，不套用这项 950DT 前置条件。

9.1.0 路径先核拓扑文件与 rootinfo 的设备映射，再按场景准备路由及端点。指南附录的 `generate_ep.py -s` / `-p` 分别对应 Server / PoD 的设备传输场景；有主机端点需求时需另用对应完整资源流程。路由脚本会覆盖输出文件并操作设备配置入口，执行前要保存现有配置。生成后逐项检查文件覆盖了哪些设备、JSON 是否有效、端点列表是否为空，以及通信标识和对端是否匹配现场；只数文件个数不足以证明配置正确。

9.2.0 自动生成仍要求可用设备、正确拓扑、可加载的 DCMI 设备管理库，以及有权限执行的 UB 资源查询工具。满足配套要求时可在初始化时生成，或使用配套 `hixl_tool local_comm_res` 预生成。工具与 `libcann_hixl.so` 必须来自匹配版本；工具不会随 HIXL run 包自动安装。该工具的设备参数是用户态可见设备号，输出名同时含用户设备号与物理设备号；它与旧脚本的单编号文件名不同，接入 Mooncake 时必须核对相应消费者，不能把文件改名就当作配套已经验证。完整端点与内联 JSON 的优先关系、支持条件见对应 HIXL 版本文档。

然后核对每节点主机 IP 与所选网卡是否对应。P/D 场景还要按所用教程放通 DP RPC、API、HCCL socket、Mooncake 握手/控制与传输引擎端口；端口集合取决于角色与拓扑，传输引擎也可能通告额外端口。并行规模和进程部署入口见[PP 页的多节点启动说明](pipeline-parallel.md#怎么开)，KV 传输端口与数据路径见[Mooncake](mooncake-connector.md)。

AI QoS 是独立的设备与交换机配置工具。构建并安装 AI QoS 扩展前需将 DSMI 头文件与设备管理库挂入容器并按实际路径传给构建命令；文档要求特权容器、Ascend HDK 25.5.2+、UB Switch LingQu Computing Network 1.5.1+。**注意两套版本的 CLI 差异**：在 **`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）** 上，入口为 `python -m tools.ai_qos`（`manual` 模式仅接受 `--AIV` / `--SDMA` / `--PCIEDMA` 三键，默认 `high / low / high`，恢复命令为 `python -m tools.ai_qos unset`，传入旧五键会直接报 `argparse` 参数错误）；而在固定历史快照 `db701c1f`（及 `v0.23.0` / `v0.26.0rc`）上，入口为 `python tools/ai_qos.py`（`unset` 恢复），使用下表五键分类：

| 固定快照配置键 | 文档对应流量 | 默认等级与可选范围 |
|---|---|---|
| `AIV_D2D` | AIV（向量核）发起的设备间派发 / 收回 | high；high / middle / low |
| `AIV_H2D` | AIV 路径的算子下发 | high；high / middle / low |
| `SDMA_D2D` | SDMA 数据搬运路径的 All-Reduce / All-Gather | high；high / middle / low |
| `SDMA_H2D` | SDMA 路径的 KV offload / prefetch，即历史状态换出 / 预取 | low；high / middle / low |
| `PCIEDMA_H2D` | PCIe DMA 路径的算子下发 | high；仅 high / low |

配置可填写不等于驱动已实现。固定 `db701c1f` 文档没有给出 AIV 两项恢复生效的驱动版本；使用时应核对实际配套，不能由“当前不生效”推出所有未来版本都不支持，或一定会报错。

D2D 指设备到设备，H2D 指主机到设备；该表中 KV 换出还包括反向的设备到主机传输。DMA 指直接搬运数据的硬件机制，表中各前缀用于区分搬运通道。固定文档明确：受驱动限制，AIV 两项设置当前不生效。

在脚本默认配置中，SDMA 两类流量共享源标签 **2**。交换机结合初始 VL 区分方向，再把 D2D 映射到 **VL 2、优先级 3**，H2D 映射到 **VL 3、优先级 1**。这些编号来自该脚本的映射表；其他版本应核对自己的表，而非把数字视作网络通用约定。

脚本写入端点状态，并打印 `hccs qos remap` 等交换机命令；操作者还需登录交换机执行，已有配置须事先备份。`python tools/ai_qos.py unset` 恢复保存的端点首次应用快照，打印交换机 `undo` 命令。它保存的是端点相关状态及自己生成的命令，不是整台交换机原配置。这些设置也不跟推理进程绑定：脚本在推理任务之前单独运行，推理进程退出后端点与交换机配置照旧生效，要恢复必须显式执行 `unset`，再登录交换机执行打印出的 `undo` 命令。

### 会报什么错

先按失败阶段定位：A0 建组失败要核参与进程、rank 与组配置；A4 某次调用等待要核所有参与者是否进入同一通信及其张量约定，再结合设备和链路日志判断。单凭超时无法区分成员未到达、算子先出错或链路故障。

设备链路为 DOWN、健康查询失败，或跨设备探测丢包时，先保留对应节点、源设备号、目标 NPU IP 与输出，沿物理连接和设备网络配置检查。基础检查通过后再出现推理超时，则同时收集组内最早异常与各 rank 的调用进度；继续重复主机 ping 无法补齐这些证据。

QoS 的 `unset` 找不到快照时打印 `No state file at ...; nothing to undo.` 并退出。恢复 SDMA 或端点全局配置失败会打印带设备号和返回码的警告；“打印了 undo”只说明生成了交换机恢复指令，不能据此认定交换机已恢复。

`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）上 KV 传输的 `qos_priority` 不是 `0–4` 的整数（布尔值也不行）时，PD 分离连接器或 KV 池后端在启动阶段抛 `ValueError`；环境变量 `ASCEND_GLOBAL_RESOURCE_CONFIG` 里原有的 QoS 值会被覆盖，并打一条 warning。日志 `Injected comm_resource_config.qos=...` 只说明本地环境已写入，不能证明某条传输通道用了这个值。

对上述 PD 分离连接器，`comm_resource_config.qos` 是含点号的顶层 JSON 键，不是嵌套对象路径；合并时保留其他资源设置和 `store` 配置。即使省略 `qos_priority`，默认值 `1` 仍会替换已有的顶层 QoS。[S26]

### 开销和什么时候别开

HCCL 通信要占用设备缓冲并等待所需数据，预算见[通信缓冲](hccl-buffer.md)。先确定瓶颈是传输量、启动延迟还是参与者到达不齐，再判断并行策略；精确带宽与耗时需要通信 trace 和设备实测。


启用分层通信还会改变算子入参要求：固定镜像在判定分层通信启用后，设置需要传入专家权重尺度的标志。排查通信配置时，应同时核对调用参数；这条条件本身不说明当前部署已经走了分层通信。

AI QoS 适用于受支持拓扑上的流量争用。提高关键流量优先级会改变其他流量的等待时间，验证要同时覆盖集合通信与状态换出 / 预取。A2 主线不套用 A3 的交换机配置；在无争用时，也不能由优先级表推出加速比例。

### 版本差异

**安装文档也有自己的版本。** `v0.23.0`、`v0.26.0rc` 的固定安装指南均列出 CANN / NNAL 9.1.0、PyTorch 2.10.0、TorchNPU 2.10.0.post4，以及 Triton Ascend 3.2.2 的安装说明。`v0.30.0` 周期与 `main` 的固定指南改用包含文件和模板变量描述三种安装路径；早期快照的模板仍将发布示例指向 0.23.0，不能仅凭分支名就把模板展开的镜像叫作该分支镜像。实际安装应再对照目标发布行及所用源码提交。

| 核对项 | `v0.23.0` 固定指南 | `v0.26.0rc` 固定指南 | `v0.30.0` 周期指南 | `main` 固定指南 |
|---|---|---|---|---|
| CANN 基础环境与完整推理镜像 | 两者分开，手装路径含 Toolkit / Ops / NNAL | 相同；强调完整配套 | 明列三种路径及组件责任 | 与 `v0.30.0` 相同 |
| 无 NPU 的构建说明 | 没有同名 CPU-only 验证节 | 跳过设备验证，仍准备 CANN / 框架依赖 | 仍要求 CANN 头文件和库；关闭自定义算子构建 | 与 `v0.30.0` 相同 |
| 构建成功能证明什么 | 不等于 NPU 推理成功 | 只证明包构建，运行前另查依赖与设备 | 相同 | 相同 |

较后官方快照 `921ccc52` 将配套升级为另一组版本，并增加上述 FLA NPU 安装要求；它的 main 专用 CPU-only 流程还改为跳过原生扩展，仅验证 Python 打包，允许不安装 CANN、驱动和运行时依赖。这个专用环境预期会被 `pip check` 报缺依赖，不能拿它作为实际推理环境的合格判据。它也不提供 CPU 推理或单元测试环境。这些后续变化均不回填为固定 GLM 部署已经具备的条件。

设备网络预检在 `v0.23.0`、`v0.26.0rc`、`v0.30.0` 与 `main` 的固定官方安装指南中均存在：A2 用 0–7、A3 用 0–15，均查询链路、健康、地址与配置，再进行跨节点 NPU ping。四版也都有 950 系列的拓扑配置前置项，`v0.30.0` / `main` 明确为 950DT。较后的文档快照 `921ccc52` 把结果判据细分为链路 UP、健康 Success、配置逐项核对，并明确探测目标是远端 NPU 地址、需双向覆盖。这是说明的补全，不据此推断驱动或通信实现发生变化。

HIXL 是另一条配套版本线。上述固定 Ascend 指南中的三文件清单，不能推出所有 CANN 版本永久需要相同文件。HiXLEP 指南分别说明 CANN 9.1.0 与 9.2.0，后者自动生成去掉旧路由文件依赖；本文所读 HIXL 工具文档另固定到 `dcf0027f`，工具只面向 A5。HIXL 接口文档还区分 UB 场景只含 device 端点、只含 host 端点及二者齐全时允许注册和传输的地址类型；升级框架或修改 PP/TP 参数不会自动补齐这些资源。

自 `v0.30.0` 起，额外睡眠清理增加了 HCCL lifecycle anchor，创建失败时可跳过本轮通信组拆除，恢复后再释放；生命周期与显存影响统一见 [Sleep mode 版本差异](sleep-mode.md#版本差异)。

**`v0.30.0` 与 `main` 仍用 `hccl` 初始化分布式环境，但建组和 QoS 要看具体入口。** Engram+PCP 会临时复制配置并清除 Engram 项，避免上游先建 DP-only 组，随后由 Ascend 沿 `DP × PCP` 维度分组。实际组大小还须对齐每节点的完整执行组数量与 rank 布局，不满足时退回大小 1、不另建组；开启主机共享时这个 Engram 组使用 `gloo`。整机 AI QoS 工具使用 `AIV / SDMA / PCIEDMA` 三键（`high / low / high`）；P/D 传输的 `inject_qos` 则默认 `1`、严格接受整数 `0–4`，并合并全局资源配置保留其他字段。常规、layerwise、hybrid Mooncake P2P 都调用后者，这两种 QoS 不是同一个入口，`hccl` 后端名也不能单独证明实际物理链路或性能。

下表按四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；固定 GLM 执行快照另为 `db701c1f`，旧快照 `baa023ad` / `7d825229` 的行号线索见上方说明与来源清单。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| Worker 后端与建组入口 | 显式 `hccl` 初始化，随后调用 `ensure_model_parallel_initialized` 与 `init_ascend_model_parallel` | 相同 | 相同（`worker.py#L1283-L1305`）；Engram+PCP 临时清除上游 `engram_config` 避免重复建 DP-only 组 | 相同（`worker.py#L1405-L1427`）；MRV2 `pp_broadcast` 显式按 `hccl` + `create_hccl_pg_options("pp_broadcast")` 重建（`v2/model_runner.py#L179-L185`） |
| Ascend 扩展通信域 | TP / DP / EP / MC2 / `dynamic_eplb` / 细粒度 TP 等 | 延续并调整部分辅助组 | 新增 `edp`（Engram `DP×PCP`，`dp_shared_memory` 走 `gloo` 否则 `hccl`）与 `kvpp`（`TP×PCP`）（`parallel_state.py#L63-L115`）；睡眠清理含 `sleep_lifecycle_anchor`（1 MiB） | 在 `v0.30.0` 基础上补建 `etp`（`TP×DP` 覆盖上游 TP 回退）并将 `edp` 扩展至 `PCP==1` 共享 PLE 表（`parallel_state.py#L63-L145`） |
| AI QoS 入口与键 | 独立脚本 `python tools/ai_qos.py`（默认 `auto`）；五键（AIV D2D/H2D `high`、SDMA D2D `high` / H2D `low`、PCIEDMA_H2D `high`） | 相同 | `python -m tools.ai_qos`；收敛为三键 `AIV` `high`、`SDMA` `low`、`PCIEDMA` `high`，均支持 `high/middle/low`（`tools/ai_qos.py#L453-L473`） | 同 `v0.30.0`（`tools/ai_qos.py#L453-L473`） |
| AI QoS 映射依据与默认目标 VL / 优先级 | 按 D2D / H2D 初始 VL 区分，AIV D2D 2/3、H2D 5/3；SDMA D2D 2/3、H2D 3/1；PCIEDMA H2D 5/3 | 相同 | 按通道类型配置（cacheable / noncacheable 初始 VL 均生成映射）；默认 AIV 2/3、PCIEDMA 3/3、SDMA 4/1 | 同 `v0.30.0` |
| 恢复边界与硬件限制 | 恢复端点首次快照并打印交换机 `undo`；A3 指定产品、AIV 不生效 | 相同 | 相同（A3 指定产品与最低版本要求不变，AIV 不生效） | 相同 |
| 推理引擎内 KV 传输 QoS 入口 | 无 | 无 | 有：`kv_connector_extra_config.qos_priority`（整数 `0–4`，PD 默认 `1`，`kv_transfer/utils/utils.py#L18-L47`） | 同 `v0.30.0`（`kv_transfer/utils/utils.py#L18-L47`） |

`v0.30.0` 与 `main` 沿用的 `qos_priority` 与 AI QoS 是两套东西。它写在 KV 传输配置的 `kv_connector_extra_config` 里，只由 PD 分离的三个 Mooncake 连接器（MooncakeConnectorV1、MooncakeHybridConnector、MooncakeLayerwiseConnector）和 KV 池后端读取。连接器在建立传输引擎前，把它写进环境变量 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 `comm_resource_config.qos`，不填时用 P/D 默认值 **1**；KV 池后端只在显式填写时写入，Mooncake 后端写 `store.comm_resource_config.qos`，Memcache 后端写 `MF_DEVICE_UB_QOS`。这里的 0–4 是 KV 传输通道的 QoS 值，与本页 AI QoS 的 high / middle / low 等级、VL 编号和交换机优先级不是同一套编号。使用 HIXL Client/Server 传输时，连接通道采用发起端的值：pull 用 decode 侧，push 用 prefill 侧；该规则不能单凭环境写入日志推广到其他传输实现。本页 GLM 双机主线没有配置 KV 传输，用不到这个入口；机制见 [PD 分离](pd-disaggregation.md)与[外部 KV 池](kv-pool.md)。

固定 GLM 快照的五键定义、默认值与恢复逻辑和表中 `v0.23.0` / `v0.26.0rc` 一致。四版核对覆盖通信初始化、Ascend 扩展通信域、AI QoS 工具与 KV 传输 `qos_priority` 入口；CANN 9.1.0 文档用于解释软件职责，具体集群的驱动与完整镜像配套仍须按部署环境另核。

### 源码位置

- HIXL 通信资源的概念、CANN 9.1.0 / 9.2.0 配置流程与附录脚本见来源 72；工具适用硬件、版本配套与输出名见固定工具说明 73；内联/文件优先关系、拓扑与端点地址类型条件见接口说明 74。
- 软件分层、三种安装路径与构建验证边界见来源 57–61；A3 与 950DT 的容器设备映射分别见来源 62、63。Triton 安装覆盖关系及 FLA NPU 的硬件、运行库条件见来源 60。
- 四版安装说明见来源 64–67，rc2 / main 模板发布示例实际指向的版本见来源 68、69；后续模板版本见来源 70。发布行与 main 固定提交的配套规则见来源 71。这些是文档与源码快照证据，不是本项目的设备安装实测。
- 设备网络检查步骤、硬件示例编号、查询结果判据和双向探测范围来自固定官方安装指南；v0.23、v0.26、rc2、main 分别见来源 52、53、54、55，较后文档的明确判据见来源 51。950DT 拓扑文件要求也在该指南中。[S51]
- P/D 角色启动前的主机地址、网卡与端口类别要求见 GLM-5.3-Flash 官方教程；这里采用网络检查要求，不改变本页 A2 混部算例。[S56]
- CANN 的计算软件职责、HCCL 的通信能力及链路列表来自官方 CANN 9.1.0 文档；All-Reduce 的四种归约操作也在其中。[S1][S2]
- 固定 Worker 初始化与普通通信封装，支撑第二张图的 A0→A4 顺序和普通 All-to-All 分支。[C3][C4][C5]
- TP / DP / EP 的成员生成与 CPU 两元素状态同步，支撑本页通信域对照。[C18][C19]
- 固定快照 MC2 派发器的注释建议 A2 设置 HCCL 机内变量组合；这不是所有产品、CANN 版本或普通 HCCL 操作的生效证明。比如 CANN 商用版 8.5.0 的普通 `HCCL_INTRA_PCIE_ENABLE` 文档把 A2 适用产品限定为 Atlas 200T A2 Box16，不能直接套成 Atlas 800 A2 的通用调参规则。现场仍须按实际 CANN / MC2 配套与链路日志核对。[C29][S48]
- AI QoS 的争用动机、VL 隔离与严格优先级，以及构建、五类流量和硬件约束，来自固定执行快照官方指南。[S6][S7]
- 固定 QoS 映射、端点写入与交换机命令生成、参数默认值、恢复与失败分支，支撑上文的默认配置与恢复边界。[C8][C9][C10][C11]
- 三版 Worker 均显式选择 hccl 后端（来源 12–14）；三版脚本对应版本表中的五键→三键变化与恢复边界（来源 15–17）。
- 三版官方指南分别确认构建方式、硬件 / 软件条件与 AIV 驱动限制。[S20][S21][S22]
- `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）的 KV 传输 QoS 入口：P/D 默认值 1 与 `0–4` 校验、KV 池后端的校验、Mooncake 连接器在建传输引擎前的调用、官方 PD 教程写明的发起端规则与日志含义，以及 Mooncake / Memcache 两种 KV 池后端各自写入的环境变量；`v0.23.0`、`v0.26.0rc` 与固定快照 `db701c1f` 中都没有这些调用。[C23][C24][C25][S26][C27][C28]
- `v0.30.0` 起引入的 Engram 分组：Ascend 提供 `DP × PCP` 维度与 `TP × PP` 执行组大小，上游 helper 用每节点完整执行组数和该维度的最大公约数决定分片，无法整除或节点 rank 不连续时退回 1。[C49][C50]

上述来源 23 还显示：若 `qos_priority` 无效或 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 JSON 格式错误，会在修改环境前失败。

**待核：** 缺少固定 GLM 镜像的完整 CANN / HCCL、驱动与固件配套清单，及真实通信 trace；尚不能确认本次运行的底层算法、各组的实际链路、物理链路带宽或 QoS 收益。218 次与 R1 的 32 KiB 是固定主线的调用 / 逻辑载荷口径，均不代表已实测的网络包数或收发字节。

网络预检、HIXL 端点生成和真实传输尚未在本项目的 NPU 环境执行。具体 EID、网卡地址、设备映射与拓扑须从目标机器取得，不能直接使用官方示例中的地址。

- 来源 31：vllm-ascend@db701c1f，vllm_ascend/ops/fused_moe/token_dispatcher.py，L113–L119。

设备组由固定版本的 Worker、模型并行建组与 GroupCoordinator 传给 NPUCommunicator；All-to-All 的具体入口见来源 5，基础通信器的归约/收集接口见来源 4。AI QoS 的硬件、容器权限、软件配套与 AIV 驱动约束见固定指南的 75–82 行；满足这些配置条件后，实际采用的算法和链路仍需通信 trace 确认。
