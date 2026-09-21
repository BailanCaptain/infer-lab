---
id: ascend-patch-system
title: Patch 机制
type: feature
summary: 上游没留口子的地方，昇腾在运行时把上游的类和函数换掉。两个目录对应两个时机，靠 import 副作用生效。
aliases: [patch, adapt_patch, monkey patch, patch/platform, patch/worker, 补丁机制]
chapters: ["10"]
order: 90
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L17-L27
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L29-L80
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L151-L221
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L75-L131
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L17-L57
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/__init__.py#L18-L53
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/patch.md#L1-L20
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/feature_guide/patch.html
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_torch_accelerator.py#L1-L16
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L18-L76
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L107-L111
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/__init__.py#L17-L60
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/__init__.py#L18-L76
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L101-L178
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L58-L83
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: npu-platform
    kind: builds-on
    note: platform 层 patch 的触发点就是 NPUPlatform.pre_register_and_update，时机由平台类决定
  - to: one-request
    kind: builds-on
    note: 那条请求的每一步都跑在被 patch 改过的环境里，调用链上只有调度那一跳落在 patch/ 下面
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

`vllm_ascend/patch/` 下面是 59 个 patch 文件（v0.26 分支上 64 个），它们在运行时替换上游 vLLM 的类与函数 [D]。分成 `platform` 与 `worker` 两个子目录，对应两个不同的生效时机；两边都靠 `import` 的副作用生效，没有注册表。

```wiki-diagram
file: patch-timing
```

## 那条请求走到这里

那条请求跑完 200 步，调用链里几乎看不见 patch 这个词——**只有调度那一跳是例外**。`patch/platform/__init__.py` 无条件 import `patch_balance_schedule` [C6]，文件末尾把 `vllm.v1.core.sched.scheduler.Scheduler` 指向了 `BalanceScheduler` [C12]，所以每一步栈上都有一帧在 `patch/` 下面；只是默认配置下它第一行就把活交还给上游的 `super().schedule()` [C13]。v0.26 分支上这一跳变成两帧、而且不回上游，见下面的差异表。细节见 [Balance Scheduling](balance-scheduling.md)。

其余的替换都不在调用链里，它们在请求到达之前就已经生效了。一个能查证的例子：`patch/platform/patch_torch_accelerator.py` 是无条件 import 的 [C6]，import 的那一刻就把 `torch.accelerator.empty_cache`、`memory_stats`、`memory_reserved`、`reset_peak_memory_stats` 全指到了 `torch.npu.*` [C10]——那条请求所在的进程里，上游代码调的 `torch.accelerator.memory_stats()` 早就不是 torch 原来那个了。

这就是 patch 最难查的地方：**它基本不出现在调用链里**。排查时只能反过来——怀疑某个上游行为不对劲，就去 `patch/` 下搜那个类名或函数名。搜到了，说明你手上那份上游文档在昇腾上不作数。

## 两个时机由一个布尔值分流

`adapt_patch` 的函数体只有四行：`is_global_patch` 为真就 `from vllm_ascend.patch import platform`，否则 `from vllm_ascend.patch import worker` [C3]。没有第三种时机。

`patch/__init__.py` 顶部的注释块把两个时机写成了规范 [C1]：

- `platform`：worker 启动**之前**生效，由 `NPUPlatform.pre_register_and_update()` 里的 `adapt_patch(is_global_patch=True)` 调起 [C4]。
- `worker`：worker 启动**时**生效，由每个 worker 的 `__init__` 里的 `adapt_patch()` 调起 [C5]。

`pre_register_and_update()` 不是 platform 那一侧唯一的调用点：`vllm_ascend/__init__.py` 里的 `_ensure_global_patch()` 也会调 `adapt_patch(is_global_patch=True)`，给的是 engine-core 子进程——它只加载 general plugin；四个 plugin 入口里 `register_connector`、`register_model_loader`、`register_service_profiling` 三个调了它，`register_model` 没调，模块级的 `_GLOBAL_PATCH_APPLIED` 保证同一进程只打一次 [C11]。

在 `NPUWorker.__init__` 里，`adapt_patch()` 是注释 `# register patch for vllm` 之后的第一件实质工作，排在注册算子、解 AscendConfig、调 `super().__init__()` 之前 [C5]。顺序有意义：后面那些步骤会用到被 patch 过的上游行为。

## 生效方式是 import，所以顺序等于打补丁顺序

两个子目录的 `__init__.py` 就是开关。`patch/platform/__init__.py` 里是一串 `import vllm_ascend.patch.platform.patch_xxx  # noqa`，而且带条件 [C6]：

- `is_310p()` 为真导入 `patch_mamba_config_310`，否则导入 `patch_mamba_config`；
- `vllm_version_is("0.23.0")` 为真时才多导入 5 个，其中包括 `patch_shm_broadcast`；为假时另导入 `patch_fused_moe`、`patch_dp_device_ids`；
- `patch_multiproc_executor` 更严：环境变量 `DYNAMIC_EPLB` 或 `EXPERT_MAP_RECORD` 打开才导入，默认情况下这个文件等于没打。

`patch/worker/__init__.py` 同样按 `is_310p()`、`vllm_version_is`、`HAS_TRITON` 分支导入 [C7]。所以「某个 patch 到底有没有生效」不能只看文件存在，要看这两个 `__init__.py` 在当前环境下走了哪条分支。上面这份条件清单按 v0.23 写，v0.26 分支上少了一类条件，见下面的差异表。

## 清单是自文档的，格式是硬约定

`patch/__init__.py` 的注释块要求每加一个 patch 就在这个文件里补一段描述，格式固定为四项：**Why**（为什么要改）、**How**（怎么改的）、**Related PR**（有没有上游 PR，没有要解释）、**Future Plan**（什么条件下能删掉）[C1][C2]。

举一个完整的例子 [C2]：`platform/patch_mamba_config.py` 改的是上游 `HybridAttentionMambaModelConfig.verify_and_update_config`，Why 是「vLLM 把 block size 设成 16，昇腾不支持」，How 是「在 npu 上设成 128」，Related PR 写着「我们很快会在 vLLM 里修掉」，Future Plan 是「上游合了 PR 之后删掉这个 patch」。

这个格式是这套机制最值钱的部分：**它让每个 patch 都自带退出条件**。读一遍这个文件，就知道哪些 patch 是临时的、哪些是硬件差异导致的长期存在。

官方设计文档把态度写得更直白：patch 不是好办法，只是临时方案，最好的办法是把改动贡献回 vLLM；并给了三条原则——「Less is more，除非目前只有这条路，否则不要打 patch」「一旦加了 patch，必须写清未来移除它的计划」「任何时候清理 patch 代码都是受欢迎的」[S8]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/feature_guide/patch.html)）。所以文件数本身不是结论，要连着每条的 Future Plan 一起读。

```wiki-diagram
file: patch-inventory
```

## 文件数

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `patch/platform/patch_*.py` | 28 个 | 31 个 [D] | worker 起来之前要改的上游行为 |
| `patch/worker/patch_*.py` | 24 个 | 24 个 [D] | 每个 worker 进程内要改的 |
| `patch/worker/patch_v2/patch_*.py` | 7 个 | 9 个 [D] | 配合实验性的 v2 model runner |
| 合计 | 59 个 | 64 个 [D] | 「插件模式不碰上游代码」在这里失效 |

## v0.23 与 v0.26 的差异

两个时机、`adapt_patch` 的分流、清单格式在 v0.26 上都没动；变的是「哪些文件会被 import」这一层，条件少了一类，调度那一跳也多垫了一层：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| 两个 `__init__.py` 的分支条件 | `is_310p()`、`vllm_version_is("0.23.0")`、`HAS_TRITON`、`DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` | `vllm_version_is` 一处不剩，只剩 `is_310p()`、`HAS_TRITON` 和那两个环境变量 [C14] | 查「这个 patch 会不会被导入」时，v0.26 上不用再对上游版本号 |
| `patch_shm_broadcast`、`patch_fused_moe`、`patch_dp_device_ids` | 分挂在 `vllm_version_is("0.23.0")` 的两侧，一次运行只导入其中一边 | 三个都无条件导入 | 在 v0.23 上二选一的这几个 patch，v0.26 上同时生效 |
| `patch_v2/*` 那一组 | `_V2_MODEL_RUNNER_SUPPORTED` 为假时整组不导入，v2 runner 休眠 | 那个开关没了，除 `patch_v2/patch_triton` 仍跟着 `HAS_TRITON`，其余都无条件导入 [C15] | 照 v0.23 的经验以为 `patch_v2/` 没打，在 v0.26 上会看错 [!] |
| 被换掉的 `Scheduler` | 一层：换成 `BalanceScheduler`，balance 关掉时第一行交回上游 `schedule()` | 两层：先换成 `KVDeliveryScheduler`，`BalanceScheduler` 再从它派生 [C16] | balance 关掉时整步调度跑在 `patch_kv_delivery_preemption.py` 里重写的那份 `schedule()`，不回上游 [C17] |

## 怎么判断某个上游行为被改过

这是读这个仓库时最常用的一个动作，也是 patch 机制存在的直接后果：**先在 `vllm_ascend/patch/` 下搜那个上游类名或函数名**。搜到了，说明昇腾上的行为和上游文档不一样，要读 patch 文件；搜不到，再找它的子类；两者都没有，这块行为就是上游原样。完整的三条定位路线在 [怎么读这个仓库](reading-vllm-ascend.md)。

## 常见误解

- **「patch 目录里的文件都在生效」**——不一定。两个 `__init__.py` 按 `is_310p()`、`HAS_TRITON`，以及 `DYNAMIC_EPLB` 这类环境变量分支导入（v0.23 上还多一类 `vllm_version_is()` 分支），没被 import 的文件等于没打 [C6]。
- **「platform 与 worker 的区别是改的对象不同」**——区别是**时机**，不是对象类型。同名的 `patch_distributed.py` 和 `patch_fused_moe.py` 在两个目录下都存在 [D]，因为同一类对象在两个时机都需要处理。
- **「patch 越少越好，所以数量多说明质量差」**——清单里每条都写了 Related PR 与 Future Plan [C1]，相当一部分是在等上游合 PR。判断质量要看那两栏，不是看总数。
