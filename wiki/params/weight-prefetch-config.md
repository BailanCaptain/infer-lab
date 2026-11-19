---
id: weight-prefetch-config
title: weight_prefetch_config
type: param
summary: >-
  v0.23.0 的权重预取子配置，在独立流上把 linear 权重提前从 HBM 搬进 L2 cache 与 vector 计算重叠；v0.24.0rc
  起已删除，v0.26 忽略，v0.30.0 与 main 通常拒收（Omni 告警过滤）。
aliases:
  - 权重预取配置
  - weight prefetch
  - enable_prefetch
legacyAnchors:
  一句话: 它曾做什么，为什么 v0.24 起已删除？
  事实表: 它曾做什么，为什么 v0.24 起已删除？
  为什么存在: 四类比例钩子、MLA 独立预取与切流同步
  开了的代价: 触发门槛、代价与 GLM 双机逐项推演
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1849-L1907'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1972-L2030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它只是 additional_config 里的一个子配置对象；v0.30.0 与 main 上通常被 extra="forbid" 当未知键拒收的机制在那一页
  - to: ai-core
    kind: builds-on
    note: 权重预取建立在计算单元与数据搬运配合的基础上，通过提前把权重搬入 L2 并与向量计算重叠，减少矩阵计算等待数据的时间。
contradicts: []
updated: 2026-11-19T00:00:00.000Z
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

## 它曾做什么，为什么 v0.24 起已删除？

`weight_prefetch_config` 是 `v0.23.0` 中的 `--additional-config` 子配置（默认 `{}`，即关闭；必须显式写 `{"enabled": true}` 才启用）。开启后，vLLM-Ascend 在一条独立的 NPU stream 上，把下一个 linear 层的权重提前从 HBM 搬进 **L2 cache**，让这段搬运藏在当前正在执行的 vector 算子（quantize、MoE gating `top_k`、RMSNorm、SwiGLU）背后，以降低 linear 计算期间的 MTE 占用、间接提高 Cube 效率（计算与数据搬运分工见[算子怎么落到 AI Core](../concepts/op-to-ai-core.md)）。它面向高吞吐场景，低延迟优先的场景上游明确建议不要开启；子键比例规则见 [prefetch_ratio](prefetch-ratio.md)。

**历史血缘与下线现状**：该配置由早期的 `enable_prefetch` 与环境变量 `VLLM_ASCEND_ENABLE_PREFETCH_MLP` 统一而来，在 `v0.23.0` 发版时即被列入「Ready to Deprecate」，自 `v0.24.0rc` 起随 PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) 整套删除（含 `vllm_ascend/ops/weight_prefetch.py` 与配置字段），**没有等价替代参数**。升级时须从启动命令中删掉该键——同时注意不要把它与三类同名或近名特性混淆：
- `vllm_ascend/model_executor/offloader/prefetch.py`（`main` 上仍存在）做的是基于预取的 CPU offloading（HBM 与主机内存之间的权重搬运），不是本页的 HBM→L2 预取；
- 启动参数 `--safetensors-load-strategy prefetch` 管的是启动时从磁盘预读 safetensors 文件，与本页无关；
- `v0.30.0` / `main` 中的 kernel/NZ warmup 或 KV cache prefetch 也不是这个配置的等价替代。

| 核心维度 | `v0.23.0` 行为 | 说明 |
| --- | --- | --- |
| 字段与默认 | `dict`，默认 `{}`；`enabled` 默认 `False` | 只写 `"weight_prefetch_config": {}` 等于关闭；子键 `prefetch_ratio` 规则见 [prefetch_ratio](prefetch-ratio.md) |
| 预取目标与尺寸限制 | 目标为 L2 cache；Python 封装无权重副本；MLP 正字节请求在 Python 侧截断到 18 MiB | `attn` / `moe` 无此 Python 截断；零字节在公共封装中转为整块请求，后端是否统一截断仍待核 |
| 方向相反的 token 门槛 | MoE：`select_experts` 入口行数 `>= 96`；MLP：补齐后的 `num_tokens < 500` 且层索引非空 | 门槛仅是必要条件：MoE 还须取到权重，MLP `gate_up` 还须走自定义行并行算子，`down` 从激活算子进入 |
| `attn` 路径与 `mlp`/`moe` 互斥 | `attn` 仅在静态 W8A8 `apply`、输入非 int8 且类名精确匹配 `AscendQKVParallelLinear` / `AscendRowParallelLinear` 时触发；`mlp` 与 `moe` 依模型是否 MoE 互斥 | `attn` 不看 token 门槛且按类名而非层语义路由（`o` 可能覆盖 MLP `down_proj`）；构造时两组比例都过滤，执行时至多开一组 |
| MLA / SFA 独立预取 | 到达调用点只看 `enabled`，不读 `prefetch_ratio`、无 token 门槛；融合 QKV 整块预取，`o_proj` 最多请求 16 MiB（静态 W8A8 时跳过） | 普通 MLA 与稀疏 MLA 均有；SFA 缺 attention metadata 时提前返回 |
| 越界或零 ratio | 越界值静默丢弃；过滤后整组全零或为空则关闭该组 | 组仍开启时单项缺失或为零会回填为整块请求；缺整个模块或给空 dict 则回填默认值（详见 [prefetch_ratio](prefetch-ratio.md)） |

## 四类比例钩子、MLA 独立预取与切流同步

配置由 `NPUModelRunner` 初始化为进程内单例。受比例控制的插桩共分四类：静态 W8A8 量化前后（`attn.qkv` / `attn.o`）、MoE 选专家（`moe.gate_up`）、attention 自定义行并行算子结束后预取**本层 MLP** 的 `gate_up`，以及 SwiGLU 激活前预取 `down`；此外普通 MLA 与 SFA 各有不读比例的融合 QKV 与 `o_proj` 两处调用。

切流与同步由预处理、后处理一对算子完成：预处理先让预取流等待计算流，再切到惰性创建的独立 NPU stream 提交请求；后处理让计算流等待预取流。注意 MLA / SFA 里的辅助函数虽然名字带有 `in_current_stream`，实际调用的仍是这个切流算子，且这两处没有紧接着调用同一对后处理，不能按函数名误判为在本流搬运。

几处容易误解的钩子边界：
- **`gate_up` 的触发点在 attention 之后**：它要求当前层前缀的倒数第二段为 `self_attn`，在自定义行并行算子算完 attention 输出投影后，才按前缀中的层号取同一层 MLP 的 `gate_up_proj`——此时 attention 已结束，不能说提前量覆盖整个 attention。
- **RMSNorm 无 residual 分支只有后处理**：它既不发起 MoE 预取，也不递增层索引（与[算子怎么落到 AI Core](../concepts/op-to-ai-core.md#版本差异)的钩子口径一致）。
- **配置本身有三个常见坑**：① 子键名是 `enabled` 而非 `enable`——残留的 suffix speculative decoding 教程里仍写着 `{"enable":true}`，在 `v0.23.0` 会被 `.get("enabled", False)` 读成关闭；② `prefetch_ratio` 是整体替换而非逐键合并，缺失或空模块回填默认，而非空组内漏项或写零会经零尺寸转成整块请求，不能笼统当成安全省略；③ 旧文档曾称 MLP `down` 依赖 sequence parallel，但 `v0.23` 源码里 `down` 的激活钩子不查 SP，真正需要自定义行并行路径的是 `gate_up`（SP 只是选中自定义行并行路径的一种方式）。

## 触发门槛、代价与 GLM 双机逐项推演

**代价与验证方法（均无本仓实测对照）**：用 vector 计算掩盖预取流水会反过来与计算争用 MTE 与 L2 带宽，因此低延迟优先或低并发场景建议调小 ratio 或关闭；封装虽不创建权重副本，但新增 stream、同步与缓存竞争仍是真实成本。官方建议通过 profiling 检查独立 stream 上的 CMO 操作是否落在并行 vector 算子（如 SwiGLU）窗口内且不晚于其结束，再对比端到端执行时间。

**触发门槛与旧 Qwen3-0.6B 单卡静态记录**：开启 `enabled` 后，MLP 要求非 MoE 模型、有效层索引与上下文行数 `< 500`（该行数由 runner 传入，可能经过图尺寸补齐而非原始请求 token 总数），因此短 prefill、混批和 decode 都可能通过，长 prefill 仅被挡在 MLP 两路外；MoE 要求选专家入口行数 `>= 96`、存在模型实例、正层索引且取到 `w13_weight`（开启多流 gate 等配置会改变选专家与 prepare 顺序，不可照搬固定调度行数）。

以旧稠密模型 Qwen3-0.6B（28 层、单卡 TP1、bf16 每元素 2 B，hidden=1024、MLP 中间维 3072、Q 16 头、K/V 各 8 头、每头 128 维，按「输出维 × 输入维」计算 $\text{字节数} = \text{out} \times \text{in} \times 2\,\text{B}$）为例：

| 权重块 | 矩阵形状（输出 × 输入） | 单卡体积（bf16） | 仅开本参数且其余默认关闭时是否触发 |
| --- | --- | --- | --- |
| `gate_up` | `[6144, 1024]` | 12,582,912 B（12 MiB） | 不触发：默认未走自定义行并行算子（开 FlashComm1 / SP 等可进入，仍须满足全部 MLP 判据） |
| `down` | `[1024, 3072]` | 6,291,456 B（6 MiB） | 满足门槛时请求整块 6 MiB（默认比例 1.0，低于 18 MiB 截断） |
| `qkv` | `[4096, 1024]` | 8,388,608 B（8 MiB） | 不触发：bf16 不走静态 W8A8 路径 |
| `o` | `[1024, 2048]` | 4,194,304 B（4 MiB） | 不触发：bf16 不走静态 W8A8 路径 |

请求字节数不等于实际搬运收益，换成 TP > 1 须按分片重算；GLM 权重数字统一取[每卡权重账](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)与[哪些矩阵是 8 位](../concepts/matmul-and-weights.md#双机前提与-w8a8哪些矩阵是-8-位)，不重算也不当预取流量。

**放到 GLM 双机（`db701c1f` 固定基线：2×A2×8、TP8/DP2/EP16、W8A8）**：[官方双机部署](../concepts/glm-5-3-flash-two-node.md#部署前提)未传 `additional_config`，预取默认关闭（主线吞吐时延数字均为关闭态）。若在 `db701c1f` 手动开启，按源码逐项推演（未实跑）：
1. **MLP 两路关闭**：模块开关按整体是否 MoE 判定，GLM 前几层稠密 MLP 同样不启用。
2. **MoE 路径取不到权重**：上下文默认层索引为 `None`，仅当传入对象具备 `model.start_layer` 时才赋值（GLM 多模态外层挂 `language_model`，即使按语言模型对象看 PP=1 起点也是 0）；MLP 关闭导致 `down` 钩子不递增索引，`None` 或 0 过不了正索引要求，预处理清 `active` 后退出且不做后处理等待。MTP proposer 未传 `model_instance`，在更早检查返回且未清 `active`（不能据「未发请求」外推其无后处理等待）。
3. **调度行数仅判第一道门槛**：固定部署先 prepare 再选专家，MC2 容量 128 见[单请求 MoE 站](../concepts/one-request.md#moe-通信走-mc2-还是-allgather)，MC2 补齐后按 TP 切片使固定纯 decode 达不到 96（并发算例 52 → 64 见[两组最大值补齐](../concepts/concurrent-requests.md#再补到两组的最大值)）；超容量转 AllGather 能过 96，但仍因第 2 条取不到权重而不发请求，短 prefill 也不必超 MC2 容量。
4. **两份固定量化目录（`9e55cbc8` / `3121f187`）均不进入 `attn` 比例路径**：GLM 的 KDA 与 MLA 融合 QKV 不匹配 `AscendQKVParallelLinear`；两份目录权重只标 `FLOAT` 或 `W8A8_DYNAMIC`（旧目录 MLA 输出为 `FLOAT`、新目录改为动态 W8A8，稠密 MLP `down` 均为动态 W8A8，视觉塔 `quant_config=None`，详见[唯一权重账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)），不派发静态 W8A8，故 `attn.o` 也不发。
5. **MLA / SFA 独立预取仍可触发**：GLM 子类关闭两种融合前处理、走 SFA native 分支；存在 attention metadata 时融合 QKV 会整块请求预取（构成见 [MLA](../concepts/mla.md#放到-glm-双机一个-token-走过一层稀疏-mla)），输出投影最多请求 16 MiB 且两份目录均非静态 W8A8 故不跳过（换静态 W8A8 目录会跳过此路，但不代表静态挂钩已发请求）；profile run 缺 metadata 时在两处之前返回。

**升级清理提醒**：`v0.26.0rc` 静默忽略旧键，`v0.30.0` 与 `main` 通常拒收（装 `vllm_omni` 时告警过滤），均不启用旧功能；上游仓库残留的 suffix speculative decoding 教程与 Qwen3 稠密模型教程仍含 `weight_prefetch_config`，照抄同样受未知键规则处理。

## 对照源码

下表汇总 `weight_prefetch_config` 在四个基线版本的存在状态与下线处理，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段存在与默认 | `dict = {}`，`enabled = False` [C7] | 已删除，`.get()` 静默忽略 [C31] | 已删除，通常拒收（`vllm_omni` 告警过滤）[C74] | 同 `v0.30.0` [C75] | 升级必须删键，无等价替代参数 [!] |
| 权重预取模块 | `ops/weight_prefetch.py` 完整实现 [C10] | PR #11949 已删 [S27] | 已删 | 已删 | `main` 上的 `offloader/prefetch.py` 是 HBM↔CPU 卸载，非本特性 [C29] |
| 废弃与文档残留 | 发版列入 Ready to Deprecate [S24] | 教程仍残余旧命令 | 需避免照抄过期教程 [S25] | 同左 | 文档残留不代表功能恢复 |

- **机制、配置与比例链路（`2c59ff10` 与 `db701c1f` 两份 `weight_prefetch.py` 逐字一致）**：官方文档见 `weight_prefetch.md#L1-L5, #L25-L32`（来源 1–3）[S1][S2]、`additional_config.md#L66-L69, #L117-L122`（来源 4–5）；配置解析与默认回填见 `ascend_config.py`（来源 6–7、26、33）与 `weight_prefetch.py#L1-L238`（来源 8–15、34–35、39）；切流与同步见 `register_custom_ops.py` 与 `utils.py`（来源 16–17、45）[D]。早期引入提交 `ff375759` 仅含 attn 比例路径，不能外推后来的 MLP/MoE 门槛（血缘溯源见来源 4–7）[I]。
- **四类钩子与 GLM 五条推演锚点（未另注均属 `db701c1f`）**：MLP 门槛与补齐行数见 `model_runner_v1.py`、`ascend_forward_context.py`（来源 18、40、54）；`gate_up` 自定义行并行与 `down` 激活钩子见 `linear.py`、`linear_op.py`、`activation.py`（来源 20–21、41–43）；MoE 索引起点、RMSNorm 后处理与 MTP 见 `layernorm.py`、`glm5_next.py`、`glm5_next_multimodal.py`、`llm_base_proposer.py`、`utils.py` 及 `vllm@0fc695fc`（来源 44、52–57、73）；调度先 prepare 后选专家与 MC2/AllGather 见 `fused_moe_0_23_0.py`、`w8a8_dynamic.py`、`experts_selector.py`、`prepare_finalize.py`（来源 22、37、48–49、59、61）；两份固定量化目录及静态/动态派发见来源 60、68–72；MLA / SFA 独立预取见 `mla_v1.py`、`sfa_v1.py`、`indexer_kpool_mla_v1.py`（来源 36、46–47、58、62）；Qwen3-0.6B 维度来自 HF `config.json`（来源 63）。
- **未知键处理与过期教程**：`v0.26` 见来源 31–32，`v0.30.0` 与 `main` 见来源 74–75（历史 `baa023ad`/`7d825229` 见来源 23–25、27–30、65–67）。
- **待核**：MoE / attn 是否在底层被统一截断到 18 MiB（当前 `csrc` 无所用 `npu_prefetch` 实现；[TorchNPU 7.0.0 `npu_prefetch` 文档](https://www.hiascend.com/document/detail/zh/Pytorch/700/apiref/apilist/ptaoplist_001247.html)不代表部署镜像版本后端证据），以及同负载开关性能实测对照，均待实机核验。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（5 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2025-10-09 · ff3757593614964f7ab91dab3da0c4aee568bec8 · PR [#3146](https://github.com/vllm-project/vllm-ascend/pull/3146) —— [1/N][Feat] Add weight prefetch feature for Attention layers (#3146)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev、origin/zxy_fix_boradash
  - `vllm_ascend/utils.py` +10 / −14（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/torchair_mla.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +5 / −4（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +11 / −2（文本行变化）
- **移除**：2026-07-16 · e77502ef715f612f2cc6f3c833174431f26cb765 · PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) —— [Refactor] Remove weight prefetch config (#11949)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
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
