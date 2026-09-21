---
id: flash-attention-3
title: "Flash Attention 3：为了和训练侧算得一样，把默认的 FIA 换掉"
type: feature
summary: 昇腾 attention/ 下一个独立的注意力后端（v0.23 上那里五个后端类、v0.26 起六个），把注意力算子从 torch_npu 的 FIA 换成外部包 flash_attn_npu_v3 里的 flash_attn_with_kvcache——不是为了更快，是为了让 RL 里推理侧和训练侧用同一个算子。
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
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 它是所有后端里唯一不走三元组主表的那个，选中它的那段分支和主表的关系在那一页
  - to: paged-attention
    kind: builds-on
    note: 块表、128 的块大小、五维块张量全是分页那套，FA3 只换了读块的算子
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
updated: "2026-09-22"
origin: seed
---

## 一句话

`AscendFABackend` 是 `attention/` 下一个独立的注意力后端（那里 v0.23 上有五个后端类、v0.26 分支起是六个，见 [注意力后端家族](attention-backend-family.md)），整个文件一百四十多行。它做的事只有一件：**把注意力那一步的算子从默认的 FIA 换成外部包 `flash_attn_npu_v3` 里的 `flash_attn_with_kvcache`**。换它不是为了快——官方文档直说可能更慢，这是为训推一致有意付的代价 [S20]。

三个在册版本上这个文件都在，v0.20.2rc1 就引入了 [S23]。**但「怎么把它打开」在 main 上换了一套**：v0.23 与 v0.26 分支靠 `--attention-backend FLASH_ATTN` 加批不变模式，main 改成 `rl_config` 里的两个开关，而 `--attention-backend` 在那边已经会被无条件丢掉 [C30]。下面按 v0.23 维护分支讲，差异集中在最后那张表。

```wiki-diagram
file: flash-attention-3
```

## 那条请求用不到它

[那条请求](one-request.md)什么都没配，`use_batch_invariant` 是 `False`，第二道闸就 `return False`，走的仍是三元组主表选出来的 `AscendAttentionBackend` [C6]——选后端那一步在[注意力后端家族](attention-backend-family.md)里讲过。

要让它走 FA3，得改两处设定，其余不变。Qwen3-0.6B 恰好是官方测过的四个模型之一 [S21]：

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3-0.6B \
  --attention-backend FLASH_ATTN \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

三个值各有来由：`VLLM_BATCH_INVARIANT=1` 是第二道闸要的，上游把这个环境变量读成 `attn_selector_config.use_batch_invariant`；`FLASH_ATTN` 是第一道闸要的；`PIECEWISE` 是因为这个算子的 tiling 在 host 侧做，进不了图。命令抄自官方文档，只把模型换成那条请求的 [S19]。

改完之后，200 次 forward 分成两路 [D]：

| 走到哪一步 | 落进哪一路 | 算子拿到什么 |
|---|---|---|
| 第 1 步，37 个 token 的 prefill | `num_prefills = 1` | `causal=True`，`cache_seqlens=[37]` |
| 第 2–200 步，每步 1 个 token | `num_decodes = 1` | `causal=False`，`cache_seqlens` 从 `[38]` 数到 `[237]` |
| 合计 | 200 次 forward × 28 层 | 5600 次 `flash_attn_with_kvcache` |

这条请求上两路永远不会同时出现：批里只有它一条，要么整批 prefill，要么整批 decode [D]。

## 训练侧用的是 FA，推理侧默认用的是 FIA，RL 就对不上

官方文档把动机写得很直白：veRL 这类 RL 训练框架里，训练那一步的注意力用的是 Flash Attention；vLLM-Ascend 当推理后端时，默认的 Fused Infer Attention 与训练侧的 Flash Attention 不是同一个实现，于是出现训推不一致，FA3 后端就是把推理侧换回同一个算子 [S16]。

为什么 RL 格外在意：RL 拿推理产出的 rollout 去算训练信号，两侧对同一段输入算出的数不一样，训练信号本身就是歪的。文档另外列了两条用途——调框架时少一项「训推差异」的变量，以及 RL 需要可复现的确定性 rollout。

不做 RL 的人读到这里可以停了：FA3 对纯推理只有代价。

## 它只覆盖了两个方法，别的全是继承来的

`AscendFAImpl` 直接继承 `AscendAttentionBackendImpl`，只重写 `__init__` 和 `forward_impl`。于是一串东西原封不动：K/V 按 `slot_mapping` 落格走的还是父类的 `reshape_and_cache`；`get_kv_cache_shape` 返回的还是那个五维张量，`get_supported_kernel_block_sizes` 还是 `[128]`，所以每 token 112 KiB、每块 14 MiB 的账不变，见[四种注意力的代价](attention-cost.md)；连 metadata builder 都还是默认后端那个 `AscendAttentionMetadataBuilder`。

真正不同的是 `forward_impl` 怎么分批。默认后端看 `attn_state` 的五个取值挑分支；**FA3 一眼都不看 `attn_state`**，它只拿 builder 早就算好的 `num_decodes` / `num_prefills` 把这一批从中间切一刀：decode 段 `causal=False` 调一次，prefill 段 `causal=True` 再调一次，两段 `torch.cat` 起来 [C4]。混合批因此天然支持，chunked prefill 也跑得通——e2e 专门用 `max_num_batched_tokens=5` 压过这条路。

读这段有两处值得记一笔。切块表时 decode 段用的是 `[:num_decodes]`，prefill 段用的却是 `[num_decode_tokens:]`——块表一行对应一条请求，两把尺子只有在每条 decode 请求恰好一个 query token 时才相等，同仓库里 C8 那个实现用的是 `[num_decodes:]` [C13][D]。另一处是 decode 那一路把 `max(seq_lens)`（KV 长度）传给了 `max_seqlen_q`。算子内部拿这两个值做什么没有源码可看，所以只记下代码是这么写的 [I]。

## 四道闸：第一道悄悄放行，后三道直接抛错

`_validate_fa3_backend` 是一串早退，顺序和后果都不一样：

| 闸 | 条件 | 不满足时 |
|---|---|---|
| 一 | `selected_backend == AttentionBackendEnum.FLASH_ATTN` | 根本不进这个函数，正常走主表 |
| 二 | `attn_selector_config.use_batch_invariant` | `return False`，只留一条 info，服务照常起来 |
| 三 | `key == (False, False)`，即不是 MLA / SFA | `ValueError("FA3 backend does not support MLA and SFA.")` |
| 四 | `flash_attn_npu_v3` 装了、且提供 `flash_attn_with_kvcache` | 两条各自的 `ValueError` |

**第二道最容易踩**：忘了 `VLLM_BATCH_INVARIANT=1`，命令行写了 `--attention-backend FLASH_ATTN` 也没用，不报错、不警告，只在 info 里说一句「FA3 will not be enabled…」，跑的是默认后端。从后端名字也分辨不出来——`AscendFABackend.get_name()` 和 `AscendAttentionBackend.get_name()` 返回的字符串一模一样 [C8]。唯一的正向信号是另一条 info：「In training-inference consistency scenario, FA3 will be enabled, which may cause performance degradation.」

`--attention-backend FLASH_ATTN` 能活到 `get_attn_backend_cls`，是因为平台层特意给它开了口子：别的后端名都被重置成 `None`，唯独 `FLASH_ATTN` 不重置 [C7]。

`flash_attn_npu_v3` 不在 vllm-ascend 里，它来自单独的 `flash_attn_npu` wheel，安装入口写在文档里。也就是说这一页讲的算子不属于[算子与核函数](ops-and-kernels.md)那四层里的任何一层——它是仓库外的一个 Python 模块 [D]。

## 代价：文档说不支持图捕获，代码却只拦了一种模式

文档列的不支持项有七条：sliding window、RoPE、ALiBi、softcap、FP8 量化、MLA、SFA。代码里真的拦了的只有两条：sliding window 在 `AscendFAImpl.__init__` 抛 `ValueError`，MLA / SFA 在第三道闸抛。

图模式这条要当心。文档说「不支持 ACL graph capture，请用 `cudagraph_mode: PIECEWISE`」，但 `__init__` 里那道检查只在 `cudagraph_mode == CUDAGraphMode.FULL_DECODE_ONLY` 且没开 `enforce_eager` 时抛错 [C2]。上游 `CUDAGraphMode` 一共五个取值，`FULL` 和 `FULL_AND_PIECEWISE` 同样会捕整图 [C15]，这两种 FA3 一个字都没拦 [!]。各取值的含义见 [ACLGraph](acl-graph.md)。

硬件上文档要求 Atlas A2 / A3，测过的模型只有四个，都是 Qwen3。还有一处文档自相矛盾 [!]：开头的 note 说这个包已经在 GitHub 开源，Limitations 第一条却写着包还没开源、外部用户用不了；main 上这一条已经删掉 [S34]。

## 三个版本上「怎么开」不是同一件事

`fa3_v1.py` 在 v0.23 与 v0.26 上是同一个 blob，平台层那两处也一字不差 [C26]；差异全在 main：

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 开关 | `--attention-backend FLASH_ATTN` + `VLLM_BATCH_INVARIANT=1` | `--additional-config '{"rl_config":{"enabled":true,"enable_training_consistency":true}}'` [C29][S33] | [!] 照旧命令在 main 上开，`att_config.backend` 会被无条件清成 `None` [C30]，FA3 一次都选不中，而且不报错 |
| 判定入口 | `NPUPlatform._validate_fa3_backend`，只在显式选了 FLASH_ATTN 时才调 | 模块级函数，非 PCP 的每次选后端都调 [C28] | [!] main 上 MLA 模型一旦开了训推一致就直接 `ValueError`；v0.23 上不显式选压根碰不到 |
| 批不变模式 | 和 FA3 绑死，是第二道闸 | 拆开了，`rl_config.enable_batch_invariant` 单独管，由它去设 `VLLM_BATCH_INVARIANT` [C31] | 想要训推一致但不想付批不变那份开销，只有 main 做得到 |
| 与 PCP | 不检查 | `use_pcp` 为真就不走 FA3 | main 上 PCP 与 FA3 静默互斥 |
| `get_name()` | `"CUSTOM"`，V2 model runner 下是 `"FLASH_ATTN"` | 恒为 `"CUSTOM"` | 两版都和默认后端同名，靠名字分不出跑的是哪个 |

## 常见误解

- **「FA3 是 Flash Attention 的昇腾优化版，开了会更快」**——反了。官方在 Limitations 后面那条 note 里直说 may cause performance degradation，并写明这是为训推一致有意付的代价。
- **「写了 `--attention-backend FLASH_ATTN` 就是在跑 FA3」**——v0.23 / v0.26 上还差 `VLLM_BATCH_INVARIANT=1`，缺了只有一条 info；main 上这个参数整个不认。确认办法是去日志里找「FA3 will be enabled」那句，不是看后端名。
- **「CI 断言了 FA3 和 FIA 输出相等，说明两者数值一样」**——e2e 断的是贪心解码下 token id 相等，外加逐步比对 logprob [C24]，那是正确性检查，不是逐比特相同。FA3 存在的前提恰恰是 FIA 和训练侧的 Flash Attention 算得不一样。
