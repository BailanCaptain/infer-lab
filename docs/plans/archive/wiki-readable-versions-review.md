# 知识页可读性与问答接续（2026-09-17）

用户指出 profiling_chunk_config 页面反复使用短提交号，读者无法理解，并明确要求处理。正文现在使用 **main 开发主线（2026-08-29 源码快照）**、**v0.23 维护分支（2026-09-10 源码快照）**；标题为“动态切块配置（profiling_chunk_config）”。固定提交仍在来源原文中保留。这是阅读体验修复，技术结论未更改，无需重复申请已授权的编辑性修改。

## 版本依据与正式写入

[种子配置](../../../wiki/seeds/vllm-ascend.yaml) 已记录 main → 28bf3a2e、releases/v0.23.0 → 2c59ff10。本轮实际用本地 Git 核对提交日期和 origin 分支祖先关系：前者属于 main，后者为 origin/releases/v0.23.0 的当前本地 tip；没有将维护分支当作同名发布 tag。此前因区分分支与 tag 而删掉全部可读名称，属于过度修正。

编辑通过原有 revise / propose / approve 发布器：66ca6029… 发布名称修改，2d179f39… 清理重复词和多余说明。第一次额外添加两个 GitHub URL 导致来源分类 lint 拒绝，b40f17cc… 已 rejected；随后保持原 raw 来源和证据等级，只修改表述，没有降低校验门槛。两次正式编辑均依据本轮用户授权。

证据在 `tools/wiki-runtime/readable-versions-authorization.json`、`readable-versions-polish.json`、`readable-versions-publication-verification.json`。最后一个回执核对最终发布 manifest、正式 20 页、原 19 页逐字未变和 raw 哈希未变。旧 38cca26d… 发布回执及旧评测仍保留，不拿历史 manifest 校验新版本。

## 本轮验证

- `pnpm exec vitest run scripts/wiki/handbook.test.ts server/chat.test.ts server/citations.test.ts server/chat-route.test.ts`：4 文件 / 45 项通过，4.76s。
- `pnpm typecheck`、`pnpm lint` 通过；Lint 保留已有 CSS 1 warning / Biome 2 infos。
- `pnpm build` 通过，3.29s。
- 实际 Chromium 桌面阅读：中文标题与两个分支名称可见，正文不再出现两个短提交号，展开来源并请求 raw 返回 200，包含固定源码类，无页面异常。见 `readable-versions-browser.json`、`readable-versions-desktop.png`。
- 交接与 feature 文档检查：34 条 AC 无遗漏，111 个本地链接无断链，正式 20 页、schema 问题 0；回执 `readable-versions-doc-check.json`。

这轮没有前端布局修改；后半段修复了服务端问答输入与手册规则的冲突。阅读规则和问答规则统一维护在 [HANDBOOK](../../../wiki/HANDBOOK.md)，没有在某一道测试输入中塞标准答案。

## 真实问答修复验证

四题单独复测使用原 suite 的改写配置、读写映射、版本比较和槽位计算，模型 claude-sonnet-4-6、每题预留 $1 / 300 秒、独立只读快照、禁联网。知识版本 7b9cefacc435fedad68f74e356cd3afdcb7e8f94a8735d20110cbcd464e4e78f；记录在 `tools/wiki-runtime/eval-readable-versions/`。这是修改阅读规则后的修复验证，不能混入原六题知识积累前后对照。

已收到的答案表明：可读分支名称消除了本次版本题的混淆；改写配置题仍将“有 warning”概括为“静默”；读写题仍自编角标，且添加了未核对的“0 表示未使用”等旁支断言。核心知识覆盖与完整答案质量必须分别记录，不能按调用成功数计算正确率。

四题全部取得回执，费用共 $0.5042938，引用结构 2/4：改写配置与版本题通过结构检查，读写题和槽位题失败。槽位结果已一致为 898，但仍误用来源编号，并在隐藏覆盖说明中留下无绑定角标；因此不能把正确算数记成整题通过。

随后将普通问答规则明确为直接短答、页面链接、不机械展开四段，并单独复测读写与槽位两题，记录在 `tools/wiki-runtime/eval-page-links/`，知识版本 696a24cb311bddd99c5bf0c44f113b6231a4e7826e3bbb43e82740730690f623。费用 $0.3235637，引用结构 1/2：槽位题本次页面引用通过且核心计算一致为 898；读写题仍有未绑定角标，长回答仍未收敛。没有将这两轮合并成提高正确率的前后对照。

这已经说明仅追加提示不能证明问题已解决。检查实际冻结请求后发现：`buildChatRequest` 在用户消息里仍追加大量 sourceLinks，并指示模型复制编号；关系导航也重复规定文章结构，与新 Handbook 的问答规则冲突。最终修复只保留候选页链接和关系数据，回答方式由 Handbook 统一定义。源码角标仍在原知识页可查，严格校验器没有放宽，失败答案及回执没有改写。

该冲突用新增请求测试先红（1 failed / 19 passed）复现；修复后更新 HTTP 集成测试为新的页面链接契约，最终 4 文件 / 46 项通过（5.38s）；3 个服务文件使用继承项目规则的 Biome 检查并格式化通过；构建含 TypeScript 通过（3.28s）。日志为 `page-link-conflict-red.log`、`page-link-conflict-final-tests.log`、`page-link-server-lint.log`、`page-link-conflict-build.log`。

**最终程序输入冲突已通过工程回归修复，但尚无修改后的真实模型复测，不能声称问答质量已全过。** 当前调用次数 32/32，未静默扩大；累计预算占用 $13.2926551（包含历史未知预留），paused=false 但次数已耗尽，本轮六次新增占用 $0.8278575，无新增未知费用。保持累计 $29 上限和全部旧账目。

## 项目推进范围

当前具体工作是把固定来源整理成可读、可追溯的知识页，再用独立真实问答检验它能否帮助后续回答。正式库为 20 页，F001–F004 仍未完整验收。真实投喂、参数复核/补文、生产 gap 自动观察到关闭和维护判断仍有缺项。03:00 维护上次生产运行失败，修复后的生产回执尚未验证。

F001 全量灌种、F002 全量参数页、F003 全库语料按用户既有约束继续暂缓。保留 feat/llm-wiki 的所有未提交文件；没有提交、合并或部署网站。本轮无需用户再次审批页面名称或预算。
