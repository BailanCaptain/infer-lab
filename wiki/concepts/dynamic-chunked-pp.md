---
id: dynamic-chunked-pp
title: 动态分块流水线：按预测耗时选择 prefill 块
type: feature
summary: 从密集注意力的历史依赖解释固定长度分块的耗时差异，再看耗时预测、时间预算与 PP 流水重叠，并保留混合模型和校准误差的边界。
aliases: [动态分块流水线并行, ProfilingChunkScheduler, ChunkSizePredictor, ProfilingChunkManager, profile_prefill_latency, 动态分块 PP, 等耗时切块]
chapters: ["13"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L212-L271
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L313-L349
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L55-L94
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L273-L320
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L249-L270
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L399-L408
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L178-L220
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L795-L855
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 理解因果注意力的历史访问范围}
  - {to: chunked-prefill, kind: builds-on, note: 理解 token 预算与前缀进度}
  - {to: pipeline-parallel, kind: builds-on, note: 理解分段执行和流水线空闲}
  - {to: profiling-chunk-config, kind: builds-on, note: 查阅字段及各版本定义}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 固定 token 数为什么不等于固定工作量

[分块 prefill](chunked-prefill.md)把长输入分成若干轮，每轮只计算一部分新位置；[PP](pipeline-parallel.md)把模型层分给不同阶段，使不同块有机会在不同阶段重叠执行。固定长度分块容易管理预算，但相同数量的新 token 可能对应不同的注意力工作量。

先看普通密集因果注意力。已有 L 个历史位置，再计算 x 个新位置时，合法查询–键组合数为：

`xL + x(x+1)/2`

第一项来自所有新查询访问旧历史，第二项来自新块内部的因果三角形。例如长度 8 的序列每次处理 2 个新位置，四块分别有 3、7、11、15 对合法组合，总数仍为 36。[D] 这解释了后续块可能更重的原因，但组合数不等于耗时：投影、FFN、kernel 分块、访存、通信和调度也参与执行。

GLM 的注意力还包含 KDA 和稀疏 MLA，不能直接用这一密集公式预测整个模型耗时。KDA 用递推状态，稀疏 MLA 根据候选位置访问历史；二者与密集注意力的成本曲线不同。动态分块因此需要目标模型与执行配置下的测量或校准。

## 流水重叠取决于各块的完成时间

下面用一个**理想耗时模型**说明调度目标，时间单位任意：四个固定长度块在每个 PP 阶段分别耗时 1、3、5、7；假设两个阶段等速、忽略通信与调度开销，且计算量可以重新切成 16 个各耗时 1 的小块。[A]

```wiki-diagram
file: dynamic-chunked-pp
```

固定四块时，阶段 0 在 1、4、9、16 完成各块；阶段 1 在 2、7、14、23 完成。空闲来自下一块尚未到达。理想等时小块使阶段 0 在时刻 16 完成、阶段 1 在 17 完成。[D] 两种情况下每阶段总工作量都是 16，差别是重叠程度。

这个算例展示的是目标，不是 GLM 的性能曲线。分成更多块会增加调度、执行启动及阶段间传输次数；两个阶段实际耗时不同、取整对齐和通信等待也会重新产生空闲。因此“按耗时分块”并不保证每块完全等时或一定提速。

## 由历史进度反求下一块大小

固定 Ascend 实现的一条预测路径用二次函数近似累计耗时：`f(n)=a n²+b n+c`。已有 L 个位置，希望下一块耗时接近 τ，则解：

`f(L+x)−f(L) = a x²+(2aL+b)x = τ`

在参数有效时取正根，再经过平滑、最小块和对齐处理。[C1] 对齐粒度在这段代码中是 `max(page_size, 64)`，不是凭模型名写死为 2048。源码另外提供考虑历史长度的预测函数，不能把所有路径概括成同一个二次式。[C4]

预测值进入调度器后仍受请求剩余输入、token 预算、模型长度和可用缓存约束。运行中 prefill 的截断采用 `min(predicted_chunk, num_new_tokens)`；后面还可能进行 Mamba 块对齐。[C2] 因而预测器返回的整数不一定就是最终执行数量。

## 从测量到调度决策

这一机制至少包含三个不同对象：测量样本描述“在给定配置下多大的工作耗时多久”；预测器把当前历史进度与目标时间转换为块大小；调度器再决定本轮实际接纳的工作。

时间预算还让同一轮中的多请求竞争一个预测耗时上限，并随已接纳的 prefill 工作扣减。[C5][C6] 预测失败、校准未就绪或当前剩余时间不足时，调度器会按条件使用原有预算或停止继续接纳；源码中的分支不同，不能统一解释成“预测失败就无限继续”。[C2]

启动测量由 Worker 执行试跑；调度器按 `world_size−tp_size×pcp_size` 选择返回计时的 rank，在通常布局下对应末个 PP stage 的首 rank。样本不足会告警，不能把启动试跑描述成必然得到可靠拟合。[C7][C8] 更换模型、并行布局或执行模式后，旧曲线是否仍适用需要重新判断。

它调整的是**本轮处理多少输入**。模型层的顺序、同一请求的因果依赖、PP 阶段交接的隐藏表示都继续存在。它也没有把 decode 的自回归依赖消除。

## 版本条件与 GLM 主线的关系

本页源码基准为 `db701c1f`。配置明确要求 PP>1，并拒绝与 `enable_balance_scheduling` 同时启用；最小块超过 `max_num_batched_tokens` 时会被截到预算上限。[C3] 参数完整定义与其他分支差异见[配置参考](../params/profiling-chunk-config.md)。

官方 GLM 双机主线使用 TP/DP 配置，不是本页的动态 PP 实验。本页没有将普通密集模型的校准曲线、旧模型的块大小或其他硬件的收益移植为 GLM 结论。验证某个新组合时，需要同时检查调度器选择、图执行、混合状态对齐、PP 支持和实测曲线。

无设备读者可以先复算 3/7/11/15 的注意力组合数，再沿图验证 23 与 17 的理想完成时间。前者解释计算依赖，后者解释流水重叠；两者都不替代设备测量。
