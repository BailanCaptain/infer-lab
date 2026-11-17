# 1163 AST 只读计划器在盘独立检视

结论：**Changes Requested，0 P1 / 3 P2**。这是 Task 044 的工程工具预检，不是文章整改授权，也不是阶段一终验。核验时间：2026-11-17 04:01 UTC。

**05:02 同轮 P2-2 范围复验**：作者返修在盘 `ast-migrate.ts` SHA `d6114368e3e6cf2b0bb14234c7494352140102c410daf3b318b6d1af9a976f2a` 已加入共享标签栈，但 `hasClosingTagInSection` 只查当前 H2、`walkBlock` 遇 H2 清空栈，且版本段盘点/搬移在 HTML 保护扫描之前独立执行。隔离内存探针 `1181-ast-html-scope-probe.mts` → `1181-ast-html-scope-red.json`（命令 `1181-ast-html-scope-command.json/log`，exit 1）复现三个同根遗漏：闭合 `<div>` 和 `<details>` 跨 H2 时内部 `来源 1` 仍被修改；HTML 内的版本段经精确偏移/哈希选中后仍被搬走。普通来源正例通过。这仍是既有“HTML 字节保护”P2-2，不新增任务或内容整改范围。建议基于文档 AST HTML 节点预计算统一保护区间，供来源处理和版本段处理共同使用，保护范围不随 Markdown 标题清零；HTML 外对照文字仍须正常处理。以上只操作临时内存文本，未改正式文章。

**04:06 最终交付复核**：作者 1165（`0001794888332256-001165-31052b6d`）已正式交付，`ast-migrate.ts` 最终 SHA 为 `7c6ff1b8bf1b12b2860a471675408ecce4b4723d34e64b5868d95c735425ec63`（移除区间跨度上限），另两文件 SHA 不变。root 在这些最终字节上再次运行 4 项单测通过（`1165-ast-final-tests.json/log`，exit 0）；同一独立探针 `1165-ast-final-independent-red.json` 稳定复现全部三项 P2（exit 1）。正式 163 页的拟议角标数更新为 1121，人工项 131，163/163 内存幂等通过，文件未改。**正式独立检视仍为 Changes Requested，0 P1 / 3 P2**，不因作者自报“硬性拒绝内部输出/HTML 全保护”而放行；以实际反例为准。下文原草稿哈希和红灯保留。

## 范围与在盘字节

- `scripts/wiki/ast-migrate.ts`：`f843b46e46620fabbc58c9c86e47e411ec1fea4a85f91f5a9a235fb2ef48345e`
- `scripts/wiki/ast-migrate.test.ts`：`4d886bc488867b35b03714117eef936eb8b880c5d9724d28b6349b62d93c0940`
- `scripts/wiki-ast-migrate.ts`：`3f09b2aed3f723851247bc89c6ccb83c2210310d3bd2b41f5e85efbab27deccc`

源要求为 `1150-ast-engineering-acceptance.json` 与 1160 原 Task 044 派工。作者当前尚未提交最终回执；以下判断直接来自代码和隔离复现，不将草稿视为正式交付。

## P2-1：Windows 大小写路径别名绕过只读输出边界

位置：`scripts/wiki-ast-migrate.ts:45` 附近的 `normOut === normWiki || normOut.startsWith(...)`。

`--wiki-root <fixture>/wiki --out <fixture>/WIKI/concepts/review-demo.md` 在本机 Windows 的大小写不敏感文件系统上指向原文章，但字符串检查区分大小写，CLI 退出 0 并将文章覆盖为报告 JSON。隔离探针前后 SHA 从 `a503a4a44e7925bdeb2254b4150e268b2d42edc4cb2a2c160cb9c8d02998dba9` 变为 `3ba076b05a433ac8b69b2ce55606d214962ad62c1f725cc3779fda4815fa2dc5`。

应在写入前按平台文件路径语义验证输出目标，拒绝落入输入 wiki 树或覆盖输入文件的同一路径别名。正例仍可将 JSON 写至明确的外部临时目录。本次只覆盖了自己创建的临时文章，未向正式库运行此反例。

同根补充：`1164-ast-output-alias-probe.mjs` → `1164-ast-output-alias-red.json` 又在完全隔离目录复现目录 junction 与文件 hardlink 两种别名，CLI 均退出 0 且原副本文章 SHA 改变。仅把路径转小写不能关闭该问题；需按现有目标/祖先的真实路径或安全创建语义阻止输出穿回输入树、覆盖输入 inode。两种链接的源与目标均预先验证位于本探针临时目录内，没有接向正式库。

## P2-2：HTML 保护范围未跨 AST 嵌套与块级兄弟传播

位置：`scripts/wiki/ast-migrate.ts:714` 的 `walkChildren` 每次重置 `htmlDepth`，以及 `walkBlock` 对 HTML 节点逐个跳过。

在 `## 对照源码` 下，`<span>来源 1</span>` 正确保持不变，但 `<span>**来源 1**</span>` 会变成 `<span>**来源 1 [C1]**</span>`；`<div>\n\n来源 1\n\n</div>` 中被 Markdown 解析成独立 paragraph 的文字也被加上角标。两者均违反既定 HTML 保留契约。需要用能覆盖嵌套与块级范围的同一保护判定，保留普通 HTML 外的合法来源处理，不靠把整页都跳过获得通过。

## P2-3：拟议 unified diff 的零长度区间坐标错误

位置：`scripts/wiki/ast-migrate.ts:347–381`，尤其 hunk 行号始终使用 `start + 1`。

对明确偏移和段 SHA 选中的版本段，内存预览能生成移动结果，但输出 diff 包含 `@@ -15,0 +15,6 @@` 与 `@@ -17,6 +23,0 @@`；隔离副本运行 `git apply --check --unidiff-zero move.diff` 退出 1，报告 `patch does not apply`。应使输出确为合法、可复核的 unified diff，并验证应用后的字节与 `renderPlanPreviewText` 完全一致（涵盖插入、删除、换行末尾）。

同根格式矩阵已准备并实跑：`1166-ast-diff-format-probe.mts` → `1166-ast-diff-format-red.json`，LF、无末尾换行、CRLF、BOM+CRLF 四种隔离副本均在 `git apply --check` 退出 1。修复后同探针还会实际应用补丁并比对完整输出 SHA 与内存预览，以检测静默的换行或末尾字节漂移；正式文章不参与写入。

## 实证与通过部分

- 根审运行 `vitest run scripts/wiki/ast-migrate.test.ts --reporter=dot`：4 项通过，真实退出 0，记录 `1163-ast-root-tests.json/log`。
- 独立反例：`1163-ast-independent-probe.mts` → `1163-ast-independent-red.json`，真实退出 1，命令记录 `1163-ast-independent-command-v2.json/log`。
- 普通来源与直接 HTML 文本对照通过；两种嵌套/块级 HTML 反例失败；大小写路径反例覆盖隔离文章；搬移 diff 校验失败。
- 正式 163 页的只读计划可生成：135 页含拟议编辑、1120 条拟议角标、0 个默认段落搬移；34 页有 37 个源码区外版本段，均只盘点。内存预览再次规划 163/163 无新增编辑；扫描期间文件字节未变。这些是工程统计，不是二阶段整改配额或文章发布结果。
- 初次启动独立探针因 Windows ESM 绝对路径写法失败，改为 `file:///` 导入后执行上述真实反例；启动失败日志单独保留，没有算作产品失败。
- `1164-phase1-preservation.json` 于 04:02:49 UTC 实测 exit 0：891 个历史文件、398 个冻结文件、2851 个正式资料/封存缓存摘要未变，4173/4174/4196 均 HTTP 200。

## 后续顺序

1160 编辑输出恢复 P2 已有真实 271 次缓存的克隆红灯，应沿 1162/1163 原任务短轮优先闭合；本 AST 草稿与测试原样保留，随后关闭上述三项并交付只读计划器，再单独做隔离副本 apply 演练。文章整改、事实增补仍全部留二阶段；阶段一独立签署后停工，站点服务保持。

独立检视：砚砚 / gpt-6-astra。
