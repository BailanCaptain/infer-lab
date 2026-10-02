# c8-enable-reshape-optim-8bd7e5f82c6c 审查记录

## P5 写作记录（2026-10-02，第 26 批小修）

**改了什么。** 保留参数页四节（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容（版本谱系、参数定义）不动，没有图，也没有新加图。正文去 frontmatter 后 10,452 → 11,955 字符（audit 口径 7,639 字 / 6 节）。
- 一句话：首次出现「C8 量化缓存」处补一句它属于稀疏 C8 那条路，链到 kv-cache-quantization「Ascend 上的三条 KV cache 量化路」。
- 为什么存在：改正描述符缓冲那句。旧版说三个缓冲在 metadata 构建期按 `slot_mapping.numel()` 申请、「所以」启动期就要决定——实际是按一步 token 上限预先留好（v0.23 `2c59ff10` sfa_v1.py L289–L294 在 builder 初始化时按 `max_num_batched_tokens` 申请；main `baa023ad` indexer.py L529–L532、L898–L914 按同一上限算出的固定容量首次用到时申请），每步只取前 slot 数一截；不能按请求切换的原因是开关在启动时从配置读定。
- 开了的代价：末尾加一段 GLM 双机对照——`db701c1f` 与发布分支同式，`enable_sparse_li_c8` 和本键默认都是 False（ascend_config.py L280–L284），部署启动命令没有 `--additional-config`，所以为假，C8 索引器缓存写入根本不发生；硬把两个键写成 true，GLM-5 Indexer KPool MLA 后端构造时直接报错，理由是索引器状态缓存有独立的 slot mapping（indexer_kpool_mla_v1.py L556–L568），链到块表页 GLM 一节（该组块长 4）。无实测收益数；待核：main 上 GLM 模型代码是否保留同样拦截（`baa023ad` 全库 grep 只在 ascend_config.py 与 attention/indexer.py 出现本键，models/glm5next 下没有）。
- frontmatter：summary 末尾加「GLM 双机没开，硬开会报错」（≤200 字，lint 校验过）；updated 改为 2026-10-02；sources 追加 [C20]–[C23]。
- 内联标记：新加 4 个后为 34，超过 30 的提醒线；删掉 5 处与事实表同源重复的标记（开了的代价里的 [C3]、[C2]，教程句的 [S8]，PD 段的 [S10]，事实表「混部」行的 [C2]），现为 29，所删结论在同页别处仍有同一来源。

**旧版信息清单勾选**（清单在 scratchpad `p5/c8-enable-reshape-optim-8bd7e5f82c6c-facts.md`，旧版 = p4-checkpoint，和改前现版一致）：
1 只管写入算子 ✔ 一句话；2 发布分支默认 False 且与 li_c8 相与 ✔ 一句话（2c59ff10 L282–L283、2ed6cbba L288–L289 核过）；3 三版本都有、main 管得少 ✔；4 发布分支用户键与官方参数表 ✔；5 #15752 删 / #16952 恢复并翻默认 ✔ 一句话 + 版本谱系；6 钉住 main 字段默认 True、私有字段、判定第一项 ✔（baa023ad L526、L535、L786、L1084–L1086 核过）；7 v0.28.0rc 空窗 ✔；8 事实表九行 ✔ 全保留（「混部」行删了重复标记，结论不变）；9 写入极碎、scale 第二份缓存 ✔；10 store_kv_block 归组、reshape 含义 ✔；11 缓冲申请与「启动期决定」✔ 改正（证据见上）；12 逃生口推断 [I] ✔；13 两道门串联、混部恒假、只剩关掉的用处 ✔；14 跨版本两个方向的坑 ✔；15 教程键能过校验、不代表可启动 ✔；16 PD 从文档约定变硬判定 ✔；17 自动生成两节 ✔ 未动。

**数字与结论出处。** 无 C8 优化实测数，没有写任何效果数字。GLM 双机只用部署事实：启动命令无 `--additional-config`（glm-5-3-flash-two-node「怎么开」）、无 `kv_transfer_config`（01 第 848 行一带）、索引器尾状态组块长 4（block-table GLM 一节，即 01 §A2.2 / §B3 说的尾状态组），不重算块数。

**核对的源码。** vllm-ascend `db701c1f` ascend_config.py、attention/indexer_kpool_mla_v1.py；`2c59ff10` ascend_config.py、attention/sfa_v1.py；`2ed6cbba` ascend_config.py；`baa023ad` ascend_config.py、attention/indexer.py。

**验证。** `pnpm wiki:lint` 通过，本页 0 报错 0 提醒（中途 summary 205 字报错、标记 34 处提醒，均已当场修掉）；`pnpm wiki:diagrams --check` 一致；`pnpm wiki:audit` 本页来源 23 条，全库无效 commit / 行号越界为 0。

**疑点。** 无 P1。为什么存在第三段「逃生口不是调优项」仍是旧版的 [I] 推断，未改。

## P5 审查（10-02）

审查员：独立审查（只审不改页面），第 26 批小修口径。

**分数：9 / 10**　P1 0 条 · P2 0 条 · P3 3 条　·　`pnpm wiki:audit` 本页通过（来源 23 条：21 条行号有效，2 条官方文档 URL 未联网验证，属常态）　·　`pnpm wiki:lint` 本页 0 报错 0 提醒

### 结构与口径
- 保留参数页 4 段 + 两节自动生成内容；新增内容只有一句话里的 kv-cache-quantization 链接、为什么存在里一句缓冲改正、开了的代价末尾一段 GLM 双机对照，没有改成长篇教学，没有新增图或分镜。按小修口径通过。
- 无收益数字：GLM 段末明写「没有实测收益数」，另一处未证实的点（main 上 GLM 模型代码是否保留同样拦截）写成「待核」，没有写成定论。没有把 GLM 主线数字当成该开关效果；「块长 4」只是解释报错原因的结构事实，并链接块表页，不重算。

### 「GLM 双机硬开会报错」独立核实（tools/repos/vllm-ascend @ db701c1f）
- ascend_config.py L280–L284：`enable_sparse_li_c8 = additional_config.get(..., False) and use_sparse`；`c8_enable_reshape_optim = enable_sparse_li_c8 and additional_config.get("c8_enable_reshape_optim", False)` —— 两键不写都为 False，属实。`use_sparse = model_uses_sfa_sparse(...)`（L267；utils.py L114–L122：有 `index_topk` 且无 `compress_ratios`），GLM 有 `index_topk=2048`、无 `compress_ratios`（02 L33、03 L98），所以两键都写 true 时本键为真。
- attention/indexer_kpool_mla_v1.py：`AscendIndexerKPoolMLABackend.get_impl_cls()` 返回 `AscendIndexerKPoolMLAImpl`（L549–L550），GLM 的 MLA 层用它（ops/indexer_kpool_mla.py L78；01 L303–L307）。`AscendIndexerKPoolMLAImpl.__init__` L565–L569：本键为真即 `raise ValueError`，原文为 "GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim because its indexer state cache has an independent slot mapping." 页面的中文转述（构造时直接报错、理由是索引器状态缓存有自己独立的 slot mapping）与原文一致，没有加码。
- 「启动命令里没有 --additional-config」：官方教程 `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 中 `additional-config` / `additional_config` / 本键 / `enable_sparse_li_c8` 0 命中；03 L26 也写明本部署没有 `--additional-config`。属实。
- 「块长只有 4」：block-table 页 GLM 节表格「indexer 尾状态组（12 层）| 4」，01 L42 同。锚点 `#放到-glm-双机r1-的-15-个块号进了哪几张表`（block-table L134）、`#放到-glm-双机这套部署没有开-kv-cache-量化`（kv-cache-quantization L177）、`#ascend-上的三条-kv-cache-量化路`（L159）、`#怎么开`（glm-5-3-flash-two-node L293，全页唯一）都存在。

### 「缓冲说法」改正独立核实
- v0.23 `2c59ff10` attention/sfa_v1.py L289–L294：builder 初始化时按 `max_num_batched_tokens` 申请 `group_len` / `group_key_idx` / `group_key_cache_idx` 常驻缓冲；L499 每步取 `group_len[:num_input_tokens]`。
- main `baa023ad` attention/indexer.py L524、L529–L532：容量 `_slot_capacity` 由 `max_num_batched_tokens` 算出；L898–L914 `_get_group_metadata_buffers` 首次用到时按该容量 `torch.empty`，超容量直接 RuntimeError。
- 旧版「按 slot_mapping.numel() 申请、所以启动期决定」确实不准；新版「按一步 token 上限预先留好、每步取前一截；不能按请求切换是因为开关启动时读定」属实。

### 旧版信息清单
- 清单存在：旧会话 scratchpad `p5/c8-enable-reshape-optim-8bd7e5f82c6c-facts.md`（17 条 + 3 条问题）。
- 抽 6 条到新版：第 1 条只管写入算子（L80）✔；第 2 条发布分支默认 False 且与 li_c8 相与（L80）✔；第 5 条 #15752 删 / #16952 恢复并翻默认（L82）✔；第 13 条 main 两道门、混部恒假（L108）✔；第 14 条跨版本两个方向的坑（L112–L113）✔；第 16 条 PD 从文档约定变硬判定（L117）✔。问题 A（缓冲）、B（GLM 对照）、C（依赖页链接）三条都已处理。
- `git diff`：删除行只有被改写的 summary / updated / 五段正文，删掉的是 5 个重复角标（[C3]、[C2]、[S8]、[S10]、混部行 [C2]），同一来源在同页别处仍在；sources 区无删除。无信息丢失。

### P3
1. GLM 段把报错理由转成了中文，没给英文原文。参数页读者常拿日志去搜，建议在「硬开会报错」处补上原文的关键片段（如 `does not support c8_enable_reshape_optim`），便于 grep 日志对上。
2. 「启动命令里没有 --additional-config」链到部署页「怎么开」，但那一节是参数表、并说完整命令以官方教程为准，只能靠「表里没列」间接支撑。更直接的出处是 03 L26（本部署没有 `--additional-config`），可改链或补一句。
3. `wiki/index.md` 第 108 行（以及 registry.json）仍是旧 summary，没有「GLM 双机没开，硬开会报错」；由 `pnpm wiki:build` 生成，提交前跑一次即可。

### 浏览器
- Playwright（1440 宽）只读访问 http://localhost:5193/#/wiki/c8-enable-reshape-optim-8bd7e5f82c6c：第一屏标题、新 summary、「一句话」（kv-cache-quantization 链接可见）、事实表正常；滚到「开了的代价」末段，GLM 双机一段、三个站内链接和 [C] 角标正常渲染。截图存审查员 scratchpad `c8-enable-reshape-optim-8bd7e5f82c6c-review-first.png`、`c8-enable-reshape-optim-8bd7e5f82c6c-review-glm.png`。本页无图、无分镜。

## P5 修订记录（10-02）

审查无 P1/P2，按「P5 审查（10-02）」的 P3 修：
- **P3-1 已改。** GLM 段「直接报错」后补日志原文关键片段 `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim`（db701c1f indexer_kpool_mla_v1.py L564–L568 原文），方便 grep 日志。
- **P3-2 已改（改为直接出处）。** 新增来源 [S24] = 官方教程 vllm-ascend@0576b647 `docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353`（§5.2 Multi-Node Deployment，两条 `vllm serve` 在 L269、L318）；全文 grep `additional-config` / `additional_config` 0 命中。正文改成「官方教程多机部署一节的两条启动命令都没写 `--additional-config` [S24]」，部署页「怎么开」的链接保留为取值汇总。没有链 03 L26：03 是底稿不是知识库页，站内来源也没有引用底稿的先例；03 L26 的结论与 [S24] 一致。
- **P3-3 未改，理由：** `wiki/index.md` 与 registry.json 由 `pnpm wiki:build` 全站生成，跑一次会把同批其他写手未完成的页一起写进去，留给主会话提交前统一 build。
- 内联标记 29 → 30（加 [S24]），未超过 30 的提醒线。

**验证。** `pnpm wiki:lint`：本页 0 报错 0 提醒；全站退出码 1，唯一报错是 params/enable-async-exponential.md 的 [mark-unnumbered]（别的写手在改的页，未碰）。`pnpm wiki:diagrams --check` 退出码 0；`pnpm wiki:audit` 退出码 0，本页来源 24 条、全站无效 commit / 行号越界 0。

复跑：写完记录后再跑 `pnpm wiki:lint`，全站退出码 0（那一处别页报错已由其写手修掉），本页仍 0 报错 0 提醒。

- **收尾清扫（2026-10-02）P3-3 已改。** 已跑 `pnpm wiki:build`（index.md 由 `scripts/wiki-build.ts` 生成）重建 index.md 与 registry.json；本页条目 summary 已含「GLM 双机没开…」。`pnpm wiki:lint` 退出 0。
