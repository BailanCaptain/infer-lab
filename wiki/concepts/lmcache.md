---
id: lmcache
title: LMCache：接在引擎外面的一层 KV 缓存
type: feature
summary: LMCache 是装在推理引擎外面的一层 KV cache 缓存，经 vLLM 的 KV connector 插口对接：引擎管调度和显存，它管外部数据并回答能提供到第几个位置。本页讲这条交接边界、按 chunk 取整的账、和 AscendStore 版 KV Pool 的区别，以及 GLM 双机上为什么没开。
aliases: [LMCache, LMCacheAscendConnector, LMCacheConnectorV1, LMCache-Ascend, use_native, chunk]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L61-L65
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py#L1-L5
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py#L83-L115
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py#L259-L342
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py#L120-L198
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py#L1140-L1225
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py#L296-L340
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py#L655-L670
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py#L460-L510
  - vllm@0fc695fc:vllm/config/vllm.py#L1479-L1501
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/factory.py#L54-L61
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L531
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L348-L354
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L3-L24
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L70-L72
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_mp_connector.py#L70-L83
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L61-L65
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L61-L65
  - vllm@0fc695fc:examples/disaggregated/lmcache/kv_cache_sharing_lmcache_v1.py#L26-L41
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: kv-pool, kind: builds-on, note: 复用外部缓存匹配和加载的生命周期}
  - {to: prefix-caching, kind: builds-on, note: 外部前缀复用要求一致的数据身份}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 显存里的缓存没了，还能上哪儿找回来？

**LMCache 是装在推理引擎外面的一层 KV cache 缓存：算过的开头被显存回收以后，它在主机内存、本地磁盘或远端存储里还留着一份；下一条开头相同的请求先问它，问到多少就搬回多少，少做多少 Prefill。**

先认三个前置词。[KV cache](kv-cache.md) 是每个已处理位置在每层留下的历史，后面每一步都要回头读它，它放在显存里，显存紧张就要腾地方。[prefix caching](prefix-caching.md) 让开头相同的请求共用已经算好的块，前提是这些块还在本机显存里。**KV connector** 是 vLLM 在调度器和 worker 两侧留的一组接口，专门把 KV cache 搬进搬出；LMCache 就挂在这个插口上。

看一个例子。请求 A 和请求 B 都以同一份长文档开头，A 先来，把这份开头算了一遍。等 B 到来时，A 的块早被别的请求挤掉了：显存里一段也没剩。没有外部这层，B 只能把同一份文档从头再算一遍；有了它，B 的开头可以从显存之外取回来。

```wiki-diagram
file: lmcache
```

图里的关键是**逐级**：LMCache 自己分层，主机内存、本地磁盘、远端存储各是一项单独的配置，开哪几层由部署决定——主机内存这层也可以整个关掉，只留远端。层数越多、命中的层越远，取回等得越久。逐级取回的具体路径（是不是都要先经过主机内存）和每层的淘汰策略在外部软件包里，本页没有读到，只按它的配置项画出分层。

## 为什么要在引擎外面再加一层

**prefix caching 只认本机显存里还留着的块，两种情况会让它落空：块被挤掉，或者这次请求落在了另一台实例上。** 外部这层把算过的开头放到一个更大、也能被别的实例看见的地方，命中率才上得去。

它省的仍然是 **prefill 的计算**：取回来的位置不再进前向，decode 每步只算新 token，这层帮不上。

代价有五条：

- **命中也要等搬运。** 取回要经过查找、跨进程传输、格式转换，还要先在显存里借到块。搬得越多、命中的层越远，等得越久；划不划算，要拿搬运时间和重算时间比，这笔账要实测，见 [CPU offload 页的持平带宽](kv-cache-cpu-offload.md#搬回和重算各花多少)。
- **写入是常态开销。** 每写满一个单位就往外存一份，不管将来有没有人用。
- **按整单位记账。** 存和取都以一个固定长度的单位为准，开头凑不满一个单位时能省下的往往是 0；凑不满的尾巴到底存不存，由 LMCache 一侧的配置决定。
- **多一套外部依赖。** 存储后端、淘汰策略、名字怎么拼都在 LMCache 一侧，它和 vLLM、vllm-ascend、LMCache-Ascend 插件是各自发版的四个软件，版本要配套。
- **不会让显存池变大。** 缓存池还是启动时切出来的那么多块，被回收的内容只是多了一个找回来的地方。

## 一次外部命中怎么算：按 chunk 取整

**外部这层按 chunk 记账：一个 chunk 是固定个数的连续位置。chunk 有多长、凑不满的尾巴存不存，都由 LMCache 自己的配置决定（`chunk_size`、`save_unfull_chunk`），外部软件包里的默认取值本页没有核到。下面的示意取 chunk = 256 个位置，并假设只存写满的整 chunk。**

这条规则最反直觉的后果是：**两条请求共享的开头有多长，和能省下多少并不相等。** 设一个 chunk 是 256 个位置，A、B 的 prompt 各有 600 个位置，两者共享开头的 500 个：

```calc
title: B 能省下多少（示意：chunk = 256 个位置，且只存写满的整 chunk）
A 存进去 = floor(600 ÷ 256) = 2 个 chunk = 512 个位置，剩 88 个凑不满，不存
B 的第 1 个 chunk = 第 0–255 个位置，和 A 逐字相同 → 命中
B 的第 2 个 chunk = 第 256–511 个位置，其中第 500–511 个已经不同 → 不命中
B 外部命中 = 256 个位置
B 还要自己算 = 600 − 256 = 344 个位置
```

共享 500 个位置，实际只省下 256 个：chunk 按内容整块认，一个 chunk 里只要有一个位置不同，整块就认不出来（查找这一步在外部包里，这里按它以 chunk 为单位、按内容识别的设计推，本页没有读它的实现）。chunk 越大，一次搬得越多、管理项越少，命中也越粗；chunk 越小则相反。

另外三条边界：

- **全中也要留一个位置。** 外部命中覆盖整条 prompt 时，要少报一个：最后一个位置必须真算一次，才能得到下一个 token 的输出。
- **生成出来的位置进不进外部缓存，是一项配置**（`save_decode_cache`，取值由外部包的配置给定）。核到的一条（仅 vLLM 自带的 adapter）：同一条请求重新查询时，拿去问的只有它自己 prompt 的 token，所以被抢占的请求补不回自己已生成的那段。
- **位置数不等于字节数。** 真正搬的是这些位置在每一层、每一种缓存里的数据，字节由缓存布局决定，GLM 的账见下面 GLM 一节。

## 交接边界：引擎管调度和显存，LMCache 管外部数据

**引擎交出去的是「这条请求的 token 和它在显存里的块」，LMCache 交回来的是「从开头起我能提供到第几个位置」和「数据已经搬好了」。存储放在哪、怎么淘汰、名字怎么拼，全在 LMCache 一侧，vLLM 不做假设。**

一条请求经过三个交接点：

1. **调度侧问一次。** 请求进场时（新来的，或者被[抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)后退回队列、算过的进度清零的），调度器问「除了本地已经算过的，你还能多提供几个位置」。拿到数以后，调度器把这些位置当作「已经算过」处理，照常给请求借本地块——借块、排队仍然是引擎的事。
2. **执行侧搬两趟。** 这一步的前向开始之前，worker 侧把外部数据搬进刚借到的块；算完之后，把新写满的部分交出去存。逐层模式下，这两件事按层拆开，和计算交错进行。
3. **请求结束时收尾。** 请求结束要通知外部这层，还没写完的搬运不能连带把块放回池子。

Ascend 上这条链由四段代码拼起来，来自三方，各管一件事：

| 这一层 | 谁提供 | 决定什么 |
|---|---|---|
| 连接器注册名 | vllm-ascend（main 上已移除） | 启动参数写的名字能不能找到类 |
| 包装模块 | vllm-ascend，只有几行 | 先加载昇腾插件包，再把上游的类导出去 |
| 上游连接器 | vLLM | 选哪套 adapter（`use_native`），并把三个交接点转交给它 |
| adapter 与存储实现 | 外部 LMCache 软件包 | chunk 多大、存在哪一层、怎么淘汰、名字怎么拼、失败怎么办 |

所以「注册名存在」只证明能找到类，证明不了这条路跑得通：chunk 大小、尾巴存不存、支持哪些缓存布局、异步加载失败怎么处理，都要钉住实际装的 LMCache 版本才能回答。

## 和 AscendStore 的 KV Pool 有什么不同

[KV Pool](kv-pool.md) 也是接在 KV connector 上、按内容识别前缀的外部存储，两者容易混。区别在**谁实现、数据怎么跟显存对上、以及混合模型支不支持**：

| | LMCache | KV Pool（AscendStore） |
|---|---|---|
| 实现在哪 | 外部软件包，vLLM 只留插口和一层薄包装 | 昇腾自己在 vllm-ascend 里实现 |
| 存取的单位 | chunk，长度由 LMCache 自己的配置给定 | 段，长度由模型各缓存组块长的最小公倍数算出来 |
| 怎么进显存 | 由所选 adapter 按 token 的槽位地址拷 | 启动时把 KV 显存区间登记给后端，存取只交地址和长度，不经中转 |
| 分层 | 主机内存、磁盘、远端各是它自己的一项配置，可以只开其中一层 | 分层由所选后端决定 |
| 混合模型 | 上游这个连接器没有声明支持混合缓存管理器 | 声明支持，接上它不会关掉混合缓存管理 |
| 起名规则 | 由外部软件包定 | 模型名 + 并行编号 + 缓存组 + 状态种类 + 内容指纹，见[起名规则](kv-pool.md#池里一条记录叫什么名字) |

表里「混合模型」那一行是本页和 GLM 最相关的一条，下一节展开。和「把被抢占的请求换出去」「在本机主机内存留一份备份」的区别，见 [KV Pool 的对照表](kv-pool.md#和抢占换出cpu-备份有什么不同)与 [CPU offload](kv-cache-cpu-offload.md)；同样接在这个插口上的还有 [UCM](ucm.md) 和 [PD 分离](pd-disaggregation.md)用的点对点连接器——它们和本页共用一套接口，走的却是不同的数据流，所以「某个模型在 PD 分离上跑通了」推不出「它的外部前缀缓存也能用」，反过来也一样。

## 放到 GLM 双机：没开，而且照钉住的源码推演开不起来

**[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的启动参数里没有 KV 传输配置，所以 LMCache 没开；prefix caching 也关着（[原因](prefix-caching.md#glm-双机上它开着吗)）。更要紧的是：照钉住的源码推演，在这套部署上把它打开会直接起不来，两条路都堵死。**

堵在一处**互斥**上。GLM 的缓存分成 5 个组（full 组、尾状态组、3 个 KDA 组，见 [KV cache 规格](kv-cache-spec.md#对齐成两档页编成五个组)），这种分组必须由混合缓存管理器来管；而上游这个 LMCache 连接器没有声明支持混合缓存管理器。于是：给上 KV 传输配置又不表态，vLLM 会自动把混合缓存管理器关掉，GLM 建缓存组时抛错；显式要求开着，则建连接器时就抛「不支持」。具体报错见[会报什么错](#会报什么错)。

就算这一层被改通，还有两处要重写：

- **形状对不上。** 上游自带的 adapter 按「模型的每一层 × 每个位置」开缓冲，每层一格（MLA 这样只有一份潜向量的）或两格（普通 attention 的 K 和 V）。GLM 有两样塞不进这个形状：34 层 [KDA](linear-attention.md) 的状态是「到某个位置为止」累积出来的一整份，根本不按位置逐格存；[稀疏 MLA](mla.md) 每层除了潜向量还多一份索引器缓存，这个形状里没有它的位置。
- **逐层这条路对 MLA 直接关着。** 用 MLA 的模型打开逐层模式，上游 adapter 会直接抛「尚不支持」。

**真开起来最多能省什么。** 这套部署块不够时会抢占，被抢占的请求全部重算：在[多条请求](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)的场景里，那条请求约 67,000 个位置的 prefill 要重来，按 8,192 的预算要 9 步。外部这层最多补回它 prompt 里整 chunk 的部分（查询只拿 prompt 的 token 去问），能补多少取决于 prompt 和生成部分各占多长。搬回来的字节按每卡每个位置 13,056 B 算（12 层稀疏 MLA 加索引器压缩缓存，见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）：

```calc
title: 假如补回 1 个 chunk，要往显存里搬多少（示意：chunk = 256 个位置）
每卡每个位置 = 13,056 B（12 层稀疏 MLA + 索引器压缩缓存）
1 个 chunk 每卡 = 256 × 13,056 = 3,342,336 B ≈ 3.19 MiB
一个 DP 组 8 张卡 = 8 × 3.19 MiB ≈ 25.5 MiB
> 这是 8 张卡显存侧要填进去的总量，只算随长度增长的那部分；KDA 的递推状态是每条请求一份的固定开销，不按位置累加
> 外部存储侧存的是多少字节另说：格式、元数据、对齐、压缩，以及各卡相同的数据会不会只存一份，都由 LMCache 决定，本页未核
```

没有实测：本节的互斥结论按钉住源码推断、未实跑，这里也没有命中率、吞吐、时延的任何实跑数据；上面的字节数是部署页的缓存布局换算，不是 LMCache 的效果。

**版本组合也要自己钉。** 官方的 Ascend 部署材料依赖社区维护的 LMCache-Ascend 插件，给的镜像例子是一组更早的版本组合（LMCache 0.3.12 配 vllm-ascend 0.11.0），文档存在不等于这组组合验证过 GLM 主线；main 上 vllm-ascend 已经不再注册这个连接器名，要改用插件包自己的注册方式。

## 常见误解

- **「LMCache 就是 KV Pool 换个名字」**——插口相同，实现和边界不同：KV Pool 是昇腾在仓库里自己写的连接器，直接对显存地址存取、声明支持混合模型；LMCache 是外部软件包，vLLM 侧只有一层薄包装，见[上面的对照表](#和-ascendstore-的-kv-pool-有什么不同)。
- **「配上连接器，每条请求都能省一段」**——外部命中要求这份数据当初存成功、现在还没被淘汰、名字和布局都对得上；查到了也还要借到本地块、真的搬到。
- **「共享开头 500 个位置，就能省 500 个位置」**——按整 chunk 认，上面的例子里只省下 256 个。
- **「自己生成的内容反正复用不了」**——分两头看：同一条请求（比如被抢占后）重新查询时只拿自己的 prompt 去问，生成的那段确实补不回来（仅核了自带 adapter）；但后来的请求若把这段内容带进 prompt（多轮对话把上轮回答放进历史就是这样），只要它当初被存下（`save_decode_cache`，取值在外部包的配置里），就能像别的内容一样被认出。
- **「开了它，显存里能多装请求」**——缓存池大小不变，省的是重算。要让缓存少占显存，看 [KV cache 量化](kv-cache-quantization.md)。
- **「装了 vllm-ascend 就等于有了 LMCache」**——仓库里那层包装只做注册和导入，真正的存储实现在外部软件包里；main 上连注册都移除了。
- **「混合模型接上就能用」**——GLM 这类模型要靠混合缓存管理器分组，而上游这个连接器没有声明支持它，见上一节。

## 对照源码

### 怎么开

```bash
# v0.23 维护分支、GLM 快照、v0.26 分支：用 vllm-ascend 注册的名字
--kv-transfer-config '{"kv_connector":"LMCacheAscendConnector","kv_role":"kv_both"}'
# 上游直接用（两套 adapter 二选一，默认走外部 lmcache 软件包）
--kv-transfer-config '{"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both",
  "kv_connector_extra_config":{"use_native":true}}'
```

- 注册名 `LMCacheAscendConnector` 指向仓库里的包装模块，模块导出的类其实是上游的 `LMCacheConnectorV1` [C1]；包装模块本身只有几行：先 `import lmcache_ascend` 把昇腾插件包导进来（只为导入时的副作用，这一行不取任何东西），再把上游的类导出去，没有任何存储策略 [C2]。
- `use_native` 默认 `false`：导入外部 `lmcache` 软件包的 adapter；显式设为 `true` 才用 vLLM 仓库自带的那套 [C3]。所以同一个连接器名下可能是两份完全不同的实现。
- chunk 大小、是否存 decode 阶段、尾巴丢不丢，自带 adapter 每次都从外部包的配置对象里取当前值再传下去 [C8]；取整与跳过保存的逻辑本身在 [C7]。函数签名上写着 256 和「decode 不存」，但那只是缺省形参，真正生效的是外部包的配置，本页没有核到它的默认取值。
- 一条核到的边界（仅自带 adapter）：一条请求查询时送出去的只有它自己的 `request.prompt_token_ids`，所以同一条请求补不回自己已生成的那段；后来的请求 prompt 里带着这段内容则不在此限 [C6]。
- LMCache 自己的存储分层不走上面这份配置，而是读它自己的一组配置项：主机内存这层开不开、开多大是一项，远端存储的地址和序列化方式是另一项 [C19]。淘汰策略在外部包里，本页没有核到。
- 上游另有一个 `LMCacheMPConnector`（把 LMCache 放到独立进程），模块加载时优先用外部包提供的实现 [C16]。
- GLM 双机主线的启动参数里没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

- **外部包没装**：包装模块第一行就 `import lmcache_ascend`，装不上直接 `ModuleNotFoundError` [C2]；`use_native` 为假时，上游连接器也要导入 `lmcache` 包 [C3]。
- **和混合缓存管理器互斥（GLM 上会撞）**：这个连接器没有继承 `SupportsHMA`。没有显式表态时，vLLM 见到不支持的连接器就把混合缓存管理器关掉，只打一条 warning [C10]；而 GLM 的分组要求它开着，关掉就在建缓存组时 `ValueError: ... requires the hybrid KV cache manager` [C12]（main 上同一条检查挪进了模型自己的缓存配置 [C13]）。反过来显式要求开着，建连接器时就 `ValueError: Connector LMCacheConnectorV1 does not support HMA` [C11]。两条都按代码推断，未实跑 [I]。
- **多个缓存组**：`LMCacheMPConnector` 拿到不止一组的块号会直接 `RuntimeError`，提示要加 `--disable-hybrid-kv-cache-manager` [C16]。
- **MLA 的两条限制**：远端序列化方式不是 `naive` 时 `ValueError`；MLA 模型打开逐层模式时 `ValueError: layerwise MLA connector is not supported yet` [C9]。
- **版本不配套**：Ascend 部署材料给的是 LMCache 0.3.12 配 vllm-ascend 0.11.0 的镜像例子 [S14]；main 上这个注册名已经移除，按旧写法启动会是「找不到连接器」 [S15]。

### 开销和什么时候别开

- **每写满一个 chunk 付一次外部写入**，不管将来有没有人用；写入和取回都和计算抢主机侧带宽。
- **取回至少多等一趟**：要先在显存借到块，再等数据搬到，请求才能接着算 [C5]。命中在更远的层时还要多一跳。
- **多一套要对齐的版本**：vLLM、vllm-ascend、LMCache、LMCache-Ascend 四者的版本要记清楚，任何一处升级都可能让旧数据认不出来。
- **适合开**：开头重复多（多轮对话、长系统提示词、同一文档反复提问），共享的开头远长于一个 chunk，并且有富余的主机内存或外部存储。
- **别开**：请求开头几乎不重复（只付写入开销）；共享开头短于一个 chunk（取整后为 0）；模型要靠混合缓存管理器分组，例如钉住的 GLM 快照。
- **怎么验**：同一模型、同一输入、同一并发下比冷启动和第二次；还要确认第二次真的是从外部搬回来的，而不是命中了本地显存里的块。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 | GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad |
|---|---|---|---|---|
| 仓库是否注册这个名字 | 是 [C17] | 是 [C1] | 是 [C18] | 否，改用插件包自己的注册 [S15] |
| 包装模块 | 几行的导入加导出 | 同左 | 同左 | 已删除 |
| 上游连接器 | 同一份 `LMCacheConnectorV1`，`use_native` 二选一 [C3] | 同左 | 同左 | 同左 |
| 部署材料 | 给出在线与离线两种写法 [S14] | 同左 | 同左 | 只留一句「改用插件包的配置」 [S15] |

意味着什么：前三列按仓库注册名启动，main 上要换写法；四列的上游连接器是同一份，真正的行为差异来自外部软件包的版本，不在这张表里 [D]。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 注册名指向哪个模块 | `vllm_ascend/distributed/kv_transfer/__init__.py`（GLM 快照 L61–L65） |
| 包装模块本身 | `vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py` |
| 选哪套 adapter | `vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py`，`__init__`（v0.23.0 L83–L115） |
| 调度侧的交接点，以及结束时能不能放块 | 同文件 `get_num_new_matched_tokens`、`update_state_after_alloc`、`request_finished`（L259–L342） [C4] |
| 执行侧的搬入搬出 | 同文件 `register_kv_caches`、`start_load_kv`、`wait_for_save`（L120–L198） |
| 外部命中怎么数、全中减一 | `lmcache_integration/vllm_v1_adapter.py`，`get_num_new_matched_tokens`（L1140–L1225） [C6] |
| chunk 取整与跳过保存 | 同文件（L296–L340） |
| 缓冲形状与 MLA 限制 | 同文件 `_init_lmcache_engine`（L460–L510） |
| 混合缓存管理器怎么被关掉 | `vllm/config/vllm.py`（L1479–L1501）与 `kv_connector/factory.py`（L54–L61） |
| GLM 要求混合缓存管理器 | `vllm_ascend/patch/platform/patch_kv_cache_utils.py`（GLM 快照 L517–L531） |

待核（本页只核到 vLLM 和 vllm-ascend 这两侧，没有读外部包的实现）：chunk 默认多长、怎么和设备块对上、凑不满的尾巴存不存、生成阶段存不存、查找按什么粒度匹配、加载失败后能不能退回重算；分层之间的取回路径和淘汰策略；外部存储侧一份数据占多少字节、各卡相同的数据会不会去重；昇腾的包装在导出前先导入插件包，这次导入是否改动了上游的类；混合缓存管理器这道互斥在 LMCache-Ascend 插件自己注册的连接器上是否同样成立；以及 GLM 上的设备实测。
