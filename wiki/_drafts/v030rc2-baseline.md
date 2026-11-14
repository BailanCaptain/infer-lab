---
id: v030rc2-baseline
title: v0.30.0rc2 的版本基线与阅读边界
type: source
summary: >-
  依据本次材料区分 v0.30.0rc2 分支中的文档声明、执行路径与模型限制，说明 PCP、DCP、DSA-CP 和 Model Runner V1/V2
  应怎样对照。
aliases:
  - v0.30.0rc2
  - '0.30'
  - rc2
  - 三十版本
  - Model Runner V2
chapters:
  - '10'
  - '15'
sources:
  - >-
    raw:sha256-cd92384259b2fd0d79289e2736f1c5dae68c2eabee71c4e050c7e54b96b978a3.md#L1-L286
verified: []
evidence: I
relations:
  - to: context-parallel
    kind: builds-on
    note: 区分 PCP、DCP 与 DSA-CP 后，才能按执行路径判断本快照中的支持条件
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 对照新版本支持范围时，需保留双机教学算例自身的部署与来源边界
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-cd92384259b2fd0d79289e2736f1c5dae68c2eabee71c4e050c7e54b96b978a3.md
---

## 这份材料固定了什么版本范围？

本页整理 v0.30.0rc2 分支的版本阅读边界：发布说明怎样描述这次更新，平台配置怎样选择执行路径，以及 GLM-5.3-Flash 的模型限制怎样收窄通用功能的适用范围。

材料中的 Ascend 文件均标注为 vllm-ascend 的 7d825229 快照，上游配置文件标注为 vllm 的 ced6857a 快照。发布说明写明，v0.30.0rc1 与上游 vLLM v0.30.0 对齐；材料没有提供分支、标签与这些提交之间的 Git 核对记录，因此这里只保留摘录标注的快照身份，不进一步断言提交与发布标签的距离。

发布说明将 v0.30.0rc2 标为 2026-10-13，称此次更新没有业务代码变化，主要修复官方 Docker 镜像构建，并将 Dockerfile 中的 CANN 升级为 9.2.0_20260930220649。它建议使用 v0.30.0rc1 官方镜像的用户升级到 rc2；其他用户可以忽略这次更新。这里描述的是 rc1 到 rc2 的更新范围，不能据此判断 v0.26 分支到 v0.30.0rc2 分支之间的变化。[I]

本页只有提供的本地摘录，没有独立核读上游文件或运行 NPU 验证，因此不将摘录升格为官方或源码证据，也不登记整页版本验证。

## 为什么 PCP 的支持范围不能只看设计文档？

context parallel（CP）沿上下文位置分配计算或历史状态。材料涉及三条需要分别判断的路径：

| 路径 | 材料说明的分工 | 本次核对时需要保留的边界 |
| --- | --- | --- |
| Prefill Context Parallel（PCP） | 面向输入处理阶段的上下文并行路径 | 设计文档写不支持；平台校验却只在未使用 Model Runner V2 时拒绝大于 1 的 PCP 配置 |
| Decode Context Parallel（DCP） | 在 tensor parallel（TP）组内，沿序列维度分片 KV cache，即供后续 attention 使用的历史状态 | 是否可用还取决于模型、后端、硬件和配置组合 |
| DSA-CP | GLM 教程中的实验性 SFA 稀疏注意力路径，分担查询位置的计算 | 主 KV、索引池和尾缓存仍复制，不能等同于 DCP 的 KV 分片 |

Model Runner 是设备侧组织模型执行的组件，这里有 V1、V2 两条路径。设计文档直接写“PCP 不受支持”，但平台摘录中的拒绝条件是：未启用 V2，并且 PCP 大小大于 1。V2 的 PCP 管理器也包含专门的配置检查。两者共同说明，设计文档的概括不足以描述本快照全部执行路径；V2 下存在 PCP 配置处理，并不等于任意模型或组合均受支持。[I]

V2 的 PCP 管理器列出以下限制：

- 不支持 encoder-decoder 模型，即输入编码与输出生成分成两部分的模型。
- 不支持多模态输入，也不支持 LoRA 配置；LoRA 是通过附加低秩权重调整模型的方法。
- 使用 speculative decoding，即先草拟若干 token 再由目标模型验证时，只接受 MTP、Eagle3 和 DSpark 三种方法。
- PCP 与 data parallel（DP，多组执行资源分担请求）组合时，只接受不回放捕获图的 eager mode，或仅对 decode 使用完整图的 FULL_DECODE_ONLY。
- 稀疏 MLA 的 PCP 路径也只接受上述两种模式；其他包含完整图的模式会被拒绝。

平台还检查 PCP 与 DCP 的组合。对于 GQA/MQA 这类查询头共享键值头的注意力结构，当 PCP、DCP 均大于 1 时，两者大小必须相等；摘录中的这项检查会跳过 MLA 模型。MLA 使用压缩表示保存注意力历史，相关基础见 [CP 页面](../concepts/context-parallel.md)。

## DCP 分片与 GLM 的 DSA-CP 有什么不同？

DCP 设计说明将历史 token 交错存放到 TP 组内的不同 rank；rank 是通信组中标识参与设备的编号。其目标是让各 rank 只保留自己负责的序列分片，减少重复的 KV cache 存储，而不额外增加进程总数。

摘录给出的交错粒度由 `cp_kv_cache_interleave_size` 控制，默认值为 1；一个虚拟块覆盖的 token 数为 block size 与 DCP 大小的乘积，且 block size 必须能被交错粒度整除。这些是该设计摘录描述的布局条件，不能直接套用到所有稀疏注意力后端。

平台针对“复制索引器的 SFA DCP”另设检查。索引器负责筛选稀疏注意力要访问的位置；在这条路径中，DCP 大小只能等于 PCP 大小，或等于 TP 大小乘以 PCP 大小。启用 SFA C8 时，还须满足当前硬件能力检查。代码注释特别区分了 A5 的非 C8 SFA DCP 与尚不支持的“C8 加复制索引器”组合。

GLM-5.3-Flash 教程描述的 DSA-CP 则在 TP 组内分担 SFA 查询 token，保留以下状态的副本：

- 主 KV；
- 索引池；
- 尾缓存。

KDA 是采用按通道遗忘的 delta 更新注意力机制；教程说它继续沿用既有 TP 路径。启用该实验功能使用 `enable_dsa_cp`，同时要求 PCP 和 DCP 大小都保持为 1。因此，不能由“启用了 DSA-CP”推出“GLM 的历史 KV 已按 DCP 分片”。[I]

## GLM-5.3-Flash 在这份快照中有哪些额外限制？

材料中的教程明确写明，GLM-5.3-Flash 在 Ascend 上当前只支持 Model Runner V1，并说明所有 A3 脚本显式设置 `VLLM_USE_V2_MODEL_RUNNER=0`。因此，V2 PCP 管理器的存在不能作为这个模型支持 PCP 的依据。[I]

模型侧的 `Glm5NextKPoolIndexerBackend` 还有直接校验：

| 条件 | 摘录中的处理 |
| --- | --- |
| 查询的位置旋转维度不为 0 | 抛出错误，只接受 NoPE 查询，即查询中不含该旋转位置编码维度 |
| PCP 或 DCP 大小大于 1 | 抛出不支持 PCP 或 DCP 的错误 |
| 硬件后端属于兼容路径 | 抛出错误，提示 KPool sparse attention 要求 Ascend A2、A3 或 A5 |

这些检查是具体后端的准入条件。硬件属于 A2、A3 或 A5，只满足其中一项检查，不能单独证明完整配置可运行。[I]

本次教程摘录还包含 Prefill/Decode 分离部署，即由不同节点分别处理输入与继续生成：

| 教程场景 | Prefill 配置 | Decode 配置 |
| --- | --- | --- |
| A3 PD | Prefill 节点使用 DP2/TP8；eager mode，开启 FlashComm1 | Decode 节点使用 DP16/TP1；FULL_DECODE_ONLY，关闭 FlashComm1 |
| A2 PD | 两个 Prefill 节点使用 DP2/TP8；eager mode | 两个 Decode 节点使用 DP8/TP2；FULL_DECODE_ONLY，关闭 FlashComm1 |

这里 DP 后的数字表示数据并行大小，TP 后的数字表示张量并行大小；张量并行把一次张量计算分到多个设备。FlashComm1 是教程中的通信优化开关，本摘录只给出其开关状态，没有展开实现。

这些 PD 场景须与已有[双机教学部署](../concepts/glm-5-3-flash-two-node.md)分别阅读。本材料没有提供原教学算例的容量、形状和通信推导复核，不能据此改写那些数字。[I]

## Ascend 最终怎样选择 Model Runner V1 或 V2？

上游配置属性与 Ascend 补丁采用不同的选择规则。

上游摘录依次处理功能要求、显式环境变量和平台条件：HiSparse 要求 V2，显式禁用会报错；watermarking 也要求 V2，并会覆盖显式禁用设置。之后才读取环境变量，再检查特定 ROCm 模型、Triton 可用性以及尚不支持的功能，必要时退回 V1。

Ascend 补丁则将这个属性替换为直接读取 `VLLM_USE_V2_MODEL_RUNNER`：

- 显式设置时，返回该设置；
- 未设置时，返回 False，即选择 V1；
- 模型兼容性判断按补丁说明交给 NPU runner。

因此，不能用上游属性的自动选择规则解释打上该补丁后的 Ascend 行为。[I] 对照支持范围时，应先区分“配置属性选择了哪个 runner”与“该 runner 是否接受当前模型和功能组合”。本材料展示了选择属性与若干配置检查，没有展示完整 Worker 调用链。

## 哪些结论仍需追加核对？

本摘录可以支持上述版本声明、配置条件与局部实现的整理，但尚不能完成以下核验：

- v0.30.0rc2 分支快照与发布标签的精确 Git 对应关系，以及它是否比标签多出文档提交。
- v0.23 维护分支、v0.26 分支和 main 开发主线的逐项行为差异。
- Ascend v0.30.0 正式版后续修复的范围。
- 完整启动流程中的补丁加载、Worker 分派和模型校验顺序。
- 具体模型、硬件及开关组合能否在 NPU 上运行，以及性能和显存结果。

本页未进行设备运行验证。上述缺口需要对应版本的固定源码、配置或运行记录，不能由本地摘录中的功能名称补推。

本页来源定位均对应唯一的本地材料：第 1—20 行为发布说明；第 22—43 行为 CP 设计说明；第 45—106 行为平台校验；第 108—141 行为 V2 PCP 限制；第 143—161 行为 GLM 教程；第 163—204 行为 KPool 后端；第 206—256 行为上游 runner 选择；第 259—286 行为 Ascend 补丁。
