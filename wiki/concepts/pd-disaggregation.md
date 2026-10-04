---
id: pd-disaggregation
title: PD 分离：prefill 与 decode 分给两组实例时怎样交接历史
type: feature
summary: 把一条请求的 prefill 与 decode 交给 P、D 两套实例，中间由连接器交接历史状态。沿 Mooncake V1 看交棒、D 拉取、完成信号与押块，讲清 GLM 这类混合模型为何让 P 少算最后一个位置；本站双机主线没有开 PD，只作变体对照。
aliases: [PD 分离, PD Disaggregation, Prefill/Decode 分离, Prefill-decode Disaggregation, disaggregated prefill, 分离部署, P 节点, D 节点, P 实例, D 实例,
  kv_role, kv_producer, kv_consumer, MooncakeConnectorV1,
  EPD 分离, EPD Disaggregation, Disaggregated-encoder, 分离式编码器, 编码器分离, E 实例, E 节点,
  ec_transfer_config, ec_role, ECConnector, ECExampleConnector, encoder cache, EC 连接器]
chapters: ["18"]
order: 10
sources:
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L3-L13
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L27-L55
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L64-L105
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L29-L45
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L788-L806
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L925-L927
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1666-L1749
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1751-L1849
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L798-L824
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2039-L2057
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L774-L990
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L245-L390
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L705-L756
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L166-L243
  - vllm@0fc695fc:vllm/envs.py#L1684-L1686
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2221-L2248
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L66-L73
  - vllm@0fc695fc:vllm/config/kv_transfer.py#L11-L13
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2424-L2492
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L46-L51
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1974-L2083
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1111-L1130
  - vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L191-L238
  - vllm@0fc695fc:vllm/sampling_params.py#L593-L614
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87
  - vllm-ascend@db701c1f:docs/source/tutorials/features/pd_disaggregation_mooncake_multi_node.md#L227-L239
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L1101-L1109
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L107
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L48
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
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L210
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2585-L2616
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L96-L102
  - vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L46-L125
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598
  - vllm@0fc695fc:vllm/v1/sample/sampler.py#L96-L100
  - vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L169-L176
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L228-L261
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/pull_scheduler.py#L610-L618
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L84-L140
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: prefill, kind: builds-on, note: P 实例做的就是整段提示词的 prefill；混合步为什么拖慢 decode 也在那页}
  - {to: kv-cache, kind: builds-on, note: 交接的是 GLM 的几类历史状态，各自多大、怎样分组见该页}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: 本页对照的部署：两台机器是两个 DP 执行组，拆成一 P 一 D 时的换算也在那页}
  - {to: block-table, kind: builds-on, note: 源块与目的块各属自己的块池，块号怎样对应显存见该页}
  - {to: chunked-prefill, kind: alternative-to, note: 不拆实例，把长提示词切块混进 decode 步，是限制 prefill 干扰的另一条路}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 一条请求的 prefill 和 decode，为什么要交给两组机器？

**PD 分离（Prefill/Decode disaggregation）把一条请求的两个阶段交给两套独立启动的推理实例：P 实例只做 prefill，把整段提示词一次算完、留下历史状态；D 实例接过这份状态，一步一个 token 往下生成。** 两边各有自己的调度器和 KV cache 块池，中间多出一次跨实例的「历史状态交接」。

先把这句话里的词说清：

- **prefill 与 decode。** [Prefill](prefill.md) 是请求的第一步：把提示词里的所有 token 放进同一次前向，算出每一层要留下的历史，并采样出第一个输出 token。decode 是之后的每一步：只为最新确定的 token 算一次，读前面留下的历史；开了 [MTP](speculative-decoding.md)（用一个小的草稿层先猜后面几个 token）时，这一步还要带上这几个草稿 token 一起验证。
- **历史状态。** 就是 [KV cache](kv-cache.md) 里存的东西：普通注意力层为每个位置存一份 K、V；GLM 里还有一种叫 KDA 的线性注意力层，每条请求只存一份固定大小的「算到这里」的状态。
- **块和块池。** KV cache 不是按请求整段分配的，而是切成一块块、每块装固定个数位置的小段；一个实例能分出的全部块叫它的块池，块在池里的编号叫块号。
- **调度器。** 每一步决定哪些请求各算几个 token，并从块池里给它们分块、收块。
- **实例。** 一套独立启动的 vLLM 服务，有自己的入口、调度器和块池。P、D 是职责名：一个实例可以跨多台机器，一台机器上也可以起多个实例。

```wiki-diagram
file: pd-disaggregation-intuition
```

上半张是混部，数是示意：生成中的请求 A、B 本来每步各算 1 个位置；来了一条 4 个 token 的提示词，同一组机器的下一步就变成 1 + 1 + 4 = 6 个位置，A、B 要等这 6 个位置一起算完，才拿到各自的下一个 token。下半张是 PD 分离：P 把这 4 个 token 算成历史状态交出去，D 用自己的块接住，之后只跑 decode。代价就是中间那根紫色箭头：状态搬过去之前，这条请求在 D 上只能等。

**本站主线没有开 PD 分离，本页讲的是部署变体。** [官方双机部署](glm-5-3-flash-two-node.md#部署前提)的两台机器是两个 DP 执行组。DP 执行组指一套各自接请求、各自调度的执行单元：每台各自接一部分请求，各自既做 prefill 也做 decode。启动配置里没有 KV 传输这一项，也就没有 P、D 之分。放到 GLM 双机会怎样，集中在后面「放到 GLM 双机」一节；那里的数字都是主线混部的事实或配置换算，不是 PD 的实测效果，本页也不给任何 PD 加速比。

## 为什么要拆，拆开要付什么？

**拆的理由是让 decode 步不再被 prefill 打断，并让两个阶段各自挑并行方式和实例数；代价是多一次状态交接、两边的块池各押一段时间，以及更多出错的地方。**

vllm-ascend 的设计文档给了两条动机。一是两边可以分别调整并行策略和实例数：[DP](data-parallel.md) 把请求分给几组各自调度的机器，[TP](tensor-parallel.md) 把同一层的矩阵切给几张卡合算，[EP](expert-parallel.md) 把 MoE 层的专家分到几张卡上；P、D 可以各选各的组合，按首 token 延迟（TTFT）和每个输出 token 的间隔（TPOT）分别调优。二是稳住 TPOT：混部时 prefill 会插进正在 decode 的批里，拖慢这些请求出下一个 token。混部常用 chunked prefill 缓解这一点：把太长的提示词切成几段，每步只拿一段和 decode 请求拼在一起算。但分段多大合适很难挑，拆开以后就不用再挑。

还是用上面的示意数看「拖慢」落在哪里。A、B 两条请求每步只要算 2 个位置；混进 4 个 token 的提示词后，这一步变成 6 个位置，A、B 出下一个 token 的这一步变重了。提示词越长，这一步越重；chunked prefill 能把它限制在一段的大小，但 A、B 每一步仍在和别人的提示词共用一步。PD 分离后，D 上每一步只剩 A、B 这样的 2 个位置，提示词那 4 个位置全在 P 上算。

拆开要付的代价集中在交接上：

- **多一次搬运。** D 要拿到 P 算出的历史状态，这是一次点对点的数据传输，不是多张卡一起参与的集合通信；传输期间同一份状态在 P、D 的显存里各占一份。
- **两边都要押块。** P 上存着这条请求历史的块（源块）要押到 D 报告收完才放；D 在状态到位之前，就要先从自己的块池里分好接收用的块（目的块）。
- **多出失败方式。** 传输会失败、会超时，两边的并行切分和状态布局必须对得上。
- **多一层转发。** 前面要有一个代理，把请求先发给 P、再发给 D，并把 P 交回的信息转给 D。

「prefill 吃算力、decode 吃显存带宽」只说明两个阶段的负载形态不同，不足以决定要不要拆。值不值得拆，要看拆开后减少的干扰，能不能抵过交接、押块和每个实例规模变小的代价。

下表把 PD 分离和几种相邻做法放在一起，看各自解决什么、prefill 和 decode 还在不在同一步里算。

| 做法 | 解决什么 | prefill 和 decode 还在同一步吗 |
| --- | --- | --- |
| 混部 + chunked prefill（本站主线） | 长提示词分几步算，每步不超出预算 | 在，只是每步混进的量受限 |
| 两个 DP 执行组（本站主线） | 两组各接一部分请求 | 在，两组各自混部 |
| PD 分离（本页） | 两个阶段放进不同实例 | 不在，D 上只剩 decode |
| EPD 分离（本页后文） | 再把图像编码拆出去 | 取决于 P、D 是否也拆开 |

## 状态交接怎样一步步完成？

**以设计文档里作示例的 Mooncake V1 连接器为例：代理先让 P 只生成 1 个 token、按「写到长度上限」结束，P 借这个结束时机打包块号和地址并押住块；D 分好自己的块后，由后台线程按地址把 P 的块读过来；读完发一个完成信号，D 接着算，P 放块。** 连接器（connector）是 vLLM 里负责跨实例搬运 KV cache 的插件，启动时在配置里指定。同一个连接器类在调度器进程和 worker 进程里各有一份，前者决定这条请求要搬哪些块，后者真正去搬，细节见 [Mooncake 连接器](mooncake-connector.md)。

```wiki-diagram
file: pd-disaggregation
```

1. **代理发给 P。** 代理（proxy）是 PD 部署最前面的转发服务。它把用户请求复制一份发给 P，标明「这条要交给远端做 decode」，并把最多、最少生成的 token 数都改成 1。这是交接用的设定，不是用户只要 1 个 token。
2. **P 做 prefill，按长度上限结束。** P 算完提示词（混合模型会少算最后一个位置，见下一节）、采样出 1 个 token，这条请求因为写到了长度上限而结束。连接器只在这种结束方式下交棒：它挑出装着提示词的那些块（MTP 为草稿多留的块不传），把块号、P 的地址和握手端口打包交还给代理，并告诉 P 的调度器「这些块先别放」。
3. **代理转给 D，D 先分块、不计算。** D 的调度器看到「状态在远端已经算好」，就用自己的块池为它分好目的块，把请求挂进「等待远端状态」。这一步它为这条请求排 0 个 token；如果整步都没有别的请求要算，worker 这一步只跑连接器的收发，不跑模型。
4. **D 拉，不是 P 推。** D 的后台线程拿着 P 的块号和地址，一次批量读回各层对应的块。它能直接读对面的显存，是因为两边启动时都把存 KV cache 的那段显存登记给了传输引擎。P 那边负责「发送」的线程其实不发数据，只回答 D 要的元数据，并记下「对面收完了」。
5. **D 通知 P 收完。** 读完之后，D 给 P 发完成信号；读失败也照样发，免得 P 的块一直押着。P 收到后才真正放掉源块；一直等不到信号的情形见后面「抢占、失败和超时」。
6. **D 上的请求回到队列，接着算。** 状态到位后，请求回到等待队列；下一次被排上时，先算完还差的提示词位置、采样首 token，然后进入 decode 循环。

用一个示意的小例子把块号走一遍：一条 4 个 token 的提示词，记作 p₀–p₃；这里假设一块只装 2 个位置，模型是纯注意力模型（混合模型的差别见下一节）。块号 7、12、3、5 都是编的。

| 位置 | 在 P 上存在 | D 分到的目的块 | 第 4 步读的方向 |
| --- | --- | --- | --- |
| p₀、p₁ | P 的第 7 块 | D 的第 3 块 | P#7 → D#3 |
| p₂、p₃ | P 的第 12 块 | D 的第 5 块 | P#12 → D#5 |

第 2 步交还给代理的是 P 的块号 [7, 12] 和 P 的显存地址；第 3 步 D 从自己的块池分到 [3, 5]；第 4 步后台线程按位置把 P#7 的内容读进 D#3、P#12 读进 D#5；第 5 步 P 收到完成信号，才把 7 号和 12 号块放回自己的块池。**块号是各自块池里的编号**，P 的第 7 块和 D 的第 7 块是两块不同的显存，D 不能直接拿 P 的编号当本地编号；块号怎样对应到显存，见[块表](block-table.md)。

**「请求结束」和「块可以回收」是两件事。** P 上的请求在第 2 步就结束了，块却押到第 5 步；D 上的请求在第 3 步就占了块，要到第 6 步才开始算。等的只是这一条请求：两边的主循环照常跑别的请求，调度器不会因此停下。

## 交接点停在哪个位置？

**交接点取决于模型要保存哪类状态：纯注意力模型由 P 算满整段提示词，D 退回 1 格、重算最后一个位置；带递推状态的混合模型由 P 故意少算最后 1 个位置，D 从那里接着算。两种情形都由 D 算出首 token。**

```wiki-diagram
file: pd-state-boundary
```

图里用的是 [R1](one-request.md#示例请求-r1-与官方双机部署)：本站贯穿的示例请求，提示词也是 4 个 token，记作 p₀–p₃。

**纯注意力模型：P 算满，D 退回 1 格。** 这类模型每层只存每个位置的 K、V，任何一格都能单独读写。P 把 4 个位置全算完，交出 4 格 K/V。D 收到后，提示词整段都已命中，但采样需要最后一个位置的输出，K/V 里没有这个输出；vLLM 的调度器遇到「整段命中」，就把已算位置退回 1 格，让 D 重算 p₃。P 当时采出的那个 token 会随交接信息带过去，但 vLLM 和 vllm-ascend 里都没有读它的地方。所以 p₃ 这一格实际算了两次，这条请求的前向次数比混部多一次。

**混合模型：P 少算最后 1 个位置。** KDA 这类层存的是「处理完前面所有位置之后」的一份递推状态，它把历史压成固定大小，没法把最后一个 token 的影响再减掉。如果 P 算满 4 个位置，D 就拿不到「处理完 3 个位置」的状态，也就没法重算 p₃ 的输出。所以连接器发现模型带这类状态时，在 P 上把提示词的最后一个 token 去掉：P 只算 p₀–p₂，交出状态 S₃（下标表示处理过 3 个位置，不是第 3 层）；D 把远端命中记为 3 个位置，自己用 p₃ 在 S₃ 上算出 S₄ 并采样首 token。这样没有哪一格被算两次；P 仍会采样 1 个 token 以便按长度上限结束，这个 token 同样没人用。P 上的截断只做一次：请求在 P 上被抢占、重新排队时，不会再截第二次。

## 抢占、失败和超时怎么处理？

**D 上的远端状态只拉一次：请求在 D 上被抢占后，只能在 D 本地从头重算。传输失败时，vLLM 默认让这条请求报错结束，换成「重算」策略才会重新排队。P 押着的块最多押到超时。**

抢占是块池不够用时调度器的做法：从正在跑的请求里踢出最后进来的那条，收回它的全部块，已算位置清零，等它重新排上时整段重算。PD 分离不会让这件事消失，只是把它挪到了 D 上：连接器在第一次为这条请求分好目的块后，就把「状态在远端」这个标记关掉，P 的源块也早已放掉。D 上被抢占的请求回来时拿不到远端状态，只能在 D 上自己做一遍 prefill，而这正是 PD 想从 D 上赶走的工作。

传输失败时，D 把没读成的目的块标成无效，并照样通知 P 放块。vLLM 对这种情况有两种策略：默认是「失败」，这条请求带着错误结束；换成「重算」，调度器保留已经成功读到的部分，其余位置在 D 上重新算。

P 这边，交接后押着的块一直占着 P 的块池，直到 D 报告收完；D 始终不报告时，P 在超时（默认 480 秒）后强制释放，并打一条错误日志。这段时间里，P 能接的新请求相应变少。

一次交接也不等于一条消息或一次拷贝。D 的读取按 P 的各个 rank 和各个缓存组拆开，每组再列出各层的地址；P 的计算、源块等待、D 的目的分配和网络读取之间，既会重叠，也会互相等待。没有设备时，先拿一条请求跟一遍：它的状态此刻在 P 上、在网络上还是在 D 上，哪边的块还押着。评估一套 PD 部署，要分别看首 token 延迟、生成间隔、吞吐、每次交接的字节数和源块押住的时间，本站没有这些实测数。

## 带图像的请求：再把编码器分出去（EPD）

**E（Encoder）分离把图像等媒体的编码放到独立的资源上，再把编码结果交给后面的语言模型推理。** 带图像的输入要先由视觉编码器转成语言模型能用的表示。EC（Encoder Cache）保存的就是这类编码结果；KV cache 和 KDA 状态则是语言模型各层计算时才形成的历史。两者的阶段、形状、身份与复用条件都不同，传了图像 embedding 不等于迁移了语言模型的历史。

两种形态要分清。**E+PD** 只把媒体编码分出去，prefill 与 decode 仍在同一个实例；**E+P+D** 在此基础上再分离 P、D，因此还要解决语言模型状态的交接。第一种不依赖 P→D 的 KV 传输，不能因为某个模型的 PD 组合没有实测，就判定所有编码器分离形态都不能用。示例代理先调用 E，再视配置决定是否调用独立的 P，最后进入生成。E、P、D 同样是职责名，不保证每类恰好一台机器或一个进程。

编码结果怎样避免重复计算：Ascend 的 model runner 判断自己是 EC 生产者时，只执行多模态编码就返回，相应的 KV cache 规格为空。上游调度器遇到外部编码缓存命中时，不再扣减本地的编码计算预算。省下的是重复的编码工作；输入长度、目的表示占的显存和语言模型的计算都还在。GLM 的模型构造同时标记了视觉组件与语言模型组件；本站主线走纯文本路径，不需要先经过 E。

「执行了什么」和「加载了什么」要分开：E 不跑语言模型前向，不等于启动时没有分配语言模型权重。示例脚本没有显式打开只跑编码器的模式；上游的这个模式配合模型组件标记，可以跳过语言模型组件的初始化。所以「E 必须再加载一份完整语言模型」不是 EPD 的机制要求，实际占多少显存，取决于模型是否接入相应标记、启动选项、加载器和运行版本。

ECExampleConnector 只是调试用的磁盘实现：它把编码张量存到共享位置，消费者再读到自己的设备上；缓存文件按媒体内容的 hash 组织，不以请求 ID 作唯一键。两台机器上目录同名，不表示内容自动共享；复用同一份结果，还需要共享存储、兼容的编码器与预处理配置，以及正确的缓存身份。其他连接器可以用别的传输与存储方式。

独立的 E 可以按媒体负载扩缩，让文本请求与视觉编码分开规划资源，也为编码结果复用提供了入口；代价是编码排队、结果的存储与传输、消费者加载、故障恢复以及跨服务的身份管理。值不值得分离，要看媒体请求的比例、编码耗时、结果大小和复用率。

## 放到 GLM 双机：拆开会怎样？

**本站主线是混部，这一节用主线的事实和配置换算，回答四件事：prefill 在这套部署里具体拖慢了什么；GLM 要一起交接哪些状态；钉住版本的连接器在 GLM 上有什么问题；把这两台机器直接拆成一 P 一 D 会怎样。** 这里没有 PD 实测数。

### 混部时，prefill 在这套部署里拖慢了什么

**在这套部署里，prefill 插进来的代价是：这一步不能回放录好的 decode 图；提示词一长，两台机器的 MoE 通信还会从快路径换到慢路径。**

先说两个词。**decode 图（graph mode）** 是启动时把固定大小的一步前向录下来，之后遇到同样大小的纯 decode 步就直接回放，省掉逐个下发算子的开销；不回放、逐个下发算子的执行方式叫 **eager**。**MoE 通信** 是 GLM 的 MoE 层把每个 token 送到持有它所选专家的卡上、算完再收回来的那一步；昇腾上有两种做法，**MC2** 是小批量 decode 用的快路径，**AllGather** 是先把各卡的 token 拼成完整一份再各取所需的通用路径。

这套部署启动时只录了 7 个尺寸的 decode 图，最大 128 个 token，正好是 32 条请求 × 每条每步 4 个 token（1 个确认 token 加 3 个 MTP 草稿），见[部署页的启动一节](glm-5-3-flash-two-node.md#启动时发生了什么)。纯 decode 步落在这些尺寸里，就回放录好的图。一旦有提示词混进来，这一批就不再整齐，只能走 eager；混进的提示词一长，本步 token 数超过 128，两台机器的 MoE 通信还会一起从 MC2 换到 AllGather，详见 [prefill 页的混合步](prefill.md#长提示词和多条请求prefill-混进-decode-批以后)。PD 分离想做到的，就是 D 上只剩纯 decode 步。

### GLM 要一起交接哪些状态

**GLM 要交的不只是 K/V：12 层 MLA 的潜向量和 indexer 缓存按位置存，indexer 尾状态只留最近几个位置，34 层 KDA 的递推与卷积状态每条请求一份。它们分在 5 个缓存组里，交接时必须停在同一个位置边界上。** 各类状态有多大，见 [KV cache 页](kv-cache.md#混合模型到底要保留哪几类状态)。

这里的 MLA 是 GLM 的稀疏注意力层，每个位置存一条压缩过的潜向量；indexer 是它用来挑「该看哪些历史位置」的小模块，每 4 个位置压成一条存下来，最近还没凑满 4 个位置的那几条单独存成「尾状态」。连接器按缓存组分别决定传哪些块：

- **按位置存的组**：MLA 潜向量与 indexer 缓存同在一个 full 组，按提示词长度算出要传几块，MTP 多留的块切掉。
- **按窗口滑动的组**：indexer 尾状态所在的组，只传窗口末尾那几块。
- **递推状态组**：3 个 KDA 组不按位置裁剪，这条请求在组里的块照原样传。

只传 MLA 潜向量接不上一条 GLM 请求：indexer 的历史和尾状态、KDA 状态必须和它停在同一个位置，D 才能接着算。因此两边除了模型相同，还要对上权重版本、层与缓存组的对应关系、数据类型与内存布局、两边的并行切分，以及「算到了第几个位置」。两边都叫 GLM、块数一样，并不能说明状态可以互用。

GLM 的 3 个 KDA 组在调度器里都是递推状态组，所以连接器对 GLM 走上一节的截断路径：P 少算最后 1 个位置。对这类状态组，连接器还要求 P 的 TP 不小于 D 的 TP，并且能被 D 的 TP 整除。

### 钉住版本里，长提示词交接时 full 组会少传块

**按钉住版本的源码静态阅读（本站没有实测），GLM 的提示词超过 641 个 token 时，连接器给 full 组算出的块数就开始少于应传的块数：刚过这个长度时只传一半，提示词越长，越接近只传四分之一。** 这是读源码得出的结论，不是 PD 的实测现象；传少以后 D 端是先报错还是静默错位，见本节后文。

原因在压缩比。GLM 把 MLA 主缓存和 indexer 缓存放进同一个 full 组、用同一套块号，一块都代表 640 个位置；indexer 只是在块内把每 4 个位置压成一条存，压缩比 4，MLA 主缓存的压缩比是 1。一块多少个位置见[部署页的逻辑块一节](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。连接器给每个组算「一块代表多少个位置」时，把组里各类缓存的压缩比依次读一遍，最后留下的是 indexer 的 4，于是把一块当成 640 × 4 = 2,560 个位置，再按这个数截取要传的块。

```calc
title: full 组要传几块（示意：提示词 2,000 个 token）
P 交出的位置 = 2,000 − 1 = 1,999
应传 = ⌈1,999 ÷ 640⌉ = 4 块
实现算出 = ⌈1,999 ÷ 2,560⌉ = 1 块
> 若走到截齐这一步，D 只读回第 1 块，后 3 块目的块没有写入
```

D 端在同一个函数里先做一道检查：P 报来的块大小要能被 D 自己的算子块大小整除，然后才把两边的块号截成较短的一边。按钉住版本，P 报来的块大小是各缓存组里最小的那个（GLM 是 4）；这道检查会不会先报 AssertionError，取决于 D 的 worker 进程里块大小被改成了多少，只读源码定不下来，缺的是一次双机实际运行（见页末待核）。如果检查通过，D 就拿自己分到的 4 块和 P 报来的 1 块截齐，截齐这一步不报错；D 的调度器仍按「1,999 个位置已算好」往下走，后面那 3 块里的历史没有写进去，成了一种不报错的错误状态。提示词不超过 641 个 token 时，P 交出的位置不超过 640 个，两种算法都是 1 块，不受影响。

支持矩阵在 main 分支把 GLM-5.3-Flash 的 PD 分离一栏标为支持，但整个模型仍标为实验性支持；PD 设计文档的规格表里也只列了 MLA 和 GQA 两类注意力。结合上面这处实现，GLM 在钉住版本上走 PD 不能当成「能正常交接」。

### 把这两台机器拆成一 P 一 D

**最直接的拆法是一台做 P、一台做 D。那样每个实例只剩 8 张卡，正好退回部署页里「单机 8 卡」那一列：每卡要放 36 个路由专家，每卡留给 KV cache 的块从 3,908 个降到 1,577 个，MoE 也用不上 MC2。** 这是按同一组显存假设做的配置换算，不是 PD 的实测结果。

路由专家是 MoE 层里供每个 token 挑选的那批专家，GLM 每层有 288 个。主线的两台机器用 EP16 把它们摊到 16 张卡上，每卡 18 个，两台合起来才是一份完整模型。拆成两个实例以后，P 和 D 各自都要装下完整模型，EP 规模变成 8。[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)已经按同一组假设算过这一列：每卡权重约 38.72 GiB（双机 EP16 时约 20.58 GiB），留给 KV cache 的块 1,577 个（双机 3,908 个）。而 A2 上 MoE 选 MC2 要求 EP 至少 16、每卡专家不超过 24，EP8 两条都不满足，只能走 AllGather。

所以在这两台 A2 上做 PD，D 虽然只剩纯 decode 步，却连主线 decode 步用的 MC2 也用不上了，块数也不到原来的一半；P 上的块还要押到 D 读完才放。常见的 PD 部署会给 P、D 各配多台机器，让每一侧仍保持足够大的 EP 规模，那是另一套硬件规划，本站没有对应的数字。

入口也跟着变。主线里，node0 上的 API server 为新请求挑一个 DP 执行组，两组靠一个协调进程同步「还有没有活」（见[部署页](glm-5-3-flash-two-node.md#启动时发生了什么)）。PD 分离下，P 和 D 是两套各自启动的服务，由外面的代理挑一个 P、一个 D，并在两次转发之间传递交接信息。

D 上被抢占的代价也照搬主线：主线里一条约 67,000 个位置的请求被抢占后，34 层 KDA 状态随块一起丢掉，要重算约 9 步，推导见[并发页的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。拆开以后，这份重算落在 D 上，而且拿不回 P 的远端状态。

## 常见误解

- **「官方双机的两台机器就是一 P 一 D。」** 它们是两个 DP 执行组，各自既做 prefill 也做 decode；启动配置里没有 KV 传输这一项。
- **「支持矩阵写了支持，本站部署就用上了 PD，而且能正常交接。」** 矩阵说的是可以开；官方 GLM 双机教程没有开。按钉住版本的源码，GLM 提示词超过 641 个 token 时 full 组的交接块数还会算少。
- **「P 算完会把 KV 推给 D。」** Mooncake V1 是 D 按地址去读，P 的「发送线程」只回答元数据、记录收完。要 P 主动推，得换成逐层推送的连接器。
- **「P 采出的第一个 token 会交给 D 用。」** 它随交接信息带过去，但没人读，D 自己算出最后一个位置再采样。对 GLM 来说，P 采样时最后一个提示词位置都还没算。
- **「D 上那一步没算东西，是调度器空转。」** 那一步是留给搬运的：请求挂在「等待远端状态」里，worker 只跑连接器收发。
- **「P 唯一的那个 token 抽到结束符，交接就会悄悄失效。」** 示例代理同时把最少生成数设成 1，vLLM 在没生成够最少数之前会屏蔽包括结束符在内的所有停止 token，Ascend 的采样路径也经过这一步，所以这一步抽不到结束符。只有自定义代理漏设最少生成数、而那个 token 恰好是结束符时，P 的请求才会以「正常说完」结束：交接信息为空，代理照常转给 D，D 把整段提示词自己算一遍，结果仍然正确，P 白做一次 prefill。
- **「角色写成『两边都当』最省事。」** Mooncake V1 只认「生产者」「消费者」两种写法；写成两边都当，启动不报错，请求却一直等不到「传完了」。main 分支的新连接器在初始化时就拒绝这种配置。
- **「P 算 N 个位置，D 总要再多算 1 个。」** 那是纯注意力模型；GLM 这类混合模型由 P 少算最后 1 个位置，没有哪一格算两次。
- **「拆开以后一定更快。」** 本站没有 PD 实测数；在这两台机器上直接拆成一 P 一 D，每个实例还会失去 MC2，块数不到原来的一半。

## 对照源码

### 怎么开

PD 分离靠 vLLM 的 `--kv-transfer-config` 打开：P、D 各起一套服务，前面再放一个代理。连接器没有默认值，`kv_connector` 必须显式写；设计文档用 Mooncake V1 作示例。两边配置的差别只在角色和端口：

| 键 | P 实例 | D 实例 | 说明 |
| --- | --- | --- | --- |
| `kv_connector` | `MooncakeConnectorV1` | 同左 | 连接器注册名 |
| `kv_role` | `kv_producer` | `kv_consumer` | 只能二选一，不要写 `kv_both` |
| `kv_port` | 握手端口基址 | 同机时与 P 错开 | 实际端口在基址上按 rank 往上加；同机两个实例必须错开 |
| `kv_connector_extra_config` | `prefill`、`decode` 两段都写 `dp_size`、`tp_size` | 同左 | 描述的是两边各自的并行规模，D 要按 P 的 TP 算一块分几次读 |

- 官方 Mooncake 多机教程提醒：昇腾上的传输会在 `[20000, 20000 + 每机卡数 × 1000)` 里随机占端口，每机 8 卡时 `kv_port` 建议不低于 28000，否则启动时偶发 `zmq.error.ZMQError: Address already in use`。
- 代理用 `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`：发给 P 的请求带 `do_remote_decode=True`、`max_tokens=1`、`min_tokens=1`；P 返回的 `kv_transfer_params` 原样放进发给 D 的请求，P 没返回时就不放。
- 官方示例还带着 `--no-enable-prefix-caching`，代码并不要求：D 要读的位置数是「远端算好的位置数 − 本地已算的位置数」，本地命中会被减掉。GLM 这类混合模型本来默认就不开 prefix caching。
- 读取失败怎么处理由上游 `kv_load_failure_policy` 决定：默认 `"fail"`，可改成 `"recompute"`。
- V1 之外，vllm-ascend 还注册了逐层推送的 `MooncakeLayerwiseConnector`（P 每算完一层就往 D 推一层，逐层传输见 [Layerwise KV Offload](kv-cache-layerwise-offload.md)）和 `MooncakeHybridConnector`。它们和 V1 同属点对点一类：把一条请求的状态送给指定的 D，PD 分离走这一类。另一类是池：`AscendStoreConnector`（另一个注册名是 `MooncakeConnectorStoreV1`）按内容把块存进大家都看得见的外部存储，见 [KV Pool](kv-pool.md)；`RecomputeCPUOffloadConnector` 在请求被抢占时把 KV 存进主机内存，见 [Recompute CPU Offload](recompute-cpu-offload.md)。

### 会报什么错

- **缺 `prefill` / `decode` 里的 `tp_size` 或 `dp_size`**：worker 初始化逐个断言，启动即 `AssertionError`。
- **P 的 TP 小于 D 的 TP**：`ValueError: prefill_tp_size: ... must be greater than or equal to the decode_tp_size: ...`。设计文档的限制更严：TP 不相等时只支持 P_tp > D_tp 且能整除；P、D 也不能是异构硬件，比如 P 在 A2、D 在 A3。
- **KDA 这类递推状态组的 TP 不匹配**：断言 `Mamba prefill TP size must be >= decode TP size.` 或 `Mamba prefill TP size must be divisible by decode TP size.`。
- **`kv_both` 配 Mooncake V1** [!]：上游把 `kv_both` 同时算作生产者和消费者，但 V1 判断角色用字符串相等，`kv_both` 落进「只起接收线程」那一支，完成上报的两个集合都是空的。启动正常，请求永远等不到「传完了」，排查时只看得到请求卡住。main 的 `MooncakeConnectorV2` 在初始化时就拦下：`ValueError: Mooncake scheduler requires exactly one KV transfer role, got 'kv_both'`。
- **GLM 长提示词少传块**：`_get_group_transfer_info` 对 full 组取到压缩比 4，`tokens_per_block` 成了 2,560。D 端 `_get_kernel_block_ids` 先断言 `remote_block_size % kernel_size == 0`（`#L2602-L2604`），再用 `min(len(kernel_remote), len(kernel_local))` 截齐；截齐这一步没有报错或日志提示，前面那道断言会不会先失败见下方待核。
- **收发线程起不来**：线程已退出报 `RuntimeError: KV Cache sending/receiving thread failed to start.`，5 分钟内没就绪报 `RuntimeError: Timeout waiting for KV Cache thread to be ready.`。
- **读取失败**：日志 `Mooncake transfer failed for request...`，随后按 `kv_load_failure_policy` 处理；默认策略下请求以 `FINISHED_ERROR` 结束。
- **P 押块超时**：日志 `Force freed expired request: ...`，阈值是环境变量 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT`，默认 480 秒。
- 以上都是源码里的检查点，没有在双机上实际触发过。

### 开销和什么时候别开

- **交接本身。** 每次交接搬的是提示词对应的各组状态，传输期间 P、D 各占一份；D 的日志 `KV cache transfer for request ... took ... ms` 记录每次读取的耗时，可以拿来量这一段。
- **重复工作。** 纯注意力模型多算最后一个位置一次；混合模型不重复算位置，但 P 仍采样一个没人用的 token。D 上被抢占的请求要在 D 本地整段重算。
- **本站这两台机器别直接拆。** 拆成一 P 一 D 后每个实例退回 EP8：每卡 36 个路由专家、KV 块 1,577 个、MoE 走 AllGather，换算见[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。这是配置换算，不是实测。
- **钉住版本上 GLM 别拿长提示词走 PD。** full 组的交接块数会算少，见上一小节。
- **负载本身适合混部时别开。** 提示词短、并发低时，prefill 插进来的代价小，多出来的交接、代理和押块反而占大头。

### 版本差异

| 项 | v0.23（2c59ff10） | db701c1f（orphan commit，含 GLM 代码，不在任何发布分支上） | v0.26（2ed6cbba） | main（baa023ad） |
| --- | --- | --- | --- | --- |
| Mooncake V1 流程：按长度上限交棒、D 拉、完成信号放块 | 有 | 同 v0.23 | 同 v0.23 | 同 v0.23 |
| 混合模型截断：P 少算最后 1 个位置 | 有 | 有 | 有 | 有 |
| full 组按最后读到的压缩比算块数 | 同一段代码，但没有 GLM | 有 GLM，会少传 | 同一段代码，但没有 GLM | 有 GLM（分组方式相同）；V1 会少传，V2 按每组逻辑块大小算、不少传 |
| `kv_both` 配 V1 | 不报错也不工作 | 同左 | 同左 | V1 仍如此；新的 V2 初始化即 `ValueError` |
| 已注册的点对点连接器 | V1、Hybrid、Layerwise | 同 v0.23 | 另多 `SfaRemoteD2HConnector` | 另多 `SfaRemoteD2HConnector`、`MooncakeConnectorV2`、`MooncakePullConnector` |
| 池类连接器 | AscendStore、UCM、LMCache、SimpleCPUOffload、RecomputeCPUOffload | 同 v0.23 | 同 v0.23 | 去掉 LMCache 和 RecomputeCPUOffload，另有 Offloading、PreemptOffload |
| 支持矩阵里的 GLM-5.3-Flash | 没有这一行 | 没有这一行 | 没有这一行 | 模型实验性支持，PD 一栏标支持 |
| 设计文档的限制清单 | 列了「P 不支持非默认 `max_num_partial_prefills`」 | 已删 | 已删 | 已删 |

- `max_num_partial_prefills` 那条限制从文档里删掉，并不表示放开了：四个版本的平台层都无条件把它重置回 1，而且这和 PD 无关，是整个昇腾平台的行为。
- LMCache 从 main 的注册表里去掉了：按 v0.23 或 v0.26 配 LMCache 的部署升到 main，会报连接器不存在。
- 上游 vLLM 的相关行为在 v0.23.0（0fc695fc）与 v0.26 分支一致：整段命中时退回 1 格重算，`kv_load_failure_policy` 默认 `"fail"`。

### 源码位置

| 看什么 | 固定源码位置 |
| --- | --- |
| P 何时交棒、打包什么 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1880-L1926`，`request_finished` |
| 按组裁剪、截断、D 侧命中与只拉一次 | 同文件 `#L1666-L1849`：`_get_group_transfer_info`、`_get_transfer_block_ids`、`_truncate_request_for_prefill`、`get_num_new_matched_tokens`、`update_state_after_alloc` |
| full 组里 MLA 与 indexer 交错、共用块号 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L210`；main 为 `vllm_ascend/models/glm5next/cache_config.py#L169-L176` |
| D 端先断言块大小、再按较短一边截齐 | 同连接器文件 `#L2585-L2616`：`_get_kernel_block_ids` |
| main 的 V2 按逻辑块算块数 | `vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L84-L140`；`pull_scheduler.py#L610-L618`；注册与别名见 `__init__.py#L49-L53`、`mooncake/connector.py#L228-L261` |
| D 怎么读 | 同连接器文件 `#L774-L990`：`_transfer_kv_cache_all_groups` 与 `batch_transfer_sync_read` |
| P 的发送线程只答元数据 | 同连接器文件 `#L245-L390`：`KVCacheSendingThread` |
| 失败也发完成信号 | 同连接器文件 `#L705-L756`：`KVCacheRecvingThread._handle_request` |
| 角色判定与完成上报 | 同连接器文件 `#L2424-L2492`：线程创建与 `get_finished` |
| 押块超时 | 同连接器文件 `#L166-L243`：`KVCacheTaskTracker` |
| D 上先占块、不计算 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L798-L824`（`WAITING_FOR_REMOTE_KVS`）；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2039-L2057`（`kv_connector_no_forward`） |
| 整段命中退回 1 格、失败后保留已读部分 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186` |
| 代理改长度、转交参数 | `vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L788-L806`、`#L925-L927` |
| 屏蔽停止 token | `vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L191-L238`；上游 `Sampler.forward` 先调它（`vllm/v1/sample/sampler.py#L96-L100`） |
| Ascend 采样也经过它 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598`（`_sample` 调 `self.sampler`）；`vllm_ascend/sample/sampler.py#L46-L125`（`AscendSampler` 不重写 `forward`） |
| 连接器注册 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L87` |
| EPD：只编码就返回、编码缓存、只跑编码器的模式 | `vllm_ascend/worker/model_runner_v1.py#L2018-L2025`、`vllm/distributed/ec_transfer/ec_connector/example_connector.py`、`vllm/model_executor/models/interfaces.py#L216-L246` |

同一个连接器类在两个进程里各造一份：调度器进程里是 `MooncakeConnectorScheduler`，worker 进程里是 `MooncakeConnectorWorker`，上游的连接器接口本来就分成调度侧和 worker 侧两组方法。

**来源索引。** PD 分离的两条动机、拉取与逐层推送两种实现流程、规格表与限制清单都出自 vllm-ascend 设计文档 [S1][S2][S3]；GLM-5.3-Flash 的矩阵条目见支持矩阵 [S4]，官方 GLM 双机教程的多机部署一节没有 KV 传输配置 [S5]；`kv_port` 的建议取值见多机教程 [S29]，v0.23 文档里那条已删的限制见 [S31]。

交接流程：代理改长度 [C6]；P 按长度上限交棒、押块并带走采样出的 token [C8]；按组裁剪与混合模型截断 [C10]；D 挂起等待 [C11]；D 按地址批量读取 [C13]；失败也发完成信号 [C15]；押块超时与默认 480 秒 [C16]；整段命中退回 1 格 [C18]；失败策略默认 `"fail"` [C20]；角色按字符串判断 [C22]，main 的 V2 初始化即拒绝 `kv_both` [C23]；最少生成数屏蔽停止 token [C26]。GLM full 组少传块：组内交错与共用块号 [C45]，连接器按最后读到的压缩比算每块位置数 [C9]，D 端截齐 [C46]。EPD 的形态与流程见其特性文档 [S33][S34]，各实现细节见上表最后一行。

R1 的两种交接点由截断规则与整段命中规则推出，块号小例子与 2,000 个 token 的算式都是示意 [D]；一 P 一 D 的每卡权重、块数与 MC2 条件取自部署页的单机 8 卡换算 [D]。「混合模型不重复算任何位置」由 P 截断与 D 命中 N−1 两条规则合起来推断 [I]；「D 上被抢占后只能本地重算」由连接器在首次分配后关掉远端标记、P 已放块推断 [I]。

**待核。**

- 待核：钉住版本上 GLM 走 PD 会不会在更早一步就报错。EngineCore 在 KV 初始化后把 `cache_config.block_size` 改成各组块大小的最小值（`vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284`，GLM 取到 4），连接器调度侧的 `block_size` 取自这个字段，会以 `remote_block_size=4` 发给 D；D 端断言 `remote_block_size` 能被 kernel 块大小整除（`mooncake_connector.py#L2602-L2604`）。这条断言会不会先失败，只做了静态阅读，缺实际运行。
- 已核：main 的 `MooncakeConnectorV2` 就是 `MooncakePullConnector`（`vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53`、`kv_p2p/mooncake/connector.py#L228-L261`），调度侧 `request_finished` 用截断后的提示词长度选块（`pull_scheduler.py#L610-L618`），块数按每组自己的逻辑块大小算，不乘压缩比（`base_scheduler.py#L84-L85`、`#L118-L140`）。GLM 的 full 组在 V2 上是 ⌈(N−1) ÷ 640⌉ 块，不少传。待核：V2 的 D 端（`pull_worker.py`）和整条链路在 GLM 上能否跑通，缺源码通读和一次实际运行。
- 待核：GLM 一次交接实际读多少字节（KDA 组每请求 4 块含 MTP 候选槽，按源码原样全读），缺 D 端传输日志实测。
- 待核：GLM-5.3-Flash 在 PD 下的端到端实测（首 token 延迟、生成间隔、吞吐、传输耗时），缺官方或本地测量。
- 待核：`MooncakeHybridConnector` 与 V1 在 GLM 上该选哪个，缺官方说明。
- 待核：P、D 各自开 DP、MTP 与图模式时的交接行为，缺双机实测日志。
- 待核：上面「会报什么错」列出的报错都没有在双机上触发过，缺实际日志原文。
