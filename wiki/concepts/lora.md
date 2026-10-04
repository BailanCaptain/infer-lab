---
id: lora
title: LoRA：低秩更新与多适配器推理
type: feature
summary: LoRA 不改基座权重，只在旁边挂两个小矩阵；本页从一个输出数怎么算讲到一台服务怎么同时挂多个适配器，最后核实本部署没有启用。
aliases:
- LoRA
- LoRA 适配器
- 低秩适配
- Low-Rank Adaptation
- Multi-LoRA
- 多 LoRA
- 多租户适配器
- PunicaWrapperNPU
- punica
- bgmv
- sgmv
- LoRARequest
- enable-lora
- lora-modules
chapters:
- '17'
sources:
- https://arxiv.org/abs/2106.09685
- vllm@0fc695fc:vllm/lora/model_manager.py#L273-L308
- vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L15-L49
- vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L54-L115
- vllm@0fc695fc:vllm/lora/layers/base_linear.py#L99-L145
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L589-L602
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L861-L862
- vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L21-L104
- vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L324-L410
- vllm-ascend@db701c1f:vllm_ascend/lora/utils.py#L74-L88
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2945-L2964
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/lora.md#L9-L30
- vllm@0fc695fc:vllm/config/lora.py#L31-L46
- vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/lora.md#L28-L30
- vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L26-L29
- vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lora.md#L30-L37
- vllm-ascend@baa023ad:vllm_ascend/lora/punica_npu.py#L31-L34
- vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L52-L68
- vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L369-L413
- vllm-ascend@baa023ad:vllm_ascend/lora/lora_ops.py#L460-L500
- vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L293-L300
- vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L329-L352
- vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L361-L368
- vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L487-L496
- vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L396-L405
- vllm-ascend@db701c1f:docs/source/user_guide/support_matrix/supported_features.md#L10-L14
- vllm@0fc695fc:vllm/v1/worker/lora_model_runner_mixin.py#L52-L68
- vllm@0fc695fc:vllm/forward_context.py#L45-L60
- vllm@0fc695fc:vllm/lora/lora_weights.py#L28-L44
- vllm@0fc695fc:vllm/lora/worker_manager.py#L285-L299
verified: []
evidence: C
relations:
- to: matmul-and-weights
  kind: builds-on
  note: 先理解线性层输入、权重与输出形状。
- to: concurrent-requests
  kind: builds-on
  note: 不同适配器的请求可以共同组成执行批。
- to: acl-graph
  kind: builds-on
  note: 适配器状态参与捕获图分派。
contradicts: []
updated: '2026-09-29'
origin: direct
---

## LoRA 是什么：基座一个数不动，旁边挂两个小矩阵

一个线性层做的事，是把输入向量乘上一张权重表 W，得到输出（这一步怎么乘见[矩阵乘法与权重](matmul-and-weights.md)）。想让模型学会一个新任务，最直接的办法是把 W 里每个数都重训一遍，这叫全参数微调。

LoRA（Low-Rank Adaptation，低秩适配）换了个办法：**基座权重 W 一个数都不改**，在它旁边挂两个小矩阵 A 和 B。A 把输入压到很窄的 r 维，B 再把这 r 维抬回输出宽度。于是这一层的输出变成两路相加：

- 原来那一路：输入 x 乘基座 W，和没挂之前完全一样；
- 新挂的那一路：x 先乘 A 压窄、再乘 B 抬回来，乘一个固定比例 s 之后加上去。

三个名字先说清楚：中间那个窄维度叫**秩**（rank）r，常见取 8、16、32；一次微调在所有被挑中的层上留下的那一包 A、B，合起来叫一个**适配器**（adapter）；加回去时乘的那个固定系数叫**缩放**（scaling）s，它不是随手定的，而是 `s = α / r`，α 是训练时定的超参，跟着适配器一起存下来。一个适配器通常覆盖好几类层的多对 A、B，不是整个模型只有两个小矩阵。

```wiki-diagram
file: lora
```

## 为什么需要它：换个任务不必再存一份模型

设想同一个基座模型要服务客服、法务、代码三类任务。按全参数微调，每类任务都要另存一整份权重：今天的大模型一份就是几十 GiB，装下它得占住一整套卡，再来一个任务就是再来一整份、再起一套服务。

LoRA 要另存的只有 A、B。一层上是 `r × (d_in + d_out)` 个数，而完整更新是 `d_in × d_out` 个。举个示意尺寸：一个 1024 进、1024 出的线性层有 104.9 万个数，秩 8 的一对 A、B 只有 `8 × (1024 + 1024) = 16384` 个，约 1.6%。层越宽、秩越小，这个比例越小。

省下来的不只是硬盘。基座既然没被改过，服务时**基座只装一份**，多个适配器同时挂着，哪条请求要哪个适配器，就在属于它的那几行计算里多加对应的那一路；挂不同适配器的请求还能拼进同一批一次算完。

代价也在这里：更新量被关在秩 r 这个很窄的空间里，能表达的变化比全参数微调少。秩开大能多表达一些，显存和计算也跟着涨。

## 怎么算：一个输出数是怎么攒出来的

按行向量写，设输入宽 `d_in`、输出宽 `d_out`、秩 r：

`y = xWᵀ + s(xAᵀ)Bᵀ`

其中 W 的形状是 `[d_out, d_in]`，A 是 `[r, d_in]`，B 是 `[d_out, r]`。

拿一个缩到能手算的例子走一遍（数是示意的，公式是真的）：`d_in = 4`、`d_out = 3`、`r = 1`、`s = 1`（也就是 α 正好等于 r），输入 `x = [2, 1, 1, 0]`，适配器 `A = [1, 0, −1, 0]`、`B = [1, 2, −1]ᵀ`，基座 `W` 三行取 `[1, 0, 1, 0]`、`[1, 1, 1, 0]`、`[2, 1, 0, 0]`。盯住输出的第 2 个数：

1. 原来那一路照常算：`x` 和 W 的第 2 行逐位相乘再相加，`2×1 + 1×1 + 1×1 + 0×0 = 4`（三行都这么算，得到 `[3, 4, 5]`）；
2. 新挂的那一路先压：`xAᵀ = 2×1 + 1×0 + 1×(−1) + 0×0 = 1`，四个数被压成 1 个数；
3. 再抬：这个 1 乘 B 的第 2 行 `2`，得到 2，这就是这一路给第 2 个数的更新量；
4. 两路相加：`4 + 2 = 6`。

三个输出数都这么走一遍，更新量是 `[1, 2, −1]`，最终输出 `[4, 6, 4]`。基座那一路每个数都要算，低秩那一路只是加在它上面。

参数上，这一层的适配器是 `1 × (4 + 3) = 7` 个数，完整更新要 `4 × 3 = 12` 个。维度越大、秩越小，差距越夸张——上一节那个 1.6% 就是同一个式子算出来的。

还有一处服务侧的实际形态要提前说明：真跑起来时，权重加载阶段就把 s 乘进 B 里存好，之后每步都按 s 等于 1 算，所以设备上看不到一次单独的「乘 s」。

## 一台服务怎么同时挂多个适配器

多个适配器要在同一批里混着算，靠的是**槽号**。注册适配器时，每个适配器拿到一个全局唯一的编号；设备上另有一张槽位表，长度等于「一步里最多同时出现几个不同适配器」这个名额，适配器被启用时塞进表里第一个空位，**那个空位的下标才是槽号**。

每步前向之前，引擎把「这一行属于哪个请求、那个请求挂哪个适配器」翻成一条和这批行数一样长的槽号表，**没挂适配器的行填 −1**。比如某批四行是 `[0, 1, 0, −1]`：四行都要算基座那一路，第 1、3 行再加槽 0 的更新，第 2 行加槽 1 的更新，第 4 行什么都不加。同一适配器也不用在批里连成一段出现——例子里槽 0 就隔着一行出现了两次。两路不是二选一的岔路，同一批里混着挂和不挂的请求也不用分支判断。多条请求怎么拼进一批见[并发请求](concurrent-requests.md)。

几件容易记反的事：

- 设备显存是**按名额预付**的：建层的时候就按「名额 × 最大秩 × 这一层在本卡上的分片形状」把位置全开好，实际加载了几个适配器不影响这块占用；最大秩写大而适配器实际秩小，多出来的行留着零也照样占地。
- 名额占满不报错：调度器发现这一步已排进的适配器数到了上限、新来的请求要的又不在其中，就把它放回去等下一轮，不堵在队首（这道闸在[调度器](vllm-scheduler.md)里）。
- 默认值很保守：名额默认 1，最大秩默认 16。想同时服务多个适配器，必须显式调大。
- 代码里备着两套入口：按段乘（把相邻且同槽的行合成一段）和按行乘。但 V1 引擎建这张槽号表时恒把它标成 [prefill](prefill.md)，注释写明就是要让非 CUDA 平台一直用按段那套，所以昇腾上**实际一律按段走**；decode 步里每条请求的那一两行，本身就各自成段。

## 昇腾上是谁在算这一路

上游 vLLM 把「按槽号取小矩阵乘回去」这一段做成了可替换的插件位，平台启动时交出一个类名。昇腾交出自己的实现：槽号表、段的起点、是不是 prefill 这些元数据全用上游算好的，自己只重写乘法入口。真正做乘法的是昇腾用 AscendC（昇腾的算子编程语言，见[算子与核函数](ops-and-kernels.md)）写的四个核函数——按段压、按段抬、按行压、按行抬各一个，注册成 torch 算子后由 Python 侧一层薄包装调起，源文件与注册入口见「对照源码 › 源码位置」。层替换表里也插了昇腾自己的 LoRA 层类，这样昇腾自建的线性层同样换得上。模型运行器在加载期挂上适配器，每步刷新「这一步谁在用哪个」。

两处要留意。一是 MoE 模型：适配器索引还要和专家索引组合起来，对展开后的专家输入行算更新、再结合路由权重，比普通线性层多一层索引关系（token 怎么分派到专家见 [MoE](moe.md)）。二是有静默降级：310P 上，或者最大秩设到 128 及以上时，整批换成上游的纯 PyTorch 实现，日志里不会提醒。

图执行也被牵动：一批要用哪张捕获好的图，是按「这一批带不带 LoRA」和「这一步有几个活跃适配器」一起挑的——带 LoRA 的批和不带的不共用同一张图，活跃适配器数不同也可能分到不同的图（图模式见 [ACL Graph](acl-graph.md)）。昇腾文档说明开着图模式也能跑 LoRA，并建议开着以获得更好的性能；同时这个特性在支持矩阵上标的是 Experimental，不是 Functional。

## 本部署有没有开

**没有开。** 双机教程的启动命令里没有 LoRA 总开关（启动参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)），引擎里整套挂载逻辑直接跳过；[贯穿全库的那条请求](one-request.md)经过的每一层，也都只有基座那一路。

就算要开，本部署也正好踩在版本边界上：钉住版本的昇腾文档写明，MoE 模型挂 LoRA 时 **expert parallel 和量化都还不支持**，而本部署恰好是 EP16 加 W8A8（见 [Expert Parallel](expert-parallel.md)、[量化](quantization.md)）。

main 开发主线上这两格已经放开：W8A8 动态量化配 All-to-All 那一格标的是支持，本部署正落在这一格里。但代价藏在通信上——一旦同时开着 LoRA 和 expert parallel，MoE 的通信方式会在按硬件挑之前就被强制换成 All-to-All，因为 MC2 那条路是一个融合成整块的算子，低秩旁路插不进去。而本部署在 A2 上平时只在 MC2 和 AllGather 之间二选一，从不用 All-to-All，所以开 LoRA 会连带换掉 MoE 的通信形态，开销要重新测（各通信方式的差别见 [Expert Parallel](expert-parallel.md)）。

先算一下这套部署上适配器能省多少：本模型隐藏宽度 4096，一个 4096×4096 的线性层有 1677 万个数，秩 16 的一对 A、B 只有 13.1 万个，是前者的 0.78%；而每张卡上的基座权重是 20.58 GiB（见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），换个任务不必再复制这 16 份。

本页不给 GLM 双机上的 LoRA 时延、吞吐或显存结论。**待核**：缺本模型开 LoRA 之后的实测数据（尤其是通信被换成 All-to-All 之后的开销），也缺官方对这一模型的 LoRA 支持声明。上面那个 0.78% 是按层宽推的参数量比例，不是实测效果。

## 常见误解

- **「MLA 里的 `kv_lora_rank` 就是 LoRA。」**——只是撞了名字。那是 [MLA](mla.md) 把 KV 压成低秩隐向量时的宽度，写死在模型结构里，和外挂适配器没有关系。
- **「挂 8 个适配器就比挂 1 个多占 8 倍显存。」**——设备上那份按名额预付，加载几个都一样；随加载数量涨的是 CPU 侧那份缓存。
- **「名额就是能注册的适配器总数。」**——名额管的是**一步里能同时出现几个不同适配器**；CPU 侧那个上限管的是同时缓存几份，满了就按最久没用的换出去，下次要用再从盘上加载，并不是能注册的总数。一步里超额的请求排队等下一轮，不报错。
- **「秩减半，开销就减半。」**——减半的是参数字节和两次小矩阵乘的乘加；压和抬两趟算子一趟都少不了，这部分不随秩缩小；压出来的低秩中间结果还要占一块「行数 × 最大秩」的 float32 缓冲，宽度跟配置的最大秩走，适配器实际的秩再小它也不缩。
- **「论文说 A、B 可以并回 W、推理零额外开销，那服务上就不该有额外算子。」**——并回 W 的前提是这台服务只认一个适配器。要同时服务多个适配器、还要混在同一批里，就不能并回去，于是才有本页这套槽号、预付显存和两趟额外算子。

## 对照源码

### 怎么开

- 总开关 `--enable-lora`；`--lora-modules` 在启动时注册适配器，一个 JSON 一个 [S12]。
- 三个参数：`--max-loras`（一步里的名额，默认 1）、`--max-lora-rank`（最大秩，默认 16，取值限定在 1/8/16/32/64/128/256/320/512）、`--max-cpu-loras`（CPU 侧缓存份数，不写就等于名额）[C13]。
- 本部署没开这个开关：双机教程的启动命令与[部署前提](glm-5-3-flash-two-node.md#部署前提)里都没有 LoRA 相关项。

### 会报什么错

- 这条路的特点是该挡的地方不报错：名额占满时，要新适配器的请求被移出等待队首、放进本步的跳过队列，下一轮再排 [C6]。
- 310P 上或最大秩 ≥ 128 时，整批换成上游纯 PyTorch 实现，日志不提醒 [C8]。
- `--max-cpu-loras` 写得比 `--max-loras` 小，启动时直接报错 [C13]。
- 想确认哪个适配器进了哪个槽，看启用时打的 debug 日志，里面写了适配器编号与槽位下标 [C2]。
- CPU 侧缓存满了也不报错：加载成功后发现超过容量，就按 LRU 换出最久没用的那一份 [C30]，下次再要它就重新从盘上加载。

### 开销和什么时候别开

- 预付：建层时按「名额 × 最大秩」把 A、B 的位置全部开好，与实际加载数无关 [C5]；开启 `fully_sharded_loras` 时，列并行层上这一维还会按 TP 份数再切。
- 每行多两趟算子（压、抬）。昇腾侧按段（SGMV）与按行（BGMV）两套入口都在 [C8]，但 V1 的 runner 建 `LoRAMapping` 时恒传 `is_prefill=True`，注释写明就是要让非 CUDA 平台一直用 SGMV [C27]，昇腾的 `NPUModelRunner` 继承这个 mixin 而未覆盖，所以 decode 步实际也走按段那套，BGMV 分支在 V1 上是死路径。
- 不打算挂适配器就别开总开关：层被替换、槽位被预付，都是白花。
- MoE 模型上，钉住版本里 EP 与量化这两个组合官方明说不支持，本部署两样都占；在放开了这两格的 main 上，开 LoRA 又会把 MoE 通信强制换成 All-to-All [C25]，而本部署在 A2 上平时只在 MC2 与 AllGather 之间二选一。
- 缩放系数在加载阶段就被乘进 B 并把 `scaling` 置 1 [C29]，所以运行时看不到单独的乘 s；`s = α / r` 的定义也在同一处。
- 图执行按批描述符里的 `has_lora` 与 `num_active_loras` 分桶 [C28]，昇腾的 runner 每步据此填这两个字段 [C11]；该特性在支持矩阵上是 Experimental [S26]。

### 版本差异

| 项 | v0.23（含 GLM 代码的 db701c1f） | v0.26（2ed6cbba） | main（baa023ad） |
|---|---|---|---|
| MoE 挂 LoRA 时的 EP 与量化 | 都不支持 [S12] | 同 v0.23 [S14] | 非量化与 W8A8 动态量化 × AllGather 与 All-to-All 四格都标 Supported；其他量化方法、Fused MC2、动态 EPLB 仍不支持 [S16] |
| 哪些卡退回 PyTorch 实现 | 写死判 310P，或最大秩 ≥ 128 [C8] | 同 v0.23 [C15] | 改成查硬件画像上的能力位，不再写死卡型 [C17] |
| MoE + EP 时挑哪种通信 | 没有 LoRA 特判，照硬件挑 | 在按硬件挑之前插一条：开着 LoRA 又开 EP 就强制 All-to-All，理由写在注释里——MC2 / FusedMC2 是单个融合算子，低秩旁路补不进去 [C24] | 同 v0.26 [C25] |
| 只挂一个适配器时怎么算 | 没有快路，照走按段 / 按行那套 | A2、A3 上且名额为 1、又没开 `fully_sharded_loras` 时切成普通 matmul 加一条掩码 [C18][C19] | 条件同 v0.26，实现抽成一个自定义算子，并先试 Triton 版本 [C20] |
| ACL Graph 的参数表 | 一份 `GraphParams` [C21] | 按 `has_lora` 拆成两份；只在 FULL 图模式下才按批描述符选带 LoRA 的那份，其他图模式一律取不带的 [C22] | 又并回一份，文件里不再出现 LoRA [C23] |

表里对本部署最要紧的是「MoE 挂 LoRA 时的 EP 与量化」「MoE + EP 时挑哪种通信」这两行：只要开着 EP，v0.26 与 main 上一开 LoRA，MoE 通信就不再是本部署平时的 MC2 / AllGather。「只挂一个适配器时怎么算」一行说明这个最常见用法在新版本上走的是另一条更短的路。v0.23 维护分支 2c59ff10 上也有 `vllm_ascend/lora/`，但那条分支不含 GLM 代码，本页 v0.23 一列一律读 db701c1f；`max_loras == 1` 的快路与按 `has_lora` 拆参数表这两件事，在 2c59ff10 与 db701c1f 上都搜不到。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 三个启动参数与默认值 | 上游 `vllm/config/lora.py` |
| 槽位表与逐行槽号 | 上游 `vllm/lora/model_manager.py` 的 `activate_adapter`、`vllm/lora/punica_wrapper/utils.py` 的 `convert_mapping` |
| 预付的权重形状 | 上游 `vllm/lora/layers/base_linear.py` 的 `create_lora_weights` |
| 名额占满的闸门 | 上游 `vllm/v1/core/sched/scheduler.py` |
| 昇腾交出的乘法实现 | `vllm_ascend/platform.py` 的 `get_punica_wrapper`、`vllm_ascend/lora/punica_npu.py` |
| 四个 AscendC 核函数 | `csrc/kernels/` 下的 `bgmv_shrink.cpp` / `bgmv_expand.cpp` / `sgmv_shrink.cpp` / `sgmv_expand.cpp`，注册在 `csrc/torch_binding.cpp`；Python 薄包装是 `vllm_ascend/lora/lora_ops.py` |
| 层替换与运行器挂钩 | `vllm_ascend/lora/utils.py`、`vllm_ascend/worker/model_runner_v1.py` |
| 恒标 prefill 的映射 | 上游 `vllm/v1/worker/lora_model_runner_mixin.py` |
| 缩放与 LRU 换出 | 上游 `vllm/lora/lora_weights.py`、`vllm/lora/worker_manager.py` |
| 图分桶字段 | 上游 `vllm/forward_context.py` 的 `BatchDescriptor` |
| MoE 通信的 LoRA 特判 | `vllm_ascend/ascend_forward_context.py`（v0.26 与 main） |
| 单适配器快路与图参数表 | `vllm_ascend/lora/punica_npu.py`、`lora/lora_ops.py`、`compilation/acl_graph.py` |
| 官方 LoRA 特性文档与支持矩阵 | `docs/source/user_guide/feature_guide/lora.md`（三个版本各一份）、`support_matrix/supported_features.md` |
| 方法本身 | LoRA 原论文 [S1] |
