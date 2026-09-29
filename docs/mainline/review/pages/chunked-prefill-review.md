# chunked-prefill 审查记录

## P5 写作记录（2026-09-29，第 11 批深改，Opus 写手）

**改了什么。** 现版（= p4-checkpoint，正文 1347 字符，教学正文 942 字，无对照源码、免责 16.7%）重写为九节：一条很长的提示词能不能分几步算完（定义 + 直觉图）→ 为什么要切 → 代价在哪 → 怎么切（示意数减法 + 代码流程图）→ 历史状态必须跨段延续（保留原标题，prefill、linear-attention 两页有入链）→ 细节（切点、单条上限、关掉分块、其他影响因素、昇腾变体）→ GLM 双机 20,000 token 例子 → 常见误解 → 对照源码（五个 H3）。改后正文 13,635 字符，教学正文 4,389 字。

**图。**
- `wiki/diagrams/chunked-prefill.yaml`（重画）：上半是 C 的 14 个提示词位置，下括号标出第 1/2/3 步各算哪几格，末格箭头到 y₀；下半是四步的预算条（容量框 8），每条里 A、B 各 1 格、C 一段，右侧写本步算哪几格、读到哪、采样丢还是出 y₀。示意数：预算 8，A/B decode 各 1，C 14 → 6/6/2，第 4 步 C 转 decode。
- `wiki/diagrams/chunked-prefill-flow.yaml`（新增，代码流程图兼站点位置）：第 2 站调度 min(还差, 剩余预算)（旁支：关分块且超余量 → 停止接纳）→ 已算数前推 → 第 3 站准备输入（位置号 = 已算 + 序号，格号查块表；旁支执行标签 ChunkedPrefill）→ 第 4 站前向（读已存历史、写本段）→ 第 5 站采样 → 判断提示词算完没有：否 → 丢弃并虚线回到调度；是 → 首 token 转 decode。对应本批验收「输入边界、块槽位与执行后端衔接可顺图复述」；A3 元数据细节只链接 prepare-inputs-flow，不在本页展开。

**数字与出处。**
- 基础节全部用示意数（预算 8、C 14 个位置），不含 GLM 数字。
- GLM 节：预算 8192 / 32 条 / decode 每步 4 个取自底稿 01 §A2.1、§B2「做了什么」，页面只写结论并链接 vllm-scheduler；门槛 8068 与 20,000 → 8144/8144/3712 取自 01 §B2「场景 M 的一步」「一个会被切开的例子」，逐步预算账只链接 concurrent-requests（单一出处），不重算。
- 每步借块 calc（full 组 13/+13/+6，尾状态组 2,037 → 2,038 → 930，第 4 步回 3，KDA 12 块）取自 01 §B2「一个会被切开的例子」及 §A2.2 尾状态组公式；逐项手算复核一致。全站此前没有页面写过这组数，本页为唯一出处。7.969 MiB/块、3,855 块（算例）链接部署页。
- 8144 = 12 × 640 + 464（切点落在第 13 块第 465 格）为本页推导 [D]。

**核心概念对照了什么。**
- 概念定义与动机：vLLM 优化文档 `docs/configuration/optimization.md#L41-L62`（@0fc695fc，decode 优先、剩余预算给 prefill、装不下自动切；ITL 与利用率两条好处；小预算利 ITL、大预算利 TTFT）；SARATHI 论文 arXiv:2308.16369（chunked prefills + 让 decode 搭车同批），外链未联网核对，只放页末来源。
- 调度：`scheduler.py` #L340-L352 无阶段注释、#L401-L410 running 截断、#L678-L700 waiting 截断与关分块 break、#L997-L1019 前推与 is_prefill_chunk、#L259-L263 与 #L293-L330 align 切分；`config/scheduler.py` 字段默认（threshold 0、enable True）、启动日志、verify_max_model_len；`arg_utils.py` 默认值来源、警告、partial prefill 报错、关分块时自动抬预算；`config/model.py#L1803-L1810`。
- 执行侧（db701c1f）：`model_runner_v1.py` #L858-L867 位置号、#L1078-L1099 丢弃 mask、#L1444-L1470 执行标签、#L2631-L2636 随机数回拨；`kimi_kda.py#L398-L474` 初始/最终状态；`indexer_kpool_mla_v1.py#L477-L498` KV 长度取 seq_lens、清单宽度；GLM 对齐补丁 `patch_glm5_next_mamba_scheduler.py#L9-L57`；`utils.py#L1396-L1433` refresh_block_size。
- 版本：v0.23 Ascend `2c59ff10` 与 `db701c1f` 的 SLO 顺手开分块；v0.26 vLLM `568afb3a` 新增 throttle_prefills（prefill_schedule_interval 默认 1）；main vLLM `84030bbe` waiting 截断多了 input_budget − draft_slots，`speculative.py#L1811-L1850` 证实 MTP 预留 0；Ascend `2ed6cbba`/`baa023ad` 执行标签与丢弃判据不变；main batch_invariance.md#L186-L188 新增关分块要求。
- 附带结论：底稿 01 §B2「待核 1」（long_prefill_token_threshold 默认值）已由 `config/scheduler.py#L80` 核实为 0（v0.26/main 为 `Field(default=0, ge=0)`），本页按「不截」写；底稿未改。

**不丢信息勾选。** 旧版信息清单（p4-checkpoint 现版 A1–A13；p4 改写前最后一版 c60c4fa 的 Qwen 教学版 B1–B25）与逐条勾选见会话 scratchpad `p5/chunked-prefill-facts.md`。A1–A13 全部落地（A4 示意数换成更贴近机制的 8/14 例）。B 组：Qwen3.6 的 6037/2048/10 KiB 账不属当前 GLM 主线，换成 01 §B2 的 GLM 例子；「MLA 每 chunk 重过 kv_b_proj」「_get_fia_params / npu_fused_infer_attention_score」属普通注意力或普通 MLA 路径，GLM 不走，删；官方设计文档混合批次例子由本页示意图替代；其余（默认开、关掉后 break 与报错、单条上限的文档与代码不一致、只能手写、align 取整、refresh_block_size 改 128、丢弃采样、不省计算、batch invariance、不等于 PD 分离、v0.23 SLO 顺手开）全部保留并重核。

**自查统计。** 首图前无 calc、无 GLM 数字；calc 5 个，每节 ≤1，表与 calc 不相邻；对照源码之上 0 角标，全页角标 30（C 22、S 3、D 3、! 2）；教学正文行内代码 0/千字；免责 1.4%；两图宽 880。

**验证。** `pnpm wiki:diagrams`（两图生成，无本页警告）；`pnpm wiki:diagrams --check`、`pnpm wiki:lint`、`pnpm wiki:audit` 本页 0 报错（整体失败来自 engine-core-loop.svg、prepare-inputs-flow、vllm-v1-shape、kv-cache-quantization、vllm-engine-core 等别页）；audit 本页 31 条来源行号全部定位，arXiv 外链未联网；按写作标准手动检查（scratchpad `p5/check-any.mts`）PASS。未截图、未起服务，浏览器验收留给审查。

**疑点 / 待核。** ① 启动日志「Chunked prefill is enabled with max_num_batched_tokens=8192.」缺实机确认；② 分块与预算对 GLM 双机 TTFT/ITL 无实测数；③ 稀疏 MLA 一句「indexer 给因果范围内的历史打分」按 sparse-attention 页转述（只给完整池打分），细节以该页为准。

**跳过了什么。** 未读 HANDBOOK、docs/plans/、codex-p5-common.md；两份任务说明外只读了 basics-standard.md 的总原则与第 11–14 条；页面现版与旧版均按 awk 去 frontmatter 读取，未读 sources 区原文（改 sources 时整段重写，只用 sed 看了行首 140 字符的路径）。

## P5 审查（09-29）

独立审查员（Opus 5.5），只审不改。页面按 awk 去掉 frontmatter 后分段读 L52–L198；「对照源码」（L199–L257）只用 grep 核对结构和个别关键词。

**分数：8.5 / 10。** P1 0 条，P2 0 条，P3 8 条。

**学习顺序：通过。** 各 H2 依次是：是什么（问题式 H2 + 一句话定义 + 示意例子 + 直觉图，L53–L68）→ 为什么（L70）→ 代价（L89）→ 怎么切（示意数 min 演算 + 流程图，L111）→ 跨段延续（L138）→ 细节（L148）→ GLM 双机（L156）→ 常见误解（L188）→ 对照源码（L199）。grep 结果：L52–L155 没有 8192、640、GLM、KDA、MTP；GLM 数字全在 L156 之后。首图之前没有 calc。

**初学者测试（只读前两屏）。** chunked prefill 指的是：一条提示词在这一步装不下时，调度器先照顾正在 decode 的请求，把剩下的预算分给这条提示词的一段，下一步从断开的位置接着算，算到最后一段才出第一个 token。这样正在生成的请求每步都能照常前进；代价是长请求的首 token 更晚，旧历史要多读几遍，每一步还有些杂活。

**示意演算逐个手算（全部成立）。** 预算 8，A、B 各占 1，C 有 14 个位置：min(14,6)=6、min(8,6)=6、min(2,6)=2。三步分别算 8、8、4 个位置，第 4 步 A+B+C=3，每步都不超过 8。不切时一步 16 个位置。KV 读取 6+12+14=32，不切时 14；打分对数 1+…+14=105。假设单条上限设为 4，C 要分成 4/4/4/2 四步。

**核心概念对照（vLLM 0fc695fc，tools/repos/vllm）。**
- running 分支先用 long_prefill_token_threshold 截，再和预算取 min（scheduler.py L408–L410）；waiting 分支同样处理（L685–L700）。关掉分块且整段超出余量时，这里是 `break`，这一步不再接纳新请求（L692–L697）。页面 L85、L113、L151、L152 都写对了。
- 「已算」数在排完后、执行前就往前推，并记下 is_prefill_chunk（L997–L1019），与页面 L125 一致。
- 默认值 long_prefill_token_threshold=0、enable_chunked_prefill=True（config/scheduler.py L80、L84），与 L151、L190 一致。关分块且预算小于 max_model_len 时，verify_max_model_len 报 ValueError（L259–L271）；没有显式设预算时，arg_utils L2519–L2528 会自动把预算抬高；手动关分块会触发 crash/incorrect 警告（arg_utils L2382–L2391）。页面 L152 和「会报什么错」都对得上。
- 对齐切分只在 has_mamba_layers 且 mamba_cache_mode=="align" 时生效（scheduler.py L261–L263、L293–L327）。页面正文 L150 的写法略宽，见 P3-1。
- 执行侧（vllm-ascend db701c1f，model_runner_v1.py）：_build_attn_state 在开着分块时，给混合批和续算段都贴 ChunkedPrefill（L1444–L1463）；discard mask（L1078–L1099）和带种子时随机数生成器回拨 4（L2626–L2638）。与页面 L134、L146 一致。
- 核心概念没有发现错误。

**数字（对照底稿 01 §B2「一个会被切开的例子」L935–L953、§A2.2 L659–L680）。** 以下数字全部一致：8144/8144/3712；full 组 13/+13/+6；尾状态组 2,037→2,038→930（逐项重算 ceil/floor 都成立）；2,037×7.969 MiB≈15.9 GiB，约为 3,855 块池子的 52.8%；KDA 12 块；8144=12×640+464。这些数字的出处：8192/32 链接 vllm-scheduler；8068 和逐步预算账链接 concurrent-requests（该页 L161–L180 有 calc 和表），本页没有重算。借块 calc 全站只在本页出现（grep「2,037」只命中本页）。写手自报疑点 ③：indexer 实际是按 4 个位置一池打分，页面 L168 说成「给因果范围内的历史打分」，属于转述时简化，细节以 sparse-attention 页为准，不算错。

**丢信息核对。** HEAD = p4-checkpoint（md5 相同）。按旧版 5 个 H2 逐条对照，A1–A13 都已落到新版：A4 换了示意数；A7 里的「2048 示例」随例子一起去掉，合理；A9 的 GLM 补丁行为写在 L169 和源码位置表里。B 组勾选抽查了 B14、B18、B20、B21、B23，都能在正文或「对照源码」中 grep 到。kv_b_proj 和 _get_fia_params 两条删掉的理由（GLM 不走这两条路径）成立。没有发现丢信息。

**链接和锚点。** 全库指向本页的 3 条带锚点入链（kv-cache-quantization L137、linear-attention L210、prefill L251）都指向保留下来的「历史状态必须跨段延续」，能解析。`pnpm wiki:lint` 通过；本页不在待留意列表里，跨页锚点硬校验通过。

**audit 和图。** `pnpm wiki:audit` 通过，本页 31 条来源，没有报错。`pnpm wiki:diagrams --check` 显示 241 张图与 spec 一致，本页两张图都没有警告。与 prefill 页的 2048/6000 示意、vllm-scheduler 页「多条请求时」一节的口径（先扣 decode、余量给提示词；门槛 8068；切点不看块边界）都一致。

**浏览器（Playwright，1440×900，用户的预览 5193，没有起停服务）。** 截图都在派发会话 scratchpad：
- `chunked-prefill-review-first.png`（第一屏）：H1、摘要、问题式 H2、定义、示意例子都在第一屏，直觉图上半部分也露出来了。
- `chunked-prefill-review-fig1.png`（直觉图）：14 格编号、三段括号、四步预算条、右侧说明都清楚，没有重叠，第 3 步空出的 4 格一眼能看出来。
- `chunked-prefill-review-calc.png`（切块 min 演算）：清楚。
- `chunked-prefill-review-flow.png`（流程图）：第 2–5 站、执行标签、丢弃支路和虚线回环都清楚，没有重叠。能顺着这张图复述输入边界（位置号 = 已算数 + 序号）、块槽位（查块表）以及执行后端怎样接上，满足本批验收要点。

### P3
1. L150：「混合模型开了 prefix caching……向下取整到块大小整数倍」这句写得太宽。实际只有 mamba_cache_mode=align 才会这样（模型不支持逐块存状态的 all 模式时，开 prefix caching 才会落到 align，见 model_executor/models/config.py L352–L366）。改法：补半句「（落到 align 模式时；支持 all 模式的模型不需要对齐）」。
2. L181 calc 注：「前一项是补到的块数」容易被读成本步新借的块数（比如以为第 2 步借了 4,073 块）。实际前一项是累计借过的块数（包括已还的）。改法：写成「前一项是到这一步为止累计借过的块号数」。
3. L68：正文只讲了三步，接着就说「这 4 步里」，第 4 步没有交代，只能靠图说明。改法：在 L67 后补一句「第 4 步起 C 也每步 1 个」，或把 L68 改成「这几步里」。
4. L136 和 L146：「每条请求都在最后一个位置采样、没算完的丢掉」在相隔 10 行内说了两遍；加上 L67、L107、L192，全页一共出现 5 次。改法：L146 只保留「不追加、不返回、随机数回拨」这些新增信息，删掉重复的前半句。
5. L184：「第 4 步进入 decode 后回到 3 块」对第 4 步本身是对的，但底稿写的是之后在 3–4 块之间波动。改法：补成「回到 3 块（此后在 3–4 块之间）」。
6. L151：「每步给别的新请求留出 2 个位置」只对前三步成立，第 4 步留出 4 个。改法：写成「前三步各留出 2 个」。
7. L167、L168：GLM 节里 KDA、稀疏 MLA 第一次出现时没有解释，只靠链接。改法：第一次出现时各加一个括注，例如「KDA（GLM 的线性注意力层）」「稀疏 MLA（只挑部分历史读的注意力层）」。
8. 第一屏的摘要（frontmatter summary）里带了 8192、8144/8144/3712 这些 GLM 数字，和「第一屏不堆 GLM 数字」的讲法不太一致；L186 的「按源码和底稿推出来」用了读者不认识的内部词「底稿」。改法：摘要改成只讲机制和代价；L186 改成「按源码推出来的静态账」。

另外有一条不计分的建议：直觉图的四步预算条适合改成逐步播放（可以复用 exchanges 分镜播放器），一步一步亮起 C 的一段和 A、B 的格子；静态图已经满足本页的验收要求。

**跳过了什么。** frontmatter 的 sources 区；「对照源码」L199–L257 的正文，只 grep 了 H3、版本号和关键词；代码块和命令块；HANDBOOK、docs/plans/、TERMS.md。没有读取被拦的段落。

## P5 修订记录（09-29）

8 条 P3 全部照改，没有不改的。

1. **P3-1 对齐切分条件写得太宽。** 先核对了 `vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L370`：开 prefix caching 时，`mamba_cache_mode` 原来是 none 的，按模型是否支持 mamba prefix caching 改成 all 或 align；all 但模型不支持时退到 align。据此「细节」第一条改为：模型不支持逐块保存线性注意力状态、落到按块对齐存档的模式时才向下取整；支持逐块保存的模型不需要对齐。
2. **P3-2 借块 calc 的注。** 改为「前一项是到这一步为止累计借过的块号数（含已还的）」。
3. **P3-3 第 4 步没有交代。** 首节要点在「A、B 一步也没停」前补一条：第 4 步起 C 也转入 decode，每步 1 个位置。
4. **P3-4 丢弃采样重复。** 「历史状态」节末段删掉「每一步都在每条请求最后一个位置采样」的前半句，只留新增信息：丢弃针对哪些请求、不追加、不返回、随机数回拨。其余出现处分别是首节例子、代价、流程图步骤和误解，作用各不相同，保留。
5. **P3-5 尾状态组第 4 步之后的块数。** 改为「回到 3 块，此后在 3–4 块之间变动」，与底稿 01 §A2.2 一致。
6. **P3-6 单条上限示例。** 改为「前三步各给别的新请求留出 2 个位置」。
7. **P3-7 GLM 节的术语。** KDA、稀疏 MLA 第一次出现时各补一句解释：KDA 是 GLM 的线性注意力层，每条请求只存一份固定大小的状态；稀疏 MLA 是 GLM 的另一类注意力层，每个查询只挑一部分历史位置来读。
8. **P3-8 第一屏摘要和内部用词。** frontmatter summary 删去 8192、8144/8144/3712，只讲机制和代价；GLM 节末段「按源码和底稿推出来」改为「按源码推出来」。

不计分建议（四步预算条改成逐步播放）这次没做。exchanges 分镜是为「卡之间收发块」设计的零件，预算条的逐步亮起还没有对应的零件，要做就得改 `scripts/wiki/figure.ts` 或播放器，超出本页的改动范围。

**验证。** `pnpm wiki:lint`（exit 0，没有本页条目）、`pnpm wiki:diagrams --check`（exit 0，没有本页条目）、`pnpm wiki:audit`（exit 0，本页 31 条来源全部定位，arXiv 外链未联网核对）；另用 scratchpad 里的 `p5/check-any.mts` 按写作标准检查，结果 PASS（教学正文 4470 字，行内代码 0/千字，免责 1.4%）。修订只改了正文和 frontmatter 的 summary，两张图没动。
