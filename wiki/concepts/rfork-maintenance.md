---
id: rfork-maintenance
title: RFork 版本维护：保留原补丁，钉住真正运行的完整代码
type: feature
summary: >-
  同事又发来一份 RFork 补丁时，怎么弄清现在跑的是哪版代码。这页讲：工作版为什么和社区版本分开维护，原来七份补丁为什么不能直接当一条链往上叠，
  代码在项目里存在哪、怎么核对没被改动，新补丁来了要回看哪几页，以及哪些事只有到真机现场才能确认。
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
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L563-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L150-L225'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L363-L386'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L18-L25'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/compat.py#L1-L23'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 本章全部机制都属于这套独立工作版，更新补丁时要保持整章与代码一起演进
  - to: rfork-troubleshooting
    kind: builds-on
    note: 排错前先识别实际运行版本，旧报错不能直接套用后来补丁的行为
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-53eef0148da8e153b65a9775a7950f4593f691b77b1f6a98c26dfa63bf9cdb3d.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## 同事又发来一份补丁，现在跑的到底是哪版代码

假设同事发来第八份 RFork 补丁，让你「在现在的版本上打上去」。第一个问题就是：「现在的版本」指的是哪一份代码？是社区最新版？是前面七份补丁依次叠上去的结果？还是别的什么？

这套 RFork 是用户的工作版，**独立于社区演进**。判断当前行为只认一样东西：**用户确认过的、补丁全部应用之后的完整源码**。原来那几份补丁文件是历史材料，用来追溯「谁在什么时候改了什么」，不能拿来直接说明现在的代码怎么跑。

具体来说，有三样东西各自钉在一个固定的提交上：

- **当前完整实现**：用户确认的基线，本章所有机制页都按它来讲；
- **前六份补丁的原件**：用来下载和追溯；
- **第七份补丁的原件**：同样用来下载和追溯。

当前钉的是哪一个提交，全项目只在一处定义；本页记的是这次基线的历史说明，不是会自动跟着变的第二份配置。本章各页标的「已核」只表示核对过这个工作版，**不代表社区的同名分支也成立**。

所以收到新补丁时，代码快照、版本钉点、机制页和排错页要一起核对、一起更新。

## 七份补丁不是一条链

直觉上，前六份补丁依次打完，再打第七份，就该得到当前代码。实际不是这样。

前六份补丁一路改下来的终点，和第七份补丁当初所基于的那个版本，**在第三份之后就分成了两条历史**。于是第七份补丁改到的一部分测试文件，在前六份的终点上根本不存在；一个管张量布局的文件，前后文也对不上。

2026-09-21 做过一次核对：在前六份终点的干净工作区上先「试打」第七份补丁，确实打不上去。随后从两条历史上的两个确切提交之间，单独导出一份**衔接差异**，并验证了「基线 → 原六份补丁 → 衔接差异 → 原第七份补丁」这样一步步重建出来的整棵代码树，和当前完整实现一模一样。

原始补丁没有被悄悄改写；衔接差异单独存放，并明确标成「从版本历史另外生成的材料」，不冒充用户给的补丁内容。

## 每份补丁管什么，读的时候边界在哪

| 材料 / 路线 | 关注的变化 | 阅读时的边界 |
|---|---|---|
| 第一份补丁 | 布局传输、NPU 同步与回退相关处理 | 不能据此断言已经覆盖后面所有清理问题 |
| 第二份补丁 | 保留登记过的张量的所有者 | 当前实现还额外保留了原始存储，应看最终代码 |
| 第三份补丁 | 投机解码的 draft 模型和主模型重复登记的问题 | 什么时候算共享、全部共享时怎么走，仍以最终代码为准 |
| 第四到第六份补丁 | 传输与会话层重构、v0.26 接口适配、清理与并发处理 | 这条路和第七份补丁基于的版本不同，不能把旧的实现细节平移过来 |
| 两条历史之间的衔接差异 | 租约、回退、清理、张量安全和测试等方面的差异 | 单独记录，不算进「第七份补丁的内容」 |
| 第七份补丁本身 | 来源服务的 HTTP 起始端口可以配置；采集时排除本机的 top-k 下标缓冲区 | 不负责固定传输引擎的端口，也不排除所有临时缓冲区 |

当前代码里那些行为——晚一点才去申请租约、有次数上限的后台归还租约、全局编译与 MoE 引用的清理——都要看最终的加载器和会话代码；第七份补丁本身能直接对上的，只有端口和 top-k 采集这两处变化。

表里「v0.26 接口适配」在当前代码里留下的一个痕迹，是一个**兼容垫片**：在还没有「硬件档案」这个接口的 Ascend 版本上，它按是不是 310P 现造一个只带权重布局策略的替身对象，让 RFork 照样能起来；身份指纹和布局判断都从这个入口取值。跨版本读代码时，先找这类垫片，别假设两边接口一样。

## 代码放在哪：一份快照用来读，一份完整仓库用来改

项目里存了两份代码，用途不同：

- **项目里的快照**：从审定过的提交导出的 RFork 那部分代码，连同随版本保存的测试、示例 Planner、原版自带文档、七份原始补丁、衔接差异，以及一份登记了来源和哈希的清单。它带着许可证和集成入口，但只是抽出来的范围，**离开 vLLM / Ascend 的安装环境跑不起来**。
- **完整的独立仓库**：用来打新补丁、构建、按行号审计。换机器要重新建。

开发只在完整仓库里做，再从审定的提交导出快照——这样不会出现两份代码各自被手改、慢慢对不上的情况。

读快照时几条边界：看到有测试，不等于这一轮跑过；示例 Planner 只证明示例协议，代替不了现场的生产 Planner；原版文档和代码冲突时要明说，以实际运行的那条路径为准。

## 新补丁来了，按改到的地方回看对应的页

有一件事容易踩坑：工作版的配置指纹**不包含 RFork 代码本身的版本**。也就是说，代码升级了，来源实例的键不一定跟着变，不能指望靠键变化把旧来源自动隔开。

新旧版本应当用各自独立的部署策略名；切换前要核对 Planner 给的候选、旧的登记信息和还在进行的传输，再安排实例和 Planner 一起切。**不能用清空 Planner 账本来代替「等正在读的实例读完」或「确认底层内存已清理」。** 官方材料的核读与差异见[官网对照页](../sources/rfork-official-guide.md)。

按补丁改到的区域，至少回看这些页：

| 改到的区域 | 至少回看哪些页 |
|---|---|
| 配置、端口、网络端点 | [配置](rfork-config.md)、[排错](rfork-troubleshooting.md)、[总览里的架构图](rfork.md) |
| 身份、rank、draft 判断 | [身份](rfork-identity.md)、[术语](rfork-terms.md)、[排错](rfork-troubleshooting.md)里找不到来源的那部分 |
| 权重采集、布局、量化方法 | [布局](rfork-layout.md)、[内存](rfork-memory.md)、[传输](rfork-transfer.md)、输出一致性验收 |
| 传输内存的登记、注销、收尾 | [内存](rfork-memory.md)、[生命周期](rfork-lifecycle.md)、[排错](rfork-troubleshooting.md)里清理失败的那部分 |
| 会话、租约、Planner 协议 | [启动](rfork-startup.md)、[生命周期](rfork-lifecycle.md)、[配置](rfork-config.md)、[排错](rfork-troubleshooting.md)里 400/404 的那部分 |
| 回退、全局模型引用 | [启动](rfork-startup.md)、[内存](rfork-memory.md)、[排错](rfork-troubleshooting.md)里 OOM 的那部分 |

完整的操作规程只写在一处（位置见下半），包括保存原件、确认基线、先试打再正式打、导出快照、重算哈希和同步来源。知识页不再抄第二套维护步骤。

## 哪些已经核过，哪些要到现场

本地能核的有：快照和补丁的字节有没有变；原件能不能重放出完整代码树；知识页引用的行号是否存在；页面格式和链接是否正确。**这些都证明不了真实 NPU 上已经把权重传完。**

这一轮没有 NPU、CANN、YuanRong 以及 RFork 的 Python 运行依赖，所以不声称跑过原版 RFork 单测或设备集成测试。以下几项要在实际部署里核：传输内存的登记与清理约定、MTP 全部共享时的保护、输出一致性、并发扩容，以及来源实例的推理是否受影响。

## 常见误解

- **「社区升级了，RFork 也一起重钉」**——只有用户工作版的更新才会改这个钉点；社区版本继续各走各的。
- **「补丁能打上去就能上线」**——还要核行为、协议兼容、回退和真实设备上的结果。
- **「当前版本修了某个问题，旧日志里一定也有这段保护」**——旧事故要回到当时的完整源码去看，不能拿后来的行为倒推。

## 对照源码

### 怎么开

- 当前钉点唯一定义在 `wiki/seeds/rfork.yaml`，登记为 rfork 仓库的 main 技术键；`rfork:main` 的 verified 只指这个工作版。
- 完整维护规程在项目根 `rfork/README.md`（保存原件、确认基线、先 `git apply --check` 再 apply、导出快照、重算哈希、同步来源）。
- 核验命令：`pnpm rfork:verify` 核本地源码和补丁的字节完整性；加 `--git` 还核原始 blob，并用临时 index 重放出完整代码树。`pnpm wiki:audit` 核引用行号存在，`pnpm wiki:lint` 核格式和链接。
- 新旧版本切换用独立的 `model_deploy_strategy_name`。

### 会报什么错

2026-09-21 在干净的 `7ddcfca9`（原 patch1–6 终点）工作树上执行 `git apply --check` 应用 patch7，复现了不适用；报错原文见 `rfork/VERSION-NOTE.md`。原因：patch7 的父提交是 `09b8eeae`，与 `7ddcfca9` 在 patch3 之后分叉；patch7 修改的部分测试文件在 `7ddcfca9` 不存在，`tensor_layout.py` 的上下文也不匹配。随后从两个确切提交导出衔接 diff，验证「基线 → 原六份补丁 → 衔接 diff → 原 patch7」重建的整个 Git tree 与 `3284850b` 一致。[D]

### 开销和什么时候别开

- 配置 fingerprint 不包含 RFork 代码 commit，代码升级不能依赖 seed key 必然变化来隔离旧 seed；新旧版本应使用独立 `model_deploy_strategy_name`，并核对 Planner 候选、旧元数据和活动传输后再切换；不能用清空账本替代 reader 排空或 native 清理确认。
- `rfork:verify`、`wiki:audit`、`wiki:lint` 都不证明实际 NPU 已完成权重传输。本轮未运行原 RFork 单测或设备集成测试；待现场核验：Ex 注册/清理契约、MTP 全共享保护、输出一致性、并发扩容、source 推理影响。

### 版本差异

三个固定身份（提交号、每份补丁的 SHA256 与快照文件清单登记在 `rfork/manifest.json` 的 `patches[].sourceCommit` / `patchCommit`；核对过程与命令输出在 `rfork/VERSION-NOTE.md`；本页 `sources` 只钉源码行号，版本身份不在其中）：

| 名称 | 固定身份 | 用途 |
|---|---|---|
| 当前完整实现 | `3284850b42f94934dfe6909ed6f1c4c145a7f69c` | 用户确认的基线；seeds 中登记为 rfork 仓库的 main 技术键 |
| patch1–6 原件归档 | `2db39b67174fb430210f9774ddaa60772b3d6780` | 六份补丁的下载/追溯来源 |
| patch7 原件归档 | `7b1a690b359197c9a3462cae2411bfbfe1ec349a` | 第七份补丁的下载/追溯来源 |

上半补丁表的原叫法对照：patch2 是注册张量 owner 保留，当前实现另保留原始 storage，应看最终 backend；patch3 是 draft 与 target 重叠注册；patch7 是可配置 seed HTTP base port 与排除本机 `topk_indices_buffer`，不负责固定 TransferEngine 端口，也不排除所有 scratch。晚申请 lease、有界异步 release、全局编译/MoE 引用清理要看最终 loader 与 Session；patch7 能直接对应的只有端口与 topk 采集变化。[C1][C2][C3][C4]

v0.26 API 适配的痕迹：`compat.py` 在导入不到 `vllm_ascend.device.hardware_profile` 时，按是否 310p 现造一个只带 `weight_layout_policy` 的替身对象；身份指纹和布局判断都从这个入口取值。[C5]

### 源码位置

- 最终 loader：`rfork_loader.py`
- Session（lease 申请、异步释放）：`session.py`
- 张量布局：`tensor_layout.py`
- 兼容垫片：`compat.py`

项目内存放位置：

| 项目相对路径 | 存什么 | 给 Agent 的使用方法 |
|---|---|---|
| `rfork/source/vllm_ascend/model_loader/rfork/` | 当前 RFork 实现 | 根据页面来源的文件与函数精确读取 |
| `rfork/source/tests/ut/model_loader/rfork/` | 随版本保存的测试 | 查原实现期望；看到测试存在不等于本轮运行过 |
| `rfork/source/examples/rfork/rfork_planner.py` | Python 示例 Planner | 只证明示例协议，不能替代现场生产 Planner |
| `rfork/source/docs/` | 原版本自带文档 | 对照理解；与代码冲突时明确说明，以运行路径为准 |
| `rfork/patches/` | 用户提供的七份原始补丁 | 后续补丁也保留原件与哈希 |
| `rfork/reconciliation/` | 明确标识的历史衔接差异 | 解释为什么原七份不是直接连续的一条链 |
| `rfork/manifest.json` | 原件来源、SHA256、快照文件清单 | 核对是否缺文件或发生未登记变动 |
| `tools/repos/rfork/` | 完整、独立的 Git 仓库 | 用于应用新补丁、构建与 Git 行号审计；换机器需重建 |
