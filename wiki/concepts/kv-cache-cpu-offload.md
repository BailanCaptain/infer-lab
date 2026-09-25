---
id: kv-cache-cpu-offload
title: "KV Cache CPU Offload：把要被淘汰的块存进主机内存"
type: feature
summary: 显存里的 KV 块被挤掉之前，先拷一份到主机内存；之后有请求用到同一段开头、显存里却已经没了，就从主机内存拷回来，省掉重算。昇腾只换了真正搬字节的那一段。
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L226-L299
  - vllm@0fc695fc:vllm/v1/kv_offload/base.py#L393-L442
  - vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L30-L63
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L20-L32
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L95-L102
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 回填只在 NPU 前缀缓存未命中、而主机内存池里还存着同一段前缀时触发；没有前缀缓存这条路径永远不会走到
  - to: paged-attention
    kind: builds-on
    note: 卸载与回填的最小单位就是分页 KV 块，主机内存里的一段由整数个 NPU 块拼成
  - to: kv-cache-spec
    kind: builds-on
    note: 一段的字节数直接由每块每层的 page_size_bytes 乘这个倍数得出
  - to: recompute-cpu-offload
    kind: alternative-to
    note: 那一页的触发条件是调度器抢占某条请求、按请求点名搬走；这一页的触发条件是块池 LRU 淘汰，搬的是碰巧要被丢掉的块
  - to: kv-cache-sparse-offload
    kind: alternative-to
    note: 那一页让 D 节点的全量主 KV 常驻主机内存、每步按 top-k 取回；这一页 NPU 仍是主存放地，主机内存只是被淘汰块的备份
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 那一页改的是搬运时机（每层算完立刻发，走 AscendStoreConnector）；这一页的时机由上游块池定，粒度是一整段
contradicts: []
updated: "2026-09-25"
---

显存里的 KV 块被挤掉之前，先拷一份到主机内存；之后有请求用到同一段开头、显存里那几块却已经没了，就从主机内存拷回来。**它是拿搬运换重算，不是省显存**——付一次显存与主机内存之间的来回拷贝，省掉一次把整段开头重新算一遍。

## 先看一个问题

两个人先后把同一份两万 token 的合同贴进来提问。第一个人问完，这两万 token 的 KV Cache 还留在显存里；如果第二个人来得早，[前缀缓存](prefix-caching.md)直接把那些 KV 块拿来用，一步都不用重算。

麻烦在中间隔了一阵子。这段时间别的请求源源不断，显存里的 KV 块池满了，要给新来的腾地方，最久没人用的块先被挤掉——正好是那份合同的。第二个人一来，前缀缓存扑空，两万 token 只能从头再算一遍。

显存就那么大，挤掉是免不了的。可主机内存（CPU 那边的内存）通常大得多：**被挤掉之前，能不能先在主机内存里留个底，下次要用时再拷回来？** 这一页讲的就是这件事。

```wiki-diagram
file: kv-cache-cpu-offload
```

## 它做了什么：一存一取

**存。** 显存里一个块要被挤掉之前，系统先把它异步拷一份到主机内存。「异步」的意思是拷贝走专门的通道，不耽误模型接着算。

**取。** 新请求进来，先照常在显存里找同样开头的块；找不到，再去主机内存里找。那边有，就拷回显存，这段开头就不用重算了。

哪些块该存、主机内存满了先扔谁、新请求的开头能不能对上，这些决定全是上游 vLLM 做的，按「最久没用的先扔」管主机内存那边的池子。昇腾只换掉了最底下那一层：**真正把字节从显存拷到主机内存、再拷回来的那段代码**，因为这一段和硬件直接打交道。

有一点要先知道：主机内存那边不是一个块一个块地管，而是**几个块拼成一段**，一段一段地存、一段一段地取。凑不满一段的尾巴，不存。

## 拿 Qwen3.6-35B-A3B 算一笔账

沿用[一个请求的全过程](one-request.md)那一页的设定：Qwen3.6-35B-A3B，两颗 NPU 把注意力对半分。下面的数都是**一颗 NPU 上的量**，另一颗对称。

先回忆那一页算好的几个数：这个模型 40 层里只有 10 层是全注意力，它们才有 KV Cache；每颗 NPU 每层给每个 token 存 1 KiB，10 层合计 10 KiB。一个 KV 块是 2048 个 token，所以**一个块在一颗 NPU 上是 20 MiB**。

再看开发主线官方示例的写法：主机内存一共给 8 GiB（两颗 NPU 合起来算），一段拼 8 个块。代进这个模型：

| 算什么 | 值 |
|---|---|
| 一段有多少 token | 8 × 2048 = **16,384 个** |
| 一段在一颗 NPU 上多少字节（只算全注意力的 KV） | 8 × 20 MiB = **160 MiB** |
| 两颗 NPU 合起来一段多少字节 | 2 × 160 MiB = **320 MiB** |
| 8 GiB 最多装几段 | 8192 ÷ 320 = 25.6，**最多 25 段**，约 40 万 token |

「最多」是因为这里只算了全注意力那部分；线性注意力的状态也要跟着存（下一节），每段实际更大，能装的段数只会更少。

这张表里最该记住的是第一行。**一段就要一万六千多个 token**——那条[一个请求](one-request.md)里的 237 个 token 连一个块（2048）都没填满，更凑不齐一段，从头到尾一个字节都不会被存。块大是这个模型的特点（为什么大见 [KV 块是怎么分出来的](vllm-kv-block-allocation.md)），拼成段之后更大。对这个模型，把「一段拼几个块」调小是第一件要想的事。

## 线性注意力那 30 层怎么办

这个模型另外 30 层是[线性注意力](linear-attention.md)，它们不存 KV Cache，而是每条请求一份固定大小的状态（每颗 NPU 每层约 1 MiB）。只把那 10 层的 KV 拷回来是不够的——线性注意力那 30 层的状态缺了，拷回的开头照样接不上。

开发主线上，这一路认识这种状态：搬运时把它和 KV 块一起登记，而且按状态本身的大小拷，不带显存里为了对齐补出来的那一半空白。

两个已发布版本上，这一路是照「每层一对 K、V」写的，而且要求整个模型只有一种块大小。这个模型既有 KV 块又有线性注意力状态，按代码看大概率一启动就会被这条要求拦下；我们没有在机器上实跑确认。**想在这个模型上用它，看开发主线。**

## 它不省一个字节的显存

显存里给 KV 块池划多大，还是由启动时的显存占比说了算，这个特性一个字节都不退给你。官方文档的建议恰恰相反：把显存占比**调低**，块池小了，挤掉得更频繁，主机内存那边命中的机会才更多。

花掉的是主机内存，而且是锁页内存（被钉住、不能被系统换出去的那种）。给得太多，会把宿主机本身的内存挤爆。

所以它只在一种形状上划算：**开头很长、经常被重复用到、而显存装不下全部热数据。** 对这个模型还要再加一条：重复的开头得比一段长。

## 搬运是怎么做的

昇腾换掉的那一段做了三件事：

- **两条专用通道。** 显存到主机内存一条，主机内存到显存一条，互不阻塞，也都不挡模型计算。但同一条通道里，后一笔要等前一笔拷完，是排队的。
- **存之前先等模型写完。** KV 是模型计算时写进显存的，拷走之前得确认它真的写好了。
- **一次发一大批。** 一段里每层、K 和 V 各一份，各自的起止地址在启动时就算好，拷的时候整批一次交给底层驱动，而不是一份一份地发。每一笔拷完都实测一次耗时，带宽是量出来的，不是估的。

## 常见误解

- **「两条通道，存和取就能并行跑满带宽。」**——两条通道只保证存和取互不阻塞。同一个方向内部，后一笔等前一笔，是串行的。
- **「开了就能省显存。」**——不能，见上一节。它只是给被挤掉的块在主机内存里留了个底。
- **「主机内存给得越大越好。」**——那是锁页内存，给多了宿主机自己不够用。先按上面的表算清一段多大、想存多少 token。
- **「发布版本上没跑通，是我配错了。」**——先看两件事：这一路在两个发布版本上的自动测试是整条跳过的，官方自己没在跑；而且配置写法和开发主线完全不同，照主线文档抄到发布版本上本来就不认。

## 对照源码

### 怎么开

**v0.23 与 v0.26 分支**（两边这一页一条不差：实现同在 `vllm_ascend/kv_offload/` 下，`npu.py` 与 `cpu_npu.py` 逐字相同 [C26]，官方文档给的也是同一套键 [S19]）。连接器仍是上游的 `OffloadingConnector`，发布分支的 `register_connector()` 里根本没有这一项 [C15]，所以必须自己写 `spec_module_path` 把昇腾的 spec 指出来 [S20]：

```python
kv_transfer_config = KVTransferConfig(
    kv_connector="OffloadingConnector",   # 上游的连接器，昇腾没有替换
    kv_role="kv_both",                    # 存与取都开，只写不读没意义
    kv_connector_extra_config={
        "num_cpu_blocks": 1000,           # 主机侧几段，必填
        "block_size": 128,                # 一段几个 token，须是 NPU 块的整数倍
        "spec_name": "NPUOffloadingSpec",
        "spec_module_path": "vllm_ascend.kv_offload.npu",
    },
)
```

这是官方示例原样，示例模型是纯注意力的 Qwen3-0.6B。`block_size` 须为 NPU 块的整数倍 [S4]；**对 Qwen3.6-35B-A3B，NPU 块是 2048，128 不是它的倍数**，要写至少 2048 [D]。每段占用正比于 `block_size × num_layers × (key_size + value_size)`，文档提醒你自己乘 [S4]。

spec 只做两件事：`NPUOffloadingSpec.__init__` 查 `num_cpu_blocks`；`get_manager()` 原样返回上游的 `CPUOffloadingManager`，段大小传 `gpu_block_size × block_size_factor`、段数传 `num_cpu_blocks`，LRU、前缀匹配一行没重写 [C13]；`get_handlers()` 把两个方向都交给同一个 `CpuNpuOffloadingHandler` [C23]。handler 给每层开两张 CPU 张量（K、V 各一），dtype 与形状照抄 NPU 侧，只把第 0 维换成 `num_cpu_blocks × block_size_factor`，可用 pinned 就用 pinned；随后拍平成 `[layer0_key, layer0_value, layer1_key, …]`，预存每个子张量的首地址与 `stride(0) × element_size` [C14]。

store（D2H）下发前先 `stream.wait_stream(torch.npu.current_stream())`；同方向后一笔 `wait_event` 前一笔的 `end_event`；拷贝本身是一次 `torch.ops._C_ascend.swap_blocks_batch(src, dst, sizes, direction)`，`direction` 0 是 H2D、1 是 D2H [C12]。`get_finished` 用 `start_event.elapsed_time(end_event)` 算实测耗时，连同字节数上报 [C24]。编到 `CANN_MEMCPY_BATCH_ASYNC` 时整批描述符压成一次 `aclrtMemcpyBatchAsync`，否则退化成逐描述符的 `aclrtMemcpyAsync` 循环 [C29]。

**main**：连接器名和上游两个 spec 名都被就地换成昇腾实现 [C5]，配置直接写上游名字 [S35]：

```python
kv_transfer_config = KVTransferConfig(
    kv_connector="OffloadingConnector",
    kv_role="kv_both",
    kv_connector_extra_config={
        "cpu_bytes_to_use": 8 * (1 << 30),   # 全部 worker 合计的字节预算，必填
        "blocks_per_chunk": 8,               # 一段拼几个 NPU 块；与 block_size 二选一
        "spec_name": "CPUOffloadingSpec",    # 多级卸载写 TieringOffloadingSpec
    },
)
```

参数含义见 [S2]：`cpu_bytes_to_use` 是全服务器的主机内存预算；`blocks_per_chunk` 与 `block_size` 互斥，后者只在所有 KV 缓存组块大小相同时可用。

上半那张账的推导 [D]：每颗 NPU 每块 20 MiB 取自 [one-request](one-request.md) 的已核值（`2 × 1 KV 头 × 256 × 2 B = 1 KiB`/token/层 × 10 层 × 2048）；模型形状见 [S31]。一段 = `blocks_per_chunk × block_size`，e2e 用例就是这么算的 [C11]。段数按上游检出的算法：每段字节 = NPU 上全部 KV 张量总字节 ÷ 块数 × `world_size` × 倍数，再按对齐向上取整，`cpu_bytes_to_use` 整除它 [C34]。这里只放进了全注意力的 KV，线性注意力状态也在 KV 张量里，所以 25 是上限。

线性注意力状态：main 的 `AscendOffloadingConnectorWorker.register_kv_caches` 对 `MambaSpec` 层把每个状态张量登记成视图，拷贝字节数是去掉补齐的 `page_size_bytes`（`replace(layer_spec, page_size_padded=None)`）[C32]。发布分支的 `get_manager()` 与 `get_handlers()` 都 `assert len(self.gpu_block_size) == 1` [C13][C23]，handler 对每层固定按下标 0、1 取 K、V [C14]。上游检出里 `gpu_block_size` 是「每个 KV 缓存组一个值」[C33]，混合模型不止一组，据此推断发布分支在 Qwen3.6-35B-A3B 上过不了这条断言 [D]；但我们检出的上游不是发布分支配套的那一版（发布分支导入的 `vllm.v1.kv_offload.spec` 在检出里不存在），这条没有实跑核过 [!]。

### 会报什么错

- 发布分支缺 `num_cpu_blocks`：`raise Exception("num_cpu_blocks must be specified in kv_connector_extra_config")` [C13]。
- main 缺 `cpu_bytes_to_use`：上游 spec 抛 `cpu_bytes_to_use must be specified in kv_connector_extra_config` [C34]。
- `block_size` 不是 NPU 块的整数倍：上游 `assert offloaded_block_size_int % gpu_block_size == 0` [C33]。对这个模型写 128 就会撞上 [D]。
- 各组块大小不同却写了 `block_size`：上游断言 `If 'block_size' is specified in kv_connector_extra_config, ... all groups must have the same block size.` [C33]。
- 块大小不能被前缀哈希的块大小整除：上游断言信息里直接提示 `Hybrid models (e.g. Mamba+Attention) need --enable-prefix-caching to align block sizes.` [C33]。
- main 上线性注意力状态张量不是非空 list：`TypeError: Mamba KV cache for ... must be a non-empty list`；状态字节数和 spec 对不上：`ValueError: Mamba KV cache page size mismatch ...` [C32]。
- 发布分支的配置照抄到 main：`spec_module_path` 指的 `vllm_ascend.kv_offload.npu` 已经不在那个路径上，实现整个搬进了 `vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/` [!]。

### 开销和什么时候别开

- 不省 HBM：NPU 侧块池仍由 `gpu_memory_utilization` 决定；官方建议调低它让卸载更活跃 [S22][S1]。
- 主机内存是锁页的，预留过多会让宿主机 OOM（v0.23 在线版 [S25]；main 文档 [S3]）。
- `TieringOffloadingSpec` 必须用共享 mmap 做一级 tier，CANN 没有等价于 CUDA 任意 mmap 注册的接口，这一路**没有 pinned 的带宽保证**，要在目标机器上另测 [S3]。main 的 e2e 也只对 CPU-only 那一路断言「CPU 命中快过冷启动」[C11]。
- 段越大，命中粒度越粗：文档调 `blocks_per_chunk` 时专门提醒了这一点 [S36]。对块大小 2048 的混合模型，`blocks_per_chunk: 8` 意味着短于 16,384 token 的前缀永远不会被存 [D]。不满一段的尾巴不搬，e2e 用例为此把 prompt 垫成「整数段 + 1 个 token」才去断言收到存事件 [C28][C11]。
- 上游检出里 `offload_prompt_only` 默认 `True`，只存 prompt 阶段的块，decode 生成的块不存 [C33]；是否与各分支配套的上游一致没有核到。

### 版本差异

main 指 2026-09-21 的源码快照，两个发布分支指 v0.23 与 v0.26 各自钉住的提交。v0.26 与 v0.23 在下表每一行都相同，并成一列。只有最底下那段 `swap_blocks_batch` 的 C++ 三版逐字相同。

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 怎么插进去 | 注册表里没有 `OffloadingConnector`，靠 `spec_module_path` 把 spec 塞进去 [C15] | 连接器名和上游两个 spec 名都被就地换成昇腾实现 [C5] | 发布分支的配置照抄到 main，`spec_module_path` 指的模块已经不在那个路径上 [!] |
| 容量参数 | `num_cpu_blocks`，段数，**必填** [C13] | `cpu_bytes_to_use`，字节，全服务器预算 [S2] | 换了单位，迁移必须自己换算 [!] |
| 分块参数 | `block_size`：一段的 token 数，须为 NPU 块整数倍 [S4] | `blocks_per_chunk` 与 `block_size` **二选一** [S2] | 前者绝对值、后者倍数 |
| CPU 池张量 | 每层固定两张，保留原 dtype 与形状 [C14] | 每个规范视图一张 int8 二维 `[段数, page_size × blocks_per_chunk]` [C9] | main 的池按字节寻址，与模型布局解耦 |
| 线性注意力状态 | 按「每层一对 K、V」写，且只认一种块大小 [C13][C14] | `MambaSpec` 层单独登记、按去补齐的字节拷 [C32] | 混合模型只看 main [D] |
| 多级卸载 | 没有 | `TieringOffloadingSpec` 加文件系统二级 tier，必须走共享 mmap [S1][S3] | 冷数据能再往下压一层，但没有 pinned 的带宽保证 [!] |
| 传输流 | 每方向一条固定流 `d2h_stream` / `h2d_stream` [C14] | 每笔从 `_stream_pool` 取一条、用完回收 [C8] | 并发度不变：同方向仍被 `end_event` 串行 |
| e2e 用例 | 整条 `@pytest.mark.skip`，理由写着 cpu offload connector 已废弃 [C16] | 正常跑，且断言 CPU 命中必须快过冷启动 [C11] | 发布分支上没有 CI 守着，升级 CANN 或 torch_npu 后要自己压一遍 [!] |

### 源码位置

- 发布分支 spec 与 handler：`vllm_ascend/kv_offload/npu.py`、`vllm_ascend/kv_offload/cpu_npu.py` [C13][C23][C14][C24]
- 发布分支连接器注册表：`vllm_ascend/distributed/kv_transfer/__init__.py` [C15]
- main 连接器、spec、worker：`vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/` 下的 `offloading_connector.py`、`npu.py`、`cpu_npu.py` [C6][C32][C7][C8][C9]
- 批量拷贝算子：`csrc/torch_binding.cpp` 的 `swap_blocks_batch` [C10][C29]
- e2e 用例：`tests/e2e/pull_request/one_card/test_cpu_offloading.py` [C11][C16][C28]
- 上游：`vllm/v1/kv_offload/base.py`（`OffloadingSpec`）、`vllm/v1/kv_offload/cpu/spec.py`（`CPUOffloadingSpec`）[C33][C34]
- 官方文档：main [S17]、v0.23 [S25]
