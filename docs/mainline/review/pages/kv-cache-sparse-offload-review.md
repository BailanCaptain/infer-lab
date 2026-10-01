# kv-cache-sparse-offload 页审查记录

## P5 写作记录（2026-09-29，深改，第 15 批）

**改了什么。** 全页重写：正文 4.8 KB → 10.6 KB（`pnpm wiki:audit` 计 10,609 字 / 9 节 / 17 条来源）。旧版是「稀疏读取创造机会 → 设备上不只有热 KV → 两次访问 → 容量流量 → 实现条件」五节的机制罗列，读者不知道这东西为什么存在、一步里到底发生什么。新版按讲法排序：问题式开篇 + 一句话定义 + 8 位置 / 4 槽的直觉图 → 为什么不整层搬（decode 算得少，藏不住搬运）+ 代价四笔 + 与 CPU offload / 抢占换出的对象·粒度·取回条件对照表 → 示意数演算（命中 / 缺失 / 换出 / 槽号重映射，配 calc）→ 一步 decode 的顺序（新增流程图）→ 设备上还剩什么 → 池子三条上限 → GLM 双机（未启用，四道门槛 + 热缓冲显存 calc）→ 常见误解 → 对照源码五节。

**本批验收要点。**
- **缓存池与换出区分对象、粒度和恢复条件**：「为什么不整层搬回来」一节的四列表（Sparse KV offload / KV cache CPU offload / 抢占卸载）逐行给出「主机上存什么、设备上还有什么、一次搬多大、什么时候搬回」，并在表后点明关键区别——CPU offload 是多存一份（显存那份还在，省重算），稀疏卸载是搬走（设备不为主 KV 开空间，省显存），所以它每一步都必须把本步选中的行搬回来，没有「不命中就重算」这条退路。
- **吞吐和时延缺证据处明列待核**：全页不给任何吞吐/时延结论。页末待核列出命中率（决定实际搬运量，源码无统计口径、主线无实测）、主机到设备有效带宽与单步耗时、GLM-5.3-Flash 是否进支持清单、混合布局放开后 5 个缓存组如何对齐、两条路径浮点是否逐位一致。官方 RFC 只说「有潜力显著提高序列长度或并发」，正文照实转述并注明随模型/硬件/配置而变。

**直觉图。**
- `wiki/diagrams/kv-cache-sparse-offload.yaml` 重画（900×396，三帧）：① 上一步之后（主机 8 行、热槽装 0/2/4/6、LRU 顺序 0→4→2→6）→ ② 这一步选中 2、5、6（2、6 命中，5 缺失）→ ③ 只搬 1 行（5 顶掉 0，箭头从主机位置 5 指向槽 0）。图上只留 8 段短语，说明句挪回正文。
- 新增 `wiki/diagrams/kv-cache-sparse-offload-step.yaml`（880×640）：一步 decode 的七步纵排流程（写主机 → 打分选位置 → 查槽表 → 挑槽 → 只搬缺失行 → 位置号换槽号 → 读热缓冲算 attention），旁注标出哪一段在主机侧算、哪一段是 H2D。
- `pnpm wiki:diagrams` 对这两张图 0 警告；`--check` 只有别的写手在改的 `recompute-cpu-offload.svg` 不一致。

**数字取自哪。**
- 每个位置每层主 KV = 1,024 B、12 层（11 稀疏 MLA + MTP）、13,056 B/token、133,120 最长上下文：底稿 02 §5.6，正文只做 13,056 = 12,288（主 KV，搬去主机）+ 768（indexer，留设备）的拆分，不重推，并回链部署页「占住一个块号，要用多少显存」。
- index_topk = 2,048、每查询 2 MiB/层的读取上界：底稿 02 §5.4–5.5，正文回链 sparse-attention 页，不重算。
- 8,192 token 预算 / 32 并发 / MTP 每步 4 个 token / block_size 640：部署前提与底稿 02 §0.2。
- 热缓冲 3.75 GiB/卡、最小可用 topk_buffer_size = 2,560、一步最坏搬 3 GiB：把上面这些代入源码里的公式（`allocate_kv_offload_topk_buffer_pair` 的 `min(max_num_batched_tokens, max_num_seqs × decode_width) × topk_buffer_size × kv_lora_rank × 2 B`、`topk_buffer_size % block_size == 0`），标成 [D]。
- 示意数演算（8 位置、4 槽、一行 1 KiB）不用任何 GLM 数字，按基础页标准放在 GLM 之前。
- 底稿 01 §B3 的抢占账只用于对照表「抢占卸载」那一列的定性描述，没有搬进本页做数字。

**核心概念对照了什么。**
- 配置与全部前置检查：`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py` L1466–L1533（字段、`index_topk` / `compress_ratios` / CP / PP / kv consumer / v2 runner / `topk_buffer_size ≥ topk`）、L862–L869（与 sparse SFA C8 的冲突）。
- 开关如何换实现：`attention/sfa_v1.py` L284–L311；规格标「放在主机」：`worker/model_runner_v1.py` L5878–L5890。
- 一步 decode：`attention/sfa_kv_offload.py` L346–L393（新行直接写主机池）、L196–L224（热槽数必须被 block_size 整除、行数上限）、L1001–L1156（掩掉越界位置 → 取常驻视图 → onload → 用槽号跑 SFA）。
- 命中 / 缺失 / 换出 / 槽号重映射的真实规则：`csrc/torch_binding.cpp` L2266–L2400（`process_one_lru_resident_row`：只从本步未选中的槽里按 LRU 换出、`assign_count = min(缺失数, 可换出数)`、行换请求就清空、超出稳定前缀的槽作废）。正文「热槽数必须不小于一次选中的位置数」这一条就是从这里推回配置检查的。
- 搬运入口与 TP 同步：`sparse_kv_offload_manager.py` L1215–L1337（计划在主机侧算、TP 广播后各卡各自 H2D）、L213–L297（设备/主机/工作负载三条上限取最小 + 2 MiB 对齐预留）、L107–L140（热缓冲字节公式）。
- 官方说法：main 的设计文档 L154–L193（内存布局与 decode 七步）、用户指南 L12–L22（支持 GLM-5.1 / GLM-5.2 / DeepSeek-V3.2）与 L211–L282（decode 启动项、参数表、限制清单）。
- 版本谱系：v0.23 维护分支 2c59ff10 与 GLM 快照 db701c1f 的文件清单里没有 `sparse_kv_offload/`，也没有 `sfa_kv_offload.py`（标 [I]，按仓库文件清单）；v0.26 2ed6cbba 有整套但没有 `use_fused_overlap`，配置是普通类、多写的键静默忽略（L1042–L1090），内存按主机/设备页字节比校验并把省下的显存加回（`worker/worker.py` L618–L636）。

**启用与否的核实。** 本部署（GLM-5.3-Flash 双机）**没有启用**，且按钉住版本源码开不起来，四道门槛都写进正文：① 主线启动命令没有 `--kv-transfer-config`，不是 kv consumer，`keep_device_kv_cache=false` 时直接 `AssertionError`；② 官方支持清单里没有 GLM-5.3-Flash；③ 设计文档写明不支持混合缓存布局，源码里 `_split_host_device_kv_specs` 要求各组共用一个 block_size，GLM 的尾状态组不是 640（标 [I]，未实跑）；④ 默认 `topk_buffer_size = 4096` 除不尽 640，照抄启动失败（标 [!]），最小可用 2,560（标 [D]）。GLM 用稀疏 MLA 只过了「模型带 `index_topk`」这一道，正文在常见误解里专门写了这一条。

**旧版信息清单勾选**（清单存于 scratchpad `p5/kv-cache-sparse-offload-facts.md`，F1–F18）。
- F1–F2（稀疏读取的空子、卸载改的是数据放哪不是选谁）→ 第 1 节，保留。
- F3（main 快照、默认非融合路径、GLM 基线没有同一套实现）→ 拆到「怎么开」（默认路径 + 参数页链接）与「版本差异」（前两列没有这套实现）。
- F4–F6（三类数据、indexer 留设备、工作区行数考虑 token 预算/并发/推测 token 数）→「设备上还剩什么」一节，表格 + 行数口径，保留。
- F7–F9（两次访问的算例、onload 与 resident buffer、跨步重合度不可保证）→ 第 3 节演算，算例从「8 位置 / 4 槽 / 选 2」扩成「选 3」以便演出「换出谁」，结论不变。
- F10–F11（61 层同构算例：512+64 维、1,152 B、热缓冲 8.58 GiB、全未命中 4.29 GiB）→ **删除并替换**。理由：旧算例自己写着「不是 GLM 形状」，`512 + 64` 是 DeepSeek-V3.2 的 `kv_lora_rank + qk_rope_head_dim`，而 GLM 的 `qk_rope_head_dim = 0`（底稿 02 §0.2、§5.6），每位置每层是 1,024 B 不是 1,152 B；61 层、每请求每层 4,096 槽、每步 2,048 行这些数既不在底稿也不在源码配置里，属于无出处的自造算例。新版改为：基础节用与 GLM 无关的示意数（一行 1 KiB），GLM 节用底稿的 1,024 B 与源码公式算出 3.75 GiB / 1.52 GiB / 3 GiB，字节账的教学作用保留且口径可核。
- F12（按页分配与对齐、三条上限、上下文仍受设备索引缓存制约）→「池子能开多大」一节，保留并补上三条上限各自的算法与 warning。
- F13（index_topk、热缓冲下限、PCP/DCP/PP=1、拒 compress_ratios 与 v2 runner、kv consumer、keep_device_kv_cache 调试路径）→「会报什么错」表 + GLM 四道门槛，逐条保留，并补上报错原文。
- F14（TP 组内主存归属，不能逐 rank 相加）→「设备上还剩什么」末段 + 「怎么开」的 `dram_size_per_dp_GB` 说明。
- F15（`use_fused_overlap` 是另一条分支，本页算例不代表它）→「怎么开」最后一条，链接参数页。
- F16（热缓冲/主存池的取舍、选中集合变化大时接近全未命中）→ 第 2 节代价四笔 + 「开销和什么时候别开」。
- F17（必须提供本步全部选中数据、浮点是否逐位一致、未验证 GLM 共同运行、无硬件性能结果）→ 第 3 节「不能省掉本步选中但还没到设备的行」+ 页末待核（浮点逐位一致、GLM 支持清单、无实测）。
- F18（aliases、relations）→ aliases 原样保留；relations 在原有两条之外增加 kv-cache-cpu-offload（alternative-to）与 pd-disaggregation（builds-on）。

**验证。** `pnpm wiki:lint` 本页 0 报错（全库「通过（另有 10 处待留意）」，都在别的页）；`pnpm wiki:audit` 本页 17 条来源行号全部有效、文件存在、commit 有效；写作标准逐项自测（用 `measureStandard`）：行内代码 1.24/千字（上限 13）、正文角标 0、calc 0.62/千字、免责 1.9%（上限 3%）、图宽合规、无相邻表/calc，`standardProblems` 返回空。`pnpm wiki:diagrams` 重新生成两张 SVG，本页 0 警告。未起服务、未截图，浏览器验收留给审查环节。

**跳过了什么。** 未读 HANDBOOK 与 docs/plans；未读 `sfa_kv_offload.py` 的 `_execute_fused_overlap_offload_decode`（融合路径，参数页已有专页，本页只给链接）；`sparse_kv_offload_manager.register_kv_caches`（L727–L1076）只看了 TP 归属与 pin_memory 相关的行，没有通读；未实跑任何命令验证报错文案，报错原文取自源码字符串。

## P5 审查（09-29）

审查员：独立审查（只审不改）。基线：工作区现版（HEAD 94e94b3 之上未提交），对照 `p4-checkpoint` 旧版与写手信息清单 F1–F18。

**分数：6.5 / 10**（P1 2 条、P2 6 条、P3 5 条）。

**学习顺序：通过。** 问题式 H2 + 一句话定义 + 两个前置词 + 直觉图 → 为什么不整层搬 + 代价四笔 + 三种「放到主机」对照 → 示意数演算 → decode 七步 → 设备上还剩什么 → 池子三条上限 → GLM 双机 → 常见误解 → 对照源码。基础节里没有 GLM 数字，示意数与 GLM 分开。

**初学者测试（只读前两屏）。** 「它把主 attention 的全部历史搬到主机内存，设备上只留一小块热缓冲；每步 sparse attention 选完位置，只把热缓冲里缺的那几行搬回来。代价是搬运挡在每一步的关键路径上、主机要开一大块锁页内存、显存多一笔定额热缓冲，省多少全看相邻两步选中的位置重合多少。」能说出来，通过。

**示意数逐项手算（对照 `vllm-ascend@baa023ad:csrc/torch_binding.cpp` L2266–L2400 `process_one_lru_resident_row`）。**
- 初态：槽 1–4 装 0、2、4、6；LRU 队列（旧→新）0、4、2、6。本步选中 2、5、6。
- 按 LRU 顺序扫槽（L2324–L2350）：槽 1（0）未选中→可换；槽 3（4）未选中→可换；槽 2（2）命中；槽 4（6）命中。可换 = [槽 1, 槽 3]，命中 = [槽 2, 槽 4]。
- 缺失（L2352–L2361）：只有 5，缺失 1 行。`assign_count = min(1, 2) = 1`（L2363），5 进可换队首槽 1（原放 0）。✓
- 槽号换算：2→槽 2、5→槽 1、6→槽 4。✓
- 新 LRU（L2382–L2394 = 未用掉的可换槽 → 新装的缺失槽 → 命中槽按原顺序）：槽 3（4）、槽 1（5）、槽 2（2）、槽 4（6），即 4、5、2、6。✓ 页面写法与源码完全一致。
- calc：全在设备 0 行 = 0 KiB；卸载无热缓冲 3 × 1 KiB = 3 KiB；有热缓冲 1 × 1 KiB = 1 KiB；省 2 行（2、6）= 2 KiB。✓
- 「槽数 ≥ 一次选中数」的推理：`assign_count = min(缺失, 可换)`，槽不够时缺失位置拿不到槽，对应 `ascend_config.py` L1529–L1533 的 `topk_buffer_size >= topk`。✓
- 下一步选 2、5、6 → 0 行；选 1、3、7 → 3 行。✓ 超出稳定前缀作废（L2331–L2335）✓。

**GLM 数字逐项核。**
- 热缓冲：min(8,192, 32 × 4) = 128 ✓（D 页 L81–L82）；2,560 × 512 × 2 = 2,621,440 B = 2.5 MiB ✓；× 128 = 320 MiB ✓；× 12 = 3,840 MiB = 3.75 GiB ✓。公式对上 `sparse_kv_offload_manager.py` L107–L137（K 维 = `kv_lora_rank` 512，V 维 = `qk_rope_head_dim`，GLM 为 0），每个卸载层一对（L145–L151）✓。
- 2,560：4,096 % 640 = 256 ≠ 0（`sfa_kv_offload.py` L207–L211 会报错）✓；640 的倍数里 1,920 < 2,048、2,560 ≥ 2,048 ✓。
- 1,024 B / 12,288 B / 768 B / 13,056 B 与底稿 02 §5.6 一致 ✓；133,120 × 12,288 = 1,635,778,560 B ≈ 1.52 GiB ✓；× 32 ≈ 48.8 GiB ✓；`dram_size_per_dp_GB` 默认 128，按 `1 << 30` 换算（manager L528）即 128 GiB ✓。
- 2,048 × 1,024 B = 2 MiB ✓；× 12 = 24 MiB ✓；× 128 = 3 GiB ✓。
- 以上都标成「假如放开」的推导，没有冒充实测，也没有把主线数字当成该特性的效果 ✓。

**核心机制对照源码（baa023ad）。** 配置默认值与前置检查 `ascend_config.py` L1466–L1533 ✓；SFA 后端换实现 `sfa_v1.py` L284–L311 ✓；decode 新行直写主机池、不写设备 `sfa_kv_offload.py` L346–L367 ✓；三条上限与 2 MiB 对齐预留、`_VLLM_NULL_BLOCK_COUNT = 1`、共用块大小检查 manager L162–L168、L213–L297 ✓；设计文档 L12–L26（decode 不能整层搬）、L44–L46（不支持混合布局、同机只是调试）、L154–L193（decode 七步、TP rank 0 写共享池）✓；用户指南 L12–L22（支持清单）、L251（keep_device_kv_cache 生产关）✓。v0.23 维护分支 2c59ff10 与 db701c1f 均无 `sparse_kv_offload` 文件（`git ls-tree` 计数 0）✓。融合路径：页面只说「`use_fused_overlap` 默认关、开了换另一条路径」（L199），`sfa_kv_offload.py` L17、L1035 可证；浮点是否逐位一致已列待核 ✓，没有无出处的融合路径说法。

**与相邻页口径。** 和 sparse-attention（2,048 + 0–3 尾部、indexer 选位置）、kv-cache-cpu-offload（多存一份、省重算）、recompute-cpu-offload（抢占那一刻整条请求换出）一致，没有重讲，都用一句话加链接带过。MLA 口径见 P2-3。

### P1

1. **GLM 双机一节漏了最硬的一道门槛：main 只支持 A3，本部署是 A2。** `vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py` L1652–L1653：`init_sparse_kv_offload_manager` 在设备类型不是 A3 时直接 `RuntimeError("Sparse KV offload is only support on A3")`；同文件 L96–L102 缺算子时提示「Rebuild vllm_ascend_C with Atlas A3 support」；main 用户指南 L25 写「A3 and 950PR&950DT Products are supported」。页面 L140 说「四道门槛」、L147 说「假如前三道都放开」，全页没有 A3/A2 字样；「会报什么错」列了 9 条报错，唯独没有这条；「版本差异」也没写 v0.26（2ed6cbba 的 `init_sparse_kv_offload_manager` 在 L1064，没有设备检查）到 main 新加了这条限制。旧版也没有，不算丢信息，但「为什么开不起来」的结论不完整，且漏的正是与本部署硬件直接相关的那条。**改法**：GLM 一节把硬件作为第一道门槛（2×A2×8 ≠ A3，启动时 RuntimeError），「四道」改「五道」、「假如前三道」相应改；报错表加这条和缺算子那条；版本差异加「main 新增只限 A3 的检查，v0.26 没有」；「开销和什么时候别开」的「别开」加「非 A3 硬件」；来源补上 L1652–L1653 与指南 L25。
2. **前置概念先用后讲。** `indexer` / `indexer cache` 在 L70（对照表）、L78（示意演算）就用了，直到 L120 才说它「给全部历史打分，选出这一步读哪些位置」；§1 只讲了 sparse attention「挑位置」，没有点出挑位置的是 indexer、它有自己的缓存。L159「潜向量在组内是复制的」——「潜向量」全页没解释、也没链 [MLA](mla.md)。L110「TP 组」「DP 组」「TP rank 0」没链 tensor-parallel / data-parallel，也没一句话说明。**改法**：§1 前置词段补一句「挑位置的是 sparse attention 里的一个小打分模块 indexer，它要给全部历史打分，所以自己也存一份 indexer cache」；L159 改成「MLA 存的是一条压缩后的潜向量（见 [MLA](mla.md)），TP 组内每卡一份相同的」；L110 首次出现 TP/DP 处各加链接和半句解释。

### P2

1. **「行」一词两义，热缓冲归属没讲清。** §2 表、§3、直觉图、常见误解第 3 条里「行」= 一个位置在一层的那条 KV；L121「一步最多几行 × 热槽数 × 每行字节」、L124「热缓冲的行数…是一步里最多有几个查询」、L151、L159「一行一层要搬 2,048 × 1,024 B」「一步 128 行」里「行」= 一个查询。L121 一个式子里两种意思并存。同时全页没明说「每个查询（一条请求这一步的一个 token）在每层有自己的一排热槽，槽不跨请求共享，这一排换给别的请求就清空」（`torch_binding.cpp` L2276、L2304–L2308），§3「热缓冲 4 个槽」读起来像一层共用一块。**改法**：查询那一维统一叫「查询行」或「查询」，「行」只留给位置；§3 开头加一句「这 4 个槽属于一个查询在这一层的那一排」；§5 补「换请求即清空」半句。
2. **第二张图脚注错：「下一层重复 ③–⑦」。** 每个稀疏 MLA 层都有自己的新 K/V 行要写（`sfa_kv_offload.py` L355–L367 按 `layer_name` 写主机池），也有自己的 indexer（底稿 02 §5.3：indexer 用本层权重和本层 q），所以下一层重复的是 ①–⑦，不是 ③–⑦。**改法**：改 `wiki/diagrams/kv-cache-sparse-offload-step.yaml` 的这句为「下一层从 ① 重来」，重新生成。
3. **MLA 口径：「每层一对热缓冲 K/V」（L121）没交代这一对是什么。** 源码里 K 维 = `kv_lora_rank`（潜向量），V 维 = `qk_rope_head_dim`（RoPE 段），不是 attention 的 K 和 V（manager L116–L117）；GLM 不带 RoPE，V 那一半为 0，所以 L152 只算 512 维。初学者按字面会以为 K、V 各 512。**改法**：L121 改成「每层一对：潜向量段 + RoPE 段（GLM 没有 RoPE 段，只剩前者）」，链 [MLA](mla.md#rope-为什么要另存一段)（锚点以 lint 为准）。
4. **GLM 一节的版本前提没先交代。** L140「按钉住版本的源码，它也开不起来」——GLM 真正跑的 db701c1f 快照里根本没有这套代码（页面自己在版本差异 L241 写了），四道门槛其实是「假如换到 main」才会遇到的。读者只看 GLM 一节会以为是在 GLM 的代码上逐条检查失败。**改法**：GLM 一节第一句说清「主线跑的快照里没有这套代码；下面是换到 main 后仍然过不去的几道」。
5. **「官方只说有潜力显著提高序列长度或并发」（L159）出处不在来源里。** 这句只出现在 v0.26 用户指南 `vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md` L18–L21（转述 RFC #48203 的实验），main 的指南已删掉；页面来源只列了 main 指南 L12–L22（支持清单），写作记录又说成「官方 RFC」。**改法**：补来源 2ed6cbba L18–L21，正文写成「v0.26 的用户指南转述 RFC #48203 的实验说…，main 的指南已不再写这句」。
6. **特性本身的通用前提第一次出现在 GLM 一节之后。** 「生产上只用于 PD 分离的 D 端，同机只剩调试路径」（设计文档 L44–L46）是这个特性的通用性质，不是 GLM 特有；现在 §1–§6 都没提，第一次出现是 GLM 门槛 1。按标准第 13 条，通用理解不能只在 GLM 之后。**改法**：§2 讲完「prefill 整层搬、decode 只搬选中行」后加一句「所以它按 PD 分离设计：P 端整层搬，D 端只搬选中的行；P、D 放在同一实例只有调试路径」，GLM 一节再引用。硬件只限 A3 同理放在通用处（与 P1-1 一起改）。

### P3

1. L136「三条里最常卡住的是主机上限」没有依据；源码只在主机上限小于设备上限时打 warning（manager L269–L279）。改成「主机上限比设备上限小时，实现会专门打一条 warning」。
2. L62「主机内存要按最大并发 × 最长上下文预先开满」与 §6 不一致：实际按设备、主机、工作负载三条取最小预先开好。改成「按三条上限里最小的那条预先开好」。
3. L165、L159「最坏 2,048 行」：GLM 每行清单容量 2,051（sparse-attention L139），最坏是 2,048 + 尾部 0–3。加半句即可。
4. L167「后面还有 PD 分离的 D 端、非混合缓存布局、Model Runner V1 等几道，见上一节」——上一节没有 Model Runner V1；要么在 GLM 一节补一句「GLM 主线用 V1，这道能过」，要么删掉「见上一节」。
5. 旧版 F11 的限定语丢了：3 GiB 只是字节账，不含主机侧访问、地址计算、TP 同步与链路争用。L159 补半句。

### 其他核对

- **丢信息**：整页重写，按 F1–F18 逐条对照新版，勾选属实。F10–F11 的 61 层算例删除理由成立（DeepSeek-V3.2 形状，底稿里没有），字节账的作用由 GLM 推导替代；F11 的限定语见 P3-5。
- **链接与锚点**：`pnpm wiki:lint` 通过，本页 0 条；页内 11 个链接全部可解析（含 `glm-5-3-flash-two-node.md#部署前提` / `#怎么开` / `#占住一个块号要用多少显存`、`kv-cache-spec.md#对齐成两档页编成五个组`、`sparse-attention.md#稀疏什么时候才真的起作用`）；全库指向本页的 6 处都不带锚点。
- **`pnpm wiki:audit`**：本页通过（17 条来源行号全有效，写作标准无 x）；全库唯一失败是 `concepts/kv-pool.md` 免责句 4.4%，与本页无关。
- **图**：`pnpm wiki:diagrams --check` 通过，257 张图与 spec 一致，本页两张 0 警告。「顺带重生成的别页 SVG」：写作记录里 `--check` 唯一不一致的是 `recompute-cpu-offload.svg`，全量生成会顺带重写它，最可能就是这张；现 svg（11:44:59）晚于 yaml（11:44:48），check 一致。其余改动过的图 svg 与 yaml 也全部一致。
- **分镜**：两张图都是静态分格 figure，没有新增分镜。
- **meta 文本**：无。
- **截图**：5193 前端在，8790 后端未起，页面数据请求 502，整页白屏（`kv-cache-sparse-offload-review-1.png` 为空白），按规定不起服务；改为直接渲染两张 SVG：scratchpad `kv-cache-sparse-offload-review-fig1.png`（三帧与演算完全对得上）、`-fig2.png`（七步纵排，发现 P2-2）。

**跳过**：frontmatter 来源区；「对照源码」正文只 grep（五个 H3 齐全、顺序正确，版本差异含 v0.23 / v0.26 / main）；代码块；整页浏览器截图（后端未起）；`_execute_fused_overlap_offload_decode` 正文；refs 图库（本页不涉及通信原语、TP/DP/EP）。

## P5 修订记录（09-29，写手回修）

**P1-1（A3 门槛）已核并修。** 到钉住版本 grep 核实：`vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py` L1652–L1653 `if get_ascend_device_type() != AscendDeviceType.A3: raise RuntimeError("Sparse KV offload is only support on A3")`，在 `init_sparse_kv_offload_manager`（L1645–L1663）里，比配置检查更晚；同文件 L90–L104 缺算子时报 `Rebuild vllm_ascend_C with Atlas A3 support`；main 用户指南 L25「A3 and 950PR&950DT Products are supported」；v0.26 的同名函数（2ed6cbba L1064–L1078）没有这道判断，`AscendDeviceType.A3` 在该文件里 0 次出现。据此改了六处：① §1 结尾加「先说结论：只在 Atlas A3 上初始化，本部署是两台 Atlas 800 A2，用不上它，本页当变体讲」；② §2 把「只在 A3 上跑」和「按 PD 分离设计」一起写成特性的通用前提（同时解决 P2-6）；③ GLM 一节把硬件提为第一道门槛，「四道」改「五道」、「假如前三道」改「假如前四道（换 A3 机器、按 PD 分离部署、模型进清单、缓存布局对齐）」；④ 「怎么开」开头先讲硬件前提 [C20][C18]；⑤ 「会报什么错」补 A3 与缺算子两条报错原文 [C18][C19]；⑥ 「版本差异」加「硬件限制」一行（v0.26 不判、main 直接 `RuntimeError`）[C23]，「别开」加「硬件不是 A3（本部署的 A2 即在此列）」[D]，「源码位置」加 L1645–L1663、L90–L104。结论按变体写：本部署用不上，没有为它编任何效果数字。

**P1-2（前置概念先用后讲）已修。** §1 前置词段补 indexer 是什么（sparse attention 里很轻的打分模块，给全部历史打分、取分最高的若干个，因此自己也存一份 indexer cache，与主 attention 的历史是两码事）；§5 把「每层一对热缓冲 K/V」改成一对是潜向量段 + RoPE 段并链 [MLA](mla.md) 与 `mla.md#glm-的这一配置不保存-rope-段`（同时解决 P2-3）；§7「潜向量在组内是复制的」改成「MLA 的潜向量在 TP 组内每卡各存一份相同的，不按卡切」并链 MLA；§5 首次出现 DP / TP 处各加链接和半句解释。

**P2 六条全修。** P2-1：查询那一维统一叫「查询行」（§5 表格、行数口径、§7 calc 与搬运量段），「行」只留给位置；§3 开头写明「这 4 个槽属于这个查询在这一层的那一排，一排槽跟着一个查询走，不同请求不共用」；§5 补「这一排换给别的请求时整排清空，重新攒命中」。P2-2：`kv-cache-sparse-offload-step.yaml` 第 ⑦ 步脚注改为「下一层从 ① 重来」，已重新生成 SVG。P2-3：见 P1-2。P2-4：GLM 一节首句改为「主线跑的是 GLM 快照 db701c1f，那份代码里根本没有这套实现；下面是假如换到 main 之后仍然过不去的五道门槛」。P2-5：补来源 `vllm-ascend@2ed6cbba:docs/.../layerwise_and_sparse_kv_cache_offloading.md#L16-L21`，正文改为「v0.26 的用户指南转述 RFC #48203 的实验，说它有潜力显著提高序列长度或并发，同一句也写明实际效果取决于模型、硬件和配置；main 的指南已不再写这句」。P2-6：见 P1-1 ②。

**P3 五条全修。** ① 「最常卡住的是主机上限」改为「主机上限比设备上限还小时，实现会专门打一条 warning」；② §2 「按最大并发 × 最长上下文预先开满」改为「按三条上限里最小的那条一次开好」；③ §7 与常见误解都补上「2,048 个位置再加 0–3 个尾部（清单容量 2,051）」；④ 常见误解那条改成「前面还有硬件只限 A3、PD 分离的 D 端、缓存不能是混合布局几道」，并注明 Model Runner V1 主线本来就用 V1、能过；⑤ §7 补「这 3 GiB 只是字节账，不含主机侧的地址计算、TP 同步和链路争用」。

**顺带一处。** GLM 一节的 H2 由「放到 GLM 双机：主线开不了它」改为「放到 GLM 双机：硬件这一关就过不去」，与新的第一道门槛对齐；全库没有指向旧锚点的链接（已 grep 确认），lint 通过。

**没有反驳审查的条目。** 逐条核过源码后全部照改。

**其他。** frontmatter 来源 17 条 → 23 条（新增 A3 检查、缺算子、main 指南硬件段、设计文档 PD 段、v0.26 指南 RFC 段、v0.26 init 函数）；summary 末句改成「以及它只支持 Atlas A3、GLM 双机（A2）为什么用不上」（172 字符）。正文 10,609 → 12,481 字。涉及 fused 路径的说法未新增，原有一句仍只说「默认关、开了换另一条路径」，浮点是否逐位一致仍在待核。

**验证。** 每次保存后 `pnpm wiki:lint` 均通过；最终三项：`pnpm wiki:lint` 本页 0 报错（全库通过，9 处待留意都在别页）、`pnpm wiki:diagrams --check` 257 张图与 spec 一致（本页两张 0 警告）、`pnpm wiki:audit` 本页 23 条来源行号全有效且通过。写作标准自测（`measureStandard`）：行内代码 1.29/千字、正文角标 0、免责 1.7%、`standardProblems` 空；内联标记 29 处（C 23，占 79%），均在「对照源码」之后。未起服务、未截图、未提交。

## P5 复审（09-29）

复审员：独立复审（只审不改）。范围：两条 P1 与六条 P2 的回修，不重审全页。基线：工作区现版（HEAD 94e94b3 之上未提交），源码在 `tools/repos/vllm-ascend`。

**分数：8.5 / 10**（新增 P1 0 条、P2 2 条、P3 4 条）。

**P1-1（A3 门槛）已修，独立核实通过。** `vllm-ascend@baa023ad:…/sparse_kv_offload/sparse_kv_offload_manager.py` L1652–L1653 确为 `get_ascend_device_type() != AscendDeviceType.A3` → `RuntimeError("Sparse KV offload is only support on A3")`，在 `init_sparse_kv_offload_manager`（L1645–L1663）里；调用点是 `worker/model_runner_v1.py` L4486（`initialize_kv_cache` 阶段），确实晚于 `ascend_config` 的启动配置检查，页面「比上面那些配置检查更晚」成立。缺算子提示 L101「Rebuild vllm_ascend_C with Atlas A3 support」✓；main 用户指南 L25 的硬件段 ✓；v0.26（2ed6cbba）同名函数从 L1064 起没有型号判断，该文件 `AscendDeviceType` 出现 0 次 ✓。本部署是 2×Atlas 800 A2（D 页 L51），`device/hardware.py` 里 `910b`→`A2` 是独立枚举值，所以「本部署用不上」这个结论正确。页面按变体写到位：summary 末句、§1 L56 先说结论、GLM 一节 L152–L154 第一道门槛、L243「别开」、L254 版本差异行、L272 源码位置行，都没有为它编效果数字。
**P1-2（前置概念先用后讲）基本修好**：indexer 在 L48 讲清 ✓；潜向量 L134、L172 都带 [MLA](mla.md) 链接 ✓。TP / DP 一处残留见新 P2-1。

**六条 P2 的回修。** P2-2 已改（`kv-cache-sparse-offload-step.yaml` L14 脚注为「下一层从 ① 重来」，SVG 12:10 已重生成，`--check` 一致）；P2-3 已改（L134 说明一对是潜向量段 + RoPE 段、GLM 没有后者）；P2-4 已改（L152 首句先交代主线快照里没有这套实现）；P2-5 已改并核对原文（`vllm-ascend@2ed6cbba:docs/…/layerwise_and_sparse_kv_cache_offloading.md` L18–L21 确为转述 RFC #48203 的实验、并写明效果取决于模型/硬件/配置，main 指南已无此句）；P2-6 已改（L64 把「按 PD 分离设计」和「只在 A3 上跑」写成通用前提，与设计文档 L42–L50 一致）；P2-1 主体已改成「查询行」，两处残留见新 P3-1。

**fused 路径。** L212 只说 `use_fused_overlap` 默认关、开了换另一条路径，`ascend_config.py` L1478 `use_fused_overlap: bool = False` 可证；浮点是否逐位一致仍留在 L275 待核 ✓。本轮没有新增无出处的融合路径说法。L209「官方参数表建议取 `index_topk` 的两倍」也核到了（main 用户指南 L249）。

**旧版信息清单。** 文件存在：`…/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/kv-cache-sparse-offload-facts.md`（F1–F18，20 行）。抽 7 条核到新版：F5（indexer cache 留设备）→ L130、L181；F12（三条上限）→ §6；F13（启动检查清单）→ L221–L227；F14（TP 组内主机内存共用、不能按 rank 相加）→ L138；F15（融合分支不代表本页布局）→ L212 + 待核；F16（热缓冲/主存池取舍）→ L239、L243、L179；F17（浮点逐位一致另验）→ L275。全部属实。frontmatter relations 由 2 条扩到 4 条、aliases 未丢。本轮没有独立 checkpoint，`git diff HEAD` 只能对 p4 旧版比（HEAD 与 `p4-checkpoint` 的本页内容相同），删除行里未见丢信息。

### 新增 P2

1. **TP / DP 的首次出现仍没有链接和解释。** L120（§4）先写「TP 组内有一次等待……一个 DP 组的主机池由 TP rank 0 负责写新行」，解释与链接在 L138（§5）。修订记录写的是「§5 首次出现 DP / TP 处各加链接」，但真正的首次出现在 §4，P1-2 的这一小条只改了一半。**改法**：L120 加半句（把同一层切到几张卡的那组叫 TP 组、各跑一份完整模型各排各队的叫 DP 组）并链 tensor-parallel / data-parallel，或把 L138 的定义提前到 §4。
2. **本页没有进 `scripts/wiki/standard-pages.json`，写作标准对它不强制。** 同工作区并行改的姊妹页这轮加进名单 16 个（含 `kv-cache-cpu-offload`、`kv-cache-layerwise-offload`、`kv-pool`、`eplb` 等），唯独本页没加，`wiki:audit` 的本页输出里也没有「写作标准」那一行。我用 `checkStandard` 实测本页：正文 3,865 字、行内代码 1.29/千字、角标 0、calc 0.52/千字、免责 1.7%、`sourceSections` / `diagramFirst` / `wideDiagrams` 均无问题，`problems` 为空——加进名单即通过，不加等于放弃这页的回归保护。**改法**：在 `pages` 里补 `"kv-cache-sparse-offload"`，重跑 `pnpm wiki:audit`。

### 新增 P3

1. **「一步最多几行」残留两处**：L73（§2 代价四笔）、L239（对照源码·开销），这里的「行」指查询行，与 P2-1 统一后的口径不一致；L164 calc 的结果写「= 128 行」同理。统一成「查询行」即可。
2. **指南的「A3 与 950PR&950DT」和代码的 `!= A3` 冲突，页面没点破。** `device/hardware.py` 的 `device_type_from_soc_version` 把 `ascend950*` 判成 `AscendDeviceType.A5`，而检查只放行 `A3`，所以按这份代码 950PR&950DT 机器同样会抛错。页面 L154、L187 把两句并列陈述，读者会以为二者一致。加半句说明即可（对本部署的结论没有影响）。
3. **五道门槛里第 3 道（模型不在支持清单）不是硬报错。** 配置侧只检查 `index_topk`（GLM 有），「不在清单」出自指南的「其他稀疏 attention 模型未验证」。与其余四道（都会抛异常）并列，容易读成同等硬。建议注明这道是「官方未验证」而非启动即失败。
4. **L64「它只在 Atlas A3 上跑」写成了特性的通用前提**，但这是 main 才加的限制（v0.26 不判型号，页面版本差异表已写清）。正文补「main 起」三字更准确。

### 复审验证

- `pnpm wiki:audit`：**通过**。审计 133 页、3,098 条来源；本页 23 条来源行号全部有效（行号越界 0、文件不存在 0），全库 `ok`。
- `pnpm wiki:lint`：本页 0 条（输出里 grep 本页 id 命中 0）。全库 1 处失败在 `concepts/ucm.md` L192 的 `#怎么开` 锚点，属并行写手正在改的页，与本页无关。
- `pnpm wiki:diagrams --check`：261 张图与 spec 一致，本页两张 0 警告。
- **浏览器实测**：Playwright（chromium，桌面 1440×1000）打开用户已起的预览 `http://localhost:5193/#/wiki/kv-cache-sparse-offload`（未起停任何服务），截图 `scratchpad/sparse-rereview-1.png`。标题、summary（含「只支持 Atlas A3、GLM 双机（A2）为什么用不上」）、§1 正文与第一张三分格图渲染正常，图上 ①②③ 与正文示意数（槽装 0、2、4、6，选中 2、5、6，只搬 5 顶掉 0）一致。控制台 502 来自未启动的问答后端（8790），与页面无关。
- 源码复核方式：`git show baa023ad:<file>` 分段读 + `git grep`，仓库 `tools/repos/vllm-ascend`（HEAD = baa023ada41a5b8）。

**结论**：两条 P1 都按源码修对了，「本部署（A2）用不上、按变体讲」的结论成立且有行号支撑；六条 P2 除术语统一残留外全部改对。新增问题不影响页面结论，收掉新 P2-1、P2-2 后可定稿。

## P5 复审后修订（09-29）

**新 P2-1（TP / DP 首次出现没解释）已修。** 首次出现确实在 §4 的最后一条而不是 §5。改法用的是复审给的第一种：§4 那一条改成「把同一层切到几张卡上算的那组叫 TP 组（链 tensor-parallel），各自跑一份完整模型、各排各队的执行组叫 DP 组（链 data-parallel）」，后半句里的「TP rank 0」改成「组内第 0 号卡」，避免在解释之前再冒出一个新写法；§5 的那段保留，作为主机池归属的说明。

**新 P2-2（没进 `standard-pages.json`）不改，写明依据。** 本批派发说明（`scratchpad/b10-writer-common.md`「其他」第 3 条）明确写着「不改 `scripts/wiki/standard-pages.json`（审查通过后由主会话加入名单）」，这条没有被本轮指令覆盖，所以我不动这个文件。复审的实测结论我复核一致：本页 `standardProblems` 为空（正文 3,987 字、行内代码 1.50/千字、正文角标 0、免责 2.5%、`sourceSections` / `diagramFirst` / `wideDiagrams` 无问题），加进名单即通过，**请主会话在定稿时补 `"kv-cache-sparse-offload"` 一行**。

**新 P3 四条全修。**
1. 「行」口径残留三处已统一成「查询行」：§2 代价四笔的「一步最多几行 × 热槽数」、GLM calc 的结果「= 128 行」→「= 128 个查询行」、对照源码·开销的「一步最多几行 × 热槽数 × 每行字节」→「一步最多几个查询行 × 每行热槽数 × 每个槽的字节」（同处「K、V 两块」也改成「两块缓冲」，与 P2-3 的说法一致）。
2. 指南与代码口径冲突已点破，并先核了源码：`vllm-ascend@baa023ad:vllm_ascend/device/hardware.py` L53–L58 `device_type_from_soc_version` 里 `"ascend950" in normalized → AscendDeviceType.A5`，L71–L74 的运行时版本号 260 同样判成 A5，而卸载只放行 `AscendDeviceType.A3`（L16–L22 是四档独立枚举，`910b` → A2）。所以按这份代码，指南写的第二类机器（950PR&950DT）也过不去。GLM 第一道门槛与「怎么开」各加半句说明，并补来源 `hardware.py#L16-L76`（初写成 L16-L78 被 audit 判 out-of-range，文件共 76 行，已改）。对本部署结论无影响：A2 本来就不放行。
3. 第 3 道门槛改写成「模型不在支持清单里（这一道不报错，是「官方未验证」）」，并写明配置侧只检查 `index_topk`、GLM 过得去，其余四道都会当场抛异常。
4. §2 的通用前提改成「main 起它只在 Atlas A3 上跑……（v0.26 还不判型号，见版本差异）」。

**证据角标。** 新增 [C24]（`hardware.py`），为守住 [C] 占比删掉「怎么开」里与「会报什么错」重复的一个 [C5]；现共 29 处（C 23，79%），全部在「对照源码」之后。

**验证。** 每次保存后 `pnpm wiki:lint` 均通过；最终三项：`pnpm wiki:lint` 本页 0 报错；`pnpm wiki:audit` 本页 24 条来源全部 ✓、无越界；`pnpm wiki:diagrams --check` 本页两张图与 spec 一致、0 警告（全库唯一失败是并行写手在改的 `mooncake-connector-hooks.yaml`，与本页无关）。写作标准自测 `standardProblems` 为空。未起服务、未截图、未提交。
