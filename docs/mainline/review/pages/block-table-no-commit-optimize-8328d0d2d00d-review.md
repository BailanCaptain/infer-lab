# block-table-no-commit-optimize-8328d0d2d00d 审查记录

## P5 写作记录（2026-10-02，第 26 批小修）

**改了什么。** 保留参数页四节（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容（参数定义、版本谱系）不动，没有图，也没有新加图。正文去 frontmatter 后 4,610 → 6,284 字符（audit 口径 3,769 字 / 6 节）。
- 一句话：补一段「这个键已经不存在了」——09-23 由 PR #17066 合入 main，09-24 被 PR #17470 连同优化一起回退；钉住的 main `baa023ad`（09-21）早于合入，v0.23 `2c59ff10`、v0.26 `2ed6cbba`、GLM `db701c1f` 都没有。旧版写成「09-23 起只在 main 上有」，和同页自动生成的版本谱系（main = 无、已移除）自相矛盾。
- frontmatter：summary 末句同步改成「只在 main 上存在过一天」；updated 改为 2026-10-02；sources 追加 [C7] `baa023ad` ascend_config.py L1660–L1679、[C8] `db701c1f` block_table.py L284–L288。
- 事实表 7 → 8 行：「覆盖版本」改写；新增「在没有它的版本里写它」——发布分支逐键 `.get()` 静默忽略，main 的 AscendConfig 是 `extra="forbid"`，未知键构造时报错（装了 vllm-omni 改为告警并丢弃）。「寿命」一行的含义列改成「实际一天后就随回退删掉」。
- 为什么存在：老实现拷的是前 `num_reqs` 行整行，不是旧版说的整张 `max_num_reqs × 列数`；「每步最多一个块号」改成「通常零到一个」（chunked prefill 一步可追加多块）；补「一行都没动就整步不拷」。加一段 GLM 双机对照：`db701c1f` 走 MRv1 runner，每步整行提交，没有此键也没有优化；字节数只链接块表页，不重算；无实测收益数，写「待核：PR #17066 在昇腾上的提交耗时对比」。
- 开了的代价：拆成「存在的那一天」和「回退之后」两段；后者写明 main 上留着这个键会启动失败、发布分支静默忽略。

**旧版信息清单勾选**（清单在 scratchpad `p5/block-table-no-commit-optimize-8328d0d2d00d-facts.md`，旧版 = p4-checkpoint，和改前现版一致）：
1 回退开关语义 ✔ 一句话；2 名字读反 ✔ 一句话；3 MRv1 only ✔ 一句话 + 事实表；4 09-23 PR #17066 引入 ✔ 改写为「引入后次日回退」（证据：版本谱系 + `git log -S` 只有 ad7a731b / 4b4da9fa 两笔）；5 配置路径与 docstring 示例 ✔ 事实表；6 Literal 校验 ✔ 事实表；7 选择点与按组选类 ✔ 事实表（ad7a731b L455–L458、L478）；8 MRv2 无视 ✔ 事实表；9 寿命 ✔ 事实表（补实际删除时间）；10 环境变量不支持 ✔ 事实表（ad7a731b 文档 L26 核过）；11 发布分支静默忽略 ✔ 保留并补 main 报错（证据 [C7]，origin/main L564、L1832 同样禁止未知键）；12 整表拷贝 ✔ 改正为前 `num_reqs` 行整行（db701c1f L284–L288、baa023ad / v0.26 `copy_to_gpu(num_reqs)`、ad7a731b 回退类 L302–L303）；13 脏区与哨兵复位 ✔ 为什么存在（ad7a731b L353–L378）；14 同一 PR 带回退开关 ✔ 为什么存在；15 写 1 的代价、无告警 ✔ 开了的代价；16 不写即接受新默认 ✔ 限定在「存在的那一天里」；17 版本谱系 ✔ 自动生成未动。

**数字与结论出处。** 无该开关的实测数，没有写任何效果数字；GLM 双机只引用 01 §A3 第 5–6 条（v1 runner、`_prepare_inputs` 里 `commit_block_table(num_reqs)`），块表每步拷多少字节链接 block-table「表本身占多少，每步花多少？」一节，不重算。§A2.4 的 R1 新块数按口径是区间，本页不写。

**核对的源码。** vllm-ascend `ad7a731b`（引入）、`4b4da9fa`（回退）、`origin/main` b64b4d714（09-28，无此键、整行拷贝、禁止未知键）、`baa023ad`、`2ed6cbba`、`2c59ff10`、`db701c1f` 的 block_table.py 与 ascend_config.py；官方参数表 ad7a731b `docs/source/user_guide/configuration/additional_config.md` L26、L76。

**验证。** `pnpm wiki:lint` 通过、本页 0 报错 0 提醒；`pnpm wiki:diagrams --check` 287 张一致；`pnpm wiki:audit` 本页来源 8 条行号全有效。

**疑点。** 无 P1。两节自动生成内容仍写着扫描时的 main `39fef3f8`（引入与回退之间的那一笔），由参数扫描产出，本页未手改。

## P5 审查（10-02）

审查员：独立审查（只审不改页面），第 26 批小修口径。

**分数：8.5 / 10**　P1 0 条 · P2 1 条 · P3 3 条　·　`pnpm wiki:audit` 本页通过（来源 8 条，行号全有效）　·　`pnpm wiki:lint` 本页 0 报错 0 提醒（全库唯一失败在 concepts/request-teardown.md 的 frontmatter，与本页无关）

### 结构与口径
- 保留参数页 4 段（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 两节自动生成内容，没有改成长篇教学，没有新增图或分镜。按小修口径通过。
- 无收益数字：「为什么存在」末尾明写没有实测数，挂「待核」（站内 111 页同用此写法，不算 meta 文本）。GLM 双机一段只引 01 §A3 第 5–6 条（v1 runner、`_prepare_inputs` 里 `commit_block_table(num_reqs)`，01 L708–L728 核过），字节数只链接块表页，没有把 GLM 主线数字当成该开关效果。

### 「已回退、各版本不存在」独立核实（tools/repos/vllm-ascend）
- `git grep 'block_table_no_commit_optimize\|OptimizedBlockTable'`：2c59ff10（v0.23 维护分支，09-10）、db701c1f（GLM，09-02）、2ed6cbba（v0.26，09-17）、baa023ad（main，09-21）均 0 命中；ad7a731b（09-23）4 个文件命中；4b4da9fa（09-24）0 命中。
- `git log --all -S block_table_no_commit_optimize` 只有两笔：ad7a731b（PR #17066 引入）、4b4da9fa（PR #17470「Revert MRV1 dirty block-table optimization」）。
- `git merge-base --is-ancestor baa023ad ad7a731b` 成立 → 钉住的 main 早于引入；origin/main b64b4d714（09-28）0 命中。
- 结论：页面「只在 main 的 09-23 至 09-24 之间存在、钉住的四个版本都没有」属实。

### 写手两处改正的核实
- [C8] db701c1f block_table.py L284–L288：`commit_block_table` 只拷 `[:num_reqs]` 行、每行整行 —— 「前 num_reqs 行整行」改正属实，旧版「整张 max_num_reqs × 列数」确实不准。
- [C7] baa023ad ascend_config.py L1660–L1679：未知顶层键原样传给 `AscendConfig(**kwargs)`；装了 vllm_omni 时先 `logger.warning` 再剔除。`AscendConfig`（L296，`@config` pydantic dataclass）docstring L301–L302 写明 `extra="forbid"`。origin/main L405、L1835 同样。发布分支 2c59ff10 / db701c1f / 2ed6cbba 的 ascend_config.py 无 `extra="forbid"`、顶层逐键 `.get()`（v0.26 唯一的 unknown 检查在 L950–L952，只管 short_request_first_config 子配置）。「main 构造时报错、发布分支静默忽略」属实。
- 其他抽核：ad7a731b block_table.py L455–L458 `_get_block_table_cls()`、L478 按组选类；L353–L354 脏区数组；L397–L400 无脏行直接 return —— 「一行都没动就整步不拷」属实。

### 旧版信息清单
- 清单存在：旧会话 scratchpad `p5/block-table-no-commit-optimize-8328d0d2d00d-facts.md`（17 条 + 4 条冲突点）。
- 抽 6 条到新版：第 1 条回退开关语义（L42）✔；第 2 条名字读反（L42）✔；第 6 条 Literal 校验（L69）✔；第 8 条 MRv2 无视（L71）✔；第 10 条环境变量不支持（L73）✔；第 15 条写 1 的代价、无告警（L85）✔。
- `git diff` 删除行逐条对照：旧 summary、寿命、覆盖版本、为什么存在、开了的代价五处被删内容都在新版以改写形式保留，无信息丢失。

### P2
1. **事实表仍用现在时描述一个可用的开关，「适用范围」一行有误导**（正文 L68–L73）。页面上方已说明键不存在，但表里「类型与默认：只认 0/1」「选择点」「环境变量：只认 additional-config 里的 0/1」都按现役开关在写；「适用范围」的「意味着什么」写「不跑 MRv1 的部署写它没有效果」，反推出「跑 MRv1 的部署写它有效果」—— 而当前任何版本里写它要么被忽略、要么启动报错，和 MRv1 无关。改法：表前加一句「下表前五行描述的是它存在那一天（ad7a731b，09-23 的 main）的行为」，或把这几行改成过去时；「适用范围」的含义列改成「当时也只对 MRv1 生效；现在任何版本写它都没有效果（见下两行）」。

### P3
1. 「一句话」第一段先用现在时讲「这个键是它的回退开关：0 用优化实现、写 1 换回」，第二段才说「已经不存在」。读者扫第一句会以为能用。建议把「这个键已经不存在了」提到第一句，再讲它当时是什么。同类残留：frontmatter summary 和 relations（to: block-table）的 note 仍写「写 1 换回 / 退回整表拷贝」，用现在时且仍是「整表」，和正文已改正的「前 num_reqs 行整行」不一致（字段注释原文是上游的 full-table，不动）。
2. `wiki/index.md` 第 107 行（以及 registry.json）仍是旧 summary「只在 main 上有」，与新 summary 矛盾；它们由 `pnpm wiki:build` 生成，提交前跑一次 build 即可。
3. 两节自动生成内容和 [C1]–[C6] 钉在扫描时的 39fef3f8（引入与回退之间那一笔），写手已自报；属参数扫描产物，不手改，可在下次 `wiki:lineage` / 扫描时处理。

### 浏览器
- 用 Playwright（1440 宽）只读访问 http://localhost:5193/#/wiki/block-table-no-commit-optimize-8328d0d2d00d。第一次访问时页面被 Vite 报错层挡住（「知识库页面不合法」，起因是当时 concepts/request-teardown.md frontmatter 第 78 行 YAML 解析失败，别的写手在改的页）；审完第二页后重访已恢复。
- 第一屏实测：标题、新 summary（「只在 main 上存在过一天」）、「一句话」两段（加粗的「这个键已经不存在了」）、自动生成的参数定义表正常渲染，证据角标正常。页头徽章「已核对 main」来自 frontmatter `verified: [main]`（旧版即有）。截图存审查员 scratchpad `block-table-no-commit-optimize-8328d0d2d00d-review-first.png`。本页无图、无分镜。

## P5 修订记录（10-02）

按「P5 审查（10-02）」修：
- **P2（事实表现在时）已改。** 表前加一句「前六行记的是它存在那一天（09-23 的 main，`ad7a731b` 起）的行为，最后两行才是现在的情况」；前六行里除「寿命」外的五行项名都加「当时的」，含义列改成过去时（「当时只认 0 / 1」「当时设环境变量也等于没设」）。「适用范围」含义列改成「当时也只对 MRv1 生效；现在任何版本写它都没有效果（见最后两行）」，不再能反推出「跑 MRv1 就有效」。
- **P3-1 已改。** 「一句话」两段对调：第一句就是加粗的「这个键已经不存在了。」，再讲它当时是什么、名字为什么容易读反。frontmatter summary 改成「已不存在的键：曾是……」开头，「整表」改为「整行」；relations（to: block-table）的 note 改成过去时、「整行拷贝」，并补「09-24 已随优化回退」。字段注释是上游原文（full-table），未动。
- **P3-2 未改，理由：** `wiki/index.md` 与 registry.json 由 `pnpm wiki:build` 全站生成，跑一次会把同批其他写手未完成的页一起写进去，超出本页范围；留给主会话提交前统一 build。
- **P3-3 未改，理由：** 参数定义与版本谱系两节、[C1]–[C6] 是参数扫描产物，按审查意见留待下次扫描处理。

**验证。** `pnpm wiki:lint`：本页 0 报错 0 提醒；全站退出码 1，唯一报错是 params/enable-async-exponential.md 的 [mark-unnumbered]（别的写手在改的页，未碰）。`pnpm wiki:diagrams --check` 退出码 0（290 张一致）；`pnpm wiki:audit` 退出码 0，本页来源 8 条、全站无效 commit / 行号越界 0。

复跑：写完记录后再跑 `pnpm wiki:lint`，全站退出码 0（那一处别页报错已由其写手修掉），本页仍 0 报错 0 提醒。

- **收尾清扫（2026-10-02）P3-2 已改。** 已跑 `pnpm wiki:build`（index.md 由 `scripts/wiki-build.ts` 生成）重建 index.md 与 registry.json；本页条目 summary 已更新，「只在 main 上有」0 处。`pnpm wiki:lint` 退出 0。
