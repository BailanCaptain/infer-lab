---
id: batch-invariance
title: 批不变性：相同输入为何会随同批请求改变结果
type: feature
legacyAnchors:
  放到-glm-双机这套部署没有开它: 混批形状改变时，哪些层仍可能产生分歧
  复杂异构实战对照glm-双机混批跨度与三处算子覆盖边界: 混批形状改变时，哪些层仍可能产生分歧
summary: >-
  同一条请求换了同批的伙伴，浮点加法的分组就可能变，末位随之变化。本页先讲这件事怎么发生，再讲把加法顺序钉死的做法、要付的代价，以及混合线性注意力与自定义扩展算子在异构模型上的覆盖边界。
aliases:
  - Batch Invariance
  - 批不变
  - 批不变性
  - 批次不变性
  - VLLM_BATCH_INVARIANT
  - split-K
  - batch_invariant_ops
  - init_batch_invariance
  - enable_batch_invariant_mode
  - npu_mm_batch_invariant
  - npu_fused_infer_attention_score_batch_invariant
  - matmul_persistent
  - 逐位可复现
  - HCCL_DETERMINISTIC
  - LCCL_DETERMINISTIC
chapters:
  - '16'
order: 60
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L99-L138'
  - 'vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L76-L95'
  - 'vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L140-L163'
  - 'vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L50-L74'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L101-L177
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L25-L98
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/softmax.py#L22-L29
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L408-L468'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2217-L2235'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L978'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L156'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L258-L263'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L809-L840'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L95-L100'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L3-L31
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L111-L134
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L200
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L24-L30
  - 'vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L65-L84'
  - 'vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L120-L140'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L850-L947'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/batch_invariant.py#L76-L92'
  - 'vllm@0fc695fc:vllm/envs.py#L596-L598'
  - 'vllm@0fc695fc:vllm/model_executor/layers/batch_invariant.py#L897-L950'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1121-L1121'
  - >-
    vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_invariant.py#L93-L210
  - 'vllm-ascend@7d825229:vllm_ascend/batch_invariant.py#L65-L99'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L179-L350'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L28-L82'
  - 'vllm-ascend@baa023ad:csrc/build_batch_invariant_ops.sh#L14-L103'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1316-L1377'
  - 'vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_invariant.py#L78-L91'
  - 'vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_invariant.py#L213-L410'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L353-L441'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L544-L590'
  - 'vllm-ascend@c09d3e20:vllm_ascend/batch_invariant.py#L68-L189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L975-L1085'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L380-L396'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L574-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/batch_invariant.py#L68-L194'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L1055-L1165'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L396-L412'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 矩阵乘的每个输出数都是一长串乘积相加。
  - to: concurrent-requests
    kind: builds-on
    note: 同一条请求每一步都可能和不同的请求凑成一批。
  - to: ops-and-kernels
    kind: builds-on
    note: 同一个算子可以有多种 kernel 实现。
  - to: collective-communication
    kind: builds-on
    note: 跨卡求和的顺序同样要钉死。
  - to: acl-graph
    kind: conflicts-with
    note: >-
      v0.23 / v0.26 指南明确不支持 FULL 与 FULL_DECODE_ONLY，并用分段捕获举例；这与 GLM 双机的整趟 decode 图配置冲突，不能外推为与所有 ACL Graph 模式互斥。
  - to: op-to-ai-core
    kind: builds-on
    note: 批不变矩阵乘通过固定分块和 K 方向的累加顺序消除批形状影响；算子的分块规划与设备工作划分为理解这种约束提供基础。
contradicts: []
updated: '2026-11-24'
origin: direct
---

## 单独重跑同一个问题，回答却分叉了

排查线上问题时常有这么一幕：一条回答看着不对，把同样的问题、同样的参数单独拿出来重跑一遍想复现，结果跑到中途就和线上那条分叉了，后面整段对不上。温度已经设成 0，每一步都挑分数最高的那个词，随机从哪来？

需要排查的一类差别在**同伴**：线上请求和别人的请求拼在一个批里，单独重跑时批里只有它自己（见[并发请求](concurrent-requests.md)）。若实现按批形状选择不同计算策略，且由此产生的数值差异翻转了两个候选 token 的排序，后面的回答就会分叉。排错时仍须先排除输入、模板、权重和采样设置变化，不能仅凭输出不同就认定是批形状造成的。

**batch invariance（批不变性）**针对的是同一输入因批大小、批内顺序而发生的数值变化，在 vLLM 与 vLLM Ascend 中通过环境变量 `VLLM_BATCH_INVARIANT=1`（或 `rl_config` 联动开关）开启。目标是在其余条件相同、受支持的执行路径上，单独跑和混批跑得到相同的结果。一线决策先看清适用边界：

- **什么时候该开**：排查线上首次数值分歧、强化学习（RL）rollout 要求固定对数概率与轨迹复现、或做严格同输入 A/B 回归对照。
- **什么时候别常开**：高吞吐在线服务不要盲目常开——开启后会经 `enable_custom_op()` 一刀切禁用 `vllm_ascend_C` 自定义融合核、把残差融合归一化拆成两步、强制 `weight_nz_mode=0` 与 `HCCL_DETERMINISTIC=strict`，且还需手动加上 `--no-enable-chunked-prefill` 与 `--no-enable-prefix-caching`。启用 `VLLM_BATCH_INVARIANT=1` 也不等于所有模型（尤其混合注意力模型）都已获得逐位一致保证；后文分别说明实现覆盖、调度限制与怎样验证。

```wiki-diagram
file: batch-invariance
```

## 为什么末位会跟着批变：同一个和，分几份来加

矩阵乘的每个输出数是一串乘积之和（见[矩阵乘与权重](matmul-and-weights.md)）。实数加法满足结合律，浮点计算却要舍入到可表示的数，因此**一旦改变加法分组，在舍入边界上就会改变结果**。

拿 float32 举一个能手算的例子，舍入规则是通常的「就近舍入，恰好居中时取偶数」。float32 在 $[2^{24}, 2^{25})$ 这段正数范围内，相邻可表示数相差 2。$16{,}777{,}216 + 1$ 恰好居中，被舍回 $16{,}777{,}216$，那个 1 就这么丢了（取 $a = 16{,}777{,}216,\; b = 1,\; c = -16{,}777{,}216$；不是谁算错了，是浮点舍入的必然结果）：

$$(a + b) + c = \text{fl}(16{,}777{,}216 + 1) - 16{,}777{,}216 = 0 \;\neq\; a + (b + c) = 16{,}777{,}216 + (-16{,}777{,}215) = 1$$

| 加法分组方式（float32，三个数完全相同） | 第一步（含舍入） | 第二步 | 最终结果 |
| --- | --- | --- | --- |
| 先加 $a$ 与 $b$，再加 $c$ | $16{,}777{,}216 + 1 = 16{,}777{,}217 \to \text{舍回 } 16{,}777{,}216$ | $16{,}777{,}216 - 16{,}777{,}216$ | **0** |
| 先加 $b$ 与 $c$，再加 $a$ | $1 - 16{,}777{,}216 = -16{,}777{,}215$（可精确表示） | $-16{,}777{,}215 + 16{,}777{,}216$ | **1** |

再把这件事放回矩阵乘。假设一个输出数是 512 个乘积之和，一种加速策略把归约维 $K$ 拆成几段并行计算、最后再合并各段小计（矩阵乘优化中称为 **`split-K`**，常见于小批为了吃满计算核）；另一种策略让单个输出块沿 $K$ 方向按固定顺序依次累加。如果底层算子库随批形状在 `split-K` 与串行累加之间切换，同一条请求换批时就改变了加法分组。图用小批与大批演示这组条件；实际硬件各形状选择的策略须查对应实现与运行记录。

```wiki-diagram
file: batch-invariance-fig-fp-splitk
```

误差的大小取决于数值范围、抵消和后续运算：有的只影响末位，有的会放大，不能统一限定为最后一两位。若最终两个最高候选的排序翻转，即使采用贪心采样也会选到不同 token。**固定随机种子不能修复分数表本身的变化**；即使分数表相同，随机采样还要固定随机数流、采样实现和消费顺序等条件。

## 怎么做：把每条加法链钉死

思路很直接——不让批的大小决定加法怎么分组，而是**写死**它。在 `v0.30.0` 主基线与 `main` 中，昇腾侧通过「**AscendC 批不变算子库优先 + Triton 确定性核回退补位**」双供应链替换矩阵乘、注意力与归约入口，并在 `attention_v1` 中将无 sink、因果且非滑窗的混合批按 prefill 与 decode 拆开计算，避免混批改变注意力归约路径。

用源码完全透明的 **Triton 回退矩阵乘**（自 `v0.23.0` / `db701c1f` 延续至今的确定性回退核；注意不要把它的具体分块数字直接套到闭源编译的 AscendC 库）最能看清底层怎样锁死归约顺序。设矩阵乘是 `[M, K] × [K, N]`：M 是行数，K 是每个输出数对应的归约长度。该回退让每个输出块保有 fp32 累加器，沿 K 分块循环，不把同一个输出块的 K 段分给多个 Triton program 再合并（即杜绝 `split-K` 分段合并变化）。`mm`、`matmul`、`bmm`、`addmm` 复用的实现固定为 `128 × 128 × 64`。`linear` 另走一个核：非空矩阵的 K 块通常为 256，float32 为 128；M、N 仍按形状与核数选择。固定 K 循环是其设计手段，源码本身不是所有设备、编译器和输入下逐位一致的实验报告。

上游 GPU 实现也按硬件与算子分别处理。上游固定基线（`vllm@0fc695fc`）的注释在 Hopper／Blackwell 矩阵乘分支把 `split-K` 作为要抑制的差异来源，该分支设置了两个 cuBLAS 环境项；Ampere 则注册 Triton 矩阵乘。后面还统一替换 softmax、mean、bmm 等算子。因此，不能把这段注释扩写成「GPU 的全部批间差异只有 split-K、改一个配置就够了」。

以 $K = 512$、固定 $K$ 分块 $64$、$M$ 方向块高 $128$（只看单个 $N$ 方向输出块）做设计示意。固定这一份回退实现后，$M$ 方向输出块随批次行数从 1 个变成 3 个，但每个输出块沿 $K$ 方向的加法链始终锁死为段 1 到段 8 共 8 步（该算例说明避免批大小改变 $K$ 段合并方式的原理，不替代整模型一致性测试）：

$$N_K = \frac{512}{64} = 8\text{ 段}, \qquad B_{M=1} = \lceil 1 / 128 \rceil = 1\text{ 块}, \qquad B_{M=300} = \lceil 300 / 128 \rceil = 3\text{ 块}$$

| 批次行数 $M$（固定 $K = 512$、$K$ 块 $64$·示意） | $M$ 方向铺开的输出块数 | 每个输出数的 $K$ 方向加法链 |
| --- | --- | --- |
| $M = 1$ 行 | $\lceil 1 / 128 \rceil = 1$ 块 | 段 1 $\to$ 段 2 $\to \dots \to$ 段 8（**固定 8 步**） |
| $M = 300$ 行 | $\lceil 300 / 128 \rceil = 3$ 块 | 段 1 $\to$ 段 2 $\to \dots \to$ 段 8（**固定 8 步**） |

其余几步照同一个思路办：

- softmax 回退按求最大、减、取指数、求和、除五个运算表达，实际归约仍依赖所调用实现；
- AscendC 库可用时，替换指定的融合 attention 与求和入口，不覆盖所有 attention 后端；
- 同样在 AscendC 分支中，把指定的带残差归一化入口改为先加残差、再调用归一化。

多卡还要处理跨卡归约（见[张量并行](tensor-parallel.md)）。至少一套回退库可用、初始化分支执行时，会设置 **HCCL**（昇腾跨卡集合通信库）／**LCCL**（昇腾核内高速通信库）确定性选项并启用 PyTorch 确定性模式，后者使用 `warn_only=True`。这些设置表达确定性要求，不单独证明任意通信拓扑、算子或整个模型都满足逐位一致。

换实现不是「把所有矩阵乘统一换成同一个 kernel」，而是看手边有哪套批不变算子可用，按条件挂：

| 条件 | 挂上来的实现 |
|---|---|
| AscendC 批不变库可用 | 优先替换 `mm` / `matmul` / `sum`，以及 attention、带残差的归一化两处 |
| 没有 AscendC 库，但 Triton 可用 | `mm` / `matmul` / `linear` 用 Triton 回退实现 |
| 只要 Triton 可用（与上两行叠加） | 再替换 `addmm` / `bmm` / `softmax` 等路径——AscendC 没做这几个，它在场也照样用 Triton 版 |
| 两套都不可用 | 打警告并跳过该初始化，连环境覆盖也不执行；其他位置仍会读取环境开关，不能据此断言整个服务必然启动或完全不受影响 |

另外，AscendC 在场时反而**不**注册 `linear`：让它内部的 `matmul` 使用 AscendC 注册入口。还有三处派发表拦不到（`torch_npu` 的融合 attention 与带残差归一化两个普通函数、Python 层的 `torch.sum`），靠直接给这三个名字赋上新实现。

## 代价：部分加速路径被限制

批不变会改变可选实现。在固定基线（`db701c1f`）以及 `v0.30.0` / `main` 中，`utils.py` 的 `enable_custom_op()` 会**在进程首次调用时求值并缓存布尔结果**：只有在该进程首次求值前已设置 `VLLM_BATCH_INVARIANT=1`（或硬件缺少 `HardwareCapability.RUNTIME_CUSTOM_OPS`），门禁才会缓存 `False`，从而**禁用经过这道门禁的 `vllm_ascend_C`（昇腾自定义 AscendC 算子扩展库）懒加载与算子分派**（若进程在设置环境变量前已提前求值，缓存不会自动翻转；底层确定性环境变量与运行时消费关系见[昇腾运行时与调优](ascend-runtime-and-tuning.md)）。直接调用扩展的路径未必经过该门禁，也不保证所有模型都有完整通用回退（见[算子与核函数](ops-and-kernels.md)）。源码中可见的变化有四处：

- 矩阵乘沿 K 方向的分块被钉死，`mm` / `matmul` 那条连 M、N 方向也不再按形状调优；
- 带残差的归一化（`torch_npu.npu_add_rms_norm`）从一个融合步拆成先加残差再 `npu_rms_norm` 两步（在 `main` 中只要进入 `enable_batch_invariant_mode()` 便无条件覆盖，不再仅限 AscendC 在场分支）；
- 采样退回上游的通用实现；
- 初始化成功进入覆盖分支后，会设 `weight_nz_mode = 0`、`HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`。同时，`v0.30.0` 会启用 `torch.use_deterministic_algorithms(True, warn_only=True)`，而 `main` 改为 `torch_npu.npu.set_deterministic_level(3)`。

把双供应链算子替换优先级、全局门禁与下文 GLM-5.3-Flash 的 45 层覆盖缺口合到同一张图里，就能一眼看清“开了开关到底管住哪些层、管不住哪些层”：

```wiki-diagram
file: batch-invariance-fig-dispatch-gaps
```

本页引用的固定指南只定性提示性能代价，具体收益与开销取决于选中的实现和负载；指南及本项目均未提供该部署的开关对照实测倍数。

main／rc2 固定指南把 chunked prefill、prefix caching 和抢占列为不支持项，说明它们**不会自动关闭**。要显式禁用前两项，并通过容量规划和负载限制降低抢占机会；不是给抢占加一个不存在的关闭开关。未做专门配置拒绝，不代表运行必然成功，也不能判定每个请求都必然产生差异。v0.23／v0.26 指南用 PIECEWISE 举例，并明确不支持 FULL、FULL_DECODE_ONLY（见 [ACLGraph](acl-graph.md)）。

## 怎么验证：文本一样不等于逐位一样

要判断「批不变到底成立没有」，先得说清在比什么：

- **比生成文本**，只能确认文本相同；解码映射并非一一对应，不同 token ID 序列也能得到相同文本，不能反推 token 或内部数值一致。
- **比 token ID 与返回的 logprob**，能检查这些已返回结果，仍不代表完整词表分数都相同。
- **比完整 logits 或指定中间张量**，才能在对应位置检查数值误差；若要求原始位模式相同，还要明确 dtype、布局与逐位比较方式。

这些比较要分别记录，不能互相替代。测的时候还要固定模型、权重、输入、采样设置与软件版本，只改变同批请求与批形状，并排除其他随机或并发因素，才能判断差异是否与批变化有关。

固定 v0.26 测试把短提示词 `There once was a ` 当作 needle，先单独生成，再放入**总请求数**默认 72～144 的列表随机位置，重复默认 5 轮并比较生成文本。它不是长上下文“大海捞针”准确率测试；这些数可被环境变量覆盖，提交列表长度也不等于每一步实际执行批大小。采样默认温度为 0，设置 seed=20240919。若任一轮文本不同，末尾调用 `pytest.fail`。

同文件还用另一组测试比较 token ID 和已选 token 的逐步 logprob，通过 `torch.equal` 检查返回数值。这比单纯文本比较更细，但没有比较完整 logits，也没有覆盖所有中间张量。

验收时要把三类证据严格分开：**官方文档的已验证模型支持清单**（四个 Qwen3 稠密与 MoE 模型，功能标 beta）、**仓内自动化测试用例**（如 `Qwen3-0.6B` 的文本与已选 token logprob 回归），以及**目标硬件与实际模型上的现场逐位（bit-exact）实测证据**。前两项都不能代替换模型或换并行拓扑后的现场逐位验证。

## 混批形状改变时，哪些层仍可能产生分歧

已验证清单覆盖的是标准 `Qwen3` 稠密与 MoE 模型；一旦换到同时混装线性注意力与自定义残差核的异构大模型，只开 `VLLM_BATCH_INVARIANT=1` 并不足以兜住全部层。拿例外 B 的 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)作边界对照（官方在线启动命令默认关闭该环境变量，主线按默认实现分析，尚无该部署的数值误差实测值）：

先看这套双机部署在[并发请求示例](concurrent-requests.md)中会遇到的真实批形状跨度——在跑的请求各拿 4 个 token，剩余预算留给新请求 prefill，目标 decode 请求在相邻两步参与的总 token 数相差两个数量级：

| 这一步批里有什么 | 本步 token 数 | 这一步的计算长什么样 |
|---|---|---|
| 12 条 decode | 48 | 纯 decode，本组补到图尺寸 64，另一组（7 条 decode、28 token）补到 32 后再按两组最大值对齐到 64 |
| 12 条 decode ＋ 1 条 6000 token 的 prefill | 6,048 | 形状差了两个数量级，MoE 还整体翻到 ALLGATHER 路径 |

两行的假设与推导见[并发请求](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)与[数据并行](data-parallel.md)。同一条 decode 请求在这两步里的计算环境不同；批不变性试图避免这种变化影响它的数值结果。

要在该类部署上做批不变实验，先核对调度与图前提：默认开启的 [chunked prefill](chunked-prefill.md) 须显式加 `--no-enable-chunked-prefill` 关闭；该历史双机配方默认未开自动前缀缓存（APC，见[部署前提](glm-5-3-flash-two-node.md#部署前提)，不能外推为所有混合注意力模型默认关闭）；而旧版指南对 `FULL` / `FULL_DECODE_ONLY` 整图模式的限制与演进统一归入文末[版本差异](#版本差异)矩阵核对。

把调度前提调好之后，还有三处**模型层面的覆盖缺口**：

- **34 层 KDA 线性注意力不在替换名单里。** 该模型 45 层里有 34 层采用 KDA 线性注意力（见[线性注意力](linear-attention.md)），走独立的 Triton 递推核；批不变替换表只覆盖矩阵乘、归一化、softmax、求和与标准融合注意力入口，管不到这 34 层，官方已验证清单也未包含混合注意力模型。
- **直接调扩展算子的路径绕过了门禁。** GLM 的 mHC 前后处理直接调用底层扩展，不经过 `enable_custom_op()` 检查，不能因门禁返回 `False` 就断定这些调用已被替换。
- **门禁跳过导入与直接调用的启动序风险。** 在固定 `db701c1f` 的生产 Python 代码中，显式导入 `vllm_ascend_C` 的两条语句位于 `enable_custom_op()` 内。环境开关若在首次求值前已开启，扩展门禁会跳过导入。`mHC` 随后仍可能直接调用该扩展。排查时须在目标 Worker 进程核实实际扩展注册状态与首次前向调用结果（此处无该部署启动失败的实测记录）。

所以在这套部署上，「开了开关就一定逐位可复现」是没有依据的：缺哪些证据，列在常见误解之后。

## 常见误解

- **「固定随机种子就能复现。」** 种子不能消除分数表的数值变化，也不能单独固定全部随机数消费顺序。固定测试同时设置开关、种子与其他条件；测试代码的存在不等于所有负载上都测得同样结果。
- **「输出文本一样，说明中间每一步都逐 bit 相同。」** 反推不成立，理由见[怎么验证](#怎么验证文本一样不等于逐位一样)。
- **「批次改变结果，一定是模型算错了。」** 不一定。浮点分组变化本身可以造成差异；但实际排错也不能据此排除实现错误，要定位首次分歧。
- **「它是 Flash Attention 3 的一部分。」** 反了。v0.23 / v0.26 上是 Flash Attention 3 把批不变当作前提去校验；批不变自己不依赖它，它换 attention 的办法是把默认的融合 attention 函数整个替掉。

**这套部署尚缺的验证证据：**

- 这套部署上没有跑过官方那组端到端验证，也就没有数值误差的实测值；
- 本页引用的固定指南没有该部署的开关前后吞吐、时延对照，本项目也未测量；
- 门禁和扩展注册的相互作用只有源码分析，缺该部署的实际启动与首次前向证据。

## 对照源码

现场先做[首次分歧对照](inference-correctness-troubleshooting.md#为什么只找第一次分歧)：目标请求的输入、历史与采样相同，仅改变同批请求，记录实际批形状及对应分数。若输入或模板先变了，应先修正输入条件；只有差异收敛到批次变化后，才用本页的实现边界设计确定性实验。

### 怎么开

先安装与版本、硬件匹配的批不变算子包。下面对齐 `v0.30.0` 主基线与 `main` 指南明确列出的调度限制（以官方已验证列表所属的 `Qwen/Qwen3-8B` 为配置形式示意，未在设备上执行；不是 GLM 双机已验收命令）：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3-8B \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}' \
  --no-enable-chunked-prefill \
  --no-enable-prefix-caching \
  --block-size 128
```

- 默认值是 `0`，由上游 `envs.py` 读取。[C25]
- main 指南要求禁用 chunked prefill 时同时明确设置 `--block-size 128`。[S18] 这不能解释成“只有开前缀缓存或分块预填充才能得到 128”：main 的通用配置代码在块大小未指定时也填 128，还存在模型专用与 Xlite 分支。显式参数用于遵循该功能示例，不代替模型兼容性检查。
- 安装分两层：设备端算子包与 PyTorch 扩展 wheel。源码安装时可用 `COMPILE_CUSTOM_KERNELS=1 VLLM_BATCH_INVARIANT=1` 一起构建；已有预编译 wheel，单独补设变量不会重建算子，但 main 指南允许取得**匹配版本的源码**后执行 `csrc/build_batch_invariant_ops.sh` 补装，A2／A3／950 分别传 `ascend910b`／`ascend910_93`／`ascend950`。仅 Triton 在场时还有表中部分回退，不等于完整 AscendC 覆盖。
- 硬件：v0.23 与 v0.26 写 Atlas A2 / A3；main 加上 950PR 与 950DT。[S19] 上游 `envs.py` 那条注释里的「compute capability ≥ 9.0」是给 CUDA 侧写的，昇腾不看这一条。[C25]
- 当 `init_batch_invariance()` 进入覆盖分支时，会设 `HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`、`torch.use_deterministic_algorithms(True, warn_only=True)`，并把 `weight_nz_mode` 设为 0。检查实际初始化路径，不能仅凭环境变量已设置就假定这一步执行了。
- Qwen3-0.6B 的 needle 测试比较的是短提示词单独生成与混入总数默认 72～144 的请求列表后的文本，默认 5 轮；实际批形状仍由调度器决定，详见上文验证范围。[C28]
- main 另有一条路：`rl_config.enable_batch_invariant` 为真时由 `RlConfig.apply()` 去设同一个环境变量，但要 `rl_config.enabled` 同时为真才生效。环境变量这条路 main 上照样有，`rl_config` 只是把它和别的 RL 默认值打包。[C22]

### 会报什么错

先区分未执行、配置拒绝与运行时错误：

- 两套算子库都不在场时，`init_batch_invariance()` 打 warning 并返回；后续服务是否成功还取决于模型和其他读取该环境开关的路径。
- FULL／FULL_DECODE_ONLY 在旧指南中不受支持，初始化函数没有针对图模式的拒绝检查。不能从这里没抛错推断后续一定能运行，或只会出现数值不一致。
- 固定 db 构造器只在批不变关闭时允许 `enable_async_exponential` 为真；对应赋值不打印日志。其他版本的配置去向见 [enable_async_exponential](../params/enable-async-exponential.md)。[C13]

真会报错的一处在 v0.23 / v0.26：`reduce_sum` 的适用条件太宽（NPU 张量且 `dim` 不是 `None` 就走批不变实现），而算子本身只支持最后一维，别的维会报 `AclNN_Parameter_Error`；main 把条件收紧了。[C20]

### 开销和什么时候别开

- 固定指南仅定性说明可能影响性能，没有该部署的开关对照倍数。[S17]
- 实现变化包括 Triton 固定分块、受门禁控制的算子选择减少、指定残差归一化被拆开，以及 top-k／top-p 采样回到上游实现。它们说明可能的代价来源，不能直接相加得出固定性能损失。[C5][C8][C12]
- 调度与图限制见上文。v0.23 初始化会强制关闭 `enable_matmul_allreduce`；v0.26 删除这行时，该旧融合功能也已移除，并非留下一个需要手工关闭的可用开关。具体迁移规则见 [enable_matmul_allreduce](../params/enable-matmul-allreduce.md)。
- 以吞吐为主要目标时，要测量开启后的实际收益与代价。需要确定性排错、数值对照、[强化学习 rollout](vllm-ascend-for-rl.md#为什么-rl-需要推理端配合代价花在哪里) 或线上一致性时，都可能有启用需求，不能统一规定只在排障时用。
- 混合 attention 模型还需核对专用核。本页引用指南的已测列表没有 GLM 这种混合模型，现有替换名单与那份列表不能证明它逐位相同。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）延续 `VLLM_BATCH_INVARIANT=1` 经 `enable_custom_op()` 禁用 `vllm_ascend_C` 自定义核的总门禁，并收紧了确定性算子覆盖范围与 `reduce_sum` 签名保护；`main` 进一步将确定性接口切至 `torch_npu.npu.set_deterministic_level(3)` 并无条件拆分 `npu_add_rms_norm`。**

v0.13.0 发布说明记录了基础框架与 PR #5517 [S27]；GLM 独立快照 `db701c1f` 的 `batch_invariant.py` 与 `v0.23.0` 维护分支 `2c59ff10` 逐字一致（不把模型文件视为相同）。四版对照如下：

| 确定性核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| `vllm_ascend_C` 自定义核门禁 | `VLLM_BATCH_INVARIANT=1` 时 `enable_custom_op()` 返回 `False` 跳过扩展加载 | 同 `v0.23.0` | `utils.py#L544-L590`：`VLLM_BATCH_INVARIANT` 或缺 `RUNTIME_CUSTOM_OPS` 时禁用 `vllm_ascend_C` | `utils.py#L574-L618`：延续禁用 `vllm_ascend_C` |
| 确定性全局开关与通信覆盖 | `weight_nz_mode=0`、`HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`、`torch.use_deterministic_algorithms(True, warn_only=True)`；且置 `enable_matmul_allreduce=False` | 删除 `enable_matmul_allreduce` 赋值（旧融合已移除），其余同左 | 延续 `use_deterministic_algorithms(True, warn_only=True)` 与 HCCL/LCCL/NZ=0 覆盖（`batch_invariant.py#L102-L119`） | 改用 `torch_npu.npu.set_deterministic_level(3)`（注释明示不可在其后再调 `use_deterministic_algorithms`）（`batch_invariant.py#L102-L123`） |
| 确定性算子覆盖范围（AscendC + Triton） | AscendC 覆 `mm/matmul/sum`、FIA、`npu_add_rms_norm`；Triton 覆 `addmm/bmm/softmax` 及无 AscendC 时的 `mm/matmul/linear` | 同 `v0.23.0` | 撤销 `aten::sum` 注册，改直接覆 `torch.sum`（AscendC 在场时覆 FIA、`npu_add_rms_norm`、`mm/matmul/sum`）；`reduce_sum` 增 `axis`/`dtype` 并仅最后一维 fp16/fp32/bf16 走批不变核 | `torch_npu.npu_add_rms_norm` 提到 `enable_batch_invariant_mode()` 顶部无条件拆开；AscendC 同时覆 `torch.sum` 与 `torch.Tensor.sum` |
| 混合批 FIA 注意力拆分 | 无 | 无 | `attention_v1.py#L975-L1085`：无 sink、因果且非滑窗时按 prefill/decode 拆分计算 | `attention_v1.py#L1055-L1165`：同 `v0.30.0` |
| 开关入口与调度/图限制 | 仅环境变量；指南用 `PIECEWISE`，不支持 `FULL` / `FULL_DECODE_ONLY` [S17] | 同 `v0.23.0` | 新增 `rl_config.enabled` + `enable_batch_invariant` 联动设环境变量；指南明确不支持 chunked prefill、prefix caching、抢占且不自动关闭 | 同 `v0.30.0`（删除旧整图 note，但不等于任意整图组合已验证） |

### 源码位置

- `v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 实核：`VLLM_BATCH_INVARIANT=1` 禁用 `vllm_ascend_C` 见 `c09d3e20:utils.py#L544-L590` 与 `8d6180e2:utils.py#L574-L618`；确定性算子注册、`reduce_sum` 边界与 `set_deterministic_level(3)` 见 `c09d3e20:batch_invariant.py#L68-L189` 与 `8d6180e2:batch_invariant.py#L68-L194`；FIA 混合批拆分见 `c09d3e20:attention/attention_v1.py#L975-L1085` 与 `8d6180e2:attention/attention_v1.py#L1055-L1165`；`rl_config` 联动见 `c09d3e20:ascend_config.py#L380-L396` 与 `8d6180e2:ascend_config.py#L396-L412` [C39][C44]。

- 入口与时机：固定 worker 的 `_init_worker_distributed_environment()` 先调用 `init_batch_invariance()`，再建立分布式环境。替换是进程级的，但只有注册成功且之后经过这些入口的调用才使用替换实现。[C11]
- 环境覆盖：`override_envs_for_invariance()` 设置 `weight_nz_mode`、HCCL／LCCL 变量与 PyTorch 确定性选项。`warn_only=True` 只描述该确定性检查的处理方式，不保证其他算子或配置错误都只警告。
- 派发表：`enable_batch_invariant_mode()` 建一个 `aten` 的实现库，往 NPU 派发键上挂实现，挂什么取决于 AscendC 的 `batch_invariant_ops` 与 Triton 两条供应链谁在场：两条都在场时 `mm` / `matmul` / `sum` 用 AscendC，`addmm` / `bmm` / `softmax` 仍用 Triton，`linear` 不挂；两套都缺席就只打一条 warning。派发表拦不到的三处靠直接赋值覆盖：`torch_npu.npu_fused_infer_attention_score`、`torch_npu.npu_add_rms_norm`，以及 Python 层的 `torch.sum`。[C1]
- Triton 回退核：四个矩阵乘包装复用固定分块核，但维度处理不同，bmm 会逐个批成员调用，matmul 仅支持源码列出的组合，不是所有形状都通用展平。该核设 `allow_tf32=False`；linear 另有实现，不能把这一设置或 64 的 K 块套过去。来源 30、36 补全实际核与包装，softmax 见来源 7。
- 门禁与加载：固定 db 的 `enable_custom_op()` 先检查缓存结果；首次检查批不变环境时返回 False，随后两处扩展导入均不会执行。这个结论有启动顺序前提，来源 8 已包括正常导入与异常回退两处。[C8]
- 绕过门禁的例子：`vllm_ascend/models/glm5_next.py` 里 mHC 的前后处理，以及每层前向对它的调用，都直接走扩展算子，不经过上面那道门禁。[C9][C10]
- KDA 的核：同一个文件从 `vllm_ascend/ops/triton/kda/` 导入线性 attention 用的 kernel。[C15]
- Flash Attention 3 那道闸：v0.23 / v0.26 上后端选择读的是「批不变是否已启用」，方向是 FA3 依赖批不变。[C14]
- 上游对照：来源 26 包含完整的硬件分支及后续 softmax／mean／bmm 注册，避免把局部 split-K 注释泛化为整个 GPU 计算栈。
- 来源 31–33 补安装后手动补装的固定指南、实际脚本和块大小配置；34–35 补测试究竟提取、比较什么数值。测试代码是验证方法，不是本项目已执行通过的结果。
