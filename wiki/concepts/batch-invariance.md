---
id: batch-invariance
title: "Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位"
type: feature
summary: 同一条请求，单独跑和混在上百条里跑，输出逐位相同。办法不是算得更准，而是把矩阵乘、求和、softmax、注意力换成加法顺序与批形状无关的实现。光设开关不够：算子包要在编译前装好，main 上还得自己关掉默认开着的 chunked prefill 与前缀缓存，见版本差异表。
aliases: [Batch Invariance, 批不变, 批不变性, 批次不变性, batch_invariant_ops, init_batch_invariance, enable_batch_invariant_mode, npu_mm_batch_invariant, npu_fused_infer_attention_score_batch_invariant, matmul_persistent, 逐位可复现, HCCL_DETERMINISTIC]
chapters: ["16"]
order: 60
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L99-L138
  - vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L140-L163
  - vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L76-L93
  - vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L31-L47
  - vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L50-L73
  - vllm-ascend@2c59ff10:vllm_ascend/ops/triton/batch_invariant/matmul.py#L63-L82
  - vllm-ascend@2c59ff10:vllm_ascend/ops/triton/batch_invariant/matmul.py#L132-L140
  - vllm-ascend@2c59ff10:vllm_ascend/ops/triton/batch_invariant/matmul.py#L353-L382
  - vllm-ascend@2c59ff10:vllm_ascend/ops/triton/batch_invariant/softmax.py#L22-L29
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L989-L992
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L421-L428
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L70-L80
  - vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L146-L155
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L256-L263
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L843-L850
  - vllm@0fc695fc:vllm/envs.py#L596-L598
  - vllm@0fc695fc:vllm/v1/attention/selector.py#L100-L104
  - vllm@0fc695fc:vllm/model_executor/layers/batch_invariant.py#L914-L919
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L98-L112
  - vllm@0fc695fc:vllm/model_executor/models/qwen2.py#L93-L104
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L13-L13
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L17-L22
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L24-L31
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L45-L48
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L111-L118
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/batch_invariance.md#L120-L135
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/batch_invariance.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1121-L1121
  - vllm-ascend@2ed6cbba:vllm_ascend/batch_invariant.py#L76-L92
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L927-L947
  - vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_invariant.py#L149-L200
  - vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L68-L83
  - vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L124-L137
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1360-L1364
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L24-L26
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L110-L119
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L196
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L207-L226
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/batch_invariance.html
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/ops/gdn_attn_builder.py#L35-L40
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求默认不开它；开了之后 200 步 × 40 层里哪些步换了实现、哪 30 层不在名单里，用的是它的数
  - to: ops-and-kernels
    kind: builds-on
    note: 换的正是那一页的第二层和第三层——torch_npu 的函数被直接赋值替换，csrc 编出来的自定义算子整层下线
  - to: chunked-prefill
    kind: conflicts-with
    note: main 的文档写明两者不能同时开，而且不会自动关，要自己加 --no-enable-chunked-prefill
  - to: prefix-caching
    kind: conflicts-with
    note: 同样要自己关；关掉之后 block_size 不再被顶成 128，得补一个 --block-size 128
  - to: acl-graph
    kind: conflicts-with
    note: v0.23 与 v0.26 的文档写明批不变的注意力算子不支持 FULL 和 FULL_DECODE_ONLY 两种捕获模式
  - to: tensor-parallel
    kind: builds-on
    note: 多卡时 all-reduce 的加法顺序也得钉死，靠 HCCL_DETERMINISTIC=strict 和 LCCL_DETERMINISTIC=1
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 单独重跑同一个问题，回答却分叉了

排查问题时常有这么一幕：线上一条回答看着不对，把同样的问题、同样的参数单独拿出来重跑一遍想复现——结果回答到中途就和线上那条分叉了，后面整段对不上。温度已经设成 0，按理每一步都选分数最高的那个词，哪来的随机？

差别不在参数，在**同伴**。线上那条请求是和几十上百条别人的请求拼在一个批里算的；单独重跑时，批里只有它自己。默认情况下，这一批有多大，会让计算结果的**末位**发生变化——末位一变，两个候选词分数接近的那一步就会选出不同的词，后面整条回答跟着走岔。

**批不变性**治的就是这个。官方对它的定义就是一句话：开了它，同一条请求不管单独跑还是混在上百条里跑，输出逐位相同，与批大小、批内顺序无关。手段不是「算得更准」，而是把矩阵乘、求和、softmax、注意力换成**加法顺序与批形状无关**的实现。

[那条请求](one-request.md)那一页里它压根没开——也不需要：这个开关默认是关的，而且队列里只有它一条，没有「和谁拼一批」这回事。要用上它，得把请求放进一个会变的批里，再显式打开开关。

```wiki-diagram
file: batch-invariance
```

## 末位为什么会变：一个和，分几份来加

模型里最多的计算是矩阵乘，而矩阵乘的每个输出数就是一长串乘积加在一起。拿 Qwen3.6-35B-A3B 来说，隐藏宽度是 2048，投影矩阵乘里每个输出数背后就是 2048 个数的和。

浮点加法不满足结合律：同样 2048 个数，分 4 组各自求和再合并，和从头到尾一路加下去，结果的末位可能不一样。而默认的高性能矩阵乘恰恰会**按这一批有多少 token 去挑策略**：token 少就把这串和拆成几段并行加，token 多就不拆。于是同一条请求换个批，加法的分组就换了，末位就变了。

英伟达那边，上游确认过批间差异只有这一个来源，所以钉死一项库配置就完事。昇腾这边没有这种一键捷径，只能整个换实现。

## 治法：把每条加法链钉死

换上的矩阵乘把分块写死：2048 个数固定切成 32 段（2048 ÷ 64），每个输出数由一个累加器**从第 1 段一路加到第 32 段，中间不换人**。这一批有多少 token，只决定同时铺开多少条这样的累加链，不影响任何一条链内部的顺序——顺序只跟模型宽度有关，批变不着它。

其余几步照同一个思路办：softmax 不用融合实现，拆成求最大、减、取指数、求和、除五小步，步步确定；注意力整个换成批不变版的实现；求和也换。

多卡还有跨卡的那笔账：那条请求两颗 NPU 各算半个和，再跨卡相加。这条跨卡加法的顺序也得钉死——开关打开时会自动设好几个确定性环境变量，为什么跨卡求和的顺序也会变，见[张量并行](tensor-parallel.md)。

## 代价：昇腾的加速算子全体下线

仓库里有一部分昇腾自定义算子没做批不变，所以开关一开，昇腾自己编译的那层加速算子**整体不参与**，模型掉回通用实现，见[算子与核函数](ops-and-kernels.md)。带残差的归一化从一个融合步拆成两步；采样也退回上游的通用实现。官方只承认「可能变慢」，没给数字，这一页也不替它编一个。

还有几件事它管不了，得自己动手：main 的文档写明 chunked prefill、前缀缓存、抢占都不支持，而且**不会自动关**——不关不报错，只是悄悄不可复现。图模式也只支持分段捕获那一种方式，见 [ACLGraph](acl-graph.md)。

## 这个模型有 30 层不在保证名单里

Qwen3.6-35B-A3B 是混合注意力模型：40 层里只有 10 层是全注意力，另外 30 层是线性注意力（见[那条请求](one-request.md)）。上面那份「换实现」的名单管得住矩阵乘、归一化、softmax、求和，以及全注意力用的那个注意力函数；**线性注意力那 30 层用的是另一套专用实现，不在名单里**。官方测过逐位相同的也只有四个 Qwen3 模型（两个稠密、两个 MoE），没有这一个。

所以本页拿它讲的是机制。真要在它身上下「逐位相同」的结论，照官方的验证办法自己跑一遍：先把一条「大海捞针」问题单独跑一遍存下答案，再把它塞进 72～144 条随机长问题中间的随机位置，连跑 5 轮，要求生成的文本一字不差。

## 两个容易搞混的说法

- **「加了随机种子就能复现」**——两件事。种子保证同样的分数表选出同样的词；批不变保证的是同样的输入在不同批里算出同样的分数表。官方那个测试两件都做了：种子固定，仍然要靠批不变才能让同一条问题在 1 条和 144 条的批里输出一致。
- **「它是 Flash Attention 3 的一部分」**——反了。v0.23 / v0.26 上 [Flash Attention 3](flash-attention-3.md) 把批不变当前提；批不变自己不依赖 FA3，它换注意力的办法是把默认的融合注意力函数整个替掉。

## 对照源码

### 怎么开

命令抄自官方文档，只换了模型 [S25]：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3.6-35B-A3B \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

- main 上还要自己加 `--no-enable-chunked-prefill --no-enable-prefix-caching --block-size 128` [S38]。那个 `--block-size 128` 不是多余的：`refresh_block_size` 只在开了前缀缓存或 chunked prefill 时才把块大小顶成 128 [C35]，两个都关掉，128 就不会自己来了 [D]。
- 安装是硬性前提：AscendC 的 `batch_invariant_ops` 不随普通 wheel 发布，要在**编译 vllm-ascend 之前**就设好 `VLLM_BATCH_INVARIANT=1`，让安装过程把这套算子装进去 [S23]；装完的 wheel 事后设是补不回来的。
- 硬件与测过的模型：v0.23 / v0.26 写 Atlas A2 / A3，测过四个 Qwen3（两 dense 两 MoE）[S22]；main 加上 950PR / 950DT [S36]。
- 跨卡与权重格式由 `init_batch_invariance()` 自动钉死：`HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`、`torch.use_deterministic_algorithms(True, warn_only=True)`，并把 `weight_nz_mode` 压成 0，不让权重走 NZ 格式 [C3]。
- main 的另一条路：`additional_config.rl_config.enable_batch_invariant` 为真时由 `RlConfig.apply()` 去设同一个环境变量，但必须同时 `rl_config.enabled` 为真才生效 [C34]。环境变量这条路 main 上照样有，rl_config 只是把它和别的 RL 默认值打包。
- 验证方法照上游 e2e（用的模型是 Qwen3-0.6B）：needle prompt 单独跑存基线，塞进 72～144 条随机 prompt 的随机位置，连跑 5 轮要求逐字相同，种子固定 `20240919` [C31]。
- 上游 `envs.py` 注释里的「compute capability ≥ 9.0」是给 CUDA 侧写的 [C16] [!]，昇腾不看这条；昇腾的前提就是上面那两行。

### 会报什么错

最要紧的恰恰是**不报错**的三处：

- Triton 与 AscendC 两条供应链都不在场时，`init_batch_invariance()` 只打一条 warning 就跳过，服务照常起来——开关设了但没生效 [C2]。
- 图模式配了 `FULL` / `FULL_DECODE_ONLY`：文档说批不变的注意力算子不支持这两种捕获模式 [S25]，但 `vllm_ascend` 里没有一处代码去校验——在三个 commit 上按 `VLLM_BATCH_INVARIANT` 搜整个包，落点只有采样器、`enable_custom_op()`、v0.23 / v0.26 上 FA3 那道闸、main 上 `RlConfig` 那处赋值和注意力里的一处分批，和 cudagraph 沾边的检查一处都没有 [!]。配错了不报错，只是不可复现。各取值的含义见 [ACLGraph](acl-graph.md)。
- `enable_async_exponential` 只有在 `VLLM_BATCH_INVARIANT` 为假时才可能为真，开了批不变它被静默置回 `False`，一条日志都没有 [C14]，细节见 [enable_async_exponential](../params/enable-async-exponential.md)。

真会报错的一处在 v0.23 / v0.26：`reduce_sum` 的适用条件太宽（NPU 张量且 `dim` 不是 None 就走批不变实现），而算子本身只支持最后一维，别的维会报 `AclNN_Parameter_Error`；main 把条件收紧成「最后一维、且 dtype 是 fp16 / fp32 / bf16」[C32]。

### 开销和什么时候别开

- 官方文档就一句话：开了批不变**可能**比默认的非确定模式慢，这是为可复现性有意付的代价 [S26]。没有倍数，没有基准。能看出来的定性代价有三处 [D]：Triton 那套用固定 `128×128×64` 分块，不按形状调优；自定义算子整层下线 [C11]；带残差的 RMSNorm 从一个融合算子拆成两步 [C5]。
- 不支持与互斥：chunked prefill、前缀缓存、抢占（main 文档明说，且不会自动关）[S38]；捕获模式只支持 `PIECEWISE` [S25]；`enable_matmul_allreduce` 在 v0.23 由代码强制置 `False`，v0.26 起这一行删了、保护没了 [C29]，见 [enable_matmul_allreduce](../params/enable-matmul-allreduce.md)。
- 混合注意力模型要当心：GDN 线性注意力走的是 `ops/triton/fla/` 那套核 [C42]，不在 `enable_batch_invariant_mode()` 的替换名单 [C1] 里 [I]；官方测过的模型名单里也没有混合注意力模型 [S22]。逐位相同对这类模型没有官方背书。

### 版本差异

最早的框架 v0.13.0 就落地了（PR #5517）[S28]；三个在册版本上 `vllm_ascend/batch_invariant.py` 与官方文档 `batch_invariance.md` 都在，上文按 v0.23 维护分支讲。差异集中在这张表，其中 main 新增的那三条调度限制最要紧。

| 项 | v0.23 维护分支 | v0.26 分支（2026-09-17 源码快照） | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 调度前提 | 文档整篇不提 | 同 v0.23 | 多出一节 Scheduling Limitations：chunked prefill、前缀缓存、抢占都不支持，且**不会自动关**，要自己写 `--no-enable-chunked-prefill --no-enable-prefix-caching --block-size 128` [S38] | [!] 照 v0.23 那篇文档配出来的服务其实不可复现，坑到 main 才写明。那个 `--block-size 128` 不是多余的：`refresh_block_size` 只在开了前缀缓存或 chunked prefill 时才把块大小顶成 128，两个都关掉，128 就不会自己来了 [D] |
| 图模式 | 文档要求 `PIECEWISE`，不支持 FULL / FULL_DECODE_ONLY | 同 v0.23 | 这条 note 连同 Future Improvements 里对应那条一起删了 [S39] | main 上不再声明这个限制，但三个版本的代码里都没有对应校验，删掉不等于支持了 [!] |
| `aten::sum` | 注册成 AscendC 的 `npu_reduce_sum_batch_invariant` | 同 v0.23 | 取消注册，只留 `torch.sum` 与 `torch.Tensor.sum` 两处 Python 赋值 | 走 `aten` 派发过来的 `sum`（例如被 `torch.compile` 捕获进图的那些）在 main 上不再被换掉 [I] |
| `reduce_sum` 的适用范围 | NPU 张量且 `dim` 不是 None 就走批不变实现 | 同 v0.23 | 收紧成「只有最后一维、且 dtype 是 fp16 / fp32 / bf16」才走，其余退回原生 `torch.sum` | 注释说明算子本身只支持最后一维，别的维会报 `AclNN_Parameter_Error`——旧版那个更宽的条件是真会撞上去的 |
| `enable_matmul_allreduce` | 批不变模式下被强制置 `False` | 这一行删了 | 同 v0.26 | v0.23 上两者互斥由代码保证，v0.26 起这层保护没了，见 [enable_matmul_allreduce](../params/enable-matmul-allreduce.md) |
| 开关 | 只有环境变量 | 同 v0.23 | 多一条路：`additional_config.rl_config.enable_batch_invariant` 为真时由 `RlConfig.apply()` 去设 `VLLM_BATCH_INVARIANT=1`，但必须同时 `rl_config.enabled` 为真才生效 | 环境变量这条路 main 上照样有，rl_config 只是把它和别的 RL 默认值打包，不是替代 |
| 混合批的注意力 | 不特判 | 同 v0.23 | 批不变模式下，一批里同时有 prefill 和 decode 就走 `_forward_fia_chunked_prefill_split`，拆成两次 FIA | main 文档说「抢占后重算把 decode 过的 token 走成 prefill，P 与 D 对不齐」，这一行就是它在代码里的落点 |
| 硬件 | Atlas A2 / A3 | 同 v0.23 | 加上 950PR 与 950DT [S36] | — |

### 源码位置

**入口与时机。** `init_batch_invariance()` 在 `NPUWorker._init_worker_distributed_environment()` 的第一行调用，比分布式初始化还早，每个 rank 各跑一次；`VLLM_BATCH_INVARIANT` 默认 `0`，读的是上游 `envs.py` 那条。覆盖是进程级的：过了这一步，本进程后续每一次 forward 用的都是换过的实现。

**一张派发表加三处直接赋值。** `enable_batch_invariant_mode()` 建了一个 `torch.library.Library("aten", "IMPL")`，往 `NPU` 派发键上挂实现。挂什么取决于两条供应链谁在场：AscendC 的 `batch_invariant_ops`（独立的包，`import` 得到就算在场，设备侧实现，优先级更高）与 Triton（`vllm_ascend/ops/triton/batch_invariant/` 下那几个核，`HAS_TRITON` 为真就在场）：

| 挂在哪 | 只有 Triton | 只有 AscendC | 两条都在场 |
|---|---|---|---|
| `aten::addmm`、`aten::bmm`、`aten::softmax`、`aten::_softmax` | Triton 版 | 不挂 | Triton 版，AscendC 没做这几个 |
| `aten::mm`、`aten::matmul` | Triton 的 `mm` / `matmul_batch_invariant` | `npu_mm` / `npu_matmul_batch_invariant` | AscendC 赢 |
| `aten::sum` | 不挂 | `npu_reduce_sum_batch_invariant` | AscendC |
| `aten::linear` | Triton 的 `linear_batch_invariant` | 不挂 | **不挂**——源码给的理由是 linear 内部会调 matmul，AscendC 那条路性能更好，所以只在它缺席时才注册 |

派发表挂不住的另有三处，靠直接赋值覆盖：`torch_npu.npu_fused_infer_attention_score`（torch_npu 的普通函数，不是注册算子）、`torch_npu.npu_add_rms_norm`、以及 `torch.sum`（Python 层的函数，派发拦不到）。Triton 的四个矩阵乘入口最后都落到同一个 `matmul_persistent`，区别只是先怎么把张量拍成二维。

**Triton 核怎么钉死顺序。** `BLOCK_M, BLOCK_N, BLOCK_K` 写死成 `128, 128, 64`，grid 只按 `(cdiv(M,128), cdiv(N,128))` 铺；每个程序自己开一个 fp32 累加器，从第 0 段一路加到最后一段，同一处还把 `tl.dot` 的 `allow_tf32` 关掉了。K 方向不切给别人，加法顺序只跟 K 有关、跟 M 无关 [D]。上半的 32 段就是这么来的：Qwen3.6-35B-A3B 的 `hidden_size = 2048` [S41]，2048 ÷ 64 = 32 [D]。softmax 拆成 `amax` → 减 → `exp` → `sum` → 除五步。

**上游对照。** 上游在自己那份实现里写了注释：在 Hopper 和 Blackwell 上，批间差异的**唯一**来源就是 split-K，所以只要把 cuBLAS 的 workspace 配置钉死就够了。昇腾没有这条捷径，只能换实现。

**连锁下线。** `enable_custom_op()` 在 `VLLM_BATCH_INVARIANT` 为真时直接返回 `False`，注释里写的理由是仓库里有一部分自定义算子没做批不变，于是 `torch.ops._C_ascend.*` 整层不参与。以 RMSNorm 为例：`AscendRMSNorm.forward_oot` 有残差时先看 `enable_custom_op()`，真则走 `torch.ops._C_ascend.npu_add_rms_norm_bias`，假才走 `torch_npu.npu_add_rms_norm`——正是因为自定义算子被关掉，才撞上被赋值替换过的那个函数，两处改动是配套的 [D]。替换版 `add_rms_norm` 是纯 Python：先加残差，再单独调 `npu_rms_norm`。采样那一路 `AscendSampler.forward_native` 第一句就是「批不变模式下用 vLLM 的实现」，直接 `super().forward_native(...)`。

**FA3 那道闸。** v0.23 / v0.26 上 `_validate_fa3_backend` 第二道闸读的就是上游抄过来的 `use_batch_invariant`——方向是 FA3 依赖批不变，不是反过来。

**那条请求的账（[D] 推导，逐层路径本页没有一一核过）。** 若这模型的全注意力层走默认注意力后端的 FIA 路径（main 上批不变的混合批拆分就写在那儿），按[那条请求](one-request.md)的 200 步算，注意力换实现的就是 200 × 10 层 = 2000 次；矩阵乘和带残差的 RMSNorm 则是 40 层每层每步都有。GDN 那 30 层的专用核（`ops/triton/fla/`）不在名单里，不换 [I]。
