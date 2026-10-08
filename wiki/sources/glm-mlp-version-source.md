---
id: glm-mlp-version-source
title: GLM 稠密 MLP 固定版本源码摘录
type: source
summary: 固定 main 快照记录了 GLM 稠密前馈模块的激活限制和序列并行设置；两个发布分支的指定路径缺失，完整功能范围仍待核对。
aliases:
  - Glm5NextMLP
  - GLM MLP
  - SiluAndMul
  - SiluAndMulWithClamp
  - disable_tp
  - reduce_results
chapters:
  - '10'
order: 10
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L324-L350'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L448-L478'
verified:
  - main
evidence: C
relations:
  - to: mlp-residual-norm
    kind: builds-on
    note: 激活检查和投影参数的摘录以该页的前馈计算解释为基础
  - to: sequence-parallel
    kind: builds-on
    note: 区分位置分片与权重分片，才能理解稠密模块的局部通信边界
contradicts: []
updated: '2026-10-07'
rawSources:
  - >-
    raw/sha256-5a90f64fa82c9472ef5de2ac2b63ff137b4b161bcbc09c14514c090c5a9c09bc.md
---

## 这份摘录核对了什么？

本页保存 `Glm5NextMLP` 的固定版本证据，供[前馈计算教学页](../concepts/mlp-residual-norm.md)后续修订使用。MLP 是对每个输入位置独立施加的前馈变换；这里核对的是稠密模块，不是通过路由选择专家的 MoE 路径。

2026-10-07 是本次核对记录日期，不是提交日期。结论限于 main 开发主线的给定快照；没有读取线性层底层实现、其他模型入口或实际运行日志，也没有 NPU 实机验证。`verified` 只登记本页范围内的源码核对，不认证完整模型部署。

## 三个版本的材料覆盖范围是什么？

| 指定路径 | v0.23 维护分支 | v0.26 分支（仍为 rc，本次核对的固定快照） | main 开发主线（本次核对的固定快照） |
| --- | --- | --- | --- |
| `vllm_ascend/models/glm5next/model.py` | missing | missing | 提供了三个源码区间 |
| `vllm_ascend/models/glm5_next.py` | missing | missing | missing |

这是路径材料的覆盖表，不是功能支持表。[!] `missing` 只证明指定快照的指定路径不存在；没有其他入口、注册信息与替代实现材料，不能据此判断整个功能不存在，也不能确定首次支持版本。两个发布分支不加入 `verified`，缺失路径不作为带行号的来源。

## main 的激活与投影能确认到哪一步？

`hidden_act` 仅接受字符串 `"silu"`；其他值触发 `ValueError`，文本为 `Unsupported activation: {hidden_act}. Only silu is supported for now.`。`swiglu_limit` 非 `None` 时选择 `SiluAndMulWithClamp`，否则选择 `SiluAndMul`；组件定义未提供，因而不能由组件名补写限制公式。[C1]

前向顺序是输入投影 `gate_up_proj`、所选激活组件、输出投影 `down_proj`。输入投影从 `hidden_size` 映射到两个 `intermediate_size` 宽度，输出投影从 `intermediate_size` 映射回 `hidden_size`；两者均传入 `bias=False`。[C1]

## 序列并行设置说明了什么通信边界？

张量并行（TP）把一次张量计算分片到多个设备；[序列并行（SP）](../concepts/sequence-parallel.md)在此处按序列位置分配输入和输出。rank 是通信组内的成员编号。

模块注释声明，SP 时输入、输出分片，权重复制，模块不需要集合通信；非 SP 使用标准 TP，并在末尾归约。构造参数与该声明相配：两个投影都接收 `disable_tp=is_sequence_parallel`，输出投影还接收 `reduce_results`。该参数默认 `True`，调用者可以覆盖，因此不能将注释概括成“非 SP 时无条件在本模块归约”。[C1]

解码层的稠密分支实际传入 `is_sequence_parallel=self.is_sequence_parallel` 和 `reduce_results=not self.is_sequence_parallel`：SP 时关闭投影的 TP 与输出归约，非 SP 时保留 TP 并请求输出归约。[C2] 底层线性层定义没有提供，本页不进一步认证权重加载、量化布局或通信实现。

外层 mHC 路径在 SP 条件下先调用 `sp_all_gather` 汇集 attention 输入，再调用 `sp_reduce_scatter` 处理 attention 输出，随后经过混合和归一化才进入 MLP。[C3] mHC 是约束多路残差连接混合与写回的机制。上述调用定位说明，MLP 的局部通信声明不能代表整层没有通信；通信函数内部实现仍不在材料范围内。

## 后续修订还缺什么材料？

需要追加两个发布分支的模型注册、其他入口与替代实现，才能核对完整功能范围；需要线性层和通信函数定义，才能继续验证底层布局与执行。`mlp-residual-norm`、`sequence-parallel`、`layers-and-hidden` 不在本批允许读取的现有页集合内，后续应追加这些依赖页，不能由本摘要代替对它们的审查。

逐字摘录见[源码摘录](../raw/sha256-5a90f64fa82c9472ef5de2ac2b63ff137b4b161bcbc09c14514c090c5a9c09bc.md)。
