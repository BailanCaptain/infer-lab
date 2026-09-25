---
id: kv-cache-layerwise-offload
title: "Layerwise KV Offload：按层搬，顺手让多层共用一份 buffer"
type: feature
summary: 专职做预填充的机器算完一层，就把这一层的 KV 发去 KV 池，搬运藏进下一层的计算里；v0.26 起还能让很多层轮流用同几份显存，把这一侧的 KV 显存压成常数份。
aliases: [Layerwise KV Offload, 逐层 KV 卸载, 逐层 KV 传输, Layerwise KV Cache Offload, Layerwise KV Cache Offloading, Layerwise KV Pool, Layerwise Prefill Offload]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L26-L36
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L75-L84
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/layerwise_kv_pool.html
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L145-L209
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L271-L282
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html
  - vllm-ascend@baa023ad:vllm_ascend/attention/utils.py#L445-L473
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2054-L2057
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2173-L2177
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1202-L1212
  - vllm-ascend@baa023ad:vllm_ascend/ops/gdn.py#L363-L369
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L29-L73
  - vllm-ascend@2c59ff10:vllm_ascend/memcache_comm_fence.py#L27-L61
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L96-L115
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L277-L292
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L243
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L64
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L205-L221
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L301-L306
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L516-L555
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2456-L2485
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2487-L2539
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2547-L2593
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1356-L1399
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1407-L1430
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1827-L1841
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2082-L2094
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2055-L2067
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L297-L381
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4470-L4479
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1604-L1608
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1874-L1878
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L98-L103
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L114-L178
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1722-L1774
  - vllm-ascend@2ed6cbba:vllm_ascend/memcache_comm_fence.py#L27-L61
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L1-L16
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L1-L17
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L52-L75
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L210-L294
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L255-L267
  - vllm-ascend@baa023ad:vllm_ascend/ops/gdn.py#L685
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/gdn.py#L457
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn.py#L137
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: kv-pool
    kind: variant-of
    note: layerwise 是 AscendStore KV Pool 的一种传输模式，池的后端选型、key 组织、P/D 角色都在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 共享 buffer 只能合并 KVCacheSpec 完全相同的层，spec 决定了哪些层可以共用一份显存
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: main 上开启层复用后，探测出的 KV 预算要再乘「层数 ÷ 缓冲区个数」，返回值不再等于主公式
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样把 KV 挪出显存，但那边按请求整块搬到本机主存做前缀备份，这边按层搬进跨节点的 memcache 池
contradicts: []
updated: "2026-09-25"
---

专职做预填充的机器，每算完一[层](layers-and-hidden.md)就把这一层的 [KV Cache](kv-cache.md)（KV 就是 K 和 V 的缓存）发去 KV 池，发的同时接着算下一层；取回来也一样，算哪一层就只等哪一层到位。**省下的不是带宽，是等待。** v0.26 起还多一件事：既然 KV 反正马上要搬走，本地就不必每层都留一份显存，很多层可以轮流用同几份。v0.23 维护分支只有前一件。

```wiki-diagram
file: kv-cache-layerwise-offload
```

## 算完 40 层，KV 搬走的那段时间 NPU 在干什么

设想一套分工部署：一台机器只做预填充（prefill：把问题里所有 token 一起算一遍），另一台只管一个一个吐回答（decode）。预填充那台算出来的 KV 得交出去，中间隔着一个跨机器的 KV 池——两边都往里存、从里取。

问题就出在「交出去」这一步。拿我们一路在用的 Qwen3.6-35B-A3B 来说，它有 40 层。最直接的做法是 40 层全算完，再把整条请求的 KV 一次搬走。长问题下这一次要搬的字节很多，搬的时候 NPU 手上没活，只能干等。上图上半画的就是这种情形：前面一长条在算，后面一长条在搬，两件事排着队。

## 按层搬：一次长等待，换成 40 次短的

换个思路：第 1 层算完，它的 KV 就已经定了，没必要等第 40 层。马上把第 1 层的发出去，同时 NPU 去算第 2 层；第 2 层算完再发第 2 层，接着算第 3 层……

总共要搬的字节一点没少，只是从一个点摊到了 40 个层与层之间的空隙里，而每个空隙后面都跟着一层实打实的计算，正好拿来遮住搬运。上图下半就是这样：每一小段搬运都叠在下一层的计算底下，只有最后一层后面露出一小截。

取回的方向同理。要在别处接着用这些 KV 时，不必等 40 层全部到齐才开算：算第 1 层前只等第 1 层到位，而且可以提前几层把后面要用的先取起来。

## 为什么最后一层还是得等

搬运是交给后台线程去做的，前向计算发完就往下走。但走到最后一层时不能直接走：这一步的前向一结束，存 KV 的那块显存可能马上被下一步拿去用，如果最后一层还没真正发出去，发的就是被改掉的东西。所以**最后一层要停下来，等它确实发完**。三个版本都这么做。这也就是上图下半末尾那一小截。

「每层都能立刻往下走」只对中间那 39 层成立——它们后面才有下一层的计算可以拿来遮盖。

## 三道同步，少一道就读到半截 KV

计算和搬运分在不同线程上跑，就得有人管「先后」。这里有三道：

- **KV 真的写进去了吗**：前向这边算完一层，在设备上记一个时间点；发送线程动手之前，先确认设备确实走过了这个点。只看 Python 调用返回了不算数——那时 NPU 上的活可能还在排队。
- **这一层搬完了吗**：前向线程和两个搬运线程之间，每层一对「好了」的信号，互相通知。
- **提前取的别抢正在算的**：提前取后面几层时，搬运线程要先等当前这一层的注意力算子已经下发，再动手，免得和正在算的这一层抢总线。当前层本来就要马上用，不需要给谁让路。

超时怎么处理，是 v0.23 和后面两个版本最该记住的差别：v0.23 上等了 10 秒还没等到，只打一行日志就接着往下算——症状是结果不对，而不是报错；v0.26 起改成一直续等，并且每一轮都把后台线程的异常抬回来。

## 顺手省显存：40 层轮流用 4 份（v0.26 起）

KV 既然算完马上就搬走，本地这份显存就用不着每层各占一份。v0.26 起可以指定只留几份「公用」的，让很多层轮流用：第 1 层用完、发走之后，那份显存腾出来给后面的层接着用。

拿官方样例那组设置（公用 3 份、第 0 层单独一份）按 40 层数一遍。这笔账只和**层数**有关，和每层多宽、几个头都无关：

| 这一步在算什么 | 40 层的结果 |
|---|---|
| 单独占一份的层 | 第 0 层——它最早被写，最晚才有机会被复用 |
| 参与轮流的层 | 第 1 到第 39 层，共 39 层，比 3 份多，所以轮流生效 |
| 谁接谁的班 | 第 L 层接第 L−3 层的那一份，从第 4 层接第 1 层开始，一共 36 对 |
| 提前取几层 | 3 层 |
| 最后剩几份 | 1 + 3 = 4 份 |

本地 KV 显存从 40 份降到 4 份，剩原来的 1/10。这也是[显存探测](kv-cache-memory-profiling.md)的结果在这条路上对不上主公式的原因。

代价在「谁接谁的班」那一行：第 4 层开始往这份显存里装之前，必须先确认第 1 层确实已经搬走了。公用的份数越少越省显存，也越容易卡在这个等待上；官方建议从 2~4 份起步。

## 我们那条请求用得上吗

用不上，而且原因不止一层。

[那条请求](one-request.md)在两颗 NPU 上跑，没有 KV 池，也没有预填充和吐字分开的两台机器——按层搬的挂钩一上来就发现「没有搬运的对象」，直接返回。

就算把它搬到分工部署里硬开，也有两道坎：

- **它的注意力层没接上。** 这个模型 40 层里只有 10 层是普通的全注意力，存 KV；另外 30 层是[线性注意力](linear-attention.md)，存的是一份固定大小的状态。那 10 层全注意力走的计算路径，只记了「注意力开始了」这一个时间点，既不等 KV 到位、也不把 KV 发走。按层搬的开关打开了，却没有人去用它。官方写明适配的是另一类注意力结构（DeepSeek 那类的 MLA、稀疏注意力等）。
- **它的层不能轮流用显存。** 上面那张 40 层的表，是只按层数算的账。真的在这个模型上打开「轮流用」，会被当场拒绝：轮流只支持存 KV 的注意力层，而它有 30 层存的是线性注意力的状态。

所以这一页讲的是 **P/D 分离里预填充那一侧**的特性，面向官方那套设定：专职预填充节点、memcache 后端、MLA 一类的注意力。吐字那一侧的对应物是[稀疏 KV 卸载](kv-cache-sparse-offload.md)，官方文档把两者写在同一篇里配成一对。池本身怎么装、怎么查命中，归 [KV Pool](kv-pool.md)；这一页只讲「按层」这一件事。

## 容易想错的几件事

- **「任何模型都能按层搬。」**——不是。要看这个模型的注意力计算有没有接上「等到位」和「发出去」这一对挂钩；普通的全注意力路径没接。
- **「提前取几层，文档说默认 1。」**——不同版本、不同路径默认值不一样，同一份设置从 v0.23 换到 v0.26 或 main，提前取的层数可能从 1 跳到 8，路上临时占的显存也跟着涨。细节见下面「开销」一节。
- **「文档说上下文并行（CP）和混合模型都不支持，那代码里一定拦住了。」**——文档记的是「没验证过」，不是「代码一律拦住」。有的后端真拦，有的不拦；在没被拦的路上用，得自己验。见下面「会报什么错」。

## 对照源码

下面 v0.23 维护分支指 `2c59ff10`，v0.26 分支指 `2ed6cbba`，main 指 2026-09-21 的源码快照 `baa023ad`。

### 怎么开

- 开关是 `AscendStoreConnector` 从 `kv_connector_extra_config` 里读的 `use_layerwise`，默认关 [S1]。[UCM](ucm.md) 的 yaml 顶层另有一个同名 `use_layerwise`，由外部 `ucm` 包自己读，和这一页不是一回事。
- 官方设定：专职 Prefill 节点、`kv_role: "kv_producer"`、memcache 后端、MLA / SFA / DSA 注意力后端、eager 执行 [S5]。开了 layerwise 就强制 PIECEWISE 图模式，`requires_piecewise_for_cudagraph` 直接返回 `use_layerwise` [C15]。
- 两个挂钩点 `wait_for_kv_layer_from_connector` / `maybe_save_kv_layer_to_connector` 在 `has_kv_transfer_group()` 为假时直接返回 [C8]。以 `AscendMLAImpl` 为例：等待放在 `mla_preprocess_*` 之前，且**只在 `has_prefill` 为真时才等**，decode 步不进这条路 [C9]；保存放在本层 `o_proj` 之后、返回之前 [C10]。
- 谁接了这对挂钩：`mla_v1.py`、`sfa_v1.py`、`dsa_v1.py`、`dsa_cp.py` 成对调用。普通 GQA 走的 `attention_v1.py` 只在 `forward_impl` 外面套了一层记 attention-start 事件的壳（两个发布分支写成 `record_attention_compute_start()`，main 换成上下文管理器 `attention_transfer_window()`），没有 wait / save [C11]。`ops/gdn.py`（GDN 线性注意力）在两个发布分支上只调了保存那一半 `maybe_save_kv_layer_to_connector("", [])` [C46][C47]；main 在 `_forward_core` 里补上了 `wait_for_kv_layer_from_connector` 和 `record_attention_compute_start()` [C12]，保存仍是那一句 [C45]。
- Qwen3.6-35B-A3B 的形状：`num_hidden_layers: 40`、`full_attention_interval: 4`（10 层全注意力、30 层线性注意力）、`num_key_value_heads: 2`、`head_dim: 256` [S42]；它的全注意力层走 `attention_v1.py`，所以上面「没接上」那条成立 [C11]。
- **层复用的参数**：`layerwise_num_shared_buffers`（不填等于层数，即不复用）、`layerwise_independent_layers`（缺省 `[0]`，也可写 `"all"`）、`layerwise_prefetch_layers` [C30]。`build_layerwise_cache_layout` 在 v0.26 与 main 是同一份实现 [C36][C30]。
- 上面 40 层那张表的推导 [D]：`reused_layers = 1…39`，`39 > 3` 故 `has_layer_reuse`；`prefetch_layer_map = {reused[i]: reused[i−3]}`，即 `{4:1, 5:2, …, 39:36}` 共 36 条；`num_prefetch_layers = min(3, 8) = 3`；`storage_indices` = 1 个独立 + 3 个轮流 = 4 [C30]。main 在外面再包一层 `build_layerwise_reuse_layout`，按 main spec 分桶、每桶各取 `min(num_shared_buffers, 桶内层数)` 份——层 spec 全相同时结果与上面一致 [C43]。
- `apply_layerwise_kv_cache_plan` 在 `initialize_kv_cache` 里、KV cache 真正分配之前改写描述符，日志形如 `Layerwise KV cache reuse merged 40 descriptors into 4 descriptors using 4 buffer assignments.` [C31][C32]。本地 KV buffer 从 40 份降到 4 份，约 1/10 [D]。
- 提前取的节奏（memcache `gva` 数据面）：`_submit_ready_layer_loads` 在第 0 层最多投 `num_prefetch_layers` 个加载任务，之后每层最多补一个，有任务或需要等复用源的层才计入提交数 [C22]。main 的 mooncake hybrid 路径另按当前层和预取窗口补齐任务，不能套用这一固定节奏。

**三道同步对应的对象**：

- `sync_save_events[i]`（`torch.npu.Event`）：前向线程在 `save_kv_layer` 里 `record()`，发送线程 `KVCacheStoreLayerSendingThread` 在真正发数据前 `synchronize()` [C27][C33]。
- `layer_load_finished_events[i]` / `layer_save_finished_events[i]`（`threading.Event`）：前向线程与两个传输线程之间的 CPU 握手 [C23][C24]。
- `AttentionComputeStartGate`：前向线程在 attention 算子下发前 `record()` 一个 NPU Event，接收线程 `KVCacheStoreLayerRecvingThread` 在 `wait()` 时对它 `synchronize()`；只对预取的层生效 [C13][C34][C35]。

**末层等保存**：`save_kv_layer` 走到最后一层时调 `_wait_for_final_layer_save`，等本层保存完成，让源 buffer 活到 PUT 提交之后——三版都有 [C26][C37][C24]。main 另加两件：`pp_size > 1` 时「最后一层」按本 PP stage 的本地层数算；清理保存事件时跳过被别的层当复用源的那几层——后一件 v0.26 也有 [C24][C37]。

### 会报什么错

- **P/D 两侧 TP 不一致**：直接 `ValueError`，传输线程没实现重切分；三版都有 [C20]。
- **在混合模型上开层复用**：`build_layerwise_reuse_layout` 一旦要复用，就检查所有层的 spec，遇到非 `AttentionSpec` 抛 `NotImplementedError("Layerwise KV cache reuse supports attention cache specs only; …")`；v0.26 与 main 都有 [C43][C44]。Qwen3.6-35B-A3B 的 30 层线性注意力状态正落在这里 [D]。
- **共用 buffer 的层大小或 spec 不一致**：`ValueError`（`must have equal tensor sizes` / `must have identical cache specs`）；已经预先共享或打包过的描述符报 `NotImplementedError` [C31]。
- **超时**：v0.23 上 `wait(timeout=10)` 超时只打一行日志就继续往下算 [C25]，症状是精度异常而不是报错 [!]；v0.26 起改成 `while not ...wait(timeout=10)` 续等，并每轮 `raise_if_failed()` 把后台线程的异常抬回前向线程 [C37]。
- **main 的拓扑闸门，只守一条路**：构造 `AscendStoreConnector` 时先按 `backend` 取该后端的 layerwise 协议模块，开了 layerwise 就调它的 `validate_topology` [C15][C18]。挂了这个钩子的只有 mooncake 的 block-key 协议：`pipeline_parallel_size`、`prefill_context_parallel_size`、`decode_context_parallel_size` 任一大于 1 直接 `ValueError`，理由是 block key 里没有这几个坐标的位置 [C41]。memcache 那条 `gva` 数据面没有这个函数，两个发布分支连 `mooncake_layerwise.py` 都不存在。于是同一份开了 CP 的配置，在 mooncake 后端的 main 上起不来，在 memcache 后端或发布分支上照跑 [C41][!]。
- **文档说 CP 与 hybrid 不支持**：CP 那半，`dsa_cp.py` 三版都成对调了这对挂钩点，源码里没有「见到 CP 就拒绝 layerwise」，真正报错的只有上面那道 mooncake 闸门。hybrid 那半，main 上 block-key 路径碰上 Mamba 这类循环状态时报错，层复用碰上非注意力 spec 时报错（上一条），其余路径不整体拦 [D]。想在没被拦的路上用，得自己验。

### 开销和什么时候别开

- **没有独立的传输 stream**。搬运由 Python 后台线程发起，与前向的重叠靠线程并行加 Event 定序，不是同一进程里两条 NPU stream 互相 `wait_event` [D]。多个 TP rank 会一起抢总线，`h2d_stagger_us` 拿忙等把它们错开，错开量是 `(tp_rank + layer_id) % tp_size × h2d_stagger_us`——忙等，设大了直接烧 CPU [C29]。
- **公用份数越少越容易卡等待**：第 L 层装之前要等第 L−3 层的 D2H 做完；官方建议 `layerwise_num_shared_buffers` 从 2~4 起步。层复用还要求 Memcache 后端与 eager 模式，并且暂时不能与 `MooncakeLayerwiseConnector` 同时使用——按 buffer 粒度的传输完成门控还没实现 [S6]。
- **预取深度默认值会跳**：memcache 这条数据面上，`layerwise_prefetch_layers` 不写就取 `min(num_shared_buffers, 8)`，而 `num_shared_buffers` 不填等于层数，所以实际默认是 8 [C30]，**不是文档写的 1** [S3]；走不到这条数据面时才退回字面默认值，它也只在两个发布分支上是 1，main 已改成 2 [C21]。同一份配置从 v0.23 搬到 v0.26 或 main，预取深度会从 1 跳到 8，飞行中的临时 buffer 也跟着涨。
- **显存探测对不上主公式**：main 上开了层复用，探测出的 KV 预算要再乘「层数 ÷ 缓冲区个数」，见[显存探测](kv-cache-memory-profiling.md)。
- 没有 KV 池、不做 P/D 分离、或者模型的注意力路径没接挂钩（普通 GQA、混合线性注意力模型）时，开了没收益。

### 版本差异

**v0.26 分支在这张表里多半站在 v0.23 那一侧**，只有共享 buffer 复用和超时续等这两件跟了 main。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 共享 buffer 复用 | 没有：`wait_for_save_layer` 恒为 `None`，仓库里也没有 `layerwise_cache_layout.py` | 有，基础排法与 main 相同 [C36] | 有 [C30] | v0.23 只拿得到流水线收益，拿不到显存收益 [!] |
| 超时 | 打日志后继续 [C25] | 续等 + 抬异常 [C37] | 同 v0.26 [C24] | v0.23 上超时表现为精度异常 |
| 怎么挑数据面 | 写死 `use_layerwise and backend == "memcache"` | 同 v0.23 | 走后端注册表：`get_layerwise_protocol` 取模块，按它自报的 `LAYERWISE_DATA_PLANE` 分流，memcache 报 `gva`、mooncake 报 `block_key` [C18] | 这一页讲的仍是 memcache 那条 `gva` 数据面；mooncake 的 block-key 路径见 [KV Pool](kv-pool.md) [!] |
| 纯消费者的层号推进 | 只有 `save_kv_layer` 会 `current_layer += 1`，而 load-only 消费者根本不调它 [C17] | 同 v0.23 | `wait_for_layer_load` 在非保存角色上自己推进 [C23] | 两个发布分支上 `kv_consumer` 不回写时，逐层加载会停在第 0 层 [I] |
| 哪些层挂了钩子 | MLA / SFA / DSA / DSA-CP 成对；GDN 只调保存 [C47] | 同 v0.23 [C46] | GDN 也补上等待和 attention-start 门，`wait_for_layer_load` 顺带给 mamba 状态拷贝定序 [C12] | 带 GDN 的混合模型只有 main 会给逐层加载让路 |
| 栅栏所在模块 | `vllm_ascend/memcache_comm_fence.py` [C14] | 同 v0.23，类代码逐字相同 [C38] | `.../ascend_store/attention_fence.py` [C13] | 只是搬家，import 路径不同 |
| 用户文档 | 有专页 Layerwise KV Pool [S3] | 专页还在 [S39]，另有 Layerwise and Sparse 那一篇 | 专页已删；多出一篇只有 main 有的 mooncake 逐层适配分析 [S40]，见 [Mooncake Connector](mooncake-connector.md) | 「PD-Mixed 也能开 layerwise」这句话在 main 的文档里已经没了 [!] |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 两个挂钩点 | `vllm_ascend/attention/utils.py`，`wait_for_kv_layer_from_connector` / `maybe_save_kv_layer_to_connector` |
| MLA 上挂钩的位置 | `vllm_ascend/attention/mla_v1.py` |
| 普通 GQA 只记 Event | `vllm_ascend/attention/attention_v1.py`，`forward_impl` |
| GDN 线性注意力 | `vllm_ascend/ops/gdn.py`，`_forward_core` |
| 开关、PIECEWISE、拓扑闸门 | `.../ascend_store/ascend_store_connector.py` |
| 后端协议注册表 | `.../ascend_store/backend/__init__.py`、`backend/mooncake_layerwise.py` |
| 预取、等待、保存 | `.../ascend_store/pool_worker.py`，`_submit_ready_layer_loads` / `wait_for_layer_load` / `save_kv_layer` |
| 两个传输线程与错峰 | `.../ascend_store/kv_transfer.py`，`KVCacheStoreLayerSendingThread` / `KVCacheStoreLayerRecvingThread` |
| 层复用排法与改写描述符 | `.../ascend_store/layerwise_cache_layout.py`，`build_layerwise_cache_layout` / `build_layerwise_reuse_layout` / `apply_layerwise_kv_cache_plan` |
| attention-start 栅栏 | main：`.../ascend_store/attention_fence.py`；发布分支：`vllm_ascend/memcache_comm_fence.py` |
