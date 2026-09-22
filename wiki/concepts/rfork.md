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
  - 'https://github.com/vllm-project/vllm-ascend/pull/12995'
  - 'https://github.com/vllm-project/vllm-ascend/pull/15439'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L258-L300
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/transfer_backend.py#L167-L202
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

## 社区版也有 RFork：七个补丁合进去三个，而且只在 main

社区三个在册版本都带一份 RFork（最早由 PR #7392 引入），所以在社区版上查 RFork 报错的人也会翻到这一章，然后发现代码对不上。下表按补丁说明社区各版本到底拿到了什么。v0.26 分支这里指 `2ed6cbba`，2026-09-17 的源码快照。

| 补丁 | 它改了什么 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 对用社区版的人意味着什么 |
|---|---|---|---|---|---|
| 0001 | 等异步布局转换做完，再注册和传「处理后布局」的缓冲区；回退时只摘掉自己那份进程级注册 | 未合入 | 未合入 | 已合入（PR #12995） | 三个已合入补丁里最该在意的一个。量化模型和 MoE 模型在 v0.23、v0.26 上可能传到还没转完的布局，输出是坏的，回退也可能连带失败 |
| 0002 | 注册期间一直持有张量 owner，收完一轮不再清掉缓存的引用 | 未合入 | 未合入 | 已合入（PR #15439） | v0.23、v0.26 上「地址还注册着、张量已经被回收」是可能发生的。它表现为传输阶段的地址类报错，查配置查不出来 |
| 0003 | draft 模型注册时减掉与 target 重叠的地址区间，seed manifest 和接收端跟着对齐 | 未合入 | 未合入 | 已合入（PR #15439） | 只影响开了投机解码的部署：v0.23、v0.26 上 draft 模型会撞上 HCCL 拒绝重叠注册。不开投机解码的不受影响 |
| 0004 | 把租约、注册存储、seed 服务、回退与关停收进 `RForkSession`，补上兼容性指纹与 manifest 校验，另拆出八个模块 | 未合入 | 未合入 | 未合入 | 本章的主干在社区版里没有对应代码。[身份匹配](rfork-identity.md)、[元数据与传输](rfork-transfer.md)、[租约与生命周期](rfork-lifecycle.md) 这几页只能当背景读，不能照着在社区版上排错 |
| 0005 | 懒解析硬件 profile，改用 v0.26 里 `AscendUnquantizedFusedMoEMethod` 的新位置 | 未合入 | 未合入 | 未合入 | 它新建的 `compat.py` 依附于 0004 的结构，社区版没有这个文件，也用不上 |
| 0006 | 关停防重入、seed 广播串行化、收窄异常捕获、张量别名去重、planner 404 当幂等 | 未合入 | 未合入 | 未合入 | 它改的 `session.py`、`planner_client.py`、`tensor_layout.py` 社区版一个都没有 |
| 0007 | seed 端口可按 rank 偏移；`topk_indices_buffer` 这类运行期 scratch 不跨实例传 | 未合入 | 未合入 | 未合入 | 两条都落在社区版身上：社区 seed 服务只有动态端口，固定不了端口段；而且三个版本都会把挂在模块上的普通张量属性一起收走、没有 scratch 排除名单 [C13]，两个实例的 `max_num_batched_tokens` 不一样，DeepSeek-V4 这类模型就会在接收端撞形状不符 |
| 衔接差异 | patch6 与 patch7 基线之间的实现差异：租约设计文档、回退清理、隔离测试 | 未合入 | 未合入 | 未合入 | 它同样建在 0004 的模块结构上，社区版没有落脚点；这份差异是怎么来的见[版本维护](rfork-maintenance.md) |

三列的判定依据统一写在这里，不逐格挂标记。0001 对应社区提交 `bc5a79ede`，0002 与 0003 被合成一个社区提交 `a59dea592`；把补丁里的源码 hunk 和这两个提交逐行比过，除 blob hash 与行偏移之外完全一致。这两个提交对 main 做祖先检查都返回 yes，对 v0.23、v0.26 两个钉点都返回 no，再按 PR 号和标题文本在那两个分支上搜一遍，也没有 cherry-pick 的痕迹 [D]。0004–0007 的判定更直接：它们新建或改动的 `session.py`、`identity.py`、`manifest.py`、`config.py`、`tensor_layout.py`、`planner_client.py`、`seed_client.py`、`types.py`、`compat.py`，在三个社区钉点上一个都不存在。0003 的区间排除逻辑在 main 上确实读得到 [C12]。

结构差异是这张表之外最要紧的一件事。社区版的 RFork 目录只有六个文件——`__init__`、`rfork_loader`、`rfork_worker`、`seed_protocol`、`seed_server`、`transfer_backend`；工作版是十三个 [D]。0004 删掉了 `rfork_worker.py` 和 `seed_protocol.py`，把它们的职责分给新建的 `session.py`、`planner_client.py`、`seed_client.py`，又补上 `identity.py`、`manifest.py`、`config.py`、`tensor_layout.py`、`types.py`，0005 再加 `compat.py`。所以社区版没有一个统一管租约和生命周期的对象，seed 元数据与 planner 调用都挤在 `seed_protocol.py` 里，也没有独立的身份指纹和 manifest 校验层。本章按模块分的那些页，在社区版上找不到对应文件，不是文件名不同，是那层代码没有。

核对方法与范围：2026-09-23 在本地社区克隆上，对 `2c59ff10`（v0.23）、`2ed6cbba`（v0.26）、`baa023ad`（main）三个钉点分别跑了 RFork 目录的 `git log`、`merge-base --is-ancestor`、按 PR 号与标题的 `--grep`，再把补丁源码 hunk 与社区提交逐行 diff。**这张表只说明社区版合进了哪些补丁，不代表本章其余内容适用于社区版**——正文其他部分仍然只讲工作版，`verified` 也只有 `rfork:main` 一个。

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
