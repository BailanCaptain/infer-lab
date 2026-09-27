---
id: short-request-first
title: 短请求优先：等待顺序与长请求公平性
type: feature
summary: 用同一组长短输入比较准入顺序，解释恢复请求、短输入、老化长输入的优先关系，以及它与分块预填充的职责区别。
aliases: ["ShortRequestFirst","短请求优先","short_request_first_config","long_max_wait_ms","ShortRequestFirstAsyncScheduler"]
chapters: ["12"]
order: 30
sources:
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L148-L182
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L329-L367
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L237-L255
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L939-L965
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L680
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L370-L384
verified: []
evidence: "C"
relations:
  - {to: vllm-scheduler, kind: builds-on, note: 理解等待准入与运行请求的区别}
  - {to: chunked-prefill, kind: builds-on, note: 理解被选中后如何按token预算分片}
  - {to: async-scheduling, kind: builds-on, note: 理解队列策略与异步执行的组合}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 输入长度不同，先到先服务会怎样

[调度器](vllm-scheduler.md)通常先处理运行中的请求，再利用剩余预算接纳等待请求。等待队列采用先到先服务时，较早到达的长输入可能占去大部分 prefill 预算，使后续短输入继续排队。

**短请求优先**改变等待请求的选择顺序。它根据输入长度分类，不预测输出总长度，也不取代本步 token 预算、缓存分配或模型执行。

本页讲 v0.26 分支的 2026-09-17 源码快照（`2ed6cbba`）。它是独立的调度扩展阅读；GLM 专用基线没有这份实现，以下算例不是主模型已验证的启用配置。

## 同一组请求，两种准入结果

设本步预算为 16 个 token，暂无运行请求，等待顺序为长输入 A=8、B=8，随后是短输入 C=2、D=2。短输入阈值设为 2；允许分块 prefill，且不受缓存、并发数或混合状态对齐的额外限制。[A]

```wiki-diagram
file: short-request-first
```

| 等待顺序 | 本步分配 | 留到后续的输入 |
|---|---|---|
| 先到先服务 | A 8 + B 8 = 16 | C 2、D 2 |
| 短请求优先 | C 2 + D 2 + A 8 + B 4 = 16 | B 剩余 4 |

C、D 的 prefill 在这一轮完成，B 的完成时间后移。[D] 首 token 的实际到达时间还包含模型计算、采样和返回，不能仅用调度轮数替代毫秒延迟。

B 能分成两轮来自[分块预填充](chunked-prefill.md)。队列策略决定先选谁，分片机制决定选中后这一轮处理多少，两者解决不同问题。

## 三类队列与选择次序

固定扩展把普通等待队列替换为三类队列：[C1][C2]

1. **恢复请求**：曾被抢占，或已有计算进度、输出的请求，优先于新请求恢复。
2. **短输入**：输入 token 数不超过阈值的新请求。
3. **长输入**：输入 token 数超过阈值的新请求。

启用等待老化后，长队列头部达到等待阈值时，可以在短输入前被选择；恢复队列仍先于它。否则选择短队列，再选择长队列。[C1] 这是队列头部的提升规则，并非对所有长请求承诺端到端截止时间。

队列还将 `peek` 选中的请求固定到对应的 `pop`，避免两次操作之间老化状态变化，导致查看和移除的不是同一个请求。[C3]

## 为什么不能只看短请求的收益

改变顺序重新分配了等待时间。短输入持续到达时，长输入可能长期得不到准入；频繁提升老化长输入又会降低短输入的优先收益。恢复请求优先还会影响新请求可用的机会。

该快照默认阈值为 256 个输入 token，而 `long_max_wait_ms=0` 表示不启用长请求老化。[C4] 默认值只是实现选择，不是适用于任意流量的公平性结论。评估应分别统计长短输入的等待分布、首 token 延迟、最长等待以及抢占次数。

此外，输入短不代表总计算量少：短 prompt 仍可能生成很长的回答。这个策略改善的是输入阶段的等待顺序，并不等价于已知完整作业长度时的最短作业优先。

## 扩展版本的接入条件

该快照要求基础调度策略为 FCFS；允许 prefill 或混部服务，拒绝 PD 分离的 D consumer。它与批作业感知调度、profiling chunk 配置互斥。[C5]

配置位于 `additional_config.scheduler_config.short_request_first_config`，包含 `enabled`、`threshold`、`long_max_wait_ms`。[C4] 异步模式另有专门的 `ShortRequestFirstAsyncScheduler`，负责组合等待队列和上游异步协议。[C6]

GLM 的混合状态、MTP 与官方双机配置有额外条件。将这里的队列思想应用到主模型前，需要核对同一安装版本的实现和兼容性；教学算例没有假定 GLM 可以按任意 4-token 片段执行。

