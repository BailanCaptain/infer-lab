# LLM WIKI 交接

> 更新于 2026-09-20。这一页只写「现在在哪、接下来做什么、哪里会踩坑」。
> 会变的数字不抄在这里——用下面的命令现查。2026-09-19 之前的逐轮流水账在 [归档](docs/plans/handoff-archive-2026-09-19.md)。

## 1. 从哪开始

- **目录**：`C:/Users/-/Desktop/infra-view-new-llm-wiki`，分支 `feat/llm-wiki`。用户默认打开的 `infra-view-new` 是 `main`，**不是 Wiki 的现状，不要在那边重做**。
- **出发点**：`C:/Users/-/Desktop/infra-view-new/llm-wiki.md`（用户拿来的原始理念，只读）。规则唯一真相源是 [wiki/HANDBOOK.md](wiki/HANDBOOK.md)；验收条件在 `docs/features/F001–F004`。
- **本机数据不在 git 里**：`tools/repos/`（源码语料）、`tools/corpus/`、`tools/wiki-runtime/`、`wiki/_jobs/budget/`、`wiki/_jobs/sync/`。换机器要 `pnpm wiki:clone` 重建，账本和回执带不走。
- **起服务**（阅读页的问答 / 审阅 / 刷新都靠后端）：

  ```bash
  pnpm dev:server   # 后端 8790
  pnpm dev          # 前端，带 /api 代理
  ```

  只开静态预览、不起后端，面板会提示「连不上问答服务」。

## 2. 现查状态

| 想知道 | 命令 |
|---|---|
| 多少页、各类型多少 | `pnpm wiki:build`（看输出）或读 `src/content/wiki/registry.json` |
| 有没有待审包 | `pnpm wiki:review list`，或阅读页右侧面板「审阅」页签上的数字 |
| 预算、夜间维护、会不会自己花钱、缺哪些术语 | 阅读页右侧面板「状态」页签（只读，数据来自 `GET /api/wiki/status`，`server/status.ts`） |
| 预算明细 | `pnpm wiki:budget status` |
| 哪些页引用的上游代码变了 | `pnpm wiki:stale --seeds wiki/seeds/vllm-ascend-code.yaml`（不加 `--fetch` 就是只读） |
| 引用行号是否属实 | `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend-code.yaml`（**必须用这份 seeds**，见 §5） |
| 30 个课程术语哪些还没页 | `pnpm wiki:lint --terms` |
| 夜间维护上次结果 | `wiki/_jobs/sync/last-run.json` |

## 3. 方向（2026-09-19 审视后与用户对齐）

审视结论（明细见 [2026-09-19 审视](docs/plans/wiki-audit-2026-09-19.md)）：**机制过度建设，内容停在试点。** 四天里验收条件从 8 条涨到 34 条，代码约 2.2 万行，服务的是四十多页。用户真正要的三件事——内容多、名词能问、越用越长——都还没落地。

所以：**不再加机制、不再加验收条件、不再写逐轮 review 报告。** 新工作先问一句「这让用户读到的内容变多变好了吗」。

## 4. 接下来做什么（按优先级）

1. **两个逻辑问题，均已处理（2026-09-20）**：
   - 引用检查：查下来判定逻辑没错。声明未收录判 `cited: true` 是复测验收（`retest.ts:244`）依赖的语义，**不要改成 false**——试过，`worker.test.ts` 会红，「结论带引用 + 其他版本尚未收录」这种好回答会永远验收不了。真正缺的是前端从不显示 `selfDeclaredUncovered`；已在问答栏补上中性的「未收录」标记（`ChatDrawer.tsx`，`data-testid="chat-uncovered"`）。
   - 夜间维护死循环：原先新增参数页数一超过每晚上限就整批暂缓、检查点不推进，每晚原样重复。现在超限时只做前 N 个、其余留到下一晚（`publish-sync.ts`；检查点 commit 不前进、只记已处理的条目，见 `sync.ts` 注释）；上限 0 仍表示「不生成新页」。用户定的上限是每晚 10（schema 上限也是 10）。2026-09-20 实跑：生成 10 页、留 4 个，约 14 分钟（慢在逐页算 git 谱系）。**生成的是骨架页**：定义、默认值、约束、谱系是真的，解释正文写着「待补」，且直接进 `wiki/params/` 不经审阅（既有设计：全是程序抽取的事实）。
   - **未解决**：同步用的 Python 仍指向 Codex 的私有缓存目录（`sync.config.json`）。本机另一个 Python 是 Anaconda 3.9，实测扫不了上游（上游用了 3.11+ 语法）。要换得先装独立的 Python 3.11+，等用户决定。
   - 夜间任务不调模型：要花钱必须配置里有 `paid` 块且配额 > 0，现在都没有（`sync.ts:47`，运行结果 `modelCallsAllowed: false`）；GitHub 全库首拉也不会被每日任务启动（`sync.ts:147`）。
2. **补走审批的旧账**：2026-09-19 手写直入 `concepts/` 的 24 页没走审阅、没有 raw、`log.md` 没记。用户尚未逐页读过。处理方式待用户定（补审 / 读后认可）。
3. **31 页引用的上游代码已变**（`wiki:stale`）。先看 diff 判断哪些真过期，不要直接付费重跑。
4. **文档瘦身**：状态只留在 feature 验收表（现在停在 09-16，比实际旧）；F001 AC11 仍写 mermaid，与 HANDBOOK 矛盾；HANDBOOK 内部「七节」实列六节等多处不自洽；`CLAUDE.md` 与 `AGENTS.md` 逐字重复；`docs/plans/` 下约 29 份逐轮报告可归档。逐条证据（文件与行号）见 [2026-09-19 审视](docs/plans/wiki-audit-2026-09-19.md)。
5. **小修**：三份 seeds 的仓库表互不包含（默认 seeds 跑 `wiki:audit` 会报 57 处「未知仓库」）；`wiki:gaps` 把 `false`、`enabled`、`AI` 当成待补概念，需要停用词；11 页存量 mermaid 迁到 wiki-diagram 后删 `Mermaid.tsx`；`wiki/sources/` 空目录要么启用要么从 HANDBOOK 删掉；`log.md` 的类型只有 ingest/build/review，问答和 lint 记不进去。

### 明确挂起（不是取消）

- **27 个课程术语页。** 30 个里已有 `kv-cache`、`rope`、`prefill` 三页试点，**写法用户已认可（2026-09-20）**，其余按同样写法补，用户说不急。做法见 §5「怎么加一页」。缺的是：token, embedding, hidden-size, rmsnorm, linear-projection, query, key, gqa, value, qk-norm, head-dim, position, attention-scores, dot-product, causal-mask, softmax, attention-weights, context-vector, multi-head, output-projection, residual, pre-norm, mlp, swiglu, silu, down-projection, decode。补完后把 `<Term>` 悬停卡接进课程正文（现在只在阅读页用了一处）。三页试点还**没配图**，HANDBOOK 要求讲结构关系的页必须有图。
- **三项批量工作**，用户早先暂缓：F001 AC5 全量灌种（目标 120–160 页）、F002 AC4 全量参数页、F003 AC1 GitHub 全库初拉（现有语料 4 条）。
- **真实问答后测**。最后一次问答侧代码修复之后没有再用真实模型复测过（预算已于 2026-09-20 恢复，见 §5）。

## 5. 怎么做事，和已经踩过的坑

**预算账本是保险丝，不是功能开关。** 它是 09-15/16 做真实问答测试时加的临时上限，48 次调用几乎全是评测；用户的本意只是「地基做好之前先不大批量导入」。2026-09-20 经用户同意恢复并把上限调到 $100 / 2000 次（账本代码不支持调上限，是直接改本机的 `wiki/_jobs/budget/account.json` 再走 `wiki:budget resume` 留痕；改前备份在同目录）。**大批量导入（全量灌种、全量参数页、GitHub 全库首拉）放在最后一步，必须用户点头后手动执行**；没有任何自动入口会触发它们。注意：任何一次调用超时拿不到账单，账本就会再次自动暂停，状态页签会显示原因。

**怎么加一页（不花钱的路）**：读 `tools/repos/` 里钉住的源码 → 按 HANDBOOK 写 `wiki/_drafts/<id>.md` → `pnpm wiki:stage --ids a,b [--touch concepts/邻居.md]` → 用户在面板「审阅」页签里读、批准。`wiki:stage` 不调模型，但过的是同一套生产校验；`--touch` 用来把「给邻居页补一条 relations」放进同一个待审包。**不要再把手写的页直接放进 `concepts/`。**

- 写行号必须是实际打开读过的行。术语页的证据用钉住的 vLLM v0.23.0（`vllm@0fc695fc`）与 vllm-ascend 源码、论文、官方模型卡。
- HANDBOOK 写了可引 `infer-lab@commit`，但**代码里没实现这种来源**，引了过不了校验。
- 全库共用一条请求（`concepts/one-request.md`：37 token 问题、200 token 回答），能落到它上面的页都要写「这条请求走到这里时发生了什么」。
- 用户对视觉要求高，前端改动必须截图验收。应用内浏览器面板截图经常超时，用仓库自带 Playwright 写临时脚本截（放 `test-results/`，已 gitignore）。
- 图（wiki-diagram）**不缩放、窄了横向滚**，是既定决策，不要改成缩放。
- 改 `scripts/wiki/*.ts` 会让 Vite dev server 重启并重新预构建依赖（约 40 秒），因为 `vite.config.ts` 经 reader-plugin 间接 import 了它们。这期间页面打不开是正常的。
- `pnpm test` 要带 `WIKI_PYTHON`（取 `wiki/sync.config.json` 的 `python`），否则参数扫描相关测试会用到旧解释器。
- `pnpm lint` 有 14 条 `noDescendingSpecificity` 警告，是规则只看选择器末尾元素造成的误报，不要为消警告去改选择器。

## 6. 2026-09-19/20 这轮做了什么（已提交：`b36d82c` 面板、`4e55b71` 修复、`51a1c3e` 术语试点与 wiki:stage、`e5d4ada` 文档；只在本地，未推送未合并）

- **保底提交** `c815492`：把此前累积的 433 个未提交文件一次提交。
- **3 页术语试点**已由用户批准发布：`kv-cache`、`rope`、`prefill`；同包给 `kv-cache-spec`、`vllm-scheduler` 各补了一条指向新页的 relations。
- **新命令 `pnpm wiki:stage`**（`scripts/wiki-stage.ts`、`scripts/wiki/stage.ts` + 4 项测试）。
- **阅读页右侧面板重做**：问答、审阅、刷新合进一个侧栏（`WikiPanel.tsx`），两个页签同宽、切换不丢状态，待审数挂在页签和浮钮上；审阅按文件分段、红删绿增、行内高亮、新增页默认「阅读」视图、派生文件折叠、批准/驳回钉底（`ReviewPane.tsx`、`diff.ts` + 8 项测试）；面板在宽屏是网格第三列，正文居中，消掉了正文与问答栏之间的空白。旧的 `ReviewPanel.tsx` 已删。
- **三个真 bug**：
  - 浏览器里点「批准」永远 403——dev 代理把 Host 换成了后端地址，过不了同源检查。修在 `vite.config.ts`（保留原 Host），后端保护没放松。
  - 批准要 50 秒且期间后端整个卡死——校验时每个被引文件起 2 个 git 进程，共 704 个。`scripts/wiki/git.ts` 改成批量读 + 进程级缓存，冷启动 1.4 秒。`wiki:lint` / `wiki:audit` 同样受益。
  - 发布后页面被反复整页重载——Tailwind 把 `wiki/*.md` 当模板盯着。`tokens.css` 里排除 `wiki/`、`docs/`；reader-plugin 改成一次防抖通知、页面就地换数据。
- 后端不可达时的报错从 `SyntaxError` 改成一句人话（`src/app/wiki/api.ts`）。

验证：`pnpm test` 97 文件 / 684 项（加 stage 后 98 / 688）、Playwright wiki 四个文件 28 项、typecheck、`wiki:lint`、`wiki:diagrams --check` 均通过。
