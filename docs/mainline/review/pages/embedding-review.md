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

## 基础讲清修订（09-29）

依据：scratchpad 的 basics-standard.md（总原则 + 第 1–14 条）与 basics-audit.md 第 2 节（查表没有具体的行和数；[S,H]/[V,H] 首次出现没讲怎么读；多个 token 摞成 [S,H] 没演示）。旧版正文信息清单与去向：scratchpad\embedding-basics-facts.md。

### 结构（改前 3 个 H2 + 误解 + 源码 → 改后 6 个 H2 + 误解 + 源码）

| 改后 H2 | 内容 | 来自 |
|---|---|---|
| embedding 是什么？ | 一句话定义；「我喜欢猫」→ 编号 0、2、3（示意）→ 各取一行 → 3 条向量 → 第 1 层；字典比喻；行从 0 编；同编号同一行；入口地位 | 旧 §1 改写，新例子 |
| 为什么需要 embedding，代价在哪？ | 编号是座位号（小表例：2、3 相邻不相近；2+3=5 是句号；保留 8/9、312>8）；编号当数会凭空引入大小关系；一排数的三点好处（各自独立、信息量、可训练，推理只读）；为什么用表不用公式；代价：词表项数 × 每行个数，几亿个数、常驻卡上内存 | 旧 §1 后半 + 旧 §2 首段 |
| embedding 怎么算？用一张 6 行的小表走一遍 | 6×4 示意表 E；①②③ 三步；查表 calc；方括号形状记号怎么读、S/H/V 定义、[S,H] 与 [V,H]；one-hot 乘 E 的等价演算与「24 次乘法、20 次乘 0」 | 新增（旧 §2 的 [S,H]/[V,H] 挪入并补读法） |
| 每行多宽、每步查几行，查出来的数意味着什么？ | hidden size、层间宽度不变、层内可变（补投影、MoE 专家释义）；prefill/decode 各查几行、decode 得 [1,H]、历史位置由状态保存；行对应位置不对应请求（通用）；同编号两次；V×H×字节（小表 24 个数 48 B）；特殊标记也占行；这些数不承诺什么；lm_head 是什么、共享与否 | 旧 §2 中后段 + 旧 §3 的通用部分 |
| 一张卡放不下时：每张卡查一段，再加起来 | 张量并行一句话释义；2 卡按行切（卡 0 存 0–2 行、卡 1 存 3–5 行，卡 1 的第 0 行=整表第 3 行）；编号每卡同一份；置零；All-Reduce 一句话释义；位置 2 逐格相加 calc；为什么不会算错；省内存、多一次通信（S×H 个数，随 token 数线性增长） | 新增（把旧 §3 的机制用小例演一遍，放在 GLM 之前） |
| 放到 GLM 双机：8 张卡怎么查同一张表？ | 旧 §3 全部内容；1.18 GiB 的 calc 从旧 §2 挪来，与每卡 calc 合成一个；补 TP8/DP2、W8A8、R1、载荷、词表补齐、序列并行、Reduce-Scatter、残差/子层的一句释义；154880 行的三段构成与 token 页链接挪到这里 | 旧 §3 + 旧 §2 的 GLM 数 |

对照源码五个 H3 未动；只改「源码位置」数值出处一句（首图 312 → 小词表、[0,2,3]、表里的数、2 卡切法与 [8,9,312,8] 都是教学假设）。常见误解 7 条保留，第 2 条加「上文用小表算过一遍」。frontmatter 只改了 summary 一行（照样板页写成学习顺序），旧文存 scratchpad\embedding-old-summary.txt。

### 新增演算与图

- 数值演算（calc）3 处：「我喜欢猫」查表（3 行取数 → [3,4]）；one-hot 乘 E 的第 1 个数（0×0.2+0×0.1+1×(−0.3)+… = −0.3，整行 = 第 2 行，24 次乘法）；2 卡逐格相加看位置 2（[0,0,0,0] + [0.7,0.2,−0.4,0.9]）。GLM 的两个旧 calc 合成 1 个（数字不变）。全页 calc 4 个，0.87/千字。
- 图：新增 2 张、重画 1 张，GLM 图 embedding-lookup 未改。
  - wiki/diagrams/embedding-intuition.yaml（新，第一张图，直觉层）：token → 编号 → 6×4 空格子表选中第 0、2、3 行 → 3 条带数向量 → 第 1 层。
  - wiki/diagrams/embedding.yaml（重画）：6×4 带数小表 E（行标 0 我…5 。，列标第 1–4 个），选中行实色，右侧按输入顺序摞成带数的 [3,4]。
  - wiki/diagrams/embedding-split.yaml（新）：两张卡各一个框，框内左为本卡存的 3 行、右为查到的 [3,4]（不归本卡的整行 0，灰），右侧 All-Reduce 逐格相加得到完整 [3,4]。
- 示意数一处定义、全页复用：E = [[0.2,−0.1,0.5,0.3],[0.1,0.4,−0.2,0.6],[−0.3,0.8,0.1,0.0],[0.7,0.2,−0.4,0.9],[0.5,−0.6,0.3,−0.1],[0.0,−0.2,0.6,0.4]]，词为 我/你/喜欢/猫/看/。；one-hot 四列均手算核对（−0.3、0.8、0.1、0.0）。
- 新增图元：无（grids 的格内数字、行列标、frames 均为已有图元）。

### 数字

GLM 数字全部沿用旧版（154880、4096、19360、1.18 GiB、151.25 MiB、32768 B、mod 64 = 0），未重算、未新增；基础各节只用示意数和「十几万」「几千」这类量级词。「实现先把词表行数补到 64 的整数倍再平均切开」是对旧 calc「词表补齐」一行的释义。

### 清单勾选

F1–F30、M1–M7、对照源码全部保留，无删除；旧首图（312 → 第 312 行、无数）由两张新图取代，按行号取行与逻辑形状 [154880, 4096] 分别保留在直觉图、演算图和 GLM 节。明细见 scratchpad\embedding-basics-facts.md。

### 验证

- `pnpm wiki:lint`：通过，本页 0 条。
- `pnpm wiki:diagrams --check`：215 张图与 spec 一致；本页 3 张新/改图生成时无任何提示。
- `pnpm wiki:audit`：退出码 0；本页写作标准 2007 → 4577 字（正文 6570 → 11408 字），行内代码 2.2/千字、calc 0.87/千字、相邻块 0、图先行、免责 0%、图宽全部 ✓。
- 浏览器（Playwright，1440 宽，http://localhost:5193/#/wiki/embedding）：第一屏 scratchpad\embedding-shot-1.png（标题、定义、直觉图完整可见）；演算图 + ①②③ + 查表 calc scratchpad\embedding-shot-2.png；另截 one-hot calc、2 卡 calc 各一张（embedding-calc-onehot.png、embedding-calc-split.png）。数字清楚、无重叠、无裁切。

### 跳过

- 没有读 frontmatter 来源区（只按行替换了 summary 一行）和对照源码正文（只 grep 标题、改一句数值出处）。
- 没有去外部参考资料：查表、one-hot 等价、按行切 + 置零 + 求和都是本页已有机制，用小例演出来即可。

## 基础讲清审查（09-29）

独立审查员（Opus 5.5），只审不改。对象：工作区未提交版 `wiki/concepts/embedding.md`，下文行号为文件行号。

### 结论

- 分数：**8.5 / 10**。
- 逐节初学者检验（GLM 双机之前 5 个 H2）：5/5 能用自己的话复述。
- 学习顺序：通过。
- P1 0 条，P2 1 条，P3 6 条。
- `pnpm wiki:audit`：退出码 0，本页通过（名单 49 页达标 49 页；本页 11408 字 / 8 节，26 条来源全部 ✓）。另跑 `pnpm wiki:diagrams --check`（215 张一致）、`pnpm wiki:lint`（通过）。

### 学习顺序检查

第一个 H2 就是「是什么」：加粗句给出定义（编号换成一条向量、编号是几取第几行、只查表），随后用「我喜欢猫 → 0、2、3 → 各取一行 → 3 条向量 → 第 1 层」的直觉图让人先看到它在做什么，再用字典比喻、行从 0 编、同编号同一行收住。第二个 H2 讲「为什么」：编号只是座位号，拿它做算术（2+3=5）或送进乘法会凭空多出大小关系，换成可训练的一排数才能参与乘加；代价是「词表项数 × 每行个数」的大表。第三个 H2 才开始演算。顺序符合总原则，没有一上来就算。

### 逐节初学者检验

1. embedding 是什么（50–62）：能讲出「拿编号当行号去一张表里抄一行数，这排数就是 token 进模型的样子，之后交给第 1 层」。通过。
2. 为什么需要、代价在哪（64–78）：能讲出「编号没有大小远近的含义，不能直接参与乘加；换成训练出来的一排数才行；代价是表很大，常驻卡上内存」。通过（前向引用见 P3-1）。
3. 怎么算（80–119）：能讲出「编号 [0,2,3] → 取 E 的第 0、2、3 行 → 按顺序摞成 [3,4]；[3,4] 读作 3 行每行 4 个数；也能写成 one-hot 乘 E，但 24 次乘法里 20 次乘 0，所以实现直接取行」。通过。查表演示清楚呈现了「编号 → 第几行 → 哪条向量」，[S,H]/[V,H] 在第一次出现处（105）讲了读法和 S/H/V 的含义，并落到小表 [6,4]。
4. 每行多宽、每步查几行（121–135）：能讲出「每行宽度叫 hidden size，层与层之间不变；prefill 一次查整段，decode 每步查新来的；查出来的数本身不带预定含义；出口的 lm_head 是方向相反的另一张表」。通过（decode 行数见 P2-1，节内话题偏杂见 P3-6）。
5. 一张卡放不下时（137–159）：能讲出「按行切给几张卡，每卡只查自己那段、别的位置整行填 0，All-Reduce 逐格相加后每卡都拿到完整结果；省每卡内存，多一次通信」。通过（标题动机见 P3-3）。

前置概念：token、词表、向量、层、位置、hidden size、投影、MoE 专家、prefill/decode、KV cache、张量并行、加速卡、张量、All-Reduce、前向在本页第一次出现处都有一句当场解释，未发现先用后讲。

### 演算手算核对（全部正确）

示意表 E（6×4）：第 0 行 [0.2,−0.1,0.5,0.3]、第 1 行 [0.1,0.4,−0.2,0.6]、第 2 行 [−0.3,0.8,0.1,0.0]、第 3 行 [0.7,0.2,−0.4,0.9]、第 4 行 [0.5,−0.6,0.3,−0.1]、第 5 行 [0.0,−0.2,0.6,0.4]。

- 查表 calc（96–103）：位置 0/1/2 分别取第 0/2/3 行，数与 E 一致；3 行 × 4 = [3,4] ✓。
- one-hot calc（109–117）：E 第一列 [0.2,0.1,−0.3,0.7,0.5,0.0] 与表一致；只剩 1×(−0.3) = −0.3 ✓；其余三列依次得 0.8、0.1、0.0，整行 = 第 2 行 ✓；乘法 6×4 = 24 ✓；one-hot 5 个 0 × 4 列 = 20 次乘 0 ✓。
- 2 卡 calc（151–157）：卡 0 存 0～2 行，编号 3 不在其内填 0；卡 1 本地第 0 行 = 整表第 3 行 [0.7,0.2,−0.4,0.9]；相加结果 ✓；位置 0、1 的编号 0、2 都落在卡 0 ✓。
- 行内数：2+3=5 且小表 5 号是「。」✓；小表 24 个数 × 2 B = 48 B ✓。
- 图 embedding-intuition：3 条向量与 E 的第 0、2、3 行一致 ✓。图 embedding：6 行数与 E 一致，选中第 0、2、3 行，右侧 [3,4] 三行 ✓。图 embedding-split：卡 0 存第 0～2 行、选中 0 和 2，结果第 2 行全 0；卡 1 存第 3～5 行、选中第 3 行，结果第 0、1 行全 0；合并结果与单卡查表一致 ✓。
- GLM calc（173–181，沿用旧数）：154880×4096 = 634,388,480；×2 B = 1,268,776,960 B ≈ 1.18 GiB；154880÷8 = 19360；154880 = 64×2420，mod 64 = 0；19360×4096×2 = 158,597,120 B = 151.25 MiB；4×4096×2 = 32,768 B ✓。

### 核心概念

- 查表 = one-hot 乘表、实现直接按行号取行：正确。
- 按行切 + 越界置 0 + All-Reduce 求和：与 vLLM `VocabParallelEmbedding` 的做法一致（先把越界编号屏蔽、查本地分片、把越界位置填 0、再做 TP 归约）。词表补到 64 的整数倍与 vLLM 默认补齐粒度一致；本轮未重新打开源码逐行核对。
- lm_head 与 embedding 是否共享：页面 135 行说「GLM 各存一份」，207 行说配置里 `tie_word_embeddings` 为 false。对照本机 GLM 文本配置副本（infra-view-hardware-study-20260906/glm-flow/reference/glm5_next_3d/config.json：hidden_size 4096 第 20 行、tie_word_embeddings false 第 254 行、vocab_size 154880 第 259 行，顶层 tie_word_embeddings false 第 287 行）以及底稿 docs/mainline/02-forward.md 第 63、119、787 行（embed_tokens 与 lm_head 均为 BF16、每卡 151.25 MiB、lm_head 独立一份），一致 ✓。钉住版本的 Hugging Face 配置本轮没有联网复核。

### 信息没丢

- 从写手清单随机抽 6 条（另加 2 条）到新版逐条找到：F5（行对应编号 60；三段构成与 token 链接 167）、F8（单块最大的表之一 66）、F10（hidden size、层间宽度不变、层内可变 125）、F11（decode 得 [1,H] 127）、F15（1.18 GiB 是逻辑规模、不含补齐与缓冲 183）、F20（FlashComm1 前提与版本差异 187）、F22（每卡 19360 行、151.25 MiB、32768 B 173–181）、F27（权重生命周期 vs 本轮向量 205）。
- `git diff -- wiki/concepts/embedding.md` 删除行共 26 行（旧 summary、旧两个 H2、旧首图引用、两个旧 calc、GLM 节各段、误解第 2 条、数值出处句），逐行对照新版都已改写保留或合并；旧 calc 的「未分片载荷」说法改成了「逻辑规模」，含义未丢。

### 标准第 11–14 条

- 11：三处「怎么算」都有数值演算 ✓。
- 12：基础各节只用示意数和「十几万」「几千」「几亿」这类量级词；GLM 的 154880、4096、19360、1.18 GiB 等只出现在 161 行之后 ✓（135 行「GLM 各存一份，见下文」只是指路，无数字）。页首 summary 带 GLM 数字，见 P3-5。
- 13：GLM 节之后只有常见误解和对照源码 ✓。
- 14：第一节末尾只有一处指向「层与隐藏表示」的链接，没有堆链接 ✓。

### 图

- 看了写手截图 embedding-shot-1.png（第一屏 + 直觉图）、embedding-shot-2.png（演算图 + ①②③ + 查表 calc）、embedding-calc-split.png；写手没有截 embedding-split 图，本轮用无头 Playwright 直接渲染 wiki/diagrams 下的 SVG（没有起服务）补看了 embedding-intuition、embedding-split、embedding-lookup 三张。
- 数字都看得清，无重叠、无裁切；不看文字也能看出「编号 → 表里第几行 → 抄出哪条向量 → 摞起来」和「两张卡各查一段、没查到的填 0、合起来得完整结果」。本页都是静态图，不涉及动图条款。
- 注意：embedding-shot-1.png 页首显示的还是旧 summary（截图 02:51 早于页面最后修改 02:51:41 的 summary 改动），新 summary 在浏览器里的显示没有被截图验证过；本轮按规定不占 5193，也没有补看。

### 锚点

全库带锚点指向本页的链接只有 1 条：layers-and-hidden.md → `#放到-glm-双机8-张卡怎么查同一张表`，对应本页 161 行标题，能解析 ✓。另有 11 处不带锚点的链接。旧的两个 H2 没有外部锚点引用，改名不影响。

### P2

- **P2-1｜127 行、217 行（误解第 7 条）｜GLM 部署的 decode 每步不是 1 行。** 127 行说 decode「每步只送进上一步刚生成的 1 个 token……得到 [1, H]」，217 行写成 GLM 数字「得到 `[1, 4096]`」。本部署开了 MTP 投机解码：glm-5-3-flash-two-node.md 第 84 行写明每轮草拟 3 个，每请求的 decode 步按 4 个 token 安排；matmul-and-weights.md 第 282 行也写 R1 的 decode 输入是 1 个确定位置 + 3 个候选、共 4 行。所以在本部署下 R1 每步 decode 查 4 行、得到 [4, 4096]。影响：读者会把 [1, 4096] 当成本部署的事实，和相邻页面对不上。这条是旧版就有的（旧 M7），不是本轮改写引入的，但按 P1/P2 当轮处理。改法：127 行补一句「开了投机解码时，每步还会多送几个待验证的候选 token，行数随之变多」；217 行改为「每步的新 token 也要先查表；不开投机解码是 [1, H]，本部署开了 MTP，R1 每步是 1 个确定位置加 3 个候选，查 4 行得 [4, 4096]」，并链到 two-node 页的 MTP 一行。

### P3

- **P3-1｜68 行｜前向引用。** 「在下一节那张小词表里 5 号是句号」用到读者还没见过的 6 词词表（直觉图里 1、4、5 号没有写对应的词）。改法：在 54 行给出示意词表「0 我、1 你、2 喜欢、3 猫、4 看、5 。」，或把这句改成「假设 5 号是句号」。
- **P3-2｜66 行｜「模型从头到尾只做乘法和加法」说过头了。** 模型里还有 softmax、激活函数、归一化这类非线性计算。改法：改成「模型里的计算绝大多数是乘法和加法」，论证不受影响。
- **P3-3｜137、139 行｜标题动机偏。** 「一张卡放不下时」「表太大时」会让初学者以为 GLM 的嵌入表单卡装不下；实际上 GLM 整表 1.18 GiB，按行切是因为整模型用张量并行、顺带省每卡内存（159 行也是这么说的）。改法：标题改成「多张卡分着存一张表：每张卡查一段，再加起来」，加粗句改成「模型用多张卡一起跑时，可以把表按行切开……」。
- **P3-4｜embedding-split 图｜本地行号没画出来。** 正文和 calc 都强调「卡 1 自己的第 0 行就是整表第 3 行」，但图上卡 1 的行标只写整表编号（3 猫、4 看、5 。）。改法：卡 1 的行标写成「本卡 0 = 整表 3 猫」这类双标，或在卡 1 框内补一行小字。另外合并结果只画了一份，由两张卡的箭头汇入，可在标签里写「每张卡各得一份」加强，现有标签已说「两张卡都拿到」，不改也可。
- **P3-5｜第 5 行 summary｜页首就出现 GLM 数字和 TP8、All-Reduce。** 两张样板页的 summary 只写学习顺序、不列部署数字。改法：末句收成「最后落到 GLM 双机，看 8 张卡怎样分着查同一张表」；改后在浏览器里补一张第一屏截图（现有 shot-1 是旧 summary）。
- **P3-6｜121–135 行｜这一节话题偏杂。** 一个 H2 下放了 hidden size、prefill/decode 各查几行、行对应位置不对应请求、同编号两次、表的字节数、特殊标记、数不承诺什么、lm_head 共 8 件事，标题是三个问题并列。每件都讲清了，所以不记 P2。可选改法：拆成「每行多宽、每步查几行」和「表占多少、查出来的数意味着什么、出口的 lm_head」两节。

### 跳过

- 没读 frontmatter 来源区；对照源码只 grep 了五个 H3 标题。
- 没有起服务、没占 5193/8790，页面整体渲染只看写手截图；三张图用无头 Playwright 直接渲染 SVG 文件补看。
- FlashComm1 的版本差异（v0.23/v0.26 改走 Reduce-Scatter、main 固定 All-Reduce）和词表 64 补齐沿用旧版结论，本轮未重新开源码核对；钉住版本的 HF 配置未联网复核（用本机配置副本和底稿核对）。

## 基础讲清审查后修订（09-29）

针对上面「基础讲清审查（09-29）」的 P2 1 条、P3 6 条，全部处理。

### P2-1（decode 每步查几行）

- 核实：底稿 docs/mainline/03-sample-decode.md「0. 本篇反复要用的固定量」表：每轮草拟 3 个，decode 每请求每步的 query 长度 = 1 + 3 = 4；「A6 decode 步 / 做了什么」：每个请求带 1 个已确定 token + 3 个猜的 token 一起进模型。one-request.md「第二圈和第三圈：decode 步一次验证 1 + 3 个 token」：第二圈 input_ids = [y₀, d₁, d₂, d₃]，T = 4。glm-5-3-flash-two-node.md「关键参数各管哪一步」MTP 一行：每请求的 decode 步按 4 个 token 安排。三处一致。
- 改法（本页不重推，只链出处）：
  - 「每行多宽、每步查几行？」一节：decode 改成「普通做法下只有 1 个新 token，得到 [1, H]」，并补投机解码（speculative decoding）一句释义与「开了会多带几个待验证候选、查的行数变多；GLM 双机就开了，见 GLM 一节」。
  - GLM 一节在 embedding-lookup 图后新增一段：本部署开了 MTP，每轮草拟 3 个，decode 步按 1 个确定 token + 3 个候选安排，R1 每步 decode 入口查 4 行、得到 [4, 4096]；链 two-node 页 #关键参数各管哪一步 和 one-request 页 #第二圈和第三圈decode-步一次验证-1--3-个-token。
  - 常见误解第 7 条改为：不开投机解码时 1 个、得 [1, H]；本部署 R1 每步 1 个确定位置 + 3 个候选，查 4 行得 [4, 4096]；历史位置不再重新查表。

### P3

- P3-1：第一节给出示意词表「0 我、1 你、2 喜欢、3 猫、4 看、5 。」；第二节改成「这张示意词表里 5 号是句号」，不再前向引用。
- P3-2：「模型从头到尾只做乘法和加法」改为「模型里的计算绝大多数是乘法和加法」。
- P3-3：标题改为「多张卡分着存一张表：每张卡查一段，再加起来」，加粗句改为「模型用多张卡一起跑时……」，正文补「这样切不一定是一张卡装不下，而是整个模型按张量并行切开，嵌入表跟着切，顺带省每卡内存」。
- P3-4：embedding-split 图两张卡的行标改成双标「本卡 0：3 猫」这类（左本卡行号、右整表编号），正文补「每张卡都从 0 开始给自己手里的行编号」；合并结果标签改为「每张卡各得一份完整的 [3, 4]」，图注同步。
- P3-5：summary 末句收成「最后落到 GLM 双机，看 8 张卡怎样分着查同一张表」，不再列部署数字；已补截第一屏（scratchpad\embedding-shot-1.png，新 summary 可见）。
- P3-6：原「每行多宽、每步查几行，查出来的数意味着什么？」拆成两节：「每行多宽、每步查几行？」（hidden size、prefill/decode、行对应位置、同编号两次）和「这张表占多少，查出来的数意味着什么？」（V×H 与字节、特殊标记占行、数不承诺什么、lm_head），各配一句加粗总述。GLM 之前的 H2 由 5 个变 6 个。

### 信息与数字

没有删除任何信息：旧 M7 的 [1, H] 作为「不开投机解码」的情形保留；GLM 数字未新增、未重算，4 行来自底稿与链接页。

### 验证

- `pnpm wiki:lint`：通过，本页 0 条（新增两个锚点链接可解析）。
- `pnpm wiki:diagrams --check`：216 张图与 spec 一致（embedding-split 重新生成，无提示）。
- `pnpm wiki:audit`：退出码 0；本页写作标准 4969 字，行内代码 2.0/千字、calc 0.80/千字、相邻块 0、图先行、免责 0%、图宽全部 ✓。
- 浏览器（Playwright，1440 宽，localhost:5193）：第一屏重截，新 summary、示意词表可见；页面文本里能找到新增的 decode 链接；embedding-split 图重截（test-results/figshots/embedding-3.png），双行标不重叠、不裁切。
