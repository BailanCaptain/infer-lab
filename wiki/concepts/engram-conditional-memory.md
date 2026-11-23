---
id: engram-conditional-memory
title: Engram 条件记忆：N-gram 哈希查表与 Host DRAM / RDMA 共享
type: concept
origin: direct
summary: >-
  Engram 是模型自带的只读条件记忆表：按相邻短 token 序列的 N-gram 哈希稀疏查表，反量化后经门控融入残差流。因整表体积可达数百
  GiB 且每步仅随机读取命中行，昇腾推理将其卸载到 Host DRAM（经 ACL 钉页直读与 POSIX 机内共享）或跨实例 MemFabric /
  HIXL 共享池，把宝贵的 NPU HBM 留给权重主干与动态 KV cache。
aliases:
  - Engram
  - Engram CPU offload
  - dp_shared_memory
  - engram-config
  - 条件记忆表
  - Engram 条件记忆
  - Conditional Memory
  - N-gram 哈希记忆
  - shared_engram
  - Shared Engram
  - EngramConfig
  - embedding_across_dp
  - ETP
  - EDP
  - Host UVA
  - HOST_UVA
  - HostUvaBuffer
  - SharedUvaBuffer
  - aclrtHostRegisterV2
  - HIXL
chapters:
  - '07'
order: 1
sources:
  - 'https://arxiv.org/html/2609.19969v1'
  - 'vllm@ced6857a:vllm/config/engram.py#L18-L115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engram_config.py#L19-L45'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/parallel_state.py#L79-L107'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/hash_state.py#L31-L105'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/parallel.py#L22-L96'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/embedding.py#L51-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/embedding.py#L345-L405'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/layer.py#L14-L57'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/triton/docs/engram.md#L1-L36'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/parallel_state.py#L80-L137'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/npu.py#L25-L69'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/npu.py#L156-L215'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/npu.py#L296-L360'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/embedding.py#L100-L175'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/embedding.py#L220-L335'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L457-L491'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L795-L819'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/local_weights.py#L1-L97'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram.md#L1-L189'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram_rdma.md#L1-L86'
verified:
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: deepseek-v4-1-flash
    kind: builds-on
    note: DeepSeek-V4.1-Flash 整机结构与 CED / CSA2 / Engram 三笔内存账的分工背景
  - to: deepseek-serving-case
    kind: builds-on
    note: 跨实例 P/D 部署下 Engram 与 KV 传输、连接器拓扑如何配合
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样占用主机 DRAM，但一个是只读模型参数表、一个是每请求动态 KV 历史
  - to: rfork
    kind: builds-on
    note: main 上 RFork 快载如何单独加载、豁免并释放 Engram Host DRAM 表
  - to: cann-hccl
    kind: builds-on
    note: HCCL 设备通信与 Gloo 主机协调组在 ETP / EDP 分组中的职责差异
  - to: model-runner-v2
    kind: builds-on
    note: A3 跨实例 shared_engram 强制 Model Runner V2，且 MRV2 在多 DP/PCP 下自动推导开启 dp_shared_memory
  - to: cpu-binding
    kind: builds-on
    note: Engram 启用 Host DRAM 卸载时绑核须跳过页迁移（migrate_memory=False），避免破坏 HOST_UVA 钉页映射
  - to: sleep-mode
    kind: conflicts-with
    note: A3 跨实例 shared_engram 与 Sleep Mode 互斥，不能在同一消费实例上同时启用
contradicts: []
updated: '2026-11-19'
---

**Engram（条件记忆表）是模型训练时内置的一张超大只读参数查表：推理到每个 token（分词编号）时，先用它和前面紧邻的若干 token 拼成短语组合（N-gram），做哈希映射成行号，再从表里随机取出对应向量、经门控融入当前层的隐藏状态。** 它让模型不必把海量事实性短语记忆全都硬塞进注意力权重或 MoE 专家矩阵里，而是改用按内容稀疏查表来扩充容量。

这项机制只插在模型主干的少数指定层里（例如 DeepSeek-V4.1-Flash 仅在部分层配置了条件记忆，背景见 [DeepSeek-V4.1-Flash](deepseek-v4-1-flash.md#固定配置里哪些数字属于哪一部分)）。读完这一页要弄清三件事：Engram 的短语哈希查表到底怎么运行、为什么必须把动辄数百 GiB 的整表卸载到主机内存（Host DRAM）甚至跨实例共享、以及在多卡部署下「设备侧分片存放」与「主机侧跨副本共享」各自如何配合、付出什么代价。

```wiki-diagram
file: engram-plate-dram-cutaway
```

## 为什么大表不塞进计算权重，而改用 N-gram 哈希查表？

普通大语言模型每步前向都要把整层的密集矩阵（注意力投影、MLP 或选中的 MoE 专家）从显存搬进计算单元乘一遍；如果想靠扩大权重矩阵来记住更多短语与实体知识，显存和访存带宽都会同步暴涨。**Engram 换了一条路：只扩“词典”，不扩每步参与矩阵乘的参数量。** 对每个当前 token，它只按紧邻的短 token 窗口（2-gram、3-gram……直至配置上限 `engram_max_ngram_size`）在指定层（`engram_layer_ids`）做哈希，从上亿行大表里取出寥寥几行向量，再经一层轻量投影与门控加回残差流。

```wiki-diagram
file: engram-fig-lookup-flow
```

沿图上四步拆开看单步前向怎样运行：

1. **拼短语前文并算 N-gram 哈希。** `AscendNgramHashState` 按顺序从三个来源补齐当前 token 前面的紧邻编号：当前批次块内的前文、runner 维护的 `lookback` 窗口、以及可选的 SWA（滑动窗口注意力，只保留最近固定窗口历史）槽位历史。遇到图片占位符或死标记（`engram_dead_mask` 匹配 `image_token_id` 与 `image_pad_token_id`）时立刻截断有效前文，避免图文边界拼出无意义的跨模态短语；空请求与填充位填 `-1`，不会偷读其他请求的 token。输出形状为 `[tokens, num_layers, (max_ngram - 1) * num_heads]` 的 `int32` 哈希编号。
2. **按需跨副本汇集哈希。** 若大表留在设备侧，或按 `EDP`（Engram 数据并行组）拆开存放且未开启机内共享，各副本需先经 `gather_engram_hashes` 在 `edp` 组内做 `All-Gather`，把每张卡要查的哈希行号拼成统一槽位。若已开启 `dp_shared_memory`，同机副本直接映射同一份主机表，**跳过这一步集合通信**。
3. **按头分片查表与分组反量化。** 全部哈希头均匀切给参与分片的卡（每卡负责 `local_heads` 个连续头段对应的词表区间 `[vocab_start_idx, vocab_end_idx)`）。Triton 查表核 `engram_lookup` 每程序写入一个 `(token, head)` 行，越界或无效 ID 直接输出全 0；支持 `BF16`、`INT8`（组宽 32 的 `FP32` 缩放）与 A5 原生 `MXFP8`（组宽 32 的 `E8M0` 指数缩放）。**无论整表放在 HBM（NPU 板载高带宽显存）还是 Host DRAM，只有命中的那几行会被反量化成 `BF16` 写入 HBM。**
4. **归集全部头并做门控融合。** 若表按 `EDP` 分片，先用 `exchange_engram_rows` 做 `AllToAll` 把命中行精准送回对应请求所在的副本（避免 `All-Gather` 把别人的行也物化到本卡）。随后经 `tensor_model_parallel_all_gather` 在 TP 组内拼齐全部头的向量。最后 `AscendEngram` 用复制线性层 `wkv` 投出 `key` 与 `value`，按当前隐藏状态算门控权重并加回残差流（A5 硬件在无旋转矩阵时走融合核 `fused_engram_gate`）。

用一个极简教学示意看清规模对比。设某层有 $H = 4$ 个哈希头、每头查表宽度 $d = 256$、采用组 32 的 INT8 存储（每行 256 字节量化码加 $8 \times 4 = 32$ 字节缩放，合计 $288\text{ B}$）。整表共 $10^8$ 行（约 $26.8\text{ GiB}$），本步批次仅处理 $T = 8$ 个 token：

| 维度 | 整表静态底存 | 本步实际查表命中量（示意） | 关键差异 |
|---|---|---|---|
| 行数 | $100{,}000{,}000$ 行 | $8 \times 4 = 32$ 行 | 每步只触达千万分之几的条目 |
| 数据量 | $\approx 26.8\text{ GiB}$（INT8 + FP32 缩放） | $32 \times 288\text{ B} = 9{,}216\text{ B}$（反量化为 `BF16` 占 $16\text{ KiB}$） | 访存极度稀疏，按命中行线性计费 |
| 归属与生命周期 | 模型只读权重，所有请求共用 | 单步瞬时中间结果，算完门控即释放 | 不像 KV cache 随上下文持续累积 |

正因为**底存极大、单步触达极少、内容全程只读**，把整张表硬留在昂贵的 NPU HBM 里极不划算：每张卡既要被几百 GiB 的大表挤爆显存，又要为极低密度的随机读付出高昂容量代价。反过来，Host DRAM 容量大、成本低，只要能避免“每步先把整表搬回 NPU”，就能把宝贵的 HBM 腾出来给 KV cache 和主干权重。

## Host DRAM 卸载、机内共享与 NPU 并行组（`etp` / `edp`）

昇腾上的 Engram 不是只有一种摆法，而是按显存预算、主机内存预算和设备拓扑形成四档渐进方案：

```wiki-diagram
file: engram-fig-offload-sharing
```

### 1. 为什么 `cpu_offload` 不用把整表拷回 NPU？

打开 `--engram-config '{"cpu_offload":true}'` 后，`AscendParallelEngramEmbedding` 不在 HBM 申请权重，而是通过 `HostUvaBuffer` 在主机内存分配表空间——这里依赖 **UVA（Unified Virtual Addressing，统一虚拟寻址，让 NPU 直接按统一指针访问钉页后的主机内存）**。随后它调用 CANN 运行时的 `aclrtHostRegisterV2` 将这段 Host DRAM 钉页注册，并用 `aclrtHostGetDevicePointer` 获取 NPU 可直接访问的设备地址（搭配 [CPU 绑核](cpu-binding.md) 时，`v0.30.0+` 会跳过页迁移 `migrate_memory=False`，避免移动钉页内存破坏 UVA 映射）。

由于 3.84 亿行级别的超大表会超出单个 Triton tile 的 32 位偏移表达范围，`npu.py` 按 `CHUNK_ROWS = 1 << 22`（每块 $4{,}194{,}304$ 行）把整表切成若干分块并发布一张**分块设备指针表**。前向时，NPU 上的 Triton 核 `gather_dequantize_host_uva` 直接拿这张指针表越过总线按行读取 Host DRAM、现场反量化成 `BF16` 写进 HBM——全程既不做整表 H2D 拷贝，也不需要 CPU 代劳查表。

### 2. `dp_shared_memory`（Gloo）与 NPU 并行组（`etp` / `edp`）的分工

多卡多副本部署时，Engram 面临两套互相牵制的分布式组（设备通信组与主机协调组的底层差异见 [CANN 与 HCCL](cann-hccl.md)）：

| 通信组 / 选项 | 底层后端与设备通信器 | 负责什么 | 适用前提与取舍 |
|---|---|---|---|
| `etp`（`embedding_across_dp=true`） | `HCCL`（设备通信） | 把嵌入表跨 `TP × DP` 联合切分（`main` 上在 `PCP > 1` 场景会重建真实 `TP × DP` 组覆盖上游 `_ETP` 回退） | 减少单卡分片，但每步需跨 DP 通信；不支持 `elastic EP` |
| `edp`（`dp_shared_memory=false`） | `HCCL`（`use_device_communicator=True`） | 把表头按同节点 `DP × PCP` 切分，每步先 `All-Gather` 哈希、再 `AllToAll` 交换命中行 | 要求 `n_hash_cols` 必须能被 `TP × EDP` 总分片数整除 |
| `edp`（`dp_shared_memory=true`） | **`Gloo`**（`use_device_communicator=False`） | 仅在启动时协调 POSIX `SharedMemory` 段名与加载同步；运行期各 DP/PCP 副本直接读同一份物理 Host DRAM | `dp_size` 在查表层视为 1，**免除每步 EDP 集合通信**，并解除跨 DP 头整除限制 |

这段分工解释了两个常被问到的现象：

- **为什么同机多 DP 副本必须开 `dp_shared_memory`？** 假设单台主机上跑了 $D$ 个本地 DP 副本，每份完整表的大小是 $E$。若每个副本各自调用 `HostUvaBuffer` 独立加载，主机 DRAM 会被复制成 $D \times E$。启用 `dp_shared_memory` 后，`SharedUvaBuffer` 由组内 leader 创建一份 **POSIX `SharedMemory`**（操作系统提供的跨进程共享内存段，映射在 `/dev/shm`，并尝试 `madvise(MADV_HUGEPAGE)` 申请透明大页）。其余同机副本只需 attach 同一段物理内存，并各自做 `aclrtHostRegisterV2`。于是主机底存立刻从 $4E$ 降到 $E$（以 4 副本计省下 $3E$）。同时，因为 `edp` 组只用于启动阶段交换共享内存名称，它直接走 CPU 侧 **Gloo**（PyTorch 的 CPU 分布式通信后端），既不消耗 HCCL 设备通信域缓冲，也不产生每步查表的跨 DP 集合通信。
- **为什么有时“不开共享连启动都会失败”？** `AscendParallelEngramEmbedding` 强校验头数均匀切分（`self.n_hash_cols % num_shards == 0`）。例如某配置有 24 个 Engram 头，而单台 A3 暴露 16 个逻辑设备（如 `DP4 × TP4` 或 `DP8 × TP2`）。若不开 `dp_shared_memory`，`TP × EDP = 16` 导致 $24 \div 16 = 1.5$ 无法整除，建层直接抛 `ValueError`。打开 `dp_shared_memory` 后，每个副本只按本副本的 `TP`（4 或 2）切分 24 个头，$24 \div 4 = 6$ 或 $24 \div 2 = 12$ 恰好整除，问题迎刃而解。此外，`v0.30.0` 与 `main` 在 [Model Runner V2](model-runner-v2.md) 下，只要启用 `cpu_offload` 且 `DP > 1` 或 `PCP > 1`，就会自动将 `dp_shared_memory` 置为 `True`（由 `AscendConfig.derive_and_validate` 推导）。这避免 MRV2 下空闲 DP 副本无哈希可做而卡死集合通信。

### 3. 跨实例共享（`main`：`shared_engram`）与两种传输路线

机内 `dp_shared_memory` 把“每副本一份”压成了“每台机器一份”。但在多机 P/D 分离集群里（拓扑分工见 [DeepSeek 生产实践](deepseek-serving-case.md)，例如 3 台 P 节点加 1 台 D 节点，共 4 台主机），如果每台机器还各自持有一份 ~200 GiB 的 Engram 表，全集群仍要吃掉 ~800 GiB Host DRAM，挤占 KVPool 缓存池。

`vllm-ascend@main`（`8d6180e2`）为此新增跨实例共享机制 `shared_engram`：由一个独立的常驻 **Owner 进程**加载唯一一份只读 Engram 表，所有 P/D 消费实例（Consumers）按校验通过的 checkpoint 指纹接入。由此，**消费实例本地贡献 0 字节整表 DRAM/HBM 容量**。按硬件互联能力，它分成两条完全不同的数据路径：A3 通过 MemFabric BM 提供 **GVA（Global Virtual Address，跨节点统一编址的全局虚拟地址空间）** 直接映射，A2/A5 则经 HIXL **RDMA（远程直接内存访问，绕开远端 CPU 直接从网卡/总线读写内存）** 显式按行拉取：

| 特性 | A3 路径（`backend: "a3"`，MemFabric BM GVA） | A2 / A5 路径（`backend: "a2" \| "a5"`，HIXL RDMA） |
|---|---|---|
| 表驻留与共享方式 | Owner 将 INT8（宽 256、组 32，缩放转 FP32）加载进 MemFabric BM Host DRAM；消费者经 `gva_to_va(..., LOCAL_DEVICE)` 一次解析为 NPU 指针表 | Owner 将 INT8（E8M0/FP32 缩放）或 FP8 E4M3（E8M0 缩放）留在普通 DRAM；为每个已连接读者分配有界钉页中转缓冲（`capacity ≤ 262,144` 行） |
| 运行期查表路径 | **远程指针直读**：现有 NPU Triton 核直接 load + 反量化进 HBM，无每步拷贝或 GVA 查询 | **显式按行拉取**：NPU 哈希 → CPU 拷贝 ID → TCP 发给 Owner → Owner CPU 汇聚命中行 → **HIXL READ**（A2 走设备 RoCE、A5 走设备 UB/URMA）写进消费者有界 HBM 缓冲 → NPU 反量化 |
| 多层打包优化 | 两层 Engram 共享同一进程级 BM 会话、各自使用独立 BM 对象 | 两层哈希拷贝在 TP 交换入队前完成；若两层总命中行数 $\le \text{capacity}$，单次 HIXL READ 打包拉回 |
| 前置硬约束 | **强制 Model Runner V2**；需含重复库修复的 MemFabric wheel（`cafd1251`）；先预热 AICPU 元数据算子防解码图捕获卡死；不支持 `dummy` 加载与 `sleep_mode` | 需编译 `libengram_hixl.so`；**强制 `--shutdown-timeout > 0`**（默认 `VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS=120`）确保优雅退租；A5 需传 `--local-comm-res` 指定 UB 资源 |

官方 `shared_engram.md` 记录了一组 4 台 A3 超节点实测（3 组 `DP4/TP4` Prefill + 1 组 `DP8/TP2` Decode，共 64 NPU，CANN 9.2 + torch-npu 2.10）。该集群由 1 个 Owner 持有 2 层表（4 个 BM HOST 对象），64 个 Worker 挂载 128 个层视图，**表底存从约 824 GiB 降至约 208 GiB**（4 份降为 1 份，见上图比例条）。测试中 1440/1440 请求零错误完成，各长度桶 QPS 与原生机内卸载基本持平；但 20–40K 桶两者 TTFT P50 均未达 7s 目标，且该数字仅计表底存，不等同总系统内存或总 HBM。

### 4. 与 RFork 权重快载的协同边界（`main`）

当模型启用 [RFork 权重快载](rfork.md) 时，跨节点 NPU HBM 传输只搬运设备侧主干权重，不把几百 GiB 的主机 Engram 表也塞进设备传输域。`vllm_ascend/model_loader/rfork/local_weights.py` 在 `main` 上专门为 `cpu_offload=True` 的 `AscendParallelEngramEmbedding` 做了三段协同：

1. **本地独立填表**：加载前由 `load_local_weights` 从本地存储独立填满 Host 表，并记录弱引用与地址指针；
2. **豁免网络登记**：随后由 `get_local_tensor_ids` 将已就绪的 Host 表张量豁免于 RFork 传输登记；
3. **安全回退释放**：若 RFork 失败回退，由 `release_local_weights` 仅对归属当前模型的表调用 `close_host_offload` 释放钉页映射，防止草稿模型误释放与主模型共享的表存储。

## 常见误解

- **“把 Engram 卸载到 CPU，就能把请求的 KV cache 也顺带卸载到主机内存。”** 不对。Engram 是所有请求共用的只读权重表，KV cache 是每条请求随上下文增长的动态历史状态；两者内容、生命周期和卸载开关完全独立（动态 KV 的主机卸载见 [KV Cache CPU 卸载](kv-cache-cpu-offload.md)），开启 `cpu_offload` 不会搬动 KV cache，也不会免除主干权重与算子的 HBM 占用。
- **“开了 `dp_shared_memory`，整个 P/D 集群就只存一份 Engram 表。”** 不对。`dp_shared_memory` 基于单机 POSIX `/dev/shm` 与节点内 `Gloo` 组，只做到**每台机器一份**；跨多台主机把表合并为全集群一份，需要 `main` 的跨实例 `shared_engram`（MemFabric BM 或 HIXL RDMA）。
- **“多副本共享一份主机内存，总线读取带宽和查表计算也就合并成一份了。”** 不对。共享省的是主机 DRAM **容量**与启动时的重复加载；运行期每个 DP 副本处理的 token 不同，各自的 NPU 仍要独立发起查表、反量化和 TP 归集，跨总线带宽需求与并发查表量仍按副本叠加。
- **“在 A2/A5 上启用 HIXL `shared_engram` 必须关掉解码图模式，或者直接强杀消费者进程也没关系。”** 都不对。HIXL 查表在解码图回放之前执行，无需关闭解码图模式；但消费者异常断连或无超时强杀会导致 Owner 保守保留孤儿租约（因 TCP EOF 无法证明在途 RDMA 已结束），因此必须配置 `--shutdown-timeout > 0` 并先停消费者再停 Owner。
- **“只要看到 `cpu_offload` 打开，就一定避免了所有 NPU 通信。”** 不对。即便表在 Host DRAM，表仍按 TP 分片存放，单步查完命中行后依然需要 `tensor_model_parallel_all_gather` 拼齐全部头，且若未开 `dp_shared_memory`，`EDP` 组仍会走 HCCL 集合通信。

## 对照源码

### 怎么开

1. **单机 Host DRAM 卸载与机内 DP 共享（`v0.30.0` 及 `main`）**
   容器必须共享主机 IPC 命名空间（`--ipc=host`）并保证 `/dev/shm` 足够容纳完整单机表与对齐开销，启动 `vllm serve` 时传入：

   ```bash
   --engram-config '{"cpu_offload":true,"dp_shared_memory":true}'
   ```

   在 `v0.30.0` 与 `main` 上，`cpu_offload` 缺省读取环境变量 `VLLM_PLE_CPU_OFFLOAD`（上游默认启用）；`dp_shared_memory` 要求 `cpu_offload=True`，且须具备 `DP > 1` 或 `PCP > 1`（`patch_engram_config.py` 将上游仅校验 `DP > 1` 的检查放宽为 `DP > 1` 或 `PCP > 1`，同时移除上游 CUDA-only 限制）。Model Runner V2 下，只要 `cpu_offload=True` 且 `DP > 1` 或 `PCP > 1`，`AscendConfig.derive_and_validate` 会自动开启 `dp_shared_memory`。

2. **跨实例共享池（仅 `main`）**
   - **A3（MemFabric BM GVA）**：先在独立监督进程启动 Owner，等待日志输出 `POOL_READY`（Owner 与消费实例须使用同一不可变 checkpoint，且消费端强制 Model Runner V2）：
     ```bash
     python -m vllm_ascend.shared_engram \
       --backend a3 --model /models/immutable-checkpoint \
       --endpoint OWNER_ADDRESS:29500 --device 0
     ```
     各消费实例在保持 `--engram-config '{"cpu_offload":true,"dp_shared_memory":true}'` 的同时，向 `--additional-config` 合并：
     ```json
     {"shared_engram":{"backend":"a3","endpoint":"OWNER_ADDRESS:29500"}}
     ```
   - **A2 / A5（HIXL RDMA）**：先编译 `libengram_hixl.so`，启动 Owner（`--backend a2` 或 `--backend a5` + `--fabric ub|roce`，配 `--engine-endpoint` 与 `--listen-port` 或 `--local-comm-res`）；消费端须设 `--shutdown-timeout > 0`，并向 `--additional-config` 合并 `shared_engram`（含 `backend`、`endpoint`、`capacity`、`library_path`，A5 另传 `local_comm_res`）。停服时严格遵守**先停流量与全部消费者、确认退出后再停 Owner**。

### 会报什么错

| 触发条件 | 源码检查与报错信息 | 排查入口 |
|---|---|---|
| `dp_shared_memory=True` 但 `cpu_offload=False` | `ValueError: dp_shared_memory requires cpu_offload=True` | 检查 `--engram-config` |
| 单卡单副本开 `dp_shared_memory` 或同开弹性 EP | `ValueError: dp_shared_memory requires data_parallel_size > 1 or prefill_context_parallel_size > 1.` / `...not supported with elastic EP.` | 核对 `DP / PCP` 与 `enable_elastic_ep` |
| 头数无法被 `TP × EDP` 均分 | `ValueError: Engram requires uniform head shards: ... cannot be divided over ... TP x EDP shards. Use a divisible topology or enable dp_shared_memory.` | 调整 `TP` 或启用 `dp_shared_memory` |
| TP 或 EDP 跨节点 | `ValueError: Ascend Engram requires the TP ranks of one replica to stay on a single node` / `...all DP replicas to share the same node and shared-memory namespace` | 核对节点拓扑与 `--ipc=host` |
| A3 `shared_engram` 缺 MRV2、传了 A2/A5 字段或同开 `sleep_mode` / `dummy` | `shared_engram requires Model Runner V2` / `A3 does not accept A2/A5 shared Engram options` / `Shared host Engram does not support dummy loading or sleep mode` | 核对 `VLLM_USE_V2_MODEL_RUNNER=1` 与配置字段 |
| A2/A5 `shared_engram` 未设退出超时或 `capacity > 262144` | `shared_engram requires --shutdown-timeout > 0 to retire reader leases` / `shared Engram capacity must be in [1, 262144]` | 加大 `--shutdown-timeout` 并核对 `max_tokens × local_heads` |
| CANN 主机内存钉页失败 | `RuntimeError: aclrtHostRegisterV2 failed: rc=...` | 核对 `/dev/shm` 上限、容器 `IPC`、宿主机锁定内存限额（`ulimit -l`） |

### 开销和什么时候别开

- **Host DRAM 与 `/dev/shm` 账目须单算**：卸载只是把数百 GiB 的表从 HBM 搬到 Host DRAM，部署前须把 Engram 唯一底存、Owner 读者中转缓冲（HIXL 按已连接读者数叠加）、KVPool 与系统进程内存分开核算；`dp_shared_memory` 共享段不可按 worker 数重复乘算。
- **不适用场景**：需要 [Sleep Mode](sleep-mode.md)（`sleep_mode`）或 `dummy` 加载验证的场景不能开启 A3 `shared_engram`；缺少可信内网隔离的集群需注意控制面 TCP 协议不做鉴权与加密；未完成 `cafd1251` 打包修复的旧版 MemFabric wheel 在进程退出时可能重复加载原生库导致中止；A2/A5 无法保证消费者优雅退出（或无法预留独立 HIXL 监听端口）时，不要启用 HIXL 跨实例共享。
- **辅助流重叠开关**：`additional_config.multistream_engram_overlap` 可将哈希、查表与 DP/TP 交换放到辅助流提前准备，但实际收益与解码图配合仍须在目标负载上实测。

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| Engram 模块与配置补丁 | 无（0 个相关文件） | 无（0 个相关文件） | 完整引入 `models/deepseek_v41/engram/`、`ops/triton/engram_*.py` 与 `patch_engram_config.py`（共 23 个文件） | 扩展至 39 个文件，新增跨实例共享与生命周期/RFork 协同 |
| 并行组初始化（`etp` / `edp`） | 无 | 无 | `parallel_state.py` 仅在 `PCP > 1` 时建 `edp` 组（共享用 `gloo`、非共享用设备后端），未单独重建 `_ETP` | 新增 `etp` 组重建（`embedding_across_dp` 且 `PCP > 1` 覆盖上游 `_ETP` 回退），并放宽 `PCP == 1` 下 `dp_shared_memory` 的 `edp` 建组条件 |
| Host DRAM 卸载与机内共享 | 无 | 无 | 支持 `HostUvaBuffer`、`SharedUvaBuffer`（POSIX `SharedMemory` + `aclrtHostRegisterV2`）、MRV2 多 DP/PCP 自动开启 `dp_shared_memory` | 保留并新增 `HOST_OFFLOAD_STORAGE_ATTR` 挂载，防止逐层 reload 把卸载表重建回 NPU 导致 OOM |
| 跨实例共享（`shared_engram`） | 无 | 无 | 无（无 `shared_pool.py` / `shared_rdma.py` / `SharedEngramConfig`） | 新增 A3 MemFabric BM GVA（`shared_engram.md`）与 A2/A5 HIXL RoCE/UB RDMA（`shared_engram_rdma.md`），含 `csrc/engram_hixl/native.cpp` |
| RFork 宿主表协同 | 无 | 无 | 无 `model_loader/rfork/local_weights.py` | 新增 `local_weights.py`，实现本地独立加载、弱引用就绪豁免与安全回退释放 |

### 源码位置

| 机制环节 | 固定源码与文档锚点 |
|---|---|
| 上游 `EngramConfig`、字段默认与校验 | `vllm@ced6857a:vllm/config/engram.py#L18-L115` |
| 昇腾配置补丁（解除 CUDA 限制与放宽 `PCP > 1`） | `vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engram_config.py#L19-L45` |
| `etp` 与 `edp`（Gloo vs HCCL）并行组初始化 | `vllm-ascend@c09d3e20:vllm_ascend/distributed/parallel_state.py#L79-L107`；`vllm-ascend@8d6180e2:vllm_ascend/distributed/parallel_state.py#L80-L137` |
| N-gram 哈希状态、SWA 槽位适配与死标记过滤 | `vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/hash_state.py#L31-L105` |
| `EDP` 哈希汇集（含 A5 recompute 固定槽位）与 `AllToAll` 换行 | `vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/parallel.py#L22-L96` |
| 按头分片嵌入表、Host UVA 卸载、重载保宿与前向查表 | `vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/embedding.py#L51-L120`、`#L345-L405`；`vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/embedding.py#L100-L175`、`#L220-L335` |
| `HostUvaBuffer` / `SharedUvaBuffer`、`CHUNK_ROWS` 与 INT8 量化 | `vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/engram/npu.py#L25-L69`、`#L156-L215`、`#L296-L360` |
| `AscendEngram` 投影与门控融合 | `vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/engram/layer.py#L14-L57` |
| Triton 算子职责与 A3/A5 硬件边界 | `vllm-ascend@c09d3e20:vllm_ascend/ops/triton/docs/engram.md#L1-L36` |
| `SharedEngramConfig` 校验与 MRV2 自动共享推导 | `vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L457-L491`、`#L795-L819` |
| RFork 宿主 Engram 表本地加载、豁免与释放 | `vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/local_weights.py#L1-L97` |
| 跨实例共享用户指南（A3 MemFabric BM 与 A2/A5 HIXL RDMA） | `vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/shared_engram.md#L1-L189`；`shared_engram_rdma.md#L1-L86` |

**证据与边界索引：** 论文结构动机见 [S1]；上游配置与字段定义见 [C2]，昇腾补丁见 [C3]；`etp` / `edp` 建组与 Gloo 分支见 [C4][C11]；哈希计算、跨副本换行、分片查表与门控融合见 [C5][C6][C7][C8][C9]，Triton 算子硬件路由边界见 [S10]；`HostUvaBuffer`、`SharedUvaBuffer`、重载保护与 `SharedEngramConfig` 校验见 [C12][C13][C14][C15][C16][C17][C18]；RFork 宿主表协同见 [C19]；A3 4 机 824 GiB → 208 GiB 实测对照与 A2/A5 HIXL 数据路径及停服要求见 [S20][S21]。正文 $H=4, d=256, 10^8$ 行与 $4E \to E$ 为教学示意推导 [A][D]；本轮未在真实昇腾硬件上复跑端到端压测。
