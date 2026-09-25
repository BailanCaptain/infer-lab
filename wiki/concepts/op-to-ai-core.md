---
id: op-to-ai-core
title: 一个算子从 Python 走到 AI Core
type: concept
summary: 拿那条请求里跑得最多的小算子——归一化——从 Python 一路追到 AI Core。四层里真正要做决定的只有一处分岔：一边是仓库自己编的融合算子，一边是 CANN 现成的算子再单独补一步。
aliases: [算子链路, AscendRMSNorm, AscendGemmaRMSNorm, npu_add_rms_norm_bias, AscendC, op_kernel, op_host, tiling, tiling key, UB, 算子四层]
chapters: ["16"]
order: 20
sources:
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L130-L207
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L186-L196
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L63-L88
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L409-L432
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L90-L126
  - vllm-ascend@2c59ff10:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.cpp#L30-L50
  - vllm-ascend@2c59ff10:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L19-L44
  - vllm-ascend@2c59ff10:csrc/CMakeLists.txt#L191-L215
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L14
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L31-L33
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L283-L284
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L379-L460
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L517-L541
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L91-L111
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L38-L47
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L162-L201
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L735-L762
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L36-L51
  - vllm-ascend@2c59ff10:setup.py#L458-L464
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L723
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: ops-and-kernels
    kind: builds-on
    note: 那一页画的是四层地图和各层的职责，这一页拿一个真算子从最上面走到最下面
  - to: one-request
    kind: builds-on
    note: 走的是那条请求每一步都要跑 80 次的那个算子，次数和收益都按它算
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一件每步要做 80 次的小事

[那条请求](one-request.md)每走一步，都在重复同一件小事：把残差加回去，再做一次归一化（就是[残差与归一化](mlp-residual-norm.md)那一页讲的 RMSNorm）。40 层每层两次——注意力前一次、MLP 前一次——一步 80 次，200 步走完是 **16000 次**。

单看一次，这件事小到不值得讨论；乘上 16000 就不是了。**算子这一层的所有取舍都要乘以这个量级**，这也是为什么会有人愿意为一个归一化去写一份跑在芯片上的核函数。这一页就拿它当探针，从 Python 一路跟到 AI Core，看[四层地图](ops-and-kernels.md)里每一层各干了什么。先剧透：四层里真正需要做决定的只有一处分岔——一边是这个仓库自己编的融合算子，一边是 CANN 现成的算子再单独补一步。

```wiki-diagram
file: op-to-ai-core
```

## 第一层：上游怎么把调用交给昇腾

上游 vLLM 给这类算子留了口子：它们「怎么算」不是写死的，而是构造的时候按平台挑。平台自报「我是树外插件」，上游就把计算交给平台带来的那份实现。昇腾接口子的动作发生在每颗卡的工作进程启动时：把一张「上游算子 → 昇腾实现」的对照表登记进去，我们这个模型用到的几种归一化都在表上。

还有一个容易漏的前提：这套替换有总开关，也能按算子单独点名启用或禁用。被关掉的算子连昇腾实现都不看，直接用上游自带的普通实现。排查「我的昇腾算子怎么没生效」，第一个该看的就是它。

## 第二层：一处分岔，两条路

接住这 16000 次调用的昇腾实现，主体只有几行，最要紧的是一处分岔：

- **一边**是仓库自己编的融合算子：一次调用做完三件事——加残差、归一化、加偏置；
- **另一边**是 CANN 现成的算子：只做前两件，偏置要单独再算一趟。

「单独再算一趟」的代价不在加法本身，在**多走一趟显存**：把整块数据从显存搬进来、每个数加一下、再搬回去。算得快得很，搬运才是大头。

不过先交代一句：偏置这东西只有某类量化模型才有，我们这条 bf16 请求没有偏置，两条路算出来的活其实一样多。这处分岔真正的受益者是带偏置的量化模型——在它们身上，走错一边，一条 200 步的回答就多出 16000 趟搬运。

这也是「什么时候值得自己编算子」的标准答案形态：**当你能把两趟显存往返合成一趟的时候**。不是「自己写的更快」，是「少走一趟」。

## 这个分岔会悄悄变卦

分岔问的是「自己编的算子能用吗」。答案不只看配置，有三种情况会让它悄悄变成「不能」：

- 打开了批不变性模式——自己编的算子里有一部分不满足[批不变性](batch-invariance.md)，索性全部关掉；
- 机器是 A5——这代设备上自定义算子目前被整个临时关闭；
- 这个答案是第一次用到时才现查的——提前查会把底层运行时拉起来，设备可见性的环境变量就再也改不了了。

前两条的后果很实际：**同一份代码在不同机器上走的分支不一样，而且不报错，只是慢一点**。压测数字对不上时，值得先打一行日志确认这个判断当时返回的是什么。

## 第三层：自己编一个算子，是四类文件

顺着分岔的左边往下，就出了 Python 的世界。仓库里一个自己编的算子是一个目录、十几个文件，撑起它的是固定的四类：

| 哪类 | 在哪儿跑 | 干什么 |
|---|---|---|
| 原型声明 | 构建期 | 几个输入、几个输出 |
| 形状推断 | 构建期 | 从输入形状推出输出形状 |
| 切分计划 | **运行时，CPU 上** | 这一次怎么切：一趟往片上缓存搬多少个数 |
| 核函数 | **AI Core 上** | 真正的计算 |

四类里**最该先读的是切分计划**：它不算出任何结果，只产出一份「怎么切」的参数——而这份参数决定核函数走哪条模板。

## 第四层：切分计划里写死的就是硬件

AI Core 上有一小块片上缓存，一趟能装下多少个数是写死在切分计划开头的常量：16 位的数一趟 12288 个，32 位的只有 10240 个——位宽翻倍，一趟能处理的量就变小，所以要分开写。一行数据长到一趟装不下时，还得沿最后一维切开处理，上限比不切还要小一点，因为切开之后要多留临时空间。

切分计划把「数据类型 × 切法」编成一个号码交给核函数，核函数按号码挑模板。我们的请求是 bf16，走的是 bf16 那一族模板。这一族里还藏着一条例外：**有一代硬件在这里被整个排除掉了**——这类逐架构的例外在这一层很常见，从上面几层完全看不见。

到这一层为止，不再有 Python，也不再有 PyTorch。

## 什么时候值得自己编

判断顺序自上而下：

1. 上游算子在昇腾上**语义就不对** → 在第二层换一份 Python 实现；
2. 语义对，但能**把几趟显存往返合成一趟** → 才考虑下到第三层自己编；
3. CANN **已经有**的 → 直接调，不要重写。

真正的门槛不在写核函数，在构建：自己编的那两层要过完整的编译构建才存在，而这套构建被关掉时，大多数场景下 vllm-ascend 根本无法正常工作——细节在下面对照源码里。

## 常见误解

- **「CANN 给的和仓库自己编的差不多。」**——差一整层：前者装好就能调，后者要过完整的编译构建才存在。
- **「自己编的算子一定比现成的快。」**——收益来自融合，不是来自重写。融不掉多余的显存往返，就不该下到那一层。
- **「那处分岔是个配置开关。」**——它还会因为设备型号和批不变性模式自己变卦，而且不报错。
- **「切分计划是性能调优的细节，可以先不看。」**——它决定核函数走哪条模板；不看它，连自己在读哪一支都不知道。

## 对照源码

### 怎么开

算子替换默认就开。上游 `RMSNorm` / `GemmaRMSNorm` 都继承 `CustomOp`，`forward` 不是写死的，由 `dispatch_forward` 在构造时挑出来 [C2]：

```python
if current_platform.is_out_of_tree():
    return self.forward_oot
else:
    return self.forward_cuda
```

分派前面先看 `enabled`：不启用就直接返回 `forward_native`，连 `forward_oot` 都不会走；启用与否记进 `compilation_config` 的 `enabled_custom_ops` / `disabled_custom_ops` [C1]，也就是说算子替换可以被配置整个关掉或按算子点名关掉。

注册动作在 `NPUWorker.__init__` 里：先 `register_dummy_fusion_op()`，再按设备类型注册 ATB 扩展（A5 跳过），然后 `register_ascend_customop(vllm_config)` [C5]。后者登记的对照表里有 `"RMSNorm": AscendRMSNorm`、`"GemmaRMSNorm": AscendGemmaRMSNorm` [C18]。Qwen3.6-35B-A3B 的层归一化类就是上游 `GemmaRMSNorm` 换了个名字（`Qwen3NextRMSNorm` 是它的导入别名 [C11]），所以 40 层的 `input_layernorm` / `post_attention_layernorm` 全落进 `AscendGemmaRMSNorm` [C13]。

`register_dummy_fusion_op` 把 `rms_norm`、`fused_add_rms_norm` 等八个融合算子的名字挂到 `torch.ops._C_ascend` 上，挂的是只有 `name` 和 `default = None` 的 `dummyFusionOp`，不是能算的实现 [C19]；上游按名字取这些属性的代码因此不会在查找上报错 [I]。

### 会报什么错

- 这条链路上几乎不报错，只有静默换路：`enable_custom_op()` 变假不打任何日志，走 CANN 那一侧照样能算，只是分岔的收益没了 [C4]。
- 唯一的显式提示在启动时：`COMPILE_CUSTOM_KERNELS` 关着的话，`NPUWorker.__init__` 打一条 warning——没有自定义 kernel，大多数场景下 vllm-ascend 无法正常工作。

### 开销和什么时候别开

那处 `if` 在 `AscendRMSNorm.forward_oot` 里 [C3]：真分支 `npu_add_rms_norm_bias` 一次做完 add + norm + bias；假分支 `torch_npu.npu_add_rms_norm` 做前两件，`self.bias is not None` 时补一行 `x.add_(self.bias)`——一次独立的逐元素算子，整个 `x` 从 HBM 读进来、加一个数、写回去。

但 `bias` 不是人人都有：`AscendRMSNorm.__init__` 只在量化配置带 `norm.bias`（anti_method m4 一类）时才创建它，否则是 `None` [C16]；我们这条 bf16 未量化请求走的 Gemma 变体更是直接传 `None` [C15]。所以**在这条请求上两条分支做的活一样多** [D]，分岔的收益属于带偏置的量化模型。

16000 的账 [D]：每层 `input_layernorm`、`post_attention_layernorm` 各一次，串在同一条残差链上；每步 forward 开头 `residual = None`，第一层的第一次走无残差分支，模型末尾另有一次带残差的收尾 norm [C14]——一步 40 × 2 − 1 + 1 = 80 次带残差调用，200 步共 16000 次。另有两类归一化不走这处分岔：10 层全注意力里的 `q_norm` / `k_norm` 输入不带残差 [C12]；30 层线性注意力里的门控归一化是 `AscendRMSNormGated`，走 triton 实现的另一条路 [C17]。

`enable_custom_op()` 有三条变假路径：`VLLM_BATCH_INVARIANT` 打开时全关（部分自定义算子不满足批不变性）；设备是 A5 时全关（FIXME 挂着上游 issue，临时状态）；它做懒初始化，docstring 写明理由——提前初始化会拉起 CANN 的 RTS 组件，`ASCEND_RT_VISIBLE_DEVICES` 就没法在 `torch.npu.set_device()` 之前再改了。

构建的门槛：`COMPILE_CUSTOM_KERNELS` 关掉时 `setup.py` 连 CMake 扩展都不挂上去 [C20]，构建目标在 `csrc/CMakeLists.txt` [C8]。官方设计文档给的路径：自定义 aclnn 算子在构建过程中编译并安装到 `vllm_ascend/cann_ops_custom`，然后绑定到 `torch.ops._C_ascend` 模块供 Python 调用 [S9]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html) [S10]）。

### 版本差异

两个发布分支上这条链路一致：v0.26.0rc 的对照表里同样是 `"GemmaRMSNorm": AscendGemmaRMSNorm` [C22]，`npu_add_rms_norm_bias` 的算子绑定也在。main 侧没有配套的上游检出，未逐行核对。

### 源码位置

`AscendRMSNorm.forward_oot` 的主体在 `vllm_ascend/ops/layernorm.py`，分岔全在里面：

```python
def forward_oot(self, x, residual=None):
    import torch_npu
    if residual is not None:
        residual = torch.ops.vllm.maybe_chunk_residual(x, residual)
        if enable_custom_op():
            x, _, residual = torch.ops._C_ascend.npu_add_rms_norm_bias(
                x, residual, self.weight, self.bias, self.variance_epsilon)
        else:
            x, _, residual = torch_npu.npu_add_rms_norm(
                x, residual, self.weight, self.variance_epsilon)
            if self.bias is not None:
                x.add_(self.bias)
        return x, residual
    ...
```

**`torch.ops._C_ascend.` 开头的是自己编的，`torch_npu.` 开头的是 CANN 给的。** 这条命名约定全仓一致，扫一眼前缀就知道这一行会掉到哪一层，这是读 `ops/` 下任何一个文件最省时间的一条 [A]。

`AscendGemmaRMSNorm` 在同文件下面：同一处 `if`、同一个自定义算子，差别只是按 Gemma 的约定把权重加一（`1.0 + self.weight`）再传进去，`bias` 传 `None`。

`csrc/moe/add_rms_norm_bias/` 目录里的四类文件，对应上半的说法：

| 文件 | 对应上半的 |
|---|---|
| `op_host/*_def.cpp` | 原型声明 |
| `op_host/*_infershape.cpp` | 形状推断 |
| `op_host/*_tiling.cpp` | 切分计划 |
| `op_kernel/*.cpp` | 核函数 |

`add_rms_norm_bias_tiling.cpp` 开头的常量：

```cpp
constexpr uint32_t UB_USED = 1024;
constexpr uint32_t UB_FACTOR_B16 = 12288;
constexpr uint32_t UB_FACTOR_B32 = 10240;
constexpr uint32_t UB_FACTOR_B16_CUTD = 12096;
constexpr uint32_t UB_FACTOR_B32_CUTD = 9696;
```

`UB` 是 Unified Buffer，AI Core 上那块片上缓存；`UB_FACTOR_*` 就是上半说的「一趟最多搬多少个元素」，带 `CUTD` 的是「一行放不下、要沿 D 轴切开」时的上限。kernel 一侧按 tiling key 分派：

```cpp
extern "C" __global__ __aicore__ void add_rms_norm_bias(...)
{
    TPipe pipe;
    GET_TILING_DATA(tilingData, tiling);
    if (TILING_KEY_IS(10))      GENERAL_OP_IMPL(KernelAddRmsNormBias, half);
    else if (TILING_KEY_IS(20)) GENERAL_OP_IMPL(KernelAddRmsNormBias, float);
    else if (TILING_KEY_IS(30)) GENERAL_OP_IMPL(KernelAddRmsNormBias, bfloat16_t);
    ...
}
```

这个算子的 tiling key 编码是「个位 = 切法（0 不切、1 沿 D 切……），十位 = dtype（1=fp16、2=fp32、3=bf16）」；那条请求用 bf16，走的是 30 开头的那一族 [D]。这套编码是各算子自己定的约定，不是 AscendC 的通例——同目录里 `inplace_partial_rotary_mul` 用 20010 这种五位数、`chunk_kda_fwd` 只用 1/2/3，读别的算子别拿这里的进位去套。

bf16 那一支带一条 `#if !(defined(__NPU_ARCH__) && __NPU_ARCH__ == 3003)`——上半说的「有一代硬件被整个排除」就是它。`__global__ __aicore__` 是「这个函数在 AI Core 上跑」的标记；`TPipe` 管片上缓存的分配。
