---
id: lora
title: "LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵"
type: feature
summary: 基座权重只装一份，一个适配器只是两个秩 r 的小矩阵；不同请求挂不同适配器，靠每 token 一个槽号拼在同一个 batch 里一次算完。
aliases: [LoRA, LoRA 适配器, 低秩适配, Low-Rank Adaptation, Multi-LoRA, 多 LoRA, 多租户适配器, PunicaWrapperNPU, punica, bgmv, sgmv, LoRARequest, enable-lora, lora-modules]
chapters: ["17"]
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lora.md#L9-L24
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lora.md#L26-L30
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lora.md#L30-L37
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L13-L13
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L40-L40
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/lora.html
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L870-L872
  - vllm-ascend@2c59ff10:vllm_ascend/lora/punica_npu.py#L21-L50
  - vllm-ascend@2c59ff10:vllm_ascend/lora/punica_npu.py#L52-L104
  - vllm-ascend@2c59ff10:vllm_ascend/lora/lora_ops.py#L19-L32
  - vllm-ascend@2c59ff10:csrc/torch_binding.cpp#L2294-L2308
  - vllm-ascend@2c59ff10:csrc/kernels/bgmv_shrink.cpp#L66-L71
  - vllm-ascend@2c59ff10:vllm_ascend/lora/utils.py#L74-L88
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1349-L1352
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3793-L3794
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2965-L2970
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/lora/test_qwen3_multi_loras.py#L13-L20
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/lora/test_qwen3_multi_loras.py#L52-L63
  - vllm@0fc695fc:vllm/config/lora.py#L26-L45
  - vllm@0fc695fc:vllm/config/lora.py#L108-L116
  - vllm@0fc695fc:vllm/lora/request.py#L25-L44
  - vllm@0fc695fc:vllm/lora/model_manager.py#L273-L308
  - vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L91-L107
  - vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L27-L41
  - vllm@0fc695fc:vllm/lora/punica_wrapper/punica_base.py#L249-L256
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L589-L602
  - vllm@0fc695fc:vllm/lora/layers/column_parallel_linear.py#L223-L244
  - vllm@0fc695fc:vllm/lora/layers/column_parallel_linear.py#L442-L459
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L93-L99
  - https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L52-L57
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L329-L352
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L487-L496
  - vllm-ascend@baa023ad:vllm_ascend/lora/punica_npu.py#L31-L33
  - vllm-ascend@baa023ad:vllm_ascend/lora/quant_moe.py#L14-L19
  - vllm-ascend@2c59ff10:vllm_ascend/lora/punica_npu.py#L312-L322
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: ops-and-kernels
    kind: builds-on
    note: bgmv / sgmv 这四个就是那页说的 csrc 自编 AscendC 算子，注册成 torch.ops._C_ascend 再从 Python 调的规矩也在那页
  - to: npu-platform
    kind: builds-on
    note: get_punica_wrapper 是平台类交出去的类路径之一，上游按这个字符串 import 昇腾的实现
  - to: vllm-scheduler
    kind: builds-on
    note: 一步里适配器名额占满时，要新适配器的请求被弹进 skipped_waiting，而不是留在 waiting 队首
  - to: expert-parallel
    kind: builds-on
    note: MoE 模型上 LoRA 与 EP 同开会把 MoECommType 锁成 ALLTOALL，四种通信方式各自什么代价在那页
  - to: acl-graph
    kind: builds-on
    note: 批描述符上多带一位 has_lora 参与图的分桶，带 LoRA 的批和不带的批不能共用一张捕获好的图
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

LoRA 不动基座权重，只在被挑中的线性层上多加一项 `ΔW = BA`——两个秩 r 的小矩阵，前向时算成 `y = xW + (xAᵀ)Bᵀ · scale`。**正因为 `W` 一个字节都没改，一份基座上可以同时挂好几个适配器，不同请求挑不同的那一份，还能拼在同一个 batch 里一次算完。** 昇腾侧不实现这套机制，它接管的只是「按槽号取那两个小矩阵再乘回去」这一段。

三个在册版本上都有：`vllm_ascend/lora/` 这个目录、`csrc/kernels/` 下 `bgmv_shrink` / `bgmv_expand` / `sgmv_shrink` / `sgmv_expand` 四个 AscendC 文件，在 v0.23 维护分支、v0.26 分支（2026-09-17 源码快照）与 main 开发主线上都在，`git ls-tree` 三个提交都列得出来。主叙述按 v0.23 维护分支写；main 上多一个 `quant_moe.py`，差别见下面那张表。

```wiki-diagram
file: lora
```

## 那条请求用不到它

[那条请求](one-request.md)什么都没配，`--enable-lora` 没开，于是 `lora_config` 是 `None`，模型运行器里那段热插拔整块跳过。官方支持矩阵里 Qwen3-Dense 那一行的 LoRA 格子也是空的 [S5]——开了也不在官方标注过的组合里。

但昇腾自己的 e2e 用例正好用的就是这个模型：同一个 Qwen3-0.6B，注册三个适配器，`max_lora_rank=8`、`max_loras=2`、`max_cpu_loras=4` [C17][C18]。把那条请求的设定改成这一组，三个数各管一件事：

| 这一步在算什么 | 值 | 它管的是 |
|---|---|---|
| 一步里最多几个**不同**适配器 | 2 | `max_loras`；第三个适配器的请求当轮排不进去 [C26] |
| NPU 上开几个槽位 | 2 | 槽位表长度就是 `max_loras` |
| CPU 侧最多缓存几份 | 4 | `max_cpu_loras`，不写就等于 `max_loras` [C20] |

## 加的是两个小矩阵，显存却按 max_loras 预付

Qwen3-0.6B 的 `hidden_size` 是 1024，模型卡里 `num_attention_heads: 16`、`num_key_value_heads: 8`、`head_dim: 128` [S30]，所以 `qkv_proj` 的输出被切成 q=2048、k=1024、v=1024 共 4096。上游把这一层换成 `MergedQKVParallelLinearWithLoRA`，三段各有自己的一对 A、B。取默认的 `r = 16`：

```
A：3 段 × 16 × 1024              =  49 152
B：(2048 + 1024 + 1024) × 16     =  65 536
一个适配器在这一层               = 114 688 个参数 = 224 KiB（bf16）
基座这一层                       = 1024 × 4096 = 4 194 304 个 = 8 MiB
```

多出来 2.73%，这就是图最下面那排格子上高亮的那一格 [D]。

但 NPU 上真正占掉的不是 224 KiB：建层时 `create_lora_weights` 直接按 `[max_loras, 1, r, in]` 把槽位全开出来 [C27]。`max_loras=2` 就是 448 KiB，`max_loras=8` 就是 1.75 MiB——**和你实际加载了几个适配器无关**。`max_lora_rank` 同理，它是所有适配器共用的上界（取值只能是 1/8/16/32/64/128/256/320/512，默认 16 [C19]）：写 64 而适配器只有 8，多出来的 56 行留着创建时的零，照样占地方 [D]。

## 拼在一个 batch 里，靠的是每 token 一个槽号

槽号是这套东西的关键，它不等于适配器编号。`LoRARequest` 带的 `lora_int_id` 是全局唯一的编号；设备上用的是 `lora_index_to_id` 这张长度 `max_loras` 的表，`activate_adapter` 把适配器塞进表里第一个空格，那个下标才是槽号 [C22]。

每步前向之前，`convert_mapping` 把「这个 token 属于哪个请求、那个请求挂的是哪个 id」翻成一条和 token 一样长的下标张量，**没挂适配器的 token 填 −1** [C25]。算子按行查权重，−1 的行直接跳过——这在 AscendC 里就是一句 `if (reqLoRAIndex_ < 0) continue;` [C12]。所以「一个 batch 里混着挂和不挂的请求」不需要任何 Python 分支。

prefill 和 decode 走两套算子，区别只在批的形状：prefill 时 `compute_meta` 先把**相邻且同槽**的请求合并成一段，再交给 sgmv（按段）；decode 时每行一个 token，直接交给 bgmv（按行）。

槽位不够由调度器挡着：这一步已排进去的适配器数等于 `max_loras`、而新请求要的又不在其中，它就被弹出去放进 `skipped_waiting`——上游另建的一条队列，不是留在 `waiting` 队首。这道闸开在 `schedule()` 的哪一段见 [调度器](vllm-scheduler.md)，`skipped_waiting` 相对 `waiting` 的取队顺序见 [短请求优先](short-request-first.md)。

## 昇腾只接管「怎么乘」这一段

平台类交出去的只有一个字符串：`AscendPlatform.get_punica_wrapper()` 返回 `"vllm_ascend.lora.punica_npu.PunicaWrapperNPU"`，上游照这个名字 import。这个类继承上游的 `PunicaWrapperBase`，槽号张量、段起点、是不是 prefill 这些元数据全用父类算好的，自己只重写乘法入口。

真正昇腾自己的东西是那四个 AscendC 算子：源码在 `csrc/kernels/`，在 `torch_binding.cpp` 里注册成 `torch.ops._C_ascend.*`，`vllm_ascend/lora/lora_ops.py` 只是一层薄包装。这条路和别的自定义算子完全一样，见 [算子与核函数](ops-and-kernels.md)。

另外三处零碎但会改变行为的落点：`refresh_all_lora_classes()` 在构造 punica wrapper 时把六个 Ascend 版 LoRA 层类**插到上游注册表最前面**，于是 `AscendQKVParallelLinear` 这类昇腾自己的线性层也替换得上 [C13]；[模型运行器](npu-model-runner.md)加载期调 `load_lora_model`、每步调 `set_active_loras` 做热插拔；批描述符上多带一位 `has_lora`，图模式按它分桶捕获。

**不是所有卡都走这四个算子。** 310P 上，或者 `max_lora_rank ≥ 128` 时，构造时就整批换成上游的 `vllm.lora.ops.torch_ops`（纯 PyTorch 实现）[C8]——这是个静默降级，日志里不会提醒你。

## 怎么开，官方只给了这一条命令

```shell
vllm serve meta-llama/Llama-2-7b \
    --enable-lora \
    --lora-modules '{"name": "sql-lora", "path": "/path/to/lora", "base_model_name": "meta-llama/Llama-2-7b"}'
```

`--enable-lora` 是总开关，`--lora-modules` 在启动时把适配器注册好、一个 JSON 一个 [S1]。上面那三个数对应 `--max-loras` / `--max-lora-rank` / `--max-cpu-loras`，默认分别是 1、16、跟随 `max_loras`——**默认 `max_loras=1` 意味着开箱即用的配置一步里只容得下一个适配器**，多适配器服务必须显式调大。文档还说 ACL Graph 模式下能跑，并且建议开着以获得更好的 LoRA 性能。支持矩阵里这一行标的是 🔵 Experimental，不是 🟢 [S4]。

## 这几处版本之间真的不一样

主叙述那一套在三个版本上都成立；分叉集中在 MoE、只挂一个适配器的快路，以及「哪些卡走自定义算子」这三件事上。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| MoE + EP / 量化 | 文档写明两者都还不支持 [S2] | 同 v0.23 | 非量化与 W8A8 动态量化 × AllGather 与 All-to-All 四格全 Supported [S3]，多一份 `quant_moe.py` | `[!]` 量化 MoE 挂 LoRA 在两个发布分支上都是官方明说不支持的组合，别照 main 的文档配 |
| MoE + EP 选哪种通信 | 没有特判，照硬件挑 | 插在硬件分派之前直接强制 `ALLTOALL` [C33] | 同 v0.26 | `[!]` v0.23 上这个组合仍可能走进 MC2 那条 LoRA 打不了补丁的融合算子，细节在 [Expert Parallel](expert-parallel.md) |
| `max_loras == 1` 时怎么算 | 照样走 bgmv / sgmv | A2/A3 且没开 `fully_sharded_loras` 时切成普通 matmul 加一条掩码 [C31] | 同 v0.26，再抽成一个自定义 op | 只挂一个适配器是最常见的用法，v0.26 起这条路不再经过按行 gather 的算子 |
| 哪些卡退回 PyTorch 实现 | 写死判 `_310P` | 同 v0.23 | 改成查硬件画像上的 `LORA_CUSTOM_OPS` 能力位 [C34] | 加一代新卡不必再改这个 `if`；代价是「这代卡走不走自定义算子」要去 `hardware_profile.py` 查 |
| ACL Graph 的参数表 | 一份 `GraphParams` | 按 `has_lora` 拆成两份 `GraphParamsByLoRA` [C32] | 又并回一份 | `[!]` 只有 v0.26 给带 LoRA 的批单独存一套 workspace / handle；这一层在另外两个版本上不存在 |

## 常见误解

- **「挂 8 个适配器就比挂 1 个多占 8 倍显存。」**——NPU 上那份是按 `max_loras` 预分配的，加载几个都一样；真正随加载数量增长的是 CPU 侧那份缓存，上限 `max_cpu_loras`。
- **「`max_loras` 是能注册的适配器总数。」**——它是**一步里能同时出现的不同适配器数**。注册多少由 `max_cpu_loras` 管；一步里超额的请求会被弹进 `skipped_waiting` 等下一轮 [C26]，不报错、也不排在队首。
- **「用的是 punica 论文那套 CUDA kernel。」**——沿用的只有接口名和分层（上游 `punica_base.py` 文件头就引着那篇论文），实际算的是 `csrc/kernels/` 里那四个 AscendC 文件 [S2]；而且 310P 上、或秩到 128 及以上，连这四个都不走。
- **「秩 r 减半，开销就减半。」**——减半的是权重字节数和那两次小 GEMM 的乘加。减不掉的是 kernel 次数和那块中间缓冲：只要调用方没自带 buffer，`add_lora_linear` 就按 slice 数现开 `[num_tokens, r]` 的 fp32 缓冲 [C36]，r 再小这块也要开、shrink 与 expand 两趟 kernel 一趟都少不了 [D]。
