# vllm-kv-block-allocation 审查与写作记录

## P5 写作记录（2026-09-28，Opus 写手）

### 改了什么

- 深改 `wiki/concepts/vllm-kv-block-allocation.md`：p4-checkpoint 版正文 1,533 字 → 新版全文 11,500 字（教学正文 6,809 字，其余为对照源码；均为去空白字符数）。重写前最后一版 0c7e1f6 为 5,352 字。
- 结构：问题式首屏 + 一句话定义 + 直觉图 → 为什么按块借、代价（1 个 calc + 4 行分工表）→ 共享、登记与驱逐 → GLM 双机 R1 走读（池子在哪 / 第一步 15 块 / decode / 结束）→ 特殊层（KDA 组、尾状态组）→ 池子不够时抢占 → 常见误解（7 条）→ 对照源码五个 H3。
- 边界：只讲分配（块池、借出、引用计数、共享、归还、驱逐、抢占回收）。块数怎么算链接 kv-cache-memory-profiling / 部署页；block_size 含义链接 kv-cache-spec；位置→槽位链接 block-table；命中条件链接 prefix-caching；R1 的 15 块推导链接 one-request；抢占整批账链接 concurrent-requests。未重推这些量。
- 图：
  - `wiki/diagrams/block-allocation.yaml`（重画）：7 块小池子 + 0 号占位块，四步——A 借 2 块、B 共用块 1 并借块 3、A 结束倒序还、B 结束倒序还；只画块号、引用计数和队列顺序，不写字节。排队位置按 v0.23。
  - `wiki/diagrams/block-allocation-flow.yaml`（新增）：第 2 站借块判断（查命中 → 先还窗口外块 → 5 组求和比空闲 → 够/不够 → running 抢占再算 / waiting 下一步）+ 第 7 站还块路径。
  - 两张图的 pins 全部在页面 sources 内（协调者提示的 diagram-identifier 报错已消除）。
- frontmatter：sources 重建为 26 条（v0.23 上游 21 条、v0.26 2 条、main 2 条、Ascend db701c1f 3 条中含 1 条 refresh_block_size）；verified 标三版；relations 7 条。

### 数字取自底稿哪一节

- §A2.2：满长度 222 块、17 条、32 × 14 = 448、3,407 × 640 ≈ 2.18 M、≈ 68.1 K（本页 calc，唯一出处在本页）；R1 首步 7 个位置、15 块（结论，推导链接 one-request）。
- §A2.3：混合模型默认不开前缀缓存；调度块大小 lcm = 133,120、哈希粒度等于它。
- §A7：R1 生成 200 个 token → 207 个位置仍在 1 块内、结束一次还 15 块、倒序还。
- §B3：抢占流程；32 条满载 ~68,000 位置、被抢占一条还 121 块 ≈ 964 MiB、重算约 9 步（结论，推导链接 concurrent-requests）。
- 3,855 块为部署页示例口径（链接 glm-5-3-flash-two-node#两种块数各在什么时候用）。

### 核心概念对照的源码（vllm@0fc695fc，本人逐段读过）

- `block_pool.py` L130–177（单池、free_block_queue、null_block 先 popleft）、L333–363（get_new_blocks：ValueError、popleft_n、evict、ref 0→1）、L402–441（touch 摘出 ref=0 块；free_blocks 减计数、ref=0 且非 null 才回队，prepend 参数）。
- `kv_cache_coordinator.py` L88–119：一个 BlockPool，传给每组管理器。
- `kv_cache_manager.py` L196–236（关缓存直接返回空；命中上限 num_tokens−1 的注释）、L368–446（先 remove_skipped_blocks，再逐组求和与 free−reserved 比；不够返回 None；关缓存不 cache_blocks；free 倒序）。
- `single_type_kv_cache_manager.py` L101–180（ceil − 已有；运行中请求 max(需要−已有,0)，被拒草稿不退块；命中的 ref=0 块计入容量）、L259–336（整块登记；新块号记入清零列表只认三种精确规格类型）、L363–378（reversed 还块）、L448–501 与 L751–793（滑动窗口：窗口外块换成 null、未登记块 prepend、已登记 append；skipped = computed − window + 1）、L1197–1209（Mamba skipped = computed − 1，不中途还块）。
- `sched/scheduler.py` L459–509（running 抢占循环）、L753–781（reserved_blocks 只在异步加载 KV 时非 0；waiting 借不到直接 break）、L974–995（_preempt_request 全部字段）、L926–930 + `kv_cache_interface.py` L877–879（有 Mamba 组时下发新块号清零）。
- 跨版本：v0.26（vllm@568afb3a）block_pool L719–740（按有无哈希分队头/队尾，prepend 参数取消）、single_type L753–782（部分尾块登记）、touch 同 v0.23；main（vllm@84030bbe）block_pool L734–758（另：关缓存一律队头，LIFO 注释）、coordinator 单池、partial tail L817–836；三版 ValueError 字符串一致。
- Ascend db701c1f：`vllm_ascend/utils.py` L1396–1433 refresh_block_size（hybrid 在改回 128 之前 return）；其余 Ascend 行（patch_mamba_manager、patch_kv_cache_utils）沿用底稿 [C]，未逐行重读。

### 旧版信息清单勾选

清单在 scratchpad `p5/vllm-kv-block-allocation-facts.md`（40 条：0c7e1f6 版 29 条 + p4 版 11 条）。

- 保留（新版能找到）：1–7、9–13、16、17、20、22–24、27–32、34–40。例：null block → 首屏与图；倒序还及理由 → 「倒着还，让开头留得最久」；整块重算 → 共享一节（改写得更精确：prompt 恰好填满整数块时最后一整块重算）+ 源码区；命中空闲块要摘出 → 共享一节 + 源码区；排查五项 → 「会报什么错」末条。
- 改写保留：8（2048/237 例换成 640 与 R1 的 7 个位置）；14/26（v0.26 插队头规则 → 版本差异表，并落到 GLM：full/KDA 组排队尾、尾状态组窗口外块插队头）；15（线性注意力同池 → KDA 组一节，640 倒推链接部署页）；18/25（纯注意力 info 日志与改回 128 → 源码区；GLM 分支链接 kv-cache-spec）；21（旧版「main 未核」→ 本次已核 main 84030bbe）。
- 删除：19 中「块大小 128 对照」旧算例（Qwen3.6 2048 vs 128，模型已换，底稿无对应数）；33 教学例 B=4、块表 [7,2]（由直觉图的 7 块小池子替代；「写满才借下一块」保留，位置→槽位归 block-table）。
- 更正：旧版「全机只有这一队」错误。每个 DP 组的 EngineCore 各一个 BlockPool（coordinator L88–119；concurrent-requests 同口径）；p4 版的「管理范围」一条因此保留并具体化为 DP0/DP1 各一池。另更正旧版版本表：v0.23 的滑动窗口组本来就把未登记块插队头，不是 v0.26 才有。

### 验证

- `pnpm wiki:lint`：通过，本页 0 条（18 条待留意均在他页）。
- `pnpm wiki:diagrams --check`：190 张图与 spec 一致；本页两张图无「待留意」提示。
- `pnpm wiki:audit`：通过（exit 0），本页 26 条来源行号全部有效，无 diagram-identifier 报错。本页不在 standard-pages.json 名单内，写作标准只统计；手工跑 measureStandard：教学正文行内代码 0/千字、对照源码之上角标 0、calc 0.24/千字、相邻块 0、图先行、免责 0.0%、图宽合规。全页角标 29 处，其中 C 22 处（76%）。
- 未截图、未起服务，浏览器验收留给审查环节。

### 疑点（交审查）

1. 尾状态组稳态块数：底稿 §A2 与 one-request 第 7 站写「约 2 块」。按上游公式粗推，decode 步要为 4 个新 token + 3 个 lookahead 留位置、窗口 4，可能同时持有 3 块；未实跑，页面只写「底稿按 2 块记、待核」，没有写入新数。
2. 借出清零：v0.23 上游对有 Mamba 组的模型下发新借注意力块号清零，但只认 FullAttentionSpec / TQFullAttentionSpec / MLAAttentionSpec 精确类型；GLM full 组用的规格类型是否命中没有核，已列入页末待核。
3. 其他页的 lint 待留意与 diagrams 待留意（matmul-shapes、tensor-parallel-intuition 等）不属本页，未处理。

## P5 审查（09-28）

审查人：Opus 5.5 独立审查，只审不改页。对象：工作区未提交版 `wiki/concepts/vllm-kv-block-allocation.md`（271 行）。源码：`tools/repos/vllm` 工作树 HEAD = `0fc695fc6d1d`（`git rev-parse HEAD`，工作树干净）；Ascend 侧用 `git -C tools/repos/vllm-ascend show <commit>:<path>`。

### 结论

**6.5 / 10。** 结构、首屏、图、边界划分和版本表都明显好于旧版；两处 P1 同出一源：底稿把 indexer 尾状态组首步的 2 块当成常驻值，本页照抄，导致「固定 14 块」「结束还 15 块」「decode 大多数步一块都不借」三处说法在 GLM 上不成立。写手自报的两个疑点均已按源码得出结论（见下）。

### 1. 初学者测试（只读 L51–L106）

一句话：**KV 块分配就是调度器替每条请求从一个公共池子的空闲队列队头借块号、用引用计数记账（共享时大于 1）、用完减到 0 再排回队列；代价是尾块没写满的部分别人用不上、池子用光时要抢占、每步要在 CPU 上记一次账。** 能说清。

### 2. 写手疑点核实

**(a) 尾状态组稳态占几块 → 首步 2 块，此后稳态 3–4 块，不是 2 块（也不是底稿 L680 设想的 1 块）。**

- 尾状态组规格：窗口 = 块 = `compress_ratio`（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341`），`index_kpool = 4`（底稿 01 L42、L209）；该规格登记到上游 `SlidingWindowManager`（`db701c1f:vllm_ascend/core/kv_cache_interface.py#L366-L369`）。`SlidingWindowManager` 不覆盖 `get_num_blocks_to_allocate` / `allocate_new_blocks`（`vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py` L582–L805 只有 `__init__`、命中相关、`free`、`get_num_skipped_tokens` 等）。
- 每步：`num_tokens_need_slot = 已算 c + 新算 + lookahead`（`kv_cache_manager.py#L370-L373`），先 `remove_skipped_blocks(c)`（`#L381-L383`）；窗口外 token 数 = `max(0, c − 4 + 1)`（`single_type_kv_cache_manager.py#L793`），整块换成 null 并还池（`#L464-L501`）；运行中请求要借 `cdiv(need, 4) − len(req_blocks)`，`len` 含 null 占位（`#L132`、`#L146-L154`、`#L277-L283`）。
- 所以实际持有 = `cdiv(c + 7, 4) − floor((c − 3) / 4)`（decode 每步新算 1 + 3、lookahead 3，`scheduler.py#L214-L221`，MTP 归一成 `"mtp"` 走 `use_eagle()`）。首步 c = 0：`cdiv(7,4) = 2`。之后 c ≡ 0、1、3 (mod 4) 时 3 块，c ≡ 2 时 4 块。例：c = 4 → 3−0 = 3；c = 6 → 4−0 = 4；c = 200 → 52−49 = 3；c = 202 → 53−49 = 4。
- 同时推出：尾状态组每前进 4 个位置**借 1 块、还 1 块**，MTP 每步前进 1–4 个位置，所以 decode 中大约每 1–2 步就要从池子借 1 块。R1 生成 200 个 token，这一组一生约借出 50 个块号，其中约 47–48 个中途还掉。
- 影响的数字（底稿与本页同错）：每条请求常驻状态块 14 → **15–16**；满长度请求 222 → **223–224**（17 条不变）；32 条常驻 448 → **480–512**，平均每条历史 68.1 K → **约 67 K**；R1 结束还 15 块 → **16–17 块**；§B3 被抢占那条 121 块 → **122–123 块**。

**(b) 借出的块会不会被清零 → 在 GLM 双机上不会。** 写手说的「调度器侧会下发」是对的，但执行侧不做：

- 调度器侧：KDA 层是 `MambaBase`（`db701c1f:glm5_next.py#L1541`），`needs_kv_cache_zeroing = has_mamba_layers` 为真（`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L873-L879`）。full 组在调度器侧的规格会被解包成组里第一个规格（`vllm/v1/core/kv_cache_utils.py#L1710-L1716`），Ascend 补丁把主 MLA 排在第一位（`db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L200-L210`），主 MLA 的规格正是上游 `MLAAttentionSpec`（`db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L19`、`#L126-L134`），命中精确类型判断（`single_type_kv_cache_manager.py#L284-L289`），所以 full 组新块号会进 `new_block_ids_to_zero`（`scheduler.py#L926-L930`）。
- 执行侧：上游 `_zero_block_ids` 只在存在 `_kv_block_zeroer` 时才清零（`vllm/v1/worker/gpu_model_runner.py#L1103-L1106`，调用处 `#L1153-L1154`）；昇腾 worker 只在投机方法为 `eagle3` 且投机 token 数大于 1 时才调用 `_init_kv_zero_meta` 建这个对象（`db701c1f:vllm_ascend/worker/worker.py#L917-L925`，`model_runner_v1.py#L5367-L5374`）。GLM 用的是 `mtp`（底稿 01 L642、03 L17），所以清零是空操作。
- 结论：正文 L68、L163、L198 与图说「数据不擦、下次写入时才覆盖」在 GLM 双机上成立；但它不是 vLLM 的普遍行为——上游 GPU 路径上，有 Mamba 组的混合模型会在借出时把新 full 组块清零。对照源码 L236 的「没有核 [!]」可以改成已核结论。

### 3. 核心概念逐条（除上面两点外）

| 页面说法 | 判定 | 依据 |
|---|---|---|
| 一个协调器一个 BlockPool，各组管理器共用（L136、L215） | 对 | `kv_cache_coordinator.py#L107-L111` 把同一个 `block_pool` 传给每组 |
| 借：队头 `popleft_n`、开缓存时先驱逐、计数 0→1（L66、L256） | 对 | `block_pool.py#L333-L363` |
| 还：计数减 1，到 0 且非 null 才回队；v0.23 默认排队尾（L68、图） | 对 | `block_pool.py#L419-L441` |
| 倒着还（L120、L163） | 对 | `single_type_kv_cache_manager.py#L363-L378`；滑动窗口组 `free` 也倒序，未登记块插队头 `#L751-L764` |
| 尾状态组窗口外块中途还、换成 null、未登记的插队头（L175） | 对 | `single_type_kv_cache_manager.py#L464-L501`；`kv_cache_manager.py#L375-L383`（借不到也照做） |
| 发生过抢占则本步不接纳新请求（L185） | 对 | `scheduler.py#L563` |
| 抢占字段（L183、L220） | 对 | 与底稿 01 L967 一致 |
| full 组 = 主 MLA + indexer K（L136） | 对 | `db701c1f:patch_kv_cache_utils.py#L200-L210` |
| decode「大多数步一块都不借」（L150、L196） | **错（GLM 上）** | 见疑点 (a)：尾状态组约每 4 个位置借 1 块 |

### 4. 数字对照底稿（01 §A2.2 L645–L658、§A2.3 L660–L667、§A7 L768、§B3 L995–L1008）

- calc（L78–L85）222 / 17 / 448 / 2.18 M / 68.1 K 与 §A2.2 L658 一致；15 块、119.5 MiB 与 L654 一致；133,120 与 §A2.3 L667 一致；207 个位置与 §A7 L768 一致；121 块、964 MiB、约 68,000、约 9 步与 §B3 L998–L1003 一致。
- 但底稿 L658「各自先吃掉 14 块（12 + 2）」说的是首步，L768 和 L998 把它当常驻值用；本页 L76「固定占 14 块」、L189「每条请求固定 14 块」、L222、L80 的 `+ 12 + 2` 同样当常驻值。按 (a) 应为 15–16。底稿 L680 自己记着这个待核项。
- R1 = 4 个 token 是教学设定，不计。

### 5. 丢信息检查

- `git diff HEAD`：删除 32 行（除 sources 外即 p4 版全部正文）。逐条对照：分配与显存分工 → L66、L70；池作用域非全机唯一 → L134、L197；驱逐清登记 → L118；块号不跨池比较 → L134；「不是每个 decode token 都借块」→ L196；GLM 多组不能只用一个 ceil → L146、L202；引用为 0 不等于清零 → L118、L198；命中纳入本请求 → L114；三事件区分 → L118；容量不足不能两条同写 → L187；排查五项 → L222。
- 旧版清单 40 条逐条 grep：1–7、9–13、16、17、22–24、27–32、34–40 在本页；20（v0.26 哈希粒度取公约数 / `prefix_match_unit`）挪到 `kv-cache-spec.md`、`prefix-caching.md`，确有；33（B=4 `[7,2]` 教学例）按写手说明被直觉图替代，「写满才借下一块」保留在 L154。
- **缺**：清单 25 中「`get_supported_kernel_block_sizes` 只表示 kernel 支持范围」在 `wiki/concepts`、`wiki/features` 全库 grep 不到（P3）。p4 版指向 `../sources/glm-5-3-flash-baseline.md` 的链接被删（P3，可不补）。

### 6. 图

- 宽度：`block-allocation.svg` `width="900" viewBox="0 0 900 492"`，`block-allocation-flow.svg` `width="900" viewBox="0 0 900 336"`，均 ≤ 900。
- `block-allocation.yaml` 四步逐格核对：① 队列 [3..7]、块 1/2 计数 1；② 块 1 计数 2、借块 3 后队列 [4..7]；③ 倒序还，块 2 到 0 排队尾，块 1 降到 1 不回队 → [4,5,6,7,2]；④ 块 3、块 1 到 0 → [4,5,6,7,2,3,1]。与 `block_pool.py#L419-L441`、`single_type_kv_cache_manager.py#L363-L378` 一致；只画块号、计数和份数，不写字节。
- `block-allocation-flow.yaml`：查命中 → 先还窗口外块 → 5 组求和比空闲 → 够/不够 → running 抢占再算 / waiting 下一步，与 `kv_cache_manager.py#L370-L446`、`scheduler.py#L459-L509`、`#L753-L781` 一致。图里没有 14/15 这类受 (a) 影响的数。
- `pnpm wiki:diagrams --check`：exit 0，「190 张图与 spec 一致」，待留意里没有本页两张图。

### 7. 链接与锚点

- 本页 29 个站内链接（15 个带锚点）用脚本按标题 slug 逐个解析，全部命中。
- 全库 34 个文件引用本页 id，均不带锚点，不受改版影响。

### 8. 本批验收要点

- **只讲分配**：L97–L106 分工表把规格、启动量显存、槽位换算都链出去；L138 各卡取最小、L173 640 的来历、L189/L226 的字节数都只给结论加链接，没有重推。通过。
- **MLA 出处**：本页 MLA 相关出处（`patch_kv_cache_utils.py#L357-L378`、`refresh_block_size`）都在 GLM 实际走的 db701c1f 路径上。通过。补清零结论时，请用上面 (b) 列的 `indexer_kpool_mla.py`、`worker.py` 实际路径。
- **版本口径**：L242 只写了三列的 vLLM 钉点（0fc695fc / 568afb3a / 84030bbe），db701c1f 已单独标注；但没写三列对应的 vllm-ascend 钉点 2c59ff10 / 2ed6cbba / baa023ad。本页 Ascend 侧两项（`refresh_block_size`、`patch_mamba_manager.py`）在这三个提交里都存在（`git cat-file -e` / `git grep` 已查），应注明在哪个钉点核过（P2）。
- **meta 文本**：L177「主线底稿按 2 块记账，还没有实跑确认，缺口记在页末」是给写作者看的内部说明（P2）。没有参考来源说明、「放慢演示」一类文字。

### 9. 工具

- `pnpm wiki:audit`：exit 0；本页行「evidence=C 章节=11 正文 12883 字 / 8 节 来源 26 条」，无报错。
- `pnpm wiki:lint`：exit 0，18 处待留意都不在本页。
- 未做浏览器验收：本任务明确要求不起服务、不占 5193/8790。

### 10. 问题清单

**P1**

1. **尾状态组常驻块数写错，连带「固定 14 块」和「结束还 15 块」。** 位置：L76、L80、L82、L189、L222，L161 标题「结束：15 块一次还清」，L5 summary。问题：2 块只是首步；decode 稳态 3–4 块（推导见 (a)），常驻 15–16 块，R1 结束还 16–17 块。改法：先改底稿 01 §A2.2 L658、§A7 L768、§B3 L998 和 L680 待核项（单一出处），再改本页 calc（223–224 / 480–512 / 约 67 K）和 L161、L189；`one-request` 第 7 站、`concurrent-requests` 的 121 块同步。
2. **「decode 每一步：大多数步一块都不借」在 GLM 上不成立。** 位置：L150 标题、L152、L156，常见误解 L196「绝大多数步的答案是 0」。问题：full 组和 KDA 组确实多数步不借，但尾状态组每前进 4 个位置借 1 块、同时还 1 块，MTP 下大约每 1–2 步借一次。改法：标题改成「full 组和 KDA 组多数步不借，尾状态组边借边还」；L156 写成「每前进 4 个位置借 1 块、还 1 块，手里一直 3–4 块」；L196 限定为 full 组。

**P2**

1. **清零疑点已有结论，页面仍写「没有核」。** 位置：L236，另 L68、L198 的通用说法。改法：写明 GLM 双机不清零，依据 `db701c1f:vllm_ascend/worker/worker.py#L917-L925`（只有 eagle3 才建清零器）+ `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1103-L1106`；L198 补半句「上游 GPU 路径上，混合 Mamba 模型借出时会清零新 full 组块，昇腾在 MTP 下不做」。
2. **meta 文本。** 位置：L177（及 L235 的「主线底稿」）。改法：删掉，换成 P1-1 的源码结论。
3. **版本口径缺 vllm-ascend 钉点。** 位置：L242。改法：写成「v0.23 = vllm-ascend 2c59ff10（配 vLLM 0fc695fc）/ v0.26 = 2ed6cbba（568afb3a）/ main = baa023ad（84030bbe）；GLM 镜像 db701c1f 单列」，Ascend 侧两项注明核过的钉点。

**P3**

1. 术语先用后讲：「DP 组」首现 L76，到 L134 才解释；「KDA」「MLA」「indexer K」首现 L136、L148，到 L171、L175 才解释；「running / waiting」L181 没解释。首现处各加半句。
2. L247 最后一列：请求结束时，尾状态组剩下的未登记块也插队头（`single_type_kv_cache_manager.py#L751-L764`），不止窗口外块。
3. L175 讲「indexer 每 4 个 token 压成一条」这类压缩内容时，加链接到 `kv-cache-spec`（或负责 indexer 压缩的页），本页不展开。
4. 旧清单 25 的 `get_supported_kernel_block_sizes` 一条全库找不到，补进 `kv-cache-spec` 或在写作记录里注明有意删去。

### 11. 跳过的段

- 按模板跳过 frontmatter sources 区（L9–L35，只 grep 过 MLA 相关行）和「对照源码」正文（L204–L271，只 grep 了 H3 顺序、三版字样和相关行）；代码块/命令块未读。
- 没有读取被拦截的情况。

## P5 修订记录（09-28）

修订者：Opus 5.5（修订写手）。只改块数推导相关段落、清零结论、meta 文本和版本钉点；未起服务、未截图、未提交。

### 1. 独立复核：每一步各组占几块

源码：vllm@0fc695fc（`tools/repos/vllm` 工作树 HEAD = 0fc695fc）；Ascend 用 `git -C tools/repos/vllm-ascend show <commit>:<path>`。R1 = 4 个 token 是教学设定，未改。

- **full 组**：`ceil((c + n + 3) / 640)`，每 640 个位置多 1 块，中途不还。
- **KDA 组 ×3**：`mamba_cache_mode = none` 分支给需求加 `133,120 × 3`（`single_type_kv_cache_manager.py#L1073-L1078`），需求封顶 `max_model_len`，所以每组恒为 4 块；`remove_skipped_blocks` 先减 3 个投机块再按 `c − 1` 算（`#L1018-L1028`、`#L1203-L1209`），除以 133,120 为 0，中途不还。
- **尾状态组**：窗口 = 块 = `compress_ratio` = 4（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341`），登记给上游 `SlidingWindowManager`（`db701c1f:vllm_ascend/core/kv_cache_interface.py#L366-L369`）；该类在 L582–L805 只覆盖 `__init__`、命中相关、`free`、`get_num_skipped_tokens`、`get_num_common_prefix_blocks`，求块数与借块走基类。`allocate_slots` 先 `remove_skipped_blocks(c)` 再求和（`kv_cache_manager.py#L370-L383`）；窗口外 token = `max(0, c − 4 + 1)`（`#L793`），整块数 `// 4` 换 null 还池（`#L464-L487`）；运行中请求借 `max(cdiv(need, 4) − len(req_blocks), 0)`，`len` 含 null 占位（`#L132`、`#L146-L154`）；新请求走 `#L156-L167`，`c = 0` 时 skipped = 0。lookahead = 3（`scheduler.py#L212-L221`，mtp 走 `use_eagle()`）；waiting 侧也传 3（`#L736-L739`、`#L761-L772`）。
  - 手里真块数 = `cdiv(c + n + 3, 4) − floor(max(0, c − 3) / 4)`。
  - R1 首步 c = 0、n = 4 → 2；decode n = 4、c ≥ 3 → `c mod 4` 为 0/1/3 时 3，为 2 时 4；prefill 一步 n 个 → `cdiv(n + 3, 4)`（6,000 → 1,501；8,144 → 2,037）。
  - 为什么是区间：`c mod 4` 决定窗口起点在块里的哪一格；MTP 每步让 c 前进 1–4（看接受几个候选），所以每步都可能换。需求每步涨 1–4，`cdiv(·, 4)` 最多跨一次边界，还池整块数也最多 +1：每前进 4 个位置借 1、还 1；全接受每步一次，全拒每 4 步一次。异步调度下调度时的 c 含上一步未验证的候选，但逐步不减，公式与 3–4 不变（推导，未实跑）。
  - 上游佐证：`vllm/v1/kv_cache_interface.py#L499-L508` 注释「chunked prefill 时持有窗口内 sliding_window−1 个已算 token 加本步新 token」，准入上限 `cdiv(3 + 8192, 4) + 1 = 2,050`；上游工厂 `single_type_kv_cache_manager.py#L1338-L1340`、Ascend 工厂 `db701c1f:vllm_ascend/core/single_type_kv_cache_manager.py#L281-L292` 都给滑动窗口规格设这个上限；它只在 `full_sequence_must_fit` 准入检查里用（`kv_cache_manager.py#L354-L368`），`scheduler_reserve_full_isl` 默认 True（`vllm/config/scheduler.py#L140`，调用处 `scheduler.py#L770`）。
- **合计**：R1 首步 1 + 12 + 2 = 15；decode 常驻状态 12 + 3~4 = 15–16；R1 生成 200 个 token，最后一次调度前已输出 196–199 个，c = 199~202，结束还 1 + 12 + 3~4 = **16–17 块**；尾状态组一生借 52–53 个块号、途中还 49 个。满长度 208 + 12 + 4 = 224（floor(3,855/224) = 17 条不变）；32 条常驻 480–512，平均历史 66.9–67.5 K（按上限 66.9 K）。
- **清零**：调度器侧 `needs_kv_cache_zeroing = has_mamba_layers`（`vllm/v1/kv_cache_interface.py#L873-L879`），KDA 层是 `MambaBase`（`db701c1f:glm5_next.py#L1541`）；执行侧 `_zero_block_ids` 只在有 `_kv_block_zeroer` 时动手（`gpu_model_runner.py#L1103-L1106`），上游 GPU worker 只要标志为真就建（`gpu_worker.py#L586-L589`），昇腾 worker 只在 `eagle3` 且投机 token 数 > 1 时建（`db701c1f:vllm_ascend/worker/worker.py#L917-L925`；`NPUModelRunner` 不覆盖 `_zero_block_ids`，全仓只有这一处调用 `_init_kv_zero_meta()`）。GLM 用 mtp → 不清零。

### 2. 与审查员的一致与分歧

- **同意**：P1-1、P1-2、疑点 (a) 首步 2 / decode 3–4、疑点 (b) GLM 不清零；常驻 15–16、R1 结束 16–17、满长度 223–224、32 条 480–512、平均约 67 K。
- **分歧 1（§B3 被抢占那条）**：审查员写 122–123 块（在 121 上加 1–2）。常驻块变多后池子更早用光，不能只加常驻块：按总量重算，池子用光时 full 组合计 `3,855 − 384 − (96~128) = 3,343~3,375`，平均每条约 105 块 ≈ 67,000 token，被踢那条 `105 + 15~16 = 120~121 块 ≈ 956–964 MiB`，重算仍约 9 步。
- **分歧 2（R1 一生借还）**：审查员写约借 50 个、还 47–48 个；按 c = 199~202 重算为借 52–53 个、途中还 49 个。
- **分歧 3（decode 借块频率）**：审查员写「约每 1–2 步」，这依赖接受率；页面改写成「每 1–4 步，看候选接受几个」。
- **补充 1（prefill 一步）**：审查员只核了 decode。prefill 一步的尾状态组要 `cdiv(n + 3, 4)` 块，底稿 §B3「6000 token 新请求 24 块，轻松装下」错（应为 10 + 12 + 1,501 = 1,523 块，仍装得下），§B2「+ 状态组」缺数（第 1 步 2,037 块，三步手里 2,037 → 2,038 → 930，第 4 步回到 3）。
- **补充 2（抢占第三处代价）**：被抢占请求重新准入按整段约 67,000 token 算 `105 + 12 + min(16,750, 2,050) = 2,167` 块，第一个 chunk（8,068 token）实借 `13 + 12 + 2,018 = 2,043` 块，远大于它还掉的 120–121 块；waiting 侧借不到就 `break`（`scheduler.py#L774-L781`），它与后面的新请求都要等池子空出约 2,170 块。推导 [C]+[D]，未实跑。
- **补充 3（main 清零条件）**：main `baa023ad` worker L1146–L1158 多一个入口——用 model runner v2 时也建清零器；v0.23 `2c59ff10` L931–L938、v0.26 `2ed6cbba` L1025–L1032 与镜像同条件。页面版本段已写明。

### 3. 问题清单逐条处理

- **P1-1** 已改：先改底稿（§A2.2 新增尾状态组推导与表、满长度与 32 条算例；§A7 R1 结束 16–17；§B2 补尾状态组块数；§B3 全套重算；§A2 待核 1、2 与 §B3 待核 1 标已核），再改本页 calc（224 / 17 / 512 / 2.14 M / 66.9 K）、L161–L174、summary、relations；`one-request`（R，R1 块数唯一出处）第二圈与第 7 站、`glm-5-3-flash-two-node`（D）短请求一节与待核、`concurrent-requests` 整批账同步。
- **P1-2** 已改：标题改为「full 组和 KDA 组多数步不借，尾状态组边借边还」；尾状态组条目写「每前进 4 个位置还 1 借 1、手里 3 或 4 块」；常见误解限定到 full / KDA 组。
- **P2-1** 已改：页面「待核 2」删除，结论写进「开销和什么时候别开」新条「借出不清零（GLM 双机）」和常见误解「还块就是把数据清掉」；出处 C27、C28、C33 进 sources。
- **P2-2** 已改：删去「主线底稿按 2 块记账…缺口记在页末」和待核 1 的「主线底稿」字样，换成源码结论（新段落 + calc + 「尾状态组每一步借几块、还几块」条）。
- **P2-3** 已改：版本段写成「v0.23 = Ascend 2c59ff10 / vLLM 0fc695fc，v0.26 = 2ed6cbba / 568afb3a，main = baa023ad / 84030bbe；本页 GLM 行为按 db701c1f」；`patch_mamba_manager.py`、`refresh_block_size` 与清零条件在三钉点上已用 `git cat-file -e` / `git grep` 查过（refresh_block_size：2c59ff10 L1369、2ed6cbba L1240、baa023ad L1316）；清零条件三钉点行号进 sources（C34–C36）。
- **P3-1** 部分改：「DP 组」首现处加半句并链到池子一节；running / waiting 在抢占节首次出现处加解释。KDA / MLA / indexer K 首现未改（不在本次 P1/P2 范围）。
- **P3-2** 已改：版本表末列写明请求结束时剩下的 3–4 块也插队头（`single_type_kv_cache_manager.py#L751-L764`）。
- **P3-3** 已改：尾状态组段落加链接到 `kv-cache-spec`。
- **P3-4** 未处理：`get_supported_kernel_block_sizes` 一条不属于本页范围，未补。

### 4. 改了哪些文件哪些行（改后行号）

- `docs/mainline/01-deploy-entry-schedule.md`：L658–L679（§A2.2 新增尾状态组推导、表、满长度与 32 条算例）；L701–L702（§A2 待核 1、2 标已核）；L789（§A7 R1 结束 16–17）；L945–L950（§B2 尾状态组块数）；L1006–L1036（§B3 算例重算、第三个原因）；L1050（§B3 待核 1 标已核）。
- `wiki/concepts/vllm-kv-block-allocation.md`：L5（summary）；L36–L45（sources C27–C36）；L54（relations 注）；L86–L98（calc 与前后文）；L161–L174（decode 与结束两小节）；L182（KDA 首步口径）；L186–L201（尾状态组段、calc、prefill 例外）；L205（running / waiting）；L213–L217（抢占三处代价）；L221、L223（常见误解）；L247、L251（排查与空置）；L257–L263（新两条 + 待核重排）；L267（钉点）；L272（版本表末列）；L282（源码路径第 4 步）；L295–L296（源码位置两行）；L298（证据索引）。
- `wiki/concepts/one-request.md`（R）：L450（第二圈尾状态组 3 块）；L534（第 7 站：分支例 16 块、一般 16–17、借 52–53 还 49）；L579（待核改为接受率决定 16 / 17）。
- `wiki/concepts/glm-5-3-flash-two-node.md`（D）：L243（补「15 是第一步，常驻 15–16、结束 16–17」并链接）；L347（待核改为已推导、未实跑）。
- `wiki/concepts/concurrent-requests.md`：L86（第 7 站 16–17）；L235–L250（尾状态组口径、公式、四行算例）；L258（抢占代价补准入）；L483（待核改写）。
- `wiki/concepts/block-table.md`：L273（待核：回收规则已核并链接，表格格写什么仍待核）。
- 图：`block-allocation.yaml`、`block-allocation-flow.yaml` 没有受影响的块数，未改；`one-request-blocks.yaml`、`block-table-flow.yaml` 画的是首步 15 / 2，正确。

### 5. 其他页仍有旧数字（按指示未改）

- `wiki/concepts/vllm-v1-shape.md` L188：「R1 结束时，它的 15 个块号一次还回 DP0 的池子；即使生成了 200 个 token……也仍然只占这 15 块」→ 应为 16–17 块。
- `wiki/concepts/npu-worker-lifecycle.md` L162：「R1 的 15 块是调度第一步才借的，请求结束就还回池里」→ 首步 15 对，结束还回的是 16–17 块。
- `wiki/concepts/attention-backend-family.md`：无相关数字。
- 其余页的「15 块 / 15 个块号」都是首步口径，正确，未改。

### 6. 验证

- `pnpm wiki:lint`：exit 0，「通过（另有 17 处待留意）」，改过的 6 个文件无条目。中途本页一度报 mark-flood（新加角标后 45 处 > 30），已把新增两条和版本段的角标并入证据索引，复跑消除。
- `pnpm wiki:diagrams --check`：exit 0，「192 张图与 spec 一致」，待留意只在 vllm-ascend-repo-map。
- `pnpm wiki:audit`：exit 0，「无效 commit 0，文件不存在 0，行号越界 0」；本页「evidence=C 章节=11 正文 16267 字 / 8 节 来源 36 条」。
- 3–4 块、16–17 块、prefill 临时块数、准入 2,167 块均为源码推导，没有实跑。

### 7. 跳过与说明

- 按模板跳过 frontmatter sources 区正文（只 grep 定位后在末尾追加）和代码块；没有读取被拦。
- `concurrent-requests.md`、`glm-5-3-flash-two-node.md` 工作区是 CRLF 换行（HEAD 为 LF；未碰过的 `engine-processes.md` 也是），未改换行。

## P5 复审（09-28）

复审人：Opus 5.5 独立复审，只审不改页。范围：P1 修订（块数推导）及首审其余 P2。源码：`tools/repos/vllm` HEAD = `0fc695fc6d1d`；Ascend 用 `git -C tools/repos/vllm-ascend show db701c1f:<path>`（另比对 2c59ff10 / 2ed6cbba / baa023ad 各一处）。

### 结论

**8.5 / 10，通过。** 两处 P1 已按源码改对，6 个文件口径一致，首审 P2 三项与 P1-2 均已处理。块数最终结论：R1 首步 15；decode 常驻状态块 15–16（KDA 12 + 尾状态组 3–4）；R1 结束还 16–17；被抢占那条 **120–121**（同意修订者，首审的 122–123 不成立）；prefill 一步尾状态组临时借 `cdiv(c + n + 3, 4) − floor(max(0, c − 3)/4)` 块，从 0 开始即 `cdiv(n + 3, 4)` ≈ n/4。与修订者无数字分歧。新发现 1 条源码层面的 P3（昇腾 KDA 管理器求块数时每步多算 1 块，只影响「够不够」判断），不影响任何教学数字。

### 1. 独立推导

**配置数（底稿 01）**：逻辑块 640（L40）；尾状态组块 = 窗口 = `index_kpool` = 4（L42、L209）；KDA 组块 = `max_model_len` = 133,120（L43、L639），`mamba_cache_mode = "none"`（L174、L687）；lookahead = `num_speculative_tokens` = 3（L638，`use_eagle()` 含 mtp：`vllm/config/speculative.py#L1070-L1071`）；预算 8192、并发 32（L636–L637）；池 3,855 块（L239）；分组 = full ×1（12 MLA + 12 indexer）、indexer-state ×1、KDA ×3（L190–L192）。

**通用骨架**（`vllm@0fc695fc`）：`allocate_slots` 先 `need = min(c + n + lookahead, max_model_len)`（`kv_cache_manager.py#L370-L373`），再 `remove_skipped_blocks(c)`（`#L381-L383`），再各组求和与空闲块比（协调器 `kv_cache_coordinator.py#L161-L184`，`kv_cache_manager.py#L385-L398`），够才 `allocate_new_blocks`（`#L411-L416`）。基类求块数 `cdiv(need, bs) − len(req_blocks)`（`single_type_kv_cache_manager.py#L132`、`#L154`；前缀缓存关着时走 `#L156-L167` 分支，结果相同，因为 `len(req_blocks)` 含 null 占位且 ≥ 已跳过块数），借块补到 `cdiv(need, bs)`（`#L277-L278`）。

| 组 | 管理器与依据 | 每一步手里几块 |
|---|---|---|
| full | 首个规格是上游 `MLAAttentionSpec`、`compress_ratio=1`（`db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L126-L134`）→ `FullAttentionManager`，不跳块 | `ceil((c + n + 3) / 640)`；R1 全程 1 |
| KDA ×3 | 上游 `MambaBase.get_kv_cache_spec`：块 = 133,120、`num_speculative_blocks` = 3（`vllm/model_executor/layers/mamba/abstract.py#L44-L60`；GLM 的 KDA 类 `glm5_next.py#L1541` 起未覆盖）；`none` 模式求块与借块都先加 `133,120 × 3`（`single_type_kv_cache_manager.py#L1078`、`#L1129`）；跳过 `(c − 3) − 1` 个 token（`#L1026`、`#L1209`），`// 133,120 = 0` | 每组恒 4，共 12；中途不还 |
| 尾状态 | `AscendIndexerKPoolStateSpec`，块 = 窗口 = `compress_ratio`（`db701c1f:glm5_next.py#L339-L341`、`#L352-L362`）登记给上游 `SlidingWindowManager`（`db701c1f:vllm_ascend/core/kv_cache_interface.py#L366-L369`）；跳过 `max(0, c − 3)` 个 token（`#L793`），整块换 null 还池（`#L472`、`#L496`；null 不回队 `block_pool.py#L436`） | `cdiv(c + n + 3, 4) − floor(max(0, c − 3) / 4)` |

- **为什么是区间**：decode 时 n = 4，令 c = 4q + r：r = 0 → (q+2) − (q−1) = 3；r = 1 → 3；r = 2 → (q+3) − (q−1) = 4；r = 3 → (q+3) − q = 3。手里要盖住「3 个已算 + 4 个新算 + 3 个预留」共 10 个连续位置，起点落在块内第 4 格（c ≡ 2）时才跨 4 块。MTP 每步让 c 前进 1–4，r 随之变，所以只能说 3–4。`need` 随 `num_tokens` 单调不减，每前进 4 个位置借 1、还 1 → 每 1–4 步借还一次（同意修订者，首审「约每 1–2 步」依赖接受率）。
- **R1**：首步 c = 0、n = 4：full 1 + KDA 12 + 尾 `cdiv(7,4)` = 2 → **15**。第二圈 c = 4：尾 `cdiv(11,4) − 0 = 3`（one-request L450 对）。稳态 `num_tokens − c = 1`，最后一圈前已输出 o ∈ [196, 199]（一圈至多 +4），c = 3 + o = 199–202：尾 = 3/3/3/4，full `ceil(≤209/640) = 1` → 结束 `free` 还 **16–17**（`SlidingWindowManager.free` 倒序、null 不回队，`#L751-L764`）。尾状态组一生补到 52–53 格、其中 49 格途中换 null 还池。
- **被抢占那条 → 120–121**：池子用光时 32 条合计 ≈ 3,855 块，**每条平均总持有 ≈ 3,855 / 32 ≈ 120.5 块，与状态块怎么拆无关**；状态块 15–16 → full ≈ 104.5–105.5 块 ≈ 67,000 位置 → 被踢那条 `105 + 15~16 = 120–121`。首审在旧 121 上直接加 1–2 得 122–123，等于 32 条合计 ≈ 3,920 > 3,855，不可能。956–964 MiB、约 9 步（`ceil(67000/8192)`）、准入 `105 + 12 + min(16,750, 2,050) = 2,167`（上限 `cdiv(3 + 8192, 4) + 1`：`vllm/v1/kv_cache_interface.py#L488-L508`，Ascend 工厂 `db701c1f:vllm_ascend/core/single_type_kv_cache_manager.py#L281-L292`，8192 经 `scheduler.py#L234` → 协调器传入；`scheduler_reserve_full_isl` 默认 True `vllm/config/scheduler.py#L140`）均复算一致。
- **prefill 临时借约 n/4**：n = 这条请求本步新算的 token 数（chunk 长度，不是整段 prompt，除非一步算完）；4 = 尾状态组块大小（= 窗口 = `compress_ratio` = `index_kpool`）。原因：`need` 含全部 n 个新位置，而跳过只按步首的 c 算。从 0 开始 `cdiv(n + 3, 4)`（6,000 → 1,501；8,144 → 2,037）；后续 chunk ≈ n/4 + 2（§B2 的 2,037 → 2,038 → 930 → 3 逐项复算一致）。下一步 `remove_skipped_blocks` 用新 c 还掉（6,000 例还 1,499、回到 3）。**结论对。**

### 2. 一致性与残留

- 6 个文件数字一致：首步 15（1+12+2）、decode 尾 3–4 / 常驻 15–16、结束 16–17、尾一生 52–53 / 还 49、抢占 120–121 / 956–964 MiB / 约 67,000 / 9 步、准入 2,167、prefill `cdiv(n+3,4)`。页面 L5、L53–L54、L86–L98、L161–L174、L188–L201、L213–L217、L221、L247、L251；one-request L450、L534、L579；two-node L243、L347；concurrent-requests L86、L235–L250、L258、L483；block-table L273；底稿 L658–L679、L701–L702、L789、L945–L950、L1006–L1036、L1050。
- 单一出处：底稿推全部；R1 逐圈在 one-request；尾状态组算法在本页；整批/抢占表在 concurrent-requests（本页 L213 只给结论并链接）；two-node、block-table 只引结论加链接。本页 L192–L194 的 c = 200/202 例与 one-request L534 同式，属算法示例，可接受。
- 残留 grep（`14 块|固定 14|还回 15|15 块一次|121 块|122|123 块|68.1 K|448 块|222 块|68,000|大多数步一块都不借`，排除 vllm-v1-shape、npu-worker-lifecycle）：6 个文件及其余 wiki 页无旧写法；只剩底稿 **L1100**（09-27 修订记录表里的「+14 = 121 块」），属历史记录，见 P3-3。
- `git diff HEAD`（concurrent-requests、two-node 用 `--ignore-cr-at-eol`）：块数相关删行全部有对应新写法，未丢信息。one-request 与底稿 L8、L582、L599 的删改来自另一处 R1 演示长度修订，不属本次；其中底稿 L599 删掉了「`pad_token_id = 154820` 已知」一句（eos 三个 id 仍在 L799），仅记录。

### 3. 首审其余项

- P1-2（decode 多数步不借）：已改，L161、L167、L170、L221 限定到 full / KDA 组。
- P2-1 清零：已改，L223、L258；底稿 L702、L1050 标已核。独立核对 `db701c1f:vllm_ascend/worker/worker.py#L917-L925` 的 eagle3 条件与首审一致。
- P2-2 meta 文本：正文 grep「主线底稿|缺口|页末」无结果，已删。
- P2-3 钉点：L267 已写三列 Ascend / vLLM 钉点并单列 db701c1f。
- P3-1 部分、P3-4 未处理：修订记录已说明，维持 P3。

### 4. 工具

- `pnpm wiki:lint`：exit 0，「通过（另有 17 处待留意）」，6 个文件无条目。
- `pnpm wiki:diagrams --check`：exit 0，「192 张图与 spec 一致」，待留意只有 vllm-ascend-repo-map。
- `pnpm wiki:audit`：exit 0，「无效 commit 0，文件不存在 0，行号越界 0」；本页「evidence=C 章节=11 正文 16267 字 / 8 节 来源 36 条」，另 4 页均有正常行。

### 5. 问题清单（均为 P3，不阻塞）

1. **（新）昇腾 KDA 管理器求块数时每步多算 1 块。** `db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L76-L80`：`total_computed_tokens > len(new_computed_blocks) × block_size` 且有新 token 就 +1。本部署无前缀命中，`new_computed_blocks` 每组为空（`vllm/v1/core/kv_cache_manager.py#L171-L173`），所以**每条已在跑、c > 0 的请求每步都成立**，3 个 KDA 组合计 +3；只进求和判断，真正借块走上游 `allocate_new_blocks`（`single_type_kv_cache_manager.py#L1121-L1133`）仍是 0。该类经 `patch/platform/__init__.py#L43` 无条件导入、替换模块属性，注册表在首次取管理器时才按名解析（`vllm/v1/kv_cache_spec_registry.py#L43-L60`），所以生效。v0.23 `2c59ff10` L76 相同；v0.26 `2ed6cbba` L80、main `baa023ad` L83 改为与 `local_hit_tokens` 比较。影响：本页 L184「本部署两者都不用，借法和上游相同」、L221「绝大多数步的答案是 0」对 KDA 组的「还差几块」不准确；running 请求在空闲块 < 真实所需 + 3 时就判借不到，抢占阈值提前约 3 块，120–121、约 67,000 不受实质影响。推导，未实跑。改法：L184 改为「外部 KV 分支的判断在本部署对每条在跑请求都成立，每步求和时每个 KDA 组多算 1 块、实际不借；v0.26 起修正」，L221 相应加半句。
2. 本页 L170「整条 4 + 200 = 204 个 token，加 3 个预留是 207 个位置」：最后一圈实际是 `c + n + 3` = 206–209（底稿 L789 写 ≤ 209）；结论「full 组只 1 块」不变，可改成「最多 209 个位置」。
3. 底稿没有为本次块数修订追加「追加修订（2026-09-28）」条目；L1100 的旧「+14 = 121 块」无指向新值的说明。建议补一条修订记录。
4. 本页 L199「4 块的来历：窗口的 4 个位置常常横跨两块……」不够准，可改成上文的「3 个已算 + 4 个新算 + 3 个预留 = 10 个连续位置，起点在块内第 4 格时跨 4 块」。

### 6. 跳过与说明

- 按模板未读 frontmatter sources 区（L9–L47）；「对照源码」（L229 起）只 grep 了 H3 顺序（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置，齐全有序）和相关行，为核 P2 用 awk 单独取了 L258、L260–L263 两处。正文里的 `calc` 块为核数字读了（L88–L96、L190–L197），其余代码块未读。
- 未读 HANDBOOK、docs/plans/；未开子代理；未起服务、未做浏览器验收；没有读取被拦。
- 异步调度对 c 的影响只做了推导（调度时 c 含未验证候选、逐步不减，3–4 不变），未实跑。

## P3 收尾（09-28）

修订者：Opus 5.5。按复审「问题清单」收尾，严格串行、源码每次 ≤ 20 行；未起服务、未提交；未碰 npu-worker-lifecycle、attention-cost、request-call-chain。

1. **昇腾 KDA 管理器每步多报 1 块 —— 属实，不影响常驻 15–16。**
   - 核实：`db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py` 只覆盖 `__init__`、`find_longest_cache_hit`、`get_num_blocks_to_allocate`（L20–L80）；L76–L80 在上游结果上判断 `total_computed_tokens > len(new_computed_blocks) × block_size` 且 `num_tokens_main_model > total_computed_tokens` 就 +1。运行中请求 `allocate_slots` 收到 `new_computed_blocks=None`，换成每组空元组（`vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L171-L173`、`#L339-L342`），所以 c > 0 时每个 KDA 组每步 +1、三组 +3。生效链：`patch/platform/__init__.py#L43` 导入即改写模块里的 `MambaManager`；上游 `register_all_kvcache_specs` 在函数体里按名字取（`single_type_kv_cache_manager.py#L1369`），注册表首次取管理器时才调它（`kv_cache_spec_registry.py#L43-L60`）。
   - 实际借块：替换类没有覆盖 `allocate_new_blocks` / `allocate_new_computed_blocks`；上游 none 模式补到 4 块、已有 4 块，借 0；外部 KV 的那一块只在 `num_external_computed_tokens > 0` 时借（`#L246`），本部署为 0。所以只让「够不够」的比较多要 3 块，抢占约提前 3 块触发；常驻 15–16、R1 结束 16–17、被抢占 120–121、准入 2,167（c = 0 不触发）都不变。底稿、one-request、two-node 的数字不用改。
   - **与复审员的分歧**：复审写「v0.26 L80、main L83 改为与 `local_hit_tokens` 比较」并建议页面写「v0.26 起修正」。实查 `2ed6cbba` L63 与 `baa023ad` L66 都是 `local_hit_tokens = len(new_computed_blocks) * self.block_size`，只是提成变量，条件等价，所以没有写「已修正」。
   - 改动：本页 L184（KDA 组段末改写）、L221（常见误解限定「实际借 0 块」并链到 KDA 段）、L257（「开销和什么时候别开」新增一条，附源码位置与三钉点对照）；底稿 L629（§A2「怎么走的」第 4 条补一句）。
2. **底稿 L1101 的旧值 121**：语境是 09-27 修订记录表 P1-6 行（历史记录）。保留原文，行末加「2026-09-28 再更正：`+14` 把首步 2 块当常驻……应为 120–121 块 ≈ 956–964 MiB、约 67,000 token」并指向 §B3 与文末新记录。
3. **本页 L170 的 207**：最后一步开始时 c = 199–202（最后一圈前已输出 196–199 个，c = 3 + o），要留 `c + 4 + 3` = 206–209 个位置。改为「已算 199–202 个位置，再加本步 4 个和 3 个预留，要留的位置最多 209 个」，结论 full 组只 1 块不变。one-request L534 的「204 + 3 = 207」是它那条分支（前 197 个输出 → c = 200 → 207）的值，正确，未改。
4. **底稿修订记录**：文末新增「追加修订（2026-09-28，块数，据本 review P5 审查 P1-1/P1-2 与复审 P3）」（L1188 起，三行表：尾状态组块数、清零、KDA 多报 1 块，各列改动位置与源码行号）；§A2.2 L659 加指向这条记录的说明。
5. 另顺手改复审 P3-4：本页 L199「4 块的来历」改为「3 个已算 + 4 个新算 + 3 个预留 = 10 个连续位置，起点在块内第 4 格（c 除以 4 余 2）时跨 4 块，否则 3 块」（按 `ceil((k + 10) / 4)`，k = (c − 3) mod 4 核过）。

**验证**：`pnpm wiki:lint` exit 0（通过，另有 17 处待留意，本页无条目）；`pnpm wiki:diagrams --check` exit 0（192 张图与 spec 一致）；`pnpm wiki:audit` exit 0（无效 commit 0、文件不存在 0、行号越界 0；名单 41 页达标 41 页；本页「正文 17483 字 / 8 节 来源 36 条」）。新增的昇腾 KDA 条目用已有来源第 18 条（`patch_mamba_manager.py#L18-L84`）覆盖，未加角标。
