---
id: lora
title: "LoRA 适配器：一份基座权重，按槽号给每一行加不同的小矩阵"
type: feature
summary: 基座模型只装一份；每个微调版只是两个小矩阵，不同请求挂不同的那份，靠每行一个槽号拼进同一批一次算完。
aliases: [LoRA, LoRA 适配器, 低秩适配, Low-Rank Adaptation, Multi-LoRA, 多 LoRA, 多租户适配器, PunicaWrapperNPU, punica, bgmv, sgmv, LoRARequest, enable-lora, lora-modules]
chapters: ["17"]
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lora.md#L9-L24
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lora.md#L26-L30
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lora.md#L30-L37
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L13-L13
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150-L150
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
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L240-L258
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/lora/punica_npu.py#L52-L57
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L329-L352
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L487-L496
  - vllm-ascend@baa023ad:vllm_ascend/lora/punica_npu.py#L31-L33
  - vllm-ascend@baa023ad:vllm_ascend/lora/quant_moe.py#L14-L19
  - vllm-ascend@2c59ff10:vllm_ascend/lora/punica_npu.py#L312-L322
  - vllm@0fc695fc:vllm/lora/layers/base_linear.py#L99-L145
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L217
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
updated: "2026-09-25"
origin: seed
---

## 十个客户十个微调版，模型要装十份吗

设想一家公司拿同一个基座模型，给客服、法务等十个场景各微调了一版。35B 的模型一份就要几十 GiB，难道复制十份、开十份服务？

LoRA 的答案是：微调时**基座权重一个数都不动**，只在挑中的几类层上外挂两个小矩阵——一个把这一层的输入压到很窄（比如 16 维），另一个再抬回原来的宽度，这个「16」就叫**秩**。这一层的输出变成「基座算的结果，加上小矩阵算的结果乘一个固定比例」。一个场景微调出来的那一包小矩阵，就叫一个**适配器**。

正因为基座没被改过，服务时基座只装一份，十个适配器全挂上去；哪条请求要客服版，就在它的每一行计算里多加客服版那对小矩阵。不同请求挂不同适配器，还能拼进同一批一次算完——靠的是给每一行发一个「槽号」，下面细讲。昇腾这边没有另起炉灶：注册、占槽、发槽号全是 vLLM 的通用逻辑，昇腾接管的只是「按槽号取小矩阵乘回去」这一段。

## 那条请求用不到它，而且那套部署还正好踩线

[贯穿全库的那条请求](one-request.md)没开这个功能：总开关没打开，引擎里整套挂载逻辑直接跳过。官方支持矩阵里，Qwen3.6-35B-A3B 那一行的 LoRA 格子也是空的——没标支持，也没标不支持。

更要紧的是，这个模型是 MoE（专家）结构，而官方教程给它的部署命令用的是 W8A8 量化权重、还开着专家并行——在 v0.23 和 v0.26 两个发布分支上，官方文档明说 MoE 模型挂 LoRA 时**这两样都还不支持**（main 开发主线上放开了一部分，见下半的版本差异）。所以这一页的算例按 BF16 原版权重、只在注意力层挂适配器来讲，机制本身在哪类线性层上都一样。

例子里的名额取自昇腾仓库自己的多适配器测试（那个测试用的是 0.6B 的小模型）：注册三个适配器，一步里同时出现的适配器名额开 2，CPU 侧最多缓存 4 份。三个数各管一件事：

| 这个数管什么 | 例子里的值 |
|---|---|
| 一步里最多同时出现几个**不同**适配器（名额） | 2；要第三个适配器的请求这一轮排不进去 |
| NPU 上开几个槽位 | 跟名额一样，2 |
| CPU 侧最多缓存几份适配器 | 4；不设就等于名额 |

## 每层只加两个小矩阵，显存却按名额预付

挑全注意力层里「把 16 个头的注意力结果拼回 2048 宽」的那次投影来算（这个模型每个头 256 维，16 个头合起来 4096 维）：

- 基座这块权重：4096 × 2048 ≈ 839 万个数，bf16 下 **16 MiB**；
- 一个秩 16 的适配器在这层：压的那个矩阵 16 × 4096 = 65 536 个数，抬的那个 2048 × 16 = 32 768 个数，合计 98 304 个数，**192 KiB**——只有基座这层的 **1.2%**。

挂在把 Q、K、V 拼在一起算的那次投影上时也一样，只是三段各有自己的一对小矩阵。

但 NPU 上真正占掉的显存不是「一个适配器 192 KiB」：建层的时候，槽位就按名额**全部开好**了。名额 2，这一层就是 384 KiB；名额 8 就是 1.5 MiB——**和你实际加载了几个适配器无关**。秩的上限同理：它是所有适配器共用的一个数（默认 16），写成 64 而适配器实际只有 8，多出来的行放着零，照样占地方。真正随加载数量增长的是 CPU 侧那份缓存，上限就是上面那个「最多缓存几份」。

## 拼进同一批，靠的是每行一个槽号

```wiki-diagram
file: lora
```

槽号是这套东西的关键，它**不是**适配器的编号。注册适配器时，每个适配器拿到一个全局唯一的编号；设备上另有一张长度等于名额的槽位表，适配器被启用时塞进表里第一个空格，**那个空格的下标才是槽号**。顺带提醒：KV Cache 那边说的「块里的槽位」是另一个概念，只是撞了名字，两者毫无关系。

每步前向之前，引擎把「这一行属于哪个请求、那个请求挂的哪个适配器」翻成一条和这一批行数一样长的槽号表；**没挂适配器的行填 −1**。算子按行查小矩阵，−1 的行直接跳过——在昇腾的算子代码里这就是一句「小于零就跳过」。所以同一批里混着挂和不挂的请求，不需要任何分支判断。

算问题那一步（prefill）和逐个吐 token 的阶段（decode）走两套算子，区别只在批的形状：prefill 把**相邻且同槽**的行合并成段、按段乘；decode 每请求一行、按行乘。

名额占满怎么办？由调度器挡着：这一步已排进的适配器数到了名额上限、新请求要的又不在其中，它就被弹进另一条队列等下一轮——不报错，也不占着队首堵别人。这道闸开在哪见[调度器](vllm-scheduler.md)，那条队列的取队顺序见[短请求优先](short-request-first.md)。

## 昇腾只接管「怎么乘」这一段

上游 vLLM 把「按槽号乘小矩阵」这一段做成了可替换的插件位：平台启动时交出一个类名，具体乘法就用谁家的实现。昇腾交出去的那个类继承上游的基类，槽号表、段的起点、是不是 prefill 这些元数据全用上游算好的，自己只重写乘法入口——落到四个自己用昇腾算子语言写的核函数上（按段压、按段抬、按行压、按行抬各一个）。

另外三处会改变行为的落点：昇腾把自己的几个 LoRA 层替换类插到上游注册表**最前面**，这样昇腾自己定义的线性层也能被换成带 LoRA 的版本；模型运行器在加载期挂上适配器、每步刷新「这步谁在用哪个」；图模式按「这批带不带 LoRA」分开捕获，两种批不共用一张图。

**不是所有卡都走那四个核函数。** 310P 上，或者秩上限设到 128 及以上时，构造时就整批换成上游的纯 PyTorch 实现——这是个静默降级，日志里不会提醒你。

## 常见误解

- **「挂 8 个适配器就比挂 1 个多占 8 倍显存。」**——NPU 上那份是按名额预付的，加载几个都一样；真正随加载数量增长的是 CPU 侧缓存。
- **「名额是能注册的适配器总数。」**——它是**一步里能同时出现的不同适配器数**。注册多少由 CPU 缓存上限管；一步里超额的请求排队等下一轮，不报错。
- **「这套算子是从 GPU 那边原样搬来的。」**——沿用的只有接口名和分层，真正做乘法的是昇腾自己写的四个核函数；而且 310P 上、或秩上限到 128 及以上，连这四个都不走。
- **「秩减半，开销就减半。」**——减半的是权重字节数和两次小矩阵乘的乘加。减不掉的是核函数趟数和一块中间缓冲：先压后抬两趟一趟都少不了，中间那块缓冲不管秩多小都要开。

## 对照源码

### 怎么开

- 总开关 `--enable-lora`；`--lora-modules` 在启动时注册适配器，一个 JSON 一个 [S1]。官方文档给的示例命令：

  ```shell
  vllm serve meta-llama/Llama-2-7b \
      --enable-lora \
      --lora-modules '{"name": "sql-lora", "path": "/path/to/lora", "base_model_name": "meta-llama/Llama-2-7b"}'
  ```

- 上半那三个数对应 `--max-loras` / `--max-lora-rank` / `--max-cpu-loras`，默认分别是 1、16、跟随 `max_loras` [C19][C20]。`max_lora_rank` 取值只能是 1/8/16/32/64/128/256/320/512。**默认 `max_loras=1` 意味着开箱即用的配置一步里只容得下一个适配器**，多适配器服务必须显式调大。
- 例子的名额取自昇腾 e2e 用例 `test_qwen3_multi_loras.py`：Qwen3-0.6B 注册三个适配器，`max_lora_rank=8`、`max_loras=2`、`max_cpu_loras=4` [C17][C18]。
- 文档写明 ACL Graph 模式下能跑，并建议开着以获得更好的 LoRA 性能 [S1]。支持特性页标 🔵 Experimental，不是 🟢 [S4]；支持矩阵里 Qwen3.6-35B-A3B 那一行的 LoRA 格子是空的 [S5]。
- v0.23 / v0.26 文档：dense 和 MoE 模型都能挂，但 **MoE 模型上还不支持 EP 和量化** [S2]。官方教程给 Qwen3.6-35B-A3B 的 A2/A3 部署示例正是 `Eco-Tech/Qwen3.6-35B-A3B-w8a8` 加 `--enable-expert-parallel` [S38]——两条都踩 `[!]`。
- 机制链路：`LoRARequest.lora_int_id` 是全局唯一编号 [C21]；`activate_adapter` 把适配器塞进 `lora_index_to_id`（长度 `max_loras`）第一个空格，下标即槽号 [C22]；每步 `convert_mapping` 展开成逐行槽号张量、没挂的填 −1 [C25]；AscendC 侧按行跳过就是 `if (reqLoRAIndex_ < 0) continue;` [C12]。prefill 用 `compute_meta` 把相邻同槽的行合段交给 sgmv，decode 走 bgmv。
- 昇腾接管点：`AscendPlatform.get_punica_wrapper()` 返回 `"vllm_ascend.lora.punica_npu.PunicaWrapperNPU"` [C7]；该类继承 `PunicaWrapperBase`，只重写乘法入口 [C9]；四个 AscendC 算子在 `torch_binding.cpp` 注册成 `torch.ops._C_ascend.*` [C11]，`lora_ops.py` 是薄包装 [C10]，规矩同[算子与核函数](ops-and-kernels.md)。`refresh_all_lora_classes()` 把六个 Ascend 版 LoRA 层类插到上游注册表最前面，`AscendQKVParallelLinear` 这类昇腾自建线性层也替换得上 [C13]；[模型运行器](npu-model-runner.md)加载期调 `load_lora_model`、每步调 `set_active_loras`；批描述符带 `has_lora` 参与图模式分桶。

### 会报什么错

- 这条路的特点是**该报的地方不报**：名额占满时，要新适配器的请求被弹进上游另建的 `skipped_waiting` 队列等下一轮，不报错、也不留在 `waiting` 队首 [C26]；310P 上或 `max_lora_rank ≥ 128` 时整批换成上游 `vllm.lora.ops.torch_ops` 纯 PyTorch 实现，日志不提醒 [C8] `[!]`。

### 开销和什么时候别开

- 上半算例的推导 [D]：`o_proj` 权重 `(16 × 256) × 2048 = 8 388 608 个 × 2 B = 16 MiB`（`num_attention_heads: 16`、`head_dim: 256`、`hidden_size: 2048` [S30]；`o_proj` 输入宽度就是头数乘头维，不带别的系数 [C29]）。秩 16 的适配器：`A = 16 × 4096 = 65 536`，`B = 2048 × 16 = 32 768`，合计 `98 304 个 × 2 B = 192 KiB ≈ 1.2%`。
- 算例避开 qkv 段宽是有意的：这一族模型的 `qkv_proj` 里 q 段宽度乘了 `(1 + attn_output_gate)`，该开关默认为真，而这个模型的 config 摘录里没核到这一项，q 段实际宽度定不下来 [A]。合并 QKV 层的结构性事实不受影响：三段各有一对 A、B [C28]。
- 预付：`create_lora_weights` 把 `lora_a_stacked` 直接建成 `[max_loras, 1, r, in]`、`lora_b_stacked` 按 `max_lora_rank` 开行 [C37]（合并层的覆盖版本见 [C27]）。名额 2 时这一层 384 KiB、名额 8 时 1.5 MiB [D]；秩上限写 64 而适配器只有 8，多出的 56 行留零也占地 [D]。
- 中间缓冲与趟数：调用方没自带 buffer 时，`add_lora_linear` 按 slice 数现开 `[num_tokens, r]` 的 fp32 缓冲 [C36]；秩再小，shrink 与 expand 两趟 kernel 一趟都少不了 [D]。
- 什么时候别开：不打算挂适配器就别开总开关（层被替换、槽位被预付都白花）；量化 MoE 模型在两个发布分支上是官方明说不支持的组合 [S2]，别照 main 的文档配。

### 版本差异

主叙述那一套在三个版本上都成立；分叉集中在 MoE、只挂一个适配器的快路，以及「哪些卡走自定义算子」这三件事上。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| MoE + EP / 量化 | 文档写明两者都还不支持 [S2] | 同 v0.23 | 非量化与 W8A8 动态量化 × AllGather 与 All-to-All 四格全 Supported，其他量化方法、Fused MC2、动态 EPLB 仍不支持 [S3]，多一份 `quant_moe.py` | `[!]` 量化 MoE 挂 LoRA 在两个发布分支上都是官方明说不支持的组合，别照 main 的文档配 |
| MoE + EP 选哪种通信 | 没有特判，照硬件挑 | 插在硬件分派之前直接强制 `ALLTOALL` | 同 v0.26 | `[!]` v0.23 上这个组合仍可能走进 MC2 那条 LoRA 打不了补丁的融合算子，细节在 [Expert Parallel](expert-parallel.md) |
| `max_loras == 1` 时怎么算 | 照样走 bgmv / sgmv | A2/A3 且没开 `fully_sharded_loras` 时切成普通 matmul 加一条掩码 | 同 v0.26，再抽成一个自定义 op | 只挂一个适配器是最常见的用法，v0.26 起这条路不再经过按行 gather 的算子 |
| 哪些卡退回 PyTorch 实现 | 写死判 `_310P` | 同 v0.23 | 改成查硬件画像上的 `LORA_CUSTOM_OPS` 能力位 | 加一代新卡不必再改这个 `if`；代价是「这代卡走不走自定义算子」要去 `hardware_profile.py` 查 |
| ACL Graph 的参数表 | 一份 `GraphParams` | 按 `has_lora` 拆成两份 `GraphParamsByLoRA` [C32] | 又并回一份 | `[!]` 只有 v0.26 给带 LoRA 的批单独存一套 workspace / handle；这一层在另外两个版本上不存在 |

### 源码位置

`vllm_ascend/lora/` 这个目录和 `csrc/kernels/` 下的四个 AscendC 文件在 v0.23 维护分支、v0.26 分支（2026-09-17 源码快照）与 main 开发主线上都在，`git ls-tree` 三个提交都列得出来；main 上多一个 `quant_moe.py`。

| 看什么 | 在哪 |
|---|---|
| 昇腾的乘法实现 | `vllm_ascend/lora/punica_npu.py`（`PunicaWrapperNPU`）、`lora_ops.py`、`utils.py` |
| 四个 AscendC 算子 | `csrc/kernels/bgmv_shrink.cpp` / `bgmv_expand.cpp` / `sgmv_shrink.cpp` / `sgmv_expand.cpp`，注册在 `csrc/torch_binding.cpp` |
| 平台交出的类路径 | `vllm_ascend/platform.py`，`get_punica_wrapper` |
| 三个启动参数与取值 | 上游 `vllm/config/lora.py` |
| 槽位表与逐行槽号 | 上游 `vllm/lora/model_manager.py`（`activate_adapter`）、`vllm/lora/punica_wrapper/` |
| 层的替换与预付显存 | 上游 `vllm/lora/layers/base_linear.py`（`create_lora_weights`）、`column_parallel_linear.py` |
| 名额占满的闸门 | 上游 `vllm/v1/core/sched/scheduler.py`（`skipped_waiting`） |
| 运行器挂钩 | `vllm_ascend/worker/model_runner_v1.py`（`load_lora_model` / `set_active_loras`） |
| 多适配器 e2e 用例 | `tests/e2e/pull_request/one_card/lora/test_qwen3_multi_loras.py` |
| 算例的层形状 | 上游 `vllm/model_executor/models/qwen3_next.py`（`qkv_proj` / `o_proj`） |
