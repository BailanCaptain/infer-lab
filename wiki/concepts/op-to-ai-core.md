---
id: op-to-ai-core
title: 一个算子从 Python 走到 AI Core
type: concept
summary: 拿 RMSNorm 走一遍四层。最关键的一段是 ops/layernorm.py 里的一个 if——它两边一边是自己编的融合算子，一边是 CANN 现成的算子加一次额外的逐元素加法。
aliases: [算子链路, RMSNorm, AscendRMSNorm, AscendC, op_kernel, op_host, tiling, tiling key, UB, 算子四层]
chapters: ["16"]
order: 20
sources:
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L130-L207
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L186-L196
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L63-L88
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L409-L432
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L90-L126
  - vllm-ascend@2c59ff10:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.cpp#L30-L45
  - vllm-ascend@2c59ff10:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L12-L40
  - vllm-ascend@2c59ff10:csrc/CMakeLists.txt#L191-L215
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/add_custom_aclnn_op.md#L1-L14
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L142-L234
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L36-L51
  - vllm-ascend@2c59ff10:setup.py#L458-L464
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: ops-and-kernels
    kind: builds-on
    note: 那一页画的是四层地图和各层的职责，这一页拿一个真算子从最上面走到最下面
  - to: one-request
    kind: builds-on
    note: 走的是那条请求每一步都要跑 56 次的那个算子，次数和收益都按它算
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

挑一个最普通的算子——RMSNorm——从 Python 一路走到 AI Core。四层里真正需要做决定的只有一处：**`ops/layernorm.py` 里的一个 `if`**。它左边是自己写的融合算子，右边是 CANN 现成的算子外加一次额外的逐元素加法。

```wiki-diagram
file: op-to-ai-core
```

## 那条请求走到这里

[那条请求](one-request.md)每一步 forward 要跑 28 层，每层有两次 RMSNorm 走带残差的那条路（注意力前一次、MLP 前一次）——**一步 56 次，200 步 11200 次** [A]。（Qwen3 每层另有 `q_norm`、`k_norm` 两次 RMSNorm，输入里没有残差，走的是不经过下面那个 `if` 的另一条分支 [C11]。）

这个数字是读这一页的理由。单看一次调用，"少走一趟逐元素加法"听起来不值一提；乘以 11200 就不是了。**算子这一层的所有取舍都要乘以这个量级**，这也是为什么会有人愿意为一个 norm 去写一份 AscendC 核函数。

## 第一层：上游怎么知道要走昇腾这条路

vLLM 的 `RMSNorm` 继承 `CustomOp`，它的 `forward` 不是写死的，而是由 `dispatch_forward` 在构造时挑出来的 [C1]：

```python
if current_platform.is_out_of_tree():
    return self.forward_oot
else:
    return self.forward_cuda
```

**这就是 `NPUPlatform` 那份答卷的兑现处**——平台类回答"我是 out-of-tree"，换来的就是这一行分派。

还有一个容易漏的前提：这段分派前面先看 `enabled`，不启用就直接返回 `forward_native`，连 `forward_oot` 都不会走 [C1]。启用与否会记进 `compilation_config` 的 `enabled_custom_ops` / `disabled_custom_ops` [C2]，也就是说**算子替换是可以被配置整个关掉的**。排查"我的昇腾算子没生效"时，这是第一个要看的地方 [A]。

注册动作本身在 `NPUWorker.__init__` 里：先 `register_dummy_fusion_op()`，再按设备类型注册 ATB 扩展，然后 `register_ascend_customop(vllm_config)` [C5]。

## 第二层：ops/ 里那八行

`AscendRMSNorm.forward_oot` 的主体只有八行，四层的分界全在里面 [C3]：

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

**`torch.ops._C_ascend.` 开头的是自己编的，`torch_npu.` 开头的是 CANN 给的。** 这条命名约定在全仓一致，扫一眼前缀就知道这一行会掉到哪一层 [A]。这是读 `ops/` 下任何一个文件最省时间的一条 [A]。

## 那个 if 两边差了什么

差的是**一次 kernel launch 和一趟显存往返**。

- **真分支**：`npu_add_rms_norm_bias` 一次调用把三件事做完——加上残差、做 norm、加上 bias。
- **假分支**：`npu_add_rms_norm` 只做前两件，bias 得另起一行 `x.add_(self.bias)` [C3]。那是一次独立的逐元素算子：把整个 `x` 从 HBM 读进来、加一个数、再写回去。

这就是"什么时候值得下到 `csrc/`"这个问题的标准答案形态：**当你能把两次显存往返合成一次的时候。** 不是"自己写的更快"，是"少走一趟"。

顺带解释了 `register_dummy_fusion_op` 为什么存在——它把 `rms_norm`、`fused_add_rms_norm` 等八个融合算子的名字挂到 `torch.ops._C_ascend` 上，挂上去的是只有 `name` 和 `default = None` 的 `dummyFusionOp`，不是能算的实现 [C12]；上游按名字取这些属性的代码因此不会在查找上报错 [I]。

## enable_custom_op 什么时候会悄悄变成假

这个函数不只是读一个开关，它有三条会让你意外落到 CANN 那一侧的路径 [C4]：

- `VLLM_BATCH_INVARIANT` 打开时**全部关掉**——昇腾的自定义算子里有一部分不满足批不变性；
- 设备是 **A5** 时也全部关掉，源码里的 FIXME 挂了上游 issue 链接，说明是临时状态；
- 它做**懒初始化**，docstring 写明了理由：提前初始化会拉起 CANN 的 RTS 组件，那样 `ASCEND_RT_VISIBLE_DEVICES` 就没法在 `torch.npu.set_device()` 之前再改了。

前两条的后果很实际：**同一份代码在不同机器上会走不同的分支，而且不报错、只是慢一点** [D]。压测对不上时值得先打一行日志确认它返回的是真还是假 [A]。

## 第三层：csrc 下一个算子是四类文件

`csrc/moe/add_rms_norm_bias/` 这一个算子的目录里有十几个文件（CMakeLists、tiling 头、几份 kernel 模板头），撑起它的是固定的四类：

| 文件 | 在哪儿跑 | 干什么 |
|---|---|---|
| `op_host/*_def.cpp` | 构建期 | 声明算子原型：几个输入、几个输出 |
| `op_host/*_infershape.cpp` | 构建期 | 从输入形状推出输出形状 |
| `op_host/*_tiling.cpp` | **运行时的 CPU 上** | 算这一次怎么切：一趟搬多少元素进片上缓存 |
| `op_kernel/*.cpp` | **AI Core 上** | 真正的计算 |

**`tiling` 是这四个里最该先读的**：它不产生任何计算结果，只产生一份"怎么切"的参数，而这份参数决定了 kernel 走哪条模板。

## 第四层：tiling 里那些常量就是硬件

打开 `add_rms_norm_bias_tiling.cpp` 的开头，是一串长这样的常量 [C7]：

```cpp
constexpr uint32_t UB_USED = 1024;
constexpr uint32_t UB_FACTOR_B16 = 12288;
constexpr uint32_t UB_FACTOR_B32 = 10240;
constexpr uint32_t UB_FACTOR_B16_CUTD = 12096;
constexpr uint32_t UB_FACTOR_B32_CUTD = 9696;
```

`UB` 是 Unified Buffer，AI Core 上那块片上缓存。**这几个 `UB_FACTOR_*` 就是"一趟最多搬多少个元素"的上限**，16 位类型能塞 12288 个、32 位只能塞 10240 个——位宽一变，一趟能处理的量就变了，所以要分开写。带 `CUTD` 的那两个是"一行放不下、要沿 D 轴切开"时的上限，比不切还小一点，因为切开之后要多留一些临时空间。

kernel 那一侧据此分派 [C6]：

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

**tiling key 编码的是"数据类型 × 切法"**：个位是切法（0 不切、1 沿 D 切…），十位是 dtype（1=fp16、2=fp32、3=bf16）。那条请求用 bf16，所以它走的是 30 开头的那一族 [D]。

`__global__ __aicore__` 就是"这个函数在 AI Core 上跑"的标记；`TPipe` 管片上缓存的分配。到这一层为止，不再有 Python，也不再有 PyTorch。

顺带一提，bf16 那一支带一条 `#if !(defined(__NPU_ARCH__) && __NPU_ARCH__ == 3003)` [C6]——**有一代硬件在这里被整个排除掉了**。这类逐架构的例外在这一层很常见，是从上面几层完全看不见的东西。

## 什么时候该下到第三层

官方设计文档给的路径是：自定义 aclnn 算子在构建过程中编译并安装到 `vllm_ascend/cann_ops_custom`，然后绑定到 `torch.ops._C_ascend` 模块供 Python 调用 [S9]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/add_custom_aclnn_op.html)）。构建目标在 `csrc/CMakeLists.txt` 里 [C8]。

判断顺序还是自上而下 [A]：

1. 上游算子在昇腾上语义就不对 → 在 `ops/` 里换实现；
2. 语义对但要少走一趟显存 → 才考虑 `csrc/`；
3. CANN 已经有的 → 直接调，不要重写。

**这一层的门槛不在写 kernel，在构建**：`COMPILE_CUSTOM_KERNELS` 关掉时 `setup.py` 连这个 CMake 扩展都不挂上去 [C13]，而没有自定义 kernel，大多数场景下 vllm-ascend 无法正常工作 [C5]。

## 常见误解

- **「`torch_npu.` 和 `torch.ops._C_ascend.` 差不多」**——差一整层。前者是 CANN 编好的，后者是这个仓库自己编的，后者要过完整的 CMake 构建 [C3][C8]。
- **「自定义算子一定比 CANN 的快」**——它的收益来自融合，不是来自重写。融不掉多余的显存往返就不该下到这一层 [A]。
- **「`enable_custom_op()` 是个配置开关」**——它还会因为设备型号和批不变性模式自己变成假，而且不报错 [C4]。
- **「tiling 是性能调优的东西，可以先不看」**——它决定 kernel 走哪条模板，读 kernel 之前不看 tiling key 会不知道自己在读哪一支 [C6]。
