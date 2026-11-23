---
id: rfork-maintenance
title: RFork 版本维护：上游演进脉络、历史补丁归档与升级隔离
type: feature
summary: >-
  RFork 已完成从早期工作分支到社区上游 vllm-ascend main（8d6180e2）的演进与合入。这页讲：如何核对当前运行代码与上游提交，
  早期七份历史补丁与衔接差异为何曾分叉、如今怎样对应社区 PR，升级时要回看哪几页并如何隔离旧 seed 池，以及哪些事只能到真机现场确认。
aliases:
  - RFork 版本
  - RFork patch7
  - RFork patch1-6
  - RFork 补丁维护
  - RFork 代码位置
  - '3284850'
  - 2db39b6
  - 7b1a690
chapters: []
order: 110
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L747-L957'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L289-L478'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L588-L659'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L34-L42'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
  - >-
    raw:sha256-7ddf61a5cd0186fd58b6ced0f29398dc3675db2d1ded92cc39c2b9ed331ab916.md#L1-L293
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/local_weights.py#L61-L97'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L600-L710'
verified:
  - main
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 本章全部机制已对齐社区上游 main，更新升级时要保持整章与代码一起演进
  - to: rfork-troubleshooting
    kind: builds-on
    note: 排错前先识别实际运行版本，旧报错不能直接套用后来版本的行为
  - to: rfork-layout
    kind: builds-on
    note: 维护涉及权重采集、布局或量化方法的改动时，需依据布局页核对张量采集与运行时工作区排除规则
contradicts: []
updated: '2026-11-19'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-53eef0148da8e153b65a9775a7950f4593f691b77b1f6a98c26dfa63bf9cdb3d.md
  - >-
    raw/sha256-7ddf61a5cd0186fd58b6ced0f29398dc3675db2d1ded92cc39c2b9ed331ab916.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## 同事又发来一份补丁，现在跑的到底是哪版代码

升级或合入 RFork 新改动前，第一个问题就是：「现在运行的是哪一份完整代码？」是社区 `v0.30.0`、社区上游 `main`，还是历史上在外部独立维护的补丁链？

**版本维护要做的，就是任何时候都说得清「现在运行的是哪一份完整代码」，并让历史补丁、上游提交和知识页三样东西彼此对得上。** RFork 本身是什么见[总览](rfork.md)。历史上本章曾以独立工作分支的七份补丁作为过渡基线；随着 PR `#12995`、`#15439`、`#15935` 合入 `v0.30.0`，以及 `#17366`、`#20111`、`#20876`、`#21333`、`#21707` 落地社区主干，**当前全章已原子重锚至社区上游 `vllm-project/vllm-ascend` `main`（`8d6180e2`）**。判断当前行为只认社区上游对应固定提交的完整源码；早期七份补丁原件作为历史演进归档保留，用于追溯「某个保护机制当初为何引入」，不再代表现行代码。

下图记录了早期七份历史补丁真实的分叉关系（现均已被上游演进吸收）：

```wiki-diagram
file: rfork-patch-history
```

当前主基线的唯一钉点定义在项目 `wiki/seeds/vllm-ascend.yaml` 的 `main`（`8d6180e2`），原独立分支钉点已退役归档。本章各页标注的 `verified: [main]` 表示已对照社区上游 `8d6180e2` 源码逐项核验，并在文末提供 `v0.23.0` / `v0.26.0rc` / `v0.30.0` / `main` 四版本矩阵；后续上游更新时，源码钉点、机制页、排错页与 2D 图 `pins` 须同步核对更新。

## 七份补丁不是一条链

直觉上，前六份补丁依次打完，再打第七份，就该得到当前代码。实际不是这样。

看上图：补丁 1 到 3 是两路共有的，**从补丁 3 之后，历史分成了两路**。上面一路是原来的补丁 4、5、6；下面一路先有另外三次提交，再往后才是补丁 7。按这三次提交自己的说明，它们和补丁 4–6 主题相近，但实现和覆盖范围不同：重构传输和会话、适配 v0.26 的接口并在回退时放掉 MoE 的旧权重、回退之前摘掉编译留下的钩子。补丁 7 是对着下面这一路写的。

于是第七份补丁改到的一部分测试文件，在补丁 6 的终点上根本不存在；一个管张量布局的文件，前后文也对不上。图上标着「直接打不上」的那条虚线就是这个意思。

2026-09-21 做过一次核对：在补丁 6 终点的干净工作区上先「试打」第七份补丁，确实打不上去。随后从两路终点的两个确切提交之间，单独导出一份**衔接差异**（图上从补丁 6 拐下来的那条虚线），并验证了「基线 → 原六份补丁 → 衔接差异 → 原第七份补丁」这样一步步重建出来的整棵代码树，和当前完整实现一模一样。

这份衔接差异不小：18 个文件，增 3080 行、删 185 行。大头是测试和一份租约生命周期的设计文档；落在源码上的只有六个文件、合计约 300 行增删，涉及 Planner 客户端、加载器、会话和张量布局等。所以下面那一路三次提交带来的变化，既不能算在补丁 4–6 头上，也不能算在补丁 7 头上。

原始补丁没有被悄悄改写；衔接差异单独存放，并明确标成「从版本历史另外生成的材料」，不冒充用户给的补丁内容。

## 每份补丁管什么，读的时候边界在哪

每份补丁具体改了什么、社区各版本有没有合进去，只在[总览的版本对照](rfork.md#版本差异)里写一份。这里只讲**拿着补丁原件读的时候，能说明什么、不能据此断言什么**：

| 材料 | 原件管的事 | 读的时候的边界 |
|---|---|---|
| 第一份补丁 | 布局传输、NPU 同步与回退相关处理 | 不能据此断言已经覆盖后面所有清理问题 |
| 第二份补丁 | 保留登记过的张量的所有者 | 当前实现还额外保留了原始存储，应看最终代码 |
| 第三份补丁 | 投机解码的 draft 模型和主模型重复登记的问题 | 什么时候算共享、全部共享时怎么走，仍以最终代码为准 |
| 第四到第六份补丁 | 传输与会话层重构、v0.26 接口适配、清理与并发处理 | 走的是图上面那一路，和补丁 7 的底不同，不能把这里的实现细节平移到当前代码 |
| 衔接差异 | 两路终点之间的差：租约、回退、清理、张量安全和测试 | 单独记录，不算进「第七份补丁的内容」 |
| 第七份补丁本身 | 来源服务的 HTTP 端口可以按 rank 固定下来；采集时跳过本机的 top-k 下标缓冲区 | 不负责固定传输引擎的端口；跳过名单里只有这一个缓冲区，不是所有临时缓冲区 |

第七份补丁的端口怎么配见[配置](rfork-config.md#四类端口谁监听谁来连由什么决定)，那个缓冲区为什么不从来源搬见[布局](rfork-layout.md#本机的工作区不从-a-搬)。当前代码里另外一些行为——晚一点才去申请租约（见[启动](rfork-startup.md)）、先快后慢的后台归还租约（见[生命周期](rfork-lifecycle.md)）、回退时清理全局编译与 MoE 引用——都要看最终的加载器和会话代码；第七份补丁本身能直接对上的，只有端口和 top-k 采集这两处变化。

维护后台归还租约的逻辑时，要先区分成功与停止重试：归还成功（`RELEASED`）会先清除租约，再推进延迟启动 seed 的安排。若遇暂态错误（`RETRYABLE`），前 3 次按配置间隔快速重试，之后转入至少 60 秒间隔的慢速重试；只有收到永久拒绝（`REJECTED`）或进入关停时，才取消延迟启动 seed 的安排（Worker 不再发布 seed，模型加载或推理照常继续）。维护时应分别检查租约是否解决、seed 是否发布以及推理是否继续，现场行为还需实际验证。

历史上为了适配旧版 `v0.26` 缺少硬件档案模块，工作分支曾引入过临时兼容垫片 `compat.py`；在合入社区上游 `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）后，该垫片已随原生 `vllm_ascend.device.hardware_profile` 移除，可变权重绕过守卫统一收敛到 `safety.py`。

## 代码放在哪：一份快照用来读，一份完整仓库用来改

项目里与 RFork 相关的代码位置分工如下：

- **社区上游完整克隆（`tools/repos/vllm-ascend/`）**：唯一现行代码来源，钉点 `main@8d6180e2` 与 `releases/v0.30.0@c09d3e20` 统一登记在 `wiki/seeds/vllm-ascend.yaml`，供源码核验与 `pnpm wiki:audit` 行号审计使用。
- **历史补丁归档（`rfork/`）**：保留早期七份原始补丁、衔接差异与已退役的 `archived-seed.yaml`，仅用于追溯历史演进与审计背景，**不再作为现行实现基线**。

读历史快照时仍守住几条边界：看到有测试，不等于这一轮在 NPU 上跑过；示例 Planner 只证明示例协议，代替不了现场的生产 Planner；文档与代码冲突时以实际运行的上游源码为准。

## 新补丁来了：回看哪些页，上线时怎样和旧版隔开

按改动涉及的区域，至少回看这些页：

| 改到的区域 | 至少回看哪些页 |
|---|---|
| 配置、端口、网络端点 | [配置](rfork-config.md)、[排错](rfork-troubleshooting.md)、[总览里的架构图](rfork.md) |
| 身份、rank、draft 判断 | [身份](rfork-identity.md)、[排错](rfork-troubleshooting.md)里找不到来源的那部分 |
| 权重采集、布局、量化方法 | [布局](rfork-layout.md)、[传输](rfork-transfer.md)、[输出一致性验收](rfork.md#成功至少有四种不能压成一个开关) |
| 传输内存的登记、注销、收尾 | [传输](rfork-transfer.md)、[生命周期](rfork-lifecycle.md)、[排错](rfork-troubleshooting.md)里清理失败的那部分 |
| 会话、租约、Planner 协议 | [启动](rfork-startup.md)、[生命周期](rfork-lifecycle.md)、[配置](rfork-config.md)、[排错](rfork-troubleshooting.md)里 400/404 的那部分 |
| 回退、全局模型引用 | [启动](rfork-startup.md)、[传输](rfork-transfer.md)、[排错](rfork-troubleshooting.md)里 OOM 的那部分 |

升级或引入新上游提交时，按顺序确认新钉点、核对行为差异、跑 `pnpm wiki:diagrams --check`、`pnpm wiki:lint` 与 `pnpm wiki:audit`，并同步更新 10 篇 RFork 文档与全部 RFork 2D 图的 `pins`。

```wiki-diagram
file: rfork-fig-upgrade-isolation
```

改好的代码要上线时，最容易踩的坑是**代码升级未必会改变 `seed_key`**。配置指纹里有部署策略名、协议版本和模型权重的版本号，**却没有 RFork 代码本身的提交号**（见[身份](rfork-identity.md#部署指纹里写了什么)）。只要模型配置、张量结构摘要与协议版本等指纹输入未变，新旧代码仍会算出同一把钥匙，可能跨版本混借。

反过来，部署策略名在指纹里，换一个名字钥匙就会全变。新旧版本应使用各自独立的部署策略名；切换前先核对 Planner 候选、旧登记信息和活跃传输，再安排实例与 Planner 一起切。**绝不能拿清空 Planner 账本来代替「等正在读的实例排空」或「确认底层内存已清理」。** 官方材料的核读与差异见[官网对照页](../sources/rfork-official-guide.md)。

## 哪些已经核过，哪些要到现场

本地能核的有：上游 `main@8d6180e2` 源码与 `v0.30.0@c09d3e20` 差异；知识页引用的文件、行号与图 `pins` 符号是否存在；页面格式和链接是否正确。**这些都证明不了真实 NPU 上已经把权重传完。**

这一轮没有 NPU、CANN、YuanRong 以及 RFork 的 Python 运行依赖，所以不声称跑过设备集成测试。以下几项要在实际部署里核：传输内存的登记与清理约定、MTP/DSpark 共享与归属恢复、Engram 宿主表加载、输出一致性、并发扩容，以及来源实例的推理是否受影响。

清理失败的现场验收还要检查旧权重是否继续受到保护。在 RFork 加载失败后准备回退的路径上，若 seed 服务或登记内存的清理结果仍不允许继续，加载器会抛错，保留使张量存储继续有效的引用，并拒绝在旧权重仍被固定时分配第二个模型。现场需要核对的不只是是否报错，还包括保活引用是否保留、第二个模型的分配是否被阻止。

## 常见误解

- **「RFork 专题仍是独立于社区的外部工作分支」**——当前全章已原子重锚至社区上游 `vllm-project/vllm-ascend` `main`（`8d6180e2`），早期工作分支的七份补丁只作为历史演进归档保留。
- **「补丁能合进去或升级成功就能直接上线」**——还要核行为、Planner 协议兼容、回退安全门和真实设备上的输出一致性。
- **「指纹里有版本号，RFork 一升级钥匙自然就变了」**——那个版本号是模型的，不是 RFork 代码提交号；要隔开新旧版本，得换部署策略名。
- **「早期补丁 7 的说明里没写的行为，就是补丁 1–6 带来的」**——历史分叉下的另外三次提交、衔接差异以及后续社区 PR（`#15935`、`#17366`、`#20111`、`#21333`、`#21707`）都带来了重要演进，不能只按旧补丁编号归因。
- **「当前版本修了某个问题，旧日志里一定也有这段保护」**——旧事故要回到当时实际运行的提交去看，不能拿后来的行为倒推。

## 对照源码

### 怎么开

- 本章全部 RFork 页面已原子重锚至社区上游 `vllm-project/vllm-ascend` 的 `main` 主基线（`vllm-ascend@8d6180e2`，唯一钉点定义在 `wiki/seeds/vllm-ascend.yaml`，`verified: [main]`），不再依赖早期独立的 `rfork` 分支钉点。
- 核验命令：`pnpm wiki:audit` 核实全部上游源码 commit、路径、行号与图 `pins` 符号；`pnpm wiki:lint` 核实格式、锚点、链接与写作标准；`pnpm wiki:diagrams --check` 核实 2D 图与 YAML 规格一致。
- 新旧版本切换使用独立的 `model_deploy_strategy_name` 隔离 seed 池。

### 会报什么错

历史归档记录（2026-09-21）：早期工作分支在 `7ddcfca9`（原 patch1–6 终点）上 `git apply --check` 应用 patch7 复现了不适用，原因是 patch7 与 `7ddcfca9` 在 patch3 之后分叉；当时通过导出两路终点之间的衔接 diff 完成了完整代码树验证。[D] 如今这些改动已演进并合入社区上游 `vllm-ascend`（见下方版本差异）。

### 开销和什么时候别开

- 配置 fingerprint 不包含 RFork 代码 commit，代码升级不能依赖 `seed_key` 必然变化来隔离旧 seed；新旧版本应使用独立 `model_deploy_strategy_name`，并核对 Planner 候选、旧元数据和活动传输后再切换；不能用清空账本替代 reader 排空或 native 清理确认。
- `wiki:audit`、`wiki:lint` 都不证明实际 NPU 已完成权重传输。待现场核验：Ex 注册/清理契约、MTP/DSpark 共享与归属恢复、Engram 宿主表加载、输出一致性、并发扩容与 source 推理影响。

### 版本差异

| 阶段 / 版本 | 上游提交 / PR | 关键演进 |
|---|---|---|
| 早期独立工作分支（历史归档） | 原 patch1–7 + 衔接 diff（已退役独立钉点） | 将 RFork 拆分为独立会话与校验模块，并引入 `compat.py` 适配旧版 v0.26 硬件档案接口 |
| `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | PR `#7392` 初期实现 | 旧 6 文件结构，先借后搭，无异步同步、无 storage 保活、无草稿排除 |
| `v0.30.0` (`c09d3e20`) | PR `#12995`、`#15439`、`#15935` 合入 | 13 文件模块化架构正式落地社区上游：`RForkSession`、`safety.py`（移除 `compat.py`）、结构摘要、先登记后借、双槽端口、`get_rpc_port()`、租约续期 |
| `main` (`8d6180e2`，当前主基线) | PR `#17366`、`#20111`、`#20876`、`#21333`、`#21707` | 14 文件：新增 `local_weights.py`（Engram 宿主表）与 `_RForkLoadCoordinator`；MTP/DSpark checkpoint 归属恢复；BFS 去重与 RoPE 派生缓存排除；13 项配置 + 未知键警告 + 可选 `LEASE_TTL_SEC` + draining 撤回；统一 `finegrained_tp` `size > 1` 并移除已废弃的 Model Runner V1 EPLB 分支 |

完整四版本行为对照集中在[总览](rfork.md#版本差异)。

### 源码位置

以下路径相对社区上游 `vllm-ascend@8d6180e2` 的 `vllm_ascend/model_loader/rfork/`：

- 主加载器、协调器、MTP/DSpark 准备与回退安全门：`rfork_loader.py#L747-L957`。[C1]
- 会话后台归还（快慢重试与 `REJECTED` 停止）、延期发布与双槽端口：`session.py#L289-L478`、`#L588-L659`。[C2][C3]
- 运行期张量排除名单（`topk_indices_buffer`、`_rope_derived_cos_cache`、`_rope_derived_sin_cache`）：`tensor_layout.py#L34-L42`。[C4]
- 统一绕过守卫（替代旧 `compat.py` 与 V1 EPLB 检查）：`safety.py#L9-L21`。[C5]
- Engram 宿主表本地加载与释放：`local_weights.py#L61-L97`。[C7]
- `v0.30.0` 对照：`vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/rfork_loader.py#L600-L710`。[C8]

维护回归时须分别覆盖：后台归还 `RELEASED`（清租约并推进延期发布）、`RETRYABLE`（3 次快试转 ≥60s 慢试）与 `REJECTED`（取消延期发布）；回退前清理 `can_schedule_seed` 为假时保留 owner 并拒绝分配第二个模型；以及升级上游版本时同步复核 `RFork` 全部 10 篇文档与全部 RFork 2D 图的 `pins`。
