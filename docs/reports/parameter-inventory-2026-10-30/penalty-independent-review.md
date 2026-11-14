# 三种 penalty 补写独立审查

日期：2026-10-30。审查者：本轮新建的独立审查 agent `penalty_review`；不是写手自查。

## 范围与结论

按 `docs/wiki-writing-standard.md` 阅读实际页面、与本轮开始前副本的 diff，并独立核读固定源码。改前文件为 `tools/wiki-runtime/penalty-20261030/sampling-before.md`，改后为 `wiki/concepts/sampling.md`；没有拿 Git HEAD 代替本轮起点，也没有改知识页或代码。

本轮三种 penalty 新内容未发现 P1/P2；首轮提出的 1 项 P3 证据链补强建议已修订并经本审查者复核关闭，见下表与复核记录。数学语义、默认覆盖、负值/关闭值、版本差异和 MTP 历史解释可与源码对应。结论限于静态源码、教学内容与所列截图阅读，不是 NPU 推理或效果验收。

| 编号/级别 | 位置 | 影响与依据 | 修法 |
|---|---|---|---|
| R1 / P3，已关闭 | sampling.md「版本差异」BatchChatCompletionRequest 行及「源码位置」入口说明 | 首轮缺少从字段默认到最终单 Chat 请求的转换链来源。基线 `protocol.py:1005–1011` 使用 `model_dump(exclude={"messages"}, exclude_none=True)`，所以省略时的 1.0 会保留；新版默认 None 被删去，之后才走普通 Chat 的缺省合并。 | 已加入 sources 75–77，并在版本表后说明旧版 1.0 被带入、新版 None 被省略。v0.26 位置为 `1091–1097`，main 为 `1169–1175`；本审查者复读后确认与源码一致。 |

## 独立核对的证据

实际执行 `git -C tools/repos/<repo> show <commit>:<path>` 阅读以下内容，未导入或运行上游模块：

- vLLM `0fc695fc`：SamplingParams 的字段、`from_optional`、合法值检查；Chat 与 Completions 的参数转换；ModelConfig 的 `available_params`；离线 LLM 的 `get_default_sampling_params` 与 `generate` 缺省分支。
- vLLM `0fc695fc`：`model_executor/layers/utils.py:34–89` 的 prompt/output 统计与三项应用次序；`v1/sample/sampler.py` 的普通 logits 处理与 penalty 调用；`v1/sample/rejection_sampler.py:290–391` 的候选历史扩展。
- Ascend `db701c1f`：`ops/triton/penalty.py:60–123` 的正负分缩放、频次项、出现项；`sample/rejection_sampler.py:99–145` 的实际 Ascend 验证调用链；`sample/sampler.py` 的中性值跳过与无 Triton 回退。
- vLLM `568afb3a`、`84030bbe`：三项默认值与合法值检查，repetition 的有限性检查确实存在；三版 BatchChat 字段与转为普通 Chat 的函数。
- 四个 Ascend 快照 `db701c1f`、`2c59ff10`、`2ed6cbba`、`baa023ad`：逐个读取罚分核心计算片段；从读取 repetition 参数到写回 logits 的片段 SHA256 均为 `4789756a9d21bab86287331dcbef0a52a5ce30fd87ccf8d4d89b7495f2b6792c`。这只证明所比较片段相同，不把整个采样实现说成相同。

手算与独立 Python 算术核对结果一致：联合例的猫、我、喜欢、句号、看、你最终为 `0, -3, -5, -1, 0.5, 2`；先扣后缩放的猫为 `0.75`。原 presence=1.5 示例的四项扣分和 greedy 改选你也保留且成立。

## 教学与信息保留

只按前两屏的概念和动机内容复述：模型给每个 token 一个分数，采样把分数变成下一枚编号；greedy 在固定分数下选最高项，随机采样通过温度和截断控制候选，再按概率选择。随机路径需要额外概率处理/排序，且引入随机性；确定性限制在后文仍有说明。前置 logits、token、softmax 均有解释，未发现本轮新增的前置概念先用后讲。

新增 penalty 部分可以复述为：presence 看本次输出有没有出现，frequency 看出现几次，repetition 看提示词或输出有没有出现；三者都是改分数，重复惩罚按正负分缩放，另外两项扣分。提示词与本次输出的区别、多轮历史、第一枚输出、负向鼓励、greedy 仍受影响均讲到了。沿用六词分数，改换历史时显式标明新设定，未用示意数充当设备输出。

与改前逐块比较：原 presence 单独示例完整保留；原三项定义扩展进对照表；结构化输出与 raw logprobs 段仅前移；原温度/截断/随机算法、GLM 形状与数值、停止语义、误解条目、既有来源与待核均保留。删除的两个重复角标在同页仍有对应标记和来源，未删事实。新内容只在 sampling 主页面，没有另造三份参数页或跨页重复推导。

两张既有图的 YAML/SVG 结构已核：直觉图为六词分数到概率与 greedy 分支；流程图在两路分支汇合处包含「改分数 → greedy，或 ÷T、截断、指数噪声抽取」，与新增 penalty 的阶段位置一致。两图宽均为 880 px，未改图。桌面渲染视觉、链接操作由主 agent 独立执行，不能以本项结构阅读代替。

## 格式与边界

首轮读取时按 Python Unicode 字符数（含空白，去 frontmatter；行内代码计数排除 fenced code）统计：教学区 16,831 字符、7 个行内代码段、每千字符 0.42；含源码区 24,893 字符、70 个行内代码段、每千字符 2.81。教学区证据角标 0，全文 29，其中 C 级 20（68.97%）。共 5 个 calc，新增小节只有 1 个；表与 calc 之间有解释正文。首图前没有 calc。源码区 H3 顺序是怎么开、会报什么错、开销和什么时候别开、版本差异、源码位置。最终机器统计以主 agent 的验证记录为准。

## 修订复核与独立截图阅读

R1 修订后再次读取 sampling.md:117–119 与 :562，确认三个精确转换函数均已进入 sources，版本表后的解释准确；没有扩张为整版 API 行为一致。R1 关闭，无剩余 P1/P2/P3。

使用 `view_image` 实际打开主 agent 本轮浏览器截图：

- `tools/wiki-runtime/penalty-20261030/penalty-table.png`：三项统计范围与计算方法可清楚横向比较；提示词/本次输出区别以及不能用 0 关闭 repetition 的段落清楚，表列没有被截断。
- `tools/wiki-runtime/penalty-20261030/penalty-calc.png`：六行标签、逐项运算、结果与「示意」标题完整可见；每行能按从左到右复算，猫 0、我 −3、喜欢 −5、句号 −1、看 0.5、你 2 无串行或符号丢失。
- `tools/wiki-runtime/penalty-20261030/penalty-defaults.png`：合法范围表与入口默认表分开，中间用默认合并的解释衔接；长字段能换行，三项名称及关闭值可辨。截图底部尚未展示的剩余行由主 agent 的浏览器检查覆盖，本审查者不据此声称整页视觉已经独立看完。

浏览器现场操作、前两屏与既有图的实际查看、自动 wiki 审计、检索验证由主 agent 另行记录；本报告没有冒称自行操作了浏览器，也没有联网逐一检查全部来源链接。最终交付仍需结合这些验证结果。
