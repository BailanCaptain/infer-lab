---
id: prefetch-ratio
title: prefetch_ratio
type: param
summary: >-
  weight_prefetch_config 下的嵌套 dict，按 attn、moe、mlp 三组共五个权重分别指定「预取权重前百分之几」；仅在
  v0.23.0 维护分支可用，v0.24.0rc 起随整个 weight prefetch 特性一起删除，v0.26 静默忽略，v0.30.0 与 main
  通常拒收未知键（Omni 环境告警过滤），没有等价替代键。
aliases:
  - 权重预取比例
  - weight prefetch ratio
legacyAnchors:
  一句话: 这组比例控制什么，为什么 v0.24 起已删除？
  事实表: 这组比例控制什么，为什么 v0.24 起已删除？
  为什么存在: 比例怎样换算成预取字节数，哪些路径不归它管？
  开了的代价: 调参陷阱、版本清理与 GLM 双机推演
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1849-L1907'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1972-L2030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: weight-prefetch-config
    kind: builds-on
    note: 构造时会读取和过滤比例；执行预取还须父开关开启、对应组启用并满足调用条件，比例不能代替父开关
  - to: ascend-config-system
    kind: builds-on
    note: 这个键只是 additional_config 里的一段嵌套 dict，v0.30.0 与 main 上它被 extra="forbid" 拒收的机制在那一页
  - to: ai-core
    kind: builds-on
    note: 预取比例的收益与代价建立在计算、数据搬运及流水重叠的基础上；理解这些硬件执行环节，才能解释预取与向量计算争用资源为何可能降低性能。
contradicts: []
updated: 2026-11-19T00:00:00.000Z
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

## 这组比例控制什么，为什么 v0.24 起已删除？

提前把权重从 HBM 搬进 L2 cache 并非搬得越多越好：搬太少挡不住后面的矩阵乘等待，搬太多反而会挤占片上缓存与数据搬运通道（MTE），拖慢正在运行的向量算子。`prefetch_ratio` 曾作为 [weight_prefetch_config](weight-prefetch-config.md) 下的嵌套字典，按 `attn`、`moe`、`mlp` 三组共五个权重分别指定「只预取每块权重的前百分之几」（最终请求尺寸还受取整、分组开关和路径规则影响）。

**当前状态（`v0.30.0` `c09d3e20` 与 `main` `8d6180e2`）**：**`prefetch_ratio` 已随父配置 `weight_prefetch_config` 在 `v0.30.0` 与 `main` 中整体移除，且没有等价替代键**——它在 `v0.23.0` 发布说明中就已列入待废弃清单，自 `v0.24.0rc` 起随 PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) 彻底删除。升级后若旧命令里还留着它，`v0.30.0` 与 `main` 通常会按 `extra="forbid"` 拒收（装有 `vllm_omni` 时告警过滤；`v0.26.0rc` 的普通配置类逐键 `.get()` 静默忽略，但不代表整条启动命令一定通过），把子键移到顶层同样不会生效，其他 KV/pool 预取机制也不沿用这组比例。

在仍包含它的历史 **`v0.23.0`（`2c59ff10`）** 维护分支中，`prefetch_ratio` 的默认值为 `{"attn": {"qkv": 1.0, "o": 1.0}, "moe": {"gate_up": 0.8}, "mlp": {"gate_up": 1.0, "down": 1.0}}`。官方定性报告这套默认值在 `Qwen3-235B-A22B-W8A8`（`--max-num-seqs 144`）与 `Qwen3-32B-W8A8`（`--max-num-seqs 72`）两档并发上限下表现良好（`max-num-seqs` 只是并发上限，不代表运行时始终满载，也没有给出默认值的数学推导；调参前应先抓 profiling，不能因模型或并发相近就套用）。

| 配置规则 | `v0.23.0` 行为 | 说明 |
| --- | --- | --- |
| 覆盖方式与取值范围 | 只要传了 `prefetch_ratio` 就**整体替换**默认字典，不做逐键合并；有效范围 `0 <= r <= 1`，越界值静默丢弃 | 写 `1.2` 或 `-0.5` 不报错，被丢弃后等同于缺项 |
| 整组关闭与缺项/零值回填 | 过滤后整组剩余值全为 0 或为空时，该组 `enable` 置 `False`；组仍启用时，某项缺失或乘积取整为 0 会在公共包装中改写成**整块权重** | 传入空 dict 或漏写整组会先回填该组默认值；写 `0` 不是单项关闭开关 |
| 单次预取上限 | `mlp` 两项正字节请求在 Python 侧截断到 18 MiB；`attn` / `moe` 在 Python 侧不截断 | `mlp` 两个正比例若均满足 `ratio × 单卡字节 >= 18 MiB`，请求尺寸相同；后端是否另有上限待核 |
| `attn.qkv` / `attn.o` 生效条件 | 静态 W8A8 `apply`、输入非 int8，且层类名精确等于 `AscendQKVParallelLinear` / `AscendRowParallelLinear`（无 token 门槛） | 非静态 W8A8 模型改这两项无效；`o` 按类名匹配，可能覆盖 MLP `down_proj` |
| `moe.gate_up` 生效条件 | MoE 模型、入口行数 `>= 96`，且有模型实例、上下文层索引 `> 0` 并取到 `w13_weight` | `>= 96` 非充分条件：取不到权重时一次都不发 |
| `mlp.gate_up` / `mlp.down` 生效条件 | 稠密模型、层索引有效且 `num_tokens < 500`；`gate_up` 须走自定义行并行 `apply`，`down` 走带钩子 SwiGLU（不要求 SP） | MoE 与稠密模型互斥；相关开关全关的单卡 dense 默认无 `gate_up` 入口 |

## 比例怎样换算成预取字节数，哪些路径不归它管？

权重预取的整体触发机制见 [weight_prefetch_config](weight-prefetch-config.md)，本页的比例专门控制**提交的预取请求字节数**。请求偏小可能留下更多后续搬运，请求偏大则可能与并行 vector 计算争用 MTE 和 L2 带宽，快慢必须结合负载实测判断（硬件执行分工见[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)）。

换算流程先按 `int(ratio × 本地权重字节数)` 取整：若进入 `mlp` 两项且结果为正，Python 侧再截断到 18 MiB（`attn` / `moe` 无此 Python 截断）；若结果为 0 且所在组仍处于启用状态，公共包装 `maybe_npu_prefetch` 会把 `max_size <= 0` 改写成整块权重大小。因此比例与请求字节数并非在所有取值上都呈线性关系。

```wiki-diagram
file: prefetch-ratio
```

路由细节上，`attn` 组按层类名而非权重名匹配；`moe.gate_up` 针对的是融合 MoE 的 `w13_weight`（本卡全部局部专家合并后的 gate+up 权重栈，不是单个专家）。而 **MLA / SFA 两条独立预取路径并不归这五个比例管**：走到调用点后只看父开关 `enabled`，融合 QKV 直接请求整块，`o_proj` 在非静态 W8A8 时按自身固定上限（16 MiB）与权重体积取较小值（详见[机制页事实表](weight-prefetch-config.md#事实表)）。

至于默认值里 `moe.gate_up` 为何取 `0.8`，源码与官方文档均未给出推导（仅报告在指定 Qwen3 场景下表现良好）。仅凭调用位置无法比较选专家入口与 SwiGLU 的并行时间窗，也不能断言所有专家权重栈都比稠密矩阵大几个量级。另外，若后端底层同样按 18 MiB 截断，则本地 `w13_weight` 达到至少 22.5 MiB 时 `0.8` 与 `1.0` 会被截成同一尺寸；但在确认后端上限与标定部署的本地权重尺寸前，不能把两者直接当成等价。

## 调参陷阱、版本清理与 GLM 双机推演

本页数据均为配置值与按权重字节推导出的请求尺寸，不含同负载实测对照（GLM 双机主线的吞吐时延来自预取关闭态）。调参方向上：调大比例可能增加预取与 vector 计算对 MTE、L2 的争用（官方建议抓 profiling 确认独立流上的 CMO 操作落在对应 vector 算子窗口内且不晚于其结束，并对比完整执行时间，低延迟优先场景建议关闭）；调小比例可能减少资源竞争（低并发下建议调小或关闭，但不证明所有低并发场景都无收益）。

以 [weight_prefetch_config 页的 Qwen3-0.6B 单卡 bf16 记录](weight-prefetch-config.md#开了的代价)为例：只开父开关、其余默认关闭时，五项中只有 `mlp.down`（6 MiB）发起比例预取，正比例乘积大于 0 时按乘积取整提交、不触及 18 MiB 上限；若比例过小致取整为 0 且组仍启用，反而请求整块 6 MiB。

**三个容易踩空的配置写法**：
1. **非空组里漏写一项或写成 `0` 不能关闭该项**：例如传 `{"attn": {"qkv": 0.5}}` 时 `attn` 非空不会补默认，`o` 取 0 字节；传 `{"mlp": {"gate_up": 1.0, "down": 0}}` 时 `down` 也是 0 字节。只要全局开关开、同组过滤后仍有非零项、且路径实际进入预取调用，`maybe_npu_prefetch` 会把 `max_size <= 0` 改写成整块权重——写 `0` 不是单项关闭开关。
2. **整组全写 `0` 才能关闭该组**：过滤越界值后若剩余值全为 0 或集合为空，该组 `enable` 置 `False`（全局关闭优先）；注意输入本身是空 dict 或整组省略时会先回填默认，不要与「过滤后为空」混为一谈。
3. **越界值静默丢弃不报错**：`1.2`、`-0.5` 会被直接丢出字典（上游单测锁死此行为），随后按缺项规则处理（组仍启用且命中调用点时转为整块，整组过滤后无非零项时关闭该组）。

**放到 GLM 双机（`db701c1f` 固定基线：2×A2×8、TP8/DP2/EP16、W8A8）**：[官方双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)未传 `additional_config`（`enabled` 默认 `False`），构造对象虽会过滤比例但不会发起预取；命令中的 `--safetensors-load-strategy prefetch` 管磁盘预读 safetensors，与本页无关。若在 `db701c1f` 手动开启父开关，按源码推演这五个比例全部不会发起比例预取：
- `mlp.gate_up` / `mlp.down`：虽然[前 3 层稠密 MLP](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)在 TP8 下[每卡每层合计 18 MiB](../concepts/tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)（[拆成 gate_up 与 down 两块](../concepts/tensor-parallel.md#开销和什么时候别开)单块均小于 18 MiB），但 GLM 整体判定为 MoE 模型，MLP 组直接关闭。
- `moe.gate_up`：本卡 18 个局部专家的 `w13_weight` 属于[每卡每层 432 MiB 路由专家权重](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)中的 gate+up 部分，但 GLM 上下文默认层索引为 `None`（直接语言模型 PP=1 起点为 0），且 MLP 关闭不推进索引，MoE 取权重返回空并清 `active` 后退出（多模态外层与 MTP 退出路径见[机制页](weight-prefetch-config.md#开了的代价)），因此 token 数 `>= 96` 时写什么比例都一样不发。
- `attn.qkv` / `attn.o`：两份固定量化目录（`9e55cbc8` / `3121f187`）只有 `FLOAT` 与 `W8A8_DYNAMIC`，不派发静态 W8A8 方法（差别见[量化版本与权重账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)），因此均不进入静态预取钩子。只有 GLM 的 SFA native 路径仍有不读比例的融合 QKV 与 `o_proj` 独立预取（详见[机制页](weight-prefetch-config.md#开了的代价)）。

**过期命令提醒**：上游 `two_card` Qwen3 性能 e2e 用例与 Qwen3 稠密模型教程里仍残留 `"weight_prefetch_config":{"enabled":true}`，它们不代表功能仍在，升级到 `v0.30.0` / `main` 时应删除。

## 对照源码

下表汇总 `prefetch_ratio` 在四个基线版本的字段状态、截断与回填规则，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认 | `weight_prefetch_config.prefetch_ratio`（5 项比例 dict）[S15] | 已删除，`.get()` 静默忽略 [C24] | 已删除，通常拒收（`vllm_omni` 告警过滤）[C44] | 同 `v0.30.0` [C45] | 无等价替代键，升级须删除 [!] |
| 过滤、回填与截断 | `ModuleWeightPrefetchConfig.__post_init__` 过滤越界；`mlp` 正字节截 18 MiB；非正值在 `maybe_npu_prefetch` 转整块 [C6][C7] | — | — | — | 漏项或写 `0` 在启用组内反成整块请求 [D] |
| 废弃记录与残留示例 | 发版列入 Ready to Deprecate [S18] | PR #11949 已删 [S21]；e2e 用例仍有残留 | 需避免照抄过期示例 | 同左 | 教程/用例残留不证明功能恢复 |

- **比例解析、过滤与公共包装（`2c59ff10`）**：配置读取与默认替换见 `ascend_config.py#L52-L53, #L704-L720`（来源 1–2、20）；`ModuleWeightPrefetchConfig` 越界过滤与组启用判断见 `weight_prefetch.py#L13-L34`（来源 3、36），空组回填与模型互斥见 `#L46-L69`（来源 4），各路径字节计算与 `mlp` 18 MiB 截断见 `#L71-L104, #L158-L186`（来源 5–6），`maybe_npu_prefetch` 将非正字节转整块见 `#L230-L238` 与 `register_custom_ops.py#L126-L131`（来源 7–8）；越界丢弃单测见 `test_weight_prefetch.py#L45-L52`（来源 13）；官方文档见 `weight_prefetch.md#L11-L32` 与 `additional_config.md#L117-L122`（来源 14–15）[S14]。
- **各调用点与 GLM 双机推演**：`attn` 静态 W8A8 钩子见 `w8a8_static.py`（来源 9、32），`moe` 选专家与取权重退出见 `experts_selector.py`、`weight_prefetch.py#L98-L131`、`ascend_forward_context.py`、`glm5_next.py` 与 `vllm@0fc695fc`（来源 10、30–31、33–34）[C33]；`mlp` 激活与自定义行并行钩子见 `activation.py`、`linear_op.py`（来源 11–12、28–29）；GLM 启动命令（含 `--safetensors-load-strategy prefetch`）与两份量化目录及派发见来源 26–27、39–43[S27][D]。
- **移除与未知键处理**：`v0.26` 见 `2ed6cbba:ascend_config.py#L56-L73`（来源 24–25）；`v0.30.0` 与 `main` 见 `c09d3e20:ascend_config.py#L1849-L1907` 与 `8d6180e2:ascend_config.py#L1972-L2030`（来源 44–45，历史 `baa023ad`/`7d825229` 见来源 16–19、21–23、37–38）。
- **待核**：`attn` / `moe` 在后端底层是否同样按 18 MiB 截断，以及标定部署本地权重尺寸与同负载开关性能实测对照，均待实机核验。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `WeightPrefetchConfig.prefetch_ratio` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `8d6180e2` |
| releases/v0.23.0 | 有 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |

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
