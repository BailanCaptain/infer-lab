# streaming-output 审查记录

## P5 写作记录（2026-10-02，第 19 批，新页）

**改了什么。** 新建 `wiki/concepts/streaming-output.md`（p4-checkpoint 无旧版，改前 0 字；改后 audit 口径正文约 14.7k 字，7 个 H2）与两张图 `streaming-output-intuition.yaml/svg`、`streaming-output-flow.yaml/svg`。挂靠主线 A7（第 7 站），chapters 记 09。

**结构（按 basics-standard 学习顺序）。** 是什么（直觉图 + 「推理」「犇」例子，先分清 token 编号 / 文本增量 / SSE 片段）→ 为什么要流式与代价（TTFT 示意 calc：200 ms + 199 × 30 ms = 6,170 ms）→ 怎么做（代码流程图 + 五个 H3：引擎侧追加判停、增量反分词、停止字符串扣字 calc、SSE 事件序列、收集器合并与 --stream-interval）→ 变体（思考段、工具调用、n>1、logprobs、断开）→ GLM 双机（单 API server、32 < 128、异步调度、R1 三圈 1+2+4 calc、GLM 分词器与思考标记、长度到限收尾）→ 常见误解 → 对照源码五个 H3。基础节不含 GLM 数字；GLM 之后只有误解和源码。

**直觉图。** 四列四行：每列一步，行依次是引擎交回的编号 → 增量反分词的新增文字 → 判停 → 推给客户端的片段；第 2 步半个字只推空片段，第 3 步凑齐「犇」，第 4 步结束 token 不显示、只写结束原因，再接 [DONE]。流程图：EngineCore（追加判停、有东西才发、终止归还）→ ZMQ → API server 后台输出任务（分片、反分词查停止字符串、命中通知终止、算增量、放收集器）→ 这条请求的 HTTP 任务（取出、拼片段、写连接、结束三件套、断开终止）。

**数字出处。** 一步 1–4 个 token、R1 收尾 16–17 块：01 §A7「具体数字」与 one-request 第 7 站（只链接不重算）；R1 三圈 y₀ / y₁y₂ / y₃–y₆：03 §A6 第 1、2 步 decode 表与 one-request「三步的账」；max_num_seqs 32：03 §0；133120 与三个结束编号：sampling「停止判断和长度上限」；max_tokens=200 时最后一圈返回 3 个：one-request 第 7 站。TTFT 与 ### 两个 calc 为示意数。

**核心概念对照。** vLLM 0fc695fc：scheduler.py `_update_request_with_output`（逐个追加、check_stop 截断）与 `update_from_output` 发结果条件；async_llm.py `_run_output_handler`（128 条一片、sleep(0)、abort_requests_async）与 `generate`（取消即 abort）；output_processor.py `process_outputs`（`detokenizer.update(new_ids, finish==STOP)`、reqs_to_abort）、`make_request_output`（FINAL_ONLY 不出中间结果、stream_interval）、`RequestOutputCollector`（DELTA 时合并）；detokenizer.py（tokenizers ≥ 0.22 且 fast 时用 DecodeStream 并以 prompt 预热、Invalid prefix 重建；stop_buffer_length = 最长停止串 − 1；结束时不扣；check_stop_strings 只搜新增附近）；chat protocol `to_sampling_params`（stream → DELTA）；serving.py 流生成器（首包 role + content ""、空 delta 也发、解析器返回 None 时跳过、finish/usage/错误/[DONE]）。GLM 分词器：本地参考 tokenizer_config.json 的 tokenizer_class = TokenizersBackend；tokenizer.json added_tokens 中 `<think>` 154841、`</think>` 154842 special=false，154820/154827/154829 special=true。官方教程 0576b647 FAQ 第 423–424 行 glm47 / glm45，部署命令无解析器、无 --stream-interval。
版本：vLLM v0.26 `568afb3a`、main `84030bbe` 逐文件 diff；vllm-ascend 2c59ff10 / db701c1f / 2ed6cbba / baa023ad 逐个 grep 补丁。

**信息清单勾选**（scratchpad\p5\streaming-output-facts.md，22 条）：1–16 均在「怎么做」「变体」与源码区；17–18 在「GLM 的分词器和思考标记」；19 在 GLM 三节（16–17 块只链接）；20–21 在版本差异两表；22 在 GLM「一个前端进程」一节与待核。无删除项。

**自查疑点。** 无 P1 疑点。需要审查留意：①「本部署走快速反分词」是按分词器配置推断（[I]），镜像库版本未核；② 单 API server 由底稿按计划参数记，教程只出现一次；③ 配 glm45 时 v0.23 流里 `</think>` 落在哪个字段未实跑，已写进待核。底稿 A7 写的「按 chunk_size 切片」实为按请求条数（128 条）切片，本页按源码写。

**验证。** pnpm wiki:lint：本页 0 报错（全站唯一报错是 npugraph-ex 链到不存在的 output-processor.md，非本页）；pnpm wiki:diagrams --check：281 张一致，本页两图无报错、无提示；pnpm wiki:audit：本页 30 条来源中 28 条本地引用全部定位、2 条 Hugging Face 链接不做本地校验，0 处问题。正文行内代码 6 处（教学区约 0.8/千字）；角标 26 处、全在对照源码，C 占 77%。

**跳过了什么。** 无读取被拦。未截图、未起服务（按派发说明由审查环节做浏览器验收）。参考图库只含通信原语与 TP/DP/EP，本页不涉及，未借用。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（2026-10-02，第 19 批）。只审未改页面。

**结论：8.5 / 10。P1 0 条，P2 3 条，P3 6 条。学习顺序通过；`pnpm wiki:audit` 本页通过（30 条来源，本地引用全部定位，2 条 HF 链接不做本地校验）；`pnpm wiki:lint` 退出 0、无报错。**

### 初学者测试

只读前两屏能说出：流式输出是引擎每步交回 token 编号后，前端把新编号增量还原成新增文字、判停，再用 SSE 片段一段段推给客户端；好处是第一段更早到（总时长不变），代价在前端 CPU：每步每请求多打一次包，设了停止字符串要扣住结尾几个字，出错只能写在流里，断开要通知引擎。通过。

### 学习顺序

是什么（直觉图 +「推理」「犇」例子，先分清 token 编号 / 文本增量 / SSE 片段）→ 为什么（TTFT 示意 calc + 代价）→ 怎么做（五个 H3，停止字符串扣字有示意 calc）→ 变体 → GLM 双机 → 常见误解 → 对照源码。基础节没有 GLM 数字（128 是 vLLM 默认值，不是部署数）。通过。

### 核心概念（对照 vllm@0fc695fc，逐条判对）

- 引擎逐个追加、命中即截掉余下 token：scheduler.py L1700–1711 ✓；有新 token / 结束 / pooling / kv 参数才发：L1546–1551 ✓。
- 后台输出任务按 128 条请求一片切、片间让出：envs.py L145、async_llm.py L654–676 ✓（写手指出底稿 A7「按 chunk_size」实为按请求条数，属实）。
- 快速反分词条件：detokenizer.py L22–24（tokenizers ≥ 0.22）、L59–61（isinstance PreTrainedTokenizerFast）✓；STOP 结束且不含停止串时最后一个编号不进反分词：L108–113 ✓；扣字长度 = 最长停止串 − 1、include_stop_str_in_output 时不扣：L84–89 ✓；结束时不扣：L153 ✓。
- 多个停止串同时命中：v0.23 按列表顺序（L309–344），main 84030bbe 取最先完成的（L310–362）✓。
- --stream-interval：config/scheduler.py L150 默认 1；output_processor.py L287–300 首个 / 结束 / 攒够 N 才发 ✓；FINAL_ONLY 中间不出：L283–285 ✓。
- 收集器 DELTA 时合并：output_processor.py L45–100 aggregate ✓；断开即 abort：async_llm.py L591–595 ✓。
- SSE：无解析器时空 content 也发（serving.py L649–655 只跳过 prefill 空块，L731 无条件建 DeltaMessage）；解析器返回 None 时未结束就跳过（L757–767）✓；异常写错误片段后照发 [DONE]（L929–936）✓。
- GLM 补丁：patch_glm_tool_call_streaming 在 db701c1f 与 2c59ff10 都有、v0.26 / main 没有；patch_glm_reasoning_usage_accounting 只在 2ed6cbba；补丁逻辑是把带参数又带 finish_reason=tool_calls 的末包拆成两包（_split_terminal_tool_arg_chunk）✓，与版本差异表一致。
- 异步调度按默认打开：与 async-scheduling 页「本部署按自动判定为开」一致 ✓。

### 数字（对照底稿）

`--api-server-count 1`（01 L90）、max_num_seqs 32（03 L21、01 L638）、max_model_len 133120（01 L640；sampling L322 的「不写 max_tokens = 133120 − 提示词」）、一步 1–4 个 token 与 16–17 块（01 §A7 L786–787，只链接未重算）、197 + 4 → 只返回 3 个（one-request L532）、三个结束编号（sampling L322、token L169–171）、R1 三圈 1 + 2 + 4（one-request 三步的账）全部一致。两个示意 calc 手算：200 + 199 × 30 = 6,170 ✓；### 扣字四步 0 / 3 / 4 / 5 字 ✓。写手三条疑点：① 快速反分词已写进待核 ✓；② 单 API server 底稿 01 L90 有 ✓；③ glm45 下 `</think>` 落点已写进待核 ✓。

### 信息清单与单一出处

- 清单存在：旧会话 scratchpad\p5\streaming-output-facts.md，22 条。抽 8 条（#3、#7、#8、#12、#13、#15、#18、#20）到新版均找到对应句或版本差异表行 ✓。
- 原出处页没有两处都在细讲：one-request 第 7 站只两三句、request-call-chain ⑦ 与 sampling L256 各一句 + 链接、token L149 一句。但这些页都没改成链到本页（见 P2-1）。

### 浏览器验收

5193 在跑（8790 没起，/api/wiki/* 返回 502，与本页无关；未起停任何服务）。Playwright 1440 宽截图：第一屏、直觉图、流程图，存于审查会话 scratchpad：streaming-output-review-first.png、-fig1.png、-fig2.png。两图清晰、无溢出；无分镜动图。

### P1

无。

### P2

1. **入链缺失，单一出处页从主线够不到。** 全库只有 api-server-entry、npugraph-ex 链到本页；one-request 第 7 站（L522–530，讲增量反分词、stop string、SSE）、token「生成的编号怎样变回文字」末段（L149，提到流式接口）、request-call-chain ⑦（L195）、sampling 停止字符串一条（L256）都只链 one-request 或不链。改法：这四处各补一句「细节见[流式输出](streaming-output.md)」，one-request 第 7 站那段可再压成一句 + 链接。
2. **术语先用后讲。** prefill 在「为什么」的 calc（L100）和引擎侧一节（L139）直接出现，MTP 在 L137 首次出现只给了链接，本页都没有一句话解释。改法：首次出现处各加半句（prefill = 把提示词整段过一遍、交回第一个 token；MTP = 模型顺带草拟后面几个 token、下一步一起验证）。
3. **写作标准免责比超标（名单外所以 audit 没报）。** 把本页当名单页跑 checkStandard：免责句 10 / 155 = 6.5%，上限 3.0%；其余各项（行内代码 1.1/千字、角标 0、calc 0.57/千字、相邻块 0、图先行、图宽）都过。超标主要来自描述性的「可能」（L90、111、119、120、137、145、153、168、199、201、237、257 等）。改法：描述性的改成「会」「有时」「不一定」等，真正的不确定只留在待核一节；写手记录里「audit 0 处问题」应注明本页不在名单。

### P3

1. L115–121「三样东西的区别」小表是「是什么」的内容，却放在「为什么」一节末尾，且与 L78、L90 重复；建议挪到第一节例子之后，或删去。
2. 轻度重复：断开通知引擎在 L113、L213 和流程图各讲一次，空片段在 L90、L192、L262 各一次，「一个片段 ≠ 一个 token」在 L90、L117、L237、L257 各一次。「代价」四条可以只留一句话 + 指向后文，压掉约 5%。
3. L243 说 `<think>` / `</think>` 没有标成特殊 token，而 token 页 L170 把 154820–154855 统称「特殊标记」，两者编号 154841 / 154842 正落在这一段，读者对照会困惑；补半句「编号在那 36 个之内，但 special 字段为 false」。
4. 直觉图「判停」一行排在「增量反分词」之后，第 4 列像是前端先不还原、再判停；实际结束 token 是引擎先判、前端据此不还原。可在行标签写「判停（结束 token 在引擎判，停止字符串在前端判）」。
5. 流程图「命中了，而引擎还没停」框没有箭头接回「算这次的文本增量」（截断后的文字照常推出），「客户端断开」框孤立；可补一条箭头。
6. GLM 一节粗体导语（L217）「一个片段就带出 1–4 个 token 的文字」写得太绝对，前端跟不上时会合并；加「HTTP 任务及时取走时」。

### 跳过了什么

对照源码一节只 grep 了五个 H3 的顺序和版本标记（v0.23 / v0.26 / main 齐全），读了版本差异两张表的表格行和待核四条，没有读其余正文。GLM tokenizer.json / tokenizer_config.json 本地没有副本，`<think>` special=false 与 TokenizersBackend 未独立核实（写手已列入待核）。没有读取被拦。

## P5 修订记录（2026-10-02）

逐条对应「P5 审查」：

- **P2-1 入链缺失**：按派活要求不改别的页，建议主会话统一派这四处各补一句「细节见[流式输出](streaming-output.md)」：
  1. `one-request.md`「第 7 站 返回与收尾」：「stop string 可以横跨多个 token……一圈的 1–4 个编号可以组成不同长度的文字」那段，可压成一句 + 链接；
  2. `token.md`「生成的编号怎样变回文字？」末段，「流式接口……没有固定的一一对应关系」一句之后；
  3. `request-call-chain.md`「七站逐站：从哪个函数进，往下调谁」中「⑦沿请求 ID 找回①留下的队列」那段；
  4. `sampling.md`「什么时候停下来？」第二条（停止字符串放在前端判断）。
  `api-server-entry.md` 已链到本页。收集器合并的讲解节标题保持「前端跟不上时：几步的文字并成一段」不变，供 api-server-entry 链接。
- **P2-2 术语先用后讲**：prefill 在「为什么要流式」calc 之前补一句定义并链 [prefill](prefill.md)；MTP 在「引擎侧」一节首次出现处补一句（模型顺带草拟后面几个 token、下一步一起验证、猜对几个多出几个）并链投机解码页。
- **P2-3 免责比**：教学区 12 处「可能」全部改成确定说法（「有时」「会」「不一定」「要」）；不确定性只留在源码区「待核」。用 `scripts/wiki/standard.ts` 的 measureStandard 按名单页口径复测：句 157、免责 0（0%），行内代码 0.96/千字，角标 0，calc 0.57/千字，standardProblems 无问题。写作记录里「audit 0 处问题」补注：本页不在 standard-pages 名单，audit 不强制写作项，以上为手动按名单口径测得。
- **P3-1**：「三样东西」小表挪到第一节例子之后，删掉第二节末尾那份；第一节末段改为引出这张表。
- **P3-2**：「代价」四条压成每条一句、指向后文；「变体」里的客户端断开压成一句并指向流程图。空片段、「片段 ≠ token」在第一节、SSE 一节、常见误解各留一次，属于「是什么 / 机制 / 误解」三处不同用途，未再删。
- **P3-3**：GLM 节补半句：`<think>`、`</think>` 编号 154841、154842 落在 token 页说的 36 个特殊标记编号段里，但分词器文件里 special 为 false。审查说本地没有 tokenizer 副本：副本在 `C:\Users\-\Desktop\infra-view-hardware-study-20260906\glm-flow\reference\`，写手用脚本只抽 added_tokens 元数据核过（154841/154842 special=false，154820/154827/154829 special=true；tokenizer_config.json 的 tokenizer_class 为 TokenizersBackend）。
- **P3-4**：直觉图行标签改成「判停（两处）」，第 4 列编号框副标题改「引擎当场判停」、反分词框改「已判停，不还原」；图注补「结束 token 和长度由引擎判，停止字符串由前端判，第 4 步的停是引擎判的」。
- **P3-5**：流程图补两条线：「命中了，而引擎还没停」→「算这次的文本增量」（截断后剩下的文字照常推）；「客户端断开」→ 引擎「终止请求，归还显存块」（右侧绕行虚线）。图注同步补一句。
- **P3-6**：GLM 节导语改为「HTTP 任务及时取走时，一个片段就带出 1–4 个 token 的文字」。

**验证。** pnpm wiki:lint 退出 0、全站无报错；pnpm wiki:diagrams --check：281 张一致，本页两图无报错、无提示；pnpm wiki:audit：本页 30 条来源，本地引用全部定位，0 处问题。
