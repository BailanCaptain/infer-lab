---
id: eplb
title: EPLB：专家负载统计与物理放置调整
type: feature
summary: 区分逻辑专家和设备槽位，通过局部负载算例解释专家迁移、冗余副本、映射切换以及统计和传输的成本。
aliases: ["EPLB","Expert Parallelism Load Balancer","专家负载均衡","dynamic_eplb","log2phy","冗余专家"]
chapters: ["14"]
order: 30
sources:
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L513-L539
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_utils.py#L46-L107
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_utils.py#L110-L136
  - vllm-ascend@db701c1f:vllm_ascend/eplb/eplb_updator.py#L79-L153
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L337-L410
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_device_transfer_loader.py#L46-L95
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_device_transfer_loader.py#L97-L138
  - vllm-ascend@db701c1f:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L72-L146
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L816-L873
verified: []
evidence: "C"
relations:
  - {to: expert-parallel, kind: builds-on, note: 理解专家权重如何分配到设备}
  - {to: moe, kind: builds-on, note: 理解逻辑路由和专家函数}
  - {to: collective-communication, kind: builds-on, note: 理解专家激活和权重搬运的不同通信}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 专家数量相同，不代表负载相同

[专家并行](expert-parallel.md)把不同专家的权重放在不同设备。每个 token 由路由器选择逻辑专家，因此一段流量中，某些专家可能收到更多输入。两台设备即使各存同样数量的专家，执行负载也可能不同。

**EPLB（Expert Parallelism Load Balancer）**统计专家被调用的负载，再调整专家权重所在的物理槽位，必要时使用额外副本。它优化的是逻辑专家到物理设备的映射；逻辑专家代表的函数和权重内容应保持一致。

## 一个局部放置算例

从一层中取四个逻辑专家 E0–E3，用两个设备的四个槽位解释放置关系，其他专家省略。设统计窗口内的专家调用数为 [8,8,2,2]。[A] 这些数是 token–expert 分配次数，一个 token 可以贡献多次分配。

```wiki-diagram
file: eplb
```

初始设备 0 放 E0、E1，负载为 16；设备 1 放 E2、E3，负载为 4。交换 E1 与 E2 后，两边都为 10。[D] 这个局部例子说明放置的作用，不是固定策略保证返回的最优方案，也不是 GLM 全层的实际专家数量或实测分布。

新的放置仅对后续执行有意义。若流量热点在统计和调整期间已经变化，旧统计对应的布局可能不再合适。

## 逻辑专家与物理槽位

路由器选择的是 E0 这样的逻辑身份。映射表再把身份转换为本 rank 的槽位或全局物理位置，使通信和专家执行找到正确权重。[C2][C3]

冗余专家是在不同物理槽位保存同一个逻辑专家的权重，消耗额外空间，以增加分担热点的机会。固定映射生成还会根据 rank、TP 大小和专家身份选择副本。[C3] 因此副本不是新的独立专家函数，也不增加路由器的逻辑专家种类。

实际计算可能因批次、物理路径和浮点归约顺序而产生差异。保持逻辑专家函数不变，不等于保证任意执行下输出数值逐位相同，更不等于无条件保证所有生成 token 完全一致。

## 从统计到切换的一个周期

固定 v0.23 接口路径从算子返回的专家计数累积负载；若计数使用累加边界形式，先差分还原各专家数量。[C1] 更新器随后收集各 rank 的统计，将规划交给独立进程，再按层组织权重更新。[C4][C5]

```wiki-diagram
file: eplb-cycle
```

权重更新不能只修改映射表。发送侧需提供专家权重，接收侧先放入缓冲；传输完成后，执行侧再更新映射、逻辑到物理关系与本地权重。[C6][C7] 映射指向和权重内容必须在可用边界上保持一致，否则会调用错误的专家。

固定实现将统计、规划间隔和逐层更新划分为不同阶段；更新周期按这些阶段计数，并不意味着每步都重排所有层。[C4]

## 额外内存与通信是实际代价

除冗余专家权重外，更新还需要接收缓冲。适配器按专家权重形状创建这些缓冲，因此不能只按冗余专家数量估计全部额外内存。[C8]

后台规划减少对主执行的直接占用，但规划结果读取仍可能等待；权重传输也会使用链路，并在切换前等待完成。[C4][C7] 它可能与 token dispatch/combine 争用通信资源。热点持续时间、更新频率、层数和权重大小共同决定均衡是否划算。

## 固定配置与 GLM 边界

本页依据 GLM 专用源码快照，专家算子部分明确引用其中普通 v0.23 接口文件；实际安装接口的选择仍需遵循[来源基线](../sources/glm-5-3-flash-baseline.md)。

配置区分动态调整、静态专家映射和记录映射。固定实现默认动态调整关闭，冗余数为 0；动态路径还检查相应环境变量。专家总物理槽位与 EP 规模需要满足布局条件。[C2][C9] 这些是机制条件，不是让初学者直接复制的最佳参数。

权重搬运还受到实际量化布局约束。适配器以 `(quant_type, enable_fused_mc2 == 1)` 选择需要搬运的权重张量集合；`W4A8MXFP` 在此快照中被显式拒绝，其他组合若不在映射表中也会报错。[C8] 因此相同的专家数量和 EP 规模，不足以证明某种量化权重能够使用这条更新路径。

GLM 官方双机命令启用专家并行，EP 与 EPLB 是不同能力：前者分布专家计算，后者进一步调整物理放置。主线命令没有因此自动证明 EPLB、量化权重和 MTP 的组合已验证。

