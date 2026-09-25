---
id: ops-and-kernels
title: 算子层与自定义算子
type: feature
summary: 上游给每类算子留了换实现的口子，昇腾把自己的版本挂上去；绝大多数换完调的还是现成算子，现成里没有的才自己编译，最底下由昇腾软件栈驱动 AI Core 真正计算。
aliases: [ops, register_ascend_customop, aclnn, csrc, torch_npu, 自定义算子, _C_ascend]
chapters: ["16"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L21-L33
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L43-L54
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L409-L419
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L766
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L65-L126
  - vllm-ascend@2c59ff10:csrc/CMakeLists.txt#L191-L246
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L20
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 注意力是算子层最大的一个消费方，后端选完之后调到的就是这一层
  - to: one-request
    kind: builds-on
    note: 那条请求每层碰到的算子几乎都停在 torch_npu 那一层，没下到 csrc/
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 四十层的计算，在昇腾上是谁算的

[那条请求](one-request.md)：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上。它每走一步都要把 40 层过一遍，每层里有归一化、注意力、挑专家、算专家等好几个[算子](matmul-and-weights.md)（算子就是 NPU 上真正执行的一小段计算，比如一次矩阵乘）。可这些算子最初都是对着别家的卡写的——换到昇腾上，它们是在哪一步被换掉的？换掉之后又是谁在算？

昇腾仓库里文件最多的那个目录只做一件事：**把上游的算子实现换成昇腾版**。但真正的计算不发生在它里面，而在它下面的三层。这一页讲这一摞四层怎么分工。

顺带说个叫法：有些资料把算子叫「kernel」。本库概念上一律叫**算子**；kernel 这个词只用来指自定义算子的那些实现文件。

## 一摞四层：换、调、编、算

```wiki-diagram
file: ops-layers
```

从上往下：

1. **替换层**：昇腾仓库自己的算子目录。上游某个算子在昇腾上语义对但实现不优，就在这里放一个昇腾版本把它换掉。
2. **现成算子**：PyTorch 的昇腾插件带来的算子，昇腾软件栈已经提供，直接调。**绝大多数替换版往下只到这一层**——它们做的事就是换成更合适的现成算子，或换一种调法。
3. **自定义算子**：现成的里没有、或者要把几个算子融成一个的时候，才自己写源码编译出一个新算子。
4. **昇腾软件栈与 AI Core**：真正的乘加发生在这里。上面三层只是在决定「让它算什么」。

所以那条请求的一次归一化，真实路径是：替换层里的昇腾实现 → 现成算子 → 昇腾软件栈 → AI Core。中间「自定义算子」那层，它多半一次都没碰到。

想看一个算子把这四层从头走到尾——包括决定要不要下到最底那层源码的判断长什么样——见[一个算子从 Python 走到 AI Core](op-to-ai-core.md)。

## 那条请求的每一层都有东西被换

那条请求每走一层，至少有三样已经是昇腾版本：进层的归一化、挑专家加算专家那一整套（见 [MoE](moe.md)），再加上这一层自己的注意力配套——10 层全注意力里的旋转位置编码，或 30 层[线性注意力](linear-attention.md)里的门控状态更新和带门控的归一化。这几样在昇腾的替换名单上都对得上号，名单原文见下半。

## 替换靠上游留的口子，不是靠补丁

上游 vLLM 给「换算子实现」留了一个正规口子：每类算子有一个注册点，硬件插件把自己的版本挂上去，模型建层的时候拿到的就是挂上去的版本。昇腾的替换全走这个口子，在启动早期由每个 worker 自动完成，还带了幂等保护——重复挂不会出事。

这和[补丁机制](ascend-patch-system.md)是两套东西：算子替换走的是上游留好的口子；补丁是上游没留口子时直接改上游行为的手段。两者机制和时机都不同，别混为一谈。

## 有一批占位算子，不是没写完

替换层启动时还会挂上 8 个「空壳」算子——只有名字、没有实现。它们的作用是让上游那些引用了融合算子的代码路径有东西可指：真实的融合实现要么由图融合那一步换进来，要么走别的路径。翻源码看到这批空壳，不要以为是没写完的代码。

## 看起来空的目录，是编译产物的落点

仓库里有个装自定义算子的目录，翻进去一个源码文件都没有。这不是特性没用上——它是**编译产物的落点**，不是源码目录。自定义算子的源码在仓库根的另一个目录下，构建时编译出来装进这个落点，再绑到一个统一的调用入口上，Python 代码就能直接调。

## 什么时候该动哪一层

| 层 | 什么时候要改它 |
|---|---|
| 替换层 | 上游算子在昇腾上语义对但实现不优 |
| 现成算子 | 不改；已经提供的直接调 |
| 自定义算子 | 需要的算子现成的里没有，或要做特定融合 |
| 昇腾软件栈 / AI Core | 不改 |

判断顺序自上而下：能在替换层里用现成算子拼出来的，就不要往下写自定义算子——下到那层要过完整的编译构建，而且相应的编译开关关掉时那一层根本不编，源码里对此有明确警告（原文见下半）。什么情况下这笔账才划算，见[一个算子从 Python 走到 AI Core](op-to-ai-core.md)。

## 常见误解

- **「算子替换也是补丁。」**——不是。替换走上游留的正规口子，[补丁](ascend-patch-system.md)是上游没留口子时才用的手段。
- **「那 8 个占位算子是没写完。」**——是有意的占位层，让引用融合算子的上游路径有东西可指。
- **「装自定义算子的目录是空的，说明这特性没用上。」**——那是编译产物的落点，源码在另一个目录。

## 对照源码

### 怎么开

- 算子替换不需要用户开：`NPUWorker.__init__` 里自动完成，顺序是 `adapt_patch()` → `ops.register_dummy_fusion_op()` → 非 A5 的卡才 `_register_atb_extensions()` → `register_ascend_customop(vllm_config)` [C5]（worker.py#L107-L118）。
- `register_ascend_customop` 用的是上游 `vllm.model_executor.custom_op.CustomOp` 机制，并带 `_ASCEND_CUSTOMOP_IS_REIGISTERED` 全局量（源码里就是这个拼写）做幂等 [C4]。docstring 给了一条约定：如果注册分支需要模型类型，要用 `vllm.config.get_current_vllm_config`，并保证在 model config 初始化之后执行。
- 自定义 aclnn 算子要显式启用：`from vllm_ascend.utils import enable_custom_op` 然后 `enable_custom_op()` [S7]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html)）。函数在 `utils.py` 第 409 行，docstring 说做成惰性初始化是为了避免过早初始化 CANN 的 RTS 组件，保证 `ASCEND_RT_VISIBLE_DEVICES` 在 `torch.npu.set_device()` 之前还能改 [C3]。
- `csrc/` 那层编不编由 `COMPILE_CUSTOM_KERNELS` 控制。

### 会报什么错

- `COMPILE_CUSTOM_KERNELS` 关掉时，`NPUWorker.__init__` 一进来就打 warning，原文：「COMPILE_CUSTOM_KERNELS is set to False. In most scenarios, without custom kernels, vllm-ascend will not function correctly.」（worker.py#L101-L105）。

### 开销和什么时候别开

- 判断顺序自上而下：能在 `ops/` 里用现成 `torch_npu` 算子拼出来的，就不要下到 `csrc/`——后者要过完整的 CMake 构建 [C6]。什么时候这笔账才划算，见[一个算子从 Python 走到 AI Core](op-to-ai-core.md)。

### 版本差异

- 本页讲的四件事——CustomOp 注册口子、`register_dummy_fusion_op` 挂的 8 个名字、`NPUWorker.__init__` 里的调用顺序、`csrc/` 那几个构建目标——在 v0.26 上逐行一致，变的只有规模：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `ops/` 的大小 | 89 个 `.py`、23484 行 | 96 个 `.py`、25737 行，另多了两份 `.md` 说明 [D] | 半年长了一成，它仍是 `vllm_ascend/` 下文件最多的目录；拿目录规模判断改动面时别用旧数 |

- 替换名单里 `FusedMoE → AscendFusedMoE` 这一条挂在 `vllm_version_is("0.23.0")` 分支下，只在配套上游是 0.23.0 时注册（utils.py#L763-L766）。

### 源码位置

- `vllm_ascend/ops/__init__.py` 顶部把 `fused_moe`、`layernorm`、`register_custom_ops`、`vocab_parallel_embedding` 等模块拉进来（有 Triton 时另加几个 triton 融合模块），并导出 `AscendQuickGELU`、`AscendSiluAndMul`、`AscendRotaryEmbedding`、`AscendDeepseekScalingRotaryEmbedding` 四个类（#L21-L33）。
- `register_dummy_fusion_op()` 往 `torch.ops._C_ascend` 上挂 8 个 `dummyFusionOp`：`rms_norm`、`fused_add_rms_norm`、三个 fp8 量化、以及三个 rms_norm 与量化的融合算子（#L43-L51）。
- 替换名单是 `REGISTERED_ASCEND_OPS`（utils.py#L735-L766）。上半那条请求每层碰到的几样对应：`RMSNorm → AscendRMSNorm`（归一化）、`RMSNormGated → AscendRMSNormGated`（线性注意力层带门控的归一化）、`GatedDeltaNetAttention → AscendGatedDeltaNetAttention`（线性注意力的门控状态更新）、`RotaryEmbedding → AscendRotaryEmbedding`（全注意力层的旋转位置编码）、`FusedMoE → AscendFusedMoE`（挑专家加算专家）。
- 模型侧数字：40 层、每 4 层 1 层全注意力共 10 层、其余 30 层线性注意力，出自官方 config 的 `num_hidden_layers: 40`、`full_attention_interval: 4` [S9]；这套形状的完整拆解见[那条请求](one-request.md)。
- 自定义 aclnn 算子构建时被编译并安装到 `vllm_ascend/cann_ops_custom` 目录，绑定到 `torch.ops._C_ascend` 模块 [S7]。检出的 `vllm_ascend/_cann_ops_custom/` 里没有任何 `.py` 文件 [D]——落点不是源码目录。源码在仓库根的 `csrc/` 下，每个算子一个文件夹，host 侧代码和 kernel 文件分别放 `op_host/`、`op_kernel/` 目录 [S7]；`CMakeLists.txt` 里建了 `op_host_aclnn`、`op_host_aclnnInner`、`op_host_aclnnExc`、`opsproto` 等目标（#L191-L246）。
