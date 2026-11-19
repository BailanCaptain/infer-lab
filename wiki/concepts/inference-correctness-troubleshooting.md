---
id: inference-correctness-troubleshooting
title: 输出异常排查：同样的问题，回答为什么变了
type: concept
origin: gap
summary: >-
  完成一次从回答异常、输入编号差异到修正模板和回归验证的排查；再换成输入相同的情况，沿首次分歧区分采样、数值和状态，覆盖乱码、重复、空输出、NaN
  与质量回归。用固定评测集和业务指标检验变更后的任务质量。
aliases:
  - 推理正确性
  - 输出不一致
  - 同输入结果不同
  - 乱码
  - 输出重复
  - 空输出
  - NaN
  - 精度回归
  - 质量回归
  - 数值异常
  - 首次分歧
  - token 对齐
  - 量化精度排查
  - Runtime Guard
  - runtime_config
  - dump_kv
  - token_repeat
  - logits_finite
chapters:
  - '19'
order: 6
sources:
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L228-L302'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L47-L166'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L695-L746'
  - 'vllm@0fc695fc:docs/usage/reproducibility.md#L1-L24'
  - 'https://huggingface.co/docs/transformers/chat_templating'
  - >-
    https://docs.vllm.ai/projects/ascend/en/main/user_guide/feature_guide/batch_invariance.html
  - 'https://github.com/vllm-project/vllm/issues/64048'
  - >-
    raw:sha256-a28c4479cb8576de061fe485dc0b2822395ead2da38946ef10cd3b152953b055.md#L1-L282
  - 'vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/renderers/hf.py#L731-L745'
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/sample/sampler.py#L17-L17
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/sample/sampler.py#L296-L301
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/detokenizer.py#L84-L89
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/detokenizer.py#L120-L135
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:docs/usage/reproducibility.md#L3-L20
  - >-
    raw:sha256-a3756f07a2b1726f8940f91b065c61e8d288657df4e16e3752a6599d6cd57191.md#L1-L362
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/runtime_guard.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/configuration/runtime_config.md
  - 'vllm-ascend@7d825229:vllm_ascend/batch_invariant.py#L124-L164'
  - 'vllm-ascend@7d825229:vllm_ascend/batch_invariant.py#L166-L189'
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/batch_invariance.md#L25-L41
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_v1.py#L913-L992'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L909-L933'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/batch_invariance.md#L25-L41
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/developer_guide/performance_and_debug/msprobe_guide.md
  - 'vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L99-L163'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/batch_invariant.py#L76-L162'
  - 'vllm-ascend@c09d3e20:vllm_ascend/batch_invariant.py#L95-L189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L975-L1085'
  - 'vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_guard/hooks.py#L18-L145'
  - 'vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_guard/detector/manager.py#L57-L95'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_glm53_reasoning.py#L21-L66'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L131-L165'
  - 'vllm@ba15685a:vllm/entrypoints/openai/chat_completion/serving.py#L137-L175'
  - 'vllm@ba15685a:vllm/v1/sample/sampler.py#L299-L365'
  - 'vllm@ba15685a:vllm/v1/engine/detokenizer.py#L84-L170'
relations:
  - to: inference-troubleshooting
    kind: builds-on
    note: 输出问题之外，按十类问题入口重新定位发生阶段
  - to: token
    kind: builds-on
    note: 核对分词器、模板与输入编号，解释同一句文字如何成为不同模型输入
  - to: sampling
    kind: builds-on
    note: 对齐采样与停止条件，区分随机选择和计算分歧
  - to: streaming-output
    kind: builds-on
    note: 编号相同而显示不同，继续追解码、停止字符串和解析返回
  - to: batch-invariance
    kind: builds-on
    note: 输入与采样固定后，检查批形状对数值及输出的影响
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-a3756f07a2b1726f8940f91b065c61e8d288657df4e16e3752a6599d6cd57191.md
  - >-
    raw/sha256-f4bea4fc94023f31f03f64d2e15e1eb05f2aec7fe44bd081dd53c83fad2258cb.md
---

**输出异常排查，是沿着“文字变成输入、计算选出编号、编号变回文字”的过程，找到第一处偏离预期的位置。** 先找分歧发生在哪里，才能判断该查模板、采样、计算还是返回。

## 同一句话，模型收到的东西一样吗

你把同一句问题发给两套服务，分别叫 **A** 和 **B**。A 回答正常，B 却多出奇怪标记，甚至答案完全不同。两边显示的模型名字相同，于是很容易怀疑新服务的计算有问题。

先看看模型真正收到什么。文字会被分词器拆成 **token（词元）**，每个 token 用一个整数编号表示；聊天服务还会套上**聊天模板**，把用户、助手和历史消息排成模型训练时认识的格式。模板、历史消息或分词器文件变了，输入框里同一句话也能变成不同编号。

```wiki-diagram
file: inference-correctness-layers
```

图把同一条消息经过两个模板后的结果排在一起。多出来的一格已经改变模型输入；这时先查模板，比直接比较最后的答案更有用。整个排查按**输入编号 → 贪心首次分歧 → 计算/状态/解析隔离 → 工具取证**四级漏斗推进，尽量把问题拦在最早的边界：

```wiki-diagram
file: inference-correctness-troubleshooting-fig-triage-funnel
```

下面先走完第一种情况：把输入编号对齐。

## 跟着一个例子，先把输入对齐

下面是一条**教学示意排查记录**，编号和数值均为假设。目标是比较同一问题在服务 A、B 的表现，不是要求所有模型每次都回答同一句话。

保存请求里的完整消息、系统提示、工具定义和多模态材料后，再保存模板展开结果与实际输入编号。示意中，A 收到 **[11, 23, 7]**，B 收到 **[11, 23, 9, 7]**。按从 0 开始的位置比较，前两个编号相同，位置 2 就不同；B 还多出一个位置。此时已经有足够依据先查输入路径，无需转储每一层计算。

进一步检查模板展开的文本，发现 B 在用户消息后多插入了一段控制标记，分词后正好对应多出的 9。下一次实验只对齐 B 的模板版本与渲染选项，权重、分词器、生成规则、输入消息和执行配置保持原样。实际排查还要保留这些文件与配置的标识，模型显示名称相同并不能代替核对。


模板调用还要记录是否显式指定 return_dict。兼容处理只在启用分词、且调用者未指定该选项时补入 false；显式指定的值会保留。若两套服务拿到的输入对象类型不同，应核对这项调用条件。

这项兼容处理针对返回对象的形式：所核实现的注释说明，Transformers v5 将 return_dict 默认值改为 true，启用分词的模板调用因此返回包含编码结果的 BatchEncoding，而下游可能期待直接接收整数编号列表。比较两套服务时，除了编号内容，还要记录 Transformers 版本及实际返回的对象类型。

现在把这个示意案例做到结束。两边都固定为每次选择处理后分数最高的候选，并保持执行条件一致；每种条件重复复现，得到下表所示结果。这里把编号 41、52、60 设为正常答案的输出，90 设为本例出现的异常标记；这些编号不是某个真实分词器的定义。随机生成时，还需要按下一节控制和评价抽样波动。

| 受控复现 | 实际输入编号 | 观察结果 |
| --- | --- | --- |
| A 的参考配置 | [11, 23, 7] | 输出 [41, 52, 60]，答案检查通过 |
| B 原配置 | [11, 23, 9, 7] | 输出先出现 90，答案检查失败 |
| B 只对齐模板与渲染选项 | [11, 23, 7] | 输出恢复为 [41, 52, 60]，答案检查通过 |
| B 在隔离环境恢复旧模板 | [11, 23, 9, 7] | 再次出现原异常 |

这比“换个配置好像正常了”多出了两层依据：**中间输入确实按预期改变，恢复原条件又能复现异常。** 在这组受控条件下，证据支持把原因定位为输入模板差异，而不是先怀疑量化或设备算错。随后恢复正确模板，再用多轮对话、含工具定义和特殊字符的固定样本检查输入、结束原因与任务质量，确认修正没有破坏其他格式。

如果对齐后输入相同、输出仍不同，这个案例就不能在这里结束。后面的章节专门处理这种变式；并不是说一次模板问题还必须同时归因于采样、缓存和量化。

对于图片或音频，即使文字编号相同，也要对齐媒体内容、预处理设置、裁剪/分块和顺序；它们同样属于模型输入。模板与分词的机制留在 [Token 页](token.md)，不从最终文字反推输入已经相同。

## 输入相同以后，先确认是不是在随机选择

模型会给下一个 token 的各个候选打分，这一排分数叫 **logits**。**采样**是按规则从候选中选出下一个编号：随机采样允许不同次运行选出不同候选；**greedy（贪心选择）**每次取处理后分数最高的候选。

现在换成“输入已相同，输出仍不同”的变式。先收集两边**最终生效**的采样设置，而不只比较请求 JSON：请求省略的值还会受到模型生成配置和服务默认值影响。对照实验在支持的设置内采用 greedy，统一停止条件、输出上限及约束；需要随机采样时，再固定请求种子并按分布评价结果。种子是控制随机数序列的起点，不能消除所有执行路径的数值差异。

若两边在相同输入、相同候选分数下选择了不同编号，先比较采样参数、随机数状态，以及分数上的惩罚和约束；若分数本来就不同，则继续追计算。**结构化输出**会在选择前屏蔽不符合格式的候选，同样要纳入对齐。详细规则见[采样](sampling.md)与[结构化输出](structured-output.md)。

固定上游混合采样路径以 temperature 小于 0.00001 选择 greedy 结果，否则采用随机采样结果。不能只检查 temperature 是否恰好等于零；还须确认请求进入的是这个混合分支。

整批请求都采用 greedy 时还有提前返回路径：先沿候选 token 维度取最大分数的编号，再将编号整理成一维列表。全 greedy 分支随后返回，跳过该 sample 方法后续的温度处理、保持最大值选择不变的处理器，以及按候选数量或累计概率筛选的 top-k、top-p 路径。这个顺序不证明分数进入该方法之前未经惩罚或约束；排查时仍须比较实际选择位置收到的分数及此前的处理条件。


## 为什么只找第一次分歧

现在把例子延长一点：A、B 输入已经相同，前三个输出都为 **[41, 52, 60]**，但第四个输出不同。模型生成下一个位置时，会把此前选出的内容作为历史；第四个已经不同，第五个开始用的就不是同一份历史。直接比较后面整段分数，差异再大也不能定位最初的原因。

所以要保留两边共同的输入和前三个输出，比较选择第四个编号之前的同一份前缀。图里前三格保持相同颜色，第四格才分开；不要把右侧已经不同的后续答案再当成同一输入来比较。需要继续比较更后面的计算时，应在受控复现中给两边相同的历史编号，而不是任由它们沿不同答案跑下去。

```wiki-diagram
file: inference-correctness-first-difference
```

假设在首次分歧处，经过相同规则处理后的两个最高候选分数如下；其他候选都更低。这里的数字只演示排序怎样翻转，不表示某种硬件误差范围。

| 候选 | A 的分数 | B 的分数 |
| --- | --- | --- |
| token 41 | 8.0001 | 8.0000 |
| token 52 | 8.0000 | 8.0001 |

A 的最高候选是 41，B 的最高候选是 52；两边领先幅度都只有 0.0001。即使都采用 greedy，极小的分数变化也能翻转选择。一旦选出不同编号，后面整段文字就会逐渐分开。这个例子解释了“无随机采样仍不同”，但没有证明此次差异一定可接受，也没有说明误差来自量化。

这时要取两处记录：一处是模型刚算出的 logits，另一处是惩罚、格式约束等处理后、选择之前的分数。若前者相同、后者不同，就先查分数处理规则；若前者已经不同，才继续向前找计算或状态差异。比较时两边都必须停在同一个共同前缀。

确认差异来自更早的计算后，再定位最早出现异常的层、算子与输入状态。**算子**是一次具体运算，**张量**是按维度排列的一组数。先比较模型末端，再逐步缩小到有差异的层和操作，避免一开始保存全部中间张量。

## 缓存、图和量化，怎样分别验证

到这里，输入和选择规则已对齐，首次分歧也已定位在计算或状态路径。再检验缓存、批次、图与精度，才能解释开关变化到底说明了什么。

**eager** 是按当前步骤组织执行；**graph mode** 预先捕获支持的流程再重放；**量化**用更少位数及缩放信息表示数值。

缓存会保留已算历史，**prefix caching** 复用条件相符的前缀，**block table** 记录历史位置对应的缓存块；**batch invariance** 则约束执行方式，尽量避免同批请求变化带来目标请求的数值变化。这些机制的具体实现分别在原页维护，下面只组织对照方法。


可复现措施要区分在线和离线：所列上游文档为离线提供关闭 V1 多进程或启用 batch invariance 两条路径，在线只列出后者；而且可复现范围限定于相同硬件和相同 vLLM 版本。Ascend 与具体模型是否支持，还应按实际组合核对。

关闭 V1 多进程还会改变构造离线 LLM 对象的用户代码的随机状态，即随机数生成器后续产生数值所依赖的内部状态。做这项对照时，也要记录外围程序的随机状态变化，不能把关闭前后视为其他运行条件完全相同。

| 需要检验的候选 | 最小记录与对照 | 结果支持什么，下一步是什么 |
| --- | --- | --- |
| 历史状态复用错误 | 相同输入及前缀，记录缓存键、命中长度、块映射；在隔离环境比较确认冷状态与复用状态 | 只在复用路径出现差异，缩小到缓存/状态路径；再查 [prefix caching](prefix-caching.md) 和 [block table](block-table.md)，不能仅因命中就断言内容正确 |
| 批形状改变数值顺序 | 固定目标请求、前缀、采样和版本，只改变同批请求；保存实际批形状与首次分歧分数 | 差异随批形状重复出现，查 [batch invariance](batch-invariance.md) 的适用条件；它可能有性能代价，也不承诺覆盖所有模型算子 |
| 图捕获或回放路径差异 | 固定触发输入，记录实际图模式、补齐尺寸和算子；与该版本支持的 eager 路径对照 | 只在回放路径复现，继续缩小路径、布局、状态和时序差异；查[图模式](graph-mode-layer.md)，不能把开关相关性当唯一根因 |
| 低精度计算或权重转换 | 核对量化文件、缩放参数、加载路径及精度；对齐输入、前缀和算法后与可用的高精度参考比较 | 固定样本的数值与任务指标一起回退，继续定位量化层及转换；查[量化](quantization.md)。换权重或更换内核引入的差异也要记录 |

上述对照会改变执行方式、内存或时序，适合缩小原因范围。找到具体原因后，还要在原目标配置下复现修复效果、复测任务质量和性能。

若问题只在[跨实例交接 KV](pd-disaggregation.md)后出现，还要比较**交出的内容与收到的内容**。这里 P（Prefill）先处理输入，D（Decode）接过历史继续生成。传输接口返回成功、字节数符合预期，只能说明它报告完成了这次操作，不能独立证明每一层、每个块的内容都正确。可以在 P 计算完成且源块未被复用时取样，在 D 报告接收完成、尚未使用或覆盖目的块时取样，按同一请求、层和逻辑位置比较。两边块号可以不同，必须先按各自的块映射找到对应内容。

先比较少量目标块的校验值，也就是由目标数据算出的摘要；校验值不同后，再缩小到具体字节或张量位置。原样传输且布局相同才能直接比字节；若传输包含重排、转换或分片，则先还原为同一逻辑表示。源端已错就向前查计算与缓存；源端正确、接收端首次不同，就继续查地址、长度、布局、内存登记和同步。再用固定数据的独立传输试验判断问题是否仍脱离模型存在。换成另一条传输路径后正常，是定位线索，还不能单凭这个结果宣布某个驱动有错。

## 乱码、重复、空输出和 NaN 分别从哪里进入

**乱码或奇怪标记**先比较输出编号。编号相同、原始响应文本也相同而界面不同，查客户端编码与显示；编号相同但服务解码不同，核对分词器、特殊 token 处理和解析器。不要把每个 token 单独解码再拼接来判乱码：某些 token 只构成字符的一部分，需要增量解码。路径见[流式输出](streaming-output.md)。

**重复输出**先确认是流式增量被客户端重复追加，还是服务真的生成了重复编号。前者逐片段比较序号、内容和客户端拼接；后者保留首次进入重复段之前的共同前缀，核对输入模板、惩罚设置、停止条件及计算状态，再做上面的受控比较。

例如原始流依次只发出增量“今天”“下雨”，客户端却显示“今天今天下雨”。用保存的这两个片段离线重放到客户端，仍得到重复文本；修正拼接后显示“今天下雨”，再对照整段原始流确认没有漏片段。在这个示意中，设备与生成参数都无需改变，重复发生在展示路径。若原始流里本来就有重复内容，则应继续向服务端追，不能沿用这个结论。

**空输出**先保留结束原因、输出编号与原始流全部字段。模型直接选择结束编号、停止字符串截掉内容、内容进入思考或工具字段、生成过程出错，都有不同证据。启用 `tool_parser`（工具调用解析器）或 `reasoning_parser`（思考过程解析器）时，服务端会把特定标签之间的 token 拆进 `tool_calls` 或 `reasoning_content` 而令正文 `content` 看似为空；部分模型模板还自带思考开关或常驻思考（如 `main` 中 `patch_glm53_reasoning` 针对含 `Reasoning Effort:` 且不含 `enable_thinking` 的 GLM-5.3 模板做专门识别）。没有收到非空答案文本不等于设备没有执行。先按[采样的停止规则](sampling.md)与[返回处理](streaming-output.md)确认是哪一种。

停止字符串也会影响可见输出的时机：配置了停止字符串且不把它包含在输出中时，实现缓冲末尾的“最长停止字符串长度减一”个字符，其他情况缓冲长度为零。客户端暂时没看到文字，可能只是这段尾部仍在缓冲。

请求结束时，输出处理不再扣留这段尾部缓冲；已按停止条件截掉的停止字符串不会因此重新出现。排查空输出时要区分仍在生成和已经结束：前者可以核对尾部缓冲，后者还要结合结束原因、输出编号和原始响应字段判断。

停止字符串检查要求输出 token 数严格大于 min_tokens；若停止串已出现但请求尚未结束，应同时核对这一最小输出限制和检查位置。


**NaN** 表示无效的数值运算结果。遇到 NaN 或无穷值，要记录首次出现的位置、该算子的输入范围、数据类型、形状和状态。上一层已经无效就继续向前查；输入有效而这一步变无效，再用同输入的受控参考检查这一步。最先看到的异常层不一定是最先产生异常的层，异步报错位置也不一定等于实际失败操作。

**质量回归**需要明确“好”的判据。若目标是回答质量、工具参数正确率或长文档任务得分，保留固定评测集、评分规则、多个样本及波动；不能只凭一条回答字面不同判整体退化。逐位数值一致、输出编号一致和任务质量达标是三种验收目标，要分别写明。

## 偶发异常来不及复现，怎样留下现场？

离线能稳定复现与线上偶发难复现，对应两套分工明确的工具链：

- **稳定复现 → MSProbe 逐层张量对齐**：输入已经对齐时，用 **MSProbe** 捕获中间张量，比较“第一次在哪一层或算子产生差异”。`statistics` 先记录最大/最小值等摘要，`tensor` 才保存具体数值；`L0` 按模块、`L1` 按算子 API、`mix` 同时保留两者。先圈定请求、共同前缀、`step` 和 `rank` 再扩大范围，避免把不同计算阶段的两个张量直接相减。完整逐层对齐、配置与图对比步骤见[msprobe 逐层精度对齐与输出异常定位](msprobe-accuracy-debug.md)，精简启动片段见下方“怎么开”。
- **线上偶发 → Runtime Guard 在线检测与取证（`main` MRV2）**：**Runtime Guard 是运行中的异常检测与取证层**，观察 decode 信号、命中条件后写报告，并可选择保存请求相关的 KV 数据供后续检查；它只留下“哪条请求、在哪一步、什么信号异常”的记录，不会自动修正回答，也不替代输入对齐和首次分歧分析。
  1. **三类检测器各盯不同对象**：重复检测（`token_repeat`）看已经采样的 token，有限性检测（`logits_finite`）看采样前的 logits 是否含 NaN/Inf，投机接受检测（`spec_acceptance`）看候选接受情况的变化。出现重复不等于已证明 KV 损坏，接受率变低也可能是负载或输入变化，先看报告指向哪个信号，再沿前文对应分支缩小范围。
  2. **先报告、再限额转储**：以“线上偶尔反复输出相同片段”为例，先只开重复检测和报告，保留请求标识、配置与触发步；若记录指向历史状态问题，再启用有限次数的 KV 转储（`dump_kv`），把同一前缀带回受控环境比较。报告里写了“尝试转储”不证明文件已保存成功，还须检查实际产物、`rank` 与波次。
  3. **转储覆盖范围与完成态边界**：该快照的报告由最后 PP 阶段的 TP0 写，KV 转储覆盖最后 PP 阶段的所有 TP rank，不能据此认为拿到了整个 PP 模型的历史；请求刚结束时 KV 块可能已释放或复用，带“转储时已结束”标记的产物须先核身份与时点，不能直接当成异常前状态。
  4. **手动转储递增水位规则**：手动转储采用递增水位——假设进程已触发 1 个手动转储波次，把目标仍写为 1 不会再触发，改为 2 后才会在后续合适波次再触发一次。内部计数记录的是触发波次，排队失败也会增加，不能当成成功保存次数；重试须把目标升到该计数之上并检查实际产物。目标不是“剩余次数”，把目标从 0 一次写成 100 会让后续波次持续追赶；多个 DP 引擎各自记数，共用一个配置文件也不代表全服务合计只保存一次。

## 放到 GLM 双机，先保留哪些条件

沿用[固定部署](glm-5-3-flash-two-node.md#部署前提)：TP8 分矩阵、DP2 分请求、EP16 分专家，W8A8 表示部分权重和计算中间值用 8 位整数表示。两机共同持有专家，缩成单机或修改并行方式就改变了计算与通信，不能视为只关闭一个功能。

本部署的 **MTP** 会猜测并验证后续 token。对齐输出时按最终接受的编号序列比较，不按设备步数或客户端片段数比较；每一步交回的数量不同不等于文本错误。批次一致性页还列出了 GLM 专用实现的覆盖边界，所以不能承诺“开批不变开关便保证 GLM 全程逐位一致”。

从业者可提交一份最小记录：相同输入及文件标识、最终采样配置、A/B 输出编号、首次分歧位置、该位置共同前缀、对应分数与实际执行路径。若目前只有文字截图，先补原始请求和响应、模板与编号，而不是先推荐更换量化精度。

## 常见误解

- **“temperature 为零就能保证任何批次都一样。”** greedy 取消随机选择，计算分数仍受执行条件影响。
- **“文本一样就证明中间数值逐位相同。”** 分数有差别但排序没变，也能产生同一段文本。
- **“关闭缓存后正常，说明已经证明缓存损坏。”** 关闭缓存同时改变工作量、批形状与时序；还需状态和首次分歧证据。
- **“换成高精度就算修好了。”** 先定义质量目标、定位差异来源，再确认性能和容量代价可接受。

## 对照源码

### 怎么开

**中间值对照：MSProbe。** 以下按 921ccc52 调试指南，需安装匹配的 mindstudio-probe。将配置合入 additional-config，先用 L1 statistics 收集算子摘要；dump_path 必须对服务可写：

```json
{"dump_config":{"task":"statistics","level":"L1","dump_path":"/data/msprobe","statistics":{"list":[]}}}
```

也可用 dump_config_path 指向配置文件，这是指南保留的旧入口。先固定输入和采样、发送最小请求，再检查按 step/rank 分组的 dump.json、stack.json 及错误日志。对照两次运行时先确认位置、形状、dtype 与采样点相同，再看首次数值分歧；摘要不足以定位时，缩小范围改采 tensor。

Eager 支持按 step、scope、async_dump 和动态 dump_enable 控制；指南的 graph 模式不支持这四项，图转储还需从源码构建带 aclgraph_dump 的包。L0/mix 才生成可用于结构可视化的 construct.json，L1 不能直接当完整网络图。若报 start 不接受 scheduled_tokens，指南要求 MSProbe 至少 v26.2.0；若报需要 eager，应按采集路径切换并记录执行条件已改变。

需要图对照时，可执行 `msprobe graph_visualize -tp /path/to/problem -gp /path/to/baseline -o /path/to/compare`，产物用带 tb_graph_ascend 插件的 TensorBoard 查看。这里比较的是计算数据，时间与吞吐仍用未开启转储的运行验收。

**Runtime Guard 的以下入口来自 2026-11-02 官方快照，接线限定 Model Runner V2。** 先确认模型支持该 runner，再选择检测器；默认所有检测器和热更新都关闭。仅检测、报告的示例为：[S16]

```bash
export VLLM_USE_V2_MODEL_RUNNER=1
vllm serve /path/to/model --additional-config '{
  "runtime_config_hot_reload": true,
  "runtime_config": {
    "detector": {
      "token_repeat": {"enabled": true},
      "logits_finite": {"enabled": true}
    }
  }
}'
```

启动时用默认值加上述 overlay 写入运行配置，会覆盖目标 JSON；所以先启动服务，再编辑 live 文件。默认路径是当前工作目录的 `runtime/config/runtime_config.json`，可用 `runtime_config_path` 改；`runtime_config_hot_reload` 是启动项，不是 live JSON 内的字段。只设置路径而不启用检测器，不会开始检测。[S16][S17]

需要自动转储时，在所选检测器设 `on_trigger:["report","dump_kv"]`，并给 `dump.auto_max_times` 正数配额；默认配额 0 关闭自动转储，默认冷却 300 秒。需要手动单次现场时，在热更新已开启的 live 文件把 `dump.manual_dump` 从 1 逐次提高到 2、3。报告和文件会消耗主机、磁盘及 D2H 带宽，应先估算容量并限制次数；文本和 token 保存默认关闭，由 `report.save_sensitive_info` 控制。[S17]

先保存原始请求与响应，再到渲染完成、引擎接收输入的位置取模板结果和输入编号；输出编号从引擎已接受的生成结果取。客户端把答案重新分词，可能得到另一种合法切分，不能代替引擎当时实际选出的编号。

本例的最小材料可以写成三行：A 的输入为 [11,23,7]、B 为 [11,23,9,7]；两边模板文件与渲染选项的标识；B 只对齐模板后输入及输出怎样变化。只有进入“输入相同、输出不同”的分支，才继续补共同前缀和两处候选分数。服务不暴露这些值时，在隔离环境增加对应观察；批不变、图、量化和转储的开关与限制由各机制页维护。

### 会报什么错

Runtime Guard 报告的 `dump_attempted` 表示动作被请求，不表示异步保存已完成；`request_finished_at_dump` 提示请求可能已结束、缓存块可能复用。没有捕获文件时先查实际队列与保存结果，不能据报告字段宣称 KV 转储成功。[S16]

`logits_finite` 默认异步等待检测结果：gate 来自预先计算的有限性判断，但命中时的分类可能已经看到 grammar 改写后的 logits。需要明确区分采样前 NaN/Inf 与后续掩码值时，设 `item_sync:true` 在采样前同步取证；它会引入同步代价。该版本没有在线 KV/位置元数据检测器，不能把没有报告解释成 KV 正确。[S16][S17]

文本变化常常没有异常。NaN、索引越界、类型或形状错误则保留第一处报错与各 rank 上下文；需要同步定位时，把同步调试与普通性能运行分开，避免用调试耗时评估性能。

### 开销和什么时候别开

逐层转储会增加传输、内存与存储，固定种子和强制确定性也会改变实验条件。先查输入和输出边界，再缩小到首次分歧附近。用户数据的完整提示词与中间值只保留在受控复现材料里，公开问题用可重现的替代样本。

### 版本差异

**`Runtime Guard`（`runtime_config` / `runtime_config_path` / `runtime_config_hot_reload`）仅在 `main`（`8d6180e2`）正式落地且限定 MRV2 接线；`v0.30.0`（`c09d3e20`）尚无上述键，普通 Ascend 严格解析会直接拒收（`vllm_omni` 特例也只告警过滤），不能把 `main` 的热更新配置直接复制到 `v0.30.0`。**

| 正确性取证核对项 | `v0.23.0 (2c59ff10)` / `vllm@0fc695fc` | `v0.26.0rc (2ed6cbba)` / `vllm@568afb3a` | `v0.30.0 (c09d3e20)` / `vllm@ced6857a` | `main (8d6180e2)` / `vllm@ba15685a` |
|---|---|---|---|---|
| `Runtime Guard` 在线监测与 KV 转储 | 无 | 无 | 无（`observability/` 仅含 metrics 基础配置，未含 `runtime_guard` 与 `runtime_config` 键） | 正式落地 `observability/runtime_guard/`（`hooks.py` 明确 MRV2-only），提供 `token_repeat`、`logits_finite`、`spec_acceptance` 三类检测器与热更新 KV 转储 |
| Tool / Reasoning Parser 演进 | 上游 `OpenAIServingChat` 接入 `tool_parser` / `reasoning_parser`；按请求与模板分别核对 | 延续上游解析器扩展 | `vllm@ced6857a` 具备 53 个 `tool_parsers` / 34 个 `reasoning` 模块，`serving.py` 向引擎透传 `reasoning_parser_kwargs` | `vllm@ba15685a` 扩展至 64 个 `tool_parsers` / 44 个 `reasoning` 模块；`vllm-ascend@8d6180e2` 补齐 `patch_glm53_reasoning.py` 识别 GLM-5.3 常驻思考模板 |
| 批不变性（`VLLM_BATCH_INVARIANT`） | 仅环境变量，注册依赖 Triton / AscendC；`reduce_sum` 维度过宽 | 同 `v0.23.0` | `attention_v1` FIA 无 sink/因果/非滑窗时拆分混合批；`reduce_sum` 支持 `axis`/`dtype` 保护；预编译 wheel 不含 csrc | 改用 `torch_npu.npu.set_deterministic_level(3)` 并无条件拆分 `npu_add_rms_norm`；详见 [批不变性版本表](batch-invariance.md#版本差异) |
| MSProbe 与首次分歧排查 | 前缀对齐、贪心阈值 `1e-5`、停止串缓冲与逐层对比方法适用 | 相同 | 相同；同时记录主 KV 与 indexer 精度、MRV1/MRV2 | 相同；MSProbe 逐层对齐与图对比详见[msprobe 逐层精度对齐与输出异常定位](msprobe-accuracy-debug.md) |

- **实测与实现边界**：`v0.30.0` 及 `main` 中 `batch-invariant` 仅在运行时开关为 1 且 Triton 或 AscendC 扩展可用时才注册，缺依赖会 warning 后跳过；预编译 wheel 不带 csrc，安装 wheel 时设开关不会自动编译扩展，须从匹配源码依次安装 AscendC 算子包与配套 wheel。因此“变量已设”不证明全模型逐位一致；主 KV 与 indexer 精度、KPool/LightningIndexer、MRV1/MRV2 也须分别记录，避免把切换执行分支误判为随机误差。
- 详细跨版差异另见[batch invariance 版本表](batch-invariance.md#版本差异)、[采样](sampling.md#版本差异)与[流式输出](streaming-output.md#版本差异)。本页提供源码与文档取证步骤，不含本站异常触发或硬件转储实测 [S16][S17]。

### 源码位置

- `main (8d6180e2)` `Runtime Guard` 与 Reasoning Parser 实核：`vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_guard/hooks.py#L18-L145`（`runtime_guard_step` / `runtime_guard_sample_tokens`，明确 MRV2-only）、`detector/manager.py#L57-L95`（三类检测器注册）、`patch/platform/patch_glm53_reasoning.py#L21-L66`；上游 Tool / Reasoning Parser 透传与采样/反分词实核见 `vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L131-L165` 与 `vllm@ba15685a:vllm/entrypoints/openai/chat_completion/serving.py#L137-L175`、`v1/sample/sampler.py#L299-L365`、`v1/engine/detokenizer.py#L84-L170` [C31][C35]。
- 四版 `batch_invariant.py` 与 `v0.30.0` FIA 混合批拆分实核见来源 27–30（`2c59ff10` / `2ed6cbba` / `c09d3e20`）；Runtime Guard 文档入口、热更新水位、配额及有限性同步语义见 [S16][S17]；MSProbe 详尽实操见[msprobe 逐层精度对齐与输出异常定位](msprobe-accuracy-debug.md)。

- Runtime Guard 的检测阶段、V2 接线、报告与 KV 转储范围见 [S16]；启动 overlay、热更新、水位、配额、日志及有限性同步语义见 [S17]。它是收集证据的入口，不作为已定位根因的证明。

- “传输完成但内容不对”的公开个案见来源 7 的 vLLM issue #64048：作者报告环境为 GH200、vLLM 0.31.0、NIXL 1.5.0，用分层分块校验继续定位。它提供比较交接内容的个案线索；本站 A2/GLM 是否遇到相同问题，还需自身传输数据与运行环境证据。通用取证顺序为本站分析。

- greedy 与随机采样的选择路径 [C1]；约束、惩罚及停止行为由采样与结构化输出页展开。
- 增量解码、字符片段和停止字符串处理入口 [C2]；聊天模板到输入的路径 [C3]。
- 可复现性的支持范围与执行条件见固定版说明 [S4]；聊天模板说明见 [Transformers 官方文档](https://huggingface.co/docs/transformers/chat_templating) [S5]；批不变配置限制参见 [Ascend 官方指南](https://docs.vllm.ai/projects/ascend/en/main/user_guide/feature_guide/batch_invariance.html) [S6]。
- A/B 编号、候选分数和首次分歧为教学假设 [A]，排序分析为推导 [D]。诊断顺序是本站方法 [I]，不等于已经发现现场的根因。

- 来源 9：vllm@0fc695fc，vllm/renderers/hf.py，L731–L745。
- 来源 10、11：vllm@0fc695fc，vllm/v1/sample/sampler.py，L17–L17、L296–L301。
- 来源 12、13：vllm@0fc695fc，vllm/v1/engine/detokenizer.py，L84–L89、L120–L135。
- 来源 14：vllm@0fc695fc，docs/usage/reproducibility.md，L3–L20。

以上四项已对照固定 vLLM `0fc695fc`：来源 3 的 `renderers/hf.py` L731–L745 说明 Transformers v5 返回类型与兼容参数；来源 1 的 `sample/sampler.py` L243–L290 展示全 greedy 提前返回；来源 4 的 `docs/usage/reproducibility.md` L12–L20 警告用户代码随机状态变化；来源 2 的 `engine/detokenizer.py` L137–L164 展示停止串截断及 finished 时缓冲长度归零。它们是该快照的代码或文档依据，不新增各发布分支或 GLM 双机的实测结论。
