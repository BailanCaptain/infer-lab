# linear-attention 审查记录

本文件由 P5 第 05 批写手新建，首次独立审查尚未进行。

## P5 写作记录（2026-09-28，深改）

### 改了什么

- 按「先直觉、后数字」重排为九节：是什么（含新直觉图）→ 为什么能降到线性 → 累加、delta、门控、按通道衰减 → 一步完整更新 → 落到 GLM 双机的状态账 → prefill/decode 两条路径 → 多请求与空闲组陪跑 → 常见误解 → 对照源码（五个 H3，顺序固定）。正文字数按 `pnpm wiki:audit` 的口径从 3,668 增到约 13,300。
- **新增直觉图** `wiki/diagrams/linear-attention-intuition.yaml`：上半画标准 attention 逐位置留 k、v，下半画同一段历史压进固定大小的状态、当前 token 先用 k、v 更新再用 q 读出、状态留给下一个位置。只画原理，不标字节。
- **新增代码流程图** `wiki/diagrams/linear-attention-flow.yaml`：投影与门 → 短卷积 → 按位置种类分三条路（prefill 分段 / decode 递推 / 投机候选）→ 拼回行序 → 输出门控与投影 → TP8 归约；带 5 组 pins。
- **改 `kda-evolution.yaml`**：图上文字从 14 段减到 8 段（衰减说明移到矩阵的 label/dims，两条脚注移进 caption），过图宽与文字数检查。
- 新增内容：状态怎么落到 12 个块号上、KDA 组块大小 133,120 与逻辑块 640／kernel 块 128 的区别（链接部署页的五种用途表）、混合批次里 prefill 与 decode 两条路同时走再拼回行序、空闲 DP 组陪跑时这一层做什么、常见误解 6 条、五个源码 H3（含三版差异表）。
- 单一出处：状态分片字节（561,152 B、18.2 MiB）链接 tensor parallel 页，不重算；页大小 655,360、逻辑块 640、一个块号 7.969 MiB、短请求 15 块链接双机部署页；每 token 13,056 B 链接部署页；状态分类与折算链接 kv-cache。本页只自算「85.0 MiB × 32 槽 = 2.66 GiB」这一步（此前只在底稿里）。〔09-28 修订更正：原 calc 其实也重推了 85 MiB，已删；现在 85 MiB 链接 TP 页，2.66 GiB 只报结果，本页自算的只有块号口径 95.6 MiB 及差额拆分，见文末「P5 修订记录」。〕
- frontmatter：模型配置来源从 `eb9eb208` 换成钉住的 `690b7052`；sources 从 13 条扩到 30 条，全部经 `wiki:audit` 本地校验；`verified` 填三版；relations 增到 5 条（去掉与 kv-cache 的反向重复边，避免 relation-duplicate）。

### 数字取自哪一节

全部取自 `docs/mainline/02-forward.md` §4.3–4.7：64 头 ÷ TP8 = 每卡 8 头、每卡 1024 列（§4.3）；递推状态 512 KiB、卷积状态 36 KiB、合 561,152 B、34 层 18.2 MiB（§4.5）；页补齐到 655,360（填充 14.4%）、投机多 3 页、每层 4 页 2.5 MiB、34 层 85.0 MiB、32 槽 2.66 GiB（§4.5）；一层只有 o_proj 后一次 All-Reduce、短卷积与递推状态卡本地（§4.6）；prefill 段长 64、decode 走递推并按接受数回滚（§4.2、§4.7）。12 个块号与 3 个缓存组取自 01 §A2、§A0.5。

### 核心概念对照了什么

- **KDA 递推式**：对照 Kimi Linear 论文（`arxiv 2510.26692`）的 Sₜ = (I − β k kᵀ) Diag(αₜ) Sₜ₋₁ + β k vᵀ、oₜ = Sₜᵀ qₜ。确认 Diag(α) 是**按通道**衰减、GDN 是标量门；页面同时给「衰减 → 预测 → 误差 → 更新 → 读出」五步写法，并在正文写出两种写法代数等价的推导（把 e = v − S̄ᵀk 代入展开）。段长 C=64 与 3 层 KDA 配 1 层全注意力的比例也来自该论文。
- **O(n²) → O(n)**：对照 Katharopoulos 等（`arxiv 2006.16236`）：核特征映射写成线性点积、用矩阵乘法结合律降复杂度。页面另写明 softmax 含非线性归一化，不能直接改写成 Q(KᵀV)。
- **实现路径**：对照 `vllm-ascend@db701c1f` 的 `ops/kimi_kda.py`（forward 的投影与两个门、`_run_causal_conv1d`、`_run_recurrent`、`_run_prefill` 的 `_KDA_CHUNK_SIZE=64` 与 [H,V,K]→[H,K,V] 转置、投机分支与混合批次拆分拼回）、`ops/kimi_kda_state.py`（state_len = 核长 − 1 + 投机数）、`models/glm5_next.py`（按 `kda_layers` 选层、状态 dtype/shape 入口）、`utils.py` 的 0.23.0 替换、`patch/platform/patch_mamba_config.py`（页补齐、`mamba_block_size = max_model_len`），以及 `vllm@0fc695fc` 的 `kimi_gdn_linear_attn.py`（权重与头整除断言）、`mamba_utils.py`（递推 FP32）、`kv_cache_interface.py`（页数 = 1 + 投机块数）。
- **三版差异**：用 `git ls-tree` 逐提交列文件核实——`2c59ff10` 只有 `ops/triton/kda/`，没有 `kimi_kda.py`，也没有 GLM 模型文件；`2ed6cbba` 有 `kimi_kda.py`/`kimi_kda_state.py` 且在替换表里**无条件**登记，但没有 GLM 模型文件；`baa023ad` 有 `models/glm5next/kda.py`，构造期检查投机数 ≤ 7、每头 128 维、BF16、核宽 2–4、门下界 ∈ [−5, 0)。

### 旧版信息清单勾选（p4-checkpoint 版 127 行）

清单原文在 `scratchpad/p5/linear-attention-facts.md`，34 条逐条核对：

- **新版里有**：F1–F5、F6、F7–F12（含两次写入同一键值的累加／delta 对照算例）、F13–F21（含五步递推、二维算例、状态是请求态而权重固定）、F22 的形状与头总量、F24（布局转置与 K/V 同维易漏）、F25–F27、F28、F29、F30、F31、F33、F34。
- **改了口径并说明**：F22/F23 旧版给的是「未 TP 分片」的标量数与 4 MiB／144 KiB；新版给整层 4 MiB／288 KiB（旧版那 144 KiB 是**不含** 3 个投机格的口径，含投机格应为 288 KiB，已按源码的 state_len = 核长 − 1 + 投机数 更正），另按本部署固定的 TP8 给每卡 512 KiB／36 KiB 与合计 561,152 B，逐项推导链接 tensor parallel 页（单一出处要求）。
- **挪到别页**：561,152 B 的逐项分片账 → `tensor-parallel.md#kda状态跟着头一起切`；6,827 token 折算与五类状态分类 → `kv-cache.md#混合模型到底要保留哪几类状态`；640／655,360／15 块 → `glm-5-3-flash-two-node.md`。
- **删掉的**：无结论被删。旧版 F32 的来源基线链接一度漏掉，已补回版本差异一节末尾。

### 验证

- `pnpm wiki:lint`：本页 0 处。仓库其余 3 处失败在 `concepts/mlp-residual-norm.md`、`concepts/moe.md`（别的写手同时在改，dup-alias 与 relation-duplicate），不属本页。
- `pnpm check:content`：通过（registry 133 页）。
- `pnpm wiki:diagrams`：本页三张图全部重新生成；`--check` 下本页 0 处，仓库剩 `diagrams/mlp-residual-layer.svg` 与 spec 不一致，是别人改了 yaml 未重新生成，未动。
- `pnpm wiki:audit`：本页 30 条来源全部命中固定 commit 的文件与行号范围。
- 自查统计：首图在第一节、图前无 calc 与部署数字；每节 ≤1 个 calc（共 2 个），表与 calc 不相邻；两个 calc 用 `parseCalcFence` 实际解析通过；正文行内代码 2 处（≈0.43/千字）；内联角标 25–26 处，全部在对照源码及其后，C 级占 72%；页内外 20 个锚点链接按 `headingSlug` 规则逐个核过，全部可解析。
- 未做：浏览器实测与截图（按本轮写手模板，浏览器验收由审查环节负责）；两个 KDA 算子的设备耗时。

## P5 审查（09-28）

独立审查，只审不改页面。**得分 8 / 10**：核心概念和数字都没有错，无 P1；有 3 条 P2（一处数字口径没说明、一处重复推导、首图有线压字）。

### 1. 初学者测试（只读前两屏，L53–L94）

我的一句话：KDA 是一种 linear attention，它不再让当前位置和每个历史位置逐个打分，而是把历史压进一个大小固定的状态矩阵；每来一个 token，先用 k、v 改写状态，再用 q 读出结果。代价是旧位置不能原样取回，状态容量也有限。
前两屏够回答「是什么」和「代价在哪」：L55 定义，L63 解释直觉图，L85–L90 的对照表列出代价。

### 2. 核心概念（逐条判定）

| 说法 | 页面位置 | 对照依据 | 结论 |
|---|---|---|---|
| 去掉 softmax 后可以用结合律，先把 k、v 的外积加起来（即 KᵀV）再乘 q，复杂度从平方降到线性 | L71、L81 | Katharopoulos 等 arXiv 2006.16236 摘要原文：“make use of the associativity property of matrix products to reduce the complexity from O(N²) to O(N)” | 对。L81 也写明带 softmax 的式子不能这样改写 |
| 带归一化的因果递推 S/z/o 三式 | L76–L78 | 同一篇论文的因果形式 | 对 |
| KDA 用 Diag(α) 按 key 通道衰减，GDN 是每头一个标量门 | L104、L106、L133 | Kimi Linear arXiv 2510.26692：Sₜ = (I − βₜkₜkₜᵀ)Diag(αₜ)Sₜ₋₁ + βₜkₜvₜᵀ；GDN 是“scalar forget gate αt∈[0,1]” | 对。五步写法和一行写法等价，L133 的代数展开我复核过 |
| 分段长度 64 | L199 | 论文写的是 “a fixed chunk size C=64”；源码 `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py` L38 `_KDA_CHUNK_SIZE = 64`，传给 `kda_gate_cumsum` 和 `chunk_kda_fwd`（L439–L472） | 对 |
| KDA 和全注意力按 3:1 混合 | L106 | 论文：“repeating 3 KDA layers to 1 full MLA layer” | 对 |
| 短卷积作用于 q、k、v；q、k 做 L2 归一化；输出门加归一化 | L139 | 论文 ShortConv+Swish、L2Norm、Sigmoid 门 ⊙ RMSNorm；源码 `kimi_kda.py` L435–L436 `l2norm_fwd`；decode 在算子内完成 `use_qk_l2norm_in_kernel=True`（L380） | 对 |
| 缓存按 [H,V,K] 存，prefill 算子要 [H,K,V]，只在算子边界转置 | L207 | `kimi_kda.py` L427–L430 注释和 transpose、L474 写回时再转回 | 对 |
| 没有可复用初始状态时从零开始 | L201、L213 | `kimi_kda.py` L429 `clear_ssm_states(initial_state_vk, has_initial_state)` | 对 |
| 混合批次先分开 decode 行和 prefill 行，算完再拼回 | L205 | `kimi_kda.py` L590–L632（`split_non_spec`、`torch.cat((core_decode, core_prefill))`） | 对 |
| 两个教学算例（累加对 delta；二维五步） | L102、L143–L150 | 手算复核：(2,0)→(4,0) 对 (2,0)；v̂=(0.5,0)、e=(2.5,2)、Sₜ=[[1.75,1],[0,1]]、o=(1.75,1) | 对 |

### 3. 数字

**卷积状态 288 KiB（写手自报）：核实正确。**
- `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py` L28–L31：`local_conv_dim = 3·64·128/8 = 3072`，`state_len = conv_kernel_size − 1 + num_spec = 4 − 1 + 3 = 6`。
- 精度看 `vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py` L119–L125 的 `kda_state_dtype`：卷积状态用模型精度（BF16），递推状态用 FP32。
- 每卡卷积状态 = 3072 × 6 × 2 B = 36,864 B（36 KiB）；整层 = 24,576 × 6 × 2 B = 294,912 B（288 KiB）。旧版的 144 KiB 是只有 3 格、不含投机位的算法。
- 递推状态：每卡 8 × 128 × 128 × 4 B = 524,288 B，整层 4 MiB。两者合计 561,152 B，34 层合计 19,079,168 B，约 18.2 MiB。

**底稿用的是哪个口径：** `docs/mainline/02-forward.md` 用的是含投机位的口径。L295–L298 写 `state_len = 6`、`conv_state = (3072, 6) BF16 = 36,864 B`，L486 写 `mamba_raw_size = 36,864 + 524,288 = 561,152`。02 里 grep 到的「144」「288」都是 MoE 专家的权重（L30、L623–L624），和卷积状态无关。

**144 这个口径有没有被拿去算总账：没有，不需要改任何位置。**
- 在 wiki/ 和 docs/mainline/ 里 grep `144 KiB|147,456|18 KiB|18,432|542,720`，只命中 01 L330–L332、quantization.md L125。这两处都是 MoE 的 scale 张量，和 KDA 无关。
- 旧的 144 KiB 只在旧版本页（HEAD L109）出现过，而且是作为「逻辑容量」单独给出，没有进入任何总账。
- 即使按 144 口径算（每卡 18 KiB，原始大小 542,720 B），页仍然要补齐到 655,360。所以 85 MiB、一个块号 7.969 MiB、13,056 B/token、每卡块数这些定稿数都不会变，只有 18.2 MiB 会变成 17.6 MiB；而 18.2 MiB 一直是按 36 KiB 算的。
- tensor-parallel.md L483–L486、kv-cache.md L147 都用 36,864 B，和本页一致。

**18.2 → 85 MiB 的过渡（L169–L172）：讲法对。** 和 02 L304–L310 一致：
- `_get_mamba_target_page_size` 取 `max(attn_page_size, mamba_raw_size)`，得到 655,360；
- `num_speculative_blocks = 3`，`max_memory_usage_bytes = page × (1 + 3)`；
- `mamba_block_size = max_model_len`，所以一条请求只要 1 块。

算出来 34 × 4 × 655,360 B = 89,128,960 B = 85.0 MiB，32 条并发约 2.66 GiB（02 L311）。「每个候选存一页，下一步从接受的那页接着算」这个语义说明可以接受。

**其他数字：**
- 64 头 / TP8、每卡 1024 列、只做一次 All-Reduce，和 02 §4.3、§4.6（L316）一致。
- 3 个组分 12/11/11 层、步长 3，和 01 L193、L214 一致。
- 块大小 133,120、「五种取值」，和 01 L34、02 L307 一致。

### 4. 单一出处

- 640、655,360 的由来、7.969 MiB、15 块都只给链接，没有重算。
- 561,152 B 和 18.2 MiB 只报结果，链接到 tensor parallel 页。
- 12 个块号 = 3 组 × 4，这一步很简单，可以接受。
- **例外**：L176 的 calc 又推了一遍 `34 × 4 × 655,360 = 85.0 MiB`，而 tensor-parallel.md L487–L488 已经推过同一个数。写作记录 L14 说「本页只自算 85.0 MiB × 32 = 2.66 GiB 这一步」，和实际不符。见 P2-2。

### 5. 有没有丢信息

- 整页重写（`git diff --stat`：+234 / −57）。按旧版 8 个 H2 逐条对照，都能在新版找到对应。旧 H2「矩阵状态之外还有短卷积历史」保留成了 H3，锚点没断，kv-cache.md L123 还在用。
- 从 `scratchpad/p5/linear-attention-facts.md` 抽查 6 条，都还在：F15（L181）、F16（L65）、F22（L158、L164–L165，标量数换成了字节数）、F26（L203）、F28（L234、L270–L271）、F30（L283）。
- 删掉的行里带数字的，逐条对照过，都有去向；F23 的 144 KiB 是有意更正。

### 6. 链接、审计与写作标准

- 出链 27 条，按 heading slug 规则逐个解析，0 条失效。全库指向本页的带锚点链接只有 1 条（kv-cache.md L123 → `#矩阵状态之外还有短卷积历史`），能解析。
- `pnpm wiki:audit`：通过（最后一行 `ok wiki:audit`）。本页 30 条来源里，本地引用都命中，6 个 arXiv 或 HF 的 URL 没有联网验证。注意：本页**不在** `scripts/wiki/standard-pages.json` 名单里，所以审计没有强制检查写作标准。下面这些是我手工核的：
  - 证据角标最早出现在 L232，在对照源码之后；
  - 正文行内代码 2 处（约 0.27/千字）；
  - 每节 1 个 calc，表格和 calc 不相邻；
  - 对照源码下的五个 H3 顺序正确（L230、L240、L253、L264、L279）；
  - 版本差异里 v0.23、v0.26、main 都有（L266–L271）。
- 两张新图用 Playwright 渲染成 PNG 看过，没有在 wiki 前端打开整页。

### 7. 问题清单

**P2**
1. **L169、L176–L178、L222：85 MiB 的口径没说明，而且和块号账对不上。** 页面说「一条请求实际占 85 MiB」，calc 标题问「一张卡要为并发的 KDA 状态留出多少」，还说「固定 85 MiB、12 个块号」。但按部署页的记账：
   - 占住一个块号就占 7.969 MiB（01 L231）；
   - 12 个块号 = 95.6 MiB，部署页 L243 的「15 块 ≈ 119.5 MiB」就是这么算的；
   - 多出的 10.6 MiB，是两个 11 层组各空一个主槽，加上 12 个 indexer 小槽没用上。

   读者把「12 个块号」和「85 MiB」放在一起就会算出矛盾。**改法**：写明 85 MiB 是 KDA 实际写进的 34 层 × 4 页字节；按块池记账，一条请求是 12 × 7.969 ≈ 95.6 MiB（链接部署页）；calc 标题改成「KDA 状态本身占多少字节」，或者把 32 条改用块池口径（约 2.99 GiB）。同一口径的数也出现在 tensor-parallel.md L276、L488 和 02-forward.md L309–L311。这里只列出，不改；是否统一口径请主线决定。
2. **L176：重复推导 85 MiB。** 改法：第一行改成引用 tensor parallel 页的 85 MiB，只保留 32 × 85 这一步（或按 P2-1 的决定换口径）。写作记录 L14 的说法也要同步改。
3. **首屏直觉图 `linear-attention-intuition`：虚线回流箭头压在字上。** yaml L30 的虚线在 x=342、x=574 竖直穿过 L12、L13 的两个标签。实测渲染后，「状态（大小固定）」在「大」「小」之间被穿过，箭头盖住了「大」；「更新后的状态」在「后」「的」之间被穿过。**改法**：虚线从标签下方再起、再收（比如 y 取 322 以下），或者把两个标签挪到矩阵上方。

**P3**
1. L171「561,152 B 的状态因此填充 14.4%」：14.4% 是填充占整页（655,360）的比例；如果相对状态本身算，是 16.8%。建议改成「页里约 14.4% 是填充」。
2. L165 先用了「3 个草稿位置」，L172 才讲投机解码。建议 L165 加半句解释并链接。
3. L215 的「录了图」「纯 eager 的探测步」没有解释。
4. 术语：L55 首次写 linear attention，之后正文里「线性注意力」出现 7 次（图的 frame 标签里也是）。按英文术语规则，应统一用 linear attention。
5. L185 写「4 个 token 的短请求占 15 块」，而它链接的部署页 L243 写的是「7 个 token」。两处说的是同一条 R1 请求，差别在于算不算 3 个草稿位。建议写成「4 个 token 的提示词（加 3 个草稿位共 7 格）」。
6. 流程图 `linear-attention-flow` 的 prefill 分支标着「整段提示词」，和 L201 的分块预填充（一轮可能只算一部分提示词）不一致。建议改成「本轮的提示词片段」。

### 8. 跳过的范围

- 只用 grep 核对、没读正文的：frontmatter 的 sources 区（L9–L39），对照源码一节的正文（L229–L304）。
- 公式块 L75–L79 和 L125–L131 因为核对核心概念需要，读了。
- 没有读取被拦的段。

## P5 修订记录（09-28）

按上面「P5 审查」的问题清单小修，没有动核心概念。

### P2
1. **85 MiB 与 95.6 MiB 的口径（原 L169、L176–L178、L222）**：
   - L169 改成「KDA 在每张卡上为一条请求实际写进的是 85 MiB」，L174 注明 85 MiB 和 2.66 GiB 算的都是 KDA 真正写进去的字节。
   - 在「状态怎么占到块号上」新增一段和一个 calc，讲清两种口径：85 MiB = 34 层 × 4 页 × 655,360 B；按块号记账 = 12 × 8,355,840 B ≈ 95.6 MiB；差额约 10.6 MiB = 两个 11 层组各空一个主槽（2 × 4 × 655,360 B = 5.0 MiB）+ KDA 用不上的索引器小槽（12 × 12 × 40,960 B ≈ 5.6 MiB）。最后一句说明两种口径各在什么时候用，并点明部署页「15 块约 119.5 MiB」用的是块号口径。
   - 常见误解 L222 改成「写入 85 MiB 状态、占住 12 个块号（按块号记账约 95.6 MiB）」。
   - 依据：85 MiB 取自 tensor-parallel.md L488 与 02-forward.md L310；2.66 GiB 取自 02 L311；7.969 MiB、主槽 12 个、小槽 12 个、同一 id 同一时刻只归一个组、第 12 个主槽由 MTP 的 MLA 与 KDA 组 0 第 12 层共用，取自 01-deploy-entry-schedule.md L220–L231；119.5 MiB 取自部署页 L243、01 L654。
   - TP 页 L273、L488 与 02 L309–L311 用的也是「实际写入」口径，本身没错，未改（不在本页范围）。
2. **重复推导 85 MiB（原 L176）**：删掉原 calc「一张卡要为并发的 KDA 状态留出多少」，改成一句结论并链接 [tensor parallel 的源码位置一节](../../../../wiki/concepts/tensor-parallel.md#源码位置)（L477–L488 的逐项算式）。对照源码末尾的出处说明同步改写。新 calc 里 85 MiB 只报结果和它数的是什么，不再推一遍。
3. **直觉图虚线压字**：`linear-attention-intuition.yaml` 的虚线回流改成从两块状态的标签下方起止（y 从 300 改为 332）。重新生成后 svg 里虚线为 `M574 332 L574 386 L342 386 L342 332`，两个标签基线在 y=320（13 号字），不再相交；画布 880 × 440。

### P3
1. 「填充 14.4%」改成「页里约 14.4% 是填充」。
2. 卷积状态第一次出现「3 个草稿位置」处补半句解释并链接投机解码页。
3. 空闲 DP 组一段补解释：attention 元数据是什么、「录了图」是什么（链接 ACL Graph 页）、eager 是什么、哪些陪跑步不建元数据。依据：`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` L3338–L3344（只有 `force_attention` 或 FULL 回放才建）、`vllm_ascend/ops/kimi_kda.py` L486–L489（没有元数据直接返回）；试跑不建元数据见 02-forward.md L1108。
4. 正文里的「线性注意力」统一成 linear attention（首次出现 L55 保留中文释义，aliases 不动）；直觉图 frame 标签和 caption 同步改。
5. 「4 个 token 的短请求占 15 块」改成「提示词只有 4 个 token 的短请求（加上 3 个草稿位置共 7 格）」。
6. 流程图 prefill 分支标签「整段提示词」改成「本轮的提示词片段」。
- 顺手：原 L181 连用两个「所以」，第二个改为「因此」。

### 验证
- `pnpm wiki:diagrams`：更新 2 张（linear-attention-flow、linear-attention-intuition）；`--check` 175 张与 spec 一致。
- `pnpm wiki:lint`：通过，19 处待留意都在别的页。
- `pnpm wiki:audit`：通过。
- 新链接 `tensor-parallel.md#源码位置`、`acl-graph.md`、`speculative-decoding.md` 的目标页和标题都在；没有起服务、没有截图，浏览器验收留给审查环节。

## P5 修订记录（09-28，跟着 kv-cache-spec 审查 P2-2 改）

- L196 原来写「调度和 MLA 用的逻辑块是 640」，和 kv-cache-spec「调度器的块 = 133,120」冲突。改成：
  - 「KV 池和 MLA 用的逻辑块是 640」；
  - 补上「调度器对齐单位 = 各组块大小的最小公倍数，也是 133,120」；
  - 把「同一个字段有五种取值」改成「block_size 这个词有五种含义」；
  - 对照表链接从部署页 `#怎么开` 改指 `kv-cache-spec.md#block_size-到底指哪一个五种含义`。
- KDA 组块大小 133,120（一条请求一页）的说法保留。
- 验证：
  - `pnpm wiki:lint` 通过；
  - `pnpm wiki:audit` 退出码 0，本页在名单里且达标：5,156 字；
  - 本页 21 条带锚点的链接全部能解析。
