---
id: ascend-patch-system
title: Patch 机制
type: feature
summary: vLLM 没给昇腾留改动口子的地方，昇腾就在程序跑起来以后，把上游的函数和类直接换成自己的版本。换的时机只有两个：Worker 出生之前换一批，Worker 出生那一刻再换一批；换了哪些，要看当前的芯片、版本和开关。
aliases: [patch, adapt_patch, monkey patch, patch/platform, patch/worker, 补丁机制, 猴子补丁, 运行时替换, 全局补丁, Worker 补丁, is_global_patch]
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
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/patch.html
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_torch_accelerator.py#L1-L16
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L18-L76
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L107-L111
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/__init__.py#L17-L60
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/__init__.py#L18-L76
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L101-L178
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L58-L83
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L149-L149
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_qwen3_5.py#L195-L209
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L120-L145
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: npu-platform
    kind: builds-on
    note: 全局补丁的第一个触发点在平台类的启动钩子里，时机由平台类决定
  - to: one-request
    kind: builds-on
    note: 那条请求的每一步都跑在被补丁改过的环境里；块大小 2048 和每层怎么算都经过了补丁
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

vLLM 的代码昇腾一行不改；程序跑起来以后，昇腾把上游那些它必须改、又没有留口子的函数和类，**当场换成自己的版本**。这就是补丁（patch）。换的时机只有两个：**Worker 出生之前**换一批（全局补丁），**Worker 出生那一刻**再换一批（Worker 补丁）。

```wiki-diagram
file: patch-timing
```

## 先看一个问题：块大小 2048 是谁定的

[贯穿例子](one-request.md)里，Qwen3.6-35B-A3B 跑在两颗 NPU 上，[KV Cache](kv-cache.md) 的块大小是 2048。这个数你没设过。去 vLLM 的代码里找「这种一半是[线性注意力](linear-attention.md)、一半是全注意力的混合模型，块大小怎么定」，能找到一个专门的函数——但在昇腾上，**那个函数一次都没跑过**。服务启动时，昇腾已经把它换成了自己写的同名版本，2048 是昇腾那一版按昇腾的规则算出来的。

同样的事还发生在模型的每一层上。这个模型的 40 层，不管是 10 层全注意力还是 30 层线性注意力，「这一层怎么算」那段代码在 vLLM 里都有，可在昇腾上跑的也是被换过的版本。

所以读 vLLM 文档、读 vLLM 源码得到的结论，搬到昇腾上不一定作数。这一页讲清楚两件事：**什么时候换**，**换了哪些东西**。

## 补丁是什么，为什么要打

昇腾接进 vLLM 的正路是插件：vLLM 预先留了一批口子（平台是谁、算子用哪套、注意力用什么后端……），昇腾往口子里填自己的实现，见[插件注册机制](platform-plugin-registration.md)和 [NPUPlatform](npu-platform.md)。

但口子总有没留到的地方。上面那个块大小的函数、调度器那个类、模型某一层的计算，vLLM 都没打算让硬件厂商来接手。昇腾要改它们，只剩一个办法：程序运行起来、上游代码已经加载进来以后，把那个名字重新指向昇腾自己的函数或类。以后谁再去调用这个名字，拿到的就是昇腾的版本。

这个「换」只在当前进程里有效——换一个进程要重新换一遍。所以补丁不是打一次就完，而是分几条路送进每个进程，这部分在[引擎有哪几个进程](engine-processes.md)里讲。

## 两个时机：Worker 出生之前，和 Worker 出生那一刻

昇腾把补丁分成两个目录，一个目录对应一个时机，**没有第三种**：

- **全局补丁：Worker 出生之前就要换好。** 有些上游代码在 Worker 还不存在的时候就要跑：定配置（块大小就是这时候定的）、建起 Worker 的那段代码、EngineCore 里每一步排队的调度器。这批补丁要赶在它们之前换好，所以在平台刚被选中时换一遍，在 EngineCore 进程加载昇腾插件时再换一遍。
- **Worker 补丁：Worker 出生那一刻换。** 模型每层怎么算、一部分算子和通信，都在守着 NPU 的 Worker 里跑。Worker 被造出来时，**第一件实质工作就是打这批补丁**，排在注册昇腾算子、读昇腾配置、做上游的初始化之前——后面这些步骤要用到的，已经是被换过的上游代码了。

套到例子上：块大小 2048 属于全局补丁（Worker 分配 KV Cache 之前就要定下来）；那 40 层的计算属于 Worker 补丁（两颗 NPU 上的两个 Worker 各自换一遍）。

## 换了哪些东西

v0.23 维护分支上一共 59 个补丁文件：全局补丁 28 个，Worker 补丁 24 个，另有 7 个是配合实验性新版 model runner 的 Worker 补丁。

```wiki-diagram
file: patch-inventory
```

它们换掉的东西五花八门，挑几个有代表性的：

- **配置**：混合模型的块大小（就是例子里的 2048），因为 vLLM 原来给的块大小昇腾不支持。
- **调度器**：EngineCore 里决定每一步放谁进来的那个类，被无条件换成了昇腾的版本；只是在默认配置下，它一上来就把活交回给上游原来那一份。细节见 [Balance Scheduling](balance-scheduling.md)。
- **显存查询**：PyTorch 里「查一下显存用了多少」「清一下缓存」这几个函数，上游新代码直接调它们，可它们不会自动转到 NPU 上。昇腾一加载就把它们全指到 NPU 自己的版本。
- **模型的层**：例子里那 40 层的计算（全注意力和线性注意力两种都在内），换成昇腾写的版本。

**目录里有文件，不等于它生效了。** 每个目录有一个总开关文件，里面按条件决定导入谁：是不是 310P 这种芯片、装的是哪个版本的 vLLM、有没有 Triton、有没有打开 EPLB 相关的环境变量。没被导入的文件等于没打。例子跑在 A2/A3 上、没开 EPLB：块大小和模型层那两个补丁都会生效，而专门给 EPLB 改「怎么起 Worker」的那个补丁不生效。

## 为什么它难查

补丁最麻烦的地方是：**它基本不出现在调用链里**。那条请求跑完 200 步，出错时的调用栈里几乎看不到补丁的影子——大部分替换在请求到达之前就做完了，栈上显示的名字还是上游的名字，里面跑的却是昇腾的代码。唯一天天露面的是调度器那一跳。

所以排查只能反着来：**怀疑某个上游行为不对劲，就去补丁目录里搜那个上游的类名或函数名。** 搜到了，说明手上那份上游文档在昇腾上不作数，要读补丁文件；搜不到，再找昇腾有没有写它的子类；两样都没有，这块行为就是上游原样。完整的定位路线在[怎么读这个仓库](reading-vllm-ascend.md)。

## 每个补丁都写着什么时候能删

补丁目录的说明文件里有一份清单，规定每加一个补丁都要补一段描述，固定四项：**为什么要改**、**怎么改的**、**有没有给上游提改动**（没有要说明原因）、**什么条件下能删掉**。

例子里那个块大小补丁的四项是这样写的：为什么——vLLM 设的块大小昇腾不支持；怎么改——在 NPU 上换成昇腾支持的块大小；上游改动——「很快会在 vLLM 里修掉」；何时删——上游合进去以后就删。

这份格式是整套机制最值钱的部分：**每个补丁都自带退出条件**。官方设计文档的态度也很直白：补丁不是好办法，只是临时方案，最好的做法是把改动贡献回 vLLM；原则有三条——能不打就不打、打了就写清怎么删、任何时候清理补丁都欢迎。所以补丁的数量本身不说明问题，要连着每条的「何时能删」一起看。

## 常见误解

- **「补丁目录里的文件都在生效」**——不一定。两个总开关文件按芯片、vLLM 版本、Triton、EPLB 环境变量分支导入，没导入的等于没打。
- **「全局补丁和 Worker 补丁的区别是改的对象不同」**——区别是**时机**，不是对象类型。两个目录下有同名的补丁文件，因为同一类东西在两个时机都要处理。
- **「补丁越多说明代码越差」**——清单里每条都写了上游改动和何时能删，相当一部分是在等上游合改动。判断要看那两栏，不是看总数。

## 对照源码

### 怎么开

补丁没有开关，也没有注册表：两类补丁都靠 `import` 的副作用生效，所以「打补丁的顺序」就是两个 `__init__.py` 里 import 语句的顺序。

**两个时机由一个布尔值分流。** `adapt_patch` 的函数体只有四行：`is_global_patch` 为真就 `from vllm_ascend.patch import platform`，否则 `from vllm_ascend.patch import worker` [C3]。`patch/__init__.py` 顶部注释把两个时机写成规范 [C1]：

| 目录 | 时机 | 谁调起 |
|---|---|---|
| `patch/platform/` | worker 启动之前 | `NPUPlatform.pre_register_and_update()` 里的 `adapt_patch(is_global_patch=True)`；另有 `vllm_ascend/__init__.py` 的 `_ensure_global_patch()`，给只加载 general plugin 的 engine-core 子进程用——四个 plugin 入口里 `register_connector`、`register_model_loader`、`register_service_profiling` 三个调了它，`register_model` 没调，模块级的 `_GLOBAL_PATCH_APPLIED` 保证同一进程只打一次 |
| `patch/worker/` | worker 启动时 | `NPUWorker.__init__` 里注释 `# register patch for vllm` 之后的 `adapt_patch()`，排在注册算子、`init_ascend_config`、`super().__init__()` 之前 [C5] |

**哪些文件会被 import（v0.23）。** `patch/platform/__init__.py` 带条件导入 [C6]：

- `is_310p()` 为真导入 `patch_mamba_config_310`，否则导入 `patch_mamba_config`；
- `vllm_version_is("0.23.0")` 为真时多导入 5 个，其中包括 `patch_shm_broadcast`；为假时另导入 `patch_fused_moe`、`patch_dp_device_ids`；
- `patch_multiproc_executor` 只在环境变量 `DYNAMIC_EPLB` 或 `EXPERT_MAP_RECORD` 打开时导入，默认等于没打。

`patch/worker/__init__.py` 同样按 `is_310p()`、`vllm_version_is`、`HAS_TRITON` 分支导入 [C7]。

**上半提到的几个替换：**

- 块大小：`patch_mamba_config.py` 末行把上游 `HybridAttentionMambaModelConfig.verify_and_update_config` 指向昇腾的同名函数 [C18]；清单里它的四项原文是 Why「block size is set to 16 in vLLM which is not supported by Ascend」、How「Set block size to 128 on npu」、Related PR「we'll fix this in vLLM soon」、Future Plan「Remove this patch when vLLM merges the PR」[C2]。清单的 How 只写了 128，贯穿例子的 2048 是这个函数按 SSM 页对齐算出来的，推导见 [one-request](one-request.md) 的对照源码 [D]。
- 模型的层：`patch_qwen3_5.py` 把 `Qwen3_5DecoderLayer.forward`、全注意力 `Qwen3NextAttention.forward`、线性注意力（GDN）的 `forward` / `_forward_core` 等方法换成昇腾实现 [C19]；上游 `Qwen3_5DecoderLayer` 按层类型建 `linear_attn`（GDN）或 `self_attn`（`Qwen3NextAttention`）[C20]。这个文件在 `patch/worker/__init__.py` 里挂在 `not is_310p()` 分支下。贯穿例子走的是 `qwen3_5` 这套模型代码（one-request 的对照源码引的就是 `qwen3_5.py`）[D]。
- 调度器：`patch/platform/__init__.py` 无条件 import `patch_balance_schedule`，文件末尾把 `vllm.v1.core.sched.scheduler.Scheduler` 指向 `BalanceScheduler` [C12]；balance 与 disable-preemption 都没开时，`schedule()` 第一行就 `return super().schedule()` [C13]。
- 显存查询：`patch_torch_accelerator.py` 无条件 import，import 时把 `torch.accelerator.empty_cache`、`memory_stats`、`memory_reserved`、`reset_peak_memory_stats` 指到 `torch.npu.*` [C10]。

**清单格式。** `patch/__init__.py` 要求每加一个 patch 就补一段 Why / How / Related PR / Future Plan。官方设计文档的三条原则原文是「Less is more」「必须写清未来移除计划」「任何时候清理 patch 都欢迎」[S8]（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/patch.html)）。

### 版本差异

**文件数：**

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `patch/platform/patch_*.py` | 28 个 | 31 个 [D] | worker 起来之前要改的上游行为 |
| `patch/worker/patch_*.py` | 24 个 | 24 个 [D] | 每个 worker 进程内要改的 |
| `patch/worker/patch_v2/patch_*.py` | 7 个 | 9 个 [D] | 配合实验性的 v2 model runner |
| 合计 | 59 个 | 64 个 [D] | 「插件模式不碰上游代码」在这里失效 |

**机制：** 两个时机、`adapt_patch` 的分流、清单格式在 v0.26 上都没动；变的是「哪些文件会被 import」，条件少了一类，调度那一跳也多垫了一层：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| 两个 `__init__.py` 的分支条件 | `is_310p()`、`vllm_version_is("0.23.0")`、`HAS_TRITON`、`DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` | `vllm_version_is` 一处不剩，只剩 `is_310p()`、`HAS_TRITON` 和那两个环境变量 [C14] | 查「这个 patch 会不会被导入」时，v0.26 上不用再对上游版本号 |
| `patch_shm_broadcast`、`patch_fused_moe`、`patch_dp_device_ids` | 分挂在 `vllm_version_is("0.23.0")` 的两侧，一次运行只导入其中一边 | 三个都无条件导入 | 在 v0.23 上二选一的这几个 patch，v0.26 上同时生效 |
| `patch_v2/*` 那一组 | `_V2_MODEL_RUNNER_SUPPORTED` 为假时整组不导入，v2 runner 休眠 | 那个开关没了，除 `patch_v2/patch_triton` 仍跟着 `HAS_TRITON`，其余都无条件导入 [C15] | 照 v0.23 的经验以为 `patch_v2/` 没打，在 v0.26 上会看错 [!] |
| 被换掉的 `Scheduler` | 一层：换成 `BalanceScheduler`，balance 关掉时第一行交回上游 `schedule()` | 两层：先换成 `KVDeliveryScheduler`，`BalanceScheduler` 再从它派生 [C16] | balance 关掉时整步调度跑在 `patch_kv_delivery_preemption.py` 里重写的那份 `schedule()`，不回上游 [C17] |

main（baa023ad）侧本页未逐项核对，按上表 v0.26 的结构理解前请先到 `tools/repos/vllm-ascend/vllm_ascend/patch/` 下对一遍。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 两个时机的规范、patch 清单 | `vllm_ascend/patch/__init__.py:17-27`、`:29-80` |
| 分流函数 | `vllm_ascend/utils.py:563-567` `adapt_patch` |
| 全局补丁入口 | `vllm_ascend/platform.py` `pre_register_and_update()`（v0.23 在 `:188`）；`vllm_ascend/__init__.py:18-76` |
| Worker 补丁入口 | `vllm_ascend/worker/worker.py:107-110` |
| 两个总开关 | `patch/platform/__init__.py`、`patch/worker/__init__.py` |
| 块大小补丁 | `patch/platform/patch_mamba_config.py:149` |
| 模型层补丁 | `patch/worker/patch_qwen3_5.py:195-209`；上游层定义 `vllm/model_executor/models/qwen3_5.py:120-145` |
| 调度器补丁 | `patch/platform/patch_balance_schedule.py:107-111`、`:744-745`；v0.26 另见 `patch_kv_delivery_preemption.py:58-83` |
| 显存查询补丁 | `patch/platform/patch_torch_accelerator.py:1-16` |
| 官方设计文档 | `docs/source/developer_guide/Design_Documents/patch.md` [S8] |
