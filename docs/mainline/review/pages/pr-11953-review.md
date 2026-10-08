# pr-11953 审查记录

## P5 写作记录（2026-10-02，第 30 批小修）

本页是 PR 归档（sources 类，type: pr），小修：沿用原有 7 个 H2 和资料页体例，不套深入页骨架；本页原本无图，队列写「沿用现有图」，未新增 yaml。只改了 wiki/sources/pr-11953.md，未碰其他页、图、代码，未提交 git。

### 改了什么

- frontmatter：summary 从「上游 PR」改写成约 90 字的说明（合并日期、删了什么、各分支在不在、GLM 双机用不到）；新增 6 条来源（C2–C6 源码、S7 发布说明）；updated 改 2026-10-02；aliases、chapters、relations、rawSources 未动。
- 一句话：「超出五个文件的都是自述」保留，补一句说明哪几处是归档后按本地提交补核、单独标了角标。
- 五个文件一节：platform.py 段末链到 layer_sharding 参数页事实表（删后在 v0.26 / main 上的表现以那里为准，不在本页重讲）；新增一段说明这条校验在启动期由 NPUPlatform 执行，链 K（请求调用链「vllm-ascend 从六个口子接进 vLLM」），讲清配错是起不来而不是跑一半出错。
- 被删文档一节：61 层后注明是文档原文的 DeepSeek 例子、不是本站 GLM 层数（旧模型保留原语境）。
- 版本边界：H2 改名为「材料证不了，钉住提交上查得到」（全库无入链锚点）；保留「单靠材料不能断言」，补上本轮核查结果：2c59ff10 与 db701c1f 不含这次合并、配置读取与启动校验仍在；2ed6cbba 与 baa023ad 含这次合并、vllm_ascend/ 下 grep 为 0；最早带上它的标签是 v0.24.0rc1；main 发布说明记在 v0.26.0rc1 的 Deprecation and Breaking Changes 下。版本状态真相源仍指向参数页版本谱系。新增一条 GLM 双机用不到它（混部无 kv_transfer_config，db701c1f 上配上即被启动校验拒绝），链参数页「开了的代价」，不另造双机账。差异依据一条补「只有一个父提交、共 51 个文件，与材料对得上」。
- 影响面：rfork_loader.py 由「推断」改为已核事实——删掉的正是 layer_sharding 绕行判断，删后绕行理由只剩动态 EPLB；补两个算子文件整个删除；其余文件明确写本页未逐个核。
- 常见误解：第一条把「旧维护分支通常不跟着删」改成具体事实（v0.23 维护分支没删）；第二条 ValueError 加源码角标，删后行为指向参数页事实表。
- 角标：新增后共 30 处（lint 阈值 30），删掉了 7 个重复或只描述本页状态的 [I] / 重复 [C]。

### 核心说法对照的源码与原文（本轮实际读过的行）

- 合并提交：git log 显示 896012151d 唯一父提交 2b115d02，日期 2026-07-15，标题同 PR；git show --stat 共 51 个文件、+499 / −2566；name-status 中 layer_shard_linear.py、flashcomm2_oshard_manager.py、layer_sharding.md 等 7 个文件为整删。
- 分支归属：merge-base --is-ancestor 对 2c59ff10、db701c1f 为否，对 2ed6cbba、baa023ad 为是；git grep layer_sharding 在 vllm_ascend/ 下计数 38 / 38 / 0 / 0；tag --contains 最早 v0.24.0rc1，releases/v0.23.0 不在其列。
- RFork 绕行：vllm-ascend@2b115d02 rfork_loader.py 110–112（_is_layer_sharding_enabled）、234–246（先判 layer_sharding 再判动态 EPLB，打 warning 后改用默认 loader）；该提交对此文件的 diff 为 +1 / −8，正是删这两处。
- 配置与校验：vllm-ascend@2c59ff10 ascend_config.py 105（读取 layer_sharding，默认 None）；platform.py 338–346（非 kv_producer 抛 ValueError）；db701c1f platform.py 338、340 同位置同内容。
- 发布说明：vllm-ascend@baa023ad docs/source/user_guide/release_notes.md 56–58（v0.26.0rc1 一节下的 Removed layer sharding #11953）。
- K 的用法：request-call-chain「vllm-ascend 从六个口子接进 vLLM」第 1 条（平台插件）；参数页「一句话」「事实表」用于确认版本状态与 GLM 不适用的口径一致，没有重讲其内容。

### 旧版信息清单勾选

清单在旧会话 scratchpad\p5\pr-11953-facts.md，共 25 条，现版改前 = p4-checkpoint。
- 1–5：一句话、作者自己怎么说的，全部保留（2 补一句补核说明）。
- 6–11：五个文件一节，全部保留（11 补参数页链接与启动期说明）。
- 12–17：被删文档一节，全部保留（14 补原语境注）。
- 18：保留。19：改写——仍保留「材料本身不能断言」，补钉住提交上的核查结果；参数页仍是真相源。20：保留。21：保留并补父提交与文件数。
- 22：保留。23：由推断改为已核事实，证据见上。
- 24：四条误解全保留（前两条改准）。
- 25：summary 改写，其余字段未动。
无删除项。

### 字数与校验

- 字数（measureStandard 口径）：改前 1771，改后 2199。行内代码 70（31.8/千字，改前 36.7/千字），角标 30，calc 0。
- pnpm wiki:lint 通过，本页无报错无待留意（中途一次 lint 失败来自 params/weight-prefetch-config.md 的 [C33] 越界，是别的写手正在改的页，未处理；再次运行时已通过）。
- pnpm wiki:diagrams --check：290 张图与 spec 一致（本页无图）。
- pnpm wiki:audit 通过；本页 7 条来源行号全部有效。
- 未起服务、未截图（浏览器验收归审查环节）。

### 取舍与疑点

- 「GLM 双机是混部、没有 kv_transfer_config」沿用参数页与部署页口径，本轮没有另读部署配置；db701c1f 上校验代码本轮读过。
- 版本状态在本页只写一句结论加链接，详细谱系留在参数页，避免两处漂移。
- 参考图库（refs）只适用于通信原语与 TP/DP/EP 页，本页未查看。
- 跳过：frontmatter sources 区只读了原有那一条 raw 引用；归档 raw 原文未读（页面现有说法本轮没有改动其 [M1] 部分）；HANDBOOK、docs/plans 未读。

## P5 审查（10-02）

审查员：独立审查（Opus 5.5），只审不改页面。本页是 sources 类 PR 归档，按资料页体例审（批次计划第 216 行：教学改版规则不覆盖 param/source 归档页），不套深入页骨架；行内代码密度 31.8/千字属于 PR 归档引原文的常态，audit 把本页列为名单外只统计，不扣分。

### 结论

- 分数：**9 / 10**。P1 0 条，P2 0 条，P3 4 条。
- `pnpm wiki:audit`：通过（exit 0；本页 7 条来源全部 ✓，raw 归档 334 行有效）。`pnpm wiki:lint`：通过（全库 4 处待留意均不在本页）。
- 任务文件要求：「保留 PR 原始数字，不另造双机账」已做到（GLM 一条只写「用不到、配上即被校验拒绝」并链参数页「开了的代价」，没有算任何双机数字）；「旧模型记录保留原语境」已做到（61 层注明是文档原文的 DeepSeek 例子）；「最后核参数与归档链接」：归档 raw 与 6 条源码 / 发布说明来源行号有效，链接锚点全部存在。
- 「推断写成定论」逐句查过，没有发现：凡带 [I] 的都是确属推断的句子（作者意图、分歧无后续、基线动过、文档自相矛盾）；由推断升级为定论的两处（RFork 绕行、各分支是否含这次合并）本轮都在本地仓库复核属实，见下。

### 事实对照（PR 合并提交与钉住源码，本轮实际运行）

- 合并提交 896012151d：唯一父提交 2b115d02，日期 2026-07-15，标题带 (#11953)；共 51 个文件、+499 / −2566；整删 7 个文件（layer_sharding.md、其 zh_CN .po、配图、两个算子文件及两个对应单测）。页面「51 个文件」「两个算子文件整删」「五个有正文 + 四十多个只有名字」均对得上。
- 五个文件表逐行对 diff：ascend_config.py 删读取与 info_once（FLASHCOMM2 / DSA-CP 提示原文一致）；platform.py 删 `_validate_layer_sharding_config` 及调用，原条件 kv_transfer_config 为空或 kv_role 不是 kv_producer 即抛 ValueError；additional_config.md 删 dict / `{}` 那一行；layer_sharding.md 在父提交为 80 行；release_notes 删 #8717 一条与 #4723 两条。全部属实。
- 被删文档摘要：对照 2b115d02 上的 layer_sharding.md 第 9–18、36–42、61、78 行，i % K、shared dummy tensor、异步 broadcast、MLA latency-bound 掩盖 o_proj 搬运、61 层例子、只在 P 节点、RFork 被绕过、列表写法均与原文一致。
- 分支归属：merge-base --is-ancestor 对 2c59ff10 / db701c1f 为否、对 2ed6cbba / baa023ad 为是；`vllm_ascend/` 下 layer_sharding 计数 38 / 38 / 0 / 0；tag --contains 最早 v0.24.0rc1。baa023ad release_notes 第 56 行「Deprecation and Breaking Changes」、第 58 行「Removed layer sharding #11953」，位于第 3 行「v0.26.0rc1」一节下，属实。
- RFork：896012151d 对 rfork_loader.py 的 diff 删 `_is_layer_sharding_enabled`（父提交 110–112）和 235–236 的先判分支，并把 237 行的 elif 改成 if（动态 EPLB）；父提交 240–246 打 warning 后走 fallback loader。页面「删后绕行理由只剩动态 EPLB」属实。
- GLM 用不到：db701c1f platform.py 338 起是校验函数、467 行在 `check_and_update_config` 里调用它，ascend_config.py 105 行仍读取该键；「混部无 kv_transfer_config」与参数页「开了的代价」第 134 行口径一致。
- 删后行为：参数页事实表（85–87 行）确有 v0.26「静默忽略」、main「extra=forbid 拒收」两列，页面链过去不重讲，单一真相源成立。

### P3

1. 版本边界第一条（正文第 91 行）说 2c59ff10 与 db701c1f「配置读取和启动校验都还在 [C4][C5]」，但 C4、C5 都是 2c59ff10 的行；db701c1f 的配置读取没有角标（本轮核到 db701c1f ascend_config.py 第 105 行仍在）。可补一条 db701c1f ascend_config.py#L105 来源，或改写成只对 2c59ff10 挂角标。
2. 同一条里「最早标签 v0.24.0rc1」与「发布说明记在 v0.26.0rc1」并列，读者会疑惑为何差两版。本轮核到 v0.24.0rc1 标签上 `vllm_ascend/` 已无 layer_sharding，但它自己的发布说明没提 #11953。可加半句「代码从 v0.24.0rc1 起已删，发布说明直到 v0.26.0rc1 才补记」。
3. 第 71 行「校验在启动期由 NPUPlatform 执行，配错是服务起不来」是对的（db701c1f platform.py 467 行在 check_and_update_config 内调用），但这段没有源码角标，只链了 K。可补 platform.py#L450-L467 一条。
4. `wiki/index.md` 第 146 行本页条目摘要仍是旧 summary「上游 PR」；index 由构建生成，批次收尾统一重建时刷新即可，不是写手范围。另：layer_sharding 参数页没有链回本页（全库入链只有 index 两处），参数页下次修订时可在版本谱系里链一下本归档；不属于本页改动范围。

### 逐项核对记录

- 链接与锚点：跨页 4 个锚点（params/layer-sharding 的 #事实表、#版本谱系、#开了的代价，request-call-chain 的 #vllm-ascend-从六个口子接进-vllm）在目标页标题中逐个手核存在，lint 硬校验通过。H2 改名后旧标题「这页不声称任何版本已经删掉了它」只出现在 wiki/_jobs 历史日志里，没有链接入链。
- 丢信息：`git diff p4-checkpoint` 删除的 11 行逐条在新版找到改写后的对应句；唯一实质变化是第 19 条「本页不断言任一分支已删」改为「材料不能断言，但钉住提交上已核」，改写有本地复核支撑，属合理升级。旧版信息清单（旧会话 scratchpad\p5\pr-11953-facts.md，25 条）存在；抽查第 6、9、13、17、20、22 条，新版均在（第 63、66、78、83、93、100–103 行），写手勾选属实。
- 浏览器：Playwright 1440 宽只读打开 http://localhost:5193/#/wiki/pr-11953，无控制台错误；截图存审查员 scratchpad `pr-11953-review-1.png`（第一屏）、`-2.png`（五个文件表）、`-3.png`（被删文档与版本边界），角标与表格渲染正常。
- 跳过：frontmatter sources 区与 raw 归档原文未读（[M1] 部分如 CI 环境标注、冲突与 /rerun 时间线、机器人原话，按 audit 行号有效与写手记录采信）；HANDBOOK、docs/plans 整份未读（只 grep 了批次计划本页两行和第 216 行规则）。

## P5 修订记录（10-02）

上方「P5 审查（10-02）」无 P1/P2，修 P3 第 1–3 条；第 4 条（index 摘要、参数页回链）不在本页范围，未动。

- P3-1：版本边界第一条拆开挂角标：2c59ff10 的配置读取与启动校验 [C4][C5]，db701c1f 同一位置 [C8][C6]；新增 C8 = vllm-ascend@db701c1f vllm_ascend/ascend_config.py 105（本轮复读，仍读取 layer_sharding）。
- P3-2：补半句「代码从 v0.24.0rc1 起已删，但它自己的发布说明没提；main 的发布说明到 v0.26.0rc1 才补记」。本轮核：v0.24.0rc1 标签的 release_notes.md 里 grep 11953 计数为 0。
- P3-3：「校验在启动期由 NPUPlatform 执行」补角标 C9 = vllm-ascend@db701c1f vllm_ascend/platform.py 450–467（450 为 check_and_update_config 定义，467 调 _validate_layer_sharding_config，本轮复读）。
- 角标控制在 30（lint 阈值）：GLM 一条的 [C6] 与上一条重复、常见误解里两处 [M1] 与正文前文重复，去掉这 3 处。
- 字数 2199 → 2239；pnpm wiki:lint 退出码 0（本页无报错无待留意）；pnpm wiki:audit 退出码 0（本页 9 条来源全部有效）。
