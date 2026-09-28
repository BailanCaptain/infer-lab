# mla 审查记录

## P5 写作记录（2026-09-28，第 08 批，深改）

**改了什么**

- 按「先直觉、后数字」重排：首屏问题式 H2 + 一句话定义 + 新直觉图 `mla-intuition`（新位置压成共用潜向量存进 KV cache → 按选中位置取出 → 各头上投影展开 → 照常 attention）；第二屏讲省什么（calc：64 × (256 + 256) 对 512，64 倍）与四笔代价，附 4 行对照表（MHA / GQA / MLA / 稀疏）。
- 新增机制节：低秩压缩（论文记法、秩 ≤ d_c、RMSNorm、Q 压缩不进缓存、DeepSeek-V2 维度与「2.25 组 GQA」）；吸收（旧版四行等式保留，补 GLM 实现四步与通用后端 prefill 仍展开）；RoPE 为什么另存一段（decoupled RoPE），下挂「GLM 的这一配置不保存 RoPE 段」「每个位置缓存多少字节」。
- 落到 GLM：层号与 MTP 层、配置表、四个投影（与 quantization 页写法一致：合并压缩、Q 展开、KV 展开、输出）、每卡六步走读 + 重画的代码流程图 `mla`（三列汇合，带 q_lora_rank 与 RoPE 两处分支）、与 indexer 的三个接口。
- 单一出处：每 token 1,024 B、13,056 B 只写结论并链接 two-node；块规格链接 kv-cache-spec；TP 切法链接 tensor-parallel；选位置机制链接 sparse-attention；R1 形状链接 one-request。本页不重算。
- 出处修正：`indexer_kpool_mla_v1.py#L980-L1061`（属于只供单测的 `_sparse_attention_pytorch`，L857–1064）换成推理路径 `indexer_kpool_mla_v1.py#L1065-L1104` 与 `device_op.py#L719-L793`，与 sparse-attention 页、`docs/mainline/review/02-path-fix-review.md` #1 一致；证据编号按新 sources 顺序重编为 S1–S2、C3–C25。模型配置钉点由 eb9eb208 改为标准钉点 690b7052。
- 新增常见误解 8 条与对照源码五个 H3（怎么开 / 会报什么错 / 开销 / 版本差异 v0.23·v0.26·main / 源码位置）。
- 保留入链锚点：`#glm-的这一配置不保存-rope-段`（kv-cache 页）、`#稀疏选择是压缩之上的另一层机制`（kv-cache、sparse-attention 页）。

**数字取自**

- 底稿 02 §0 配置表（64 头、1536、512、256、0、256；indexer 32 × 128、池 4、2048）、§5.1（64 倍）、§5.2（四个投影形状、每卡 8 头、合并压缩投影与 indexer 不切、吸收形状）、§5.5（内核参数）、§5.6（三份缓存、1,024 B、13,056 B 结论）、§5.8（一层一次 All-Reduce）、§5.9（R1 形状，仅链接）。

**核心概念对照**

- DeepSeek-V2 论文 arXiv 2405.04434v5 §2.1（联网核对）：低秩联合压缩、W_UK/W_UV 可吸收进 W_Q/W_O、Q 压缩只为训练激活显存、潜向量后 RMSNorm、decoupled RoPE 的原因与结构、Table 1 缓存公式与 2.25 组 GQA、n_h=128 / d_h=128 / d_c=512 / d_c′=1536 / d_h^R=64。
- HF config@690b7052（联网核对）：上述 GLM 维度、num_key_value_heads=64、MLA 层号 3、7…43。
- 源码（钉点逐段读）：`glm5_next.py#L1900-L1963`（q_lora_rank 分支只建四个投影、头数整除断言）、`#L1965-L2000`（RoPE 仅在 >0 时构造）、`indexer_kpool_mla_v1.py#L744-L788`（exec_kv）、`sfa_v1.py#L776-L793`、`#L1349-L1361`、`#L1994-L2028`（拆 W_UK_T/W_UV、查询吸收、V 上投影与 o_proj）、`device_op.py#L719-L793`（key=value=打包潜向量、rope=None）、`ops/indexer_kpool_mla.py#L69-L134`（head_size、BF16、1 个 KV 头）、`patch_glm5_next_config.py#L12-L30`、`vllm config/model.py#L1284-L1288`、`#L1646-L1648`；版本差异对照 2c59ff10 / 2ed6cbba / baa023ad 的 `mla_v1.py` 与 baa023ad 的 `glm5next/attention.py`、`patch_glm5next_config.py`。

**旧版信息清单勾选**：18 条逐条勾选，17 条保留，1 条挪走（F10 的 512×2 B 算式与 4 MiB 例子按单一出处归 two-node，结论保留并链接）；清单与勾选见 scratchpad `p5/mla-facts.md`。

**验证**

- `pnpm wiki:lint`：通过（另有 18 处待留意，均不在本页）。
- `pnpm wiki:diagrams --check`：189 张图与 spec 一致；本页两图无警告。
- `pnpm wiki:audit`：本页 25 条来源均有效；全局失败 1 处在 rope.md（`vllm/config/model.py#L2178-L2250` 行号越界），非本页。
- `pnpm check:content`：通过。写作标准手动检查（名单外页）：PASS，4788 字，行内代码 0.0/千字，calc 0.21/千字，免责 1.2%，图先行、图宽通过；角标 29 处、C 级 23 处（79%）。
- 未截图、未起服务，浏览器验收留给审查环节。

**待核**：内核 trace 与 512 维打分实测缺；四个投影实际精度缺量化描述文件；main 的 GLM 调用链与主缓存精度未逐行核；`VLLM_MLA_DISABLE` 对 GLM 专用层的影响未核。

## P5 审查（09-28）

独立审查，只审不改页。对象：`wiki/concepts/mla.md` 工作区未提交版（相对 14591fd 为 +262/−39），两张图 `mla-intuition`、`mla`。源码一律读 `tools/repos/vllm-ascend` 里的 db701c1f 对象；GLM 配置读 `infra-view-hardware-study-20260906/glm-flow/reference/official-config.json`（下称 config）。

**分数：8.5 / 10**：无 P1，P2 两条，P3 五条。

### 1. 初学者测试（只读前两屏，L48–98）

我的一句话：MLA 把每个位置给所有头用的 K 和 V 压成一条共用的短潜向量（GLM 是 512 维）存进 KV cache，用的时候再由各头的上投影还原，或者把这一步吸收进查询和输出投影。代价有四笔：模型必须按 MLA 训练；读的时候要多做矩阵乘；TP 切不开潜向量；RoPE 会挡住吸收（GLM 没有 RoPE 段）。**通过**，唯一卡点是首屏 L62 的「indexer」（见 P2-2）。

### 2. 核心概念逐条核对

| 说法（页内位置） | 判定 | 依据 |
|---|---|---|
| 低秩压缩：下投影 → d_c 潜向量 → 各头上投影；秩 ≤ d_c；潜向量后接 RMSNorm；Q 也走压缩路线但不进缓存（L100–114） | 对 | config L78 `kv_lora_rank` 512、L245 `q_lora_rank` 1536；glm5_next.py L1917–1925 `fused_qkv_a_proj` 输出 [1536, 512+0]，L1926 `q_a_layernorm`；indexer_kpool_mla_v1.py L755–759 写缓存前先做 `npu_rms_norm` |
| DeepSeek-V2 的维度：128 头 × 128 维、d_c 512、d_c′ 1536、d_h^R 64、每位置 576 个数、相当于 2.25 组 GQA（L114） | 对（未联网） | 与论文 §2.1 一致；本轮没有联网重读论文，依据是写手的联网核对记录和审查人对论文的了解 |
| GLM 的 RoPE 段为 0，主 attention 和 indexer 都不构造 RoPE，写缓存时不旋转（L146–150） | 对 | config L248 `qk_rope_head_dim` 0；整份 config 里和 rope/position 相关的只有 L28 `indexer_rope_interleave`、L181 `max_position_embeddings`、L248，没有 `rope_parameters`；glm5_next.py L1965 仅在 >0 时建 RoPE，否则 L1983–1984 `rotary_emb=None`；L1985 起 indexer 同理，L1998–1999 为 None；indexer_kpool_mla_v1.py L760 仅在 >0 时 `npu_interleave_rope` |
| decoupled RoPE 只归 DeepSeek-V2，GLM 没有这一段（L87、L144、L220） | 对 | 协调者补充点 3 已核：页内**没有**「GLM 的 rope 部分单独存」或「吸收只作用于 nope 部分」这类说法，不构成 P1 |
| 位置感来自 KDA 递推、indexer 池内位置偏置、因果范围（L150） | 对 | glm5_next.py L1263–1268 `index_kpool_compress_ape` 形状 [4, 128]，即池内位置偏置 |
| 吸收：K 的上投影挪到查询一侧，V 的上投影挪到汇合之后；kv_b_proj 拆开后释放；同一份潜向量既当 K 又当 V；GLM 的 prefill 和 decode 都走吸收（L116–136） | 对 | sfa_v1.py L776–788 拆出 `W_UK_T`/`W_UV`，L794 `dispose_layer(self.kv_b_proj)`；indexer_kpool_mla_v1.py L557 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`，L810/L848 调 `super().forward` → sfa_v1.py L1850 `_q_proj_and_k_up_proj`（L1349–1361，每头 256→512）→ L1994 稀疏 attention → L2004 `_v_up_proj`（L1385）；device_op.py L719 起 `key=value=packed_kv_cache`、`sparse_block_size=1`、rope=None |
| 通用 MLA 后端 prefill 展开、decode 吸收（L136） | 基本对，但不全 | mla_v1.py L1615 prefill 用 kv_b_proj，L918 decode 吸收；不全之处见 P2-1 |
| q_lora_rank 有值时只建四个投影，形状见 L179 | 对 | glm5_next.py L1917–1933（合并压缩投影 disable_tp、Q 展开 Column）、L1949–1963（KV 展开 Column、输出 Row），四个都接 quant_config；else 分支建 `kv_a_proj_with_mqa` + `q_proj`（L1934–1948）。与 quantization.md L145、matmul-and-weights.md L95/L97/L102 的「合并压缩 + Q 展开 + 输出 + KV 展开」一致 |
| 每 token 缓存：vLLM 按 1 个 KV 头处理，头宽 = d_c + d_h^R，主缓存写死 BF16 → 1,024 B/层（L154–156） | 对 | ops/indexer_kpool_mla.py L76 `kv_cache_dtype = "bfloat16"`，L121–134 `MLAAttentionSpec(num_kv_heads=1, head_size, dtype)`；patch_glm5_next_config.py L12–30 注明 head_size = kv_lora_rank + qk_rope_head_dim、KV heads=1 |
| indexer 用 1536 维 Q 中间表示展开成 32×128，K 从隐藏向量算，每卡各算一遍（L189、L198、L208） | 对 | glm5_next.py L1277–1283 `wq_b` 为 ReplicatedLinear(q_lora_rank→32×128)；L1284–1291 `wk_weights_proj`(hidden_size, disable_tp=True)；L1298–1300 尾状态 FP32 |

### 3. 数字（对照底稿 docs/mainline/02-forward.md 与 config）

- 4096 / 64 头 / 256 / 256 / 512 / 1536 / RoPE 0：config L20、L238、L247、L258、L78、L245、L248 ✓。
- 45 层，稀疏 MLA 在第 3、7…43 层，共 11 层：config L240，`full_attn_layers` = [3,7,11,15,19,23,27,31,35,39,43] ✓。MTP 1 层：config L242；`model.layers.45.self_attn.indexer.*` 在 L1312 ✓。
- indexer 32×128、池 4、topk 2048：config L25、L21、L22、L26 ✓。
- 32,768 → 512，压缩 64 倍：底稿 L355 ✓。1,024 B 和 13,056 B：底稿 §5.6（655,360/640 = 1024；12 × (1024+64) = 13,056），two-node L198/L212 ✓。2051：底稿 L439、sparse-attention L139 ✓。
- 写手自报的四项待核（内核 trace、四个投影的实际精度、main 调用链、`VLLM_MLA_DISABLE`）本轮核不了；页面 L308 已如实写成「待核」，不扣分。

### 4. 单一出处

- 13,056 B：L80、L156 只写结论并链接 two-node ✓。
- 块规格链接 kv-cache-spec（L158、L210）✓；稀疏选择链接 sparse-attention（L62、L202、L212）✓；TP 切法链接 tensor-parallel（L86、L198）✓。
- 例外：1,024 B 实际在本页重推了一遍（P3-4）；2051 也在 L189 自己写了算式（P3-3）。

### 5. 出处

- 全页 grep `#L980|tests?/|test_`：0 命中，旧的单测路径已清掉 ✓。
- 25 条来源的钉点分布：vllm-ascend@db701c1f 16 条，@baa023ad 3 条，@2c59ff10、@2ed6cbba 各 1 条，vllm@0fc695fc 2 条，arXiv 1 条，HF config@690b7052 1 条。
- 新换的 indexer_kpool_mla_v1.py L1065–L1104 实读过：`_execute_sparse_flash_attention_process` → `DeviceOperator.execute_sparse_attention_indexer_kpool_mla`，属于推理路径 ✓。
- config 钉点 690b7052 与 sources/glm-5-3-flash-baseline.md L78 规定的标准钉点一致 ✓。

### 6. 跨页一致性

- 潜向量 512：glm-5-3-flash L151/L177/L262、kv-cache L119/L143、sparse-attention L33/L140/L148 ✓。
- MLA 层数都写成主干 11 层 + MTP 1 层 = 12 层存 KV：glm-5-3-flash L5/L100/L257、kv-cache L139/L143、sparse-attention L35/L135/L152、one-request L151/L280 ✓。
- 协调者补充点 4，RoPE 说法：glm-5-3-flash L151/L187/L262 写「GLM 无 RoPE」，L359 只讲 DeepSeek 原版；kv-cache L60/L119 写「不带 RoPE 段」；sparse-attention L191 写「本配置为 0」；one-request 没有 RoPE 相关表述。四页都没有「GLM 另存 RoPE 段」的说法。
- 另发现 kv-cache.md L119 自己算了 2 B × 512 = 1,024 B。这是本页之外的同类重算，只列位置，不改。

### 7. 有没有丢信息

- `git diff` 删掉的非来源行逐条看过；另从 `p5/mla-facts.md` 抽查 7 条：F03 → L84 ✓；F07 → L127、L138 ✓；F10 → 结论在 L156 并链接，「4096 位置 = 4 MiB」例子删了，按单一出处可以接受；F11 → L154、L158 ✓；F13 → L204 ✓；F14 → L210 ✓；F16 → L166 ✓。
- 旧 H2 的三个锚点（从独立 K/V 到共享潜向量、在潜空间中完成评分和汇合、接入模型与推理系统）已经不存在，全库没有入链指向它们。

### 8. 篇幅：和 sparse-attention、kv-cache 的重复

- 没有整节照搬的情况。
- 部分重合一：「一个 token 走过一层」的第 3、5、6 步和 L198，与 sparse-attention「放到 GLM 双机」L135–140、L148 重合。重合点是按 block table 逐位置读、每卡 8 头、一次 All-Reduce、indexer 每卡算一遍。
- 部分重合二：「稀疏选择是压缩之上的另一层机制」的 L204（indexer 32×128、池 4、2048）和 L212（历史 ≤ 2051 时等于密集），与 sparse-attention「候选位置从哪里来」「稀疏什么时候才真的起作用」重合。
- 和 kv-cache 没有整节重复：接口 3（L210）只做定性说明，数字链接到 kv-cache-spec。

### 9. 链接与锚点

用 `src/content/wiki/anchors.ts` 的 `headingSlug` 规则写脚本逐条解析：本页出链 38 条，全库入链 25 条，文件和锚点全部能解析，失败 0 条。

### 10. 结构与写作标准

- 首屏：问题式 H2（L48）+ 加粗一句话定义（L52）+ 直觉图（L54）✓。
- 第二屏讲为什么要压、代价在哪（L68）✓；GLM 双机（L160）✓；常见误解（L214）✓。
- 对照源码下五个 H3 按顺序排列（L227/237/250/260/273）✓；版本差异里 v0.23、v0.26、main 都有（L262–267）✓。
- 对照源码之上证据角标 0 个；正文行内代码 0 个；calc 只有 L72 一个，和 L91 的表格不相邻 ✓。

### 11. 工具

- `pnpm wiki:audit`：exit 0，输出「ok wiki:audit … 通过」，全局行号越界 0。本页 25 条来源里，arXiv 和 HF config 两条 URL 没有联网验证。
- `pnpm wiki:lint`：exit 0，没有涉及本页的提示。
- `pnpm wiki:diagrams --check`：189 张图与 spec 一致，本页两张图无警告。
- 浏览器：没有打开。本轮是内容审查，模板没有要求；写手说留给审查环节的浏览器验收仍然没人做。

### 问题清单

**P1**：无。

**P2**

1. **L136，通用 MLA 后端的 prefill 写得不全。**
   - 问题：原文是「prefill 时本轮新 token 多，仍用 KV 展开投影把新位置的潜向量展开成各头的 K、V 再算」。db701c1f 的 mla_v1.py L1134–1147 `_compute_prefill_context` 显示，有 `chunked_context` 时（分块 prefill，或前缀缓存命中后接着算），代码会从缓存取出已存的历史潜向量（L1150），分块经 kv_b_proj 展开（L1214）。所以 DeepSeek 这类模型在 prefill 时，展开的不只是新位置。
   - 影响：问答会答错「前缀命中以后 prefill 还要不要展开历史」。
   - 改法：改成「prefill 时，本轮新位置，连同已缓存的前文（分块 prefill 或前缀缓存命中时按块取回），都经 KV 展开投影展开成各头的 K、V，按普通多头 attention 算；decode 才走吸收」，并在源码位置补 `mla_v1.py#L1134-L1214`。
2. **术语先用后讲。**
   - L62：首屏出现「indexer」，定义要到 L202 才给。
   - L150：先用「KDA」，L166 才给链接，全页没有一句解释。
   - L133：「稀疏 FlashAttention 内核」里的 FlashAttention 没有解释。
   - 改法：L62 写成「只取 indexer（一个给历史位置打分、挑出本次要读哪些位置的小分支）选中的那些」；L150 在第一次出现时补「KDA（按顺序递推、只保留固定大小状态的线性注意力）」并加链接；L133 补半句，说明 FlashAttention 是把打分、softmax、汇合融合成一个分块内核的实现。

**P3**

1. **L66「把上投影提前乘进查询和输出那一侧」。** 「提前」容易被读成离线把 W_UK 合并进 q_b_proj 的权重。昇腾的实际做法是每一步先算 q_b_proj，再在运行时 bmm W_UK_T（sfa_v1.py L1349–1361），输出一侧也一样（L1385）。建议改成「把上投影挪到查询一侧、以及汇合之后再乘」。
2. **L142「中间夹着一个和当前位置有关的旋转 R」。** 这是沿用论文的措辞，但不够准。真正的障碍是：键一侧的旋转随每个历史位置 s 变化，q R_t R_sᵀ W_UKᵀ cᵀ = q R_{t−s} W_UKᵀ cᵀ，没有一个固定矩阵能把 W_UK 并进查询。建议改成「夹着一个随两个位置之差变化的旋转，每个历史位置都不一样」。
3. **L189「2048 + 3 = 2051」。** 这一步重做了 sparse-attention L139 的推导，而且没挂链接。改成「每行最多 2051 个位置（来历见[稀疏注意力](sparse-attention.md#候选位置从哪里来)）」。
4. **L154/L156 重推了 1,024 B。** 这两处先给出公式，再代入 512、0 和 BF16 算出 1,024 B，实际上是 two-node L198 那一行的重算，和 relations L39「唯一推导」的说法对不上。二选一：L156 只写「代入 GLM 的结果见部署页」；或者把 L39 的注释改成只认领 13,056 B 与块数。
5. **与 sparse-attention 部分重合（见 §8）。** 建议把 L198 的后半句（indexer 每卡算一遍、各存一份权重）和 L204 的 indexer 参数压成一句，并链接 sparse-attention。

### 审查纪律说明

- 跳过的段落：frontmatter 来源区 L9–34，只 grep 了路径和钉点；「对照源码」正文 L225–310，只 grep 了 H3、版本号和角标；两张图只看了 yaml 里的文字标签。公式块 L104–108、L120–125 和 calc 块 L72–78 落在分段读取的范围里，读到了，并当作公式核对过。
- 违规一次：「源码每次只读 ≤20 行」这条，在 glm5_next.py 上有一次在同一条命令里读了 38 行（L1906–1916 加 L1937–1963）。其余源码读取都在 20 行以内，或者只看 grep 过滤后的输出。
- 没有启动子代理，工具调用全部串行。

## P5 修订记录（09-28，按审查小修）

**P2**

1. L136 通用 MLA 后端的 prefill：改成「本轮新位置的潜向量，连同已经缓存的前文（分块 prefill 的前几块，或前缀缓存命中的部分，按块从缓存取回），都经 KV 展开投影展开成各头的 K、V，按普通多头 attention 算；decode 才走吸收」。核实：db701c1f `mla_v1.py` L1134–1147 `_compute_prefill_context` 在 `chunked_context` 为空时直接返回；L1150 从缓存取潜向量；L1214 经 `kv_b_proj` 展开；L508–517 前文长度取 `num_computed_tokens`，按 `max_context_chunk` 分块，所以分块 prefill 和前缀命中都会走这条路。源码位置表新增一行 `mla_v1.py#L1134-L1214` 与 `#L508-L522`，frontmatter sources 同步加两条。
2. 术语先讲后用：L62 indexer 补「一个给历史位置打分、挑出本次要读哪些位置的小分支」；L133 补 FlashAttention 是「把打分、softmax、汇合融合进一个分块计算的内核写法，中间的分数矩阵不整块写回显存」；L150 KDA 首次出现处加链接 linear-attention，并补「不存逐位置 K/V、只保留固定大小状态的线性注意力」。

**P3**

1. L66「提前乘进」改为「K 的上投影挪到查询一侧、V 的上投影挪到汇合之后再乘」。frontmatter summary 里「吸收进查询和输出投影」未改。
2. L142 改为 qᵢ · R(t−s) · W_UKᵢᵀ · cₛᵀ，说明旋转随两位置之差变化、每个历史位置都不一样，找不到固定矩阵把 W_UKᵢ 并进查询一侧。
3. L189 去掉「2048 + 3」，改为「每行最多 2051 个位置」并链接 sparse-attention#候选位置从哪里来。
4. L156 删掉代入得数（1,024 B、13,056 B），只列三个取值并指向部署页的推导，结果回指本页「为什么要压，代价在哪」（L80 已引用结果并链接部署页）。relations L39 注释未改。
5. L198 indexer 一句压成括注，并链接 sparse-attention「放到 GLM 双机」；L204 的 indexer 参数压成一句并链接 sparse-attention#候选位置从哪里来，顺手把「2048 是每个查询最多读多少个位置」改成「每个查询的位置预算」（与 2051 的上限不矛盾）。

**验证**：`pnpm wiki:lint` 通过（18 处待留意都在其他页，与本页无关）；`pnpm wiki:audit` exit 0，本页来源 27 条，新增两条行号有效（文件 1807 行）。图未改动，未跑 `wiki:diagrams --check`；未开浏览器。

**纪律**：一次违规，改 L136 和 L133 时在同一条消息里并发了两个 Edit；其余调用串行。源码每次读取 ≤20 行。
