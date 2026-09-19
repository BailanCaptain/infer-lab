> LLM WIKI 的新会话先读 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)，页数、预算等状态在那里给了现查命令，这里不再抄数字。以下保留的是首页 / 城市背景等其他工作的历史项目背景，其中的 Wiki 数字已过期。

# 交接说明（2026-09-14 更新：知识库 19 页，双版本对照 + 参数版本谱系落地）

## 当前开篇：大模型推理之旅 · 城市背景

用户随后提供新的服务器城市参考图，要求换风格，并强调性能。首页已切换为 `src/app/intro/cityScene.ts` + `src/design/city.css`：GPU / NPU 地标、服务器楼群、互联高架、海湾与观景台。源文件是 `assets/city/compute-city.blend`，网页只加载 `public/models/compute-city.glb`；配置真相源是 `src/app/intro/city.json`。建模与性能约定见 `assets/city/README.md`。用户最新要求恢复上一版「云隐 / 大模型推理之旅」标题和左侧十章目录（复用 `world.json`），保留城市背景；已移除悬浮地标、点击拾取、镜头拉近和硬件详情面板。目录仅静态展示，手动旋转/缩放与环游保留。最新性能修复：移除手动拖动的 30 FPS 节流，自动环游独立限帧；绘图缓冲最多 250 万像素；默认镜头距离增加 25%，JSON 与 Blender 源相机已同步。教学表现层仍待定。

## 上一版：开篇山境（本地草稿，未纳入当前版本）

用户最初提供云海悬山参考图，授权 Blender + Three.js 开篇。该版源文件、模型及生成脚本仅在原工作区保留，未纳入当前城市版本；全新检出无需这些草稿。当前首页复用已提交的 `src/app/intro/world.json` 中的十章目录。

新会话读这一页了解**现在在哪**，读 `PLAN.md` 了解**要去哪**（总体大纲：22 章、工作台、架构、M1 任务表、里程碑），再读 `CLAUDE.md`、`DESIGN.md`、`PITFALLS.md`。

## 现状（一句话）

**主干只剩地基，没有任何教学画面；另有一条 `feat/llm-wiki` 分支在做知识库，19 页可读、问答会沿关系图串多页作答、参数页带 git 算出的版本谱系（见下方 F001 / F002 一节）。** 2026-09-06 用户把我做的全部 3D 画面（`src/viz3d/`、`#/lab`、`#/model`、Spike A/B 页、3D 字体子集、three.js 依赖）整体删除（提交见 `git log`，可找回但不要找回）。原因：三版画面都被否："幻灯片"、"怎么能这么丑"、"平片图/一坨屎"。地基（`src/sim/`、`src/timeline/`、页面配色字体、播放条）完整保留，全部测试通过。

## 知识库 F001–F004（分支 `feat/llm-wiki`，未合入 main）

真相源：`docs/features/F001-llm-wiki.md`（12 条 AC）、`docs/features/F002-param-lineage.md`（6 条 AC）、实施计划 `docs/plans/llm-wiki-plan.md` 与 `docs/plans/param-lineage-plan.md`、试点人审报告 `docs/plans/llm-wiki-pilot-review.md`、**问题台账 `docs/plans/llm-wiki-open-questions.md`**（用户 09-10 起提的问题及处置，含几处我判断错后的更正）。

**目标**：agent 写、人只审、进 git 的课程知识库，学习者在 `#/wiki` 问名词就有基于知识库的回答。

**Feature 进度只看各 feature 的当前验收节**：[F001](docs/features/F001-llm-wiki.md#2026-09-16-当前验收核对)、[F002](docs/features/F002-param-lineage.md#2026-09-16-当前验收核对)、[F003](docs/features/F003-github-corpus.md)、[F004](docs/features/F004-knowledge-loop.md)。旧的 F001“10/12”、F002“2/6”混用了部分实现与完整验收，已撤回；[本轮核对记录](docs/plans/feature-progress-review.md) 留命令证据，这里不再复制完成数。

**2026-09-16 独立复查后**：[当前修复与人工交接](docs/plans/wiki-independent-closure-review.md)。已修复草稿不自动整合、旧参数 ID 脱节、复测方案后置和中文缺口漏记；8 个旧参数页接入静态生成区。真实效果尚未通过：停在内容提案人审与未知费用核对，收费仍暂停。F001–F004 均未完整验收。旧“非批量全部接通”结论已撤回。

**产出**：`wiki/concepts/` 11 页（11 章 KV Cache）+ `wiki/params/` 8 页（v0.23.0 有、main 已删的参数），共 19 页。

**每页现在长这样**（与最初的四节版已完全不同）：

- 概念页六节：一句话 / 为什么需要它 / 怎么工作（必须有 mermaid 图）/ 拿真实数字走一遍 / 事实表 / 常见误解。「接着看」不手写，由 `relations` 生成。
- **一页覆盖两个版本**：`releases/v0.23.0` 与 `main` 同时读，行为不同的必须写清哪版是哪样并标 `[!]`（现有 44 处）。
- **事实表四列**：`项 / v0.23.0 / main / 意味着什么`，≤10 行，不放来源列。两版一致的行写「同」，无差异的页退化成三列。
- **边有类型有方向**：`relations: [{to, kind, note}]`，kind 取 `builds-on` / `variant-of` / `conflicts-with` / `alternative-to`；一条边只写在依赖方那侧，反向边由 `wiki:build` 派生成 `backlinks`。现有 31 条。
- **内联证据标记带来源编号**：`[C6]` 指向 `sources` 第 6 条，点开跳 GitHub 钉住的行号。每页 ≤20 处（初版 400 处、66% 是 `[C]`，等于没有信息）。
- 参数页四节 + 一节 **`## 版本谱系`，由脚本从 git 算、整节覆盖**，agent 写什么都会被冲掉——它会编 PR 号。

**已经能用的命令**

| 命令 | 作用 |
|---|---|
| `pnpm wiki:clone --seeds <yaml>` | **完整克隆**源码仓库到 `tools/repos/`，抓全部分支与 tag，按 seeds 声明的每个 ref 建一份工作树 |
| `pnpm wiki:ingest --seeds <yaml> --phase extract` / `--phase integrate --only <ids>` | 提取草稿 / 隔离整合后生成待审包；integrate 不再直接发布 |
| `pnpm wiki:review list` / `show <revision>` / `approve <revision>` / `reject <revision> --reason <原因>` / `recover <revision>` | 审阅及发布恢复；行为与限制见 [HANDBOOK 人类须知](wiki/HANDBOOK.md#人类须知)，证据见 [发布验收](docs/plans/wiki-review-publication.md) |
| `pnpm wiki:build` | 由 frontmatter 派生 `wiki/index.md`、`registry.json`，并算出反向边 `backlinks` |
| `pnpm wiki:lint` | 静态规则，已进 `pnpm check` |
| `pnpm wiki:audit --seeds <yaml>` | 把每条来源行号拿到钉住的仓库里核对是否真实存在 |
| `pnpm wiki:gaps` | **漏洞**：跨页反复引用但没有页的概念 + 指向不存在页的断边 |
| `pnpm wiki:stale` | **过期**：哪几页引用的上游代码已经变了，直接给出 `--only` 重跑命令 |
| `pnpm wiki:lineage <名字>` | 一个标识符在各分支的存亡 + 引入/移除 PR + 影响面，输出即「版本谱系」一节 |
| `pnpm wiki:lineage:apply` | 持锁核对原文后刷新生成节；不会覆盖并发改动 |
| `pnpm dev` / `pnpm dev:server` / `pnpm dev:all` | 前端（`#/wiki`）/ 问答服务（8790）/ 两者一起 |

**`wiki/HANDBOOK.md` 是这套系统唯一的规则文件**，按六个二级标题切片分别注入不同角色的 agent。映射表在 `scripts/wiki/handbook.ts:9`。**人读规则在 HANDBOOK，机器契约在共用 schema；改规则后须同步必要代码并通过一致性测试。** 代价是：**规则改了页面不会自己变，要重跑才生效**。

**踩过的坑，别再踩**

- `--allowedTools` 在 `-p` 无人值守模式下是**白名单**不是免确认表。放开联网要两步：从黑名单拿掉、往白名单加上，只做前者等于没做。
- 越界守卫只删**本批新建**的文件。它曾把 `wiki/HANDBOOK.md`（规则唯一真相源）当越界写入删掉，并让 11 个正常 agent 全判失败——那次改动来自引擎外部，agent 根本没有写它的权限。
- **`TaskStop` 只杀外层 shell，`claude.exe` 子进程会活下来继续写文件**。要停 ingest 用 `taskkill /pid <pnpm 的 pid> /t /f`。
- 定性规则（「只留三类」「删到合理密度」）实测不落地，**换成硬指标并由引擎算好数字写进任务**才有效——标记数与事实表行数都是这么治住的。
- 整合 agent 没有 `--add-dir` 也不能联网，它只读草稿与现有页。所以它能发现**页与页之间的矛盾**，发现不了**页与源码之间的偏差**（实测漏掉一处过度概括）。要抓后者得扩 `wiki:audit` 或加一个能读源码的核对角色。
- 正文不走 `rehype-raw`：裸 HTML 标签与 `<!-- 注释 -->` 都会原样显示在页面上。`stray-tag` 规则管这个。
- 别用 python heredoc 写含 `\n` 的 TS——反斜杠会被吃掉，正则和字符串都会断。用 Edit 工具。

**成本实测**（试点至今共约 $165）：

| 批次 | 提取 | 整合 |
|---|---|---|
| 初版 11 页 | $36.77 | $7.48 |
| 按图重写 11 页 | $36.43 | $7.11 |
| 双版本重写 11 页 | $45.45 | $6.98 |
| 参数页 8 页 | $21.02 | $4.14 |

概念页约每页 $4，参数页约每页 $3。**AC5 灌 120–160 页约 $660。**

**下一步的判断**：先补 **F002 的 AC1 + AC4**（参数扫描器 + 骨架页生成器）。官方参数表 main 有 86 个参数，8 个花了 $25，86 个按同一单价约 $240；而绝大多数参数只需要「名字 / 类型 / 默认值 / 官方一句话」（文档表里全有）加版本谱系（脚本算），骨架页方案接近 $0。**AC4 是 AC5 放量前的前置，这次顺序颠倒了要补回来。**

**接手注意**

- `tools/repos/` 已 gitignore，全新检出要先跑 `pnpm wiki:clone`。**完整克隆约 96 MB**，每个非 main 的 ref 另占一份工作树。
- `src/content/wiki/registry.json`、`wiki/index.md`、`wiki/log.md` 都是生成物，不要手改。
- 页面目录清单有两处要同步：`scripts/wiki/pages.ts` 的 `PAGE_DIRS` 与 `src/content/wiki/index.ts` 的 `import.meta.glob`。漏一处就是 registry 有页而前端读不到（加 `params/` 时漏过一次，被一致性测试抓住）。
- ingest 用 `Edit(路径)` 做按路径写入限制（`Write(路径)` 不被 CLI 识别，黑名单放 `Edit` 会连 Write 一起禁掉），另有批级快照差集兜底。
- **检索只能走 `src/content/wiki/retrieve.ts`**，聊天层不许自己 grep（AC10）。
- 官方文档站 <https://docs.vllm.ai/projects/ascend/> 有 26 个活跃版本，内容由仓库 `docs/source/` 渲染。
- **知识库当前钉在 `28bf3a2e`（2026-08-29），而 `origin/main` 已超前 276 个提交**，19 页引用的文件里绝大多数已变过。`pnpm wiki:stale` 会告诉你该重跑哪几页。

## F002–F004 的设计与历史发现

用户 09-10 至 09-11 提出三类 F001 结构上答不了的需求，各立一个 feature。四份 feature 文档已互相引用、依赖标清、冲突已解（做过一轮交叉审查）。

| Feature | 做什么 | 状态 |
|---|---|---|
| **[F002](docs/features/F002-param-lineage.md)** · 参数清单与版本谱系 | 「`layer_sharding` 干嘛的、哪个版本移除、哪些分支还有」。参数扫描器 + 跨 ref 谱系 + 每日触发。**全是确定性脚本，不花 LLM 额度**，LLM 只复核疑似项和补正文 | feature + [plan](docs/plans/param-lineage-plan.md)（333 行，15 条锚点核验）已写 |
| **[F003](docs/features/F003-github-corpus.md)** · GitHub 语料与报错溯源 | 报错检索与修复链；全部社区内容作为检索语料，选择性生成 PR 草稿 | [plan](docs/plans/github-corpus-plan.md) 已写并已实施；当前验收见 feature，不再复制状态 |
| **[F004](docs/features/F004-knowledge-loop.md)** · 知识库闭环 | 投喂、补写、巡检、差异与交叉审视，人审后沉淀 | [plan](docs/plans/knowledge-loop-plan.md) 已写并已实施；真实效果边界见 feature |

**历史设计依据（当时的完成标记不替代上方当前验收表）**

1. **单 commit 钉定不成立**。`layer_sharding` 在分支间非单调：v0.13.0 有 8 个文件、v0.18.0 有 9 个、v0.23.0 有 **14** 个、v0.24.0rc 起主线为 0、v0.26.0rc 又有 1 处（那 1 处是单测里的残留赋值 `self.impl.layer_sharding_kwargs = []`，不是功能回归）。「哪个版本移除」只能按 ref 列表答。**已修，AC9 完成。**

2. **部分克隆会静默漏文件且不稳定**。同一条 `git grep`：v0.18.0 部分克隆数出 1、完整克隆是 9；v0.23.0 部分克隆先后给出 11 和 13、完整是 14。同一命令在不同时刻给出两个不同的错误答案，比单纯漏更危险。**已修，改完整克隆。**

3. **谱系全靠本地 git 就能算，不用 GitHub API**。`layer_sharding` 由 PR **#11953**（提交 `89601215`，2026-07-15）移除；`git branch -r --contains` 与 `git tag --contains` 直接给出哪些 ref 已经没有它。近 200 条上游提交的 `(#NNNN)` 覆盖率 200/200。

4. **查文档不能用全词精确匹配**。文档里写 `Layer sharding.` 而不是 `layer_sharding`，精确匹配会漏掉整份 `release_notes.md`（2267 行、**1137 个 PR 链接**、39 个版本小节——这是谱系的一等来源）。`retrieve()` 已改成宽松匹配（压平分隔符 + 公共前缀），学习者问「layer share 是什么」也能命中。

5. **共用执行器已经落在 `scripts/wiki/batch.ts`**，生产入口复用受限调用、持久任务和共享预算；旧 `runExtractPhase` 仅兼容，不作为新的实现基座。不能再按“十行机械重构”描述完整闭环的工作量。

## 地基有什么（全部有测试，不要动）

| 位置 | 作用 |
|---|---|
| `src/sim/modelspec/` | 解析 HF `config.json` → `ModelSpec`（全站唯一形状来源）；内置 Qwen3-0.6B / 8B / 30B-A3B；参数量与 KV 字节分析 |
| `src/sim/model/forwardLayer.ts` | 真实维度的一层前向 21 步（每步中文 brief/detail/公式、lineage、高亮、证据）；权重按哈希惰性生成 `[A01]` |
| `src/sim/hardware/` | 昇腾 910B 概念剖面：13 种算子的驻留/搬运规则，`buildHardwareTimeline` 把硬件层填进每一步 |
| `src/sim/model/presets.ts` | 三句预设句的真实 Qwen3 tokenizer id（生成物，`pnpm gen:presets`） |
| `src/sim/model/traces/` | 真实 Qwen3-0.6B（ONNX q8）贪心生成 12 token 的 top-10 概率 trace `[M]`（`pnpm gen:trace`） |
| `src/timeline/` | 播放引擎：zustand 离散状态 + 瞬态 `progress.t`、Worker 构建时间线、快捷键、URL 深链接、reduced-motion |
| `src/app/PlaybackBar.tsx` | 播放条（DOM，播放期零 commit） |
| `src/app/pages/dev/SpikeCPage.tsx` | 播放引擎验收页 `#/dev/spike-c`（纯 DOM 进度条），Playwright `tests/spike-c.spec.ts` |
| `src/design/tokens.css`、`DESIGN.md` | 暖白纸面 + 深色课程轨道的页面配色、字阶、圆角；无 3D 条目 |

## 已确认决策（不要再问）

- 教学章一律真实模型尺寸（默认 Qwen3-0.6B），`ModelSpec` 唯一形状来源；权重不下载，哈希生成。
- 页面风格：暖白纸面、深色 248px 课程轨道、很重的显示体标题、橙色唯一行动色（沿用旧 infra-view 的观感，不复用其代码）。
- 用户要的体验：Transformer Explainer 的横向流水线总览 + AnimatedLLM 的逐 token 生成与概率分布 + bbycroft 式"一个模型是一个物体、镜头在里面飞"。文字极少，靠悬停。
- **画面怎么做还没有定，而且不许再由 AI 自作主张地"先做一版看看"**：用户对三版画面的否定都指向同一点，就是我画的是示意图，不是物体。下一次动画面之前，先和用户一起用参照物截图逐条定"画面纪律"，拿到明确的 yes 再写代码；先出静帧，批准前不写动效。
- 其余历史决策（技术栈、事实基线、硬件、工作台范围）见 `PLAN.md`（已从 `~/.claude/plans/` 移入仓库并按现状更新）。

## 下一步

阻塞在 `PLAN.md` 的 **Spike S1：定表现层的画面纪律**。和用户一起对着参照物截图定规则，写进 `DESIGN.md` 并经用户确认，才能写画面代码。

不依赖画面选型、可以先做的（是否先做由用户定）：内容管线与 `03` 章正文（PLAN 任务 10、12）、模型工作台页面（任务 13，数字引擎已就绪）。

知识库 F001 走的是独立分支，不受 Spike S1 阻塞；术语注册表（PLAN 任务 10 需要的 `<Term id>` 数据源）已由它的 `src/content/wiki/registry.json` 提供，不必另建 terms 表。

**暂时没有消费者但保留的代码**（表现层或工作台页面重建后会用到，都有测试，不要当死代码删）：
- `src/sim/timeline/plane.ts` 的 `planeView`：张量到二维视图的轴选择规则。
- `Step.camera`、`Step.beats`：步的镜头与子节拍字段。
- `src/sim/modelspec/analyze.ts` 的 `analyzeParams` / `weightBytes` / `fmtBytes`：工作台数字引擎，等 PLAN 任务 13 的页面。
- `src/sim/model/traces.ts` 的 `GENERATION_TRACES` / `getTrace`：真实生成 trace，等 token 生成条。
- `src/timeline/index.ts` 导出的播放引擎 API：目前只有 `#/dev/spike-c` 一个消费者。

## 工作区约定

- **不是 AI 写的文件一律不动**（用户 2026-09-06 明确要求）。仓库里属于用户的东西：`GLM5_Next_3D_Source.zip`（GLM-5-Next 3D 可视化源码包，含 HTML/OBJ/JSON/shader）、`parallelism-teaching-dark-png.zip` 与 `reference/parallelism-teaching-dark/`（并行策略教学图包）。只报告，不处置。
- 可再生、可随时清的：`dist/`、`test-results/`、`tsconfig.*.tsbuildinfo`（已 gitignore）。
- 重下代价大、不要随手清：`tools/hf-cache/`（598 MB，gen:trace 的模型缓存）、`tools/tokenizer/`（11 MB，gen:presets 的词表）。两者都已 gitignore。
- `tools/repos/`（wiki 的来源仓库浅克隆，已 gitignore）：删了可以用 `pnpm wiki:clone` 重建，但要重新下载；里面是只读的上游代码，任何情况下不要在其中改动或提交。
- 空目录 `src/viz2d/`、`src/content/` 是分层占位，`scripts/check-deps.ts` 的层序引用它们，别删。

## 验证基线

- main（2026-09-06 深夜，删除 3D 之后）：`pnpm check` 126/126（12 个测试文件）；`pnpm build` 通过；`pnpm test:e2e` 3/3（只剩 spike-c）。
- `feat/llm-wiki`（2026-09-07）：`pnpm check` 168/168（20 个测试文件）；`pnpm build` 通过；`pnpm wiki:lint` 与 `pnpm wiki:audit` 通过；`pnpm wiki:build` 幂等。
