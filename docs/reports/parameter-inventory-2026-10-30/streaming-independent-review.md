# B7 返回与流式输出：独立审查

审查日期：2026-11-01。审查者：独立子代理 `streaming_independent_review`。范围为 B7 的 11 个补写单元。结论：通过文档范围的独立审查。固定源码、函数级 fixture、成稿全文与本轮差异、保留性、CLI 检索以及页面和两图的截图均已核，无遗留 P1/P2 问题。不将这些结果表述为真实 GLM tokenizer 或 Ascend/NPU 运行验证。

## 审查边界与依据

- 已读 `docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`，旧版 `wiki/concepts/streaming-output.md` 全文以及两张原生教学图 YAML。
- 原页与图的 before 快照位于 `tools/wiki-runtime/streaming-20261101/`，后续保留性审查将基于这些快照，不以整个工作区的 git diff 代替本轮差异。
- 独立下载并阅读官方 `vllm-project/vllm` 的固定源码，保存在 `tools/wiki-runtime/streaming-20261101/independent/`。未读取 `tools/repos`。
- 版本为基线 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`、rc `568afb3a13806beb53bb2e6bd518269357b237c0`、主线 `84030bbe3d74d99bad477a3d2e37a973ccd8865c`。这些输出控制规则的证据来自上游前端，不等同于在 Ascend 执行环境做过实机测试。

## 独立源码与可执行检查

运行：`python tools/wiki-runtime/streaming-20261101/independent/check.py`。

结果：`PASS: 139 assertions; 3 field snapshots; upstream AST functions executed; not an installed-vLLM or NPU integration run.` 结果明细位于同目录 `fixture-results.json`。

脚本从上述固定源码 AST 中提取并执行函数；只替换外围依赖、输出构造和受控 tokenizer 返回值。它验证分支逻辑，不冒充完整 Pydantic 请求解析、真实 GLM tokenizer、完整 vLLM 服务或 NPU 运行。

| 检查面 | 独立结论与关键证据 |
|---|---|
| 三种 usage 开关组合 | `should_include_usage` 三版均要求 `include_usage && continuous_usage_stats` 才开启连续统计；强制包含 usage 的服务端选项覆盖二者。覆盖四种组合、无配置与强制配置。基线 `api_utils.py:276–288`，rc 同函数，主线 `:289–301`。 |
| 请求默认值 | AST 快照记录全部 11 单元相关字段：`n=1`、`stream=false`、`stream_options=None`、两个 usage 子项 false、反分词 true、跳特殊 token true、特殊 token 间空格 true、保留 stop false、底层 output_kind 为 CUMULATIVE、启动间隔 1。 |
| HTTP 与底层输出模式 | Chat/Completion 转换采样参数时，流式选择 DELTA，非流式选择 FINAL_ONLY；HTTP 请求模型不直接声明 detokenize/output_kind。 |
| stream_options 校验 | 非空配置与 `stream=false` 冲突；实际函数用原始输入的真值判断，空字典不触发该条校验。覆盖两种端点、三版、空与非空配置。 |
| n 约束 | 覆盖 0、1、2、16384、16385、1.5 及贪心 n=2。三版 envs 中 `VLLM_MAX_N_SEQUENCES` 默认 16384；此值是可配置校验上限，不是容量保证。 |
| 反分词与停止串 | `detokenize=false` 与非空 stop 字符串冲突，无 stop 时可通过。保留 stop 控制终止 ID 是否进入文本解码，终止 ID 在两种设置下仍进入输出 ID 列表。 |
| 停止串缓冲 | 用受控解码器执行真实 BaseIncrementalDetokenizer，`答案/是42/#/##`、stop=`###`：默认增量为 `空/答案是/4/2`；保留 stop 时为 `答案/是42/#/##`。 |
| 多停止串版本差异 | 同一轮文本 `a###bEND`、列表 `[END, ###]`：基线与 rc 选 END，主线选先完成的 ###。 |
| 间隔门控的重要边界 | 三版真实 `make_request_output`，间隔 3、每轮一 token、第 6 轮完成：DELTA 发第 1/4/6 轮，CUMULATIVE 发每轮，FINAL_ONLY 只发第 6 轮。原因是当前三版仅 DELTA 更新 sent_tokens_offset，不能泛称所有输出模式均受间隔聚合。 |
| 主线请求级间隔 | 仅主线增加 SamplingParams 和 HTTP 请求字段；小于 1 被采样参数校验拒绝，最终请求与启动配置取较大值。 |
| 空格快慢路径 | 快路径对连续 added-token 做前导空格抑制；慢路径仅非 fast 且有 added-vocab 时调用片段拼接 helper，其他分支沿用 tokenizer 转换。已执行 helper 与真实分派函数，覆盖 fast/非 fast、有/无 added-vocab 及开关组合。受控 fixture 显示同组片段快路径可为 `<A><B> word`、慢路径 helper 可为 `<A><B>word`；不能承诺真实 tokenizer 一律产生相同字符串。 |

主线 StreamOptions 定义已独立定位到 `vllm/entrypoints/generate/base/protocol.py:241–243`，旧版本定义位于 `vllm/entrypoints/openai/engine/protocol.py`。请求端调用仍须按固定版本寻址，不能使用移动的 main 链接替代。

对 `n>1`，另查 Chat 流式服务的连续计数使用当前 choice 的 `previous_num_tokens[i]`，收尾 `choices=[]` 的 usage 汇总 `sum(previous_num_tokens)`。中途当前候选计数不能当作全请求汇总。

## 已发送给写手的修订要求

1. 明写 continuous_usage_stats 依赖 include_usage，保留强制 usage 的服务端覆盖条件。
2. 将 stream_interval 的间隔示例限定在 DELTA / 常规 HTTP 流式路径，不泛化到 CUMULATIVE。
3. 写清 stop 末尾 ID 是否解码取决于 include_stop_str_in_output，实际可见性还受 skip_special_tokens/tokenizer 影响。
4. 特殊 token 空格只解释其作用边界，不承诺快慢路径或不同 tokenizer 的输出一致。
5. n 的校验上限、候选返回索引与 usage 汇总分开说明。

## 成稿与交付检查

已实读成稿全文（包括全部参数参考、示例、三版矩阵、源码导航和四项待核），并实读相对 before 的完整 Markdown diff 与两张 YAML diff。补写只在原主页面建立 11 单元参考，停止条件推导回链 request-teardown，未另建重复参数页。

- 源码导航新增来源 33–58 的映射与固定源码对应；原 32 项来源次序不变。慢路径 helper 与分派条件补充已复读。
- 11 项均有入口、默认值、关键约束/组合关系、效果与版本边界。n=2 用量示意的提示词 8、两个候选 2/3、最终 completion_tokens=5/total_tokens=13 与当前 choice/最终汇总规则一致，并明确不是实际分词结果。
- 首段原有“每步立刻推客户端”过强描述已改为生成中分批返回；慢路径原先未限制 fast/added-vocab 的表述已补齐条件。这两项均已复读确认，无遗留 P1/P2 事实问题。
- 保留性断言见 `independent/preservation-results.json`：旧来源前缀、旧别名、3 个 calc、Recipe 段落、4 项待核全部通过；7 条误解仅代码样式改为 HTML 实体，归一化后语义内容相同。GLM 既有编号、32/128、MTP 的 1+2+4、197+4 截断、16–17 块归还及 Ascend 差异表经全文检查保留。
- 图的布局、节点位置、连线未调整，仅为停止字符串/结束标记增加默认条件。图文的 token/文本/SSE 三层以及引擎/前端判停边界保持一致；已实看直觉图和流程图上/下半部截图，未发现截字、重叠或箭头压字。
- 独立执行 `pnpm -s wiki:find "<query>" --json --limit 1`（SamplingParams.n 首次为 limit 3），11 项查询全部 exact 首位命中 streaming-output。命令结果摘要保存在 `independent/search-results.json`。裸 n 不作为定向检索键，采用 SamplingParams.n。

## 实际截图与最终复核

实际打开并查看 `tools/wiki-runtime/streaming-20261101/screenshots/` 的 01–26 图像：首屏与第二屏、两张教学图、3 个 calc、HTTP 参数表、请求与用量示例、文字格式表、输出模式、Python 示例与间隔、错误表、版本矩阵、源码导航，以及搜索和三条回链落点。

17、18 和首次修订的 20 显示版本表末列裁切，未判为通过。写手缩短行标题，并将顺序说明保留在相应单元格后，独立复看最终 24/25/26：三版默认值与条件仍完整，末列现可完整阅读，Ascend 表亦正常。同步检查 `layout-widths.json`：8 张表的宽度均不超过父容器 961 px，页面 scrollWidth 与 clientWidth 均为 1265 px。SSE 示例保持每个 data 事件单行，横向滚动仅发生在代码块内。

04 的搜索截图确实只匹配本页。21/22/23 的链接落点分别为请求收尾“怎么开”、调度器和采样页；另读 `link-results.json` 确认三个实际回链均通过。独立 CLI 的 11 个定向查询结果见前述记录；写手另保存的更多查询不计入本报告的独立执行次数。

复核最终写作统计 `independent-metrics.json`：教学正文 0 行内代码/0 证据标记；全文行内代码密度 5.08/千汉字，26 个证据标记，其中 C 类 20 个（约 76.9%）；原 3 个 calc、32 条旧来源前缀、旧别名均保留，“对照源码”下 5 个 H3 顺序符合标准。最终本轮差异和已审文件 SHA-256 留存于 `independent/*.diff` 与 `independent/reviewed-files-sha256.json`。

本轮应完成事项已审完。页面原有镜像依赖版本、真实性能、GLM parser 实际切分和异步到达时刻四项待核仍保留，不以源码阅读或受控 fixture 冒充实测。
