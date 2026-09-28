# embedding：P5 写作与独立审查记录

## P5 写作记录（2026-09-28）

### 修改目的与范围

把 embedding 页改成「先直觉、后数字」的教学页：第一屏用问题式 H2 + 一句话定义 + 直觉图说清「按编号取一行，没有乘法」；第二屏讲为什么值得常驻这张表以及代价；第三屏落到 GLM 双机（2×A2×8，TP8）的 `VocabParallelEmbedding`；再是常见误解；最后是「## 对照源码」的五个固定 H3。

改动文件：`wiki/concepts/embedding.md`（重写）、新增 `wiki/diagrams/embedding.yaml` 与渲染出的 `embedding.svg`、`scripts/wiki/standard-pages.json`（把 embedding 加进写作标准名单）、本记录。旧图 `embedding-lookup.yaml` 原样保留并继续在第三屏引用，没有改它的 spec。

### 数字与依据

- `hidden_size = 4096`、`vocab_size = 154880`：grep `docs/mainline/02-forward.md`（§2.3「词表 154880，TP8，154880 / 8 = 19360 行/卡」「每卡嵌入权重 151.25 MiB」「嵌入后 All-Reduce 载荷 32,768 B」）与固定 revision 的模型配置一致。
- `tie_word_embeddings` 为 false：grep `glm-flow/reference/official-config.json` 第 254 行与第 287 行，两处都是 false，所以 lm_head 是独立一份权重。
- TP8 三步（切行 → 非本卡位置置零 → All-Reduce）：上游 `vocab_parallel_embedding.py` 的 `get_masked_input_and_mask`（L163-L187）与 `forward` 的 `masked_fill_` + `tensor_model_parallel_all_reduce`（L477-L497）；Ascend 侧 `_forward_origin` 同形，v0.23／v0.26rc 走 `maybe_pad_and_reduce`，main 改成按 TP 组调用 all-reduce 并在注释里写明入口不能换成 reduce-scatter。
- 细粒度 embedding TP：`embedding_tensor_parallel_size` 默认 0，三版 `embedding_tp_enable()` 判定相同；开启还要求 `recompute_scheduler_enable`，否则启动期 AssertionError；embed-TP 路径另有静态容量 ValueError。

### 旧版信息清单的保留情况

A 组（p4-checkpoint 版）：

- A1 编号相邻只说明索引相邻 → 第一屏正文 + 常见误解第 1 条。
- A2 每个编号一个可学习向量、后续层用它做矩阵运算与上下文交互 → 第二屏「表的形状可以写成 [V, H]」那一段。
- A3 表形状 [V, H]、编号 t 取第 t 行 → 同上一段。
- A4 V = 154880、H = 4096 → 第二屏 calc 前的引文与第三屏。
- A5 示意编号 [8, 9, 312, 8] 只是假设 → 第三屏图注 + 「源码位置」的 [A] 说明。
- A6 同一编号两次取出相同初始向量、后续层分开 → 第三屏图后正文 + 常见误解第 6 条。
- A7 input_ids [4] → X [4, 4096] → 第三屏 embedding-lookup 图与形状表。
- A8 「行」对应 token 位置、并发时来自不同请求 → 第三屏，链接 concurrent-requests。
- A9 表是只读权重、X 随批次变 → 第一屏末段与第三屏形状表后一段。
- A10 三个形状 → 第三屏表格（把原「decode [1, 4096]」一行挪到第二屏正文和常见误解第 7 条，形状不变）。
- A11 634388480 个标量、约 1.18 GiB、不含补齐与缓冲 → 第二屏 calc 及其后一段。
- A12 4096 是入口宽度、mHC 四路残差 → 第三屏末段，链接 glm-5-3-flash。
- A13 F.embedding 与词表并行层的区别 → 「源码位置」。
- A14 VocabParallelEmbedding / embed_input_ids / inputs_embeds → 「怎么开」与「源码位置」。
- A15 tie_word_embeddings 为 false，两份权重不能合算 → 第三屏末段 + 常见误解第 5 条。
- A16 源码依据与「镜像内最终安装组合、实际通信路径待核」 → 「版本差异」引文与「源码位置」末尾的待核。
- A17 下一步链接 matmul-and-weights → 第三屏末句。
- A18 sources → 保留原 5 条，另加 19 条（Ascend 三版 ops/utils、上游三版 vocab_parallel_embedding、register_custom_ops 等），共 24 条，`wiki:audit` 行号全部有效。
- A19 relations／chapters／order／aliases → 保留 builds-on token 与 chapters ["01"]、order 30、原 aliases，另加一条指向 tensor-parallel 的 builds-on。

B 组（0c7e1f6 版的模型无关直觉）：

- B1 书架号比喻的实质（相邻不等于相近、大小不代表重要、编号不能做算术） → 第一屏。
- B2 模型只做乘加，所以入口要换成能算的数字 → 第一屏。
- B3 每行对应一个编号、含特殊与预留行 → 第一屏，链接 token 页的 154880 三段构成。
- B4 整行抄出、没有乘法 → 第一屏与常见误解第 2 条。
- B5 数字是训练调出来的、推理只读 → 第一屏末段。
- B6 hidden size 定死、层间宽度不变、层内可不同 → 第二屏。
- B7 是权重里单块最大的表之一 → 第二屏首段。
- B8 为什么非要换成一串数字 → 第二屏首段。
- B9 不保证猫狗最近、不保证词向量加减、每维无人类含义 → 第二屏末段。
- B10 摞成 [S, H] → 第二屏。
- B11 decode 每步也要查表得到 [1, H] → 第二屏 + 常见误解第 7 条。
- B12 逻辑形状不是某个 rank 的分片 → 第二屏 calc 后一段、第三屏形状表、常见误解第 4 条。
- B13 embed_tokens 创建、embed_input_ids 按编号取向量 → 「怎么开」与「源码位置」。

没有被删掉的条目，也没有把清单内容外链后不留一句话说明。

### 验证

- `npx tsx <scratchpad>/render-embedding.ts`（复用仓库渲染器，只渲染本页新图）：`ok diagrams/embedding.svg`，figure 的越界与重叠检查为空。整仓 `pnpm wiki:diagrams` 当前失败在别人正在写的 `quantization-flow.yaml`（7 处文字出框），与本页无关，因此本页 SVG 用同一套渲染器单独生成。
- `pnpm wiki:lint`：本页零问题（此前 mark-flood 32 处已降到 29 处）。仓库其余 3 处失败属 vllm-v1-shape／engine-processes／request-call-chain 三页，不是本页。
- `pnpm wiki:audit`：`ok`，24 条来源行号全部有效；写作标准名单 17 页全部达标，本页各项为「正文 1826 字 · 行内代码 5.5/千字 · 角标 0 · 对照源码 ✓ · calc 1.10/千字 · 相邻块 0 · 图先行 ✓ · 免责 0.0% · 图宽 ✓」。
- 浏览器实测（http://localhost:5193/#/wiki/embedding ，1512×950）：两张图、两个 calc、形状表、误解列表与对照源码五节都正常渲染；页内四个带锚点的链接（token 的两个、collective-communication#all-reduce、tensor-parallel 的词表小节）经 DOM 校验目标 id 均存在，点击后滚动到位。

### 未处理

- 专用镜像内最终安装组合与运行时真实通信路径仍未实测，本页字节数是按形状与精度推导的逻辑载荷。
- main 上新增的 `enable_pcp_embedding_lmhead_weight_sharding`（PCP 下把 embedding／lm_head 权重再切一份）没有写进本页：它不在旧版信息清单里，本轮也没有独立核对那条代码路径。

## P5 审查（09-28）

审查人：独立审查员（只审不改）。对象：`wiki/concepts/embedding.md` 工作区版本（相对 14591fd：+126 / −37）。

### 1. 初学者测试（只读前两屏）

一句话复述：Embedding 就是拿 token 编号当行号，到一张训练好的 `[154880, 4096]` 表里把那一行 4096 个数整行抄出来，只查表不做乘法；代价是这张表要常驻，整表约 1.18 GiB，而且这些数字本身不保证任何语义性质。

结论：通过。第一屏（L48–60）是问题式 H2 + 加粗一句话定义 + 直觉图，`embedding.yaml` 画的正是「312 号在表里选中第 312 行」（spec L3、L12、L21）；第二屏（L62–80）讲了为什么需要、表多大、数字不承诺什么。

### 2. 核心概念（逐条对照）

| 页面说法 | 位置 | 依据 | 判定 |
|---|---|---|---|
| 按编号查表，没有乘法 | L50、L119 | vllm@0fc695fc `vocab_parallel_embedding.py` L77–78：`UnquantizedEmbeddingMethod.embedding` 就是 `F.embedding(input_, layer.weight)` | 对 |
| 表的逻辑形状 `[154880, 4096]` | L70、L84、L108 | `official-config.json` text_config L20 `hidden_size 4096`、L259 `vocab_size 154880` | 对 |
| TP8 按行（词表轴）切 8 份，每卡 19360 行 | L84–86、L90 | 同文件 L294–298 注释「Divide the weight matrix along the vocabulary dimension」+ `divide(num_embeddings_padded, tp_size)`；L32 补齐粒度 64，L252–257 `pad_vocab_size`；154880 = 64 × 2420，无补行；Ascend 侧 db701c1f L58、L79–81 同样用 64 | 对 |
| 查不到的位置填 0，再 All-Reduce | L84、L86、L120 | 同文件 L493–496：`masked_fill_(input_mask…, 0)` → `tensor_model_parallel_all_reduce`；Ascend `_forward_origin`（rfork L229–249；main baa023ad L254–285）同形 | 对（本部署前提下），边界见 P2-1 |
| `tie_word_embeddings = false`，lm_head 是独立权重 | L114、L122 | `official-config.json` L254（text_config）、L287（顶层）均为 false；底稿 02 L787 | 对 |
| 同编号两次取出相同初始向量，后续层分开 | L102、L123 | 查表语义 + mHC/注意力按位置计算 | 对 |

核心概念无错误。

### 3. 数字

| 数字 | 页面 | 底稿 02 §2.3 | 其他页 | 判定 |
|---|---|---|---|---|
| 19360 行/卡 | L90 | L188 | tensor-parallel L291、L401 | 一致 |
| 154880 mod 64 = 0 | L91 | L188 | tensor-parallel L404 | 一致 |
| 151.25 MiB（19360 × 4096 × 2 B = 158597120 B） | L92 | L189 | tensor-parallel L272 | 一致，复算无误 |
| 32768 B（4 × 4096 × 2 B） | L93 | L190 | tensor-parallel L214 描述同一 `[4,4096]` All-Reduce | 一致 |
| 634388480 个标量、≈1.18 GiB | L74–75 | —（由形状推导） | — | 复算 1268776960 / 2^30 = 1.18，无误 |

tensor-parallel 页「词表：入口求和，出口拼接」（L210–216）与本页 L84–86 的说法一致：行切、非本卡置零、入口 All-Reduce、出口 All-Gather。

写手自报疑点核实：
- 「main 改成按 TP 组 all-reduce，注释写明入口不能 reduce-scatter」：属实，vllm-ascend@baa023ad `ops/vocab_parallel_embedding.py` L275–285。
- 「运行时真实通信路径未实测」：仍然成立。本页 All-Reduce 依赖底稿 01 L869 的 `[A]` 前提「enable_flashcomm1 按默认关闭」，底稿 02 L168 也写明 `flash_comm_v1_enabled` 为假时才是 All-Reduce。见 P2-1。
- 「main 的 `enable_pcp_embedding_lmhead_weight_sharding` 未写」：知识库已有该参数页（params/enable-pcp-embedding-lmhead-weight-sharding-*.md，只在 main）。见 P3-6。

### 4. 有没有丢信息

`git diff -U0` 删掉的 37 行逐条对照：
- 旧 H2「从离散编号到可计算的表示」「一组编号怎样取出一组向量」「嵌入表与请求表示具有不同的生命周期」「按行选择如何落实到执行实现」的内容都在新版：E[t,:] → L68；V/H 取值 → L70；`[8,9,312,8]` 是假设 → embedding-lookup 图注 L3 + L167 `[A]`；同编号两次 → L102；行对应位置、并发 → L104；生命周期 → L60、L112；1.18 GiB 不含补齐 → L74–78；mHC 四路 → L114；tie=false → L114、L122；`F.embedding`/`embed_input_ids` → L165；`inputs_embeds` → L134；下一步链接 → L114。
- 旧表的「decode `[1, 4096]`」一行挪到 L66 和 L124，信息仍在。
- 唯一丢失：旧 L80 指向 `../sources/glm-5-3-flash-baseline.md` 的「主线来源基线」链接被删，全库另有 43 个概念页保留它。见 P3-5。

写手清单抽查 6 条：A5（L167 + 图注）、A11（L74–78）、A14（`inputs_embeds` L134）、A15（L114、L122）、A16（L169「待核/镜像/未实测」）、B9（L80）——全部还在。

### 5. 链接与锚点

- 本页 9 个链接全部可解析：token.md#编号要落在-154880-行之内（token L89）、token.md#会报什么错（L146）、collective-communication.md#all-reduce（L68）、tensor-parallel.md#词表入口求和出口拼接（L210），其余为无锚点页面链接且文件存在。
- 全库指向本页：one-request（2 处）、token、matmul-and-weights、layers-and-hidden（正文 + relations `to: embedding`）、glm-5-3-flash、index.md 两处、registry.json，都不带锚点，全部可解析。

### 6. `pnpm wiki:audit`

退出码 0，`ok wiki:audit`。本页：24 条来源行号全部有效；写作标准「1826 字 · ✓行内代码 5.5/千字 · ✓角标 0 · ✓对照源码 · ✓calc 1.10/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 0.0% · ✓图宽」。
对照源码五个 H3 齐全且顺序正确（L128 怎么开、L136 会报什么错、L142 开销和什么时候别开、L150 版本差异、L163 源码位置）；版本差异里 v0.23、v0.26、main 都出现（L152、L154、L157）。证据角标只出现在 L167（源码位置内）。

### 7. 打分：8 / 10

**P1**：无。

**P2**
1. **位置**：L84、L86（正文把入口通信写成无条件的 All-Reduce）。**问题**：v0.23 / v0.26 的 Ascend `_forward_origin` 走 `maybe_pad_and_reduce`，开 FlashComm1 时会变成 Reduce-Scatter（vllm-ascend@db701c1f `ops/register_custom_ops.py` L94–102；2c59ff10 L83–91）；main 才固定为 All-Reduce（baa023ad L275–285）。正文既没说「本部署 FlashComm1 关」这个前提，版本差异也只提了函数名（grep 不到 flashcomm / Reduce-Scatter）。问答时问到「开 FlashComm1 后 embedding 怎么通信」会答错。**改法**：L84 后补半句「本部署 FlashComm1 关闭，所以是 All-Reduce」；版本差异补一句「v0.23/v0.26 开 FlashComm1 时入口改为 Reduce-Scatter，main 固定 All-Reduce」。
2. **位置**：L84–94。**问题**：部署是 W8A8，但正文没说 embedding 表不量化、保持 BF16；calc 只在标签里写了「BF16」，初学者会问「W8A8 不是每数 1 字节吗」。依据是底稿 02 L63、L68（embed_tokens、lm_head 列在 BF16 排除清单里）。**改法**：在 L84 段或 calc 前加一句「W8A8 只量化线性层，embed_tokens 保持 BF16，每数 2 B」，并链接量化相关页。

**P3**
1. 术语先用后讲：「TP」首见于 L78、L84，「张量并行」的解释链接在 L86；「R1」首见于 calc L93，解释在 L96；「decode」（L66）、「one-hot」（L119）、「BF16」（L92）没有解释。改法：首次出现时加括注或调整顺序。
2. L66 说「层与层的交界处宽度不变」，但 GLM 的 mHC 在层间保留 4 路 × 4096（L114 自己也这么写）。改法：L66 句尾加「（GLM 层间保留四路，见下文）」。
3. 同一概念中英文混用：「Embedding / embedding」与「嵌入表 / 嵌入权重」（L104–112）混着用。按英文术语规则，统一为「embedding 表」。
4. 单一出处：19360、151.25 MiB、mod 64 在本页 calc（L90–92）和 tensor-parallel（L272、L291、L399–405）各推导一遍，目前一致，但有漂移风险。改法：定一个出处推导（建议本页管 embedding 分片，TP 页只引用或链接）。
5. 删掉了「主线来源基线」链接（旧 L80）。改法：在源码位置补回 `../sources/glm-5-3-flash-baseline.md`。
6. main 上的 `enable_pcp_embedding_lmhead_weight_sharding`（PCP 下再切 embedding / lm_head）没有链接。改法：版本差异加一行链接到该参数页。

### 跳过的段落

- frontmatter 来源清单（L9–33），按纪律交给 audit。
- 「## 对照源码」正文（L127–169）只用 grep 核对，没有读。
- 没有读取被拦的情况。

## P5 修订记录（09-28，针对上面 P5 审查的 P2）

- **P2-1（入口 All-Reduce 缺前提）**：正文「放到 GLM 双机」段在 calc 之前补一段前提——本部署没开 FlashComm1（Ascend 的序列并行开关，默认关，双机启动命令没打开），v0.23 / v0.26 打开它入口会改走 Reduce-Scatter，main 不论开关都固定 All-Reduce。「开销和什么时候别开」把原来那句含糊的「开启 flash communication 时按其协议补齐」改写成两条分支＋默认值，版本差异表新增一行「打开 FlashComm1 时的入口通信」。
  核实：`db701c1f:vllm_ascend/ops/register_custom_ops.py` L82-L90（`flash_comm_v1_enabled` 为假返回 `tensor_model_parallel_all_reduce`，为真则 `F.pad` 后 `tensor_model_parallel_reduce_scatter(x, 0)`）；`2ed6cbba` 同文件 L72-L90 同形；入口只此一处归约（`db701c1f:ops/vocab_parallel_embedding.py` L248 `maybe_pad_and_reduce`，2ed6cbba 同行号）。默认值 `db701c1f:vllm_ascend/envs.py#L75`（`VLLM_ASCEND_ENABLE_FLASHCOMM1` 默认 `"0"`）＋ `ascend_config.py` L84-L91；底稿 01 L869、02 L168、02 L318 同结论。main 固定 All-Reduce：`baa023ad:ops/vocab_parallel_embedding.py` L275-L285。
- **P2-2（W8A8 下 embedding 仍是 BF16）**：同段补一句 BF16 的含义（每数 2 B）＋「8 位只用在一部分矩阵乘的权重上，embedding 表建层时没接量化配置」，链接到 `quantization.md#哪些矩阵是-8-位哪些保持-bf16`；「怎么开」里也点明没传量化配置，所以走不量化的查表实现。依据：`db701c1f:vllm_ascend/models/glm5_next.py` L2263-L2268 建 `VocabParallelEmbedding` 只传 `vocab_size`/`hidden_size`/`prefix`，无 `quant_config`；底稿 02 L63、L68。
- 新增来源 2 条（`2ed6cbba:ops/register_custom_ops.py#L72-L90`、`db701c1f:vllm_ascend/envs.py#L75`）。为守住 lint 的 mark-flood 上限（>30 报），把新增角标压到净 +1，并移除「开销」段里重复指向同一处的 `[C10]`、`[C18]`。
- 验证：`pnpm wiki:lint` → `ok`，本页 0 条提示（改前一版本页曾报 `mark-flood 37 处`，已消除）；`pnpm wiki:audit` → `ok`，本页来源 26 条、行号全部有效。其他页仍有 22 处 mark-flood 等既有提示，与本次改动无关。
- P3 未处理（本轮只领了 P2）。
