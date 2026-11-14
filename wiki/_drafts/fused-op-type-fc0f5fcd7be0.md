---
id: fused-op-type-fc0f5fcd7be0
title: fused_op_type
type: param
summary: 选择 Sparse KV offload 的融合执行路径；选择后仍须满足查询行数、热缓存容量及当前批次的执行条件，不同源码快照的限制不同。
aliases: []
chapters:
  - '11'
  - '16'
sources:
  - >-
    raw:sha256-dec93a7ca7f1cfc786abd293f2b9febcc22503f2aa03ebe5714c7e3bbee3d3a3.md#L1-L638
evidence: I
relations:
  - to: use-fused-overlap-75a180fff6ab
    kind: conflicts-with
    note: fused_copy_sfa 与 use_fused_overlap 不能同时启用
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-dec93a7ca7f1cfc786abd293f2b9febcc22503f2aa03ebe5714c7e3bbee3d3a3.md
---

## 一句话

`fused_op_type` 用于选择 Sparse KV offload 的融合执行路径：材料中的配置声明只接受 `none` 和 `fused_copy_sfa`，后者使配置属性 `use_fused_copy_sfa` 为真，但实际执行还要检查当前批次的注意力元数据。

[Sparse KV offload](../concepts/kv-cache-sparse-offload.md) 将历史缓存的存放与本次计算所需数据的搬运结合起来；这里的融合选择作用于其中的 LIM 与 Copy-SFA 路径。材料给出了配置、校验和部分执行分支，没有完整展开这些算子的内部计算。

本页仅依据归档材料整理。材料包含两份源码快照，分别以提交前缀 4ebb3090 和 7d825229 标识；未提供它们与在册发行分支的可靠映射，因此下文按快照比较，不将其中一份称为某个发布版本，也不据此判断首次支持时间。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置选择 | 声明默认值为 `none`；接受 `none`、`fused_copy_sfa` | 字段默认不选择融合路径；这不等于关闭 Sparse KV offload 整体 |
| 与其他路径的关系 | `fused_copy_sfa` 与 `use_fused_overlap` 互斥 | 两种路径不能同时选择 |
| 查询行数定义 | Q_max = 1 + 推测 token 数；没有投机配置时为 1 | 容量校验考虑的是每请求可能需要处理的查询行数，不是请求数量 |
| TopK | 两份快照均要求 2048 | 融合路径不能直接套用到任意选择数量的稀疏模型 |
| 热缓存对齐 | `topk_buffer_size` 必须是 256 的倍数，且至少为 Q_max × 2048 | 增加推测 token 数时，需要同步检查热缓存容量 |
| 7d825229 文档的缓存块大小 | 128 | 该文档中的融合配置具有明确的缓存布局条件 |
| 7d825229 文档的额外尾区 | 运行时另分配两个尾块 | 不要把这两个尾块加进 `topk_buffer_size` 设置值 |

两份快照真正不同的限制如下。这里比较的是材料所展示的行为，不代表已经核实对应分支的全部实现。

| 项 | 4ebb3090 源码快照 | 7d825229 源码快照 | 意味着什么 |
| --- | --- | --- | --- |
| 每请求查询行数 | 1–7 | 1–14 | 同一推测长度在两份快照中可能得到不同的校验结果 |
| 热缓存可用最大设置值 | 16128 | 32512 | 上限变化后仍须满足 256 对齐与容量下限 |
| DSpark 组合 | 融合前置校验直接拒绝 | Sparse KV offload 与 DSpark 的组合要求 V2 runner | 后一份材料展示了有条件的接入，不能推广成任意 runner 或任意场景均可用 |

4ebb3090 的代码比较上界写的是 16256，同时要求 256 对齐；不超过该上界的最大可取值是 16128，与报错文本一致。[D]

7d825229 文档将 LIM 容量限制写为 32640，但热缓存设置仍须按 256 对齐，因此最大设置值为 32512。运行时额外分配的尾块与用户设置值是两个口径。

## 为什么存在

这个字段把“是否选择融合实现”与“这一批是否具备融合执行条件”分开。配置选择只是第一道判断，注意力元数据还描述当前批次能否进入该路径；元数据是随本批计算传递的描述信息，不是计算结果本身。

4ebb3090 中，只有同时满足以下条件，元数据里的融合标志才为真：

1. 配置选择了 `fused_copy_sfa`。
2. 当前批次没有 prefill，或者设置了 `offload_dummy`。
3. 当前批次的最大查询长度在 1–7 之间。

Prefill 是处理提示词中尚未计算的位置并建立历史状态的阶段。因此，在这份快照中，一个普通批次只要包含 prefill，就不满足上述融合条件。`offload_dummy` 是显式例外；材料中的 dummy run 属于模拟执行，不能用这个例外放宽普通请求批次的条件。材料还展示了仅运行多模态编码器时提前返回的 dummy 路径，所以也不能认为所有 dummy run 都会构建同样的卸载元数据。

7d825229 展示的执行分支仍读取 `fused_copy_sfa_enabled`：标志为真时调用 `_copy_sfa_attention`，随后将结果补齐到输入 token 数量。材料没有展示这份快照中该标志的完整构造条件，不能把另一份快照的逐批条件原样移植过来。

热缓存容量与查询行数的联系可以用一个配置示例说明。假设每请求草拟 2 个 token，则 Q_max 为 3，容量下限是 3 × 2048 = 6144；6144 本身满足 256 对齐，也在两份快照各自的上限内。[D] 这个计算只检查所列容量条件，不证明完整配置可以启动，更不代表性能测量。

## 开了的代价

选择融合路径后，可用的模型、缓存布局与执行组合受到额外限制。4ebb3090 的前置检查在配置未启用时直接返回；启用后，融合专用检查会约束 TopK、查询行数、热缓存预算以及 DSpark 组合。字段取值检查和互斥检查则出现在配置值校验中，应与这些前置检查区分。

7d825229 文档进一步区分了主 KV cache 与索引器缓存。主 KV cache 保存注意力计算需要的历史表示；索引器用于选择将要访问的历史位置，两者的精度条件不能混为一谈：

- 主 KV cache 要求 BF16；材料明确写明不支持 Sparse SFA C8。
- 设备驻留的 LightningIndexer 支持 Sparse LI C8，配置入口是 `--attention_config.indexer_kv_dtype int8`。
- 该索引器路径对查询和键做 Hadamard 旋转及 int8 量化，向 C8 LIM 传入 int8 查询和 fp16 反量化尺度；文档说明 Copy-SFA 与缺失数据从主机到设备的搬运保持不变。
- `indexer_kv_dtype fp8` 不属于该 LIM C8 serving 路径。

这份快照的配置注释仍写着“不选择单独构建的 C8 算子”，而后面的文档明确描述了索引器 int8 接入。两处文字存在范围或同步上的差异，不能单凭该注释否定索引器 C8；材料也不足以进一步确定注释所指的全部实现范围。[!]

对于 [DSpark](../concepts/dspark.md)，7d825229 的检查要求 V2 runner，注释解释为只有 V2 初始化了来自远程 prompt 上下文的驻留草稿 KV。这是 Sparse KV offload 与 DSpark 组合的条件，不能仅解释为这个字段自己的独立限制。

配置选中融合但当前批次没有进入融合时，状态处理也有区别。4ebb3090 的前向片段将层内 TopK 复用计数重置为零；同处注释说明，回退执行所需的驻留历史失效由注意力元数据准备阶段处理。不能把这条计数赋值解释成每次前向都会清空全部历史缓存。

常见校验错误可以直接帮助定位配置问题：

- 非法取值：`sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa`
- 同时选择互斥路径：`fused_copy_sfa and use_fused_overlap are mutually exclusive`
- 4ebb3090 中使用 DSpark：`fused_copy_sfa does not support DSpark speculative decoding`
- 7d825229 中 DSpark 未满足 runner 条件：`Sparse KV offload with DSpark requires V2 remote prompt-context initialization`

材料没有提供开关前后的设备时延、吞吐或显存实测，无法据此量化收益，也无法判断哪种负载下值得开启。

本页依据的位置对应如下，行号均指归档材料：

- 第 15–49 行：4ebb3090 的字段声明、取值、互斥与前置校验。
- 第 53–57 行、第 80–83 行：逐批融合条件及回退时的局部状态处理。
- 第 116–121 行：dummy run 的多模态编码器例外。
- 第 481–519 行、第 533–535 行：7d825229 的配置与运行分支摘录。
- 第 596–629 行：DSpark 条件、索引器 C8、缓存容量及精度边界。

待核：四个在册社区版本的字段存在范围、实际配置入口、逐批融合条件及完整调用链。材料未给出这些分支的完整核对依据，因此本草稿不填写 `verified`，也不推断固定 GLM 双机基线能够使用该字段。
