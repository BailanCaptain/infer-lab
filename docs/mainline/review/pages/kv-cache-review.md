# kv-cache 审查记录

## P5 写作记录（2026-09-28，第 04 批深改，Opus 5.5 接手 GPT 半成品）

### 接手时的状态

GPT 写手已把旧版（以 Qwen 贯穿例子为底）改成 GLM 版的 8 个 H2，但：直觉图仍是抽象方框；缺「为什么只存 K/V 不存 Q」、重算账、逻辑块 640 / kernel 块 128、每类状态每 token / 每请求多少字节；旧版的四条通用误解和「后续问题」导航丢了；chapters 丢了 11；版本表把 v0.26 写成「未逐项验证」（实际 2ed6cbba 根本没有 glm5_next 代码）；一处 one-request 锚点失效。

### 改了什么

- **标题 / summary / aliases / chapters**：标题改用英文原名 KV cache；summary 写明 13,056 B/token、640 逻辑块及适用条件；恢复旧别名（键值缓存、kv cache、KV 显存）；chapters 补回 "11"（KV cache 章的卫星页都挂 11）。relations 补回 attention-qkv。
- **直觉图 kv-cache.yaml 重画**：同一层相邻两步，K/V 画成 2 行格子（k₁…k₄ → k₁…k₅），新列用 token 色；新 token 向上写入新列，q 只进本步注意力、「用完即弃」；第 t 步整份缓存向下原样留到第 t+1 步。只标位置编号，不标字节与 GLM 形状。
- **第一屏**：一句话定义 + Q/K/V 就地解释 + 「只存 K/V 不存 Q」（使用期限不同 + 因果掩码保证旧 K/V 不变）+ GLM 三种历史形式的预告（MLA 潜向量、indexer K、KDA 固定状态）。
- **第二屏**：用 R1（prompt 4、max_tokens 200）的普通生成变体给出唯一的 calc：20,700 vs 203 个位置、比值约 102（注明不是加速比）；三项代价：占显存（13,056 B/token 链部署页、满长 1.619 GiB、KDA 85 MiB）、仍要读（稀疏 MLA 最多读 2,051 个位置、满长约 1/65，indexer 仍扫全部池 K）、要管理；相邻概念三分 + 后续问题导航（显存预算、规格、KV Pool、量化、卸载、注意力代价）。
- **GLM 走读**：「先拿到块号」一节写清 640 逻辑块 / 128 kernel 块 / 1 = 5，理由一句话 + 链部署页推导；3,855 块只引结论链部署页；块号在 TP 组 8 卡上各指向本卡那一块。「每一层」一节换成 indexer / kpool 术语，补尾状态 FP32 → 池 K BF16 的过程，把「写缓存不需卡间通信」挪到这里并给出理由（压缩投影在 TP 内不切）。「结果返回」一节补 MLA 被拒候选格子靠覆盖、KDA 靠多留状态页的区别。流程图 A3 框补上「1 个 640 格逻辑块看成 5 个 128 格 kernel 块」。
- **状态种类一节**：表格改为五类状态 × 每卡大小；按位置增长两行 → 13,056 B/token 只引结论；按请求三行 → 48 KiB、561,152 B/层、18.2 MiB 有效、85 MiB 实占（约 6,827 token 的按位置历史）；5 个缓存组的分法。
- **有效 vs 占用一节**：R1 写入 47,872 / 52,224 B（链 one-request 推导）、原地改写量、15 块 119.5 MiB 与 0.6% 利用率、满长请求 222 块 1.728 GiB、3,855 块下最多 17 条。
- **「已生成的 token」一节**：删去与第二屏重复的 calc，改用同一个 200 输出例子讲 203 vs 204。
- **常见误解**：补回「为了省显存」「缓存的是 token/embedding」「几层存几层」「开缓存结果会变」四条（改成 GLM 版）。
- **对照源码**：怎么开补 block size 由补丁改成 640 及启动日志；会报什么错补 kernel 块整除错误；开销补「block size 调大只会更浪费」（每页补 94,208 B，14.4%）；版本表按三组 commit 重写，写明 v0.23.0 社区 tag 与 v0.26（2ed6cbba）都没有 glm5_next，main 迁到 models/glm5next 且 640 改用 lcm 对齐；源码位置补 sources 24–26 与 [C6]；底稿出处与待核补全。
- **修掉失效锚点**：one-request 「第二圈和第三圈」的锚点应为 `1--3`。

### 数字取自底稿哪一节

- 02 §1.4：12 层存 KV、MLA 1,024 B / indexer 64 B、13,056 B/token、满长 1.619 GiB、kpool 尾状态 4,096 B × 12 = 48 KiB、KDA 85 MiB。
- 02 §4.5：KDA 递推 (8,128,128) FP32 = 524,288 B、卷积 (3072,6) BF16 = 36,864 B、561,152 B、补齐到 655,360 B（14.4%）、4 页、约 6,827 token 当量。
- 02 §5.4：top-2048 = 512 池、最多 2,051 个位置、满长约 1/65。
- 02 §5.6：逻辑块 640 = 5 × 128、indexer 每池 256 B。
- 02 §9.3：R1 写入 47,872 B / 52,224 B、原地更新量、0.6% 块利用率。
- 01 §A2.2：5 个缓存组、R1 15 块 119.5 MiB、满长 222 块 1.728 GiB、3,855 块下 17 条。
- 13,056 B/token、每块 8,355,840 B、3,855 / 3,908 块、640 的推导：只链接 glm-5-3-flash-two-node，不重算。R1 15 块、47,872 B、KDA 形状：只链接 one-request。

### 核心概念对照了什么

- KV cache 只存 K/V 不存 Q、因果掩码保证等价：按自回归注意力的标准定义写，沿用前版对 PagedAttention 论文 §2.2（source 17）的引用；本轮未重新打开论文，也未重读 attention-qkv 正文（只核了其「因果掩码」标题作锚点）。审查时请顺带核这一段。
- MLA 压缩对象：DeepSeek-V2 §2.1（source 18）；GLM 的 head_size = 512 + 0、BF16 写死：db701c1f `ops/indexer_kpool_mla.py` L69–L134。
- indexer 尾状态是 [K, gate]、FP32、每请求一页的滑动尾巴，池 K 才转 BF16：db701c1f `models/glm5_next.py` L312–L362 的 docstring 与 spec。
- KDA 状态形状与按头切：db701c1f `ops/kimi_kda_state.py` L9–L32。
- 640 / 128：db701c1f `patch/platform/patch_mamba_config.py` L88–L160（`min_attn_block_size`、日志）与 `attention/indexer_kpool_mla_v1.py` L130–L146（整除校验、`kernel_blocks_per_logical_block`）。
- 写缓存不需卡间通信：02 §5.2 的 `fused_qkv_a_proj` Replicated、indexer `wk_weights_proj` Replicated。
- 拒绝候选回退：vllm@0fc695fc `v1/core/sched/scheduler.py` L1414–L1436（`num_computed_tokens -= num_rejected`）。
- 版本：`git ls-tree` 核实 vllm-ascend v0.23.0 tag 与 2ed6cbba 均无 glm5_next；baa023ad 有 models/glm5next/，`patch_mamba_config.py` L110–L125 改为 lcm(128, index_kpool × 16) 对齐；baa023ad 的 `.github/vllm-main-verified.commit` = 84030bbe。

### 验证

- `pnpm wiki:lint`：本页无报错；整体失败 1 处在 hardware-devices.md（source-domain），与本页无关。
- `pnpm wiki:diagrams --check`：163 张图与 spec 一致；本页两张图无提醒。
- `pnpm wiki:audit`：本页 26 条来源全部行号有效；写作标准本页不在名单，按同一规则单独测得：教学正文约 4,600 字，行内代码 0/千字、角标 0、calc 0.22/千字、相邻块 0、图先行、免责 1.6%、图宽合格。
- `pnpm check:content`：通过。
- 本页 45 个站内链接与锚点用 `headingSlug` 逐个核对，全部可解析。
- 未截图、未起服务，浏览器验收留给审查环节。

### 疑点 / 待核

- 「开缓存与重算有末位级浮点差异」是按 KDA prefill（分块）与 decode（递推）两条算子的累加顺序推断，未做数值对比。
- main 上逻辑块仍为 640 是静态推算（前提：KDA 原始状态仍为 561,152 B），未在 main 镜像上实跑。
- 跑 `pnpm wiki:diagrams` 时顺带重写了 cann-hccl.svg（另一位写手当时已改 cann-hccl.yaml 但未生成 svg；输出由其 yaml 决定，未改 yaml）。之后改用只渲染本页两张图的临时脚本。

## P5 审查（09-28）

审查员：Opus 5.5 独立审查，只审不改页。对象：`wiki/concepts/kv-cache.md` 工作区版本（对比 `p4-checkpoint`）。

### 结论

**7.5 / 10**。核心概念全部讲对，数字与底稿逐项一致，没有重算 13,056 和 3,855；扣分主要在旧版「普通注意力」的通用信息丢失（P1）和版本口径（P2）。

### 1. 初学者测试（只读前两屏）

我的一句话：KV cache 是模型每层为已经处理过的位置留下的中间结果，普通注意力里就是 K 和 V；下一步直接读取，只为新位置计算。代价有三项：历史一直占显存，每步仍要读，空间还要分块管理。——**通过**。第一屏 L61 一口气引入 MLA、indexer、KDA 三个名字，密度偏高，但每个都就地给了解释，可以接受。

### 2. 核心概念（逐条对照源码或底稿）

| 页面位置 | 说法 | 判定 | 依据 |
|---|---|---|---|
| L59 | 只存 K/V 不存 Q；因果掩码保证旧 K/V 不变 | 对 | 自回归注意力的标准定义 |
| L61、L102、L126 | MLA 每位置存一条 512 维 BF16 压缩潜向量，不带 RoPE 段，每位置每层 1,024 B | 对 | db701c1f `ops/indexer_kpool_mla.py` L69–L76（head_size = kv_lora_rank + qk_rope_head_dim，dtype 写死 bfloat16）；02 L32/L36（qk_rope_head_dim=0，整个 MLA 与 indexer 都不带 RoPE）；02 §5.6 L496 |
| L61、L102、L127–L128 | indexer K：新位置的 [K, gate] 以 FP32 进尾状态，凑满 4 个位置按 softmax 门控合成一条 128 维池 K，转 BF16 写入，每池 256 B，折合每位置 64 B；尾状态每请求每层 4,096 B | 对 | db701c1f `models/glm5_next.py` L312–L362 docstring（"one [K, gate] vector per token"、"sliding tail… one page per request"、float32）；02 §5.4 L428–L429；02 §5.6 L497–L498 |
| L61、L106、L129–L130、L134 | KDA：每卡 8 头各一个 128×128 FP32 递推矩阵（524,288 B），加 (3072,6) BF16 卷积状态（36,864 B，含 3 个候选槽），与长度无关；补齐到 655,360 B × 4 页 = 85 MiB/请求/卡 | 对 | 02 §4.5 L292–L312 |
| L110 | MLA 被拒候选靠覆盖；KDA 按接受数取对应那份状态，卷积也按接受数对齐 | 对 | db701c1f `ops/kimi_kda.py` L530–L558：`_run_causal_conv1d(..., num_accepted_tokens)` 与 `_run_recurrent(..., spec_state_indices_tensor, num_accepted_tokens)` |
| L94、流程图 A3 | 逻辑块 640 = 5 个 128 kernel 块；Worker 在 block table 里把 640 的块号展开成 5 个连续的 128 块 | 对 | db701c1f `patch/platform/patch_mamba_config.py` L131–L159（min_attn_block_size = 128 × cdiv(561152, 128×1024) = 640）；`attention/indexer_kpool_mla_v1.py` L138–L146（整除校验、kernel_blocks_per_logical_block）、L553–L554（主 MLA 后端只支持 128 的 kernel 块）、L212–L237（indexer 从展开后的块表每隔 5 列取回逻辑块）；`worker/model_runner_v1.py` L4949–L4974（select_common_block_size 选出 kernel 块） |
| L100、L104 | MLA 潜向量在 TP8 内复制，KDA 按头切；写缓存不需要卡间通信 | 对 | 02 §5.2 L393、L398、L403（fused_qkv_a_proj、wk_weights_proj Replicated）；02 §4.6 L320 |
| L122 | 45 层主干 = 34 KDA + 11 稀疏 MLA；MTP 第 45 层也是带 indexer 的 MLA，所以按位置增长的共 12 层 | 对 | 02 §1.4 L142 |

没有发现讲错的核心概念。

### 3. 数字

逐项和底稿对照，全部一致：13,056 B、1.619 GiB、8,355,840 B、48 KiB、85 MiB（02 §1.4 L146–L151）；524,288、36,864、561,152、655,360、14.4%、约 6,827 token（02 §4.5）；512 池 → 2,048 + 3 = 2,051、1/65（02 §5.4 L435–L450）；47,872、52,224、0.6%（02 §9.3 L981–L988）；5 组、15 块、119.5 MiB、222 块、1.728 GiB、17 条（01 §A2.2 L647–L656）。我还手算了几项：20,700 ÷ 203 ≈ 102；34 × 561,152 B ≈ 18.2 MiB；655,360 − 561,152 = 94,208；3,855 ÷ 222 → 17。3,908 块在底稿里没有，页面只引结论并链接部署页 L218/L231，没有问题。

**写手疑点逐条核实**

- 「v0.26 根本没有 GLM-5.3-Flash 的代码」：**属实，但要补一处限定**。对 `2ed6cbba` 跑 `git ls-tree` 查 `glm5`，`vllm_ascend/` 下没有 glm5_next 模型，教程也只有 GLM5 和 GLM5.2，没有 GLM5.3-Flash；上游 `vllm@568afb3a` 只有 kimi_linear，没有 glm5next。不过 2ed6cbba **有** `ops/kimi_kda.py`、`ops/kimi_kda_state.py`、`attention/indexer.py`，还有通用 hybrid 的 `patch_mamba_config.py` L58–L105（按 128 对齐，保证 attention 页 ≥ mamba 页）。所以版本表「逻辑块取 640 的算法」一行的 v0.26 格写「无此路径」会被读成「没有任何对齐逻辑」，应改成「无 GLM 分支，只有通用 hybrid 对齐」。另外两处也核实了：社区 v0.23.0 tag（5cb98caa）和登记钉点 2c59ff10 都没有 glm5 文件；main 的 baa023ad 有 `models/glm5next/`，`patch_mamba_config.py` L110–L125 用 lcm(128, index_kpool×16) 对齐，下限 cdiv(mamba_raw, 每 token 页)，页面写法正确。底稿 01/02/03 完全没有提到 v0.26（只有 parking 里的 Qwen 旧事实），所以这一条只能拿源码核。
- 全库一致性：没有任何页声称 v0.26 有 GLM 代码。但 one-request.md L583 写「本页尚未核实这套 GLM 专用路径的可用性」，matmul-and-weights.md L194 写「GLM 整模型兼容性需另外核验」，glm-5-3-flash.md L383 写「尚未逐项核实」，都和本页已经核实的事实口径不一致，见 P2-2。
- 「开缓存与重算有末位级浮点差异」：方向对，但「末位级」说轻了，见 P3-4。
- 「main 逻辑块仍为 640」：页面已经写成条件句（状态仍为 561,152 B 时），可以接受。

### 4. 有没有丢信息（`git diff p4-checkpoint`，只看删除行）

旧版是 Qwen 贯穿例子（37 token、40 层存 10 层、2 个 KV 头等）。这些 Qwen 专属数字随主线换成 GLM，不算丢失。按旧版 H2 逐条对照：

- 没有它会怎样 → 改成新 calc，保留了「按平方增长」。
- 为什么只存 K 和 V → 在 L59。
- 40 层里只有 10 层 → 换成 GLM 的 34/11/12 层。
- 每 token 占多少 → 换成五类状态表。
- 量级怎么看 → 部分保留在 L78、L134。
- 那条请求走到这里 → 换成 GLM 走读。
- 引出的一串问题 → 保留在 L84 的导航。
- 四条误解 → 都在。

**丢了的通用信息**（旧行号指 p4-checkpoint 版本）：

1. 旧 L160：跨层共享，声明了 `kv_sharing_target_layer_name` 的层不建自己的缓存。
2. 旧 L167、L171–L172：普通注意力的写缓存路径 `attention_v1.py` 的 `do_kv_cache_update` → `reshape_and_cache`（按 `slot_mapping` 写格子），以及 `get_kv_cache_shape` 给出的缓存形状。

全库 grep 下来，这两条现在只剩 `wiki/raw/` 的源码摘录，所有 concept 页和 parking 里都没有，见 P1-1。

另外几条在别的页还能找到，只算 P3：「存的 K 已经过 RoPE、V 原样」在 rope.md；「GQA 共享 KV 头省缓存」在 gqa.md 和 attention-cost.md；「纯注意力小模型的缓存可以和模型一样大」这条对比在全库已经没有。frontmatter 的 `verified` 从三版清成 `[]`，`order: 5` 被删，rope、gqa、paged-attention 三个链接也没了。`verified: []` 本身站得住（GLM 数字只对 db701c1f 有效），但写作记录里没交代。

### 5. 单一出处

没有重算。13,056 只出现在 L5（summary）、L78、L132，每处都只给结论并链接 `glm-5-3-flash-two-node#占住一个块号要用多少显存`；3,855 只出现在 L94 和 L144，都链接部署页。对照源码里 L204 引用的 cdiv 公式是源码位置说明，不是数值推导。L126–L127 给出每层的 1,024 B 和 64 B，属于本页的状态规格，没有写出 12 × 1,088 的乘式，可以接受。

### 6. 链接、锚点、audit、页面实测

- 我用 scratchpad 里的 `check-links-kv.mjs` 核对，它复用 `src/content/wiki/anchors.ts` 的 headingSlug 规则：本页外链 47 个，失效 0；全库指向 kv-cache 的链接 12 个，失效 0。
- `pnpm wiki:audit` 退出码 0。本页 26 条来源行号全部有效，还有 4 条 URL 没有联网验证。本页不在写作标准名单里；我按同一规则手工核了正文：行内代码 0 个，证据角标 0 个，calc 1 个且不和表格相邻，五个 H3 齐全且顺序正确，版本差异里 v0.23、v0.26、main 都出现了。
- 浏览器实测：用 Playwright 在 1440×900 下打开 `localhost:5193/#/wiki/kv-cache`。H1 正确，9 个 H2 都渲染出来，两张图宽 880 px，没有横向滚动，控制台 0 个错误。直觉图和流程图也单独截图看过：直觉图画的正是「新 token 把 k、v 追加进缓存，下一步原样读出」，符合要求。

### 7. 问题清单

**P1**

- **P1-1 普通注意力的缓存机制从全库 concept 页消失。** 位置：旧版对照源码 L160、L167、L171–L172，新版没有对应内容。影响：问答底子里查不到「非 GLM 模型的 K/V 怎么写进缓存、缓存张量是什么形状、跨层共享怎么回事」。改法：在「源码位置」加一条「普通注意力（非 GLM）」，按三个钉点写 `do_kv_cache_update` → `reshape_and_cache`、`get_kv_cache_shape`、`kv_sharing_target_layer_name`；或者把这几条移进 kv-cache-spec 页，本页只放链接。正文「每一层各存各的」附近再补一句：少数模型会声明跨层共享。

**P2**

- **P2-1 版本表 v0.23 列的口径和全库约定冲突。** 位置：L188、L193。本页把 v0.23 列定义为「vllm 0fc695fc + 专用基线 db701c1f」，核查时用的也是 v0.23.0 tag（5cb98caa）。但 learning-guide.md L98 和 sources/glm-5-3-flash-baseline.md L67 规定 v0.23 = vllm-ascend 2c59ff10 / vllm 0fc695fc，db701c1f 要单独标出，并且明言不能只写一个「v0.23」代替它们。结论本身不受影响（我核过 2c59ff10 同样没有 glm5 文件）。改法：v0.23 列改用 2c59ff10，GLM 数字另起一句说明来自 db701c1f，写法参照 tensor-parallel.md L410。
- **P2-2 v0.26 事实没有单一出处，本页一格措辞过宽。** 本页 L193 说 2ed6cbba 没有 glm5_next，这已经核实；但 one-request.md L583、matmul-and-weights.md L194、glm-5-3-flash.md L383 仍写「尚未核实」。改法：把「v0.26（2ed6cbba）没有 glm5_next 模型和 GLM5.3-Flash 教程；main 在 `models/glm5next/`」写进 learning-guide 的版本差异或 sources 基线页，其余页只链接过去；one-request L583 同步改掉。本页 L194 的「无此路径」改成「无 GLM 分支，只有通用 hybrid 对齐（2ed6cbba `patch_mamba_config.py` L58–L105）」。

**P3**

- **P3-1 直觉图文字压线。** 位置：`kv-cache.yaml` 标签 `[24, 262]`。「原样留到下一步」那条竖箭头正好从「第 t+1 步：新输入是位置 5」的「入」和「是」之间穿过，截图 `scratchpad/kv-zoom.png` 可以看到。改法：把标签左移或下移，或者给箭头换一条路径。
- **P3-2 「每步最多读 2,051 个位置」说得太宽。** 位置：L80。改为「每个查询位置最多读 2,051 个」；开 MTP 时一步有 4 个查询位置。
- **P3-3 「块号由 DP 组的引擎统一分配」容易误解。** 位置：L94。容易读成「一台引擎管两台机器」。改为「由本机这个 DP rank 的引擎分配」。
- **P3-4 浮点差异说轻了。** 位置：L162 的误解。「末位级差异」低估了后果：微小差异可能让之后某一步采样出不同的 token，后文随之分叉。建议改成「微小差异，个别情况下会让后续采样走向不同 token」，并链接 batch-invariance 页。
- **P3-5 MTP 写入的说法和 one-request 不一致。** 位置：L140。本页写「写入次数要另看执行记录」，one-request L389 明确说第 5 站为这 4 个位置写 4,352 B。改法：统一口径，或者直接链接到第 5 站。
- **P3-6 两个词先用后讲。** 位置：L152、L162、L94、L134。「prefill」「物理页」出现前没有解释。改法：就地各补一句——prefill 是一次处理整段 prompt 的那一步；一个块号在每一层对应一段显存，叫一页。
- **P3-7 删掉的通用知识点和 frontmatter 改动没有交代。** 「K 存的是 RoPE 之后的」「GQA 省 KV 头」可以各补半句加链接，例如 GLM 的 MLA 与 indexer 不带 RoPE。`verified` 清空、`order` 删除、rope/gqa relation 删除，这几处改动要在写作记录里写清理由。

### 跳过的段

- frontmatter 的 sources 区（L8–L34），按规则交给 audit。
- 「## 对照源码」正文（L166–L212）：只用 grep 核了 H3 和版本号。因为疑点 3 要核实，读了版本表 L188–L196。
- 旧版对照源码只 grep 了标识符和 L160、L167、L171–L172。
- 没有读取被拦截的情况。

## P5 修订记录（09-28，Opus 5.5，按「P5 审查（09-28）」修订）

### P1-1 普通注意力写缓存与跨层共享：补回，并纠正旧版一处说法

- 找回旧讲法：`git show p4-checkpoint:wiki/concepts/kv-cache.md` 的 L147–L172（形状、写缓存、跨层共享三条）。
- 对照源码后，旧版有一处要纠正。旧版写的是「写缓存走 `do_kv_cache_update` → `reshape_and_cache`」，但这不是生产主路径。
  - 上游 `vllm@0fc695fc` 的 `backend.py` L66 默认 `forward_includes_kv_cache_update = True`。Ascend 的 `AscendAttentionBackend` 没有覆盖这个值（三个钉点 grep 均无结果），所以 `attention.py` L489–L499 不会调用 `unified_kv_cache_update`。
  - 实际写入发生在后端自己的 `forward` 里：2c59ff10 L1529–L1534 调用同文件的 `reshape_and_cache`（L1430–L1454），后者按 `attn_metadata.slot_mapping` 调 `DeviceOperator.reshape_and_cache`，即 `device_op.py` L47–L52 的 `torch_npu._npu_reshape_and_cache`。
  - `do_kv_cache_update`（L1408）在三个钉点里都只被 `patch_qwen3_dflash.py` 调用。
  - 2ed6cbba（L1659/L1745）和 baa023ad（L1195/L1280/L1365）的调用关系相同。
- 缓存形状：三个钉点的 `get_kv_cache_shape` 都返回 `(2, num_blocks, block_size, num_kv_heads, head_size)`。baa023ad L109–L110 在 `VLLM_KV_CACHE_LAYOUT ∈ {LBHNC, HND}` 时换成 `(2, num_blocks, num_kv_heads, block_size, head_size)`，这一点旧版的版本表写成了「相同」。每块字节数按上游 `kv_cache_interface.py` L194–L200 计算：`2 × block_size × num_kv_heads × head_size × dtype`。
- 跨层共享：
  - 上游 `attention.py` L401–L407 校验共享目标，L494/L514 在独立写入入口跳过共享层。
  - Ascend runner 2c59ff10 在 `get_kv_cache_spec` L4927–L4938 跳过共享层的 `KVCacheSpec`，在 `initialize_kv_cache_tensors` L3932–L3935 把共享层的张量指向目标层。2ed6cbba 与 baa023ad 的对应行分别是 L4976/L4984、L4004–L4005 和 L5844/L5852、L4585–L4586。
  - **新发现的版本差异**：2ed6cbba `reshape_and_cache` L1565–L1570 与 baa023ad L1136–L1141 在写入前检查 `kv_sharing_target_layer_name`，命中就直接返回，注释写的是 "Writing their dummy/current K/V would overwrite shared slots"。2c59ff10 的同名函数没有这项检查，只在 L446–L451 让图回放使用目标层的元数据。已写进版本表，并在正文和待核里注明。
- GLM 双机用不用得到：**用不到**。
  - db701c1f 的 `IndexerKPoolMLACacheLayer(nn.Module, AttentionLayerBase)`（L39）不是上游 `Attention`，L94 显式传入 `kv_sharing_target_layer_name=None`。
  - runner L5142–L5152 的共享判断要求 `isinstance(attn_module, Attention)`，GLM 的层不会命中。
  - `glm5_next.py` L2080–L2089 显示 decoder 层只有 KDA 和 `AscendGlm5NextMLAAttention` 两种，MTP（`glm5_next_mtp.py` L85）复用同一个 decoder 层。
- 落点：
  - 正文在「混合模型到底要保留哪几类状态？」末尾新增 H3「对照：普通注意力只存一类状态，少数模型还跨层共用」，讲缓存形状、按槽位写入、每 token 字节式、RoPE 之后的 K、GQA 省 KV 头、跨层共享，以及 GLM 为什么用不到。
  - 版本表新增三行：普通注意力的缓存形状、写缓存路径、跨层共享。
  - 源码位置新增两条。sources 从 26 条增加到 41 条（新增第 27–41 条）。

### P2-1 版本表口径

- 版本差异的开头改用 tensor-parallel.md L410 的写法：v0.23 = Ascend 2c59ff10 / vLLM 0fc695fc，v0.26 = 2ed6cbba / 568afb3a，main = baa023ad / 84030bbe；db701c1f 另起一句单独说明。
- GLM 行的 v0.23 格改为「2c59ff10 没有 glm5_next」。640 行的 v0.23 格改为「只有通用 hybrid 对齐」：2c59ff10 `patch_mamba_config.py` L58–L107 按 128 取整，日志是 "to ensure that attention page size is >= mamba page size"。db701c1f 的 GLM 分支在同一格里另外写明。
- v0.26 格按 P2-2 改成「同 v0.23 维护分支：无 GLM 分支，只有通用 hybrid 对齐」（2ed6cbba L58–L107）。

### P2-2 v0.26 的 GLM 代码：统一为已核实的结论

证据命令：`git -C tools/repos/vllm-ascend ls-tree -r --name-only <提交> | grep -i glm`（2026-09-28 实跑）。

- 2ed6cbba 的 `vllm_ascend/` 下只有 `patch/platform/patch_glm_reasoning_usage_accounting.py`。教程只有 GLM4.x、GLM5、GLM5.2，其余是 GLM-4.7、5.1、5.2 的测试配置。grep `glm5_next|glm5next|GLM5.3` 的计数为 0。
- 2c59ff10 的 `vllm_ascend/` 下只有两个 GLM 工具调用补丁，教程相同，计数同样为 0。
- baa023ad 有 `vllm_ascend/models/glm5next/`（共 17 个文件）和 `GLM5.3-Flash.md` 教程。
- 上游 `vllm` 0fc695fc 与 568afb3a 的 `model_executor/models` 下只有 `kimi_linear.py`，没有 glm5 模型。

各页只改了那一句话，统一链接到 `kv-cache.md#版本差异`：

| 页面 | 位置 | 改前 | 改后 |
|---|---|---|---|
| wiki/concepts/kv-cache.md | 版本表后新增一段 | 无 | 写明证据命令和三版结果 |
| wiki/concepts/one-request.md | 版本差异 v0.26 条（L583） | 本页尚未核实…… | 已核实没有 GLM-5.3-Flash 模型代码，附命令和结果 |
| wiki/concepts/matmul-and-weights.md | 版本表 v0.26 行最后一格（L220） | GLM 整模型兼容性需另外核验 | 已核实没有模型代码，本文的 GLM 部署不适用 |
| wiki/concepts/glm-5-3-flash.md | 版本差异末尾的待核句（L383） | v0.23 / v0.26 / main 的完整差异尚未逐项核实 | 已核实 v0.23 维护分支与 v0.26 都没有；main 有 glm5next；main 与 db701c1f 的完整差异仍待核 |

这三页的 frontmatter sources 都没有动：证据是一条 `ls-tree` 命令，没有具体的文件行号可以引用。

没有改的相近说法：
- matmul-and-weights.md L224「三版整模型运行兼容性仍需另外核验」：说法偏宽，但不算错。按「每页只改一句」没有动。
- short-request-first.md L78、batch-job-aware-scheduler.md L40：讲的是「这个调度扩展能否与 GLM 组合」，不属于「v0.26 有没有 GLM 代码」这个问题。
- cann-hccl.md L193：讲的是镜像配套。

### P3

- P3-1：`kv-cache.yaml` 里「第 t+1 步」标签从 [24, 262] 挪到 [140, 262]，移到竖箭头（x=127）右侧，不再压线。已重新生成 svg，没有截图。
- P3-2：改成「每个查询位置最多读 2,051 个历史位置」，并补一句「R1 开着 MTP，一步有 4 个查询位置，这个上限按每个查询位置分别计」。
- P3-3：改成「由 R1 所在 DP rank（也就是本机）的引擎分配」。
- P3-4：改成「微小的数值差异；个别情况下会让后面某一步采样出不同的 token，之后的文本随之分叉」，并链接 `batch-invariance.md#批的变化怎样影响数值`。待核句同步修改。
- P3-5：和 one-request 第 5 站统一。MTP 第 1 遍草拟为这 4 个位置写 4,352 B，12 层合计 52,224 B；去掉「另看执行记录」，改为链接第 5 站。
- P3-6：「物理页」在 L94 第一次出现时就地定义：一个块号在每一层对应一段显存，叫一页。「prefill」在 chunked prefill 处就地定义：一次处理整段 prompt 的那一步。
- P3-7：「K 存的是 RoPE 之后的」和「GQA 省 KV 头」放进新 H3，并各附锚点链接。relations 补回 rope，并新增 gqa。
  - `verified: []` 保留，理由是本页的 GLM 数字只对 db701c1f 有效，三个发布分支都没有 GLM 代码。
  - `order: 5` 不补：kv-cache 在 `src/content/wiki/toc.ts` L74 的 CURATED 列表里有固定位置，`order` 只影响没有列进这个列表的页。
  - 旧版「纯注意力小模型的缓存可以和模型一样大」这条对比没有补回：它依赖旧的 Qwen 数字，GLM 主线里没有对应的例子。

### 验证

- `pnpm wiki:lint`：通过。本页的 mark-flood 提示一度升到 43 处，原因是新增的源码条目带了角标。删掉这两条的角标（正文已写明 source 编号）后，本页不再出现在提示里；其余 22 处提示在别的页。
- `pnpm wiki:diagrams`：163 张图，更新了 1 张（kv-cache.svg）。`pnpm wiki:diagrams --check`：163 张图与 spec 一致。
- `pnpm wiki:audit`：退出码 0。本页 41 条来源中，37 条本地引用的行号有效，4 条 URL 没有联网验证；无效 commit、文件不存在、行号越界都是 0。
- 链接：用 scratchpad 里的 `check-links-kv.mjs` 检查，本页外链 54 条，失效 0；全库指向 kv-cache 的链接 15 条（新增 3 条），失效 0。
- 正文（对照源码以上）没有行内代码和证据角标，calc 仍是 1 个，没有和表格相邻。
- 没有做浏览器验收，留给审查环节。

## P5 复审（09-28）

审查员：Opus 5.5，快速复审，只核「P5 修订记录」有没有落实，只审不改页。页面 `wiki/concepts/kv-cache.md` 工作区版本。

### 结论

**9.0 / 10**。上一轮的 P1-1、P2-1、P2-2 全部落实，源码逐条对得上；没有新的 P1、P2。剩下 3 条 P3，不影响问答底子。

### 逐条核对

**1. P1 普通注意力写缓存：落实。**
- 页面：版本表 L220「forward 里调用 reshape_and_cache……相同｜相同」；源码位置 L236 写明主路径不经过 `do_kv_cache_update`，只有 Qwen3 DFlash 补丁调用。
- 源码（git grep / git show 实跑）：
  - 上游 vllm@0fc695fc `vllm/v1/attention/backend.py` L66 `forward_includes_kv_cache_update: bool = True`；`attention.py` L492–L499 只有该值为假、且不是共享层时才调 `unified_kv_cache_update`。vllm_ascend 三个钉点 grep `forward_includes_kv_cache_update` 均无结果，没有覆盖默认值。
  - 2c59ff10 `attention_v1.py`：`forward` L1479 内 L1532 调 `self.reshape_and_cache`；`reshape_and_cache` L1430–L1454 按 `attn_metadata.slot_mapping` 调 `DeviceOperator.reshape_and_cache`；`device/device_op.py` L47–L52 是 `torch_npu._npu_reshape_and_cache`。
  - 2ed6cbba 调用点 L1659、L1745；baa023ad 调用点 L1195、L1280、L1365。
  - `do_kv_cache_update` 的调用方：2c59ff10 只有 `patch/worker/patch_qwen3_dflash.py` L53，2ed6cbba 与 baa023ad 只有同文件 L60。与页面一致。
- 缓存形状（L219）：2c59ff10 L112、2ed6cbba L107 返回 `(2, num_blocks, block_size, num_kv_heads, head_size)`；baa023ad L109–L111 在 `VLLM_KV_CACHE_LAYOUT ∈ {LBHNC, HND}` 时换序。一致。
- sources 27–32（frontmatter L35–L40）指向的行与上面一致。

**2. 跨层共享：落实。**
- 页面：正文 L159「Ascend 从 v0.26 起才在写入函数里显式跳过共享层」；L161「GLM 双机部署用不到这两条」；版本表 L221；源码位置 L237；待核 L244 说明 v0.23 只核了写入函数本身。
- 源码：
  - 2ed6cbba `reshape_and_cache` L1565–L1570、baa023ad L1136–L1141 在写入前判 `kv_sharing_target_layer_name`，命中直接返回；2c59ff10 的 L1430–L1454 没有这项判断（grep 该名只命中 L409/L425/L451）。
  - 三个钉点的 runner 都有 `get_kv_cache_spec` 跳过共享层（2c59ff10 L4929/L4937、2ed6cbba L4976/L4984、baa023ad L5844/L5852）和张量指向目标层（L3935、L4005、L4586）。
  - GLM：db701c1f `ops/indexer_kpool_mla.py` L39 `IndexerKPoolMLACacheLayer(nn.Module, AttentionLayerBase)`，L94 `kv_sharing_target_layer_name=None`；runner L5143–L5152 的判断要求 `isinstance(attn_module, Attention)`。GLM 用不到，结论成立。

**3. 版本表 v0.23 列：落实。**
- L213 开头写「v0.23 维护分支为 Ascend 2c59ff10 / vLLM 0fc695fc；v0.26 …… 2ed6cbba / 568afb3a；main 为 Ascend baa023ad / vLLM 84030bbe」，db701c1f 另起一句加粗单独说明。与 tensor-parallel.md L410 写法一致（后者 main 多写了 `.github/vllm-main-verified.commit` 的出处，不算冲突）。
- L222、L223 的 v0.23 格先写 2c59ff10 的结论，db701c1f 的 GLM 分支在同格另起说明。

**4. v0.26 的统一说法：落实。**
- 四处都写「v0.26（2ed6cbba）没有 GLM-5.3-Flash 模型代码」，都给出 `git ls-tree -r --name-only … | grep -i glm` 这条证据，另外三页都链接 `kv-cache.md#版本差异`：
  - one-request.md L583；matmul-and-weights.md L220；glm-5-3-flash.md L383（三处都在各自「对照源码 / 版本差异」内）；kv-cache.md L222 + L225。
- 证据复跑：`ls-tree | grep -ci "glm5_next\|glm5next\|GLM5.3"` 在 2c59ff10、2ed6cbba 为 0，baa023ad 为 46（`vllm_ascend/models/glm5next/` 递归 17 个文件，含 `GLM5.3-Flash.md` 教程）；2ed6cbba 的 vllm_ascend/ 下只有 `patch_glm_reasoning_usage_accounting.py`，2c59ff10 只有两个 GLM 工具调用补丁；教程两版都只到 GLM5.2；上游 0fc695fc、568afb3a 的 models 下只有 `kimi_linear.py`。L225 说 2ed6cbba 已有 `ops/kimi_kda.py` 与 `attention/indexer.py`，也核实存在。
- one-request、glm-5-3-flash 的 diff 各只改这一行。matmul-and-weights 的 diff 很大，是该页另一批次的未提交重写，不属于本次修订，本次只核了 L220。

**5. `pnpm wiki:audit`：通过。** 退出码 0。kv-cache 块：41 条来源，除 4 条 URL 未联网验证外全部 ✓，无效 commit、文件不存在、行号越界均为 0。全库：审计 131 页、来源 1668 条，写作标准名单 15/15 达标。输出存于 scratchpad `audit-kv-recheck.txt`。
- 新增链接的锚点：gqa.md L50「缓存容量按 KV 头数计算」、rope.md L73「RoPE 的位置与缓存地址不同」都存在。
- 新 H3（L155–L161）没有行内代码和证据角标。

### 问题清单

**P1**：无。

**P2**：无。

**P3**
- **P3-a 「默认 True」没有单独的来源行。** 位置：L236「沿用上游默认 `forward_includes_kv_cache_update = True`」只引了 source 31（attention.py 的判断），默认值本身在 vllm@0fc695fc `vllm/v1/attention/backend.py` L66，sources 里没有。结论是对的。改法：sources 补一条 `backend.py#L66-L66`。
- **P3-b 「v0.26 没有 GLM 代码」的证据写了四遍。** 位置：one-request L583、matmul-and-weights L220、glm-5-3-flash L383、kv-cache L225。四处都复述命令和结果，严格说不是单一出处；而且这件事放在 kv-cache 页当主出处，归属偏窄。改法：以后把这段挪到 sources 基线页或 learning-guide 的版本差异，其余四处只留一句结论加链接。本轮用户要求「都要有证据」，所以不扣重分。
- **P3-c 直觉图压线的修改没有截图验收。** 修订记录 L214 自报「已重新生成 svg，没有截图」。本次是快速复审，也没有开浏览器；留到下一次浏览器验收。

### 跳过的段

- frontmatter 的 sources 区：只 grep 了新增的 27–41 条（L35–L49）的路径和行号，没有通读。
- 「## 对照源码」只读了 L211–L244（版本差异与源码位置），因为这次要核的四项都落在这里；正文只读了新 H3 所在的 L137–L164。
- 其余正文没有重读；没有打开浏览器。
- 没有读取被拦截的情况。

## 修订记录（2026-09-28，断锚修复）

- 依据 `layers-and-hidden-review.md` P2-1：L123 的链接 `layers-and-hidden.md#隐藏维度与残差流分别表示什么` 指向 layers-and-hidden 重写前的旧 H2，已失效。
- 改为 `layers-and-hidden.md#本轮-hidden历史状态和权重各管什么`（对应该页「本轮 hidden、历史状态和权重各管什么」一节，讲的正是 hidden 只活在一次前向、缓存不保存它）。只改锚点，链接文字和正文不动。
- 验证：按 `src/content/wiki/anchors.ts` 的 `headingSlug` 规则对全库指向 layers-and-hidden 的锚点重新校验，0 失败；`pnpm wiki:audit` 的唯一失败来自 concepts/ascend-patch-system.md，与本页无关。

## P5 修订记录（09-28，跟着 kv-cache-spec 审查 P3-4 收紧跨页重复）

- 「开销和什么时候别开」：原 L209（调大没好处，外加 94,208 B / 14.4%）缩成一句，链到 `kv-cache-spec.md#开销和什么时候别开`。
- 「版本差异」表删掉「逻辑块取 640 的算法」这一行，表后加一句话，链到 `kv-cache-spec.md#版本差异`。这一行独有的三版日志文案，删之前已经补进 kv-cache-spec 的「逻辑块怎样定」一行，并对照源码核对：
  - v0.23 2c59ff10 `patch_mamba_config.py` L105；
  - db701c1f L155–156；
  - main baa023ad L122–123。
- 验证：
  - `pnpm wiki:lint` 通过；
  - `pnpm wiki:audit` 退出码 0，本页在名单里且达标：5,203 字，行内代码 0.0/千字；
  - 版本差异里 v0.23、v0.26、main 仍然都在；
  - 本页 35 条带锚点的链接全部能解析。
