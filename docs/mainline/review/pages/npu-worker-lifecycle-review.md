# npu-worker-lifecycle 审查记录

## P5 写作记录（2026-09-28，P5 第 08 批，Opus 写手）

### 改了什么

- 按深入页骨架重写：问题式 H2 + 一句话定义 + 直觉图 → 为什么/代价（含顺序依赖四行表、与相邻页的分工段）→ GLM 双机沿一次启动走 ①–⑥ 六个 H3 → 常见误解八条 → 对照源码五个 H3。
- 直觉图 `worker-lifecycle.yaml` 重画：三列 Worker（卡 0、卡 1、最后一张卡）各走换补丁 → 选卡建通信组 → 装权重 → 试跑量预算 → EngineCore 汇总横条 → 建缓存池 → 预热录图；只画份数与先后，不写字节。
- 新增代码流程图 `worker-lifecycle-flow.yaml`：执行器建 Worker 进程时的三步、EngineCore 初始化 KV cache 时的五步，画出 sleep mode 两处旁路和「主模型关掉录图」分支；图上不放代码名，符号只在 pins。
- 单一出处：KV 预算推导、3,855 块、7.969 MiB、16 卡分组、每卡 20.58 GiB、7 个捕获尺寸都只给结论并链接双机部署页 / kv-cache-memory-profiling；块分配链接 vllm-kv-block-allocation；系统总览链接 vllm-ascend-overview。本页唯一的新推导是 A0.7 的「一次启动从存储读多少」calc（底稿 A0.7 写明 loader 读盘目前没有独立知识页）。
- 版本差异按 data-parallel 的表头口径：v0.23 = 2c59ff10，镜像 db701c1f 单独说明（与 2c59ff10 的 worker.py 只差 log_memory_stats，六个方法逐字相同、行号从 load_model 起前移 13 行），v0.26 = 2ed6cbba，main = baa023ad（GLM 在 models/glm5next/）。
- relations 改为 engine-processes / kv-cache-memory-profiling / kv-cache-spec / vllm-kv-block-allocation / graph-mode-layer；删掉与 kv-cache-memory-profiling 重复的别名 determine_available_memory（lint dup-alias）。

### 数字取自底稿哪一节

- 进程账 20 个、16 个 Worker：01 底稿 §A0.1；rank = DP 组号 × 8 + 本机序号、TP/DP/EP 三类组：§A0.2 与 §A0 第 5 步。
- 18 个专家、18r 到 18r+17、11 号卡收 198–215：§A0.7「本卡收哪些」；每卡 20.58 GiB：§A0.3 / §A0.7（以 02 §1.3 为准）。
- 读盘 calc（290.25 + 14.57 ≈ 304.8 GiB、÷16 ≈ 19.1 GiB、2C ≈ 610 GiB、每台约 305 GiB）：§A0.7「从磁盘读多少、分几步」。
- 54.40 / 30.00 GiB、3,855 块、7.969 MiB、5 个缓存组、640 token 一块：§A0.4、§A0.5（本页只引结论）。
- 7 个捕获尺寸与 1–32 个请求、草稿侧 enforce_eager：§A0.6。

### 核心概念对照了什么

- 六步方法与顺序：vllm-ascend@db701c1f `vllm_ascend/worker/worker.py`（__init__ L90、_init_device L395/快照 L466–L480/建组 L497、init_device L505、determine_available_memory L527、load_model L668、compile_or_warm_up_model L693、initialize_from_config L894、_init_worker_distributed_environment L975）逐段读过；四个 commit 的行号用 grep 复核。
- 调用方：vllm@0fc695fc `multiproc_executor.py#L626-L634`（init_device → load_model）、`core.py#L236-L317`（get_kv_cache_specs → determine_available_memory → get_kv_cache_configs → initialize_from_config）、`abstract.py#L118-L126`（initialize_from_config 后紧接 compile_or_warm_up_model）。
- MLA 出处指向实际推理路径：GLM 用的是 `vllm_ascend/ops/indexer_kpool_mla.py` 的 `AscendIndexerKPoolMLAAttention`（后端 `attention/indexer_kpool_mla_v1.py`），镜像版 `patch_process_weights_after_loading.py#L18-L23` 把它加进后处理名单；2c59ff10 与 2ed6cbba 的同名补丁只认 DSAAttention；main 上补丁已退役（baa2ac756），GLM 改用上游 `MultiHeadLatentAttentionWrapper`（`models/glm5next/attention.py#L300-L322`）。没有引用 sfa_v1.py。
- v0.26/main 的 kernel_warmup（Triton 三类预热，enforce_eager 拦不住）：2ed6cbba `worker.py#L748-L778`、`kernel_warmup.py#L36-L49`；main 的预算修正与 kv_cache 池范围：baa023ad `worker.py#L549-L620`、`#L1129-L1138`。
- 教程参数（0.85、FULL_DECODE_ONLY、捕获尺寸、prefetch、未开 sleep mode / kv-cache-memory / load-format / KV 传输 / additional-config）：vllm-ascend@0576b647 教程两机命令 grep 计数核对；enable_cpu_binding 默认 True：db701c1f `ascend_config.py#L162`。

### 旧版信息清单勾选

清单：会话 scratchpad `p5/npu-worker-lifecycle-facts.md`（A = p4-checkpoint 版 19 条，B = 14591fd~1 六步版 23 条）。

- 保留：A1–A8、A10–A18，B1–B4、B7–B23（B18、B22 扩到 main 列；B23 行号表改为镜像 / v0.23 / v0.26 / main 四列并复核）。
- 挪走附链接：A10–A12、B5 的扣减推导 → [kv-cache-memory-profiling](../../../../wiki/concepts/kv-cache-memory-profiling.md)（本页只给结论）；A19 与 A9 的「未实测完整加载」→ 本页源码区「缺口」。
- 删除 / 纠正：A9 的「45 层混合结构」没有写（层结构归模型页，本页只用底稿 §A0.5 的 MLA 12 层）；B6 旧文说「请求的块物理位置在启动第五步定下」与源码不符——块在调度时才借（one-request 第 2 站、vllm-kv-block-allocation），按 A15 的口径写。

### 验证

- `pnpm wiki:lint`：退出码 0（本页无报错、无待留意）。
- `pnpm wiki:audit`：退出码 1，唯一失败在 vllm-v1-shape.md 的一条来源越界（其他写手的页）；本页 27 条来源全部 ✓。
- `pnpm wiki:diagrams --check`：退出码 0，192 张图与 spec 一致。写作中途全局 `wiki:diagrams` 曾因 vllm-v1-shape.yaml 的两处溢出失败，本页两张图用只渲染本页 id 的临时脚本生成，调用的是同一套 renderDiagram / figureProblems。
- 单页标准检查（checkStandard）：行内代码 0/千字、对照源码之上角标 0、源码区 H3 顺序通过、calc 0.25/千字、无相邻块、图先行、免责 0%、图宽 ≤900。全页角标 30 处，其中 C 级 22 处（73%）。
- 没有截图、没有起服务；浏览器验收留给审查环节。

## P5 审查（09-28）

审查人：Opus 5.5 独立审查（只审未改页面）。范围：正文 L48–L167 全读；frontmatter sources 区跳过；「对照源码」L168–L246 只按 grep 核 H3 顺序与版本口径，另读了 L238–L245「本页的推断 / 缺口」两小段以核对待核标注。没有读取被拦的段落。

**分数：7.5 / 10**

### 1. 初学者测试（只读前两屏）

我的一句话：NPUWorker 是每张 NPU 上管这张卡的执行角色，启动时按固定顺序换补丁、选卡建组、装本卡权重、试跑量出 KV 预算，等 EngineCore 按最紧的卡定块数后建缓存池，最后预热录图；代价是启动慢（整份权重要读、要真跑前向和录图），且预算只对当前这套配置成立。
能说清。第一屏是问题式 H2 + 加粗定义 + 直觉图，第二屏讲「为什么一次做完」和三处代价，结构符合先直觉后数字。

### 2. 核心概念对照源码（逐条，均为对）

| 页面说法 | 判定 | 依据 |
|---|---|---|
| ① 构造函数里先 adapt_patch，再注册算子、读昇腾配置，最后基类构造 | 对 | db701c1f `worker.py` L108–L110、L118、L120、L126 |
| ② 先拍显存快照，空闲 < 总量×0.85 当场报错；快照在建组之前 | 对 | `worker.py` L466–L470（快照/检查）早于 L497（`_init_worker_distributed_environment`） |
| ② ModelRunner 只能在选卡之后建 | 对 | `worker.py` L509（`_init_device`）→ L520（`NPUModelRunner(...)`） |
| ①–③ 由执行器建进程时调用 | 对 | vllm@0fc695fc `multiproc_executor.py` L625（init_device）→ L633（load_model） |
| ③ 权重与草稿层在同一次显存计量里；sleep mode 只能一个实例 | 对 | `model_runner_v1.py` L3729 起 `DeviceMemoryProfiler` 包住 get_model 与 drafter.load_model；`worker.py` L671 断言 |
| ③ 专家过滤默认关 | 对 | vllm `config/parallel.py` L156 `enable_ep_weight_filter: bool = False` |
| ③ 后台预取只取本 rank 那份文件 | 对 | vllm `weight_utils.py` L830–L835 `sorted_files[rank::world_size]` |
| ① GLM 的 MLA 类不是上游类，靠镜像补丁加进后处理名单 | 对 | `patch_process_weights_after_loading.py` L18–L23（名单含 `AscendIndexerKPoolMLAAttention`）；该类 `ops/indexer_kpool_mla.py` L146 继承 `nn.Module`；实例化在 `models/glm5_next.py` L2018（GLM 实际推理路径）；2c59ff10 同名补丁只认 DSAAttention（L18–L21） |
| ④ 先报规格，再量预算；预算 = requested − (权重 + 峰值 + 非 torch) | 对 | vllm `core.py` L239（get_kv_cache_specs）早于 L248（determine_available_memory）；`worker.py` L571–L590 |
| ④ 显式预算时试跑照跑 | 对 | `worker.py` L540–L541 |
| ④ EngineCore 各卡折块取最小，同一份配置发回 | 对 | vllm `kv_cache_utils.py` L2075–L2080；每个 EngineCore 只管本机 8 卡，两台之间不对齐（DP2 各自一个 executor） |
| ⑤ initialize_from_config：先准备 KV 传输，再（可选 sleep 池）分配 | 对 | `worker.py` L896–L905 |
| ⑤ 之后才是 ⑥ | 对 | vllm `executor/abstract.py` L123（initialize_from_config）→ L125（compile_or_warm_up_model） |
| ⑥ 预热列表 = compile_sizes 去掉捕获尺寸 + 未覆盖编译区间的端点；非 eager 才 capture_model | 对 | `worker.py` L695–L719 |
| ⑥ 收尾顺序：日志建议值 → ATB 预热（非 A5）→ 绑核 → 重置种子 | 对 | `worker.py` L721–L773 |
| 版本差异：v0.26/main 插 kernel_warmup 且 eager 拦不住；v0.23 没有；main 改用上游 MultiHeadLatentAttentionWrapper | 对 | 2ed6cbba `worker.py` L772–L774 在 L751/L777 的 eager 判断之外；2c59ff10 无 kernel_warmup；baa023ad `models/glm5next/attention.py` L301 |
| 镜像与 2c59ff10 行号从 load_model 起差 13 | 对 | 2c59ff10 `load_model` L681 / 镜像 L668 |

### 3. 数字对照底稿（01-deploy-entry-schedule §A0.1–A0.7）

- 20 个进程 / 16 个 Worker（§A0.1）、TP/DP/EP 三类组与 0/8 配对（§A0.2）、每卡 18 个专家与 198–215（§A0.7）、20.58 GiB（§A0.3）、54.40 / 30.00 GiB、3,855 块、7.969 MiB、640 token、5 个组（§A0.5）、7 个捕获尺寸对应 1–32 个请求（§A0.6）、290.25 / 14.57 / 304.8 / 19.1 / 610 / 305 GiB（§A0.7）：全部一致。
- 写手自报疑点「预热尺寸需实机日志」：页面没有写具体预热尺寸，只写机制，并在源码区「缺口」列了 `Compile and warming up model for size` 日志待核。不算 P1。补充：按源码推断，镜像在非 npugraph_ex 分支默认加 512 切点（`ascend_config.py` L488–L492，`ALLREDUCE_NORM_FUSE_THRESHOLD = 512`），区间 [513, 8192] 没有捕获尺寸，预热列表很可能只有 8192 一个；这只是推断，仍需日志，见 P3-1。

### 4. 丢信息

- `git diff HEAD` 删除行逐条对照：旧 H2「从失败位置判断依赖」的五行表已并入「会报什么错」的六行表；workspace manager（L176）、权重传输引擎（L177）、快照断言（L196）、「未实测完整加载」（缺口）都还在；relations 里 engine-processes / kv-cache-spec / vllm-kv-block-allocation 三条 builds-on 保留。
- 写手清单 `p5/npu-worker-lifecycle-facts.md` 抽查 10 项（ASCEND_RT_VISIBLE_DEVICES、v2 runner 警告、patch/worker/__init__、COMPILE_CUSTOM_KERNELS、两条报错原文、kernel_warmup、patch_weight_utils、加载器、sleep mode），勾选属实。A9「45 层混合结构」未写、B6 按源码纠正，理由成立。
- 结论：没有丢信息。

### 5. 图

- `pnpm wiki:diagrams --check`：退出码 0，「192 张图与 spec 一致」，本页两张图无告警；两张 svg 根尺寸 900×630、900×640，宽度 ≤900。
- 直觉图 `worker-lifecycle`：三列标「卡 0 / 卡 1 / 最后一张卡」，五行都有 ⋯（第②行由跨列通信线占位），正文 L60 写「有几张卡就有几个」，GLM 一节标题写 16 个 Worker，不会让人以为只有 3 个。六步先后与源码一致；图里没有字节数。
- 流程图 `worker-lifecycle-flow`：两段调用方、sleep mode 两处分支、eager 分支与源码一致；图上无代码名。
- 未做浏览器实测：本次要求不起服务、不占 5193/8790。

### 6. 链接、audit、lint

- `pnpm wiki:audit`：退出码 0；本页一行「evidence=C 章节=10 正文 15262 字 / 5 节 来源 27 条」，无告警。
- `pnpm wiki:lint`：退出码 0；本页无报错、无待留意。
- 本页出链的锚点全部能对上目标页标题。**入链有断锚**，见 P2-1。
- 没有找到指向 request-call-chain（K）的链接。K 讲的是一条请求的七站调用链，不讲启动，本页的启动调用链与它不重叠，不需要补链。

### 问题清单

**P1**

1. **L126–L135 读盘 calc 里的 14.57 GiB 没有出处，290.25 GiB 的链接指错了节，304.8 GiB 没有标成估算。** 14.57 GiB（「其余」权重还原成整份）在全库没有推导，本页也没链接；L135 说 290.25 GiB「来历见双机部署页 · 为什么是两台机器」，那一节只有每卡数字，没有 290.25（全库只在 tensor-parallel.md L380 推导）。另外底稿 §A0.7 待核 1 写明 304.8 GiB 不含视觉塔和 scale/offset，要靠 `Checkpoint size` 日志核，calc 里直接写成「整份权重文件 = … ≈ 304.8 GiB」。改法：290.25 改链到 tensor-parallel 那条推导；14.57 补一行来历（每卡其余 2,502 MiB 里 727.5 MiB 各卡相同、1,774.5 MiB 按 TP8 切，还原 = 1,774.5 × 8 + 727.5 = 14,923.5 MiB，数字出自 tensor-parallel L295–L300，链过去即可）；calc 标题或第一行注明「按权重形状还原的估算，不含视觉塔与 scale，实际看启动日志」；19.1 GiB 补「文件大小均匀时」（预取按文件个数分）。

**P2**

1. **入链断锚**：platform-plugin-registration.md L92、L166 指向 `npu-worker-lifecycle.md#请求到达前要准备什么`，该 H2 在本次重写中删掉了。改法：把两处锚点改成 `#一张卡上的-worker启动时按什么顺序做准备`（或去掉锚点）。
2. **MLA 先用后讲、链错页**：L86 顺序表已写「GLM 的 MLA 注意力层」，到 L105 才解释 MLA；L105 解释完后链接的是[稀疏注意力](sparse-attention.md)，而「把历史压成小向量」是 [MLA](mla.md) 页的内容。改法：L86 首现处加半句解释或改成「GLM 的一种注意力层（见第①步）」；L105 改链 mla.md，稀疏部分再链 sparse-attention。
3. **第④步把 D 页的 KV 算例又讲了一遍**：L141 把 64 GiB、×0.85=54.40、减 21、减 3.4、剩 30.00 整条推导用文字复述了一遍，和 D 页「剩下的显存变成多少 KV cache」重复。数字一致，所以记 P2。改法：只留结论「算例每卡 30.00 GiB → 3,855 块」和两条假设各是什么性质，推导留给 D 页链接。
4. **其他术语首现没解释**：decode（L72）、headless（L95）、MoE、dispatch / combine（L109）、MC2（L139）、prefill（L163）。改法：各加半句，或首现处链到 TERMS / 对应页（MC2 可链 D 页「为什么是两台机器」第 3 点）。

**P3**

1. L72「先按几种批量各跑一次假前向」对本部署可能不成立（按源码推断很可能只剩 8192 一个尺寸，见上文 §3）。建议改成「按预热列表里的尺寸各跑一次（本部署具体几个看启动日志）」。
2. 直觉图的 EngineCore 汇总框横跨所有 Worker，L54 又写「每个执行组一个」，但没说执行组是什么。建议 L54 写成「每个 DP 组一个，本部署两台机器各一个」，图注加「同一 EngineCore 管的那几张卡」。
3. 重复：「草稿模型不录图开关」L151 与 L164 各讲一遍；3,855 块 / 7.969 MiB 在 L78、L139、L145 出现三次。误解节可以只留一句加回指。
4. L113 CPU 通信组同步的是 `[has_unfinished, pending_pause]` 两个量（底稿 §A0.2），页上只写了前一个。
5. 源码位置可补 `models/glm5_next.py#L2018`（GLM 实例化 `AscendIndexerKPoolMLAAttention` 的地方），让「GLM 实际用的是这个类」有直接证据。
6. 流程图「收尾」框漏了 ATB 预热前的那条建议显式预算日志（正文 L155 有）。

### 本批验收要点

- 本页只讲启动：第④步推导链到 kv-cache-memory-profiling，块借还链到 vllm-kv-block-allocation，分层总览链到 vllm-ascend-overview，都没有在本页重讲；唯一的重讲是 P2-3 那句 D 页算例复述。
- MLA 出处指向 GLM 实际推理路径（镜像补丁名单 + `ops/indexer_kpool_mla.py`），正确；只是概念链接指到了稀疏注意力（P2-2）。
- 版本口径：v0.23 = 2c59ff10（没有 GLM 代码），db701c1f 单列说明，v0.26 = 2ed6cbba，main = baa023ad。正确。
- 没有「参考来源」「这里放慢了演示」一类 meta 文本；对照源码之上没有证据角标，行内代码 0。

## P5 修订记录（09-28）

写手：Opus 写手（原作者）。按审查「问题清单」与协调人补充的第 8 条逐条处理。

**P1**

1. **14.57 GiB 的出处。** 推导在主线底稿 01 §A0.7「从磁盘读多少、分几步」（每卡非专家 2,502 MiB → 还原 (2,502 − 727.5) × 8 + 727.5 = 14,923.5 MiB）；两个分量 727.5 / 1,774.5 MiB 在 tensor-parallel「固定卡数比较 TP4、TP8、TP16：只缩小可切部分」的 calc 里。处理：读盘 calc 加了一行「其余权重还原成整份 = 1,774.5 MiB × 8 + 727.5 MiB = 14,923.5 MiB ≈ 14.57 GiB」并附旁注说明为什么乘 8 再加回；calc 下方正文链到 tensor-parallel 那一节；源码区「本页的推断」写明按底稿 §A0.7 的办法倒推。
2. **290.25 GiB 链错节。** 原链 glm-5-3-flash-two-node「为什么是两台机器」没有这条推导；改链到 tensor-parallel 源码区「开销和什么时候别开」里的权重分项 calc（288 × 43 × 3 × 4096 × 2048 × 1 B ≈ 290.25 GiB）。
3. **304.8 GiB 标成估算。** calc 标题改为「一次启动从存储读多少（按权重形状还原的估算）」，该行标签改为「整份权重文件（估算）」，旁注写明不含视觉塔和缩放系数、真值以启动日志 Checkpoint size 为准；19.1 GiB 行加旁注「预取按文件个数分，假设各文件大小均匀」；正文补一句「304.8 GiB 是按权重形状倒推的整份大小，不是量出来的文件大小」。

**P2**

4. platform-plugin-registration.md 两处 `npu-worker-lifecycle.md#请求到达前要准备什么` 改为 `#一张卡上的-worker启动时按什么顺序做准备`（只改这两处链接，git diff 2 行）。锚点用仓库的 createSlugger 核过：本页 49 条出链、该页 11 条出链，0 条断锚。
5. MLA：顺序表首现处补「一种把每个历史位置压成一条短向量来存的注意力层」；第①步改为「MLA（Multi-head Latent Attention）……见 [MLA](mla.md)」，稀疏部分另链 sparse-attention。
6. 第④步删掉 64 → 54.40 → 30.00 GiB 的文字复述，只留「算例每卡 30.00 GiB、3,855 块」的结论、两条假设的性质，以及到 glm-5-3-flash-two-node「剩下的显存变成多少 KV cache」的链接。依赖代号核对：D = glm-5-3-flash-two-node、R = one-request 与本页用法一致；K = request-call-chain 本页原来没有链接，在第一节末补了一句「六步走完以后每一步的计划怎样发到 Worker」链过去。没有按别的含义理解的地方。
7. 术语首现补解释：decode / prefill（第一节第 6 条）、headless、TP8 / DP2 / EP16、W8A8、MoE 与「专家」（GLM 一节开头）、dispatch / combine（第②步，并链 expert-parallel）、MC2（第④步，链 one-request「MoE 通信走 MC2 还是 AllGather」）、KV 传输（第⑤步）、ATB（第⑥步）；EngineCore 的「执行组」改成「管着一组一起执行前向的卡，本部署两台机器各一个」，图后补一句汇总框指的是哪个 EngineCore。

**第 8 条（块数）**

- 第⑤步和「常见误解」里原来写的「R1 借到 15 块」都删掉具体块数，改为「块要等调度第一步才借、请求结束再还」，链到 vllm-kv-block-allocation「放到 GLM 双机：R1 从借块到还块」（锚点不含数字，块数微调不会断链）；原来指向 one-request 带「15 个块号」标题的锚点一并去掉。页上剩下的块数只有池子总数 3,855（D 页算例，只作结论引用）。

**P3（顺手处理）**

- P3-1：第一节和第⑥步改为「按预热列表里的尺寸各跑一次，本部署具体几个看启动日志」。
- P3-2：见上面第 7 条。
- P3-3：「常见误解」里草稿模型不录图那条缩成一句并回指第⑥步。3,855 / 7.969 MiB 的三处出现没有再删，各处作用不同（动机、第④步结论、第⑤步块号大小）。
- P3-4：CPU 通信组改为「同步两件事：还有没有请求没做完、要不要暂停」。
- P3-5：sources 加 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2018`，源码位置补一句 GLM 在这里实例化 `AscendIndexerKPoolMLAAttention`（未加角标，全页角标仍为 30 处）。
- P3-6：流程图「收尾」框改为「建议值日志 → ATB 预热 → 绑核 → 重置种子」，已重新生成 svg。

**验证**

- `pnpm wiki:lint`：退出码 0（本页无条目；platform-plugin-registration 的 mark-flood 提示是原有的，与这次改链无关）。
- `pnpm wiki:diagrams --check`：退出码 0，192 张图与 spec 一致。
- `pnpm wiki:audit`：退出码 0；本页来源 28 条全部有效。
- 单页标准检查：行内代码 0/千字、对照源码之上角标 0、calc 0.22/千字、无相邻块、图先行、免责 0%、图宽通过；全页角标 30 处。
- 未截图、未起服务。

## P5 复审（09-28）

复审人：新开的独立审查员（Opus 5.5），只审不改。范围：首审三条 P1 的修订、P2 抽查、删除行、三条工具。**结论：9/10，可入名单（`scripts/wiki/standard-pages.json` 现在还没有这一页）。**

### P1-1 读盘 calc 的 14.57 GiB：已解决

- 出处对得上。`1,774.5` 与 `727.5` 两个分量在 `wiki/concepts/tensor-parallel.md` L296、L298（都在「固定卡数比较 TP4、TP8、TP16：只缩小可切部分」L280 的 calc 里），底稿同一条还原写在 `docs/mainline/01-deploy-entry-schedule.md` L354–L363（§A0.7「从磁盘读多少、分几步」）。本页 L129–L130 的算式 `1,774.5 × 8 + 727.5` 与底稿 L362 的 `(2,502 − 727.5) × 8 + 727.5` 同值。
- 含义对得上「读盘」。727.5 MiB 是每卡各收整份的 replicated 部分，文件里只存一份；1,774.5 MiB 是 TP8 分片，文件里存 8 份，所以乘 8 再加回；两台机器是 DP 副本，不再乘 2——×8 而不是 ×16 是对的。L130 的旁注把这层意思写清楚了。
- 算式算对了。14,923.5 MiB ÷ 1024 = 14.5737 GiB ≈ 14.57；290.25 + 14.57 = 304.82 ≈ 304.8；2 × 304.8 ≈ 610；304.82 ÷ 16 = 19.05 ≈ 19.1（与底稿 L369 同口径）。290.25 GiB 本身：288 × 43 × 3 × 4096 × 2048 = 311,653,564,416 B，除 1024³ 正好 290.25，精确。
- 单一出处：全库 grep，`14.57 / 14,923` 只出现在本页（`290.25` 在本页与 tensor-parallel，本页只引用不重推；`727.5 / 1,774.5` 在本页只作为输入并链回 TP 页）。本页没有变成第二个推导出处，不记 P2。

### P1-2 290.25 GiB 的链接：已解决

L140 链到 `tensor-parallel.md#开销和什么时候别开`。锚点用仓库 `createSlugger` 核过可解析；目标节 L369–L407 里 L375 的引导句就是「权重分项核对」，L380 是 `288 × (42 + 1) × 3 × 4096 × 2048 × 1 B ≈ 290.25 GiB` 的推导本体。链接文字「TP 页的权重分项核对」与目标一致。

### P1-3 304.8 GiB 标估算：已解决

calc 标题（L128）、行标签（L131）、旁注（L132）、正文（L140）、源码区「本页的推断」（L243）五处都写成估算。依据成立：底稿 L350 的还原口径写明「视觉塔、scale/offset 不计」，L388 写明真值看启动日志；`Checkpoint size` 日志量的是磁盘上全部 safetensors 的字节（`vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L917-L923` 的 `_get_checkpoints_size_bytes`），所以视觉塔和缩放系数确实是差异来源。措辞清楚。

### P2 抽查：四条都已处理

1. 入链：全库 grep 本页 id，带锚点的入链只有 `platform-plugin-registration.md` L92、L166 两处，都是 `#一张卡上的-worker启动时按什么顺序做准备`，用 slugger 核过可解析；该页 `git diff HEAD` 只有这 2 行改动，没有顺带改别的。
2. MLA：首现在 L87 的顺序表，括号里有中文解释并回指第①步；L106 给了英文全称 + 中文解释并链 `mla.md`，稀疏部分另链 `sparse-attention.md`。
3. D 页 KV 算例：全库 grep，本页已无 `54.40`、`64 GiB × 0.85` 一类复述；L144/L146 只留「每卡 30.00 GiB、3,855 块」的结论、两条假设的性质和到 D 页的链接。
4. 术语首现：decode / prefill（L73）、headless / MoE / W8A8 / TP8·DP2·EP16（L96）、dispatch / combine（L110）、MC2（L144）、KV 传输（L150）、ATB（L160）都有半句解释。
5. 块数（协调人第 8 条）：L152 只说「调度第一步才借、请求结束再还」，链 `vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块`；L167 的误解条只回指第⑤步。页上剩的块数只有 3,855（L79、L144）。指向 one-request 的锚点只剩 `#moe-通信走-mc2-还是-allgather`、`#示例请求-r1-与官方双机部署`，带数字的旧锚点已去掉。
6. 出链整体：本页 49 条 md 链接，文件与锚点全部可解析，0 条断链（用仓库 slugger 逐条核）。

### 删除行

`git diff HEAD -- wiki/concepts/npu-worker-lifecycle.md`：204 增 41 删。41 条删除行全部属于重写前的旧版（旧 title/summary/aliases、两条 sources 行、三条 relations 备注、七个旧 H2 的正文、旧「从失败位置判断依赖」表），与首审 §4 核过的是同一批；本轮修订新删的只有 D 页 KV 算例复述和具体块数两处，结论与链接都还在（见上）。注意：本页在首审前就未提交，git 无法把「本轮修订」单独切出来，所以这一条是按首审结论加 grep 反查得到的，不是纯 diff 证据。

### 工具

- `pnpm wiki:lint`：退出码 0，尾行「ok wiki:lint 通过（另有 17 处待留意）」；grep 本页 id：0 命中。
- `pnpm wiki:diagrams --check`：退出码 0，尾行「ok wiki:diagrams 192 张图与 spec 一致」；grep `worker-lifecycle`：0 命中。
- `pnpm wiki:audit`：退出码 0，尾行「ok wiki:audit 本地引用与行号校验、名单页写作标准通过」；本页一行「evidence=C 章节=10 正文 16477 字 / 5 节 来源 28 条」，无告警。本页不在名单里，所以 audit 没有跑它的写作标准；手工核：对照源码之上角标 0、行内代码 6 处、calc 共 1 个且前后都是段落（不与表格相邻）、五个源码 H3 齐全且顺序正确、版本差异节出现 v0.23 / v0.26 / main。

### 新问题（都是 P3，不拦入名单）

1. L132 旁注只说「不含视觉塔和缩放系数」，没说方向。底稿 §A0.8（01 号 L473）写的是「实际字节略大于下式」；另外 tensor-parallel L297 的口径还忽略了 KiB 量级小项。建议补半个字：真实文件只会更大。
2. L140 的 290.25 链接落点在 TP 页的「对照源码」区，读者从教学正文跳进源码区。链接文字已写明是「权重分项核对」，可接受；若要更稳，可在链接后补半句说明那是 TP 页源码区的核对表。
3. 19.1 GiB 由 304.82 ÷ 16 = 19.05 进位而来，与底稿一致，但进位方向没有痕迹；不改也行。

### 跳过了什么

按纪律跳过 frontmatter 的 sources 清单正文、「## 对照源码」的正文（只 grep 核 H3 齐全与版本号）、HANDBOOK 与 docs/plans/。没有起服务、没有浏览器实测（本轮要求不占 5193/8790），所以图和排版的实际渲染效果未复验。读 L173 之后的源码区时被安全分类器拦过一次，之后改为只用 grep 统计，未再读该节正文。

## P3 收尾（09-28）

1. **304.8 GiB 的估算方向。** 核了 vllm@0fc695fc `weight_utils.py#L916-L927`：`total_bytes = _get_checkpoints_size_bytes(sorted_files)`，日志 `Checkpoint size` 就是目录里全部 safetensors 文件大小之和。calc 旁注改为「不含视觉塔和缩放系数；启动日志的 Checkpoint size 把全部 safetensors 文件大小相加，真值只会比这个数大」，calc 下方正文补同一句并注明「按同样的精度口径」（本页的还原按加载后精度计，若文件里某层精度与加载后不同，方向要另核）。
2. **290.25 的链接。** TP 页正文（对照源码之上）「先区分：哪些权重归 TP，哪些已经由 EP 分走」有这组数的结论，改链到该节；链接后写明「逐项推导在 TP 页的开销一节」。没有改 TP 页。
3. **19.1 → 19.05。** 304.8 ÷ 16 = 19.05，calc 里改为「≈ 19.05 GiB」；同一 calc 的前台过手行改为「2 × 304.8 GiB = 609.6 GiB」，与全页 GiB 两位小数的写法一致；正文叙述仍写「约 610 GiB」。

验证：本页出链 49 条、0 条断锚；`pnpm wiki:lint` 退出码 0；`pnpm wiki:audit` 退出码 0（名单 41 页全部达标，含本页）。
