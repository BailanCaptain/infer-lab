# kv-cache-layerwise-offload 页审查记录

## P5 写作记录（2026-09-29，深改，第 15 批）

**改了什么。** 全页重写（旧版 = p4-checkpoint，与改前现版一致）。标题改为「Layerwise KV offload：KV cache 一层一层搬，边算边搬」。按新讲法排序：问题式开篇 + 一句话定义 + 前置三句（KV cache、层、CPU offload，本页是其变体）+ 4 层例子 + 直觉图 → 为什么能拆、为什么要拆（五项代价）→ 能省多少时间（示意数 calc + 两个前提）→ 一层要搬多少、有多少时间可遮（calc）→ 一层的缓存什么时候搬 / 能用 / 能覆盖（搬入四步、存出四步）→ 和整趟搬、CPU offload 对照表（对象、粒度、记录、什么时候能用、什么时候算存好、本地已有时、显存）→ 共享槽（图 + calc + 四条约束 + 预算放大 + 分规格）→ GLM 双机（主线未开；每层搬多少 calc；三处卡点；待核）→ 常见误解 7 条 → 对照源码五个 H3。证据角标全部移到对照源码内；verified 补为 v0.23/v0.26/main；relations 加 kv-cache-cpu-offload。字数（standard.ts 口径，对照源码之上）1,150 → 4,260。

**直觉图。**
- 新增 `wiki/diagrams/kv-cache-layerwise-offload-overlap.yaml`（900×470）：成对时间格子图，上下两条时间轴骨架相同，各三条泳道（搬入 / 计算 / 存出），4 层、示意数每层搬入 2 ms、计算 3 ms、存出 2 ms。上：整趟搬 28 ms，计算斜线格「等四层搬完」「等四层存完」共 16 ms；下：逐层搬 16 ms，只在头尾各等 2 ms，右上角标「计算在等 16/28、4/16 ms」。按「算第 L 层时搬入 L+1、存出 L−1」画。
- 旧图 `kv-cache-layerwise-offload.yaml`（共享槽）保留布局，重写 caption 与右侧文字（加「显存主体：各层独占 8P → 这样排 3P」和「换给下一位之前，上一位要存出完」）。
- 两张图只用 scratchpad 的单页渲染脚本写了自己的 SVG（`figureProblems`/`figureAdvisories` 无输出）；按派发说明未截图，观感待浏览器验收。

**数字取自哪。**
- 基础节全部是示意数：4 层 / 2-3-2 ms（本页新设）；32 层、每位置 128 KiB、4,096 位置、16 GiB/s、每秒 16,384 位置沿用 kv-cache-cpu-offload 页的示意模型（其本身沿用 kv-cache 页），推出每层 4 KiB/位置、每层 16 MiB、0.98 ms；512 / 128 个新位置为本页新设。共享槽 8 层 → 3 槽沿用旧版，P 从 8 MiB 改为 16 MiB（接上一节的一层）。
- GLM 节：层表（11 层稀疏 MLA 位于 3、7…43，MTP 第 45 层也是 MLA，共 12 层；34 层 KDA）取自 02-forward.md §1.1、§1.4；1,088 B/位置/层（1,024 + 64）、8,355,840 B ≈ 7.969 MiB/块、KDA 655,360 B/页 × 4 页取自 02 §1.4；约 67,000 位置、105 块取自 01-deploy-entry-schedule.md §B3（经 concurrent-requests 页链接）。新推导：640 × 1,088 B = 680 KiB/层/块；105 × 680 KiB ≈ 69.7 MiB/层；105 × 7.969 MiB ≈ 836.7 MiB；4 × 640 KiB = 2.5 MiB/层/请求。
- 未启用、无实测：主线无 kv_transfer_config（01 L848、02 L685）；有效带宽、每层计算时间底稿都没有，GLM 节不给任何时间数字。

**核了哪些源码（钉点）。**
- GLM 快照 db701c1f（与 v0.23 维护分支 2c59ff10 在 ascend_store/、memcache_comm_fence.py、attention/utils.py 上 git diff 为空）：
  - `ascend_store_connector.py` L77–L83（开逐层即要求 PIECEWISE）、L85–L108（开关、后端、角色）、L229–L253（wait_for_layer_load / save_kv_layer 非逐层直接返回；kv_consumer 不存；逐层时 wait_for_save 直接返回）。
  - `pool_worker.py` L277–L290（layerwise_prefetch_layers 默认 1）、L1356–L1430（第 0 层一次发起 num_prefetch_layers 层、之后每层补一层——值含本层；非本层挂 attention 开算门；等本层 10 秒超时只打日志；存出先在计算流记事件再交发送线程；层计数只在存出入口加一；最后一层当场等存完）、L600–L625（按物理层映射到各缓存组，无混合缓存 NotImplementedError）。
  - `memcache_comm_fence.py` L24–L91（attention 开算门：记 NPU 事件，搬运线程等它）；attention 侧 `record_attention_compute_start` 在 sfa_v1 / mla_v1 等处。
  - `pool_scheduler.py` L77–L84（混合线性 attention 要求 mamba_cache_mode='align'）、L176–L182（memcache 逐层按层登记记录）、L250–L258（逐层从第 0 块查）、L565–L591（本地已命中也强制加载；返回 load_async and not use_layerwise）、L1066–L1077（逐层时请求结束立即释放）。
  - `ops/gdn.py` L130–L140（Qwen3.5 GDN 用空参数调存出入口推进层计数）；`ops/kimi_kda.py` 与 `models/glm5_next.py` 无逐层入口调用（git grep 为空）；GLM 的 MLA 走 sfa_v1（L1722/L1754/L1783 等本层，L2030 存出）。
  - 官方指南 `docs/source/user_guide/feature_guide/layerwise_kv_pool.md` L14–L33、L200–L240：写 prefetch 为「提前几层」、默认 1、只支持 memcache、混合 KV cache 抛 NotImplementedError——前一条与代码差一层、后一条代码里没有，均以 [!] 写入对照源码。
- 上游 vllm@0fc695fc：`model_executor/layers/attention/kv_transfer_utils.py` L15–L60（进层等、出层存，只装在 Attention / MLA 上）；`model_executor/models/config.py` L350–L365（只有开 prefix caching 才把 mamba_cache_mode 从 none 改为 all/align）；`config/cache.py` L133 默认 none。
- v0.26 2ed6cbba：`pool_worker.py` L409–L430（memcache 走 layerwise_cache_layout，其余默认 1）、L1728–L1768（一直等、raise_if_failed）；`layerwise_cache_layout.py` 已存在（L20 默认上限 8，L264 非 attention 状态 NotImplementedError）；kimi_kda 无逐层入口；pool_scheduler L856/L896、worker.py L584 同 main（每步重搬重存、预算放大）。
- main baa023ad：`layerwise_cache_layout.py` L128–L192（共享槽默认 = 层数、独立层默认 [0]、prefetch 默认 min(槽数, 8)、槽成员 k mod N、prefetch_layer_map）、L210–L294（按主规格分桶；有复用且含非 AttentionSpec → NotImplementedError）、L297–L381（同槽规格/字节一致检查）；`pool_worker.py` L505–L556（memcache 走布局，其余默认 2）、L2495–L2518（一直等）；`pool_scheduler.py` L870–L900（复用时每步存、每步以全部已算位置建 load_spec）；`worker.py` L620–L632（KV 预算 × 层数 ÷ 格数）；`backend/mooncake_layerwise.py` L55–L76（PP/PCP/DCP > 1 与混合递推状态 → ValueError）；`ops/kimi_kda.py` L505–L520、L683、L706（KDA 接入逐层入口）。

**旧版信息清单勾选**（清单：scratchpad `p5/kv-cache-layerwise-offload-facts.md`，16 条）。
- F1 按层执行、全部完成才传则等待集中在末尾 → 「为什么能按层拆」要拆段 + 开篇例子 ✓
- F2 层边界读写、本层用前等就绪、入口由 attention 辅助函数和连接器提供 → 开篇 + 「什么时候搬」两方向；出处移到对照源码「怎么开」 ✓
- F3 重叠效果取决于计算时间、数据量、带宽、同步；超过窗口仍等 → 「能省多少时间」两个前提 + 「一层要搬多少」 ✓
- F4 缓冲四步生命周期、否则混合数据 → 存出方向第 1–3 步 ✓
- F5 预取目标可写、执行前加载完成、调用保存≠可释放 → 搬入第 4 步、存出第 3 步、常见误解第 4 条 ✓
- F6 逐层传输与物理复用是两个能力 → 共享槽节首段 ✓
- F7 按规格分组、独占层 + 共享槽、8 层两槽示意与 S0/S1 成员 → 共享槽节 + 图；更正：布局在 v0.26 已有，旧版只写 main ✓
- F8 8P → 3P = 37.5%、外部另算 → 共享槽 calc；P 由 8 MiB 改 16 MiB（64→24 改为 128→48，算法不变）✓
- F9 按主 KVCacheSpec 分桶、合并检查规格与字节、两规格不能按 3 槽推 → 「不同规格要分开算」段 ✓
- F10 影响规格的因素、非 AttentionSpec 拒绝、GLM 要逐组核 → 同段 + GLM 卡点 3 + 会报什么错；GLM 的 KDA 属非 attention 状态，写成具体结论 ✓
- F11 8 MiB / 8 GiB/s ≈ 0.98 ms、0.4 ms 窗口遮不住、共享槽多窗口宽但占显存 → 改为 16 MiB / 16 GiB/s ≈ 0.98 ms、128 个新位置 0.24 ms 遮不住（与示意模型接上）；窗口与槽数关系在共享槽节 ✓（数字替换，结论保留）
- F12 同时看容量、每层量、等待耗时、前向时间；减槽非无条件优化 → 「一层要搬多少」末段 + 共享槽节末段 ✓
- F13 GLM 快照有 use_layerwise 和回调、consumer 在 save_kv_layer 直接返回 → 怎么开第 1 条 ✓
- F14 复用布局与 GLM 快照分开列、未拼成已验证部署 → 版本差异分列 + GLM 节「换到 main 也还有两道限制」✓
- F15 8 层例子可手算、GLM 支持按组合判断、未做设备验证 → GLM 节「均按代码，未实跑」+ 待核 ✓
- F16 aliases / relations / chapters → 全部保留，aliases 加 use_layerwise、layerwise_prefetch_layers、layerwise_num_shared_buffers；relations 加 kv-cache-cpu-offload ✓

**本批验收要点。** 缓存池与换出区分对象、粒度和恢复条件：对照表按「搬的对象 / 一次搬多大 / 存储里的一条记录 / 取回的历史什么时候能用 / 新缓存什么时候算存好 / 本地已有时 / 显存占用」七行对比整趟搬、逐层搬、CPU offload；抢占换出的区分在 kv-pool 页，这里另点出 PD 分离的 MooncakeLayerwiseConnector 不是同一对象。吞吐和时延：GLM 节不给时间，带宽与每层计算时间列为待核。

**参照。** 看了 scratchpad/refs/HOW-THEY-TEACH.md 与 amd-04-hi.png（PP 图在旁边标「谁在干活、谁空闲」）。图库没有卸载类参照；借了「成对对照图」（两条时间轴同骨架只换排法）和「把空闲写在图上」（斜线格 + 右上角「计算在等 x / y ms」）。

**新发现（供审查核）。**
1. 官方指南说 layerwise_prefetch_layers 是「提前几层」、默认 1；按 db701c1f 代码它是含本层的同时发起层数，默认 1 时不提前（C7）。
2. 官方指南说逐层遇混合 KV cache 抛 NotImplementedError；db701c1f 代码没有这道检查，改为物理层映射到各组。
3. GLM 快照 KDA 不调用逐层入口，层计数只在存出入口加一，GLM + 逐层时层号对不上（按代码推断）；main 已补。
4. GLM 快照等待 10 秒超时只打日志继续算；v0.26、main 改为一直等并在线程出错时抛出。
5. 共享槽（v0.26、main）开启后每步重搬参与轮换各层的全部历史、每步存出（含不满一块），KV 预算按层数 ÷ 格数放大——这是「offload」的真正含义，旧版未写。

**留下的待核。**
1. 外部池到 NPU 的有效带宽、GLM 每层实际计算时间。
2. main 上 memcache 不配共享槽时 GLM 能否走通。
3. 01 §B3 场景下被抢占请求的历史是否真的在池里（本页只借它的规模）。
4. 上面第 1–4 条都按代码推断，未实跑。

**自查疑点。** 无已知 P1。可再看：两条时间轴按「存出从该层算完时开始」简化画（实现里存出在本层 attention 写完缓存后就交出，略早于本层 MLP 结束），不影响结论。

**验证。** pnpm wiki:lint：通过，本页 0 报错、0 留意（中途一次 mark-flood 已按规则删减角标）；pnpm wiki:diagrams --check：256 张图与 spec 一致，本页两图无留意；pnpm wiki:audit：本页 28 条来源全部 ✓，名单页写作标准通过；standard.ts 单页检查：4,260 字、行内代码 0.0/千字、角标 0、对照源码 ✓、calc 0.94/千字、相邻块 0、图先行 ✓、免责 2.3%、图宽 ✓。未截图、未起服务。

## P5 审查（09-29）

审查员：独立审查（只审不改页面），第 15 批。读法：去掉 frontmatter 分段读正文 L48–L229；「对照源码」只 grep（五个 H3 齐全、顺序对；版本差异含 v0.23 / v0.26 / main 及 2c59ff10、db701c1f、2ed6cbba、baa023ad），另为核 align 问题读了 L251 一行。

**分数：7.5 / 10**（P1 1 条、P2 1 条、P3 4 条）。

### 初学者测试（只读前两屏）
Layerwise KV offload 把放在外部池里的 KV cache 从「整趟前向搬一次」改成「每层搬一次」：算第 L 层时搬进 L+1、存出 L−1，搬的字节不变，只是把等待藏进计算；代价是每层多一个等待点、搬得比算得慢时每层都等、本地已有也要重搬、整趟前向录不成一张图。——前两屏能说清，通过。

### 学习顺序：通过
是什么（一句话 + 前置三句 + 4 层例子 + 成对时间轴图，不开算）→ 为什么能拆 / 为什么要拆 + 五项代价 → 示意数 calc → 每层搬多少 / 能遮多少 → 搬入、存出各四步 → 与整趟搬、CPU offload 对照表 → 共享槽 → GLM 双机 → 常见误解 → 对照源码。基础节全用示意数，GLM 数字只在 GLM 节；第一节末尾没有堆链接；每节 calc ≤1，表格与 calc 不相邻；没有新增分镜；没有 meta 文本。

### 示意演算逐格手算（全部对上）
- 成对时间轴图（浏览器截图 fig1 逐格核）：整趟搬 搬入 L0–L3 占 0–8，计算 8–20，存出 20–28，计算等 8+8=16 ms / 共 28 ms；逐层搬 搬入 L0[0,2]、L1[2,4]、L2[5,7]、L3[8,10]，计算 L0[2,5]…L3[11,14]，存出 L0[5,7]…L3[14,16]，计算等 2+2=4 ms / 共 16 ms。L2、L3 的搬入从前一层计算开始时起步，正好符合代码里「预取要等本层 attention 开算门」的语义。
- calc 1：4×2+4×3+4×2=28；2+12+2=16；32 层 64+96+64=224、2+96+2=100 ✓。
- 慢搬入：搬入 4 ms、计算 3 ms，排出 L0 搬[0,4]、算[4,7]；L1 搬[4,8]、算[8,11]；L2 搬[8,12]、算[12,15]；L3 搬[12,16]、算[16,19]；存 L3[19,21] → 21 ms，每层多等 1 ms ✓；整趟 16+12+8=36 ✓。
- 不预取：L 层搬入在走到 L 层才发起 → 4×(2+3)+2=22 ms ✓。
- calc 2：128 KiB÷32=4 KiB；4,096×4 KiB=16 MiB；16 MiB÷16 GiB/s=0.977 ms；512÷16,384÷32=0.977 ms；128÷16,384÷32=0.244 ms；差 0.73 ms；512×4 KiB=2 MiB ✓。示意模型与 kv-cache-cpu-offload 页 L77–L84（128 KiB/位置、16 GiB/s、16,384 位置/s、4,096 位置=512 MiB）一致。
- 共享槽 calc：8P→3P=37.5%；P=16 MiB 时 128→48 MiB；8÷3≈2.67 ✓；k mod N 成员 S0=L1/L3/L5/L7、S1=L2/L4/L6 ✓（main layerwise_cache_layout.py L128–L192）。
- GLM calc：640×1,088=696,320 B=680 KiB；105×680 KiB=71,400 KiB≈69.7 MiB；105×7.969 MiB≈836.7 MiB；4×640 KiB=2.5 MiB ✓。底稿：02 §1.1 层表（3,7,…,43 共 11 层 MLA，其余 KDA）、§1.4（MTP 第 45 层也是 MLA 共 12 层、1,024+64 B、8,355,840 B/块、TP 间复制）、L309（KDA 2.5 MiB/层/请求）；01 L1023–L1026（约 67,000 位置、ceil(67007/640)=105 块）；concurrent-requests L243–L249 同口径 ✓。

### 核心机制对照源码（逐条）
- 开关与录图：db701c1f ascend_store_connector.py L77–L83（use_layerwise → requires PIECEWISE）、L87–L91（use_layerwise、backend 默认 mooncake、use_gva_layerwise 仅 memcache）✓。
- 搬入：pool_worker.py db701c1f L1374–L1381（第 0 层发起 num_prefetch_layers 层、之后每层补 1 层）、L1365–L1366（非本层挂 attention 开算门）、L1395–L1397（等本层 10 s 超时只打日志）✓；memcache_comm_fence.py 类注释说明门的用途 ✓；默认 layerwise_prefetch_layers=1（L288）✓。
- 存出：L1413（计算流记事件）→ 交发送线程；kv_transfer.py L1123/L1353 发送线程先 synchronize 事件 ✓；最后一层当场等（L1422–L1425）✓；层计数只在 save_kv_layer 加一（L1430）✓。
- 调度侧：pool_scheduler.py L565–L591（逐层时本地命中也强制加载、不走异步）、L253–L256（逐层从第 0 块查）、L178–L179（memcache 逐层按层登记 key）、L1074–L1077（逐层请求结束立即释放）✓；load_async 默认 False（L93），整趟搬「前向开始前搬完」成立 ✓。
- 共享槽（main）：默认槽数=层数、独立层默认 [0]、预取默认 min(槽数, 8)、has_layer_reuse 判定 ✓；pool_scheduler L872–L900 复用时每步存（含 decode）、每步以全部已算位置建 load_spec，L780 save_partial_block ✓；worker.py L621–L632 预算 × 层数÷格数 ✓；v0.26 2ed6cbba 已有 layerwise_cache_layout.py、v0.23 2c59ff10 没有 ✓。
- GLM 卡点 2：db701c1f 的 kimi_kda.py / glm5_next.py 无逐层入口调用（git grep 为空），gdn.py L137 有空调用；main kimi_kda.py L516/L683/L706 已接入 ✓。卡点 3：main mooncake_layerwise.py 混合递推状态 ValueError、layout 非 AttentionSpec NotImplementedError ✓。
- 未启用：01 L848、02 L685 无 kv_transfer_config ✓；GLM 节不给时间数字，没有把主线数字当成本特性的效果 ✓。

### P1
1. **GLM 节卡点 1「外部池本身要求 align 模式」结论错（正文 L214，对照源码「会报什么错」L251 同）。** 页面说上游只在开 prefix caching 时才把 mamba_cache_mode 从 none 改掉、主线 prefix caching 关着，所以 GLM 主线直接加上连接器会先停在这道 NotImplementedError。实际上 vllm-ascend 的 `vllm_ascend/patch/platform/patch_mamba_config.py` 在检测到 AscendStoreConnector（或 MultiConnector 里套着它）且模型是混合模型时，会把 none 自动改成 align（db701c1f L26–L42、L213–L220；2c59ff10 / 2ed6cbba L136–L138；baa023ad L175–L177；A2 非 310P 走这个补丁，见 patch/platform/__init__.py L27–L30），pool_scheduler L77–L84 的检查因此不会触发；手动设成别的值才会 AssertionError。与已审完的 kv-pool 页（L247、L268、版本表 L281「混合模型自动改 align，三版一致」）矛盾。复现：`git show db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py | sed -n '213,220p'`。**改法**：把卡点 1 改成事实——接上 AscendStore 时 align 会被自动打开（不是卡点），但这会让 KDA 状态按块留档，连带要求与成本一句话链到 [KV Pool](kv-pool.md) 对应段，不在本页重讲；「会报什么错」L251 删掉「GLM 主线会先停在这里」的推断，改为「手动设成非 align 会 AssertionError，自动情形不报」；「卡在几处」的计数同步改。

### P2
1. **默认不预取只写在对照源码里（正文 L103）。** 开篇一句话、直觉图和第一个 calc 都按「算第 L 层时搬 L+1」讲，但钉住的 GLM 快照（与 v0.23 维护分支相同）layerwise_prefetch_layers 默认 1，按代码是「含本层的同时发起层数」，即默认根本不提前，正好是本节算的 22 ms 情形；v0.26 非 memcache 也是 1，main 非 memcache 是 2，memcache（v0.26/main）是 min(槽数, 8)。正文只写「默认值因版本而异，见对照源码」，初学者会以为开了就有 16 ms 的效果。**改法**：在 L103 补一句「钉住的 GLM 快照默认值为 1，等于不提前，就是上面 22 ms 的情形；要得到 16 ms 的排法至少设为 2」，版本细节仍留在对照源码。

### P3
1. 共享槽 calc 标题「8 层共用 3 个槽」（L170）与正文「L0 独占 + 两个共享槽」不一致，易读成 8 层轮流用 3 个共享槽。改为「L0 独占 + 7 层轮用 2 个共享槽」。
2. 开篇 L57「本页是它（CPU offload）的变体」：逐层搬实际是 KV Pool（AscendStore）的一种模式，和 CPU offload 是两套连接器；对照表已说清，但开篇一句容易误导。改为「和 CPU offload 同一思路，走的是 KV Pool」。
3. 术语先用后讲：memcache 首次出现在对照表 L151 没有一句话解释（KV Pool 的一种存储后端）；align 在 L214 没解释；L157 的 P、D 没展开（Prefill / Decode 实例）。各补半句。
4. 存出第 4 步 L141「所以请求结束时块可以立刻归还」：代码注释给的理由是「逐层不记发送事件，延后释放会泄漏」（pool_scheduler L1074–L1076），而 GLM 快照里最后一层的等待 10 s 超时后照样继续；「前向当场等完 → 所以能立刻还」是推断，建议改成代码的理由或加「按代码推断」。

### 丢信息核对
p4-checkpoint 旧版 16 条清单（scratchpad p5/kv-cache-layerwise-offload-facts.md）逐条在新版找到：F1–F6 在开篇、为什么、搬入 / 存出四步和误解第 4 条；F7–F10 在共享槽节与图注（S0/S1 成员见图注，布局版本更正为 v0.26 起已有，核实属实）；F11 数字换成 16 MiB / 16 GiB/s / 0.24 ms 的新示意，结论保留；F12 在 L123 与 L185；F13–F15 在对照源码与 GLM 节；F16 aliases、relations、chapters 保留并扩充。写手勾选属实，无丢信息。

### 与相关页口径
- kv-cache-cpu-offload：示意模型数字一致；对照表 CPU offload 一列（整段、挂起一步、本地有就不搬）与该页 L70、L95、L122 一致；没有重讲 CPU offload。
- layers-and-hidden：只一句「层串起来、每层一份」+ 锚点链接，未重讲 ✓。
- kv-pool：逐层模式、从第 0 块查、Mooncake 逐层 main 才有且限纯 TP / 不支持递推状态，均一致；唯一冲突是 P1-1 的 align。

### 链接、截图与检查
- 正文链接锚点全部存在（layers-and-hidden L49、glm-5-3-flash-two-node L49/L203、linear-attention L154、concurrent-requests L227、kv-cache-cpu-offload L73、本页共享槽节）；全库入链（kv-pool、pd-disaggregation、index、params/use-layerwise）都不带锚点，改标题不影响。
- 浏览器（Playwright，1440×900，http://localhost:5193/#/wiki/kv-cache-layerwise-offload，未起停服务）：2 张图、4 个 calc 正常渲染，图宽 900 在 1032 容器内无横向滚动，页面无 JS 报错、无未渲染 `**`。截图：scratchpad `kv-cache-layerwise-offload-review-first.png`（第一屏）、`-review-fig1.png`（成对时间轴，逐格核过）、`-review-fig2.png`（共享槽）。图 2 右半空白偏多，不影响阅读。
- `pnpm wiki:lint`：通过（全库另有 10 处留意，无本页）。`pnpm wiki:audit`：通过；本页 28 条来源全部 ✓（行号有效）。注意：audit 输出里本页没有「写作标准」行，说明本页不在名单 66 页内，只统计不报错；写手自报的 standard.ts 单页检查未复跑。

### 跳过
frontmatter 来源清单；「对照源码」正文（只 grep，另读 L251 一行核 P1）；命令块与代码块；HANDBOOK、docs/plans/。参考图库本页无通信原语 / TP/DP/EP 内容，未打开。

## P5 修订记录（09-29）

**P1-1（已改，审查成立）。** 核实：db701c1f `vllm_ascend/patch/platform/patch_mamba_config.py` L26–L42（`_using_kv_store` 认 AscendStoreConnector 或 MultiConnector 里套着它）、L213–L220（混合模型 + 接 AscendStore + 非 extract_hidden_states：none → align，其他值 AssertionError）；A2 非 310P 走此补丁（`patch/platform/__init__.py` L27–L30）；2c59ff10 / 2ed6cbba L137、baa023ad L176 同一逻辑。改法：GLM 节删去原卡点 1，改为「先说一件不是卡点的事」一段——自动改 align、连带要求与成本链到 kv-pool.md#放到-glm-双机这套部署没有开-kv-pool，不重讲；「卡在几处」改为两处，上文「第 2 处卡点」同步改为「第 1 处」；「会报什么错」该条改为「自动改写不报错 [C29]；手动设非 align → AssertionError；调度侧 NotImplementedError [C14] 自动改写后不触发」，删去「GLM 主线会先停在这里」的推断；源码位置表补补丁文件行号；frontmatter 加第 29 条来源（patch_mamba_config.py L205–L226）。

**P2-1（已改）。** 「能省多少时间」末段补：钉住的 GLM 快照默认值为 1，等于不提前，就是 22 ms 情形；要得到 16 ms 排法至少设为 2；其他版本默认值仍留在对照源码。

**P3（4 条全改）。** ① 共享槽 calc 标题改为「L0 独占 + 7 层轮用 2 个共享槽：显存省多少」；② 开篇 CPU offload 一句改为「同一个思路，但走的是另一套连接器：存在 KV Pool 这类外部池里」；③ memcache 在对照表首现处补「KV Pool 可选的一种存储后端」，align 在 GLM 节首现处补「按块的边界留档，而不是只留最新一份」，P / D 补「专做 prefill / decode 的实例」；④ 存出第 4 步改用代码注释的理由（逐层不登记发送完成事件，延后释放会一直占着，pool_scheduler L1074–L1076），不再写成由「当场等完」推出。

**验证。** pnpm wiki:lint 通过（本页 0 报错、0 留意，每次保存后都跑过）；pnpm wiki:diagrams --check：257 张图与 spec 一致，本页无留意；pnpm wiki:audit 通过，本页 29 条来源全部 ✓；standard.ts 单页检查 4,411 字，各项 ✓。未截图、未起服务。

## P5 复审（09-29）

复审员：独立复审（只审不改），范围限于 P1/P2/P3 的修订与是否引入新错，未重审整页。读法：去掉 frontmatter 只读改动相关段（L50–L58、L87–L104、L126–L158、L160–L188、L190–L221、L232–L297）。

**分数：8.5 / 10**（新增 P1 0 条、P2 0 条、P3 1 条）。

### P1-1（align 自动改写）：已改对，独立核实成立

在钉住版本源码里重跑了一遍取证，与写手的修订记录一致：

- `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py`：L26–L41 `_using_kv_store` 认 `AscendStoreConnector`，也认 `MultiConnector` 的 `connectors` 列表里套着它；L216–L221 在 `using_kv_store_with_hybrid and not is_extract_hidden_states` 时把 `none` 改成 `align`，否则 `assert ... == "align"`；L222–L224 决定 `mamba_block_size`（开 prefix caching 才落到 `block_size`，否则是 `max_model_len`）——正文 L213 说的「连带要求」与此一致。
- 三版同一逻辑：`2c59ff10` / `2ed6cbba` L137–L141、`baa023ad` L176–L180。补丁在 A2（非 310P）上生效：`patch/platform/__init__.py` L27–L28。
- 「自动改写后调度侧不再报错」这条也核到了链路：`MambaSpec.mamba_cache_mode` 由 `cache_config` 传入（`vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py` L54，字段定义 `vllm/v1/kv_cache_interface.py` L613），所以 `pool_scheduler` L80–L85 的 `NotImplementedError` 在自动改写后不触发。
- 前置条件也成立，没有被绕过：`AscendStoreConnector` 继承 `SupportsHMA`（`ascend_store_connector.py` L76），所以 vLLM 不会因为连接器不支持 HMA 而关掉 hybrid manager（`vllm@0fc695fc:vllm/config/vllm.py` L1479–L1500）；NPU 平台 `support_hybrid_kv_cache()` 返回 True（`vllm_ascend/platform.py` L889–L890）；GLM 走 MTP（`method` 归一成 `mtp`，01 L643–L644），不是 `extract_hidden_states`。

页面三处改动落到位且互相一致：正文 L213「先说一件不是卡点的事」+ 链到 kv-pool 对应段；L211「下面第 1 处卡点」与 L215「卡在两处」编号对得上；「会报什么错」L253 改成「自动改写不报错 [C29]／手动设非 align 报 AssertionError／[C14] 自动改写后不触发」；源码位置表 L292 补了补丁文件三版行号；frontmatter 第 29 条来源 `patch_mamba_config.py#L205-L226` 存在且行号有效（文件 228 行）。与 kv-pool 页（L190「打开 AscendStore 时自动改成按块对齐」）口径一致，原冲突消除。

### P2-1（默认不预取）：已改对

正文 L104 末尾补的三句与代码一致：`pool_worker.py` db701c1f L288 默认 1；`_submit_ready_layer_loads`（L1377–L1383）第 0 层发 `num_prefetch_layers` 层、之后每层补 1 层，所以默认 1 时确实是「走到第 L 层才发起第 L 层」，正好是本节 22 ms 的情形，设 2 才得到 16 ms 的排法。版本表 L276 的其余默认值复核无误：`2ed6cbba` L429 非 memcache 为 1、memcache 走 layout；`baa023ad` L545–L547 非 memcache 为 2。

### P3 四条：全部改到，且没有改坏

① calc 标题 L171 已改为「L0 独占 + 7 层轮用 2 个共享槽」，与正文 L164、L181 的 S0/S1 说法一致；② 开篇 L58 改为「同一个思路，但走的是另一套连接器：存在 KV Pool 这类外部池里」，不再说成 CPU offload 的变体；③ memcache（L152）、align（L213）、P/D（L158）三处首现都补了半句解释；④ 存出第 4 步 L142 改用代码注释的理由，与 `pool_scheduler.py` db701c1f L1073–L1075 的注释（逐层不记发送事件，延后释放会泄漏）一致，不再由「当场等完」推出。

### 新错与丢信息

- 未发现新增 P1 / P2。改动都是增补或就地替换，没有删掉原有结论；引用编号 [C4][C5][C7][C9][C11][C13][C14][C16][C20][C27][C29] 逐个对回 frontmatter 顺序，均指向对应条目。
- `git diff -- wiki/concepts/kv-cache-layerwise-offload.md`（对照 p4-checkpoint 版）：删掉的是旧版整节散文，其中的事实（consumer 在 `save_kv_layer` 直接返回、非 `AttentionSpec` 拒绝构造、8P→3P=37.5%、按 `KVCacheSpec` 分桶）在新版 L245、L254、L170–L177、L188 都能找到；示意数从 8 MiB/8 GiB/s 换成 16 MiB/16 GiB/s 是与 kv-cache-cpu-offload 页对齐，结论未变。本轮删改无丢信息。

### 新增 P3

1. L213 说「检测到接的是 AscendStore、模型又是混合模型时会自动改成 align」，省掉了代码里的两个前提：hybrid KV cache manager 没被关掉、speculative method 不是 `extract_hidden_states`（`patch_mamba_config.py` L215）。对 GLM 主线两者都成立，结论不受影响；可在句末加半句「（hybrid 缓存管理没关、且不是 extract_hidden_states 时）」或不改。

### 验证

- 浏览器（Playwright，1440×900，`http://localhost:5193/#/wiki/kv-cache-layerwise-offload`，用的是用户已开的预览，未起停服务）：页面无 JS 报错、无未渲染 `**`、无横向滚动（scrollWidth 1440 = innerWidth）；新段落「先说一件不是卡点的事」渲染正常，段内 KV Pool 链接 `#/wiki/kv-pool#放到-glm-双机这套部署没有开-kv-pool` 点进去命中目标标题（定位后标题在视口顶部 16px）。截图：scratchpad `layerwise-rereview-1.png`（第一屏）、`layerwise-rereview-glm.png`（GLM 节）。
- `pnpm wiki:audit`：**本页通过**——29 条来源全部 ✓、行号有效，本页无报错；全库唯一 1 处失败在 `concepts/lmcache.md`（diagram-identifier：yaml pins[0] 不在该页 sources 里），与本页无关。

### 跳过

frontmatter 来源清单正文、命令块、与本轮改动无关的段落（示意演算逐格手算、共享槽推导已在上一轮核过，本轮只核改动点）；未复跑 lint 与 standard.ts。
