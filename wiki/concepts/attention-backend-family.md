---
id: attention-backend-family
title: 注意力后端家族
type: feature
summary: attention/ 下五个后端类，其中四个按 (use_mla, use_sparse, use_compress) 三元组查表选出，FA3 那个靠显式指定；普通后端的 KV 形状是五维，MLA 系是四维。
aliases: [AscendAttentionBackend, AscendMLABackend, AscendSFABackend, AscendDSABackend, AscendFABackend, get_attn_backend_cls, 注意力后端]
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
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: 五个后端都在实现同一套分页读 KV 的方案，原理与算子行为在那一页
  - to: npu-platform
    kind: builds-on
    note: 选哪个后端不是后端自己决定的，是平台类的 get_attn_backend_cls 查表定的
  - to: one-request
    kind: builds-on
    note: 那条请求走最左边那个后端，它的 KV 形状是五维的，算显存要乘 2
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

`vllm_ascend/attention/` 下有五个后端类，都继承上游 `AttentionBackend`。选哪一个由 `NPUPlatform.get_attn_backend_cls` 在启动时查表定下 [C1]，后端自己不参与选择。这个函数实际能返回六个类路径：多出来的那个是 310p 专用的 `AscendAttentionBackend310`，它在 `_310p/` 下，不在 `attention/` 里 [C1]。

```wiki-diagram
file: attention-backend-choice
```

## 那条请求走到这里

Qwen3-0.6B 是普通的 GQA 模型，三个布尔量全是 `False`，所以三元组查表查到的是最左边那个：**`AscendAttentionBackend`**。

查中哪一个，决定的不只是调哪个算子，还决定这条请求每个 token 要占多少字节——它走的恰好是四条里最贵的一条。那笔账单独成页：[四种注意力的代价](attention-cost.md)。

## 查表用的是三元组，不是二元组

这个函数里有个很容易读错的地方 [D]。开头先算了一个二元 `key`：

```python
key = (attn_selector_config.use_mla, attn_selector_config.use_sparse)
```

但主表 `backend_map` 的键是**三元组**，最后一行的查表也是三元组：

```python
return backend_map[(attn_selector_config.use_mla, attn_selector_config.use_sparse, use_compress)]
```

那个二元 `key` 只服务两处：310p 分支的 `backend_map_310`，以及 `_validate_fa3_backend(key, ...)` [C1]。把两者混为一谈，就会得出「`use_compress` 不参与选择」这种错结论 [D]。

选择顺序是 [D]：先判 FA3（显式选了 `AttentionBackendEnum.FLASH_ATTN` 且通过 `_validate_fa3_backend` 校验就返回 `AscendFABackend`）→ 再判 `is_310p()`（走另一张表，且 `get` 不到就回落到 `(False, False)` 那一项）→ 否则三元组查主表 [C1]。

## 五个后端各服务什么

| 后端 | 三元组 `(use_mla, use_sparse, use_compress)` | 服务对象 |
|---|---|---|
| `AscendAttentionBackend` | `(False, False, False)` | 普通 MHA / GQA 模型 |
| `AscendMLABackend` | `(True, False, False)` | MLA 模型 |
| `AscendSFABackend` | `(True, True, False)` | 稀疏 MLA |
| `AscendDSABackend` | `(True, False, True)` | DSA |
| `AscendFABackend` | 不走三元组，显式选 + 校验 | FA3 路径 |

三元组取值与前四个类路径来自主表那一段，`AscendFABackend` 的类路径写在主表上面的 FA3 分支里 [C1]。主表只有这四项，所以 `(False, True, *)` 这类组合会直接 `KeyError`，不是回落到默认后端 [D]。

## 同一个后端里还会按并行度换实现

`get_impl_cls` 不是固定返回一个类。那条请求走的普通后端也会换：`enable_cp()` 为真时返回 `AscendAttentionCPImpl` [C3]。MLA 在 `enable_cp()` 为真时返回 `AscendMlaCPImpl` [C4]，SFA 在 `enable_sfa_dcp_replicated_indexer()` 为真时返回 `AscendSFADCPImpl` [C5]，DSA 在 `enable_dsa_cp()` 为真时返回 `AscendDSACPImpl` [C6]。所以「后端类」和「实际跑的 impl 类」是两层，排查算子行为要看第二层 [D]。

## 常见误解

- **「后端按模型名选」**——按 `use_mla` / `use_sparse` / `use_compress` 三个布尔量选 [C1]，这三个是从模型配置推出来的，不是模型名。
- **「选不到会回落到默认后端」**——只有 310p 那张表有 `get` 带默认值的回落 [C1]；主表是直接下标访问，不合法的组合会 `KeyError`。
- **「所有后端的 KV 形状一样，只是 head_size 不同」**——差一个维度：普通后端五维、MLA 系四维 [C3][C4]。每种各占多少字节见 [四种注意力的代价](attention-cost.md)。
