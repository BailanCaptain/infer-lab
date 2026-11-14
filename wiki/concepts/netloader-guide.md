---
id: netloader-guide
title: Netloader Guide：新实例怎样从已有 NPU 接过权重
type: feature
summary: >-
  Netloader 在启动时从已有实例的 NPU 接收同一分片的权重，省去重复读取权重文件。解释握手、逐张量传输、量化缓存、失败回退，以及 GLM
  双机未启用的事实和 main 的布局传输变化。
aliases:
  - Netloader
  - NetLoader
  - netloader
  - Netloader Guide
  - 网络权重加载
  - 网络加载器
  - ModelNetLoaderElastic
  - INT8_CACHE
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
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
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
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-2acbcbacef9fb5d918586a7117773ea6ff7a1b1456031c15164a1c3eaaaf9a1b.md
  - >-
    raw/sha256-7bd72802edac08cf070a7be6ccb1aab69ab073de980d079ede56d74241d8f788.md
---

## 已有一张卡装好了模型，新实例还要从文件重读吗？

**Netloader 是启动时的权重加载器：新实例向已经装好相同模型分片的实例要权重，把这些数直接从旧 NPU 卡复制到新卡自己的模型里。** 权重就是模型计算所用的参数；这里的 server 是供权重的旧实例，client 是取权重的新实例，两者也都可以运行推理服务。

```wiki-diagram
file: netloader-guide-intuition
```

扩容或故障恢复时，只要还有合适的供方，就有机会缩短重复加载的等待。

这一步挂在[GLM 双机主线的「启动时发生了什么」](glm-5-3-flash-two-node.md#启动时发生了什么)：加载权重之后才轮到估算可用显存、分配 KV cache（保存请求历史计算结果的缓存）和预热。请求已经开始生成 token（文本切成的小片段）时，Netloader 的接收工作已经结束。

## 为什么值得从另一张卡取，代价落在哪里？

**节省的是重复读权重文件的工作，新增的是建链、卡间传输，以及供方为传输保留的资源。** 官方指南将扩容、恢复服务和减轻集中存储压力列为使用场景，但没有给这套 GLM 部署的加载加速倍数。

这条路径实际为一对供方、接收方建立一个 **2 进程的临时通信组**，用 HCCL（昇腾卡间通信库）发送和接收张量。张量就是带形状的一组数。源码允许供方在后台线程里发送，同时继续推理；据此推断，两者可能争用显存带宽和通信资源，影响幅度留待实机测量。

它不是每层前向都加一次通信。通信集中在启动加载阶段：先建立连接，再按参数顺序搬运；旧版每发或收一个参数都等待该次操作完成，最后还做一次 barrier（组内两端都到达后才继续的同步）。接收方要等这些权重齐备，才能沿启动流程继续走。建 HCCL 连接还需预留额外片上内存。Netloader 指南提到的 **200 MB** 是缓冲配置的默认量级，不能当成一个进程的总开销；CANN 9.0 的对应条目将每通信域的收、发缓冲合计描述为该配置值的两倍，实际还要考虑通信域数量与覆盖设置。

相邻机制处理的对象不同：默认加载器从模型文件取权重；Netloader 从已有卡取权重；[KV Pool](kv-pool.md) 复用的是请求历史缓存；[RFork](rfork.md) 同样复用已有权重，但它有自己的来源发现和租约流程。启用其中一个，并不会自动启用另一个。

## 一份权重怎样从旧卡走到新卡？

**先确定“要找哪一个分片”，再握手，最后让双方按相同顺序发送和接收参数。** Worker 是负责模型执行的进程；rank 是它在分布式通信中的进程编号。一个物理设备的编号和这个 rank 是两回事。

以两个同构实例为例，新实例的 rank 0 应向旧实例中负责同一分片的 rank 0 取权重，其他 rank 也各找各的来源。新实例先按自己的模型配置创建参数空位，然后通过 TCP（普通网络连接）告诉供方自己的 rank、模型路径以及 TP、PP 大小。TP 把矩阵分给多卡，PP 把模型层分给不同阶段，具体划分见 [TP](tensor-parallel.md) 和 [PP](pipeline-parallel.md)。

供方逐项比较这四项；相同才回复同意，双方随后建立临时 HCCL 通信组。**这是身份和分片配置的检查，不是权重内容校验。** 旧版握手没有模型文件哈希、量化配方、EP 配置或完整张量清单。两边路径相同而文件内容不同，不能靠这一关发现；换了并行划分，也没有重新切片功能帮它适配。

模型路径比较的是路径字符串。因此，即使两端模型文件内容相同，只要路径字符串不同，也不能通过这一项检查。

```wiki-diagram
file: netloader-guide-flow
```

接收过程可以用一个很小的张量账说明。假设同一分片有一个形状为 [2, 3] 的 int8 权重矩阵，即 2 行、每行 3 个一字节整数，还有长度为 2 的 FP16 缩放参数，即两个两字节浮点数。两端都按“矩阵、缩放参数”遍历，先把矩阵送进同形状空位，再送缩放参数；以下仅演示数据量，模型与形状均为教学假设。

```wiki-diagram
file: netloader-guide-tensors
```

```calc
title: 同一分片按张量顺序搬运的有效载荷（教学示意）
权重矩阵 = 2 × 3 × 1 B = 6 B
缩放参数 = 2 × 2 B = 4 B
有效载荷合计 = 6 B + 4 B = 10 B
```

这里的 10 B 只是两个张量的有效载荷，连接状态、传输协议和通信缓冲另外占资源。接收不会改变矩阵值，也不把矩阵切成另一种形状。实际旧版发送器跳过名字含特定输入缩放标识的参数，接收器跳过零维参数；双方过滤规则不同，因此还依赖模型加载前后的参数集合与顺序相容。

来源地址可以为一个 rank 配多个候选。TCP 连接或注册失败时会继续试下一个；**已经选中供方、开始 HCCL 传输后失败，则返回默认加载路径**，不会在这次传输函数里接着轮询剩余供方。没有给当前 rank 配来源也直接从存储加载。这意味着第一批实例可以不配来源，先读盘成为供方；接收成功的新实例也会尝试开监听，供后来者继续取权重。

## 量化权重为什么还需要留一份原始缓存？

**旧版接收的是准备交给加载后处理的参数；供方一旦已做权重变换，接收端就需要区分原始布局与推理布局。** [Quantization](quantization.md) 解释了低位宽权重和缩放量的关系。当加载后处理执行了转置、设备布局转换或建立派生张量时，“已经能推理的参数”与“刚读文件后的参数”就有形态上的区别，具体变换由模型和量化实现决定。

旧版在供方的量化加载后处理之前，按配置保存选中的原始 int8 参数。之后有人请求权重时，名字命中缓存就发送原始副本，否则发送模型当前参数；新实例接收后再做自己的加载后处理。这份缓存可放在 HBM（NPU 自带的高带宽显存），也可放在 DRAM（主机内存）。前者额外占显存，后者发送前要把缓存搬回 NPU；都与请求的 KV cache 无关。

不保存缓存是默认选择，但旧版指南明确提醒量化模型可能出现结果偏离或不可预期行为。缓存只覆盖选中的 int8 参数，并不是整个模型状态的快照；选用它后仍需确认目标模型和量化路径兼容。main 已经把默认“不缓存”路径改成传输后处理后的推理布局，细节见[版本差异](#版本差异)，不能拿它解释旧版。

## GLM 双机这套部署会走 Netloader 吗？

**固定教程没有选 Netloader；它从模型文件加载，随后按通常的启动步骤接请求。** [部署前提](glm-5-3-flash-two-node.md#部署前提)给出模型、分组与版本唯一口径。教程双机命令使用 safetensors（一种权重文件格式）的预取策略，没有设置 Netloader 加载格式；vLLM v0.23.0 的加载格式默认是 auto，即优先找 safetensors，找不到再找 PyTorch 权重文件。

因此，从“一条请求走一遍”的角度看：先等服务完成文件加载和预热，请求才进入调度；它的第一个 token 和后续 token 都使用本卡已经装好的权重，不会临时向 Netloader 要某一层。每台机器各放什么、两台为什么合起来构成模型，沿用[双机分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)，这里不重新计算。

源码能确认未启用的直接原因是加载器选择；教程没有说明作者为何没有选这项优化。工程上若要改用它，需要另有已经加载相同模型及相同分片的供方，并为每个 Worker 配好来源。当前双机两组对应卡的 attention 等 TP 分片相同，但 EP16 分配的专家分片不同，全局 rank 也不同，具体见[双机分组与每卡权重](glm-5-3-flash-two-node.md#16-张卡怎样分组)。两台一起冷启动时又都还没装好权重，因此不能简单互指就当作彼此的供方。

这套部署还使用量化和 MTP（先猜后验的多 token 预测，见[投机解码](speculative-decoding.md)）。旧版会把主模型与 draft（草稿模型）分成两个加载和监听通道，草稿端口在对应基础上加偏移；主模型加载后、进入草稿前还有全局同步。**开启原始 int8 缓存时，draft 的供方缓存模式会被强制设为 hbm，即使用户选了 dram，也会先尝试在 HBM 中保存草稿副本；关闭缓存的 no 不触发这次改写。** 因此应分别核对主模型、草稿模型的来源与输出一致性，并把草稿副本计入显存余量；HBM 复制失败后的降级行为见[开销](#开销和什么时候别开)。它只替换启动时取权重的一段，不改变 TP、EP 的分工，也没有证据可将主线吞吐数字算作 Netloader 的收益。

## 哪些理解容易把它用错？

- **“装了插件就从网络加载。”** 注册只让加载器可被选择；启动时还要明确选它。GLM 教程没有选。
- **“同一个模型名字就能混用分片。”** 旧版比的是模型路径字符串、rank、TP、PP；调用服务时展示的名字不参与这次核对，握手也没有验证权重文件内容。
- **“来源列表会把权重分散到多台同时下载。”** 旧版顺序尝试连接，选择一个可注册的来源；HCCL 传输失败后回默认加载。
- **“服务起来就证明网络加载成功。”** 默认加载回退也能把服务启动起来。要把接收成功日志、回退日志和加载耗时放在一起看。
- **“从别卡借权重就不占本卡显存。”** 本卡仍保存一份可用于推理的权重；供方开启原始 int8 缓存时还要另存一份副本。

## 对照源码

### 怎么开

用 `--load-format netloader` 选加载器，配置放在 `--model-loader-extra-config` 的 JSON 对象里，不属于 additional_config。先按官方指南的单卡例子理解两端：供方不配 SOURCE，读文件后开监听；接收方配置供方日志里公布的 Netloader 地址。`--port` 是推理 API 端口，LISTEN_PORT 才是权重服务的基础端口。

以下是 Linux/NPU 环境的配置示例，未在设备上执行。假定两个进程各有一张独立 NPU、同一模型路径可访问，示例使用未量化模型且不开草稿模型；IP 换成供方实际地址。官方原例还设置了 `VLLM_SLEEP_WHEN_IDLE=1`；这是曾用于减少空闲 CPU 忙等的旧开关，固定 vLLM 已删除它，当前等待路径见后文，因此下面不再加入该变量。

```bash
# 供方：当前机器的物理卡 0；不配 SOURCE，先从文件加载
ASCEND_RT_VISIBLE_DEVICES=0 \
vllm serve /models/example --tensor-parallel-size 1 --enforce-eager \
  --port 8000 --load-format netloader \
  --model-loader-extra-config '{"LISTEN_PORT":19000}'

# 接收方：同机示意用另一张物理卡，进程 rank 仍是 0
ASCEND_RT_VISIBLE_DEVICES=1 \
vllm serve /models/example --tensor-parallel-size 1 --enforce-eager \
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

**v0.30.0rc2 延续固定 main 的后处理布局传输与 manifest 握手，另修正磁盘回退配置。** 当网络加载失败或种子从磁盘加载时，不再清空全部 model_loader_extra_config，而是保留 enable_multithread_load、num_threads、enable_weights_track 三项默认 loader 认识的设置，剔除 SOURCE、LISTEN_PORT 等 Netloader 专用键。这样回退不会静默丢掉用户的并行加载设置，也不会让默认 loader 因未知网络键失败。

此变化不使旧版的原始权重传输协议自动兼容新版。供方与接收方仍应匹配 Netloader 协议、缓存模式和实际权重布局；本页 main 所述 no/hbm/dram 区别继续适用于 rc2。

下表的 v0.23 指维护分支，不拿它冒充含 GLM 代码的固定镜像。四个提交中前三个的 **Netloader 源码目录树和官方指南文件完全相同**；整个仓库与 GLM 模型支持范围并不因此相同。

| 版本 / 提交 | 是否有、默认值 | 行为及这对使用者意味着什么 |
| --- | --- | --- |
| v0.23 / 2c59ff10 | 有，显式选择 netloader；SOURCE 默认无、INT8_CACHE 默认 no | 按参数遍历发送；接收后做后处理；主模型到 draft 之间全局 barrier；此维护分支没有本部署的 GLM 模型实现 |
| GLM 固定执行侧 / db701c1f | 有，同上 | Netloader 与 v0.23 维护分支逐文件相同；GLM 教程仍未选择它 |
| v0.26 / 2ed6cbba | 有，同上 | 本特性源码、配置默认值和指南与上两行相同；不能把默认 no 理解成后处理布局传输 |
| main / baa023ad | 有，入口和上述默认值不变 | no 改为传输后处理布局；增加缓存模式核对和张量清单检查，回退清理与 draft 同步也改变；新旧协议与权重处理路径不可假定可混接 |

main 的变化要分四处看：

1. **no 路径变了。** 接收端先做加载后处理以准备最终布局，供方也在后处理后登记 transfer manifest（传输张量清单）。清单收集参数、buffer（模型注册的非参数张量）及部分模块属性上的运行时张量，并按数据地址去重。收完后不再重复执行那次后处理。hbm、dram 仍走原始 int8 缓存路径。
2. **握手变了。** 新客户端发送缓存模式；服务端先核 rank、模型路径、TP、PP，再在客户端字段非 None 时比较缓存模式，省略该字段不会触发这项拒绝。no 路径回复张量形状清单。有非空清单时，接收端在 HCCL 前检查各待收张量的名称与元素数量；清单为空时该检查直接放行。这仍不是模型权重内容哈希。

3. **回退变了。** 失败时按初始化前的快照清理新增注册和模型引用，并尝试回收显存；同一 rank 的主模型网络加载已经失败回退后，draft 跳过另一次网络尝试。旧版只清理静态前向上下文等较少状态。
4. **同步与端口变了。** 主模型到 draft 的等待改为按本地进程组；本地大小无效时回到全局组口径。增加 draft 来源端口和最终监听端口越界检查、随机端口重试。

main 指南还新增已测模型列表：DeepSeek-V3.1-w8a8-mtp、Deepseekv4-flash-w8a8-mtp、DeepSeek-V4-Pro-w4a8、GLM-5.1-w4a8、GLM-5.1-w8a8。这里没有 GLM-5.3-Flash；列表中的 GLM-5.1 不能替代本部署的验证。

**指南中的空闲等待开关已过时。** vLLM PR #16226 在 2025 年引入 VLLM_SLEEP_WHEN_IDLE，让共享内存消息队列的读端在长时间无活动时降低轮询频率；它处理的是 CPU 忙等，不是 Netloader 传输协议。后续 PR #28053 删除该开关，并将空闲读端改为等待 ZeroMQ（进程间消息通信库）的通知。GLM 固定 vLLM 已包含此更改：读端先短暂轮询，空闲后等待通知，取消或超时也可以结束等待。继续设置旧变量不会重新选择一条 Netloader 路径，也不能从旧 PR 推出本部署的 HCCL 建链收益。

### 源码位置

下面编号对应 frontmatter 的 sources，文档与源码结论分开保留。

- [S1] v0.23 官方指南 netloader.md:7–30 定义与场景；36–46 配置表；54–89 两端示例和输出比较；95–97 缓冲与空闲等待建议。相同文件也存在于 GLM 固定提交和 v0.26。
- [S2] main 官方指南 netloader.md:42 新增 draft 端口说明；98 列出已测模型。在线入口为[官方 Netloader Guide](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/netloader.html)，版本结论仍以钉住文件为准。
- [S3] GLM 教程:237–341 是双机启动命令：269–291、318–341 均使用文件预取，未选择 Netloader。
- [C4] 固定提交 netloader.py:58–125 配置解析；140–155 draft 识别与同步；230–309 来源分支与回退；311–394 监听、后处理与返回，其中 360 行将非 no 的 draft 供方缓存模式强制设为 hbm；419–437 默认加载路径。
- [C5] interaction/elastic.py:61–101 顺序尝试来源；173–214 注册协议；264–284 原始 int8 缓存；310–325 单监听线程；376–421 身份核对与发送。
- [C6] executor/elastic_load.py:67–98 两端临时组中的接收、逐参数等待和最终同步；134–161 发送、缓存优先和清理。
- [C7] load.py:50–77 当前 rank 来源筛选、一次 P2P 加载和失败返回；没有 HCCL 失败后遍历其他来源的循环。
- [C8] vLLM config/load.py:29–34 默认 auto 及文件格式选择，支撑 GLM 未启用结论。
- [C9] v0.23 netloader.py:58–437 与固定提交相同；[C10] v0.26 同范围也相同，配置和回退行为一致。
- [C11] main netloader.py:206–240 本地同步；463–617 新加载和回退路径；626–724 端口检查、监听、后处理与同步。
- [C12] main interaction/elastic.py:459–483 缓存模式核对及形状清单；[C13] main executor/elastic_load.py:93–155 收集和缓存推理张量，435–445 在建 HCCL 前检查清单。
- [C15] rc2 utils.py:24–46 定义磁盘回退允许保留的三项配置；[C16] rc2 netloader.py:753–759 是实际调用位置。两固定版本的 Netloader 目录差异仅涉及该辅助函数与调用，布局传输行为保持一致。
- [S17] PR #16226 的最终补丁引入旧空闲开关；[S18] 提交 6f0dd938 删除它及旧计时器，该提交是固定 vLLM 的祖先。[C19] 固定共享内存消息队列的 SpinCondition 定义；[C20] 实际读循环调用其等待方法。原始 issue #16660 反映旧版本空闲 CPU 占用，不提供当前 Netloader 性能数据。
- [S21] CANN 9.0 HCCL_BUFFSIZE 全文给出拼写、默认值、收发缓冲与域级覆盖规则；来源 3 的双机命令给出实际教程设置。这不证明所有 CANN 版本或模型进程只有同样的总分配量。

**待核：** 缺固定 GLM 双机在 Netloader 下主模型及 MTP 的实机输出一致性、逐阶段加载耗时和显存峰值；缺供方同时推理与服务多个接收实例时的干扰测量，以及目标镜像的通信域数量、域级覆盖与实际缓冲分配。

**配置和传输边界的定位。** 路径比较是字符串相等（来源 5）；缺少 sources 字段的读取位于异常捕获之外（来源 7），不能保证回退；配置不逐键合并及 draft 非 no 缓存改为 hbm 见来源 4、11。

main 的后处理布局发送要求先登记清单，缺少时抛出 `Processed-layout P2P send requires registered transfer items.`（来源 13，262–274 行）。同文件 231–259 行检查名称及元素数量；数量相同仍可能在后续 view 调整失败（173–228 行），因此这些检查都不等于权重内容校验。缓存模式字段省略的放行条件见来源 12 的 457–483 行，只适用于该固定 main 握手协议。
