# MoE / CustomOp / EP 独审后修订：作者补充

作者 spec_final_review，2026-11-11。承接 moe-contract-author.md 原 39 项，回应独立审查者 queue_final_review 的两个问题：custom_ops 报错范围过宽；新增机制没有按写作标准分别说明四版。这里是作者修订记录，最终关闭以独立复核为准，不修改全站总账。

## 修订结果

原合并字符串结论已拆清：all,-op 和 none,+op 合并项会触发语法错误；+op1,+op2 可通过这一层，但作为一个完整名字匹配，不能当成两个开关。还补充 v0.23/v0.26 的断言与 rc2/main 的明确 ValueError、最短规则长度和前置冲突检查差异。四版使用原 AST 语法循环和原 CustomOp.enabled 重现，记录在 version-followup/reproduction-result.json；不是完整 vLLM 启动测试。

三个新增四版表分别覆盖类替换/方法分派/名字及默认、模块化布局/容量/配对/工作区/量化/完成回调/未量化初始化、上游后端默认及 Ascend worker 选择段。rc2/main CPU 工作区分支、NoOP 自拷贝检查、CPU 候选选择及旧初始化方法变化分别列明；没有列全生态内核支持矩阵。Ascend 只声明所读平台段不再有旧赋值，不声明整个项目绝无其他字段写入。

| 页面 | 补充引文 | 当前来源数 | 冻结 SHA256 |
|---|---:|---:|---|
| ops-and-kernels | 10 | 96 | 0afb2bf85ff3a9fe72887fd6bbffc9dc56b13e1f5069d94beeafc88a6da5a28d |
| moe | 62 | 121 | e17c9044409975fab5d9f3c4e520a1d09b4d72cc414fd2de02d735d6573fa9f8 |
| expert-parallel | 7 | 90 | 4a9b1bfd1bedfbb86769a0ad90c518756c73f4cc8d42bcdb4c03555436874e72 |

79 是补充引文项，与原 39 分开；不是 79 篇全文。新增官方全文计数为 0。

## 阅读与复用范围

固定上游为 0fc695fc / 568afb3a / ced6857a / 84030bbe，Ascend 平台为 2c59ff10 / 2ed6cbba / 7d825229 / baa023ad。原源码通过本地固定 Git 对象重新提取，完整文件和实际范围 SHA 均保存。

version-followup/selected-ranges-final.json 含 111 个方法/类范围、44 个不同摘录：其中 17 个新版不同摘录已逐段完整读；旧 27 个不同摘录中 3 个存在原阅读范围空档（v015 HT receiver、v016 HT prepare_async、v023 未量化 setup），本轮也完整补读。其余旧范围回用原作者实际阅读与身份；67 个同摘录范围精确复用，不把相同文件身份当成读完任何未读范围。

CustomOp 大范围有额外依据：原 0fc695fc 全文件已经实际读完，v0.26 全文件逐字相同；rc2 完整 diff 只有两处断言改明确异常，已读完整变动及两个消费者方法；main 全文件与 rc2 相同。配置语法、默认补齐和 Ascend 平台段另按 additions 的精确范围读。CPU 候选/类映射 48–163 在 rc2 实际完整读，main 对应范围 SHA 相同。未把这些复用重计为官方全文阅读。

准备过程临时脚本曾将新引用插在 updated 后，YAML 将其纳入标量而非 sources。保留检查的来源数异常揭示此问题后，按 before 元数据原样纠正；最终 sources 为 96/121/90，除 sources 外全部 frontmatter 字段与修前一致。该错误在冻结与浏览器验收之前已修复。临时脚本仅位于证据目录，未改产品代码。

## 保留、浏览器与检查

修前快照 version-followup/before.zip 保存原 39 项冻结时的三页。最终 preservation.json 验证旧来源仍为完整前缀，17 个图块与 11 个 calc（含原 39 项增加的容量示意）全部原样保留；三个正文 diff 实际阅读。未改图资产或 3D 代码。新版容量与平台字段没有覆盖旧 GLM 数字和运行分支。

作者浏览器实际看完 13 张截图：三页前两屏、三处版本段、三张完整新表以及修正后的错误说明。初学段保持原解释与代价；表格无截断，横向溢出 false，单元格溢出 0，页面错误 0，运行前后页面 SHA 一致。记录在 version-followup/browser/report.json。独立审查者负责在最终冻结后复看，并完成原 EP 3D 的独立完播；作者没有冒领其结果。

`pnpm check:content` 通过：164 页、11 个主题。三页 `git diff --check` 退出 0，只有既有 CRLF 归一化提示。统一工程五检查与白名单由 root 汇总。

## 交接

补充的逐项范围在 moe-contract-version-followup-additions.json，方法阅读/复用在 ranges.json，保留身份在 preservation.json，归档在 archive.json。原 39 项作者包保留，不覆盖其历史 SHA。当前作者未发现新增待修问题；两个独审问题请 queue_final_review 依据新页面与原始范围作最终判定。无用户待决事项。

独立复核后按建议去掉 ops 表头与 EP 引导句中的维护视角用词，修前保存 before-wording.zip；只改两处措辞。作者另外实际查看两张修后版本段截图，wording-final-report.json 记录错误 0、前后 SHA 一致；本轮作者共实际查看 15 张截图。正文最终 SHA 已同步上表。
