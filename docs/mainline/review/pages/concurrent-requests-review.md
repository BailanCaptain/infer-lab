# 审查：wiki/concepts/concurrent-requests.md（多条请求）

- 审查对象：`wiki/concepts/concurrent-requests.md`（444 行，工作树未跟踪的新文件，`git status` 显示 `??`）
- 对照底稿：`docs/mainline/01-deploy-entry-schedule.md`（B1–B3）、`03-sample-decode.md`（B4）、`02-forward.md`（B5），只用 grep 定位后读命中段落
- 对照页面：`wiki/concepts/one-request.md`、`wiki/concepts/glm-5-3-flash-two-node.md`（只读标题与相关小节）
- 源码：`git -C tools/repos/vllm show 0fc695fc:<path>`、`git -C tools/repos/vllm-ascend show db701c1f:<path>`，逐段用 grep 过滤后读
- 实际运行：`npx tsx scripts/wiki-lint.ts`（本页无任何告警，全仓 23 处待留意都在别的页）；`npx tsx scripts/wiki-diagrams.ts --check`（`ok wiki:diagrams 140 张图与 spec 一致`，本页 4 张图无告警）
- 没做的：没有在浏览器里渲染本页；没有读 HANDBOOK.md 和 docs/plans/。本轮没有读取被安全分类器拦截，但有一次读源码的长段输出被中断，之后改为「只 grep 过滤后的几行」，结论不受影响。

## 一、10 项评分

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 开头让初学者明白这一页讲什么 | 2 | 第 62 行用「一条请求走完七站时服务里只有它一条，真实服务上同一时刻有几十条」切入，当场把 prefill、decode、KV 块都用括号解释了；第 66–74 行的七站对照表一眼能看出每站多出来什么；第 76 行点明这套做法叫 continuous batching。 |
| 2 | 和 one-request 的关系：每站哪里不同 | 1 | 七站对照表 + 正文逐站展开，覆盖完整，衔接也顺（第 3 站直接复用 R1 的形状规则，第 5–7 站指回 one-request 第 6 站）。扣分在第 80 行把部署前提写错了：「8 张卡加上 EngineCore……**放着一份完整的模型**」，这正是约束里点名不能出现的说法，而且和本页第 290 行自相矛盾（见 P1-1）。 |
| 3 | 数字能否复核 | 2 | 正文约 90 个数逐个重算，并与 01 的 B1–B3、03 的 B4、02 的 B5 对齐：8192/32/4、8144、8068、6048、48+6000、20,000 token 的 8144/8144/3712、552/24/3,279 块、3,456/399/7,980、121 块 ≈ 964 MiB、77,440、9 步、216 倍、47.25/6.64/148.4 MiB、6.09 GiB、4.15 GiB、96,768/336/6,048、12.5%/43.8%/25%/18.8%、189 MiB、1512 倍，全部对得上。唯一与底稿不一致的是 MC2 那一档（55.1 vs 41.4 MiB），核下来**页面对、底稿错**（见第三节）。3,855 与 3,908 的口径三页一致。 |
| 4 | 图有没有用 | 2 | 4 张图都在讲机制：`concurrent-request-rounds` 把「哪一步谁在算 + 执行宽度 + 通信方式」压到一张时间线上，是本页最有用的一张；`concurrent-request-inputs` 画出 6048 行的归属和各自的历史；`concurrent-request-dp-align` 用实色/斜纹区分真实与填充；`concurrent-request-moe-switch` 把一层 MoE 的搬运量画成同比例条。小问题见 P3-5、P3-6。 |
| 5 | 沿场景 M / M′ 推演能不能跟上 | 1 | 主线是连续的（选组 → 分预算 → 拼张量 → 分块 → 补齐 → 通信 → 拆结果），每一步都给了算式。卡住的地方有三处：两层补齐挤在同一节（P2-3）；KV 块公式里的 `+12`、`+2` 没有交代「缓存组」是什么（P2-4）；MC2 那段「每卡最多 8 行」没写出 64 ÷ 8 的来历（P3-7）。 |
| 6 | `## 对照源码` 引用准确性 | 2 | 抽查 29 处，全部命中，无一处错位：serving.py 398–411（`_get_data_parallel_rank`，头名 `X-data-parallel-rank`，非整数走 `except ValueError: return None`）、input_processor 259–267（报错原文 `data_parallel_rank {r} is out of range [0, {n}).`）、core_client 1398–1426（`score = waiting * 4 + running`）、scheduler 342–351（注释原文「There's no "decoding phase" nor "prefill phase"」）、403–416、459–509（PRIORITY 走 `max(...)`、默认分支 `self.running.pop()`，和页面「取末尾一条」一致）、562–570、684–700、974–995（`free` → `num_computed_tokens = 0` → `num_preemptions += 1`）、config/scheduler 70–86（`long_prefill_token_threshold: int = 0`）、kv_cache_manager 385–398、model_runner_v1 652–656/692–740/830–868/1018–1040/1262–1306/2898–2996/3405–3452/3640–3652、glm5_next 1817–1864（`recurrent_state[zero_idx] = 0`）、llm_base_proposer 895–906、ascend_forward_context 90–101/200–282、prepare_finalize 440–495/543–560、ascend_config 160–166（`enable_prefill_mc2` 在第 165 行，落在范围内）/315–317、envs 103–105、worker.py 972–973。 |
| 7 | 常见误解 | 2 | 8 条，每条都是这套部署下真会想错的点（阶段分批、选更闲的组、6000 一定要切、混 prefill 就翻 all-gather、DP1 很轻、空闲组能歇、抢占只是暂停、补齐只浪费一点点），而且每条都用本页自己的数字纠正。 |
| 8 | 术语 | 1 | 首次出现给解释的比例很高：prefill/decode/KV 块（62）、continuous batching（76）、DP 组/EngineCore/MTP/TP8/EP16（80）、scheduler（122）、chunked prefill（148）、model runner（171）、positions/query_start_loc（187–188）、block table（203）、prefix caching（206）、preemption（235）、graph mode（250）、eager（262）、dispatch/combine（290）、MC2/all-gather/reduce-scatter（294–295）、dummy batch（350）、logits（365）、mHC/all-reduce（195）、KDA/稀疏 MLA（197）。扣分项：DP（68）、MoE（71）先用后解释；DP2（320、321、323、361）全页从未解释；集合通信写法与另两页不一致（P3-3）。代码名与类名的写法合规（`PREEMPTED`、`ValueError`、`assert` 都在行内代码里，EngineCore/MoE/MC2 保持原样）。 |
| 9 | 免责句占比 < 3% | 2 | 脚本统计（去 frontmatter、去代码块、去表格行，按「。！？」分句）：3 / 217 = **1.38%**。三句分别在第 146、348、402 行，都是必要说明，不是托词。 |
| 10 | 玩具规模例子 / 术语先用后解释 | 1 | 玩具规模已经清干净：全页找不到「6 token / 2 请求」，场景 M 用的是 12 + 1 条、6000 token 提示词、20,000 个历史位置，维度和上限都是真实值。扣分仍在先用后解释（同第 8 项）以及「45 层主干 / 42 个 MoE 层 / 34 层 KDA + 11 层 MLA」三个层数口径混用却没有一句话串起来。 |
| | **总分** | **16 / 20** | |

## 二、结构与约束检查

| 约束 | 结果 |
|---|---|
| `## 对照源码` 之后没有 H2 | 通过。最后一个 H2 在第 388 行，其后只有 5 个 H3 |
| H3 只能是那五个且按序 | 通过。390 怎么开 → 398 会报什么错 → 405 开销和什么时候别开 → 413 版本差异 → 421 源码位置 |
| `## 对照源码` 以上没有证据角标 | 通过。28 处角标全部在第 394 行之后 |
| 角标 ≤ 30 处 | 通过。28 处 |
| [C] 占比 < 80% | 通过。C 21、D 5、A 1、I 1 → C 占 **75%** |
| 不得指向已合并页 id | 通过。9 个被禁 id 全无命中；页内 10 条 `.md` 链接（one-request ×4、glm-5-3-flash-two-node ×2、linear-attention、sparse-attention、eplb、pd-disaggregation）目标文件都存在 |
| 「每台机器是一个完整的模型副本」类说法 | **违规**，第 80 行，见 P1-1 |
| 跨页重复 | 两处，见 P2-1、P2-2 |
| lint / diagrams | `wiki:lint` 对本页零告警；`wiki:diagrams --check` 对本页零告警 |

frontmatter 的 37 条 `sources` 里有 10 条既没有角标也没有在「源码位置」表里露面（12 `scheduler.py#L761-781`、15 `glm5_next.py#L1726-1785`、17 `glm5_next.py#L1201-1232`、18 `cudagraph_dispatcher.py#L76-96`、25 `prepare_finalize.py#L543-560`、27 `worker.py#L972-973`、31 `model_runner_v1.py#L1080-1099`、32 `scheduler.py#L1695-1711`、33 `scheduler.py#L1888-1910`、37 `envs.py#L103-105`），见 P3-8。

## 三、底稿 02 §8.5 的 MC2 口径：页面对，底稿错

页面第 328–336 行按每卡 8 行算，得 42 层 ≈ **55.1 MiB**；底稿 `docs/mainline/02-forward.md:882-894` 按 `padded_num_tokens = ceil(48/8)×8 = 48`、每卡 6 行算，得 **41.4 MiB**。核到的证据链：

1. `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2914-L2967`：`_determine_batch_execution_and_padding` 先做本地补齐——`num_tokens_padded = self._pad_for_sequence_parallelism(num_tokens)`，再 `dispatch_cudagraph(...)`，然后 **`num_tokens_padded = batch_descriptor.num_tokens`**。纯 decode 的 48 个 token 在这里已经被抬到捕获尺寸 64。
2. 同文件 `#L2976-L2980`：`self._sync_metadata_across_dp(num_tokens=num_tokens_padded, ...)`——送进两组对齐的就是补齐后的 64，不是 48。
3. `vllm_ascend/ascend_forward_context.py#L185`：`forward_context.padded_num_tokens = math.ceil(max_tokens_across_dp / tp_world_size) * tp_world_size`，即 `ceil(64/8)×8 = 64`。
4. `vllm_ascend/ops/fused_moe/prepare_finalize.py#L276-L290`（`PrepareAndFinalizeWithMC2.prepare`）：先 `target_pad_length = _EXTRA_CTX.padded_num_tokens` 补齐，再 `torch.tensor_split(hidden_states, self.tp_size, dim=0)` 取本 rank 那一片 → 每卡 64 ÷ 8 = **8 行**。`enable_shared_expert_dp` 默认 False（`ascend_config.py#L114-L115`），不改变这个切法。

结论：**写手是对的**，底稿 02 §8.5 漏了「48 → 64 的图尺寸补齐」，41.4 MiB 应改为 55.1 MiB（dispatch 262,400 B + combine 524,288 B + finalize all-gather 65,536 B + 共享专家 all-reduce 524,288 B = 1,376,512 B/层，×42 = 55.13 MiB），跨 EP16 部分 31.5 MiB 也随之成立。页面后续由此导出的「涨超 110 倍」「跨机约 135 倍」都对。但底稿至今没改，单一真相源已经漂移，见 P2-5。

## 四、3,855 / 3,908 两个口径

- 本页只用算例口径 3,855（第 210、223、410 行），并在第 410 行标了 `[A]` 说明是算例、真值定下来要重算。
- `glm-5-3-flash-two-node.md:197-201` 是两个口径的定义处：按 21 GiB 取整得 3,855、按精确 20.58 GiB 得 3,908，差 1.4%，并声明「后面各章用的 3,855 都从这个数来」；`:99` 的单机/双机对比表用 3,908，因为整张表都声明用不取整的权重。
- `one-request.md:155` 用 3,855。
- 结论：**三页口径一致，没有互相矛盾**。

## 五、问题清单

**P1-1 / wiki/concepts/concurrent-requests.md:80 / 把「每台机器持有什么」写错，且与本页自相矛盾**
证据：第 80 行「两台机器各是一个 **DP 组**（data parallel 的执行组）：8 张卡加上管它们的那个 EngineCore 进程（跑调度器的引擎进程），**放着一份完整的模型**，有自己的调度器和自己的 KV 池」。同一页第 290 行写「GLM 的 42 个 MoE 层各有 288 个路由专家……EP16 把专家分到两台机器的 16 张卡上，每卡 18 个」，第 348 行还说「DP0 的 token 在 42 个 MoE 层里都要把一部分送到 node1 的 8 张卡上算」。`glm-5-3-flash-two-node.md:107/119-121` 同样写明 EP16 跨两机切专家。
建议改法：「两台机器各是一个 **DP 组**（data parallel 的执行组）：8 张卡加上管它们的那个 EngineCore 进程，各自调度、各自一个 KV 池；但权重不是一台一份——288 个路由专家按 EP16 切在 16 张卡上，每卡 18 个，两台合起来才是完整的一份，所以两组每一步都要一起做 MoE 通信。」这样也给后面「为什么非对齐不可」和「空闲组陪跑」提前埋好因果。

**P2-1 / concurrent-requests.md:210 / KV 池推导的指向不对（跨页约束）**
证据：第 210 行「每张卡上按算例有 3,855 个块号（怎么算出来的见[一条请求](one-request.md)第 2 站，真实值要看启动日志）」。但 3,855 的推导在 `glm-5-3-flash-two-node.md:168-201`「剩下的显存变成多少 KV cache」；`one-request.md:155` 自己也只是引用，并把读者再转给 two-node。
建议改法：直接链到 `glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache`，one-request 的链接留给「一条请求要占几个块号」那一段。

**P2-2 / concurrent-requests.md:300-304 / MC2 容量 128 的推导与 one-request 重复**
证据：本页第 300–304 行给出 `容量 = min(ceil(最大图尺寸 ÷ TP), 512) × TP = 128`；`one-request.md:352-359` 已经推过一遍「每卡每次最多 ceil(128 ÷ 8) = 16 个 token，TP8 共 16 × 8 = 128，判断用的是两台机器里较大的那个 token 数」。两处结论一致，但同一段推导写了两遍，正是上一批出问题的形态（数字一旦有人改就会分叉）。
建议改法：二选一保留推导（建议留在本页，因为「取两组最大值」是本页的主题），另一页只写结论并链过来。

**P2-3 / concurrent-requests.md:248-284 / 两层补齐挤在一节，初学者读不出 64 和 6048 各自的来历**
证据：同一节里先讲「补到录好的图尺寸」（表：28→32、48→64），紧接着讲「再和另一组对齐」（表：DP1 真实 28 → 本地 32 → 同步后 64 / 6048），中间还插进「能回放图的五条判据」和「草拟宽度不补图尺寸但补到两组最大值」。第 275 行「28 → 32，能用图」与第 277 行「64（28 行真实）」之间少了一句「32 是自己的图尺寸，64 是两组的最大值」。
建议改法：把这一节拆成两个小标题（「先补到自己的图尺寸」「再补到两组的最大值」），并在第二张表加一行「这一步的宽度是谁定的」，明确 64 来自 DP0 的 48→64、6048 来自 DP0 的混合步。

**P2-4 / concurrent-requests.md:212-216 / KV 块公式里的 `+12`、`+2` 没有来历**
证据：第 213–215 行的公式直接写「+ 12 ← KDA 的卷积与递推状态，3 组各 4 块」「+ 2 ← 索引器状态组，固定 2 块」，但「缓存组」这个词在本页要到第 235 行讲抢占时才第一次出现，且始终没有解释。初学者无法判断这 14 块是哪来的，而后面 46、24、108、121 块全部依赖它。
建议改法：公式下面补一句白话（「GLM 把 45 层按存储格式分成几个缓存组，KDA 那几组每条请求各要一块当前状态加 3 块草稿位置，索引器状态组固定 2 块，合起来 14 块，和序列多长无关」），并链到 `glm-5-3-flash-two-node.md` 对应段。

**P2-5 / 跨文件（页面 328-336 对 docs/mainline/02-forward.md:882-894）/ 页面自行纠正了底稿但没有留痕，底稿也没改**
证据：见第三节。页面按 55.1 MiB 写，底稿仍是 41.4 MiB，两处都没有互相说明。按「单一真相源」，后面任何人对照底稿都会以为页面算错。
建议改法：优先修底稿 02 §8.5（把 48 改成 64、6 行改成 8 行、41.4 MiB 改成 55.1 MiB，并在修订记录里记一笔）；在底稿改完之前，页面「开销和什么时候别开」那条 55.1 MiB 后面加一句注明口径（「按图尺寸补齐后的 64 行算；底稿 02 §8.5 的 41.4 MiB 漏了这次补齐」）。

**P3-1 / concurrent-requests.md:68、71 / DP、MoE 先用后解释**
证据：第 68 行表格「先在两个 DP 组之间挑一个」、第 71 行「MoE 通信换一条更贵的路」，两个词的解释都在第 80 行。
建议改法：表格那两格改成「两台机器（两个执行组）」「专家层的跨机通信」，把术语留到第 80 行正式引入。

**P3-2 / concurrent-requests.md:320、321、323、361 / DP2 全页未解释**
证据：四处写「DP2 all-gather」「DP2 reduce-scatter」「DP2 部署」，页面其余地方一直叫「两组」「DP 组」，DP2 这个写法没有定义。
建议改法：统一成「两组之间的 all-gather」，或在第 80 行补一句「本页把 `--data-parallel-size 2` 的这套部署简称 DP2」。

**P3-3 / 全页 / 集合通信写法与另两页不一致（并与审查任务书的规则冲突，需用户拍板）**
证据：本页用小写 `all-reduce`、`all-gather`、`reduce-scatter`、`all-to-all`；`wiki/TERMS.md:104-107` 的「统一叫法」列正是小写，大写形式列在「别的叫法（收进 aliases）」，所以**本页符合 TERMS**。但 `glm-5-3-flash-two-node.md:119-121` 写成 All-Reduce / All-Gather，`one-request.md:352` 写成 AllGather，三页三种写法。本轮审查任务书要求写成 All-Reduce / All-Gather / All-to-All，与 TERMS.md 相反。
建议改法：以 TERMS.md 为准统一到小写，同时改 two-node 与 one-request；若要改成大写，先改 TERMS.md 再全仓刷一遍。这条请用户拍板，不要在单页上各改各的。

**P3-4 / concurrent-requests.md:268 与 438 行 / 「草拟不补到图尺寸」的引用没盖住前提**
证据：第 268 行「草拟模型（MTP 层）不补到图尺寸，但一律补到两组的最大值」，源码位置表指向 `llm_base_proposer.py` 895–906 行。该段实际写的是 `if self.use_cuda_graph: ... num_input_tokens = batch_descriptor.num_tokens; else: num_input_tokens = num_tokens`，随后才 `_sync_metadata_across_dp(..., is_draft_model=True)`。也就是说「不补到图尺寸」成立的前提是 GLM 的草稿层被强制关掉图（`one-request.md:435` 有这个结论），而这个前提没有引用。
建议改法：在「版本差异」或该表行补一条指向「GLM + 投机解码强制 eager」的源码位置。

**P3-5 / wiki/diagrams/concurrent-request-dp-align.yaml / 一张图里两个比例尺相差 95 倍**
证据：上半 `scale: 9`（每 token 9 px），下半 `scale: 0.095`，caption 已声明「两半比例不同」。但视觉上第 1 步的 64 宽条和第 2 步的 6048 宽条一样长，读者容易把「DP1 补 32」和「DP1 补 6020」当成同量级。
建议改法：在下半条形上方加一个「同比例时这里会有 94 屏宽」之类的提示文字，或给下半加一个缩略标尺。

**P3-6 / wiki/diagrams/concurrent-request-rounds.yaml / 时间轴单位写成「步完成」**
证据：`unit: 步完成`，刻度 0/1/2/3。配合 caption 的「列宽不代表耗时」尚可懂，但「步完成」本身不是一个量纲。
建议改法：改成「步」，刻度标 1/2/3。

**P3-7 / concurrent-requests.md:328 / 「每卡最多 8 行」缺一步算式**
证据：第 328 行「两组都回放 64 的图，MoE 里按 TP8 沿 token 维切开，每卡最多 8 行」，8 = 64 ÷ 8 没写出来，而下面四条算式全靠这个 8。
建议改法：写成「每卡最多 64 ÷ 8 = 8 行」。

**P3-8 / concurrent-requests.md frontmatter:10-46 / 10 条 sources 无人引用**
证据：见第二节末尾的清单，其中 `worker.py#L972-973`（空批次是 4 个 token）和 `envs.py#L103-105`（balance scheduling）其实支撑着正文第 350 行与第 418 行的结论，只是没挂上。
建议改法：把这两条挂到对应结论或源码位置表上，其余无用的删掉。

**P3-9 / concurrent-requests.md:326 / 「16 张卡合计约 66 GiB」的口径没说清**
证据：第 326 行由每卡 4.15 GiB × 16 得 66 GiB。这是 16 张卡各自收发载荷之和，不等于两台机器之间链路上的实际字节数（同一份数据在收发两端都被计了一次）。
建议改法：写成「16 张卡各自的跨机载荷加起来约 66 GiB（同一份数据在收、发两端各算一次）」。

**P3-10 / concurrent-requests.md:197、290、354 / 层数口径混用**
证据：第 197 行「GLM 的 45 层里有两种要读历史的层：34 层 KDA……11 层稀疏 MLA」，第 290 行「42 个 MoE 层」，第 354 行「45 层主干」。三个数都对，但页面没说 42 是 45 层里除掉前 3 层稠密 MLP 之后的部分。
建议改法：第 197 行补半句「其中前 3 层的前馈是稠密的，其余 42 层是 MoE」。

## 六、以初学者身份读下来，最卡住的三个地方

1. **第 248–284 行：两次补齐。** 读到「28 → 32」刚明白图尺寸补齐，下一张表里同一个 DP1 又变成 64 和 6048，三个宽度混在一起，很难分清哪个是「自己要的」、哪个是「被别人拖的」。这一节是全页最重要的因果（它解释了后面 MoE 为什么翻路径、空闲组为什么陪跑），却是最难读的一节。
2. **第 212–224 行：KV 块公式里的 14。** `+12`、`+2` 像是凭空出现的常数，「缓存组」「3 组各 4 块」都没解释，而后面 46 块、24 块、121 块、964 MiB 全建立在它上面，跟不上的读者只能选择相信。
3. **第 328–338 行：MC2 那一档的四条算式。** 「每卡最多 8 行」没给 64 ÷ 8，4,100 B 和 8,192 B 两个单价也是直接引用 one-request 的口径，再加上「这是上界，MC2 另用掩码标出真实行」，初学者很难判断这 55.1 MiB 到底算的是真实数据还是填充。而它正是和 6.09 GiB 对比的基准。

## 七、本轮没覆盖的

- 没有在浏览器里打开渲染后的页面，图的实际排版（尤其 `concurrent-request-dp-align` 的 6 条并排条）没看过。
- `wiki/diagrams/*.svg` 只核了 spec 与 SVG 一致（脚本 `--check` 通过），没有逐张看图。
- frontmatter 里那 10 条无人引用的 sources 没有逐条读源码确认范围是否正确。
- 没有读 HANDBOOK.md 与 docs/plans/（按本轮纪律）。

## 八、修订记录（2026-09-27，写手按本报告与协调者指示修订）

| 条目 | 处理 | 说明 |
|---|---|---|
| P1-1 | 已改 | 场景一节改为「各自调度、各自一个 KV 池；注意力和稠密层每台一份按 TP8 切，288 个路由专家按 EP16 切在 16 张卡上，两台合起来才是完整的一份模型」，并点明这是两组对齐与陪跑的根源。全页 grep「完整」「副本」，其余 5 处都指数据拷贝或完整前向，未改。 |
| P2-1 | 已改 | 3,855 只保留结论，链接改为 `glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache`。 |
| P2-2 | 已改（按协调者口径） | MC2 容量 128 的推导删去，本页只写结论与「两组最大值」，链到 one-request 第 4 站「42 层 MoE」。 |
| P2-3 | 已改 | 拆成「先补到自己这组的图尺寸」「再补到两组的最大值」两个小标题；新增 28 / 32 / 64 / 6048 四个宽度的来历表（出现在哪、为什么、由谁决定），三步表加一行「这个宽度由谁定」。 |
| P2-4 | 已改 | 公式前先解释缓存组（5 组：full、索引器状态、3 个 KDA 组），逐项写 `+12`（3 组 × 4 块：当前状态 1 + 草稿 3）和 `+2`（索引器状态组，滑动窗口）；加待核：索引器状态组稳态占 1 块还是 2 块。 |
| P2-5 | 已改底稿 | 02 §8.5 改为补齐后 64 行、每卡 8 行：≤ 55.1 MiB、跨机 ≤ 31.5 MiB、≈ 113×、跨机 ≈ 135×；02 §12.3 记一笔。页面数字原本就是这一口径，未改。one-request、two-node 均无 41.4 或 151× 的引用。 |
| P3-1 | 已改 | 七站表两格改为「两台机器（两个执行组）」「专家层的跨机通信」。 |
| P3-2 | 已改 | 第 80 行定义 DP2 为 `--data-parallel-size 2` 的这套部署；MoE 表里的「DP2 all-gather / reduce-scatter」改为「两组之间的……」。 |
| P3-3 | 已改 | 按协调者定下的规则，正文（含 summary）统一为 All-Reduce、All-Gather、Reduce-Scatter、All-to-All，共 29 处；代码块、行内代码、链接和图内文字未动。 |
| P3-4 | 已改 | 正文写明「GLM 上草拟层被强制走 eager」；sources 与源码位置表新增 `llm_base_proposer.py#L217-L236`。 |
| P3-5 | 已改 | dp-align 下半标题改为「同比例要宽 94 倍」。 |
| P3-6 | 已改 | rounds 时间轴单位改为「步」。 |
| P3-7 | 已改 | 写成「每卡最多 64 ÷ 8 = 8 行」。 |
| P3-8 | 已改 | 10 条未露面的 sources 全部挂到源码位置表或版本差异（表中新增 7 行、并入已有行 2 处，版本差异 1 处），不增角标；角标仍 28 处、C 占 75%。 |
| P3-9 | 已改 | 改为「按每张卡收到的量算，每个方向约 33.2 GiB，链路合计约 66 GiB」。 |
| P3-10 | 已改 | 第 3 站补「前 3 层是稠密 MLP，其余 42 层是 MoE」；缓存组一句写明「主干 45 层加 MTP 层」。 |

验证：`pnpm wiki:lint` 通过（本页零告警）、`pnpm check:content` 通过、`pnpm wiki:diagrams --check` 通过（140 张图一致）。
