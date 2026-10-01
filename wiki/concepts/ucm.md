---
id: ucm
title: UCM：把算过的前缀分三层存到显存之外
type: feature
summary: UCM（Unified Cache Manager）是经 KV connector 接进 vLLM 的外部缓存软件包：把算过的前缀 KV 从显存存到本机内存、再落到共享存储，按官方文档换实例或重启后也能取回，省掉重复的 prefill。讲清它和 KV Pool、LMCache 的分工，PD 分离时的两种数据流，以及 GLM 双机为什么没开、开了还缺什么。
aliases: [UCM, Unified Cache Manager, 统一缓存管理, UCMConnector, UCMConnectorV1, UCM_CONFIG_FILE, UcmPipelineStore, PipelineStore, 集中式 KV 存储, 存算分离]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L59
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L100-L159
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L194-L218
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L3-L64
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L79-L117
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L118-L170
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L202-L330
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L363-L416
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L459-L700
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L755-L885
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L454-L487
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L604-L640
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L783-L812
  - vllm@0fc695fc:vllm/v1/worker/kv_connector_model_runner_mixin.py#L78-L101
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L285-L290
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L542-L561
  - vllm@0fc695fc:vllm/config/vllm.py#L1479-L1500
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L24-L41
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L205-L226
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1716-L1723
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L2028-L2031
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L850
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py#L1-L5
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L85-L89
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L37-L69
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L5-L8
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L19-L20
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1506-L1507
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L122-L151
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L86-L113
verified: []
evidence: "C"
relations:
  - {to: kv-pool, kind: builds-on, note: KV Pool 讲过 AscendStore 的问答与搬运；共用的接口步骤在本页讲，UCM 换了实现和存储}
  - {to: lmcache, kind: alternative-to, note: 另一套经 KV connector 接入的外部前缀缓存，Ascend 侧只装插件、复用上游连接器}
  - {to: kv-cache-cpu-offload, kind: alternative-to, note: 只存到本机主机内存、只给本实例用，没有共享存储这一层}
  - {to: prefix-caching, kind: builds-on, note: 本地命中数是问 UCM 的起点；GLM 上还决定 KDA 状态能不能按块留档}
  - {to: pd-disaggregation, kind: builds-on, note: 集中式 PD 把共享存储当成 P 到 D 的交接点}
  - {to: mooncake-connector, kind: builds-on, note: P2P 模式由 Mooncake 承担 P 到 D 的传输}
contradicts: []
updated: "2026-10-02"
origin: seed
---

## UCM 是什么？

**UCM（Unified Cache Manager，统一缓存管理）是一个独立于 vLLM 的外部缓存软件包：它经 KV connector 接进推理引擎，把算过的前缀 KV 从显存往下存到这台机器的内存，再落到多台机器共同挂载的存储；按官方部署文档，之后开头相同的请求——哪怕落在另一台实例上，或者服务已经重启过——也能从那里取回，不用把这段开头再算一遍。**

先认三个前置词。[KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的历史，后面每一步都要回头读它。[prefix caching](prefix-caching.md) 让开头相同的请求在同一个实例的显存里直接复用这份历史。KV connector 是 vLLM 留给外部存储的插口：调度时它回答「外面还能多提供几个位置」，执行时它把数据搬进搬出；[KV Pool](kv-pool.md#kv-pool-是什么) 一页讲过 AscendStore 自己怎样答、怎样搬，三种连接器共用的接口步骤下文会完整走一遍。

名字里的「统一」说的是接口：vLLM 这一侧只认一个连接器，叫 UCMConnector；数据此刻在哪一层、什么时候往下落、什么时候被淘汰，全由 UCM 自己管。

```wiki-diagram
file: ucm-intuition
```

图里有两台实例、三层存储。请求 A 先到实例 1，开头三段自己算完，经 UCMConnector 交给 UCM：先存进这台机器的内存（第 2 层），再落到共享存储（第 3 层）。请求 B 落在实例 2，开头和 A 相同，可实例 2 的显存里一段也没有；它开始算之前先经连接器问一句，UCM 在共享存储里找到了这三段，就经实例 2 的内存搬回显存，B 只算自己不同的尾巴。搬回来的数据和本地算出来的没有区别，照样占实例 2 的显存块、由 [block table](block-table.md)（每条请求「第几块在显存哪一格」的对照表）指过去。

服务重启时，显存里的块一定没了，本机内存那一层只是快取、不负责持久保存；只有第 3 层的后端能持久保存、重启前也写完了，这些前缀才还在。重启后的进程还得认出它们和新请求是同一段开头——认不认得出，取决于外部包起名和找回的规则，本仓看不到。

## 为什么需要：显存里的前缀留不久，也不跨实例

**prefix caching 只能复用本实例显存里还留着的块；UCM 把算过的前缀存到一个更大、多台实例共用、后端能持久保存时重启后也还在的地方，命中的机会才多起来。省下来的是 prefill 的计算，decode 每一步照样要算。**

prefix caching 落空有三种情况：

- **被挤掉。** 显存里的块先给正在算的请求用；没人用的旧前缀排在空闲队列里，新请求一来就会被拿去重写（会计规则见 [prefix caching 的预算](prefix-caching.md#池子的预算怎么分满了怎么办)）。
- **落在别处。** 部署里有几个实例，或者几个 [data parallel](data-parallel.md) 组（各自独立跑请求、各有一份 KV cache 的执行组）时，同一份文档的上一次提问落在哪一组由路由决定；落在另一组时，它的块在那一组的显存里，这一组看不见。
- **重启就清空。** 显存和内存里的东西，服务一重启就没了。

UCM 对着这三点：容量按存储算、不按卡算；存储由各实例共同挂载，按官方部署文档，谁存进去的别人都能查到；后端能持久保存时，重启以后还在。后两条都以外部包能认出「同一段前缀」为前提。

**官方部署文档给过一组对比数。** 设定是：一个 MoE 模型（GLM-5.1 的 W4A8 量化版）做 PD 分离，P 用 4 台 A2（4 个 DP 组、每组 TP8），D 用另外 4 台（8 个 DP 组、每组 TP4）；先发 128 条请求，把输入的前 80% 存进缓存，再发 128 条完整输入、每条生成 1,000 个 token，128 条同时跑。三种做法下的首 token 时延（TTFT）和平均每个输出 token 的时延（TPOT）：

| 输入长度 | 全部重算的 TTFT | 只开显存 prefix caching 的 TTFT | 开 UCM 的 TTFT | TPOT（三种做法） |
|---|---|---|---|---|
| 32K | 140,730 ms | 108,879 ms | 51,861 ms | 64–66 ms |
| 64K | 181,864 ms | 144,444 ms | 69,718 ms | 64–66 ms |
| 128K | 268,016 ms | 267,680 ms | 105,083 ms | 65–66 ms |

这张表能读出两件事。第一，变的只有 TTFT，TPOT 三种做法几乎一样：UCM 省的是 prefill，decode 每步的计算一点没少。第二，只开显存 prefix caching 帮得不多，128K 时几乎没帮上：文档的解释是有多个 DP 组时，正式测试的请求不一定落回当初存前缀的那一组，实际命中率低于预设的 80%；UCM 把前缀都放进共享存储，哪一组接到请求都能命中。这是官方在那套 8 台机器上报的数，本站没有复现，也不能搬到别的模型和部署上用。

**代价有四条。**

- **取回要时间。** 从存储经内存搬回显存，比直接读显存慢；搬得越多、存储越远，等得越久。取回划不划算，要拿搬运时间和重算时间比；上表是前缀长、预先存好的情形。
- **存下去要带宽和容量。** 算过的前缀要一路往下写，占主机内存（官方示例给第 2 层留了 64 GB）和存储的写带宽。
- **存储要真共享，内容要对得上。** 想跨机器复用，第 3 层必须是各台机器真的都能读到的同一份存储；换了模型、权重或切分方式，旧数据就不能再用，见下文[三层怎样放](#三层怎样放显存本机内存共享存储)。
- **多一个外部依赖。** 查找规则、淘汰策略、写入时机、重启后怎样找回，全在外部 UCM 软件包里。UCM 要单独安装、单独固定版本。

## 一条请求怎样经过 UCM：先问后搬，边算边存

**调度器先数本地命中，再问 UCM「从这里往后你还能供几个位置」；借好块以后，worker 在前向开始前发起加载，每层用之前等这一层到齐，算完一层就交出去存，整趟前向结束前等存完。这几步是 vLLM 定下的连接器接口，UCM、KV Pool、LMCache 走的是同一套。**

```wiki-diagram
file: ucm-flow
```

排队时，在调度器里：

1. **只问还没开始算的请求。** 一条请求在等着开始时——新来的，或者被[抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)退回队列、已算位置清零的——调度器先查本地 prefix caching 命中了几个位置，再把这个数交给连接器，问外面还能多供几个。已经在跑的请求不再问。
2. **UCM 可以说「还没定」。** 接口允许它这一次先不给数，这条请求本步跳过、下一步再问。给了数，还要一并说明是同步加载（就在这一步的前向里搬，用到之前等到）还是异步加载（在两步之间搬，搬完之前请求先等着）。
3. **借块、回告。** 调度器把「本地命中 + UCM 能供的」都当作已经算过，照常给请求借块（规则见 [KV 块分配](vllm-kv-block-allocation.md)），再把借到的块号告诉 UCM，让它知道数据该搬进哪几格。选了异步加载的请求先挂起，数据到齐以后才排进来算。

设一条请求的 prompt 有 1,000 个位置，本地命中前 256 个，UCM 里存着前 800 个（都是示意数）：

```calc
title: 开始前，哪些位置要算（示意）
UCM 再供 = 800 − 256 = 544 个位置
视为已算 = 256 + 544 = 800 个位置
这一步要算 = 1,000 − 800 = 200 个位置
```

UCM 回的是「本地命中之后还能多供几个」，不是它一共存了多少：第 0–255 个位置用本地显存里的块，第 256–799 个从 UCM 搬，第 800–999 个自己算。接口还要求它只报此刻真拿得到的那段连续前缀，因为淘汰或连接中断而取不回的部分不能算进去。UCM 按多大的单位存、报数前要不要取整到整段，都在外部包里，vllm-ascend 仓里看不到。

执行时，在每张卡的 worker 里：

4. **前向开始前，发起加载。**
5. **每层 attention 前，等这一层到齐；这一层算完，交出去存。** 按层交接能让搬运和计算重叠（机制见[逐层缓存传输](kv-cache-layerwise-offload.md)）。不过接口里有按层等待，不等于每个部署都按层搬：UCM 自己的配置里有一个按层开关，官方几份示例的取值并不一样，见下文 PD 一节。
6. **整趟前向结束前，等保存完。** 保存还在读这些块的时候，块不能被别的请求覆盖；这一步把前向挡在保存完成之后。
7. **请求结束或被抢占时。** 请求结束时，接口允许连接器要求「先别还块」，等它存完再还；请求被抢占、块要被重写之前，vLLM 也会先通知连接器，给还没写完的异步保存收尾。UCM 是否用到这两个口子，在外部包里。

**命中只是一个计划。** 第 1–3 步定下的是「这些位置不用算」；数据要真的搬进块里，模型才能读。「计划搬」「真的到」「块能被覆盖」是三个不同的时刻，外部实现在任何一步出错，都不能把计划当成数据已经可读。

## 三层怎样放：显存、本机内存、共享存储

**官方推荐的配置把三层串成两段搬运：显存与本机内存之间一段，本机内存与存储之间一段。第 3 层只写一个存储路径：单机时可以是本地 SSD；要跨机器复用，或者让 P、D 经它交接，就必须是各台机器真能读到的同一份共享存储。**

| 层 | 在哪 | 管什么 |
|---|---|---|
| 第 1 层 | 卡上的显存 | 正在算的请求读写，最快，也最小 |
| 第 2 层 | 这台机器的内存 | 常用前缀的快取，比回存储读快 |
| 第 3 层 | 本地 SSD，或多台机器共同挂载的存储（NFS、3FS 等） | 持久保存，容量跟着存储走，不跟着卡走 |

- **两段搬运。** 官方推荐的存储方式叫 PipelineStore，配置里写成「Cache|Posix」：前一段（Cache）管显存与本机内存之间，后一段（Posix）管本机内存与文件存储之间。示例给本机内存那一层留 64 GB——这是示例值，不是显存大小，也不是对哪个模型都合适的推荐值。
- **同名目录不等于共享存储。** 两台机器各自配了同一个目录名，看见的未必是同一份文件；只有两边都挂上同一个网络文件系统，或者 3FS 这类分布式存储，一台写进去的另一台才读得到。只把路径字符串配成一样，还没有做到存算分离。
- **重启后能不能找回。** 前提是后端本身能持久保存，并且重启前已经写完；只在内存里的、没写完的、存储本身不可访问的，结果各不相同。vllm-ascend 这一层适配证明不了后端的持久性、淘汰策略和故障恢复。
- **内容要对得上。** 存下去的是模型算出来的状态，不是文字。换模型会改变权重、状态种类、层数、形状或数据类型；改了并行切分，每张卡存的那一份也跟着变（KV Pool 在这一点上的具体后果见[它的起名规则](kv-pool.md#池里一条记录叫什么名字)）。UCM 怎样给前缀起名、名字里记不记模型和切分方式，在外部包里；换模型或换切分时要按 UCM 的文档另行确认，最稳妥的做法是换一个存储目录。

UCM 的外部包还提供别的能力，官方文档列了稀疏 attention 的几种免训练方法、四种 PD 分离模式和 RoPE 外推；vllm-ascend 的部署文档只讲前缀缓存和其中两种 PD 模式，本页也只讲这两件。

## 和 KV Pool、LMCache 有什么不同

**三者对 vLLM 来说都是 KV connector：调度器问的、worker 调的是同一套接口，上一节的七步一样不少。不同在于逻辑写在哪、数据存在哪、PD 分离时站在哪。**

| | KV Pool（AscendStore） | LMCache | UCM |
|---|---|---|---|
| 逻辑写在哪 | vllm-ascend 仓里：查询、起名、搬运都看得见 | 外部 LMCache 包；vllm-ascend 仓里只有一个几行的文件，装上昇腾插件后直接用上游 vLLM 的连接器 | 外部 UCM 包；vllm-ascend 仓里是一层只转发的外壳 |
| 数据存在哪 | 各卡贡献内存拼成的池，经 Mooncake 等后端存取 | 由 LMCache 的配置决定，见 [LMCache](lmcache.md) | 本机内存，再落到本地 SSD 或共享文件存储 |
| PD 分离时 | 默认只服务 P，D 要显式打开才读写池 | 见 [LMCache](lmcache.md) | 可以当 P→D 的交接点（集中式），也可以只在 P 上管前缀（P2P） |

**同一个接口，三种「厚度」。** KV Pool 的每一步在本仓都有源码，查询怎样取整、池里的记录怎样起名，都能逐行核对（见 [KV Pool](kv-pool.md#一次查询怎样算池只补本地缺的整段)）。UCM 在本仓只剩一个外壳：启动时创建外部包里的引擎，此后调度侧、执行侧的每个问题都原样转过去，外壳自己不留状态。LMCache 更薄，本仓连外壳都没有写，只导入插件、复用上游。所以同样问「这一段前缀怎么算命中」，KV Pool 能在本仓答完，UCM 和 LMCache 要去外部包里找。

**官方文档自己的定位。** UCM 的部署文档说：KV Pool 靠把各节点的内存拼起来扩大前缀缓存的容量，容量仍受内存大小限制，也不持久；UCM 把计算和存储拆开，每个节点用本机内存做快取，共享存储做持久层。这是 UCM 文档对两者的对比；KV Pool 能接哪些后端、数据存到哪里，以 KV Pool 页为准。

另一条相邻的路是 [KV cache CPU offload](kv-cache-cpu-offload.md)：只把完整的前缀段复制到本机主机内存，只给本实例用，没有共享存储这一层，也就没有跨实例和跨重启的复用。

## PD 分离时，UCM 站在哪

**[PD 分离](pd-disaggregation.md)把一条请求的 prefill 和 decode 交给两组实例（P 和 D），中间要把算好的状态交过去。UCM 有两种站法：集中式里，共享存储就是交接点，P 存、D 取；P2P 里，这一次的交接由 Mooncake 直传，UCM 只在 P 上管可复用的前缀。读部署图时要分清两件事：谁保存可复用的前缀，谁把这一次请求的状态从 P 送到 D。**

```wiki-diagram
file: ucm
```

| 部署方式 | 这一次 P→D 的状态怎么走 | UCM 挂在哪 |
|---|---|---|
| 集中式 | P 存进共享存储，D 从共享存储取 | P、D 都挂 UCM，两端用同一份 UCM 配置 |
| P2P | Mooncake 从 P 直接传给 D | 只挂在 P 上管前缀复用：P 用多连接器组合同时挂 Mooncake 和 UCM；D 只挂 Mooncake |

**集中式为什么行得通。** 把上一节的七步接起来看：P 在计算过程中经连接器把状态交给 UCM 存下去；D 上这条请求排队时，调度器照常问 UCM「这段开头你有没有」。两端问的是同一个后端，D 问到的才会是 P 刚写进去的那份。所以集中式靠的是「同一个后端 + 同样的前缀查询」，不是状态在两个进程之间直接飞过去。这里有两次交接，P 写、D 读；P 那边「已经安排保存」不等于 D 这边「已经可读」，两端怎样认出是同一段、写完没有、写失败了怎么办，都要外部实现来协调。

**P2P 里 UCM 管什么。** 搬这一次请求状态的是 Mooncake（机制见 [Mooncake 连接器](mooncake-connector.md)）；UCM 管的是「P 下次遇到同样的开头时少算一段」。P 可以先从 UCM 取回共享前缀、少算一段，再把这条请求需要的全部状态经 Mooncake 交给 D。官方那个 MoE 大规模 EP 例子（上文对比数的出处）用的就是这种站法：P 上同时挂 Mooncake 和 UCM，D 只挂 Mooncake。

设这一次 P→D 要交的状态是 64 MiB（示意数），不计压缩、共享命中和元数据：

```calc
title: 交接一次，数据要走几趟（示意）
集中式 = 64 MiB 写进存储 + 64 MiB 从存储读出 = 128 MiB
P2P = 64 MiB 从 P 直传到 D = 64 MiB
```

集中式要走两趟，P2P 一趟，但推不出集中式的时延就翻倍：命中复用、写读重叠、存储布局和链路拓扑都会改变实际开销。官方文档对两者的定位是：集中式架构简单、实例彼此完全解耦、不带状态；P2P 时延更低，适合 P、D 节点同构的场景。

**按层开关，示例之间并不一样。** UCM 自己的配置里有一个「算一层交一层」的开关。P2P 的 P 节点、单机混部、大规模 EP 的 P 节点三份示例把它打开，这三份都装在要算 prompt 的机器上；集中式那份关着，而且 P、D 两端共用同一份配置。一份配置同时管两端，挑值时就不能只看 P。文档没有解释每个值为什么这样定，这些是示例的选择，不是固定默认值。它和 KV Pool 那边同名的逐层开关也不是一个东西，见页末[怎么开](#怎么开)。

## 放到 GLM 双机：这套部署没有开 UCM

**[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的官方启动参数里没有 KV 传输配置，prefix caching 也关着（GLM 是混合模型，vLLM 默认判它不支持，见 [prefix caching 在 GLM 双机上开着吗](prefix-caching.md#glm-双机上它开着吗)），所以 UCM 没开。本节照钉住的源码推演「假如接上」会碰到什么：没有实跑，没有吞吐、时延、命中率的实测数；上文官方那组数出自另一个模型、另一套 8 台机器的部署，不能当成这里的效果。**

### 接在哪两处：新请求，和被抢占退回的请求

按上文第 1 步，调度器只在请求还没开始算时问 UCM。在这套部署里，这包括两种请求。

- **新请求。** 两台机器各是一个 DP 组，各有自己的 KV cache 池（见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。即使打开 prefix caching，机器 0 上算过的开头，机器 1 也用不上；两台都挂上同一份共享存储时，按官方部署文档，UCM 能让它们互相取用。这和官方那组数里「显存 prefix caching 在多个 DP 组下命中不到」是同一个原因。
- **被抢占退回的请求。** 块不够时，调度器抢占一条在跑的请求：它的块全部还回去，已算位置清零，退回等待队列的队首。按主线的算例，被抢占的那条约有 67,000 个位置要从头重算，约 9 步（推导见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)与 [KV 块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)）。它重新排队时已算位置是 0，调度器会去问 UCM；UCM 里存着多少，就能少算多少。能省多少，取决于 UCM 存下了多长一段、KDA 状态能不能接上（下一小节）；接口说明只要求连接器报 prompt 里的可用前缀，UCM 实际会不会把已生成的部分也补回来，在外部包里。这笔账没有数。

### 只加 UCM、不开 prefix caching：KDA 状态没有中间存档

GLM 每一层要保留的历史不止一种（见[混合模型到底要保留哪几类状态](kv-cache.md#混合模型到底要保留哪几类状态)）：稀疏 MLA 的潜向量和 indexer 缓存随位置增长，[KDA](linear-attention.md)（GLM 用的线性 attention）每层只存一份固定大小的递推状态。前缀要能「从第 N 个位置接着算」，KDA 那一侧就必须在第 N 个位置留过一份状态。

钉住的镜像里有一段补丁，会在接上 KV connector 时把 KDA 的缓存方式从「不留中间档」自动改成「按块留档」（align）；可它只认 AscendStore（KV Pool）这一个名字，接 UCM 时不改。照这段源码推演：只加 UCM、不开 prefix caching，KDA 仍不留中间档，它的块长盖住整条最长长度 133,120，中间位置没有 KDA 状态可存，也就没有能接着算的前缀。要让中间位置接得上，还得显式打开 prefix caching：vLLM 这时走按块留档，KDA 的块长落到 640，每 640 个位置留一份状态，和 [KV Pool 在 GLM 上的推演](kv-pool.md#只加-kv-pool不开-prefix-caching推演下来一次查询都不会发出)是同一个前提。即便如此，共享的开头不到 640 个位置时，KDA 在那里没有存档，照样接不上。

### 8 张卡上要存些什么

一个 DP 组的 8 张卡按 TP8 合切每一层。按[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)的块字节，full 组（稀疏 MLA 的潜向量加 indexer 缓存）一块 640 个位置在每卡是 8,355,840 B，折合每个位置 13,056 B；这份数据 8 张卡完全相同，不按卡切。KDA 的状态按头切开，每卡各不相同，每条请求每卡约 85 MiB（来历见 [attention 的开销](attention-cost.md)）。这些是模型本身要留的量，不是 UCM 的开销。KV Pool 遇到 8 卡相同的缓存只存一份（见[它的起名规则](kv-pool.md#池里一条记录叫什么名字)）；UCM 存一份还是 8 份，在外部包里。

接口这一层是接得上的：UCM 外壳声明支持混合缓存管理，vLLM 不会因为接了它就把混合缓存管理关掉，而 GLM 离不开后者；GLM 的稀疏 MLA 层在 attention 实现里留有「等本层到齐」「交出去存」两个调用点。存得对不对——KDA 状态和 5 个缓存组能不能被外部包正确存取——没有验证，缺的东西集中列在页末待核。

## 常见误解

- **「UCM 一开，P 和 D 就经存储传状态。」** 只有集中式走这条路；P2P 里传输是 Mooncake 的事，UCM 只在 P 上管前缀。
- **「连接器注册成功、服务起来了，就证明后端能持久保存。」** 注册只证明入口接上了；读写、跨机器可见、重启后能不能复用，都要在实际后端上验证。
- **「第二次请求变快了，功劳全归 UCM。」** 还要分清是从外部存储命中的，还是本机显存 prefix caching 命中的；前缀、路由、并发不控制住，两类收益分不开。官方那组数就是分三档对比的。
- **「UCM 也能让 decode 变快。」** 它省的是 prefill 的计算；官方那组数里三种做法的 TPOT 几乎一样。
- **「两台机器配了同一个目录，就是共享存储。」** 要各台机器挂上同一份网络或分布式存储才算；否则集中式 PD 下 D 问不到 P 写的东西，vLLM 这边只当没命中、照常重算；UCM 自己会不会报错在外部包里。
- **「UCM 和 KV Pool 是一回事。」** 接口相同，实现不同：KV Pool 的逻辑在 vllm-ascend 仓里、每一步都能核对；UCM 的逻辑在外部包里。
- **「GLM 接上 UCM，就能复用 GLM 的前缀。」** 这套部署没开；只加 UCM 时 KDA 状态不按块留档，至少还要显式开 prefix caching，外部包对 KDA 状态的支持也没验证。

## 对照源码

### 怎么开

UCM 本身按外部指南安装；部署文档的前提写 vLLM 与 vllm-ascend 都用 main 分支，硬件是 Atlas 800 A2 这一类。

**第一步：写 UCM 配置文件。** 四份官方示例（集中式、P2P 的 P 侧、单机混部、大规模 EP 的 P 侧）都是这个结构，只有最后一个键的取值不同：

```yaml
ucm_connectors:
  - ucm_connector_name: "UcmPipelineStore"
    ucm_connector_config:
      store_pipeline: "Cache|Posix"
      storage_backends: "/mnt/test1"
      cache_buffer_capacity_gb: 64
enable_event_sync: true
use_layerwise: false   # 集中式；其余三份为 true
```

- `store_pipeline: "Cache|Posix"`：Cache Store（Device ↔ Host）串上 Posix Store（Host ↔ 存储后端），文档称 PipelineStore 是推荐的 UCM 连接器。
- `storage_backends`：后端路径。混部示例允许本地 SSD 或 NFS；集中式跨节点 PD 和大规模 EP 例子要求所有节点都能访问同一个共享后端（NFS 挂载或 3FS）。
- `cache_buffer_capacity_gb: 64`：本机内存那一层的容量，示例值。
- 最后两个键在最外层，属于这份 UCM yaml 本身，由外部 `ucm` 包读取；`UCM_CONFIG_FILE` 这个键在四个在册提交的 `vllm_ascend/` 下都零命中，读取和解析这份文件的代码不在本仓。
- `use_layerwise`：P2P 的 P 侧、混部、大规模 EP 的 P 侧为 `true`，集中式为 `false`，集中式 P、D 两端的 `vllm serve` 用同一个 `UCM_CONFIG_FILE` 指向它。它和 AscendStore 从 `kv_connector_extra_config` 里读的同名 `use_layerwise`（默认 `false`）不是一个开关，两者不互通，也不互相覆盖。
- `enable_event_sync`：四份示例都是 `true`（集中式把 `use_layerwise` 翻成 `false` 时它也还是 `true`）；部署文档没有解释它管什么，只能照录。

**第二步：服务侧挂连接器。** `--kv-transfer-config` 选 `UCMConnector`、`kv_role` 设 `"kv_both"`，在 `kv_connector_extra_config` 里用 `UCM_CONFIG_FILE` 指向上面的文件。集中式 PD 的 P、D 两端都这样配，示例为 QwQ-32B、`--tensor-parallel-size 4`、2P2D：

```bash
--kv-transfer-config '{
  "kv_connector": "UCMConnector",
  "kv_role": "kv_both",
  "kv_connector_extra_config": {"UCM_CONFIG_FILE": "/path/to/ucm_config_example.yaml"}
}'
```

**P2P 的配法不同。** P 侧用 `MultiConnector` 把 `MooncakeConnectorV1`（`kv_producer`）和 `UCMConnector`（`kv_both`）组合起来，外层 `kv_role` 为 `kv_producer`；D 侧只配 `MooncakeConnectorV1`（`kv_consumer`），不挂 UCM。示例为 2P2D、两端各 TP4；大规模 EP 例子（GLM-5.1-w4a8，P 为 4 台 DP4×TP8，D 为 4 台 DP8×TP4）也是这个组合。

**跨节点的示例还都固定了 `PYTHONHASHSEED`。** 集中式、P2P、大规模 EP 三份示例在每台机器的启动脚本里都 `export PYTHONHASHSEED`（集中式取 123456，另两份取 0），同一份示例里 P、D 设同一个值；单机混部那份没有设。vLLM 的前缀块指纹拿它当种子，不设时每个进程各自随机，跨进程、跨重启都对不上；UCM 的键是不是沿用这套指纹，在外部包里看不到（见页末待核），照抄示例、各节点设同一个值最稳。

配置入口、配置文件在每台机器上是否可见、`ucm` 包是否装好，是三件都要检查的事。

### 会报什么错

- **没装 `ucm` 包。** 外壳模块开头就 `from ucm.integration.vllm.ucm_connector import UCMConnector`。vLLM 的连接器工厂注册时只记模块路径，创建连接器时才导入；没装时，在引擎启动、创建连接器那一步抛 `ModuleNotFoundError: No module named 'ucm'`。
- **没有 KV 传输配置却构造了它。** 构造函数第一句 `assert vllm_config.kv_transfer_config is not None`。
- **存储不是真共享。** 本仓不报错：集中式跨节点时，D 从外部引擎问不到 P 写进去的前缀，只是命中为 0、照常重算；UCM 自己报不报错在外部包里。
- **配置文件写错、后端路径不可用。** 这份 yaml 由外部包解析，报什么错、在哪一步报，要看外部包。
- **不会出现的两条。** 接 UCM 时 vLLM 不会打出「关闭混合缓存管理」的警告，因为外壳实现了 `SupportsHMA`；多连接器组合要求每个子连接器都支持，P2P 那套里的 `MooncakeConnector` 和多连接器外壳在镜像里也都实现了。AscendStore 那条「KV 传输时 mamba 缓存只支持 align」的断言也不会触发，因为那段补丁只认 AscendStore。

### 开销和什么时候别开

- **外壳本身几乎不花钱。** 每个接口多一次 Python 转发；真正的开销在外部包：查找、搬运、写回。
- **读的时机。** 同步加载时，搬运时间算进这一步前向；异步加载时，请求先挂起（`WAITING_FOR_REMOTE_KVS`），数据到齐之前不参与计算。
- **写回。** 每层 `save_kv_layer` 交出去，前向末尾 `wait_for_save` 等存完；按层开关关着时怎样攒批，在外部包里。
- **容量。** 第 2 层按示例每台 64 GB；第 3 层按「要留的前缀数 × 每个位置在所有层上的字节」估，GLM 每卡每位置的字节见上文。
- **测收益时把两类命中分开。** vLLM 给连接器单独记一份前缀命中统计（查询的位置数、命中的位置数、这条请求是否被抢占过），和本地 prefix caching 的统计分开；再控制住前缀、路由和并发，外部命中和本机命中的收益才分得开。
- **什么时候别开。** 请求之间很少共享长前缀；只有一个实例、显存留得住热点前缀，本地 prefix caching 已经够用；存储的带宽和时延让搬回来比重算还慢；模型是 GLM 这类混合结构，而外部包对它的支持还没验证。

### 版本差异

下表对照 v0.23 维护分支（`2c59ff10`）、含 GLM 代码的镜像 `db701c1f`、v0.26 分支（`2ed6cbba`）和 main（`baa023ad`）；上游 vLLM 的接口按 `0fc695fc`（v0.23.0）读。

| 项 | v0.23 维护分支 / db701c1f / v0.26 | main | 意味着什么 |
|---|---|---|---|
| 注册名 | `UCMConnector` | `UCMConnector` | 配置写法不变 |
| 外壳模块 | `kv_pool.ucm_connector`（单文件） | `kv_pool.ucm_connector.connector`（子包，`__init__` 导出 `UCMConnectorV1`） | 自己 import 内部模块时要留意路径 |
| 外壳内容 | 324 行，逐字相同 | 与左边逐字相同 | 四个提交行为一致：都实现 `SupportsHMA`，都有保留接口的委托逻辑 |
| 部署文档 | v0.23 与 db701c1f 逐字相同 | v0.26 与 main 相同，和左边只差空白和「32K」写成「32k」 | 示例、前提、对比数一致 |
| KDA 自动改 align | 只认 AscendStore | 只认 AscendStore | 接 UCM 时 KDA 都不会被自动改成按块留档 |

四个提交的部署文档，前提都写 vLLM 与 vllm-ascend 的 main 分支，UCM 本身按外部指南另装。上面的核对只覆盖本仓的入口、外壳和部署说明，不证明任意 UCM 版本都能配任一发布分支；确定组合时要同时固定外部 UCM 版本、存储后端和 vLLM / vllm-ascend 版本。

### 源码位置

| 看什么 | 在哪（db701c1f，另注明的除外） |
|---|---|
| 连接器注册 | `vllm_ascend/distributed/kv_transfer/__init__.py` L57–L59（main 为 L85–L89） |
| 外壳：导入外部包、构造、保留接口委托 | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py` L5–L8、L37–L69 |
| 外壳：执行侧四个接口 | 同文件 L100–L159 |
| 外壳：调度侧问答 | 同文件 L194–L218 |
| 外壳（main） | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py` |
| 部署文档 | `docs/source/user_guide/feature_guide/ucm_deployment.md`：定位与三层 L3–L64；PD 两种方式与集中式 L79–L170；P2P L202–L330；混部 L363–L416；大规模 EP L459–L700；对比数 L755–L885 |
| 上游：接口语义 | vLLM `distributed/kv_transfer/kv_connector/v1/base.py` L454–L487（问答）、L285–L290（抢占）、L542–L561（结束时暂缓还块） |
| 上游：何时问、异步挂起、命中统计 | vLLM `v1/core/sched/scheduler.py` L604–L640、L783–L812 |
| 上游：发起加载与等保存 | vLLM `v1/worker/kv_connector_model_runner_mixin.py` L78–L101 |
| 上游：混合缓存管理自动关闭 | vLLM `config/vllm.py` L1479–L1500 |
| KDA 自动 align 只认 AscendStore | `vllm_ascend/patch/platform/patch_mamba_config.py` L24–L41、L205–L226 |
| GLM 稀疏 MLA 的逐层调用点 | `vllm_ascend/attention/sfa_v1.py` L1716–L1723、L2028–L2031；`vllm_ascend/attention/indexer_kpool_mla_v1.py` L800–L850 |
| LMCache 的接入 | `vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py` |

**来源与结论对应：**

- `UCMConnector` 注册到外壳模块，对照第 1 项来源 [C1]，main 的新路径对照第 27 项来源 [C27]。外壳在模块开头导入外部包，构造时创建外部引擎、只留这一个成员，保留接口按外部分发器是否显式实现来选分发器或内层连接器，对照第 30、2 项来源 [C30][C2]；执行侧与调度侧的方法原样转发，对照第 3、4 项来源 [C3][C4]。
- UCM 的定位、三层结构、外部包的其他能力、对 KV Pool 的比较，对照第 5 项来源 [S5]；两种 PD 方式、集中式配置、PipelineStore 为推荐、共享后端要求、集中式两端同配，对照第 6、7 项来源 [S6]；P2P 的多连接器组合与 D 只挂 Mooncake，对照第 8 项来源 [S8]；混部示例的按层开关与本地 SSD，对照第 9 项来源 [S9]；大规模 EP 例子的部署、模型与 P 侧的连接器组合，对照第 10 项来源 [S10]；三档对比数与多 DP 组下显存命中偏低的解释，对照第 11 项来源 [S11]。集中式 P、D 两份启动脚本都设 `PYTHONHASHSEED` 且同值，对照第 33 项来源；P2P 与大规模 EP 的四处同类设置、混部示例未设，是对部署文档检索的结果。vLLM 的前缀块指纹没设种子时每个进程各自随机，对照第 34 项来源。
- 连接器可以答「还没定」、要说明同步或异步、只报真能拿到的连续前缀，对照第 12 项来源 [C12]。只有已算位置为 0 的请求才去问、答不上来就本步跳过，对照第 13 项来源 [C13]；借块后回告、异步加载先挂起、连接器单独的命中统计，对照第 14 项来源 [C14]。前向开始前发起加载、结束前等保存，对照第 15 项来源 [C15]；抢占前通知连接器、请求结束时可暂缓还块，对照第 16、17 项来源 [C16][C17]。
- 连接器不支持混合缓存管理时 vLLM 才自动关掉它，对照第 18 项来源 [C18]；多连接器外壳与 Mooncake 连接器都实现了该接口，对照第 31、32 项来源。自动改 align 只认 AscendStore、不开 prefix caching 时 KDA 块长取最长长度，对照第 19、20 项来源 [C20]。GLM 稀疏 MLA 的实现继承自带逐层调用点的父类，对照第 21–23 项来源 [C21][C23]。LMCache 在本仓只导入插件、复用上游连接器，对照第 24 项来源 [C24]。
- 外壳在 v0.23、v0.26、main 与 db701c1f 逐字相同，对照第 25、26、28 项来源 [C25][C28]；部署文档的逐字比对与 `UCM_CONFIG_FILE` 零命中是对四个提交直接比对和检索的结果。GLM 双机的启动参数里没有 KV 传输配置，对照第 29 项来源 [S29]。
- 1,000 / 256 / 800 个位置和 64 MiB 是教学设定 [A]。「本地命中之后再供 544 个位置」按接口语义算出，集中式两趟、P2P 一趟由数据流计数得出 [D]。只加 UCM 时 GLM 的 KDA 没有中间存档、被抢占的请求能经 UCM 少算、UCM 是否对 8 卡相同的缓存去重，是把源码规则代入部署推出来的或尚未证实的推断 [I]。GLM 的块字节、每请求 KDA 状态、抢占重算约 67,000 个位置，引自部署页、attention 开销页与 KV 块分配页的推导。

**待核：**

- 外部 `ucm` 包：前缀怎样起名（名字里是否含模型、权重版本、TP 切分，是否沿用 vLLM 的前缀块指纹——这决定各节点要不要统一 `PYTHONHASHSEED`）、按多大的单位存取、全中时是否少报一个位置、写入是同步还是异步、淘汰策略、重启后怎样找回；本仓与本地镜像都没有这个包的源码。
- 外部包能否存取 GLM 的 5 个缓存组和 KDA 递推状态；8 卡相同的 MLA 缓存是否只存一份；KDA 层走的实现里有没有逐层调用点。
- 被抢占的请求重新排队时，UCM 能补回 prompt 还是也能补回已生成的部分；在 GLM 双机上能少算多少步。
- 在 GLM 双机上实际打开 prefix caching + UCM 的启动日志与一次命中的请求日志；吞吐、TTFT、命中率、存储带宽都没有 GLM 或这套 A2 双机上的实测数。
- `enable_event_sync` 管什么：部署文档没有说明。
