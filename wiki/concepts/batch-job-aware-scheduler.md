---
id: batch-job-aware-scheduler
title: 批作业感知调度：为运行请求保留增长空间
type: feature
summary: 从缓存增长与抢占成本出发，解释预留预算、作业分组和输出长度估计如何共同影响等待请求的准入。
aliases: ["Batch-Job-Aware Scheduler","批作业感知调度器","BatchJobAwareScheduler","batch_job_sched_config","job_name","EWMA"]
chapters: ["12"]
order: 40
sources:
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L622-L641
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L238-L287
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L509-L541
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L57-L74
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L126-L173
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L554-L609
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L315-L333
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L643-L682
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L496-L507
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L3-L5
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L757-L802
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L680
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L709-L725
verified: []
evidence: "C"
relations:
  - {to: vllm-scheduler, kind: builds-on, note: 理解等待队列如何影响准入}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 理解缓存增长与抢占回收}
  - {to: chunked-prefill, kind: builds-on, note: 理解当前轮和下一轮的输入预算}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 空闲块需要覆盖后续增长

离线批处理往往一次提交大量请求。若仅按当前剩余缓存接纳新请求，运行中的请求在后续生成时可能没有空间继续增长，随后发生抢占和恢复。

**批作业感知调度**在等待队列准入前，先估计运行请求下一轮还需要多少新块，再将剩余空间用于新请求。同时，它按作业分组，利用已完成请求估计同一作业的输出长度，调整选择顺序。[C1]

本页依据 v0.26 分支 2026-09-17 的 `2ed6cbba` 快照。官方将它定位于批处理或不在意等待时间的负载。[S10] 这是 GLM 专用基线之外的扩展，页面没有提供已经验证的 GLM 启动组合。

## 预留改变的是准入预算

设空闲块为 F，估计下一轮新增需求为 R，安全余量为 m，预留上限为 M，每块对应 B 个调度位置。该实现计算：[C2][C3]

`预留块 P = min(R + m, M)`

`准入位置预算 = max(0, (F − P) × B)`

这里的预留是等待队列扣减预算的策略，不是立即创建专属于某个请求的物理块。真正的分配仍由缓存管理器完成。

```wiki-diagram
file: batch-job-aware-scheduler
```

图假设 F=6、R=1、m=2、M=8、B=4。[A] 预留 P=3，剩余准入预算为 (6−3)×4=12 个位置。[D] 若直接把六个空闲块都用于准入，预算则是 24。保守准入减少本轮接纳量，为已有请求的增长保留空间；估计失准时仍可能抢占。

B=4 是便于手算的抽象单位，并非 GLM 的实际 block size。混合模型各缓存组的物理页与状态容量应按[缓存分配](vllm-kv-block-allocation.md)计算，不能把该预算直接换算为统一的每 token 显存。

## 先模拟当前轮，再预测下一轮

预留器先估计当前轮会推进多少位置，再从推进后的位置预测下一轮需求。prefill 使用剩余输入与本步预算，decode 使用一个输出位置加 lookahead 位置。[C2]

例如 B=4、没有 lookahead，某 decode 请求已经计算 3 个位置，本轮再计算 1 个。[A] 估计位置推进到 4，当前块刚好用完；下一轮新增 1 个位置需要新块，因此 R 为 1。[D] 若已计算位置为 2，本轮推进到 3，块中仍剩 1 个位置，下一轮原始新增需求为 0。

多请求的需求还要聚合，并受余量与预留上限控制。它是启发式预测，不能保证覆盖任意长输出或实际分片边界。

## 作业身份与输出长度估计

实现从请求 ID 中查找 `#job_name[作业名]#`；没有标签的请求归入默认作业。[C4] 作业标签用于共享统计，不是模型输入内容。

估计器没有样本时返回 128。第一个自然结束的请求直接形成初值，后续采用指数移动平均：`新估计 = 0.1 × 新样本 + 0.9 × 旧估计`，最多采集十个样本。[C5] 比如先观察到输出长度 20，再观察到 40，更新为 22。[D]

只有自然停止的请求会进入观察；达到生成上限而结束的请求不进入这条更新路径。[C8] 因此流量若长期由长度上限截断，估计可能保持初值，不能把它当作准确的剩余生成长度预测。

## 怎样选择等待请求

有准入余量时，实现先尝试每个作业的冷启动请求，再根据估计输出长度选择作业。余量高于阈值时偏向长输出作业，余量较紧时偏向短输出作业。[C3][C6] 冷启动路径与普通 best-fit 路径不同，不保证其 prompt 小于当前准入预算。

当长、短两类作业都非空时，代码在每一类内部都按估计输出长度降序排列，再决定哪一类在前；只有一类时，类内方向才随余量条件改变。[C6] 因而它是一组作业级启发式，不是严格的最短作业优先。

在选定作业内，普通路径取输入长度不超过预算的最长请求；全部超过时返回最短请求，后续仍由调度器的分片和资源条件决定能处理多少。[C7] 该队列替换的是 `waiting`，不等于接管框架所有被阻塞或跳过的请求路径。[C1]

## 限制与成本

该策略没有完整的饥饿保护。减少预留会增加准入机会，也可能增加后续抢占；增大预留可能使设备利用不足。输出估计和缓存预算的误差都需要通过负载评估观察。

该快照的作业桶数量和统计数量都有上限检查，超过会抛异常；`max_jobs=0` 的桶检查与估计器检查不一致，不能用它表示可靠的无限作业模式。[C5][C9] 默认预留余量为 2 块、上限为 8 块，仍应按实际页大小理解成本。[C11]

短请求优先与此策略有显式互斥；profiling chunk 与批作业调度在平台配置中连续赋值，存在后者覆盖前者调度器类的路径。[C12][C13] 异步则有专门组合类。[C8] 配置入口是 `additional_config.scheduler_config.batch_job_sched_config`；本页保留机制和已核条件，不给未经设备验证的调优值或输出逐 token 相同保证。

