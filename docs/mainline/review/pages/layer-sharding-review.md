# layer-sharding 审查记录

## P5 写作记录（第 28 批，小修，2026-10-02）

**范围**：保持参数页 4 段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 两节自动生成区不动；沿用现有图 `layer-sharding.yaml`，未改图。按队列要求：本页只解释自身开关；PP 对照与 Broadcast 一句话 + 链接回概念页；GLM 每卡权重只链接部署页单一出处、不重算。

**字数**：正文非空白字符 14,155 → 16,326（awk 去 frontmatter 后计数）；audit 正文 9,660 → 10,909 字。增量主要是 GLM 双机段。

**改了什么**
1. 一句话 · 存在范围：v0.26 的「2026-09-17 快照」改为钉住提交 `2ed6cbba`，main 标 `baa023ad`；补「v0.23 维护分支 `2c59ff10` 之外，GLM 钉住的 `db701c1f` 也还留着同一套，启动校验在同一行」（P2：旧版只说 v0.23 有，漏了本站 GLM 实际运行的版本）。
2. 一句话：删掉过时的「本页旧算例 Qwen3-0.6B 单卡」段，换成「本站 GLM 双机用不到它」并指向末段（P2：旧主线遗留）。
3. 为什么存在：补一句与 [PP](../../../../wiki/concepts/pipeline-parallel.md#pp-是什么) 的区别（PP 连计算一起分、段间传激活；它只分权重存放、每卡照样算全部层、传权重），链接 `pipeline-parallel.md#pp-是什么`；异步广播一句链接 `collective-communication.md#broadcast`，并点明源是常驻卡（`2c59ff10` `ops/layer_shard_linear.py` 87、139 行 `src = ranks[layer_idx % world_size]`）。
4. 开了的代价：末尾新增 GLM 双机段（见下）。原 DeepSeek-V3/R1 显存与通信账（[D] 推导，非实测）原样保留。
5. frontmatter：summary 补 GLM 一句（≤200 字）；updated 改 2026-10-02。未动 sources 区、事实表、自动生成区。

**GLM 双机段的依据（全部本轮实读）**
- 部署：底稿 01 第 848 行（没有 kv_transfer_config，混部）；第 893 行（enable_flashcomm1 / enable_sp 按默认关闭处理）；部署页与 01 中均无 DSA-CP / enable_dsa_cp。
- 报错原文：`db701c1f` 与 `2c59ff10` 的 `vllm_ascend/platform.py` 第 346 行，逐字照抄；`db701c1f` 第 338–346 行 `_validate_layer_sharding_config`，在 `check_and_update_config`（450 行起）里第 467 行第一个被调用。
- 登记点：`db701c1f` `git grep 'register_all_layers_to_shard_weight_series('` 只有 `attention/mla_v1.py:775`、`attention/sfa_v1.py:740`（另一处是定义本身）。
- GLM 层构成：底稿 02 §1.1 层表（0–2 与其余 31 层为 KDA 共 34 层；11 层稀疏 MLA + 索引器）。KDA 实现在 `ops/kimi_kda.py`（`git grep -il kda`）。
- GLM 稀疏 MLA 的实现：`ops/indexer_kpool_mla.py:78` 用 `AscendIndexerKPoolMLABackend`；`attention/indexer_kpool_mla_v1.py:557` `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`，`__init__` 先 `super().__init__`。
- SFA 登记条件：`sfa_v1.py` 728–740（`enable_dsa_cp` 且 `enable_dsa_cp_with_layer_shard` 才登记）；`utils.py` 1542–1561（DSA-CP 需模型有索引器、`additional_config` 写 `enable_dsa_cp`，且要求 SP 已开，否则报错）。
- 结论标为「按现有参数推断」；待核：GLM 在 P 节点上若开 DSA-CP，11 层投影分到几张卡、每卡省多少（无推导、无实测）。没有写任何效果数字，没有把 GLM 主线数字当成本开关效果；02 §1.3 每卡权重只通过部署页「每张卡上放了什么」链接，未重算。

**旧版信息清单勾选**（清单：scratchpad\p5\layer-sharding-facts.md；旧版 = p4-checkpoint = 改前现版）
- L1–L2：保留。
- L3：保留，补提交号与 db701c1f。
- L4：保留。
- L5 Qwen3-0.6B 旧算例：删除，理由是站点主线已换成 GLM 双机；同一结论（无 kv_transfer_config 启动即报错）由新的 GLM 段承接并附报错原文。
- L6–L16（官方链接与事实表全部行）：保留，未改。
- L17–L18：保留，补 PP 对照与 Broadcast 链接。
- L19 图：保留。
- L20–L21：保留。
- L22–L23 DeepSeek 显存 / 通信账：保留原数（[D] 推导）。
- L24–L31：保留，未改。
- L32 自动生成区：未动。

**自查疑点**：无 P1。已修 2 处 P2（漏写 GLM 钉住版本仍含此机制；旧 Qwen 算例过时）。待核 1 处（见上）。

**验证**：每次保存后 `pnpm wiki:lint` 通过（仅他页 5 处 mark-flood 提示）；`pnpm wiki:diagrams --check` 290 张一致；`pnpm wiki:audit` 通过，本页不在名单内，无报错。

## P5 审查（10-02）

审查员：独立审查（Opus 5.5），只审不改。按参数页小修口径审（4 段式 + 两节自动生成区），不按深入页骨架扣分。

**结论：9 / 10。audit 本页通过；P1 0 条；P2 0 条；P3 3 条。**

### 初学者测试（只读一句话 + 事实表）
我的一句话：`layer_sharding` 把点名的同构 Linear 权重按层号轮流只存在组里一张卡上，前向前一层用异步 Broadcast 取回，用通信换 P 节点显存；只能在 PD 分离的 P 节点开，v0.24.0rc 起已删除。——能说清，通过。为什么存在一节新加的 PP 对照（PP 连计算一起分、段间传激活；它只分权重存放、每卡照样算全部层、传权重）一句话讲清且正确，链接 `pipeline-parallel.md#pp-是什么`。

### 写手待核项：标注合格
- 138 行明确写「按现有参数推断」与「待核：GLM 在 P 节点上若开 DSA-CP，11 层的投影分到几张卡、每卡能省多少——本站没有推导，也没有任何实测」，是待核，不是定论。没有给任何收益数字，没有把 GLM 主线数字当成本开关的效果。
- 每卡权重只链接部署页「每张卡上放了什么」（`glm-5-3-flash-two-node.md` 158 行标题存在），页内没有任何 GLM 的 GiB / MiB 数字（grep 确认），没有重算。符合单一出处。

### 核心机制与新增 GLM 段：对照钉住版本源码，全部属实
- 报错原文与位置：`db701c1f`、`2c59ff10` 的 `vllm_ascend/platform.py` 均为 338 行 `_validate_layer_sharding_config`、346 行 raise，判据是 `kv_transfer_config is None or kv_role != "kv_producer"`；`check_and_update_config`（450 行）里设备 / 模型配置判空和量化自动检测之后，467 行第一个调用它。页面「第一个就查这个键」「两版同一行同一句」成立。
- 登记点：`db701c1f` `git grep 'register_all_layers_to_shard_weight_series('` 只有 `attention/mla_v1.py:775`、`attention/sfa_v1.py:740` 和定义处 `ops/layer_shard_linear.py:285`。SFA 侧 728–740 行确实要 `enable_dsa_cp` 且 `enable_dsa_cp_with_layer_shard` 才登记。
- GLM 稀疏 MLA 走 SFA 派生类：`attention/indexer_kpool_mla_v1.py` 557 行 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`，`__init__` 先 `super().__init__`；`models/glm5_next.py` 用的是 `indexer_kpool_mla` 后端（90–91、171–192、2018 行），不走 `mla_v1`。KDA 在 `ops/kimi_kda.py`。
- DSA-CP 前提：`db701c1f` `utils.py` 1542–1561，要求模型有索引器、`additional_config` 里有 `enable_dsa_cp`，且 SP 未开时直接报错。底稿 01 第 893 行 FlashComm1 / SP 按默认关闭，01 和部署页均 grep 不到 DSA-CP；第 848 行无 `kv_transfer_config`。推断链成立。
- 层构成：底稿 02 第 28 行 KDA 34 层 + 稀疏 MLA 11 层，与页面一致。
- Broadcast 源是常驻卡：`2c59ff10` `ops/layer_shard_linear.py` 86–87 行 `dist.broadcast(..., src=ranks[layer_idx % world_size])`，56 行归属判定 `layer_idx % world_size == rank_in_group`，与「第 i 层落在 rank i % K」一致。
- DeepSeek 账（未改，复算一遍）：7168 × 16384 = 117,440,512 → 112 MiB；× 61 = 6832 MiB ≈ 6.67 GiB；/16 = 427，+224 = 651 MiB，省 6181 MiB ≈ 6.0 GiB；通信 61 × 15/16 × 112 = 6405 MiB ≈ 6.3 GiB、每层 105 MiB。全部正确，且标了 [D] 推导。

### 旧版信息清单
清单存在：`13898c74…/scratchpad/p5/layer-sharding-facts.md`（L1–L32）。抽查 6 条到新版：L1（73 行）✓；L5 Qwen3-0.6B 旧算例删除，「无 `kv_transfer_config` 配了起不来」这条结论由 134 行 GLM 段承接并附报错原文，删得有理 ✓；L12（92 行）✓；L21（110 行）✓；L22（114 行，数字未动）✓；L27（124 行）✓；另看 L30（130 行）✓。`git diff p4-checkpoint` 删除行只有旧存在范围段、Qwen 段、机制段（均被扩写版替代），没有丢信息。

### 口径与链接
- 「只解释自身开关」：PP 与 Broadcast 各一句 + 链接，没有重讲概念页。本参数没有对应概念页，GLM 段讲的是本开关在 GLM 上的去向，不算重讲。
- 锚点 `pipeline-parallel.md#pp-是什么`（29 行）、`collective-communication.md#broadcast`（100 行）、`glm-5-3-flash-two-node.md#部署前提` / `#每张卡上放了什么` 均存在；`pnpm wiki:lint` 通过。入链：kvpp.md 97 行、index.md 121/206 行、enable-matmul-allreduce 114 行、enable-pcp-o-proj-weight-sharding 81/123 行，均可解析。
- 图 `layer-sharding` 未改（`git status` 只有页面本身有改动）。

### P3
1. **138 行 GLM 段正文堆了 7 处文件路径 + 行号**（`mla_v1.py` 第 775 行、`sfa_v1.py` 第 740 行、`ops/kimi_kda.py`、`indexer_kpool_mla_v1.py` 第 557 行、`sfa_v1.py` 第 728–740 行等），134 行也有一处。对初学者太密，行号更适合放进证据角标 / sources。改法：正文只说「登记只发生在 MLA、SFA 两个注意力后端；GLM 的 KDA 层不经过它们，稀疏 MLA 层用的是继承 SFA 的 GLM 专用类，而 SFA 只在开了 DSA-CP 时登记」，行号挪到角标。
2. **138 行待核写「11 层的投影」**：底稿 02 第 142 行指出 MTP 的第 45 层也是稀疏 MLA 层、走同一条 MLA 分支。待核里补半句「主干 11 层，另有 MTP 第 45 层同一路径」更严谨；不影响「按现有参数一层都不会被切」的结论。
3. **77 行「整套机制只活在 v0.23 维护分支上，GLM 钉住的 `db701c1f` 也还留着同一套」**前后两半字面打架。建议改成「只活在 v0.23 这一代代码里：维护分支 `2c59ff10` 和本站 GLM 钉住的 `db701c1f` 都有」。事实表「v0.23 维护分支」一列也可在表头注一句含 `db701c1f`（写手没动事实表，按小修范围不强求）。

### 验证
- `pnpm wiki:audit`：exit 0，全库「无效 commit 0，文件不存在 0，行号越界 0」；本页 32 条来源无报错项。
- `pnpm wiki:lint`：ok（另有 5 处待留意，均不在本页）。
- 浏览器：5193 端口本轮未在监听（127.0.0.1 返回 000、netstat 无 5193），按要求不起服务，**未截图**。图未改动，写手已跑 `wiki:diagrams --check` 290 张一致；页面排版观感未在浏览器复查。

## P5 修订记录（10-02，按审查）

**P3-1 成立，已改。** GLM 段正文里的文件路径与行号全部删掉（`mla_v1.py`、`sfa_v1.py`、`ops/kimi_kda.py`、`indexer_kpool_mla_v1.py` 等），只留机制句：登记只在 MLA、SFA 两个注意力后端；KDA 层不经过；稀疏 MLA 用继承 SFA 的 GLM 专用类；SFA 只在开了 DSA-CP 时登记。报错原文的出处按派发要求保留，但改用已有角标 [C2]（sources 第 2 条 `2c59ff10:vllm_ascend/platform.py#L338-L346`；`db701c1f` 同文件同行同句，已在「P5 写作记录」核过），正文写「与 v0.23 维护分支同一行同一句」。没有新增 sources 条目；其余行号证据仍在「P5 写作记录」。

**P3-2 成立，已改。** 待核句改为「主干 11 层稀疏 MLA（MTP 的第 45 层也是稀疏 MLA，走同一路径）」，依据底稿 02 第 142 行；同段「45 层里 34 层是 KDA」改为「主干 45 层」。结论不变。

**P3-3 成立，已改。** 存在范围改为「只活在 v0.23 这一代代码里：维护分支 `2c59ff10` 和 GLM 钉住的 `db701c1f` 都有（启动校验在同一行）；下面事实表那一列按维护分支写」。没有在表头声称整列对 `db701c1f` 都成立，因为表里 `prefetch_step` 等行本轮只在 `2c59ff10` 核过。

**跨页 P3（来自 `enable-pcp-o-proj-weight-sharding-8528cf5af9c6-review.md`「P5 审查（10-02）」P3-1）成立，已改。** 主会话说这一条在 enable-pcp-embedding-lmhead 那份 review 里，实际查到在 enable-pcp-o-proj 的 review 第 51 行（enable-pcp-embedding-lmhead 的 review 里没有指向本页的条目，已 grep 确认）。本页第 130 行「只有 main 上才有」改为「钉住的三个版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上）」，并给开关名加了到 `enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md` 的链接。本轮复核：`git grep -l enable_pcp_o_proj_weight_sharding -- vllm_ascend` 在 `2c59ff10`、`2ed6cbba`、`origin/releases/v0.27.1rc` 为 0，`baa023ad`、`v0.28.0rc`、`v0.29.0rc` 各 3 个文件。

**他页转记（不改）。** kvpp-config 的审查发现 `wiki/params/size-40a1c2ca47b8.md` 第 100 行仍写「六条」，属第 29 批，本轮未改。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0（另 5 处他页 mark-flood 提示）；`pnpm wiki:diagrams --check` exit 0；`pnpm wiki:audit` exit 0，本页 evidence=C、来源 32 条、正文 10893 字 / 6 节。图未改，未起服务、未截图。
