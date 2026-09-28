# rope 审查记录

## P5 写作记录（2026-09-28，Opus 写手，第 08 批深改）

**改了什么**

- 按六步骨架重排：问题式 H2 + 一句话定义 + 直觉图 → 为什么需要、代价（含四行“位置”概念小表）→ 二维分量对与频率（1 个示意 calc）→ 点积只剩位置差 → 频率基数与 YaRN 等长上下文方法 → 推理引擎里旋转发生在哪一步 → GLM 双机（稀疏 MLA / 索引器 / KDA 三个 H3，1 个 calc）→ 常见误解 → 对照源码五个 H3。
- 直觉图 `rope.yaml` 重画：三个表盘（旋转前内容夹角 30° → k 在 3、q 在 5 → 都 +100），加旋转弧与夹角标注，说明点积只取决于角度差。新增代码流程图 `rope-glm.yaml`：位置编号怎样走到 KDA 与稀疏 MLA，三项构造条件与未走分支（淡色）。
- 新增内容：远程衰减、与线性注意力结合（论文 §3.3）、rope_theta、PI / NTK-aware / NTK-by-parts / YaRN、vLLM 最大长度推导与报错、Ascend 替换旋转模块、索引器池内偏置、KDA 丢弃位置编号、三版差异。
- 纠正旧版：旧版称专用实现“两处分支都要求旋转维大于 0”。实际主注意力要三项同时满足（维数大于 0、非 NoPE、有 RoPE 参数），索引器只看维数。
- 队列提示“稀疏 MLA 的 rope 只作用在 qk_rope_head_dim 部分”按源码核实：一般 MLA 如此，但本配置该部分为 0 维，什么也不转；已写进正文和误解。

**旧版信息清单**：27 条，逐条勾选见 scratchpad `p5/rope-facts.md`；全部保留或并入新版，无删除，1 处纠正（见上）。

**数字出处**

- RoPE 维数 0、qk_nope 256、潜向量 512、KDA 短卷积核 4、34 / 11 层：底稿 02 §0.2、§5.2。
- 主缓存宽度 512 + 0：底稿 02 §5.6（head_size 一行）。
- R1 位置编号 0–3：底稿 01 §A3；服务最大长度 133,120：底稿 01 §A2（教程）。
- max_position_embeddings 1,048,576、indexer_rope_interleave、mla_use_nope：模型配置（690b7052，与 glm-flow official-config.json 一致）。

**核心概念对照**

- RoFormer（arXiv 2104.09864v5）：§1 动机、式 15 频率与基数 10000、式 16 相对位置、§3.3 线性注意力、§3.4.2 逐元素实现、§3.4.3 远程衰减。
- YaRN（arXiv 2309.00071v2）：PI、NTK-aware、NTK-by-parts、温度 0.1·ln(s)+1、10 倍 token / 2.5 倍步数。
- vLLM@0fc695fc：rotary_embedding base.py / common.py / __init__.py，config/model.py 最大长度推导。
- vllm-ascend@db701c1f：glm5_next.py 1965–2000、2089–2103、1256–1269、1357–1383、880–887、236–251；kpool 压缩 200–202；indexer_kpool_mla(.py 70–71、_v1.py 641–646)；kimi_kda.py 244–251；model_runner_v1.py 863–868；utils.py 735–755。
- 版本：v0.23（2c59ff10 / 0fc695fc）、v0.26（2ed6cbba / 568afb3a）、main（baa023ad / 84030bbe）逐项核对 get_rope、Ascend 注册、GLM 专用实现。

**自查**：首图前 203 个非空白字符、0 个 calc；教学正文行内代码 0；对照源码之上角标 0，全页角标 19（C 占 74%）。wiki:lint、check:content、wiki:diagrams --check、wiki:audit 均通过；rope 两张图无提醒。未截图、未起服务。

**待核**：设备上 RoPE 算子耗时；main 以 0 维构造的索引器旋转模块是否在前向执行；池内偏置只核对 PyTorch 写法的路径。

**疑点（留给审查）**：底稿 02 §0.2 写“位置信息只由 KDA 的递归和短卷积携带”，与源码中索引器压池的池内偏置（4×128 可学习参数，加在门控分数上）及 glm-5-3-flash 页“三处”说法不完全一致，建议底稿改为三处。

## P5 审查（09-28）

审查员：Opus 5.5 独立审查员（只审不改页面）。**分数 9 / 10。**

### 1. 初学者测试（只读前两屏，`wiki/concepts/rope.md` L52–L88）

能说清。一句话：**RoPE 在算 q·k 之前，按每个 token 自己的位置编号把 q、k 的二维分量对各转一个角度，点积里两个角度相减，分数就只取决于两者相隔多远；代价是每层多一次逐元素乘加、一张 cos/sin 表，训练没见过的长位置会转出没见过的角度，而 MLA 还因此不能把 q 投影和 k 解压矩阵提前合并——GLM-5.3-Flash 干脆把这一段设成 0 维，一转也不转。**首屏是问题式 H2 + 加粗一句话定义 + 直觉图，无 calc、无角标，图说文字（L60、L62）把「夹角差 40°、两组都是 70°」讲到位，符合「先直觉后数字」。

### 2. 核心概念（逐条核对，均对）

- 频率与基数 ω_i = θ^(−2i/d_r)、θ=10000、逐元素等价写法、远程衰减是上界（L91–L98、L111、L70）：与 RoFormer 2104.09864v5 §3.4.2 / §3.4.3 一致。
- 点积只剩位置差 R(p)ᵀR(r)=R(r−p)、按分量对拆成 cos(内容夹角 + (p−r)ω_i)（L126–L132）：推导与符号自洽，和首图的 30°→70° 对得上。
- partial rotary 与两种配对（L113–L122）：`vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L63-L72` 证实 base 缺省 10000、可直接给 `rope_dim`、比例须在 0–1、`rotary_dim = head_size × 比例`；neox=前后半区、非 neox=相邻配对与表格一致。
- 最大长度推导与报错（L153）：`vllm@0fc695fc:vllm/config/model.py#L2183-L2197` 为 yarn 取 original 长度再乘 factor；`#L2235-L2247` 的提示正是「超出会算出 NaN」+ 需 `VLLM_ALLOW_LONG_MAX_MODEL_LEN`。
- 昇腾替换旋转模块（L171）：`vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L755` 注册表含 RotaryEmbedding / MRotaryEmbedding / YaRNScaling / DeepseekScaling；`ops/rotary_embedding.py#L216-L250` 的 `forward_oot` 调 `npu_rotary_embedding`。
- GLM 三项条件（L185）：`db701c1f:vllm_ascend/models/glm5_next.py#L1965`（`qk_rope_head_dim > 0 and not skip_rope and config.rope_parameters is not None`），`skip_rope` 由 `mla_nope` 传入（#L2103）；索引器只看维数（#L1986-L2000），`rope_dim = config.qk_rope_head_dim`（#L1256），前向 `if self.rope_dim > 0`（#L1357）。**页面没有把 GLM 的 MLA 写成在做 RoPE，结论方向正确。**
- NoPE 补零分支只在维数 > 0 时生效（L193）：`glm5_next.py#L236-L251` 的 `_pad_nope_kv_a_weight` 在 `rope_dim <= 0` 时原样返回。
- 池内偏置（L199）：`db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L200-L202`，`scores = pool_gate + ape`，`softmax(dim=1)` 在 4 个槽位上加权；`ape` 形状 `[index_kpool=4, index_head_dim=128]`（官方 config `index_kpool: 4`、`index_head_dim: 128`）。「是加法偏置、不是旋转、不表示池间距离」的措辞准确。
- KDA 丢弃位置（L203）：`db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L249` 的 forward 第一行就是 `del positions`，「收下就丢弃」字面成立。
- main 差异（版本差异表）：`baa023ad:vllm_ascend/models/glm5next/attention.py#L231-L266` 主注意力只看 `skip_rope`、`is_v32` 下索引器总会 `get_rope`；`attention/indexer_kpool.py#L312` 正是表里那条 NoPE-only 报错；`attention/mla_v1.py#L288-L294` 的 `nope_zero_rope_cache` 对应「为 NoPE 模型准备全零 RoPE 操作数」。
- 版本约定守住了：L254 明确 v0.23=`2c59ff10`、v0.26=`2ed6cbba`、main=`baa023ad`，并单独标注执行侧镜像 `db701c1f`。

### 3. 数字

- 34 层 KDA / 11 层稀疏 MLA / 短卷积核 4 / 每头 256 / 潜向量 512：底稿 `docs/mainline/02-forward.md` L28、L31、L36、L500 一致；`head_size = kv_lora_rank + qk_rope_head_dim` 见 `db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L71`，calc 的 512+0 与 256+0 正确。
- R1 位置编号 0,1,2,3 与 `max_model_len = 133120`：底稿 `01-deploy-entry-schedule.md` L703、L715、L639 一致。
- `max_position_embeddings: 1048576`、`qk_rope_head_dim: 0`、`qk_nope_head_dim: 256`、`mla_use_nope: true`、`indexer_rope_interleave: true`、无 `rope_theta` / 无缩放字段：官方 config（`glm-flow/reference/official-config.json` L181/L248/L247/L183/L28）逐项核对无误；`mla_use_nope → mla_nope` 的映射见 `db701c1f:.../configs/glm5_next.py#L102-L105`。
- calc「10000^(−2/8)=0.1、−4/8=0.01、−6/8=0.001、2π/0.001≈6283」算术正确。
- YaRN 温度 0.1·ln(s)+1、约 10 倍 token / 2.5 倍步数：与 2309.00071v2 相符（论文数字，未联网复核原文，按 audit 的 URL 规则不在本次强制范围）。

**写手自报疑点：站得住。** 「稀疏 MLA 的 rope 只作用在 qk_rope_head_dim 部分」确实是一般 MLA 的写法，本配置该段为 0，页面 L185 与误解条 L213 的处理是对的。底稿 `02-forward.md` L36 那句「位置信息只由 KDA 的递归和短卷积携带」偏窄，`glm-5-3-flash.md` L187 已经写成三处（KDA、池内偏置、因果范围），rope 页 L205 与之一致 —— 该改的是底稿，不是页面（见 P3-1）。

### 4. 有没有丢信息

`git diff p4-checkpoint -- wiki/concepts/rope.md`：+234 / −39，删除行逐条落位到新版（F1→L68、F2→L68+L82 小表、F3→L54、F4/F22→L175+L185+L197、F5–F8→L91–L98、F9→L111、F10→L126–L130、F11→重画的首图与 L60、F12/F13→L136–L137、F14/F15→L113、F16/F17→L115–L122、F18–F20→L161–L167、F21→L155、F23→L205、F24→L138+L216、F25→版本差异与待核、F26/F27→frontmatter）。**未发现丢信息**，旧版「两处分支都要求旋转维 > 0」的错误已按源码纠正。唯一的结构性副作用是旧 H2「RoPE 的位置与缓存地址不同」被改名（见 P2-1）。

### 5. 链接与锚点

本页 21 条相对链接全部存在，其中 10 条带锚点全部可解析（脚本 `scratchpad/p5/checklinks2.ts`）。全库指向本页的锚点只有一条：`wiki/concepts/kv-cache.md#L157` 的 `rope.md#rope-的位置与缓存地址不同` —— **失效**（该脚本对 kv-cache.md 报 BAD ANCHOR）。

### 6. wiki:audit 与写作标准

`pnpm wiki:audit` 退出码 0，全库 133 页 / 2196 条来源通过；rope 页 27 条来源无 ✗，仅 3 条 URL 类标「摘录尚未验证」（arxiv ×2、HF config），与其他页同类。
**能否进 `scripts/wiki/standard-pages.json`：能。** 未改该 json，改用临时脚本 `scratchpad/p5/rope-standard.ts` 把 rope 加进内存里的名单跑 `auditStandard`，结果 `problems: []`：正文 4385 字，行内代码 0.0/千字（限 13）、角标 0、对照源码五节齐全且顺序正确、calc 0.46/千字（限 1.2）、相邻块 0、图先行通过、免责 0.0%（限 3%）、图宽 900 / 880 均不超 900。建议由主会话把 `"rope"` 加进名单。

### 7. 结论

- **P1：无。**
- **P2-1（跨页链接失效，`wiki/concepts/kv-cache.md#L157`）**：指向本页旧标题锚点 `#rope-的位置与缓存地址不同`，改写后该标题不存在，读者点过去落到页首。改法：把该链接改成 `rope.md#在推理引擎里旋转发生在哪一步`（缓存里存旋转后的 k 与「位置编号 ≠ 缓存地址」都在 L159–L167）。属于本次改写引起，需本轮修掉。
- **P3-1（底稿口径）**：`docs/mainline/02-forward.md#L36` 的「位置信息只由 KDA 的递归和短卷积携带」应补成三处（加索引器池内偏置、因果范围），与 `glm-5-3-flash.md#L187` 和本页 L205 统一。
- **P3-2（单一出处）**：L187–L191 的 calc 里「512（潜向量）+ 0」与 `mla.md#L233` 的同一推导重复。建议 calc 只留每头打分宽度 256+0，缓存宽度改成一句带链接的引用。
- **P3-3（术语首现）**：L138 首次出现 KDA 没给英文全称（`linear-attention.md#L55` 有 Kimi Delta Attention）；L147–L148 的 NTK-aware / NTK-by-parts 也只给了「改了什么」没点出 NTK。各加半句即可。
- **P3-4（名单）**：见 §6，本页已达标但还不在强制名单里，建议加入以防后续漂移。

**跳过的段落**：frontmatter 的 sources 区（L9–L36，按规则交 `wiki:audit`）；「## 对照源码」正文（L221–L282）只用 grep 核对五个 H3 齐全与顺序、版本差异里 v0.23 / v0.26 / main 齐全与 commit 标注，未逐句读；页内 `text` 代码块与成排环境变量、`wiki/diagrams/rope*.svg` 的绘制细节未逐元素核（只核了画布宽度与图说数字）。未起服务、未截图（知识库前端不在本次审查范围）。**未核**：设备上 RoPE 算子耗时、长文本效果、main 以 0 维构造的索引器旋转模块在前向是否真执行 —— 与写手「待核」一致，不算缺陷。
