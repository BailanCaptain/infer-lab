---
id: prefetch-ratio
title: prefetch_ratio
type: param
summary: >-
  weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp
  三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 上被静默忽略、main 上直接报错，没有替代键。
aliases:
  - 权重预取比例
  - weight prefetch ratio
chapters:
  - '19'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L704-L720'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L34'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L46-L69'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L104'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L230-L238'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L131'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L74-L89'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/activation.py#L37-L43'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158'
  - 'vllm-ascend@2c59ff10:tests/ut/ops/a2/test_weight_prefetch.py#L45-L52'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L11-L32
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L346'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L235-L249'
  - >-
    vllm-ascend@baa023ad:tests/e2e/pull_request/two_card/test_qwen3_performance.py#L72-L75
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L709
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L62'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3-Dense.md#L541-L541'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - >-
    vllm-ascend@2ed6cbba:tests/e2e/pull_request/two_card/test_qwen3_performance.py#L76-L76
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L701'
  - >-
    vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L276-L340
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L37-L55'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L153-L158'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L149-L157'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2282-L2286'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L74-L122
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L98-L131'
  - 'vllm@0fc695fc:vllm/distributed/utils.py#L109-L154'
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: C
relations:
  - to: weight-prefetch-config
    kind: builds-on
    note: 只有 weight_prefetch_config.enabled 为 true 时这张比例表才会被读到，比例本身不能开关特性
  - to: ascend-config-system
    kind: builds-on
    note: 这个键只是 additional_config 里的一段嵌套 dict，main 上它被 extra="forbid" 拒收的机制在那一页
contradicts: []
updated: "2026-10-02"
rawSources:
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-f59692c49c1984e93f232c96cec3de2bfd3c1627bb1bec2502b284fce4d71a86.md
---

## 一句话

`prefetch_ratio` 是 [weight_prefetch_config](weight-prefetch-config.md) 下的嵌套 dict，只回答一件事：**这块权重提前搬前百分之几进 L2**。按 `attn` / `moe` / `mlp` 三组共五个权重各给一个 0 到 1 的数，v0.23.0 的默认值是 `{"attn": {"qkv": 1.0, "o": 1.0}, "moe": {"gate_up": 0.8}, "mlp": {"gate_up": 1.0, "down": 1.0}}` [S15]。

该碰它的人很少。这套默认值是按 Qwen3-235B-A22B-W8A8 那一档并发标定出来的，改它的前提是你的模型和并发跟标定场景差得远、而且已经抓过 profiling。

**存在范围**：它只到 **v0.23 维护分支**为止，v0.24.0rc 起整个 weight prefetch 特性被连根删掉，v0.26 分支（2026-09-17 的源码快照）与 main 开发主线上都没有这个键，也没有替代品——具体哪个 PR 删的见下面「版本谱系」。**在 v0.26 上照旧配置它不会报错** [!]：那里的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C24]，服务照常起来、比例一个都不会被读；main 则是 `extra="forbid"`，同一份配置直接起不来。

**GLM 双机这套部署上它是关着的，一个比例都不会被读。** 官方两机启动命令里没有传 `additional_config`，而 `WeightPrefetchConfig` 的 `enabled` 默认就是 `False`（v0.23 维护分支与含 GLM 代码的那个提交都一样）[C26]。那条命令里确实有个带 prefetch 字样的开关——`--safetensors-load-strategy prefetch`——但它管的是启动时从磁盘预读 safetensors 文件，和本页讲的「从 HBM 往 L2 提前搬」是两件不相干的事 [S27]。真在含 GLM 代码的那个提交上手动开起来会怎样，见下面[开了的代价](#开了的代价)末尾。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | `weight_prefetch_config.prefetch_ratio` | 不存在，未知键被静默忽略 | 不存在，未知键被 `extra="forbid"` 拒收 [C17] | 旧启动脚本搬到 v0.26 是「配了没人读」，搬到 main 是启动就报错——两种失败长得完全不一样 |
| 类型 / 默认值 | dict，`{"attn":{"qkv":1.0,"o":1.0},"moe":{"gate_up":0.8},"mlp":{"gate_up":1.0,"down":1.0}}` | — | — | 顶层只要传了这个键就整个替换默认值，不做逐键合并 |
| 每项取值范围 | `0 ≤ r ≤ 1`，越界项被静默丢弃 | — | — | 写 `1.2` 不报错，但那一项等同于没配 |
| 某项缺失或越界时 | `.get(prefix, 0)` → 字节数 0 → `max_size <= 0` 被改写成全量 [C5] | — | — | 漏写一项不是「不预取」，而是 **100% 预取**，方向正好反了 [D] |
| 整组全为 0 | 该组 `enable` 置 False，完全不预取 | — | — | 这是关掉某一组的唯一正确写法 |
| 单次预取上限 | `mlp` 两项在 Python 侧截到 18 MiB [C6]；`attn` / `moe` 在 Python 侧不截，后端是否另有上限**待核** | — | — | `mlp` 那两项只要 `ratio × 单卡字节数 ≥ 18 MiB`，改比例就看不出差别；`attn` / `moe` 要等后端口径核实才能这么说 |
| `attn.qkv` / `attn.o` 生效条件 | 静态 W8A8 的 `apply` 里、输入还不是 int8，且层的类名**精确等于** `AscendQKVParallelLinear`（对应 `qkv`）或 `AscendRowParallelLinear`（对应 `o`）[C32]；`o` 这一项没有 token 门槛 | — | — | 非静态 W8A8 的模型改这两个值完全无效；`o` 的类名条件比「attention 的输出投影」宽，可能覆盖到 MLP 的 `down` |
| `moe.gate_up` 生效条件 | MoE 模型、该次 forward 的 token 数 ≥ 96，**而且**要有模型实例、上下文里的层索引为正、能取到 `w13_weight` [C33]（索引的初值来自模型的 `start_layer`、实例由上下文写入 [C30]）| — | — | ≥ 96 不是充分条件：取不到权重照样一次都不发，GLM 就是这种情形（见下面 GLM 段）|
| `mlp.gate_up` / `mlp.down` 生效条件 | 稠密模型、层索引有效且 `num_tokens < 500`：`gate_up` 还要经过自定义的行并行 `apply` 才有入口 [C29]，`down` 走带钩子的 SwiGLU 就行、**不要求**序列并行 [C28] | — | — | MoE 模型改 `mlp.*` 无效，反之亦然；相关优化开关都默认关着的单卡 dense，连 `gate_up` 这一路调用都没有 |
| 默认值的标定场景 | Qwen3-235B-A22B-W8A8 @ `--max-num-seqs 144`、Qwen3-32B-W8A8 @ `72` | — | — | 并发量与之相差很远时，默认值没有理由继续最优 |

## 为什么存在

权重预取的机制、触发条件与整体取舍在 [weight_prefetch_config](weight-prefetch-config.md) 那页。这里只管一件事：**搬多少**。搬得太少收益拿不满，搬得太多则与同一段 vector 计算抢 MTE（负责在片外内存与片上缓存之间搬数据的搬运单元）与 L2 带宽，反而更慢（一个算子在卡里怎么分成搬入、矩阵、向量这些执行段，见[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)）——所以上游加了 `prefetch_ratio`，让用户按具体负载调整这个尺寸。

比例要按权重种类分开给，是因为五个权重各自被藏在长度完全不同的 vector 窗口后面，起点也不在同一个算子里。而且写进去的那个小数，到发预取之前还要过两道手：先乘成字节数，再看这一组要不要截——`mlp` 两项在 Python 侧截到 18 MiB，`attn` / `moe` 交给后端，后端有没有同一档上限**待核**。

```wiki-diagram
file: prefetch-ratio
```

`attn` 组用层的类名而不是权重名来路由：`AscendQKVParallelLinear` 对应 `qkv`，`AscendRowParallelLinear` 对应 `o`（出处见事实表那一行）。`moe.gate_up` 打到的是融合 MoE 的 `w13_weight`——本卡全部局部专家的 gate 与 up 权重栈，不是单个专家。

**这个 dict 并不管所有预取。** MLA / SFA 那两条路径走到调用点后只看 `enabled`：融合 QKV 直接请求整块，`o_proj` 则要求包装它的量化方法**不是**静态 W8A8（是静态的就直接跳过），满足时按权重大小与自己的固定上限取较小值；两者都不读比例、也没有 token 门槛（见[机制页的事实表](weight-prefetch-config.md#事实表)）。所以调这五个比例，调不到这两条路上去。

**`moe` 的 0.8 从哪来。** 源码与官方文档都没有给出推导，文档只说这套默认值在 Qwen3-235B-A22B-W8A8、`--max-num-seqs 144` 下表现良好，所以它是一个标定出来的经验值。机制上说得通的解释是：`moe.gate_up` 的遮蔽窗口是门控 top_k 那一小段 vector 计算，比 SwiGLU、RMSNorm 都短，而要搬的 `w13_weight` 又比任何单个稠密矩阵大几个量级，留 20% 余量可以降低预取压满带宽的风险——这一步是推断，源码里没有写。

这个解释能不能被「截断」推翻，要看 `moe` 这一项的字节数最终有没有上限。Python 侧只夹 `mlp` 两项（见事实表），`moe` 交给后端，而**后端的上限口径待核**。所以只能给一个条件结论：**如果**后端也按 18 MiB 这一档截，那么 `0.8 × w13_weight 字节数 ≥ 18 MiB`（即权重超过 22.5 MiB）时，0.8 与 1.0 会被截成同一个值，而 W8A8 的 MoE 权重栈很容易越过这个门槛——在它自己的标定场景里，这两个取值就很可能没有可观测差别 [D]。后端若没有这一档上限，这段推理不成立。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面的数全是**配置值**和由权重字节算出来的**推导值**，不是测出来的效果。上游只给了「这套默认值在某几个标定场景下表现良好」这种定性说法，没公开开与不开的时延、吞吐对照，我们在钉住的提交上也没有实测数据。GLM 双机主线里的那些时延和吞吐数字，是**预取关着**的那套部署的数字，不能拿来当这个开关的收益。

**调大**：预取搬运与同一段 vector 计算争 MTE 与 L2，预取没能在 vector 算完之前结束就变成净开销，官方给的判据是抓 profiling，看那条单独流上的 CMO 操作是否落在对应 vector 算子的时间窗内、且不晚于它结束 [S14]。低延迟优先的场景上游直接建议不要开这个特性。

**调小**：收益拿不满；低并发下预取本来就没优势，文档建议调小或干脆关掉。

**`mlp` 超过 18 MiB 的部分白给**：判断口径是 `ratio × 该权重的单卡字节数` 与 18 MiB 比大小，这一档只在 Python 侧夹 `mlp` 两项；`attn` / `moe` 交给后端，**后端有没有同一档上限待核**，所以这两组还不能照同样的口径说「超出部分白给」。稠密模型的 `gate_up_proj` 通常远超 18 MiB，**走得到行并行 `apply` 这个入口时**，比例在那里就只是个饱和了的旋钮；而单卡切分后落在 18 MiB 以内的权重，比例才真正线性起作用。一个具体例子见 [weight_prefetch_config 页「开了的代价」里的 Qwen3-0.6B 记录](weight-prefetch-config.md#开了的代价)：稠密 bf16 小模型、TP1，只开本参数、其余相关开关默认关着时，五个比例里实际被读到的只有 `mlp.down`（整块 6 MiB，没顶到上限，比例调多少就搬多少），`gate_up` 默认连入口都没有。

**三个容易踩空的写法**：

1. **漏写一项 = 把它开到 100%，不是关掉。** 传 `{"attn": {"qkv": 0.5}}` 时，`attn` 组非空所以不会回退默认值，`o` 取不到就按 0 算字节数，而 `maybe_npu_prefetch` 遇到 `max_size <= 0` 会改写成整块权重 [C7]。结果是你想收紧 attn，`o` 反而从 1.0 变成了全量。同理写 `{"mlp": {"gate_up": 1.0, "down": 0}}` 也不会关掉 `down`。
2. **想关掉一组，要把该组所有项都写成 0。** 全 0 时 `enable` 被置 False，这一组才真正不预取；写成空 dict 或整组不写，都会回退到该组的内建默认值。
3. **越界值不报错。** `1.2`、`-0.5` 会被静默丢出字典（上游单测锁死了这个行为），随后落进第 1 条的全量分支。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、TP8 / DP2 / EP16、权重 W8A8）。这套部署本身没开它（见上面「一句话」），下面是在含 GLM 代码的那个提交上手动开起来的推演：

- `mlp.gate_up` / `mlp.down` 不进分支：GLM 是 MoE 模型，这两项的生效条件是稠密模型。它们本来能管的是[前 3 层的稠密 MLP](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)——TP8 下[每卡每层合计 18 MiB](../concepts/tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)，[拆开是 gate_up 与 down 两块](../concepts/tensor-parallel.md#开销和什么时候别开)，两块都在单次 18 MiB 的上限以内，正是比例能线性起作用的尺寸；可惜在 MoE 模型上这条路根本不走。
- `moe.gate_up` 看着像是唯一落得上的一项，实际上**一次都不会发**。它要打的是本卡那 18 个局部专家栈起来的 `w13_weight`（[每卡每层 432 MiB 路由专家权重](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)里 gate 与 up 的那一部分），但在 GLM 上这块权重根本取不到：取权重那一步在索引为空、索引 ≤ 0 或模型实例为空时就返回空，取到空就清掉状态、这一次不发 [C33]。GLM 这套部署只有一级流水线，层索引的初值取 `make_layers` 给出的 `start_layer` [C31]，PP = 1 时上游的分层计算把它定成 0 [C34]；而全层只有 `mlp.down` 那一处会把索引加一，MoE 这条路不推进它 [C6]，于是索引始终不为正——主干因此一次都不发。MTP 那条独立 context 没有把模型实例传进来，在更早的检查处就返回了，这一条按机制页的结论写，本页没有另引源码。所以 token 数 ≥ 96 只是必要条件之一，过了也不等于会预取——这几条门槛与取权重的做法见[机制页「开了的代价」](weight-prefetch-config.md#开了的代价)。比例在这里写多少都一样，原因不是「被截到上限」，而是这条路压根没走。
- `attn.qkv` 在 GLM 上**一定不发**：它要求层的类名精确等于 `AscendQKVParallelLinear`，而 GLM 的 attention 里没有这个类型的层，和量化清单齐不齐都无关。`attn.o` 反而是这套部署上**唯一可能真发出去**的一项——它认的是 `AscendRowParallelLinear` 这个类名、没有 token 门槛，但仍要落在静态 W8A8 的 `apply` 里、且输入还不是 int8（条件见事实表）。**待核：缺模型目录下的 `quant_model_description.json`，GLM 哪些层最终命中静态 W8A8、实际输入是什么 dtype，要靠它才能定**；底稿只推断了稠密 MLP 走 W8A8 **dynamic**，attention 那几个投影归哪个方法没有推断。另外[那 34 层 KDA 的投影](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)按同一份推断是 BF16，不量化的线性层本来就不在这个特性的挂钩范围里。

**去向：删了，没有替代开关。** v0.23.0 的发布说明先把 weight prefetch 列进待废弃清单 [S18]，随后 PR #11949 把它整体摘掉，v0.26.0rc1 的发布说明里记着这一笔 [S21]。v0.26 分支与 main 上 `WeightPrefetchConfig`、`prefetch_ratio`、`ops/weight_prefetch.py` 和 `prefetch_preprocess` 的算子注册都已不在，main 的 `AscendConfig` 自述的「全部受支持键」里也找不到 `weight_prefetch_config` [C16]。

**而且上游仓库里还留着过期的启动命令**：two_card 的 Qwen3 性能 e2e 用例 [C19] 和 Qwen3 稠密模型教程 [S23] 都还写着 `"weight_prefetch_config":{"enabled":true}`，v0.26 分支上同一个用例也原样留着 [C25]。照抄它们在 main 上会撞上 `extra="forbid"` 起不来，在 v0.26 上则是起得来、比例一个都没读 [!]。main 的另一个例外是装了 `vllm_omni` 的环境——那里未知键只打一条 warning 然后被丢掉，于是配置也变成真正的静默无效 [C22]。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（2 个文件） |
| releases/v0.18.0 | 有（2 个文件） |
| releases/v0.20.2rc | 有（2 个文件） |
| releases/v0.21.0rc | 有（2 个文件） |
| releases/v0.22.1rc | 有（2 个文件） |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 无 |

- **引入**：2025-10-09 · ff3757593614964f7ab91dab3da0c4aee568bec8 · PR [#3146](https://github.com/vllm-project/vllm-ascend/pull/3146) —— [1/N][Feat] Add weight prefetch feature for Attention layers (#3146)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev
  - `vllm_ascend/utils.py` +10 / −14（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/torchair_mla.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +5 / −4（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +11 / −2（文本行变化）
- **移除**：2026-07-16 · e77502ef715f612f2cc6f3c833174431f26cb765 · PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) —— [Refactor] Remove weight prefetch config (#11949)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/ops/weight_prefetch.py` +0 / −238（文本行变化）
  - `vllm_ascend/ops/register_custom_ops.py` +1 / −40（文本行变化）
  - `vllm_ascend/utils.py` +1 / −25（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −22（文本行变化）
  - `vllm_ascend/quantization/methods/w8a8_static.py` +0 / −15（文本行变化）

当前含该标识符的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["prefetch_ratio"]` |
| 类型 | `dict` |
| 默认表达式 | `{'attn': {'qkv': 1.0, 'o': 1.0}, 'moe': {'gate_up': 0.8}, 'mlp': {'gate_up': 1.0, 'down': 1.0}}` |
| 定义 | `vllm_ascend/ascend_config.py:709` [C20] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
