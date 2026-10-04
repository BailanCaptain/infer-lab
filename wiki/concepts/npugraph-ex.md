---
id: npugraph-ex
title: 编译图融合：把相邻两步合成一个算子，再分档复用执行
type: feature
summary: 从中间张量的一写一读讲清编译期融合，列出固定源码里的四条融合规则、它们各自的条件，并区分 npugraph_ex 后端、static kernel 与分档捕获在 GLM 双机 MTP 验证那一步各自管什么。
aliases:
- 编译期图融合
- 图融合 pass
- GraphFusionPassManager
- ascend_compilation_config
- enable_npugraph_ex
- enable_static_kernel
- enable_super_kernel
- static kernel
- super kernel
- fuse_qknorm_rope
- fuse_norm_quant
- fuse_allreduce_rms
- fuse_muls_add
chapters:
- '16'
order: 50
sources:
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L278-L301
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/base_pattern.py#L41-L63
- vllm-ascend@db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L36-L79
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L230
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L71-L146
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L149-L223
- vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L586-L641
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L589-L645
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L49-L91
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/muls_add_pass.py#L29-L105
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L134-L159
- vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L470-L496
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L158-L173
- vllm@0fc695fc:vllm/compilation/backends.py#L940-L966
- vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L320-L324
- vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2078-L2092
- vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L1-L40
- vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L659
- vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661
- vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L103-L160
- vllm-ascend@baa023ad:vllm_ascend/compilation/graph_fusion_pass_manager.py#L50-L73
- https://github.com/vllm-project/vllm-ascend/blob/db701c1f/docs/source/user_guide/feature_guide/graph_mode.md
- https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
verified: []
evidence: C
relations:
- to: ops-and-kernels
  kind: builds-on
  note: 先分清算子接口和真正执行的 kernel，再看融合换掉了什么
- to: graph-mode-layer
  kind: builds-on
  note: 编译改「算什么」，捕获回放改「怎么提交」，两层的先后在那页
- to: acl-graph
  kind: builds-on
  note: 分档捕获与回放条件的唯一出处
- to: concurrent-requests
  kind: builds-on
  note: B4 的图尺寸补齐、DP 对齐与空闲组陪跑都在那页算
- to: mlp-residual-norm
  kind: builds-on
  note: 融合规则里最常命中的那一对，先理解残差加与归一化的数据依赖
contradicts: []
updated: '2026-10-02'
origin: direct
---

## 两步计算能不能合着做，再反复用？

**编译图融合，是在编译阶段把计算图里符合规则的相邻几步，整段换成一个融合实现，省掉中间结果写出再读回的那趟搬运。** 编译器眼里的「图」，是一个个算子（一次矩阵乘、一次归一化这样的操作）加上它们之间的输入输出依赖；npugraph_ex 是昇腾默认接上的外部编译后端，这类改写由它或本地规则来做。

举固定源码里真有的一条：一段计算先把张量 x 的每个数乘上同一个系数，再和另一个张量 y 逐位置相加。分成两步做，第一步算出的那块中间结果得先完整写进设备显存，第二步再整块读回来。换成一个「乘完直接加」的实现，这块中间结果就可以留在算子内部，不必出去一趟。

融合之后，这张已经改写过的图还可以被整段录下来，按几个常用宽度各录一份；下一轮来了形状对得上的数据，就复用录好的那一份执行次序。

```wiki-diagram
file: npugraph-ex-intuition
```

录下来的是任务的组织方式，不是上一轮的答案——每一轮都照新数据重算一遍。本页挂靠多请求主线的 B4：[进入前向之前的图尺寸补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

## 为什么值得合：中间张量也要写出再读回

一个[算子](ops-and-kernels.md)最终要由设备上的 kernel 执行。算完一个算子，结果落在设备显存里；下一个算子再把它整块读出来。数学运算一次都没省，多出来的是这趟存取，以及把多个任务分别交给设备的开销。**融合省的是这些边界成本，不是计算量本身。**

拿上面那段乘加来算一笔。设这块张量有 4 行、8 列——行是本轮要处理的位置，列是每个位置的一排特征——每个数按 BF16 占 2 字节。

```wiki-diagram
file: npugraph-ex
```

上半是不融合的走法：中间结果整块进设备显存，下一个算子再整块读回来。下半是融合后的走法，这块中间结果不出算子。

```calc
title: 一个中间张量的一写一读（示意数，不是 GLM 实测访存）
中间张量 = 4 行 × 8 列 × 2 B = 64 B
写出再读回 = 2 × 64 B = 128 B
> 融合后这 128 B 有机会省掉；x、y 和最终结果该读该写的还是要读要写
```

能省到什么程度，要看融合实现自己怎么用近端存储、怎么组织内部流水，所以**少两个图节点不等于少两次任务下发，也推不出一个固定加速比**。代价在另一侧：编译器得先认出这一段、准备好实现，还要验证数值——融合通常会改变浮点运算的先后次序，误差是否仍在允许范围内要单独确认。

## 怎么找出能合的一段，又怎么替换

一条融合规则由三部分组成：要找的计算结构（pattern）、找到之后换上的实现（replacement）、以及适用条件。**匹配看的是图里的算子和依赖关系，不是源码里两行挨着写。** 如果中间结果还有别的消费者，替换必须把它们要的数据照样留下。

最容易在量化模型里出现的是「归一化接量化」这一条：图里先是一个带偏置的「残差加 + RMSNorm」算子，紧跟着一个把结果按系数压成 8 位整数的量化算子，这两步被换成一个同时做完的算子。它一次给出两样东西：量化后的整数张量，和要继续往下传的残差。拿一个位置上的两个数走一遍（设 RMSNorm 的权重全是 1、量化系数 s=0.1，s 怎么来见[量化](quantization.md#一个数怎样压下去再还原回来)）：

```calc
title: 归一化接量化融合前后，哪一步的中间结果消失了（示意数）
残差加 = [3, 4] + [1, 2] = [4, 6]
RMS = √((4² + 6²) ÷ 2) = √26 ≈ 5.10
归一化 = [4, 6] ÷ 5.10 = [0.78, 1.18]
量化 = round([0.78, 1.18] ÷ 0.1) = [8, 12]
> 融合省掉的是第三行那个 BF16 中间结果的写出读回；[4, 6] 这个残差和 [8, 12] 这个整数张量都还要写出去
```

归一化本身怎么算见 [MLP、残差与归一化](mlp-residual-norm.md)。注意上面只是「这条规则在找什么」，图里真的出现同样的算子和连接才算命中——**配置打开、候选已注册、某一层真的匹配上，是三件事**。固定源码里默认开着四条规则：

| 规则 | 合的是相邻哪两步 | 额外条件 |
|---|---|---|
| 归一化接量化 | 带偏置的残差加 + RMSNorm，紧跟按系数量化 | 不是 310P 设备 |
| Q/K 归一化接 RoPE | Q、K 向量先各自归一化，紧跟加位置信息 | 模型精度是 BF16、能发现上游定义的 Attention 层、每个头的向量长 128 |
| All-Reduce 接归一化 | 矩阵乘后的 [All-Reduce](collective-communication.md#all-reduce)，紧跟残差加 RMSNorm | 本次编译区间的起点超过 512 个 token |
| 乘系数接相加 | 整块乘一个系数，紧跟逐位置相加 | 精度是 FP16、BF16 或 FP32，且不是 310P 设备 |

另外开了 sequence parallel 时还会加两条配套规则。四条规则各有自己的开关，关一条不影响其他三条。

## 两条编译路径：规则只注册一次，应用的人不一样

规则注册时做了两件事：既登记进 PyTorch 的 pattern matcher（按计算结构查找并替换的机制），也登记进外部后端自己的替换接口。所以**后面走哪条路，用的都是同一批规则**。

```wiki-diagram
file: npugraph-ex-flow
```

默认开着外部后端时，编译交给 npugraph_ex，由它按登记的替换改图；把这个开关关掉，编译改走上游 inductor，再由昇腾自己的 pass manager（按顺序组织改写规则的管理器）把这批规则应用一遍，并且会按本次编译区间逐条判断适不适用。**所以关掉这个开关不是关掉融合，只是换了应用规则的人。** 外部后端另有本库看不到的实现和版本条件，本地列出四条规则，不等于一共只有四项优化。

在这之前，平台还先决定要不要编译：图模式关掉时，编译模式一起关掉，外部后端也随之关闭；需要分段编译的档位同样不走它；不受支持的档位会退回「不录图」。整趟 decode 图这一档相反——平台会把切分算子的名单清空，让一个编译区间编成一整张图。310P 设备上外部后端和 static kernel 都直接关掉。

| 机制 | 改的是哪一层 | 生效要什么 |
|---|---|---|
| 图融合 | 把一段计算换成融合实现 | 规则与算子图真的匹配上 |
| static kernel | 为选定形状提前编译算子程序 | 外部后端开着、显式打开、形状在范围内 |
| [ACL Graph](acl-graph.md) 捕获回放 | 复用一整段任务的提交次序 | 本轮的形状命中已录好的那一档 |

融合先发生，捕获再把改写后的执行录下来。某一轮不满足回放条件，只说明这一轮不用录好的执行次序，不说明融合失效了。

## static kernel：为选定形状提前编译

**static kernel 是给固定形状提前编译好的算子程序，把一部分运行时准备挪到启动阶段。** 它默认关着，而且必须和外部后端一起开——只开它会在配置阶段直接断言失败。打开后，编译接口从捕获宽度表里筛出一段范围交给后端：下界是每条请求一步占的位置数（1 + 草稿 token 数），上界是最大并发请求数乘这个长度，只有落在这个闭区间里的宽度才送去静态编译，表里没有的宽度不会被补出来。

用一组独立的示意配置走一遍：捕获宽度表是 2、4、8、16、32，最大并发 4 条请求，草稿数 1。

```calc
title: static kernel 的宽度范围怎么筛（示意配置，不是本部署取值）
每条请求一步占的位置 = 1 + 1 = 2
范围上界 = 4 条 × 2 个位置 = 8
送去静态编译的宽度 = 表里满足 2 ≤ x ≤ 8 的项 = 2、4、8
```

草稿数改成 3，范围就变成 4 到 16。它决定的是「哪些形状提前编译」，不是接受了多少草稿，也不是把旧图挪到新形状上用。代价是每多一档就多一份编译产物，而且这条路要跨节点协调：它得先按并行配置推算出本机进程数，建立按节点分组的通信组，再分发安装编译产物。形状稳定、长时间跑的服务才摊得平这笔开销。这条路径还刻意关掉了原地改写优化，避免某些算子回退到 CPU 引起主机与设备之间的拷贝，所以不能按外部后端的一般能力推断它做了原地复用。

## 放到 GLM 双机：MTP 验证那一步用上了哪些

固定[部署前提](glm-5-3-flash-two-node.md#部署前提)是 GLM-5.3-Flash、两台 A2 各 8 卡、TP8/DP2/EP16、W8A8。这一档的档位是只给整齐 decode 录整趟图，外部编译后端按默认开着，static kernel 默认关、官方命令也没打开它——**图已经录好不等于 static kernel 生效**。

四条规则在这一档各自的处境不一样：

- **归一化接量化**最有机会命中：W8A8 的线性层在入口按系数量化，昇腾的归一化实现产出的正是规则要找的那个带偏置算子，结构上这一对确实会出现。具体命中几处要看启动日志，本库没有。
- **Q/K 归一化接 RoPE** 在这个模型上一个候选都注册不出来：这条规则要先从配置里取到上游定义的 Attention 层来读 head 长度，而 GLM 的注意力层是 MLA 那一支和线性注意力那一支，都不是那个类的实例，取不到就直接返回。这是按源码推断的结论，仍需启动日志确认。
- **All-Reduce 接归一化**要求本次编译区间的起点超过 512 个 token。整齐 decode 的宽度最大 128，全在门槛以下，用不上；只有一次塞进几千个 token 的 prefill 区间才可能。
- **乘系数接相加**的精度条件满足，命中次数同样只能看日志。

如果把 static kernel 打开：这一档每条请求一步占 4 个位置（1 个已确定的加 3 个草稿），最大并发 32 条，范围就是 4 到 128，而捕获的 7 个宽度正好都落在里面——7 个宽度和 4 的来历见[官方双机上录了哪 7 张图](graph-mode-layer.md#官方双机上录了哪-7-张图)。这里的 4 是一次验证送进去的长度，不代表 4 个 token 都会被接受，更不等于给用户 4 个字：接受几个由[投机解码](speculative-decoding.md)判定，再由[流式输出](streaming-output.md)变成文本增量。

走到 B4，本轮能不能回放还要另外过一遍条件：提示词都算完了、这一步每条请求都按 4 个位置、宽度没超过最大档、两个 DP 组对齐后的模式一致。[五条判据](graph-mode-layer.md#这一轮回放哪一张图五条判据)、[补齐到哪一档](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)和[空闲组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)都在那两页算过，本页不重算。要记住的是：这些条件决定本轮用不用图，和融合有没有命中是两套判断。

## 常见误解

- **「把 enable_npugraph_ex 关掉，融合就没了。」**——规则在两边都登记过，关掉只是把应用规则的人从外部后端换成上游 inductor 加本地 pass manager。真要两层一起关，得强制 eager。
- **「配置里写着开，就说明融合生效了。」**——配置打开、候选注册、图里真的匹配上是三个状态。这份源码里 All-Reduce 接归一化那一条的默认值甚至在两处不一致：按字段默认是关，按原始配置字典读默认是开。
- **「少了两个图节点，就少两次任务下发。」**——节点数和下发次数、访存量不是一回事，要看融合实现自己的访存与排布，再加端到端耗时才能下结论。
- **「融合和捕获回放是一回事。」**——融合改「算什么」，捕获回放改「怎么提交」。本部署两层都在用。
- **「开了 static kernel，整张图就都是静态 kernel。」**——它只给筛进范围的那些形状提前编译，也不保证图里每个算子都用上，更不是给任意输入都准备了一个最快实现。
- **「融合不会动数值。」**——融合常常改变浮点运算次序，精度要按容差单独验证。
- **「本地列了四条规则，那就是全部优化。」**——外部后端有自己的改写，本库没有它的源码，不能把四条当成总数。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 Ascend `2ed6cbba`；main 为 Ascend `baa023ad`。

### 怎么开

- **默认就开着。** 配置入口是 `additional_config` 下的 `ascend_compilation_config`；`enable_npugraph_ex` 默认真，`enable_static_kernel` 默认假 [C7]。官方双机命令两项都没写，所以外部后端开、static kernel 关 [S23]。
- **规则注册一次，登记两处。** 每条 pattern 构造时既调上游 pattern matcher 的 `register_replacement`，也调外部后端的同名接口并带一个额外检查；同名 pattern 全局只注册一次 [C2]。pass manager 由上游在建编译后端时实例化并配置一遍，与最终走哪条编译路径无关。
- **谁来应用。** `enable_npugraph_ex` 为真走 `npugraph_ex_compile`，为假走 `fusion_pass_compile`；后者才会从编译配置里取出 pass manager，并按编译区间逐条判断适用性 [C1]。昇腾把这个自定义 pass 的键改成了自己的名字，不是上游那个 inductor 键。
- **四条规则的开关。** `fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_allreduce_rms`、`fuse_muls_add` 都按原始配置字典读、默认真；310P 上前后两条跳过；`enable_sp` 另加两条 sequence parallel 规则 [C3]。其中 `fuse_allreduce_rms` 作为字段的默认值是假，编译区间切分点那段又按字典默认真，两处不一致 [C12]。
- **平台先定要不要编译。** 图模式为 NONE、或档位需要分段编译、或档位不受支持时，`enable_npugraph_ex` 被置假；整趟图这一档会把 `splitting_ops` 清空，让一个区间编成整张图 [C8]。
- **static kernel 怎么开。** 置真后编译接口把筛出的宽度表写进后端选项；它还要先推算本机进程数并建立按节点分组的通信组，用来协调编译与产物安装 [C5]。

### 会报什么错

| 现象 | 看到什么 | 怎么办 |
|---|---|---|
| 只开 static kernel、关掉外部后端 | 配置构造阶段断言失败，说明 static kernel 依赖 npugraph_ex [C7] | 两个一起开，或都不开 |
| 在 310P 上配了这两项 | 两条 warning 之后自动置假 | 该设备上没有这条路径 |
| 没装 npugraph_ex 这个包 | `ImportError` 被接住，落到 torchair 兼容分支 [C6] | 它只兜导入问题，不是任意编译错误的性能兜底 |
| 图里含 Triton kernel | 跳过编译缓存并打一条 info：索引是进程内的，换进程加载会断言失败 [C6] | 正常现象，下次重新编译 |
| 设了 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台抛 `ValueError` [C8] | 属于图那一层，见 [ACL Graph](acl-graph.md#对照源码) |

### 开销和什么时候别开

- **编译期**：每个编译区间都要跑一遍匹配；static kernel 还要按宽度逐档编译、跨节点分发安装，档位越多启动越久。
- **数值**：融合改变浮点次序，精度要按容差单独验证，不能因为图跑通就认为数值等价 [I]。
- **刻意关掉的优化**：这条路径把原地改写优化关了，避免某些算子回退 CPU 带来主机与设备之间的拷贝。所以不要按外部后端的一般能力推断它启用了原地复用。
- **什么时候别开**：排查精度或 hang 时常用强制 eager，但那会把编译改写和图回放一起关掉，问题消失只能把范围缩到这两层；要分开看，先只关一层 [D]。形状长期不整齐时，收益会被补齐和退回吃掉。
- 本页所有结论都来自配置与源码，没有 NPU 实测，不给加速比 [I]。

### 版本差异

三列的配置字段逐项核了各分支的 `ascend_config.py` [C18][C19][C20]，规则怎么读核的是各分支的 pass manager [C21]，规则文件按各分支 `compilation/passes` 目录清点。

| 项目 | v0.23（维护分支 2c59ff10；GLM 按镜像 db701c1f） | v0.26（2ed6cbba） | main（baa023ad） |
|---|---|---|---|
| 配置形态 | 普通 Python 类，310P 降级和依赖检查写在构造里 | 同 | 迁成 pydantic 数据类，降级与依赖检查放进校验器 |
| `passes/` 里的融合规则 | 四条，另有两条 sequence parallel | 没有 All-Reduce 接归一化那一条 | 也没有那一条，两条 sequence parallel 也不在了 |
| `enable_npugraph_ex` 默认 | 真 | 真 | 真 |
| `enable_static_kernel` 默认 | 假 | 假 | 假 |
| Super Kernel | 没有这个配置 | 新增 `enable_super_kernel`，不写就跟随 static kernel | 有，默认假，并按 super kernel → static kernel → npugraph_ex 的依赖链校验 |
| `fuse_muls_add` | 只能从额外关键字传，不是正式字段 | 同 | 成为正式字段 |
| 规则开关怎么读 | 读原始配置字典，310P 按设备型号判断 | 同 | 读配置对象，并按硬件能力标记判断 |
| 捕获那一层的实现 | 一份图包装器 | 同 | 另多出可打断图与可更新图两套实现（在 `compilation/` 下，不是融合规则） |

官方文档把图模式与编译改写分两层介绍，并列出昇腾支持的档位取值 [S22]。

### 源码位置

- 选路与两条编译实现：`compiler_interface.py` 的 `AscendCompiler.compile`、`npugraph_ex_compile`、`fusion_pass_compile`；宽度筛选与后端选项在同一文件的 `_compute_decode_cudagraph_batch_sizes`、`_configure_backend`。
- 规则注册：`passes/base_pattern.py` 的 `register`；pass manager 与四条开关：`graph_fusion_pass_manager.py`；上游实例化与配置它的地方：`vllm/compilation/backends.py` [C14]；自定义 pass 键：`platform.py` [C13]。
- 四条规则各自的 pattern：归一化接量化 [C9]、Q/K 归一化接 RoPE [C4]、All-Reduce 接归一化及 512 门槛 [C11]、乘系数接相加 [C10]。
- 这条推断的三处依据：昇腾归一化算子 `ops/layernorm.py` [C17]、GLM 用的两类注意力层 `models/glm5_next.py` [C16]、上游 MLA 注意力不是普通 Attention 的子类 [C15]。
- 配置字段、310P 降级与 static kernel 断言：`ascend_config.py`；档位与平台改写：`platform.py`。

**待核**：缺本部署的启动日志，所以四条规则各自命中几处（含「Q/K 归一化接 RoPE 一处都注册不出来」这条推断）都没有运行期证据；外部后端自己做了哪些改写、static kernel 实际编译多久，本库没有它的源码与实测 [I]。
