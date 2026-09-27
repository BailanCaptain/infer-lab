---
id: chunked-prefill
title: "分块 Prefill：在轮次之间分配长输入"
type: feature
summary: 分块 Prefill 将长输入分多轮推进，并跨轮保存状态；它让调度器有机会混合处理生成请求与新输入，但 token 预算不保证固定时延。
aliases: [Chunked Prefill, 分块预填充, 分块 Prefill]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L420
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L338
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225
verified: []
evidence: "C"
relations:
  - { to: prefill, kind: variant-of, note: 将同一个请求的 Prefill 分配到多个执行轮次 }
  - { to: concurrent-requests, kind: builds-on, note: 通过每轮预算混合长输入与已有生成请求 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 长输入可以分轮推进

整段 Prefill 的本轮工作量随输入长度增加，可能拉长同批生成请求等待结果的时间。分块使调度器能在轮次边界重新分配工作，但不能保证固定输出间隔。一个长 prompt 因而不必在单轮全部处理。调度器可以给它分配本轮可用的 token 预算，先计算一段并保留状态，下一轮继续处理后续位置。分段不改变位置编号和因果关系；后段仍建立在此前已处理的上下文上。

```wiki-diagram
file: chunked-prefill
```

图中假设每轮预算为 6 个输入位置，A 每轮进行一个普通 Decode，C 有 12 个 Prefill 位置。在两请求均可运行、缓存足够且每轮先给 A 一个位置的教学安排中，C 三轮分别处理 5、5、2 个位置。最后一轮剩余预算不一定必须用满；本例假设没有额外的块对齐约束。[A]

## 只有处理到 prompt 末尾才产生首个回答

第一轮结束后，C 已有前五个位置的状态；第二轮延续到十个位置。它们还不是完整 prompt 的下一 token 分布。固定 Runner 对未完成输入的请求标记丢弃采样结果，避免把中间段的结果作为首个回答返回。[C2]

第三轮处理末两个位置后，才可根据 prompt 最后位置产生 C 的首个输出。A 同期的 Decode 则使用自己的状态，两个请求的序列边界和历史映射保持独立。

## token 预算与缓存块大小不同

token 预算限制本轮计划处理的输入规模；缓存块大小控制存储和寻址粒度。两者可能碰巧相同，但含义不同。调整预算不等于把缓存页改成同样大小，也不能从某个示例中的 2048 推出 GLM 两项配置都为 2048。

实际调度还受运行请求数、缓存容量、已计算进度、投机预留和抢占等因素影响。[C1] 图中安排是可手算的示例，不是对调度策略或服务公平性的保证。

混合缓存还可能约束切分边界。所引通用上游在 Mamba 状态采用 align 模式时使用块对齐切分；GLM 专用分支在 APC 与 align 同时启用时，将状态块大小设为对齐后的缓存块大小。[C4][C5] 因此图中的 5+5+2 不能直接套到任意 APC 配置，最终有效配置仍须核对。

## 历史状态必须跨段延续

在 MLA 层，后段查询使用已保存历史与本段新增表示；在 KDA 层，chunk 路径读取初始递推状态并写回最终状态。[C3] 不同机制的状态读取方式不同，不能把“历史长度之和”直接当作实际 HBM 读取量。

分段也会增加轮次、元数据处理和某些重复工作。适当预算可能改善长输入与生成请求之间的相互影响，但每轮耗时还取决于模型、序列长度、批次和通信，token 上限不是毫秒上限。

## 如何评价一次配置调整

观察首 token 延迟、输出间隔、总吞吐及长短请求之间的分布，并记录并发、输入输出长度和有效预算。只看平均吞吐可能掩盖长请求等待，只看短请求输出间隔也可能忽略 Prefill 推进速度。

无设备时可以复算图中的预算和累计位置，并沿[输入准备](prepare-inputs-flow.md)检查每段起始位置与已有状态是否一致；本页未给出任何实测收益。


