---
id: rfork
title: RFork：工作版机制与排错总览
type: feature
summary: 从已有实例的 NPU 内存加载权重，让新实例完成暖启动。本章只讲用户指定的独立工作版，串起布局、身份、传输、租约与回退，供阅读和报错定位使用。
aliases:
  - RFork
  - rfork
  - R-Fork
  - Tensor Remote Fork
  - Tensor R-Fork
  - RFork 工作版
  - rfork_loader
chapters: []
order: 10
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L521-L644'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L732-L793'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L296-L347'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L645-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L196-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L81-L109'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/manifest.py#L198-L252'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L33-L35'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: RFork 在 Worker 加载模型时运行，推理请求开始前就要把权重准备好
contradicts: []
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-83e2a01865a32aa947474f37b05149cfa00df90169b1014f4d2301934a03afb6.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 一句话

RFork（Tensor Remote Fork）让新实例向已有实例借一份**权重数据源**：先在自己的 NPU 上建模型和目标缓冲区，再把对方的权重读进来。它加速的是模型加载；目的实例仍有自己的模型内存、推理请求和 KV Cache。[C1]

**本章只讲用户确认的 RFork 工作版：patch7 所在的完整代码历史。** 版本钉点见来源与[版本维护](rfork-maintenance.md)，不继承社区 v0.23 / v0.26 / main 页的行为结论。原 patch1–6 与 patch7 曾分叉，不能把原七个补丁直接拼接当作本章版本。

```wiki-diagram
file: rfork-architecture
```

## 那条请求还没进来，RFork 已经在准备它要用的模型

[那条请求](one-request.md)是 Qwen3-0.6B、问题 37 token、回答 200 token。原设定没有打开 RFork；这里增加一项教学条件：已有实例 A 完成加载，新实例 B 使用 `--load-format rfork`，且两边的模型、布局和分片配置兼容。[A]

在请求送到 B 之前，B 用 RFork 准备模型。搬运量取决于模型的可传张量和分片，不取决于这次问题有 37 token，也不按 KV block 的 128 token 来分块。RFork 传输的块是按字节划分的权重传输批次，一批的上限是 1 GiB 或 512 个字节段，和 [KV Cache](kv-cache.md) 的块不是一个概念。[C9]

按这条请求的模型算一遍：Qwen3-0.6B 的参数以 bf16 存放，每个元素 2 字节，`0.6e9 × 2 B ≈ 1.2 GB ≈ 1.12 GiB`。单卡不切分，这 1.12 GiB 就是 B 要从 A 读回来的量；按 1 GiB 的批上限，大约切成 2 批同步读。问题是 37 token 还是 100 token，都不改变这个数。[D]

加载成功后，这条请求仍走正常的分词、调度、前向与采样。RFork 不负责给它选择计算节点，也不把 A 已经服务过的对话迁到 B。

## 图里三条通道，各自出了问题要找不同的人

| 通道 | 传什么 | 主要负责者 | 报错时先检查 |
|---|---|---|---|
| Planner 协调 | 找谁、借用名额、归还租约、发布健康状态 | `RForkPlannerClient` | seed key、HTTP 状态、租约记录 |
| Seed HTTP 元数据 | 传输端点、张量名称、地址、形状、类型 | seed server / seed client | 返回结构、地址可达性、manifest |
| 权重数据 | NPU 张量的字节 | `RForkTransferBackend` | 内存注册、字节范围、TransferEngine 错误 |

Planner 和 Seed HTTP 接口都不承载权重主体。接收端从元数据中取得远端端点与地址，再调用 `batch_transfer_sync_read`；“HTTP 都通了”只能说明前两条通道的一部分正常。[C3]

## 先按这个顺序读，再按报错回到对应页

| 阅读顺序 | 这一篇回答什么 |
|---|---|
| 1. [术语](rfork-terms.md) | seed、rank、layout、storage、MR、manifest、lease 分别指什么 |
| 2. [启动路径](rfork-startup.md) | 从选中加载器到模型返回，先做什么，什么时候申请租约 |
| 3. [身份匹配](rfork-identity.md) | 为什么有实例却找不到 seed，怎样避免拿错分片 |
| 4. [张量布局](rfork-layout.md) | 量化和 NZ 为什么改变传输时机，patch7 为什么排除 topk 缓冲区 |
| 5. [内存与共享](rfork-memory.md) | 地址背后的对象谁保活，main / draft 怎样避免重复注册 |
| 6. [元数据与传输](rfork-transfer.md) | manifest 怎样验收，一次 read 怎样形成，什么叫传完 |
| 7. [租约与生命周期](rfork-lifecycle.md) | 为什么传完了还不能成为 seed，什么时候允许回退或销毁 |
| 8. [配置与部署](rfork-config.md) | 参数放哪、默认值、地址与端口、限制、怎样测启动收益 |
| 9. [报错排查](rfork-troubleshooting.md) | 按原始日志找阶段，区分证据、候选原因与下一步 |
| 10. [版本维护](rfork-maintenance.md) | 本地代码在哪，补丁来了怎样更新，怎样留下可核对的历史 |

这是一个章节的分篇阅读路线。每篇负责一个问题；专业词在术语页有入口，在机制页结合具体地址、状态或调用展开。

另附[官网全文与原图核读](../sources/rfork-official-guide.md)：按用户指定的英文 latest 指南逐节对照，解释官方架构图、列出官方测试范围，并标出与工作版的申请时机、key、端口和依赖差异。排错时先确认版本，再使用对应规则。

## “成功”至少有四种，不能压成一个开关

| 观察到的结果 | 它已经证明什么 | 尚未证明什么 |
|---|---|---|
| `RFork weight transfer completed` | 本次列出的同步读取调用都返回成功 | 后处理、模型服务就绪、输出一致性 |
| 加载器返回模型 | 模型完成本条加载路径的处理并进入 eval | API 服务整体已启动，自己已经成为 seed |
| `lease release acknowledged` | 客户端接受 Planner 的释放响应 | 整段传输期间租约一直有效 |
| `seed service started` | 本地 seed 服务启动并完成初次上报 | 后续一直健康，下一实例一定匹配到它 |

成功传输后，租约释放交给 session 的后台线程，不占启动线程 [C2]；释放还没确认时，seed 发布先记成延期（`DEFERRED`），模型加载照常返回 [C4]。seed 服务启动失败也不会自动丢掉已经加载好的模型：辅助函数只返回 false，模型对象原样交回调用者 [C7]。

## 故障分析先问“哪个版本、哪个阶段、哪个 rank”

同一句 `transfer failed` 可能来自注册、元数据、校验或真正的数据读取。只截最后一行，信息通常不够。要保留首次 RFork 异常之前的上下文，至少带上工作版提交、main/draft 角色、global/TP/PP/EP rank、两端配置和 Planner 的相关响应。[I]

Agent 应先读[排错页](rfork-troubleshooting.md)，再沿文中给出的源码文件与行号查证。页面标 C 表示结论对着工作版源码逐行核过，不表示已经在真实 NPU 集群上复现过。涉及网络、数据系统 API 或生产 Planner 行为时，必须用现场证据补齐。

## 常见误解

- **“fork 就是复制进程”**——此处复用的是远端权重数据，新实例自己构建模型，并向自己的地址读取。[C1]
- **“同一个模型路径就能互传”**——还要通过兼容性指纹和分片身份匹配 [C6]，再由 manifest 逐个张量核对 numel、元素字节数与 dtype，张量条数和总字节也要两端一致 [C8]。
- **“RFork 报警就是启动失败”**——要看后面的回退和最终结果；只有无法安全清理旧资源等情形，加载器才会拒绝再分配模型。[C5]
