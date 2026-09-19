# LLM WIKI 审视（2026-09-19）

一次只读审视的结论与证据，对照两层判准：用户的原始理念 `llm-wiki.md`，以及本仓库 feature / plan 里定下的验收条件。当前交接与后续优先级见 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；这一页是它 §4 的明细，**写完即定稿，不逐轮更新**。行号是 2026-09-19 的。

**总判断**：机制基本按要求建起来了，但用户点名的几件事没落地，或落地方式与自己定的原则相反。四天内验收条件从 8 条涨到 34 条，代码约 2.2 万行（含测试），服务的是四十多页和 4 条 GitHub 语料。

## 1. 符合的

- 三层结构都在：`wiki/raw/`（不可变原料）、`wiki/concepts|params/`（知识库）、`wiki/HANDBOOK.md`（规则，六个 H2，`scripts/wiki/handbook.ts:9-16` 按节切给 agent）。
- `index.md` 程序派生，与磁盘文件一一对应，每项有链接、一句话摘要、章节号。
- `wiki:lint`、`wiki:diagrams --check`、typecheck 通过；`wiki:audit --seeds vllm-ascend-code.yaml` 无无效 commit / 缺文件 / 越界。
- 抽查 9 页：引用标记都指得回来源，无断链，无空壳页，relations 都带 kind 和 note。
- 安全约束落实：agent 只能写 `_drafts/` 与 `raw/` 下自己的文件（`ingest.ts:252-260`），全仓库无放开权限的旗标，检索单一入口（`retrieve.ts:145`）。

## 2. 走偏的

### P1

1. **「名词不懂就可以问」没落地。** 30 个课程术语（`src/sim/model/forwardLayer.ts` 的 `Step.terms`）当时 0 个有页；`<Term>` 悬停卡只在 `WikiPage.tsx` 用了一处，课程正文没接。（之后补了 3 页试点，见交接。）
2. **「agent 写、人只审」被绕开。** 2026-09-19 的 24 个概念页手写后直接放进 `concepts/`，没走 `wiki:review`，没有 raw，`log.md` 无记录，旧页没有一页回头链接它们。
3. **理念里的操作没做到或变了形。**
   - 来源摘要页：`wiki/sources/` 是空目录。
   - 问答回填：`log.md` 只有 ingest / review / build 三类，格式规则也只接受这三类（HANDBOOK「Lint」切片的 `log-format`）；真实发生过的提问和补写在 log 里看不到。
   - lint 的矛盾检测、过期检测、交叉审视只存在于代码里：`wiki/sync.config.json` 的 `maxTasks`、`reconcileBatches`、`driftSample` 全是 0，从未在生产跑过。
4. **夜间维护空转。** `wiki/_jobs/sync/last-run.json` 为 `deferred`：待生成参数页 14 个 > 每晚上限 3，整批暂缓、检查点不推进，每晚重复。同步用的 Python 指向 `.cache/codex-runtimes/...`，是别的工具的私有目录。
5. **知识已过期但没人知道。** `wiki:stale` 报 31 页引用的上游代码已变（main 28bf3a2e → e139b7d57），任何文档都没提。
6. **引用检查有漏洞。** `src/content/wiki/retrieve.ts` 的 `UNCOVERED` 正则：回答里出现「知识库里还没有」「尚未收录」等字样，整篇就判 `cited: true`。F001 AC7 要的是把这类回答标成未收录。
7. **缺口发现与验收条件不符。** F004 AC3 要独立评判 agent；实际是回答模型在末尾自报 `satisfied`（`server/coverage.ts:5`），同文件 `:9` 的注释自己承认这不是 AC3 要的那个判定。
8. **大量内容不在 git 里**（当时 302 条未提交，已由 `c815492` 保底提交解决）。

### P2

- **状态真相源有 5 种说法**：`F001:44`、`PLAN.md:313` 说 feature；`README.md:31`、`docs/plans/README.md:29` 说 HANDOFF；`HANDOFF.md:21` 还把问题台账算进去；`knowledge-loop-plan.md:8,240` 说收尾报告（已被撤回）。自称唯一真相源的 feature 验收表反而最旧，停在 09-16，仍写「正式页 20」（`F001:51`）。
- **F001 AC11 与 HANDBOOK 直接矛盾**：`F001:72` 仍要求 mermaid 与 `diagram-identifier`；`HANDBOOK.md:88` 已弃用 mermaid。同一行写「18 张」存量 mermaid，实测 12 处分布在 11 页。
- **HANDBOOK 内部不自洽**：写「七节」实列六节（`:52`）；`:318` 仍按七节讲；`:326` 把「少于三节」列为拒收条件；`:287` 要求事实表「不写解释句」而 `:96-98` 要求第三列写「意味着什么」；`:283` 给出无编号 `[S]`/`[C]` 写法而 `:213` 要求必须带编号；`:436` 的目录清单缺 `params/`、`diagrams/`。
- **规则散在三处**：页型、证据档、关系类型、必需小节在 HANDBOOK、`src/content/wiki/schema.ts:27-32,97`、`scripts/wiki/lint.ts:80-107` 各定义一遍，与「HANDBOOK 唯一真相源」（F001 AC1）不符。
- **`related` 残留**：`F001:76` 已改为 `relations`，但 `F001:66,73`、`HANDBOOK.md:137,294,399`、schema 里仍有 `related` / `prerequisites`。
- **`F004:69` 引用了不存在的 HANDBOOK「投喂」切片**，规则实际硬编码在 `drop.ts`。
- **`CLAUDE.md` 与 `AGENTS.md` 逐字相同**，违反自己的「单一真相源」。
- **成本数字三套**：`F001:126` 写试点 $28；`HANDOFF.md:72` 写同一批 $36.77 + $7.48；批量灌种估价一处 $300、一处 $660。
- **`wiki:audit` 用默认 seeds 会失败**（未知仓库 57 处）：三份 seeds 的仓库表互不包含。
- **`wiki:gaps` 噪声大**：把 `false`、`enabled`、`AI`、`LLM`、`ValueError`、`TD` 当待补概念，淹没了真正该补的 TP、MLA、GQA、CANN。
- **内容小问题**：注意力后端有的页写四个（`one-request.md:55`）有的写五个（`attention-backend-family.md:35`），未对照源码；4 KiB / 112 KiB / 14 MiB 的推导在三页重复；5 页无入链但 lint 查不出（带了 chapters 就不算孤儿）；`_drafts/profiling-chunk-config.md` 过期草稿未清；`_gaps.json` 里的缺口已补写但没标关闭。
- **`docs/plans/` 下约 29 份逐轮 review 报告**，多数以「后续状态见……」互相指来指去，各自重复预算、页数声明。

## 3. 验收条件逐条核对（对代码，不对文档自述）

判定：a 真实实现并测试；b 只用桩 / 固定输出验证；c 部分实现；d 未执行；e 与 AC 文本不符。

| Feature | a | b | c | d | e（含混合） | 备注 |
|---|---|---|---|---|---|---|
| F001（12 条） | AC2、AC10、AC12 | AC3 | AC4、AC6、AC9 | AC5 | AC1、AC7、AC8、AC11 | AC7 的未引用提示文案与 AC 不同；AC8 的 PR 获取从 git fetch 改成了 GitHub API；AC10 实现是内存关键词打分，不是 AC 写的 index + grep |
| F002（6 条） | AC3 | AC2 | AC1、AC4、AC6 | — | AC5 | 扫描产物 `params-<ref>.json` 不在仓库里；全量骨架未生成 |
| F003（7 条） | — | AC2 | AC4、AC6 | AC1 | — | AC3、AC5、AC7 未核；语料实际 2 issue + 2 PR；无向量检索，与既定决策一致 |
| F004（9 条） | AC5、AC9 | AC2、AC6、AC8 | AC4 | — | AC1、AC3 | AC7 介于 a/b；AC6、AC8 在每日任务里被关掉 |

**固定模型输出的测试只证明机制能跑**，不能证明页面够多、术语能问、真实问答和夜间维护跑通。

## 4. 规模

| 位置 | 文件数 | 行数（含测试） |
|---|---|---|
| `scripts/wiki/` | 116（55 个测试） | 约 14,500 |
| `scripts/wiki-*.ts` CLI | 约 30 | 约 2,300 |
| `server/` | 28（13 个测试） | 约 3,400 |
| `src/content/wiki/` | 18（7 个测试） | 约 1,900 |

外围机制（预算账本、任务租约、发布登记、复测、修订、覆盖诊断）已经比内容本身重得多；F004 明说不搬 Multi-Agent 的租约机制，但排他写入、恢复清单、预算账本各自又实现了一遍。粗查未被生产代码引用的模块：`scripts/wiki/eval-call.ts`。

## 5. 未核实的

- `wiki-*-review.md` 多数只读了标题和 grep 命中的行；`llm-wiki-plan.md` 第 56–2125 行只看了结构。
- 24 个手写页与 19 个旧页的正文均未逐句对照源码做语义复核；行号属实不等于结论正确。
- 真实问答质量：本次审视没有发起任何付费调用。
