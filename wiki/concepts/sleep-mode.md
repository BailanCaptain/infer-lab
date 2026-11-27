---
id: sleep-mode
title: Sleep Mode：暂停推理时怎样把显存让给训练
type: feature
legacyAnchors:
  glm-双机中的一个-token-会遇到睡眠吗: 跨机专家并行怎样协调休眠与唤醒
  复杂异构与多机边界对照glm-双机若改同卡轮训会撞上什么: 跨机专家并行怎样协调休眠与唤醒
summary: >-
  Sleep Mode 在保留引擎进程的同时释放可睡眠内存池：level 1 把权重备份到 CPU，level 2 丢弃权重，两者都丢弃旧 KV
  cache。说明唤醒顺序、请求处理、Ascend 910B3 实测账本、多机 EP 协同休眠边界与版本差异。
aliases:
  - Sleep Mode
  - Sleep Mode Guide
  - 睡眠模式
  - 休眠模式
  - sleep_mode
  - enable_sleep_mode
  - '--enable-sleep-mode'
  - Level 1
  - Level 2
  - wake_up
  - is_sleeping
  - camem
chapters:
  - '19'
order: 60
sources:
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/sleep_mode.md#L3-L26
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/sleep_mode.md#L60-L81
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/sleep_mode.md#L100-L137
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/sleep_mode.md#L126-L172
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/sleep_mode.md#L92-L180
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L341'
  - 'vllm@0fc695fc:vllm/config/model.py#L297-L298'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/dev/sleep/api_router.py#L21-L48'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L688-L783'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L318-L356'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L216-L280'
  - 'vllm-ascend@db701c1f:vllm_ascend/device_allocator/camem.py#L135-L249'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L668-L679'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L905'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L216-L280'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L222-L270'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L241-L294'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1122-L1138'
  - 'vllm-ascend@baa023ad:vllm_ascend/device_allocator/camem.py#L197-L222'
  - 'vllm@568afb3a:vllm/config/model.py#L306-L307'
  - 'vllm@84030bbe:vllm/config/model.py#L342-L343'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L195-L200'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L807-L845'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L249-L254'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1771-L1787'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1805-L1828'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1621-L1668'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/sleep_mode.md#L140-L184
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L907-L918'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1001-L1012'
  - >-
    raw:sha256-420d0319585f07ff323b58f0ac201d0cb6155ea95bb8a8cba30c59e952ae6bf7.md#L1-L1207
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L1771-L1787
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L1805-L1816
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L246-L299'
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L61-L71
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L248
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302
  - 'vllm@ced6857a:vllm/config/model.py#L342-L344'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L247-L306'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device_allocator/sleep_mem_optimized.py#L48-L298'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L371-L375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L309-L382'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device_allocator/sleep_mem_optimized.py#L48-L298'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device_allocator/camem.py#L159-L290'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L387-L392'
  - 'vllm@ba15685a:vllm/config/model.py#L375-L380'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1392-L1451
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1507-L1786
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L373-L386'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/safety.py#L9-L18'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L605-L620'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L392-L405'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 启动时权重与缓存进入专用内存池，决定以后哪些分配可以睡眠释放
  - to: request-call-chain
    kind: builds-on
    note: Sleep Mode 从请求调度转入 Worker 控制调用，主线页解释这些进程怎样连接
  - to: device-memory
    kind: builds-on
    note: 睡眠释放的是专用池中的物理显存，池外常驻显存与板级空载基线归类见该页
  - to: enable-sleep-mode-extra-cleanup
    kind: builds-on
    note: 理解池外显存为何仍驻留需对照清理开关页；睡眠级别与恢复顺序在本页，额外清理代价及配置迁移在参数页
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 固定双机部署未开 Sleep Mode，卡的分工与显存预算仍以部署页为准
  - to: rfork
    kind: conflicts-with
    note: 启用 enable_sleep_mode 时，RFork 可变权重安全检查返回 "sleep mode" 并自动回退默认加载器
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-420d0319585f07ff323b58f0ac201d0cb6155ea95bb8a8cba30c59e952ae6bf7.md
  - >-
    raw/sha256-ad479d365f8bbdc1a194ac58ffc4d8d965236880240b6dbf2e6124e3ec82d201.md
  - >-
    raw/sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md
---

## 推理暂时不用卡时，能把显存让出来吗？

**Sleep Mode（睡眠模式）让推理引擎保留进程，却暂时释放所管理的一部分显存，等需要生成时再通过 `wake_up` 恢复。** 权重是模型学到的参数；KV cache 是为了接着生成而保存的历史计算结果。它提供两档释放深度：**Level 1** 把权重先备份到 CPU 内存再释放设备显存（适合复用同一版权重快速唤醒），**Level 2** 直接丢弃权重（省去 CPU 备份，适合唤醒前由训练端重新写入新权重）；无论哪一档，旧 KV cache 都会直接丢弃。

```wiki-diagram
file: sleep-mode-intuition
```

上线前先盯住 `v0.30.0` 主基线的两条必配门槛（漏掉任意一条都会报错）：

- **检查并移除冲突的 `expandable_segments:True` 项**：睡眠专用内存池（`camem`）与可扩展分配段互斥；启动前须检查 `PYTORCH_NPU_ALLOC_CONF` 并剔除其中的 `expandable_segments:True`（若无其他自定义项可直接 `unset`，若环境同时配置了其他合法分配器键则保留其余键；分配器与运行时变量边界见[昇腾运行时与调优](ascend-runtime-and-tuning.md)），否则初始化内存池时直接触发断言失败。
- **关闭 `FRACTAL_NZ` 配置守卫**：须显式传入 `--additional-config '{"weight_nz_mode": 0}'`（或开启自动将 NZ 清零的 `rl_config.enabled`），否则 `wake_up()` 唤醒时直接抛 `ValueError: FRACTAL_NZ mode is enabled`。

想象同一张 NPU（昇腾计算卡）轮流做两件事：先生成一批回答，再用这些回答训练模型。生成结束后，推理进程暂时没有工作，但权重和缓存仍占显存。Sleep Mode 把可释放的那部分让给训练；训练结束、让回空间后，推理侧再唤醒。

这发生在[请求调用链的调度与 Worker 执行之间](../concepts/request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。EngineCore 是掌管请求调度的引擎核心，Worker 是实际管理一张计算卡并执行模型的进程。Sleep Mode 切换的是引擎状态，不是在每一层计算中新增一种算子。

## 为什么需要它，代价又在哪？

**训练与生成轮流用同一张卡时，推理侧“不算了”还不够，必须真正归还物理显存。** RL（reinforcement learning，强化学习）后训练会反复经历生成、评价和参数更新；生成侧与训练侧还可能采用不同的分卡方式。把推理侧的旧缓存留在卡上，训练就用不到这片空间。

把它想成工坊让场地——**每次拆毁厂房装车慢速重建 vs 保留热厂房外壳、把权重滑入隔壁侧仓（Level 1）或直接腾空场地（Level 2）**：

```wiki-diagram
file: sleep-mode-plate-bakery-hibernation
```

官方入门示例选用 Qwen2.5-0.5B-Instruct，检查 level 1 睡眠后相对启动前基线的显存增量小于 **1 GiB**，并检查唤醒前后相同提示词生成的文本一致。这是示例中的验证条件，不是实测结果，也不是对所有模型承诺的释放量。测量时先记录创建引擎前的卡上占用，再从睡后总占用中扣除该基线，避免把其他进程原来占着的内存算给本引擎。

这里 1 GiB 为 1,073,741,824 B；比较的是“睡后卡上总占用 − 创建引擎前基线”，而非睡前后释放量。

让出空间的代价是搬运和等待。保留旧权重时，睡前从 NPU 拷到 CPU，醒后再拷回来；还需要能放下备份的 CPU 内存。丢弃权重时省去这份权重备份，但下一次生成前必须重新加载或接收权重。两种方式都要等待训练归还 NPU 空间，也都失去旧 KV cache 带来的复用收益。

| 相邻操作 | 显存怎样变化 | 适合解决什么问题 |
| --- | --- | --- |
| 暂停调度 | 权重与缓存仍驻留 | 暂时不执行请求 |
| Sleep Mode | 释放可睡眠池，恢复时补回空间与必要内容 | 同卡训练、生成交替 |
| 额外清理开关 | 在睡眠基础上再清通信域和图工作区 | 训练仍缺池外那部分显存 |

额外清理的开关、通信域重建和图重捕获见[参数页](../params/enable-sleep-mode-extra-cleanup.md)。本页的两种睡眠级别在这个额外开关关闭时也成立。

DP 协调的暂停路径要先完成各 rank 的暂停共识，再恢复调度。若暂停仍在途，恢复入口会报错并要求等待暂停 future 完成；调用方应等待这一异步结果，而不是发出暂停请求后立即恢复。


## 睡下去和醒过来，各要保留什么？

**level 1 留住权重的内容，level 2 要求调用方补回权重；两者都不能靠唤醒找回旧缓存内容。** 专用分配器把启动时申请的内存按用途标记，分别管理权重池与缓存池。释放的是底层物理内存；引擎里的模型对象与分配记录继续存在，唤醒时重新建立内存映射。

level 1 先在宿主机内存中给权重池建立 CPU 锁页备份（主机侧 pinned memory 容量与大页边界见[主机内存与大页](host-memory-and-hugepages.md)），再释放权重与缓存的可睡眠设备分配。唤醒时，权重有备份可拷回，缓存只有重新分配的空间。这里的“空”指没有保留下旧内容，不保证每个字节为零。之后请求从所需的历史计算重新开始。

level 2 不备份权重池，适合马上要接收更新后权重的训练循环。Worker 仍单独保存模型注册的 buffers（不作为训练参数管理、但运行时要用的辅助张量），唤醒后恢复它们；因此“丢弃权重”不等于 CPU 内存占用归零。分配器中标为持久的内存也会跨睡眠保留，池外的其他常驻资源同样不因基本睡眠自动消失。

**用一张卡的示意账看清空间怎样交接：数是示意，公式按分配器的行为计算。** 假设权重标签下可释放的分配为 2 GiB，其中包括 16 MiB 的模型 buffers；缓存标签下可释放的分配为 3 GiB，持久分配为 0.25 GiB，池外常驻资源为 0.75 GiB。这里按实际分配空间记账，已包含分配对齐；只算推理端这几类占用，额外清理关闭，其他占用与分配规格保持不变。训练使用借出的空间后，须先归还，才进入下面的唤醒步骤：

$$M_{\text{before}} = 2 + 3 + 0.25 + 0.75 = 6\text{ GiB}, \qquad M_{\text{freed}} = 6 - (0.25 + 0.75) = 5\text{ GiB}$$

| 阶段与内存项（每卡示意账） | 算式 | 占用 / 释放结果 |
| --- | --- | --- |
| 睡前显存总占用 | $2 + 3 + 0.25 + 0.75\text{ GiB}$ | **6 GiB** |
| 两级睡后显存余量（持久 + 池外常驻） | $0.25 + 0.75\text{ GiB}$ | **1 GiB** |
| 两级释放显存 | $6 - 1\text{ GiB}$ | **5 GiB** |
| level 1 新增 CPU 备份 | $2 \times 1024\text{ MiB}$ | **2,048 MiB** |
| level 2 新增 CPU 备份（仅单存 buffers） | $0 + 16\text{ MiB}$ | **16 MiB** |
| 仅唤醒 `weights` 后的显存 | $1 + 2\text{ GiB}$ | **3 GiB** |
| 再唤醒 `kv_cache` 后的显存 | $3 + 3\text{ GiB}$ | **6 GiB** |

两级睡眠都归还了这 5 GiB，差别在**旧权重的内容是否留在 CPU**。level 1 唤醒权重时，把备份拷回并释放备份；level 2 只恢复权重空间和另存的 buffers，参数值仍需外部重载或更新，不能拿此时的 3 GiB 占用当作模型已就绪。缓存唤醒后，占用回到 6 GiB，旧 KV 内容仍已丢失，要由后续请求重新计算。这个账解释的是给定分配的去向；池外资源与持久分配多少，会直接改变睡后余量，示意的 1 GiB 与前述官方小模型的验收阈值没有对应关系。

把两级睡眠的内存去向、暂停调度 → 释放显存 → 分阶段唤醒的完整控制链，以及 `v0.30.0` / `main` 新增的 HCCL 通信锚点（`sleep_lifecycle_anchor`）与两条硬前提收在一张图里，方便和下面的控制规则对照：

```wiki-diagram
file: sleep-mode-fig-levels-and-wakeup
```

按图从上往下走，先停请求调度，再处理卡上的内存，最后恢复。level 2 最清楚的顺序是：先唤醒权重标签，让权重有地方落下；外部重载或传入与现有模型结构兼容的权重；再唤醒缓存标签；全部就绪后才放行生成。换成任意架构的新模型还涉及模型对象和缓存规格重建，单凭睡眠接口不能完成。

除此之外，还有三条控制层边界不能混淆：

- **在途请求怎样处理是独立选择**：控制接口默认终止已有请求；在线引擎也提供等现有请求跑完再暂停的方式。暂停调度本身还可选择保留请求，但只要进入释放缓存的睡眠级别，旧缓存就会被清除，不能把“保留请求”理解为能原地续用旧 KV。钉住的控制实现还提供 level 0：只停调度，完全不进入 Worker 的显存释放分支。
- **分标签唤醒期间，调用方必须继续挡住新流量**：钉住的 EngineCore 每次唤醒调用后都会恢复调度，包括只唤醒权重那一步；执行器此时仍能记录缓存标签尚未恢复。两种状态不能混为一谈，查询到仍在睡眠也不能代替调用方的流量控制。
- **接口响应与操作完成需要区分**：旧 v0 引擎通过独立的前端进程接收控制请求时，接口返回成功不应单独当作内存交接完成的信号：在开始训练或恢复生成前，还需要确认睡眠或唤醒操作已经完成。这条提醒针对旧 v0 的前端多进程形态，不据此推断固定部署的控制时序。

### Ascend 910B3 真机实测：`weight_nz_mode` 守卫、唤醒提速与显存净残留

在单卡 `Ascend 910B3`（`v0.30.0`，完整实测档案见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）上对 `Qwen3-8B`（`BF16`）执行 Sleep Mode 对照实测，验证了配置守卫、唤醒速度、板级显存口径与 `RFork` 交互四项关键事实：

1. **拆清“BF16 权重实际是否转 `NZ`”与“唤醒守卫检查什么”**：第一，看张量真实布局——在非 310P 设备上，`utils.py` 规定普通 `BF16 / FP16` 权重仅当 `weight_nz_mode == 2` 时才转为 `FRACTAL_NZ`（默认 `1` 只转量化权重），因此 `Qwen3-8B` 的 BF16 权重实际保持 `ND` 布局。第二，看唤醒守卫条件——`worker.py` 的 `wake_up()` 并不检查权重张量的真实格式，而是直接读配置值 `if nz_mode:`，只要非零即抛 `ValueError: FRACTAL_NZ mode is enabled...`（未改配置组实测 `level 1` 睡下耗时 `16.593 s`、释放 `48.37 GiB`、Worker 报剩余 `3.02 GiB`，唤醒时被该守卫拦截）。因此报错不代表 BF16 权重原本已转 `NZ`，对 BF16 模型显式传 `'{"weight_nz_mode": 0}'`（或开启 `rl_config`）不会损失在线布局优化。
2. **显式设 `weight_nz_mode=0` 后的五阶段实测账本**：

| 实测检查点（单卡 `Qwen3-8B` BF16，`weight_nz_mode=0`） | `npu-smi` 板级 HBM 占用 | 扣除初始空载后进程净占 | 主机进程树 RSS | 耗时与输出校验 |
| --- | ---: | ---: | ---: | --- |
| `0_before_engine_init`（建引擎前空载基线） | `3,453 MB`（`3.372 GiB`） | `0 GiB`（基线） | `1.371 GiB` | 板级初始占用基线 |
| `1_active_after_gen1`（首次生成后活跃态） | `55,740 MB`（`54.434 GiB`） | `51.062 GiB` | `8.189 GiB` | 完整引擎初始化 **`95.830 s`** |
| `2_sleeping_level1_cpu_offload`（`level 1` 睡后） | `6,211 MB`（`6.065 GiB`） | **`2.693 GiB`**（`+2,758 MB`） | `8.190 GiB` | `sleep(level=1)` **`8.070 s`** |
| `3_awake_after_gen2`（唤醒后二次生成） | `55,741 MB`（`54.435 GiB`） | `51.063 GiB` | `8.190 GiB` | `wake_up()` **`2.482 s`**，同输入生成文本逐字一致 |
| `4_sleeping_level2_discard_all`（`level 2` 睡后） | `6,210 MB`（`6.064 GiB`） | **`2.692 GiB`**（`+2,757 MB`） | `8.200 GiB` | `sleep(level=2)` **`4.334 s`**（仅测卸载，未测重载后生成） |

两处数字边界必须看清。其一，**`2.482 s` 唤醒较 `95.830 s` 初始化快 `38.61×`**，比较的是“存活引擎从 CPU 拷回权重并重映射缓存池”与“从零冷启动完整初始化（含加载、试跑、编译与录图）”两个不同阶段。其二，`npu-smi` 从 `55,740 MB` 降到 `6,211 MB`（`6.065 GiB`）是板级总读数，其中包含建引擎前已占的 `3,453 MB` 空载基线，因此该推理进程睡后净留显存为 **`2.693 GiB`（`2,758 MB`）**——不能把全部 `6.065 GiB` 认作该进程的 CANN/HCCL 上下文，也不能直接推广为多卡每卡残留。
3. **启用 Sleep Mode 时 [RFork](rfork.md) 自动回退默认加载**：`rfork/safety.py` 中的可变权重安全检查 `mutable_weights_bypass_reason()` 只要检测到 `enable_sleep_mode` 为真便返回 `"sleep mode"`，`rfork_loader.py` 随即打印告警并回退至默认模型加载器；即便把 `weight_nz_mode` 设为 `0`，也不会恢复 `RFork` 的权重共享传输。

## 跨机专家并行怎样协调休眠与唤醒

单卡 `Qwen3-8B` 只需本进程完成池释放与唤醒；换到跨机专家并行的多机服务时，休眠与唤醒还要受分配器环境变量和全局通信拓扑双重约束（例外 B 的 [GLM 双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)官方在线配方默认未开 `--enable-sleep-mode`，启动走[常规分配路径](../concepts/npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)，且睡眠仅由管理接口显式触发）：

1. **移除冲突的分配器选项并对齐 `NZ` 守卫**：官方双机脚本显式带有 `PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`，与睡眠内存池（`camem`）互斥；启用睡眠前必须移除该冲突项、配齐 `weight_nz_mode=0`，并在休眠与重载窗口挡住外部流量。
2. **跨机 `EP16` 必须全组协同休眠与唤醒**：双机 `288` 个路由专家跨 `16` 张卡切分（详见[部署页分工](../concepts/glm-5-3-flash-two-node.md#部署前提)），单台机器不是完整模型副本，进入睡眠与唤醒时必须协调全部参与的执行组同步推进。控制层具备跨 DP 组的暂停共识与恢复同步，但这只确立了控制协议边界——该混合注意力 + `W8A8` 配置尚无睡眠释放量、唤醒延迟与输出一致性的真机实测（常规显存账仍见[部署页 KV 预算](../concepts/glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）。

## 哪些理解容易出错？

- **“开了睡眠开关，闲下来就自动睡。”** 开关只让启动时的内存分配具备睡眠条件，状态切换仍需显式调用。
- **“level 2 唤醒后就能直接生成。”** 重新拿到权重空间不等于拿到正确权重；必须完成重载或权重更新。
- **“睡眠会把整张卡清空。”** 基本睡眠只处理分配器掌管的可睡眠分配，持久分配、池外资源和其他进程的显存各有归属。
- **“一次唤醒成功就是模型就绪。”** 分标签唤醒只恢复指定标签对应的内存；应核对全部标签、权重重载完成状态，再验证输出。
- **“官方旧示例的 JSON level 可以直接照抄。”** 钉住接口从 URL 查询参数读级别；把 2 只写进 JSON，会使用缺省级别 1。正确请求见下面。

## 对照源码

### 怎么开

离线通过 LLM 构造参数 `enable_sleep_mode=True`，服务启动通过 `--enable-sleep-mode`。`v0.23.0`、`v0.26.0rc`、`v0.30.0` 与 `main` 所配套的 vLLM 钉点，默认值均为 `False`。分配器依赖 AscendCL（昇腾底层运行时接口）扩展；官方指南要求按安装文档源码构建，额外的旧版本编译环境变量说明只针对早于 v0.12.0rc1 的版本。

上述旧版本编译设置为 `COMPILE_CUSTOM_KERNELS=1`，仅适用于低于 v0.12.0rc1 的版本；其他版本的完整安装要求仍以对应安装指南为准。

以下是对齐 `v0.30.0` 主基线（`c09d3e20`，与上文单卡 `Ascend 910B3` `Qwen3-8B` 实测口径一致）的 **Level 1 休眠与唤醒验证流程**，在 Linux 昇腾环境执行；它不是 GLM 双机命令。启动前先确保无在途请求、清除与睡眠内存池冲突的 `PYTORCH_NPU_ALLOC_CONF`，并通过 `weight_nz_mode=0` 关闭 `FRACTAL_NZ` 唤醒守卫（若在旧版 `v0.23.0` / `v0.26.0rc` 或 `db701c1f` 镜像上运行，唤醒守卫还读取环境变量，需额外补设 `export VLLM_ASCEND_ENABLE_NZ=0`；上游早期 `< 1 GiB` 入门冒烟文档则以 `Qwen/Qwen2.5-0.5B-Instruct` 演示同一组端点）：

```bash
export VLLM_WORKER_MULTIPROC_METHOD=spawn
export VLLM_SERVER_DEV_MODE=1
unset PYTORCH_NPU_ALLOC_CONF
vllm serve Qwen/Qwen3-8B \
  --enable-sleep-mode --additional-config '{"weight_nz_mode": 0}'

# 在另一终端执行；只在受控本地/训练网络开放这些管理接口
curl -X POST 'http://127.0.0.1:8000/sleep?level=1'
curl 'http://127.0.0.1:8000/is_sleeping'
curl -X POST 'http://127.0.0.1:8000/wake_up'
curl 'http://127.0.0.1:8000/is_sleeping'
```

开发模式决定服务是否注册管理接口，睡眠开关决定是否用专用池，两者承担不同职责。默认暂停模式为 `abort`；在线引擎需要等待在途请求完成时用查询参数 `mode=wait`，进程内引擎不支持该模式。level 0 恢复可用 `wake_up(tags=["scheduling"])`，只恢复调度。

level 2 的恢复协议是 `wake_up(tags=["weights"])` → 外部重载或更新全部 Worker 的权重 → `wake_up(tags=["kv_cache"])`。v0.26/main 官方在线示例给出通过 collective RPC（向各 Worker 广播控制调用）执行 reload 的做法；具体权重传输后端和模型兼容性需要随训练方案验证，不能省略中间步骤。标签应写为复数 `weights`，官方概述中单数 weight 只是示意写法。

### 会报什么错

下面先列 GLM 执行侧钉点 `db701c1f` 的抛错条件，并标出 `v0.30.0`（`c09d3e20`）在 `Ascend 910B3` 真机复现的唤醒守卫原文：

| 阶段与触发条件 | 原文与精确位置 | 应如何处理 |
| --- | --- | --- |
| 创建睡眠分配器时，分配环境含冲突选项 | `Expandable segments are not compatible with memory pool. Please track https://github.com/pytorch/pytorch/issues/147851 for the latest updates.`；camem.py:153–157 | 移除冲突项；GLM 教程原命令含该项 |
| 同一 Worker 进程已有睡眠池占用，又加载另一实例 | `Sleep mode can only be used for one instance per process.`；worker.py:671 | 使用独立进程，不共用该单例池 |
| 唤醒时 NZ 布局模式非零 | `db701c1f`（`worker.py:244-247`）：`FRACTAL_NZ mode is enabled. This may cause model parameter precision issues in the RL scenarios. Please set weight_nz_mode=0 via --additional-config.`；`v0.30.0`（`worker.py:279-286`）真机复现追加 `or enable additional_config.rl_config (enabled: true) which disables NZ automatically.` [C39][M48] | 启动时显式设 `weight_nz_mode=0`（或开启 `rl_config.enabled`）；注意普通 BF16 权重在默认 `mode=1` 下本不转 NZ（`utils.py:373-386`）[C49] |
| 睡前后测得的可用显存差为负 | `Memory usage increased after sleeping.`；worker.py:232 | 检查同卡其他进程、未完成工作和实际显存变化 |

表中路径均相对 vllm_ascend：前者在 device_allocator/，其余在 worker/；完整定位见页末来源。无效唤醒标签则是 warning 后返回，不保证抛异常：`Tag %s is not in sleeping tags %s`，位于 vLLM executor/abstract.py:335–341。调用方要核对状态，不能仅凭 HTTP 返回成功判定恢复了目标内存。

### 开销和什么时候别开

用 `torch.npu.mem_get_info()` 记录睡前、睡后和唤醒后的卡上占用，用执行器日志记录睡眠与唤醒耗时，再检查相同输入的输出一致性。Worker 日志 `Sleep mode (level=%s) freed %.2f GiB memory, %.2f GiB memory is still in use.` 位于 worker.py:234–239；这是整张卡前后差值，其他进程同时分配或释放会影响读数。

CPU 备份按分配器记录的实际字节数申请 pinned memory（便于设备传输的锁页内存），不是只按模型参数个数估算。level 1 睡前和醒后各有一趟权重搬运；level 2 转而支付重新加载成本。基本睡眠还会清理 Python 可回收对象并清空设备分配器的空闲缓存。池外额外清理的开销与适用边界统一见[清理开关页](../params/enable-sleep-mode-extra-cleanup.md#开了的代价)。

持续在线推理、短暂空闲但马上有下一批请求，或训练与推理本来就在不同卡上时，应先确认有无需要归还的同卡显存。频繁睡醒会把搬运与恢复时间放进服务间隔；固定 GLM 在线部署沿用默认关闭。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；**本文 GLM-5.3-Flash 双机对照沿用例外 B 专用镜像钉点 `db701c1f`（配套 `vllm@0fc695fc`），与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 引入并延续了 HCCL 通信锚点（`sleep_lifecycle_anchor`）与双开关额外清理门控。** 当 `rl_config.enabled` 与 `rl_config.sleep_mode_extra_cleanup` 同时为真时，多 rank 在拆业务通信组前通过 `_ensure_lifecycle_anchor` 创建锚点通信组并以 barrier 初始化；若锚点初始化或 MoE prepare 失败，本轮跳过 HCCL teardown。分阶段唤醒时，锚点保留到 `kv_cache` 阶段完成业务组、MoE runtime 与 ACL Graph 的恢复后才调用 `release_lifecycle_anchor()` 释放，避免提前销毁最后一个 HCCL 组。`wake_up` 明确拒绝非零 `weight_nz_mode`（要求设为 0 或开启会自动关 NZ 的 `rl_config`）。到 `main`（`8d6180e2`），level 2 进一步增加 `_save_sleep_parameters` / `_restore_sleep_parameters`（仅在 `weights` 阶段唤醒时恢复发送方省略的参数）以及睡眠/唤醒时对 `global_te` 缓冲区的反注册与重注册（`worker.py#L309-L382`）。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 开关与默认值 | 支持，默认 `False`（`model.py#L297`） | 支持，默认 `False`（`model.py#L306`） | 支持，默认 `False`（`model.py#L342-L344`） | 支持，默认 `False`（`model.py#L375-L380`） |
| Level 1 / Level 2 内容与恢复 | level 1 备权重、level 2 丢权重并另存 `named_buffers`；非量化专家符合形状时转置 | 无旧专家转置分支；缓存恢复调恢复钩子 | level 1 显式清 `_sleep_saved_buffers`；level 2 存 `named_buffers` 并在 `wake_up` 恢复（`worker.py#L247-L306`）；拒非零 `weight_nz_mode` | 延续 `v0.30.0`；level 2 新增 `_save_sleep_parameters`/`_restore_sleep_parameters`（仅 `weights` 唤醒时恢复），睡眠/唤醒增 `global_te` 缓冲反注册与重注册（`worker.py#L309-L382`） |
| `enable_sleep_mode_extra_cleanup` 与通信锚点 | 默认关，顶层清理键，无 `sleep_lifecycle_anchor` | 默认关，顶层清理键 | 迁入 `rl_config.sleep_mode_extra_cleanup`（须与 `rl_config.enabled` 同真，`ascend_config.py#L371`）；新增 `sleep_mem_optimized.py#L48-L298` 的 `_lifecycle_anchor_group` 通信锚点 | 同 `v0.30.0`（`ascend_config.py#L387`、`sleep_mem_optimized.py#L48-L298`） |
| 缓存池边界与释放前同步 | 包住整个缓存初始化；分配器无新增同步 | 同 `v0.23.0` | 仅将缓存本体放入可丢弃池（持久元数据留池外）；释放映射前增设备同步 | 延续池外持久元数据，并重构 `camem.py#L159-L290` |
| 官方在线调用示例 | JSON body 传 `level`（与实际路由查询参数不符） | 改为 URL 查询参数并补全 level 2 重载顺序 | 延续 URL 查询参数与 `weight_nz_mode` 额外配置 | 同 `v0.30.0` |

### 源码位置

以下来源按配置、请求控制、内存分配和四版本差异对应正文。

- **定义、示例与官方版本修订**：`docs/source/user_guide/feature_guide/sleep_mode.md`（来源 1–5、28）；GLM 双机未启用事实见教程 `237-341` 行（来源 6）[S1][S6]。
- **上游入口、状态控制与双机协作**：`api_router.py:21-48`、`core.py:688-783`、`1621-1668`（`mode=wait`）、`1771-1828`（DP 暂停共识与恢复同步）、`executor/abstract.py:318-356` [C8][C9][C10][C25]。
- **显存去向与旧版实现**：GLM 镜像 `db701c1f` 的 `worker.py:216-280`、`668-679`、`894-905` 与 `camem.py:135-249` [C11][C12]；`v0.23.0`（`2c59ff10`）与 `v0.26.0rc`（`2ed6cbba`）见来源 15–16、29–30。
- **`v0.30.0` 与 `main` 核心实现及 `RFork` 边界**：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L247-L306`（含 `wake_up` 非零 `weight_nz_mode` 守卫 `#L279-L286`）、`vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L309-L382`、`vllm_ascend/utils.py`（`c09d3e20#L373-L386`、`8d6180e2#L392-L405`，普通 BF16/FP16 仅在 `nz_mode == 2` 转 NZ）[C49]、`vllm_ascend/model_loader/rfork/safety.py`（`c09d3e20#L9-L18`、`8d6180e2#L9-L21`）与 `rfork_loader.py#L605-L620`（启用睡眠时返回 `"sleep mode"` 并回退默认加载）[C50][C51]、`vllm_ascend/device_allocator/sleep_mem_optimized.py#L48-L298`（两版一致）、`vllm-ascend@8d6180e2:vllm_ascend/device_allocator/camem.py#L159-L290`、`ascend_config.py`（`c09d3e20#L371-L375`、`8d6180e2#L387-L392`），以及四版上游 `vllm/config/model.py`（`0fc695fc`、`568afb3a`、`ced6857a`、`ba15685a`）；`Ascend 910B3` 单卡 `Qwen3-8B` 五阶段实测与 `FRACTAL_NZ` 唤醒报错标本见来源 47–48 [M47][M48]。

**待核与边界：** 单卡 `Ascend 910B3` 已验证 `Qwen3-8B`（`weight_nz_mode=0`）`level 1` 休眠唤醒耗时、板级净残留与输出一致性，但 `level 2` 仅测到卸载（`4.334 s`），尚未验证重载权重后的输出；同时缺少固定 GLM 双机在调整分配选项、NZ 布局及流量控制后的 level 1 / level 2 实测，需核对混合注意力状态、权重重载、输出一致性、释放显存和恢复耗时。来源 8 的 `api_router.py` 27–28、40–41 行保留仅针对旧 v0 frontend multiprocessing 的异步返回注释，交接仍应确认实际完成、流量暂停与权重恢复，不能只看 HTTP 成功 [I]。来源 1 第 26 行将 `COMPILE_CUSTOM_KERNELS=1` 限定于低于 v0.12.0rc1 的构建。正文每卡 6 GiB→1 GiB→3 GiB→6 GiB 的空间交接为教学示意假设 [A] 与分配器语义推导 [D]。
