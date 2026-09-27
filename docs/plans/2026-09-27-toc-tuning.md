# 知识库目录微调清单（2026-09-27）

09-27 用户定：**现有章节没有问题，只需微调**。按站点重排的 `2026-09-27-toc-draft.md` 已撤回，只留它的「缺页」和「测试」两节当参考。本文件是在**现有 11 个 part / 现有 section 名**上列出的最小改动清单，不重排目录，不另起结构。

判断依据：主线底稿 `docs/mainline/01-deploy-entry-schedule.md`（A0–A3、A7、B1–B3）、`02-forward.md`（A4、B5）、`03-sample-decode.md`（A5、A6、B4）各站的「做了什么」与「对应知识页」；盘点表 `2026-09-27-page-inventory.md`（处置与硬约束）；`src/content/wiki/toc.ts`（当前编排）。

**本轮只写清单，不改任何代码、目录或页面。** 下面每条都写了「改什么 / 放在哪 / 为什么」，落地时按第 8 节的顺序做。

改动条数：缺页 6 新建 + 4 条「不建页、在现有页补一节」；顺序调整 3；合并 7 + 删除 3（另加 1 份草稿）；页面挪位 4（另有 3 页确认不挪）；名称微调 2 个 part + 15 个 section + 4 个课程章名；chapters/toc 对齐 3 步；要改的测试与派生物 11 处。

---

## 1. 缺页

### 1.1 建 6 页（沿用 toc-draft §3 的清单，这里只定落位）

| 建议 id | 放进哪个分组 · 哪一节 | 排在哪一页之后 | 对应主线 | 一句话 |
| --- | --- | --- | --- | --- |
| `api-server-entry` | vLLM 与 Ascend 架构 › 组件、职责与进程 | `engine-processes` 之后、`request-call-chain` 之前 | A1 第 1–3 步 | 一个 HTTP 请求进到 API server 之后、进 waiting 队列之前发生了什么：套聊天模板、分词、包成 `EngineCoreRequest`、在前端进程登记反分词器和输出队列。 |
| `dp-request-routing` | 分布式推理与部署 › 多副本与专家负载 | 放该节第一页（`balance-scheduling` 之前） | A1 第 4–6 步、B1 | 这条请求被分到 DP0 还是 DP1 由谁决定：请求头里的 `data_parallel_rank`、`score = waiting×4 + running` 打分、协调器 100 ms 计数的滞后。 |
| `lm-head` | 模型结构与计算 › Decoder 层与专家结构 | `moe` 之后（该节末位） | A4-6 | 45 层跑完之后，四路残差折回一条、最终 norm、乘 lm_head 得到 154880 个分数；这张大权重按词表切 8 份怎么 All-Gather。 |
| `sampling` | 推理机制与状态 › **新增节「采样与返回」**（见 1.2） | 该节第一页 | A5 前半 | logits 经温度 / top-k / top-p 定下这一个 token；贪心与随机两条路径、采样参数从哪来。 |
| `streaming-output` | 同上 | `sampling` 之后 | A7 | 新 token 怎样增量反分词成文本、按 SSE 一段段流回客户端、什么条件判停。 |
| `request-teardown` | 同上 | `streaming-output` 之后 | A7 | 请求结束后它占的 block id、请求记录、队列位置怎样回收，KDA 的固定状态块什么时候还。 |

新节「**采样与返回**」放在「推理机制与状态」的第 3 节，即「缓存布局与复用」之后、「分块执行与投机解码」之前。理由：`sampling` 是 `speculative-decoding` 的前置（MTP 草稿靠拒绝采样验收，见 `03-sample-decode.md` A6「怎么走的」）；`request-teardown` 讲释放 KV 块，要先读完 `block-table`。

建页硬约束见盘点表 §1：id = 文件名、`summary` ≤200 字、`sources` 至少一条且只能是 `repo@commit:path#L…` / `http(s)://` / `raw:sha256-…`、至少一条出边或入边、正文按「讲解 + `## 对照源码`」两层写、新词先进 `wiki/TERMS.md`、六页都必须同时写进 `toc.ts` 的 `CURATED`（否则 `toc.test.ts:184` 立刻红）。

### 1.2 不建页，只在现有页补一节（主线上有、但不值得单独一页）

| 主线缺口 | 补进哪一页 | 为什么不建页 |
| --- | --- | --- |
| A3 的注意力元数据（`attn_metadata` 怎么从 `SchedulerOutput` 造出来） | `prepare-inputs-flow` | 现在这部分只在 `attention-backend-family`（A4）里带过，读者在 A3 找不到；它是「准备输入」的一部分，不是独立机制。 |
| A4-1 的四路残差 mHC（`hc_mult=4`，每层在 4 条流之间做可学习混合） | `layers-and-hidden` | GLM 特有的结构，属于「45 层怎么连」这页的正题；`mlp-residual-norm` 只讲单条残差。 |
| B1 空闲 DP 组为什么要 `_dummy_run` 陪跑 | `data-parallel` | 是 DP 的性质，不是单独机制。注意主线 01 与 03 对「陪跑的前向宽度」说法还不一致（`2026-09-27-mainline-rebuild.md` §8 未决项），写页前要先按源码统一。 |
| `block_size` 一词五义（逻辑块 640 token vs 配置里的 128） | `kv-cache-spec`（或 `block-table` 的术语框） | 是个术语陷阱，`01-deploy-entry-schedule.md` §0 已经列全，抄成一个小节即可。 |

---

## 2. 顺序调整（都在现有分组内部，不跨组）

| # | 分组 › 节 | 现在 | 改成 | 为什么 |
| --- | --- | --- | --- | --- |
| 1 | 模型结构与计算 › 注意力与位置编码 | attention-qkv, rope, gqa, sparse-attention, mla, **linear-attention**, attention-cost | attention-qkv, rope, gqa, **linear-attention**, sparse-attention, mla, attention-cost | KDA 是 45 层里的 34 层，第 0 层就是 KDA（`02-forward.md` §1.1 层表），主线 A4-3 排在 A4-4 稀疏 MLA 之前；而且 KDA 只依赖 attention-qkv，不依赖 MLA。`sparse-attention`（通用的密集 vs 稀疏）仍排在 `mla`（GLM 的稀疏 MLA）之前，这一对不动。 |
| 2 | 分布式推理与部署 › 并行维度 | tensor-parallel, **pipeline-parallel**, data-parallel, expert-parallel, sequence-parallel, context-parallel | tensor-parallel, data-parallel, expert-parallel, **pipeline-parallel**, sequence-parallel, context-parallel | 本部署是 TP=8、DP=2、EP=16、**PP=1**（计划 §3）。主线 A0/B1/B5 按 TP → DP → EP 走，读者先遇到的是这三个；PP 和 SP/CP 一样是「用不上但要知道」的一类，放一起。 |
| 3 | 推理机制与状态（节之间） | 生成阶段与状态 / 缓存布局与复用 / 分块执行与投机解码 / 调度与执行重叠 / 状态精度与分层存储 / 外部缓存与连接器 | 在第 2 节之后插入新节「采样与返回」，其余节顺序不动 | 见 1.1：采样是投机解码的前置，收尾要先懂块表。 |

其余节内顺序逐条核过，**不动**：`token → embedding → matmul-and-weights`（A4-1）、`prefill → kv-cache → kv-cache-spec`（A2/A6）、`vllm-engine-core → vllm-scheduler → vllm-kv-block-allocation`（A2 三层）、`prepare-inputs-flow → npu-model-runner`（A3，与 01 的「对应知识页」列序一致）、启动与平台适配六页（A0 启动次序）。

---

## 3. 合并与删除（逐条确认盘点表 §3.1 的 7 合并 + 3 删除）

### 3.1 合并 7 页 —— 全部仍然成立

| 原页 | 并进 | 并进后落在 | 确认理由 | 连带要改的引用（已逐条核过） |
| --- | --- | --- | --- | --- |
| `ai-qos` | `cann-hccl` | Ascend 硬件与软件栈 › 软件栈与互连 | 同讲互连链路；A0 只需要「HCCL 在哪条物理链路上跑」。入链 1。 | `wiki/concepts/ai-core.md` 正文链接；`toc.ts` |
| `superpod` | `hardware-devices` | Ascend 硬件与软件栈 › 设备、内存与计算单元 | 同讲互连拓扑；本部署是 2 台 A2，不涉及超节点内存池化。入链 0。 | **`wiki/TERMS.md:90`「超节点 / SuperPoD」的「对应页面」列要改成 `hardware-devices`**（硬规则：该列 id 必须存在）；`toc.ts` |
| `epd-disaggregation` | `pd-disaggregation` | 分布式推理与部署 › 服务分离与状态传输 | 同类分离形态，本部署不做 PD 分离，两页各占一位是浪费。入链 0。 | 只有 `toc.ts`；但课程章号会出问题，见第 6 节 |
| `who-owns-what` | `vllm-ascend-overview` | vLLM 与 Ascend 架构 › 组件、职责与进程 | 职责边界与 A0「谁持有什么状态」重叠。入链 2。 | `wiki/concepts/vllm-ascend-overview.md`、`wiki/concepts/vllm-v1-shape.md` 正文链接；`toc.ts` |
| `paged-attention` | `block-table` | 推理机制与状态 › 缓存布局与复用 | 同讲分页寻址，A2 只需要一页讲「逻辑块 → 物理槽位」。入链 1。 | `wiki/concepts/kv-cache.md` 正文链接；`scripts/wiki/eval-suite.json:92,99`（期望页写的是 `block-table` + `paged-attention`）；`tests/wiki.spec.ts:116,128`；`toc.ts` |
| `flash-attention-3` | `attention-backend-family` | vLLM 与 Ascend 架构 › 模型执行与后端 | 后端实现细节；GLM 走的是 KDA / 稀疏 MLA 两条后端，FA3 只是其中一种实现。入链 0。 | 只有 `toc.ts` |
| `qwen-request-legacy` | `one-request` | 开始学习 › 模型与请求概览 | 旧模型 trace，只取算例素材。 | `wiki/concepts/one-request.md`、`wiki/sources/answer-fbdf…md` 正文链接；它是 `type: source`，合并后 references › 来源与版本依据 少一页 |

合并操作定义：内容并进目标页、原文件删除、**所有指向原页的 `relations` 与站内 Markdown 链接改指目标页**（盘点表现在是 0 条断链，合并做不干净就会破这条）。

### 3.2 删除 3 页 + 1 份草稿 —— 仍然成立

| 页 | 确认 |
| --- | --- |
| `wiki/params/ascend-warmup-config-67c96ed9ab5c.md` | 79 行 / 273 汉字，`summary` 写「正文待补」，三节都是「骨架，待补」。无 `chapters`、无入链，删掉不牵连任何测试。要留就得先补正文。 |
| `wiki/params/enable-early-kernel-warmup-4f9673f636f5.md` | 同上 |
| `wiki/params/enable-early-nz-warmup-b9e63a0caadc.md` | 同上 |
| `wiki/_drafts/profiling-chunk-config.md` | 草稿残留，正式页 `wiki/params/profiling-chunk-config.md` 已发布；本来就不在 `PAGE_DIRS` 内，删了不影响目录。 |

注：`registry.json` 现在是 **143 页**，比盘点表的 133 页多 10 页，多出来的都是 `type: param` 的新参数页（`absolute-balance-threshold-…`、`load-risk-quantile-…`、`load-window-bins-…`、`placement-search-backtrack-limit-…`、`rank-transfer-limit-…`、`relative-balance-threshold-…`、`replica-search-beam-size-…`、`cross-node-transfer-limit-…`、`fused-op-type-…`、`stair-config-…`）。它们由 `buildToc` 按 `type === "param"` 自动落进「参数参考」，不需要手写进 `CURATED`，本清单不涉及。

---

## 4. 页面挪位（只挪 4 页，每页给理由）

| # | 页 | 从 | 到 | 为什么 |
| --- | --- | --- | --- | --- |
| 1 | `kv-cache-memory-profiling` | 性能与工程优化 › 容量规划 | vLLM 与 Ascend 架构 › 启动与平台适配，排在 `npu-worker-lifecycle` 之后 | KV 预算是**启动时**由 `NPUWorker.determine_available_memory` 量出来的（01 的 A0 第 7 步），和 Worker 启动是同一步。读者走到 A0 时在「性能」里找不到它。挪走后「容量规划」这一节空掉，删除该节。 |
| 2 | `graph-mode-layer` | vLLM 与 Ascend 架构 › 模型执行与后端 | 性能与工程优化 › 图执行与主机资源，排该节第一页 | A6/B4 要的是同一件事的三层：概念（`graph-mode-layer`）→ 捕获与尺寸补齐（`acl-graph`）→ 融合实现（`npugraph-ex`）。现在被劈在两个 part。往这个方向挪只动 1 页，反方向要动 2 页。挪后该节读作 graph-mode-layer → acl-graph → npugraph-ex → cpu-binding，正好是前置在前。 |
| 3 | `recompute-scheduler` | 分布式推理与部署 › 多副本与专家负载 | 推理机制与状态 › 状态精度与分层存储，排在 `recompute-cpu-offload` 之后 | B3「KV 块不够时怎样抢占和回收」的两面：一面是换出（`recompute-cpu-offload`），一面是重算恢复（`recompute-scheduler`）。它和同节的 `eplb` / `balance-scheduling`（专家负载、DP 准入）不是一类。 |
| 4 | `gap-a5164fe10fa9184412f8` | 分布式推理与部署 › 通信与配置（单页一节） | 分布式推理与部署 › 通信基础，排在 `collective-communication` 之后 | 讲的是 HCCL 缓冲区预算，属于 A0 建通信域那一步，和集合通信同一站。单页成节在左栏是噪音。挪后删除「通信与配置」这一节。**本轮不改它的 id**（改 id 要同步 `toc.test.ts:139,151`、`registry.json` 和所有 `relations`，不算微调）。 |

**确认不挪的三页**（盘点表把它们判到别的站，但按「最小改动 + 读者怎么找」留在原处）：

- `glm-5-3-flash-two-node` 留在 分布式推理与部署 › 贯穿案例。它要 TP / DP / EP 三页做前置，现在的位置正好在这三页之后；挪进「开始学习」会让读者在没有并行概念时撞上双机命令。
- `structured-output` 留在 服务能力 › 适配器与输出约束。A5 要用到它，但它是服务能力，用 `relations` 从新建的 `sampling` 页连过去即可，不为一站挪页。
- `ai-core` 留在 Ascend 硬件与软件栈 › 设备、内存与计算单元。盘点表把它算 A4，但读者是按「硬件长什么样」找它的。

---

## 5. 名称微调（按术语规则：vLLM / Ascend / 论文里有名字的机制、组件、特性用英文；请求、显存、维度这类通用技术词保留中文）

### 5.1 part 标题（2 处）

| part id | 现在 | 改成 | 为什么 |
| --- | --- | --- | --- |
| `inference` | 推理机制与状态 | **推理过程** | 「机制与状态」看不出讲什么；这一组装的就是 A2/A5/A6/A7/B2/B3，主角是 KV cache。KV cache 是 vLLM 的固定名，用英文。 |
| `hardware` | 昇腾硬件与软件栈 | **Ascend 硬件与软件栈** | 同一个厂商名，`architecture` 那个 part 写「vLLM 与 Ascend 架构」，这里写「昇腾」，两处不一致。`wiki/TERMS.md:80` 的正名是 `Ascend`、别名才是「昇腾」，按 TERMS 统一成 Ascend。 |

`guide`「开始学习」、`architecture`「vLLM 与 Ascend 架构」、`distributed`「分布式推理与部署」、`performance`「性能与工程优化」、`serving`「服务能力」、`models`「模型结构与计算」、`rfork`「RFork 工作版」、`params`「参数参考」、`references`「来源与更新记录」**不动**。

### 5.2 section 标题（15 处；其中 2 处是删节）

| part | 现在 | 改成 |
| --- | --- | --- |
| models | Decoder 层与专家结构 | Decoder 层、MoE 与 lm_head（新增 `lm-head` 页，「专家结构」就是 MoE） |
| models | 注意力与位置编码 | Attention 与位置编码 |
| inference | 生成阶段与状态 | Prefill、Decode 与 KV cache |
| inference | 缓存布局与复用 | Block table 与 prefix caching |
| inference | 分块执行与投机解码 | Chunked prefill 与 speculative decoding |
| inference | 状态精度与分层存储 | KV cache 量化与分层存储 |
| inference | 外部缓存与连接器 | 外部 KV cache 与 connector |
| architecture | 引擎调度与资源管理 | EngineCore、Scheduler 与 KV block 分配 |
| architecture | 模型执行与后端 | Model runner 与 attention backend |
| distributed | 通信基础 | 集合通信与 HCCL（吸收 `gap-a5164fe10fa9184412f8`） |
| distributed | 多副本与专家负载 | DP 组分流与 expert 负载（吸收 `dp-request-routing`，移出 `recompute-scheduler`） |
| distributed | 服务分离与状态传输 | PD 分离与 KV 传输 |
| performance | 图执行与主机资源 | Graph mode 与主机资源 |
| performance | 数值一致性与后端 | 数值一致性（`flash-attention-3` 合并走后只剩 `batch-invariance`） |
| serving | 适配器与输出约束 | LoRA 与 structured output |
| — | performance ›「容量规划」 | **删除**（唯一页挪走，见 4.1） |
| — | distributed ›「通信与配置」 | **删除**（唯一页挪走，见 4.4） |

不动的节：「阅读路线」「模型与请求概览」「输入表示与张量计算」「数值表示与量化」「组件、职责与进程」「启动与平台适配」「源码阅读」「设备、内存与计算单元」「软件栈与互连」「并行维度」「并行策略进阶」「贯穿案例」「调度与执行重叠」，以及 RFork / params / references 三个自动节。

### 5.3 课程章名 `src/content/wiki/chapters.ts`（4 处）

| 章号 | 现在 | 改成 | 为什么 |
| --- | --- | --- | --- |
| 11 | KV Cache 内存系统 | KV cache 内存系统 | 大小写按 TERMS 统一成 `KV cache`。 |
| 12 | 调度 | Scheduler 与调度策略 | `Scheduler` 是 vLLM 的组件名。 |
| 16 | 图模式与算子 | Graph mode 与 kernel | graph mode、kernel 都在规则给的英文清单里。 |
| 17 | 量化与投机解码 | 量化与 speculative decoding | speculative decoding 是论文里有名字的机制；「量化」是通用技术词，保留中文。 |

⚠️ `chapters.ts` 的文件头注释写明「真相源是 PLAN.md §1.1（22 章）」，那份 PLAN.md 在**另一个仓库** `C:\Users\-\Desktop\infra-view-new\PLAN.md`。改这 4 个章名要跨仓库同步，见第 9 节。

---

## 6. `chapters.ts` 与 `toc.ts` 的关系

### 6.1 各管什么（已核过代码）

| | `src/content/wiki/toc.ts` | `src/content/wiki/chapters.ts` |
| --- | --- | --- |
| 是什么 | 左栏知识库导航的**唯一编排处**：11 个 part + 手写 section（文件头注释） | 课程 22 章「章号 → 标题」表（`00`–`21`），真相源在主仓 `PLAN.md §1.1` |
| 谁指向它 | 没有 frontmatter 字段指向它；`buildToc` 只读页面的 `id` / `type` / `origin` / `order` | 页面 frontmatter 的 **`chapters` 字段**（`schema.ts:132`，两位数字串） |
| 用在哪 | `WikiPage.tsx` 左栏渲染；`toc.test.ts`、`tests/wiki.spec.ts` | lint 的 `unknown-chapter`（`lint.ts:306`）与 orphan 豁免（`lint.ts:373`）；页头 chip「11 · KV Cache 内存系统」（`WikiPage.tsx:239`）；`wiki/index.md`「按章节」分组（`build.ts:46-53`）；`ingest.ts` / `reconcile.ts` / `navigation.ts` 找同章页 |

结论：**两根轴，互不派生，不需要合并**。`toc.ts` 的注释自己写着「课程 chapters 只保留课程关联」。微调只要让两边都别出现空洞。

### 6.2 最小对齐方案（3 步，不动结构）

1. **补空章 05。** `chapters.ts` 的 `"05": "Prefill 与 Decode"` 现在 **0 页**：`wiki/concepts/prefill.md` 挂的是 `chapters: ["01"]`（01 是「Token、Embedding 与向量」），`kv-cache.md` 挂的是 `["04"]`。改法：`prefill` 改挂 `["05"]`，`kv-cache` 加挂 `"05"`（保留 `"04"`）。
2. **别让 18 章变空。** `"18": "PD / EPD 分离与 KV 传输"` 现在只有 `ai-qos` 和 `epd-disaggregation` 两页，**两页都要并走**（第 3 节），并完就是 0 页。改法：`pd-disaggregation`、`mooncake-connector`（现挂 `"17"`）改挂 `"18"`，`kv-cache-layerwise-offload`（现挂 `"11"`）加挂 `"18"`。
3. **新建 6 页必须写 `chapters`。** 建议：`api-server-entry` → `"10"`，`dp-request-routing` → `"13"`，`lm-head` → `"02"`，`sampling` → `"05"`，`streaming-output` → `"10"`，`request-teardown` → `"11"`。不写就会同时触发 lint 的 orphan 和 toc 的「待编排」。

顺带记一笔（不属于本轮改动）：`lora` 和 `structured-output` 现在挂 `"17"`（量化与投机解码），22 章里没有对应「服务能力」的章；等哪天动 PLAN.md 的章节表时一起处理。

---

## 7. 落地时要改的测试断言与派生物

### 7.1 `src/content/wiki/toc.test.ts`（8 个用例，3 个要改）

| 行 | 现在断言 | 本清单的影响 |
| --- | --- | --- |
| 32–36 | `models` 顺序 = `["attention-qkv", "sparse-attention", "mla"]` | **不用改**：fixture 里没有 `linear-attention`，第 2 节的挪动碰不到这三页的相对次序。 |
| 37–40 | `distributed` 顺序 = `["collective-communication", "tensor-parallel"]` | **不用改**：fixture 只有这两页，`pipeline-parallel` 的挪动不影响。 |
| 42–54 | `glm-5-3-flash-two-node` 在 `distributed` / 「贯穿案例」 | **不用改**：该页不挪、节名不改。 |
| 55–73 | `guide` 四页；`vllm-v1-shape` 在 `architecture` / 「组件、职责与进程」 | **不用改**。 |
| 74–88 | `models` 顺序 `["rope","gqa","mla"]` 且都在「注意力与位置编码」；`hardware` 两页 | **要改**：节名改成「Attention 与位置编码」，第 83 行的字符串要同步。顺序断言本身不变。 |
| 89–115 | 七个 part id 的顺序；`inference` 内容 | **不用改**：part id 集合与顺序都不动（只改 `inference` / `hardware` 的**标题**，不改 id）。 |
| 116–137 | RFork / params 自动归位与排序 | **不用改**。 |
| 138–166 | `gap-a5164fe10fa9184412f8` 在 `distributed` / 「通信与配置」 | **要改**：第 151 行改成 `{ part: "distributed", section: "集合通信与 HCCL" }`（第 139 行的 fixture 不动）。 |
| 167–183 | 十个 id → part 的归类表 | **要改**：`"kv-cache-memory-profiling": "performance"` → `"architecture"`（挪位 1）。其余九条不变（`graph-mode-layer` 不在这张表里）。 |
| 184–192 | 拿真实 `registry.json` 断言「每页恰好一次」「待编排为空」 | **断言不改，但最容易红**：删 3 页 + 合并 7 页 + 新建 6 页 + 改 `toc.ts` + 跑 `pnpm wiki:build` 必须在同一个提交里，6 个新 id 必须同时写进 `CURATED`。 |

### 7.2 `tests/wiki.spec.ts`

- **38–50**：`.wiki-toc-part-head` 的 11 个中文标题列表 → 改 `inference`、`hardware` 两个标题（「推理过程」「Ascend 硬件与软件栈」），其余 9 条不动。
- **52–54**：`toc-models` / `toc-hardware` 两个 testid 取的是 part **id**，id 不改 → **不用改**；GQA / MLA 仍在 `models` → 断言仍绿。
- **116**：`ids = ["block-table", "kv-pool", "paged-attention", "prefix-caching"]` → `paged-attention` 合并后 404，换成 `mla` 或 `kv-cache`。
- **128**：`goto /#/wiki/paged-attention` 查「意味着什么」列的事实表 → 改指 `block-table`，并在合并时确认 `block-table` 正文里有这张表。
- **17**：目录链接数 ≥ 11 → 不用改。
- **55、57**：params 默认收起 / 读参数页时展开 → 不用改。

### 7.3 `tests/rfork-wiki.spec.ts`

- **5–6**：`toc-rfork` 12 条链接 → RFork 整块不动，**不用改**。
- **8**：`toc-params` 的 `.wiki-toc-chapter` 断言是「五」。序号由 `WikiPage.tsx:131` 的 `"一二三四五六七八九十"[i]` 给，`params` 在 11 个 part 里下标是 9 → 实际渲染「**十**」。**这条现在应该已经是红的**（本轮没跑 e2e，无证据；计划 §8 也记了「落地前先单跑一遍」）。本清单不改 `PARTS` 的数量和顺序，所以该断言应改成「十」。同时暴露一个渲染缺陷：第 11 个 part（`references`）拿到的是 `[10]` → `undefined`，左栏没有序号；要么把序号表补到「十一」，要么改成 `String(i + 1)`。

### 7.4 其他会被合并/删除碰到的东西

- `scripts/wiki/eval-suite.json:92,99`：一道问答评测的 `expectedPages` 写着 `["block-table", "paged-attention"]`，第 92 行的理由句也点名两页 → 合并后要改成只剩 `block-table`。
- `wiki/TERMS.md:90`：「超节点 / SuperPoD」的「对应页面」列写 `superpod` → 改成 `hardware-devices`（硬规则：该列 id 必须存在）。
- 正文站内链接（合并后会变断链，lint 的 `broken-link` 直接失败）：`kv-cache.md` → `paged-attention`；`ai-core.md` → `ai-qos`；`vllm-ascend-overview.md`、`vllm-v1-shape.md` → `who-owns-what`；`one-request.md`、`sources/answer-fbdf…md` → `qwen-request-legacy`。
- 派生物：`pnpm wiki:build` 重生成 `wiki/index.md` 与 `src/content/wiki/registry.json`（不手改）。
- 已核过**不受影响**：`src/content/wiki/index.test.ts`、`relations.test.ts`、`retrieve.test.ts`、`schema.test.ts`、`scripts/wiki/ingest.test.ts`、`agent-access.test.ts` 里的 `paged-attention` 都是自造 fixture；`src/app/wiki/diff.test.ts` 里的是一段 diff 字符串；`src/sim/model/forwardLayer.ts` 的 `Step.terms` 用的 `token` / `embedding` / `rope` / `gqa` / `kv-cache` / `prefill` 等 id 本清单都不改名、不删。
- 验收命令：`pnpm check`（typecheck + lint + test + check:deps + check:content + `wiki:diagrams --check` + `wiki:lint`），前端另跑 `pnpm test:e2e`。

---

## 8. 落地顺序（建议）

1. **先单跑** `pnpm test:e2e -- tests/rfork-wiki.spec.ts`，确认第 8 行是不是本来就红（见 7.3），把结论记回本文件。
2. **一个提交做完**：删 3 页 + 合并 7 页（含改 `relations`、正文链接、`TERMS.md:90`、`eval-suite.json`）+ 建 6 页 + 改 `toc.ts`（顺序 / 挪位 / 节名 / part 名 / 新节）+ 改 `chapters` 字段（第 6 节 3 步）+ `pnpm wiki:build`。中途拆开提交，`toc.test.ts:184` 必然红。
3. **再一个提交**：改测试断言（7.1–7.3）。
4. `pnpm check` + `pnpm test:e2e`，浏览器实际打开左栏看一遍。
5. 章名（5.3）要不要改、怎么和主仓 PLAN.md 同步，等用户拍板后单独做。

---

## 9. 需要用户决定

1. **课程章名改不改（5.3）。** `chapters.ts` 的真相源在主仓 `C:\Users\-\Desktop\infra-view-new\PLAN.md §1.1`，改 4 个章名要跨仓库同步两个文件。不改就接受章名和主线术语不一致（例如「图模式」vs「graph mode」）。
2. **这批未提交改动怎么处理。** 盘点表 §3.6：全库 114 页「已改未提交」、11 页未跟踪。合并和删除会直接踩在这批改动上，动手前要先定是先提交、还是先回滚、还是就地合并。
3. **`rfork-wiki.spec.ts:8` 和第 11 个 part 没有序号（7.3）** 要不要在本轮顺手修（改断言 +`WikiPage.tsx:131` 的序号表补到「十一」），还是单独开一条。
