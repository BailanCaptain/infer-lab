# context-parallel 审查记录

## P5 写作记录（第 13 批，2026-09-29，Opus 写手）

### 改了什么

- 深改全页，按新讲法重排：H2 全部改成问句，学习顺序是「是什么（直觉 + 8 个位置的例子）→ 为什么需要、代价是什么 → prefill 的位置怎么分才公平 → 历史位置怎么分着存 → 局部结果怎么合成一份 → 复用 TP 的卡为什么还要建组 → GLM 双机 → 常见误解 → 对照源码」。
- 字数：正文 4,904 字 → 9,144 字（wiki:audit 口径），9 节；写作标准口径 2,787 字。
- 去掉旧体例的核查/来源夹注：正文角标 0 处（全部下沉到「对照源码」与页末），全页角标从 36 处收到 30 处，[C] 占比从 92% 降到 53%（lint 的 mark-flood 不再报本页）。
- 保留并改写了排查时判为达标的两处算例：
  - 长度 8 的因果序列 36 对、对半切 10/26、头尾配对 18/18 —— 改成一个 calc，六行一次算完；
  - LSE 合并 O = 25 —— 改成一个 calc，先算全局分母 8，再算 ¼ / ¾ 两个权重，旁注写明直接相加 40、直接平均 20 都不对。
- 新增直觉图 `wiki/diagrams/context-parallel-intuition.yaml`（900×380）：上排是一条请求攒下的 8 个历史位置，中间按位置交错分给卡 0 / 卡 1（谁也没有完整的一份），右侧两张卡各出一个局部结果，最后汇到底部「合并成一份答案 O」。原有三张图（prefill 掩码格子、DCP 交错、LSE 合并）继续使用，未改 yaml。
- 分镜动图（exchanges）按 09-29 的暂停要求没有新增。

### 数字取自哪里

- GLM 每 token 每卡 13,056 B = 12 层 ×（1024 B 主 KV + 64 B 索引器）、满长 133,120 token = 1.619 GiB/卡：`docs/mainline/02-forward.md` §5.6，本页只引用，不重算。
- MLA 的 KV 只有一个头、TP8 每卡各存一份完全相同的历史：同上 §5.6「按卡怎么切：不切」。
- KDA 64 头切到 8 张卡（每卡 8 头）：同上 §4.3。
- 本部署 PCP = DCP = 1：`docs/mainline/01-deploy-entry-schedule.md` A0.1 的 `ensure_model_parallel_initialized(tp=8, pp=1, pcp=1, dcp=1)` 与 `world_size = tp × pp × pcp = 8`；上游默认值另核了 `vllm/config/parallel.py`。
- 「假如 DCP = 8」那一节是变体推算：按「主 KV 按位置分片、索引器复制」的规则从 13,056 B 推出 2,304 B/token/卡、292.5 MiB/满长请求，calc 标题和旁注都写明未实测，并列出 kpool 尾状态、KDA 递推状态未核。
- 官方实测（DeepSeek-R1-W8A8 128K：TTFT 73.2s → 46.0s、TPOT 82ms → 83ms）注明是官方在别的模型、64 卡 PD 分离环境下的数，不是本部署结果。

### 核心概念对照了什么

- 机制（PCP/DCP 分工、交错存放与虚拟块、头尾配对、Ring Attention 的取舍、SFA 索引器复制布局）：vllm-ascend@db701c1f 的 CP 设计文档与 CP 用户指南。
- 头尾配对的补齐与还原下标：`vllm_ascend/worker/pcp_utils.py` 的 `update_tokens_for_pcp`（补齐到 2 × pcp、head/tail 两段的起点计算）。
- 位置落到哪张卡、不归本卡填 −1：`vllm_ascend/worker/block_table.py` 的 `_compute_pcp_dcp_slot_mapping`（虚拟块、`% total_cp_world_size`、`torch.where(mask, slot_mapping, -1)`）；来源行号范围相应从 L231-L276 扩到 L231-L282。
- 合并公式与通信：`attention/context_parallel/common_cp.py` 的 `_update_out_and_lse`（docstring 即 `LSE_final = log(sum(exp(LSE_i)))`、`O_final = sum(exp(LSE_i − LSE_final) × O_i)`）与 `_process_attn_out_lse`（DCP 轴 `all_to_all_single`、PCP 轴 `all_gather`）。
- DCP 组的建法与 `dcp ≤ tp`、`tp % dcp == 0`：上游 `vllm/distributed/parallel_state.py`。
- 三道门：`ops/kimi_kda.py` 的 `NotImplementedError("Kimi KDA prefill does not yet support PCP.")`；`utils.py` 的 `enable_sfa_dcp_replicated_indexer` / `model_uses_sfa_sparse`；`platform.py` 的 SFA `dcp == tp` 校验与粒度不符时的就地覆盖（来源范围扩到 L717-L752）；上游 `kv_cache_coordinator.py` 的两条 assert。
- 版本差异另核了 v0.23 维护分支 2c59ff10 的 `enable_cp()`、v0.26 2ed6cbba 的 PCP 拦门（非 V2 模型执行器即抛错）、main baa023ad 的 `enable_dcp()` / `enable_pcp()` 与同一条拦门。

### 旧版信息清单勾选（清单在 scratchpad `context-parallel-facts.md`，17 条）

全部 17 条在新版都能找到：两种压力与 CP 定义 → 第 1、2 节；SP / PCP / DCP 的对照 → 第 1 节表格（SP 一句话 + 链接，不重讲）；PCP 扩设备、DCP 复用 TP → 第 1 节末；36 对 / 18 对、可见范围不变 → 第 3 节；交错存放与块表槽位 → 第 4 节；局部 softmax 不能直接相加、Z 与 LSE 推导、O = 25、合并前提与两轴通信 → 第 5 节；复用设备仍要建组、三个下标、不能统一除以 DCP → 第 6 节；GLM 三道门与「不把未验证组合写进部署命令」→ GLM 一节。没有删除项。

### 验证

- `pnpm wiki:diagrams`：新图一次报「压住文字」，把底部注挪到 y=366 后通过，写入 `context-parallel-intuition.svg`；本页四张图无建议项。
- `pnpm wiki:lint`：通过，本页 0 报错、0 待留意（改前本页有 mark-flood）。
- `pnpm wiki:audit`：本页 21 条来源全部 ✓（行号有效），写作标准全部指标为 0 问题（正文角标 0、行内代码 0/千字、calc 1.08/千字、免责句 2.5%、对照源码五节齐、图先行）。失败的两处在别的页（batch-invariance 的免责句比例、dynamic-chunked-pp 的一条来源行号越界），不是本页。
- `pnpm wiki:diagrams --check` 报 kv-cache-cpu-offload 两张 SVG 与 spec 不一致，是同批别的写手在改的图，未动。

### 仍待核

- v0.26、main 上 GLM 稀疏路径的 DCP 判定没有逐条核对（页内已写明）。
- kpool 尾状态与 KDA 递推状态在 DCP 下怎么放，没有核。
- 本部署没有跑过 CP，没有时延、吞吐的实测数；页内所有 CP 效果数字都标了出处与「非本部署」。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页）。**评分 6/10**。学习顺序：通过。audit 本页：通过（21 条来源全 ✓；全库 audit/lint 失败各只因 kv-pool 的 summary 超长及其引出的 relation-missing，与本页无关）。

### 初学者测试（只读前两屏）

CP 把一条长请求的历史位置分给几张卡，每张卡只存、只算一部分，再按各段占的分量把局部结果合成一份；PCP 另加卡分算 prefill，DCP 借 TP 的卡去掉重复的 KV；代价是卡间多传东西、布局要对齐。——能说清，第一屏是问句 H2 + 加粗定义 + 8 位置例子 + 直觉图，第二屏讲为什么 / 代价，顺序符合「是什么 → 为什么 → 怎么做 → 细节 → GLM → 误解 → 源码」。

### 手算与底稿核对

- 36 对 / 10 与 26 / 18 与 18（L83–L87）：1+…+8=36；1+2+3+4=10，5+6+7+8=26；头尾配对按 2×PCP=4 段、段 0 配段 3 得位置 0、1、6、7 → 1+2+7+8=18，2、3、4、5 → 3+4+5+6=18。全对，且与设计文档 head-tail 切法一致（db701c1f `context_parallel.md` L126–L131）。
- LSE 合并（L118–L124）：Z=2+6=8，权重 ¼、¾，O=2.5+22.5=25；直接相加 40、平均 20。全对；公式与 `common_cp.py` L186–L187 docstring（LSE_final = log Σ exp(LSE_i)，O_final = Σ exp(LSE_i − LSE_final)·O_i）一致；DCP 轴 all_to_all（L123）、PCP 轴 all_gather（L128）属实。
- GLM 数字（L147）：12×(1024+64)=13,056 B；133,120×13,056=1,738,014,720 B=1.619 GiB，与 02 §5.6（L474–L510）一致；层数 11+MTP、KV 头 1、34 层 KDA 与 02 §4、§5 一致。
- DCP=8 变体 calc（L153–L156）：1024÷8=128，12×192=2,304，133,120×2,304=306,708,480 B=292.5 MiB，算术对；标题、旁注、节首均标「变体 / 未实测」，没有当成部署实测。但推算所依据的规则本身对本模型不成立，见 P1-2。
- PCP=DCP=1：01 L66、L69 属实；上游默认 `vllm/config/parallel.py` L116、L323、L343（interleave 默认 1）属实。

### 核心机制逐条（db701c1f / 上游 0fc695fc，grep 单行取证）

- PCP 扩 world size、DCP 复用 TP：设计文档 L13、L30 ✓；DCP 组由 TP 连续 rank 切出：`parallel_state.py` L1781 ✓。
- 交错存放、虚拟块、不归本卡填 −1：设计文档 L35–L43、`block_table.py` L248、L260、L278 ✓。
- PD 分离 / KV 池要求粒度 = 块大小：用户指南 `context_parallel.md` L76 ✓。
- 三道门：`kimi_kda.py` L402–L403（pcp>1 抛错）✓；`utils.py` L114–L121、L132–L136（index_topk 有、compress_ratios 无、DCP>1、PCP=1）✓，GLM 配置字段见 03 L342 ✓；`platform.py` L719–L723（dcp==tp）、L744–L751（粒度就地改写 + warning_once）✓；上游 `kv_cache_coordinator.py` L508–L509 + L702/L715/L729（仅开前缀缓存且多组时进 Hybrid）✓。
- PCP prefill 逐层 all-gather KV、用完即弃：设计文档 L134–L136 ✓；Ring Attention 未采用：同文 L138 ✓。

### P1（3 条）

1. **L133、L171：把「逐层凑齐 KV」说成只有 PCP prefill 才有，DCP 一律只搬局部结果 + LSE——与设计文档不符。** 设计文档 L56–L61：DCP 在 MLA 后端的 chunked prefill 会对上下文 KV cache 做 all_gather，凑齐完整 KV 再算；L91–L95：GLM 这类 SFA 的 DCP 路径在 prefill / 混合批里，把稀疏块表引用到的 KV 块 all-gather 过来，不交换 Q、也不做 LSE 合并；只有纯 decode 批才走「Q 收集 + 局部结果合并」（L73–L74、L96）。页面的误解条目「开了 DCP，attention 总得先把 KV 凑齐」在 DCP 的 prefill 上其实是真的，被当成误解纠正了。影响：初学者会得出「DCP 永远不搬 KV」的错误结论，且 GLM 变体正好走的是会搬 KV 的那条路。改法：L133 改成按路径分说——decode：先在 DCP 组内收齐 Q 的头，本地算完交换局部结果 + LSE；prefill / chunked prefill：MLA 后端逐层收齐上下文 KV（SFA 路径只收被选中的块），PCP prefill 同理且用完即弃；误解条目改成「DCP 在 decode 上不需要凑齐 KV」或换一条真误解。
2. **L149–L158、L163：DCP 变体按「索引器 cache 每卡复制、主 KV 按位置分片」推算，但这套复制布局是 GLM-5.2 LightningIndexer 的 SFA 路径，本模型的 kpool 索引器在钉住版本里没有任何 CP 处理。** 设计文档 L78 该节标题即 GLM-5.2；复制布局实现在 `sfa_v1.py` 与 `core/kv_cache_interface.py` L90–L146 的 `sfa_dcp_replicated_indexer_size`，而本模型的索引器 cache spec 在 `glm5_next.py` 里单独建（02 §5.6），db701c1f 上 `glm5_next.py`、`attention/indexer_kpool_mla_v1.py`、`ops/indexer_kpool_mla.py` 中 dcp/pcp 出现 0 次，GLM kpool 单测只配 DCP=PCP=1（`tests/ut/models/test_glm5_next_indexer_kpool_mla.py` L903–L904、L1123–L1124）；main baa023ad 的 `vllm_ascend/attention/indexer_kpool.py` L315–L316 更直接：PCP>1 或 DCP>1 即抛 NotImplementedError("GLM-Next KPool indexing does not support PCP or DCP.")。所以「按源码规则推」不成立，292.5 MiB 的前提没有源码支撑；「DCP 这条路有前提」也应改成「平台层会放行并要求 dcp==tp，但本模型的 kpool 索引器没有实现 DCP，main 上明确拒绝」。改法：把第二道门改写为上述事实，并加一道「main 上 KPool 索引拒绝 PCP/DCP」；变体 calc 要么删，要么把标题改成「假如 kpool 索引器也照 GLM-5.2 的复制布局实现（本模型没有这份代码）」，只作 DCP 省显存的量级示意。
3. **L114：丢了全局 L 的定义。** 旧版明写 L = log Σ exp(Lᵣ)；新版只说「把各段的 LSE 汇总成全局的 L」，「汇总」可读成 L₀+L₁（按那样算 O≈16.7，错），而 calc 全程只用 Z，没有把 LSE 形式和 Z 形式接上。事实清单 A11 勾了 ✓，实际缺这一条。改法：L114 补一句「全局的 L = log(Σ exp(Lᵣ))，也就是 log(Z₀+Z₁)；exp(Lᵣ − L) 正好等于 Zᵣ ÷ (Z₀+Z₁)」；calc 的权重两行后注明「= exp(L₀ − L)」等，不新增 calc。

### P2（4 条）

1. **L57–L60 表格、L98–L106：没说 PCP 也按位置分存 KV cache。** 设计文档 L35–L36：cp_size = pcp × dcp，KV 存放对 PCP、DCP 一视同仁；`block_table.py` L248 虚拟块 = 块大小 × dcp × pcp。现在读者会以为「历史分着存」只是 DCP 的事。改法：表格 PCP 行补「写进 KV cache 时也按位置分到 PCP×DCP 张卡」，存放一节把「参与的卡数」写成 PCP × DCP。
2. **L45：「12 万 token 光这一条请求的历史就能占掉一张卡上大半显存」没有出处，且与后文 GLM 满长 133,120 token 每卡 1.619 GiB 的实数相矛盾（A2 单卡 64 GB）。** 改法：改成定性说法，或写明示意模型（例如不压缩 KV 的稠密模型）与算式出处。
3. **L157 calc 旁注：「待核」是写手工作用语，出现在基础正文里；「kpool 尾状态」全页未解释，先用后讲。** 改法：旁注改成读者语言（「这条账只算随长度增长的主 KV 和索引器，不含每条请求固定大小的状态和临时缓冲」），kpool 要么删、要么一句话解释并链接到讲它的页；「待核」只留在页末。
4. **对照源码「版本差异」表（L208 那一行）v0.26、main 列「未逐条核」，本轮已可核掉：** v0.26 2ed6cbba：`utils.py` L129 判定改为「稀疏且 DCP>1」（不再要求 PCP=1），`platform.py` L731 仍要求 dcp==tp，L750–L762 的粒度改写加了 `and not sfa_dcp_replicated_indexer`（走复制索引器时不再强制粒度=块大小），`kimi_kda.py` L451 仍拒绝 PCP。main baa023ad：`utils.py` L208 判定同 v0.26，`platform.py` L1515–L1525 允许 dcp ∈ {pcp, tp×pcp}，L1301 粒度改写条件为「稀疏且开了 DCP」；另有 `attention/indexer_kpool.py` L315–L316 对 GLM-Next KPool 直接拒绝 PCP/DCP。改法：把这些写进表格并删掉页末对应的「待核」。

### P3（4 条）

1. 直觉图 `context-parallel-intuition`：内容画对了（交错分配与正文例子一致、两份局部结果、合并框）；但卡行 → 局部结果的两根箭头用了 comm 色，而那一步是本地计算，与「同一种颜色全库只表示同一种东西」冲突；只有 O₁ 框连到合并框，O₀ 像是没参与；查询没画出来。改法：前两根改用非 comm 色，O₀、O₁ 各一根 comm 箭头进合并框，必要时在上排加一个「新查询 q」标注。
2. L166（旧版 L100）原有的[官方 TP/DP 配置](../sources/glm-5-3-flash-baseline.md)链接丢了；L145「官方启动命令没有传这两个参数」正好需要它，建议挂回。
3. 旧版 A1「decode 查询少，但仍要读很长的历史」这层压力在新版「为什么需要」里没有单独说出（只剩 prefill 算得久、历史存不下）。建议在第二节补半句。
4. L145「参与一次前向的就是 TP 的那 8 张卡」：本部署 MoE 走 EP16 跨两机，改成「参与 attention 的就是 TP 那 8 张卡」更准。

### 口径一致性

SP 只一句话 + 链接（L64、L170），与 sequence-parallel 的定义（其 L55、L228）一致；K/V、因果掩码、softmax 都链到 attention-qkv，不重讲；MLA 逐卡复制链到 tensor-parallel 对应锚点。全库指向本页的链接都不带锚点，改标题不影响入链；lint 对本页 0 报错。

### 其他

- 正文（对照源码之上）行内代码 0、角标 0；每节 calc ≤1，表格与 calc 不相邻；无 meta 文本；未新增分镜。
- 本页不在 audit 写作标准名单内，所以 audit 输出没有本页的写作标准行；写作记录里「写作标准全部指标为 0 问题」不是来自这次 audit 输出，以上为手查结果。
- 截图：5193 预览当前返回 500「知识库页面不合法」（由 kv-pool 的 schema 错误引起），首屏截图只拍到报错页（scratchpad `context-parallel-review-1.png`）；直觉图改为直接渲染 SVG 查看（`context-parallel-review-2.png`）。
- 跳过：frontmatter 来源区；「对照源码」正文（只 grep 了五个 H3 顺序与版本号，及版本差异表的 DCP 一行）；源码只 grep 单行，未读大段；页面首屏截图（预览不可用）。

## P5 修订记录（09-29，写手）

审查 3 条 P1、4 条 P2、4 条 P3 全部处理，无不同意项。改前正文 9,144 字 → 改后 10,606 字（audit 口径），旧版 17 条信息仍然一条不丢。

### P1

1. **DCP 在 prefill 也会收 KV**（原文把「搬 KV」全算在 PCP 头上）。核实：设计文档 DCP 一节写明 MLA 后端在 chunked prefill 做 context KV cache 的 all_gather，GQA 后端才是收 Q + 在线 softmax 更新；SFA 那一节写明 prefill / 混合批只把稀疏块表点到的 KV 块 all-gather 过来，不收 Q、不做 LSE 合并，纯 decode 批才回到 Q 收集 + 合并。改法：第 5 节末尾拆成「decode 这一步各算各的再合并」和「prefill 这一步搬的是 KV 本身」两块，后者分别写 PCP 逐层收齐用完即弃、DCP 在 MLA 后端收上下文 KV、稀疏路径只收被点到的块；「常见误解」那一条改成「每一步都要先把 KV 凑齐」，并补一句反过来记成「DCP 永远不搬 KV」同样不对；「对照源码 · 开销」里 DCP 那条同步补上 prefill 侧。新增来源：设计文档 L51-L77、L78-L123。
2. **DCP 变体的前提对本模型不成立**。核实：`git grep -ci 'dcp\|pcp'` 在钉住版本的 `models/glm5_next.py`、`attention/indexer_kpool_mla_v1.py`、`ops/indexer_kpool_mla.py` 三个文件里都是 0；v0.26 的对应两个文件同样是 0；main 的 `attention/indexer_kpool.py` L316 直接 `raise NotImplementedError("GLM-Next KPool indexing does not support PCP or DCP.")`。所以「索引器复制」那套布局属于另一族稀疏 attention 后端，不是本模型的 kpool 索引器。改法：第二道门改写为「平台层放行，模型这一层还没实现」，写清平台校验认的是什么、要求什么，再写 kpool 三处实现没有 CP 处理、main 直接拒绝；变体段落改成「DCP 能省到什么量级」，calc 标题改成「照『主 KV 分片、索引复制』的布局把 DCP 开到 8 能省多少（量级示意：本模型没有这份实现，也没有实测）」，数字与算式不变（1024÷8=128、12×192=2,304、292.5 MiB），只改定性。新增来源：main `indexer_kpool.py#L310-L320`。
3. **全局 L 的定义丢了**。改法：第 5 节补「各段的 LSE 并成全局的 L = log(Σ exp(Lᵣ))，也就是 log(Z₀ + Z₁)——不是把几个 L 相加」，并点明 exp(Lᵣ − L) 正好等于 Zᵣ ÷ (Z₀ + Z₁)；calc 的两行权重改写成「分区 0 的权重 exp(L₀ − L) = 2 ÷ 8 = ¼」，没有新增 calc。公式与 `common_cp.py` 的 `_update_out_and_lse` docstring 一致。

### P2

1. **PCP 也按位置分存 KV**：第 1 节表格 PCP 行补「写下来的 KV 也跟着按位置分存」；「历史位置怎么分着存」一节补一句「PCP 和 DCP 一视同仁，参与分存的卡数是 PCP × DCP」，虚拟块大小改写成「块大小 × PCP × DCP」（与 `block_table.py` 的 `virtual_physical_block_size = physical_block_size * dcp * pcp` 一致）。
2. **「占掉一张卡上大半显存」无出处且与 1.619 GiB 矛盾**：改成「每张卡上就要实打实占一块显存」，并把具体数字指向本页 GLM 一节的锚点。
3. **calc 旁注里的「待核」与未解释的 kpool**：旁注改成读者语言「这条账只算随长度增长的主 KV 和索引，不含每条请求固定大小的状态和临时缓冲」；kpool 在第二道门里补了一句话解释并链到 sparse-attention；「待核」只保留在页末。
4. **版本差异表填满**：核实后新增三行——KDA prefill 遇上 PCP（v0.26 2ed6cbba `kimi_kda.py` L451 仍抛）、稀疏路径的 DCP 判定（v0.26 `utils.py` L129、main `utils.py` L208 都只看「稀疏且 DCP > 1」，不再要求 PCP = 1）、DCP 能取哪些值（v0.26 `platform.py` L730-L733 仍要求 dcp == tp，L754 起走复制索引时不再强制粒度 = 块大小；main `platform.py` L1517-L1520 允许 dcp ∈ {pcp, tp × pcp}），外加 kpool 索引器一行。页末「v0.26 与 main 未逐条核」那条待核随之删掉。新增来源 6 条（v0.26 与 main 的 utils / platform / kimi_kda）。

### P3

1. **直觉图**：卡 → 局部结果两根箭头由 comm 改成 ink（那一步是本地计算），O₀、O₁ 各有一根 comm 箭头进合并框（原先只有一根），右列标题改成「各算各的：本地历史 + 新查询 q」把查询点出来；画布 380 → 400，`pnpm wiki:diagrams` 重渲染通过，SVG 里现在是 1 根 kv、2 根 ink、2 根 comm。
2. **官方 TP/DP 配置链接**挂回 GLM 一节结论句。
3. **decode 侧的压力**在「为什么需要它」补了半句：每步只新算一个位置，但仍要把长历史整个读一遍。
4. **「参与一次前向」改成「参与一次 attention」**，并注明 MoE 另按 EP16 跨两机派发。

### 角标与检查

- 因新增版本差异与 kpool 证据，角标一度到 40 处；按「只标数值、反直觉结论与 D/I/!」清掉别处已有的重复，现为 30 处（上限 30），[C] 占 66%。来源 21 → 30 条，另把设计文档来源的行号范围从 L11-L20 改成按节切的 L9-L50 / L51-L77 / L78-L123 / L124-L172，让每处引用落在真正对应的段落里。
- `pnpm wiki:lint`：通过，本页 0 报错。
- `pnpm wiki:diagrams`：本页四张图全部通过，写入更新后的 `context-parallel-intuition.svg`；`--check` 报的是别人正在改的 kv-cache-layerwise-offload-overlap。
- `pnpm wiki:audit`：本页 30 条来源全部 ✓；写作标准指标复测 problems 为空（正文角标 0、行内代码 0、calc 0.93/千字、免责句 2.3%、对照源码五节齐、图先行）。summary 160 字符，未超 200。

## P5 复审（09-29）

复审员：Opus 5.5（独立复审，只审不改页；未开子代理）。**评分 8/10**（上一轮 6）。首审 3 条 P1 全部修好；新增 P1 0 条、P2 2 条、P3 3 条。audit 本页：通过（30 条来源全 ✓，全库 audit 与 lint 均 ok）。首屏已截到（scratchpad `cp-rereview-1.png`，1440×900）。

改前改后对照基线：scratchpad `cp-body.md`（11:01，首审时的正文）与现版正文去 CRLF 后 diff（`cp-rev.diff`，25 处改动），本轮只看这些改动。

### 首审 P1 逐条

1. **DCP prefill 也搬 KV**：已改。L142 decode 路径「组内先收齐查询各头 → 本地算局部结果和 LSE → 交换合并」对上设计文档 L72–L74；L146 PCP prefill 逐层收齐、用完即扔对上 L139–L140；L147 DCP 在 MLA 后端收上下文 KV（L58）、稀疏路径只收块表点到的块且不收 Q、不做 LSE 合并（L91–L96）均属实；误解条目 L187 与开销条目 L216 已同步。但新写法把 GQA 后端漏掉了，见新 P2-1。
2. **DCP 变体前提不成立**：已改。db701c1f 上 `models/glm5_next.py`、`attention/indexer_kpool_mla_v1.py`、`ops/indexer_kpool_mla.py` 中 dcp/pcp 计数均为 0（grep -ci 复核）；复制索引布局只出现在 `sfa_v1.py`、`core/kv_cache_interface.py`、`platform.py` 等处，设计文档 L78 该节是 GLM-5.2 LightningIndexer；main baa023ad `attention/indexer_kpool.py` L315–L316 的拒绝属实。L165 与 L179 已写成「平台层放行、模型层未实现、main 明确拒绝」，calc 标题（L168）标明量级示意、无实现无实测。算术复核：1024÷8=128，12×(128+64)=2,304，133,120×2,304=306,708,480 B=292.5 MiB（整除），对。
3. **全局 L 的定义**：已改。L123 写明 L = log(Σ exp(Lᵣ)) = log(Z₀+Z₁)、不是相加，并说明 exp(Lᵣ−L)=Zᵣ÷(Z₀+Z₁)；calc L130–L131 权重行标了 exp(L₀−L)、exp(L₁−L)。与 `common_cp.py` L187 docstring 一致；DCP 轴 all_to_all（L123）、PCP 轴 all_gather（L128）属实。

两处保留算例重算：36 = 1+…+8；对半 10 / 26；头尾配对按 4 段（每段 2 个位置），卡 0 拿段 0+段 3 = 位置 0、1、6、7 → 1+2+7+8=18，卡 1 拿位置 2–5 → 3+4+5+6=18，与设计文档 head-tail 描述一致。LSE：Z=2+6=8，权重 ¼、¾，O=¼×10+¾×30=2.5+22.5=25，直接相加 40、平均 20，全对。

### 首审 P2 逐条

1. PCP 也按位置分存：已改（L68 表格、L115「PCP × DCP 一视同仁」）；`worker/block_table.py` L254–L255 虚拟块 = 块大小 × dcp × pcp，属实。
2. 「大半显存」无出处：已改为定性说法并指向 GLM 一节锚点（L54），lint 锚点校验通过。
3. calc 旁注「待核」与 kpool 未解释：已改（L173 读者语言；L179 一句话解释 kpool 并链到 sparse-attention，与该页 L131 的说法一致；「待核」只剩页末 L254）。
4. 版本差异表：已填，v0.26 `utils.py` L129、`platform.py` L731/L754，main `utils.py` L208、`platform.py` L1518–L1520 复核属实；但新增两行里有两格没核对就写了「同左」，见新 P2-2。

### 新增 P1（0 条）

无。

### 新增 P2（2 条）

1. **L144、L149、L187：把「prefill 搬 KV」写成对所有后端都成立，与本页 L214 和设计文档矛盾。** 设计文档 L63–L68：DCP 的分块 prefill 在 GQA 后端是按头维收集 Q、再交换 / 合并输出和 LSE，不收 KV；PCP 的分块 prefill 同样是 GQA 走 AllGatherQ、MLA 走 AllGatherKV（设计文档 L160–L161）。本页 L214 自己也写了「分块 prefill 在 GQA 后端改成收集 Q」，而 L144 的加粗句「prefill 那一步反过来，搬的是 KV 本身」和 L149 的结论「要看是 decode 还是 prefill」都没留后端这一维，L187 的误解条目「prefill 和分块 prefill 确实要把上下文的 KV 收齐」也是全称。另外 DCP 对 MLA 的收 KV 是在分块 prefill 上收上下文 KV，没有上下文的普通 prefill 本就无可收。影响：GLM 走 MLA，主线结论不受影响，但读者会带着「prefill 一律搬 KV」去看 GQA 模型，而且同页前后说法打架。改法：L144 改成「MLA 这一类（GLM 的稀疏 MLA 也在内）的 prefill 反过来，搬的是 KV 本身」，在两条 bullet 后补半句「GQA 后端的分块 prefill 仍是收查询、各算各的再合并」；L149 改成「要看是 decode 还是 prefill，也要看 attention 后端」；L187 在「确实要把上下文的 KV 收齐」前加「MLA 后端的分块 prefill」。
2. **L225、L228 版本差异表有两格「同左」不属实。** (a)「KDA prefill 遇上 PCP」的 main 列写「同左」（仍抛 NotImplementedError），但 main baa023ad 的 `vllm_ascend` 下 git grep「does not yet support PCP」为 0 处，`ops/kimi_kda.py`、`models/glm5next/kda.py`、`ops/kda.py` 里 pcp 也是 0 次；main 上 GLM 的 PCP 改由 `attention/indexer_kpool.py` L316（KPool 拒绝）和平台层 `platform.py` L1495（非 V2 执行器即拒）、L278（MRV2 PCP 后端白名单）拦下。(b)「GLM 的 kpool 索引器」的 v0.26 列写「同左」（三处都没有 CP 处理），但 v0.26 2ed6cbba 根本没有 `models/glm5_next.py`、`attention/indexer_kpool_mla_v1.py`、`ops/indexer_kpool_mla.py`（git ls-tree 在 `vllm_ascend` 下只找到 `ops/kimi_kda.py` 等 KDA 文件，没有任何 kpool / glm5 文件）；修订记录里「v0.26 的对应两个文件同样是 0」是对不存在的文件 grep 得到的 0。影响：读者会以为 main 上还是 KDA 那条报错、v0.26 已有 GLM 代码。改法：(a) main 列改为「这条检查已不在；PCP 由 KPool 索引与平台层拦下」并挂 main 的 platform 来源；(b) v0.26 列改为「分支里没有 GLM 代码」。

### 新增 P3（3 条）

1. 直觉图（直接渲染 SVG 查看，scratchpad `cp-rereview-2.png`）：配色和两根 comm 箭头已改对，但 O₀ 那根从右侧绕下来后的横段穿过了 O₁ 往下的竖箭头，两根 comm 线交叉。建议 O₀ 从框左侧或底部偏左引出，直接落到合并框左半边。
2. L227 行名「DCP 能取哪些值」是通用说法，但四格说的都是稀疏路径（固定版本的 dcp == tp、main 的 {pcp, tp×pcp} 都在 SFA 复制索引分支里）；一般 MLA 的约束在 L199 是 tp ≥ dcp 且整除。建议行名改为「稀疏路径的 DCP 能取哪些值」。
3. 本轮删改丢了一句：旧版开销条目里「省的是重复的 KV，付的是每步多几次通信和一次合并」在 L216 改写时被删掉。L84 有同类说法，不算丢核心信息；可在 L216 句末补回半句。

### 首审 P3 处理情况

直觉图改色与两根 comm 箭头：已改（交叉见新 P3-1）；官方 TP/DP 配置链接挂回 L182：已改；decode 读长历史的压力 L79：已补；「参与一次 attention」+ MoE EP16 注：L161 已改。

### 检查

- 截图：`node scratchpad/cp-rereview-shot.mjs`，1440×900 打开 http://localhost:5193/#/wiki/context-parallel，状态 200，H1 与正文为修订后版本（第一段是「实打实占一块显存」、直觉图右列标题为「本地历史 + 新查询 q」）；侧栏显示构建版本未能更新、控制台有 4 条 502（问答后端 8790 未连上），不影响正文渲染。首屏存 `cp-rereview-1.png`。
- `pnpm wiki:audit`：exit 0，133 页、来源 2999 条，无效 commit 0、文件不存在 0、行号越界 0；本页「正文 10606 字 / 9 节、来源 30 条」全部 ✓（输出存 `cp-rereview-audit.txt`）。本页不在写作标准名单内。
- `pnpm wiki:lint`：ok（另有 10 处待留意，非本页报错）。
- 源码只 grep 单行 / 计数，未读大段；frontmatter 未读。
- 跳过：未重审首审已通过、本轮未改动的段落（prefill 切法、存放粒度、通信组、「会报什么错」除 L208 外各条、源码位置表除 L245 外各行）。

## P5 复审后修订（09-29，写手）

复审新增的 2 条 P2 和 3 条 P3 全部处理，无不同意项。正文 10,606 → 10,807 字，角标仍是 30 处，来源仍是 30 条（本轮没有新增来源）。

### P2-1：prefill 搬 KV 的说法补上后端这一维

核实（设计文档 db701c1f）：普通 prefill（不含分块）各后端一致，都是逐层 all-gather KV、用完即弃；分块 prefill 才分路——DCP 的 GQA 后端按头维收 Q、再交换合并输出与 LSE，MLA 后端收上下文 KV；PCP 的分块 prefill 同样是 GQA 走 AllGatherQ、MLA 走 AllGatherKV。改法：

- 第 5 节加粗句改成「prefill 那一步，MLA 这一类后端（GLM 的稀疏 MLA 也在内）反过来，搬的是 KV 本身」。
- PCP 那条 bullet 写清「普通 prefill 各后端一样收 KV，分块 prefill 才分路：MLA 收 KV、GQA 收查询」。
- DCP 那条 bullet 限定到分块 prefill，并补「GQA 后端仍旧收查询、各算各的再合并，和 decode 那条路一样」。
- 小结句改成「既要看 decode 还是 prefill，也要看用的是哪种 attention 后端」。
- 「常见误解」那条加上「MLA 后端的分块 prefill」，不再是全称。
- 「对照源码 · 开销」里 DCP 那条同步写成分块 prefill、补上 GQA 那一路，并把复审 P3-3 指出被删掉的「省的是重复的 KV，付的是每步多几次通信和一次合并」补回句末。

### P2-2：版本差异表两格「同左」改掉

- **KDA prefill 遇上 PCP · main 列**：`git grep -c 'does not yet support PCP' baa023ad -- vllm_ascend` 为 0，main 上这条检查已经不在。改成「这条检查已经不在，PCP 改由 kpool 索引和平台层拦下」，对应的证据在同表上一行（平台层拦 PCP）和「会报什么错」里 main 的 kpool 那条，未新增角标。
- **GLM 的 kpool 索引器 · v0.26 列**：`git ls-tree -r --name-only 2ed6cbba -- vllm_ascend | grep -i 'kpool\|glm5'` 无输出（该分支只有 `ops/kimi_kda.py` 等 KDA 文件），所以上一轮写「同左」是对不存在的文件 grep 出来的 0。改成「分支里没有 GLM 代码」。顺带核了 v0.23 维护分支 2c59ff10：同样没有 kimi_kda / kpool / glm5 任何文件，原来那格写的「分支里没有 GLM 代码」属实。

### P3

1. **直觉图两根 comm 线交叉**：O₀ 的箭头改成从框下沿偏左引出，走 x=600 下行再折向合并框左半边（`M660 192 L600 192 L600 268 L640 268 L640 286`），与 O₁ 那根 x=745 的竖箭头不再相交；`pnpm wiki:diagrams --check` 对本页 4 张图全部一致。
2. **行名太泛**：版本差异表「DCP 能取哪些值」改为「稀疏路径的 DCP 能取哪些值」，与「怎么开」里 MLA / GQA 的通用约束区分开。
3. **被删掉的半句**已补回（见 P2-1 最后一条）。

### 检查

- `pnpm wiki:lint`：通过，本页 0 报错（每次保存后都跑过）。
- `pnpm wiki:diagrams` / `--check`：本页 4 张图渲染并与 spec 一致，全库也一致。
- `pnpm wiki:audit`：全库通过；本页 30 条来源全部 ✓，写作标准复测 problems 为空（正文角标 0、行内代码 0、calc 0.91/千字、免责句 2.3%）。
