---
id: ops-and-kernels
title: 算子与 kernel：从数学语义到设备实现
type: feature
summary: 模型里的一次运算怎样经框架替换表、量化方法或模型自己的调用，落到 torch_npu 已有算子或仓库自编译扩展，再经 CANN 下发成设备 kernel；并沿 GLM 双机的一层列出各站的实际算子。
aliases: [ops, register_ascend_customop, aclnn, csrc, torch_npu, 自定义算子, _C_ascend, CustomOp, kernel, 核函数]
chapters: ["16"]
order: 10
sources:
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L109-L133
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L174-L207
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L768
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L818-L823
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L101-L120
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L452
  - vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88
  - vllm-ascend@db701c1f:vllm_ascend/ops/__init__.py#L39-L55
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear.py#L83-L107
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2213-L2240
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L157-L166
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L430-L475
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793
  - vllm-ascend@db701c1f:csrc/torch_binding.cpp#L2848-L2860
  - vllm-ascend@db701c1f:csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h#L93-L149
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L108-L120
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L225-L240
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L329-L340
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L366
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L700
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L148-L166
  - vllm-ascend@baa023ad:vllm_ascend/ops/layernorm.py#L64-L82
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L495-L505
verified: []
evidence: "C"
relations:
  - {to: matmul-and-weights, kind: builds-on, note: 先理解矩阵运算的输入输出}
  - {to: attention-backend-family, kind: builds-on, note: 后端选择决定注意力落到哪个算子}
  - {to: quantization, kind: builds-on, note: W8A8 的量化方法决定线性层调哪个算子}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一次矩阵乘，到底是谁在算？

模型代码里写的是「一次 RMSNorm、一次 Linear」。这一行 Python 要到昇腾卡上真正开始算，中间还要转手三四次：先决定这个模块换成谁的实现，再决定这份实现调哪个算子接口，接着由 CANN（昇腾的算子运行库）挑分块、排任务，最后才在设备上启动一段叫 kernel 的程序。

先把两个词分开。**op（算子）**是对一类运算的接口与语义约定：叫什么名字、吃什么形状、出什么形状，比如「矩阵乘」「RMSNorm」。**kernel（核函数）**是设备上真正跑的那段程序，它要处理搬数据、分块、循环这些事。一个算子可以启动多个 kernel，多个数学运算也可以融合进一个 kernel——所以「模型里有多少次运算」和「设备上启动了多少次 kernel」不是同一个数。

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
| kernel | 设备上执行的程序 | 算子包，或仓库自己编译的 AscendC 代码 | 只能从 profiling 结果里看 |

这一页讲的是前四层：每一层各是什么、由谁决定、在哪能查到。追踪任何一次运算都按同一个顺序：先确定它的数学输入输出，再找到模型里的调用点，接着确认这个模块最终是哪个类、哪个方法在执行，最后才进到算子接口或扩展。第五层里一个 kernel 具体怎么搬数据、怎么切块，见[一次归一化落到 AI Core](op-to-ai-core.md)。

## 为什么要分这么多层，代价是什么？

**换硬件不改模型代码。** vLLM 本体只认「这是一个 RMSNorm」，具体调谁由平台插件在进程启动时替换。vllm-ascend 维护一张替换表，把 26 个类名映射到自己的实现（本部署还因为版本门控多加两项：MoE 层和 KDA 层），Worker 初始化时统一注册一遍。同一份 GLM 模型代码，因此可以在不同厂商的插件下跑起来。

**同一个模块可以有好几种算法。** 量化就是典型：同样是 Linear，不量化时走一条路，W8A8（权重 8 位整数、激活 8 位整数）时走另一条。这个选择不在替换表里，而在层的量化方法对象上，按启动时读到的量化配置决定，细节见 [quantization](quantization.md)。

**成熟实现和自己写的实现可以并存。** 普通算子用 torch_npu 的现成实现，融合算子、新模型的特殊结构则自己写。GLM 的残差混合、KDA 的分块递推，就是仓库自己编译出来的。

代价有四条，读代码和排障时都会撞上：

- **看不出谁在算。** 模型文件里的一次调用，要跨四层才能找到真正执行的算子；中途还要被量化方法、芯片型号各再分一次叉。这也是[调用链](request-call-chain.md)那一页要按进程和类逐层认站的原因。
- **自编译扩展是可选件。** 它随镜像编译安装，装不上时有的路径退回 torch_npu 的等价实现，有的路径直接抛错。同一份 Python 代码在两个镜像里走哪条分支，由扩展装没装上决定。
- **融合算子对权重排布有要求。** 昇腾的融合矩阵乘只吃 NZ 格式（把矩阵按小块重排的一种设备内部排布），所以权重要在加载完成后就转好，推理时才不用临时转。
- **一次运算未必只有一个 kernel。** 融合会把几次运算并成一个，分块会把一次运算拆成多个。要知道真实次数只能看 profiling，不能靠数 Python 里的调用行数。

## 在 GLM 双机上，一个 token 沿一层走过哪些算子

下面按[双机部署](glm-5-3-flash-two-node.md#部署前提)的前提（2 台 A2、每台 8 卡、TP8、DP2、EP16、W8A8）走一遍第 3–44 层中的一层。每一站的形状、字节和通信次数在[一次请求](one-request.md)里推导过，这里只看它落到哪个算子。

| 站 | 谁决定实现 | 落到哪个算子 |
|---|---|---|
| 残差混合（mHC）入口 | 模型文件里写死 | 仓库自编译扩展的 `npu_hc_pre_v2` |
| 输入 RMSNorm | 替换表 | 无残差时 torch_npu 的 `npu_rms_norm`；带残差时自编译的加法融合版 |
| QKV 投影 | 替换表选到昇腾线性层，量化方法选 W8A8 | `npu_dynamic_quant` 之后 `npu_quant_matmul` |
| 注意力本身 | 后端表 | 34 层走 KDA 的自编译算子，11 层走稀疏注意力算子 |
| 输出投影 | 同 QKV，之后一次 TP8 All-Reduce | `npu_quant_matmul` |
| 残差混合出口 | 模型文件里写死 | 自编译扩展的 `npu_hc_post` |
| MoE 分发 | 通信方式选择 | 纯 decode 步走 torch_npu 的 MC2 分发算子；混进大段 prefill 时换 All-Gather 路线 |
| 专家计算 | 量化方法 | 分组量化矩阵乘加 SwiGLU 的融合算子 |
| MoE 合并 | 通信方式选择 | 同分发：MC2 路线下是 torch_npu 的 MC2 合并算子 |

表里的残差混合（mHC，multi-head hyper-connection）是 GLM 自己的结构：这个模型的残差不是一条而是四条并行的流，进子层之前，入口算子按一组当场算出来的系数把四路合成一路，作为子层的输入；子层算完，出口算子再把结果摊回这四路。注意力和 MLP 两个子层前后各做一次。这两次调用在模型文件里写死，不经过替换表。

注意力那一站为什么 34 层和 11 层不一样、后端表按什么选，见[后端家族](attention-backend-family.md)；这里只接着讲这几类算子各自长什么样。本页只追踪源码入口：Python 里出现一个扩展的名字，不等于已经核实它在专用镜像里装好并真的跑起来，这条边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

## 特殊的几类层各自落到哪个算子

### 量化矩阵乘（W8A8）

稠密 MLP 和各个投影层都走 W8A8 的线性方法。它的执行只有两步：先把这一批激活按 token 动态量化成 int8，同时得到每个 token 一个 FP32 的缩放系数；再调量化矩阵乘，把权重侧的 per-channel 缩放和激活侧的 per-token 缩放一起交给算子，算子内部完成反量化并直接输出 BF16。反量化不是单独一次调用。

权重是加载时就转成 NZ 格式的。不量化的线性层走另一条路，调的是上游注册的通用矩阵乘。

### KDA 线性注意力（34 层）

KDA（Kimi Delta Attention，把历史压进固定大小状态的线性注意力）的算子基本都是仓库自己写的。先是一个窗口为 4 个 token 的因果短卷积算子（这里的「窗口」是卷积宽度，和设备上的 kernel 不是一回事）；然后按阶段分叉：prefill 时先做 L2 归一化，再调门控前缀和算子和分块前向算子，块长 64，最后把状态写回；decode 时调递推算子，一次更新一个 token 的状态，门控和归一化都在算子内部完成。

这条路对自编译扩展是硬依赖：prefill 用到的两个算子如果在当前镜像里没有注册，层会直接抛错，不会退回 PyTorch 实现。

### 稀疏 MLA 注意力（11 层）

这 11 层的生产路径是：注意力实现类的前向调一个内部方法，被子类重写成从三份缓存里取出完整的 MLA KV，再交给设备适配层；A2 上适配层调的是自编译扩展的稀疏注意力算子，query 布局 TND、KV 布局 PA_BSND，稀疏块大小 1。这个算子的 C++ 绑定在仓库的 csrc 目录里，适配函数最终调用 CANN 的 aclnnSparseFlashAttention。

同一个文件里还有一份纯 PyTorch 的稀疏注意力参考实现，它只被单元测试调用，不在推理路径上——看这类文件时要先确认调用点，再下结论。

### MoE 的分发与合并

先说清限定：MC2 是昇腾把「发 token」和跨卡通信合在同一个算子里做的通信方式，本部署只在批量小（纯 decode 步）时走它；批里混进大段 prefill、token 数超过门槛时整层换成 All-Gather 路线，分发与合并就不再是这两个算子。哪个门槛、怎么推导，见底稿与 [MoE 一页](moe.md)。

MC2 路线下，分发和合并各是一次 torch_npu 的 MC2 算子调用：一个算子同时完成「把 token 发给选中的专家」和跨卡通信，合并侧同理。仓库在构造时用属性探测的方式检查当前 torch_npu 里有没有这两个算子的 v2 版本，没有就退回旧版接口。

夹在中间的专家计算是三步：激活量化（如果分发已经带回量化结果就跳过）、分组矩阵乘加 SwiGLU 的融合算子、第二个分组矩阵乘。融合版只吃 NZ 格式的权重，所以这两份专家权重在加载后也转过排布。

## 常见误解

- **「替换表里的每一项都是仓库自己编译的 kernel。」** 替换表只是把类名换成昇腾版的 Python 类。换完之后调什么，由这个类自己决定：有的类调 torch_npu 的现成算子，有的类调自编译扩展，归一化这样的类两条路都有。
- **「一个算子就是一个 kernel。」** 融合算子把几次运算并成一次调用，大形状的算子又会被切成多个分块任务。算子数和 kernel 启动数要分开数。
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
- 两个会让扩展整体关掉的条件：环境变量 `VLLM_BATCH_INVARIANT` 打开（批不变模式下部分自定义算子没有实现），或芯片是 A5。
- 环境变量 `COMPILE_CUSTOM_KERNELS` 设为假时，Worker 只打印一条警告说「多数场景下不装自定义算子 vllm-ascend 不能正常工作」，不会阻止启动。
- 上游 `CustomOp` 自己还有一层开关：`compilation_config` 的 `custom_ops` 列表决定某个算子是否启用，禁用时回落到 `forward_native`，启用且平台是 out-of-tree 时才返回 `forward_oot`。[C2]
- KDA 与 FusedMoE 这两项是版本门控注册的：只有 `vllm_version_is("0.23.0")` 为真时才加进替换表。[C3]

### 会报什么错

- KDA prefill 缺算子：`RuntimeError: Kimi KDA prefill requires the PR141 AscendC operators, but the following schemas are missing: torch.ops._C_ascend.kda_gate_cumsum, torch.ops._C_ascend.chunk_kda_fwd. Rebuild and install the vllm-ascend custom operators with KDA support.`，在进入 prefill 分支前抛出。[C14]
- 扩展没装上时，`enable_custom_op()` 捕获 `ImportError`；如果报错信息里带 `libcust_opapi.so`，它会补上厂商库路径再试一次导入，仍失败才把开关置假。[C6]
- 类没有被 `@CustomOp.register` 装饰就直接实例化时，上游抛 `TypeError`，信息里说 name 属性没设。[C1]
- 分发算子的 v2 版本不在当前 torch_npu 里时不报错，`hasattr` 探测为假就走旧版接口，这一步只能靠读代码发现。[C23]

### 开销和什么时候别开

- **多一层分派不等于多一次开销。** 替换表在进程启动时注册，`CustomOp` 在构造时就把前向方法定死在实例上；每次前向只是一次属性调用，不再查表。[C2]
- **融合算子省的是内存访问，不是计算。** 带残差的归一化把加法和归一化并成一次调用，少写一遍中间结果；量化矩阵乘把反量化并进矩阵乘，少一次全张量读写。这类收益在访存受限的算子上才明显。
- **融合要付排布的代价。** 分组矩阵乘加 SwiGLU 的融合算子只接受 NZ 格式，所以权重加载后要转置并转格式，换来推理时不必临时转。[C27]
- **什么时候别开自编译扩展：** 批不变模式下必须关（部分自定义算子没有批不变实现）；排查精度问题时可以先关掉，比较同一条输入在 torch_npu 实现下的结果——但要清楚 KDA 的 prefill 关不掉，它没有回退路径。[C14]
- 本页不写任何算子的实测耗时：没有实测就无法说哪条路更快、融合省了多少。缺哪些实测，集中列在页末待核第 1 条。

### 版本差异

执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页的 GLM 算例读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：2c59ff10 上没有 GLM 模型代码，也没有 KDA 的算子文件。**

| 项目 | v0.23 | v0.26 | main |
|---|---|---|---|
| 替换表与注册入口 | `register_ascend_customop` 在 `utils.py`，结尾统一 `CustomOp.register_oot`（镜像 db701c1f 与它逐行同位，`#L690` 起、`#L818` 注册）[C28] | 同 v0.23 | 同 v0.23 |
| 替换表里有没有 KDA | 没有：`kimi_kda.py` 不存在，替换表里也没有这一项 | 有 `kimi_kda.py`，`_require_ascendc_prefill_ops` 的报错与镜像一致（在 `#L148`）[C29] | 有 |
| 带残差的 RMSNorm | 先 `maybe_chunk_residual`，再按 `enable_custom_op()` 在自编译融合算子和 torch_npu 加法融合之间二选一（镜像同）[C7] | 同 v0.23 | 不再二选一：直接导入扩展并调自编译融合算子，没有 torch_npu 回退分支 [C30] |
| GLM 模型代码 | 没有 | 没有（有 Kimi K3，没有 GLM） | 在 `models/glm5next/` 包里，残差混合仍调 `npu_hc_pre_v2` [C31] |
| 按芯片选实现 | `DeviceOperator` 在 `device/device_op.py`，A2 选基础适配类 | 同 v0.23 | 同 v0.23（同目录另有硬件描述文件） |

### 源码位置

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
| 子类重写：取三份缓存、交给设备适配层 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| A2 上稀疏注意力的实际参数与布局 | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| 稀疏注意力算子的 C++ 绑定与 aclnn 调用 | `vllm-ascend@db701c1f:csrc/torch_binding.cpp#L2848-L2860`；`vllm-ascend@db701c1f:csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h#L93-L149` |
| MC2 分发与合并、v2 算子的属性探测 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L108-L120`；`#L225-L240`；`#L329-L340` |
| 专家计算的三步算子 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215` |
| 专家权重转置并转 NZ | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L366` |
| v0.23 / v0.26 / main 列对照的四处 | `vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L700`；`vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L148-L166`；`vllm-ascend@baa023ad:vllm_ascend/ops/layernorm.py#L64-L82`；`vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L495-L505` |

**证据索引。** 本页每条结论的出处逐条列在上面的表里，表的行序就是来源清单的顺序：前九行对应四层结构与三套换实现的机制，中间十一行对应 GLM 一层里各站的算子，后四行是三个版本的对照点。

以下几条是由上述源码推出或属于本页的理解：沿一层走过哪些算子那张表，是把各调用点按模型文件里的先后顺序排出来的 [D]；形状、字节和通信次数不在本页重算，取自[一次请求](one-request.md)与主线底稿 02 的 §3.4、§4.2、§5.5、§6.6 [D]；「算子数不等于 kernel 启动数」是融合与分块两件事的推论 [D]；「多一层分派不等于多一次开销」由构造时定死前向方法推出 [D]；融合省的是内存访问而不是计算，源码没有写，是本页按算子形态给出的理解 [I]。

**待核：**

- 缺 A2 上的 profiling：各类算子的实测耗时、分块策略（tiling）和实际 kernel 启动次数都没有实测数据，本页因此不写任何耗时与分块数字。
- 稠密 MLP 是否和共享专家一样命中带 SwiGLU 的融合分支，没有逐行跟到底；本页只写它走量化矩阵乘这一步。
- 占位对象覆盖的那几个融合名字，后续由哪条图改写路径消费，没有跟到消费者。
