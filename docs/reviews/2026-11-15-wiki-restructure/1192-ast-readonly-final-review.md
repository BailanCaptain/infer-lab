# AST 只读计划器独立终验

2026-11-17 05:30 UTC，**Approved，0 P1 / 0 P2，仅限只读计划器子批**。原 1163 三项问题及 1183/1189 同根范围全部闭合。Task 044 尚有隔离副本 apply，真实四类样本仍停同代 312 次的独立预算问题；本记录不是阶段一最终签署，也不授权正式文章整改。

## 审定字节

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/ast-migrate.ts` | `dcb17b3d4ba4efbeb0e91c3cef7484ce407fb60974fe1f681a068c689a8eab7f` |
| `scripts/wiki-ast-migrate.ts` | `7dbdc04a557a750afd1e487f7d40476c4d41669f607783d977b1b783f7d59afc` |
| `scripts/wiki/ast-migrate.test.ts` | `1c416bf6746b8ccd49a9cdbf89af1ee8d0da41a7083b75ceefd8b94b02b754a6` |

## 实现判断

输出保护按实际输入目录、真实路径与底层节点统一判定；输入和输出两侧的 junction、hardlink、Windows 大小写路径，以及越界显式文件路径均在输出前拒绝。目录遍历按实际节点类型递归，并用节点身份去重避免链接环；外部合法报告仍可原子写入。

HTML 保护来自一份文档 AST 区间集合，贯穿标题、嵌套节点及版本段操作。原始文本元素内的假闭标签不会改变外层区间；源段删除和零长度插入目标均受同一判定约束，保护目标不能接受搬移时保留源段并产生人工项。最终全部拟议操作还检查是否触及受保护区间。普通正文、孤立技术占位符、合法外部来源转换和未受保护版本段搬移的正例仍通过。

unified diff 保留物理行与无末尾换行标志，零长度区间坐标已修正；不会通过格式化整个文档改变 BOM、行尾或未触及空白。

## root 实际验证

- `1192-ast-tests.json/log`：10/10 测试，exit 0，包含原输出别名、输入 junction/越界参数、嵌套与跨标题 HTML、假闭标签、受保护搬移目标，以及五种行尾/BOM 的实际补丁应用。
- `1192-ast-html-target-green.json`：最后两项独立内存反例全绿；HTML 内文字不改，向 HTML 内搬移不生成任何编辑。
- `1189-ast-html-green.json`、`1189-ast-input-junction-green.json`、`1189-ast-explicit-input-green.json`：跨 H2 / HTML 版本段、输入 junction、显式越界输入三份原独立探针均 exit 0。最终 10 项测试再次覆盖同一机制。
- `1192-ast-formal-green.json`：原四组正反例、大小写路径与补丁合法性全绿；正式 163 页只读预演、163/163 内存二次规划幂等，文件字节不变。135 页含拟议编辑、1121 条拟议来源角标、0 个默认段落搬移，131 项留人工。这些是工具统计，不是阶段一文章整改配额。
- `1183-ast-diff-format-green.json`：LF、无末尾换行、CRLF、BOM+CRLF 的补丁实际应用结果与内存预览逐字节一致，exit 0。采用 `git -c core.autocrlf=false` 对齐项目配置，避免临时目录继承 Git 系统级自动行尾转换；旧探针及其真实失败报告保留。
- `1192-ast-types.json/log`、`1192-ast-biome.json/log`、`1192-ast-deps.json/log`：类型、三文件规范和依赖方向检查均 exit 0。
- `1189-root-preservation.json`：891 个历史文件、398 个冻结文件未变；2851 个正式资料/旧缓存文件摘要仍为 `205167aa29acb2438c741b695815c3f79b0c7b81868e3710d26fa001ec1618a0`；4173/4174/4196 服务均 HTTP 200。

## 剩余范围

下一作者短轮应实现 `1179-negotiation-frame-budget-review.md` 的预算修复，让 root 在不改代次、不丢缓存和必需证据的前提下续原 312 次真实样本。随后依 `1150-ast-engineering-acceptance.json` 实现同一 JSON 计划在明确隔离副本上的 apply、全量写前校验、陈旧/非法输入零写入和重复执行幂等。正式文章、已审候选正文和独立产品不在当前修改范围。第一阶段全部闭环独立签署后停止派工、保留服务。

独立检视：砚砚 / gpt-6-astra。
