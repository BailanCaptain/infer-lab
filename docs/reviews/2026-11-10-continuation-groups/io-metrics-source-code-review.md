# IO / Metrics 来源规则独立代码审查

结论：通过，未发现 P1/P2 或需修订的问题。审查以 `.tmp/continuation-groups-2026-11-10/io-metrics-source-before.zip` 的 3 文件为基线，对照当前文件完整 diff；未修改代码、教学页或总账。

1. **范围正确。** `scripts/wiki/sources.ts` 仅新增 IBM TerraTorch 3 个文件与 Prometheus 3 个文件的完整、带固定提交的 `path` 条目，全部为 `ecosystem`。未增加组织、仓库或目录级前缀，也没有修改 `classifySource`、`supportsOfficialEvidence` 或既有条目。既有匹配顺序和所有旧来源规则不变。
2. **匹配与等级正确。** 当前匹配器先用 hostname 全等，再用 pathname 全等；新增六项不开放同目录其他文件、`.bak`、子路径、`main`、fork 或伪装域。行号 fragment 不参与路径匹配，允许引用同一固定文件的已核范围。生态分类可引但不单独支持 S；`lint.ts` 283–296、614 起的实际消费者继续沿用这一规则。
3. **规则表一致。** `wiki/HANDBOOK.md` 只追加相应六行，文件、提交、分类与代码逐项一致；Prometheus functions 行明确是已核查询范围而非全文阅读，TerraTorch 行没有声称 NPU 部署验证。原表和后续规则未改。
4. **验证有效。** 新增的 `it.each` 展开为 6 个用例，覆盖允许固定文件、拒绝相邻/后缀文件、子路径、分支与伪装域，并检查生态来源不支持 S。已读作者红日志，实际为 6 failed / 51 passed，六项都因 `unlisted` 未放行而失败；已读作者绿日志，来源与相关 Lint 共 116 passed。本独审实际另跑 `pnpm exec vitest run scripts/wiki/sources.test.ts`，57 / 57 passed，退出 0；`pnpm exec biome check scripts/wiki/sources.ts scripts/wiki/sources.test.ts` 退出 0，2 files，No fixes applied。现有 Vite 未来 native config loader 提示仍出现，不是测试失败，本次未调整它。

代码部分读取并应用 Ponytail full 与 i-have-adhd；按项目 AGENTS.md，它们只用于这次代码审查，后续纯文档阅读不延续该模式。没有通过删验证、放宽断言或扩大来源范围制造通过。

未重复运行全站构建与教学验收，由根统一进行；本结论只确认这六个文件的来源登记范围和相关测试，不代替各文件内容的语义审查或外部部署实测。未解决问题：无。
