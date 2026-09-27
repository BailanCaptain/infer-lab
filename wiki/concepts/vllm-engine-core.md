---
id: vllm-engine-core
title: EngineCore：调度、执行与结果更新如何形成迭代
type: concept
summary: EngineCore 持续接收请求和控制消息，安排批次执行并提交结果。一次引擎迭代不等于每个请求产生一个 token，批次队列还会改变调度与执行的重叠方式。
aliases: [busy loop, 引擎循环, engine step, EngineCoreProc, run_busy_loop, step]
chapters: ["10"]
order: 20
sources:
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1250
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L482
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L550
  - vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1340
verified: []
evidence: "C"
relations:
  - {to: vllm-v1-shape, kind: builds-on, note: 在组件职责图中定位引擎的调度与结果更新}
  - {to: concurrent-requests, kind: builds-on, note: 将多请求的轮次推演对应到引擎迭代}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 引擎协调请求进度和设备执行

自回归生成需要反复运行模型，但服务不能给每个请求各启动一套互不相干的设备循环。EngineCore 汇总当前请求，安排一轮工作，将结果更新到各请求记录，再进入下一轮。模型计算、缓存管理和输出处理围绕这次交接协作。

```wiki-diagram
file: engine-core-loop
```

[并发请求页](concurrent-requests.md)的 AB、AB、AC、C 四轮可以由同一个引擎依次安排。批次成员随完成和新到达请求变化，模型权重与仍在运行的请求状态持续保留。

## 一次基本执行的交接顺序

固定上游的 `step()` 先检查是否有请求，再调用 Scheduler 形成计划，异步提交给 Executor。在获取结果之前，可以准备结构化输出所需的 grammar bitmask；拿到结果后处理取消队列，再更新调度状态。[C2]

这里的“异步提交”指调用可先返回 future。它与“调度下一批和当前批计算重叠”不是同一个保证：后者还取决于批次队列和执行路径。先区分接口行为，再讨论具体重叠。

结果更新以请求为单位处理，但一个批次可以同时含多个请求。Scheduler 根据返回内容推进输出、计算进度和结束状态，并不是把一个公共 token 广播给所有请求。[C5]

## 一轮产生多少 token 取决于工作内容

| 本轮处理的工作 | 可能返回的可见输出 |
|---|---|
| 普通完整 Prefill | 到达提示词末尾后产生首个生成 token |
| 尚未完成的 Prefill 分块 | 尚无可返回的生成 token |
| 普通 Decode | 对具备采样条件的请求通常生成一个 token |
| 投机验证 | 根据候选接受情况提交多个 token 或回退后的输出 |
| 空安排、取消或控制处理 | 可能没有模型生成输出 |

因此，普通四输入、三输出且没有分块/复用/投机的教学例子需要三次模型前向；这个数量是特定假设下的推导，不是 EngineCore 所有迭代的通用规律。[D] 服务中还可能有调度等待、取消和状态传输，不能从回答长度直接推算引擎执行总轮数或耗时。

## 批次队列改变重叠方式

当配置允许多个并发批次，EngineCore 会建立 batch queue，并选用 `step_with_batch_queue()`。[C4] 这条路径在容量允许时先提交新的批次，同时管理已提交工作及其 future，再处理完成结果。[C3]

队列可减少主机调度与设备计算之间的空隙，但它也需要维护尚未最终确认的进度和输出依赖。是否启用、兼容哪些执行器及模型特性，应查看实际版本配置和启动日志；不能把自动配置的某个结果写成所有 GLM 部署的默认事实。

逐轮静态图适合解释因果关系；重叠行为在[异步调度](async-scheduling.md)中用时间轴展开。图中的左右距离和箭头长度不代表测得的时延。

## 没有待处理工作时如何等待

外层循环交替处理输入队列与引擎步进。常规空闲路径会等待新消息，而不是持续提交空模型计算；具体等待行为仍受控制状态和队列配置影响。[C1] 输入消息也不只有新请求，还包括取消和其他控制操作。

一次取消可能在模型执行期间到达。基本 `step()` 在提交结果更新前处理取消队列，避免把已经终止的请求继续当作正常运行请求推进。[C2] 这也是“设备算完”与“服务提交结果”需要区分的原因。

## 与邻近组件的接口

EngineCore 决定何时协调一次工作，Scheduler 决定安排哪些输入及资源，Executor/Worker 负责执行交接，Runner 完成张量准备和模型调用。阅读[调度器](vllm-scheduler.md)时跟踪预算和进度；阅读 [Runner](npu-model-runner.md)时跟踪张量与输出。这两条视角在调度计划和执行结果上连接。

本页是上游 `0fc695fc` 的基本控制流说明。Ascend 专用快照及完整部署待核项见[来源基线](../sources/glm-5-3-flash-baseline.md)；未通过设备实测推断默认并发方式或性能。
