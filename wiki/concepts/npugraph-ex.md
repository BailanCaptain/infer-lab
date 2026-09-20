---
id: npugraph-ex
title: "编译期图融合：ACL Graph 捕获之前，FX 图上先少掉一批算子"
type: feature
summary: 图模式之上还有一层——把 Dynamo 交来的 FX 图先做 pattern 替换，把 RMSNorm、RoPE、量化这些背靠背的小算子并成一个；npugraph_ex 是接这活的外部后端，static kernel 与 super kernel 是它上面的两级加码。
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
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L104-L160
  - vllm-ascend@b255ab59:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - vllm-ascend@b255ab59:vllm_ascend/device/hardware_profile.py#L137-L158
  - vllm-ascend@b255ab59:vllm_ascend/device/hardware_profile.py#L195-L216
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L61-L90
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
updated: "2026-09-21"
origin: seed
---

## 一句话

图模式之上还有一层编译期优化：Dynamo 交出来的 FX 图先被 pattern 替换一遍，把背靠背的小算子并成一个融合算子，然后才轮到 [ACL Graph](acl-graph.md) 去录。`npugraph_ex` 是接这活的外部后端，代码在 torchair 仓库，不在 vllm-ascend（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/npugraph_ex.html)）。**但它和 vllm-ascend 自己写的那几条融合 pass 不是二选一的关系**——`AscendCompiler.compile()` 看着是二选一，同一批 pattern 却在注册时就进了两边。

三个在册版本上 `vllm_ascend/compilation/` 和 `enable_npugraph_ex` 都在，字段默认都是 `True` [C15]；官方文档把这一层记在 v0.15.0rc1 起 [S24]。分叉在配套的两个键上：`enable_super_kernel` 在 v0.23 维护分支上压根不存在（那个分支上全仓 grep 不到 `super_kernel`），v0.26 分支才加；`fuse_allreduce_rms` 反过来只有 v0.23 有，v0.26 起连 pass 文件一起删了。

```wiki-diagram
file: npugraph-ex
```

## 那条请求走到这里，但拐进了另一条岔路

[那条请求](one-request.md)什么都没配，`cudagraph_mode` 是 `FULL_AND_PIECEWISE`，它的 `requires_piecewise_compilation()` 为真——平台层在这条分支里把 `enable_npugraph_ex` 和 `enable_static_kernel` 一起写回 `False` [C16]。**所以那条请求根本没走 npugraph_ex**，官方文档的模式表里 `FULL_AND_PIECEWISE` 那一行也标着 Disabled（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html)）。想走到，加一句 `--compilation-config '{"cudagraph_mode": "FULL_DECODE_ONLY"}'` 就够。

它走的是另一条岔路：`fusion_pass_compile()`，也就是 `GraphFusionPassManager` 里那几条 pattern 匹配 pass [C1]。四条能不能匹配上，一条条算：

| 这条 pass | 在那条请求上 | 为什么 |
|---|---|---|
| `fuse_qknorm_rope` | **28 层各中一次** | Qwen3 的 attention 前向逐行就是这条 pattern：`qkv.split` → 按头 view → 两次 `npu_rms_norm` → `npu_rotary_embedding` [C19]；三道门 bf16、`head_size == 128`、eps ∈ {1e-6, 1e-5} 全过 [C10] |
| `fuse_norm_quant` | 0 次 | 每个 pattern 里都必有一个量化算子，bf16 未量化的 Qwen3-0.6B 图上一个都没有 [C11] |
| `fuse_allreduce_rms` | 0 次 | TP=1，图里没有 all-reduce；这一项单独有页，见 [fuse_allreduce_rms](../params/fuse-allreduce-rms.md) |
| `fuse_muls_add` | 0 次 | 缩放系数取 `routed_scaling_factor`，dense 模型没这个字段，pattern 退成 `x * 1.0 + y` [C14] |

省下的下发次数能算：一次命中把 2 个 `npu_rms_norm` 加 1 个 `npu_rotary_embedding` 换成 1 个 `qkv_rmsnorm_rope`，净减 2 次下发；28 层就是每步少 56 次，200 步合计 11200 次 [D]。这和[图捕获](acl-graph.md)省的是同一种开销，两者叠加而不是替代——**融合减的是图里算子的个数，捕获减的是每个算子一次的 host 下发**。

最终中不中由 inductor 的匹配器逐节点对，中间多一个节点就可能落空；上表「28 层各中一次」是拿模型前向和 pattern 两边源码逐行对出来的 [D]。

## 开了 npugraph_ex，昇腾自己那几条 pass 并没有被绕过

`AscendCompiler.compile()` 的分叉看着很干脆：`enable_npugraph_ex` 为真走 `npugraph_ex_compile()`，为假才走 `fusion_pass_compile()`，而只有后者会去取 `GraphFusionPassManager` 来跑。照这个读法，开了 npugraph_ex 就等于把昇腾自己的融合全关了——不对。

关键在 `BasePattern.register()`：它把同一个 `pattern_fn` / `replace_fn` 注册两遍，一遍进 torch 的 `PatternMatcherPass`，一遍调 `nge.register_replacement()` 直接进 npugraph_ex [C7]。而这个 manager 由平台的 `get_pass_manager_cls()` 交给上游，`configure()` 在 `configure_post_pass()` 里无条件调用，跟编译走哪条路无关。所以两个开关管的是两件事：

- `fuse_*` 决定 **pattern 造不造**，两条路一起管；
- `enable_npugraph_ex` 决定 **谁来跑这批 pattern**，自己的匹配器还是 npugraph_ex 的。

npugraph_ex 那边还多做两件 vllm-ascend 没做的事：把中间节点的非原地算子换成原地算子，以及把 Dynamo functionalize 拆出来的「非原地 + copy」还原回原地，图的都是少搬一次内存；它另有一份自带的默认融合清单，清单在 torchair 仓库里 [S23]。装不上也不会挂：`import npugraph_ex` 抛 `ImportError` 就回落 `torchair`，改走 `mode="reduce-overhead"` 那套旧配置。

## 四条 pass 分别在图上找什么

`configure()` 按开关逐条 append，顺序就是改图的顺序：

| 开关（默认值） | 匹配的模式 | 换成哪个算子 |
|---|---|---|
| `fuse_norm_quant`（`True`） | `npu_add_rms_norm` 接一个量化算子 | 动态量化那几路换成 `npu_add_rms_norm_dynamic_quant`，静态 W8A8 那几路换成 `npu_add_rms_norm_quant` [C39] |
| `fuse_qknorm_rope`（`True`） | qkv 切分 → 按头 RMSNorm → RoPE | `torch.ops.vllm.qkv_rmsnorm_rope`，Triton 实现，所以环境里没装 Triton 要手动关掉它 [C9] |
| `fuse_allreduce_rms`（`False`，仅 v0.23） | matmul → AllReduce → 加残差 → RMSNorm | `matmul_allreduce_add_rmsnorm`，与 SP 抢同一段子图 |
| `fuse_muls_add`（`True`） | `x * scale + y` | `torch.ops.vllm.muls_add` |

`fuse_norm_quant` 一条开关背后注册的不是一个 pattern 而是一批：普通 / 带 bias / 序列并行变体 / 动态量化 / A5 的 MX 量化，各自再乘 `eps ∈ {1e-5, 1e-6}` 两遍，其中 W8A8 静态那四个还要 `enable_custom_op()` 为真 [C12]。两道能把它整条关掉的门：dtype 不是 bf16 / fp16 就直接返回；模型里任何一层是 `W4A4_DYNAMIC` 或 `W4A4_FLATQUANT_DYNAMIC`，整个 pass 也不注册 [C13]。哪一层用哪种量化写在模型目录的 json 里，见[量化](quantization.md)。

TP / SP 这一侧：v0.23 与 v0.26 上 `pass_config.enable_sp` 为真，还会往同一个 manager 追加两条 SP pass，排在这几条融合之后；main 上这两条撤了，序列并行交回上游，见[序列并行](sequence-parallel.md)。`fuse_norm_quant` 和 `fuse_muls_add` 在 310P 上另被单独跳过。

## static_kernel 与 super_kernel：只能从下往上开

依赖链是单向的，两处 assert 把它钉死——`enable_static_kernel` 为真必须 `enable_npugraph_ex` 为真，`enable_super_kernel` 为真必须 `enable_static_kernel` 为真 [C29]。所以是 super → static → npugraph_ex 三级，少一级下面的，上面的开不起来。

**static kernel** 是在捕获阶段按当前 batch_size 把算子编成定形的二进制，做法是给后端传 `static_kernel_compile=True`。编哪几档由 `_compute_decode_cudagraph_batch_sizes()` 决定：从 `cudagraph_capture_sizes` 里挑出 `uniform_decode_query_len ≤ x ≤ max_num_seqs × uniform_decode_query_len` 的那些 [C5]——**只给整齐 decode 的档编，prefill 的形状一档都没有**。它还需要 `LOCAL_WORLD_SIZE`（npugraph_ex 拿它建每节点的 Gloo 组，来协调编译和 `.run` 包安装），vLLM 不像 torchrun 那样设这个变量，于是 vllm-ascend 从并行配置里自己算一个填进去。代价官方写得很直白：启动多花几分钟到几十分钟，跑起来之后不影响请求 [S25]。

**super kernel** 落在两处，都不在 FX 那一层 [D]：给 npugraph_ex 传 `super_kernel_optimize=True` 和 `{"dcci_after_kernel_end": [".*"]}` [C30]；以及捕获时用 `torch.npu.super_kernel_scope_begin/end("full_model")` 把整网框进一个 scope，录完再对图调一次 `aclgraph.super_kernel_optimize()`。它合的是捕获下来的那串 kernel。

一份可复制的配置，每个值都有来由：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --compilation-config '{"cudagraph_mode": "FULL_DECODE_ONLY"}' \
  --additional-config '{"ascend_compilation_config": {"enable_npugraph_ex": true, "enable_static_kernel": true}}'
```

`FULL_DECODE_ONLY` 是不会把 npugraph_ex 写回 `False` 的两个模式之一；`enable_npugraph_ex` 本来就默认真，写出来只为确认这台机器上没被关掉；`enable_static_kernel` 默认假，要自己开，而 v0.26 起开了它，`enable_super_kernel` 会自动跟着变真 [S34]。三个键都必须嵌在 `ascend_compilation_config` 里，写在 `additional_config` 顶层会被静默忽略。

自动关掉的场合有两类。一类是模式：`cudagraph_mode` 为 `NONE`、需要 piecewise 编译、或落到那条兜底分支，三处都把这几个键写回 `False`。另一类是硬件：310P（Atlas 300I DUO）与 Atlas 200I Pro 不支持 [S22]，v0.23 / v0.26 用 `is_310p()` 直接判，打两到三条 warning 再全部置假；main 改成查硬件画像的 `HardwareCapability.NPUGRAPH_EX`，A2 / A3 / A5 的能力集里都有它，310P 那张表里没有 [C38]。

## 三个版本的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `enable_super_kernel` | 没有这个键 | 有，不写就跟随 `enable_static_kernel` | 有，字段默认 `False`，但只写 `enable_static_kernel` 时仍跟随它 [C35] | [!] 在 v0.23 上照新文档写这个键，会被 `**kwargs` 静默吞掉 |
| `fuse_allreduce_rms` | 有，pass 文件也在 | 键和 pass 文件都已删 | 同 v0.26 | [!] 升级后继续传这个键：v0.26 被 `**kwargs` 吞掉，main 上 `extra="forbid"` 直接报错 |
| manager 里注册几条 | 4 条融合 + 2 条 SP | 3 条融合 + 2 条 SP [C33] | 3 条融合，SP 交回上游 | main 上 `enable_sp` 不再往这个 manager 加 pass |
| `configure()` 读哪份配置 | 原始 `additional_config` dict | 同左 | 读校验过的 `get_ascend_config()` [C36] | [!] v0.23 / v0.26 上字符串 `"false"` 是真值，把开关写成字符串等于没关 |
| 关掉这几个键的硬件门禁 | `is_310p()` | 同左 | `HardwareCapability.NPUGRAPH_EX` | 按旧名字在 main 上 grep 不到 |

## 常见误解

- **「`enable_npugraph_ex` 默认 `True`，所以默认就开着。」**——字段默认值确实是 `True`，但默认的 `cudagraph_mode` 是 `FULL_AND_PIECEWISE`，平台层在那条分支里把它写回 `False`；官方文档的模式表也是这么标的。想真开着，得显式换成 `FULL` 或 `FULL_DECODE_ONLY`。
- **「开了 npugraph_ex，昇腾自己写的融合 pass 就不跑了。」**——`compile()` 确实不再调 `GraphFusionPassManager`，但同一批 pattern 在 `register()` 里已经进了 npugraph_ex。要关掉某条融合得动 `fuse_*`；动 `enable_npugraph_ex` 只是换了个执行者。
- **「`enable_static_kernel` 是个纯性能旋钮，开了就快。」**——它要在启动捕获阶段按尺寸编译定形算子，官方写的是多花几分钟到几十分钟；而且只给整齐 decode 的那几档编，prefill 完全吃不到。
