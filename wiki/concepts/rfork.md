---
id: rfork
title: RFork：工作版机制与排错总览
type: feature
summary: 新实例起来时不从磁盘读权重，而是直接去一台已经跑着的实例的 NPU 上把权重读过来，省下加载时间。这一章只讲用户指定的工作版，这页是总图、阅读顺序和排错入口。
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
updated: '2026-09-25'
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

## 集群里已经有一台跑着同一个模型，新实例还要从磁盘再读一遍权重吗

扩容时要再起一个实例 B。常规做法是 B 从磁盘把整份权重读进来、搬上 NPU，模型越大等得越久。可集群里已经有一个实例 A 跑着同一个模型，权重就摆在 A 的 NPU 上。RFork（Tensor Remote Fork）做的就是这件事：让 B 向 A 借一份**权重的数据来源**。

借的只是数据。B 先在自己的 NPU 上把模型搭好、把放权重的空位分配好，然后把 A 那边的权重字节读进这些空位。它加速的只是模型加载这一步；B 仍然有自己的一份模型内存、自己的推理请求和自己的 KV Cache，和 A 不共用。

**这一章只讲用户确认的 RFork 工作版**——它有自己独立的代码历史，行为结论不从社区 v0.23 / v0.26 / main 那几页继承。社区版也带一份 RFork，但只合进了一小部分补丁，差别见下一节。

```wiki-diagram
file: rfork-architecture
```

## 社区版也有 RFork，但只拿到了三个补丁，而且只在 main

社区三个在册版本都带一份 RFork，所以在社区版上查 RFork 报错的人也会翻到这一章，然后发现代码对不上。简单说：

- 工作版一共七个补丁加一份衔接差异。**社区只合进了前三个，而且只在 main 开发主线上**；v0.23 和 v0.26 一个都没有。
- 这三个里最该在意的是第一个：等权重布局转换做完再传。v0.23、v0.26 上的量化模型和 MoE 模型，可能读到还没转换完的权重，输出是坏的。
- 后四个补丁建起了这一章的主干——统一管租约和生命周期的会话对象、身份指纹、清单校验。社区版里**这一层代码根本不存在**，不是文件名不一样。所以身份匹配、元数据与传输、租约与生命周期这几页，用社区版的人只能当背景读，不能照着排错。

逐个补丁的对照表、判定依据和核对方法，放在下半「版本差异」。

## 请求还没进来，RFork 就已经在准备模型

RFork 发生在推理请求到达之前。B 用 RFork 把模型准备好，之后请求来了，照常走分词、调度、前向和采样。RFork 不负责给请求挑机器，也不会把 A 已经服务过的对话迁到 B。

要搬多少字节，由模型有哪些要传的权重、怎么切分来决定，跟请求长短没关系。[贯穿例子](one-request.md)的问题是 37 个 token 还是 100 个 token，搬的量都一样。

搬的时候按字节分批：一批最多 1 GiB，或者最多 512 段。这里的「批」只是权重传输的批次，和 [KV Cache](kv-cache.md) 里按 token 分的块不是一回事。

拿一个小模型算一遍：一个 6 亿参数的模型（Qwen3-0.6B），每个参数 2 字节，整份权重约 1.12 GiB。单卡不切分，B 就要从 A 读回这 1.12 GiB，按 1 GiB 一批，大约分成 2 批。

## 图里三条通道，出了问题要找不同的地方

| 通道 | 传什么 | 谁负责 | 出错时先看 |
|---|---|---|---|
| Planner 协调 | 该找谁借、发借用名额、归还租约、上报健康状态 | Planner 客户端 | seed key、HTTP 状态、租约记录 |
| seed 的 HTTP 元数据 | 传输端点、每个张量的名字、地址、形状、类型 | A 上的 seed 服务、B 上的 seed 客户端 | 返回的结构、地址能不能到、清单对不对得上 |
| 权重数据 | NPU 上张量的字节 | 传输后端 | 内存登记、字节范围、TransferEngine 的报错 |

Planner 和 seed 的 HTTP 接口都不搬权重本身。B 从元数据里拿到 A 的端点和地址，然后自己发起读取。所以「HTTP 都通了」只能说明前两条通道有一部分是好的，权重那条还没验。

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

每篇只回答一个问题。专业词先在术语页找入口，到机制页再结合具体的地址、状态和调用展开。

另附[官网全文与原图核读](../sources/rfork-official-guide.md)：按用户指定的英文 latest 指南逐节对照，解释官方架构图、列出官方测试范围，并标出它和工作版在申请时机、key、端口和依赖上的差异。排错时先确认是哪个版本，再用对应的规则。

## 「成功」至少有四种，不能压成一个开关

| 看到的结果 | 已经证明了什么 | 还没证明什么 |
|---|---|---|
| 日志说权重传完了 | 这一次列出的所有读取都返回成功 | 后处理、模型服务就绪、输出对不对 |
| 加载器把模型交回来了 | 模型走完了这条加载路径，进入推理模式 | 整个 API 服务已经起来、B 自己已经能当 seed |
| 日志说租约归还被确认 | Planner 接受了归还 | 整段传输期间租约一直有效 |
| 日志说 seed 服务已启动 | B 上的 seed 服务起来了，并完成第一次上报 | 之后一直健康、下一个实例一定能匹配到它 |

传输成功后，归还租约交给后台去做，不占启动的时间。归还还没被确认时，「B 成为新 seed」这件事先记成延期，模型照常交回。seed 服务没起来，也不会把已经加载好的模型扔掉——模型照样交回，只是 B 暂时不当别人的来源。

## 排错先问三件事：哪个版本、哪个阶段、哪个 rank

同一句「传输失败」可能出在内存登记、元数据、清单校验，也可能真的是读数据时失败。只截最后一行，信息通常不够。要留下第一次 RFork 报错之前的上下文，至少带上：工作版的提交、是主模型还是投机解码的 draft 模型、各类 rank、两端的配置，以及 Planner 的相关响应。

排错先读[排错页](rfork-troubleshooting.md)，再顺着里面给的源码位置去核。这一章标着「对源码核过」的结论，意思是对着工作版源码逐行读过，**不代表在真实 NPU 集群上复现过**。涉及网络、数据系统接口或生产环境 Planner 的行为，要用现场证据补齐。

## 常见误解

- **「fork 就是复制进程」**——这里复用的只是远端的权重数据。新实例自己搭模型，读进自己的地址。
- **「同一个模型路径就能互传」**——还要先通过兼容性指纹和分片身份的匹配，再由清单逐个张量核对元素数、每个元素几字节和类型，张量条数和总字节数两端也要一致。
- **「RFork 报警就是启动失败」**——要看后面有没有回退、最后结果如何。只有旧资源没法安全清理这类情况，加载器才会拒绝再分配模型。

## 对照源码

### 怎么开

本章例子里的设定是教学条件：已有实例 A 加载完成，新实例 B 启动时用 `--load-format rfork`，且两边的模型、布局和分片配置兼容。[A] 参数放哪、默认值、端口见[配置与部署](rfork-config.md)。

### 会报什么错

四种「成功」对应的日志原文：

| 日志 | 对应上半的哪一行 |
|---|---|
| `RFork weight transfer completed` | 权重传完了 |
| 加载器返回模型并 `eval` | 加载器把模型交回来了 |
| `lease release acknowledged` | 租约归还被确认 |
| `seed service started` | seed 服务已启动 |

成功传输后，租约释放交给 session 的后台线程，不占启动线程 [C2]；释放还没确认时，seed 发布先记成延期（`DEFERRED`），模型加载照常返回 [C4]。seed 服务启动失败时辅助函数只返回 false，模型对象原样交回调用者 [C7]。

`transfer failed` 这一句可能来自注册、元数据、校验或真正的数据读取；报错时要带上工作版提交、main/draft 角色、global/TP/PP/EP rank、两端配置和 Planner 响应。[I]

「HTTP 都通了」不等于权重通道正常：Planner 与 Seed HTTP 都不承载权重主体，接收端从元数据取远端端点与地址后再调 `batch_transfer_sync_read`。[C3]

常见误解对应的源码依据：新实例自己构建模型、向自己的地址读取 [C1]；兼容性指纹与分片身份匹配 [C6]，manifest 逐个张量核对 numel、元素字节数与 dtype，并要求张量条数和总字节两端一致 [C8]；只有无法安全清理旧资源等情形，加载器才拒绝再分配模型 [C5]。

页面标 C 表示结论对着工作版源码逐行核过，不表示已在真实 NPU 集群上复现。

### 开销和什么时候别开

一批传输的上限是 1 GiB 或 512 个字节段，和 KV block 按 token 分块无关。[C9]

小模型的搬运量推导：Qwen3-0.6B 参数以 bf16 存放，每元素 2 字节，`0.6e9 × 2 B ≈ 1.2 GB ≈ 1.12 GiB`；单卡不切分即 B 要读回的量，按 1 GiB 批上限约 2 批同步读，与请求 token 数无关。[D]

### 版本差异

**本章只讲用户确认的 RFork 工作版：patch7 所在的完整代码历史。** 版本钉点见来源与[版本维护](rfork-maintenance.md)，不继承社区 v0.23 / v0.26 / main 页的行为结论。原 patch1–6 与 patch7 曾分叉，不能把原七个补丁直接拼接当作本章版本。

社区三个在册版本的 RFork 最早由 PR #7392 引入。下表按补丁说明社区各版本到底拿到了什么；v0.26 分支这里指 `2ed6cbba`，2026-09-17 的源码快照。

| 补丁 | 它改了什么 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 对用社区版的人意味着什么 |
|---|---|---|---|---|---|
| 0001 | 等异步布局转换做完，再注册和传「处理后布局」的缓冲区；回退时只摘掉自己那份进程级注册 | 未合入 | 未合入 | 已合入（PR #12995） | 三个已合入补丁里最该在意的一个。量化模型和 MoE 模型在 v0.23、v0.26 上可能传到还没转完的布局，输出是坏的，回退也可能连带失败 |
| 0002 | 注册期间一直持有张量 owner，收完一轮不再清掉缓存的引用 | 未合入 | 未合入 | 已合入（PR #15439） | v0.23、v0.26 上「地址还注册着、张量已经被回收」是可能发生的。它表现为传输阶段的地址类报错，查配置查不出来 |
| 0003 | draft 模型注册时减掉与 target 重叠的地址区间，seed manifest 和接收端跟着对齐 | 未合入 | 未合入 | 已合入（PR #15439） | 只影响开了投机解码的部署：v0.23、v0.26 上 draft 模型会撞上 HCCL 拒绝重叠注册。不开投机解码的不受影响 |
| 0004 | 把租约、注册存储、seed 服务、回退与关停收进 `RForkSession`，补上兼容性指纹与 manifest 校验，另拆出八个模块 | 未合入 | 未合入 | 未合入 | 本章的主干在社区版里没有对应代码。[身份匹配](rfork-identity.md)、[元数据与传输](rfork-transfer.md)、[租约与生命周期](rfork-lifecycle.md) 这几页只能当背景读，不能照着在社区版上排错 |
| 0005 | 懒解析硬件 profile，改用 v0.26 里 `AscendUnquantizedFusedMoEMethod` 的新位置 | 未合入 | 未合入 | 未合入 | 它新建的 `compat.py` 依附于 0004 的结构，社区版没有这个文件，也用不上 |
| 0006 | 关停防重入、seed 广播串行化、收窄异常捕获、张量别名去重、planner 404 当幂等 | 未合入 | 未合入 | 未合入 | 它改的 `session.py`、`planner_client.py`、`tensor_layout.py` 社区版一个都没有 |
| 0007 | seed 端口可按 rank 偏移；`topk_indices_buffer` 这类运行期 scratch 不跨实例传 | 未合入 | 未合入 | 未合入 | 两条都落在社区版身上：社区 seed 服务只有动态端口，固定不了端口段；而且三个版本都会把挂在模块上的普通张量属性一起收走、没有 scratch 排除名单，两个实例的 `max_num_batched_tokens` 不一样，DeepSeek-V4 这类模型就会在接收端撞形状不符 |
| 衔接差异 | patch6 与 patch7 基线之间的实现差异：租约设计文档、回退清理、隔离测试 | 未合入 | 未合入 | 未合入 | 它同样建在 0004 的模块结构上，社区版没有落脚点；这份差异是怎么来的见[版本维护](rfork-maintenance.md) |

三列的判定依据统一写在这里，不逐格挂标记。0001 对应社区提交 `bc5a79ede`，0002 与 0003 被合成一个社区提交 `a59dea592`；把补丁里的源码 hunk 和这两个提交逐行比过，除 blob hash 与行偏移之外完全一致。这两个提交对 main 做祖先检查都返回 yes，对 v0.23、v0.26 两个钉点都返回 no，再按 PR 号和标题文本在那两个分支上搜一遍，也没有 cherry-pick 的痕迹 [D]。0004–0007 的判定更直接：它们新建或改动的 `session.py`、`identity.py`、`manifest.py`、`config.py`、`tensor_layout.py`、`planner_client.py`、`seed_client.py`、`types.py`、`compat.py`，在三个社区钉点上一个都不存在。0003 的区间排除逻辑在 main 上确实读得到 [C12]。

结构差异是这张表之外最要紧的一件事。社区版的 RFork 目录只有六个文件——`__init__`、`rfork_loader`、`rfork_worker`、`seed_protocol`、`seed_server`、`transfer_backend`；工作版是十三个 [D]。0004 删掉了 `rfork_worker.py` 和 `seed_protocol.py`，把它们的职责分给新建的 `session.py`、`planner_client.py`、`seed_client.py`，又补上 `identity.py`、`manifest.py`、`config.py`、`tensor_layout.py`、`types.py`，0005 再加 `compat.py`。所以社区版没有一个统一管租约和生命周期的对象，seed 元数据与 planner 调用都挤在 `seed_protocol.py` 里，也没有独立的身份指纹和 manifest 校验层。本章按模块分的那些页，在社区版上找不到对应文件，不是文件名不同，是那层代码没有。

核对方法与范围：2026-09-23 在本地社区克隆上，对 `2c59ff10`（v0.23）、`2ed6cbba`（v0.26）、`baa023ad`（main）三个钉点分别跑了 RFork 目录的 `git log`、`merge-base --is-ancestor`、按 PR 号与标题的 `--grep`，再把补丁源码 hunk 与社区提交逐行 diff。**这张表只说明社区版合进了哪些补丁，不代表本章其余内容适用于社区版**——正文其他部分仍然只讲工作版，`verified` 也只有 `rfork:main` 一个。

### 源码位置

三条通道在工作版里的负责者：

| 通道 | 类 / 函数 |
|---|---|
| Planner 协调 | `RForkPlannerClient`（`planner_client.py`） |
| Seed HTTP 元数据 | seed server / seed client |
| 权重数据 | `RForkTransferBackend`（`transfer_backend.py`），读取调用 `batch_transfer_sync_read` |

加载器主流程在 `rfork_loader.py`；取元数据与发起传输在 `session.py` 的 `transfer_from_seed` / `fetch_seed_transfer_info`；租约释放与 seed 发布在 `session.py`；身份指纹在 `identity.py`；manifest 校验在 `manifest.py`；传输批上限常量在 `transfer_backend.py`。
