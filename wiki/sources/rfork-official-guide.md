---
id: rfork-official-guide
title: RFork 官网核读：原图、全部章节与上游演进差异
type: source
summary: >-
  对照社区上游 main（8d6180e2）官方指南、v0.30.0（c09d3e20）与历史旧指南快照（baa023ad），说明身份、端口、租约、绕过条件与布局协议的演进差异，避免把移动的 latest 或过时模型表当成现行验收证明。
aliases:
  - RFork 官网
  - RFork 官方文档
  - RFork 官方图
  - RFork 官方已测模型
chapters: []
order: 120
sources:
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/rfork.html
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L641-L957'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/identity.py#L229-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/config.py#L11-L192'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L227-L273'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L491-L551'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L641-L694'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_server.py#L128-L198'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L490-L659'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L729-L774'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L807-L876'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L368-L375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/sfa_v1.py#L990-L1015'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/rfork.md#L1-L561'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rfork.md#L1-L155'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/rfork.md#L1-L239'
  - >-
    raw:sha256-db4449dd5c07c9dbfaf635f095d0deff9791e40dee4d701ce688eb87fbed4733.md#L1-L1315
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L137-L287'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L600-L710'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/planner_client.py#L117-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/session.py#L261-L364'
relations:
  - to: rfork
    kind: builds-on
    note: 官方指南是概览；RFork 专题各页结合上游 main 源码展开实现细节与边界
  - to: rfork-config
    kind: builds-on
    note: 官网最小命令没有覆盖全部参数和依赖契约
  - to: rfork-maintenance
    kind: builds-on
    note: 官网 latest 会随上游演进变化，排查须先固定对应的 commit 与版本
  - to: rfork-layout
    kind: builds-on
    note: 官网核读页对量化派生权重和最终张量状态的说明，依赖布局页展开的布局准备与张量采集机制。
verified:
  - main
evidence: C
contradicts: []
updated: '2026-11-19'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-1ae36dd2945d6704b17e8d8c2d24f1e68a61a92f72ed3f18b9ba0c7dfcc97db3.md
  - >-
    raw/sha256-22f6d04426e0defa217c4f60bcb3fba3c71e2a966e4f415864440ec682d871d3.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-5a3d1509370c0488f838bfde17afe07b9813ab965e64c2d95ea3297c6ce033b6.md
  - >-
    raw/sha256-7c1cf46ed24557ae509144bda485106fc93a596c0e8a111ed26f83c3491c0981.md
  - >-
    raw/sha256-9e8373b3419105ced3731c25c5fff3faf0ca76ce35239c4fb1f6b7f51619847f.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-db4449dd5c07c9dbfaf635f095d0deff9791e40dee4d701ce688eb87fbed4733.md
---

## 用哪份指南对照哪份实现？

**官网指南帮你理解 RFork 想做什么、怎么用；实际行为始终以社区上游 `vllm-ascend` 固定提交的源码为准（当前主基线为 `main@8d6180e2`）。** RFork 本身是什么——新实例按地址从一个身份相同、正在服务的实例那里读权重，借不到再退回磁盘加载——见[总览](../concepts/rfork.md)，这里不重讲。

本页分两层：先给出社区上游 `main@8d6180e2` 与 `v0.30.0@c09d3e20` 最新官方指南的核读要点；随后各节保留早期旧官网快照（`baa023ad`）与当前上游实现的差异对照，以及历史已测模型表和 Flowchart 原图解读，避免读者把旧文章里的五项参数表或分隔符 key 套到当前代码上。

`latest` 是会移动的网站地址。下面引用社区源码中的固定指南提交，不据此断言线上网站正由哪个提交构建；设备效果仍需真实部署验证。

## 新官方指南补充了什么，rc2 要怎样部署？

社区上游 `vllm-ascend@8d6180e2` 的官方指南（`docs/source/user_guide/feature_guide/rfork.md`，经 PR `#20876`、`#21333`、`#21707` 补齐）已与当前实现基本对齐，涵盖：

- **13 项客户端配置与环境变量回退规则**：逐字段说明优先级（有效 JSON > 环境变量 > 默认值）、8 个环境变量（`MODEL_URL`、`MODEL_DEPLOY_STRATEGY_NAME`、`RFORK_SCHEDULER_URL`、`RFORK_SEED_TIMEOUT_SEC`、`RFORK_REQUEST_TIMEOUT_SEC`、`RFORK_MODEL_IDENTITY_HEADERS`、`RFORK_SEED_BIND_HOST`、`RFORK_SEED_ADVERTISE_HOST`）、未知键告警与 `RForkConfigurationError` 中止语义。
- **完整加载时序与绕过条件**：先建模型、恢复 MTP/DSpark checkpoint 归属并加载 Engram 宿主表，再准备布局、登记本地目的显存并绑定结构摘要，最后才向 Planner 申请租约；统一绕过条件为 sleep mode、在线权重传输与 `--enable-eplb`（移除 Model Runner V1 旧 EPLB 字段）。
- **控制面与元数据端点表**：`/add_seed`、`/get_seed`（`LEASE_TTL_SEC` 改为可选兼容旧 Planner）、`/put_seed`、`/renew_seed_lease`、`/remove_seed`（默认关闭，由 `rfork_seed_removal_supported` 控制，支持 409 draining），以及 seed HTTP 的 `/health_check_with_key`（错 key 回 400）与 `/get_rfork_transfer_engine_info`（含 `rfork_protocol_version=1` 与 NPU format 清单，错 key 回 404）。
- **三类网络端口与诊断边界**：seed HTTP（`base + 2 × global_rank + slot`，`EADDRINUSE` 退动态）、TransferEngine RPC（`port=0` + `get_rpc_port()`，可选 `YR_TE_RPC_PORT_MIN/MAX`）与 HIXL 数据端点（默认 `YR_TE_HIXL_BASE_PORT=22000`）；明确传输只读 `numel × element_size` 连续稠密字节，不搬运 padding，且 `seed_key` 会出现在日志/URL/调试快照中，须留在信任边界内。

在社区 `v0.30.0`（`c09d3e20`）中，Planner 仍强制要求 `LEASE_TTL_SEC`，且尚未包含 `rfork_model_identity_headers`、`rfork_seed_removal_supported`、Engram 宿主表与 DSpark 归属恢复。完整四版本矩阵统一在[RFork 总览](../concepts/rfork.md#版本差异)。

## 旧官网每一节在本章哪里展开

| 官网小节 | 对应解释 | 核读后必须保留的边界 |
|---|---|---|
| Overview | [总览](../concepts/rfork.md)、[启动](../concepts/rfork-startup.md) | 目标相同，申请 seed 的先后顺序有差异 |
| Flowchart | 下节逐项读图、总览的[三条通道](../concepts/rfork.md#三条通道协调清单字节各走各的) | 图表示参与方与数据流，不能代替时序图 |
| Application Scenarios | 总览的扩容实例、[身份](../concepts/rfork-identity.md) | 拓扑敏感不等于沿用官网列出的全部 key 字段 |
| Usage / Prerequisites | [配置](../concepts/rfork-config.md) | Planner、数据系统、NPU 环境都要具备 |
| Configuration Fields | [配置](../concepts/rfork-config.md)的十一项设置表 | 官网五项表不是工作版参数全集 |
| How RFork Matches Seeds | [身份](../concepts/rfork-identity.md)的两次哈希、部署指纹、分片编号 | 分隔符式 key 与哈希式 key 不可混用 |
| Quantized Models | [布局](../concepts/rfork-layout.md)、[传输](../concepts/rfork-transfer.md) | 搬的是后处理后的可传状态，不能只看 checkpoint |
| Tested Models | 本页[模型表](#官方已测模型不等于本工作版已验收) | 官方记录与工作版验收是两份证据 |
| Example Commands & Placeholders | [配置](../concepts/rfork-config.md)的启动命令和四类端口 | 先替换占位符；逻辑模型标识不等于文件路径或 API 模型名 |
| Note & Caveats | [配置](../concepts/rfork-config.md)的依赖与限制、[生命周期](../concepts/rfork-lifecycle.md) | 动态 EPLB、示例 Planner 能力和端口行为分别核实 |

## 官网原图：上方管调度，下方才搬权重

打开[官网 Flowchart 原图](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/images/rfork_flowchart.jpg)时，可以从上往下读：顶端是 RFork Planner，左右是已有实例与新实例；每侧都有 vLLM-ascend、YuanRong TransferEngine、多个 NPU 和网卡；底部 Network 把两侧连接起来。[S1]

读图的依据：官网这张图与社区仓库同路径的 `docs/source/user_guide/feature_guide/images/rfork_flowchart.jpg` 逐项对过，参与方、标签与箭头一致。这是目视对照，不是图片字节哈希比对。

| 图上的标记 | 怎样理解 | 回到工作版代码查什么 |
|---|---|---|
| Planner 到两侧的细线 | 来源协调与登记，不是权重字节中转 | Planner client 的申请、释放、上报 |
| 左右同颜色的 weight | 对应分片的权重，从来源到接收端 | key 先筛选，manifest 再按名称和元数据验收 |
| NPU 0 / 1 / N | 多设备部署的示意 | 本地设备编号不能直接当成跨实例分片身份 |
| RoCE → NIC → Network → NIC | 图示的设备间网络传输通道 | 后端注册与 `batch_transfer_sync_read`，以及现场网络配置 |
| 右侧向上的箭头 | 接收端最终得到自己的本地权重 | 不表示两端长期共用同一块显存 |

图上写出来的两个词：**NIC** 是网络接口卡；**RoCE** 是在以太网上承载 RDMA 的协议族。图上没画、但读这条链路绕不开的另外两个：**RDMA** 是远程直接内存访问，让传输设备按已登记的内存范围搬数据；**HBM** 是加速器自带的高带宽内存，本页说“NPU 权重内存”就是指它，与 CPU 所在的主机内存相区分。四个词分别回答“哪种内存、什么传输机制、经过什么网络设备”，不是同义词——图上找不到 HBM 是正常的。

图省略了 Seed HTTP 的 manifest 请求、租约释放、注册回滚和默认加载。这些由[总览](../concepts/rfork.md)、[传输](../concepts/rfork-transfer.md)及生命周期图展开。工作版 Python 向 TransferEngine 传入 `ascend` 类型、设备名和地址，**不能仅由这张图证明任何环境都完全绕过 CPU 暂存，也不能推导每张 NPU 必须独占一张 NIC**；物理链路和 native 实现需现场确认。[C5][I]

## 旧官网与工作版有哪些排错差异？

下表对照早年旧官网（`baa023ad` 快照）与当前社区上游 `main`（`8d6180e2`）的实际行为，排查时不要再套用旧文规则：

| 主题 | 早期旧官网说明（`baa023ad`） | 当前上游 `main`（`8d6180e2`）实际行为与影响 |
|---|---|---|
| 借 seed 的时机 | 先申请，再构造模型 | 先构造模型、恢复 MTP/DSpark 状态并加载 Engram 宿主表，processed 路径先准备布局并同步，**再登记目的显存并绑定结构摘要**，最后才申请租约。[C2] |
| `seed_key` | 分隔符拼接模型、拓扑与角色字段，并给出 `rfork_seed_key_separator`（默认 `$`） | 使用配置 fingerprint + 张量结构摘要 + 分片/角色（`tp_rank`/`pp_rank`/`ep_rank`/`sharded_dp_rank`/`is_draft_model`）的 SHA256，没有分隔符；`rfork_seed_key_separator` 属于未知键，传入时会打 warning 提醒检查拼写并被忽略。[C3][C4] |
| seed HTTP 端口 | 概括为随机分配 | 支持双槽公式 `base + 2 × global_rank + slot`（主模型 0、草稿 1），基数为 0、超 65535 或被占用（Linux `EADDRINUSE`）时回退 OS 随机端口；TransferEngine 传入 `port=0` 并调 `get_rpc_port()` 读回独立 RPC 端口。[C5][C8][C9] |
| 出错回退与配置校验 | 概括为出错后走默认 loader | 必填配置缺失或严格项非法抛 `RForkConfigurationError` **直接中止启动**；可恢复异常（`ImportError`/`OSError`/`RuntimeError`/`ValueError`）才进入回退，且必须通过清理安全门，否则拒绝再分配模型。[C2][C4][C11] |
| 传完后的发布与续租 | 概括为加载后启动 seed | 传完后后台异步归还（3 次快试后遇暂态错误转 ≥60 秒慢试），归还未确认时 seed 发布记成延期（`DEFERRED`）；Planner 返回 `LEASE_TTL_SEC` 时自动周期调 `/renew_seed_lease` 续租，发布失败不影响已加载模型推理。[C2][C9][C19] |
| 成功日志 | 让人搜 `transfer weights starts` 与 `transfer weights time` | 结束行已改为 `RFork weight transfer completed: tp_rank=…, weights=…, chunks=…, bytes=… GiB, elapsed=…s, throughput=… GiB/s`（TP0 为 INFO、其余 DEBUG），外加加载汇总 `source=transfer\|local\|fallback\|shared_target`。[C12] |
| 依赖安装与绕过 | 指向 `openyuanrong-transfer-engine`、Caveats 写动态 EPLB | 实际导入 `yr.datasystem` 并要求 `get_rpc_port`、`batch_register_memory_ex` 与 `finalize`；绕过条件统一收敛到 `safety.py:mutable_weights_bypass_reason`（sleep mode / 在线权重传输 / `--enable-eplb`，已移除 Model Runner V1 旧 EPLB 字段）。[C5][C6][C7][C10][C13] |

seed 心跳（`/add_seed`）与租约续期（`/renew_seed_lease`）是两套独立机制：心跳只刷新 seed 健康状态、不续租；若现场 Planner 不返回 `LEASE_TTL_SEC`，则不启动续租线程，应按元数据获取、传输与归还所需时间配置租约 TTL。

历史备注：上游 `vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/rfork.md`（PR `#20876`、`#21333`、`#21707`）已补全上述配置回退、控制面端点表、投机解码与排障章节，安装命令与包名仍应通过[配置页](../concepts/rfork-config.md)的只读脚本在真实 Worker Python 环境中核验实际模块与 API。[S15]

## 量化一节的派生权重不是 KV Cache

官网量化一节提到的 `W_UV` / `W_UK_T`，名字里带 K、V，但它们是**权重**，不是随请求增长的 [KV Cache](../concepts/kv-cache.md)。在 [MLA](../concepts/mla.md) 这类注意力里，缓存里存的是压缩过的小向量，计算时要用一块叫 `kv_b_proj` 的矩阵把它投影回每个头的 Key（不含 RoPE 的那部分）和 Value。工作版的 SFA 实现（[稀疏注意力](../concepts/sparse-attention.md)的一种实现）在加载后把这块矩阵按 Key、Value 两段拆开，各自换好维度顺序、存成连续张量：Key 那段成为 `W_UK_T`（转置后的 Key 上投影），Value 那段成为 `W_UV`（Value 上投影）。之后可以清空被替代的原权重；已有这两份张量时，则用 `copy_` 原地更新。[C14]

这解释了为什么 RFork 不能只搬原 checkpoint 的 Parameters：模型真正用于计算的状态已经换了位置和形状。`contiguous` 表示张量按当前维度顺序具有连续存储；转置通常先改变视图，随后生成连续数据可能另占 storage。RFork 的 processed collector 必须看最终属性及 `impl`，并保活实际注册的 storage，详见[布局](../concepts/rfork-layout.md)，以及[传输](../concepts/rfork-transfer.md)页讲内存登记的那一节。

## 官方已测模型不等于本工作版已验收

| 官网模型记录 | 精度 | 官网硬件 |
|---|---|---|
| Qwen2.5-7B | BF16 | A2 |
| Qwen3-32B | BF16 | A2 |
| Qwen3-235B-A22B | BF16 | A2 |
| DeepSeek-V4-Flash-W8A8-MTP | W8A8 | A2 |
| GLM5-W4A8 | W4A8 | A2 |
| Kimi2.5-W4A8 | W4A8 | A2 |

这是旧指南报告的测试覆盖，固定在 `baa023ad` 的模型表，并非本轮复现，也不是当前 latest 的逐型号支持表。[S16] **BF16** 是 bfloat16 浮点格式；**W8A8 / W4A8** 分别表示权重 8/4 bit、激活 8 bit 的量化方案名称，不代表模型里每一个张量都用相同位宽，系数（scale）怎么来见[量化](../concepts/quantization.md)。模型名里的 **MTP** 指模型自带的草稿层，用来做[投机解码](../concepts/speculative-decoding.md)。

放到我们的部署上：表里有 GLM5-W4A8，没有我们跑的 GLM-5.3-Flash W8A8；官方 GLM-5.3-Flash 部署教程（社区仓库 0576b647 版）的命令里没有用 RFork 加载；工作版代码树里也没有 GLM-5.3-Flash 的模型实现。所以这张表对我们的部署只是参考，每张卡借多少、这套部署现在能不能受益，见总览的[GLM 双机推演](../concepts/rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)。

迁到本工作版时，还要记录模型 revision、并行配置、两端代码、YuanRong / CANN / torch_npu 版本，再验证实际 seed 命中、输出与默认加载一致、故障回退和资源清理。不能把模型名称出现在表里当作任意卡型、任意量化实现或任意 batching 参数都兼容。

## 改代码后要隔离旧 seed，不能只看 key 仍然相同

官网提醒更新代码后处理旧实例和 Planner 中的旧元数据，并使用新的部署策略名。[S1] 当前上游 `main` 的配置指纹与结构摘要同样不含 RFork Git commit 或逐字节权重校验和，因此“代码改了但 `seed_key` 没变”仍然可能出现。[C3]

操作依据见[维护页](../concepts/rfork-maintenance.md)：保留旧事故对应提交，为新版本使用独立 `model_deploy_strategy_name`，确认旧来源退出新版本的候选集合，再按现场窗口安排实例与 Planner 的切换。示例 Planner 重启会丢失内存账本，**不应在仍有活动传输时把清空账本当成释放内存的证明**。

## 这轮证据能证明到哪里

社区上游 `main@8d6180e2`、`v0.30.0@c09d3e20` 与旧快照 `baa023ad` 的官方指南、原图及对应源码均已阅读对照；文档概括若与函数实现有出入，以实际运行提交的源码为准。

本机缺少 NPU 和配套运行依赖，没有真实集群传输结果。下面几项只能到现场取证，验收做法见[配置页](../concepts/rfork-config.md)：

- 待核：Ex 注册实际覆盖的内存范围——缺 YuanRong native 实现或真机登记记录。
- 待核：native finalize 遇到还在读的对端时怎么处理——缺 native 契约说明或真机复现。
- 待核：量化模型、Engram 宿主表和 MTP/DSpark 草稿传过去以后输出是否与默认加载一致、能省多少启动时间——缺真机对比运行。
- `latest` 会继续变化；复用本文时应核对实际指南提交。本文分别对照 `8d6180e2`、`c09d3e20` 与 `baa023ad`，不据移动网址自动扩大适用范围。

## 对照源码

- 社区上游 `main` 官方指南原文：`vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/rfork.md#L1-L561`（对应 PR `#20876`、`#21333`、`#21707` 补全后的配置回退、协议端点表、投机解码与排障章节）。[S15]
- 社区 `v0.30.0` 官方指南对照：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/rfork.md#L1-L239`；旧指南固定模型表归档：`vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rfork.md#L1-L155`。[S16][S17]
- 核心实现源码锚点（`vllm-ascend@8d6180e2`）：`rfork_loader.py#L641-L957`、`identity.py#L229-L349`、`config.py#L11-L192`、`safety.py#L9-L21`、`session.py#L490-L659`、`planner_client.py#L137-L287`、`seed_server.py#L128-L198`、`transfer_backend.py#L227-L273` / `#L491-L551` / `#L641-L694` / `#L807-L876`、`vllm_ascend/attention/sfa_v1.py#L990-L1015`。[C2][C3][C4][C5][C6][C7][C8][C9][C10][C12][C14]
