---
id: kv-cache-layerwise-offload
title: "Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer"
type: feature
summary: 把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」，搬运与下一层计算重叠；main 上还能让多层轮流用同一份 HBM buffer，把 Prefill 侧的 KV 显存压成常数份。
aliases: [逐层 KV 卸载, 逐层 KV 传输, Layerwise KV Cache Offload, Layerwise KV Cache Offloading, Layerwise KV Pool, Layerwise Prefill Offload]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/kv_pool.md#L26-L36
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L75-L84
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/layerwise_kv_pool.html
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L145-L209
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L271-L282
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html
  - vllm-ascend@b255ab59:vllm_ascend/attention/utils.py#L491-L519
  - vllm-ascend@b255ab59:vllm_ascend/attention/mla_v1.py#L2045-L2048
  - vllm-ascend@b255ab59:vllm_ascend/attention/mla_v1.py#L2164-L2168
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1728-L1736
  - vllm-ascend@b255ab59:vllm_ascend/ops/gdn.py#L363-L369
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L27-L61
  - vllm-ascend@2c59ff10:vllm_ascend/memcache_comm_fence.py#L27-L61
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L93-L99
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L267-L282
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L243
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L57
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L199-L214
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L294-L299
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L509-L548
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2296-L2323
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2325-L2358
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2366-L2401
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1356-L1399
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1407-L1430
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1779-L1793
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2031-L2043
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2004-L2016
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L297-L381
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4254-L4263
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1556-L1560
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1826-L1830
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L86-L91
evidence: "C"
relations:
  - to: kv-pool
    kind: variant-of
    note: layerwise 是 AscendStore KV Pool 的一种传输模式，池的后端选型、key 组织、P/D 角色都在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 共享 buffer 只能合并 KVCacheSpec 完全相同的层，spec 决定了哪些层可以共用一份 HBM
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: main 上开启层复用后，探测出的 KV 预算要再乘「层数 ÷ 缓冲区个数」，返回值不再等于主公式
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样把 KV 挪出 HBM，但那边按请求整块搬到本机主存做前缀备份，这边按层搬进跨节点的 memcache 池
contradicts: []
updated: "2026-09-20"
---

## 一句话

Layerwise KV Offload 把 KV 的存取粒度从「一次请求」降到「一层」：第 *i* 层算完立刻把它的 KV 发往 KV 池，第 *i+1* 层的计算与这次搬运并行；加载同理，算第 *i* 层之前只等第 *i* 层的 KV 到位。开关是 `AscendStoreConnector` 的 `use_layerwise`，默认关 [S1]。main 在此之上多做一件事：**让多层轮流复用同一份 HBM buffer**，把 Prefill 侧的 KV 显存压成常数份——v0.23 维护分支没有这一层 [!]。下面 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`。

```wiki-diagram
file: kv-cache-layerwise-offload
```

## 那条请求用不到它

[那条请求](one-request.md)单卡跑 Qwen3-0.6B，压根没有 KV 池，那两个挂钩点在 `has_kv_transfer_group()` 那一行就返回了。就算硬给它配上 `use_layerwise: true` 也没用：Qwen3 这类普通 GQA 模型走 `attention_v1.py`，那个文件只调了 `record_attention_compute_start()`，没有 wait / save 这对调用——**开关生效在 connector 层，但没有人去调它** [C11]。

要走到这一页，设定得换成官方那一套：专职 Prefill 节点、`kv_role: "kv_producer"`、memcache 后端、MLA / SFA / DSA 注意力后端、eager 执行 [S5]。也就是说它是 **P/D 分离里 P 那一侧**的特性；D 那一侧的对应物是[稀疏 KV 卸载](kv-cache-sparse-offload.md)，官方文档把两者写在同一篇里配成一对。池后端怎么装、key 怎么算、命中怎么判，都归 [KV Pool](kv-pool.md)，这一页只讲「按层」这一件事。

## 一次长阻塞换成 28 次短阻塞

不开 layerwise 时，一个请求的 KV 是整趟前向结束后一次性写出去、或开始前一次性读进来的。长 prompt 下这一次搬运动辄上百 MiB，期间 NPU 干等着。总字节数不变，但它被压在了一个点上。

按层切开之后，同样的字节数摊到 28（或 61）个层间隙里，每个间隙后面都跟着一层实打实的计算可以拿来遮盖。**省下的从来不是带宽，是等待。**

挂钩点摆在哪儿有讲究。以 `AscendMLAImpl` 为例：等待放在 `mla_preprocess_*` 之前，而且**只在 `has_prefill` 为真时才等**——decode 步不进这条路 [C9]；保存放在本层 `o_proj` 之后、返回之前。重叠能有多深则由预取深度决定：`_submit_ready_layer_loads` 在第 0 层一次投 `num_prefetch_layers` 个加载任务，之后每层补一个，始终保持这么多层在飞。

还有一件事值得先说破：**没有独立的传输 stream**。搬运由 Python 后台线程发起，它与前向的重叠靠线程并行加 Event 定序，不是同一进程里两条 NPU stream 互相 `wait_event` [D]。于是多个 TP rank 会一起抢总线，`h2d_stagger_us` 拿忙等把它们错开，错开量是 `(tp_rank + layer_id) % tp_size × h2d_stagger_us`——忙等，设大了直接烧 CPU [C29]。

## 三类同步点，少一个就读到半截 KV

- **`sync_save_events[i]`（`torch.npu.Event`）**：前向线程在 `save_kv_layer` 里 `record()`，发送线程在真正发数据之前 `synchronize()` [C27]。它保证「KV 已经写进 paged cache」这件事在设备上真的完成了，而不只是 Python 调用返回了。
- **`layer_load_finished_events[i]` / `layer_save_finished_events[i]`（`threading.Event`）**：前向线程与两个传输线程之间的 CPU 握手。
- **`AttentionComputeStartGate`**：跨线程又跨流。前向线程在 attention 算子下发前 `record()` 一个 NPU Event，传输线程 `wait()` 时对它 `synchronize()` [C13]。它只对**预取**的层生效——当前层本来就要马上用，不需要给谁让路。

超时怎么处理两版不一样，这是本页最该记住的一条：v0.23 上 `wait(timeout=10)` 超时只打一行日志就继续往下算 [C25]，症状是精度异常而不是报错 [!]；main 改成 `while not ...wait(timeout=10)` 续等，并每轮 `raise_if_failed()` 把后台线程的异常抬回前向线程 [C23]。

## main 才有的第二件事：28 层共用 4 份 buffer

既然 KV 反正要马上搬走，本地这份 HBM buffer 就没必要每层留一个。拿官方样例那组配置（`layerwise_num_shared_buffers: 3`、`layerwise_independent_layers: [0]`）配 28 层走一遍 `build_layerwise_cache_layout` [C30]。这段算术只跟**层数**有关，与 hidden size、头数无关，所以借 Qwen3-0.6B 的 28 层当算例是安全的，尽管它自己跑不了 layerwise [A]：

| 这一步在算什么 | 结果 |
|---|---|
| 独占 buffer 的层 | `[0]`，也是缺省值；第 0 层最早被写、最晚才有机会被复用 |
| 参与复用的层 | 1…27 共 27 层，`27 > 3` 所以复用生效 |
| 谁复用谁 | `{4:1, 5:2, …, 27:24}` 共 24 条，规律是**第 L 层复用第 L−3 层的 buffer** |
| 预取深度 | `min(3, 8) = 3`；不写 `layerwise_prefetch_layers` 时取 `min(num_shared_buffers, 8)` [C21]，**不是文档写的 1** [S3] |
| 描述符合并成几个 | `1 + 3 = 4` |

最后一行才是真正掏出显存的那一步：`apply_layerwise_kv_cache_plan` 在 `initialize_kv_cache` 里、KV cache 真正分配之前，把 28 个 `KVCacheTensor` 描述符合并成 4 个，并打出 `Layerwise KV cache reuse merged 28 descriptors into 4 descriptors` [C31]。本地 KV buffer 从 28 份降到 4 份，约 **1/7** [D]——这也是[显存探测](kv-cache-memory-profiling.md)的结果在这条路上对不上主公式的原因。

代价就在同一张表里：第 4 层开始装之前，接收线程必须先确认第 1 层的 D2H 真的做完了 [C28]。`layerwise_num_shared_buffers` 越小越省显存，也越容易卡在这个等待上，官方建议从 2~4 起步。它还要求 Memcache 后端与 eager 模式，并且暂时不能与 `MooncakeLayerwiseConnector` 同时使用——按 buffer 粒度的传输完成门控还没实现 [S6]。

## 两个分支还差在哪

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 共享 buffer 复用 | 没有：`wait_for_save_layer` 恒为 `None`，仓库里也没有 `layerwise_cache_layout.py` | 有 | v0.23 只拿得到流水线收益，拿不到显存收益 |
| 怎么挑数据面 | 写死 `use_layerwise and backend == "memcache"` | 走后端注册表，只有 memcache 挂了 `layerwise_protocol` [C18] | 结论没变，但 main 给 mooncake 另开了一条 block-key 路径，它不支持 hybrid KV cache [C19] |
| 纯消费者的层号推进 | 只有 `save_kv_layer` 会 `current_layer += 1`，而 load-only 消费者根本不调它 [C17] | `wait_for_layer_load` 在非保存角色上自己推进 | v0.23 上 `kv_consumer` 不回写时，逐层加载会停在第 0 层 [I] |
| 哪些层挂了钩子 | MLA / SFA / DSA / DSA-CP | 多了 GDN 线性注意力层 [C12]；`wait_for_layer_load` 还顺带给 mamba 状态拷贝定序 | 带 GDN 的混合模型在 main 上才进得来 |
| 栅栏所在模块 | `vllm_ascend/memcache_comm_fence.py` | `.../ascend_store/attention_fence.py` | 只是搬家，类代码逐字相同 |
| 用户文档 | 有专页 Layerwise KV Pool | 专页已删，只剩 `kv_pool.md` 里的一行和 Layerwise and Sparse 那一篇 | 「PD-Mixed 也能开 layerwise」这句话如今只留在 v0.23 的文档里 [!] |

两版共同的硬约束有两条：P/D 两侧 TP 不一致直接 `ValueError`，传输线程没实现重切分 [C20]；开了 layerwise 就强制 PIECEWISE 图模式，`requires_piecewise_for_cudagraph` 直接返回 `use_layerwise` [C15]。

## 常见误解

- **「layerwise 对任何模型都能开。」**——不是。两版里真正调这对挂钩点的只有 `mla_v1.py`、`sfa_v1.py`、`dsa_v1.py`、`dsa_cp.py`，main 上多一个 `ops/gdn.py`；普通 GQA 走的 `attention_v1.py` 只调了记 Event 那一个。
- **「`layerwise_prefetch_layers` 默认是 1。」**——分路径看。memcache 这条数据面上缺省是 `min(num_shared_buffers, 8)`，而 `num_shared_buffers` 不填等于层数，于是实际默认是 8；只有走不到这条数据面时才退回文档写的 1 [C21]。同一份配置从 v0.23 搬到 main，预取深度会从 1 跳到 8，飞行中的临时 buffer 也跟着涨。
- **「文档说 CP 和 hybrid 都不支持，那就是代码里拦住了。」**——`dsa_cp.py` 两版都调了这对挂钩点；main 的源码里与 layerwise 直接相关的硬报错只有两条：TP 不一致，以及 mooncake 后端加 hybrid KV cache。文档那句是「未验证」，不是「代码拦住了」，真要用请自己验 [D]。
