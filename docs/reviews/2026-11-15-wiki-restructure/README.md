# 首批四类知识库样板页：旧事实清单与教学改进定位总览（包 3 前置准备）

本目录存放任务 `0001794686458844-000042-d05c4c4b`（交付四类首批知识库文章与必要 2D 图文）的前置事实核对与教学改进定位清单。按照已批准的[渐进改造方案](../../plans/2026-11-14-progressive-restructure-and-fix-plan.md#L411-L428)：

- **正式页面暂不手改（同步 `message:0001794728783970-000248-6205f5a2` 补充授权）**：`wiki/` 下的 4 篇正式 Markdown 当前保持原状，待包 1 门禁收口与包 2 写管线（`editorial` / `supersede.claims` 三出口核验、`scan.py` `__init__` 构造参数识别与确定性生成区刷新、KaTeX、静态 `raw:`）就绪后，严格走**「不可变 `raw`/钉住源码证据 → 真实写管线（`runDropBatch` / `prepareDraftReview` / `compileRaw`）生成与整合提案 → `Review` 整组审阅批准 → 静态阅读 → 问答引用与回流核验」**真实闭环发布，绝不用手工改写或直接复制候选稿替代管线验收。依大当家 `000248` 最新授权：**取消手机阅读验收**（桌面端正常实测即可）；**2D 图可以改动**，3D 图/场景/模型与硬件探索模块仍冻结；三猫检视与实测通过后，本次改造新建 `Review` 由 `@砚砚` 依 `000248` 授权整组批准并持续推进 `044` 全库 A/B/C 改造，不等人类阶段验收（严格保留产品本身的 `Review` 整组审阅机制与 `checkBase` 防覆盖行为，不将本次授权改写成普遍无人审阅，且既有历史待审包原样保留、严禁顺手全批准）。
- **本轮清单未提出需 `supersede.claims` 的正文纠错（不人为捏造正文旧错）**：本轮逐行梳理未提出需 `supersede.claims` 的正文纠错（样板 3 的 `v0.26` `2ed6cbba` 矛盾出自受保护自动生成区 `L175` 漏扫 `__init__` 参数，须先经包 2 确定性同步入口刷新生成区后再提正文 `editorial`），故当前按 **`editorial`** 规划正文重排并保留既有原子事实与版本/硬件限定条件（仅剔除样板 1 中 3 处“给定材料中的/材料中的文档/材料还提到”内部提示词残留）。**若后续独立检视或源码核对发现新反证，则按实改判并启用 `supersede.claims` 有证更正，不以保真要求固化未核实旧错。**

## 四篇样板页清单、编辑候选稿与保护边界

> **编辑候选包（`candidates/`）已全量落盘**：详见 [candidates/README.md](candidates/README.md)。候选稿为作者（`@墨墨`）基于正式页、不可变 `raw` 与钉住源码提交编制的**编辑候选稿**，**不作为新一手源码或实测证据**，亦**不替代 `041` 通过后的真实写管线与整组审阅闭环**。

| 样板文件 | 体裁代表 | 事实清单与候选稿/映射表 | 拟用修订类型 | 冻结 3D 围栏与受保护主干 |
|---|---|---|---|---|
| [`wiki/concepts/chunked-prefill.md`](../../../wiki/concepts/chunked-prefill.md) | 调度与控制流 | 清单：[01-chunked-prefill-facts-and-pedagogy.md](01-chunked-prefill-facts-and-pedagogy.md)<br>候选稿：[candidates/01-chunked-prefill.md](candidates/01-chunked-prefill.md)<br>映射表：[candidates/01-chunked-prefill.mapping.md](candidates/01-chunked-prefill.mapping.md) | `editorial` | 原样保护 `L194-L196` `wiki-scene`（`inference-mechanism:7`）、强绑定的 `L109-L120`/`L171-L177` `A/B + C(14→6,6,2)` 时间轴算例及 `chunked-prefill` / `chunked-prefill-flow` 两张 2D 图 |
| [`wiki/concepts/quantization.md`](../../../wiki/concepts/quantization.md) | 算子与数值计算 | 清单：[02-quantization-facts-and-pedagogy.md](02-quantization-facts-and-pedagogy.md)<br>候选稿：[candidates/02-quantization.md](candidates/02-quantization.md)<br>映射表：[candidates/02-quantization.mapping.md](candidates/02-quantization.mapping.md) | `editorial` | 原样保护前 342 行成熟主干、`L228-L230` `wiki-scene`（`inference-mechanism:5`）、强绑定的 `L206-L220` `[0.523, -0.31, 1.27]` 三元素算例、4 张 2D 图及 `verified` 列表 |
| [`wiki/params/enable-super-kernel-ce990e186bfa.md`](../../../wiki/params/enable-super-kernel-ce990e186bfa.md) | 配置参数与版本谱系 | 清单：[03-enable-super-kernel-facts-and-pedagogy.md](03-enable-super-kernel-facts-and-pedagogy.md)<br>候选稿：[candidates/03-enable-super-kernel-ce990e186bfa.md](candidates/03-enable-super-kernel-ce990e186bfa.md)<br>映射表：[candidates/03-enable-super-kernel-ce990e186bfa.mapping.md](candidates/03-enable-super-kernel-ce990e186bfa.mapping.md) | 先由包 2 刷新自动生成区 → 再提正文 `editorial` | 保持稳定主键 `id` 与生成区保护（`review.ts:459-464`）；工作区已由包 2 刷新 `L175`（`releases/v0.26.0rc` `无` → `有`）与 `L196-L224` 去重 validator（待 `041` 代码核验通过），随后以新 `base` 消除 `L110` 首句劫持与 `L149` 裸“来源19” |
| [`wiki/concepts/inference-troubleshooting.md`](../../../wiki/concepts/inference-troubleshooting.md) | 性能诊断与排障 | 清单：[04-inference-troubleshooting-facts-and-pedagogy.md](04-inference-troubleshooting-facts-and-pedagogy.md)<br>候选稿：[candidates/04-inference-troubleshooting.md](candidates/04-inference-troubleshooting.md)<br>映射表：[candidates/04-inference-troubleshooting.mapping.md](candidates/04-inference-troubleshooting.mapping.md) | `editorial` | 原样保护 `L61-L102` 请求 `R` 超时排查演示与两张 2D 图，升级 `L105-L182` 十类故障为三步可扫读结构，补齐 `L219` 缩写定义，保持 `verified: []` 真实状态 |

## 包 3 正式改写时的写作标准护栏（合入 `039` 教学与 2D 检视反馈）

1. **`chunked-prefill.md`（单小节 `calc` 数量与非相邻护栏）**：原 `L125` 与 `L148` 各含 1 个 `calc` 块；按 `docs/wiki-writing-standard.md` 与 `scripts/wiki/standard.ts` 规则（每个承载内容的小节最多 1 个 `calc`，且表格与 `calc` 不相邻），在整合「收益与代价」时保留两个独立小节标题（H2 或 H3）分别承载各自的 `calc`，且在 GLM `20,000` token 步序小表与借块 `calc` 之间保留解释性正文段落，避免触发 `stacked-blocks`。
2. **`quantization.md`（KaTeX 函数名正体、ASCII 负号与按语义恢复反引号护栏）**：将 `L167`、`L173`、`L200` 升级为 `$...$` 行内数学公式时，使用 `\text{clamp}`、`\text{round}` 与标准 ASCII 减号 `-`（替换原文中的 Unicode `−` U+2212），例如 `$q = \text{clamp}(\text{round}(x / s), -128, 127)$` 与 `$\hat{y} = s_x \times s_w \times \sum_i q_{x,i} q_{w,i}$`；同时对参数、变量、函数与代码标识按语义恢复反引号，普通技术名词避免无意义代码底色（注：旧 `maxInlineCodePerK: 13` 密度门禁由包 2 废止，无需再借 `## 对照源码` 位置规避旧配额）。
3. **`inference-troubleshooting.md`（按语义恢复退出码反引号与避免普通技术名词无意义代码底色）**：在十个 H3 分支中对 `137` 等关键退出码/状态码、参数与命令标识按语义恢复反引号，普通技术名词保持正体、避免无意义代码底色（旧 `maxInlineCodePerK: 13` 密度门禁由包 2 废止）。


## 包 5（`044`）存量 163 篇正式页 A/B/C 分级只读预盘点台账与 `Batch 5.1` 准备台账

- **全量预分级台账**：[044-abc-inventory.md](044-abc-inventory.md)（基于 `%TEMP%/infra-wiki-review-20261115/044-current-inventory.json` 编制，已通过 `000280` 独立审计脚本 `044-inventory-audit.mjs` `exit 0`：`A` 档 123 篇、`B` 档 26 篇［`8/2/16`］、`C` 档 14 篇［`C0:4 / C1:7 / C2:3`，其中 `C0` 仅作 `Batch 0` 批次编号，`quantization.md` 严格保护前 342 行成熟主干］，六批存量 `4+12+7+17+39+84=163`，明确写入 `000278` 两条方法边界，附 19 篇 23 处 `wiki-scene` 冻结核对清单）。
- **`Batch 5.1` 只读现状取证与章节目标准备台账**：[044-batch-5-1-prep.md](044-batch-5-1-prep.md)（对齐 `src/content/wiki/toc.ts` 11 个 `PARTS` 真实行号、定稿 2A「鸟瞰 → 基础积木 → 进阶双机」路线、包 4 `legacyIds` 契约、`request-overview.md` 四步闭环大纲，以及 `Batch 5.1` 12 篇存量页的行号、跨页必保 `#锚点` 与冻结 `wiki-scene` 保护边界）。
- **`Batch 5.1` 候选稿（`batch-5-1-candidates/`）**：
  - 新增 `2A` 纯算术鸟瞰页与配套 2D 图：[batch-5-1-candidates/01-request-overview.md](batch-5-1-candidates/01-request-overview.md) 与 [batch-5-1-candidates/request-overview-four-steps.yaml](batch-5-1-candidates/request-overview-four-steps.yaml)
  - 入口导读页 `learning-guide.md`、配套路线图与三出口映射表：[batch-5-1-candidates/02-learning-guide.md](batch-5-1-candidates/02-learning-guide.md)、[batch-5-1-candidates/learning-guide-route.yaml](batch-5-1-candidates/learning-guide-route.yaml) 与 [batch-5-1-candidates/02-learning-guide.mapping.md](batch-5-1-candidates/02-learning-guide.mapping.md)（供 `042` 收口前开展事实与教学/2D 图预检，不直接写正式 `wiki/` 或充当新一手 `raw` 来源）。
