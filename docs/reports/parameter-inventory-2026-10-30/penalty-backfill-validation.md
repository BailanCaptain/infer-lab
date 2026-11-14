# 首批补写进度：三种 penalty

2026-10-30。按 [补写计划](deployment-backfill-plan.md) 完成 A1 的前三个单元：presence_penalty、frequency_penalty、repetition_penalty。主页面仍是 [sampling](../../../wiki/concepts/sampling.md)，没有新建重复参数页；A1 后三项及 A2 五项尚未补写。历史盘点台账保留盘点时的状态，当前进度以本记录为准。

## 本轮补了什么

在原来的「改分数」小节扩展三项对照，保留原 presence 单独演算，并沿用同一组六词分数补频率、正负分缩放、零分、提示词独有 token、负参数与三项叠加例子。明确实际统计单位是 token 编号、前两项只看本次输出、repetition 包括模板处理后的提示词，以及多轮对话的历史归属。

源码区补齐浮点类型、默认/关闭值、范围与报错、Chat/Completions/直接构造/from_optional 的区别、生成配置白名单和覆盖、JSON 请求体与 Python 参数对象示例。说明普通 greedy 仍受罚分影响、MTP 验证逐位置合并前面候选，以及固定 Ascend 算子的调用、计算和额外处理。没有把示例值写成 GLM 最优设置。

版本核对沿用仓库基线 vLLM 0fc695fc、Ascend db701c1f；对照上游 568afb3a、84030bbe 与 Ascend 2c59ff10、2ed6cbba、baa023ad。三版默认与公式一致，明确 repetition 有限性校验和 BatchChat 字段默认的差异。仓库源码钉点不等于已核实现场镜像安装层，未新增硬件运行结论。

## 审查与修订

按 [写作标准](../../wiki-writing-standard.md) 完成「写 → 新的独立审查者 → 修订复核」，详见 [独立审查记录](penalty-independent-review.md)。首次审查没有 P1/P2；P3 R1 要求为 BatchChat 的默认值传递补充转换函数。已增加 sources 75–77 和解释，独立复核关闭；无剩余 P1/P2/P3。

旧文保留：原三项机制转入对照表；presence 的原例完整保留；结构化输出/logprobs 段仅前移；温度、截断、指数噪声、GLM 数字、停止条件、误解、历史来源及待核保留。只删了两处同页已经出现的重复来源角标，没有删除证据条目。图未改，未产生跨页重复推导。

改前文件与本轮实际 diff 在 `tools/wiki-runtime/penalty-20261030/sampling-before.md`、`sampling.diff`。它们用于区分本轮与用户已有未提交改动，不能只用整个工作树的 git diff 归因。本轮只手工修改 sampling 正文；wiki:build 生成索引时还同步了已有页面的 metadata/source 改动，没有手工修改这些页面。wiki/index.md 与本轮开始时逐字相同。

## 本轮验证证据

| 验证 | 结果与范围 |
|---|---|
| `pnpm -s wiki:build` | 167 页成功生成索引；精确参数名、空格英文名和中文译名已进入 sampling aliases |
| `pnpm -s check:content` | 167 页、11 个主题，正文完整且目录无重复 |
| `pnpm -s wiki:audit` | 最终运行通过；104/104 强制标准页通过；无无效 commit、缺文件或越界行号；全库 URL 可访问性、raw 与源码逐字一致、语义正确性不在自动检查保证范围内 |
| `pnpm -s wiki:lint` | 通过；另有 8 处其他页的既有提醒，本页没有提醒 |
| JSON / Python 示例语法 | JSON 解析、Python AST 解析通过；Python 示例明确要求已有 llm 对象，未加载模型或发送推理请求 |
| 演算复算 | 组合公式依次得到猫 0、我 −3、喜欢 −5、句号 −1、看 0.5、你 2，与正文一致；独立审查另行对照固定源码 |
| 固定模型配置 | 本轮读取官方固定 revision 690b7052 的 generation_config.json，只有 temperature/top_p/EOS 等字段，没有三种 penalty；内容存于验收目录 |

最终审计日志在 `tools/wiki-runtime/penalty-20261030/audit-final.log`，lint 在 `lint-final.log`；内容检查首轮另存 `content.log`。改动是教学文档与生成索引，没有修改产品代码或图，因此不额外运行产品全量单测、类型检查与构建；没有 NPU 延迟、接受率或生成质量实测。

写作密度按自动标准的教学区字数口径：8,550 字，行内代码约 0.8/千字，calc 约 0.58/千字，源码区前角标 0，免责约 1.2%，图宽合规。另以「去 fenced code 后的汉字数」统计：教学区 8,159 汉字、7 个行内代码段，0.86/千字；含源码区 11,032 汉字、70 个行内代码段，6.35/千字。两种口径不同，不能混用。全文角标 29，C 级 20，占 68.97%；两图宽 880 px；首图前 0 个 calc，六词示意分数在首图前交代；共 5 个 calc，每个内容小节至多 1 个。

## 检索与浏览器实读

实际运行 `pnpm -s wiki:find "查询词" --json`，以下 10 个查询全部以 sampling 为第一个结果、命中方式 exact：

- presence_penalty、frequency_penalty、repetition_penalty；
- presence penalty、frequency penalty、repetition penalty；
- 出现惩罚、存在惩罚、频率惩罚、重复惩罚。

机器结果在 `tools/wiki-runtime/penalty-20261030/retrieval.json`。检索验证覆盖目录/CLI 共同索引，不冒称已经测试生成式问答答案。

启动本地阅读服务，在桌面内置浏览器实际打开 `http://127.0.0.1:5193/#/wiki/sampling`：

1. 阅读前两屏与六词直觉图，查看 GLM 流程图上下两部分；已有布局保留，图中文字可辨。
2. 查看三项机制表、正负数及叠加 calc、范围表、入口默认表、版本表；未见横向溢出、遮挡或算式符号缺失。
3. 在站内目录输入三个精确参数名及「出现惩罚／频率惩罚／重复惩罚」，每次显示 1 个匹配页面，点击进入 sampling。
4. 点击正文「入口」交叉链接，实际跳到 api-server-entry 的「怎么做：从 JSON 到一串编号（① 到 ④）」并核对标题与可见内容。

截图保存在同一验收目录的 `penalty-table.png`、`penalty-calc.png`、`penalty-defaults.png`，独立审查者也已打开检查。读取并点开的页面不是只靠截图或自动检查判定事实；公式、默认值与版本结论另有固定源码核对。

尚需用户决定：无。下一项仍是原计划的 logit_bias，不把本轮三个单元完成写成首批 11 个全部完成。
