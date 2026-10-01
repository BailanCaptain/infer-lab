---
id: kv-cache-cpu-offload
title: "KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存"
type: feature
summary: 把算好的 KV cache 按完整段复制到主机内存；显存里那份被回收以后，同一段开头再被用到（另一条请求，或被抢占后排回来的同一条）时从主机搬回，不必重算。讲清为什么需要、搬回和重算各花多少（示意数）、按段存取与异步等待，以及 GLM 双机主线为什么没开、开了要搬多少。
aliases: [KV Cache CPU Offload, CPU Offloading, KV cache CPU 卸载, OffloadingConnector, NPUOffloadingSpec, CPUOffloadingSpec, num_cpu_blocks, blocks_per_chunk, cpu_bytes_to_use, offload_prompt_only]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L721-L806
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/npu.py#L16-L63
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L63-L68
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L180-L261
  - vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L30-L71
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L537-L567
  - vllm@0fc695fc:vllm/v1/kv_offload/base.py#L378-L442
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L605-L630
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L800-L812
  - vllm@0fc695fc:vllm/v1/engine/core.py#L206-L215
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L1017-L1027
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L77-L133
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/npu.py#L1-L13
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/cpu_offload/cpu_offload_connector.py#L66-L78
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L1-L108
  - vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L16-L63
  - vllm-ascend@2ed6cbba:vllm_ascend/kv_offload/npu.py#L16-L63
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L42-L60
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L37
  - vllm@0fc695fc:vllm/v1/kv_offload/cpu/manager.py#L39-L46
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: prefix-caching, kind: builds-on, note: 扩展可复用前缀的存储位置}
  - {to: kv-cache-spec, kind: builds-on, note: 根据实际页规格计算外存段容量}
  - {to: kv-cache, kind: builds-on, note: 备份和搬回的对象}
  - {to: recompute-cpu-offload, kind: alternative-to, note: 同样把 KV 存到主机，但在抢占那一刻只存被抢占的那条请求}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 显存放不下的 KV cache，能先存到 CPU 内存吗？

**KV cache CPU offload（KV cache CPU 卸载）是在主机内存（CPU 一侧的内存）里给算好的 KV cache 多存一份：显存里那份被回收以后，只要主机那份还在，下次用到同一段开头时就把它搬回显存，不用重新算一遍。**

[KV cache](kv-cache.md) 是每个已处理位置在每层留下的 K、V，后面的位置都要反复读它。它放在显存（NPU 自己的内存）里，显存用满了就要腾地方。看一个例子：

1. 请求 A 算完了一段开头，这段 KV cache 在显存里占了两页。开着 CPU offload 时，vLLM 顺手把这两页复制一份到主机内存。
2. 显存紧张，A 的这两页被收回，让给请求 C。显存里 A 的那份没了，主机里的还在。
3. 请求 B 的开头和 A 一字不差（或者就是 A 自己，被抢占后又排了回来）。没有主机那份，这段开头只能从头重算；有主机那份，就在显存里分两页空的，把数据搬回来，从这段开头之后接着算。

```wiki-diagram
file: kv-cache-cpu-offload
```

说「挪到 CPU」，实际做的是**多存一份**：显存那份照常被读、照常按显存的规则回收，主机那份按主机的容量另行管理。两份各管各的，所以主机副本不会让显存变大，它省下的是重算。

## 为什么需要它：显存不够时，本来只能重算

**没有 CPU offload，显存里的缓存一旦被收回，要再用就只能重算。** 这种情况有两种来路：

- **前缀被挤掉。** [Prefix caching](prefix-caching.md) 让开头相同的请求共用已经算好的块，前提是这些块还在显存里。缓存池满了，暂时没人用的旧块会被新请求拿走，下一条同开头的请求只好重算。
- **请求被抢占。** 池子不够时，调度器会收回一条正在跑的请求的全部块，这条请求排回来时已算位置清零，要从头重算。这笔账有多贵，GLM 双机的例子见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

主机内存和显存是两块分开记账的内存（见[主机内存与显存](device-memory.md)）。把显存留不住的那部分放到主机，相当于给 KV cache 多加了一层存储。**这一层有用的前提是：从主机搬回来比重算快。**

它也有代价：

- **算完就存，不管将来用不用。** 每凑满一段就往主机复制一次，持续占用设备到主机方向的带宽。从来没人复用的段，这趟搬运就白付了。
- **主机内存要预先划出来。** 启动时就在主机开好一整块固定大小的缓冲，能锁页时用锁页内存（不会被操作系统换出，传输更快）。开得太大会把主机内存挤爆。
- **搬回要等。** 搬回在后台进行，请求先挂起，搬完之后才能接着算；搬运还会和计算抢内存带宽。
- **显存池不会变大。** 缓存池还是启动时切出来的那么多块，只是被收回的内容多了一个找回来的地方。

## 搬回和重算，各花多少？

**搬回的时间 = 要搬的字节 ÷ 主机到设备的有效带宽；重算的时间 = 要算的位置数 ÷ 每秒能算的位置数。** 两边都换成时间，才能比。

沿用 [KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)的示意模型：每个位置 32 层共存 128 KiB，一段 4,096 个位置的开头就是 512 MiB。再给两个示意数：主机到设备的有效带宽 16 GiB/s，这张卡每秒能 prefill 16,384 个位置。

```calc
title: 同一段 4,096 个位置的开头：搬回和重算（示意数）
要搬的字节 = 4,096 位置 × 128 KiB = 512 MiB
搬回 = 512 MiB ÷ 16 GiB/s = 0.03125 s = 31.25 ms
重算 = 4,096 位置 ÷ 16,384 位置/s = 0.25 s = 250 ms
持平时的带宽 = 128 KiB × 16,384 位置/s = 2 GiB/s
> 有效带宽高于 2 GiB/s，搬回就比重算快；这组示意数下快 8 倍
```

```wiki-diagram
file: kv-cache-cpu-offload-cost
```

持平带宽的算法值得记住：**每个位置的缓存字节 × 每秒能算的位置数**。有效带宽高于它，搬回划算；低于它，重算划算。这笔账还要补三处：

- **长开头更偏向搬回。** 搬回的时间只和字节数成正比；重算时每个位置都要和前面全部位置打分，开头越长，后面每个位置算得越慢，每秒能算的位置数会往下掉，持平带宽也跟着降低。
- **短开头更偏向重算。** 搬回至少要等一步：请求先挂起，调度器在后面某一步看到搬完了，才让它接着算。开头只有几十个位置时，重算往往顺手塞进本步就做完了，搬回反而多等一步。不满一段的尾巴根本不存（见[按多大的单位存](#按多大的单位存页和段)），只能重算。
- **有效带宽要实测。** 搬运和计算、和其他请求的保存共用同一条链路与内存带宽，不能拿链路的标称值代入。

实现本身不做这笔比较：主机里有整段能接上，就搬回。这笔账是用来决定开不开、段设多大的。

## 什么时候存，什么时候搬回？

**算完一个完整段就存，和显存满不满无关；新请求或被抢占后排回来的请求进场时，先查显存、再查主机，主机里能接上多少就搬回多少。**

这套机制在 vLLM 里叫 OffloadingConnector，是 KV connector（vLLM 在调度器和 worker 两侧留的一组接口，专门把 KV cache 搬进搬出）的一种，也分成两半：**调度侧**决定存哪些段、查主机里能接上多少，用的是上游 vLLM 的代码；**worker 侧**（worker 是每张卡上跑模型的进程）真正拷字节，昇腾换上了自己的实现：一个 spec（说明主机那边开多大、按什么单位存）加一个 handler（真正执行拷贝）。

以请求 A 存、请求 B 取为例，一段缓存要走五步，第 1、3、4 步在调度侧，第 2、5 步的拷贝在 worker 侧：

1. **排进保存计划。** 每一步排完，调度侧看 A 的「已算位置 + 本步要算的位置」能凑满几段，把还没存过的段列进保存计划。计划先于本步计算写好，但只算到已经确定的 token 为止；默认还只存提示词部分，decode 阶段新生成的位置不存。
2. **等算完再拷。** worker 在专门的传输流（stream：设备上按顺序执行的一条任务队列，计算和拷贝放在不同的流上才能同时进行）上先等本步计算把这些位置写完，再把字节从显存拷到主机。
3. **登记为可用。** 拷完的段在主机一侧登记，靠「从开头到这一段为止的内容」算出的哈希来认，所以换一条请求、只要开头相同也能认出来。显存里的原页仍归显存的缓存管理器，照常被复用或回收。
4. **进场时查找。** B 进场（已算位置为 0，新请求和被抢占后排回来的都算）时，调度器先看显存里能复用多少个位置，再问主机还能接着往后接上多少个。
5. **分页、搬回、恢复。** 能接上，就先在显存给这些位置分好空页，B 挂起等待；worker 在另一条传输流上把主机数据拷进这些页，拷完报告完成，B 才恢复，从接上的位置往后算。

所以一段缓存会经过「还没算完 → 可以存 → 正在拷 → 主机可用」几个状态。这里有两个不同的「好了」：**完整**指这段的内容都算出来了，决定能不能列进计划；**完成**指字节已经安全到了另一边，由传输完成的信号确认，决定能不能用。

拷贝进行时，两头的页都不能乱动：源页要保持有效，目标页要等拷完才能读。A 在保存拷完之前就结束了，它的页照样还回池子，但会被记上一笔：谁要复用这些页，得先等这笔保存拷完。

判断「存不存」只看段有没有凑满，不看显存是不是快满了。好处是等到页真被回收时，主机那份早就在了，回收不用临时搬；代价是前面说过的，没人复用的段也照样搬一趟。

## 按多大的单位存：页和段

**显存按页分配，主机按段存：一段由相邻的若干页拼成，存和命中都以整段为单位。** 页是显存缓存池分配空间的单位，也就是站内其他页说的 KV 块（vLLM 叫 block），见 [KV 缓存规格](kv-cache-spec.md)；段是主机一侧的管理单位，由配置决定一段含几页。

继续用示意模型，设一页 16 个位置，每 4 页拼成一段：

```calc
title: 一段多大，1 GiB 主机内存能存多少（示意数）
一页 = 16 位置 × 128 KiB = 2 MiB
一段 = 4 页 × 2 MiB = 8 MiB（64 个位置）
1 GiB 主机内存 = 1,024 MiB ÷ 8 MiB = 128 段 = 8,192 个位置
算完 70 个位置 = 1 段（64 个位置） + 剩 6 个位置
> 按单个 worker、忽略对齐和管理开销；剩下的 6 个位置凑不满一段，不存
```

段大小是一对取舍：

- **段越大，管理项越少，一次拷得越多**，拷贝的固定开销摊得越薄。
- **段越大，命中越粗。** 两条请求的开头只有 100 个位置相同时，按上面的设定只有第 1 段（前 64 个位置）能命中，后 36 个照样重算。开头要连着相同才行：第 1 段不同，后面的段即使内容相同也认不出来。
- **不满一段的尾巴不存。** 上面 70 个位置里的最后 6 个，要等 A 再算 58 个位置、凑满第 2 段才会存。

一页、一段的字节要把所有层、所有相关的缓存张量加起来。混合模型除了 K、V，还有 [linear attention](linear-attention.md) 的递推状态、稀疏 attention 的索引缓存，只算 K、V 会把段算小。

1 GiB 只装得下 8,192 个位置，也就是两条 4,096 个位置的开头。主机装满以后，默认按 LRU（最久没被用过的先淘汰）腾地方，上游实现也可以选 ARC（同时看访问频率和新近程度、自动调整两者比重的淘汰算法）。

## 搬运在后台进行，计算什么时候要等？

**存和取各走一条独立的传输流，和计算并行；只有两处必须等：存之前等计算写完，取完之前请求不能算。**

- **存（设备到主机）。** 传输流先等计算流把本步的数据写完，才开始拷，否则拷走的是没写完的页。
- **取（主机到设备）。** 不用等计算流，但那条请求一直挂着，直到这笔拷贝报告完成。
- **同一方向排队。** 同一方向的后一笔拷贝要等前一笔的完成信号，再一次性提交这一批页的拷贝，并记下本笔的开始、结束信号。每一步按提交顺序逐笔查看，拷完的就报告给调度侧。

CPU 在拷贝期间可以接着处理别的事，设备也能让传输和计算重叠；但两者抢同一份内存带宽，传输越多，留给计算的带宽越少。每笔拷贝都记了字节数和用时，要实测有效带宽，就从这里取。

## 放到 GLM 双机：主线没开它，开了要搬多少？

**GLM 双机主线没有开 CPU offload：启动参数里没有 KV 传输配置，也就没有这套连接器，被抢占的请求在本机从头重算。在钉住的 GLM 快照上直接打开，也起不来。**

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。主线的 prefix caching 也关着：GLM 是混合模型，vLLM 默认判它不支持，原因见[前缀缓存页](prefix-caching.md#glm-双机上它开着吗)，后果见[部署页的后果清单](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)。所以[前面那两种来路](#为什么需要它显存不够时本来只能重算)里，主线只会碰到「请求被抢占」。

主线抢占的账在[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)：DP 组 0 跑满 32 条、各走到约 67,000 个位置时，被抢占的那条每卡还回 120–121 块，排回来要在本机重算约 9 步。一个 DP 组的 8 张卡都在同一台机器上，各存各的块。假如有一套能用的 CPU offload，要搬回的量最多是这些：

```calc
title: 被抢占的那条：最多要搬多少，要重算几步
每卡最多要搬 = 120~121 块 ≈ 956~964 MiB
一个 DP 组 8 张卡 = 8 × (956~964) MiB ≈ 7.47~7.53 GiB
重算 = 9 步
搬回耗时 = (956~964) MiB ÷ 实测主机到设备带宽 = 待核
> 块数、字节和 9 步的推导都在多条请求页；7.5 GiB 要由这台机器的主机内存出
```

说「最多」，是因为默认只存提示词部分：这些请求的历史若大半是 decode 阶段生成的，那部分根本不在主机里，排回来照样要重算。底稿既没有主机与 NPU 之间的带宽实测，也没有这 9 步每步多久，所以只能摆出「要搬多少字节」和「要重算几步」，谁更快待核。按[搬回和重算](#搬回和重算各花多少)一节的算法，持平带宽 = 每卡每个位置 13,056 B（随长度增长的那部分，见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）× 每秒能重算的位置数，后一个数同样待实测。

在钉住的 GLM 快照上打开它，会一层层碰壁：

- **先是导入失败。** 昇腾这版 spec 引用的几个上游模块，在钉住的 vLLM 里已经删掉了，加载 spec 时就停下，见[会报什么错](#会报什么错)。
- **补齐接口以后，启动时卡在缓存组检查。** 昇腾这版实现只接受一个缓存组；GLM 的状态分成 5 个组（full 组、尾状态组、3 个 KDA 组），见[KV 缓存规格](kv-cache-spec.md#对齐成两档页编成五个组)。
- **过了检查，还有两处要重写，不是放开一条检查就能用的。** 一是张量布局：它按「每层一对 K、V 张量」开主机缓冲、算拷贝地址，GLM 的缓存不按 K、V 拆，同一片显存由几层共用，见[一个块号在两档页里各占一格](kv-cache-spec.md#一个块号在两档页里各占一格)。二是混合状态要停在同一个位置：稀疏 MLA 的历史、索引器的尾状态、34 层 KDA 的递推状态必须对应同一个位置才能接着算；KDA 状态是「到某个位置为止」累积出来的一整份，不能按位置拼接，只能在段的边界上存下当时那一份，见[前缀缓存哪些块能共享](prefix-caching.md#哪些块能被共享)。

就算这些都解决了，每卡 3,855 块的缓存池也不会因此变多：主机缓冲、传输带宽都是额外的开销。想借它把显存池切小、多留给别的用途，要同时评估搬回的频率和延迟。

待核：主机与 NPU 之间的有效带宽；主线单步耗时；两台机器能划给它的主机内存；场景里请求的提示词长度（决定默认设置下能存多少）；main 分支改用上游多组实现后，GLM 的混合缓存能否走通。

## 常见误解

- **「显存满了才往 CPU 搬」**——不是。按上游调度代码，凑满一段就存，和显存满不满无关；官方指南里「显存满了、要新块时把不活跃的块拷到 CPU」是简化说法。正因为提前存好了，页被回收时不用临时搬。
- **「开了它，显存能多装请求」**——缓存池大小不变，它省的是重算，不是显存。官方指南说它让显存有限时能处理更长的上下文、更多并发，意思是缓存被挤掉、请求被抢占以后找回来更便宜，不是池子变大。要让缓存少占显存，看 [KV cache 量化](kv-cache-quantization.md)。
- **「搬回一定比重算快」**——要看带宽、开头长度和计算速度。有效带宽低于持平带宽、开头很短、或者不满一段时，重算更划算，或者只能重算。
- **「它就是抢占时把请求存到主机」**——不是一回事。本页是算完一段就存、按内容哈希给任何开头相同的请求用；[抢占卸载](recompute-cpu-offload.md)是在抢占那一刻把这条请求的状态存走、恢复时还给它。PD 分离的 D 节点上，[RecomputeScheduler](recompute-scheduler.md) 配上能存 KV 的连接器时走后一种；存不走，就把请求退回 P 重算。
- **「decode 生成的内容也会备份」**——上游默认只存提示词部分，生成出来的位置不存，要改默认值才会存。
- **「prefix caching 关着就用不了」**——上游这套在连接器打开时照样给请求算内容哈希，不靠 prefix caching 的开关；但混合模型各组块大小对不齐时，上游会要求打开 prefix caching。昇腾另有一个名字相近的 CPUOffloadingConnector，prefix caching 关着时它两头都不建，等于没开。

## 对照源码

### 怎么开

```bash
# v0.23 维护分支、GLM 快照、v0.26 分支：用昇腾自带的 spec，容量按主机段数给
--kv-transfer-config '{"kv_connector":"OffloadingConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"num_cpu_blocks":1000,"block_size":128,
  "spec_name":"NPUOffloadingSpec","spec_module_path":"vllm_ascend.kv_offload.npu"}}'
# main：昇腾把上游 CPUOffloadingSpec 换成自己的实现，容量按字节给
--kv-transfer-config '{"kv_connector":"OffloadingConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"cpu_bytes_to_use":8589934592,"blocks_per_chunk":8}}'
```

- 昇腾 `NPUOffloadingSpec` [C2]：`num_cpu_blocks` 是主机段数，必填；`block_size` 是一段的位置数，必须是设备块大小的整数倍，段倍数 = `block_size` ÷ 设备块大小。主机缓冲在 handler 初始化时一次开好：每层 K、V 各一块，第 0 维是 `num_cpu_blocks × 段倍数` 个设备块，能锁页就锁页。官方指南给的写法与上面第一段相同。
- 上游 `CPUOffloadingSpec` [C5]：`cpu_bytes_to_use` 是所有 worker 合计的主机字节。每块字节（所有 worker 合计）= 本 worker 显存 KV 总字节 ÷ 块数 × worker 数，每段字节 = 它 × 段倍数，再按对齐取整（v0.23.0 的对齐值是 1）；段数 = `cpu_bytes_to_use` ÷ 每段字节。淘汰策略 `eviction_policy` 默认 `lru`，可选 `arc`。两种入口的单位不同（段数对字节），参数不能互抄。
- `offload_prompt_only` 默认 `true`：保存计划把位置数夹到提示词长度，decode 阶段的位置永远不进计划 [C1]。
- 保存计划：`num_computed_tokens + num_scheduled_tokens`，再夹到 `req.num_tokens` 和 `max_offload_tokens`；每组按 `位置数 // 段位置数` 取整段，跳过块号为 0 的滑窗、SSM 块，交给 `manager.prepare_store`。
- 查找与挂起：调度器只对 `num_computed_tokens == 0` 的请求先查本地、再调 `connector.get_num_new_matched_tokens` [C8]；返回异步加载时请求改为 `WAITING_FOR_REMOTE_KVS`，放回等待队列。连接器存在时引擎就给请求算块哈希，不看 prefix caching 开关 [C10]。
- 名字相近的另一条路：昇腾 `kv_pool/cpu_offload/` 下的 `CPUOffloadingConnector`，`enable_prefix_caching` 为假时调度侧、worker 侧都不建 [C14]。本页不展开。
- GLM 双机主线的启动参数里没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

- **缺容量参数**：昇腾 spec 没给 `num_cpu_blocks` → `Exception: num_cpu_blocks must be specified in kv_connector_extra_config` [C2]；上游 spec 没给 `cpu_bytes_to_use` → 同样写法的 `Exception`。
- **多个缓存组**：昇腾 spec 的 `get_manager` / `get_handlers` 里 `assert len(self.gpu_block_size) == 1`，`gpu_block_size` 每个缓存组一项。GLM 有 5 个组，这里 `AssertionError`（按代码推断，未实跑）[I]。
- **段大小不合法**：给了 `block_size` 但各组块大小不同 → 上游断言「If 'block_size' is specified …, all groups must have the same block size」；`block_size` 不是设备块大小的整数倍 → 断言失败 [C7]。
- **混合模型块大小对不齐**：设备块大小不能被哈希块大小整除 → 上游断言，信息提示混合模型需要 `--enable-prefix-caching` 来对齐块大小。
- **两份钉住源码接口不配套**：v0.23 维护分支、GLM 快照、v0.26 分支的昇腾 spec 从 `vllm.v1.kv_offload.abstract`、`.spec`、`.mediums` 导入 [C13]，这几个模块在上游 v0.23.0 之前的重构（c42981d034）里已删除；它还给 `CPUOffloadingManager` 传 `block_size`，而 v0.23.0 的构造函数没有这个参数 [C20]。和 vLLM v0.23.0 装在一起时，按代码推断加载这个 spec 就会导入失败（未实跑）[I]。main 上的重构 PR #13389 也写明修了原生 offload 的兼容问题。
- **运行时只有日志**：主机放不下新段 → warning「Request %s: cannot store blocks」，本步跳过这条请求的保存；主机内存开得过大 → 主机 OOM，官方指南专门提醒按可用内存调 `num_cpu_blocks`。

### 开销和什么时候别开

- **每个完整段都付一次设备到主机的拷贝**，不管将来有没有人用；和计算抢内存带宽。存的方向要等计算流写完 [C4]，所以不是完全不碍事的后台任务。
- **主机锁页内存一次开满**：昇腾 spec 按 `num_cpu_blocks × 段倍数` 为每层 K、V 各开一块，上游按 `cpu_bytes_to_use` 换算段数。每台机器上的每个 worker 进程都各开一份自己的。
- **搬回至少晚一步**：请求在 `WAITING_FOR_REMOTE_KVS` 里等到拷贝完成才重新参与排步。
- **适合开**：开头重复多（多轮对话、长系统提示词、同一文档反复提问），主机内存富余，实测的有效带宽高于[持平带宽](#搬回和重算各花多少)。
- **别开**：请求开头几乎不重复（只付存的开销，没有命中）；主机内存紧；模型有多个缓存组、又停在只接受单组的昇腾版本上（包括钉住的 GLM 快照）。
- **怎么测**：每笔拷贝都用开始、结束两个事件计时，`TransferResult` 里带字节数和用时，除一下就是这台机器的有效带宽。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 | GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad | 意味着什么 |
|---|---|---|---|---|---|
| 昇腾实现在哪 | `vllm_ascend/kv_offload/npu.py`、`cpu_npu.py` | 同左，这个目录三处逐字相同 | 同左 | 挪到 `distributed/kv_transfer/kv_pool/kv_offload/native/`，继承上游 `CPUOffloadingSpec` [C18] | main 上不用写 `spec_name`：上游默认就用 `CPUOffloadingSpec`，昇腾注册时把它顶替成自己的实现 |
| 容量怎么给 | `num_cpu_blocks`（段数） | 同左 | 同左 | `cpu_bytes_to_use`（全部 worker 合计字节）+ `blocks_per_chunk` | 单位不同，从旧写法换到 main 要重算 |
| 缓存组 | 断言只有 1 个 | 同左 | 同左 | 走上游的多组逻辑 | GLM（5 个组）在 main 上能否走通待核 |
| 和上游接口 | 导入的上游模块在 vLLM v0.23.0 已删 | 同左 | 同左 | 按上游新接口重写 worker | 前三列和同版上游装在一起起不来（按代码推断）[I] |
| 主机之外的层级 | 只有 CPU | 同左 | 同左 | 另有 `NPUTieringOffloadingSpec`：CPU 主层之后再接更慢的层 | 主机放不下的冷数据还能往下放 |

上游 vLLM 这边：v0.23.0 的段大小由 `kv_connector_extra_config` 里的 `block_size`（位置数）给；v0.26 起多了 `blocks_per_chunk`（每段几页），和按位置数给的 `block_size` 二选一，两个都给会 `ValueError`。`offload_prompt_only` 默认 `true` 在两版上相同。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 保存计划：已算 + 本步、取整段、只存提示词 | `vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py`，`_build_store_jobs`（v0.23.0 L721–L806） |
| 外部命中查找 | 同文件 `get_num_new_matched_tokens`（L537–L567） |
| 请求结束时还在拷的页 | 同文件 `request_finished`（L1017–L1027） |
| 调度器何时问连接器、何时挂起 | `vllm/v1/core/sched/scheduler.py`（L605–L630、L800–L812） |
| 有连接器就算块哈希 | `vllm/v1/engine/core.py`（L206–L215） |
| 段倍数、`offload_prompt_only`、每组块大小 | `vllm/v1/kv_offload/base.py`，`OffloadingSpec.__init__`（L378–L442） |
| 上游按字节换算容量 | `vllm/v1/kv_offload/cpu/spec.py`（L30–L71） |
| 昇腾 spec：`num_cpu_blocks` 与单组断言 | `vllm_ascend/kv_offload/npu.py`（GLM 快照 L16–L63） |
| 两条传输流 | `vllm_ascend/kv_offload/cpu_npu.py`（L63–L68） |
| 主机缓冲与 K、V 成对的假定 | 同文件 L77–L133 |
| 等计算流、同向排队、完成检查 | 同文件 `transfer_async` / `get_finished`（L180–L261） |
| main 上的昇腾实现与注册 | `vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py`（L42–L60）、`vllm_ascend/distributed/kv_transfer/__init__.py`（L21–L37） |
