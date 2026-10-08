# 知识库前端：跳过不合法的页（10-02）

用户拍板：一页不合法不再让整站打不开，改成跳过坏页、其余照常显示。没有改 `wiki/` 下任何页面，没有起停 5193/8790，没有提交 git。

## 一、根在哪

失败发生在**服务端快照**，不在前端运行时：

- `server/snapshot.ts` 原来的 `readKnowledgeSnapshotInLock` 里 `if (problems.length) throw new Error("知识库页面不合法，暂不接受新问答")`——只要 `loadPages` 报出任何一页有问题，整份快照就抛错。
- 读者用的 `readReaderSnapshot` 直接调它。读者快照有两个出口，都走这一条：
  1. `scripts/wiki/reader-plugin.ts` 的 vite 虚拟模块 `virtual:wiki-reader-snapshot`（dev 与构建）——抛错时 `src/content/wiki/index.ts` 的 import 失败，整站白屏；
  2. `server/pages.ts` 的 `/api/wiki/pages`（8790 的就地刷新）——抛错时 dev 下 `wiki:changed` 刷新失败会退回 `location.reload()`，重载又撞上 1，同样整站挂。
- 同一处还有两条整份失败：正文引用的图不存在、图 spec 不合法；写手重读页面时恰好写到一半（`在读取时改变`）也是整份抛错。

前端 `reader-store.ts` 的 `readerSnapshotSchema.parse` 只校验快照结构完整（页与正文一一对应、不重复），不是根，保持原样。

## 二、改了什么

| 文件 | 改动 |
| --- | --- |
| `server/snapshot.ts` | 抽出 `collectSnapshot(root, policy)`。`reject`（问答、发布校验，行为与原来一致）有坏页仍整份拒绝；`skip`（读者）把坏页拿出快照、记下 `{id, file, reason}`。坏页包括：frontmatter/schema 不过、文件名与 id 不一致、重读时变了、引用的图不存在 / spec 不合法 / 还没有 SVG。`readReaderSnapshot` 改用 `skip`。没有坏页时两条路径算出的是同一个 revision。 |
| `src/content/wiki/schema.ts` | `readerSnapshotSchema` 加 `skipped`（默认空数组）与 `skippedPageSchema`。id 取文件名：frontmatter 坏了读不出 id，而路由本来就要求 id 与文件名一致。 |
| `src/content/wiki/reader-store.ts` | state 加 `skipped`（被跳过的 id 集合）；装快照时若有跳过的页，`console.warn` 列出文件与原因（给写手看）。 |
| `src/app/pages/WikiPage.tsx` | 抽出 `MissingPage`：路由到被跳过的页显示 `.wiki-empty` 卡片「页面 id + 该页暂不可用」，不带校验细节；快照里本来就没有的页仍是原来的「还没有这一页」。沿用现有 `.wiki-empty` 样式，没加 CSS。 |

三点行为：目录/列表跳过坏页（坏页不在 registry 里，目录、检索、页数都自然不含它）；坏页路由显示错误卡片；console.warn 列出被跳过的页和原因。

## 三、测试

新增：

- `server/reader-skip.test.ts`（tmp 夹具：一页好页 + 缺字段、frontmatter 坏掉、引用不存在的图三种坏页；好页还挂着指向坏页的边）
  - 先红：同一夹具上严格路径 `readKnowledgeSnapshot` 抛「知识库页面不合法」——这正是改之前读者走的路径；
  - 读者快照只含 good，`skipped` 是 bad / broken / ghost，各带原因；
  - 删掉坏页后，读者快照与问答快照 revision 相同、`skipped` 为空。
- `src/content/wiki/reader-store.test.ts` 新增一条：坏页不在列表、`getPage` 为空、`skipped` 有它、warn 一次且含文件与原因；装上修好的快照后 `skipped` 清空、不再 warn。
- `src/app/pages/WikiPage.test.ts`：坏页渲染 `wiki-unavailable` 卡片，含 id 与「该页暂不可用」，不含 schema 细节与文件路径；不存在的页仍是 `wiki-notfound`。

检查结果：

- `pnpm typecheck`：通过
- `pnpm lint`（biome）：通过（14 warnings / 2 infos 都在既有 CSS，改动文件单独跑 0 诊断）
- `pnpm test`：118/119 文件、995/996 用例通过；唯一失败是已知的 `scripts/wiki/params/scan.test.ts`（本机 Python 环境）
- `pnpm wiki:lint`：通过（另有 4 处既有待留意）

## 四、实测

1. **真实内容的 tmp 副本**：把 `wiki/` 复制到 scratchpad，在副本里截断 `concepts/kv-cache.md`、新增半页 `concepts/zz-half-written.md`，喂给 `readReaderSnapshot`：真实 139 页 → 副本 138 页，`skipped` 正是这两页（原因是缺的字段），`block-table` 等照常；同一副本上问答路径仍抛「知识库页面不合法」。真实 `wiki/` 上读者快照 139 页、`skipped` 0、revision 与问答快照一致。
2. **Playwright 1440 宽，只读访问 http://localhost:5193**：
   - `#/wiki` 正常，目录 139 链接，console 无 warn/error（`skip-badpage-1-landing.png`）；
   - `#/wiki/block-table` 正文正常（`skip-badpage-2-article.png`）；
   - `#/wiki/no-such-page-xyz` 仍是「还没有这一页」；
   - 只在这个无头浏览器里装了一份「kv-cache 被跳过」的快照（不碰文件和服务）：`#/wiki/kv-cache` 显示「kv-cache / 该页暂不可用」卡片，目录变 138 链接且不含 kv-cache，console 出现 `[wiki] 跳过 1 个不合法的页…concepts/kv-cache.md：…`，点目录里其他页照常显示（`skip-badpage-3-unavailable-card.png`）。

截图在会话 scratchpad：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\skip-badpage-*.png`。

## 五、取舍与未覆盖

- **问答仍是整份拒绝**：有坏页时读者能读，但问答侧栏仍会报「知识库页面不合法，暂不接受新问答」。问答和发布校验需要一份完整一致的知识，这是原设计，没动。
- 仍会整站失败的少数情况（不属于「一页不合法」，这次没改）：两个文件声明同一个 id（读者快照结构校验会拒绝）；图 spec 的 YAML 语法错到解析器直接抛错（`loadDiagrams` 里 `parseYaml` 不是 safeParse，lint 共用）；发布中断未恢复。
- warn 不分 dev / 生产：`reader-store.ts` 也被服务端 tsconfig 编译，那里没有 `import.meta.env` 类型；而正常情况下 `skipped` 为空，生产里不会出现这条 warn。
