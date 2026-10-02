# api-server-entry 审查记录

## P5 写作记录（10-02）

**任务。** P5 第 18 批，新建 `wiki/concepts/api-server-entry.md`（type: concept，章 10，order 85，按微调清单落在 engine-processes（80）之后）。队列要求：挂靠 01 §A1；直觉图画 HTTP → 模板 → 分词 → 请求对象 → 输出队列登记；数字取自 01 §A1；依赖 K、token、engine-processes、dp-request-routing。验收要点「采样与入口分工明确」：第二屏的分工小表 + ④ 末段 + 常见误解各说一次「入口只定参数、不选 token」。

**目录落位（需主会话处理）。** `src/content/wiki/toc.ts` 的「组件、职责与进程」组还没有本页；按微调清单应插在 `engine-processes` 之后、`request-call-chain` 之前。本页按纪律不改 src/，也没加进 `scripts/wiki/standard-pages.json`。

**字数（wc.py 口径，去 frontmatter）。** 改前 0（新建）→ 改后全文 7,726，其中教学正文 6,300。标准检查（`checkStandard`，本页未进名单，手动跑）：教学正文 5,817 字 · 行内代码 0.0/千字 · 角标 0 · calc 0.34/千字 · 相邻块 0 · 图先行 · 免责 1.3% · 图宽，PASS。

**结构。** 是什么（例子：一条「你好」的流式请求 → 引擎要的三样东西；直觉图）→ 为什么在前端做、代价（三条理由 + 三条代价 + 四行分工表：入口 / 采样 / DP 路由 / 返回）→ 怎么做 ①–④（检查、套模板、分词的两个入口细节、长度与输出上限 calc、采样参数只定不选）→ 怎么做 ⑤–⑦（再校验、字段表、请求 ID 与 n>1、登记三件套与单槽合并、先登记后发送、断开即中止、wave 号与选组、引擎输入线程）→ 流式与非流式（生成器延迟执行、200 先发、代码流程图、检查落点表）→ 变体（completions、n>1、多前端）→ GLM 双机（node0 单前端、模型名 glm、模板、R1 长度 calc、工具调用 FAQ、R1 落 DP0、vllm-ascend 不改入口）→ 常见误解 7 条 → 对照源码五个 H3。

**图（都没用 exchanges 分镜）。**
- `wiki/diagrams/api-server-entry.yaml`（直觉图，900×720）：左列是同一条请求的五种形态（JSON → ① 检查 → ② 带角色标记的文本 → ③ 示意编号 [7, 31, 1052, 9] → ④ 输出上限与采样参数 → ⑤ EngineCoreRequest），① 和 ④ 两条红线到「返回错误」；右列 ⑥ 登记回程接收点 → ⑦ 选组发送，经 ZMQ 跨到 EngineCore 框（收下建 Request → waiting），回程虚线从「每一步算出的编号」回到 ⑥。只画原理、不标 GLM 数。
- `wiki/diagrams/api-server-entry-flow.yaml`（代码流程图，900×900）：API server 里八步竖排，右侧三个出口（JSON 错误 400/404、⑤ 之后的流式/非流式出错、DP 协调器叫醒旁路），底下 EngineCore 一排四步（输入线程解码 → 建 Request → 输入队列 → 调度器收下）。图上不放 snake_case 代码名（figureAdvisories 0 条），pins 钉 7 处源码。
- 两张图用 Playwright 渲成 PNG 自查过：首版 ZMQ 箭头压住 EngineCore 框标签，已改为直下并缩短标签；无压字、无出框。全量 `wiki:diagrams` 中途因别的写手的 yaml 报错跑不通，期间用只渲染本页两张图的脚本出图；最后全量 `wiki:diagrams --check` 通过（281 张一致）。

**数字出处。**
- 01 §A1：入口七步与函数链、R1 = 4 个编号是演示设定、模板 6 个特殊标记（经 token 页）、data_parallel_rank / current_wave / client_index 字段、FIRST_REQ、`--api-server-count 1`。
- 01 §0 / A2.1：max_model_len = 133120（底稿标 [S] 教程），本轮又在教程 0576b647 第 272 行核到。
- 新推的数（[D]）：R1 不写输出上限时 133120 − 4 = 133116，只在 GLM 节出现一次，规则唯一出处仍是 sampling 页。
- 示意数：长度上限 100、要 30 个输出、提示词 75 / 12 个、编号 7、31、1052、9，均标「示意」。
- 源码常量：分词微批 32 条 / 2 ms、renderer 线程默认 1、请求 ID 8 位随机后缀、completions 默认 16 个输出。
- 教程：node0 命令 `--port 8000`、`--served-model-name glm`、`--api-server-count 1`，无 tool/reasoning parser、无 `--chat-template`、无 `--renderer-num-workers`（grep 计数为 0）；常见问题给 glm47 / glm45 / auto-tool-choice，并写明不支持 enable_thinking；功能验证示例走 /v1/completions、max_completion_tokens 50。

**核心概念对照的源码（vllm@0fc695fc，除注明外）。**
- 路由与三种返回：`entrypoints/openai/chat_completion/api_router.py#L40-L75`。
- 前四步：`chat_completion/serving.py#L192-L392`（_check_model、引擎死、max_tokens、to_sampling_params、generate 调用）；`serve/render/serving.py#L183-L266`、`#L452-L471`（工具选项与 trust-request-chat-template）、`#L521-L568`；`renderers/base.py#L338-L360`、`#L1018-L1056`（模板 → 分词 → process_for_engine）；`renderers/hf.py#L876-L878` 与 `base.py#L84-L155`（模板和分词共用 renderer 线程池，默认 1）；`utils/async_utils.py#L24-L50`、`#L90-L110`（微批）；`chat_completion/protocol.py#L290-L296`（chat 默认 add_special_tokens=False）、`#L503-L520`、`#L634-L639`（stream → DELTA）；`completion/protocol.py#L60-L100`（16、add_special_tokens=True）；`renderers/params.py#L186-L192`、`#L415-L435`（长度检查与「at least」）；`serve/utils/api_utils.py#L170-L206`。
- 后三步：`v1/engine/async_llm.py#L280-L414`（process_inputs → assign_request_id → 起后台任务 → n>1 拆子请求 → 先 output_processor 后 engine_core）；`#L524-L600`（生成器、断开即 abort、ValueError 原样抛出）；`#L637-L690`（后台分拣任务按块处理）；`v1/engine/input_processor.py#L223-L385`、`#L387-L484`（组号范围、空提示词、顶满上限、词表上界、补 max_tokens、生成配置结束编号）；`v1/engine/output_processor.py#L45-L92`（单槽合并）、`#L512-L541`、`#L600-L612`（不认识的 ID 丢掉）；`v1/engine/parallel_sampling.py#L52-L94`；`v1/engine/core_client.py#L1344-L1360`；`v1/engine/core.py#L1518-L1543`、`#L819-L841`、`#L341-L377`；`v1/core/sched/scheduler.py#L1801-L1823`。
- 错误出口：`serve/utils/error_response.py#L16-L50`（ValueError → 400、Jinja TemplateError → 400、其余 500）、`serve/utils/server_utils.py#L327-L445`（引擎死 → 500 并退出；RequestValidationError → 400）、`launcher.py#L168-L178`；流式 try 覆盖 `chat_completion/serving.py#L497-L937`。
- 前端个数默认值：`entrypoints/cli/serve.py#L99-L148`。核到一处容易写错的事：不写 `--api-server-count` 时，internal LB 默认取 DP 组数而不是 1；GLM 教程显式写了 1。正文已按此措辞。
- 版本：v0.26 = vllm@568afb3a、main = vllm@98dff2a8（配套关系沿用 dp-request-routing 已核的 Dockerfile 口径）。两版都去掉了 AsyncMicrobatchTokenizer，分词每条单独进线程池（`renderers/base.py#L87-L100` / `#L92-L107`），渲染代码移到 `renderers/online_renderer.py`；请求 ID 后缀、先登记后发送、DELTA 合并、max_tokens 推算三版一致（逐个 git grep 核过）。
- vllm-ascend：db701c1f 与 2c59ff10 的聊天接口补丁只有输出侧（GLM tool call 流式分段 `patch/__init__.py#L147-L185`、空 tool_calls `#L291-L305`）；2ed6cbba 是 GLM 思考 token 计数（`#L200-L260`，另有只给 Kimi 的 renderer 补丁）；baa023ad 的 patch 目录里已没有聊天接口补丁文件（`__init__.py` 里还留着空 tool_calls 那条说明）。

**信息清单勾选（清单在 scratchpad `p5/api-server-entry-facts.md`，共 40 条）。** 新建页没有旧版，清单取自 01 §A1、依赖页和本轮源码核实。
- F1–F11、F13、F15、F16、F21：正文都有（F7、F8 的函数名放在源码位置表与流程图 pins）。
- F12、F17、F18、F19：打分规则、场景 M 的 12 对 7、连发交替、计数来源属 dp-request-routing 唯一出处，本页只写「请求头直接用 / 否则按忙闲打分」并链接 `dp-request-routing.md#一条新请求进来派给哪一个-dp-组` 与其 GLM 节。
- F14：引擎侧四步写进「到了引擎那边」与流程图底排；DPEngineCoreProc 对齐 wave 号的类名细节留在 request-call-chain 的源码表，本页只讲 wave 号是什么、谁盖上去。
- F20：模板细节链接 token 页，不重写。
- N1–N19：全部在正文、表或对照源码里。

**待核（页末已写）。** 前端 CPU 成为瓶颈的并发点没有实测；GLM 模板 system 行 token 数沿用 token 页的待核口径。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错；中途出现的 dup-alias 6 条是本页别名与 engine-processes / sampling / streaming-output / vllm-v1-shape 撞名，已删掉这些别名）；`pnpm wiki:diagrams --check` 通过、本页两张图 0 条待留意；`pnpm wiki:audit` 通过（首轮报 `renderers/base.py#L1018-L1059` 越界，文件只有 1056 行，已改）。未起服务、未做浏览器验收（按派发说明留给审查环节）。

## P5 审查（09-29）

审查员：独立审查（Opus 5.5），10-02。只审不改页面。

**结论：8.0 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（全部 ✓，总体 exit 0）；`pnpm wiki:lint` 通过（本页 0 条）。P1 0 条，P2 4 条，P3 5 条。**

### 初学者测试（只读前两屏）
API server 入口是 vLLM 前端进程把一段 HTTP JSON 检查、套模板、分词、定好输出上限和采样参数，包成引擎请求、先登记回程接收点再派给某个 DP 组的那一段；代价全在主机侧：默认 1 个工作线程排队做模板和分词（计入首 token 时延）、每条在途请求占一份前端记录、单前端并发高时 CPU 可能先成瓶颈。——能说清，通过。

### 学习顺序
是什么（「你好」流式请求 → 引擎要的三样东西 → 直觉图）→ 为什么在前端做 + 代价 + 分工表 → 怎么做 ①–④（示意数 calc：上限 100）→ ⑤–⑦ → 流式/非流式 → 变体 → GLM 双机 → 常见误解 → 对照源码。基础节无 GLM 数字，通用节都在 GLM 之前，第一节末尾没堆链接。**通过。**

### 信息清单
`13898c74…/scratchpad/p5/api-server-entry-facts.md` 存在（F1–F21、N1–N19）。抽查 9 条到新版：F13 叫醒协调器（L165）、F15 R1 = 4 是演示设定 + 6 个特殊标记（L214、L216）、N5 线程池 1 + 微批 32 条/2 ms（L125）、N6 聊天不补特殊标记、补全接口补且默认 16（L124、L202）、N7 只切到上限 +1（L133、L137）、N11 请求 ID 与 8 位后缀（L157）、N14 单槽合并（L161）、N17 输入线程建 Request（L167）、N19 GLM 工具解析器（L225）——都在，勾选属实。

### 核心概念对照（vllm@0fc695fc，tools/repos/vllm）
- max_completion_tokens 优先于 max_tokens：`chat_completion/protocol.py#L504-L506` ✓
- 只切到允许输入数 +1、错误信息带「at least」：`renderers/params.py#L298-L306`、`#L415-L435` ✓；示意 calc 手算 100−30=70、75−70=5、截到 71、100−12=88 ✓
- 不写输出上限时 = min(上限−输入, 生成配置/override/平台上限)：`serve/utils/api_utils.py#L170-L206` ✓（GLM 生成配置无 max_new_tokens，平台未覆盖，133120−4=133116 成立）
- 模板与分词都进 renderer 线程池、默认 1 线程、微批 32/0.002 s：`renderers/base.py#L88-L89`、`renderers/hf.py#L876-L877`、`config/model.py#L323`、`utils/async_utils.py#L35-L36` ✓
- 聊天 add_special_tokens 默认 False、补全 True、补全 max_tokens 默认 16：`chat_completion/protocol.py#L290-L291`、`completion/protocol.py#L60`、`#L99-L100` ✓
- 内部 ID 加 8 位随机字符：`v1/engine/input_processor.py#L223-L232` ✓；对外 ID = chatcmpl- + X-Request-Id：`chat_completion/serving.py#L257`、`openai/engine/serving.py#L387-L392` ✓
- 后台分拣遇到不认识的 ID 直接跳过：`v1/engine/output_processor.py#L606-L611` ✓
- generate 是异步生成器，被迭代才 add_request；取消即 abort：`v1/engine/async_llm.py#L524-L600` ✓（因此流式 200 先于进 AsyncLLM 成立）
- n>1 子请求种子错开：`v1/engine/parallel_sampling.py#L58-L80` ✓
- 引擎输入线程当场建 Request 再进 input_queue：`v1/engine/core.py#L1525-L1543` ✓
- 引擎死 → 500，流式靠 watchdog 退出：`serve/utils/server_utils.py#L327-L362` ✓
- 多前端共用监听端口（SO_REUSEPORT，套接字传给子进程）：`openai/api_server.py#L484-L491`、`cli/serve.py#L334` ✓
- R1 平分落 DP0：与 dp-request-routing L177、01 §A1 一致 ✓

核心概念无错。

### P2
1. **L214 教程验证请求「只写了要 50 个输出」会误导。** 教程（vllm-ascend@0576b647 GLM5.3-Flash.md L359-L364）发的是 /v1/completions，但字段写的是 max_completion_tokens；补全接口的 CompletionRequest 没有这个字段（`completion/protocol.py` grep 为 0），OpenAIBaseModel 是 extra="allow"，只打一条「字段被忽略」的警告（`openai/engine/protocol.py#L30`、`#L54`），于是实际按补全接口默认 16 个输出；只有聊天接口认 max_completion_tokens（`render/serving.py#L157-L160` 在 render_chat_request 里）。改法：写明这条请求写的是 max_completion_tokens 50，补全接口不认、实际最多生成 16 个；正好呼应本页 L202 的「默认 16」，可作为变体一节的真实例子。
2. **R1 的输出上限和别页不一致。** 本页 L216–L223 把 R1 定为「请求不写输出上限」，算出 133116；但 one-request L532 第 7 站设 R1 的 max_tokens = 200，streaming-output L251 又写「与第 7 站的设定相同」。同一条贯穿例子出现两个输出上限。改法：二选一统一口径——要么本页 calc 改成 R1 写了 max_tokens 200（输入允许 = 133120 − 200 = 132920 ≥ 4，通过，上限 200），要么在本页注明「这里按不写算；第 7 站为演示长度到限另设 200」，并让 streaming-output 的措辞跟上。R1 的设定应只在 one-request 定一次。
3. **入口的单一出处还没接上。** 全库只有 streaming-output 链到本页；one-request 第 1 站（L115–L126）、request-call-chain ①（L181）、engine-processes、dp-request-routing、token 的 R1 入口节都没有指向本页的链接；`src/content/wiki/toc.ts` L96 的分组也还没收本页（写手已标「需主会话处理」），侧栏里找不到这一页。改法：主会话把 api-server-entry 插进 toc（engine-processes 之后）；one-request 第 1 站和 request-call-chain ① 各补一句「入口每一步细节见 API server 入口」，保持现有摘要不扩写。
4. **输出槽合并与 streaming-output 两处都讲。** 本页 L161 用整段（含「你」+「好」例子、后台任务）讲单槽合并，streaming-output「前端跟不上时：几步的文字并成一段」（L197–L203）是这件事的正式出处。改法：本页保留「只有一个位置、取不及时会合并」一句和例子即可，后台任务让出、--stream-interval 等细节链到 streaming-output 那一节，不再展开。

### P3
1. L206「有的部署方式默认就按 DP 组数起」太含糊。写手记录已核到：不写 --api-server-count 时，内部负载均衡默认取 DP 组数（`cli/serve.py#L99-L148`）。建议直接这么写。
2. L193 表把「顶满上限」放在 ⑤、流式先 200。聊天接口里这种情况在 ③（写了输出数，长度检查拦）或 ④（没写时推出 0，SamplingParams 要求 ≥1，`sampling_params.py#L534`）就以普通 400 拒掉，⑤ 只是兜底。建议表里注明「⑤ 是兜底，聊天接口通常在 ③④ 已拦」。
3. L127「没写，前端就把上限减去输入长度」漏了生成配置的 max_new_tokens、override、平台上限也参与取最小。GLM 上不影响结果，但通用规则不完整；补半句即可。
4. L95「KV cache 的块」首次出现无解释无链接，建议链到 KV cache 页。
5. L239「要用内部 ID 的前缀去找」读着绕，内部 ID 的前缀就是对外 ID；建议改成「拿对外 ID 去搜即可，引擎日志里的 ID 以它开头」。

### 其他检查
- 对照源码五个 H3 齐全、顺序对；版本差异出现 v0.23、v0.26、main（另标了 db701c1f、2c59ff10）。
- 对照源码之上：行内代码 0、证据角标 0；calc 2 个分在两节，都不与表格相邻。
- 无 meta 文本；两张图都没用 exchanges 分镜（不涉及 P2「待样式定稿」）。
- 截图（5193 预览，桌面 1440）：第一屏 `scratchpad/api-server-entry-review-first.png`，直觉图 `…-review-diagram.png`，流程图 `…-review-flow.png`（路径为审查员会话 1237c9d2 的 scratchpad）。两张图无压字、无出框，左列形态变化和出错出口清楚。
- 跳过：frontmatter 来源区、对照源码正文（只 grep）、HANDBOOK、docs/plans/。读取未被拦。

## P5 修订记录（10-02）

逐条对应「P5 审查」。字数（wc.py 口径）：全文 7,726 → 7,997，教学正文 6,300 → 6,519。

**P2-1 教程验证请求的实际生成数：成立，已改。** 核实：教程 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L354-L391` 的验证请求发 /v1/completions、写 `max_completion_tokens: 50`；`completion/protocol.py` 里 max_completion_tokens 出现 0 次，CompletionRequest 继承 OpenAIBaseModel（`extra="allow"`，多余字段只记「present in the request but ignored」警告，`openai/engine/protocol.py#L25-L60`）；补全接口按 `request.max_tokens`（默认 16）推输出上限（`completion/serving.py#L160-L163`）。改动：GLM 节写明「写的是 max_completion_tokens 50，补全接口不认，实际最多 16 个；要 50 个得写 max_tokens 或改走聊天接口」；变体一节补一句「补全接口不认 max_completion_tokens」并回指 GLM 节作真实例子；sources 加上述三处。写作记录里「max_completion_tokens 50」那条信息本身没错，错在正文把它说成「要 50 个输出」。

**P2-2 R1 输出上限：成立，错在本页，已改本页；one-request、streaming-output 不改。** 查底稿：01 §A1 只定 R1 的提示词为 4 个编号，没定 max_tokens；01 §A7「具体数字」用的是「R1 若生成 200 个 token」的假设，待核第 1 条写明 max_tokens 缺省值未展开；03 没有 R1 的 max_tokens。站内唯一给 R1 定输出上限的是 one-request 第 7 站「设 R1 的 max_tokens = 200」，streaming-output 收尾节沿用它（「与第 7 站的设定相同」），两页一致、都不算错。本页原来按「不写」算出 133116，自造了第二个口径。改法：GLM 节写明输出上限沿用第 7 站设定的 200，calc 改为「允许的输入 = 133120 − 200 = 132920；4 个在范围内；输出上限 = min(133120 − 4, 200) = 200」，「不写时是 133116」降为 calc 旁注。已按源码核：写了 200 时 `renderers/params.py#L186-L192` 的允许输入 = 133120 − 200，`api_utils.py#L170-L206` 取最小得 200。
- 给主会话的建议（不改别页）：R1 的 max_tokens = 200 目前只在 one-request 第 7 站以「设」字引入，「示例请求 R1」一节（one-request L111）没写；若要做到 R1 设定只定一次且在首现处，建议在该节补「输出上限 max_tokens = 200，第 7 站用到」，届时本页和 streaming-output 的措辞都不用动。

**P2-3 入链：不改别页，建议如下（均为已在 standard-pages 名单的页）。** 每处只补一句「入口每一步的细节见 [API server 入口](api-server-entry.md)」，不扩写：
1. one-request「第 1 站 入口：从 HTTP 到 node0 的引擎」末段（L126「到这里，R1 在 node0 上有了两份记录」那段）。
2. request-call-chain「七站逐站」的 ① 段（L181）。
3. token「再交给某一个引擎等待调度」（L196，现在链到调用链的入口一站）。
4. engine-processes「每个进程里存着什么」里「API server 不是把请求交出去就没事了」那段（L171）。
5. sampling「采样参数从哪来」首段（L234「参数在入口收到请求时就定下来」）。
6. vllm-v1-shape「vLLM 怎样把一条请求变成一步一步的计算？」里「前端」那条（L70）。
7. dp-request-routing 第一节（L46 起），说明选组之前前端已做完哪些事。
toc.ts 落位按主会话统一处理，本页未改 src/。

**P2-4 输出槽合并与 streaming-output 重复：成立，已改。** 审查建议归属 streaming-output「前端跟不上时：几步的文字并成一段」。本页 ⑥ 第二段压成一句（单槽、后台任务往里放、上一段没取走就并，「你」+「好」例子保留在括号里）+ 链接 `streaming-output.md#前端跟不上时几步的文字并成一段`（该节现存，lint 通过）。删去后台任务何时启动、非流式只关心最后一次等展开；「先登记后发送、不认识的 ID 丢掉」一段保留，这是入口的事。

**P3。**
1. 多前端默认值：成立，已改为「由本前端统一给各组派活的部署方式，即 internal LB，默认就按 DP 组数起」（`cli/serve.py#L99-L121`）。
2. 「顶满上限」放 ⑤：成立，已改。检查表拆成两行：⑤ 只留编号越界、组号越界、空提示词；新增一行「提示词顶满上限 → 通常在 ③ ④ 就拦下，⑤ 只是兜底 → 400」。核实：写了输出数时 ③ 的允许输入 = 上限 − 输出数，先拦；没写时 ④ 推出 0，`sampling_params.py#L534-L540` 要求 ≥ 1，抛 VLLMValidationError，发生在建生成器之前，流式也是普通 400。「会报什么错」补 `max_tokens must be at least 1, got 0.`，原 decoder prompt 那条改注「兜底检查」。
3. 输出上限规则不全：成立，已补「生成配置给了最大新 token 数、或启动时覆盖了这项默认值的，再和它们取小」；版本差异表同一行同步。
4. KV cache 首现：成立，已加链接 kv-cache.md 与一句解释。
5. 内部 ID 措辞：成立，已改为「拿返回给客户端的 ID 去搜即可，日志里的内部 ID 以它开头」，并写明对外 ID 带「chatcmpl-」前缀。

**验证。** `pnpm wiki:lint` 通过（本页 0 条）；`pnpm wiki:diagrams --check` 通过（281 张一致，本页两张图未改）；`pnpm wiki:audit` 通过（本页 53 条来源全部 ✓）；手动 checkStandard：教学正文 5,995 字 · 行内代码 0.0/千字 · 角标 0 · calc 0.33/千字 · 相邻块 0 · 图先行 · 免责 1.2%，PASS。未起服务。跳过：无。
