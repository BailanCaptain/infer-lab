---
id: batch-invariance
title: 批不变性：相同输入为何会随同批请求改变结果
type: feature
summary: 同一条请求换了同批的伙伴，浮点加法的分组就可能变，末位随之变化。本页先讲这件事怎么发生，再讲把加法顺序钉死的做法、要付的代价，以及 GLM 双机上的启用状态与缺口。
aliases:
- Batch Invariance
- 批不变
- 批不变性
- 批次不变性
- batch_invariant_ops
- init_batch_invariance
- enable_batch_invariant_mode
- npu_mm_batch_invariant
- npu_fused_infer_attention_score_batch_invariant
- matmul_persistent
- 逐位可复现
- HCCL_DETERMINISTIC
chapters:
- '16'
order: 60
sources:
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L99-L138
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L76-L95
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L140-L163
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L50-L74
- vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L101-L177
- vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L25-L98
- vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/softmax.py#L22-L29
- vllm-ascend@db701c1f:vllm_ascend/utils.py#L408-L441
- vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169
- vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2217-L2235
- vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L978
- vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L156
- vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L258-L263
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L809-L840
- vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L95-L100
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L3-L31
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L111-L134
- vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L188
- vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L24-L30
- vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L65-L84
- vllm-ascend@baa023ad:vllm_ascend/batch_invariant.py#L120-L140
- vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292
- vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L930-L945
- vllm-ascend@2ed6cbba:vllm_ascend/batch_invariant.py#L76-L92
- vllm@0fc695fc:vllm/envs.py#L596-L598
- vllm@0fc695fc:vllm/model_executor/layers/batch_invariant.py#L914-L919
- vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1121-L1121
- vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_invariant.py#L149-L200
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
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
contradicts: []
updated: '2026-09-29'
origin: seed
---

## 单独重跑同一个问题，回答却分叉了

排查线上问题时常有这么一幕：一条回答看着不对，把同样的问题、同样的参数单独拿出来重跑一遍想复现，结果跑到中途就和线上那条分叉了，后面整段对不上。温度已经设成 0，每一步都挑分数最高的那个词，随机从哪来？

差别不在参数，在**同伴**。线上那条请求是和几十条别人的请求拼在一个批里算的，单独重跑时批里只有它自己（多条请求怎样拼成一批，见[并发请求](concurrent-requests.md)）。默认实现下，这一批有多大会改变计算结果的**末位**；末位一变，两个候选词分数咬得很近的那一步就会选出另一个词，后面整条回答跟着走岔。

**batch invariance（批不变性）**治的就是这件事。它要保证的是：同一条请求，不管单独跑还是混在上百条里跑，输出逐位相同，与批大小、批内顺序都无关。手段不是「算得更准」，而是把矩阵乘、求和、softmax、attention 换成**加法顺序与批形状无关**的实现。

```wiki-diagram
file: batch-invariance
```

## 为什么末位会跟着批变：同一个和，分几份来加

模型里最多的计算是矩阵乘，而矩阵乘的每个输出数，都是一长串乘积加在一起（见[矩阵乘与权重](matmul-and-weights.md)）。实数加法满足结合律，浮点加法却要在每一步之后把结果舍回可表示的数，于是**分组方式一换，结果的末位就跟着变**。

拿 float32 举一个能手算的例子，舍入规则是通常的「就近舍入，恰好居中时取偶数」。float32 在 16,777,216（2²⁴）以上相邻两个可表示数相差 2，所以 16,777,216 + 1 这个真实值卡在两个可表示数中间，被舍回 16,777,216，那个 1 就这么丢了：

```calc
title: 同样三个数，换个加法分组，float32 的结果就不同（a = 16,777,216，b = 1，c = −16,777,216）
第一种分组，先加 a 与 b = 16,777,216 + 1 = 16,777,217 → 舍回 = 16,777,216
再加 c = 16,777,216 − 16,777,216 = 0
第二种分组，先加 b 与 c = 1 − 16,777,216 = −16,777,215（能精确表示）
再加 a = −16,777,215 + 16,777,216 = 1
> 同样三个数，一个得 0，一个得 1。不是谁算错了，是舍入的必然结果。
```

再把这件事放回矩阵乘。假设一个输出数背后是 512 个乘积相加，高性能矩阵乘会**按这一批有多少 token 去挑策略**：token 少，算力闲着，就把这 512 项拆成几段并行地加，最后再把几段的小计合起来；token 多，机器本来就忙，就一路从头加到尾。于是同一条请求换一批同伴，加法的分组换了，末位就变了。

误差本身极小，通常落在最后一两位。但模型要过几十层，每层都有成千上万个这样的和，末位的差异会被一层层带下去；到最后一步算词表分数时，只要前两名的差小于这点误差，选出来的词就换了人。**固定随机种子挡不住这件事**：种子管的是「从同一张分数表里怎么抽」，批不变管的是「同一条输入能不能算出同一张分数表」。

## 怎么做：把每条加法链钉死

思路很直接——不让批的大小决定加法怎么分组，而是**写死**它。

换上来的矩阵乘用固定的分块（tiling）。设这一步的矩阵乘是 `[M, K] × [K, N]`：M 是批里的行数（有多少 token），K 是每个输出数要加的项数。关键只有一条：**沿 K 方向从第一段一路加到最后一段，中间不换人，也不把 K 切给别的计算单元并行**——每个输出块自己开一个 fp32 累加器。`mm`、`matmul`、`bmm`、`addmm` 共用的那个实现把三个方向的分块都写死成 `128 × 128 × 64`；`linear` 那条只把 K 方向的分块钉死，M、N 方向仍按形状和核数挑；这不影响批不变，因为加法只沿 K 方向累加，M、N 怎么切都不改变每个输出数的加法顺序。

值得对照的是上游在 GPU 上的做法：那边确认批间差异的唯一来源是把 K 切开并行（split-K），所以钉死一项库配置就够了。昇腾这边没有这条捷径，只能把一整批算子换成批不变的实现——这就是下面那张表要讲的事。

```calc
title: 钉死之后，加法顺序只由 K 决定（示意 K = 512）
K 方向切成几段 = 512 ÷ 64 = 8
一个输出数的加法链 = 段 1 → 段 2 → … → 段 8 = 固定 8 步
批里 1 行时铺开几个块 = ceil(1 / 128) = 1
批里 300 行时铺开几个块 = ceil(300 / 128) = 3
> 批从 1 行涨到 300 行，铺开的输出块从 1 个变成 3 个，但每个块里每条加法链仍是「段 1 → 段 8」这 8 步。块的个数由批决定，链内的顺序不由批决定——这就是批不变。
```

其余几步照同一个思路办：

- softmax 不用融合实现，拆成求最大、减、取指数、求和、除五小步，步步确定；
- attention 整个换成批不变版的实现，求和也换成固定顺序的版本；
- 带残差的归一化从一个融合算子拆成「先加残差、再归一化」两步。

多卡还有跨卡的一笔账：张量并行下每张卡只算一个和当中的一截，再跨卡相加（见[张量并行](tensor-parallel.md)），这条跨卡加法的顺序同样得钉死。开关打开时会把 HCCL / LCCL 的确定性选项一并设好，让 [All-Reduce](collective-communication.md#all-reduce) 每次按同样的次序合并。

换实现不是「把所有矩阵乘统一换成同一个 kernel」，而是看手边有哪套批不变算子可用，按条件挂：

| 条件 | 挂上来的实现 |
|---|---|
| AscendC 批不变库可用 | 优先替换 `mm` / `matmul` / `sum`，以及 attention、带残差的归一化两处 |
| 没有 AscendC 库，但 Triton 可用 | `mm` / `matmul` / `linear` 用 Triton 回退实现 |
| 只要 Triton 可用（与上两行叠加） | 再替换 `addmm` / `bmm` / `softmax` 等路径——AscendC 没做这几个，它在场也照样用 Triton 版 |
| 两套都不可用 | 打一条警告，跳过注册——开关设了但没生效 |

另外，AscendC 在场时反而**不**注册 `linear`：`linear` 内部会去调 `matmul`，走 AscendC 那条更快。还有三处派发表拦不到（`torch_npu` 的融合 attention 与带残差归一化两个普通函数、Python 层的 `torch.sum`），靠直接给这三个名字赋上新实现。

## 代价：加速算子整层下线

批不变不是白拿的。它要求每一步都用「顺序确定」的实现，而仓库里有一部分 Ascend 自定义算子没做批不变，于是开关一开，这层自己编译的加速算子**整体不参与**，模型掉回通用实现（这层算子是什么，见[算子与核函数](ops-and-kernels.md)）。能看出来的代价有四处：

- 矩阵乘沿 K 方向的分块被钉死，`mm` / `matmul` 那条连 M、N 方向也不再按形状调优；
- 带残差的归一化从一个融合步拆成两步；
- 采样退回上游的通用实现；
- 跨卡通信被迫走确定性路径。

官方文档对这笔开销只给了一句定性说明：这是为可复现性有意付的性能代价。它没有给倍数，也没有给基准，本页不替它编一个。

还有几件事它管不了，得自己动手关：官方文档在 main 上写明 chunked prefill、prefix caching、抢占都不支持，而且**不会自动关**——不关也不报错，只是悄悄失去可复现性。v0.23 与 v0.26 的文档还要求图捕获只用分段模式（各取值的含义见 [ACLGraph](acl-graph.md)）。

## 怎么验证：文本一样不等于逐位一样

要判断「批不变到底成立没有」，先得说清在比什么：

- **比生成的文本**，只能判断这次测试条件下 token 序列是否相同。文本相同只说明没有哪一步把分数的排序比翻，不代表中间计算逐位一致。
- **比 logits 张量**，才能检查对应位置的数值误差，或者逐位是否一致。

两者要分别记录，不能互相替代。测的时候还要把模型、权重、输入、采样设置与软件版本全部固定，只改变同批的请求与批形状，差异才归因得到批上。

上游的端到端测试就是这么设计的：先把一条「大海捞针」问题单独跑一遍存成基线，再把同一条问题塞进 72～144 条随机长度问题中间的随机位置，连跑 5 轮，要求每一轮生成的文本与基线一字不差，随机种子固定。这套办法测的是文本一致，不是逐位一致。

官方明确验过的模型只有四个 Qwen3（两个稠密、两个 MoE），功能本身还标着 beta。换一个模型，就要照上面的办法自己测。

## 放到 GLM 双机：这套部署没有开它

[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的启动命令里没有设这个开关，环境变量默认是关的，所以主线上的每一个数字都是**默认实现**跑出来的。本页讲的是机制，没有这套部署上的数值误差实测值。

不过这套部署恰好把「批会变」这件事放大得很清楚。调度器每一步只有一个 token 预算表：在跑的请求各拿 4 个 token，剩下的预算留给新请求做 prefill（底稿 01 §B2）。于是同一条请求这一步的同伴，和下一步的同伴可以差出两个数量级：

| 这一步批里有什么 | 本步 token 数 | 这一步的计算长什么样 |
|---|---|---|
| 12 条 decode | 48 | 纯 decode，本组补到图尺寸 64，另一组（7 条 decode、28 token）补到 32 后再按两组最大值对齐到 64 |
| 12 条 decode ＋ 1 条 6000 token 的 prefill | 6,048 | 形状差了两个数量级，MoE 还整体翻到 ALLGATHER 路径 |

两行的数取自底稿 01 §B2 与 02 §8，推导见[并发请求](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)与[数据并行](data-parallel.md)。同一条 decode 请求在这两步里的计算环境完全不同——这正是批不变性想要抹平的东西。

真要在这套部署上打开它，先得知道有三处是冲着它来的：

- **chunked prefill 默认开着。** 一条长提示词会被切成几步算完（[分块预填充](chunked-prefill.md)），而官方文档把它列进不支持的名单，还要求自己显式关掉。
- **图捕获是整段 decode 图。** 部署用的是 `FULL_DECODE_ONLY`，而 v0.23 / v0.26 的文档要求批不变只用分段捕获（main 删掉了这条 note，但三个版本的代码都不校验）。
- **prefix caching 本来就是关的**（模型是混合 attention，vLLM 对这类模型默认不开，见底稿 01 §A2.3），这一条反而不用动。

把这三项调好之后，还有三处**覆盖缺口**，都是这个模型特有的：

- **线性 attention 那些层不在替换名单里。** 这个模型 45 层里有 34 层用 KDA 线性 attention（见[线性注意力](linear-attention.md)），走的是它自己那套 Triton 核；上面那份换实现的名单管得住矩阵乘、归一化、softmax、求和以及全 attention 用的那个 attention 函数，管不到它。上一节那份官方验过的模型名单里也没有混合 attention 模型。
- **直接调扩展算子的路径绕过了门禁。** 「自定义算子整层下线」靠的是一道统一门禁，但 GLM 实现里有些地方直接调用扩展算子、不经过这道门禁，例如 mHC 的前后处理和稀疏 MLA 的索引器。不能因为门禁关了就断定它们全被换掉了。
- **这道门禁同时是扩展的加载入口。** 它返回否的时候，自编译扩展根本不会被导入，而全仓生产代码里只有这一个导入点。照源码推下去：在这套部署上打开批不变，GLM 每层都要用的那几个扩展算子就拿不到了。**这一步是推的，没有设备验证**，见本页末的待核清单。

所以在这套部署上，「开了开关就一定逐位可复现」是没有依据的：缺哪些证据，列在常见误解之后。

## 常见误解

- **「固定随机种子就能复现。」** 两件事。种子保证同样的分数表抽出同样的词；批不变保证同样的输入在不同批里算出同样的分数表。官方那组测试两件都做了：种子固定，仍然要靠批不变才能让同一条问题在 1 条和 144 条的批里输出一致。
- **「输出文本一样，说明中间每一步都逐 bit 相同。」** 反推不成立，理由见[怎么验证](#怎么验证文本一样不等于逐位一样)。
- **「这是模型算错了，或者是精度 bug。」** 都不是。前面 a、b、c 那个例子说明，即使每一步都严格按规则舍入，换个加法分组结果也会不同。批不变要做的是固定分组，不是提高精度。
- **「它是 Flash Attention 3 的一部分。」** 反了。v0.23 / v0.26 上是 Flash Attention 3 把批不变当作前提去校验；批不变自己不依赖它，它换 attention 的办法是把默认的融合 attention 函数整个替掉。

**待核**（本页没能核实的三件事）：

- 这套部署上没有跑过官方那组端到端验证，也就没有数值误差的实测值；
- 开关前后的吞吐与时延对照，官方与本部署都没有数；
- 「门禁一关，自编译扩展就拿不到」这一步只推到源码为止，要实机确认打开批不变之后服务还起不起得来。

## 对照源码

### 怎么开

设环境变量后启动服务，图捕获用分段模式：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve <model> \
 --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

- 默认值是 `0`，读的是 vLLM 上游 `envs.py` 里那一条。[C3]
- main 的示例改成 `--no-enable-chunked-prefill --no-enable-prefix-caching --block-size 128`：前两个是文档写明的不支持项，`--block-size 128` 不多余，因为块大小只有在开了 prefix caching 或 chunked prefill 时才会被顶成 128，两个都关掉就得自己给。[S18]
- 安装是硬性前提：AscendC 的 `batch_invariant_ops` 不随普通 wheel 发布，要在**编译 vllm-ascend 之前**就设好 `VLLM_BATCH_INVARIANT=1`，让安装过程把这套算子装进去；装完的 wheel 事后设是补不回来的。[S16]
- 硬件：v0.23 与 v0.26 写 Atlas A2 / A3；main 加上 950PR 与 950DT。[S19] 上游 `envs.py` 那条注释里的「compute capability ≥ 9.0」是给 CUDA 侧写的，昇腾不看这一条。[C25]
- 跨卡与权重格式由 `init_batch_invariance()` 自动钉死，不用自己设：`HCCL_DETERMINISTIC=strict`、`LCCL_DETERMINISTIC=1`、`torch.use_deterministic_algorithms(True, warn_only=True)`，并把 `weight_nz_mode` 压成 0，不让权重走 NZ 格式。
- 验证办法照上游的端到端测试（用的模型是 Qwen3-0.6B）：needle prompt 单独跑存基线，再塞进 72～144 条随机 prompt 的随机位置，连跑 5 轮要求逐字相同，种子固定 `20240919`。[C28]
- main 另有一条路：`rl_config.enable_batch_invariant` 为真时由 `RlConfig.apply()` 去设同一个环境变量，但要 `rl_config.enabled` 同时为真才生效。环境变量这条路 main 上照样有，`rl_config` 只是把它和别的 RL 默认值打包。[C22]

### 会报什么错

最要紧的恰恰是**不报错**的三处：

- Triton 与 AscendC 两条供应链都不在场时，`init_batch_invariance()` 只打一条 warning 就跳过，服务照常起来——开关设了但没生效。
- 图捕获配成整图模式：文档说批不变的 attention 算子不支持它，但代码里没有一处去校验。配错了不报错，只是不可复现。
- `enable_async_exponential` 只有在批不变关闭时才为真，开了批不变它被静默置回 `False`，一条日志都没有，见 [enable_async_exponential](../params/enable-async-exponential.md)。[C13]

真会报错的一处在 v0.23 / v0.26：`reduce_sum` 的适用条件太宽（NPU 张量且 `dim` 不是 `None` 就走批不变实现），而算子本身只支持最后一维，别的维会报 `AclNN_Parameter_Error`；main 把条件收紧了。[C20]

### 开销和什么时候别开

- 文档对开销只给一句定性说明：以性能换可复现性，没有倍数、没有基准。[S17]
- 定性的开销有四处：`mm` / `matmul` 的 Triton 回退用固定 `128 × 128 × 64` 分块，不按形状调优，`linear` 那条也钉死了 K 方向 [C5]；自定义算子整层下线 [C8]；带残差的归一化从一个融合算子拆成两步；采样退回上游通用实现 [C12]。
- 互斥与不支持：chunked prefill、prefix caching、抢占（main 文档明说且不会自动关）；v0.23 / v0.26 的文档要求只用分段捕获；`enable_matmul_allreduce` 在 v0.23 由代码强制置 `False`，v0.26 起这一行删了、保护没了，见 [enable_matmul_allreduce](../params/enable-matmul-allreduce.md)。[C24]
- 什么时候别开：追吞吐的线上服务不要开。它的用处是排查——要拿到可复现的文本、要做严格的数值对照、或者要做强化学习的 rollout 时才开。
- 混合 attention 模型要格外当心：线性 attention 走的是另一套专用核，不在替换名单里，官方测过的模型名单里也没有混合 attention 模型，逐位相同对这类模型没有官方背书。

### 版本差异

这个特性最早在框架的 v0.13.0 上落地（PR #5517）。[S27]三个在册版本上 `vllm_ascend/batch_invariant.py` 与官方特性文档都在，差异集中在下表。v0.23 一列看的是维护分支 `2c59ff10`（不含 GLM 代码）；含 GLM 代码的 `db701c1f` 是 orphan commit，这个文件与 v0.23 逐字一致。

| 项 | v0.23（`2c59ff10`）| v0.26（`2ed6cbba`）| main（`baa023ad`）| 意味着什么 |
|---|---|---|---|---|
| `enable_matmul_allreduce` | 批不变模式下强制置 `False` | 这一行删了 | 同 v0.26 | v0.23 上两者互斥由代码保证，之后这层保护没了，要自己确认没开 |
| `reduce_sum` 适用范围 | NPU 张量且 `dim` 不是 `None` 就走批不变实现 | 同 v0.23 | 收紧成只处理最后一维、且 dtype 是 fp16 / fp32 / bf16，其余退回原生实现 | 旧条件真会撞上 `AclNN_Parameter_Error`，main 修掉了 |
| `aten::sum` | 注册成 AscendC 的批不变求和 | 同 v0.23 | 注销，改成给 `torch.sum` 与 `torch.Tensor.sum` 直接赋值 [C21] | 走 aten 派发过来的 `sum`（例如被编译捕获进图的那些）在 main 上不再被换掉 |
| 调度限制 | 文档整篇不提 | 同 v0.23 | 多出一节，写明 chunked prefill、prefix caching、抢占都不支持且不会自动关 | 照 v0.23 那篇文档配出来的服务其实不可复现，坑到 main 才写明 |
| 图捕获 | 文档要求分段模式，不支持整图 [S17] | 同 v0.23 | 这条 note 连同改进计划里对应那条一起删了 | 三个版本的代码里都没有对应校验，删掉不等于支持了 |
| 混合批的 attention | 不特判 | 同 v0.23 | 批不变模式下一批里同时有 prefill 和 decode 就拆成两次算 [C23] | 与「抢占后重算会让两类 token 混在一起」这条限制对应 |
| 开关入口 | 只有环境变量 | 同 v0.23 | 多一条 `rl_config` 的路 | 环境变量这条路 main 上照样有，`rl_config` 只是打包 |

### 源码位置

- 入口与时机：`init_batch_invariance()` 在 worker 初始化分布式环境的第一行调用，比通信域建起来还早，每个 rank 各跑一次；覆盖是进程级的，过了这一步，本进程后续每一次前向用的都是换过的实现。[C11]
- 环境覆盖：`override_envs_for_invariance()` 负责压 `weight_nz_mode`、设 HCCL / LCCL 确定性变量、开 PyTorch 确定性算法（`warn_only=True`，遇到限制只警告不中止）。
- 派发表：`enable_batch_invariant_mode()` 建一个 `aten` 的实现库，往 NPU 派发键上挂实现，挂什么取决于 AscendC 的 `batch_invariant_ops` 与 Triton 两条供应链谁在场：两条都在场时 `mm` / `matmul` / `sum` 用 AscendC，`addmm` / `bmm` / `softmax` 仍用 Triton，`linear` 不挂；两套都缺席就只打一条 warning。派发表拦不到的三处靠直接赋值覆盖：`torch_npu.npu_fused_infer_attention_score`、`torch_npu.npu_add_rms_norm`，以及 Python 层的 `torch.sum`。[C1]
- Triton 回退核：`vllm_ascend/ops/triton/batch_invariant/matmul.py`，四个矩阵乘入口最后都落到同一个 persistent kernel，区别只是先怎么把张量拍成二维；它的分块参数写死，沿 K 方向单调累加，`tl.dot` 的 `allow_tf32` 也关掉 [C5]。`linear` 那条是另一个 kernel，只钉死 K 方向。softmax 的五小步在同目录下 [C7]。
- 连锁下线：`vllm_ascend/utils.py` 的 `enable_custom_op()` 在批不变模式下直接返回 `False`，注释给的理由就是有一部分自定义算子没做批不变；这个函数同时是自编译扩展的唯一导入点。[C8]
- 绕过门禁的例子：`vllm_ascend/models/glm5_next.py` 里 mHC 的前后处理，以及每层前向对它的调用，都直接走扩展算子，不经过上面那道门禁。[C9][C10]
- KDA 的核：同一个文件从 `vllm_ascend/ops/triton/kda/` 导入线性 attention 用的 kernel。[C15]
- Flash Attention 3 那道闸：v0.23 / v0.26 上后端选择读的是「批不变是否已启用」，方向是 FA3 依赖批不变。[C14]
- 上游对照：上游在自己那份实现的注释里写明，在 Hopper 与 Blackwell 上批间差异的唯一来源就是 split-K，钉死 cuBLAS 的 workspace 配置即可；昇腾没有这条捷径，才要整批换实现。[C26]
