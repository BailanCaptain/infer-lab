---
id: kv-cache-spec
title: "KV Cache Spec：每层自己报价，引擎才算得出能分几块"
type: feature
summary: 每个注意力层向引擎报一份规格——块大小、KV 头数、头维、dtype。引擎只从里面取「一块多少字节」这一个数去做除法，块数算完再发回 Worker 分配。
aliases: [KV Cache Spec, KV 缓存规格, KV Cache 规格, KV Cache 声明, KVCacheSpec, 按层 KV 规格声明]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L1088-L1107
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L891-L892
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5556-L5700
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4946
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5645-L5671
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5005-L5011
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5702-L5715
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L106-L116
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L146-L148
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L176-L176
  - vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L1122-L1138
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4241-L4278
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3843-L3865
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4337-L4382
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4791-L4828
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4846-L4864
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4212-L4232
  - vllm-ascend@b255ab59:vllm_ascend/utils.py#L1516-L1518
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4422-L4441
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5225-L5269
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5143-L5153
  - vllm-ascend@b255ab59:vllm_ascend/core/kv_cache_interface.py#L112-L133
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L66-L121
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L167-L200
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4447-L4468
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L907-L918
  - vllm-ascend@b255ab59:vllm_ascend/core/kv_cache_interface.py#L32-L46
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
verified: ["main", "releases/v0.23.0"]
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: spec 里的 block_size 与 page_size_bytes 说的就是分页方案里的那一页，一页装多少 token、一页多少字节
  - to: kv-cache
    kind: builds-on
    note: spec 描述的是「缓存的一块长什么样、多大」；缓存本身为什么存在、存的是什么，在那一页
contradicts: []
updated: "2026-09-20"
---

## 一句话

`get_kv_cache_spec()` 走一遍模型里的每个注意力层，为每层产出一份 `KVCacheSpec`：块大小、KV 头数、头维、dtype。**引擎只从里面取一个数——「一块多少字节」**，拿显存探测剩下的字节去除它，得到能分几块；块数发回 Worker，`initialize_kv_cache()` 才照它把显存真正切成张量。**声明和分配是分开的两趟，中间隔着一次显存探测**——顺序倒不过来，分配之前必须先知道单价。

```wiki-diagram
file: kv-cache-spec
```

## 那条请求走到这里

[那条请求](one-request.md)跑的是 Qwen3-0.6B：28 层，`n_kv = 8`，`d_h = 128`，KV 用 bf16。`block_size` 是 128——命令行没写时由配置检查里的 `refresh_block_size` 填上 [C30]；昇腾 GQA 后端报的 kernel 块大小也是 128 [C10]，官方文档写别的参数时同样直接拿 `block_size=128` 当前提 [S12]。

稠密 GQA 层的 spec 是上游造的，vllm-ascend 不接管，所以「一块多少字节」的式子就摆在上游 `AttentionSpec.real_page_size_bytes` 里，不用自己推 [C26]。式子开头那个 2 是「K 一份、V 一份」，**它只活在 `get_kv_cache_shape()` 的返回值里**——真落到显存上，K 和 V 是两次各自独立的申请：

```
page_size_bytes = 2 × block_size × n_kv × d_h × sizeof(bf16)
                = 2 × 128 × 8 × 128 × 2
                = 524,288 字节 = 512 KiB
```

| 要的数 | 怎么来 | 结果 |
|---|---|---|
| 一层一块多少字节 | 上面那行 | 512 KiB |
| 一层每 token 多少字节 | 524,288 ÷ 128 | 4 KiB [D] |
| 全模型每 token 多少字节 | 4 KiB × 28 层 | 112 KiB [D] |
| 每层分到 1 GiB 能装几块 | 1,073,741,824 ÷ 524,288 | 2,048 块 = 262,144 token [A] |

## 为什么是按层报，不是按模型报

因为同一个模型里的层根本不一定长得一样，`get_kv_cache_spec()` 的分发逻辑里留着四处痕迹 [C3]：

- **跨层 KV 共享的层压根不报。** 它们被记进 `shared_kv_cache_layers` 之后直接 `continue`，不产生 spec，也就不占块——省下的显存正是从这儿来的。
- **一个模型里能混好几类。** Attention（GQA）、MLAAttention、MambaBase、draft model 的 cache-only 层各走各的分支，形状算法完全不同。只有 MLA 这一支被昇腾接管：vllm-ascend 用自己的 `AscendMLAAttentionSpec` 重建一遍，因为昇腾的 nope/rope 拆法和上游不同。
- **Mamba 混合模型要事后对齐。** 所有 spec 收齐之后，注意力层的 `page_size_padded` 会被顶到 Mamba 页的大小，两类层才能共用一套块编号 [C7]。这一步必须等全部层报完才做得了，这本身就是「按层报」的直接后果。
- **量化和 offload 改的就是 spec 里的字段。** dtype、head_size、`store_on_host` 都在这里定死（见 [KV Cache 量化](kv-cache-quantization.md)、[稀疏 KV Offload](kv-cache-sparse-offload.md)）——改在 spec 上，就等于改在了显存账本上。

## 分配趟其实只干三件事

入口是 `NPUWorker.initialize_from_config()`，引擎把探测好的 `KVCacheConfig` 递进来。`initialize_kv_cache()` 先改写 config（补 encoder-only 层、补 KV 共享层）、选注意力后端、按各组 block_size 重建[块表](block-table.md)，然后才进 `initialize_kv_cache_tensors()`——这个函数本身只做三件事：申请原始 buffer、view 成目标形状、把 KV 共享层的指针指到目标层上。中间有个容易看漏的动作：`_reshape_kv_cache_tensors()` **先拿「K 字节 + V 字节」除以 `page_size_bytes` 把块数反推回来，再断言它不小于调度器那边的 `kv_cache_config.num_blocks`** [C23]。多卡时每张卡的层数和显存可能不同，`kv_cache_config.num_blocks` 取的是全场最小值，这句断言就是让每张卡自己复核一遍：我手上的块，够不够调度器打算发出去的那么多。

## 一层的 KV 是两条张量，不是一块

昇腾和上游最大的不同不在声明趟，在分配趟。上游把一层的 KV 申请成一整块 `(2, num_blocks, ...)`；vllm-ascend 拆成 K、V 两条独立张量分别 `torch.zeros`，理由就写在注释里——PD 分离（prefill/decode 分离）的传输侧只接受首维是 `num_blocks` 的张量，带着前缀 2 的形状过不去 [C17]。

稠密层走的是这么一条路：

1. `_get_attention_kv_cache_dims()` 取出 K 维和 V 维，GQA 下两者都等于 `head_size`；
2. `calc_split_factor([k_dim, v_dim])` 返回 `[total/k_dim, total/v_dim]`，GQA 下就是 `[2.0, 2.0]` [C20]；
3. 这一层的字节预算被这两个因子各除一次，K 和 V 恰好各占一半；
4. 两条张量各自 `torch.zeros(..., dtype=torch.int8)`——**不管 spec 声明的是 bf16 还是 fp16，申请阶段一律按原始字节走**；配了 `kv_transfer_config` 时还会多申请 2 MiB 把首地址对齐 [C27]；
5. dtype 要到 reshape 才用上：`raw_k_tensor.view(dtype).view(k_shape)`，而 `k_shape` 就是 `get_kv_cache_shape()` 的返回值砍掉首维 [C22]。

**这解释了为什么 KV 量化能直接换成显存**：字节数是从 spec 算出来的，不是张量类型带出来的。main 上还多一条纪律——同一条 `KVCacheTensor` 里的每一层各拿一对私有的 `(k_tensor, v_tensor)`，块下标从此不可能在层与层之间撞上 [C18]。

## 两个分支在哪儿分的叉

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 一层的字节预算 | 引擎给的 `KVCacheTensor.size` 除以切分因子 [C19] | 自己算 `num_blocks × page_size_bytes` [C17] | main 上一条 `KVCacheTensor` 描述的是整组层，再按 size 平分就会算错 `[!]` |
| sleep mode 的 KV 池边界 | 包住整个 `initialize_kv_cache` [C28] | 只包住原始 buffer 的申请 [C13] | 睡一觉醒来，块表和后端这些元数据不会跟着被丢掉 |
| GQA 块张量布局 | 固定 `(2, num_blocks, block_size, num_kv_heads, head_size)` [C9] | `VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时换成 `(2, num_blocks, num_kv_heads, block_size, head_size)` [C8] | 字节数一个不差，但块内的轴序变了 `[!]` |
| MLA 的页字节 | 覆写 `page_size_bytes` [C25] | 改叫 `real_page_size_bytes`，物理块大小统一走 `get_storage_block_size()` [C24] | 按属性名取 MLA 页大小的脚本跨版本会读到不同的值 `[!]` |
| SFA indexer | 跳过该层，k_cache 由 `IndexerWrapper` 顶替 [C6] | 独立的 `AscendSFAIndexerCacheSpec`，走自己的物理张量 [C5] | main 上 indexer 是一等公民，v0.23 上它和 MLA 主缓存共用一次分配 |

前两行稠密 GQA 也吃得到，后三行都在 MLA / SFA 那一侧。

## 常见误解

- **「一层的 KV 是一块 `(2, num_blocks, ...)` 的连续显存。」** 在昇腾上不是。K 和 V 是两次独立的 `torch.zeros`，地址之间没有任何关系；首维那个 2 在 reshape 时就被 `kv_cache_shape[1:]` 切掉了 [C22]。
- **「spec 声明 bf16，申请的就是 bf16 张量。」** 申请阶段一律 `torch.int8`，spec 的 dtype 只在 reshape 时用来 `.view(dtype)`。
- **「spec 里的 `block_size` 就是算子看到的块大小。」** 稠密 GQA 上成立，MLA 上不成立：main 里算子用的物理块大小是 `block_size // tokens_per_state`，调度器用的才是 `block_size` [C29]。
