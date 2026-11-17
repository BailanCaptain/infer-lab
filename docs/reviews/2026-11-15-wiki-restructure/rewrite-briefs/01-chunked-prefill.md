# 前置参考提炼稿 01：`wiki/concepts/chunked-prefill.md`（分块预填充）

- **目标正式页**：[`wiki/concepts/chunked-prefill.md`](../../../../wiki/concepts/chunked-prefill.md)（`350` 行，SHA-256 `54c0fce9a21c9de8cd99865da3ded8df39d8a1345bb63690d0a4afd33d94ce19`，`51` 条 `sources`）
- **历史编辑候选稿（解除“原句式与旧 2D 图原样保护”锁死，仅吸收正向整理）**：[`candidates/01-chunked-prefill.md`](../candidates/01-chunked-prefill.md)（`350` 行，SHA-256 `372f39d4c6de61309338bea29a62d2b64a93b6e8d6e679c82e0b5b931fedf526`，`56` 条 `sources`）
- **流程角色**：任务 `558` 第二篇前置参考提炼（烁烁提炼 → 墨墨短回合重写 → 烁烁对照旧稿审讲法/是否改差 + 砚砚独立核源码/参考文档/事实）。**重要边界**：本提炼稿仅供重写导航与防丢核对，**不替代一手 `sources` 与固定源码**；写手落笔时一切算式、分支与版本边界必须回对原 `sources`。

---

## 一、 严格冻结项与跨页锚点硬约束（重写前必核）

### 1.1 严格冻结边界（3D 围栏与绑定算例零改动）
1. **3D 交互场景围栏**：原 `L194-L196` 的 `wiki-scene`（`inference-mechanism:7`，对应 [`src/app/wiki/scene-optimization.ts:78-100, 176-186`](../../../../src/app/wiki/scene-optimization.ts#L78-L100) 的 6 步「分块与调度」动画）严格冻结不动。
2. **与 3D 强绑定的 `A/B + C(14 → 6, 6, 2)` 算例数字**：
   - 每步位置预算上限 `8`；请求 `A`、`B` 已在 decode，每步各占 `1` 个位置；新请求 `C` 提示词长 `14` 个 token（位置 `0–13`）；
   - 第 1 步：`1 + 1 + 6 = 8`（`C` 算位置 `0–5`，读 `0–5`，段末采样结果不作为输出）；
   - 第 2 步：`1 + 1 + 6 = 8`（`C` 留在 `running`，算位置 `6–11`，读 `0–11`，段末采样结果不作为输出）；
   - 第 3 步：`1 + 1 + 2 = 4`（余 `4` 个预算空着不必硬凑；`C` 算位置 `12–13`，读 `0–13`，完整读完提示词后选出首个输出 token `y₀`）；
   - 第 4 步：`1 + 1 + 1 = 3`（`C` 送进 `y₀` 转入 decode，与 `A`、`B` 一起每步各推进 `1` 个位置）；
   - 时间轴横轴含义声明不可丢：列宽只划分调度步，**不是毫秒**，不代表每步耗时相等。
3. **Frontmatter 核验字段**：保持 `id: chunked-prefill`、`type: feature`、`verified: []`（真实未全版重验状态，不虚标）、既有 5 条 `relations`、2 条 `rawSources` 及前 51 条 `sources` 前缀顺序（可保留候选稿末尾追加的第 52–56 条 `single_type_kv_cache_manager.py` 与 `7d825229` `batch_invariance.md` 一手锚点）。

### 1.2 全库入站 `#锚点` 硬约束（共 5 个标题锚点、8 处跨页引用）
经全库扫描 `wiki/*/*.md`，以下 **5 个标题锚点**被其他正式页直接引用：
- `#怎么切每一步都是同一道减法` ← `dynamic-chunked-pp.md:204`
- `#历史状态必须跨段延续` ← `kv-cache-quantization.md:191`、`linear-attention.md:253`、`prefill.md:339`
- `#细节切点单条上限和关掉分块` ← `dynamic-chunked-pp.md:204`、`short-request-first.md:173`
- `#放到-glm-双机20000-个-token-的提示词分三步` ← `batch-job-aware-scheduler.md:242`、`dynamic-chunked-pp.md:263`
- `#怎么开` ← `inference-performance-walkthrough.md:339`

> **处理原则**：这 5 个 H2/H3 标题本身直白好懂，**直接保留原文字**即可零断链重排节内行文；若确需改动任一标题文字，须在同一 `Review.writes` 批次同步更新上述调用页。

---

## 二、 原稿与旧候选稿讲法诊断：哪里已经写得好，哪里仍绕弯或单薄

与 `quantization.md` 全篇四线穿插不同，`chunked-prefill.md` 的大章节骨架（直觉算例 → 为什么要切/代价在哪 → 调度减法与单步执行 → 跨段状态延续 → 切点/单条上限/关闭边界 → GLM 双机 20,000 token 推演 → 常见误解 → 对照源码）**整体是顺的**，切不可为了“显出大改”而把本来顺畅的递进打乱套新八股！真正影响阅读体验的具体病灶集中在以下 **5 处**：

1. **首屏第二段（原 `L105`）抢跑高阶模型差异，旧候选稿虽下移但衔接略生硬**：
   - 原 `L105` 在读者还没看到 `A/B + C` 算例前，先插入“普通注意力保存逐位置 K/V vs 线性注意力维护递推状态”，打断了定义到算例的一口气直觉；旧候选稿将其下移到 `## 历史状态必须跨段延续` 方向正确，但下移后首句与下文“靠三样东西接得上”略显重复，应自然融进“历史接得上”那一点。
2. **「代价在哪」首段（原 `L144` / 候选 `L147`）免责词绕口令**：
   - 原文连续用四句近义防御句反复说“预算限制位置数不是时间、减小预算不保证 ITL、增大预算不保证 TTFT”，读起来像免责条款堆砌；完全可以用两句干脆的白话把物理原因讲清：“预算卡住的是**这一步算几个位置**，不是**花多少毫秒**——同样算 8,192 个位置，面前挂着 100 个历史位置还是 10 万个历史位置、走单机还是跨机通信，耗时差得很远；所以只有当剩余预算实际构成限制（未被单条上限 `--long-prefill-token-threshold` 或 KV 块余量等先行卡住）时，调小预算才会缩小本步可排的分块、可能让长提示词跨更多步，调大预算才给本步留出更多 prefill 空间、可能减少步数（而非必然减少步数）；真实 TTFT、ITL 和总吞吐仍必须放在具体负载下一起实测。”
3. **「怎么切」的伪代码与 `running` / `waiting` 双队列差异没对齐（原 `L164-L180` / 候选 `L167-L192`）**：
   - 原 `L168-L169` 在冒号 `C 的三步是：` 与 `calc` 块之间生插了一段补丁；
   - 旧候选稿修复了冒号断裂并在 `L181-L190` 补了一段 Python 伪代码，**但候选稿伪代码漏了关键区分**：源码里 `running` 队列先续跑（只受单条上限和 `token_budget` 截断，**不检查** `not enable_chunked_prefill` 退出循环），而 `waiting` 队列在经过单条上限截断后才检查 `not enable_chunked_prefill and need > token_budget: break`（这也正是为什么一旦设了正的 `--long-prefill-token-threshold` 把首段截进 `waiting` 余量后，后续段进了 `running` 仍会继续分段！）。把 `running` 与 `waiting` 这两步顺序写准，后文 `## 细节` 里“关分块 + 正单条上限仍会分段”的微妙现象就水到渠成，不用死记硬背！
4. **第 2 张 2D 图 `chunked-prefill-flow`（`880×668`）纵向拉得过长、信息密度低，且漏了最核心的“步前 vs 步末位置号错位防呆”**：
   - 现有 `chunked-prefill-flow.yaml` 用 668px 高度排了一条单列竖向大流程图，盒内文字只是把下方 `1. 第 2 站… 2. 第 3 站… 3. 第 4 站… 4. 第 5 站` 四条列表复述了一遍，同时右上角孤零零挂了一个“分块关着不再接新请求”（只发生在 `waiting` 队列，却画在通用单步框旁），而读者最容易晕的**“调度器排完立刻把 `num_computed_tokens` 从 `6` 推到 `12`，但 Worker 准备第 2 段输入时仍按步前 `6` 编出位置号 `6..11`、查块表槽位、读 `0..5` 旧历史并丢弃段末采样”**却没有直观数据对照——**这张图值得重画**！
5. **原稿 3 处内部提示词残留与尾部散装补丁（原 `L212`、`L284`、`L304`、`L317`、`L339-L350`）**：
   - 原文留有“给定材料中的”（`L212`）、“材料中的文档”（`L284`）、“材料还提到”（`L317`）等生成痕迹，以及 `L304` 孤立 `v0.30.0rc2` 粗体段和 `L339-L350` 散装追加的 `**适用边界。**` 复读段（旧候选稿对此处的归并整理做得很好，可直接沿用其归并思路并复核源码细节）。

---

## 三、 循序渐进的推荐讲解主线（保留原稿顺畅大骨架，定点理顺卡点）

1. **第一阶：一句话定义 + `A/B + C(14 → 6, 6, 2)` 直观走盘（`## 一条很长的提示词，能不能分几步算完？`）**
   - 开门见山给出定义后，不抢跑 KDA/普通注意力状态形态差异，直接进入每步预算 `8`、`A/B` 各占 `1`、`C` 占 `14` 个位置的四步示意与首张好图 `chunked-prefill`，让读者在第一屏就看懂：**先紧着已在生成的请求、余量切给长提示词、前两段采样丢弃、最后一段出 `y₀`、下一步转 decode**。
2. **第二阶：正反两本账——为什么要切 vs 切开的代价（`## 为什么要切…` + `## 代价在哪…`）**
   - 保留 `1 + 1 + 14 = 16 vs 1 + 1 + 6 = 8` 算例讲透两个好处（压住单步位置数避免卡住同批 decode 的 ITL + decode 与提示词段合批复用权重；补上关分块且单条上限默认 `0` 时超余量请求堵住后续短请求的排队阻塞）；
   - 保留 `6 + 12 + 14 = 32 vs 14` 与 `105` 对因果打分不减的 `calc` 算例讲透三笔代价（长请求自身 TTFT 拉长、跨段重复访问前序可见历史范围［标明是逻辑范围而非实际 HBM 读取次数］、每步调度/输入准备杂活及未完段末 1 个位置白做词表投影与采样）；用干净白话讲明“位置预算不等于毫秒上限，调参须同看 TTFT、ITL、总吞吐与长短分布”，去掉绕口令式重复。
3. **第三阶：核心机制——同一道减法 + 单步第 2–5 站数据流（`## 怎么切：每一步都是同一道减法`）**
   - 保留“没有单独切块模式，只记目标位置数与已算位置数之差”，保留 `6、6、2` `calc` 块；若配短伪代码，**必须准确区分 `running` 先续跑（截单条上限与 `token_budget`）与 `waiting` 后接纳（截单条上限 → 若关分块且仍超 `token_budget` 则 `break` 停止接纳 → 否则 `min(need, token_budget)`）**；
   - 配**重画后的紧凑横向/双栏图 `chunked-prefill-flow`**，把 `C` 第 2 段（位置 `6..11`）走过第 2→3→4→5 站时“调度器先把 `num_computed_tokens` 推到 `12` vs Worker 仍从步前 `6` 编位置号 `6..11`、查块表槽位、贴 `ChunkedPrefill` 标签、读旧写新、段末采样丢弃并回拨带种子 RNG”讲得一目了然，紧接冻结 3D 场景 `inference-mechanism:7`。
4. **第四阶：为什么不用“拼结果”，以及切点对齐、单条阈值与关闭边界（`## 历史状态必须跨段延续` + `## 细节：切点、单条上限和关掉分块`）**
   - 在 `## 历史状态必须跨段延续` 自然融入普通注意力（原处追加逐位置 KV cache，位置 `6..11` 因果掩码照看 `0..11`）与线性注意力（不存逐位置 K/V，读上一段固定大小递推状态并写回新状态）的对比，外加请求间块表/状态槽隔离与丢弃采样回拨随机种子；
   - 在 `## 细节：切点、单条上限和关掉分块` 清晰讲透三道工程边界（切点平时不对齐 KV 块 vs 混合模型 `align` 模式对齐公共边界 `self.block_size` 而非 `4-token` 物理块；`--long-prefill-token-threshold` 默认 `0`、设正数时 `running`/`waiting` 先截一刀；关分块的模型支持推导、启动校验 `< max_model_len` 报错与崩溃警告）。
5. **第五阶：落到官方双机——`20,000` token 三步推演与尾状态组 `2,037` 块尖峰（`## 放到 GLM 双机：20,000 个 token 的提示词分三步`）**
   - 吸收旧候选稿新增的 **4 步预算与产出对照表**（`8144 → 8144 → 3712 → 4`），紧接执行侧四项变化（`ChunkedPrefill` 走 eager + 超 `128` token 跨机 MoE 换 AllGather；34 层 KDA 跨步接状态 vs 算子内 `64` 位置分段；11 层稀疏 MLA indexer 挑最多 `2051` 个位置；切点 `8144 = 12×640+464` 落块中间）与五缓存组借块 `calc` 账（突出尾状态组 `2,037 → 2,038 → 930 → 3` 块的临时占池尖峰，约 `15.9 GiB` 占 `3,855` 块池过半；表与 `calc` 之间保留正文解释，自然清晰）。
6. **第六阶：8 条常见误解 + 默认折叠 `## 对照源码`**
   - 整组保留原稿极扎实易懂的 8 条常见误解；`## 对照源码` 清理 3 处提示词残留、合流文末散装 `**适用边界。**`，升级为包含 `v0.23` / `v0.26` / `v0.30.0rc2` / `main` 的四版本对照表（严控全页内联角标 `≤30` 且 `[C] < 80%`）。

---

## 四、 值得保留的好段落/算例与两张实际 2D 图逐张方案

### 4.1 必须明确保留的好段落与好算例
1. **首屏 `A/B + C(14 → 6, 6, 2)` 算例与五条走盘要点**（原 `L109-L120`）：与冻结 3D 场景完全咬合，几句话就把分块调度讲活了。
2. **三个核心教学 `calc` 块 + 双机五缓存组借块 `calc` 块**（原 `L125`、`L148`、`L171`、`L240`）：`16 vs 8`、`14 vs 32（105 对不变）`、`min(14−0, 8−2)=6`、以及双机 `full 组 13/13/6 块 vs 尾状态组 2,037/2,038/930 块`，每一笔账都切中关键直觉与真实容量陷阱，**四个 `calc` 全部保留**。
3. **`## 历史状态必须跨段延续` 的“三样东西接得上”**（原 `L200-L206`）：把“为什么不需要事后拼接结果”拆成位置号、历史/递推状态、请求隔离三点，通俗透彻。
4. **旧候选稿 `L244-L249` 的双机 4 步推进表**与 **`L320-L327` 四版本对照表**（把原稿孤立的 `v0.30.0rc2` 粗体段并入表格）。
5. **`## 常见误解` 全部 8 条辨析**（原 `L255-L265`）：条条精准，整组保留。

### 4.2 两张实际 2D 图逐张视觉诊断与处理指令

| 图名（源码文件） | 当前尺寸与视觉结构 | 去留结论 | 具体处理与重画规格 |
|---|---|---|---|
| `chunked-prefill`（[chunked-prefill.yaml](file:///C:/Users/-/Desktop/infra-view-new/wiki/diagrams/chunked-prefill.yaml)） | `880×470`；上方 `0–13` 共 14 格提示词配三段大括号与右侧 `选出 y₀` 绿卡，下方 4 条等比例进度条（预算框宽 `8`，直观对比第 1–4 步 `A`、`B` 与 `C` 的配额及“采样丢掉 vs 选出 `y₀`”） | **原样保留** | 视觉层次极佳、比例尺精准直观，是全库质量最高的首屏示意图之一，原封不动保留。 |
| `chunked-prefill-flow`（[chunked-prefill-flow.yaml](file:///C:/Users/-/Desktop/infra-view-new/wiki/diagrams/chunked-prefill-flow.yaml)） | `880×668`；单列纵向堆叠 9 个大框，高度达 `668px` 偏松散，右上角挂着仅属 `waiting` 分支的“分块关着不再接新请求”，而读者最易混淆的“调度器先推步末 `12` vs Worker 按步前 `6` 编位置号 `6..11`”只缩在副标题小字里 | **建议重画优化** | 保持文件名 `chunked-prefill-flow.yaml`、画布宽 `≤900px`（建议压缩高度至 `420–480px`）、`layout: figure`、保留全部 5 条有效 `pins`：<br>• 改为**以 `C` 的第 2 段（位置 `6–11`）为具体实例的紧凑四站接力图**（第 2 站调度 → 第 3 站准备输入 → 第 4 站前向 → 第 5 站采样分流）；<br>• 在第 2 站→第 3 站交接处突出对比：**调度器记账先推 `num_computed_tokens: 6 → 12`（标 `is_prefill_chunk=True`）** vs **Worker 仍按步前 `6` 编位置号 `[6..11]` + 查 `block_table` 槽位 + 整批贴 `ChunkedPrefill`**；<br>• 第 4 站并列标出普通注意力（读 `0–5` 旧 KV、写 `6–11` 新 KV）与线性注意力（接上一段递推状态、写回本段状态）；<br>• 第 5 站采样清晰分两支：`未追平 prompt（12 < 14）→ 丢弃本次采样 + 回拨带种子 RNG → 下一步从 12 续排` vs `已追平（14 == 14）→ 交付首个输出 token y₀ → 下一步转 decode`。 |

---

## 五、 重点保护的五大条件簇与全部旧事实三出口清单（零遗漏硬核对表）

重写稿必须完整保住正式页全部已核实事实与成立条件（留在正文自然语言说明 / 留在默认折叠 `## 对照源码`），**严禁泛化版本结论或删减前置条件**：

1. **预算（`--max-num-batched-tokens`）与默认启用边界**：
   - 预算封顶的是**单步处理的位置数，不是毫秒耗时**；仅在剩余预算实际构成限制（未被单条阈值或 KV 块等先行截断）时，减小预算才会缩小本步分块、可能增加步数，增大预算才给本步更多 prefill 空间、可能减少步数（非必然）；官方优化文档指小预算（如 `2048`）偏 ITL、大预算偏 TTFT，但受历史长度、并发和通信影响，不能单方面保证某项指标或三项同时最优，须按实际负载同看 TTFT、ITL、总吞吐与长短请求分布。
   - 默认开关：`SchedulerConfig.enable_chunked_prefill` 字段静态兜底 `True`（主要供测试），实际生效值在用户未显式设置时由 `EngineArgs._set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`（生成式模型仅 encoder-decoder 返回 `False`；pooling 请求亦需按配置检查，不可直接套用生成模型默认）；启用时打日志 `Chunked prefill is enabled with max_num_batched_tokens=%d.`（双机应为 `8192`，列在 `**待核。**` 缺实机日志确认）。
   - 手动关闭校验：生成式模型手动关闭会打可能崩溃或输出错误的 warning；关闭分块且**显式传入**的预算严格小于 `max_model_len` 时，`verify_max_model_len` 抛 `ValueError`（未显式传预算时 `EngineArgs` 先抬到 `max(max_model_len, 默认值)` 不报此错；预算恰好等于 `max_model_len` 不会被该严格小于条件拒绝，但上游优化文档写作“必须大于”，且通过该校验不代表其他启动条件必然通过；双机显式给 `8192 < 133120`，关分块直接起不来）。

2. **单条请求阈值（`--long-prefill-token-threshold`）与双队列截断顺序**：
   - 字段默认 `0`（不设上限），`> 0` 时在剩余预算之前先截一刀（docstring 写分类阈值，代码实为截断本步 token 数的闸门；示意设 `4` 则 `C` 按 `4、4、4、2` 分四步）。
   - **`running` 与 `waiting` 顺序差异必保**：`running` 侧先截单条阈值、再 `min(num_new_tokens, token_budget)`；`waiting` 侧先截单条阈值、**再检查分块开关**（关分块且截后仍超余量则 `break` 停止本步 `waiting` 接纳，堵住后面短请求；若设了正的单条阈值且首段截后装得进余量、原请求未算完，后续步进入 `running` 仍会继续分段）。
   - 仅当 `max_num_partial_prefills > 1` 时才自动设为 `max_model_len` 的 `4%`，但固定版 V1 改动 `max_num_partial_prefills` 或 `max_long_partial_prefills` 即抛 `NotImplementedError`（`main` 已移除旧参数，详参 `vllm-scheduler.md#怎么开`），故只能手写；`main` 截断多比一道并行草稿预留输入预算，MTP 预留为 `0`，GLM 切法不变。

3. **切点对齐（chunk 对齐）与块大小刷新边界**：
   - 常规情况切点不看 KV 块边界（双机逻辑块 `640`，`8144 = 12 × 640 + 464`，第 2 段从第 13 块第 465 格接着写）。
   - 对齐仅在含 mamba 类层且 `mamba_cache_mode == "align"` 时触发（`need_mamba_block_aligned_split`；若落入 `align` 但分块关着，触发断言 `Chunked prefill is required for mamba cache mode 'align'.`）：`_mamba_block_aligned_split` 把 prefill 段向下取整到块大小整数倍，不足一块的尾巴照常算；支持逐块保存状态的模型无需此对齐。
   - **物理块 `4` vs 公共状态块边界 `self.block_size`**：GLM-Next 补丁允许混合缓存中 indexer-state 最小物理块对应 `4` 个 token，但完整 KDA 递推状态的可缓存对齐单位改用调度器解析后的公共边界 `self.block_size`（不能由物理块为 `4` 推出每 4 个位置都能保存完整历史状态；`APC` 与 `align` 同开时的状态块计算在 `patch_mamba_config.py`）。本部署默认关闭 prefix caching，`mamba_cache_mode = "none"`，对齐补丁不生效。
   - 昇腾 `refresh_block_size`：普通注意力模型开 chunked prefill 或 prefix caching 且块大小非 `128` 时打一条 `info` 日志并改成 `128`；`deepseek_v4` 与混合结构模型（含 GLM `640`）提前返回不受影响；另点明昇腾镜像内 `ProfilingChunkScheduler` 等动态变体在本部署未启用。

4. **KV 历史与状态跨段延续、单步执行及 GLM 双机 `20,000` token 静态账**：
   - 记账与位置号：`_update_after_schedule` 在前向前先把本步数加进 `num_computed_tokens` 并按 `< num_tokens + num_output_placeholders` 置 `is_prefill_chunk`；Worker 按步前 `num_computed_tokens_cpu` 编位置号。
   - `_build_attn_state` 局部状态分支与最终 `self.attn_state` 改写（`db701c1f:model_runner_v1.py#L1444-L1471`）：① 局部 `attn_state` 先按先后顺序求值——整批 `num_computed_tokens` 全为 `0` → `PrefillNoCache`；否则整批 `num_scheduled_tokens` 全为 `1` → 开 MTP 时为 `SpecDecoding`、未开时为 `DecodeOnly`；否则整批 `num_valid_tokens` 全为 `1`（`#L1455-L1459`，独立于后续分块开关）→ 开投机时为 `SpecDecoding`、**未开投机时直接返回 `ChunkedPrefill`**；否则最后才看 `enable_chunked_prefill`（开为 `ChunkedPrefill`、关为 `PrefillCacheHit`）；② 随后 `#L1466-L1471` 在写入最终 `self.attn_state` 前做一道后置改写——**若局部 `attn_state` 为 `SpecDecoding` 但投机方法非 MTP，最终 `self.attn_state` 会被改写为 `ChunkedPrefill`**。在本页 `6/6/2` 与 `8144/8144/3712` 等**各 prefill 段长度均 `> 1`** 的具体算例下，单长请求独自进时首段为 `PrefillNoCache`、后段为 `ChunkedPrefill`，与 decode 混批时每段均为 `ChunkedPrefill`（**切勿泛化到所有末段**：若某条长提示词最后一段恰好只剩 `1` 个位置且同批其余请求也各排 `1` 个位置，会先命中 `all(num_scheduled_tokens == 1)` 落入 `DecodeOnly`［或 MTP 下的 `SpecDecoding`］）。
   - 未完段采样丢弃与 RNG 回拨：`optimistic_seq_lens < num_tokens` 生成 `discard_requests_mask` / `discard_request_indices`，带种子 RNG offset 回拨 `4`；同步普通采样直接清空、投机拒绝采样过滤、异步路径先从下步输入与请求输出排除再待拷回后清空/过滤，三条消费路径处理时点不同但最终都不追加输出。
   - 两类历史跨段读取：普通因果注意力原处追加并读前段 KV（逻辑可见历史范围 `14 vs 6+12+14=32`、因果打分 `105` 对不变）；GLM 34 层 KDA 按 `has_initial_state` 取上一段固定大小状态、`output_final_state=True` 写回（严格区分 KDA 算子内 `64` 位置分段常量 `kimi_kda.py#L38` 与调度器跨步分块）；11 层稀疏 MLA 元数据 KV 长度取 `seq_lens` 全长，indexer 清单每行最多 `2051` 个位置（`index_topk + index_kpool - 1`）。
   - 双机 `20,000` token 三步推演：双 DP 组各预算 `8192` / 最多 `32` 条，decode 含 `1 + 3` MTP 占 `4` 位置，触发分块门槛最低 `8068`（`R1` `4` token 与场景 `M` `6000` token 不触发）；12 条 decode（占 `48`）下 `20,000` 按 `8144、8144、3712` 三步算完（“每步照常前进”指每轮获调度机会，不代表输出时间间隔不变；整批贴 `ChunkedPrefill` 走 eager 不回放 decode 图，步超 `128` token 使两台机器 MoE 一起改走 AllGather，区别于把 P/D 拆到不同实例的 PD 分离）；五缓存组借块（每步多留 `3` 个 MTP 位置：full 组新借 `13 → 13 → 6` 共 `32` 块，KDA 三组固定 `12` 块，尾状态组滑窗持有 `2,037 → 2,038 → 930 → 3–4` 块，首段按 `7.969 MiB/块` 约 `15.9 GiB` 占 `3,855` 块池过半），并如实声明本页为源码静态推导、缺实机开关分块与调预算延迟实测。

5. **`batch-invariance` 版本条件与四版本演进矩阵**：
   - **`batch-invariance` 严守版本与模式边界**：`v0.23`、`v0.26` 文档不提 chunked prefill；固定 `v0.30.0rc2`（`7d825229`）与 `main`（`baa023ad`）的 `batch_invariance.md` 写明 chunked prefill、prefix caching 和抢占均不支持 batch invariance，要求用户显式关闭前两者并配 `--block-size 128`，且不支持驱逐后重算恢复进度的抢占方式——**必须写明这些限制仅针对该文档规定的 batch invariance 模式与对应快照，不能推广为其他运行模式的共同限制**。
   - **其余版本差异不丢**：① `v0.23`（`2c59ff10` / `db701c1f`）设 `SLO_limits_for_dynamic_batch` 会顺手置 `enable_chunked_prefill = True`，`v0.26` 起移除该顺手改写；② `v0.26` / `v0.30.0rc2` / `main` 的 DP `prefill_schedule_interval` 节拍门控（默认 `1` 不额外节流且不代表关分块；两层触发条件：引擎 `prefill_schedule_interval > 1` 且步号不整除 + Scheduler `prefill_capacity_bound=False` 且 `running` 至少有一条 `is_prefill_chunk=False` 请求；满足时 `running` 中 prefill 分块暂缓、`waiting` 需本地算 `>1` 位置且未走异步远端 KV 分支则停接，放行步按 `waiting` 是否剩余请求更新 `prefill_capacity_bound` 容量受限标记）；③ `v0.30.0rc2` 区分普通分块默认与 Ascend `profiling_chunk` 扩展（`MRV2` 已可搭配 `async`，`MRV1` 仍拒绝）；④ SARATHI 论文出处 `[S30]` 与源码入口表、2 条 `**待核。**` 完整保留；注意全页角标 `≤30` 且 `[C] < 80%`（避免触发 `mark-dominance`）。

---

## 六、 重写后双审对照标尺（039 新旧讲法对比 + 038 独立事实核验）

1. **`@烁烁`（039 新旧稿讲法与视觉对照审查）必查**：
   - 原稿顺畅的大骨架、首屏 `A/B + C(14→6,6,2)` 算例、首张好图 `chunked-prefill`、4 个核心 `calc` 块、双机 4 步表、8 条常见误解与冻结 3D `inference-mechanism:7` 是否完好保留、零改差？
   - 5 处病灶是否真正修顺：首屏抢跑段是否自然归位？`L144` 免责绕口令是否化为清爽白话？调度伪代码是否准确分清 `running` 与 `waiting`？3 处提示词残留与文末散装补丁是否清除干净？5 个跨页入链 `#anchor` 是否零断链？
   - 重画后的 `chunked-prefill-flow` 是否在浏览器实开验证高度紧凑、文字不截断、清晰呈现“调度先推 `6→12` vs Worker 按步前 `6` 编位置号 `6..11`、读旧写新与采样分流”？
2. **`@砚砚`（038 独立源码、参考文档与条件核验）必查**：
   - 第五节五大条件簇（预算与 `< max_model_len` 严格小于边界、单条阈值在 `running`/`waiting` 的先后顺序、`align` 与 `4-token` 物理块 vs `self.block_size`、跨段状态与双机 `8144/8144/3712` 及 `2,037` 尾状态块账、`batch-invariance` 的 `v0.30.0rc2`/`main` 版本与模式限定、DP 节拍门控两层条件）是否零遗漏、零篡改；
   - `pnpm wiki:diagrams && pnpm wiki:lint && pnpm wiki:audit` 全绿。
