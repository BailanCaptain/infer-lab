---
id: kv-cache-cpu-offload
title: "KV Cache CPU Offload：把要被淘汰的块存进主机内存"
type: feature
summary: NPU 上的 KV 块被淘汰之前先异步拷一份进主机内存；下一条请求共享同一段前缀、而 NPU 上那几块已经没了，就再拷回来，省掉重新 prefill。昇腾只换掉 worker 侧的搬运。
aliases: [KV Cache CPU Offload, KV Cache CPU 卸载, KV 缓存 CPU 卸载, CPU Offload, NPUOffloadingSpec, CPUOffloadingSpec, TieringOffloadingSpec, OffloadingConnector, 多级 KV 卸载]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L5-L14
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L85-L93
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L133-L139
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L71
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L101
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L39-L181
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L22-L102
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L65-L231
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L233-L329
  - vllm-ascend@b255ab59:csrc/torch_binding.cpp#L167-L287
  - vllm-ascend@b255ab59:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L115-L208
  - vllm-ascend@2c59ff10:csrc/torch_binding.cpp#L149-L172
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L16-L43
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/cpu_npu.py#L54-L230
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L87
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L131-L147
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_cache_cpu_offload.html
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 回填只在 NPU 前缀缓存未命中、而 CPU 池里还存着同一段前缀时触发；没有前缀缓存这条路径永远不会走到
  - to: paged-attention
    kind: builds-on
    note: 卸载与回填的最小单位就是分页 KV 块，一次传输搬 blocks_per_chunk 个块
  - to: kv-cache-spec
    kind: builds-on
    note: 一个 CPU 格子的字节数直接由每块每层的 page_size_bytes 乘 blocks_per_chunk 得出
  - to: recompute-cpu-offload
    kind: alternative-to
    note: 那一页的触发条件是调度器抢占某条请求、按请求点名搬走；这一页的触发条件是块池 LRU 淘汰，搬的是碰巧要被丢掉的块
  - to: kv-cache-sparse-offload
    kind: alternative-to
    note: 那一页让 D 节点的全量主 KV 常驻主机内存、每步按 top-k 取回；这一页 NPU 仍是主存放地，主机内存只是被淘汰块的备份
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 那一页改的是搬运时机（每层算完立刻发，走 AscendStoreConnector）；这一页的时机由上游块池定，粒度是一整个 chunk
contradicts: []
updated: "2026-09-20"
---

## 一句话

KV Cache CPU Offload 在 NPU 的 KV 块被淘汰之前，把它异步拷一份到主机内存；下一条请求若与它共享前缀、而 NPU 上那几块已经被别人占了，就再异步拷回来。**它是拿带宽换算力，不是省显存**——付一次跨 PCIe 的往返，省一次全层前向。块池、LRU、前缀匹配全是上游 `OffloadingConnector` 的，vllm-ascend 换掉的只有 worker 侧那段搬运：NPU 流加一次批量 DMA [S1]。**两个对照版本的配置键几乎没有一个能照搬** [!]。

```wiki-diagram
file: kv-cache-cpu-offload
```

## 那条请求用不到它

[那条请求](one-request.md)一辈子触发不了一次搬运，原因有两层，第一层就够了：**搬运的单位是一个 chunk，不是一个块。** 一个 chunk 等于 `blocks_per_chunk` 个 NPU 块，官方示例取 8，也就是 8 × 128 = **1024 个 token**；e2e 用例干脆把这个乘法写进断言，再造一条「正好一个完整 chunk 加一个尾 token」的 prompt 来验回填 [C11]。那条请求全程才 37 + 200 = 237 个 token，连一个 chunk 的四分之一都凑不满。第二层是它是队列里唯一的请求，NPU 块池毫无压力，上游根本不会发起淘汰。

要让这一页有数可算，得照 e2e 用例改设定：prompt 拉到 1025 个 token，跑完一遍后 `llm.reset_prefix_cache()` 清掉 NPU 侧的命中，再跑第二遍。其余设定不变 [A]：

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 一个规范视图一块多少字节 | 128 × 8 × 128 × 2 B = **256 KiB** | 昇腾把 K、V 存成两张张量，这是其中一张的一块 |
| 一个 NPU 块合计 | 28 层 × 2 张 = 56 个视图 × 256 KiB = **14 MiB** | 和 [KV Cache Spec](kv-cache-spec.md) 算出的每块 14 MiB 对得上 |
| 一次 store 搬多少 | 8 块 × 56 个视图 = **448 个拷贝描述符**，合计 **112 MiB** | 描述符个数就是 `num_copy_ops` [C8] |
| 8 GiB 预算装得下几格 | 8192 ÷ 112 ≈ **73 格**，可缓存 73 × 1024 = **74752 个 token** | 不含上游的块大小对齐，是估算 |

第一行和第四行是拿模型维度推的，能拿计算器复核 [D]。第四行是最该记住的那个数：官方示例里看着很小的 `8 * (1 << 30)`，锁住的是将近 8 GiB 的 pinned 主机内存。

## 它不省一个字节的 HBM

NPU 侧的 KV 块池仍由 `gpu_memory_utilization` 说了算，这个特性一个字节都不退给你。官方文档的建议恰恰相反：**调低** `gpu_memory_utilization` 会让卸载更活跃 [S3]——NPU 侧块池越小，淘汰越频繁，CPU 池的命中机会越多。被换掉的是主机内存，而且是页锁定内存，预留过多会直接把宿主机 OOM 掉（在线版见 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_cache_cpu_offload.html> [S17]）。

所以它的收益只在一种形状上成立：**前缀长、复用率高、而 HBM 装不下全部热数据**。哪段前缀值得留、留多久，是上游块池的 LRU 在管；前缀怎么按哈希匹配、为什么命中的是「块」而不是任意长度，见 [Prefix Caching](prefix-caching.md)。

## 昇腾只换了三处，调度侧一行没动

**第一处：注册表。** `register_connector()` 把上游的 `CPUOffloadingSpec` 与 `TieringOffloadingSpec` 两个名字从 `OffloadingSpecFactory._registry` 里摘掉、重注册成昇腾的 `NPUOffloadingSpec` / `NPUTieringOffloadingSpec`，`OffloadingConnector` 这个连接器名同样被换成 `AscendOffloadingConnector` [C5]。**所以 main 上的配置只写上游的名字**——`spec_name` 填 `"CPUOffloadingSpec"` 就行，不用也不该再写 `spec_module_path` [S2]：

```python
kv_transfer_config = KVTransferConfig(
    kv_connector="OffloadingConnector",     # 被昇腾换成 AscendOffloadingConnector
    kv_role="kv_both",                      # 存与取都开，只写不读没意义
    kv_connector_extra_config={
        "cpu_bytes_to_use": 8 * (1 << 30),  # 全服务器预算，上游按 worker 分
        "blocks_per_chunk": 8,              # 8 个 NPU 块合成一格 → 112 MiB/格
        "spec_name": "CPUOffloadingSpec",   # 写上游的名字，注册表里已是 NPU 实现
    },
)
```

**第二处：spec 只改 worker 的构造。** 上游 `CPUOffloadingSpec.get_worker()` 会把非 CUDA/XPU 的平台直接拒掉，昇腾用一个 `_NPUWorkerMixin` 覆盖掉这道平台门禁，worker 缓存与生命周期照用上游的。

**第三处：连接器 worker 的规范化边界。** 上游的原生卸载 worker 假设一层的 KV 打包成一个张量，昇腾把 K 和 V 存成两个。适配只在布局确实不同时才介入：`register_kv_caches` 先扫一遍，`AttentionSpec` 却不是单张量、或 `MambaSpec` 是 list，才走昇腾分支，否则原样调 `super()`。规范化产出的是 `[num_blocks, page_size_bytes]` 的 int8 `as_strided` 视图，别名原 NPU 显存，**模型执行路径上不增加任何分配与拷贝** [C6]。

一次搬运的时序解释了下面第一条误解。store（D2H）下发前先 `stream.wait_stream(torch.npu.current_stream())`——KV 是在模型主流上写进去的，D2H 不能在写完之前读；然后同方向的后一笔 `wait_event` 前一笔的 `end_event`，把这个方向串成一条链。拷贝本身是一次 `torch.ops._C_ascend.swap_blocks_batch(src, dst, sizes, direction)`，`direction` 0 是 H2D、1 是 D2H。完成后 `get_finished` 用 `start_event.elapsed_time(end_event)` 算出实测耗时，连同字节数一起上报——**带宽不是估出来的，是每笔都被量过的** [C9]。到 CANN 那一层，编到 `CANN_MEMCPY_BATCH_ASYNC` 时整批描述符压成**一次** `aclrtMemcpyBatchAsync`，否则退化成逐描述符的 `aclrtMemcpyAsync` 循环 [C10]。

## 多级卸载用不上 pinned 内存，这是 CANN 的硬限制

main 多出来一条路：`TieringOffloadingSpec` 复用上游的 tiering manager，CPU 作一级、底下再挂文件系统 tier（`type: "fs"`，`root_dir` 指一个目录）。它不是「CPU 卸载的加强版」——为了让调度侧和各 worker 看到同一批字节，它**必须走共享 mmap**：`NPUTieringOffloadingSpec` 直接把 `_uses_shared_region()` 返回真，CPU 池换成 `SharedOffloadRegion` 的视图。代价是 CANN 没有 CUDA `cudaHostRegister` 那种「把任意 mmap 缓冲区注册成锁页内存」的等价接口，多级这一路因此拿不到 pinned 的带宽保证，**得在目标机器和目标 CANN 版本上自己压一遍** [C7]。

这不是嘴上说说：e2e 用例把两种 spec 都跑一遍，但「CPU 命中必须快过冷启动」那条断言只对 CPU-only 开，tiering 那一遍只验正确性 [C11]。

## v0.23 维护分支与 main：配置键换了一遍

下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`，完整提交号在来源里。v0.23 那一版的实现整个住在 `vllm_ascend/kv_offload/` 下：spec 在 `npu.py` [C13]，搬运在 `cpu_npu.py` [C14]，连接器注册表里没有 `OffloadingConnector` 这一项 [C15]，e2e 用例被整条 skip 掉 [C16]；只有最底下那段 `swap_blocks_batch` 的 C++ 两版逐字相同 [C12]。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 怎么插进去 | 注册表里没有 `OffloadingConnector`，靠配置里的 `spec_module_path` 把 spec 塞进去 | 连接器名和两个 spec 名都被就地换成昇腾实现 | 旧配置照抄到 main，`spec_module_path` 指的模块已经不在那个路径上 `[!]` |
| 容量参数 | `num_cpu_blocks`，块数，**必填**，缺了直接抛异常 [C13] | `cpu_bytes_to_use`，字节，全服务器预算 | 同一个数字在两版含义完全不同 |
| `num_cpu_blocks` 的地位 | 唯一容量参数 | 折算成 `cpu_bytes_to_use` 的那段兼容代码已删，spec 里只剩 worker 构造 [C7]，文档也不再提 | 旧配置迁到 main 得自己换算，别指望它还被认 `[!]` |
| 分块参数 | `block_size`：CPU 块的 token 数，须为 NPU 块的整数倍 [S4] | `blocks_per_chunk` 与 `block_size` **二选一**，互斥 | 前者是绝对值、后者是倍数，迁移时要换算 |
| CPU 池张量 | 每层固定两张，保留原 dtype 与形状 | 每个规范视图一张 int8 二维 `[格数, page_size × blocks_per_chunk]` [C9] | main 的池按字节寻址，与模型布局解耦 |
| 多级卸载 | 没有 | `TieringOffloadingSpec` 加文件系统二级 tier | 只有 main 能把冷数据再往下压一层 |
| 传输流 | 每方向一条固定流 `d2h_stream` / `h2d_stream` | 每笔从 `_stream_pool` 取一条、用完回收 | 并发度不变：同方向仍被 `end_event` 串行 |

## 常见误解

- **「两个方向 = D2H 和 H2D 并行跑满带宽。」**——两个 handler 只保证两个方向互不阻塞、且都不阻塞模型主流。同一方向内部，后一笔显式 `wait_event` 前一笔的结束事件，是严格串行的 [C8]。main 把固定流换成流池，省的是 `torch.npu.Stream()` 的创建开销，不是拿到了并行。
- **「开了卸载就能省 NPU 显存。」**——不能。NPU 侧块池的大小完全由 `gpu_memory_utilization` 决定，这个特性只是给被淘汰的块在主机内存里留了个副本；官方建议反过来**调低**它好让卸载更活跃。花掉的是主机内存，8 GiB 预算锁住的就是将近 8 GiB 的 pinned 内存。
- **「`block_size` 是被 `blocks_per_chunk` 取代的废弃键。」**——不是。main 的文档写明两者**互斥二选一**：`block_size` 按 token 数给 chunk 大小，只在所有 KV cache group 块大小相同时可用 [S2]；e2e 用例传的就是 `block_size: 128`。本页旧版把它记成「未读上游源码的推断」，现在文档已经写清楚了。
- **「多级卸载是 CPU 卸载的严格加强版。」**——不是。多级那一路必须用共享 mmap，而昇腾没法把任意 mmap 注册成锁页内存，所以它没有 CPU-only 那条路的带宽保证，官方要求在目标机型上单独压测。
