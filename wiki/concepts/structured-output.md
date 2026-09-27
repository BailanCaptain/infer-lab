---
id: structured-output
title: 结构化输出：文法状态怎样约束 token 采样
type: feature
summary: 以允许 token 集合解释格式约束，再连接文法编译、投机采样、推理阶段与昇腾 mask 执行。
aliases:
- 结构化输出
- Structured Output
- Guided Decoding
- 引导解码
- 受限解码
- 约束解码
- 文法掩码
- guided_json
- structured_outputs
- StructuredOutputManager
- grammar bitmask
- 文法位图
- apply_grammar_bitmask
- xgrammar
chapters:
- '17'
order: 60
sources:
- vllm@0fc695fc:vllm/v1/structured_output/request.py#L31-L53
- vllm@0fc695fc:vllm/v1/structured_output/request.py#L77-L98
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L49-L56
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L100-L171
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L186-L229
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L266-L300
- vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L302-L343
- vllm@0fc695fc:vllm/v1/structured_output/utils.py#L44-L135
- vllm@0fc695fc:vllm/v1/engine/core.py#L524-L596
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2427
- vllm-ascend@db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L19-L68
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L46-L52
- vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L76-L130
verified: []
evidence: C
relations:
- to: one-request
  kind: builds-on
  note: 模型先产生 logits，再由采样器决定输出 token。
- to: token
  kind: builds-on
  note: 文法必须与 tokenizer 对应，token 不等于字符。
- to: speculative-decoding
  kind: builds-on
  note: 投机位置也需要各自的约束状态。
contradicts: []
updated: '2026-09-26'
origin: seed
---

## 在采样前限制可选集合

[一次请求的推理流程](one-request.md)中，模型先产生词表上的 logits，再由采样器选择 token。结构化输出在两者之间加入约束：根据当前文法状态，计算下一步允许的 token 集合，将集合外的 logits 置为负无穷，再执行采样。

模型仍然负责给候选打分，文法负责限制哪些候选能延续合法格式。JSON schema、正则表达式等约束可转换为后端能够执行的表示。[C2] 后端还必须考虑 tokenizer：一个 token 可能包含多个字符，甚至跨过标点和词的边界，因此“下一个 JSON 字符”不能直接等同于“下一个 token”。

格式约束也不检查内容是否真实。符合 schema 的日期、金额或结论仍可能有事实错误；请求取消或达到长度上限时，输出还可能在格式完成前被截断。

## 从允许集合到一个 bitmask

取一个只有 8 个 token 的教学词表，token ID 为 0 到 7，logits 为 `[1, 4, 2, 6, 0, 3, 5, −1]`，当前只允许 ID `1、4、6`。[A] 如果最低位对应 ID 0，位集合是 `2¹ + 2⁴ + 2⁶ = 82`，写成 8 位为 `01010010`。[D]

mask 后 logits 为 `[−∞, 4, −∞, −∞, 0, −∞, 5, −∞]`。贪心采样选择允许集合内分数最高的 ID 6；原先分数最高的 ID 3 已被排除。[D] 图中是单步、无投机的缩小例子。

```wiki-diagram
file: structured-output
```

实际 bitmask 按 32 位整数打包，一行对词表大小 V 需要 `4 × ceil(V / 32)` 字节。[C5][C8][D] 生成并确认 token 后，文法状态随之推进，下一步允许集合也可能改变。连续多轮使用的是持续演进的约束状态，而不是一张始终相同的静态表。

## 文法在 CPU 侧维护，执行批按请求对应

管理器为请求选择约束后端、创建相关状态并准备文法。通常可以异步编译；使用 `external_launcher` 时会关闭这一异步编译方式。[C3][C4] 请求检查 Future 时的 100 微秒是一次等待上限，不是编译总时间，也不是所有调度轮次都固定消耗的时间。[C1]

在固定实现中，一个引擎只建立一种结构化输出后端；Ascend 补丁在请求校验和管理器层面拒绝混用后端。[C4][C13][C14] 同一后端可以处理不同 schema，所以“多个 schema”与“多个后端”是不同概念。

运行时还需要按请求 ID 将文法结果对齐到当前 logits 行。请求进入、退出和重排，不能改变约束与请求的对应关系。[C8] CPU 侧文法状态维护和 Worker 侧对 logits 应用 mask，是流程中的两个不同环节。

## GLM 的推理阶段与 MTP 会增加状态条件

GLM 主线包含思考阶段。结构化输出是否约束该阶段，取决于 reasoning parser、`enable_in_reasoning` 和推理阶段是否结束等条件；实现分别判断当前是否填 mask、是否推进文法。[C7] 因而，针对最终答案设置的 JSON 格式，不应无条件解释为从第一个思考 token 开始都套用同一约束。

[MTP](speculative-decoding.md)等投机机制会一次准备多个候选位置。各位置面对不同的历史前缀，不能共用一行 mask。管理器可以临时接纳 draft token，逐步生成后续位置的 mask，再回滚临时推进，等待真实确认结果更新状态。[C5][C6]

异步执行还可能出现上一轮结构化输出 token 尚未确认的情况。EngineCore 会推迟相关采样，先获取已确认结果及需要的 draft，再生成约束并完成采样。[C9] 这个依赖会约束可重叠的工作，但不能概括为整个异步流水线完全失效。

## 昇腾 V1 与 V2 的 mask 成本

在 `vllm-ascend@db701c1f` 的 V1 Runner 中，收到文法结果后，会把当前 logits 张量转到 CPU 并转为 float，应用 mask，再送回 NPU 并恢复原 dtype。[C10] 传输对象是这次调用的 logits 张量，不能按“只有一个请求使用 schema，所以只搬一行”估算。成本随实际行数 R 和词表大小 V 增长；投机候选也可能增加相关行数。

V2 提供在 NPU 上应用 mask 的 Triton kernel，将打包位展开并写入 logits。[C11] 固定版本选择补丁默认不启用 V2；显式打开选项只改变 Runner 选择，不自动证明所有 GLM、MTP 和图模式组合兼容。[C12]

结构化输出继承原有模型前向和采样流程，额外增加文法编译、状态推进、mask 构造及应用成本。它的价值是把可表达的格式约束落实到采样过程。本页没有实际设备测试，不能把另一 Runner 的实现、其他模型结果或格式正确率直接写成主线部署保证。
