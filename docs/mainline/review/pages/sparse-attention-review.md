# sparse-attention 审查记录

## P5 写作记录（2026-09-28，第 07 批深改）

**改了什么。** 按「先直觉、后数字」重排为六节加对照源码：每个查询都要把全部历史读一遍吗（一句话定义 + 直觉图）→ 为什么能省、代价在哪（O(L²) → O(Lk)、三笔代价、相邻做法四行小表）→ 公式与掩码（J(t) 公式、softmax 重新归一化 calc、原掩码对照图）→ 候选位置从哪里来（三类来源、DSA indexer 公式、GLM 的三处改动）→ 放到 GLM 双机（四步走读 + 代码流程图 + R1 + 稀疏何时起作用 + 计算上界 calc）→ 常见误解（7 条）→ 对照源码（五个 H3）。正文（不含 frontmatter、不含空白）由 3761 字增至 22341 字，其中「对照源码」之前的教学正文 14103 字。对照源码之上 0 个角标。

**图。** 新增直觉图 `wiki/diagrams/sparse-attention-intuition.yaml`：12 个历史位置 → indexer 给每个位置打分 → 取最高的 4 个 → 主 attention 只读这 4 个位置的 K/V，在它们之间做 softmax；未选中的位置画成虚线格，并注明仍留在缓存里。新增代码流程图 `wiki/diagrams/sparse-attention-path.yaml`：父类前向 → indexer（triton 或 PyTorch 回退两个分支）→ 位置清单 2051 宽 → 子类重写的稀疏 attention 入口 → A2 基础设备适配器调用稀疏 FlashAttention 内核 → V 解压与输出投影；只供单测的 PyTorch 参考实现画成旁支虚线，标「只有单测调用」。原图 `dense-sparse-attention.yaml` 未改，移到公式一节。

**数字与出处。** 数字取自主线底稿 [02 §5.3–§5.5、§5.9](../../02-forward.md)：pool_topk 512、尾部 0–3、宽 2051（§5.4），≤2051 时等于密集、133120 个位置读 1/65（§5.4），清单缓冲 64.09 MiB + 68.0 MiB = 132.1 MiB（§5.4），每查询每层每卡 33.6 MFLOP、11 层约 370 MFLOP、逻辑读取 2.00 MiB / 22.0 MiB / 24.0 MiB（§5.5），R1 的 [4, 2051] 逐行内容（§5.9）。2048 ÷ 4 与 2048 + 3 的推导只链接 [glm-5-3-flash#稀疏-mla先把历史压短再挑着读](../../../../wiki/concepts/glm-5-3-flash.md)；R1 逐行表只链接 [one-request#11-层稀疏-mla](../../../../wiki/concepts/one-request.md)。说法已与这两页逐句对齐（indexer 五步、「尾部」、「−1 为空名额」、「2051 是容量不是选中数」）。§5.5 的计算上界、逻辑读取量与 §5.4 的清单缓冲此前没有任何页推导过，现放在本页。

**核心概念对照。**

- DSA 原论文 arXiv 2512.02556v1 第 2 节：indexer 打分公式 `I = Σⱼ wⱼ · ReLU(qⱼ · k)`、头少且用 FP8、每查询取 top-k（k = 2048）、主 attention 只在选中位置上计算、核心 attention 从 O(L²) 降到 O(Lk) 而 indexer 仍为 O(L²)、两段训练（先冻结其他参数只训 indexer，用 KL 逼近主 attention 分布；再开 top-k 训全部参数）、建在 MLA 的 MQA 模式上（潜向量由全部查询头共用）。
- GLM 选池：`ops/triton/glm5_next_lightning_indexer.py@db701c1f` L90–L123（只给 `(pos+1)//4` 个完整池打分，其余为 −inf）、L144–L145（`pool_topk = index_topk // index_kpool`，`output_width = index_topk + index_kpool - 1`）、L209–L236（topk 后 −inf 置 −1、展开 ×4、尾部 `pos+1-tail_start` 个）。
- 生产调用链：`sfa_v1.py` L1972–L2028 → `indexer_kpool_mla_v1.py` L1106–L1134 → `glm5_next.py` L1140–L1232 → `ops/glm5_next_lightning_indexer.py` L419–L504 → triton L131–L237；读取侧 `indexer_kpool_mla_v1.py` L1065–L1104 → `device_op.py` L719–L793（A2 经 L2317–L2326 落到 `BaseDeviceAdaptor`）。报错表的 8 条字符串逐条取自这些范围。
- 三版：v0.23（Ascend 2c59ff10）与 v0.26（2ed6cbba）只有逐位置的通用路径（`npu_lightning_indexer`，`sparse_count=2048`，掩码模式 3），没有 kpool；main（baa023ad）有 `attention/indexer_kpool.py`，宽度公式不变（L344–L346，triton L135–L136），`sfa_v1.py` 的 `sparse_mla` 用同一组内核参数。

**出处修正（02 路径复审 P2）。** 已按 [02-path-fix-review #1](../02-path-fix-review.md) 删去 `indexer_kpool_mla_v1.py#L980-L1061`（落在只供单测的 `_sparse_attention_pytorch` 里，L857–L1064），换成生产路径 `#L1065-L1104 → device_op.py#L719-L793`；换之前先 grep 核实：L1065 为 `_execute_sparse_flash_attention_process`，L1092 调 `DeviceOperator.execute_sparse_attention_indexer_kpool_mla(..., sparse_mode=3)`，下一个 def 在 L1106；`device_op.py` L719 起、L796 为下一个 def。**另发现旧 C4 `glm5_next.py#L750-L833` 同样只供单测**：它覆盖 `top_k_per_row_prefill` 与 `indexer_kpool_topk_pytorch`，`git grep` 显示前者只被后者（L966）和单测调用，后者只被单测调用；推理走 `forward_native → forward_ascend`。一并换成 `glm5_next.py#L1140-L1232` 等生产位置。sources 由 4 条变为 20 条，角标全部按新位置重编（S1–S4、C5–C20），不是只改正文措辞。

**不丢信息勾选。** 旧版（p4-checkpoint `14591fd`，本页在该提交新建，此前无历史）逐条清单与勾选见会话 scratchpad `p5/sparse-attention-facts.md`：F1–F17 全部在新版落地，没有删除项。F11 的出处换成生产路径；F15 保留原来的条件语气（「规整的密集内核在某些规模下未必更慢」）。

**单一出处。** MLA 的压缩与不带 RoPE 只链接 `mla.md`（该页尚未重写）；标准注意力与因果掩码只链接 `attention-qkv.md`；掩码模式 3 的含义只链接 `attention-qkv.md#会报什么错`；TP 切法只链接 `tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制`；KV 预算只链接 `glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache`。

**验证。** `pnpm wiki:lint`：本页 0 处；共 9 处失败都来自 `block-table.md`（summary 超 200 字，致其他 8 页的 relations 找不到 block-table）。`pnpm wiki:diagrams --check`：184 张图与 spec 一致，本页两张新图没有警告。`pnpm wiki:audit`：本页 20 条源码来源全部定位（✓）；唯一失败同为 `block-table.md`。本页不在 `standard-pages.json` 名单里，另用 `checkStandard` 单页复算：行内代码 0/千字、角标 0、calc 0.58/千字、相邻块 0、免责 0%，无问题。`pnpm check:content` 通过。三块 calc 用 `parseCalcFence` 逐行解析确认。没有截图，也没有起服务。

**待核与疑点。** main 里 GLM 从模型层到 `sparse_mla` 的完整调用链没有逐行核对；稀疏 attention 内核的实际分块与 HBM 流量、indexer 在长历史下的耗时占比都没有实测。模型页用 131072 个位置举例（约 1.6%），底稿和 one-request 用 133120（约 1.5%、1/65），两者都对，本页跟底稿。按写手做法没读 docs/plans/，所以本批验收要点里的「预算只链 D」没有对照；本页的 KV 预算只链接两机部署页。

## P5 审查（09-28）

审查人：独立审查（Opus 5.5），只审不改页。按 scratchpad `review-template.md` 执行，严格串行、未启动子代理，源码每次读 ≤20 行。

**分数：8 / 10**（P1 0 条，P2 2 条，P3 5 条）。

### 1. 初学者测试（只读前两屏 L41–L75）

我的一句话：稀疏注意力让每个查询先用一个便宜的 indexer 给全部可见历史打分，只挑分数最高的少量位置做真正的 attention；省下的是主 attention 的打分和汇合，代价是 indexer 仍要扫一遍全部历史、全部历史仍要存着，而且模型必须专门为此训练过。——通过。

### 2. 核心概念（逐条对照，均无误）

- 为什么省：L57 从 O(L²) 到 O(Lk)，L63 说 indexer 仍是 O(L²)、头少维度小、用 FP8。对照 DSA 论文（arXiv 2512.02556v1 第 2 节）：一致。
- indexer 打分：L121–L127 写的是 I(t,s)=Σⱼ wₜ,ⱼ·ReLU(qₜ,ⱼ·kₛ)，key 各头共用，k=2048，分数只用来排序。与论文一致；论文里 kₛ 不带头下标 j，所以「各头共用一条 key」是对的。L129 的 MQA 模式、L65 的两段训练（先冻结其他参数、用 KL 训练 indexer，再训练全部参数）也与论文一致。
- GLM 不做 ReLU（L134）：`ops/triton/glm5_next_lightning_indexer.py@db701c1f` L122 是 `scores = tl.sum(k_tile * qbar)`，L173–L175 先合成头加权的 qbar，全程没有 ReLU。✓
- 只给完整池打分（L141）：同文件 L90–L91 为 `causal_pool_len = (pos+1)//INDEX_KPOOL`，再与 request_pool_len 取小值；L123 把其余位置置为 −inf。✓
- pool_topk=512、按池选（每池 4 个位置）、不满时填 −1（L142）：L144 `pool_topk = index_topk // index_kpool`；L209–L227 先 topk，−inf 置 −1，然后展开成 ×4，不足 pool_topk 时补 −1。✓
- 尾部 0–3 个、宽度 2051（L143）：L145 `output_width = index_topk + index_kpool - 1`；L229–L236 为 `tail_count = pos+1-tail_start`。✓
- triton 与回退的分派（L150）：`ops/glm5_next_lightning_indexer.py` L490–L504 的条件是有 triton、在 NPU、输入非空、头维 128、pool_topk ≤ 上限。✓
- 读取侧（L144、L150）：`indexer_kpool_mla_v1.py` L1065–L1104 取出 packed KV，调用 `execute_sparse_attention_indexer_kpool_mla(..., sparse_mode=3)`；`device_op.py` L719–L793 把 query 拼成 `cat(ql_nope, q_pe)`，key 和 value 都用 packed cache，`sparse_block_size=1`、`query_rope/key_rope=None`、`attention_mode=2`；L2317–L2326 在非 A5、非 310P 时返回 `BaseDeviceAdaptor`。✓ 这里专门核了一处可能的出错点：q_pe 真的会拼进 query，但底稿 02 L32/L457/L500 写明 `qk_rope_head_dim=0`，所以点积仍是 512 维，calc 里的「× 512 维」成立。
- TP8 下 indexer 每卡各算一遍、潜向量每卡各存一份（L152）：底稿 02 L391–L402 中 `indexer.wq_b`、`wk_weights_proj` 为 Replicated，64 头 / 8 卡 = 每卡 8 头。✓

### 3. 数字（与底稿 02 §5.4/§5.5 对照）

11 层稀疏 MLA（第 3、7…43 层）、34 层 KDA（底稿 L28/L90）；MTP 层也是稀疏 MLA，共 12 层（L142）；133120 → 33280 池、约 1.5%、1/65（L450）；8×2051×512 ≈ 8.40 M、33.6 MFLOP、11 层约 370 MFLOP、2.00/22.0/24.0 MiB（§5.5，L465–L472）。全部一致，算术也逐项复核过。6 格 21 个、15 个有效格，以及 softmax 例子 0.4/0.2 与 2/3、1/3，也都复算无误。

### 4. 出处修正

- `git diff` 的删除行里有 `indexer_kpool_mla_v1.py#L980-L1061`、`glm5_next.py#L750-L833` 各 1 处；grep 新版页面和三张图的 yaml/svg：两者都是 0 处。✓
- sources 共 20 条：S1–S4 为 3 篇论文和 HF config，C5–C20 为 16 处源码。L253「正文证据索引」里 S1–S4、C5–C20 全部用到，编号顺序与 frontmatter 一致；`sparse-attention-path.yaml` 的 8 个 pins 就是 C5–C12。对照源码之上没有角标。✓
- 不在本页范围、但需要跟进：`mla.md:13`、`attention-cost.md:15`、`attention-backend-family.md:18` 仍然引用只供单测的 `indexer_kpool_mla_v1.py#L980-L1061`。

### 5. 重复与篇幅（重点）

**大小。** 用写手的口径（frontmatter 之后，去掉空白）统计：全页 22,341，其中教学正文（L40–L180）14,103，「对照源码」8,238（占 37%）。用同一口径，one-request 为 49,647，glm-5-3-flash 为 37,267，**所以本页不是全库最长的页**，只是这批深改里增幅最大的一页。各节字数：L41 1,754｜L55 2,474｜L76 2,001｜L109 2,051｜L137 3,877｜L171 1,946｜怎么开 903｜报错 1,600｜开销 1,026｜版本 1,280｜源码位置 3,429（其中证据索引 L253 为 922）。

**和另两页讲同一件事的段落**（字数不含空白）：

| 主题 | 本页 | glm-5-3-flash | one-request |
|---|---|---|---|
| DSA/indexer 是什么 | L45–L47（约 380） | L153（约 480） | L282–L284（约 490） |
| GLM 与 DSA 的差别：按池选、不做 ReLU、补尾 | L131–L135（558）+ 四步中的 L141–L143（660） | 五步 L155–L163（1,450） | L284（323） |
| 2051 的由来与「容量不是选中数」 | L143（235）、L177（148） | calc L177–L183（约 290） | L286（约 360） |
| 短历史等于密集；长历史 133120 → 1.5%、1/65 | L59（258）、L156（334） | L185（约 260，用的是 131072、1.6%） | L295（约 450） |
| R1 的 [4, 2051] 逐行 | L154（418） | — | L286–L293（约 630） |

重叠大约 2,400 字，占教学正文 17%。

**判断：本页讲机制，那两页讲算例和结构，不要反过来。** 理由：本页 aliases 已含「稀疏 MLA 的位置选择」，−inf、−1、尾部、等价于密集这些边界情况，问答时需要集中在一处；one-request 的职责是 R1 这个实例；glm-5-3-flash 的职责是模型结构（压池门控、indexer 形状表、五步清单）。2051 的两行 calc 可以按现有 relations 继续留在模型页。

**精简建议：**

1. L154 的 R1 段（418）压成一句话加链接到 one-request（约 120），省约 300。
2. L131–L135「改了三处」（558）与 L141–L143 的四步重复：保留四步，把「三处」压成一句对照（约 150），省约 400。
3. L59 删去 133120/1/65 那句，只留「2048 + 最多 3 个尾部，见后文」，省约 150。同时修正它的链接：1/65 的推导在本页 L156，one-request L295 里并没有 1/65。
4. L177 这条误解与 L143 以及 one-request L286 重复，删掉，省约 150。
5. 「开销」一节 L209 重复了 33.6 MFLOP 和 2.00 MiB，改为链接回 calc，省约 80。
6. L150（500）和 L179（218）讲的是代码分支和单测常量，挪到「源码位置」并压到约 350。全页总量不变，教学正文少约 600。

预计：全页约 22,341 → **21,000**，教学正文约 14,103 → **12,400**。增长的主体是真实的新内容：论文机制与训练、计算上界、读取量、清单缓冲、8 条报错、三版差异、证据索引。**所以不算注水，但有约 1,000–1,300 字的重复可以去掉。** 另外两页配套：glm-5-3-flash L185 改成链接到本页的 GLM 一节（并统一用 133120），one-request L295 的后半句改成链接，这两页合计约可省 400。

### 6. 有没有丢信息

旧版为 14591fd，共 5 个 H2。我按 `git diff` 的删除行逐条对照新版，另从 facts 清单中抽查 6 条：F4 n(n+1)/2 → L57 ✓；F5 21/15 格且不是 GLM 的模式 → L105 ✓；F7 [ln2,0,0,0] 两组权重 → L88–L97 ✓；F8 两层约束加请求边界 → L107 ✓；F14 历史全部保留、池 key 与尾部状态 → L64、L174 ✓；F15 块访问/补齐/融合、密集内核未必更慢 → L175 ✓。旧 aliases 和旧 relation 也都保留了。没有发现丢失。

### 7. 链接和锚点

正文 19 个不同的链接目标，用 `src/content/wiki/anchors.ts` 的 headingSlug 规则逐个解析，全部命中。全库有 8 页链接到本页，都不带锚点，所以旧 H2 改名不会造成断链。对照源码的五个 H3 齐全、顺序正确；「版本差异」里 v0.23、v0.26、main 都有。教学正文行内代码 0 个；每节至多 1 个 calc（L88、L160、L212）；表格与 calc 不相邻。

### 8. 工具

`pnpm wiki:audit`：本页 20 条来源中 16 处源码行号全部 ✓，全局最后一行为「ok wiki:audit … 通过」。写作记录里说的 block-table 失败现在已经不存在。`pnpm wiki:lint`：通过，与本页相关的警告 0 条。

### 问题清单

**P1：无。**

**P2**

1. **同一结论在三处推导（L59、L156）。** 「≤2051 等于密集；133120 → 33280 池、1.5%、1/65」在本页出现两次，one-request L295 和 glm-5-3-flash L185（用 131072、1.6%）又各推一遍，违反「数字只在单一出处推导」；L59 还把 1/65 的推导错误地指向 one-request。改法：以本页 L156 为唯一出处，L59 改为指向本节；另两页改成链接，并统一用 133120。
2. **与相邻页及页内重复约 1,000–1,300 字（L131–L135 对 L141–L143、L154、L177、L209）。** 改法见第 5 节的第 1–5 条。

**P3**

1. L150、L179 以及路径图里的「父类/子类重写」都是代码层细节，放在对照源码之上，初学者读不懂。建议挪到「源码位置」，正文只留一句「NPU 上走 triton，其余走同公式的回退」。
2. 有几个术语先用后讲：triton（L150）、A5/310P（L150）、All-Reduce（L144）、MTP 层（L169）、「本基线」（L134）。建议首次出现时给一句解释，或者直接删掉。
3. L131 说「改了三处」，但模型页 L187 写着 indexer 也不带 RoPE，精度链路也不是 FP8。建议改成「主要改了三处」，或者补一句链接。
4. L150 说「一个 triton 算子就做完打分、选池、展开和补尾」：实际上 triton kernel 只算池分，topk、展开、补尾是同一个包装函数里的 torch 操作（triton 文件 L209–L236）。建议改成「triton 路径一次调用做完」。
5. 跨页跟进：mla / attention-cost / attention-backend-family 三页仍引用只供单测的 L980–L1061。

### 跳过与未做

- frontmatter 的 sources 区只用 grep 核了 pins，没有逐条读。
- 「对照源码」正文没有读，只 grep 了 H3、版本号、证据编号和几行的字数。
- L80–L84、L123–L125 两个公式块随正文一起读到，没有单独核；其余代码块没有读。
- 没有读取被拦。
- 没有在浏览器里看三张 SVG 的渲染效果。
- 没有核 S4（HF config）里的 index_kpool=4。

## P5 修订记录（09-28，按 P5 审查）

**口径。** 字数沿用写作记录：frontmatter 之后去掉空白，按 UTF-8 字节计（写作记录的 22341 / 14103 就是这个口径；按字符数是 10926 / 6239）。

**改了什么。**

1. **长历史结论收成单一出处（P2-1）。** 「≤2051 等于密集；133120 → 33280 池、约 1.5%、1/65」只在本页推导，放进 GLM 双机一节新加的 H3「稀疏什么时候才真的起作用」，给别页一个稳定锚点。R1 段并进这个 H3 的第一段，作为短历史的实例，压成一句并链接 one-request。one-request 原句里有、本页原来没有的两点已先补进：133120 是部署的最大上下文长度（底稿 02 L14），以及这是「最后一个查询」面前的池数。证据索引的推导口径也同步写明了 133120 的来源。
2. **L59 链接改正。** 原来指向 one-request#11-层稀疏-mla，那里并没有 1/65 的推导。现改为页内 #稀疏什么时候才真的起作用，并删去这句里的 133120 和 1/65。L53 末句「GLM 最多读 2051，放在后面讲」与 L59 重复，也删去。
3. **精简（P2-2，第 5 节建议 1–6）。**
   - 「GLM 改了三处」的三条列表压成一句。kpool 的定义、不做 ReLU、尾部这三点都保留，因为四步里没有讲 ReLU，不能只留四步。按 P3-3 改为「主要改了三处」，并去掉「本基线」。
   - 删去误解「2051 是选中数或头数」，把「也不是头数」并入四步的第 3 步。
   - 「开销」一节里的 33.6 MFLOP 和 2.00 MiB 改为链接到 calc 所在的 H3。
   - 原 L150 的代码分支说明和误解「单测每 16 个查询一块」挪到「源码位置」。按 P3-4 改正了说法：triton 核只算池分，选池、展开、补尾是同一个包装函数里的 torch 操作。正文只留一句「triton 或回退」，并给 triton 一句解释（P3-2）。
   - 页内重复改为回指上文：第 2 笔代价，以及「删项」「只缓存 2051」「部署开关」三条误解。另外，四步第 2 步去掉了与上一节重复的模型页链接；indexer 公式后面与开篇重复的「取最高 k 个、只在这些位置上计算」只留下 k = 2048；MQA 那句去掉了同义重复。
   - 顺带处理 P3-2：All-Reduce 链接到 collective-communication#all-reduce；MTP 链接到 speculative-decoding，并用半句话说明。
4. **另两页。** glm-5-3-flash L185、one-request L295 各压成一句结论，链接到本页新的 H3，数字统一用 133120（去掉模型页 131072 / 1.6% 的例子）。one-request L545 的链接也补上了这个锚点。

**字数。** 全页 22,341 → 21,410，教学正文 14,103 → 12,718，对照源码 8,238 → 8,692（挪入了分支说明）。比审查预估的 21,000 / 12,400 分别多约 400 和 300。多出来的是两部分：为 P3 补的解释（triton、MTP、All-Reduce 链接、133120 是部署上限），以及「三处」那句为保留 ReLU 等独有信息没能压到 150。

**不丢信息。** 删掉的每一句都能在本页别处或链接目标里找到：R1 逐行 → one-request 的表；「选中一池读 4 个位置」→ 第 3 步；「单测每 16 行一块」「父类同名方法与参考实现只有单测调用」→ 源码位置；原来的「GLM 最多读 2051」→ L59 的 2048 + 3。

**核对。** 分派条件对照 vllm-ascend@db701c1f 的 ops/glm5_next_lightning_indexer.py L488–L504（_can_use_triton 的五个条件）；triton 包装函数对照 ops/triton/glm5_next_lightning_indexer.py L10 文档串和 L184–L237；133120 对照底稿 02 L14、L450。

**验证。**

- pnpm wiki:lint 通过，19 处待留意都不在这三页。
- pnpm wiki:diagrams --check：186 张图一致。
- pnpm wiki:audit 通过，本页 16 处源码行号全部 ✓。glm-5-3-flash、one-request 是名单页，写作标准各项全部 ✓。
- 用 anchors.ts 的 createSlugger 写脚本，解析了三页全部带锚点的站内链接（17 / 16 / 21 条），全部命中。
- 没有截图，也没有起服务。

**未做。**

- mla.md:13、attention-cost.md:15、attention-backend-family.md:18 的 sources 仍引用只供单测的 indexer_kpool_mla_v1.py#L980-L1061。这三页在后续批次处理，本次没有改。
- 流程图 sparse-attention-path.yaml 上的「父类/子类重写」标注没有改（P3-1 的图面部分）。
