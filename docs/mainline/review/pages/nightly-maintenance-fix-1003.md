# 夜间巡检崩溃修复（2026-10-03）

## 根因

- `wiki/params/weight-prefetch-config.md` 第 163 行有一条相对链接 `../../docs/mainline/02-forward.md#…`，归一化后是 `../docs/mainline/02-forward.md`，越出 `wiki/` 目录。
- `scripts/wiki/maintenance.ts:19` 的 `existsFile` 原本写成 `existsSync(localFile(root, "wiki/" + path))`。`localFile`（`scripts/wiki/review-files.ts:20`）是审阅写入的路径守卫，见到 `..` 段就 **抛** `非法审阅路径`。巡检把这个回调交给 `lintPages`，异常一路冒到 `patrol()`，再冒到 `scripts/wiki/sync.ts:173` 的夜间流水线——`progress("patrol")` 之后的 reconcile / drift / worker 全都没跑。
- 同一条链接单跑 `pnpm wiki:lint` 不崩：`scripts/wiki/lint.ts` 当时的 `existsFile` 是 `existsSync(join(wikiRoot, rel))`，`..` 只是解析到 `wiki/` 外、返回 false，报成 `broken-link`。两处行为不一致，就是崩与不崩的差别。
- 崩溃现场留在 `wiki/_jobs/sync/last-run.json`，报错原文为 `非法审阅路径：wiki/../docs/mainline/02-forward.md`。

## 测试（先红后绿）

- `scripts/wiki/maintenance.test.ts`：新用例 “reports a link that leaves wiki/ as a finding and keeps patrolling instead of throwing”。fixture 里放一条越界链接 + 一条普通死链，断言巡检返回 `link-outside-wiki` 问题且死链照常上报。修复前该用例抛 `非法审阅路径：wiki/../docs/mainline/02-forward.md`（红）。
- `scripts/wiki/lint.test.ts`：新用例 “link-outside-wiki：链接越出 wiki/ 就报，不看目标文件在不在”。除断言规则名外，还断言越界路径**不会**被传给 `existsFile`（记录回调实参），把「越界路径不进文件检查」这条约束钉住。修复前返回空数组（红）。

## 修法

1. `scripts/wiki/lint.ts`：新增导出 `wikiFileExists(wikiRoot)`，作为 `LintOptions.existsFile` 的唯一实现；`runLint`、`scripts/wiki/maintenance.ts`、`scripts/wiki/compile-raw.ts` 三个调用点都改用它。巡检不再把正文链接路径塞进 `localFile` 这个「写入守卫」。
2. `lintPages` 的链接检查里，`..` / `../…` 开头的目标先报新规则 `link-outside-wiki`（不在 `WARN_ONLY` 里，属阻塞级），不再走存在性检查。于是 lint 与巡检走同一条路：lint 报错退出，巡检记一条问题继续跑完。
3. 规则清单同步到 `docs/plans/llm-wiki-plan.md`（`broken-link` 条目下一行）。
4. 触发那次崩溃的链接已改链站内页，见 `weight-prefetch-config-review.md` 末行。

`localFile` 本身没动——它守的是审阅写入路径，抛错是它该做的事。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npx vitest run scripts/wiki/maintenance.test.ts scripts/wiki/lint.test.ts -t "leaves wiki\|link-outside-wiki"` | 修复前 2 failed；修复后 **2 passed** |
| `npx vitest run scripts/wiki`（全部工具单测） | 583 passed，1 failed：`scripts/wiki/params/scan.test.ts` 报 `Python AST 扫描失败…invalid syntax`，是本机 `python` 版本低于上游要求的 3.11+，与本次改动无关（该用例不碰 lint/巡检） |
| `pnpm typecheck` | 退出码 **0** |
| `pnpm lint`（biome） | 退出码 **0**（14 warnings / 2 infos 为既有，改动文件 0 条） |
| `pnpm wiki:lint` | 退出码 **0**，全站无报错（4 条 `mark-flood` 不阻塞提示属其他页） |
| `pnpm wiki:audit` | 退出码 **0**，139 页、3655 条来源，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0 |
| `pnpm wiki:patrol`（夜间巡检的单跑入口，指向本仓） | **跑完不崩**，输出报告路径与 4 条 `mark-flood`；退出码 1 是「有 findings 就非 0」的既定行为，不是异常。本次生成的 `wiki/warnings/patrol-2026-10-02.md` 属验证产物，已删除 |

## 限制

- `pnpm wiki:patrol` 只覆盖夜间流水线的 patrol 环节；`scripts/wiki/sync.ts` 的完整夜间任务含付费环节，没有 dry-run 入口，本轮未整跑。patrol 之后的环节能继续跑，依据是异常源已消除加上新用例，不是整跑实测。
- 新规则会把所有越界相对链接判成阻塞错误。全站当前只有这一条（`pnpm wiki:lint` 退出码 0 已证明），但今后若确需引用 `docs/` 的内容，得改成站内页或不带链接的表述。
