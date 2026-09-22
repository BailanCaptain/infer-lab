---
id: rfork-maintenance
title: RFork 版本维护：保留原补丁，钉住真正运行的完整代码
type: feature
summary: 记录工作版与社区版本的边界、patch1–6 和 patch7 的分叉、当前代码存放与核验入口，以及新补丁到来后需要同步的知识页和运行验证。
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
updated: '2026-09-23'
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

## 一句话

**这套 RFork 独立于社区演进，以用户确认的完整代码为事实依据；原补丁是历史材料，补丁应用后的完整源码才说明当前行为。** 后续收到补丁时，代码快照、版本钉点、机制页和排错页要一起核对更新。

本页的版本选择由用户确认；实现结论由 `sources` 所指的源码支持。

## 当前工作版是什么

| 名称 | 固定身份 | 用途 |
|---|---|---|
| 当前完整实现 | `3284850b42f94934dfe6909ed6f1c4c145a7f69c` | 用户确认的基线；seeds 中登记为 rfork 仓库的 main 技术键 |
| patch1–6 原件归档 | `2db39b67174fb430210f9774ddaa60772b3d6780` | 六份补丁的下载/追溯来源 |
| patch7 原件归档 | `7b1a690b359197c9a3462cae2411bfbfe1ec349a` | 第七份补丁的下载/追溯来源 |

当前 pin 唯一定义在 `wiki/seeds/rfork.yaml`；上表是这次基线的历史说明，不是另一个会自动跟随的配置。`rfork:main` 的 verified 只表示已核对这个独立工作版，不表示社区 main 也成立。

**这三行为什么可信，在哪里自己核：** 三个提交号、每份补丁的 SHA256 和快照文件清单登记在项目根 `rfork/manifest.json`（`patches[].sourceCommit` / `patchCommit`）；当时的核对过程与命令输出写在 `rfork/VERSION-NOTE.md`；`pnpm rfork:verify --git` 会重算哈希并用临时 index 重放出完整代码树。本页正文的 `sources` 只钉源码行号，版本身份不在其中，要追溯就去这三处。

## 为什么不能把原七份补丁直接当一条链

原 patch1–6 的实现终点是 `7ddcfca9`；patch7 的父提交是 `09b8eeae`，两条历史在 patch3 之后分叉。patch7 修改的部分测试文件在原 patch6 终点不存在，`tensor_layout.py` 的上下文也不匹配。

2026-09-21 的核对在干净的 `7ddcfca9` 工作树上执行 `git apply --check`，复现了不适用（报错原文见 `rfork/VERSION-NOTE.md`）。随后从两个确切提交导出一份独立的衔接 diff，验证“基线 → 原六份补丁 → 衔接 diff → 原 patch7”重建的整个 Git tree 与当前完整实现一致。[D]

原始补丁没有被悄悄重写，衔接 diff 明确标记为从 Git 历史另行生成的材料，存在 `rfork/reconciliation/`。

## 哪些变化属于原补丁，哪些属于完整历史

| 材料 / 路线 | 关注的变化 | 阅读时的边界 |
|---|---|---|
| 原 patch1 | 布局传输、NPU 同步与回退相关处理 | 不可据此断言已经覆盖后续所有清理问题 |
| 原 patch2 | 注册张量 owner 保留 | 当前实现还保留原始 storage，应看最终 backend |
| 原 patch3 | draft 与 target 重叠注册问题 | 共享判断与全共享路径仍以最终代码为准 |
| 原 patch4–6 | 传输/session 重构、v0.26 API 适配、清理与并发处理 | 此路与 patch7 的父版本不同，不能把旧实现细节平移过来 |
| 两条历史间的衔接差异 | 租约、回退、清理、张量安全及测试等差异 | 单独记录，不冒充用户给的“patch7 内容” |
| patch7 本身 | 可配置 seed HTTP base port；排除本机 `topk_indices_buffer` | 不负责固定 TransferEngine 端口，也不排除所有 scratch |

当前晚申请 lease、有界异步 release、全局编译/MoE 引用清理等行为，要看最终 loader 和 Session；patch7 本身能直接对应的是端口与 topk 采集变化。[C1][C2][C3][C4]

表里「v0.26 API 适配」在当前代码里留下的痕迹之一是 `compat.py`：导入不到 `vllm_ascend.device.hardware_profile` 时，它按是否 310p 现造一个只带 `weight_layout_policy` 的替身对象，让 RFork 在还没有 hardware profile 的那些 Ascend 版本上照样能起；身份指纹和布局判断都从这个入口取值。跨版本读代码时先找这类兼容垫片，别假设两边 API 一样。[C5]

## 代码放在项目里，完整工作树单独维护

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

入库 `source/` 包含许可证和集成入口，但它只是提取的完整 RFork 范围，不是可脱离 vLLM/Ascend 安装运行的 Python 包。开发在完整仓库进行，再从审定的 commit 导出快照，避免两个版本各自被手改。

## 新补丁来了，按影响面更新对应解释

官方材料的核读与差异见[官网对照页](../sources/rfork-official-guide.md)。工作版的配置 fingerprint 不包含 RFork 代码 commit；代码升级不能依赖 key 必然变化来隔离旧 seed。新旧版本应使用独立 `model_deploy_strategy_name`，并核对 Planner 候选、旧元数据和活动传输，再安排实例与 Planner 切换；不能用清空账本替代 reader 排空或 native 清理确认。

| 修改区域 | 至少回看哪些篇 |
|---|---|
| config、端口、网络端点 | 配置、排错、架构图 |
| identity、rank、draft 判断 | 身份、术语、seed miss 排查 |
| collector、layout、quant method | 布局、内存、传输、输出一致性验收 |
| MR register / unregister / finalize | 内存、生命周期、清理失败排查 |
| session、lease、Planner 协议 | 启动、生命周期、配置、400/404 排查 |
| fallback、全局模型引用 | 启动、内存、OOM 排查 |

完整操作规程放在项目根 `rfork/README.md`，包括保存原件、确认基线、先 check 后 apply、导出快照、重算哈希和同步来源。知识页不再抄第二套维护脚本。

## 什么已经核验，什么需要现场环境

`pnpm rfork:verify` 核验本地源码和补丁的字节完整性；加 `--git` 还核对原始 blob 并用临时 index 重建完整代码树。`pnpm wiki:audit` 核引用行号存在，`wiki:lint` 核格式和链接；这些都不证明实际 NPU 已完成权重传输。

本轮不具备 NPU、CANN、YuanRong 与 RFork Python 运行依赖，因此不声称运行了原 RFork 单测或设备集成测试。后续应在实际部署核验 Ex 注册/清理契约、MTP 全共享保护、输出一致性、并发扩容和 source 推理影响。

## 常见误解

- **“社区升级了，RFork 也一起重钉”**——只有用户工作版的更新才改变这个 pin；社区版本继续独立维护。
- **“补丁能 apply 就能上线”**——还要核行为、协议兼容性、回退与真实设备结果。
- **“当前版本修了某问题，旧日志一定也有这段保护”**——旧事故要回到当时的完整源码，不能反向套用后来行为。
