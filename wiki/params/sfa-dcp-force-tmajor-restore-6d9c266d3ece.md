---
id: sfa-dcp-force-tmajor-restore-6d9c266d3ece
title: sfa_dcp_force_tmajor_restore
type: param
summary: >-
  DCP 解码路径上 query all-gather 之后，把布局还原从零拷贝的 strided view 改回真的物化一份 t-major
  连续存储——上游为对照实验留的回退开关，默认 false 走优化后的零拷贝路径。只在 main 开发主线上有。
origin: seed
aliases:
  - SFA DCP t-major 还原
  - 强制 t-major 连续化
  - DCP query gather 布局回退
chapters:
  - '15'
verified:
  - main
evidence: C
updated: '2026-09-21'
relations:
  - to: context-parallel
    kind: builds-on
    note: 只有 decode_context_parallel_size > 1 且模型走 SFA 稀疏注意力时才有实现类读它，DCP 怎么切 KV 在那一页
  - to: attention-backend-family
    kind: builds-on
    note: 读它的是 SFA 后端的 DCP 子类 AscendSFADCPImpl，后端怎么按 (use_mla, use_sparse, use_compress) 选出来在那一页
  - to: ascend-config-system
    kind: builds-on
    note: 与同批的 enable_dsa_cp 不同，这个读取函数没有 lru_cache，每次走到都现读一次配置单例
contradicts: []
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/ascend_config.py#L465
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L466
  - 'vllm-ascend@b255ab59:vllm_ascend/utils.py#L1436-L1442'
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1424-L1434
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1145-L1157
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1264-L1305
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1362-L1408
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1307-L1320
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1159-L1172
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L375-L399
  - 'vllm-ascend@b255ab59:vllm_ascend/attention/sfa_v1.py#L1454-L1456'
  - >-
    vllm-ascend@b255ab59:vllm_ascend/attention/context_parallel/sfa_cp.py#L1571-L1586
  - 'vllm-ascend@b255ab59:vllm_ascend/utils.py#L144-L151'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L316-L334'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L454'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
rawSources:
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

这是一个**回退开关**，不是一个特性开关。DCP 解码时各卡要先把 query all-gather 到一起，为了通信效率 gather 出来的是 head-major 布局，用完得转回 t-major。转回的方式有两种：`permute` 出一个零拷贝的 strided view（默认），或者再跟一次 `.contiguous()` 真把 `[T, H, D]` 的连续存储物化出来。这个键为真就选后者 [C5]。

**默认 `false` 走的是优化后的那条路。** 引入它的 PR 标题写得很直白——「Optimize the DCP decode query-gather layout path」；代码注释也说，交给 `npu_sparse_flash_attention` 的那几段 query 一直都是 strided view（`torch.split` 从不拷贝），旧写法的 `permute + contiguous` 只是顺带把 t-major 存储物化了一遍，而这个键**把那次物化保留成可选项，供对照实验用** [C4]。

**存在范围。** 只在 main 开发主线上有，2026-09-16 由 PR [#15970](https://github.com/vllm-project/vllm-ascend/pull/15970) 引入（见下面「版本谱系」）；v0.23 维护分支与 v0.26 分支（2026-09-17 的源码快照）上这个键、`enable_sfa_dcp_force_tmajor_restore` 这个函数、以及配套的 `ops/triton/query_gather_prep.py` 都不存在。那两个分支的 `AscendConfig` 逐键 `.get()`，配了静默忽略 [C16] [C17]；main 是 `extra="forbid"` 的 pydantic 模型，拼错就起不来 [C15]。

[那条请求](../concepts/one-request.md)用不到它：Qwen3-0.6B 单卡，`decode_context_parallel_size` 是 1，也不是 SFA 稀疏模型，`resolve_sfa_impl` 选的是不带 CP 的 `AscendSFAImpl` [C12]。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / 默认 | `bool` / `False` | 默认即「不物化」，也就是 PR 优化后的行为 |
| 唯一消费点 | `AscendSFADCPImpl._execute_sparse_flash_attention_process` 里的 `keep_view=not enable_sfa_dcp_force_tmajor_restore()` [C4] | 全仓库只有这一处读它，没有第二条路径 |
| 生效前提 | 模型走 SFA 稀疏注意力 **且** `decode_context_parallel_size > 1` [C13] | 两条缺一条，`resolve_sfa_impl` 就不会选到带 DCP 的实现类 |
| 只影响哪一趟 | 批次里**没有** prefill 的那一趟 [C7] | 有 prefill 时走的是 KV-gather 分支、提前 `return`，那条分支自己写死 `.contiguous()`，与本键无关 [!] |
| 开了多做什么 | 一次 `.contiguous()`，物化 `[T, H, D]` 连续存储 [C5] | 多一次设备端整张 query 的拷贝：`num_tokens × dcp_size × num_heads × (head_dim + rope_dim)` 个元素 [D] |
| 关了少做什么 | `permute` 之后直接 `torch.split`，全程零拷贝 | 算子拿到的是非连续张量——这正是需要留一个回退开关的原因 |
| 同时开了 DSA-CP | 本键**失效** [D] | DSA-CP 的 query gather 维是 0，`restore_perm` 为 `None`，`permute` / `contiguous` 整段被跳过 [C9] [!] |
| 读取方式 | 没有 `lru_cache`，每次走到现读一次配置单例 [C3] | 同批的 `enable_dsa_cp`、`enable_pcp_o_proj_weight_sharding` 都带 `lru_cache(maxsize=1)`，这个没有 |
| 官方文档 | 参数表里没有这一行 | 唯一的官方痕迹是 `AscendConfig` 文档字符串那份样例 dict [C14]；没有 feature guide |

## 为什么存在

DCP 把 KV cache 沿序列维交错分给 TP 组里的各张卡，解码时每张卡只有一部分 KV，所以 query 得先 all-gather 起来，各卡算各自那一段 KV 的注意力，最后按 LSE 合并。这次 all-gather 的**布局**是有讲究的：`all_gather` 只能在 dim 0 上拼，而要 gather 的是 head 维（dim 1），所以代码先 `permute` 成 head-major 再发，收回来再 `permute` 回去。

热路径上还有一步单独的准备：`_start_dcp_query_gather` 优先调一个 Triton kernel `prep_query_head_major`，把 `ql_nope` 和 `q_pe` 一次拼成 head-major——一是省掉两次背靠背的 all-gather（昇腾上分开发会让 SFA 在第一次 prefill 时拿到不完整的流依赖），二是把 cat + permute + contiguous 折进一个 kernel。kernel 判定形状不合法就返回 `None`，退回纯 torch 的拼装 [C6]。

收回来之后的那一步就是本键管的地方：

```python
gathered = context.gathered
if context.restore_perm is not None:
    gathered = gathered.permute(context.restore_perm)
    if not keep_view:
        gathered = gathered.contiguous()   # ← 本键为真时走这里
return torch.split(gathered, context.split_sizes, dim=-1)
```

`permute` 本身零成本，贵的是 `.contiguous()`。上游的判断是：既然 `torch.split` 切出来的本来就是 strided view、算子也一直在吃 strided view，那这次物化就是白花的一次拷贝。删掉它是性能优化；留一个开关是因为「算子对非连续输入的表现」这件事不好一次断定，出问题时得有条路退回去对照。

## 开了的代价

**一次整张 query 的设备拷贝，每个解码步、每层。** 拷贝量是 gather 之后的 query：`num_tokens × dcp_size × num_heads × (head_dim + rope_dim)` 个元素 [D]。这是纯开销——功能上两条路等价，只差布局是不是连续。**正常部署不要开它**，它的用途是拿到一组可对比的数据，或者在怀疑非连续输入触发算子问题时二分。

**批次里只要有 prefill，这个键就不起作用。** `_execute_sparse_flash_attention_process` 先判 `_has_prefill`：有就走「gather 完整 KV、query 留本地」那条分支并直接 `return`，本键所在的那几行根本到不了 [C7]。连 query gather context 的记录都带着同一个判断 [C8]。所以在 chunked prefill 常开的部署里，它只在纯解码的那些步上有效 [!]。

**开了 DSA-CP 它就彻底没意义。** DSA-CP 切的是 token（gather 维 0），`_all_gather_dim_async` 在 `dim == 0` 这一支直接返回 `restore_perm=None` [C9]；而 `restore_perm` 为 `None` 时 `permute` 和 `contiguous` 两句一起被跳过 [C5]。`AscendSFADSADCPImpl` 按 MRO 拿到的 `_parallel_query_gather_dim` 是 `AscendSFADSACPImpl` 那个返回 0 的版本 [C10]，不是基类返回 1 的版本 [C11]——这一步是顺着继承链推的，不是源码里写死的一句话 [D]。结论：`enable_dsa_cp: true` 时配这个键完全不产生任何行为差异，也没有告警 [!]。名字里的 `dcp` 指的是 decode context parallel，不是 DSA-CP——这两个键不是一套，别当成要一起配的。

**没有 `lru_cache`，但也别指望能热改。** 读取函数每次调用都现读 `get_ascend_config()`，而那个配置是进程内单例、启动后不再变，所以实际效果仍是启动期常量；区别只在于它比同批的两个兄弟多花一次字典查找，量级可以忽略。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-09-16 · 8f26bb734759e79f3186cc0efbca6d9cb1b594ee · PR [#15970](https://github.com/vllm-project/vllm-ascend/pull/15970) —— [Performance] Optimize the DCP decode query-gather layout path (#15970)
  包含该提交的 tag：未找到；分支：origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc
  - `vllm_ascend/attention/context_parallel/sfa_cp.py` +34 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）
  - `vllm_ascend/ops/triton/query_gather_prep.py` +193 / −0（文本行变化）
  - `vllm_ascend/utils.py` +9 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sfa_dcp_force_tmajor_restore"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:466` [C2] |
| 版本 | main · c173a64a44dec4ba97aaba6277b1dfc1562eda19 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
