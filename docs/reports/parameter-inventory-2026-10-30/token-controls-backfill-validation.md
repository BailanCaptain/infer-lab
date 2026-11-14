# 首批补写进度：logit_bias、allowed_token_ids、bad_words

2026-10-30。按 [补写计划](deployment-backfill-plan.md) 完成 A1 后三个单元；连同上一轮三种 penalty，首批进度为 **6/11**。正文继续归入 [sampling](../../../wiki/concepts/sampling.md)，没有新建重复参数页。A2 的五个单元不在本轮范围，历史盘点台账保留当时状态。

## 补写结果与版本边界

沿用六词示意分数，增加偏置与硬屏蔽对照、白名单归一化演算、单 token/多 token 禁串的输出后缀匹配、提示词边界、前缀空格分词变体，以及白名单、禁词、penalty、结构化输出、EOS、最少长度之间的相互作用。参数参考仍集中在页末：类型、默认/关闭值、范围、HTTP/Python 入口、示例、报错、成本及版本表。

固定依据为 vLLM 0fc695fc / Ascend db701c1f，对照上游 568afb3a 与固定 main 84030bbe。两项直接影响 GLM 用法的结论已突出：固定配方开启 MTP，非空 logit_bias 会被拒绝，包括值全为零的非空映射；基线 Completions 没有接入 bad_words，Chat 和离线入口才传递。新版 Completions 接入、非法偏置键错误归因、main 白名单校验边界及禁词数量检查分别列明，GPU V2 总 token 容量限制没有套给 Ascend。

示例先通过服务的 tokenize 获取真实编号，检查单 token 条件，再提交白名单；偏置示例明确只适用于非投机服务。没有把教学词编号假装成 GLM 词表编号，也没有为示例修改部署配置。

## 独立审查与信息保留

新的独立审查者按 [wiki 写作标准](../../wiki-writing-standard.md) 阅读实际正文、改前快照、固定源码、图及本轮截图，见 [独立审查记录](token-controls-independent-review.md)。首次无 P1/P2，提出三项 P3：修正前后文指引、补新版 Chat 字段与传递的来源、补非法 logit_bias 键的新版报错差异。三项均已修订并经独立复核关闭，无剩余问题。

改前文件为 tools/wiki-runtime/token-controls-20261030/sampling-before.md，本轮 diff 为同目录 sampling.diff。原 penalty 讲解、温度与截断、GLM 数字、停止判断、误解、历史来源和待核完整保留；仅将原有「只允许/屏蔽」摘要改为新小节的指引。新内容复用原页面的 softmax、罚分、结构化输出和接口约定，没有复制到其他概念页。两张图未修改。

本轮手工修改 sampling 正文及交付报告。wiki:build 生成索引时同时同步了 inference-capacity-and-reliability、kv-cache-memory-profiling 两页已有的 sources/updated 变更，未手改这两页；详见 registry-changes.json。wiki/index.md 与本轮开始时逐字相同，工作树相对 Git 的其他改动不归因于本轮。

## 实际验证

| 检查 | 本轮结果 |
|---|---|
| pnpm -s wiki:build | 167 页生成成功，新增中英文别名及来源进入索引 |
| pnpm -s check:content | 167 页、11 个主题，正文完整且目录无重复 |
| pnpm -s wiki:audit | 最终 104/104 强制标准页通过；无无效 commit、缺文件或越界行号 |
| pnpm -s wiki:lint | 最终通过；9 处其他页面提醒，本页无提醒。首轮为 8 处，期间其他页面并行变更新增一处，未归因于本轮 |
| 示例与演算 | 全页 2 个 JSON、3 个 Python 围栏分别经过 JSON/AST 解析；偏置结果猫 1、你 2.5；白名单概率复算 0.7310586/0.2689414，与正文舍入一致 |
| CLI 检索 | 11 个查询全部以 sampling 为首个结果，how=exact |
| 浏览器目录检索 | 6 个查询每次显示 1 个匹配页面 sampling，实际点击进入 |
| 浏览器阅读与链接 | 实际打开前两屏、两张图、新机制表与 calc、入口范围表及版本表，文字可读、无横向溢出；新增结构化输出链接实际跳转并返回成功 |

首轮审计曾因正文含「可能」等词的句子比例 3.3% 未通过。修订把偏置保留最高分的具体条件、白名单允许重复与乱序直接说清，保留边界信息后复跑通过；没有改阈值或删掉待核项。

密度按「去 fenced code 后的汉字数」统计：教学区 9,620 汉字，10 个行内代码段，1.04/千字；含源码区 14,423 汉字，90 个行内代码段，6.24/千字。全文角标 29，C 级 20（68.97%），源码区前角标 0；两图宽 880px，首图前无 calc；全文 6 个 calc，每个内容小节至多一个。与自动审计的字数口径区分使用。

CLI 查询为 logit_bias、logit bias、分数偏置、allowed_token_ids、allowed token ids、允许的 token 编号、token 白名单、bad_words、bad words、禁词、禁用词串；UI 查询为三个精确参数名及分数偏置、token 白名单、禁词。结果分别保存于 retrieval.json、ui-retrieval.json。只验证检索及目录，不冒称测试了生成式问答答案。

日志、diff、改前快照和截图都在 tools/wiki-runtime/token-controls-20261030/。主要日志为 build-final.log、content.log、audit-final.log、lint-final.log；主要截图为 controls-table-full.png、controls-calc.png、controls-defaults.png、controls-versions-top.png、controls-versions-bottom.png，另有首两屏和两张机制图的完整阅读截图。独立审查者已分别打开核读。

本轮是文档与生成索引变更，没有产品代码或图变更，不额外运行产品全量单测、类型检查与构建。源码结论由本地固定 Git 对象核对，自动引用检查不保证全库外链可访问或结论语义正确；本轮网络读取没有替代本地固定版本证据。未加载 GLM、未发送真实推理请求、未实测 NPU 延迟或生成质量；这些限制不影响已验证的文档、来源与检索结论。

## 剩余事项

无本轮待修问题、无需要用户决定的问题。首批还余 A2 的五个补写单元，按已有计划继续即可；本轮未把历史缺口台账改写为全库覆盖完成。
