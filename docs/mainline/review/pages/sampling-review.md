# sampling 审查记录

## P5 写作记录（09-29，第 18 批新建）

### 改了什么

- 新建 `wiki/concepts/sampling.md`（此前不存在，p4-checkpoint 与 git 历史里都没有这一页，所以没有旧版信息清单可对照；改为先列「必须覆盖的信息清单」F1–F18，存在旧会话 scratchpad `p5/sampling-facts.md`）。
- 字数：改前 0 → 改后 4993 字（wiki:audit 写作标准口径，`## 对照源码` 之前的正文，不含围栏块）。
- frontmatter：`chapters: ["05"]`（按目录微调清单的建议）；未写 `order`（清单里的「采样与返回」新节目录结构还没落到代码里，写了反而会把本页排到 prefill 前面）。relations 七条：lm-head、token、attention-qkv、one-request、speculative-decoding、structured-output、glm-5-3-flash-two-node，全部 builds-on，note 写的是「本页引用它的哪条结论」。
- 结构（学习顺序）：是什么（6 词例子 + 直觉图）→ 为什么不总选最高分（greedy 重复/单调、全词表抽的尾部风险、代价）→ 怎么算（① softmax ② temperature ③ top-k/top-p/min_p ④ 按概率抽 + greedy 对照）→ 细节三节（softmax 之前的改分数、真实实现的指数噪声抽取、参数从哪来）→ 停止条件 → GLM 双机（分数到每卡、8 卡各采一遍只交回一份、GLM 缺省参数、MTP 候选验证、停止与长度上限）→ 常见误解 10 条 → 对照源码五个 H3。
- 图两张：
  - `sampling-intuition`（直觉图）：6 个词按分数排；随机一路 ÷T、softmax 成概率（格子 + 长条），top-k=3、top-p=0.8 截断后重新归一（0.731/0.269），最后按概率抽；greedy 一路从原始分数直接取最高分。**和队列写法的差异**：队列写「分数经温度和候选筛选后分成贪心与随机两路」，但源码里 greedy 是在除以温度之前、直接在（改过分数的）logits 上 argmax 的（`vllm@0fc695fc:vllm/v1/sample/sampler.py#L243-L302`），所以图把分叉放在温度之前。
  - `sampling-flow`（GLM 代码流程图）：分片分数 → TP8 All-Gather → 有无 MTP 候选分两路 → 8 卡同种子各采一遍 → 0 号卡交回 / 各卡留着做 MTP 草拟 → 分界线 → 引擎逐个追加并检查停止。带 7 个 pins。
- 第一版直觉图文字 17 段，diagrams 提示超过 8 段；把概率数值挪进格子，现在 5 段。
- 与 lm-head 页的衔接：lm-head（同批新页）用同一张 6 词词表但分数是 [−0.4, −0.5, 0.2, 2.1, 0.8, 1.0]；本页换成相差 1 的整数（猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2），方便手算温度对比，并在首次出现处说明了换数的原因。

### 数字出处

- 03 §A5「本部署下的具体数字和算式」：每卡 19360 列、R1 prefill 1 行 / decode 4 行、满载 128 行约 37.8 MiB、3 个验证行 fp32 约 1.77 MiB、输出 rank = 8 − 8 × 1 = 0、种子由 `set_random_seed(model_config.seed)` 设（取值待核）。
- 03 §A5「怎么走的」第 2、4、5、6、15、16 条：All-Gather、`_sample` 分流与 `draft_probs=None`、Sampler 顺序、昇腾 `npu_top_k_top_p` 与指数噪声、MTP 草拟 argmax、max_model_len 附近的收口。
- 03 §A6 第 15–19 条：bonus 行 / 验证行、greedy 与随机两条接受判据、block/entropy verify 默认关。
- 02 §7.3：lm_head 按词表切 8 份、All-Gather 后形状；本页只引形状，字节推导链接 one-request「最终归一化与词表投影」和 lm-head 页，不重算。
- 03 §0：本部署没有 `--additional-config`，`enable_reduce_sample` 等昇腾开关走「关」。
- **底稿之外的两处数**（请审查确认是否可接受）：
  1. GLM 生成配置 temperature 1.0、top-p 0.95、三个结束编号：取自固定 revision 690b7052 的 `generation_config.json`（本机副本 `infra-view-hardware-study-20260906/glm-flow/reference/generation_config.json`，token 页已引同一文件）。底稿没写缺省采样参数，但「采样参数从哪来」是本页验收点，所以按官方文件写，frontmatter sources 第 1 条。
  2. 分词器的主结束 token 是 `<|endoftext|>` = 154820：取自同 revision 的 `tokenizer_config.json`，用来说明另两个结束编号为什么进 stop_token_ids。
- 小例子的所有数（分数、T = 0.5/1/2 三列概率、top-k/top-p/min_p 截断、u、q、罚分）都是编的，已逐个手算核对（e 次方保留两位，概率保留三位）。

### 核心概念对照了什么

- 采样顺序与 greedy/随机合并：`vllm@0fc695fc:vllm/v1/sample/sampler.py#L20-L58`（类注释的 9 步）、`#L228-L302`（T < 1e-5 走 greedy、`apply_temperature` 把 T≈0 的行换成 1 防除零、`torch.where` 合并）。
- top-k 先截、top-p 在截后重新 softmax 上累加、「跨过 p 的那个词也留下」：`vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L352-L393`（升序排序、`probs_sum <= 1 − p` 置 −inf、最后一个强制保留）。页上的「前面的词加起来不到 p 就留下」是这条规则的等价说法，已用例子双向核过。
- 指数噪声抽取的正确性：上游 `#L426-L457` 与昇腾 `vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L20-L43`（注释写明换掉 multinomial 是为避开 CPU-NPU 同步）；「第 i 个最小的概率 = λᵢ/Σλ」是独立指数分布的标准性质。
- min_p 在温度之后、top-k 之前：`vllm/v1/sample/logits_processor/builtin.py#L100-L115` + sampler 类注释 7c。
- 罚分公式：`vllm/model_executor/layers/utils.py#L51-L89`（frequency 按次数、presence 按出现与否，只看输出）、`vllm/_custom_ops.py#L360-L373`（repetition：提示词或输出出现过，正分除、负分乘）。
- bad words：`vllm/v1/sample/ops/bad_words.py`（前缀匹配时把最后一个 token 置 −inf）。
- 参数默认与校验：`vllm/sampling_params.py#L235-L265`、`#L470-L476`（T<ε 时重置 top-p/top-k/min_p）、`#L511-L533`；v0.26 新增温度有限且 ≤ 2：`vllm@568afb3a:vllm/sampling_params.py#L538-L556`。
- 缺省参数来源：`vllm/config/model.py#L285-L291`（generation_config 默认 auto）、`#L1458-L1510`（可覆盖的 6 项、启动警告）、chat 入口 `chat_completion/protocol.py#L523-L576`、max_tokens 推算 `serve/utils/api_utils.py#L170-L205`（completions 接口默认 16 见 `completion/protocol.py#L60`）。部署前提页的官方参数表里没有 `--generation-config` / `--seed`，据此写「按默认值」。
- 种子：`vllm/config/model.py#L159-L164`（默认 0，注释写明不设则 TP 各卡会抽出不同 token）、`vllm/engine/arg_utils.py#L437`（CLI 默认取它）、昇腾 `worker.py#L498-L499`。
- 停止：`vllm/v1/core/sched/utils.py#L94-L117`（min_tokens → eos → stop_token_ids → 长度）、`sampling_params.py#L590-L618`（生成配置里其余 eos 并入 stop_token_ids）、`vllm/v1/request.py#L353-L357` 与 `v1/engine/__init__.py#L42-L55`（stop / length 的 finish reason）。
- logprobs 默认原始分数：`vllm/config/model.py#L229-L235`、sampler `#L72-L100`。
- 候选验证：`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2610`（draft_probs 写死 None）、`sample/rejection_sampler.py#L146-L247`（bonus 行先普通采样、验证行 fp32 + 全套处理）、`#L449-L470`（greedy 比 argmax）、`ops/triton/reject_sample.py#L200-L215`（NO_DRAFT_PROBS 时 draft_prob=1，判据 target_prob ≥ u）；recovered token 从去掉候选后的目标概率里抽，对照上游 `vllm/v1/sample/rejection_sampler.py` 的 `sample_recovered_tokens_kernel`。页上「接受 + 拒绝后重抽 = 直接采样的分布」用 0.731/0.269 例子写了一遍。
- 论文：Holtzman et al., *The Curious Case of Neural Text Degeneration*（arXiv 1904.09751，ICLR 2020）——似然最大化解码平淡且重复、尾部不可靠、nucleus sampling 截掉尾部，已用 WebFetch 核对摘要。

### 版本核对

- vllm-ascend `sample/sampler.py`：v0.23（2c59ff10）与 db701c1f 相同（A2/A3 用 `npu_top_k_top_p`，有 `enable_async_exponential`）；v0.26（2ed6cbba）与 main（baa023ad）在非 reduce 路径改回排序实现，注释写 npu 算子在 k 大或 k 不一时 5–28 ms、排序约 1 ms；`enable_async_exponential` 两版都已删除；`enable_reduce_sample` 三版都在、默认关。
- 上游 sampler 顺序在 v0.23 与 v0.26 之间没变；v0.26 top-p 的 softmax 改成 fp32 累加（未写进页面，属实现精度细节）。
- main 列没有核对配套的上游 vLLM 提交，表里已写明。

### 信息清单勾选（F1–F18）

F1 ✓ 第一节 + GLM 节；F2 ✓「分数怎样到每张卡上」；F3 ✓ 一句话 + 链接 lm-head / one-request；F4 ✓「8 张卡各采一遍」首句；F5 ✓ 图 + 「有 MTP 候选时」（draft_probs=None 以「候选只取最高分、判据按目标概率」体现）；F6 ✓「怎么算」+「进 softmax 之前」；F7 ✓ GLM 节 + 「真实实现」节；F8 ✓（种子取值写默认 0，教程脚本另设与否放页末待核）；F9 ✓；F10 ✓（block/entropy verify 两条替代判据写在「怎么开」，默认关）；F11 ✓（37.8 MiB、1.77 MiB 写结论；1.18 MiB 没写，由 one-request 链接承接）；F12 ✓；F13 ✓；F14 ✓；F15 ✓；F16 ✓；F17 ✓ 版本表；F18 ✓ 链接 structured-output。

### 验证

- `pnpm wiki:lint`：通过（本页 0 报错；过程中一度有 mark-flood 提示「内联标记 41 处超过 30」，已删减到 24 处，C 级 19/24 < 80%）。同一时段他页曾出现 `dp-request-routing.md` 的 broken-anchor，非本页，未处理。
- `pnpm wiki:diagrams --check`：268 张图与 spec 一致。
- `pnpm wiki:audit`：通过；本页写作标准 4993 字，行内代码 1.2/千字，角标（对照源码之上）0，calc 1.00/千字，相邻块 0，图先行，免责 0.6%，图宽 ✓。

### 疑点 / 留给审查

- 页上「为什么不让 0 号卡一张卡采样再广播」的解释（各卡当场有结果、省一次广播）是由「草拟在每卡用 NPU 上的 sampled_token_ids」推出的，属 [D]，源码没有注释写明设计动机。
- 「采样与返回」目录新节还没有代码落位，本页只写了 chapters 05，目录位置需主会话按微调清单处理。
- 待核（页末已写）：教程启动脚本是否另设 `--seed` / `--generation-config`；真实接受率；采样耗时无实测。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。审查日 2026-10-02。

### 结论

- 分数：**7.5 / 10**。P1 1 条，P2 3 条，P3 5 条。
- 学习顺序：**通过**。是什么（6 词例子 + 直觉图）→ 为什么不总选最高分（重复、尾部、代价）→ 怎么算 ①–④ → 细节三节 → 停止 → GLM 双机 → 常见误解 → 对照源码；基础节只用示意数，GLM 数字都在 GLM 节，GLM 节之后只有误解和对照源码。
- 初学者测试（只读前两屏）：「采样是前向交出整排分数之后的那一步：greedy 直接取最高分；随机就先除以 temperature、做 softmax 变概率、用 top-k / top-p 截掉尾部再按概率抽一个。代价是结果不可复现，每步多一次 softmax 和排序。」能说出来。
- `pnpm wiki:audit`：通过（本页 41 条来源无无效 commit / 越界；3 条 URL 来源未联网验证属常态）。`pnpm wiki:lint` 通过；`pnpm wiki:diagrams --check` 271 张一致，本页两张图无提示。
- 信息清单：新建页无旧版；写手「P5 写作记录」在本文件，清单 F1–F18 存在于旧会话 scratchpad `p5/sampling-facts.md`（已确认文件存在）。

### 示意数逐个手算（全部核对）

- ① softmax（T = 1）：e 次方 20.09 / 7.39 / 2.72 / 1 / 0.37 / 0.14，总和 31.71；概率 0.634 / 0.233 / 0.086 / 0.032 / 0.012 / 0.004，合计 1.001（舍入）✓。
- ② 温度表：T = 0.5 总和 466.57 → 0.865 / 0.117 / 0.016 / 0.002 / 0.0003 / 0.00004 ✓；T = 2 总和 10.82 → 0.414 / 0.251 / 0.152 / 0.092 / 0.056 / 0.034 ✓；比值 e² ≈ 7.4、e^0.5 ≈ 1.65 ✓。
- ③ top-k = 3：总和 30.20 → 0.665 / 0.245 / 0.090 ✓；top-p = 0.8：累计 0.910 ≥ 0.8，留猫、你；归一 27.48 → 0.731 / 0.269 ✓。T = 0.5 时前 3 名里猫占 0.867（466 分母换成 465.42）✓。min_p = 0.1 门槛 0.063，留 3 个 ✓。
- ④ 区间法 u = 0.42 / 0.85 ✓；指数噪声 0.562 / 1.345 / 1.462 / 0.299 ✓；「第 i 个最小 = λᵢ/Σλ」推理正确 ✓。
- 罚分例：presence 1.5 后 1.5 / −1.5 / −2.5 / −3.5，最高分换成你（2）✓。
- GLM 缺省 top-p 0.95 套小例子：0.867 < 0.95，0.953 ≥ 0.95，留 3 个 ✓。
- greedy 对照：两处（直觉图、第 ④ 步）一致 ✓。

### 核心概念对照（源码行号均本轮实读）

- 采样顺序（allowed → bad words → min_tokens → logit_bias → 罚分 → greedy 分叉 → ÷T → min_p → top-k/top-p → 抽取）：`vllm@0fc695fc:vllm/v1/sample/sampler.py#L20-L58` 类注释 ✓。直觉图把 greedy 分叉放在温度之前，与源码一致 ✓。
- 默认值与校验：`vllm/sampling_params.py#L235-L245`（T 1、top-p 1、top-k 0、min_p 0）、`#L520-L533`（top-k 静默接受 −1、< −1 拒绝；top-p ∈ (0,1]；min_p ∈ [0,1]）✓。
- 种子：`vllm/config/model.py#L159-L164` 默认 0 且注释写明 TP 各卡需同种子 ✓——但本部署实际设了 1024，见 P1。
- 生成配置：`vllm/config/model.py#L285`（默认 auto）、`#L1481-L1488`（可覆盖 6 项）、`#L1503-L1506`（启动警告）✓。
- 停止：`vllm/v1/core/sched/utils.py#L94-L117`（min_tokens → eos → stop_token_ids → 长度）✓；`sampling_params.py#L590-L618`（生成配置里其余 eos 并入 stop_token_ids、主 eos 剔除、ignore_eos 不并入）✓。与底稿 01「逐个 append、check_stop 命中截断后面 token」口径一致 ✓。
- 昇腾：`vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L20-L43`（注释写明换掉 multinomial 是为避开 CPU-NPU 同步、指数噪声 argmax）✓；`#L296-L301`（A2/A3 绑 `npu_top_k_top_p`）✓；`ascend_config.py#L261-L262`、`#L320`（`enable_async_exponential` / `enable_reduce_sample` 默认 False）✓。
- 数字与底稿 03 §A5 逐条一致：19360、`[1|4|128, 154880]`、37.8 MiB、1.77 MiB、output rank 0（`8 − 8 × 1`）、133120 ✓。
- MTP 候选验证：只链接 speculative-decoding 与主线第 5 / 6 站，没有重算接受数；接受 / 拒绝规则用 0.731 / 0.269 例子说明，判据 target_prob ≥ u 与写手引的 `reject_sample.py` 一致 ✓。
- 对照源码：五个 H3 齐全且顺序正确；版本差异含 v0.23（2c59ff10，db701c1f 单独标注）、v0.26（2ed6cbba）、main（baa023ad）✓。

### 两个默认值核实（派活点名项）

- 本仓 `tools/repos/` 下 7 个仓库都**没有** GLM 的 `generation_config.json`（按文件名 find 和按 154820 / 154827 grep 均无结果），在 tools/repos 里核不到。
- 改用两条途径核实：① 官方 HF 原文 `zai-org/GLM-5.3-Flash` 固定 revision `690b705278a3…` 的 raw `generation_config.json`（本轮 WebFetch）；② 本机副本 `infra-view-hardware-study-20260906/glm-flow/reference/generation_config.json`，同目录 `model-revision.json` 的 sha 为 690b7052、文件清单含该文件。两者一致：**temperature 1.0、top_p 0.95、无 top_k，eos [154820, 154827, 154829]**。`tokenizer_config.json` 的 eos / pad 都是 `<|endoftext|>`，生成配置 pad_token_id = 154820，主结束 token = 154820 成立。
- 官方双机教程命令（`vllm-ascend` 文档提交 0576b647 的 GLM5.3-Flash.md §5.2 A2）没有 `--generation-config`，走默认 auto，所以页面「不写参数时按 T = 1、top-p = 0.95」成立。
- 结论：两个值**属实**，来源是 frontmatter 已列的固定 revision 官方文件，不必改标待核；如主会话坚持「只认 tools/repos」，则需改标待核。

### P1

1. **种子取值写错**（GLM 节「8 张卡各采一遍」第三段，页面第 274 行；页末第 379 行待核）。页面说部署命令没设种子、按 vLLM 默认 0。官方双机教程（文档提交 0576b647，`tools/repos/vllm-ascend/docs/source/tutorials/models/GLM5.3-Flash.md` 第 280 行 node 0、第 330 行 node 1）两台机器的命令都带 `--seed 1024`。影响：GLM 部署数字与官方不符。改法：第 274 行改成「部署命令两台机器都设了 `--seed 1024`」，结论（8 卡同种子、结果一致）不变；第 379 行待核里删掉 `--seed` 这一项，`--generation-config` 一项可改为「教程未设，走 auto」。另：底稿 03 第 195 行「种子取值待核」可由主会话据此回填（不属本页）。

### P2

1. **极小温度的边界讲错**（第 156 行、第 236 行、误解第 328 行）。vLLM 在 `SamplingParams` 里先把 0 < T < 0.01 的值抬到 0.01 并打警告（`vllm@0fc695fc:vllm/sampling_params.py#L27`、`#L429-L437`；v0.26 同，`#L451-L459`），之后才做 `T < 1e-5` 的 greedy 重置（`#L470-L476`）。所以请求里只有 T = 0 会走 greedy，T = 0.000005 实际按 T = 0.01 随机抽；防溢出靠的是这次「抬到 0.01」，不是「按 greedy 处理」。改法：第 156 行改成「T 在 0 到 0.01 之间会被抬到 0.01（防溢出）；只有 T = 0 按 greedy」，第 236、328 行同步改口径（1e-5 只在采样器逐行挑 greedy 结果时用，第 224 行保留）。
2. **GLM 节术语先用后讲**：MTP 在第 256、264、268、276 行连用四次，第 305 行才解释；decode 在第 264 行首次出现没有解释（同句的 prefill 解释了）。改法：第 256 行首次出现处补半句「MTP 是 GLM 自带的一层预测层，每步先猜后面 3 个 token，见下文」，第 264 行给 decode 补「之后逐个往后生成的步骤」。
3. **没有任何入链，且与同批 lm-head 页重叠**：全库 grep `sampling.md` 无入链。lm-head 页第 112 行起有整节「分数之后：softmax 与采样怎样挑出一个 token？」（自带 softmax calc、greedy / 随机对照），没有链到本页。改法：lm-head 那一节缩成一两句 + 链接本页（或至少加链接）；one-request 第 5 站、speculative-decoding「Greedy 验证与随机采样」、structured-output 作用到 logits 一节各加一条指向本页的链接。属跨页修改，按主会话的分工处理。

### P3

1. 直觉图（`sampling-intuition`）上没写这次的设置 T = 1、top-k = 3、top-p = 0.8，第 91 行正文也没写，初学者看到 73% / 27% 不知道从哪来。建议在图第三列标题或第 91 行补上这三个值。
2. 第 99、107 行「研究文本生成的论文」「上面那篇论文」没有点名，建议正文写出论文名（Holtzman 等，The Curious Case of Neural Text Degeneration，2020）。
3. 第 264 行 37.8 MiB、1.77 MiB 只给结论；本页是 1.77 MiB 在知识库里的唯一落点，建议补一行乘法（3 × 154880 × 4 B），37.8 MiB 同理。
4. 第 268 行「其余 7 张卡的结果留在本卡，接着做 MTP 草拟」读起来像 0 号卡不做草拟；图和第 276 行都是「每张卡」。建议改成「8 张卡都留着结果接着做 MTP 草拟，0 号卡另外把结果交回引擎」。
5. 第 247 行长度截断例子说结果是「我喜欢猫。我」，接口实际返回的是输出部分「猫。我」，建议注明「连同提示词」或改成输出部分。

### 跳过与说明

- 按约束跳过：frontmatter sources 区、「## 对照源码」正文（只 grep 了 H3 和版本号）、代码块。
- 浏览器：5193 预览没有在运行（curl 连接拒绝），按约束不起服务，未截整页；改用 Playwright 直接渲染两张图的 SVG 查看：`scratchpad/sampling-review-sampling-intuition.png`、`sampling-review-sampling-flow.png`（主会话 scratchpad）。两张图数字清楚、无代码名，问题只见 P3-1。
- 没有被拦截跳过的行。

## P5 修订记录（10-02）

修订人：Fable 5（按 09-29 审查意见逐条修）。

### P1（1 条，已修）

1. 种子取值：已核教程原文 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`，`--seed 1024` 在第 175 / 210（A3）与 280 / 330（A2）行，两台机器都有；教程没有 `--generation-config`。页面改动：「8 张卡各采一遍」一节改为「官方教程的启动命令在两台机器上都设了 `--seed 1024`」，并按派发要求加一句复现作用（同种子、同请求先后与批次组合，抽出的 token 序列相同；批次数值差异的例外仍由常见误解里的 batch-invariance 条覆盖）；「怎么开」补教程设 1024、未设 generation-config 走 auto；页末待核删掉这两项；sources 新增第 42 条（教程 #L280-L330），正文「数值出处」标 [S42]。底稿 03 的「种子取值待核」回填留给主会话。

### P2（3 条，已修）

1. 极小温度边界：已核 `vllm@0fc695fc:vllm/sampling_params.py#L26`（`_MAX_TEMP = 1e-2`）、`#L429-L437`（0 < T < 0.01 抬到 0.01 并打警告）、`#L470-L476`（之后才有 T < 1e-5 的 greedy 重置），审查属实。三处改口径：「怎么算 ②」改成「0 到 0.01 之间的 T 抬到 0.01 并打警告；只有 T = 0 按 greedy」；「采样参数从哪来」约定条、常见误解条同步改（误解条补「传小正数会被抬到 0.01，仍随机抽」）。采样器逐行挑 greedy 用 1e-5 的那句（「真实实现」节）保留未动。sources 新增第 43 条（#L429-L437），在「怎么开」以 [C43] 标注。
2. 术语先用后讲：GLM 节开头加粗段首次出现处补「候选来自 MTP，GLM 自带的一层预测层，每步先猜后面 3 个，下文单独讲」；「有 MTP 候选时」一节原重复定义改为衔接句。decode 首现处（满载一句）补「提示词算完之后逐个往后生成的阶段」。
3. 入链：复查时 lm-head 页第 127 行已自带两条指向本页的链接（该页自己的修订轮加的），未再动它；one-request 第 5 站「先采样」段尾、speculative-decoding「Greedy 验证与随机采样分开理解」段尾、structured-output「采样之后」首句各加一条指向 sampling.md 的链接（均为单句添加，不动其余内容）。

### P3（5 条，已修）

1. 直觉图第三列标题改成「top-k = 3、top-p = 0.8 截断，再归一」，第二列下加小注「这里 T = 1」（避免整句触发 diagrams 提示）；正文第 91 行补「图里取 T = 1、top-k = 3、top-p = 0.8」。
2. 论文点名：正文写出《The Curious Case of Neural Text Degeneration》（Holtzman 等，2020）。
3. 37.8 MiB、1.77 MiB 各补括注乘法（128 × 154880 × 2 B；3 × 154880 × 4 B）。
4. 「其余 7 张卡」句改为「8 张卡都留着结果接着做 MTP 草拟，0 号卡另外把结果交回引擎」。
5. 长度例子改为「接口返回的输出部分是『猫。我』（连同提示词读起来是『我喜欢猫。我』）」。

### 默认值出处（派发点名）

temperature 1.0、top-p 0.95 保留数值、不标待核；出处（固定 revision 690b7052 的 generation_config.json）本来就是 sources 第 1 条，这次在 GLM 节正文补写「固定 revision 690b7052 的官方 generation_config.json」，页末「数值出处」同样点明 690b7052。

### 验证

- `pnpm wiki:lint`：exit 0（本页 0 报错；待留意均为他页 mark-flood，本页 41→24 处的删减在上轮已做，此轮未新增超标）。
- `pnpm wiki:diagrams --check`：exit 0，271 张一致；sampling-intuition 重新生成，无本页提示。
- `pnpm wiki:audit`：exit 0；本页写作标准 4993 字 · 行内代码 1.2/千字 · 角标 0 · calc 1.00/千字 · 相邻块 0 · 图先行 · 免责 0.6% · 图宽 ✓；新增 2 条 sources 行号校验通过（来源 43 条）。

## P5 复审（10-02）

复审员：Opus 5.5（独立复审，只审不改页面）。范围按派发：P1、两个默认值出处、3 条 P2、入链、本轮删改、audit；其余段落沿用首审结论未重审。

### 结论

- 分数：**8.5 / 10**（首审 7.5）。首审 P1 1 条已修好；P2 3 条已修好；P3 5 条已修好。新增 P1 **0** 条，新增 P2 **1** 条（复现说法过头，见下），P3 2 条。
- `pnpm wiki:audit`：exit 0，本页 43 条来源全过（40 条行号有效、3 条 URL 未联网属常态，无无效 commit / 越界）。本页**不在**写作标准名单（`scripts/wiki/standard-pages.json` 无 sampling），audit 不打印也不强制它的写作标准；我用 `scripts/wiki/standard.ts` 的同一套函数单测本页：7063 字 · 行内代码 0.6/千字 · 角标 0 · 对照源码 ✓ · calc 0.57/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.0% · 图宽 ✓，全部达标（临时脚本放在 scripts/ 下跑完即删，仓库无残留）。
- `pnpm wiki:lint`：exit 0，7 处待留意均为他页 mark-flood，本页与三张入链页无报错（lint 含跨页锚点硬校验）。

### P1 复核：种子（已修好）

- 教程原文（`vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`，本轮 `git show` 落盘后 grep）：§5.2 多机只有 A2 一个页签，node 0 第 280 行、node 1 第 330 行都是 `--seed 1024`；全文无 `--generation-config`，也没有任何 `*_DETERMINISTIC` 环境变量。页面第 276 行「两台机器都设了 `--seed 1024`」、第 343 行「没有设 `--generation-config`，走 auto」属实；页末待核已删掉这两项；frontmatter 第 50 行 = 第 42 条来源（`#L280-L330`），正文第 343、379 行标 [S42] ✓。
- 记录勘误：修订记录说第 175 / 210 行是「A3」，实际都在 §5.1 单机：175 是 950DT 页签、210 是 A3 页签。不影响页面。

### 两个默认值出处（已补齐）

- frontmatter 第 9 行 = 第 1 条来源，指向 HF `zai-org/GLM-5.3-Flash` 固定 revision `690b705278a3…` 的 `generation_config.json`（690b7052）✓。
- 正文三处点明：GLM 节第 289 行写明「固定 revision 690b7052 的官方 generation_config.json」；对照源码第 343 行带 [S1]；页末第 379 行「数值出处」写 690b7052 并带 [S1] ✓。第 289 行本身没挂 [S1] 角标，但文字已指名出处，可接受。

### 3 条 P2 复核（均已修好）

1. 极小温度：本轮实读 `vllm@0fc695fc:vllm/sampling_params.py` 第 27 行 `_MAX_TEMP = 1e-2`、第 429–437 行抬到 0.01 并警告、第 470–476 行之后才做 T < 1e-5 的 greedy 重置。页面第 158、238、330 行三处已改成「0 到 0.01 抬到 0.01 仍随机，只有 T = 0 按 greedy」；第 226 行逐行挑 greedy 的 1e-5 保留，正确；第 341 行 [C43] = frontmatter 第 51 行 `#L429-L437` ✓。（记录勘误：修订记录写 `#L26`，实为第 27 行。）
2. 术语先用后讲：MTP 全页首现在第 258 行，同句已给解释；decode 首现第 266 行已补「提示词算完之后逐个往后生成的阶段」；prefill、All-Gather 都在首现处解释 ✓。第 307 行由重复定义改成衔接句，信息（MTP 每步接着刚采出的 token 猜 3 个、只取最高分、不看请求的 T 和 top-p）都还在。
3. 入链：全库现有 4 页链到本页——lm-head 第 127 行（两条，含 GLM 节锚点）、one-request 第 5 站「先采样」段尾、speculative-decoding「Greedy 验证与随机采样分开理解」段尾、structured-output 第 191 行。lint 通过，锚点可解析 ✓。

### 本轮删改是否丢信息

- 三张入链页：`git diff` 各只改 1 行，逐段比对只有插入、没有删除 ✓。
- 本页：文件未跟踪、仓库与各会话 scratchpad 都没有修订前快照，**无法 git diff**。改用首审记下的行号逐处对照：删掉的只有页末两项待核（已被教程核实）和第 307 行的重复定义（内容并入第 258 行）；「其余 7 张卡」句改写后信息更全；P3 的五处都是补充。未发现丢信息。

### 新增 P2（1 条）

1. **复现说法过头**（第 276 行，连带第 359 行）。第 276 行这轮新加「固定种子还带来复现：同样的种子、同样的请求先后与批次组合，抽出的 token 序列相同」；第 359 行「需要可复现、可比对的输出……用 greedy，temperature 设 0 即可」。官方说法比这窄：
   - vLLM 官方 `vllm@0fc695fc:docs/usage/reproducibility.md` 第 3–8 行：默认**不保证**可复现；在线服务只能靠 batch invariance。
   - vllm-ascend FAQ 第 15 条（`2c59ff10:docs/source/faqs.md` 第 167–202 行；v0.26、main 同文）：昇腾上要得到确定结果，除了 greedy 还要设 `LCCL_DETERMINISTIC=1`、`HCCL_DETERMINISTIC=true` 等 4 个环境变量，否则跨卡归约本身可能逐次不同。
   - 本部署：教程没设这些变量（见上），站内 batch-invariance 页第 164–166 行也写明这套部署没开 batch invariance，而且每一步的批组成都在变。

   影响：读者会以为设了 `--seed 1024`（或 T = 0）这套在线部署就能逐字复现，和官方文档、站内 batch-invariance 页的口径相反。第 332 行的误解条只补了「批组成导致数值差」这一种例外，没补跨卡归约，且离第 276 行 50 多行。
   改法：第 276 行把这句收窄为「同一个种子首先保证 8 张卡抽得一致；跨次运行逐字复现不由种子单独保证——在线服务的批组成每步都在变，昇腾上跨卡归约默认也不保证逐位一致，要复现见 [batch invariance](batch-invariance.md)」；第 359 行把「即可」改成「T = 0 是前提；要逐字一致还得开 batch invariance 或昇腾的确定性设置」。新增依据加进 sources（建议 reproducibility.md 第 3–8 行、faqs.md 第 167–202 行）。

### P3（2 条）

1. frontmatter `updated` 仍是 2026-09-29，本轮已改正文，建议改成 2026-10-02（同批已有页这样改）。
2. 跨页口径（不属本页，供主会话参考）：one-request 第 5 站「先采样」段仍写「温度接近 0 时直接取分数最大的词」，和本页 P2-1 改后的口径（只有 T = 0 走 greedy，小正数抬到 0.01 仍随机）不一致；该段末尾正是本轮新加的那条指向本页的链接，读者点过来会看到两种说法。

### 修订记录的证据勘误

- 修订记录「验证」里写的「本页写作标准 4993 字 · 行内代码 1.2/千字 · calc 1.00/千字 · 免责 0.6%」**不是本页的数**：本轮 audit 输出里这一行属于紧挨着的 sequence-parallel 页，sampling 不在名单里，audit 不给它打印写作标准行。本页实测见上「结论」，同样全部达标，结论不变，但记录里的证据张冠李戴了。

### 跳过与说明

- 按派发只审上述范围；首审已过的手算、核心概念对照、版本差异表本轮未重审。
- 没读 frontmatter 的 sources 区，只 grep 了第 9、47、50、51 行和 key 行号。
- 没开浏览器：本轮修改是文字和一张图的两处标签，图标签已在 `wiki/diagrams/sampling-intuition.svg` 第 76–77 行核到（「这里 T = 1」、「top-k = 3、top-p = 0.8 截断，再归一」）。
- 没有被拦截跳过的行。

### 复审修订（10-02 第二轮）

按复审新增 P2 把两处复现说法收准：第 276 行改为「种子首先保证 8 张卡一致；跨次复现不由种子单独保证（批组成每步在变、昇腾跨卡归约默认不保证逐位一致），见 batch-invariance」；「开销」节改为「T = 0 是前提，逐字一致还得开 batch invariance 或昇腾确定性环境变量 [S44][S45]」；sources 新增第 44 条（vllm reproducibility.md #L3-L8）、第 45 条（vllm-ascend 2c59ff10 faqs.md #L167-L202，两条本轮实读核对）；`updated` 改 2026-10-02（复审 P3-1）。复审指出的记录勘误属实（175/210 行在 §5.1 单机、`_MAX_TEMP` 在第 27 行、上一轮「验证」里的写作标准行是邻页 sequence-parallel 的，本页实测以复审数据为准），页面不受影响。本轮三项检查：lint exit 0、diagrams --check exit 0；audit 报他页 ucm.md 免责 3.1% 超标（exit 1，非本页，未动），本页 45 条来源行号校验全过、无报错。复审 P3-2（one-request「温度接近 0」口径）属跨页，留主会话。
