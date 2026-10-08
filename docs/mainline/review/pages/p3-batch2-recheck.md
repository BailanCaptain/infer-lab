# 复审：第 2 批两个主线页的修订是否落实（2026-09-27）

- 对象：`wiki/concepts/concurrent-requests.md`（461 行，工作树未跟踪）、`wiki/concepts/request-call-chain.md`（366 行，已跟踪、有未提交改动）
- 依据：两份审查报告末尾的修订记录（`concurrent-requests-review.md` §八、`request-call-chain-review.md` §六）
- 方法：页面分段读（每次 ≤150 行）、结构与用词用 grep 统计、源码用 `git -C tools/repos/vllm[-ascend] show <commit>:<path>` 只取相关几行
- 实际运行：`npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 23 处待留意）`，两页零告警；`npx tsx scripts/wiki-diagrams.ts --check` → `ok wiki:diagrams 140 张图与 spec 一致`
- 没做：没有在浏览器里渲染；没读 HANDBOOK.md 与 docs/plans/（按纪律）；本轮有一次输出被安全分类器中断（读完 request-call-chain 尾段之后），之后改为只用 grep 取证，已核结论不受影响

## 结论

| 页面 | 判定 |
|---|---|
| `wiki/concepts/concurrent-requests.md` | **通过**（14 条「已改」全部落实；唯一「不改」的 P3-3 理由成立，但修订记录对现状的描述与页面不符，见下） |
| `wiki/concepts/request-call-chain.md` | **通过**（8 条全部落实，新增前提本轮已独立核过） |

## 一、concurrent-requests：逐条核对

| 条目 | 落实位置 | 核对结果 |
|---|---|---|
| P1-1 部署前提写错 | `:81` | 已改。「各自调度、各自一个 KV 池；注意力和稠密层每台一份按 TP8 切，288 个路由专家按 EP16 切在 16 张卡上，两台合起来才是完整的一份模型」，并点出这是两组对齐与陪跑的根源 ✓ |
| P2-1 KV 池推导指向 | `:211` | 已改。只留结论，链到 `glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache`；锚点按 `src/content/wiki/anchors.ts:8` 的 `headingSlug` 规则由 `glm-5-3-flash-two-node.md:168` 的 H2 生成，可用 ✓ |
| P2-2 MC2 门槛 128 | `:316` | 已改。本页只写「规则和门槛 128 的来历在[一条请求]第 4 站『42 层 MoE』一节算过」＋强调「两组最大值」；推导保留在 `one-request.md:352-359` 一处 ✓（观察项见 §四） |
| P2-3 两层补齐 | `:255`、`:273`、`:283-288`、`:298` | 已改。拆成两个 H3，新增 28/32/64/6048 四个宽度的来历表，三步表加「这个宽度由谁定」一行 ✓ |
| P2-4 `+12`、`+2` 无来历 | `:213-221` | 已改。先解释缓存组（5 组：full、索引器状态、3 个 KDA 组），逐项写清 3 组 × 4 块与索引器状态 2 块，并标「待核：稳态占 1 块还是 2 块」✓ |
| P2-5 底稿 MC2 口径 | `docs/mainline/02-forward.md:882-905`、`:1085` | 已改底稿。§8.5 改为补齐后 64 行、每卡 8 行、≤ 55.1 MiB、跨机 ≤ 31.5 MiB、≈ 113×、≈ 135×；§12.3 写明「§12 表中 P1-3 那一行的 41.4 MiB / 151× 是当时的记录，以本行为准」✓ |
| P3-1 DP、MoE 先用后解释 | `:69`、`:72` | 已改为「两台机器（两个执行组）」「专家层的跨机通信」✓ |
| P3-2 DP2 未定义 | `:81`、`:320`、`:330-333` | 已改。`:81` 定义 DP2；MoE 表改成「两组 token 数的最大值」「两组之间的 All-Gather / Reduce-Scatter」✓ |
| P3-3 集合通信大小写 | 全页 | **不改**，理由成立（要全仓统一，需用户拍板）。但见 §三-1：记录里的现状描述与页面不符 |
| P3-4 草拟 eager 前提 | `:279`、`:451`、frontmatter `:47` | 已改。新增源 `llm_base_proposer.py#L217-L236`，本轮实读该段：`self.use_cuda_graph = ...`（#L217）→ `if _is_glm_model(...): ... self.use_cuda_graph = False`（#L227-L236），引用范围准确 ✓ |
| P3-5 dp-align 两个比例尺 | `wiki/diagrams/concurrent-request-dp-align.yaml:54` | 已改，下半标题为「第 2 步 · 两组都 eager · 同比例要宽 94 倍」✓ |
| P3-6 时间轴单位 | `wiki/diagrams/concurrent-request-rounds.yaml:12` | 已改为 `unit: 步` ✓ |
| P3-7 每卡 8 行缺算式 | `:338` | 已改为「每卡最多 `64 ÷ 8 = 8` 行」✓ |
| P3-8 10 条无人引用的 sources | `:428`、`:441`、`:446-448`、`:455`、`:457`、`:460`、`:461` | 已改。10 条逐条落到源码位置表或版本差异：scheduler 761-781→`:441`、glm5_next 1726-1785→`:446`、glm5_next 1201-1232→`:447`、cudagraph_dispatcher 76-96→`:448`、prepare_finalize 543-560→`:455`、worker 972-973→`:457`、model_runner 1080-1099→`:460`、scheduler 1695-1711 与 1888-1910→`:461`、envs 103-105→`:428` ✓ |
| P3-9 66 GiB 口径 | `:336` | 已改为「按每张卡收到的量算…每个方向约 33.2 GiB…链路一步合计约 66 GiB」✓ |
| P3-10 层数口径 | `:198`、`:213` | 已改。「前 3 层是稠密 MLP，其余 42 层是 MoE」；缓存组一句写明「主干 45 层加 MTP 层」✓ |

结构与用词：

- `## 对照源码`（`:398`）之后无 H2；H3 五个按序：`:400` 怎么开 → `:408` 会报什么错 → `:415` 开销和什么时候别开 → `:423` 版本差异 → `:431` 源码位置 ✓
- 角标 28 处（≤ 30），全部在 `:404` 及以后，`:398` 以上零角标；C 21 / 28 = **75%** < 80% ✓
- 「副本」「完整」共 7 处：`:81` 已是正确写法；`:196`（每卡一份完整张量）、`:314`（All-Gather 拿到完整副本）、`:343`（拼回完整张量）、`:348`、`:394`（完整前向）都是数据拷贝/完整前向，保留合理 ✓
- 术语抽 10 个：prefill、decode（`:63`）、continuous batching（`:77`）、MoE / TP8 / EP16 / MTP（`:81`）、scheduler（`:123`）、graph mode（`:257`）、MC2（`:313`）、All-Gather（`:314`）、logits（`:375`）首次出现处都有中文解释 ✓。小瑕疵：`query_start_loc` 先在 `:181` 的代码块出现，文字解释在 `:189`

## 二、request-call-chain：逐条核对

| 条目 | 落实位置 | 核对结果 |
|---|---|---|
| P1-1「完整的模型副本」 | `:96` | 已改。「两台机器各是一个**执行组**…但两台机器都不是一份完整的模型：…专家摊在全部 16 张卡上，每台机器只有一半」✓ |
| P2-1 第 2 站 patch 漏两处 | `:104`、`:175-181`、`:322-330` | 已改为「五处」并逐条列出，另加一张「第 2 站的五处 patch」表。新增前提本轮独立核过：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L261-L263` 的 `need_mamba_block_aligned_split` 要求 `mamba_cache_mode == "align"`，而 `vllm/config/cache.py:133` 默认 `"none"` ✓；`patch_kv_cache_coordinator.py#L461-L534` 确有「命中返回 `AscendHybridKVCacheCoordinator`、否则回落原函数」两支 ✓ |
| P2-2 `AsyncScheduler` | `:152`、`:173`、`:183`、`:209`、`:247-248`、`:307`、`:337`、`:341` | 已改。源码核对：`config/scheduler.py#L168-L173` 异步时返回 `AsyncScheduler` ✓；`async_scheduler.py#L12` 继承 `Scheduler`，`#L19`、`#L43` 重写 `_update_after_schedule` / `_update_request_with_output` ✓。小瑕疵：该类另有 `__init__`（`#L13-L17`，只做占位列表与 pp_size 记账），页面「只重写了两个方法」严格说少算了它 |
| P3-1 角标数 | 全页 | 说明成立。`src/content/wiki/evidenceMarks.ts:22` 的 `EVIDENCE_MARK_RE = /\[([SCDAIM!])(\d*)\]/g` 确实含 `!`；实测修订后 **29** 处角标、C **22** 处 = **75.9%** < 80%，与记录一致 ✓ |
| P3-2 箭头定义 | `:169`、`:171`、`:173` | 已改。定义放宽为「沿着调用往里走…有几处中间还隔着一两层」；第 1 站拆出 `_add_request`；`allocate_slots` 与 `get_new_blocks` 之间补「各缓存组的管理器」✓ |
| P3-3 草拟 eager 原因 | `:205`、`:346`、frontmatter `:61` | 已改，并引 `llm_base_proposer.py#L227-L236` 的告警原文 ✓ |
| P3-4 TP / EP / pcp | `:97`、`:237`、`:316` | 已改。TP、EP 首次出现即给中文并链到 tensor-parallel / expert-parallel；`:237` 给出 `Worker_DP1_TP3_EP11` 的解码例；`:316` 注明 pcp 本部署为 1 ✓ |
| P3-5 `AscendMultiprocExecutor` | `:320` | 已改，附条件导入位置 `patch/platform/__init__.py#L47-L48` ✓ |
| P3-6 图二角标 | `wiki/diagrams/request-call-chain-step.yaml` / `.svg` | 已改。yaml 里已无 `badge`，svg 用「第一次 / 第二次」文字标注 ✓ |

结构与用词：

- `## 对照源码`（`:286`）之后无 H2；H3 只有 `:288` 版本差异 → `:299` 源码位置，落在允许的五个里且顺序正确 ✓
- 角标 29 处（≤ 30），首个在 `:294`，`:286` 以上零角标；C 22 / 29 = 75.9% < 80% ✓
- 「完整」4 处：`:96` 已是正确写法，`:227`（完整跑一遍 45 层）、`:280`（完整的执行）、`:284`（完整的前向）指流程完整，保留合理；全页无「模型副本」✓
- 术语抽 10 个：KV（`:85`）、MoE（`:96`）、NPU / TP / EP（`:97`）、ZMQ（`:121`）、HCCL（`:125`）、gloo（`:127`）、RPC（`:133`）、logits（`:135`）、MTP（`:136`）、future（`:146`）、MLA（`:160`）、KDA（`:161`）、detokenizer（`:171`）、eager（`:190`）、SSE（`:211`）、prefill / decode（`:215`）、pcp（`:316`）首次出现处全部有中文解释 ✓

## 三、没落实 / 需要注意的条目

1. **P3-3 的现状描述与页面不符（concurrent-requests，P3 级）。** 修订记录写「未改…本页维持 TERMS.md 的小写」，但页面正文现在用的是大写：All-Gather 17 次、All-Reduce 7 次、Reduce-Scatter 4 次、All-to-All 1 次，只有 `:344` 代码块里还是 `all-reduce`；而 `request-call-chain.md:317`、`:318` 仍是小写 `all-reduce`。`wiki/TERMS.md:104` 的备注允许正文写 All-Reduce，所以不算违规，但**两页之间仍不一致**，P3-3 这条要用户拍板的事项依旧悬着，记录的措辞会让下一个人以为本页是小写。
2. **`AsyncScheduler` 重写方法数（request-call-chain `:152`，P3 级）。** 页面写「只重写了两个方法」，实际还有一个只做记账的 `__init__`（`vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L13-L17`）。不影响认栈结论，改成「行为上只重写两个方法」即可。
3. **MC2 容量公式在 concurrent-requests 又出现一次（`:405`，观察项）。** 「让 prefill 步也留在 MC2 上」那条写了 `min(ceil(8192 ÷ 8), 512) × 8 = 4096`，是 128 那条推导换了输入的同一个公式。算式本身与 `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L217` 一致（`min(ceil(max_num_tokens/tp), 512) × tp`），结论也对；但按「同一个推导只在一页写」的口径，这里更稳妥的写法是只给结论「打开后门槛升到 4096，6048 仍然超过」并链回 one-request。
4. **`:348` 的比值比底稿粗（concurrent-requests，观察项）。** 底稿 02 §8.5 定的是 ≈ 113×，页面写「超过 110 倍」。不冲突，但两处口径可以统一成 113×。

单一出处三项复核（除上面第 3 条外均通过）：

- KV 预算与 3,855：两页都没有重新推导。concurrent-requests `:211` 只写结论并链到 two-node 的对应 H2，`:226`、`:420` 只把 3,855 当算例数字用（`:420` 已标 `[A]`）；request-call-chain 全页不出现 3,855 ✓
- 图尺寸补齐与两组对齐：推导只在 concurrent-requests `:251-299`；request-call-chain 只提函数名（`:190` `_determine_batch_execution_and_padding`、`:220` 表格里的结论），没有表和算式 ✓
- 调用链：只在 request-call-chain；concurrent-requests 的「源码位置」表只给「想核对的事 → 读哪个文件哪几行」，没有函数串 ✓

## 四、残留旧数字（41.4 MiB / 151×）

`wiki/concepts/` 下 **零残留**；`docs/mainline/` 下 6 处，全在记录性文档里：

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `docs/mainline/02-forward.md:1040` | §12 修订表 P1-3 行：「42 层 **41.4 MiB**，比值 **151×**」 | 可保留。`:1085` 的第四轮修订行已明确作废它：「§12 表中 P1-3 那一行的 41.4 MiB / 151× 是当时的记录，以本行为准」 |
| `docs/mainline/review/02-review.md:41` | 「42 层 = 42,344 KiB = **41.4 MiB**；6.09 GiB / 41.4 MiB = **151×**」 | **需补注**。这份旧审查报告全文没有作废说明，单独读会把 41.4 / 151 当成应当改成的正确值 |
| `docs/mainline/review/02-review.md:43` | 建议改法「40.4 MiB → 41.4 MiB，154× → 151×」 | 同上 |
| `docs/mainline/review/02-review.md:103` | 「前文刚说 154×（修正后 151×）」 | 同上 |
| `docs/mainline/review/02-review.md:131` | 「纯 decode 42 层｜40.4 MiB｜应为 **41.4 MiB**」 | 同上 |
| `docs/mainline/review/02-review.md:132` | 「比值｜154 ×｜修正后 **151 ×**」 | 同上 |

建议（未执行，本轮不改文件）：在 `docs/mainline/review/02-review.md` 顶部加一行「§8.5 的 41.4 MiB / 151× 已被 `02-forward.md` §12.3 作废，现行口径是 ≤ 55.1 MiB / ≈ 113×」。

新数字落地情况：`concurrent-requests.md:345`（42 层 ≈ 55.1 MiB、跨 EP16 约 31.5 MiB）、`:348`（超过 110 倍、跨机约 135 倍）、`:418`（约 55.1 MiB）与底稿 `02-forward.md:893`、`:903-905` 一致 ✓

## 五、本轮没覆盖的

- 没有在浏览器里打开渲染后的页面，图的实际排版没看
- frontmatter 里其余未被角标指到的 sources（request-call-chain 侧）没有逐条读源码确认范围
- `concurrent-requests.md` 是未跟踪文件，无法用 diff 证明修订前后的差别，上面的「已改」都是按当前文件内容与修订记录描述逐条比对得出的
- 没读 HANDBOOK.md 与 docs/plans/
