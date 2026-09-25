---
id: npugraph-ex
title: "编译期图融合：捕获之前，先把小算子并成大算子"
type: feature
summary: 图模式录之前还有一道工序：先在图上做「查找替换」，把背靠背的几个小算子并成一个，录下来的图更短、下发更少。npugraph_ex 是接这活的外部图路径；关掉它，同一批融合规则换昇腾自己的匹配器来跑。static kernel 与 super kernel 是它上面的两级加码。
aliases: [编译期图融合, 图融合 pass, GraphFusionPassManager, ascend_compilation_config, enable_npugraph_ex, enable_static_kernel, enable_super_kernel, static kernel, super kernel, fuse_qknorm_rope, fuse_norm_quant, fuse_muls_add]
chapters: ["16"]
order: 50
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/compiler_interface.py#L282-L301
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/compiler_interface.py#L149-L223
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/compiler_interface.py#L110-L146
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/compiler_interface.py#L88-L108
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/compiler_interface.py#L71-L79
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L79
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/base_pattern.py#L41-L63
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/base_pattern.py#L9-L12
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L52-L102
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L226
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L296-L321
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L684-L731
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L658-L676
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/muls_add_pass.py#L54-L94
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L659
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L589-L643
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L158-L173
  - vllm@0fc695fc:vllm/compilation/backends.py#L946-L966
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L150-L159
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L82-L88
  - vllm-ascend@2c59ff10:vllm_ascend/ops/rotary_embedding.py#L248-L250
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/npugraph_ex.md#L5-L11
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/npugraph_ex.md#L17-L26
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L26-L45
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L178-L184
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L133-L142
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/npugraph_ex.html
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/compiler_interface.py#L122-L135
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L37-L47
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L240-L245
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L74
  - vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L122-L127
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L104-L160
  - vllm-ascend@baa023ad:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L228-L250
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L287-L308
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L61-L90
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: graph-mode-layer
    kind: builds-on
    note: 这一层挂在 get_compile_backend 与 pass_key 两个平台接入点上，AscendCompiler 这个类本身在那一页
  - to: acl-graph
    kind: builds-on
    note: npugraph_ex 开不开由 cudagraph_mode 决定，而模式怎么选、尺寸怎么垫在那一页
  - to: ops-and-kernels
    kind: builds-on
    note: 融合的落点是 torch.ops.npu / torch.ops.vllm 上的那些算子，注册机制在那一页
  - to: quantization
    kind: builds-on
    note: fuse_norm_quant 只在量化模型上有东西可匹配，哪一层是 W8A8、哪一层是 W4A4 由那一页的 quant_description 决定
  - to: sequence-parallel
    kind: builds-on
    note: v0.23 与 v0.26 上 SP 的两个 pass 和这几条融合 pass 挂在同一个 manager 里，按列表顺序改同一张图
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 默认写着开的优化，我们的请求没用上

翻昇腾的配置文档会看到一个编译期优化开关，默认值写着开。[那条请求](one-request.md)什么都没配，是不是已经在享受它了？

没有。那条请求用的是默认的混合图模式——一部分整图捕获、一部分分段编译——而只要这个模式要走分段编译，平台就把这层优化反手关掉，官方文档的模式表里默认模式那一行也标着「不启用」。想真用上，得显式换成整图捕获的模式，或者只给整齐 decode 录整图的模式；怎么换，写在下半。

这层优化干的事，比[图模式](graph-mode-layer.md)的捕获还早一步：框架把模型前向整理成一张几百个算子连成的图之后、[ACL Graph](acl-graph.md) 开录之前，先在这张图上做「查找替换」——认出背靠背的几个小算子，把它们并成一个融合算子。npugraph_ex 就是接这活的外部后端，代码在 torchair 仓库，不在 vllm-ascend；但 vllm-ascend 自己也写了几条融合规则，两边的关系比「二选一」微妙，下面单独讲。

## 融合和捕获省的是同一种开销，省法不同

一次融合命中，是把「归一化、再归一化、再旋转位置编码」这样背靠背的三个算子换成一个：图里少了两个算子，每步前向就少两次下发，中间结果也少写出、读回两趟。捕获省的则是剩下每个算子「下发一次」的成本本身。所以两层叠加而不是替代：**融合减的是图里算子的个数，捕获减的是每个算子一次的下发**。先融合再捕获，录出来的图也更短。

## 四条融合规则，在这台模型上一条条数

vllm-ascend 自带四条融合规则，每条认一种固定搭配，能不能配上全看模型长什么样。拿我们的部署（Qwen3.6-35B-A3B、两颗 NPU、bf16 权重、没量化）挨条数：

| 融合规则 | 在这份部署上 | 为什么 |
|---|---|---|
| 归一化接量化，并成一个 | 0 次 | 这条规则的每种写法里都必须有一个量化算子；这份部署没量化，图里一个也没有 |
| 切分 QKV、按头归一化、旋转位置编码，并成一个 | 0 次 | 这条规则只认每头 128 维的模型；Qwen3.6-35B-A3B 每头 256 维，门槛就过不去 |
| 矩阵乘、跨卡求和、加残差、归一化，并成一个 | 0 次 | 两颗 NPU 的图里确实有跨卡求和，但这条默认关着，而且只有 v0.23 有 |
| 乘一个系数再相加，并成一个 | 0 次 | 系数取自模型配置里的一个字段，这个模型没有那个字段，系数退成 1.0，图里没有「乘 1.0 再加」的算式 |

四条全落空：这台模型上就算把开关全打开，一次融合也不会发生。这说明融合不是普适优化，它给谁省取决于模型形状和量化方式——每头 128 维的模型（比如 Qwen3-0.6B）每层注意力能中一次第二条，量化过的部署能吃到第一条。中一次省多少也能算：三个算子并成一个，净少两次下发，模型有几层注意力就乘几。

## 关掉 npugraph_ex，融合并没有被关掉

```wiki-diagram
file: npugraph-ex
```

开关的名字让人以为它在选「用不用这批融合」。其实每条融合规则在造出来的那一刻就同时交给了两个执行者：一份给 torch 自带的图匹配器，一份直接塞给 npugraph_ex。开关管的只是编译走哪条路：开着，整张图交给 npugraph_ex 这个外部后端；关着，昇腾自己逐条跑匹配。**换的是执行者，不是融合本身**——想关掉某条融合，得动那条融合自己的开关。

npugraph_ex 这条路还多做两件昇腾匹配器不做的事，图的都是少搬一次内存：把中间结果的算子换成原地写的版本；把框架为了分析方便拆成「先算再拷贝」的操作还原回原地。它另有一份自带的默认融合清单，不依赖 vllm-ascend 注册进来的这批。装不上也不崩：退回旧的 torchair 路线继续跑。

## 再往上还有两级：static kernel 和 super kernel

- **static kernel**：启动时按每一档批大小，把算子提前编成定形的二进制，运行时不再临场适配。只给整齐 decode 的那些档编，prefill 的形状一档也没有；代价是启动多花几分钟到几十分钟，跑起来之后不影响请求。
- **super kernel**：把捕获下来的一整串算子再合成一个，回放时一次下发顶过去一串。

这三级只能从下往上开：super kernel 要求 static kernel，static kernel 要求 npugraph_ex，少了下面一级，上面的开不起来。

## 常见误解

- **「默认值写着开，所以默认就开着。」**——字段默认值确实是开，但默认的混合图模式要走分段编译，平台在那条分支里把它反手关掉；官方文档的模式表也是这么标的。想真开着，得显式换成整图捕获或纯 decode 整图的模式。
- **「开了 npugraph_ex，昇腾自己写的融合就不跑了。」**——编译确实不再走昇腾自己的匹配器，但同一批融合规则在注册时就已经交给了 npugraph_ex。要关某条融合得动它自己的开关；动 npugraph_ex 只是换了个执行者。
- **「static kernel 是个纯性能旋钮，开了就快。」**——它要在启动阶段按尺寸编译定形算子，官方写的是多花几分钟到几十分钟；而且只给整齐 decode 的那几档编，prefill 完全吃不到。

## 对照源码

### 怎么开

例子模型上的完整命令，就是[那条请求](one-request.md)的启动命令加两行：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching \
    --compilation-config '{"cudagraph_mode": "FULL_DECODE_ONLY"}' \
    --additional-config '{"ascend_compilation_config": {"enable_npugraph_ex": true, "enable_static_kernel": true}}'
```

每个值的来由：

- 默认的 `cudagraph_mode` 是 `FULL_AND_PIECEWISE`，它的 `requires_piecewise_compilation()` 为真——平台层在这条分支里把 `enable_npugraph_ex` 和 `enable_static_kernel` 一起写回 `False` [C16]，官方文档模式表里这一行也标 Disabled（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html)）。`FULL` 和 `FULL_DECODE_ONLY` 是仅有的两个不写回的模式。
- `enable_npugraph_ex` 字段默认 `True`，三个在册版本都有 [C15]，官方文档把这一层记在 v0.15.0rc1 起 [S24]；写出来只为确认这台机器上没被关掉。
- `enable_static_kernel` 默认假，要自己开；v0.26 起开了它，`enable_super_kernel` 会自动跟着变真 [S34]。依赖链由两处 assert 钉死：`enable_static_kernel` 为真必须 `enable_npugraph_ex` 为真，`enable_super_kernel` 为真必须 `enable_static_kernel` 为真 [C29]。
- 三个键都必须嵌在 `ascend_compilation_config` 里，写在 `additional_config` 顶层会被静默忽略。

四条融合 pass 与开关的对应（`configure()` 按开关逐条 append，顺序就是改图顺序）：

| 开关（默认值） | 匹配的模式 | 换成哪个算子 |
|---|---|---|
| `fuse_norm_quant`（`True`） | `npu_add_rms_norm` 接一个量化算子 | 动态量化那几路换成 `npu_add_rms_norm_dynamic_quant`，静态 W8A8 那几路换成 `npu_add_rms_norm_quant` [C39] |
| `fuse_qknorm_rope`（`True`） | qkv 切分 → 按头 RMSNorm → RoPE | `torch.ops.vllm.qkv_rmsnorm_rope`，Triton 实现，所以环境里没装 Triton 要手动关掉它 [C9] |
| `fuse_allreduce_rms`（`False`，仅 v0.23） | matmul → AllReduce → 加残差 → RMSNorm | `matmul_allreduce_add_rmsnorm`，与 SP 抢同一段子图；单独有页：[fuse_allreduce_rms](../params/fuse-allreduce-rms.md) |
| `fuse_muls_add`（`True`） | `x * scale + y` | `torch.ops.vllm.muls_add` |

`fuse_norm_quant` 一条开关背后注册的不是一个 pattern 而是一批：普通 / 带 bias / 序列并行变体 / 动态量化 / A5 的 MX 量化，各自再乘 `eps ∈ {1e-5, 1e-6}` 两遍，其中 W8A8 静态那四个还要 `enable_custom_op()` 为真 [C12]。两道能把它整条关掉的门：dtype 不是 bf16 / fp16 就直接返回；模型里任何一层是 `W4A4_DYNAMIC` 或 `W4A4_FLATQUANT_DYNAMIC`，整个 pass 也不注册 [C13]。哪一层用哪种量化写在模型目录的 json 里，见[量化](quantization.md)。`fuse_norm_quant` 和 `fuse_muls_add` 在 310P 上另被单独跳过；v0.23 与 v0.26 上 `pass_config.enable_sp` 为真还会往同一个 manager 追加两条 SP pass，排在这几条融合之后，main 上撤了，见[序列并行](sequence-parallel.md)。

上半「四条全落空」的出处：

- `fuse_qknorm_rope` 有三道门：dtype 必须 bf16、取第一个 Attention 层查 `head_size != 128` 就跳过、`eps ∈ {1e-6, 1e-5}` [C10]。这个模型 `head_dim: 256` [S40]，第二道门不过，两档 eps 一个 pattern 都不注册。pattern 本身是照 Qwen3 系注意力前向逐行写的（`qkv.split` → 按头 view → 两次 `npu_rms_norm` → `npu_rotary_embedding`）[C19]，所以 head_dim 128 的 Qwen3-0.6B 每层能中一次。
- `fuse_muls_add` 的系数取 `getattr(hf_text_config, "routed_scaling_factor", 1.0)` [C14]，这个模型的 config 里没有该字段 [S40]，pattern 退成 `x * 1.0 + y`。
- `fuse_norm_quant` 的每个 pattern 里都必有一个量化算子 [C11]，bf16 未量化的部署图上一个都没有。
- TP=2 的图里每层都有 all-reduce，但 `fuse_allreduce_rms` 默认 `False`，且只有 v0.23 存在。

双注册与两条路：`AscendCompiler.compile()` 按 `enable_npugraph_ex` 分成 `npugraph_ex_compile()` 与 `fusion_pass_compile()`，只有后者取 `GraphFusionPassManager` 来跑 [C1]；但 `BasePattern.register()` 把同一个 `pattern_fn` / `replace_fn` 注册两遍，一遍进 torch 的 `PatternMatcherPass`，一遍调 `nge.register_replacement()` 直接进 npugraph_ex [C7]。manager 由平台的 `get_pass_manager_cls()` 交给上游，`configure()` 在 `configure_post_pass()` 里无条件调用，跟编译走哪条路无关。npugraph_ex 自带的默认融合清单在 torchair 仓库 [S23]。最终中不中由 inductor 的匹配器逐节点对，中间多一个节点就可能落空。

### 会报什么错

- 在 v0.23 上照新文档传 `enable_super_kernel`：那个分支没有这个键（全仓 grep 不到 `super_kernel`），被 `**kwargs` 静默吞掉，不报错也不生效。
- 升级后继续传 `fuse_allreduce_rms`：v0.26 被 `**kwargs` 静默吞掉，main 上 `extra="forbid"` 直接报校验错 [C35]。
- v0.23 / v0.26 的 `configure()` 读的是原始 `additional_config` dict，字符串 `"false"` 是真值——把开关写成字符串等于没关，且不报任何错；main 改读校验过的 `get_ascend_config()` 才没有这个坑 [C36]。
- 310P（Atlas 300I DUO）与 Atlas 200I Pro 不支持 [S22]：v0.23 / v0.26 用 `is_310p()` 判断，打两到三条 warning 后把这几个键全部置假；main 改查 `HardwareCapability.NPUGRAPH_EX`，A2 / A3 / A5 的能力集里都有它，310P 那张表里没有 [C38]。
- 机器上装不上 npugraph_ex：`import npugraph_ex` 抛 `ImportError` 就 `import torchair as nge` 顶上 [C8]，编译改走 `mode="reduce-overhead"` 那套旧配置，不会挂 [C2]。

### 开销和什么时候别开

- static kernel 的启动税官方写得很直白：多花几分钟到几十分钟，跑起来之后不影响请求 [S25]。频繁重启的调试场景别开它，这笔税每次启动都交。
- 编哪几档由 `_compute_decode_cudagraph_batch_sizes()` 决定：从 `cudagraph_capture_sizes` 里挑出 `uniform_decode_query_len ≤ x ≤ max_num_seqs × uniform_decode_query_len` 的那些 [C5]——**只给整齐 decode 的档编，prefill 的形状一档都没有**。这份部署没开投机解码，`uniform_decode_query_len = 1`，`max_num_seqs` 实际默认 256，[默认那 35 档](acl-graph.md)全落在 1–256 里，35 档每档编一份 [D]。
- static kernel 还需要 `LOCAL_WORLD_SIZE`（npugraph_ex 拿它建每节点的 Gloo 组，协调编译和 `.run` 包安装）；vLLM 不像 torchrun 那样设这个变量，vllm-ascend 从并行配置里自己算一个填进去 [C4]。
- super kernel 落在两处，都不在 FX 那一层 [D]：给 npugraph_ex 传 `super_kernel_optimize=True` 和 `{"dcci_after_kernel_end": [".*"]}` [C30]；以及捕获时用 `torch.npu.super_kernel_scope_begin/end("full_model")` 把整网框进一个 scope，录完再对图调一次 `aclgraph.super_kernel_optimize()`。它合的是捕获下来的那串 kernel。
- bf16 未量化且 head_dim ≠ 128 的模型（本页例子就是），四条融合全落空，开 npugraph_ex 只剩它自带清单和原地化改写的收益，收益要自己实测。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `enable_super_kernel` | 没有这个键 | 有，不写就跟随 `enable_static_kernel` | 有，字段默认 `False`，但只写 `enable_static_kernel` 时仍跟随它 | [!] 在 v0.23 上照新文档写这个键，会被 `**kwargs` 静默吞掉 |
| `fuse_allreduce_rms` | 有，pass 文件也在 | 键和 pass 文件都已删 | 同 v0.26 | [!] 升级后继续传这个键：v0.26 被 `**kwargs` 吞掉，main 上 `extra="forbid"` 直接报错 |
| manager 里注册几条 | 4 条融合 + 2 条 SP | 3 条融合 + 2 条 SP [C33] | 3 条融合，SP 交回上游 | main 上 `enable_sp` 不再往这个 manager 加 pass |
| `configure()` 读哪份配置 | 原始 `additional_config` dict | 同左 | 读校验过的 `get_ascend_config()` | [!] v0.23 / v0.26 上字符串 `"false"` 是真值，把开关写成字符串等于没关 |
| 关掉这几个键的硬件门禁 | `is_310p()` | 同左 | `HardwareCapability.NPUGRAPH_EX` | 按旧名字在 main 上 grep 不到 |

### 源码位置

以 v0.23 检出为准（v0.26 / main 的差异见上表）：

- `vllm_ascend/compilation/compiler_interface.py`：`AscendCompiler.compile()` 的二选一；`npugraph_ex_compile()` 与 ImportError 回落；static kernel 的后端参数 与 `LOCAL_WORLD_SIZE` 的填法；挑档函数 `_compute_decode_cudagraph_batch_sizes()`。
- `vllm_ascend/compilation/graph_fusion_pass_manager.py`：`configure()` 按 `fuse_*` 开关逐条 append。
- `vllm_ascend/compilation/passes/base_pattern.py`：`register()` 的双注册，`nge` 的导入与 torchair 回落。
- 四条 pass 文件：`passes/qknorm_rope_fusion_pass.py`（pattern、三道门）、`passes/norm_quant_fusion_pass.py`（替换算子、pattern 清单、W4A4 门、量化算子匹配）、`passes/muls_add_pass.py`。
- `vllm_ascend/ascend_config.py`：`ascend_compilation_config` 的字段与默认值；v0.26 的字段与 assert 链；main 的字段与 `extra="forbid"`。
- `vllm_ascend/platform.py`：按 `cudagraph_mode` 写回 `False` 的三处分支。
- main 的硬件画像：`vllm_ascend/device/hardware_profile.py` 的能力表。
- 上游接线（`get_compile_backend`、`pass_key`）与 `AscendCompiler` 这个类本身，在[图模式那层](graph-mode-layer.md)；官方设计文档见 [npugraph_ex 设计页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/npugraph_ex.html) [S22][S23]。
