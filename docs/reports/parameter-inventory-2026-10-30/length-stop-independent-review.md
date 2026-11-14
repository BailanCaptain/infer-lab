# 输出长度与停止条件：独立审查

2026-10-31。审查者为新建的 length_stop_review，与本轮写手及前两轮 penalty/token-controls 审查者不同。按 [wiki 写作标准](../../wiki-writing-standard.md) 阅读三页实际正文、改前快照、本轮差异、固定源码、六张既有图的 SVG 结构与图中文字，以及写手本轮桌面浏览器截图。独立审查发现 1 项 P2，已修订并复核关闭；无剩余 P1/P2/P3。本记录不替代写手的构建、检索或浏览器操作记录。

## 范围与证据

- [API 入口](../../../wiki/concepts/api-server-entry.md)：max_tokens / max_completion_tokens 的入口、默认、null、优先级、生成配置与服务硬上限、echo=0 特例。
- [采样](../../../wiki/concepts/sampling.md)：min_tokens 的普通采样屏蔽、停止文字边界、范围、接口和 MTP 路径。
- [请求收尾](../../../wiki/concepts/request-teardown.md)：stop / stop_token_ids / ignore_eos 的默认、显示裁切、手工规则、最少长度交互和三版差异。

改前文件为 tools/wiki-runtime/length-stop-20261031 下三个 *-before.md。审查只比较这些快照与现页；工作树相对 Git 的其他改动不视为本轮修改。实际读取的上游版本为 0fc695fc、568afb3a、84030bbe，Ascend 为 db701c1f。未用今天的 main 替换这些固定提交，未把 API 页旧 renderer 表的 98dff2a8 当成参数盘点 main。

## 首次发现与修订要求

**P2：最少长度示意需要区分普通逐 token 与 MTP bonus 行。** 位置：sampling「最少输出数怎样挡住提前结束」及「怎么开」中的固定 GLM MTP 说明。普通逐 token 示例中，已有输出达到门槛后下一次允许 EOS，结论正确；但固定 GLM 的额外 token（bonus）调用普通 sampler，最少长度 processor 仍按本轮开始时已有输出维护掩码，不能据 draft 验证行的位置规则承诺 bonus 恰好跨过门槛就解除。

依据：实际 GLM 路径的 vllm-ascend@db701c1f 在 sample/rejection_sampler.py L146–246 覆写 forward，其中 L178–198 取 bonus logits 并交给 self.sampler(...predict_bonus_token=True)；不是仅凭其父类同名方法判断。AscendSampler 没有覆写 forward 或 apply_logits_processors，沿用 vllm@0fc695fc 的 sampler.py L371–405，对 min processor 调用 apply；logits_processor/builtin.py L192–238 维护已有输出长度及屏蔽。draft 验证行另由 Ascend sample/rejection_sampler.py L140–142 调用 apply_with_spec_decode。上游 rejection_sampler.py L121–142 有同样的 bonus 调用，可作对照。例：步前已有 1 枚、min_tokens=4、三个候选均接受时，三行验证尚需屏蔽，额外第 5 枚也继续沿用屏蔽；下一轮更新状态后才解除。影响是停止时点更保守，不是突破最少长度。

修法：将三行表标为普通逐 token 示意；补固定 MTP 的 bonus 分支、已有输出计数与下一轮状态更新边界，附相应来源。不要把这一差异说成所有后续版本已修复，也不需要改代码或模型配置。

**复核：P2 已关闭。** 实际修订将前部表明确为普通逐 token；源码区新增固定 MTP bonus 的保守屏蔽及 1→4→第 5 枚例子；来源 117–118 分别列出上游和 Ascend 的 bonus 调用，结合既有 82、110 完成证据链。本审查者复读了新文和 Ascend 覆写的完整 forward，确认没有把父类实现误当成直接执行路径。

首次未发现其他 P1/P2。普通停止编号显示的说明与 V1 实现相符：detokenizer.update 在 stop_terminated 且不包含标记时跳过最后编号的解码，再把编号追加回记录；不能机械照搬 SamplingParams 旧 docstring 的“非特殊停止 token 总会显示”。

## 独立核对结果

三版 get_max_tokens 的实际函数均核读：显式请求替代模型缺省值，再与上下文、override、平台上限取小。三版 Chat/Completions serving 的 override_max_tokens 初始化也逐版核对。Chat 非空新字段优先、Completions 省略 16 与显式 null 不同、零输出 echo 内部改为 1 的说明与字段和调用链一致。

停止条件逐版核对了 update_from_generation_config、check_stop、detokenizer.update、check_stop_strings：ignore_eos 不撤销手工编号，也不从 min_tokens 内部集合去掉模型 EOS；文字跨过最少长度才完成仍能匹配；旧版按列表顺序选匹配、固定 main 按最早完成位置；main 新增协议 stop 条数和模型词表 ID 边界。新版默认 stop_token_ids 合并与自动 EOS 合并是两条路径，正文有区分。

额外执行了仅依赖标准库的隔离核对：从三份 Git 对象各自的 AST 提取原始 get_max_tokens 和 check_stop_strings，平台上限用 sys.maxsize 的桩；没有加载 vLLM/NPU。每版 7 项断言，共 21 项通过：请求 30 覆盖生成默认 20；硬上限 10 仍截到 10；省略时分别取 20/剩余 88；同批「A X B END」旧版选 END、main 选 X；跨门槛完成 END 可截到开头；无新增字符不重查已保护的完整串。这些是函数分支核对，不是 HTTP 或 GLM 实测。

## 信息保留与教学结构

逐段差异核读确认：API 入口七步、两张图、100 的预算演算、GLM R1 的 4/200/133120 预算、旧 renderer 版本表和待核保留；只修正缺省/硬上限混说及 GLM 未写上限应限定 Chat 的表述。sampling 的六词分数、softmax/温度/top-k/top-p、三种 penalty、偏置/白名单/禁词、GLM 数字、历史来源与待核保留；新最少长度例子复用猫和句号。request-teardown 的 A/B 共享块、倒序归还、异步调度、客户端中止、KV connector 延后释放、GLM R1 及旧来源保留；字符串判停补了引擎已在同批结束时无需再 abort 的条件。

三页的机器审计尾注均与改前快照逐字相同（API 页无该尾注）。来源只追加，既有六项的教学段未删；最大长度、最少长度、停止条件各有唯一主归属，跨页使用链接。六张图未改，SVG 画布宽为 880 或 900，未超过标准。新 API 参数版本表已在「版本差异」H3，源码区保持五项固定顺序。

初学者概念复述（基于实际正文与图中文字）：入口是把 HTTP 消息加工成引擎可执行请求，并预先登记回程，成本是主机 CPU 和在途内存；采样是从词表分数选下一个编号，参数改变可选集合和概率，成本来自逐行处理与截断；收尾是在前端、引擎和 worker 分别删除状态并归还块引用，发现和通知较晚会多算，引用未降到零的共享块不能回池。这三页原有首段均先建立机制再引入 GLM 数字。

## 桌面页面复核与结论

本审查者实际打开了 tools/wiki-runtime/length-stop-20261031 中 29 张本轮截图，包含三页 first/second、六张图的上下部分、api-budget-table/api-calc/api-versions、min-teaching/min-reference/min-mtp/min-versions、stop-teaching/stop-reference/stop-versions-top/bottom、teardown-calc 及 teardown-calc-full。前部定义与示意可读，既有图中流向、普通/候选分支、前端与引擎的边界、共享块归还顺序清楚；新增参数表和版本表的文字换行正常，两个既有 calc 的算式与正文一致。P2 修订的 MTP bonus 段已实际出现在截图中。

视觉结论限于已查看的内容：API 历史 renderer 版本表保留了原有表内横滚，api-versions 截图顶部可见；新增输出参数版本表无需横滚。没有把这个旧表问题描述成新增缺陷，也不宣称全页都不存在横向滚动。本轮没有改图或 UI 布局。

复读了 ui-retrieval.json：9 个查询实际落到所指定规范页；stop 是短通用词，目录出现 2 页匹配，其他 8 项为 1 页。以上查询与跨页点击由写手操作，本审查者核读其记录和对应页面，不冒称自己重复执行。源码外链未逐项联网验证，语义依据为本地固定 Git 对象；无 GLM 真机推理、NPU 耗时或输出质量实测。

三页本轮补写可通过独立内容审查，待修问题为无。全库工具检查的最终结果由本轮交付记录报告；首次 audit.log 中的三个其他页面 hedge-ratio 失败不属于这三页的本轮变更，不能据三页审查通过宣称全库审计通过。
