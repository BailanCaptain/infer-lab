# 结构化输出、严格工具调用与解析器插件：作者交付

作者：queue_final_review。2026-11-11。正文已冻结，独立审查者为 spec_final_review；本报告是作者记录，不替代独立验收，不修改全站总账。

## 范围与结果

承接 request-structured-followthrough、request-xgrammar-tokenizer、request-tool-strict 三组已有证据及官方目录 84 的工具插件/模板关联入口。已有两页扩写，不另造平行正文。structured-output 旧 93 条来源完整保留，新增 78 条；API 旧 321 条完整保留，新增 30 条。108 是新增引文项，不是全文篇数。另有原 84 项中的 6 条、插件 33 绑定中的 3 条复用旧来源。

| 页面 | 主要补齐 | 最终 SHA256 |
|---|---|---|
| structured-output | 文法与解析的区别、GLM 工具边界、strict 的三层条件、XGrammar 空 token 与停止编号、四版消费者与参数差异 | 1d0a6857f92f3066f7a854feed289d280434bb4411ff81c1ba2f3b68c6779308 |
| api-server-entry | 模板输入、解析输出和应用执行的分工，插件注册/选择/加载，模板例子与严格工具调用回链 | 6bedd6d2f747acd76a940bd8ea88b30a2f2d9ec2c1e9f4e4afdb87fb472a82b2 |

新增来源逐项见 request-structured-author-additions.json，原始候选与插件绑定的读取身份、等价复用和处置见 request-structured-author-reading-disposition.json。两个文件按引文与绑定分别记账，不相加冒充阅读量。

## 实际读取与纠正

原三组 84 候选实际处理方式是 66 个不同摘录范围逐行阅读、15 个 SHA 相同的对应范围复用、3 份模型 JSON 的选定字段解析。不同摘录范围共 3349 行；未把取得整份 tokenizer JSON 当成全文阅读。文件身份与摘录 SHA 在 structured-author/sources/integrity.json；rc2/main 的 12 对相关消费者 AST 范围另做同段 SHA/差异核对，在 main-comparison.json。baseline 的四个结构化示例文件 README 58 行、offline 113 行、client 268 行及 pyproject 8 行完整读取；README 控制台入口的模块名问题按实际文件指出，没有把不能成立的 uvx 例子当成已验证命令。

XGrammar 使用实际固定库实现，纠正 max_rollback_tokens 已弃用且不生效的边界；它不能支持“最多保存三步回滚历史”的旧结论。GLM 154856–154879 的 24 个填充编号按空 token 处理。tokenizer 的单一 eos 与 generation_config 的三个停止编号分开，结合后端编译和引擎停止条件解释可能提前结束 JSON 字符串的静态路径。没有宣称已运行 native XGrammar 或测出发生概率。

旧 glm47 从 glm4 继承的 required/named 分支提前返回，不能直接套用通用 JSON 约束路径；后续版本的模型结构标签注册、strict 字段、环境变量条件和入口校验分别核对。正文用同一个 check / ok 布尔例子说明解析成功仍可能类型不符，再给带 strict 的配置片段，显式说明新模型格式条件，未把它包装成旧 GLM 镜像已验证调用。

插件扩展完整读工具母文 570 行与 18 个实际模板共 1887 行，继续核注册、延迟导入、命令行检查和 API worker 的四版消费者。10 个模板进入来源，其余 8 个按母文目录覆盖读取。所有模板与外部链接的实际范围、受限访问和明确不作的外推，见 request-tool-plugin-template-disposition.md。HF/Qwen/FunctionGemma/Cohere 等关联内容只按那里声明的页面或段落计为读过，不声称读完这些项目。官方资料全文计数未修改。

## 保留、快照与修订闭环

编辑前 before.zip 保存两页与 12 个图资产，共 14 项。request-structured-author-preservation.json 记录旧来源前缀完全一致、两页全部旧 H2 保留、6 个原图块和 5 个 calc 块逐字一致、12 个 YAML/SVG SHA 不变。实际检查两份正文 diff，原 8 token 例子、位图值 82、GLM R1、MTP3、API 编号和进程流程均保留。EOS 旧标题、错误库边界和缺失实现的待核句属于有证据的纠正，去向在保留记录中说明。

API 离线请求队列短回链独立于本组封存：api-offline-backlink/api-offline-only.diff。严格工具回链和插件扩写又分别保存 api-strict-backlink-only.diff、api-plugin-only.diff，避免把几个步骤揉成不可核的合并修改。

作者首轮浏览器发现新来源误置在 origin 字段下方，页面 YAML 不能正常解析；将 30 条移回 sources 序列后校验 origin=direct、sources=351 并重跑成功。这个作者阶段错误已经修复，不计为最终未解决项。另一次链接测试定位器选到同名旧 token 页链接，改成按实际 #怎么开 href 选择并重新点击；没有把错误测试结果写成页面缺陷。

首次独立审查提出 P1 首两屏缺少代价说明。按其要求，首图前增加一句 CPU 编译、每步允许集合/掩码以及采样等待；保留后面五处成本原文。修前快照、仅这一句的 diff、修后两屏截图和 SHA 分别在 structured-output-before-independent-cost-fix.md、structured-cost-fix-only.diff、browser/cost-fix-* 中。该修订已提交独审复看，最终关闭以独审报告为准。

## 作者浏览器和格式检查

实际 Chromium 1440×1100 打开两页，查看前两屏、新段、全部 11 个 figure（6 图、5 calc）、全部 33 张表，并实点四条交叉链接。browser/report.json 的 73 张截图全部实际查看，控制台错误 0、横向溢出 false、表格溢出 0、坏图 0，四条目标页及锚点成立，运行前后正文 SHA 一致。独审首屏修订后另外实际查看两张前两屏截图；cost-fix-report.json 前后 SHA 一致且错误 0。总共 75 张作者截图，不以截图数代替来源阅读。

首图 structured 修后约在第一屏 856 px，API 第一图约 1140 px，可在前两屏看见。图前 calc 均 0；structured 图前只有机制性的 bit 0/1，API 原编号例子明确为示意。前两屏可复述：结构化输出按文法屏蔽候选，增加 CPU 编译和每步工作；API 负责请求校验、模板及分词和回传，CPU 处理及队列交接产生成本。

按项目标准对“对照源码”之前教学正文统计，中文字符加英文词：structured 7100 字、行内代码 3（0.423/千字）、calc 2（0.282/千字）、免责/限定识别 4/202；API 11788 字、行内代码 3（0.254/千字）、calc 3（0.254/千字）、9/304。正文证据角标均 0，标准检查 problems 均为空，原格式规则和阈值未改。`git diff --check -- wiki/concepts/structured-output.md wiki/concepts/api-server-entry.md` 通过，仅提示 API 原有 CRLF 将归一化。统一内容、链接、来源与工程检查由 root 执行；本报告不冒领尚未返回的全站结果。

## 交接边界

本组完成已知 P2 事实缺口和插件/模板承接；独审仍在进行，不能据本报告宣布全站完成。没有进行完整 vLLM、NPU、GPU 或 native XGrammar 实跑。四版比较限定为页中逐项声明的消费者和入口，不从 main 推定未来版本；frontmatter 的 verified 未由作者自行扩大。证据目录 structured-author，最终归档位置与成员 SHA 见 request-structured-author-archive.json。当前无其他作者已知待修 P1/P2；独审提出的新问题继续本轮闭环。
