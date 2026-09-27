---
id: rfork-official-guide
title: RFork 官网核读：原图、全部章节与工作版差异
type: source
summary: 按用户指定的英文 latest RFork Guide 核读全文与架构图，对照独立工作版，区分官方使用说明、工作版实际调用路径和仍需现场验收的内容。
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
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L563-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L196-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L11-L139'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L233'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L395-L461'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L563-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_server.py#L127-L195'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L335-L425'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L503-L561'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L419'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L753-L793'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L289-L295'
  - 'rfork@3284850b:vllm_ascend/attention/sfa_v1.py#L697-L735'
  - 'rfork@3284850b:docs/source/user_guide/feature_guide/rfork.md#L320-L325'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rfork.md#L1-L155'
relations:
  - to: rfork
    kind: builds-on
    note: 官方指南是概览；独立工作版章节用实际源码展开并修正文档与代码的差异
  - to: rfork-config
    kind: builds-on
    note: 官网最小命令没有覆盖工作版的全部参数和依赖契约
  - to: rfork-maintenance
    kind: builds-on
    note: 官网 latest 会变化，不能因此自动升级用户工作版
verified:
  - 'rfork:main'
evidence: C
contradicts: []
updated: '2026-09-23'
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
---

## 一句话

**官网帮助理解目标与使用方式，工作版源码决定这套代码实际怎样执行；二者有差异时必须并列说明。** 本次核读入口是用户指定的[英文 latest RFork Guide](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/rfork.html)，核读日期为 2026-09-22，不用中文版或其他发布版替代它。[S1]

核读范围覆盖这页全部正文、小节、命令、占位符、模型表和 Flowchart 的唯一原图，也对照工作版自带指南及 lease 设计文档。`latest` 是可移动的网站地址，本页保留的是当日阅读结论；未据此推定网站的构建 commit。`verified: rfork:main` 仅指表中的工作版代码核对，不声称已验收官网社区分支或真实设备运行。

社区仓库中的指南正文与本轮读取的网页各节相对应，另留固定提交的文档来源及不可变材料，便于站内 Agent 离线追溯；这不等于证明官网由该提交构建。[S16]

## 官网每一节在本章哪里展开

| 官网小节 | 对应解释 | 核读后必须保留的边界 |
|---|---|---|
| Overview | [总览](../concepts/rfork.md)、[启动](../concepts/rfork-startup.md) | 目标相同，申请 seed 的先后顺序有差异 |
| Flowchart | 下节逐项读图、总览三条通道 | 图表示参与方与数据流，不能代替时序图 |
| Application Scenarios | 总览的扩容实例、[身份](../concepts/rfork-identity.md) | 拓扑敏感不等于沿用官网列出的全部 key 字段 |
| Usage / Prerequisites | [配置](../concepts/rfork-config.md) | Planner、数据系统、NPU 环境都要具备 |
| Configuration Fields | 配置的完整参数表 | 官网五项表不是工作版参数全集 |
| How RFork Matches Seeds | 身份的规范化、指纹、rank | 分隔符式 key 与哈希式 key 不可混用 |
| Quantized Models | [布局](../concepts/rfork-layout.md)、[传输](../concepts/rfork-transfer.md) | 搬的是后处理后的可传状态，不能只看 checkpoint |
| Tested Models | 本页模型表 | 官方记录与工作版验收是两份证据 |
| Example Commands & Placeholders | 配置的 Linux 命令和四类端口 | 先替换占位符；逻辑模型标识不等于文件路径或 API 模型名 |
| Note & Caveats | 配置限制、[生命周期](../concepts/rfork-lifecycle.md) | 动态 EPLB、示例 Planner 能力和端口行为分别核实 |

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

## 会影响排错的官网与工作版差异

| 主题 | 官网当日说明 | 工作版实际行为与影响 |
|---|---|---|
| 借 seed 的时机 | 先申请，再构造模型 | 先构造模型；processed 路径还先准备布局并同步，然后才申请。初始化耗时不能全算成占租约时间。[C2] |
| seed key | 分隔符拼接模型、拓扑与角色字段，并给出 `rfork_seed_key_separator`（默认 `$`）让人调 | 使用配置 fingerprint 加分片/角色身份的两层 sha256，key 里没有分隔符可言。官网的 `kv_role`、`node_rank`、separator 规则不可拿来手算本版 key；**`rfork_seed_key_separator` 这个字段工作版根本不读**——照官网抄进 JSON 既不生效也不报错，会被静默丢掉。[C3][C4] |
| seed HTTP 端口 | 描述为随机分配 | patch7 支持 base + global rank，端口 0 时才由 OS 随机分配；TransferEngine 端点仍独立选择。只开放固定 HTTP 端口未必能传权重。[C5][C8][C9] |
| 出错回退 | 概括为出错后走默认 loader | 必须通过清理安全门；旧资源无法安全解除时会拒绝再分配模型。启动参数校验也可能早于加载 try 块。[C2][C4][C11] |
| 传完后的发布 | 概括为加载后启动 seed | 未释放的来源租约可使发布延期；发布失败不等同于有效模型被丢弃。[C2][C9] |
| 成功日志 | 让人搜 `transfer weights starts` 与 `transfer weights time` | 起始那条本版**照样在打** `transfer weights starts`；换掉的是结束那条，现在是 `RFork weight transfer completed: weights=…, chunks=…, bytes=… GiB`。所以搜不到 `transfer weights time` 不等于没传，搜得到 `transfer weights starts` 也不等于版本不对。[C12] |
| 依赖安装 | 指向 `openyuanrong-transfer-engine` | 本版实际导入 `yr.datasystem`，并调用 Ex 注册和 finalize API。包名、能 import、native 行为相容是三层验证。[C5][C6][C7] |

随工作版保存的指南安装命令则写 `openyuanrong-datasystem`。[S15] 这是两份指南的差异记录，不能据此断言两个发行包任意版本都可互换；先用配置页的只读检查确认实际模块/API，再核部署配套版本。

上述官网列是当日说明的摘要，不是对社区所有分支代码行为的证明。[S1] 官网当前 Caveats 写的是动态 EPLB；不要把其他版本文档中的 `layer_sharding` 限制直接冒充这页原文。工作版显式绕过动态 EPLB，又会拒绝已物化的混合 CPU/NPU 参数；没有单独的 `layer_sharding` 禁用分支，也**不能反推该组合已实测支持**。[C10][C13][I]

## 量化一节的派生权重不是 KV Cache

`W_UV` / `W_UK_T` 是相关注意力实现使用的派生权重名称，分别对应 Value 上投影、Key 上投影的转置表示，不是随请求增长的 K/V Cache。工作版 SFA 实现把 `kv_b_proj` 数据按 Key/Value 维度拆分，转置并存为连续张量，之后可清空被替代的原权重；已有派生张量时则用 `copy_` 更新。[C14]

这解释了为什么 RFork 不能只搬原 checkpoint 的 Parameters：模型真正用于计算的状态已经换了位置和形状。`contiguous` 表示张量按当前维度顺序具有连续存储；转置通常先改变视图，随后生成连续数据可能另占 storage。RFork 的 processed collector 必须看最终属性及 `impl`，并保活实际注册的 storage，详见布局与内存页。

## 官方已测模型不等于本工作版已验收

| 官网模型记录 | 精度 | 官网硬件 |
|---|---|---|
| Qwen2.5-7B | BF16 | A2 |
| Qwen3-32B | BF16 | A2 |
| Qwen3-235B-A22B | BF16 | A2 |
| DeepSeek-V4-Flash-W8A8-MTP | W8A8 | A2 |
| GLM5-W4A8 | W4A8 | A2 |
| Kimi2.5-W4A8 | W4A8 | A2 |

这是官网当日报告的测试覆盖，并非本轮复现。[S1] **BF16** 是 bfloat16 浮点格式；**W8A8 / W4A8** 分别表示权重 8/4 bit、激活 8 bit 的量化方案名称，不代表模型里每一个张量都用相同位宽。MTP、dtype、scale 等见 `wiki/TERMS.md`。

迁到本工作版时，还要记录模型 revision、并行配置、两端代码、YuanRong / CANN / torch_npu 版本，再验证实际 seed 命中、输出与默认加载一致、故障回退和资源清理。不能把模型名称出现在表里当作任意卡型、任意量化实现或任意 batching 参数都兼容。

## 改代码后要隔离旧 seed，不能只看 key 仍然相同

官网提醒更新代码后处理旧实例和 Planner 中的旧元数据，并使用新的部署策略名。[S1] 工作版 fingerprint 没有自动纳入 RFork Git commit 或完整权重文件内容，因此“代码改了但 key 没变”是可能的。[C3]

本工作版的操作依据是[维护页](../concepts/rfork-maintenance.md)：保留旧事故对应版本，为新版本使用独立 strategy，确认旧来源退出新版本的候选集合，再按现场窗口安排实例与 Planner 的切换。Planner 重启会丢失示例实现的内存账本，**不应在仍有活动传输时把清空账本当成释放内存的证明**。本页没有替用户执行任何服务重启。

## 这轮证据能证明到哪里

官网全文与图、工作版的调用/分支/异常路径和随版测试均已阅读对照；代码快照的哈希由项目核验命令另行检查。原版指南或 lease 设计文档中的注释与方案不能覆盖函数实际行为。

本机缺少 NPU 和配套运行依赖，本轮没有真实集群传输结果；特别是 Ex 注册范围、native finalize 对在途 reader 的契约、量化/MTP 的数值正确性及性能收益，仍需按[配置页验收项](../concepts/rfork-config.md)取得现场证据。
