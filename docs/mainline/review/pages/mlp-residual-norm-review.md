# mlp-residual-norm 审查记录

## P5 写作记录（2026-09-28，第 05 批，深改）

写手：Opus 写手。改前版本即 p4-checkpoint（14591fd），工作区此前未改动。

### 改了什么

- **结构**按深入页六步重排：第一屏「一个子层怎样更新 hidden，又不丢掉原来的输入？」+ 一句话定义 + 直觉图；第二屏「为什么要这条旁路和归一化，代价在哪？」（残差、RMSNorm、pre-norm 三个 H3）；机制节「前馈网络怎样变换一个位置的特征」（两投影、SwiGLU、限幅、中间宽度）；GLM 节按 R1 走读（子层入口、前 3 层稠密 MLP、后 42 层 MoE）；特殊层一节；常见误解；对照源码五个 H3。
- **图**：`mlp-residual-layer.yaml` 重画为直觉图（单条 residual 旁路 + RMSNorm + gate/up → SiLU ⊙ → down 支路 + 相加，只标 H、F，不画 GLM 形状）；新增 `mlp-residual-norm-flow.yaml` 代码流程图（第 4 站一层的走法：主干 mHC 左栏 / MTP 单条 residual 右栏两条分支，底部展开稠密 MLP 的 TP8 每卡走法）；`gated-ffn.yaml` 未改（限幅画法与源码一致）。
- **新增内容**：残差为什么让深网络可训（退化问题、恒等梯度项）与推理时为何删不掉；post-norm 与 pre-norm 对照及「pre-norm 必须补最终归一化」；RMSNorm 与 LayerNorm 同一例子对照（calc）；限幅只限 gate 上界的原因与中间值上界约 100（由 SiLU 值域推出，[D]）；中间宽度 F 的来历（4H、SwiGLU 论文 2/3 缩宽、GLM 取 3H、专家取 H/2）；两种 RMSNorm（mHC 入口无 γ 的 16384 维 vs 子层前 4096 维）；90 + 1 个子层前/最终 RMSNorm；MTP 层走单条 residual 且 MLP 为 MoE；稀疏 MLA 内部两次 RMSNorm；main 的激活检查报错、序列并行与选型差异；三版版本差异表。
- **单一出处**：TP 先列后行、每卡 3072/1536、32,768 B 只写结论并链到 tensor-parallel 与 one-request；bias=False、W8A8 转置链到 matmul-and-weights；mHC 混合、Sinkhorn 与代价链到 layers-and-hidden；路由与 EP 分卡链到 moe、expert-parallel。
- **frontmatter**：配置来源从 eb9eb208 改钉 690b7052（写作标准要求，两版配置一致见 sources/glm-5-3-flash-baseline）；sources 从 8 条扩到 21 条；relations 增 one-request、tensor-parallel、expert-parallel（moe 已有指向本页的 builds-on，按 lint 不重复写反向边）；aliases 保留旧 12 个并补充。
- 保留两个入站锚点标题：「前馈网络怎样变换一个位置的特征」「残差连接保留一条输入路径」（layers-and-hidden 第 55、126 行链接到它们）。

### 数字取自哪里

- 底稿 02 §0.2（层数 45、H 4096、intermediate 12288、moe_intermediate 2048、288 选 8 + 1 共享、hc_mult 4）；§2.2 第 5–7 步（第 0 层复制、第 44 层求平均）；§2.3（四路残差每层两次小矩阵乘与 20 轮 Sinkhorn）；§3（第 0–2 层注意力为 KDA、限幅 10）；§3.3（每卡 3072 / 1536 列、R1 形状链、单次 All-Reduce 32,768 B）。
- `rms_norm_eps = 1e-05`、`swiglu_limit = 10.0`、`mlp_layer_types`（3 dense + 42 sparse）、`hidden_act = silu` 底稿未列，已对 glm-flow 母版 `official-config.json` 的 text_config 逐项核对（与 690b7052 一致性见 sources/glm-5-3-flash-baseline）。
- 本页自算且标 [D] 性质的只有：[3, 4] 的 RMSNorm/LayerNorm 手算、SiLU 值域推出的中间值上界约 100、45 × 2 = 90 个子层前 RMSNorm、12288 = 3 × 4096。

### 核心概念对照了什么

- **SwiGLU 结构与限幅**：vllm-ascend@db701c1f `models/glm5_next.py` 1403–1442（gate_up 合并列切、down 行切、均 bias=False、限幅激活）；`ops/activation.py` 46–56（gate 仅 max、up 双侧 clamp，然后 npu_swiglu）；vllm@0fc695fc `layers/activation.py` 154–184（上游同名数学 silu(clamp(gate)) × clamp(up)）；论文 arXiv 2002.05202（三投影、2/3 缩宽）。
- **pre-norm 与单条 residual**：db701c1f `glm5_next.py` 2189–2241 的 `not self.mhc or self.is_mtp_layer` 分支（residual 暂存 → RMSNorm → 子层 → 相加，两段）；最终 RMSNorm 在 2285–2318；论文 arXiv 1706.03762（post-norm 原写法）、2002.04745（pre-norm 梯度与 warm-up）、1512.03385（残差与退化问题）。
- **RMSNorm**：vllm@0fc695fc `layers/layernorm.py` 36–102（x → w·x/sqrt(E[x²]+eps)）；db701c1f `ops/layernorm.py` 28–82（无 residual 调 npu_rms_norm，有 residual 调 npu_add_rms_norm）；论文 arXiv 1910.07467。
- **按层选稠密/MoE**：db701c1f `glm5_next.py` 2105–2131（先读 mlp_layer_types，否则 first_k_dense_replace）；main baa023ad `models/glm5next/model.py` 324–350。
- **版本差异**：`git ls-tree` 确认 2c59ff10、2ed6cbba 的 `vllm_ascend/models/` 无 glm 文件；三版 utils.py 注册键均为 SiluAndMulClamp、RMSNorm。

### 旧版信息清单勾选（清单原件：scratchpad/p5/mlp-residual-norm-facts.md）

| # | 旧版结论 | 去向 |
|---|---|---|
| F1 | MLP 接收 hidden、投影 + 非线性、回到隐藏宽度 | 保留：第一屏定义与「前馈网络…」一节 |
| F2 | 各位置用同一网络；输入含注意力上下文 | 保留：第一屏末段 |
| F3 | Y=φ(XW₁)W₂；无非线性可合并 | 保留：「普通两投影 MLP」 |
| F4 | 门控保留接口、加一条投影、逐元素乘 | 保留：「门控 MLP：SwiGLU」 |
| F5 | SwiGLU 改结构、需训练权重、非运行时开关 | 保留：SwiGLU 节末 + 常见误解 |
| F6 | g/u/z/Y 公式与形状 | 保留：SwiGLU 节公式块 |
| F7 | ⊙、SiLU 定义、门非离散开关 | 保留：SwiGLU 节 + 常见误解 |
| F8 | 限幅 10：gate ≤ 10、up ∈ [−10, 10]、先截断后 SwiGLU | 保留并展开：「限幅」H3 + gated-ffn 图 + 常见误解 |
| F9 | [T,H]/[T,F]，T 为本轮位置数 | 保留：限幅节后的形状段 |
| F10 | gate/up 合并一次调用，两组权重与拆分仍在 | 保留：形状段 + 常见误解 |
| F11 | 前 3 层 Dense，其余 42 层 MoE | 保留：GLM 节两个 H3 |
| F12 | 宽度表 | 保留：「后 42 层」H3 的表，补层号与个数 |
| F13 | Dense 宽、专家窄；路由见 moe；三片权重与运算量见 matmul | 保留：表后段落 + 「中间宽度 F」末段链接 |
| F14 | Y = X + F(Norm(X))；Pre-Norm | 保留：「残差连接保留一条输入路径」+ pre-norm H3 |
| F15 | 相加要求形状一致 → 回到隐藏宽度 | 保留：第一屏第 3 步 + 残差节「边界情况」 |
| F16 | 加法不限改变量；原输入不是永不变的表示 | 保留：残差节「边界情况」 |
| F17 | LN 减均值除标准差；RMSNorm 不中心化；不是把各维变相同 | 保留：RMSNorm H3 + 常见误解 |
| F18 | RMSNorm 公式与 ε | 保留：RMSNorm 公式块 |
| F19 | 保留宽度、不跨 token、γ 使各维不强制相同 | 保留：公式后段落 |
| F20 | [3,4] 例，输出约 [0.849, 1.131] | 保留：改为 calc，并加 LayerNorm 对照 |
| F21 | eps = 0.00001；每层注意力与前馈各一个 RMSNorm | 保留：GLM「子层入口」H3，并补 90 + 1 计数 |
| F22 | 内核可融合/转精度/换算子，不推断内核数 | 保留：常见误解末条 + 开销节 |
| F23 | mHC：四路先混合 → 4096 → RMSNorm → 子层 → 按系数写回 | 保留结论，细节挪到 [layers-and-hidden](../../../../wiki/concepts/layers-and-hidden.md)（任务要求 mHC 归该页） |
| F24 | 单路图只解释基本关系，GLM 实际连接看单层图 | 保留：流程图说明「右栏即首图、左栏换成四条流」；链接目标由 glm-5-3-flash 单层图改为 layers-and-hidden（mHC 唯一出处） |
| F25 | 三部件各回答一个问题 | 保留：第一屏三步与第二屏分工（措辞重写） |
| F26 | 待核：配置 + Ascend 快照；上游 RMSNorm 仅通用接口；未核镜像安装组合；无内核耗时 | 保留：源码位置「待核」第 3 条；上游 RMSNorm 现同时引 Ascend 实现 |
| F27 | 五处链接 | 全部保留（glm-5-3-flash 改链到 MTP 一节） |
| F28 | relations 与 12 个 aliases | 保留，另有新增；无删除 |

无删除项。

### 疑点（只报告，未改底稿）

1. **底稿 02 §3.1 的限幅说法不精确**：写作「做 silu(gate)*up 并夹到 ±10」。源码是在 SiLU 之前截断两路输入，且 gate 只限上界（`ops/activation.py` 51–52 行；上游 `layers/activation.py` 181–183 行）。本页按源码写。
2. **限幅激活的 Ascend 替换可能没有生效**：`utils.py` 738 行以键 `SiluAndMulClamp` 注册，vLLM `custom_op.py` 111–122 行按类名 `SiluAndMulWithClamp` 查替换表，二者不同，v0.23 / v0.26 / main 相同。静态推断 GLM 实例化上游类、在 NPU 上走 forward_native（PyTorch 写法），不调用 npu_swiglu；数学一致，只影响算子与性能。缺运行日志确认，已写入页末待核。

### 验证

- `pnpm wiki:lint`：通过（本页 0 处；首轮报的 dup-alias「残差流」与 moe 反向 relation 已改）。
- `pnpm check:content`：通过。
- `pnpm wiki:diagrams --check`：175 张图与 spec 一致；本页两张新/改图无待留意项。
- `pnpm wiki:audit`：通过；本页 21 条来源，行号全部有效。本页不在写作标准名单内，另用同一套 auditStandard 单测本页：行内代码 0.2/千字、对照源码之上角标 0、calc 0.23/千字、相邻块 0、图先行、免责 0.0%、图宽均达标。
- 锚点：按 `src/content/wiki/anchors.ts` 的 slug 规则逐条校验本页 16 个锚点、layers-and-hidden 指向本页的 2 个入站锚点，全部有效。
- 未截图、未起服务（浏览器验收由审查环节负责）。

### 字数

改前约 1,541 字；改后全文约 6,363 字，其中对照源码之上的教学正文约 4,839 字（口径：中文字 + 英文词/数字串，均不含 frontmatter）。

## P5 审查（09-28）

独立审查（Opus 5.5），只审不改页面、不改底稿。读法：全程串行，未启动子代理；源码按行号小段读取（例外见文末）。

### 结论

- **分数：8.5 / 10**。P1 共 0 条，P2 共 1 条，P3 共 7 条。
- 核心概念（残差、RMSNorm、pre-norm、SwiGLU、MTP 走单条 residual）全部判对；数字与底稿、配置一致。
- 写手报的两个疑点都属实。其中融合算子一条的结论是：静态读码可以确定**没用上**，页面在待核里如实写了。
- `pnpm wiki:audit`、`pnpm wiki:lint` 通过；本页不在写作标准名单里，用同一套 `checkStandard` 单测，结果 0 个问题。

### 1. 初学者测试（只读前两屏，第 44–76 行）

> 每个子层都由两路组成：一条旁路把输入 x 原样送到出口，另一条支路先做 RMSNorm、再做 MLP 或注意力，算出改变量，最后两路相加。旁路让深网络训得动，归一化让输入尺度保持稳定。推理时的代价只是每个子层多一次加法、多暂存一份 x，再加一次平方和归约，但这两样都删不掉。

通过：前两屏已经能说清它是什么、为什么需要、代价在哪。

### 2. 核心概念逐条核对

| 论断 | 页面位置 | 依据 | 判定 |
|---|---|---|---|
| 不加旁路时，深网络连训练误差都会变高；改成学残差 F(x) = 目标 − x，恒等旁路不带参数 | L68–L76 | ResNet 摘要（1512.03385）：更深的网络更难训练；各层改为学相对输入的残差函数；实验做到 152 层 | 对。梯度写成「单位矩阵 + F 的导数」是数学推导，页面没有说这是 ResNet 原文的结论，不算错 |
| RMSNorm 不减均值，只按均方根缩放，效果与 LayerNorm 相当、运行更快 | L80–L104 | RMSNorm 摘要（1910.07467）：去掉 re-centering、只保留 re-scaling，效果相当，运行时间减少 7%–64% | 对。ε 放在根号内，与 vLLM 的 RMSNorm 定义（C11）一致；calc 里 0.849、1.131 算对，结果的均方根为 1 |
| post-norm 是 Norm(x + F(x))；它在输出层附近梯度偏大，需要 warm-up；pre-norm 可以去掉 warm-up，最后还要补一次归一化 | L106–L118 | Attention 原文 3.1 节：LayerNorm(x + Sublayer(x))；Pre-LN 摘要（2002.04745）：Post-LN 初始化时输出层附近的期望梯度大，需要 warm-up，Pre-LN 可以去掉 | 对 |
| pre-norm 在 GLM 里的位置 | L56、L171–L175 | vllm-ascend@db701c1f `glm5_next.py` L2217–L2218：`hc_pre` 之后才做 `input_layernorm`；L2233：`post_attention_layernorm`，不带 residual 参数 | 对 |
| SwiGLU 结构：三个投影、SiLU 门控、没有偏置；为保持等参数把 F 缩到 2/3 | L130–L141、L157 | GLU variants（2002.05202）：(Swish₁(xW) ⊗ xV)W₂，不带偏置，β = 1；d_ff 从 3072 缩到 2048；`glm5_next.py` L1416–L1436：合并列切投影和行切投影都是 `bias=False`；L1438–L1442：forward | 对 |
| MTP 层走单条 residual，它的 MLP 是 MoE | L201 | `glm5_next_mtp.py` L85–L91 传入 `is_mtp_layer=True`；`glm5_next.py` L2195–L2210 的 `not self.mhc or self.is_mtp_layer` 分支就是单条 pre-norm；L2107–L2109 在越界时取 `mlp_layer_types[-1]`；配置里 `mlp_layer_types` 共 45 项，3 个 dense、42 个 sparse | 对 |
| 第 0 层把一条复制成四条，第 44 层把四条求平均 | L199–L200 | `glm5_next.py` L148–L153 `expand`；L2237–L2239 `.mean(dim=1)` | 对 |

数字核对：H = 4096、稠密 F = 12288、专家 F = 2048、288 个路由专家选 8 个加 1 个共享专家、45 层、34 层 KDA 与 11 层 MLA、q/kv 低秩维 1536/512，对照底稿 02 §0.2（L26–L34）一致；eps = 1e-05、swiglu_limit = 10.0，对照 official-config.json 的 L249、L253 一致；TP8 每卡 3072 列与 1536 列、[4,4096] 的路径、All-Reduce 载荷 32,768 B，对照底稿 02 §3.3（L226–L232）一致。SiLU 最小值约 −0.28、中间值的绝对值上限约 100，都是推导出来的数，推导本身正确。

### 3. 写手疑点核实

**3.1 底稿 02 §3.1 的限幅说法（属实，底稿未改）**

- 底稿原文：`docs/mainline/02-forward.md` **第 213 行**写的是「做 `silu(gate)*up` 并夹到 ±10」。
- 源码：vllm-ascend@db701c1f `vllm_ascend/ops/activation.py` **L51** 是 `gate = clamp(x[..., :d], max=limit)`，**L52** 是 `up = clamp(x[..., d:], min=-limit, max=limit)`，L54 再调 `npu_swiglu`（类定义在 L46–L56）。上游 vllm@0fc695fc `vllm/model_executor/layers/activation.py` 的 L179–L183（`forward_native`）写法相同，docstring 在 L158–L161。matmul 页写手说的「46–54 行」是类体范围，真正做截断的是 L51–L52，结论相同。
- 准确说法：**在 SiLU 之前截断两路输入。gate 只截上界（≤ 10，下界不截），up 截到 [−10, 10]；然后计算 SiLU(gate) ⊙ up，乘积本身不再截断，每个元素的绝对值约不超过 100。** 本页 L145–L147 和 L210 就是这样写的。

**3.2 融合算子有没有用上（结论：没用上，静态读码可以确定）**

- vLLM 怎样查替换表（vllm@0fc695fc `vllm/model_executor/custom_op.py`）：替换表是 L22 的 `op_registry_oot`。`CustomOp.register_oot`（L332–L337）登记时，给了 `name` 就用 `name` 作键，否则用类名；`CustomOp.__new__`（L109–L127）实例化时，在 L111 取 `op_name = cls.__name__`，L119–L122 拿这个类名去查表，查不到就实例化原类。releases/v0.26.0 的 L111、L119 也一样。
- GLM 实际实例化的类：`glm5_next.py` L24 导入的是上游的 `SiluAndMulWithClamp`，L1433–L1434 实例化它。稠密 MLP（L2126 传入 `config.swiglu_limit`）和共享专家（L1469–L1477，同一个 `AscendGlm5NextMLP`）都走这里。
- Ascend 注册的名字：`vllm_ascend/utils.py` L738 是 `"SiluAndMulClamp": AscendSiluAndMulWithClamp`，L819–L820 用 `CustomOp.register_oot(..., name=name)` 登记。releases-v0.23.0 的 L738、releases-v0.26.0rc 的 L709 用的也是同一个键。
- 推理链：查表用的是 "SiluAndMulWithClamp"，表里的键是 "SiluAndMulClamp"，查不到，所以实例化的是上游类。上游类没有 `forward_oot`（activation.py L154–L193 里只有 native、cuda、xpu 三个实现），NPU 属于树外平台，会走 `CustomOp.forward_oot` 的默认实现（L169–L172），也就是 `forward_native`：两次截断、一次 `F.silu`、一次相乘，不调用 `npu_swiglu`。算子是否启用不影响这个结果：未启用时走编译后的 `forward_native`，启用时走 `forward_oot`，最后还是 `forward_native`（`dispatch_forward` L191–L205）。另外，在 vllm_ascend 里 `git grep op_registry_oot` 没有命中，`vllm_ascend/compilation` 下也搜不到 silu 或 swiglu 相关的图融合 pass。
- 影响范围：前 3 层稠密 MLP，加上 42 层的共享专家。路由专家走 fused_moe 自己的 `swiglu_limit` 参数（`ops/fused_moe/fused_moe.py` L279、L769、L801），不受影响。连带后果：Ascend 版 L48–L49、L55 的 MLP down 权重预取钩子也不会触发。
- 还缺什么：运行时的 profiling 旁证。
- 页面有没有如实标注：**有**。L284 的待核条目写明了「静态读码推断……缺运行日志或 profiling 确认」，L249 的开销段也指向待核；对照源码之上的正文没有任何地方说走的是 `npu_swiglu`。

### 4. 有没有丢信息

- `git diff` 显示 229 行新增、48 行删除，删掉的行已逐条看过。旧版 5 个 H2（前馈网络怎样变换 / Dense FFN 与专家的宽度 / 残差连接 / RMSNorm / 这些部件如何进入 GLM 的四路连接）在新版里都有对应内容。
- 从旧清单（scratchpad/p5/mlp-residual-norm-facts.md）抽查 6 条：F8 限幅在 L143–L147；F12 宽度表在 L187–L191；F16「加法不限制改变量，原表示不会永远不变」在 L74；F20 的 [3,4] 例子在 L93–L104；F24「单路图只解释基本关系，GLM 实际连接另见」由 L169 和 L173 承接（原来指向 glm-5-3-flash 单层图，现在改为指向本页新流程图和 layers-and-hidden，意思保留）；F26 待核（镜像安装组合、没有内核耗时实测）在 L286，baseline 链接在 L279。F27 列的链接也都还在。**抽查的 6 条全部保留。**

### 5. 链接与锚点

- 出站：正文 16 个链接，目标标题逐个 grep，全部存在（tensor-parallel L109/L218、layers-and-hidden L49/L70/L128、matmul-and-weights L86/L111、glm-5-3-flash L233、one-request L109/L239、glm-5-3-flash-two-node L49）。
- 入站：layers-and-hidden L55 指向 `#残差连接保留一条输入路径`（本页 L66），L126 指向 `#前馈网络怎样变换一个位置的特征`（本页 L122），都有效；其余引用本页的地方（8 个页面，加上 index、TERMS）不带锚点。
- `pnpm wiki:lint` 通过，本页 0 条问题。

### 6. audit 与浏览器

- `pnpm wiki:audit` 退出码为 0。本页 21 条来源：15 条本地引用的行号全部有效，1 条 HF config URL 和 5 条论文 URL 未联网验证。
- 写作标准：本页不在 standard-pages.json 名单内，用 `checkStandard` 单测：正文 4379 字，行内代码 1 处（0.23 个/千字），对照源码之上角标 0 个，calc 1 个，免责句 0%，没有相邻的表格和 calc，problems 为空。
- 浏览器：在 5193 实页上以 1440 宽打开，三张图都按 1:1 显示（宽 880、900、880），正文没有横向溢出；用 Playwright 截取第 4 站流程图检查，内容与源码一致。

### 7. 问题清单

**P1：无。**

**P2**

1. **L197、L201「哪几层和一般走法不一样」漏了 MTP 块外的三次 RMSNorm。** 源码中，`glm5_next_mtp.py` L112 对 embedding 做 `enorm`，L115 对主干传来的 hidden 做 `hnorm`，L116 把两者拼接后过 `eh_proj`，到 L117 才进入 `mtp_block`；L123 的 `shared_head` 对应 vllm `deepseek_mtp.py` L51、L60 的 `SharedHead.norm`，做完这次 RMSNorm 才交给词表投影。页面 L197 用「特殊的只有……」收口，MTP 条目却只写了块内的两次，读者照本页数 RMSNorm 会漏掉 3 个；glm-5-3-flash 的 MTP 一节也没写 enorm、hnorm。影响：本页是 RMSNorm 的主页，边界情况不完整。改法：在 MTP 条目里补一句：「进块前，embedding 和主干 hidden 各做一次 RMSNorm，拼接后投影回 4096；出块后还有一次 RMSNorm，再交给词表投影。」源码位置补上 `glm5_next_mtp.py#L112-L123`。

**P3**

1. L173「按学到的系数混成一条」：mHC 的混合系数是由当前输入经 `hc_fn` 算出来的（`hc_pre` 接收 `hc_fn`、`hc_scale`、`hc_base` 三个参数，见 `glm5_next.py` L2147–L2160），不是固定常数。建议改成「按由当前输入算出的系数」，也能和 L175「为算系数做 RMSNorm」对上。
2. 术语先用后讲：L120 首次出现「TP」，比 L163 的部署行还早，而且没有解释；「KDA」出现在 L179 和流程图里，全页既没解释也没链接（TERMS 里有这一条，指向 linear-attention）。改法：L120 写成「张量并行（TP）」，L179 给 KDA 加上 linear-attention 的链接。
3. L185 先引入了 routed experts 和 shared expert，L190–L193 和表格却改用「路由专家」「共享专家」，与「有固定英文名的术语用英文原名」的规则不一致，建议统一用英文名。
4. L128 写的原始 Transformer FFN 公式省掉了偏置：原文是 FFN(x) = max(0, xW₁ + b₁)W₂ + b₂（Attention 原文 3.3 节）。本页又强调 GLM 的三个投影没有偏置，建议补一句「原文带偏置，GLM 去掉了」。
5. L249（对照源码·开销）先描述的是 Ascend 版（拼回两半，再调 `npu_swiglu`）。按 3.2 的核实，实际跑的是上游 `forward_native`：两次截断、一次 SiLU、一次相乘，共 4 个逐元素算子，没有融合。建议按实际路径写代价，再注明 Ascend 融合版因注册键不匹配没有生效。L284 的待核条目可以补上影响范围（稠密 MLP 和共享专家，路由专家不受影响），以及 down 权重预取钩子同样不触发。
6. frontmatter 里 C10 引的是 `custom_op.py#L84-L127`，其中前半段 L84–L101 是 `PluggableLayer.register_oot`，而 Ascend 实际调用的是 `CustomOp.register_oot`（L332–L337）。建议改成 `#L109-L127` 加上 `#L332-L337`。
7. 流程图 mlp-residual-norm-flow：分组标题「稠密 MLP 内部（第 0–2 层，TP8 每卡）」紧贴在上方「层外：最终 RMSNorm → 输出投影」框的下面，间距约 10px，看起来像那个框的说明文字。建议把分组下移，或者加大间距。

### 跳过与读法说明

- 跳过了 frontmatter 的 sources（L9–L30）。「对照源码」（L216–L290）没有通读，只 grep 了五个 H3 和版本号（顺序正确，v0.23、v0.26、main 都在）；为了核对融合算子的标注，单独打印了 L249、L279、L284、L286 这四行。
- 读源码有两次超过了 20 行的上限：`custom_op.py` L105–L127 读了 23 行；`glm5_next.py` 的 L1463–L1480 和 L1512–L1523 在一次调用里读了，共 30 行。其余每次都在 20 行以内。
- 没有读 HANDBOOK 和 docs/plans；TERMS 没有整份读，只 grep 了 KDA 一行。论文只取了摘要，GLU variants 另外取了 ar5iv 正文，确认了公式和 2/3 这个系数。

## P5 修订记录（09-28，按「P5 审查」改）

写手：Opus 5.5。只改本页与 mlp-residual-norm-flow 图，底稿另见 02-forward 修订记录。

- **P2 已改（L197、L204–L206）。** MTP 条目补上块外 3 次 RMSNorm：进块前词嵌入一路（enorm）、主干 hidden 一路（hnorm）各一次，拼成 8192 维后经 8192 → 4096 无偏置投影进块；出块后一次，再交给词表投影。L197 收口句改为「MTP 层（块外另有三次 RMSNorm）」。源码位置段（L275）补一句，新增来源 C23 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L104-L123`（L112 enorm、L115 hnorm、L116 eh_proj、L117 mtp_block、L123 shared_head；eh_proj 形状见 L53–L56）与 C24 `vllm@0fc695fc:vllm/model_executor/models/deepseek_mtp.py#L44-L60`（SharedHead：L51 norm，L60 forward 只做 norm；词表投影在 glm5_next_mtp.py L183 的 logits 计算里）。
- **P3-1（L176）**：「按学到的系数」改为「按由当前输入算出的系数」。
- **P3-2**：L123「TP」改为「张量并行（TP，…）」并加一句解释；L182 的 KDA 链到 linear-attention。
- **P3-3**：MoE 一节表格和正文、配置表 L230、源码位置 L273 统一用 routed experts / shared expert。
- **P3-4（L131）**：补「原文两个投影各带偏置 max(0, X·W₁ + b₁)·W₂ + b₂，GLM 去掉了」。
- **P3-5**：开销·限幅（L254）按实际路径改写：上游 forward_native 两次截断、一次 SiLU、一次相乘共 4 个逐元素算子，不调 npu_swiglu；Ascend 融合版因注册键不匹配没生效；图编译是否再合并无 profiling；routed experts 不受影响。L275 标明 Ascend 版未生效、实际跑上游写法。待核 L289 补影响范围（稠密 MLP + 42 层 shared expert）与 down 权重预取钩子不触发（依据 vllm-ascend@db701c1f ops/activation.py L48–L49、L55）。
- **P3-6**：C10 改为 `custom_op.py#L109-L127`，另加 C22 `custom_op.py#L332-L337`（register_oot 用给定 name 作键，L334）。
- **P3-7**：流程图底部分组下移 30px（frame y 870 → 900，画布高 1010 → 1040），与「层外：最终 RMSNorm → 输出投影」框拉开；右栏首框加副标题「块外：两路各 RMSNorm 再拼接投影」，新增「块外：RMSNorm → 词表投影」框，pins 加 glm5_next_mtp.py#L104-L123。

验证：`pnpm wiki:diagrams` 重生成本图（同时顺带重生成了 kv-cache-spec.svg，因为它的 yaml 已被他人改过、svg 过期；本次没改那份 yaml）；`--check` 只报 data-parallel.yaml 一处重叠，与本页无关。`pnpm wiki:lint` 本页 0 条；失败 3 处都在别页（kv-cache-spec 两处 pins 不在 sources、data-parallel-loop 缺 svg）。`pnpm wiki:audit` 本页来源 24 条，18 条本地引用全部 ✓，6 条 URL 未联网；失败 2 处同为 kv-cache-spec。未起服务、未截图。

## P5 修订记录（09-28，和 moe 页对齐 shared expert 的计算路径）

- **改了什么（只动两处加一条来源）。** 「开销和什么时候别开」的「限幅」一条、页末待核第一条，原把稠密 MLP 和 shared expert 归成同一种 PyTorch 写法。现在稠密 MLP 的结论保留不动（注册键与类名对不上，退回上游 4 个逐元素算子）；shared expert 单独说明：W8A8 下走融合链，不调用模块 forward，并链接 [moe.md#共享专家走的是哪条计算路径](../../../../wiki/concepts/moe.md)。影响范围从「前 3 层稠密 MLP 和 42 层 shared expert」收窄为「只有前 3 层稠密 MLP」。
- **核对。** 任务里给的 `vllm_ascend/models/glm5_next.py` 在 `db701c1f` 上没有 `_forward_shared_experts`；实际位置是 `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py` L559。逐段读了 L559–L619：`has_quantized_shared` 且 `quant_type` 为 W8A8/W4A8 时，L576 `npu_dynamic_quant` → L580 `npu_quant_matmul`（直接取 `gate_up_proj.weight` 与 `weight_scale`）→ L596 `npu_dequant_swiglu_quant`（L591 `clamp_limit = swiglu_limit`，L607 传入）→ L612 `npu_quant_matmul`（直接取 `down_proj.weight`），全程不调 `self._shared_experts(...)`。与 moe 页一致。
- **来源。** frontmatter sources 末尾追加 `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L619`，按序号为 [C25]，待核第一条引用它。其他地方未动。
- **验证。** `pnpm wiki:lint` 通过，本页 0 条；`pnpm wiki:audit` 本页来源 25 条、无 ✗，全库唯一失败在 gap-a5164fe10fa9184412f8，与本页无关。未起服务、未截图。

## 基础讲清修订（09-29）

起点：基础页排查结论「基本讲清，小修」——SwiGLU 只有公式、缺门控数值演算；限幅一节只说范围不演数。按「小修为主、不整页重写」处理，只动「前馈网络怎样变换一个位置的特征」下两个 H3，外加常见误解一句。

**逐节改动**
- 一个子层怎样更新 hidden / 为什么要这条旁路和归一化：未改。自查学习顺序：MLP、residual、RMSNorm 三者都是第一节先讲是什么，第二节讲为什么（RMSNorm 小节内部是「是什么 → 为什么（尺度漂移）→ 公式 → [3, 4] 对照 calc」），第三节讲 MLP 怎么算，顺序成立；RMSNorm 与 LayerNorm 的 [3, 4] 对照保持原样。
- 门控 MLP：SwiGLU：
  - 节首新增粗体一句「门控是什么」：同一输入投影成两路，一路算内容、一路算每一维开多大，按元素相乘。
  - 新增一段「为什么要单独一路门」：普通 MLP 里「传不传」和「传什么」是同一个数（ReLU 为例），门控把两者分成两组权重；SwiGLU 论文（已在 sources，arXiv 2002.05202）在参数量、计算量对齐下报告门控写法效果更好，论文未给解释。
  - 原有接口说明、四行公式保留；公式后补 sigmoid 的定义（1 ÷ (1 + e⁻ᵍ)，压到 0 和 1 之间），SiLU 定义挪到这里。
  - 新增图 mlp-swiglu-calc + calc「一个 MLP 子层的手算」：接 RMSNorm 一节的 x = [3, 4]（H = 2，F = 4，权重为编的小整数）走完整个子层：n ≈ [0.85, 1.13] → g = [1.98, −4.24, 0.28, 1.13]（演示第 0 个数的点积）→ sigmoid [0.879, 0.014, 0.570, 0.756] → SiLU(g) = [1.74, −0.06, 0.16, 0.85] → u = [1.13, 1.98, −1.70, −1.41] → z = [1.97, −0.12, −0.27, −1.20] → Δ = [0.92, 0.81]（两个数都演点积）→ y = x + Δ = [3.92, 4.81]。数值用 node 按公式核过：每一步用上一行写出的数接着算；SiLU、z 两步挑了权重，使「用上一行写出的数算」与「用这一步的精确输入算再四舍五入」一致。从未舍入的 n = [0.8485, 1.1314] 一路精确算到底，Δ 是 [0.91, 0.82]，与页面差 0.01，来自逐步舍入（审查 P3-6 指出，09-29 更正本句）。
  - 新增一段逐列解读：内容最大的第 1 维被门关到 −0.12，第 0 维被放大，第 2 维压小，第 3 维略缩；点明「由输入自己决定中间每一维放大多少」；解释第 1 维符号翻转来自 SiLU 负半轴的小负值。
  - 原「SiLU 连续、不是开关」「SwiGLU 不是运行时开关」一段保留，改为用演算里的两个数印证。
- 限幅：原两段保留；在图 gated-ffn 前新增 calc「限幅示意」：gate = 13 截成 10、up = −12 截成 −10，SiLU(10) ≈ 10.00，中间值 −100（不截断是 −156）；gate = −15 不截断，SiLU(−15) ≈ −0.0000046，说明为什么 gate 不用限下界。
- 常见误解「门控就是开关」：补上例子里的四个门值。
- GLM 双机、特殊层、对照源码：未动（moe 两处已修好的锚点保持）。

**新增的演算和图**：calc 2 个（SwiGLU 整个子层手算、限幅示意）；图 1 张 wiki/diagrams/mlp-swiglu-calc.yaml（900×470，列对齐：g → SiLU → × 内容 → z → down → Δ → + 旁路 x → y，底部一行标出每列是放大 / 几乎关掉 / 压小 / 略缩；texts 8 段，未触发「超过 8 段」提醒）。未新增图元，渲染器未改。

**清单勾选**（scratchpad/mlp-residual-norm-basics-facts.md，34 条）：全部保留，无删除；挪动 1 条（SiLU 定义挪到公式后、演算前）；第 19、21、24 条原文保留并在前后补内容。

**验证**：`pnpm wiki:lint` 通过，本页 0 条；`pnpm wiki:diagrams --check` 226 张一致；`pnpm wiki:audit` 本页写作标准全 ✓（4666 → 5193 字，calc 0.21 → 0.58/千字，相邻块 0，图先行、图宽 ✓）。浏览器（Playwright 1440 宽，http://localhost:5193/#/wiki/mlp-residual-norm）：首屏与新图、两个 calc 均正常渲染，数字清楚、不重叠、不裁切；控制台只有问答后端 502（服务未起，与本页无关）。附带：跑 `pnpm wiki:diagrams` 时顺带按别的写手当时的 quantization.yaml 重生成了 quantization.svg（派生文件，未动其 yaml）。

## 基础讲清审查（09-29）

审查员独立完成，只审不改页面。依据：scratchpad 的 basics-standard.md（先读总原则）、basics-audit.md 第 6 节、本文件「基础讲清修订（09-29）」、写手清单 mlp-residual-norm-basics-facts.md、截图 shot-1/2。

**结论：9/10。P1 0 条，P2 0 条，P3 6 条。逐节初学者检验 3/3 通过。wiki:audit 本页通过。**

### 0. 学习顺序
三件东西都是「是什么 → 为什么 → 怎么算」：
- residual：第一节首图与三步讲是什么（第 50–62 行）；第二节讲为什么训得动、为什么推理删不掉（第 74–76 行）；怎么算落在 SwiGLU 手算末行 y = x + Δ = [3.92, 4.81]（第 173 行）。
- RMSNorm：第一节一句话定义（第 52 行）；第 84–86 行讲尺度漂移这个动机；第 90–106 行公式加 [3, 4] 对照演算。
- MLP：第一节定义（第 52 行）；「为什么」在第 124 行（位置内各维组合）和第 132 行（非线性不能省）；怎么算在第 142–173 行。
- 新增的门控小节自身也是「门控是什么（第 136 行）→ 为什么要单独一路门（第 138 行）→ 公式 → 手算」，顺序成立。

### 1. 逐节初学者检验（GLM 节之前 3 个 H2）
- 一个子层怎样更新 hidden：「输入留一份走旁路，另一份先 RMSNorm 再过 MLP 或注意力算出改变量，最后两份相加，所以支路必须回到原宽度。」通过。
- 为什么要这条旁路和归一化：「旁路让每层只学改变量，深网络才训得动，推理也删不掉；RMSNorm 按均方根统一缩放、比例不变，比 LayerNorm 少减均值；pre-norm 只归一化支路入口，所以最后一层后要补一次。」通过。
- 前馈网络怎样变换一个位置的特征：「MLP 升宽、过非线性、再降回；SwiGLU 让 gate 一路经 SiLU 变成每维的缩放系数去乘 up 那路内容，例子里第 1 维被关到 −0.12；限幅在 SiLU 之前把 gate 夹上界、up 夹两边。」通过。

### 2. 演算逐个手算（node 复算）
- g：n = [0.85, 1.13] 与 W_gate 四列点积得 1.98、−4.24、0.28、1.13，全对；u：1.13、1.98、−1.70、−1.41，全对。
- sigmoid：0.8787、0.0142、0.5695、0.7558，按三位写成 0.879、0.014、0.570、0.756，全对。SiLU = g × sigmoid(g)：1.740、−0.060、0.159、0.854，写成 1.74、−0.06、0.16、0.85，全对。
- z：1.9662、−0.1188、−0.2720、−1.1985，写成 1.97、−0.12、−0.27、−1.20，全对；Δ 按页面写出的 z 计算，1.97 − 0.12 + 0.27 − 1.20 = 0.92，−0.12 − 0.27 + 1.20 = 0.81，全对；y = [3.92, 4.81]，全对。
- 限幅：SiLU(10) = 9.99955，SiLU(13) × (−12) = −155.9996，SiLU(−15) = −0.0000046，SiLU 最小值约 −0.2785（在 x ≈ −1.28 处取到），全对。
- 图 mlp-swiglu-calc.yaml 里的 20 个数与 calc 逐一相同。
- 例外：写手记录第 205 行说逐步计算的结果与「用精确值算再四舍五入」一致，这不成立。从 n = [0.8485, 1.1314] 精确算，得到 Δ = [0.913, 0.817]，四舍五入是 [0.91, 0.82]。页面每一步都用上一步写出的数继续算，算式本身没有错，所以只记 P3（见 P3-6）。

### 3. 核心概念对照源码与论文
- 三个投影的顺序与作用：`AscendGlm5NextMLP`（vllm-ascend@db701c1f glm5_next.py 1403–1442 行）先由 `gate_up_proj` 做合并的列切投影，输出宽度是 2F、无偏置；再过 `act_fn`；最后 `down_proj` 做行切投影、无偏置。页面第 142–147 行和第 203 行一致。
- 前一半是 gate、后一半是 up：上游 `SiluAndMulWithClamp.forward_native`（vllm@0fc695fc activation.py 154–184 行）取 `x[..., :d]` 作 gate、只夹上界，取 `x[..., d:]` 作 up、夹两边，然后算 `silu(gate) * up`。Ascend 版（activation.py 46–56 行）同样先截断，再拼接后调用 `npu_swiglu`。页面「gate 只限上界、up 两边都限、夹的是输入不是输出」正确。
- GLM 里确实有限幅：稠密层在 glm5_next.py 约 2120–2126 行传入 `swiglu_limit=config.swiglu_limit`，只要不为空就会选带限幅的激活（1433–1434 行）；共享专家和 routed experts 在 1463、1477、1522 行传入同一个上限。限幅值 10 取自配置，和主线底稿 02-forward 第 220 行、glm-5-3-flash 审查记录（config L193）一致。本轮无法联网，没有重新打开 HF 上的 config.json。
- SwiGLU 论文（arXiv 2002.05202）确实在参数量和计算量对齐的条件下比较，把 F 缩到 2/3，并明说不解释为什么有效。页面第 138 行和第 207 行正确。

### 4. 有没有丢信息
- 从 34 条清单抽 7 条，都在页面里：第 8 条 ResNet 与单位矩阵梯度（第 74 行）、第 10 条边界（第 78 行）、第 15 条 pre-norm 表（第 116–122 行）、第 24 条 SiLU 最小值约 −0.28（第 184 行）、第 26 条 [T, 2F]（第 203 行）、第 30 条 32,768 B（第 231 行，复算 4 × 4096 × 2 B 正确）、第 32 条 enorm、hnorm 与 8192 → 4096（第 252 行）。常见误解数过，仍是 9 条。
- git diff 删掉的行：SiLU 那一段被拆开，拆出的两部分挪到公式后面和手算后面，内容都在；常见误解那一条只补了四个门值；「开销」和「待核」两行只把 moe 锚点从已经不存在的「共享专家走的是哪条计算路径」改成「共享专家按-tp8-切走融合算子」，其余文字没动。没有丢信息。

### 5. 标准第 11–14 条
- 第 11 条：SwiGLU 和限幅两处「怎么算」都补上了演算，满足。
- 第 12 条：基础节里没有部署数字（2×A2×8、TP8/DP2/EP16、W8A8、R1），满足。基础节里出现的 swiglu_limit = 10、F = 12288 / 2048 属于模型配置，不属于部署数字，可以接受。
- 第 13 条：通用内容都在 GLM 节之前；GLM 之后的「哪几层和一般走法不一样」是 GLM 专属的例外说明，可以接受。
- 第 14 条：第一节只有一个层与 hidden 的链接，没有堆链接，满足。

### 6. 图
- shot-1 是首图 mlp-residual-layer，没有改动，文字清楚。
- shot-2 是新图 mlp-swiglu-calc：数字都看得清，没有重叠，也没有被裁掉。每列从上往下依次是 g → SiLU(g) → ⊗ u → z，底下一行标着「放大 / 几乎关掉 / 压小 / 略缩」；右侧 down 投影得到 Δ，再和旁路上的 x 相加得到 y。不看正文也能看出这张图在算什么。
- 图里没有画 W_down 的数，这部分由 calc 补上，不扣分。
- 按通用说明，本轮不起服务，用的是写手截图。

### 7. 锚点
- 全库指向本页的带锚链接有 6 种、共 9 处：`#rmsnorm-怎样调整向量尺度`、`#前馈网络怎样变换一个位置的特征`、`#对照源码`、`#开销和什么时候别开`、`#残差连接保留一条输入路径`、`#门控-mlpswiglu`。它们都对得上本页现在的标题。
- 本页指向 moe 的三处链接：第 243 行不带锚点；第 301 行和第 336 行指向 `moe.md#共享专家按-tp8-切走融合算子`，对应 moe.md 第 255 行的标题「共享专家：按 TP8 切，走融合算子」，目标节讲的正是反量化、限幅 SwiGLU、再量化的融合链，内容对得上。
- `pnpm wiki:lint` 通过，本页 0 条提醒。

### 8. audit
`pnpm wiki:audit` 整体通过。本页 5193 字，写作标准各项都是 ✓（calc 0.58/千字，相邻块 0，图先行，图宽合格）。`pnpm wiki:diagrams --check` 结果是 226 张图全部一致。

### 9. 问题清单
P1：无。P2：无。

P3：
1. 第 182–184 行，限幅：讲了是什么、为什么 gate 只限上界、怎么算，但没讲「为什么要限」，只写了效果。建议补一句通用直觉：不截断时会出现 −156 这类远超常规的中间值。同时保留「配置没说明为什么取 10」，也不要替 GLM 编造动机。
2. 第 74、114 行：「梯度」「学习率预热」第一次出现时没有解释。初学者只懂矩阵乘法，建议各加半句括注。
3. 第 95 行：token 第一次出现时没有解释。建议补「token 就是一个输入位置」。
4. 第 124 行：「MLP 为什么值得占一半子层」这段挂在 pre-norm 小节下面，目录里看不到，读起来也像 pre-norm 的一部分。可以升成独立的 H3，或挪到第二节开头那句「下面分三件讲」的后面。
5. 第 301、336 行：链接文字还是旧标题「共享专家走的是哪条计算路径」，目标标题已改为「共享专家：按 TP8 切，走融合算子」。锚点能解析，内容也对得上，建议把链接文字改成新标题。
6. 本文件第 205 行，写手记录：说逐步计算与「按精确值算再四舍五入」结果一致，这不成立，精确值得到的 Δ 是 [0.91, 0.82]。页面本身不用改；建议把记录改成「每步用上一步写出的数」，或在 calc 标题注明「逐步按上一行的数计算」。

### 跳过与读法说明
- 按纪律，frontmatter 只 grep 单行；「对照源码」各节只 grep 标题，另外看了两行 moe 链接。
- 没有读 HANDBOOK 和 docs/plans。
- 没有起服务，也没有开浏览器，图只看了写手截图。
- 没有联网重新核对 HF 上的 config.json。
- 全程没有被拦截。

**审查 P3 处理（09-29）**：6 条全修。P3-1 限幅段补「为什么要限」（两路相乘会放大，例子里 −156；保留「配置没说明为何取 10」，没有替 GLM 编动机）；P3-2「梯度」「学习率预热」各加半句括注；P3-3 token 首次出现处补括注；P3-4「MLP 为什么值得占一半子层」升成第二节的独立 H3；P3-5 第 301 行链接文字改成新标题（第 336 行链接文字本来就是「MoE」，不用改）；P3-6 更正本文件第 205 行的舍入说法，calc 标题补「每步用上一行写出的数接着算」。lint、diagrams --check、audit 本页 0 报错（写作标准 5341 字，全 ✓，免责 0.0%）；浏览器里已确认新 H3、calc 标题、限幅句、链接文字都正常显示。
