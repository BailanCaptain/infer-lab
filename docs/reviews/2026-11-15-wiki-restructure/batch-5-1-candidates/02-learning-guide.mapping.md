# `learning-guide.md` 旧事实与锚点三出口去向映射表（`editorial`）

- **正式页基线**：[`wiki/concepts/learning-guide.md`](../../../../wiki/concepts/learning-guide.md)（共 172 行）
- **编辑候选稿**：[`02-learning-guide.md`](02-learning-guide.md)（共 182 行）
- **配套 2D 图候选稿**：[`learning-guide-route.yaml`](learning-guide-route.yaml)（共 40 行，`layout: figure`，`size: [610, 760]`）
- **拟用修订类型**：`editorial`（纯结构重排与 2A 阅读路线衔接，同步 `docs/wiki-writing-standard.md:62` 自适应小节说明，零事实删除）

---

## 1. 跨页与外部入链必保 `#锚点` 核对

| 入链来源位置 | 引用的目标锚点 | 原页位置 | 候选稿位置 | 状态 |
|---|---|---|---|---|
| `wiki/concepts/glm-5-3-flash-two-node.md:157` | `learning-guide.md#按顺序读的五页主线` | `L43` (`## 按顺序读的五页主线`) | `L45` (`## 按顺序读的五页主线`) | **100% 保留同名 H2 锚点及 prefill/decode 说明（`L51`、`L60`）** |
| `wiki/sources/glm-5-3-flash-baseline.md:195` | `../concepts/learning-guide.md#版本差异` | `L152` (`### 版本差异`) | `L163` (`### 版本差异`) | **100% 保留同名 H3 锚点及主线钉点与社区四分支对照（`L165-L176`）** |
| `docs/superpowers/plans/2026-10-31-inference-user-field-acceptance.md:97` | `#回到三份参考资料遇到陌生段落去哪查` | `L103` (`## 回到三份参考资料，遇到陌生段落去哪查`) | `L145` (`## 回到三份参考资料，遇到陌生段落去哪查`) | **100% 保留同名 H2 锚点及全部 7 行参考资料映射表与 CP 边界说明（`L147-L159`）** |
| 原页其余全部 H2 / H3 标题 | `#这个知识库讲什么`、`#每个分组展开主线的哪一步`、`#怎么用这个知识库`、`#学会分析推理问题接下来怎样读`、`#从生产现象继续读模型与策略`、`#继续看硬件怎样承接这些计算`、`#对照源码`、`#源码位置` | `L21`、`L63`、`L79`、`L92`、`L119`、`L140`、`L150`、`L167` | `L22`、`L72`、`L93`、`L103`、`L119`、`L134`、`L161`、`L178` | **全部 8 个 H2 与 2 个 H3 标题文本 100% 原样保留** |

---

## 2. 逐段旧事实三出口去向对照表（`wiki/concepts/learning-guide.md` `L1-L172`）

| 原页行号 | 原页事实 / 表格 / 条件内容 | 出口类型 | 候选稿对应行号与处理说明 |
|---|---|---|---|
| `L1-L19` | Frontmatter：`id: learning-guide`、`title`、`type: concept`、`origin: direct`、`aliases`、`chapters: ["00"]`、`order: 1`、3 条 `sources`（GLM `config.json`、DeepInfer `README.md` 与 `inference_deployment_qa.md`）、`relations: []`、`verified: []`、`evidence: I` | 出口 ①（新页保留） | `02-learning-guide.md:1-20`：完整保留全部字段、`relations: []` 与 3 条 `sources`；`summary` 补充 2A 鸟瞰与单卡积木入口。 |
| `L21-L32` | `## 这个知识库讲什么`：核心主旨，以及固定前提三行表（`模型` GLM-5.3-Flash attention/MoE、`部署` vLLM + vllm-ascend 官方双机 + `W8A8` 权重与计算中激活为 8 位整数而非全模型所有数据、`源码` 官方教程镜像基线与 `glm-5-3-flash-baseline.md#镜像固定与源码对应`） | 出口 ①（新页保留） | `02-learning-guide.md:22-35`：完整保留固定前提三行表与全部定义，并在 `L26-L29` 增补“第 1 层教学小算例（`request-overview`、`embedding`、`lm-head`、`sampling` 共用 6 词 4 维算例，`token` 页用独立「推理引擎怎么工作」与字节 BPE 算例）→ 第 2 层双机 16 卡真实主线”的两层衔接说明。 |
| `L33-L41` | `TP`（分矩阵计算，列切+行切成对使用）、`DP`（分请求，每台机器一个执行组）、`EP`（分专家，两台机器共同持有完整专家集合）三条定义；`glm-5-3-flash-two-node.md#每张卡上放了什么` 链接；纸笔复算与 NPU 实测 `待核` 边界 | 出口 ①（新页保留） | `02-learning-guide.md:37-43`：逐项完整保留。 |
| `L43-L61` | `## 按顺序读的五页主线`：五页表（`1 认识 GLM-5.3-Flash`、`2 我们的部署`、`3 一条请求`［含 prefill/decode 与 token/KV cache 括号定义］、`4 多个请求`、`5 代码路径`）、数学/调用栈门槛说明、`inference-performance-walkthrough.md`（含 `#现场怎样拿到这些记录`）链接、`learning-guide-route` 图 | 出口 ①（新页保留） | `02-learning-guide.md:45-70`：先在 `L47-L53` 给出已批准 2A 入门路线（第 0 站 `request-overview.md` → 第 2、3 组单卡基础积木），随后在 `L54-L70` 完整保留原五页双机贯穿主线表（明确标出每页在 2A 目录中的分组位置）、`inference-performance-walkthrough.md` 链接与 `learning-guide-route` 图。 |
| `L63-L78` | `## 学会分析推理问题，接下来怎样读`：5 步性能与生产排查表（`inference-performance-walkthrough.md`、`inference-benchmarking.md`、`inference-performance-analysis.md`、`deepseek-serving-case.md`、`inference-capacity-and-reliability.md`）、`inference-correctness-troubleshooting.md`、`inference-troubleshooting.md` 与 `inference-performance-troubleshooting.md` 分流说明 | 出口 ①（新页保留，调整至全站分组导览之后） | `02-learning-guide.md:103-117`：原样完整保留全部 5 行表格、链接与排障入口说明；按定稿 2A（消除导读第 2 屏高阶专题挤压）调整至 `## 每个分组展开主线的哪一步` 与 `## 怎么用这个知识库` 之后。 |
| `L79-L91` | `## 从生产现象继续读模型与策略`：4 篇模型与策略表（`deepseek-v4-1-flash.md`、`swa-bounded-replay.md`、`dspark.md`、`low-precision-formats.md`）及按现象查阅指路与 `token.md` / `api-server-entry.md` / `streaming-output.md` / `structured-output.md` 分工说明 | 出口 ①（新页保留） | `02-learning-guide.md:119-132`：逐字完整保留全部 4 行表格、按现象指路与 4 篇服务基础页链接。 |
| `L92-L102` | `## 继续看硬件怎样承接这些计算`：`ai-core.md`、`collective-communication.md` 前置指路，昇腾 950 两篇表（`ascend-950-architecture.md`、`ascend-950-execution-interconnect.md`），硬件能力不等于当前框架已用或整条请求改善的证据边界，PR/DT 与 A2 双机数字分工 | 出口 ①（新页保留） | `02-learning-guide.md:134-143`：逐字完整保留。 |
| `L103-L118` | `## 回到三份参考资料，遇到陌生段落去哪查`：7 行参考资料问题映射表（含全部 `#锚点` 链接），以及保留原文模型/硬件/版本/测量条件、DeepInfer README 支持 CP 与线上部署问答暂未采用 CP 的边界说明（及 `context-parallel.md` 链接） | 出口 ①（新页保留） | `02-learning-guide.md:145-159`：逐字完整保留全部 7 行映射表、全部 `#锚点` 与 DeepInfer CP 边界说明。 |
| `L119-L139` | `## 每个分组展开主线的哪一步`：8 个正文分组表 + 其余 3 个分组（`RFork 工作版` `rfork.md`、`参数参考`、`来源与更新记录`）说明 | 出口 ①（新页保留，提至第 2 屏并同步 2A 小节顺序） | `02-learning-guide.md:72-91`：提至 `## 按顺序读的五页主线` 之后；表内同步 2A 目录结构（`开始学习` 含 `request-overview.md`；`模型结构与计算` 含 `low-precision-formats.md`、`mlp-residual-norm.md`、`glm-5-3-flash.md`），并完整保留底部 3 个分组说明。 |
| `L140-L149` | `## 怎么用这个知识库`：术语、对照源码怎么读（5 项）、角标含义（`S/C/M/D/A/I/!`）、接着看与问答侧栏用法 | 出口 ①（新页保留，同步写作规范 `L62` 自适应规则） | `02-learning-guide.md:93-101`：完整保留全部 4 段说明；其中 `L97` 将旧规则“概念页按内容选用，特性页按这五项补齐”同步为现行 `docs/wiki-writing-standard.md:62` 规则（“各页按体裁与实际内容选用或合并这些小节，不机械凑齐固定五项”）。 |
| `L150-L172` | `## 对照源码`（`### 版本差异` + `### 源码位置`）：五页主线镜像基线（`vllm-ascend@db701c1f`、`VLLM_TAG=v0.23.0` / `vllm@0fc695fc`、容器最终安装产物待核 `[!]`、`glm-5-3-flash-baseline.md#镜像固定与源码对应`、`request-call-chain.md`）、四条跟踪分支固定快照表（`v0.23` `2c59ff10`/`0fc695fc`、`v0.26` `2ed6cbba`/`568afb3a`、`v0.30.0rc2` `7d825229`/`ced6857a`、`main` `baa023ad`）、`[S1][S2][S3][I]` 源码位置与 DeepInfer CP 说明 | 出口 ①（新页保留） | `02-learning-guide.md:161-182`：100% 保留全部版本基线、待核边界、四分支快照表与 `[S1][S2][S3][I][!]` 证据说明。 |
