# 独立审视后的闭环修复与人工交接（2026-09-16）

> 09-16 最新状态：03:00 维护失败后的两个可复现阻塞已修复，尚无新的生产到点结果。下文 Prefix Caching 提案曾重建，之后因纠错依据不足已撤回；“107 条缺失记录”与“Prefix Caching 确有反证”的旧判断不再沿用。107 条已逐项核查；显存预算错误对比已由用户批准，e6061568… 已发布，见 [最新证据核查](wiki-evidence-review.md)。全部批量项和接续顺序见 [handoff](../../HANDOFF-LLM-WIKI.md)。下文命令结果保留为当时证据。

工作目录：`C:/Users/-/Desktop/infra-view-new-llm-wiki`，分支 `feat/llm-wiki`，HEAD `8175224`。原始理念：`C:/Users/-/Desktop/infra-view-new/llm-wiki.md`，未修改。保留原有未提交工作，未提交、未合并、未做批量导入。本报告的命令均在实施目录执行；日志在被忽略的 `tools/wiki-runtime/`。

**结论：已修复本次独立审视复现的工程断点；四个 feature 都不能宣布完整验收。“越用越聪明”已有经过完整校验器的机制证据，但真实回答改善仍尚未验证。下一关是审阅具体纠错内容、核对未知费用，并在费用明确后按冻结题目做真实前后对照。**

原始理念要求不可变原料、持久 Markdown、更新已有页与关系、保存值得保留的问答、定期审视。现在工程链路与这一方向一致；人负责选材、判断和批准，程序负责归档、上下文选择、草稿、整合、派生、记账及复测接续。没有训练模型、部署推理服务或性能基准。本轮用源码和测试重新验证，不沿用旧报告的“已接通”结论。

## 符合要求的

| 范围 | 已取得的证据 | 仍然不能推导出的结论 |
|---|---|---|
| 增量维护既有知识 | `draft-review.test.ts`：材料合并进已有页，批准前原文不变，批准后补充正文、消费草稿、不产生重复页；完整 lint / 来源 / 派生校验，没有 `validate: () => []` | 固定模型输出证明机制，不证明真实 agent 会选对目标页、关系和修订类型 |
| 使用后的改善验收 | `worker.test.ts`：冻结方案 → 独立四题前测 → 补料编译 → 自动待审提案 → 实际批准校验 → 独立四题后测 → 人工逐题评分；成功才关闭，失败仍开放 | 本轮未运行真实模型，不能说真实回答已经改善 |
| 旧参数维护 | `wiki/params/identities.json` 显式绑定 8 个既有页与 4 个引用身份；同步和骨架 CLI 共用。真实 pin `2c59ff1047573f40a471cf7535f01a8877344415` 核对并刷新 8 页，原 ID、正文保留，新增页 0 | 静态表达式不是运行时最终值；疑似扫描项没有因此自动晋升为已确认参数 |
| 来源留存 | 新增的 8 条静态引用各自能回到本轮实际读取快照；旧 raw 保留为原字节快照。`legacy-static-preservation.json`：8/8 authoredPreserved=true | 没有修补或伪造 107 条历史缺失对应记录 |
| 中文与版本边界 | `coverage.test.ts` 覆盖两种中文“不足/无法判断”；结构化覆盖状态只是观察，仍要独立分类。`gap-sources.test.ts` 验证中文别名、明确版本 pin、未知版本不回退 main | 并非所有表述都能自动定位；跨版本问题当前需明确补料 |

## 走偏的地方及本轮处理

| 级别 / 位置 | 影响与稳定复现 | 处理与证据 |
|---|---|---|
| P2 · `scripts/wiki/drop.ts`、`worker.ts` | 原先只产出草稿，下一步要人工拼接整合命令。新增 `reviewId` 断言先失败 | 共用 `draft-review.ts`，返回完整待审 manifest；投喂、worker、合并已有页回归通过 |
| P2 · `worker.ts`、`retest.ts` | 补写后才冻结判准会被拒绝，无法建立严格前后对照 | 缺方案时停在 retest-plan；准备后重排，前测先于编译；发布后可由 worker / 已启用收费的 sync 接续。缺方案与前后测成功、失败路径均有回归 |
| P2 · `params/publish-sync.ts`、`wiki-build-param-pages.ts` | 旧 ID 和新 hash ID 脱节，实际出现 changed=1、written=0、旧文不变，却标静态事实已刷新 | 共同使用显式身份映射；未知旧身份报错、引用身份明确记录跳过。真实 CLI fixture 验证旧路径保持、默认值 1→2、written=1 |
| P2 · `params/scan.py` | `.get(key, 2)` 的默认值被记成 `<unknown>`，变更不能正确比较；Ascend `_get_config_value` 漏扫 | 红例实得 `<unknown>`，修复后保留字面默认表达式和包装器 fallback，仍为 suspect；真实 8 个旧参数均找到定义身份 |
| P2 · `server/coverage.ts`、`gap-sources.ts` | 两句自然中文无法形成缺口信号，中文标题不能定位源码；版本可能只取 main | 新增结构化协议与兼容识别，页面标题/别名仅作定位；明确版本严格匹配 pin。先红后绿回归 |
| P2 · `server/answers.ts`、`repo-roots.ts` | 一个入口读所有 seeds，一个只读默认文件，可能对同一来源得出不同可用性结论 | 仓库路径统一由 `configuredRepoRoots` 解析；多 seeds 与冲突拒绝回归通过 |
| P2 · `wiki/concepts/prefix-caching.md:56` | 引用测试比较输出 token / 文本，却外推任意 KV 张量逐位相同。复现：读取 `28bf3a2e:tests/e2e/model_utils.py:27–54`，只有 output_str / output_ids 相等断言 | 已准备具体 supersede 提案：撤回过度结论，保留旧说法、日期、来源和新读取快照。完整候选校验通过；**未代替用户批准，正式正文尚未修复** |
| P2 · 旧收尾报告 | “维护闭环已接通”被无成功闭环、校验器替身的测试夸大支持 | 旧报告标为历史并撤回该判断；本报告明确区分固定输出工程测试与真实语义验收 |

此前怀疑“正确拒答也一定过不了引用检查”已经证伪：规范的未收录回答可通过 no-evidence 门槛；没有据此降低引用断言。修的是确有复现的中文观察漏记。

## 实际验证

| 命令 | 关键输出 | 日志 |
|---|---|---|
| `pnpm check` | 首轮 92 files / 634 tests passed，100.67s；类型、Lint、依赖、内容、Wiki lint 通过。最终复核仍为 92 files / 634 tests，103.54s；既有 CSS 1 warning、Biome 2 infos 保留 | `loop-check.log`、`loop-check-final.log` |
| `pnpm exec vitest run scripts/wiki/params/publish-sync.test.ts scripts/wiki/params/sync-cli.test.ts` | 2 files / 4 tests passed；实际 Git / CLI、旧 ID、源码读取快照、原 raw 保留 | `loop-param-provenance-test.log` |
| `pnpm wiki:build-param-pages --input tools/wiki-runtime/legacy-static-input.json` | count=8、dryRun=false；前置 dry-run 同样只含 8 个旧路径。输入来自上述真实 pin 的 AST 扫描，没有运行模型 | `legacy-static-refresh.log`、`loop-identities-scan.log` |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | 正式 19 页 / 418 来源；411 本地行号有效；无效 commit、缺文件、越界、未知仓库均 0；7 URL 本轮未联网，107 raw 引用待核对 | `loop-audit.log` |
| `pnpm build` | 渲染修复后的最终生产构建通过，built in 2.06s | `loop-build-final.log` |

本地行号检查不证明语义正确。尚未全面逐句重审 19 页；Prefix Caching 是本次确有反证的抽查项。正式页仍全部 origin=seed，本轮没有新生成的真实 drop / gap / pr 页，不能把修管线和加生成区计作已积累新语义知识。

## 所有 feature 的整体进度

AC 规范与当前状态只维护在四个 feature 的“当前验收核对”表，本节是交接摘要，不另造完成百分比。

| Feature | 当前可用部分 | 到完整验收还缺什么 |
|---|---|---|
| [F001 · LLM Wiki](../features/F001-llm-wiki.md#2026-09-16-当前验收核对) | Markdown 管线、读者、引用、问答与保存、统一审阅、检索和相关页 | 历史正文/证据复核；真实回答及真实 PR 草稿质量；120–160 页扩充为用户排除项 |
| [F002 · 参数谱系](../features/F002-param-lineage.md#2026-09-16-当前验收核对) | AST、Git 谱系、骨架、保护生成区、8 个旧页身份/静态事实接入、增量与调度 | 真实 LLM 疑似项分类和正文补写质量；计划任务首次到点结果；全量生成排除 |
| [F003 · GitHub 语料](../features/F003-github-corpus.md#2026-09-16-当前验收核对) | 采集/续传/删除核对、报错检索、issue→PR→commit→ref、文档映射、重要 PR 接入待审 | 真实 PR #11953 编译失败须费用核清后恢复；全库初拉排除。历史小样本召回结果不外推全量 |
| [F004 · 知识积累](../features/F004-knowledge-loop.md#2026-09-16-当前验收核对) | 投喂、隔离、中文缺口、前测门槛、编译后整合、审阅后复测接续、修订历史及维护 | 真实新知识发布和独立前后四题语义改善；关系/矛盾判断的真实准确性；仍需人审 |

F003、F004 的 [实施计划](github-corpus-plan.md)、[实施计划](knowledge-loop-plan.md) 均已存在。四项仍为 in-progress，不能因为排除了大导入就自动改为完成。

## 人工交接与收益顺序

1. **审阅具体纠错提案**：优先撤回证据不支持的强结论，比增加页数更能提高教学可信度。提案已通过完整候选校验，正式正文和旧历史都未静默覆盖。完整 ID / diff 见追加记录。
2. **核对未知费用后再允许真实调用**：累计授权仍为 $10。共享账本占用 $8.9027865、账面剩余约 $1.0972135；其中包含总计 $0.65 未知费用预留，不能当作最终账单。本轮新增真实模型调用 0。未知调用 `76128abc-ee51-43ce-aac7-ece041eec60a`，PR #11953 编译，UTC 2026-09-15 16:55:14–16:56:14 超时。需要供应商账单/回执，不能凭估计填 0、重置预算或继续收费。
3. **在费用明确后完成一条真实积累闭环**：优先使用既有冻结场景，不再扩功能清单。验收问题和判准放在知识快照之外，编译前冻结、独立前后问答；用户逐题判断事实、版本边界与正确拒答。实际额度是否足够仍需回执确认，不承诺剩余预算一定够。
4. **逐批处理历史证据债务**：107 条缺记录保持未验证；依据真实新读取提出带日期的修订，不回填成原 agent 读取历史。未全面重审的页不能宣称没有语义问题。

上述停点来自用户“推进到需要人工的部分”和 feature 的明确人审契约，不是工具自动审批拒绝。没有重新请求常规实现权限；没有发布该内容提案、扩大 $10 额度或启动批量导入。

## 最终追加证据与可操作交接

- 浏览器先红：`loop-browser-final.log` 为 1 failed / 29 passed，明确复现覆盖注释可见。`ChatDrawer.tsx` 的 Markdown 渲染增加 `skipHtml` 后，相同 30 项全部通过，46.3s，见 `loop-browser-green.log`。覆盖目录、来源、投喂标签、相关页跳转、保存/审批/驳回/冲突、离线读取及新版本会话。
- 追加真实保存入口兼容回归：`pnpm exec vitest run server/answers.test.ts`，9 passed，2.67s；结构化元数据保留在原始回答记录，但不会作为事实送入编译，见 `loop-save-metadata-test.log`。这是全量 634 项之后新增的一项参数化回归，未把它冒充此前全量计数。
- 实际查看浏览器截图：`test-results/wiki-review-coverage-metad-e76b4-ted-answer-remains-readable-chromium/coverage-metadata-hidden.png`，自然语言、链接和“存进 Wiki”可见，协议内容不可见。浏览器模型输出固定，不能当作真实模型效果。
- 参数页更新后 `wiki:build` 保持 19 页；本轮新的源文件快照与 8 份既有 raw 原字节归档不算新增知识页。107 条未核对引用的具体列表在 `tools/wiki-runtime/legacy-raw-review.json`：Block Table 20、CPU Offload 1、Memory Profiling 21、Quantization 26、fuse_allreduce_rms 16、layer_sharding 23。
- 进度单一真相源：移除 feature 规范正文里 34 个重复的勾选状态，保留 AC 规范文本；当前状态只看同一文件内的验收表，旧报告明确标历史。
- Windows 计划任务本轮查询仍为 Ready，NextRunTime=2026-09-16 03:00；尚无实际运行记录，不能视作到点验收通过。收费仍关闭。

待用户批准的纠错 revision：`6d313556018a19d5f815dd0187273f1ade4437ed4c051dff793ca048bd1eb707`，状态 pending，完整候选验证 0 错误，正式正文不变。替代结论限定为：给定 CI 模型、配置和输入的输出文本 / token ID 相等；测试没有比较 KV 张量，因此不能由它推出通用的逐位一致保证。旧结论保留在“已废弃的说法”，本轮源码读取标明新读取而非历史回执。

在实施目录只读查看：

```powershell
pnpm wiki:review show 6d313556018a19d5f815dd0187273f1ade4437ed4c051dff793ca048bd1eb707
```

完整 diff：`tools/wiki-runtime/prefix-claim-review.diff`。初稿 revision `453e5248…` 已由本轮补齐快照的提案替代并标 rejected，避免留两个待审入口；没有发布任何一个。

用户需要处理的当前事项是内容审阅和未知费用回执。人工判断不是再次授权普通代码修复；原有累计 $10 与不做大导入的约束持续有效。费用未核清前不运行真实前后问答；已经准备好的问题不为通过验收而临时换题。
