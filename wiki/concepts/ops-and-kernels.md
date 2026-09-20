---
id: ops-and-kernels
title: 算子层与自定义算子
type: feature
summary: ops/ 用 CustomOp 注册把上游算子换成昇腾实现；再往下是 torch_npu，最底下是 csrc/ 编出来的自定义 aclnn 算子，绑在 torch.ops._C_ascend 上。
aliases: [ops, register_ascend_customop, aclnn, csrc, torch_npu, 自定义算子, _C_ascend]
chapters: ["16"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L21-L33
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L43-L54
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L403-L415
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L762
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L65-L126
  - vllm-ascend@2c59ff10:csrc/CMakeLists.txt#L191-L246
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L14
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 注意力是算子层最大的一个消费方，后端选完之后调到的就是这一层
  - to: one-request
    kind: builds-on
    note: 那条请求每层碰到的三个算子都停在 torch_npu 那一层，没下到 csrc/
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

`ops/` 是 v0.23 分支上文件最多的目录（89 个文件、23484 行）[D]，但它只做一件事：**把上游的算子实现换成昇腾的**。真正的计算在下面三层：`torch_npu`、`csrc/` 编出来的自定义 aclnn 算子、CANN 与 AI Core。

```wiki-diagram
file: ops-layers
```

## 那条请求走到这里

那条请求的一步 forward 要跑 28 层，每层至少碰到三个被换掉的算子：RMSNorm、旋转位置编码、SiLU 门控。它们都在 `ops/` 里有昇腾版本，走的是上游 `CustomOp` 注册那个正规口子 [C4]。

往下一层是 `torch_npu`——**绝大多数算子停在这里**，因为 CANN 已经提供了。再往下 `csrc/` 那层，只有 CANN 里没有、或者要做特定融合时才用得到。

所以那条请求的一次矩阵乘，真实路径是：`ops/` 里的昇腾实现 → `torch_npu` 的算子 → CANN → AI Core。**中间那层 `csrc/` 它多半一次都没碰到** [A]。

想看一个算子把这四层从头走到尾——包括决定要不要下到 `csrc/` 的那个 `if` 长什么样——见 [一个算子从 Python 走到 AI Core](op-to-ai-core.md)。

## 替换是靠 CustomOp 注册，不是靠 patch

`ops/__init__.py` 顶部是一串 `import`，把 `fused_moe`、`layernorm`、`register_custom_ops`、`vocab_parallel_embedding` 等模块拉进来，再从中导出 `AscendQuickGELU`、`AscendSiluAndMul`、`AscendRotaryEmbedding`、`AscendDeepseekScalingRotaryEmbedding` 四个类 [C1]。

注册动作在 `register_ascend_customop(vllm_config)`，它用的是上游 `vllm.model_executor.custom_op.CustomOp` 机制，并带 `_ASCEND_CUSTOMOP_IS_REIGISTERED` 全局量做幂等 [C4]。docstring 还给了一条约定：如果注册分支需要模型类型，要用 `vllm.config.get_current_vllm_config`，并保证在 model config 初始化之后执行 [C4]。

这一步在 `NPUWorker.__init__` 里调，紧跟在注册 ATB 扩展之后——而 ATB 那一步只在非 A5 的卡上做 [C5]。所以**算子替换和 patch 是两套不同的机制**：算子走上游留的 CustomOp 口子，patch 是上游没留口子时才用。

## `register_dummy_fusion_op` 是个占位层

`ops/__init__.py` 里还有一个 `register_dummy_fusion_op()`，它往 `torch.ops._C_ascend` 上挂了 8 个 `dummyFusionOp`：`rms_norm`、`fused_add_rms_norm`、三个 fp8 量化、以及三个 rms_norm 与量化的融合算子 [C2]。

它也在 `NPUWorker.__init__` 里被调，而且排在 `register_ascend_customop` 之前 [C5]。作用是让上游那些引用了融合算子的代码路径有东西可调——真实融合实现要么由图融合 pass 替换，要么走别的路径。看到 `dummyFusionOp` 不要以为是未完成的代码。

## 自定义 aclnn 算子的落点

官方设计文档把这条链路说得很清楚：自定义 aclnn 算子在 vllm-ascend 构建过程中被编译并安装到 `vllm_ascend/cann_ops_custom` 目录，然后绑定到 `torch.ops._C_ascend` 模块，Python 代码就能直接调；启用方式是 `from vllm_ascend.utils import enable_custom_op` 然后 `enable_custom_op()` [S7]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html)）。`enable_custom_op` 就在 `utils.py` 第 409 行 [C3]。

这解释了目录树里的一个疑点：`vllm_ascend/_cann_ops_custom/` 里没有任何 `.py` 文件 [D]——它是构建产物的落点，不是源码目录。源码在仓库根的 `csrc/` 下，`CMakeLists.txt` 里建了 `op_host_aclnn`、`op_host_aclnnInner`、`op_host_aclnnExc`、`opsproto` 等目标 [C6]。

## 四层分别在什么情况下动

| 层 | 什么时候要改它 |
|---|---|
| `ops/` 里的替换类 | 上游算子在昇腾上语义对但实现不优 |
| `torch_npu` | 不改；CANN 已经提供的算子直接调 |
| `csrc/` 自定义 aclnn | 需要的算子 CANN 里没有，或要做特定融合 |
| CANN / AI Core | 不改 |

判断顺序自上而下：能在 `ops/` 用现成 `torch_npu` 算子拼出来的，就不要下到 `csrc/`——后者要过完整的 CMake 构建，而 `COMPILE_CUSTOM_KERNELS` 关掉时这一层根本不编，源码里对此有明确警告：没有自定义 kernel，大多数场景下 vllm-ascend 无法正常工作 [C5]。什么情况下这笔账才划算，见 [一个算子从 Python 走到 AI Core](op-to-ai-core.md)。

## 常见误解

- **「算子替换也是 patch」**——不是。算子走上游 `CustomOp` 注册这个正规口子 [C4]，patch 是上游没留口子时的手段，两者机制与时机都不同。
- **「`dummyFusionOp` 是没写完」**——它是有意的占位层，让引用融合算子的上游路径有东西可调 [C2]。
- **「`_cann_ops_custom/` 是空目录说明这个特性没用上」**——那是构建产物的落点，源码在根目录的 `csrc/` [S7][D]。
