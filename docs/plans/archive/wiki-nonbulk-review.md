# LLM WIKI 非批量收尾报告

> 历史记录：独立复查撤回了本页“维护闭环已接通”的过早结论。原测试存在手动拼接整合及跳过校验器的问题；后续修复与实际验收以 [独立审视后的交接报告](wiki-independent-closure-review.md) 和四个 feature 的当前表为准。本页命令仅为当时证据。

2026-09-16。实施目录：`C:/Users/-/Desktop/infra-view-new-llm-wiki`，分支 `feat/llm-wiki`，基线 HEAD `8175224`。本轮保留原有未提交改动，没有提交、合并或大规模导入。外层理念仍是主工作区 `C:/Users/-/Desktop/infra-view-new/llm-wiki.md`；原文件未改。

**结论：方向符合，非批量工程入口和维护闭环已接通；真实模型完整验收尚未通过，不能宣称“完美验收”或四个 feature 全部完成。** 真实 PR 编译超时、费用未知，已停止收费。持续积累的是可审查的 Markdown、来源和关系，不是训练模型或部署推理服务。

## 符合要求的

四个 feature 的验收状态只维护在 [F001](../features/F001-llm-wiki.md#2026-09-16-当前验收核对)、[F002](../features/F002-param-lineage.md#2026-09-16-当前验收核对)、[F003](../features/F003-github-corpus.md#2026-09-16-当前验收核对)、[F004](../features/F004-knowledge-loop.md#2026-09-16-当前验收核对)，共 34 条 AC。本报告集中留证据，不再维护另一个完成百分比。F003 和 F004 的 [plan](github-corpus-plan.md)、[plan](knowledge-loop-plan.md) 已经存在并已用于实施。

| 范围 | 本轮工程交付 | 可复核位置 |
|---|---|---|
| F001 读者与问答 | 来源角标、投喂视觉区分、回答后的实际相关页、PR ingest 入口；图中类/函数按引用 commit 核对 | `src/app/pages/WikiPage.tsx`、`server/related-reading.ts`、`scripts/wiki/diagram-audit.ts`、`scripts/wiki-pr-ingest.ts`；浏览器 29 项通过 |
| F002 参数与谱系 | AST 扫描、疑似项三态复核、零模型骨架、保护生成区、选择性补正文、新增/删除/修改增量；真实静态谱系 | `scripts/wiki/params/scan.py:8`、`scripts/wiki/params/publish-sync.ts:15`、`scripts/wiki/lineage-git.ts:26`；真实扫描与 Git CLI 证据见下 |
| F003 社区语料 | 分页续传、更新与评论删除核对、错误分类、报错片段检索、issue→PR→commit→ref、文档版本映射、重要 PR 排队 | `scripts/wiki/sync-github.ts:143`、`src/content/wiki/corpus-retrieve.ts`、`scripts/wiki/corpus-trace.ts:26`；真实小样本，不代表全库 |
| F004 持续积累 | 投喂与隔离、缺口队列、有限源码补料、受限编译、统一人审、独立前后复测、巡检、交叉审视、差异重写队列 | `scripts/wiki/drop.ts:62`、`scripts/wiki/worker.ts:23`、`scripts/wiki/retest.ts:51`、`scripts/wiki/reconcile.ts:40` |
| 共用底座 | 跨入口预算、未知费用暂停、重复调用隔离、并发写入保护、唯一周期维护入口 | `scripts/wiki/budget.ts`、`scripts/wiki/workflow.ts`、`scripts/wiki/queue.ts`、`scripts/wiki/sync.ts:122` |

“越用越聪明”的工程路径是：重复缺口 → 区分缺知识/漏检/过期/拿不准 → 有来源的补料 → 草稿 → 跨页审视与人审 → 发布新知识版本 → 新会话复用 → 按冻结判准复核。诊断理由不传作事实，模型不自动晋升，未通过语义复核不关闭；已关闭的缺口再出现三次会开启新轮次。`worker.test.ts` 用独立前后四题验证了全流程，并确认“仍回答未收录”时缺口保持开放；这是机制证据，不能替代真实回答改善证据。

### 实际命令和结果

所有命令在上述实施目录运行。原始输出在被忽略的 `tools/wiki-runtime/`，以下摘要可在清理日志后按命令复现。

| 验证 | 关键输出 / 范围 | 原始输出 |
|---|---|---|
| `pnpm check` | 最终 **90 files / 624 tests passed (96.74s)**；typecheck、lint、依赖、内容、Wiki lint 通过。早期 627 项包含已退役启发式引擎的 6 项测试；替换为真实 Git / CLI / 并发保护回归后以本次数量为准 | `nonbulk-check-closure.log` |
| `pnpm exec vitest run scripts/wiki/params/sync-cli.test.ts` | 1 passed；真实 Git + 真实 CLI：新增 1 / 删除 1 / 变更 1，第二次 changed=false，没有模型调用 | `nonbulk-sync-cli.log` |
| `pnpm build` | 最终生产构建成功，`built in 2.19s` | `nonbulk-build-closure.log` |
| `pnpm exec playwright test tests/wiki.spec.ts tests/wiki-reader.spec.ts tests/wiki-review.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts` | 最终 **29 passed (44.5s)**；操作了来源角标、相关页跳转、保存/批准/驳回/冲突、离线缓存、证据来源。问答模型输出固定，不冒充真实模型验收 | `nonbulk-browser-closure2.log` |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | **19 页，410 来源；403 行号有效；无效 commit、缺文件、越界、未知仓库均 0；107 raw 引用待核对**。该命令不联网，7 URL 随后单独打开验证，见下 | `nonbulk-audit-closure.log` |
| `pnpm wiki:lineage:apply --seeds wiki/seeds/params-removed.yaml` | 刷新 **8 个现有参数页** 的生成谱系节，保留正文；没有新建参数页 | `nonbulk-lineage-refresh.log` |
| `pnpm wiki:build` 连续两次 | 重建前、第一次、第二次的 index / registry SHA256 均相同，`unchangedAcrossBothBuilds=True` | `nonbulk-build-idempotence.log` |
| `pnpm wiki:scan-params --ref main --out tools/wiki-runtime/params-main-final.json` | pin=`28bf3a2e8e8db396ee5dcfa6812626eee2d394ab`；**542 候选 / 405 suspect**。候选不是全部确认参数，没有生成全量页 | `nonbulk-real-scan-final.log` |
| `pnpm wiki:sync-github --numbers '15981,15815,11953'` | fetched=3、changed=3；累计本地 **2 issue / 2 PR**。此前同一 2 条样本重复采集 changed=0；未推进全库检查点 | `nonbulk-github-chain-fetch.log`、`nonbulk-github-live-repeat.log` |
| `pnpm wiki:trace --issue 15815` | issue #15815 → PR #15981 → `87c345c13d3b259fac8761d68381bd91df6906aa` → `origin/releases/v0.26.0rc`；tags=[]，没有虚构发布 tag | `nonbulk-github-chain.log` |
| 无效 token 的真实小样本同步 | `GitHub auth (401)`，失败日志保留，检查点不推进；不记录 token 值 | `nonbulk-github-auth.log` |
| 固定 10 条真实 traceback | 在 **30 条真实 issue** 候选内，**Top-1 9/10，Top-5 9/10，无匹配对照 0**。算法先于样本评分实现，未按结果筛样；不能外推全量命中率 | `github-trace-eval.json`；可重复测试 `scripts/wiki/trace-eval.test.ts`，固定样本 `trace-eval-suite.json` |
| 10 条真实含文档链接 issue | 12 链接全部解析出版本/路径，9 映射本地文件；3 因本地无相应版本 ref 明确失败原因。版本不符不回退成当前版本 | `github-docs-eval.json` |

实际谱系命令：

```powershell
pnpm wiki:lineage layer_sharding --refs 'releases/v0.13.0,releases/v0.18.0,releases/v0.23.0,releases/v0.24.0rc,releases/v0.25.1rc,releases/v0.26.0rc,releases/v0.27.1rc,main' --paths '*.py' --out wiki/lineage/layer_sharding.json
```

本轮实际得到 **8 / 9 / 14 / 0 / 0 / 1 / 0 / 0**，与 F002 原判准相符。移除提交 `896012151dbaaa444e940f19106fde877d616dc9` / PR #11953，包含该提交的 tags 为 `v0.24.0rc1`、`v0.25.1rc1`、`v0.26.0rc1`。v0.26.0rc 的一处仅表示文本重新出现，不能声称运行时功能恢复。JSON 明确保存搜索路径与完整 commit；限定 `vllm_ascend/` 的文件数较少，不能与全仓 `*.py` 口径混比。8 页刷新后已再次以此命令保存全 Python 范围的验收 JSON。证据：`nonbulk-lineage-closure.log`、`wiki/lineage/layer_sharding.json`。

7 个 frontmatter 网页来源在 2026-09-16 单独通过网页工具打开，均返回对应页面标题和正文：[KV Cache CPU Offload](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_cache_cpu_offload.html)、[DeepSeek-V3.2-Exp](https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp)、[KV Pool](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html)、[Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)、[Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B)、[AOL 算子加速库](https://www.hiascend.com/developer/techArticles/20240729-1)、[v0.23.0 Weight Prefetch](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/weight_prefetch.html)。这是当前可访问性证据；`latest` 页面会变化，不证明正文的全部历史结论，也没有把在线新文本覆盖成旧 raw 记录。

Windows 任务 `LLM-Wiki-infra-view-new-llm-wiki` 已实际注册，查询状态 **Ready**，每日 **03:00** 调用本项目 `scripts/wiki-sync.ts`，工作目录为本实施目录。唯一配置是 `wiki/sync.config.json`：收费阶段均为 0；每个 repo/ref 新增骨架上限 3；GitHub 没有全量检查点时不会启动首拉。注册证据：`nonbulk-schedule-install.log`、`nonbulk-schedule-verified.json`。**尚未等待实际到点运行**，注册成功不当作整夜运行成功。

## 走偏或未通过的

以下问题已按可复现证据处理；真实结果和遗留边界单列，不通过修改验收口径制造完成。

| 级别 / 位置 | 影响与复现 | 本轮结果 |
|---|---|---|
| P2：`scripts/wiki/sources.ts:49` | 官方 GitHub 组织里的 issue/PR 原被归为官方文档；I 级关系页走完整批准竟被要求升 S。`sources.test.ts` 新例期望 community，旧实现实际 official | **修复**：社区单独分类，不凭域名支持 S；完整关系批准、派生反向边、再次不重复共 17 项相关测试通过，见 `nonbulk-community-red.log` / `green.log` |
| P2：`scripts/wiki-stale.ts` | `origin/main` 不存在时吞 Git 错误并显示“都没变”。真实 CLI fixture 旧实现退出 0 | **修复**：读取失败非零，保留未验证状态。`stale-cli.test.ts` 红转绿 |
| P2：`scripts/wiki/lineage-git.ts:26` | 本地 main 留在 pin、origin/main 已删除字段时，优先本地 main 会误报仍存在 | **修复**：受跟踪分支优先；显式 SHA 保持钉定。真实 Git fixture 红转绿，`nonbulk-lineage-pin-red.log`、`nonbulk-lineage-green.log` |
| P2：`scripts/wiki/lineage-publish.ts:9` | 计算期间编辑第二页，旧写法覆盖新文本且已先改第一页 | **修复**：持共享锁、整批先核对原文、任何变化整批拒绝；回归确认两页原文均保留，`nonbulk-lineage-publish-red.log`、`nonbulk-lineage-green.log` |
| P2：`scripts/wiki/integration-check.ts` | 批准副本没有 seeds，直接 lint 会拿空仓库映射误判真实图中类不存在 | **修复**：同一符号检查接收批准包的钉定仓库映射，移除重复检查；`diagram-cli.test.ts` 验真实 lint 和批准副本 |
| P2：`scripts/wiki/retest.ts:81` | 未加锁的“是否已有回执→开始调用”存在双收费窗口 | **修复**：独立调用先持锁认领；同题并发第二次被阻塞；回执、计划 hash 与知识版本都核对 |
| P2：`scripts/wiki/params/scan.py:8` | 普通运行时 dataclass 被收进参数清单；同名配置类跨文件会串 json_path | **修复**：仅配置形态候选、按模块区分嵌套类；四种形态及跨模块回归，真实重新扫描仍 542/405 |
| P2：`scripts/wiki/pr-material.ts` | 实际 PR #11953 的当前 API patch 合计 225657 字符，不能直接当作原合并提交的准确差异或无界塞入模型 | **修复**：已合并 PR 优先本地完整 SHA 与第一父提交 diff；明确所选与未提供文件，超出上下文就报错；fixture 保证晚期 API 差异不进入钉定差异 |
| P2：真实 PR 编译 / 费用 | `wiki:work run --task 026efb56… --job-budget-usd 0.15 --attempt-budget-usd 0.15 --max-attempts 1`：`timeout 60000ms`，没有费用回执 | **尚未通过**：没有成功草稿，未知费用保留预留并全局暂停。worker 已支持明确超时配置，未付费重试，不能声称已解决真实模型超时 |
| P3：新同步日志格式 | GitHub 新日志使用点分隔，`wiki:lint` 报 3 条 log-format | **修复**：共用 `scripts/wiki/log.ts`，修正本轮三条日志，失败日志也符合契约 |

**费用状态：** `pnpm wiki:budget status` 显示账本 **$8.9027865**、paused=true，包含历史 $0.50 和本次 $0.15 未知费用预留；**不是最终实际账单**。本次调用 ID `76128abc-ee51-43ce-aac7-ece041eec60a`，2026-09-15T16:55:14.211Z 开始，16:56:14.629Z 结束。账面余额 $1.0972135 也不能当作可继续消费授权，因为未知费用尚未核对。没有清零任务、替换 job 或更换账户重试。证据：`nonbulk-real-pr-compile.log`、本机 `wiki/_jobs/budget/account.json`。

**仍未验证：** 新实现的真实参数三态复核、真实参数补正文、真实 PR 草稿、真实周期审视和严格独立前后回答效果。历史真实调用见 [知识积累验收](knowledge-loop-review.md)、[分类验收](wiki-classification-review.md)，有成功积累与复用，也有范围外推和版本边界失败；本轮没有把这些失败抹成通过。107 旧 raw 引用的原始对应记录与全部正文的语义重审仍未完成；当前可定位的源码不能还原原 agent 当时究竟读了什么。全量参数骨架、120–160 页灌种、GitHub 全库导入按用户要求排除。

## 可优化的与取舍

| 收益排序 | 优化点 | 为什么值得做 / 当前边界 |
|---|---|---|
| 1 | 核对实际账单后补真实独立验收 | 当前最大不确定性是事实与版本判断，不是更多代码或页面。先确认未知费，再运行冻结题的前后对照；现在不继续收费 |
| 2 | 整理 107 条历史 raw 引用并抽查正文语义 | 403 个有效行号只证明地址存在；这项能直接提升读者可追溯性。不得用重新复制源码伪装成原 agent 已读过 |
| 3 | 在有完整采集授权后扩大检索验证样本 | 9/10 来自 30 条小语料；全量引入同错多 issue 后排序可能改变。先留可比较基线，不在无证据时添加向量检索 |
| 4 | 观察首次定时运行，再决定收费维护频率 | 当前每项有检查点和预算保护，但尚无到点运行证据；收费默认关闭，避免后台调用吞掉用户限额 |

单一真相源已收拢：人读协议在 HANDBOOK，机器形状在共用 schema；四个 feature 管验收，plan 管实施依据；`lineage-git.ts` 是唯一谱系计算与渲染实现，旧启发式引擎及其假设型测试已被真实 Git 回归替代；`lineage.ts` 仅保留生成区保护与 PR 标题解析。index、registry、backlinks 从正式 Markdown 派生，不手写反向关系。队列记录“要处理什么”，job/attempt 记录“实际怎么运行”，两者不是重复维护一份知识。

**需要用户决定或补充的只有外部验收前提：真实费用回执的核对结果。** 当前没有待确认的架构分岔，也不要求批准大规模导入。模型草稿未来仍须按产品的人审流程确认；本轮失败 PR 没有可批准草稿。

## 最终收拢复验

8 页谱系刷新及代码收拢后，`pnpm check`、生产构建、本地来源审计和全部 29 项相关浏览器测试通过；两次派生重建哈希不变，`git diff --check` 无空白错误（Git 提示部分既有文件未来将 CRLF 转 LF）。最后只整理文档，不再修改实现或正式知识正文。

首次收拢浏览器运行是 28 passed / 1 failed：`wiki-review.spec.ts:156` 等待更新提示期间发生了页面重新导航，聊天抽屉关闭。该轮同时执行了派生文件重建，存在开发服务器热更新干扰；日志与 trace 分别留在 `nonbulk-browser-closure.log`、`nonbulk-browser-interference-trace.zip`。停止文件写入后，**不改实现、不改断言、不增加重试配置**，同一条 29 项命令全部通过。保留第一次失败，不将其隐去；这不是对无关并发热更新行为的完整诊断。

Lint 仍提示既有 Biome schema / 废弃配置和 CSS specificity 警告，Vite 提示既有省略扩展名的 import；均未以关闭检查方式处理。浏览器无后端场景的代理连接拒绝由用例验证，不能解读为真实问答服务运行成功。

最终账本仍为 paused=true、$8.9027865（含未知费用预留），Windows 任务仍为 Ready。工程可用与真实质量分别交付，尚未验证项不勾选。非批量代码没有剩余待确认的架构选择；外部费用和原始历史证据无法通过本轮继续编写代码补齐。
