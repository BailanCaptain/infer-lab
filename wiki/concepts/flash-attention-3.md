---
id: flash-attention-3
title: "Flash Attention 3：不为了快，为了和训练侧算得一样"
type: feature
summary: 注意力后端家族里唯一要显式点名才会换上的成员：把注意力那一步的算子换成训练框架同款的 Flash Attention。官方直说可能更慢——这是为了强化学习里训练侧和推理侧算得一样而有意付的代价。
aliases: [Flash Attention 3, FA3, AscendFAImpl, flash_attn_npu_v3, flash_attn_npu, flash_attn_with_kvcache, _validate_fa3_backend, 训推一致, 训练推理一致, VLLM_BATCH_INVARIANT, use_batch_invariant, enable_training_consistency]
chapters: ["16", "04"]
order: 50
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/attention/fa3_v1.py#L1-L40
  - vllm-ascend@2c59ff10:vllm_ascend/attention/fa3_v1.py#L43-L60
  - vllm-ascend@2c59ff10:vllm_ascend/attention/fa3_v1.py#L62-L97
  - vllm-ascend@2c59ff10:vllm_ascend/attention/fa3_v1.py#L99-L145
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L821
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L843-L868
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1182-L1194
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L81-L86
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L147-L152
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1456-L1476
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1430-L1454
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L286-L287
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1864-L1865
  - vllm@0fc695fc:vllm/v1/attention/selector.py#L95-L104
  - vllm@0fc695fc:vllm/config/compilation.py#L59-L63
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L10-L18
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L38-L43
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L45-L56
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L58-L73
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L134-L147
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/flash_attention.md#L149-L156
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/flash_attention.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L437-L437
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_attention_fa3.py#L66-L90
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_attention_fa3.py#L112-L119
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L820-L821
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L1184-L1187
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L239-L248
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1357-L1382
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L775-L784
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292
  - vllm-ascend@baa023ad:vllm_ascend/attention/fa3_v1.py#L15-L18
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/flash_attention.md#L58-L76
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/flash_attention.md#L139-L147
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/flash_attention.html
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 它是所有后端里唯一不走三元组主表的那个，选中它的那段分支和主表的关系在那一页
  - to: paged-attention
    kind: builds-on
    note: 块表、五维块张量全是分页那套，FA3 只换了读块的算子
  - to: one-request
    kind: builds-on
    note: 那条请求默认用不到它；开了之后 200 步怎么切成 prefill 段和 decode 段用的是它的数
  - to: ops-and-kernels
    kind: builds-on
    note: 默认后端的算子来自 torch_npu，FA3 的算子来自仓库外的 flash_attn_npu wheel，不在那一页的四层里
  - to: acl-graph
    kind: conflicts-with
    note: 这个算子的 tiling 在 host 侧做，和 FULL_DECODE_ONLY 图模式不能同时开，官方要求退到 PIECEWISE
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 训练侧和推理侧，同一段输入算出的数不一样

强化学习微调是这样转圈的：训练框架把当前模型交给推理引擎，让它生成一批回答，再拿这批回答去算训练信号、更新模型。vLLM-Ascend 当推理引擎时，注意力那一步默认用的是一个推理专用的融合算子；而训练框架（比如 veRL）里，训练那一步的注意力用的是 Flash Attention。两个实现对同一段输入算出的数有细微差别——**推理产出的每一个数都会进训练信号，两侧算得不一样，训练信号本身就是歪的，怎么办？**

vLLM-Ascend 的答案是备一个可以显式换上的注意力后端（[注意力后端家族](attention-backend-family.md)里数过成员，它是其中唯一不走主表、要点名才启用的那个），整个文件一百四十多行，只做一件事：**把注意力那一步的算子换成训练侧同款的 Flash Attention**。换它不是为了快——官方文档直说可能更慢，这是为训推一致有意付的代价。文档另列了两条用途：调框架时少一项「训推差异」的变量；强化学习需要可复现的确定性产出。

不做强化学习的人读到这里可以停了：FA3 对纯推理只有代价。

## 那条请求用不到它

[那条请求](one-request.md)什么都没配，选后端走的还是主表，挑出来的是默认后端。FA3 在主表之外，**要同时做两件事才会换上**：显式点它的名，并打开批不变模式（大意是让同一条输入不管和谁拼成一批，都算出同样的结果）。少了任何一样都换不上——而且只少第二样时不报错，服务照常起来，跑的还是默认后端。

真开起来之后，变化只落在注意力这一步。这个模型 40 层里只有 10 层全注意力走注意力后端，另外 30 层[线性注意力](linear-attention.md)归另一套算子管，换后端管不到它们。于是那条请求的 200 步是这么走的：

| 走到哪一步 | 落进哪一路 | 算子怎么算 |
|---|---|---|
| 第 1 步，37 个 token 的 prefill | prefill 段 | 挡住后文，整段一起算 |
| 第 2–200 步，每步 1 个 token | decode 段 | 不用挡；每次告诉算子这条请求已经攒到多少 token，从 38 一路数到 237 |
| 合计 | 200 步 × 10 层 | 每颗 NPU 调 2000 次 |

批里只有它一条，两路永远不会同时出现：要么整批 prefill，要么整批 decode。

两句提醒。其一，官方测过的模型只有四个，全是纯注意力的 Qwen3，这个带线性注意力的混合模型不在其列——上面的账是按代码机制推的，不是实测。其二，这一节说的开法只对两个发布版本成立；开发主线换了一套开关，照旧命令去开，一次都选不中而且不报错，细节在下半的版本差异。

## 它只换了「怎么切一批」这一刀，别的全是继承来的

FA3 的后端直接继承默认后端，只改了两处：初始化，和前向。于是一串东西原封不动：每一步的 K/V 怎么写进块、块表长什么样、一块 2048 个位置、每 token 每层每颗 1 KiB 的账（见[四种注意力的代价](attention-cost.md)），全和默认后端一个字不差——FA3 只换了**读**这些块的算子。

真正不同的是前向怎么分批。默认后端看「这批处于哪种状态」在五种分支里挑一条，一次算完整批；FA3 一眼不看状态，只拿调度早就数好的「几条在 decode、几条在 prefill」把一批从中间切一刀：decode 段不带遮挡调一次算子，prefill 段带遮挡再调一次，两段拼回去交给下一层。混合批因此天然支持，分块预填充也跑得通——官方的端到端测试专门把「一步最多算几个 token」压到 5，逼出这两种批验过。

```wiki-diagram
file: flash-attention-3
```

## 四道闸：第一道悄悄放行，后三道直接报错

想换上它，启动时要连过四道闸，不过的后果各不相同：

| 闸 | 条件 | 不满足时 |
|---|---|---|
| 一 | 显式点了它的名 | 当无事发生，正常走主表 |
| 二 | 批不变模式开着 | 只留一句日志，服务照常起来，跑默认后端 |
| 三 | 模型不是 MLA / SFA | 启动直接报错 |
| 四 | 装了那个外部包、包里有那个算子 | 两种缺法各有一句报错 |

**第二道最容易踩**：点了名、忘开批不变模式，不报错、不警告，只有一句不起眼的提示。更麻烦的是从后端名字上也分辨不出来——FA3 对外报的名字和默认后端一模一样。唯一可靠的确认办法是去启动日志里找那句「FA3 会被启用、可能带来性能下降」的提示，有它才是真开了。

第四道闸查的那个包不在 vLLM-Ascend 仓库里，是单独发布的一个安装包。也就是说这一页讲的算子不属于[算子与核函数](ops-and-kernels.md)那四层里的任何一层——它是仓库外面来的。

## 代价：文档列了七条不支持，代码只拦了两条

官方文档列的不支持项有七条：滑动窗口、旋转位置编码（算子内不做，退回框架自带的实现顶上）、ALiBi、softcap、FP8 量化、MLA、SFA。代码里真的拦了的只有两条：滑动窗口在初始化时报错，MLA / SFA 在第三道闸报错。剩下五条踩了没有护栏。

图模式这条要单独当心。文档说「不支持图捕获，请改用按段的图」（整趟的图和按段的图是[ACL Graph](acl-graph.md)那页的分法），原因是这个算子回放前的准备工作在 host 侧做，进不了图。但代码只拦了会录整趟图的三种配置里的一种——「只给 decode 录整趟」那种——另外两种一个字没拦，配了不报错，出了问题没人提醒。

硬件上文档要求 Atlas A2 / A3。文档还有一处自相矛盾：开头说那个算子包已经开源，限制一节第一条却写着包还没发布、外部用户用不了；开发主线上后一条已经删掉。

## 常见误解

- **「FA3 是 Flash Attention 的昇腾优化版，开了会更快。」**——反了。官方明说可能更慢，这是为训推一致有意付的代价；不做强化学习就别开。
- **「点了它的名，就是在跑 FA3。」**——两个发布版本上还差批不变模式那道闸，缺了只有一句日志提示；开发主线上点名用的那个参数整个不认。确认要靠日志里那句「FA3 会被启用」，别看后端名字。
- **「官方测试断言 FA3 和默认后端输出相等，说明两个算子算出的数一样。」**——断的是贪心解码下吐出的 token 相同，外加逐步比对每个 token 的分数，那是正确性检查，不是逐比特相同。FA3 存在的前提恰恰是默认算子和训练侧的 Flash Attention 算得不一样。

## 对照源码

### 怎么开

v0.23 / v0.26 分支上要同时给三样东西，命令形状抄自官方文档（官方示例模型是 Qwen3-8B [S19]，这里换成贯穿全库的那个）：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3.6-35B-A3B \
  --attention-backend FLASH_ATTN \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

- `VLLM_BATCH_INVARIANT=1`：上游把这个环境变量读成 `attn_selector_config.use_batch_invariant` [C14]，是第二道闸。
- `--attention-backend FLASH_ATTN`：第一道闸。它能活到 `get_attn_backend_cls`，是因为平台层特意开了口子：别的后端名都被重置成 `None`，唯独 `FLASH_ATTN` 不重置 [C7]。
- `PIECEWISE`：`flash_attn_with_kvcache` 的 tiling 在 host 侧做，官方要求不进整图捕获 [S17]。

四道闸的代码在 `NPUPlatform._validate_fa3_backend` [C6]：`selected_backend == AttentionBackendEnum.FLASH_ATTN` 才会走进这段分支 [C5]；`attn_selector_config.use_batch_invariant` 为假则 `return False`；`key == (False, False)`（非 MLA / SFA）；最后检查 `flash_attn_npu_v3` 可导入且带 `flash_attn_with_kvcache`。外部包名叫 `flash_attn_npu`，安装入口在文档 [S18]。

正向信号是一条 info：「In training-inference consistency scenario, FA3 will be enabled, which may cause performance degradation.」。`AscendFABackend.get_name()` 与 `AscendAttentionBackend.get_name()` 返回同一个字符串 [C8]，日志是唯一分辨手段。

官方测过的模型只有 `Qwen3-0.6B` / `Qwen3-1.7B` / `Qwen3-8B` 与 `Qwen3-30B-A3B` 四个 [S21]；Qwen3.6-35B-A3B（40 层里 10 层全注意力 [S36]）不在其列，上半那笔「每颗 NPU 2000 次调用」是推导：200 步 × 10 层全注意力，30 层线性注意力不经过这个后端 [D]。

main 上的开法整个换掉：`--additional-config '{"rl_config":{"enabled":true,"enable_training_consistency":true}}'` [C29][S33]，见版本差异。

### 会报什么错

- 第三道闸：`ValueError("FA3 backend does not support MLA and SFA.")`。
- 第四道闸：包没装、或包里没有那个算子，各一条 `ValueError`，报错文本写明要装 `flash_attn_npu_v3`。
- 滑动窗口模型：`AscendFAImpl.__init__` 直接抛 `ValueError` [C2]。
- 图模式：`__init__` 里那道检查只在 `cudagraph_mode == CUDAGraphMode.FULL_DECODE_ONLY` 且没开 `enforce_eager` 时抛错。上游 `CUDAGraphMode` 一共五个取值，`FULL` 和 `FULL_AND_PIECEWISE` 同样会捕整图 [C15]，这两种 FA3 一个字都没拦 [!]。
- 第二道闸不是错：只有一条 info「FA3 will not be enabled…」，服务照常起来。
- main 上判定入口变成模块级函数、非 PCP 时每次选后端都调 [C28]：MLA 模型只要开了训推一致就直接 `ValueError`；v0.23 上不显式选压根碰不到这个检查。

### 开销和什么时候别开

- 官方在文档 note 里直说：相比默认 FIA 后端 may cause performance degradation，为训推一致有意为之 [S20]。不做强化学习没有理由开。
- v0.23 / v0.26 上 FA3 和批不变模式绑死（第二道闸），想要 FA3 就得连批不变那份开销一起付；两者拆开只有 main 做得到 [C31]。
- 文档列的不支持项七条：sliding window、RoPE（算子内不做，vLLM-Ascend 用 PyTorch 原生 RoPE 兜底）、ALiBi、softcap、FP8 量化、MLA、SFA [S20]。代码真拦的只有 sliding window 和 MLA / SFA 两处。
- 硬件要求 Atlas A2 / A3 [S18]。
- 文档自相矛盾 [!]：开头的 note 说 `flash_attn_npu` 已在 GitHub 开源 [S16]，Limitations 第一条却写包还没发布、外部用户用不了 [S20]；main 上后一条已删 [S34]。

### 版本差异

`fa3_v1.py` 在 v0.23 与 v0.26 上是同一个 blob，平台层那两处也一字不差 [C26]；v0.20.2rc1 就引入了 [S23]。差异全在 main：

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 开关 | `--attention-backend FLASH_ATTN` + `VLLM_BATCH_INVARIANT=1` | `--additional-config '{"rl_config":{"enabled":true,"enable_training_consistency":true}}'`[S33] | [!] 照旧命令在 main 上开，`att_config.backend` 会被无条件清成 `None` [C30]，FA3 一次都选不中，而且不报错 |
| 判定入口 | `NPUPlatform._validate_fa3_backend`，只在显式选了 FLASH_ATTN 时才调 | 模块级函数，非 PCP 的每次选后端都调 | [!] main 上 MLA 模型一旦开了训推一致就直接 `ValueError`；v0.23 上不显式选压根碰不到 |
| 批不变模式 | 和 FA3 绑死，是第二道闸 | 拆开了，`rl_config.enable_batch_invariant` 单独管，由它去设 `VLLM_BATCH_INVARIANT` | 想要训推一致但不想付批不变那份开销，只有 main 做得到 |
| 与 PCP | 不检查 | `use_pcp` 为真就不走 FA3 | main 上 PCP 与 FA3 静默互斥 |
| `get_name()` | `"CUSTOM"`，V2 model runner 下是 `"FLASH_ATTN"` | 恒为 `"CUSTOM"` | 两版都和默认后端同名，靠名字分不出跑的是哪个 |

### 源码位置

| 事实 | 位置 |
|---|---|
| 后端类与 `AscendFAImpl`，整个文件一百四十多行 | `vllm_ascend/attention/fa3_v1.py` |
| `__init__`：滑动窗口与图模式两道检查 | 同文件 |
| decode / prefill 两段各调一次 `flash_attn_with_kvcache`，`torch.cat` 拼回 | 同文件[C4] |
| 四道闸 `_validate_fa3_backend` 与进入它的分支 | `vllm_ascend/platform.py` |
| 只有 `FLASH_ATTN` 不被重置成 `None` | 同文件 |
| 默认后端的五种 `AscendAttentionState` 分支 | `vllm_ascend/attention/attention_v1.py`[C10] |
| 继承来的写缓存 `reshape_and_cache`、按条数分批 `split_decodes_and_prefills` | 同文件[C12] |
| 继承来的五维块张量与 `get_supported_kernel_block_sizes() = [128]` | 同文件[C38] |

读 `forward_impl` 有两处值得记一笔：

- 切块表的两把尺子不一样：decode 段用 `[:num_decodes]`，prefill 段用的却是 `[num_decode_tokens:]`——块表一行对应一条请求，两把尺子只有在每条 decode 请求恰好一个 query token 时才相等；同仓库里 C8 那个实现用的是 `[num_decodes:]`[D]。
- decode 那一路把 `max(seq_lens)`（KV 长度）传给了 `max_seqlen_q`。算子内部拿这两个值做什么没有源码可看，只记下代码是这么写的 [I]。

端到端测试 `test_attention_fa3.py`：贪心解码下断言 FA3 与默认后端 token id 相等、逐步比对 logprob；混合批与 chunked prefill 用 `max_num_batched_tokens=5` 压出。
