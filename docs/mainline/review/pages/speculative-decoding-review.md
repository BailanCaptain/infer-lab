# speculative-decoding 审查记录

## P5 写作记录（2026-10-02，第 19 批深改）

**改了什么。** 页面从 p4-checkpoint 的 5 个平铺小节（正文约 1,511 字符）重写为 9 个正文 H2 + 常见误解 + 对照源码五个 H3（正文约 18,110 字符，其中对照源码之上的教学部分约 12,385 字符；口径为去掉 frontmatter 后的 Python 字符数）。顺序按 09-29 讲法：是什么（猫 / 坐 在 床 / 垫子 的例子）→ 为什么需要（读权重、200 token 步数 calc、与 batching 的小表）→ 一轮怎么走（1 + K 进、1 到 K + 1 出的表）→ greedy 与随机采样（min(1, p/q) 与补抽 max(0, p − q) 的 3 词验算 calc）→ 候选从哪来（文本匹配 / 小模型 / EAGLE、MTP；一层跑 3 遍）→ 被拒位置怎么收场（KV 原地覆盖的位置账 calc、prefix caching、lookahead、递推状态 K + 1 份、卷积多 K 格）→ 为什么也可能变慢（(1 − α^(K+1)) ÷ (1 − α) 与 1.3 倍步耗的示意 calc）→ 和调度、图模式怎样配合（预算截短、录图尺寸倍数、整齐判据、16 上限、异步、PagedAttention）→ GLM 双机单请求 → GLM 双机多请求 → 常见误解 → 对照源码。两处被外页引用的锚点（#为什么也可能变慢、#greedy-验证与随机采样分开理解）标题原样保留。

**两张图。**
- `speculative-decoding.yaml`（直觉图，重画）：一轮循环。① 送进主模型「猫 + 坐 在 床」→ ② 主模型每格预测下一格（坐 / 在 / 垫子 / 上）→ ③ 预测与候选错开一格比（虚线是候选被拿来比的路线）：✓ ✓ ✗、第 4 格「全对才用」→ ④ 写下「坐 在 垫子」、第 4 格作废 → 右侧草稿层接着「垫子」猜 3 个 → 下一轮回到 ①。
- `speculative-decoding-flow.yaml`（新增，代码流程图兼站点位置）：左 EngineCore ①（第 2 站排 1 + K、砍候选、lookahead）⑤（第 6 站按被拒数退回）⑥（第 7 站发回）；右 Worker ②（第 3 站准备输入、K 验证行 + 1 bonus 行）→ 整齐判据 → 回放 FULL 图 / 整步 eager → ③（前向 + rejection sampling）→ ④（草稿层连跑 K 遍，GLM 固定 eager）。
- 两图都用本地 Playwright 把 SVG 渲成 PNG 自看过（会话 scratchpad `sd-*.png`），figureProblems 无报错、文字段数 ≤ 8；未起服务、未截站点页面。按 09-29 暂停规定，没有新加 exchanges 分镜动图。

**数字出处。**
- K = 3、方法 deepseek_mtp → mtp、uniform_decode_query_len = 4、录图尺寸 4…128、max_num_seqs 32：03 §0。
- 每步 48 个层次、草拟三遍同宽、草稿取 argmax、索引器三遍重算（index_share 未实现）、GLM 强制 eager 后仍补到 DP 最大值、每遍至少两次 TP 通信、长度上限附近的收口：03 §A5（第 13–19 条、待核 5、「一个 decode 步的计算量」）。
- 接受规则（greedy、随机 draft_probs 为 None 时取 1）、block / entropy verify 默认关、被拒回退与原地覆盖、满载 32–128 个 token、R1 两圈 2 + 4 = 6：03 §A6；R1 两圈只链接 one-request，不重算。
- 12 条请求 16 vs 64 的补齐放大、32 条才需录到 128、两组对齐与草稿陪跑：03 §B4；推导只链接 concurrent-requests。
- MTP 层每卡 540.75 MiB、432 MiB 路由专家、lm_head 共用：02 §7.5；链接 glm-5-3-flash-two-node。
- 12 层存 KV、13,056 B/token：链接 two-node（01 底稿 KV 账）；KDA 三组 × 4 块：链接 concurrent-requests。
- 卷积缓存 3 → 6 格：本页按 `kimi_kda_state.py#L9-L32`（state_len = 核长 − 1 + num_spec）与 `glm5_next.py#L2498-L2509`（GLM 传入 num_spec）核出，官方 config 的 short_conv_kernel_size = 4。
- 基础节全部用示意数（200 token、猫/你/看 的 0.6/0.3/0.1 与 0.8/0.1/0.1、α = 0.6/0.2、1.3 倍步耗、位置 5–8），已在 calc 标题或正文标「示意」。

**核心概念对照。**
- 论文：Leviathan et al. 2023（arXiv 2211.17192）接受概率 min(1, p/q)、补抽 max(0, p − q)、平均每轮 token 数 (1 − α^(γ+1)) / (1 − α)；Chen et al. 2023（arXiv 2302.01318）同一套拒绝采样。3 词验算逐项核对输出概率 = p。
- 上游 `vllm@0fc695fc`：`rejection_sampler.py#L715-L764`（greedy）、`#L769-L835`（随机，NO_DRAFT_PROBS 取 1）、`#L861-L925`（补抽 max(p − q, 0)，无草稿概率时去掉候选）；`scheduler.py#L212-L226`（lookahead：eagle/mtp/draft_model = K，dflash = K + 1）、`#L518-L535`（预算截短候选）；`kv_cache_manager.py#L305-L330`（只缓存已验证）；`speculative.py#L550-L554`、`#L715-L727`；`compilation.py#L1475-L1518`（凑整与 ValueError）。
- `vllm-ascend@db701c1f`：`spec_decode/llm_base_proposer.py#L141-L149`、`#L217-L236`（补齐检查在 GLM 强制 eager 之前）、`#L282-L294`（NotImplementedError 条件含 use_cuda_graph）；`attention/sfa_v1.py#L298-L305`（assert ≤ 16，GLM 用 SFA）；`ops/triton/reject_sample.py#L238-L272`（entropy verify 把 u 乘 min(exp(−αH), 0.95)）；`sample/rejection_sampler.py#L396-L403`（block verify 需 max_spec_len ≥ 3）；`ops/gdn_attn_builder.py#L430`、`#L594-L598`（K + 1 份状态、缺 num_accepted_tokens 抛错）；`ops/kimi_kda_state.py#L9-L32`；`attention/utils.py`（PagedAttention 互斥）；`spec_decode/__init__.py#L34-L53`。
- 版本：`2c59ff10`、`2ed6cbba`、`baa023ad` 三处 `_is_glm_model` 都在；`baa023ad:spec_decode/__init__.py#L41-L60` 与 `multi_kv_cache_group_proposer.py#L17-L35`（glm5_next_mtp 单独子类）；文档上限 `2c59ff10` po#L247-L250（≤ 15）、`2ed6cbba` po#L69-L72 与 `baa023ad` speculative_decoding.md#L64（≤ 16）；draft_window_size：`2c59ff10`/`db701c1f` 无，`2ed6cbba` llm_base_proposer#L504-L518 不分方法，`baa023ad` #L430-L455 对 MTP 警告并忽略；`vllm@568afb3a` 与 `vllm@84030bbe` 有 num_speculative_tokens_per_batch_size，`2ed6cbba` 无引用，`baa023ad` platform.py#L1548-L1555 与 DCP 互斥；`baa023ad` ascend_config.py#L1114-L1121 dynamic_spec_config 只认 dspark/dflash。

**旧版信息清单勾选**（清单在 13898c74 scratchpad `p5/speculative-decoding-facts.md`；旧版 A = 重写前 427083e 的 Qwen 版，旧版 B = p4-checkpoint 的 GLM 版）：
- 保留：A1–A7、A9–A11、A13–A27、A29、A30、A33–A47、A49–A54；B1–B13 全部能在新版找到（A12/A37 在「候选从哪来」与会报什么错；A19/A20/A34–A36 在「和调度、图模式怎样配合」与会报什么错；A42–A47 在版本差异；A49 的昇腾 / 上游先后在源码位置下方）。
- 更正：A8「最差也不会比不开慢」与 B12 冲突，按 B12 改写为「步数不多，但每步更贵，总时间可能更长」，并用 α 与步耗的示意 calc 演出（依据：GLM 每步 48 vs 45 个层次、logits 行数 ×4、补齐放大 4 倍，03 §A5/§B4）。A15/A52 由 Qwen 的 GDN 改为 GLM 的 KDA（同一 GDN 元数据构建器）。A31 由 Qwen 的 mtp_num_hidden_layers 改为 GLM 的 num_nextn_predict_layers 与昇腾补丁改写 model_type。
- 挪到别页：A32 的 Qwen 字节账退役，GLM 的 KV 字节链接 two-node；R1 两圈的逐格账链接 one-request；lm_head 4 行 1.18 MiB 等 R1 形状字节留在 one-request（单一出处），本页不重算。
- 删除：A12 后半与 A28、A48（Qwen3.6 官方教程的 K = 1 / 并发 < 2 建议、300I DUO 配法）——主线已换成 GLM，Qwen 例子整体退役，其通用结论「低并发收益大、高并发要实测」保留在「为什么也可能变慢」与开销节。A49 中「v0.26 PP 投机解码例外」未在本轮复核，且本部署不开 PP，未写入。

**疑点 / 待核**（已写进页末待核）：真实接受率与开关对照；每步实际多贵；block verify 是否严格保持分布；KDA 下一步取第几份状态的精确下标；v0.26 MTP 被套滑动窗口的实际影响。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错）；`pnpm wiki:diagrams --check` 281 张一致，本页两图无报错与提示；`pnpm wiki:audit` 本页 37 条来源全部行号有效、0 报错（整体失败来自 npugraph-ex 一条行号越界，非本页）；按 standard.ts 单页实测：行内代码 0/千字、对照源码之上角标 0、免责 1.4%、图先行通过、每节 calc ≤ 1。

## P5 审查（09-29）

审查员：独立审查（第 19 批）。只审未改页面。行号指 `wiki/concepts/speculative-decoding.md` 当前工作区版本。

**结论：8.5 / 10。P1 0 条，P2 2 条，P3 6 条。** 学习顺序通过；`pnpm wiki:lint` 通过（本页 0 报错，跨页锚点硬校验通过）；`pnpm wiki:audit` 退出 0，本页 37 条来源行号全部有效，只有 3 条 URL 未联网验证（各页都一样）。

**初学者测试（只读前两屏）。** 先用便宜的草稿猜后面几个 token，连同已确定的 token 一起交给主模型算一次；从左往右对上的留下，第一个对不上的位置换成主模型自己的答案，所以每轮至少写下 1 个。代价是草稿要算、主模型每步多算几行、猜错的位置白算、要多占 KV 和状态，接受率低或并发高时反而更慢。——第一、二屏足够说清，通过。

**学习顺序。** 是什么（猫 / 坐 在 床 / 垫子，不算数）→ 为什么需要（读权重，200 token 示意 calc）→ 一轮怎么走（1 + K 进、1 到 K + 1 出的表）→ greedy 与随机采样（3 词 calc）→ 候选从哪来 → 被拒位置怎么收场（位置 5–8 calc）→ 为什么也可能变慢（α calc）→ 调度与图模式 → GLM 双机 → GLM 多请求 → 常见误解 → 对照源码。基础节没有 GLM 数字（第 11–14 条都满足），第一节末尾没有堆链接。通过。

**示意演算逐个手算（全对）。**
- L84–87：200 ÷ 4 = 50，全错 200 步。
- L141–148：min(1, 0.6/0.8) = 0.75；被拒 0.8 × 0.25 = 0.2；max(0, p − q) = (0, 0.2, 0)；输出 0.6 / 0.3 / 0.1 等于 p。greedy 草稿 q(x) = 1 时的化简（L153）也对。
- L179–187：5 + 4 = 9，被拒 3 − 2 = 1，退回 8，下一步位置 8–11，位置 8 被「垫子」覆盖。
- L201–207：(1 − 0.6⁴)/0.4 = 2.176 ≈ 2.18，÷ 1.3 ≈ 1.68；(1 − 0.2⁴)/0.8 = 1.248 ≈ 1.25，÷ 1.3 ≈ 0.96。1.3 倍已在正文标明是示意。
- L249–256：45 + 3 = 48、1 + 3 = 4、32 × 4 = 128、32 / 128，与 03 §A5 L256、§A6 L471–L472 逐字一致，不是另起推导。

**核心机制对照（抽查，全对）。**
- 拒绝采样 min(1, p/q)、补抽 max(0, p − q)、(1 − α^(K+1))/(1 − α)：与 Leviathan 2023 一致。
- block verify 要 max_spec_len ≥ 3：`vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L399-L400`。entropy verify 是把 u 乘 min(exp(−αH), 0.95)，熵越大越容易接受，「放宽门槛、分布不再严格等于主模型」正确：`ops/triton/reject_sample.py#L259-L267`。
- 1 + K ≤ 16 的断言：`attention/sfa_v1.py#L298-L305`。
- 卷积缓存 3 → 6 格：`ops/kimi_kda_state.py` 里 state_len = 核长 − 1 + num_spec，`models/glm5_next.py#L2501` 传入 num_speculative_tokens，4 − 1 + 3 = 6。
- 补齐检查在 GLM 强制 eager 之前：`spec_decode/llm_base_proposer.py#L217-L236`、`#L282-L294`。
- `_is_glm_model` 强制 eager 在 2c59ff10 / 2ed6cbba / baa023ad 三处都在（git grep 核过），版本表「有 / 有 / 有 / 有」属实。

**数字对照底稿。** K = 3、deepseek_mtp → mtp、录图 4…128、max_num_seqs 32：03 §0 L16–L21。48 层、三遍同宽、每遍 All-Reduce + All-Gather、索引器三遍重算、长度上限附近的处理：03 §A5 L139–L146、L256–L266、L300。12 条请求 16 vs 64、32 条才要录到 128：03 L564、concurrent-requests L276。540.75 / 432 MiB：two-node L176、L183。13,056 B、12 层：two-node L212。KDA 三组 × 4 块：concurrent-requests L234。R1 两圈 8 → 6、位置 6/7 覆盖、2 + 4 = 6：one-request L478、L497、L504。全部一致；R1 的逐格账和多请求补齐账只给结论、带链接，没有重算。

**旧版信息清单。** 清单在（13898c74 会话 scratchpad `p5/speculative-decoding-facts.md`，A1–A54、B1–B13 加一条 A8/B12 裁定）。抽 8 条到新版核对，都在：A13 → L189，A18 → L227，A21 → L239，A30 → L302，A43 → L336，A46 → L338，B8 → L167，B12 → L209。写手勾选属实。删掉的 Qwen 专属项（A12 后半、A28、A48、A32 的 Qwen 字节）理由成立；A49 里「v0.26 PP 例外」没写进来，写手已说明（本部署不开 PP），可以接受。

**注水 / 重复 / 重讲别页。** 从约 1.5k 扩到约 18k，主体是新增的机制讲解（拒绝采样、被拒 KV、递推状态、图模式条件、版本表），不是注水。min(1, p/q) 规则全库只在本页出现，sampling 页只链过来。GLM 多请求一节是两条结论加链接，符合「一句话 + 链接」。少量重复见 P3-1、P3-2。

**截图。** 5193 在运行，用 Playwright 1440 宽打开 `#/wiki/speculative-decoding`：`scratchpad\speculative-decoding-review-first.png`（第一屏：问题式 H2 + 定义 + 直觉图，渲染正常）、`scratchpad\speculative-decoding-review-flow.png`（流程图，两进程、站号、整齐判据、FULL / eager 岔路都清楚）。没有新加 exchanges 分镜动图。

### P2

1. **L262「草稿层固定 eager」：「并在启动时打一条警告」在这套部署上不成立。** 警告在 `if self.use_cuda_graph:` 里面（`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217`、`#L227-L235`）；官方命令给草稿写了 `enforce_eager: true`（01 L250），`use_cuda_graph` 在 L217 就已经是 False，所以 GLM 双机启动日志里**不会**出现这条警告。读者照着找日志会找不到。改法：L262 改成「草稿层被强制成 eager；只有草稿配置没写 enforce_eager 时才会打这条警告，官方命令写了，所以看不到」；L313 那条警告后面补上同样的条件。底稿 03 §A5 第 17 条（L153–L155）也写成了无条件打印，属于单一出处的错，需要一并改。
2. **L237「异步调度默认跟着打开」：说反了因果。** `vllm@0fc695fc:vllm/config/vllm.py#L957-L997`：async_scheduling 留空时**默认就开**，跟开不开 speculative decoding 无关；投机方法不在 EAGLE 类（含 mtp）或 GPU ngram 里、或者关了草稿批次补齐、或者执行器不支持时，会被**关掉**。现在的写法会让人以为「不开投机就没有异步调度」，和 async-scheduling 页（L200、L236、L249）矛盾。改法：写成「异步调度默认就是开的；MTP、EAGLE 这类草稿只要不关草稿批次补齐，就不会把它关掉；换成小草稿模型等其他方法会被自动关掉」，然后链到 async-scheduling。

### P3

1. L169 第一句（MTP 挂在一步尾巴上、先验再猜）和 L126 基本重复，常见误解 L285 又说了一次。建议 L169 只留指向 GLM MTP 层和 R1 第 5 站的那两个链接。
2. L245 MTP 每卡 540.75 MiB / 432 MiB 的字节账和投机解码关系不大，而且 two-node 已经有了。建议只说「结构同主干的稀疏 MLA + MoE 层、单条 residual、embedding 与 lm_head 共用」，字节账只留链接。L262 和 L277 都讲了「草稿补到两组较大值」，可以留一处。
3. 直觉图第 ④ 行：写下的「坐 在 垫子」排在顶部「位置 5 / 6 / 7」那几列下面，但它们实际落在位置 6 / 7 / 8（L181–L186 的 calc 写的是「垫子」覆盖位置 8）。第 ② 行有「→ 位置 N」，第 ④ 行没有，初学者容易把「垫子」看成位置 7。建议第 ④ 行三格也加上「位置 6 / 7 / 8」小字。
4. 本批验收要点里的「token 与文本增量」：本页只说一步交回 1 到 K + 1 个 token（L255、流程图 ⑥），没有提这几个 token 到前端后会合成一段文字增量。同批新建的 streaming-output 页已经链到本页（它的 L68、L137），本页没有反向链接。建议在流程图说明或 GLM 一节补一句：「一步交回的 1–4 个 token 由前端反分词，拼成一段增量推给客户端」，并链到 [流式输出](streaming-output.md)。
5. 有两个术语先用后讲：L95 第一次出现 KV cache，但到 L173 才解释并给链接，建议 L95 就加链接；L233 和 L262 的 FULL / FULL_DECODE_ONLY 在通用节没有解释，建议第一次出现时加半句，比如「把整步录成一张图的 FULL 模式」，再链到 graph-mode-layer。
6. L79–L81 用两段重新讲了「decode 卡在读权重」，prefill 页 L114–L128 已经有带宽受限的演算。这两段作为动机可以留，但建议加一个链接指过去，不要再往下展开。

### 本次审查跳过 / 未做
- 没读 frontmatter 的 sources 区（来源由 audit 校验）。「对照源码」只核了五个 H3 的顺序，以及「版本差异」里有没有出现 v0.23 / v0.26 / main；顺带看了版本表和「会报什么错」「开销」两节的条目，没读「源码位置」正文。
- 没读 HANDBOOK 和 docs/plans/。
- v0.23 文档写的「≤ 15」（`2c59ff10` 的 speculative_decoding.po#L247-L250）只靠 audit 确认行号存在，没有读原文核对。

## P5 修订记录（2026-10-02，按「P5 审查」逐条）

- **P2-1 草稿切 eager 时的警告（已改）。** 核 `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217`（`use_cuda_graph = _use_aclgraph() and not enforce_eager`）与 `#L227-L236`（警告在 `if self.use_cuda_graph:` 里，之后才无条件置 False）：官方命令草稿写了 `enforce_eager: true`，警告不打。GLM 单请求节「草稿层固定 eager」改成「只有草稿原本要录图时才打，这套部署日志里看不到」；会报什么错里该警告补上打印条件；怎么开里 `enforce_eager` 一条补「不写时多一条 GLM 警告」。底稿 03 §A5 第 17 条（L153–L155）同样写成无条件打印，属派发范围外文件，本轮**未改**，请主会话决定是否改底稿。
- **P2-2 异步调度因果（已改）。** 核 `vllm@0fc695fc:vllm/config/vllm.py#L957-L997`：留空时默认开；有投机时仅在方法不属于 `EagleModelTypes`（含 MTP 名单、dflash）与 `NgramGPUTypes`（`ngram_gpu`）、或 `disable_padded_drafter_batch`、或执行器不支持时关掉（另有 pooling 模型关掉，与本页无关）。`speculative.py#L54-L58` 核了两组名单。正文改成「默认就开；开投机后只在两种情况被自动关掉」，怎么开里 `disable_padded_drafter_batch` 改成「异步调度会因此被自动关掉」。
- **P3-1（已改）。** 「候选从哪来」末段删掉与「一轮怎么走」重复的「挂在一步尾巴上」一句，只留 GLM MTP 层与 R1 第 5 站两个链接；常见误解那条保留（误解清单本身就是复述）。
- **P3-2（已改）。** GLM 节删掉 540.75 / 432 MiB 字节账，只留结构与链接；「草稿补到两组较大值」只留在多请求一节，单请求节改成「宽度另按两个 DP 组对齐，见下一节」。
- **P3-3（已改）。** 直觉图第 ④ 行三格加「位置 6 / 7 / 8」；「垫子」格因框宽 88px 放不下「位置 8 · 主模型」，改为主文字「主模型的垫子」、小字「位置 8」；图说明补「在位置 8 写下」。figureProblems 无报错，已渲 PNG 自看。
- **P3-4（已改）。** GLM 单请求节 calc 之后补一段：一步交回的 1–4 个 token 是编号，回前端经反分词拼成一段新增文字再推给客户端，链 [流式输出](../../../../wiki/concepts/streaming-output.md)。
- **P3-5（已改）。** 第二屏「要多留地方」首次出现 KV cache 处加一句解释和链接；通用节第一次出现 FULL 处加半句「把整步前向录成一整张图的那一档」并链 graph-mode-layer 的「录多少」一节；GLM 节 FULL_DECODE_ONLY 处加「只给整齐的 decode 步录 FULL 图，混合步不录」。
- **P3-6（已改）。** 第二屏「读权重」一句后加链接到 prefill 页「为什么把已知的位置合成一步，代价在哪？」，不再展开。
- **v0.23 文档「≤ 15」（已按原文核，属实）。** `vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L63` 原句：算子每轮最多 16 个 token，因此 `(num_speculative_tokens + 1)` must be ≤ 15（中文 po `#L244-L250` 同义）；`2ed6cbba` 同一文件 `#L63` 是 ≤ 16，`baa023ad` 的 `#L64` 也是 ≤ 16。数没错，只是 v0.23 文档同一句前后自相矛盾：版本表改写成「同一句先说算子最多 16 个，又写 ≤ 15；代码是 16」。两条文档来源由 zh_CN po 换成英文原文 md `#L63`（编号不变，正文角标不动）。
- **验证。** `pnpm wiki:lint` 通过（本页 0 报错）；`pnpm wiki:diagrams --check` 281 张一致；`pnpm wiki:audit` 退出 0，本页来源全部行号有效；单页写作标准实测：行内代码 0/千字、对照源码之上角标 0、免责 1.8%、图先行通过。
- **底稿 03 §A5-17 修正（2026-10-02，主会话裁定）。** 把 `docs/mainline/03-sample-decode.md` 第 17 条从「置回 False 并打印警告」改成：`use_cuda_graph` 先按 `_use_aclgraph() and not enforce_eager` 算（`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217`），GLM 覆盖无条件置 False（`#L227`、`#L236`），警告只在 `if self.use_cuda_graph:` 里打印（`#L228-L235`）；GLM 双机官方命令给草稿写了 `enforce_eager: true`（01 L250），所以不打。只改这一条。改前全库 grep：仍沿用「无条件打警告」原说法的别页只有 `wiki/concepts/request-call-chain.md` L335（未改，留主会话处理）；`one-request.md` L426 只说强制 eager、没提警告，不受影响。改后 `pnpm wiki:lint` 退出码 0、`pnpm wiki:audit` 退出码 0。
