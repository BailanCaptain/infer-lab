---
id: combine-quant-mode-2a3f7cd47997
legacyAnchors:
  一句话: 它覆盖哪一步通信量化，为什么 0 不等于关闭量化？
  为什么存在: 为什么只管 combine 不管 dispatch，和融合 MC2 是什么关系？
  开了的代价: 白名单校验与硬件支持范围
  白名单校验硬件支持范围与-glm-双机载荷算例: 专家结果回传的模式与载荷怎样核对
title: combine_quant_mode
type: param
summary: >-
  MoE MC2 combine 阶段通信量化覆盖开关：仅认整数 0/2/3/4，默认 0 让位给模型显式 comm_quant_mode，模型未提供时仅
  W8A8MXFP 默认选 4。v0.30.0 与 main 可用，受硬件与非融合 MC2 路径约束。
origin: seed
aliases:
  - MC2 combine 通信量化
  - combine 阶段通信量化模式
  - 强制 combine 量化模式
  - additional_config.combine_quant_mode
  - comm_quant_mode
chapters:
  - '14'
  - '17'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: expert-parallel
    kind: builds-on
    note: >-
      它改的是 MC2 那对 dispatch / combine 算子里 combine 那一半的通信量化位，而 MC2 正是 EP 收发 token
      的通道
  - to: quantization
    kind: builds-on
    note: 默认值 0 的含义是「跟着模型权重声明的 quant_type 走」，要判断覆盖掉了什么，先得知道 quant_type 从哪来
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 main 上 pydantic AscendConfig 的顶层 Literal 字段，v0.23 / v0.26 那套逐键 .get()
      根本不认识这个名字
  - to: collective-communication
    kind: builds-on
    note: 该参数调整 MC2 combine 的通信量化，理解其作用需要先区分 MC2 的派发、返回与普通集合操作。
  - to: moe
    kind: builds-on
    note: 该参数建立在 MoE 的路由专家计算与结果加权合并机制上，控制 MC2 路径中专家结果收回阶段的通信量化。
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L474'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L474
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L274-L287'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L162-L173'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L327-L333'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L215-L232'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L350-L524'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L471-L474'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L435'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L83
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L1632-L1663'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1697'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L359'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L351'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L486
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L501
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L582
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L591
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L587
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L588
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L590
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L591
  - >-
    raw:sha256-331f09bdb42c45cbce3db4b5de7bf2986ed113bd4e7c63a577c6a899adc736af.md#L1-L270
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L595
  - >-
    raw:sha256-aab18758a1e52d9d50ba1357f21458e6b27a4e8ed0a8d8403d62cb9ef855d85a.md#L1-L274
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ops/fused_moe/token_dispatcher.py#L271-L287
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L593
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L588-L591'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/token_dispatcher.py#L265-L287'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L591
  - >-
    https://github.com/Ascend/op-plugin/blob/aed3889c79923863fc9bfb36105cd6f577508cde/docs/zh/custom_APIs/torch_npu/torch_npu-npu_moe_distribute_combine_v2.md#L257-L279
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1689-L1708'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L118-L168'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L150-L170'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L265-L339'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L596
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L588
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L584-L590'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/token_dispatcher.py#L271-L296'
  - >-
    vllm-ascend@c09d3e20:docs/source/user_guide/configuration/additional_config.md#L69-L73
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L676-L682'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/token_dispatcher.py#L294-L314'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1895-L1910'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-331f09bdb42c45cbce3db4b5de7bf2986ed113bd4e7c63a577c6a899adc736af.md
  - >-
    raw/sha256-3aeecff5a0621aa0037d9185cccbb5f2e89f9301f66f9d573c6ed67e7ff33a71.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-bfacc19702472408b9807eb9cbb7828d3e09d484fa40fe4128d3fa847cc446fa.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ca9a84111a41a3b9f040cdb3251cd2b13e2c00cf22725addb31dac226c9bc3b0.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 它覆盖哪一步通信量化，为什么 0 不等于关闭量化？

`combine_quant_mode` 只改 [MoE](../concepts/moe.md) 专家算完后跨卡回传结果那一步（**MC2 combine**）的通信精度，既不改专家权重本身的量化方式，也不改前一步把 token 发往专家的 dispatch 精度。

它是 `--additional-config` 顶层的整数调优字段（`v0.30.0` 与 `main` 可用，默认 `0`）。在多卡 [EP（专家并行）](../concepts/expert-parallel.md) 的非融合 MC2 路径下，设为**非零值**会把 `torch_npu.npu_moe_distribute_combine_v2` 的 `comm_quant_mode` 实参强制覆盖为 `int8`（`2`）或 `MXFP`（`3` / `4`），用来压缩全对全（all-to-all）回传带宽；常规部署保持默认 `0` 即可，切勿在未核对后文硬件白名单前盲目填非零值。下面是以 `Qwen/Qwen3-30B-A3B` 在非融合 MC2 路径下开启 `int8` 回传量化的**配置形式示例**（实际运行仍须满足对应芯片驱动与 HCCL 条件，本工作区无 NPU 实机执行验证）：

```bash
vllm serve Qwen/Qwen3-30B-A3B \
  --tensor-parallel-size 4 \
  --enable-expert-parallel \
  --additional-config '{"enable_fused_mc2": 0, "combine_quant_mode": 2}'
```

**注意：设为默认 `0` 表示「不人工干预」，不等于强制关闭通信量化。** combine 侧按四级优先级由高到低决定最终 `quant_mode`：

1. 用户显式配置的非零 `combine_quant_mode`（第一顺位，优先级高于后续所有默认项，有上游单测锁死）；
2. 模型量化方法传来的 `combine_metadata.quant.comm_quant_mode`（只要不是 `None` 就采用，包括显式的 `0`）；
3. 未提供上述值且 `quant_type == QuantType.W8A8MXFP`（微缩放 8 位浮点量化）时，自动选用模式 `4`；
4. 其余情况回退到 `0`（仅表示通信不额外量化，不代表所有模型的专家输出一定是 BF16）。

```python
combine_quant_mode = get_ascend_config().combine_quant_mode
if combine_quant_mode:
    quant_mode = combine_quant_mode
elif comm_quant_mode is not None:
    quant_mode = comm_quant_mode
elif quant_type == QuantType.W8A8MXFP:
    quant_mode = 4
else:
    quant_mode = 0
```

这里 `if combine_quant_mode:` 用真值判断，`0` 既作默认值、也作关闭人工覆盖的开关，不需要额外 `enable_` 字段。消费者每次调用都会读取当前配置单例（配置工厂可在 `refresh` 时重建并发布新单例，既不能视为进程终生不可变的常量，也未提供在线请求逐次切换的接口）。

**版本存在范围**：该键由 PR #15441（2026-09-07）引入，`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）完整保留（`Literal[0, 2, 3, 4] = 0`）。`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 的代码和文档均无此键，旧配置类按名逐键 `.get()`，写入既不报错也不生效。升级到 `v0.30.0` / `main` 后该键才会真正改变算子实参，且拼写错误会被严格校验拒收（仅当环境可发现 `vllm_omni` 时才会告警并过滤未知顶层键，不等于旧键开始生效）。

## 事实表

调整 `combine_quant_mode` 前，先逐项核对下表中的白名单、生效路径与硬件边界：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与合法值 | `additional_config["combine_quant_mode"]`，`Literal[0, 2, 3, 4] = 0` | 仅认不带引号的整数 `0 / 2 / 3 / 4`；传 `1` 或字符串 `"4"` 会在启动期抛 `ValueError` |
| 默认 `0` 的真实语义 | 让位给显式 `comm_quant_mode`；仅当其为 `None` 时，`W8A8MXFP` 默认选 `4`、其余选 `0` | 非 MXFP 模型仍可显式传非零模式，MXFP 模型也可显式传 `0` 关闭回传量化 |
| 生效路径范围 | 仅非融合 `MC2CommImpl` 的 `token_combine` 读取 | 选中融合 MC2（`FusedMC2CommImpl` / MegaMoe）或 AllGather 时本键完全不参与执行；dispatch 方向也从不读它 |
| 硬件与拓扑约束 | `2`（`int8`）支持 A2（需 `hierarchy` 等条件）/ A3（`tp_world_size != 2`）/ 950DT；`3`/`4`（MXFP）仅列 950DT | 配置校验通过不代表当前芯片支持；在 A2 上填 `4` 会过 pydantic 校验但受底层算子硬件限制 |
| 精度与速度取舍 | 缩窄专家输出跨卡回传位宽，引入量化舍入误差 | 开启非零档位做吞吐优化时，必须同步跑业务集验证数值精度是否退化 |
| 版本可用性 | `v0.30.0`、`v0.30.0rc2`、`main` 支持；`v0.23.0`、`v0.26.0rc` 无 | 旧分支逐键 `.get()` 静默忽略，升级到 `v0.30.0` 后遗留配置才会突然开始改变算子行为 |

## 为什么只管 combine 不管 dispatch，和融合 MC2 是什么关系？

MC2 是昇腾上 EP 专家并行的成对收发算子。`npu_moe_distribute_dispatch_v2` 先按路由结果把 token 发给持有对应专家的卡；专家算完后，再由 `npu_moe_distribute_combine_v2` 按路由权重收回并合并结果。两次跨卡通信各自带有独立的 `comm_quant_mode` 参数。

```wiki-diagram
file: param-combine-quant-mode
```

排查本键是否真正生效时，需要分开核对两条边界：

- **只覆盖 combine，不改动 dispatch**：在 `TokenDispatcherWithMC2` 里，dispatch 方向的 `quant_mode` 由另一段独立的分支根据 `dispatch_with_quant`、芯片型号与 MXFP 条件决定（如选 `2` 或 `4`），完全不读取 `combine_quant_mode`。PR #15441 单独开放 combine 覆盖，是为了让非 MXFP 模型在不改动权重量化的前提下也能指定回传量化模式，构造「发出与收回采用不同位宽」的不对称配置做性能或精度对比。
- **走融合 MC2 路径时自动绕过本键**：只有非融合 `MC2CommImpl`（经公共 `fused_experts` 调用 `token_combine`）才会读取 `combine_quant_mode`。一旦进入 `FusedMC2CommImpl`，代码直接调用 `torch.ops._C_ascend.dispatch_ffn_combine` 或 CANN MegaMoe，完全绕过 `token_combine`（如多篇 DeepSeek V4 官方食谱在配置 `"combine_quant_mode": 4` 时均显式搭配 `"enable_fused_mc2": 0`；官方参数表将本项笼统标为「Fused MC2 configuration」与实际代码消费范围不符）。

## 白名单校验与硬件支持范围

**配置白名单比算子文档更严，且不代表硬件一定支持。** 字段类型固定为 `Literal[0, 2, 3, 4]`：

- 传入白名单外的整数（如 `1`）会在启动期直接被 pydantic 以 `ValueError` 拒收；
- 传入带引号的字符串（如 `"4"` 或 `"true"`）同样直接报 `ValueError`，不会做宽松类型转换（引入 PR 描述中的「字符串自动转换」与「显式 `comm_quant_mode` 优先于本键」均与合入代码及单测相反，以实际代码为准）；
- `AscendConfig` 类注释里的示例字典漏收了该字段，排查合法键时以字段定义为准。

**各模式的算子语义与硬件闸门**（依据 Ascend `op-plugin` 快照 `aed3889c` 的 `npu_moe_distribute_combine_v2` 文档；上线前须结合现场 `torch_npu` / `CANN` 版本及 [HCCL 链路运行期配置](../concepts/ascend-runtime-and-tuning.md#hccl-关键运行期调优aiv-直驱-roce链路-qos-与双超时机制)复核）：

| `combine_quant_mode` 值 | 算子定义含义 | `aed3889c` 快照标注的硬件与附加条件 |
| --- | --- | --- |
| `0`（默认） | 不做人工覆盖：优先采用模型显式提供的 `comm_quant_mode`；仅当其为 `None` 时，`W8A8MXFP` 选 `4`、其余选 `0`（通信不额外量化） | A2 / A3 / 950DT 均支持 |
| `2` | `int8` 通信量化 | A2 需 `comm_alg="hierarchy"`，或设 `HCCL_INTRA_PCIE_ENABLE=1`、`HCCL_INTRA_ROCE_ENABLE=0` 且驱动 $\ge$ `25.0.RC1.1`；A3 要求算子实参 `tp_world_size != 2`（不可直接等同于 `--tensor-parallel-size`）；950DT 支持 |
| `3` | MXFP `E5M2` 通信量化 | 仅 950DT 在该快照文档中列出 |
| `4` | MXFP `E4M3FN` 通信量化 | 仅 950DT 在该快照文档中列出 |

缩窄专家输出回传位宽会引入量化舍入误差，而端到端能否提速还受量化转换开销、通信算法与链路瓶颈制约；调优时必须同时实测吞吐时延与业务集精度。

## 专家结果回传的模式与载荷怎样核对

核对一套具体 MoE 部署的回传模式时，先看它是否走在非融合 MC2 路径上（路径见 [expert parallel 的 combine 一节](../concepts/expert-parallel.md#4-combine拼回-token加共享输出)），再按上文四级优先级代入。以隐藏维度 `4096`、专家采用 W8A8 量化的双机部署为例（历史 [GLM 固定部署](../sources/glm-5-3-flash-baseline.md)镜像 `db701c1f` 尚无此覆盖键）：当模型未显式传入 `comm_quant_mode` 且走 MC2 路径时，dispatch 侧选 `int8`，而 combine 侧落到模式 `0`（切到 AllGather 路径则完全不经过这对 MC2 算子）。

对比单个 `(token, 专家)` 副本的逻辑张量载荷：未压缩 `BF16` 为 $4096 \times 2\text{ B} = 8{,}192\text{ B}$；若改为沿用 [EP dispatch 量化算例](../concepts/quantization.md#为什么-ep-dispatch-搬的是-int8)中「`int8` 向量加 1 个每行 `FP32` 缩放系数」的表示假设，单个副本逻辑载荷为 $4096 \times 1\text{ B} + 4\text{ B} = 4{,}100\text{ B}$（仅计张量元素与该缩放假设，不含路由索引、对齐填充与通信元数据）。即便升级到 `v0.30.0` 或 `main`，在 Atlas A2 上也只能按上表条件评估模式 `2`，不能因配置层放行 `4` 就误以为硬件支持 MXFP 回传；切换模式后的真实时延与精度仍须在目标硬件上实测确认。

## 对照源码

下表对照 `combine_quant_mode` 在四个固定版本快照中的存在性、白名单校验与 combine 优先级链：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 顶层键是否存在 | 无（逐键 `.get()` 静默忽略）[C15] | 无（逐键 `.get()` 静默忽略）[C14] | 有，`Literal[0, 2, 3, 4] = 0` [C41] | 有，`Literal[0, 2, 3, 4] = 0` [C44] |
| 字符串 `"4"` 与非法整数 | 静默忽略 | 静默忽略 | 启动期 `ValueError` 拒收（白名单单测见来源 11）[C11][!] | 同 `v0.30.0` |
| combine 优先级链 | — | — | 非零 `combine_quant_mode` > `comm_quant_mode` > `W8A8MXFP` 自动 `4` > `0` [C42] | 同 `v0.30.0` [C45] |
| 生效范围 | — | — | 仅非融合 `MC2CommImpl` 的 `token_combine`；dispatch 与 `FusedMC2CommImpl` 不读 [C6][C7] | 同 `v0.30.0` |

- **官方参数表与文档差异**：`c09d3e20:additional_config.md#L69-L73`（[latest 线上表](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)）仍将类型标为 `int`、提示查算子文档并冠以「Fused MC2 configuration」，与代码 `Literal[0, 2, 3, 4]` 白名单及非融合 `MC2CommImpl` 消费者范围不一致 [S43][!]；`AscendConfig` 示例 dict 漏收本键见来源 9 [!]；算子模式 `0/2/3/4` 含义与 A2/A3/950DT 硬件驱动条件见 `op-plugin@aed3889c` 文档 [S34]。
- **未知键与刷新语义**：`v0.30.0` 仅在可发现 `vllm_omni` 时对未知顶层键告警过滤（`c09d3e20:ascend_config.py#L1895-L1910`）[C46]；配置单例可随 `refresh` 重建见来源 35；dispatch 独立推断、MC2 算子调用及 `FusedMC2CommImpl` 绕过路径见来源 4、5、7、36；GLM 双机 `db701c1f` 默认 dispatch/combine 路径见来源 37、38，单副本载荷对比为静态推导 [D]。
- **待核**：本仓库尚无在 GLM 双机或标准主基线模型上切换 `combine_quant_mode` 后的实机时延与精度对照数据。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.combine_quant_mode` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["combine_quant_mode"]` |
| 所属类 | `AscendConfig` |
| 类型 | `Literal[0, 2, 3, 4]` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:588` [C40] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

When non-zero, force the MC2 combine stage's comm quant_mode to this value (e.g. 4 = MXFP float8_e4m3 communication quantization) regardless of the model's quant_type, 0 means disabled (use the model's own quant).

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
