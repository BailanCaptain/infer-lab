---
id: async-scheduling
title: 异步调度：让主机准备与设备计算重叠
type: feature
summary: 跟踪计划、占位记账和结果确认，解释异步调度如何缩短设备等待，以及取消、缓存和自定义调度器需要满足的条件。
aliases: ["异步调度","Async Scheduling","AsyncScheduler","num_output_placeholders","async_scheduling"]
chapters: ["12"]
order: 20
sources:
  - vllm@0fc695fc:vllm/config/vllm.py#L497-L507
  - vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L67
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L407
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2547-L2583
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2683-L2697
  - vllm@0fc695fc:vllm/config/vllm.py#L933-L1002
  - vllm@0fc695fc:vllm/config/scheduler.py#L146-L188
verified: []
evidence: "C"
relations:
  - {to: vllm-scheduler, kind: builds-on, note: 理解每步计划中的请求与token预算}
  - {to: npu-model-runner, kind: builds-on, note: 理解设备输入准备和采样结果}
  - {to: speculative-decoding, kind: builds-on, note: 区分下一步占位与实际接受的草稿token}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 一步计算之外，还有主机端的准备工作

[调度器](vllm-scheduler.md)决定本步处理哪些请求、各处理多少新位置，Worker 再准备输入、执行模型并采样。主机还要接收结果、更新请求状态、准备后续计划。如果这些工作严格串行，设备完成一轮后可能等待主机。

**异步调度**允许主机在前一批设备工作尚未完全回收时，准备和提交后续批次。它保持模型的自回归依赖：下一位置的前向仍需要前一轮产生的 token；提前完成的是计划和部分准备工作。

```wiki-diagram
file: async-scheduling
```

图把每轮主机准备设为 1 个时间单位、设备计算设为 3 个单位，比较两个批次的理想时序。[A] 串行需要 8 个单位；第二次准备若能与第一次设备计算重叠，两批设备工作可在第 7 个单位结束。[D] 真实执行还受采样、同步、进程通信和批次依赖影响，图中的差值不是性能测量。

## 计划可以提前，输入值仍须按依赖到位

上游参考实现用有界批次队列保存尚未回收的工作，并在结果可用时更新调度状态。[C2][C3] V1 Runner、PP=1 且开启异步时，并发批次数为 2；PP 或其他 Runner 的取值按配置计算，不能统一理解成任意场景都只保留两批。[C1]

调度器提前安排一个生成位置时，可能还没有收到该位置的 token ID。它通过 `num_output_placeholders` 记录未确认的输出数量；对本步会产生输出的请求，增加量包含一个正常输出位置和本步草稿位置。仍处于 prefill 分片的请求会跳过这项更新。[C4]

在一次不含投机解码的教学步骤中，已知序列有 8 个 token，本步已安排计算到第 8 个位置，预期产生一个输出但还未回收。[A] 下一轮需要安排的位置数为：

`已知 8 + 输出占位 1 − 已安排计算 8 = 1`。[C5][D]

这里的“1”表示待计算位置数量，未指定词表中的哪一个 token。Worker 必须在真正执行该位置前取得正确 ID。

## 昇腾如何衔接设备值和主机记账

固定 Ascend Runner 在不含草稿 token 的异步路径中，将采样结果保留在设备张量 `prev_sampled_token_ids`，供后续输入准备使用，减少立即同步到主机再传回设备的依赖。[C7]

同时，它返回异步输出对象，携带采样结果、拷贝流与完成事件，并登记主机侧结果缓冲。[C6] **结果最终仍会回到 CPU，参与请求进度和输出处理**；异步改变等待时机，并未取消这条数据路径。

真实 token 到达调度器后，占位数按有效输出数扣减。前缀缓存的登记边界相应扣除尚未确认的占位，避免把预期输出当作已确认历史。[C4] 投机解码时还需要结合接受和拒绝结果，因此占位数与最终输出数不能直接画等号。

## 强制清空前缀缓存时的在途结果

固定异步调度器有一条明确的旧输出丢弃路径：`reset_prefix_cache` 强制抢占请求后，`async_tokens_to_discard` 记录需要丢弃的旧在途输出帧。后续每收到一帧就递减计数并跳过更新；正常输出更新则扣减对应占位，并检查占位数非负。[C4] 这条路径的适用条件是强制清空前缀缓存触发的抢占，普通取消与其他结束路径需要按各自状态处理核对。

这也是自定义调度器必须实现异步协议的原因。配置中的 `scheduler_cls` 一旦指定，上游就直接选择该类；不会自动将任意同步调度器改造为异步版本。[C9] 调度策略、批次队列和 Worker 必须使用相容的状态记账。

## 适用配置与主模型边界

本页的主机机制引用普通上游 v0.23 参考快照，设备衔接引用 GLM 专用源码快照；两者实际安装组合仍按[来源基线](../sources/glm-5-3-flash-baseline.md)核对。

`async_scheduling=None` 表示由配置检查决定，而非无条件启用。参考实现会检查模型类型、投机方法、草稿批次配置及执行器能力；显式开启遇到部分不兼容项会报错，自动分支则可能关闭。[C8] GLM 官方命令启用 MTP，本页的单输出算例只用于说明占位记账，并未替代真实 MTP 路径。

收益取决于可重叠的主机工作有多少；代价包括更多在途状态和更复杂的结果确认。评估时同时观察吞吐、首 token 延迟和生成间隔，不能仅凭“设备等待减少”推断每个请求都会更快。

