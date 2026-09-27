---
id: recompute-scheduler
title: 重计算调度：D 端容量不足时如何恢复请求
type: feature
summary: 沿分配失败、状态保存或重建、代理续接解释D端恢复路径，区分普通抢占、保存缓存以及重新进入prefill的成本。
aliases: ["RecomputeScheduler","重计算调度","recompute_scheduler_enable","AsyncRecomputeScheduler","recomputed"]
chapters: ["12"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L700
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L280-L345
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L869-L880
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L1029-L1064
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L138-L169
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L509-L555
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L59-L72
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L98-L134
verified: []
evidence: "C"
relations:
  - {to: pd-disaggregation, kind: builds-on, note: 理解P/D之间的历史状态交接}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 理解增长时的目的块分配失败}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 已开始生成的请求仍可能需要更多空间

[PD 分离](pd-disaggregation.md)把输入阶段与持续生成分开。D 端已经取得历史状态后，每轮生成仍需要新位置和相应存储；设备容量不足时，缓存分配可能失败。

普通抢占通常让请求暂时退出运行集合，之后重新获得资源并恢复。**RecomputeScheduler**为分离部署的 D consumer 补充了恢复路径：能够保存状态时走保存与恢复；否则向外部代理报告需要重新组织请求，由 P/D 服务重新接续。

这一机制服务于容量压力，不改变自回归推理所需的历史，也不是把模型权重重新训练或重新加载。

## 分配失败后的两条分支

固定源码在为运行请求申请新块失败时，取出运行集合中的一个请求，记录它的块和计算进度，再询问连接器的 `update_state_before_preempt` hook 是否成功接管保存。[C2]

```wiki-diagram
file: recompute-scheduler
```

- **保存成功**：将块与计算进度写入抢占数据，进入对应抢占/恢复协议。具体怎样保存、何时释放及怎样重载由连接器负责，可继续阅读 [CPU offload](recompute-cpu-offload.md)。
- **没有保存路径或保存未成功**：释放该请求当前块，记录重计算请求信息，并向引擎输出 `stop_reason="recomputed"`。[C2][C3]

两条分支的成本不同。保存状态需要存储空间与搬运；重建需要重新计算前缀，并再次完成阶段交接。名称中的“重计算”不表示所有请求在每次抢占后都必然从头执行全部前缀。

## 代理怎样续接已经返回的内容

固定示例代理识别 `recomputed` 后，将此前收集的生成内容追加到原输入，调整剩余输出预算，并重新分配服务实例。[C4] 因而客户端已经看到的输出与后续恢复请求需要保持一致的边界。

设原始输入序列为 [p₀,p₁,p₂,p₃]，已经返回 [y₀,y₁]。[A] 在重新 prefill 的抽象路径中，恢复输入应代表原始上下文与这段已确认输出，然后继续产生后续位置；已返回内容不能再次作为新增输出重复发送。

该示例代理实际拼接的是收集到的文本，而不是提供一个通用的、按 token ID 无损续接协议。[C4] 聊天模板、结构化输出、文本重新分词、停止条件和剩余 token 预算均可能影响恢复语义，因此不能据此承诺任意请求都逐 token 等同于未中断执行。

## 重新进入执行前仍要确认状态就绪

接收或恢复路径会结合本地缓存命中和连接器外部命中。外部状态异步加载时，本步不为这项请求安排新的模型计算；接收完成后再更新计算边界。[C5][C6]

在完整命中时，所引恢复逻辑仍保留最后位置的重新计算。MTP consumer 还会在满足长度条件时设置草稿占位，衔接相应执行形状。[C5][C8] 这些是调度状态和输入准备的要求，不构成任意混合模型、量化布局或图模式组合的支持证明。

## 适用角色与工程代价

在 GLM 专用源码快照中，平台仅允许 D consumer 真正启用这套调度器。P producer 上的开关会告警并关闭；混部或缺少相应 KV-transfer 角色会报错。[C1] 开启异步时配置选择 `AsyncRecomputeScheduler`，同步时选择普通版本。[C7]

主要代价包括中断后的等待、状态搬运或重建计算，以及代理端额外的续接管理。频繁恢复可能降低吞吐并增加尾部延迟，不能把它视为对缓存容量不足的免费补偿。

[GLM 官方双机主线](../sources/glm-5-3-flash-baseline.md)没有拆成 P/D，也没有通过该开关证明主模型恢复组合已验证。本页给出固定源码的机制与限制，不提供未经设备执行的容错或性能承诺。

