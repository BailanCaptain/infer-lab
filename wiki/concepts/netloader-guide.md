---
id: netloader-guide
title: Netloader Guide：新实例怎样从已有 NPU 接过权重
type: feature
legacyAnchors:
  glm-双机这套部署会走-netloader-吗: 主模型和草稿通道怎样匹配分片
  复杂异构与多机边界对照ep16-异构分片与-mtp-草稿通道限制: 主模型和草稿通道怎样匹配分片
summary: >-
  Netloader 在启动时从已有实例的 NPU 接收同一分片的权重，省去重复读取权重文件。解释握手、逐张量传输、量化缓存、失败回退、v0.30.0 /
  main 的推理布局直传，以及跨机 EP 与 MTP 草稿模型的加载边界。
aliases:
  - NetLoader
  - Netloader Guide
  - NetLoader P2P
  - P2P
  - P2P 权重加载
  - 网络权重加载
  - 网络加载器
  - ModelNetLoaderElastic
  - INT8_CACHE
  - disk_fallback_loader_extra_config
chapters:
  - '19'
order: 35
sources:
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/netloader.md#L7-L97
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/netloader.md#L34-L98
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md#L237-L341
  - >-
    vllm-ascend@db701c1f:vllm_ascend/model_loader/netloader/netloader.py#L58-L437
  - >-
    vllm-ascend@db701c1f:vllm_ascend/model_loader/netloader/interaction/elastic.py#L61-L422
  - >-
    vllm-ascend@db701c1f:vllm_ascend/model_loader/netloader/executor/elastic_load.py#L50-L161
  - 'vllm-ascend@db701c1f:vllm_ascend/model_loader/netloader/load.py#L25-L77'
  - 'vllm@0fc695fc:vllm/config/load.py#L25-L34'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/model_loader/netloader/netloader.py#L58-L437
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/model_loader/netloader/netloader.py#L58-L437
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/netloader/netloader.py#L118-L771
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/netloader/interaction/elastic.py#L450-L521
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/netloader/executor/elastic_load.py#L33-L646
  - >-
    raw:sha256-7bd72802edac08cf070a7be6ccb1aab69ab073de980d079ede56d74241d8f788.md#L1-L3002
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/netloader/utils.py#L24-L46'
  - >-
    vllm-ascend@7d825229:vllm_ascend/model_loader/netloader/netloader.py#L741-L765
  - 'https://github.com/vllm-project/vllm/pull/16226'
  - >-
    https://github.com/vllm-project/vllm/commit/6f0dd93801163a6418695c6dc0b43c516261f55a
  - >-
    vllm@0fc695fc:vllm/distributed/device_communicators/shm_broadcast.py#L103-L215
  - >-
    vllm@0fc695fc:vllm/distributed/device_communicators/shm_broadcast.py#L665-L717
  - >-
    https://www.hiascend.com/doc_center/source/zh/canncommercial/900/API/hcclug/hcclenvref_07_0005.html
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/netloader/utils.py#L24-L46'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/netloader/netloader.py#L741-L765'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/netloader/utils.py#L24-L46'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/netloader/netloader.py#L741-L765'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 挂靠启动时加载权重这一站，固定双机部署仍走存储加载
  - to: quantization
    kind: builds-on
    note: 理解原始 int8 权重为何需要保留，以及加载后处理会改变什么
  - to: tensor-parallel
    kind: builds-on
    note: Netloader 搬已有分片，分片怎样产生由 TP 页解释
  - to: rfork
    kind: alternative-to
    note: 对比显式来源地址与 RFork 的 seed 发现和租约机制
  - to: platform-plugin-registration
    kind: builds-on
    note: 区分加载器注册可用与启动时实际选中加载器
  - to: rfork-config
    kind: alternative-to
    note: 两页分别说明启动时复用已有实例权重的两种加载方案：Netloader 显式配置候选来源，RFork 通过 Planner 撮合来源并管理租约。
  - to: rfork-transfer
    kind: alternative-to
    note: >-
      两页描述启动时从已有实例复制权重的不同传输方案：Netloader 建立临时 HCCL 通信组逐参数收发；RFork
      接收端登记内存、核验清单后按地址分批读取。
  - to: rfork-startup
    kind: alternative-to
    note: >-
      两者都是启动阶段复用已有实例权重的加载方案：Netloader 按配置连接供方并传输权重，RFork 先准备本地模型，再向 Planner 申请
      seed 租约并读取权重；失败时均可回退到普通存储加载。
  - to: rfork-lifecycle
    kind: alternative-to
    note: >-
      两页涉及启动时从已有实例复用权重的不同方案：Netloader 显式配置来源并建立临时 HCCL 通信组；RFork 先向 Planner
      领取租约，传输后后台归还，确认归还后才能发布为 seed。
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-2acbcbacef9fb5d918586a7117773ea6ff7a1b1456031c15164a1c3eaaaf9a1b.md
  - >-
    raw/sha256-7bd72802edac08cf070a7be6ccb1aab69ab073de980d079ede56d74241d8f788.md
---

## 已有一张卡装好了模型，新实例还要从文件重读吗？

**NetLoader 是启动阶段的 P2P（Peer-to-Peer，点对点）卡间权重加载器：新实例直接向已经装好相同模型分片的旧实例请求权重，绕开重复读盘，通过卡间网络把这些数直接从旧 NPU 复制到新卡自己的模型里。** 权重就是模型计算所用的参数；这里的 server 是供权重的旧实例，client 是取权重的新实例，两者也都可以运行推理服务。

```wiki-diagram
file: netloader-guide-intuition
```

一线选型先抓住三条核心判断：

- **什么时候用与按阶段回退边界**：已有同构实例在线（相同模型路径与相同 `TP`/`PP` 分片）时，用 `--load-format netloader` 省去重复读盘。回退按角色与阶段区分：未配 `SOURCE` 的首个供方直接走 `DefaultModelLoader` 读盘；接收方外层配置非字典或缺少必需键会在进入回退前直接报错，TCP 握手不匹配则轮询下一个候选 `SOURCE`，而一旦建起 HCCL 组进入接收后失败则清理并回退 `DefaultModelLoader`（供方监听启动失败不影响供方自身模型继续运行）。
- **和 [RFork](rfork.md) 怎么选**：NetLoader 靠 `--model-loader-extra-config` 静态列出候选 `SOURCE` 地址，为每对供需 rank 建 2 进程临时 HCCL 组逐张量收发；RFork 由中央 Planner 自动发现 seed、发租约并按内存地址分批直读，适合弹性集群大规模自动扩缩。
- **版本主线差异**：`v0.30.0` 主基线（与 `main` 一致）在默认 `INT8_CACHE="no"` 下**直接传输加载后处理完成的推理布局**，握手新增缓存模式与 `transfer manifest` 张量清单核对，且回退磁盘时保留多线程加载参数；`v0.23.0` / `v0.26.0rc`（含例外 B 的 GLM 镜像 `db701c1f`）则在加载后处理前接收参数，量化模型需额外区分原始 int8 缓存。

这一步发生在 [NPUWorker 启动生命周期](npu-worker-lifecycle.md) 的权重加载阶段（对应双机案例的[启动流程第四步](glm-5-3-flash-two-node.md#启动时发生了什么)）：加载完权重才轮到估算可用显存、分配 KV cache（保存请求历史计算结果的缓存）和预热录图。等请求开始生成 token（文本切成的小片段）时，Netloader 的接收工作早已结束。

## 为什么值得从另一张卡取，代价落在哪里？

**节省的是重复读权重文件的工作，新增的是建链、卡间传输，以及供方为传输保留的资源。** 官方指南将扩容、恢复服务和减轻集中存储压力列为使用场景，但没有给这套 GLM 部署的加载加速倍数。

这条路径实际为一对供方、接收方建立一个 **2 进程的临时通信组**，用 HCCL（昇腾卡间通信库，通信域缓冲与建链超时边界见[昇腾运行时与调优](ascend-runtime-and-tuning.md)）发送和接收张量。张量就是带形状的一组数。源码允许供方在后台线程里发送，同时继续推理；发送线程与在线推理共享同一张 NPU 的显存带宽和通信资源，高并发下会产生带宽争用，具体影响幅度留待实机测量。

它不是每层前向都加一次通信。通信集中在启动加载阶段：先建立连接，再按参数顺序搬运；旧版每发或收一个参数都等待该次操作完成，最后还做一次 barrier（组内两端都到达后才继续的同步）。接收方要等这些权重齐备，才能沿启动流程继续走。建 HCCL 连接还需预留额外片上内存。Netloader 指南提到的 **200 MB** 是缓冲配置的默认量级，不能当成一个进程的总开销；CANN 9.0 的对应条目将每通信域的收、发缓冲合计描述为该配置值的两倍，实际还要考虑通信域数量与覆盖设置。

相邻机制处理的对象不同：默认加载器从模型文件取权重；Netloader 从已有卡取权重；[KV Pool](kv-pool.md) 复用的是请求历史缓存；[RFork](rfork.md) 同样复用已有权重，但它有自己的来源发现和租约流程。启用其中一个，并不会自动启用另一个。

## 一份权重怎样从旧卡走到新卡？

**先确定“要找哪一个分片”，再握手，最后让双方按相同顺序发送和接收参数。** Worker 是负责模型执行的进程；rank 是它在分布式通信中的进程编号。一个物理设备的编号和这个 rank 是两回事。

以两个同构实例为例，新实例的 rank 0 应向旧实例中负责同一分片的 rank 0 取权重，其他 rank 也各找各的来源。新实例先按自己的模型配置创建参数空位，然后通过 TCP（普通网络连接）告诉供方自己的 rank、模型路径以及 TP、PP 大小。TP 把矩阵分给多卡，PP 把模型层分给不同阶段，具体划分见 [TP](tensor-parallel.md) 和 [PP](pipeline-parallel.md)。

供方逐项比较这四项；相同才回复同意，双方随后建立临时 HCCL 通信组。**这是身份和分片配置的检查，不是权重内容校验。** 在 `v0.30.0` 与 `main` 中，握手额外核对 `INT8_CACHE` 缓存模式与 `transfer manifest`（张量名称与元素个数清单），但仍不包含模型文件哈希或逐字节校验；历史 `v0.23.0` / `v0.26.0rc`（含 `db701c1f`）则连缓存模式和张量清单也没有。两边路径相同而文件内容不同，不能靠这一关发现；换了并行划分，也没有重新切片功能帮它适配。

模型路径比较的是路径字符串。因此，即使两端模型文件内容相同，只要路径字符串不同，也不能通过这一项检查。下图按同分片协议流汇总了四个关键环节：TCP 握手与分片核对、rank 对 rank 建临时 HCCL 组搬运、`INT8_CACHE` 三轨布局分流，以及失败后经 `disk_fallback_loader_extra_config` 保留多线程键回退磁盘：

```wiki-diagram
file: netloader-guide-fig-p2p-broadcast
```

接收过程可以用一个很小的张量账说明。假设同一分片有一个形状为 [2, 3] 的 int8 权重矩阵，即 2 行、每行 3 个一字节整数，还有长度为 2 的 FP16 缩放参数，即两个两字节浮点数。两端都按“矩阵、缩放参数”遍历，先把矩阵送进同形状空位，再送缩放参数；以下仅演示数据量，模型与形状均为教学假设。

```wiki-diagram
file: netloader-guide-tensors
```

按张量顺序搬运两个张量时，有效载荷等于各张量元素个数乘各自字节宽度之和（教学示意）：

$$V_{\text{payload}} = (2 \times 3 \times 1\text{ B}) + (2 \times 2\text{ B}) = 6\text{ B} + 4\text{ B} = 10\text{ B}$$

| 搬运张量（同一分片示意） | 形状与精度 | 有效载荷 |
| --- | --- | --- |
| 权重矩阵 | `[2, 3]`，int8（1 B/数） | $2 \times 3 \times 1\text{ B} =$ **6 B** |
| 缩放参数 | `[2]`，FP16（2 B/数） | $2 \times 2\text{ B} =$ **4 B** |
| **有效载荷合计** | 按遍历顺序依次收发 | **10 B** |

这里的 10 B 只是两个张量的有效载荷，连接状态、传输协议和通信缓冲另外占资源。接收不会改变矩阵值，也不把矩阵切成另一种形状。实际旧版发送器跳过名字含特定输入缩放标识的参数，接收器跳过零维参数；双方过滤规则不同，因此还依赖模型加载前后的参数集合与顺序相容。

来源地址可以为一个 rank 配多个候选。TCP 连接或注册失败时会继续试下一个；**已经选中供方、开始 HCCL 传输后失败，则返回默认加载路径**，不会在这次传输函数里接着轮询剩余供方。没有给当前 rank 配来源也直接从存储加载。这意味着第一批实例可以不配来源，先读盘成为供方；接收成功的新实例也会尝试开监听，供后来者继续取权重。

## 量化权重为什么还需要留一份原始缓存？

[Quantization](quantization.md) 的加载后处理会执行转置、设备布局转换或构造派生张量，使“推理布局”不再等同于“刚读文件时的原始参数”。围绕 `INT8_CACHE`（四版默认均为 `"no"`），代码分出三条截然不同的布局与缓存路径：

1. **`v0.30.0` / `main` 默认 `INT8_CACHE="no"`（后处理推理布局直传）**：直接按登记的 `transfer manifest` 发送已完成加载后处理的推理布局，省去额外原始副本（详见[版本差异](#版本差异)）。
2. **`v0.23.0` / `v0.26.0rc` 默认 `INT8_CACHE="no"`（旧版无缓存原始接收）**：接收方在加载后处理之前收参数；若供方权重已被原地改成推理布局再发过去做二次后处理，结果就可能偏离，因此旧版指南提示量化模型不宜裸跑 `no`（不能拿新版推理布局直传反推旧版）。
3. **显式手工开启 `INT8_CACHE="hbm"` 或 `"dram"`（原始 int8 副本缓存）**：供方在量化后处理之前按配置把命中的原始 int8 参数另存一份在 NPU HBM 或宿主机 DRAM（主机 DRAM 容量与跨总线搬运边界见[主机内存与大页](host-memory-and-hugepages.md)），未命中的参数仍发模型当前值，接收方收齐后再跑自己的加载后处理。原始缓存只覆盖匹配参数而非全模型快照，启用后仍须核验模型与量化路径兼容性。

## 主模型和草稿通道怎样匹配分片

单卡 `Qwen3-8B` 扩容新副本时，供需两端只有一个 `rank 0`、也只有主干一套模型；放到带跨机专家并行与投机草稿层的多机实例上，就必须核对**分片同构性**与**双通道缓存规则**（例外 B 的 [GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)官方在线配方未选择 `--load-format netloader`，默认从本地文件加载权重）：

若要在扩容第二套 `DP2 + TP8 + EP16` 双机实例时接入 Netloader，有两处容易踩坑的边界：

1. **同一套双机的两台节点不能互当供方**：虽然两台机器对应卡上的 attention 与稠密层 `TP8` 分片相同，但 `EP16` 把 288 个专家拆成了 16 份互不相同的专家分片，两机的全局 `rank`（`0–7` 与 `8–15`）也不同（见[双机分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)），且两机冷启动时尚无已就绪权重。因此扩容时必须另有一整套**已加载完毕的 16 卡同构实例**，让新实例 `rank k` 一对一指向旧实例 `rank k`。
2. **`W8A8 + MTP` 草稿模型的双通道与强制 `hbm` 缓存**：开启 [MTP 投机解码](speculative-decoding.md) 后，旧版实现把主模型与 draft（草稿层）拆成两条独立的加载和监听通道（draft 监听端口在基础端口上再加 `+10000`），且主模型加载后、进入 draft 前设有同步屏障。**更关键的是，在旧版原始 `int8` 缓存路径下，只要 `INT8_CACHE` 不为 `"no"`，draft 供方的缓存模式就会被强制改写为 `"hbm"`——哪怕用户配的是 `"dram"`，也会优先在 NPU HBM 中另存一份草稿原始副本**（仅默认 `"no"` 不触发改写；HBM 复制失败后的降级行为见下文[开销](#开销和什么时候别开)）。因此启用前必须同时核对主模型与草稿通道的端口预留、输出一致性及额外显存余量。

## 哪些理解容易把它用错？

- **“装了插件就从网络加载。”** 注册只让加载器可被选择；启动时还要明确选它。GLM 教程没有选。
- **“同一个模型名字就能混用分片。”** 旧版比的是模型路径字符串、rank、TP、PP；调用服务时展示的名字不参与这次核对，握手也没有验证权重文件内容。
- **“来源列表会把权重分散到多台同时下载。”** 旧版顺序尝试连接，选择一个可注册的来源；HCCL 传输失败后回默认加载。
- **“服务起来就证明网络加载成功。”** 默认加载回退也能把服务启动起来。要把接收成功日志、回退日志和加载耗时放在一起看。
- **“从别卡借权重就不占本卡显存。”** 本卡仍保存一份可用于推理的权重；供方开启原始 int8 缓存时还要另存一份副本。

## 对照源码

### 怎么开

用 `--load-format netloader` 选加载器，配置放在 `--model-loader-extra-config` 的 JSON 对象里，不属于 additional_config。先按官方指南的单卡例子理解两端：供方不配 SOURCE，读文件后开监听；接收方配置供方日志里公布的 Netloader 地址。`--port` 是推理 API 端口，LISTEN_PORT 才是权重服务的基础端口。

以下是面向 `v0.30.0` 主基线的 Linux/NPU 配置形式示例（以单卡 `Qwen3-8B` 演示供需两端命令写法，未在设备上执行）。假定两个进程各占一张独立 NPU、同一模型路径 `/models/Qwen3-8B` 可访问，不开草稿模型；`<供方IP>` 换成供方实际地址。旧版官方指南曾额外附带 `VLLM_SLEEP_WHEN_IDLE=1`（早期减少空闲 CPU 忙等的旧开关，上游 PR #28053 已删除，详见后文），因此下面不再加入该过时变量。

```bash
# 供方：当前机器的物理卡 0；不配 SOURCE，先从磁盘加载并监听 19000
ASCEND_RT_VISIBLE_DEVICES=0 \
vllm serve /models/Qwen3-8B --tensor-parallel-size 1 --enforce-eager \
  --port 8000 --load-format netloader \
  --model-loader-extra-config '{"LISTEN_PORT":19000}'

# 接收方：同机示意用另一张物理卡 1，进程分布式 rank 仍是 0
ASCEND_RT_VISIBLE_DEVICES=1 \
vllm serve /models/Qwen3-8B --tensor-parallel-size 1 --enforce-eager \
  --port 8001 --load-format netloader \
  --model-loader-extra-config '{"SOURCE":[{"device_id":0,"sources":["<供方IP>:19000"]}],"LISTEN_PORT":20000}'
```

| 字段 | 默认值和实际作用 |
| --- | --- |
| SOURCE | 默认无来源；数组中的 device_id 对应 `torch.distributed.get_rank()`，sources 是该 rank 的候选地址列表 |
| MODEL | 默认取模型路径并记日志；旧版和本页 main 实际传给握手及服务端的是 `model_config.model`，不能靠它给不同路径起共同别名 |
| LISTEN_PORT | 默认随机取空闲端口；显式值作为基础端口，再加 rank；draft 再加 10000 |
| INT8_CACHE | 默认 no；hbm 保存原始 int8 显存副本，dram 保存主机副本；draft 供方只要不是 no 就强制用 hbm（包括配置 dram 时）；非法值回到默认，字符串会转小写 |
| INT8_CACHE_NAME | 默认不筛选 int8 参数；列表元素按转义后的子串匹配参数名，并非只做全名精确匹配 |
| OUTPUT_PREFIX | 默认不输出；主模型把地址写入“前缀 + rank + .txt”；不为 draft 另写文件 |
| CONFIG_FILE | 默认不用文件；成功读入文件后使用整份文件配置，**不与命令行 JSON 逐键合并**；文件读失败才尝试命令行配置 |

上述是实现口径。官方表格将 MODEL 写成一致性检查名称、将文件优先级描述成 SOURCE 覆盖；具体行为应看 `netloader.py:77–125、275–283、361–372`。额外配置以及配置文件都应填写 JSON 对象；字段校验不足以兜住所有畸形嵌套值。

固定提交的来源筛选还要求匹配本进程的条目提供 sources 列表；即使 device_id 匹配，空列表也没有可用地址。缺少 sources 字段时，条件表达式会直接读取不存在的字段，不能把它当作会安全忽略的无效条目。

端口也要按实现读：旧版先检查基础值是否属于 `range(1024, 65535)`，即 1024 到 65534，再加 rank 和 draft 偏移，没有对加完的结果二次校验。为带 draft 的部署预留完整的“基础端口 + 最大 rank + 10000”范围。官方 main 指南提示基础端口低于 55535 并计入 rank；main 增加了最终端口越界检查，但不能据此认为旧版也会提前挡住。

### 会报什么错

以下均来自 GLM 固定提交 `db701c1f`，路径前缀为 `vllm_ascend/model_loader/netloader/`。带占位符的字符串按源码原样列出，花括号中的变量在运行时替换。

| 原文 | 文件与行号 | 触发条件、接下来会怎样 |
| --- | --- | --- |
| `NetLoader requires --model-loader-extra-config to be a JSON object.` | netloader.py:72–75 | 外层不是字典，构造加载器时抛 RuntimeError，尚未进入回退 |
| `CONFIG_FILE not found` | netloader.py:82–83 | 文件不存在，记录错误后尝试命令行额外配置 |
| `CONFIG_FILE is not a valid JSON file` | netloader.py:84–85 | 文件 JSON 解码失败，处理同上 |
| `Did not get valid source info, use DefaultModelLoader` | netloader.py:230–243 | 当前 rank 没有有效来源项；正常首个供方也可能打印这条警告 |
| `Received data {client_desc} does not consist with this server {server_desc}` | interaction/elastic.py:376–391 | rank、路径、TP 或 PP 不匹配，服务端回复拒绝；客户端可继续尝试候选来源 |
| `Failed to recv model: %s` | executor/elastic_load.py:93–98 | 建 HCCL 组或接收阶段异常，记录原因并清理，返回失败 |
| `Netloader elastic loading fails, use load format DefaultModelLoader` | netloader.py:288–309 | 网络加载返回失败，清理后改从文件加载；不能将这条当成功接收 |
| `Failed to start Netloader server for rank: %s, details: %s` | netloader.py:359–379 | 监听绑定或服务构造失败；已有模型仍继续启动，但这一供方监听没有成功 |

日志中的 `Finish recv` 位于 executor/elastic_load.py:91，表示该接收函数完成；`Finish elastic load (duration: %ss)` 位于 load.py:73，才是外层确认拿到模型。二者仍不能替代输出一致性检查。监听启动失败和本次权重接收失败属于两个阶段，应分开排查。

### 开销和什么时候别开

加载时间可拆成连接与握手、建 HCCL 组、逐张量搬运、加载后处理以及其余启动步骤。要判断收益，分别量这些耗时，并与同模型、同并行划分的默认文件加载比较；官方建议用 temperature 为 0 的相同请求比较输出。本页没有设备耗时和精度实测。

供方开启 hbm 缓存后，要额外容纳被选中 int8 参数的副本；复制失败时旧版会尝试降为 DRAM。dram 模式减少该副本的显存常驻量，却增加发送前的主机到设备搬运。即便不缓存，也还有通信组、临时连续化和运行时状态的代价；显存预算应重新测量，入口见[双机显存预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

通信缓冲变量的正确拼写是 HCCL_BUFFSIZE。CANN 9.0 文档规定其取正整数、默认 200、单位 MB；每通信域收发缓冲合计按两倍配置值计，若通过 HcclCommConfig 指定域级缓冲，则域级设置优先。Netloader 指南写成 HCCL_BUFFERSIZE；不能照抄这个拼写。GLM 固定教程实际设置 HCCL_BUFFSIZE=1024，因此也不能把默认 200 当作该教程的配置值。这里引用的是文档口径，设备上最终分配与额外通信域仍须计入实测。

没有同构供方、文件加载已经很快、供方推理对带宽干扰敏感，或者量化路径尚未通过一致性验证时，维持默认加载更合适。旧版每个监听线程串行处理连接和发送；多个新实例同时找同一个 rank，会遇到供方排队。接收端开始推理后，Netloader 监听仍可能为下一批实例服务，所以供方代价不只发生在自身启动时。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；**本文 GLM-5.3-Flash 双机算例沿用例外 B 专用镜像钉点 `db701c1f`（与 `2c59ff10`、`2ed6cbba` 的 `netloader` 目录树及官方指南文件逐文件相同），与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 的 Netloader 实现完全一致**：均采用后处理布局传输（`INT8_CACHE=no`）、传输清单（`transfer manifest`）与缓存模式握手，并在磁盘回退时通过 `disk_fallback_loader_extra_config`（`utils.py#L24-L46`、`netloader.py#L741-L765`）保留 `enable_multithread_load`、`num_threads`、`enable_weights_track` 三项 `DefaultModelLoader` 认识的参数、剔除 `SOURCE` / `LISTEN_PORT` 等 Netloader 专用键，避免回退时静默丢失多线程加载配置或触发未知键报错。与同属网络快载方案的 [RFork](rfork.md) 相比，Netloader 靠静态显式配置 `SOURCE` 地址并为每对供需 rank 建立 2 进程临时 HCCL 通信组逐参数收发，而 RFork 由 Planner 撮合 seed 租约、登记内存并按地址分批直读，两者加载协议与排障路径独立。

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 默认加载与 `INT8_CACHE` | 显式 `--load-format netloader`；`SOURCE` 默认无、`INT8_CACHE=no` | 同 `v0.23.0`（与 `db701c1f` 逐文件相同） | 入口与默认值不变；`no` 改为传输后处理后的推理布局（`hbm`/`dram` 仍走原始 int8 缓存） | 与 `v0.30.0` 逐文件一致 |
| 握手校验与清单 | 仅核 rank、模型路径字符串、TP、PP；无缓存模式核对与张量清单 | 同 `v0.23.0` | 增加缓存模式核对（客户端非 `None` 时比较）与 `transfer manifest`（名称与元素数校验，仍非内容哈希） | 与 `v0.30.0` 逐文件一致 |
| 失败回退与配置保留 | 仅清理少量上下文；回退时清空额外配置 | 同 `v0.23.0` | 快照清理新增注册/引用并回收显存；主模型失败后 draft 跳过网络加载；`disk_fallback_loader_extra_config`（`utils.py#L24-L46`）保留 3 项多线程加载键 | 与 `v0.30.0` 逐文件一致（`netloader.py#L741-L765`） |
| 同步组与端口校验 | 主模型到 draft 做全局 barrier；基础端口判 `range(1024, 65535)` 不复核加偏移后越界 | 同 `v0.23.0` | 改为本地进程组同步（无效时回全局）；新增 draft 来源端口、最终监听端口越界检查与随机端口重试 | 与 `v0.30.0` 逐文件一致 |

新旧协议（`v0.23.0`/`v0.26.0rc` 原始参数顺序 vs `v0.30.0`/`main` 后处理布局与 manifest 握手）不可假定可跨版混接。新版指南已测模型列表（DeepSeek-V3.1-w8a8-mtp、Deepseekv4-flash-w8a8-mtp、DeepSeek-V4-Pro-w4a8、GLM-5.1-w4a8、GLM-5.1-w8a8）仍不含 GLM-5.3-Flash，列表中的 GLM-5.1 不能替代本部署验证。

**指南中的空闲等待开关已过时。** vLLM PR #16226 在 2025 年引入 `VLLM_SLEEP_WHEN_IDLE`，让共享内存消息队列读端在空闲时降低轮询频率；后续 PR #28053（`6f0dd938`）删除该开关并改为等待 ZeroMQ 通知。固定 vLLM 已包含此更改，继续设置旧变量不会改变 Netloader 路径。

### 源码位置

下面编号对应 frontmatter 的 sources，文档与源码结论分开保留。

- [S1] `v0.23.0` 官方指南 `netloader.md:7-30` 定义与场景，`36-46` 配置表，`54-89` 示例，`95-97` 缓冲与空闲等待建议（同文件也存在于 `db701c1f` 与 `v0.26.0rc`）；[S2] 新版指南 `netloader.md:42` draft 端口说明与 `98` 已测模型列表（在线入口：[官方 Netloader Guide](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/netloader.html)）。
- [S3] GLM 教程 `237-341` 行双机启动命令均使用文件预取，未选择 Netloader。
- [C4]–[C8] 固定提交 `db701c1f` 的 `netloader.py`（配置解析、draft 识别、来源回退、360 行强制 draft 非 `no` 缓存为 `hbm`）、`interaction/elastic.py`、`executor/elastic_load.py`、`load.py` 及 `vllm@0fc695fc:vllm/config/load.py#L29-L34`；[C9]–[C10] 确认 `v0.23.0`（`2c59ff10`）与 `v0.26.0rc`（`2ed6cbba`）同范围一致。
- [C11]–[C13] 覆盖后处理布局、缓存模式与 manifest 握手、快照回退及端口检查；`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）的磁盘回退配置过滤一致，见 `vllm_ascend/model_loader/netloader/utils.py#L24-L46` 与 `netloader.py#L741-L765`。
- [S17][S18] `VLLM_SLEEP_WHEN_IDLE` 引入与删除提交 `6f0dd938` 及 `shm_broadcast.py` 等待循环（来源 19–20）；[S21] CANN 9.0 `HCCL_BUFFSIZE` 文档规定拼写、默认 200 MB、双倍收发缓冲与域级覆盖规则。

**待核：** 缺固定 GLM 双机在 Netloader 下主模型及 MTP 的实机输出一致性、逐阶段加载耗时和显存峰值；缺供方同时推理与服务多个接收实例时的干扰测量，以及目标镜像的通信域数量、域级覆盖与实际缓冲分配。

**配置和传输边界的定位。** 路径比较是字符串相等（来源 5）；缺少 `sources` 字段的读取位于异常捕获之外（来源 7），不能保证回退；配置不逐键合并及 draft 非 `no` 缓存改为 `hbm` 见来源 4、11。后处理布局发送要求先登记清单，缺少时抛出 `Processed-layout P2P send requires registered transfer items.`（来源 13，262–274 行），且名称与元素数量检查不等于权重内容哈希，后续 view 调整仍可能失败（173–228 行）；缓存模式省略放行见来源 12（457–483 行）。[I]
