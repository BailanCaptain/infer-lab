# 2026-09-27 术语中译扫描（只读审视）

目的：盘点知识库里「有固定英文名却写成中文」的术语，给后续改写提供依据。本文只记录事实与计数，不改任何页面。

规则（用户定）：凡是在 vllm / vllm-ascend / torch_npu / CANN / HCCL 源码标识符、官方文档或论文里有固定英文名的术语，正文一律用英文原名；第一次出现时用中文解释它做什么，但不另起中文名。

## 1. 术语机制现状

- **登记处**：`wiki/TERMS.md`，四栏表（统一叫法 / 别的叫法（收进 aliases）/ 简明定义 / 对应页面 / 备注），共 84 行。其中 **34 行的「统一叫法」是纯中文、而「别的叫法」里已经列着英文原名**（层、权重、注意力、专家、调度器、块表、槽位、前缀缓存、投机解码、量化、图模式、算子、进程、显存、集合通信、通信组…），47 行的统一叫法已含英文，3 行没有英文名（参数量、卡、机器）。
- **以中文名为主还是英文名为主**：表规定「正文用统一叫法」，所以那 34 行等于把中文定为正文写法，英文降级成搜索用的 alias。这就是本次要改的根。
- **会不会生成提示**：会。`scripts/wiki/handbook.ts:92-98` 的 `loadHandbook()` 把整份 TERMS.md 追加到 HANDBOOK 的「页面格式」切片后面，再注入写页的模型：`scripts/wiki/ingest.ts:256`、`:351`，`scripts/wiki/draft-review.ts:100`，`scripts/wiki/drop.ts:132`，`scripts/wiki/worker.ts:107`，`scripts/wiki-compile.ts:5`。问答与覆盖判定的切片不带这张表（同文件注释）。**先改表，再改页；否则新入库的页会按旧叫法写回来。**
- **会不会生成链接**：会。frontmatter 的 `aliases`（schema：`src/content/wiki/schema.ts:126-131`）被这些地方消费：
  - `src/content/wiki/retrieve.ts:110-126` —— 问答检索的字段 0 是 `id + title + aliases`，权重最高的一档，**中文提问能命中页，靠的就是这些中文 alias**；
  - `src/content/wiki/index.ts:27-33` `findByAlias()` → `src/content/wiki/Term.tsx:35` 术语悬停卡、`src/app/pages/WikiPage.tsx:269` 的「也叫：」一行；
  - `scripts/wiki/gaps.ts:129`（缺口覆盖判定）、`scripts/wiki/gap-sources.ts:28-30`（按中文话题定位页）。
- **有没有测试检查**：
  - `scripts/wiki/lint.ts:294-303` `dup-alias`：alias 不能与别的页的 id 或 alias 重名；
  - `scripts/wiki/lint.ts:538-546` `missing-term`：只校验 `src/sim/model/forwardLayer.ts` 里 `Step.terms` 引用的**页 id**存在，页 id 已是英文 slug，与叫法无关；
  - `src/content/wiki/schema.test.ts:81-83` 锁 `CHAPTER_TITLES` 恰好 22 章；`src/content/wiki/toc.test.ts` 只校验每节非空、页 id 存在；
  - **没有测试断言真实页面的中文标题或中文正文**。出现在测试里的「KV 缓存」「块表」「前缀缓存」都是自造夹具（`src/content/wiki/retrieve.test.ts:8/27`、`src/content/wiki/index.test.ts:40`、`scripts/wiki/agent-access.test.ts:8`、`scripts/wiki/gap-sources.test.ts:21`），`tests/wiki.spec.ts:428` 是 mock 的 SSE 文本。

## 2. 改用英文时必须一起改的地方

1. `wiki/TERMS.md` 的「统一叫法」列：34 行要换成英文原名，中文挪到「别的叫法」。表是生成提示的一部分，必须最先改。
2. 页面正文 + 正文标题（`##`）：133 页里的命中情况见下表「正文 / 正文标题」两列。
3. frontmatter `title`：133 页中 **109 页的 title 含中文**，下表「fm.title」列给出每个词命中的 title 数。
4. frontmatter `aliases`：**中文译名要挪进 aliases，不能直接删**——它是中文提问检索的唯一入口（retrieve 字段 0）；同时受 `dup-alias` 约束，不能和别的页的 id/alias 撞。
5. `src/content/wiki/toc.ts`：分区 blurb 与小节标题是手写文案，**28 条标签含中文译名**（清单见 §5）。
6. `src/content/wiki/chapters.ts` 的 `CHAPTER_TITLES`（22 章标题）同为手写文案，改名时一起过一遍；数量不能变（schema.test.ts 锁 22）。
7. `wiki/diagrams/*.yaml`（133 份手写图 spec，svg 由 `scripts/wiki/diagrams.ts` 渲染）：正文改叫法而图不改就会前后不一致，下表「图 yaml」列是命中次数；改完要重跑 `pnpm wiki:diagrams`。
8. 派生物重建：改 title 后必须 `pnpm wiki:build`（`scripts/wiki/build.ts:26/99` 用 title 生成 `wiki/index.md` 与 `src/content/wiki/registry.json`），再 `pnpm check`（含 `check:content` 校验 registry、`wiki:diagrams --check`、`wiki:lint`）。
9. **页 id 不动**：registry、toc、sim 的 `Step.terms`、lint 都按 id 关联，id 已是英文 slug。

## 3. 扫描方法与口径

- 脚本（只打印术语与计数）：`build-dict.mjs`（从 TERMS 两列自动抽 97 对中英对应）、`ngram.mjs`（正文汉字 n-gram 高频词，补词典）、`discover.mjs`（「中文（English）」并列写法，命中 23 对）、`dict.mjs`（最终词典，140 条，含分类与固定名来源）、`scan.mjs`（主扫描）、`mix.mjs`（英文原名使用量、中文标题统计、toc 标签）、`context.mjs`（易误判词的前后字形，做精度体检）。目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\22a23d1b-7cff-42d4-b794-99259aeb8e3f\scratchpad\`。
- 范围：`wiki/concepts`（104）+ `wiki/params`（25）+ `wiki/sources`（5）= **133 页**，正文剥掉围栏代码块与行内代码；frontmatter 的 `title`、`aliases` 单独计；`src/content/wiki/toc.ts` 的 title/blurb 单独计；`wiki/diagrams/*.yaml` 133 份另计一列。**被跳过的文件：0。**
- 去重叠：长词优先掩码，例如「分块预填充」不会再被「预填充」重复计一次。
- 混用现状（正文里英文原名的出现次数，作对照）：prefill 134 / 预填充 3，decode 115 / 解码 12，worker 130 / 工作进程 0，token 472，kernel 64，all-reduce 26 + allreduce 29，attention 53。但 quantization 5 / 量化 138，scheduler 29 / 调度器 52，prefix caching 0 / 前缀缓存 39，graph mode 0 / 图模式 31，sampling 0 / 采样 92，block table 1 / 块表 42 —— 缺口集中在这批词。

## 4. 完整对照表：改用英文（按正文出现次数排序）

| 中文译名 | 英文原名 | 固定名来源 | 正文 | 涉及页数 | 正文标题 | fm.title | aliases | toc.ts | 图 yaml | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 专家 | expert | 源码 experts | 214 | 30 | 10 | 4 | 5 | 3 | 26 | 含「专家并行 / 共享专家 / 路由专家」之外的单用 |
| 算子 | operator / kernel | torch_npu / CANN | 166 | 55 | 3 | 4 | 3 | 0 | 17 |  |
| 流 | stream | CANN: aclrtStream | 149 | 71 | 4 | 4 | 6 | 0 | 28 | 低精度：170 次里多为控制流 / 流水 / 数据流 / 流式 / 流量，真正指 aclrtStream 的很少，改写前需逐处确认 |
| 量化 | quantization | vllm: --quantization | 138 | 42 | 4 | 2 | 6 | 1 | 6 |  |
| 调度 | schedule | 源码 schedule() | 131 | 54 | 8 | 8 | 4 | 2 | 14 | 与「调度器」分开计数 |
| 后端 | backend | 源码 attn_backend | 121 | 44 | 5 | 1 | 1 | 2 | 16 |  |
| 引擎 | engine | 源码 EngineCore | 117 | 39 | 7 | 1 | 2 | 1 | 9 |  |
| 采样 | sampling | 源码 SamplingParams | 92 | 28 | 3 | 2 | 1 | 0 | 19 |  |
| 调度器 | scheduler | 源码 Scheduler | 52 | 28 | 0 | 0 | 2 | 0 | 3 |  |
| 块表 | block table | 源码 BlockTable | 42 | 20 | 2 | 1 | 2 | 0 | 8 |  |
| 前缀缓存 | prefix caching (APC) | vllm: enable_prefix_caching | 39 | 19 | 2 | 1 | 3 | 0 | 0 |  |
| 槽位 | slot | 源码 slot_mapping | 39 | 18 | 3 | 2 | 0 | 0 | 9 |  |
| 稀疏注意力 | sparse attention | 论文 | 35 | 25 | 0 | 1 | 1 | 0 | 6 |  |
| 通信组 | process group | torch.distributed | 34 | 18 | 2 | 2 | 1 | 0 | 5 |  |
| 抢占 | preemption | 源码 preempt | 33 | 17 | 1 | 1 | 1 | 0 | 2 |  |
| 残差 | residual | 论文 | 33 | 13 | 2 | 1 | 2 | 0 | 13 |  |
| 执行器 | executor | 源码 Executor | 32 | 16 | 1 | 1 | 3 | 0 | 3 |  |
| 收集 | gather | HCCL: Gather | 32 | 16 | 1 | 0 | 0 | 0 | 8 | 低精度：多数是动词「收集」，只有 HCCL 语境才等于 gather |
| 图模式 | graph mode | vllm-ascend 官方文档 | 31 | 19 | 0 | 0 | 1 | 0 | 1 |  |
| 共享专家 | shared expert | config: n_shared_experts | 29 | 10 | 0 | 0 | 1 | 0 | 8 |  |
| 归约 | reduce | HCCL: Reduce | 27 | 12 | 2 | 1 | 0 | 0 | 4 |  |
| 矩阵乘 | matmul / GEMM | torch.matmul | 26 | 15 | 1 | 1 | 2 | 0 | 3 |  |
| 线性注意力 | linear attention | 论文 | 24 | 7 | 0 | 0 | 1 | 0 | 5 |  |
| 路由专家 | routed expert | config: n_routed_experts | 22 | 10 | 0 | 0 | 0 | 0 | 4 |  |
| 专家并行 | expert parallel (EP) | vllm: --enable-expert-parallel | 21 | 11 | 1 | 1 | 2 | 0 | 0 |  |
| 投机解码 | speculative decoding | vllm: speculative_config | 20 | 16 | 0 | 1 | 1 | 1 | 0 |  |
| profiling | profiling | 源码 profile_run | 19 | 15 | 0 | 1 | 2 | 0 | 4 | 已是英文，仅统计以确认无中译 |
| 门控 | gate | 源码 gate | 19 | 11 | 0 | 0 | 5 | 0 | 7 |  |
| 卸载 | offload | 源码 cpu_offload | 18 | 10 | 1 | 2 | 3 | 0 | 0 |  |
| 物理块 | block | 源码 block_id | 17 | 10 | 0 | 0 | 1 | 0 | 6 |  |
| 广播 | broadcast | HCCL: Broadcast | 17 | 7 | 0 | 1 | 0 | 0 | 6 |  |
| 前馈网络 | FFN / MLP | 论文 | 15 | 6 | 3 | 0 | 1 | 0 | 1 |  |
| 主机内存 | host memory | TERMS | 14 | 9 | 0 | 1 | 1 | 0 | 6 |  |
| 序列并行 | sequence parallel (SP) | 官方文档 | 14 | 9 | 0 | 1 | 1 | 0 | 2 |  |
| 图捕获 | graph capture | 源码 capture | 14 | 8 | 1 | 0 | 0 | 0 | 4 |  |
| 张量并行 | tensor parallel (TP) | vllm: tensor_parallel_size | 12 | 9 | 1 | 1 | 1 | 0 | 0 |  |
| 预热 | warmup | 源码 warmup | 12 | 7 | 1 | 0 | 0 | 0 | 1 |  |
| 解码 | decode | 源码 decode | 12 | 6 | 0 | 0 | 2 | 0 | 2 | 与「解码器」「编解码」组合词已按长词优先分开计数 |
| 负载均衡 | load balancing (EPLB) | vllm: eplb | 10 | 8 | 0 | 0 | 4 | 0 | 0 |  |
| 路由器 | router | 源码 router/gate | 10 | 4 | 0 | 0 | 1 | 0 | 0 |  |
| 内存池 | memory pool | 源码 pool | 9 | 5 | 1 | 1 | 1 | 0 | 1 |  |
| 集合通信 | collective communication | HCCL 文档 | 8 | 7 | 0 | 0 | 1 | 0 | 1 |  |
| 数据并行 | data parallel (DP) | vllm: data_parallel_size | 8 | 6 | 0 | 1 | 1 | 0 | 0 |  |
| 残差连接 | residual connection | 论文 | 8 | 4 | 1 | 0 | 1 | 0 | 0 |  |
| 分词器 | tokenizer | 源码 tokenizer | 8 | 3 | 0 | 0 | 1 | 0 | 1 |  |
| 隐藏维度 | hidden size | config: hidden_size | 7 | 6 | 1 | 0 | 1 | 0 | 0 |  |
| 派发 | dispatch | 源码 dispatch | 7 | 3 | 0 | 1 | 0 | 0 | 1 |  |
| 上下文并行 | context parallel (CP) | 官方文档 | 6 | 6 | 0 | 1 | 3 | 0 | 0 |  |
| 掩码 | mask | attn_mask | 6 | 5 | 0 | 0 | 0 | 0 | 3 |  |
| 连续批处理 | continuous batching | 官方文档 | 6 | 5 | 0 | 0 | 1 | 0 | 0 |  |
| 逻辑块 | logical block | 源码 | 6 | 4 | 0 | 0 | 1 | 0 | 2 |  |
| 流水线并行 | pipeline parallel (PP) | vllm: pipeline_parallel_size | 6 | 4 | 0 | 1 | 2 | 0 | 0 |  |
| 草稿模型 | draft model | 源码 draft | 6 | 3 | 0 | 0 | 1 | 0 | 0 |  |
| 算子融合 | kernel fusion | 官方文档 | 5 | 5 | 0 | 0 | 0 | 0 | 0 |  |
| 注意力头 | attention head | num_attention_heads | 5 | 4 | 0 | 0 | 1 | 0 | 0 |  |
| 因果掩码 | causal mask | 官方/论文 | 5 | 4 | 1 | 0 | 1 | 0 | 0 |  |
| 密集因果注意力 | dense causal attention | TERMS | 5 | 4 | 1 | 0 | 0 | 0 | 1 |  |
| 捕获图 | graph capture | 源码 capture | 5 | 3 | 0 | 0 | 0 | 0 | 0 |  |
| 超节点 | SuperPoD | 官方文档 | 5 | 2 | 0 | 1 | 1 | 0 | 0 |  |
| 亲和 | affinity | CANN 文档 | 5 | 1 | 1 | 1 | 0 | 0 | 2 | 实际写法多为「亲和性」= affinity |
| 旋转位置编码 | RoPE | 论文/源码 rotary_emb | 3 | 3 | 0 | 0 | 1 | 0 | 0 |  |
| 贪心 | greedy | 源码 greedy | 3 | 3 | 0 | 0 | 0 | 0 | 1 |  |
| 结果组合 | combine | 源码 combine | 3 | 3 | 0 | 1 | 0 | 0 | 0 |  |
| 预填充 | prefill | 源码 is_prefill | 3 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 自注意力 | self-attention | 论文 | 2 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 头维度 | head dim | head_size | 2 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 混合专家 | MoE | 论文 | 2 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 分离部署 | PD disaggregation | vllm: kv_transfer_config | 2 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 流水并行 | pipeline parallel (PP) | TERMS | 2 | 2 | 0 | 0 | 1 | 0 | 0 |  |
| 位置编码 | positional encoding | 论文 | 2 | 1 | 1 | 0 | 1 | 1 | 0 |  |
| 反量化 | dequantization | 源码 dequant | 2 | 1 | 0 | 0 | 0 | 0 | 1 |  |
| 通算融合 | MC2 | vllm-ascend 文档 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |  |
| 词嵌入 | embedding | TERMS | 1 | 1 | 0 | 0 | 2 | 0 | 0 |  |
| 嵌入向量 | embedding | TERMS | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 矩阵乘法 | matmul / GEMM | torch.matmul | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 注意力分数 | attention score | 论文 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 分组查询注意力 | GQA | 论文 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 多头潜在注意力 | MLA | 论文 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 分块预填充 | chunked prefill | vllm: enable_chunked_prefill | 1 | 1 | 0 | 0 | 1 | 0 | 0 |  |
| 束搜索 | beam search | 源码 beam_search | 1 | 1 | 0 | 0 | 0 | 0 | 0 |  |
| 词元 | token | TERMS/官方 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 令牌 | token | TERMS | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 词向量 | embedding | TERMS | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 归一化指数 | softmax | TERMS | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| KV 缓存 | KV cache | 源码 kv_cache | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 块映射表 | block table | 源码 BlockTable | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 推测解码 | speculative decoding | TERMS | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 分页注意力 | PagedAttention | 论文/源码 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |  |
| 单算子模式 | eager mode | vllm: --enforce-eager | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 昇腾软件栈 | CANN | CANN | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 集合通信库 | HCCL | HCCL | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| 昇腾芯片 | NPU | TERMS | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |

## 5. 边界词清单（通用数学 / 计算机词，请用户定，本文不下结论）

这些词的中文说法在中文技术写作里同样通用，且多数不是某个固定标识符的唯一译名；是否一并改英文，请用户决定。

| 中文译名 | 英文原名 | 固定名来源 | 正文 | 涉及页数 | 正文标题 | fm.title | aliases | toc.ts | 图 yaml | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 请求 | request | TERMS | 768 | 95 | 37 | 15 | 7 | 2 | 82 |  |
| 状态 | state | 通用 | 619 | 98 | 33 | 15 | 3 | 4 | 102 |  |
| 权重 | weight | TERMS | 472 | 80 | 24 | 3 | 12 | 1 | 59 |  |
| 缓存 | cache | 通用 | 374 | 78 | 20 | 15 | 4 | 3 | 34 |  |
| 张量 | tensor | 用户示例 | 255 | 77 | 6 | 2 | 1 | 2 | 17 |  |
| 注意力 | attention | 用户示例 | 248 | 67 | 8 | 6 | 8 | 2 | 26 |  |
| 通信 | communication | 通用 | 147 | 52 | 13 | 3 | 4 | 4 | 17 |  |
| 进程 | process | TERMS | 131 | 41 | 9 | 2 | 6 | 2 | 20 |  |
| 运行时 | runtime | 通用 | 119 | 49 | 3 | 1 | 1 | 0 | 6 |  |
| 一步 | step | 源码 step() | 119 | 49 | 10 | 0 | 0 | 0 | 10 |  |
| 批次 | batch | TERMS | 111 | 41 | 9 | 3 | 1 | 0 | 15 |  |
| 投影 | projection | 源码 qkv_proj | 98 | 31 | 1 | 0 | 0 | 0 | 22 |  |
| 显存 | device memory / HBM | 用户示例 | 83 | 38 | 5 | 2 | 3 | 0 | 3 |  |
| 序列 | sequence | TERMS | 82 | 40 | 1 | 2 | 0 | 0 | 6 |  |
| 同步 | synchronization | 通用 | 79 | 40 | 1 | 0 | 0 | 0 | 4 |  |
| 矩阵 | matrix | 用户示例 | 72 | 30 | 5 | 1 | 0 | 0 | 13 |  |
| 激活 | activation | 通用 | 67 | 27 | 6 | 2 | 1 | 0 | 6 |  |
| 向量 | vector | 用户示例 | 65 | 22 | 4 | 2 | 1 | 0 | 15 |  |
| 异步 | asynchronous | 通用 | 63 | 33 | 1 | 1 | 3 | 0 | 3 |  |
| 词表 | vocabulary / vocab | config: vocab_size | 61 | 20 | 2 | 0 | 1 | 0 | 14 |  |
| 副本 | replica | 通用 | 54 | 15 | 7 | 1 | 0 | 1 | 9 |  |
| 节点 | node | TERMS | 53 | 16 | 3 | 0 | 4 | 0 | 10 |  |
| 维度 | dimension | 通用 | 51 | 28 | 0 | 0 | 0 | 2 | 2 |  |
| 归一化 | normalization | 通用 | 48 | 24 | 0 | 0 | 1 | 0 | 10 |  |
| 延迟 | latency | 官方文档 | 40 | 32 | 0 | 0 | 0 | 0 | 2 |  |
| 吞吐 | throughput | 官方文档 | 28 | 25 | 1 | 0 | 0 | 0 | 0 |  |
| 带宽 | bandwidth | 用户示例 | 24 | 16 | 1 | 0 | 0 | 0 | 2 |  |
| 一批 | batch | TERMS | 23 | 13 | 0 | 0 | 0 | 0 | 1 |  |
| 设备内存 | device memory | TERMS | 17 | 13 | 0 | 0 | 1 | 0 | 10 |  |
| 隐藏向量 | hidden state | TERMS | 15 | 5 | 0 | 0 | 1 | 0 | 4 |  |
| 利用率 | utilization | 通用 | 6 | 6 | 0 | 0 | 0 | 0 | 0 |  |
| 迭代 | iteration / step | TERMS | 3 | 2 | 0 | 1 | 0 | 0 | 2 |  |
| 隐藏态 | hidden state | TERMS | 3 | 1 | 0 | 0 | 1 | 0 | 2 |  |
| 算力 | compute | 通用 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |  |
| 时延 | latency | 官方文档 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |  |

toc.ts 里含上述词的 28 条手写标签（改与不改都要一次过完）：

从模型与请求理解推理…（请求）｜张量、Decoder 层、注意力与专家结构（张量/注意力/专家）｜推理机制与状态（状态）｜Prefill、缓存、批处理与生成过程（缓存）｜组件职责、进程、输入输出与实现位置（进程）｜从设备与内存到计算、通信和互连（通信）｜并行维度、通信与服务拓扑（维度/通信）｜独立演进的权重加载实现…（权重）｜模型与请求概览（请求）｜输入表示与张量计算（张量）｜数值表示与量化（量化）｜Decoder 层与专家结构（专家）｜注意力与位置编码（注意力/位置编码）｜生成阶段与状态（状态）｜缓存布局与复用（缓存）｜分块执行与投机解码（投机解码）｜调度与执行重叠（调度）｜状态精度与分层存储（状态）｜外部缓存与连接器（缓存）｜组件、职责与进程（进程）｜引擎调度与资源管理（调度/引擎）｜模型执行与后端（后端）｜通信基础（通信）｜并行维度（维度）｜通信与配置（通信）｜多副本与专家负载（专家/副本）｜服务分离与状态传输（状态）｜数值一致性与后端（后端）

## 6. 保留中文

- TERMS 里本来就没有固定英文名的 3 行：**参数量**（总参数 / 激活参数，是描述性说法）、**卡**（板级加速硬件）、**机器**（一台物理服务器；「节点」另有 P/D 角色语义）。
- 各页的叙述性写法（「一句话」「本页」「先…再…」「已核对」等）不是术语译名，不在本次范围内。

## 7. 计数的已知误差

- **流**：正文 170 次里绝大多数是控制流 / 流水 / 数据流 / 流式 / 流量，真正指 `aclrtStream` 的极少，不能按计数直接替换。
- **收集**：36 次里多数是动词，只有 HCCL 语境等于 gather。
- **亲和**：实际写法是「亲和性」，对应 affinity，计数 7 偏低是因为只统计了两字形。
- 计数不区分「第一次出现时的中文解释」与普通引用；按用户规则，第一次出现仍要用中文解释这个东西做什么，所以改写时不是把中文全删，而是把**名字**换成英文。
- 表中「正文标题」列统计的是 `##` 级标题行里的命中，已包含在「正文」列里。
