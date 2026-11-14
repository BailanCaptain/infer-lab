# logit_bias、allowed_token_ids、bad_words 独立审查

2026-10-30。审查者为本轮新建的独立 reviewer `/root/token_controls_review`，未参与正文编写。按 [wiki 写作标准](../../wiki-writing-standard.md) 完整阅读实际页面、改前快照与 diff，直接核对固定源码；本记录不是沿用 penalty 的历史审查结论。

审查对象：[sampling](../../../wiki/concepts/sampling.md)。改前快照为 `tools/wiki-runtime/token-controls-20261030/sampling-before.md`。固定部署按 vLLM `0fc695fc` / Ascend `db701c1f`；版本对照为 vLLM `568afb3a` / `84030bbe`。本审查没有加载模型或在 NPU 上执行推理。

## 首轮结论与修订项

未发现 P1/P2。首轮有 3 项 P3；写手已逐项修订，审查者重新读取实际正文及来源后全部关闭，没有剩余事实或文字修订项。

| 编号 | 级别、位置 | 影响、依据与修法 | 状态 |
|---|---|---|---|
| R1 | P3，「禁词为什么只在最后一枚 token 上拦截？」末段，首轮约第 351 行 | “上面三种罚分”指向与实际章节顺序相反，penalty 表在后面。改为“后面的三种罚分”或链接准确小节，避免读者向上找不到解释。 | 已改为“后面三种罚分”，独立复核关闭 |
| R2 | P3，版本表与来源索引，首轮约第 726/743 行 | v0.26/main 的 Chat 字段及传递结论实际成立，但来源未直达这两版相关区段。补 `568afb3a` Chat protocol 的 282–283、694–697 和 `84030bbe` 的 300–301、753–756（或覆盖这些位置的有效范围），补来源索引。 | 已补 sources 100–103 与索引，独立复核关闭 |
| R3 | P3，logit_bias 报错与版本表，首轮约第 675/724 行 | 正常值的转换/截断没有变化，但 v0.26 与 main 新增非法键的逐项归因和 VLLMValidationError；基线直接 int 转换失败。来源 97–98 中分别 388–416 / 421–449 可证。补明新消息 `logit_bias contains key(s) that cannot be converted to integer token IDs`，避免把错误行为也理解为完全相同。 | 已补报错说明与单独版本行，独立复核关闭 |

## 实际核查与结果

- **前两屏初学者复述**：模型先给每个 token 一个分数，采样把整排分数变成一个输出编号；greedy 取最高，随机路径先调温度、截断再抽取。随机性可以避免总选相同词，但要付出逐词表变换与排序成本；选择又会成为下一次前向的输入。前两屏的文字与直觉图 YAML 支撑这些解释，术语有就地定义。
- **偏置**：三版 `SamplingParams.from_optional` 都按整数键转换，并把偏置截到 [−100, 100]；直接构造对象不经过这个转换方法。固定 `LogitBiasLogitsProcessor.apply` 对指定位置做加法，保持普通 greedy 也受影响的结论。三版 `_validate_spec_decode` 都拒绝非空偏置；固定引擎 `_validate_params` 确实调用 verify，不是未接线的孤立校验方法。
- **允许编号**：v0.23/v0.26 拒绝空列表，编号边界取自 len(tokenizer)，缺 tokenizer 时跳过编号边界；固定 main 改取模型词表大小。普通采样对整排词表做掩码，列表外填负无穷，不能把这项当成省去 lm_head 的词表裁剪。固定 worker 的掩码构造与教学说明一致。
- **禁词**：直接阅读三版 update_from_tokenizer，确认去开头空白、无特殊 token、前缀空格候选的首编号/等长筛选，以及固定 main 的空分词和 128 条默认检查。三版 Chat 都声明并传递 bad_words；基线 Completions 确实没有，新两版均有。核对 main GPU V2 的总 token 上限检查，页面正确限定它不代表固定 Ascend 的限制。
- **历史与 MTP**：核读基线 bad_words.py 全 58 行、普通 sampler 的 apply_logits_processors、Ascend 的同名函数及上游两种 `_combine_outputs_with_spec_tokens`。单 token 总屏蔽，多 token 仅匹配本次输出后缀；不跨 prompt/output 边界。MTP 按候选位置扩展历史，bonus 使用全部候选历史；教学描述与实际分支一致。
- **演算与例子**：独立复算白名单两词概率为 0.7310585786 / 0.2689414214，偏置后的猫 1、你 2.5 也正确。全部 5 个 JSON/Python fenced 示例解析通过（JSON 解析、Python AST）；这里不代表 HTTP 端到端或实际生成质量验证。
- **既有信息保留**：逐段 diff 仅新增内容及改写“只允许/屏蔽”总览一句；旧句的两种屏蔽机制都迁入新增详解。既有 penalty 表、presence 原例、叠加 calc、GLM 数字/前提、停止条件、误解、待核及原有 77 条来源全部保留，没有新建重复参数页。
- **图与版式结构**：独立读 sampling-intuition 与 sampling-flow 的完整 YAML，画布都是 880 px；前者保留六词数值与 greedy/随机分支，后者保留前向、TP8 拼分数、普通/MTP 分流、结果返回与收尾。正文的机制扩充位于 GLM 前，源码区 H3 仍按“怎么开 → 会报什么错 → 开销和什么时候别开 → 版本差异 → 源码位置”。
- **密度**：首轮全文 29 个证据角标，20 个 C，C 占 68.97%；源码区前 0 个角标。按去 fenced code 后的汉字统计，教学区 9,604 汉字、10 个行内代码段（1.04/千字），含源码区 14,354 汉字、89 段（6.20/千字）。这些是独立首轮统计；最终修订的精确值以交付记录为准。

## 浏览器实读与复核

已由审查者实际打开本轮桌面浏览器截图 `first-screen.png`、`second-screen.png`、`intuition-bottom.png`、`controls-table.png`、`controls-table-full.png`、`controls-calc.png`、`controls-defaults.png`、`controls-versions-top.png`、`controls-versions-bottom.png`、`glm-flow-top.png`、`glm-flow-bottom.png`，文件均在 `tools/wiki-runtime/token-controls-20261030/`。

首屏定义、六词直觉图及其分支可读；完整三行机制表、范围/入口表、新版差异表无水平溢出、缺字或遮挡；新增 calc 的五行、数值及负无穷符号显示正确。GLM 流程图的上下两部分能连贯读出普通/MTP 分流、各卡采样、结果回传与 CPU 停止检查。图文语义另按上面的源码核读，不以截图替代。

浏览器页面操作由写手执行，本审查仅把自己实际打开的截图列为独立视觉证据，不冒充由审查者操纵了浏览器。写手报告已实际点击新增结构化输出链接并成功跳转、返回；操作过程归入写手交付记录。

审查者直接读取了本轮 `audit-final.log`：167 页的本地引用检查无无效 commit、缺文件或越界，104/104 强制标准页达标；也读取 `retrieval.json` 与 `ui-retrieval.json`，分别记录 11 个 CLI 查询以 sampling/exact 为首位、6 个 UI 查询各返回 1 个 sampling 匹配。它们是本轮执行记录，不代表生成式问答或 NPU 推理已实测。自动构建、内容、audit/lint 的完整结果以写手交付记录汇总为准。

本轮独立审查及修订复核结束，R1–R3 全部关闭，无剩余 P1/P2/P3 或审查待办。
