---
id: continuous-batching
title: Continuous Batching（连续批处理）
type: concept
origin: direct
summary: >-
  摒弃整批对齐补零与慢请求锁死，按单步迭代动态挑选请求、一维无填充拼接 token，并在每步末尾对完结请求即退即释块；配合 waiting 与
  running 两队列、三道预算闸门及 LIFO 抢占重算，撑起高吞吐低延迟在线服务。
aliases:
  - Continuous Batching
  - 连续批处理
  - 迭代级调度
  - iteration-level scheduling
  - in-flight batching
  - 静态批处理
  - static batching
  - 随退随补
  - 两队列调度
  - ragged batching
  - FCFS
  - First-Come First-Served
  - 凑批
  - 动态攒批
chapters:
  - '03'
sources:
  - 'https://arxiv.org/abs/2309.06180'
  - 'https://arxiv.org/abs/2401.08671'
  - 'vllm@ced6857a:docs/configuration/optimization.md#L27-L80'
  - 'vllm@ced6857a:docs/design/arch_overview.md#L79-L90'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/graph_mode.md#L35-L54'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L5-L39'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L589-L620'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L675'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L728-L810'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L854-L872'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1159-L1181'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1477-L1519'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2117-L2188'
  - 'vllm@ced6857a:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@ced6857a:vllm/v1/request.py#L364-L388'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L42-L86'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2701-L2760'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1056-L1147'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1379-L1408'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1553'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1058-L1106'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1279-L1463'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L352'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L274-L282'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L725'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L425-L437'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L658-L721'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L721-L733'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L949-L975'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1234-L1319'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: builds-on
    note: 单条请求拆成 Prefill（提示词并行建历史）与 Decode（逐词续写）两阶段，是同一步跨请求混排的基础
  - to: kv-cache
    kind: builds-on
    note: 已算位置的历史状态留在显存复用，才允许每步只把新增 token 紧致拼入前向并在完结当步释放缓存
  - to: request-overview
    kind: builds-on
    note: 沿用单次引擎迭代的「调度 → 前向 → 采样 → 停止检查」四步闭环，将其扩展到多请求动态进出
contradicts: []
updated: '2026-11-27'
legacyAnchors:
  静态批处理为什么会白烧算力三笔硬浪费与单步迭代破局: 静态整批等待浪费在哪里每步怎样退旧补新
---

**Continuous Batching（连续批处理，论文中也称 iteration-level scheduling，迭代级调度）把批处理的重组粒度从「整批请求同进同出」细化到「每一次前向迭代（step）」。每一步开头重新挑选请求并一维无填充拼接本步待算 token；每一步末尾立即让生成完毕的请求退场释放 `KV cache`，并在下一步补入等待中的新请求。**

前面两站已经拆清了单条请求的运行规律：[Prefill 与 Decode](prefill.md) 把生成拆成「并行处理提示词」与「逐词续写」两段，[KV cache](kv-cache.md) 把旧位置历史留在显存里避免重算。但真实线上服务面对的是源源不断、长短悬殊的并发请求。单跑一条 Decode 请求时，模型每步只算 `1` 个新位置，却要把数 GB 权重从显存完整搬运一遍，芯片绝大部分矩阵算力都在空等带宽。把多条请求攒成一批（Batching）分摊一次权重读取，是拉高吞吐的必经之路；问题在于，不同请求的提示词长度和回答长度千差万别，这一批到底该怎么攒？

先把两种攒批思路想成餐厅翻台——**锁死整桌等最慢食客吃完才翻台 vs 回转吧台吃完即走、空位秒补新客**：

```wiki-diagram
file: continuous-batching-plate-revolving-bar
```

## 静态整批等待浪费在哪里，每步怎样退旧补新？

最朴素的做法是沿用传统深度学习分类模型的**静态批处理（Static Batching）**：凑齐一批请求后锁进一张形状为 `[batch_size, seq_len]` 的二维矩形张量，所有请求一起跑完 Prefill、再一步步同步跑 Decode。直到批内**最慢**的那条请求输出结束符（`eos_token_id`）或撞上长度上限，整批才算跑完并放下一批进场。在自回归生成场景下，这种静态整批等待会同时造成三处浪费：

```wiki-diagram
file: continuous-batching-static-vs-iter
```

对照上图左栏的示意（`R1` 提示词 2 个位置、只生成 2 个词就撞上结束符 `EOS`（End of Sequence）；`R2` 提示词 5 个位置、要生成 4 步才完结；新请求 `R3` 在 `t=2` 到达），静态批处理的三重浪费一目了然：

1. **短提示词补 `<pad>` 白跑乘加**：为了凑齐二维矩形宽度，`R1` 被迫在提示词末尾塞入 3 个无意义的 `<pad>` 占位符向 `R2` 对齐，既白占显存，又让矩阵乘法在无效位置上空耗算力。
2. **短请求撞上 `EOS` 后陪跑空转**：`R1` 生成第 2 个词命中 `eos_token_id` 后早已完成使命，却因为二维批次形状锁死而退不出去，只能在后续迭代中继续空转陪跑，它占住的 `KV cache` 也无法归还。
3. **新请求队头阻塞（Head-of-Line Blocking）**：`R3` 在 `t=2` 就已到达引擎门口，明明 `R1` 已经停笔，却必须干等到 `R2` 把最后一步跑完才能进场，首字延迟（TTFT）被慢请求无端拖长。

由 Orca（OSDI'22）提出并被 vLLM 作为核心底座落地的 **Continuous Batching**，正是如上图右栏那样把整批等待拆成围绕 `EngineCore.step()` 的单步迭代——**每步末尾退旧补新**，配合**一维无填充拼接（1D Ragged Batching）**：

- **步首动态选人（`Scheduler.schedule`）**：每一步只决定「本步让哪些请求各算几个 token」（记入字典 `num_scheduled_tokens`）。在 `t=2` 步末，`update_from_output` 调用 `check_stop` 发现 `R1` 命中 `eos_token_id`，当场释放 `R1` 的缓存块并将它移出在跑列表；到了 `t=3` 步首，新请求 `R3` 立刻补位，与正在逐词生成的 `R2` 混在同一批执行。
- **一维紧致拼接（`_prepare_inputs` 零 `<pad>` 拼批）**：Worker 不再构造 `[batch_size, max_seq_len]` 二维矩阵，而是把本步入选请求的待算 token 头尾相接，拍平成长度为 `total_num_scheduled_tokens` 的一维紧致序列。例如 `t=1` 将 `R1` 的 2 个提示词和 `R2` 的 5 个提示词拼成长 `[7]`；`t=3` 将 `R2` 的 1 个生成词与 `R3` 的 3 个提示词拼成长 `[4]`。
  请求边界由一维前缀和数组 `query_start_loc`（如 `t=3` 为 `[0, 1, 4]`）与位置数组 `positions` 标记：线性层与 MLP 对所有行做紧凑矩阵乘，注意力算子按 `query_start_loc` 切回各自请求、只读各自历史缓存，请求之间**零 `<pad>` 填充**。

| 对比维度 | 静态批处理（Static Batching） | 连续批处理（Continuous Batching，vLLM V1） |
| --- | --- | --- |
| **调度重排粒度** | 请求级（整批同进同出，等最慢请求跑完才换批） | **迭代级（Step-level）**：每次前向 `step()` 重新选人与分额 |
| **输入张量形态** | 二维矩形 `[batch_size, max_seq_len]`，短序列补 `<pad>` | 一维紧致拼接 `[total_num_scheduled_tokens, hidden]` + `query_start_loc` 边界 |
| **完结退场时机** | 早完结请求锁在张量内空转，直至整批结束才释放显存 | `check_stop` 命中 `eos_token_id` 或 `max_tokens` **当步移出并立即归还 KV 块** |
| **新请求准入延迟** | 被批内长生成请求挡在门外，首字延迟剧烈抖动 | 只要下一步仍有预算和缓存块，无需等在跑请求结束即可插空混跑 |

## 两队列状态机：waiting 与 running 怎样在同一条公式下流转

理解了「按步重排、一维紧拼」的物理形态，下一步就要拆开 `vllm/v1/core/sched/scheduler.py` 里的调度状态机。很多初学者以为调度器内部有一把开关，一会儿切到「Prefill 轮」处理新请求，一会儿切到「Decode 轮」推进老请求；事实上，**vLLM V1 调度器内部根本没有 Prefill 阶段或 Decode 阶段的区分**，它只维护一前一后两个容器与一条统一的进度追赶公式：

- **`waiting` 队列（待准入队列）**：存放刚到达、还没算完首轮，或中途因显存吃紧被退回的请求（状态为 `WAITING` 或 `PREEMPTED`），默认按先来先服务（`FCFS`）双端队列排队，也可切换为优先级（`PRIORITY`）堆。
- **`running` 列表（在跑活跃列表）**：存放已经拿到缓存块、正在逐轮推进的活跃请求（状态为 `RUNNING`），受单实例并发槽位上限 `max_num_seqs`（内部记作 `max_num_running_reqs`）约束。

对任何一条请求 $i$，调度器只看两个计数器：当前总已知位置数 `num_tokens_with_spec`（提示词长度 + 已生成词数 + 投机草稿词数；未开投机解码时草稿数为 `0`）和已写入缓存的位置数 `num_computed_tokens`。每步分配名额时，不论它是刚进门的新提示词、分块剩下一半的长提示词，还是每步新增 `1` 词的普通生成请求，统统套用同一条差额公式，在剩余预算 `token_budget` 内追赶进度：

$$\Delta n_i = \min\!\big(\text{num\_tokens\_with\_spec}_i - \text{num\_computed\_tokens}_i,\ \text{token\_budget}\big)$$

唯一决定先后秩序的，是 `Scheduler.schedule()` 每步雷打不动的**两趟扫描顺序——先保 `running`，再用余量接 `waiting`**：

- **第一趟扫 `running`**：优先给已在生成中的老请求各分 `1` 个（或剩余未算完的）位置，防止流式吐字间隔（ITL）卡顿。
- **第二趟接 `waiting`**：只有第一趟未发生抢占，且 `token_budget` 与并发槽位仍有富余时，才从 `waiting` 队首取新请求塞进同一批次，顺带把偏访存受限的 Decode 步填满计算量。

```wiki-diagram
file: continuous-batching-two-queues-trace
```

顺着上图的教学小算例（单步预算 `token_budget = 8`；`R1` 提示词 3、最多生成 2 词；`R2` 提示词 2、最多生成 3 词；`R3` 提示词 4、最多生成 2 词并在 `t=1` 途中到达），三步迭代的队列与边界数组变化可逐格验算如下：

| 迭代步 | 步首 `waiting` → `running` 调度分配 | 一维拼批宽度与 `query_start_loc` | 步末 `update_from_output` 与 `check_stop` |
| --- | --- | --- | --- |
| **`t=1`** | `running` 空；从 `waiting` 接纳 `R1(+3)`、`R2(+2)` 转入 `running`，剩预算 `8 - 5 = 3`；步中 `R3` 入 `waiting` | 合拼 `[5]`（纯提示词），边界 `[0, 3, 5]` | `R1`、`R2` 各自选出第 1 个生成词（已算/待算进度变为 `3/4` 与 `2/3`） |
| **`t=2`** | ① 先续 `running`：`R1(+1)`、`R2(+1)` 扣 2 剩 6；② 再从 `waiting` 接纳 `R3(+4)` 入 `running`，剩预算 `2` | **P/D 混跑 `[6]`**，边界 `[0, 1, 2, 6]` | `R1` 凑满 2 个生成词命中 `max_tokens`，当场释放块并由 `remove_all` 移出 `running`；`R3` 得首词 |
| **`t=3`** | `waiting` 为空；`running` 仅剩 `R2(+1)`、`R3(+1)` 续跑，`R1` 腾出的槽位与块已归还池中 | 纯生成 `[2]`，边界 `[0, 1, 2]` | `R2`（满 3 词）与 `R3`（满 2 词）同批命中停止条件，双双释块退场 |

## Qwen3-8B 算账推演：三道调度硬闸门与 LIFO 抢占重算

在线上真实负载中，`waiting` 能不能进场、`running` 能不能顺利往下走，每一步都受三道硬闸门约束：

1. **单步 token 总预算 `max_num_batched_tokens`**：控制单次前向的激活峰值显存与单步耗时；超长提示词放不下时自动走 [Chunked prefill](chunked-prefill.md) 分多步切分。
2. **并发序列上限 `max_num_seqs`**：`running` 满员即暂停从 `waiting` 拉新单。
3. **物理 KV 块池余量 `allocate_slots`**：分页块池与地址映射机制见 [PagedAttention](paged-attention.md) 与 [块表](block-table.md)。

前两道闸门在步首就能静态算清，唯独第三道闸门藏着一个动态陷阱：**`running` 里的请求每步多吐 1 个词，`KV cache` 占用就会像吹气球一样持续膨胀；万一所有空闲块都被吃光，在跑请求同一步跨块借不到新槽怎么办？**

```wiki-diagram
file: continuous-batching-budget-and-preempt
```

下面用全站 `v0.30.0` 主基线的标准稠密模型 **`Qwen3-8B`** 把显存与抢占账算实。由 [读懂 HF 模型目录](hf-model-anatomy.md) 可知，`Qwen3-8B` 共 `36` 层、每层 `8` 个 KV 头、`head_dim = 128`，BF16（`2 B`）精度下每 token 的 `KV cache` 为 $2 \times 36 \times 8 \times 128 \times 2\text{ B} = 144\text{ KiB}$。昇腾后端默认按 `block_size = 128` 切分物理块，因此**每块物理 KV 块固定占 $128 \times 144\text{ KiB} = 18\text{ MiB}$**。

为方便徒手核对每一块的去向，下面构造一个缩小版**教学示意块池**：扣除永久保留的 0 号 `null_block` 后，池内共有 **`20` 个可分配物理 KV 块（`2,560` 个位置，合 `360 MiB`）**，单步预算 `max_num_batched_tokens = 2048`。按先后顺序入场的 `R1`、`R2`、`R3` 正处于 `running` 列表中：

| 演变时刻 | 三条请求的位置数与占块账（`128` 词/块） | `allocate_slots` 判定与调度器动作 | 显存块池余量与后续恢复 |
| --- | --- | --- | --- |
| **步前稳态** | `R1` 已算 `890`（占 $\lceil 890/128\rceil = 7$ 块，余 6 槽）；`R2` 已算 `896`（占满 $7$ 块，**余 0 槽**）；队尾 `R3` 已算 `700`（占 $6$ 块） | $7 + 7 + 6 = 20$ 块恰好占满池子 | 空闲块 `= 0` |
| **本步扫 `R1`** | `R1` 推进第 `891` 个位置，直接写进第 7 块剩余空槽 | 无需新块，`R1(+1)` 顺利排入本批 | 空闲块 `= 0` |
| **本步扫 `R2`** | `R2` 推进第 `897` 个位置，跨过 `128` 整块边界需新借 `1` 块，但 `allocate_slots` 返回 `None` | 触发 **LIFO 抢占**：`self.running.pop()` 弹出队尾 `R3`，调 `_preempt_request` 释放其 `6` 块（`108 MiB`），置 `PREEMPTED`、`num_computed_tokens = 0`，并由 `prepend_request` 插回 `waiting` **队首** | `R2` 领走 `1` 块升至 `8` 块继续跑；池内剩 `5` 块；因 `preempted_reqs` 非空，本步**停收 `waiting`** |
| **完结后恢复** | 若干步后 `R1` 完结退场，一次性归还所持有的 `7` 块 | 空闲块变为 $5 + 7 = 12 \ge 6$；排在 `waiting` 队首的 `R3` 把「原提示词 + 已生成输出词」合并成一整段（`701` 位置 $\le 2048$）做一次宽 Prefill **重算（`RECOMPUTE`）** | `R3` 重新领回 `6` 块，从断点后一个词无缝续写，用户侧仅感知一次吐字停顿 |

这里有两个极易混淆的设计取舍值得单独拎清：

- **为什么默认挑 `running` 队尾（后进先出 LIFO）开刀？** 在默认 `FCFS` 策略下，队尾请求最晚入场、已生成的词通常最少，推倒重算浪费的算力最小；同时也能保住排在队首的老请求尽快跑完、腾出整片显存。
- **为什么 vLLM V1 默认采用 `RECOMPUTE`（释放重算）而不是早期 V0 的 CPU `SWAP`？** 被抢占时，请求已生成的词早已作为普通 token 编号保存在 CPU 对象里。恢复时把「提示词 + 已生成词」拼成连续序列，在 Cube 矩阵单元上扫一遍宽 Prefill，耗时往往远低于把零散的 `18 MiB` 大块经 PCIe 总线来回搬运。

> **边界与例外（`PRIORITY` 策略下的抢占顺序）**：开启 `PRIORITY` 策略时，`priority` 整数越小代表优先级越高。调度器改为通过 `max(self.running, key=lambda r: (r.priority, r.arrival_time))` 驱逐优先级最低（数值最大、同级最晚到达）的请求，而不再固定弹出队尾。

## 落到昇腾部署：2048 默认批预算、ACLGraph 补齐与扩展调度器边界

把通用连续批处理搬上昇腾 NPU 时，执行与配置层最容易引起误判的两条工程边界——**`ACLGraph` 向上补齐**与 **`vllm serve` 的 `2048` 默认预算**——拆开看如下：

```wiki-diagram
file: continuous-batching-fig-ascend-padding
```

结合上图把三条核心边界落到源码语义：

1. **为什么 64 GiB 昇腾卡跑 `vllm serve` 默认只给 `2048`？** 上游 `EngineArgs.get_batch_defaults` 在解析命令行默认值时，按 `get_device_total_memory()` 分档（$\ge 70\text{ GiB}$ 在线默认 `8192`）。此时 Worker 尚未初始化 `torch_npu`，`NPUPlatform.get_device_total_memory()` 为避免提前触发单次全局 NPU 运行时初始化而主动抛出 `NotImplementedError`，使外层回落到 `device_memory = 0` 分支。因此在线 `vllm serve` 默认拿到 `max_num_batched_tokens = 2048`、`max_num_seqs = 256`（离线 `LLM` 类为 `8192` / `256`；加 `--performance-mode throughput` 会将两者翻倍，详见 [vllm serve 核心参数](core-cli-params.md)）。
2. **`ACLGraph` 补齐（Padding）会不会把连续批处理打回静态批处理？** **不会。** 在昇腾默认 `ACLGraph` 图模式下，`cudagraph_dispatcher` 与 `_pad_query_start_loc_for_fia` 把本步 `total_num_scheduled_tokens`（及纯 Decode 图下的 `num_reqs`）向上补齐到最近已捕获图档位（如 `19 → 24` 或 `32`），并将尾部 `slot_mapping` 填为 `-1`，阻止算子污染真实物理 KV 块。这种补齐**仅发生在单步算子回放层**；谁在步末 `EOS` 退场、谁在下一步从 `waiting` 补位、物理块何时借还，依然 100% 按步动态流转（多机 DP/MoE 陪跑见 [多条请求同时跑](concurrent-requests.md)）。
3. **昇腾 `additional_config["scheduler_config"]` 策略扩展何时接管默认 `Scheduler`？** 针对特殊部署形态，`vllm-ascend` 提供三类可插拔调度器扩展，按场景严格互斥或受限：

| 扩展配置项（位于 `additional_config.scheduler_config`） | 替换的目标调度器类 | 适用拓扑与硬性边界 |
| --- | --- | --- |
| **`recompute_scheduler_enable: true`** | [`RecomputeScheduler`](recompute-scheduler.md) / `AsyncRecomputeScheduler` | **仅限 P/D 分离的 D 节点**（`kv_role="kv_consumer"`）；混部模式直接抛 `ValueError`，P 节点告警忽略。可配 [`PreemptOffloadConnector`](recompute-cpu-offload.md) 将被抢占 KV 暂存至主机 DRAM 免重算 |
| **`batch_job_sched_config.enabled: true`** | [`BatchJobAwareScheduler`](batch-job-aware-scheduler.md) / `BatchJobAwareAsyncScheduler` | 面向离线/大批量并发防抢占抖动：限制活跃作业数 `max_jobs` 并预留安全块水位 `reserve_margin_blocks`；与 [`short_request_first_config`](short-request-first.md) 互斥 |
| **`profiling_chunk_config.enabled: true`** | [`ProfilingChunkScheduler`](../params/profiling-chunk-config.md)（`v0.23.0`–`v0.30.0`） | 仅在流水线并行 `PP > 1` 下按耗时拟合动态分块尺寸，与 [`enable_balance_scheduling`](balance-scheduling.md) 互斥；社区 `main` 切入 MRV2 后已移除该分支 |

## 常见误解

把初学者在调参与排障时最常踩中的四组认知偏差集中对照如下：

```wiki-diagram
file: continuous-batching-four-myths
```

- **“连续批处理是在『纯 Prefill 轮』和『纯 Decode 轮』之间来回切挡。”** 错。V1 `Scheduler.schedule()` 没有阶段切换开关：同一步先给 `running` 分续写位置，只要 `token_budget` 还有余量，就把 `waiting` 的新提示词拼进同一轮一维批次混跑（详见 [Scheduler](vllm-scheduler.md)）。
- **“排队的新请求（`waiting`）等久了，会抢占正在生成的老请求（`running`）。”** 错。抢占**只**在第一趟扫描 `running` 续跑请求且 `allocate_slots` 返回 `None` 时触发；第二趟扫描 `waiting` 若缺块直接 `break` 等待。一旦本步产生 `preempted_reqs`，整步还会跳过 `waiting` 准入。
- **“`--max-num-seqs` 调得越大，并发越高、吞吐就一定越高。”** 错。盲目拉高并发槽位会让过多请求同时进入 `running` 并每步 `+1` 吞噬 KV 块；总需求撞破块池容量后，会陷入「跨块缺槽 → `PREEMPTED` 释放 → 重算 Prefill」的连环抢占抖动，有效吞吐反而断崖下跌。
- **“发生抢占时，vLLM 默认会把 KV cache 换出（Swap）到 CPU 内存。”** 错。那是早期 V0 的做法；vLLM V1 默认直接走 `RECOMPUTE`（释放物理块、`num_computed_tokens` 归零、排回 `waiting` 队首重算）。若需把抢占 KV 暂存 CPU DRAM，必须显式配置 `KVConnector`（如 P/D D 节点的 `PreemptOffloadConnector`）。

## 对照源码

### 怎么开与核心调优旋钮

连续批处理与一维无填充拼批是 vLLM V1 `EngineCore` 的默认执行底座，启动 `vllm serve` 或离线 `LLM` 即自动生效，无需额外开关。线上调优与排障最常核对的入口如下：

- **容量与预算三旋钮**：`--max-num-batched-tokens`（控单步计算预算与 TTFT/ITL 权衡）、`--max-num-seqs`（控单 DP 实例并发槽位上限）与 `--gpu-memory-utilization`（控预分配 KV 块池水位）。
- **观测抢占是否抖动**：保持统计日志开启，关注引擎警告与 Prometheus 累积抢占计数（对应请求对象上的 `num_preemptions` 与 `EngineCoreEventType.PREEMPTED` 事件）；若频繁上涨，应优先调低 `max_num_seqs` 或调高显存水位。

### 版本差异

下表汇总四套固定仓库基准快照在统一迭代调度、一维拼批与图补齐、昇腾默认批预算及扩展调度器上的核验结果：

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） | 运维与迁移影响 |
| --- | --- | --- | --- | --- | --- |
| **两队列统一调度与 LIFO 抢占** | `scheduler.py#L340-L352` 按进度差先排 `running` 再排 `waiting`，缺块调 `_preempt_request` 走 `RECOMPUTE` | 同机制移至 `scheduler.py#L425-L437`，新增 `throttle_prefills` 形参支持 DP 节流 | `scheduler.py#L561-L872` 延续统一公式与 LIFO `running.pop()`，`_preempt_request` 新增 `drop_stale_output` 处理异步在途输出 | 同逻辑移至 `scheduler.py#L721-L733` 与 `#L1876` | 四版均无 P/D 轮次硬切开关，默认抢占始终为 `RECOMPUTE` |
| **一维拼批与 `ACLGraph` 边界补齐** | `model_runner_v1.py#L862` `_prepare_inputs` 构造一维输入并补齐 `query_start_loc` | 同结构位于 `model_runner_v1.py#L890` | `model_runner_v1.py#L1279-L1463` 拼一维紧致批次，`#L1058-L1106` 按图档位补齐 `num_tokens_padded` / `num_reqs_padded` | 切换至 MRV2 `worker/v2/model_runner.py#L949-L975` 统一管理 `query_start_loc` 与图补齐 | 图补齐仅作用于单步回放，不改变请求按步进出与块回收 |
| **昇腾 `vllm serve` 默认批预算** | `platform.py#L274-L282` 的 `get_device_total_memory` 直接抛 `NotImplementedError`，回落在线 `2048` | 同左（`platform.py#L273-L281`） | `platform.py#L231-L245` 改为未初始化 `torch_npu` 时抛 `NotImplementedError`，参数解析期仍回落在线 `2048` / `256` | 同 `v0.30.0` 初始化守卫逻辑 | 大显存昇腾卡跑高吞吐压测时需显式调大 `--max-num-batched-tokens` |
| **昇腾 `scheduler_config` 策略扩展** | 顶层 `recompute_scheduler_enable` 与同步 `ProfilingChunkScheduler` | 收拢至嵌套 `scheduler_config`，补齐 `short_request_first` 与 `batch_job_sched` | 扩展 `dyntra_lb_config` 与 `ProfilingChunkAsyncScheduler`（配异步调度须启用 MRV2） | `platform.py#L1234-L1319` 保留 `recompute` / `short_request_first` / `batch_job_sched` / `dyntra_lb`，移除 `profiling_chunk` | 升级至 `main` 时需清理旧配置中的 `profiling_chunk_config` |

### 源码位置

- 论文与官方设计依据：vLLM SOSP'23 论文承接 Orca 迭代级调度并结合分页块消除 `<pad>` 与外部碎片 [S1]；Sarathi-Serve 阐述 Decode 优先与分块 Prefill 同批混跑的吞吐-时延折中 [S2]；上游优化与架构文档定义 V1 默认 `RECOMPUTE` 抢占、分块调度策略及 `EngineCore` 循环职责 [S3][S4]；昇腾文档说明 `ACLGraph` 捕获回放模式与 P/D D 节点 `PreemptOffloadConnector` 保 KV 机制 [S5][S6]。
- V1 核心调度、抢占与步末停机回收：`EngineCore.step` 串起“调度选人 → 前向采样 → 步末判停退旧补新”的单步循环 [C7]；`Scheduler.schedule` 先扫 `running` 再扫 `waiting` [C8][C10]；`waiting` 缺块直接 `break` 不抢占 [C11]，而 `running` 缺块执行 LIFO 弹出、清零 `num_computed_tokens` 并插回 `waiting` 队首 [C9][C12]；步末 `update_from_output` 调 `check_stop` 判定 `RequestStatus` 终态并当场 `remove_all` 释块 [C13][C14][C15]。
- 昇腾默认参数、块大小、图补齐与跨版本演进：`SchedulerConfig`、`get_batch_defaults` 与 `get_device_total_memory` 初始化前守卫共同决定在线默认 `2048` 批预算与 `256` 并发槽 [C16][C17][C18]；`NPUPlatform` 校验扩展调度策略并通过 `refresh_block_size` 将标准块长设为 `128` [C19][C20][C21]；`NPUModelRunner`（及 `main` MRV2）完成一维无填充拼接与 `ACLGraph` 边界补齐 [C22][C23][C30]。
- 算例推导与示意边界：`Qwen3-8B` 每 token `144 KiB` 与每 `128`-token 物理块 `18 MiB`（`20` 块共 `360 MiB`）及跨块槽位余量均由静态模型配置与块长精确推导 [D]；`token_budget = 8` 三步流转与 `20` 块微缩池均为隔离外部干扰的教学人为设定 [A]；`FCFS` 下队尾重算代价最小及过高 `max_num_seqs` 诱发抢占抖动属结合访存与到达序得出的工程归纳 [I]。
