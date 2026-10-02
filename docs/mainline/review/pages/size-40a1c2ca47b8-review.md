# KVPPConfig.size 页审查记录

本文件由 P5 写手于 10-02 新建（此前本页没有 review 文件）。

## P5 写作记录（第 29 批小修，10-02）

### 旧版信息清单（现版 == `p4-checkpoint`，`git diff p4-checkpoint` 对本页无输出）

1. `size` 是 `KVPPConfig` 唯一字段、KVPP 唯一的数：一个 PP stage 上的层分成几份；`int = 1`，`1` 等于关，所有消费点写 `size > 1`；开了之后等于 `TP × PCP`，不能单独指定。
2. 存在范围：只在 main；v0.23、v0.26 两个提交上 `git grep -i kvpp` 零命中。
3. 事实表十行：类型与默认（所在类 frozen）、取值 `TP × PCP`、`divmod` 分层与前 `remainder` 个 rank 多一层、每块物理字节 = 自己那几层 + `2 ×` 最大层、压缩倍数 `L / (ceil(L/size) + 2)`、建组断言、本卡 owner 编号 `rank_in_group % size`、MTP cache 不参与划分、`size == 1` 三件事全不发生、覆盖版本只有 main。
4. 「为什么存在」：唯一需要这个数的地方是 `map_kvpp_layers_to_owners` 的 `divmod`；围着它的三处（建组并断言、启动期 `validate()`、换 `allocate_kvpp_cache` 并把 `hybrid_with_attn_and_mamba` 置回 `False`）；以及「分母不是倍数」那段推导与 `L / 3` 天花板、层数 60 从 TP8 到 TP16 倍数 6 → 10 的示意算例。
5. 「开了的代价」：它不是用户配出来的（唯一旋钮 `enable_kvpp`，官方表只有它加 `--enforce-eager`；写 `kvpp_config` 被 `_NON_USER_INPUT_KEYS` 静默剔掉）；`size` 跟着 TP 走，调 TP 会连带改 KV 物理摆法；层数除不尽时多拿一层的卡决定全局块数；`size == 1` 是最安静的失败态。
6. 自动生成的「版本谱系」「参数定义」两节。

逐条勾选：1–6 全部保留；只在第 2、5 条上各补了一句，并修正第 5 条里的一个数字（见下）。

### 改了什么（四处，均为小修）

1. **第 28 批审查转记的「六条」已按源码改成「七条」。** 转记来自 `kvpp-config-0445bd352140-review.md` 的「他页发现」。核对 `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L79-L100`，`KVPPConfig.validate()` 里一共 7 个 `raise ValueError`：DCP ≠ 1；连接器不是 `MooncakeConnectorV2`；`kv_role == "kv_consumer"`；没有 `--enforce-eager`；`not use_mla or is_hybrid`；投机方法不是 `mtp`；设了 `num_speculative_tokens_per_batch_size`。同时补一句指向概念页[会报什么错](../../../../wiki/concepts/kvpp.md#会报什么错)的入链，并说明那张表里第一行（`enable_kvpp` 不是布尔值）不在 `validate()` 里、读开关时就查——避免读者按表数成 8 条。页面里的链接写的是站内相对路径 `../concepts/kvpp.md#会报什么错`。
2. **补队列指定的依赖入链 `kv-cache-spec`。** 原文在「层数除不尽时」那段讲到 `get_num_blocks` 按本卡实际字节算块数、全局取最小，但全站没有一处把读者引到规格那页。补一句「每层先报什么规格、规格怎么变成缓存池里的一页」+ 链接 `kv-cache-spec.md#一层要存的状态怎样变成缓存池里的一页`，按「已讲过的一句话 + 链接」处理，不重讲。
3. **「存在范围」补 GLM 钉住提交的版本证据**：含 GLM 代码的 `db701c1f` 上同样没有 KVPP（`git grep -ci kvpp db701c1f -- vllm_ascend` 零命中）。
4. **末尾补 GLM 双机一段，并把「配置值 ≠ 实测效果」写明。** 内容：钉住版本里 `size` 恒为 1、`enable_kvpp` 被静默忽略；换到 main 时 TP8 × PCP1 = 8，`validate()` 先撞「只支持 eager」（主线配置录了 decode 图）、补上 `--enforce-eager` 后撞「只支持非混合 MLA」，建组/分层/换分配路径都走不到——这一段是 `kvpp-config` 与 `kvpp` 两页已讲过的结论，这里只用一句话 + 链接到概念页 [GLM 一节](../../../../wiki/concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)（页面里写的是 `../concepts/kvpp.md#...`）。随后点明：本页那些倍数是按层数与字节算出来的容量比，不是实测效果，本站这套部署开不到 KVPP，并写出缺口「待核：缺一组真开起来的每卡 KV 容量与解码时延对照」。

### 版本证据（本轮实际运行，均在 `tools/repos/vllm-ascend`）

- `git show baa023ad:vllm_ascend/ascend_config.py | sed -n '61,79p'`：`KVPPConfig` 唯一字段 `size: int = 1`；`from_vllm_config` 在 `enable_kvpp` 为假时返回 `cls()`，为真时返回 `cls(size=tensor_parallel_size * prefill_context_parallel_size)`。本页「取值 `TP × PCP`」「默认 1」两条与源码一致，未改。
- `git show baa023ad:vllm_ascend/ascend_config.py | sed -n '79,100p'`：`validate()` 的 7 条 `ValueError`（即上面第 1 条的清单），报错原文逐字对照概念页那张表无出入。
- `git grep -ci 'kvpp' db701c1f -- vllm_ascend`：零命中，GLM 钉住提交没有 KVPP。

### 数字出处

本轮没有新增任何部署数字。GLM 侧只引用已达标页的结论（`size = 8`、两条启动检查先后撞哪一条），数字不重算；`L / 3` 天花板与层数 60 的示意算例是旧版原有的形状推导（标 `[D]`），未动。队列写的 01 §0、§A0.4–A0.5 本轮无需取数：本页讲的是分母与容量比，没有引入新的部署字节数。

### 图

按队列要求沿用现状：本页原本没有 `wiki-diagram`，本轮不新增、不改 yaml/svg。

### 验证（本轮实际运行）

- `pnpm wiki:lint`：本页 0 报错（每次保存后都跑了一遍）。
- `pnpm wiki:diagrams --check`：`ok wiki:diagrams 290 张图与 spec 一致`。
- `pnpm wiki:audit`：本页一行为 `evidence=C 章节=11 正文 6938 字 / 6 节 来源 12 条`，无报错。
- 字数（去空白的正文字符，node 按 Unicode 码位计）：5644 → 6259。内联标记 23 处，未超上限。
- 未起服务、未截图。

### 自查疑点

- 无 P1。可提的 P3：事实表「MTP 的 cache 不参与划分，每张卡各留一份」标的是 `[C4]`，本轮没有回到源码复核这一条（本批任务未要求），若审查要坐实需看 `map_kvpp_layers_to_owners` 对 MTP 层的处理。
- 本轮读 `docs/mainline/02-forward.md` §5.5（上一页的任务）时被安全分类器拦过一次，之后未再读该底稿；本页未从底稿取数。

## P5 审查（10-02）

审查员：独立审查（只审不改页）。口径：参数页小修，四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 自动生成两节，不按深入页骨架扣分。

### 结论：8.5 / 10；audit 本页通过；P1 0 条，P2 1 条，P3 3 条

### 旧版信息清单
- 清单存在：写手自建在本文件「P5 写作记录 → 旧版信息清单」，共 6 条。
- 抽查 6 条到新版：第 1 条（唯一字段、`int = 1`、1 即关、`size > 1`、等于 TP × PCP）→ 第 53 行在；第 2 条（v0.23 / v0.26 零命中）→ 第 55 行在；第 3 条（事实表十行）→ 第 61–70 行十行齐；第 4 条（divmod、三处读取、分母推导、`L/3` 天花板、60 层 6 → 10 示意）→ 第 74–90 行在；第 5 条（不是用户配的、`_NON_USER_INPUT_KEYS`、跟着 TP 走、除不尽、`size == 1` 最安静）→ 第 94–100 行在；第 6 条（自动生成两节）→ 第 104、134 行在。勾选属实。
- `git diff -- <页>` 删掉的 3 行正文（第 55、98、100 行）都被同位置的扩写版取代，没有删减信息；「六条」改「七条」是改错。

### 重点 1：「七条」校验与报错原文——逐字核实，成立
- `baa023ad:vllm_ascend/ascend_config.py#L79-L100` `KVPPConfig.validate()` 共 7 个 `raise ValueError`（第 82、86、88、92、94、98、100 行）。
- 概念页 `kvpp.md`「会报什么错」表 8 行的报错列，与源码第 57 行（布尔检查，路径 `additional_config.enable_kvpp`）及上面 7 行逐字一致。
- 本页第 100 行说那张表多出的一条布尔检查「不在 `validate()` 里、读开关时就查」：源码第 69–71 行 `from_vllm_config` 里调 `validate_additional_config_bool`，成立。
- 「`size == 1` 时一条都不跑」：`platform.py#L1500-L1502` 只在 `size > 1` 时调 `validate()`，成立。
- 写作记录里把第 2 条概括成「连接器不是 MooncakeConnectorV2」不够准（源码第 84 行先放过 `AscendStoreConnector`），但页面没有逐条列，只链接到概念页，概念页那行写对了。不扣分。

### 重点 2：与 kvpp、kvpp-config 两页口径——七条一致；GLM 段是一句话 + 链接；版本覆盖口径不一致（P2-1）
- `kvpp-config` 第 85、114 行也是「七条」，三页一致。
- 第 102 行 GLM 段：db701c1f 无 KVPP（`git grep -il kvpp` 零命中，与 2c59ff10、2ed6cbba 同）；main 上 TP8 × PCP1 = 8；`validate()` 顺序先 DCP（=1 过）、连接器（单机部署无 `kv_transfer_config`，跳过）、再撞 eager、补上后撞非混合 MLA——与源码顺序和概念页 GLM 节一致，只给结论加链接，没有重讲。
- 写手的自查疑点「MTP cache 不参与划分」已替他坐实：`kv_cache_placement.py#L132-L147` docstring 与代码都把 MTP 层排除在 owner 映射之外、每卡全留。

### 数字
没有新增部署数字。`size = 8` 是 TP8 × PCP1，并链到概念页 GLM 节；60 层示意手算：ceil(60/8) = 8 → 60/10 = 6；ceil(60/16) = 4 → 60/6 = 10；上限 60/3 = 20，全对。`KVPP_SCRATCH_BUFFER_COUNT = 2`（`kv_cache_placement.py:20`）、`divmod`（第 150 行）、frozen（`ascend_config.py:58`）均核对一致。新加的「容量比 ≠ 实测效果」和待核缺口写法合规；没有虚构收益，没有把 GLM 主线数字当成 KVPP 效果。

### 链接与校验（本轮实际运行）
- 新增三个链接锚点都在：`kvpp.md` 第 189 行 GLM 节、第 265 行「会报什么错」；`kv-cache-spec.md` 第 62 行（标题带逗号和问号，slug 去标点后吻合，lint 跨页锚点校验通过）。
- `pnpm wiki:lint`：通过，本页 0 条；`pnpm wiki:audit`：exit 0，本页 `evidence=C 章节=11 正文 6938 字 / 6 节 来源 12 条`。
- 入链：全库只有 `wiki/index.md` 指向本页（kvpp、kvpp-config 都没链过来，见 P3-3）。
- 浏览器：Playwright 1440 宽打开 `http://localhost:5193/#/wiki/size-40a1c2ca47b8`，第一屏与「开了的代价」一屏渲染正常，新段落和三个链接显示正常（截图 `1237c9d2-…/scratchpad/size-40a1c2ca47b8-review-1.png`、`-2.png`）。本页无图、无分镜。

### P2
1. **版本覆盖写成「只在 main」，和已达标的 kvpp-config 页口径不一致，也不符合仓库现状。** 第 55 行「只在 main 开发主线上有」、第 70 行事实表「覆盖版本：只有 main；两个发布分支上…都不存在」。实测 `origin/releases/v0.28.0rc`、`origin/releases/v0.29.0rc` 的 `ascend_config.py` 第 61–100 行与 main 完全相同（`size: int = 1`、TP × PCP、七条报错一字不差）；v0.23.0 至 v0.27.1rc 为零。kvpp-config 第 87 行在上一轮已按同一问题改成「本站跟踪的三个版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上）」。改法：第 55、70 行照抄 kvpp-config 那句口径；「两个发布分支」改成「v0.23 / v0.26 两个分支」。旧版就有，非本轮引入，但写手本轮改了第 55 行这一段，应一并改掉。

### P3
1. **「版本谱系」自动表对本页无意义。** 标题是通用词 `size`，`wiki:lineage` 按文本匹配，得出「v0.13.0 起就有、2025-02-05 PR #3 引入」，和正文直接冲突，也盖住了 v0.28 / v0.29 才真有 KVPP 这一事实。这是工具层问题（同类通用名参数页都会中），不归写手小修；建议另开任务让 lineage 支持按页指定限定标识（如 `KVPPConfig`）。
2. 第 98 行「那页讲过，这里不重讲」的「这里不重讲」可删，留链接即可。
3. kvpp 概念页和 kvpp-config 页都没有链到本页；本页是 `L / (ceil(L/size) + 2)` 和 `L/3` 天花板的唯一出处，建议这两页在讲分层处加一个入链（属他页，不阻塞本页）。

### 跳过
未读 frontmatter 的 sources 区、代码块、参数定义一节正文；版本谱系只看了表头和「引入」一行；底稿 01 §0、§A0.4–A0.5 未读（本页没有用到其中数字）。

## P5 修订记录（10-02，按审查）

**P2-1 成立，已改。** 版本覆盖口径与 `kvpp-config` 统一。本轮在钉住仓 `tools/repos/vllm-ascend` 自己核了一遍：`git grep -c 'class KVPPConfig' <branch> -- vllm_ascend/ascend_config.py` 在 `origin/releases/v0.27.1rc` 上 0 命中，在 `origin/releases/v0.28.0rc`、`origin/releases/v0.29.0rc` 上各 1 命中；再用 `diff <(git show <branch>:…/ascend_config.py | sed -n '61,100p') <(git show baa023ad:… | sed -n '61,100p')` 对两个发布分支逐行比对，均无差异（`size: int = 1`、`TP × PCP`、七条 `ValueError` 全部相同）。据此：
- 「存在范围」第一句改为「本站跟踪的三个版本里只有 main 开发主线有（`releases/v0.28.0rc`、`releases/v0.29.0rc` 两个发布分支也已带上：那段 `KVPPConfig` 与 main 逐字相同，v0.23.0 到 v0.27.1rc 则没有）」。
- 事实表「覆盖版本」行改为「本站跟踪的三个版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上，见「版本谱系」）」，右栏「两个发布分支」改为「v0.23 / v0.26 两个分支」。

**P3-1 成立，已改（写在正文里，不动自动生成节）。** 在「开了的代价」末尾加一句提醒：别把「版本谱系」那张表当成这个字段的引入时间——表按标识符文本匹配算，而 `size` 是通用词，每个发布分支都能匹配到几百个文件；真正的覆盖范围看事实表「覆盖版本」那一行。写在自动生成节之外，`pnpm wiki:lineage` 重跑不会冲掉。

**P3-2 成立，已改。** `kv-cache-spec` 那处链接后面的「这里不重讲」删掉，只留链接。

**P3-3 不改（属他页）。** 审查员建议 `kvpp.md`、`kvpp-config` 在讲分层处加一个指向本页的入链。按派发纪律只改本页，未动他页；转记在此，供主会话另派。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0（5 处待留意均为他页）；`pnpm wiki:diagrams --check` exit 0；`pnpm wiki:audit` exit 0，本页 `evidence=C 章节=11 正文 7221 字 / 6 节 来源 12 条`。未起服务、未截图。
