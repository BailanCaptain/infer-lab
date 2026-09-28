# attention-cost 审查记录

## P5 写作记录（2026-09-28，Opus 写手，第 09 批）

### 改了什么

- 深改 wiki/concepts/attention-cost.md，按骨架重排：问题式 H2 + 一句话定义 + 直觉图 → 为什么/代价 → GLM 双机沿一个 decode 位置落数字（含「存下来的量」「账面容量和实际占用」两个 H3）→ 三类注意力的特殊之处（密集 / 稀疏 MLA / KDA 三个 H3）→ 常见误解 → 对照源码五个 H3。
- 正文字符数：改前约 4.5k，改后约 22k（含对照源码）。
- 直觉图 wiki/diagrams/attention-cost.yaml 重画：三行（密集注意力 / 稀疏注意力的 indexer 打分与主 attention / 固定状态 KDA）× 三列（历史 4、8、12 份），只画读取份数和增长趋势，不写字节；稀疏预算示意为 4 份；画布 900×290。
- 版本差异按 data-parallel 表头（项目 | v0.23 | v0.26 | main），三行：主 attention 读取上限、KDA 状态形状、固定状态页与注意力页的对齐。

### 数字取自哪里

- 底稿 docs/mainline/02-forward.md：§4.5（KDA 每卡 512 KiB + 36 KiB = 561,152 B、85.0 MiB/请求/卡、32 条 2.66 GiB、约 6,827 token 交点）、§4.7（chunk=64）、§5.4（512 池、2051 宽、33,280 池、1/65、清单缓冲 64.09 MiB / MTP 68.0 MiB）、§5.5（2.00 MiB/层上界、22.0 MiB、33.6 MFLOP）、§5.6（1024 B + 64 B/层/token、尾状态 4,096 B/层、12 层 13,056 B、1.619 GiB、48 KiB、640 块与 14.4% 填充）。
- 本页新做的推导 [D]（只用上面底稿的数相乘）：indexer 在 133,120 位置处 11 层逻辑扫描量 11 × 33,280 × 256 B ≈ 89.4 MiB；同长度若为密集注意力 11 × 133,120 × 1024 B ≈ 1.40 GiB；34 × 561,152 B ≈ 18.2 MiB（与 linear-attention 页一致）。审查请复核。
- 13,056 B、85 MiB、640 的推导只链接部署页 / linear-attention，不在本页重算；块数不复述，只链接 vllm-kv-block-allocation。R1 按 4 个 token 的教学设定，不重算。

### 核心概念对照

- 稀疏注意力每步读多少：vllm-ascend@db701c1f ops/triton/glm5_next_lightning_indexer.py L144-L145（pool_topk = 2048/4、宽 2048+4−1）、L161-L175（对全部 max_pool_seq_len 个池打分，先合成 qbar）、L221-L233（topk、展开、补 0–3 尾部）；device/device_op.py L719-L793（sparse_indices=清单、sparse_block_size=1、key=value=打包潜向量、sparse_mode=3）。结论：主 attention 每查询至多 2051 个位置；indexer 每查询扫全部完整池，随历史线性增长。
- 固定状态为什么不增长：ops/kimi_kda_state.py L9-L32，递推状态形状 (本卡头数, head_dim, head_dim)、卷积状态 (3×头数×头宽/TP, 核长−1+投机数)，没有长度维；更新规则按 linear-attention 页五步（加法写入同一矩阵）。
- 密集注意力 n(n+1)/2 与 decode 读全部可见历史：arXiv 1706.03762。

### 换掉的测试出处（「5 页错误出处」最后一页）

- 旧 sources 第 6 条 vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L980-L1061 落在 _sparse_attention_pytorch（L857 起）里；git grep 确认它只被 tests/ut/models/test_glm5_next_indexer_kpool_mla.py 和一个 e2e 测试注释引用，不在推理路径上。已删除。
- 换成生产路径三条：sfa_v1.py#L1994-L2028（父类前向调用 _execute_sparse_flash_attention_process，之后 _v_up_proj、o_proj）→ indexer_kpool_mla_v1.py#L1065-L1104（子类重写，取打包缓存交给设备入口）→ device/device_op.py#L719-L793（npu_sparse_flash_attention）。三处都已逐行打开核对。
- 全页其余出处无 tests/ 路径。另把 config revision 从 eb9eb208 换成主线钉住的 690b7052（基线页记两份内容一致）；indexer_kpool_mla.py 扩到 L69-L182（含三份缓存元组 L178-L182）；patch_mamba_config.py 拆为 L44-L56（目标页取较大值）与 L94-L159（640 块）；新增 indexer_kpool_mla_v1.py#L136-L146（逻辑块须被 128 整除）、triton indexer L131-L237，以及 2c59ff10 / 2ed6cbba / baa023ad 各自的版本对照出处。

### 旧版信息清单勾选

清单存于 scratchpad\p5\attention-cost-facts.md（27 条）。结果：F1–F5、F7、F9–F25、F27 保留；F6 改写保留（旧容量条图换成读取份数图，边界句保留在正文）；F8 保留并改为每卡口径；F18 保留并量化；F26 出处按上节替换。无删除项。

### 检查结果

- pnpm wiki:lint：退出码 0；本页只有一条只提示不阻塞的 mark-flood（对照源码里 [C] 角标占 93%）。
- pnpm wiki:diagrams --check：退出码 0，192 张图与 spec 一致；本页图无文字过多提示。
- pnpm wiki:audit：退出码 0；本页不在 standard-pages.json 名单，另用 checkStandard 单独跑本页：行内代码 0/千字、角标 0、对照源码、calc 0.25/千字、相邻块 0、图先行、免责 0.0%、图宽，全部通过。
- 其他页的提示（vllm-ascend-repo-map 图上代码名、mark-flood 等）不是本页，未处理。

### 疑点与未做

- main（baa023ad）的 GLM 对齐是否仍得出 640 个 token 的逻辑块，未逐行核对；三个版本能否整套跑通本部署，未做运行验证（页上已写明）。
- indexer 89.4 MiB 是逻辑扫描量；triton 内核把同一请求的多行查询分块处理，实际 HBM 读取可能共享，页上已注明「不是实测 HBM 流量」。
- 未读 docs/wiki-writing-standard.md，按写手模板摘要执行，并用 checkStandard 验证。
- 未做浏览器验收（按模板留给审查环节）。

## P5 审查（09-28）

独立审查（只审不改）。对照 docs/mainline/02-forward.md §4.5–4.7、§5.5–5.6，源码按 vllm-ascend@db701c1f / 2c59ff10 / baa023ad 用 `git show` 现场核对。

### 打分：8.5 / 10（无 P1，1 条 P2，2 条 P3）

### 初学者测试（只读前两屏）

能说清：「注意力代价=每一步要存多少、读多少、算多少历史；密集每步全读、随历史涨，稀疏的打分器全扫但主读取到预算封顶、缓存一点不省，固定状态永远只读写同一块。」直觉图（4→8→12 份三列 + indexer 细条 + 固定 3×3 块）与这句一致。通过。

### 核心概念逐条核对（均对）

- 稀疏挑选机制：indexer 把 32 个头的 query 按权重先合成一条再对每池做一次 128 维点积——`db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L174-L175`（qbar 合成）、`#L122`（每池一次点积，无 ReLU）；top-512 池展开 ×4 加 0–3 尾部、无效格填 −1、清单宽 2048+3=2051——`#L209-L236`。页 81、135 行的描述与源码一致。
- KDA 状态形状只由头数/头宽/卷积格数决定：`db701c1f:vllm_ascend/ops/kimi_kda_state.py#L27-L31`（local_conv_dim=3072、state_len=4−1+3=6、recurrent (8,128,128)）；每卡 512 KiB + 36 KiB = 561,152 B，与底稿 §4.5 一致（页 80、139 行）。
- 三份缓存与 dtype：`db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L71`（head_size=512+0）、`#L74-L76`（BF16 硬编码）、`#L121-L134`（num_kv_heads=1、compress_ratio=1）、`#L178-L182`（kv/indexer_state/indexer 三份）。页 127–135 行对。
- 「历史 ≤2051 时等价密集」「133,120 处读 2048 条为全历史 1/65」与底稿 §5.4（L450）一致；133,120=4×33,280，尾部恰为 0，calc 里用 2048 是准确的。
- 版本差异口径对：2c59ff10 上 `ls-tree` 无 glm5 模型文件（「维护分支没有 GLM 代码」属实）；db701c1f 单独标注；main=baa023ad 有 `models/glm5next/`（cache_config.py、kda.py 在），其 lightning indexer `#L136` `output_width = index_topk + index_kpool - 1` 与表内「位置预算 + 每池位置数 − 1」相符。

### 写手自报的 89.4 MiB：独立重算，成立

因子逐个溯源：11 层稀疏 MLA（config layer_types，底稿 §0.2；MTP 不计、口径全页一致标「主干」）；index_kpool=4、index_head_dim=128、index_n_heads=32（config，底稿 §0.2 L33；`db701c1f:glm5_next.py#L1249-L1256` assert 存在）；索引 key 每池 128 维 BF16=256 B（k_cache BF16：`glm5_next.py#L1306-L1313`；底稿 §5.6 表 64 B/token）；max_model_len=133,120（底稿 §0.1 L14）。重算：⌊133,120/4⌋=33,280 池 × 256 B × 11 层 = 93,716,480 B = 89.375 MiB ≈ 89.4 MiB，与页 90 行一致。全库 grep「89.4/93,716,480」仅本页出现（底稿也没有），是本页新推导且为单一出处，不构成重复推导问题。「约为主 attention 4 倍」= 89.375/22.0 ≈ 4.06，属实。

### 数字对照底稿（均对）

18.2 MiB（34×561,152）、22.0 MiB、1.40 GiB、13,056 B/token、1.619 GiB、44 MiB、48 KiB 尾状态、85 MiB、2.66 GiB、6,827 交点、640 块 / 655,360 B / 14.4% 填充、64.09 MiB 工作区、33.6 MFLOP，逐一与 §4.5/§5.5/§5.6 对上。块数只有链接（113 行），无重述。

### 丢信息

`git diff HEAD` 删 36 行，逐行对到新版；scratchpad 的 F1–F27 勾选逐条抽查属实（F6 边界由「交点只是容量交点」段承担、F18 量化成 calc、F26 单测出处已换）。无丢失。

### 出处检查（5 页错误出处的最后一页）

frontmatter 17 条无一指向 tests/；原 `indexer_kpool_mla_v1.py#L980-L1061`（单测参考实现 `_sparse_attention_pytorch` 区段）已换成 `#L1065-L1104`（`AscendIndexerKPoolMLAImpl` 重写，底稿 §5.5 确认的生产派发路径）加 `sfa_v1.py#L1994-L2028`、`device_op.py#L719-L793`，均为实际推理路径。config 钉 690b7052。`pnpm wiki:audit` 退出码 0，本页无告警。

### 图

`pnpm wiki:diagrams --check` 退出码 0，193 张一致，本页无告警（gqa 未见缺 svg 报错）。attention-cost.yaml 宽 900（=上限），只画份数与趋势、无字节数；稀疏行 4/8/12 份下实格恒为预算 4 份、虚线格表「留在缓存但不读」，indexer 细条三列都在长，与正文和源码机制一致。预算画成 4 份并在 caption 标明「示意」，可。图上按单格挑选、真机制按 4 格一池挑，属示意简化，caption 未误导，不记问题。

### 问题清单

- **P2-1 重复推导（违反「数字只在单一出处推导」）**：calc 第 2 行（页 88 行）34×561,152=18.2 MiB 在 tensor-parallel.md:486 已推导（linear-attention.md:167 明确写「本页不重算」只链接）；calc 第 3 行（页 89 行）11×2048×1024=22.0 MiB 在 sparse-attention.md:167 已按 2051×512×2 推导；页 115 行工作区 8192×2051×4=64.09 MiB 在 sparse-attention.md:210-212 已推导。改法：calc 里只保留 indexer 行（本页独有的新账）作完整推导，18.2/22.0 两行保留结果数、括注推导出处链接（tensor-parallel、sparse-attention），115 行删因子列表改成「约 64.09 MiB（推导见稀疏注意力页）」。89.4 MiB 本身不在此列。
- **P3-1 68.0 MiB 无解释（页 115 行）**：紧跟 8192×2051×4=64.09 MiB 之后写「MTP 层另开一份 68.0 MiB」，按同因子算不出 68.0（实际是宽度向上取整到 2176，见底稿 §1.4 L153、sparse-attention.md:211），读者会当成矛盾。改法：加半句「宽度取整到 128 的倍数」或直接链接 sparse-attention 的工作区推导。
- **P3-2 投机术语先用后讲（页 80 行）**：「3 个投机草稿位置」首次出现无解释也无链接，speculative-decoding 链接到 103 行才出现；MTP（103 行）也只有链接没有一句话（对比 sparse-attention 的「生成投机草稿的配套层」）。改法：80 行首次出现处补链接或一句话。

### 范围与遗留

- 按模板跳过：frontmatter sources 区正文、「对照源码」正文（仅 grep 五个 H3 与版本行）、HANDBOOK、docs/plans/。无读取被拦，正文 38–153 行全读。
- 未做浏览器验收（模板未要求本轮做）；main 列 640 对齐未逐行核对（页上已声明）。

## P5 修订记录（09-28 二）

按「P5 审查（09-28）」的问题清单自修三条：

- **P2-1 已修**：calc「最长上下文处一个查询的读取量」里 18.2 MiB、22.0 MiB 两行删去因子推导，只留结果（`标签 ≈/= 结果` 形式）；calc 后新增一句括注「前两行只列结果」，分别链接 tensor-parallel.md#kda状态跟着头一起切 与 sparse-attention.md#稀疏什么时候才真的起作用；indexer 89.4 MiB 与密集对照 1.40 GiB 两行保留完整推导（本页新账）。工作区一句删去 8192 × 2051 × 4 的因子列表，改为只报 64.09 MiB / 68.0 MiB 并链接 sparse-attention.md#开销和什么时候别开。
- **P3-1 已修**：68.0 MiB 前补「因清单宽度向上取整到 128 的倍数」，并同句链接稀疏注意力的推导 calc。
- **P3-2 已修**：第 80 行「投机草稿」首现处改为链接 [投机解码](speculative-decoding.md) 加一句话（每轮先猜 3 个 token 再一起验证）；第 103 行 MTP 补破折号一句话「生成投机草稿的配套层」，与 sparse-attention 的写法一致。

检查：pnpm wiki:lint 退出码 1、pnpm wiki:audit 退出码 1，两者唯一报错都是 concepts/prefix-caching.md 的 diagram-identifier（他人在改、本批明令不碰的页），本页在两份日志里零报错（lint 仅剩 warn-only 的 mark-flood 提示，与审查时相同）。checkStandard 单页复跑：九项全部 ✓（4039 字，免责 0.0%）。两处新锚点拼法与库内既有交叉链接逐字一致。图未改动，未重跑 diagrams。
