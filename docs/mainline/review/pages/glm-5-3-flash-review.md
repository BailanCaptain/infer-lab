# 审查：wiki/concepts/glm-5-3-flash.md

- 审查日期：2026-09-27
- 被审文件：`wiki/concepts/glm-5-3-flash.md`（330 行，未跟踪的新文件），以及它引用的 4 份图 spec：`wiki/diagrams/glm-flash-{overview,layer,attention,moe}.yaml`（4 张 SVG 的修改时间都晚于 yaml，`glm-flash-attention.svg` 里有「池 0 · 未选中 / 池 1 · 选中 / 尾巴 · 总会读」三个标签）
- 核对依据：
  - config：`infra-view-hardware-study-20260906/glm-flow/reference/official-config.json`，只用脚本取 `text_config` 的字段、`quantization_config`、`vision_config`
  - 权重形状：同目录的 `checkpoint-shapes.json`（HF revision `690b7052` 的 safetensors 头，2062 条）
  - 执行侧：`git show db701c1f:` 读 `vllm_ascend/models/glm5_next.py`、`ops/kimi_kda.py`、`ops/triton/kda/kda.py`、`utils.py`、`glm5_next_mtp.py`、`spec_decode/llm_base_proposer.py`、`quantization/modelslim_config.py`、`quantization/methods/w8a8_dynamic.py`、`ops/fused_moe/experts_selector.py`；上游用 `git show 0fc695fc:` 读 `kimi_gdn_linear_attn.py`、`cpu_fused_moe.py`（`git describe 0fc695fc` = `v0.23.0`）
  - 对照页：`wiki/concepts/glm-5-3-flash-two-node.md`、`docs/mainline/02-forward.md`，都只用 grep；`wiki/TERMS.md` 读了前 60 行
  - `npx tsx scripts/wiki-lint.ts`：通过，本页没有任何警告
- 没有读取被拦截的文件。没读 HANDBOOK.md 和 docs/plans/。

## 一、10 项评分

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 开头能否让初学者看懂模型整体长什么样 | 1 | 模型的整体形状都讲到了：45 层，34 KDA + 11 稀疏 MLA，前 3 层稠密、后 42 层 MoE（288 选 8 + 1 个共享专家），4 条 residual 流，1 个 MTP 层。L66 的总览图也有用。问题有两个：第一节（L44–52）只讲范围和来源，没有给出一句话讲清模型长什么样；真正的形状塞在 L59 这一条列表项里，一口气引入 residual 流 ×4、attention、Q/K/V、分数、头、MLP，接着两条子项又给出 128×128、512 维、288/8。初学者很难一次读进去（见 P2-5）。 |
| 2 | 维度准确性 | 2 | 按第二节的清单，config 字段逐项核对，**0 处对不上**。层型编号、KDA/MLA/索引器的各项维度，和权重文件里的张量形状也逐一对过，全部一致。 |
| 3 | 参数量 3133 亿 / 97% | 1 | 按 config 重算，主干是 **3133.27 亿**，路由专家占 **97.15%**。按 `checkpoint-shapes.json` 逐张量加总，结果完全一样。表里每一行都对得上（算式见第三节）。扣分的原因：「174 亿」和模型卡的「激活参数 18B」只写成了「待核」，其实按 config 就能凑出两种约等于 18B 的口径；页面也没有明说「174 亿就是本页口径下的激活参数」。读者面前有三个总数（3133 / 3213 / 320B）、三个激活数（174 / 167 / 18B），不知道该引用哪个（见 P2-2）。 |
| 4 | 由浅入深 | 1 | 两条链之一，linear attention → DeltaNet → Gated DeltaNet → KDA（L118–133），讲得准确、层次清楚。公式 `S ← (I − βkkᵀ)Diag(α)S + βkvᵀ`、`o = Sᵀq` 与 Kimi Linear 的写法一致，并把 GLM 实现里的有界门（`−5·sigmoid`）和原始 KDA 门分开讲（kda.py L1276–1288 两个分支都在）。residual → Hyper-Connections → mHC 这条也好。另一条 MLA → 去掉 RoPE → 索引器 / kpool 有缺口：① 索引器从哪来没交代。config 的 `layer_types` 写的就是 `deepseek_sparse_attention`，但全页没有提 DSA / DeepSeek-V3.2 的 lightning indexer，也没有分清「DSA 按 token 挑」和「GLM 按 4 个 token 一池挑」（P2-3）；② 「去掉 RoPE」只说了 GLM 设成 0，没讲 DeepSeek 原版 MLA 为什么非得另留一段 RoPE 的 K（和矩阵吸收冲突），读者体会不到去掉它换来了什么（P3-1）；③ L156「对顺序敏感的计算只剩……」说过头了，和本页 L163 自相矛盾（P2-4）。 |
| 5 | 图有没有用 | 2 | 四张图都在讲机制，不是堆方框。attention 图的下半部分确实改成了「按池画」：11 个位置分成池 0（未选中）、池 1（选中）和 3 格尾巴（总会读），和源码对得上。`history_group_budget_for_topk` 算出 topk / pool_size = 512 个池（glm5_next.py L516–520），`expand_pools_to_tokens` 把池号展开成 `pool_id × 4 + 0..3`（L547–553），`append_tail_to_topk` 的尾巴宽度是 pool_size − 1 = 3（L599–616），`topk_indices_buffer` 的宽度是 `index_topk + index_kpool − 1` = 2051（L2254–2259）。可改进的一处：图把池直接画在「缓存里的历史潜向量」上，索引器自己那份池 K 缓存没有画出来（P3-6）。 |
| 6 | `## 对照源码` 抽查 | 2 | frontmatter 的 21 条来源中，C4–C21 这 18 条 `repo@commit:path#Lx-Ly` 全部读过，行号都和类或函数的边界吻合，内容也支持页面上的结论。重点核了 KDA 那一处，结论成立：`AscendGlm5NextDecoderLayer` 在 L2080–2085 构造的是上游的 `KimiGatedDeltaNetAttention`；`utils.py` L763–768 在 `vllm_version_is("0.23.0")` 时把它注册成 `AscendKimiGatedDeltaNetAttention`；`AscendGlm5NextLinearAttention`（L1541）在整个 vllm-ascend 仓库里只有定义这一行，没有任何引用（`git grep` 只命中定义）。C16 标成了「上游参考实现」，C17 是昇腾实际调用的融合算子，这样写是诚实的。 |
| 7 | FP8 与 W8A8 | 1 | 区别讲对了。FP8：e4m3、按 128×128 分块、激活动态量化（config 的 `fmt / weight_block_size / activation_scheme`），哪些是 FP8、哪些是 BF16/FP32，和权重文件头逐项一致。W8A8：INT8 权重配每个输出通道的 `weight_scale`，激活用 `npu_dynamic_quant`（w8a8_dynamic.py L55–100）。「四个大投影」和部署页的「三个」，本页 L287 已经解释过了。扣分的原因：router、mHC 混合矩阵、KDA 短卷积的精度，本页写 BF16（按文件存法），two-node L234 和 02 L69 写 FP32（按加载后的参数）。两种说法都对，但没有互相说明。本页自称精度的唯一出处，这就成了口径冲突（P2-1）。 |
| 8 | 单一出处 | 2 | 16 卡的分组、KV 预算、每卡字节数都只写结论加链接（L148、L189、L224、L251、L289）。全页 grep「副本 / 完整模型」只命中 L304 的「glm-flow 母版的副本」，指的是 config 文件的副本，用法正确。L212 写了「每张卡 18 个」和跨机收发，和 two-node L57 一致，算结论级别，建议再压一压（P3-5）。 |
| 9 | 术语 | 1 | 抽查 15 个：token、embedding、隐藏向量、residual、Q/K/V、attention head、KV cache、RMSNorm、logits、prefill/decode、MoE、router、sparse attention、RoPE、softmax。第一次出现时都有中文解释。但有 3 处先用后解释：attention 在 L46 就用了，到 L59 才解释；FP8、BF16 在 L245 的表里先出现，到 L277–279 才解释。大小写有 1 处不合规：L56 正文里写成「[Token](token.md)」，TERMS L16 规定正文写 token。L50 的 Hugging Face、revision 对初学者也没有解释（P3-7）。 |
| 10 | 免责句占比与结构约束 | 2 | 免责句：去掉代码块和标题后按句切分，313 句里含「不能 / 不等于 / 尚未 / 并非 / 不代表」的有 **2 句（0.64%）**，分别是 L269、L273，都在给答案。结构：`## 对照源码`（L300）之后没有 H2；L300 以上 0 处角标；H3 只有「版本差异」「源码位置」，都在固定五个里面，顺序也对；角标一共 25 处（C 18、S 3、D 2、I 2），不超过 30；[C] 占 72%，低于 80%。 |
| | **总分** | **15 / 20** | |

## 二、维度核对表（config `text_config` 与页面逐项比对）

| 项 | config / 权重文件 | 页面 | 结果 |
|---|---|---|---|
| 层数 | `num_hidden_layers=45` | 45 层，编号 0–44（L232） | 一致 |
| hidden | `hidden_size=4096` | 4096 | 一致 |
| 词表 | `vocab_size=154880`，`tie_word_embeddings=False`；`embed_tokens`、`lm_head` 各为 [154880, 4096] | 154880，两张不共用 | 一致 |
| hc_mult | `mhc=True`、`hc_mult=4`、`hc_sinkhorn_iters=20`；`hc_attn_fn` [24, 16384] | 4 条，16384 × 24，20 轮 | 一致 |
| 层型分布 | `layer_types`：linear_attention 34、deepseek_sparse_attention 11；非 KDA 层号 [3,7,11,…,43]；`kda_layers` 共 34 个，含 0,1,2 和 44 | 34 KDA / 11 稀疏 MLA，编号 3、7、…、43；最后的 44 是 KDA | 一致 |
| 稠密 / MoE 分布 | `mlp_layer_types`：dense 为 [0,1,2]，sparse 42 层；`first_k_dense_replace=3` | 0–2 稠密，3–44 MoE | 一致 |
| 稠密 intermediate | `intermediate_size=12288`；`gate_proj` [12288, 4096] | 4096 → 12288 → 4096 | 一致 |
| 专家 | `n_routed_experts=288`、`num_experts_per_tok=8`、`n_shared_experts=1`、`moe_intermediate_size=2048` | 288 选 8，1 个共享，中间宽度 2048 | 一致 |
| router | `scoring_func=sigmoid`、`topk_method=noaux_tc`、`norm_topk_prob=True`、`routed_scaling_factor=2.5`、`n_group=1`、`topk_group=1`、`moe_router_dtype=float32` | 页面写法相同 | 一致 |
| swiglu | `swiglu_limit=10.0` | `swiglu_limit=10`（L193） | 一致（只少说了专家也用，见 P3-3） |
| KDA | `linear_attn_config`：`num_heads=64`、`head_dim=128`、`short_conv_kernel_size=4`、`gate_lower_bound=-5.0`；`b_proj` [64,4096]、`f_a/f_b` [128,4096]/[8192,128]、`g_a/g_b` 同形状、`o_norm` [128] | 64 头 × 128；β 4096→64；α 与输出门都是 4096→128→8192；下界 −5 | 一致 |
| MLA | `num_attention_heads=64`、`q_lora_rank=1536`、`kv_lora_rank=512`、`qk_nope_head_dim=256`、`v_head_dim=256`、`qk_rope_head_dim=0`；`q_b_proj` [16384,1536]、`kv_b_proj` [32768,512]、`o_proj` [4096,16384] | 64 头；Q 先压到 1536；512 维潜向量；256/256；RoPE 为 0 | 一致 |
| 索引器 | `index_n_heads=32`、`index_head_dim=128`、`index_topk=2048`、`index_kpool=4`、`index_kpool_always_select_tail=True`；`wq_b` [4096,1536]、`wk` [128,4096]、`weights_proj` [32,4096]、`compress_gate` [128,4096]、`compress_ape` [4,128] | 32 × 128；Q 1536→32×128；K 4096→128；权重 4096→32；每池 4 个；512 个池 + 尾巴 ≤ 3 | 一致 |
| MTP | `num_nextn_predict_layers=1`；层 45 有 `eh_proj` [4096,8192]、`enorm/hnorm`、自带 288 个专家，**没有** `hc_*`，也没有自己的 embed / head | 编号 45，8192→4096，自带专家，不用 mHC，借用主模型的 embed 和 lm_head | 一致 |
| 位置上限 | `max_position_embeddings=1048576` | 1048576 | 一致 |
| FP8 | `quant_method=fp8`、`fmt=e4m3`、`weight_block_size=[128,128]`、`activation_scheme=dynamic`；不转换的模块覆盖 KDA 全部投影（34 层）、MLA 的 `kv_b_proj` 和索引器（12 层）；MLA 的 `q_a/q_b/kv_a/o_proj` 在权重文件里是 F8_E4M3 | 页面写法相同 | 一致 |

**结论：页面上的维度 0 处对不上。**

## 三、参数量重算

按 config 逐项相乘（亿 = 1e8）：

- 路由专家：42 × 288 × 3 × 4096 × 2048 = 304,405,807,104 → **3044.06**
- 共享专家：42 × 3 × 4096 × 2048 → **10.57**
- 稠密 MLP：3 × 3 × 4096 × 12288 → **4.53**
- embedding + lm_head：2 × 154880 × 4096 → **12.69**
- KDA 每层：3 × 4096 × 8192（q/k/v）+ 8192 × 4096（o）+ 4096 × 64（β）+ 2 × (4096 × 128 + 128 × 8192)（α 门、输出门）+ 3 × 8192 × 4（卷积）+ 64 + 8192 + 128 = 137,732,288；× 34 → **46.83**
- MLA 每层：4096 × 1536 + 1536 × 16384 + 4096 × 512 + 512 × 32768 + 16384 × 4096 + 1536 + 512 = 117,442,560；× 11 → **12.92**
- 索引器每层：1536 × 4096 + 4096 × 128 + 4096 × 32 + 4096 × 128 + 2 × 128 + 4 × 128 = 7,471,872；× 11 → **0.82**
- router 42 × (4096 × 288 + 288) = 0.50，mHC 45 × 2 × (24 × 16384 + 27) = 0.35，各处 norm ≈ 0.004 → 合计 **0.85**
- **主干合计 3133.27 亿，其中路由专家占 97.15%**。页面写「约 3133 亿、97.2%」，正确。
- 用 `checkpoint-shapes.json` 逐张量加总，去掉 `scale_inv`：主干以外的部分 89.21、路由专家 3044.06、MTP 74.33、视觉 5.64，合计 **3213.23**，和页面 L271 一致。

每个 token 用到的参数：

- 路由专家 42 × 8 × 3 × 4096 × 2048 = 84.56；加上路由专家以外的 89.21，得 **173.77 亿**（页面写「约 174 亿」）；扣掉 embedding 6.34，得 **167.43 亿**（页面写「约 167 亿」）。两个数都对。
- MTP 层每个 token 用到的：74.33 − 72.48 + 8/288 × 72.48 = **3.86 亿**。
- 和模型卡「18B」对照：173.77 + 3.86 = **177.6 亿 ≈ 17.8B**，四舍五入正好是 18B；换成加视觉编码器，173.77 + 5.64 = 179.4 亿，同样约等于 18B。页面把这件事写成「口径待核」，其实可以当场给出候选算式并标 [I]（P2-2）。

## 四、约束检查

| 约束 | 结果 |
|---|---|
| `## 对照源码` 之后没有 H2 | 通过（L300 之后只有 L302、L311 两个 H3） |
| `## 对照源码` 之上没有角标 | 通过（grep 角标只命中 L304–L330） |
| H3 只用固定的五个、顺序固定 | 通过（「版本差异」「源码位置」，是五个里的后两个，顺序正确）。注：工作区里未提交的 `lint.test.ts` 已经放宽这条规则，但本页按旧规则也合格 |
| 角标 ≤ 30，[C] < 80% | 通过（25 处，[C] 18 处，占 72%） |
| 免责句 < 3% | 通过（0.64%） |
| 不出现「完整模型副本」 | 通过 |
| 正文链接和锚点存在 | 通过（15 个页面都存在；`#每张卡上放了什么`、`#剩下的显存变成多少-kv-cache` 对应 two-node 的 L141、L168） |

## 五、问题清单

### P1（事实或数字错误）

无。

### P2（违反页面标准或约束 / 初学者读不懂的关键段落）

**P2-1 权重精度和部署页、02 底稿的说法对不上**
- 位置：`wiki/concepts/glm-5-3-flash.md:279`（以及 L245）；对照 `wiki/concepts/glm-5-3-flash-two-node.md:234`、`docs/mainline/02-forward.md:60,62,69`
- 问题：本页说 router、mHC、KDA 投影「存成 BF16」，只有 router 偏置、mHC 的偏置与缩放、KDA 衰减参数是 FP32。two-node 和 02 说「router gate、mHC 混合参数、KDA 的短卷积参数是 FP32」。两边说的是两件事：一个是文件里怎么存，一个是加载后的参数类型。但两页都没有交代这一点。本页 L48 自称是「权重精度」的唯一出处，读者对照两页会看到互相矛盾的说法。
- 证据：权重文件里 `mlp.gate.weight` 是 BF16，`hc_attn_fn` 是 BF16 [24,16384]，`hc_attn_base / scale` 是 F32，`k_conv1d` 是 BF16。代码里 `GateLinear(params_dtype=torch.float32)`（glm5_next.py L1480–1483），`hc_attn_fn = nn.Parameter(..., dtype=torch.float32)`（L2140–2145），kimi_kda.py L338–341 的注释写着「upstream KDA layer stores short-convolution weights in fp32」。
- 建议：在 L279 末尾补一句：「以上是 HF 文件里的存法；加载进 vLLM 后，router、mHC 的两张混合矩阵和 KDA 短卷积按 FP32 建参数，所以部署页按 FP32 算字节。」two-node L234 改成链接回本页，再补一句「加载后是 FP32」。

**P2-2 「激活 18B」只写成待核，其实能当场算出来**
- 位置：L269–271、L305
- 问题：页面给了 174 亿、167 亿两个数，又说模型卡的 18B「统计口径待核」。页面没有说 174 亿就是本页口径下的「激活参数」。初学者拿到 3 个总数、3 个激活数，不知道该引用哪一个。
- 证据：见第三节。主干 173.77 亿加上 MTP 每个 token 用到的 3.86 亿，是 177.6 亿，约等于 18B；加视觉 5.64 亿则是 179.4 亿，同样约等于 18B。总数 3213.23 亿也是四舍五入成 320B。
- 建议：L269 末尾补一句「这 174 亿就是本页口径下的激活参数」。L271 改成：「模型卡的 18B，按 config 可以凑出两种口径：主干 174 亿加 MTP 层每个 token 用到的约 4 亿，得 178 亿；或者加视觉编码器 5.6 亿，得 179 亿。两种都四舍五入成 18B，模型卡没说用的是哪种。」然后在「版本差异」里标 [I]。「待核」只留给「模型卡用的是哪种口径」这一件事。

**P2-3 没讲索引器从哪个机制演变来，GLM 自己加的部分也没和来源分开**
- 位置：L158–166
- 问题：这一节从 sparse attention 直接跳到「GLM 配一个轻量的索引器」，没有交代来源。config 的 `layer_types` 写的是 `deepseek_sparse_attention`，但全页没有提 DSA / DeepSeek-V3.2 的 lightning indexer，也没有说明哪些是沿用、哪些是 GLM 自己加的：索引器的多头 Q、各头之间共用一条 K、每个头一个权重，这些是沿用的；每 4 个 token 压成一池、按池挑、尾巴总是读，这是 GLM 加的（`index_kpool*` 这些字段）。本项审查要求「每个创新先讲它从哪个基础机制演变来」，这一条没做到。
- 证据：config `layer_types` / `index_kpool_compress=True` / `index_kpool_always_select_tail=True`；glm5_next.py L501 调用的算子名就是 `npu_lightning_indexer`。
- 建议：在 L158 之后加 2–3 句：「这个索引器沿用 DeepSeek-V3.2 的 DSA（DeepSeek Sparse Attention）：……DSA 按单个 token 挑；GLM 多做了一步，先把每 4 个 token 压成一池再挑池。」**拿不准、请写手自己对照原文**：我记得 DSA 论文公式里每个头的 q·k 先过 ReLU 再按权重相加，但本实现 `bf16_mqa_logits`（glm5_next.py L730–733）里没有 ReLU。要写这条差异的话，先对照 DeepSeek-V3.2 的技术报告核实。

**P2-4 「对顺序敏感的只剩 KDA 和因果范围」说过头了**
- 位置：L156（「于是模型里对 token 先后顺序敏感的计算，只剩 KDA 层……和 attention 的因果范围」）
- 问题：kpool 压缩时，每个通道的得分要加上「按它在池里排第几学出来的偏置」（本页 L163 自己就是这么写的），而池又是按绝对位置每 4 个一划。所以索引器也对位置敏感（能区分池内第几个），和 L156 的「只剩」矛盾。
- 证据：`index_kpool_compress_ape` 的形状是 [4,128]（glm5_next.py L1263–1269）；压缩公式是 `scores = slot_score + ape`（L1073）。
- 建议：改成「……只剩 KDA 层（按顺序逐个递推，短卷积只看前 3 个 token）、索引器压池时的池内位置偏置（只区分池里的第几个），以及 attention 的因果范围」。

**P2-5 开头没有一句话讲清模型长相，L59 一次塞进太多概念**
- 位置：L44–64
- 问题：第一节只交代范围和来源。frontmatter 的 summary 里那句模型长相，正文里一直没有出现。L59 这一条列表项约 330 字，引入了 residual 流（而且直接是四条）、attention、Q/K/V、匹配分数、加权汇合、头、MLP，紧接着 L60–61 又给出 128×128、512 维、288/8、共享专家。初学者在还没见过一条 residual 流之前，就被要求接受「四条」。
- 证据：L59 全文。
- 建议：在 L48 后面加一段 3 行的「模型长相」：「45 层，每层先 attention 后 MLP；attention 有 34 层是 KDA、11 层是稀疏 MLA；MLP 前 3 层稠密、后 42 层是 288 选 8 的 MoE；层与层之间走 4 条 residual 流；外加 1 个 MTP 层；共 3133 亿参数，每个 token 用到约 174 亿。」L59 把「复制成四份」挪到 mHC 那一节，这里先只说「沿 residual 流逐层更新」。

### P3（表述问题）

**P3-1 没讲 DeepSeek 原版 MLA 为什么要另留 RoPE 的 K**
- 位置：L156「有的 MLA 会为它另留一段不压缩的 K」
- 问题：「有的」太含糊。DeepSeek-V2/V3 的 MLA 都采用 decoupled RoPE，原因是 RoPE 和矩阵吸收不兼容（按论文记忆，没有联网核对）。页面不讲这个原因，读者就体会不到「RoPE 维数为 0」换来了什么：缓存里只剩 512 维，矩阵吸收也不再有例外。
- 建议：「DeepSeek 原版 MLA 里，RoPE 会挡住矩阵吸收，所以另留一小段带 RoPE 的 K 单独缓存；GLM 把这段设成 0，缓存里只剩 512 维潜向量，吸收也不用再绕开它。」

**P3-2 短卷积后面的 SiLU 没写**
- 位置：L140
- 证据：上游 `kimi_gdn_linear_attn.py`（@0fc695fc）L328–367 的卷积都带 `activation="silu"`；昇腾实现 `kimi_kda.py` L322 是 `activation_mode=1`。
- 建议：「作用」一栏补上「卷积后再过一次 SiLU」。

**P3-3 `swiglu_limit` 只写了稠密 MLP，专家也用**
- 位置：L193
- 证据：glm5_next.py L1463、L1477、L1522，共享专家和 FusedMoE 都传了 `swiglu_limit`。
- 建议：L197 加半句「路由专家和共享专家同样有这个上限」。

**P3-4 没说明本基线的 vLLM 就是 0.23.0**
- 位置：L307
- 问题：「vLLM 版本是 0.23.0 时被替换」这句话，读者没法判断本基线到底有没有替换。
- 证据：`git -C tools/repos/vllm describe --tags 0fc695fc` 输出 `v0.23.0`。
- 建议：补一句「本知识库固定的 `vllm@0fc695fc` 就是 v0.23.0，所以执行的是昇腾版」。

**P3-5 专家怎么放写到了部署层面的数字**
- 位置：L212
- 问题：「每张卡 18 个」和「发过去、收回来」都是部署页和专家并行页的内容。现在和 two-node L57 一致，但部署一改（比如换成 EP8），这里就会过时。
- 建议：压缩成「官方双机部署把每层的路由专家分摊到全部 16 张卡上（专家并行），一个 token 选中的专家常在别的卡上，见……」，去掉「18 个」。

**P3-6 attention 图没画出索引器自己的池 K 缓存**
- 位置：`wiki/diagrams/glm-flash-attention.yaml:21-58,79`
- 问题：池直接画在「缓存里的历史潜向量」上，看起来像是索引器在给潜向量打分。实际上索引器读的是另一份缓存：每池一条 128 维的池 K（本页 L185 的表里有，源码 glm5_next.py L1306–1313 是单独的 `k_cache`）。另外，索引器的 Q 来自 MLA 压到 1536 维的那条 Q，不是直接由 h 算出（L1341），这一点属于可以接受的简化。
- 建议：在潜向量那一行上方加一条细行「索引器池 K（每池 1 条）」，「索引」节点给这一行打分，虚线再落到对应的潜向量组上。

**P3-7 术语：先用后解释、大小写**
- 位置：L46（attention 在 L59 前就出现）；L245（FP8、BF16 在 L277–279 之前就出现在表里）；L56「[Token](token.md)」；L50「Hugging Face」「revision」
- 建议：L46 改成「保存注意力（attention）历史的缓存」；L245 这一格加「（8 位浮点，见下文「权重精度」）」；L56 链接文字改成小写 token；L50 给 revision 加括号「（仓库的某一次提交）」。

**P3-8 mHC 的两个取值范围也在融合算子里，没有标推断**
- 位置：L84、L86（入口权重 0–1、写回权重 0–2、「不带可学习增益的 RMSNorm」），以及 L308
- 问题：这几条和 Sinkhorn 一样，都在 `npu_hc_pre_v2` 融合算子里完成。Python 侧只看得到 `hc_post_mult_value=2.0`（glm5_next.py L2136），但「版本差异」只给 Sinkhorn 标了 [I]。
- 建议：L308 把「入口权重经 sigmoid、写回权重是 2 × sigmoid、入口 RMSNorm 不带增益」一起写进 [I] 的推断范围。

## 六、以初学者身份读下来最卡住的 3 个地方

1. **L59（第 2 步「沿 45 层更新隐藏向量」）**：一段话里先后出现四条 residual 流、attention、Q/K/V、分数、头、MLP，紧接着又是 128×128 矩阵、512 维、288 选 8。我还不知道一条 residual 流是什么，就先被告知「复制成四份」。要到 L76–86 才回头补上。
2. **L160–168 加 L180–186（索引器与池）**：第 2 步「每个通道上……得分……偏置……softmax」叠了三层新概念。我到读完 L186 的表才明白，稀疏 MLA 层其实有三份历史：潜向量、池 K、尾巴。而 attention 图把池画在潜向量上，让我以为索引器是在给潜向量打分。
3. **L253–271（参数量）**：先是 3133 亿，接着 174 亿、167 亿，然后是 3213 亿，最后模型卡的 320B / 18B，还带一句「口径待核」。我不知道对外介绍这个模型时该说「3133 亿」还是「320B」，「每个 token 用多少参数」该报 174 亿、167 亿还是 18B。

## 七、没有核到的部分

- 模型卡的「320B / 18B」[S2]、ModelScope 量化仓库 `text_config` 与原模型一致 [S3]：需要联网，本次没有抓取，按来源基线页 L60–62 的记录采信。
- `npu_hc_pre_v2`、`npu_lightning_indexer`、`chunk_kda_fwd` 这几个融合算子内部（AscendC 源码）：仓库里读不到，页面上相关的说法也已经标了推断或待核。
- 各图只读了 yaml，确认了 SVG 已经重新生成，没有在浏览器里看渲染效果。
- 读取过程中没有被拦截，没有跳过任何内容。

## 八、修订记录（2026-09-27，写手）

修订后页面 hash-object `d210d68e`；只改了 `wiki/concepts/glm-5-3-flash.md` 和 `wiki/diagrams/glm-flash-attention.{yaml,svg}`。

| 条目 | 处理 |
|---|---|
| P2-1 精度口径 | 「权重精度」一节改名为「文件里怎么存，加载后变成什么」，新增四列表（部件 / HF 文件里 / 加载后 / 为什么）。源码核对结果：文件 BF16 → 加载 FP32 的有 router 权重（`GateLinear(params_dtype=float32, force_fp32_compute=True)`，glm5_next.py L1480–1491；原因是 config 的 `moe_router_dtype=float32`）、mHC 两张混合矩阵（L2140–2145 直接建 FP32，源码无注释，原因标待核/推断）、KDA 短卷积（上游 kimi_gdn_linear_attn.py L171–190 `params_dtype=torch.float32`；昇腾 kimi_kda.py L333–341 计算前转回激活类型）、索引器池内位置偏置 `index_kpool_compress_ape`（L1263–1269；K/得分链在 FP32 里算，见 L1344–1352 注释）。文件里本来就是 FP32 的：router 偏置、mHC base/scale、`A_log`、`dt_bias`。总表的精度一行同步改。 |
| P2-1 结论 | two-node L155–156、L234 和 02 L60–69 按「加载后」写 FP32，**说法正确**，本页已与之对齐，两处不用改。两个小出入只列证据、未改：① two-node L234、02 L57/L68 说「整个索引器 BF16」，但池内位置偏置加载后是 FP32（每层 2 KiB，02 L513 已单列）；② 索引器前向第一次运行时会另存 `wk_weights_proj` 与 `index_kpool_compress_gate` 的 FP32 副本（glm5_next.py L1349–1352），每个 MLA 层 (160 + 128) × 4096 × 4 B = 4.5 MiB，12 层约 54 MiB/卡，two-node 的每卡权重表没有这一项（它不是加载时的参数，应落在量激活峰值那一步）。 |
| P2-2 18B | 补「174 亿即本页口径的激活参数」；新增一段写明口径（按一个文字 token 经过的参数，含 embedding 与 `lm_head`、每层 8 个路由专家、MTP 层每 token 用到的部分，不含视觉编码器）和算式 173.8 + 3.9 ≈ 177.6 亿 ≈ 18B；「版本差异」标 [I]，并列出加视觉 179.4 亿的另一种口径，待核只留「模型卡用哪种」。总数改成「约 3213 亿（321B），与 320B 相当」。 |
| P2-3 DSA | 已联网核对 DeepSeek-V3.2 技术报告（arXiv 2512.02556）第 2.1 节：DSA = lightning indexer + 按 token 选 top-2048，打分 `Σ w·ReLU(q·k)`。正文拆成「第二步 DSA」「第三步 GLM 改成按池挑」，五步里标明哪些沿用、哪些是 GLM 新增（`index_kpool*` 三个字段）。ReLU 差异写进「版本差异」：PyTorch 路径 `bf16_mqa_logits` 无 ReLU，`npu_lightning_indexer` 内部待核。新增来源 S22、S23。 |
| P2-4 顺序敏感 | 改为「只剩三处：KDA、池内位置偏置、因果范围」，挪到索引器讲完之后，避免先用后解释。 |
| P2-5 开头 | 第一节加「先用几句话看模型长相」；第 2 步去掉「复制成四份」和两条数字子项，复制四份挪到 mHC 一节。 |
| P3-1 | 按 DeepSeek-V2 技术报告第 2.1.3 节（arXiv 2405.04434，已联网核对）写明原版另留 RoPE 段的原因和去掉后的收益。 |
| P3-2 | 短卷积一行补「卷积后再过一次 SiLU」；C7 行号扩到 L102–L385 以覆盖 `activation="silu"`。 |
| P3-3 | 补「路由专家和共享专家也有同样的上限」。 |
| P3-4 | 「版本差异」写明 `vllm@0fc695fc` 就是 v0.23.0，本基线执行昇腾版。 |
| P3-5 | 去掉「每张卡 18 个」，只留分摊到 16 张卡和链接。 |
| P3-6 | attention 图下半加一行「索引器缓存：每池一条池 K」，索引器给池 K 打分，选中的池 K 再落到潜向量组；图高 690 → 720。已用 Playwright 截图检查。 |
| P3-7 | L46 改「注意力历史」；总表给 FP8、BF16 加注；`[Token]` 改小写；Hugging Face、revision 加注；首次出现的 token 加注。 |
| P3-8 | 「版本差异」的 [I] 扩到 sigmoid 入口权重、2 × sigmoid 写回权重、不带增益的 RMSNorm。 |

检查：`pnpm wiki:lint` 通过（本页无警告）、`pnpm check:content` 通过、`pnpm wiki:diagrams --check` 141 张一致。角标 28 处（C 18、S 5、I 3、D 2），[C] 占 64%。
