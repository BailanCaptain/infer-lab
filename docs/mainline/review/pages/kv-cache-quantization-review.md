# kv-cache-quantization 审查记录

## P5 写作记录（2026-09-29，第 11 批深改，Opus 5.5）

### 接手时的状态

- 现版与 p4-checkpoint 完全相同（`git diff p4-checkpoint -- wiki/concepts/kv-cache-quantization.md` 为空），旧版即现版：5 个 H2、1 张图、无「对照源码」、正文 12 个证据角标。
- 字数：body.length（wiki:audit 口径）2,020 → 13,890；教学正文（「对照源码」之前，写作标准口径）1,142 → 4,099 字。

### 改了什么

- 按 09-29 讲法重排：是什么（一句话定义 + 直觉图）→ 为什么需要与代价 → 一个块怎样压、读回来差多少（两个 calc）→ decode / prefill 怎样读（流程图）→ 页和整卡为什么不一定减半 → Ascend 上三条量化路 + PD 两端格式 → GLM 双机（变体：本部署未开）→ 常见误解 → 对照源码（五个 H3）。
- 标题改为「KV cache 量化：历史的 k、v 改用 8 位存，读时再乘回系数」；summary、aliases 更新；updated 改 09-29。index.md 里的旧标题没动（不属本页范围，由主会话同步）。
- relations：保留 quantization、kv-cache、kv-cache-spec，新增 mla（builds-on）。
- sources：保留原 7 条（C1–C7 编号不变），新增 22 条，共 29 条；wiki:audit 29 条全部行号有效。
- 图：新增直觉图 `kv-cache-quantization-intuition`（同一段显存，BF16 装 4 块、INT8 装 8 块；每块 4 个位置 × 8 个数，INT8 每格半宽；底部一条系数，注明每层一套、随权重加载、不占这段显存）。原图 `kv-cache-quantization` 改成代码流程图：上半写入（新 k、v → 压成 INT8 → 按槽位写块 → 分页 INT8 缓存），下半按阶段三路（整段 prefill 用浮点 / prefill 接历史先收拢展开 / decode 直接读 8 位）汇入 attention；标了「开了 C8 时：主线第 4 站」和「块表与槽位来自第 3 站」。
- 正文角标全部移到对照源码末尾「来源与结论对应」：共 21 处，C 16 处（76%），A 1、D 3、I 1。

### 数字取自哪里

- 基础节全用示意数：KV cache 页的示意模型（8 KV 头 × 128 维 × 32 层，4,096 token 请求 512 MiB，16 条 8 GiB）只引用并链接到 kv-cache「存一份要多少」；s = 0.0125 的三个值与 2 KV 头 × 64 维 × 100 位置 × 每页 32 位置沿用旧版算例（旧版标 [A]）。
- GLM 数字只在 GLM 一节，全部引用、不重算：13,056 B/token、12 层（主干 11 + MTP 第 45 层）出自 01 §A0.5 / 02 §5.6，经 D 页「占住一个块号，要用多少显存」链接；潜向量 12,288 B、索引器 768 B 出自 02 §1.4；561,152 B 与 640 的定块规则出自 02 §5.6，经 D 页「为什么一个逻辑块是 640 个 token」链接；每条请求 12 个 KDA 块号出自 D 页「为什么短请求也占 15 个块」；index_topk = 2,048 出自 02 §0 模型表。
- 本页唯一新推的数：把 patch_mamba_config 的定块规则代入 1 字节得到 1,152 token 的逻辑块，calc 标题和正文都写明「假设推算，不是部署状态」，来源对应里标 [D]。
- 变体收益：没有任何设备实测，GLM 主线数字没有当成 KV cache 量化的效果；缺口写进页末「待核」。

### 核心概念对照了什么

- 写入公式（乘倒数、加偏移、舍入、截到 −128…127）：db701c1f attention_v1.py 1733–1754。
- 系数按「KV 头 × 头内维度」取、TP 按 KV 头切、预算倒数：同文件 1650–1682。
- 前向先量化写入、prefill 保留浮点、按 DecodeOnly / ChunkedPrefill / 其他分派；不支持输出融合量化：同文件 1568–1606。
- decode 直接读分页 INT8，只传 antiquant scale、不传 offset；每页位置数 32 倍数断言：同文件 1756–1791（以及 1810–1816 的 chunked prefill decode 部分）。
- prefill：PrefillNoCache 用浮点、PrefillCacheHit 收拢展开：1895–1934；展开时 gather、valid_mask、「Scale-only dequant（symmetric）」：1685–1731。据此写「读回只乘系数，实际要求偏移为 0」，来源对应标 [I]，并进待核。
- C8 登记（kv_cache_type == "C8"、k_proj.kv_cache_scale 键）：modelslim_config.py 964–980；非 producer 才设 INT8、换 AscendC8AttentionBackendImpl：kv_c8.py 108–145；Mooncake + GQA + C8 启动报错：ascend_config.py 349–372。
- FA 量化：get_kv_quant_dtype（A5 FP8、其余 INT8；MLA 只压 K）modelslim_config.py 770–779；mla_v1.py 760–765；MLA 缓存 K = kv_lora_rank、V = qk_rope_head_dim：model_runner_v1.py 3978–3989。
- 稀疏 C8：kv_cache_interface.py 54–71（SFA C8 把 kv_lora、k_rope 与 per-tile scale 打包进 kv_cache[0]；LI C8 索引器 int8 + fp16 scale）；ascend_config.py 280–289；sfa_v1.py 672–685。
- GLM 未开：indexer_kpool_mla.py 69–77（主缓存 dtype 写死 bfloat16，注释说所有设备保持 BF16）；indexer_kpool_mla_v1.py 557–578（AscendIndexerKPoolMLAImpl 继承 AscendSFAImpl，构造时 use_sparse_c8_indexer / use_sparse_c8_sfa 置 False，c8_enable_reshape_optim 报错）；platform.py 504–505（有 index_topk 的模型 cache_dtype 改回模型精度）。
- 定块规则按 get_dtype_size(kv_cache_dtype) 算页大小：patch_mamba_config.py 83–86、112–139。
- 版本：2c59ff10 / 2ed6cbba 的 kv_c8.py 与 baa023ad 的 methods/kv_cache/kv_c8.py 111–130 行逻辑一致；三版都有 enable_c8_quant、fa_quant_type、稀疏 C8 两开关、32 倍数断言、Mooncake 检查与输出融合量化报错（git grep 计数核对）；platform 的 cache_dtype 改写在 2c59ff10（505 行）、2ed6cbba（461 行）有，baa023ad 没有；GLM 代码只在 db701c1f 与 baa023ad（models/glm5next/，主缓存经上游 MultiHeadLatentAttentionWrapper，attention.py 20–23）。上游 vLLM 0fc695fc 的 CacheDType 可选值：config/cache.py 19–35。
- 另核：DeepSeek-V4 在 A5 上自定 FP8 缓存（deepseek_v4.py 152–155），据此把「三条路」限定为「通用的三条」。

### 旧版信息清单勾选（清单：scratchpad\p5\kv-cache-quantization-facts.md）

- F1 权重量化与缓存量化的对象区别、BF16→INT8、误差、读取要认尺度：新版第 1、2 节与对照表。✓
- F2 GLM 有 KDA 与稀疏注意力，普通 K/V 算例不是 GLM 支持声明：GLM 一节开头与「页和整卡」第 3 条。✓
- F3 写入公式：第 3 节开头、流程图第 2 步、来源对应。✓
- F4 s = 0.0125 三行算例：第 3 节 calc，数字不变。✓
- F5 尺度小则格细、范围窄；实际尺度由量化方案决定：calc 后一段，并补了 s = 1.7 ÷ 127 的对照。✓
- F6 decode 读 paged INT8、传块表与尺度、不永久展开：流程图第 6 步。✓
- F7 prefill 区分新浮点与历史、gather + 反量化临时张量与掩码、临时内存成本：第 4、5 步，「开销」一节。✓
- F8 差异来自执行阶段与算子接口，不只看前缀命中；分块 prefill 后续段也读历史：第 4 节步骤后一段，常见误解第 5 条。✓
- F9 2 头 × 64 维 × 100 位置，50/25 KiB，4 页 128 位置 64/32 KiB，另加量化元数据：第 3 节第二个 calc；「量化元数据」改写为每层 512 个系数与偏移、不随历史增长（按 kv_c8.py 与 1650–1682 核实）。✓
- F10 每页位置数须为 32 的倍数，32 满足但不保证其余配置兼容：「页和整卡」第 1 条、报错表第 1 行。✓
- F11 页容量前提、混合缓存管理器页对齐、改 dtype 改页内位置数或填充、分报有效载荷/实际分配/临时工作区：「页和整卡」第 2 条与末段，GLM 一节给出 1,152 的具体例子。✓
- F12 KDA 递推状态不是逐 token 追加、稀疏注意力有索引状态、量化单个张量不等于整卡减半：「页和整卡」第 3 条。✓
- F13 kv_cache_type: C8 + 逐层 scale 登记、建 scale/offset、替换 impl、只有非 producer 改 INT8、替换不受 producer 分支控制：PD 一节与「怎么开」。旧版「同名参数的其他快照开关逻辑可能不同」改为实际核对三版，结论是一致，写在「版本差异」。✓
- F14 GQA C8 + MooncakeConnector 被拒、指向逐层连接器、不构成 GLM/PD 实测证据：PD 一节第二段、报错表第 2 行。✓
- F15 评估要比质量、容量、临时内存峰值、prefill/decode 延迟；本页无实测：「开销和什么时候别开」最后一条。✓
- F16 旧图（BF16 与 INT8 两组 K/V、50 KiB / 25 KiB + 元数据）：同名图改成流程图，字节数挪进第 3 节 calc；「写入时量化、scale/offset」保留在流程图第 2 步。✓

### 验证

- `pnpm wiki:lint`：通过（另有 14 处待留意，均为别页的 mark-flood，本页 0 条）。首轮运行时别页有 4 处 relation-duplicate 报错（engine-processes、vllm-engine-core、vllm-scheduler），后来的运行已通过，未处理。
- `pnpm wiki:diagrams`：两张本页图生成成功，无越框、无重叠报错；`--check`：241 张图与 spec 一致。
- `pnpm wiki:audit`：通过；本页 29 条来源行号全部有效。
- 写作标准自测（本页未入名单，用 scripts/wiki/standard.ts 的 checkStandard 单独跑）：正文 4,099 字，行内代码 0，正文角标 0，calc 3（0.73 / 千字），免责句 0 / 115，直觉图先于 calc，五个源码 H3 顺序正确，无超宽图，无表格与 calc 相邻：无问题。
- 未截图、未起服务（按派发说明，浏览器验收留给审查环节）。

### 疑点 / 待核

- 「读回只乘系数 → 实际要求偏移为 0」是按两条读路的代码推出的（[I]），需要一份已发布 C8 权重包核对偏移是否全为 0。
- 1,152 token 的逻辑块是把定块规则代入 1 字节的推算；固定版本 GLM 走不到这条路，审查时请确认读者不会把它当部署数字。
- main 上 GLM 主缓存改走上游 MLA 封装，精度是否仍固定 BF16、能否接 FA 量化，没有核。
- 部署权重包的 quant_model_description.json 本机没有，不能从文件本身排除缓存量化条目（源码三处已把 GLM 主缓存定为 BF16）。
- 没有读：HANDBOOK、docs/plans/、TERMS 全文（只 grep 了单行）、codex-p5-common.md（按派发要求）。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审未改页面）。对象：wiki/concepts/kv-cache-quantization.md 现版（工作区未提交）。

### 结论

- **分数：8.0 / 10**。P1 0 条，P2 2 条，P3 8 条。
- **学习顺序：通过。** 是什么（50–60 行，一句话定义 + 直觉图）→ 为什么需要与三处代价（62–82）→ 示意数演算（84–120，两个 calc）→ 读取分阶段、页与整卡、Ascend 三条路、PD 两端（122–170）→ GLM 双机（172–199）→ 常见误解（201–209）→ 对照源码（211 起）。GLM 数字没有进基础节。
- **「未启用」已核实。** db701c1f：`ops/indexer_kpool_mla.py` 74–76 主缓存 dtype 写死 bfloat16；`attention/indexer_kpool_mla_v1.py` 562–575 构造时把 `use_sparse_c8_indexer / use_sparse_c8_sfa` 置 False、`c8_enable_reshape_optim` 报错；`platform.py` 504–505 有 `index_topk` 的模型把 cache_dtype 改回模型精度；01 第 262 行核过部署教程里 `--kv-cache-dtype` 出现 0 次，01 第 848 行写明本部署没有 `kv_transfer_config`。另外补一条页面没写的理由：非 A5 设备上 FA 量化只在 KV consumer 上生效（见 P2-1），本部署不是 PD，这条路本来也走不到。页面没有虚构部署数字，GLM 主线数字（13,056 B 等）都标为现状 BF16，1,152 token 的推算 calc 标题和正文都写了「假设推算，不是部署状态」，没有当成量化效果。
- **与 mla / kv-cache / quantization 三页口径一致。** 「量化的是什么」：本页 54、186 行说 MLA 压潜向量，与 mla 页 204–216 行（潜向量 512 维、RoPE 段 0 维、主缓存 BF16）一致，与 02 第 32、500 行 `qk_rope_head_dim=0`、`head_size=512` 一致。写入公式与 quantization 页 74–90 行的口径一致（零点 = 整数偏移；对称时 z = 0；本页 calc 取偏移 0，除以 s 与「乘系数的倒数」等价）。三页都是一句话 + 链接，没有重讲整节；唯一偏重复的是 102 行（见 P3-3）。
- **注水：** 正文约 4.1 千字，没有成段注水；W8A8 与缓存是两件事、误差留在缓存里、反量化不只看前缀命中这三点在正文和常见误解各出现一次，属于误解节正常复述。

### 初学者测试（只读前两屏）

KV cache 量化就是把缓存里每个历史位置的 k、v（MLA 里是那条潜向量）写入时压成 8 位整数、读的时候乘回系数；同样的显存能多存约一倍历史，decode 每步读的字节也减半；代价是写入时的误差会一直留在缓存里、读的算子要认得系数、系数要事先离线定好。——能说清。

### 核心概念逐条（对照 vllm-ascend db701c1f，除注明外）

| 页面行 | 说法 | 判定 | 证据 |
|---|---|---|---|
| 86、133 | 写入 = 乘系数倒数、加偏移、舍入、截到 −128…127 | 对 | attention_v1.py 1744–1753 |
| 104 | 系数可细到 KV 头 × 头内维度，TP 按 KV 头切 | 对 | attention_v1.py 1655–1682 |
| 137 | decode 直接读分页 INT8，只传 antiquant scale | 对 | attention_v1.py 1756–1791 |
| 136、150 | prefill 接历史：gather、掩码、乘系数，临时张量按最长块表补齐 | 对 | attention_v1.py 1685–1731 |
| 141 | 按块读回只乘系数，不分页旁路先减偏移 | 对（「要求偏移为 0」是推断，已标 [I] 并进待核） | attention_v1.py 1729–1730、1931–1933 |
| 147 | block size 须为 32 的倍数（含 chunked prefill 里的 decode 部分） | 对 | attention_v1.py 1765、1812 附近 |
| 160 | C8 由 kv_cache_type: C8 + k_proj.kv_cache_scale 登记 | 对 | modelslim_config.py 962–981 |
| 161、164 | FA 量化：A5 FP8、其余 INT8；MLA 只压 K（潜向量） | 对，但漏了生效条件 | modelslim_config.py 770–779、745–754；quantization/utils.py 217–226；见 P2-1 |
| 162 | 稀疏 C8 把 kv_lora、k_rope 与 per-tile scale 打包进 kv_cache[0] | 对 | core/kv_cache_interface.py 54–71 |
| 164 | MLA 缓存 K 侧 = 潜向量、V 侧 = RoPE 段 | 对 | worker/model_runner_v1.py 3978–3988 |
| 168 | 只有非 producer 建 INT8，producer 仍 BF16 但换 C8 impl | 对 | methods/kv_c8.py 108–132；attention_v1.py 1610–1627 producer 走普通 forward_impl |
| 170 | GQA + C8 + MooncakeConnector 启动报错，指向 Layerwise | 对 | ascend_config.py 348–371 |
| 178–180 | GLM 三处把缓存精度定死 | 对 | 见上「未启用」 |
| 190–197 | 定块规则按缓存 dtype 字节算 token 页大小；代入 1 字节得 1,152 | 对 | patch_mamba_config.py 83–86、112–131（attn_token_page_size = (kv_lora + rope) × heads × dtype_size） |

### 数字核对

- 示意 calc 逐个手算：80 / 80.48→80 / 136→127；读回 1.0、1.0（差 0.006）、1.5875（差 0.1125）；范围 −1.6…1.5875；1.7 ÷ 127 ≈ 0.0134、半格 ≈ 0.0067；50 KiB / 25 KiB / 4 页 128 位置 / 64 KiB / 32 KiB；末页 4 用 28 空；系数 4 × 128 = 512。全对。
- 66 行 512 MiB、8 GiB 与 kv-cache 页 151–153 行一致，只引用不重算。
- GLM：13,056 B、12,288 B、768 B、12 层、索引器尾状态 FP32 与 02 §1.4（142–150 行）一致；561,152 B、640 与 D 页 191–200 行一致；12 个 KDA 块号与 D 页 241 行一致；index_topk 2,048 与 02 第 33 行一致；ceil(561,152 ÷ 65,536) = ceil(8.5625) = 9、128 × 9 = 1,152 正确。
- 写手自报疑点：①偏移为 0：代码核实两条按块读路确实只乘 scale（注释 symmetric），推断成立，仍需权重包佐证，保留待核；②1,152 不会被误读：calc 标题、正文末句、常见误解都有「推算 / 不会变成 1 字节」的限定，可以；③main 上 GLM 主缓存精度未核：页面以固定版本为准，表里已标「主缓存改由上游 MLA 层建」，可以留待核。

### 丢信息核对

基线 `git show p4-checkpoint:wiki/concepts/kv-cache-quantization.md`（旧版 5 个 H2）与信息清单 F1–F16 逐条对照新版：全部还在，写手勾选属实（F9 的「量化元数据」改写成 512 个系数与偏移，经 attention_v1.py 1655–1682 核实；F13 的「其他快照可能不同」改成三版实核一致，C8 部分属实，FA 量化部分见 P2-2）。

### 链接与锚点

- `pnpm wiki:lint`：通过（14 处待留意均为别页 mark-flood，本页 0 条；跨页锚点硬校验通过）。
- 全库入链：kv-cache 162 行、quantization 40/217 行、kv-cache-spec 112 行、vllm-kv-block-allocation 113 行、learning-guide 66 行、index.md 70/170 行、params/c8-enable-reshape-optim 24 行，均不带锚点，全部能解析。
- 浏览器点击：「后面一节」「后文」跳到本页对应 H2，「存一份要多少」跳到 kv-cache 页对应 H2，目标元素都存在。

### audit

`pnpm wiki:audit`：通过（ok wiki:audit）；本页 evidence=C、章节 11、正文 13,890 字 / 9 节、来源 29 条。

### 浏览器实测（Playwright，1440 × 900，用户预览 http://localhost:5193，未起停服务）

- 截图：scratchpad `kv-cache-quantization-review-screen1.png`（第一屏）、`-fig1.png`（直觉图）、`-fig2.png`（读写流程图）、`-calc1/2/3.png`（三个 calc）。
- 2 张图宽 1032、scrollWidth 1032，无横向溢出；页面无 pageerror；没有未渲染的 `**`；第一屏是问题式 H2 + 加粗一句话 + 直觉图顶部。
- 直觉图：BF16 4 块、INT8 8 块，INT8 每格半宽，看得清；流程图六步编号与正文 132–137 对应，虚线「浮点那份留给本步」只连到第 4 路，与源码一致。

### 问题清单

**P1：0 条。**

**P2-1　FA 量化漏了生效条件（161 行表格、164 行、对照源码「怎么开」217 行、GLM 一节）**
- 问题：页面写「A5 上压成 FP8，其余设备（如本部署的 A2）压成 INT8」，读者会以为普通 A2 部署写上 `fa_quant_type` 就能压缓存。固定源码里非 A5 设备只有 KV consumer（PD 分离的 decode 端）才生效：`quantization/utils.py` 217–226 非 consumer 且非 A5 直接返回 False，`modelslim_config.py` 745–754 的 `enabling_fa_quant` 在非 A5 上还要求是 decode 实例。三个对照版本都这样（2c59ff10、2ed6cbba 的 utils.py 218–219；baa023ad 改成按硬件能力 FP8_ATTENTION 判断）。
- 影响：核心机制的适用范围讲宽了；而且本部署没有 `kv_transfer_config`（01 第 848 行），这正是 GLM 走不到 FA 量化的又一条理由，页面没写。
- 改法：表格 FA 量化一行补「A2/A3 上只在 PD 分离的 decode 端（KV consumer）生效，A5 上都生效」；164 行或「怎么开」补一句出处；GLM 一节「三处代码把缓存精度定死」后补一句「FA 量化在 A2 上还要求实例是 KV consumer，本部署不是 PD」。

**P2-2　版本差异漏了 main 上 FA 量化的新门槛（242–253 行）**
- 问题：版本差异写「三个对照版本……差别在文件位置、带索引器模型的缓存精度改写、有没有 GLM 代码」。实际 main（baa023ad `quantization/utils.py` 267–273）的 `enable_fa_quant` 先要求 `cache_config.cache_dtype` 是 fp8 或 int8，也就是 main 上 FA 量化还必须同时传 kv-cache-dtype；设备判断从「是不是 A5」改成硬件能力 FP8_ATTENTION。164 行「三条路的开关都不在上游 vLLM 的 kv-cache-dtype 选项上」只对固定版本和 v0.26 成立。
- 影响：按 main 配置的读者照本页只写描述文件，FA 量化不会生效。
- 改法：版本差异表加一列或一行写 main 的 FA 量化条件；164 行那句保持「固定版本」限定，并加「main 上 FA 量化另要求 kv-cache-dtype 为 fp8/int8，见版本差异」。

**P3**
1. 60 行与直觉图注脚写「系数每层一套」，120 行和源码是 k、v 各一套（另各配偏移）。改成「每层 k、v 各一套」。
2. 86 行加粗句「本页主讲的实现给每一维各配一个系数」说死了；源码也接受单个标量系数（attention_v1.py 1656–1657 `numel() == 1` 分支）。改成「最细可以每一维一个」，与 104 行「可以细到」一致。
3. 102 行把 quantization 页 78 行的「半格误差、范围 −128s…127s、s = 最大绝对值 ÷ 127」又讲了一遍。保留本例的两个数（0.00625、0.0067），其余一句话链接到量化页即可。
4. 130 行和流程图顶部「开了 C8 时：主线第 4 站」：主线是 GLM，而 C8 只给普通 attention（GLM 是 KDA + 稀疏 MLA），GLM 不是「没开」而是走不到。改成「在普通 attention 模型上开 C8 时，这一段对应主线第 4 站 attention 的位置（GLM 不走这条路）」。
5. 134–136 行按「这条请求」讲 prefill 分路；源码 chunked prefill 是整批判断（attention_v1.py 1842–1860 `all_new_prefill`）：同一批里只要有一个 prefill 要接历史，这一批所有 prefill 都走收拢展开，而且收拢的内容包括刚写进去的新位置（也是 8 位近似值）。补一句即可。
6. 术语先用后讲：GQA（160 行）、A5（161 行）、「FA 量化」这个名字的来历、KDA（190 行未链接）、MTP（186 行）。各补半句解释或链接（KDA → linear-attention）。
7. wiki/index.md 70、170 行仍是旧标题「缓存量化：写入、读取与容量边界」，与新标题不一致；由主会话同步。
8. 208 行「测试里有 GLM-5.1、GLM-5.2 的 W8A8C8 多机配置」没标版本：这些配置在 2c59ff10、2ed6cbba、baa023ad 有，固定镜像 db701c1f 里只有 GLM-4.7-W8A8C8；GLM-5.2 在部分版本是 W4A8C8。补版本范围。

### 本次跳过 / 读取范围

- 未读 frontmatter 来源区（1–48 行）、HANDBOOK、docs/plans/、TERMS 全文。
- 「对照源码」只 grep 核五个 H3 顺序（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置，齐全且顺序正确）与版本号（v0.23、v0.26、main 均出现）；为核 F13、F15 与 P2-2，读了 215 行、234–253 行，其余正文未读。
- 没有读取被拦的段落。

## P5 修订记录（09-29，Opus 5.5，按「P5 审查（09-29）」修订）

### P2（2 条，都已修）

- **P2-1 FA 量化的生效条件：已修。** 核实 db701c1f `quantization/utils.py` 215–224：非 A5 且不是 KV consumer 时 `enable_fa_quant` 直接返回否；`modelslim_config.py` 745–754：非 A5 时逐层还要求是 decode 实例（consumer 且不是 producer）。2c59ff10、2ed6cbba 的 utils.py 217–220 写法相同。改动：三条路表格 FA 行补「A5 所有实例生效；A2、A3 压成 INT8，只在 PD 分离的 decode 端生效」；表后段落补「普通部署在描述文件里写了它也不会压缓存」；GLM 一节补「FA 量化在 A2 上只对 PD 分离的 decode 端生效，这套部署没有做 PD 分离」；「怎么开」补两道门槛；源码位置表加 utils.py 一行；sources 新增第 30、31、33、34 项。
- **P2-2 main 上 FA 量化的新门槛：已修。** 核实 baa023ad `quantization/utils.py` 267–284：先要求 `cache_config.cache_dtype` 为 fp8 或 int8，设备判断改成 `HardwareCapability.FP8_ATTENTION`，量化配置里没有 FA 条目时抛 ValueError。改动：表后那句限定为「在固定版本里」并补「main 上另要求 kv-cache-dtype 设成 fp8 或 int8，见版本差异」；版本差异表新增「FA 量化的生效门槛」一列；「怎么开」补 main 的检查；报错表新增 main 专有的一行；sources 新增第 32 项。

### P3（8 条：修 7 条，1 条不在本页范围）

1. 「系数每层一套」→ 正文、直觉图注脚与图内文字改成「每层 k、v 各一套」；三条路表格 C8 行同改，FA 行与常见误解改成「每层一组」。已修。
2. 加粗句改成「系数最细可以每一维一个」（attention_v1.py 1656–1657 的 `numel() == 1` 分支允许单个标量）。已修。
3. 删掉与量化页重复的「半格、−128s…127s」推导，只留本例的 0.00625、1.5875 上限与 0.0067，取舍一句链接到量化页。已修。
4. 流程图顶部改成「普通 attention 开 C8 时：主线第 4 站」；正文改成「在普通 attention 模型上开 C8 时，这一段对应主线第 4 站里 attention 的位置……GLM 的 attention 是 KDA 和稀疏 MLA，不走这条路」。已修。
5. 核实 attention_v1.py 1840–1869 的 `all_new_prefill` 按整批判断：补一句「一批里只要有一条 prefill 要接历史，这一批所有 prefill 都走第 5 步；收拢的内容也包括刚写进去的新位置，读回来同样是 8 位近似值」。已修。
6. 术语：GQA 补链接与半句解释；A5 补「另一代昇腾设备」；「FA 量化」补名字来历（取自 fa_quant_type 键）；KDA 链到 linear-attention 并注「GLM 用的线性 attention」；MTP 链到 speculative-decoding 并补半句解释。已修。
7. wiki/index.md 旧标题：不在本页范围（写手只改本页与它的图），未改，留给主会话同步。
8. 核实各版本 tests 目录：db701c1f 只有 GLM-4.7-W8A8C8；2c59ff10 有 GLM-5.1-W8A8C8 与 GLM-5.2-W4A8C8；2ed6cbba 有 GLM-5.1、GLM-5.2 的 W8A8C8；baa023ad 两种都有。常见误解那条补上版本范围。已修。

### 验证

- `pnpm wiki:lint`：通过，本页 0 条（另有 14 处待留意，均为别页）。
- `pnpm wiki:diagrams --check`：241 张图与 spec 一致；本页两张图无越框、无整句提示。
- `pnpm wiki:audit`：通过；本页来源 34 条，行号全部有效。
- 写作标准自测（checkStandard）：正文 4,397 字，行内代码 0，正文角标 0，calc 3，免责句 0 / 119，无问题。来源对应的角标 22 处，其中 C 17 处（77%）。
