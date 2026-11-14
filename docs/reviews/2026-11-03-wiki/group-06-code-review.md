# 参数身份与版本谱系修复独立复审

复审日期：2026-11-03。审查者：`review_publication_fix`。本报告只审查代码，没有修改实现或测试。基线为本轮开始保存的 `.tmp/wiki-remediation-2026-11-03/before.zip`；未以 Git HEAD 覆盖既有修改。

## 范围

本次完整阅读 `scripts/wiki/params/scan.py`、`scan.ts`、`provenance.ts`、`pages.ts`、`publish-sync.ts`、`scripts/wiki/lineage-git.ts`、`lineage.ts`、`scripts/wiki-build-param-pages.ts`、`scripts/wiki-lineage.ts`、`scripts/wiki-lineage-apply.ts`，并阅读相应扫描、谱系和来源恢复测试。结合 `git.ts` 与当前正式参数页核对真实调用者。

重点核查：旧构造器接收嵌套用户字典时的字段身份；同名 `size` 是否被限定到文件及 `KVPPConfig`；增量同步、手动生成及批量刷新能否保持该限定；固定来源是否能唯一恢复定义；人工页是否使批处理回归。

## 发现

### P2：人工参数页没有自动定义表时，批量谱系刷新整批中断（已关闭）

- 位置：`scripts/wiki-lineage-apply.ts:59` 对每个 `type: param` 页面传入 `--page`；`scripts/wiki/params/provenance.ts:13` 在没有自动定义小节时返回 `undefined`；`scripts/wiki-lineage.ts:42` 随后抛错。
- 实际输入：`wiki/params/profiling-chunk-config.md` 是正式 `type: param` 页面，当前没有 `## 参数定义（自动生成）` 小节。其教学正文与其他固定来源均存在。
- 复现：`node --import tsx scripts/wiki-lineage.ts profiling_chunk_config --seeds wiki/seeds/params-removed.yaml --page wiki/params/profiling-chunk-config.md --out .tmp/wiki-remediation-2026-11-03/review-profiling-lineage.json`。
- 结果：退出码 `1`，错误为“页面没有匹配的固定参数定义，未重算谱系”。`lineage:apply` 的 `publishLineage` 在循环结束后执行，因此此页使本批已计算更新也无法发布。
- 建议：对缺少可恢复固定定义的人工页明确跳过并报告文件名，保留其正文及现有谱系；不要退回按标题全库检索。或者先为该页接入经过核验的精确定义。覆盖此类现有人工页的批量 CLI 回归应包含成功处理的参数页与被跳过的人工页。
- 修复复验：当前 `scripts/wiki-lineage-apply.ts:46` 在调用子 CLI 前检查自动定义小节，缺失时打印具体路径并跳过；损坏的自动表仍进入 `parameterDefinition` 校验并报错，没有回退全库同名搜索。人工页不进入更新集合。
- 回归证据：已完整阅读 `scripts/wiki/lineage-apply.test.ts:12` 的混合页面真实 CLI 测试，它断言人工页逐字保留、stderr 报告跳过，且另一生成页得到 `ExampleConfig.limit` 的限定谱系。主任务留下的 `manual-lineage-red.txt` 记录修复前此测试因 CLI 退出 `1` 失败；`manual-lineage-green.txt` 记录修复后相关 3 文件、10 测试全部通过。本复审核对了测试实现和这两份实际日志，没有把主任务运行冒称为独立重复运行。

## 已验证的行为

1. 实际对全部 33 个 `wiki/params/*.md` 调用 `parameterDefinition`，读取自动表中的固定 Git 来源并重新解析 AST。32 页成功恢复；唯一未恢复的是上述没有自动表的人工页。未出现其他引用序号、路径或行号不一致。
2. `prefetch_ratio` 恢复为 `WeightPrefetchConfig` 的字段，路径为 `additional_config["weight_prefetch_config"]["prefetch_ratio"]`；`size` 恢复为 `KVPPConfig.size`，未误选同文件或其他文件中的同名字段。
3. 实际运行：`node --import tsx scripts/wiki-lineage.ts size --seeds wiki/seeds/params-removed.yaml --page wiki/params/size-40a1c2ca47b8.md --refs baa023ad,2c59ff10,2ed6cbba,7d825229 --out .tmp/wiki-remediation-2026-11-03/review-size-lineage.json`，退出码 `0`。四个固定版本依次返回有、无、无、有；输出明确限定到 `vllm_ascend/ascend_config.py` 的 `KVPPConfig.size`，不输出无关 `size` 的 PR、tag 或文本事件。
4. 阅读确认静态增量同步的新增／更新与删除路径，以及手动参数生成，都将扫描所得 `entry.file`、`entry.class` 传入精确字段模式。该模式只查询所选固定提交的 AST 字段存在性，不把它提升为用户可写或运行时可用保证。
5. 固定来源恢复以自动表的 C 引用、固定提交、文件和行号为基础，再校对标题中的参数名；源码仅被 AST 解析，未导入或执行。当前错配来源测试会拒绝恢复，而不是猜选同名字段。

上述 P2 已按实际修复和回归证据关闭，本次范围内没有剩余已确认 P1/P2。另核对了 `wiki/HANDBOOK.md:247` 与 CLI 注释，已明确区分字段定义、同名文本调查和运行时可用性。此结论不等于全库代码审计。完整测试、类型检查和构建由主任务统一执行；本复审未重复运行全套测试，也未执行会重写正式页的整站 `lineage:apply`。

## 最终增量：跨批同步测试断言

已完整阅读当前 `scripts/wiki/params/sync-cli.test.ts`，并对照 `before.zip` 的实际 diff。第 93–99 行不再要求字段谱系包含提交标题中的 `#7`，改为逐页断言 `ExampleConfig` 中的目标字段、`main` 对应精确 `tip` 的版本行，以及没有无根据的 `#7`。这与精确字段模式只给固定提交的定义存在性、暂不推断引入 PR 的行为一致，未修改实现来迎合测试。

跨批保护仍在：第一批新增 2 页并暂缓 1 页、第二批新增 1 页且合计 3 页、第三次无变化；新页只能出现在草稿目录，正式目录仍空；其他用例继续检查成功回执、变更日志、检查点以及上限为零时不推进检查点且继续巡检。没有删除这些实际保护。

核对主任务实际日志：`sync-cli-investigate.txt` 明确记录旧 `toContain("#7")` 在字段模式输出上失败；`sync-cli-accepted.txt` 记录修订后该文件 3 个测试通过。未独立重复运行这一组测试。此增量无新增 P1/P2。
