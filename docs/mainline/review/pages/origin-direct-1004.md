- HANDBOOK 已补直接撰写规定（「链接与来源」节，wiki/HANDBOOK.md 第 295 行新增一段：有外部来源记 rawSources，直接撰写页如实标 origin: direct，不补造 raw）。

## 工具链：直接撰写页改如实 origin（2026-10-04）

依据：用户 2026-10-03 决定，agent 直接撰写、没有 rawSources 的页如实标注 `origin: direct`（中文显示「直接撰写」），不事后补 raw。

### schema 与校验

- `src/content/wiki/schema.ts:34`：`PAGE_ORIGINS` 加 `"direct"`（上方注释写明含义与依据）。`origin` 字段本来就有（`z.enum(PAGE_ORIGINS).default("seed")`），只扩合法值，没有新增字段；没写 origin 的页仍默认 `seed`，向后兼容。
- `scripts/wiki/lint.ts:413-419`：新增阻塞规则 `origin-direct-raw`——`origin: direct` 的页若带 `rawSources` 报错（两者互斥）。没有新增「无 rawSources 又不是 direct」的检查：现有 lint 测试夹具都是无 rawSources 的 `origin: seed` 页，加了会改动大量既有用例；改为在下面「遗留」里记一笔。
- 试过在 `scripts/wiki/workflow.ts` 让编译入口 `originSchema` 排除 `direct`，typecheck 报 `drift.ts:59`、`draft-review.ts:96` 把页面 origin 原样传给流水线、类型不兼容，已撤回；编译产出若误标 direct 由 `origin-direct-raw` 兜住。
- 测试：`src/content/wiki/schema.test.ts:44`（direct 可解析）；`scripts/wiki/lint.test.ts:186-193`（direct 无 raw 不报、seed 带 raw 不报、direct 带 raw 报 `origin-direct-raw`）。

### 一次性脚本

`tmp/origin-direct/mark-origin-direct.ts`（未入库）。逻辑：扫 `wiki/{concepts,params,sources}`，用 gray-matter 判断有没有非空 `rawSources`；对没有的页只在原文上动 frontmatter 的一行，不用 `matter.stringify` 重写，sources 区与正文不读不动：

- 已有 `origin: seed` → 整行换成 `origin: direct`；
- 没有 origin 行 → 在 `type:` 行后插一行；
- 其它值 → 不动、列入跳过。

按 `\n` 切行、每行保留自己的 `\r`（有 20 多页 CRLF/LF 混用，连 frontmatter 内部都混）。先对 `block-table`（换行）与 `concurrent-requests`（插行）试跑，`git diff -U0` 各只差一行后再全量跑。

第一版按 `\r\n` 切行，在 `op-to-ai-core`、`vllm-ascend-repo-map` 两页上漏认了 `origin: seed`、多插一行 direct（造成重复键），`glm-5-3-flash-baseline` 找不到 frontmatter 结束行而跳过；改成逐行保留换行后，脚本把这两页多插的行撤掉、把 seed 行换成 direct，并补上 baseline。另外全量跑时另一位写手刚新建的 `concepts/vllm-ascend-for-rl.md`（未入库）被顺带改成 direct，已当场逐字节还原成 `origin: seed`；该写手随后自行标成了 direct。

### 实际改动

- 共 93 页（concepts 92、sources 1）：88 页 `origin: seed` → `origin: direct`，5 页新插一行（concurrent-requests、glm-5-3-flash、learning-guide、one-request、sources/glm-5-3-flash-baseline）。
- `git diff -U0 -- wiki/concepts wiki/sources wiki/params`：93 个文件，变更行只有 `+origin: direct` ×93、`-origin: seed` ×88，没有别的行。
- 全库核对：没有一页「无 rawSources 却不是 direct」或「direct 却带 rawSources」。

### 前端

`src/` 里没有用到 `rawSources` 的地方；页头的生产入口标签在 `src/app/pages/WikiPage.tsx:346-355`，原来是内联的 `{seed,drop,chat,pr,gap}` 映射，加 `direct: "直接撰写"`（不加的话 typecheck 也会报错）。样式沿用默认 `wiki-chip`，没加专门配色。浏览器实测（vite dev 5193）：`#/wiki/block-table` 与 `#/wiki/glm-5-3-flash-baseline` 页头显示「直接撰写」（class `is-direct`），带 raw 的参数页 `stair-config-cca9e594a052` 仍显示「源码提取」。

### 日志

`wiki/log.md` 末尾加 `## [2026-10-04] review | 直接撰写页如实标注 origin: direct`（符合 lint 的 `LOG_H2` 格式）。

### 检查结果

- `pnpm wiki:lint`：退出码 0（4 处 mark-flood 提示，不阻塞，都是原有的）。
- `pnpm wiki:audit`：退出码 0（审计 142 页，期间别的写手在新增页）。
- `pnpm typecheck`：退出码 0。
- `pnpm lint`（biome 全站）：退出码 0（14 warnings、2 infos，都不在本次改的文件里）。
- 相关测试 `schema.test`、`lint.test`、`workflow.test`、`draft-review.test`：4 个文件 70 个用例全过。
- 全量 `pnpm test`：997/999 通过。两处失败与本次无关：`server/reader-build.test.ts`（同时有别的写手在写页，两次读到的快照版本号不同；单独重跑通过）、`scripts/wiki/params/scan.test.ts`（本机 Python 版本低于上游要求的 3.11，语法错误）。

### 遗留

- 有 10 页在 `wiki/raw/<id>.md` 下有旧式 raw 文件（block-table、kv-cache-cpu-offload、kv-cache-layerwise-offload、kv-cache-memory-profiling、kv-cache-quantization、kv-cache-sparse-offload、kv-cache-spec、kv-pool、prefix-caching、recompute-cpu-offload），`readPageRaw` 在没有 rawSources 时会读它们。这次按「无 rawSources」口径一并标了 direct，要不要改标别的入口，需要用户决定。
- 以后直接撰写的新页如果忘了写 origin，会默认成 `seed`，页头显示「源码提取」；lint 目前不拦。要拦需要先改既有 lint 测试夹具，要不要做也需要用户决定。
