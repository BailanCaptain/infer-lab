# F001 试点批人审报告（2026-09-07）

第一批 ingest：`wiki/seeds/vllm-ascend.yaml` 的 11 个 11 章 KV Cache 特性，来源仓库 `vllm-ascend@28bf3a2e`，模型用本机 claude 默认模型，并发 3。

命令：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --phase extract`

## 结果一览

| 项 | 数 |
|---|---|
| 提交的 feature | 11 |
| 产出合格草稿 | 8 |
| 失败 | 3 |
| 来源引用总数 | 116 |
| 行号有效 | 116 |
| 引用文件不存在 | 0 |
| `raw/` 缺对应片段 | 0 |
| 越界写入 | 0 |
| CLI 报告花费 | $17.32 |

产出：`wiki/_drafts/` 8 页（6.7 到 9.4 KB），`wiki/raw/` 9 份摘录（13 到 30 KB）。

8 页分别是 PagedAttention、Block Table、KV Cache Spec、KV Cache Memory Profiling、Prefix Caching、KV Pool、KV Cache CPU Offload、Recompute CPU Offload。

## 三个失败的原因

不是代码问题，也不是 agent 写不出来。三个 session 的本地记录（`~/.claude/projects/…-llm-wiki-wiki/<session>.jsonl`）末尾都是同一句：

```
You've hit your session limit ⋅ resets 4:10am
```

用量到顶被 CLI 中断，进程退 1，stderr 为空。`kv-cache-layerwise-offload` 已经写完 30 KB 的 `raw/`，正要写页面时被切断。三个都记进了 `wiki/_drafts/_failures.json`，重置后 `pnpm wiki:ingest --seeds … --retry-failed` 即可续跑，不用重来。

## 自动核对（`pnpm wiki:audit --drafts`）

新加的 `scripts/wiki-audit.ts` 把每条 `repo@commit:path#L起-L止` 拿到本地钉住的仓库里核对：文件是否存在、行号是否落在文件范围内、`raw/<id>.md` 里有没有引用同一个源文件。

116 条来源全部通过，没有一条编造路径或越界行号。

## 人工抽检三页

自动核对只证明「行号存在」。下面逐条读源码，验证「那几行确实讲了页面声称的事」。

### PagedAttention

| 页面论断 | 源码 | 核对结果 |
|---|---|---|
| KV Cache 形状 `(2, num_blocks, block_size, num_kv_heads, head_size)` | `attention_v1.py#L113-L121` | 属实，`get_kv_cache_shape` 原样返回这个元组 |
| 后端只支持 `block_size = 128` | `attention_v1.py#L151-L153` | 属实，`get_supported_kernel_block_sizes` 返回 `[128]` |
| `pa_shape_list` 默认空，所以 PA 默认不启用 | `ascend_config.py#L378-L383` | 属实，`dataclasses.field(default_factory=list)` |
| `using_paged_attention` 的完整条件链 | `attention/utils.py#L206-L222` | 属实，投机解码、A5 设备、cudagraph 模式、`runtime_shape in pa_shape_list` 四条以及大 head 提前返回 True，页面一条不漏 |
| 走 PA 需三条同时成立 | `attention_v1.py#L1660-L1681` | 属实，`forward_impl` 的 if 就是这三条，否则走 FIA |

这页最有价值的一点是它没有照抄「PagedAttention 是 vLLM 的核心机制」的通识，而是指出在昇腾后端 PA 只是个默认关闭的调优分支，默认读取走 FIA，并给出了开关位置。

### Block Table

| 页面论断 | 源码 | 核对结果 |
|---|---|---|
| 两个缓冲区都是 int32 的 `CpuGpuBuffer`，`slot_mapping` 额外留 MTP 草稿位 | `block_table.py#L87-L95` | 属实，逐字对应 |
| 列数 `= cdiv(max_model_len, block_size × dcp_world_size)` | `block_table.py#L347-L353` | 属实，含 DCP 要乘 world size 的注释 |

槽位公式与 `slot = 3 × 128 + 2 = 386` 的算例自洽，与 `reshape_and_cache` 的写入路径对得上。

### KV Cache Spec

| 页面论断 | 源码 | 核对结果 |
|---|---|---|
| `block_size` 为空时置 128 | `utils.py#L1171-L1179` | 属实 |
| 每 token 每层 KV 字节公式 | `sparse_kv_offload_manager.py#L608-L619` | 代码属实，但见下方问题 2 |

数值独立复核：页面给出 Qwen3-0.6B 每 token 每层 4 KiB、全 28 层 112 KiB。用本仓库自带且有 golden 测试的 `src/sim/modelspec/analyze.ts` 独立算得每 token 每层 **4096 B**，完全一致。PagedAttention 页从块体积那条路算出的每 token 112 KiB 也与之吻合，两页互相印证。

## 发现的问题

**问题 1：`updated` 日期差一天（已修）**。引擎用 `toISOString()` 取日期，那是 UTC，东八区凌晨跑批会把 `updated` 写成前一天，8 页全部写成 `2026-09-06`。已加 `localDate()` 并配测试，`scripts/wiki-ingest.ts` 改用它。已产出的 8 页在整合阶段由整合 agent 按规则改写为当天。

**问题 2：从特例推广的公式仍标 C**。KV Cache Spec 页引用的 `sparse_kv_offload_manager.py` 那段紧邻一行 `assert kv_head_num == 1, "Sparse KV offload only support sfa(mla)"`，即该处只对 MLA 成立。页面把它推广成 MHA/GQA 通用的 `2 × num_kv_heads × head_size × dtype`，推导本身正确，结论也和本仓库独立计算一致，但按 PLAN §1.4 的等级定义，从特例外推属于 `D`（由公式推导）而非 `C`（钉住 commit 的源码行为）。

建议在 HANDBOOK 的「提取」切片补一条：引用的代码若带前提断言或只覆盖部分情形，而页面把结论推广到更广的范围，该结论必须标 `D` 并写明推广的依据。

**观察（正面）**：Prefix Caching 页自己把 `evidence` 降到了 `I`，理由是核心实现在上游 vLLM、昇腾侧只做适配和 patch。这正是 HANDBOOK 要求的行为，说明规则被读懂了。

## 花费与放量影响

$17.32 产出 8 页，约合 **每页 2.2 美元**。这是 CLI 报告的等值口径；实际消耗的是订阅额度，一批 11 个就打满了一个会话窗口。

按此推算，Phase 2 的 120 到 160 页需要约 260 到 350 美元等值，并且会跨多个会话窗口，无法一次跑完。原计划里「分章跑、每章跑完人抽查」的节奏正好适配这个限制，但总量需要用户重新确认。

可选的降本方向，按推荐次序：

1. **第二步改用 sonnet**，试点已证明规则可执行，特性页的信息密度主要来自读源码而非推理。
2. **收窄 `ask`**，本批平均每个 agent 20 到 30 次工具调用，其中不少是自由探索；把 `entry` 指到更准的定义处能省一截。
3. **降低每页来源条数上限**，本批平均 14.5 条，KV Pool 一页 15 条；10 条足够支撑一页。

## 结论与建议

八页在事实准确性上达标：116 条来源零编造，深度抽检的 9 条关键论断全部属实，数值与本仓库独立计算一致，写法符合 HANDBOOK 的四节结构，`related` 交叉引用也建起来了。质量层面**建议通过**。

进入下一步前需要用户拍两件事：

1. 是否接受每页约 2.2 美元的成本，或者第二步换 sonnet。
2. 是否采纳上面问题 2 的 HANDBOOK 补充规则（推广结论降级到 `D`）。

技术上待办：等 4:10 额度重置后 `--retry-failed` 补跑 3 页，再跑整合阶段，然后 `pnpm wiki:build` 与 `pnpm wiki:lint` 收尾。
