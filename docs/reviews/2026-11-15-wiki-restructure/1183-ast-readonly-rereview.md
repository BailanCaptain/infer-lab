# AST 只读计划器返修独立复审

2026-11-17 05:06 UTC。对作者 1178（`0001794890434583-001178-fbef5026`）在盘交付的结论为 **Changes Requested，0 P1 / 2 P2**。原三项中 unified diff 已独立闭合；输出路径和 HTML 的主要反例已转绿，但同根范围仍有遗漏。仅评价原 Task 044 的工程工具，不要求整改文章。

## 锁定字节

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/ast-migrate.ts` | `d6114368e3e6cf2b0bb14234c7494352140102c410daf3b318b6d1af9a976f2a` |
| `scripts/wiki-ast-migrate.ts` | `ba7fd7c577160f759f79176a43a46cf315eb8dceec66631b23635693083c1c32` |
| `scripts/wiki/ast-migrate.test.ts` | `90aa4c4b66c24e134a9c7ad1d7e6544ab05d7f66a9278a3bdaa022bbda155079` |

## P2-1：输入目录经 junction 引出的文章仍可被报告覆盖

位置：`scripts/wiki/ast-migrate.ts:1144` 的 `collectTreeInodes`，尤其 1164 行仅以 `Dirent.isDirectory()` 决定递归。

在隔离副本中，`wiki/concepts` 是指向同一临时目录中 `physical-concepts` 的 junction。计划器实际读取 `wiki/concepts/netloader-guide.md`，但 inode 收集仅登记 junction 目录本身，没有遍历它指向的文章。将 `--out` 设为该文章的真实物理路径时，CLI 退出 0，并用计划 JSON 原子替换文章：SHA 从 `639a517e…` 变为 `48387ce1…`。原子重命名不能保护这个输入别名。

独立复现：`1183-ast-input-junction-probe.mjs` → `1183-ast-input-junction-red.json`，命令 `1183-ast-input-junction-command.json/log`，exit 1。源、junction、目标均只在新建临时目录内；正式文件只读取作为夹具，没有修改。

应覆盖实际读取的输入路径及其真实目标；可以明确拒绝这种输入别名，也可以按真实目录身份遍历并去重，避免链接环。必须在任何输出写入前判定，不能只检查输出侧的别名。

05:08 同根显式输入补充：`--file ../other/netloader-guide.md --out <fixture>/other/netloader-guide.md` 也被接受，CLI 退出 0 并覆盖自己读取的外部文章副本（`1184-ast-explicit-input-probe.mjs` → `1184-ast-explicit-input-red.json`，exit 1）。因此入口还应验证 `--file` 必须是允许输入树内的有效相对页路径，或将显式输入的真实路径一并纳入保护；只遍历默认 `wikiRoot` 不足以履行“任何输入原文不写入”的契约。此复现同样只使用临时副本。

## P2-2：HTML 保护未贯通标题边界与版本段处理

**05:18 同轮进展**：`ast-migrate.ts=f3c0d174…` 已使 1181/1183/1184 三份原探针全部转绿，输入路径问题已实证闭合。统一 HTML 区间实现仍遗漏两处同根边界，`1189-ast-html-target-probe.mts` → `1189-ast-html-target.json`（exit 1）已实际复现：一是 `<script>const text = "</div>";</script>` 中的字面闭标签被扫描为真标签，提前结束外层 `<div>`，随后仍在该 HTML 内的来源文字被修改；二是版本段源处在 HTML 外，但插入目的地处于闭合 HTML 内时仍生成搬移，未在写入端查询同一保护区间。应让 HTML 扫描保留 raw-text 元素的语义，并在所有拟议编辑（含零长度插入位置）上统一检查保护区间，不能只检查被搬走的源段。此为原 HTML 字节保护 P2-2，非新文章整改项；全部复现只在内存字符串内执行。

位置：`ast-migrate.ts:788` 仅在当前 H2 内查闭合标签，967 行遇标题清栈；644 行的版本段盘点及随后搬移不查询 HTML 保护。

闭合 `<div>` 或 `<details>` 内包含 `## 对照源码` 时，内部 `来源 1` 会被加标；同一标签外的对照文字也正常转换，所以不是全页误屏蔽。另一个反例将完整版本段放在闭合 `<div>` 中，用精确偏移和段 SHA 选中后仍生成删除/插入操作，违反 HTML 原文保护契约。

独立复现：`1181-ast-html-scope-probe.mts` → `1181-ast-html-scope-red.json`，exit 1（普通对照通过，三个同根反例失败）。已通过 1182 将证据交原作者。应基于 AST HTML 节点形成统一的文档保护区间，来源与版本段操作共同查询，不按 H2 清零；保留 HTML 外正常编辑。

## 已独立通过

- root `1183-ast-tests.json/log`：`vitest run scripts/wiki/ast-migrate.test.ts --reporter=dot`，7/7 通过，exit 0；这些现有用例未覆盖上述两个新揭示的同根范围，不能代替反例结果。
- `1182-ast-original-probe.json`：原四组纯文本/HTML 用例通过，大小写别名拒绝且副本原文不变，搬移补丁 `git apply --check` 通过；163 页只读计划、135 页拟议编辑、1121 条拟议角标、163/163 内存二次规划幂等，正式文章字节未变。这些是工程统计，不是内容整改配额。
- `1182-ast-output-alias-green.json`：输出端 junction 与 hardlink 两项原反例均拒绝，输入副本不变。
- `1183-ast-diff-format-green.json`：LF、无末尾换行、CRLF、BOM+CRLF 四种格式均实际 `git apply --check` 与 `git apply` 退出 0，结果逐字节等于内存预览。
- 原 diff 探针裸用临时目录的 Git 系统配置 `core.autocrlf=true`，导致 LF 被 Git 转换为 CRLF；项目本身为 false。`1182-ast-diff-format-green.json` 虽命名带 green，其实际结果是 exit 1，完整保留。仅在新的 `1183-ast-diff-format-probe.mts` 中显式 `git -c core.autocrlf=false` 后重新验证，未放宽字节断言、未改旧探针。该环境差异不再作为产品缺陷。

真实 E2E 当前停同代 312 次，另由 `1179-negotiation-frame-budget-review.md` 跟进协商帧预算；若原作者已进入该短轮，先完成当前短轮再回此处，不并发改同一批文件。AST 只读闭合后仍需隔离副本 apply 演练。阶段一未签署；文章整改和独立产品留待，现有服务保持。

独立检视：砚砚 / gpt-6-astra。
