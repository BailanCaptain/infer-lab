---
id: batch-invariance
title: "Batch Invariance：同一条请求，跟谁拼一批都算出同一个末位"
type: feature
summary: 开了它，一条请求不管单独跑还是混在上百条里跑，输出逐位相同——靠的是把矩阵乘、归约、softmax、注意力换成加法顺序与批形状无关的实现。
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
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求默认不开它；开了之后 200 步 × 28 层里哪几个算子换了实现，用的是它的数
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
updated: "2026-09-22"
origin: seed
---

## 一句话

**同一条请求，不管它和谁拼在一个 batch 里、这一批多大，输出逐位相同。** 官方对它的定义就是这句话——输出确定，且与批大小、批内顺序无关。手段不是「算得更准」，而是把矩阵乘、归约、softmax、注意力换成**加法顺序与批形状无关**的实现。

三个在册版本上 `vllm_ascend/batch_invariant.py` 与官方文档 `batch_invariance.md` 都在，最早的框架 v0.13.0 就落地了（PR #5517）[S28]；下面按 v0.23 维护分支讲。差异集中在最后那张表，其中 main 新增的那三条调度限制最要紧。

```wiki-diagram
file: batch-invariance
```

## 那条请求用不到它

[那条请求](one-request.md)什么都没配，`VLLM_BATCH_INVARIANT` 默认就是 `0`，`init_batch_invariance()` 里那个 `if` 根本不进。它也不需要——队列里只有它一条，压根没有「和谁拼一批」这回事。

要走到这里，得把它放进一个会变的批里，并且加上开关。命令抄自官方文档，只换了模型：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3-0.6B \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

上游 e2e 恰好就是拿 Qwen3-0.6B 做的：先单独跑一遍 needle prompt 存成基线，再把它塞进 72～144 条随机长 prompt 中间的随机位置，连跑 5 轮，要求生成的文本一字不差 [C31]。

开了之后，这条请求这 200 步里换掉的是下面这些（装了 AscendC 的 `batch_invariant_ops` 包时）[D]：

| 这一步 | 200 步里出现多少次 | 换成了什么 |
|---|---|---|
| 注意力 | 200 × 28 = 5600 次 | `torch_npu.npu_fused_infer_attention_score` 被整个赋值成 `npu_fused_infer_attention_score_batch_invariant` |
| QKV / O / gate_up / down 四个投影 | 200 × 28 × 4 = 22400 次 | `aten::mm`、`aten::matmul` 换成 `npu_mm_batch_invariant` / `npu_matmul_batch_invariant` |
| 带残差的 RMSNorm | 每层两次 | `torch_npu.npu_add_rms_norm` 换成纯 Python 的 `add_rms_norm`：先加残差，再单独调 `npu_rms_norm` |
| softmax 与 `torch.sum` | 采样与归一化那几处 | `aten::softmax`、`aten::_softmax` 走 Triton 版，`torch.sum` 被直接赋值成 `reduce_sum` |

## 默认做不到，是因为同一个和分几份来加，由批形状说了算

一个输出元素就是 K 个乘积相加。Qwen3-0.6B 的 `H = 1024`，所以 QKV 投影里每个输出元素背后是 1024 个数的和。浮点加法不满足结合律，**分几份加、按什么顺序加，结果的末位就不一样**。

默认那些高性能矩阵乘会按这一批有多少 token（也就是 M）去挑分块和并行策略：M 小的时候把 K 拆成几段并行求和（split-K），M 大的时候不拆。上游在自己那份实现里把这句话写成了注释——在 Hopper 和 Blackwell 上，批间差异的**唯一**来源就是 split-K，所以它只要把 cuBLAS 的 workspace 配置钉死就够了 [C18]。末位一变 logits 就变，贪心解码在两个候选分数接近时选出不同的 token，后面整条回答跟着分叉 [D]。

昇腾这边没有「钉一个环境变量」这条捷径，只能换实现。Triton 那套的做法直接写在核函数里：`BLOCK_M, BLOCK_N, BLOCK_K` 写死成 `128, 128, 64`，grid 只按 `(cdiv(M,128), cdiv(N,128))` 铺 [C7]；每个程序自己开一个 fp32 累加器，**从第 0 段一路加到最后一段，中间不换人**，同一处还把 `tl.dot` 的 `allow_tf32` 关掉了 [C6]。K 方向不切给别人，于是加法顺序只跟 K 有关、跟 M 无关——M 是这一批有多少 token，它变了也不影响顺序 [D]。

softmax 换得更朴素：不用融合核，拆成 `amax` → 减 → `exp` → `sum` → 除，五步各自都是确定的。

## 换掉的不是一个算子，是一张派发表加三处直接 patch

`enable_batch_invariant_mode()` 建了一个 `torch.library.Library("aten", "IMPL")`，往 `NPU` 这个派发键上挂实现。挂什么取决于**两条供应链谁在场**：

- **AscendC 的 `batch_invariant_ops`**——一个独立的包，`import` 得到就算在场。设备侧实现，优先级更高。
- **Triton**——`vllm_ascend/ops/triton/batch_invariant/` 下那几个核，`HAS_TRITON` 为真就在场。

两条都不在场时，`init_batch_invariance()` 只打一条 warning 就跳过，服务照常起来——**开关设了但没生效，不报错**。

| 挂在哪 | 只有 Triton | 只有 AscendC | 两条都在场 |
|---|---|---|---|
| `aten::addmm`、`aten::bmm`、`aten::softmax`、`aten::_softmax` | Triton 版 | 不挂 | Triton 版，AscendC 没做这几个 |
| `aten::mm`、`aten::matmul` | Triton 的 `mm` / `matmul_batch_invariant` | `npu_mm` / `npu_matmul_batch_invariant` | AscendC 赢 |
| `aten::sum` | 不挂 | `npu_reduce_sum_batch_invariant` | AscendC |
| `aten::linear` | Triton 的 `linear_batch_invariant` | 不挂 | **不挂**——源码给的理由是 linear 内部会调 matmul，AscendC 那条路性能更好，所以只在它缺席时才注册 |

派发表挂不住的另有三处，靠直接赋值覆盖：`torch_npu.npu_fused_infer_attention_score`（torch_npu 的普通函数，不是注册算子）、`torch_npu.npu_add_rms_norm`、以及 `torch.sum`（Python 层的函数，派发拦不到）。这三处覆盖是进程级的，发生在 `NPUWorker._init_worker_distributed_environment()` 的第一行，比分布式初始化还早。Triton 的四个入口最后都落到同一个 `matmul_persistent`，区别只是先怎么把张量拍成二维。

## 开了它，昇腾自己写的那层算子全体下线

这是最容易漏掉的连锁反应：`enable_custom_op()` 在 `VLLM_BATCH_INVARIANT` 为真时**直接返回 `False`** [C11]，理由写在注释里——仓库里有一部分自定义算子没做批不变。于是 `torch.ops._C_ascend.*` 那一层整体不参与，见[算子与核函数](ops-and-kernels.md)。

后果是连锁的。以 RMSNorm 为例：`AscendRMSNorm.forward_oot` 有残差时先看 `enable_custom_op()`，真则走 `torch.ops._C_ascend.npu_add_rms_norm_bias`，假才走 `torch_npu.npu_add_rms_norm`。**正是因为自定义算子被关掉，RMSNorm 才掉进 `else` 分支，撞上被 patch 过的那个函数**——两处改动是配套的，单看任何一处都看不出来 [D]。

采样那一路也退回上游实现：`AscendSampler.forward_native` 第一句就是「批不变模式下用 vLLM 的实现」，直接 `super().forward_native(...)`。配置层还有一条静默互斥：`enable_async_exponential` 只有在 `VLLM_BATCH_INVARIANT` 为假时才可能为真，开了批不变它被静默置回 `False`，一条日志都没有，细节见 [enable_async_exponential](../params/enable-async-exponential.md)。

跨卡那一侧靠环境变量：`HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`，外加 `torch.use_deterministic_algorithms(True, warn_only=True)`；同时把 `weight_nz_mode` 压成 0，不让权重走 NZ 格式。all-reduce 的加法顺序为什么也得管，见[张量并行](tensor-parallel.md)。

## 代价：官方只说了「可能变慢」，没给数

文档就一句话——开了批不变**可能**比默认的非确定模式慢，这是为可复现性有意付的代价 [S26]。没有倍数，没有基准，这一页也不替它编一个。能看出来的定性代价有三处 [D]：Triton 那套用的是固定 `128×128×64` 分块，不按形状调优；自定义算子整层下线；带残差的 RMSNorm 从一个融合核拆成两步。

硬性前提是先得装上东西。`batch_invariant_ops` 不随普通 wheel 发布：要在**编译 vllm-ascend 之前**就设好 `VLLM_BATCH_INVARIANT=1`，让安装过程把这套算子一起装进去。硬件上 v0.23 与 v0.26 写的是 Atlas A2 / A3，测过的模型是四个 Qwen3，两 dense 两 MoE。

图模式这条要当心：文档说批不变的注意力算子不支持 `FULL` 和 `FULL_DECODE_ONLY` 两种捕获模式，官方示例因此都带 `cudagraph_mode: PIECEWISE`；但 `vllm_ascend` 里**没有一处代码去校验它**——在三个 commit 上按 `VLLM_BATCH_INVARIANT` 搜整个包，落点只有采样器、`enable_custom_op()`、v0.23 与 v0.26 上 FA3 那道闸、main 上 `RlConfig` 那处赋值和注意力里的一处分批，和 cudagraph 沾边的检查一处都没有 [!]。配错了不报错，只是不可复现。各取值的含义见 [ACLGraph](acl-graph.md)。

还有一条容易和本页混起来：v0.23 与 v0.26 上 [Flash Attention 3](flash-attention-3.md) 把批不变当成硬前提，`_validate_fa3_backend` 第二道闸读的就是上游抄过来的 `use_batch_invariant`。**反过来不成立**：开批不变不需要 FA3，注意力那一步走的是被 patch 过的 FIA，不是 FA3 的算子。

## 三个版本的差异

| 项 | v0.23 维护分支 | v0.26 分支（2026-09-17 源码快照） | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 调度前提 | 文档整篇不提 | 同 v0.23 | 多出一节 Scheduling Limitations：chunked prefill、前缀缓存、抢占都不支持，且**不会自动关**，要自己写 `--no-enable-chunked-prefill --no-enable-prefix-caching --block-size 128` [S38] | [!] 照 v0.23 那篇文档配出来的服务其实不可复现，坑到 main 才写明。那个 `--block-size 128` 不是多余的：`refresh_block_size` 只在开了前缀缓存或 chunked prefill 时才把块大小顶成 128 [C35]，两个都关掉，128 就不会自己来了 [D] |
| 图模式 | 文档要求 `PIECEWISE`，不支持 FULL / FULL_DECODE_ONLY | 同 v0.23 | 这条 note 连同 Future Improvements 里对应那条一起删了 [S39] | main 上不再声明这个限制，但三个版本的代码里都没有对应校验，删掉不等于支持了 [!] |
| `aten::sum` | 注册成 AscendC 的 `npu_reduce_sum_batch_invariant` | 同 v0.23 | 取消注册，只留 `torch.sum` 与 `torch.Tensor.sum` 两处 Python 赋值 [C33] | 走 `aten` 派发过来的 `sum`（例如被 `torch.compile` 捕获进图的那些）在 main 上不再被换掉 [I] |
| `reduce_sum` 的适用范围 | NPU 张量且 `dim` 不是 None 就走批不变实现 | 同 v0.23 | 收紧成「只有最后一维、且 dtype 是 fp16 / fp32 / bf16」才走，其余退回原生 `torch.sum` [C32] | 注释说明算子本身只支持最后一维，别的维会报 `AclNN_Parameter_Error`——旧版那个更宽的条件是真会撞上去的 |
| `enable_matmul_allreduce` | 批不变模式下被强制置 `False` | 这一行删了 [C29] | 同 v0.26 | v0.23 上两者互斥由代码保证，v0.26 起这层保护没了，见 [enable_matmul_allreduce](../params/enable-matmul-allreduce.md) |
| 开关 | 只有环境变量 | 同 v0.23 | 多一条路：`additional_config.rl_config.enable_batch_invariant` 为真时由 `RlConfig.apply()` 去设 `VLLM_BATCH_INVARIANT=1`，但必须同时 `rl_config.enabled` 为真才生效 [C34] | 环境变量这条路 main 上照样有，rl_config 只是把它和别的 RL 默认值打包，不是替代 |
| 混合批的注意力 | 不特判 | 同 v0.23 | 批不变模式下，一批里同时有 prefill 和 decode 就走 `_forward_fia_chunked_prefill_split`，拆成两次 FIA [C30] | main 文档说「抢占后重算把 decode 过的 token 走成 prefill，P 与 D 对不齐」，这一行就是它在代码里的落点 |
| 硬件 | Atlas A2 / A3 | 同 v0.23 | 加上 950PR 与 950DT [S36] | — |

## 常见误解

- **「批不变 = 加了 seed 就能复现」**——两件事。带 seed 的采样保证**同样的 logits 得到同样的 token**；批不变保证的是**同样的输入在不同批里得到同样的 logits**。上游那个 needle 用例两件都做了：种子固定成 `20240919`，仍然要靠批不变才能让同一条 prompt 在 bs=1 和 bs=144 下输出一致。
- **「开了 `VLLM_BATCH_INVARIANT=1` 就生效了」**——还得先有算子。Triton 和 AscendC 两条供应链都不在场时，只打一条 warning 就跳过 [C2]；而 AscendC 那个包要在**编译 vllm-ascend 之前**设好同一个变量才会被装上 [S23]，装完的 wheel 事后设是补不回来的。
- **「它是 FA3 的一部分」**——反了。v0.23 / v0.26 上 FA3 把批不变当作前提，批不变自己不依赖 FA3；它换注意力的办法是把 `torch_npu.npu_fused_infer_attention_score` 整个替掉。
- **「上游 `envs.py` 注释写着要 compute capability ≥ 9.0，昇腾上用不了」**——那条注释是给 CUDA 侧写的 [C16] [!]。昇腾这边的前提是 Atlas A2 / A3（main 起还有 950）加上装好的 `batch_invariant_ops`。
