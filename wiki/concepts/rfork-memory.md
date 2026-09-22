---
id: rfork-memory
title: RFork 内存：地址、底层存储与 main/draft 共享
type: feature
summary: 解释逻辑张量范围与分配块的区别、四元组 Ex 注册、Tensor 和原 storage 的保活、共享 draft 排除，以及失败注销为何必须保留状态。
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
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 一句话

**登记一个地址，并不会让地址背后的权重自动活到传输结束。** 工作版同时保留 Tensor 和它注册时的原 storage，计算逻辑范围与支撑分配块，只有确认注销或引擎 finalize 成功后才释放这些引用。[C2][C4]

```wiki-diagram
file: rfork-memory
```

## 先拿一小段权重算明白，而不是硬套 KV block

那条请求的模型加载时会产生很多权重张量，37 token 与 128-token KV block 不能拿来计算本页的 MR（memory region，注册给传输引擎的一段地址范围，见[术语页](rfork-terms.md)）。这里用独立教学例子说明地址关系：[A]

分配器给出一块 `[1000, 2024)` 的内存；其中权重 W 从 1128 开始，64 个 float16 元素，各 2 字节。因此 W 的逻辑范围是 `[1128, 1256)`，共 128 字节。注册描述可表示为 `(1128, 128, 1000, 1024)`：前两个数是逻辑范围，后两个数是其支撑范围。[A][D]

这些数字只演示半开区间，1000 不是推荐真实地址。半开区间包含起点、不包含终点，两个相邻范围可在同一端点衔接而不重复一个字节。

## 先找支撑块，再登记逻辑子范围

工作版遍历 `torch.npu.memory.memory_snapshot()` 的 `active_allocated` 块，找出与可传张量范围相交的块，排序并合并重叠或相邻块。张量范围索引用排序与前缀最大终点，避免逐张量扫描所有分配块。[C1]

随后减去 target 已登记的排除块，检查每个逻辑张量范围是否完整落在剩余支撑块内。找不到完整覆盖，就打印 `tensor range ... is not fully covered by a registration block` 并失败；它不会把越界范围强行提交给传输引擎。[C4]

同一个支撑范围中的相交/相邻逻辑范围可以合并；有空洞的逻辑范围可以保留为不同注册项。每个 `MemoryRegistration` 接收四个量：逻辑起点、逻辑长度、支撑起点、支撑长度，调用的是 `batch_register_memory_ex`，每批最多 4096 项——这个批量上限是模块常量，不是可配置项。[C4][C10]

此处是客户端代码的调用约定。现场 YuanRong 版本对共享 backing allocation 的多个逻辑子范围是否支持，仍要用实际 Ex API 与 NPU 验证，不能从老的二参数注册 API 推定——老接口一次只收（地址、长度）两个数，根本描述不了“这段逻辑范围坐落在哪个分配块里”，因此它能不能注册，说明不了 Ex 接口会怎样处理同块多范围。

## 为什么只保留 model 或 Tensor 还会出问题

考虑已登记 W 的地址，然后后处理执行 `W.data = 新张量`：Python 中 W 还活着，但它指向了新 storage。旧地址却仍留在 TransferEngine 的注册表里。只保住 W，不能保证旧 storage 没被分配器回收复用。[C2][D]

因此 `_registered_transferable_tensors` 保留采集到的 Tensor 列表，`_registered_transferable_storages` 另外保留注册时取得的 `untyped_storage()`（必要时退回 `storage()`）。取不到有效 owner 就失败，不猜测存储一定安全。[C2][C4]

这也解释了 checkpoint 路径后处理后为什么刷新注册：可以继续保住旧内存，但后续 seed 应暴露的是最终模型当前使用的地址，而不是已经被替换的旧缓冲区。

## draft 和 target 共享的是区间，不只是同一个名字

draft 加载器从 target session 取 `registered_weight_blocks` 作为 `exclude_blocks`。完全落在这些范围内的 draft 张量被认定为已由 target 覆盖，不再重复注册。[C7][C3]

| 情况 | 工作版处理 | 排查时要确认什么 |
|---|---|---|
| 没有共享 | 常规登记全部可传张量 | 两端 manifest 是否一致 |
| 部分共享 | 跳过完全被 target 块覆盖的张量，传独立部分 | 共享块与独立块是否真正不重叠 |
| 所有可传权重都共享 | `can_reuse_shared_weights` 为真，直接 eval 返回 | target 已正确加载；没有不支持的非 NPU 状态 |
| 张量只有一部分与排除块重叠 | 它不被当作完全共享；减去排除块后可能无法完整覆盖 | 不能只凭地址相邻就声称能够安全传输 |

全共享路径连后处理也跳过，因为后处理可能原地修改共享 storage，或者给共享 Parameter 重新绑定 `.data`，从而破坏 target。这个提前返回发生在申请 lease 和预处理之前。[C8]

共享判断是地址区间层面的判断；它不验证主模型权重数值正确，也不意味着任意 MTP 架构都已在真实设备上通过共享验证。[D]

## 注册失败可能已产生部分副作用，不能直接清空列表

每一批提交前，工作版就把**所有尝试注册的逻辑起点**记入待清理列表，并保留 storage owners。因为 `batch_register_memory_ex` 报错未必告诉调用者“前面哪几个注册成功了”。[C4]

失败后尝试注销；若回滚不完整，就保留全部仍不确定的地址和所有者，等待后续清理。若看到 `registration rollback is incomplete`，应同时检查后续 `fallback aborted` 与显存状态，不能当作零副作用失败。

注销批次若返回 `kNotFound`，实现不会直接把整批当成干净：它逐地址重试，让批次中其余地址也得到注销机会。单地址的 not-found 才被视为该项已不存在；其他错误留下 unresolved addresses。[C5]

上述语义依赖现场 TransferEngine 的错误码契约。代码采取了保守保活策略，CPU 测试或源码阅读不能替代实际库对 `kNotFound`、部分成功与批量中止行为的保证。

## finalize 和 unregister 各管不同层级

`unregister_memory_region` 释放当前登记的权重，供 fallback 重用同一个 TransferEngine。`finalize_transfer_engine` 结束整个引擎；成功才清掉登记状态和 session ID，并把 initialized 设为 False。[C5][C6]

finalize 默认最多尝试 10 次；只有返回 `kNotReady` 才重试，两次尝试之间等 1 秒（最后一次失败后不再等待就返回），其他错误或异常直接失败。这两个数同样是模块常量。这个预算与[配置页](rfork-config.md)里那三次 lease release 是两个独立设置，不能互相替代。[C6][C10]

session 在 seed HTTP 服务仍被持有时会拒绝直接注销 MR，防止元数据服务还在暴露已经无效的地址。停止服务、撤销广告、在途远端读取之间的完整生产安全性，还取决于实际服务端与数据引擎的协议。[C9]

## 常见误解

- **“`empty_cache()` 会把这些权重清干净”**——仍有 owner、全局注册表或传输资源持有的存储，不会因这个调用自动变成可释放状态。
- **“同一 allocation 只允许一个张量”**——客户端明确支持多逻辑范围的 Ex 注册描述；运行时能力必须现场核实。
- **“删除保活列表就能解决 OOM”**——列表保留的是尚不能证明安全释放的内存；应先查注册、注销与全局引用，不能先解除保护。
