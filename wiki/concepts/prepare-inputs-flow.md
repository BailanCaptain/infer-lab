---
id: prepare-inputs-flow
title: 输入准备：从请求计划到位置、边界和缓存槽位
type: concept
summary: Runner 将多个请求本轮安排的 token 拼接为计算输入，同时保留请求边界、序列位置及状态映射。批次行号、序列位置、物理缓存槽位是三套不同坐标。
aliases: [prepare_inputs, 输入准备, positions, query_start_loc, slot_mapping]
chapters: ["09"]
order: 30
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L853-L868
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1018-L1042
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2327
  - vllm@0fc695fc:vllm/v1/worker/block_table.py#L141-L164
verified: []
evidence: "C"
relations:
  - {to: concurrent-requests, kind: builds-on, note: 沿用 A/C 第三轮的四个输入位置}
  - {to: block-table, kind: builds-on, note: 逻辑位置到物理槽位的映射是输入准备的一部分}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 三套坐标分别回答什么

Scheduler 交付请求 ID、本轮输入数量和资源更新，模型算子需要的则是张量。Runner 必须把计划转换为 token 编号、位置、序列边界和注意力状态信息；转换过程中还要更新已有请求与持久批次映射。[C1][C2]

这里有三套坐标：**批次行号**指出本轮拼接张量中的行；**序列位置**指出该 token 在所属请求中的位置；**缓存槽位或状态索引**指出设备存储的读写目标。它们一般不相等。

```wiki-diagram
file: prepare-inputs-flow
```

## A/C 第三轮如何拼接

沿用[并发请求](concurrent-requests.md)第三轮，A 已计算五个位置，本轮处理位置 5；C 尚未计算，本轮处理三个提示词位置。假定本轮按 A、C 排列，没有额外填充、投机和并行重排。[A]

| 批次行 | 请求 | token 来源 | 序列位置 |
|---:|---|---|---:|
| 0 | A | 上轮生成、此次送回的 token | 5 |
| 1 | C | 提示词第 0 个 token | 0 |
| 2 | C | 提示词第 1 个 token | 1 |
| 3 | C | 提示词第 2 个 token | 2 |

因此位置数组为 `[5,0,1,2]`，片段起点与末尾边界为 `[0,1,4]`。A 对应半开区间 `[0,1)`，C 对应 `[1,4)`；边界长度为请求数加一。[D] 固定 Runner 根据各请求本轮 token 数的累积和生成查询边界，同时维护相应序列长度。[C3]

token 编号用来读取嵌入行，位置和边界用来解释计算上下文。拼接并不允许 A 读取 C 的历史；注意力元数据与状态映射仍按请求隔离。

## 位置怎样找到缓存写入处

对按位置分页的一类缓存，假设块大小 B=4：位置 p 的逻辑块号为 `p//4`，块内偏移为 `p%4`。[A][D] 再通过该请求的块表取到物理块号 b，物理槽位为 `b×4+p%4`。这是[块表](block-table.md)中同一个映射。

A 若有块表 `[7,2]`，位置 5 落在物理块 2 的偏移 1，即槽位 9；C 若首块为 9，其位置 0、1、2 落在槽位 36、37、38。[A][D] 同一序列位置可以属于不同请求并映射到不同缓存；本轮批次行 0 也不表示写物理槽位 0。

底层映射实现需要结合缓存组和并行布局。[C6] GLM 的 KDA 递推状态不是不断追加位置行，稀疏 MLA 的主历史、索引池与尾状态也各有布局，因此上面的 B=4 不能代替整个模型的状态寻址。

## 哪些行用于生成预测

普通生成只需为达到采样条件的请求取相应末端隐藏表示。上例 A 取批次行 0，C 取批次行 3，得到两行用于输出头计算的表示。[D] 固定 Runner 用 `logits_indices` 选择隐藏表示后计算 logits。[C5]

如果 C 的三个位置只是长提示词的一个未完成分块，当前末行还不是完整提示词末尾，不能把它产生的临时结果当作用户可见生成输出。实现维护应丢弃采样结果的请求标记，处理这种尚未完成的输入。[C4] 投机验证需要的选行数量和索引又不同。

## 批次重排与填充不改变请求身份

实际执行可能将不同形态的请求重排，或者为图模式对齐扩大执行张量。额外行不代表增加真实请求；仍需用有效数量和映射解释结果。请求在批次中的行位置也不会终身固定，新请求加入或其他请求完成后都可能变化。

排查输入问题时，最好把同一轮的请求 ID、安排量、已计算长度、位置、边界、块表和选行索引放在一起核对。[A] 分别检查每个数组的形状正确，仍不足以证明它们对同一请求使用了同一套映射。

模型前向后的形状与采样交接在 [NPUModelRunner](npu-model-runner.md)继续。上述数值是 GLM 主线请求的教学推演，代码锚点与运行组合的边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

