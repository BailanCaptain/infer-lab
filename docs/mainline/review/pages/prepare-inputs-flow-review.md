# prepare-inputs-flow 审查记录

## P5 写作记录（2026-09-29，第 11 批，Opus 写手）

### 改了什么

- **字数**：wiki:audit「正文」口径 1738 → 14309 字；写作标准口径（对照源码之前的教学正文）5463 字，行内代码 6 个（1.1/千字），calc 2 个，正文角标 0，免责 0.6%，图先行、相邻块均合格。
- **结构**（按 09-29 讲法：是什么 → 为什么 → 怎么算 → 细节 → GLM → 误解 → 源码）：
  1. 首屏问题式 H2 + 一句话定义 + 直觉图 + 三个编号（批次行号 / 位置 / 槽位）；
  2. 为什么拼成一排（整块矩阵、补齐浪费）+ 四行小表（token id / 位置 / 边界与长度 / 槽位各答什么）+ 代价三处；
  3. 「A/C 第三轮如何拼接？」一个 calc 逐格演出每行归属、位置、token 表下标、token id、边界、长度、槽位、选行，再逐行解释；
  4. 细节 H2（含代码流程图）：同步持久批次五步、形态标签四分支、位置怎样找到缓存写入处、注意力元数据按缓存组换表、选行两种例外（分段 prefill 丢弃、投机取 1 + k 行）、补齐行的四种填法；
  5. GLM 双机：8 个 worker 同一份输入、R1 两步的长度 / 选行 / 形态（calc）、三套槽位与 KDA 不算槽位、两类后端边界不同、重排阈值 4、DP1 空批次不走本流程；
  6. 常见误解 8 条；对照源码五个 H3。
- **图**：
  - `prepare-inputs-flow.yaml` 重画为直觉图：左边调度计划（A 本步 1 个、C 本步 3 个），中间 4 列 × 4 行的表（所属请求 / token id / 位置 / 槽位，A、C 间竖虚线分界），下面边界 [0,1,4]、长度 [6,3]、选行 [0,3] 三张短表，右边三个去处（模型输入、注意力元数据、输出头）。
  - 新增 `prepare-inputs-code-flow.yaml` 代码流程图：第 2 站计划 → 广播 8 个 worker → 第 3 站框内（同步持久批次，0 token 分支提前返回 → 块表拷贝 → 行归属与形态 → 位置与 token id → 边界与长度 → 槽位 → 选行按有无草稿两支）→ 补齐行数 → 建注意力元数据 → 第 4 站。
- **示例**：保留 A/C 数字（A 位置 5 → 槽位 9，C 位置 0–2 → 槽位 36–38），并在首屏说明「第三轮」的来历（A 提示词 4 个 token、跑过两轮），因为 concurrent-requests 的 P5 版已没有 A/C 例，而 npu-model-runner L45、vllm-v1-shape L198 仍引用「A/C 第三轮」。
- **入链锚点**：vllm-v1-shape L198 链 `#ac-第三轮如何拼接`、kv-cache-quantization L135 链 `#位置怎样找到缓存写入处`，两个标题都保留（前者为第 3 个 H2，后者为细节节里的 H3），lint 无 broken-anchor。
- **relations**：删掉指向 one-request、npu-model-runner 的 builds-on（两页已有指回本页的边，lint 报 relation-duplicate）；concurrent-requests 的 note 改掉已失效的「沿用 A/C 第三轮」；新增 vllm-scheduler、attention-backend-family。alias 删 `logits_indices`（与 npu-model-runner 重复）。
- **证据角标**：正文 0 处；对照源码区 19 处（C 14、S 1、A 1、D 2、! 1，C 占 74%）。

### 数字来源

- R1 第一步 4 个 token、位置 [0,1,2,3]、边界 [0,4]、每卡输入相同：底稿 01 §A3；本页只给结论并链 one-request 第 3 站。
- R1 第一步计划 `{R1: 4}`、草稿为空：底稿 01 §A2.4。
- 第二步 4 行 = y₀ + 3 个草稿、位置 4–7、logits 4 行；第一步取位置 3 那一行：底稿 03 §A6。
- 第一步 eager（带 prefill，拿不到 decode 图）：底稿 01 §A3；本页核了 `uniform_decode` 在有投机配置时还要求 `is_all_decode`（model_runner_v1.py L2915–L2941），与底稿结论一致。
- 场景 M 12 条 decode × 4 + 新请求 6000 = 6048 行：底稿 01 §A3，本页只链 concurrent-requests 第 3 站。
- 5 个缓存组、三套槽位、640 / 128 / 4 的块长、KDA 块号当状态页：只链 block-table GLM 一节（单一出处），不重算；R1 块数只链 one-request 第 2 站，不写定值。
- **本页新推导（[D]，请审查者复核）**：R1 第一步长度 4、选行 [3]、形态 PrefillNoCache；第二步长度 8、选行 [0,1,2,3]、形态 SpecDecoding——都是把 `_build_attn_state`（L1444–L1470）、`logits_indices = query_start_loc[1:] − 1`（L1277）、`_calc_spec_decode_metadata`（L1492–L1520）代入底稿数字得到。重排阈值 4 = SFA `decode_threshold = 1 + spec_token_num`（sfa_v1.py L283–L324）；GDN 侧上游以 `_init_reorder_batch_threshold(1, use_spec_decode)` 取 `1 + num_spec`（gdn_attn.py L104–L111、backend.py L557–L581），昇腾子类只对 dflash 另改（gdn_attn_builder.py L283–L302），两者都是 4；不一致会在 `initialize_attn_backend` → `calculate_reorder_batch_threshold`（L5101–L5125）抛 ValueError。场景 M 中 decode 排在新请求前，是按上游四段重排（backends/utils.py L606–L640）推出，没有实跑日志。

### 核心概念对照

- 两类东西（输入 = token id + 位置；注意力元数据 = 边界、长度、已算数、请求数、token 数、块表、最长一段、槽位、mask）：vllm-ascend 官方设计文档 `ModelRunner_prepare_inputs.md` L24–L64。
- 行归属 / 位置 / token 表下标 / token id：`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` L839（`np.repeat`）、L863–L868（位置 = 已算 + 组内序号）、L951–L961（`positions + req_indices × token_ids_cpu.shape[1]` 后 `index_select`）。
- 边界、KDA 专用边界、乐观长度：L1018–L1042；NPU 侧长度与槽位：L1228–L1254；槽位 kernel：`worker/block_table.py` L154–L185（grid = 请求数 + 1，尾部 PAD_SLOT_ID）；块表提交：`worker/block_table.py` L284–L288（非阻塞拷贝；`model_runner_v1.py` L835–L837 注释写明与 CPU 工作重叠）。
- 丢弃名单：L1075–L1099（乐观长度 < 请求已有 token 数即丢弃）。
- 同步持久批次：上游 `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py` L1125–L1180（删完成、删未排上）、L1366–L1401（追加块号，引自 block-table 页）、L1436–L1447（加新请求、condense、`_may_reorder_batch`、refresh）；昇腾外壳 L748–L763 只加异步调度下的回退保护后调 super。
- 注意力元数据按组：L3141–L3170（公共底稿）、L3254–L3280（每组 shallow copy、GDN 换未补齐边界、gid > 0 换块表与槽位）。
- 边界补假请求：`_pad_query_start_loc_for_fia` L765–L813（uniform 按 decode 行数续段，mixed 插一段 dummy request）。
- 空批次：`_dummy_run` L3347 起，不调用 `_update_states` / `_prepare_inputs`（已 grep 核对）。
- 广播：`vllm/v1/executor/multiproc_executor.py` L307–L318（引自底稿 01 §A3）。

### 旧版信息清单勾选（清单在 scratchpad `p5/prepare-inputs-flow-facts.md`）

- F1 计划 → 张量、同时更新持久批次：首屏 + 细节「先同步持久批次」。✓
- F2 三套坐标：首屏三个编号列表 + 常见误解第 1 条。✓
- F3 A/C 设定：首屏例子（补了「第三轮」来历）；「无填充、投机、重排」的假设改为在细节节分别讲补齐、投机、重排。✓
- F4 四行表：直觉图 + calc。✓
- F5 positions [5,0,1,2]、边界 [0,1,4]、半开区间、边界长度 = 请求数 + 1、累加生成、维护长度：calc + 逐行解释第 4、5 条。✓
- F6 token id 读嵌入、位置和边界解释上下文、拼接不串历史：第 2 节小表 + 第 3 节末段 + 误解第 2 条。✓
- F7 B=4 槽位公式、与块表页同一映射：calc 槽位行 + 第 6 条 + 细节 H3「位置怎样找到缓存写入处」。✓
- F8 A 槽位 9、C 槽位 36–38、同位置不同请求不同缓存、行 0 不写槽位 0：calc + 第 3 节末段。✓
- F9 缓存组 / 并行布局、KDA 不是追加位置行、稀疏 MLA 各有布局、B=4 不能代替整模型寻址：细节「每个缓存组一套」+ GLM 节三套槽位与 KDA 不算槽位 + 源码区 PCP 一条。✓
- F10 A 行 0、C 行 3 取末端表示、logits_indices：calc 选行 + 细节「哪几行送去输出头」。✓
- F11 未完成分块丢弃、投机选行不同：细节「哪几行送去输出头」两种情形。✓
- F12 重排、图模式扩大、额外行不是请求、行位置不固定：细节「先同步持久批次」「补齐的行不是新请求」+ 误解第 7 条。✓
- F13 排查时把 7 样放一起核对、形状各自正确不够：代价第二条 + 误解第 8 条。✓
- F14 前向与采样交接在 NPUModelRunner 页、数值是教学推演：npu-model-runner 已有 builds-on 边指回本页（反向由程序派生）；教学推演写进源码区「正文推导口径」。来源基线页链接删去（该页是基线索引，正文不再需要）。✓

### 自检

- `pnpm wiki:lint`：本页 0 报错（失败项都在 kv-cache-quantization、vllm-engine-core 等并行改写中的页）。
- `pnpm wiki:diagrams --check`：`ok 241 张图与 spec 一致`；本页两张图无代码名、文字段数提醒。
- `pnpm wiki:audit`：本页来源 32 条全部行号有效；最后一次全库运行 `ok`（0 失败）。
- 写作标准测量（scratchpad `p5/check-so-standard.ts prepare-inputs-flow`）：no standard problems。
- 底稿问题：01 §A3 第 6 条引用 `patch_use_v2_model_runner.py#L1-L21`，该文件在 db701c1f 只有 20 行，本页改引 L5–L20。
- 待核：准备输入每步实际耗时没有 profiling 数据（页末已标 [!]）。
- 未截图、未起服务（按派发说明，浏览器验收由审查环节负责）。

## P5 审查（09-29）

审查员：独立审查（第 11 批），只审未改页。正文按 L53–L246 分段读完；frontmatter 来源区（L1–L52）未读，「对照源码」（L247–L305）只 grep 结构。

### 初学者测试（只读前两屏）

我的一句话：准备输入是每张卡的 model runner 在每步前向之前做的翻译——把这一步各请求要算的 token 首尾相接排成一排，给每个 token 配上 token id、位置、KV 写入的槽位，再配边界、长度、选行几张短表；这样一次前向能把不同请求一起算、不补空格，代价是每步都要做且挡在前向前面、几张表必须对齐同一套行号、为图模式补出的行要标清。**通过。**

### 学习顺序：通过

是什么（L54–L76：问题式 H2 + 一句话定义 + 名词一句话带链接 + A/C 例子 + 直觉图 + 三个编号）→ 为什么（L78–L101：整块矩阵、补齐浪费、四行小表、三处代价）→ 怎么算（L103–L134：一个 calc 逐格填 8 张表，逐行解释）→ 细节（L136–L198）→ GLM 双机（L200–L234）→ 常见误解（8 条）→ 对照源码。第一屏没开算，示意数与 GLM 数字分开（GLM 数字只在 L200 之后）。

### 示意演算逐格手算（全对）

req 归属 [0,1,1,1]；位置 5+0、0+0、0+1、0+2 = [5,0,1,2]；token 下标 0×8+5、1×8+0/1/2 = [5,8,9,10]；边界 [0,1,4]；长度 [6,3]；槽位 A：5÷4 商 1 余 1，块表 [7,2] 第 1 格 = 2，2×4+1 = 9；C：9×4+0/1/2 = 36/37/38；选行 [1−1,4−1] = [0,3]。R1：第一步长度 4、选行 [3]、PrefillNoCache；第二步长度 8、选行 [0,1,2,3]、SpecDecoding——均与源码分支一致（见下）。

### 核心概念对照（源码逐条）

- 槽位公式 块号 × 块长 + 块内偏移：`vllm@0fc695fc:vllm/v1/worker/block_table.py` L326–L380（`_compute_slot_mapping_kernel`：`pos // block_size` 查表，`block_numbers * block_size + offset`；最后一路 program 把尾部填 PAD_ID）；昇腾 db701c1f `worker/block_table.py` L154–L185 直接复用该 kernel，grid = 请求数 + 1；2c59ff10 L165、2ed6cbba L180、baa023ad L184 同一调用。✓
- 线性注意力组不算槽位：db701c1f `worker/block_table.py` L437–L439（`is_mamba_group` 时 `continue`）。✓
- 块表先异步拷、与 CPU 准备重叠：db701c1f `model_runner_v1.py` L835–L837；`block_table.py` L284–L288 `non_blocking=True`。✓
- 行归属 / 位置：L839（`np.repeat`）、L863–L868。✓ 边界、KDA 专用边界（补位重复最后真边界）、长度补 0：L1018–L1029、L1228–L1231。✓
- 形态判断顺序：db701c1f L1444–L1463，2c59ff10 L1477 起逻辑相同；GLM 的 method 归一为 "mtp"（底稿 03 L17）。✓ 小出入见 P3-6。
- 丢弃名单（乐观长度 < 请求已有 token 数）：L1084–L1095。✓ 投机选行 1 + 草稿数：L1518。✓
- 同步持久批次五步顺序：`vllm@0fc695fc:gpu_model_runner.py` L1136–L1180（删完成、删未排上）、L1436–L1447（加新请求「smaller empty indices filled first」→ condense → `_may_reorder_batch` → refresh）；condense 把最大非空行搬进最小空行：`gpu_input_batch.py` L683–L728；四段重排 decode → short_extend → long_extend → prefill：`backends/utils.py` L606–L660。✓ 0 token 提前返回：db701c1f L2024–L2041。✓
- 阈值 4 与不一致报错：`sfa_v1.py` L283、L299–L300、L324（1 + spec）；上游 `backend.py` L557–L581 + `gdn_attn.py` L104–L111（1 + num_spec）；昇腾 `calculate_reorder_batch_threshold` L5101–L5125 不一致抛 ValueError（上游版本是取 min，不报错；本页按昇腾写，正确）。✓
- 边界补假请求：L765–L813（uniform 续段 / mixed 插 dummy request）。✓ 按组复制底稿、GDN 换未补齐边界、gid>0 换块表槽位：L3254–L3276。✓
- 空批次不走 `_prepare_inputs`：`_dummy_run` 自 L3347 起只 `_build_attention_metadata`（L3508 注释明说不经过 `_prepare_inputs`）。✓
- 广播与仅 output_rank 回传：底稿 01 L717–L718。✓

结论：**核心概念无错。**

### 数字对照底稿

R1 第一步 4 行、位置 0–3、每卡相同（01 L731–L741）✓；场景 M 12×4 + 6000 = 6048、decode 在前（01 L744）✓；第一步 eager（01 L842、L250）✓；DP1 空批次 4 token（01 L873）✓；34 KDA + 11 稀疏 MLA + 第 45 层 MTP、5 个缓存组、640/128/4（block-table L144–L149 单一出处，本页只链）✓。R1 块数本页未写定值，只链 one-request 第 2 站 ✓。写手自报 [D] 推导四项（长度/选行/形态/阈值）已逐项核实，成立。

### 丢信息

`git show p4-checkpoint:` 旧版 5 个 H2 逐条对照 + facts 清单 F1–F14 勾选抽查：全部在新版里找到对应（F3「无填充、投机、重排」假设改为分节讲；F14「教学推演」移到源码区「正文推导口径」；旧版链接来源基线页删去，可接受）。**未丢信息。**

### 链接、锚点、校验

- 正文 19 个链接全部解析；入链 `vllm-v1-shape.md` L198 `#ac-第三轮如何拼接`、`kv-cache-quantization.md` L134 `#位置怎样找到缓存写入处` 两个锚点仍在。
- `pnpm wiki:lint`：ok（14 处待留意均为他页 mark-flood）。
- `pnpm wiki:audit`：ok；本页「正文 14309 字 / 7 节 / 来源 32 条」，行号全有效。
- `pnpm wiki:diagrams --check`：ok 241 张。
- 对照源码五个 H3 齐全且顺序对；版本差异含 v0.23 / v0.26 / main，db701c1f 单独标为 GLM 专用镜像；对照源码之上 0 角标；正文行内代码 6 个；每节 ≤1 个 calc，表与 calc 不相邻；无 meta 文本。

### 浏览器实测（Playwright，1440×900，用户预览 5193）

截图：scratchpad `prepare-inputs-flow-review-1-first-screen.png`（第一屏：H2、定义、名词、例子，直觉图上半露出）、`-2-intuition-diagram.png`（直觉图完整）、`-3-fill-calc.png`（填表 calc）、`-4-code-flow.png`、`-5-glm-calc.png`。无横向滚动；两张图 900 宽清晰；控制台仅 4 条 502（问答后端 8790 未起，与本页无关）。

### 注水与重复

教学正文（L53–L246）约 9.5k 字符、汉字约 5.3k；audit 的 1.4 万含对照源码区。整体不注水；重复见 P2-1、P3-2。

### 问题

**P1：0**

**P2：1**

- **P2-1 重讲 block-table 已讲的实现细节。** 位置：L97 后半句（块表异步拷贝、槽位 NPU 逐 token 算）与 H3「位置怎样找到缓存写入处」L169–L175 三条要点（NPU kernel 每请求一路、尾部 −1；每组一套；写用槽位、读用整行块表）。block-table.md L124–L130 已完整讲过同一套内容（措辞几乎一致），本页 L97 与 L171 之间也自我重复。违反「block-table 已讲的概念一句话 + 链接，不重讲」。改法：保留该 H3 标题（有入链），正文压成一两句：槽位按上节第 6 条算、按缓存组各算一份（线性注意力组不算），实现上的异步拷表 / NPU kernel / 读写分用链到 block-table 对应节；L97 只留「块表异步拷贝与其余准备重叠」一句，不再展开。

**P3**

- P3-1 L58 说到「借好 KV cache 的块」没链 [vllm-kv-block-allocation](vllm-kv-block-allocation.md)，建议加。
- P3-2 L99 与误解第 8 条 L245 的「请求 ID、本步 token 数、已算长度、位置、边界、块表、选行放在一起核对」几乎逐字重复，误解那条可只留反驳句。
- P3-3 术语先用后讲：L152「注意力后端」、L161–L162「投机方法 / 草稿 token」、L172「缓存组 / 线性注意力组」都在定义（L179、L187）之前出现。改法：首次出现处补半句白话，或调整句序。
- P3-4 L89 小表把「能看到哪些历史」记在「位置」名下，L125、L240 同。实现上注意力的可见范围由边界 + 长度决定（L90、L128 自己也这么说），位置张量只进 RoPE。改法：「位置编码；可见范围由边界和长度算出，等价于只看位置 ≤ 自己的」。
- P3-5 直觉图左栏标题「调度器的计划」里写了「块表 [7, 2]」，但 L105 说块表来自持久批次、计划里只有新借的块 9。改法：A 框改成「已算 5 个」，块表放到图中另标「持久批次」或删去。
- P3-6 L162 把「去掉草稿都剩 1 个」直接写成 SpecDecoding；源码（db701c1f L1455–L1458、L1468–L1469）在投机方法不是 mtp 时会把 `self.attn_state` 改回 ChunkedPrefill。GLM 用 mtp 不受影响，可在该条加「（MTP 时）」。
- P3-7 GLM 节没提异步调度：GLM 部署自动开 async scheduling（底稿 03 L417–L422），第二步 y₀ 和草稿的 token id 不从 CPU token 表抓，而是由上一步留在 NPU 上的输出拷入（`vllm@0fc695fc:gpu_model_runner.py` L1700–L1740 `_prepare_input_ids` 异步分支），长度也是「乐观长度」。建议 GLM 节补一句并链 async-scheduling。
- P3-8 首屏 C「新借到块 9」与 A「槽位 9」数字撞车，初学者易误读为同一个 9；可在 L66 读图句里点一句「这个 9 是格子号，和 C 的块 9 无关」。
- P3-9 填表 calc 的槽位行直接出现块号 [2, 9, 9, 9]，没有「块序号 = 位置 ÷ 4 = [1,0,0,0] → 查块表」这一步；解释在 L129 文字里，建议 calc 里补一行，使逐格可对。

### 打分：8.5 / 10

学习顺序、演算、源码核对、信息保全都到位；扣分在 P2-1（重讲 block-table 的实现细节）和若干术语顺序、图注小问题。

## P5 修订记录（09-29）

逐条核实后全部采纳，P2 1 条、P3 9 条都已修改。

- **P2-1 重讲 block-table 的实现细节**：采纳。「代价第一条」删掉「槽位放到 NPU 上逐 token 并行算」，只留「块表的拷贝最先发起、与其余准备同时进行」。H3「位置怎样找到缓存写入处」的标题不变（kv-cache-quantization 有入链），正文压成一段：先重述三步公式，再用一句话讲缓存组（兼顾 P3-3）和线性注意力组不算槽位，NPU kernel、尾部 −1、读写分用只链到 block-table「表怎样随请求变化，槽位每步怎样算？」。
- **P3-1**：「借好 KV cache 的块」后补链 [KV 块分配](vllm-kv-block-allocation.md)。
- **P3-2**：常见误解第 8 条删掉逐字重复的核对清单，只留反驳句；清单保留在「代价第二条」。
- **P3-3 术语先用后讲**：「注意力后端」首次出现（同步持久批次第 5 步）补半句白话；形态一节的开头先讲清投机解码和草稿 token 再列四个分支；缓存组和线性注意力组在 P2-1 改写后的 H3 里就地解释，这个 H3 排在「注意力元数据」之前。
- **P3-4 位置不决定可见范围**：采纳。依据：可见范围来自边界 `query_start_loc` 和长度 `seq_lens`（db701c1f `model_runner_v1.py` L1018–L1042、L1228–L1231），位置张量只用于位置编码。小表「位置」那一行的用途只写位置编码；逐行解释第 2 条改成「可见范围由边界和长度算出，等于只看同一请求里位置不超过自己的」；常见误解第 3 条同步修改。
- **P3-5 直觉图块表的出处**：A 框的 sub 改为「已算 5 个位置」，C 框改为「新请求 · 新借块 9」；左栏另加一行注「持久批次里的块表：A [7, 2]，C [9]」，与正文「块表来自持久批次」一致。已重新生成 svg。
- **P3-6**：采纳。依据 db701c1f L1468–L1469：投机方法不是 mtp 时，`self.attn_state` 改回 ChunkedPrefill，交给元数据的是它（L3161）。在该分支后补了这一句。
- **P3-7 GLM 的异步调度**：采纳。依据：底稿 03 §A6 第 24 条（mtp 自动开 async scheduling，`vllm@0fc695fc:vllm/config/vllm.py` L957–L997），上游 `_prepare_input_ids` 异步分支从 `prev_sampled_token_ids` 在设备上拷入（`gpu_model_runner.py` L1700–L1775，昇腾不覆盖此函数），乐观长度见 L1033–L1042。GLM 节第二步说明后补了一句并链 async-scheduling；sources 增加这两条，源码位置表加一行（新增角标 [C33]，全页角标 20，C 占 75%）。
- **P3-8**：读图句里点明「这个 9 是格子号，和 C 新借到的块 9 不是一回事」。
- **P3-9**：填表 calc 在槽位前补两行：块序号 = 位置 ÷ 4 的商 = [1, 0, 0, 0]；块号 = 查各自块表 = [2, 9, 9, 9]。

### 修订后自检

- `pnpm wiki:lint`：`ok wiki:lint 通过`（14 处待留意都在别的页）。
- `pnpm wiki:diagrams --check`：`ok 241 张图与 spec 一致`。
- `pnpm wiki:audit`：`ok`；本页正文 14696 字 / 7 节 / 来源 34 条，行号全部有效。
- 写作标准测量：no standard problems。教学正文 5518 字，行内代码 6 个，calc 2 个，正文角标 0，免责 0.6%。
