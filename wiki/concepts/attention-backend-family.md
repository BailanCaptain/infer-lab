---
id: attention-backend-family
title: 注意力后端家族
type: feature
summary: 一层注意力由哪份「后端」代码来算，有两条路定下来：全注意力层在启动时按三个开关查一张只有四项的表；线性注意力层不查表，层自己带着后端进场。贯穿例子 10 层查到普通后端、30 层自带 GDN 后端，一台机器上两个后端同时在岗。
aliases:
  [
    AscendAttentionBackend,
    AscendMLABackend,
    AscendSFABackend,
    AscendDSABackend,
    AscendFABackend,
    get_attn_backend_cls,
    注意力后端,
    AscendGDNAttentionBackend,
    AscendGatedDeltaNetAttention,
    GDN 后端,
  ]
chapters: ["04"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L841
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L844-L870
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L80-L118
  - vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L135-L177
  - vllm-ascend@2c59ff10:vllm_ascend/attention/dsa_v1.py#L191-L228
  - vllm-ascend@2c59ff10:vllm_ascend/attention/fa3_v1.py#L12-L14
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/indexer.py#L14-L54
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L83-L97
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/mla_v1.py#L234-L258
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L124-L156
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L563-L564
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L62-L64
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L138-L145
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L420-L420
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L267-L269
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn.py#L39-L65
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn_attn_builder.py#L933-L936
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L735-L762
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_qwen3_5.py#L197-L199
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/gdn.py#L64-L65
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L731-L731
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/patch_qwen3_5.py#L218-L218
  - vllm-ascend@baa023ad:vllm_ascend/ops/gdn.py#L261-L262
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L868-L868
  - vllm-ascend@baa023ad:vllm_ascend/patch/worker/patch_qwen3_5.py#L208-L208
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L240-L281
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: 这些后端都在实现同一套分页读 KV 的方案，原理与算子行为在那一页
  - to: npu-platform
    kind: builds-on
    note: 全注意力层选哪个后端不是后端自己决定的，是平台类的 get_attn_backend_cls 查表定的
  - to: one-request
    kind: builds-on
    note: 贯穿例子的 10 层全注意力走普通后端（KV 五维、算显存要乘 2），30 层线性注意力走 GDN 后端
  - to: linear-attention
    kind: builds-on
    note: 那 30 层为什么不留笔记、手里那份固定大小的状态是什么，原理在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

贯穿例子 Qwen3.6-35B-A3B 的 40 层里有两种注意力：10 层全注意力，30 层线性注意力。可机器上装的是同一份 vllm-ascend——它还得能跑 MLA 模型、稀疏注意力模型。那么真正开算的那一刻，每一层调的是哪套代码？

vLLM 把「替一层注意力干活的那套代码」叫**后端**。一层注意力怎么找到自己的后端，总共两条路：全注意力层的后端是**启动时替它查表查出来的**，线性注意力层的后端是**它自己带进场的**。这一页把两条路各走一遍。

## 全注意力层：启动时过三道闸，查一张只有四项的表

全注意力层自己不挑后端。启动时，平台替所有全注意力层做一次决定，依据是从模型配置推出来的三个开关：**是 MLA 吗？是稀疏注意力吗？是压缩注意力吗？**

决定的过程是三道闸：

1. **有人显式点名 FA3 吗？**这是一条给「训练和推理要用同一个算子」的场景准备的特殊路线，点了名还要过一道体检，体检不过就当没点。平时没人点它。
2. **是 310p 老硬件吗？**老硬件有自己的一张小表，表里查不到的组合会退回它的普通后端兜底。
3. **都不是，就拿三个开关去查主表。**主表只有四项：普通后端、MLA 后端、稀疏 MLA 后端、DSA 后端。查不到的组合**不会退而求其次，直接报错停下**——兜底只是老硬件小表的待遇。

贯穿例子是普通的分组查询注意力（GQA），三个开关全是「否」，查到的是主表里最普通的那一项：**普通后端**。10 层全注意力共用这一个。

```wiki-diagram
file: attention-backend-choice
```

## 线性注意力层：不查表，层自己带着后端进场

另外 30 层是线性注意力（具体结构是 GDN 一族）。这类层和上面那张表**完全无关**：vLLM 约定每一层都能报出「我的后端是谁」，全注意力层报的是启动时查表查来的那个，而线性注意力这类层的实现里**写死了配套的后端**，生下来就带着。

在昇腾上还多一步：插件把上游的 GDN 层实现换成了自己的版本，于是这 30 层报出来的是昇腾自家的 **GDN 后端**。换的办法有两种，一种走统一的算子替换表，一种是给 Qwen3.5/3.6 这一家的层类直接打补丁，落点是同一个后端。

为什么两条路？全注意力的算法长得都差不多，一张四项的表就能服务所有模型；线性注意力一族一个样，状态形状、算法各不相同，后端跟着层走，表里就不用为每一族添一行。

## 落到例子上：一台机器同时养着两个后端

- **10 层全注意力 → 普通后端。**记笔记（KV）的正是这 10 层：笔记是五维的，最前面那个 2 是 K 和 V，算显存必须乘上；每 token 每层每颗 1 KiB。这笔账单独成页：[四种注意力的代价](attention-cost.md)。
- **30 层线性注意力 → GDN 后端。**这 30 层不记笔记，各自只维护一份固定大小的状态，回答多长都不变。状态多大、放在哪，见[贯穿例子](one-request.md)。

还要知道一层：后端并不是最后干活的人。同一个后端在不同的并行开关下会换一副「干活的班子」（实现类）——排查算子行为要看班子，不能只看后端门牌。哪个开关换哪个班子，全貌在 [Context Parallel](context-parallel.md)。

## 常见误解

- **「后端按模型名选」**——按三个开关选，开关是从模型配置推出来的，和模型叫什么名字无关。
- **「查不到会回落到默认后端」**——只有 310p 那张小表有兜底；主表查不到直接报错。
- **「一台机器上只有一个注意力后端」**——混合模型是两个后端同时在岗，一个管 10 层，一个管 30 层。
- **「所有后端的笔记形状一样」**——普通后端五维、MLA 系四维，差一个维度；线性注意力那 30 层根本不写笔记。

## 对照源码

这一节给要去读选表代码、排查「为什么走了这个后端」的人。

### 怎么开

不用开，启动时自动定。但两条路的入口不同：

- **全注意力层**：类是 `NPUPlatform.get_attn_backend_cls` 查表返回的 [C1]。层实例只是把启动时定好的类交出来——上游 `Attention` 层的 `get_attn_backend()` 原样返回 `self.attn_backend` [C12]。主表全文：

| 后端 | 三元组 `(use_mla, use_sparse, use_compress)` | 服务对象 |
|---|---|---|
| `AscendAttentionBackend` | `(False, False, False)` | 普通 MHA / GQA 模型 |
| `AscendMLABackend` | `(True, False, False)` | MLA 模型 |
| `AscendSFABackend` | `(True, True, False)` | 稀疏 MLA |
| `AscendDSABackend` | `(True, False, True)` | DSA |
| `AscendFABackend` | 不走三元组，显式选 `FLASH_ATTN` + 过 `_validate_fa3_backend` 校验 | FA3 路径 |

  这个函数有个很容易读错的地方 [D]：开头先算了一个**二元** `key = (use_mla, use_sparse)`，但主表 `backend_map` 的键和最后一行的查表都是**三元组**；那个二元 `key` 只服务 310p 分支的 `backend_map_310` 和 `_validate_fa3_backend(key, ...)`。把两者混为一谈，就会得出「`use_compress` 不参与选择」这种错结论。310p 之外还有第六个可返回的类路径：`_310p/` 下的 `AscendAttentionBackend310`。

- **线性注意力层**：vLLM 约定每层实现 `get_attn_backend()`；上游 mamba 一族默认按 `mamba_type` 取 [C13]。Qwen3.6 走 qwen3_5 模型文件，线性层是 `QwenGatedDeltaNetAttention`、全注意力层是 `Qwen3NextAttention` [C14]，前者是上游 `GatedDeltaNetAttention` 的子类 [C15]，后者内部就是标准 `Attention` 层 [C16]（所以仍归上面那张表管）。昇腾侧两步接管：`REGISTERED_ASCEND_OPS` 把上游 `GatedDeltaNetAttention` 换成 `AscendGatedDeltaNetAttention` [C19]；qwen3_5 家族的子类不经过那张表，由 `patch_qwen3_5` 把 `get_attn_backend` 等方法直接钉到类上 [C20]。两条路的 `get_attn_backend` 都返回 `AscendGDNAttentionBackend` [C17]，它是上游 `GDNAttentionBackend` 的子类、只换了 metadata builder [C18]。

### 会报什么错

- 主表是直接下标访问，`(False, True, *)` 这类不合法组合直接 `KeyError`，不回落[D]。
- FA3 校验 `_validate_fa3_backend` 有三种结局 [C2]：不在训练推理一致性场景（`use_batch_invariant` 为假）只打一条 info 日志、当没选处理；选了 FA3 但模型是 MLA/SFA，`ValueError: FA3 backend does not support MLA and SFA.`；没装 `flash_attn_npu_v3` 或它缺 `flash_attn_with_kvcache`，也是 `ValueError`，报错文本写明装包。
- main 上多一个：开了 PCP 时走单独一张表，`get` 不到直接 `NotImplementedError`（`Ascend MRV2 PCP does not support attention backend ...`）[C27]。

### 开销和什么时候别开

选中哪个后端，决定的不只是调哪个算子，还决定每 token 的显存账：普通后端的 KV 是**五维**，最前面那个 2 是 K 和 V，算显存要乘 [C3]；MLA 系是**四维**，没有独立的 K/V，不能乘 [C4]。贯穿例子走普通后端，每 token 每层每颗 1 KiB、10 层合计 10 KiB，是四条路里最贵的一条；四种注意力各占多少字节见[四种注意力的代价](attention-cost.md)。GDN 后端管的 30 层不写 KV，只有固定状态，账在[贯穿例子](one-request.md)。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main（baa023ad） |
|---|---|---|---|
| 查表函数 | 基准 | 与 v0.23 一字不差 | 重写过：主表还是同四项，但 310p 表改叫 `compatibility_backend_map`、按硬件档案分流；新增 PCP 分支（同四项，查不到 `NotImplementedError`）；FA3 判断提前且要求没开 PCP |
| `attention/` 下的后端类计数 | 五个 | 六个：多出 `indexer.py` 的 `AscendSFAIndexerBackend`，但它不由查表选出，是 runner 给 SFA 的 indexer 缓存层单独挂的占位后端 [C8] | 没有逐个数过，别拿本页当 main 的后端总表 |
| 普通后端与 MLA 换实现类的开关 | `enable_cp()` → `AscendAttentionCPImpl` / `AscendMlaCPImpl` | `enable_dcp()` → `AscendAttentionDCPImpl` / `AscendMlaDCPImpl` [C9][C10]，照旧名去搜一个都搜不到 `[!]` | 未核 |
| SFA 换实现类的开关 | `enable_sfa_dcp_replicated_indexer()` 与 `enable_cp()` 两支 [C5] | 前一支留着，后一支换成 `sparse_kv_offload_config.enabled` → `AscendSFAKVOffloadImpl` [C11] | 未核 |
| DSA 换实现类的开关 | `enable_dsa_cp()` [C6] | 同 | 未核 |
| GDN 后端的挂接 | 层类返回 `AscendGDNAttentionBackend`；替换表；补丁 | 同机制，行号不同 [C21][C22][C23] | 同机制，行号不同 [C24][C25][C26] |

贯穿例子的模型形状（40 层、每 4 层 1 层全注意力）来自官方配置 [S28]。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 全注意力层的查表 | `vllm_ascend/platform.py`，`get_attn_backend_cls`（三个版本行号不同，v0.23 在 L815 起，main 在 L240 起） |
| FA3 的体检 | 同文件 `_validate_fa3_backend` |
| 层怎么报出自己的后端 | 上游 `vllm/model_executor/layers/attention/attention.py`（全注意力）；`vllm/model_executor/layers/mamba/abstract.py`（mamba 一族） |
| 例子模型的两种层 | 上游 `vllm/model_executor/models/qwen3_5.py`，`linear_attn` 与 `self_attn` |
| 昇腾的 GDN 层与后端 | `vllm_ascend/ops/gdn.py`、`vllm_ascend/ops/gdn_attn_builder.py` |
| 昇腾怎么换掉上游 GDN 层 | `vllm_ascend/utils.py` 的 `REGISTERED_ASCEND_OPS`；`vllm_ascend/patch/worker/patch_qwen3_5.py` |
| 各后端的 KV 形状 | `vllm_ascend/attention/` 下各 `*_v1.py` 的 `get_kv_cache_shape` |
