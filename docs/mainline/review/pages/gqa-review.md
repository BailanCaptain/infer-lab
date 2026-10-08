# gqa 审查记录

## P5 写作记录（2026-09-28，第 09 批深改，Opus 写手）

### 改了什么

- **定位**：本页改成「为什么要省 KV」的对照概念页。GLM-5.3-Flash 的注意力层是稀疏 MLA 与 KDA，没有 GQA 层，本部署没有 GQA 自己的账；页内出现的 GQA 数字只取自论文（GQA-8、约 5% 继续训练），并在 GLM 节写明不能与 GLM 数字混算。
- **结构**：问题式首屏 H2「几个查询头能不能共读一组 K、V？」+ 一句话定义 + 直觉图 → 三结构小表（3 行）→ 「为什么要省 K、V，代价在哪？」（论文动机 + 三笔代价 + 投影/打分/缓存三行表）→ 保留锚点 H2「缓存容量按 KV 头数计算」（kv-cache.md L157 链到这里）→ 「张量并行时，KV 头不够分就要复制」→ 「落到 GLM 双机：两类注意力层都不按 KV 头存历史」（4 个 H3：配置写 64 个 KV 头但缓存不按头存 / TP8 对照表 / 代码流程图 / 三种做法的结构对照）→ 常见误解 8 条 → 对照源码 5 个固定 H3。
- **图**：`gqa.yaml` 重画：三栏 MHA / GQA / MQA，每栏 4 个查询头，K、V 分两行画出，箭头从一组 K、V 指向读它的查询头，再从每个查询头指向它自己的输出 O；底注「4/2/1 组 K、V → 4 份输出」，只画头数与共享关系，不写字节。新增 `gqa-flow.yaml` 代码流程图：顶端「这一层用哪种注意力？」分三支（普通注意力/GQA、GLM 稀疏 MLA、GLM KDA），每支四站：加载模型 → 启动定缓存规格 → 第 4 站逐层前向，底注「GLM 的注意力层都不走左支」。两图宽 900。
- **单一出处**：GLM 的 64 倍压缩、1,024 B/层/token、KV 预算与块数、R1 每卡形状全部只链 mla、glm-5-3-flash-two-node、one-request，不重算；TP 切法细节链 tensor-parallel 的稀疏 MLA / KDA 小节。
- **APC 与预算分开讲**：误解第 7 条区分三件事：GQA 的共享（一个请求内、同层同位置的查询头之间）、prefix caching 的共享（请求之间，链 prefix-caching「命中需要同时满足什么」）、块数预算（启动时显存预算，链部署页）。
- **出处**：23 条 sources 全部指向论文、HF config 或钉住 commit 的实际代码路径，没有 tests/ 下的文件。新增 15 条（llama.py 读配置与切/复制、linear.py 按复制份数取 KV 头、divide 报错、kv_cache_interface 每块字节、cpu_attn 的 enable_gqa、Ascend attention_v1 在 2ed6cbba / baa023ad / db701c1f 的对应行、indexer_kpool_mla 规格、kimi_gdn_linear_attn 头数、Ascend GLM config 头数缺省）。`verified` 设为三版。
- **角标**：对照源码之上 0 处；全页 25 处（C 17 处，68%）。第一次整理时 62 处触发 lint `mark-flood`，已把证据索引改为按源码位置表对应，只在源码区保留关键角标。

### 数字来源

- 34 层 KDA、11 层稀疏 MLA、KDA 64 头 × 128、MLA 64 头与 512 维潜向量：底稿 02 §0.2。
- KDA 64 头按 TP8 切成每卡 8 头：底稿 02 §4.3。MLA 每卡 8 个头、`fused_qkv_a_proj` 不切分（每卡都算）：底稿 02 §5.2。潜向量 TP8 下每卡完整一份、与 GQA 按头切的区别：底稿 02 §5.6。
- GLM 配置 `num_key_value_heads = 64`：底稿 03「已定案（原待核 1）」，源码侧复核 `vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py` L23–L50、L128–L134（缺省等于查询头数）。
- 64 倍压缩只作结论引用 mla.md，不在本页推。
- GQA 侧只有比例式与论文数字（GQA-8、约 5%），没有字节算例。

### 核心概念对照

- **论文（Ainslie et al. 2023, arXiv 2305.13245）**：GQA-G 定义、GQA-1 = MQA、GQA-H = MHA；同组 K、V 投影平均池化后 uptraining（α≈5%）；动机是 decoder 推理载入 K、V 的带宽；MQA 质量下降与训练不稳；GQA-8 质量接近 MHA、速度接近 MQA；大模型头多时 MQA 砍得更狠、GQA 保持比例；不用于 encoder 自注意力。**arxiv 本轮 WebFetch 被网络策略拦截，未能联网打开，按已知论文内容与旧版页面核对，已写入页末待核，请审查者联网复核。**
- **vLLM 0fc695fc 的实现**：`Attention.__init__` 缺省 `num_kv_heads = num_heads`、断言整除并给出报错串（attention.py L281–L292）；前向 Q 按 `num_heads`、K/V 按 `num_kv_heads` 整理（L483–L488）；`QKVParallelLinear` 在 `tp_size >= total_num_kv_heads` 时每卡 1 个 KV 头、`num_kv_head_replicas = tp_size / total_num_kv_heads`（linear.py L1025–L1031），加载时 KV 分片取 `tp_rank // num_kv_head_replicas`（L1358–L1363）；Llama 按 `max(1, total // tp)` 定本卡 KV 头并断言整除（llama.py L144–L156）；缓存每块字节 `2 × block_size × num_kv_heads × head_size × dtype`（kv_cache_interface.py L183–L201）。
- **KV 头复制/广播的位置**：TP 复制在权重加载（QKVParallelLinear）；查询头与 KV 头的组对应不在 Python 层展开：CPU 后端给 SDPA 传 `enable_gqa`（cpu_attn.py L444–L456）；Ascend 普通后端把 `num_heads`、`num_key_value_heads` 分别传给融合算子。在 2c59ff10 / 2ed6cbba / baa023ad / db701c1f 四个版本的 `attention_v1.py` 里 grep `repeat_interleave|repeat_kv|.expand(|enable_gqa` 均为 0 处。
- **GLM 不是 GQA**：`indexer_kpool_mla.py` L121–L134 的 `MLAAttentionSpec(num_kv_heads=1, ...)`；`glm5_next.py` L1901–L1962 的 `fused_qkv_a_proj`（`disable_tp=True`）与 `num_local_heads`；KDA 的 q/k/v 投影同为 `head_dim × num_heads`、按 TP 等分头（kimi_gdn_linear_attn.py L110–L134）。GLM 模型代码只在 db701c1f，2c59ff10 / 2ed6cbba / baa023ad 都没有 `glm5_next.py`（`git cat-file -e` 核过）。

### 旧版信息清单勾选

清单：scratchpad `p5/gqa-facts.md`（旧版 = p4-checkpoint，与改前 HEAD 相同，30 条 F1–F30）。结果：

- 在新版中找到 28 条：F1–F8、F10–F29（F4 在图注；F17、F20、F21 在对照源码；F22、F23 在版本差异与待核）。
- 挪走 1 条：F30 的「专用镜像完整安装组合以来源基线待核项为准」挪到页末待核，并链 [来源基线](../../../wiki/sources/glm-5-3-flash-baseline.md)；F30 其余部分（GLM 缓存按实际压缩对象计算、细节归 MLA 页）保留在 GLM 节。
- 删除 1 条：F9 玩具字节表（n_q=4、d=128、BF16 下 2048/1024/512 B、4096 token 8/4/2 MiB）。理由：本批要求页内 GQA 数字只能是标明出处（论文或公开模型 config）的对照示例；这组取值是编造的算例，写作标准也要求「不编造数字算例」。其结论保留为比例式：相对 MHA 按「KV 头数 ÷ 查询头数」缩小，GQA-8 缩到「8 ÷ 查询头数」，MQA 缩到「1 ÷ 查询头数」。

### 自检

- `pnpm wiki:lint` 退出码 0，本页 0 条；`pnpm wiki:diagrams` 生成 gqa.svg、gqa-flow.svg，`--check` 193 张图与 spec 一致，本页两图无版式警告；`pnpm wiki:audit` 退出码 0（本页 23 条来源，行号全部有效；本页在名单外）；`pnpm check:content` 退出码 0。他页 lint 提示（vllm-ascend-repo-map 等的 mark-flood、diagram 代码名）不是本页改动。
- 写作标准统计（checkStandard，手动对本页强制）：教学正文 3,360 字，行内代码 0.6/千字，对照源码之上角标 0，calc 0，免责 1.0%，图先行、图宽均通过；站内链接 23 条，锚点 0 条失效。
- 字数（count.py 口径，去空白字符）：改前 2,318；改后全文约 9,300，其中教学正文约 5,500、源码区约 3,750。
- 未做浏览器验收，留给审查环节。

### 请审查者重点看

- 论文结论未联网复核（见上）。
- 第二节「打分与汇合」乘加次数、「复制后每卡缓存不再随卡数减少」为本页推导 [D]。
- 首屏定义与图：共享的是 K、V，查询头与输出份数不变；TP 复制与算子内分组是两件事。

## P5 审查（09-28）

独立审查，只审不改。页面 `wiki/concepts/gqa.md`（235 行，深改后版本）。

**分数：9 / 10。P1 无，P2 无，P3 三条。**

### 初学者测试（只读前两屏）

一句话：GQA 把查询头分组、同组共读一组 K、V，省下 K/V 投影与缓存的份数；代价是历史能被读出的花样变少、且必须训练时定死，打分与汇合一点不省。——首屏问题式 H2 + 加粗定义 + 直觉图齐全，第二屏讲清了动机与三笔代价，初学者测试通过。

### 论文结论复核（写手自报 arxiv 被拦，本轮已代核）

经 arxiv 摘要页（abs/2305.13245v3）与 ar5iv 全文（ar5iv.labs.arxiv.org/html/2305.13245）逐条核对，页面标注「出自论文」的结论全部属实：

| 页面位置 | 结论 | 核对结果 |
|---|---|---|
| L64 | GQA-G 记号；G=1 即 MQA、G=头数即 MHA | 属实（"GQA-1 … is equivalent to MQA, while GQA-h … is equivalent to MHA"） |
| L70 | 解码时载入 K、V 的带宽开销是变慢的主要来源之一 | 属实；论文原文是 decoder weights 和 K/V 两者，页面写「之一」措辞准确 |
| L72 | MQA 质量下降、训练可能不稳定 | 属实（"quality degradation and training instability"） |
| L72 | T5 XXL 上 GQA-8 质量接近 MHA、速度接近 MQA | 属实（GQA-8-XXL 实验） |
| L72 | 模型越大头越多、MQA 砍得越狠；GQA 随放大保持同比例缩减 | 属实（"same proportional decrease … as model size increases"） |
| L77 | 转换 = 同组 K/V 投影 mean pooling + 约 5% 预训练算力 uptraining | 属实（摘要与 §2.2） |

对照源码「待核」第一条「论文外链本轮未联网打开」现已由本轮审查补上，写手可在下次触碰时更新该条（见 P3-2）。

### 核心概念对照源码（vllm@0fc695fc、vllm-ascend 各快照）

- 缺省 KV 头数 = 查询头数、整除断言、两种头数分开保存：`vllm/model_executor/layers/attention/attention.py#L281-L292`，与页面一致。
- `num_queries_per_kv = num_heads // num_kv_heads`：`vllm/v1/attention/backends/cpu_attn.py#L280`；SDPA 按组广播开关 `enable_gqa=self.num_heads > self.num_kv_heads` 在 `#L444-L456`，页面 L145「打开一个按组广播 K、V 的开关」属实。
- TP 切分或复制：`vllm/model_executor/models/llama.py#L144-L156`（两种整除断言、少于卡数时复制）；`QKVParallelLinear` 在 `linear.py#L1025-L1031`（tp_size ≥ 总 KV 头数时每卡 1 头、replicas = tp_size ÷ KV 头数），`#L1363` `shard_rank = tp_rank // num_kv_head_replicas` 即页面 L107「第 r 张卡取第 ⌊r ÷ 复制份数⌋ 个 KV 头」，全部属实。
- Ascend v0.23（2c59ff10）`attention_v1.py#L414-L428` 存两种头数并断言整除，`#L1336-L1359` 融合算子分别接收 `num_heads` 与 `num_key_value_heads`、调用前不展开 K/V，页面 L145 属实。
- 每块字节公式：`vllm/v1/kv_cache_interface.py#L194-L201` 为 2 × block_size × num_kv_heads × head_size × dtype 字节，页面 L98 一致（含「默认 K、V 每头同宽」的限定）。
- 镜像 db701c1f `indexer_kpool_mla.py#L121-L134`：`MLAAttentionSpec(num_kv_heads=1, …)`，页面 L121「1 个 KV 头」属实。
- MHA/GQA/MQA 关系表（L58-L64）与论文、源码均一致。未发现概念错误。

### 数字与对照隔离

- 「少存 64 倍」（L121）与单一出处 mla.md L72-78（2×64×256=32,768 ÷ 512 = 64）一致，本页只引结果并链推导，未重算。
- KDA 64 头、每头 128 维（L122）与底稿 02-forward.md §4.3（64/8=8 头/卡、64×128=8192）及 linear-attention.md 一致。
- TP8 表（L130-L135）与底稿 §5.2 一致：MLA 压缩投影 Replicated、8 卡各算各存一份完整潜向量；KDA 状态按头切。
- grep 全页：无本页重算 GLM 字节数或块数的段落；块数一律链接部署页（L100、L169）。GQA 数字（GQA-8、T5 XXL、5%）均标注出自论文；示意头数（4 头 2 组）在图注和正文都写明「只为示意，不对应任何模型」。对照隔离合格。

### 丢信息（git diff + 写手清单 gqa-facts.md）

diff 删除行逐条对照：旧版 F1-F30 中 F9（4 头玩具字节表）按清单声明删除、结论改比例式保留（L96），其余 29 条全部在新版找到落点，勾选属实。旧版「不能据接口推断算子内部访存」「本页无性能实测」分别承接为 L84、L86 与待核第三条。无丢信息。

### 链接、图、audit

- 页内 21 个内链全部解析，锚点逐一对到目标页标题原文；入链 3 处（attention-qkv、kv-cache#缓存容量按-kv-头数计算、mla）均有效。
- `pnpm wiki:diagrams --check` 退出码 0，193 张图一致，gqa 两张无警告；gqa.svg / gqa-flow.svg 宽 900 ≤ 900，gqa.yaml 无字节数字，只画头数与共享关系，与正文表格一致。
- `pnpm wiki:audit` 退出码 0，本页在册（evidence=C，来源 23 条），无错误。
- 对照源码五个 H3 齐全且顺序正确；版本口径 v0.23=2c59ff10、v0.26=2ed6cbba、main=baa023ad、db701c1f 单独标注不入 v0.23 列，全部合规。角标只出现在对照源码内；无 calc；正文行内代码 8 个（约 10.6 千字），密度合格；表格与 calc 无相邻问题。

### 问题清单

- **P3-1** L111「GLM 的稀疏 MLA 正好落在这一情况的极端，见下一节」：MLA 在正文首次出现于此，既无链接也无一句解释（链接在 L115 才出现）。改法：把 mla.md 链接前移到 L111，或此处补半句「（把每层历史压成一条共用潜向量的做法）」。
- **P3-2** L231 待核第一条「论文外链本轮未联网打开」：本轮审查已联网逐条核实（见上表），下次触碰本页时可把该条更新为「已核」或删除。
- **P3-3** wiki/index.md 仍是旧标题「GQA：查询头如何共享 K/V，改变哪些开销」：index 是 `pnpm wiki:build` 派生文件，批次收尾统一重建即可，不算页面缺陷，提醒别漏。

### 备注

L98 的 vLLM 每块字节公式与 kv-cache.md 各写了一遍（同一源码出处），本页写它是为了引出「本卡 KV 头数」，可接受；若将来收紧单一真相源，可改为链接 kv-cache。

## P3 收尾（09-28，Opus 写手自修）

- **P3-1 已修**：正文「复制有两个后果」段里 MLA 首次出现处补了 mla.md 链接和半句解释（把每层历史压成一条所有头共用的潜向量来存的做法）；L115 原链接保留不冲突。
- **P3-2 已修**：删除页末待核第一条「论文外链本轮未联网打开」——审查已经 arxiv/ar5iv 逐条核实属实（见上节表格），页面不再保留这条 meta 待核。
- **P3-3 已修**：跑 `pnpm wiki:build`（133 页，退出码 0），wiki/index.md 与 registry.json 已更新为新标题「GQA：几个查询头共读一组 K、V，省下什么、付出什么」（index L19、L281 核过）。
- 复跑检查：`pnpm wiki:lint` 退出码 1、`pnpm wiki:audit` 退出码 1，但失败的 3+1 条全部在 concepts/prefix-caching.md（diagram-identifier、relation-duplicate）与 concepts/vllm-kv-block-allocation.md（relation-duplicate）——这两页别人正在改，本批指示不碰；grep 两份输出，本页 gqa 0 条问题，audit 在册行无 ✗（来源 23 条全有效）。

## 基础讲清修订（09-29）

按 basics-standard（总原则 + 第 1–14 条）小修，不整页重写；排查结论「基本讲清，小修」两点都已处理。正文（不含 frontmatter，去空白计）9,348 → 12,075 字；对照源码之前 5,570 → 8,297 字。

### 逐节改了什么

- **几个查询头能不能共读一组 K、V？（是什么）**：开头原来只有半句复述 Q/K/V。改为两段：先说 Q、K、V 是同一隐藏向量乘三个权重矩阵得到的三条向量，各管什么（找别人 / 被匹配 / 交出去的内容），怎样打分、换权重、加权相加；再说 MHA 把 Q、K、V 切段成头、各头独立算、最后拼接，所以 MHA 每头有自己的 K、V；然后才是原有的 GQA 加粗定义、图、表。链接 attention-qkv 与其多头一节。其余原文不动。
- **为什么要省 K、V，代价在哪？**：节首加一段「KV cache 又大、又每步都要读」：按 KV cache 页同一组示意尺寸（32 查询头、128 维、32 层、BF16），一条 4,096 token 请求 MHA 2 GiB、8 组 512 MiB，并指向容量一节的演算。原有 decode 带宽、论文结论、三笔代价与表、「省显存不省计算」全部保留。
- **新增 H2「同组的查询头怎样共读一组 K、V？算一遍」（怎么算）**：沿用 gqa 图 GQA 栏（4 查询头、2 组、每头 2 个数、3 个位置），第 0 组 K、V 取 attention-qkv 多头一节头 0 的数；calc 演 Q₀=[1,2]、Q₁=[0,1] 读同一组 k、v：点积 → ÷√2 → softmax → 加权 v，得到 [0.82, 0.27] 与 [0.60, 0.60] 两份不同输出（Q₀ 的结果与 attention-qkv 头 0 一致，可互相核对）。再用一张表把代价 3 的三处开销代入同一例子：打分 24 次、汇合 24 次三种结构相同；K、V 投影参数 128 / 64 / 32（隐藏宽度 8，示意）。softmax、÷√d 首次出现处给了一句解释并链 attention-qkv#为什么要除以-d。
- **缓存容量按 KV 头数计算**：公式后新增图 gqa-cache 与两组演算：① 小例子一层 3 个位置 MHA 48 / GQA 24 / MQA 12 个数（1/2、1/4）；② KV cache 页示意尺寸下每位置每层 16,384 / 4,096 / 512 B，整条 4,096 token 请求 2 GiB / 512 MiB / 64 MiB，与 kv-cache 页「512 MiB」一行接上；补一句 decode 每步逻辑上要读的量同比缩小（能否真只读一次看算子，与原「待核」一致）。vLLM 每块字节式后加一句示意代入：单卡、每块 16 token → 65,536 B = 64 KiB。原有「逻辑数据量 vs 真实占用」、部署页链接保留。
- **张量并行时，KV 头不够分就要复制**：在原 TP=2 / TP=4 走读后加 calc：每卡每位置每层 8 → 4 → 4 个数，TP=4 时 4 卡合计 16 个、每组存 2 份，直接演出「卡数超过 KV 头数后每卡不再变小」。
- **GLM 双机 / 常见误解 / 对照源码**：未改（GLM 用稀疏 MLA 与 KDA、没有 GQA 层的事实及 mla / kv-cache 链接原样保留）。

### 新增演算与图

- 数值演算 5 处：同组两查询头读同一组 K、V（calc）；三处开销对照（表）；小例子容量（calc）；4,096 token 请求容量（calc）；TP 每卡存几个数（calc）。另有每块字节一处行内代入。
- 新图 1 张：wiki/diagrams/gqa-cache.yaml（MHA / GQA / MQA 三栏，每组 K、V 画成 3×4 格子表，表下写读它的查询头，右侧写每位置 / 3 位置的数）。只用现有 frames / grids / texts，文字 6 段。
- 新增图元：无。
- 第一版把两段开销也写成 calc，audit 报 calc-density 1.45（上限 1.2）；改为表格 + 行内代入后 calc 块 4 个，audit 本页 0 报错。

### 清单勾选（scratchpad/gqa-basics-facts.md，36 条）

- 第 1–9 条：保留；第 1、2 条保留+（扩成 Q/K/V 与多头的两段）。
- 第 10–18 条：保留；第 17 条保留+（新节用示意数代入三处开销）。
- 第 19–22 条：保留；第 19、20、21 条保留+（新增图与两组演算、每块字节代入）。
- 第 23–27 条：保留；第 26、27 条保留+（新增每卡数格子 calc）。
- 第 28–36 条：保留，未改。
- 删除：无。挪动：无。

### 检查

- pnpm wiki:lint：通过（本页 0 报错；中途全局报错来自 expert-parallel / data-parallel 等别页，最后一次已全局通过）。
- pnpm wiki:diagrams --check：228 张图与 spec 一致；gqa-cache 无警告。
- pnpm wiki:audit：本页 0 报错；本页在 standard-pages.json 名单内，仍达标。
- 锚点用 src/content/wiki/anchors.ts 的 headingSlug 核过：为什么要除以-d、存一份要多少从一个位置一层往上乘、缓存容量按-kv-头数计算。
- 浏览器（Playwright，1440 宽，http://localhost:5193/#/wiki/gqa）：第一屏 scratchpad/gqa-shot-1.png，新图与容量演算 gqa-shot-2.png，同组演算 gqa-shot-3.png；数字清楚、无重叠、无裁切，无 pageerror（502 来自问答后端，与本页无关）。
- 浏览器里发现并已改：第 0 组 K、V 原写成 ```text 块，被渲染成算式框（标签/结果错位），改成一张位置 0–2 的小表；gqa-cache 三栏间距偏紧，栏距加 10px。开销表表头改为「一层，示意」，打分/汇合两行标明是位置 2 这一步。

## 基础讲清审查（09-29）

独立审查员（Opus 5.5，未开子代理）。依据 basics-standard（总原则 + 第 1–14 条）、basics-audit 第 9 节、上面「基础讲清修订（09-29）」一节、scratchpad/gqa-basics-facts.md 与三张截图。

### 学习顺序

第一节先用两段把 Q/K/V（找别人 / 被匹配 / 交出去的内容，点积→权重→加权 V）和多头（切段、各头独立算、拼接）讲给没读过 attention 页的人，并链 attention-qkv 与其多头一节；然后才给 GQA 加粗定义、图、MHA/GQA/MQA 表。第二节讲为什么（KV cache 大且每步都读）与代价，第三节起才演算。顺序符合「是什么 → 为什么 → 怎么算」，第一屏没有一上来就算。排查指出的「前置 Q/K/V 只有半句」已解决。

### 逐节初学者检验（GLM 之前 5 个 H2，5/5 通过）

1. 几个查询头能不能共读一组 K、V？——能讲出：GQA 把查询头分组，同组共读一组 K、V，但各用自己的 Q 打分、各出输出，少的只是 K、V 份数；1 组是 MQA，组数等于查询头数是 MHA。通过。
2. 为什么要省 K、V，代价在哪？——能讲出：KV cache 随历史和并发变大、decode 每步都要读，少存少读就能多接请求、少搬数据；代价是质量、只能训练时定、打分汇合没省（投影省了）。通过。
3. 同组的查询头怎样共读一组 K、V？算一遍——能讲出：Q₀、Q₁ 拿同一张 k、v 表，点积不同所以权重和输出不同；打分/汇合次数三种结构一样，K、V 投影参数随组数减半。通过。
4. 缓存容量按 KV 头数计算——能讲出：每 token 每层字节 = KV 头数 ×（K 宽 + V 宽）× 字节数，查询头数不进式子；32 头 MHA 2 GiB、GQA-8 512 MiB、MQA 64 MiB。通过。
5. 张量并行时，KV 头不够分就要复制——能讲出：TP 按头分卡，KV 头少于卡数时每卡放 1 个、多卡重复存，所以再加卡每卡缓存也不变小。通过。

### 演算逐个手算（全部正确）

- 第二节开头 2 GiB / 512 MiB：32×256×2 B=16,384 B，×32 层×4,096=2,147,483,648 B=2 GiB；8 头同法 536,870,912 B=512 MiB。对。
- 同组两查询头 calc：Q₀·k=[4,2,1]，÷√2=[2.83,1.41,0.71]，e 指数 16.92/4.11/2.03，和 23.06，权重 [0.73,0.18,0.09]，输出 [0.82,0.27]；Q₁·k=[1,1,0]，÷√2=[0.71,0.71,0]，权重 2.03/5.06=0.40、1/5.06=0.20，输出 [0.60,0.60]。对，且与 attention-qkv 多头一节头 0 的 [0.82,0.27] 一致（已核 attention-qkv.md 第 222–224 行）。
- 开销表：4×3×2=24（打分、汇合各一行）；8×4×4=128、8×2×4=64、8×1×4=32。对。
- 小例子容量 calc：16/48、8/24、4/12，1/2 与 1/4。对。
- 4,096 token calc：16,384 / 4,096 / 512 B；×131,072 得 2 GiB / 512 MiB / 64 MiB。对；与 kv-cache.md 第 149–156 行 4,096 B、512 MiB、16,384 B 接得上。
- 每块字节：2×16×8×128×2=65,536 B=64 KiB。对。
- TP calc：8；TP=2 每卡 4 合计 8；TP=4 每卡 4 合计 16、每组 2 份。对。
- 图 gqa-cache：三栏格子数 3×4×4=48、3×4×2=24、3×4=12，与右侧文字一致。

### 核心概念对照论文 / 源码

- GQA 论文（Ainslie et al. 2023，arXiv 2305.13245）：GQA-G 把查询头分 G 组、每组共享一个 K 头和 V 头；GQA-1=MQA、GQA-H=MHA；从 MHA 检查点转换用组内 K、V 投影取平均（mean pooling）+ 约 5% 原预训练算力 uptraining；T5 XXL 上 GQA-8 质量接近 MHA、速度接近 MQA；MQA 可能质量下降、训练不稳；大模型头多，按组共享保持同样缩减比例。页面五处表述都与论文一致。
- 分组须等分、例子里 Q₀Q₁→组 0、Q₂Q₃→组 1 的连续分组，与 vLLM 断言整除、PyTorch 按组广播的做法一致；TP 复制时第 r 卡取 ⌊r÷复制份数⌋ 个 KV 头，与 QKVParallelLinear 一致（本轮未改，P5 审查已核源码）。
- GLM 事实仍在：GLM 一节明写 34 层 KDA + 11 层稀疏 MLA（+MTP），「没有一层是 GQA」，并链 mla、linear-attention、部署页；kv-cache 链接在第一、二、四节。未被本轮改动。

### 没丢信息

- 抽查清单 6 条：#7 GQA-G 记法（第一节表后）、#11 论文带宽结论（第二节第 2 段）、#16 uptraining 取平均 + 5%（代价 2）、#22 逻辑量 vs 真实占用（容量一节末）、#25 KV 头少于卡数复制与 ⌊r÷复制份数⌋（TP 一节）、#35 常见误解——全部在原位。
- git diff -- wiki/concepts/gqa.md：80 增 2 删。删掉的两行：① 旧的一句 Q/K/V + 多头复述，已被新两段完整覆盖（「各用自己一套投影」改说成「各切一段」，含义不变）；② vLLM 每块字节式，原句保留、只在句尾加示意代入。frontmatter、GLM 一节、常见误解、对照源码无改动。无信息丢失。
- 附记：清单 #35 写「7 条误解」，HEAD 与现版实为 8 条，属清单笔误，页面没丢。

### 标准第 11–14 条

- 第 11 条：每处「怎么算」都有数值演算。通过。
- 第 12 条：基础节没有 GLM 部署数字（第五节末只一句指向 MLA、第四节末只链部署页）。通过。
- 第 13 条：GLM 之后只有常见误解和对照源码。通过。
- 第 14 条：第一节末尾以「共享只在同请求同层同位置」收尾，没有堆链接。通过。

### 图

- shot-1：第一屏文字与 gqa 图清楚，三栏 Q/K/V 标签不重叠。gqa 图是方框加箭头的结构图，用在「是什么」处合适（P5 原图，本轮未动）。
- shot-2：新图 gqa-cache 每组 K、V 画成 3×4 格子表，表头 K K V V、行标位置 0–2、表下「Q₀、Q₁ 共读」，右侧每位置 / 3 位置的数；不看正文也能看出「组越少、格子越少」。字清楚，无重叠无裁切。GQA、MQA 两栏中间留白较多，不影响阅读。
- shot-3：第 0 组 K、V 小表与 calc 对齐清楚。截图里开销表表头还是「位置 2 这一步」，现文件已改为「一层，示意」，截图略早于最后一改，不影响判断。

### 锚点与 audit

- 全库指向本页的带锚链接只有 kv-cache.md 第 156 行 gqa.md#缓存容量按-kv-头数计算，标题未改，可解析；本页出站锚点 attention-qkv#为什么要除以-d、#多头同一个位置同时按几套方式去读、kv-cache#存一份要多少从一个位置一层往上乘 对应标题都存在。
- pnpm wiki:audit：总体 ok；本页「✓对照源码 · ✓calc 0.93/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 0.8% · ✓图宽」，名单 49 页全部达标，本页通过。
- pnpm wiki:diagrams --check：236 张图与 spec 一致，gqa-cache 无警告。

### 问题清单

P1：无。

P2：无。

P3：
1. 第三节「和 MHA 比」一句（Q₁ 借用 Q₀ 那组）：Q₁=[0,1] 正是 attention-qkv 多头例子里头 1 的 q，那里头 1 读自己的 k、v 得 [1.20, 0.80]，本页借用第 0 组得 [0.60, 0.60]，两页权重又恰好都是 [0.40, 0.40, 0.20]，对照着读的人可能疑惑。改法：补一句「在 attention 页的 MHA 例子里，Q₁ 读自己那组得 [1.20, 0.80]；共读第 0 组后变成 [0.60, 0.60]——这就是代价 1 说的『各头能读到的不同 K、V 变少』」，顺带把代价 1 落到具体数上。
2. 第二节第一段首次出现 BF16 未解释，到第四节才说「每个数 2 B」。改法：第二节括注「BF16，每个数 2 字节」。
3. 第四节 4,096 token calc 里「× 4,096」没带单位。改法：写成「× 4,096 个位置」。

### 打分

9.5 / 10。小修到位：前置 Q/K/V 与多头讲清、五处演算全部算对且和 attention-qkv / kv-cache 两页数字接得上、新图可数格子、论文事实准确、GLM 用 MLA/KDA 不用 GQA 的事实与链接原样保留、无信息丢失。扣分只在上面三条 P3。

### P3 修复（09-29，写手）

三条 P3 全修：① 第三节「和 MHA 比」后补一句：假如 Q₁ 有自己的一组（取 attention 页头 1 的 k、v）读到 [1.20, 0.80]，共读第 0 组后变 [0.60, 0.60]，两次权重碰巧都是 [0.40, 0.40, 0.20]、不同的是 v，并落到代价 1「质量换容量」（[1.20, 0.80] 已对 attention-qkv 多头 calc 核过）；② 第二节首次出现 BF16 处括注「每个数 2 字节」；③ 4,096 token calc 三行改为「× 4,096 个位置」。复查：wiki:lint、wiki:diagrams --check、wiki:audit 本页 0 报错（lint 与 diagrams 当时各有 1 处报错，均属 sequence-parallel 页，与本页无关）。
