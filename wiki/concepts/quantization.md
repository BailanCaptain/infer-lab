---
id: quantization
title: "Quantization：省的是权重显存，开关在模型目录里那份 json"
type: feature
summary: vllm-ascend 自己不量化，只负责加载和执行 ModelSlim / LLM-Compressor 产出的低精度权重；哪一层用哪种量化写在 quant_model_description.json 里，引擎按 (量化类型, 层类型) 这一对去注册表找实现。
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
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L33-L40
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
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 596M 参数、bf16 权重 1.11 GiB 这两个数在那一页按层算出来，这一页只把线性层那部分对半砍
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
updated: "2026-09-22"
origin: seed
---

## 一句话

量化就是把权重（有时连同激活）从 bf16 换成 int8 / int4 存起来再算，**省下的是权重显存，以及 decode 每一步重读权重的带宽**。vllm-ascend 自己不做量化，它只负责**加载和执行别人离线产出的量化权重**：模型目录里那份 `quant_model_description.json` 逐个权重名写明用的是哪种量化类型，引擎拿 `(量化类型, 层类型)` 这一对去注册表里找实现，找到就把这一层的矩阵乘换成低精度版本。三个版本上都有这套机制，主叙述按 v0.23 维护分支写。

```wiki-diagram
file: quantization
```

## 那条请求用不到它

[那条请求](one-request.md)跑的是原版 Qwen3-0.6B：目录里没有 `quant_model_description.json`，`config.json` 里也没有 `quantization_config`，自动探测两条都落空，模型按 float 加载。

要走到这里，得先用 ModelSlim 把它量化成 W8A8——官方支持矩阵里 Qwen3-Dense 的 W8A8 那一格是 ✅ [S26]——其余设定不变 [A]。换完之后账是这么算的。Qwen3-0.6B 一共 596M 参数，28 层线性层占 440.4M、tied 词表占 155.6M，推导在[显存里都装了什么](kv-cache-memory-profiling.md)；词表和被标成 `FLOAT` 的层 ModelSlim 一般不动 [A]：

| 项 | bf16 | W8A8 |
|---|---|---|
| 28 层线性层 | 440.4M × 2 B = 840.0 MiB | 440.4M × 1 B = 420.0 MiB |
| 词表（不量化） | 155.6M × 2 B = 296.8 MiB | 296.8 MiB |
| 合计 | **1136.8 MiB ≈ 1.11 GiB** | **716.8 MiB ≈ 0.70 GiB** |

省下 420 MiB，占权重总量的 37% [D]。要扣回去一点：W8A8 静态方案每个输出通道多背四个常量——`quant_bias`（int32）、`deq_scale`（fp32）、`weight_scale` 与 `weight_offset`（模型 dtype），合起来 12 字节 [C19]。这个模型每层 12288 个输出通道（`qkv` 4096 + `o` 1024 + `gate_up` 6144 + `down` 1024），28 层共 344064 个，也就是 3.9 MiB——相对 420 MiB 可以忽略。

**第二笔账比第一笔要紧。** decode 每走一步都要把全部权重读一遍，所以这 420 MiB 是**每生成一个 token 都少读一次**的量。对照着看：这条请求全程 237 个 token 的 KV Cache 才 25.9 MiB。小模型上权重才是 decode 带宽的大头，量化省的正是这一头 [D]。

## 开关在模型目录里，不在命令行上

官方指南写的是「ModelSlim 产出的权重，要靠 `--quantization ascend` 打开量化特性；LLM-Compressor 产出的不用加」[S2]。前半句比代码严：`check_and_update_config` 一进门就调 `maybe_auto_detect_quantization`，它只做一次 JSON 层面的探测——目录里有 `quant_model_description.json` 就判 `"ascend"`，否则看 `config.json` 的 `quantization_config.quant_method` 是不是 `compressed-tensors` [C6]。命令行没写 `--quantization` 时，探测到什么就写回 `model_config.quantization`，并且**重建一次 `vllm_config.quant_config`**——因为 `VllmConfig.__post_init__` 早跑过一遍，那时这个值还是 `None`；写了而且和探测结果不一致，只警告，以用户写的为准 [C7]。

所以在这三个版本上，`--quantization ascend` 是**显式写法而不是必需品** `[!]`。反过来，给一个没量化的模型加上它，会在 `maybe_update_config` 里撞上一段很长的友好报错，末尾还把目录里找到的 json 文件名列给你看。这条路径之所以绕，是因为 `get_config_filenames()` 故意返回空列表，把文件查找从上游手里接管了过来。

`ascend` 这个名字能立住靠两处登记：平台类把它写进 `supported_quantization`，上游 `ModelConfig` 的校验才不会以「Unknown quantization method」拒掉；在线服务那条路还要 `pre_register_and_update` 手动把 `"ascend"` 塞进 `--quantization` 这个 argparse 参数的 `choices`，否则命令行在解析阶段就被拒了。平台层这些挂钩点见 [NPUPlatform](npu-platform.md)。

## 「支持 W8A8」这句话要连层类型一起说

注册表的键是一对：`_SCHEME_REGISTRY[(quant_type, layer_type)]`，`@register_scheme` 装饰器负责往里填，重复注册直接报错。v0.23 上逐个文件数 `@register_scheme`，一共 25 条注册、17 个量化类型名、5 种层类型 [D]，缺的格子不是没写全，是真的没人实现：

| 层类型 | 注册过的量化类型 |
|---|---|
| `linear`（12） | `W8A8`、`W8A8_DYNAMIC`、`W8A16`、`W8A8_MIX`、`W8A8_MXFP8`、`W8A8FP8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A8_MXFP`、`W4A4_DYNAMIC`、`W4A4_MXFP4`、`W4A4_FLATQUANT_DYNAMIC`、`W4A4_MXFP4_FLATQUANT` |
| `moe`（9） | `W8A8_DYNAMIC`、`W8A8_MIX`、`W8A8_MXFP8`、`W8A8FP8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A8_MXFP`、`W4A16`、`W4A16_MXFP4`、`W4A4_MXFP4` |
| `attention`（2） | `FAKQuant`、`INT8_DYNAMIC`——这两条是 KV 量化，单独一页：[KV Cache Quantization](kv-cache-quantization.md) |
| `ds_linear` / `w4a8_moe`（各 1） | `FP8`，只给 DeepSeek 系那两个专用位置 |

**空着的格子是真会撞上的。** 静态 `W8A8` 只注册了 `linear`，`W8A16` 也只有 `linear`，`W4A16` 反过来只有 `moe` [D]。查不到就抛错写在 `create_scheme_for_layer` 末尾，原话是 "Currently, vLLM Ascend doesn't support quant_type=%s for layer_type=%s"，**在建层的时候炸，不是在推理的时候** [C15]。

**官方文档那张算法表只列了 7 个**——`W4A16`、`W8A16`、`W8A8`、`W8A8_DYNAMIC`、`W4A8_DYNAMIC`、`W4A4_FLATQUANT_DYNAMIC`、`W8A8_MIX` [S3]；支持矩阵页更保守，只写「W8A8 available; working on more quantization method support (W4A8, etc)」。**代码里能跑的比文档写的多一倍** `[!]`——要确认某个类型到底有没有，数 `@register_scheme` 比读文档准。这些文件在仓库里的位置见[仓库地图](vllm-ascend-repo-map.md)。

## 一个线性层被换掉的是哪三段

vLLM 侧的挂钩点只有一处：`LinearBase.__init__` 里的 `quant_config.get_quant_method(self, prefix=prefix)`，返回什么这层就用什么，返回 `None` 直接 `ValueError`。昇腾这边的 `get_quant_method` 按层的 Python 类分发——`LinearBase` 走 `AscendLinearMethod`，`AttentionLayerBase` 且是 C8 层走 KV 那条，MoE 层走 `AscendFusedMoEMethod`，`VocabParallelEmbedding` 只有描述文件里真有条目才换。

类型是从权重名查出来的：拿 `prefix` 最后一段看它是不是融合模块（`qkv_proj`、`gate_up_proj`），是就把几个分身的 `.weight` 逐个查一遍，**只要有一段的类型跟别段不同就 `ValueError`**——融合层没法一半 int8 一半 bf16 [C14]。值写成 `"FLOAT"` 的层被 `is_layer_skipped_ascend` 挑出去走不量化的方法，这就是「某几层回退成浮点」在代码里的落点。

挂上之后被换掉的是三段（图上那三条带）：

- **`create_weights`**：`weight` 直接建成 `int8` 的 `(out, in)`，再按方案注册每张量的 `input_scale` / `input_offset` 和每通道的那四个常量。
- **`process_weights_after_loading`**：把权重转置成 `(in, out)`，过 `maybe_trans_nz` 转成昇腾的 NZ 内存格式；per-tensor 的 `input_scale` 沿输入维 repeat 成向量，顺手缓存一份倒数。
- **`apply`**：输入不是 int8 就先 `torch.ops.vllm.quantize` 量化，然后 `torch_npu.npu_quant_matmul(x, weight, deq_scale, bias=quant_bias, ...)` 一次算完 [C20]。**反量化不是单独一步**——`deq_scale` 直接交给算子，出来就是模型 dtype。这个算子怎么下到 AI Core 见[算子与核函数](ops-and-kernels.md)。

## 静态和动态，差的就是那一个 scale 从哪来

上面那张算法表底下还补了一句官方口径：静态用预先算好的缩放因子、性能更好，动态每个 token、每个激活张量现算、精度更高。落到代码上是一行的差别：静态方案 `apply` 用的 `layer.aclnn_input_scale` 来自 checkpoint 里标定好的 `input_scale`，整张量一个值；动态方案第一句就是 `torch_npu.npu_dynamic_quant(x, dst_type=torch.int8)`，每个 token 现算一个，再当 `pertoken_scale` 传给同一个 `npu_quant_matmul` [C22]。

**静态方案的软肋和 KV 量化那边是同一个**：scale 离线定死，运行时碰上比校准集更极端的激活值只能被截断。官方 Qwen3-MoE 的 W8A8 脚本要喂两份数据、`--anti_dataset` 和 `--calib_dataset` 各一份 [S28]，做的就是这件事——用真实样本把 scale 定在一个不至于经常截断的位置 [I]。

## 三个版本的差别

三个版本的主路径（描述文件的发现与加载、`(量化类型, 层类型)` 查表、三段替换、W8A8 的算式）逐字一致；分叉在下面这几处。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 目录结构 | `quantization/` 平铺 | 同 v0.23 | 拆成 `configs/` 与 `methods/{w8a8,w4a8,w4a4,wna16,kv_cache}/` | 按路径 import scheme 的外部代码在 main 上全要改 `[!]` |
| `W4A8_DYNAMIC` 的 `linear` | 有 | 有 | 没了，只剩 `moe` [C29] | main 上 W4A8 只能用在 MoE 专家层，dense 线性层拿 W4A8 权重会在建层时抛错 `[!]` |
| 原生 FP8 权重 | `FP8` 只有 `ds_linear` / `w4a8_moe` 两个专用位置 | 同 v0.23 | 多了 `FP8` 的 `linear` 与 `moe`，块量化 checkpoint 直接起服务 [C30] | main 上 FP8 发布的模型不用再离线重量化；但只支持带 `weight_block_size` 的块量化 [S33] |
| `supported_quantization` | 4 项 | 4 项 | 多 `modelopt_mxfp8`、`mxfp8` [C32] | 这两个方法名只有 main 认 |
| `QuantType` 成员名 | `MXFP8` / `MXFP4` / `W8A8FP8` / `W4A16MXFP4` | 已改成 `W8A8MXFP` / `W4A4MXFP` / `W8A8FP` / `W4A16MXFP` [C34] | 同 v0.26 | 按枚举名取值的代码从 v0.26 起过不去 `[!]` |

## 常见误解

- **「不加 `--quantization ascend`，量化就不生效」**——三个版本都会自动探测：目录里有 `quant_model_description.json` 就自己置上 `ascend` 并重建 `quant_config`。官方指南那句话说的是显式写法，不是硬前提 `[!]`。
- **「vllm-ascend 支持 W8A8，那任何模型的任何层都能 W8A8」**——注册表的键是一对。静态 `W8A8` 只注册了 `linear`，MoE 层得换成 `W8A8_DYNAMIC` 这类动态方案 [D]。
- **「量化是 vllm-ascend 干的」**——它只加载和执行。量化本身由 ModelSlim 或 LLM-Compressor 离线做完；前者的产物靠 `quant_model_description.json` 认，后者写在 `config.json` 的 `quantization_config` 里，连 `--quantization` 都不用加。
- **「W8A8 就是所有东西都省一半」**——省的只有权重那一半，而且词表和标成 `FLOAT` 的层不动；激活量化省的是算力和一次搬运，激活本来就不常驻显存。
