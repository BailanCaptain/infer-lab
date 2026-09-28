# layers-and-hidden 审查记录

## P5 写作记录（2026-09-28，第 04 批，深改＋补节）

### 改了什么

- 按「先直觉、后数字」重排：首屏「一层接过什么、交出什么？GLM 为什么在层间传四条？」（一句话定义 hidden 与四条残差流 + 直觉图）→「为什么要四条流，Sinkhorn 又管什么，代价在哪？」（HC 的动机、不加约束的连乘失控、双随机矩阵三条性质、Sinkhorn 迭代、入口/写回权重范围、为什么是 4 条、代价与 1 个 calc）→「放到 GLM 双机」（45 层层表、R1 逐步走读、两种 RMSNorm、TP 下每卡重复计算、hidden/历史/权重分工、decode 的 T）→「哪几层的连接不一样」（第 0 层、第 44 层、MTP 层、各层型）→ 常见误解 9 条 → 对照源码五个 H3。
- 补节：本页成为 mHC 的单一出处，覆盖任务要求的四项：为什么是 4 条流、每层怎样分出输入与写回、Sinkhorn 的作用、显存与计算代价。
- 新图 `layers-and-hidden-intuition`：一段子层里四条流「分出一路 → RMSNorm → 子层 → 写回」与旁路「4×4 混合（每行每列和为 1）」再汇合成新四条流；图上无 GLM 形状与字节。
- 改图 `layers-stack`：从静态层叠图改为第 4 站的代码流程图，带「是第 44 层吗？」分支与回环、第 0 层复制、每层两段、末层求平均、最终 RMSNorm → 输出投影；右侧标层型与 MTP 层不走 mHC。
- 模型配置来源从 eb9eb208 改为写作标准钉住的 690b7052；来源由 7 条增至 22 条（含 mHC 论文 arXiv 2512.24880、db701c1f 的两份 Python 参考实现、main 与 v0.23/v0.26 的对照），全部行号在 `wiki:audit` 下有效。
- relations：保留 embedding，新增 glm-5-3-flash、one-request（均为 builds-on）；mlp-residual-norm、attention-qkv、pipeline-parallel 已由对方页写 builds-on 指回本页，不再反写以免成环。
- 字数（`wiki:audit` 的正文口径，含源码区）：2012 → 11583；写作标准口径的教学正文 4333 字。行内代码 0.0/千字（教学正文），对照源码之上角标 0，全页角标 26（C 20 / S 4 / D 2），calc 1 个，免责 0.0%。

### 数字取自哪里

- 02 §0.2：45 层 / hidden 4096 / vocab 154880；`mhc=true`、`hc_mult=4`、`hc_sinkhorn_iters=20`；34 层 KDA + 11 层稀疏 MLA；前 3 层稠密、42 层 MoE。
- 02 §1.1：层表（0–2 KDA+稠密；3、7、…、43 稀疏 MLA+MoE；其余 31 层 KDA+MoE）。
- 02 §1.2：一次前向 218 次集合通信里没有 mHC（正文只写结论并链接 one-request「一次前向的通信账」）；o_proj 每层一次 TP8 All-Reduce。
- 02 §2.1–§2.2：embedding 后复制成 [T,4,4096]、摊平为 [T,16384]；每子层前后各一次 hc_pre / hc_post；末层 `view(T,4,-1).mean(dim=1)`。
- 02 §2.3：每 token 残差 32,768 B；mHC 参数每层 2 × 1.5 MiB = 3.0 MiB、45 层 135 MiB/卡、不切 TP；每层两次 [T,16384]×[16384,24] 与两次 20 轮 Sinkhorn；一次前向 90 次 hc_pre、1,800 轮、90 次 hc_post；MTP 层不走 mHC。R1 的 128 KiB 只链接 one-request「词嵌入与四路残差」，不重算。
- 02 §0.4：`hc_*` 六项 FP32、各 45 份（MTP 层没有）。
- 02 §7.1、§9.1：先折叠四路再做最终 RMSNorm；prefill 只取最后位置（链接 one-request「最终归一化与词表投影」）。
- 每卡主干权重「约 20 GiB」取自 02 §12（20,537 MiB = 20.06 GiB），正文只写量级并链接部署页。

### 核心概念对照了什么

- mHC 论文（arXiv 2512.24880，Xie 等，2025-12-31 提交、2026-01-05 修订，已联网核对摘要与正文）：HC 加宽残差流、丢失恒等映射导致训练不稳；mHC 用 Sinkhorn-Knopp 投影到双随机矩阵，t_max = 20；H_pre 用 sigmoid、H_post 用 2σ，保证非负；双随机的谱范数 ≤ 1、乘法封闭、凸组合守恒；实验取 n = 4；n = 4 时训练时间多约 6.7%。
- vllm-ascend@db701c1f `models/glm5_next.py`：L148–153（复制成四条）、L2064–2127（按层号选 KDA/MLA、稠密/MoE）、L2128–2145（hc 参数形状 (2+n)·n × n·hidden、FP32，MTP 层不建）、L2147–2169（hc_pre / hc_post 直接调融合算子，传入 20 轮）、L2189–2241（MTP 或非 mHC 走单条残差；mHC 分支 hc_pre → input_layernorm → attention → hc_post → hc_pre → post_attention_layernorm → mlp → hc_post；第 44 层求平均）、L2293–2319（查表 → 逐层 → 最终 norm，确认先求平均后 norm）。
- vllm-ascend@db701c1f `ops/mhc.py` L5–37（pre = σ + eps、post = 2σ、comb = softmax 后 20 轮先行后列）；`glm-5-next-adapt-0826/glm-5-next-transformers.patch` L1965–2000（不带增益的 RMSNorm 只用于算系数；softmax 后先列归一再 19 轮；末层 HyperHead 为不加权平均，注释写明与 DeepSeek-V4 不同）、L2990–3026（新流 = post ⊗ y + combᵀ @ 旧流，确认第 g 行第 h 列 = 旧流 g 进新流 h）。
- 配置：db701c1f `transformers_utils/configs/glm5_next.py` L107–118（hc_mult → mhc_num_residual_streams 等映射）；另用 glm-flow/reference/official-config.json 核对 `kda_layers` 共 34 项且含 44、`mlp_layer_types` 存在、`first_k_dense_replace=3`、`hc_eps=1e-6`。
- 版本：2c59ff10、2ed6cbba 的 `vllm_ascend/models/` 无 glm 文件，但都注册了 `npu_hc_pre_v2`、`npu_hc_post`（参数表与 db701c1f 相同）；baa023ad `models/glm5next/model.py` L419–514 把 hc_post 推迟并与下一段 hc_pre 融合、RMSNorm 挪进 hc_pre 函数、支持序列并行分片，Sinkhorn 仍每段 20 轮，末层 hc_contract 为 mean。

### 旧版信息清单勾选

清单全文在会话 scratchpad `p5/layers-and-hidden-facts.md`（旧版 = p4-checkpoint 14591fd，与改前工作区相同），26 条全部有去向，无删除：

| # | 旧版要点 | 新版去向 |
|---|---|---|
| F1 | 嵌入 → 逐层更新 → 隐藏表示 | 首屏第 1–2 段 |
| F2 | 45 层，编号 0–44 | GLM 双机首句 |
| F3 | 先注意力后前馈，类型按配置与层号 | 首屏第 2 段；「45 层怎样排」；对照源码「怎么开」 |
| F4 | T 的含义 | 首屏第 2 段 |
| F5 | 每层自己的权重，同层跨位置/请求复用 | 「45 层怎样排」；误解末条；流程图「本层权重」 |
| F6 | 注意力引入上下文、前馈逐位置变换 | 首屏第 2 段；「45 层怎样排」 |
| F7 | 层号表 | 「45 层怎样排」表 |
| F8 | 34/11，3/42 | 「45 层怎样排」表后一段 |
| F9 | 链到 glm-5-3-flash 与 mlp-residual-norm | 改为分别链 KDA / 稀疏 MLA / MoE / 45 层怎样排 四节，前馈链 mlp-residual-norm「前馈网络」一节 |
| F10 | 嵌入逻辑形状 [T,4096] | R1 走读第 1 步 |
| F11 | 第 0 层入口展开四路、相同初始化 | R1 走读第 2 步；特殊层；误解 |
| F12 | [T,4,4096]、存储可摊平、逻辑形状 | R1 走读第 2 步 |
| F13 | 子层前四路混合为一路、RMSNorm、子层、再混合 | 首屏四步；R1 走读第 3–4 步 |
| F14 | 末层求平均再最终 RMSNorm | R1 走读第 5–6 步；特殊层 |
| F15 | 子层宽度仍 4096；完整连接见单层图 | 误解首条；「45 层怎样排」链单层图 |
| F16 | Prefill T=4、Decode T=1，层数不变 | 「本轮 hidden…」段；按固定部署补充 MTP 下 decode 也是 T=4 |
| F17 | 三类数据表 | 「本轮 hidden…」表（补了各自存放位置与生命周期） |
| F18 | decode 不只凭一个位置；KDA/MLA 历史不同；链 one-request、concurrent-requests | 同段；链接改为 one-request 第二圈、kv-cache、concurrent-requests；误解两条 |
| F19 | 末层连续向量 → 输出投影 → 策略选 token；输出头与 compute_logits | R1 走读第 6 步（prefill 只取最后位置）；源码位置 |
| F20 | 层 / 投影 / 选择的分工，引擎决定下一轮，链 vllm-v1-shape | 「本轮 hidden…」末段 |
| F21 | 范围：固定配置与 Ascend 源码、不含 MTP、无实测、逻辑形状 | 源码位置「数值出处」；开销与报错两节写明未实测；MTP 改为在特殊层一节说明不走 mHC；新版补了 TP 下每卡形状，不再说「未展开并行分片」 |
| F22 | aliases | 全部保留，新增 hidden、四条残差流、多路残差、mHC、Hyper-Connections、Sinkhorn、双随机矩阵等 |
| F23 | relations embedding | 保留，另加两条 |
| F24 | chapters 03、order 50 | 不变 |
| F25 | 旧 sources | 配置换钉点 690b7052（基线页已核两 revision 一致）；glm5_next 行号区间按新引用细分，全部仍在 |
| F26 | 旧图 layers-stack | 改画成流程图，原有节点（嵌入、第 0 层展开、各层权重、第 44 层、求平均、最终 RMSNorm → 词表投影）全部保留 |

### 验证

- `pnpm wiki:lint`：通过，本页无报错、无提示。
- `pnpm wiki:diagrams --check`：170 张图与 spec 一致；本页两张图无文字/代码名提示。
- `pnpm wiki:audit`：通过；本页 22 条来源行号全部有效（2 条 URL 未由脚本联网）。本页不在 standard-pages 名单里，另用同一套 `auditStandard` 临时把本页列入名单跑了一遍：全部达标。
- `pnpm check:content`：通过。
- 未起服务、未截图，浏览器验收留给审查环节。

### 疑点（只报告，未改）

- 02 §1.1 层表最后一行写「A4-6 最终 norm → 折叠四路残差 → lm_head」，顺序与源码相反：db701c1f `glm5_next.py` L2237–2239 在第 44 层 forward 内先求平均，L2318 再做 `self.norm`；02 §7.1 与 §9.1 的顺序是对的。
- mHC 目前在三处还有展开讲解：glm-5-3-flash「一层有两段计算…」（L75–95）、one-request「词嵌入与四路残差」（L228–237 的机制部分）、mlp-residual-norm「这些部件如何进入 GLM 的四路连接」。本页已成单一出处，那三处后续应只留结论并链到本页（R1 的 128 KiB 等主线数仍归 one-request）。
- wiki/TERMS.md 第 48 行把 mHC 的归属页写成 mlp-residual-norm，应改为 layers-and-hidden。
- 本页 summary 已改，wiki/index.md 与 src/content/wiki/registry.json 需要跑一次 `pnpm wiki:build` 重新生成（按范围未动）。

## P5 审查（09-28）

独立审查，只审不改页面，未改底稿。

### 结论

- **分数 8.5 / 10。** 本页自身无 P1；P2 两条都在页外（一个断锚、单一出处没收口）；P3 五条。
- **初学者测试（只读前两屏）：** hidden 是模型给每个位置维护的一条向量，每层读它、改它、交给下一层；GLM 在层间同时传四条，每段子层先按权重从四条里合出一条去算，再按权重写回，旧的四条用一个经 Sinkhorn 约束成「每行、每列和为 1」的 4×4 矩阵互相混合，所以连乘 90 次也不会爆炸或消失；代价是每段多一次 16384×24 的小矩阵乘和 20 轮 Sinkhorn、残差字节变四倍、每卡多 135 MiB 参数，不产生通信。能说清，通过。

### 核心概念（逐条）

源码均指 vllm-ascend@db701c1f；`ops/mhc.py` 与 transformers patch 用 `git show db701c1f:<路径>` 取出核对。

| 要点 | 页面位置 | 判定 | 依据 |
|---|---|---|---|
| 为什么 4 条 | L94 | 对 | `transformers_utils/configs/glm5_next.py` L71 缺省 `mhc_num_residual_streams=4`，L115 把 HF 键 `hc_mult` 映射过来；02 L27 官方 config `hc_mult=4`；论文实验取 n = 4（已联网核对 arXiv 2512.24880 HTML 版）。「官方没说为什么选 4」的表述恰当 |
| 分出与写回 | L61–68、L138–140 | 对 | `models/glm5_next.py` L2217–2224：hc_pre → input_layernorm → attention → hc_post；L2227–2235：hc_pre → post_attention_layernorm → mlp → hc_post；L2213–2215 第 0 层复制；L148–153 复制后摊平成 [T, n·d] |
| 入口/写回权重范围 | L86 | 对 | `ops/mhc.py` L19 pre = σ + eps，L24 post = 2σ；与论文 H_pre = σ、H_post = 2σ 一致 |
| 4×4 矩阵的行列含义 | L68、L80–81、图 spec L32–33 | 对 | patch L3014–3016、L3023–3025：新流 = post ⊗ y + combᵀ @ 旧流，所以第 g 行第 h 列 = 旧流 g 流进新流 h；列和为 1 ⇒ 新流是旧流的凸组合 |
| Sinkhorn 的作用与近似 | L76–84 | 对 | `ops/mhc.py` L31–35：softmax(-1) + eps 后做 20 次「先行后列」；patch L1984–1988：softmax 后先按列、再 19 次行列交替。两份都以按列归一收尾，所以「列和精确为 1、行和接近 1」成立；乘法封闭、单位阵是特例都对；论文 t_max = 20、恒等映射失效导致不稳，页面转述无误 |
| 每层 2 次、共 1,800 轮 | L72、L100–101、L126 | 对 | L2134 `hc_sinkhorn_iters` 缺省 20，L2157 每次 hc_pre 都传入；每层两次 hc_pre（L2217、L2227）；45 × 2 × 20 = 1,800；与 02 L193–194 一致 |
| 代价 | L72、L96、L102–105 | 对 | L2139–2145：每套 fn 为 [24, 16384] FP32，共两套 = 3,145,728 B = 3.0 MiB/层，× 45 = 135 MiB；是 `nn.Parameter`，不按 TP 切；残差 4 × 4096 × 2 B = 32,768 B；均与 02 L126、L191–192 一致；mHC 不产生通信，与 02 §1.2 通信清单一致 |
| 末层不加权平均 | L140、L166、L176 | 对 | L2237–2239 `.mean(dim=1)`；patch L1997 注释写明与 DeepSeek-V4 不同 |
| MTP 层不走 mHC | L167 | 对 | L2132 建参数条件含 `not self.is_mtp_layer`；L2195 走单条残差分支 |

补充：config 里的 `mhc_tau = 0.05`、`mhc_no_norm_weight` 在 glm5_next.py 中没有被引用；`hc_post_mult_value` 存了但没传给融合算子（2 倍写在算子内）。页面没写这几项，不算缺失。

### 底稿 02 §1.1 的顺序（写手疑点：核实属实）

- 底稿：docs/mainline/02-forward.md **L92**「A4-6 最终 norm → 折叠四路残差 → lm_head」，前两步顺序反了。
- 源码（`vllm_ascend/models/glm5_next.py`@db701c1f）：**L2237–2239** 在第 44 层 decoder 的 forward 末尾 `view(T, 4, -1).mean(dim=1)` 折回一条；**L2312–2313** 逐层循环结束后，**L2318** 才做 `self.norm(hidden_states)`；logits 在 L2515–2517 的 `compute_logits`。
- 正确顺序：第 44 层 MLP 段 hc_post → 四路求平均折回 [T, 4096] → 最终 RMSNorm → lm_head。
- 同一文件的 L171、L780、L784–785、L960 顺序都对，只需改 L92 一处。底稿未动。

### 单一出处（grep 计数，只报数）

| 页 | 行 | 篇幅 | 判断 |
|---|---|---|---|
| glm-5-3-flash | L75–95 整节 H2：L77 讲普通一层；L79、81、83、85、87、93、95 七段讲 HC 动机、双随机、20 轮 Sinkhorn、24 个系数、0–1 / 0–2 范围、末层平均、代价 | 共 1,364 字，其中 mHC 机制 1,074 字 | **收成一句话 + 链接**：保留 L77 和单层图，加一句「层间传四条流，每段前后各一次 mHC，原理与代价见 layers-and-hidden」，删去 L79–95 的机制和数字。另外 L87 把 20 轮 Sinkhorn 写进「出口混合」，源码是在入口 hc_pre 里算（L2151–2159 传入迭代次数，hc_post L2163–2169 只用 comb），和本页 L96 矛盾，这正是重复讲解带来的漂移 |
| glm-5-3-flash | L5、L63、L147、L214、L251、L264、L274、L295、L310 | 每处一句或一格，38–374 字 | 保留（摘要、形状表、精度、参数量、MTP 一句） |
| glm-5-3-flash | L352、L353、L364、L383、L395 | — | 对照源码区，保留 |
| one-request | L228 | 312 字：mHC 定义 + Sinkhorn 讲解 | **收成一句话 + 链接本页** |
| one-request | L230–235 代码块 | R1 形状与 128 KiB | 保留（R1 专属数字归主线） |
| one-request | L237 | 325 字：重算 90 次、1,800 轮、1.5 MiB × 2、135 MiB，「原理见」链到 mlp-residual-norm | **收成一句话 + 链接**：去掉推导数字，改为「每层两次，不产生通信，原理与代价见 layers-and-hidden」，链接改指本页 |
| one-request | L358、L399、L607 | 131 / 117 / 98 字 | 保留（主线站点叙述、MTP 一句、源码表） |
| TERMS | L31、L48 | 91 / 110 字 | 一句话可保留，但两行的归属页列都写 mlp-residual-norm：L48 应改成 layers-and-hidden，L31「多路连接的扩展见同页」应改指本页 |
| mlp-residual-norm（写作记录列了，派单没提） | L100；L102 | 169 字；L102 把 GLM 实际连接的权威指向 glm-5-3-flash 单层图 | L100 一句概括可保留，L102 加本页链接 |

### 有没有丢信息

- `git diff -- wiki/concepts/layers-and-hidden.md`：183 增 / 37 删，旧版 5 个 H2 整体重写；删掉的非来源行已逐行看过。
- 从写作记录 F 清单抽查 6 条：F5（每层有自己的权重，跨位置、跨请求复用）→ L124、L180 ✓；F11（第 0 层复制、四条初值相同）→ L137、L165、L175 ✓；F12（[T,4,4096] 是逻辑形状，存储可摊平）→ L137 ✓；F14（末层先平均再最终 RMSNorm）→ L140–141 ✓；F19（输出头是词表 × hidden、compute_logits）→ L141、L217 ✓；F21（无设备实测、逻辑形状）→ L192、L199、L137 ✓。6 条全在。

### 链接与锚点

- 本页站内出链 22 条，按 src/content/wiki/anchors.ts 的 `headingSlug` 规则校验：0 失败。
- 全库指向本页的链接 7 条，来自 6 页：**1 条失败**，concepts/kv-cache.md L123 `layers-and-hidden.md#隐藏维度与残差流分别表示什么`，这是旧版 H2，重写后已不存在。
- relations、TERMS L18–19 等按 id 的引用都能解析。
- `pnpm wiki:diagrams --check`：171 张图与 spec 一致，本页两张图无提示。

### 形式项

- 对照源码五个 H3 齐全、顺序正确（L184 / 190 / 195 / 201 / 215）；版本差异里 v0.23、v0.26、main 都出现（L203–213）。
- 本页不在写作标准名单里，audit 不跑这几项，所以手工核：对照源码之上正文 7,175 字（不计空白），角标 0，行内代码 0；calc 1 个（L98–106，在第 2 个 H2 内）；表格 L88–92 与 calc 之间隔着 L94、L96 两段，不相邻。
- `pnpm wiki:audit`：exit 0，最后一行 ok 通过；本页 22 条来源行号有效，2 条 URL 未联网验证（全库通例）。`pnpm wiki:lint`：exit 0 通过，没有本页条目。

### 问题清单

**P1：无。**

**P2**

1. **页外断锚（本次重写造成）。** 位置：concepts/kv-cache.md L123。问题：指向已删除的旧 H2。改法：改成 `layers-and-hidden.md#本轮-hidden历史状态和权重各管什么`（那句讲的是「只活在一次前向」，对应本页 L147 这一节）。
2. **单一出处没收口。** 位置：glm-5-3-flash L79–95、one-request L228 / L237、TERMS L31 / L48、mlp-residual-norm L102。问题：三页还在重讲机制，one-request 重算了 90 / 1,800 / 135 MiB，glm-5-3-flash L87 的 Sinkhorn 位置已经和本页矛盾，TERMS 的归属页仍是 mlp-residual-norm。改法：按上表收成一句话加链接；TERMS 两行的归属页改成 layers-and-hidden。

**P3**

1. **系数的缩放和偏置没进教学正文。** 位置：L68、L96、calc L102。问题：乘出 24 个数以后还要乘 3 个缩放、加 24 个偏置（`ops/mhc.py` L17–30；02 L192 写了「外加两组 base(24) / scale(3)」），calc 只算了 fn。改法：L96 补半句「再乘缩放、加偏置」，calc 注里加「另有 24 个偏置、3 个缩放，量可忽略」。
2. **术语先用后讲。** L141 第一次出现 prefill 没有解释；L157「开了 MTP 草拟」比 L167 的解释早。改法：L141 括注 prefill 是一次处理整段提示词的那一轮；L157 括注一句 MTP，或者把 L167 的解释提前。
3. **代价只写了推理侧。** 写作记录 L28 记了论文「n = 4 时训练时间多约 6.7%」，页面没写。可选：在 L96 补一句，并注明是论文的训练口径。
4. **index 和 registry 过期。** wiki/index.md 与 src/content/wiki/registry.json 仍是旧 summary（grep 旧句各命中 1 次，新句 0 次）。改法：跑 `pnpm wiki:build`。
5. **未做浏览器验收。** 写手把它留给审查，本次审查也没有起服务。新画和改画的两张图只过了 spec 一致性检查，渲染效果还没验证。

### 跳过的段

- frontmatter 的 sources（L9–31）按规定跳过；「对照源码」正文（L182 起）只 grep 没读；两个图块只看了 spec 的文字标签。没有读取被拦。

## 修订记录（2026-09-28，审查意见收口）

本页正文未改；以下是本审查指向页外的几项处理结果。

- **底稿 02 §1.1 顺序：** docs/mainline/02-forward.md L92 改为「A4-6 折叠四路残差（第 44 层末尾四路求平均）→ 最终 norm → lm_head」，依据源码 L2237–2239 → L2318 → L2515–2517；底稿 §12.6 已记。全库 grep「最终 norm / 最终 RMSNorm / 求平均 / 折回」：glm-5-3-flash、one-request、layers-and-hidden 正文与 glm-flash-overview、layers-stack 两张图都是先平均后 norm，没有沿用错误顺序的页。
- **P2-1 断锚：** concepts/kv-cache.md L123 改指 `#本轮-hidden历史状态和权重各管什么`。全库指向本页的锚点按 `headingSlug` 重验，0 失败。
- **P2-2 单一出处：** glm-5-3-flash 原 L79–95 的 mHC 机制与代价收成一段两句加链接（本页第 2 个 H2）；one-request 原 L228、L237 各收成一句加链接（本页第 1、第 2 个 H2），R1 形状代码块保留。删掉的每条信息都已在本页找到（HC 动机 L74、按 token 算系数 L68、Sinkhorn L78–84、24 个系数 L94、代价 L96 与 calc、范围 L86、首尾层 L137–141 / L163–167），本页无需补写。TERMS L48 的对应页面改为 layers-and-hidden，L31 的「多路连接见同页」改指 layers-and-hidden。mlp-residual-norm L102 不在本轮派单范围，未改。
- **验证：** `pnpm wiki:audit` 写作标准名单 22 页全部达标（glm-5-3-flash、one-request 各项 ✓）；`wiki:lint` / `wiki:audit` 的失败只来自 concepts/ascend-patch-system.md（relations 枚举）及三页对它的引用、diagrams/patch-binding.yaml 缺 svg，与本轮改动无关。
