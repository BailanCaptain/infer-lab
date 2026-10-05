---
id: F002
title: vLLM-Ascend 参数清单与版本谱系
status: in-progress
owner: BailanCaptain
created: 2026-09-10
---

# F002 — vLLM-Ascend 参数清单与版本谱系

**Status**: in-progress（当前验收见 10-05 对账记录；排除大规模导入，真实模型未通过项不以工程测试替代）
**Created**: 2026-09-10
**Updated**: 2026-09-21

## Why

用户 2026-09-10 提的原始问题：

> 比如 layer_sharding 这个参数，我问 layer_sharding 这个参数干嘛的啊，需要解释这个参数，然后可以告诉我这个参数在 vllm-ascend 哪个版本会移除，移除的 PR 是哪个，目前哪些分支保留了这个参数，哪个分支没有这个参数了。

> layer_sharding 只是一个例子，vllm-ascend 有非常多这种参数，需要去查去找，要在初期尽可能的找到。而且后续还要有机制，假设有新的参数进来，需要及时有机制去触发写 wiki 然后更新到我们的 LLM-WIKI 中。

F001 结构上答不了这类问题，三个原因：

1. **参数量级远超手写 seeds 能覆盖的范围**。仅 `vllm_ascend/ascend_config.py`（1432 行，15 个 Config 类）一个文件就有约 100 个参数字段，另有 `envs.py` 的 12 个环境变量与全仓约 25 处散落的 `os.getenv`。F001 的 `wiki/seeds/vllm-ascend.yaml` 是手写的 11 条，扩不到这个量级。
2. **官方文档不是完整参数参考**。`docs/` 树 152 个 md 文件全查一遍，仍有 7 个参数（`ascend_log_path`、`draft_window_size`、`enable_sp_by_pass`、`num_head_replica`、`olora_tensor_parallel_size`、`pd_head_ratio`、`pd_tp_ratio`）一次都没出现（宽松匹配复核后的数；最初用精确匹配数出 8 个，`mix_placement` 其实以 `Mix placement` 的写法出现在 release notes 里）；另有 6 个只在某个模型教程或特性指南里被提到，不在配置参考页（`user_guide/configuration/additional_config.md`）里。学习者按文档查不到，只能读源码。
3. **参数在分支间的分布是非单调的**，单 commit 钉定答不了「哪个版本移除」。`layer_sharding` 实测分布：

   | ref | 含该标识符的 py 文件数 |
   |---|---|
   | `releases/v0.13.0` | 8 |
   | `releases/v0.18.0` | 9 |
   | `releases/v0.23.0` | **14**（核心实现 `vllm_ascend/ops/layer_shard_linear.py`）|
   | `releases/v0.24.0rc` | 0 |
   | `releases/v0.25.1rc` | 0 |
   | `releases/v0.26.0rc` | 1（只是单测里的残留赋值 `self.impl.layer_sharding_kwargs = []`，不是功能回归）|
   | `releases/v0.27.1rc` | 0 |
   | `main` | 0 |

   数字是 2026-09-11 在**完整克隆**下测的。同一批命令在部分克隆下给出的是 5 / 1 / 11–13，错得离谱且不稳定（见 Design Decisions「扫描方式」下方的克隆说明）。

   在 `main` 的代码里它根本不存在，全仓只有 `docs/source/tutorials/models/GLM5.2.md:184` 提了一句「启用 DSA-CP 后 `layer_sharding` 不能包含 `o_proj`」。

## What

用户能感知到的变化：

- 问任意一个 vllm-ascend 参数，都能得到答案——包括官方文档没写的、以及主线已经删掉的。
- 答案里带版本信息：哪个提交引入、哪个 PR 删除、进了哪些 tag、当前哪些分支还有。
- 新参数合入上游后，知识库自动发现并生成草稿，不需要人去盯。
- 参数页顶部有版本横幅（如「此参数在 main 已移除，v0.24 起，PR #NNNN」），过期信息不会静默留着。

## Acceptance Criteria

### 当前对账与历史证据

当前结论见 [2026-10-05 P6 验收与功能对账](../plans/2026-10-05-p6-acceptance.md)。下表保留 2026-09-24 的历史记录；原始 AC 条文继续作为需求基线，未复测项目不自动升级为通过。

### 历史验收状态（2026-09-24）

这张表记录 2026-09-24 的历史验收状态，不代表当前全量复测结果。「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；页数、预算这类会变的数字按它 §2 的命令现查。分级取 [2026-09-19 审视](../plans/wiki-audit-2026-09-19.md) §3 的口径：真实实现并测试 / 只用固定输出验证 / 部分实现 / 未执行 / 与 AC 文本不符。

| AC | 当前结论 | 证据与未满足条件 |
|---|---|---|
| AC1 | 部分实现（扫描器在生产跑，全量确认未完成） | 四种定义形态、注释字典键、grep 交叉引用、同名类作用域各有单测。夜间同步每晚在 main 上实跑一次扫描（结果落 `wiki/_jobs/sync/last-run.json`）。**扫描产物 `wiki/lineage/params-<ref>.json` 是本机数据、不在 git 里**，换机器要重跑；`confidence: suspect` 的长尾未经 AC2 复核，因此不能说「参数清单已全部确认」。**2026-09-21 三轮修复，判据比原来严得多**：① 原规则「类名以 `Config` 结尾 = 确定的 `additional_config` 键」把内部 dataclass 也算了进去，而夜间任务对「确定」的条目直接出正式页，于是多出 5 个误报正式页；现在扫描范围里有 `AscendConfig` 时，只有定义在它所在文件里、或被那个文件点名用到的类才算 certain，其余降 suspect、不自动出页（`a306f29`，那 5 页同批删掉）。② 工厂函数构造后按关键字传进 `AscendConfig(...)` 的子配置现在挂到正确的键下（`additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`）；`_NON_USER_INPUT_KEYS` 里、且根配置文件中没有任何一处从用户输入读的键（`kvpp_config` 及其下的 `size`、`pd_tp_ratio`、`pd_head_ratio`、`num_head_replica`、`enable_sp_by_pass`）判 suspect；`AscendConfig` 够不着的类，路径改以类名起头（`YuanrongConfig["use_layerwise"]`），不再谎称挂在 `additional_config` 下（`2329ead`）。③ 页面里原先兜底说明「生成区是错的」改成正面写法（`52f5d9c`）。现在 main 上 149 个字段、105 个判 certain（全在 `ascend_config.py`）。**改扫描器必须拿真实仓库跑一遍**——这次就是在真实仓库核对时抓到一个自己刚引入的 bug（根配置自己的类方法赋值被当成子配置，所有路径凭空多一层），已用测试钉住，单元测试覆盖不到上游的写法。**2026-09-23 再降噪一轮**（用户问「为什么这么多」后同意）：① 函数转发的 `kwargs[...]` 不再算疑似参数，配置类内部的照旧；② 一个身份键只留最靠前一行——之前同值多行共用键，夜间比对取到不同行就报假「变更」，09-22 那晚 27 条变更全是这种；③ 出现位置只留前 5 处、另记 `occurrenceCount`，比对统一走 `withoutLocations`。三个基线在各自钉住的 commit 上重扫核对后写入（合计 12 MB → 0.8 MB，队列 22.1 万行 → 1.0 万行），迁移方法照下表那条。 |
| AC2 | 只用固定输出验证 | 三态输出、逐字引文、保留 `undetermined` 各有固定输出测试。**未用真实模型复测**分类准确率；夜间任务不调模型（配置里没有 `paid` 块，见 `scripts/wiki/sync.ts:47`），所以复核不会自己发生。09-21 收紧判据之后 certain 从 111 降到 105，suspect 这条长尾变长了，复核反而更该跑——但仍未跑。 |
| AC3 | 真实实现并测试 | `wiki/lineage/layer_sharding.json` 记录每个 ref 的完整 commit、搜索路径、tag 与逐提交核实的边界；移除提交 `89601215` / PR #11953 与引入提交 `f7db812e` / PR #5181 都在。**2026-09-21 谱系表改成逐个发布分支列出**（`13a83ef`）：从原来的八个 ref 扩成 12 个（v0.13.0 / v0.18.0 / v0.20.2rc / v0.21.0rc / v0.22.1rc / v0.23.0 / v0.24.0rc / v0.25.1rc / v0.26.0rc / v0.27.1rc / v0.28.0rc / main），27 份 lineage JSON 与 24 页参数页同批重算。存盘的 `paths` 是 `["vllm_ascend/"]`，文件数 6/7/7/7/7/8/0/0/0/0/0/0，与下方 AC 文本一致（AC 的验收口径 2026-09-21 已从 `--paths '*.py'` 对齐到这里，理由见 AC3 条目）。同一条修复还治了一个会整批失败的 bug：`wiki:lineage:apply` 把页面标题当参数名，标题写成「中文名（参数名）」时整批炸掉（`profiling-chunk-config` 改标题后触发）——现在取括号里的参数名，取不到就跳过该页。v0.26 的单测文本残留不算功能回归。 |
| AC4 | 部分实现（生成器已在生产产出，全量未覆盖） | 夜间同步已从 main 真实生成骨架页两批：提交 `9567b6c`（10 页，另 4 个留到下一晚）与 `7283d4c`（03:00 定时任务跑出的那 4 页）。全程不调模型。`pnpm wiki:lint` 2026-09-21 通过。**09-21 的两件事**：夜间生成的 15 个骨架页里 5 个是扫描器误报、已删（见 AC1），剩下 10 个当天全部补成正文（`4e47a03`），`wiki/params/` 现在没有写着「待补」的页（2026-09-21 `git grep -l 待补 -- wiki/params` 为空）；参数页现有 19 页（`registry.json`，现查）。**全量覆盖仍未达成**：每晚上限 10、队列按批推进。幂等（重复生成后 `git diff` 为空）本轮未重跑。**09-24 凌晨又真实跑出一批**：上游 main 走到 `39fef3f8`，夜间生成 2 页新骨架、按新 tip 刷新 8 个已有参数页的生成区并标 `prose-needs-review`（`wiki/warnings/params-daa69ce0…-39fef3f8….json`）。**这笔复核当天做完**：2 页骨架已补成正文（`block_table_no_commit_optimize` 是 MRv1 块表脏区提交的回退开关、`enable_pcp_embedding_lmhead_weight_sharding` 默认 true 的 PCP 权重切分，PR #17066 / #17159，逐行对 `39fef3f8` 源码写）；8 页正文对新事实核过，改的都是同一处——「只在 main 开发主线上有」按条件原则改成「在册版本里只有 main 有」（上游新分出的 v0.28/v0.29 rc 也带着这些键，不在册）。**顺带抓到并根治了夜间刷新的一个 bug**：`publish-sync` 现算谱系时只拿同步前后两个提交当「版本」，把 `wiki:lineage` 写好的逐发布分支表整节顶掉（这晚 8 页全中招）——已提炼共享的 `lineageRefs()`（发布分支 + 当前 ref，解析不出才退回提交对），CLI 与夜间同源，先红后绿各有断言；21 个参数页的谱系表已用 `wiki:lineage:apply` 全量重算恢复。 |
| AC5 | 只用固定输出验证 | `ingest --params` 只收模型正文、生成区由脚本覆盖、重刷保留正文，均有固定输出测试。**真实补文未用真实模型复测**。09-14 那批 8 页是 LLM 整页生成（与本 AC 的设计相反，偏差记在下方 AC5 条目）；这批页 2026-09-20 已由人按新写法重写并把 main 来源重钉到 `b255ab59`（`5672131`、`5e001c4`、`aab558c`）。**09-21 补完的那 10 个骨架页同样不是 AC5 的链路**：Opus 子代理直接写正文、主会话对钉住的源码抽查后提交（`4e47a03`），统一成手册规定的参数页五节 + 生成区，不写教学页才有的「常见误解」。所以 AC5 描述的「骨架交给提取 agent、脚本覆盖生成区」这条路至今没在生产跑过。 |
| AC6 | 部分实现（调度已实跑成功，两处未解决） | 上限与分批：`maxNewParamPages` 上限 10（schema 见 `scripts/wiki/sync.ts:30`，取值见 `wiki/sync.config.json`）；超限时只做前 N 个、其余留到下一晚，检查点只记已处理条目、commit 不前进（`scripts/wiki/params/publish-sync.ts:61-71`、`scripts/wiki/sync.ts:129-137`）；上限 0 仍表示「不生成新页」。**2026-09-21 03:00 的定时任务同样实跑成功**：`wiki/_jobs/sync/last-run.json` 为 `status: "succeeded"`、`phase: "worker"`、`deferred: 0`、`findings: 0`（`startedAt` 2026-09-20T19:00:02Z = 北京时间 09-21 03:00），当晚还给 v0.26 建了参数基线。①**解释器一项 09-21 已结**：`7781837` 把路径挪出共享配置——`wiki/sync.config.json` 不再写 `python`，本机路径在 gitignore 的 `wiki/sync.config.local.json` 里（现值指向 Codex 私有缓存里的那份），不写时退回环境变量 `WIKI_PYTHON`、再退回 PATH 上的 `python`。**硬下限是 Python 3.11+ 不是 3.12**（钉住的 main 快照里有 `typing.Literal[*args]` 这种 PEP 646 星号下标，3.10 及以下 `ast.parse` 直接语法错）；`scripts/wiki/params/scan.py` 只 import `ast` / `json` / `re` / `sys`，全是标准库。用户 09-21 定**不建 conda 环境**：开源用户 PATH 上有 3.11+ 就行，不合适再写一行本机覆盖。这台机器借的那份哪天没了，夜间任务会当场报错并在错误信息里写明解释器与可用的覆盖办法（`scripts/wiki/params/scan.ts:17`），不会悄悄坏掉。②仍未解决：「人为改掉一条，跑 sync 报出新增 1 / 删除 1 / 变更 1」这条红绿验收本轮未复跑。 |
| — | **迁移办法（09-21 新定，不属于任何一条 AC）** | 以后再动扫描器，身份键（`json_path`）变了的页照这套迁移：在 `wiki/params/identities.json` 加一条绑定把新身份键指回原页 id（页面 id 与公开链接都不变，该文件 2026-09-21 现有 2 个顶层键 `schemaVersion` / `bindings`）；用 `buildParamPage(..., previous)` 重算该页的生成区；**用新扫描器按各自钉住的提交重算 `wiki/_jobs/parameter-sync/` 下的三份基线**（三份均已在 2026-09-21 17:38 重算），否则夜间任务会把「身份变了」当成「新增参数」，再生成一批骨架页。验证口径：改动前后对每条基线条目跑 `parameterPageId` 对比，这次新增的身份冲突只有 1 条（v0.23 上内部类的 `prefetch_ratio`，已把原有那条 reference 绑定改到新路径）。 |


- **AC1 · 参数扫描器**：`pnpm wiki:scan-params --ref <ref>` 输出该 ref 的全量参数清单到 `wiki/lineage/params-<ref>.json`，每条含 `name`、`type`、`default`、`class`、`json_path`（如 `additional_config["eplb_config"]["dynamic_eplb"]`）、`file`、`line`、`comment`（字段上方注释）、`constraints`（从 validator 的报错字符串提取的取值范围与联动）、`confidence`（`certain` / `suspect`）。三路合一：Python `ast` 拿结构 + 全仓 grep 交叉验证 + 注释里捞自由字典的合法键。验收：单元测试用固定的 Python 源码样本断言四种定义形态都被识别（见 Design Decisions「四种定义形态」）。
- **AC2 · 疑似项由 LLM 复核**：`confidence: suspect` 的条目走一次 agent 调用复核，输出 `确认是参数 / 不是参数 / 拿不准` 三态与理由，写回 `params-<ref>.json`。拿不准的留在清单里并标记，不静默丢弃。验收：故意混入一个非参数标识符，复核后被标为「不是参数」且带理由。
- **AC3 · 版本谱系**：`pnpm wiki:lineage <标识符>` 按所选 ref 计算并保存 `wiki/lineage/<标识符>.json`，`--out` 可指定输出。包含每个 ref 的完整 commit、搜索路径、文本存在性、逐提交核实的引入/移除边界、提交标题里的 PR 号、包含提交的 tag/分支及文本增删行数。普通分支名优先解析受跟踪的 origin tip，显式 SHA 保持 pin；不能把本地旧 checkout 当最新分支。引入/移除比较提交与父提交，不再把最近一次 pickaxe 改动直接当删除。验收：用默认的 `--paths vllm_ascend/` 检查远端全部发布分支与 main，`layer_sharding` 的结果为 v0.13.0 / v0.18.0 / v0.20.2rc / v0.21.0rc / v0.22.1rc / v0.23.0 各 6/7/7/7/7/8 个文件，v0.24.0rc 起及 main 全为 0，并给出 v0.23→v0.24 之间的移除提交 89601215 / PR #11953。（口径 2026-09-21 修订：原文写的是 `--paths '*.py'` 与八个 ref 的 8/9/14/0/0/1/0/0，分母含 `tests/`，而 `tests/` 里出现几次并不说明这个参数被用了多少；改成与 `wiki:lineage` 默认值、与存盘 JSON 一致的产品代码口径。旧口径的数字本轮未重算。）v0.26 的单测文本残留不代表功能回归。Markdown 与 JSON 来自同一计算结果；`lineage:apply` 只刷新生成节，持锁检查原文指纹后更新派生索引，保留人工正文。

- **AC4 · 骨架页零成本覆盖全部参数**：`pnpm wiki:build-param-pages` 由 `params-*.json` + 谱系确定性生成 `wiki/params/<stable-id>.md`，含 frontmatter、定义位置、默认值、约束、版本表，正文标记为「骨架，待补」。不调用任何 LLM。验收：跑一次生成全部参数页，`pnpm wiki:lint` 通过，`git diff` 在重复运行后为空（幂等）。
- **AC5 · LLM 选择性补正文**：`pnpm wiki:ingest --params <name,...>` 把骨架页交给提取 agent 补「是什么 / 为什么存在 / 开了的代价 / 和谁互斥」四节，骨架部分（版本表、定义位置）由脚本重新覆盖，agent 不得改动。验收：补完一页后重跑 `wiki:build-param-pages`，版本表被脚本刷新而正文保留。

  **2026-09-14 部分达成，有一处与设计的偏差要记下**：已跑通 8 个参数页（`wiki/seeds/params-removed.yaml`，即 v0.23.0 官方参数表有 60 个、main 有 86 个，差集里被删掉的那 8 个：`layer_sharding`、`weight_prefetch_config`、`prefetch_ratio`、`fuse_allreduce_rms`、`enable_matmul_allreduce`、`multistream_overlap_gate`、`enable_async_exponential`、`enable_sleep_mode_extra_cleanup`），提取 $21.02 + 整合 $4.14，落在 `wiki/params/`。

  偏差：**本该先做 AC4 铺骨架页、LLM 只补重要的那几页正文，实际是让 LLM 整页生成**。8 个尚可，86 个按同一单价要贵一个量级（2026-09-14 的估价，不是现在的花费；实际花费以 `pnpm wiki:budget status` 为准），而绝大多数参数只需要「名字 / 类型 / 默认值 / 官方一句话」（文档表里全有）加版本谱系（脚本算），根本不必花 LLM。**AC4 是 AC5 放量前的前置**，顺序颠倒了要补回来。

  这批的实际收获：`layer_sharding` 页把用户最早那串问题一次答全（干嘛的 / 哪版移除 / 移除 PR / 哪些分支还有 / 影响面），且谱系那节不可能是编的；agent 还抓到一处**文档与代码不符**并经人工核对属实——官方参数表写 `dict`、默认 `{}`，实际 `ascend_config.py` 是 `get("layer_sharding", None)`、`platform.py` 里 `or []` 当列表用。
- **AC6 · 每日同步与新参数触发**：`pnpm wiki:sync` 拉全部 ref、重跑扫描与谱系、与上次结果 diff；新增参数进 `wiki/_drafts/_param-queue.json` 并自动生成骨架页；消失的参数在页面上标注移除版本与 PR；默认值变化写进 `wiki/log.md`。失败非零退出并在 log 留原因。注册为 Windows 计划任务每日运行。验收：把上次结果人为改掉一条，跑 sync 能报出「新增 1 / 删除 1 / 变更 1」并落到对应文件。

**Out of scope**：vllm 上游仓库的参数（先只做 vllm-ascend，需要时同一套引擎加一个 repo）；参数的运行时实测行为（属于 PLAN 的 M 级证据，本 feature 只做静态事实）；GitHub issue / PR 语料与报错检索（→ F003）；前端展示（复用 F001 AC6 的阅读页，本 feature 只产数据）。

## Dependencies

- **F001 AC9（阻塞）**：多 ref 钉定与完整克隆。参数扫描要跨分支跑，部分克隆会静默漏文件（实测 v0.23.0 漏 2 个）。
- **Python 3.11+**：当前上游已使用旧 3.9 无法解析的 starred subscription（钉住的 main 快照里有两处 `typing.Literal[*args]`，3.10 及以下 `ast.parse` 直接语法错、整轮扫描退出），所以 3.11 是硬下限，不是「固定 3.12」。**2026-09-21 起解释器路径不再写死在共享配置里**（`7781837`）：`wiki/sync.config.json` 不含 `python`，本机路径写在 gitignore 的 `wiki/sync.config.local.json`（`{"python": "<路径>"}`）；没写就退回环境变量 `WIKI_PYTHON`，再退回 PATH 上的 `python`。独立命令与测试同样可用 `WIKI_PYTHON` 指定。扫描器只用 `ast` 解析源码文本，不执行、不 import，`scan.py` 只 import `ast` / `json` / `re` / `sys` 这四个标准库，因此不需要安装 vllm 或 pydantic，也**不需要专门建 conda 环境**（用户 2026-09-21 定）；解析失败明确报错并写明当前解释器与两种覆盖办法（`scripts/wiki/params/scan.ts:17`），不跳文件或降级正则。具体配置见 HANDBOOK。
- **共用 agent 执行器**：已抽出 `scripts/wiki/batch.ts`，与受限调用、持久任务和共享预算配合；AC2 / AC5 / F004 复用同一底座。早期 plan 的执行器拆分已不构成阻塞。预算上限与实际花费一律以预算账本为准（`pnpm wiki:budget status`），不在本页抄数字。
- 不依赖 GitHub token（PR 号从本地 git 提交信息里取，不查 API）。
- **官方文档站**（<https://docs.vllm.ai/projects/ascend/>）：版本清单查 ReadTheDocs API；参数页里的版本号、安装命令等含占位符的内容取渲染后的值。这是唯一需要联网的部分，失败时降级为「只出代码侧谱系」并在 warnings 里注明，不阻塞。

## Design Decisions

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| 扫描方式 | 正则 / Python AST / AST + grep + 注释三路 | **三路合一，并输出 `confidence`** | 2026-09-10 用正则试跑当场翻车：101 个字段里错判 5 个（`budget_threshold` 等被判「文档有代码无」，实为 `DynamicSpecConfig.method_params` 这个自由字典的合法键，只在注释里写明），嵌套 Config 类也有漏。单一手段覆盖不了下面四种形态 |
| 四种定义形态 | — | 扫描器必须同时处理 | ① pydantic dataclass 字段 `dynamic_eplb: bool = False`；② 嵌套 config 类（`eplb_config` 里再套一层，AST 要递归）；③ 自由字典的合法键，只在字段注释里列出（`method_params` 的 `initial_verify_budget_per_req` 等三个，AST 扫不到）；④ 别处按字符串取值（`spec_decode/utils.py:277` 的 `min_verify_tokens`，要全仓 grep 才发现）|
| 疑似项处理 | 人工复核 / LLM 复核 | **LLM 复核**（用户 2026-09-10 拍板） | 疑似项是长尾，量不小；人审会成为放量的瓶颈。三态输出保留「拿不准」，不强行二选一 |
| 参数页生产 | 全部 LLM 写 / 骨架确定性 + LLM 选择性补 | **骨架确定性生成，LLM 只补正文** | 2026-09-07 试点的每页单价意味着 100+ 参数全用 LLM 写要贵一个量级（当时的估价，实际花费以 `pnpm wiki:budget status` 为准），且版本表这类事实 LLM 写了还会过期。骨架零成本、不会错、每次 sync 自动刷新 |
| 谱系存放位置 | 写进页面 frontmatter / 独立 `lineage/` 文件 | **独立文件，页面渲染时合并** | 页面正文由 LLM 维护、谱系由脚本每日重算；混在一个文件里两边会互相覆盖（F001 试点已经吃过 build 与 biome 互相重排的亏）|
| PR 号来源 | GitHub API / squash 提交信息 | **提交信息尾部 `(#NNNN)`** | 上游用 squash merge，PR 号就在提交标题里；不用 token、不受 API 限额影响。API 只在 F003 用 |
| 「移除版本」的表述 | 单一版本号 / 按 ref 列表 | **按 ref 列表** | 分支分布非单调（v0.24 没了、v0.26.0rc 又有），单一版本号会说谎 |
| 版本清单以谁为准 | 本地 git 分支 / 官网版本列表 | **两者都要，且要对账** | 官网有 26 个活跃版本（RTD API 实测），本地 git 有自己的分支与 tag。两边不一定重合——官网可能下线了某个旧版本，git 里却还有；反之亦然。对不上的地方要列出来，那说明「代码还在但文档已不再维护」，是学习者会踩的坑 |
| 文档里的版本号怎么取 | 读本地 md / 读官网渲染页 | **占位符必须取官网渲染值** | 文档站用 MkDocs macros，`mkdocs.yml` 的 `extra:` 定义版本变量，md 源文件里是 `{{ vllm_ascend_version }}`（全仓 226 处占位符，其中它占 167 处）。参数页要写「哪个版本引入」时若照抄本地文件，写出来的是占位符字符串而不是版本号 |
| 文档里怎么找参数 | 全词精确匹配 / 宽松匹配 | **宽松匹配**：下划线、空格、连字符、大小写互通，且允许写不全 | 2026-09-11 实测翻车：用精确匹配数「哪些参数没文档」，`layer_sharding` 只命中 1 个文件，宽松匹配是 2 个——漏掉的正是 `release_notes.md`。文档里写的是 `Layer sharding.`，`mix_placement` 写的是 `Mix placement`。精确匹配会系统性低估文档覆盖率 |
| `release_notes.md` 的地位 | 普通文档 / 谱系的一等来源 | **一等来源，与 git 历史并列** | 2267 行、**1137 个 PR 链接**、39 个版本小节，是官方维护、按版本组织、带 PR 号的变更史。git 历史给「哪个提交改的」，它给「官方怎么描述这次改动、算在哪个版本」，两者互补且可互相校验 |
| 谱系覆盖几条线 | 只看代码 / 代码 + 文档两条线 | **两条线，且允许不一致** | 官方文档站有 26 个活跃版本（RTD API 实测），文档的版本线与代码的版本线是分开的。实测已见不一致：8 个参数代码里有、152 个文档文件里一次都没出现；`layer_sharding` 代码删了但教程里还留着一句。把「代码里何时消失」与「文档里何时消失」分开记，不一致本身就是有价值的信息 |
| 覆盖率怎么算 | 已入账数 / 已入账数 / 用独立分母 | **分母用独立来源**：官方文档参数集 ∪ AST 扫出集 ∪ grep 候选集，分子是三路都确认的；差集必须显式列出 | 借 Multi-Agent `viewfinder/coverage-check.ts` 的教训：分母若取「已入账行数」就是自圆其说，扫到几个算几个、永远 100%。三集合里 `unresolved`（扫到但没确认）必须冒泡成 warning，不能吞掉 |
| 参数页与 orphan 规则 | 纳入孤页检查 / 豁免 | **豁免**（`lint.ts:85` 的 orphan 只查 `concept` 与 `feature`，`param` 天然不在内） | 参数是按名字精确查的，没有入链是正常状态；把 100+ 参数页塞进「必须有人链接」会逼出无意义的交叉引用。豁免是既有实现的自然结果，此处显式确认而非默认 |
| 扫描粒度 | 每次全量 / 增量 | **每次全量，结果做 diff** | 全量扫一个 ref 是秒级；增量的复杂度换不来收益，全量还能顺带发现改名 |

**Design Gate**：数据管线级（新目录 `wiki/params/`、`wiki/lineage/`，新增 Python 依赖）。待用户批准实施计划。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-10 | 用户提出参数类需求；实测确认 F001 单 commit 模型答不了；确认官方文档不完整（8 个参数全树无记载）；确认正则扫描不可靠（错判 5 个）；用户拍板疑似项由 LLM 复核。立此 feature |

## Links

- Plan: [param-lineage-plan.md](../plans/param-lineage-plan.md)
- 依赖: [F001](F001-llm-wiki.md) AC9 多 ref 钉定
- 姊妹: [F003](F003-github-corpus.md) GitHub 语料与报错检索

## Evolution

- **Evolved from**: [F001](F001-llm-wiki.md)（F001 只覆盖「参数是什么」，本 feature 补「有哪些、哪个版本有」）
- **Blocks**: 无
- **Related**: PLAN 第 21 章「PR 影响分析」
