---
id: hccl-buffer
legacyIds:
  - gap-a5164fe10fa9184412f8
title: HCCL buffer：通信缓冲怎样配置与占用显存
type: concept
summary: >-
  HCCL buffer 为集合通信提供设备中转空间；讲清逐组配置、环境变量和底层通信组复用的区别，以及 GLM 双机的配置预算怎样影响 KV cache
  可用显存。
aliases:
  - HCCL buffer
  - HCCL_BUFFSIZE
  - hccl_buffer_size
  - HCCL 缓冲区
  - HCCL buffer：每个通信组各自预留的一块显存
chapters:
  - '13'
order: 40
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L67-L69'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1118-L1149'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1152-L1163'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L39-L77'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L100-L166'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/_hccl_pg_registry.py#L26-L91'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/_hccl_pg_registry.py#L161-L255'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L1-L150'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1760-L1900'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1252-L1262'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L462-L500'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L556-L597'
  - 'vllm@0fc695fc:vllm/utils/mem_utils.py#L263-L268'
  - >-
    vllm-ascend@db701c1f:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L62-L84
  - >-
    vllm-ascend@db701c1f:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L283-L290
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L64-L66'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L82-L84'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/performance_and_debug/optimization_and_tuning.md#L157
  - >-
    raw:sha256-97e6c7fb6e76903d70deec459437f24b4f1a2befdd32030314f387b98bfcba1e.md#L1-L719
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/patch/worker/patch_distributed.py#L39-L76
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/patch/worker/_hccl_pg_registry.py#L52-L90
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/patch/worker/_hccl_pg_registry.py#L116-L126
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/commlib/hcclug/docs/en/user_guide/hccl_env/HCCL_BUFFSIZE.md
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L232-L312'
  - >-
    vllm-ascend@2c59ff10:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L62-L84
  - >-
    vllm-ascend@2ed6cbba:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L62-L84
  - >-
    vllm-ascend@baa023ad:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L62-L84
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L73-L77'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1175-L1214'
  - >-
    vllm-ascend@7d825229:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L85
  - >-
    vllm-ascend@7d825229:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L109-L119
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L704-L728'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L314-L317'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L151-L226'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1034-L1079'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1115-L1160'
  - 'vllm-ascend@7d825229:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L288-L295'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_comm_method.py#L302-L327'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L282'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L330-L357'
  - 'vllm-ascend@7d825229:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L38-L51'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L238-L269'
  - 'vllm-ascend@db701c1f:tests/ut/patch/worker/patch_common/test_patch_distributed.py#L288-L317'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L73-L77'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1241-L1289'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/parallel_state.py#L87-L107'
  - >-
    vllm-ascend@c09d3e20:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L85
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L200-L210'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L73-L77'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1252-L1300'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/parallel_state.py#L88-L137'
  - >-
    vllm-ascend@8d6180e2:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L85
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: collective-communication
    kind: builds-on
    note: 先看清一次集合通信的输入输出是什么
  - to: cann-hccl
    kind: builds-on
    note: 通信组怎么分、走哪条物理链路在那页
  - to: device-memory
    kind: builds-on
    note: 理解权重以外的设备内存开销
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 这块缓冲是从哪份 KV 预算里扣掉的
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-905971ffcb5c66867cbc02fe98b1ecaf3394ac7dae5cda4eaa98c5343ee85cb0.md
  - >-
    raw/sha256-97e6c7fb6e76903d70deec459437f24b4f1a2befdd32030314f387b98bfcba1e.md
  - >-
    raw/sha256-c00f9564c28c3b320827d06525af4c3bd334639d8bcda54d5260c760197302d8.md
---

## HCCL buffer 是什么，通信缓冲为什么占显存？

**通信组（process group）**是一组一起通信的卡，成员和组内编号在建组时确定，[集合通信](collective-communication.md)在指定组内执行。**HCCL buffer 是昇腾集合通信库用于交换数据的设备存储空间。** 估算它的显存开销时，要同时看缓冲配置和底层通信组是否复用；逻辑组的数量不能直接乘配置大小，当作设备实际占用。

```wiki-diagram
file: hccl-buffer
```

图中三个底层通信域独立使用，每个色块画的是对应域含收发在内的整套缓冲。通信域是通信库实际建立的成员集合与通信资源；应用里的逻辑组可以指向同一个底层域。固定镜像允许满足相同后端、相同有序成员、兼容选项和复用域的逻辑组复用底层 HCCL 进程组。通信输入张量与通信库缓冲则是不同对象；输入这次有多大，不决定缓冲配置有多大。实际设备分配与释放时机仍需运行日志或测量确认。

通信组按什么规则划分、走机内还是跨机的链路、争用时怎么排优先级，见 [CANN 与 HCCL](cann-hccl.md)；All-Reduce、All-to-All 这些操作各让每张卡得到什么，见[通信基础](collective-communication.md)。本页只管这块预留区：谁定它的大小，它占了谁的地方。

## 为什么要提前留，代价落在哪里？

两张卡交换数据，需要通信库可使用的存储区。缓冲配置决定采用该配置的通信域可用多大的窗口；实际分配后可以重复使用，减少反复申请的工作。代价是通信资源会占设备内存，不能仅因当前没有消息就把这部分算作可用 KV 空间。何时实际分配、何时释放，要看 HCCL 版本与资源生命周期，建组源码本身不能证明分配时点。

**实际新增的通信占用会影响 KV cache 的预算。** 昇腾的 worker 按这个顺序分账：先量一次显存快照，之后才建通信组、装权重、跑一遍试算；最后算出可用 KV = 预算 − （权重 + 激活峰值 + 非 torch 增量）。「非 torch 增量」的口径是「试算结束时的非 torch 占用 − 最初那次快照」。初始快照之后新增、到计量结束时仍占用设备内存的非 torch 通信资源会计入这一项；已经复用的通信域不能再重复计数。对 KV 的影响要用实测增量和最终块数确认，不能由逻辑组数或缓冲配置值直接推出。这份预算本身怎么来的，见[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

反方向也有代价。留得太小，一次要搬的数据可能超过中转窗口，普通集合通信的处理方式取决于具体算法，CANN 指南提示性能可能下降。本页另追到融合 MC2 的 DispatchFFNCombine 算子：它在算 tiling（算子执行前定下的切分与搬运方案）时检查窗口，装不下就失败。这一判据不能套给所有 MC2 算子，后面单独讲。所以这个值既不是越大越好，也不是越小越好。

## 放到 GLM 双机：本部署建了哪些组，各留多大

固定部署是两台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16，完整前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。启动时每个 worker 都会建下面这几个 HCCL 组，成员的推导见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)；缓冲值按组名从源码写死的三个常量里挑：

| 组 | 以 rank 0 为例的成员 | 这个组做什么 | 本卡为它留的值 |
|---|---|---|---|
| world | 全部 16 张卡 | 启动阶段的全局对齐 | 200 M |
| tp | 机内 8 张卡 | 每层 attention 输出和 MLP 之后的 All-Reduce | 200 M |
| ep | 全部 16 张卡 | MoE 走 All-Gather 路径时的收集与归约 | 200 M |
| mc2 | 全部 16 张卡 | MoE 走 MC2 路径时的 dispatch / combine | 不写这个字段，见下文 |
| dp | 跨机同号的 2 张卡 | 为 DP 元数据归约预留；默认那次归约走 CPU 通道，开 `dp_allreduce_on_npu` 才走这条组 | 50 M |
| pp、dcp、pcp | 只有本卡 | 这三种并行规模都是 1，组里只剩自己 | 各 200 M |

表里的 M 按源码的换算是 1,024 × 1,024 字节。两台机器之间的 DP 状态同步构造两行、每行 DP 个 int32；DP=2 时共 4 个元素。它默认走 CPU 通道（gloo），这次操作不用 HCCL 缓冲，但不能由此判断已经创建的设备通信组没有内存开销。

其他功能还会按条件建组：Ascend dynamic EPLB 的组配置为 100 M；细粒度 TP 对四个组件分别检查规模是否大于 0，同规模会复用局部缓存里的同一协调器。FlashComm2 在专用 TP 规模大于 1 时建 OTP、ODP 两个组，否则 ODP 复用现有 TP；`multistream_overlap_gate` 另建 `fc3_quant_x`。PD 头比例和层权重分片也有自己的条件分支，不能把这张表当成所有部署的组名全集。固定部署未启用这些扩展；EPLB 的判定见 [expert-parallel](expert-parallel.md#这套部署有没有开-eplb)。

### DP 组为什么只留 50 M

`dp` 是唯一按规模算的组：公式取 DP 规模再加一个标记位，每项算一个 int32（4 B），换算成 MiB 向上取整后再与源码常量下限 `50` 取大：

$$B_{\text{dp}} = \max\!\left(\left\lceil \frac{(\text{dp\_size} + 1) \times 4}{1024^2} \right\rceil,\; 50\right)\text{ MiB}$$

| 步骤（DP 组 `dp_size = 2`） | 算式 | 结果 |
| --- | --- | --- |
| 按公式换算 | $\lceil (2 + 1) \times 4\text{ B} \div 1{,}048{,}576\text{ B} \rceil = \lceil 12 \div 1{,}048{,}576 \rceil$ | **1 M** |
| 与源码下限比较 | $\max(1\text{ M},\; 50\text{ M})$ | **50 M** |

DP=2 时换算项还不到 1 M，结果完全由下限决定。反过来不成立：50 M 不代表每步真的发 50 M。这一步同步的只是几个 int32 标记——本部署这条路径构造两组、每组 DP 个 int32，再归约成各 rank 的状态——而且默认走 CPU 通道（gloo），只有把 `dp_allreduce_on_npu` 打开才改走这条 HCCL 组；消息布局由收发代码决定，不能从预算值反推。

### 配置值怎样折算成容量参考

把上表的配置值加起来，再按一个 KV 块 7.969 MiB 折算。块大小和 3,855 块是[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)推导好的，本页只引用：

这里相加的是表列配置值。实际占用还取决于组创建和复用、单成员组的分配、收发方向及内部资源；后文 CANN 的收发各一份口径也不能省略。因此下表只是把配置数字换成读者熟悉的容量单位，不是预测实际少了多少 KV 块：

| 核算项（本卡表列配置值折算参考） | 算式 | 结果 |
| --- | --- | --- |
| 真要跨卡通信的四个组（world / tp / ep / dp） | $200 + 200 + 200 + 50$ | **650 M** |
| 只有本卡一个成员的三个组（pp / dcp / pcp） | $3 \times 200$ | **600 M** |
| 650 M 折合 KV 块（每块 7.969 MiB） | $650 \div 7.969 = 81.6$ | **$\approx 82$ 块** |
| 82 块折合缓存位置（每块 640 token） | $82 \times 640$ | **52,480 token** |

650 MiB 这个数值相当于约 82 个 KV 块、5 万多个缓存位置，是那 3,855 块算例的约 2.1%；它不代表四个组实际吃掉了 2.1% 的 KV 额度。三个单成员组的字段之和另为 600 M，也不能当成三次真实分配。真正的预算影响应读取显存探测中的非 torch 增量，并结合通信域复用与收发缓冲解释。

## 建组时怎么挑值，建完能不能复用？

昇腾把上游的建组入口整体换成了自己的版本：每建一个组，先按组名取一份配置，再构造一个 Options（交给建组函数的一组参数）传下去，中间还多了一道注册表。

```wiki-diagram
file: hccl-buffer-flow
```

四条分派里，`dp` 和 `dynamic_eplb` 是精确匹配组名，`mc2` 那条是「名字里含 mc2」，其余一律走 200 M。要注意四条分支都会构造 Options 并把组名写进去，`mc2` 那条省掉的只是缓冲字段，不是「不传配置」。

注册表按四件事算一个键：成员、后端、这份配置、复用域。复用域也按组名定：名字里带 eplb 的自成一域，`mc2` 自成一域，其余归同一个共用域。键相同就交出已经建好的那个组、只多记一次引用，不再真建；键算不出来就退回逐个新建——出现了不认识的非默认字段，或者传进来的成员和 Options 里记的成员对不上，都按这条走。所以进程里真正建了几个 HCCL 组，不等于代码里创建了几个通信组对象，「组数乘每组的值」也就不能直接当成实际占用。

成员的排列顺序也是复用键的一部分：成员相同但排列顺序不同，也不会得到同一个复用键。

还有一处细节值得记住：顶层 group_name 字段被有意排除在键之外，但构造函数还把组名写进 hccl_config；如果 Options 保留了这个值，名字不同的组就会算出不同的键。证明跨组名复用的那项单元测试使用模拟 Options，hccl_config 只带缓冲大小；它说明相同键会复用，不能代替现场 Options 的行为。这一条也列在页末。

```wiki-diagram
file: hccl-buffer-fig-domain-ledger
```

**落到 `v0.30.0` 主基线与 `main`，四条基础分派保持不变，另有三处增量需要注意：** 第一，新增 `sleep_lifecycle_anchor = 1 MB` 专用分派（仅规定该组名的缓冲字段，不表示每次启动必建）；第二，在 `v0.30.0` 新增 `edp`、`main` 补建 `etp` 扩展组时，只要后端走 `hccl` 都会自动落入默认 `200 MB` 分派；第三，某模型教程脚本里导出的 `HCCL_BUFFSIZE_EP` 在 `vllm_ascend/` 与 `csrc/` 全仓代码中**没有任何读取逻辑**，不要误以为 `vllm-ascend` 会按它单独覆盖 EP 组缓冲（详见文末[版本差异](#版本差异)）。

## MC2 组为什么不按组配？

`mc2` 那条分支返回 None，外层仍构造带组名的 Options，只不写缓冲字段。源码注释给了理由：MC2 算子按环境变量 `HCCL_BUFFSIZE` 划分通信空间，再单独给这个组覆盖缓冲大小，两边划分可能不一致。

以 DispatchFFNCombine 为例，它在算 tiling 时先取这个环境值，没设就按 200 M 算，再拿窗口需求去比：按 token 行数、每个 token 选中的专家数和隐藏维算出三份 int8 数据，外加 10 MiB 固定余量。装不下就直接判失败，这个分支没有自动分批回退。该调用位于 `enable_fused_mc2=1` 的融合路径；本页固定的 A2 部署经 A2 选择函数选普通 MC2 或 AllGather，不走这个融合算子。因此这是一条具体算子的窗口例子，不是对 GLM 双机当前通信路径的实测，也不是所有 MC2 的统一公式。

这也说明两个层级不能混着看：环境变量管的是采用它的通信域和 MC2 算子的窗口，逐组配置管的是单个组的那个字段。一个组归哪一套管，由建组时挑到的那条分支决定。

## 常见误解

**「留了 200 M，就是这个组每次通信 200 M 数据。」** 不是。缓冲是中转区的容量上限，是启动时定下的配置；一次通信实际搬多少，由那次操作的张量形状决定。

**「dp 组留 50 M，说明每步同步 50 M 元数据。」** 不是。那一步同步的是几个 int32 标记，50 只是公式的下限；预算值和消息布局是两件事。

**「组数乘每组的值，就是这个进程的通信内存。」** 不成立。注册表会让键相同的组复用同一个底层组；只有本卡一个成员的组另算；收发缓冲之外通信库还有别的内部开销。配置值只是配置值，实际占用要在实机上量。

**「`HCCL_BUFFSIZE` 和 `hccl_buffer_size` 是一回事。」** 不是。前者是环境变量，管采用它的通信域和 MC2 算子的窗口；后者是逐组 Options 里的字段，只管那一个组。名字含 `mc2` 的组是被有意排除在后者之外的。

**「通信空闲时，缓冲就能全部拿来存 KV。」** 通信资源可能继续驻留，不能把空闲消息队列当成释放证据；以实际分配与释放记录为准。

## 对照源码

### 怎么开

逐组缓冲没有开关：只要建组就按组名挑值，三个常量（200 / 50 / 100）写死在源码里。[C2] 能调的是环境变量 `HCCL_BUFFSIZE`，单位是 M，作用于采用它的通信域和 MC2 算子的窗口。[S18] 本部署的启动命令和其他环境变量以官方教程为准，参数清单见[部署前提](glm-5-3-flash-two-node.md#部署前提)。要确认某个组最终用了多少，只能在实机上核：组名、成员、字段最终值和 torch_npu / CANN 版本一起记。

**环境变量的完整范围。** CANN 9.1.X 将 HCCL_BUFFSIZE 定义为不小于 1 的整数，文档单位 MB、默认 200；换算示例采用 1024×1024 字节。通信域级 HcclCommConfig.hcclBufferSize 优先于环境值，因此这里的默认不能覆盖前文由 Options 显式设置的 200/50/100。MC2 组刻意不写那个逐组字段，环境值才与算子划分窗口对齐。

固定 GLM 教程在两端启动前设置 `export HCCL_BUFFSIZE=1024`，不能再按“变量未设的 200”解释配方。按 CANN 文档的收发各一份口径，1024 对应每方向 1 GiB、两方向合计 2 GiB 的通信域缓冲预算；这不是本部署实测显存，也不能再乘逻辑组数量得到实际总占用。底层组复用、逐域覆盖与额外内部开销仍需沿前文建组链确认。MC2 tiling 检查使用它自己的单窗口尺寸，不把两方向合计再代回窗口公式。

环境值须在建组和算子初始化前传给所有 Worker；运行后只改 shell 变量不会调整已创建的通信资源。选择大小先满足实际 MC2 批量窗口，再检查剩余 KV 预算和显存峰值，不能只因网络慢就无限增大。

### 会报什么错

- 启动阶段空闲显存不足：`Free memory on device (…) on startup is less than desired GPU memory utilization`。检查发生在本轮分布式建组之前，反映此时已经存在的占用，不能归因于随后才创建的组。本轮新增通信内存对 KV 预算的影响要看后面的 profiling。[C11]
- DispatchFFNCombine 窗口装不下：`HCCL_BUFFSIZE is too SMALL, m = …, expected HCCL_BUFFSIZE is ((m * k * topK * sizeof(int8_t)) * 3 + 3MB)= %luMB, HCCL_BUFFSIZE=%luMB.`，tiling 直接返回失败。提示中的公式文字写 `+ 3MB`，实现按 `+ 10 * MB_SIZE` 判定；实际打印的 expected 数字仍由 +10 MiB 的 actualSize 向上取整得到，只照文字重算会偏小。[C15]
- 环境变量写了超过 uint16 的值：这个融合算子的解析函数记一条 warning，然后按默认 200 M 算；解析异常记一条 error。其 stoul 解析没有检查尾部是否全部消费，也不单独拒绝 0；这些解析细节不代表 CANN 接受 0 或混入文字，使用两层都合法的正整数字符串。[C14]
- Options 里出现不认识的非默认字段，或成员与 Options 记录的成员不一致：注册表算不出键，退回逐个新建，不报错。[C7]

### 开销和什么时候别开

本页这条分布式路径需要通信资源，没有“保持相同通信却把缓冲全关掉”的配置。除 mc2 外 7 个逻辑组的字段合计为 1,250 M，其中 600 M 来自单成员组；这仅是配置算术，不能直接扣减 KV 预算。[D] 调大 HCCL_BUFFSIZE 可容纳更大的通信窗口，也可能增加实际通信内存；使用前述融合算子时，调小还可能撞上 tiling 检查。应同时测显存峰值、可用 KV 块和通信耗时。

### 版本差异

**v0.30.0rc2 保留常规 HCCL buffer 预算，新增名称分支。** 普通组默认 200 MiB、DP 至少 50 MiB、dynamic_eplb 为 100 MiB；DP 的估算仍按 (dp_size+1)×4 字节向上取 MiB，再取至少 50 MiB，MC2 仍提前返回 None，不走普通 hccl_buffer_size 选项。sleep_lifecycle_anchor 名称新增 1 MiB 分派；这只证明该名称如何配置，不证明每次启动都创建它或固定多占 1 MiB。注册表和分布式补丁与已钉 main 无差分；DispatchFFNCombine 的窗口×3+10 MiB 条件保留，但 worldSize 改为显式算子属性并校验 1–768。CANN 环境变量约束仍须按实际 CANN 版本核对。

按四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；GLM 固定镜像 `db701c1f` 的常量、分派与 `DispatchFFNCombine` 判据均与 `v0.23.0` 一致。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 逐组缓冲常量与分派 | 默认 `200 MB`、`dp` $\max(\dots, 50)\text{ MB}$、`dynamic_eplb` `100 MB`、`mc2` 返回 `None` | 同 `v0.23.0`（`utils.py#L64-L66, #L1058-L1065`）[C16] | 延续上述四条分派，并新增 `sleep_lifecycle_anchor = 1 MB`（`utils.py#L73-L77, #L1249-L1288`） | 同 `v0.30.0`（`utils.py#L73-L77, #L1260-L1299`）[C17] |
| `mc2` 与 `HCCL_BUFFSIZE` 判据 | `mc2` 不写逐组字段；`DispatchFFNCombine` 读 `HCCL_BUFFSIZE`（默认 `200 MB`），窗口按 `× 3 + 10 MiB` 判 | 同 `v0.23.0` | 同 `v0.23.0`（`dispatch_ffn_combine_tiling.cpp#L63-L85`），`worldSize` 改为显式算子属性并校验 `1–768` | 同 `v0.30.0`（`dispatch_ffn_combine_tiling.cpp#L63-L85`） |
| `etp` / `edp` 扩展组归属 | 无 `etp` / `edp` | 无 `etp` / `edp` | `parallel_state.py#L87-L107` 创建 `edp`（`dp_shared_memory` 走 `gloo`，否则走 `hccl` 并落入默认 `200 MB` 分派） | `parallel_state.py#L88-L137` 补建 `etp`（`TP×DP` HCCL 组）并将 `edp` 扩至 `PCP==1` 共享 PLE；未单列缓冲键，建为 HCCL 组时均走默认 `200 MB` |
| `HCCL_BUFFSIZE_EP` 仓内读取 | 无读取 | 无读取 | **`vllm_ascend/` 与 `csrc/` 均无任何读取逻辑**；仅见于 `docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L200-L210` 示例脚本 | 同 `v0.30.0`（全仓代码零读取） |
| 复用注册表 | 按有序成员、后端、配置、复用域去重 | 同 `v0.23.0` | 延续复用键与复用域规则 | 同 `v0.30.0` |

上表确认四版的默认 `200 MB`、`dynamic_eplb 100 MB`、`dp max(..., 50 MB)`、`mc2` 提前返回 `None` 及 `DispatchFFNCombine` 窗口判据一致。注意 `HCCL_BUFFSIZE_EP` 并非 `vllm-ascend` 仓内消费的环境变量（仓内代码不读取它，仅某模型教程脚本导出），是否被特定底层 CANN/HCCL 版本消费须以现场 CANN 文档与实机分配日志核定。此外，CANN 的 `≥1`、默认 `200` 与逐域覆盖取自 9.1.X 官方文档，部署时仍须匹配实际 CANN 版本。

### 源码位置

按「谁挑值 → 谁构造 Options → 谁决定复用 → 谁记账」读，能把本页机制对回实现。

在 `db701c1f` 中，复用键保存有序的 `tuple(ranks)`，并包含规范化后的 Options 与复用域（来源 6）；协调器还要求进程内串行构造，并维持全局一致的创建顺序（来源 4 第 65–67 行）。配置合计能否对应实际分配与容量变化，取决于设备上的创建、复用及缓冲分配结果。[I]

**检索名称。** 挑值的函数是 `get_hccl_config_for_pg_options`，外层是 `create_hccl_pg_options`；DP 的公式在 `calculate_dp_buffer_size`；建组入口是 `GroupCoordinatorPatch._init_device_groups`，复用域由 `_resolve_reuse_domain` 决定，键由 `make_hccl_pg_key` 算出。显存分账在 `determine_available_memory`，非 torch 增量的口径在上游的 `memory_profiling`。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 三个常量与四条分派、mc2 提前返回 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L67-L69`、`#L1118-L1149` |
| DP 缓冲公式与下限 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L1152-L1163` |
| DP 元数据归约默认走 CPU 组、`dp_allreduce_on_npu` 的默认值 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L713-L722`、`vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L317` |
| 建组入口、复用域、整体替换上游 GroupCoordinator | `vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_distributed.py#L39-L77`、`#L100-L166` |
| 注册表的键、审计字段与冻结方式 | `vllm-ascend@db701c1f:vllm_ascend/patch/worker/_hccl_pg_registry.py#L26-L91`、`#L161-L255` |
| 上游各组的组名（world / tp / dcp / pcp / pp / dp / ep） | `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1252-L1262`、`#L1760-L1900` |
| mc2、dynamic_eplb、细粒度 TP 组的建组条件 | `vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L76-L150` |
| 显存快照在建组之前、可用 KV 的算式 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L462-L500`、`#L556-L597` |
| 非 torch 增量的口径 | `vllm@0fc695fc:vllm/utils/mem_utils.py#L263-L268` |
| MC2 读环境变量、窗口判据与报错原文 | `vllm-ascend@db701c1f:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L62-L84`、`#L283-L290` |

**正文证据索引。** 缓冲按组名挑值、mc2 不写字段见 [C1][C2]；DP 的 50 M 见 [C3]，DP=2 代入公式取下限是本页换算 [D]；DP 同步实际的 2×DP 个 int32、通道选择与默认值见来源 32–33。建组入口、复用域和注册表的键见 [C4]–[C7]，整体替换与睡眠后重建见来源 42；组名与附加条件见 [C8]–[C10]、来源 34。快照顺序、可用 KV 的算式和非 torch 口径见 [C11][C12][C13]；融合算子的解析、窗口与报错见 [C14][C15]，调用与硬件选路见来源 38–40。v0.26 与 main 缓冲分派补见来源 35–36；rc2 的窗口判据与 worldSize 常量见来源 37、41。环境变量的单位与用途见 [S18]，完整范围和收发两份口径见来源 23。KV 块 7.969 MiB、3,855 块算例取自[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，本页只做一次除法折算。[D]

显存计量使用两个不同起点：torch 峰值增量以 `before_profile` 为基准，非 torch 内存增量以 `before_create` 为基准（来源 13 第 263–268 行）；初始快照先于分布式环境初始化（来源 11 第 464–497 行）。因此，通信组在 profiling 前创建并不等于通信资源漏算；底层资源实际分配多少仍须设备计量。[I]

**待核。**

1. `mc2` 组最终的设备分配与有效窗口。固定教程已明确 HCCL_BUFFSIZE=1024，未设时 MC2 取 200 的代码默认也已核清；仍缺现场环境继承、通信域配置和实际分配日志，不能将配方值当成设备计量。
2. 只有本卡一个成员的组（pp / dcp / pcp）是否真的各占 200 M。配置值是确定的，实际设备占用缺实机计量。
3. 不同组名是否真的算出不同的注册表键。本仓代码把组名写进了那份配置，注册表又按整份配置算键（单元测试用的配置不带组名）；torch_npu 侧是否原样保留这个键，还没核实。
4. 缩小某个组的缓冲对通信耗时的影响，没有实测数据。

- 来源 20：vllm-ascend@db701c1f，vllm_ascend/patch/worker/patch_distributed.py，L39–L76。
- 来源 21、22：vllm-ascend@db701c1f，vllm_ascend/patch/worker/_hccl_pg_registry.py，L52–L90、L116–L126。
- 来源 23：CANN 9.1.X 的合法范围、默认、收发两份缓冲与通信域覆盖；24 是配方 1024。25–27 对照三版 MC2 解析，窗口判据仍在同文件第 283–290 行，配方输入、算子窗口、HCCL 缓冲预算与设备实测保持不同口径。
- 来源 43：跨组名复用测试中的模拟 Options；不能将该测试的配置直接当作真实 torch_npu 的返回值。
