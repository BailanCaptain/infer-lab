# attention-qkv 审查记录

## P5 写作记录（2026-09-28，第 03 批，深改）

### 改了什么

- 按「先直觉、后数字」重排为：首屏「当前位置怎样从历史里取信息」（一句话定义 + 直觉图）→「为什么需要它，代价在哪」（133,120 token 满长时的读取量作动机，4 行相邻概念表）→ Q/K/V 来源 → 一个查询怎样得到输出 → 为什么要除以 √d（新增）→ 因果掩码（保留原 H2 标题，kv-cache 页的入链锚点不断）→ 多头 → 落到 GLM 双机（稀疏 MLA / KDA / 三种形式对照）→ 常见误解（9 条）→ 对照源码（五个 H3）。
- 图：`attention-qkv-flow` 改画成直觉图（位置 2 的 q 给 k₀–k₂ 打分 → 除以 √d → softmax → 按权重汇合 v），图上不放手算数字；`attention-causal` 的 decode 一侧把 K₀–K₃ 标成读自 KV cache、K₄ 本步新算；`attention-heads` 补上输入与 Q/K/V 投影按头切段；新增 `attention-glm-paths`（主线第 4 站一层 attention 的两条分支与合流，带源码 pins，作为代码流程图）。四张图宽均 ≤ 900px，只渲染了这四张的 SVG，没有改写其他页的图。
- 模型配置来源从 eb9eb208 改为写作标准钉住的 690b7052；来源由 5 条增至 18 条，全部行号在 `wiki:audit` 下有效。
- relations：保留 layers-and-hidden、matmul-and-weights，新增 one-request；kv-cache、mla、sparse-attention、linear-attention、gqa 已由对方页写 builds-on 指回本页，按 lint 规则不在本页重复。

### 数字取自哪里

- 02 §0.2 模型形状：45 层、34 层 KDA + 11 层稀疏 MLA、64 头、qk_nope 256 / rope 0 / v 256、kv_lora_rank 512、KDA 64 × 128、短卷积 4；MLA 缩放 256^-0.5 = 0.0625。另对照本机 `official-config.json` 的 `full_attn_layers = [3, 7, …, 43]`、`num_key_value_heads = 64`。
- 02 §4.3：KDA 64 头 / TP8 = 每卡 8 头，投影 8192 维、每卡 1024 维，o_proj 行切后一次 All-Reduce。
- 02 §5.2：MLA 低秩投影与切法、q 256 → 吸收后 512、V 解压 512 → 256、每卡 2048 → o_proj 4096；索引器与潜向量逐卡复制。
- 02 §5.9：R1 prefill 各步形状与 All-Reduce 32,768 B（正文只写结论并链接 one-request 的「34 层 KDA」「11 层稀疏 MLA」「一次前向的通信账」）。
- 32,768 个数链接 glm-5-3-flash；133,120 token 与 2,051 个位置链接 kv-cache 代价一节；TP 切法链接 tensor-parallel（已 grep 该页 attention 相关段，64 头 / 每卡 8 头、KDA [4,1024]、MLA [4,8,512] → [4,2048] → [4,4096] 与底稿一致）。
- 本页自推：e¹⁶ ≈ 8,886,111、1/√128 ≈ 0.0884、手算例（教学假设，已在 calc 旁注标明）。

### 核心概念对照了什么

- 《Attention Is All You Need》（arXiv 1706.03762v7）3.1、3.2 节：缩放点积公式 softmax(QKᵀ/√d_k)V；除以 √d_k 的理由与脚注的方差论证（均值 0、方差 1 的独立分量，点积方差为 d_k）；多头公式、W 形状、h = 8、d_k = d_v = 64、总计算量与全宽单头相近；解码器在 softmax 输入处把非法连接设为 −∞；self-attention 的 Q/K/V 来自上一层输出，编码器—解码器注意力的 Q 来自解码器、K/V 来自编码器。
- vLLM@0fc695fc `Attention` 类（177–210 行）与 `AttentionType`（backend.py 32–44 行）：scale 由模型传入、K/V 先进缓存再做 attention、默认 DECODER；v0.26（568afb3a）与 main（84030bbe）同路径同默认。
- vllm-ascend@db701c1f：glm5_next.py 2075–2105（按层选 KDA/MLA）、1881–2030（`scaling = qk_head_dim ** -0.5`，RoPE 分支不进）；indexer_kpool_mla.py 39–182（不构造通用 MLAAttention，scale 传入实现）；sfa_v1.py 576–592（`self.scale`）、1994–2028；device_op.py 719–793（`scale_value`、`sparse_indices`、只支持 sparse_mode=3）；kimi_kda.py 244–291、366–472（q/k/v 投影、L2 归一化、`head_dim**-0.5`，无逐位置 softmax）；utils.py 763–768（0.23.0 下替换为 AscendKimiGatedDeltaNetAttention）。main（baa023ad）glm5next/attention.py 140–175 与 model.py 292–306。

### 旧版信息清单勾选

清单全文在会话 scratchpad `p5/attention-qkv-facts.md`，22 条全部有去向，无删除：

| # | 旧版要点 | 新版去向 |
|---|---|---|
| F1 | MLP 逐位置、attention 引入上下文、输出交残差 | 首屏第 3 段 |
| F2 | 稀疏 MLA / KDA 不能都画成 QKᵀ→softmax→V | GLM 节首段、两 H3、对照表 |
| F3–F5 | Q=XW_Q 等；Q/K/V 作用表；K、V 分开与逐层累积上下文 | 「Q、K、V 从哪里来」整节 |
| F6–F7 | 三行公式、m_ij、与词表 softmax 区分 | 「一个查询怎样得到输出」 |
| F8–F9 | 手算例 [ln2,0,0,−∞] → [0.5,0.25,0.25,0]，输出 [1.5,1] | 手算 calc + 因果掩码节第 2 段 |
| F10 | 缩放控制尺度、减行最大值、内核决定是否落显存 | 「为什么要除以 √d」整节 + 查询节末段 |
| F11–F14 | 因果掩码、R1 四位置、KV cache 只存 K/V、T 与 S 两个维度、合批隔离 | 因果掩码节（补 R1 decode 的 T = 4、S = 8） |
| F15–F16 | 多头、头不保证可命名、Q/KV 头分别配置、GQA | 多头节 |
| F17 | 64 头、256/256、64×256 → 4096、逻辑头 ≠ 64 份 K/V | 稀疏 MLA「存什么」「怎么比」+ 误解 |
| F18–F19 | 三种结构对照；KDA 也算 QKV，搜 q_proj 不足以判断 | 对照表、KDA「第三」、误解、「怎么开」 |
| F20 | 数字依据来源基线；无分片展开与耗时实测 | 来源基线链接挪到「来源与结论对应」；分片链 TP 页；耗时写入待核 |
| F21–F22 | relations、aliases | 全部保留；新增项见上 |

### 验证

- `pnpm wiki:lint`：通过（另有 22 处待留意，其中本页无）。
- `pnpm check:content`：通过。
- `pnpm wiki:diagrams --check`：169 张图与 spec 一致；本页四张图无溢出、无重叠。
- `pnpm wiki:audit`：本页 18 条来源，16 条行号有效、2 条 URL 未联网验证；全局通过。
- 按写作标准手动强制检查（scratchpad `p5/check-any.mts`）：教学正文 4591 字，行内代码 0/千字，对照源码之上角标 0，calc 0.65/千字，无相邻块，图先行，免责 0%，图宽合格，PASS。
- 未起服务、未截图，浏览器验收留给审查环节。

### 疑点

- 写作标准说通用直觉图「不编造数字算例」，旧版手算例是用户可见的已有事实。处理：直觉图只画符号和相对长短，手算数字放在后面的 calc，旁注写明是演示数字。
- sparse_mode=3 的掩码语义没有在源码里找到说明，正文只写「只支持 3」，没有解释它对应哪种掩码。R1 decode 时本轮 4 行之间的遮挡由数学定义推出，未对照稀疏 attention 内核的掩码实现逐项核验，已写入页末待核。

## P5 审查（09-28）

独立审查，只审不改页。审的是工作区里未提交的深改稿（wiki/concepts/attention-qkv.md，04:53 版）。

### 结论

**9 / 10。P1 0 条，P2 0 条，P3 5 条。** 核心概念没有错；GLM 的数字和 02 底稿一致；抽查的 6 条旧版信息都还在；链接和锚点全部能解析。写手的两个疑点这次在源码里查到了答案，页面可以把待核缩小（见 P3-2）。

### 1. 初学者测试（只读前两屏，L39–L69）

我的一句话：attention 让当前位置拿 q 给自己和此前每个位置的 k 打分，softmax 把分数换成加起来等于 1 的权重，再按权重把这些位置的 v 加成一条新向量；代价是计算量随长度平方增长，而且历史的 K、V 要一直留在 KV cache 里，每一步都要读一遍。

→ 通过。首屏是问题式 H2、加粗的一句话定义和直觉图；第二屏讲为什么需要、两条代价，再用 133,120 token 的满长请求引出 GLM 的两种替代方案。

### 2. 核心概念（对照《Attention Is All You Need》3.1、3.2 节）

| 检查项 | 页面位置 | 判定 |
|---|---|---|
| 公式 softmax(QKᵀ/√d_k)V，拆成打分、softmax、汇合三步，m_ij 是掩码项 | L91–L99 | 对 |
| 除以 √d：假设各维独立、均值 0、方差 1，点积方差是 d_k，会把 softmax 推进梯度极小的区域 | L116–L118 | 对。原文用的是 "We suspect"，页面写「论文指出」语气偏强（P3-1） |
| e¹⁶ ≈ 8,886,111；缩放后 e ≈ 2.72 | L120–L125 | 对（e¹⁶ = 8,886,110.5） |
| 缩放系数是模型定义的一部分；d 指每头 q·k 的宽度，不是隐藏宽度，也不是缓存宽度 | L127 | 对 |
| 多头：h 个头各算一遍再拼接，乘 W_O；W 的形状；基础模型 h = 8、d_k = d_v = 64；总计算量与全宽单头相近 | L147–L156 | 对 |
| 因果掩码：在 softmax 输入处把非法连接设为 −∞；prefill 同样要遮挡 | L131–L133 | 对，和原文 3.2.3 节一致 |
| decode 时只为新位置算 q、k、v，历史的 K、V 从缓存读，缓存不存 Q | L141、误解 L219 | 对 |
| self-attention 的 Q/K/V 同源；编码器—解码器 attention 的 Q 来自解码器、K/V 来自编码器 | L79 | 对 |
| softmax 减行最大值、中间分数表是否写进显存由内核决定 | L112 | 对 |

### 3. GLM 两类 attention 与数字

- **范围**：L166–L211 只讲和标准形式差在哪（存什么、怎么比、读哪些、有没有 softmax、缩放）。推导链到 [MLA](mla.md)（L180）、[linear-attention](linear-attention.md)（L196、L198）、[sparse-attention](sparse-attention.md)（L182），R1 的形状链到 one-request，符合要求。
- **数字对照 02 底稿**：
  - §0.2（L26–L36）：45 层；34 层 KDA 加 11 层 MLA（第 3、7…43 层）；MLA 64 头，qk_nope 256，rope 0，v 256，kv_lora 512，缩放 0.0625；KDA 64 头 × 128，短卷积核 4；MTP 1 层。与页面 L168、L180、L183、L187–L189 一致。
  - §0.3（L41）：decode 一步是 1 个真 token 加 3 个草稿，T = 4，seq_len = 8。与页面 L143 一致。
  - §4.3（L271–L273）：每卡 8 头，投影 8192，每卡 1024，o_proj 做一次 All-Reduce。与 L198、L200 一致。
  - §5.2（L380–L402）：q 每头 256，吸收后变 512；V 解压 512→256；每卡拼成 2048，o_proj 回到 4096；q_b 的全局宽度 16,384；潜向量和索引器逐卡复制。与 L181、L192 一致。
  - §5.4（L439、L450）：上限 2051，R1 的 4 到 8 个位置全部选中，等价于稠密 attention。与 L182、L223 一致。
  - 02 L57 写 MLA 类权重为「11 个 MLA 层 + MTP 层 45」，即 MTP 层也是 MLA：与页面 L168 一致。
  - All-Reduce 32,768 B（02 L230）：与 L211 一致。
  - 32,768 个数：64 × (256 + 256) = 32,768，与 L180 一致。
- **KDA 缩放 1/√128 ≈ 0.0884**：底稿里没有，我直接查了源码。vllm-ascend@db701c1f 的 vllm_ascend/ops/kimi_kda.py，decode 在 L380 用 `scale=self.head_dim**-0.5`，prefill 在 L465 给 `chunk_kda_fwd` 传 `self.head_dim**-0.5`，head_dim 是 128 → 对。
- **新图 attention-glm-paths**：各框的数字（8 头 × 128、每头 128 × 128、512 维每卡一份、2,051、256→512、乘 1/16、512→256 拼成 2048、回到 4096、TP8 All-Reduce、四路残差）都和上面对得上。

### 4. 写手的两个疑点

**① sparse_mode=3 是哪种掩码：查到了，是右下角对齐的因果掩码（right-down causal）。** 依据都在 vllm-ascend@db701c1f，每处只读了 ≤ 20 行：

- vllm_ascend/attention/attention_v1.py:836：`sparse_mode = 4 if self.sliding_window else 3 if attn_metadata.causal else 0`；vllm_ascend/device/utils.py:56：`sparse_mode = 3 if attn_metadata.causal else 0`。也就是说，因果 → 3，滑窗 → 4，不加掩码 → 0。
- vllm_ascend/attention/context_parallel/sfa_cp.py:1303–1307 的注释说：DCP 重映射之后，局部 KV 长度和全局查询长度不在同一套坐标里，「so SFA must not apply its right-down causal crop」，所以这里改传 0。这说明 SFA 内核在 3 时做的就是右下对齐的因果裁剪。
- vllm_ascend/device/device_op.py:730、736–737：GLM 的 Indexer KPool MLA 入口默认 `sparse_mode: int = 3`，传别的值就报页面 L245 那条 ValueError；vllm_ascend/attention/indexer_kpool_mla_v1.py:1102 传的也是 3。

**② R1 decode 新算的 4 行互相遮挡：推理对，页面也如实标了。**

- 为什么对：验证草稿时，必须和逐个生成算出同样的结果，所以位置 5 不能看到 6、7。右下对齐的因果掩码取 T = 4、S = 8 时，第 r 行能看到键 0…4 + r：位置 4 看 0–4，位置 7 看 0–7。这正是页面 L143 写的「本轮这 4 行之间仍按位置遮挡」。
- 还有第二层：索引器的 top-k 本身也逐行按因果范围选（02 §5.9 L549，prefill 前 3 行各只有 1/2/3 个尾部位置），sfa_cp.py:1303 的注释也写了 indexer "already applies the causal visibility rule"。
- 标注：正文 L143 直接陈述，没加标注；页末 L290 写明「由数学定义推出，未对照稀疏 attention 内核的掩码实现逐项核验」，属于如实标注。有了上面的源码证据，可以把待核缩小，见 P3-2。

### 5. 有没有丢信息

- `git diff` 删掉的旧版正文逐行对照过。清单 22 条，抽查了 6 条：
  - **F2**：两类结构不能都画成 QKᵀ→softmax→V → L166–L208，模型页链接在 L180。在。
  - **F9**：V=[2,0],[0,2],[2,2] → [1.5,1]，「输出仍是一条向量」 → L108、L112。在。
  - **F12**：R1 prefill 算位置 0–3，decode 只新增位置 4 并加入它自己的一份 → L139。在。
  - **F15**：多头的作用、头不保证能叫出名字、4 头只是示意 → L147–L156，attention-heads 图注。在。
  - **F17**：64 头，256/256，64 × 256 → 4096，逻辑头 ≠ 缓存里有 64 份 K/V，链 MLA → L180–L181、L221。在。
  - **F20**：数字来源基线，未展开分片，没有耗时实测 → L282 链接来源基线，分片链到 TP 页，L211、L253 写了无实测。在。
- 顺带核了 F22 aliases：旧的 16 个都保留，另新增 7 个。

### 6. 链接与锚点

- 用 src/content/wiki/anchors.ts 的同一套 slug 规则写脚本逐条解析：出链 37 条，坏 0 条；全库指向本页的 md 链接 11 条，坏 0 条，包括 kv-cache.md:76 的 `#因果掩码限定每个位置能访问的历史`。
- relations 引用本页的 9 页（attention-backend-family、context-parallel、dynamic-chunked-pp、gqa、kv-cache、linear-attention、mla、rope、sparse-attention）由 lint 校验，没有针对本页的报错。

### 7. 工具检查

- **`pnpm wiki:audit`**：全局 ok。本页 18 条来源里，16 条行号有效，2 条 URL 未联网。本页不在写作标准名单内，所以 audit 不跑写作标准这一项。
- **手动核写作标准**：L38–L226 去掉代码块后，行内代码 0，角标 0；每节最多 1 个 calc（L103、L120、L185）；没有表格和 calc 相邻；对照源码有五个 H3，顺序是 L229 → L239 → L249 → L255 → L268；版本差异（L257、L259）里 v0.23、v0.26、main 都在。
- **`pnpm wiki:diagrams --check`**：170 张图与 spec 一致。
- **`pnpm wiki:lint`**：**当前失败 4 处，都不是本页的问题**。layers-and-hidden.md 的 summary 超过 200 字，schema 不合法；该文件 04:59 还在被修改，比本页晚。因此本页、mlp-residual-norm、pipeline-parallel 连带报 relation-missing。
- **浏览器**：5193 的阅读页因为同一个原因返回 500，`virtual:wiki-reader-snapshot` 报「知识库页面不合法」，没法在阅读页里实测本页。退一步，直接在浏览器里打开了 attention-glm-paths.svg 和 attention-qkv-flow.svg，渲染正常，没有重叠或溢出。**本页在阅读页里的整体排版尚未验证**，要等 layers-and-hidden 修好后补看。

### 8. 问题清单

**P1：无。P2：无。**

**P3**

1. **L118**「论文指出，这时 softmax 处在梯度极小的区域」：原文是 "We suspect"。
   - 改法：改成「论文推测」或「论文认为」。
2. **L245、L253 后的待核（L290）**：页面没有说 sparse_mode=3 是什么掩码，4 行遮挡整条都挂在待核里。
   - 改法：L245 的说明补上「3 = 右下对齐的因果掩码」。L290 的待核缩成「内核实现未审，语义取自 attention_v1.py:836 的 causal→3 映射和 sfa_cp.py:1303–1307 的注释」。来源里补上这两处。
3. **L182「一个叫索引器的小网络」**：这里只用中文，而链接过去的 sparse-attention 页只用 indexer，读者跳过去对不上名字。
   - 改法：首次出现写成「indexer（索引器）」。
4. **术语先用后讲**：L60 首次出现「KDA」「稀疏 MLA」时只有功能描述，没有全称（KDA 的全称到 L196 才出现）；L69 的「logits」没有解释。
   - 改法：L60 写「KDA（Kimi Delta Attention）」；L69 给 logits 补半句「模型给词表里每个词打的原始分数」。
5. **L198、L181 的每卡切分数字**：8192→每卡 1024、每卡拼成 2048 再回到 4096，这些在 tensor-parallel 页已有推导，属于重复推导，数字目前一致。
   - 改法：可以只留「每卡 8 个头」，其余链到 TP 页。64 × 256 = 16,384 → 4096 是旧版 F17 的内容，要保留。

### 9. 跳过的段

- frontmatter 的 sources（L9–L27）。
- 「## 对照源码」正文 L227–L290：只用 grep 看了 H3 顺序、版本号，以及命中的 L245、L253、L257、L266、L282、L285、L290。
- 代码块 L75–L77、L93–L97、L149–L152，calc 块只核了算式。
- 没读 HANDBOOK、docs/plans；TERMS.md 只 grep 了「索引器」。
- 旧版全文 scratchpad/p5/attention-qkv-before.md 只 grep 了 6 行；清单文件 attention-qkv-facts.md 全读（27 行）。
- 没有读取被拦。

## 修订记录（2026-09-28，sparse_mode=3 待核改结论）

依据本审查「4. 写手的两个疑点 ①」与 P3-2。只动「对照源码」区，正文不改。

- **会报什么错：** 表格第 3 行补「（右下对齐的因果掩码）」；表下说明补一段：sparse_mode=3 = 右下对齐的因果掩码，本轮 T 个查询对齐到 S 个键的最后 T 个位置，第 r 行只能看到键 0 到 S − T + r；通用 attention 后端把因果映射成 3、滑窗 4、不加掩码 0 [C19]，上下文并行路径注释称其为右下对齐因果裁剪、因坐标重映射改传 0 [C20]。
- **来源：** frontmatter 新增来源 19 `vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L836-L836`、来源 20 `vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/sfa_cp.py#L1303-L1307`；本轮用 `git show db701c1f:<路径>` 重新读过这两处，内容与审查引用一致。依据列表 MLA 那一条补「3 即右下对齐的因果掩码，对照来源 19、20」和角标。
- **待核：** 「R1 decode 本轮 4 行遮挡由数学定义推出，未对照内核掩码实现」改为结论「与 sparse_mode=3 的右下对齐因果掩码一致（语义取自来源 19、20），内核内部掩码实现未审」。
- **验证：** `pnpm wiki:audit` 本页写作标准全部 ✓（行内代码 0、角标 0、calc 0.65/千字、相邻块 0），来源 20 条，新增两条行号有效；`pnpm wiki:lint` 无本页条目。两者的失败只来自 concepts/ascend-patch-system.md 及其引用页、diagrams/patch-binding.yaml 缺 svg，与本页无关。
