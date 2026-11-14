# B7 返回与流式输出补写验证

2026-11-01，B7 **11/11 单元已补写并验收通过**，完成独立源码与全文审查、检索、构建和浏览器验证，无遗留 P1/P2。累计 A 批 11、B1 8、B2 9、B3 10、B4 5、B5 5、B6 16、B7 11，共 **75 个单元**；B 批 **64/89**，下一批 B8 概率记录 7 个单元。

基线仍为 vLLM 0fc695fc / GLM Ascend db701c1f，对照 rc 568afb3a / 2ed6cbba 与固定 main 84030bbe / baa023ad，Ascend 社区维护快照 2c59ff10 单列。没有把 main 的请求级 stream_interval 写成基线镜像功能。固定源码证据不证明现场镜像安装内容；没有运行真实 GLM tokenizer、完整推理服务或 NPU 性能测试。

## 单元与唯一归属

全部归入现有[流式输出页](../../../wiki/concepts/streaming-output.md#怎么开)，没有另建重复参数页。

| 单元 | 参数 | 本轮补齐 |
|---|---|---|
| W0475 | detokenize | Python 入口、true 默认、false 仍有编号但空文本、非空 stop 冲突 |
| W0485 | include_stop_str_in_output | false 默认、保留/扣字边界、终止编号与特殊 token 的交互；完整停止条件回链既有收尾页 |
| W0498 | n | 1 默认、整数与上下界、Chat null 与 Completion 类型区别、子请求 index/seed、贪心约束及开销 |
| W0499 | output_kind | 三种枚举、CUMULATIVE 默认、HTTP 派生差异、客户端追加/替换与 n>1 最终聚合 |
| W0520 | skip_special_tokens | true 默认、分词器特殊标记与普通字面文本区别、GLM 思考标记与终止编号条件 |
| W0521 | spaces_between_special_tokens | true 默认、快路径双 false 条件、慢路径非 fast + added 词表条件、真实 tokenizer 边界 |
| W0524 | stream | HTTP false/null/true、SSE 与完整 JSON、引擎输出模式转换 |
| W0525 | stream_options | 对象/None 默认、顶层容器、非空选项要求流式、空字典真值边界 |
| W0526 | stream_options.continuous_usage_stats | false 默认、依赖 include_usage、服务强制覆盖、当前候选累计值不可逐片相加 |
| W0527 | stream_options.include_usage | false 默认、choices=[] 最终用量、n 与多提示词汇总、断流限制 |
| W1696 | 服务 stream_interval | 整数默认 1/下界1、按 token 计数、DELTA 首尾例外、累计模式实现边界、main 请求设置取大 |

HTTP 请求体、n=2 的 8+2/3→5/13 用量示意、Python SamplingParams 构造例成对说明消费方式。SDK 以最终请求 JSON 的顶层/嵌套位置核对，未把引擎全部参数冒充 HTTP 原生字段。既有停止串演算、GLM 过程和 Recipe 解释保留，相关入口只回链，不重推。

## 独立审查与修订

[独立审查报告](streaming-independent-review.md)由新的 streaming_independent_review 代理维护，实读固定官方源码、页面全文、本轮 before→after 差异及两图。没有以写手自查冒充独立审查。

执行真实源码 AST 函数的受控 fixture **139/139 断言通过**，覆盖三版 usage 真值表、stream_options 校验、n 上下界与贪心、detokenize/stop、停止串扣字与保留、多停止串版本差异、三种输出模式间隔、空格快慢分支。这些是函数级源码检查，外围依赖与 tokenizer 输出有 stub，不是完整 vLLM/Pydantic/NPU 集成测试。

修订重点：连续用量必须双开关；中途各 choice 与最终全请求计数不同；累计模式不会按当前三版 stream_interval 限频；首份不等待不保证首字时延；慢路径空格处理还需要非 fast 且有 added 词表；首句不再保证每步立即可见。两图只补默认前提，布局与箭头保留。lint 发现新增反向 relation 与既有关系重复后，移除新增边，保留正文回链。视觉检查发现版本表长标识符撑宽后，改为分组名称，完整字段仍留在参数表。

## 实际验证

| 验证 | 结果 |
|---|---|
| pnpm -s wiki:build | 167 页索引生成 |
| pnpm -s check:content | 167 页完整，11 个主主题无重复 |
| pnpm -s wiki:lint | 通过；8 条全库非阻塞提醒，无本页新增问题 |
| pnpm -s wiki:diagrams / --check | 331 图一致，本轮只更新两张流式图的 SVG |
| pnpm -s wiki:audit | 强制名单 104/104 通过；4841 来源，4576 行号有效，无无效 commit、缺文件或越界 |
| pnpm exec tsc -b | 通过 |
| pnpm exec vite build --outDir tools/wiki-runtime/streaming-20261101/preview-dist | 最终构建通过（40.60 s）；独立输出目录用于浏览器验收，避免其他任务覆盖共享 dist |
| python tools/wiki-runtime/streaming-20261101/independent/check.py | 139 断言通过 |
| pnpm -s wiki:find 查询 --json | 18/18 首位命中 streaming-output；独立审查另核 11 个规范参数查询全部 exact 首位命中 |
| 真实站内搜索 | 19/19 可检索并点击进入本页，含完整 --stream-interval 拼写 |
| 浏览器实际页面、图表、示例与回链 | 26 张过程/验收截图；最终 24–26 的版本表全部列可见，8 张表均不超过 961 px 容器，3 条回链可达 |
| git diff --check（本轮页面、图与报告） | 通过 |

CLI 的查询解析器把以 -- 开头的词当选项，因此命令行使用 stream-interval 或 stream_interval；真实站内搜索已直接验证 --stream-interval。这是现有 CLI 解析限制，没有把失败输入登记成通过，也未扩展本轮为检索产品代码改造。

审计的 265 条 URL 没有由该命令联网验证，1552 条 raw 引用摘要待核；通过结论不包含全库语义认证。本轮新增参数另以固定官方源码下载核读。Web 抓取接口对固定 raw URL 返回 cache miss，源码下载证据仍可复查。检索验证覆盖实际入口和可达性，没有做生成式问答质量评测。

浏览器使用 127.0.0.1:5199 的本轮独立构建。初始 Python 静态服务受本机 MIME 映射影响，将 .js 作为 text/plain 返回，换为显式 application/javascript 的本地预览处理器后页面正常加载；没有为验收修改产品代码。

## 保留性与写作密度

本轮快照、逐项清单和验证文件在 `tools/wiki-runtime/streaming-20261101/`。原 32 条 sources 前缀顺序、旧别名、关系、Recipe 三段、七条误解和四项待核保留；来源追加至 58。三个 calc 逐字不变，分别为 6170 ms、停止串四步扣字、1+2+4=7。两张图保持 880×500、880×820 布局，只增加默认条件。

密度口径：排除 frontmatter 与围栏内容，数 U+4E00–U+9FFF 汉字；教学正文以“对照源码”为界。教学正文 5696 汉字，行内代码和证据标均为 0；全文 9843 汉字、50 个行内代码、每千汉字 5.08；26 个证据标，C 类 20 个（76.92%）。五个源码 H3 顺序符合标准，没有新增 H2 尾章。

证据文件包括 `independent-metrics.json`、`preservation.md`、`independent/preservation-results.json`、`independent/fixture-results.json`、`cli-search-results.json`、`ui-search-results.json`、`layout-widths.json`、`link-results.json`、构建/审计日志、最终 DOM 和 screenshots。浏览器覆盖首两屏、两图、三算例、HTTP/文字/模式/错误表、请求与用量响应、Python 示例和版本/来源；独立审查已实看最终截图并关闭版本表裁切问题。SSE 单行 data 示例仅代码块内横向滚动，页面本身没有横向溢出。

## 取舍与后续

本轮仅修改流式主参考、两图的限定文字及派生 SVG、生成索引和交付记录。用户没有要求现场推理测试，现有四项镜像/性能/解析器/异步时序待核继续保留，不用静态检查替代。

B7 验收后累计为 A 批 11 加 B 批 64，共 75 个单元；下一批 B8 概率记录 7 个单元。待用户决策事项：无。
