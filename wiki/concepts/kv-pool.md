---
id: kv-pool
title: "KV Pool：命中的前缀不再只能来自本卡显存"
type: feature
summary: 把算好的 KV 块存进显存之外、多台机器都读得到的存储池；开头相同的请求先用显存里已有的块，缺的整块再从池里搬回来，不用重算。
aliases: [KV Pool, KV Cache Pool, KV 缓存池, Ascend Store, AscendStoreConnector]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L3-L44
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L3-L15
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L38-L52
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L46-L81
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L104-L147
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L321-L342
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L234-L253
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L409-L452
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L574-L626
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L166-L189
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1146-L1161
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L37
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L815-L830
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1004-L1035
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1085-L1173
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2595-L2639
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1175-L1186
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L116-L126
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L66-L76
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L436-L464
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L40-L55
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L52-L75
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L121-L142
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L19-L35
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L3254-L3264
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L108-L119
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L405-L415
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L148-L153
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L114-L124
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L249-L258
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L99-L103
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L248-L256
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L27-L38
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L175-L185
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L136-L146
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L254-L286
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L307-L312
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L355-L365
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L12-L42
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 池查询把显存里已命中的 token 数当起点，只把多出来的那一段搬进来；命中的单位同样是写满的块
  - to: paged-attention
    kind: builds-on
    note: 池里一条 key 对应显存里一个块在本卡上的全部层，地址由 block_id × block_stride 直接算出
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样是把 KV 挪出显存，但落点是跨节点共享的外部存储池，而不是本机主机内存
  - to: vllm-v1-shape
    kind: builds-on
    note: 默认非 layerwise 路径用 ZMQ 把命中查询交给 Worker，跨的是那一页讲的调度器与 Worker 两个进程
contradicts: []
updated: "2026-09-25"
---

KV Pool 把算好的 KV 块从本卡显存里挪出来，放进一个**主机内存、SSD、别的节点都看得见**的外部存储池。它不替代[前缀缓存](prefix-caching.md)，而是接在它后面：**显存里命中到第几个 token 是起点，池只补上多出来的那几块**。

```wiki-diagram
file: kv-pool
```

## 同一段开头，换一台机器还得重算吗

设想一份 4096 个 token 的长文档，前面有人拿它问过一次，这次你拿同一份文档再问。如果上次的请求恰好落在同一台机器上、它的 KV 块还没被挤出显存，[前缀缓存](prefix-caching.md)会直接复用那些块，不重算。可部署里往往有很多台机器，上次那条请求多半在别处，或者它的块早被新请求挤掉了——前缀缓存只认本卡显存，这时只能从头算一遍。

KV Pool 回答的就是这个问题：把算过的块存到一个**所有机器都能读、容量比显存大得多**的地方。下次开头相同的请求来了，先看显存里命中了几块，不够的再去池里问；池里有，就把那几块搬回显存，省掉重算。

## 池只补显存里没有的那一段

一条请求进来时，前缀缓存先数一遍：显存里已经有前几个 token 的块。这个数会一起报给池，池回一句「我这里一共命中到第几个 token」。两者相减，才是真正要从池里搬回来的量；前面那段直接用显存里现成的块。官方文档把这叫「只取多出来的块，其余直接用片上的」。

这就是 KV Pool 和前缀缓存的接缝。所以关掉前缀缓存，池也就没有可衔接的起点了。

池认块的方式也和前缀缓存一样：拿「这一块里是哪些 token、前面接着什么」算一个指纹，按指纹问「在不在」。池只知道块在不在，不知道块里装的是什么。

## 那条请求走不到池里：差一整块

[那条请求](one-request.md)的问题只有 37 个 token。给它开上 KV Pool，池根本不会被问到。

原因在「只认写满的块」：默认设置下，查询之前先把问题长度向下取整到整块。这个模型在两颗 NPU 上一个块是 2048 个位置，37 向下取整到 2048 的倍数是 0，连一块都凑不出来，于是直接跳过查询。

这对这个模型格外明显。它的块比纯注意力模型大得多——块大小是倒着从线性注意力那 30 层的状态算出来的（见[那条请求](one-request.md)），所以一个问题少于 2048 个 token 时，KV Pool 对它不起任何作用。

## 拉长到 4096 个 token 算一笔账

把问题拉长到 4096 个 token，其余设定不变（两颗 NPU，每颗一份）：

| 这一步在算什么 | 值 | 从哪来 |
|---|---|---|
| 切成几块 | 4096 / 2048 = **2 块** | 一块 2048 个位置 |
| 全注意力部分，一块多大 | 2048 × 10 KiB = **20 MiB**（每颗 NPU） | 全注意力 10 层，每 token 每层每颗 1 KiB，见[那条请求](one-request.md) |
| 全注意力部分全量存进池 | 2 × 20 MiB = **40 MiB**（每颗 NPU） | |
| 官方示例里每颗卡借给池多少 | **1 GB**，按 20 MiB 一块算约五十块 | 这是**每张卡**贡献给池的量，不是全池容量 |

这张表只算了全注意力那 10 层的 KV。线性注意力那 30 层的状态也会按块存进池，它们单独成条，这一页没有核到每条搬多少字节，所以没算进去。

示例值只够跑通流程。上生产要按「并发 × 前缀长度 × 每 token 的 KV」重估；换成一颗 NPU 独跑时，每颗要存 2 个 KV 头，每 token 每层 2 KiB，上面的数都翻倍。

## 查表跨一次进程，搬数据直接按地址

「池里有没有」这个问题，是调度器问的，但调度器自己不去翻池：它把问题交给其中一个 [Worker](npu-worker-lifecycle.md) 进程里的后台线程代查，答案是一个数——池里一共命中到第几个 token。

真正搬数据时就很直白了：搬的源和目的都是 KV 块在显存里的**原始地址**。启动时先把这些显存区间登记给存储引擎，之后存和取收的就是一串「地址 + 长度」，中间不经过额外的中转区。官方设计文档说，这样做就是为了用上贴合昇腾硬件的传输方式。

背后的存储引擎有三种可换，配置里写名字就行。

## 换切分、换版本，池里的旧数据就对不上

池里每条记录的名字不只是块的指纹，前面还拼着模型名、这张卡在各种并行切分里的编号、属于哪一组缓存。所以：

- **换模型、换[张量并行（TP）](tensor-parallel.md)等切分方式**，池里的旧数据一条都对不上。
- **升级版本也算换**：三个版本拼名字的格式各不相同，两两不通用，升级等于清空池。

另一个后果是：一条记录一次覆盖同一个块在本卡上的全部层，层不是名字的一部分。

## 默认只有 P 节点碰池；读要等，写交给后台

在 [PD 分离](pd-disaggregation.md)部署里，D 节点默认既不从池里读、也不往池里写，它要的 KV 由 P 节点点对点送过去；池只服务 P 节点。两个方向的快慢不一样，这决定了它压在哪一段时间上：

- **读默认要等。** 从池里取块这一步不做完，这一步的计算不开始，耗时算进这一步。
- **写交给后台，但不是完全不等。** 算完之后把「要存哪些块」交给一个后台线程去存；后台线程开存之前会先确认这一步的计算真的把 KV 写进显存了。

## 常见误解

- **「那个查询端口号是个网络端口，要挑没被占用的。」**——不是。它只是拼进本机一条进程间通信路径的一段编号，唯一性只在同一台机器上的实例之间有意义，跟端口占用无关。
- **「开了 KV Pool，前缀缓存就被替代了。」**——反过来，它建立在前缀缓存之上：命中先在显存里算，池只补上多出来的那一段。
- **「池里查到了就一定能用上。」**——取块失败的话，默认处理是让这条请求直接报错终止；要让它退回重算得另外配置，而且混合注意力模型（本例这种）目前还不支持退回重算。
- **「混合模型用不了 KV Pool。」**——三个版本都给混合模型留了路：一开 KV Pool，线性注意力的状态会被自动改成按块对齐存放，这样状态也能跟着 KV 块一起存取。是否在本例这个模型上端到端跑通，这一页没有核到。

## 对照源码

### 怎么开

一份能直接跑的 PD 混部配置（`kv_both` = 既读也写池）[S1]：

```bash
export PYTHONHASHSEED=0   # 所有节点必须一致，否则块哈希对不上
KV_CONFIG='{
  "kv_connector": "AscendStoreConnector", "kv_role": "kv_both",
  "kv_connector_extra_config": { "backend": "mooncake", "lookup_rpc_port": "0" }
}'
```

- 昇腾侧的实现是 `AscendStoreConnector`，挂在 vLLM V1 的 KV Connector 接口上 [C5]；`backend` 可选 `mooncake` / `memcache` / `yuanrong` [C13][C22]。
- `lookup_rpc_port: "0"` 是本节点第一个实例，第二个改 `"1"`。它只是拼进 IPC 套接字路径 `ipc://$VLLM_RPC_BASE_PATH/lookup_rpc_port_<n>_dp_rank<r>` 的一段字符串，不是 TCP 端口。
- 示例配置里的 `global_segment_size: "1GB"` 是**每张卡**贡献给池的内存 [S27]。
- 角色开关：`kv_role == "kv_consumer"` 且没开 `consumer_is_to_load` 时 `get_num_new_matched_tokens` 第一行就返回 0 [C10]；写回由 `consumer_is_to_put` 把关；两者和 `load_async` 默认都是 `false`（main `pool_scheduler.py` L99–L105）。
- `discard_partial_chunks` 默认为真：先把 prompt 长度向下取整到传输粒度，不足一个粒度直接 `return 0, False`。传输粒度 = 各 group `block_size`（乘 DCP）的 lcm，再与本 rank 负责的各 group 取 lcm [C24][C38]。本例 TP=2、DCP=1，块 2048，所以 `37 // 2048 × 2048 = 0 < 2048` [D]。
- 混合模型：三个分支都在 `patch_mamba_config` 里用 `_using_kv_store` 判断是否用了 `AscendStoreConnector`（main 还认 `MultiConnector` 里套着它的情形）[C35][C41]；是且未关 hybrid KV cache manager 时，把 `mamba_cache_mode` 从 `none` 改成 `align`；开了前缀缓存且为 `align` 时 `mamba_block_size = block_size` [C36][C37]。于是线性注意力组与全注意力组的块大小都是 2048，粒度仍是 2048 [D]。每个 group 各自一条 `KeyMetadata`，状态组（align）用 `tp_rank`，全注意力组用 `head_or_tp_rank`，注释写明「mamba 的 kv_heads 和全注意力不同，不能共用缓存数据」[C40]。

### 会报什么错

- `backend` 名字写错：启动即 `ValueError: Unsupported KV pool backend`，不会静默退回默认值 [C11]。
- main 上的 `qos_priority` 要求整数 0–4、越大越优先，类型错或越界同样是启动即 `ValueError` [C25]。
- main 的 mooncake + layerwise 只支持纯 TP：PP / PCP / DCP 任一 > 1 就 `ValueError` [C23]。
- 混合模型上手动把 `mamba_cache_mode` 设成 `align` 以外的值：`AssertionError: mamba_cache_mode only support 'align' when kv_transfer enabled now!`。
- 混合模型再配 TP 不匹配（本地 TP 与对端 TP 不同）：main 上 `NotImplementedError`，strided I/O 只假设一个稠密 KV group [C39]。
- `get` 返回非 0 的块会被记进 `_invalid_block_ids` [C16]，而 vLLM 侧 `kv_load_failure_policy` 默认是 `fail`，请求直接报错终止；要退回重算必须显式配 `recompute`，且混合注意力模型还不支持 [S1]。

### 开销和什么时候别开

- **短请求用不上**：粒度等于块大小时，问题短于 2048 个 token 的请求连查询都不发[D]。对 Qwen3.6-35B-A3B 这类块很大的混合模型，池只对长前缀有意义。
- **一块的体量**：TP=2 每颗 NPU、全注意力 10 层合计 `2048 × 10 KiB = 20 MiB`；TP=1 每颗 2 个 KV 头，`2048 × 20 KiB = 40 MiB` [D]（每 token 每层的值见 [one-request](one-request.md)）。「每 token 多少字节」只对 GQA 这种 K、V 分两张张量的布局成立：`prepare_value` 对该 group 的每个 cache 张量各生成一条 `(addr, size)` [C21]，一层注册成几个张量由注意力后端交上来的结构决定，MLA 把 KV 合成一张就对不上了 [D]。
- **读默认同步**：`load_async` 不开时，`start_load_kv` 里直接调 `m_store.get(...)`，耗时算进前向。
- **写在后台但有栅栏**：`wait_for_save` 录一个 `torch.npu.Event` 后把请求塞进发送线程队列；发送线程真正 `put` 之前 `current_event.synchronize()`，确保前向已把 KV 写进显存 [C18]。v0.23 / v0.26 在本步末尾 `request_queue.join()` 等队列排空；main 挪到了下一步开头（见版本差异）[C17]。
- 容量：生产环境按「并发 × 前缀长度 × 每 token KV」重估 `global_segment_size`，示例的 1 GB 只够跑通 [S27]。

### 版本差异

下表对照 **v0.23 维护分支**（源码快照 `2c59ff10`）、**v0.26 分支**（`2ed6cbba`）与 **main 开发主线**（2026-09-21 的源码快照 `baa023ad`）。此外 main 把 `config_data.py` 改名成 `metadata.py`、`backend/backend.py` 改名成 `backend/base.py`，v0.26 仍用 v0.23 那两个文件名——那只是重构，import 路径不兼容，数据兼不兼容看下表第一行。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| key 串开头 | `@pcp<n>@dcp<n>@…` [C20] | `@pcp:<n>@dcp:<n>@…` [C30] | 去掉 `pcp`，只剩 `@dcp:<n>@…` [C19] | [!] 三版的池数据两两不通用，升级等于清池 |
| layerwise 下 Decode 写不写池 | `save_kv_layer` 只看 `kv_role`，是 consumer 就直接 return | 和非 layerwise 一样看 `consumer_is_to_put` | 同 v0.26，只是抽成 `is_kv_save_role()` | [!] 同时开 `use_layerwise` 和 `consumer_is_to_put` 的 Decode 节点，只有 v0.23 仍不写池 |
| mooncake + layerwise | 没有这条路，`use_gva_layerwise` 写死只认 `memcache` | 同 v0.23，仍只认 `memcache` | 多一条 mooncake 专属的 block-key 路径，且只支持纯 TP：PP / PCP / DCP 任一 > 1 就 `ValueError` | main 新增，但用户文档的参数表仍写着 `use_layerwise` 需要 `memcache` [S1]——照文档配会漏掉它；逐层传输本身见 [Layerwise KV Offload](kv-cache-layerwise-offload.md) |
| 写回等在哪一步 | `wait_for_save` 末尾 `request_queue.join()`，本步不排空不返回 | 同 v0.23 | `wait_for_save` 只登记一个 save batch 就返回，改由下一步的 `handle_preemptions` → `wait_for_previous_save()` 等它落地 | [!] main 上写回真正跨出了本步，profiling 里这段耗时记在下一步的开头；栅栏挪到了「块被复用之前」，不是「本步结束之前」 |
| 混合模型自动改 `mamba_cache_mode=align` | 有 | 有 | 有 | 三版一致 |

### 源码位置

默认非 layerwise 查询路径（图里画的就是这一段）：

- 同一个 `AscendStoreConnector` 类按角色分两种：`KVConnectorRole.SCHEDULER` 造 `KVPoolScheduler`，其余造 `KVPoolWorker`；**只有 `rank == 0` 且没开 layerwise 的 worker** 才额外起一个 `LookupKeyServer`[C9]。
- 调度器侧 `get_num_new_matched_tokens` 用 `LookupKeyClient` 经 ZMQ 去问这个 REP 后台线程，把 vLLM 算出的 `num_computed_tokens` 当作 `hbm_hit_tokens` 一起发过去；答案是 **4 个字节的大端整数**，返回值减掉 `hbm_hit_tokens` 才是要搬的量 [S4]。worker 侧把这段 token 的块哈希拼成 key，整批丢给存储引擎问 `exists`。
- **不能据此推成「调度器没有存储客户端」**：main 的 `KVPoolScheduler` 构造时会调用后端的 `create_scheduler_client`；layerwise 查询按数据面另走分支，不经过上面这条默认 ZMQ 路径。逐层模式见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)。
- 搬运：`register_buffer` 把 KV cache 张量的 HBM 区间登记给存储引擎，`put` / `get` 收裸地址列表和长度列表，没有 LMCache 那样的中转 buffer；不把 MooncakeStore 挂在 LMCache 的 remote backend 后面，是为了用贴合昇腾硬件的传输策略 [S3]。地址 = `base_addr + block_id × block_stride`。
- key 串里依次是模型名、各并行维度的 rank、group、cache_role、cache_family，最后是块哈希；非 layerwise 模式下层不进 key。

| 看什么 | 文件（main） |
|---|---|
| 查询入口、粒度取整 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py`，`get_num_new_matched_tokens` |
| 粒度与各 group 块大小 | `.../ascend_store/metadata.py`，`infer_group_block_sizes`、`infer_cache_transfer_granularity` |
| 角色分派、`LookupKeyServer` | `.../ascend_store/ascend_store_connector.py` |
| 读写、`exists`、每 group 的 `KeyMetadata` | `.../ascend_store/pool_worker.py` |
| 地址计算 `prepare_value` | `.../ascend_store/metadata.py` |
| 后端注册与校验 | `.../ascend_store/backend/__init__.py`、`backend/base.py` |
| 混合模型自动 `align` | `vllm_ascend/patch/platform/patch_mamba_config.py` |
