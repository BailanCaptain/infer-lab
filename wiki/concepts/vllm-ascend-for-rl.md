---
id: vllm-ascend-for-rl
title: vLLM-Ascend for RL：生成样本后，怎样安全换上新权重
type: feature
legacyAnchors:
  glm-双机的一条请求会走进-rl-更新吗: 复杂异构与多机边界对照：GLM 双机接入 RL Rollout 的四道关卡
summary: >-
  RL 训练框架用 vLLM-Ascend 生成样本，再把新权重交回推理端。本页串起暂停、同卡与跨卡权重传输、训练数据返回和数值一致性，并对比
  v0.30.0 / main 统一 rl_config 与多机异构 MoE 接入边界。
aliases:
  - RL
  - Reinforcement Learning
  - 强化学习
  - RLHF
  - GRPO
  - PPO
  - VERL
  - OpenRLHF
  - rollout
  - rl_config
  - 权重同步
  - 训推协同
  - npu_ipc
  - sparse_hccl
  - Router Replay
  - R3
  - Trace Replay
  - tokens-only
chapters:
  - '19'
order: 60
sources:
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L1-L60'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L62-L197'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L199-L240'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L242-L367'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L236-L299
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L248-L341'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L296-L358'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/hccl_engine.py#L30-L209
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L153-L222
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1340-L1382'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L282-L374'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L681-L694'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L282-L374'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L268-L364'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_weight_transfer_engine.py#L18-L73
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_weight_transfer_engine.py#L18-L73
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L40
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L1-L59
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L150-L165'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L165-L177'
  - 'vllm@84030bbe:vllm/entrypoints/serve/dev/rlhf/api_router.py#L29-L80'
  - >-
    raw:sha256-1820e1d48b11998ebd3a38a24f92aa6c878edf3647c118e64d82fc085b3bfc7e.md#L1-L1540
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/worker.py#L352-L357
  - >-
    vllm@84030bbe3d74d99bad477a3d2e37a973ccd8865c:vllm/entrypoints/serve/dev/rlhf/api_router.py#L29-L45
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L365-L395'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L314-L363'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L850-L858'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L40
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L246-L299'
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L63-L71
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L242
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L159-L170
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/weight_transfer/hccl_engine.py#L147-L152
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/weight_transfer/hccl_engine.py#L213-L217
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L318-L358'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/rl.md
  - 'https://docs.vllm.ai/en/latest/training/weight_transfer/nccl/#sparse-nccl'
  - 'vllm@84030bbe:vllm/distributed/weight_transfer/factory.py#L84-L119'
  - 'vllm@84030bbe:vllm/distributed/weight_transfer/factory.py#L218-L230'
  - 'vllm-ascend@baa023ad:vllm_ascend/__init__.py#L77-L85'
  - 'vllm-ascend@baa023ad:examples/rl/rlhf_http_npu_ipc.py#L1-L217'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L261-L290'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/packed_tensor.py#L271-L325'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L172-L228'
  - 'vllm@84030bbe:vllm/distributed/weight_transfer/base.py#L493-L504'
  - 'vllm@84030bbe:vllm/entrypoints/scale_out/factories.py#L66-L102'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L240-L257'
  - 'https://github.com/vllm-project/vllm-ascend/blob/182ea0448550a970e4f0ae3624fe35e38b37bc80/examples/rl/rlhf_sparse_hccl.py'
  - 'vllm-ascend@baa023ad:examples/rl/rlhf_http_hccl.py#L1-L302'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L837-L860'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L301-L363'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L245-L255'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1475-L1500'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L488-L508'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1627-L1639'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L363-L395'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1467-L1483'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L40'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L379-L410'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1754-L1770'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L52'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/weight_transfer/sparse_hccl_engine.py#L90-L125'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: sleep-mode
    kind: builds-on
    note: 同卡训练与生成交替时，先理解显存释放、分阶段唤醒与权重恢复的顺序
  - to: one-request
    kind: builds-on
    note: RL 沿用生成请求的七站；本页补充两轮生成之间的权重更新
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 固定双机是在线推理部署，未配置训练端和权重传输
  - to: batch-invariance
    kind: builds-on
    note: 需要稳定 rollout 时继续核对批不变的算子与调度限制
  - to: attention-backend-family
    kind: builds-on
    note: 训推一致选项走 FA3，适用模型与后端拒绝条件见该页
  - to: expert-parallel
    kind: builds-on
    note: 先理解专家选择与执行，再区分 Router Replay 返回的是哪些记录
  - to: ascend-patch-system
    kind: builds-on
    note: 旧版本通过工厂 patch 将 nccl 和 ipc 名称映射到 Ascend 后端
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-1820e1d48b11998ebd3a38a24f92aa6c878edf3647c118e64d82fc085b3bfc7e.md
  - >-
    raw/sha256-5ab006317879ae50dc82cf112a5be69423c448f9a4c3ce01fdf493366bed8b0d.md
---

## 模型生成一批回答后，怎样用它继续学习？

**RL（Reinforcement Learning，强化学习）让训练框架根据回答得到的评分更新模型；vLLM-Ascend 在其中负责 rollout（采样生成），也就是用当前模型批量生成训练样本，并在下一轮生成前安全接收训练端同步过来的新权重。** 权重是决定模型怎样计算的参数；训练端修改它，推理端使用它。图中的 token 是分词后的文本单位，token ID 是它的词表编号。

```wiki-diagram
file: vllm-ascend-for-rl-cycle
```

在 **PPO**、**GRPO** 等常见在线强化学习后训练流程里，训练框架每轮都要驱动推理引擎完成高频 **rollout + 权重同步**：**PPO**（Proximal Policy Optimization，近端策略优化）借助价值网络和样本对数概率计算优势并限制单步更新幅度；**GRPO**（Group Relative Policy Optimization，组相对策略优化）则对同一道题并行采样一组回答，靠组内相对打分省去独立价值网络。以训练模型解数学题为例，训练框架（如 VERL、OpenRLHF）提交问题，推理端生成单条或整组解答并附上 `token ID` 与对数概率；评分程序检查答案后，训练端据此反向传播更新权重，再把新权重同步回推理端，下一批题便由更新后的模型回答。评分、训练算法和优化器属于训练框架；这篇官方特性指南解决的是推理端如何配合这一循环。

一条样本仍经过[单请求第 2 站的调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)、第 4 站前向、第 5 站采样和[第 7 站返回](one-request.md#第-7-站-返回与收尾)。RL 多出来的环节在两轮生成之间：暂停调度，让 worker（执行模型的进程）装好新权重，再恢复生成。下文以 `v0.30.0` 主基线（与当前 `main` 一致）的统一 `rl_config` 配置讲组合方法；`main` 后续新增的稀疏更新与轨迹重放单列说明，旧分支和 GLM 固定代码的差异集中在页末。

## 为什么 RL 需要推理端配合，代价花在哪里？

**RL 中，生成的一批回答还要交回训练端，用来改变下一轮回答所用的模型。** 仍以解数学题为例：训练端刚根据评分改好参数，推理端就需要接过来回答下一批题；每轮都重启服务会反复付出初始化代价，所以需要不重启就换权重，并能在交接时暂停生成。若训练和生成共用一张卡，训练做前向、反向计算时还需要显存，推理端就得暂时让出空间。

**训练要消费的是可用于计算的样本，而不只是可读的答案。** 训练端需要原始 token ID，省去文本往返时的重复分词；按训练方法，还需返回 token 概率，以及 MoE（每个 token 只选部分专家计算的模型）的专家选择记录，才能比较或重放生成时的行为。批次组合引起的数值变化也会干扰这种比较，因此还要按训练方法选择可复现的计算路径。权重交接、显存让出、数据返回和数值一致性，分别对应这条循环中的不同需要。

**一次回答应使用训练框架预期的权重版本；更新时继续生成，会让请求读到旧权重、新权重，甚至尚未换齐的模型。** 权重按一组或多组传输，不是所有层在同一瞬间一起替换。换完一层就放行请求，后面的层可能还没更新。

官方提供 **3 种暂停方式**。abort 立即终止在途请求；wait 等已有请求完成再暂停；keep 把请求冻结，恢复后接着生成。需要一条样本全程使用同一版权重时，选择前两种。keep 保留的 token 和 KV cache——模型为历史 token 保存的计算结果——可能来自旧权重；换权重后直接续写会把两个版本接在一起。当前接口的清缓存参数对 keep 不生效。

wait 的代价是等待尚未完成的请求，abort 的代价是丢掉这些未完成的样本。其后还要等待权重传输、装载和必要的后处理。跨卡更新使用 HCCL（昇腾卡间通信库）：训练端广播权重，所有参与接收的 worker 必须按约定顺序完成通信。这发生在更新边界，不是每生成一个 token、每经过一层都再向训练端取权重。

| 动作 | 改变什么 | 仍然需要什么 |
|---|---|---|
| pause / resume | 暂停、恢复请求生成 | 另行传输权重；暂停本身不释放全部显存 |
| sleep / wake up | 释放、恢复推理端的设备内存分配 | level 2 丢弃权重后，要先装入新权重 |
| weight transfer | 将训练端参数装到推理模型 | 协调暂停、完成更新后再恢复 |

## 训练端和推理端怎样交接显存与权重？

**先看两端是否共用同一张物理 NPU，再选传输方式。** 同一台机器上的两张不同卡仍属于跨卡；判断两个进程是否同卡，要看逻辑设备编号映射后的物理芯片，而非仅比较编号。

下面这张图把同卡轮占（`sleep` + `npu_ipc`）与跨卡常驻（`pause` + `hccl` / `sparse_hccl`）两条交接路径放在同一视野中对照。下半区同时标出 `v0.30.0` / `main` 中 `RlConfig.apply()` 自动执行的三项强制护栏（关闭 `FRACTAL_NZ`、剥离 `expandable_segments`、开放开发端点）与三项默认关闭的子开关：

```wiki-diagram
file: vllm-ascend-for-rl-fig-handover-guardrails
```

两条交接路径的核心分工如下：

- **共用物理卡：轮流占显存，使用 `NPU IPC`。** IPC 是进程间共享设备内存的机制：发送端提供句柄，接收端据此重建张量并交给模型装载。同卡训练通常让 rollout 引擎 [sleep](sleep-mode.md) 以让出显存，两级睡眠的区别见[睡眠模式](sleep-mode.md)及[额外清理参数页](../params/enable-sleep-mode-extra-cleanup.md#为什么存在)。
- **使用不同物理卡：保留推理端内存，使用 `HCCL`。** 训练和 rollout 有各自设备，通常无须为了训练而 sleep。初始化时建立训练端与所有推理 worker 的通信组；更新时训练端发送，worker 接收并装载。通信组规模包括发送方，不能只填推理卡数。HCCL 后端在计算 worker 的通信编号时还计入 DP 组偏移，避免不同 DP 组内相同的局部编号撞在一起。

下面只演算接口里的参与者计数：假设有一个发送进程、两个接收 worker，发送方编号从零开始，接收方偏移为一（教学拓扑，和 GLM 双机卡数无关）：

$$\text{world\_size} = 1_{\text{trainer}} + N_{\text{workers}} = 1 + 2 = 3$$

| HCCL 权重更新通信组角色（教学示意） | 算式 | 编号 / 规模 |
| --- | --- | --- |
| 通信组总规模 | $1\text{ 发送进程} + 2\text{ 推理 worker}$ | **3 个参与者** |
| 第 1 个推理接收 worker | $0 + 1$ | **rank 1** |
| 第 2 个推理接收 worker | $1 + 1$ | **rank 2** |

传输的数据还包括参数名称、数据类型和形状。HCCL 的普通路径逐个接收权重、调用模型装载，再释放临时张量；**packed 路径**把多个张量打包进连续缓冲批量发送，减少通信调用，打包参数（缓冲大小与缓冲个数）随更新信息由发送端下发，接收端直接取用。NPU IPC 按物理设备标识查找句柄，再由模型装载；“同机”不能代替“同卡”这一前提。早期社区主干的普通 IPC 路径有装载调用，packed 路径却缺少这一步，不能把传输返回成功当作模型已更新；`v0.30.0` 与当前 `main` 的对应路径已补齐，具体版本条件见页末。


固定镜像接收并加载权重后会等待相关 NPU 工作完成：HCCL 广播和 packed 传输可异步提交，这里的同步保证该更新流程返回前设备工作已完成。在途请求怎样暂停、何时恢复生成，仍由外层训练与服务流程协调。

## 除了回答文本，训练端还需要什么？

**训练端通常需要知道模型生成了哪些 token、各 token 的概率，以及特定训练方法需要的内部选择。** 只有显示文本时，训练端还得重新分词，而且文本与原始编号未必能无损往返。

**log probabilities 表示模型对 token 的概率取自然对数。** 训练框架可据此比较生成时的模型与更新后模型的行为。生成 token 的记录与 prompt 的记录是两类数据，要按需请求；官方指南明确 prompt logprobs 不支持流式 completions。一次要返回多少候选、返回的是哪些 token，应与训练框架的计算约定对齐，不能把概率记录当成回答评分。

**Router Replay（R3）保存 MoE 每个位置选中的专家，供训练端重放这些选择。** MoE 让每个 token 只经过部分专家，分工见[Expert Parallel](expert-parallel.md)。推理服务负责捕获并返回选择，训练框架负责消费记录并重放。非流式 completion 的记录是 **base64**（把二进制数组编码为纯文本字符串放进 JSON 响应的格式）编码的 NumPy 数组；解码后的三维依次是“记录的 token 位置、模型层、每位置选中的专家”。官方形状为 `(num_tokens - 1, num_layers, num_experts_per_tok)`：最后采样出的 token 还没走过模型，所以没有对应路由。未启用捕获，或请求在前向前被终止，字段可以为空。只有训练端确实使用这些记录时才启用。

**tokens-only API 直接收发 token ID。** main 指南把它列为实验接口，启动普通服务时另行开启，输入中提供请求编号、token ID 和采样设置，响应包含生成编号及按配置返回的概率、路由等字段。这省掉重复分词，不会替训练框架完成更新算法。

**agentic RL 的工具交互由外部环境闭环。** 模型生成工具调用后，环境执行工具、把结果追加到对话，再提交下一轮请求。要选与模型匹配的工具解析器。若外部路由器需要指定 DP（Data Parallel，分配请求的执行组），可以传递目标 DP rank；rank 是组编号，取值必须存在于实际部署。请求路由和 MoE 的专家选择解决不同层面的问题。

下表汇总 RL 训练端按算法向推理端索取的四类核心信号与关键前提：

| 训练信号 / 能力 | 推理端返回或执行的内容 | 关键边界与前提 |
| --- | --- | --- |
| `logprobs` / `prompt_logprobs` | 生成或提示词 token 的对数概率 | `prompt_logprobs` 不支持流式 completions；不等同回答评分 |
| Router Replay（R3） | `(num_tokens - 1, num_layers, num_experts_per_tok)` 专家选择数组 | 仅非流式返回 base64 NumPy；`v0.30.0` / `main` 须配 MRV2 |
| `tokens-only` API | 直接收发 `token_ids` 与概率/路由字段 | 省去重复分词；实验端点，不可把 `VLLM_ENABLE_SCALE_OUT_ENDPOINTS` 置 0 |
| Trace Replay（`921ccc52`+） | 按预定 `trace_decode_token_ids` 推进并记录真实分布 logprobs | 与 R3 的“捕获专家选择”不同；仅支持 Model Runner V2 |

## 为什么“训推一致”和“批不变”要分开选择？

**两者解决不同来源的数值差异，统一 RL 开关不会自动把它们都打开。** 当未启用 prefill context parallel（将长输入分给多卡处理）时，训推一致选项会让支持的模型切到 FA3 attention backend，以对齐训练侧 attention 的计算方式。这里的 FA3 是特定注意力实现，适用范围见[attention backend](attention-backend-family.md)。它需要总开关与一致性子开关同时开启，还要有额外软件包；不能把不支持的 MLA 或稀疏 attention 也切过去。

batch invariance（批不变）则减少同一请求因批大小、批内伙伴或顺序变化产生的数值差异；其算子、图模式和调度限制见[批不变页](batch-invariance.md)。开了 FA3 不等于开了批不变，反过来也一样。统一配置里的批不变字段关闭时，已有的批不变环境变量设置仍保留。

这些选项以更严格的计算路径换取数值一致性，代价包括吞吐损失或额外初始化工作。RL 的需要是让生成端和训练端拿到可解释、可比较的数据，实际选择仍由训练算法、模型结构与部署方式决定。

## 新版怎样只更新部分权重，或重放指定 token？

**下面两项属于 `v0.30.0`（`c09d3e20`）发布之后，在社区 `main`（`8d6180e2` / 官方指南 `921ccc52`）合入的新能力——`v0.30.0` 仅注册整权重的 `hccl` 与 `npu_ipc`，不含 `sparse_hccl`。** Sparse HCCL 用于跨 NPU 只广播选定的权重元素：补丁按 checkpoint 的参数名、完整形状和扁平索引描述，值是替换值，接收端再由模型加载器映射到本地 TP/EP 分片。训练端和推理端必须从同一 checkpoint 起步，否则未被替换的部分就不同。少传元素节省的是通信载荷，装载与临时空间不保证按同一比例减少。

该指南要求未量化的 **ND 权重**（普通稠密行主序内存排布，区别于昇腾分形排布 `FRACTAL_NZ`）、固定专家放置且关闭 EPLB；不支持 PP、FRACTAL_NZ、融合 MC2 专家权重列表、草稿模型和 packed sparse 更新。原地更新失败后保持生成暂停，恢复共同基线或重启引擎，不能拿只更新一部分的模型继续生成。因此这不是固定 GLM W8A8 部署的直接替换方案。

**Trace Replay 则固定生成路径，用于记录这条路径上的真实概率。** 请求给出一串预定 token，执行时按它们推进，仍用模型原始 logits 分布计算这些 token 的 logprobs。它与前文 Router Replay 的“返回专家选择供训练重放”不同，也不等于模型自行采样时会生成同一串文字。指南仅支持 Model Runner V2，服务端和请求端都要配置，不能只传 token 列表。

## 复杂异构与多机边界对照：GLM 双机接入 RL Rollout 的四道关卡

标准稠密模型（如 `Qwen3-8B`）接入 RL 只需对齐 `rl_config` 与权重传输组；换到同时带有混合注意力、`EP16` 跨机专家与 `W8A8` 量化的异构部署时，就会连环触及算子与分片边界。拿例外 B 的[固定 GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)对照（该教程为纯在线推理，未配置训练端、`sleep`、`rl_config` 或 `weight_transfer_config`，源码不会创建传输引擎；双机前向中的 TP/EP 通信只服务于单版权重推理，卡数与权重账见部署页）：

若要把这类异构多机服务改造成 RL rollout 节点，必须逐一跨过四道工程关卡：

1. **新旧 RL 配置接口差异**：历史绑定镜像只含旧权重更新接口，没有 `v0.30.0` / `main` 的统一 `RlConfig`，直接照抄新版 `rl_config` 字段不会生效；且每轮更新边界必须协调全部 16 个跨机 worker 同步切换权重版本。
2. **`FA3` 训推一致分支拒绝 `MLA / SFA`**：即便迁到支持 `rl_config` 的 `v0.30.0` / `main`，打开总开关会同步改写权重布局与分配器环境；若在未启用 prefill context parallel（PCP）的条件下再开 `enable_training_consistency=true`，GLM 使用的稀疏 MLA（SFA）不符合 `FA3` 条件，启动校验会直接报错拒绝（启用 PCP 虽会绕开该分支检查，但并不等于获得了 `FA3` 训推一致能力）。
3. **混合注意力批不变覆盖缺口**：`34` 层 KDA 线性注意力与 `mHC` 自定义算子的批不变覆盖边界须按[批不变专页](batch-invariance.md#复杂异构实战对照glm-双机混批跨度与三处算子覆盖边界)单独核对。
4. **`W8A8` 量化分片同步待验证**：跨卡更新 `W8A8` 权重时，量化 scale/offset 元数据、`TP8 / EP16` 各分片映射与真实训练框架的端到端联调均须独立实测，不能把稠密小模型传输示例当成异构量化大模型的验收依据。

## 哪些理解最容易出错？

- **“开启 RL 就开始训练。”** 它配置推理端的协作能力；评分、梯度计算和优化器仍在训练框架。
- **“暂停后就有空闲显存。”** pause 控制调度，sleep 管内存；跨卡训练通常只需暂停来保护换权重的边界。
- **“keep 比 wait 更省事，也能保证整条样本一致。”** keep 会保留旧请求的生成状态；若恢复时改用了新权重，同一条样本就跨了版本。
- **“sleep level 2 后唤醒就能继续。”** 权重已经丢弃，必须先恢复权重内存并装入新参数。
- **“开批不变就能保证任意模型、任意配置的训练和推理完全相同。”** 批不变与训推 attention 一致是两项选择，各有模型和算子前提。
- **“推理端返回专家编号就已经完成 Router Replay。”** 返回记录只是前半段，训练端还要消费和重放。

## 对照源码

### 怎么开

以下启动片段对齐 **`v0.30.0` 主基线（`c09d3e20`）与当前 `main`（`8d6180e2`）** 配置契约（以 `Qwen/Qwen3-8B` 演示配置形式，未在设备上执行；早期官方指南 `baa023ad` 以 `Qwen/Qwen3-0.6B` 演示同一组参数）。跨物理卡方案先开启 `rl_config.enabled`，再单独指定 `hccl` 权重传输后端：

```bash
vllm serve Qwen/Qwen3-8B \
  --additional-config '{"rl_config": {"enabled": true}}' \
  --weight-transfer-config '{"backend": "hccl"}'
```

`RlConfig.apply()` 只在 enabled 为真时应用三项默认行为：强制 `weight_nz_mode=0`，关闭 FRACTAL_NZ（为矩阵计算重排的权重布局）；启用开发端点；调用 `_disable_expandable_segments()` 从 NPU 分配器配置 `PYTORCH_NPU_ALLOC_CONF` 中移除 `expandable_segments:*`。**但需注意初始化先后**：如果启动命令**没有**开启 `--enable-sleep-mode`，平台随后在 `check_and_update_config` 尾段的 `_set_pytorch_npu_alloc_env()`（`c09d3e20:platform.py#L542,1445-1464`）会检测到该键缺失并重新追加 `expandable_segments:True`；只有同时开启 `--enable-sleep-mode` 时，`expandable_segments` 才会最终保持移除。三个可选字段都默认 false：sleep_mode_extra_cleanup、enable_training_consistency、enable_batch_invariant。总开关不会自行配置传输引擎，也不会隐式启用 sleep。

同卡方案改用 `backend="npu_ipc"`；这是本页 main 与 rc2 实际注册的 Ascend 后端名，同版本指南中的 ipc 写法没有跟上注册实现。如需 sleep，再加 `--enable-sleep-mode` 并使用 `VLLM_WORKER_MULTIPROC_METHOD=spawn`。HTTP NPU IPC 示例需要 `VLLM_ALLOW_INSECURE_SERIALIZATION=1` 来序列化句柄，只适用于可信环境；开发端点也只能提供给受控的训练系统。level 2 的顺序是 sleep → wake weights → 权重更新 → wake kv_cache → resume，sleep 的 level 与 wake 的 tags 都放在查询参数里。

```wiki-diagram
file: vllm-ascend-for-rl-update
```

图中初始化握手发生在第一次传输前；每轮先等待暂停成功，再调用 `start`、一次或多次 `update`、`finish`，全部成功才 `resume`。在 `v0.30.0` 主基线与当前 `main` 中，`hccl` 与 `npu_ipc` 两套后端均具备 `start` / `finish` 的逐层重载准备与收尾，且 `packed=true` 批量打包路径均已完成模型权重装载（早期快照 `baa023ad` 中 NPU IPC 的 `start`/`finish` 曾为空操作且 `packed=true` 缺装载调用，详见[版本差异](#版本差异)）。传输失败后须调查并恢复完整权重，不能拿只装了一部分的模型继续生成。

控制请求示例：`POST /pause?mode=wait&clear_cache=true`，更新完成后 `POST /resume`。`clear_cache` 已弃用且对 `keep` 无效；收发双方结构可对照钉住的 [HCCL 示例](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/examples/rl/rlhf_http_hccl.py)与 [NPU IPC 示例](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/examples/rl/rlhf_http_npu_ipc.py)。HCCL 发送和接收要协调进行，不能等一个需要对端参加的阻塞通信完成后才启动对端；示例用线程执行 HTTP 接收请求，实际客户端还需把线程中的失败传回主控制流程，线程结束本身不证明请求成功。

**使用 NPU IPC trainer 工厂时，由发送方法包办一轮 start / update / finish。** `trainer_init` 已负责向 worker 发送初始化信息；每轮暂停成功后调用 `send_weights`，成功后再恢复生成，外层不要重复调用 `start` / `finish`。早期 `baa023ad` 同卡示例在 `send_weights` 外又手动包了一次 `start` / `finish`，会在第二次 `start` 触发状态机报错，应按这一顺序修正。

后续上游暂停接口将 wait_for_inflight_requests 标为弃用；需要等待在途请求完成时，使用 wait 模式。迁移这一接口时应核对实际配套版本，不能直接把后续上游签名当成旧镜像接口。


其余能力独立配置：

| 目的 | 入口与条件 |
|---|---|
| 返回概率 | completions 请求中按需设 `logprobs`、`prompt_logprobs`；后者用非流式请求 |
| 返回专家记录 | 服务端 `--enable-return-routed-experts`；非流式响应解码 `choices[].routed_experts` |
| 直接收发编号 | `--tokens-only`，请求 `/inference/v1/generate`，提供 `token_ids` 与 `sampling_params`；显式将 `VLLM_ENABLE_SCALE_OUT_ENDPOINTS` 设为 0 会冲突。普通服务保留其他 API 时，可改设该变量为 1 来注册编号端点 |
| 工具交互 | `--enable-auto-tool-choice` 与模型匹配的 `--tool-call-parser`；外部环境执行工具 |
| 指定 DP 组 | 请求头 `X-data-parallel-rank`；配置已有 DP 服务与外部路由器，没有 `vllm serve router` 或 `--dp-routing-config` |
| 训推 attention 一致 | RL 总开关和 `enable_training_consistency=true` 同开；未使用 prefill context parallel，安装 `flash_attn_npu_v3` 并满足 FA3 条件 |
| 批不变 | RL 配置的 `enable_batch_invariant=true`；匹配的源码构建时设 `COMPILE_CUSTOM_KERNELS=1 VLLM_BATCH_INVARIANT=1`，安装配套算子 |

批不变构建条件取专门指南：预编译 wheel 不包含算子源码，仅在安装 wheel 时设置环境变量不会重建算子。RL 指南给的运行例子采用 PIECEWISE 图模式，其他调度限制继续按批不变页核对。

**rc2 的 Router Replay 还要求 V2 runner。** 配置校验会拒绝 MRV1 的专家记录捕获，因此除了返回开关，还须显式设置 VLLM_USE_V2_MODEL_RUNNER=1，并满足模型与其他功能的 V2 兼容条件。开返回开关或 RL 总开关都不会自动切换 runner；这条 rc2 条件也不能倒推旧 main 的实现范围。

**921ccc52 的两个新增入口。** Sparse HCCL 将 weight-transfer-config.backend 设为 sparse_hccl，并启用 rl_config.enabled。指南的传输组包含一个训练发送进程与 TP×DP 个推理参与者，不再额外乘 EP；发送端序列见该指南所链的 [182ea044 稀疏示例](https://github.com/vllm-project/vllm-ascend/blob/182ea0448550a970e4f0ae3624fe35e38b37bc80/examples/rl/rlhf_sparse_hccl.py)，不能直接使用普通整权重广播的数据协议。示例为 Qwen3 MoE 的首末层、两个专家交换 gate projection 的前两行；训练端须放得下完整 BF16 模型，不能把少传元素理解成训练端只需容纳这些元素。

Trace Replay 在启动前设 VLLM_USE_V2_MODEL_RUNNER=1、VLLM_ENABLE_SCALE_OUT_ENDPOINTS=1，并给 serve 添加 enable-trace-replay。前者选择必需的 runner，后者在普通服务注册 token-in/token-out 端点。向 /inference/v1/generate 发请求，例如：

```json
{"request_id":"replay-01","token_ids":[151644,8948,198],"sampling_params":{"trace_decode_token_ids":[15,284,1026,374],"logprobs":1}}
```

编号须来自现场模型的分词器。验收同时核返回的 token 顺序和对应 logprobs，而非只看回答文本；该示例解释 API 结构，没有验证本站 GLM 模型的 MRV2 兼容性。

### 会报什么错

以下均为源码字符串；拼接字符串按实际报错展开。路径相对于 vllm-ascend 仓库，行号对应给出的 commit。

| 条件 | 原文 | 文件与行号 |
|---|---|---|
| 没有传输配置就初始化或更新 | `Weight transfer not configured. Please set weight_transfer_config to enable weight transfer.` | `baa023ad`，`vllm_ascend/worker/worker.py:296–300` |
| 尚未 start 就发送权重 | `start_weight_update must be called before update_weights.` | 同文件 `339–340` |
| 上一轮未 finish 又 start | `start_weight_update called while a weight update is already active. Call finish_weight_update first.` | 同文件 `322–325` |
| HCCL 接收前没有建立通信组 | `HCCL weight transfer not initialized. Call init_transfer_engine() first.` | `baa023ad`，`vllm_ascend/distributed/weight_transfer/hccl_engine.py:184–185` |
| 未用 prefill context parallel，开启 RL 总开关与训推一致后，FA3 分支遇到 MLA / SFA | `FA3 backend does not support MLA and SFA.` | `baa023ad`，`vllm_ascend/platform.py:247、1365–1366` |

main 开始更新时若最终 NZ 配置仍非零，会抛出：

```text
FRACTAL_NZ mode is enabled. This may cause model parameter precision issues in the RL scenarios. Please set weight_nz_mode=0 via --additional-config, or enable additional_config.rl_config (enabled: true) which disables NZ automatically.
```

位置是 `baa023ad:vllm_ascend/worker/worker.py:309–316`。v0.23、v0.26 和 GLM 固定代码检查的却是环境变量，旧原文为：

```text
FRACTAL_NZ mode is enabled. This may cause model parameter precision issues in the RL scenarios. Please set VLLM_ASCEND_ENABLE_NZ=0.
```

位置分别为 `2c59ff10` 与 `db701c1f` 的 `vllm_ascend/worker/worker.py:295–301`、`2ed6cbba` 同文件 `285–291`。旧版要核对环境变量和实际布局配置是否一致；只改 top-level 的布局字段可能仍被这项检查挡住。

### 开销和什么时候别开

权重更新占用传输带宽、临时张量或打包缓冲，并让 rollout 在安全边界等待。HCCL 普通路径每个参数各做一次广播；打包后的调用数取决于参数量与缓冲容量。IPC 省去跨卡广播，但仍要重建句柄并调用模型装载，不能据此宣称整轮更新零拷贝。

同卡 sleep 的[额外清理](../params/enable-sleep-mode-extra-cleanup.md)可释放 HCCL 进程组和 ACL graph 工作区，代价是唤醒时重建通信组、重新捕获图。只做固定权重在线推理时，没有训练端需要这次交接，保持现有部署即可。批不变、训推一致和专家记录也按训练算法需要逐项选，不把所有选项当成通用性能优化。

### 版本差异

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均通过 `RlConfig.apply()` 统一收口 RL 默认行为。** 只要 `rl_config.enabled=true`，启动阶段立刻执行三项强制动作：① 若 `weight_nz_mode != 0` 则打 warning 并强制清零为 `0`（关闭 `FRACTAL_NZ` 权重布局）；② 调用 `_disable_expandable_segments()` 从 `PYTORCH_NPU_ALLOC_CONF` 剥离所有 `expandable_segments:*` 片段（但若未同时开启 `--enable-sleep-mode`，平台后续的 `_set_pytorch_npu_alloc_env()` 仍会重新补回 `expandable_segments:True`）；③ 写入 `VLLM_SERVER_DEV_MODE="1"` 开启开发端点。三个子开关（`sleep_mode_extra_cleanup`、`enable_training_consistency`、`enable_batch_invariant`）均默认 `false`，不随总开关隐式打开；其中 `enable_batch_invariant=true` 时才写入 `VLLM_BATCH_INVARIANT="1"`。

在权重传输后端上，`v0.30.0` 与 `main` 均修复了早期主干 `baa023ad` 中 NPU IPC `packed=true` 路径漏调 `model.load_weights` 的问题，并补齐 NPU IPC `start/finish` 的逐层重载准备与收尾及 HCCL 重建前关闭旧 communicator；`v0.30.0` 仅注册 `hccl` 与 `npu_ipc`，**`main (8d6180e2)` 进一步注册了 `sparse_hccl` 后端（`sparse_hccl_engine.py`，显式校验 `weight_nz_mode=0` ND 权重）**。Router Replay（`--enable-return-routed-experts`）在 `v0.30.0` 与 `main` 中均强制要求 `VLLM_USE_V2_MODEL_RUNNER=1`。

| 项目 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| RL 统一配置 `RlConfig` | 无 `RlConfig` 与统一 RL 指南 | 同 v0.23.0 | 有 `@config` `RlConfig`（4 个布尔字段默认 `false`） | 同 v0.30.0 |
| `NZ` 关闭与 `expandable_segments` 剥离 | `start` 仅检查旧环境变量 `VLLM_ASCEND_ENABLE_NZ` | 同 v0.23.0 | `RlConfig.apply()` 强制 `weight_nz_mode=0`、调 `_disable_expandable_segments()` 剥离对应项并开 `VLLM_SERVER_DEV_MODE=1`（未开 `--enable-sleep-mode` 时随后 `_set_pytorch_npu_alloc_env()` 会重新补回 `expandable_segments:True`）；`start` 查生效配置 | 同 v0.30.0 |
| 权重传输后端注册 | `nccl` / `ipc` 经工厂 patch 映射 | 保留该 patch | 注册 `hccl` 与 `npu_ipc`（及 `npu_ipc` trainer 工厂）；补齐 `packed` 装载与逐层重载收尾 | 同 v0.30.0，另新增注册 `sparse_hccl`（要求 ND 权重 `weight_nz_mode=0`） |
| 更新 API 与 `sleep` 额外清理 | `start` 带 `is_checkpoint_format`；`sleep` 额外清理为顶层字段 | 同 v0.23.0 | `start` 移除该参数由后端负责重载；`sleep` 额外清理移至 `rl_config` 子字段且依赖总开关 | 同 v0.30.0 |
| 批不变、训推一致与 Router Replay | 分散设置，无统一 RL 开关 | 同 v0.23.0 | 独立子开关（FA3 需无 PCP 且非 MLA/SFA）；Router Replay 校验要求 MRV2 | 同 v0.30.0 |

固定 GLM 镜像 `db701c1f` 不属于上述发布分支，其 worker 权重更新与 `NZ` 环境变量校验与 `v0.23.0` 同源。四版的普通推理服务都不会自动同步权重；`v0.30.0` 与 `main` 同卡场景须写 `backend="npu_ipc"`，上游 `ipc` 不会自动映射为 NPU IPC。

### 源码位置

- **`v0.30.0` / `main` 核心锚点**：`RlConfig.apply()` 强制 `weight_nz_mode=0` 与剥离 `expandable_segments` 见 `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L363-L395`、`platform.py#L1467-L1483`，`main (8d6180e2)` 见 `ascend_config.py#L379-L410`、`platform.py#L1754-L1770`；后端注册与 `sparse_hccl` 见 `c09d3e20:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L40` 与 `8d6180e2:.../__init__.py#L24-L52`、`sparse_hccl_engine.py#L90-L125`。

**官方组合语义。** rollout 分工与部署模式见 [S1]；sleep 顺序、传输生命周期、暂停选择见 [S2]；概率与 Router Replay 的返回格式见 [S3]；tokens-only、工具调用、DP 路由及配置清单见 [S4]；三个可选字段、默认值、旧配置迁移及环境变量保留规则见 [S5]。GLM 的实际双机启动命令见 [S6]。批不变源码构建与 wheel 边界以专门指南 [S19] 为准。

**实现对应。** 总开关应用见 [C7]；更新状态机与 NZ 校验见 [C8]；HCCL 通信组、参数校验、普通与打包传输及逐层重载见 [C9]；NPU IPC 的句柄匹配与装载见 [C10]；分配器清理和 FA3 拒绝条件见 [C11]。固定 GLM 更新方法和创建条件见 [C12][C13]。两条维护分支的 worker 见 [C14][C15]，旧后端名称映射见 [C16][C17]，main 的后端注册见 [C18]，旧额外清理默认值见 [C20][C21]。暂停查询参数还与上游 main `84030bbe` 的端点定义核对，见 [C22]；GLM 控制流基线仍是 `0fc695fc`，未混用。

**容易受版本影响的调用链。** 后端名按配置直接查工厂、上游 ipc 注册和 Ascend 插件注册见来源 40–42，不能仅照抄指南名称。NPU IPC 示例与 trainer 生命周期见来源 43–44；packed 消费者、rc2 装载位置和外层同步见来源 45–47，与来源 10 对照。编号端点注册条件见来源 48，FA3 的无 PCP 前提见来源 49。来源 50 是新版指南所链的稀疏示例全文；来源 51 是整权重 HCCL HTTP 示例全文，其线程 join 没有把线程内异常传回主线程。来源 26–37 对应 rc2 配置、状态机、睡眠与重载，以及 main 原有状态机；睡眠完整调用顺序以[睡眠页](sleep-mode.md)为准。

**实测边界：** 缺少真实 NPU 上的完整训练循环、换权重耗时与显存曲线；缺少 GLM W8A8 参数分片、量化元数据与训练框架的同步验收，不能认定该组合已支持。上述小拓扑计数是教学推演。新增 Sparse HCCL 与 Trace Replay 的入口、限制来自 921ccc52 官方 RL 指南；稀疏补丁坐标与替换语义另对照它所链的上游 Sparse NCCL 文档，通信后端按 Ascend 指南选择。

- 来源 24：vllm-ascend@db701c1f，vllm_ascend/worker/worker.py，L352–L357。
- 来源 25：vllm@84030bbe，vllm/entrypoints/serve/dev/rlhf/api_router.py，L29–L45。
- 来源 52–53：rc2 传输引擎的创建条件和更新状态机；来源 54–55：无 PCP 前提下的 FA3 选择、软件包及模型限制；来源 56–57：平台实际调用 Router Replay 校验，以及 MRV1 的拒绝条件。
