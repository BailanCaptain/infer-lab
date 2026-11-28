---
id: dev-new-model-and-custom-op
title: 新模型适配与自定义算子开发实战：权重映射、量化注册与三条 NPU 算子路径
type: concept
origin: direct
legacyAnchors:
  新模型接入昇腾的四道关口: 新模型接入昇腾的四个适配核查点
summary: >-
  串通新 HuggingFace 模型接入 vLLM Ascend 的架构注册、WeightsMapper、@register_scheme 量化注册与 OOT 分发，对比 torch_npu、AscendC 与 Triton-Ascend 三条算子路径及 950/310P 能力门控。
aliases:
  - 自定义算子开发
  - 新模型接入与算子开发
  - WeightsMapper
  - register_scheme
  - enable_custom_op
  - vllm_ascend_C
  - triton-ascend
  - AscendC 算子接入
  - HardwareProfile 能力门控
  - HAS_TRITON
  - RUNTIME_CUSTOM_OPS
  - fake_impl
  - torch_binding_meta.cpp
  - Meta 形状推导
chapters:
  - '16'
  - '20'
order: 35
sources:
  - 'vllm-ascend@c09d3e20:vllm_ascend/__init__.py#L106-L110'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/__init__.py#L1-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_mtp.py#L80-L95'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/registry.py#L20-L62'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L540-L585'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L815-L955'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/__init__.py#L18-L55'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/layernorm.py#L47-L124'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/triton/triton_utils.py#L13-L65'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L382'
  - 'vllm-ascend@c09d3e20:csrc/build_aclnn.sh#L35-L55'
  - 'vllm-ascend@c09d3e20:csrc/torch_binding_meta.cpp#L9-L55'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L33'
  - 'vllm@ced6857a:vllm/model_executor/models/utils.py#L47-L60'
  - 'vllm@ced6857a:vllm/model_executor/custom_op.py#L84-L105'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/registry.py#L20-L50'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/registry.py#L20-L50'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L430-L500'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/register_custom_ops.py#L225'
  - 'vllm@ced6857a:vllm/utils/torch_utils.py#L1096'
  - 'vllm@ced6857a:vllm/model_executor/custom_op.py#L330-L348'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L241-L250'
  - 'vllm@ced6857a:vllm/model_executor/layers/linear.py#L428-L436'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L227-L234'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/runner/moe_runner_interface.py#L19-L25'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_mtp.py#L230-L246'
  - 'vllm@ced6857a:vllm/model_executor/models/registry.py#L120-L125'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ops-and-kernels
    kind: builds-on
    note: 先理解 vLLM CustomOp 与昇腾 OOT 算子拦截的运行时机制，再按本页动手接入新算子
  - to: op-to-ai-core
    kind: builds-on
    note: 了解 Cube 与 Vector 核外搬运代价后，才能判断何时值得投入开发 AscendC 融合算子
  - to: platform-plugin-registration
    kind: builds-on
    note: 插件入口如何被 vLLM 发现并回调 register_model 与平台钩子见该页
  - to: quantization-methods
    kind: builds-on
    note: 常见昇腾量化格式（W8A8、MXFP8、FP8）的数学与权重布局见该页，本页聚焦方法注册接口
  - to: acl-graph
    kind: builds-on
    note: 新算子要进入 torch.compile 分段追踪必须补齐 Meta / fake_impl 形状推导，而在 torch.npu.graph 捕获回放期仍须满足运行期图捕获安全性，边界见该页
contradicts: []
updated: '2026-11-19'
---

拿到刚开源的 **HuggingFace**（主流模型权重与架构配置托管规范）新模型，或发现某层算子成为瓶颈时，新手最容易踩的坑是**直接把整份模型抄进 `vllm_ascend/models/` 并从头手写 C++ 核函数**。其实，只要上游 vLLM 已有标准 Transformer 实现（如 `Qwen3-8B`、`Qwen3-30B-A3B`），插件的 **OOT（Out-of-Tree，树外扩展）**算子表就能自动在 NPU 上接管算子，根本不必重复维护一套模型文件。

本页以标准模型复用与算子选型为主线，分三步走通接入决策。第一步优先复用上游模型结构，只在缺失架构、兼容旧别名、定制前后处理，或需覆写昇腾并行、元数据与权重过滤逻辑时补充模型类注册。第二步用标准映射器与方案注册表对齐权重键名和量化格式。第三步只针对真实缺口或热点，在 `torch_npu`、AscendC 与 `triton-ascend` 三条算子路径间按维护代价与控制粒度选型。不同代际芯片的兼容约束与惰性加载门控统一收束在后半段专题节对照。

## 新模型接入昇腾的四个适配核查点

把新模型加载进 NPU 显存并跑通前向，涉及模型注册表、权重加载器、量化方案表和 OOT 算子分发四个适配核查点。注意这四项只是工程适配清单，插件导入、`CustomOp` 注册、建空模型与读取 `safetensors` 权重并非每次按 1→4 固定串行执行。入口分工与跨进程时机见[请求调用链的插件接入站](request-call-chain.md#vllm-ascend-从六个口子接进-vllm)与[平台插件注册](platform-plugin-registration.md#跨进程的插件注册为什么要各做一遍)；多模态视觉预算与缓存边界见[多模态视觉编码与特征缓存](multimodal-encoder-cache.md#vit-预算打包与昇腾-encoderaclgraphmanager-图捕获回放)：

```wiki-diagram
file: custom-op-fig-model-onboarding
```

1. **架构名登记（`ModelRegistry.register_model`）**：vLLM 启动时读取 `config.json` 的 `architectures` 字段，并在 `ModelRegistry` 里找对应 Python 类。需在 `vllm_ascend/models/__init__.py` 的 `register_model()` 显式补充或覆写上游的情形主要有四类（非穷尽）。一是上游未合入该架构（如早期 `DeepseekV41ForCausalLM`、`KimiK3ForCausalLM`）；二是需要兼容历史权重里的旧 checkpoint 架构别名。三是需要注入昇腾专属多模态预处理或投机解码草拟头（如 `AscendQwen3_5ForConditionalGeneration`、`AscendQwen3DSparkForCausalLM`）。四是上游 `registry.py` 虽已登记标准文本架构，仍需覆写以接管昇腾并行或权重清理。例如 `GlmMoeDsaForCausalLM` 会覆写为 `AscendGlmMoeDsaForCausalLM`，以改走 `AscendDSACPModel`、记 PP `num_moe_layers` 并丢弃 `"rot."`。其余标准模型直接留给上游类实现即可。
2. **权重键名映射（`WeightsMapper` + `AutoWeightsLoader`）**：不同发布方的权重前缀常与 vLLM 子模块树不同。常见情况包括多出 `backbone.`、要把分离投影合并为 `qkv_proj`，或处理投机层旋转键 `rot.`。例如 `AscendDeepSeekMTP` 将 `"rot."` 重映射到 `f"model.layers.{self.config.num_hidden_layers}.rot."` 并在 `_rewrite_spec_layer_name` 还原；同文件 `AscendGlmMoeDsaForCausalLM` 则将 `"rot."` 映为 `None` 丢弃。别手写脆弱的替换循环。直接用上游 `WeightsMapper` 声明 `orig_to_new_prefix`（`None` 丢弃无用键）或 `orig_to_new_substr`。随后交给 `AutoWeightsLoader.load_weights(..., mapper=...)` 完成打包与切分加载。
3. **量化方案注册（`@register_scheme`）**：昇腾量化把配置解析与方案表解耦。每种组合按 `(quant_type, layer_type)` 经 `@register_scheme` 登记进 `_SCHEME_REGISTRY`（如 `("W8A8_DYNAMIC", "linear")` / `"moe"`）。运行期调用 `get_scheme_class(quant_type, layer_type)` 即可拿到对应线性层或 MoE 方案类，避免前向堆砌硬件分支（见 [量化方法与布局](quantization-methods.md)）。
4. **OOT 算子拦截（`register_ascend_customop`）**：基础算子如 `RMSNorm`、`SiluAndMul` 与 `RotaryEmbedding` 继承自上游 `CustomOp`。而 `ColumnParallelLinear`（`-> LinearBase`）与 `MoERunner`（`-> MoERunnerInterface`）均继承自 `PluggableLayer` 接口族。`vllm_ascend/utils.py` 的 `register_ascend_customop()` 按硬件能力档案组装 `REGISTERED_ASCEND_OPS`。随后它循环调用 `CustomOp.register_oot(_decorated_op_cls=op_cls, name=name)` 注册昇腾实现（原理见 [算子与内核分发](ops-and-kernels.md)）。若检测到 `310P`（支持 `COMPATIBILITY_OP_IMPLEMENTATIONS`），它会自动将 `RMSNorm`、`MoERunner` 等覆写为 `vllm_ascend/_310p/` 下的兼容子类。

## 三条自定义算子路径如何选型？

当内置 PyTorch 算子出现瓶颈，或遇到新架构特有数学形式时，`vllm-ascend` 提供三条算子落地路径。瓶颈常表现为小算子往返显存或 Host 下发空泡（见[算子如何落到 AI Core](op-to-ai-core.md)与[昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）：

```wiki-diagram
file: custom-op-fig-three-paths
```

把三条路径的工程成本、调试难度与图模式要求放在一起对照：

| 对比维度 | 路径 1：`torch_npu`（ACLNN / ATB） | 路径 2：`AscendC`（`vllm_ascend_C`） | 路径 3：`triton-ascend` |
|---|---|---|---|
| 调用与源码位置 | Python 直接调用 `torch_npu.npu_*` 或 ATB 扩展 | `csrc/` 下编写 `op_host` / `op_kernel`，经 `torch_binding.cpp` 暴露到 `torch.ops._C_ascend` | `vllm_ascend/ops/triton/` 纯 Python `@triton.jit` 核函数 |
| 构建与交付代价 | **零 C++ 编译**，跟随 `torch_npu` 与 CANN 发版 | 须接入 `csrc/build_aclnn.sh` 按 SoC 编译并维护 `csrc/cmake/func.cmake` 构建缓存键 | **零 C++ 编译**，运行时即时编译（JIT），依赖环境中安装 `triton-ascend` |
| 性能控制粒度 | 依赖 CANN 既有算子覆盖，无法把任意两段业务逻辑焊死在同一核内 | **最高**：可直控 AI Core 的 Cube/Vector 流水、L1/L0/UB 切块与通信融合（如 SFA、融合 MC2） | **中高**：可灵活编写逐元素、规约、块表索引与 QKV 拆切融合，但受片上 **UB**（Unified Buffer，向量核片上统一缓存）容量限制 |
| 图捕获 / `torch.compile` 要求 | 原生支持，通常无需手写形状推导 | **两道独立门槛**：① 构图追踪须在 `csrc/torch_binding_meta.cpp` 补齐 Meta 实现（仅对 `FakeTensor` 推导形状与 dtype，不分配真实计算）；② 要进入 `torch.npu.graph` 运行期整图捕获（[ACL Graph](acl-graph.md)），真实 kernel 本身还须满足捕获流安全性（不含受限主机同步/`rtMemcpy` 等） | ① 构图追踪经 `direct_register_custom_op` 配 `fake_impl` 完成 `FakeTensor` 形状推导；② 运行期仍须确保生成的 Triton kernel 满足 NPU 图捕获安全性 |
| 典型适用场景 | RMSNorm、FIA、标准量化矩阵乘、常规激活 | 极致热点融合（`npu_add_rms_norm_bias`、稀疏 MLA/SFA、分组矩阵乘 + SwiGLU 量化） | 块表 `slot_mapping` 计算、`split_qkv_rmsnorm_rope` 融合、批不变确定性算子 |

三条路径的黄金顺序很明确：**能调 `torch_npu` ACLNN/ATB 绝不造轮子。** 遇非标融合且逻辑偏访存或索引时，优先用 `triton-ascend` 快速验证。只有经 profiling 证实为核心热点、且须精细协同 Cube/Vector 或做通信融合时，才下沉到 `csrc/` 写 AscendC 算子。

## 950（A5）与 310P 的硬件能力门控：千万别硬编码芯片名

`v0.30.0` 将历史零散的芯片型号判断统一重构为 `HardwareProfile` 不可变能力档案。新增算子或模型分支时，**严禁写 `if soc == "Ascend950"` 这类型号硬编码**，而应查询 `get_current_hardware_profile().supports(HardwareCapability.XXX)`：

```wiki-diagram
file: custom-op-fig-hardware-profile-gate
```

两类最容易踩坑的门控如下：

1. **昇腾 950（`AscendDeviceType.A5`）上的 `vllm_ascend_C` 惰性加载门控**：调用 `csrc/` 算子前必须先调 `enable_custom_op()` 并检查其返回值。它通过惰性加载避免过早初始化 CANN RTS，保留动态修改 `ASCEND_RT_VISIBLE_DEVICES` 的窗口。同时它把守两道硬闸门：开启批不变模式（`VLLM_BATCH_INVARIANT=1`，见 [批不变性](batch-invariance.md)），或硬件档案不含 `HardwareCapability.RUNTIME_CUSTOM_OPS` 时，均直接返回 `False`。在 `v0.30.0` 中，950（A5）档案尚未包含 `RUNTIME_CUSTOM_OPS`（自定义库仍在适配期）。注意 `AscendRMSNorm.forward_oot` 在 `residual` 分支调 `enable_custom_op()` 却未判返回值，会直接调用自定义库而报错。新写算子须遵循 `AscendGemmaRMSNorm.forward_oot` 双分支规范。具体写成 `if enable_custom_op(): ... else: torch_npu.npu_add_rms_norm(...)`（`main` 分支中 A5 已补回该能力）。
2. **昇腾 310P（`AscendDeviceType._310P`）的兼容算子表与 Triton 缺省**：310P 档案同时开启两项约束。它用 `COMPATIBILITY_OP_IMPLEMENTATIONS` 将算子批量换为 `Ascend*310` 子类，并用 `WeightLayoutPolicy.FORCE_NZ` 强制 `FRACTAL_NZ` 排布。此外，310P 与纯 CPU 单测环境常不装 `triton-ascend`。代码注释指出老 310P 物理 UB 为 `128 KB`（A2/A3 为 `192 KiB`）。`triton_utils.py` 以 `4 KiB`（`4 * 1024`）过滤异常驱动哨兵值，探测失败或低于 `4 KiB` 时回退 `192 KiB`（`192 * 1024`）。因此引入 Triton 核的模块必须在导入期判 `HAS_TRITON` 并留回退。解析 CANN 专属 Triton 原语（如 `insert_slice`）则应走 `triton_utils._resolve_triton_ascend_op` 兼容各版本。

## 常见误解

- **误解一：“要适配一个新开源模型，必须先在 `vllm_ascend/models/` 下抄一份完整建模代码。”**
  错。只要上游 vLLM 已支持该架构，昇腾插件会自动通过 `register_ascend_customop()` 拦截标准层（Norm、RoPE、Linear、MoE）并换为 NPU 实现。只有在架构未合入上游、需兼容旧别名、有专属前后处理，或需覆写并行、层计数与权重清理（如 `GlmMoeDsaForCausalLM`）时，才在 `vllm_ascend/models/` 注册或覆写。
- **误解二：“AscendC 自定义算子只要把 `op_host` / `op_kernel` 编译通过并绑到 `torch.ops._C_ascend` 就大功告成了。”**
  还差两道独立关口。首先未往 `csrc/torch_binding_meta.cpp` 注册 Meta 形状推导函数时，切入 `torch.compile` 构图会因 `FakeTensor` 推导失败报错。其次即便过了构图追踪，进入 [ACL Graph](acl-graph.md) 捕获（`torch.npu.graph`）仍要求 kernel 满足捕获流安全性（不含受限同步或拷贝）。
- **误解三：“既然 A2/A3 上 `torch.ops._C_ascend` 能跑，我在新模型里直接 `import vllm_ascend.vllm_ascend_C` 调用就行。”**
  危险。过早导入会提前初始化 CANN RTS，破坏多卡可见设备重映射。另外在 `v0.30.0` 的昇腾 950（A5）与 `VLLM_BATCH_INVARIANT=1` 场景下，`enable_custom_op()` 会关闭自定义库，未判返回值的直调路径会报错或破坏批不变性。
- **误解四：“`triton-ascend` 在所有昇腾卡上都随时可用，且按 A2 的 `192 KiB` UB 写死块大小就行。”**
  错。310P 常未安装 `triton-ascend` 且片上 UB 较小（注释记为 `128 KB`），老驱动还可能返回 `1` 这类异常 UB 属性值。`triton_utils.py` 以 `4 KiB` 为合法下界过滤异常值（否则回退 `192 KiB`）；跨代核函数必须配合 `HAS_TRITON` 守卫与该安全探测逻辑编写。

## 对照源码

### 怎么开与最小接入骨架

```python
# 1. 在 vllm_ascend/models/__init__.py 登记新架构（仅上游缺失或需昇腾覆写时）
from vllm import ModelRegistry
ModelRegistry.register_model(
    "MyCustomForCausalLM",
    "vllm_ascend.models.my_custom:AscendMyCustomForCausalLM",
)

# 2. 在模型类中按需使用 WeightsMapper + AutoWeightsLoader 映射前缀（以 deepseek_mtp.py 移入层前缀为例）
from vllm.model_executor.models.utils import WeightsMapper
mapper = WeightsMapper(
    orig_to_new_prefix={"rot.": f"model.layers.{self.config.num_hidden_layers}.rot."}
)
# 注：仅在确需丢弃无关前缀时才将某前缀映射为 None（如 {"unused.": None}）

# 3. 接入新量化方案：按 (quant_type, layer_type) 注册到全局方案表
from vllm_ascend.quantization.methods.registry import register_scheme
@register_scheme("MY_QUANT", "linear")
class MyQuantLinearScheme:
    ...

# 4. 在 OOT 算子 forward_oot 内保护自定义库回退（兼容 950 / 批不变模式）
from vllm_ascend.utils import enable_custom_op
if enable_custom_op():
    out = torch.ops._C_ascend.my_fused_op(x)
else:
    out = torch_npu.npu_rms_norm(x, weight, eps)[0]
```

- **核验模型与量化注册入口**：插件总入口 `vllm_ascend/__init__.py::register_model()` 转发到 `vllm_ascend/models/__init__.py` 调用 `ModelRegistry.register_model`（来源 1–2）；权重前缀改名或过滤复用上游 `WeightsMapper`[C14]（`AscendDeepSeekMTP` 在 `deepseek_mtp.py#L81-L92` 将 `"rot."` 重映射到 `f"model.layers.{self.config.num_hidden_layers}.rot."` 并在 `_rewrite_spec_layer_name` 还原，见来源 3；而同文件 `AscendGlmMoeDsaForCausalLM` 在 `#L230-L246` 使用 `{"rot.": None}` 丢弃该前缀，见来源 26）；量化方案通过 `@register_scheme(quant_type, layer_type)` 登记到 `_SCHEME_REGISTRY` 并由 `get_scheme_class` 查表[C4]。
- **核验 OOT 分发与三条算子路径**：`vllm_ascend/utils.py::register_ascend_customop()` 汇总 `REGISTERED_ASCEND_OPS`，在检测到 `HardwareCapability.COMPATIBILITY_OP_IMPLEMENTATIONS`（310P）时批量替换为 `Ascend*310` 子类，再循环调用上游 `CustomOp.register_oot`（`custom_op.py#L339`，来源 21）[C6]；注意基础算子继承 `CustomOp`（来源 15），而 `ColumnParallelLinear -> LinearBase -> PluggableLayer`（来源 22–23）与 `MoERunner -> MoERunnerInterface -> PluggableLayer`（来源 24–25）继承 `PluggableLayer` 体系。`AscendGemmaRMSNorm.forward_oot`（`layernorm.py#L113`）展示了标准 `if enable_custom_op(): torch.ops._C_ascend.* else: torch_npu.*` 双分支回退，对比 `AscendRMSNorm.forward_oot`（`layernorm.py#L88-L95`）在 `residual` 路径上未判返回值直调自定义库的写法[C8]；AscendC 算子按官方文档五步法接入 `csrc/`、`csrc/build_aclnn.sh`、`csrc/torch_binding.cpp` 与 `csrc/torch_binding_meta.cpp`（并维持 CMake 构建缓存契约，来源 11–12）[S13]；Triton 核集中在 `vllm_ascend/ops/triton/`，在 `HAS_TRITON` 为真时导入，并经 `triton_utils.py` 以 `4 KiB`（`4 * 1024`）作为合法 UB 探测下界、异常时回退 `192 KiB`（`192 * 1024`，注释说明老 310P 物理 UB 为 `128 KB`）并解析 CANN 扩展原语（来源 7、9）。具体自研融合核相比 `torch_npu` 组合的真实加速比受算子形状、带宽与驱动版本影响，须以同配置实机 profiling 数据为准[I]。

### 会报什么错

| 触发场景 | 报错现象 | 根因与修法 |
|---|---|---|
| 同一 `(quant_type, layer_type)` 被两个量化方案重复装饰 | `ValueError: Scheme already registered for ...` | 避免重复注册或拆分独立 `quant_type` 键（来源 4） |
| `v0.30.0` 在昇腾 950（A5）或 `VLLM_BATCH_INVARIANT=1` 下未检查 `enable_custom_op()` 返回值直调 `torch.ops._C_ascend` | `AttributeError` 或 `RuntimeError`（算子未注册进 `torch.ops._C_ascend`） | 遵循 `AscendGemmaRMSNorm` 范式，改用 `if enable_custom_op(): ... else: torch_npu.*` 双路径回退（来源 5、8） |
| 310P 或无 Triton 环境未做 `HAS_TRITON` 守卫直接调用 `_resolve_triton_ascend_op` | `RuntimeError: Triton op '...' cannot be resolved because HAS_TRITON is False` | 模块导入与运行前均加 `if HAS_TRITON:` 守卫并提供非 Triton 回退（来源 7、9） |
| 新增 AscendC 或 Python 自定义算子未注册 Meta / `fake_impl` 推导，或运行期算子不满足图捕获安全性 | 构图追踪期报 `There was no fake impl registered for ...` / Meta dispatch 缺失；已注册 `FakeTensor` 但含受限同步或主机拷贝时，在 `torch.npu.graph` 运行期捕获报错 | 构图追踪层按 `csrc/torch_binding_meta.cpp` 顶部规范或 `direct_register_custom_op(..., fake_impl=...)` 补齐 `FakeTensor` 推导（来源 12、13、19、20）；运行期捕获层另须核对 [ACL Graph](acl-graph.md) 对捕获流安全性的约束 |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 硬件能力门控机制 | 零散 `is_310p()` / 芯片类型分支判断 | 仍以芯片枚举函数分散判断 | 引入不可变 `HardwareProfile` 与 `HardwareCapability` 四家族档案（A2/A3/310P/A5，来源 10） | 延续 `HardwareProfile` 架构并扩充 `native_weight_formats` 等语义能力 |
| 昇腾 950（A5）的 `vllm_ascend_C` 支持 | `enable_custom_op()` 按 `AscendDeviceType.A5` 直接置 `_CUSTOM_OP_ENABLED = False` 并早退，不加载 `vllm_ascend_C`（`2c59ff10:vllm_ascend/utils.py#L426-L428`） | 延续 `A5` 早退分支：同样在加载 `vllm_ascend_C` 前直接置 `_CUSTOM_OP_ENABLED = False` 并返回 `False`（`2ed6cbba:vllm_ascend/utils.py#L418-L420`） | A5 档案不含 `RUNTIME_CUSTOM_OPS`，`enable_custom_op()` 返回 `False`（来源 5） | A5 档案补回 `RUNTIME_CUSTOM_OPS`，恢复自定义库默认加载（来源 18） |
| 量化方案注册与目录 | `@register_scheme` 注册表已建立（来源 16），配置类平铺于 `quantization/` | 延续 `@register_scheme` 注册表（来源 17） | 延续 `@register_scheme`，量化配置下沉至 `quantization/configs/`，新增 `prepared_linear_input` 抽象 | 延续注册表架构，进一步收敛原生分块 FP8 硬件门控 |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–27 项（源码项为 `C1`–`C12`、`C14`–`C27`，官方文档项为 `S13`）：

- 来源 1（C1）：`vllm-ascend@c09d3e20:vllm_ascend/__init__.py#L106-L110` — 插件 `register_model` 总入口。
- 来源 2（C2）：`vllm-ascend@c09d3e20:vllm_ascend/models/__init__.py#L1-L85` — `ModelRegistry.register_model` 登记昇腾定制与覆写模型架构。
- 来源 3（C3）：`vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_mtp.py#L80-L95` — `AscendDeepSeekMTP` 通过 `WeightsMapper` 将 `"rot."` 重映射到层前缀并在 `_rewrite_spec_layer_name` 还原的源码示例。
- 来源 4（C4）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/registry.py#L20-L62` — `@register_scheme` 与 `get_scheme_class` 全局量化方案注册表。
- 来源 5（C5）：`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L540-L585` — `enable_custom_op()` 惰性加载、`VLLM_BATCH_INVARIANT` 与 `RUNTIME_CUSTOM_OPS` 双重门控。
- 来源 6（C6）：`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L815-L955` — `register_ascend_customop()` 组装 `REGISTERED_ASCEND_OPS`、310P 覆写与 `CustomOp.register_oot` 循环。
- 来源 7（C7）：`vllm-ascend@c09d3e20:vllm_ascend/ops/__init__.py#L18-L55` — `HAS_TRITON` 条件导入 Triton 算子与占位融合算子注册。
- 来源 8（C8）：`vllm-ascend@c09d3e20:vllm_ascend/ops/layernorm.py#L47-L124` — `AscendRMSNorm`（`#L88-L95` 残差路径未判返回值直调）与 `AscendGemmaRMSNorm`（`#L113` 标准 `if enable_custom_op():` 回退）。
- 来源 9（C9）：`vllm-ascend@c09d3e20:vllm_ascend/ops/triton/triton_utils.py#L13-L65` — `4 KiB`（`4 * 1024`）探测下界、`192 KiB`（`192 * 1024`）默认回退、注释提及老 310P `128 KB` 及 `_resolve_triton_ascend_op`。
- 来源 10（C10）：`vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L382` — `310P`（`COMPATIBILITY_OP_IMPLEMENTATIONS` / `FORCE_NZ`）与 `A5`（未含 `RUNTIME_CUSTOM_OPS`）能力档案。
- 来源 11（C11）：`vllm-ascend@c09d3e20:csrc/build_aclnn.sh#L35-L55` — 按算子类别目录解析与构建 `CUSTOM_OPS`。
- 来源 12（C12）：`vllm-ascend@c09d3e20:csrc/torch_binding_meta.cpp#L9-L55` — 自定义 AscendC 算子 Meta `FakeTensor` 形状推导规范与示例。
- 来源 13（S13）：`vllm-ascend@c09d3e20:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L33` — 新增自定义 ACLNN/AscendC 算子五步接入文档与构建缓存契约。
- 来源 14（C14）：`vllm@ced6857a:vllm/model_executor/models/utils.py#L47-L60` — 上游 `WeightsMapper` 定义。
- 来源 15（C15）：`vllm@ced6857a:vllm/model_executor/custom_op.py#L84-L105` — 上游 `CustomOp` 定义（其 `register_oot` 实现位于同文件来源 21 `#L339`）。
- 来源 16–18（C16–C18）：`v0.23.0`（`2c59ff10`）与 `v0.26.0rc`（`2ed6cbba`）量化注册表延续性，以及 `main`（`8d6180e2`）A5 补齐 `RUNTIME_CUSTOM_OPS` 对照。
- 来源 19（C19）：`vllm-ascend@c09d3e20:vllm_ascend/ops/register_custom_ops.py#L225` — Python 自定义算子通过 `direct_register_custom_op(..., fake_impl=...)` 注册假实现。
- 来源 20（C20）：`vllm@ced6857a:vllm/utils/torch_utils.py#L1096` — 上游 `direct_register_custom_op` 在提供 `fake_impl` 时执行 `my_lib._register_fake(op_name, fake_impl)`。
- 来源 21–27（C21–C27）：`CustomOp.register_oot` 方法定义（`custom_op.py#L330-L348`）、`ColumnParallelLinear -> LinearBase -> PluggableLayer`（`linear.py#L241,#L430`）、`MoERunner -> MoERunnerInterface -> PluggableLayer`（`moe_runner.py#L227`、`moe_runner_interface.py#L19`）继承链、`AscendGlmMoeDsaForCausalLM.load_weights` 使用 `WeightsMapper({"rot.": None})` 丢弃前缀（`deepseek_mtp.py#L230-L246`，来源 26），以及上游已登记 `GlmMoeDsaForCausalLM` 而被来源 2 第 74 行覆写（`registry.py#L120-L125`，来源 27）。
