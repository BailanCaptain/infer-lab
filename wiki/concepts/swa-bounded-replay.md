---
id: swa-bounded-replay
title: "SWA bounded replay：历史窗口丢了，为什么只重算一小段"
type: feature
origin: direct
summary: 用窗口为三个位置的小例子推演回放为何近似，分清 encoder 缺失恢复与 decoder 窗口准备、128/134/140 的不同口径，以及 mask/compact 一致不能证明与完整重算一致。
aliases: [SWA Bounded Replay, 有界回放, 滑窗重算, YoCo, YOCO, Zero SWA Caching, compact, mask compact 等价, 128 134 140]
chapters: ["19"]
order: 2
sources:
  - https://arxiv.org/html/2609.19969v1
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/doc/inference_deployment_qa.md
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/environ.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/input_metadata/yoco.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/models/v4_modules/yoco.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/examples/yoco/README.md
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/worker/cache_engine.py
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/README.md
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/csrc/engine/input_metadata/prepare_tensor_input_v4.cpp#L202-L359
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/examples/yoco/yoco_equiv.py#L371-L393
  - https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/examples/yoco/yoco_equiv.py#L767-L806
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L807-L815'
  - 'vllm@ba15685a:vllm/v1/kv_cache_interface.py#L900-L908'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/cache_config.py#L27-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L633-L635'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/cache_config.py#L30-L63'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/decoder_replay_state.py#L36-L70'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/decoder_replay_layers.py#L19-L35'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L673-L679'
relations:
  - { to: deepseek-v4-1-flash, kind: builds-on, note: 先理解全局历史与逐层窗口为何分开 }
  - { to: prefix-caching, kind: builds-on, note: 前缀复用的通用前提仍由原页维护 }
  - { to: inference-correctness-troubleshooting, kind: builds-on, note: 回放引入差异时，用同一前缀找第一处变化 }
  - { to: kv-cache, kind: builds-on, note: 区分分页历史、窗口与运行状态 }
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: '2026-11-19'
---

**SWA bounded replay 在缺少滑窗状态时，只重新计算末尾一段历史，用较少工作恢复一个可继续生成的近似状态。** “有界”指重新处理的历史长度被限制了；“近似”意味着它不保证与完整历史重算得到相同的中间数值。

## 长历史还在，为什么仍不能直接继续回答

先设想一个常见的长文档问答场景：用户上传一份几万字的技术说明书并连续追问，推理服务把这份说明书的前缀历史存进了缓存（本页以 DeepSeek-V4.1-Flash 的双状态架构为例，下文简称 **V4.1**，完整模型结构可另见 09 组[DeepSeek-V4.1-Flash 全案](deepseek-v4-1-flash.md)）。但这类模型为长上下文保存的历史有两种用途：一份让后续位置查询较远的内容，称为 **block KV**（按固定块大小保存的全局历史缓存）；另一份让各层查询最近一小段内容，称为 **SWA 窗口状态**（SWA 即 sliding window attention，只读取最近固定窗口内位置的滑窗注意力）。两份状态的生成和保存方式不同，从外部缓存找回 `block KV`，不代表各层末尾的滑窗状态也一并保留了下来。

例如，这份说明书的长历史（`block KV`）仍在缓存中，但某层末尾的滑窗状态已经过期或被回收了。接着生成前，必须重新准备这层窗口。**回放（replay）**就是取回原先的 token 编号，再跑一段模型计算把滑窗填满。V4.1 限制回放长度，只重算末尾一小段，以较少工作换取可继续生成的近似状态。下面先看要恢复的东西；为什么只能称为近似，下一节用具体数值解释。

```wiki-diagram
file: swa-replay-state
```

图中的“长历史还在”很关键：回放不是假装模型从来没见过更早的内容。它继续使用已保存的全局 KV，只把缺失的 SWA 窗口补回来。另一方面，恢复出的窗口影响后续计算，因此不能把“没有覆写旧 block KV”理解为“新输出绝不会变”。

## 只回放三个位置，究竟少看了什么

把真实窗口缩成 **3 个位置的教学例子**。我们要恢复位置 7、8、9，从 7 开始回放，并约定当前窗口可以包含当前位置。完整计算和有界回放的差别如下。

| 正在计算的位置 | 完整 SWA 能读什么 | 从 7 开始回放时能读什么 |
| --- | --- | --- |
| 7 | 5、6、7 | 7 |
| 8 | 6、7、8 | 7、8 |
| 9 | 7、8、9 | 7、8、9 |

前两个位置少看了窗口边界外的资料。位置 9 的编号范围虽然相同，但若上一层算出的 7、8 的向量已改变，下一层读到的就是不同输入，无法保证得到相同结果。这就是为什么“末尾已经凑齐一个窗口”不能证明逐层数值恢复精确。

把变化算出来会更直观。令位置 5、6、7、8、9 的输入值为 0、0、6、6、6；每层暂用“对窗口里的值取平均”代替真实模型计算。这个教学算子只演示依赖怎样传播，真实 attention 还会计算权重，不能用均值预测真实误差大小。

```wiki-diagram
file: swa-replay-intuition
```

完整计算时，第一层位置 7 读到 $(0,0,6)$，位置 8 读到 $(0,6,6)$，位置 9 读到 $(6,6,6)$。从 7 开始回放时，只剩后面三个 $6$。进入第二层，位置 9 在两条路径中都读编号 7、8、9，却读到了不同的值：

$$y^{(2)}_{\text{full}}(9) = \frac{2 + 4 + 6}{3} = 4, \qquad y^{(2)}_{\text{replay}}(9) = \frac{6 + 6 + 6}{3} = 6$$

| 层与位置（窗口 $W = 3$ 均值示意） | 完整计算算式与结果 | 从位置 7 有界回放算式与结果 |
| --- | --- | --- |
| 第 1 层位置 7 | $(0 + 0 + 6) \div 3 = \mathbf{2}$ | $6 \div 1 = \mathbf{6}$ |
| 第 1 层位置 8 | $(0 + 6 + 6) \div 3 = \mathbf{4}$ | $(6 + 6) \div 2 = \mathbf{6}$ |
| 第 1 层位置 9 | $(6 + 6 + 6) \div 3 = \mathbf{6}$ | $(6 + 6 + 6) \div 3 = \mathbf{6}$ |
| 第 2 层位置 9（读 7、8、9） | $(2 + 4 + 6) \div 3 = \mathbf{4}$ | $(6 + 6 + 6) \div 3 = \mathbf{6}$ |

窗口边界上的差异就这样传到了后面的层。若要精确恢复第二层末尾，必须补齐它所读的第一层状态；为了得到这些状态，又得往前补第一层的输入。这就是多层依赖会向前延伸的原因。

一般地，回放起点为 s、当前位置为 i、窗口长 W 时，可见起点取 s 和 i−W+1 中较大的那个。表中位置 8 原本从 8−3+1=6 开始；回放后从 max(7,6)=7 开始，因此从三个位置变成两个。可见范围和数值传播是两项检查：前者正确，不等于后者与完整计算相同。

差异是否损害任务质量，要用具体模型、输入和任务评测判断。V4.1 的报告给出自身评测与训练适配，其他滑窗模型也需要各自验证。

## Encoder 与 decoder 回放解决的是两件事

这里的 encoder、decoder 是语言模型的前半层和后半层，不是图片编码服务。V4.1 采用 **CED（Cross-layer Encoder-Decoder）** 架构：前半层（encoder）输出一次性为后半层（decoder）准备好全局共享 KV，而后半层的 SWA 滑窗仍需逐层维护。开源实现里用 **YoCo** 命名这套“前半产全局、后半共享读”的处理路径（不能仅凭名字把所有 YOCO 论文变体都当成 V4.1）。

| 路径 | 何时需要 | 回放后得到什么 |
| --- | --- | --- |
| Encoder SWA bounded replay | 命中了 block KV，却没有对应的前半 SWA 状态 | 重放命中前缀末尾，再和未命中后缀一起前向；旧 block KV 保留，回放段重建 SWA，新增后缀产生新的两类历史 |
| Decoder SWA bounded replay | Prefill 后半仍需准备窗口，才能进入 decode | 只让保留的 prompt 末尾经过后半层；窗口服务当前生成，不进入前缀缓存 |

报告用 128 个位置描述窗口回放，相比精确恢复后半 20 层所述的 2560 个位置，主要节省了需要送入这些层的历史长度。但回放仍经过相应层，算量仍受层数、宽度和具体算子影响。生产文章的“常数开销”应理解为**固定模型下不随已命中上下文长度继续增长**，不能解释成层数增加也完全没有代价。

报告把 V4 时代的 **Zero SWA Caching（零滑窗缓存）** 作为前身：完全不保存滑窗状态，每次命中后都精确重算来重建窗口，精度零误差但重建成本较高。V4.1 改为短期保存前半层窗口，缺失时改走有界近似回放。因此这两个名称对应的并不是同一种恢复保证。

## 128、134、140 为什么不能当成同一个参数

三个数字分别服务于窗口语义、状态回退和执行留存。模型结构的完整数字统一在[模型配置页](deepseek-v4-1-flash.md#固定配置里哪些数字属于哪一部分)。

| 数字 | 本快照中的含义 |
| --- | --- |
| 128 | SWA 窗口长度；生产文档也以 128 为状态保存和 block KV 的位置粒度 |
| 134 | 生产说明中的窗口环：128 个窗口位置，加 6 个推测回退余量 |
| 140 | 开源 README 推荐给 decoder 截断的保留长度；是一个满足约束的设置，不是把模型窗口改成 140 |

实际保留长度至少覆盖“窗口 + 当前最大回退长度”。回退设置改变，就要重新检查约束；不能把固定的 134 当成所有运行模式的槽位大小。启用相应保存路径时，运行时还会为 prefill 锚点增加额外空间，源码中的状态布局与持久化长度也因此不同。

开源快照还会把最大回退长度取为“用户值”与“推测步数 + 1”中较大者。推测步数默认 5，对应至少 6 个回退位置，因而有 `128 + 6 = 134` 这个组合；调整推测步数后，不能只改保留长度而不重新检查实际回退值。执行入口会检查保留长度确实覆盖窗口与回退之和。

再看命中策略的**教学输入**：长度 $L = 1000$，生产规则先给命中长度留出 134 个末尾位置。假设前面的 block KV 都可复用，先向下对齐到 128 的块边界，再查对应 SWA：

$$L_{\text{hit}} = \left\lfloor \frac{1000 - 134}{128} \right\rfloor \times 128 = 768, \qquad L_{\text{replay}} = 768 - 640 = 128$$

| 步骤（$L = 1000$，块粒度 128，留尾 134 示意） | 算式 | 结果 |
| --- | --- | --- |
| 命中上限 | $1000 - 134$ | **866** |
| 按完整块向下对齐 | $\lfloor 866 \div 128 \rfloor \times 128$ | **768**（位置 0–767） |
| 若对应窗口缺失，后退一块 | $768 - 128$ | **640** |
| 需要回放的已命中部分 | $768 - 640$ | **128 个位置**（位置 640–767） |

这里的 768 是命中长度。按位置从 0 开始计数，原先命中的是位置 0–767；后退后，重算位置 **640–767，共 128 个**，用于补窗口，位置 **768–999，共 232 个**才是原先未命中的后缀。两段都需要计算，但前一段是“历史已命中、窗口缺失后回放”，后一段是“新输入”，应分别记录。该规则来自生产架构说明，公开仓库未包含完整外部缓存服务，不能仅运行离线示例就声称验证了线上命中路径。

```wiki-diagram
file: swa-bounded-replay-fig-window-modes
```

上图把前几节最容易混淆的四件事收束在一起：多层边界误差为何会传到位置 9、`128 / 134 / 140` 各自的口径、`L = 1000` 的三段区间划分，以及下一节用来定位偏差的 `off / mask / compact` 三模式对照。

## 结果不一致时，用三种模式分开查

下面还会核对 **CP（context parallel）**，即把上下文位置分给多张卡处理。切分方式会影响每卡保留哪些回放行，以及边界处怎样交换数据。

开源实现区分 **off、mask、compact**。off 不做这项后半截断；mask 保留完整输入行，只限制 SWA 的可见范围；compact 在保持同样可见范围的同时，真正移除不再需要计算的输入行。mask 是很有用的对照，因为它把“改变可见历史”和“更换紧凑布局”分开了。

compact 仍要处理分块边界：某个早期 chunk 整段落在末尾保留区间之前时，会留最后一行作占位，这行不写入 SWA 环；不能把它的输入行数理解成零。短输入本来全部落在保留范围内，就不减少行数。是否省掉工作，要看该请求与该分块的实际范围。

```wiki-diagram
file: swa-replay-flow
```

先固定模型文件、输入编号和同一条参考输出轨迹，逐位置比较分数。**参考轨迹**指每步都喂入同一份已确定的前缀，避免第一处输出不同后，两边越走越远。

| 对照结果 | 支持什么判断 | 下一步 |
| --- | --- | --- |
| mask 与 compact 在保留区间不一致 | 两种等价布局的实现或配置可能有问题 | 比较保留行、原始位置、可见 key 和写入槽位；核对 CP 切分、权重与二进制版本 |
| 两者一致，但与 off 有差异 | 差异可能来自共同采用的窗口截断 | 用业务质量集评估可接受程度，并定位首次分歧；不能归罪于 compact 搬运本身 |
| compact 数值符合预期，但速度没变 | 被省掉的工作可能不在主要等待上 | 看后半实际输入数、短长请求比例和设备时间；再追调度、通信与状态搬运 |

验收分两层：先证明同一截断语义下的实现一致，再评估截断相对完整前向的质量与收益。**mask/compact 等价不等于回放与完整重算等价。** 若业务不接受这份近似，应选完整路径，并重新测量其延迟与容量代价。

## 放回 GLM 双机，不能直接套哪一步

[固定 GLM 双机](glm-5-3-flash-two-node.md#部署前提)有自己的 KDA 与稀疏 MLA 状态；它们的恢复条件应分别查[KV cache](kv-cache.md)及模型主线。这里可以复用“保存了什么、缺了什么、恢复后是否精确”的分析顺序，不能给 GLM 任意加一个“只重算最后 128 个”规则。

## 常见误解

- **“窗口短，恢复一定精确又便宜。”** 多层依赖会向前扩展；有界回放明确接受截断近似。
- **“缓存命中位置不同，结果就必须逐位相同。”** 该模型的近似恢复会使新增后缀的状态依赖命中位置。
- **“通过 mask/compact 测试就完成质量验收。”** 它验证相同截断语义下的实现，不测截断本身是否满足任务质量。
- **“140 是默认窗口。”** 模型窗口、回退余量和执行保留长度是三种口径。

## 对照源码

### 怎么开

本快照环境定义的 `DEEPINFER_YOCO_PREFILL_TRUNCATION_MODE` 默认是 `off`；README 的启用示例设为 `compact`，同时设置 `DEEPINFER_YOCO_PREFILL_KEEP_TOKENS=140`。保留长度环境定义默认 0，启用时须显式指定，且覆盖窗口加最大回退长度。排查布局时用 `mask`，其可见域相同但不省去完整行计算。

两个实验都从固定 DeepInfer 仓库根目录运行，并使用这份源码编译的扩展。L1 对照入口为 `python examples/yoco/yoco_equiv.py mask-compact --keep-tokens 140 --window 128`；它不加载权重，但准备元数据使用锁页内存，仍须一张可见设备，固定脚本用 `CUDA_VISIBLE_DEVICES` 指定。它检查可见 key、位置、存储槽位和压缩 key 区间，不是纯 CPU 的字符串比较。

L2 用 `examples/yoco/run_yoco_equiv_l2.sh --model_name /path/to/compatible-v41-hf`，官方默认方案使用8个设备及兼容的 V4.1 HF YoCo checkpoint。调整 `--ep`、`--cp` 时，CP数须能整除EP数；两次运行除截断模式外，所有 `DEEPINFER_*` 环境变量都应相同，再比较固定轨迹的 logprob 与 top-K。MTP对照只支持配套的 DFlash+YoCo checkpoint；confidence 随每轮末token输出且滞后一轮，首轮为空、最后一次前向的confidence未进入输出，不能声称它覆盖了全部轮次。完整步骤见[固定版本的等价性实验指南](https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/examples/yoco/README.md)。本站没有这些设备实验的运行结果。

### 会报什么错

模型须满足后半 consumer 层存在的配置条件。若扩展缺少 `PrepareArgs.yoco_prefill_truncation_mode`，先核对 Python 与编译扩展是否来自同一份源码；不能只更新 Python 后忽略旧二进制。保留长度不足、位置映射错误和写入槽位错误也必须分别检查。

### 开销和什么时候别开

compact 增加输入选取与元数据整理；CP 大于 1 时还涉及边界重分布。mask 保留完整行计算，适合数值对照。短输入、质量容忍度不足或硬件路径未验证时，先保留完整基线再决定是否使用截断。

### 版本差异

DeepInfer `774ce244` 的 `off` / `mask` / `compact` 环境变量与 `yoco_equiv.py` 实验命令属于 DeepInfer 固定快照，不能直接套用到 vLLM Ascend。以下按知识库四版本正式钉点核对 vLLM 与 vLLM Ascend 中的 SWA（滑动窗口注意力）与 DeepSeek V4.1 有界回放状态边界：

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| DeepSeek V4.1 与 SWA 环形状态 | 无 `models/deepseek_v41/` 与 CED 有界回放实现 | 同左 | 引入 `models/deepseek_v41/cache_config.py#L27-L60`（`STATE_RING_ROWS = 32` 与 `make_swa_cache_spec`，A5 打包为 `a5_mxfp8_bf16_scale`），**尚无 `decoder_replay_state.py` / `bounded_replay` 开关** | `cache_config.py#L30-L63` 在 `make_swa_cache_spec` 新增 `bounded_replay=False` 参数，并新增 MRV2 解码器有界回放子批收拢模块 `decoder_replay_state.py#L36-L70`（`DecoderReplayInputs` / `DecoderReplayState`）与 `decoder_replay_layers.py#L19-L35`（`AscendDecoderReplayLayers`） |
| 通用 SWA 缓存规格与注意力算子 | GLM 主线不采用 CED 恢复方案；上游管理普通滑窗 KV | 同左 | 上游 `SlidingWindowSpec`（`kv_cache_interface.py#L807-L815`）配合 Ascend `attention_v1.py#L633-L635`（`sparse_mode=4`、`pre_tokens=sliding_window`、`next_tokens=0`） | 上游 `SlidingWindowSpec`（`kv_cache_interface.py#L900-L908`）与 Ascend `attention_v1.py#L673-L679` 延续 SWA 掩码配置 |
| DeepInfer `774ce244` 环境变量边界 | 不适用 DeepInfer 环境变量 | 不适用 | DeepSeek V4.1 Ascend 部署教程与 runner 条件见[模型页的版本差异](deepseek-v4-1-flash.md#版本差异)，不沿用 `DEEPINFER_YOCO_*` | 同左；vLLM Ascend 侧通过 MRV2 `DecoderReplayState` 实现紧凑子批回放，不沿用 `DEEPINFER_YOCO_*` |

### 源码位置

- 报告 §2.2、§3.2.2 说明多层依赖、两个回放路径及近似性质 [S1]；生产命中、窗口保存与回退规则 [S2]。
- DeepInfer 默认值与窗口覆盖约束在环境定义 [C3]；两种可见域与紧凑 metadata 在 `YocoMetadataMixin` [C4]，边界数据选取在 `compact_yoco_boundary` [C5]；运行时环与附加空间见 `get_inference_swa_block_size`、`get_kvstore_swa_block_size` [C7]；启用推荐与 L1/L2 等价性实验见 [S6][S8]；C++ 逐 chunk 裁剪、占位行与 L1/L2 校验见来源 9–11。
- vLLM 与 vLLM Ascend 四版 SWA 规格与 `deepseek_v41` 有界回放演进见来源 12–19：`vllm@ced6857a:vllm/v1/kv_cache_interface.py#L807-L815`、`vllm@ba15685a:vllm/v1/kv_cache_interface.py#L900-L908`、`vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/cache_config.py#L27-L60`、`attention/attention_v1.py#L633-L635`，以及 `vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/cache_config.py#L30-L63`、`decoder_replay_state.py#L36-L70`、`decoder_replay_layers.py#L19-L35` [C14][C16][C17]。
- 窗口 3 和 $L = 1000$ 为教学假设 [A]，可见范围与命中长度为推导 [D]；生产文档的命中规则尚无本站外部缓存服务实测。
