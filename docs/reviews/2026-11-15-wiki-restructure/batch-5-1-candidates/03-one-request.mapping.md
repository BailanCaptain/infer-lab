# `one-request.md` 旧事实与锚点三出口去向映射表（`editorial`）

- **正式页基线**：[`wiki/concepts/one-request.md`](../../../../wiki/concepts/one-request.md)（共 716 行）
- **编辑候选稿**：[`03-one-request.md`](03-one-request.md)（共 728 行）
- **配套 2D 图**：沿用现行 5 张 `wiki/diagrams/one-request-*.yaml`（宽度均为 `880px` 或 `900px` `<= 900px`，零越界）
- **冻结 3D 场景**：`wiki-scene` `token-flow`（含 `#scene-token-flow-1`、`#scene-token-flow-2`、`#scene-token-flow-3` 连续图解导引）只字未改
- **拟用修订类型**：`editorial`（补齐首屏粗体结论句、2A 鸟瞰衔接与双机部署自洽速览，将首屏 `n > 1` 子请求扇出与第 1 站优先路由退化收束至第 1 站末尾条件段，将 `### 版本差异` 粗体补丁整理为四版对照表，零事实删减）

---

## 1. 跨页必保 `#锚点` 与冻结 3D 核对

| 入链来源位置 | 引用的目标锚点 | 原页位置 | 候选稿位置 | 状态 |
|---|---|---|---|---|
| `prefill.md`、`glm-5-3-flash.md`、`layers-and-hidden.md`、`mlp-residual-norm.md`、`graph-mode-layer.md`、`embedding.md`、`lm-head.md` 等 | `#一条请求要走过七站`、`#示例请求-r1-与官方双机部署`、`#第-1-站-入口从-http-到-node0-的引擎`、`#第-2-站-调度4-个-token-的预算和-15-个块号`、`#第-3-站-准备输入一份计划发给-8-个-worker`、`#第-4-站-逐层前向每张卡上的形状通信和字节`、`#前-3-层的稠密-mlp`、`#42-层-moe每卡-18-个专家`、`#moe-通信走-mc2-还是-allgather`、`#一次前向的通信账`、`#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个`、`#第-6-站-结果更新接受几个候选回退几格`、`#第二圈和第三圈decode-步一次验证-1--3-个-token`、`#第-7-站-返回与收尾`、`#对照源码`、`#源码位置` | 全部 12 个 H2 与 17 个 H3 标题 | `03-one-request.md` 对应同名 H2 / H3（`headersRemoved: []`） | **全部 29 个 H2/H3 标题文本 100% 原样保留** |
| 冻结 3D `wiki-scene` | `token-flow` 及 `#scene-token-flow-1`、`#scene-token-flow-2`、`#scene-token-flow-3` | `## 第 3 站 准备输入` 末尾围栏及第 4/6/7 站对应行内链接 | 同章节同名位置（参考 `343-one-request-review.json` 精确定位） | **100% 逐字保留围栏与全部绑定文案** |

---

## 2. 逐段旧事实三出口去向对照表（`wiki/concepts/one-request.md` `L1-L716`）

| 原页行号 | 原页事实 / 算例 / 表格 / 条件内容 | 出口类型 | 候选稿对应行号与处理说明 |
|---|---|---|---|
| `L1-L133` | Frontmatter：`id: one-request`、`title`、`type: concept`、`origin: gap`、`summary`、`aliases`（17 项）、`chapters: ["00"]`、`order: 10`、60 条 `sources`、7 条 `relations`、`verified: []`、`evidence: C`、2 条 `rawSources` | 出口 ①（新页保留） | `03-one-request.md:1-133`：60 条 `sources` 原序、7 条 `relations` 与 2 条 `rawSources` 100% 原样保留。 |
| `L135-L169` | `## 一条请求要走过七站`：4 个 token 演示说明、模型与推理引擎分工、`L141` `n > 1` 外部调用与引擎子请求区分、prefill/decode 定义、KV cache / KV block / 稀疏 MLA / KDA / MTP 简介、七站编号列表、一步（step）循环与 `one-request-system` 图 | 出口 ①（新页保留，原 `L141` 收束至第 1 站末尾） | `03-one-request.md:135-169`：新增首段粗体七站导航句（不把有条件的 218 次通信写进首屏通则，218 留在原通信账节）并自然衔接 `request-overview.md`；将原 `L141`（一次外部调用要求多个生成结果时逐个生成引擎子请求）移至第 1 站入口末尾 `L197`，使首屏七站主线一气呵成。 |
| `L170-L176` | `## 示例请求 R1 与官方双机部署`：`p₀..p₃`、GLM 聊天模板 6 个标记（5 个 special + `<think>` added token、裸正文 4 个套模板 16 个）、`3121f187` 与旧 `9e55cbc8` 量化配方、共同教学条件（关闭 SP 与共享专家复制、TP8 共享专家、完整词表采样、不开扩大 MC2 容量的 prefill 开关） | 出口 ①（新页保留，增补 4 条双机部署自洽速览） | `03-one-request.md:170-180`：完整保留全部原条件，并补入双机 16 卡（DP2×TP8、EP16 每卡 18 专家，显存容量假设回链部署页）、45+1 层结构、单步 8192 预算与统一块号存储额度（每卡 `8,355,840 B`、`full` 组历史页覆盖 `640` 个位置，其他状态组见第 2 站），消除原 `L174` 悬空依赖。 |
| `L178-L191` | `## 第 1 站 入口：从 HTTP 到 node0 的引擎`：4 步流程（`POST /v1/chat/completions` 套模板分词、`AsyncLLM` 包装 `EngineCoreRequest` 与输出收集器、按 `等待数 × 4 + 运行数` 选 DP0 并本地等待数 +1、ZMQ 入等待队列）及 `L188` 优先路由前提与 `reqs_in_flight` 记录 | 出口 ①（新页保留，4 步列表连贯 + 末尾条件段） | `03-one-request.md:185-203`：4 步主线列表不再被中间缩进段打断；原 `L188` 优先路由条件与原 `L141` 子请求边界完整保留在 `L200-L203`（`入口路由与子请求的成立前提`）。 |
| `L193-L270` | `## 第 2 站 调度`（8192 预算、4+3=7 个位置、5 个缓存组 `1 + 12 + 2 = 15` 块号 ≈ 119.5 MiB、`one-request-blocks` 图、混合模型默认关闭前缀缓存）与 `## 第 3 站 准备输入`（持久批次、位置、三套 slot、640=5×128、首步输入 `calc`、node1 dummy batch 陪跑与 eager/graph 对齐、冻结 3D `token-flow`） | 出口 ①（新页保留） | `03-one-request.md:205-275`：100% 逐字保留，含 `L271-L275` 冻结 3D `wiki-scene` `token-flow`。 |
| `L271-L466` | `## 第 4 站 逐层前向`：45 层三类分布表、词嵌入（151.25 MiB、All-Reduce 32,768 B）与 mHC 四路残差、前 3 层稠密 MLP（54.0 MiB）、34 层 KDA（卷积状态 36,864 B + FP32 递推状态 524,288 B）、11 层稀疏 MLA（`[4, 2051]` 清单、7 步形状表、409.75 MiB）、42 层 MoE（每卡 18 专家 432 MiB/层、17.72 GiB、MC2 128 门槛、dispatch 32,800 B / combine 65,536 B）、最终归一化与 `lm_head`、`one-request-forward` 图与 218 次通信账单、51 KiB 块利用率 0.6% | 出口 ①（新页保留） | `03-one-request.md:277-472`：100% 逐字保留全部算式、表格、形状、字节数与 `#scene-token-flow-1` 引用。 |
| `L467-L645` | `## 第 5 站 采样与 MTP 草拟`（左移一格 4 行配对表、三遍草拟、540.75 MiB、强制 eager）、`## 第 6 站 结果更新`（`3 - k` 回退、`#scene-token-flow-2`）、`## 第二圈和第三圈`（decode 1/2 算例、4-token 图回放、拒绝采样、三步账表、`one-request-token-steps` 图、跨轮与本轮状态表）、`## 第 7 站 返回与收尾`（`one-request-finish-flow` 图、`#scene-token-flow-3`、`max_tokens=200` 截断、16–17 块号归还、32 步停机、`finish_reason_sent` 边界）、`## 这个例子看不见什么`（6 项）、`## 常见误解`（7 项） | 出口 ①（新页保留） | `03-one-request.md:474-651`：100% 保留全部算式、表格与边界；仅将原 `L609` `finish_reason_sent` 结束标记边界收束至第 7 站末尾 `L624`，使 `#scene-token-flow-3` 与归还块号叙事连贯。 |
| `L646-L716` | `## 对照源码`：`### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`、`### 版本差异`（`0fc695fc`/`db701c1f`、`2ed6cbba`、`7d825229` 多 KV 组 MTP proposer 支持草稿图、`baa023ad` `fused_eh_norm` 与草稿强制 eager）、`### 源码位置`（全部 25 处角标与补充来源 45–60、`ParentRequest` / `reqs_in_flight` / `finish_reason_sent` 说明） | 出口 ①（新页保留，四版差异表结构化） | `03-one-request.md:652-728`：将 `### 版本差异` 整理为四版对照表 + 四条分支补充说明，100% 保留全部版本条件、25 处内联角标（`19 C + 2 S + 3 D + 1 I = 25 <= 30`，`C` 占比 `76% < 80%`）与全部 60 条 `sources` 索引。 |
