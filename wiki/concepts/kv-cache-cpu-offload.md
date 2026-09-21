---
id: kv-cache-cpu-offload
title: "KV Cache CPU Offload：把要被淘汰的块存进主机内存"
type: feature
summary: NPU 上的 KV 块被淘汰之前先异步拷一份进主机内存；下一条请求共享同一段前缀、而 NPU 上那几块已经没了，就再拷回来，省掉重新 prefill。昇腾只换掉 worker 侧的搬运。
aliases: [KV Cache CPU Offload, KV Cache CPU 卸载, KV 缓存 CPU 卸载, CPU Offload, NPUOffloadingSpec, CPUOffloadingSpec, TieringOffloadingSpec, OffloadingConnector, 多级 KV 卸载]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L5-L14
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L85-L93
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L133-L139
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L71
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L101
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L39-L181
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L22-L102
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L65-L231
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L233-L329
  - vllm-ascend@baa023ad:csrc/torch_binding.cpp#L167-L287
  - vllm-ascend@baa023ad:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L115-L208
  - vllm-ascend@2c59ff10:csrc/torch_binding.cpp#L149-L172
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L16-L43
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/cpu_npu.py#L54-L230
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L87
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L131-L147
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_cache_cpu_offload.html
  - vllm-ascend@2ed6cbba:vllm_ascend/kv_offload/npu.py#L16-L23
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L71
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L23-L32
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L73-L78
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L102-L108
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L45-L63
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/cpu_npu.py#L232-L252
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/kv_cache_cpu_offload.html
  - vllm-ascend@2ed6cbba:vllm_ascend/kv_offload/cpu_npu.py#L54-L230
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L93
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L62-L128
  - vllm-ascend@2c59ff10:csrc/torch_binding.cpp#L127-L247
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L5-L13
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 回填只在 NPU 前缀缓存未命中、而 CPU 池里还存着同一段前缀时触发；没有前缀缓存这条路径永远不会走到
  - to: paged-attention
    kind: builds-on
    note: 卸载与回填的最小单位就是分页 KV 块，一个 CPU 格由整数个 NPU 块拼成
  - to: kv-cache-spec
    kind: builds-on
    note: 一个 CPU 格的字节数直接由每块每层的 page_size_bytes 乘这个倍数得出
  - to: recompute-cpu-offload
    kind: alternative-to
    note: 那一页的触发条件是调度器抢占某条请求、按请求点名搬走；这一页的触发条件是块池 LRU 淘汰，搬的是碰巧要被丢掉的块
  - to: kv-cache-sparse-offload
    kind: alternative-to
    note: 那一页让 D 节点的全量主 KV 常驻主机内存、每步按 top-k 取回；这一页 NPU 仍是主存放地，主机内存只是被淘汰块的备份
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 那一页改的是搬运时机（每层算完立刻发，走 AscendStoreConnector）；这一页的时机由上游块池定，粒度是一整格
contradicts: []
updated: "2026-09-22"
---

## 一句话

KV Cache CPU Offload 在 NPU 的 KV 块被淘汰之前，把它异步拷一份到主机内存；下一条请求若与它共享前缀、而 NPU 上那几块已经被别人占了，就再异步拷回来 [S30]。**它是拿带宽换算力，不是省显存**——付一次跨 PCIe 的往返，省一次全层前向。块池、LRU、前缀匹配全是上游 `OffloadingConnector` 的，vllm-ascend 换掉的只有 worker 侧那段搬运：NPU 流加一次批量 DMA。**发布分支与 main 之间，配置键几乎没有一个能照搬** [!]。

三个版本上都有，但形状不同：**v0.23 维护分支和 v0.26 分支在这一页上一条不差**——实现同在 `vllm_ascend/kv_offload/` 下，`npu.py` 与 `cpu_npu.py` 两个文件逐字相同 [C26]，官方文档给的也是同一套键 [S19]。**下面的正文按 v0.23（= v0.26）讲**。main 上昇腾接管了连接器注册表、容量参数换成字节预算、还多了一路多级卸载，两边怎么对应见末尾的差异表。

```wiki-diagram
file: kv-cache-cpu-offload
```

## 那条请求用不到它

[那条请求](one-request.md)全程 37 + 200 = 237 个 token，存那一侧它其实够得着——跑完攒得出一个满块。**但取那一侧它永远走不到**：回填的前提是「另一条请求与它共享前缀、而 NPU 上那几块已经被顶掉了」，队列里只有它一条，NPU 块池毫无压力，第二次机会根本不出现。而这个特性的收益全在取那一侧。

还有一条更硬的：**不满一格的尾巴不会被搬**。e2e 用例为此专门把 prompt 一个字一个字垫到 CPU 格大小的整数倍，才敢去断言收到了 CPU 存事件 [C28]。那条请求的 237 个 token 里，尾巴上那 109 个从头到尾都留在 NPU 上。

要让这一页有数可算，得照 e2e 用例改设定：prompt 拉到 10001 个 token 跑一遍，`llm.reset_prefix_cache()` 清掉 NPU 侧的命中，再跑第二遍——用例就是这么验「CPU 命中快过冷启动」的。配置抄官方示例那一组，其余设定不变 [A]：

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 一个子张量一块多少字节 | 128 × 8 × 128 × 2 B = **256 KiB** | 昇腾把 K、V 存成两张张量，一块的字节数就是 `stride(0) × element_size` [C14] |
| 一个 NPU 块合计 | 28 层 × 2 张 = 56 个子张量 × 256 KiB = **14 MiB** | 和 [KV Cache Spec](kv-cache-spec.md) 算出的每块 14 MiB 对得上 |
| 官方示例的一格有多大 | `block_size` 128 ÷ NPU 块 128 = 倍数 1，**一格就是一个 NPU 块**，128 个 token | `block_size` 是 CPU 侧格大小，须为 NPU 块的整数倍 [S4] |
| 搬一格要发多少个拷贝描述符 | 1 × 56 = **56 个**，合计 14 MiB | 描述符按「块 × 子张量」展开，个数就是这个乘积 |
| `num_cpu_blocks: 1000` 要多少主机内存 | 1000 × 14 MiB = **13.67 GiB**，可缓存 1000 × 128 = **128,000 个 token** | 有 pinned 就用 pinned，这 13.67 GiB 全是页锁定的 [D] |

最后一行是最该记住的那个数：官方示例里看着人畜无害的 `"num_cpu_blocks": 1000`，锁住的是 13.67 GiB 主机内存，而且是锁页内存。

## 它不省一个字节的 HBM

NPU 侧的 KV 块池仍由 `gpu_memory_utilization` 说了算，这个特性一个字节都不退给你。官方文档的建议恰恰相反：**调低** `gpu_memory_utilization` 会让卸载更活跃 [S22]——NPU 侧块池越小，淘汰越频繁，CPU 池的命中机会越多。被换掉的是主机内存，预留过多会直接把宿主机 OOM 掉（在线版见 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/kv_cache_cpu_offload.html> [S25]）。

所以它的收益只在一种形状上成立：**前缀长、复用率高、而 HBM 装不下全部热数据**。哪段前缀值得留、留多久，是上游块池的 LRU 在管；前缀怎么按哈希匹配、为什么命中的是「块」而不是任意长度，见 [Prefix Caching](prefix-caching.md)。

## 昇腾只换了 worker 侧的搬运，调度侧一行没动

**第一处：连接器仍是上游那个，spec 靠路径塞进去。** 发布分支的 `register_connector()` 里根本没有 `OffloadingConnector` 这一项 [C15]——昇腾不接管这个连接器，所以配置里必须自己写 `spec_module_path` 把昇腾的 spec 指出来：

```python
kv_transfer_config = KVTransferConfig(
    kv_connector="OffloadingConnector",   # 上游的连接器，昇腾没有替换
    kv_role="kv_both",                    # 存与取都开，只写不读没意义
    kv_connector_extra_config={
        "num_cpu_blocks": 1000,           # CPU 池几格，必填 → 13.67 GiB
        "block_size": 128,                # 一格几个 token，须是 NPU 块的整数倍
        "spec_name": "NPUOffloadingSpec",
        "spec_module_path": "vllm_ascend.kv_offload.npu",
    },
)
```

这段可以原样复制 [S20]。**第二处：spec 只做两件事。** `NPUOffloadingSpec.__init__` 上来就查 `num_cpu_blocks`，缺了直接 `raise Exception` [C13]；`get_manager()` 原样返回上游的 `CPUOffloadingManager`，格大小传 `gpu_block_size × block_size_factor`、格数传 `num_cpu_blocks`——**LRU、前缀匹配、什么时候存什么时候取，一行都没重写**；`get_handlers()` 把两个方向都交给同一个 `CpuNpuOffloadingHandler`。

**第三处：CPU 池的形状跟着 NPU 张量走。** handler 给每层开两张 CPU 张量（K 一张、V 一张），dtype 和形状照抄 NPU 侧，只把第 0 维换成 `num_cpu_blocks × block_size_factor`，可用 pinned 就用 pinned [C14]。开完就把它们拍平成一串子张量 `[layer0_key, layer0_value, layer1_key, …]`，预存每个子张量的首地址与「一块多少字节」。真正搬运时靠一次 numpy 广播算出全部源地址、目的地址和长度——**地址在启动时就备好了，模型执行路径上什么都没多做**。

一次搬运的时序解释了下面第一条误解。store（D2H）下发前先 `stream.wait_stream(torch.npu.current_stream())`——KV 是在模型主流上写进去的，D2H 不能在写完之前读；然后同方向的后一笔 `wait_event` 前一笔的 `end_event`，把这个方向串成一条链。拷贝本身是一次 `torch.ops._C_ascend.swap_blocks_batch(src, dst, sizes, direction)`，`direction` 0 是 H2D、1 是 D2H [C12]。完成后 `get_finished` 用 `start_event.elapsed_time(end_event)` 算出实测耗时，连同字节数一起上报——**带宽不是估出来的，是每笔都被量过的** [C24]。到 CANN 那一层，编到 `CANN_MEMCPY_BATCH_ASYNC` 时整批描述符压成**一次** `aclrtMemcpyBatchAsync`，否则退化成逐描述符的 `aclrtMemcpyAsync` 循环 [C29]。

## 两个发布分支与 main：配置键换了一遍

下表的 main 指 2026-09-21 的源码快照，两个发布分支指 v0.23 与 v0.26 各自钉住的那个提交，完整提交号在来源里。v0.26 与 v0.23 在下表每一行上都相同，所以并成一列。main 那一版的实现整个搬了家，住进 `vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/` 下；只有最底下那段 `swap_blocks_batch` 的 C++ 三版逐字相同。

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 怎么插进去 | 注册表里没有 `OffloadingConnector`，靠配置里的 `spec_module_path` 把 spec 塞进去 | 连接器名和上游两个 spec 名都被就地换成昇腾实现 [C5] | 发布分支的配置照抄到 main，`spec_module_path` 指的模块已经不在那个路径上 [!] |
| 容量参数 | `num_cpu_blocks`，格数，**必填**，缺了直接抛异常 [C13] | `cpu_bytes_to_use`，字节，全服务器预算 [S2] | 同一个位置换了单位，迁移必须自己换算，别指望旧键还被认 [!] |
| 分块参数 | `block_size`：一格的 token 数，须为 NPU 块的整数倍 [S4] | `blocks_per_chunk` 与 `block_size` **二选一**，互斥 | 前者是绝对值、后者是倍数，迁移时要换算 |
| CPU 池张量 | 每层固定两张，保留原 dtype 与形状 | 每个规范视图一张 int8 二维 `[格数, page_size × blocks_per_chunk]` [C9] | main 的池按字节寻址，与模型布局解耦 |
| 多级卸载 | 没有 | `TieringOffloadingSpec` 加文件系统二级 tier，必须走共享 mmap | 只有 main 能把冷数据再往下压一层，但那一路没有 pinned 的带宽保证 [!] |
| 传输流 | 每方向一条固定流 `d2h_stream` / `h2d_stream` | 每笔从 `_stream_pool` 取一条、用完回收 | 并发度不变：同方向仍被 `end_event` 串行 |
| e2e 用例 | 整条 `@pytest.mark.skip`，理由写着 cpu offload connector 已废弃 [C16] | 正常跑，且断言 CPU 命中必须快过冷启动 | 发布分支上这条路没有 CI 守着，升级 CANN 或 torch_npu 后要自己压一遍 [!] |

## 常见误解

- **「两个方向 = D2H 和 H2D 并行跑满带宽。」**——两个 handler 只保证两个方向互不阻塞、且都不阻塞模型主流。同一方向内部，后一笔显式 `wait_event` 前一笔的结束事件，是严格串行的。
- **「开了卸载就能省 NPU 显存。」**——不能。NPU 侧块池的大小完全由 `gpu_memory_utilization` 决定，这个特性只是给被淘汰的块在主机内存里留了个副本；官方建议反过来**调低**它好让卸载更活跃。花掉的是主机内存，`num_cpu_blocks: 1000` 在那条请求的模型上就是 13.67 GiB 锁页内存。
- **「`num_cpu_blocks` 数的是 token，或者是字节。」**——都不是，它数的是 CPU 格，一格 `block_size` 个 token。官方文档专门写了一句「每格占用正比于 `block_size × num_layers × (key_size + value_size)`」提醒你自己乘 [S4]。main 上换成 `cpu_bytes_to_use` 之后才轮到字节。
- **「发布分支上没跑通，是我配错了。」**——先看 CI：这条路的 e2e 用例在两个发布分支上是整条 skip 掉的 [C16]，官方自己也没在跑。配置照上面那段抄，跑不起来就是真有问题，不是你写错了键。
