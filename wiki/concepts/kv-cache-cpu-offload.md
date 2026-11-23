---
id: kv-cache-cpu-offload
title: KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存
type: feature
summary: >-
  把可保存的KV状态复制到主机，后续命中时搬回设备以减少重算。用普通整段路径说明页、段、带宽和异步等待，再区分新版部分尾状态、私有锁页与共享mmap。GLM主线未开，释放的池容量也不能当成实际恢复字节。
aliases:
  - KV Cache CPU Offload
  - CPU Offloading
  - KV cache CPU 卸载
  - OffloadingConnector
  - NPUOffloadingSpec
  - CPUOffloadingSpec
  - num_cpu_blocks
  - blocks_per_chunk
  - cpu_bytes_to_use
  - offload_prompt_only
chapters:
  - '11'
sources:
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L721-L806
  - 'vllm-ascend@db701c1f:vllm_ascend/kv_offload/npu.py#L16-L63'
  - 'vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L63-L68'
  - 'vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L180-L261'
  - 'vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L30-L71'
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L537-L567
  - 'vllm@0fc695fc:vllm/v1/kv_offload/base.py#L378-L442'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L605-L630'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L800-L812'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L206-L215'
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L1017-L1027
  - 'vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L77-L133'
  - 'vllm-ascend@db701c1f:vllm_ascend/kv_offload/npu.py#L1-L13'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/cpu_offload/cpu_offload_connector.py#L66-L78
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L1-L108
  - 'vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L16-L63'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/kv_offload/npu.py#L16-L63'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L42-L60
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L37'
  - 'vllm@0fc695fc:vllm/v1/kv_offload/cpu/manager.py#L39-L46'
  - >-
    raw:sha256-780ecc1534f5818e25ca01abca8c7e7f85f4f5fa94425e785e489d71606c65f8.md#L1-L810
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L1-L14
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L83-L90
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L36'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L1-L14
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L83-L90
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L1-L139'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L1-L102'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L41-L97'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L65-L232'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L275-L344'
  - 'vllm@ced6857a:vllm/v1/kv_offload/cpu/spec.py#L94-L165'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/config.py#L75-L176'
  - 'vllm@ced6857a:vllm/config/parallel.py#L874-L884'
  - 'vllm@568afb3a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/config.py#L59-L88'
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L905-L979'
  - 'vllm@0fc695fc:vllm/v1/kv_offload/cpu/manager.py#L137-L180'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L270-L307'
  - 'vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L266-L303'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L951-L1002'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L1464-L1560'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/config.py#L250-L274'
  - 'vllm@ced6857a:vllm/v1/kv_offload/base.py#L590-L607'
  - 'vllm@ced6857a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L1314-L1389'
  - 'vllm@84030bbe:vllm/v1/kv_offload/cpu/spec.py#L94-L165'
  - 'vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L73-L98'
  - 'vllm@84030bbe:vllm/distributed/kv_transfer/kv_connector/v1/offloading/config.py#L94-L135'
  - 'vllm@568afb3a:vllm/v1/kv_offload/base.py#L504-L513'
  - 'vllm@84030bbe:vllm/v1/kv_offload/base.py#L596-L604'
  - 'https://github.com/vllm-project/vllm-ascend/pull/13389'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L233-L264'
  - 'vllm@84030bbe:vllm/v1/kv_offload/factory.py#L30-L58'
  - 'vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L24-L28'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/__init__.py#L25-L34'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L41-L65'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/__init__.py#L60-L68'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L43-L68'
  - 'vllm@ba15685a:vllm/v1/kv_offload/cpu/spec.py#L99-L123'
  - 'vllm@ba15685a:vllm/distributed/kv_transfer/kv_connector/v1/offloading/config.py#L121-L134'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefix-caching
    kind: builds-on
    note: 扩展可复用前缀的存储位置
  - to: prefix-caching
    kind: variant-of
    note: 在纯显存前缀缓存之上增设主机 DRAM 冷前缀备份层，构成显存+主机两级复用变体
  - to: paged-attention
    kind: builds-on
    note: 设备侧分页块按多页拼成主机段（chunk）做异步 DMA 双向搬运
  - to: kv-cache-spec
    kind: builds-on
    note: 根据实际页规格计算外存段容量
  - to: kv-cache
    kind: builds-on
    note: 备份和搬回的对象
  - to: recompute-cpu-offload
    kind: alternative-to
    note: 同样把 KV 存到主机，但在抢占那一刻只存被抢占的那条请求
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-23cdfe3485b3222b99f83e701316efbad544025e95db1e688ba0a608fadbc520.md
  - >-
    raw/sha256-4e31c5bc68937e83233626f9aa12b0e71bdba9c997807603260a065d74d00fe9.md
  - >-
    raw/sha256-780ecc1534f5818e25ca01abca8c7e7f85f4f5fa94425e785e489d71606c65f8.md
---

## 显存放不下的 KV cache，能先存到 CPU 内存吗？

**KV cache CPU offload（KV cache CPU 卸载）是在主机内存（CPU 一侧的内存）里给算好的 KV cache 多存一份：显存里那份被回收以后，只要主机那份还在，下次用到同一段开头时就把它搬回显存，不用重新算一遍。**

[KV cache](kv-cache.md) 保存后续计算需要的历史：普通注意力按位置存 K、V，混合模型还可能包含递推状态和索引。先看普通注意力、整段存取的例子，缓存放在显存（NPU 自己的内存）里，用满就要腾地方：

1. 请求 A 算完了一段开头，这段 KV cache 在显存里占了两页。开着 CPU offload 时，vLLM 顺手把这两页复制一份到主机内存。
2. 显存紧张，A 的这两页被收回，让给请求 C。显存里 A 的那份没了，主机里的还在。
3. 请求 B 具有相同的前缀输入身份（或者就是 A 自己被抢占后排回来），所需主机副本仍然可用，就在显存分空页、搬回这段状态并继续算。身份要匹配 token、LoRA、多模态内容等，不能只看显示的文字，见[前缀缓存](prefix-caching.md#哪些块能被共享)。

```wiki-diagram
file: kv-cache-cpu-offload
```

说「挪到 CPU」，实际做的是**多存一份**：显存那份照常被读、照常按显存的规则回收，主机那份按主机的容量另行管理。两份各管各的，所以主机副本不会让显存变大，它省下的是重算。

## 为什么需要它：显存不够时，本来只能重算

**没有其他外部副本时，本地缓存被淘汰后要再用就得重算。** 归还块号还不等于内容已经被淘汰，常见的两种来路是：

- **前缀被挤掉。** [Prefix caching](prefix-caching.md) 让开头相同的请求共用已经算好的块，前提是这些块还在显存里。缓存池满了，暂时没人用的旧块会被新请求拿走，下一条同开头的请求只好重算。
- **请求被抢占。** 调度器收回请求的块、清零已算位置；重新排入时还会查询可复用前缀。若本地和外部都没有可用副本，才从头重算（历史 GLM 双机的抢占重算账见后半段[放到 GLM 双机](#放到-glm-双机主线没开它开了要搬多少)）。

主机内存和显存是两块分开记账的内存（见[主机内存与显存](device-memory.md)）。把显存留不住的那部分放到主机，相当于给 KV cache 多加了一层存储。**这一层有用的前提是：从主机搬回来比重算快。**

它也有代价：

- **提前保存有传输成本。** 常规路径在可保存段形成时安排复制，不等显存满；已存在的段、被策略过滤的段或无法分配主机空间的段会跳过。真正保存却从未复用的段，这趟传输没有带来重算收益。
- **主机内存要预先划出来。** 启动时就在主机开好一整块固定大小的缓冲，能锁页时用锁页内存（pinned memory，不会被操作系统换出到磁盘、设备可直接 DMA 搬运，传输更快）。开得太大会把主机内存挤爆。
- **搬回要等。** 搬回在后台进行，请求先挂起，搬完之后才能接着算；搬运还会和计算抢内存带宽。
- **显存池不会变大。** 缓存池还是启动时切出来的那么多块，只是被收回的内容多了一个找回来的地方。

## 搬回和重算，各花多少？

**搬回的时间 = 要搬的字节 ÷ 主机到设备的有效带宽；重算的时间 = 要算的位置数 ÷ 每秒能算的位置数。** 两边都换成时间，才能比。

沿用 [KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)的示意模型：每个位置 32 层共存 128 KiB，一段 4,096 个位置的开头就是 512 MiB。再给两个示意数：主机到设备的有效带宽 16 GiB/s，这张卡每秒能 prefill 16,384 个位置。

$$B_{\text{盈亏平衡}} = \text{每位置字节} \times \text{prefill 速率} = 128\text{ KiB} \times 16{,}384\text{ 位置/s} = 2\text{ GiB/s}$$

| 同一段 4,096 个位置的开头（示意数） | 算式 | 结果 |
| --- | --- | --- |
| 要搬运的字节数 | $4{,}096\text{ 位置} \times 128\text{ KiB}$ | **512 MiB** |
| 从主机搬回耗时（有效带宽 16 GiB/s） | $512\text{ MiB} \div 16\text{ GiB/s}$ | $0.03125\text{ s} =$ **31.25 ms** |
| 在设备上重算耗时（prefill 速率 16,384 位置/s） | $4{,}096\text{ 位置} \div 16{,}384\text{ 位置/s}$ | $0.25\text{ s} =$ **250 ms** |
| 搬回与重算持平所需带宽 | $128\text{ KiB} \times 16{,}384\text{ 位置/s}$ | **2 GiB/s** |

有效带宽高于 2 GiB/s 时搬回就比重算快；在这组示意数下搬回快 8 倍。

```wiki-diagram
file: kv-cache-cpu-offload-cost
```

持平带宽的算法值得记住：**每个位置的缓存字节 × 每秒能算的位置数**。有效带宽高于它，搬回划算；低于它，重算划算。这笔账还要补三处：

- **长开头可能更适合搬回。** 对全注意力，重算还包含随上下文增长的历史注意力计算，实际prefill速度可能下降，使持平带宽降低。稀疏或线性注意力的增长规律不同，须用模型在目标长度下的实测速度；不能把所有模型都当作全历史打分。
- **短开头更偏向重算。** 搬回至少要等一步：请求先挂起，调度器在后面某一步看到搬完了，才让它接着算。开头只有几十个位置时，重算往往顺手塞进本步就做完了，搬回反而多等一步。本节普通整段路径不保存不足一段的尾巴，这部分只能重算；新版部分尾状态的条件见[页和段](#按多大的单位存页和段)。
- **有效带宽要实测。** 搬运和计算、和其他请求的保存共用同一条链路与内存带宽，不能拿链路的标称值代入。

实现本身不做这笔比较：主机里有整段能接上，就搬回。这笔账是用来决定开不开、段设多大的。

## 什么时候存，什么时候搬回？

**常规保存依据可用内容与策略，和显存是否已满无关；等待中的请求首次查缓存时，先查本地、再问外部还能接上多少。** 下面按固定旧上游的整段路径说明，较新的部分尾状态存取见[版本差异](#版本差异)。主机查找尚未结束、容量不足或状态未就绪时，请求仍需等待。

这套机制在 vLLM 里叫 `OffloadingConnector`，属于 KV connector（调度器与 worker 两侧用于搬运 KV cache 的扩展接口），分成两半协同工作。**调度侧**沿用上游 vLLM 代码，决定存哪些段、查主机能接上多少。**worker 侧**真正拷字节，由昇腾换成自己的实现：一个 spec（定主机容量与存储单位）加一个 handler（执行双流拷贝）。

以请求 A 存、请求 B 取为例，一段缓存要走五步，第 1、3、4 步在调度侧，第 2、5 步的拷贝在 worker 侧：

1. **排进保存计划。** 每一步排完，调度侧看A的“已算位置 + 本步要算的位置”能凑满几段，筛去无效占位和以后无法命中的滑窗段，再由主机管理器筛已存在内容、检查保存策略和容量。计划先于本步计算写好，只覆盖已确定的token；默认只存提示词部分，decode新生成的位置不存。

   保存计划还有位置范围限制：先取本批计算完成后的进度与请求的位置数中较小的一个；如果请求还设置了最大卸载位置数，再用这个上限截住保存范围。得到允许保存的位置范围后，才判断其中能凑满多少段。
2. **等算完再拷。** worker 在专门的传输流（stream：设备上按顺序执行的一条任务队列，计算和拷贝放在不同的流上才能同时进行）上先等本步计算把这些位置写完，再把字节从显存拷到主机。
3. **登记为可用。** 拷完的段在主机一侧登记，靠「从开头到这一段为止的内容」算出的哈希来认，所以换一条请求、只要开头相同也能认出来。显存里的原页仍归显存的缓存管理器，照常被复用或回收。
4. **进场时查找。** B 进场（已算位置为 0，新请求和被抢占后排回来的都算）时，调度器先看显存里能复用多少个位置，再问主机还能接着往后接上多少个。
5. **分页、搬回、恢复。** 能接上，就先在显存给这些位置分好空页，B 挂起等待；worker 在另一条传输流上把主机数据拷进这些页，拷完报告完成，B 才恢复，从接上的位置往后算。

要分清三个时刻：**预计本步结束后达到保存边界**，调度侧就可以先列计划；**本步计算写完**，源数据就绪，传输才可读取；**字节已经拷到另一边**，由参与worker的完成信号确认，主机副本才可用。计划包含本步待计算的位置，不能把“列入计划”当成已经算完。

拷贝进行时，两头的页都不能乱动：源页要保持有效，目标页要等拷完才能读。A 在保存拷完之前就结束了，它的页照样还回池子，但会被记上一笔：谁要复用这些页，得先等这笔保存拷完。

若提前保存已在页回收前完成，就能省去临时保存的等待；判断依据是保存完成信号，仅有计划还不足以确认主机副本可用。

```wiki-diagram
file: kv-cache-cpu-offload-flow
```

图中的“等待”是请求暂不进入后续前向，调度器仍可推进其他请求。保存、加载的完成通知由参与传输的worker汇总；不能把其中一张卡先完成当作整个执行组已经可用。

下面用一个缩小的完整段追踪两份副本：2 页，每页 2 个位置，K、V 各 2 通道。位置 p 的四个示意数取为 [p,p+1,p+2,p+3]。显存原页回收后，B 在新分配的页里接回相同内容，等待加载完成通知后继续。它演示可选 offload 机制，固定 GLM 双机主线没有启用。

```wiki-scene
inference-mechanism:6
```

## 按多大的单位存：页和段

**常规路径中，显存按页分配，主机按段存：一段覆盖序列上相邻的若干页，设备物理块号不必连续。** 页就是缓存池的 KV 块，见[KV缓存规格](kv-cache-spec.md)；段是主机管理单位，由配置决定包含几页。以下算例按整段命中，`v0.30.0` 与 `main` 的部分尾状态是带额外条件的另一条路径。

继续用示意模型，设一页 16 个位置，每 4 页拼成一段：

| 主机缓冲与段容量核算（单个 worker 示意，忽略对齐与管理开销） | 算式 | 结果 |
| --- | --- | --- |
| 一页大小 | $16\text{ 位置} \times 128\text{ KiB}$ | **2 MiB** |
| 一段大小（4 页） | $4\text{ 页} \times 2\text{ MiB}$ | **8 MiB**（64 个位置） |
| 1 GiB 主机内存可存容量 | $1{,}024\text{ MiB} \div 8\text{ MiB}$ | **128 段**（8,192 个位置） |
| 算完 70 个位置的切分结果 | $64 + 6$ | **1 段**（64 个位置）+ 剩 6 个位置 |

剩下的 6 个位置凑不满一段，在整段路径下不保存。

显式指定一段包含多少个位置时，本页固定的上游实现还要求：已经建立缓存组，各组的设备块覆盖的位置数一致，而且段的位置数必须是设备块位置数的整数倍。这里比较的是 token 数，不是页字节数。前面的示意中，每块 16 个位置、每段 64 个位置，满足这个整除条件；实际配置还须核对缓存组的布局，不能只按希望一次搬多少数据来决定段大小。

段大小是一对取舍：

- **段越大，管理项越少，一次拷得越多**，拷贝的固定开销摊得越薄。
- **段越大，命中越粗。** 两条请求的开头只有 100 个位置相同时，按上面的设定只有第 1 段（前 64 个位置）能命中，后 36 个照样重算。开头要连着相同才行：第 1 段不同，后面的段即使内容相同也认不出来。
- **不满一段的尾巴不存。** 默认只存提示词时，70 个位置的 prompt 最后 6 个不会靠后续 decode 补成可保存的段；允许保存生成内容后，A 再算 58 个位置、凑满第 2 段，才可能把这一段存下。

一页、一段的字节要把所有层、所有相关的缓存张量加起来。混合模型除了 K、V，还有 [linear attention](linear-attention.md) 的递推状态、稀疏 attention 的索引缓存，只算 K、V 会把段算小。

1 GiB 只装得下 8,192 个位置，也就是两条 4,096 个位置的开头。主机装满以后，默认按 LRU（最久没被用过的先淘汰）腾地方，上游实现也可以选 ARC（同时看访问频率和新近程度、自动调整两者比重的淘汰算法）。

## 搬运在后台进行，计算什么时候要等？

**存和取分开排队，具备与计算重叠的机会；写入、读取和复用源页都需要同步。** 旧 handler 每个方向一条流，`v0.30.0` 与 `main` 会复用流池，但同方向仍按事件排序。

- **存（设备到主机）。** 传输流先等计算流把本步的数据写完，才开始拷，否则拷走的是没写完的页。
- **取（主机到设备）。** 不用等计算流，但那条请求一直挂着，直到这笔拷贝报告完成。
- **同一方向排队。** 同一方向的后一笔拷贝要等前一笔的完成信号，再一次性提交这一批页的拷贝，并记下本笔的开始、结束信号。每一步按提交顺序逐笔查看，拷完的就报告给调度侧。
- **覆盖仍在保存的源页前也要等。** 请求已经结束并不代表保存结束；页再次分配时，连接器会要求相关保存任务完成，防止新写入覆盖尚未拷走的内容。

CPU 在拷贝期间可以接着处理别的事，设备也能让传输和计算重叠；但两者抢同一份内存带宽，传输越多，留给计算的带宽越少。每笔拷贝都记了字节数和用时，要实测有效带宽，就从这里取。

## 新版主机副本放在哪里，谁共享？

`v0.30.0` 与 `main` 的官方指南提供两种路径。只有 CPU 层时，worker 各自申请主机张量，平台支持时使用锁页内存；要接文件系统或分布式 [KV pool](kv-pool.md) 等次级层时，则使用共享内存映射，让 worker、调度侧和次级存储管理器访问同一块主机区域。共享映射叫 mmap，它解决多个进程看到同一份字节的问题，不能据此推断设备传输速度与锁页张量相同。

```wiki-diagram
file: kv-cache-cpu-offload-fig-host-swap
```

上图把前文的计算流/D2H/H2D 三流异步重叠时间线与 `v0.30.0` / `main` 的两种主机内存布局并在同一视图里。还有一种减少重复副本的特例：[MLA](mla.md) 把注意力历史压缩成潜在状态，[TP](tensor-parallel.md) 把同一层计算分给多卡；在允许去重的纯 MLA 布局中，各卡保存相同的潜在状态字节。参与进程用 rank 编号，因此「多个 rank 共用一份」是共享这份相同数据，并非把不同数据强行合并。

| 路径 | 主机数据如何存放 | 容量与代价 |
|---|---|---|
| 只有 CPU 层 | 各 worker 私有的张量缓冲，能锁页时锁页 | 同一执行组各 worker 的主机副本合计占用预算，不能每个 worker 都按总预算各开一份 |
| CPU 加文件系统等次级层 | worker 与调度侧连接同一主机映射区域，较冷的数据可再写入文件系统 | CPU 预算之外还要磁盘容量与 I/O；Ascend 这条 mmap 路径的 NPU 传输带宽须独立测量 |
| 多层路径满足纯 MLA 复用条件 | 同节点纯 TP 且各 rank 保存相同 MLA 字节时，可共用单份主机布局 | 只在实现通过条件检查时减少重复副本；混合 GLM 不能直接套用 |

这里的“所有 worker”指连接器配置里的执行组，不天然等于整台服务器或全部 DP 实例。[PP](pipeline-parallel.md) 将模型层分成流水阶段，[DP](data-parallel.md) 把请求分给多个执行组，[prefill 上下文并行](context-parallel.md)再分担长输入。常规进程启动时，组大小为 PP × TP × prefill 上下文并行数；多个 DP 组分别建立实例时，主机预算还要按同机实例合计。外部启动器的 world size（当前并行执行组内的总进程数）包含 DP 时，须按该有效值计算，不能再次乘 DP。它与 [Engram 主机共享](deepseek-v4-1-flash.md#engram-为什么把另一笔内存账放到主机上)属于不同数据和分配机制，不能互相替代配置。

文件系统次级层还要考虑段大小与 I/O 线程：大段减少管理开销但使命中更粗，更多读写线程只在后端具备相应并行能力时有用。官方 rc2 指南注明该层淘汰策略仍在开发，因此不能把 CPU 层 LRU 当作磁盘也会自动限额淘汰的保证。

## 放到 GLM 双机：主线没开它，开了要搬多少？

上面讲完了标准单组模型（如 `Qwen3-8B`）的页/段 DRAM 拷贝、异步双流恢复与 `v0.30.0` `OffloadingConnector` 主机布局。下面单独隔离本站 `09 旗舰异构模型全案` 的历史双机边界（`vllm@0fc695fc + vllm-ascend@db701c1f`）：**GLM 双机主线没有开 CPU offload，启动参数里没有 KV 传输配置，被抢占请求在本机从头重算；在钉住的 GLM 快照上直接打开也起不来。**

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。主线的 prefix caching 也关着（GLM 属于混合模型，原因见[前缀缓存页](prefix-caching.md#glm-双机上它开着吗)，后果见[部署页后果清单](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)），因此主线只会碰到「请求被抢占」。

主线抢占的账在[多条请求的KV块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)：DP0 跑满 32 条、各走到约 67,000 个位置时，被抢占请求每卡还回 120–121 块，排回来重算约 9 步。一个 DP 组 8 张卡在同一台机器，各有自己的显存。先保留这笔设备容量账，再区分它与实际传输量：

| 被抢占请求释放的容量与重算量（块数、池容量与 9 步推导见[多条请求页](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)） | 算式 / 边界 | 数值 |
| --- | --- | --- |
| 每卡释放的池容量 | $120\text{–}121\text{ 块}$ | $\approx \mathbf{956\text{–}964\text{ MiB}}$ |
| 一个 DP 组 8 张卡的容量合计 | $8 \times (956\text{–}964)\text{ MiB}$ | $\approx \mathbf{7.47\text{–}7.53\text{ GiB}}$ |
| 重新排入后的重算步数 | 单步 8,192 token 预算下重算 | **9 步** |
| 搬回耗时 | $\text{实际需恢复的字节} \div \text{实测主机到设备带宽}$ | **待实测**（释放容量不是实际拷贝字节） |

实际传输只包含保存成功且本次恢复需要的状态，受默认只存 prompt、分组页布局和留档边界影响，不能把约 `7.5 GiB` 池容量直接当成主机副本大小。若历史大半来自 decode，默认设置不会保存那部分。部署算例每位置 `13,056 B` 是按池槽折算的容量口径，不能直接充当有效载荷；持平带宽应按「实际搬运字节 ÷ 恢复位置数 × 每秒重算位置数」算，带宽、恢复字节和 9 步耗时均需实测。

下图把上述容量口径区分，以及钉住 GLM 快照直接开启 CPU Offload 时的三层碰壁与新版改写合在一起对照：

```wiki-diagram
file: kv-cache-cpu-offload-fig-glm-barriers
```

在钉住的 GLM 快照上打开它，会一层层碰壁：

- **先是导入失败。** 昇腾这版 spec 引用的几个上游模块，在钉住的 vLLM 里已经删掉了，加载 spec 时就停下，见[会报什么错](#会报什么错)。
- **补齐接口后，启动卡在缓存组检查。** 昇腾这版实现只接受一个缓存组；GLM 的状态分成 5 个组（full 组、尾状态组、3 个 KDA 组），见[KV 缓存规格](kv-cache-spec.md#对齐成两档页编成五个组)。
- **过了检查，还有两处要重写。** 一是张量布局：旧版按「每层一对 K、V 张量」开主机缓冲与算拷贝地址，而 GLM 缓存不按 K、V 拆，同一片显存由多组共用（见[一个块号在两档页里各占一格](kv-cache-spec.md#一个块号在两档页里各占一格)）。二是混合状态对齐：稀疏 MLA、索引器尾状态与 34 层 KDA 必须停在同一位置才能接着算；KDA 递推状态无法按位置拼接，只能在段边界存下当时整份状态（见[前缀缓存哪些块能共享](prefix-caching.md#哪些块能被共享)）。

就算这些都解决了，每卡 3,855 块的缓存池也不会因此变多：主机缓冲、传输带宽都是额外的开销。想借它把显存池切小、多留给别的用途，要同时评估搬回的频率和延迟。

新版已经改为按缓存组和页的字节视图搬运，旧版“一层两张量”的结构障碍不再原样适用；GLM状态边界和设备正确性仍需单独验收，见源码区。

## 常见误解

- **「显存满了才往CPU搬。」** 保存计划按可保存边界和策略生成，不以显存已满为触发器；官方指南用“显存满时卸载”概述用途，实际时序须看连接器。此前保存已完成时，回收才无需临时再搬。
- **「开了它，显存能多装请求」**——缓存池大小不变，它省的是重算，不是显存。官方指南说它让显存有限时能处理更长的上下文、更多并发，意思是缓存被挤掉、请求被抢占以后找回来更便宜，不是池子变大。要让缓存少占显存，看 [KV cache 量化](kv-cache-quantization.md)。
- **「搬回一定比重算快」**——要看带宽、开头长度和计算速度。有效带宽低于持平带宽、开头很短、或者不满一段时，重算更划算，或者只能重算。
- **「它就是抢占时把请求存到主机」**——不是一回事。本页是算完一段就存、按内容哈希给任何开头相同的请求用；[抢占卸载](recompute-cpu-offload.md)是在抢占那一刻把这条请求的状态存走、恢复时还给它。PD 分离的 D 节点上，[RecomputeScheduler](recompute-scheduler.md) 配上能存 KV 的连接器时走后一种；存不走，就把请求退回 P 重算。
- **「decode 生成的内容也会备份」**——上游默认只存提示词部分，生成出来的位置不存，要改默认值才会存。
- **「prefix caching 关着就用不了」**——上游这套在连接器打开时照样给请求算内容哈希，不靠 prefix caching 的开关；但混合模型各组块大小对不齐时，上游会要求打开 prefix caching。昇腾另有一个名字相近的 CPUOffloadingConnector，prefix caching 关着时它两头都不建，等于没开。

## 对照源码

### 怎么开

以下是两代配置入口。第一段保留旧官方指南写法，固定旧Ascend与所配vLLM存在下节列出的导入不兼容，不能直接当作已验证启动命令；GLM旧镜像还有多组和状态布局障碍。第二段用于rc2/main的新版入口，也需先确认模型支持。

```bash
# v0.23 维护分支、GLM 快照、v0.26 分支：用昇腾自带的 spec，容量按主机段数给
--kv-transfer-config '{"kv_connector":"OffloadingConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"num_cpu_blocks":1000,"block_size":128,
  "spec_name":"NPUOffloadingSpec","spec_module_path":"vllm_ascend.kv_offload.npu"}}'
# rc2/main：昇腾注册NPU实现，容量按执行组主机字节给
--kv-transfer-config '{"kv_connector":"OffloadingConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"spec_name":"CPUOffloadingSpec","cpu_bytes_to_use":8589934592,"blocks_per_chunk":8}}'
```

- 昇腾 `NPUOffloadingSpec` [C2]：`num_cpu_blocks` 是主机段数，必填；`block_size` 是一段的位置数，必须是设备块大小的整数倍，段倍数 = `block_size` ÷ 设备块大小。主机缓冲在 handler 初始化时一次开好：每层 K、V 各一块，第 0 维是 `num_cpu_blocks × 段倍数` 个设备块，能锁页就锁页。官方指南给的写法与上面第一段相同。
- 固定旧上游 `CPUOffloadingSpec` [C5]：`cpu_bytes_to_use` 是配置world size内worker合计的主机字节。合计每块字节 = 本worker的KV规划字节 ÷ 块数 × worker数，再乘段倍数并按对齐取整；容量向下取整为完整段数。两种入口的单位不同（段数对字节），参数不能互抄。rc2/main按实际缓存布局计算容量，满足单份复制布局时按一份计，普通布局仍按worker数计（来源32–34、42、45、47）。
- `offload_prompt_only` 默认 `true`：保存计划把位置数夹到提示词长度，decode 阶段的位置永远不进计划 [C1]。
- `eviction_policy` 默认lru，可选arc；`store_threshold` 达到2及以上时会过滤低频候选，默认不做这个过滤。已存在的内容也不会每次重新保存。因此“凑满就存”是未被策略过滤的常规路径（来源20、32、37、46）。
- 保存计划：`num_computed_tokens + num_scheduled_tokens`，再夹到 `req.num_tokens` 和 `max_offload_tokens`；每组按 `位置数 // 段位置数` 取整段，跳过块号为 0 的滑窗、SSM 块，交给 `manager.prepare_store`。
- 查找与挂起：调度器只对 `num_computed_tokens == 0` 的请求先查本地、再调 `connector.get_num_new_matched_tokens` [C8]；返回异步加载时请求改为 `WAITING_FOR_REMOTE_KVS`，放回等待队列。连接器存在时引擎就给请求算块哈希，不看 prefix caching 开关 [C10]。
- 名字相近的另一条路：昇腾 `kv_pool/cpu_offload/` 下的 `CPUOffloadingConnector`，`enable_prefix_caching` 为假时调度侧、worker 侧都不建 [C14]。本页不展开。
- GLM 双机主线的启动参数里没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

固定旧上游CPU spec的字节对齐值是1（来源53）；新版main的 `spec_name` 可省略，工厂默认选择CPUOffloadingSpec，再由Ascend注册映射到NPU实现（来源19、52）。示例显式写出该名，便于与TieringOffloadingSpec区分。

### 会报什么错

- **缺容量参数**：昇腾 spec 没给 `num_cpu_blocks` → `Exception: num_cpu_blocks must be specified in kv_connector_extra_config` [C2]；上游 spec 没给 `cpu_bytes_to_use` → 同样写法的 `Exception`。
- **多个缓存组**：昇腾 spec 的 `get_manager` / `get_handlers` 里 `assert len(self.gpu_block_size) == 1`，`gpu_block_size` 每个缓存组一项。GLM 有 5 个组，这里 `AssertionError`（按代码推断，未实跑）[I]。
- **段大小不合法**：给了 `block_size` 但各组块大小不同 → 上游断言「If 'block_size' is specified …, all groups must have the same block size」；`block_size` 不是设备块大小的整数倍 → 断言失败 [C7]。
- **混合模型块大小对不齐**：设备块大小不能被哈希块大小整除 → 上游断言，信息提示混合模型需要 `--enable-prefix-caching` 来对齐块大小。
- **两份钉住源码接口不配套**：旧Ascend spec从上游abstract、spec、mediums模块导入（来源13），这些模块已在重构c42981d034删除；所配v0.23、v0.26源码树均没有这些路径。旧spec还传入旧manager的block_size参数，固定v0.23构造函数已经不接收它（来源20）。因此按固定源码导入链推断，旧入口无法启动，未做设备运行。[I] 后续[重构PR #13389](https://github.com/vllm-project/vllm-ascend/pull/13389)也说明修复原生offload兼容性；其Qwen测试不能充当GLM验证。
- **运行时只有日志**：主机放不下新段 → warning「Request %s: cannot store blocks」，本步跳过这条请求的保存；主机内存开得过大 → 主机 OOM，官方指南专门提醒按可用内存调 `num_cpu_blocks`。

### 开销和什么时候别开

- **被选中实际保存的段要付设备到主机拷贝成本**，即使以后没有人用；它与计算争用带宽，存之前还要等计算流写完（来源4、30）。

拷贝的数据量不能直接算成腾出的显存：设备页仍归缓存管理器管理。
- **主机缓冲按容量预分配**：旧Ascend按段数和K/V张量开缓冲；新版CPU-only使用各worker私有张量，多层路径使用共享mmap，容量口径按上文区分。
- **搬回至少晚一步**：请求在 `WAITING_FOR_REMOTE_KVS` 里等到拷贝完成才重新参与排步。
- **适合开**：开头重复多（多轮对话、长系统提示词、同一文档反复提问），主机内存富余，实测的有效带宽高于[持平带宽](#搬回和重算各花多少)。
- **别开**：请求开头几乎不重复（只付存的开销，没有命中）；主机内存紧；模型有多个缓存组、又停在只接受单组的昇腾版本上（包括钉住的 GLM 快照）。
- **怎么测**：每笔拷贝都用开始、结束两个事件计时，`TransferResult` 里带字节数和用时，除一下就是这台机器的有效带宽。

### 版本差异

**`v0.30.0` 与 `main` 的通用 CPU 卸载入口是 `OffloadingConnector`。** Ascend 将上游 `CPUOffloadingSpec`、`TieringOffloadingSpec` 注册为 NPU 实现（`NPUOffloadingSpec`、`NPUTieringOffloadingSpec`），调度侧 manager 仍复用上游，worker 侧使用 NPU stream 与批量拷贝。CPU-only 与多层存储分别选择这两个 spec；后者可接文件系统等次级层。

该路径要求 `cpu_bytes_to_use`，表示全部 worker 的 CPU 层预算；`blocks_per_chunk` 必须为正，也可在各 KV 组块大小一致时使用以 token 计的 `block_size`，两项互斥。它与抢占恢复用的 `PreemptOffloadConnector` 是不同入口，不能混用后者“主机块数按显存块数比例分配”的默认规则。

四个配套上游钉点见[块分配版本表](vllm-kv-block-allocation.md#版本差异)，GLM 专用镜像 `db701c1f` 沿用旧接口，单独保留上述限制。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 昇腾实现位置 | `kv_offload/npu.py`、`cpu_npu.py` | 同左 | `distributed/kv_transfer/kv_pool/kv_offload/native/`（同目录尚并存 `preempt_offload/` 与 `simple/`） | 延续 `native/` 与 `preempt_offload/`，已移除 `simple/` 目录（`__init__.py#L60-L68`） |
| 容量入口 | `num_cpu_blocks`，主机段数 | 同左 | `cpu_bytes_to_use`，配置执行组总预算（来源 54–55） | 同 `v0.30.0`（上游 `spec.py#L99-L123`，来源 58） |
| 每段大小 | `block_size`，按 token 给 | 旧 Ascend 接口仍在；上游新增 `blocks_per_chunk` | 默认 1 块，可给正 `blocks_per_chunk` 或 `block_size`，两者互斥 | 同 `v0.30.0`（`config.py#L121-L134`，来源 59） |
| 张量与缓存组 | 单组、每层 K/V 两张量假定 | 同左 | 按组的规范字节视图与页尺寸搬运 | 同 `v0.30.0`；不能仅凭多组接口认定 GLM 已设备验收 |
| 固定配套接口 | 引用已删除的上游模块，导入链不兼容 | 同左 | 按新接口重写并注册 `CPUOffloadingSpec` / `TieringOffloadingSpec` | 同 `v0.30.0`；`NPUTieringOffloadingSpec` 显式拒绝 `store_threshold` |
| 主机之外的层级 | 此 Ascend spec 只有 CPU | 同左 | 另有 `NPUTieringOffloadingSpec`，CPU 主层（`SharedOffloadRegion`）加次级层 | 同 `v0.30.0` |
| 只保存 prompt 的默认值 | `true` | `true` | `true` | `true` |

上游 vLLM 这边：`v0.23.0` 的段大小由 `kv_connector_extra_config` 里的 `block_size`（位置数）给；`v0.26.0rc` 起多了 `blocks_per_chunk`（每段几页），和按位置数给的 `block_size` 二选一，两个都给会 `ValueError`。`offload_prompt_only` 默认 `true` 在四版上相同。

`v0.30.0` 与 `main` 还有部分尾状态路径：每段必须只有 1 个物理块，各组逻辑块长相同，存在哈希粒度更细的 align 递推组，其他组满足非滑窗或专用状态条件，且没有 EAGLE 组、DCP 为 1。调度器提供边界状态后才可保存，查找还要求各组在同一边界都命中；不能把旧文“尾巴一概不存”推广到这些版本（来源 38–40、44）。普通整段示意的 64/70/100 个位置算例仍按其已声明的路径成立。

CPU-only 与多层共享布局见来源 27–32、55、57，实际 worker 按页字节搬运见来源 30–31；`v0.30.0` / `main` 的纯 MLA 单份主机布局只在单组精确 MLA 规格、页面字节账吻合、TP 大于 1、PP/PCP/DCP 均为 1、单节点 mp 执行且经 `SharedOffloadRegion` 共享区域时成立（来源 33、47、55）。GLM 混合组不满足这些条件。源码支持这些接口与限制；GLM 实际恢复字节、主机带宽、单步耗时、可用主机容量及恢复后的正确性尚缺 NPU 实测。[I]

CPU-only 与多层存储的官方指南及其文件系统调优、锁页/mmap 差异见来源 27；硬件带宽不能跨路径直接套用。[S27] 四版默认只存 prompt 的字段见来源 7、43、48–49，新版事件计时见来源 51；字节数除事件间隔测到传输段速率，不包含请求排队、CPU 准备和全部恢复等待，应同时测端到端延迟。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 保存计划：已算 + 本步、取整段、只存提示词 | `vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py`，`_build_store_jobs`（`v0.23.0` L721–L806） |
| 外部命中查找 | 同文件 `get_num_new_matched_tokens`（L537–L567） |
| 请求结束时还在拷的页 | 同文件 `request_finished`（L1017–L1027） |
| 调度器何时问连接器、何时挂起 | `vllm/v1/core/sched/scheduler.py`（L605–L630、L800–L812） |
| 有连接器就算块哈希 | `vllm/v1/engine/core.py`（L206–L215） |
| 段倍数、`offload_prompt_only`、每组块大小 | `vllm/v1/kv_offload/base.py`，`OffloadingSpec.__init__`（L378–L442）；`ba15685a` `offloading/config.py#L121-L134` |
| 上游按字节换算容量 | `vllm/v1/kv_offload/cpu/spec.py`（`0fc695fc` L30–L71；`ced6857a` L94–L165；`ba15685a` L99–L123） |
| 昇腾旧 spec：`num_cpu_blocks` 与单组断言 | `vllm_ascend/kv_offload/npu.py`（GLM 快照 L16–L63） |
| 两条传输流与主机缓冲 | `vllm_ascend/kv_offload/cpu_npu.py`（L63–L68、L77–L133、L180–L261） |
| `v0.30.0` 与 `main` 的昇腾实现与注册 | `c09d3e20`：`native/npu.py#L41-L65`、`kv_transfer/__init__.py#L25-L34`；`8d6180e2`：`native/npu.py#L43-L68`、`kv_transfer/__init__.py#L60-L68` |

固定旧上游的保存范围先受已确定位置数与可选最大卸载位置限制，再按默认prompt范围截断、取完整段（来源1）。主机管理器随后过滤已存在的段和未达阈值的候选，并检查可腾出的容量（来源37、46）。完成通知与源页复用前等待见36。

显式段大小的约束见旧上游base.py L430–442（来源7），新版配置入口见33、35；检查各组设备块的token数及整除关系。字节容量换算见5、32、45。示意64是16的整数倍，512MiB/16GiB/s=31.25ms、4096/16384=250ms、持平2GiB/s均为可复算的示意值。[D]

复制量不能充当显存回收量：保存任务可能在请求结束后仍未完成，调度器会登记待保存块以协调后续复用（offloading scheduler.py 1017–1027 行，来源 11）。实际何时释放、腾出多少容量，还取决于请求生命周期与保存完成时刻。
