---
id: ops-and-kernels
title: 算子与 kernel：从数学语义到设备实现
type: feature
summary: >-
  模型里的一次运算怎样经框架替换表、量化方法或模型自己的调用，落到 torch_npu 已有算子或仓库自编译扩展，再经 CANN 下发成设备
  kernel；并沿 GLM 双机的一层列出各站的实际算子。
  另解释 IR 怎样按参数选择实现，以及它与 Ascend 类替换和原地复用的关系。
aliases:
  - ops
  - register_ascend_customop
  - aclnn
  - csrc
  - torch_npu
  - 自定义算子
  - _C_ascend
  - CustomOp
  - kernel
  - 核函数
  - vLLM IR
  - ir_op_priority
  - ir-op-priority
  - maybe_inplace
chapters:
  - '16'
order: 10
sources:
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L109-L133'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L174-L207'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L818-L823'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L101-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L452'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/__init__.py#L39-L55'
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L83-L107'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2213-L2240'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L157-L166'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L430-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:csrc/torch_binding.cpp#L2848-L2860'
  - >-
    vllm-ascend@db701c1f:csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h#L93-L149
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L108-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L225-L240'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L329-L340'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L113-L215'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L366
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L821'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L148-L166'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/layernorm.py#L64-L82'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L495-L505'
  - >-
    raw:sha256-27c83d31e48f1e89a9eac97dd56e684db06c552ce727013a0fb1e1b183811e47.md#L1-L1026
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L819-L955'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L544-L588'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/layernorm.py#L83-L103'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L94-L134
  - >-
    vllm-ascend@7d825229:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L293
  - >-
    vllm-ascend@7d825229:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L333-L378
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L390-L502'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L504-L630'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L38-L38'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L199-L213'
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json#L126-L132
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L769-L823'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L506-L659'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L660-L783'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L794-L926'
  - 'vllm@0fc695fc:vllm/model_executor/layers/layernorm.py#L36-L101'
  - 'vllm@0fc695fc:vllm/ir/op.py#L327-L366'
  - 'vllm@568afb3a:vllm/ir/op.py#L327-L366'
  - 'vllm@ced6857a:vllm/ir/op.py#L327-L366'
  - 'vllm@84030bbe:vllm/ir/op.py#L327-L366'
  - 'vllm@0fc695fc:vllm/ir/op.py#L389-L426'
  - 'vllm@0fc695fc:vllm/compilation/passes/ir/lowering_pass.py#L43-L69'
  - 'vllm@0fc695fc:vllm/config/kernel.py#L251-L273'
  - 'vllm@568afb3a:vllm/config/kernel.py#L276-L298'
  - 'vllm@ced6857a:vllm/config/kernel.py#L397-L419'
  - 'vllm@84030bbe:vllm/config/kernel.py#L350-L372'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L91-L96'
  - 'vllm@0fc695fc:vllm/config/kernel.py#L19-L100'
  - 'vllm@0fc695fc:vllm/ir/op.py#L530-L539'
  - 'vllm@0fc695fc:vllm/ir/op.py#L650-L664'
  - 'vllm@0fc695fc:vllm/compilation/passes/ir/inplace_functionalization.py#L64-L91'
  - 'vllm@0fc695fc:vllm/compilation/passes/ir/clone_elimination.py#L72-L155'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1128-L1134'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1244-L1250'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1601-L1607'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1507-L1513'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L664-L666'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L635-L637'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1366-L1368'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1250-L1252'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/layernorm.py#L63-L87'
  - 'vllm@0fc695fc:docs/design/vllm_ir.md#L1-L615'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1436-L1442'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L337-L429'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L285-L337'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2153-L2167'
  - 'vllm@0fc695fc:docs/design/custom_op.md#L1-L318'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L25-L100'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L138-L207'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L271-L353'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L898-L901'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L987-L993'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1135-L1142'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/layer.py#L68-L100'
  - 'vllm@568afb3a:vllm/model_executor/custom_op.py#L25-L353'
  - 'vllm@568afb3a:vllm/config/compilation.py#L1003-L1009'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1251-L1258'
  - 'vllm@ced6857a:vllm/model_executor/custom_op.py#L25-L360'
  - 'vllm@ced6857a:vllm/config/compilation.py#L1011-L1032'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1608-L1615'
  - 'vllm@84030bbe:vllm/model_executor/custom_op.py#L25-L360'
  - 'vllm@84030bbe:vllm/config/compilation.py#L1004-L1025'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1514-L1521'
  - 'vllm@568afb3a:vllm/config/compilation.py#L907-L910'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L544-L588'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L819-L955'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L250-L382'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/layernorm.py#L81-L102'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1376-L1378'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L574-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L846-L982'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L430-L501'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/layernorm.py#L81-L120'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1582-L1584'
  - 'vllm@ba15685a:vllm/model_executor/custom_op.py#L102-L356'
  - 'vllm@ba15685a:vllm/config/compilation.py#L1168-L1190'
  - 'vllm@ba15685a:vllm/config/vllm.py#L1978-L1995'
  - 'vllm@ba15685a:vllm/ir/op.py#L321-L360'
  - 'vllm@ba15685a:vllm/config/kernel.py#L498-L523'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 先理解矩阵运算的输入输出
  - to: attention-backend-family
    kind: builds-on
    note: 后端选择决定注意力落到哪个算子
  - to: quantization
    kind: builds-on
    note: W8A8 的量化方法决定线性层调哪个算子
contradicts: []
updated: 2026-11-11T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-27c83d31e48f1e89a9eac97dd56e684db06c552ce727013a0fb1e1b183811e47.md
  - >-
    raw/sha256-4b3a7273e08d4e338ae17b4d2c063590921f424a7c1c2dbce09ce19e7698a655.md
---

## 一次矩阵乘，到底是谁在算？

模型代码里写的是「一次 RMSNorm、一次 Linear」。这一行 Python 要到昇腾卡上真正开始算，中间还要转手三四次：先决定这个模块换成谁的实现，再决定这份实现调哪个算子接口，接着由 CANN（昇腾的算子运行库）挑分块、排任务，最后才在设备上启动一段叫 kernel 的程序。

先把两个词分开。**op（算子）**是对一类运算的接口与语义约定：叫什么名字、吃什么形状、出什么形状，比如「矩阵乘」「RMSNorm」。**kernel（核函数）**是设备上真正跑的那段程序，它要处理搬数据、分块、循环这些事。一个算子可以启动多个 kernel，多个数学运算也可以融合进一个 kernel——所以「模型里有多少次运算」和「设备上启动了多少次 kernel」不是同一个数。

分层让模型可以复用数学结构、平台选择合适实现；代价是排障要查清实际分支，具体实现还可能要求额外的权重排布或扩展依赖。

```wiki-diagram
file: ops-layers
```

图里第二层的三条路，是 vllm-ascend 换实现的三种办法，它们最终都落到第三层的两类算子上：一类是随 torch_npu（把 PyTorch 接到昇腾软件栈的那层）发布的成熟算子，另一类是这个仓库自己用 AscendC 写、随镜像编译出来的扩展算子。

| 层 | 它是什么 | 谁负责 | 在哪能看到 |
|---|---|---|---|
| 模型模块 | PyTorch 的一个 Module，只写数学意图 | vLLM 本体的层定义，或模型文件 | 模型文件里 `self.mlp(...)` 这样的调用 |
| 换实现 | 把模块换成昇腾版，或按量化配置挑算法 | vllm-ascend 的替换表、量化方法 | 进程启动时注册一次，之后不再变 |
| 算子接口 | 一次带名字、带形状约定的调用 | torch_npu 已有算子，或仓库自编译扩展 | Python 里 `torch_npu.xxx` 或 `torch.ops` 下的调用 |
| 运行库 | 挑分块与实现、排任务、下发到卡 | CANN 的 aclnn（CANN 提供的单算子 C 调用接口，一个函数对应一个算子）与运行时 | C++ 适配层，Python 侧看不到 |
| kernel | 设备上执行的程序 | 算子包，或仓库自己编译的 AscendC 代码 | 开放实现可读设备源码；实际选用与启动次数看 profiling |

这一页讲的是前四层：每一层各是什么、由谁决定、在哪能查到。追踪任何一次运算都按同一个顺序：先确定它的数学输入输出，再找到模型里的调用点，接着确认这个模块最终是哪个类、哪个方法在执行，最后才进到算子接口或扩展。第五层里一个 kernel 具体怎么搬数据、怎么切块，见[一次归一化落到 AI Core](op-to-ai-core.md)。

确认执行方法时，还要区分实现选择与编译选择。固定上游在自定义操作未启用时，仍将原生实现交给编译选择方法，并传入编译开关。因此，关闭自定义操作不意味着必然以 eager 方式逐个执行，还需检查原生方法是否经过编译。

## 为什么要分这么多层，代价是什么？

**通用模型模块可以通过平台实现适配硬件。** vLLM 本体只认「这是一个 RMSNorm」，具体调谁由平台插件在进程启动时替换。固定执行版本有 26 个基础类名映射，本部署的版本门控再加 MoE 与 KDA 两项；随后还按模型条件补 GateLinear、按设备条件覆盖部分实现，Worker 初始化时统一注册。这样，调用通用模块的模型代码可以复用数学结构；本页 GLM 还有直接调用 Ascend 扩展的部分，跨平台适配仍需分别实现。

**同一个模块可以有好几种算法。** 量化就是典型：同样是 Linear，不量化时走一条路，W8A8（权重 8 位整数、激活 8 位整数）时走另一条。这个选择不在替换表里，而在层的量化方法对象上，按启动时读到的量化配置决定，细节见 [quantization](quantization.md)。

**成熟实现和自己写的实现可以并存。** 普通算子用 torch_npu 的现成实现，融合算子、新模型的特殊结构则自己写。GLM 的残差混合、KDA 的分块递推，就是仓库自己编译出来的。从 `v0.30.0` 起，替换表与运行时扩展进一步改由 `HardwareProfile` 硬件能力门控驱动：310P 通过兼容能力覆写为 `_310p` 专用实现，运行时扩展按 `RUNTIME_CUSTOM_OPS` 能力开关判定（`v0.30.0` 在 A5 上禁用，到了 `main` 重新对 A5 开放）。若要接入新模型或新增自定义算子，开发选型与硬件能力门控规范见 [新模型与自定义算子开发指南](dev-new-model-and-custom-op.md)。

代价有四条，读代码和排障时都会撞上：

- **看不出谁在算。** 模型文件里的一次调用，要跨四层才能找到真正执行的算子；中途还要被量化方法、芯片型号各再分一次叉。这也是[调用链](request-call-chain.md)那一页要按进程和类逐层认站的原因。
- **自编译扩展是可选件。** 它随镜像编译安装，装不上时有的路径退回 torch_npu 的等价实现，有的路径直接抛错。同一份 Python 代码在两个镜像里走哪条分支，由扩展装没装上决定。
- **具体融合算子对权重排布有要求。** 本版本 W8A8 专家的分组矩阵乘与 SwiGLU 融合路径要求 [NZ 格式](tensor-layout.md)，所以这些权重要在加载后转好，推理时复用；普通矩阵乘的输入格式应按自己的接口核对。
- **一次算子调用未必只启动一个 kernel。** 一个算子的实现可以依次调用多个 kernel；满足融合条件时，可把原来的多次调用合并。同一个 kernel 内还可以把数据分给多个核、让每个核循环处理小块；这些分块不等于多次启动。真实启动次数要看 profiling，不能靠数 Python 调用行数或分块数。

## 换了 Python 类，就一定经过同一种前向分派吗？

**整层替换（换类）、算子方法分派（绑前向）与二进制扩展加载（`enable_custom_op`）是三道彼此独立的关卡；有的层只过第一关。** 例如固定上游的 `RMSNorm` 属于 `CustomOp`：创建对象时在 `__new__` 查 OOT 替换表换成平台提供的类，构造期 `__init__` 再决定绑定原生方法还是平台方法。`v0.30.0` 与 `main` 中的 `MoERunner`、`RoutedExperts`、`GateLinear` 与 `Linear`（早期 GLM 快照里对应 `FusedMoE`）等较大模块则使用 `PluggableLayer`（可替换层）：它允许插件把整个类连同权重、子模块和初始化一起替换，但这个基类本身不提供 `CustomOp` 的按平台前向分派——层内部仍可再调用自己的 `CustomOp`、量化方法或自编译扩展。

下面这张门控图把三道关卡和 A5（Ascend 950）/ 310P 的硬件能力分支放在同一视图里：

```wiki-diagram
file: ops-and-kernels-fig-dispatch-gate
```

| 要决定的事 | 查什么 | RMSNorm 的例子 |
|---|---|---|
| 创建哪个类 | OOT（仓库外的平台插件）替换表，以原类名为键 | 用类名 `RMSNorm` 找到 `AscendRMSNorm` |
| `CustomOp` 的方法开不开 | 运行时类上的 `name`，以及 `custom_ops` 列表 | 上游原类注册名为 `rms_norm`；插件登记时可以改写 `name` |
| 真正执行什么 | 所选类的实际前向方法 | 原生方法可能进入 IR；Ascend 方法可以直接调用 NPU 算子 |

因此，配置中的名字区分大小写，也不能从 Python 类名机械地改成小写。固定 Ascend 注册循环用 `RMSNorm` 这个键登记替代类，同时把替代类的 `name` 设为 `RMSNorm`。定位开关时应先确认实际实例的类和 `name`，再核对最终生效配置；既不能以为给上游名字加一个减号就能撤销整个插件替换，也不能只凭「某层放在自定义算子目录里」就断定它受同一套方法开关控制。

## 同一个算子，为什么还会出现 IR 优先级？

**vLLM IR 是在计算图里保留“要做什么”的操作表示，再为它选择“由哪份实现来做”。** 例如一个 RMSNorm 操作保留输入、权重和精度约定，具体实现可以来自通用 PyTorch 运算，也可以来自某个平台的 kernel。这样，融合规则先面对统一的操作，再由后续步骤选择实现；IR 自己不是一套设备 kernel。

它与前面的类替换发生在不同位置。类替换决定创建哪一个 Python 模块；只有这个模块的实际执行方法进入 IR 操作，IR 的优先级才会参与。固定上游 RMSNorm 的原生方法会调用 IR，而正常启用的 Ascend RMSNorm 方法直接调用 NPU 算子。先确认真实调用入口，再看优先级配置。

```wiki-diagram
file: ops-ir-selection
```

举一个选择过程的示意例子：候选顺序为“专用实现 A，再通用实现”。A 已在当前平台注册，但只支持 FP16 输入。输入为 FP16 时选 A；输入为 BF16 时，参数检查不通过，继续选通用实现。若 A 在这个平台根本不可用，设置列表时就会先过滤；如果名字没有注册，配置会报错。**优先级决定尝试的顺序，参数条件决定这一轮选谁。**

编译路径可以用代表形状和类型的假张量完成这次选择，再把被选实现写进图；eager 路径则在调用时用真实参数选择。两条路使用同一个选择规则。实现之间仍要满足相同的语义与数值容差，优先列出的实现也需按目标负载确认收益。

还有一个容易混淆的约定叫 maybe_inplace，意思是调用方允许这些输入的存储被结果复用。以输入 x 和残差 r 为例：普通重载要求调用结束后 x、r 仍可使用；如果选中会原地写的实现，就先复制需要保护的输入。选择 maybe_inplace 后，调用方交出了这些输入，后续只使用返回的结果，不能再依赖旧 x、r 的内容。只有被选实现支持原地写时才会因此复用，单看这个名字无法推出节省了几份张量。

编译时会检查交出的输入是否又被后续操作使用；若发生这种情况会拒绝改写。后续去掉复制还要保证布局以及写入前后的使用关系满足条件。这里解决的是存储复用约定；归一化的具体计算仍见 [残差与归一化](mlp-residual-norm.md)。

## 在 GLM 双机上，一个 token 沿一层走过哪些算子

下面按[双机部署](glm-5-3-flash-two-node.md#部署前提)的前提（2 台 A2、每台 8 卡、TP8、DP2、EP16、W8A8）走一遍第 3–44 层中的一层。每一站的形状、字节和通信次数在[一次请求](one-request.md)里推导过，这里只看它落到哪个算子。

| 站 | 谁决定实现 | 落到哪个算子 |
|---|---|---|
| 残差混合（mHC）入口 | 模型文件里写死 | 仓库自编译扩展的 `npu_hc_pre_v2` |
| 输入 RMSNorm | 替换表；本模型只传入混合后的一路张量 | torch_npu 的 `npu_rms_norm`；带残差的实现对照见[一次归一化落到 AI Core](op-to-ai-core.md) |
| QKV 投影 | KDA 投影显式不接量化；稀疏 MLA 的投影按各自配置与量化描述选择 | 保留 BF16 的层走浮点矩阵乘；实际选中动态 W8A8 的层才走 `npu_dynamic_quant` 与 `npu_quant_matmul` |
| 注意力本身 | 后端表 | 34 层走 KDA 的自编译算子，11 层走稀疏注意力算子 |
| 输出投影 | KDA 保持浮点；接量化配置的投影继续由逐层描述决定，TP 合并另按层实现执行 | 按实际方法选择浮点或量化矩阵乘 |
| 残差混合出口 | 模型文件里写死 | 自编译扩展的 `npu_hc_post` |
| MoE 分发 | 通信方式选择 | 满足专家数、EP 规模与 token 容量条件时走 torch_npu 的 MC2 分发算子；短 prefill 也可走这条路，大批输入换 AllGather 路径 |
| 专家计算 | 量化方法与融合条件 | 分组矩阵乘与 SwiGLU 可融合，也可分开执行，随后做第二个分组矩阵乘 |
| MoE 合并 | 通信方式选择 | 同分发：MC2 路线下是 torch_npu 的 MC2 合并算子 |

表里的残差混合（mHC，multi-head hyper-connection）是 GLM 自己的结构：这个模型的残差不是一条而是四条并行的流，进子层之前，入口算子按一组当场算出来的系数把四路合成一路，作为子层的输入；子层算完，出口算子再把结果摊回这四路。注意力和 MLP 两个子层前后各做一次。这两次调用在模型文件里写死，不经过替换表。

注意力那一站为什么 34 层和 11 层不一样、后端表按什么选，见[后端家族](attention-backend-family.md)；这里只接着讲这几类算子各自长什么样。本页只追踪源码入口：Python 里出现一个扩展的名字，不等于已经核实它在专用镜像里装好并真的跑起来，这条边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

## 特殊的几类层各自落到哪个算子

### 量化矩阵乘（W8A8）

实际选中动态 W8A8 的线性层按两步执行：先把这一批激活按 token 动态量化成 int8，同时得到每个 token 一个 FP32 的缩放系数；再调量化矩阵乘，把权重侧的 per-channel 缩放和激活侧的 per-token 缩放一起交给算子，算子内部完成反量化并按输入类型输出，本部署对应 BF16。反量化不是单独一次调用。固定源码的 KDA q/k/v/o 及门控投影显式保持浮点；其余接入量化配置的层是否实际采用该方法，还需量化包逐层描述确认，依据和待核项由[量化页](quantization.md#哪些矩阵是-8-位哪些保持-bf16)统一维护。

普通动态 W8A8 线性权重在加载后按 NZ 策略决定是否转换；固定默认策略会转换符合条件的 INT8 权重。不量化的线性层走另一条路，调的是上游注册的通用矩阵乘。

### KDA 线性注意力（34 层）

KDA（Kimi Delta Attention，把历史压进固定大小状态的线性注意力）的算子基本都是仓库自己写的。先是一个窗口为 4 个 token 的因果短卷积算子（这里的「窗口」是卷积宽度，和设备上的 kernel 不是一回事）；然后按阶段分叉：prefill 时先做 L2 归一化，再调门控前缀和算子和分块前向算子，块长 64，最后把状态写回；decode 则调递推算子，门控和归一化都在算子内部完成。

普通 decode 沿每条请求的新 token 更新状态；投机验证会把候选位置一起交给递推调用，还传入序列边界、状态索引和已接受 token 数。因此一次算子调用可能包含多条请求及多个候选位置。固定实现先分开投机与非投机行；没有投机掩码、又同时含普通 decode 和 prefill 时，再将两部分分别送入递推与分块路径，并按 decode 在前、prefill 在后的顺序拼接。若同时有投机与非投机结果，则按各自的 token 索引写回原位置。每轮要处理多少位置取决于元数据，不能把“递推更新”理解成一次调用总共只有一个 token。

这条路对自编译扩展是硬依赖：prefill 用到的两个算子如果在当前镜像里没有注册，层会直接抛错，不会退回 PyTorch 实现。

### 稀疏 MLA 注意力（11 层）

这 11 层的生产路径是：注意力实现类的前向调一个内部方法，子类先校验潜向量与 RoPE 缓存视图的宽度，再取此前登记的 packed MLA 缓存张量，交给设备适配层；该处不把三份缓存临时拼成完整 KV。A2 上适配层把两部分 query 拼接后调用自编译扩展，query 布局 TND、KV 布局 PA_BSND，稀疏块大小 1。这个算子的 C++ 绑定在仓库的 csrc 目录里，适配函数最终调用 CANN 的 aclnnSparseFlashAttention。

同一个文件里还有一份纯 PyTorch 的稀疏注意力参考实现，它只被单元测试调用，不在推理路径上——看这类文件时要先确认调用点，再下结论。

### MoE 的分发与合并

MC2 是昇腾协同执行专家计算与跨卡通信的一类实现。选路条件看每卡专家数、EP 规模和这一步实际对齐的 token 数，不按“是不是 prefill”二选一；本部署的短 prefill 也能走 MC2，批里混进大段提示词、超过容量时才换成 AllGather 路径。具体门槛和 R1 的选择见[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)。

MC2 路线下，分发和合并各是一次 torch_npu 的 MC2 算子调用：一个算子同时完成「把 token 发给选中的专家」和跨卡通信，合并侧同理。固定实现仅通过新版分发接口是否存在来选择一组分发与合并接口，没有单独探测新版合并接口；安装的 torch_npu 仍须提供相互匹配的一组接口。

夹在中间的专家计算先准备激活量化值（如果分发已经带回量化结果就复用），再完成第一组矩阵乘与 SwiGLU，最后做第二组矩阵乘。固定实现只有在 MC2 且第一组权重没有额外缩放偏置与量化偏移时，才进入这里讨论的融合候选；还要按融合开关、EPLB 和量化格式选择自编译融合、设备融合或分开执行。W8A8 的两份专家权重在加载后转为 NZ，满足相关融合接口的布局要求。

## 常见误解

- **「替换表里的每一项都是仓库自己编译的 kernel。」** 替换表只是把类名换成昇腾版的 Python 类。换完之后调什么，由这个类自己决定：有的类调 torch_npu 的现成算子，有的类调自编译扩展，归一化这样的类两条路都有。
- **「一个算子就是一个 kernel，分几个块就启动几次。」** 算子可以调用一个或多个 kernel；一次 kernel 启动也可以由多个核分块执行，每核继续循环。算子调用数、kernel 启动数、数据分块数是三个不同的量，具体分工见[Host 如何分行](op-to-ai-core.md#host-tiling把张量任务划给设备)。
- **「所有层都由同一张替换表决定。」** GLM 的残差混合是模型文件里写死的扩展调用，根本不经过替换表；注意力走的是后端表；量化走的是量化方法。至少四套机制并存。
- **「Python 里出现了扩展的名字，就说明这个算子一定能跑。」** 有些名字只是占位对象，用来让图优化阶段认得出名字，它们没有可执行实现。扩展本身也要在当前镜像里装好才可用，导入失败时整个开关会被置假。
- **「装不上自编译扩展，顶多慢一点。」** 归一化这类路径确实能退回 torch_npu 的等价实现，但 KDA 的 prefill 会直接抛错。能不能退，要看具体那一层怎么写的。
- **「量化就是先算完再把结果转成 int8。」** W8A8 是激活先量化成 int8 再进矩阵乘，缩放系数交给算子，算子内部反量化后输出 BF16。
- **「按芯片选实现和按类名换实现是一回事。」** 替换表按类名换 Python 类；设备适配层按芯片型号（A2、A3、A5、310P）选另一份实现。同一次调用会被这两层分别过一遍。
- **「读源码看到某个文件里有实现，就是推理时跑的那份。」** 稀疏注意力那份纯 PyTorch 实现只有单测调用；基类里的同名方法也被子类重写了。要先确认调用点。

## 对照源码

### 怎么开

- 替换表的注册没有开关，Worker 初始化时必定跑一次：先 `register_dummy_fusion_op()`，再 `register_ascend_customop(vllm_config)`，最后才初始化昇腾配置。[C5]
- 自编译扩展是懒加载的：`enable_custom_op()` 第一次被调用时才 `import vllm_ascend.vllm_ascend_C`，把算子注册进 torch 库，同时导入 meta 实现；结果缓存在进程内的全局变量里。这样设计是为了让 `ASCEND_RT_VISIBLE_DEVICES` 在设置设备之前还能改。[C6]
- 两个会让扩展整体关掉的条件：环境变量 `VLLM_BATCH_INVARIANT` 打开（批不变模式下部分自定义算子没有实现），或当前硬件配置未声明 `RUNTIME_CUSTOM_OPS` 能力（`v0.23.0`/`v0.26.0rc` 对 A5 禁用，`v0.30.0` 的 A5 硬件档案仍不含该能力，`main` 已为 A5 恢复该能力）。310P 则通过 `COMPATIBILITY_OP_IMPLEMENTATIONS` 能力在 `register_ascend_customop` 阶段覆盖为 `_310p` 兼容算子实现。
- 环境变量 `COMPILE_CUSTOM_KERNELS` 设为假时，Worker 只打印一条警告说「多数场景下不装自定义算子 vllm-ascend 不能正常工作」，不会阻止启动。
- 上游 `CustomOp` 自己还有一层开关：`compilation_config` 的 `custom_ops` 列表决定某个算子是否启用，禁用时回落到 `forward_native`，启用且平台是 out-of-tree 时才返回 `forward_oot`。[C2]
- KDA 与 FusedMoE 这两项是版本门控注册的：只有 `vllm_version_is("0.23.0")` 为真时才加进替换表。[C3]

禁用后的 `forward_native` 仍经过 `maybe_compile` 处理，是否编译由 `compile_native` 控制。因此，禁用这个 CustomOp 并不意味着原生实现必然以 eager 模式执行。固定上游 `custom_op.py` 的 174–207 行定义这一分派。

**custom_ops 的列表怎样写。** 每个规则占一个独立元素。以下是上游原类尚未被 OOT 改名时的配置示意：`--compilation-config '{"custom_ops":["all","-rms_norm"]}'` 表示默认开启、仅关闭该名字；`{"custom_ops":["none","+rms_norm","+rotary_embedding"]}` 表示默认关闭、仅开启两项。不能写成 `["all,-rms_norm"]`，逗号不是元素内部的分隔语法。all 与 none 不能同时出现；未指定二者时，上游在启用编译且 backend=inductor 的条件下补 none，否则补 all。

这层设置不是绝对优先：对象构造可用 enforce_enable 强制开启，平台也可以改写整个列表；固定 Ascend 的最终处理见下文。启用后，基类的 HIP 方法默认转给 CUDA，CPU、XPU、TPU、OOT 方法默认转给 native，但子类可以覆盖。native 本身也是可选实现，基类会抛 NotImplementedError，所以“关闭后一定有可用回退”要逐类确认。

**IR 的配置属于另一层。** CLI 入口是 `--ir-op-priority`，对应 KernelConfig.ir_op_priority；固定配置声明 rms_norm 和 fused_add_rms_norm 两项，值接受实现名列表或逗号分隔字符串。字段初始为空列表，平台默认随后追加到用户列表后并去重，Worker 启动时才安装最终优先级。例如 `--ir-op-priority.rms_norm=native` 将通用实现放在该 IR 操作的首位；它不改变已经直接调用 torch_npu 的方法。同一个操作的优先级只选一种入口设置，同时从顶层选项和 KernelConfig 再设一次会报错。

默认重载保留输入，maybe_inplace 允许复用的语义在 eager 和编译时相同。控制 IR 是否以不透明操作进入计算图的 ir_enable_torch_wrap 属于 CompilationConfig；缺省仅在 VLLM_COMPILE 且 backend=inductor 时打开，显式 false 让前端看到 eager 分派行为。这个开关既不是禁止原地写，也不是禁用全部编译。如何取得编译图和约束记录见 [编译取证](npugraph-ex.md#怎么开)。

Ascend 还会改写 CustomOp 的最终开关：固定 GLM 的非 310P 路径强制设为 all，新版按硬件能力决定是否同样改写。因而“传了 -rms_norm”与“实际进入原生 IR 路径”之间仍隔着平台处理，应以最终配置和执行方法为准。

```wiki-diagram
file: ops-dispatch-flow
```

图对应固定控制侧的 CustomOp 对象生命周期：注册表先决定实例化哪个类，构造对象时再保存执行方法，前向阶段调用这个方法。量化方法和模型直接调用扩展是前文的另外两条入口，不必经过图里的同一组分支。

### 会报什么错

在固定 GLM 上游，custom_ops 的 `["all,-rms_norm"]` 或 `["none,+rms_norm,+rotary_embedding"]` 会报 `Invalid syntax ... must be 'all', 'none', '+op' or '-op'`。`["+rms_norm,+rotary_embedding"]` 虽能通过这一层语法检查，却不会拆成两条规则，因此不能按它开启单独的 rms_norm。all 与 none 同时出现会触发配置断言；同一名字同时出现正负规则则在该类启用判断中报 `Cannot enable and disable ...`。新版检查与异常类型的变化见版本表；这些问题不能靠删掉插件替换表来修复。

IR 优先级中的名字必须是已注册的实现；拼错名称会在安装优先级时触发注册检查。已注册但平台不支持的实现会被过滤，缺少通用兜底时会补入 native 并给出提示；实际参数检查选择的是过滤后的列表。编译时若把输入交给 maybe_inplace 后又使用旧输入，会得到带 “used again after the node” 的 ValueError；保留输入应改用普通重载或先显式复制。

- KDA prefill 缺算子：`RuntimeError: Kimi KDA prefill requires the PR141 AscendC operators, but the following schemas are missing: torch.ops._C_ascend.kda_gate_cumsum, torch.ops._C_ascend.chunk_kda_fwd. Rebuild and install the vllm-ascend custom operators with KDA support.`，在进入 prefill 分支前抛出。[C14]
- 扩展没装上时，`enable_custom_op()` 捕获 `ImportError`；如果报错信息里带 `libcust_opapi.so`，它会补上厂商库路径再试一次导入，仍失败才把开关置假。[C6]
- `CustomOp.__new__` 在读取类的 `__name__` 发生 `AttributeError` 时才转成带注册提示的 `TypeError`。正常 Python 类具有 `__name__`，这段代码不能证明“凡是未加注册装饰器都在这里抛 TypeError”；是否注册以及后续分派要分别核对。[C1]
- 分发算子的 v2 版本不在当前 torch_npu 里时不报错，`hasattr` 探测为假就走旧版接口，这一步只能靠读代码发现。[C23]

这里的“不报错”只描述接口选择：固定 token_dispatcher 构造时检查 `npu_moe_distribute_dispatch_v2`，分发和合并共用这个选择结果，没有独立探测 combine_v2。选择成功不保证后续调用成功，运行环境须安装匹配的 torch_npu 接口组；依据为该文件的 110–113、225–238、329–340 行。

### 开销和什么时候别开

- **多一层分派不等于多一次开销。** 替换表在进程启动时注册，`CustomOp` 在构造时就把前向方法定死在实例上；每次前向只是一次属性调用，不再查表。[C2]
- **融合可以减少独立下发和中间访问，具体节省要按张量核对。** 带残差的归一化把加法和归一化并成一次调用，但更新后的残差仍要写回；后续归一化能继续使用已经取得的数据，省下多少须与对照实现比较，见[残差融合的数据交接](op-to-ai-core.md#为什么要分块和融合代价在哪)。量化矩阵乘在接口内部完成反量化，Python 层没有单独的反量化调用；实际设备读写与耗时仍需 trace。
- **融合要付排布的代价。** 分组矩阵乘加 SwiGLU 的融合算子只接受 NZ 格式，所以权重加载后要转置并转格式，换来推理时不必临时转。[C27]
- **什么时候别开自编译扩展：** 批不变模式下必须关（部分自定义算子没有批不变实现）；排查精度问题时可以先关掉，比较同一条输入在 torch_npu 实现下的结果——但要清楚 KDA 的 prefill 关不掉，它没有回退路径。[C14]
- 本页不写任何算子的实测耗时：没有实测就无法说哪条路更快、融合省了多少。缺哪些实测，集中列在页末待核第 1 条。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**本页 GLM-5.3-Flash 算例读的是专用镜像 `db701c1f`（独立 orphan commit，不含在 `2c59ff10` 维护分支里，也不混入 `v0.30.0` 主基线）。**

先看上游 CustomOp / IR 契约与 Ascend 执行路径四版对照：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 上游 `CustomOp` / `PluggableLayer` 与 `custom_ops` 校验 | `PluggableLayer` 换整类、`CustomOp` 选方法；未指定 `all`/`none` 时编译+inductor 补 `none` 否则补 `all`；冲突靠断言 | 同 `v0.23.0` | 配置阶段显式拒绝空串/仅正负号元素与重复默认模式，正负冲突抛 `ValueError` | 同 `v0.30.0`（`compilation.py#L1168-L1190`、`vllm.py#L1978-L1995`） |
| 上游 IR 分派与 `ir_enable_torch_wrap` | 注册、按参数选择、用户优先级在前/平台默认在后；缺省仅 `VLLM_COMPILE` + `inductor` 包装 | 同 `v0.23.0` | 同 `v0.23.0` | 同 `v0.23.0`（`ir/op.py#L321-L360`、`kernel.py#L498-L523`） |
| `register_ascend_customop` 与 310P 兼容派发 | 在 `utils.py#L690-L821` 登记并按芯片分支覆盖 310P；无 KDA 项（镜像 `db701c1f` 版本门控含 KDA） | 基础映射直接登记 `KimiGatedDeltaNetAttention` | `utils.py#L819-L955` 由 `HardwareCapability.COMPATIBILITY_OP_IMPLEMENTATIONS` 统一触发 310P `_310p` 实现覆盖；无旧 KDA 项 | `utils.py#L846-L982` 延续能力门控 310P 覆盖与 `CustomOp.register_oot` 统一注册 |
| `enable_custom_op` 与 A5 `RUNTIME_CUSTOM_OPS` | 批不变模式或 A5 芯片禁用扩展 | 同 `v0.23.0` | `utils.py#L544-L588` 改查 `RUNTIME_CUSTOM_OPS`；`hardware_profile.py#L250-L382` 对 A2/A3/310P 开启、**A5 仍禁用** | `utils.py#L574-L618` 查 `RUNTIME_CUSTOM_OPS`；`hardware_profile.py#L490` **为 A5 恢复 `RUNTIME_CUSTOM_OPS`** |
| Ascend 覆盖 `custom_ops = ["all"]` | 非 310P 路径强制设为 `["all"]` | 同 `v0.23.0` | `platform.py#L1376-L1378` 按 `AUTO_ENABLE_CUSTOM_OPS` 能力设为 `["all"]` | `platform.py#L1582-L1584` 同 `v0.30.0` |
| `AscendRMSNorm` 带残差分支 | `maybe_chunk_residual` 后按 `enable_custom_op()` 在自编译融合与 `torch_npu.npu_add_rms_norm` 间二选一 | 同 `v0.23.0` | `layernorm.py#L88-L95` 直接导入 `vllm_ascend_C` 调 `npu_add_rms_norm_bias`，**无 `torch_npu` 回退** | `layernorm.py#L88-L99` **恢复 `if enable_custom_op()` 分支**，关闭时（如 `VLLM_BATCH_INVARIANT`）回退 `torch_npu.npu_add_rms_norm` + 逐元素 `bias` |
| GLM-5.3-Flash / W8A8 目录演进 | 维护分支无 GLM 代码（在镜像 `db701c1f`） | 无 GLM 代码（有 Kimi K3） | GLM 在 `models/glm5next/`；W8A8 动态线性迁入 `quantization/methods/w8a8/w8a8_dynamic.py`；新增 Gemma QKVNorm/RoPE 融合与共享专家预量化 | 延续 `models/glm5next/` 与 `w8a8/` 布局；`AscendGemmaRMSNorm` 无残差改走 `DeviceOperator.npu_gemma_rms_norm` |

以上比较明确区分了**注册表登记（Python 类替换）**与**二进制扩展加载（`enable_custom_op`）**两层机制：注册表或目录里存在某实现不等于当前请求实际命中它；IR 优先级也只在模块进入原生 IR 路径时生效，而 Ascend 正常 `forward_oot` 直接调用 NPU 算子，详见 [新模型与自定义算子开发指南](dev-new-model-and-custom-op.md#950a5与-310p-的硬件能力门控千万别硬编码芯片名) 与 [Gemma 式 QKVNorm/RoPE](npugraph-ex.md#版本差异)、[共享专家预量化](moe.md#版本差异) [C106][C110]。

### 源码位置

四版 CustomOp 的类替换、分派与 OOT 名字，以及语法、冲突和默认补齐消费见来源 87–96；每一列使用各自固定快照，仅比较版本表列出的契约。

CustomOp 与整层替换的贯穿例子使用固定上游 0fc695fc，四版共有契约与检查变化见版本表。来源 79 是设计母文；其展开的层清单中，FusedMoE 已由 PluggableLayer 注册（来源 86），不能把目录中的所有项都视为 CustomOp。整层替换与共享注册表见 80；平台方法默认转发、enforce_enable 和 native 未实现时的边界见 81；规则按完整元素匹配、同项冲突、两个注册装饰器与 OOT 改写 name 见 82。语法检查和默认值补齐分别见 83–85。Ascend 的 RMSNorm 映射及实际登记沿用来源 3、4；“传规则后仍需查最终配置”也由来源 69–72 的平台覆盖支持。IR 的版本表不扩大为所有 PluggableLayer 或 CustomOp 子类都已逐版验证。

- 点号 CLI 示例的生产链：来源 75 注册顶层选项；76 将点号子键合为 JSON；77 按配置类校验；78 把结果传入 KernelConfig，并拒绝同一个操作在两处重复设置。

- IR 与原生 RMSNorm 的连接见来源 48；四版实际 dispatch 在 49–52，设置优先级时校验、过滤与补兜底在 53；Inductor lowering 用 fake 参数调用同一选择器见 54。
- 四版平台优先级追加规则见 55–58，Worker 安装入口见 59，配置字段与字符串解析见 60。普通与 maybe_inplace 重载分别见 62、61；捐赠后使用的校验在 63，布局/写后使用/图输入保护与别名限制在 64。候选 A 的 FP16/BF16 选择是说明这套规则的教学假设，并非注册了一个叫 A 的实现。
- 四版 IR 包装的缺省条件见 65–68，Ascend 重设 CustomOp all 的条件见 69–72。固定 GLM 与 `v0.30.0` / `main` 的 NPU 方法沿用来源 7、30、35，v0.26 方法补在 73；四版注册类入口沿用 3、46、33、47。官方 IR 设计全文在 74，通用 IR 的 clone 清理不能推成任意别名图都安全；固定实现明确只针对已知图形。

基础映射之后按模型补 GateLinear、按 310P 条件覆盖部分实现，并最后统一注册，见来源 44。KDA 的投机拆分、候选递推、普通 decode/prefill 拼接和按索引回填见来源 45；它们共同限定前文对替换表数量与一次调用粒度的说明。来源 46、47 是 v0.26 与 main 的完整注册函数，分别证明旧 KDA 项存在与不存在；`v0.30.0` 及历史候选快照的完整注册范围见来源 33、106。main 条件登记的 KimiK3MultiHeadLatentAttentionWrapper 属于 MLA，不能用它证明 KDA 的旧注册项仍在。

| 要核对什么 | 固定源码位置 |
|---|---|
| 实例化时按类名换实现、构造时定死前向方法 | `vllm@0fc695fc:vllm/model_executor/custom_op.py#L109-L133` |
| 启用判断与 `forward_oot` / `forward_native` 的选择 | `vllm@0fc695fc:vllm/model_executor/custom_op.py#L174-L207` |
| 替换表的全部条目、KDA 与 FusedMoE 的版本门控 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L768` |
| 注册循环与进程内的「已注册」标记 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L818-L823` |
| Worker 初始化时的注册顺序、`COMPILE_CUSTOM_KERNELS` 警告 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L101-L120` |
| 扩展的懒加载、关掉的两个条件、导入失败的重试 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L452` |
| 归一化的两条路径 | `vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88` |
| 占位对象与它覆盖的融合名字 | `vllm-ascend@db701c1f:vllm_ascend/ops/__init__.py#L39-L55` |
| 按芯片型号选设备适配类 | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326` |
| 不量化的线性层、权重加载后转 NZ | `vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L83-L107` |
| W8A8 线性层的两步执行 | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125` |
| 残差混合的两个扩展调用 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169` |
| 一层里残差混合、归一化、注意力、MLP 的先后 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2213-L2240` |
| KDA 缺算子时的报错 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L157-L166` |
| KDA 的短卷积、decode 递推、prefill 分块 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331`；`#L355-L388`；`#L430-L475` |
| 稀疏 MLA 的生产调用点与投影收尾 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028` |
| 子类重写：校验视图、读取已登记 packed 缓存并交给设备适配层 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| A2 上稀疏注意力的实际参数与布局 | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| 稀疏注意力算子的 C++ 绑定与 aclnn 调用 | `vllm-ascend@db701c1f:csrc/torch_binding.cpp#L2848-L2860`；`vllm-ascend@db701c1f:csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h#L93-L149` |
| MC2 分发与合并、v2 算子的属性探测 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L108-L120`；`#L225-L240`；`#L329-L340` |
| 专家计算的三步算子及条件 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L113-L215` |
| 专家权重转置并转 NZ | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L366` |
| 四版 `register_ascend_customop`、A5 能力门控与 RMSNorm 残差演进 | `vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L821`；`vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L148-L166`；`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L544-L588`、`#L819-L955`、`device/hardware_profile.py#L250-L382`、`ops/layernorm.py#L81-L102`、`platform.py#L1376-L1378`；`vllm-ascend@8d6180e2:vllm_ascend/utils.py#L574-L618`、`#L846-L982`、`device/hardware_profile.py#L430-L501`、`ops/layernorm.py#L81-L120`、`platform.py#L1582-L1584` |
| `main` 配套上游 `CustomOp` / IR / `custom_ops` 校验 | `vllm@ba15685a:vllm/model_executor/custom_op.py#L102-L356`、`config/compilation.py#L1168-L1190`、`config/vllm.py#L1978-L1995`、`ir/op.py#L321-L360`、`config/kernel.py#L498-L523` |

**证据索引。** 本页每条结论的出处逐条列在上面的表里，表的行序就是来源清单的顺序：前九行对应四层结构与三套换实现的机制，中间十一行对应 GLM 一层里各站的算子，后四行是三个版本的对照点。

以下几条是由上述源码推出或属于本页的理解：沿一层走过哪些算子那张表，是把各调用点按模型文件里的先后顺序排出来的 [D]；形状、字节和通信次数不在本页重算，取自[一次请求](one-request.md)与主线底稿 02 的 §3.4、§4.2、§5.5、§6.6 [D]；算子调用与设备 kernel 启动属于不同层，Host 分块与设备核内循环的实例统一见[归一化执行链](op-to-ai-core.md)，不能用块数推出启动数 [D]；「多一层分派不等于多一次开销」由构造时定死前向方法推出 [D]；融合可能减少独立下发和中间访问，实际收益要按中间张量是否仍需写回、对照实现及设备测量判断 [I]。

**待核：**

- 缺 A2 上的 profiling：各类算子的实测耗时、分块策略（tiling）和实际 kernel 启动次数都没有实测数据，本页因此不写任何耗时与分块数字。
- 稠密 MLP 是否和共享专家一样命中带 SwiGLU 的融合分支，没有逐行跟到底；本页只写它走量化矩阵乘这一步。
- 占位对象覆盖的那几个融合名字，后续由哪条图改写路径消费，没有跟到消费者。
