---
id: who-owns-what
title: vLLM 与昇腾各管什么
type: concept
summary: vLLM 决定这一步算哪些 token，昇腾决定这些 token 怎么算出来。分界线落在调度交出 SchedulerOutput 的那一刻，也正好是进程边界。
aliases: [分工, 边界, vLLM 与 vllm-ascend, 关键代码在哪, 版本锁]
chapters: ["10"]
order: 30
sources:
  - vllm@0fc695fc:vllm/platforms/interface.py#L105-L112
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L65-L70
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L346
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L110-L120
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L130-L140
  - vllm@0fc695fc:vllm/v1/engine/core.py#L95-L100
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L180
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L610-L626
  - vllm-ascend@2c59ff10:docs/source/community/versioning_policy.md#L1-L3
  - vllm-ascend@2c59ff10:docs/source/community/versioning_policy.md#L119-L126
  - https://docs.vllm.ai/projects/ascend/en/latest/community/versioning_policy.html
  - vllm@0fc695fc:vllm/platforms/interface.py#L259-L267
  - vllm@0fc695fc:vllm/platforms/interface.py#L427-L468
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L50-L50
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L677-L725
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: ascend-patch-system
    kind: builds-on
    note: 上游没留口子的那部分怎么办，是这条边界唯一说不清的地方，机制在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求是这条界线两侧分工最具体的例子
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

**vLLM 决定「这一步算哪些 token」，昇腾决定「这些 token 怎么算出来」。** 凡是「选择与分配」在上游，凡是「怎么算出来」在昇腾侧。

```wiki-diagram
file: ownership-boundary
```

## 那条请求走到这里

把[那条请求](one-request.md)放到这条界线上，分工一眼就清楚了：

- 上游说「这一步算它 1 个 token」「它手上有 `[b0, b1]` 两块」——**选择与分配**；
- 昇腾算出「这个 token 写进 `b1 × 128 + 0` 这一格」，再让算子真的把 K 和 V 写进去——**怎么算出来**。

界线正好落在这两句话之间，而且这两句话分别发生在两个进程里 [D]。

## 分界线的准确位置

界线不在某个目录上，而在一条请求的时间线上：**上游把决定好的 `SchedulerOutput` 交出来的那一刻**。

在那之前，`Scheduler.schedule()` 已经定完了这一步跑哪几条序列、每条跑几个 token [C2][C3]，`KVCacheManager` 和 `BlockPool` 也已经把 KV block 分配好了 [C4][C5]。昇腾拿到的是一份既成事实。

在那之后，全部是「怎么执行」：用哪个注意力后端、每个 token 落进 KV 的哪个槽位 [C8]、算子在 AI Core 上怎么算、跨卡怎么通信。

这个位置**同时是进程边界**——调度跑在 EngineCore 进程 [C6]，执行跑在 Worker 进程。所以它不只是职责划分，也是一道物理隔离：昇腾侧没法回头改上游已经做出的选择，只能执行。

## 为什么会觉得「关键东西都在 vLLM 里」

因为昇腾侧的**入口代码确实很薄**：几个 entry point、一个平台类、一堆配置解析。如果只读这部分，结论自然是「一个挂钩子的壳」。

但那是接缝，不是主体。主体是那条界线之后的东西——五个注意力后端里有四个各是一千多到近三千行的完整算法实现，`csrc/` 下还有上千个 AscendC 算子源文件。**真正跑在 NPU 上的每一次矩阵乘、每一次 softmax，都来自 vllm-ascend，上游一行都没有。**

反过来也成立：**「算哪些 token」这个决策的逻辑在上游**。但「跑的是上游那个类」这句话不成立：`patch/platform/__init__.py` 无条件 import `patch_balance_schedule`，文件末尾一句 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` 把这个名字换掉了 [C16][C17]。`BalanceScheduler` 是上游 `schedule()` 的一份抄件，只在扫 waiting 那条循环里多一道默认关着的闸门，闸门关着时行为与上游一致——细节见 [Balance Scheduling](balance-scheduling.md)。除此之外还有几个调度器子类，打开对应配置时用 `scheduler_cls` 换上去 [C15]——v0.23 维护分支上是 `vllm_ascend/core/` 下的 `SchedulerDynamicBatch` 与 `ProfilingChunkScheduler`，这份名单换过一批，见下面的差异表。

## 边界的物理形态

上游在 `vllm/platforms/interface.py` 定了一个 `Platform` 基类 [C1]，三个关键方法只有签名和 docstring——`get_attn_backend_cls` 返回空串 [C13]，另外两个是 `pass` [C14]；昇腾继承它并填上实现 [C7]：

| 方法 | 上游 | 昇腾 | 它决定什么 |
|---|---|---|---|
| `pre_register_and_update` | 空壳 | 有实现 | 进程早期做什么准备 |
| `check_and_update_config` | 空壳 | 有实现 | 启动时怎么改写与拦截配置 |
| `get_attn_backend_cls` | 空壳 | 有实现 | 注意力用哪个后端 |

同一个名字在两个仓库里都查得到，一侧是空壳、一侧是答案——这就是「插件」的物理含义 [D]。想确认某块行为归谁，查这个基类里有没有对应方法最快 [A]。

## 所以想改一件事，该去哪一侧

这是这条边界最实用的用法：

- **改调度策略** → 昇腾侧没有默认实现可改，只能整类换掉（`scheduler_cls`）或用 patch 换掉上游那个对象。这是 [Patch 机制](ascend-patch-system.md) 存在的主要原因。
- **改算子怎么算** → 昇腾的主场。先看 `ops/` 能不能用现成 `torch_npu` 算子拼出来，不行才下到 `csrc/`。
- **改 KV 分配** → 要分两半：**块怎么分**是上游的，**块里每个 token 落哪个槽位**是昇腾的 [C8]。这两件事经常被混成一件。

## 版本必须成对

官方版本策略：vllm-ascend 按 PEP 440 发布与 vLLM 对齐的版本号 [S10]，`releases/vX.Y.Z` 就是 vLLM `X.Y.Z` 的开发分支 [S11]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/community/versioning_policy.html)）。

但绑定**不在依赖声明里** —— `requirements.txt` 里没有 `vllm` 这一项。它是运行时判断的 [C9]：

```python
def vllm_version_is(target_vllm_version: str):
    vllm_version = envs_ascend.VLLM_VERSION or vllm.__version__
    return Version(vllm_version) == Version(target_vllm_version)
```

`==`，精确相等，不是版本范围。这个函数在 `vllm_ascend/` 包里被调 49 处 [D]，决定 patch 目录导入哪些文件、算子走哪条分支。

后果很实际：**装错版本不会在安装期报错**，而是在运行时以「某个 patch 没生效」的形式出现——判 false 时那段 import 整段跳过，不抛异常 [D]。比依赖冲突难查得多。`main` 分支是例外，它跟 vLLM main 加最近 1~2 个 release，不锁单一版本 [S11]。

## 两个分支上，界线昇腾那一侧数出来的东西

边界的位置、两侧各管什么，v0.23 维护分支与 v0.26 分支完全一样；数出来的东西不一样：

| 数的是什么 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `vllm_version_is(...)` 的调用处 | 49 处，`patch/platform/__init__.py` 与 `patch/worker/__init__.py` 都按它决定 import 哪些文件 | 10 处，散在模型适配、结构化输出、采样与投机解码里，**两个 patch 目录的 `__init__` 一处都不剩** | [!] 上面那条「装错版本会让某个 patch 整段静默跳过」在 v0.26 上基本不成立：patch 的 import 不再按 vLLM 版本分叉 |
| 用 `scheduler_cls` 换上去的调度器子类 | `SchedulerDynamicBatch`、`ProfilingChunkScheduler` | `SchedulerDynamicBatch` 已删；换上去的是 `ProfilingChunkScheduler`、`BatchJobAwareScheduler`，异步路径还有 `ShortRequestFirstAsyncScheduler` [C18] | 按 v0.23 的类名去 v0.26 上找会扑空：`vllm_ascend/core/scheduler_dynamic_batch.py` 这个文件已经不在了，配置里写死旧类名要先改 |
| 四个大后端的行数 | 1807 到 2837 行 | 2119 到 3272 行 | 界线昇腾那一侧还在长，「昇腾侧只是包装器」这个印象只会越来越不准 |

## 常见误解

- **「关键的东西都在 vLLM 里」**——框架在上游，计算在昇腾。界线之后的每一行算子都是昇腾的 [D]。
- **「昇腾侧只是包装器」**——五个注意力后端里有四个是完整算法实现，不是转发 [D]。
- **「版本对不上大不了跑不起来」**——在 v0.23 维护分支上它可能照样起得来，只是某些 patch 静默不生效 [D]。
- **「边界能按目录划」**——不能。界线在一条请求的时间线上，`SchedulerOutput` 交接的那一刻；两侧在代码里共用同一批方法名 [C1][C7]。
