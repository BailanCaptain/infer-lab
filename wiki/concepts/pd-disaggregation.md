---
id: pd-disaggregation
title: PD 分离：计算阶段与历史状态的交接
type: feature
summary: 从 prefill 和 decode 的不同工作形态解释分离部署，跟踪目的块分配、状态边界、异步传输和完成后的恢复与释放。
aliases: [PD 分离, PD Disaggregation, Prefill/Decode 分离, disaggregated prefill, 分离部署, P 节点, D 节点, kv_role, MooncakeConnectorV1,
  EPD 分离, EPD Disaggregation, Disaggregated-encoder, 分离式编码器, 编码器分离, E 实例, E 节点,
  ec_transfer_config, ec_role, ECConnector, ECExampleConnector, encoder cache, EC 连接器]
chapters: ["18"]
order: 10
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1666-L1749
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1751-L1820
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1822-L1878
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L804-L824
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2236-L2248
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2176-L2186
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L790-L806
  - vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L191-L238
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/epd_disaggregation.md#L3-L33
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/epd_disaggregation.md#L39-L79
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2018-L2025
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5133-L5134
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L45-L57
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L90-L133
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L187-L200
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1285-L1296
  - vllm@0fc695fc:vllm/model_executor/models/interfaces.py#L216-L246
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L671-L703
  - vllm-ascend@db701c1f:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L89-L124
  - vllm-ascend@db701c1f:examples/disaggregated_encoder/disagg_epd_proxy.py#L402-L430
verified: []
evidence: "C"
relations:
  - {to: prefill, kind: builds-on, note: 理解 prefill 和逐步生成的计算}
  - {to: kv-cache, kind: builds-on, note: 理解注意力历史与递推状态}
  - {to: block-table, kind: builds-on, note: 理解源块与目的块是不同物理分配}
  - {to: collective-communication, kind: builds-on, note: 区分状态搬运与集合归约}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 为什么把两个阶段放到不同设备组

[Prefill](prefill.md)通常一次处理多行新输入，生成阶段则为活跃请求继续计算少量新位置。两者都执行模型，但批量、历史读取、调度目标和资源压力可能不同。**PD 分离**把 prefill 放在 P 执行组、持续生成放在 D 执行组，让两边分别配置资源和调度策略。

这种拆分增加了一次关键交接：D 需要拿到能继续推理的历史状态。收益取决于分离后减少的相互干扰、资源利用变化与新增传输/排队开销，不能仅凭“prefill 偏计算、decode 偏访存”的概括决定部署。

[GLM 官方双机主线](../sources/glm-5-3-flash-baseline.md)是 TP/DP/EP 的混部实例，两台机器并不是一台 P、一台 D。本页解释分离机制与固定源码路径，没有把它当作已经验证的 GLM 部署组合。

## 状态交接包含分配、传输和确认

```wiki-diagram
file: pd-disaggregation
```

完整交接需要解决六件事：

1. **确定计算边界**：P 输出的状态对应输入的哪个位置，D 从哪个位置继续。
2. **保留来源状态**：P 返回远端块及位置元数据时，源块仍须有效。[C4]
3. **分配目的块**：D 使用自己的块池分配目的地址，并生成接收元数据；它不能直接把 P 的物理块编号当作本地编号。[C3]
4. **搬运相应状态组**：连接器按模型状态类型、布局及并行切分组织传输。
5. **等待接收完成**：未到位的请求处于等待远端状态的阶段，不提前读取目的缓冲。[C5]
6. **恢复与释放**：D 在可用状态上继续计算；P 根据发送完成信息释放为传输保留的块。[C6]

“请求已结束”与“用于远端读取的块可回收”是不同事件。只画 P→D 一根数据箭头，会遗漏这个生命周期问题。

## 递推状态必须与继续位置一致

普通注意力可以保存各历史位置的 K/V；上游在 prompt 完整命中时仍预留最后一个输入位置重新计算，以得到后续所需输出。[C7] KDA 一类递推状态则描述一段前缀处理后的结果，不具备任意回退到前一位置的通用能力。

固定 Mooncake V1 已识别 Mamba 状态组与压缩组，并使用相应的截断条件。[C1] 在 `need_truncate` 成立、原输入长度 N>1 的路径中，P 计算前 N−1 个输入，D 的远端命中也记为 N−1；D 再处理原输入最后一个 token。[C2]

```wiki-diagram
file: pd-state-boundary
```

用 N=4 的教学输入 `[p₀,p₁,p₂,p₃]` 表示：P 移交处理到 p₂ 的状态 S₃，D 用 S₃ 处理 p₃ 得到 S₄，并继续形成输出。[A] S₃ 表示处理了三个输入位置，不是“第三层”的状态。

这个例子解释状态边界，不能统一写成“P 已计算 N，D 必须额外重算一次，所以总是多一份工作”。是否截断、重新计算哪些位置，还与连接器、状态类型及恢复路径有关。

## 混合模型传输的不只是同形 K/V

[GLM 的历史状态](kv-cache.md)包含稀疏 MLA 主缓存、相关索引状态，以及 KDA 的递推和卷积状态。它们的形状、增长方式与需要保留的边界不同。固定连接器对注意力块可按位置/窗口裁剪，而对 Mamba 状态块使用另一种保留方式。[C1]

因此状态传输方案至少要匹配模型配置与权重版本、层及缓存组身份、dtype/布局、源和目的并行切分、请求已完成的位置。仅仅两边都叫“GLM”或拥有同样数量的块，并不足以证明状态可互用。

这些源码包含混合状态的处理机制，但不能单独证明 GLM 的完整 PD 组合已验证。KDA、稀疏状态、量化、MTP、前缀缓存和图模式的组合仍需一起核对。

## 代理请求和正常生成的区别

固定示例代理发给 P 的内部请求设置了 `max_tokens=1`、`min_tokens=1`，并附带传输控制信息。[C8] 它服务于阶段交接，不是用户最终只要求生成一个 token。

上游 logits 处理会在未满足 `min_tokens` 时屏蔽相关停止 token。[C9] 因此判断 P 阶段何时结束，需要看请求参数、采样约束、结束原因与连接器回调，不能只看某个停止检查函数就推断默认 EOS 故障。

## 成本与失败恢复

P 的计算、源状态等待、D 的目的分配与网络接收可能重叠，也可能互相等待。实际传输还可按 rank、缓存组或层拆成多个任务；“一次状态迁移”不表示一条消息或一次设备拷贝。

接收失败时，需要让请求重新进入一致的计算进度，而不是继续读取未完成状态。[C5] 源块延迟释放也可能暂时减少 P 的可用容量。后续的 [Mooncake 连接器](mooncake-connector.md)把这些控制信息与数据搬运对应到框架职责。

无设备阅读时，先跟踪一个请求在 P、网络、D 的状态归属；部署评估再分别测首 token 延迟、生成间隔、吞吐、传输字节与保留块时间。本页不提供未实测的加速比。

## EPD：再把编码器分出去（原 epd-disaggregation 页）

以下事实由原 `epd-disaggregation` 页并入，2026-09-27 只作搬运，未重写文风。

带图像的输入要先由视觉编码器把媒体转换成语言模型可用的表示。**E（Encoder）分离**把这一步放到独立执行资源上，再把编码结果交给后续语言推理。[S10] EC（Encoder Cache）保存的是这类编码结果，KV 或 KDA 历史则在语言模型层的计算中形成；两者阶段、形状、身份与复用条件都不同，传输图像 embedding 不等于迁移了语言模型历史。

两种形态要分清：**E+PD** 只把媒体编码分出去，prefill 与 decode 仍在同一执行组；**E+P+D** 在此基础上再分离 P、D，因此还要解决语言模型状态迁移。[S11] 第一种形态不依赖远程 P→D 的 KV 传输，不能因为某模型的 PD 组合未验证就判定所有编码器分离形态都不可用。固定代理按流程调用 E，再视配置决定是否调用独立 P，最后进入生成。[C21] E、P、D 是职责名称，不保证每类恰好一台机器或一个进程。

固定实现怎么跳过重复计算：Ascend Runner 判断自己是 EC producer 时只执行多模态编码并返回，相应的 KV cache spec 为空。[C12][C13] 上游调度器遇到外部编码缓存命中时不再扣减本地 encoder 计算预算。[C17] 省下的是重复编码工作，输入长度、目的表示内存和语言模型计算仍然存在。GLM 模型的构造同时标记视觉组件与语言模型组件。[C19] 本站主线走纯文本路径，因此不需要先经过 E。

「执行了什么」和「加载了什么」要分开：E 不执行语言模型前向，不等于启动时从未分配语言模型权重。固定示例脚本没有显式启用 encoder-only 模式。[C20] 而上游 `mm_encoder_only` 配合模型组件标记，可以跳过语言模型组件的初始化。[C18] 所以「E 必须再加载一份完整语言模型」不是 EPD 的机制要求，实际容量取决于模型是否接入相应标记、启动选项、加载器和运行版本。[C19]

`ECExampleConnector` 只是用于调试的磁盘实现：它把编码张量保存到共享位置，消费者再读到目标设备，缓存文件按媒体 hash 组织，而不是以请求 ID 作唯一缓存键。[C14][C15][C16] 两台机器上目录名字相同不表示内容自动共享，复用同一结果还需要共享存储语义、兼容的编码器与预处理配置以及正确的缓存身份。其他连接器可以采用不同传输与存储方式。

收益与新增开销：独立 E 可以按媒体负载扩缩，让文本请求与视觉编码资源分别规划，也为编码结果复用提供入口。[S10] 代价包括编码排队、结果存储和传输、消费者加载、故障恢复及跨服务身份管理；是否值得分离要看媒体比例、编码耗时、结果大小和复用率。
