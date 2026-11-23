---
id: glm-mlp-version-source
title: GLM 稠密 MLP 固定版本源码摘录
type: source
summary: 固定 main 与 rc2 的 GLM 稠密前馈实现相同，记录激活限制和序列并行设置；v0.23、v0.26 的指定路径缺失，不能据此判定整个功能不存在。
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
  - >-
    raw:sha256-fb671972d077410f2572579449239242a0ef395f3523de18d57abac7d5a7115e.md#L1-L115
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/models/glm5next/model.py#L108-L123
  - >-
    raw:sha256-f67ddc529e2a3037101bc7e788502201ab0ec9444040816807c9f645d4a28208.md#L1-L134
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2105-L2131'
  - 'vllm@0fc695fc:vllm/model_executor/layers/activation.py#L154-L184'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L46-L56'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L324-L350'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L448-L478'
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
updated: '2026-11-01'
rawSources:
  - >-
    raw/sha256-5a90f64fa82c9472ef5de2ac2b63ff137b4b161bcbc09c14514c090c5a9c09bc.md
  - >-
    raw/sha256-f67ddc529e2a3037101bc7e788502201ab0ec9444040816807c9f645d4a28208.md
  - >-
    raw/sha256-fb671972d077410f2572579449239242a0ef395f3523de18d57abac7d5a7115e.md
---

## 这份摘录核对了什么？

本页保存 `Glm5NextMLP` 的固定版本证据，供[前馈计算教学页](../concepts/mlp-residual-norm.md)后续修订使用。MLP 是对每个输入位置独立施加的前馈变换；这里核对的是稠密模块，不是通过路由选择专家的 MoE 路径。

原摘录日期为 2026-10-07，不是提交日期。本文比较 main、rc2 的指定模型实现，并与旧 GLM 部署对应的代码区分；线性层底层存储、其他模型入口和实际运行日志不在这些摘录的证明范围内。`verified` 只登记本页范围内的源码核对，不认证完整模型部署。

## 四个版本的材料覆盖范围是什么？

| 指定路径 | v0.23 维护分支 | v0.26 rc 分支 | v0.30.0rc2 | main 开发主线 |
| --- | --- | --- | --- | --- |
| `vllm_ascend/models/glm5next/model.py` | missing | missing | 与 main 的该文件相同 | 提供了三个源码区间 |
| `vllm_ascend/models/glm5_next.py` | missing | missing | missing | missing |

这是路径材料的覆盖表，不是功能支持表。[!] `missing` 只证明指定快照的指定路径不存在；没有其他入口、注册信息与替代实现材料，不能据此判断整个功能不存在，也不能确定首次支持版本。两个发布分支不加入 `verified`，缺失路径不作为带行号的来源。

这里的两个旧发布分支分别固定在 `2c59ff10`、`2ed6cbba`；`rc2` 为 `7d825229`，`main` 为 `baa023ad`。后两者在该模型文件中的激活选择、稠密/MoE 分支和 SP 调用顺序一致，所以以下对应摘录也适用于 `rc2`；外围配置、后端和设备支持仍需分别核对。

## main 的激活与投影能确认到哪一步？

`hidden_act` 仅接受字符串 `"silu"`；其他值触发 `ValueError`，文本为 `Unsupported activation: {hidden_act}. Only silu is supported for now.`。`swiglu_limit` 非 `None` 时选择 `SiluAndMulWithClamp`，否则选择 `SiluAndMul`。[C1] 原摘录只覆盖组件选择；限幅计算的定义与固定部署实现已另核于[前馈计算教学页](../concepts/mlp-residual-norm.md)，不能仅凭组件名推导公式。

前向顺序是输入投影 `gate_up_proj`、所选激活组件、输出投影 `down_proj`。输入投影从 `hidden_size` 映射到两个 `intermediate_size` 宽度，输出投影从 `intermediate_size` 映射回 `hidden_size`；两者均传入 `bias=False`。[C1]


两个投影接收同一个量化配置。这里的维度是线性层的逻辑构造维度；每卡实际保存的权重布局，还取决于是否启用 TP 及量化层的存储实现。

固定 `main` 快照的稠密路径选择也已核对：当前层索引在 `config.mlp_layer_types` 范围内时取对应项，越界则沿用最后一项，列表为空时回退为 `"sparse"`。只有 `self.is_moe` 为真、`self.num_experts` 非 `None` 且所选类型为 `"sparse"` 时才构造 `Glm5NextMoE`，其余情况构造 `Glm5NextMLP`。具体模型的层分布仍须代入配置，不能仅凭这段通用分支推断。

## 序列并行设置说明了什么通信边界？

张量并行（TP）把一次张量计算分片到多个设备；[序列并行（SP）](../concepts/sequence-parallel.md)在此处按序列位置分配输入和输出。rank 是通信组内的成员编号。

模块注释声明，SP 时输入、输出分片，权重复制，模块不需要集合通信；非 SP 使用标准 TP，并在末尾归约。构造参数与该声明相配：两个投影都接收 `disable_tp=is_sequence_parallel`，输出投影还接收 `reduce_results`。该参数默认 `True`，调用者可以覆盖，因此不能将注释概括成“非 SP 时无条件在本模块归约”。[C1]

解码层的稠密分支实际传入 `is_sequence_parallel=self.is_sequence_parallel` 和 `reduce_results=not self.is_sequence_parallel`：SP 时关闭投影的 TP 与输出归约，非 SP 时保留 TP 并请求输出归约。[C2] 底层线性层定义没有提供，本页不进一步认证权重加载、量化布局或通信实现。

固定 `main` 快照的外层 mHC（约束多路残差连接混合与写回）路径中，SP 开启时先调 `sp_all_gather(x)` 再按 `positions.shape[0]` 截取送入 attention；attention 输出经 `sp_reduce_scatter` 后，再依次过 attention 后混合、前馈前混合、输入 RMSNorm 与前馈模块。[C3]

这段已核执行顺序说明，稠密 MLP 的局部通信声明不能扩展为「整层没有通信」；通信函数内部实现、实际张量布局与传输字节数也不由这段调用代码证明。

## 后续修订还缺什么材料？

两个发布分支的完整功能范围仍需分别核模型注册、其他入口与替代实现；线性层底层布局及通信函数内部行为也不在原三个摘录区间内。相关教学解释统一见[前馈计算](../concepts/mlp-residual-norm.md)、[序列并行](../concepts/sequence-parallel.md)和[层与隐藏向量](../concepts/layers-and-hidden.md)，不能把本页材料范围误作整个知识库的证据缺口。

GLM-5.3-Flash 的固定配置 `690b7052` 与执行侧 `db701c1f` 对应旧部署：45 个主干层为前 3 层 dense、后 42 层 sparse，`swiglu_limit=10`。执行侧按层型选择稠密模块或 MoE，稠密激活由该限幅参数选出：限幅组件中 gate 只限上界、up 限上下界，随后算 $\text{SiLU}(\text{gate}) \times \text{up}$。

完整条件及组件注册、分发边界见[前馈计算教学页](../concepts/mlp-residual-norm.md)。`main` 与 `rc2` 摘录不能替代旧部署快照，也不证明最终安装环境采用了哪个算子实现或获得了性能收益。

逐字摘录见[源码摘录](../raw/sha256-5a90f64fa82c9472ef5de2ac2b63ff137b4b161bcbc09c14514c090c5a9c09bc.md)。

## 对照源码

- 来源 5：vllm-ascend@baa023ad，vllm_ascend/models/glm5next/model.py，L108–L123。
来源 12–14 分别给出 rc2 的稠密模块、类型选择、SP 与外层 mHC 调用；它们与来源 1–3 的 main 区间逐字相同。旧部署的组件选择和限幅公式见来源 8–11，不能把 main 才有的 hidden_act 显式报错检查套到旧类上。
