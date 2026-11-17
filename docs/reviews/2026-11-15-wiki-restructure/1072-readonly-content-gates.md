# 第一阶段只读内容及来源门禁

2026-11-16 22:57 UTC，砚砚。在参数身份作者返修期间，对现有正式库运行未修改内容的工程检查；此记录不替代参数、AST 或四类样本终验。

实际命令均在项目根目录执行，日志保留于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`：

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `node --import tsx scripts/check-content.ts` | exit 0；163 页与 registry、wiki/index.md 一致，11 个主题无漏页或重复 | `1072-readonly-content.log` |
| `node --import tsx scripts/wiki-lint.ts` | exit 0；`ok wiki:lint 通过` | `1072-readonly-lint.log` |
| `node --import tsx scripts/wiki-audit.ts` | exit 0；163 页、8,707 条来源，8,188 条本地行号有效，无无效 commit、缺文件、越界或未知仓库；名单内 104 页通过已有写作门禁 | `1072-readonly-audit.log` |
| `node rfork/verify.mjs` | exit 0；29 个源文件、7 份原补丁及 reconciliation 摘要一致 | `1072-readonly-rfork.log` |

来源审计明确留下 519 条未联网验证 URL 和 4,996 条 raw 引用待核对；本轮通过只证明现有本地来源与行号门禁，不声称逐条语义或全文摘录已经核验。名单外 59 页只统计；旧文章整改继续留第二阶段。RFork 本次执行的是本地字节完整性检查，未使用 `--git` 重建树。

后续若对应实现或内容发生变化，只重跑受影响检查；目前参数身份、来源可见编号、失败回执保留及其余阶段一工程仍待收口。

22:57:04 UTC 的 `1072-phase1-preservation.json`（exit 0）复核 891 个历史运行文件、398 个冻结文件和 2,851 个正式内容/缓存文件均未变；内容摘要仍为 `205167aa29acb2438c741b695815c3f79b0c7b81868e3710d26fa001ec1618a0`。原 4173 / 4174 / 4196 服务均 HTTP 200，原构建资源名不变。
