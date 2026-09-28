# block-table 审查记录

## P5 写作记录（2026-09-28，第 07 批，Opus 写手）

### 改了什么

- **标题与元数据**：标题恢复英文术语开头「Block Table：请求里的第几个位置，落在缓存池的哪一格」；`verified` 恢复为 v0.23 / v0.26 / main 三版（块表类逐版核过，见版本差异）；summary 压到 200 字内；relations 去掉与 vllm-kv-block-allocation、prepare-inputs-flow 的双向重复（lint 要求只写依赖方一侧），新增 one-request、glm-5-3-flash-two-node、sparse-attention。
- **结构**（先直觉后数字）：问题式首屏 H2 + 一句话定义 + 直觉图 → 为什么要一张表、代价三处、相邻概念小表 → 表怎样随请求变化、槽位怎样算 → GLM 双机：5 个组 5 张表（事实表，末列「意味着什么」，4 行）+ 代码流程图 → 保留锚点 H2「分配块与内核页可能不同」（kv-cache-spec、kv-cache 两页链到这里）→ 表本身多大、每步花多少 → 分页布局和同名算子是两回事（并入原 paged-attention 页的分页、共享、回收内容）→ 常见误解 8 条 → 对照源码 5 个固定 H3。
- **图**：`block-table.yaml` 重画为直觉图（请求位置按 4 个一块分成逻辑块 → 块表一行 [7,2,9] → 缓存池里分散的块 7、2、9，位置 6 落到槽位 10；池里夹着别的请求的块、块 0 为占位块）。新增 `block-table-flow.yaml` 代码流程图（第 2 站按组发块号 → 第 3 站 5 张表分三支写入、拷到 NPU、非 KDA 组算槽位 → 第 4 站 MLA / indexer K / 尾状态 / KDA 四种用法），站点位置融在图里。
- **错误出处修正（02-path-fix-review P2）**：删掉只供单测调用的 `indexer_kpool_mla_v1.py#L980-L1061`（`_sparse_attention_pytorch`），换成生产路径 `indexer_kpool_mla_v1.py#L1065-L1104` → `device_op.py#L719-L793`；正文据此改写为「选中的位置 + full 组 kernel 块表交给 `npu_sparse_flash_attention`，`layout_kv="PA_BSND"`」。
- **单一出处**：块号分配、引用计数、回收只链 [vllm-kv-block-allocation](../../../wiki/concepts/vllm-kv-block-allocation.md)（该页未重写，只放链接）；KV 预算、每块号 7.969 MiB、3,855 块只链部署页；block_size 五种含义只链 kv-cache-spec；R1 15 块的算法只链 one-request 第 2 站。

### 数字来源

- 640、128、1 个逻辑块 = 5 个 kernel 块：底稿 01 §A0.4；02 §5.6。与 kv-cache-spec「block_size 五种含义」表、kv-cache L111 一致。
- 5 个组的成员与块长（full 640 / 尾状态 4 / KDA 133,120，12/11/11 层）：底稿 01 §A0.5、§A2.3。
- R1 第一步 15 块 = full 1 + 尾状态 2 + KDA 3×4 = 12；119.5 MiB：底稿 01 §A2.2，与 one-request 第 2 站一致。
- 133,120、32 条并发、3 个 lookahead：底稿 01 §A2.1。满长 208 块：§A2.2。
- 每块号 7.969 MiB、3,855 块：底稿 01 §A0.5，页内只链部署页。
- **本页新推导（[D]，请审查者复核）**：三类行宽 1,040 / 33,280 / 4 格，5 张表 32 行 ≈ 4.19 MiB，R1 每步拷表 ≈ 134 KiB（尾状态行占 ≈ 97%）。依据：`model_runner_v1.py#L4943-L5026` 的 `max_num_blocks` 公式与 `block_table.py#L14-L101` 的行宽、`commit_block_table` 拷整行（`#L284-L288`），代入底稿常数。
- **底稿 01 §A3 待核 1（三套 slot 的对应关系）本轮已逐行核**：MLA 槽位 = 640b + p % 640（按 128 的 kernel 表算出）；indexer K = b × 160 + (p % 640) // 4，仅 (p+1) % 4 == 0 有效、否则 −1（`kv_cache_interface.py#L27-L52`、`indexer_kpool_mla_v1.py#L175-L268`）；尾状态 = s × 4 + p % 4（本组表，`#L342-L371`）；KDA 组 `is_mamba_group` 跳过槽位（`block_table.py#L429-L443`），GDN 后端把块号当状态索引（`gdn_attn_builder.py#L545-L600`）。建议回填底稿。

### 核心概念对照

- 块表定义、逻辑块 / 物理块、按需分配与虚拟内存类比：PagedAttention 论文（arXiv 2309.06180）§4；昇腾官方设计文档 `ModelRunner_prepare_inputs.md` L49–L62、L153–L196（db701c1f）。
- 槽位公式：`vllm@0fc695fc:vllm/v1/worker/block_table.py` `_compute_slot_mapping_kernel` L325–L380（`block_indices = pos // block_size`，`slot_ids = block_numbers * block_size + offset`，尾部填 PAD）。
- 每组一张表：调度侧 `KVCacheBlocks.get_block_ids` 按组返回（`kv_cache_manager.py#L26-L83`）、`KVCacheCoordinator` 每组一个 manager 共用一个 `BlockPool`（`kv_cache_coordinator.py#L90-L119`）；worker 侧 `MultiGroupBlockTable`（db701c1f `block_table.py#L329-L462`），`kernel_block_sizes` 按组选（`model_runner_v1.py#L4943-L5026`，`select_common_block_size` `vllm/v1/worker/utils.py#L262-L327`）。
- 640 → 5 × 128 的拆分：`block_table.py#L14-L101`（`blocks_per_phys_block`）、`#L294-L309`（展开）、`model_runner_v1.py#L4484-L4528`（MLA 页按 `num_blocks × 5` 段切形状）、MLA 后端只支持 `[128]`（`indexer_kpool_mla_v1.py#L553-L554`）。
- 块号 0 为占位块：`block_pool.py#L173-L177`。行操作调用方：`gpu_input_batch.py#L335-L757`、`gpu_model_runner.py#L1366-L1401`（NPUInputBatch 继承上游 InputBatch，只换 block_table）。
- 版本差异：逐文件比对 `vllm-ascend@2c59ff10 / 2ed6cbba / baa023ad / db701c1f` 的 `worker/block_table.py`，以及 2ed6cbba 的 `ops/triton/compute_slot_mapping.py`、baa023ad 的 `AscendIndexerKPoolTailSpec`（环形尾状态）。修正了旧版表里的一处：v0.23 的槽位缓冲同样带 MTP 草稿余量；db701c1f 反而没有。

### 旧版信息清单勾选

清单与逐条勾选：scratchpad `p5/block-table-facts.md`（A = 0f97c8b 旧 block-table 26 条，P = 0f97c8b 旧 paged-attention 9 条，C = p4-checkpoint 12 条）。结果：44 条在新版中找到；A19（块长从哪来）挪到 kv-cache-spec 与部署页并链接；删除 2 条：
- A26 Qwen3.6 口径的数字（2048、37+200、槽位 10367 等）：模型已换成 GLM，全部按底稿换成 GLM 数字。
- P9 普通 GQA 后端 PagedAttention 算子的版本差异（写入算子名、图重放参数、硬件门）：GLM 的 MLA 走 indexer_kpool 后端、KDA 走 GDN 后端，都不经过 `attention_v1.py`；P4 合并时已丢，本轮未在 db701c1f 重核。**待决**：是否由 attention-backend-family 接收。

### 自检

- `pnpm wiki:lint` 本页 0 条（最后一次运行时他页有 2 条：glm-5-3-flash-two-node 与 kv-cache-memory-profiling 互写 builds-on，非本页改动）；`pnpm wiki:diagrams --check` 185 张图与 spec 一致（本页两张图无版式警告）；`pnpm wiki:audit` 通过（本页 42 条来源行号全有效）；`pnpm check:content` 通过。
- 写作标准统计（`checkStandard`）：教学正文行内代码 0、对照源码之上角标 0、免责句 0；全页角标 29 处，C 级 21 处（72%）；calc 2 个，分属两节，均不与表相邻；图宽 900。
- `vitest src/content/wiki/index.test.ts`：标题断言 `/^Block Table/` 通过；`toContain("## 一句话")` 失败——与写作标准「不另设『一句话』H2」冲突，按指示未改测试，交用户定。`tests/wiki.spec.ts` 未跑（本批不起服务），按页面结构逐条对照：图含拉丁文字、页末有带编号且可点的 S/C 角标、首个含「意味着什么」的表 4 列 4 行无来源列、有站内链接、relations 带 note。
- 未做浏览器验收，留给审查环节。

## P5 审查（09-28，Opus 审查员，只审未改页面）

**结论：8.5 / 10。核心概念没有查出错，数字全部复算对上，旧版信息 6 条抽查都在。1 条 P2（仓库单测因本页改版变红）、4 条 P3。**

### 初学者测试（只读前两屏 L64–L109）

「块表是一张整数表，记着『这条请求的第 i 块在缓存池里是第几号块』；有了它，一条请求的历史不必在显存里连成一段、也不必按最大长度预留，写满一块再要下一块；代价是每次读写都要先查表翻译、末块会空着一截、表本身每步还要维护和上传。」两屏读完能说清「是什么」和「代价在哪」，通过。

### 核心概念（对照 vllm@0fc695fc、vllm-ascend@db701c1f，逐条判）

| 页面说法 | 判定 | 依据 |
|---|---|---|
| 槽位 = 块号 × 块大小 + 块内偏移；直觉图 2×4+2=10（L76–L80） | 对 | 昇腾 `worker/block_table.py` 槽位计算按 `block_table_indices` 取块号后乘块长加偏移；上游 `vllm/v1/worker/block_table.py` 同构 |
| 不能写成「块号 × 块长 + 完整位置」（L80） | 对 | 同上，偏移用的是 `p % block_size` |
| hybrid 模型每个 KV cache group 各有一张块表（L138） | 对 | `MultiGroupBlockTable.__init__` 按 `block_sizes` / `kv_cache_groups` 逐组建 `BlockTable`，行操作对同一 `row_idx` 依次执行 |
| 5 个组的来历（L138，链到 kv-cache-spec） | 对，且三页一致 | kv-cache-spec L181「对齐之后编组，共 5 个」、L197「full 1 + 尾状态 2 + KDA 三组各 4 = 15」；kv-cache L153 同；one-request L151–L154 同。kv-cache-spec 的「回写成 4」（L221、L230、L245）指的是**引擎把 block_size 字段改写成各组最小值**，不是组数变 4；本页没有提这个字段，也没有和它冲突 |
| full 组一个块号展开成 5 个 kernel 块号、槽位不变（L166–L179 calc） | 对 | `blocks_per_phys_block = physical // logical = 640 // 128 = 5`；`_convert_physical_to_logical_blocks` 展开成 `range(5b, 5b+5)`；indexer 后端里有 `logical_block_size % GLM5_SFA_KERNEL_BLOCK_SIZE` 的整除校验 |
| kernel 块长由同组各后端报出、worker 挑能整除的（L168） | 对 | MLA / SFA 后端 `get_supported_kernel_block_sizes` 返回 `[128]`；indexer K 与尾状态返回 `MultipleOf(1)`；非注意力组在 model runner 里填 `[0]` 关掉槽位计算 |
| indexer K 折回 640 的块号、每隔 5 格取一个再除以 5（L183） | 对 | `expanded_block_table[:, ::split] / split`（floor） |
| 只有凑满 4 个位置的 token 写压缩条目，其余记 −1（L183、L188） | 对 | `format_indexer_kpool_slot_mapping`：`(positions + 1) % compress_ratio == 0` 才有效，否则 −1；压缩槽位 = `块号 × (640/4) + 偏移 // 4`，与页面的 `160b + 0` 一致 |
| 缩列只认 `AscendMLAAttentionSpec`（L246、L286） | 对 | `compress_ratio` 只在 `isinstance(kv_cache_spec, AscendMLAAttentionSpec)` 时取；注释写明对只带该字段的规格缩列会写穿一行 |
| `append_row` 有行容量检查（L261、L288） | 对 | `Block table row capacity exceeded: row=..., capacity=...` |
| 块号 0 是占位块、表里 0 是空格、槽位与折表用 −1（L123、L229） | 对 | `PAD_SLOT_ID` 用于槽位尾部；折表无效项填 −1；占位块由 `block_pool.py` 取出 |

### 数字复算（写手自报需复核的那几个）

- full 组一行：`ceil(133120 / 640) = 208`，`208 × 5 = 1,040` 格，`× 4 B = 4,160 B` — 对（底稿 01 §A2.2 满长 208 块）。
- 尾状态组一行：`133120 / 4 = 33,280` 格，`× 4 B = 133,120 B = 130 KiB` — 对。行宽不缩是因为它用的不是 `AscendMLAAttentionSpec`，与 L246 的说法自洽。
- 每个 KDA 组一行：`1 + 3 = 4` 格 `= 16 B` — 对（底稿 01 §A2.2 `ceil((7 + 133120×3) / 133120) = 4`）。
- 32 行合计：`32 × (4,160 + 133,120 + 48) = 4,394,496 B = 4.19 MiB` — 对；「大约半个块号」= 4.19 / 7.969 ≈ 0.53，对。
- 每步拷 1 行 `137,328 B ≈ 134 KiB`，尾状态占 `133,120 / 137,328 ≈ 97%` — 对。
- 一格 4 B（int32）、32 行来自 `max_num_seqs = 32`（底稿 01 §A2.1）、7.969 MiB 与 3,855 块（底稿 01 §A0.5）、13,056 B/token 口径（底稿 02 §5.6）全部对上。
- 640 / 128、R1 15 块、KDA 12 块：与 kv-cache-spec、kv-cache（L149、L153、L169）、one-request（L151–L160、L554–L556）四页一致，无漂移。旧模型口径的数（2048、262144、10367 等）全页 0 处残留。

### 有没有丢信息（`git diff p4-checkpoint`：+265 / −37，删除行全部看过）

抽查 6 条，全部还在：A7（0 是空格、官方文档 block_0 → L123、L229、L242）；A16（两个消费者：表给算子读、槽位给写缓存 → L130）；A21（列数 = `cdiv(max_model_len, block_size × CP 总数)` → L246）；A23（槽位 kernel 尾部填 −1 → L128）；P7/P8（同名算子门槛、`pa_shape_list` 填的是 token 数 → L256）；C10（只供单测的 `#L980-L1061` 已换成生产路径 `#L1065-L1104` → `device_op.py#L719-L793`）。删掉的 37 行里，旧版的公式、行操作、共享/回收、末块浪费统计范围都在新版有对应落点；唯一真删的是 P9（普通 GQA 后端的版本差异），理由（GLM 不经过 `attention_v1`）与去向已记在本文件写作记录里。

### 出处、链接、校验

- 42 条来源全是生产路径，无 `tests/` 或 `test_` 路径；arXiv 2309.06180 保留在来源与正文 L88。
- 站内链接：本页 29 条内部链接（含锚点）全部解析；全库 14 页共 19 条指向 `block-table.md` 的链接，锚点全部有效（脚本按 `src/content/wiki/anchors.ts` 的 `headingSlug` 规则核对）。
- `pnpm wiki:audit`：通过。本页 `evidence=C`、章节 11、正文 17,018 字、9 节、42 条来源，行号全部有效，无越界、无未知仓库。
- `pnpm wiki:lint`：通过，本页 0 条（19 条待留意都在他页）。
- 教学正文（L64–L235）自测：行内代码 0 个、对照源码之上证据角标 0 个、2 个 calc 分属两节且不与表相邻、首屏有直觉图。

### P1

无。

### P2

1. **仓库单测因本页改版变红。** `src/content/wiki/index.test.ts:22` 断言 block-table 正文 `toContain("## 一句话")`，新版首屏改成「问题式 H2 + 加粗一句话定义」后不再有这个 H2。实测 `npx vitest run src/content/wiki/index.test.ts`：1 failed / 11 passed。改法：把该断言换成新版首屏契约（标题 `/^Block Table/` 保留，正文断言改为首个 H2 以 `？` 结尾、且紧随的首段以 `**block table` 开头），不要为了让测试过而给页面加回「一句话」H2——写作标准明确不设这个 H2。本条不该留给下一轮：测试红着，其他页的 P5 改版也会踩同一条断言。

### P3

1. **篇幅：三页重复约 250–350 字（本页教学正文 8,121 字，不算长，问题是重复而非过长）。** 逐段字数：首屏 729 / 为什么要一张表 1,420 / 表怎样变化 1,047 / GLM 双机 1,712 / 分配块与内核页 1,209 / 表本身占多少 709 / 分页与同名算子 850 / 常见误解 747 / 对照源码 6,485。对照：kv-cache-spec 正文（不含对照源码）9,907 字、kv-cache 9,087 字，本页 8,423 字最短。重复处与精简建议：① L138 把 MLA / KDA / indexer 各是什么重讲了一遍，kv-cache L137–L162「混合模型到底要保留哪几类状态」已有，压成一句并链过去（约 −150 字）；② L142–L147 表格的「一块覆盖几个位置」列与 kv-cache-spec L181–L197 的组表同数，可删列、表头一句话指向那页（约 −60 字）；③ L86 的「208 个块」与 L98 的「R1 只用 4 格」在 kv-cache L169 已一起讲过，本页留 L98 一处即可，L86 只说「按上限预留绝大部分不会被写」（约 −80 字）。L164–L191 的 640→5×128 推导是本页唯一出处，不要动；反倒是 kv-cache-spec L213 与 kv-cache L235 复述了结论，可改为只链本页。
2. **页面上出现写给审阅者的话。** L147 表格末行「每组块数的算法在第 2 站，本页不重算」——「本页不重算」是编辑口径，不帮读者理解；改成只留链接。（用户 09-28 的规则：页面不写这类 meta 文本。）
3. **`full 组`这个组名首次出现（L144 表格）没说为什么叫 full。** 读者在本页第一次见到它是在表格里，建议 L138 末尾补半句「按位置全量存历史的那组，下文按源码里的名字叫 full 组」。
4. **本页不在 `scripts/wiki/standard-pages.json` 名单里**，所以 audit 的写作标准对它只统计不强制（本轮我手工核了角标、行内代码、calc 三项，都达标）。既然已按 P5 标准深改，建议把 `block-table` 加进名单，让回归自动守住。另：P9（普通 GQA 后端的版本差异）在本文件里记的是「待决」，建议这一轮就把去向定下来（attention-backend-family 或 gap 页），别停在待决。

### 跳过的段

按审查纪律，frontmatter 的来源清单只用 grep 核路径与 `tests/` 命中，未逐行读；「## 对照源码」正文（L236–L297）未整段读，只用 grep 核了五个 H3 齐全且顺序为「怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置」、版本差异里 v0.23 / v0.26 / main 三列齐全，以及 L242–L288 与核心概念相关的几行。未做浏览器验收（本轮未起服务）。
