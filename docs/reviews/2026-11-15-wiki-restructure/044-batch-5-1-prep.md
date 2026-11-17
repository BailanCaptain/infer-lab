# `044` `Batch 5.1` 只读现状取证与章节目标准备台账

- **对应任务**：`0001794686458927-000044-ba930962`（状态保持 `todo`；当前仅做只读现状取证与章节目标准备，**不提前改动任何正式 `wiki/` 页面或 `src/content/wiki/toc.ts`**）
- **基线依据**：
  - 唯一真相源方案：[2026-11-14-progressive-restructure-and-fix-plan.md](file:///C:/Users/-/Desktop/infra-view-new/docs/plans/2026-11-14-progressive-restructure-and-fix-plan.md)（包 2A、包 5 `Batch 5.1`）
  - 全量 163 页预分级台账：[044-abc-inventory.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/044-abc-inventory.md)（已通过 `000280` 独立审计脚本 `044-inventory-audit.mjs` `exit 0`）
  - 总体评审指令：`000278`、`000280`、`000284`（严格遵守两条方法边界：预分级不等于已完成逐页事实/教学验收；脚本不判断版本/默认值/条件语义，必要自然语言条件留在主文，旧事实逐条对齐三出口，冻结 3D `wiki-scene` 与绑定算例零改动）

---

## 1. `src/content/wiki/toc.ts` 2A 路线编排现状与目标对照

### 1.1 现行 `toc.ts`（共 11 个 `PARTS`，`L39-L51`）关键错位坐标（只读核查）

| 坐标 | 现行编排（对照 `toc.ts` 原文） | 认知/结构问题 | 2A 目标调整方案 |
| --- | --- | --- | --- |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L55-L58) | 第 1 组 `guide`：`阅读路线: ["learning-guide"]`、`模型与请求概览: ["glm-5-3-flash", "one-request", "concurrent-requests"]` | 读者尚未建立 `token`、`embedding`、矩阵乘与层结构概念，第 2–4 页即撞上 `GLM-5.3-Flash`（KDA/MLA/mHC/MoE/MTP）与双机 DP2/TP8/EP16 七站账本；且 `one-request.md:174` 引用相隔 86 页的 `glm-5-3-flash-two-node.md` | 按定稿 2A（`§0.2`、`L454`）走「**鸟瞰 → 基础积木 → 进阶双机**」：`guide` 仅放 `阅读路线: ["learning-guide"]` 与 `一次请求全景鸟瞰: ["request-overview"]`；将 `glm-5-3-flash` 后移至第 2 组 `models` 的 `Attention 与位置编码`（`L68-L76`）之后（作为第 2 组收尾的 `模型总装: ["glm-5-3-flash"]`），将 `one-request`、`concurrent-requests`（完整保留原 `id` 与全部跨页 `#锚点`）后移至基础积木与双机部署（`toc.ts:161` `glm-5-3-flash-two-node`）之后 |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L61) + [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L216-L221) + [low-precision-formats.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/low-precision-formats.md#L48-L50) | `models` → `数值表示与量化` 在 `CURATED`（`L61`）仅列 `["quantization"]`，而 `low-precision-formats.md` 因显式 `toc: { part: "models", section: "数值表示与量化" }` 被 `buildToc`（`L216-L221`）尾插在 `quantization` 之后；`L63-L65` `Decoder 层、MoE 与 lm_head` 为 `["layers-and-hidden", "mlp-residual-norm", "moe", "lm-head"]` | ① 先讲量化 `quantization` 再讲基础低精度格式 `low-precision-formats` 前后颠倒；② `layers-and-hidden`（教学正文 `L125-L285` 共 161 行中，`L174-L255` 连续 82 行讲 GLM 四条流 `mHC` 与 20 轮 Sinkhorn）排在基础残差/归一化 `mlp-residual-norm` 之前 | ① `数值表示与量化`（`toc.ts:61`）显式列为 `["low-precision-formats", "quantization"]`；② `Decoder 层、MoE 与 lm_head`（`toc.ts:63-L65`）改为 `["mlp-residual-norm", "layers-and-hidden", "moe", "lm-head"]`（保留实际页面 ID `lm-head`） |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L67-L77) | `models` → `Attention 与位置编码`：`["attention-qkv", "rope", "gqa", "linear-attention", "sparse-attention", "mla", "attention-cost"]`（共 7 篇） | `sparse-attention`（`L73`）排在 `mla`（`L74`）之前，而 GLM 稀疏注意力建立在 MLA 低秩压缩之上 | ① 完整保留全部 7 篇（含 `gqa` 与 `attention-cost`），修正依赖顺序为：`["attention-qkv", "rope", "gqa", "mla", "sparse-attention", "linear-attention", "attention-cost"]`；② 在 `Attention 与位置编码` 之后紧接 `模型总装: ["glm-5-3-flash"]`（确保读者真正读完 Decoder 层与 MLA/稀疏/线性注意力后再进入 `glm-5-3-flash` 总装） |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L80-L81) | `inference` → `Prefill、Decode 与 KV cache`：`["prefill", "kv-cache", "kv-cache-spec"]`（其中 `prefill.md` 合讲 Prefill 与 Decode）；`Block table 与 prefix caching`：`["block-table", "prefix-caching"]` | `kv-cache-spec`（`L80`）依赖块表与分页寻址，却排在 `block-table`（`L81`）之前 | `Prefill、Decode 与 KV cache` 调整为 `["prefill", "kv-cache"]`；`Block table 与 prefix caching` 调整为 `["block-table", "kv-cache-spec", "prefix-caching"]` |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L144) | 第 6 组 `distributed` → `集合通信与 HCCL`：`["collective-communication", "gap-a5164fe10fa9184412f8"]` | 机器哈希 ID `gap-a5164fe10fa9184412f8` 直接暴露在 URL 与引用中 | 严守定稿 `§1.4 第 4 条 / §5.2 契约 6 / L455`（**严禁把旧 ID 塞入 `aliases` 冒充路由兜底**）：待包 4（`045`）落地独立 `legacyIds` 字段、`lint.ts:427` 全局唯一性冲突校验及 `#anchor` 路由重定向后，再迁为 `id: hccl-buffer` + `legacyIds: ["gap-a5164fe10fa9184412f8"]`；若在包 4 前先改正文，则保持原 `id: gap-a5164fe10fa9184412f8` 不变 |
| [toc.ts](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/toc.ts#L222-L238) | 第 9 组 `part.id === "rfork"`（`L225`）用 `p.id === "rfork" \|\| p.id.startsWith("rfork-")` 匹配，早于第 11 组 `part.id === "references"`（`L236` `p.type === "source"`） | 导致 `wiki/sources/rfork-official-guide.md`（`type: source`）漏入第 9 组 `rfork` 而非第 11 组 `references`（`来源与更新记录`） | 在 `toc.ts:225` 增加 `p.type !== "source"` 过滤条件，使 `rfork-official-guide.md` 回到第 11 组 `references` → `来源与版本依据` |

---

## 2. 新增纯算术全链路鸟瞰页 `wiki/concepts/request-overview.md` 章节目标设计

- **页面定位**：紧接 `learning-guide.md` 成为全站第 2 页（第 1 组 `guide` → `一次请求全景鸟瞰`），严格遵循定稿 2A（`§0.2 第 2 条`、`L454`）：**零未定义公式、纯白话算术、不塞 KDA/MLA/mHC/MoE/MTP/TP8/DP2/EP16 等高阶双机机制**，与 `embedding.md`、`lm-head.md`、`sampling.md` 共用同一套 **6 词教学小词表（`0 我 / 1 你 / 2 喜欢 / 3 猫 / 4 看 / 5 。`）与 `H = 4` 教学设定向量**，以普通自回归（causal decoder）路径下提示词 `"我喜欢"`（贪心采样 `temperature = 0`、`max_tokens = 2`）生成 `"猫。"` 完整闭环两轮（Prefill 与 Decode）和四件事（完整候选稿已落盘于 [batch-5-1-candidates/01-request-overview.md](batch-5-1-candidates/01-request-overview.md) 与 [batch-5-1-candidates/request-overview-four-steps.yaml](batch-5-1-candidates/request-overview-four-steps.yaml)）。
- **章节与组件规划**：
  1. `## 一条请求进出模型，总共走哪两轮、四件事`：用标准 `figure` 布局的 2D 图 `request-overview-four-steps`（`size: [880, 410]`）展示第 1 轮 Prefill（最后一行 `h₁` 直接产出第 1 个输出词 `3 号「猫」`，无需额外跑一步 Decode）与第 2 轮 Decode（复用 `KV cache` 只算位置 2 并选出 `5 号「。」`、满 `max_tokens = 2` 停机），显式声明 1 字/词切分与 4 维小数均为教学人为设定。
  2. `## 第 1 件事：把文字切成编号，再按编号查出向量`：沿用 `wiki/diagrams/embedding.yaml` 完全一致的 6 行 4 列嵌入表 `E`，用 `calc` 演示 `"我喜欢"` → `[0, 2]` → 查出 `[2, 4]` 初始向量，自然指路 [token.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/token.md) 与 [embedding.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/embedding.md)。
  3. `## 第 2 件事：逐层根据前文加工表示，并把 K、V 留作历史`：用单层 Q/K/V 点积加权、写入 `KV cache` 与 MLP + 残差相加的 `calc` 算例，演示位置 1「喜欢」怎样融合位置 0「我」得到 `h₁ = [1.0, 0.5, -1.0, 2.0]`，自然指路 [attention-qkv.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/attention-qkv.md)、[mlp-residual-norm.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/mlp-residual-norm.md)、[prefill.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/prefill.md)、[kv-cache.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/kv-cache.md)。
  4. `## 第 3 件事：用最后一行给词表打分，选出第一个输出编号`：沿用 `lm-head.md` 的 `h₁ = [1.0, 0.5, -1.0, 2.0]` 与「猫」列 `[0.6, 0.2, -0.4, 0.5]`、「我」列 `[0.2, -0.4, 0.6, 0.1]`（补齐其余 4 列构成 `W_head`），算出 `logits₁ = [-0.4, -0.5, 0.2, 2.1, 0.8, 1.0]` 与 `T = 1` 下 `52.3% / 17.4% / 14.3%` 概率，按贪心采样当场选出 `3 号「猫」`，指路 [lm-head.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/lm-head.md) 与 [sampling.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/sampling.md)。
  5. `## 第 4 件事：判断继续或停止、还原文本，下一轮只算新位置`：按源码真实职责顺序先讲引擎调度器 `check_stop` 判停与 `Detokenizer` 还原文字（区分 `max_tokens = 2` 下的普通句号 token `"。"` 与 `stop_terminated` 且 `include_stop_str_in_output=False` 时跳过末个停止符），再用**完全同一张 `W_head`** 与第 2 轮 `h₂ = [-1.0, -1.0, -2.0, 2.0]` 复算出 `logits₂ = [-0.8, -1.3, 0.0, 1.0, -0.4, 1.6]`，选出 `5 号「。」` 并满 2 词停机返回 `"猫。"`。

---

## 3. `Batch 5.1` 12 篇存量页逐页现状取证与章节目标准备

### 3.1 `#1` [learning-guide.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/learning-guide.md)（`C1` · 现 173 行）

- **现状问题行号**：
  - `L43-L56`（`## 按顺序读的五页主线`）：推荐顺序为 `glm-5-3-flash` → `glm-5-3-flash-two-node` → `one-request` → `concurrent-requests` → `request-call-chain`，且 `L55` 宣称“前四页只要会矩阵乘就能读”，但与 `toc.ts:57`（未含 `glm-5-3-flash-two-node`）矛盾，且前两页即塞满 KDA/MLA/mHC/MoE/MTP 与双机 DP2/TP8/EP16。
  - `L63-L118`（`### DeepSeek 生产实践怎么读`、`### DeepInfer 怎么读`、`### 昇腾 950 超节点白皮书怎么读`）：全文 173 行中，`L63-L118` 连续 56 行堆叠三张外部高阶专题映射表，压在全站核心分组导览（`L119`）之前。
  - `L142-L169`（`## 对照源码`）：`L154` 含粗体版本补丁段与 `[!]` 标记。
- **需保护的锚点与旧事实三出口**：
  - 保留 `id: learning-guide`；保留 DeepSeek 生产实践、DeepInfer、昇腾 950 白皮书三张专题导读表的全部映射关系与外部边界说明，下移至全站核心分组导览之后作为 `## 进阶专题路线：DeepSeek、DeepInfer 与昇腾 950 白皮书`。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/02-learning-guide.md](batch-5-1-candidates/02-learning-guide.md) 与 [batch-5-1-candidates/learning-guide-route.yaml](batch-5-1-candidates/learning-guide-route.yaml)）**：
  1. 完整保留原页全部 8 个 H2 与 2 个 H3 标题文本（零跨页 `#锚点` 破坏），在 `## 这个知识库讲什么` 与 `## 按顺序读的五页主线` 中对齐定稿 2A「鸟瞰 → 单卡基础积木 → 五页双机主线」顺序（`learning-guide` → `request-overview` → 第 2/3 组基础积木 → `glm-5-3-flash` → 第 6 组双机贯穿案例 `glm-5-3-flash-two-node` / `one-request` / `concurrent-requests` → 第 4 组 `request-call-chain`），消除与 `toc.ts` 的冲突。
  2. 将 `## 每个分组展开主线的哪一步`（11 个 `PARTS` 职责与入口）与 `## 怎么用这个知识库` 提至 4 节高阶分析/生产/硬件/参考资料专题映射表之前，并 100% 保留原 `L63-L118` 与 `L150-L172` 的全部专题链接、锚点与事实边界。

### 3.2 `#2` [one-request.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/one-request.md)（`C1` · 现 716 行，基线 SHA `cb5e5fed...`）

- **现状问题行号**：
  - `L141`：首屏介绍七站刚出图（`L137-L139` `one-request-overview`），立刻插入 `n > 1` 采样扇出多条子请求、共享提示词的分支，打断 R1 单请求主线。
  - `L174`：直接写 `本页沿用上一页的[官方双机部署前提](glm-5-3-flash-two-node.md#部署前提)`，而现行 `toc.ts` 中上一页并非 `glm-5-3-flash-two-node.md`（相隔 86 页）。
  - `L188`：第 1 站刚给出 R1 变成 `[101, 2048, 3091, 512]`，就插入优先级策略退化为选负载更轻引擎的旁支。
  - `L607-L716`（`## 对照源码`）：密集 `[C1]`..`[C55]`、`[S1]`..`[S5]`、`[D]` 编号（`MARK_FLOOD = 69 > 30`、`MARK_DOMINANCE = 82% > 80%`），以及 `L625-L645` 粗体 `v0.30.0rc2` 版本补丁段。
- **需保护的锚点、冻结 3D 与旧事实三出口**：
  - **冻结 3D 零改动**：`L267-L269` `wiki-scene`（`token-flow`）及其前文 `L263-L265` 绑定的 `R1 = p₀ p₁ p₂ p₃` 七站/三步（四阶段连续）导引叙述只字不改。
  - **跨页必保锚点**（保留全部 29 个 H2/H3 标题，即 12 个 H2 + 17 个 H3，`headersRemoved: []`）：`#一条请求要走过七站`、`#示例请求-r1-与官方双机部署`、`#第-2-站-调度4-个-token-的预算和-15-个块号`、`#第-3-站-准备输入一份计划发给-8-个-worker`、`#第-4-站-逐层前向每张卡上的形状通信和字节`、`#前-3-层的稠密-mlp`、`#一次前向的通信账` 等。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/03-one-request.md](batch-5-1-candidates/03-one-request.md) 与 [batch-5-1-candidates/03-one-request.mapping.md](batch-5-1-candidates/03-one-request.mapping.md)）**：
  - 按定稿 2A 将本页在 `toc.ts` 中后移至基础积木与 `glm-5-3-flash-two-node` 之后（同时在 `L174` 处内联双机 16 卡 DP2 × TP8 / EP16、MTP 草拟 3 个 token、统一块号存储额度 `8,355,840 B` 与 `full` 组 640 位置覆盖的自包含前提小结）；将 `L141`（`n>1` 子请求扇出）与 `L188`（优先级路由退化）收束至第 1 站末尾条件段，保持 `R1 = p₀ p₁ p₂ p₃` 从第 1 站到第 7 站及第二、三步续写一气呵成；整理 `### 版本差异` 并收敛 `## 对照源码` 冗余行内角标。

### 3.3 `#3` [concurrent-requests.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/concurrent-requests.md)（`C1` · 现 592 行，基线 SHA `1921a9cc...`）

- **现状问题行号**：
  - `L143`：首屏第 1 段刚引出 `continuous batching`，立刻插入独立句 `接纳等待请求还要求调度未暂停；分到执行组不等于获准进入本轮计算。`，打断向 `one-request.md` 对照表的过渡。
  - `L212-L214`：第 2 站调度刚在 `L210` 写出 `第 2 步沿右支加入，DP0 的账如下：`，尚未进入 `L217` 的 `calc` 账本，先穿插两段“running 队列身份不等于本步必被调度”及“分块需要该路径允许、连接器与编排器允许、关闭分块时受单步最大长度等四道限制”的防御性声明。
  - `L499-L592`（`## 对照源码`）：含 `L524` 粗体 `v0.30.0rc2` 补丁段与密集 `[C1]`..`[C39]`、`[D]`、`[A]`、`[I]` 编号。
- **需保护的锚点与旧事实三出口**：
  - 必保跨页锚点（保留全部 20 个 H2/H3 标题，`headersRemoved: []`，含被 `acl-graph.md`、`graph-mode-layer.md`、`prefill.md` 引用的 `#进入第-4-站之前宽度先按自己补再按对面补`、`#先补到自己这组的图尺寸`）；100% 保留**场景 M**（DP0 上 12 条 `D₁…D₁₂` + 新请求 `N = 6000 token`、DP1 上 7 条 `E₁…E₇`）与**变体 M′**（DP1 空闲陪跑）的全部 6 个 `calc`、表格、8 张 2D `wiki-diagram` 及适用条件。
- **章节改写目标（落盘至 [batch-5-1-candidates/04-concurrent-requests.md](batch-5-1-candidates/04-concurrent-requests.md) 与 [batch-5-1-candidates/04-concurrent-requests.mapping.md](batch-5-1-candidates/04-concurrent-requests.mapping.md)）**：
  - 让 `L210` `第 2 步沿右支加入，DP0 的账如下：` 直接紧接 `L217` 的 `calc` 账本与三步队列表，将原 `L143` 与 `L212-L214` 的调度准入与分块前置条件完整收束到第 2 站三步队列表之后的「本步调度与分块准入边界」段；整理 `### 版本差异` 并收敛 `## 对照源码` 行内角标密度。

### 3.4 `#4` [glm-5-3-flash.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/glm-5-3-flash.md)（`C1` · 现 493 行）

- **现状问题行号**：
  - 在现行 `toc.ts:57` 中排全站第 2 页，导致读者在未学 `token`/`embedding`/`attention`/`mlp` 时直接面对 45+1 层混合架构；`L393-L493`（`## 对照源码`）中 `L433-L437` 含粗体 `v0.30.0rc2` 补丁段与多段未结构化的版本说明。
- **需保护的锚点、冻结 3D 与旧事实三出口**：
  - **3 处冻结 3D 零改动**：`L147-L149`（`model-compute:0`）、`L153-L155`（`model-compute:3`）、`L213-L215`（`model-compute:1`）及其绑定的 4 通道/矩阵乘算例（`[2,4,4,8]` → `[0.4,0.8,0.8,1.6]`、`[2,−2,4,−4]`）完全冻结。
  - **必保跨页锚点**（保留全部 19 个 H2/H3 标题，即 14 个 H2 + 5 个 H3，`headersRemoved: []`）：`#mtp主干之外的第-45-层`、`#全模型形状总表`、`#参数量3133-亿里-97-是路由专家`、`#权重精度文件里怎么存加载后变成什么`、`#开销和什么时候别开` 等。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/05-glm-5-3-flash.md](batch-5-1-candidates/05-glm-5-3-flash.md) 与 [batch-5-1-candidates/05-glm-5-3-flash.mapping.md](batch-5-1-candidates/05-glm-5-3-flash.mapping.md)）**：
  - 按 2A 路线移至第 2 组 `models` 的 `Attention 与位置编码`（`toc.ts:68-76`）之后（作为第 2 组收尾的 `模型总装: ["glm-5-3-flash"]`），在首节补入 1 句承接基础积木的总装过渡；将 `### 版本差异` 的粗体补丁段结构化为四版本对照表 + 分项说明，100% 保留 39 条 `sources`、6 张 2D 图、2 个 `calc` 与 29 处行内角标。

### 3.5 `#5` [layers-and-hidden.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/layers-and-hidden.md)（`C1` · 现 404 行）

- **现状问题行号**：
  - 在 `toc.ts:64` 中排在 `mlp-residual-norm.md` 之前，但标题（`层与隐藏表示：GLM 的 45 层如何连接`）及后半篇围绕 GLM 专有的四条流 `mHC` 与 20 轮 Sinkhorn 双随机矩阵迭代展开；`L131` 在单流手算导引 `x = [2, 1, 2, 0]`（`L129`）与 `layers-one-layer.yaml`（`L134`）之间插入 mHC/MTP 分支说明。
  - `L354-L404`（`## 对照源码`）：`L375` 含粗体 `v0.30.0rc2` 补丁段（未并入下方 `L379-L386` 版本对照表）。
- **需保护的锚点与旧事实三出口**：
  - 必保跨页锚点（保留全部 19 个 H2/H3 标题，即 9 个 H2 + 10 个 H3，`headersRemoved: []`，含被 `mlp-residual-norm.md`、`one-request.md`、`glm-5-3-flash.md` 引用的 `#一层接过什么交出什么glm-为什么在层间传四条`、`#为什么要四条流sinkhorn-又管什么代价在哪`、`#r1-的-hidden-一路走下来`、`#mhc-在-glm-上多花了什么`、`#本轮-hidden历史状态和权重各管什么`、`#版本差异`）。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/06-layers-and-hidden.md](batch-5-1-candidates/06-layers-and-hidden.md) 与 [batch-5-1-candidates/06-layers-and-hidden.mapping.md](batch-5-1-candidates/06-layers-and-hidden.mapping.md)）**：
  - 在 `toc.ts` 中调整到 `mlp-residual-norm.md` 之后；将 `L131` 的 mHC/MTP 适用分支后移至第 3 节单流手算末尾过渡，使 `x = [2, 1, 2, 0]` 导引直接紧接 `layers-one-layer.yaml` 与四步手算；将 `L375` 的 `v0.30.0rc2` 粗体补丁段并入四版本对照表（`v0.23`/`v0.26`/`v0.30.0rc2`/`main`），100% 保留 32 条 `sources`、6 个 `calc`、5 张 2D 图与全部边界条件。

### 3.6 `#6` [prefill.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/prefill.md)（`C1` · 现 493 行）

- **现状问题行号**：
  - `L136`：在 `L134` 冒号导语（`拿一条提示词 6000 个 token、要回答 200 个 token 的请求来数（数为示意）：`）与 `L138` 的 `calc` 块之间插入 chunked prefill 分块说明段，打断冒号引出的算例。
  - `L221`：**跨页悬空指代**——直接写出 `例如 h₀ 对应前文六词示意的原始分布，而 x₁ 恰是“你”，就取“你”的约 0.233，存它的自然对数约 −1.457；不会因为“猫”分数更高就把已知 x₁ 改成“猫”`，其中“六词示意 / 你 0.233 / 猫”来自 `sampling.md`，而本页前文是 `x₀..x₃` 四词提示词示意，未先引入六词分布。
  - `L277`：单位置提示词尾块与整批 `attn_state` 标签（`DecodeOnly` / `SpecDecoding`）的语义边界说明——因紧接 `L275` “只要标签不是纯 decode 的那两种，就算含 prefill”，属于主文避免将执行侧整批标签误当请求语义阶段的必要边界，应保留在 `### ③ 准备输入` 原位并在账本说明理由。
  - `L426-L493`（`## 对照源码`）：`L428` 含粗体 `v0.30.0rc2` 补丁段，`L489-L493` 在 `**待核。**` 之后又追加 3 段源码核对说明。
- **需保护的锚点与旧事实三出口**：
  - 必保跨页锚点（保留全部 17 个 H2/H3 标题，即 6 个 H2 + 11 个 H3，`headersRemoved: []`）、**53 条 `sources`**（`parsePage` 解析值）、2 处 `wiki-diagram`（`prefill`、`prefill-flow`）与 5 个 `calc` 块。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/07-prefill.md](batch-5-1-candidates/07-prefill.md) 与 [batch-5-1-candidates/07-prefill.mapping.md](batch-5-1-candidates/07-prefill.mapping.md)）**：
  - 将 `L136` 的分块适用边界紧接 `calc` 块后与 `L156` 合流，使 `L134` 冒号导语直接紧接 `calc`；将 `L221` 的悬空“前文六词示意”补齐为本页自包含的六词原始分数与 log-softmax 算式（`e² ÷ 31.71 ≈ 0.233`、`ln(0.233) ≈ −1.457`）并显式链接 `[采样页](sampling.md#对数概率怎样读为什么不是置信度百分比)`；将 `L428` 中已核的 `v0.30.0rc2` 条件（`ced6857a` 分块/APC 默认值推导与 `7d825229` MRV1 `attention state` 构造）直接并入第一张版本对照表的 `v0.30.0rc2（专项已核项）` 列并明确区分核验范围与固定旧镜像范围，将 `L489-L493` 三段源码核对归入 `**正文证据归档。**`（保留全部 30 处行内角标与 2 条 `**待核。**`）。

### 3.7 `#7` [gap-a5164fe10fa9184412f8.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/gap-a5164fe10fa9184412f8.md)（`C1` · 现 275 行）

- **现状问题行号**：
  - `L2`：页面 `id` 与文件名仍为机器哈希 `gap-a5164fe10fa9184412f8`（`toc.ts:144`）。
  - `L136`：在 GLM 双机 7 个通信组主表（`L125-L133`）与 `### DP 组为什么只留 50 M`（`L138`）之间，插入了一大段未启用的扩展组（`dynamic_eplb`、细粒度 TP、`FlashComm2` 的 `OTP`/`ODP`、`multistream_overlap_gate` 的 `fc3_quant_x`、PD 头比例）分支；`L155` 在 `L153` 冒号导语与 `L157` 的 `calc` 块之间插入配置口径说明。
  - `L203-L275`（`## 对照源码`）：含 `L228` 粗体 `v0.30.0rc2` 补丁与 `L272-L275` 页末追加的 4 条来源说明。
- **需保护的锚点、ID 契约与旧事实三出口**：
  - **严守定稿 `§1.4 第 4 条 / §5.2 契约 6 / L455`（严禁把旧 ID 塞入 `aliases` 冒充路由兜底）**：`reader-store.ts:85-101` 与 `WikiPage.tsx:155-168` 仅匹配精确 `id`（`aliases` 不解析路由且会在 `WikiPage.tsx:690` 污染页头）；因此必须在包 4（`045`）落地独立 `legacyIds` 字段、`lint.ts:427` 全局唯一性冲突校验及保留 `#anchor` 的路由重定向后，再将页面真改名为 `id: hccl-buffer` + `legacyIds: ["gap-a5164fe10fa9184412f8"]`（仓内 `.md` 与 `toc.ts:144`、`relations[].to` 同步迁往 canonical `id`）；在包 4 就绪前，候选稿**保持原 `id: gap-a5164fe10fa9184412f8` 不变**。
  - 必保跨页锚点（保留全部 14 个 H2/H3 标题，即 7 个 H2 + 7 个 H3，`headersRemoved: []`）、43 条 `sources`、2 处 `wiki-diagram`（`hccl-buffer`、`hccl-buffer-flow`）与 2 个 `calc` 块。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/08-gap-a5164fe10fa9184412f8.md](batch-5-1-candidates/08-gap-a5164fe10fa9184412f8.md) 与 [batch-5-1-candidates/08-gap-a5164fe10fa9184412f8.mapping.md](batch-5-1-candidates/08-gap-a5164fe10fa9184412f8.mapping.md)）**：
  - 将 `L136` 未启用扩展组收束至 `## 放到 GLM 双机` 末尾（`650 M` / `600 M` 算例之后），并将 `L155` 移至 `calc` 紧后与 `L165` 合流；将 `L228` 的 `v0.30.0rc2` 粗体补丁段并入四版本对照表与表下分项说明，并将 `L272-L275` 归入 `**正文证据索引。**`（保留全部 26 处行内角标与 4 条 `**待核。**`）。

### 3.8 `#8` [token.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/token.md)（`B3` · 现 458 行）

- **现状问题行号**：
  - `L156`：首屏刚讲完“切词 + 查编号”（`L154`），立刻插入多模态占位编号超出 `vocab_size` 的边界说明，打断 `L159` 对 token 形态与位置的解释。
  - `L255-L257`：流式增量反分词与因 `stop` 结束跳过末 token 文本转换但保留内部编号的边界——因紧接 `L247-L253` 的三 token 攒字节表，属于解释“输出编号序列 ≠ 流式可见文本”的必要主文边界，应与 `L255` 合并保留在 `## 生成的编号怎样变回文字？` 原位并在账本说明理由。
  - `L262-L268`：在 `## 生成的编号怎样变回文字？` 与 `## 落到 GLM 双机`（`L270`）之间插入 `## DeepSeek Recipe：控制标记与用户文字怎样分开`；`L394` 含粗体 `v0.30.0rc2` `InputProcessor` 补丁段。
- **需保护的锚点与旧事实三出口**：
  - 必保跨页锚点（保留全部 18 个 H2/H3 标题，即 9 个 H2 + 9 个 H3，`headersRemoved: []`）、**64 条 `sources`**、4 处 `wiki-diagram`（`token-intro`、`token-bpe`、`token-split`、`token-entry-flow`）与 3 个 `calc` 块。
- **章节改写目标（已落盘候选稿 [batch-5-1-candidates/09-token.md](batch-5-1-candidates/09-token.md) 与 [batch-5-1-candidates/09-token.mapping.md](batch-5-1-candidates/09-token.mapping.md)）**：
  - 将 `L156` 多模态占位边界收束至 `## Token 是什么？` 末尾；将 `## DeepSeek Recipe：控制标记与用户文字怎样分开` 调整至 `## 落到 GLM 双机` 之后、`## 常见误解` 之前，保持通用切词/反分词到 GLM R1 入口主线连贯；将 `L394` 中已核的 `v0.30.0rc2（ced6857a）` `InputProcessor` 长度与 `routed_experts_prompt_start` 校验并入 `### 版本差异` 的 `核对项` 对照表并明确区分核验范围与支持范围。

### 3.9 `#9` [attention-qkv.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/attention-qkv.md)（`B3` · 现 455 行）

- **现状问题行号**：
  - `L201-L205`：从前文 3 个位置的单卡手算算例（`L178`）突兀跳入 8 个位置分存两张卡（`DCP`）的 3D `wiki-scene`（`L203` `inference-mechanism:0`）；`L269` 在基础因果掩码小节内突然插入双层上下文并行（`CP`）索引器二次因果裁剪开关。
- **需保护的锚点、冻结 3D 与旧事实三出口**：
  - **冻结 3D 零改动**：`L203` `wiki-scene`（`inference-mechanism:0`）及其 `L201` 导引文案只字不改；必保锚点：`#多头同一个位置同时按几套方式去读`。
  - **章节改写目标**：在 `L200` 与 `L201` 之间补入 2 句平滑过渡（说明下方的 3D 场景将单卡 3 位置扩为 8 位置并展示跨两张卡分存 KV 时同样按相关性汇聚）；将 `L269` 双层 `CP` 二次因果裁剪开关移至 `## 对照源码` 边界段并保留主文因果可见性前提。

### 3.10 `#10` [mlp-residual-norm.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/mlp-residual-norm.md)（`B3` · 现 446 行）

- **现状问题行号**：
  - 在 `toc.ts:64` 中排在 `layers-and-hidden.md` 之后；`L191-L207`（`### Q/K Norm：先按头归一化，再加入位置`）在讲完基础 RMSNorm 后直接切入 `Qwen3 / Transformers v4.51.3` 逐头归一化，随后 `L207` 才声明“不能把上面的 Qwen3 逐头顺序直接套到 GLM 双机”；`L383`、`L402`、`L419-L429` 含粗体 `rc2` 补丁与 `[C2]`..`[C28]`、`[S1]`..`[S21]`。
- **需保护的锚点、冻结 3D 与旧事实三出口**：
  - **冻结 3D 零改动**：`L271-L273` `wiki-scene`（`model-compute:2`）及其 `L267-L269` 的 `4 → 6 → 4` 算例、前文 `L244-L261` 的 `2 → 4 → 2` 手算算例完全保留。
  - **章节改写目标**：在 `toc.ts` 中前移至 `layers-and-hidden.md` 之前；在 `### Q/K Norm` 开头显式标明这是注意力内部的逐头 RMSNorm 变体（以 Qwen3 为例，与子层入口 pre-norm 对照），避免读者误以为是所有子层入口的必经步骤；整合 `## 对照源码` 的版本表与源码映射。

### 3.11 `#11` [acl-graph.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/acl-graph.md)（`B2` · 现 421 行）

- **现状问题行号**：
  - `L251-L291`（`## 图片先过视觉编码器，这一步也能录成图吗？`，含 `vit-graph-packing` 与 `128/256/512` 装箱算例）插在主线 `## 放到 GLM 双机：只给整齐的 decode 步录 7 张图`（`L292`）之前，而 `L290` 承认固定 GLM 镜像根本未实现该视觉图协议；`L322-L383` 同样把视觉图排在主模型参数之前。
- **章节改写目标**：
  - 将 `## 放到 GLM 双机：只给整齐的 decode 步录 7 张图`（`L292-L303`）前移至 `## 什么能进图，什么不能`（`L239-L250`）之后，使语言模型主线一气呵成；随后以 `## 扩展：图片先过视觉编码器，这一步也能录成图吗？` 完整保留 `L251-L291` 的视觉图机制、装箱 `calc`、FIA 事件链与 `v0.23/v0.26/rc2/main` 视觉图对照表（零事实丢失）；在 `### 怎么开` 中同样先列主模型配置、再列视觉编码器图配置。

### 3.12 `#12` [graph-mode-layer.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/graph-mode-layer.md)（`B2` · 现 463 行）

- **现状问题行号**：
  - `L220` 在基础三档介绍中插入上游分段 FX 图与昇腾清空 `splitting_ops` 的底层实现对比；`L280-L282` 在数据准备节插入非 ENPU 通用侧流入口与 GLM SFA/GDN 的分支对比；`L329` 在 `### 怎么开` 开头先写 `**Xlite 的独立入口。**`，压在 5 个主模型核心图参数（`L331-L340`）之前。
- **需保护的锚点与旧事实三出口**：
  - 必保跨页锚点（被 `acl-graph.md` 引用）：`#官方双机上录了哪-7-张图`、`#包装器内部透传回放还是现录`、`#启动时录运行时放`、`#回放之前必须先把数据写对`、`#版本差异`、`#怎么开`、`#对照源码`、`#源码位置`。
- **章节改写目标**：
  - 在 `### 怎么开` 中先讲清 5 个核心图配置入口与 4 步尺寸派生规则（`L331-L372`），再放 `Xlite 的独立入口`（`L329`），与正文先主线后 `Xlite`（`L302-L314`）的顺序对齐；将 `L220` FX 图内部表示差异下移至 `## 对照源码` 实现节，主线保留清晰的 `NONE / PIECEWISE / FULL` 三档认知。

---

## 4. `Batch 5.1` 正式执行前置条件与门禁契约

1. **前置条件**：必须等待 `042` 首批 4 个样板经真实管线落盘并通过双检视 + 浏览器视觉验收（`042` `done`）后，才可将 `044` 置为 `doing` 并按本台账执行 `Batch 5.1` 正式改动。
2. **新增 `2A` 纯算术鸟瞰页与配套 2D 图候选稿（`batch-5-1-candidates/`）**：
   - 正文候选稿：[batch-5-1-candidates/01-request-overview.md](batch-5-1-candidates/01-request-overview.md)（严格对齐 `docs/wiki-writing-standard.md`，锚定 `token`、`embedding`、`attention-qkv`、`mlp-residual-norm`、`prefill`、`kv-cache`、`lm-head`、`sampling` 八页固定四版本 `sources`，明确标注 6 词词表与 4 维小数为教学人为设定，讲清 Prefill 最后一行直接产出第 1 个输出 token 及 Decode 复用 `KV cache` 停止闭环；仅作评审候选稿，不充当新一手 `raw` 来源）。
   - 配套 2D 图 YAML 候选稿：[batch-5-1-candidates/request-overview-four-steps.yaml](batch-5-1-candidates/request-overview-four-steps.yaml)（`layout: figure`，`size: [880, 460]` `<= 900px`）。
3. **门禁与旧事实核对（对齐 `package.json` 与定稿方案 `L393`/`L459` 真实命令）**：
   - 小批文档修改按受影响范围运行：`pnpm check:content && pnpm wiki:lint && pnpm wiki:audit && pnpm wiki:diagrams --check`；
   - 批次集成收口运行十项基础门禁：`pnpm typecheck && pnpm lint && pnpm test && pnpm check:deps && pnpm check:content && pnpm wiki:diagrams --check && pnpm wiki:lint && pnpm wiki:audit && pnpm rfork:verify && pnpm build`；
   - 逐页出示旧事实三出口去向对照表与砚砚（`038` 事实与一手来源）、烁烁（`039` 桌面端通俗递进与 2D 图解）双检视通过回执。
