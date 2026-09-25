---
id: quantization
title: "量化：同一个模型，权重从 65 GiB 压到约一半"
type: feature
summary: 把权重从 2 字节一个数换成 1 字节一个数存，省下的是显存和每一步读权重的时间。昇腾适配层自己不做量化，只负责认出、加载和执行别人离线做好的量化权重；哪一层用哪种量化写在模型目录的一份描述文件里。
aliases: [Quantization, 量化, 权重量化, 激活量化, W8A8, W4A8, W8A16, ModelSlim, msmodelslim, AscendModelSlimConfig, quant_model_description.json]
chapters: ["17"]
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L3-L5
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L105-L107
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/quantization.md#L102-L112
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/quantization.md#L13-L15
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/quantization.md#L29-L46
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L95-L117
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L171-L214
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L449-L465
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L140-L145
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L190-L197
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L60-L67
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L786-L801
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L808-L830
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L361-L382
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L434-L453
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/registry.py#L19-L49
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L634-L679
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L701-L708
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L44-L72
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L108-L140
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L142-L157
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L82
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/method_adapters.py#L51-L98
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L268-L274
  - vllm@0fc695fc:vllm/config/model.py#L1075-L1081
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150-L150
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L26-L28
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L40-L57
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w4a8/w4a8.py#L40-L46
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L133-L142
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L32-L40
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L94-L101
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L105-L121
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/quant_type.py#L26-L37
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/quant_type.py#L26-L37
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/quantization.html
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L217
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L229-L229
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L155-L155
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 「一颗 NPU 权重约 32.6 GiB、剩 21.5 GiB 给 KV」那张表在那一页，这一页只把权重那一行换成 W8A8 重算
  - to: matmul-and-weights
    kind: builds-on
    note: 「35B = 350 亿个数、按 2 字节存约 65 GiB」这笔粗账在那一页，量化改的就是这里的 2 字节
  - to: ops-and-kernels
    kind: builds-on
    note: 量化线性层最后落到 npu_quant_matmul 这个 torch_npu 融合算子上，算子怎么下到 AI Core 在那一页
  - to: npu-platform
    kind: builds-on
    note: ascend 这个量化方法名写在平台类的 supported_quantization 里，自动探测也挂在 check_and_update_config 上
  - to: kv-cache-quantization
    kind: alternative-to
    note: 同一份描述文件、同一次 get_quant_method 分发，但它压的是缓存、这一页压的是权重，两者可以一起开
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 官方教程为什么不用原版权重

照官方教程在两颗 NPU 上部署[贯穿全库的例子](one-request.md)里的 Qwen3.6-35B-A3B，你会发现它下载的不是原版模型，而是一份名字里带「w8a8」的权重。同一个模型，为什么要换一份？

先算原版有多大。这个模型约 350 亿个数，每个数用 2 字节存，一共约 65 GiB（这笔粗账在[矩阵乘与权重](matmul-and-weights.md)）。两颗 NPU 各分一半，每颗约 32.6 GiB——一颗 64 GiB 的显存还没开始干活，权重就先吃掉一半。

**量化**就是把这些数换成更小的格式存：W8A8 的意思是权重（W）用 8 位存、激活（A，每层算到一半的中间数据）也用 8 位算。8 位就是 1 字节，权重这一项直接折半。代价是每个数能表示的精度变粗了，要靠几个缩放系数把它尽量拉回原来的范围。

有一件事要先说清：**量化不是这套推理引擎做的**。压缩这一步由专门的工具离线做完，产出一份新的权重和一份描述文件——哪一层用哪种量化，逐个权重写在里面。引擎只负责认出这份描述文件、按它把每一层换成对应的低精度算法、然后照常推理。三个版本（v0.23 维护分支、v0.26 分支、main 开发主线）上都是这套机制，下面按 v0.23 讲。

```wiki-diagram
file: quantization
```

## 算一笔账：65 GiB 变成约 34 GiB

这个模型的权重，绝大部分在专家里：每层 256 个专家，40 层合起来约 60 GiB，剩下约 5 GiB 是两张词表和注意力等其余部分（专家那笔账在[专家并行](expert-parallel.md)）。两张词表各约 0.95 GiB，一般不量化。

| 项 | bf16（原版） | W8A8 |
|---|---|---|
| 专家 | 60 GiB | 30 GiB |
| 两张词表（不量化） | 约 1.9 GiB | 约 1.9 GiB |
| 注意力等其余部分 | 约 3.3 GiB | 约 1.7～3.3 GiB |
| **整个模型** | **约 65 GiB** | **约 34～35 GiB** |
| **一颗 NPU（两颗各一半）** | **约 32.6 GiB** | **约 17 GiB** |

「其余部分」写成一个范围，是因为这份量化权重里哪几层被压了、哪几层留着原精度，要看它自带的描述文件，这里没有逐层核过；两头都算上，结论不变：**大约砍掉一半，一颗 NPU 省下约 15 GiB**。

省下的 15 GiB 直接进了 KV Cache 的预算。[显存里都装了什么](kv-cache-memory-profiling.md)那一页按原版权重算，一颗 NPU 剩给 KV 的是 21.5 GiB；换成 W8A8，这个数涨到约 37 GiB，多了七成。能同时服务的请求、能撑的上下文长度，都跟着这个数走。

**第二笔账比第一笔要紧。** 生成回答的每一步，都要把这一步用到的权重从显存里读一遍。这个模型一个 token 实际用到约 30 亿个数（8 个被选中的专家加上注意力等），它们存成 1 字节，每一步要读的量就接近减半。对照着看：那条请求全程 237 个 token，每颗 NPU 上的 KV Cache 才 2.3 MiB——每一步读权重的量要大几百倍。量化省的正是这一头。

还有一小笔要扣回去：每个输出通道要多存几个缩放系数，静态方案合计 12 字节。一行权重有上千个数，这点额外开销不到百分之一，可以忽略。

## 开关在模型目录里，不在命令行上

官方指南说，这类量化权重要在命令行上显式打开量化选项。实际上不写也行：引擎启动时会先看一眼模型目录，**找到那份量化描述文件，就自己把量化打开**；找不到，再看模型配置里有没有另一种量化工具留下的标记。两样都没有，就按原精度加载。

所以在这三个版本上，命令行那个选项是显式写法，不是必需品。反过来，给一个没量化的模型硬加上它，会在启动时收到一段很长的报错，末尾还把目录里找到的配置文件名列出来，方便你看缺了哪个。

「ascend」这个量化方法名，原版 vLLM 不认识。它能被接受，是因为昇腾平台层在启动最早的时候把它登记了进去——登记在支持的方法列表里，也加进了命令行选项的可选值。平台层这些挂钩点见 [NPUPlatform](npu-platform.md)。

## 「支持 W8A8」要连层的种类一起说

描述文件告诉引擎每一层用哪种量化，引擎拿「量化类型 + 层的种类」这一对去一张登记表里找实现。v0.23 上这张表一共 25 条：17 种量化类型、5 种层（普通线性层、专家层、注意力、以及两个 DeepSeek 专用的位置）。

**缺的格子是真会撞上的。** 最常说的那种「静态 W8A8」只给普通线性层实现了，专家层没有；专家层要用「动态 W8A8」这类方案。对 Qwen3.6-35B-A3B 这种权重大头全在专家里的模型，这一点决定了量化权重必须怎么做。查不到的组合会报错，而且是**在启动建层的时候就报，不是推理到一半才报**。

官方文档的算法表只列了 7 种，代码里真正能用的比这多一倍多。要确认某一种到底支不支持，数登记表比读文档准。这些文件在仓库里的位置见[仓库地图](vllm-ascend-repo-map.md)。

## 一个线性层被换掉的是哪三段

每个线性层在建出来的时候，都会去问量化配置：「我该用什么算法？」引擎先查这一层的权重名在描述文件里写的是什么类型。像把 Q、K、V 三块拼在一起的那种合并层，几段必须是同一种类型——没法一半 int8 一半原精度，不一致就直接报错。描述文件里标成「不量化」的层，走原精度的老路，这就是「某几层保留原精度」在引擎里的落点。

确定用 W8A8 之后，这一层有三段被换掉：

- **建权重**：权重直接建成 int8，另外为每个输出通道多开几个缩放系数。
- **装完权重再改一次布局**：把权重转置，再转成昇腾矩阵单元最顺手的内存格式。
- **前向计算**：激活如果还不是 int8，先按缩放系数把它压成 int8；然后一个融合算子一次算完矩阵乘，**反量化不是单独一步**——缩放系数直接交给算子，出来就是原精度的结果。这个算子怎么下到芯片上见[算子与核函数](ops-and-kernels.md)。

## 静态和动态：差的是那一个缩放系数从哪来

激活每一步都是新算出来的，它的缩放系数有两种来法：

- **静态**：离线用一批样本标定好，跟权重一起发，运行时整张量用同一个数。省一步计算，性能更好。
- **动态**：每个 token 现算一个。多一步，但更贴合这一次的实际数据，精度更高。

**静态方案的软肋和 [KV Cache 量化](kv-cache-quantization.md)那边是同一个**：系数离线定死，运行时碰上比样本更极端的数，只能被截断。官方给 Qwen3-MoE 的量化脚本要喂两份样本数据，做的就是用真实样本把系数定在一个不至于经常截断的位置。

## 常见误解

- **「不写量化选项，量化就不生效」**——三个版本都会自动探测：目录里有量化描述文件，就自己打开。官方指南那句话说的是显式写法，不是硬前提。
- **「支持 W8A8，那任何模型的任何层都能 W8A8」**——登记表的键是一对。静态 W8A8 只给普通线性层实现了，专家层得换成动态方案。
- **「量化是推理引擎干的」**——它只加载和执行，压缩由离线工具做完。
- **「W8A8 就是什么都省一半」**——省一半的只有被量化的权重；词表和标成不量化的层不动。激活量化省的是算力和一次搬运，激活本来就不常驻显存。

## 对照源码

### 怎么开

- 官方教程给这个模型的 A2/A3 单机示例：`vllm serve Eco-Tech/Qwen3.6-35B-A3B-w8a8`，`--tensor-parallel-size 2 --enable-expert-parallel --quantization ascend`，外加 `--max-model-len 262144`、`--enable-prefix-caching`、`--async-scheduling` 等调优项 [S37]；并写明 `--quantization ascend` 是为 W8A8 模型打开昇腾量化，部署 BF16 版时去掉 [S38]。支持矩阵里这个模型 A2/A3 的 W8A8 一格是 ✅ [S26]；支持特性页口径更保守：「W8A8 available; working on more quantization method support (W4A8, etc)」[S27]。
- 官方指南：ModelSlim 产出的权重要靠 `--quantization ascend` 打开；LLM-Compressor 产出的不用加 [S2]。前半句比代码严：`check_and_update_config` 一进门就调 `maybe_auto_detect_quantization`，它只做一次 JSON 层面的探测——目录里有 `quant_model_description.json` 就判 `"ascend"`，否则看 `config.json` 的 `quantization_config.quant_method` 是不是 `compressed-tensors` [C6]。命令行没写 `--quantization` 时，探测结果写回 `model_config.quantization`，并**重建一次 `vllm_config.quant_config`**——因为 `VllmConfig.__post_init__` 早跑过一遍，那时这个值还是 `None`；写了而且和探测结果不一致，只警告，以用户写的为准 [C7]。所以 `--quantization ascend` 在三个版本上是显式写法而不是必需品 `[!]`。
- `ascend` 能立住靠两处登记：平台类把它写进 `supported_quantization`，上游 `ModelConfig` 的校验才不会以「Unknown quantization method」拒掉；在线服务那条路还要 `pre_register_and_update` 把 `"ascend"` 塞进 `--quantization` 这个 argparse 参数的 `choices`。`get_config_filenames()` 故意返回空列表，把文件查找从上游手里接管过来。
- vLLM 侧挂钩点只有一处：`LinearBase.__init__` 里的 `quant_config.get_quant_method(self, prefix=prefix)`。昇腾的 `get_quant_method` 按层的 Python 类分发——`LinearBase` 走 `AscendLinearMethod`，`AttentionLayerBase` 且是 C8 层走 KV 那条，MoE 层走 `AscendFusedMoEMethod`，`VocabParallelEmbedding` 只有描述文件里真有条目才换。
- 类型从权重名查：拿 `prefix` 最后一段看是不是融合模块（`qkv_proj`、`gate_up_proj`），是就把几个分身的 `.weight` 逐个查 [C14]；值为 `"FLOAT"` 的层由 `is_layer_skipped_ascend` 挑出走不量化的方法。
- 注册表：`_SCHEME_REGISTRY[(quant_type, layer_type)]`，由 `@register_scheme` 填，重复注册直接报错。v0.23 上逐个文件数 `@register_scheme`，25 条注册、17 个量化类型名、5 种层类型 [D]：

| 层类型 | 注册过的量化类型 |
|---|---|
| `linear`（12） | `W8A8`、`W8A8_DYNAMIC`、`W8A16`、`W8A8_MIX`、`W8A8_MXFP8`、`W8A8FP8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A8_MXFP`、`W4A4_DYNAMIC`、`W4A4_MXFP4`、`W4A4_FLATQUANT_DYNAMIC`、`W4A4_MXFP4_FLATQUANT` |
| `moe`（9） | `W8A8_DYNAMIC`、`W8A8_MIX`、`W8A8_MXFP8`、`W8A8FP8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A8_MXFP`、`W4A16`、`W4A16_MXFP4`、`W4A4_MXFP4` |
| `attention`（2） | `FAKQuant`、`INT8_DYNAMIC`——KV 量化，见 [KV Cache Quantization](kv-cache-quantization.md) |
| `ds_linear` / `w4a8_moe`（各 1） | `FP8`，只给 DeepSeek 系那两个专用位置 |

  静态 `W8A8` 只注册了 `linear`，`W8A16` 也只有 `linear`，`W4A16` 反过来只有 `moe` [D]；`W8A8_DYNAMIC` 两种都有 [C40]。官方算法表只列 7 个——`W4A16`、`W8A16`、`W8A8`、`W8A8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A4_FLATQUANT_DYNAMIC`、`W8A8_MIX` [S3]，代码里能跑的比文档多一倍 `[!]`。
- 三段替换（`AscendLinearMethod` 转发给 scheme）：
  - `create_weights`：`weight` 建成 `int8` 的 `(out, in)`；每张量的 `input_scale` / `input_offset`；每通道的 `quant_bias`（int32）、`deq_scale`（bf16 模型下 fp32）、`weight_scale`、`weight_offset` [C19]。
  - `process_weights_after_loading`：per-tensor 的 `input_scale` 沿输入维 repeat 成向量并缓存倒数；权重转置成 `(in, out)`，过 `maybe_trans_nz` 转 NZ 格式 [C21]。
  - `apply`：输入不是 int8 就先 `torch.ops.vllm.quantize`，然后 `torch_npu.npu_quant_matmul(x, weight, deq_scale, bias=quant_bias, output_dtype=params_dtype)` [C20]。
- 静态与动态：静态 `apply` 用的 `layer.aclnn_input_scale` 来自 checkpoint 里标定好的 `input_scale`，整张量一个值；动态方案第一句是 `torch_npu.npu_dynamic_quant(x, dst_type=self.act_quant_type)`，每 token 一个，再当 `pertoken_scale` 传给同一个 `npu_quant_matmul` [C22]。官方 Qwen3-MoE 的 W8A8 脚本喂 `--anti_dataset` 和 `--calib_dataset` 两份数据 [S28]，用途是把 scale 定在不常截断的位置 [I]。

### 会报什么错

- 查不到 `(quant_type, layer_type)`：`create_scheme_for_layer` 末尾抛 `NotImplementedError`，原话 "Currently, vLLM Ascend doesn't support quant_type=%s for layer_type=%s"，**建层时炸，不是推理时** [C15]。定不出类型时先抛 `ValueError("Could not determine quantization type for layer ...")`。
- 融合层几段类型不一致：`ValueError`。
- `get_quant_method` 返回 `None`：上游 `LinearBase.__init__` 直接 `ValueError` [C24]。
- 给没量化的模型加 `--quantization ascend`：`maybe_update_config` 抛一段长报错，末尾列出目录里找到的 json 文件名。

### 开销和什么时候别开

- 上半那张表的推导 [D]：专家 `3 × 2048 × 512 × 256 × 40 × 2 B = 60 GiB`（`hidden_size: 2048`、`moe_intermediate_size: 512`、`num_experts: 256`、`num_hidden_layers: 40` [S39]）；词表 `vocab_size: 248320`、`tie_word_embeddings: false` [S39]，两张 `2 × 248320 × 2048 × 2 B ≈ 1.89 GiB`；整模约 `350 亿 × 2 B ≈ 65.2 GiB`（同[显存里都装了什么](kv-cache-memory-profiling.md)的粗估），其余部分取差值约 3.3 GiB。W8A8：专家 30 GiB + 词表 1.89 GiB + 其余 1.65～3.3 GiB ≈ 33.5～35.2 GiB，一颗约 16.8～17.6 GiB。
- 这份 W8A8 权重（`Eco-Tech/Qwen3.6-35B-A3B-w8a8`）的 `quant_model_description.json` 没有逐层核过：哪些层标 `FLOAT`、专家层用的具体类型名都未知，所以「其余部分」给范围 [A]；专家层按注册表只能是 `moe` 上注册过的类型（如 `W8A8_DYNAMIC`），不会是静态 `W8A8`。
- KV 预算：`57.60 − 3.50 − (16.8～17.6) ≈ 36.5～37.3 GiB`，对比原版的 21.50 GiB [D]；临时数据和杂项 3.50 GiB 沿用那一页的假设值 [A]。
- 缩放常量：静态方案每输出通道 `quant_bias` 4 B + `deq_scale` 4 B + `weight_scale` 2 B + `weight_offset` 2 B = 12 B；输入维 2048 的一行 int8 权重是 2048 B，额外开销约 0.6% [D]。
- 静态方案 scale 离线定死，比校准集更极端的激活会被截断；精度敏感时优先动态方案。

### 版本差异

三个版本的主路径（描述文件的发现与加载、`(量化类型, 层类型)` 查表、三段替换、W8A8 的算式）逐字一致；分叉在下面这几处。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 目录结构 | `quantization/` 平铺 | 同 v0.23 | 拆成 `configs/` 与 `methods/{w8a8,w4a8,w4a4,wna16,kv_cache}/` | 按路径 import scheme 的外部代码在 main 上全要改 `[!]` |
| `W4A8_DYNAMIC` 的 `linear` | 有 | 有 | 没了，只剩 `moe` [C29] | main 上 W4A8 只能用在 MoE 专家层，dense 线性层拿 W4A8 权重会在建层时抛错 `[!]` |
| 原生 FP8 权重 | `FP8` 只有 `ds_linear` / `w4a8_moe` 两个专用位置 | 同 v0.23 | 多了 `FP8` 的 `linear` 与 `moe`，块量化 checkpoint 直接起服务 | main 上 FP8 发布的模型不用再离线重量化；但只支持带 `weight_block_size` 的块量化 [S33] |
| `supported_quantization` | 4 项 | 4 项 | 多 `modelopt_mxfp8`、`mxfp8` [C32] | 这两个方法名只有 main 认 |
| `QuantType` 成员名 | `MXFP8` / `MXFP4` / `W8A8FP8` / `W4A16MXFP4` | 已改成 `W8A8MXFP` / `W4A4MXFP` / `W8A8FP` / `W4A16MXFP` | 同 v0.26 | 按枚举名取值的代码从 v0.26 起过不去 `[!]` |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 自动探测量化方法 | `vllm_ascend/quantization/utils.py`，`detect_quantization_method`、`maybe_auto_detect_quantization` |
| 平台登记 `ascend` | `vllm_ascend/platform.py`，`supported_quantization`、`pre_register_and_update`、`check_and_update_config` |
| 描述文件加载与分发 | `vllm_ascend/quantization/modelslim_config.py`，`AscendModelSlimConfig`、`get_quant_method`、`create_scheme_for_layer` |
| 注册表 | `vllm_ascend/quantization/methods/registry.py`，`register_scheme`、`_SCHEME_REGISTRY` |
| 线性层适配 | `vllm_ascend/quantization/method_adapters.py`，`AscendLinearMethod` |
| 静态 / 动态 W8A8 | `vllm_ascend/quantization/methods/w8a8_static.py`、`w8a8_dynamic.py` |
| 上游挂钩点 | 上游 `vllm/model_executor/layers/linear.py`，`LinearBase.__init__` |
| 这个模型的部署示例 | `docs/source/tutorials/models/Qwen3.6-35B-A3B.md` |
