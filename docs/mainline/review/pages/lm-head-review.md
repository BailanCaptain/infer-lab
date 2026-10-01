# lm-head 审查记录

## P5 写作记录（09-29）

**改了什么。** 新建页（P5 第 17 批，挂靠 A4-6），改前 0 字 → 改后教学正文约 4,330 字（`checkStandard` 口径），全页 12,788 字（audit 口径，含对照源码）。结构按 09-29 讲法：是什么（6 词示意词表 + 直觉图）→ 为什么需要、代价 → 怎么算（4 维 × 6 词，一个分数的点积）→ softmax 与采样 → 和 embedding 是否共享 → GLM 双机（从最后一层到 lm_head / 按词表切 8 段 / All-Gather / 算得少读得多 / MTP 共用 / 两个默认关的开关）→ 常见误解 8 条 → 对照源码五个 H3。另在 `wiki/concepts/embedding.md` L139 段末加了一句指向本页的链接（只改这一行）。

**四张图（都用本地 Playwright 把 SVG 渲成 PNG 自看过，scratchpad `lmh-*.png`；无溢出、无压字；没有新加 exchanges 分镜动图）。**
- `lm-head-intuition`（第一屏直觉图）：隐藏向量竖排 4 格 → 输出权重 4×6（每个词一列，「猫」列实色）→ 6 个分数 → 采样挑出「猫」。不放代码名，权重不标数。
- `lm-head-score`（怎么算）：h × 「猫」列 = 逐位乘积 → 加起来 2.1，下排 6 个分数。
- `lm-head-split`（GLM，队列指定的「最终向量经过按词表切开的输出权重再汇聚分数」）：同一批 [n, 4096] 发到卡 0 / 卡 1 / ⋯ / 卡 7，各存连续 19360 个词、各得 [n, 19360] 真值，All-Gather 按词编号拼成 8 段长条。借参考图库 xzclass-04（All-Gather 前后对照：各卡一段 → 每卡整条按顺序排好）与 amd-02（一整条带子被竖线切成 k/8）；按「不照搬」清单没用彩虹色和节点图，卡数用省略画法。
- `lm-head-flow`（代码流程图，兼站点位置）：最后一层 → 挑行 → Ascend 打分函数 → 细粒度输出头 TP？（默认 0）→ 本卡矩阵乘 → 采样归约？（默认关）→ TP8 All-Gather → 去补齐（空切）→ 采样；两条关着的分支虚线画在右侧。pins 指向 `model_runner_v1.py`、`ops/vocab_parallel_embedding.py`、上游 `logits_processor.py`、`utils.py`。

**数字出处。**
- 154880 / 4096 / tie_word_embeddings=false：模型配置（本机副本 `infra-view-hardware-study-20260906/glm-flow/reference/official-config.json` L20、L254、L259、L287；页面 sources 用 HF revision 690b7052）。
- 19360 行、padding 为空切、每卡 151.25 MiB、R1 prefill 38,720 → 309,760 B、decode 154,880 → 1,239,040 B、0.63 GFLOP：02 §7.1–7.3。每卡权重只引用并链接 D「每张卡上放了什么」，R1 字节只引用并链接 one-request「最终归一化与词表投影」，未重推。
- 本页唯一新推的是 §7.3「为什么 logits 这么贵」那条：2 × 4 × 4096 × 19360 = 634,388,480 次，÷ 158,597,120 B = 每字节 4 次（等于行数 n）。底稿写的「占每卡权重 0.73%」用 D 页两种合计都复现不出（151.25 / 21,078 = 0.72%，/ 20,537 = 0.74%），页面改写成「不到每卡权重（约 20.58 GiB）的 1%」。
- MoE 对照（每卡每层 432 MiB、R1 每卡期望 2 行）：只引用 one-request「42 层 MoE」。
- MTP 共用 lm_head、MTP 层 540.75 MiB 不含 151.25 MiB：02 §7.5、§7.6。
- lm_head 为 BF16：02 §0.4 标 [I]（量化描述文件本机没有，按原版 FP8 的 modules_to_not_convert 推断），页面照写「推断」。
- 示意数（h = [1.0, 0.5, −1.0, 2.0]、6 列权重、分数 [−0.4, −0.5, 0.2, 2.1, 0.8, 1.0]、softmax 52.3 / 17.4 / 14.3 / 16.0%）用 Python 复算过；softmax 的指数值保留 3 位小数，和 15.608 对得上。

**核心概念对照。**
- lm_head 是 [V, H] 存储、按转置相乘的线性层：`vllm@0fc695fc` `vocab_parallel_embedding.py` L510–L574（`ParallelLMHead` 继承 `VocabParallelEmbedding`；`tie_weights` 直接指向嵌入表；`forward` 故意抛错）。
- 按词表切 = 列切、各卡分数是真值、用 All-Gather 拼接：`logits_processor.py` L75–L104 + `platforms/interface.py` L858–L862（`use_all_gather` 默认 True，Ascend 全仓 grep 无覆写）；与 TP 页「词表：查表后相加，打分后拼接」一致。
- Ascend 路径：`db701c1f` `ops/vocab_parallel_embedding.py` L285–L341（`_get_logits_normal` / `_get_logits_lmheadtp`）、L64–L73（通信组选择）；`utils.py` L749–L750、L877–L878；`ascend_config.py` L318–L320、L570–L574。
- 只对选出的行打分：`model_runner_v1.py` L2326–L2327（上游 `gpu_model_runner.py` L4315–L4316 同形）。
- MTP 共用：`llm_base_proposer.py` L589–L596；草拟默认 `compute_logits` 后 argmax（L1260–L1299），打开采样归约才走 `greedy_sample` 分段取最大（L121–L136）；MTP 模型的 `compute_logits` 用同一个 `LogitsProcessor`（`glm5_next_mtp.py` L150、L175–L183）。
- 采样分流：`vllm@0fc695fc` `v1/sample/sampler.py` L243–L262；温度与 top-k/top-p 的描述与 03 §A5 第 5 条一致。
- 02 §7.6 待核第 1 条（`AscendParallelLMHead` 与上游差别）本轮逐行比了 L252–L283：只把父类构造换成 `AscendVocabParallelEmbedding.__init__`（按开关选 lmhead TP 组 / embed TP 组 / 默认 TP 组），bias 处理与上游相同。页面已按此写；底稿本身未改（不在本批范围）。

**版本差异核对。** v0.23 = 2c59ff10、v0.26 = 2ed6cbba 都没有 GLM 模型代码（`git ls-tree` 计数 0）；默认打分路径三版相同；v0.26 多 `_apply_head` 钩子；main 多 `skip_gather` 参数与「输出头未切时跳过 All-Gather」；`enable_reduce_sample` 的实验警告和两条 ValueError 只在 2c59ff10 与 baa023ad，`db701c1f` 与 2ed6cbba 没有；main 的 GLM MTP 模块新增 `get_top_tokens`（分段取最大），调用方在配套 vLLM，未核到，已写进页末待核。

**信息清单勾选**（新建页无旧版；清单在旧会话 scratchpad `p5/lm-head-facts.md`，取自 02 §7 与已达标页里关于 lm_head 的结论）：F1–F12、F14–F16、G1–G7 全部在新版能找到或已链接；F13 的「0.73%」改为「不到 1%」（理由见上）；F17 本轮核完（见上），页面不再列为待核。

**目录。** `src/content/wiki/toc.ts` 的「Decoder 层、MoE 与 lm_head」一节还没列 `lm-head`，新页目前落在「新增教学页（待编排）」；按范围规定没改 src/，等主会话拍板编排。

**验证。** `pnpm wiki:lint` 通过（本页 0 条；中途其他写手的页 large-scale-ep / dp-request-routing 报过一次重复别名，不是本页）；`pnpm wiki:diagrams --check` 通过（268 张一致，本页四图无溢出 / 压字，最后一轮无待留意）；`pnpm wiki:audit` 通过（本页 26 条来源行号全部有效，HF URL 未联网验证）；`checkStandard` 自查：教学正文 4,331 字、行内代码 0.0/千字、对照源码之上角标 0、calc 0.92/千字、相邻块 0、图先行、免责 2.1%、图宽合格；全页角标 30 处，C 级 22 处（73%）。

**事故记录。** 写 `lm-head-split.yaml` 时有三处带逗号的文字没加引号，YAML 解析失败、SVG 未生成，这段时间全库 `pnpm wiki:lint` 报错（主会话发现并提醒）。已立即加引号重生成，lint 恢复通过；此后每次保存都先渲染本页图再跑 lint。

**疑点 / 待核（已写进页末）。** W8A8 量化描述文件本机没有，lm_head 为 BF16 仍是推断；main 配套 vLLM 是否在 MTP 草拟时调用分段取最大；lm_head 这一步在 A2 上的实测耗时与访存占比。

**跳过。** 未起服务、未在站点页面截图（按派发说明由审查环节做浏览器验收）；zhihu 参考仍是 403，未看。

## P5 审查（09-29）

**结论：8.0 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（全库失败 1 处在 lmcache.md hedge-ratio，与本页无关）；P1 0 条，P2 4 条，P3 4 条。**

### 前提核对
- 写手「P5 写作记录（09-29）」在本文件；信息清单在旧会话 scratchpad `p5/lm-head-facts.md`（F1–F17、G1–G7）。新建页无旧版，抽 6 条到新版确认：F1（L150–152）、F2（L144）、F4（L134、L140）、F8（L220 + 流程图）、F12（L172）、F15（L209–211）都在；另看 F16（L178，标「推断」）、G2（L180 链 TP）、G6（L220 链 Ascend 配置）也在。勾选属实。
- 新建页无 `git diff` 删行可查；embedding.md 的 diff 只有 L139 段末追加一句指向本页，无删改，入链能解析。

### 初学者测试（只读前两屏）
lm_head 是模型最后一步的一次矩阵乘：拿最后的隐藏向量和「每个词一列」的权重逐列做点积，给词表每个词一个分数（logits）交给采样；代价是这张权重和词表一样大，decode 每步都要整张读一遍、却只为很少几行打分。——能说清。

### 学习顺序（通过）
是什么（L56–70，6 词示意 + 直觉图，不开算）→ 为什么 / 代价（L72–82，GLM 数字明确推后）→ 怎么算（L84–110，一个 calc）→ softmax 与采样（L112–130）→ 与 embedding 是否共享（L132–140）→ GLM 双机（L142–220）→ 常见误解 8 条 → 对照源码。GLM 之后只有误解和源码。

### 手算与核心概念（全部核过，无错）
- 示意演算：「猫」0.6+0.1+0.4+1.0=2.1、「我」0.2−0.2−0.6+0.2=−0.4 对；softmax 六个指数值、和 15.608、52.3% / 17.4% / 14.3% / 16.0%（合计 100.0%）对；e^1.1≈3.00 对应「差不多 3 倍」对。另外 4 列（你、喜欢、看、。）权重页面和图里都没给，−0.5 / 0.2 / 0.8 / 1.0 无法从页面复核（已标示意，见 P3-4）。
- GLM 数字与 02 §7.1–7.3 逐条一致：19360、64 补齐空切、卡 7 区间 135,520–154,879、151.25 MiB（158,597,120 B）、R1 38,720 / 309,760 / 154,880 / 1,239,040 B、2×4×4096×19360=634,388,480 ≈0.63 GFLOP、每字节 4 次；432 MiB 与「期望 2 行」对 one-request L322、L347；20.58 GiB、540.75 MiB 对 D 页 L174–177；151.25/21,078=0.72%，页面写「不到 1%」稳妥。
- 源码：`ParallelLMHead` 继承嵌入表类、`tie_weights` 直接指向嵌入表、`forward` 抛错（vllm@0fc695fc vocab_parallel_embedding.py L510、L563–574），补齐常量 64（L32）；`_gather_logits` 按 `use_all_gather` 选 All-Gather（logits_processor.py L75–87），平台默认 True（interface.py L858–862），vllm-ascend 四个提交 grep `use_all_gather` 均 0 处覆写；Ascend 两条路径（db701c1f ops/vocab_parallel_embedding.py L285–341：lmhead TP 先收集 hidden、乘完 All-to-All；`enable_reduce_sample` 关时才 gather）；细粒度 TP 只许 MoE、须整除 DP（ascend_config.py L565–574）；MTP 换头（llm_base_proposer.py L589–596，GLM 经 patch_glm5_next_config 的 `is_deepseek_mla` 算入）；草拟默认 argmax、开归约走 `greedy_sample` 分段取最大（L121–136）；采样器里归约分支确实存在（sample/sampler.py、rejection_sampler.py），「采样按分段完成」成立；温度 <1e-5 按贪心（v1/sample/sampler.py L17、L236）。
- 层号：配置 `num_hidden_layers=45`、`num_nextn_predict_layers=1`，主干编号 0–44、MTP 编号 45，页面「第 44 层结束后」「第 45 层」与 M 页一致。部署未开 FlashComm1（02 L318），「8 张卡手里是同一份完整 hidden」成立。

### P2
1. **与 sampling 页重复且没有链接**（L112–130 整节 + frontmatter relations）。同批新建的 `sampling.md` 已经是 softmax / temperature / top-k / top-p / greedy 的专页（它的「怎么算」①–④ 与本节内容重合），本页却整节重讲，全页没有一处链到 sampling.md，GLM 采样也只链 one-request 第 5 站。改法：本节只留 lm_head 相关的部分——logits 只能比大小、softmax 一句话 + 本页 6 个分数的那次 calc（可保留作衔接），「贪心只要最大值」那段保留（引出采样归约）；temperature、top-k/top-p、vLLM 的 1e-5 贪心阈值改成一句话 + 链 [sampling](sampling.md)；L128 的 GLM 去向加链 sampling.md 的「放到 GLM 双机」；relations 加 sampling（与 speculative-decoding 视需要）。
2. **GLM 节重算了已推导的切分数**（L166–170 calc「词表怎样切成 8 段」）。154880÷8=19360 与补齐检查已在 tensor-parallel.md L508–513（含 rank 区间、本地字节）和 embedding.md L181–183 推导过，派发要求本节「数字只链接底稿 / 已推导页，不重算」。改法：去掉这个 calc，改一句「每卡 19360 个词、154880 无需补齐（推导见 [张量并行](tensor-parallel.md#…) / [embedding](embedding.md#…)）」，L172 的补齐解释和卡区间保留为文字说明；L178 的 151.25 MiB 同样只引用 + 链接。
3. **术语先用后讲**：L82（基础节）首次出现 decode 未解释；L154 首次出现 prefill、MTP 未解释（MTP 到 L211 才讲，prefill 全页未讲、未链）。读者只懂向量与矩阵乘。改法：L82 decode 后加一句「逐个生成新 token 的阶段」；L154 给 prefill 加括注 + 链 [prefill](prefill.md)，MTP 加「GLM 自带的草拟层，每步先猜 3 个候选，见下文」或链 glm-5-3-flash#mtp。
4. **lm-head-split 图把 All-Gather 结果画成一条**（图底部 8 段长条）。只画一条容易读成「收到一张卡上」，正是 L228 要破的误解；「每张卡都拿到」只在说明文字里。改法：长条旁标「8 张卡各有这一整条」，或在每张卡框下画同一条的缩略副本（省略画法即可），让「之后各自有什么」在图上可见。

### P3
1. L154、L188 链到 one-request「最终归一化与词表投影」说 decode 的形状 / 字节在那里，但该节只有 prefill 那 1 行的数；decode 4 行的 154,880 / 1,239,040 B 在 one-request L385、L468（或 TP 页 L289–291）。改法：decode 的数改链到对应位置。
2. 底稿 02 §7.3「lm_head 占每卡权重 0.73%」按 D 页合计复现为 0.72%，写手已在页面改成「不到 1%」；底稿那一处建议主会话顺手更正（不在本页范围）。
3. 本页不在 `scripts/wiki/standard-pages.json` 名单里，audit 只统计不卡写作标准；`toc.ts` 也还没把 lm-head 编进「Decoder 层、MoE 与 lm_head」，目前落在「新增教学页（待编排）」。两处等主会话拍板。
4. L100 说「其余 5 列照做」，但你 / 喜欢 / 看 / 。四列的权重页面和图都没给，读者无法复核那 4 个分数。可在 calc 下加一行注明「其余 4 列的数略」，或把 6 列权重放进直觉图（不影响正确性）。

### 验证
- `pnpm wiki:audit`：本页无报错（26 条来源）；全库失败 1 处为 concepts/lmcache.md [hedge-ratio]，非本页。输出存 scratchpad `lmh-review-audit.txt`。
- `pnpm wiki:lint`：通过（7 处待留意均非本页），跨页锚点硬校验通过；本页 18 个带锚点链接逐个 grep 目标标题，均存在。全库入链：embedding、fine-grained-tp、sampling 三页链到本页。
- `pnpm wiki:diagrams --check`：271 张图与 spec 一致。
- 对照源码：五个 H3 齐全且顺序对（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置），版本差异表含 v0.23（2c59ff10）、v0.26（2ed6cbba）、main（baa023ad），db701c1f 单独标注。对照源码之上角标 0、行内代码 0、无 meta 文本；每节 calc ≤1，calc 与表格不相邻。
- 图：四张图看的是写手渲染的 PNG（scratchpad `lmh-lm-head-*.png`），无溢出压字；无新加分镜动图。

### 跳过
- 站点截图：5193 / 8790 端口均无监听（netstat 查过），按规定不起服务，未在站点上截图，改看写手的 SVG 渲染图。
- 「对照源码」正文与 frontmatter sources 区按规定未读，只 grep 核 H3 与版本标记。
- 知乎参考（写手记录 403）未看；本页非通信原语 / TP-DP-EP 专页。

## P5 修订记录（10-02）

针对「P5 审查（09-29）」的 4 条 P2、4 条 P3，由写手修订。

**P2（4 条全改）。**
1. 采样一节压缩：temperature / top-k / top-p / 1e-5 贪心阈值的整段讲解删去，改为一句话 + 链 [sampling](../../../wiki/concepts/sampling.md)；GLM 去向从 one-request 第 5 站改链 sampling 的「放到 GLM 双机」一节。保留：softmax 一句话定义、6 个分数的 softmax calc（衔接用）、「贪心只要最大值」引出采样归约的那段。**relations 没有加 sampling**：schema 规定边只存一个方向、由依赖方声明（schema.ts L96–97），sampling.md 已声明 `to: lm-head, kind: builds-on`（其 frontmatter L53–55），反向边由 wiki:build 派生，本页再加会成重复边——此条按核实结果不照审查意见改。
2. 「词表怎样切成 8 段」calc 删去，改成一句话 + 链唯一出处：[张量并行「词表：入口求和，出口拼接」](../../../wiki/concepts/tensor-parallel.md)与 [embedding 的 GLM 一节](../../../wiki/concepts/embedding.md)（后者的 calc 含 19360、mod 64、151.25 MiB）；补齐解释和卡区间保留为文字。
3. 术语首现：decode 首现（基础「代价」段）加「提示词处理完后、逐个生成新 token 的阶段」；prefill 首现加括注 + 链 [prefill](../../../wiki/concepts/prefill.md)；MTP 首现加「GLM 自带的草拟层，每步先猜 3 个候选 token」并指向本节最后的专门小节。
4. `lm-head-split` 图：caption 改写明「8 张卡每张都拿到底部这条完整的 154880 个分数，不是只汇到某一张卡」，图上长条旁新增一行「不是收到某一张卡上：8 张卡各有这一整条」（comm 色）；重渲染 SVG 并用 Playwright 截 PNG 自看过（scratchpad `lmh-lm-head-split.png`），无压字。

**P3（4 条：修 2、按范围跳过 2）。**
1. decode 4 行的 154,880 / 1,239,040 B 改链[张量并行的 R1 通信账](../../../wiki/concepts/tensor-parallel.md)（其 calc 有这两个数）；「挑行」段的 decode 出 4 行改链 one-request「一次前向的通信账」；prefill 的数仍链「最终归一化与词表投影」。
2. 底稿 02 §7.3 的 0.73% 更正：底稿不在本批修改范围，留主会话（页面本就写「不到 1%」）。
3. standard-pages.json 名单与 toc.ts 编排：按范围规定不改 src/ 与 scripts/，留主会话拍板。
4. 「其余 5 列照做」：在「两个分数怎么来」calc 末加旁注行「你、喜欢、看、。四列的权重未逐一列出，分数按同样算法得出（示意）」。

**验证（10-02）。** `pnpm wiki:lint` 通过（本页 0 条，新增跨页锚点 sampling / tensor-parallel / embedding / one-request / prefill 全部通过硬校验）；`pnpm wiki:diagrams --check` 通过（271 张一致）；`pnpm wiki:audit` 通过（本页 26 条来源行号有效）。`checkStandard` 自查：教学正文 4,401 字、行内代码 0、对照源码之上角标 0、calc 0.68/千字、相邻块 0、图先行、免责 1.4%、图宽合格。未起服务、未在站点截图。
