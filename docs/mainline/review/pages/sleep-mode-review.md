# Sleep Mode 写作记录

## P5 写作记录（GPT-6 Astra，10-04）

本轮新写 [sleep-mode 草稿](../../../../wiki/_drafts/sleep-mode.md)，按用户指定走待审流程。没有旧页面需要迁移。已读共同要求、docs/wiki-writing-standard.md、wiki/AGENTS-GUIDE.md，以及 tensor-parallel、expert-parallel 前 150 行。任务是教学文档，没有启用 Ponytail 或代码协作表达技能。

### 结果与分工

- 新页讲 Sleep Mode 的含义、level 0/1/2 边界、权重与缓存去向、请求处理、分标签恢复、GLM 双机条件及版本差异。
- [enable-sleep-mode-extra-cleanup](../../../../wiki/params/enable-sleep-mode-extra-cleanup.md) 继续独占池外 HCCL/ACL 图的额外清理、配置迁移、清理开销与已知问题。新页只给结论和链接。
- 互链通过新页 relations 和构建器派生 backlinks 完成；没有改参数页。实际调用 `deriveBacklinks` 后，参数页得到 `from: sleep-mode, kind: enables`，与 `scripts/wiki/build.ts:64` 的现有约定一致。批准并重建后在站内生效。
- `origin: direct` 如实标注手写来源；未生成 raw 摘录或补造 rawSources。写作期间工作区同步更新了这一入口约定，已读 schema 与 HANDBOOK 后对齐。
- 没有修改 src/、scripts/wiki/standard-pages.json、docs/plans/，没有提交 git。工作区其他写手同步产生的文件不属于本轮改动。

### 结构和教学取舍

正文顺序为问题式定义与直觉图 → 同卡训练动机及真实示例阈值 → 级别与恢复机制 → GLM 双机 token 路径及未开事实 → 常见误解 → 对照源码。源码区五个 H3 完整、顺序固定。

机制发生在批次之间的引擎状态切换，不是逐层计算；因此不编造每层通信次数或每 token 显存收益。使用官方 Qwen2.5-0.5B 示例的 1 GiB **验收阈值**解释测量口径，算式仅换算单位，未把阈值写成实测结果。GLM 卡数、分组和 KV 预算回链原单一出处，不重算。

两图均手写 YAML，经仓库生成器产生 SVG；分别为 sleep-mode-intuition（860×610）和 sleep-mode-flow（860×850）。流程图包含主线位置、level 0 返回、level 1/2 分支及恢复顺序，不复画额外清理内部步骤。图为静态，无动画。

### 官方资料与源码核对

以下路径相对表内仓库根；全部通过 git show 读取固定提交。页面 frontmatter 有 30 条来源，准确范围见草稿 sources。

| 仓库与提交 | 文件及行号 | 核对结论 |
| --- | --- | --- |
| vllm-ascend db701c1f / 2c59ff10 | docs/source/user_guide/feature_guide/sleep_mode.md:3–26、60–81、100–137、140–184 | 定义、两级内容去向、构建前提、分阶段恢复、专家布局、示例阈值、旧 JSON 示例 |
| vllm-ascend 2ed6cbba | docs/source/user_guide/feature_guide/sleep_mode.md:126–172 | 查询参数写法及 level 2 重载步骤 |
| vllm-ascend baa023ad | docs/source/user_guide/feature_guide/sleep_mode.md:92–180 | main 的 NZ 配置、查询参数和恢复次序 |
| vllm-ascend 0576b647 | docs/source/tutorials/models/GLM5.3-Flash.md:237–341 | 双机启动未加 sleep，256、305 行显式开 expandable_segments |
| vllm 0fc695fc / 568afb3a / 84030bbe | vllm/config/model.py:297–298 / 306–307 / 342–343 | 三版 enable_sleep_mode 默认 False |
| vllm 0fc695fc | vllm/entrypoints/serve/dev/sleep/api_router.py:21–48 | level/mode/tags 读取查询参数，JSON 不参与 |
| vllm 0fc695fc | vllm/entrypoints/openai/api_server.py:195–200；vllm/entrypoints/llm.py:807–845 | 开发端点守卫；Python API 的级别、标签和调用方职责 |
| vllm 0fc695fc | vllm/v1/engine/core.py:688–783、1621–1668 | 先暂停后释放；level 0；进程内拒绝 wait、在线引擎支持 wait；每次 wake 后恢复调度 |
| vllm 0fc695fc | vllm/v1/executor/abstract.py:318–356 | 广播调用、sleeping_tags 记录、无效标签 warning 后返回 |
| vllm 0fc695fc | vllm/v1/engine/core.py:1771–1787、1805–1828 | DP 暂停共识与恢复同步；不能把单机当完整模型独立休眠 |
| vllm-ascend db701c1f / 2c59ff10 | vllm_ascend/worker/worker.py:216–280 | 备份 buffers、level 1 换出 weights、非量化专家转置、NZ 错误和显存日志 |
| vllm-ascend db701c1f | vllm_ascend/device_allocator/camem.py:135–249 | 不兼容可扩展段、锁页 CPU 备份、持久标签保留、重新映射与拷回 |
| vllm-ascend db701c1f | vllm_ascend/worker/worker.py:668–679、894–905；vllm_ascend/ascend_config.py:249–254 | 入池时机、单实例断言、NZ 配置读取 |
| vllm-ascend 2c59ff10 / 2ed6cbba | vllm_ascend/worker/worker.py:907–918 / 1001–1012 | 两版缓存初始化的池作用域 |
| vllm-ascend 2ed6cbba | vllm_ascend/worker/worker.py:222–270 | 无旧专家转置分支，恢复缓存时调用 post_kv_cache_wake_up |
| vllm-ascend baa023ad | vllm_ascend/worker/worker.py:241–294、1122–1138 | buffers 处理、RL 清理守卫、只包缓存本体的池范围 |
| vllm-ascend baa023ad | vllm_ascend/device_allocator/camem.py:197–222 | 释放映射前新增 synchronize；注释未确认根因 |

额外比较了分配器 blob：2c59ff10、db701c1f、2ed6cbba 的 camem.py 同为 `cbc644025c92a9d344f18bcb831ca6af2ed49c5e`；main 新增同步。维护分支与 GLM orphan 的 sleep_mode.md 同为 `7023aaa7601407f128c9dde73ffa1e9bcf10ace9`，Worker sleep/wake 区间相同。

联网打开了[当前官方 Sleep Mode 页面](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/sleep_mode.html)，确认官方页面可访问。钉点 raw GitHub URL 经 web 工具返回 cache miss，故各钉点内容和行号以本地 git 对象为证，没有声称所有外链已联网验证。

### 信息清单：别页已有句子怎样处理

执行 `rg -n 'sleep|睡眠|休眠' wiki/concepts wiki/params`，输出保存在 tmp/sleep-mode-mentions.txt。下面逐组列出有教学含义的命中；frontmatter 标识、sources、参数身份记录、自动谱系仅为索引，不需要迁移。本轮均未改别页，建议供主会话在本页批准后处理。

| 页面与行号 | 已有信息 | 是否建议改成链接 |
| --- | --- | --- |
| ascend-patch-system.md:205 | 睡眠分配器只在功能启用时走到 | 保留一句，睡眠词链接本页 |
| ascend-patch-system.md:277 | main 移除了某个睡眠分配器 patch | 保留 patch 谱系事实；加本页链接以免被理解为删除特性 |
| npu-worker-lifecycle.md:170、182、184 | 权重与 KV 启动入池、单实例限制 | 启动职责仍留原页；睡眠后的内容去向链接本页 |
| npu-worker-lifecycle.md:186、211 | GLM 未开及默认部署选择 | 保留结论，链接本页 GLM 小节 |
| npu-worker-lifecycle.md:196 | 单实例断言 | 启动排错表保留，完整睡眠排错链接本页 |
| npu-worker-lifecycle.md:224；kv-cache-spec.md:319 | main 缩小缓存池作用域 | 保留各自初始化/缓存范围结论；状态切换解释链接本页 |
| enable-sleep-mode-extra-cleanup.md:85、91、103、114 | 睡眠定义、GLM 未开、level 0 门槛、level 1/2 内容去向 | 建议精简为一句加本页链接，特性本身由本页承接 |
| enable-sleep-mode-extra-cleanup.md:116 | 池边界与可扩展段断言 | 保留池内/池外差别以解释清理动机；启动断言细节可链接本页 |
| enable-sleep-mode-extra-cleanup.md:87、89、99、104、107、129、137–160 | 清理实现、RL 配置、默认值、迁移、日志与已知问题 | 留在参数页；本页回链，不搬运其实现 |
| enable-sleep-mode-extra-cleanup.md:141 | level 2 分标签恢复与图捕获时点 | 保留图捕获时点；基本恢复协议链接本页 |
| vllm-ascend-for-rl.md:69、76 | 同卡训练模式、两级睡眠及恢复顺序 | 本轮其他写手新增页；建议保留模式结论、把完整级别说明改成本页链接 |
| vllm-ascend-for-rl.md:78、113、124、126 | 异卡通常不用 sleep、GLM 未配置、pause/sleep 区分、level 2 要重载 | 保留 RL 场景决策与误解短句，补本页链接 |
| vllm-ascend-for-rl.md:142、144、198、211、216 | RL 配置、传输与睡眠组合、清理开关及官方来源 | 配置/传输仍归 RL 页，基本睡眠协议链接本页，清理链接参数页 |

不复制参数页已展开的清理实现；本页新增的持久分配、buffers、分标签恢复与调度状态区分均有源码证据。此前“level 2 清空全部内存”的粗略理解在本页收紧为可睡眠池的内容语义，明确 CPU buffers、持久分配和池外资源的边界。

### 验证证据与密度

草稿保存后运行 wiki:lint。由于它不强制检查 _drafts，另将草稿暂时复制为 concepts/sleep-mode.md，完成以下验证后逐字比对 SHA256，再删除临时副本；stage 运行时正式路径不存在。

| 实际命令 | 结果 |
| --- | --- |
| `pnpm.cmd wiki:lint`（含临时正式页） | 退出 0，本页无错误；全站 4 处已有 mark-flood 提醒 |
| `pnpm.cmd wiki:diagrams` | 成功生成两张新 SVG，后续迭代只更新本页直觉图 |
| `pnpm.cmd wiki:diagrams --check` | 退出 0，298 张图与 spec 一致；本页无越界或碰撞错误 |
| `pnpm.cmd wiki:audit`（含临时正式页） | 退出 0；143 页、3773 条来源，本页 30 条均有效；全站无无效 commit、缺文件、越界、未知仓库 |
| `pnpm.cmd check:content` | 退出 0；检查的是已有 registry 139 页，不把它冒充新页发布后的构建验证 |
| `checkStandard` 直接检查草稿 | schema 问题 0、写作标准问题 0；未改强制名单 |
| `deriveBacklinks`（含临时正式页） | 参数页产生本页反向导航，未手写重复反向边 |

本轮 PowerShell 默认调用 pnpm.ps1 被执行策略拒绝，随后改用已有 pnpm.cmd，未改系统执行策略。最初图 spec 的 tone 枚举误写 cache，经改为 kv 后通过；最终无残留失败项。工作区有并行写作，统计页数取上述命令实际输出。

字数口径沿用写作标准：汉字数 + 拉丁单词数，去围栏和链接地址，不含 frontmatter。教学正文 **2148 字**；含源码区全文 **4193 字**。完整 Markdown body 原始长度 8384 字符，和教学字数不是同一口径。

- 首图在文件第 56 行，开篇定义后即出现；图前数字 0、calc 0。
- 教学正文行内代码 0，证据角标 0；calc 1，约 0.466 个/千字，表与 calc 不相邻。
- 含源码区全文行内代码 16，约 3.816 个/千字；全页角标 28，其中 C 21，比例 75%。
- 标准工具计正文免责词命中 1/66 句，约 1.52%；源码区末尾保留真实待核，不用删除限制来压统计值。
- 两张图宽度均 860px；生成器对流程图的 wake_up、kv_cache 有代码名风格提醒，它们用于定位控制分支，不是 schema/布局错误。

没有启动任何服务，没有访问 5193/8790，没有截图或浏览器验收。按用户要求，实际页面阅读与独立审查留给审查员；以上只是写手自查与静态验证，未冒充独立审查结论。

### Stage 结果

先读 package.json 中 `wiki:stage = tsx scripts/wiki-stage.ts`，再读 scripts/wiki/stage.ts、integration-run.ts、integration-check.ts、review.ts。流程按 _drafts/<id>.md 原样晋升到临时库，校验后建待审包；不调用模型，不自动批准。

实际执行 `pnpm.cmd wiki:stage --ids sleep-mode`，退出 **0**：

- revision：`3f1d5fe900963f0adea184c6f74df0540f074413d6d4bc447fec5c5c8667e923`
- pageCount：143；costUsd：0。
- `wiki:review list` 显示状态 **pending**。
- 待审包写入范围只有 wiki/_drafts/sleep-mode.md（批准时消费草稿）与 wiki/concepts/sleep-mode.md（批准时新增正式页）。
- 图 YAML/SVG 是当前工作区保留的配套资产；stage 的文章晋升包不重复打包这些既有工作区文件，应与草稿一并保留。
- 查看命令：`pnpm.cmd wiki:review show 3f1d5fe900963f0adea184c6f74df0540f074413d6d4bc447fec5c5c8667e923`。

**stage 已走通，没有阻塞，等待用户在审阅面板批准。** 未执行 approve；正式 concepts/sleep-mode.md 不存在，草稿仍在 _drafts/。

### TOC 建议与待核

建议挂在「运行时与显存」的 Worker 生命周期之后、额外清理参数之前；本轮只给建议，不改 src/ 或现有 TOC。

自查没有未处理的 P1 疑点。旧官方 JSON level 写法和 level 2 缺重载风险已在新页说明并按钉住源码纠正；固定 GLM 原命令与专用池冲突也明确列出。

待核的是硬件效果：GLM 双机修改分配选项、NZ 布局和流量控制后，level 1/2 的混合注意力状态恢复、权重重载、输出一致性、显存与时延。没有该环境的实测，不声称已支持这组完整部署。独立内容审查与浏览器可读性验收亦待审查员完成。除待审批准外，无需用户另行决定写作方向。

## 审查（10-04）

独立审查员（Opus 5.5），只审不改。审查对象：`wiki/_drafts/sleep-mode.md`（待审草稿，审阅面板里等用户批准）。**本次没有移动文件、没有改面板状态、没有碰 concepts/。**

**结论：8.5 / 10。P1 0 条，P2 2 条，P3 3 条。audit（--drafts）通过。可批准性：需补一处机制演算再批——内容本身没有拦批的错，补完即可发布。**

### 1. 初学者测试（只读前两屏）

一句话：Sleep Mode 让推理引擎进程不退出、却把它占着的那部分显存还回去，好让同一张卡上的训练先用；level 1 把权重备份到 CPU、level 2 直接丢掉权重，两种都丢掉旧 KV cache，代价是搬运、等待和缓存复用的损失。

第一屏是问题式 H2 + 加粗一句话定义 + 直觉图（level 1 / level 2 并排）+ 「同一张卡轮流生成和训练」的具体场景，没有一上来就算数。学习顺序（是什么 → 为什么需要 / 代价 → 睡与醒的机制 → GLM 双机 → 常见误解 → 对照源码）通过，GLM 数字不进基础节。

### 2. 核心概念逐条核（对照钉住源码与官方文档，均本轮实读）

| 页面处 | 结论 | 依据 |
|---|---|---|
| L68 官方示例的 1 GiB 是「相对启动前基线的增量」且是示例断言、非实测 | 对，且口径纠正得准确 | `baa023ad:docs/source/user_guide/feature_guide/sleep_mode.md:118–131`（`used_bytes = total - free_after_sleep - used_bytes_baseline; assert used_bytes < 1 * GiB_bytes`，另有输出一致性断言） |
| L90/L92 level 1 备份权重池、level 2 不备份但另存 buffers | 对 | `baa023ad:vllm_ascend/worker/worker.py:241–250`（level 2 才 `{name: buffer.cpu().clone()}`）、`:258`（`offload_tags=("weights",) if level == 1 else tuple()`） |
| L92 持久标签跨睡眠保留 | 对 | `vllm_ascend/device_allocator/camem.py:209–212`（`sleep_persistent_tag` 直接 continue） |
| L100 控制接口默认终止在途请求；在线引擎有 wait，进程内引擎不支持；另有 level 0 只停调度 | 全对 | `0fc695fc:vllm/entrypoints/serve/dev/sleep/api_router.py:22–26`（`mode` 默认 `"abort"`）；`vllm/v1/engine/core.py:707`（`'wait' mode can't be used in inproc-engine mode`）；同文件 sleep 内 `clear_prefix_cache = level >= 1`、`if level < 1: return` |
| L102 每次唤醒调用后 EngineCore 都会恢复调度，包括只唤醒权重那一步 | 对，且是不易察觉的要点 | `core.py` wake_up 末尾注释 `# Resume scheduling (applies to all levels)` 后调 `resume_scheduler()` |
| L122 误解条：JSON 里写 level 无效，走查询参数，缺省 1 | 对 | 同 api_router：`level = raw_request.query_params.get("level", "1")`，请求体根本不读；`/wake_up` 取 `query_params.getlist("tags")` |
| L149 标签复数 `weights`，官方概述里的单数 `weight` 只是示意 | 对，核得细 | 代码 `use_memory_pool(tag="weights")`、`_maybe_get_memory_pool_context(tag="kv_cache")`；而 `sleep_mode.md:11` 文档写的是 `{"weight": data, "kv_cache": data}` |
| L162 无效唤醒标签只 warning 后返回、不抛异常 | 对，逐字一致 | `0fc695fc:vllm/v1/executor/abstract.py:335–341`（`"Tag %s is not in sleeping tags %s"` 后 `return`） |
| 报错表 4 条原文 | 全部逐字一致 | `camem.py:153–157`；`db701c1f:worker.py:671`（`Sleep mode can only be used for one instance per process.`）、`:244–247`（NZ，`Please set weight_nz_mode=0 via --additional-config.`）、`:232`（`Memory usage increased after sleeping.`） |
| L110 GLM 教程原命令含 expandable_segments，与睡眠池冲突 | 对，核实到行，是本页最有价值的发现之一 | `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md:256、305` 两机都 `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`；与 `camem.py:153` 的 assert 直接冲突 |
| L180 版本表「旧版唤醒的非量化专家转置分支，GLM W8A8 不走」 | 对 | `2c59ff10:worker.py:253–270`（`if self.vllm_config.quant_config is None and (...)` 才 transpose `w2_weight` / `w13_weight`）；main 已无该分支 |
| L182 版本表「main 释放映射前新增设备同步」及其克制表述 | 对 | `baa023ad:camem.py:204–207` 注释写明是 verl v0.8.0 的绕过、`The exact root cause is unclear`；页面照此说「未确认根因，不能倒推旧版一定失败」 |
| L179 main 的 level 1 显式清空 buffers 备份记录 | 对 | `baa023ad:worker.py:247`（level 1 分支 `self._sleep_saved_buffers = {}`） |
| 版本口径 | 正确 | v0.23=2c59ff10、v0.26=2ed6cbba、main=baa023ad，GLM orphan `db701c1f` 单独标注并说明「维护分支没有 GLM 模型实现」 |

**没有虚构部署数字**：全页唯一数值是官方示例的 1 GiB 阈值，且三次强调是示例断言；GLM 一节明确「本部署没有可用于报告释放量、唤醒延迟或输出一致性的睡眠实验」。**没有把推断写成定论**：verl 同步、唤醒后状态、跨 DP 协作都带了限定语并给出源码位置。

### 3. frontmatter、链接与工具链

- `origin: direct`（L49），无 `rawSources`，符合 10-04 新规。`type: feature`，`chapters: ["19"]`（与 enable-sleep-mode-extra-cleanup、netloader-guide 同章，合理）。
- `pnpm wiki:audit --drafts` 退出码 0：本页 30 条来源，行号有效 30，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0。
- 草稿不在站点构建与 lint 覆盖内，按人工对照同一口径：用 `headingSlug` / `fragmentId`（`src/content/wiki/anchors.ts`，与 lint 的 `anchorProblems` 同一算法）把 5 个跨页锚点按「移入 concepts/ 之后」的相对路径全部重算——`request-call-chain#一步之内enginecore-给-worker-发两次调用`、`npu-worker-lifecycle#一张卡上的-worker启动时按什么顺序做准备`、`glm-5-3-flash-two-node#部署前提`、`#剩下的显存变成多少-kv-cache`、`enable-sleep-mode-extra-cleanup#开了的代价`**全部命中**；两条无锚点链接目标文件也存在。`../concepts/x.md` 这种写法从 `_drafts/` 和从 `concepts/` 都能正确归一化，移动文件不会断链。
- 按名单口径单独跑 `checkStandard`（未改名单）：`2148 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.47/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.5% · 图宽 ✓`，`problems: []`。
- 五个 H3 齐全且顺序正确：怎么开（126）/ 会报什么错（151）/ 开销和什么时候别开（164）/ 版本差异（172）/ 源码位置（186）；版本差异节内 v0.23、v0.26、main 齐全。教学正文零证据角标。
- 两张图（`sleep-mode-intuition`、`sleep-mode-flow`）本轮用 Playwright 离线渲染实看（`scratchpad/rv1004-sleep-mode-intuition.png`、`rv1004-sleep-mode-flow.png`）：配色与站内一致，flow 图连线同向进出、无交叉、无遮挡溢出，level 0 分支、两段式唤醒、「权重与缓存均就绪 → 放行下一批请求」的收口都画出来了，图里没有 meta 文本。无分镜动图。
- 与 `enable-sleep-mode-extra-cleanup` 的分工清楚：草稿讲级别、唤醒顺序、在途请求，参数页讲额外清理的代价与配置迁移；草稿三处（L84、L168、L184）把额外清理指过去，relation 的 note 也写明了这条分界线。参数页只在「分标签唤醒时重捕获只发生一次」处提到 level 2 两段式唤醒，属于它自己的议题，不构成重讲。

### 4. 问题清单

**P2-1｜没有一处讲机制的数值演算（位置：唯一 calc 在 L70–74，机制节 L86–102 全无数字）**
现有 calc 只是把 1 GiB 换算成 1,073,741,824 B，换算本身不教任何机制，真正有信息量的内容在它下面那行注解里。读者读完全页仍答不上最自然的问题：「睡一觉到底让出多少、还剩多少」。基础页标准第 11 条要求「怎么算」的地方要有一次数值演算。
改法：在第三节（睡下去和醒过来）加一个示意账的 calc，用小模型示意数走一遍，例如 0.5B 模型权重 ≈ 0.5e9 × 2 B ≈ 1 GiB、KV 池按示意值 X GiB，算出 level 1 睡后卡上只剩持久分配与池外部分、level 2 再省掉 CPU 备份那一趟；数要标「示意」，不要碰 GLM 的部署数字。原来的单位换算可以降为正文一句话。

**P2-2｜批准后要立刻补的入链与编排（位置：全库 / `src/content/wiki/toc.ts`）**
`grep -rn 'sleep-mode' wiki/ src/` 目前只命中参数页 id `enable-sleep-mode-extra-cleanup` 的字符串，没有任何页指向本页；toc.ts 无本页，发布后会落进 `toc.ts:221` 的「新增教学页（待编排）」。另有两处应同时改：`wiki/concepts/vllm-ascend-for-rl.md:76` 现在把「更完整的内存生命周期」指向 GitHub 上的官方 `sleep_mode.md`，本页发布后应改成站内链接并把那段 level 1/2 细节压成一句；`wiki/params/enable-sleep-mode-extra-cleanup.md` 的「为什么存在」里讲分配器与 RL 背景的部分也应改为一句 + 链接。
改法：批准发布的同一轮里做掉这三处 + toc 分组（建议与 vllm-ascend-for-rl 同组），改完跑 `pnpm wiki:lint`。

**P3-1｜直觉图顶部连线交叉（位置：`wiki/diagrams/sleep-mode-intuition.yaml`）**
「模型权重 / KV cache」两个块往左右两组分流时，橙线与蓝线在图上部交叉了一次。信息不受影响，但与 09-29 定下的连线画法（同向进出、并排不交叉）不符。改法：让两条线先各自向下再分左右，或把 level 2 组的入口点移到块的近端。

**P3-2｜与 npu-worker-lifecycle 的小重合（位置：L128、报错表第二行）**
「启动时才能入池、一个进程只能一个实例」在 `wiki/concepts/npu-worker-lifecycle.md:196、211` 已经讲过。草稿的 relation 已指向该页，但正文这两处没有就近给链接。改法：报错表那一行或 L128 补一个指向 npu-worker-lifecycle 的链接即可，不必删。

**P3-3｜示例里两种关 NZ 的写法可以说得更干脆（位置：L130、L133–138）**
示例同时 `export VLLM_ASCEND_ENABLE_NZ=0` 和 `--additional-config '{"weight_nz_mode":0}'`。实测：`db701c1f:vllm_ascend/ascend_config.py:249–254` 的 `weight_nz_mode` 以 additional-config 优先、环境变量只是回退默认；而 main 的 `vllm_ascend/` 里已经 grep 不到 `VLLM_ASCEND_ENABLE_NZ`。改法：把「旧钉点用环境变量回退、新钉点只认 additional-config」这层关系在正文点明一句，读者就不会以为两条都必填。

### 5. 可批准性判断

无 P1，事实层面没有发现拦批的错误，骨架、版本口径、源码对照、GLM「为什么没开 / 开了会怎样」都达到站内深入页的标准，图可用，audit 与写作标准均通过。**建议：补上 P2-1 的那一处示意账后批准**；P2-2 属于发布动作本身的一部分，在批准同一轮里完成。P3 可随后再改。

### 6. 跳过了什么

- 按纪律未读 frontmatter 的 sources 区、HANDBOOK、docs/plans/。
- 未读本页「对照源码」正文的代码块与成排环境变量（只核了报错原文与命令里的关键项）。
- 未在真机 NPU 上复现任何睡眠 / 唤醒（页面自己也声明了）；未核外链联网可达性。
- 未在浏览器里打开本页：草稿不在站点构建里，5193 没有它的路由；改为离线渲染两张 SVG 实看，并对锚点做了等价的人工校验。
- 未跑 `pnpm wiki:diagrams --check` 与全量 test（本轮只审内容）。

## 修订记录（10-04）

本轮按用户指定修订 **P2-1，共 1 条**，直接编辑 `wiki/_drafts/sleep-mode.md`。P2-2 的批准、入链与 toc 由主会话处理；本页 P3 不在本轮指定修订范围，保留审查记录供后续处理。未移动草稿，未执行 stage / approve，未改面板状态、图或其他页面。没有判为不成立的意见。

**改动与原因：** 原 1 GiB 单位换算降为正文，保留官方断言的基线口径及非实测条件。机制节新增一组明确标为示意的实际分配账：权重标签 2 GiB（其中模型 buffers 为 16 MiB）、缓存 3 GiB、持久分配 0.25 GiB、池外常驻 0.75 GiB。推演睡前 6 GiB、睡后 1 GiB、释放 5 GiB；level 1 新增 CPU 备份 2048 MiB，level 2 仅另存 16 MiB buffers；权重与缓存分阶段唤醒后为 3 GiB、6 GiB。算例限定额外清理关闭、其他占用与分配规格不变、训练先归还空间，说明恢复空间不等于恢复参数内容或旧 KV。两级在相同池边界下释放量相同，level 2 省的是整份权重的 CPU 备份，不把它写成额外显存收益。

**证据与信息保留：** 本轮重读 `db701c1f:vllm_ascend/worker/worker.py:216–280` 和 `vllm_ascend/device_allocator/camem.py:179–249`：level 1 按 weights 标签备份；level 2 另存 buffers；持久标签直接跳过；唤醒重新映射、有备份才拷回并清除备份。数值全部是显式教学假设，算式按上述机制推导，没有使用 GLM 部署账或把示意余量等同官方阈值。原请求暂停与调度恢复风险、GLM 未启用及启动冲突、版本差异、报错、外部重载与实机待核项均保留。

**验证结果：**

| 检查 | 本轮实际结果 |
| --- | --- |
| 每次保存后 `pnpm.cmd wiki:lint` | 退出 0；4 条既有非阻塞提示均在其他页 |
| 临时副本 lint | 确认正式路径不存在，复制至 `wiki/concepts/sleep-mode.md`，SHA256 与草稿一致；`pnpm.cmd wiki:lint` 退出 0；finally 删除副本，确认草稿存在、正式路径不存在 |
| 最终 `pnpm.cmd wiki:lint` | 退出 0 |
| 最终 `pnpm.cmd wiki:diagrams --check` | 退出 0，299 张图与 spec 一致 |
| 最终 `pnpm.cmd wiki:audit` | 退出 0，142 页、3827 条来源；无效 commit / 缺文件 / 行号越界 / 未知仓库均为 0 |
| `pnpm.cmd wiki:audit --drafts` | 退出 0，1 页、30 条来源全部行号有效，四类错误均为 0 |
| 直接 checkStandard（不改名单） | schema 问题 0、`skip=[]`、`problems=[]`；教学正文 2498 字、行内代码 0、正文角标 0、calc 1（0.40/千字）、免责句 1/75（1.33%）、相邻密集块 0 |
| calc 解析 | parseCalcFence 解析出 7 个 eq 行，标题、单位、结果栏全部正确；逐项复算加减与 GiB/MiB 换算一致 |

首图仍为文件第 56 行，图前部署数字与 calc 均为 0，两图宽均为 860px。字数按 checkStandard 的汉字逐字、英文按词统计，去围栏和链接地址，仅统计教学正文。全站来源审计不代表外链或 NPU 实测通过。

**待审位与限制：** 审阅包 `3f1d5fe900963f0adea184c6f74df0540f074413d6d4bc447fec5c5c8667e923` 仍为 pending；本轮按要求只更新磁盘草稿，没有刷新该包内原快照，批准操作仍由主会话处理。未起服务、未访问 5193/8790、未截图或做浏览器验收。需用户另行决定的问题：无。
