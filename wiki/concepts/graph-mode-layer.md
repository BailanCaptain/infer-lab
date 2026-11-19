---
id: graph-mode-layer
title: graph mode：录一次执行次序，之后整串回放
type: feature
summary: >-
  从 Host 逐个提交任务讲起，说明 graph mode 录的是执行次序而不是结果；区分编译改写、捕获与回放，列出官方双机上
  FULL_DECODE_ONLY 配方指定的 7 个捕获尺寸、一轮选择哪张图的五条判据，以及回放前必须更新什么。
aliases:
  - ACL Graph
  - ACLGraphWrapper
  - AscendCompiler
  - 图模式
  - graph mode
  - piecewise
  - 分段回放
  - 整趟回放
  - xlite
  - 单算子模式
  - eager 模式
  - 捕获
  - 回放
  - compilation_config
  - compilation-config
  - cudagraph_mode
  - cudagraph-mode
  - cudagraph_capture_sizes
  - cudagraph-capture-sizes
  - max_cudagraph_capture_size
  - max-cudagraph-capture-size
  - enforce_eager
  - enforce-eager
chapters:
  - '16'
order: 30
sources:
  - 'vllm@0fc695fc:vllm/config/compilation.py#L55-L92'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1108-L1150'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L215-L289'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1618-L1682'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L76-L158'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L209-L236'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L262-L328'
  - 'vllm@0fc695fc:vllm/compilation/monitor.py#L88-L100'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6525-L6588'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L130-L136'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L176-L181'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L880-L886'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L593-L632'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L633-L648'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L26-L87'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L170'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L216-L259'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2910-L2967'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2778-L2835'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3800-L3816'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5330-L5340'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L220-L236'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L661-L670'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L340'
  - 'vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L138-L258'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L150-L290'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L748-L778'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L286-L302'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1050-L1062'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L586-L636'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L155-L217'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L280-L301'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2240-L2250'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L44-L69'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L44-L75
  - >-
    raw:sha256-1712389442d21bfb50f706ff10fe425cea58299399b6592e6c9980469daa4935.md#L1-L1556
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/compilation/acl_graph.py#L138-L158
  - 'vllm@0fc695fc:vllm/config/compilation.py#L599-L698'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1423-L1482'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2194-L2210'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L214-L284'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1660-L1784'
  - 'vllm@0fc695fc:vllm/config/model.py#L217-L223'
  - 'vllm@0fc695fc:vllm/utils/argparse_utils.py#L389-L429'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L295-L337'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L207-L261'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1739-L1905'
  - 'vllm@84030bbe:vllm/config/vllm.py#L2010-L2278'
  - 'vllm@568afb3a:vllm/config/compilation.py#L1353-L1548'
  - 'vllm@84030bbe:vllm/config/compilation.py#L1375-L1570'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1056-L1229'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1385-L1424'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L1437-L1518'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L713-L755'
  - 'vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L215-L234'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L200-L219'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L241-L260'
  - 'vllm@0fc695fc:vllm/config/compilation.py#L837-L862'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L718-L722'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1493-L1560'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L1638-L1706'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2337-L2353'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2576-L2592'
  - 'vllm@568afb3a:vllm/config/vllm.py#L205-L381'
  - 'vllm@84030bbe:vllm/config/vllm.py#L248-L432'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1162-L1172'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1440-L1450'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L207-L261'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L206-L260'
  - 'vllm@568afb3a:vllm/config/model.py#L217-L222'
  - 'vllm@84030bbe:vllm/config/model.py#L242-L247'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L542-L547'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1503-L1537'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1264-L1300'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1302-L1343'
  - 'vllm-ascend@7d825229:vllm_ascend/compilation/acl_graph.py#L284-L319'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/graph_mode.md
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L82-L146'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L150-L267'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L731-L786'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L365-L390'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L830-L837'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L284-L288'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1790-L1795'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L277-L292'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/gdn_attn_builder.py#L971-L974'
  - 'vllm@84030bbe:vllm/v1/attention/backends/gdn_attn.py#L27-L38'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L598-L659'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L590-L661'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L104-L160'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L849-L879'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L227-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L93-L100'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1275-L1355'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L225-L310'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/compiler_interface.py#L179-L340'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L106-L112'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1505-L1560'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/acl_graph.py#L230-L315'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/compiler_interface.py#L189-L350'
  - 'vllm@ced6857a:vllm/config/compilation.py#L1147-L1190'
  - 'vllm@ba15685a:vllm/config/compilation.py#L1317-L1360'
  - 'vllm@ba15685a:vllm/config/vllm.py#L2540-L2580'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: npu-model-runner
    kind: builds-on
    note: Runner 决定本轮张量、模式与描述符
  - to: ops-and-kernels
    kind: builds-on
    note: 先理解算子和设备任务的提交
  - to: device-memory
    kind: builds-on
    note: 图捕获的显存代价依赖设备内存预算与分配顺序：先分配 KV 缓存，再捕获图，图资源由预算外余量支付。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-1712389442d21bfb50f706ff10fe425cea58299399b6592e6c9980469daa4935.md
  - >-
    raw/sha256-3b5bac3a790ea99db247b1de46a2cd8da894676ac44df2e140fa73e7532151f3.md
---

**graph mode**（图模式）把一段前向计算中「Host（CPU 侧的执行进程）把任务交给设备」的动作按次序录成一张图，之后符合回放条件的一轮，一次提交就让设备照录好的次序重跑这一段。它减少重复提交，不省掉模型运算；补齐增加的行也会占用计算。

## 同一串任务，为什么要一轮一轮重复提交

模型结构定下来之后，真正跑起来的是一长串设备任务：每一层的矩阵乘、归一化、注意力、专家计算，都要由 Host 逐个交给 NPU，告诉它算什么、数据在哪。这种逐算子执行的方式叫 **eager**。逐个提交不等于每次都等设备算完：异步下发时，Host 可以继续排后面的任务，设备按依赖执行；图回放进一步减少的是这些重复下发动作。

decode 是在已有历史上继续生成的阶段，每轮只处理少量新位置，却仍要经过各层。矩阵乘的行数少了，Host 需要提交的任务却未必同比减少，因此重复提交的固定开销可能变得显眼。它究竟占多少，随模型、批次大小和硬件而变。

更关键的是：这几百次提交，每一轮都几乎一模一样。层数没变、算子种类没变、次序没变，变的只是里面的数值、位置和块表。

```wiki-diagram
file: graph-mode-record-replay
```

所以办法很直接：首次在启动期按固定尺寸跑一遍，把这一串任务的次序记下来（叫**捕获**），之后形状相同的每一轮只提交一次，让设备照记录重跑（叫**回放**）。记下来的那一串就是一张**图**。

不过，回放并不是「形状一样就自动触发」，还要同时跨过两道检查：先由配置与上游分派器判断当前批次符合哪一档图路径，再由外层包装器核对本轮运行模式与批次描述符——若模式为 `NONE` 或与包装器自身模式不符，就直接透传调用原函数；模式相符时才按批次描述查找已录好的图条目，找不到才进入启动期捕获。上面说的「一次提交」只覆盖已捕获的范围，范围之外的计算仍各自执行。

## 录下来的是执行次序，不是结果

初学这一层最容易看反的一点是：图里存的不是算出来的数，而是「先做什么、后做什么、各自读写哪块地址」。所以回放时结果照样会变——本轮的输入写进那几块固定地址，设备按原次序重算一遍，得到的是本轮的结果。

一张图也不对应一条请求。一条请求要走很多轮，一轮里又同时服务很多条请求；图对应的是**某一种形状的一轮**，和请求边界没有关系。

真正落到执行上的是三个不同动作，它们常被一起叫作「图」，但处理的对象不同：

| 动作 | 处理的对象 | 改变或保留什么 |
|---|---|---|
| 编译与图改写 | 运算表示、形状约束、算子之间怎么连 | 在模型计算语义下拆开或融合运算、替换执行实现；数值精度仍需验证 |
| 捕获 | 一段受支持的设备任务序列及其依赖 | 只记录可复用的执行次序，不改算什么 |
| 回放 | 已录好的图 + 本轮准备好的数据 | 按记录重算，得到本轮的结果 |

算子融合（把几个小运算并成一个）和回放可以同时开，但它们是两件事：前者减少算子个数，后者减少提交次数。本页只讲后者，前者见[编译期图融合](npugraph-ex.md)。

## 省的是提交次数，代价却要单独付

decode（每轮往后续写的阶段）的形状高度重复，录一次能用很多次，是本部署主要利用回放的地方。prefill（处理提示词的阶段）的宽度更易变化，需要考虑补齐与捕获覆盖；支持混合批的档位也能捕获它，收益取决于实际批次分布。

代价有四笔，都不出现在「省了多少提交」这一侧：

- **启动时间**：每个要录的尺寸都得在启动期真跑一遍空批次，尺寸越多、这一段越久。
- **显存**：录好的图要占一块设备内存。在本部署里，它不从 KV cache 预算里扣，而是由预算外留出的那 9.6 GiB 余量支付，具体占多少要看启动日志（见[部署页的显存账](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）。
- **形状要补齐**：只录了有限几个尺寸，真实批次要往上垫到最近的一档，垫出来的位置空跑一遍。
- **约束**：图绑定固定地址，本轮数据必须写进同一批地址；做不到就用不了图。

反过来也不能把 eager 说成「万能」：它同样受设备、算子实现和形状支持范围限制，只是不额外要求「和录制时一致」。至于两种方式各自多快，只能实测；本库没有 NPU 实测数据，本页不给任何加速比。

## 录多少：NONE、PIECEWISE、FULL 和两个组合档

```wiki-diagram
file: graph-mode
```

按「一趟前向录多少」分成三档：

- **NONE**：这条路径上不录也不放，全程逐个提交，也就是 eager。
- **PIECEWISE**（分段）：把一趟前向切成若干段，各段分别录；切口之外的运算每轮照常逐个提交。切在哪里由一份「切分算子」清单决定，上游默认把清单设成各类 attention 算子，昇腾在这一档上再补进 MLA 和稀疏 attention 两个入口——所以默认切口确实落在注意力处，但这是配置决定的，不是「注意力天生不能进图」。
- **FULL**（整趟）：整个目标范围录成一张图，要求范围内每一步都满足捕获约束。昇腾选了 FULL 时会把切分清单清空，不再分段。

这里需要区分**捕获范围**与**编译结构**：FX 图是 `torch.compile` 用来表示计算操作及依赖的程序结构。上游有一条使用默认切分清单的编译路径，内部保留分段的 FX 图，再在它外层捕获整图——因此「整图回放」本身不意味着所有实现都把内部程序表示展平。昇腾平台在 `PIECEWISE` / `FULL_AND_PIECEWISE` 分支按 `vllm::unified_attention_with_output` 及 `vllm::mla_forward` / `vllm::dsa_forward` 切开 FX 图，并同步关闭 `npugraph_ex` 改走本地 `fusion_pass_compile`；而在 `FULL` / `FULL_DECODE_ONLY` 纯整图分支则主动清空 `splitting_ops = []`，让整段计算进入 `npugraph_ex_compile` 与 `ACLGraphWrapper` 整趟捕获。下面这张对比图把三层分工和两条 FX 切分路径放在一起看：

```wiki-diagram
file: graph-mode-layer-fig-fx-split
```

还有两个组合档：`FULL_DECODE_ONLY` 表示整齐的 decode 轮用 `FULL`、其余轮用 `NONE`；`FULL_AND_PIECEWISE` 表示整齐的 decode 轮用 `FULL`、混合轮用 `PIECEWISE`。后者是常规默认优化档 O2 在平台和后端兼容检查前的预设。把 decode 单独拎出来，是因为它的形状更容易反复命中；其他批次能否捕获，要看所选档位与后端能力。

## 官方双机上录了哪 7 张图

本部署（[部署前提](glm-5-3-flash-two-node.md#部署前提)）把档位配成 `FULL_DECODE_ONLY`，并显式给出 7 个捕获尺寸——这 7 个数是这套命令写死的，不配的话程序会按并发上限自己算一份，所以别把它当成所有部署通用的尺寸表。这里列的是配置与源码决定的捕获计划，实际捕获成功仍要看启动日志。选这一档的后果是：只为「整齐的 decode 轮」建索引，混合轮一张图都没有，一旦混进 prefill 就整轮 eager。

以主线示例请求 R1（提示词为 4 个 token）为例，它的连续 decode 一轮验证 4 个位置，每张卡仍经过 45 层和 218 次集合通信调用。主线按不同通信的张量载荷口径合计为几 MiB，不能当作网卡实际流量；完整口径见[一次前向的通信账](one-request.md#一次前向的通信账)。这些小张量上的多次提交说明了回放的动机，实际瓶颈仍需测量。

尺寸为什么最大到 128，由这套部署的两个上限决定：

$$T_{\max} = N_{\text{seq}} \times (1 + k_{\text{draft}}) = 32 \times (1 + 3) = 128\text{ 个 token 位}$$

| 决定因素（GLM 双机部署上限） | 数值与算式 | 含义 |
| --- | --- | --- |
| 单请求单轮位置数 | $1 + 3 = 4$ | 1 个已确定 token + 3 个 MTP 草稿 |
| 单组最大并发请求数 | $32$ 条 | 每组同时在跑的 decode 请求上限 |
| 最大捕获尺寸 | $32 \times 4 =$ **128** | 7 档尺寸中的最大一档 |

这里的 3 个草稿来自 MTP（模型自带的多 token 预测层，每轮先猜 3 个再一起验证），32 是同时在跑的请求数上限；这两个数和同一笔账在[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)里也出现过，本页不另立一套。于是 7 个尺寸对应的不是 7 个请求数区间，而是整齐的 7 档并发：

| 捕获尺寸（token 位） | 4 | 8 | 16 | 32 | 64 | 96 | 128 |
|---|---|---|---|---|---|---|---|
| 对应的 decode 请求数 | 1 | 2 | 4 | 8 | 16 | 24 | 32 |

一条请求带 4 个位置，也正是它需要一路录到 128 的原因：不开 MTP 时 32 条请求只要 32 这一档。草稿层自己**不进图**——vLLM Ascend 对「GLM 系列 + 投机解码」这个组合把草稿模型固定切回 eager，三遍草拟每轮都按实际宽度逐个提交。这两条落到具体一轮是什么样，见[那条请求的第二圈和第三圈](one-request.md)。

## 这一轮回放哪一张图：五条判据

每一轮开始前，模型运行器（Runner，负责准备本轮张量、再调用模型的那一层）先判断这一轮能不能用图、用哪一张，把结论（运行模式 + 一个描述符）放进本轮的执行上下文。判据按顺序有五条，全过才回放：

1. 所有请求的提示词都算完了吗（没有谁还在 prefill）？

   这一条检查的是请求的计算进度，不能仅凭本轮输入形状整齐就认定它属于 decode。在本部署所用快照的投机解码路径中，提示词尚未全部算完却被归为全 decode 的批次，可能读到没有正确填充的补齐缓冲区，把其他请求遗留的数据带入当前状态。
2. 这一轮里排得最多的那条请求，也只有 4 个 token 位吗？
3. 总 token 数正好等于 4 × 请求数吗？（第 2、3 条合起来才等于「每条都是 4」）
4. 总 token 数没超过最大捕获尺寸 128 吗？
5. 另一个 [DP 组](data-parallel.md)（各自调度、各有 KV 池的一台机器）这一轮也过了前四条吗？

第五条来自跨 DP 的协调；本部署恰有两组：两组每轮要先交换「我这边多宽、能不能用图」，模式取两边较低值——三档在枚举里就是按 NONE < PIECEWISE < FULL 排的数值，取小自然就退到最保守的那一档。一组混进 prefill，两组这一轮都退回 eager，本来能用图的那组也用不上。补齐到哪一档、两组怎么对齐、空闲组为什么还要陪跑，账在[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)里，本页不重算。

描述符里不止有 token 数，还有补齐后的请求数、「是不是整齐的 decode」，以及有没有用 LoRA（本部署不用）。所以**两轮 token 总数相同，不足以说明它们回放的是同一张图**：两轮的 token 总数同样是 64，16 条整齐 decode 回放的是 64 那张图，而混进 prefill 的一轮在这一档配置下根本没有图，直接 eager，也不按图尺寸补齐。分派时看的还有 LoRA 状态和有没有强制 eager。

## 包装器内部：透传、回放还是现录

上面那套判断做完，才轮到真正管捕获和回放的那层包装——昇腾上的这套实现叫 [ACL Graph](acl-graph.md)。它包在整个模型外面，每一轮只做三件事，自己不判断这一轮该不该用图。下图是固定旧 GLM 的录放路径；`v0.30.0` 与 `main` 在 ENPU、草稿合图和可更新图上的同步与更新顺序例外见[版本差异](#版本差异)。

```wiki-diagram
file: graph-mode-wrapper-flow
```

值得单独记住的是最后一个分支：**服务期遇到没录过的形状，不会临时补录**。捕获只在启动期那个窗口里合法，窗口之外触发捕获会被合法性检查直接拒绝。正常情况下也轮不到它报错——分派器只会交出已经录过的描述符。

因此排查「为什么这一轮没走图」，要查的是上游怎么给这一轮定的模式和描述符，不是查这层包装。

## 回放之前，必须先把数据写对

图记住的是次序和地址，不是内容。回放前得保证本轮的输入已经写进录制时用的那几块地址；这件事不归包装层管，它假定外部已经准备好。DEBUG 日志级别下，它只比较直接放在位置参数中的 Tensor 地址，不递归检查嵌套结构，也不检查所有关键字参数。

每轮真正会变、又必须同步更新的有：每条请求的位置、已算长度、[block table](block-table.md)（记录这条请求的 KV 放在哪些块里的表），以及各注意力后端自己的元数据。若任务读取了尚未刷新的位置，就会读到旧值；地址检查通过也不能证明内容正确。

Runner 里有一条「在侧流上刷新整图注意力参数」的通用路径，但**本模型走不到**：它要求既不用稀疏注意力也不用压缩，而 GLM-5.3-Flash 用的是[稀疏 MLA](sparse-attention.md)。该通用调用在默认非 ENPU 路径中位于模型调用之后，ENPU 路径才移到之前；不能把这段调用顺序套给所有后端。

固定 GLM 源码中，主稀疏 MLA 构建器直接引用本轮公共块表、slot mapping、查询起点和长度的切片；Runner 会先把活跃请求的块表复制到持久设备缓冲。压缩索引器另外预分配自己的 slot mapping、长度和块表，再通过 copy_ 或 out= 原地刷新。KDA 所用的 GDN 构建器在整齐投机 decode 分支中，也把状态索引、掩码、查询起点与已接受 token 数写回持久 Tensor，并填充空行。这样更新的是图所引用缓冲的内容，不能因为通用侧流入口未执行，就推断本轮元数据没有更新。各算子实际读取这些缓冲的次序仍须与图的执行依赖配合，以上源码路径不替代设备正确性测试。

## 启动时录、运行时放

启动的最后一段专门干这件事：先跑几遍空批次热身——热身的尺寸来自显式指定要编译的尺寸，再加上那些没有被任何捕获尺寸覆盖到的编译区间端点——然后把要录的尺寸从大到小逐个跑一遍并录下来。**等第一条请求进来时，图早就录完了。**

常被当成排查第一刀的**强制 eager**，关掉的不止录图：上游一见到它，就把编译模式和图档位一起设成 NONE，昇腾平台再顺手关掉自己的编译后端。也就是说，编译期的改写与录图**一起**没了；本部署又没有单独指定要编译的尺寸，所以热身那一段实际上没有尺寸可跑，录图这一步也整个跳过。

所以「打开强制 eager 问题就消失」只说明故障随这组执行路径变化而改变，还不能定位到某一层：编译、捕获、补齐和实际算子路径都可能随之变化。可在相同输入与配置下分别控制图档位、编译后端和适用的融合开关，再核对实际执行路径。只关 npugraph_ex 会换用另一条融合路径；只把图档位设成 NONE，昇腾也会关掉编译，均不是只改变一个行为的实验。

最后区分三层证据，别混着说：配置里开了图模式、启动时录完了图、某一轮真的回放了，是三件不同的事。本库没有 NPU 实测，所以不把 GLM 的 decode 轮数直接写成同样次数的成功回放，也不给收益数字。

## 旁边的另外两条路：一条默认开着，一条默认关着

- **编译期优化（`npugraph_ex`）与 `torch.compile` 分段图、`ACLGraph` 构成三层分工。** 最上层是上游 `torch.compile` 分段图框架（在 `PIECEWISE` 档按 `splitting_ops` 切开 FX 图，而在昇腾 `FULL` / `FULL_DECODE_ONLY` 档主动清空 `splitting_ops`）；中间层是昇腾的编译后端 `AscendCompiler`——开启 `enable_npugraph_ex` 时走 `npugraph_ex` 做编译期图改写与算子融合（含静态 kernel 与跳过含 Triton kernel 的图缓存），关掉时改走昇腾 `fusion_pass_compile`（`NONE` 与 `PIECEWISE` 档会主动关闭 `npugraph_ex`）；最底层是 [ACL Graph](acl-graph.md)（`ACLGraphWrapper`），负责把最终定型的算子序列按固定尺寸捕获成静态图并在运行期整串回放。官方命令没有关编译期优化，这一档又走 `FULL_DECODE_ONLY` 清空分段，模型也带着编译装饰器进来，于是三层叠加工作：融合改写运算组织，回放减少重复提交，两者互不替代。`npugraph_ex` 与关闭该开关后使用的 Ascend pass manager 是两条不同路径，不能假定应用完全相同的规则或默认值；具体消费者和开关范围见 [npugraph-ex](npugraph-ex.md)，实际匹配的算子及收益要由编译记录和同负载测量确认。
- **torchair** 是 npugraph_ex 编译路径的兼容退路：包导入、选项适配、后端构建或编译调用所在的 try 块抛出 ImportError 时进入它；其他异常不会因这条 except 自动回退。
- **xlite** 才是默认关着的那条：要在额外配置里单独打开；它的执行进程和模型运行器只是在昇腾原有的两个上薄薄包一层。打开后平台会把主模型的档位降到 `FULL_DECODE_ONLY`，或者干脆关掉图。

本页的数字只针对回放这一层。xlite 没有启用、也没有实测数据，不能把这里的 GLM 数字当成它的效果。

### Xlite 的名字叫 decode-only，为什么也可能执行小 prefill

**以下按 2026-11-02 官方快照解释，指南明确从 v0.28 起改为按 token 数分派。** Xlite 是需要另装 xlite 包的执行路径，按所有 DP rank 中最大的本步 token 数与预分配预算比较。预算以内交给 Xlite runtime，超出则回到原生 runnable；原生路径是否回放 ACL 图仍由其图配置决定。

| Xlite 模式 | 对齐前的预算 | 哪些批可进入 |
| --- | --- | --- |
| decode-only，full_mode=false | max_num_batched_tokens 与 max_num_seqs × (1 + num_speculative_tokens) 两者取小；没有投机时括号内为 1，后一项等于 max_num_seqs | 最终预算内的 decode，以及同样装得下的小 prefill/混合批 |
| full，full_mode=true | max_num_batched_tokens | 预算内的 prefill、decode 和混合批 |

两种模式都把上表结果**向上补齐到 TP 的整数倍**，得到实际用于分派的预分配预算。例如名额 32、每条请求 3 个候选、max_num_batched_tokens 至少为 128 且 TP=8 时，decode-only 的最终预算是 128 个位置。若两个 DP rank 本步分别有 80、120 个位置，按 120 判断；其中有 prefill 也不因名称而被排除。某个 rank 达到 160 就超过这档预算。另一个示意：名额 9、无投机、max_num_batched_tokens=64、TP=8，先取 9，再补齐为 16，因而本步 12 个位置仍在预算内。它限制的是**本步位置数**，不是历史上下文长度，也不是跨 DP 相加后的总数。

v0.28 之前 decode-only 按 attention state 排除含 prefill 的批，不能把新规则套回旧镜像。Full 模式预留更大工作区；指南建议无投机的 full 示例关闭 ACL 图捕获以减少额外内存。模型支持按 architectures 注册，不按商品名猜测：指南列出 Llama/Qwen dense、Qwen MoE/VL、Glm4Moe、DeepseekV3/V32、GlmMoeDsa 和 MiniMaxM2 等架构，没有给出本站 GLM-5.3-Flash 混合 KDA 的支持保证。

## 常见误解

- **「开了图模式，整条请求都在回放图。」**——本部署只给整齐的 decode 轮录了图。prefill 那一轮、三遍草拟、任何混进 prefill 的轮次都是 eager。
- **「图模式省的是计算。」**——回放本身没有省掉模型运算，省的是重复提交；当提交开销成为瓶颈时才更有收益，补齐增加的行也会占用计算。
- **「包装层自己决定这一轮用不用图。」**——它不决定，只照上游给的模式和描述符执行。
- **「录图是第一条请求来的时候才做的。」**——启动期就按尺寸全部录完；服务期遇到没录过的形状不会补录。
- **「两轮 token 数一样，就是同一张图。」**——描述符还含请求数和是否整齐，混合轮和 decode 轮凑出同样的 token 数也不共用图。
- **「平台配置里写着关掉编译，说明昇腾只能逐个提交。」**——关掉的只是上游默认的那条编译路径，昇腾换成了自己的编译后端和图包装，图模式照样有。
- **「图模式和编译期融合是一回事，关一个等于关另一个。」**——是两层：融合改写算子实现与组织，回放改变提交方式。本部署两条路径都启用，而强制 eager 会把两层一起关掉。

## 对照源码

### 怎么开

**Xlite 的独立入口。** 在满足架构与软件要求的部署中安装匹配的 xlite 包，把 `{"xlite_graph_config":{"enabled":true,"full_mode":false}}` 合入 additional-config，即选择 decode-sized 预算；enabled、full_mode 默认都为 false。改为 full_mode=true 时按上一节扩大预算；无投机的官方 full 示例另加 enforce-eager，关闭原生 ACL 捕获不会关闭另行启用的 Xlite runtime。完整环境与 TP/EP 示例见来源中的 921ccc52 图模式指南，不能只复制这一片段作为 GLM 双机启动命令。

**先分清五个入口的职责。** compilation_config 是编译与图配置的容器；其中 mode 决定怎样编译，cudagraph_mode 决定捕获哪些批次，尺寸表和上限决定捕获多宽。主模型 enforce_eager 则是更强的总开关。它们是启动配置，不是每条生成请求的采样参数。

| 参数与入口 | 类型与缺省 | 实际作用 |
|---|---|---|
| `compilation_config`；CLI `--compilation-config` / `-cc` | CLI 传 JSON 对象；缺省创建 CompilationConfig。Python LLM 接受 None、字典、配置对象，另兼容整数 0–3 | 整数只在 LLM 入口转成编译 mode，不代表图档位；CLI 不沿用这个整数快捷入口 |
| `cudagraph_mode`，在上述对象内 | 枚举，字段初始 None；字符串不区分大小写 | NONE、PIECEWISE、FULL、FULL_DECODE_ONLY、FULL_AND_PIECEWISE；语义见上文的档位图。推荐写完整字符串，避免把编译 mode 的数字与图枚举混用 |
| `cudagraph_capture_sizes`；也可用 `--cudagraph-capture-sizes` | list[int]，缺省 None | 每一档是本轮送进模型的 token 位置数，包含草稿位置；不是历史上下文长度，也不等于请求条数。None 自动生成；启用图时显式空列表会断言失败 |
| `max_cudagraph_capture_size`；也可用 `--max-cudagraph-capture-size` | int，缺省 None | 自动生成候选尺寸的初始上限，最终会改写成有效表的最大档；显式表与显式上限共同设置时检查一致性 |
| 主模型 `enforce_eager`；CLI `--enforce-eager` / `--no-enforce-eager` | bool，默认 False | True 同时关闭主模型编译和图；False 只是不强制关闭，仍受优化档、平台、后端与每轮形状约束 |

入口与类型对应来源 39–46，枚举名转换与 EngineArgs 字典转换见来源 59、60。Python EngineArgs 接受配置对象，也会把字典构造成 CompilationConfig；不要把 LLM 的整数兼容行为推广到所有入口。CLI 的点号写法如 `-cc.cudagraph_mode=FULL_DECODE_ONLY` 会组装成同一个 JSON 对象，点号后仍用下划线字段名。两个独立尺寸选项也不是第三套配置：它们最终写回同名字段；**同一字段同时出现在独立选项和配置对象中，即使值相同也报互斥错误**。两端启动应使用同一份主模型图配方，避免各自捕获不同尺寸。

官方双机命令用 `--compilation-config` 把 `cudagraph_mode` 设成 `"FULL_DECODE_ONLY"`，并显式给出 `cudagraph_capture_sizes` 的 7 个值；完整命令与其余参数在[部署页](glm-5-3-flash-two-node.md#怎么开)统一维护。草稿侧那条 `enforce_eager: true` 写在 `--speculative-config` 里，只管草稿模型，主模型照样捕获 decode 图。[C25]

**默认值分两步填，不能只看字段上的 None。** 未指定图档位时，优化档 O0 / O1 / O2 / O3 分别给 NONE / PIECEWISE / FULL_AND_PIECEWISE / FULL_AND_PIECEWISE；默认优化档是 O2。优化预设只填未设置的值，显式图档位优先；之后 Ascend 与注意力后端仍可调整。基线主模型 eager 会先强制把编译与图两项置为 NONE，显式 FULL_DECODE_ONLY 也不能把它重新打开。来源 3、30、55 对应这些阶段。

**捕获尺寸按下面的顺序落定。** 把统一 decode 查询长度记为 q：普通 decode 为 1，固定宽度投机解码为 1 加草稿数。把每 DP 的最大请求数记为 N、每轮 token 预算记为 B，它们的默认推导见[调度参数](vllm-scheduler.md#怎么开)。

1. 两个尺寸字段都没给时，GLM Ascend 先注入 min(N×q, 512) 作为初始上限；纯上游基线使用 min(N×q×2, 512)。只要显式给了其中任一字段，Ascend 就不注入。512 因而是自动路径的截断值，不是所有显式配置的硬上限。
2. 上游将初始上限再限制到 B。未给表时，普通性能模式用 1、2、4，随后每 8 一档到 248，从 256 起每 16 一档；只保留不超过上限的档。interactivity 模式把前 32 个位置改为逐个捕获，后续仍沿用粗档；B 本身在上限内时也补入候选表。因此“只给上限 10”且 B 远大于 10，普通模式最终最大档是 8，不保证自动录一张宽度 10 的图。
3. 显式给表则按 B 过滤、去重、升序排序，**不会按初算上限裁剪该表**。上游 sequence parallel 开启且 TP>1 时还会筛选合法尺寸。此时若也显式给了上限，它必须等于处理后表的最大值；仅给上限时则允许缩到实际最大档并记录 warning。只给表且所有项都超过 B 时，这一阶段得到空表和最大值 0；但本站 Ascend 后续还会重算尺寸，图仍启用时会因上限 0 触发断言（来源 73），不能据此得到可启动的“空图配置”。
4. 后端确定可用图档后，基线的整趟 decode 加投机路径再对齐到 q 的倍数：向上取整、去重，但舍弃越过当前上限的结果，随后更新最大档。与 sequence parallel 同用时还有整除检查，细节与后端降级统一见 [ACL Graph](acl-graph.md#怎么开)。

这四步对应来源 43、47、54。它们只确定允许捕获的候选表；服务期是否回放还要经过上文的五条批次判据。

用一组**配置示意值**检查显式覆盖：B=64、不开 sequence parallel、表为 [32,4,4,128]，清理后得到 [4,32]，最终最大值为 32；只给这张表可以通过，另给最大值 128 则报错，改成 32 才一致。若再走 q=4 的整趟 decode 对齐，两档都保持不变。固定 GLM 的七档则全部是 4 的倍数、最大 128，低于 B=8192；沿用上文七张图的算例即可，不把七档误当作自动生成的全表。

实际配置应使用正整数尺寸。源码的 list[int] 没有逐元素正数约束，不能宣称负数或 0 一定被入口立即拒绝；字段通过解析也不证明后续建表或设备捕获可用。关闭图应使用主 eager 或 NONE，而不是用空表或 0 上限充当关闭开关。

昇腾不走上游 `torch.compile` 的默认路径：平台类里 `simple_compile_backend` 就是 `"eager"`，同行注释写明禁用 `torch.compile()`（来源 10）。图能力换成两个接入点：`get_compile_backend()` 返回自己的 `AscendCompiler`，`get_static_graph_wrapper_cls()` 返回 `ACLGraphWrapper`（来源 11、12）。

档位与切分清单的对应也在平台里定：`NONE` 连编译模式一起关；需要分段时调用上游的 `set_splitting_ops_for_v1` 并追加 `vllm::mla_forward`、`vllm::dsa_forward`；不需要分段且 `has_full_cudagraphs()` 为真时才把 `splitting_ops` 清空，本部署属于后一支。[C13] 因而 FULL_AND_PIECEWISE 虽包含 FULL，仍先进入分段分支。上游那份默认清单是 `_attention_ops` 里的各类 attention 算子。三档与两个组合档的定义、`decode_mode()` / `mixed_mode()` 的取值都在上游 `CUDAGraphMode` 上，昇腾路径复用同一个枚举。上游提供分派器、补齐表和描述符；Ascend Runner 参与每轮整齐性判断、调用分派器与 DP 对齐，平台再处理自身的尺寸限制和编译接入。

整个模型在权重加载后被包了一层 `ACLGraphWrapper(runtime_mode=FULL)`；建索引时按 `uniform_decode_query_len`（本部署 = 1 + 3 个草稿 = 4[D]）过滤尺寸，并为每档算出 `num_reqs`。[C6] 每轮的 `uniform_decode` 判定与本地补齐在 Runner 里，补齐表与描述符构造在分派器里。[C19] GLM 系列加投机解码时把草稿模型的 `use_cuda_graph` 强制置假，并打一条 warning 说明等价于给草稿配 `enforce_eager: true`。[C23] xlite 的开关是额外配置里的 `xlite_graph_config`，`enabled` 与 `full_mode` 默认都是假。

配置允许使用图，还要由分派器判断当前批次能否进入图路径。上游固定快照中，用于匹配图的键尚未初始化、图模式关闭、没有设置最大捕获大小、当前批次的 token 数超过上限，或调用方只允许不使用图时，都会返回不使用图的执行方式。通过前提后先匹配 FULL 描述符；允许 PIECEWISE 时再用放宽请求数和整齐标志的键匹配。均未命中时，只有允许 NONE 才返回普通执行，否则断言报错。因此通过前提不等于必然回放。

**编译期优化在这套命令下是开着的。** 昇腾编译配置里 `enable_npugraph_ex` 默认为真，构造器对 310P 强制关闭[C31]；平台的 `NONE` 与分段编译分支也会将它置假。`FULL_DECODE_ONLY` 走清空 `splitting_ops` 那一支，不动这个开关。默认优化档的编译模式是 `VLLM_COMPILE`，GLM 主模型带 `@support_torch_compile`[C34]，编译后端又是 `AscendCompiler`，所以开关为真时走 `npugraph_ex_compile`[C33]。来源 32 的 try/except 覆盖 npugraph_ex 的导入、适配和编译调用，并非只检查包是否存在。

**关掉 `enable_npugraph_ex` 并不等于关掉融合。** 开关为假时 `AscendCompiler` 改走 `fusion_pass_compile`，调用 Ascend 自己的 pass manager[C35]。该 manager 从 additional_config 原始字典读取 `fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_allreduce_rms`、`fuse_muls_add`，缺键时各用 True，部分 pass 还排除 310P[C36]；但 AscendCompilationConfig 构造器的 `fuse_allreduce_rms` 默认是 False。npugraph_ex 的配置适配则设置 force_eager、输入输出复制与静态编译等选项，没有把这四个字段逐一转交给它。不能据此声称两条路径的四项规则全部默认开启，也不能把关闭四个键当成禁用 npugraph_ex 内部所有优化的保证。各开关应按 [npugraph-ex](npugraph-ex.md) 中的实际消费者使用。

**强制 eager（`--enforce-eager`）关的是两层。** 上游在配置阶段就把 `mode` 和 `cudagraph_mode` 一起设成 `NONE`，日志原话是等价于 `-cc.mode=none -cc.cudagraph_mode=none`[C30]；昇腾平台随后也把自己的编译模式关掉，并在图档位为 `NONE` 时置假 `enable_npugraph_ex`。`compile_sizes` 默认为空，所以热身循环这时没有尺寸可跑[I]，末尾的捕获也整个跳过[C18]。

### 会报什么错

| 条件 | 报错或检查点 | 怎么处理 |
|---|---|---|
| 同一尺寸字段同时从独立 CLI 与 compilation_config 提供 | EngineArgs 抛 ValueError，含 mutually exclusive；同值也不合并 | 每个字段只选一个入口；来源 41 |
| 图启用时，显式最大值为 0/负值，或显式空列表 | 分别触发最大值至少为 1、列表至少含一项的断言 | 关闭图用 NONE / 主 eager；尺寸用正整数，来源 43 |
| 显式上限与经预算过滤、去重及 SP 处理后的表不一致 | ValueError，含 should be consistent with the max value | 按有效表的最大档设置，或只给表让它派生上限；来源 43 |
| 图档位拼错，或 CLI 容器传整数 | 图档位按枚举名查找失败；CLI JSON 对象验证不接受 LLM 的整数快捷形式 | 使用五个合法字符串之一与 JSON 对象；来源 39、46 |
| 整趟 decode 的 MTP 对齐后无有效档，或 q 与 TP 的较大值不能同时整除两者 | ValueError；对齐不会自动求最小公倍数 | 调整草稿数/尺寸或关闭 sequence parallel；来源 54 |
| 设成 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台在配置阶段抛 `ValueError`，说明两者不兼容，并建议改看 plog | 调试用同步执行时先关图，或改用日志 [C14] |
| 捕获错误含 `Insufficient_Stream_Resources` 或 `Stream resources are insufficient`，或同时含 `207008` 与 `stream resource` 文本 | 包装层忽略大小写匹配这些特征并重新包装错误，提示缩小捕获尺寸表、降低最大尺寸或改用 `FULL_DECODE_ONLY`；仅有错误码不足以匹配 | 按提示减尺寸；同时确认 HDK / CANN 版本 [C15] |
| 启动窗口之外触发捕获 | 上游的捕获合法性检查抛 `RuntimeError`，说「在不合适的时机捕获」 | 正常路径不会遇到；遇到说明分派器交出了没录过的描述符 [C8] |
| DEBUG 级别下回放，直接位置参数中的 Tensor 地址和录制时不同 | 包装层断言失败，打印期望与实际地址；不覆盖所有输入结构 | 检查调用方是否换了这些输入缓冲 [C17] |

以上都是源码里的检查点，没有在 NPU 上故意触发过。[I]

### 开销和什么时候别开

- **启动**：要录的每个尺寸都得跑一遍空批次；上游 `capture_model` 录完会打印耗时和占用的显存。本库缺这套部署的启动日志，7 张图具体多大、录多久，待核。
- **运行**：补齐会让一部分位置空跑，账在[多条请求](concurrent-requests.md#先补到自己这组的图尺寸)；混合轮完全用不上图，这一轮的收益为零。[D]
- **什么时候比较 eager**：对本部署的 FULL_DECODE_ONLY，prefill 占比高会减少图命中，并发变化还影响补齐开销；实际损益需测量，不能仅凭形状不整齐断言图一定更慢。排查精度或 hang 时可用 `--enforce-eager` 做对照，但它同时改变编译与图相关路径。故障消失后仍需逐项控制变量，并核对实际算子，不能把后端切换当成只关闭同一组融合的实验。
- 本页所有结论都来自配置与源码，没有 NPU 实测；任一档的实际快慢要用同一批次分别测启动成本、回放命中比例、补齐浪费和端到端时延。[D]

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**本页 GLM 双机七档算例用含 GLM 代码的专用镜像 `db701c1f`（与维护分支 `2c59ff10` 分别核对）。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| `torch.compile` 分段图 / `ACLGraph` / `npugraph_ex` 三层 | `simple_compile_backend="eager"`；`AscendCompiler` 路由 `npugraph_ex` / `fusion_pass`；`ACLGraphWrapper` 录放；`FULL` 清空 `splitting_ops` | 同 `v0.23.0`；热身与捕获间新增 kernel warmup 与 super kernel 选项 [C27][C28] | `platform.py#L1315-L1355` 延续 `NONE`/`PIECEWISE` 关 `npugraph_ex`、`FULL` 清空 `splitting_ops`；`compiler_interface.py` 支持 Triton 图跳过缓存与静态核黑名单 | `platform.py#L1520-L1560`、`compiler_interface.py#L189-L350` 延续三层关系与 `NONE` 同步关闭 `static_kernel`/`super_kernel` |
| `cudagraph_mode` 与可更新图 | 五档，默认 O2 填 `FULL_AND_PIECEWISE`；固定 `replay()` | 同 `v0.23.0`；捕获报错多识别旧 HDK `Alloc sq cq fail` | `acl_graph.py#L297` 在 `FULL` + `use_updatable_graph(attn_backend)` 下启用可更新图；`breakable` 路径放宽部分分段限制 | `acl_graph.py#L305` 延续可更新图（仅限 `AscendAttentionBackend` 子类，SFA/GDN 不满足）与 ENPU/EAGLE 顺序条件 |
| `cudagraph_capture_sizes` 与上限注入 | Ascend 注入 `min(N×q, 512)`；显式表过滤排序；整趟 decode 做 MTP 对齐 | 后端解析新增非 V2 Runner 才做 MTP 对齐 | 注入 `reduced_cg_cap` 后截断补入并交上游重算；TP>1 且开 SP/共享专家 DP/DSA-CP 时筛为 TP 倍数 | `platform.py#L1505-L1515` 延续 TP 倍数筛选；上游自动上限对 Blackwell 截断 1024，Ascend 仍维持 `min(N×q, 512)` |
| `enforce_eager` 与 GLM 草稿禁图 | `enforce_eager=True` 同时置编译与图为 `NONE` 并关 `npugraph_ex`；社区有 GLM 草稿禁图保护 | 同 `v0.23.0` | 同 `v0.23.0`；`NONE` 分支同时关闭 `npugraph_ex` / `static_kernel` / `super_kernel` | 同 `v0.30.0`；三层关闭与 GLM 草稿保护一致 |

`v0.30.0` 与 `main` 中，用户同时未指定最大档与 `cudagraph_capture_sizes` 时，Ascend 提前注入 `min(N×q, 512)`，将 `reduced_cg_cap` 截断并补入候选列表后再清临时上限交上游重算，避免漏掉非步长整倍数的上限档；因 Ascend 先行注入，上游「上限仍为 `None`」分支的额外自动补档不会直接套用到本部署。可更新图的同步与 `update`/`replay` 顺序在 ENPU / EAGLE draft 下的条件见 [ACL graph](acl-graph.md#版本差异)；固定 `use_updatable_graph` 明确要求传入后端是 `AscendAttentionBackend` 的子类，而 `AscendSFABackend` 与 `AscendGDNAttentionBackend` 继承的是上游基类，不满足该判据 [D]。

### 源码位置

行号与 commit 见页末来源，本表只给落点。

| 看什么 | 位置 |
|---|---|
| 三档与两个组合档的定义 | 上游 vllm/config/compilation.py 的 CUDAGraphMode |
| 分段切在哪里 | 上游 vllm/config/compilation.py 的 _attention_ops 与 set_splitting_ops_for_v1 |
| 默认档位与尺寸表 | 上游 vllm/config/vllm.py 的优化档预设与 _set_cudagraph_sizes |
| 补齐表、描述符、建索引与分派 | 上游 vllm/v1/cudagraph_dispatcher.py |
| 关掉上游编译、两个接入点、档位与切分清单 | vllm_ascend/platform.py |
| 捕获与回放的包装、错误提示 | vllm_ascend/compilation/acl_graph.py |
| 启动期热身与捕获 | `vllm_ascend/worker/worker.py` 的 `compile_or_warm_up_model` |
| 本轮是否整齐、本地补齐、整图参数更新 | `vllm_ascend/worker/model_runner_v1.py` |
| 草稿模型强制 eager | `vllm_ascend/spec_decode/llm_base_proposer.py` |
| xlite 开关、融合开关默认值 | `vllm_ascend/ascend_config.py` 的 `XliteGraphConfig`、`enable_npugraph_ex` |
| 编译后端选融合还是 torchair | `vllm_ascend/compilation/compiler_interface.py` 的 `npugraph_ex_compile`、`fusion_pass_compile` |
| 四个融合 pass 与它们的开关 | `vllm_ascend/compilation/graph_fusion_pass_manager.py` 的 `configure` |

**还需要的设备证据。** 7 张图的捕获耗时和显存占用需要本部署启动日志；回放与 eager 的性能比较需要相同输入负载的设备测量；后端持久缓冲的源码读写路径还应通过多轮、变并发和投机接受/拒绝用例验证。本页没有这些 NPU 实测结果。

元数据与编译适配的补充来源：79 是 npugraph_ex/torchair 选项适配；80 是压缩索引器持久缓冲与原地刷新；81 是 GDN 整齐投机 decode 元数据复制与空行填充；82 是 SFA 引用公共元数据；83、84 是活跃请求块表提交。来源 85–88 依次给出 main 可更新图判据、SFA 类和 GDN 两层继承关系。它们分别支持上述具体路径，不代表所有模型、设备后端或图模式已做正确性验收。

来源 89–91 补齐三个社区快照的编译配置默认与硬件限制；92 是 main 的热身到捕获顺序；93 是 main 的旧 HDK 与 stream 资源错误重包装。

捕获范围与编译结构要分别判断。`0fc695fc` 的 `compilation.py` 1108–1130 行中，在 `VLLM_COMPILE` 模式、不走 attention 量化融合切分分支且 `splitting_ops is None` 时，默认保留分段 FX 图，在外层捕获整图（来源 2）。`db701c1f` 的 `platform.py` 593–627 行中，昇腾需要分段的路径会调用上游配置；另一条整图分支主动把 `splitting_ops` 设为空（来源 13）。这是两条具体实现路径，不能由 FULL 模式的名字统一推断切分方式。

`db701c1f` 的投机解码自动判定要求已计算位置数不小于提示词长度（来源 19，`model_runner_v1.py` 2915–2940 行）。注释以最后一块恰有草稿数加一个位置为例，说明形状整齐仍可能在算提示词，错误回放会读到未填好的补齐行和别的请求遗留数据。调用方显式覆盖整齐判定是另一条路径。上述风险来自该快照的源码注释，尚无本部署的 NPU 复现结果。

分派前提见来源 7 的 0fc695fc cudagraph_dispatcher.py 267–285；强制 eager 直接返回 NONE 见来源 19。允许模式集合为空先断言，检查通过后仍须匹配描述符。来源 23 的 db701c1f llm_base_proposer.py 220–236 只强制关闭 GLM 草稿图，不改变目标模型设置。新 Xlite 的架构范围见 921ccc52 官方图模式指南；预算取小与 TP 对齐见同快照 [xlite.py 374–379 行](https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/vllm_ascend/xlite/xlite.py#L374-L379)，[769 行及 840–853 行](https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/vllm_ascend/xlite/xlite.py#L769-L853)把该预算用于本步 DP 最大值比较。这条新版路径独立于旧 GLM 的 ACL 分派。

- 来源 38：vllm-ascend@db701c1f，vllm_ascend/compilation/acl_graph.py，L138–L158。

参数参考的补充来源：39 为图字段与默认；40、41 为 CLI 注册和尺寸入口互斥；42 为 Python LLM 的整数兼容；43 为基线完整尺寸派生；44 为主 eager 默认；45、46 为点号参数与 JSON 类型解析；47 为 GLM Ascend 提前注入上限；48、49 为新版尺寸分支；50、51 为新版后端解析与 MTP 对齐；52、53 为 main Ascend 调整；54 为基线对齐；55 为优化预设只填缺省字段。来源 56–58 核对社区三版的 GLM 系列草稿禁图保护，主模型与草稿设置仍分别解释。来源 94–104 分别核验 `v0.30.0`（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）的 `platform.py`、`acl_graph.py`、`compiler_interface.py` 及上游 `compilation.py` / `vllm.py`。
