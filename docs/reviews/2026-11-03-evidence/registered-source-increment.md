# 固定来源登记增量

本次将 op-plugin 与 Tokenizers 的登记合为一个可独立复核的三文件差异，见 `registered-source-increment.diff`。比较基线为 `.tmp/doc-gap-2026-11-03/evidence-op-plugin-before/`，不是 HEAD；仅新增一份 op-plugin 文档和三个 Tokenizers 固定源码文件。Tokenizers 沿用 Transformers、XGrammar 的生态一手分类，不单独支持 S。URL 匹配实现和证据拦截规则未改。

Tokenizers 新增测试先红：3 项失败、44 项通过，失败原因均为精确链接仍判 unlisted。登记后来源与 lint 两个测试文件共 105 项通过。负例覆盖伪装域名、相邻文件、其他提交、fork 和 issue；HANDBOOK 逐条一致测试保留。日志为 `.tmp/wiki-evidence-2026-11-03/tokenizers-sources-red.txt` 与 `tokenizers-sources-green.txt`。

本轮 `biome check scripts/wiki/sources.ts scripts/wiki/sources.test.ts`、`pnpm typecheck`、`pnpm build`、`pnpm wiki:lint` 均通过。后三项日志位于相同目录的 `tokenizers-typecheck.txt`、`tokenizers-build.txt`、`tokenizers-wiki-lint.txt`；wiki lint 仍有 7 条非阻断角标密度提示。没有浏览器或设备验收，本改动不改前端行为。

另单独保存 `seed-comment-increment.diff`：只将 seed 第 19 行说明改为配套上游固定快照，ced6857 pin 不变。本轮只读 `git ls-remote origin refs/tags/v0.30.0 refs/heads/releases/v0.30.0` 实际返回两者均指 ced6857；本地旧 tag 与当前远端不同，因此注释不再以本地 tag 身份解释固定提交。

独立代码复核已提交主任务，本记录不是独立验收结论。
