---
id: npugraph-ex
title: 编译图融合：把相邻两步合成一个算子，再分档复用执行
type: feature
summary: >-
  从中间张量的一写一读讲清编译期融合，列出固定源码里的四条融合规则、它们各自的条件，并区分 npugraph_ex 后端、static kernel
  与分档捕获在 GLM 双机 MTP 验证那一步各自管什么。
  同时说明编译缓存怎样复用产物，以及视觉编码器编译与视觉图捕获的区别。
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
  - 归一化量化融合
  - QK归一化旋转位置融合
  - 乘加融合
  - Ascend编译配置
  - additional_config.ascend_compilation_config
  - ascend_compilation_config.fuse_muls_add
  - ascend_compilation_config.fuse_norm_quant
  - ascend_compilation_config.fuse_qknorm_rope
  - compile_mm_encoder
  - 编译缓存
  - TORCH_TRACE
  - tlparse
chapters:
  - '16'
order: 50
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L278-L301'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/passes/base_pattern.py#L41-L63'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L36-L79
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L230
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L71-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L149-L223'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L586-L641'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L589-L645'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L49-L91
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/muls_add_pass.py#L29-L105
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L32-L159
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L470-L496'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L158-L173'
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L940-L966'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L320-L324
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2078-L2092'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L28-L88'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L659'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L103-L160'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/compilation/graph_fusion_pass_manager.py#L50-L73
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/db701c1f/docs/source/user_guide/feature_guide/graph_mode.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    raw:sha256-47f830dd90bb5d33379d0c67407ff01fee36bfbbcdd6d9c9b0e99f5d7a5bd3a7.md#L1-L930
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L29
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L27-L43'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L657-L738
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L79
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L74
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L28-L50'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L365-L393
  - 'vllm@0fc695fc:vllm/config/compilation.py#L106-L122'
  - 'vllm@568afb3a:vllm/config/compilation.py#L106-L122'
  - 'vllm@84030bbe:vllm/config/compilation.py#L106-L122'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L305-L344'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L294-L333'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L298-L338'
  - >-
    raw:sha256-9e54d59f6deb57e8785aab24c4142fa6daf432c67a81c0cc2fdba221f5407ea8.md#L1-L1351
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L114-L171'
  - >-
    vllm-ascend@7d825229:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1302-L1343'
  - >-
    vllm-ascend@7d825229:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L293
  - >-
    vllm-ascend@7d825229:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L333-L378
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/graph_mode.md
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L39-L68'
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L845-L849'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/muls_add.py#L8-L57'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L303-L309'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2189-L2241'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2235-L2257'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2387-L2401'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2644-L2658'
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L937-L956'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L527-L539'
  - 'vllm@568afb3a:vllm/config/compilation.py#L535-L547'
  - 'vllm@ced6857a:vllm/config/compilation.py#L542-L554'
  - 'vllm@84030bbe:vllm/config/compilation.py#L535-L547'
  - 'vllm@0fc695fc:vllm/compilation/decorators.py#L385-L411'
  - 'vllm@568afb3a:vllm/compilation/decorators.py#L385-L411'
  - 'vllm@ced6857a:vllm/compilation/decorators.py#L387-L413'
  - 'vllm@84030bbe:vllm/compilation/decorators.py#L387-L413'
  - 'vllm@0fc695fc:vllm/compilation/piecewise_backend.py#L133-L154'
  - 'vllm@568afb3a:vllm/compilation/piecewise_backend.py#L133-L154'
  - 'vllm@ced6857a:vllm/compilation/piecewise_backend.py#L133-L154'
  - 'vllm@84030bbe:vllm/compilation/piecewise_backend.py#L133-L154'
  - 'vllm@0fc695fc:vllm/model_executor/models/qwen2_5_vl.py#L460-L473'
  - 'vllm@568afb3a:vllm/model_executor/models/qwen2_5_vl.py#L458-L471'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen2_5_vl.py#L462-L475'
  - 'vllm@84030bbe:vllm/model_executor/models/qwen2_5_vl.py#L461-L474'
  - 'vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L411-L416'
  - 'vllm@568afb3a:vllm/model_executor/models/qwen3_vl.py#L410-L415'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_vl.py#L437-L451'
  - 'vllm@84030bbe:vllm/model_executor/models/qwen3_vl.py#L437-L451'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1034-L1081'
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L96-L120'
  - 'vllm@0fc695fc:vllm/compilation/backends.py#L1026-L1095'
  - 'vllm@568afb3a:vllm/compilation/backends.py#L1031-L1100'
  - 'vllm@ced6857a:vllm/compilation/backends.py#L1031-L1100'
  - 'vllm@84030bbe:vllm/compilation/backends.py#L1031-L1100'
  - 'vllm@0fc695fc:vllm/compilation/compiler_interface.py#L193-L209'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L236-L258'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L303-L368'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L549-L556'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1188-L1195'
  - 'vllm@0fc695fc:docs/design/debug_vllm_compile.md#L1-L361'
  - 'vllm@0fc695fc:docs/design/torch_compile.md#L1-L261'
  - 'vllm@0fc695fc:docs/design/torch_compile_multimodal.md#L1-L107'
  - 'vllm@0fc695fc:docs/design/fusions.md#L1-L397'
  - https://github.com/meta-pytorch/tlparse/blob/98b8782b90f076f3d77a4a414316e3c8d0d127d4/README.md
  - 'vllm@0fc695fc:vllm/compilation/decorators.py#L506-L515'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L176-L181'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L112-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1310-L1354'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L119-L177'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1515-L1559'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/graph_fusion_pass_manager.py#L52-L79'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
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
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-47f830dd90bb5d33379d0c67407ff01fee36bfbbcdd6d9c9b0e99f5d7a5bd3a7.md
  - >-
    raw/sha256-9e54d59f6deb57e8785aab24c4142fa6daf432c67a81c0cc2fdba221f5407ea8.md
  - >-
    raw/sha256-ae08a6168aec51b2a7846665a4e0aa2bc0ff900da2edf4d27d8df7939a1a6db0.md
---

## 两步计算能不能合着做，再反复用？

**编译图融合，是在编译阶段把计算图里符合规则的相邻几步，整段换成一个融合实现，为减少中间结果写出再读回提供机会。** 具体能省掉哪些读写，取决于融合实现内部怎样存储和传递数据。编译器眼里的「图」，是一个个算子（一次矩阵乘、一次归一化这样的操作）加上它们之间的输入输出依赖；npugraph_ex 是昇腾默认接上的外部编译后端，这类改写由它或本地规则来做。

这会增加启动时识别规则、编译和保存产物的工作；改写后的数值也要按容差验证。能否省回这些成本，取决于后面多少次计算能用上它。

举固定源码里真有的一条：一段计算先把张量 x 的每个数乘上同一个系数，再和另一个张量 y 逐位置相加。分成两步做，第一步算出的那块中间结果得先完整写进设备显存，第二步再整块读回来。换成一个「乘完直接加」的实现，这块中间结果就可以留在算子内部，不必出去一趟。

融合之后，这张已经改写过的图还可以被整段录下来，按几个常用宽度各录一份；下一轮来了形状对得上的数据，就复用录好的那一份执行次序——录下来的是任务的组织方式，不是上一轮的答案，每一轮都照新数据重算一遍。本页挂靠多请求主线的 B4：[进入前向之前的图尺寸补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

站在昇腾编译栈全景看，本页会逐层拆解的三级递进——`npugraph_ex` 算子图融合 → `Static Kernel` 选定形状预编译 → `Super Kernel` 二进制大核合并——在执行层级与门控关系上对应下面这张立体拆解图：

```wiki-diagram
file: npugraph-plate-three-tier
```

## 为什么值得合：中间张量也要写出再读回

一个[算子](ops-and-kernels.md)最终要由设备上的 kernel 执行。算完一个算子，结果落在设备显存里；下一个算子再把它整块读出来。数学运算一次都没省，多出来的是这趟存取，以及把多个任务分别交给设备的开销。**融合省的是这些边界成本，不是计算量本身。**

拿上面那段乘加来算一笔。设这块张量有 4 行、8 列——行是本轮要处理的位置，列是每个位置的一排特征——每个数按 BF16 占 2 字节。

```wiki-diagram
file: npugraph-ex
```

上半是不融合的走法：中间结果整块进设备显存，下一个算子再整块读回来。下半是融合后的走法，这块中间结果不出算子（示意数，不是 GLM 实测访存；融合后这 128 B 有机会省掉，$x$、$y$ 和最终结果该读该写的仍要读写）：

$$\text{中间张量} = 4 \times 8 \times 2\text{ B} = 64\text{ B}, \qquad \text{写出再读回} = 2 \times 64\text{ B} = 128\text{ B}$$

| 访存分项（4 行 × 8 列，BF16 每数 2 B·示意） | 计算式 | 字节数 |
| --- | --- | --- |
| 中间张量大小 | $4 \times 8 \times 2\text{ B}$ | **64 B** |
| 不融合时的额外一写一读 | $2 \times 64\text{ B}$ | **128 B**（融合后有机会省掉） |

能省到什么程度，要看融合实现自己怎么用近端存储、怎么组织内部流水，所以**少两个图节点不等于少两次任务下发，也推不出一个固定加速比**。代价在另一侧：编译器得先认出这一段、准备好实现，还要验证数值——融合通常会改变浮点运算的先后次序，误差是否仍在允许范围内要单独确认。

## 怎么找出能合的一段，又怎么替换

一条融合规则由三部分组成：要找的计算结构（pattern）、找到之后换上的实现（replacement）、以及适用条件。**匹配看的是图里的算子和依赖关系，不是源码里两行挨着写。** 如果中间结果还有别的消费者，替换必须把它们要的数据照样留下。

最容易在量化模型里出现的是「归一化接量化」这一类。先取其中静态量化的候选：图里先是一个支持偏置输入的「残差加 + RMSNorm」算子，紧跟着一个把结果按系数压成 8 位整数的量化算子，这两步被换成一个同时做完的算子。它一次给出两样东西：量化后的整数张量，和要继续往下传的残差。拿一个位置上的两个数走一遍（偏置不加，设 RMSNorm 的权重全是 1、量化系数 $s = 0.1$，$s$ 怎么来见[量化](quantization.md#一个数怎样压下去再还原回来)；融合省掉的是第 3 步那个 BF16 中间结果的写出读回，`[4, 6]` 残差与 `[8, 12]` 整数张量仍须写出）：

$$\text{RMS} = \sqrt{\frac{4^2 + 6^2}{2}} = \sqrt{26} \approx 5.10, \qquad q = \text{round}\!\left(\frac{[4, 6] / 5.10}{0.1}\right) = [8, 12]$$

| 阶段（归一化接量化融合前后·示意） | 数值演算 | 融合后是否仍写出到显存 |
| --- | --- | --- |
| ① 残差加 | $[3, 4] + [1, 2] = [4, 6]$ | 是（残差继续往下传） |
| ② 求 RMS | $\sqrt{(4^2 + 6^2) / 2} = \sqrt{26} \approx 5.10$ | 算子内部中间标量 |
| ③ BF16 归一化输出 | $[4, 6] / 5.10 \approx [0.78, 1.18]$ | **否（融合后省去这趟写出再读回）** |
| ④ 静态量化输出 | $\text{round}([0.78, 1.18] / 0.1) = [8, 12]$ | 是（送往下一层整数矩阵乘） |

归一化本身怎么算见 [MLP、残差与归一化](mlp-residual-norm.md)。注意上面只是「这条规则在找什么」，图里真的出现同样的算子和连接才算命中——**配置打开、候选已注册、某一层真的匹配上，是三件事**。固定源码里默认开着四条规则：

| 规则 | 合的是相邻哪两步 | 额外条件 |
|---|---|---|
| 归一化接量化 | 残差加 + RMSNorm，紧跟静态或动态量化；上例只是静态候选 | 不是 310P；模型精度 BF16/FP16；排除含指定 W4A4 动态权重的模型；静态候选另需自定义算子 |
| Q/K 归一化接 RoPE | Q、K 向量先各自归一化，紧跟加位置信息 | 模型精度 BF16；能发现上游 Attention 层，取首层的头长且必须为 128 |
| All-Reduce 接归一化 | 未量化矩阵乘后的 [All-Reduce](collective-communication.md#all-reduce)，紧跟残差加 RMSNorm | 本地管理器要求本次编译区间的起点超过 512 个 token；外部后端不能只按此门槛推断 |
| 乘系数接相加 | 整块乘一个系数，紧跟逐位置相加 | 精度 FP16/BF16/FP32，且不是 310P；只注册模型指定的路由缩放常数，缺省为 1 |

另外开了 sequence parallel 时还会加两条配套规则。四条规则各有自己的开关，关一条不影响其他三条。

归一化里的小常数 ε 用来避免除数为零；上述归一化量化和 Q/K 规则只登记了 ε 为十万分之一、百万分之一的候选。动态量化会根据当前输入求缩放系数，不能把上例固定的 0.1 套进去；固定实现还区分带偏置、不带偏置及 MX 量化候选，各有算子条件。乘加也有类似限制：若模型指定乘 2，规则登记的是乘 2 再相加，图里乘 3 的另一段不会因此自动命中。**这些开关允许编译器尝试替换，不会替模型修改计算定义。**

## 两条编译路径：规则只注册一次，应用的人不一样

规则注册时做了两件事：既登记进 PyTorch 的 pattern matcher（按计算结构查找并替换的机制），也登记进外部后端自己的替换接口。所以**后面走哪条路，用的都是同一批规则**（双路消费与三级融合门控的完整路线统一见下节架构图）。

默认开着外部后端时，编译交给 npugraph_ex，由它按登记的替换改图；把这个开关关掉，则由本地 `fusion_pass_compile` 通过 AOTAutograd 取得 FX 计算图，交给昇腾自己的 pass manager（按顺序组织改写规则的管理器）改写并返回。它借用了 Inductor 的匹配工具，实际选择的编译器仍是平台提供的 AscendCompiler。**所以关掉这个开关不是关掉融合，而是切换到本地改图路径。** 后端选择与本地实现的证据在页末源码索引。

两条路径共享候选定义，应用条件却不能完全等同：本地管理器调用每条规则的编译区间检查，外部注册接口收到的是另一项流作用域检查。比如 512 token 门槛写在本地区间检查里，不能直接拿来判定外部后端的结果。外部后端还有本库看不到的实现和版本条件，本地列出四条规则，不等于一共只有四项优化。

在这之前，平台还先决定要不要编译：图模式关掉时，编译模式一起关掉，外部后端也随之关闭；需要分段编译的档位同样不走它；不受支持的档位会退回「不录图」。整趟 decode 图这一档相反——平台会把切分算子的名单清空，让一个编译区间编成一整张图。310P 设备上外部后端和 static kernel 都直接关掉。

| 机制 | 改的是哪一层 | 生效要什么 |
|---|---|---|
| 图融合 | 把一段计算换成融合实现 | 规则与算子图真的匹配上 |
| static kernel | 为选定形状提前编译算子程序 | 外部后端开着、显式打开、形状在范围内 |
| [ACL Graph](acl-graph.md) 捕获回放 | 复用一整段任务的提交次序 | 本轮的形状命中已录好的那一档 |

融合先发生，捕获再把改写后的执行录下来。某一轮不满足回放条件，只说明这一轮不用录好的执行次序，不说明融合失效了。

## static kernel：为选定形状提前编译

**static kernel 是给固定形状提前编译好的算子程序，把一部分运行时准备挪到启动阶段。** 它默认关着，而且必须满足 `enable_super_kernel -> enable_static_kernel -> enable_npugraph_ex` 的三级依赖链：
- **A2 / A3 / A5 等支持 `npugraph_ex` 的硬件**：单开 `enable_static_kernel=True`（而 `enable_npugraph_ex=False`），或单开 `enable_super_kernel=True`（而 `enable_static_kernel=False`），都会在配置校验阶段直接抛出 `AssertionError`。
- **310P 等不支持 `npugraph_ex` 的硬件**：硬件能力检查会先于断言执行，对原本开启的项打印 warning 后将三者**静默刷成 `False`**，不会触发断言失败。
- **非纯整图模式静默刷回 `False`**：即使在 A2/A3/A5 上合法地双开或三开了 `npugraph_ex` + `static_kernel`（+ `super_kernel`），只要最终 `cudagraph_mode` 是 `NONE`、不受支持的档位，或任何需要分段编译的模式（如 `PIECEWISE`、`FULL_AND_PIECEWISE`，即非 `FULL_DECODE_ONLY` / `FULL`），平台 `_setup_compile_backend` 仍会把 `additional_config["ascend_compilation_config"]` 里的这三项全部**静默刷回 `False`**。

下面这张架构图把「`npugraph_ex` → `static_kernel` → `super_kernel` 三级依赖与两道门控」以及「规则一次注册、双路消费（外部后端 vs 本地 FX pass）」整合到同一视图里：

```wiki-diagram
file: npugraph-ex-fig-three-tier-fusion
```

打开并保留生效后，编译接口从捕获宽度表里筛出一段范围交给后端：下界是每条请求一步占的位置数（$1 + \text{草稿数}$），上界是最大并发请求数乘这个长度，只有落在这个闭区间里的宽度才送去静态编译，表里没有的宽度不会被补出来。

**Super Kernel 合并的是已经编译好的算子二进制。** 2026-11-02 官方指南描述：在 ACL 图捕获期间识别可融合子图，把子 kernel 合成较大的 kernel，并按依赖插入同步，以减少任务下发与调度等待。它依赖 static kernel，后者又依赖 npugraph_ex；不兼容的算子会截断融合范围。在 `v0.30.0` 与 `main` 中，若显式给出 `enable_static_kernel` 而省略 `enable_super_kernel`，前置校验会让 `enable_super_kernel` 跟随 `enable_static_kernel`；这个依赖在固定 v0.26 维护分支、`v0.30.0` 与 `main` 配置中均有检查（最初的 v0.26.0rc1 tag 和旧 GLM 镜像没有该字段，详见 [Super Kernel 版本区别](../params/enable-super-kernel-ce990e186bfa.md)）。

用一组独立的示意配置走一遍：捕获宽度表是 `2, 4, 8, 16, 32`，最大并发 4 条请求，草稿数 1（示意配置，不是本部署取值）：

$$L_{\text{step}} = 1 + 1 = 2, \qquad U_{\text{static}} = 4 \times 2 = 8, \qquad S_{\text{static}} = \{x \in \{2,4,8,16,32\} \mid 2 \le x \le 8\} = \{2, 4, 8\}$$

| 筛选参数（static kernel 宽度区间·示意） | 计算式 | 结果 |
| --- | --- | --- |
| 每条请求一步占的位置（下界） | $1 + 1$ | **2** |
| 最大并发对应位置数（上界） | $4 \times 2$ | **8** |
| 送去静态编译的宽度 | 捕获表中满足 $2 \le x \le 8$ 的项 | **`2, 4, 8`** |

草稿数改成 3，范围就变成 4 到 16。它决定的是「哪些形状提前编译」，不是接受了多少草稿，也不是把旧图挪到新形状上用。更多档位可能增加编译与存储成本，而且这条路要跨节点协调：它得先按并行配置推算出本机进程数，建立按节点分组的通信组，再分发安装编译产物。是否能由后续请求节省的时间摊平，要结合实际编译耗时、缓存复用和请求分布比较。这条路径还刻意关掉了原地改写优化，避免某些算子回退到 CPU 引起主机与设备之间的拷贝，所以不能按外部后端的一般能力推断它做了原地复用。

## 编译过一次，下一次启动能直接用吗？

**编译缓存保存的是可以重新加载的程序产物，不是某条请求的输出，也不是已经填好的 KV cache。** 冷启动先从模型程序取得计算图，再改写、编译并保存；后续启动找到适用的产物，就能省掉相应的重新编译。进程仍要加载模型、准备缓冲和建立自己的图回放资源，缓存命中不能解释为整个服务瞬间启动。

例如同一模型的两次启动，第一次用配置 A 编译，第二次仍用 A，缓存键与产物都匹配时就可以加载；改成配置 B 后，应先看新的键及编译日志。默认键考虑环境、配置、所用编译器和追踪到的源文件内容，再按执行 rank、DP rank 和组件前缀分目录。视觉组件与语言主干有不同前缀，因此同一次启动也会看到多个缓存位置。

| 看到的记录 | 它能解释什么 | 下一步看哪里 |
|---|---|---|
| 计算图与变换后程序 | 前端追踪到了哪些操作、在哪里出现形状条件 | 编译追踪记录中的图与约束 |
| 缓存键与加载记录 | 这次是复用旧产物，还是因为键或文件变化重新编译 | 实际缓存目录、编译器名及命中记录 |
| 编译或融合成功 | 程序产物已形成，或规则匹配过 | 同一输入的数值及执行记录 |
| 设备运行记录 | 这轮实际执行了哪些任务、耗时多少 | [性能分析](inference-performance-analysis.md)，并与未采集的基准比较 |

图中间出现一个按输入数值决定的 Python 分支时，前端可能无法把它追成要求的整图；按本轮位置数取模的分支还可能给动态维度附加限制。动态维度的意思是同一段程序可以接受多种长度，并不保证所有 Python 分支都能自动兼容。先查追踪记录里的图中断和形状约束，再决定调整模型实现、动态形状策略或编译范围；改变配置后的结果仍要做数值对照。

## 视觉编码器也能编译吗？

**视觉编码器编译是改写图片编码过程的程序，视觉图捕获是录下可复用的设备任务次序。** 两个开关各管一层：前者可能减少操作之间的边界成本，后者减少重复提交的开销；图片分辨率与帧数变化也让编译范围和捕获容量成为两份不同的约束。视觉图如何按位置预算装批，统一见 [视觉编码器的图捕获](acl-graph.md#图片先过视觉编码器这一步也能录成图吗)。

模型要先给相应组件接上编译入口，开关才有消费者。入口读取与语言主干共享的编译配置，检查组件自己的开关、编译模式与是否应跳过，然后用组件类名隔离缓存。Qwen2.5-VL 的视觉计算块是一个实际例子；它不代表所有视觉模型都已有同样的接入。编译会增加追踪与生成产物的启动成本，是否改善请求时延要看图片处理量和实际执行路径。

编码器的位置数不等于语言主干一次调度的位置预算。因此，固定上游为编码器放宽的是**最后一个编译区间的上界**（上界设为 $2^{31} - 1 = 2{,}147{,}483{,}647$；它没有分配这么多位置的内存，也没有提高图片或视频输入限制），前面的区间及最后一段的起点仍保留。用两个区间演一次（示意配置）：

$$\text{原区间 } [1, 4],\;[5, 8] \;\longrightarrow\; \text{视觉编译区间 } [1, 4],\;[5, 2^{31} - 1]$$

| 阶段（视觉组件放宽最后一段编译范围·示意） | 区间设定 / 输入 | 命中结果 |
| --- | --- | --- |
| 原语言编译区间 | $[1, 4]$、$[5, 8]$ | 上界止于 8 |
| 放宽后的视觉编译区间 | $[1, 4]$、$[5, 2{,}147{,}483{,}647]$ | 保留前段与末段起点 5，仅放宽末段上界 |
| 本次输入 10 个视觉位置 | $10 \in [5, 2{,}147{,}483{,}647]$ | **进入第二个编译区间** |

若只有一个从 1 开始的区间，结果才是从 1 到这个上界。这里的“可选择编译区间”仍要经过模型形状、设备内存和具体后端约束；捕获图的 token 预算与视频帧容量按前面的视觉图页面单独判断。

## 放到 GLM 双机：MTP 验证那一步用上了哪些

固定[部署前提](glm-5-3-flash-two-node.md#部署前提)是 GLM-5.3-Flash、两台 A2 各 8 卡、TP8/DP2/EP16、W8A8。这一档的档位是只给整齐 decode 录整趟图，外部编译后端按默认开着，static kernel 默认关、官方命令也没打开它——**图已经录好不等于 static kernel 生效**。

四条规则在这一档各自的处境不一样：

- **归一化接量化**可以登记候选，但不能从 W8A8 推出主干命中。固定 mHC 主干先调用 `hc_pre`，再对一个输入做普通 RMSNorm；这里没有把 residual 传给 RMSNorm，因此不直接形成上面的「残差加 + RMSNorm → 量化」结构。旧实现中不带残差加的纯 RMSNorm 候选属于 MX 量化，不能套给这组 A2 W8A8。其他模块与外部后端的改写要分别核对（来源 17、27、49）。
- **Q/K 归一化接 RoPE**先从注册上下文寻找上游定义的 Attention 层，再读取首层头长；没有这种层时直接不登记候选。GLM 主干构造 MLA 和线性注意力分支，并不能凭“模型有归一化和 RoPE”就认定符合这个检查。要判断整个服务是否登记了候选，还须检查最终注册上下文，不能把语言主干的类名推断扩大到视觉塔、草稿和其他模块。
- **All-Reduce 接归一化**在本地管理器路径要求编译区间起点超过 512。宽度至多 128 的 decode 区间不满足该本地条件；宽度较大的区间也仍要匹配未量化矩阵乘、All-Reduce 和残差加 RMSNorm 的连接。固定部署默认使用外部后端，不能仅凭 128 < 512 就断言这一后端绝不融合，主干的 mHC 与量化边界也仍需检查。
- **乘系数接相加**的精度条件满足，还须图中的常数等于模型路由缩放系数，命中次数同样只能看日志。

如果把 static kernel 打开：这一档每条请求一步占 4 个位置（1 个已确定的加 3 个草稿），最大并发 32 条，范围就是 4 到 128，而捕获的 7 个宽度正好都落在里面——7 个宽度和 4 的来历见[官方双机上录了哪 7 张图](graph-mode-layer.md#官方双机上录了哪-7-张图)。这里的 4 是一次验证送进去的长度，不代表 4 个 token 都会被接受，更不等于给用户 4 个字：接受几个由[投机解码](speculative-decoding.md)判定，再由[流式输出](streaming-output.md)变成文本增量。

走到 B4，本轮能不能回放还要另外过一遍条件：提示词都算完了、这一步每条请求都按 4 个位置、宽度没超过最大档、两个 DP 组对齐后的模式一致。[五条判据](graph-mode-layer.md#这一轮回放哪一张图五条判据)、[补齐到哪一档](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)和[空闲组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)都在那两页算过，本页不重算。要记住的是：这些条件决定本轮用不用图，和融合有没有命中是两套判断。

视觉编译默认关闭，固定命令也没有打开它。GLM 视觉图的支持边界应按 [ACL Graph 的版本表](acl-graph.md#版本差异)判断；Qwen 的编译入口不能用来证明旧 GLM 视觉塔能编译。固定 Ascend 编译器还把 torch_npu 版本及外部后端、static kernel 开关纳入自己的哈希；已有产物的路径缺失时会重新编译。

## 常见误解

- **「把 enable_npugraph_ex 关掉，融合就没了。」**——规则在两边都登记过，关掉会切到本地 FX 图改写；强制 eager 才会同时关闭这条编译路径和图捕获回放。模型自己显式调用的融合算子仍是另一层机制。
- **「配置里写着开，就说明融合生效了。」**——配置打开、候选注册、图里真的匹配上是三个状态。这份源码里 All-Reduce 接归一化那一条的默认值甚至在两处不一致：按字段默认是关，按原始配置字典读默认是开。
- **「少了两个图节点，就少两次任务下发。」**——节点数和下发次数、访存量不是一回事，要看融合实现自己的访存与排布，再加端到端耗时才能下结论。
- **「融合和捕获回放是一回事。」**——融合改「算什么」，捕获回放改「怎么提交」。本部署两层都在用。
- **「开了 static kernel，整张图就都是静态 kernel。」**——它只给筛进范围的那些形状提前编译，也不保证图里每个算子都用上，更不是给任意输入都准备了一个最快实现。
- **「融合不会动数值。」**——融合常常改变浮点运算次序，精度要按容差单独验证。
- **「本地列了四条规则，那就是全部优化。」**——外部后端有自己的改写，本库没有它的源码，不能把四条当成总数。

## 对照源码

钉点：`v0.23.0` 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码；**正文 GLM 绑定算例按专用镜像 Ascend `db701c1f`**）；`v0.26.0rc` 为 Ascend `2ed6cbba`（配套 vLLM `568afb3a`）；`v0.30.0` 为 Ascend `c09d3e20`（配套 vLLM `ced6857a`）；`main` 为 Ascend `8d6180e2`（配套 vLLM `ba15685a`）。

### 怎么开

**这是一组启动配置。** `ascend_compilation_config` 是 `additional_config` 内的 JSON 对象，省略或给空对象都会使用各字段默认值；它本身不是布尔总开关。上游负责传递字典，Ascend 再取子对象构造配置（来源 26），整体解析顺序见 [Ascend 配置系统](ascend-config-system.md#怎么开)。这些键不放进 Chat 请求，也不放进上游的 `compilation_config.pass_config`：上游同名 fuse_norm_quant 在三线声明默认 None，属于另一组规则，Ascend 管理器读的是本页默认 true 的子键（来源 32–34）。

上游[融合规则表](https://github.com/vllm-project/vllm/blob/0fc695fc/docs/design/fusions.md)主要列 CUDA/ROCm 的精度、硬件和整图条件。例如上游 All-Reduce + RMSNorm、注意力输出量化和 AsyncTP 分属不同规则，不构成本页 NPU 的支持矩阵。查看配置时先确认实际平台返回哪个管理器；上游的操作语义与实现选择见 [IR 算子入口](ops-and-kernels.md#同一个算子为什么还会出现-ir-优先级)。

| 项目 | 字段、类型与默认（后三项位于子对象内） | 打开后允许做什么 |
|---|---|---|
| 容器 | ascend_compilation_config：对象，缺省等效于 {} | 集中配置本页的编译后端与规则，不能写成 true/false |
| 乘加 | fuse_muls_add：布尔值，true | 为乘路由缩放常数再相加注册候选；不是任意标量融合保证 |
| 归一化量化 | fuse_norm_quant：布尔值，true | 为满足精度、量化类型和算子条件的归一化接量化注册候选 |
| Q/K 位置变换 | fuse_qknorm_rope：布尔值，true | 读取 Attention 头信息，为 BF16、头长 128 的结构注册候选 |

**一次只关一条来定位问题。** 例如仅关闭归一化量化融合，将下列片段合入两台机器各自原有启动命令；模型、并行和图模式等参数沿用[固定部署](glm-5-3-flash-two-node.md#部署前提)。其余两条因省略而保持 true：

```bash
--additional-config '{"ascend_compilation_config":{"fuse_norm_quant":false}}'
```

若要同时关闭本页三条规则，JSON 完整层级如下。已有 additional-config 时合并到同一个对象，保留其他子配置；权重布局键放在外层，具体取值见 [ND/NZ 的配置](tensor-layout.md#怎么开)。

```json
{
  "ascend_compilation_config": {
    "fuse_muls_add": false,
    "fuse_norm_quant": false,
    "fuse_qknorm_rope": false
  }
}
```

Python 的 LLM 将额外关键字传给 EngineArgs，EngineArgs 再把 additional_config 字典送入 VllmConfig；使用 Python 的 False，传入的对象层级不变（来源 35–37、50–52）。这里没有逐请求开关，也没有这三项一一对应的兼容环境变量。关闭三条仅排除这些候选，外部后端的其他改写、GLM 分支的 All-Reduce 规则及捕获回放仍各自受原配置控制。

**启用 static/Super Kernel 的片段。** 支持该能力的版本与硬件上，将以下子对象合入已有 additional-config；图档位还须允许这条编译路径。显式写出三个值，方便比较实验：

```json
{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true,"enable_super_kernel":true}}
```

只评估 static kernel 时把最后一项设为 false。省略 super 的继承规则见版本表；切换它可能使静态编译缓存重建，启动时间要另计。按 921ccc52 指南，static 的启动编译提示只能证明触发过编译，缓存复用时也可能没有提示；在 op_statistic.csv 查 static_kernel 条目确认执行。Super Kernel 的启用日志只证明优化步骤被调用，应再比较 kernel_details.csv 中的任务、耗时及 Block Dim，确认融合覆盖；采集方法见[性能分析](inference-performance-analysis.md#怎么开)。

- **默认就开着。** `enable_npugraph_ex` 默认真，`enable_static_kernel` 默认假 [C7]。官方双机命令两项都没写，所以外部后端开、static kernel 关 [S23]。
- **规则注册一次，登记两处。** 每条 pattern 构造时既调上游 pattern matcher 的 `register_replacement`，也调外部后端的同名接口并带一个额外检查；同名 pattern 全局只注册一次 [C2]。pass manager 由上游在建编译后端时实例化并配置一遍，与最终走哪条编译路径无关（来源 14、46）。
- **谁来应用。** `enable_npugraph_ex` 为真走 `npugraph_ex_compile`，为假走 `fusion_pass_compile`；后者才会从编译配置里取出 pass manager，并按编译区间逐条判断适用性 [C1]。昇腾把这个自定义 pass 的键改成了自己的名字，不是上游那个 inductor 键。
- **固定 GLM 的四条开关。** 管理器按原始子字典读，缺省均真；310P 跳过归一化量化与乘加，`enable_sp` 另加两条 sequence parallel 规则 [C3]。其中 `fuse_allreduce_rms` 作为字段的默认值是假，编译区间切分点那段又按字典默认真，两处不一致 [C12]。
- **平台先定要不要编译。** 图模式为 NONE、或档位需要分段编译、或档位不受支持时，`enable_npugraph_ex` 被置假；整趟图这一档会把 `splitting_ops` 清空，让一个区间编成整张图 [C8]。
- **static kernel 怎么开。** 置真后编译接口把筛出的宽度表写进后端选项；它还要先推算本机进程数并建立按节点分组的通信组，用来协调编译与产物安装 [C5]。

**视觉编译与编译取证的入口。** 下表是启动选项；合并到已有配置中，保留模型、并行和其他编译字段。视觉编译的开关片段是 `--compilation-config '{"compile_mm_encoder":true}'`，其中 true 是 JSON 布尔值。支持范围还须满足版本表中的模型入口和平台条件。

| 项目 | 类型、默认与入口 | 生效位置 |
|---|---|---|
| compile_mm_encoder | CompilationConfig 中的 bool，默认 false；CLI 如上，Python 字典用 True | 带对应装饰器门控的视觉组件；NONE、组件忽略或未开启时直接运行 forward；STOCK 模式由上层 runner 负责 |
| cudagraph_mm_encoder | 同一对象中的独立 bool，默认 false | [视觉图捕获](acl-graph.md#怎么开)，不等于视觉编译开关 |
| VLLM_DISABLE_COMPILE_CACHE | 环境变量，默认 0；诊断时设 1 | 停用 vLLM 这一层的编译产物缓存；编译仍运行。不能据此断言 PyTorch 或外部后端的所有内部缓存均已停用，首次与复用启动耗时应分别记录 |
| TORCH_TRACE / tlparse | 前者指定追踪目录，后者将日志解析为 HTML | 看编译图、图中断、各 rank 记录及动态维度约束；它不是设备耗时测量工具 |

取证时给原启动命令加上 TORCH_TRACE 指定目录和 VLLM_LOGGING_LEVEL=DEBUG，服务退出后用 tlparse 解析实际生成的 rank 日志。可用 `tlparse <追踪目录> -o <输出目录> --latest` 查看目录里最新的一份，排查多 rank 差异则分别解析对应文件；尖括号是需要替换的路径。记录实际 backend、缓存目录和形状约束，避免只截取一条“编译完成”。官方的 [tlparse 用法](https://github.com/meta-pytorch/tlparse/blob/98b8782b90f076f3d77a4a414316e3c8d0d127d4/README.md)说明了两种输入方式。

**开关能隔离哪一层要按平台看。** 上游诊断表的 backend=eager 跳过编译器生成优化实现，但保留前端路径；IR 包装开关的职责见算子页。Ascend 的图模式 NONE 会连 compilation.mode 一起改成 NONE；enforce_eager 也同时关闭编译和图。因而这两个操作不能证明故障只在图捕获一层。先看最终配置和实际编译器，再做一次只改变可区分路径的对照。

### 会报什么错

| 现象 | 看到什么 | 怎么办 |
|---|---|---|
| 子对象写成 null、布尔值或数组 | 固定 GLM / v0.23 / rc 在展开子对象为关键字参数时抛 TypeError；main 也要求有效子配置 | 用 {} 表示默认，用对象内的 false 关闭某项 |
| 字段拼错或层级写错 | 旧版多数键静默忽略；三项写在外层时管理器仍按缺省 true 读取 | 对照上方 JSON；main 未知子键由配置校验拒绝 |
| 用字符串 "false" 关规则 | 旧版原始字典中非空字符串为真，规则仍开启；null 则为假，但并非合法布尔配置约定 | 始终写 JSON 布尔 false；main 会按布尔规则转换字符串，并拒绝 null |
| 只开 `static_kernel`（关 `npugraph_ex`）或只开 `super_kernel`（关 `static_kernel`） | A2/A3/A5 等支持 `NPUGRAPH_EX` 的硬件在配置校验阶段抛 `AssertionError`；310P 先由硬件检查静默置假、不抛断言 [C7] | 遵循 `super -> static -> npugraph_ex` 依赖链，或一并关闭 |
| 已双开/三开 `npugraph_ex` + `static_kernel`（+ `super_kernel`），但图模式不是纯整图（如 `PIECEWISE`、`FULL_AND_PIECEWISE` 或 `NONE`） | 平台 `_setup_compile_backend` 将三项静默刷回 `False`（不抛错） | 需要 static/super kernel 时使用 `FULL_DECODE_ONLY`（或支持的纯整图档位） |
| 在 310P 上配了这两项/三项 | 对原本开启的项发 warning，随后自动静默置假 | 该设备上没有 `HardwareCapability.NPUGRAPH_EX` 路径 |
| 没装 npugraph_ex 这个包 | `ImportError` 被接住，落到 torchair 兼容分支 [C6] | 它只兜导入问题，不是任意编译错误的性能兜底 |
| 图里含 Triton kernel | 跳过编译缓存并打一条 info：索引是进程内的，换进程加载会断言失败 [C6] | 正常现象，下次重新编译 |
| 设了 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台抛 `ValueError` [C8] | 属于图那一层，见 [ACL Graph](acl-graph.md#对照源码) |

**没有命中不一定报错。** 本地规则会在不支持的 dtype、未发现 Attention 等分支写 debug 并返回；乘加与 QK 的匹配日志分别含 “Fused … muls_add patterns” 与 “Fused … QKNorm and Rope patterns”，归一化量化记录 “Replaced … patterns”。先确认走的是本地管理器还是外部后端，再看对应日志；外部路径不能仅以缺少本地计数判断失败。核对门控的来源分别为 10、4、27。

视觉编译没有对应装饰器入口时，给出开关也不会自动改写该组件；进入编译后出现图中断或形状约束错误，应查看对应追踪条目。把整个 mode 改为 NONE 会一起改变语言主干编译，不能当成只关闭视觉编译的实验。只有确实走 Inductor 的环境才沿官方指南检查其生成 kernel、运行时断言或 unpacked 产物；Ascend 默认后端的产物按自己的加载记录检查。

### 开销和什么时候别开

- **编译期**：进入本地改写的区间要运行匹配；static kernel 还可能增加按宽度编译、跨节点分发安装的成本。增加档位不直接给出启动耗时增量，需区分首次编译与缓存复用。
- **数值**：融合改变浮点次序，精度要按容差单独验证，不能因为图跑通就认为数值等价 [I]。
- **刻意关掉的优化**：这条路径把原地改写优化关了，避免某些算子回退 CPU 带来主机与设备之间的拷贝。所以不要按外部后端的一般能力推断它启用了原地复用。
- **什么时候别开**：排查精度或 hang 时常用强制 eager，但那会把编译改写和图回放一起关掉，问题消失只能把范围缩到这两层；要分开看，先只关一层 [D]。形状长期不整齐时，收益会被补齐和退回吃掉。
- 本页所有结论都来自配置与源码，没有 NPU 实测，不给加速比 [I]。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）统一将 `AscendCompilationConfig` 收口为 Pydantic `@config` 校验模型，声明默认值与最终生效值须结合硬件能力与图模式分别核对：**
- **依赖链与硬件分化**：`enable_npugraph_ex` 默认 `True`，`enable_static_kernel` / `enable_super_kernel` 默认 `False`；显式传 `enable_static_kernel` 且省略 `enable_super_kernel` 时，前置校验令后者跟随前者。随后后置校验先检查 `HardwareCapability.NPUGRAPH_EX`（310P 不支持，打 warning 后将三者静默刷回 `False`），再在 A2/A3/A5 上以 `assert` 强校验 `super -> static -> npugraph_ex`，单开即抛 `AssertionError`。
- **非纯整图静默刷回 `False`**：`_setup_compile_backend` 在 `NONE`、`requires_piecewise_compilation()`（含 `PIECEWISE` 与 `FULL_AND_PIECEWISE`）及不受支持档位下，都会将三者全部静默写回 `False`；仅在纯整图（`has_full_cudagraphs()` 且不需要 piecewise，如 `FULL_DECODE_ONLY`）保留并清空 `splitting_ops`。
- **融合规则演进**：`v0.30.0` 在 `GraphFusionPassManager` 登记 `AddRMSNormQuantFusionPass`、`QKNormRopeFusionPass`（含 Gemma 式 QKVNormRoPE 模式，另要求 `HAS_TRITON`、`GRAPH_QKV_NORM_ROPE_FUSION` 与单 token tile 进 UB）和 `MulsAddFusionPass`；`main` 在此基础上当 `enable_sp(config)` 且支持 `GRAPH_MM_REDUCE_SCATTER_FUSION` 时新增 `MatmulReduceScatterFusionPass`。

| 核对项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 配置形态与输入检查 | 普通类，未知子键忽略、字符串 `"false"` 按真处理 | 同 `v0.23.0` | Pydantic `@config`（`extra="forbid"`），`"false"` 转 `False`，拒绝 `null` 与未知子键 | 同 `v0.30.0` |
| `npugraph_ex` / `static` / `super` 默认与联动 | `npugraph_ex=True`、`static=False`；无 `enable_super_kernel` | 新增 `enable_super_kernel`（省略或 `None` 跟随 `static`；最初 `rc1` tag 无此字段） | 声明默认 `True / False / False`；显式给 `static` 省 `super` 时跟随；A2/A3/A5 单开 `AssertionError`，310P 静默关；非 `FULL_DECODE_ONLY` 刷回 `False` | 同 `v0.30.0` |
| 融合 Pass 清单与开关读取 | 4 条（含 `fuse_allreduce_rms`）+ 2 条 SP 规则；读原始字典、按设备型号判 310P | 删除 `allreduce_rms`；仍读原始字典 | 3 类核心 pass（`norm_quant`、`qknorm_rope`［含 QKVNormRoPE］、`muls_add`）；读配置对象并按 `HardwareCapability` 门控 | 在 3 类之上，SP + `GRAPH_MM_REDUCE_SCATTER_FUSION` 时新增 `MatmulReduceScatterFusionPass` |
| `fuse_muls_add` 字段 | 仅走 `**kwargs`，非正式字段 | 同 `v0.23.0` | 正式布尔字段（默认 `True`） | 同 `v0.30.0` |
| 视觉编译入口（`compile_mm_encoder`） | `Qwen2.5-VL` 有门控；`Qwen3-VL` 尚无；图 `NONE` 同步关编译 | 同 `v0.23.0` | `Qwen2.5-VL` 保留，`Qwen3-VL VisionBlock` 新增门控；图 `NONE` 仍同步关共享编译 | 同 `v0.30.0` |
| 捕获层实现 | 单一 `ACLGraphWrapper` | 同 `v0.23.0` | 扩展 `BreakableACLGraphWrapper` 与 `updatable_graph` | 延续三类实现，MRV2 统一编排 |

官方文档把图模式与编译改写分两层介绍并列出昇腾支持的档位取值 [S22]。默认开关不证明当前图命中规则或获得加速；视觉编译表列的是已读组件入口，不代表所有多模态模型均已接入；固定 GLM 主线保持原配置，升级后应重新核对候选与日志。

### 源码位置

- `v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 实核：`AscendCompilationConfig` 依赖链、310P 降级与 A2/A3/A5 `AssertionError` 见 `c09d3e20:ascend_config.py#L112-L170` 与 `8d6180e2:ascend_config.py#L119-L177`；非纯整图静默刷回 `False` 见 `c09d3e20:platform.py#L1310-L1354` 与 `8d6180e2:platform.py#L1515-L1559`；`GraphFusionPassManager`（含 `main` 新增 `MatmulReduceScatterFusionPass`）见 `c09d3e20:compilation/graph_fusion_pass_manager.py#L51-L73` 与 `8d6180e2:compilation/graph_fusion_pass_manager.py#L52-L79` [C92][C95]。

- 选路与两条编译实现：`compiler_interface.py` 的 `AscendCompiler.compile`、`npugraph_ex_compile`、`fusion_pass_compile`；宽度筛选与后端选项在同一文件的 `_compute_decode_cudagraph_batch_sizes`、`_configure_backend`。
- 规则注册：`passes/base_pattern.py` 的 `register`；pass manager 与四条开关：`graph_fusion_pass_manager.py`；上游实例化与配置它的地方：`vllm/compilation/backends.py` [C14]；自定义 pass 键：`platform.py` [C13]。
- 四条融合规则的固定源码索引：归一化接量化的静态 pattern 见来源 9，完整候选门控见来源 27；其中 W4A4_DYNAMIC / W4A4_FLATQUANT_DYNAMIC 权重描述会跳过整条 pass，不带 bias 的动态候选不依赖 enable_custom_op，静态和带 bias 候选依赖它，MX 候选另需相应符号和 A5 条件。Q/K 注册与筛选见来源 4，All-Reduce 注册与区间见来源 11（512 常量见 25），乘加读取 hf_text_config.routed_scaling_factor、缺省 1.0 并注册常数，见来源 10。[C9]
- GLM 主干的候选边界：来源 17 的昇腾归一化算子区分有无 residual，来源 49 的 mHC 前向实际传单个输入；两类注意力分支的构造见来源 16。来源 15 的上游通用 MLA 类本身也不是普通 Attention 的子类，但不能用这一类声明代替整个 GLM 服务的注册上下文检查。
- 配置字段、310P 降级与 static kernel 断言：`ascend_config.py`；档位与平台改写：`platform.py`。

- 视觉编译的默认与图捕获字段分立：来源 54–57；四版组件初始化门控：58–61；最后一个编译区间的扩展：62–65。Qwen2.5-VL VisionBlock 四版入口为 66–69，Qwen3-VL 对应为 70–73。运行时直接 forward 的退出分支见 90。
- 真正的编译器选择：74 先取平台 backend，75 的 make_compiler 选择适配器，91 返回 AscendCompiler。平台里旧 use_inductor/oot_compiler 赋值不能替代这条消费者链。本地改图实现仍由来源 45 支持。
- 编译缓存：四版默认键、组件目录与禁用入口见 76–79；缓存开关消费见 80；固定 Ascend 自己的哈希与实际加载/缺失重编译见 81–82。新版图 NONE 关闭编译的片段补在 83–84，旧 GLM 与历史 `v0.30.0` 候选快照已分别在来源 8、41。
- 官方母文全文见 85（追踪和排查）、86（编译与缓存）、87（多模态编译）、88（上游融合矩阵）；tlparse 的目录/latest 与单日志两种输入见 89。母文中的模型收益数值不作为本页 NPU 收益；范围扩展的例子由实际源码推演，原区间与 10 个位置是教学设定。

**运行时边界**：四条规则各自命中几处、最终上下文有没有符合条件的 Attention 层，以及外部后端自己完成了哪些改写，需要启动日志或编译图确认；static kernel 的编译和执行收益需要设备对照，本页没有这些运行期数据。

来源 2、9、10 对应固定 db701c1f 的规则注册与替换：归一化接量化仍返回残差，乘加换成融合接口。乘加接口实际注册到 Triton 实现，代码只加载 x、y 并写最终结果，没有单独分配乘法中间张量（来源 47–48）；这支持前面的 128 B 张量读写示意，不等于设备总访存实测。Super Kernel 的机制、启用及采集验证见 921ccc52 官方图模式指南；配置依赖与默认在 `v0.26.0rc`（`2ed6cbba` L599–661）、历史快照（`baa023ad` L103–160 / `7d825229` L114–171）与 `v0.30.0`（`c09d3e20`）/ `main`（`8d6180e2`）间一脉相承。布尔字符串转换与未知键拒绝还有固定配置类测试覆盖（来源 53），本页没有运行该 NPU 相关测试。
