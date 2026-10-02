---
id: graph-mode-layer
title: graph mode：录一次执行次序，之后整串回放
type: feature
summary: 从 Host 逐个提交任务讲起，说明 graph mode 录的是执行次序而不是结果；区分编译改写、捕获与回放，列出官方双机上 FULL_DECODE_ONLY 录了哪 7 张图、一轮回放哪一张的五条判据，以及回放前必须更新什么。
aliases: [ACL Graph, ACLGraphWrapper, AscendCompiler, 图模式, graph mode, piecewise, 分段回放, 整趟回放, xlite, 单算子模式, eager 模式, 捕获, 回放]
chapters: ["16"]
order: 30
sources:
  - vllm@0fc695fc:vllm/config/compilation.py#L55-L92
  - vllm@0fc695fc:vllm/config/compilation.py#L1108-L1150
  - vllm@0fc695fc:vllm/config/vllm.py#L215-L289
  - vllm@0fc695fc:vllm/config/vllm.py#L1618-L1682
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L76-L158
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L209-L236
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L262-L312
  - vllm@0fc695fc:vllm/compilation/monitor.py#L88-L100
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6525-L6588
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L130-L136
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L176-L181
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L880-L886
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L593-L632
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L633-L644
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L26-L87
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L170
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L216-L259
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2910-L2967
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2778-L2835
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3800-L3816
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5330-L5340
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L220-L236
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L661-L670
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L180-L235
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L138-L258
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L150-L290
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L748-L778
  - vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L286-L302
  - vllm@0fc695fc:vllm/config/vllm.py#L1050-L1062
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L586-L636
  - vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L155-L217
  - vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L280-L297
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2240-L2250
  - vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L44-L69
  - vllm-ascend@db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L44-L75
verified: []
evidence: "C"
relations:
  - {to: npu-model-runner, kind: builds-on, note: Runner 决定本轮张量、模式与描述符}
  - {to: ops-and-kernels, kind: builds-on, note: 先理解算子和设备任务的提交}
  - {to: npugraph-ex, kind: alternative-to, note: 另一条路径：改写计算图本身，不是录执行次序}
contradicts: []
updated: "2026-09-29"
origin: seed
---

**graph mode**（图模式）把一次前向里成百上千次「Host（CPU 侧的执行进程）把任务交给设备」的动作按次序录成一张图，之后遇到形状相同的一轮，一次提交就让设备照录好的次序重跑一遍。它省下的是提交次数，计算量一点没少。

## 同一串任务，为什么要一轮一轮重复提交

模型结构定下来之后，真正跑起来的是一长串设备任务：每一层的矩阵乘、归一化、注意力、专家计算，都要由 Host 逐个交给 NPU，告诉它算什么、数据在哪。这种「交一个、算一个、再交下一个」的执行方式叫 **eager**（单算子执行）。

问题出在 decode（每轮只产出一小把 token 的阶段）。[那条请求](one-request.md)一轮只带 4 个 token 位进模型，每张卡却仍要走完 45 层；这样一次前向，每张卡有 218 次[集合通信](collective-communication.md)和几百个算子，而数据量只有几 MiB。这一轮的耗时更可能由这几百次提交和通信各自的固定开销决定，而不是由算了多少决定（次数与字节见[一次前向的通信账](one-request.md#一次前向的通信账)）。提交开销究竟占多少，随模型、批次大小和硬件而变，不是一个固定比例。

更关键的是：这几百次提交，每一轮都几乎一模一样。层数没变、算子种类没变、次序没变，变的只是里面的数值、位置和块表。

```wiki-diagram
file: graph-mode-record-replay
```

所以办法很直接：首次在启动期按固定尺寸跑一遍，把这一串任务的次序记下来（叫**捕获**），之后形状相同的每一轮只提交一次，让设备照记录重跑（叫**回放**）。记下来的那一串就是一张**图**。

## 录下来的是执行次序，不是结果

初学这一层最容易看反的一点是：图里存的不是算出来的数，而是「先做什么、后做什么、各自读写哪块地址」。所以回放时结果照样会变——本轮的输入写进那几块固定地址，设备按原次序重算一遍，得到的是本轮的结果。

一张图也不对应一条请求。一条请求要走很多轮，一轮里又同时服务很多条请求；图对应的是**某一种形状的一轮**，和请求边界没有关系。

真正落到执行上的是三个不同动作，它们常被一起叫作「图」，但处理的对象不同：

| 动作 | 处理的对象 | 改变或保留什么 |
|---|---|---|
| 编译与图改写 | 运算表示、形状约束、算子之间怎么连 | 可以拆开或融合运算、换一个执行实现，改的是「算什么」 |
| 捕获 | 一段受支持的设备任务序列及其依赖 | 只记录可复用的执行次序，不改算什么 |
| 回放 | 已录好的图 + 本轮准备好的数据 | 按记录重算，得到本轮的结果 |

算子融合（把几个小运算并成一个）和回放可以同时开，但它们是两件事：前者减少算子个数，后者减少提交次数。本页只讲后者，前者见[编译期图融合](npugraph-ex.md)。

## 省的是提交次数，代价却要单独付

收益的结构由此决定：**它几乎全部落在 decode 上**。decode 每一轮形状高度重复，录一次能用很多次；prefill（把提示词一次算完的那一轮）的 token 数几乎每次都不一样，录了也很难再命中。

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

还有两个组合档：`FULL_DECODE_ONLY` 表示整齐的 decode 轮用 FULL、其余轮用 NONE；`FULL_AND_PIECEWISE` 表示整齐的 decode 轮用 FULL、混合轮用 PIECEWISE，它也是什么都不配时的默认档。之所以把 decode 单独拎出来，是因为只有 decode 轮的形状足够整齐，录了才用得上。

## 官方双机上录了哪 7 张图

本部署（[部署前提](glm-5-3-flash-two-node.md#部署前提)）把档位配成 `FULL_DECODE_ONLY`，并显式给出 7 个捕获尺寸——这 7 个数是这套命令写死的，不配的话程序会按并发上限自己算一份，所以别把它当成所有部署通用的尺寸表。选这一档的后果是：只为「整齐的 decode 轮」建索引，混合轮一张图都没有，一旦混进 prefill 就整轮 eager。

尺寸为什么最大到 128，由这套部署的两个上限决定：

```calc
title: 最大的那张图为什么是 128 个 token
一条请求一轮占几个位置 = 1 个已确定的 token + 3 个草稿 = 4
最大捕获尺寸 = 32 条请求 × 每条 4 个位置 = 128
```

这里的 3 个草稿来自 MTP（模型自带的多 token 预测层，每轮先猜 3 个再一起验证），32 是同时在跑的请求数上限；这两个数和同一笔账在[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)里也出现过，本页不另立一套。于是 7 个尺寸对应的不是 7 个请求数区间，而是整齐的 7 档并发：

| 捕获尺寸（token 位） | 4 | 8 | 16 | 32 | 64 | 96 | 128 |
|---|---|---|---|---|---|---|---|
| 对应的 decode 请求数 | 1 | 2 | 4 | 8 | 16 | 24 | 32 |

一条请求带 4 个位置，也正是它需要一路录到 128 的原因：不开 MTP 时 32 条请求只要 32 这一档。草稿层自己**不进图**——vLLM Ascend 对「GLM 系列 + 投机解码」这个组合把草稿模型固定切回 eager，三遍草拟每轮都按实际宽度逐个提交。这两条落到具体一轮是什么样，见[那条请求的第二圈和第三圈](one-request.md)。

## 这一轮回放哪一张图：五条判据

每一轮开始前，模型运行器（Runner，负责准备本轮张量、再调用模型的那一层）先判断这一轮能不能用图、用哪一张，把结论（运行模式 + 一个描述符）放进本轮的执行上下文。判据按顺序有五条，全过才回放：

1. 所有请求的提示词都算完了吗（没有谁还在 prefill）？
2. 这一轮里排得最多的那条请求，也只有 4 个 token 位吗？
3. 总 token 数正好等于 4 × 请求数吗？（第 2、3 条合起来才等于「每条都是 4」）
4. 总 token 数没超过最大捕获尺寸 128 吗？
5. 另一个 [DP 组](data-parallel.md)（各自调度、各有 KV 池的一台机器）这一轮也过了前四条吗？

第五条是双机部署特有的：两组每轮要先交换「我这边多宽、能不能用图」，模式取两边较低值——三档在枚举里就是按 NONE < PIECEWISE < FULL 排的数值，取小自然就退到最保守的那一档。一组混进 prefill，两组这一轮都退回 eager，本来能用图的那组也用不上。补齐到哪一档、两组怎么对齐、空闲组为什么还要陪跑，账在[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)里，本页不重算。

描述符里不止有 token 数，还有补齐后的请求数、「是不是整齐的 decode」，以及有没有用 LoRA（本部署不用）。所以**两轮 token 总数相同，不足以说明它们回放的是同一张图**：两轮的 token 总数同样是 64，16 条整齐 decode 回放的是 64 那张图，而混进 prefill 的一轮在这一档配置下根本没有图，直接 eager，也不按图尺寸补齐。分派时看的还有 LoRA 状态和有没有强制 eager。

## 包装器内部：透传、回放还是现录

上面那套判断做完，才轮到真正管捕获和回放的那层包装——昇腾上的这套实现叫 [ACL Graph](acl-graph.md)。它包在整个模型外面，每一轮只做三件事，自己不判断这一轮该不该用图。

```wiki-diagram
file: graph-mode-wrapper-flow
```

值得单独记住的是最后一个分支：**服务期遇到没录过的形状，不会临时补录**。捕获只在启动期那个窗口里合法，窗口之外触发捕获会被合法性检查直接拒绝。正常情况下也轮不到它报错——分派器只会交出已经录过的描述符。

因此排查「为什么这一轮没走图」，要查的是上游怎么给这一轮定的模式和描述符，不是查这层包装。

## 回放之前，必须先把数据写对

图记住的是次序和地址，不是内容。回放前得保证本轮的输入已经写进录制时用的那几块地址；这件事不归包装层管，它假定外部已经准备好，只在调试日志级别下检查一遍地址有没有变。

每轮真正会变、又必须同步更新的有：每条请求的位置、已算长度、[block table](block-table.md)（记录这条请求的 KV 放在哪些块里的表），以及各注意力后端自己的元数据。它们如果还停在上一轮的值，回放出来的就是错的结果，而不是报错。

Runner 里确实有一条「在侧流上刷新整图注意力参数」的路径，但**本模型走不到**：它要求既不用稀疏注意力也不用压缩，而 GLM-5.3-Flash 用的是[稀疏 MLA](sparse-attention.md)。这条路径的调用位置还分两种情况：默认（没开 ENPU 这个昇腾侧开关）时它发生在执行之后，开了 ENPU 才挪到执行之前。KDA（这个模型里那 34 层[线性注意力](linear-attention.md)）与稀疏 MLA 的元数据到底怎样进到固定地址里，属于本页的待核项，写在页末。

## 启动时录、运行时放

启动的最后一段专门干这件事：先跑几遍空批次热身——热身的尺寸来自显式指定要编译的尺寸，再加上那些没有被任何捕获尺寸覆盖到的编译区间端点——然后把要录的尺寸从大到小逐个跑一遍并录下来。**等第一条请求进来时，图早就录完了。**

常被当成排查第一刀的**强制 eager**，关掉的不止录图：上游一见到它，就把编译模式和图档位一起设成 NONE，昇腾平台再顺手关掉自己的编译后端。也就是说，编译期的改写与录图**一起**没了；本部署又没有单独指定要编译的尺寸，所以热身那一段实际上没有尺寸可跑，录图这一步也整个跳过。

所以「打开强制 eager 问题就消失」只能说明问题出在编译或图这两层之一，不能直接断定是录图。要把两层分开，得逐个关掉那几个融合开关而保留图——只关 npugraph_ex 不够，它只是换个编译后端；只把图档位设成 NONE 也不够，昇腾在这种情况下同样会关掉编译。

最后区分三层证据，别混着说：配置里开了图模式、启动时录完了图、某一轮真的回放了，是三件不同的事。本库没有 NPU 实测，所以不把 GLM 的 decode 轮数直接写成同样次数的成功回放，也不给收益数字。

## 旁边的另外两条路：一条默认开着，一条默认关着

- **编译期融合按固定源码是开着的**，而且和本页讲的回放叠在一起用。官方命令没有关它，这一档配置又不需要分段编译，模型也带着编译装饰器进来，于是编译走昇腾自己的后端。它改的是「算什么」（由一串 pass 改写计算图、替换算子实现），回放改的是「怎么提交」，两者互不替代。**npugraph_ex 只是这一层默认用的编译后端，不等于融合本身**：同一批登记好的融合规则（归一化与量化、qk 归一化与 RoPE、AllReduce 与 RMSNorm、乘加）默认由这个后端来应用；把它关掉，才轮到昇腾自己的 pass manager 来应用——同一批规则、换人应用。这几项各有自己的开关且默认全开。细节见 [npugraph-ex](npugraph-ex.md)。到底有多少改写真正匹配上，要看启动日志，本库没有实测。
- **torchair** 不是另开的一条路，而是融合这条路的兼容退路：只有 npugraph_ex 这个包导入失败时才落到它。
- **xlite** 才是默认关着的那条：要在额外配置里单独打开；它的执行进程和模型运行器只是在昇腾原有的两个上薄薄包一层。打开后平台会把主模型的档位降到 `FULL_DECODE_ONLY`，或者干脆关掉图。

本页的数字只针对回放这一层。xlite 没有启用、也没有实测数据，不能把这里的 GLM 数字当成它的效果。

## 常见误解

- **「开了图模式，整条请求都在回放图。」**——本部署只给整齐的 decode 轮录了图。prefill 那一轮、三遍草拟、任何混进 prefill 的轮次都是 eager。
- **「图模式省的是计算。」**——一次计算都没省，省的是把任务交给设备的次数；所以它在算得少、算子却一个不少的 decode 上才明显。
- **「包装层自己决定这一轮用不用图。」**——它不决定，只照上游给的模式和描述符执行。
- **「录图是第一条请求来的时候才做的。」**——启动期就按尺寸全部录完；服务期遇到没录过的形状不会补录。
- **「两轮 token 数一样，就是同一张图。」**——描述符还含请求数和是否整齐，混合轮和 decode 轮凑出同样的 token 数也不共用图。
- **「平台配置里写着关掉编译，说明昇腾只能逐个提交。」**——关掉的只是上游默认的那条编译路径，昇腾换成了自己的编译后端和图包装，图模式照样有。
- **「图模式和编译期融合是一回事，关一个等于关另一个。」**——是两层：融合改「算什么」、回放改「怎么提交」。本部署两层都在用，而强制 eager 会把两层一起关掉。

## 对照源码

### 怎么开

官方双机命令用 `--compilation-config` 把 `cudagraph_mode` 设成 `"FULL_DECODE_ONLY"`，并显式给出 `cudagraph_capture_sizes` 的 7 个值；完整命令与其余参数在[部署页](glm-5-3-flash-two-node.md#怎么开)统一维护。草稿侧那条 `enforce_eager: true` 写在 `--speculative-config` 里，只管草稿模型，主模型照样捕获 decode 图。[C25]

不配 `cudagraph_mode` 时，默认优化档 `-O2` 的预设是 `FULL_AND_PIECEWISE`。不给 `cudagraph_capture_sizes` 时尺寸表也会按 `max_num_seqs` 与草稿数自动算出来，推导见 [ACL Graph](acl-graph.md)；本部署两项都显式给了，走不到那条默认路径[D]。

昇腾不走上游 `torch.compile` 的默认路径：平台类里 `simple_compile_backend` 就是 `"eager"`，同行注释写明禁用 `torch.compile()`。[C10] 图能力换成两个接入点：`get_compile_backend()` 返回自己的 `AscendCompiler`，`get_static_graph_wrapper_cls()` 返回 `ACLGraphWrapper`。[C11]

档位与切分清单的对应也在平台里定：`NONE` 连编译模式一起关；需要分段时调用上游的 `set_splitting_ops_for_v1` 并追加 `vllm::mla_forward`、`vllm::dsa_forward`；`has_full_cudagraphs()` 为真（本部署这一支）时把 `splitting_ops` 清空。[C13] 上游那份默认清单就是 `_attention_ops` 里的各类 attention 算子。三档与两个组合档的定义、`decode_mode()` / `mixed_mode()` 的取值都在 `CUDAGraphMode` 上——名字沿用了 CUDA 的术语，昇腾路径照用同一个枚举，在昇腾仓库里是找不到另一套档位定义的。分工也按这条线划：档位定义、每轮选档、按批大小分档与补齐都归上游，昇腾只补平台接入点、录图的额外限制（例如 A5 设备在分段档上还要再裁一遍尺寸）和回放期让注意力参数正确的机制。

整个模型在权重加载后被包了一层 `ACLGraphWrapper(runtime_mode=FULL)`；建索引时按 `uniform_decode_query_len`（本部署 = 1 + 3 个草稿 = 4[D]）过滤尺寸，并为每档算出 `num_reqs`。[C6] 每轮的 `uniform_decode` 判定与本地补齐在 Runner 里，补齐表与描述符构造在分派器里。[C19] GLM 系列加投机解码时把草稿模型的 `use_cuda_graph` 强制置假，并打一条 warning 说明等价于给草稿配 `enforce_eager: true`。[C23] xlite 的开关是额外配置里的 `xlite_graph_config`，`enabled` 与 `full_mode` 默认都是假。

**编译期融合在这套命令下是开着的。** 昇腾编译配置里 `enable_npugraph_ex` 默认为真，只有 310P 会被强制关掉[C31]；平台只在图档位为 `NONE` 或需要分段编译时把它置假，`FULL_DECODE_ONLY` 走的是清空 `splitting_ops` 那一支，不动这个开关。默认优化档的编译模式是 `VLLM_COMPILE`，GLM 主模型带 `@support_torch_compile`[C34]，编译后端又是 `AscendCompiler`，所以开关为真时走 `npugraph_ex_compile`[C33]；只有 `import npugraph_ex` 失败才落到 torchair 后端。

**关掉 `enable_npugraph_ex` 并不等于关掉融合。** 开关为假时 `AscendCompiler` 改走 `fusion_pass_compile`，改由编译配置里的 pass manager 把同一批规则作用到计算图上[C35]；这个 manager 默认挂着 `fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_allreduce_rms`、`fuse_muls_add` 四个融合 pass，四个开关都在 `ascend_compilation_config` 里、默认都取真[C36]。要在保留图的前提下排除融合层，得把这几个开关逐个关掉；本库没有实测，只能按源码说到这一步。

**强制 eager（`--enforce-eager`）关的是两层。** 上游在配置阶段就把 `mode` 和 `cudagraph_mode` 一起设成 `NONE`，日志原话是等价于 `-cc.mode=none -cc.cudagraph_mode=none`[C30]；昇腾平台随后也把自己的编译模式关掉，并在图档位为 `NONE` 时置假 `enable_npugraph_ex`。`compile_sizes` 默认为空，所以热身循环这时没有尺寸可跑[I]，末尾的捕获也整个跳过[C18]。

### 会报什么错

| 条件 | 报错或检查点 | 怎么处理 |
|---|---|---|
| 设成 `ASCEND_LAUNCH_BLOCKING=1` 又没关图 | 平台在配置阶段抛 `ValueError`，说明两者不兼容，并建议改看 plog | 调试用同步执行时先关图，或改用日志 [C14] |
| 捕获时设备 stream 资源不足（错误码 `207008` 等特征） | 包装层识别出这个特征，把原始错误重新包装，提示缩小捕获尺寸表、降低最大尺寸或改用 `FULL_DECODE_ONLY` | 按提示减尺寸；同时确认 HDK / CANN 版本 [C15] |
| 启动窗口之外触发捕获 | 上游的捕获合法性检查抛 `RuntimeError`，说「在不合适的时机捕获」 | 正常路径不会遇到；遇到说明分派器交出了没录过的描述符 [C8] |
| 调试日志级别下回放，输入地址和录制时不同 | 包装层的断言直接失败，打印期望与实际地址 | 说明上游没把本轮数据写回固定地址 [C17] |

以上都是源码里的检查点，没有在 NPU 上故意触发过。[I]

### 开销和什么时候别开

- **启动**：要录的每个尺寸都得跑一遍空批次；上游 `capture_model` 录完会打印耗时和占用的显存。本库缺这套部署的启动日志，7 张图具体多大、录多久，待核。
- **运行**：补齐会让一部分位置空跑，账在[多条请求](concurrent-requests.md#先补到自己这组的图尺寸)；混合轮完全用不上图，这一轮的收益为零。[D]
- **什么时候别开**：请求形状长期不整齐（prefill 占比高、并发抖动大）时，收益会被补齐和退回吃掉[I]。排查精度或 hang 问题时常用 `--enforce-eager`，但它同时关掉编译期融合和图，问题消失只能把范围缩到这两层；要分清是哪一层，得逐个关掉那四个 `fuse_*` 开关而保留图，只关 `enable_npugraph_ex` 换来的仍是同一批融合[D]。
- 本页所有结论都来自配置与源码，没有 NPU 实测；任一档的实际快慢要用同一批次分别测启动成本、回放命中比例、补齐浪费和端到端时延。[D]

### 版本差异

按知识库固定快照核对：v0.23 维护分支为 Ascend 2c59ff10 / vLLM 0fc695fc；v0.26 指 2026-09-17 的 rc 快照 Ascend 2ed6cbba；main 为 Ascend baa023ad。本页 GLM 算例用含 GLM 代码的专用镜像 Ascend db701c1f，与 v0.23 维护快照分别核对（该维护分支不含 GLM 模型代码）。

| 检查项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 两个接入点与 `simple_compile_backend` | 有，三处逐行一致 | 相同 | 相同 |
| 包装层的四步流程（透传 / 查索引 / 录 / 放） | 有 | 有，行号后移 | 有，另加可更新图分支 |
| 捕获失败的提示 | 只识别 stream 资源不足一种 | 多识别旧 HDK 的 `Alloc sq cq fail`，提示升级到 25.5.1 | 与 v0.26 同 |
| 捕获时的 super kernel 优化 | 无 | 新增，按昇腾编译配置开关[C27] | 有 |
| 热身与捕获之间 | 跑完空批次直接捕获 | 中间多一步 kernel warmup[C28] | 与 v0.26 同 |
| 回放路径 | 固定 `replay()` | 相同 | 某些注意力后端改走可更新图；回放日志文案也换了[C29] |
| GLM 草稿强制 eager | 有 | 有 | 有 |
| `enable_npugraph_ex` 默认值 | 真 | 真 | 真 |

main 的可更新图分支只对特定注意力后端生效，GLM 用的稀疏 MLA 与 KDA 是否落进这一支，没在本轮核实。

### 源码位置

行号与 commit 见页末来源，本表只给落点。

| 看什么 | 位置 |
|---|---|
| 三档与两个组合档的定义 | 上游 `vllm/config/compilation.py` 的 `CUDAGraphMode` |
| 分段切在哪里 | 上游 `vllm/config/compilation.py` 的 `_attention_ops` 与 `set_splitting_ops_for_v1` |
| 默认档位与尺寸表 | 上游 `vllm/config/vllm.py` 的优化档预设与 `_set_cudagraph_sizes` |
| 补齐表、描述符、建索引与分派 | 上游 `vllm/v1/cudagraph_dispatcher.py` |
| 关掉上游编译、两个接入点、档位与切分清单 | `vllm_ascend/platform.py` |
| 捕获与回放的包装、错误提示 | `vllm_ascend/compilation/acl_graph.py` |
| 启动期热身与捕获 | `vllm_ascend/worker/worker.py` 的 `compile_or_warm_up_model` |
| 本轮是否整齐、本地补齐、整图参数更新 | `vllm_ascend/worker/model_runner_v1.py` |
| 草稿模型强制 eager | `vllm_ascend/spec_decode/llm_base_proposer.py` |
| xlite 开关、融合开关默认值 | `vllm_ascend/ascend_config.py` 的 `XliteGraphConfig`、`enable_npugraph_ex` |
| 编译后端选融合还是 torchair | `vllm_ascend/compilation/compiler_interface.py` 的 `npugraph_ex_compile`、`fusion_pass_compile` |
| 四个融合 pass 与它们的开关 | `vllm_ascend/compilation/graph_fusion_pass_manager.py` 的 `configure` |

**待核（从正文集中到此）。**

- 稀疏 MLA 与 KDA 的注意力元数据在 FULL 图回放时怎样写进固定地址。Runner 那条整图参数更新路径已确认在本模型上不执行[C20]，剩下要追的是这两个后端各自的元数据构造过程。
- 7 张图占多少显存、录完用多久。上游捕获函数会打印这两项，需要一份本部署的启动日志才能填。
- main 上的可更新图分支是否覆盖 GLM 用的两种注意力后端。
- 任何加速比。本库没有 NPU 实测数据，本页不给回放与 eager 的耗时对比。
