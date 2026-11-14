# Sampling 独立审查

审查者：`/root/groups_replay_review`。日期：2026-11-10。结论：**旧 180 项与本轮新增 67 项分别完成独立逐项审查，当前主张均有带条件的来源支持，P1/P2 已复审关闭。** 两处旧引用范围延伸保留原编号，不算新增项。最终页面 SHA 为 `8472b303f1b3af11296bf47aeee0f4005911163d4b2ea97884cbfb07d168cfff`。

## 范围与证据身份

本批是 `continuation-500/reconciliation-after.json` 中 sampling 的 `baseline_remaining` 180 个来源出现项。180 是引文项，不是 180 篇官方全文。开始时冻结当前页面、两图的 YAML/SVG 共五文件，保存在 `.tmp/continuation-groups-2026-11-10/sampling/before.zip`。页面起始 SHA 为 `cbeb11b77bb0e114f7c69b6a0fef836a5c4d2f78f07ce69d9860d4a00f62a048`；每项来源范围、固定文件 SHA 与摘要文件路径见 `sampling-manifest.json`。

先读写作标准、知识库读页指南、当前页面全文与图，再从官方文档目录展开到可复现性、自定义 logits processor 的使用与设计、interleaved thinking 和 MTP 指南。175 项固定 Git 范围逐项实际读取，另五项是固定模型配置、tokenizer 配置、论文、NumPy 文档及本地原文摘录集合。`sampling-manual.tsv` 是人工逐项判断原稿；不能由来源可读、文件存在或历史“已读”自动推导支持当前主张。

本独审未编辑教学正文、图或应用代码。主执行者接收缺口后修改正文与图；本报告只记录独立复核。未进行 NPU/GPU 推理、接受率、延迟或输出质量实验。

## 发现与修正要求

| 级别 | 发现 | 需要保留的最终边界 |
| --- | --- | --- |
| P1 | 原机制把 top-k 后重归一再 top-p 当成所有后端共同规则 | 上游 PyTorch 按 k 掩码后的集合重算概率；所核 Ascend v0.26/rc2/main 普通排序路径先算一次原概率，p 仍使用它。六词 logits 3/2/1/0/−1/−2、k=2、p=.7：前者只留猫，后者留猫与你；原 k=3,p=.8 例两者碰巧一致。旧 GLM 的 A2 融合算子及 batch-invariance 回退须独立界定 |
| P1 | 初始首两屏没有说明成本，排序/随机状态代价出现在更后面 | 在直觉图之后及时补“多处理、筛选词表分数及维护随机状态”的代价，最终需浏览器确认进入首两屏 |
| P2 | 多张版本表缺 rc2 列，仅有旁段“普通 sampler 相同” | 默认/范围/继承、penalty、bias/allowed/bad、min_tokens、logprobs 与 Ascend 执行必须逐表补 rc2；不能用单文件 blob 相同代替 HTTP 与设备路径核验 |
| P2 | thinking_token_budget 字段已有，但没有教学入口和消费链 | 区分普通最大输出与思考预算、提示词已有思考内容、逐 token 强制结束串及 MTP；结束串可占预算外输出位置，不直接终止整个请求 |
| P2 | 旧 GLM/Ascend 字段可解析，易被误当设备支持 | db701/2c59/2ed 的 NPUInputBatch 将 holder 固定为 None；rc2/main 才建立配置→状态→metadata→采样/拒绝采样链。上游旧版/v26 拒绝 GPU V2，新 rc2/main 有 GPU V2 consumer，不能通称 V1-only |
| P2 | min_tokens 在 rc2/main 的表述没有结构化输出例外 | 停止编号屏蔽使结构化行全为 −∞ 时，恢复屏蔽前仍有限的停止分数，因此可能提前结束；普通文本小例子仍保留。原来源 115 要扩至完整 spec 处理 |
| P2 | 相同种子被写成各卡结果必然相同的充分条件，DP 请求组又易被当成完整模型副本 | 还需相同分布、实现、随机流与取数顺序；跨运行另受批组成和数值影响。GLM 是 TP8 请求组、EP16 跨两机，不能把每台当完整模型副本 |
| P3 | tokenize 来源 94 未包含响应定义；固定 GLM 拒绝后恢复分布只靠邻近/上游类似代码 | 扩展 94 至响应行；补实际 Ascend helper 818–895 与 kernel 392–442。无完整 draft 概率时排除被拒草稿是特例；一般情形为 max(target−draft,0) |

上述要求已对最终正文、四版表和图复审关闭。新 k/p 反例、seed 条件、EP16、thinking 机制/入口与真实消费者相符；同页“随机后不可复现”及“min_tokens 一律挡住结束”的绝对用语也已同步修正，普通处理链接到罚分后的思考预算。新增索引误将 Chat 的来源 197 标为 Completion，末轮已改回 Chat；批量 Chat 默认索引也已包含实际字段来源 189。原“待核：MTP……”已改成学习者可读的未实测事实边界，没有删除这一限制。

旧 180 项的最终人工账为 162 项 `supported_scoped`、11 项 `supplemented`、6 项 `revised_scoped`、1 项 `range_extended`。原问题状态保留于 `.tmp/.../sampling/manual-before-fixes.tsv` 和最终 JSON 的 `initial_verdict`；不是覆盖历史后伪称从未发现问题。新增 181–247 的 67 项另有 `sampling-supplement-manual.tsv` 与 `sampling-supplement-judgments.json`，每项分别记录实际支持的主张，不由“同 main”自动判定。

## 人工判断的实质边界

原六词 softmax、温度、k/p、白名单、三项罚分、对数概率与指数噪声示意均逐步复算。源码顺序和“某一步概率口径”分别核对，保留原例的直觉，不用版本表替代过程说明。混合 greedy/random 批次不能套用 all_greedy 提前返回；top-k 并列可能留下超过 k 项只适用于已核掩码实现。

罚分统计是 token ID：presence/frequency 只看本次输出，repetition 还看提示词；顺序为 repetition→frequency→presence。偏置不是硬禁用；禁词匹配输出后缀而不是任意可见字符串，也不跨输入/输出拼接。MTP 的历史暂接候选与 bonus 行按实际执行链核对，不能要求草拟阶段绝不提出被禁编号。

概率记录区分 raw/processed logits/logprobs、Python 对象与 HTTP 格式、top 数量与指定编号列表、普通与投机路径。只返回若干词的记录不应二次归一后冒充整词表概率。Completions 的 −1 接口可接受而返回映射为空、MTP 指定列表没有完整贯通等限制保留；没有因字段存在就称端到端可用。

思考预算逐项核过字段校验、HTTP 转换、输入门、ReasoningConfig、holder 状态更新、GPU/NPU input batch、runner 构造、metadata 和普通/拒绝采样消费。None/−1 不限这项预算，0 有效；布尔、小数及其他负数拒绝。配置必须得到非空开始和结束 token 序列；结束串可以包括过渡文字，按 token 逐枚强制，且发生在其他屏蔽/罚分之后。不能保证与禁止结束编号的任意约束兼容。

GLM 的 154880/8=19360、4 行验证布局、32 请求×4=128 行、BF16 约37.8 MiB、3行 fp32 约1.77 MiB 已核到主线与固定来源。它们是固定配方/示例推导，不是硬件测量。官方生成配置只支持固定 revision 的默认值，不替代请求→服务默认→模型配置的合并链。

## 官方覆盖与实际阅读

详见 `sampling-official-reading.json`。本轮独审全文读 6 份固定官方指南：可复现性 41 行、interleaved thinking 118 行、MTP 76 行、自定义 processor 使用 468 行、设计 571 行及 rc2 reasoning outputs 527 行；另全文读 ReasoningConfig 125 行及 thinking holder 582 行源码。GPU V2 的 thinking 文件只读明确记录的范围，不算全文。主执行者另读的 11 份 serving/features 母页不记成本审查者全文阅读。

固定 HF generation_config 12 行与 tokenizer_config 33 行读完。NumPy legacy 文档通过 web 阅读正文及兼容条件；直接 urllib 的 403 不代表最终不可得。论文 [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) 全文与附录已读。HTML 的八图逐张看过；缺少的 Figure1/2/4/6/8 通过同版本 PDF 的 p1/2/5/7/8 补齐，均实际看图。现在这篇论文的 13 张图全部闭合；它只是一篇全文，不把 HTML/PDF 算两份。

PDF 保存 SHA `f0749cc4db8afeb82006a20785b2cd3615fcbced8a29886872b6174485ced21b`。web 截图不支持该内容类型后，使用已安装 pdftoppm 渲染并实际检查，未把“下载成功”冒充看图。透明背景的 Figure5 另用白底渲染后查看。图片 SHA、页码、失败尝试与成功替代均记录。

来源 46 的 1324 行 raw 文件是本地摘录集合；42 段与固定 Git 原文逐字节对比全部一致，相应原范围均已实际读。它不是新增官方全文，也不把每段算成一篇。全局新增全文计数在此保守记 0，待总账跨历史去重；本批完成180项不能转述成读完180页。

## 视觉、保留性与最终验收

初始浏览器实际查看首两屏、全部17个表格、9个 figure（两图、七算例），实际点击 lm_head、请求收尾参数表与流式输出回链，页面错误为空。初验期间正文/图正被修订，因此初始截图不作为最终内容验收凭证。

最终浏览器在 `http://127.0.0.1:5201/#/wiki/sampling` 实际打开，运行前后五文件 SHA 相同，`stable=true`、`errors=[]`、`overflow=false`。保存19表、9个figure，并实际逐张查看首两屏、两SVG、k/p新反例、全部7张执行/参数/预算版本表、thinking机制和入口截图。首二屏能看到随机选择的作用以及词表处理、随机状态和复现条件的代价；新表格无裁切，图中同随机流/取数顺序与正文一致。实际点击 lm_head、请求收尾参数表和流式输出，目标URL正确。

未变化的七个 calc 块逐块字节相同，初审已全部实际查看，因此不把最后重复保存截图说成又逐张看过。所有原二/三级标题均保留，新增预算章节；直觉图 YAML/SVG 与冻结时同字节，流程图只修正随机条件和图注，没有改变原布局与数值。全文 diff 已读，四版表移出的使用影响说明在相邻正文中保留；没有丢掉合并默认、罚分、禁词、概率记录或固定GLM数字的有效解释。`sampling-preservation.json` 保存五文件完整哈希、扩范围映射和保留判断。

来源 94 为 `L24–L153→L24–L163`，包含响应定义；115 为 `L167–L295→L167–L371`，包含完整投机最少长度处理。两者仍对应原固定文件的同一 SHA。旧 175 个 Git 来源范围与新增67项的固定文件身份、行范围再次机械核对，0越界、0身份漂移；这项机械检查仅证明身份，语义结论来自逐项人工判断。

最终快照为 `.tmp/continuation-groups-2026-11-10/sampling/accepted-page-and-diagrams.zip`，源摘录、diff与浏览器记录均保留。最终验收 JSON 为 `sampling-verification.json`。主执行者的五项工程检查见 `request-verification.json`，均exit 0；本独审没有冒称亲自运行这些工程命令，也没有将审计命令的URL未核验提示等同语义错误已自动排除。

另一会话 3D 改动不属于本批，不能借本报告宣称验收；全局另三张生产原图仍为独立尾项。没有硬件推理、接受率或性能测量。当前审查范围未关闭事项：无。
