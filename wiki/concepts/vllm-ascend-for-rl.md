---
id: vllm-ascend-for-rl
title: "vLLM-Ascend for RL：生成样本后，怎样安全换上新权重"
type: feature
summary: RL 训练框架用 vLLM-Ascend 生成样本，再把新权重交回推理端。本页串起暂停、同卡与跨卡权重传输、训练数据返回和数值一致性，并区分 main 的统一配置与 GLM 固定版本。
aliases: [RL, Reinforcement Learning, 强化学习, RLHF, rollout, rl_config, 权重同步, 训推协同, Router Replay, R3, tokens-only]
chapters: ["19"]
order: 60
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L1-L60
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L62-L197
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L199-L240
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L242-L367
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L236-L299
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L248-L341
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L262-L292
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L296-L358
  - vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/hccl_engine.py#L30-L209
  - vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L153-L222
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1340-L1382
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L282-L374
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L681-L694
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L282-L374
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L268-L364
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_weight_transfer_engine.py#L18-L73
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_weight_transfer_engine.py#L18-L73
  - vllm-ascend@baa023ad:vllm_ascend/distributed/weight_transfer/__init__.py#L24-L40
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L1-L59
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L150-L165
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L165-L177
  - vllm@84030bbe:vllm/entrypoints/serve/dev/rlhf/api_router.py#L29-L80
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: one-request, kind: builds-on, note: RL 沿用生成请求的七站；本页补充两轮生成之间的权重更新}
  - {to: glm-5-3-flash-two-node, kind: builds-on, note: 固定双机是在线推理部署，未配置训练端和权重传输}
  - {to: batch-invariance, kind: builds-on, note: 需要稳定 rollout 时继续核对批不变的算子与调度限制}
  - {to: attention-backend-family, kind: builds-on, note: 训推一致选项走 FA3，适用模型与后端拒绝条件见该页}
  - {to: expert-parallel, kind: builds-on, note: 先理解专家选择与执行，再区分 Router Replay 返回的是哪些记录}
  - {to: ascend-patch-system, kind: builds-on, note: 旧版本通过工厂 patch 将 nccl 和 ipc 名称映射到 Ascend 后端}
contradicts: []
updated: "2026-10-04"
origin: direct
---

## 模型生成一批回答后，怎样用它继续学习？

**RL（Reinforcement Learning，强化学习）让训练框架根据回答得到的评分更新模型；vLLM-Ascend 在其中负责 rollout，也就是用当前模型生成训练样本，并在下一轮生成前接收更新后的权重。** 权重是决定模型怎样计算的参数；训练端修改它，推理端使用它。图中的 token 是分词后的文本单位，token ID 是它的词表编号。

```wiki-diagram
file: vllm-ascend-for-rl-cycle
```

例如训练模型解数学题：训练框架提交问题，推理端生成解答，评分程序检查答案，训练端据此调整权重，再把新权重送回推理端。下一批题才由更新后的模型回答。评分、训练算法和优化器属于训练框架；这篇官方特性指南解决的是推理端如何配合这一循环。

一条样本仍经过[单请求第 2 站的调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)、第 4 站前向、第 5 站采样和[第 7 站返回](one-request.md#第-7-站-返回与收尾)。RL 多出来的环节在两轮生成之间：暂停调度，让 worker（执行模型的进程）装好新权重，再恢复生成。下文以 main 的统一配置讲组合方法，旧分支和 GLM 固定代码的差异集中在页末。

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

**共用物理卡：轮流占显存，使用 NPU IPC。** IPC 是进程间共享设备内存的机制：发送端提供句柄，接收端据此重建张量并交给模型装载。同卡训练通常让 rollout 引擎 sleep 以让出显存，两级睡眠的区别见[额外清理参数页的睡眠说明](../params/enable-sleep-mode-extra-cleanup.md#为什么存在)。

**使用不同物理卡：保留推理端内存，使用 HCCL。** 训练和 rollout 有各自设备，通常无须为了训练而 sleep。初始化时建立训练端与所有推理 worker 的通信组；更新时训练端发送，worker 接收并装载。通信组规模包括发送方，不能只填推理卡数。HCCL 后端在计算 worker 的通信编号时还计入 DP 组偏移，避免不同 DP 组内相同的局部编号撞在一起。

下面只演算接口里的参与者计数：假设有一个发送进程、两个接收 worker，发送方编号从零开始，接收方偏移为一。这是教学拓扑，和 GLM 双机卡数无关。

```calc
title: HCCL 权重更新通信组的参与者（教学示意）
通信组规模 = 1 个训练端发送进程 + 2 个推理 worker = 3 个参与者
第一个接收编号 = 0 + 1 = 1
第二个接收编号 = 1 + 1 = 2
```

传输的数据还包括参数名称、数据类型和形状。HCCL 的普通路径逐个接收权重、调用模型装载，再释放临时张量；packed 路径把多个张量打包，减少通信调用，打包参数（缓冲大小与缓冲个数）随更新信息由发送端下发，接收端直接取用。NPU IPC 按物理设备标识查找句柄，然后装入目标模型；“同机”不能代替“同卡”这一前提。

## 除了回答文本，训练端还需要什么？

**训练端通常需要知道模型生成了哪些 token、各 token 的概率，以及特定训练方法需要的内部选择。** 只有显示文本时，训练端还得重新分词，而且文本与原始编号未必能无损往返。

**log probabilities 表示模型对 token 的概率取自然对数。** 训练框架可据此比较生成时的模型与更新后模型的行为。生成 token 的记录与 prompt 的记录是两类数据，要按需请求；官方指南明确 prompt logprobs 不支持流式 completions。一次要返回多少候选、返回的是哪些 token，应与训练框架的计算约定对齐，不能把概率记录当成回答评分。

**Router Replay（R3）保存 MoE 每个位置选中的专家，供训练端重放这些选择。** MoE 让每个 token 只经过部分专家，分工见[Expert Parallel](expert-parallel.md)。推理服务负责捕获并返回选择，训练框架负责消费记录并重放。非流式 completion 的记录是 base64 编码的 NumPy 数组；解码后的三维依次是“记录的 token 位置、模型层、每位置选中的专家”。官方形状为 `(num_tokens - 1, num_layers, num_experts_per_tok)`：最后采样出的 token 还没走过模型，所以没有对应路由。未启用捕获，或请求在前向前被终止，字段可以为空。只有训练端确实使用这些记录时才启用。

**tokens-only API 直接收发 token ID。** main 指南把它列为实验接口，启动普通服务时另行开启，输入中提供请求编号、token ID 和采样设置，响应包含生成编号及按配置返回的概率、路由等字段。这省掉重复分词，不会替训练框架完成更新算法。

**agentic RL 的工具交互由外部环境闭环。** 模型生成工具调用后，环境执行工具、把结果追加到对话，再提交下一轮请求。要选与模型匹配的工具解析器。若外部路由器需要指定 DP（Data Parallel，分配请求的执行组），可以传递目标 DP rank；rank 是组编号，取值必须存在于实际部署。请求路由和 MoE 的专家选择解决不同层面的问题。

## 为什么“训推一致”和“批不变”要分开选择？

**两者解决不同来源的数值差异，统一 RL 开关不会自动把它们都打开。** 训推一致选项让支持的模型使用 FA3 attention backend，以配合训练侧 attention 的计算方式；这里的 FA3 是特定注意力实现，适用范围见[attention backend](attention-backend-family.md)。它需要额外软件包，不能把不支持的 MLA 或稀疏 attention 也切过去。

batch invariance（批不变）则减少同一请求因批大小、批内伙伴或顺序变化产生的数值差异；其算子、图模式和调度限制见[批不变页](batch-invariance.md)。开了 FA3 不等于开了批不变，反过来也一样。统一配置里的批不变字段关闭时，已有的批不变环境变量设置仍保留。

这些选项以更严格的计算路径换取数值一致性，代价包括吞吐损失或额外初始化工作。RL 的需要是让生成端和训练端拿到可解释、可比较的数据，实际选择仍由训练算法、模型结构与部署方式决定。

## GLM 双机的一条请求会走进 RL 更新吗？

**[固定 GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)提供在线推理，没有配置训练端、sleep 或权重传输。** 官方启动命令也没有统一 RL 配置；含 GLM 的执行代码里，只有提供权重传输配置才创建传输引擎。因此源码虽然有更新方法，普通请求不会自动进入更新循环。

跟着一个生成 token 看：调度把它交给 worker，第 4 站用已经加载的权重完成前向，第 5 站采样，第 7 站返回；下一个 token 继续使用这版权重。双机之间已有的 TP、EP 通信是模型前向的一部分，不能据此判定存在训练端到 rollout 的权重同步。卡数、分组和每卡权重账仍以部署页为准。

若要把这套服务改成 RL rollout，首先要补上训练端、参数映射和更新调度，并在更新边界让所有相关 worker 一起切换版本。固定执行代码支持旧的更新接口，但没有 main 的统一配置。仅把 main 的 RL 字段复制到旧启动命令里，不能获得相同默认行为。

即使换成支持统一配置的 main，打开总开关也会改变权重布局与内存分配配置。再打开训推一致选项时，GLM 使用的 MLA / 稀疏 attention 不符合 FA3 分支条件，会被拒绝；混合 attention 模型的批不变支持还须按专页核对。W8A8 权重更新所需的量化元数据、各分片映射与真实训练框架的联调也要单独验证。因此这里能确定的是“现有部署未启用”，不能把小模型传输示例当成 GLM RL 验收结果。

## 哪些理解最容易出错？

- **“开启 RL 就开始训练。”** 它配置推理端的协作能力；评分、梯度计算和优化器仍在训练框架。
- **“暂停后就有空闲显存。”** pause 控制调度，sleep 管内存；跨卡训练通常只需暂停来保护换权重的边界。
- **“keep 比 wait 更省事，也能保证整条样本一致。”** keep 会保留旧请求的生成状态；若恢复时改用了新权重，同一条样本就跨了版本。
- **“sleep level 2 后唤醒就能继续。”** 权重已经丢弃，必须先恢复权重内存并装入新参数。
- **“开批不变就能保证任意模型、任意配置的训练和推理完全相同。”** 批不变与训推 attention 一致是两项选择，各有模型和算子前提。
- **“推理端返回专家编号就已经完成 Router Replay。”** 返回记录只是前半段，训练端还要消费和重放。

## 对照源码

### 怎么开

以下启动片段以 **Ascend main `baa023ad` 的官方指南**为基准，是部署参考；本页没有启动 NPU 服务。跨卡方案先启用总开关，再单独选择权重传输后端：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --additional-config '{"rl_config":{"enabled":true}}' \
  --weight-transfer-config '{"backend":"hccl"}'
```

`RlConfig.apply()` 只在 enabled 为真时应用三项默认行为：强制 `weight_nz_mode=0`，关闭 FRACTAL_NZ（为矩阵计算重排的权重布局）；启用开发端点；从 NPU 分配器配置中移除 expandable_segments。三个可选字段都默认 false：sleep_mode_extra_cleanup、enable_training_consistency、enable_batch_invariant。总开关不会自行配置传输引擎，也不会隐式启用 sleep。

同卡方案改用 `backend="ipc"`；如需 sleep，再加 `--enable-sleep-mode` 并使用 `VLLM_WORKER_MULTIPROC_METHOD=spawn`。HTTP NPU IPC 示例需要 `VLLM_ALLOW_INSECURE_SERIALIZATION=1` 来序列化句柄，只适用于可信环境；开发端点也只能提供给受控的训练系统。level 2 的顺序是 sleep → wake weights → 权重更新 → wake kv_cache → resume，sleep 的 level 与 wake 的 tags 都放在查询参数里。

```wiki-diagram
file: vllm-ascend-for-rl-update
```

图中初始化握手发生在第一次传输前；每轮先等待暂停成功，再调用 start、一次或多次 update、finish，全部成功才 resume。HCCL 后端的 start / finish 分别准备和完成逐层重载；NPU IPC 后端的这两个方法为空操作，但 worker 仍检查更新状态。传输失败后须调查并恢复完整权重，不能拿可能只装了一部分的模型继续生成。

控制请求示例：`POST /pause?mode=wait&clear_cache=true`，更新完成后 `POST /resume`。main 的 clear_cache 已弃用且对 keep 无效；完整收发双方代码见钉住的 [HCCL 示例](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/examples/rl/rlhf_http_hccl.py)与 [NPU IPC 示例](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/examples/rl/rlhf_http_npu_ipc.py)。HCCL 发送和接收要协调进行，不能等一个需要对端参加的阻塞通信完成后才启动对端。

其余能力独立配置：

| 目的 | 入口与条件 |
|---|---|
| 返回概率 | completions 请求中按需设 `logprobs`、`prompt_logprobs`；后者用非流式请求 |
| 返回专家记录 | 服务端 `--enable-return-routed-experts`；非流式响应解码 `choices[].routed_experts` |
| 直接收发编号 | `--tokens-only`，请求 `/inference/v1/generate`，提供 `token_ids` 与 `sampling_params` |
| 工具交互 | `--enable-auto-tool-choice` 与模型匹配的 `--tool-call-parser`；外部环境执行工具 |
| 指定 DP 组 | 请求头 `X-data-parallel-rank`；配置已有 DP 服务与外部路由器，没有 `vllm serve router` 或 `--dp-routing-config` |
| 训推 attention 一致 | RL 配置的 `enable_training_consistency=true`；安装 `flash_attn_npu_v3` 并满足 FA3 条件 |
| 批不变 | RL 配置的 `enable_batch_invariant=true`；匹配的源码构建时设 `COMPILE_CUSTOM_KERNELS=1 VLLM_BATCH_INVARIANT=1`，安装配套算子 |

批不变构建条件取专门指南：预编译 wheel 不包含算子源码，仅在安装 wheel 时设置环境变量不会重建算子。RL 指南给的运行例子采用 PIECEWISE 图模式，其他调度限制继续按批不变页核对。

### 会报什么错

以下均为源码字符串；拼接字符串按实际报错展开。路径相对于 vllm-ascend 仓库，行号对应给出的 commit。

| 条件 | 原文 | 文件与行号 |
|---|---|---|
| 没有传输配置就初始化或更新 | `Weight transfer not configured. Please set weight_transfer_config to enable weight transfer.` | `baa023ad`，`vllm_ascend/worker/worker.py:296–300` |
| 尚未 start 就发送权重 | `start_weight_update must be called before update_weights.` | 同文件 `339–340` |
| 上一轮未 finish 又 start | `start_weight_update called while a weight update is already active. Call finish_weight_update first.` | 同文件 `322–325` |
| HCCL 接收前没有建立通信组 | `HCCL weight transfer not initialized. Call init_transfer_engine() first.` | `baa023ad`，`vllm_ascend/distributed/weight_transfer/hccl_engine.py:184–185` |
| FA3 分支遇到 MLA / SFA | `FA3 backend does not support MLA and SFA.` | `baa023ad`，`vllm_ascend/platform.py:1365–1366` |

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

v0.23 列专指维护分支 `2c59ff10`，v0.26 指 `2ed6cbba`，main 指 `baa023ad`，均为钉住的源码快照。GLM 用的是含模型代码的独立提交 `db701c1f`，不属于 v0.23 维护分支；本页核对的 worker 更新逻辑与 v0.23 一致。

| 项目 | v0.23 | v0.26 | main | 对使用者意味着什么 |
|---|---|---|---|---|
| RL 总览与统一配置 | 没有 rl 特性页、没有 RlConfig | 同 v0.23 | 有；enabled 默认 false，其余三个字段也默认 false | 旧分支已有分散能力，不代表支持新的一键入口 |
| 权重更新与默认启用 | 有，提供传输配置才创建引擎 | 同 v0.23 | 同样按传输配置创建 | 普通服务不自动同步权重 |
| 跨卡 / 同卡入口 | 示例使用 nccl / ipc，工厂 patch 映射成 HCCL / NPU IPC | 同样保留该 patch | 指南使用 hccl / ipc，注册 Ascend 后端并增加 NPU IPC trainer 工厂 | 旧 nccl 名称不表示在 NPU 上运行 NCCL；命令按版本选 |
| NZ 校验 | start 检查环境变量 | 同 v0.23 | RL 总开关强制布局模式为零；start 检查生效配置 | 新版覆盖布局设置并给 warning，旧版要手动保持配置一致 |
| 更新 API | start 带 is_checkpoint_format，默认 true；worker 负责逐层重载或直接复制 | 同 v0.23 | start 不再有该参数，重载职责交给后端 | 旧训练客户端不能原样假定新版签名 |
| sleep 额外清理 | top-level enable_sleep_mode_extra_cleanup，默认 false | 同 v0.23 | 移至 rl_config.sleep_mode_extra_cleanup，默认 false，总开关须开启 | 迁移要改配置层级；是否使用 sleep 仍单独配置 |
| 批不变与训推一致入口 | 分散设置，见对应专题 | 同样没有统一 RL 配置 | 增加统一配置字段；两项不互相隐式启用 | 本表不把 main 的数据 API 与模型支持倒推到旧版本 |

### 源码位置

**官方组合语义。** rollout 分工与部署模式见 [S1]；sleep 顺序、传输生命周期、暂停选择见 [S2]；概率与 Router Replay 的返回格式见 [S3]；tokens-only、工具调用、DP 路由及配置清单见 [S4]；三个可选字段、默认值、旧配置迁移及环境变量保留规则见 [S5]。GLM 的实际双机启动命令见 [S6]。批不变源码构建与 wheel 边界以专门指南 [S19] 为准。

**实现对应。** 总开关应用见 [C7]；更新状态机与 NZ 校验见 [C8]；HCCL 通信组、参数校验、普通与打包传输及逐层重载见 [C9]；NPU IPC 的句柄匹配与装载见 [C10]；分配器清理和 FA3 拒绝条件见 [C11]。固定 GLM 更新方法和创建条件见 [C12][C13]。两条维护分支的 worker 见 [C14][C15]，旧后端名称映射见 [C16][C17]，main 的后端注册见 [C18]，旧额外清理默认值见 [C20][C21]。暂停查询参数还与上游 main `84030bbe` 的端点定义核对，见 [C22]；GLM 控制流基线仍是 `0fc695fc`，未混用。

**待核：** 缺少真实 NPU 上的完整训练循环、换权重耗时与显存曲线；缺少 GLM W8A8 参数分片、量化元数据与训练框架的同步验收，不能认定该组合已支持。上述小拓扑计数是教学推演，不是部署测量。外部网页未完成联网可达性验证，本文依据本地钉住的官方文档与源码。
