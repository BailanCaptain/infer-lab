---
id: rfork-terms
title: RFork 术语：把模型、内存和调度的名词分开
type: concept
summary: 读 RFork 时碰到的名词，常常一个词在模型、内存、调度三层各有意思。这页按层列成表：每个词指的是什么、和长得像的词差在哪、排错时拿它查什么。
aliases:
  - RFork 术语
  - RFork 名词
  - RFork glossary
  - RFork MR
  - RFork lease
chapters: []
order: 20
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L12-L82'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L196-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L18-L55'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L155-L175'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L330-L422'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L79-L145'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L225'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L33-L35'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L121-L152'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L194-L208'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L233'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 先看三个参与方的位置，再把这些词放回它们负责的通道
  - to: speculative-decoding
    kind: builds-on
    note: target 与 draft 在投机解码中的计算职责由投机解码页解释，本章只讲它们的权重共享
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-629e6f8b0215485342250f376eedf494ef1b55f5de26f189da5f5a615659eba1.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

读 RFork 最容易混淆的是**同一个词分属不同层**：一个 seed 不是整个模型集群，一个地址不是一个张量的身份，一个 lease 不是内存锁。这一页给出工作版的词典；遇到原理问题再进入对应机制页。[C1]

## 先认清谁在工作

先把软件栈分层：**NPU** 是实际存放和计算张量的加速设备；**PyTorch** 提供 Tensor、Parameter、Module 等模型对象；**torch_npu** 把 PyTorch 接到昇腾设备；**CANN** 是昇腾计算相关的软件栈。这里的 **YuanRong / `yr.datasystem`** 提供 RFork 所调用的数据传输能力，它不负责模型逐 token 推理。后面反复出现的 `TransferEngine`、`MemoryRegistration`、`ErrorCode` 三个名字都是从 `yr.datasystem` 导入的，导入不到就直接报 `RFork requires the YuanRong TransferEngine, MemoryRegistration, and ErrorCode APIs.`——传输本身不是 RFork 自己实现的 [C11]。排错模板要求分别提供这些版本，因为 RFork 的 Python 代码并不能单独决定底层设备调用的行为 [I]。

文中的 **native** 指 Python 调用下层本地库或设备接口的部分；**同步**表示这次调用返回前要等待对应操作完成，**异步**表示把工作交给后台继续执行。它们必须带对象来理解：同步的权重 read 和异步的 lease release 出现在同一条加载流程里——前者返回就代表这批字节已经到位，后者只是把归还名额的请求交给后台线程，两件事的“完成”不在同一个时刻 [D]。

| 名词 | 用直白的话解释 | 在 RFork 中怎么用 |
|---|---|---|
| 实例 / replica | 一套新启动或已运行的模型服务；可能包含多个 Worker | 扩容时增加的是实例，实际逐 Worker 加载分片 |
| Worker | 执行模型计算、持有张量的工作进程 | RFork session 建在这里，不能只看 API 前端日志 |
| seed / 种子 | 已加载好、可以提供权重的来源 Worker | Planner 返回的是一个来源端点；它还可以同时服务推理 |
| destination / receiver | 正在接收权重的 Worker | 自己分配目标内存并主动发起读；以后可以成为 seed |
| Planner / scheduler | 管理有哪些 seed、还有多少名额的外部服务 | 名字虽然叫 scheduler，但不是 vLLM 逐 token 的请求调度器 |
| TransferEngine | YuanRong 数据系统提供的传输对象 | 注册可访问内存、按地址读取字节；不是 HTTP 服务 |
| RForkSession | 一个 main 或 draft 加载会话的资源所有者 | 持有租约、传输后端、seed 服务、心跳与释放线程 |
| seed server | Worker 内的 HTTP 元数据服务 | 另起线程提供地址和形状信息，不发送权重主体 |

这些角色会复用在同一个 Worker 中：先是 receiver，模型就绪且租约释放后又可成为 seed；角色变化不等于新建另一个模型。

## 分片说“拿哪一份”，rank 说“我是其中第几份”

| 名词 | 含义 | 在排错中的用处 |
|---|---|---|
| shard / 分片 | 一个完整模型被并行策略切开后，本 Worker 持有的部分 | 同一模型的不同分片不能互相替代 |
| TP（Tensor Parallel） | 把同一层的张量计算和权重分到多个 rank | `tp_rank` 进入 seed key；TP=4 的 rank 0 不能取 rank 1 的权重 |
| PP（Pipeline Parallel） | 把层分成流水线阶段 | `pp_rank` 区分层段；工作版 PP>1 时才读 PP rank |
| EP（Expert Parallel） | 把 MoE 的不同专家分配到不同 rank | `ep_rank` 区分专家权重的归属 |
| DP（Data Parallel） | 多组模型副本处理不同输入 | DP world size 进入兼容性指纹；不要只检查 TP |
| rank | 某个进程在一个通信组内的序号 | 必须注明是哪一个组的 rank |
| world size | 某个通信组共有多少个成员 | 序号一样但组大小不同，分片仍可能不同 |
| global rank | 全局分布式组中的进程序号 | 用于日志定位和 seed 端口偏移；不是跨实例全局唯一 ID |
| target / main | 正式提供验证与输出的目标模型 | 这里的 main 指模型角色，和 Git main 分支没有关系 |
| draft / 草稿模型 | 投机解码里提出候选 token 的模型 | 可能与 target 共享部分甚至全部存储；拥有独立 RFork session |
| MTP | Multi-Token Prediction，多 token 预测相关的草稿机制 | `_mtp` 或 `MTPModel` 等配置也会被识别为 draft |
| MoE / expert | 混合专家模型 / 其中的专家网络 | 专家权重有自己的布局与放置关系 |
| EPLB | Expert Parallel Load Balancing，专家并行负载均衡 | 动态移动专家会改变权重放置，工作版对此绕过 RFork |

这些身份最终进入[匹配规则](rfork-identity.md)，但并非每个 rank 都直接写进 key。例如 global rank 不在 seed key 中，DP 组大小却在指纹里。[C2]

## 一个张量同时有名字、形状和底层存储

| 名词 | 含义 | 容易混淆的地方 |
|---|---|---|
| tensor / 张量 | 带数据类型、维度和存储引用的多维数组对象 | Python Tensor 对象不是实际存储的全部生命周期 |
| Parameter | PyTorch 注册为模型参数的张量 | 模型还有 buffers 和实现对象里的派生权重，不只 Parameters |
| buffer | 模型注册的非 Parameter 状态张量 | buffer 不一定是权重，也可能是本地工作区 |
| checkpoint | 磁盘或存储中的模型权重保存形式 | “checkpoint layout” 路径仍是读对方 NPU 张量，不是通过 RFork 发文件 |
| layout / 布局 | 推理算子实际怎样组织权重的形状与存储表示 | shape 一样不足以证明语义布局一样 |
| processed layout | 经过加载后处理的权重布局 | 量化打包、转置、派生张量等可能改变模型中的对象 |
| NZ | 昇腾的一种分块存储格式 | 不能把格式转换简单理解为给 Tensor 改 shape |
| packed weight | 为算子打包后的权重 | 常藏在 `impl` 对象里，只扫 `state_dict` 可能漏掉 |
| scale / zero point | 量化值还原或计算时使用的尺度 / 零点参数 | 只搬整数权重而漏掉这些状态，模型也不完整 |
| shape | 每一维的长度，例如 `(2, 3)` | 同样 6 个元素也可表示成 `(6,)` |
| numel | 元素个数，即各维长度之积 | 字节数还要乘 `element_size` |
| dtype | 每个元素的解释方式，例如 float16 | float16 和 bfloat16 都占 2 字节，但数值编码不同 |
| stride | 各维前进一步在存储里跨过多少元素 | view 的形状与元素数相同，stride 仍可能不同 |
| storage | 真正承载字节的一段底层存储 | `.data` 被替换后，旧 storage 仍可能被传输引擎引用 |
| data_ptr | 当前张量数据起始地址 | 只在所属进程与设备语境下有意义，不是全局对象 ID |
| view / alias | 多个 Tensor 对象看到同一存储的全部或部分 | 重复名字和不同名字的共享视图，需要不同的去重规则 |
| meta tensor | 只有形状等描述、没有实际数据的张量 | 不能作为本次远端读的真实缓冲区 |
| scratch / 工作区 | 推理期间临时使用、容量由本实例配置决定的内存 | patch7 排除 `topk_indices_buffer`，不能拿 seed 的容量覆盖本地配置 |

工作版只采集非 meta、非空、在 NPU 上的可传张量 [C3]；注册开始前还会扫一遍 `named_parameters` 与 `named_buffers`，发现已物化、却不在 NPU 上的张量就拒绝这次注册 [C10]。

## 注册、元数据与搬运是三个动作

| 名词 | 含义 | 工作版中的具体对象 |
|---|---|---|
| MR（Memory Region） | 向传输引擎登记的可访问内存范围 | 登记成功后，地址必须保持有效，直到确认注销或引擎清理完成 |
| allocator block | NPU 内存分配器记录的分配块 | 用来证明张量范围有底层分配支撑，不是 KV block |
| logical range | 本次真正要暴露的张量字节范围 | 可小于底层分配块，用来避免把无关内存一并当成权重 |
| backing range | 支撑 logical range 的底层内存范围 | `MemoryRegistration` 同时接收逻辑起点/长度、支撑起点/长度 |
| owner / 保活引用 | 保持 Tensor 和原始 storage 不被释放的引用 | 存的是 storage 对象本身，不是 Tensor：后处理换掉 `.data` 之后，注册指向的仍是旧 storage [C4] |
| manifest | 张量清单，一张名字对应元数据的表 | 当前包含地址、numel、元素字节数、shape、dtype |
| transfer session ID | 远端 TransferEngine 的端点标识 | 不是 Planner 发出的 USER_ID，也不是模型服务的 HTTP 端口 |
| chunk | 一次批量传输的一组字节段 | 工作版按 1 GiB / 512 段上限切，不按 token 切 [C8][C9] |
| sync read | 同步读取调用 | 返回前等待这次读取结果；租约释放仍可异步进行 |

“注册”准备可访问性，“manifest”描述哪些字节属于哪些张量，“read”才把字节搬走。[C5]

## 租约只是调度记账，清理才决定能不能释放内存

| 名词 | 含义 | 必须记住的边界 |
|---|---|---|
| seed key | 找到同类权重分片的哈希键 | 筛选候选 seed，不是访问加密密钥 |
| fingerprint | 对所选配置字段规范化后算出的兼容性摘要 | 不计算权重内容，不能证明模型文件完全相同 |
| lease / 租约 | Planner 分给接收端的一次借用名额 | 不会自动锁住 source 的 NPU 内存或取消超时中的 read |
| USER_ID | Planner 返回的租约凭据 | 是这次借用的 ID，不是人的账号；日志用其哈希关联 |
| resource point | 示例 Planner 的并发容量单位 | 一次分配占一个点，并非显存字节数 [C6] |
| TTL | Time To Live，有效期 | 租约 TTL 与 seed 心跳失效时间是两个计时器 |
| heartbeat | seed 定期报告自身还在 | 不等于 receiver 为租约续期 |
| renewal | 延长仍有效租约的协议 | 当前工作版没有启用：代码里没有任何续租调用，只有设计文档提过这个方案，不能当成现有功能 [!] |
| advertisement / promotion | 发布自己可作为 seed / 从接收方转为来源方 | 已加载好模型不代表已经发布成功 |
| fallback | 清理本次尝试后走默认模型加载器 | 可能重新分配完整模型，旧注册未安全解除时必须停止 |
| idempotent / 幂等 | 重复操作不会重复产生相同副作用 | 客户端把特定 404 当已不存在；现场 Planner 必须符合对应语义 |
| RLock / 可重入锁 | 同一线程可重复获得的互斥锁 | 保护会话状态；不能据此假设所有网络 I/O 都无阻塞 |
| GC | Garbage Collection，回收无引用对象 | 仍被全局注册表或 storage owner 引用的权重不会被 GC 清掉 |
| finalize | 结束 TransferEngine 生命周期 | 成功后才能释放其保留状态，不等于普通一次 lease release |

会话状态（`RForkLifecycleState`）和三种返回结果——`LeaseReleaseResult`、`RForkSeedServiceStartResult` 两个枚举，外加 `RForkFallbackCleanupResult` 这个 dataclass——在[生命周期页](rfork-lifecycle.md)按真实调用展开；看见 `DEFERRED` 时先查延期的是什么，不要直接翻译成“模型不可用”。[C7]

## 官网图与量化说明里还会遇到的词

NIC、RDMA、RoCE、HBM 以及 BF16、W8A8、W4A8 的含义和图中位置，见[官网核读页](../sources/rfork-official-guide.md)，避免把网络协议、网卡和内存混为一层。

**MLA** 是 Multi-head Latent Attention，多头潜在注意力，用压缩后的潜在表示组织 KV；具体计算见 [MLA](mla.md)。官网提到的 **SFA** 是这里的稀疏注意力实现路径，RFork 不执行它的注意力计算，只需要确保其推理用张量也被采集。`W_UV` / `W_UK_T` 是相关实现的派生权重名称，分别用于 Value 上投影、Key 上投影的转置表示；不是某条请求的 V/K Cache。它们为什么不能漏搬，见[布局页](rfork-layout.md)。
