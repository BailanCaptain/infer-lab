---
id: rfork-memory
title: RFork 内存：地址、底层存储与 main/draft 共享
type: feature
summary: 把权重地址登记给传输引擎时，要分清“权重自己占的那一段”和“它所在的整块内存”，还要把权重背后的存储保住，直到确认注销才放手；draft 和主模型共用的那部分权重不重复登记。
aliases:
  - RFork 内存注册
  - RFork storage owner
  - RFork shared draft
  - batch_register_memory_ex
  - RFork registration rollback
  - RFork tensor range
chapters: []
order: 60
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L40-L118'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L155-L175'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L271-L354'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L356-L461'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L463-L561'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L563-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L492-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L584-L591'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L255-L286'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L33-L37'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-layout
    kind: builds-on
    note: 必须先确定最终可传张量，才能登记它们此刻对应的内存范围
  - to: rfork-terms
    kind: builds-on
    note: Tensor、storage、view、MR 与 allocator block 分属不同层，不能当作同一对象
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 登记了地址，权重就能活到传输结束吗

新实例要从已经跑着的实例那里直接读权重，前提是老实例先把每块权重的地址登记给传输引擎。问题来了：地址登记好了，这块内存就安全了吗？

不会。**登记一个地址，并不会让地址背后的权重自动活到传输结束。** 权重被后处理换掉、被分配器回收，登记表里的地址照样还在，远端读到的就是别人的数据。所以工作版做了三件事：分清“权重自己那一段”和“它所在的整块内存”，把权重和它背后的原始存储一起保住，只有确认注销或整个传输引擎顺利结束后才放手。

## 用一小段权重看清两种范围

模型加载时会产生很多权重张量。下面不用真实模型，用一段编出来的地址把关系算清楚（登记给传输引擎的一段地址范围叫 MR，见[术语页](rfork-terms.md)）：

分配器给出一块 `[1000, 2024)` 的内存，共 1024 字节。权重 W 从 1128 开始，64 个 float16 元素，每个 2 字节，所以 W 自己占 `[1128, 1256)`，共 128 字节。

```wiki-diagram
file: rfork-memory
```

登记时要写四个数：`(1128, 128, 1000, 1024)`——前两个是 W 的**逻辑范围**（起点、长度），后两个是它所在那整块的**支撑范围**。传输引擎只读逻辑范围，不会把整块都当权重读走。

这些数字只用来演示半开区间，1000 不是真实地址；真实范围从当前张量和 NPU 显存快照里得到。半开区间包含起点、不包含终点，所以两段相邻范围可以在同一个端点衔接，不会重复一个字节。

## 先找所在的块，再登记权重那一段

工作版先从 NPU 显存快照里取出所有正在使用的分配块，挑出和要传的权重有交集的那些，排好序，把重叠或紧挨着的块并成一段。为了不让每个权重都把所有块扫一遍，它先给权重范围排序、记下前缀里最远的终点，查找时就能快速跳过。

接着减去主模型已经登记过的块（draft 场景，见下一节），再逐个检查：每个权重的逻辑范围是否**完整落在**剩下的某一块里。找不到完整覆盖就直接失败，不会把越界的范围硬塞给传输引擎。

同一块里相交或相邻的逻辑范围可以合成一项；中间有空洞的就分成几项。每一项都带着上面那四个数，分批交给带支撑范围的批量注册接口（下文叫 Ex 注册），每批最多 4096 项。

这是客户端这边的调用约定。现场的 YuanRong 版本能不能接受“同一个分配块里登记多段逻辑范围”，还要拿真实的 Ex 接口在 NPU 上验证，不能从老接口推断——老接口一次只收（地址、长度）两个数，根本说不清“这段范围坐落在哪个分配块里”，所以它能不能注册，说明不了 Ex 接口会怎样处理同块多段。

## 为什么只保住权重对象还不够

设想 W 的地址已经登记好，随后某个后处理步骤把 W 的数据整个换成了一个新张量。在 Python 里 W 还活着，但它已经指向新的存储；旧地址却还留在传输引擎的登记表里。只保住 W 这个对象，挡不住旧存储被分配器回收再分给别人。

所以工作版维护两张保活列表：一张存登记时收集到的张量，另一张单独存**登记那一刻**取到的原始存储。取不到有效的存储持有者就直接失败，不去赌“这块存储应该没事”。

这也解释了走普通 checkpoint 加载路径时，后处理结束后为什么要刷新一次登记：旧内存可以继续保着，但之后当种子给别人读的，必须是最终模型当前真正在用的地址，而不是已经被换掉的旧缓冲区。

## draft 和主模型共享的是地址区间

投机解码的 draft 模型常常和主模型（target）共用一部分权重。draft 加载时会拿到主模型已经登记的那些块，当作“排除区间”。完全落在这些区间里的 draft 张量，就认定主模型已经登记过，不再重复登记。

| 情况 | 工作版怎么处理 | 排查时要确认什么 |
|---|---|---|
| 没有共享 | 照常登记全部可传张量 | 两端清单是否一致 |
| 部分共享 | 跳过完全被主模型块覆盖的张量，只传独立部分 | 共享块和独立块是否真的不重叠 |
| 所有可传权重都共享 | 判定为可以整体复用，直接进入推理模式返回 | 主模型已正确加载；没有不支持的非 NPU 状态 |
| 张量只有一部分落在排除区间里 | 不算完全共享；减掉排除区间后可能找不到完整覆盖而失败 | 不能只凭地址相邻就说能安全传输 |

全部共享时连后处理也跳过：后处理可能原地改动共享的存储，或者给共享的参数重新换数据，那样会把主模型弄坏。这个提前返回发生在申请租约和预处理之前。

共享判断只看地址区间；它不检查主模型权重的数值对不对，也不代表任意 MTP 结构都已经在真实设备上验证过共享。

## 登记失败时，为什么不能直接清空列表

批量注册报错时，未必会告诉调用方“前面哪几项其实已经成功了”。所以工作版在**每一批提交之前**，就把这一批所有尝试登记的逻辑起点记进待清理列表，存储持有者也继续保着。

失败后它会尝试注销这些地址。如果回滚没做干净，就把所有仍说不清状态的地址和持有者都留着，等后面再清理——这时不能当作“什么都没发生”的失败。

批量注销时如果返回“查无此地址”，它不会把整批当成已经干净，而是逐个地址重试，让同一批里其余地址也有机会被注销。单个地址返回查无此地址，才算这一项确实不存在；其他错误一律记为未解决的地址。

这些行为依赖现场传输引擎对错误码的约定。代码采取的是保守保活的策略；CPU 上的测试或读源码，替代不了真实库对“查无此地址”、部分成功和批量中止这几种情况的保证。

## 注销登记和结束引擎各管一层

注销登记只释放当前登记的这批权重，好让回退路径继续用同一个传输引擎。结束引擎则是把整个传输引擎关掉；只有它成功了，才会清掉登记状态和会话编号，并把引擎标成未初始化。

结束引擎默认最多试 10 次：只有返回“还没准备好”才重试，两次之间等 1 秒（最后一次失败后不再等，直接返回）；其他错误或异常直接失败。这两个数是写死在模块里的常量，和[配置页](rfork-config.md)里释放租约的那 3 次是两套独立的设置，不能互相替代。

种子的 HTTP 服务还在被持有时，会话会拒绝直接注销登记，免得元数据服务还在对外公布已经失效的地址。至于停止服务、撤回公布、处理正在进行的远端读取这几步之间是否完全安全，还取决于实际服务端和数据引擎的协议。

## 常见误解

- **“清一下显存缓存，这些权重就释放干净了”**——还被持有者、全局登记表或传输资源拿着的存储，不会因为这一下就变成可释放。
- **“同一个分配块里只能登记一个张量”**——客户端明确支持在一块里写多段逻辑范围；运行时是否支持要现场核实。
- **“把保活列表删掉就能解决显存不够”**——列表里保着的，正是还不能证明可以安全释放的内存；应该先查登记、注销和全局引用，而不是先拆掉保护。

## 对照源码

### 会报什么错

- 逻辑范围找不到完整覆盖的支撑块：打印 `tensor range ... is not fully covered by a registration block` 后失败，不会把越界范围提交给传输引擎。[C4]
- 取不到有效的 storage owner：直接失败。[C2]
- 看到 `registration rollback is incomplete`：说明注册失败后的回滚没做完，要同时检查后面的 `fallback aborted` 和显存状态，不能当作零副作用失败。
- 批量注销返回 `kNotFound`：逐地址重试；单地址 `kNotFound` 视为该项已不存在，其他错误留在 unresolved addresses。[C5]
- `finalize_transfer_engine` 只在返回 `kNotReady` 时重试，其他错误或异常直接失败。[C6]
- seed HTTP 服务仍被持有时，session 拒绝直接注销 MR。[C9]

### 开销和什么时候别开

- 每批注册最多 4096 项，是模块常量，不可配置。[C10]
- finalize 最多尝试 10 次、间隔 1 秒，也是模块常量；和 lease release 的三次重试是两个独立设置。
- 张量范围索引靠排序加前缀最大终点，避免逐张量扫描全部分配块。[C1]
- 同一 backing allocation 上多段逻辑范围的 Ex 注册，是客户端约定；现场 YuanRong 版本是否支持、`kNotFound` / 部分成功 / 批量中止的语义，都要在真实 NPU 和实际库上验证，源码阅读与 CPU 测试不能替代。
- W 被 `W.data = 新张量` 替换后旧地址仍在 TransferEngine 注册表里、只保 W 不能保旧 storage，是由保活实现推出的结论。[D]

### 源码位置

以下均为工作版 `rfork@3284850b`，路径前缀 `vllm_ascend/model_loader/rfork/`：

- `transfer_backend.py#L40-L118`：遍历 `torch.npu.memory.memory_snapshot()` 的 `active_allocated` 块，找与可传张量相交的块并排序合并；张量范围索引。
- `transfer_backend.py#L155-L175`：`_registered_transferable_tensors` 保留 Tensor 列表，`_registered_transferable_storages` 保留注册时取得的 `untyped_storage()`（必要时退回 `storage()`）。
- `transfer_backend.py#L271-L354`：按 `exclude_blocks` 排除已由 target 覆盖的 draft 张量。
- `transfer_backend.py#L356-L461`：减去排除块、检查完整覆盖、合并逻辑范围，构造 `MemoryRegistration`（逻辑起点、逻辑长度、支撑起点、支撑长度），调用 `batch_register_memory_ex`；提交前记录待清理地址，失败回滚。
- `transfer_backend.py#L463-L561`：`unregister_memory_region`，`kNotFound` 逐地址重试。
- `transfer_backend.py#L563-L614`：`finalize_transfer_engine`，成功才清登记状态与 session ID、把 initialized 设为 False。
- `rfork_loader.py#L492-L501`：draft 加载器从 target session 取 `registered_weight_blocks` 作为 `exclude_blocks`。
- `rfork_loader.py#L584-L591`：`can_reuse_shared_weights` 为真时直接 eval 返回，跳过后处理，发生在申请 lease 和预处理之前。
- `session.py#L255-L286`：seed HTTP 服务仍被持有时拒绝注销 MR。
- `transfer_backend.py#L33-L37`：批量上限、finalize 重试次数与间隔等模块常量。
