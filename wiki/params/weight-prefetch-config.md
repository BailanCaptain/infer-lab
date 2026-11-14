---
id: weight-prefetch-config
title: weight_prefetch_config
type: param
summary: >-
  v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 vector
  计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上通常报错。GLM 双机默认没开；手动开启后 MoE
  路径取不到权重，两份固定量化目录均不进入静态 attn 预取；稀疏 MLA 仍有不读比例的独立预取。
aliases:
  - 权重预取配置
  - weight prefetch
  - enable_prefetch
chapters:
  - '19'
sources:
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L1-L5
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L25-L32
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/weight_prefetch.html
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L66-L69
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L704-L720'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L15'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L26-L34'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L46-L69'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L86'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L88-L104'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L134-L156'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L230-L238'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L145'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L509-L528'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L336-L338'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L81-L89'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/activation.py#L37-L43'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L235-L249'
  - >-
    vllm-ascend@baa023ad:docs/source/tutorials/features/suffix_speculative_decoding.md#L92-L95
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L52
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L62'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_executor/offloader/prefetch.py#L1-L22'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3-Dense.md#L541-L541'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2ed6cbba:docs/source/tutorials/models/Qwen3-Dense.md#L554-L554'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L685-L701'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L14-L67'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L202-L227'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1698-L2011'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L479-L502'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L284-L290'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/weight_prefetch.py#L1-L238'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L57-L217'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L709-L790'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L781'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L363-L371'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L137-L156'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1655-L1803'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L579'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L249-L314'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L355-L469'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1577-L1597'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1916-L1963'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2272-L2286'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1118-L1135
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2263-L2278'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1305-L1312'
  - 'vllm@0fc695fc:vllm/model_executor/models/utils.py#L632-L663'
  - 'vllm@0fc695fc:vllm/distributed/utils.py#L109-L154'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1650-L1666'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L252'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L74-L122
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L287
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L73-L73'
  - >-
    https://huggingface.co/Qwen/Qwen3-0.6B/blob/167b8104f88905a951069f5f95f9776908da5f68/config.json
  - >-
    raw:sha256-ba02d66e6627402c73c96eee60edcd5c70237363f540b371869fddb11c239baa.md#L1-L2188
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L265-L275'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json'
  - 'https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L364-L461'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L125'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L664-L706'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它只是 additional_config 里的一个子配置对象；main 上通常被 extra="forbid" 当未知键拒收的机制在那一页
  - to: ai-core
    kind: builds-on
    note: 权重预取建立在计算单元与数据搬运配合的基础上，通过提前把权重搬入 L2 并与向量计算重叠，减少矩阵计算等待数据的时间。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-03a47659756fa092cca4e20a1677217bd9da69cd038f5e54121938ea1c077bd9.md
  - >-
    raw/sha256-669825d31e19eba54d1ab853de8f72aca723f16b488158a6679255363551ffee.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-a9fbd653e30b9cb32884f1b9736b6b94b7af0068be46b7166ef6d02d533f0783.md
  - >-
    raw/sha256-ba02d66e6627402c73c96eee60edcd5c70237363f540b371869fddb11c239baa.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 未恢复这个旧权重预取配置：字段、运行时消费和工厂兼容名单中都没有它，普通 Ascend 进程会按未知顶层键拒收，Omni 环境只告警过滤。下文把 Linear 权重提前搬进 L2 的机制与 GLM 失败分析保留原 v0.23/db701c1f 范围；rc2 的 kernel/NZ warmup 和 KV cache prefetch 不能当成这个配置的等价替代。

`weight_prefetch_config` 是 v0.23.0 的 `--additional-config` 子配置：开了之后 vllm-ascend 在一条独立的 NPU stream 上，把下一个 linear 层的权重提前从 HBM 搬进 **L2 cache**，让这段搬运藏在当前正在跑的 vector 算子（quantize、MoE gating top_k、RMSNorm、SwiGLU）背后，压低 linear 计算时的 MTE 占用 [S1]。默认 `{}`，等于关闭；该碰它的是高吞吐场景，低延迟优先的场景上游直接说别开。

**存在范围**：它到 v0.23 维护分支为止能用，v0.24.0rc 起整套 `vllm_ascend/ops/weight_prefetch.py` 和配置字段已被删除，v0.26 分支（2026-09-17 的源码快照）与 main 开发主线上都没有这个键——引入与移除的 PR 见下面「版本谱系」。**两边删得不一样** [!]：v0.26 的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C31]；main 的顶层配置通常拒绝未知键，装有 vllm_omni 时 warning 后丢弃 [C23]。两者均不会启用本特性。比例子键单独见 [prefetch_ratio](prefetch-ratio.md)。

**放到 GLM 双机：关着的。** [官方双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)的启动命令里没有传 `additional_config`，而 `WeightPrefetchConfig.enabled` 默认就是 `False`——v0.23 维护分支和含 GLM 代码的那份快照都一样 [C33]，这条预取流水一次都不会起来。那条命令里另有一个带 prefetch 字样的开关 `--safetensors-load-strategy prefetch`，管的是启动时从磁盘预读 safetensors 文件，和本页的 HBM→L2 预取是两件事，细节在 [prefetch_ratio](prefetch-ratio.md)。要是在含 GLM 代码的那份快照上手动开起来，哪几项落得上、哪一道门槛会挡住它，见下面「开了的代价」末尾。

本页还留着一条**旧模型记录**（Qwen3-0.6B 稠密模型、单卡 bf16，不是 GLM 双机，也不是实测）：短 prefill 和 decode 可以通过 MLP 的行数门槛，但默认未开自定义行并行路径时，只有 down 有预取入口，gate_up 不会发。权重有多大与本次有没有发预取是两回事；完整判据见页末「源码位置」。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 字段本身 | `dict`，默认 `{}` | 已删除，未知键被静默忽略 | 已删除，通常被拒绝；装有 vllm_omni 时 warning 后丢弃 | 升级时从启动命令删除；main 的例外也不会重新启用预取 |
| `enabled` | `bool`，默认 `False` [C7] | — | — | 只写 `"weight_prefetch_config": {}` 等于没开；必须显式 `{"enabled": true}` |
| `prefetch_ratio` | 比例子键，五个权重各一个比例，见 [prefetch_ratio](prefetch-ratio.md) | — | — | 默认值的标定场景与比例解释统一见该页，不能保证换模型、换并发后仍最优 |
| 预取目的地 | L2 cache | — | — | Python 封装没有分配权重副本；总运行时开销仍需实测 [D] |
| 预取尺寸限制 | MLP 两路先把正的请求字节数截到 18 MiB | — | — | attn / moe 没有这道 Python 截断；零字节会在公共封装中改为整块，不能把 18 MiB 写成全路径硬上限；尺寸语义见 [prefetch_ratio](prefetch-ratio.md)，后端上限待核 |
| 两道方向相反的 token 门槛 | MoE：进 `select_experts` 的行数 ≥96；MLP：上下文中补齐后的 num_tokens <500，且层索引非空 | — | — | 门槛只是必要条件：MoE 还须取得权重；MLP gate_up 还须经过自定义行并行算子，down 则从激活算子进入 |
| `attn` 的 qkv/o 路径 | 静态 W8A8 的 apply，输入非 int8，且类名匹配 AscendQKVParallelLinear / AscendRowParallelLinear | — | — | 不看 token 门槛；按类名选比例，不按层的语义命名，o 也可能作用于 MLP down_proj |
| `mlp` / `moe` 互斥 | `mlp` 只在非 MoE 模型开，`moe` 只在 MoE 模型开 | — | — | 构造时两组比例都会读取和过滤，执行时至多启用其中一组的预取 |
| MLA / SFA 层预取 | 走到调用点后只看 enabled，不读 ratio、无 token 门槛；融合 QKV 整块，o_proj 最多请求 16 MiB、静态 W8A8 时跳过 | — | — | 普通 MLA 与稀疏 MLA 都有；融合 QKV 须存在且进入相应分支，SFA 无 attention metadata 时提前返回 |
| 越界或零 ratio | 范围外的值丢弃；过滤后整组全零或为空，该组关闭 | — | — | 组仍开启时，单项缺失或为零反而会请求整块；缺整个模块或给空 dict 会回填默认，详见 [prefetch_ratio](prefetch-ratio.md) |

## 为什么存在

Linear 层在昇腾上的瓶颈常常不在 Cube 而在 MTE（负责在片外内存与片上缓存之间搬数据的搬运单元；一个算子在卡里怎么分成搬入、矩阵、向量这几段执行，见[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)）——权重从 HBM 搬到片上的带宽没喂饱，Cube 就在等数据。官方文档把这件事说得很直白：linear 层的 MTE 利用率偏高，于是上游专门开了一条预取流水，与原有的 vector 计算流水并行跑，把权重提前搬到 L2，降低 linear 计算期间的 MTE 占用，间接提高 Cube 效率。

配置由 NPUModelRunner 初始化为进程内单例。按调用职责分，有四类受比例控制的插桩：静态 W8A8 的量化前后、MoE 选专家、attention 自定义行并行算子结束后取**本层 MLP** 的 gate_up，以及 SwiGLU 激活前取 down。前三类中的 attn 没有 token 门槛；MLP 和 MoE 各有门槛，还须满足下文的路径与取权重条件。普通 MLA 和 SFA 另有不读比例的两处调用。

预处理算子让预取流等待计算流，然后切换到一个惰性创建的 NPU stream 发请求；后处理让计算流等待预取流。MLA / SFA 的辅助函数虽然叫「in_current_stream」，实际也调用这个切流算子，不能据函数名说它在本流搬运；这两处没有紧接着调用同一对后处理。这里只描述源码提交预取请求的行为，缓存命中与收益需要设备实测。

gate_up 的起点还要求当前层前缀的倒数第二段为 self_attn。自定义行并行算子算完 attention 输出投影后，才按前缀中的层号去取同一层 MLP 的权重。此时 attention 已经算完，不能说提前量接近整个 attention；RMSNorm 的无 residual 分支只有预取**后处理**，既不发起 MoE 预取，也不推进层索引。这与[算子怎么落到 AI Core](../concepts/op-to-ai-core.md#版本差异)的钩子口径一致。

这个开关的血缘可以一直追到 `enable_prefetch` 与环境变量 `VLLM_ASCEND_ENABLE_PREFETCH_MLP`；v0.23.0 是它统一成 `weight_prefetch_config` 之后的形态 [I]。但同一份 v0.23.0 release notes 已经把 Weight prefetch 列进「Ready to Deprecate」[S24]，PR #11949 随后把它整体摘掉，v0.26.0rc1 的发布说明里记着这一笔 [S27]。**没有等价替代参数**——去向是直接下线，不是改名。

别认错门：main 上确实还有个 `vllm_ascend/model_executor/offloader/prefetch.py`，但它自己第一行就写明是「prefetch-based CPU offloading」，搬的是权重在 HBM 与主机内存之间的进出，和这里的 L2 预取不是一回事 [C29]。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由权重字节算出来的推导值，不是测出来的效果。钉住的提交上我们没有预取开与不开的时延、吞吐对照；GLM 双机主线里的那些数字是预取**关着**的那套部署的数字，不能拿来当这个开关的收益。

**先看它到底会不会被触发。** enabled 为真之后，还要依次检查模块开关、调用点、运行时条件与权重取得是否成功。MLP 要求非 MoE 模型、有效层索引和上下文行数小于 500；这个数由 runner 传入，可能已经过图尺寸补齐，不等于原始请求 token 总数。gate_up 还要求 attention 输出投影实际走自定义行并行算子；down 则要求走带钩子的 SwiGLU 激活。短 prefill、混合步和 decode 都可能通过，长 prefill 只是被挡在这两条 MLP 路径外，不能推断整个首 token 延迟不受预取影响。

MoE 的 96 比较的是选专家入口张量的行数。在固定 GLM 部署的默认调度分支里，这个张量来自 MoE prepare；该门槛通过后，还要有模型实例、正的层索引，并能取得对应专家的 w13_weight。GLM 主干恰恰在取权重这一步被挡住。打开多流 gate 等其他调度配置会改变选专家与 prepare 的顺序，不可照搬固定部署的行数结论。

**再看旧模型记录该怎样读。** Qwen3-0.6B 的单卡 bf16 记录只能说明 dense 模型的路径区别：只开本参数、其余相关开关默认关闭时，attention 输出投影没有自定义行并行算子，gate_up 没有预取调用；带钩子的 SwiGLU 仍会请求 down，静态 W8A8 的 attn 路径不会进入。FlashComm1 / SP 等配置可让输出投影选中自定义算子，但仍须逐项满足上述 MLP 判据，不能把「开 SP」当成所有模型都充分的条件。

**旧模型记录：每层权重有多大。** 这是 Qwen3-0.6B 稠密模型、单卡 TP1、bf16 的静态推导，非实测：模型有 28 层，hidden 为 1024，MLP 中间维度为 3072；Q 有 16 个头，K/V 各有 8 个头，每头 128 维。以下形状按权重存储的「输出维 × 输入维」写：gate_up 合并两路 3072 维，形状 [6144, 1024]；down 为 [1024, 3072]；qkv 合并 Q/K/V，输出维为 (16 + 8 + 8) × 128，形状 [4096, 1024]；o 将 16 × 128 维的 Q 头输出投影回 hidden，形状 [1024, 2048]。

```calc
title: 旧 Qwen3-0.6B 每层四块权重体积（单卡 bf16，每元素 2 B）
gate_up = 6144 × 1024 × 2 B = 12,582,912 B = 12 MiB
down = 1024 × 3072 × 2 B = 6,291,456 B = 6 MiB
qkv = 4096 × 1024 × 2 B = 8,388,608 B = 8 MiB
o = 1024 × 2048 × 2 B = 4,194,304 B = 4 MiB
```

只开本参数、使用默认比例且其余相关开关关闭时，满足上文 MLP 门槛并能取得权重的每层会请求 **down 的整块 6 MiB**（比例 1.0，低于 18 MiB 截断值）；gate_up 虽有 12 MiB，默认没有预取入口；qkv 的 8 MiB 和 o 的 4 MiB 则因 bf16 不走静态 W8A8 路径而不发预取。请求字节数不等于实际收益，设备搬运、缓存命中及性能仍须实测。换成 TP>1 时须按各矩阵的实际分片重新计算每卡体积，不能沿用本例的单卡数。

比例、零值与尺寸规则见 [prefetch_ratio](prefetch-ratio.md)。GLM 权重数字只取[每卡权重账](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)与[哪些矩阵是 8 位](../concepts/matmul-and-weights.md#双机前提与-w8a8哪些矩阵是-8-位)两处，不把它们算成预取流量。

**代价。** 官方把话说在前面：既然是拿 vector 计算来掩盖预取流水，预取就**会反过来影响计算**；优先低延迟而非高吞吐的场景，最好不要开 [S1]。低并发下预取往往没有收益，应该调小 ratio 或干脆关掉。判断方法也给了：抓 profiling，看预取（timeline 上表现为单条 stream 上的 CMO 操作）是否与并行的 vector 算子（如 SwiGlu）真的重叠、且不晚于该算子结束 [S2]。封装没有创建权重副本；新增的 stream、同步以及 L2 / 搬运带宽竞争仍是成本，不能把「没有权重副本」说成总开销为零。

**配置本身的三个坑。**

1. 子键是 `enabled` 不是 `enable`。main 上残留的 suffix speculative decoding 教程还写着 `{"enable":true}` [S25]，在 v0.23.0 上它会被 `.get("enabled", False)` 读成关闭、静默无效；main 已删掉整个配置项，按上述未知键规则处理。
2. `prefetch_ratio` 是**整体替换**而非逐键合并；`WeightPrefetchMethod` 对缺失或空的模块回填默认值 [C10]。因此只写 mlp 不会关闭 attn / moe；非空组里漏一项或单项写零，又会通过零尺寸转成整块请求，不能笼统称这种省略「安全」。
3. 官方旧文档称 MLP down 依赖 sequence parallel；钉住的 v0.23 源码里，down 的激活钩子不检查 SP。需要自定义行并行路径的是 gate_up，SP 只是选中该路径的一种方式。这里以源码为准。

**要是在含 GLM 代码的那份快照上手动开起来（按源码推演，未实跑）。** 部署前提是两台机器 16 张卡、TP8 / DP2 / EP16、权重 W8A8（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)；这套部署默认是关着的，见上面「一句话」）：

1. **MLP 两路关闭。** 模块开关按整个模型是否为 MoE 判断，GLM 前面的稠密层也不会启用 mlp 预取。这里是方法入口返回，不是权重太大，也不是模型没有这些层。
2. **MoE 路径取不到权重，token 门槛不足以使它发起。** 上下文先把层索引设为 None，只有传入对象具有 model.start_layer 才赋值；GLM 多模态外层挂的是 language_model，不能直接把外层等同于语言模型内部的 model。即使以直接暴露 model.start_layer 的语言模型对象分析，PP=1 时起点也是 0。GLM 的 mlp 预取模块关闭，不会通过 MLP down 的钩子递增索引；None 或 0 均过不了 MoE 的正索引要求。取不到权重时预处理清 active 并返回，既不发请求，也不执行该路径的后处理等待。MTP proposer 则未传 model_instance，在更早检查处返回；这个分支没有清 active，不能据“未发请求”额外推出它没有后处理等待。
3. **调度行数只能判断第一道门槛。** 固定部署未开 FlashComm1、shared-expert DP 与多流 gate，先 prepare 再选专家。MC2 容量 **128** 的来源只见[单请求 MoE 站](../concepts/one-request.md#moe-通信走-mc2-还是-allgather)；MC2 在补齐后按 TP 切 token 行，固定纯 decode 因而达不到 96。已有并发算例的 **52 → 64** 只见[两组最大值补齐](../concepts/concurrent-requests.md#再补到两组的最大值)，本页不重算切片。执行宽度超过 MC2 容量时，AllGather 把两组补到同宽再汇齐，能过 96；但它仍然取不到权重，不会发 MoE 预取。短 prefill 不必超过 MC2 容量，不能按「是否 prefill」替代宽度判据。
4. **两份固定量化目录都不进入 attn 比例路径。** GLM 语言主干的 KDA 使用分开的列并行投影，MLA 融合 QKV 使用合并列并行层，不匹配所需的 QKVParallelLinear 类。更直接的限制来自量化目录：9e55cbc8 与 3121f187 的权重只标 FLOAT 或 W8A8_DYNAMIC，均不派发到带预取钩子的静态 W8A8 方法，故 attn.o 也不发。旧目录的 MLA 输出投影为 FLOAT，新目录改为动态 W8A8；稠密 MLP down 两版均为动态 W8A8，视觉塔构造还明确传 quant_config=None。这里已能按固定清单判断，不需要再假设缺少量化文件；具体版本差别见[唯一权重账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。
5. **普通 MLA / SFA 两路独立于上述比例与层索引。** GLM 子类强制关闭两种融合前处理，进入 SFA native 分支；有 attention metadata 时，融合 QKV 权重会被整块请求预取，权重构成只见 [MLA](../concepts/mla.md#放到-glm-双机一个-token-走过一层稀疏-mla)。输出投影最多请求 16 MiB；两份固定目录都不是静态 W8A8，因此不触发这一路的静态方法跳过。换成其他量化目录时，若其包装方法属于静态 W8A8 则返回；这并不证明静态挂钩已经发过请求，后者仍受 attn 组开关和输入是否 int8 限制。普通 MLA 也有相同的两类调用，融合 QKV 入口另要求该投影存在且走 native 前处理；SFA 的 profile run 缺 metadata 时在两处调用之前返回。

这五条都是配置值与源码分支，分层说清「哪一项还有机会生效」而已；这套部署上预取的实际收益**没有实测数**。

**升级时删除旧键。** 固定 v0.26 的配置类忽略这个键，固定 main 与 rc2 通常拒收；装有 `vllm_omni` 时例外，会 warning 后过滤 [C28]。忽略或过滤均不会启用本特性，也不保证整条命令通过其他部署检查。

**要删的不止你自己的脚本。** 上游仓库里还留着过期示例：suffix speculative decoding 教程 [S25] 和 Qwen3 稠密模型教程 [S30] 都还写着 `weight_prefetch_config`，v0.26 分支上同一条命令也仍在。照抄也按上述未知键规则处理；图模式、算子融合等需分别评估，这个参数本身没有替代键。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（5 个文件） |
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
| 标识 | `additional_config["weight_prefetch_config"]` |
| 类型 | `unknown` |
| 默认表达式 | `{}` |
| 定义 | `vllm_ascend/ascend_config.py:52` [C26] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

### 版本差异

本页执行结论分别核对 v0.23 维护分支 2c59ff10 和 GLM 独立快照 db701c1f；两者的 weight_prefetch.py 完整内容相同，GLM 模型与调度结论只适用于后者。v0.26 的 2ed6cbba 与 main 的 baa023ad 已无该文件及配置字段。早期引入提交 ff375759 只有 attn 比例路径，不能用它解释后来的 MLP / MoE 门槛；移除提交 e77502ef 的父提交仍有完整旧实现。谱系中的「包含引入提交」只表示 Git 祖先关系。

### 源码位置

下表逐项对应事实表、运行条件与 GLM 五条结论。路径均相对 vllm_ascend/；未另注明时是 **db701c1f**。源码能确定的是是否走到提交预取请求的调用，设备上的搬运完成、缓存驻留和收益仍需实测。

| 页面结论 | 文件与行号 |
|---|---|
| 默认关闭；enable 拼错无效；比例整体替换 | ascend_config.py 52–53、685–701；维护分支 2c59ff10 同文件 704–720（来源 6、7、33） |
| 模块默认回填、过滤、全零关闭、MLP / MoE 互斥 | weight_prefetch.py 26–69（来源 9、10、39）。单项零或缺失经 79、103、169–184、235–238 变成全量请求，正值 MLP 才受该处 18 MiB 截断 |
| MLP 共用门槛与补齐后的行数 | weight_prefetch.py 134–156；worker/model_runner_v1.py 2265–2273；ascend_forward_context.py 136–157（来源 39、40、54） |
| gate_up 需要自定义行并行路径；默认单卡相关开关全关时没有入口 | ops/linear.py 363–371；ops/linear_op.py 153–158、709–790；维护分支对应选择函数为 700–781（来源 20、41–43）。SP 是其中一个选择条件，不是唯一方式 |
| gate_up 取本层、起点在 attention 输出计算之后 | ops/linear_op.py 153–158；weight_prefetch.py 158–175（来源 20、39）：层号取前缀第 3 段，倒数第 2 段须为 self_attn；模型还须具备代码访问的 layers/mlp/gate_up_proj 结构 |
| down 从激活进入、不查 SP；成功提交后递增索引 | ops/activation.py 37–55；weight_prefetch.py 177–200（来源 21、39）；要求当前 layers 索引可取到 mlp.down_proj，代码没有通用模型结构适配 |
| MoE 过 ≥96 后仍会因取不到权重退出 | weight_prefetch.py 88–131（来源 39）：需要模型实例、layer_idx >0，且索引减一对应层具有 mlp / moe / block_sparse_moe 下的 experts.w13_weight；98–101 明确在空权重时清 active 并返回 |
| GLM 没有可供 MoE 预取使用的正层索引；RMSNorm 不递增它 | ascend_forward_context.py 149–157；utils.py 1305–1312；多模态外层的 language_model 结构见来源 73。直接语言模型的 start_layer 见 models/glm5_next.py 2282–2286，并由 vllm@0fc695fc 的 models/utils.py 632–663 → distributed/utils.py 109–154 算得 PP=1 时为 0（来源 52、55–57）。weight_prefetch.py 65–69、134–139、186 的 MLP 推进在 GLM 关闭，layernorm.py 63–88 只有后处理（来源 39、40、44） |
| MTP 同样没有 MoE 预取请求 | spec_decode/llm_base_proposer.py 1118–1135 未传 model_instance；ascend_forward_context.py 67、149–157 将其保留为空；weight_prefetch.py 94–96 返回（来源 39、40、53） |
| 默认调度先 prepare 后选专家；96 看入口张量，不看 dispatch 后专家行数 | ops/fused_moe/fused_moe_0_23_0.py 479–502 → quantization/methods/w8a8_dynamic.py 262–287 → ops/fused_moe/experts_selector.py 71–74（来源 22、37、61） |
| MC2 容量和分片、AllGather 汇齐 | ascend_forward_context.py 97–101、202–217、240–252；ops/fused_moe/prepare_finalize.py 249–314、355–373、440–469（来源 40、48–49、59）。MC2 切片要求 replace_allreduce 与 enable_shared_expert_dp 都关闭；不能移植到所有调度变体 |
| attn 同时检查静态 W8A8、非 int8 输入及精确类名，无行数门槛 | quantization/methods/w8a8_static.py 74–122；weight_prefetch.py 50–56、71–86（来源 39、60）。GLM 的列并行与合并列并行投影见 models/glm5_next.py 1577–1597、1916–1963（来源 50–51），因此 qkv 比例没有匹配层 |
| 普通 MLA 与 SFA 的融合 QKV 入口不同；GLM 确定走 native | attention/mla_v1.py 1655–1659；attention/sfa_v1.py 1703–1761；attention/indexer_kpool_mla_v1.py 557–579（来源 36、46–47）。SFA 无 metadata 的提前返回在 1650–1666（来源 58） |
| MLA / SFA 的 o_proj 条件与独立尺寸 | attention/mla_v1.py 73、1795–1803；attention/sfa_v1.py 2004–2011；weight_prefetch.py 202–227（来源 35、36、46、62）。静态方法判据是 isinstance，不核输入 dtype，也不核 attn.enable |
| 预取流与同步边界；零字节不代表关闭 | ops/register_custom_ops.py 137–156；utils.py 509–528；weight_prefetch.py 230–238（来源 17、39、45）。MLA / SFA 也调用切流预处理；这里只提交请求，没有创建权重副本的代码 |
| 删除之后未知键的两种处理 | 2ed6cbba ascend_config.py 56–73；baa023ad 同文件 455、1660–1678（来源 23、28、31）。main 装有 vllm_omni 的例外会 warning 后丢弃，不能称无日志的静默忽略 |

旧模型记录的维度来自 [Qwen3-0.6B 官方配置](https://huggingface.co/Qwen/Qwen3-0.6B/blob/167b8104f88905a951069f5f95f9776908da5f68/config.json)（来源 63，commit 167b8104，config.json 第 9–19、25 行）；四块体积按形状与 bf16 每元素 2 B 推导。请求是否发出及其尺寸，对照上表的 MLP 门槛、gate_up/down 入口和静态 W8A8 条件。

比例与尺寸见 [prefetch_ratio](prefetch-ratio.md)。GLM 的 MoE 在计算请求字节数前即返回；18 MiB 的 Python 截断只在 MLP 正字节路径，MoE / attn 的后端上限仍待核。

来源 68、69 为两份固定量化清单；70、71 给出按层派发与 FLOAT 跳过；72 的动态 Linear 不含静态预取钩子；73 说明视觉塔构造禁用量化。这些证据支持上述目录与执行快照下的路径结论，换目录或代码后须重新核对。

**待核：缺什么。** MoE / attn 是否被后端统一截到 18 MiB，缺与部署镜像对应的底层实现或算子 trace；当前仓库 csrc 没有本调用所用 npu_prefetch 的实现。性能收益仍缺同负载开关对照。[官方 npu_prefetch 接口说明](https://www.hiascend.com/document/detail/zh/Pytorch/700/apiref/apilist/ptaoplist_001247.html)介绍 TorchNPU 7.0.0 / PyTorch 2.1 的 max_size、依赖及图模式约束，不能代替本镜像版本的后端证据。
