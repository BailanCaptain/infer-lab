---
id: prefetch-ratio
title: prefetch_ratio
type: param
summary: >-
  weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp
  三组、五个权重分别指定「预取权重的前百分之几」；v0.23.0 维护分支上可用，v0.24.0rc 起随整个 weight prefetch
  特性一起删除，v0.26 上被静默忽略、main 与 rc2 通常拒收，Omni 环境告警过滤，没有等价替代键。
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
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L276-L340'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L37-L55'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L153-L158'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L149-L157'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2282-L2286'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L74-L122
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L98-L131'
  - 'vllm@0fc695fc:vllm/distributed/utils.py#L109-L154'
  - >-
    raw:sha256-1d83babf8ed10c6ff9402b2cf25492c423cf9a14ee0a26e0c1f395009106882e.md#L1-L672
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ops/weight_prefetch.py#L26-L34
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json'
  - 'https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L364-L461'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L125'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
evidence: C
relations:
  - to: weight-prefetch-config
    kind: builds-on
    note: 构造时会读取和过滤比例；执行预取还须父开关开启、对应组启用并满足调用条件，比例不能代替父开关
  - to: ascend-config-system
    kind: builds-on
    note: 这个键只是 additional_config 里的一段嵌套 dict，main 上它被 extra="forbid" 拒收的机制在那一页
  - to: ai-core
    kind: builds-on
    note: 预取比例的收益与代价建立在计算、数据搬运及流水重叠的基础上；理解这些硬件执行环节，才能解释预取与向量计算争用资源为何可能降低性能。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-1d83babf8ed10c6ff9402b2cf25492c423cf9a14ee0a26e0c1f395009106882e.md
  - >-
    raw/sha256-703d348dfed5c48687d7ecc8b88872ff05f85ddde437c775ada624d740514e88.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-f59692c49c1984e93f232c96cec3de2bfd3c1627bb1bec2502b284fce4d71a86.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 未恢复旧 weight_prefetch_config 及其 prefetch_ratio，没有对应的公开配置字段和运行时消费链。继续传旧父对象会进入未知顶层键处理，把子键移到顶层也不会生效。下文的 L2 权重预取比例保留为 v0.23 的历史排错依据；其他 KV/pool 预取机制不沿用这组比例。

`prefetch_ratio` 是 [weight_prefetch_config](weight-prefetch-config.md) 下的嵌套 dict，**为不同权重的预取请求指定比例**；最终请求尺寸还受取整、分组开关和路径规则影响。按 `attn` / `moe` / `mlp` 三组共五个权重各给一个 0 到 1 的数，v0.23.0 的默认值是 `{"attn": {"qkv": 1.0, "o": 1.0}, "moe": {"gate_up": 0.8}, "mlp": {"gate_up": 1.0, "down": 1.0}}` [S15]。

官方报告这套默认值在 Qwen3-235B-A22B-W8A8 与 Qwen3-32B-W8A8 的两档并发上表现良好，但没有给出默认值的推导。调整前先抓 profiling，比较预取与并行计算的时间窗；不能仅凭模型或并发接近，就认为默认值最优。

**存在范围**：固定 v0.23 维护分支保留此功能；v0.24.0rc 起删除整套实现，固定 v0.26、main 与 rc2 均无这个配置和等价替代键，删除提交见「版本谱系」。v0.26 的 `AscendConfig` 逐个键 `.get()` 取值，忽略这个未知键 [C24]；这只说明本键不会导致配置拒收，不保证整条启动命令成功。main 与 rc2 通常按 `extra="forbid"` 拒收；装有 vllm_omni 时改为告警后过滤，同样不会启用旧预取。

**GLM 双机这套部署上它是关着的，比例不会用于发起预取。** 官方两机启动命令里没有传 `additional_config`，而 `WeightPrefetchConfig` 的 `enabled` 默认就是 `False`（v0.23 维护分支与含 GLM 代码的那个提交都一样）[C26]。构造对象仍会读取比例和过滤越界值，是否发起预取由后续开关与调用条件决定。命令中的 `--safetensors-load-strategy prefetch` 管启动时预读 safetensors 文件，与本页 HBM 到 L2 的预取不同 [S27]。手动开启的路径分析见[开了的代价](#开了的代价)。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | `weight_prefetch_config.prefetch_ratio` | 不存在，未知键被静默忽略 | 不存在，通常被 `extra="forbid"` 拒收；Omni 环境告警过滤 [C17] | rc2 与 main 的这项处理一致；忽略或过滤都不会启用旧功能 |
| 类型 / 默认值 | dict，`{"attn":{"qkv":1.0,"o":1.0},"moe":{"gate_up":0.8},"mlp":{"gate_up":1.0,"down":1.0}}` | — | — | 顶层只要传了这个键就整个替换默认值，不做逐键合并 |
| 每项取值范围 | `0 ≤ r ≤ 1`，越界项被静默丢弃 | — | — | 写 `1.2` 不报错，但那一项等同于没配 |
| 某项缺失或越界时 | `.get(prefix, 0)` 得到字节数 0 [C5]，实际走到预取包装时按整块权重大小请求 | — | — | 只有全局开关开启、过滤后的同组仍有非零项、且当前路径实际进入预取调用时，缺失项才形成全量请求；配置缺项本身不保证发生预取 [D] |
| 整组全为 0 | 该组 `enable` 置 False，完全不预取 | — | — | 过滤无效比例后，剩余值全为 0 或集合为空都会关闭该组；全局禁用也优先生效。因此全零并非唯一关闭方式 |
| 单次预取上限 | `mlp` 两项的正字节请求在 Python 侧截到 18 MiB [C6]；`attn` / `moe` 在 Python 侧不截，后端是否另有上限**待核** | — | — | `mlp` 两个正比例都满足 `ratio × 单卡字节数 ≥ 18 MiB` 时，请求尺寸相同；实际搬运量和收益仍须测量。整数截断为 0 的请求另走全量回填规则 |
| `attn.qkv` / `attn.o` 生效条件 | 静态 W8A8 的 `apply` 里、输入还不是 int8，且层的类名**精确等于** `AscendQKVParallelLinear`（对应 `qkv`）或 `AscendRowParallelLinear`（对应 `o`）[C32]；`o` 这一项没有 token 门槛 | — | — | 非静态 W8A8 的模型改这两个值完全无效；`o` 的类名条件比「attention 的输出投影」宽，可能覆盖到 MLP 的 `down` |
| `moe.gate_up` 生效条件 | MoE 模型、该次 forward 的 token 数 ≥ 96，**而且**要有模型实例、上下文里的层索引为正、能取到 `w13_weight` [C33]（索引的初值来自模型的 `start_layer`、实例由上下文写入 [C30]）| — | — | ≥ 96 不是充分条件：取不到权重照样一次都不发，GLM 就是这种情形（见下面 GLM 段）|
| `mlp.gate_up` / `mlp.down` 生效条件 | 稠密模型、层索引有效且 `num_tokens < 500`：`gate_up` 还要经过自定义的行并行 `apply` 才有入口 [C29]，`down` 走带钩子的 SwiGLU 就行、**不要求**序列并行 [C28] | — | — | MoE 模型改 `mlp.*` 无效，反之亦然；相关优化开关都默认关着的单卡 dense，连 `gate_up` 这一路调用都没有 |
| 官方报告默认值表现良好的场景 | Qwen3-235B-A22B-W8A8 @ `--max-num-seqs 144`、Qwen3-32B-W8A8 @ `72` | — | — | 这是指定场景的定性报告，没有证明这些比例最优，也不能外推到其他并发与模型 |

这里的 max-num-seqs 是配置的并发上限，不代表运行时始终有同样数量的请求。

## 为什么存在

权重预取的机制、触发条件与整体取舍在 [weight_prefetch_config](weight-prefetch-config.md) 那页。本页的比例控制的是**发出的预取请求尺寸**。预先请求的数据较少，可能留下更多后续搬运；请求较多，则可能与同一段 vector 计算争用 MTE（负责在片外内存与片上缓存之间搬数据的搬运单元）及 L2 带宽。具体取舍要看负载与实际执行时间，不能仅由比例判断快慢（执行环节见[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)）。

比例按权重种类分开配置，各项的触发算子和可重叠计算窗口不同；窗口实际长短要测量。写进去的小数先乘本地权重字节数并取整，再按路径处理：`mlp` 两项的正字节请求在 Python 侧截到 18 MiB，`attn` / `moe` 没有这道截断；后端有没有同一档上限**待核**。取整为 0 时的全量回填规则见下文，不能把这一过程概括成比例与搬运量必然线性。

```wiki-diagram
file: prefetch-ratio
```

`attn` 组用层的类名而不是权重名来路由：`AscendQKVParallelLinear` 对应 `qkv`，`AscendRowParallelLinear` 对应 `o`（出处见事实表那一行）。`moe.gate_up` 打到的是融合 MoE 的 `w13_weight`——本卡全部局部专家的 gate 与 up 权重栈，不是单个专家。

**这个 dict 并不管所有预取。** MLA / SFA 那两条路径走到调用点后只看 `enabled`：融合 QKV 直接请求整块，`o_proj` 则要求包装它的量化方法**不是**静态 W8A8（是静态的就直接跳过），满足时按权重大小与自己的固定上限取较小值；两者都不读比例、也没有 token 门槛（见[机制页的事实表](weight-prefetch-config.md#事实表)）。所以调这五个比例，调不到这两条路上去。

**`moe` 的 0.8 从哪来。** 源码与官方文档都没有给出推导，文档只报告它在指定 Qwen3 场景下表现良好。选专家入口与 SwiGLU 的预取入口不同，但仅凭调用位置不能比较两段计算的实际时间，也不能断言所有专家权重栈都比稠密矩阵大几个量级。判断 0.8 是否合适，需要该模型的本地权重尺寸、预取时间和并行计算时间窗。

这个解释能不能被「截断」推翻，要看 `moe` 这一项的字节数最终有没有上限。Python 侧只夹 `mlp` 两项（见事实表），`moe` 交给后端，而**后端的上限口径待核**。只能给一个尺寸算例：**如果**后端也按 18 MiB 截断，且 `0.8 × w13_weight 字节数 ≥ 18 MiB`（即本地权重至少 22.5 MiB），那么 0.8 与 1.0 对应的尺寸会被截成同一个值 [D]。本页没有确认该后端限制或标定部署的本地权重尺寸，不能据此推断其实际性能是否相同；后端若没有这一档上限，尺寸等价也不成立。

## 开了的代价

下面的数是**配置值**和由权重字节算出的**推导值**。本页引用的固定指南仅定性报告这些默认值在指定标定场景下表现良好，没有给出该部署开与不开的时延、吞吐对照；本项目也没有在这些钉点上实测。GLM 双机主线里的时延和吞吐数字来自**预取关着**的部署，不能当作这个开关的收益。

**调大**：可能增加预取搬运与 vector 计算对 MTE、L2 的争用。固定指南建议抓 profiling，检查单独流上的 CMO 操作是否落在对应 vector 算子的时间窗内、且不晚于它结束 [S14]；最后仍要比较完整执行时间，不能只看预取是否更早提交。对低延迟优先场景，该指南建议关闭此特性。

**调小**：可能减少预先请求的数据量，也可能减少资源竞争。固定指南建议低并发时调小或关闭；这不证明所有低并发部署都没有收益。

**`mlp` 的正字节请求在 18 MiB 截断。** 先算 `int(ratio × 该权重的单卡字节数)`；结果大于 0 时才以 18 MiB 为上限。只要两种取值都触顶，提交的请求尺寸就一样。结果为 0 时则另走公共包装的整块回填，不能把零值或很小的正比例理解为线性缩小后的实际搬运量。`attn` / `moe` 没有这道 Python 截断，**后端有没有同一档上限仍待核**。

具体例子见 [weight_prefetch_config 页的 Qwen3-0.6B 记录](weight-prefetch-config.md#开了的代价)：稠密 bf16 小模型、TP1，只开父开关、其余相关开关默认关闭，并满足调用条件时，五项中发起比例预取的只有 `mlp.down`；`gate_up` 默认没有对应入口。down 整块为 6 MiB，正比例在整数结果大于 0 时按乘积取整得到请求尺寸，不触及 18 MiB 上限；取整为 0 且组仍启用时请求整块。请求尺寸不等于已测得的实际数据搬运量。

**三个容易踩空的写法**：

1. **漏写一项或把某项写成零，不能直接认定该项不预取。** 传 `{"attn": {"qkv": 0.5}}` 时，`attn` 组非空，不会逐键补默认值，`o` 取不到就按 0 算字节数；实际走到 `maybe_npu_prefetch` 时，`max_size <= 0` 会改写成整块权重 [C7]。这要求全局开关开启、同组仍有非零项、且当前计算路径确实进入对应预取调用。同理，传 `{"mlp": {"gate_up": 1.0, "down": 0}}` 时，只要这些条件满足并进入 MLP 的 down 调用，零字节也会被改成整块请求；写零不是该项的独立关闭开关。请求整块权重不等于已测得实际搬运量或性能收益。
2. **把组内所有项写成 0，是关闭该组的一种办法。** 过滤无效比例后没有非零值（包括过滤成空集合）也会使该组关闭，父开关关闭则全局不发起预取。输入本身是空 dict 或整组未写时，会先回填该组默认值，不能把它与过滤后为空混为一谈。
3. **越界值不报错。** `1.2`、`-0.5` 会被静默丢出字典（上游单测锁死了这个行为），该项随后按缺项处理；只有第 1 条的组启用与实际调用条件都满足时，才会形成全量请求。过滤后整组没有非零项时，该组关闭。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、TP8 / DP2 / EP16、权重 W8A8）。这套部署本身没开它（见上面「一句话」），下面是在含 GLM 代码的那个提交上手动开起来的推演：

- `mlp.gate_up` / `mlp.down` 不进分支：GLM 是 MoE 模型，这两项的生效条件是稠密模型。对应的[前 3 层稠密 MLP](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)在 TP8 下[每卡每层合计 18 MiB](../concepts/tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)，[拆成 gate_up 与 down 两块](../concepts/tensor-parallel.md#开销和什么时候别开)，单块都小于 18 MiB；但模型整体的 MoE 判定关闭了 MLP 预取组，因此这里不会发起这两项请求。
- `moe.gate_up` 要预取本卡 18 个局部专家合并的 `w13_weight`（[每卡每层 432 MiB 路由专家权重](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)中的 gate 与 up 部分），但 GLM 没有通过取权重所需的正层索引检查：上下文默认索引为 None，只有对象具有 model.start_layer 才赋值；直接语言模型在 PP=1 时的起点也只是 0 [C30] [C31] [C34]。GLM 的 mlp 模块关闭，不会通过 down 钩子推进这个索引，因此 MoE 取权重返回空、清掉 active 后退出 [C33]。多模态外层结构及 MTP 未传模型实例的另一条退出路径，见[机制页](weight-prefetch-config.md#开了的代价)。token 数 ≥96 不是充分条件，比例在这里写多少都不会改变未发起请求的结果。
- **两份固定量化目录都不进入 attn 比例路径。** 9e55cbc8 与 3121f187 的权重标记只有 FLOAT 和 W8A8_DYNAMIC，没有静态 W8A8；固定执行侧按这些标记选择不量化或动态方法，均不进入静态方法中的预取钩子。因此在这两份目录及本页执行快照下，attn.qkv 与 attn.o 都不会发起比例控制的预取，无须再靠输入 dtype 猜测。两份清单的具体差别统一见[量化版本与权重账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。换成其他量化目录时，仍须重新核静态方法、精确类名及非 int8 输入条件。

这不表示手动打开父开关后没有任何预取：GLM 的 SFA native 路径另有不读这些比例的融合 QKV 与输出投影预取，后者在这两份目录下也不满足“静态 W8A8 则跳过”的条件。它们的尺寸与调用前提见[机制页](weight-prefetch-config.md#开了的代价)。

**去向：删了，没有替代开关。** v0.23.0 的发布说明先把 weight prefetch 列进待废弃清单 [S18]，随后 PR #11949 把它整体摘掉，v0.26.0rc1 的发布说明里记着这一笔 [S21]。v0.26 分支与 main 上 `WeightPrefetchConfig`、`prefetch_ratio`、`ops/weight_prefetch.py` 和 `prefetch_preprocess` 的算子注册都已不在，main 的 `AscendConfig` 自述的「全部受支持键」里也找不到 `weight_prefetch_config` [C16]。

**上游仓库仍有过期启动命令**：two_card 的 Qwen3 性能 e2e 用例 [C19] 和 Qwen3 稠密模型教程 [S23] 都还写着 `"weight_prefetch_config":{"enabled":true}`，v0.26 分支上同一个用例也原样留着 [C25]。固定 main 通常拒收该键，固定 v0.26 忽略它；main 装有 `vllm_omni` 时会 warning 后过滤 [C22]。这些例子的存在不证明功能仍在，也不能据此保证整条命令能成功部署。

在 `2c59ff10` 中，来源 3 的 `ModuleWeightPrefetchConfig.__post_init__` 先过滤越界比例，再以有效比例中是否还有非零值决定组启用；来源 4 决定空组回退与模型类型限制；来源 5、6 计算缺项或零值的字节数；来源 8 将这些调用接到来源 7 的 `maybe_npu_prefetch`，后者才把非正请求大小改为权重总字节。调用仍须满足事实表的入口条件；Qwen 场景的官方定性评价与设备性能实测的区别见“开了的代价”。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |

- **引入**：2025-10-09 · ff3757593614964f7ab91dab3da0c4aee568bec8 · PR [#3146](https://github.com/vllm-project/vllm-ascend/pull/3146) —— [1/N][Feat] Add weight prefetch feature for Attention layers (#3146)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev、origin/zxy_fix_boradash
  - `vllm_ascend/utils.py` +10 / −14（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/torchair_mla.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +5 / −4（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +11 / −2（文本行变化）
- **移除**：2026-07-16 · e77502ef715f612f2cc6f3c833174431f26cb765 · PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) —— [Refactor] Remove weight prefetch config (#11949)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
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
| 标识 | `additional_config["weight_prefetch_config"]["prefetch_ratio"]` |
| 类型 | `dict` |
| 默认表达式 | `{'attn': {'qkv': 1.0, 'o': 1.0}, 'moe': {'gate_up': 0.8}, 'mlp': {'gate_up': 1.0, 'down': 1.0}}` |
| 定义 | `vllm_ascend/ascend_config.py:709` [C20] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

- 来源 36：vllm-ascend@2c59ff10，vllm_ascend/ops/weight_prefetch.py，L26–L34。
- 来源 39、40 为两份固定量化清单；41、42 说明按层标记选择方法与 FLOAT 跳过；43 的动态 Linear 实现没有静态预取钩子。它们支持上文限定版本的 attn 路径结论，不代表 NPU 性能测量。
